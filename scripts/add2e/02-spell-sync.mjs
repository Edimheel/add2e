// ============================================================
// ADD2E — Synchronisation automatique des sorts au drop de classe
// Fonctionne dans add2e.mjs, sans actor-sheet.mjs
// Version : 2026-05-19-spell-sync-v4-cache-getDocuments
// ============================================================

const ADD2E_SPELL_SYNC_VERSION = "2026-05-19-spell-sync-v4-cache-getDocuments";
globalThis.ADD2E_SPELL_SYNC_VERSION = ADD2E_SPELL_SYNC_VERSION;
console.log("[ADD2E][SPELL_SYNC][VERSION]", ADD2E_SPELL_SYNC_VERSION);

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
    .replace(/[\s\-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  const aliases = {
    cleric: "clerc",
    clerical: "clerc",
    clercs: "clerc",
    priest: "clerc",
    priests: "clerc",
    pretre: "clerc",
    pretres: "clerc",
    druid: "druide",
    druids: "druide",
    druides: "druide",
    druidique: "druide"
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
    const numericValues = Object.keys(value)
      .filter(k => /^\d+$/.test(k))
      .sort((a, b) => Number(a) - Number(b))
      .map(k => value[k]);
    if (numericValues.length) return add2eSpellSyncArray(numericValues);
  }
  return [value];
}

function add2eSpellSyncClassLists(classItem) {
  const sys = classItem?.system ?? {};
  const sc = add2eSpellSyncMaybeJson(sys.spellcasting);
  const raw = [
    ...add2eSpellSyncArray(sys.spellLists),
    ...add2eSpellSyncArray(sys.sorts),
    ...add2eSpellSyncArray(sys.tags),
    ...add2eSpellSyncArray(sc?.lists),
    ...add2eSpellSyncArray(sc?.spellLists)
  ];

  const lists = raw.map(add2eSpellSyncNormalize).filter(Boolean);
  const className = add2eSpellSyncNormalize(classItem?.name ?? "");
  if (className.includes("clerc")) lists.push("clerc");
  if (className.includes("druide")) lists.push("druide");

  return [...new Set(lists)].filter(v => ["clerc", "druide"].includes(v));
}

function add2eSpellSyncSpellLevel(system = {}) {
  const raw = system.niveau ?? system.niveau_sort ?? system.spellLevel ?? system.level ?? system.lvl ?? 0;
  const match = String(raw).match(/\d+/);
  return match ? Number(match[0]) || 0 : 0;
}

function add2eSpellSyncSpellLists(system = {}) {
  const raw = [
    ...add2eSpellSyncArray(system.spellLists),
    ...add2eSpellSyncArray(system.lists),
    ...add2eSpellSyncArray(system.classes),
    ...add2eSpellSyncArray(system.classe),
    ...add2eSpellSyncArray(system.class),
    ...add2eSpellSyncArray(system.tags),
    ...add2eSpellSyncArray(system.effectTags)
  ];
  return [...new Set(raw.map(add2eSpellSyncNormalize).filter(Boolean))];
}

function add2eSpellSyncNumber(value) {
  value = add2eSpellSyncMaybeJson(value);
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "string") {
    const s = value.trim();
    if (!s || s === "—" || s === "-" || /^n[\/ ]?a$/i.test(s)) return 0;
    const m = s.match(/-?\d+/);
    return m ? Number(m[0]) || 0 : 0;
  }
  if (value && typeof value === "object") {
    for (const key of ["value", "valeur", "slots", "slot", "count", "nombre", "nb", "max"]) {
      if (value[key] !== undefined && value[key] !== null && typeof value[key] !== "object") return add2eSpellSyncNumber(value[key]);
    }
  }
  return 0;
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
    for (const key of ["slots", "slot", "value", "values", "spellsPerLevel", "sortsParNiveau", "sorts_par_niveau", "spells", "spellSlots"]) {
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
  if (arr.length) return idx >= 0 && idx < arr.length ? add2eSpellSyncNumber(arr[idx]) : 0;
  if (typeof raw !== "object") return null;

  if (wantedList) {
    for (const [rawKey, value] of Object.entries(raw)) {
      if (add2eSpellSyncNormalize(rawKey) !== wantedList) continue;
      const v = add2eSpellSyncReadSlotValue(value, oneBased, "");
      if (v !== null) return v;
    }
  }

  for (const key of ["slots", "slot", "value", "values", "spellsPerLevel", "sortsParNiveau", "sorts_par_niveau", "spells", "spellSlots"]) {
    if (raw[key] === undefined) continue;
    const v = add2eSpellSyncReadSlotValue(raw[key], oneBased, wantedList);
    if (v !== null) return v;
  }

  if (Object.prototype.hasOwnProperty.call(raw, String(oneBased))) return add2eSpellSyncNumber(raw[String(oneBased)]);
  if (Object.prototype.hasOwnProperty.call(raw, String(idx))) return add2eSpellSyncNumber(raw[String(idx)]);
  return null;
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

  const maxFromArray = (raw) => {
    const arr = add2eSpellSyncSlotsArray(raw);
    let max = 0;
    arr.forEach((value, index) => {
      const n = add2eSpellSyncNumber(value);
      if (n > 0) max = Math.max(max, index + 1);
    });
    return max;
  };

  const maxFromContainer = (raw) => {
    raw = add2eSpellSyncMaybeJson(raw);
    if (!raw || typeof raw !== "object") return 0;
    if (Array.isArray(raw)) return maxFromArray(raw);
    let max = 0;
    for (const value of Object.values(raw)) {
      if (Array.isArray(value)) max = Math.max(max, maxFromArray(value));
      else if (value && typeof value === "object") {
        max = Math.max(
          max,
          maxFromArray(value),
          maxFromArray(value.slots),
          maxFromArray(value.value),
          maxFromArray(value.values),
          maxFromArray(value.spellsPerLevel),
          maxFromArray(value.sortsParNiveau)
        );
      }
    }
    return max;
  };

  let maxFromSlots = 0;
  if (row && typeof row === "object") {
    for (const field of ["spellsPerLevel", "sortsParNiveau", "sorts_par_niveau", "spells", "slots", "spellSlots"]) {
      maxFromSlots = Math.max(maxFromSlots, maxFromArray(row[field]));
    }
    for (const container of ["spellSlotsByList", "spellsByList", "spellsPerLevelByList", "sortsParListe"]) {
      maxFromSlots = Math.max(maxFromSlots, maxFromContainer(row[container]));
    }
    for (const [key, value] of Object.entries(row)) {
      if (!/^spellsPerLevel|^sortsParNiveau|^spellSlots/i.test(key)) continue;
      maxFromSlots = Math.max(maxFromSlots, maxFromArray(value), maxFromContainer(value));
    }
  }

  if (maxFromSlots > 0) return Math.min(maxFromSlots, hardMax);
  return Math.min(1, hardMax);
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
  const wanted = (classLists ?? []).map(add2eSpellSyncNormalize).filter(Boolean);
  if (!row || typeof row !== "object" || lvl < 1) return { found: false, count: 0, source: "no-row" };

  let found = false;
  let count = 0;
  const read = (raw, listKey = "") => {
    if (raw === undefined || raw === null || raw === "") return;
    const v = add2eSpellSyncReadSlotValue(raw, lvl, listKey);
    if (v === null) return;
    found = true;
    count = Math.max(count, Number(v) || 0);
  };

  for (const field of ["spellsPerLevel", "sortsParNiveau", "sorts_par_niveau", "spells", "slots", "spellSlots"]) read(row[field]);

  for (const containerName of ["spellSlotsByList", "spellsByList", "spellsPerLevelByList", "sortsParListe"]) {
    const c = row[containerName];
    if (!c || typeof c !== "object") continue;
    for (const [rawKey, value] of Object.entries(c)) {
      const key = add2eSpellSyncNormalize(rawKey);
      if (wanted.length && !wanted.includes(key)) continue;
      read(value, key);
    }
  }

  for (const [rawField, value] of Object.entries(row)) {
    const field = add2eSpellSyncNormalize(rawField);
    if (!/^(spellsperlevel|sortsparniveau|spellslots|slots)/i.test(field)) continue;
    const matchesNamedList = !wanted.length || wanted.some(list => field.includes(list));
    if (!matchesNamedList) continue;
    read(value);
  }

  return { found, count, source: found ? "progression" : "no-slot-source" };
}

function add2eSpellSyncCanUseSpellLevel(actor, classLists, spellLevel, fallbackMaxSpellLevel) {
  const lvl = Number(spellLevel) || 0;
  if (lvl < 1) return false;
  const probe = add2eSpellSyncSlotProbe(actor, classLists, lvl);
  if (probe.found) return probe.count > 0;

  try {
    if (typeof add2eGetSpellSlotPoolsByLevel === "function") {
      const pools = add2eGetSpellSlotPoolsByLevel(actor) ?? {};
      let sawMatchingPool = false;
      for (const rawList of classLists ?? []) {
        const key = add2eSpellSyncNormalize(rawList);
        const pool = pools[key];
        if (!pool) continue;
        sawMatchingPool = true;
        const slots = Number(pool.slotsByLevel?.[lvl] ?? 0) || 0;
        if (slots > 0) return true;
      }
      if (sawMatchingPool) return false;
    }
  } catch (e) {
    console.warn("[ADD2E][CLASS_DROP_SPELLS] Fallback maxSpellLevel utilisé.", e);
  }

  return lvl <= (Number(fallbackMaxSpellLevel) || 0);
}

function add2eSpellSyncStableKey(name, system = {}) {
  const spellName = add2eSpellSyncNormalize(name ?? system.nom ?? system.name ?? "");
  const spellLevel = add2eSpellSyncSpellLevel(system ?? {});
  return `${spellLevel}|${spellName}`;
}

function add2eSpellSyncExistingKeys(actor) {
  const keys = new Set();
  for (const item of actor?.items?.filter?.(i => String(i.type || "").toLowerCase() === "sort") ?? []) {
    const key = add2eSpellSyncStableKey(item.name, item.system ?? {});
    if (key && key !== "0|") keys.add(key);
  }
  return keys;
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
  if (!actor?.setFlag) return;
  const n = Math.max(0, Number(value) || 0);
  await actor.setFlag("add2e", "autoSpellSyncMaxLevel", n);
}

function add2eSpellSyncOpenWaitMessage({ actor, classItem, mode, minSpellLevel, maxSpellLevel } = {}) {
  const title = mode === "missing" ? "Import des nouveaux sorts" : "Import des sorts de classe";
  const range = mode === "missing" && minSpellLevel > 0
    ? `Niveaux de sort ${minSpellLevel} à ${maxSpellLevel}`
    : `Jusqu’au niveau de sort ${maxSpellLevel}`;

  const content = `
    <div class="add2e-spell-sync-wait" style="padding:0.8em 0.9em;line-height:1.45;">
      <p style="margin:0 0 0.55em 0;"><b>${title}</b></p>
      <p style="margin:0 0 0.35em 0;">Personnage : <b>${actor?.name ?? "—"}</b></p>
      <p style="margin:0 0 0.35em 0;">Classe : <b>${classItem?.name ?? "—"}</b></p>
      <p style="margin:0 0 0.7em 0;">${range}</p>
      <div style="display:flex;align-items:center;gap:0.55em;color:#6f4b12;font-weight:700;">
        <i class="fas fa-spinner fa-spin"></i>
        <span>Synchronisation en cours, ne fermez pas la fiche...</span>
      </div>
    </div>
  `;

  try {
    const dialog = new Dialog({ title, content, buttons: {}, close: () => {} }, { width: 420, height: "auto" });
    dialog.render(true);
    return dialog;
  } catch (_e) {
    ui.notifications.info(`${title} en cours...`);
    return null;
  }
}

function add2eSpellSyncCloseWaitMessage(dialog) {
  try { dialog?.close?.({ submit: false }); } catch (_e) {}
}

function add2eSpellSyncMatchesClassLists(sortOrSystem, classLists = []) {
  const system = sortOrSystem?.system ?? sortOrSystem ?? {};
  const wantedLists = new Set((classLists ?? []).map(add2eSpellSyncNormalize).filter(Boolean));
  if (!wantedLists.size) return false;
  const spellLists = add2eSpellSyncSpellLists(system);
  return spellLists.some(list => wantedLists.has(list));
}

function add2eSpellSyncBuildCacheKey(pack) {
  return String(pack?.collection || pack?.metadata?.id || "add2e.sorts");
}

function add2eInvalidateSpellSyncCache() {
  globalThis.ADD2E_SPELL_SYNC_CACHE = null;
  console.warn("[ADD2E][SPELL_SYNC][CACHE_INVALIDATED]");
}

async function add2eBuildSpellSyncCache({ force = false } = {}) {
  const pack = game.packs.get("add2e.sorts");
  if (!pack) throw new Error("Compendium de sorts introuvable : add2e.sorts");

  const cacheKey = add2eSpellSyncBuildCacheKey(pack);
  const existing = globalThis.ADD2E_SPELL_SYNC_CACHE;
  if (!force && existing?.cacheKey === cacheKey && Array.isArray(existing.entries)) return existing;

  const t0 = performance.now();
  console.warn("[ADD2E][SPELL_SYNC][CACHE_BUILD_START] Chargement du compendium complet en une seule passe.", { pack: pack.collection });

  let docs = [];
  try {
    docs = await pack.getDocuments({ type: "sort" });
  } catch (err) {
    console.warn("[ADD2E][SPELL_SYNC][CACHE_BUILD] getDocuments({type:'sort'}) impossible, fallback getDocuments()", err);
    docs = await pack.getDocuments();
  }

  const entries = [];
  const byKey = new Map();
  const duplicateKeys = [];

  for (const doc of docs ?? []) {
    if (!doc || doc.type !== "sort") continue;

    const data = doc.toObject();
    const system = data.system ?? {};
    const level = add2eSpellSyncSpellLevel(system);
    const lists = add2eSpellSyncSpellLists(system);
    const stableKey = add2eSpellSyncStableKey(data.name, system);

    if (!stableKey || stableKey === "0|" || level < 1 || !lists.length) continue;

    if (byKey.has(stableKey)) {
      duplicateKeys.push({ key: stableKey, kept: byKey.get(stableKey)?.name, skipped: data.name });
      continue;
    }

    delete data._id;
    data.folder = null;

    const entry = {
      name: data.name,
      img: data.img,
      type: data.type,
      level,
      lists,
      stableKey,
      data
    };

    byKey.set(stableKey, entry);
    entries.push(entry);
  }

  entries.sort((a, b) => a.level - b.level || String(a.name).localeCompare(String(b.name), "fr"));

  const cache = {
    cacheKey,
    builtAt: Date.now(),
    entries,
    count: entries.length,
    duplicateCount: duplicateKeys.length,
    duplicateKeys
  };

  globalThis.ADD2E_SPELL_SYNC_CACHE = cache;

  console.warn("[ADD2E][SPELL_SYNC][CACHE_BUILD_DONE]", {
    pack: pack.collection,
    entries: entries.length,
    duplicatesSkipped: duplicateKeys.length,
    ms: Math.round(performance.now() - t0)
  });

  if (duplicateKeys.length) {
    console.warn("[ADD2E][SPELL_SYNC][CACHE_DUPLICATES_SKIPPED]", duplicateKeys);
  }

  return cache;
}

async function add2eWarmSpellSyncCache() {
  return add2eBuildSpellSyncCache({ force: false });
}

async function add2ePruneActorSpellsForClassLevel(actor, classItem, actorLevel, options = {}) {
  if (!actor || !classItem || classItem.type !== "classe") return { handled: false, deleted: 0, maxSpellLevel: 0 };

  const classLists = add2eSpellSyncClassLists(classItem);
  if (!classLists.length) return { handled: false, deleted: 0, maxSpellLevel: 0 };

  const level = Math.max(1, Number(actorLevel ?? actor.system?.niveau) || 1);
  const maxSpellLevel = add2eSpellSyncMaxSpellLevel(classItem, level);
  const idsToDelete = [];

  for (const sort of actor.items?.filter?.(i => String(i.type || "").toLowerCase() === "sort") ?? []) {
    const sys = sort.system ?? {};
    const spellLevel = add2eSpellSyncSpellLevel(sys);
    const matchesClass = add2eSpellSyncMatchesClassLists(sys, classLists);
    if (!matchesClass) continue;
    const canStillUse = maxSpellLevel >= 1 && add2eSpellSyncCanUseSpellLevel(actor, classLists, spellLevel, maxSpellLevel);
    if (!canStillUse) idsToDelete.push(sort.id);
  }

  const existingIds = idsToDelete.filter(id => actor.items.has(id));
  if (existingIds.length) {
    console.log("[ADD2E][LEVEL_SPELL_SYNC][PRUNE] Suppression groupée des sorts non accessibles", {
      actor: actor.name,
      classe: classItem.name,
      actorLevel: level,
      maxSpellLevel,
      idsToDelete: existingIds
    });
    await actor.deleteEmbeddedDocuments("Item", existingIds, { add2eInternal: true, add2eSpellSync: true });
  }

  await add2eSpellSyncSetLastMax(actor, maxSpellLevel);
  if (options.notify !== false && existingIds.length) ui.notifications.info(`Sorts non accessibles retirés : ${existingIds.length}.`);
  return { handled: true, deleted: existingIds.length, maxSpellLevel, actorLevel: level };
}

async function add2eSyncActorSpellsFromClass(actor, classItem, options = {}) {
  if (!actor || !classItem || classItem.type !== "classe") return { handled: false, imported: 0, deleted: 0 };

  const mode = options.mode === "missing" ? "missing" : "replace";
  const showWait = options.showWait !== false;
  const classLists = add2eSpellSyncClassLists(classItem);
  if (!classLists.length) return { handled: false, imported: 0, deleted: 0, reason: "no-cleric-druid-list" };

  const actorLevel = Math.max(1, Number(options.actorLevel ?? actor.system?.niveau) || 1);
  const maxSpellLevel = add2eSpellSyncMaxSpellLevel(classItem, actorLevel);
  const minSpellLevel = Math.max(1, Number(options.minSpellLevel ?? 1) || 1);
  const t0 = performance.now();

  console.log("[ADD2E][CLASS_DROP_SPELLS][START]", {
    actor: actor.name,
    classe: classItem.name,
    actorLevel,
    classLists,
    maxSpellLevel,
    minSpellLevel,
    mode
  });

  const waitDialog = showWait
    ? await add2eSpellSyncOpenWaitMessage({ actor, classItem, mode, minSpellLevel, maxSpellLevel })
    : null;

  try {
    const existingSpellIds = actor.items
      .filter(i => String(i.type || "").toLowerCase() === "sort")
      .map(i => i.id)
      .filter(id => actor.items.has(id));

    if (mode === "replace" && existingSpellIds.length) {
      await actor.deleteEmbeddedDocuments("Item", existingSpellIds, { add2eInternal: true, add2eSpellSync: true });
    }

    if (maxSpellLevel < 1 || minSpellLevel > maxSpellLevel) {
      await add2eSpellSyncSetLastMax(actor, maxSpellLevel);
      return { handled: true, imported: 0, deleted: mode === "replace" ? existingSpellIds.length : 0, maxSpellLevel, mode };
    }

    let cache;
    try {
      cache = await add2eBuildSpellSyncCache({ force: !!options.forceCacheRefresh });
    } catch (err) {
      ui.notifications.error("Compendium de sorts introuvable ou illisible : add2e.sorts");
      console.error("[ADD2E][CLASS_DROP_SPELLS][ERROR] Cache impossible", err);
      return { handled: true, imported: 0, deleted: mode === "replace" ? existingSpellIds.length : 0, maxSpellLevel, error: "cache-failed", mode };
    }

    const classListSet = new Set(classLists.map(add2eSpellSyncNormalize));
    const existingKeys = mode === "missing" ? add2eSpellSyncExistingKeys(actor) : new Set();
    const selectedKeys = new Set();
    const createData = [];
    const scanStatsByLevel = {};

    const addScanStat = (level, reason) => {
      const lvl = Number(level) || 0;
      if (!scanStatsByLevel[lvl]) scanStatsByLevel[lvl] = {};
      scanStatsByLevel[lvl][reason] = (scanStatsByLevel[lvl][reason] || 0) + 1;
    };

    for (const entry of cache.entries) {
      const spellLevel = entry.level;

      if (spellLevel < minSpellLevel) {
        addScanStat(spellLevel, "skip-below-min");
        continue;
      }

      if (!add2eSpellSyncCanUseSpellLevel(actor, classLists, spellLevel, maxSpellLevel)) {
        addScanStat(spellLevel, "skip-level-not-accessible");
        continue;
      }

      if (!entry.lists.some(list => classListSet.has(list))) {
        addScanStat(spellLevel, `skip-list:${entry.lists.join("/") || "none"}`);
        continue;
      }

      if (existingKeys.has(entry.stableKey)) {
        addScanStat(spellLevel, "skip-already-present");
        continue;
      }

      if (selectedKeys.has(entry.stableKey)) {
        addScanStat(spellLevel, "skip-selected-duplicate");
        continue;
      }

      selectedKeys.add(entry.stableKey);
      addScanStat(spellLevel, "import");

      const data = add2eSpellSyncClone(entry.data);
      delete data._id;
      data.folder = null;
      foundry.utils.setProperty(data, "flags.add2e.autoGrantedByClass", classItem.name);
      foundry.utils.setProperty(data, "flags.add2e.autoGrantedByClassId", classItem.id);
      foundry.utils.setProperty(data, "flags.add2e.autoGrantedSpellSync", true);
      foundry.utils.setProperty(data, "flags.add2e.autoGrantedAtActorLevel", actorLevel);
      createData.push(data);
    }

    if (createData.length) {
      await actor.createEmbeddedDocuments("Item", createData, { add2eInternal: true, add2eSpellSync: true });
    }

    await add2eSpellSyncSetLastMax(actor, maxSpellLevel);

    const durationMs = Math.round(performance.now() - t0);
    console.log("[ADD2E][CLASS_DROP_SPELLS][DONE]", {
      actor: actor.name,
      classe: classItem.name,
      actorLevel,
      classLists,
      maxSpellLevel,
      minSpellLevel,
      deleted: mode === "replace" ? existingSpellIds.length : 0,
      imported: createData.length,
      mode,
      cacheEntries: cache.entries.length,
      durationMs,
      scanStatsByLevel,
      importedNames: createData.map(s => s.name)
    });

    return {
      handled: true,
      imported: createData.length,
      deleted: mode === "replace" ? existingSpellIds.length : 0,
      maxSpellLevel,
      minSpellLevel,
      mode,
      durationMs
    };
  } finally {
    add2eSpellSyncCloseWaitMessage(waitDialog);
  }
}

async function add2eSyncNewSpellLevelsAfterActorLevelChange(actor, newLevel) {
  if (!actor || actor.type !== "personnage") return null;

  console.log("[ADD2E][LEVEL_SPELL_SYNC][START]", {
    actor: actor?.name,
    newLevel,
    currentLevel: actor?.system?.niveau
  });

  const classItem = actor.items?.find?.(i => String(i.type || "").toLowerCase() === "classe") ?? null;
  if (!classItem) return null;

  const classLists = add2eSpellSyncClassLists(classItem);
  if (!classLists.length) return null;

  const level = Math.max(1, Number(newLevel ?? actor.system?.niveau) || 1);
  const maxSpellLevel = add2eSpellSyncMaxSpellLevel(classItem, level);
  const lastFlagMax = add2eSpellSyncGetLastMax(actor);
  const existingMaxBeforePrune = add2eSpellSyncMaxExistingLevel(actor, classLists);
  const knownBeforePrune = Math.max(lastFlagMax, existingMaxBeforePrune);

  const prune = await add2ePruneActorSpellsForClassLevel(actor, classItem, level, { notify: true });
  const existingMaxAfterPrune = add2eSpellSyncMaxExistingLevel(actor, classLists);

  if (maxSpellLevel < knownBeforePrune) {
    console.log("[ADD2E][LEVEL_SPELL_SYNC][LEVEL_DOWN_OR_CAP_DOWN]", {
      actor: actor.name,
      classe: classItem.name,
      newLevel: level,
      knownBeforePrune,
      existingMaxBeforePrune,
      existingMaxAfterPrune,
      maxSpellLevel,
      deleted: prune?.deleted ?? 0
    });
    add2eRerenderActorSheet(actor, false);
    return { handled: true, imported: 0, deleted: prune?.deleted ?? 0, skipped: true, reason: "level-down-or-cap-down", previousKnownMax: knownBeforePrune, maxSpellLevel };
  }

  const previousKnownMax = Math.max(lastFlagMax, existingMaxAfterPrune);

  if (maxSpellLevel <= previousKnownMax) {
    const missing = await add2eSyncActorSpellsFromClass(actor, classItem, {
      mode: "missing",
      actorLevel: level,
      minSpellLevel: 1,
      showWait: false
    });

    await add2eSpellSyncSetLastMax(actor, maxSpellLevel);
    console.log("[ADD2E][LEVEL_SPELL_SYNC][NO_NEW_LEVEL_CHECK_MISSING]", {
      actor: actor.name,
      classe: classItem.name,
      newLevel: level,
      previousKnownMax,
      maxSpellLevel,
      importedMissing: missing?.imported ?? 0,
      deleted: prune?.deleted ?? 0
    });

    if ((prune?.deleted ?? 0) > 0 || (missing?.imported ?? 0) > 0) add2eRerenderActorSheet(actor, false);
    return { handled: true, imported: missing?.imported ?? 0, deleted: prune?.deleted ?? 0, skipped: true, previousKnownMax, maxSpellLevel };
  }

  ui.notifications.info(`Nouveau niveau de sorts atteint : import des sorts de niveau ${previousKnownMax + 1} à ${maxSpellLevel}.`);

  const result = await add2eSyncActorSpellsFromClass(actor, classItem, {
    mode: "missing",
    actorLevel: level,
    minSpellLevel: previousKnownMax + 1,
    showWait: true
  });

  if (result?.handled && result.imported > 0) ui.notifications.info(`Nouveaux sorts importés : ${result.imported}.`);
  else if (result?.handled) ui.notifications.info("Aucun nouveau sort manquant à importer.");

  if ((result?.imported ?? 0) > 0 || (prune?.deleted ?? 0) > 0) add2eRerenderActorSheet(actor, false);
  return { ...(result ?? {}), deleted: (result?.deleted ?? 0) + (prune?.deleted ?? 0) };
}

// Exposition globale conservée pour compatibilité avec le code legacy et les scripts onUse.
try { globalThis.add2eSpellSyncClone = add2eSpellSyncClone; } catch (_e) {}
try { globalThis.add2eSpellSyncMaybeJson = add2eSpellSyncMaybeJson; } catch (_e) {}
try { globalThis.add2eSpellSyncNormalize = add2eSpellSyncNormalize; } catch (_e) {}
try { globalThis.add2eSpellSyncArray = add2eSpellSyncArray; } catch (_e) {}
try { globalThis.add2eSpellSyncClassLists = add2eSpellSyncClassLists; } catch (_e) {}
try { globalThis.add2eSpellSyncSpellLevel = add2eSpellSyncSpellLevel; } catch (_e) {}
try { globalThis.add2eSpellSyncSpellLists = add2eSpellSyncSpellLists; } catch (_e) {}
try { globalThis.add2eSpellSyncNumber = add2eSpellSyncNumber; } catch (_e) {}
try { globalThis.add2eSpellSyncSlotsArray = add2eSpellSyncSlotsArray; } catch (_e) {}
try { globalThis.add2eSpellSyncReadSlotValue = add2eSpellSyncReadSlotValue; } catch (_e) {}
try { globalThis.add2eSpellSyncMaxSpellLevel = add2eSpellSyncMaxSpellLevel; } catch (_e) {}
try { globalThis.add2eSpellSyncGetProgressionRow = add2eSpellSyncGetProgressionRow; } catch (_e) {}
try { globalThis.add2eSpellSyncSlotProbe = add2eSpellSyncSlotProbe; } catch (_e) {}
try { globalThis.add2eSpellSyncCanUseSpellLevel = add2eSpellSyncCanUseSpellLevel; } catch (_e) {}
try { globalThis.add2eSpellSyncStableKey = add2eSpellSyncStableKey; } catch (_e) {}
try { globalThis.add2eSpellSyncExistingKeys = add2eSpellSyncExistingKeys; } catch (_e) {}
try { globalThis.add2eSpellSyncMaxExistingLevel = add2eSpellSyncMaxExistingLevel; } catch (_e) {}
try { globalThis.add2eSpellSyncGetLastMax = add2eSpellSyncGetLastMax; } catch (_e) {}
try { globalThis.add2eSpellSyncSetLastMax = add2eSpellSyncSetLastMax; } catch (_e) {}
try { globalThis.add2eSpellSyncOpenWaitMessage = add2eSpellSyncOpenWaitMessage; } catch (_e) {}
try { globalThis.add2eSpellSyncCloseWaitMessage = add2eSpellSyncCloseWaitMessage; } catch (_e) {}
try { globalThis.add2eSpellSyncMatchesClassLists = add2eSpellSyncMatchesClassLists; } catch (_e) {}
try { globalThis.add2eBuildSpellSyncCache = add2eBuildSpellSyncCache; } catch (_e) {}
try { globalThis.add2eWarmSpellSyncCache = add2eWarmSpellSyncCache; } catch (_e) {}
try { globalThis.add2eInvalidateSpellSyncCache = add2eInvalidateSpellSyncCache; } catch (_e) {}
try { globalThis.add2ePruneActorSpellsForClassLevel = add2ePruneActorSpellsForClassLevel; } catch (_e) {}
try { globalThis.add2eSyncActorSpellsFromClass = add2eSyncActorSpellsFromClass; } catch (_e) {}
try { globalThis.add2eSyncNewSpellLevelsAfterActorLevelChange = add2eSyncNewSpellLevelsAfterActorLevelChange; } catch (_e) {}
