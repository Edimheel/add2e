// ============================================================
// ADD2E — Synchronisation automatique des sorts
// Source stricte : compendium add2e.sorts
// Version : 2026-06-16-spell-sync-class-specific-canonical-v1
// ============================================================

const ADD2E_SPELL_SYNC_VERSION = "2026-06-16-spell-sync-class-specific-canonical-v1";
globalThis.ADD2E_SPELL_SYNC_VERSION = ADD2E_SPELL_SYNC_VERSION;

const ADD2E_SPELL_SYNC_LEGACY_SYSTEM_KEYS = Object.freeze([
  "école",
  "portée",
  "durée",
  "onuse",
  "on_use",
  "description_reelle",
  "description_source",
  "description_texte",
  "description_html",
  "composants",
  "source_composants",
  "composants_materiels_objets",
  "components",
  "componentes",
  "school",
  "range",
  "duration",
  "castingTime",
  "casting_time",
  "area",
  "areaOfEffect",
  "level",
  "lvl",
  "spellLevel",
  "niveau_sort",
  "niveauSort"
]);

const ADD2E_SPELL_SYNC_PREUPDATE_LEVELS = globalThis.ADD2E_SPELL_SYNC_PREUPDATE_LEVELS instanceof Map ? globalThis.ADD2E_SPELL_SYNC_PREUPDATE_LEVELS : new Map();
globalThis.ADD2E_SPELL_SYNC_PREUPDATE_LEVELS = ADD2E_SPELL_SYNC_PREUPDATE_LEVELS;
const ADD2E_SPELL_SYNC_RUNNING = globalThis.ADD2E_SPELL_SYNC_RUNNING instanceof Set ? globalThis.ADD2E_SPELL_SYNC_RUNNING : new Set();
globalThis.ADD2E_SPELL_SYNC_RUNNING = ADD2E_SPELL_SYNC_RUNNING;

function add2eSpellSyncClone(value) {
  if (value === undefined || value === null) return value;
  if (foundry?.utils?.deepClone) return foundry.utils.deepClone(value);
  if (foundry?.utils?.duplicate) return foundry.utils.duplicate(value);
  return JSON.parse(JSON.stringify(value));
}

function add2eSpellSyncMaybeJson(value) {
  if (typeof value !== "string") return value;
  const s = value.trim();
  if (!s) return value;
  if ((s.startsWith("{") && s.endsWith("}")) || (s.startsWith("[") && s.endsWith("]"))) {
    try { return JSON.parse(s); } catch (_e) { return value; }
  }
  return value;
}

function add2eSpellSyncNormalize(value) {
  const s = String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/\s*\([^)]*\)\s*$/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  const aliases = {
    cleric: "clerc", clerical: "clerc", clercs: "clerc", priest: "clerc", priests: "clerc", pretre: "clerc", pretres: "clerc", prêtre: "clerc", prêtres: "clerc",
    paladin: "clerc",
    druid: "druide", druids: "druide", druides: "druide", druidique: "druide",
    wizard: "magicien", mage: "magicien", magician: "magicien", magic_user: "magicien", magicien: "magicien",
    illusionist: "illusionniste", illusionniste: "illusionniste"
  };
  return aliases[s] ?? s;
}

function add2eSpellSyncArray(value) {
  value = add2eSpellSyncMaybeJson(value);
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(v => add2eSpellSyncArray(v));
  if (typeof value === "string") return value.split(/[,;|\n]+/).map(v => v.trim()).filter(Boolean);
  if (typeof value === "object") {
    for (const key of ["lists", "spellLists", "classes", "classe", "class", "value", "values", "list", "tags", "items"]) {
      if (value[key] !== undefined) return add2eSpellSyncArray(value[key]);
    }
    const numeric = Object.keys(value).filter(k => /^\d+$/.test(k)).sort((a, b) => Number(a) - Number(b)).map(k => value[k]);
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
      if (value[key] !== undefined && value[key] !== null) {
        const n = add2eSpellSyncNumber(value[key], NaN);
        if (Number.isFinite(n)) return n;
      }
    }
  }
  const s = String(value ?? "").trim();
  if (!s || s === "—" || s === "-" || /^n[\/ ]?a$/i.test(s)) return fallback;
  const m = s.match(/-?\d+(?:[.,]\d+)?/);
  if (!m) return fallback;
  const n = Number(m[0].replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}

function add2eSpellSyncIsPlaceholder(value) {
  return typeof value === "string" && /a[_\s-]*comple/i.test(value);
}

function add2eSpellSyncCleanPlaceholders(value) {
  if (add2eSpellSyncIsPlaceholder(value)) return "";
  if (Array.isArray(value)) return value.map(add2eSpellSyncCleanPlaceholders).filter(v => !(v === "" || v === null || v === undefined));
  if (value && typeof value === "object") {
    const clone = add2eSpellSyncClone(value);
    for (const [key, entry] of Object.entries(clone)) clone[key] = add2eSpellSyncCleanPlaceholders(entry);
    return clone;
  }
  return value;
}

function add2eSpellSyncFirstCleanText(...values) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    if (add2eSpellSyncIsPlaceholder(value)) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
}

function add2eSpellSyncTextValue(value) {
  value = add2eSpellSyncMaybeJson(value);
  if (value === undefined || value === null) return "";
  if (add2eSpellSyncIsPlaceholder(value)) return "";
  if (Array.isArray(value)) return value.map(add2eSpellSyncTextValue).filter(Boolean).join(", ");
  if (typeof value === "object") {
    const raw = value.raw ?? value.texte ?? value.text ?? value.label ?? value.nom ?? value.name;
    if (raw !== undefined && raw !== null && !add2eSpellSyncIsPlaceholder(raw) && String(raw).trim()) return String(raw).trim();
    const valeur = value.valeur ?? value.value ?? value.nombre ?? value.number ?? "";
    const unite = value.unite ?? value.unit ?? "";
    const joined = `${valeur ?? ""}${unite ? ` ${unite}` : ""}`.trim();
    if (joined && !add2eSpellSyncIsPlaceholder(joined)) return joined;
    return Object.values(value).map(add2eSpellSyncTextValue).filter(Boolean).join(", ");
  }
  return String(value ?? "").trim();
}

function add2eSpellSyncFirstText(...values) {
  for (const value of values) {
    const text = add2eSpellSyncTextValue(value);
    if (text) return text;
  }
  return "";
}

function add2eSpellSyncMaterialComponents(...values) {
  const result = [];
  for (const value of values) {
    const arr = add2eSpellSyncArray(value).map(add2eSpellSyncTextValue).flatMap(v => String(v ?? "").split(/[,;|\n]+/)).map(v => v.trim()).filter(Boolean);
    for (const entry of arr) if (!result.some(v => add2eSpellSyncNormalize(v) === add2eSpellSyncNormalize(entry))) result.push(entry);
  }
  return result;
}

function add2eSpellSyncOnUsePath(...values) {
  const raw = add2eSpellSyncFirstText(...values);
  if (!raw) return "";
  let path = raw.split(/[,;|\n]+/).map(v => v.trim()).find(v => v.endsWith(".js") || v.includes("/sorts/")) ?? raw.trim();
  if (path.startsWith("scripts/sorts/")) path = `systems/add2e/${path}`;
  if (path.startsWith("/systems/add2e/")) path = path.slice(1);
  return path;
}

function add2eSpellSyncSanitizeData(data) {
  const clean = add2eSpellSyncCleanPlaceholders(data);
  const system = clean.system ?? {};
  clean.system = system;

  const ecole = add2eSpellSyncFirstText(system.ecole, system["école"], system.school);
  if (ecole) system.ecole = ecole;

  const portee = add2eSpellSyncFirstText(system.portee, system["portée"], system.range);
  if (portee) system.portee = portee;

  const duree = add2eSpellSyncFirstText(system.duree, system["durée"], system.duration);
  if (duree) system.duree = duree;

  const zoneEffet = add2eSpellSyncFirstText(system.zone_effet, system.zoneEffet, system.area, system.areaOfEffect);
  if (zoneEffet) system.zone_effet = zoneEffet;

  const tempsIncantation = add2eSpellSyncFirstText(system.temps_incantation, system.tempsIncantation, system.castingTime, system.casting_time);
  if (tempsIncantation) system.temps_incantation = tempsIncantation;

  const componentTypes = add2eSpellSyncFirstText(system.composantes, system.composants, system.components, system.componentes, system.type);
  if (componentTypes) system.composantes = componentTypes;

  const materiels = add2eSpellSyncMaterialComponents(system.composants_materiels, system.composants_materiels_objets, system.materialComponents, system.material_components);
  if (materiels.length) system.composants_materiels = materiels;
  else if (!Array.isArray(system.composants_materiels)) system.composants_materiels = [];

  const materielSource = add2eSpellSyncFirstText(system.composants_materiels_source, system.source_composants);
  if (materielSource) system.composants_materiels_source = materielSource;

  const description = add2eSpellSyncFirstText(system.description, system.description_reelle, system.description_texte, system.description_html);
  if (description) system.description = description;

  const onUse = add2eSpellSyncOnUsePath(system.onUse, system.onuse, system.on_use);
  if (onUse) system.onUse = onUse;

  const niveau = add2eSpellSyncNumber(system.niveau ?? system.niveau_sort ?? system.niveauSort ?? system.spellLevel ?? system.level ?? system.lvl, NaN);
  if (Number.isFinite(niveau) && niveau > 0) system.niveau = niveau;

  system.type = "sort";

  for (const key of ADD2E_SPELL_SYNC_LEGACY_SYSTEM_KEYS) delete system[key];
  return clean;
}

function add2eSpellSyncClassItems(actor) {
  return actor?.items?.filter?.(i => String(i.type || "").toLowerCase() === "classe") ?? [];
}

function add2eSpellSyncClassSlug(classItem) {
  const sys = classItem?.system ?? {};
  return add2eSpellSyncNormalize(sys.slug ?? sys.label ?? sys.nom ?? sys.name ?? classItem?.name ?? "classe");
}

function add2eSpellSyncClassLists(classItem) {
  const sys = classItem?.system ?? {};
  const sc = add2eSpellSyncMaybeJson(sys.spellcasting);
  const raw = [
    ...add2eSpellSyncArray(sys.spellLists), ...add2eSpellSyncArray(sys.lists), ...add2eSpellSyncArray(sys.listeSorts), ...add2eSpellSyncArray(sys.liste_sorts),
    ...add2eSpellSyncArray(sys.sorts), ...add2eSpellSyncArray(sys.tags), ...add2eSpellSyncArray(sys.classe),
    ...add2eSpellSyncArray(sc?.lists), ...add2eSpellSyncArray(sc?.spellLists), ...add2eSpellSyncArray(sc?.list), ...add2eSpellSyncArray(sc?.classes)
  ];
  const lists = raw.map(add2eSpellSyncNormalize).filter(Boolean);
  const className = add2eSpellSyncNormalize(classItem?.name ?? sys.name ?? sys.label ?? sys.nom ?? "");
  if (className.includes("clerc") || className.includes("pretre") || className.includes("priest") || className.includes("paladin")) lists.push("clerc");
  if (className.includes("druide") || className.includes("druid")) lists.push("druide");
  return [...new Set(lists)].filter(v => ["clerc", "druide"].includes(v));
}

function add2eSpellSyncSpellLevel(system = {}) {
  const raw = system.niveau ?? system.niveau_sort ?? system.spellLevel ?? system.level ?? system.lvl ?? 0;
  const match = String(raw).match(/\d+/);
  return match ? Number(match[0]) || 0 : 0;
}

function add2eSpellSyncSpellLists(system = {}) {
  const raw = [
    ...add2eSpellSyncArray(system.spellLists), ...add2eSpellSyncArray(system.lists), ...add2eSpellSyncArray(system.classes),
    ...add2eSpellSyncArray(system.classe), ...add2eSpellSyncArray(system.class), ...add2eSpellSyncArray(system.liste),
    ...add2eSpellSyncArray(system.tags), ...add2eSpellSyncArray(system.effectTags)
  ];
  return [...new Set(raw.map(add2eSpellSyncNormalize).filter(Boolean))];
}

function add2eSpellSyncSlotsArray(value) {
  value = add2eSpellSyncMaybeJson(value);
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    const s = value.trim();
    if (!s) return [];
    if (/[,;|/\s]+/.test(s) && /\d/.test(s)) return s.split(/[,;|/\s]+/).map(v => v.trim()).filter(v => v !== "");
    return [];
  }
  if (typeof value === "object") {
    for (const key of ["slots", "slot", "value", "values", "spellsPerLevel", "SpellsPerLevel", "sortsParNiveau", "sorts_par_niveau", "spells", "spellSlots"]) {
      if (Array.isArray(value[key]) || typeof value[key] === "string") return add2eSpellSyncSlotsArray(value[key]);
    }
    return Object.keys(value).filter(k => /^\d+$/.test(k)).sort((a, b) => Number(a) - Number(b)).map(k => value[k]);
  }
  return [];
}

function add2eSpellSyncReadSlotValue(raw, spellLevelOrIndex, listKey = "") {
  raw = add2eSpellSyncMaybeJson(raw);
  if (raw === undefined || raw === null || raw === "") return null;
  const numeric = Number(spellLevelOrIndex);
  const idx = numeric >= 1 ? numeric - 1 : 0;
  const oneBased = idx + 1;
  const wantedList = add2eSpellSyncNormalize(listKey);
  const arr = add2eSpellSyncSlotsArray(raw);
  if (arr.length) return idx >= 0 && idx < arr.length ? add2eSpellSyncNumber(arr[idx], 0) || 0 : 0;
  if (typeof raw !== "object") return null;
  if (wantedList) {
    for (const [rawKey, value] of Object.entries(raw)) {
      if (add2eSpellSyncNormalize(rawKey) !== wantedList) continue;
      const v = add2eSpellSyncReadSlotValue(value, oneBased, "");
      if (v !== null) return v;
    }
  }
  for (const key of ["slots", "slot", "value", "values", "spellsPerLevel", "SpellsPerLevel", "sortsParNiveau", "sorts_par_niveau", "spells", "spellSlots"]) {
    if (raw[key] === undefined) continue;
    const v = add2eSpellSyncReadSlotValue(raw[key], oneBased, wantedList);
    if (v !== null) return v;
  }
  if (Object.prototype.hasOwnProperty.call(raw, String(oneBased))) return add2eSpellSyncNumber(raw[String(oneBased)], 0) || 0;
  if (Object.prototype.hasOwnProperty.call(raw, String(idx))) return add2eSpellSyncNumber(raw[String(idx)], 0) || 0;
  return null;
}

function add2eSpellSyncStableKey(name, system = {}, listOverride = "") {
  const spellName = add2eSpellSyncNormalize(name ?? system.nom ?? system.name ?? "");
  const spellLevel = add2eSpellSyncSpellLevel(system ?? {});
  const lists = listOverride
    ? [listOverride]
    : add2eSpellSyncSpellLists(system ?? {});
  const listKey = [...new Set(lists.map(add2eSpellSyncNormalize).filter(Boolean))].sort().join("+") || "liste_inconnue";
  return `${listKey}|${spellLevel}|${spellName}`;
}

function add2eSpellSyncCacheKeySet(cache) {
  return new Set((cache?.entries ?? []).map(e => e.stableKey).filter(Boolean));
}

function add2eSpellSyncIsCompendiumOwnedActorSpell(item) {
  const f = item?.flags?.add2e ?? {};
  const source = String(item?._stats?.compendiumSource ?? item?.flags?.core?.sourceId ?? f.sourceUuid ?? f.sourceId ?? "");
  return f.autoGrantedSpellSync === true || !!f.autoGrantedByClassId || !!f.autoGrantedByClass || source.includes("add2e.sorts");
}

function add2eSpellSyncExistingKeys(actor, cache = null, options = {}) {
  const keys = new Set();
  const compendiumKeys = cache ? add2eSpellSyncCacheKeySet(cache) : null;
  for (const item of actor?.items?.filter?.(i => String(i.type || "").toLowerCase() === "sort") ?? []) {
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

function add2eSpellSyncActorSpellsKnownByCompendiumButNotOwned(actor, cache, classLists = []) {
  const compendiumKeys = add2eSpellSyncCacheKeySet(cache);
  const wanted = new Set((classLists ?? []).map(add2eSpellSyncNormalize).filter(Boolean));
  const result = [];
  for (const item of actor?.items?.filter?.(i => String(i.type || "").toLowerCase() === "sort") ?? []) {
    const key = add2eSpellSyncStableKey(item.name, item.system ?? {});
    if (!key || !compendiumKeys.has(key)) continue;
    if (add2eSpellSyncIsCompendiumOwnedActorSpell(item)) continue;
    const lists = add2eSpellSyncSpellLists(item.system ?? {});
    if (wanted.size && lists.length && !lists.some(l => wanted.has(l))) continue;
    result.push(item);
  }
  return result;
}

function add2eSpellSyncLevelSignature(actor) {
  const sig = {};
  const classes = add2eSpellSyncClassItems(actor);
  const isMulti = actor?.system?.multiclasse?.enabled === true || classes.length > 1;
  const put = (key, value) => {
    const n = add2eSpellSyncNumber(value, NaN);
    if (Number.isFinite(n) && n >= 0) sig[add2eSpellSyncNormalize(key)] = Math.floor(n);
  };
  if (!isMulti) put("__mono", actor?.system?.niveau ?? actor?.system?.level ?? actor?.system?.niveau_total ?? actor?.system?.levelTotal);
  for (const cls of classes) put(add2eSpellSyncClassSlug(cls) || cls.id || cls.name, cls?.system?.niveau ?? cls?.system?.level ?? cls?.system?.currentLevel ?? cls?.system?.niveauActuel);
  for (const root of [actor?.system?.niveaux_par_classe, actor?.system?.niveauxParClasse, actor?.system?.levelsByClass, actor?.system?.classLevels]) {
    if (!root || typeof root !== "object") continue;
    for (const [key, value] of Object.entries(root)) put(key, value?.niveau ?? value?.level ?? value?.value ?? value);
  }
  return sig;
}

function add2eSpellSyncHasLevelDecrease(previous = {}, current = {}) {
  for (const [key, oldValue] of Object.entries(previous ?? {})) {
    if (!Number.isFinite(Number(oldValue))) continue;
    const now = Number(current?.[key]);
    if (Number.isFinite(now) && now < Number(oldValue)) return true;
  }
  return false;
}

function add2eSpellSyncGetPreviousSignature(actor) {
  const key = actor?.uuid || actor?.id;
  const captured = key ? ADD2E_SPELL_SYNC_PREUPDATE_LEVELS.get(key) : null;
  if (captured) return captured;
  const flag = actor?.getFlag?.("add2e", "autoSpellSyncLevelSignature");
  return flag && typeof flag === "object" ? flag : null;
}

async function add2eSpellSyncSetLevelSignature(actor, signature) {
  if (actor?.setFlag) await actor.setFlag("add2e", "autoSpellSyncLevelSignature", signature ?? add2eSpellSyncLevelSignature(actor));
}

async function add2eResetActorSpellMemorization(actor, reason = "level-down") {
  if (!actor?.items || actor.type !== "personnage") return { reset: 0 };
  const updates = [];
  for (const sort of actor.items.filter(i => String(i.type || "").toLowerCase() === "sort")) {
    const current = Number(sort.getFlag?.("add2e", "memorizedCount") ?? sort.flags?.add2e?.memorizedCount ?? 0) || 0;
    const byList = sort.getFlag?.("add2e", "memorizedByList") ?? sort.flags?.add2e?.memorizedByList ?? {};
    const hasByList = byList && typeof byList === "object" && Object.values(byList).some(v => Number(v) > 0);
    if (current <= 0 && !hasByList) continue;
    updates.push({ _id: sort.id, "flags.add2e.memorizedCount": 0, "flags.add2e.memorizedByList": {} });
  }
  if (updates.length) await actor.updateEmbeddedDocuments("Item", updates, { add2eInternal: true, add2eSpellSync: true, reason });
  if (updates.length) console.info("[ADD2E][SPELL_SYNC][MEMORIZED_RESET]", { actor: actor.name, reason, reset: updates.length });
  return { reset: updates.length };
}

function add2eSpellSyncMaxSpellLevel(classItem, actorLevel) {
  const sys = classItem?.system ?? {};
  const sc = add2eSpellSyncMaybeJson(sys.spellcasting);
  const level = Math.max(1, Number(actorLevel) || 1);
  const startsAt = Math.max(1, Number(sc?.startsAt ?? sys.startsAt ?? 1) || 1);
  const hardMax = Math.max(1, Number(sc?.maxSpellLevel ?? sys.maxSpellLevel ?? 9) || 9);
  if (level < startsAt) return 0;
  const progression = add2eSpellSyncMaybeJson(sys.progression);
  const rows = Array.isArray(progression) ? progression : [];
  const row = rows.find(r => Number(r?.niveau ?? r?.level) === level) ?? rows[level - 1] ?? null;
  let maxFromSlots = 0;
  if (row && typeof row === "object") {
    for (const field of ["spellsPerLevel", "SpellsPerLevel", "sortsParNiveau", "sorts_par_niveau", "spells", "slots", "spellSlots"]) {
      add2eSpellSyncSlotsArray(row[field]).forEach((value, index) => { if (add2eSpellSyncNumber(value, 0) > 0) maxFromSlots = Math.max(maxFromSlots, index + 1); });
    }
  }
  if (maxFromSlots > 0) return Math.min(maxFromSlots, hardMax);
  return Math.min(1, hardMax);
}

function add2eSpellSyncClassLevel(actor, classItem = null) {
  if (typeof globalThis.add2eSpellClassLevel === "function") return globalThis.add2eSpellClassLevel(actor, add2eSpellSyncClassSlug(classItem));
  return Math.max(1, Number(classItem?.system?.niveau ?? classItem?.system?.level ?? actor?.system?.niveau ?? actor?.system?.level ?? 1) || 1);
}

function add2eSpellSyncGetProgressionRow(actor, actorLevel = null) {
  const level = Math.max(1, Number(actorLevel ?? actor?.system?.niveau) || 1);
  const classItem = actor?.items?.find?.(i => String(i.type || "").toLowerCase() === "classe") ?? null;
  const details = classItem?.system ?? actor?.system?.details_classe ?? {};
  const progression = add2eSpellSyncMaybeJson(details?.progression);
  const rows = Array.isArray(progression) ? progression : [];
  return rows.find(r => Number(r?.niveau ?? r?.level) === level) ?? rows[level - 1] ?? null;
}

function add2eSpellSyncSlotProbe(actor, classLists, spellLevel) {
  const lvl = Number(spellLevel) || 0;
  const row = add2eSpellSyncGetProgressionRow(actor);
  if (!row || typeof row !== "object" || lvl < 1) return { found: false, count: 0, source: "no-row" };
  const raw = row.spellsPerLevel ?? row.SpellsPerLevel ?? row.sortsParNiveau ?? row.sorts_par_niveau ?? row.spells ?? row.slots ?? row.spellSlots;
  const value = add2eSpellSyncReadSlotValue(raw, lvl, classLists?.[0] ?? "");
  if (value === null) return { found: false, count: 0, source: "no-slot-source" };
  return { found: true, count: Number(value) || 0, source: "progression" };
}

function add2eSpellSyncCanUseSpellLevel(actor, classLists, spellLevel, fallbackMaxSpellLevel, options = {}) {
  const lvl = Number(spellLevel) || 0;
  if (lvl < 1) return false;
  const max = Number(fallbackMaxSpellLevel) || 0;
  if (options.importMode === true || options.mode === "import") return max > 0 && lvl <= max;
  const probe = add2eSpellSyncSlotProbe(actor, classLists, lvl);
  if (probe.found) return probe.count > 0;
  return max > 0 && lvl <= max;
}

function add2eSpellSyncMaxExistingLevel(actor, classLists = []) {
  const wantedLists = new Set((classLists ?? []).map(add2eSpellSyncNormalize).filter(Boolean));
  let max = 0;
  for (const item of actor?.items?.filter?.(i => String(i.type || "").toLowerCase() === "sort") ?? []) {
    const itemLists = add2eSpellSyncSpellLists(item.system ?? {});
    if (wantedLists.size && itemLists.length && !itemLists.some(l => wantedLists.has(l))) continue;
    const lvl = add2eSpellSyncSpellLevel(item.system ?? {});
    if (lvl > max) max = lvl;
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
  const wantedLists = new Set((classLists ?? []).map(add2eSpellSyncNormalize).filter(Boolean));
  if (!wantedLists.size) return false;
  const spellLists = add2eSpellSyncSpellLists(system);
  return spellLists.some(list => wantedLists.has(list));
}
function add2eSpellSyncBuildCacheKey(pack) { return String(pack?.collection || pack?.metadata?.id || "add2e.sorts"); }
function add2eInvalidateSpellSyncCache() { globalThis.ADD2E_SPELL_SYNC_CACHE = null; }

async function add2eBuildSpellSyncCache({ force = false } = {}) {
  const pack = game.packs.get("add2e.sorts");
  if (!pack) throw new Error("Compendium de sorts introuvable : add2e.sorts");
  const cacheKey = add2eSpellSyncBuildCacheKey(pack);
  const existing = globalThis.ADD2E_SPELL_SYNC_CACHE;
  if (!force && existing?.cacheKey === cacheKey && Array.isArray(existing.entries) && existing.entries.length > 0) return existing;
  const docs = await pack.getDocuments();
  const entries = [];
  const byKey = new Map();
  const duplicateKeys = [];
  const skipped = [];
  let nonSortDocuments = 0, sanitizedDocuments = 0;
  for (const doc of docs) {
    if (!doc || doc.type !== "sort") { nonSortDocuments += 1; continue; }
    const rawData = doc.toObject();
    const hadPlaceholders = JSON.stringify(rawData).match(/a[_\s-]*comple/i) !== null;
    const data = add2eSpellSyncSanitizeData(rawData);
    if (hadPlaceholders) sanitizedDocuments += 1;
    const system = data.system ?? {};
    const level = add2eSpellSyncSpellLevel(system);
    const lists = add2eSpellSyncSpellLists(system);
    const stableKey = add2eSpellSyncStableKey(data.name, system);
    if (!stableKey || level < 1 || !lists.length) { skipped.push({ name: data.name, level, lists, reason: "invalid-compendium-entry" }); continue; }
    if (byKey.has(stableKey)) {
      const kept = byKey.get(stableKey);
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
    byKey.set(stableKey, entry);
    entries.push(entry);
  }
  entries.sort((a, b) => a.level - b.level || String(a.name).localeCompare(String(b.name), "fr") || a.stableKey.localeCompare(b.stableKey, "fr"));
  const cache = { cacheKey, builtAt: Date.now(), entries, count: entries.length, docsCount: docs.length, nonSortDocuments, duplicateCount: duplicateKeys.length, duplicateKeys, skippedCount: skipped.length, skipped, sanitizedDocuments, byStableKey: byKey };
  globalThis.ADD2E_SPELL_SYNC_CACHE = cache;
  console.info("[ADD2E][SPELL_SYNC][CACHE_READY]", { version: ADD2E_SPELL_SYNC_VERSION, entries: entries.length, docs: docs.length, duplicateCount: duplicateKeys.length, skipped: skipped.length, sanitizedDocuments });
  return cache;
}
async function add2eWarmSpellSyncCache() { return add2eBuildSpellSyncCache({ force: false }); }
async function add2eReloadSpellSyncCache() { add2eInvalidateSpellSyncCache(); return add2eBuildSpellSyncCache({ force: true }); }

async function add2ePruneActorSpellsForClassLevel(actor, classItem, actorLevel, options = {}) {
  if (!actor || !classItem || classItem.type !== "classe") return { handled: false, deleted: 0, maxSpellLevel: 0 };
  const classLists = add2eSpellSyncClassLists(classItem);
  if (!classLists.length) return { handled: false, deleted: 0, maxSpellLevel: 0 };
  const level = Math.max(1, Number(actorLevel ?? add2eSpellSyncClassLevel(actor, classItem)) || 1);
  const maxSpellLevel = add2eSpellSyncMaxSpellLevel(classItem, level);
  const idsToDelete = [];
  for (const sort of actor.items?.filter?.(i => String(i.type || "").toLowerCase() === "sort") ?? []) {
    const sys = sort.system ?? {};
    const spellLevel = add2eSpellSyncSpellLevel(sys);
    if (!add2eSpellSyncMatchesClassLists(sys, classLists)) continue;
    if (!(maxSpellLevel >= 1 && add2eSpellSyncCanUseSpellLevel(actor, classLists, spellLevel, maxSpellLevel, { importMode: true }))) idsToDelete.push(sort.id);
  }
  const existingIds = idsToDelete.filter(id => actor.items.has(id));
  if (existingIds.length) await actor.deleteEmbeddedDocuments("Item", existingIds, { add2eInternal: true, add2eSpellSync: true });
  await add2eSpellSyncSetLastMax(actor, maxSpellLevel);
  if (options.notify !== false && existingIds.length) ui.notifications.info(`Sorts non accessibles retirés : ${existingIds.length}.`);
  return { handled: true, deleted: existingIds.length, maxSpellLevel, actorLevel: level };
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
    const cache = await add2eBuildSpellSyncCache({ force: !!options.forceCacheRefresh });
    if (!cache.entries.length) { ui.notifications.error("Aucun sort trouvé dans add2e.sorts."); return { handled: true, imported: 0, deleted: 0, maxSpellLevel, error: "empty-cache" }; }

    const existingSpellIds = actor.items.filter(i => String(i.type || "").toLowerCase() === "sort").map(i => i.id).filter(id => actor.items.has(id));
    let deleted = 0;
    const memoryByKey = new Map();
    if (mode === "replace" && existingSpellIds.length) {
      await actor.deleteEmbeddedDocuments("Item", existingSpellIds, { add2eInternal: true, add2eSpellSync: true });
      deleted += existingSpellIds.length;
    } else if (mode === "missing") {
      const toReplace = add2eSpellSyncActorSpellsKnownByCompendiumButNotOwned(actor, cache, classLists);
      for (const item of toReplace) memoryByKey.set(add2eSpellSyncStableKey(item.name, item.system ?? {}), add2eSpellSyncMemorizationSnapshot(item));
      const ids = toReplace.map(i => i.id).filter(id => actor.items.has(id));
      if (ids.length) {
        await actor.deleteEmbeddedDocuments("Item", ids, { add2eInternal: true, add2eSpellSync: true, add2eCompendiumTruth: true });
        deleted += ids.length;
      }
    }

    if (maxSpellLevel < 1 || minSpellLevel > maxSpellLevel) { await add2eSpellSyncSetLastMax(actor, maxSpellLevel); return { handled: true, imported: 0, deleted, maxSpellLevel, mode }; }

    const classListSet = new Set(classLists.map(add2eSpellSyncNormalize));
    const existingKeys = mode === "missing" ? add2eSpellSyncExistingKeys(actor, cache, { sourceTruth: true }) : new Set();
    const selectedKeys = new Set();
    const createData = [];
    const rejectedSpells = [];
    for (const entry of cache.entries) {
      const spellLevel = entry.level;
      if (spellLevel < minSpellLevel) continue;
      if (!add2eSpellSyncCanUseSpellLevel(actor, classLists, spellLevel, maxSpellLevel, { importMode: true })) continue;
      if (!entry.lists.some(list => classListSet.has(list))) continue;
      if (existingKeys.has(entry.stableKey)) continue;
      if (selectedKeys.has(entry.stableKey)) continue;
      selectedKeys.add(entry.stableKey);
      const data = add2eSpellSyncSanitizeData(add2eSpellSyncClone(entry.data));
      delete data._id;
      data.folder = null;
      foundry.utils.setProperty(data, "flags.add2e.autoGrantedByClass", classItem.name);
      foundry.utils.setProperty(data, "flags.add2e.autoGrantedByClassId", classItem.id);
      foundry.utils.setProperty(data, "flags.add2e.autoGrantedSpellSync", true);
      foundry.utils.setProperty(data, "flags.add2e.autoGrantedAtActorLevel", actorLevel);
      foundry.utils.setProperty(data, "flags.add2e.stableSpellKey", entry.stableKey);
      const preserved = memoryByKey.get(entry.stableKey);
      if (preserved && options.preserveMemorization !== false) {
        foundry.utils.setProperty(data, "flags.add2e.memorizedCount", preserved.count);
        foundry.utils.setProperty(data, "flags.add2e.memorizedByList", preserved.byList);
      }
      createData.push(data);
    }
    if (createData.length) await actor.createEmbeddedDocuments("Item", createData, { add2eInternal: true, add2eSpellSync: true });
    await add2eSpellSyncSetLastMax(actor, maxSpellLevel);
    const summary = { actor: actor.name, classe: classItem.name, actorLevel, classLists, maxSpellLevel, minSpellLevel, deleted, imported: createData.length, mode, cacheEntries: cache.entries.length, cacheDocs: cache.docsCount, rejectedSpells };
    console.info("[ADD2E][CLASS_DROP_SPELLS][DONE]", summary);
    return { handled: true, imported: createData.length, deleted, maxSpellLevel, minSpellLevel, mode, cacheEntries: cache.entries.length, cacheDocs: cache.docsCount, rejectedSpells };
  } catch (err) {
    console.error("[ADD2E][CLASS_DROP_SPELLS][ERROR]", err);
    ui.notifications.error("Erreur pendant la synchronisation des sorts depuis le compendium add2e.sorts.");
    return { handled: true, imported: 0, deleted: 0, error: String(err?.message ?? err) };
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
    const classItems = add2eSpellSyncClassItems(actor).filter(cls => add2eSpellSyncClassLists(cls).length);
    let imported = 0, deleted = 0, reset = 0;

    if (levelDecreased) {
      const resetResult = await add2eResetActorSpellMemorization(actor, "level-down");
      reset += resetResult.reset ?? 0;
    }

    if (!classItems.length) {
      await add2eSpellSyncSetLevelSignature(actor, current);
      const key = actor.uuid || actor.id;
      if (key) ADD2E_SPELL_SYNC_PREUPDATE_LEVELS.delete(key);
      if (reset) add2eRerenderActorSheet?.(actor, false);
      return { handled: true, imported: 0, deleted: 0, reset, levelDecreased, skippedAutoSync: true };
    }

    for (const classItem of classItems) {
      const level = Math.max(1, Number(newLevel ?? add2eSpellSyncClassLevel(actor, classItem)) || 1);
      const classLists = add2eSpellSyncClassLists(classItem);
      const maxSpellLevel = add2eSpellSyncMaxSpellLevel(classItem, level);
      const lastFlagMax = add2eSpellSyncGetLastMax(actor);
      const existingMaxBeforePrune = add2eSpellSyncMaxExistingLevel(actor, classLists);
      const knownBeforePrune = Math.max(lastFlagMax, existingMaxBeforePrune);
      const prune = await add2ePruneActorSpellsForClassLevel(actor, classItem, level, { notify: true });
      deleted += prune?.deleted ?? 0;
      if (!levelDecreased && maxSpellLevel < knownBeforePrune) {
        const resetResult = await add2eResetActorSpellMemorization(actor, "spell-cap-down");
        reset += resetResult.reset ?? 0;
      }
      const previousKnownMax = Math.max(add2eSpellSyncGetLastMax(actor), add2eSpellSyncMaxExistingLevel(actor, classLists));
      const minSpellLevel = maxSpellLevel > previousKnownMax ? previousKnownMax + 1 : 1;
      const result = await add2eSyncActorSpellsFromClass(actor, classItem, { mode: "missing", actorLevel: level, minSpellLevel, showWait: maxSpellLevel > previousKnownMax, forceCacheRefresh: false, preserveMemorization: !levelDecreased });
      imported += result?.imported ?? 0;
      deleted += result?.deleted ?? 0;
    }
    await add2eSpellSyncSetLevelSignature(actor, current);
    const key = actor.uuid || actor.id;
    if (key) ADD2E_SPELL_SYNC_PREUPDATE_LEVELS.delete(key);
    if (imported || deleted || reset) add2eRerenderActorSheet?.(actor, false);
    return { handled: true, imported, deleted, reset, levelDecreased };
  } finally {
    ADD2E_SPELL_SYNC_RUNNING.delete(runKey);
  }
}

async function add2eResyncSelectedActorSpells(options = {}) {
  const actor = canvas?.tokens?.controlled?.[0]?.actor ?? game.user?.character ?? null;
  if (!actor) { ui.notifications.warn("Sélectionne un token ou définis un personnage utilisateur."); return null; }
  add2eInvalidateSpellSyncCache();
  let imported = 0, deleted = 0;
  const autoClasses = add2eSpellSyncClassItems(actor).filter(cls => add2eSpellSyncClassLists(cls).length);
  if (!autoClasses.length) {
    ui.notifications.info("Aucune classe à auto-synchroniser. Seuls Clerc et Druide sont alimentés automatiquement.");
    return { handled: true, imported: 0, deleted: 0, skippedAutoSync: true };
  }
  for (const classItem of autoClasses) {
    const result = await add2eSyncActorSpellsFromClass(actor, classItem, { mode: "missing", actorLevel: add2eSpellSyncClassLevel(actor, classItem), minSpellLevel: 1, showWait: options.showWait !== false, forceCacheRefresh: true });
    imported += result?.imported ?? 0;
    deleted += result?.deleted ?? 0;
  }
  ui.notifications.info(imported > 0 ? `Sorts manquants importés : ${imported}.` : "Aucun sort manquant importé depuis le compendium.");
  if (imported || deleted) add2eRerenderActorSheet?.(actor, false);
  return { handled: true, imported, deleted };
}

function add2eSpellSyncChangeTouchesLevels(changes = {}) {
  return foundry.utils.hasProperty(changes, "system.niveau") || foundry.utils.hasProperty(changes, "system.level") || foundry.utils.hasProperty(changes, "system.niveau_total") || foundry.utils.hasProperty(changes, "system.levelTotal") || foundry.utils.hasProperty(changes, "system.niveaux_par_classe") || foundry.utils.hasProperty(changes, "system.niveauxParClasse") || foundry.utils.hasProperty(changes, "system.levelsByClass") || foundry.utils.hasProperty(changes, "system.classLevels") || foundry.utils.hasProperty(changes, "system.multiclasse");
}

Hooks.on("preUpdateActor", (actor, changes = {}, _options = {}, _userId) => {
  if (!actor || actor.type !== "personnage" || !add2eSpellSyncChangeTouchesLevels(changes)) return;
  ADD2E_SPELL_SYNC_PREUPDATE_LEVELS.set(actor.uuid || actor.id, add2eSpellSyncLevelSignature(actor));
});

Hooks.on("updateActor", async (actor, changes = {}, options = {}, _userId) => {
  if (!game.user?.isGM || options?.add2eInternal || !actor || actor.type !== "personnage") return;
  if (!add2eSpellSyncChangeTouchesLevels(changes)) return;
  window.setTimeout(() => add2eSyncNewSpellLevelsAfterActorLevelChange(actor, null, { reason: "updateActor-level-change" }).catch(err => console.error("[ADD2E][SPELL_SYNC][LEVEL_CHANGE_ERROR]", err)), 80);
});

for (const [name, fn] of Object.entries({
  add2eSpellSyncClone, add2eSpellSyncMaybeJson, add2eSpellSyncNormalize, add2eSpellSyncArray, add2eSpellSyncClassLists, add2eSpellSyncSpellLevel,
  add2eSpellSyncSpellLists, add2eSpellSyncNumber, add2eSpellSyncSlotsArray, add2eSpellSyncReadSlotValue, add2eSpellSyncMaxSpellLevel,
  add2eSpellSyncGetProgressionRow, add2eSpellSyncSlotProbe, add2eSpellSyncCanUseSpellLevel, add2eSpellSyncStableKey,
  add2eSpellSyncExistingKeys, add2eSpellSyncMaxExistingLevel, add2eSpellSyncGetLastMax, add2eSpellSyncSetLastMax, add2eSpellSyncOpenWaitMessage,
  add2eSpellSyncCloseWaitMessage, add2eSpellSyncMatchesClassLists, add2eBuildSpellSyncCache, add2eWarmSpellSyncCache, add2eReloadSpellSyncCache,
  add2eInvalidateSpellSyncCache, add2ePruneActorSpellsForClassLevel, add2eSyncActorSpellsFromClass, add2eSyncNewSpellLevelsAfterActorLevelChange,
  add2eResyncSelectedActorSpells, add2eResetActorSpellMemorization
})) {
  try { globalThis[name] = fn; } catch (_e) {}
}

Hooks.once("ready", () => {
  if (game.user?.isGM) add2eWarmSpellSyncCache().catch(err => console.warn("[ADD2E][SPELL_SYNC][WARMUP_ERROR]", err));
});
