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

// ===============================
// TABLES AJUSTEMENTS CARACTÉRISTIQUES
// ===============================
const FORCE_TABLE = {
  3:   { toucher: -3, degats: -1, poids: -350, ouvrir: "1", tordre: "0%" },
  4:   { toucher: -2, degats: -1, poids: -250, ouvrir: "1", tordre: "0%" },
  5:   { toucher: -2, degats: -1, poids: -250, ouvrir: "1", tordre: "0%" },
  6:   { toucher: -1, degats: 0,  poids: -150, ouvrir: "1", tordre: "0%" },
  7:   { toucher: -1, degats: 0,  poids: -150, ouvrir: "1", tordre: "0%" },
  8:   { toucher:  0, degats: 0,  poids: 0,    ouvrir: "1-2", tordre: "1%" },
  9:   { toucher:  0, degats: 0,  poids: 0,    ouvrir: "1-2", tordre: "1%" },
  10:  { toucher:  0, degats: 0,  poids: 0,    ouvrir: "1-2", tordre: "2%" },
  11:  { toucher:  0, degats: 0,  poids: 0,    ouvrir: "1-2", tordre: "2%" },
  12:  { toucher:  0, degats: 0,  poids: 100,  ouvrir: "1-2", tordre: "4%" },
  13:  { toucher:  0, degats: 0,  poids: 100,  ouvrir: "1-2", tordre: "4%" },
  14:  { toucher:  0, degats: 0,  poids: 200,  ouvrir: "1-2", tordre: "7%" },
  15:  { toucher:  0, degats: 0,  poids: 200,  ouvrir: "1-2", tordre: "7%" },
  16:  { toucher:  0, degats: 1,  poids: 350,  ouvrir: "1-3", tordre: "10%" },
  17:  { toucher:  1, degats: 1,  poids: 500,  ouvrir: "1-3", tordre: "13%" },
  18:  { toucher:  1, degats: 2,  poids: 750,  ouvrir: "1-3", tordre: "16%" },
  "18/01-50": { toucher: 1, degats: 3, poids: 1000, ouvrir: "1-3", tordre: "20%" },
  "18/51-75": { toucher: 2, degats: 3, poids: 1250, ouvrir: "1-4", tordre: "25%" },
  "18/76-90": { toucher: 2, degats: 4, poids: 1500, ouvrir: "1-4", tordre: "30%" },
  "18/91-99": { toucher: 2, degats: 5, poids: 2000, ouvrir: "1-4 (1)", tordre: "35%" },
  "18/00":    { toucher: 3, degats: 6, poids: 3000, ouvrir: "1-5 (2)", tordre: "40%" },
  19: { toucher: 3, degats: 7, poids: 4500, ouvrir: "50 %", tordre: "50 %" },
  20: { toucher: 3, degats: 8, poids: 5000, ouvrir: "60 %", tordre: "60 %" },
  21: { toucher: 4, degats: 9, poids: 6000, ouvrir: "70 %", tordre: "70 %" },
  22: { toucher: 4, degats: 10, poids: 7500, ouvrir: "80 %", tordre: "80 %" },
  23: { toucher: 5, degats: 11, poids: 9000, ouvrir: "90 %", tordre: "90 %" },
  24: { toucher: 6, degats: 12, poids: 12000, ouvrir: "100 %", tordre: "100 %" }
};
const INTELLIGENCE_TABLE = {3:{langues:0,chance_sort:0,min_sort:0,max_sort:0},4:{langues:0,chance_sort:0,min_sort:0,max_sort:0},5:{langues:0,chance_sort:0,min_sort:0,max_sort:0},6:{langues:0,chance_sort:0,min_sort:0,max_sort:0},7:{langues:0,chance_sort:0,min_sort:0,max_sort:0},8:{langues:1,chance_sort:0,min_sort:0,max_sort:0},9:{langues:1,chance_sort:35,min_sort:4,max_sort:6},10:{langues:2,chance_sort:45,min_sort:5,max_sort:7},11:{langues:2,chance_sort:45,min_sort:5,max_sort:7},12:{langues:3,chance_sort:45,min_sort:5,max_sort:7},13:{langues:3,chance_sort:55,min_sort:6,max_sort:9},14:{langues:4,chance_sort:55,min_sort:6,max_sort:9},15:{langues:4,chance_sort:65,min_sort:7,max_sort:11},16:{langues:5,chance_sort:65,min_sort:7,max_sort:11},17:{langues:6,chance_sort:75,min_sort:8,max_sort:14},18:{langues:7,chance_sort:85,min_sort:9,max_sort:18}};
const SAGESSE_TABLE = {3:{magie:-3,sort_suppl:0,echec:80},4:{magie:-2,sort_suppl:0,echec:75},5:{magie:-1,sort_suppl:0,echec:70},6:{magie:-1,sort_suppl:0,echec:65},7:{magie:-1,sort_suppl:0,echec:60},8:{magie:0,sort_suppl:0,echec:55},9:{magie:0,sort_suppl:0,echec:20},10:{magie:0,sort_suppl:0,echec:15},11:{magie:0,sort_suppl:0,echec:10},12:{magie:0,sort_suppl:0,echec:5},13:{magie:0,sort_suppl:1,echec:0},14:{magie:0,sort_suppl:2,echec:0},15:{magie:0,sort_suppl:2,echec:0},16:{magie:0,sort_suppl:2,echec:0},17:{magie:0,sort_suppl:3,echec:0},18:{magie:0,sort_suppl:4,echec:0}};
const DEXTERITE_TABLE = {3:{att:-3,def:+4},4:{att:-2,def:+3},5:{att:-1,def:+2},6:{att:0,def:+1},7:{att:0,def:0},8:{att:0,def:0},9:{att:0,def:0},10:{att:0,def:0},11:{att:0,def:0},12:{att:0,def:0},13:{att:0,def:0},14:{att:0,def:-1},15:{att:0,def:-1},16:{att:+1,def:-2},17:{att:+2,def:-3},18:{att:+3,def:-4}};
const CONSTITUTION_TABLE = {3:{pv:-2,trauma:35,resu:40},4:{pv:-1,trauma:40,resu:45},5:{pv:-1,trauma:45,resu:50},6:{pv:-1,trauma:50,resu:55},7:{pv:0,trauma:55,resu:60},8:{pv:0,trauma:60,resu:65},9:{pv:0,trauma:65,resu:70},10:{pv:0,trauma:70,resu:75},11:{pv:0,trauma:75,resu:80},12:{pv:0,trauma:80,resu:85},13:{pv:0,trauma:85,resu:90},14:{pv:0,trauma:88,resu:92},15:{pv:+1,trauma:91,resu:94},16:{pv:+2,trauma:95,resu:96},17:{pv:+2,trauma:97,resu:98},18:{pv:+2,trauma:99,resu:100}};
const CHARISME_TABLE = {3:{compagnons:1,loy:-30,react:-25},4:{compagnons:1,loy:-25,react:-20},5:{compagnons:2,loy:-20,react:-15},6:{compagnons:2,loy:-15,react:-10},7:{compagnons:3,loy:-10,react:-5},8:{compagnons:3,loy:-5,react:0},9:{compagnons:4,loy:0,react:0},10:{compagnons:4,loy:0,react:0},11:{compagnons:4,loy:0,react:0},12:{compagnons:5,loy:0,react:0},13:{compagnons:6,loy:+5,react:5},14:{compagnons:7,loy:+10,react:10},15:{compagnons:8,loy:+15,react:15},16:{compagnons:9,loy:+20,react:25},17:{compagnons:10,loy:+30,react:30},18:{compagnons:15,loy:+40,react:35}};

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

// Exposition globale conservée pour compatibilité avec le code legacy et les scripts onUse.
try { globalThis.FORCE_TABLE = FORCE_TABLE; } catch (_e) {}
try { globalThis.INTELLIGENCE_TABLE = INTELLIGENCE_TABLE; } catch (_e) {}
try { globalThis.SAGESSE_TABLE = SAGESSE_TABLE; } catch (_e) {}
try { globalThis.DEXTERITE_TABLE = DEXTERITE_TABLE; } catch (_e) {}
try { globalThis.CONSTITUTION_TABLE = CONSTITUTION_TABLE; } catch (_e) {}
try { globalThis.CHARISME_TABLE = CHARISME_TABLE; } catch (_e) {}
try { globalThis.consommerSortMemorise = consommerSortMemorise; } catch (_e) {}
try { globalThis.majImageToken = majImageToken; } catch (_e) {}
try { globalThis.plageToRollFormula = plageToRollFormula; } catch (_e) {}
try { globalThis.rollHitDice = rollHitDice; } catch (_e) {}
try { globalThis.add2eSyncMulticlassHp = add2eSyncMulticlassHp; } catch (_e) {}
