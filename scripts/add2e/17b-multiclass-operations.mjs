// ADD2E — Multiclassage : opérations canoniques
// Les Items classe sont l'unique état de progression. L'acteur ne conserve
// que des résumés d'affichage et des métadonnées sans niveaux ni XP par classe.

import {
  INTERNAL,
  canonicalClassState,
  classItems,
  classProgression,
  classProgressionUpdate,
  classSlug,
  cloneItemData,
  itemLabel,
  multiclassEnabled,
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
  legacyMulticlassMigrationPlan,
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
const migrationWarnings = new Set();
const ARCANE_LEARNED_SPELL_LISTS = new Set(["magicien", "illusionniste"]);

function itemIds(items) {
  return (items ?? []).map(item => item?.id).filter(Boolean);
}

function classNameKeys(classDoc) {
  const system = classDoc?.system ?? {};
  return [
    classDoc?.name,
    system.nom,
    system.name,
    system.label,
    system.slug,
    classSlug(classDoc)
  ].map(norm).filter(Boolean);
}

function sourceClassKeys(classDocs) {
  const ids = new Set();
  const uuids = new Set();
  const slugs = new Set();
  const names = new Set();
  for (const doc of classDocs ?? []) {
    if (doc?.id) ids.add(String(doc.id));
    if (doc?.uuid) uuids.add(String(doc.uuid));
    const slug = classSlug(doc);
    if (slug) slugs.add(slug);
    for (const name of classNameKeys(doc)) names.add(name);
  }
  return { ids, uuids, slugs, names };
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

function effectClassLabels(effect) {
  const flags = effect?.flags?.add2e ?? {};
  return [
    effect?.name,
    effect?.label,
    flags.autoGrantedByClass,
    flags.sourceClassName,
    flags.sourceItemName,
    flags.sourceClass,
    flags.sourceClasse,
    flags.className,
    flags.classe
  ].map(norm).filter(Boolean);
}

function effectReferencesClassName(effect, keys) {
  const names = effectClassLabels(effect);
  return names.some(value => keys.names.has(value)
    || [...keys.names].some(name => value.startsWith(`${name}_`) || value.endsWith(`_${name}`) || value.includes(`_${name}_`)));
}

function effectBelongsToRemovedClass(effect, keys) {
  const flags = effect?.flags?.add2e ?? {};
  const origin = String(effect?.origin ?? "");
  const sourceId = String(
    flags.sourceItemId
    ?? flags.sourceClassId
    ?? flags.classId
    ?? flags.sourceId
    ?? ""
  );
  const sourceSlug = norm(
    flags.sourceClasse
    ?? flags.sourceClass
    ?? flags.classSlug
    ?? flags.classe
    ?? flags.className
    ?? ""
  );
  const sourceType = norm(flags.sourceType ?? flags.source_type ?? flags.type ?? flags.kind ?? "");
  const exactLabel = effectClassLabels(effect).some(value => keys.names.has(value));
  const classTaggedLabel = ["classe", "class"].includes(sourceType) && effectReferencesClassName(effect, keys);
  const originMatches = [...keys.uuids].some(uuid => uuid && (origin === uuid || origin.startsWith(`${uuid}.`)))
    || [...keys.ids].some(id => id && (origin.includes(`.Item.${id}.`) || origin.endsWith(`.Item.${id}`)));
  return originMatches
    || (sourceId && keys.ids.has(sourceId))
    || (sourceSlug && keys.slugs.has(sourceSlug))
    || exactLabel
    || classTaggedLabel;
}

function isMissingEmbeddedDocumentError(error) {
  return /ActiveEffect .* does not exist|Item .* does not exist|undefined id .* does not exist|does not exist in the EmbeddedCollection/i.test(String(error?.message ?? error ?? ""));
}

function embeddedCollection(actor, documentName) {
  return documentName === "ActiveEffect" ? actor?.effects : actor?.items;
}

async function deleteLiveEmbeddedDocuments(actor, documentName, ids, options = {}) {
  const requested = [...new Set((ids ?? []).map(id => String(id ?? "").trim()).filter(Boolean))];
  const collection = embeddedCollection(actor, documentName);
  const existing = requested.filter(id => collection?.has?.(id));
  if (!existing.length) return 0;

  try {
    await actor.deleteEmbeddedDocuments(documentName, existing, options);
    return existing.length;
  } catch (error) {
    if (!isMissingEmbeddedDocumentError(error)) throw error;
  }

  let deleted = 0;
  for (const id of existing) {
    if (!embeddedCollection(actor, documentName)?.has?.(id)) continue;
    try {
      await actor.deleteEmbeddedDocuments(documentName, [id], options);
      deleted += 1;
    } catch (error) {
      if (!isMissingEmbeddedDocumentError(error)) throw error;
    }
  }
  return deleted;
}

function spellListValues(value) {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(spellListValues);
  if (typeof value === "string") return value.split(/[,;|\n]+/).map(entry => entry.trim()).filter(Boolean);
  if (typeof value === "object") {
    for (const key of ["spellLists", "lists", "classes", "classe", "class", "liste", "list", "value", "values", "items"]) {
      if (value[key] !== undefined) return spellListValues(value[key]);
    }
  }
  return [value];
}

function normalizeSpellList(value) {
  const aliases = {
    cleric: "clerc", priest: "clerc", pretre: "clerc", paladin: "clerc",
    druid: "druide",
    wizard: "magicien", mage: "magicien", magician: "magicien", magic_user: "magicien",
    illusionist: "illusionniste"
  };
  const key = typeof globalThis.add2eNormalizeSpellKey === "function"
    ? globalThis.add2eNormalizeSpellKey(value)
    : norm(value);
  return aliases[key] ?? key;
}

function spellListsForClass(classDoc) {
  const system = classDoc?.system ?? {};
  let casting = system.spellcasting;
  if (typeof casting === "string") {
    try { casting = JSON.parse(casting); }
    catch (_error) { casting = {}; }
  }
  const lists = [
    system.spellLists, system.lists, system.listeSorts, system.liste_sorts,
    casting?.lists, casting?.spellLists, casting?.list, casting?.classes
  ].flatMap(spellListValues).map(normalizeSpellList).filter(Boolean);
  const slug = normalizeSpellList(classSlug(classDoc));
  if (ARCANE_LEARNED_SPELL_LISTS.has(slug)) lists.push(slug);
  return new Set(lists);
}

function spellListsForItem(item) {
  const system = item?.system ?? {};
  const flags = item?.flags?.add2e ?? {};
  return new Set([
    system.spellLists, system.lists, system.classes, system.classe, system.class, system.liste,
    flags.learnedSpellLists, flags.knownSpellLists, flags.spellListsResolved
  ].flatMap(spellListValues).map(normalizeSpellList).filter(Boolean));
}

function isRegularSpellItem(item) {
  if (String(item?.type ?? "").toLowerCase() !== "sort") return false;
  if (typeof globalThis.add2eIsRegularPreparableSpell === "function") {
    return globalThis.add2eIsRegularPreparableSpell(item) === true;
  }
  const system = item?.system ?? {};
  const flags = item?.flags?.add2e ?? {};
  return !(system.isPower === true
    || system.isObjectPower === true
    || system.isCapacity === true
    || system.isCapacite === true
    || system.usageType === "classFeature"
    || system.sourceWeaponId
    || system.sourceCapacite
    || system.sourceFeature
    || flags.sourceType === "objet_magique"
    || flags.sourceType === "capacite"
    || flags.sourceType === "capacity");
}

function remainingClassesAfterRemoval(actor, removedDocs) {
  const removedIds = new Set(itemIds(removedDocs).map(String));
  return classItems(actor).filter(doc => !removedIds.has(String(doc?.id ?? "")));
}

function activeSpellListsForClasses(classDocs) {
  const lists = new Set();
  for (const classDoc of classDocs ?? []) {
    for (const list of spellListsForClass(classDoc)) lists.add(list);
  }
  return lists;
}

function arcaneListsToPurge(actor, removedDocs) {
  const removedLists = activeSpellListsForClasses(removedDocs);
  const retainedLists = activeSpellListsForClasses(remainingClassesAfterRemoval(actor, removedDocs));
  return {
    retainedLists,
    purgeLists: new Set([...removedLists].filter(list => ARCANE_LEARNED_SPELL_LISTS.has(list) && !retainedLists.has(list)))
  };
}

function spellStillAccessibleFromRetainedClass(item, retainedLists) {
  return [...spellListsForItem(item)].some(list => retainedLists.has(list));
}

function isLearnedArcaneSpellRemovedWithClass(item, purgeLists, retainedLists) {
  if (!isRegularSpellItem(item) || !purgeLists.size) return false;
  if (spellStillAccessibleFromRetainedClass(item, retainedLists)) return false;
  return [...spellListsForItem(item)].some(list => purgeLists.has(list));
}

/**
 * Supprime les effets source-liés à la classe retirée, puis les sorts réguliers
 * Magicien/Illusionniste que le personnage ne peut plus utiliser. Les pouvoirs
 * d'objets, capacités et sorts encore disponibles depuis une classe conservée
 * restent intacts.
 */
async function purgeClassBoundContent(actor, classDocs, reason) {
  if (!actor || !classDocs?.length) return { spells: 0, effects: 0, arcaneLists: [] };
  const keys = sourceClassKeys(classDocs);
  const { retainedLists, purgeLists } = arcaneListsToPurge(actor, classDocs);
  const spellIds = actor.items
    .filter(item => {
      if (String(item?.type ?? "").toLowerCase() !== "sort") return false;
      const sourceBound = itemBelongsToRemovedClass(item, keys);
      const retained = isRegularSpellItem(item) && spellStillAccessibleFromRetainedClass(item, retainedLists);
      if (sourceBound && !retained) return true;
      return isLearnedArcaneSpellRemovedWithClass(item, purgeLists, retainedLists);
    })
    .map(item => item.id)
    .filter(Boolean);
  const effectIds = actor.effects
    .filter(effect => effectBelongsToRemovedClass(effect, keys))
    .map(effect => effect.id)
    .filter(Boolean);

  const effectCount = await deleteLiveEmbeddedDocuments(actor, "ActiveEffect", effectIds, {
    [INTERNAL]: true,
    add2eInternal: true,
    add2eReason: reason
  });
  const spellCount = await deleteLiveEmbeddedDocuments(actor, "Item", spellIds, {
    [INTERNAL]: true,
    add2eInternal: true,
    add2eReason: reason
  });
  return { spells: spellCount, effects: effectCount, arcaneLists: [...purgeLists] };
}

function normalizeProgression(classDoc, state, raceData) {
  const maxLevel = classRaceMaxLevel(classDoc, raceData);
  let level = Math.max(1, Math.floor(num(state?.level, 1)));
  let xp = Math.max(0, Math.floor(num(state?.xp, 0)));
  if (maxLevel > 0 && level > maxLevel) level = maxLevel;
  xp = Math.max(xp, minXpForClassLevel(classDoc?.system ?? {}, level));
  return { level, xp, maxLevel };
}

async function writeClassProgression(actor, entries, reason) {
  const updates = [];
  for (const entry of entries ?? []) {
    const doc = entry?.doc ?? actor?.items?.get?.(entry?.itemId) ?? null;
    if (!doc) continue;
    const current = classProgression(doc);
    if (current.hasLevel && current.level === entry.level && current.hasXp && current.xp === entry.xp) continue;
    const update = classProgressionUpdate(doc, { level: entry.level, xp: entry.xp });
    if (update) updates.push(update);
  }
  if (!updates.length) return 0;
  await actor.updateEmbeddedDocuments("Item", updates, {
    [INTERNAL]: true,
    add2eInternal: true,
    add2eReason: reason
  });
  return updates.length;
}

function monoProgressionPayload(actor, classDoc, state) {
  const normalized = normalizeProgression(classDoc, state, systemRace(actor));
  const classSystem = classDoc?.system ?? {};
  const currentXp = minXpForClassLevel(classSystem, normalized.level);
  const nextXp = nextXpForClassLevel(classSystem, normalized.level);
  const title = classTitleForLevel(classSystem, normalized.level);
  const xpPercent = nextXp > currentXp
    ? Math.max(0, Math.min(100, Math.floor(((normalized.xp - currentXp) / (nextXp - currentXp)) * 100)))
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
    "system.niveau": normalized.level,
    "system.niveau_suggere": normalized.level,
    "system.xp": normalized.xp,
    "system.titre": title,
    "system.progression_xp": nextXp ? `${normalized.xp.toLocaleString()} / ${nextXp.toLocaleString()} XP` : `${normalized.xp.toLocaleString()} XP`,
    "system.xp_next": nextXp,
    "system.xp_to_next": nextXp ? Math.max(0, nextXp - normalized.xp) : 0,
    "system.xp_percent": xpPercent
  };
}

function migrationWarningKey(actor) {
  return String(actor?.uuid ?? actor?.id ?? "");
}

async function notifyMigrationBlocked(actor, plan) {
  const key = migrationWarningKey(actor);
  if (migrationWarnings.has(key)) return;
  migrationWarnings.add(key);
  const names = (plan?.unresolved ?? []).map(entry => entry.name).filter(Boolean).join(", ") || "classe inconnue";
  warn("[MIGRATION_BLOCKED]", { actor: actor?.name, unresolved: plan?.unresolved ?? [] });
  if (game.user?.isGM) ui.notifications?.error?.(`Multiclassage non migré pour ${actor.name} : progression introuvable pour ${names}.`);
}

/**
 * Écrit les niveaux/XP historiques sur les Items. Si une classe ne peut pas
 * être associée avec certitude à une progression, aucune écriture n'est faite.
 */
export async function migrateLegacyMulticlassActor(actor) {
  if (!actor || actor.type !== "personnage" || classItems(actor).length <= 1) return null;
  if (migrationLocks.has(actor.id)) return null;
  migrationLocks.add(actor.id);
  try {
    const plan = legacyMulticlassMigrationPlan(actor);
    if (!plan.ok) {
      await notifyMigrationBlocked(actor, plan);
      return { ok: false, plan };
    }

    const docs = classItems(actor);
    const normalized = plan.entries.map(state => {
      const doc = docs.find(candidate => String(candidate.id) === String(state.itemId)) ?? null;
      const values = normalizeProgression(doc, state, systemRace(actor));
      return { ...state, doc, ...values };
    });
    await writeClassProgression(actor, normalized, "multiclass-item-progression-migration");
    const payload = multiclassUpdatePayload(actor);
    if (payload) {
      await actor.update(payload, {
        [INTERNAL]: true,
        add2eInternal: true,
        add2eReason: "multiclass-item-progression-summary"
      });
    }
    return { ok: true, plan, payload };
  } finally {
    migrationLocks.delete(actor.id);
  }
}

export async function ensureCanonicalMulticlassState(actor) {
  if (!actor || actor.type !== "personnage") return null;
  if (!multiclassEnabled(actor)) return null;
  const missing = classItems(actor).some(item => {
    const state = canonicalClassState(actor, item);
    return !state?.hasLevel || !state?.hasXp;
  });
  if (missing) {
    const result = await migrateLegacyMulticlassActor(actor);
    if (!result?.ok) return null;
  }
  return canonicalMulticlassEntries(actor);
}

export async function cleanupAfterMonoclassReplace(actor, keepClassDoc, keepState = null, sheet = null) {
  if (!actor || actor.type !== "personnage" || !keepClassDoc) return false;
  const desired = normalizeProgression(keepClassDoc, keepState ?? monoClassStateFromActor(actor, keepClassDoc), systemRace(actor));
  await writeClassProgression(actor, [{ doc: keepClassDoc, ...desired }], "multiclass-monoclass-keep-progression");

  const unwanted = classItems(actor).filter(doc => doc.id !== keepClassDoc.id);
  await purgeClassBoundContent(actor, unwanted, "multiclass-monoclass-purge");
  await deleteLiveEmbeddedDocuments(actor, "Item", itemIds(unwanted), {
    [INTERNAL]: true,
    add2eInternal: true,
    add2eReason: "multiclass-monoclass-delete-classes"
  });

  const payload = {
    ...monoClassCleanupPayload(),
    ...monoProgressionPayload(actor, keepClassDoc, desired)
  };
  await actor.update(payload, {
    [INTERNAL]: true,
    add2eInternal: true,
    add2eReason: "multiclass-monoclass-finalize"
  });

  try {
    await globalThis.add2eSyncActorSpellsFromClass?.(actor, keepClassDoc, { mode: "replace", showWait: true });
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
  const actor = data.actor;
  const entries = canonicalMulticlassEntries(actor).map(entry => ({
    itemId: entry.itemId,
    name: entry.name,
    slug: entry.slug,
    level: entry.level,
    xp: entry.xp,
    title: entry.title,
    nextXp: entry.nextXp,
    levelMaxRace: entry.levelMaxRace
  }));
  data.multiclass = {
    enabled: entries.length > 1,
    classes: entries,
    title: data.actor.system?.titre ?? ""
  };
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

async function refreshMulticlassSummary(actor, reason) {
  const entries = canonicalMulticlassEntries(actor).map(entry => ({ doc: entry.doc, ...entry }));
  const normalized = entries.map(entry => ({ ...entry, ...normalizeProgression(entry.doc, entry, systemRace(actor)) }));
  await writeClassProgression(actor, normalized, `${reason}:normalize-items`);
  const payload = multiclassUpdatePayload(actor);
  if (!payload) return null;
  await actor.update(payload, {
    [INTERNAL]: true,
    add2eInternal: true,
    add2eReason: reason
  });
  return payload;
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
    await refreshMulticlassSummary(actor, "multiclass-resync-existing-class");
    sheet?._add2eRememberActiveTab?.();
    sheet?.render?.(false);
    ui.notifications.info(`${itemLabel(itemData, "Classe")} est déjà présente : multiclassage recalculé.`);
    return true;
  }

  await applyRaceData(actor, option.raceData, sheet);

  if (existingDocs.length === 1) {
    const initial = monoClassStateFromActor(actor, existingDocs[0]);
    const values = normalizeProgression(existingDocs[0], initial, systemRace(actor));
    await writeClassProgression(actor, [{ doc: existingDocs[0], ...values }], "multiclass-promote-monoclass-item");
  } else if (!(await ensureCanonicalMulticlassState(actor))) {
    return false;
  }

  const data = cloneItemData(itemData);
  data.type = "classe";
  data.system = data.system ?? {};
  data.system.niveau = 1;
  data.system.xp = minXpForClassLevel(data.system, 1);
  const [created] = await actor.createEmbeddedDocuments("Item", [data], {
    [INTERNAL]: true,
    add2eInternal: true,
    add2eReason: "multiclass-add-class-create"
  });
  if (!created) return false;

  await refreshMulticlassSummary(actor, "multiclass-add-class-finalize");
  try {
    await globalThis.add2eSyncActorSpellsFromClass?.(actor, created, { mode: "append", showWait: true });
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

  if (!(await ensureCanonicalMulticlassState(actor))) return false;
  const replaced = classItems(actor).find(doc =>
    String(doc.id) === String(option.replacedClassId)
    || classSlug(doc) === norm(option.replacedClassSlug)
  );
  if (!replaced) {
    ui.notifications.error("Classe à remplacer introuvable dans l'acteur.");
    return false;
  }
  if (classItems(actor).some(doc => doc.id !== replaced.id && classSlug(doc) === classSlug(itemData))) {
    ui.notifications.warn(`${itemLabel(itemData, "Classe")} est déjà présente dans le multiclassage.`);
    return false;
  }

  await applyRaceData(actor, option.raceData, sheet);
  await purgeClassBoundContent(actor, [replaced], "multiclass-replace-purge-class-content");
  await deleteLiveEmbeddedDocuments(actor, "Item", [replaced.id], {
    [INTERNAL]: true,
    add2eInternal: true,
    add2eReason: "multiclass-replace-delete-class"
  });

  const data = cloneItemData(itemData);
  data.type = "classe";
  data.system = data.system ?? {};
  data.system.niveau = 1;
  data.system.xp = minXpForClassLevel(data.system, 1);
  const [created] = await actor.createEmbeddedDocuments("Item", [data], {
    [INTERNAL]: true,
    add2eInternal: true,
    add2eReason: "multiclass-replace-create-class"
  });
  if (!created) throw new Error("Création de la classe de remplacement impossible.");

  await refreshMulticlassSummary(actor, "multiclass-replace-finalize");
  try {
    await globalThis.add2eSyncActorSpellsFromClass?.(actor, created, { mode: "append", showWait: true });
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
  let state = existingTarget ? canonicalClassState(actor, existingTarget) : null;

  if (existing.length > 1 && !(await ensureCanonicalMulticlassState(actor))) return false;
  if (!keep) {
    const data = cloneItemData(itemData);
    data.type = "classe";
    data.system = data.system ?? {};
    data.system.niveau = Math.max(1, Math.floor(num(actor.system?.niveau, 1)));
    data.system.xp = Math.max(0, Math.floor(num(actor.system?.xp, 0)));
    const [created] = await actor.createEmbeddedDocuments("Item", [data], {
      [INTERNAL]: true,
      add2eInternal: true,
      add2eReason: "multiclass-monoclass-create-class"
    });
    if (!created) return false;
    keep = created;
    state = canonicalClassState(actor, keep);
  }

  if (!state?.hasLevel || !state?.hasXp) state = monoClassStateFromActor(actor, keep);
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
  if (!(await ensureCanonicalMulticlassState(actor))) return false;
  await applyRaceData(actor, raceData, sheet);
  await refreshMulticlassSummary(actor, "multiclass-race-refresh");
  sheet?.render?.(false);
  return true;
}

export async function recalcActor(actor) {
  if (!actor || actor.type !== "personnage" || classItems(actor).length <= 1) return null;
  if (!(await ensureCanonicalMulticlassState(actor))) return null;
  return refreshMulticlassSummary(actor, "multiclass-item-progression-recalc");
}

export { currentRaceOrCompatibleAlternatives };
