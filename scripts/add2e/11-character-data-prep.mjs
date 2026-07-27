// =======================
//  HOOK UNIQUE updateActor
// =======================

const ADD2E_CHARACTER_DATA_PREP_VERSION = "2026-07-27-canonical-hit-points-consumers-v2";
globalThis.ADD2E_CHARACTER_DATA_PREP_VERSION = ADD2E_CHARACTER_DATA_PREP_VERSION;

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

function add2eModifierList(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") return Object.values(raw);
  return [];
}

function add2eModifierListHasDomain(raw, domain) {
  const expected = String(domain ?? "").trim().toLowerCase();
  return add2eModifierList(raw).some(modifier => String(modifier?.domain ?? "").trim().toLowerCase() === expected);
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

function add2eActorUpdateChangesCharacteristic(changes = {}) {
  const system = changes?.system && typeof changes.system === "object" ? changes.system : {};
  const systemChanged = ADD2E_CARAC_CHANGE_KEYS.some(key => {
    const path = `system.${key}`;
    return Object.prototype.hasOwnProperty.call(system, key)
      || Object.prototype.hasOwnProperty.call(changes, path)
      || foundry.utils.hasProperty(changes, path);
  });
  return systemChanged || add2eChangesTouchModifiers(changes);
}

function add2eActorUpdateChangesHitPoints(changes = {}) {
  return add2eChangesTouchModifiers(changes);
}

const ADD2E_ACTOR_HP_RECALC_LOCK = new Set();

Hooks.on("updateActor", async (actor, changes = {}, options = {}, _userId) => {
  if (options?._fromSync) return;

  const changeKeys = Object.keys(changes ?? {});
  if (changeKeys.length === 1 && changeKeys[0] === "_id") return;

  const caracChanged = actor?.type === "personnage" && add2eActorUpdateChangesCharacteristic(changes);
  const hitPointModifiersChanged = add2eActorUpdateChangesHitPoints(changes);
  const caracRecalculation = ADD2E_CARAC_RECALC_REASONS.has(String(options?.add2eReason ?? ""));

  // =====================================================
  // 0) Niveau : validation et consommateurs non-PV
  // =====================================================
  if (changes?.system && Object.prototype.hasOwnProperty.call(changes.system, "niveau")) {
    const clamp = add2eClampLevelToClassMax(actor, changes.system.niveau, null, { notify: true });
    if (clamp.changed) {
      await actor.update({ "system.niveau": clamp.level }, { add2eInternal: true });
      changes.system.niveau = clamp.level;
    }

    const lvl = Number(changes.system.niveau) || Number(actor.system?.niveau) || 1;
    try {
      await add2eSyncMonkUnarmedWeapon(actor);
    } catch (_e) {}

    try {
      await add2eSyncNewSpellLevelsAfterActorLevelChange(actor, lvl);
    } catch (_e) {
      ui.notifications.error("Erreur pendant la synchronisation des sorts au changement de niveau. Voir la console.");
    }
  }

  // =====================================================
  // 1) Recalcul des caractéristiques par le résolveur unique
  // =====================================================
  let hitPointsHandledByCharacteristics = false;
  try {
    const skipCarac = (options?.add2eInternal && caracRecalculation)
      || options?.add2eHitPointModifierUpdate === true
      || options?.add2eHitPointModifierMigration === true
      || options?.add2eHitPointResolution === true;
    if (caracChanged && !skipCarac && !ACTIVE_CARAC_AUTO.has(actor.id)) {
      ACTIVE_CARAC_AUTO.add(actor.id);
      try {
        if (typeof actor.sheet?.autoSetCaracAjustements === "function") {
          await actor.sheet.autoSetCaracAjustements();
          hitPointsHandledByCharacteristics = true;
        } else if (typeof actor.autoSetCaracAjustements === "function") {
          await actor.autoSetCaracAjustements();
          hitPointsHandledByCharacteristics = true;
        }
        if (actor.sheet?.rendered) actor.sheet.render(false);
      } finally {
        ACTIVE_CARAC_AUTO.delete(actor.id);
      }
    }
  } catch (_e) {}

  // =====================================================
  // 2) Recalcul des PV uniquement après mutation de modificateurs
  // =====================================================
  try {
    const alreadyHandled = options?.add2eHitPointModifierUpdate === true
      || options?.add2eHitPointModifierMigration === true
      || options?.add2eHitPointResolution === true;
    if (hitPointModifiersChanged && !hitPointsHandledByCharacteristics && !alreadyHandled && !ADD2E_ACTOR_HP_RECALC_LOCK.has(actor.id)) {
      ADD2E_ACTOR_HP_RECALC_LOCK.add(actor.id);
      try {
        if (typeof globalThis.add2eRecalculateHitPoints === "function") {
          await globalThis.add2eRecalculateHitPoints(actor, { reason: "actor-hit-point-modifiers" });
        }
      } finally {
        ADD2E_ACTOR_HP_RECALC_LOCK.delete(actor.id);
      }
    }
  } catch (_e) {}

  // =====================================================
  // 3) Gestion auto des états INCONSCIENT / MORT (PV courants)
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
  // 4) Synchronisation des tokens liés
  //    Pour les tokens liés, Foundry synchronise déjà.
  // =====================================================
  try {
    actor.getDependentTokens?.({ linked: true });
  } catch (_e) {}
});

function add2eDocumentHasModifierDomain(document, domain) {
  if (add2eModifierListHasDomain(document?.flags?.add2e?.modifiers, domain)) return true;
  const effects = Array.from(document?.effects?.contents ?? document?.effects ?? []);
  return effects.some(effect => effect?.disabled !== true && add2eModifierListHasDomain(effect?.flags?.add2e?.modifiers, domain));
}

const ADD2E_EFFECT_MODIFIER_RECALC_LOCK = new Set();
async function add2eRecalculateAfterModifierDocument(document, changes = null) {
  const touchesModifiers = add2eChangesTouchModifiers(changes);
  const abilityChanged = add2eDocumentHasModifierDomain(document, "ability") || touchesModifiers;
  const hitPointsChanged = add2eDocumentHasModifierDomain(document, "hit-points") || touchesModifiers;
  if (!abilityChanged && !hitPointsChanged) return;

  const parent = document?.parent ?? document?.actor ?? null;
  const actor = parent?.documentName === "Actor" ? parent : parent?.actor ?? null;
  if (!actor?.system || ADD2E_EFFECT_MODIFIER_RECALC_LOCK.has(actor.id)) return;

  ADD2E_EFFECT_MODIFIER_RECALC_LOCK.add(actor.id);
  try {
    await new Promise(resolve => setTimeout(resolve, 0));
    let hitPointsHandled = false;
    if (abilityChanged && actor.type === "personnage") {
      if (typeof actor.sheet?.autoSetCaracAjustements === "function") {
        await actor.sheet.autoSetCaracAjustements();
        hitPointsHandled = true;
      } else if (typeof actor.autoSetCaracAjustements === "function") {
        await actor.autoSetCaracAjustements();
        hitPointsHandled = true;
      }
    }
    if (hitPointsChanged && !hitPointsHandled && typeof globalThis.add2eRecalculateHitPoints === "function") {
      await globalThis.add2eRecalculateHitPoints(actor, { reason: "modifier-document-hit-points" });
    }
    if (actor.sheet?.rendered) actor.sheet.render(false);
  } finally {
    ADD2E_EFFECT_MODIFIER_RECALC_LOCK.delete(actor.id);
  }
}

Hooks.on("createActiveEffect", effect => add2eRecalculateAfterModifierDocument(effect));
Hooks.on("updateActiveEffect", (effect, changes) => add2eRecalculateAfterModifierDocument(effect, changes));
Hooks.on("deleteActiveEffect", effect => add2eRecalculateAfterModifierDocument(effect));
Hooks.on("createItem", item => add2eRecalculateAfterModifierDocument(item));
Hooks.on("updateItem", (item, changes) => add2eRecalculateAfterModifierDocument(item, changes));
Hooks.on("deleteItem", item => add2eRecalculateAfterModifierDocument(item));

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

try { globalThis.consommerSortMemorise = consommerSortMemorise; } catch (_e) {}
try { globalThis.majImageToken = majImageToken; } catch (_e) {}
try { globalThis.plageToRollFormula = plageToRollFormula; } catch (_e) {}
try { globalThis.rollHitDice = rollHitDice; } catch (_e) {}
