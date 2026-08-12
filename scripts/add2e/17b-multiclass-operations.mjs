// ADD2E — Multiclassage : opérations canoniques
// Les Items classe sont l'unique état de progression. L'acteur ne conserve
// que des résumés d'affichage et des métadonnées sans niveaux ni XP par classe.

import {
  INTERNAL,
  classItems,
  classProgression,
  classProgressionUpdate,
  classSlug,
  cloneItemData,
  itemLabel,
  multiclassEnabled,
  norm,
  num,
  raceSlug,
  systemRace,
  warn
} from "./17b-multiclass-core.mjs";
import {
  canonicalMulticlassEntries,
  classPrerequisitesOk,
  classRaceMaxLevel,
  classTitleForLevel,
  currentRaceOrCompatibleAlternatives,
  levelForClassXp,
  minXpForClassLevel,
  monoClassCleanupPayload,
  multiclassUpdatePayload,
  nextXpForClassLevel,
  raceCompatibleForMulticlass,
  raceMatchesClassRules,
  raceAllowsClassSet,
  splitMulticlassXp
} from "./17b-multiclass-rules.mjs";
import { dialogAlert } from "./17b-multiclass-dialogs.mjs";

const ARCANE_LEARNED_SPELL_LISTS = new Set(["magicien", "illusionniste"]);

function itemIds(items) {
  return (items ?? []).map(item => item?.id).filter(Boolean);
}

function actorHasMagicienClass(actor) {
  return classItems(actor).some(classDoc => classSlug(classDoc) === "magicien");
}

function actorHasCanonicalFamiliar(actor) {
  const link = actor?.flags?.add2e?.familiar ?? null;
  return !!(link && typeof link === "object" && link.actorId && link.linkId);
}

async function cleanupFamiliarAfterClassMutation(actor, reason) {
  if (!actor || actorHasMagicienClass(actor) || !actorHasCanonicalFamiliar(actor)) return false;
  const dissolve = globalThis.add2eDissolveFamiliar;
  if (typeof dissolve !== "function") {
    throw new Error("Le gestionnaire canonique ADD2E du familier est indisponible.");
  }
  return dissolve(actor, { reason });
}

function sourceDocumentKeys(documents) {
  const ids = new Set();
  const uuids = new Set();
  for (const document of documents ?? []) {
    const id = String(document?.id ?? "").trim();
    const uuid = String(document?.uuid ?? "").trim();
    if (id) ids.add(id);
    if (uuid) uuids.add(uuid);
  }
  return { ids, uuids };
}

function sourcePointerMatches(keys, { ids = [], uuids = [], origin = "" } = {}) {
  if ((ids ?? []).some(value => {
    const id = String(value ?? "").trim();
    return id && keys.ids.has(id);
  })) return true;
  if ((uuids ?? []).some(value => {
    const uuid = String(value ?? "").trim();
    return uuid && keys.uuids.has(uuid);
  })) return true;
  const originValue = String(origin ?? "").trim();
  if (!originValue) return false;
  return [...keys.uuids].some(uuid => originValue === uuid || originValue.startsWith(`${uuid}.`));
}

function spellSyncSources(item) {
  const resolver = globalThis.add2eSpellSyncSources;
  if (typeof resolver !== "function") {
    throw new Error("Le résolveur canonique ADD2E de provenance des sorts est indisponible.");
  }
  return resolver(item);
}

function spellHasIndependentOwnership(item) {
  const resolver = globalThis.add2eSpellSyncHasIndependentOwnership;
  if (typeof resolver !== "function") {
    throw new Error("Le résolveur canonique ADD2E de propriété indépendante des sorts est indisponible.");
  }
  return resolver(item) === true;
}

function itemBelongsToSources(item, keys) {
  if (String(item?.type ?? "").toLowerCase() === "sort") {
    return spellSyncSources(item).some(source => keys.ids.has(String(source.classItemId ?? "")));
  }
  const flags = item?.flags?.add2e ?? {};
  return sourcePointerMatches(keys, {
    ids: [flags.sourceItemId],
    uuids: [flags.sourceItemUuid]
  });
}

function effectBelongsToSources(effect, keys) {
  const flags = effect?.flags?.add2e ?? {};
  return sourcePointerMatches(keys, {
    ids: [flags.sourceItemId, flags.sourceClassItemId],
    uuids: [flags.sourceItemUuid],
    origin: effect?.origin
  });
}

function isMissingEmbeddedDocumentError(error) {
  return /ActiveEffect .* does not exist|Item .* does not exist|undefined id .* does not exist|does not exist in the EmbeddedCollection/i.test(String(error?.message ?? error ?? ""));
}

function embeddedCollection(actor, documentName) {
  return documentName === "ActiveEffect" ? actor?.effects : actor?.items;
}

function quietMutationOptions(options = {}) {
  return {
    ...options,
    [INTERNAL]: true,
    add2eInternal: true,
    add2eMulticlassInternal: true,
    render: false
  };
}

function renderOperationSheet(sheet, actor) {
  sheet?._add2eRememberActiveTab?.();
  if (globalThis.add2eDropProgressIsActive?.(actor) === true) return;
  sheet?.render?.(false);
}

async function deleteLiveEmbeddedDocuments(actor, documentName, ids, options = {}) {
  const requested = [...new Set((ids ?? []).map(id => String(id ?? "").trim()).filter(Boolean))];
  const collection = embeddedCollection(actor, documentName);
  const existing = requested.filter(id => collection?.has?.(id));
  if (!existing.length) return 0;
  const quiet = quietMutationOptions(options);
  try {
    await actor.deleteEmbeddedDocuments(documentName, existing, quiet);
    return existing.length;
  } catch (error) {
    if (!isMissingEmbeddedDocumentError(error)) throw error;
  }
  let deleted = 0;
  for (const id of existing) {
    if (!embeddedCollection(actor, documentName)?.has?.(id)) continue;
    try {
      await actor.deleteEmbeddedDocuments(documentName, [id], quiet);
      deleted += 1;
    } catch (error) {
      if (!isMissingEmbeddedDocumentError(error)) throw error;
    }
  }
  return deleted;
}

function normalizeSpellList(value) {
  const resolver = globalThis.add2eNormalizeSpellKey;
  if (typeof resolver !== "function") {
    throw new Error("Le normalisateur canonique ADD2E des listes de sorts est indisponible.");
  }
  return resolver(value);
}

function spellListsForClass(classDoc) {
  const lists = new Set();
  const casting = classDoc?.system?.spellcasting;
  if (casting && typeof casting === "object" && casting.enabled === true) {
    for (const value of Array.isArray(casting.lists) ? casting.lists : []) {
      const list = normalizeSpellList(value);
      if (list) lists.add(list);
    }
    for (const entry of Array.isArray(casting.entries) ? casting.entries : []) {
      const list = normalizeSpellList(entry?.key);
      if (list) lists.add(list);
    }
  }
  const slug = normalizeSpellList(classSlug(classDoc));
  if (ARCANE_LEARNED_SPELL_LISTS.has(slug)) lists.add(slug);
  return lists;
}

function spellListsForItem(item) {
  const resolver = globalThis.add2eGetSpellListsFromItem;
  if (typeof resolver !== "function") {
    throw new Error("Le résolveur canonique ADD2E des listes de sorts est indisponible.");
  }
  const lists = resolver(item);
  if (!Array.isArray(lists)) throw new Error(`Listes canoniques invalides pour « ${item?.name ?? "sort inconnu"} ».`);
  return new Set(lists.map(normalizeSpellList).filter(Boolean));
}

function isRegularSpellItem(item) {
  if (String(item?.type ?? "").toLowerCase() !== "sort") return false;
  if (typeof globalThis.add2eIsRegularPreparableSpell === "function") return globalThis.add2eIsRegularPreparableSpell(item) === true;
  const system = item?.system ?? {};
  const flags = item?.flags?.add2e ?? {};
  return !(system.isPower === true || system.isObjectPower === true || system.isCapacity === true || system.isCapacite === true || system.usageType === "classFeature" || system.sourceWeaponId || system.sourceCapacite || system.sourceFeature || flags.sourceType === "objet_magique" || flags.sourceType === "capacite" || flags.sourceType === "capacity");
}

function remainingClassesAfterRemoval(actor, removedDocs) {
  const removedIds = new Set(itemIds(removedDocs).map(String));
  return classItems(actor).filter(doc => !removedIds.has(String(doc?.id ?? "")));
}

function activeSpellListsForClasses(classDocs) {
  const lists = new Set();
  for (const classDoc of classDocs ?? []) for (const list of spellListsForClass(classDoc)) lists.add(list);
  return lists;
}

function arcaneListsToPurge(actor, removedDocs) {
  const removedLists = activeSpellListsForClasses(removedDocs);
  const retainedLists = activeSpellListsForClasses(remainingClassesAfterRemoval(actor, removedDocs));
  return { retainedLists, purgeLists: new Set([...removedLists].filter(list => ARCANE_LEARNED_SPELL_LISTS.has(list) && !retainedLists.has(list))) };
}

function spellStillAccessibleFromRetainedClass(item, retainedLists) {
  return [...spellListsForItem(item)].some(list => retainedLists.has(list));
}

function isLearnedArcaneSpellRemovedWithClass(item, purgeLists, retainedLists) {
  if (!isRegularSpellItem(item) || !purgeLists.size) return false;
  if (spellStillAccessibleFromRetainedClass(item, retainedLists)) return false;
  return [...spellListsForItem(item)].some(list => purgeLists.has(list));
}

async function purgeClassBoundContent(actor, classDocs, reason) {
  if (!actor || !classDocs?.length) return { items: 0, updatedItems: 0, effects: 0, arcaneLists: [] };
  const classKeys = sourceDocumentKeys(classDocs);
  const classIds = new Set(itemIds(classDocs).map(String));
  const { retainedLists, purgeLists } = arcaneListsToPurge(actor, classDocs);
  const itemIdsToDelete = new Set();
  const itemUpdates = [];

  for (const item of actor.items ?? []) {
    if (!item?.id || classIds.has(String(item.id))) continue;
    const type = String(item.type ?? "").toLowerCase();

    if (type === "sort") {
      const sources = spellSyncSources(item);
      const linkedToRemovedClass = sources.some(source => classIds.has(String(source.classItemId ?? "")));
      if (linkedToRemovedClass) {
        const remainingSources = sources.filter(source => !classIds.has(String(source.classItemId ?? "")));
        if (remainingSources.length || spellHasIndependentOwnership(item)) {
          itemUpdates.push({ _id: item.id, "flags.add2e.spellSyncSources": remainingSources });
        } else {
          itemIdsToDelete.add(item.id);
        }
      }
      if (isLearnedArcaneSpellRemovedWithClass(item, purgeLists, retainedLists)) itemIdsToDelete.add(item.id);
      continue;
    }

    if (itemBelongsToSources(item, classKeys)) itemIdsToDelete.add(item.id);
  }

  const liveUpdates = itemUpdates.filter(update => actor.items?.has?.(update._id) && !itemIdsToDelete.has(update._id));
  if (liveUpdates.length) {
    await actor.updateEmbeddedDocuments("Item", liveUpdates, quietMutationOptions({ add2eReason: `${reason}:detach-spell-sources` }));
  }

  const dependentItems = [...itemIdsToDelete]
    .map(id => actor.items?.get?.(id) ?? null)
    .filter(Boolean);
  const effectKeys = sourceDocumentKeys([...(classDocs ?? []), ...dependentItems]);
  const effectIds = Array.from(actor.effects ?? [])
    .filter(effect => effectBelongsToSources(effect, effectKeys))
    .map(effect => effect.id)
    .filter(Boolean);

  const effectCount = await deleteLiveEmbeddedDocuments(actor, "ActiveEffect", effectIds, { add2eReason: reason });
  const itemCount = await deleteLiveEmbeddedDocuments(actor, "Item", [...itemIdsToDelete], { add2eReason: reason });
  return { items: itemCount, updatedItems: liveUpdates.length, effects: effectCount, arcaneLists: [...purgeLists] };
}

function normalizeProgression(classDoc, state, raceData) {
  const maxLevel = classRaceMaxLevel(classDoc, raceData);
  let level = Math.max(1, Math.floor(num(state?.level, 1)));
  let xp = Math.max(0, Math.floor(num(state?.xp, 0)));
  if (maxLevel > 0 && level > maxLevel) level = maxLevel;
  xp = Math.max(xp, minXpForClassLevel(classDoc?.system ?? {}, level));
  return { level, xp, maxLevel };
}

function progressionForXp(classDoc, xpValue, raceData) {
  const xp = Math.max(0, Math.floor(num(xpValue, 0)));
  const derivedLevel = levelForClassXp(classDoc?.system ?? {}, xp);
  const maxLevel = classRaceMaxLevel(classDoc, raceData);
  return { level: Math.max(1, maxLevel > 0 ? Math.min(derivedLevel, maxLevel) : derivedLevel), xp, maxLevel };
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
  await actor.updateEmbeddedDocuments("Item", updates, quietMutationOptions({ add2eReason: reason }));
  return updates.length;
}

function requireClassProgression(classDoc, context = "progression de classe") {
  const state = classProgression(classDoc);
  if (!state.hasLevel || !state.hasXp) {
    throw new Error(`Item de classe « ${classDoc?.name ?? classDoc?.id ?? "inconnu"} » sans system.niveau/system.xp canonique (${context}).`);
  }
  return { level: state.level, xp: state.xp };
}

function totalClassXp(classDocs, context = "total XP") {
  return (classDocs ?? []).reduce((total, classDoc) => total + requireClassProgression(classDoc, context).xp, 0);
}

function monoProgressionPayload(actor, classDoc, state) {
  const normalized = normalizeProgression(classDoc, state, systemRace(actor));
  const classSystem = classDoc?.system ?? {};
  const classDetails = foundry.utils.deepClone(classSystem) ?? {};
  delete classDetails.niveau;
  delete classDetails.xp;
  const currentXp = minXpForClassLevel(classSystem, normalized.level);
  const nextXp = nextXpForClassLevel(classSystem, normalized.level);
  const title = classTitleForLevel(classSystem, normalized.level);
  const xpPercent = nextXp > currentXp ? Math.max(0, Math.min(100, Math.floor(((normalized.xp - currentXp) / (nextXp - currentXp)) * 100))) : 100;
  return {
    "system.classe": classDoc.name,
    "system.details_classe": { ...classDetails, name: classDoc.name, label: classDoc.system?.label || classDoc.name, slug: classSlug(classDoc), sourceItemId: classDoc.id, sourceItemUuid: classDoc.uuid },
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

export async function ensureCanonicalMulticlassState(actor) {
  if (!actor || actor.type !== "personnage" || !multiclassEnabled(actor)) return null;
  for (const classDoc of classItems(actor)) {
    requireClassProgression(classDoc, "multiclassage canonique");
  }
  return canonicalMulticlassEntries(actor);
}

async function syncClassSpells(actor, classDoc, reason) {
  const sync = globalThis.add2eSyncActorSpellsFromClass;
  if (typeof sync !== "function") return { handled: false, reason: "spell-sync-unavailable" };
  globalThis.add2eDropProgressUpdate?.(actor, `Synchronisation des sorts ${classDoc.name}…`, { progress: 72, detail: "Ajout des sorts manquants depuis le cache canonique, sans reconstruction globale." });
  return sync(actor, classDoc, { mode: "missing", showWait: false, forceCacheRefresh: false, preserveMemorization: true, render: false, add2eReason: reason });
}

async function syncRedistributedClassSpells(actor, entries, previousLevels, createdClass) {
  const lowered = (entries ?? []).filter(entry => {
    const before = Number(previousLevels?.get?.(String(entry?.doc?.id ?? "")));
    return Number.isFinite(before) && before > Number(entry?.level ?? 1);
  });
  if (lowered.length) {
    await globalThis.add2eResetActorSpellMemorization?.(actor, "multiclass-xp-redistribution");
    for (const entry of lowered) await globalThis.add2ePruneActorSpellsForClassLevel?.(actor, entry.doc, entry.level, { notify: false, render: false });
  }
  if (createdClass) await syncClassSpells(actor, createdClass, "multiclass-add-class-sync");
}

export async function refreshMonoclassSummary(actor, reason = "monoclass-item-progression-summary") {
  if (!actor || actor.type !== "personnage") return null;
  const docs = classItems(actor);
  if (docs.length !== 1) return null;
  const classDoc = docs[0];
  const desired = normalizeProgression(classDoc, requireClassProgression(classDoc, reason), systemRace(actor));
  await writeClassProgression(actor, [{ doc: classDoc, ...desired }], `${reason}:normalize-item`);
  const payload = { ...monoClassCleanupPayload(), ...monoProgressionPayload(actor, classDoc, desired) };
  await actor.update(payload, quietMutationOptions({ add2eReason: reason }));
  return payload;
}

export async function cleanupAfterMonoclassReplace(actor, keepClassDoc, keepState = null, sheet = null) {
  if (!actor || actor.type !== "personnage" || !keepClassDoc) return false;
  const desired = normalizeProgression(keepClassDoc, keepState ?? requireClassProgression(keepClassDoc, "conservation monoclassée"), systemRace(actor));
  await writeClassProgression(actor, [{ doc: keepClassDoc, ...desired }], "multiclass-monoclass-keep-progression");
  const unwanted = classItems(actor).filter(doc => doc.id !== keepClassDoc.id);
  await purgeClassBoundContent(actor, unwanted, "multiclass-monoclass-purge");
  await deleteLiveEmbeddedDocuments(actor, "Item", itemIds(unwanted), { add2eReason: "multiclass-monoclass-delete-classes" });
  const payload = { ...monoClassCleanupPayload(), ...monoProgressionPayload(actor, keepClassDoc, desired) };
  await actor.update(payload, quietMutationOptions({ add2eReason: "multiclass-monoclass-finalize" }));
  await cleanupFamiliarAfterClassMutation(actor, "multiclass-monoclass-finalize");
  try { await syncClassSpells(actor, keepClassDoc, "multiclass-mono-class-sync"); } catch (error) { warn("[MONO_SPELL_SYNC_ERROR]", { actor: actor.name, error }); }
  renderOperationSheet(sheet, actor);
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
  const entries = canonicalMulticlassEntries(data.actor).map(entry => ({ itemId: entry.itemId, name: entry.name, slug: entry.slug, level: entry.level, xp: entry.xp, title: entry.title, nextXp: entry.nextXp, levelMaxRace: entry.levelMaxRace }));
  data.multiclass = { enabled: entries.length > 1, classes: entries, title: data.actor.system?.titre ?? "" };
  data.progressionCourante = { title: data.actor.system?.titre ?? "" };
  return data;
}

export async function applyRaceData(actor, raceData, sheet = null) {
  if (!raceData) return false;
  const currentRace = systemRace(actor);
  if (currentRace && raceSlug(currentRace) === raceSlug(raceData)) return true;
  if (typeof globalThis.add2eApplyRaceItemDataToActor !== "function") throw new Error("Le gestionnaire de race canonique est introuvable.");
  await globalThis.add2eApplyRaceItemDataToActor(actor, raceData, sheet, { notify: true, reason: "multiclass-race-choice", render: false });
  return true;
}

async function refreshMulticlassSummary(actor, reason) {
  const entries = canonicalMulticlassEntries(actor).map(entry => ({ doc: entry.doc, ...entry }));
  const normalized = entries.map(entry => ({ ...entry, ...normalizeProgression(entry.doc, entry, systemRace(actor)) }));
  await writeClassProgression(actor, normalized, `${reason}:normalize-items`);
  const payload = multiclassUpdatePayload(actor);
  if (!payload) return null;
  await actor.update(payload, quietMutationOptions({ add2eReason: reason }));
  return payload;
}

export async function addClassAsMulticlass(actor, option, sheet = null) {
  const itemData = option?.classData;
  if (!actor || !itemData) return false;
  if (!raceCompatibleForMulticlass(actor, itemData, option.raceData) || !classPrerequisitesOk(actor, itemData, option.raceData, { notify: true })) return false;
  const existingDocs = classItems(actor);
  const slug = classSlug(itemData);
  if (existingDocs.some(doc => classSlug(doc) === slug)) {
    await ensureCanonicalMulticlassState(actor);
    await refreshMulticlassSummary(actor, "multiclass-resync-existing-class");
    renderOperationSheet(sheet, actor);
    ui.notifications.info(`${itemLabel(itemData, "Classe")} est déjà présente : multiclassage recalculé.`);
    return true;
  }

  const previousLevels = new Map();
  let totalXp = 0;
  if (existingDocs.length === 1) {
    const initial = requireClassProgression(existingDocs[0], "promotion monoclassée vers multiclassage");
    const values = normalizeProgression(existingDocs[0], initial, systemRace(actor));
    previousLevels.set(String(existingDocs[0].id), values.level);
    totalXp = values.xp;
    await writeClassProgression(actor, [{ doc: existingDocs[0], ...values }], "multiclass-promote-monoclass-item");
  } else {
    if (!(await ensureCanonicalMulticlassState(actor))) return false;
    for (const doc of existingDocs) {
      const state = requireClassProgression(doc, "redistribution multiclassée");
      previousLevels.set(String(doc.id), state.level);
      totalXp += state.xp;
    }
  }

  await applyRaceData(actor, option.raceData, sheet);
  const shares = splitMulticlassXp(totalXp, existingDocs.length + 1);
  const data = cloneItemData(itemData);
  data.type = "classe";
  data.system = data.system ?? {};
  const newProgression = progressionForXp(data, shares.at(-1) ?? 0, systemRace(actor));
  data.system.niveau = newProgression.level;
  data.system.xp = newProgression.xp;
  const [created] = await actor.createEmbeddedDocuments("Item", [data], quietMutationOptions({ add2eReason: "multiclass-add-class-create" }));
  if (!created) return false;

  const finalDocs = [...existingDocs.map(doc => actor.items.get(doc.id) ?? doc), created];
  const redistributed = finalDocs.map((doc, index) => ({ doc, ...progressionForXp(doc, shares[index] ?? 0, systemRace(actor)) }));
  await writeClassProgression(actor, redistributed, "multiclass-add-class-distribute-xp");
  await refreshMulticlassSummary(actor, "multiclass-add-class-finalize");
  try { await syncRedistributedClassSpells(actor, redistributed, previousLevels, created); } catch (error) { warn("[SPELL_SYNC_APPEND_ERROR]", { actor: actor.name, className: created.name, error }); }
  renderOperationSheet(sheet, actor);
  ui.notifications.info(`Multiclassage appliqué : ${created.name} avec ${itemLabel(option.raceData, "Race")}.`);
  return true;
}

export async function replaceClassInMulticlass(actor, option, sheet = null) {
  const itemData = option?.classData;
  if (!actor || !itemData || !option?.replacedClassId) return false;
  const remainingSlugs = classItems(actor)
    .filter(doc => String(doc.id) !== String(option.replacedClassId))
    .map(doc => classSlug(doc))
    .concat(classSlug(itemData));
  if (!raceAllowsClassSet(option.raceData, remainingSlugs) || !raceMatchesClassRules(option.raceData, itemData) || !classPrerequisitesOk(actor, itemData, option.raceData, { notify: true })) return false;
  if (!(await ensureCanonicalMulticlassState(actor))) return false;
  const replaced = classItems(actor).find(doc => String(doc.id) === String(option.replacedClassId)) ?? null;
  if (!replaced) { ui.notifications.error("Classe à remplacer introuvable dans l'acteur."); return false; }
  if (classItems(actor).some(doc => doc.id !== replaced.id && classSlug(doc) === classSlug(itemData))) { ui.notifications.warn(`${itemLabel(itemData, "Classe")} est déjà présente dans le multiclassage.`); return false; }
  const replacedState = requireClassProgression(replaced, "remplacement de classe multiclassée");
  const inheritedXp = replacedState.xp;
  await applyRaceData(actor, option.raceData, sheet);
  await purgeClassBoundContent(actor, [replaced], "multiclass-replace-purge-class-content");
  await deleteLiveEmbeddedDocuments(actor, "Item", [replaced.id], { add2eReason: "multiclass-replace-delete-class" });
  const data = cloneItemData(itemData);
  data.type = "classe";
  data.system = data.system ?? {};
  const derivedLevel = levelForClassXp(data.system, inheritedXp);
  const raceCap = classRaceMaxLevel(data, systemRace(actor));
  data.system.niveau = raceCap > 0 ? Math.min(derivedLevel, raceCap) : derivedLevel;
  data.system.xp = inheritedXp;
  const [created] = await actor.createEmbeddedDocuments("Item", [data], quietMutationOptions({ add2eReason: "multiclass-replace-create-class" }));
  if (!created) throw new Error("Création de la classe de remplacement impossible.");
  await refreshMulticlassSummary(actor, "multiclass-replace-finalize");
  await cleanupFamiliarAfterClassMutation(actor, "multiclass-replace-finalize");
  try { await syncClassSpells(actor, created, "multiclass-replace-class-sync"); } catch (error) { warn("[SPELL_SYNC_REPLACE_ERROR]", { actor: actor.name, className: created.name, error }); }
  renderOperationSheet(sheet, actor);
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
  if (existing.length > 1 && !(await ensureCanonicalMulticlassState(actor))) return false;
  const existingTarget = existing.find(doc => classSlug(doc) === wantedSlug) ?? null;
  let keep = existingTarget;
  let state = existingTarget ? requireClassProgression(existingTarget, "sélection monoclassée") : null;
  if (!keep) {
    const inheritedXp = existing.length ? totalClassXp(existing, "création monoclassée") : 0;
    const data = cloneItemData(itemData);
    data.type = "classe";
    data.system = data.system ?? {};
    data.system.xp = inheritedXp;
    data.system.niveau = levelForClassXp(data.system, inheritedXp);
    const [created] = await actor.createEmbeddedDocuments("Item", [data], quietMutationOptions({ add2eReason: "multiclass-monoclass-create-class" }));
    if (!created) return false;
    keep = created;
    state = requireClassProgression(keep, "classe monoclassée créée");
  }
  return cleanupAfterMonoclassReplace(actor, keep, state, sheet);
}

export async function applyRaceForMulticlass(actor, raceData, sheet = null) {
  if (!actor || classItems(actor).length <= 1) return false;
  const docs = classItems(actor);
  const allowed = docs.every(doc => raceCompatibleForMulticlass(actor, doc, raceData));
  if (!allowed) {
    await dialogAlert("ADD2E — Race incompatible", `<p>La race <b>${itemLabel(raceData, "Race")}</b> n'est pas compatible avec le multiclassage actuel.</p>`);
    return true;
  }
  if (!(await ensureCanonicalMulticlassState(actor))) return false;
  await applyRaceData(actor, raceData, sheet);
  await refreshMulticlassSummary(actor, "multiclass-race-refresh");
  renderOperationSheet(sheet, actor);
  return true;
}

export async function recalcActor(actor) {
  if (!actor || actor.type !== "personnage" || classItems(actor).length <= 1) return null;
  if (!(await ensureCanonicalMulticlassState(actor))) return null;
  return refreshMulticlassSummary(actor, "multiclass-item-progression-recalc");
}

export { currentRaceOrCompatibleAlternatives };
