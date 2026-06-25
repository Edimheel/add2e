// ADD2E — Multiclassage : opérations canoniques
// Les opérations écrivent un seul état de progression : system.multiclasse.classes.

import {
  canonicalClassStates,
  canonicalMulticlass,
  classItems,
  classSlug,
  cloneItemData,
  INTERNAL,
  itemLabel,
  norm,
  num,
  systemRace,
  warn
} from "./17b-multiclass-core.mjs";
import {
  canonicalMulticlassEntries,
  canonicalStateRecord,
  classPrerequisitesOk,
  classRaceMaxLevel,
  classTitleForLevel,
  currentRaceOrCompatibleAlternatives,
  legacyMulticlassMigrationPayload,
  levelForClassXp,
  minXpForClassLevel,
  monoClassCleanupPayload,
  monoClassStateFromActor,
  multiclassUpdatePayload,
  nextXpForClassLevel,
  raceCompatibleForMulticlass,
  raceMatchesClassRules,
  raceAllowsClassSet
} from "./17b-multiclass-rules.mjs";
import { dialogAlert } from "./17b-multiclass-dialogs.mjs";

const migrationLocks = new Set();

function stateRecords(actor) {
  return foundry.utils.deepClone(canonicalClassStates(actor));
}

function classRecordIndex(records, classDocOrIdOrSlug) {
  const id = typeof classDocOrIdOrSlug === "object" ? classDocOrIdOrSlug?.id : "";
  const slug = typeof classDocOrIdOrSlug === "object" ? classSlug(classDocOrIdOrSlug) : norm(classDocOrIdOrSlug);
  return records.findIndex(entry =>
    (id && String(entry?.itemId ?? "") === String(id))
    || (slug && norm(entry?.slug) === slug)
  );
}

function itemIds(items) {
  return (items ?? []).map(item => item?.id).filter(Boolean);
}

function sourceClassKeys(classDocs) {
  const ids = new Set();
  const uuids = new Set();
  const slugs = new Set();
  for (const doc of classDocs ?? []) {
    if (doc?.id) ids.add(String(doc.id));
    if (doc?.uuid) uuids.add(String(doc.uuid));
    const slug = classSlug(doc);
    if (slug) slugs.add(slug);
  }
  return { ids, uuids, slugs };
}

function itemBelongsToRemovedClass(item, keys) {
  const flags = item?.flags?.add2e ?? {};
  const sourceId = String(
    flags.autoGrantedByClassId
    ?? flags.sourceClassId
    ?? flags.sourceItemId
    ?? flags.classId
    ?? ""
  );
  const sourceSlug = norm(
    flags.autoGrantedByClass
    ?? flags.sourceClassSlug
    ?? flags.sourceClasse
    ?? flags.sourceClass
    ?? flags.classSlug
    ?? ""
  );
  return (sourceId && keys.ids.has(sourceId)) || (sourceSlug && keys.slugs.has(sourceSlug));
}

function effectBelongsToRemovedClass(effect, keys) {
  const flags = effect?.flags?.add2e ?? {};
  const origin = String(effect?.origin ?? "");
  const sourceId = String(flags.sourceItemId ?? flags.sourceClassId ?? flags.classId ?? "");
  const sourceSlug = norm(flags.sourceClasse ?? flags.sourceClass ?? flags.classSlug ?? flags.classe ?? "");
  return [...keys.uuids].some(uuid => uuid && origin === uuid)
    || (sourceId && keys.ids.has(sourceId))
    || (sourceSlug && keys.slugs.has(sourceSlug));
}

async function purgeClassBoundContent(actor, classDocs, reason) {
  if (!actor || !classDocs?.length) return { spells: 0, effects: 0 };

  const keys = sourceClassKeys(classDocs);
  const spellIds = actor.items
    .filter(item => String(item?.type ?? "").toLowerCase() === "sort" && itemBelongsToRemovedClass(item, keys))
    .map(item => item.id)
    .filter(Boolean);
  const effectIds = actor.effects
    .filter(effect => effectBelongsToRemovedClass(effect, keys))
    .map(effect => effect.id)
    .filter(Boolean);

  if (effectIds.length) {
    await actor.deleteEmbeddedDocuments("ActiveEffect", effectIds, {
      [INTERNAL]: true,
      add2eInternal: true,
      add2eReason: reason
    });
  }
  if (spellIds.length) {
    await actor.deleteEmbeddedDocuments("Item", spellIds, {
      [INTERNAL]: true,
      add2eInternal: true,
      add2eReason: reason
    });
  }
  return { spells: spellIds.length, effects: effectIds.length };
}

function monoProgressionPayload(actor, classDoc, state) {
  const classSystem = classDoc?.system ?? {};
  const maxLevel = classRaceMaxLevel(classDoc, systemRace(actor));
  let level = Math.max(1, Math.floor(num(state?.level, 1)));
  let xp = Math.max(0, Math.floor(num(state?.xp, 0)));

  if (maxLevel > 0 && level > maxLevel) level = maxLevel;
  xp = Math.max(xp, minXpForClassLevel(classSystem, level));

  const currentXp = minXpForClassLevel(classSystem, level);
  const nextXp = nextXpForClassLevel(classSystem, level);
  const title = classTitleForLevel(classSystem, level);
  const xpPercent = nextXp > currentXp
    ? Math.max(0, Math.min(100, Math.floor(((xp - currentXp) / (nextXp - currentXp)) * 100)))
    : 100;

  return {
    "system.classe": classDoc.name,
    "system.details_classe": {
      ...(foundry.utils.deepClone(classSystem) ?? {}),
      name: classDoc.name,
      label: classDoc.system?.label || classDoc.name,
      slug: classSlug(classDoc),
      sourceItemId: classDoc.id,
      sourceItemUuid: classDoc.uuid
    },
    "system.spellcasting": foundry.utils.deepClone(classSystem.spellcasting ?? null),
    "system.niveau": level,
    "system.niveau_suggere": level,
    "system.xp": xp,
    "system.titre": title,
    "system.progression_xp": nextXp ? `${xp.toLocaleString()} / ${nextXp.toLocaleString()} XP` : `${xp.toLocaleString()} XP`,
    "system.xp_next": nextXp,
    "system.xp_to_next": nextXp ? Math.max(0, nextXp - xp) : 0,
    "system.xp_percent": xpPercent
  };
}

export async function migrateLegacyMulticlassActor(actor) {
  if (!actor || actor.type !== "personnage" || classItems(actor).length <= 1) return null;
  if (canonicalMulticlass(actor)) return multiclassUpdatePayload(actor);
  if (migrationLocks.has(actor.id)) return null;

  migrationLocks.add(actor.id);
  try {
    const payload = legacyMulticlassMigrationPayload(actor);
    if (!payload) throw new Error("Impossible de construire l'état multiclasses canonique.");
    await actor.update(payload, {
      [INTERNAL]: true,
      add2eInternal: true,
      add2eReason: "multiclass-canonical-migration"
    });
    return payload;
  } finally {
    migrationLocks.delete(actor.id);
  }
}

export async function ensureCanonicalMulticlassState(actor) {
  if (!actor || actor.type !== "personnage") return null;
  if (canonicalMulticlass(actor)) return canonicalMulticlass(actor);
  if (classItems(actor).length <= 1) return null;
  await migrateLegacyMulticlassActor(actor);
  return canonicalMulticlass(actor);
}

export async function cleanupAfterMonoclassReplace(actor, keepClassDoc, keepState = null, sheet = null) {
  if (!actor || actor.type !== "personnage" || !keepClassDoc) return false;

  const unwanted = classItems(actor).filter(doc => doc.id !== keepClassDoc.id);
  await purgeClassBoundContent(actor, unwanted, "multiclass-monoclass-purge");
  if (unwanted.length) {
    await actor.deleteEmbeddedDocuments("Item", itemIds(unwanted), {
      [INTERNAL]: true,
      add2eInternal: true,
      add2eReason: "multiclass-monoclass-delete-classes"
    });
  }

  const payload = {
    ...monoClassCleanupPayload(),
    ...monoProgressionPayload(actor, keepClassDoc, keepState ?? monoClassStateFromActor(actor, keepClassDoc))
  };
  await actor.update(payload, {
    [INTERNAL]: true,
    add2eInternal: true,
    add2eReason: "multiclass-monoclass-finalize"
  });

  try {
    if (typeof globalThis.add2eSyncActorSpellsFromClass === "function") {
      await globalThis.add2eSyncActorSpellsFromClass(actor, keepClassDoc, { mode: "replace", showWait: true });
    }
  } catch (error) {
    warn("[MONO_SPELL_SYNC_ERROR]", { actor: actor.name, error });
  }

  sheet?._add2eRememberActiveTab?.();
  sheet?.render?.(false);
  return true;
}

export function applyPayloadToSheetData(data, payload) {
  if (!data?.actor?.system || !payload) return data;
  for (const [path, value] of Object.entries(payload)) {
    const deletion = path.match(/^(.*)\.-=([^.]*)$/);
    if (deletion) {
      const container = foundry.utils.getProperty(data.actor, deletion[1]);
      if (container && typeof container === "object") delete container[deletion[2]];
      continue;
    }
    foundry.utils.setProperty(data.actor, path, foundry.utils.deepClone(value));
  }
  data.progressionCourante = { title: data.actor.system?.titre ?? "" };
  return data;
}

export async function applyRaceData(actor, raceData, sheet = null) {
  if (!raceData) return false;
  if (norm(itemLabel(systemRace(actor), "Race")) === norm(itemLabel(raceData, "Race"))) return true;
  if (typeof globalThis.add2eApplyRaceItemDataToActor !== "function") {
    throw new Error("Le gestionnaire de race canonique est introuvable.");
  }
  await globalThis.add2eApplyRaceItemDataToActor(actor, raceData, sheet, {
    notify: true,
    reason: "multiclass-race-choice"
  });
  return true;
}

function currentOrMigratedStateRecords(actor) {
  const canonical = canonicalMulticlass(actor);
  if (!canonical) throw new Error("État multiclasses canonique absent.");
  return stateRecords(actor);
}

export async function addClassAsMulticlass(actor, option, sheet = null) {
  const itemData = option?.classData;
  if (!actor || !itemData) return false;
  if (!raceCompatibleForMulticlass(actor, itemData, option.raceData)
    || !classPrerequisitesOk(actor, itemData, option.raceData, { notify: true })) return false;

  const existingDocs = classItems(actor);
  const slug = classSlug(itemData);
  if (existingDocs.some(doc => classSlug(doc) === slug)) {
    await ensureCanonicalMulticlassState(actor);
    const payload = multiclassUpdatePayload(actor);
    if (payload) await actor.update(payload, {
      [INTERNAL]: true,
      add2eInternal: true,
      add2eReason: "multiclass-resync-existing-class"
    });
    sheet?._add2eRememberActiveTab?.();
    sheet?.render?.(false);
    ui.notifications.info(`${itemLabel(itemData, "Classe")} est déjà présente : multiclassage recalculé.`);
    return true;
  }

  await applyRaceData(actor, option.raceData, sheet);

  let records;
  if (existingDocs.length === 1) {
    records = [monoClassStateFromActor(actor, existingDocs[0])];
  } else {
    await ensureCanonicalMulticlassState(actor);
    records = currentOrMigratedStateRecords(actor);
  }

  const data = cloneItemData(itemData);
  data.type = "classe";
  const [created] = await actor.createEmbeddedDocuments("Item", [data], {
    [INTERNAL]: true,
    add2eInternal: true,
    add2eReason: "multiclass-add-class-create"
  });
  if (!created) return false;

  records.push(canonicalStateRecord(created, {
    level: 1,
    xp: minXpForClassLevel(created.system ?? {}, 1)
  }));

  const payload = multiclassUpdatePayload(actor, {
    classStates: records,
    raceData: systemRace(actor)
  });
  if (!payload) throw new Error("Le payload multiclasses n'a pas été généré après ajout de classe.");

  await actor.update(payload, {
    [INTERNAL]: true,
    add2eInternal: true,
    add2eReason: "multiclass-add-class-finalize"
  });

  try {
    if (typeof globalThis.add2eSyncActorSpellsFromClass === "function") {
      await globalThis.add2eSyncActorSpellsFromClass(actor, created, { mode: "append", showWait: true });
    }
  } catch (error) {
    warn("[SPELL_SYNC_APPEND_ERROR]", { actor: actor.name, className: created.name, error });
  }

  sheet?._add2eRememberActiveTab?.();
  sheet?.render?.(false);
  ui.notifications.info(`Multiclassage appliqué : ${created.name} avec ${itemLabel(option.raceData, "Race")}.`);
  return true;
}

export async function replaceClassInMulticlass(actor, option, sheet = null) {
  const itemData = option?.classData;
  if (!actor || !itemData || !option?.replacedClassId) return false;

  const remainingNames = classItems(actor)
    .filter(doc => doc.id !== option.replacedClassId && classSlug(doc) !== option.replacedClassSlug)
    .map(doc => doc.name)
    .concat(itemLabel(itemData, "Classe"));
  if (!raceAllowsClassSet(option.raceData, remainingNames)
    || !raceMatchesClassRules(option.raceData, itemData)
    || !classPrerequisitesOk(actor, itemData, option.raceData, { notify: true })) return false;

  await ensureCanonicalMulticlassState(actor);
  const replaced = classItems(actor).find(doc =>
    String(doc.id) === String(option.replacedClassId)
    || classSlug(doc) === norm(option.replacedClassSlug)
  );
  if (!replaced) {
    ui.notifications.error("Classe à remplacer introuvable dans l'acteur.");
    return false;
  }

  const targetSlug = classSlug(itemData);
  if (classItems(actor).some(doc => doc.id !== replaced.id && classSlug(doc) === targetSlug)) {
    ui.notifications.warn(`${itemLabel(itemData, "Classe")} est déjà présente dans le multiclassage.`);
    return false;
  }

  await applyRaceData(actor, option.raceData, sheet);
  const records = currentOrMigratedStateRecords(actor);
  const replacedIndex = classRecordIndex(records, replaced);
  if (replacedIndex < 0) throw new Error(`État canonique manquant pour ${replaced.name}.`);

  await purgeClassBoundContent(actor, [replaced], "multiclass-replace-purge-class-content");
  await actor.deleteEmbeddedDocuments("Item", [replaced.id], {
    [INTERNAL]: true,
    add2eInternal: true,
    add2eReason: "multiclass-replace-delete-class"
  });

  const data = cloneItemData(itemData);
  data.type = "classe";
  const [created] = await actor.createEmbeddedDocuments("Item", [data], {
    [INTERNAL]: true,
    add2eInternal: true,
    add2eReason: "multiclass-replace-create-class"
  });
  if (!created) throw new Error("Création de la classe de remplacement impossible.");

  records.splice(replacedIndex, 1, canonicalStateRecord(created, {
    level: 1,
    xp: minXpForClassLevel(created.system ?? {}, 1)
  }));

  const payload = multiclassUpdatePayload(actor, {
    classStates: records,
    raceData: systemRace(actor)
  });
  if (!payload) throw new Error("Le payload multiclasses n'a pas été généré après remplacement.");

  await actor.update(payload, {
    [INTERNAL]: true,
    add2eInternal: true,
    add2eReason: "multiclass-replace-finalize"
  });

  try {
    if (typeof globalThis.add2eSyncActorSpellsFromClass === "function") {
      await globalThis.add2eSyncActorSpellsFromClass(actor, created, { mode: "append", showWait: true });
    }
  } catch (error) {
    warn("[SPELL_SYNC_REPLACE_ERROR]", { actor: actor.name, className: created.name, error });
  }

  sheet?._add2eRememberActiveTab?.();
  sheet?.render?.(false);
  ui.notifications.info(`Classe remplacée : ${replaced.name} → ${created.name}.`);
  return true;
}

export async function applyClassAsMonoclass(actor, optionOrItemData, sheet = null) {
  const itemData = optionOrItemData?.classData ?? optionOrItemData;
  const raceData = optionOrItemData?.raceData ?? systemRace(actor);
  if (!actor || !itemData || !classPrerequisitesOk(actor, itemData, raceData, { notify: true })) return false;

  await applyRaceData(actor, raceData, sheet);
  const wantedSlug = classSlug(itemData);
  const existing = classItems(actor);
  const existingTarget = existing.find(doc => classSlug(doc) === wantedSlug) ?? null;

  let keep = existingTarget;
  let state = null;
  if (existing.length > 1) {
    await ensureCanonicalMulticlassState(actor);
    const records = stateRecords(actor);
    const index = existingTarget ? classRecordIndex(records, existingTarget) : -1;
    state = index >= 0 ? records[index] : null;
  }

  if (!keep) {
    const data = cloneItemData(itemData);
    data.type = "classe";
    const [created] = await actor.createEmbeddedDocuments("Item", [data], {
      [INTERNAL]: true,
      add2eInternal: true,
      add2eReason: "multiclass-monoclass-create-class"
    });
    if (!created) return false;
    keep = created;
  }

  if (!state) {
    state = monoClassStateFromActor(actor, keep);
    state.level = Math.max(1, Math.floor(num(actor.system?.niveau, state.level)));
    state.xp = Math.max(0, Math.floor(num(actor.system?.xp, state.xp)));
  }

  return cleanupAfterMonoclassReplace(actor, keep, state, sheet);
}

export async function applyRaceForMulticlass(actor, raceData, sheet = null) {
  if (!actor || classItems(actor).length <= 1) return false;
  const docs = classItems(actor);
  const allowed = docs.every(doc => raceCompatibleForMulticlass(actor, doc, raceData));
  if (!allowed) {
    await dialogAlert(
      "ADD2E — Race incompatible",
      `<p>La race <b>${itemLabel(raceData, "Race")}</b> n'est pas compatible avec le multiclassage actuel.</p>`
    );
    return true;
  }

  await ensureCanonicalMulticlassState(actor);
  await applyRaceData(actor, raceData, sheet);
  const payload = multiclassUpdatePayload(actor, {
    classStates: currentOrMigratedStateRecords(actor),
    raceData
  });
  if (payload) await actor.update(payload, {
    [INTERNAL]: true,
    add2eInternal: true,
    add2eReason: "multiclass-race-refresh"
  });
  sheet?.render?.(false);
  return true;
}

export async function recalcActor(actor) {
  if (!actor || actor.type !== "personnage" || classItems(actor).length <= 1) return null;
  await ensureCanonicalMulticlassState(actor);
  const payload = multiclassUpdatePayload(actor);
  if (!payload) return null;
  await actor.update(payload, {
    [INTERNAL]: true,
    add2eInternal: true,
    add2eReason: "multiclass-canonical-recalc"
  });
  return payload;
}

export { currentRaceOrCompatibleAlternatives };
