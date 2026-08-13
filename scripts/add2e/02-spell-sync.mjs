// ============================================================
// ADD2E — Synchronisation automatique des sorts
// Source stricte : compendium add2e.sorts
// Compatible Foundry V13 / V14 / V15
// ============================================================

import { classItems, classProgression, classSlug } from "./17b-multiclass-core.mjs";

const ADD2E_SPELL_SYNC_VERSION = "2026-08-13-module-migration-coordination-v18";

const ADD2E_SPELL_SYNC_REQUIRED_SYSTEM_KEYS = Object.freeze([
  "nom", "classe", "spellLists", "niveau", "ecole", "portee", "duree",
  "zone_effet", "cible", "temps_incantation", "jet_sauvegarde", "composantes",
  "composants_materiels", "description", "onUse"
]);

const ADD2E_SPELL_SYNC_FIELD_ALIASES = Object.freeze({
  classe: Object.freeze(["class"]),
  spellLists: Object.freeze(["lists", "liste", "liste_sort", "listeSort"]),
  niveau: Object.freeze(["level", "niveau_sort", "spellLevel"]),
  ecole: Object.freeze(["école", "school"]),
  portee: Object.freeze(["portée", "range"]),
  duree: Object.freeze(["durée", "duration"]),
  zone_effet: Object.freeze(["zoneEffet", "area", "areaOfEffect"]),
  cible: Object.freeze(["target", "targets"]),
  temps_incantation: Object.freeze(["tempsIncantation", "castingTime", "casting_time"]),
  jet_sauvegarde: Object.freeze(["jetSauvegarde", "savingThrow", "saving_throw"]),
  composantes: Object.freeze(["components", "componentes", "composants"]),
  composants_materiels: Object.freeze(["materialComponents", "material_components"]),
  description: Object.freeze(["description_reelle", "description_texte", "description_html"]),
  onUse: Object.freeze(["onuse", "on_use"])
});

const ADD2E_SPELL_SYNC_FIELD_ALIAS_KEYS = Object.freeze([
  ...new Set(Object.values(ADD2E_SPELL_SYNC_FIELD_ALIASES).flat())
]);

const ADD2E_SPELL_SYNC_LEGACY_SYSTEM_KEYS = Object.freeze([
  "type", "onUseCode", "tags", "effectTags", "effecttags",
  "composants_materiels_objets", "composants_materiels_source",
  "composants_materiels_reference", "composants_materiels_verification_recommandee",
  "composants_materiels_note", "composants_materiels_a_renseigner"
]);

const ADD2E_SPELL_SYNC_LEGACY_FLAG_KEYS = Object.freeze([
  "autoGrantedByClass",
  "autoGrantedByClassId",
  "sourceClassId",
  "classSlug",
  "autoGrantedSpellSync",
  "autoGrantedSpellLists",
  "grantedSpellLists",
  "autoGrantedAtActorLevel",
  "spellListsResolved"
]);

const ADD2E_SPELL_SYNC_PREUPDATE_LEVELS = new Map();
const ADD2E_SPELL_SYNC_RUNNING = new Set();
let ADD2E_SPELL_SYNC_CACHE = null;
let ADD2E_SPELL_SYNC_OWNERSHIP_MIGRATION = null;

const ADD2E_SPELL_SYNC_AUTO_CLASS_SLUGS = new Set(["clerc", "druide", "ranger", "paladin"]);

function add2eSpellSyncMutationOptions(extra = {}) {
  return {
    ...extra,
    add2eInternal: true,
    add2eMulticlassInternal: true,
    add2eSpellSync: true,
    render: false
  };
}

async function add2eSpellSyncUpdateActor(actor, updates, reason) {
  if (!actor?.update || !updates || !Object.keys(updates).length) return null;
  return actor.update(updates, add2eSpellSyncMutationOptions({ add2eReason: reason }));
}

function add2eSpellSyncClone(value) {
  if (value === undefined || value === null) return value;
  if (foundry?.utils?.deepClone) return foundry.utils.deepClone(value);
  if (foundry?.utils?.duplicate) return foundry.utils.duplicate(value);
  return JSON.parse(JSON.stringify(value));
}

function add2eSpellSyncForcedDeletion() {
  const deletion = foundry?.data?.operators?.ForcedDeletion;
  if (!deletion) throw new Error("[ADD2E] FoundryData ForcedDeletion est indisponible pour la migration des sorts.");
  return deletion;
}

function add2eSpellSyncMaybeJson(value) {
  if (typeof value !== "string") return value;
  const source = value.trim();
  if (!source) return value;
  if ((source.startsWith("{") && source.endsWith("}")) || (source.startsWith("[") && source.endsWith("]"))) {
    try { return JSON.parse(source); }
    catch (_error) { return value; }
  }
  return value;
}

function add2eSpellSyncNormalize(value) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/\s*\([^)]*\)\s*$/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  const aliases = {
    cleric: "clerc", clerical: "clerc", clercs: "clerc", priest: "clerc", priests: "clerc", pretre: "clerc", pretres: "clerc",
    paladin: "clerc",
    druid: "druide", druids: "druide", druides: "druide", druidique: "druide",
    wizard: "magicien", mage: "magicien", magician: "magicien", magic_user: "magicien",
    illusionist: "illusionniste"
  };
  return aliases[normalized] ?? normalized;
}

function add2eSpellSyncArray(value) {
  value = add2eSpellSyncMaybeJson(value);
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(add2eSpellSyncArray);
  if (typeof value === "string") return value.split(/[,;|\n]+/).map(entry => entry.trim()).filter(Boolean);
  return [value];
}

function add2eSpellSyncNumber(value, fallback = 0) {
  value = add2eSpellSyncMaybeJson(value);
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function add2eSpellSyncHasFieldValue(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function add2eSpellSyncSameValue(left, right) {
  try { return JSON.stringify(left) === JSON.stringify(right); }
  catch (_error) { return left === right; }
}

function add2eSpellSyncCanonicalizeSystemAliases(system = {}, { owner = "", logConflicts = false } = {}) {
  const clean = add2eSpellSyncClone(system && typeof system === "object" ? system : {}) ?? {};

  for (const [canonical, aliases] of Object.entries(ADD2E_SPELL_SYNC_FIELD_ALIASES)) {
    const canonicalPresent = add2eSpellSyncHasFieldValue(clean[canonical]);
    let migratedValue;
    for (const alias of aliases) {
      if (!Object.prototype.hasOwnProperty.call(clean, alias)) continue;
      const aliasValue = clean[alias];
      if (!canonicalPresent && migratedValue === undefined && add2eSpellSyncHasFieldValue(aliasValue)) {
        migratedValue = add2eSpellSyncClone(aliasValue);
      } else if (canonicalPresent && add2eSpellSyncHasFieldValue(aliasValue) && !add2eSpellSyncSameValue(clean[canonical], aliasValue) && logConflicts) {
        console.warn("[ADD2E][SPELL_SYNC][FIELD_ALIAS_CONFLICT]", {
          owner,
          canonical,
          alias,
          kept: clean[canonical],
          discarded: aliasValue
        });
      }
      delete clean[alias];
    }
    if (!canonicalPresent && migratedValue !== undefined) clean[canonical] = migratedValue;
  }

  clean.spellLists = add2eSpellSyncArray(clean.spellLists);
  clean.composants_materiels = add2eSpellSyncArray(clean.composants_materiels);
  return clean;
}

function add2eSpellSyncLegacySystemUpdate(item) {
  const source = item?.system ?? {};
  const canonical = add2eSpellSyncCanonicalizeSystemAliases(source, {
    owner: item?.name ?? item?.id ?? "Sort",
    logConflicts: true
  });
  const update = {};

  for (const key of Object.keys(ADD2E_SPELL_SYNC_FIELD_ALIASES)) {
    if (!add2eSpellSyncSameValue(source[key], canonical[key])) update[`system.${key}`] = add2eSpellSyncClone(canonical[key]);
  }
  for (const key of ["spellLists", "composants_materiels"]) {
    if (!add2eSpellSyncSameValue(source[key], canonical[key])) update[`system.${key}`] = add2eSpellSyncClone(canonical[key]);
  }
  for (const alias of ADD2E_SPELL_SYNC_FIELD_ALIAS_KEYS) {
    if (Object.prototype.hasOwnProperty.call(source, alias)) update[`system.${alias}`] = add2eSpellSyncForcedDeletion();
  }
  return update;
}

function add2eSpellSyncIsPlaceholder(value) {
  return typeof value === "string" && /a[_\s-]*comple/i.test(value);
}

function add2eSpellSyncCleanPlaceholders(value) {
  if (add2eSpellSyncIsPlaceholder(value)) return "";
  if (Array.isArray(value)) return value.map(add2eSpellSyncCleanPlaceholders)
    .filter(entry => entry !== "" && entry !== null && entry !== undefined);
  if (value && typeof value === "object") {
    const copy = add2eSpellSyncClone(value);
    for (const [key, entry] of Object.entries(copy)) copy[key] = add2eSpellSyncCleanPlaceholders(entry);
    return copy;
  }
  return value;
}

function add2eSpellSyncValidateCanonicalData(data) {
  const system = data?.system ?? {};
  const missing = ADD2E_SPELL_SYNC_REQUIRED_SYSTEM_KEYS.filter(key => !Object.prototype.hasOwnProperty.call(system, key));
  if (missing.length) console.warn("[ADD2E][SPELL_SYNC][CANONICAL_FIELDS_MISSING]", { name: data?.name, missing });
  return { valid: true, missing };
}

function add2eSpellSyncPrepareCompendiumData(data) {
  const clean = add2eSpellSyncCleanPlaceholders(add2eSpellSyncClone(data));
  clean.system = add2eSpellSyncCanonicalizeSystemAliases(clean.system ?? {}, {
    owner: clean.name ?? clean.system?.nom ?? "Sort",
    logConflicts: true
  });
  clean.type = "sort";
  clean.name ||= clean.system.nom || "Sort";
  clean.img ||= "icons/svg/book.svg";
  clean.flags ??= {};
  clean.flags.add2e ??= {};
  delete clean.flags.add2e.memorizedCount;
  delete clean.flags.add2e.memorizedByList;
  delete clean.flags.add2e.spellSyncSources;
  for (const key of ADD2E_SPELL_SYNC_LEGACY_FLAG_KEYS) delete clean.flags.add2e[key];

  for (const key of ADD2E_SPELL_SYNC_LEGACY_SYSTEM_KEYS) delete clean.system[key];

  const level = Number(clean.system.niveau);
  if (Number.isFinite(level) && level > 0) clean.system.niveau = Math.floor(level);

  add2eSpellSyncValidateCanonicalData(clean);
  return clean;
}

function add2eSpellSyncSanitizeData(data) {
  return add2eSpellSyncPrepareCompendiumData(data);
}

function add2eSpellSyncClassItems(actor) {
  return classItems(actor);
}

function add2eSpellSyncClassSlug(classItem) {
  return classSlug(classItem);
}

function add2eSpellSyncClassIdentityForItem(classItem) {
  return classSlug(classItem);
}

function add2eSpellSyncRangerDruidEntry(classItem) {
  if (add2eSpellSyncClassIdentityForItem(classItem) !== "ranger") return null;
  const casting = classItem?.system?.spellcasting;
  if (!casting || typeof casting !== "object" || casting.enabled !== true) return null;
  const entries = Array.isArray(casting.entries) ? casting.entries : [];
  const entry = entries.find(candidate => add2eSpellSyncNormalize(candidate?.key) === "druide") ?? null;
  if (!entry) return null;
  return {
    key: "druide",
    startsAt: Math.max(1, Number(entry.startsAt) || 1),
    maxSpellLevel: Math.max(1, Number(entry.maxSpellLevel) || 1),
    preparationSource: String(entry.preparationSource ?? "").trim()
  };
}

function add2eSpellSyncIsAutoSyncedClass(classItem) {
  const identity = add2eSpellSyncClassIdentityForItem(classItem);
  if (!ADD2E_SPELL_SYNC_AUTO_CLASS_SLUGS.has(identity)) return false;
  return identity !== "ranger" || !!add2eSpellSyncRangerDruidEntry(classItem);
}

function add2eSpellSyncClassLists(classItem) {
  if (!add2eSpellSyncIsAutoSyncedClass(classItem)) return [];
  const identity = add2eSpellSyncClassIdentityForItem(classItem);
  if (identity === "ranger") return ["druide"];
  const casting = classItem?.system?.spellcasting;
  if (!casting || typeof casting !== "object" || casting.enabled !== true) return [];
  return [...new Set(add2eSpellSyncArray(casting.lists).map(add2eSpellSyncNormalize).filter(Boolean))];
}

function add2eSpellSyncSpellLevel(system = {}) {
  const level = Number(system.niveau);
  return Number.isFinite(level) && level > 0 ? Math.floor(level) : 0;
}

function add2eSpellSyncSpellLists(system = {}) {
  return [...new Set(add2eSpellSyncArray(system.spellLists).map(add2eSpellSyncNormalize).filter(Boolean))];
}

function add2eSpellSyncStableKey(name, system = {}, listOverride = "") {
  const spellName = add2eSpellSyncNormalize(name ?? system.nom ?? "");
  const level = add2eSpellSyncSpellLevel(system);
  const lists = listOverride ? [listOverride] : add2eSpellSyncSpellLists(system);
  const listKey = [...new Set(lists.map(add2eSpellSyncNormalize).filter(Boolean))].sort().join("+") || "liste_inconnue";
  return `${listKey}|${level}|${spellName}`;
}

function add2eSpellSyncIdentityKey(name, system = {}) {
  const spellName = add2eSpellSyncNormalize(name ?? system.nom ?? "");
  const level = add2eSpellSyncSpellLevel(system);
  return spellName && level > 0 ? `${level}|${spellName}` : "";
}

function add2eSpellSyncUnionLists(...values) {
  return [...new Set(values
    .flatMap(value => add2eSpellSyncArray(value))
    .map(add2eSpellSyncNormalize)
    .filter(Boolean))];
}

function add2eSpellSyncSources(item) {
  const raw = item?.flags?.add2e?.spellSyncSources;
  if (!Array.isArray(raw)) return [];
  const byClass = new Map();
  for (const source of raw) {
    const classItemId = String(source?.classItemId ?? "").trim();
    if (!classItemId) continue;
    const spellLists = add2eSpellSyncUnionLists(source?.spellLists);
    const actorLevelValue = Number(source?.actorLevel);
    const actorLevel = Number.isInteger(actorLevelValue) && actorLevelValue >= 1 ? actorLevelValue : 0;
    byClass.set(classItemId, { classItemId, spellLists, actorLevel });
  }
  return [...byClass.values()];
}

function add2eSpellSyncSourceRecord(classItem, classLists, actorLevel) {
  const classItemId = String(classItem?.id ?? "").trim();
  if (!classItemId) throw new Error("Identifiant canonique de l’Item classe absent pour la provenance des sorts.");
  const level = Number(actorLevel);
  if (!Number.isInteger(level) || level < 1) {
    throw new Error(`Niveau canonique invalide pour la provenance des sorts de « ${classItem?.name ?? classItemId} ».`);
  }
  return {
    classItemId,
    spellLists: add2eSpellSyncUnionLists(classLists),
    actorLevel: level
  };
}

function add2eSpellSyncSourcesWithClass(item, classItem, classLists, actorLevel) {
  const source = add2eSpellSyncSourceRecord(classItem, classLists, actorLevel);
  const sources = add2eSpellSyncSources(item).filter(entry => entry.classItemId !== source.classItemId);
  sources.push(source);
  return sources;
}

function add2eSpellSyncSourcesWithoutClass(item, classItemOrId) {
  const classItemId = String(classItemOrId?.id ?? classItemOrId ?? "").trim();
  return add2eSpellSyncSources(item).filter(source => source.classItemId !== classItemId);
}

function add2eSpellSyncSpellBelongsToClass(item, classItem) {
  const classItemId = String(classItem?.id ?? "").trim();
  return Boolean(classItemId) && add2eSpellSyncSources(item).some(source => source.classItemId === classItemId);
}

function add2eSpellSyncHasIndependentOwnership(item) {
  return item?.flags?.add2e?.manuallyLearnedSpell === true;
}

function add2eSpellSyncCacheKeySet(cache) {
  return new Set((cache?.entries ?? []).map(entry => entry.stableKey).filter(Boolean));
}

function add2eSpellSyncIsCompendiumOwnedActorSpell(item) {
  return add2eSpellSyncSources(item).length > 0;
}

function add2eSpellSyncExistingKeys(actor, cache = null, options = {}) {
  const keys = new Set();
  const compendiumKeys = cache ? add2eSpellSyncCacheKeySet(cache) : null;
  for (const item of actor?.items?.filter?.(entry => String(entry?.type ?? "").toLowerCase() === "sort") ?? []) {
    const key = add2eSpellSyncStableKey(item.name, item.system ?? {});
    if (!key) continue;
    if (options.sourceTruth === true && compendiumKeys?.has(key) && !add2eSpellSyncIsCompendiumOwnedActorSpell(item)) continue;
    keys.add(key);
  }
  return keys;
}

function add2eSpellSyncMemorizationSnapshot(item) {
  const rawByList = item?.getFlag?.("add2e", "memorizedByList") ?? item?.flags?.add2e?.memorizedByList ?? {};
  const byList = rawByList && typeof rawByList === "object" && !Array.isArray(rawByList)
    ? add2eSpellSyncClone(rawByList)
    : {};
  return { byList };
}

function add2eSpellSyncLevelSignature(actor) {
  const signature = {};
  for (const classItem of add2eSpellSyncClassItems(actor)) {
    const progression = classProgression(classItem);
    if (!progression.hasLevel) {
      throw new Error(`Niveau canonique absent sur l’Item classe « ${classItem?.name ?? classItem?.id ?? "inconnu"} ».`);
    }
    signature[String(classItem.id)] = progression.level;
  }
  return signature;
}

function add2eSpellSyncHasLevelDecrease(previous = {}, current = {}) {
  return Object.entries(previous ?? {}).some(([key, oldValue]) => Number.isFinite(Number(oldValue)) && Number.isFinite(Number(current?.[key])) && Number(current[key]) < Number(oldValue));
}

function add2eSpellSyncGetPreviousSignature(actor) {
  const key = actor?.uuid || actor?.id;
  return (key ? ADD2E_SPELL_SYNC_PREUPDATE_LEVELS.get(key) : null)
    ?? actor?.getFlag?.("add2e", "autoSpellSyncLevelSignature")
    ?? null;
}

async function add2eSpellSyncSetLevelSignature(actor, signature) {
  return add2eSpellSyncUpdateActor(actor, {
    "flags.add2e.autoSpellSyncLevelSignature": signature ?? add2eSpellSyncLevelSignature(actor)
  }, "spell-sync-level-signature");
}

async function add2eResetActorSpellMemorization(actor, reason = "level-down") {
  if (!actor?.items || actor.type !== "personnage") return { reset: 0 };
  const updates = [];
  for (const sort of actor.items.filter(item => String(item?.type ?? "").toLowerCase() === "sort")) {
    const snapshot = add2eSpellSyncMemorizationSnapshot(sort);
    if (!Object.values(snapshot.byList).some(value => Number(value) > 0)) continue;
    updates.push({
      _id: sort.id,
      "flags.add2e.memorizedByList": {}
    });
  }
  if (updates.length) await actor.updateEmbeddedDocuments("Item", updates, add2eSpellSyncMutationOptions({ add2eReason: reason }));
  if (updates.length) console.info("[ADD2E][SPELL_SYNC][MEMORIZED_RESET]", { actor: actor.name, reason, reset: updates.length });
  return { reset: updates.length };
}

function add2eSpellSyncPreparationApi() {
  if (typeof globalThis.add2eGetSpellcastingEntries !== "function"
    || typeof globalThis.add2eGetSlotsForEntryLevel !== "function"
    || typeof globalThis.add2eSpellClassLevel !== "function") {
    throw new Error("Le moteur canonique de préparation des sorts ADD2E est indisponible.");
  }
  return {
    entries: globalThis.add2eGetSpellcastingEntries,
    slots: globalThis.add2eGetSlotsForEntryLevel,
    classLevel: globalThis.add2eSpellClassLevel
  };
}

function add2eSpellSyncClassSources(actor, classItem, classLists = []) {
  const api = add2eSpellSyncPreparationApi();
  const wanted = new Set((classLists ?? []).map(add2eSpellSyncNormalize).filter(Boolean));
  const sources = [];
  for (const entry of api.entries(actor)) {
    const key = add2eSpellSyncNormalize(entry?.key);
    if (wanted.size && !wanted.has(key)) continue;
    for (const source of entry?.sources ?? []) {
      if (String(source?.classItemId ?? "") !== String(classItem?.id ?? "")) continue;
      sources.push(source);
    }
  }
  return sources;
}

function add2eSpellSyncMaxSpellLevel(actor, classItem) {
  const classLists = add2eSpellSyncClassLists(classItem);
  if (!classLists.length) return 0;
  const api = add2eSpellSyncPreparationApi();
  let highest = 0;
  for (const source of add2eSpellSyncClassSources(actor, classItem, classLists)) {
    const maximum = Math.max(0, Number(source?.maxSpellLevel) || 0);
    for (let level = 1; level <= maximum; level += 1) {
      if (api.slots(actor, source, level) > 0) highest = Math.max(highest, level);
    }
  }
  return highest;
}

function add2eSpellSyncClassLevel(actor, classItem = null) {
  const api = add2eSpellSyncPreparationApi();
  const level = Number(api.classLevel(actor, classItem));
  if (!Number.isInteger(level) || level < 1) {
    throw new Error(`Niveau canonique invalide pour la classe « ${classItem?.name ?? classItem?.id ?? "inconnue"} ».`);
  }
  return level;
}

function add2eSpellSyncCanUseSpellLevel(actor, classItem, classLists, spellLevel) {
  const level = Number(spellLevel) || 0;
  if (level < 1) return false;
  const api = add2eSpellSyncPreparationApi();
  return add2eSpellSyncClassSources(actor, classItem, classLists)
    .some(source => api.slots(actor, source, level) > 0);
}

function add2eSpellSyncMaxExistingLevel(actor, classLists = []) {
  const wanted = new Set((classLists ?? []).map(add2eSpellSyncNormalize).filter(Boolean));
  let max = 0;
  for (const item of actor?.items?.filter?.(entry => String(entry?.type ?? "").toLowerCase() === "sort") ?? []) {
    const lists = add2eSpellSyncSpellLists(item.system ?? {});
    if (wanted.size && lists.length && !lists.some(list => wanted.has(list))) continue;
    max = Math.max(max, add2eSpellSyncSpellLevel(item.system ?? {}));
  }
  return max;
}

function add2eSpellSyncGetLastMax(actor) {
  return Number(actor?.getFlag?.("add2e", "autoSpellSyncMaxLevel") ?? 0) || 0;
}

async function add2eSpellSyncSetLastMax(actor, value) {
  return add2eSpellSyncUpdateActor(actor, {
    "flags.add2e.autoSpellSyncMaxLevel": Math.max(0, Number(value) || 0)
  }, "spell-sync-max-level");
}

function add2eSpellSyncOpenWaitMessage({ classItem, maxSpellLevel } = {}) {
  ui.notifications.info(`Synchronisation des sorts ${classItem?.name ?? ""} jusqu'au niveau ${maxSpellLevel}...`);
  return null;
}

function add2eSpellSyncCloseWaitMessage(_dialog) {}

function add2eSpellSyncMatchesClassLists(sortOrSystem, classLists = []) {
  const system = sortOrSystem?.system ?? sortOrSystem ?? {};
  const wanted = new Set((classLists ?? []).map(add2eSpellSyncNormalize).filter(Boolean));
  if (!wanted.size) return false;
  return add2eSpellSyncSpellLists(system).some(list => wanted.has(list));
}

function add2eSpellSyncBuildCacheKey(pack) {
  return String(pack?.collection || pack?.metadata?.id || "add2e.sorts");
}

function add2eInvalidateSpellSyncCache() {
  ADD2E_SPELL_SYNC_CACHE = null;
}

async function add2eBuildSpellSyncCache({ force = false } = {}) {
  const pack = game.packs?.get?.("add2e.sorts");
  if (!pack) throw new Error("Compendium de sorts introuvable : add2e.sorts");
  const cacheKey = add2eSpellSyncBuildCacheKey(pack);
  const existing = ADD2E_SPELL_SYNC_CACHE;
  if (!force && existing?.cacheKey === cacheKey && Array.isArray(existing.entries) && existing.entries.length) return existing;

  const documents = await pack.getDocuments();
  const entries = [];
  const byStableKey = new Map();
  const duplicateKeys = [];
  const skipped = [];
  let nonSortDocuments = 0;
  let validationWarnings = 0;

  for (const document of documents) {
    if (!document || document.type !== "sort") { nonSortDocuments += 1; continue; }
    const data = add2eSpellSyncPrepareCompendiumData(document.toObject());
    const validation = add2eSpellSyncValidateCanonicalData(data);
    if (validation.missing.length) validationWarnings += 1;

    const level = add2eSpellSyncSpellLevel(data.system ?? {});
    const lists = add2eSpellSyncSpellLists(data.system ?? {});
    const stableKey = add2eSpellSyncStableKey(data.name, data.system ?? {});
    if (!stableKey || level < 1 || !lists.length) {
      skipped.push({ name: data.name, level, lists, reason: "invalid-compendium-entry" });
      continue;
    }

    if (byStableKey.has(stableKey)) {
      const kept = byStableKey.get(stableKey);
      kept.lists = add2eSpellSyncUnionLists(kept.lists, lists);
      foundry.utils.setProperty(kept.data, "system.spellLists", kept.lists);
      duplicateKeys.push({ key: stableKey, kept: kept.name, merged: data.name });
      continue;
    }

    delete data._id;
    data.folder = null;
    foundry.utils.setProperty(data, "system.spellLists", lists);
    foundry.utils.setProperty(data, "flags.add2e.stableSpellKey", stableKey);
    const entry = { name: data.name, img: data.img, type: data.type, level, lists, stableKey, data };
    byStableKey.set(stableKey, entry);
    entries.push(entry);
  }

  entries.sort((left, right) => left.level - right.level || String(left.name).localeCompare(String(right.name), "fr") || left.stableKey.localeCompare(right.stableKey, "fr"));
  const cache = {
    cacheKey,
    builtAt: Date.now(),
    entries,
    count: entries.length,
    docsCount: documents.length,
    nonSortDocuments,
    duplicateCount: duplicateKeys.length,
    duplicateKeys,
    skippedCount: skipped.length,
    skipped,
    sanitizedDocuments: 0,
    validationWarnings,
    byStableKey
  };
  ADD2E_SPELL_SYNC_CACHE = cache;
  console.info("[ADD2E][SPELL_SYNC][CACHE_READY]", { version: ADD2E_SPELL_SYNC_VERSION, entries: entries.length, duplicateCount: duplicateKeys.length, skipped: skipped.length, validationWarnings });
  return cache;
}

async function add2eWarmSpellSyncCache() {
  return add2eBuildSpellSyncCache({ force: false });
}

async function add2eReloadSpellSyncCache() {
  add2eInvalidateSpellSyncCache();
  return add2eBuildSpellSyncCache({ force: true });
}

function add2eSpellSyncSourceRemovalUpdate(item, classItem) {
  return {
    _id: item.id,
    "flags.add2e.spellSyncSources": add2eSpellSyncSourcesWithoutClass(item, classItem)
  };
}

async function add2ePruneActorSpellsForClassLevel(actor, classItem, actorLevel, options = {}) {
  if (!actor || !classItem || classItem.type !== "classe") return { handled: false, deleted: 0, updated: 0, maxSpellLevel: 0 };
  const classLists = add2eSpellSyncClassLists(classItem);
  if (!classLists.length) return { handled: false, deleted: 0, updated: 0, maxSpellLevel: 0 };
  const level = Number(actorLevel ?? add2eSpellSyncClassLevel(actor, classItem));
  if (!Number.isInteger(level) || level < 1) throw new Error(`Niveau canonique invalide pour « ${classItem.name} ».`);
  const maxSpellLevel = add2eSpellSyncMaxSpellLevel(actor, classItem);
  const ids = [];
  const updates = [];
  for (const sort of actor.items?.filter?.(item => String(item?.type ?? "").toLowerCase() === "sort") ?? []) {
    if (!add2eSpellSyncSpellBelongsToClass(sort, classItem)) continue;
    if (!add2eSpellSyncMatchesClassLists(sort.system ?? {}, classLists)) continue;
    if (add2eSpellSyncCanUseSpellLevel(actor, classItem, classLists, add2eSpellSyncSpellLevel(sort.system ?? {}))) continue;
    const remainingSources = add2eSpellSyncSourcesWithoutClass(sort, classItem);
    if (remainingSources.length || add2eSpellSyncHasIndependentOwnership(sort)) updates.push(add2eSpellSyncSourceRemovalUpdate(sort, classItem));
    else ids.push(sort.id);
  }
  const existing = ids.filter(id => actor.items.has(id));
  if (existing.length) await actor.deleteEmbeddedDocuments("Item", existing, add2eSpellSyncMutationOptions({ add2eReason: "spell-level-prune" }));
  const liveUpdates = updates.filter(update => actor.items.has(update._id));
  if (liveUpdates.length) await actor.updateEmbeddedDocuments("Item", liveUpdates, add2eSpellSyncMutationOptions({ add2eReason: "spell-level-prune-source-detach" }));
  await add2eSpellSyncSetLastMax(actor, maxSpellLevel);
  if (options.notify !== false && (existing.length || liveUpdates.length)) {
    ui.notifications.info(`Sorts non accessibles retirés : ${existing.length}; sources détachées : ${liveUpdates.length}.`);
  }
  return { handled: true, deleted: existing.length, updated: liveUpdates.length, maxSpellLevel, actorLevel: level };
}

function add2eSpellSyncActorSpellKeyMap(actor) {
  const result = new Map();
  for (const item of actor?.items?.filter?.(entry => String(entry?.type ?? "").toLowerCase() === "sort") ?? []) {
    const key = add2eSpellSyncStableKey(item.name, item.system ?? {});
    if (!key) continue;
    if (!result.has(key)) result.set(key, []);
    result.get(key).push(item);
  }
  return result;
}

function add2eSpellSyncActorSpellIdentityMap(actor) {
  const result = new Map();
  for (const item of actor?.items?.filter?.(entry => String(entry?.type ?? "").toLowerCase() === "sort") ?? []) {
    if (item?.flags?.add2e?.spellFamily?.generated === true) continue;
    const key = add2eSpellSyncIdentityKey(item.name, item.system ?? {});
    if (!key) continue;
    if (!result.has(key)) result.set(key, []);
    result.get(key).push(item);
  }
  return result;
}

function add2eSpellSyncMergeUpdate(item, entry, classItem, classLists, actorLevel) {
  const systemLists = add2eSpellSyncUnionLists(add2eSpellSyncSpellLists(item.system ?? {}), entry.lists);
  const nextSystem = { ...(item.system ?? {}), spellLists: systemLists };
  return {
    _id: item.id,
    "system.spellLists": systemLists,
    "flags.add2e.spellSyncSources": add2eSpellSyncSourcesWithClass(item, classItem, classLists, actorLevel),
    "flags.add2e.stableSpellKey": add2eSpellSyncStableKey(item.name, nextSystem)
  };
}

function add2eSpellSyncCollapseSelectedEntries(entries = []) {
  const byIdentity = new Map();
  for (const sourceEntry of entries) {
    const identity = add2eSpellSyncIdentityKey(sourceEntry.name, sourceEntry.data?.system ?? {});
    if (!identity) continue;
    const prior = byIdentity.get(identity);
    if (!prior) {
      byIdentity.set(identity, {
        ...sourceEntry,
        data: add2eSpellSyncClone(sourceEntry.data),
        lists: [...sourceEntry.lists]
      });
      continue;
    }
    prior.lists = add2eSpellSyncUnionLists(prior.lists, sourceEntry.lists);
    prior.data.system ??= {};
    prior.data.system.spellLists = [...prior.lists];
    prior.stableKey = add2eSpellSyncStableKey(prior.name, prior.data.system);
  }
  return [...byIdentity.values()];
}

async function add2eSyncActorSpellsFromClass(actor, classItem, options = {}) {
  if (!actor || !classItem || classItem.type !== "classe") return { handled: false, imported: 0, updated: 0, deleted: 0 };
  const requestedMode = String(options.mode ?? "replace").toLowerCase();
  const mode = ["replace", "missing", "append"].includes(requestedMode) ? requestedMode : "replace";
  const classLists = add2eSpellSyncClassLists(classItem);
  if (!classLists.length) return { handled: false, imported: 0, updated: 0, deleted: 0, reason: "not-auto-synced-class" };

  const actorLevel = Number(options.actorLevel ?? add2eSpellSyncClassLevel(actor, classItem));
  if (!Number.isInteger(actorLevel) || actorLevel < 1) throw new Error(`Niveau canonique invalide pour « ${classItem.name} ».`);
  const maxSpellLevel = add2eSpellSyncMaxSpellLevel(actor, classItem);
  const minSpellLevel = Math.max(1, Number(options.minSpellLevel ?? 1) || 1);
  const waitDialog = options.showWait !== false ? add2eSpellSyncOpenWaitMessage({ actor, classItem, mode, minSpellLevel, maxSpellLevel }) : null;

  try {
    const cache = await add2eBuildSpellSyncCache({ force: options.forceCacheRefresh === true });
    if (!cache.entries.length) {
      ui.notifications.error("Aucun sort trouvé dans add2e.sorts.");
      return { handled: true, imported: 0, updated: 0, deleted: 0, maxSpellLevel, error: "empty-cache" };
    }
    if (maxSpellLevel < 1 || minSpellLevel > maxSpellLevel) {
      await add2eSpellSyncSetLastMax(actor, maxSpellLevel);
      return { handled: true, imported: 0, updated: 0, deleted: 0, maxSpellLevel, mode };
    }

    const wanted = new Set(classLists.map(add2eSpellSyncNormalize));
    const selectedByStableKey = new Map();
    for (const entry of cache.entries) {
      if (entry.level < minSpellLevel) continue;
      if (!add2eSpellSyncCanUseSpellLevel(actor, classItem, classLists, entry.level)) continue;
      if (!entry.lists.some(list => wanted.has(list))) continue;
      if (!selectedByStableKey.has(entry.stableKey)) selectedByStableKey.set(entry.stableKey, entry);
    }
    const selected = add2eSpellSyncCollapseSelectedEntries([...selectedByStableKey.values()]);
    const selectedByIdentity = new Map(selected.map(entry => [add2eSpellSyncIdentityKey(entry.name, entry.data?.system ?? {}), entry]));

    const memories = new Map();
    const idsToDelete = new Set();
    const updateById = new Map();
    const consumedIdentities = new Set();
    const actorSpellsByIdentity = add2eSpellSyncActorSpellIdentityMap(actor);

    const queueUpdate = update => {
      if (!update?._id) return;
      updateById.set(String(update._id), update);
    };

    if (mode === "replace") {
      for (const item of actor.items.filter(entry => String(entry?.type ?? "").toLowerCase() === "sort")) {
        if (!add2eSpellSyncSpellBelongsToClass(item, classItem)) continue;
        const identity = add2eSpellSyncIdentityKey(item.name, item.system ?? {});
        const expected = identity ? selectedByIdentity.get(identity) ?? null : null;
        const remainingSources = add2eSpellSyncSourcesWithoutClass(item, classItem);
        const independentlyOwned = add2eSpellSyncHasIndependentOwnership(item);

        if (expected && (remainingSources.length || independentlyOwned)) {
          queueUpdate(add2eSpellSyncMergeUpdate(item, expected, classItem, classLists, actorLevel));
          consumedIdentities.add(identity);
          continue;
        }

        if (!expected && (remainingSources.length || independentlyOwned)) {
          queueUpdate(add2eSpellSyncSourceRemovalUpdate(item, classItem));
          continue;
        }

        if (identity) memories.set(identity, add2eSpellSyncMemorizationSnapshot(item));
        idsToDelete.add(item.id);
      }
    }

    const creates = [];
    for (const entry of selected) {
      const identity = add2eSpellSyncIdentityKey(entry.name, entry.data?.system ?? {});
      if (!identity || consumedIdentities.has(identity)) continue;
      const candidates = (actorSpellsByIdentity.get(identity) ?? []).filter(item => !idsToDelete.has(item.id));
      const existing = candidates[0] ?? null;
      if (existing) {
        queueUpdate(add2eSpellSyncMergeUpdate(existing, entry, classItem, classLists, actorLevel));
        consumedIdentities.add(identity);
        continue;
      }
      creates.push(entry);
    }

    const existingIds = [...idsToDelete].filter(id => actor.items.has(id));
    if (existingIds.length) await actor.deleteEmbeddedDocuments("Item", existingIds, add2eSpellSyncMutationOptions({ add2eCompendiumTruth: true, add2eReason: "spell-sync-replace-delete" }));

    const liveUpdates = [...updateById.values()].filter(update => actor.items.has(update._id));
    if (liveUpdates.length) await actor.updateEmbeddedDocuments("Item", liveUpdates, add2eSpellSyncMutationOptions({
      add2eSharedSpellMerge: true,
      add2eReason: "spell-sync-source-reconcile"
    }));

    const createData = creates.map(entry => {
      const data = add2eSpellSyncPrepareCompendiumData(add2eSpellSyncClone(entry.data));
      delete data._id;
      data.folder = null;
      foundry.utils.setProperty(data, "flags.add2e.spellSyncSources", [add2eSpellSyncSourceRecord(classItem, classLists, actorLevel)]);
      foundry.utils.setProperty(data, "flags.add2e.stableSpellKey", add2eSpellSyncStableKey(data.name, data.system ?? {}));
      const identity = add2eSpellSyncIdentityKey(data.name, data.system ?? {});
      const memory = memories.get(identity);
      if (memory && options.preserveMemorization !== false) {
        foundry.utils.setProperty(data, "flags.add2e.memorizedByList", memory.byList);
      }
      return data;
    });

    if (createData.length) await actor.createEmbeddedDocuments("Item", createData, add2eSpellSyncMutationOptions({ add2eReason: "spell-sync-create" }));
    await add2eSpellSyncSetLastMax(actor, maxSpellLevel);
    const summary = {
      actor: actor.name,
      classe: classItem.name,
      actorLevel,
      classLists,
      maxSpellLevel,
      minSpellLevel,
      deleted: existingIds.length,
      updated: liveUpdates.length,
      imported: createData.length,
      mode,
      cacheEntries: cache.entries.length,
      cacheDocs: cache.docsCount,
      rejectedSpells: []
    };
    console.info("[ADD2E][CLASS_DROP_SPELLS][DONE]", summary);
    return { handled: true, ...summary };
  } catch (error) {
    console.error("[ADD2E][CLASS_DROP_SPELLS][ERROR]", error);
    ui.notifications.error("Erreur pendant la synchronisation des sorts depuis le compendium add2e.sorts.");
    return { handled: true, imported: 0, updated: 0, deleted: 0, error: String(error?.message ?? error) };
  } finally {
    add2eSpellSyncCloseWaitMessage(waitDialog);
  }
}

async function add2eSyncNewSpellLevelsAfterActorLevelChange(actor, _newLevel = null, options = {}) {
  if (!actor || actor.type !== "personnage") return null;
  const runKey = String(actor.uuid || actor.id || actor.name);
  if (ADD2E_SPELL_SYNC_RUNNING.has(runKey)) return { handled: false, skippedRunning: true };
  ADD2E_SPELL_SYNC_RUNNING.add(runKey);
  try {
    const previous = options.previousSignature ?? add2eSpellSyncGetPreviousSignature(actor);
    const current = add2eSpellSyncLevelSignature(actor);
    const levelDecreased = add2eSpellSyncHasLevelDecrease(previous, current);
    const classes = add2eSpellSyncClassItems(actor).filter(classItem => add2eSpellSyncClassLists(classItem).length);
    let imported = 0;
    let updated = 0;
    let deleted = 0;
    let reset = 0;

    if (levelDecreased) reset += (await add2eResetActorSpellMemorization(actor, "level-down")).reset ?? 0;
    if (!classes.length) {
      await add2eSpellSyncSetLevelSignature(actor, current);
      ADD2E_SPELL_SYNC_PREUPDATE_LEVELS.delete(actor.uuid || actor.id);
      if (reset) globalThis.add2eRerenderActorSheet?.(actor, false);
      return { handled: true, imported, updated, deleted, reset, levelDecreased, skippedAutoSync: true };
    }

    for (const classItem of classes) {
      const level = add2eSpellSyncClassLevel(actor, classItem);
      const classLists = add2eSpellSyncClassLists(classItem);
      const maxSpellLevel = add2eSpellSyncMaxSpellLevel(actor, classItem);
      const knownBefore = Math.max(add2eSpellSyncGetLastMax(actor), add2eSpellSyncMaxExistingLevel(actor, classLists));
      const prune = await add2ePruneActorSpellsForClassLevel(actor, classItem, level, { notify: true, render: false });
      deleted += prune?.deleted ?? 0;
      updated += prune?.updated ?? 0;
      if (!levelDecreased && maxSpellLevel < knownBefore) reset += (await add2eResetActorSpellMemorization(actor, "spell-cap-down")).reset ?? 0;
      const previousKnownMax = Math.max(add2eSpellSyncGetLastMax(actor), add2eSpellSyncMaxExistingLevel(actor, classLists));
      const minSpellLevel = maxSpellLevel > previousKnownMax ? previousKnownMax + 1 : 1;
      const result = await add2eSyncActorSpellsFromClass(actor, classItem, {
        mode: "missing",
        actorLevel: level,
        minSpellLevel,
        showWait: maxSpellLevel > previousKnownMax,
        forceCacheRefresh: false,
        preserveMemorization: !levelDecreased,
        render: false
      });
      imported += result?.imported ?? 0;
      updated += result?.updated ?? 0;
      deleted += result?.deleted ?? 0;
    }

    await add2eSpellSyncSetLevelSignature(actor, current);
    ADD2E_SPELL_SYNC_PREUPDATE_LEVELS.delete(actor.uuid || actor.id);
    if (imported || updated || deleted || reset) globalThis.add2eRerenderActorSheet?.(actor, false);
    return { handled: true, imported, updated, deleted, reset, levelDecreased };
  } finally {
    ADD2E_SPELL_SYNC_RUNNING.delete(runKey);
  }
}

async function add2eResyncSelectedActorSpells(options = {}) {
  const actor = canvas?.tokens?.controlled?.[0]?.actor ?? game.user?.character ?? null;
  if (!actor) {
    ui.notifications.warn("Sélectionne un token ou définis un personnage utilisateur.");
    return null;
  }
  add2eInvalidateSpellSyncCache();
  let imported = 0;
  let updated = 0;
  let deleted = 0;
  const classes = add2eSpellSyncClassItems(actor).filter(classItem => add2eSpellSyncClassLists(classItem).length);
  if (!classes.length) {
    ui.notifications.info("Aucune classe à auto-synchroniser. Clerc, Druide, Paladin (sorts de Clerc) et les sorts druidiques du Ranger sont alimentés automatiquement.");
    return { handled: true, imported, updated, deleted, skippedAutoSync: true };
  }
  for (const classItem of classes) {
    const result = await add2eSyncActorSpellsFromClass(actor, classItem, {
      mode: "missing",
      actorLevel: add2eSpellSyncClassLevel(actor, classItem),
      minSpellLevel: 1,
      showWait: options.showWait !== false,
      forceCacheRefresh: false,
      render: false
    });
    imported += result?.imported ?? 0;
    updated += result?.updated ?? 0;
    deleted += result?.deleted ?? 0;
  }
  ui.notifications.info(imported > 0 ? `Sorts synchronisés depuis le compendium : ${imported}.` : updated > 0 ? `Sorts existants enrichis : ${updated}.` : "Aucun sort synchronisé depuis le compendium.");
  if (imported || updated || deleted) globalThis.add2eRerenderActorSheet?.(actor, false);
  return { handled: true, imported, updated, deleted };
}

function add2eSpellSyncLegacyMigrationUpdate(actor, item) {
  if (!item?.id || String(item.type ?? "").toLowerCase() !== "sort") return null;

  const systemUpdate = add2eSpellSyncLegacySystemUpdate(item);
  const hasSystemMigration = Object.keys(systemUpdate).length > 0;
  if (actor?.type !== "personnage") return hasSystemMigration ? { _id: item.id, ...systemUpdate } : null;

  const flags = item.flags?.add2e ?? {};
  const hasLegacy = ADD2E_SPELL_SYNC_LEGACY_FLAG_KEYS.some(key => Object.prototype.hasOwnProperty.call(flags, key));
  const canonicalSources = add2eSpellSyncSources(item);
  if (!hasLegacy && Array.isArray(flags.spellSyncSources) && !hasSystemMigration) return null;

  let sources = canonicalSources;
  if (!sources.length) {
    const legacyClassId = String(flags.autoGrantedByClassId ?? flags.sourceClassId ?? "").trim();
    const classItem = legacyClassId ? actor?.items?.get?.(legacyClassId) ?? null : null;
    if (classItem?.type === "classe") {
      const levelValue = Number(flags.autoGrantedAtActorLevel);
      const actorLevel = Number.isInteger(levelValue) && levelValue >= 1
        ? levelValue
        : add2eSpellSyncClassLevel(actor, classItem);
      const legacyLists = add2eSpellSyncUnionLists(flags.autoGrantedSpellLists, flags.grantedSpellLists);
      const classLists = legacyLists.length ? legacyLists : add2eSpellSyncClassLists(classItem);
      sources = [add2eSpellSyncSourceRecord(classItem, classLists, actorLevel)];
    }
  }

  const update = { _id: item.id, ...systemUpdate, "flags.add2e.spellSyncSources": sources };
  for (const key of ADD2E_SPELL_SYNC_LEGACY_FLAG_KEYS) {
    if (Object.prototype.hasOwnProperty.call(flags, key)) update[`flags.add2e.${key}`] = add2eSpellSyncForcedDeletion();
  }
  return update;
}

async function add2eMigrateActorSpellSyncOwnership(actor) {
  if (!actor?.items) return { updated: 0 };
  const updates = Array.from(actor.items).map(item => add2eSpellSyncLegacyMigrationUpdate(actor, item)).filter(Boolean);
  if (!updates.length) return { updated: 0 };
  await actor.updateEmbeddedDocuments("Item", updates, add2eSpellSyncMutationOptions({ add2eReason: "spell-sync-source-migration" }));
  return { updated: updates.length };
}

async function add2eMigrateAllSpellSyncOwnership() {
  if (!game.user?.isGM) return { actors: 0, updated: 0 };
  let updated = 0;
  let actors = 0;
  for (const actor of game.actors ?? []) {
    const result = await add2eMigrateActorSpellSyncOwnership(actor);
    if (result.updated) actors += 1;
    updated += result.updated;
  }
  if (updated) console.info("[ADD2E][SPELL_SYNC][SOURCE_MIGRATION]", { actors, updated });
  return { actors, updated };
}

export function add2eWaitForSpellSyncOwnershipMigration() {
  if (!game.user?.isGM) return Promise.resolve({ actors: 0, updated: 0 });
  if (!ADD2E_SPELL_SYNC_OWNERSHIP_MIGRATION) {
    ADD2E_SPELL_SYNC_OWNERSHIP_MIGRATION = add2eMigrateAllSpellSyncOwnership();
  }
  return ADD2E_SPELL_SYNC_OWNERSHIP_MIGRATION;
}

async function add2eMigrateStandaloneWorldSpellFields() {
  if (!game.user?.isGM) return { updated: 0 };
  let updated = 0;
  for (const item of game.items ?? []) {
    if (!item?.id || String(item.type ?? "").toLowerCase() !== "sort") continue;
    const systemUpdate = add2eSpellSyncLegacySystemUpdate(item);
    if (!Object.keys(systemUpdate).length) continue;
    await item.update(systemUpdate, add2eSpellSyncMutationOptions({ add2eReason: "spell-field-alias-migration" }));
    updated += 1;
  }
  if (updated) console.info("[ADD2E][SPELL_SYNC][WORLD_FIELD_MIGRATION]", { updated });
  return { updated };
}

function add2eSpellSyncInternalUpdate(options = {}) {
  return options?.add2eSpellSync === true;
}

function add2eSpellSyncClassLevelChange(changes = {}) {
  return foundry.utils.hasProperty(changes, "system.niveau");
}

Hooks.on("preUpdateItem", (item, changes = {}, options = {}) => {
  if (add2eSpellSyncInternalUpdate(options)) return;
  const actor = item?.parent;
  if (!actor || actor.type !== "personnage" || String(item?.type ?? "").toLowerCase() !== "classe") return;
  if (!add2eSpellSyncClassLevelChange(changes)) return;
  ADD2E_SPELL_SYNC_PREUPDATE_LEVELS.set(actor.uuid || actor.id, add2eSpellSyncLevelSignature(actor));
});

Hooks.on("updateItem", (item, changes = {}, options = {}) => {
  if (!game.user?.isGM || add2eSpellSyncInternalUpdate(options)) return;
  const actor = item?.parent;
  if (!actor || actor.type !== "personnage" || String(item?.type ?? "").toLowerCase() !== "classe") return;
  if (!add2eSpellSyncClassLevelChange(changes)) return;
  window.setTimeout(() => {
    add2eSyncNewSpellLevelsAfterActorLevelChange(actor, null, { reason: "updateItem-class-level-change" })
      .catch(error => console.error("[ADD2E][SPELL_SYNC][LEVEL_CHANGE_ERROR]", error));
  }, 80);
});

for (const [name, fn] of Object.entries({
  add2eSpellSyncClone,
  add2eSpellSyncMaybeJson,
  add2eSpellSyncNormalize,
  add2eSpellSyncArray,
  add2eSpellSyncClassLists,
  add2eSpellSyncIsAutoSyncedClass,
  add2eSpellSyncSpellLevel,
  add2eSpellSyncSpellLists,
  add2eSpellSyncNumber,
  add2eSpellSyncMaxSpellLevel,
  add2eSpellSyncCanUseSpellLevel,
  add2eSpellSyncStableKey,
  add2eSpellSyncIdentityKey,
  add2eSpellSyncSources,
  add2eSpellSyncSourcesWithoutClass,
  add2eSpellSyncSpellBelongsToClass,
  add2eSpellSyncHasIndependentOwnership,
  add2eSpellSyncExistingKeys,
  add2eSpellSyncMaxExistingLevel,
  add2eSpellSyncGetLastMax,
  add2eSpellSyncSetLastMax,
  add2eSpellSyncOpenWaitMessage,
  add2eSpellSyncCloseWaitMessage,
  add2eSpellSyncMatchesClassLists,
  add2eBuildSpellSyncCache,
  add2eWarmSpellSyncCache,
  add2eReloadSpellSyncCache,
  add2eInvalidateSpellSyncCache,
  add2ePruneActorSpellsForClassLevel,
  add2eSyncActorSpellsFromClass,
  add2eSyncNewSpellLevelsAfterActorLevelChange,
  add2eResyncSelectedActorSpells,
  add2eResetActorSpellMemorization,
  add2eSpellSyncSanitizeData,
  add2eSpellSyncPrepareCompendiumData,
  add2eMigrateActorSpellSyncOwnership
})) {
  try { globalThis[name] = fn; }
  catch (_error) {}
}

Hooks.once("ready", () => {
  if (!game.user?.isGM) return;
  Promise.all([
    add2eWaitForSpellSyncOwnershipMigration(),
    add2eMigrateStandaloneWorldSpellFields()
  ])
    .then(() => add2eWarmSpellSyncCache())
    .catch(error => console.warn("[ADD2E][SPELL_SYNC][READY_ERROR]", error));
});
