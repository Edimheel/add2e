// ============================================================
// ADD2E — Synchronisation automatique des sorts
// Source stricte : compendium add2e.sorts
// Compatible Foundry V13 / V14 / V15
// ============================================================

const ADD2E_SPELL_SYNC_VERSION = "2026-06-25-spell-sync-canonical-schema-v3";
globalThis.ADD2E_SPELL_SYNC_VERSION = ADD2E_SPELL_SYNC_VERSION;

// Champs de jeu canoniques d'un sort. Les métadonnées d'import, de contrôle
// et les anciens doublons ne font plus partie du modèle synchronisé.
const ADD2E_SPELL_SYNC_REQUIRED_SYSTEM_KEYS = Object.freeze([
  "nom",
  "classe",
  "spellLists",
  "niveau",
  "ecole",
  "portee",
  "duree",
  "zone_effet",
  "cible",
  "temps_incantation",
  "jet_sauvegarde",
  "composantes",
  "composants_materiels",
  "description",
  "onUse"
]);

// Ces clés restent tolérées à la lecture des anciens sorts, mais ne sont plus
// copiées vers le cache ni vers les sorts créés sur les acteurs.
const ADD2E_SPELL_SYNC_LEGACY_SYSTEM_KEYS = Object.freeze([
  "type",
  "onUseCode",
  "tags",
  "effectTags",
  "effecttags",
  "composants_materiels_objets",
  "composants_materiels_source",
  "composants_materiels_reference",
  "composants_materiels_verification_recommandee",
  "composants_materiels_note",
  "composants_materiels_a_renseigner"
]);

const ADD2E_SPELL_SYNC_PREUPDATE_LEVELS = globalThis.ADD2E_SPELL_SYNC_PREUPDATE_LEVELS instanceof Map
  ? globalThis.ADD2E_SPELL_SYNC_PREUPDATE_LEVELS
  : new Map();
globalThis.ADD2E_SPELL_SYNC_PREUPDATE_LEVELS = ADD2E_SPELL_SYNC_PREUPDATE_LEVELS;

const ADD2E_SPELL_SYNC_RUNNING = globalThis.ADD2E_SPELL_SYNC_RUNNING instanceof Set
  ? globalThis.ADD2E_SPELL_SYNC_RUNNING
  : new Set();
globalThis.ADD2E_SPELL_SYNC_RUNNING = ADD2E_SPELL_SYNC_RUNNING;

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
    catch (_err) { return value; }
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
  if (typeof value === "object") {
    for (const key of ["lists", "spellLists", "classes", "classe", "class", "value", "values", "list", "tags", "items"]) {
      if (value[key] !== undefined) return add2eSpellSyncArray(value[key]);
    }
    const numeric = Object.keys(value)
      .filter(key => /^\d+$/.test(key))
      .sort((left, right) => Number(left) - Number(right))
      .map(key => value[key]);
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
  if (Array.isArray(value)) return value
    .map(add2eSpellSyncCleanPlaceholders)
    .filter(entry => entry !== "" && entry !== null && entry !== undefined);
  if (value && typeof value === "object") {
    const clone = add2eSpellSyncClone(value);
    for (const [key, entry] of Object.entries(clone)) clone[key] = add2eSpellSyncCleanPlaceholders(entry);
    return clone;
  }
  return value;
}

function add2eSpellSyncHasMaterialProfile(value) {
  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined && value !== null && value !== "";
}

function add2eSpellSyncValidateCanonicalData(data) {
  const system = data?.system ?? {};
  const missing = ADD2E_SPELL_SYNC_REQUIRED_SYSTEM_KEYS
    .filter(key => !Object.prototype.hasOwnProperty.call(system, key));
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

  // Migration de lecture unique : un ancien profil matériel est repris seulement
  // lorsqu'aucun profil canonique n'est présent.
  if (!add2eSpellSyncHasMaterialProfile(clean.system.composants_materiels)
    && add2eSpellSyncHasMaterialProfile(clean.system.composants_materiels_objets)) {
    clean.system.composants_materiels = add2eSpellSyncClone(clean.system.composants_materiels_objets);
  }
  if (!add2eSpellSyncHasMaterialProfile(clean.system.composants_materiels)) clean.system.composants_materiels = [];
  if (!Array.isArray(clean.system.spellLists)) clean.system.spellLists = add2eSpellSyncArray(clean.system.spellLists);

  // effectProfile est volontairement préservé lorsqu'il existe. Aucun profil vide
  // n'est créé : le futur générateur d'objets magiques ne doit consommer que des
  // profils explicitement renseignés.
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

function add2eSpellSyncClassLists(classItem) {
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
  const className = add2eSpellSyncNormalize(classItem?.name ?? system.name ?? system.label ?? system.nom ?? "");
  if (className.includes("clerc") || className.includes("pretre") || className.includes("priest") || className.includes("paladin")) lists.push("clerc");
  if (className.includes("druide") || className.includes("druid")) lists.push("druide");

  // Le flux d'auto-synchronisation historique concerne uniquement Clerc et Druide.
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

  // Repli de lecture pour les copies d'acteurs plus anciennes uniquement.
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
    return Object.keys(value)
      .filter(key => /^\d+$/.test(key))
      .sort((left, right) => Number(left) - Number(right))
      .map(key => value[key]);
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

function add2eSpellSyncCacheKeySet(cache) {
  return new Set((cache?.entries ?? []).map(entry => entry.stableKey).filter(Boolean));
}

function add2eSpellSyncIsCompendiumOwnedActorSpell(item) {
  const flags = item?.flags?.add2e ?? {};
  const source = String(item?._stats?.compendiumSource ?? item?.flags?.core?.sourceId ?? flags.sourceUuid ?? flags.sourceId ?? "");
  return flags.autoGrantedSpellSync === true || !!flags.autoGrantedByClassId || !!flags.autoGrantedByClass || source.includes("add2e.sorts");
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

function add2eSpellSyncMaxSpellLevel(classItem, actorLevel) {
  const system = classItem?.system ?? {};
  const spellcasting = add2eSpellSyncMaybeJson(system.spellcasting);
  const level = Math.max(1, Number(actorLevel) || 1);
  const startsAt = Math.max(1, Number(spellcasting?.startsAt ?? system.startsAt ?? 1) || 1);
  const hardMax = Math.max(1, Number(spellcasting?.maxSpellLevel ?? system.maxSpellLevel ?? 9) || 9);
  if (level < startsAt) return 0;
  const progression = add2eSpellSyncMaybeJson(system.progression);
  const rows = Array.isArray(progression) ? progression : [];
  const row = rows.find(entry => Number(entry?.niveau ?? entry?.level) === level) ?? rows[level - 1] ?? null;
  let highest = 0;
  if (row && typeof row === "object") {
    for (const key of ["spellsPerLevel", "SpellsPerLevel", "sortsParNiveau", "sorts_par_niveau", "spells", "slots", "spellSlots"]) {
      add2eSpellSyncSlotsArray(row[key]).forEach((value, index) => {
        if (add2eSpellSyncNumber(value, 0) > 0) highest = Math.max(highest, index + 1);
      });
    }
  }
  return highest > 0 ? Math.min(highest, hardMax) : Math.min(1, hardMax);
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
      kept.lists = [...new Set([...kept.lists, ...lists])].sort();
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

async function add2eSyncActorSpellsFromClass(actor, classItem, options = {}) {
  if (!actor || !classItem || classItem.type !== "classe") return { handled: false, imported: 0, deleted: 0 };
  const mode = options.mode === "missing" ? "missing" : "replace";
  const classLists = add2eSpellSyncClassLists(classItem);
  if (!classLists.length) return { handled: false, imported: 0, deleted: 0, reason: "not-auto-synced-class" };

  const actorLevel = Math.max(1, Number(options.actorLevel ?? add2eSpellSyncClassLevel(actor, classItem)) || 1);
  const maxSpellLevel = add2eSpellSyncMaxSpellLevel(classItem, actorLevel);
  const minSpellLevel = Math.max(1, Number(options.minSpellLevel ?? 1) || 1);
  const waitDialog = options.showWait !== false ? add2eSpellSyncOpenWaitMessage({ actor, classItem, mode, minSpellLevel, maxSpellLevel }) : null;

  try {
    const cache = await add2eBuildSpellSyncCache({ force: !!options.forceCacheRefresh || mode === "replace" });
    if (!cache.entries.length) {
      ui.notifications.error("Aucun sort trouvé dans add2e.sorts.");
      return { handled: true, imported: 0, deleted: 0, maxSpellLevel, error: "empty-cache" };
    }
    if (maxSpellLevel < 1 || minSpellLevel > maxSpellLevel) {
      await add2eSpellSyncSetLastMax(actor, maxSpellLevel);
      return { handled: true, imported: 0, deleted: 0, maxSpellLevel, mode };
    }

    const wanted = new Set(classLists.map(add2eSpellSyncNormalize));
    const selected = [];
    const selectedKeys = new Set();
    for (const entry of cache.entries) {
      if (entry.level < minSpellLevel) continue;
      if (!add2eSpellSyncCanUseSpellLevel(actor, classLists, entry.level, maxSpellLevel, { importMode: true })) continue;
      if (!entry.lists.some(list => wanted.has(list))) continue;
      if (selectedKeys.has(entry.stableKey)) continue;
      selectedKeys.add(entry.stableKey);
      selected.push(entry);
    }

    const memories = new Map();
    const idsToDelete = [];
    const actorSpells = add2eSpellSyncActorSpellKeyMap(actor);
    if (mode === "replace") {
      for (const item of actor.items.filter(entry => String(entry?.type ?? "").toLowerCase() === "sort")) {
        if (!add2eSpellSyncMatchesClassLists(item.system ?? {}, classLists) && !add2eSpellSyncIsCompendiumOwnedActorSpell(item)) continue;
        const key = add2eSpellSyncStableKey(item.name, item.system ?? {});
        if (key) memories.set(key, add2eSpellSyncMemorizationSnapshot(item));
        idsToDelete.push(item.id);
      }
    } else {
      for (const entry of selected) {
        for (const item of actorSpells.get(entry.stableKey) ?? []) {
          memories.set(entry.stableKey, add2eSpellSyncMemorizationSnapshot(item));
          idsToDelete.push(item.id);
        }
      }
    }

    const existing = [...new Set(idsToDelete)].filter(id => actor.items.has(id));
    if (existing.length) await actor.deleteEmbeddedDocuments("Item", existing, { add2eInternal: true, add2eSpellSync: true, add2eCompendiumTruth: true });

    const createData = selected.map(entry => {
      const data = add2eSpellSyncPrepareCompendiumData(add2eSpellSyncClone(entry.data));
      delete data._id;
      data.folder = null;
      foundry.utils.setProperty(data, "flags.add2e.autoGrantedByClass", classItem.name);
      foundry.utils.setProperty(data, "flags.add2e.autoGrantedByClassId", classItem.id);
      foundry.utils.setProperty(data, "flags.add2e.autoGrantedSpellSync", true);
      foundry.utils.setProperty(data, "flags.add2e.autoGrantedAtActorLevel", actorLevel);
      foundry.utils.setProperty(data, "flags.add2e.stableSpellKey", entry.stableKey);
      const memory = memories.get(entry.stableKey);
      if (memory && options.preserveMemorization !== false) {
        foundry.utils.setProperty(data, "flags.add2e.memorizedCount", memory.count);
        foundry.utils.setProperty(data, "flags.add2e.memorizedByList", memory.byList);
      }
      return data;
    });

    if (createData.length) await actor.createEmbeddedDocuments("Item", createData, { add2eInternal: true, add2eSpellSync: true });
    await add2eSpellSyncSetLastMax(actor, maxSpellLevel);
    const summary = { actor: actor.name, classe: classItem.name, actorLevel, classLists, maxSpellLevel, minSpellLevel, deleted: existing.length, imported: createData.length, mode, cacheEntries: cache.entries.length, cacheDocs: cache.docsCount, rejectedSpells: [] };
    console.info("[ADD2E][CLASS_DROP_SPELLS][DONE]", summary);
    return { handled: true, ...summary };
  } catch (error) {
    console.error("[ADD2E][CLASS_DROP_SPELLS][ERROR]", error);
    ui.notifications.error("Erreur pendant la synchronisation des sorts depuis le compendium add2e.sorts.");
    return { handled: true, imported: 0, deleted: 0, error: String(error?.message ?? error) };
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
    let deleted = 0;
    let reset = 0;

    if (levelDecreased) reset += (await add2eResetActorSpellMemorization(actor, "level-down")).reset ?? 0;
    if (!classes.length) {
      await add2eSpellSyncSetLevelSignature(actor, current);
      ADD2E_SPELL_SYNC_PREUPDATE_LEVELS.delete(actor.uuid || actor.id);
      if (reset) globalThis.add2eRerenderActorSheet?.(actor, false);
      return { handled: true, imported, deleted, reset, levelDecreased, skippedAutoSync: true };
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
      deleted += result?.deleted ?? 0;
    }

    await add2eSpellSyncSetLevelSignature(actor, current);
    ADD2E_SPELL_SYNC_PREUPDATE_LEVELS.delete(actor.uuid || actor.id);
    if (imported || deleted || reset) globalThis.add2eRerenderActorSheet?.(actor, false);
    return { handled: true, imported, deleted, reset, levelDecreased };
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
  let deleted = 0;
  const classes = add2eSpellSyncClassItems(actor).filter(classItem => add2eSpellSyncClassLists(classItem).length);
  if (!classes.length) {
    ui.notifications.info("Aucune classe à auto-synchroniser. Seuls Clerc et Druide sont alimentés automatiquement.");
    return { handled: true, imported, deleted, skippedAutoSync: true };
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
    deleted += result?.deleted ?? 0;
  }
  ui.notifications.info(imported > 0 ? `Sorts synchronisés depuis le compendium : ${imported}.` : "Aucun sort synchronisé depuis le compendium.");
  if (imported || deleted) globalThis.add2eRerenderActorSheet?.(actor, false);
  return { handled: true, imported, deleted };
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
  catch (_err) {}
}

Hooks.once("ready", () => {
  if (game.user?.isGM) add2eWarmSpellSyncCache().catch(error => console.warn("[ADD2E][SPELL_SYNC][WARMUP_ERROR]", error));
});
