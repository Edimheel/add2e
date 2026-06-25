// ADD2E — Multiclassage canonique — point d'entrée
// Les Items classe sont les définitions. system.multiclasse.classes est le seul
// état de progression multiclasses ; aucune définition de classe n'est recopiée.

import {
  MULTICLASS_VERSION,
  canonicalClassLevel,
  canonicalClassState,
  canonicalMulticlass,
  classItems,
  classSlug,
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
  proto.getData = async function add2eCanonicalMulticlassGetData(...args) {
    const data = await original.apply(this, args);
    if (this.actor?.type !== "personnage" || !canonicalMulticlass(this.actor)) return data;
    const payload = multiclassUpdatePayload(this.actor);
    return payload ? applyPayloadToSheetData(data, payload) : data;
  };
  proto.__add2eMulticlassGetDataPatch = MULTICLASS_VERSION;
  return true;
}

function classContext(actor, classItem) {
  const state = canonicalClassState(actor, classItem);
  if (!state || !classItem) return null;
  const system = {
    ...(actor.system ?? {}),
    classe: classItem.name,
    details_classe: foundry.utils.deepClone(classItem.system ?? {}),
    niveau: canonicalClassLevel(actor, classItem, 1),
    xp: Number(state.xp) || 0
  };
  return new Proxy(actor, {
    get(target, property) {
      if (property === "system") return system;
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    }
  });
}

function canonicalThiefClass(actor, thiefClassSystem = null) {
  const itemId = String(thiefClassSystem?.__classItemId ?? "");
  return classItems(actor).find(item =>
    (itemId && String(item.id ?? "") === itemId)
    || classSlug(item) === "voleur"
  ) ?? null;
}

function installCanonicalThiefFunction(name, bridgeKey) {
  const original = globalThis[name];
  if (typeof original !== "function" || original.__add2eCanonicalThiefBridge) return;
  const wrapped = function add2eCanonicalThiefFunction(actor, ...args) {
    if (!canonicalMulticlass(actor)) return original.call(this, actor, ...args);
    const context = classContext(actor, canonicalThiefClass(actor));
    return context ? original.call(this, context, ...args) : [];
  };
  wrapped.__add2eCanonicalThiefBridge = true;
  wrapped.__add2eCanonicalThiefBridgeKey = bridgeKey;
  wrapped.__add2eCanonicalThiefOriginal = original;
  globalThis[name] = wrapped;
}

function installThiefCanonicalBridge() {
  if (globalThis.__ADD2E_CANONICAL_THIEF_BRIDGE__ === MULTICLASS_VERSION) return;

  installCanonicalThiefFunction("add2eGetActorThiefSkills", "skills");
  installCanonicalThiefFunction("add2eGetActorThiefSkillTable", "table");
  installCanonicalThiefFunction("add2eGetActorThiefProgression", "progression");

  const roll = globalThis.add2eRollThiefSkill;
  if (typeof roll === "function" && !roll.__add2eCanonicalThiefBridge) {
    const wrapped = async function add2eCanonicalRollThiefSkill(actor, ...args) {
      if (!canonicalMulticlass(actor)) return roll.call(this, actor, ...args);
      const context = classContext(actor, canonicalThiefClass(actor));
      if (!context) {
        ui.notifications?.warn?.("Cette fiche ne possède pas de classe Voleur.");
        return false;
      }
      return roll.call(this, context, ...args);
    };
    wrapped.__add2eCanonicalThiefBridge = true;
    wrapped.__add2eCanonicalThiefOriginal = roll;
    globalThis.add2eRollThiefSkill = wrapped;
  }

  const level = globalThis.add2eThiefClassLevel;
  if (typeof level === "function" && !level.__add2eCanonicalThiefBridge) {
    const wrapped = function add2eCanonicalThiefClassLevel(actor, thiefClassSystem, fallback = 1) {
      if (!canonicalMulticlass(actor)) return level.call(this, actor, thiefClassSystem, fallback);
      const thief = canonicalThiefClass(actor, thiefClassSystem);
      return thief ? canonicalClassLevel(actor, thief, fallback) : Math.max(1, Number(fallback) || 1);
    };
    wrapped.__add2eCanonicalThiefBridge = true;
    wrapped.__add2eCanonicalThiefOriginal = level;
    globalThis.add2eThiefClassLevel = wrapped;
  }

  globalThis.__ADD2E_CANONICAL_THIEF_BRIDGE__ = MULTICLASS_VERSION;
}

async function migrateAndRecalculate(actor) {
  if (!actor || actor.type !== "personnage" || classItems(actor).length <= 1) return null;
  await migrateLegacyMulticlassActor(actor);
  return recalcActor(actor);
}

installGetDataPatch();

Hooks.once("ready", () => {
  installGetDataPatch();
  installDropWrapperDeferred();
  setTimeout(installThiefCanonicalBridge, 0);

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
    if (classItems(actor).length > 1) {
      migrateAndRecalculate(actor).catch(error => warn("[DELETE_CLASS_RECALC_ERROR]", error));
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

console.log("[ADD2E][MULTICLASSE][CANONICAL_READY]", MULTICLASS_VERSION);
