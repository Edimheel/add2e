// ADD2E — Multiclassage canonique — point d'entrée
// Les Items classe sont la seule source de niveau et d'XP.

import {
  MULTICLASS_VERSION,
  classItems,
  classProgression,
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
  proto.getData = async function add2eItemProgressionMulticlassGetData(...args) {
    const data = await original.apply(this, args);
    if (this.actor?.type !== "personnage" || !multiclassEnabled(this.actor)) return data;
    const payload = multiclassUpdatePayload(this.actor);
    return payload ? applyPayloadToSheetData(data, payload) : data;
  };
  proto.__add2eMulticlassGetDataPatch = MULTICLASS_VERSION;
  return true;
}

function thiefClassItem(actor) {
  return classItems(actor).find(item => {
    const slug = classSlug(item);
    const tags = Array.isArray(item.system?.tags) ? item.system.tags.map(value => String(value).toLowerCase()) : [];
    return slug === "voleur" || tags.includes("classe:voleur");
  }) ?? null;
}

/**
 * Projection strictement limitée à l'Item Voleur choisi. Elle ne lit jamais
 * la première classe de l'acteur ; elle garde les helpers historiques pendant
 * leur retrait progressif des feuilles et du HUD.
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
  const items = [thief, ...classItems(actor).filter(item => item.id !== thief.id), ...Array.from(actor.items ?? []).filter(item => String(item?.type ?? "").toLowerCase() !== "classe")];
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
  const names = ["add2eGetActorThiefSkills", "add2eGetActorThiefSkillTable", "add2eGetActorThiefProgression"];
  for (const name of names) {
    const original = globalThis[name];
    if (typeof original !== "function" || original.__add2eThiefItemProjection) continue;
    const projected = function add2eThiefItemProjectedFunction(actor, ...args) {
      const thief = thiefClassItem(actor);
      if (!thief) return original.call(this, actor, ...args);
      const context = thiefContext(actor, thief);
      return context ? original.call(this, context, ...args) : [];
    };
    projected.__add2eThiefItemProjection = true;
    projected.__add2eThiefItemProjectionOriginal = original;
    globalThis[name] = projected;
  }

  const originalRoll = globalThis.add2eRollThiefSkill;
  if (typeof originalRoll === "function" && !originalRoll.__add2eThiefItemProjection) {
    const projectedRoll = async function add2eThiefItemProjectedRoll(actor, ...args) {
      const thief = thiefClassItem(actor);
      if (!thief) return originalRoll.call(this, actor, ...args);
      const context = thiefContext(actor, thief);
      if (!context) {
        ui.notifications?.warn?.("La progression de la classe Voleur doit être migrée avant ce jet.");
        return false;
      }
      return originalRoll.call(this, context, ...args);
    };
    projectedRoll.__add2eThiefItemProjection = true;
    projectedRoll.__add2eThiefItemProjectionOriginal = originalRoll;
    globalThis.add2eRollThiefSkill = projectedRoll;
  }

  const originalLevel = globalThis.add2eThiefClassLevel;
  globalThis.add2eThiefClassLevel = function add2eThiefItemLevel(actor, thiefSystem = null, fallback = 1) {
    const requestedId = String(thiefSystem?.__classItemId ?? "");
    const thief = requestedId
      ? classItems(actor).find(item => String(item.id) === requestedId)
      : thiefClassItem(actor);
    const progression = thief ? classProgression(thief) : null;
    if (progression?.hasLevel) return progression.level;
    return typeof originalLevel === "function" && !thief
      ? originalLevel.call(this, actor, thiefSystem, fallback)
      : Math.max(1, Number(fallback) || 1);
  };
  globalThis.add2eThiefClassLevel.__add2eThiefItemProjection = true;
  globalThis.__ADD2E_THIEF_ITEM_PROJECTION__ = MULTICLASS_VERSION;
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
  setTimeout(installThiefItemProjection, 0);

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