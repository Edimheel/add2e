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

function classRow(item) {
  const progression = classProgression(item);
  if (!progression.hasLevel) return null;
  const rows = Array.isArray(item.system?.progression) ? item.system.progression : [];
  return rows.find(row => Number(row?.niveau ?? row?.level) === progression.level)
    ?? rows[Math.max(0, progression.level - 1)]
    ?? null;
}

function featureMinLevel(feature) {
  return Number(feature?.minLevel ?? feature?.minimumLevel ?? feature?.niveauMin ?? feature?.level ?? feature?.niveau ?? 1) || 1;
}

function featureMaxLevel(feature) {
  const value = feature?.maxLevel ?? feature?.maximumLevel ?? feature?.niveauMax ?? feature?.max;
  return value === undefined || value === null || value === "" ? 999 : Number(value) || 999;
}

function featureName(feature) {
  return String(feature?.name ?? feature?.label ?? feature?.title ?? feature?.nom ?? "").trim();
}

function featureKey(value) {
  const raw = typeof value === "object"
    ? value?.id ?? value?._id ?? value?.key ?? value?.slug ?? value?.skillKey ?? value?.name ?? value?.label ?? value?.title ?? value?.nom ?? ""
    : value;
  if (typeof globalThis.add2eNormalizeEquipTag === "function") return globalThis.add2eNormalizeEquipTag(raw);
  return String(raw ?? "").trim().toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, "").replace(/[_\s-]+/g, "_");
}

function isFeatureActivable(feature) {
  if (!feature || typeof feature !== "object") return false;
  if (feature.activable === true) return true;
  if (feature.active === true && feature.passive !== true) return true;
  if (feature.usageType === "classFeature" && String(feature?.on_use ?? feature?.onUse ?? "").trim()) return true;
  return String(feature?._add2eFeatureSource ?? "") === "activeClassFeatures";
}

function isThiefClassFeature(feature) {
  const values = [
    feature?._add2eClassSlug,
    feature?._add2eClassName,
    feature?.sourceClassSlug,
    feature?.sourceClassName,
    feature?.classSlug,
    feature?.className,
    feature?.classe,
    feature?.class
  ].map(featureKey).filter(Boolean);
  return values.some(value => value === "voleur" || value.startsWith("voleur_") || value.endsWith("_voleur") || value.includes("voleur"));
}

function isThiefSkillFeature(feature) {
  const text = `${featureKey(featureName(feature))} ${featureKey(feature?.skillKey ?? feature?.key ?? feature?.slug ?? "")}`;
  return [
    "faculte_de_voleur", "facultes_de_voleur", "competence_de_voleur", "competences_de_voleur",
    "pickpocket", "faire_les_poches", "crochetage", "serrure", "piege", "desamorc",
    "deplacement_silencieux", "silence", "dissimulation", "cacher", "ecoute", "auditiv",
    "ouie", "entendre", "bruit", "escalade", "grimper", "lecture_langues",
    "lecture_des_langues", "frappe_dans_le_dos", "attaque_dans_le_dos", "backstab",
    "attaque_sournoise", "assassination", "assassinat"
  ].some(token => text.includes(token));
}

function installClassFeatureGlobals() {
  globalThis.add2eIsFeatureActivable = isFeatureActivable;
  globalThis.add2eIsThiefClassFeature = isThiefClassFeature;
  globalThis.add2eIsThiefSkillFeature = isThiefSkillFeature;
}

function classFeatureRows(actor) {
  const getFeatures = globalThis.add2eGetActorClassFeatures;
  const getLevel = globalThis.add2eFeatureActorLevel;
  const all = typeof getFeatures === "function" ? getFeatures(actor) ?? [] : [];
  return all.map((feature, index) => ({ ...feature, __featureIndex: index }))
    .filter(feature => {
      const level = typeof getLevel === "function" ? getLevel(actor, feature) : Number(feature?._add2eClassLevel);
      return Number.isFinite(level) && level >= featureMinLevel(feature) && level <= featureMaxLevel(feature);
    });
}

function classUsesExceptionalStrength(item) {
  const slug = classSlug(item);
  return ["guerrier", "paladin", "rodeur", "ranger"].includes(slug);
}

function canonicalThiefRows(actor) {
  const richReader = globalThis.add2eGetActorThiefSkills;
  if (typeof richReader === "function") {
    const rows = richReader(actor);
    if (Array.isArray(rows) && rows.length) return rows;
  }
  const tableReader = globalThis.add2eGetActorThiefSkillTable;
  return typeof tableReader === "function" ? tableReader(actor) ?? [] : [];
}

function syncMulticlassSheetData(actor, data) {
  if (!data?.actor?.system || !multiclassEnabled(actor)) return data;
  const output = data;
  const system = output.actor.system;
  const features = classFeatureRows(actor);
  const thiefRows = canonicalThiefRows(actor);

  output.activeClassFeatures = features.filter(isFeatureActivable);
  output.passiveClassFeatures = features.filter(feature => !isFeatureActivable(feature));
  output.thiefSkillRows = thiefRows;
  output.thiefSkills = thiefRows;
  output.canExceptionalStrength = Number(system.force ?? actor.system?.force) === 18 && classItems(actor).some(classUsesExceptionalStrength);
  output.progressionCourante = { ...(output.progressionCourante ?? {}), title: system.titre ?? "" };

  system.thaco = actor.system?.thaco ?? system.thaco;
  system.sauvegardes = foundry.utils.deepClone(actor.system?.sauvegardes ?? system.sauvegardes ?? []);
  if (output.combatDefense) {
    output.combatDefense.thaco = system.thaco ?? output.combatDefense.thaco;
    output.combatDefense.ac_naturelle = actor.system?.ca_naturel ?? output.combatDefense.ac_naturelle;
    output.combatDefense.ac_totale = actor.system?.ca_total ?? output.combatDefense.ac_totale;
  }
  return output;
}

function installGetDataPatch() {
  const proto = globalThis.Add2eActorSheet?.prototype;
  if (!proto?.getData || proto.__add2eMulticlassGetDataPatch === MULTICLASS_VERSION) return !!proto?.getData;
  const original = proto.getData;
  proto.getData = async function add2eItemProgressionMulticlassGetData(...args) {
    const data = await original.apply(this, args);
    if (this.actor?.type !== "personnage" || !multiclassEnabled(this.actor)) return data;
    const payload = multiclassUpdatePayload(this.actor);
    const output = payload ? applyPayloadToSheetData(data, payload) : data;
    return syncMulticlassSheetData(this.actor, output);
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

function classEffectTags(classDoc) {
  const progression = classProgression(classDoc);
  if (!progression.hasLevel) return [];
  const level = progression.level;
  const tags = new Set();
  const push = value => {
    for (const raw of globalThis.add2eToEquipArray?.(value) ?? []) {
      const tag = globalThis.add2eNormalizeEquipTag?.(raw);
      if (tag) tags.add(tag);
    }
  };
  const pushFeatures = value => {
    const features = Array.isArray(value) ? value : (value && typeof value === "object" ? Object.values(value) : []);
    for (const feature of features) {
      if (!feature || typeof feature !== "object") continue;
      if (level < featureMinLevel(feature) || level > featureMaxLevel(feature)) continue;
      push(feature.tags);
      push(feature.tag);
      push(feature.effectTags);
      push(feature.effets);
      push(feature.effects);
      push(feature.flags?.add2e?.tags);
      push(feature.flags?.add2e?.effectTags);
    }
  };

  const system = classDoc.system ?? {};
  push(system.tags);
  push(system.tag);
  push(system.effectTags);
  push(system.effets);
  push(system.effects);
  push(system.flags?.add2e?.tags);
  for (const field of [
    "classFeatures", "classFeaturesDebloquees", "activeClassFeatures", "activableClassFeatures",
    "classFeaturesActives", "capacitesClasse", "capacitesActives", "capacitesActivables",
    "passiveClassFeatures", "passiveFeatures", "capacitesPassives"
  ]) pushFeatures(system[field]);
  const row = classRow(classDoc);
  push(row?.tags);
  push(row?.effectTags);
  return [...tags];
}

function classPassiveEffectData(classDoc, tags) {
  return {
    name: `${classDoc.name} — effets de classe`,
    label: `${classDoc.name} — effets de classe`,
    icon: classDoc.img || "icons/svg/aura.svg",
    origin: classDoc.uuid,
    disabled: false,
    transfer: false,
    changes: [],
    flags: {
      add2e: {
        autoClassPassiveEffect: true,
        sourceType: "classe",
        sourceClasse: classDoc.name,
        sourceItemId: classDoc.id,
        sourceItemUuid: classDoc.uuid,
        tags,
        effectTags: tags
      }
    }
  };
}

async function syncClassPassiveEffectsFromItems(actor, { reason = "class-item-passive-effects" } = {}) {
  if (!actor || actor.type !== "personnage") return [];
  const classes = classItems(actor);
  const expected = new Map();
  for (const classDoc of classes) {
    const tags = classEffectTags(classDoc);
    if (tags.length) expected.set(String(classDoc.id), { classDoc, tags });
  }

  const managed = Array.from(actor.effects ?? []).filter(effect => effect.flags?.add2e?.autoClassPassiveEffect === true);
  const byClassId = new Map();
  for (const effect of managed) {
    const classId = String(effect.flags?.add2e?.sourceItemId ?? "");
    if (!byClassId.has(classId)) byClassId.set(classId, []);
    byClassId.get(classId).push(effect);
  }

  const removeIds = [];
  const updates = [];
  const creates = [];
  for (const [classId, effects] of byClassId) {
    const wanted = expected.get(classId);
    if (!wanted) {
      removeIds.push(...effects.map(effect => effect.id));
      continue;
    }
    const [current, ...duplicates] = effects;
    updates.push({ _id: current.id, ...classPassiveEffectData(wanted.classDoc, wanted.tags) });
    removeIds.push(...duplicates.map(effect => effect.id));
    expected.delete(classId);
  }
  for (const { classDoc, tags } of expected.values()) creates.push(classPassiveEffectData(classDoc, tags));

  if (removeIds.length) await actor.deleteEmbeddedDocuments("ActiveEffect", removeIds, {
    add2eInternal: true,
    add2eMulticlassInternal: true,
    add2eReason: reason,
    render: false
  });
  if (updates.length) await actor.updateEmbeddedDocuments("ActiveEffect", updates, {
    add2eInternal: true,
    add2eMulticlassInternal: true,
    add2eReason: reason,
    render: false
  });
  if (creates.length) await actor.createEmbeddedDocuments("ActiveEffect", creates, {
    add2eInternal: true,
    add2eMulticlassInternal: true,
    add2eReason: reason,
    render: false
  });
  return creates;
}

function queueClassPassiveEffects(actor, reason) {
  setTimeout(() => {
    syncClassPassiveEffectsFromItems(actor, { reason })
      .catch(error => warn("[CLASS_PASSIVE_EFFECT_SYNC_ERROR]", { actor: actor?.name, error }));
  }, 0);
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
    const tags = Array.isArray(item.system?.tags) ? item.system.tags.map(value => String(value).toLowerCase()) : [];
    return classSlug(item) === "voleur" || tags.includes("classe:voleur");
  }) ?? null;
}

/**
 * Adaptateur temporaire du moteur Voleur historique : il reçoit toujours
 * l'Item Voleur exact et son niveau, jamais la première classe de l'acteur.
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
  if (classItems(actor).length === 1) {
    await ensureMonoclassItemProgression(actor, { reason: "monoclass-item-progression-migration" });
    await syncClassPassiveEffectsFromItems(actor, { reason: "monoclass-item-passive-effects" });
    return true;
  }
  if (classItems(actor).length <= 1) return null;
  const migration = await migrateLegacyMulticlassActor(actor);
  if (migration?.ok === false) return null;
  const result = await recalcActor(actor);
  await syncMulticlassCombatSummary(actor, { reason: "multiclass-migration-summary" });
  await syncClassPassiveEffectsFromItems(actor, { reason: "multiclass-item-passive-effects" });
  return result;
}

installClassFeatureGlobals();
installGetDataPatch();
globalThis.add2eSyncClassPassiveEffect = syncClassPassiveEffectsFromItems;

Hooks.once("ready", () => {
  installClassFeatureGlobals();
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
    .then(() => syncClassPassiveEffectsFromItems(actor, { reason: "monoclass-actor-summary-effects" }))
    .catch(error => warn("[MONO_SYNC_ERROR]", { actor: actor.name, error }));
});

Hooks.on("createItem", item => {
  const actor = item?.parent;
  if (actor?.documentName !== "Actor" || actor.type !== "personnage") return;
  if (String(item.type ?? "").toLowerCase() !== "classe") return;
  setTimeout(() => migrateAndRecalculate(actor).catch(error => warn("[CREATE_CLASS_MIGRATION_ERROR]", error)), 0);
});

Hooks.on("updateItem", (item, _changes, _options = {}) => {
  const actor = item?.parent;
  if (actor?.type !== "personnage" || String(item?.type ?? "").toLowerCase() !== "classe") return;
  queueMulticlassCombatSummary(actor, "class-item-update-summary");
  queueClassPassiveEffects(actor, "class-item-update-effects");
});

Hooks.on("deleteItem", item => {
  const actor = item?.parent;
  if (actor?.documentName !== "Actor" || actor.type !== "personnage" || String(item.type ?? "").toLowerCase() !== "classe") return;
  setTimeout(() => {
    const remaining = classItems(actor);
    if (remaining.length > 1) migrateAndRecalculate(actor).catch(error => warn("[DELETE_CLASS_RECALC_ERROR]", error));
    else if (remaining.length === 1) cleanupAfterMonoclassReplace(actor, remaining[0], null, actor.sheet)
      .then(() => syncClassPassiveEffectsFromItems(actor, { reason: "delete-class-monoclass-effects" }))
      .catch(error => warn("[DELETE_CLASS_MONO_ERROR]", error));
    else syncClassPassiveEffectsFromItems(actor, { reason: "delete-last-class-effects" })
      .catch(error => warn("[DELETE_CLASS_EFFECTS_ERROR]", error));
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
globalThis.add2eSyncClassPassiveEffectsFromItems = syncClassPassiveEffectsFromItems;

console.log("[ADD2E][MULTICLASSE][ITEM_PROGRESSION_READY]", MULTICLASS_VERSION);