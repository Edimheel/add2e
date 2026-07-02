// ============================================================
// ADD2E — Synchronisation automatique des sorts
// Source stricte : compendium add2e.sorts
// Compatible Foundry V13 / V14 / V15
// ============================================================

const ADD2E_SPELL_SYNC_VERSION = "2026-07-02-spell-sync-shared-item-v7";
globalThis.ADD2E_SPELL_SYNC_VERSION = ADD2E_SPELL_SYNC_VERSION;

const ADD2E_SPELL_SYNC_REQUIRED_SYSTEM_KEYS = Object.freeze([
  "nom", "classe", "spellLists", "niveau", "ecole", "portee", "duree",
  "zone_effet", "cible", "temps_incantation", "jet_sauvegarde", "composantes",
  "composants_materiels", "description", "onUse"
]);

const ADD2E_SPELL_SYNC_LEGACY_SYSTEM_KEYS = Object.freeze([
  "type", "onUseCode", "tags", "effectTags", "effecttags",
  "composants_materiels_objets", "composants_materiels_source",
  "composants_materiels_reference", "composants_materiels_verification_recommandee",
  "composants_materiels_note", "composants_materiels_a_renseigner"
]);

const ADD2E_SPELL_SYNC_PREUPDATE_LEVELS = globalThis.ADD2E_SPELL_SYNC_PREUPDATE_LEVELS instanceof Map
  ? globalThis.ADD2E_SPELL_SYNC_PREUPDATE_LEVELS
  : new Map();
globalThis.ADD2E_SPELL_SYNC_PREUPDATE_LEVELS = ADD2E_SPELL_SYNC_PREUPDATE_LEVELS;

const ADD2E_SPELL_SYNC_RUNNING = globalThis.ADD2E_SPELL_SYNC_RUNNING instanceof Set
  ? globalThis.ADD2E_SPELL_SYNC_RUNNING
  : new Set();
globalThis.ADD2E_SPELL_SYNC_RUNNING = ADD2E_SPELL_SYNC_RUNNING;

const ADD2E_SPELL_SYNC_AUTO_CLASS_SLUGS = new Set(["clerc", "druide", "ranger"]);

function add2eSpellSyncClone(value) {
  if (value === undefined || value === null) return value;
  if (foundry?.utils?.deepClone) return foundry.utils.deepClone(value);
  if (foundry?.utils?.duplicate) return foundry.utils.duplicate(value);
  return JSON.parse(JSON.stringify(value));
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

function add2eSpellSyncClassIdentity(value) {
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
    druid: "druide", druids: "druide", druides: "druide", druidique: "druide"
  };
  return aliases[normalized] ?? normalized;
}

function add2eSpellSyncArray(value) {
  value = add2eSpellSyncMaybeJson(value);
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(add2eSpellSyncArray);
  if (typeof value === "string") return value.split(/[,;|\n]+/).map(entry => entry.trim()).filter(Boolean);
  if (typeof value === "object") {
    for (const key of ["lists", "spellLists", "classes", "classe", "class", "value", "values", "list", "tags", "items"]) {
      if (value[key] !== undefined) return add2eSpellSyncArray(value[key]);
    }
    const numeric = Object.keys(value).filter(key => /^\d+$/.test(key))
      .sort((left, right) => Number(left) - Number(right)).map(key => value[key]);
    if (numeric.length) return add2eSpellSyncArray(numeric);
  }
  return [value];
}

function add2eSpellSyncNumber(value, fallback = 0) {
  value = add2eSpellSyncMaybeJson(value);
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value && typeof value === "object") {
    for (const key of ["value", "valeur", "slots", "slot", "count", "nombre", "nb", "max", "niveau", "level", "currentLevel", "niveauActuel"]) {
      if (value[key] === undefined || value[key] === null) continue;
      const number = add2eSpellSyncNumber(value[key], NaN);
      if (Number.isFinite(number)) return number;
    }
  }
  const match = String(value ?? "").trim().match(/-?\d+(?:[.,]\d+)?/);
  if (!match) return fallback;
  const number = Number(match[0].replace(",", "."));
  return Number.isFinite(number) ? number : fallback;
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
  clean.system ??= {};
  clean.type = "sort";
  clean.name ||= clean.system.nom || "Sort";
  clean.img ||= "icons/svg/book.svg";
  clean.flags ??= {};
  clean.flags.add2e ??= {};

  if (!Array.isArray(clean.system.composants_materiels)) clean.system.composants_materiels = [];
  if (!Array.isArray(clean.system.spellLists)) clean.system.spellLists = add2eSpellSyncArray(clean.system.spellLists);
  for (const key of ADD2E_SPELL_SYNC_LEGACY_SYSTEM_KEYS) delete clean.system[key];

  const level = add2eSpellSyncNumber(clean.system.niveau, NaN);
  if (Number.isFinite(level) && level > 0) clean.system.niveau = level;

  add2eSpellSyncValidateCanonicalData(clean);
  return clean;
}

function add2eSpellSyncSanitizeData(data) {
  return add2eSpellSyncPrepareCompendiumData(data);
}

function add2eSpellSyncClassItems(actor) {
  return actor?.items?.filter?.(item => String(item?.type ?? "").toLowerCase() === "classe") ?? [];
}

function add2eSpellSyncClassSlug(classItem) {
  const system = classItem?.system ?? {};
  return add2eSpellSyncNormalize(system.slug ?? system.label ?? system.nom ?? system.name ?? classItem?.name ?? "classe");
}

function add2eSpellSyncClassIdentityForItem(classItem) {
  const system = classItem?.system ?? {};
  return add2eSpellSyncClassIdentity(system.slug ?? system.label ?? system.nom ?? system.name ?? classItem?.name ?? "classe");
}

function add2eSpellSyncRangerDruidEntry(classItem) {
  if (add2eSpellSyncClassIdentityForItem(classItem) !== "ranger") return null;
  const casting = add2eSpellSyncMaybeJson(classItem?.system?.spellcasting);
  const entries = Array.isArray(casting?.entries) ? casting.entries : [];
  for (const entry of entries) {
    const key = add2eSpellSyncNormalize(entry?.key ?? entry?.list ?? entry?.liste ?? entry?.name ?? entry?.label ?? entry?.type ?? "");
    if (key !== "druide") continue;
    return {
      key: "druide",
      startsAt: Math.max(1, add2eSpellSyncNumber(entry?.startsAt ?? entry?.startLevel ?? entry?.niveauDepart ?? 8, 8) || 8),
      maxSpellLevel: Math.max(1, add2eSpellSyncNumber(entry?.maxSpellLevel ?? entry?.maxLevel ?? entry?.maxNiveauSort ?? 3, 3) || 3),
      slotsField: String(entry?.slotsField ?? entry?.slotField ?? entry?.progressionField ?? "spellsPerLevelDruide").trim() || "spellsPerLevelDruide"
    };
  }
  return null;
}

function add2eSpellSyncIsAutoSyncedClass(classItem) {
  const identity = add2eSpellSyncClassIdentityForItem(classItem);
  if (!ADD2E_SPELL_SYNC_AUTO_CLASS_SLUGS.has(identity)) return false;
  return identity !== "ranger" || !!add2eSpellSyncRangerDruidEntry(classItem);
}

function add2eSpellSyncClassLists(classItem) {
  if (!add2eSpellSyncIsAutoSyncedClass(classItem)) return [];
  const classIdentity = add2eSpellSyncClassIdentityForItem(classItem);
  if (classIdentity === "ranger") return ["druide"];

  const system = classItem?.system ?? {};
  const spellcasting = add2eSpellSyncMaybeJson(system.spellcasting);
  const values = [
    ...add2eSpellSyncArray(system.spellLists), ...add2eSpellSyncArray(system.lists),
    ...add2eSpellSyncArray(system.listeSorts), ...add2eSpellSyncArray(system.liste_sorts),
    ...add2eSpellSyncArray(system.sorts), ...add2eSpellSyncArray(system.tags),
    ...add2eSpellSyncArray(system.classe), ...add2eSpellSyncArray(spellcasting?.lists),
    ...add2eSpellSyncArray(spellcasting?.spellLists), ...add2eSpellSyncArray(spellcasting?.list),
    ...add2eSpellSyncArray(spellcasting?.classes)
  ];
  const lists = values.map(add2eSpellSyncNormalize).filter(Boolean);
  if (classIdentity === "clerc") lists.push("clerc");
  if (classIdentity === "druide") lists.push("druide");
  return [...new Set(lists)].filter(list => ["clerc", "druide"].includes(list));
}

function add2eSpellSyncSpellLevel(system = {}) {
  const raw = system.niveau ?? system.niveau_sort ?? system.spellLevel ?? system.level ?? system.lvl ?? 0;
  const match = String(raw).match(/\d+/);
  return match ? Number(match[0]) || 0 : 0;
}

function add2eSpellSyncSpellLists(system = {}) {
  const canonical = [
    ...add2eSpellSyncArray(system.spellLists), ...add2eSpellSyncArray(system.lists),
    ...add2eSpellSyncArray(system.classes), ...add2eSpellSyncArray(system.classe),
    ...add2eSpellSyncArray(system.class), ...add2eSpellSyncArray(system.liste)
  ].map(add2eSpellSyncNormalize).filter(Boolean);
  if (canonical.length) return [...new Set(canonical)];
  return [...new Set([
    ...add2eSpellSyncArray(system.tags),
    ...add2eSpellSyncArray(system.effectTags),
    ...add2eSpellSyncArray(system.effecttags)
  ].map(add2eSpellSyncNormalize).filter(Boolean))];
}

function add2eSpellSyncSlotsArray(value) {
  value = add2eSpellSyncMaybeJson(value);
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    const text = value.trim();
    if (!text || !/\d/.test(text)) return [];
    return /[,;|/\s]+/.test(text) ? text.split(/[,;|/\s]+/).map(entry => entry.trim()).filter(Boolean) : [];
  }
  if (typeof value === "object") {
    for (const key of ["slots", "slot", "value", "values", "spellsPerLevel", "SpellsPerLevel", "sortsParNiveau", "sorts_par_niveau", "spells", "spellSlots"]) {
      if (Array.isArray(value[key]) || typeof value[key] === "string") return add2eSpellSyncSlotsArray(value[key]);
    }
    return Object.keys(value).filter(key => /^\d+$/.test(key))
      .sort((left, right) => Number(left) - Number(right)).map(key => value[key]);
  }
  return [];
}

function add2eSpellSyncReadSlotValue(raw, spellLevelOrIndex, listKey = "") {
  raw = add2eSpellSyncMaybeJson(raw);
  if (raw === undefined || raw === null || raw === "") return null;
  const index = Math.max(0, Number(spellLevelOrIndex) - 1);
  const oneBased = index + 1;
  const wanted = add2eSpellSyncNormalize(listKey);
  const array = add2eSpellSyncSlotsArray(raw);
  if (array.length) return index < array.length ? add2eSpellSyncNumber(array[index], 0) || 0 : 0;
  if (typeof raw !== "object") return null;
  if (wanted) {
    for (const [key, value] of Object.entries(raw)) {
      if (add2eSpellSyncNormalize(key) !== wanted) continue;
      const result = add2eSpellSyncReadSlotValue(value, oneBased, "");
      if (result !== null) return result;
    }
  }
  for (const key of ["slots", "slot", "value", "values", "spellsPerLevel", "SpellsPerLevel", "sortsParNiveau", "sorts_par_niveau", "spells", "spellSlots"]) {
    if (raw[key] === undefined) continue;
    const result = add2eSpellSyncReadSlotValue(raw[key], oneBased, wanted);
    if (result !== null) return result;
  }
  if (Object.prototype.hasOwnProperty.call(raw, String(oneBased))) return add2eSpellSyncNumber(raw[String(oneBased)], 0) || 0;
  if (Object.prototype.hasOwnProperty.call(raw, String(index))) return add2eSpellSyncNumber(raw[String(index)], 0) || 0;
  return null;
}

function add2eSpellSyncStableKey(name, system = {}, listOverride = "") {
  const spellName = add2eSpellSyncNormalize(name ?? system.nom ?? system.name ?? "");
  const level = add2eSpellSyncSpellLevel(system);
  const lists = listOverride ? [listOverride] : add2eSpellSyncSpellLists(system);
  const listKey = [...new Set(lists.map(add2eSpellSyncNormalize).filter(Boolean))].sort().join("+") || "liste_inconnue";
  return `${listKey}|${level}|${spellName}`;
}

function add2eSpellSyncIdentityKey(name, system = {}) {
  const spellName = add2eSpellSyncNormalize(name ?? system.nom ?? system.name ?? "");
  const level = add2eSpellSyncSpellLevel(system);
  return spellName && level > 0 ? `${level}|${spellName}` : "";
}

function add2eSpellSyncUnionLists(...values) {
  return [...new Set(values
    .flatMap(value => add2eSpellSyncArray(value))
    .map(add2eSpellSyncNormalize)
    .filter(Boolean))];
}

function add2eSpellSyncCacheKeySet(cache) {
  return new Set((cache?.entries ?? []).map(entry => entry.stableKey).filter(Boolean));
}

function add2eSpellSyncIsCompendiumOwnedActorSpell(item) {
  const flags = item?.flags?.add2e ?? {};
  const source = String(item?._stats?.compendiumSource ?? item?.flags?.core?.sourceId ?? flags.sourceUuid ?? flags.sourceId ?? "");
  return flags.autoGrantedSpellSync === true || !!flags.autoGrantedByClassId || !!flags.autoGrantedByClass || source.includes("add2e.sorts");
}

function add2eSpellSyncClassSourceNames(classItem) {
  const system = classItem?.system ?? {};
  return new Set([
    classItem?.name,
    system.slug,
    system.label,
    system.nom,
    system.name
  ].map(add2eSpellSyncNormalize).filter(Boolean));
}

function add2eSpellSyncSpellBelongsToClass(item, classItem) {
  const flags = item?.flags?.add2e ?? {};
  const classId = String(classItem?.id ?? "");
  const sourceId = String(
    flags.autoGrantedByClassId
    ?? flags.sourceClassId
    ?? flags.sourceItemId
    ?? flags.classId
    ?? ""
  );
  if (classId && sourceId === classId) return true;
  const sourceNames = add2eSpellSyncClassSourceNames(classItem);
  const sourceName = add2eSpellSyncNormalize(
    flags.autoGrantedByClass
    ?? flags.sourceClass
    ?? flags.sourceClasse
    ?? flags.className
    ?? flags.classSlug
    ?? ""
  );
  return !!sourceName && sourceNames.has(sourceName);
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
  const byList = rawByList && typeof rawByList === "object" && !Array.isArray(rawByList) ? add2eSpellSyncClone(rawByList) : {};
  const count = Math.max(0, Number(item?.getFlag?.("add2e", "memorizedCount") ?? item?.flags?.add2e?.memorizedCount ?? 0) || 0);
  return { byList, count };
}

function add2eSpellSyncLevelSignature(actor) {
  const signature = {};
  const classes = add2eSpellSyncClassItems(actor);
  const multi = actor?.system?.multiclasse?.enabled === true || classes.length > 1;
  const put = (key, value) => {
    const level = add2eSpellSyncNumber(value, NaN);
    if (Number.isFinite(level) && level >= 0) signature[add2eSpellSyncNormalize(key)] = Math.floor(level);
  };
  if (!multi) put("__mono", actor?.system?.niveau ?? actor?.system?.level ?? actor?.system?.niveau_total ?? actor?.system?.levelTotal);
  for (const classItem of classes) put(add2eSpellSyncClassSlug(classItem) || classItem.id || classItem.name, classItem?.system?.niveau ?? classItem?.system?.level ?? classItem?.system?.currentLevel ?? classItem?.system?.niveauActuel);
  for (const root of [actor?.system?.niveaux_par_classe, actor?.system?.niveauxParClasse, actor?.system?.levelsByClass, actor?.system?.classLevels]) {
    if (!root || typeof root !== "object") continue;
    for (const [key, value] of Object.entries(root)) put(key, value?.niveau ?? value?.level ?? value?.value ?? value);
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
  if (actor?.setFlag) await actor.setFlag("add2e", "autoSpellSyncLevelSignature", signature ?? add2eSpellSyncLevelSignature(actor));
}

async function add2eResetActorSpellMemorization(actor, reason = "level-down") {
  if (!actor?.items || actor.type !== "personnage") return { reset: 0 };
  const updates = [];
  for (const sort of actor.items.filter(item => String(item?.type ?? "").toLowerCase() === "sort")) {
    const snapshot = add2eSpellSyncMemorizationSnapshot(sort);
    const hasByList = Object.values(snapshot.byList).some(value => Number(value) > 0);
    if (snapshot.count <= 0 && !hasByList) continue;
    updates.push({ _id: sort.id, "flags.add2e.memorizedCount": 0, "flags.add2e.memorizedByList": {} });
  }
  if (updates.length) await actor.updateEmbeddedDocuments("Item", updates, { add2eInternal: true, add2eSpellSync: true, reason });
  if (updates.length) console.info("[ADD2E][SPELL_SYNC][MEMORIZED_RESET]", { actor: actor.name, reason, reset: updates.length });
  return { reset: updates.length };
}

function add2eSpellSyncRangerDruidSlots(row, rangerEntry) {
  if (!row || typeof row !== "object" || !rangerEntry) return null;
  if (rangerEntry.slotsField && row[rangerEntry.slotsField] !== undefined) return row[rangerEntry.slotsField];
  for (const field of ["spellSlotsByList", "spellsByList", "spellsPerLevelByList", "sortsParListe"]) {
    const container = row[field];
    if (!container || typeof container !== "object") continue;
    for (const [key, value] of Object.entries(container)) {
      if (add2eSpellSyncNormalize(key) === "druide") return value;
    }
  }
  return null;
}

function add2eSpellSyncMaxSpellLevel(classItem, actorLevel) {
  const system = classItem?.system ?? {};
  const spellcasting = add2eSpellSyncMaybeJson(system.spellcasting);
  const rangerEntry = add2eSpellSyncRangerDruidEntry(classItem);
  const level = Math.max(1, Number(actorLevel) || 1);
  const startsAt = Math.max(1, Number(rangerEntry?.startsAt ?? spellcasting?.startsAt ?? system.startsAt ?? 1) || 1);
  const hardMax = Math.max(1, Number(rangerEntry?.maxSpellLevel ?? spellcasting?.maxSpellLevel ?? system.maxSpellLevel ?? 9) || 9);
  if (level < startsAt) return 0;
  const progression = add2eSpellSyncMaybeJson(system.progression);
  const rows = Array.isArray(progression) ? progression : [];
  const row = rows.find(entry => Number(entry?.niveau ?? entry?.level) === level) ?? rows[level - 1] ?? null;
  let highest = 0;
  if (row && typeof row === "object") {
    const rangerSlots = add2eSpellSyncRangerDruidSlots(row, rangerEntry);
    const sources = rangerSlots !== null
      ? [rangerSlots]
      : ["spellsPerLevel", "SpellsPerLevel", "sortsParNiveau", "sorts_par_niveau", "spells", "slots", "spellSlots"].map(key => row[key]);
    for (const source of sources) {
      add2eSpellSyncSlotsArray(source).forEach((value, index) => {
        if (add2eSpellSyncNumber(value, 0) > 0) highest = Math.max(highest, index + 1);
      });
    }
  }
  return highest > 0 ? Math.min(highest, hardMax) : 0;
}

function add2eSpellSyncClassLevel(actor, classItem = null) {
  if (typeof globalThis.add2eSpellClassLevel === "function") return globalThis.add2eSpellClassLevel(actor, add2eSpellSyncClassSlug(classItem));
  return Math.max(1, Number(classItem?.system?.niveau ?? classItem?.system?.level ?? actor?.system?.niveau ?? actor?.system?.level ?? 1) || 1);
}

function add2eSpellSyncGetProgressionRow(actor, actorLevel = null) {
  const level = Math.max(1, Number(actorLevel ?? actor?.system?.niveau) || 1);
  const classItem = actor?.items?.find?.(item => String(item?.type ?? "").toLowerCase() === "classe") ?? null;
  const progression = add2eSpellSyncMaybeJson((classItem?.system ?? actor?.system?.details_classe ?? {}).progression);
  const rows = Array.isArray(progression) ? progression : [];
  return rows.find(entry => Number(entry?.niveau ?? entry?.level) === level) ?? rows[level - 1] ?? null;
}

function add2eSpellSyncSlotProbe(actor, classLists, spellLevel) {
  const level = Number(spellLevel) || 0;
  const row = add2eSpellSyncGetProgressionRow(actor);
  if (!row || typeof row !== "object" || level < 1) return { found: false, count: 0, source: "no-row" };
  const raw = row.spellsPerLevel ?? row.SpellsPerLevel ?? row.sortsParNiveau ?? row.sorts_par_niveau ?? row.spells ?? row.slots ?? row.spellSlots;
  const count = add2eSpellSyncReadSlotValue(raw, level, classLists?.[0] ?? "");
  return count === null ? { found: false, count: 0, source: "no-slot-source" } : { found: true, count: Number(count) || 0, source: "progression" };
}

function add2eSpellSyncCanUseSpellLevel(actor, classLists, spellLevel, fallbackMaxSpellLevel, options = {}) {
  const level = Number(spellLevel) || 0;
  if (level < 1) return false;
  const max = Number(fallbackMaxSpellLevel) || 0;
  if (options.importMode === true || options.mode === "import") return max > 0 && level <= max;
  const probe = add2eSpellSyncSlotProbe(actor, classLists, level);
  return probe.found ? probe.count > 0 : max > 0 && level <= max;
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
  if (actor?.setFlag) await actor.setFlag("add2e", "autoSpellSyncMaxLevel", Math.max(0, Number(value) || 0));
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
  globalThis.ADD2E_SPELL_SYNC_CACHE = null;
}

async function add2eBuildSpellSyncCache({ force = false } = {}) {
  const pack = game.packs?.get?.("add2e.sorts");
  if (!pack) throw new Error("Compendium de sorts introuvable : add2e.sorts");
  const cacheKey = add2eSpellSyncBuildCacheKey(pack);
  const existing = globalThis.ADD2E_SPELL_SYNC_CACHE;
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
      foundry.utils.setProperty(kept.data, "flags.add2e.spellListsResolved", kept.lists);
      duplicateKeys.push({ key: stableKey, kept: kept.name, merged: data.name });
      continue;
    }

    delete data._id;
    data.folder = null;
    foundry.utils.setProperty(data, "system.spellLists", lists);
    foundry.utils.setProperty(data, "flags.add2e.spellListsResolved", lists);
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
  globalThis.ADD2E_SPELL_SYNC_CACHE = cache;
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

async function add2ePruneActorSpellsForClassLevel(actor, classItem, actorLevel, options = {}) {
  if (!actor || !classItem || classItem.type !== "classe") return { handled: false, deleted: 0, maxSpellLevel: 0 };
  const classLists = add2eSpellSyncClassLists(classItem);
  if (!classLists.length) return { handled: false, deleted: 0, maxSpellLevel: 0 };
  const level = Math.max(1, Number(actorLevel ?? add2eSpellSyncClassLevel(actor, classItem)) || 1);
  const maxSpellLevel = add2eSpellSyncMaxSpellLevel(classItem, level);
  const ids = [];
  for (const sort of actor.items?.filter?.(item => String(item?.type ?? "").toLowerCase() === "sort") ?? []) {
    if (!add2eSpellSyncSpellBelongsToClass(sort, classItem) && add2eSpellSyncClassItems(actor).length > 1) continue;
    if (!add2eSpellSyncMatchesClassLists(sort.system ?? {}, classLists)) continue;
    if (!add2eSpellSyncCanUseSpellLevel(actor, classLists, add2eSpellSyncSpellLevel(sort.system ?? {}), maxSpellLevel, { importMode: true })) ids.push(sort.id);
  }
  const existing = ids.filter(id => actor.items.has(id));
  if (existing.length) await actor.deleteEmbeddedDocuments("Item", existing, { add2eInternal: true, add2eSpellSync: true });
  await add2eSpellSyncSetLastMax(actor, maxSpellLevel);
  if (options.notify !== false && existing.length) ui.notifications.info(`Sorts non accessibles retirés : ${existing.length}.`);
  return { handled: true, deleted: existing.length, maxSpellLevel, actorLevel: level };
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

function add2eSpellSyncSourceClassLists(actor, item) {
  const flags = item?.flags?.add2e ?? {};
  const sourceId = String(flags.autoGrantedByClassId ?? flags.sourceClassId ?? flags.sourceItemId ?? flags.classId ?? "");
  let classItem = sourceId ? actor?.items?.get?.(sourceId) ?? null : null;
  if (!classItem) {
    const sourceNames = new Set([
      flags.autoGrantedByClass,
      flags.sourceClass,
      flags.sourceClasse,
      flags.className,
      flags.classSlug
    ].map(add2eSpellSyncNormalize).filter(Boolean));
    if (sourceNames.size) classItem = add2eSpellSyncClassItems(actor)
      .find(candidate => add2eSpellSyncClassSourceNames(candidate).some(name => sourceNames.has(name))) ?? null;
  }
  return classItem ? add2eSpellSyncClassLists(classItem) : [];
}

function add2eSpellSyncGrantedListsForItem(actor, item) {
  const flags = item?.flags?.add2e ?? {};
  const explicit = add2eSpellSyncUnionLists(
    flags.grantedSpellLists,
    flags.learnedSpellLists,
    flags.knownSpellLists,
    flags.autoGrantedSpellLists
  );
  const auto = add2eSpellSyncIsCompendiumOwnedActorSpell(item)
    ? add2eSpellSyncSourceClassLists(actor, item)
    : [];
  return add2eSpellSyncUnionLists(explicit, auto, explicit.length || auto.length ? [] : add2eSpellSyncSpellLists(item?.system ?? {}));
}

function add2eSpellSyncAutoGrantedListsForItem(actor, item) {
  const flags = item?.flags?.add2e ?? {};
  if (!add2eSpellSyncIsCompendiumOwnedActorSpell(item)) return [];
  return add2eSpellSyncUnionLists(flags.autoGrantedSpellLists, add2eSpellSyncSourceClassLists(actor, item));
}

function add2eSpellSyncMergeUpdate(actor, item, entry, classLists) {
  const systemLists = add2eSpellSyncUnionLists(add2eSpellSyncSpellLists(item.system ?? {}), entry.lists);
  const grantedLists = add2eSpellSyncUnionLists(add2eSpellSyncGrantedListsForItem(actor, item), classLists);
  const nextSystem = { ...(item.system ?? {}), spellLists: systemLists };
  const update = {
    _id: item.id,
    "system.spellLists": systemLists,
    "flags.add2e.spellListsResolved": systemLists,
    "flags.add2e.grantedSpellLists": grantedLists,
    "flags.add2e.stableSpellKey": add2eSpellSyncStableKey(item.name, nextSystem)
  };
  const autoGrantedLists = add2eSpellSyncAutoGrantedListsForItem(actor, item);
  if (autoGrantedLists.length) update["flags.add2e.autoGrantedSpellLists"] = add2eSpellSyncUnionLists(autoGrantedLists, classLists);
  return update;
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

  const actorLevel = Math.max(1, Number(options.actorLevel ?? add2eSpellSyncClassLevel(actor, classItem)) || 1);
  const maxSpellLevel = add2eSpellSyncMaxSpellLevel(classItem, actorLevel);
  const minSpellLevel = Math.max(1, Number(options.minSpellLevel ?? 1) || 1);
  const waitDialog = options.showWait !== false ? add2eSpellSyncOpenWaitMessage({ actor, classItem, mode, minSpellLevel, maxSpellLevel }) : null;

  try {
    const cache = await add2eBuildSpellSyncCache({ force: !!options.forceCacheRefresh || mode === "replace" });
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
      if (!add2eSpellSyncCanUseSpellLevel(actor, classLists, entry.level, maxSpellLevel, { importMode: true })) continue;
      if (!entry.lists.some(list => wanted.has(list))) continue;
      if (!selectedByStableKey.has(entry.stableKey)) selectedByStableKey.set(entry.stableKey, entry);
    }
    let selected = add2eSpellSyncCollapseSelectedEntries([...selectedByStableKey.values()]);

    const memories = new Map();
    const idsToDelete = [];
    const actorSpells = add2eSpellSyncActorSpellKeyMap(actor);
    const actorSpellsByIdentity = add2eSpellSyncActorSpellIdentityMap(actor);
    const protectedIdentities = new Set();
    const isMulticlass = add2eSpellSyncClassItems(actor).length > 1;
    let mergeUpdates = [];

    if (mode === "replace") {
      for (const item of actor.items.filter(entry => String(entry?.type ?? "").toLowerCase() === "sort")) {
        const belongsToCurrentClass = add2eSpellSyncSpellBelongsToClass(item, classItem);
        const legacySingleClassSpell = !isMulticlass && add2eSpellSyncMatchesClassLists(item.system ?? {}, classLists);
        const identity = add2eSpellSyncIdentityKey(item.name, item.system ?? {});
        if (!belongsToCurrentClass && !legacySingleClassSpell) {
          if (identity) protectedIdentities.add(identity);
          continue;
        }
        if (identity) memories.set(identity, add2eSpellSyncMemorizationSnapshot(item));
        idsToDelete.push(item.id);
      }
      selected = selected.filter(entry => !protectedIdentities.has(add2eSpellSyncIdentityKey(entry.name, entry.data?.system ?? {})));
    } else {
      const creates = [];
      for (const entry of selected) {
        const identity = add2eSpellSyncIdentityKey(entry.name, entry.data?.system ?? {});
        const existing = (actorSpellsByIdentity.get(identity) ?? [])[0] ?? null;
        if (existing) {
          mergeUpdates.push(add2eSpellSyncMergeUpdate(actor, existing, entry, classLists));
          continue;
        }
        creates.push(entry);
      }
      selected = creates;
    }

    const existing = [...new Set(idsToDelete)].filter(id => actor.items.has(id));
    if (existing.length) await actor.deleteEmbeddedDocuments("Item", existing, { add2eInternal: true, add2eSpellSync: true, add2eCompendiumTruth: true });

    const liveMergeUpdates = mergeUpdates.filter(update => actor.items.has(update._id));
    if (liveMergeUpdates.length) await actor.updateEmbeddedDocuments("Item", liveMergeUpdates, {
      add2eInternal: true,
      add2eSpellSync: true,
      add2eSharedSpellMerge: true
    });

    const createData = selected.map(entry => {
      const data = add2eSpellSyncPrepareCompendiumData(add2eSpellSyncClone(entry.data));
      delete data._id;
      data.folder = null;
      const grantedLists = add2eSpellSyncUnionLists(classLists);
      foundry.utils.setProperty(data, "flags.add2e.autoGrantedByClass", classItem.name);
      foundry.utils.setProperty(data, "flags.add2e.autoGrantedByClassId", classItem.id);
      foundry.utils.setProperty(data, "flags.add2e.autoGrantedSpellSync", true);
      foundry.utils.setProperty(data, "flags.add2e.autoGrantedSpellLists", grantedLists);
      foundry.utils.setProperty(data, "flags.add2e.grantedSpellLists", grantedLists);
      foundry.utils.setProperty(data, "flags.add2e.autoGrantedAtActorLevel", actorLevel);
      foundry.utils.setProperty(data, "flags.add2e.stableSpellKey", add2eSpellSyncStableKey(data.name, data.system ?? {}));
      const identity = add2eSpellSyncIdentityKey(data.name, data.system ?? {});
      const memory = memories.get(identity);
      if (memory && options.preserveMemorization !== false) {
        foundry.utils.setProperty(data, "flags.add2e.memorizedCount", memory.count);
        foundry.utils.setProperty(data, "flags.add2e.memorizedByList", memory.byList);
      }
      return data;
    });

    if (createData.length) await actor.createEmbeddedDocuments("Item", createData, { add2eInternal: true, add2eSpellSync: true });
    await add2eSpellSyncSetLastMax(actor, maxSpellLevel);
    const summary = {
      actor: actor.name,
      classe: classItem.name,
      actorLevel,
      classLists,
      maxSpellLevel,
      minSpellLevel,
      deleted: existing.length,
      updated: liveMergeUpdates.length,
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

async function add2eSyncNewSpellLevelsAfterActorLevelChange(actor, newLevel = null, options = {}) {
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
      const level = Math.max(1, Number(newLevel ?? add2eSpellSyncClassLevel(actor, classItem)) || 1);
      const classLists = add2eSpellSyncClassLists(classItem);
      const maxSpellLevel = add2eSpellSyncMaxSpellLevel(classItem, level);
      const knownBefore = Math.max(add2eSpellSyncGetLastMax(actor), add2eSpellSyncMaxExistingLevel(actor, classLists));
      const prune = await add2ePruneActorSpellsForClassLevel(actor, classItem, level, { notify: true });
      deleted += prune?.deleted ?? 0;
      if (!levelDecreased && maxSpellLevel < knownBefore) reset += (await add2eResetActorSpellMemorization(actor, "spell-cap-down")).reset ?? 0;
      const previousKnownMax = Math.max(add2eSpellSyncGetLastMax(actor), add2eSpellSyncMaxExistingLevel(actor, classLists));
      const minSpellLevel = maxSpellLevel > previousKnownMax ? previousKnownMax + 1 : 1;
      const result = await add2eSyncActorSpellsFromClass(actor, classItem, {
        mode: "missing",
        actorLevel: level,
        minSpellLevel,
        showWait: maxSpellLevel > previousKnownMax,
        forceCacheRefresh: true,
        preserveMemorization: !levelDecreased
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
    ui.notifications.info("Aucune classe à auto-synchroniser. Seuls Clerc, Druide et les sorts druidiques du Ranger sont alimentés automatiquement.");
    return { handled: true, imported, updated, deleted, skippedAutoSync: true };
  }
  for (const classItem of classes) {
    const result = await add2eSyncActorSpellsFromClass(actor, classItem, {
      mode: "missing",
      actorLevel: add2eSpellSyncClassLevel(actor, classItem),
      minSpellLevel: 1,
      showWait: options.showWait !== false,
      forceCacheRefresh: true
    });
    imported += result?.imported ?? 0;
    updated += result?.updated ?? 0;
    deleted += result?.deleted ?? 0;
  }
  ui.notifications.info(imported > 0 ? `Sorts synchronisés depuis le compendium : ${imported}.` : updated > 0 ? `Sorts existants enrichis : ${updated}.` : "Aucun sort synchronisé depuis le compendium.");
  if (imported || updated || deleted) globalThis.add2eRerenderActorSheet?.(actor, false);
  return { handled: true, imported, updated, deleted };
}

function add2eSpellSyncChangeTouchesLevels(changes = {}) {
  return ["system.niveau", "system.level", "system.niveau_total", "system.levelTotal", "system.niveaux_par_classe", "system.niveauxParClasse", "system.levelsByClass", "system.classLevels", "system.multiclasse"]
    .some(path => foundry.utils.hasProperty(changes, path));
}

Hooks.on("preUpdateActor", (actor, changes = {}) => {
  if (!actor || actor.type !== "personnage" || !add2eSpellSyncChangeTouchesLevels(changes)) return;
  ADD2E_SPELL_SYNC_PREUPDATE_LEVELS.set(actor.uuid || actor.id, add2eSpellSyncLevelSignature(actor));
});

Hooks.on("updateActor", (actor, changes = {}, options = {}) => {
  if (!game.user?.isGM || options?.add2eInternal || !actor || actor.type !== "personnage") return;
  if (!add2eSpellSyncChangeTouchesLevels(changes)) return;
  window.setTimeout(() => {
    add2eSyncNewSpellLevelsAfterActorLevelChange(actor, null, { reason: "updateActor-level-change" })
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
  add2eSpellSyncSlotsArray,
  add2eSpellSyncReadSlotValue,
  add2eSpellSyncMaxSpellLevel,
  add2eSpellSyncGetProgressionRow,
  add2eSpellSyncSlotProbe,
  add2eSpellSyncCanUseSpellLevel,
  add2eSpellSyncStableKey,
  add2eSpellSyncIdentityKey,
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
  add2eSpellSyncPrepareCompendiumData
})) {
  try { globalThis[name] = fn; }
  catch (_error) {}
}

Hooks.once("ready", () => {
  if (game.user?.isGM) add2eWarmSpellSyncCache().catch(error => console.warn("[ADD2E][SPELL_SYNC][WARMUP_ERROR]", error));
});