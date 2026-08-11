// ADD2E — Multiclassage canonique — point d'entrée
// Les Items classe sont la seule source de niveau et d'XP.
// Compatible Foundry V13/V14/V15 : aucune projection d'Actor ni remplacement de moteur.

import {
  MULTICLASS_VERSION,
  classItems,
  classProgression,
  multiclassEnabled,
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
  cleanupAfterMonoclassReplace,
  recalcActor,
  refreshMonoclassSummary,
  replaceClassInMulticlass
} from "./17b-multiclass-operations.mjs";
import {
  mergeMulticlassChanges,
  updateDirectMulticlassField
} from "./17b-multiclass-direct-fields.mjs";
import { compatibleMulticlassClassCandidates } from "./17b-multiclass-drop.mjs";

const multiCombatTimers = new Map();
globalThis.ADD2E_MULTICLASS_VERSION = MULTICLASS_VERSION;

function classRow(item) {
  const progression = classProgression(item);
  if (!progression.hasLevel) return null;
  const rows = Array.isArray(item.system?.progression) ? item.system.progression : [];
  return rows.find(row => Number(row?.niveau ?? row?.level) === progression.level)
    ?? rows[Math.max(0, progression.level - 1)]
    ?? null;
}

function isFeatureActivable(feature) {
  if (!feature || typeof feature !== "object") return false;
  if (feature.activable === true) return true;
  if (feature.active === true && feature.passive !== true) return true;
  if (feature.usageType === "classFeature" && String(feature?.on_use ?? feature?.onUse ?? "").trim()) return true;
  return String(feature?._add2eFeatureSource ?? "") === "activeClassFeatures";
}

function installClassFeatureGlobals() {
  globalThis.add2eIsFeatureActivable = isFeatureActivable;
}

function requireActorClassProgression(actor) {
  const docs = classItems(actor);
  for (const classDoc of docs) {
    const progression = classProgression(classDoc);
    if (!progression.hasLevel || !progression.hasXp) {
      throw new Error(`Item de classe « ${classDoc?.name ?? classDoc?.id ?? "inconnu"} » sans system.niveau/system.xp canonique.`);
    }
  }
  return docs;
}

async function syncMulticlassCombatSummary(actor, { reason = "multiclass-combat-summary" } = {}) {
  if (!multiclassEnabled(actor)) return false;
  const rows = requireActorClassProgression(actor).map(item => ({ item, row: classRow(item) })).filter(entry => entry.row);
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

async function recalculateFromClassItems(actor) {
  if (!actor || actor.type !== "personnage") return null;
  const docs = classItems(actor);
  if (docs.length === 1) {
    requireActorClassProgression(actor);
    return refreshMonoclassSummary(actor, "monoclass-item-progression-summary");
  }
  if (docs.length <= 1) return null;
  requireActorClassProgression(actor);
  const result = await recalcActor(actor);
  await syncMulticlassCombatSummary(actor, { reason: "multiclass-item-progression-summary" });
  return result;
}

installClassFeatureGlobals();

Hooks.once("ready", () => {
  installClassFeatureGlobals();
  if (!game.user?.isGM) return;
  for (const actor of game.actors?.filter(entry => entry.type === "personnage" && classItems(entry).length) ?? []) {
    recalculateFromClassItems(actor).catch(error => warn("[READY_CLASS_PROGRESSION_ERROR]", { actor: actor.name, error }));
  }
});

Hooks.on("preUpdateActor", (actor, changes, options = {}) => {
  if (options?.add2eMulticlassInternal || options?.add2eInternal) return true;
  mergeMulticlassChanges(actor, changes);
  const classes = classItems(actor);
  if (!classes.length) return true;

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
    ui.notifications?.warn?.("Modifie l’XP ou le niveau directement sur la ligne de la classe concernée.");
  }
  return true;
});

Hooks.on("createItem", item => {
  const actor = item?.parent;
  if (actor?.documentName !== "Actor" || actor.type !== "personnage") return;
  if (String(item.type ?? "").toLowerCase() !== "classe") return;
  setTimeout(() => recalculateFromClassItems(actor).catch(error => warn("[CREATE_CLASS_PROGRESSION_ERROR]", error)), 0);
});

Hooks.on("updateItem", (item, _changes, options = {}) => {
  const actor = item?.parent;
  if (actor?.type !== "personnage" || String(item?.type ?? "").toLowerCase() !== "classe") return;
  if (options?.add2eMulticlassInternal || options?.add2eInternal) return;
  const count = classItems(actor).length;
  if (count === 1) {
    refreshMonoclassSummary(actor, "monoclass-class-item-update")
      .catch(error => warn("[MONO_CLASS_ITEM_SUMMARY_ERROR]", { actor: actor.name, error }));
    return;
  }
  if (count > 1) {
    recalcActor(actor).catch(error => warn("[MULTICLASS_ITEM_SUMMARY_ERROR]", { actor: actor.name, error }));
    queueMulticlassCombatSummary(actor, "class-item-update-summary");
  }
});

Hooks.on("deleteItem", item => {
  const actor = item?.parent;
  if (actor?.documentName !== "Actor" || actor.type !== "personnage" || String(item.type ?? "").toLowerCase() !== "classe") return;
  setTimeout(() => {
    const remaining = classItems(actor);
    if (remaining.length > 1) recalculateFromClassItems(actor).catch(error => warn("[DELETE_CLASS_RECALC_ERROR]", error));
    else if (remaining.length === 1) cleanupAfterMonoclassReplace(actor, remaining[0], null, actor.sheet)
      .catch(error => warn("[DELETE_CLASS_MONO_ERROR]", error));
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
globalThis.add2eSyncMulticlassCombatSummary = syncMulticlassCombatSummary;

console.log("[ADD2E][MULTICLASSE][ITEM_PROGRESSION_READY]", MULTICLASS_VERSION);
