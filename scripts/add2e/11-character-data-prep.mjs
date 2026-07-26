// =======================
//  HOOK UNIQUE updateActor
// =======================

const ADD2E_MULTICLASS_HP_SYNC_VERSION = "2026-06-13-multiclass-hp-current-gain-v1";
globalThis.ADD2E_MULTICLASS_HP_SYNC_VERSION = ADD2E_MULTICLASS_HP_SYNC_VERSION;
const ADD2E_MULTICLASS_HP_SYNC_LOCK = new Set();

function add2eIsMulticlassCharacter(actor) {
  if (!actor || actor.type !== "personnage") return false;
  if (actor.system?.multiclasse?.enabled === true) return true;
  return (actor.items?.filter?.(i => String(i.type || "").toLowerCase() === "classe")?.length ?? 0) > 1;
}

function add2eMulticlassHpRelevant(changes = {}) {
  if (!changes?.system) return false;
  return foundry.utils.hasProperty(changes, "system.niveaux_par_classe")
    || foundry.utils.hasProperty(changes, "system.xp_par_classe")
    || foundry.utils.hasProperty(changes, "system.classes")
    || foundry.utils.hasProperty(changes, "system.details_classes")
    || foundry.utils.hasProperty(changes, "system.multiclasse")
    || foundry.utils.hasProperty(changes, "system.classe");
}

async function add2eSyncMulticlassHp(actor, { force = false, syncCurrent = false, reason = "multiclass-hp-sync" } = {}) {
  if (!game.user?.isGM) return false;
  if (!add2eIsMulticlassCharacter(actor)) return false;
  if (ADD2E_MULTICLASS_HP_SYNC_LOCK.has(actor.id)) return false;

  ADD2E_MULTICLASS_HP_SYNC_LOCK.add(actor.id);
  try {
    const oldMax = Number(actor.system?.points_de_coup ?? 0);
    const oldCurrent = Number(actor.system?.pdv ?? 0);

    if (typeof actor.sheet?.autoSetPointsDeCoup === "function") {
      await actor.sheet.autoSetPointsDeCoup({ syncCurrent: false, force, reason });
    }

    const max = Number(actor.system?.points_de_coup ?? 0);
    const current = Number(actor.system?.pdv ?? 0);
    if (!Number.isFinite(max) || max <= 0 || !Number.isFinite(current)) return true;

    const hpGain = Number.isFinite(oldMax) && oldMax > 0 ? Math.max(0, max - oldMax) : 0;
    const update = {};

    if (syncCurrent) update["system.pdv"] = max;
    else if (hpGain > 0 && Number.isFinite(oldCurrent)) update["system.pdv"] = Math.min(max, Math.max(current, oldCurrent + hpGain));
    else if (current > max) update["system.pdv"] = max;

    if (Object.keys(update).length) await actor.update(update, { add2eInternal: true, add2eReason: reason });
    return true;
  } catch (err) {
    console.warn("[ADD2E][MULTICLASSE][PV][SYNC_ERROR]", { actor: actor?.name, reason, err });
    return false;
  } finally {
    ADD2E_MULTICLASS_HP_SYNC_LOCK.delete(actor.id);
  }
}

const ADD2E_CARAC_CHANGE_KEYS = Object.freeze([
  "force", "force_base", "force_ex",
  "dexterite", "dexterite_base",
  "constitution", "constitution_base",
  "intelligence", "intelligence_base",
  "sagesse", "sagesse_base",
  "charisme", "charisme_base"
]);

const ADD2E_CARAC_RECALC_REASONS = new Set([
  "ability-base-initialize",
  "ability-derived-recalculate"
]);

function add2eActorUpdateChangesCharacteristic(changes = {}) {
  const system = changes?.system && typeof changes.system === "object" ? changes.system : {};
  const systemChanged = ADD2E_CARAC_CHANGE_KEYS.some(key => {
    const path = `system.${key}`;
    return Object.prototype.hasOwnProperty.call(system, key)
      || Object.prototype.hasOwnProperty.call(changes, path)
      || foundry.utils.hasProperty(changes, path);
  });
  return systemChanged
    || Object.prototype.hasOwnProperty.call(changes, "flags.add2e.modifiers")
    || foundry.utils.hasProperty(changes, "flags.add2e.modifiers");
}

Hooks.on("updateActor", async (actor, changes = {}, options = {}, _userId) => {
  if (options?._fromSync) return;

  const changeKeys = Object.keys(changes ?? {});
  if (changeKeys.length === 1 && changeKeys[0] === "_id") return;

  const caracChanged = actor?.type === "personnage" && add2eActorUpdateChangesCharacteristic(changes);
  const caracRecalculation = ADD2E_CARAC_RECALC_REASONS.has(String(options?.add2eReason ?? ""));
  if (options?.add2eInternal && (!caracChanged || caracRecalculation)) return;

  // =====================================================
  // 0) Garde anti-boucle + gestion PV au changement de niveau
  // =====================================================
  if (changes?.system && Object.prototype.hasOwnProperty.call(changes.system, "niveau")) {
    const clamp = add2eClampLevelToClassMax(actor, changes.system.niveau, null, { notify: true });
    if (clamp.changed) {
      await actor.update({ "system.niveau": clamp.level }, { add2eInternal: true });
      changes.system.niveau = clamp.level;
    }
  }

  if (changes?.system && Object.prototype.hasOwnProperty.call(changes.system, "niveau")) {
    const lvl = Number(changes.system.niveau) || Number(actor.system?.niveau) || 1;

    try {
      if (actor.sheet?.autoSetPointsDeCoup) {
        await actor.sheet.autoSetPointsDeCoup({ syncCurrent: true, force: true, reason: "level-change" });
      } else {
        const classeItem = actor.items?.find(i => i.type === "classe");
        const prog = classeItem?.system?.progression;
        const hpMax = Array.isArray(prog) && prog[lvl - 1] && prog[lvl - 1].pdv !== undefined ? Number(prog[lvl - 1].pdv) : NaN;
        if (Number.isFinite(hpMax) && hpMax > 0) {
          await actor.update({ "system.points_de_coup": hpMax, "system.pdv": hpMax }, { add2eInternal: true });
        }
      }
    } catch (_e) {}

    try {
      await add2eSyncMonkUnarmedWeapon(actor);
    } catch (_e) {}

    try {
      await add2eSyncNewSpellLevelsAfterActorLevelChange(actor, lvl);
    } catch (_e) {
      ui.notifications.error("Erreur pendant la synchronisation des sorts au changement de niveau. Voir la console.");
    }
  }

  if (add2eMulticlassHpRelevant(changes)) {
    await add2eSyncMulticlassHp(actor, { force: false, syncCurrent: false, reason: "multiclass-field-change" });
  }

  // =====================================================
  // 1) Recalcul des caractéristiques par le résolveur unique
  // =====================================================
  try {
    if (caracChanged && !ACTIVE_CARAC_AUTO.has(actor.id)) {
      ACTIVE_CARAC_AUTO.add(actor.id);
      try {
        if (typeof actor.sheet?.autoSetCaracAjustements === "function") {
          await actor.sheet.autoSetCaracAjustements();
        } else if (typeof actor.autoSetCaracAjustements === "function") {
          await actor.autoSetCaracAjustements();
        }
        if (actor.sheet?.rendered) actor.sheet.render(false);
      } finally {
        ACTIVE_CARAC_AUTO.delete(actor.id);
      }
    }
  } catch (_e) {}

  // =====================================================
  // 2) Gestion auto des états INCONSCIENT / MORT (PV)
  // =====================================================
  try {
    if (game.user.isGM && game.user.id === game.users.activeGM?.id) {
      const HP_PATHS = ["system.pdv"];
      let hpPathChanged = null;

      for (const path of HP_PATHS) {
        if (foundry.utils.hasProperty(changes, path)) {
          hpPathChanged = path;
          break;
        }
      }

      if (hpPathChanged) {
        const newHP = Number(foundry.utils.getProperty(actor, hpPathChanged) ?? 0);
        const actorType = String(actor?.type ?? "").trim().toLowerCase();
        const isMonster = actorType === "monster" || actorType === "monstre";

        const DEAD_STATUS = "dead";
        const UNCONSCIOUS_STATUS = "unconscious";

        if (isMonster) {
          if (typeof globalThis.add2eSyncActorVitalStatus === "function") {
            await globalThis.add2eSyncActorVitalStatus(actor, { reason: "11-character-data-prep:monster-hp" });
          } else if (newHP <= 0) {
            await actor.toggleStatusEffect(UNCONSCIOUS_STATUS, { active: false, overlay: false });
            await actor.toggleStatusEffect(DEAD_STATUS, { active: true, overlay: true });
          } else {
            await actor.toggleStatusEffect(DEAD_STATUS, { active: false, overlay: false });
            await actor.toggleStatusEffect(UNCONSCIOUS_STATUS, { active: false, overlay: false });
          }
        } else if (actorType === "personnage") {
          if (newHP <= -11) {
            await actor.toggleStatusEffect(UNCONSCIOUS_STATUS, { active: false, overlay: false });
            await actor.toggleStatusEffect(DEAD_STATUS, { active: true, overlay: true });
          } else if (newHP <= 0) {
            await actor.toggleStatusEffect(DEAD_STATUS, { active: false, overlay: false });
            await actor.toggleStatusEffect(UNCONSCIOUS_STATUS, { active: true, overlay: true });
          } else {
            await actor.toggleStatusEffect(DEAD_STATUS, { active: false, overlay: false });
            await actor.toggleStatusEffect(UNCONSCIOUS_STATUS, { active: false, overlay: false });
          }
        }
      }
    }
  } catch (_e) {}

  // =====================================================
  // 3) Synchronisation des tokens liés
  //    Pour les tokens liés, Foundry synchronise déjà.
  // =====================================================
  try {
    actor.getDependentTokens?.({ linked: true });
  } catch (_e) {}
});

function add2eModifierListHasAbility(raw) {
  const list = Array.isArray(raw) ? raw : (raw && typeof raw === "object" ? Object.values(raw) : []);
  return list.some(modifier => String(modifier?.domain ?? "").trim().toLowerCase() === "ability");
}

function add2eDocumentHasAbilityModifier(document) {
  if (add2eModifierListHasAbility(document?.flags?.add2e?.modifiers)) return true;
  const effects = Array.from(document?.effects?.contents ?? document?.effects ?? []);
  return effects.some(effect => effect?.disabled !== true && add2eModifierListHasAbility(effect?.flags?.add2e?.modifiers));
}

function add2eChangesTouchModifiers(changes = {}) {
  if (!changes || typeof changes !== "object") return false;
  if (Object.prototype.hasOwnProperty.call(changes, "flags.add2e.modifiers")) return true;
  if (Object.prototype.hasOwnProperty.call(changes, "flags.add2e.-=modifiers")) return true;
  if (foundry.utils.hasProperty(changes, "flags.add2e.modifiers")) return true;
  const nested = changes?.flags?.add2e;
  return Boolean(nested && typeof nested === "object" && (
    Object.prototype.hasOwnProperty.call(nested, "modifiers")
    || Object.prototype.hasOwnProperty.call(nested, "-=modifiers")
  ));
}

const ADD2E_EFFECT_CARAC_RECALC_LOCK = new Set();
async function add2eRecalculateCharacteristicsAfterModifierDocument(document, changes = null) {
  if (!add2eDocumentHasAbilityModifier(document) && !add2eChangesTouchModifiers(changes)) return;
  const parent = document?.parent ?? document?.actor ?? null;
  const actor = parent?.documentName === "Actor" ? parent : parent?.actor ?? null;
  if (!actor?.system || actor.type !== "personnage" || ADD2E_EFFECT_CARAC_RECALC_LOCK.has(actor.id)) return;

  ADD2E_EFFECT_CARAC_RECALC_LOCK.add(actor.id);
  try {
    await new Promise(resolve => setTimeout(resolve, 0));
    if (typeof actor.sheet?.autoSetCaracAjustements === "function") await actor.sheet.autoSetCaracAjustements();
    else if (typeof actor.autoSetCaracAjustements === "function") await actor.autoSetCaracAjustements();
    if (actor.sheet?.rendered) actor.sheet.render(false);
  } finally {
    ADD2E_EFFECT_CARAC_RECALC_LOCK.delete(actor.id);
  }
}

Hooks.on("createActiveEffect", effect => add2eRecalculateCharacteristicsAfterModifierDocument(effect));
Hooks.on("updateActiveEffect", (effect, changes) => add2eRecalculateCharacteristicsAfterModifierDocument(effect, changes));
Hooks.on("deleteActiveEffect", effect => add2eRecalculateCharacteristicsAfterModifierDocument(effect));
Hooks.on("createItem", item => add2eRecalculateCharacteristicsAfterModifierDocument(item));
Hooks.on("updateItem", (item, changes) => add2eRecalculateCharacteristicsAfterModifierDocument(item, changes));
Hooks.on("deleteItem", item => add2eRecalculateCharacteristicsAfterModifierDocument(item));

async function consommerSortMemorise(actor, nomSort, niveau = 1) {
  const chemin = `system.memorized.${niveau}.${nomSort}`;
  const nb = foundry.utils.getProperty(actor, chemin) ?? 0;
  if (nb > 0) {
    await actor.update({ [chemin]: nb - 1 });
    ui.notifications.info(`${nomSort} (niv.${niveau}) consommé pour ${actor.name} (${nb - 1} restants)`);
  } else {
    ui.notifications.warn(`${actor.name} n'a plus de ${nomSort} (niv.${niveau}) mémorisé !`);
  }
}

async function majImageToken(actor, newImg) {
  if (!actor || typeof actor.update !== "function") return;
  await actor.update({
    img: newImg,
    "token.img": newImg,
    "prototypeToken.texture.src": newImg
  });
}

function plageToRollFormula(plage) {
  if (typeof plage !== "string") return plage;
  const match = plage.match(/^(\d+)\s*-\s*(\d+)$/);
  if (!match) return plage;
  const min = Number(match[1]);
  const max = Number(match[2]);
  if (isNaN(min) || isNaN(max) || max <= min) return plage;
  const faces = max - min + 1;
  const bonus = min - 1;
  return `1d${faces}` + (bonus > 0 ? `+${bonus}` : "");
}

function rollHitDice(hdString) {
  if (!hdString) return 0;
  const match = hdString.match(/^(\d+)d(\d+)(?:\s*\+\s*(\d+))?$/i);
  if (!match) return 0;
  const nb = Number(match[1]);
  const faces = Number(match[2]);
  const bonus = Number(match[3] || 0);
  let total = 0;
  for (let i = 0; i < nb; i++) total += Math.floor(Math.random() * faces) + 1;
  total += bonus;
  return total;
}

// =========================================================
// ASSURE actor.system.spellcasting pour les personnages uniquement
// Source stricte : item classe embarqué -> classItem.system.spellcasting
// =========================================================
Hooks.once("ready", () => {
  (async () => {
    try {
      if (!game.user.isGM) return;

      for (const actor of game.actors?.contents ?? []) {
        if (actor.type !== "personnage") continue;
        if (actor.system?.spellcasting !== undefined && actor.system?.spellcasting !== null) continue;

        const classItem = actor.items?.find(i => i.type === "classe") || null;
        const scFromClass = classItem?.system?.spellcasting ?? null;
        if (!scFromClass || typeof scFromClass !== "object") continue;
        if (!Array.isArray(scFromClass.lists) || scFromClass.lists.length === 0) continue;

        await actor.update({ "system.spellcasting": foundry.utils.duplicate(scFromClass) });
      }
    } catch (_e) {}
  })();
});

Hooks.once("ready", () => {
  window.setTimeout(() => {
    if (!game.user?.isGM) return;
    for (const actor of game.actors?.contents ?? []) {
      add2eSyncMulticlassHp(actor, { force: false, syncCurrent: false, reason: "ready-multiclass-hp-clamp" });
    }
  }, 750);
});

try { globalThis.consommerSortMemorise = consommerSortMemorise; } catch (_e) {}
try { globalThis.majImageToken = majImageToken; } catch (_e) {}
try { globalThis.plageToRollFormula = plageToRollFormula; } catch (_e) {}
try { globalThis.rollHitDice = rollHitDice; } catch (_e) {}
try { globalThis.add2eSyncMulticlassHp = add2eSyncMulticlassHp; } catch (_e) {}
