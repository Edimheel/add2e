// ADD2E — Multiclassage canonique — point d'entrée
// Les Items classe sont la seule source de niveau et d'XP.

import {
  MULTICLASS_VERSION,
  classItems,
  classProgression,
  classProgressionUpdate,
  classSlug,
  multiclassEnabled,
  num,
  warn
} from "./17b-multiclass-core.mjs";
import {
  allowedCombosFromRace,
  classRaceMaxLevel,
  levelForClassXp,
  minXpForClassLevel,
  multiclassUpdatePayload,
  raceAllowsClassSet,
  raceCandidatesForClass
} from "./17b-multiclass-rules.mjs";
import {
  applyPayloadToSheetData,
  cleanupAfterMonoclassReplace,
  migrateLegacyMulticlassActor,
  recalcActor,
  replaceClassInMulticlass
} from "./17b-multiclass-operations.mjs";
import {
  bindDirectMulticlassFields,
  mergeMulticlassChanges,
  updateDirectMulticlassField
} from "./17b-multiclass-direct-fields.mjs";
import { compatibleMulticlassClassCandidates, installDropWrapperDeferred } from "./17b-multiclass-drop.mjs";

const multiCombatTimers = new Map();
globalThis.ADD2E_MULTICLASS_VERSION = MULTICLASS_VERSION;

function installGetDataPatch() {
  const proto = globalThis.Add2eActorSheet?.prototype;
  if (!proto?.getData || proto.__add2eMulticlassGetDataPatch === MULTICLASS_VERSION) return !!proto?.getData;
  const original = proto.getData;
  proto.getData = async function add2eItemProgressionMulticlassGetData(...args) {
    const data = await original.apply(this, args);
    if (this.actor?.type !== "personnage" || !multiclassEnabled(this.actor)) return data;
    const payload = multiclassUpdatePayload(this.actor);
    const output = payload ? applyPayloadToSheetData(data, payload) : data;
    if (output?.combatDefense) {
      output.combatDefense.thaco = output.actor?.system?.thaco ?? output.combatDefense.thaco;
      output.combatDefense.ac_naturelle = output.actor?.system?.ca_naturel ?? output.combatDefense.ac_naturelle;
      output.combatDefense.ac_totale = output.actor?.system?.ca_total ?? output.combatDefense.ac_totale;
    }
    return output;
  };
  proto.__add2eMulticlassGetDataPatch = MULTICLASS_VERSION;
  return true;
}

async function ensureMonoclassItemProgression(actor, { fromActorSummary = false, reason = "monoclass-item-progression" } = {}) {
  if (!actor || actor.type !== "personnage") return false;
  const classes = classItems(actor);
  if (classes.length !== 1) return false;
  const classDoc = classes[0];
  const current = classProgression(classDoc);
  const actorLevel = Math.max(1, Math.floor(num(actor.system?.niveau, 1)));
  const actorXp = Math.max(0, Math.floor(num(actor.system?.xp, 0)));
  const level = fromActorSummary || !current.hasLevel ? actorLevel : current.level;
  const xp = fromActorSummary || !current.hasXp ? actorXp : current.xp;
  if (current.hasLevel && current.level === level && current.hasXp && current.xp === xp) return true;
  const update = classProgressionUpdate(classDoc, { level, xp });
  if (!update) return false;
  await actor.updateEmbeddedDocuments("Item", [update], {
    add2eInternal: true,
    add2eMulticlassInternal: true,
    add2eReason: reason
  });
  return true;
}

function classRow(item) {
  const progression = classProgression(item);
  if (!progression.hasLevel) return null;
  const rows = Array.isArray(item.system?.progression) ? item.system.progression : [];
  return rows.find(row => Number(row?.niveau ?? row?.level) === progression.level)
    ?? rows[Math.max(0, progression.level - 1)]
    ?? null;
}

async function syncMulticlassCombatSummary(actor, { reason = "multiclass-combat-summary" } = {}) {
  if (!multiclassEnabled(actor)) return false;
  const rows = classItems(actor).map(item => ({ item, row: classRow(item) })).filter(entry => entry.row);
  if (!rows.length) return false;
  const thacos = rows.map(entry => Number(entry.row?.thac0 ?? entry.row?.thaco)).filter(Number.isFinite);
  const saves = rows.map(entry => entry.row?.savingThrows ?? entry.row?.sauvegardes ?? entry.row?.saves).filter(Array.isArray);
  const updates = {};
  if (thacos.length) updates["system.thaco"] = Math.min(...thacos);
  if (saves.length) {
    const length = Math.max(...saves.map(row => row.length));
    updates["system.sauvegardes"] = Array.from({ length }, (_value, index) => {
      const values = saves.map(row => Number(row[index])).filter(Number.isFinite);
      return values.length ? Math.min(...values) : "";
    });
  }
  if (!Object.keys(updates).length) return false;
  await actor.update(updates, {
    add2eInternal: true,
    add2eMulticlassInternal: true,
    add2eReason: reason,
    render: false
  });
  return true;
}

function queueMulticlassCombatSummary(actor, reason) {
  if (!multiclassEnabled(actor)) return;
  const key = String(actor.uuid ?? actor.id);
  clearTimeout(multiCombatTimers.get(key));
  multiCombatTimers.set(key, setTimeout(() => {
    multiCombatTimers.delete(key);
    syncMulticlassCombatSummary(actor, { reason }).catch(error => warn("[COMBAT_SUMMARY_ERROR]", { actor: actor.name, error }));
  }, 0));
}

function removePath(changes, dottedPath) {
  if (!changes || !dottedPath) return;
  delete changes[dottedPath];
  const [root, child] = dottedPath.split(".");
  if (root && child && changes[root] && typeof changes[root] === "object") delete changes[root][child];
}

function readPath(changes, dottedPath) {
  if (Object.prototype.hasOwnProperty.call(changes ?? {}, dottedPath)) return changes[dottedPath];
  return foundry.utils.getProperty(changes ?? {}, dottedPath);
}

function thiefClassItem(actor) {
  return classItems(actor).find(item => {
    const slug = classSlug(item);
    const tags = Array.isArray(item.system?.tags) ? item.system.tags.map(value => String(value).toLowerCase()) : [];
    return slug === "voleur" || tags.includes("classe:voleur");
  }) ?? null;
}

/**
 * Adaptateur de transition pour les deux helpers historiques encore présents
 * dans 06-class-effects-thief.mjs. La projection se limite à l'Item Voleur
 * exact et ne lit aucun champ de progression historique de l'acteur.
 */
function thiefContext(actor, thief = thiefClassItem(actor)) {
  if (!actor || !thief) return null;
  const progression = classProgression(thief);
  if (!progression.hasLevel) return null;
  const system = {
    ...(actor.system ?? {}),
    classe: thief.name,
    details_classe: foundry.utils.deepClone(thief.system ?? {}),
    niveau: progression.level,
    xp: progression.hasXp ? progression.xp : 0
  };
  const items = [
    thief,
    ...classItems(actor).filter(item => item.id !== thief.id),
    ...Array.from(actor.items ?? []).filter(item => String(item?.type ?? "").toLowerCase() !== "classe")
  ];
  return new Proxy(actor, {
    get(target, property) {
      if (property === "system") return system;
      if (property === "items") return items;
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    }
  });
}

function installThiefItemProjection() {
  if (globalThis.__ADD2E_THIEF_ITEM_PROJECTION__ === MULTICLASS_VERSION) return;
  for (const name of ["add2eGetActorThiefSkills", "add2eGetActorThiefSkillTable", "add2eGetActorThiefProgression"]) {
    const original = globalThis[name];
    if (typeof original !== "function" || original.__add2eThiefItemProjection) continue;
    const projected = function add2eThiefItemProjectedFunction(actor, ...args) {
      const thief = thiefClassItem(actor);
      if (!thief) return original.call(this, actor, ...args);
      const context = thiefContext(actor, thief);
      return context ? original.call(this, context, ...args) : [];
    };
    projected.__add2eThiefItemProjection = true;
    globalThis[name] = projected;
  }

  const originalRoll = globalThis.add2eRollThiefSkill;
  if (typeof originalRoll === "function" && !originalRoll.__add2eThiefItemProjection) {
    const projectedRoll = async function add2eThiefItemProjectedRoll(actor, ...args) {
      const thief = thiefClassItem(actor);
      if (!thief) return originalRoll.call(this, actor, ...args);
      const context = thiefContext(actor, thief);
      if (!context) {
        ui.notifications?.warn?.("La progression de la classe Voleur est absente de son Item classe.");
        return false;
      }
      return originalRoll.call(this, context, ...args);
    };
    projectedRoll.__add2eThiefItemProjection = true;
    globalThis.add2eRollThiefSkill = projectedRoll;
  }

  const originalLevel = globalThis.add2eThiefClassLevel;
  globalThis.add2eThiefClassLevel = function add2eThiefItemLevel(actor, thiefSystem = null) {
    const requestedId = String(thiefSystem?.__classItemId ?? "");
    const thief = requestedId ? classItems(actor).find(item => String(item.id) === requestedId) : thiefClassItem(actor);
    const progression = thief ? classProgression(thief) : null;
    if (progression?.hasLevel) return progression.level;
    return typeof originalLevel === "function" && !thief ? originalLevel.call(this, actor, thiefSystem) : null;
  };
  globalThis.add2eThiefClassLevel.__add2eThiefItemProjection = true;
  globalThis.__ADD2E_THIEF_ITEM_PROJECTION__ = MULTICLASS_VERSION;
}

function installEffectsEngineItemProgressionPatch() {
  const Engine = globalThis.Add2eEffectsEngine;
  if (!Engine?.getActiveTags || Engine.__add2eItemClassTags === MULTICLASS_VERSION) return;
  const original = Engine.getActiveTags.bind(Engine);
  Engine.getActiveTags = function add2eItemClassTags(actor) {
    if (!multiclassEnabled(actor)) return original(actor);
    const blankClasses = classItems(actor).map(item => ({
      ...item,
      system: {
        ...(item.system ?? {}),
        classFeatures: [], classFeaturesDebloquees: [], activeClassFeatures: [], activableClassFeatures: [],
        passiveClassFeatures: [], passiveFeatures: [], capacitesClasse: [], capacitesActives: [], capacitesActivables: [],
        monkProgression: []
      }
    }));
    const safeSystem = { ...(actor.system ?? {}), classFeatures: [], details_classe: {} };
    const safeItems = [...blankClasses, ...Array.from(actor.items ?? []).filter(item => String(item?.type ?? "").toLowerCase() !== "classe")];
    const proxy = new Proxy(actor, {
      get(target, property) {
        if (property === "system") return safeSystem;
        if (property === "items") return safeItems;
        const value = Reflect.get(target, property, target);
        return typeof value === "function" ? value.bind(target) : value;
      }
    });
    const tags = new Set(original(proxy) ?? []);
    const addFeatureTags = Engine.addClassFeatureTagsInto?.bind(Engine);
    const addTags = Engine.addTagsInto?.bind(Engine);
    for (const item of classItems(actor)) {
      const progression = classProgression(item);
      if (!progression.hasLevel) continue;
      for (const field of ["classFeatures", "classFeaturesDebloquees", "activeClassFeatures", "activableClassFeatures", "passiveClassFeatures", "passiveFeatures", "capacitesClasse", "capacitesActives", "capacitesActivables"]) {
        addFeatureTags?.(tags, item.system?.[field], progression.level);
      }
      const rows = Array.isArray(item.system?.monkProgression) && item.system.monkProgression.length ? item.system.monkProgression : item.system?.progression;
      const row = Array.isArray(rows)
        ? (rows.find(entry => Number(entry?.niveau ?? entry?.level) === progression.level) ?? rows[Math.max(0, progression.level - 1)])
        : null;
      addTags?.(tags, row?.tags);
    }
    return [...new Set([...tags].filter(Boolean))];
  };
  Engine.__add2eItemClassTags = MULTICLASS_VERSION;
}

async function migrateAndRecalculate(actor) {
  if (!actor || actor.type !== "personnage") return null;
  if (classItems(actor).length === 1) return ensureMonoclassItemProgression(actor, { reason: "monoclass-item-progression-migration" });
  if (classItems(actor).length <= 1) return null;
  const migration = await migrateLegacyMulticlassActor(actor);
  if (migration?.ok === false) return null;
  const result = await recalcActor(actor);
  await syncMulticlassCombatSummary(actor, { reason: "multiclass-migration-summary" });
  return result;
}

installGetDataPatch();

Hooks.once("ready", () => {
  installGetDataPatch();
  installDropWrapperDeferred();
  setTimeout(() => {
    installThiefItemProjection();
    installEffectsEngineItemProgressionPatch();
  }, 0);
  if (!game.user?.isGM) return;
  for (const actor of game.actors?.filter(entry => entry.type === "personnage" && classItems(entry).length) ?? []) {
    migrateAndRecalculate(actor).catch(error => warn("[READY_MIGRATION_ERROR]", { actor: actor.name, error }));
  }
});

Hooks.on("renderActorSheet", bindDirectMulticlassFields);
Hooks.on("renderAdd2eActorSheet", bindDirectMulticlassFields);

Hooks.on("preUpdateActor", (actor, changes, options = {}) => {
  if (options?.add2eMulticlassInternal || options?.add2eInternal) return true;
  mergeMulticlassChanges(actor, changes);
  if (!multiclassEnabled(actor)) return true;

  const requestedXp = readPath(changes, "system.xp");
  const requestedLevel = readPath(changes, "system.niveau");
  for (const path of [
    "system.xp_par_classe",
    "system.niveaux_par_classe",
    "system.titres_par_classe",
    "system.xp_next_par_classe",
    "system.niveau_max_par_classe",
    "system.multiclasse.classes"
  ]) removePath(changes, path);

  if (requestedXp !== undefined || requestedLevel !== undefined) {
    for (const path of [
      "system.xp",
      "system.niveau",
      "system.niveau_suggere",
      "system.titre",
      "system.progression_xp",
      "system.xp_next",
      "system.xp_to_next",
      "system.xp_percent"
    ]) removePath(changes, path);
    ui.notifications?.warn?.("Pour un multiclassé, modifie l’XP ou le niveau directement sur la ligne de la classe concernée.");
  }
  return true;
});

Hooks.on("updateActor", (actor, changes, options = {}) => {
  if (options?.add2eMulticlassInternal || options?.add2eInternal || actor?.type !== "personnage") return;
  if (classItems(actor).length !== 1) return;
  const flat = foundry.utils.flattenObject(changes ?? {});
  if (!(Object.prototype.hasOwnProperty.call(flat, "system.niveau") || Object.prototype.hasOwnProperty.call(flat, "system.xp"))) return;
  ensureMonoclassItemProgression(actor, { fromActorSummary: true, reason: "monoclass-actor-summary-sync" })
    .catch(error => warn("[MONO_SYNC_ERROR]", { actor: actor.name, error }));
});

Hooks.on("createItem", item => {
  const actor = item?.parent;
  if (actor?.documentName !== "Actor" || actor.type !== "personnage") return;
  if (String(item.type ?? "").toLowerCase() !== "classe") return;
  setTimeout(() => migrateAndRecalculate(actor).catch(error => warn("[CREATE_CLASS_MIGRATION_ERROR]", error)), 0);
});

Hooks.on("updateItem", (item, _changes, options = {}) => {
  const actor = item?.parent;
  if (options?.add2eInternal || actor?.type !== "personnage" || String(item?.type ?? "").toLowerCase() !== "classe") return;
  queueMulticlassCombatSummary(actor, "class-item-update-summary");
});

Hooks.on("deleteItem", item => {
  const actor = item?.parent;
  if (actor?.documentName !== "Actor" || actor.type !== "personnage" || String(item.type ?? "").toLowerCase() !== "classe") return;
  setTimeout(() => {
    const remaining = classItems(actor);
    if (remaining.length > 1) migrateAndRecalculate(actor).catch(error => warn("[DELETE_CLASS_RECALC_ERROR]", error));
    else if (remaining.length === 1) cleanupAfterMonoclassReplace(actor, remaining[0], null, actor.sheet).catch(error => warn("[DELETE_CLASS_MONO_ERROR]", error));
  }, 0);
});

globalThis.add2eMulticlassEnabled = multiclassEnabled;
globalThis.add2eMulticlassAllowedCombosFromRace = allowedCombosFromRace;
globalThis.add2eRaceAllowsClassSet = raceAllowsClassSet;
globalThis.add2eRecalcMulticlassActor = recalcActor;
globalThis.add2eMulticlassUpdatePayload = multiclassUpdatePayload;
globalThis.add2eCompatibleMulticlassClassCandidates = compatibleMulticlassClassCandidates;
globalThis.add2eMulticlassMinXpForClassLevel = minXpForClassLevel;
globalThis.add2eMulticlassLevelForClassXp = levelForClassXp;
globalThis.add2eMulticlassRaceCandidatesForClass = raceCandidatesForClass;
globalThis.add2eMulticlassClassRaceMaxLevel = classRaceMaxLevel;
globalThis.add2eMulticlassDirectFieldSync = updateDirectMulticlassField;
globalThis.add2eCleanMonoclassAfterReplace = cleanupAfterMonoclassReplace;
globalThis.add2eReplaceClassInMulticlass = replaceClassInMulticlass;
globalThis.add2eMigrateLegacyMulticlassActor = migrateLegacyMulticlassActor;
globalThis.add2eEnsureMonoclassItemProgression = ensureMonoclassItemProgression;
globalThis.add2eSyncMulticlassCombatSummary = syncMulticlassCombatSummary;

console.log("[ADD2E][MULTICLASSE][ITEM_PROGRESSION_READY]", MULTICLASS_VERSION);