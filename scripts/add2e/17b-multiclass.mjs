// ADD2E — Multiclassage canonique — point d'entrée
// Les Items classe sont la seule source de niveau et d'XP.

import {
  MULTICLASS_VERSION,
  classItems,
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

globalThis.ADD2E_MULTICLASS_VERSION = MULTICLASS_VERSION;

function installGetDataPatch() {
  const proto = globalThis.Add2eActorSheet?.prototype;
  if (!proto?.getData || proto.__add2eMulticlassGetDataPatch === MULTICLASS_VERSION) return !!proto?.getData;
  const original = proto.getData;
  proto.getData = async function add2eItemProgressionMulticlassGetData(...args) {
    const data = await original.apply(this, args);
    if (this.actor?.type !== "personnage" || !multiclassEnabled(this.actor)) return data;
    const payload = multiclassUpdatePayload(this.actor);
    return payload ? applyPayloadToSheetData(data, payload) : data;
  };
  proto.__add2eMulticlassGetDataPatch = MULTICLASS_VERSION;
  return true;
}

async function migrateAndRecalculate(actor) {
  if (!actor || actor.type !== "personnage" || classItems(actor).length <= 1) return null;
  const migration = await migrateLegacyMulticlassActor(actor);
  if (migration?.ok === false) return null;
  return recalcActor(actor);
}

installGetDataPatch();

Hooks.once("ready", () => {
  installGetDataPatch();
  installDropWrapperDeferred();

  if (!game.user?.isGM) return;
  for (const actor of game.actors?.filter(entry => entry.type === "personnage" && classItems(entry).length > 1) ?? []) {
    migrateAndRecalculate(actor).catch(error => warn("[READY_MIGRATION_ERROR]", { actor: actor.name, error }));
  }
});

Hooks.on("renderActorSheet", bindDirectMulticlassFields);
Hooks.on("renderAdd2eActorSheet", bindDirectMulticlassFields);

Hooks.on("preUpdateActor", (actor, changes, options = {}) => {
  if (options?.add2eMulticlassInternal || options?.add2eInternal) return true;
  mergeMulticlassChanges(actor, changes);
  return true;
});

Hooks.on("createItem", item => {
  const actor = item?.parent;
  if (actor?.documentName !== "Actor" || actor.type !== "personnage") return;
  if (String(item.type ?? "").toLowerCase() !== "classe" || classItems(actor).length <= 1) return;
  setTimeout(() => migrateAndRecalculate(actor).catch(error => warn("[CREATE_CLASS_MIGRATION_ERROR]", error)), 0);
});

Hooks.on("deleteItem", item => {
  const actor = item?.parent;
  if (actor?.documentName !== "Actor" || actor.type !== "personnage") return;
  if (String(item.type ?? "").toLowerCase() !== "classe") return;
  setTimeout(() => {
    const remaining = classItems(actor);
    if (remaining.length > 1) {
      migrateAndRecalculate(actor).catch(error => warn("[DELETE_CLASS_RECALC_ERROR]", error));
    } else if (remaining.length === 1) {
      cleanupAfterMonoclassReplace(actor, remaining[0], null, actor.sheet).catch(error => warn("[DELETE_CLASS_MONO_ERROR]", error));
    }
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

console.log("[ADD2E][MULTICLASSE][ITEM_PROGRESSION_READY]", MULTICLASS_VERSION);