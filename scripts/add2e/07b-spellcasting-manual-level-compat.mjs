// ============================================================
// ADD2E — Compatibilité niveau manuel acteur pour emplacements de sorts
// Version : 2026-06-14-spellcasting-manual-level-compat-v1
// ============================================================
// Objectif : préserver la logique multiclasse, mais pour un acteur monoclasse
// utiliser en priorité le niveau saisi sur l'acteur. Cela permet aux compteurs
// Clerc N1/N2/N3, Magicien, Druide, etc. de se recalculer immédiatement quand
// le niveau est modifié manuellement sur la feuille.

const VERSION = "2026-06-14-spellcasting-manual-level-compat-v1";
globalThis.ADD2E_SPELLCASTING_MANUAL_LEVEL_COMPAT_VERSION = VERSION;

function norm(value) {
  if (typeof globalThis.add2eNormalizeSpellKey === "function") return globalThis.add2eNormalizeSpellKey(value);
  const v = String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[\s_-]+/g, "_");
  const aliases = {
    cleric: "clerc", clerc: "clerc", priest: "clerc", pretre: "clerc", prêtre: "clerc",
    paladin: "clerc",
    druid: "druide", druide: "druide", druidique: "druide",
    wizard: "magicien", mage: "magicien", magic_user: "magicien", magicien: "magicien", magician: "magicien",
    illusionist: "illusionniste", illusionniste: "illusionniste"
  };
  return aliases[v] || v;
}

function slug(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function num(value, fallback = null) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value === null || value === undefined || value === "") return fallback;
  if (value && typeof value === "object") {
    for (const key of ["value", "valeur", "total", "current", "base", "max", "niveau", "level", "xp"]) {
      const n = num(value[key], null);
      if (Number.isFinite(n)) return n;
    }
  }
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;
  const match = raw.match(/-?\d+(?:[.,]\d+)?/);
  if (!match) return fallback;
  const n = Number(match[0].replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}

function label(key) {
  if (typeof globalThis.add2eSpellLabel === "function") return globalThis.add2eSpellLabel(key);
  const labels = { clerc: "Clerc", druide: "Druide", magicien: "Magicien", illusionniste: "Illusionniste" };
  return labels[norm(key)] || String(key ?? "—");
}

function arr(value) {
  if (Array.isArray(value)) return value.filter(v => v !== undefined && v !== null && String(v).trim() !== "");
  if (typeof value === "string") return value.split(/[,;|]/).map(s => s.trim()).filter(Boolean);
  return [];
}

function classItems(actor) {
  return actor?.items?.filter?.(i => String(i.type || "").toLowerCase() === "classe") ?? [];
}

function classSlug(cls) {
  const sys = cls?.system ?? {};
  return slug(sys.slug ?? sys.label ?? sys.nom ?? sys.name ?? cls?.name ?? "classe");
}

function isMulticlass(actor) {
  return actor?.system?.multiclasse?.enabled === true || classItems(actor).length > 1;
}

function manualActorLevel(actor) {
  if (isMulticlass(actor)) return null;
  const sys = actor?.system ?? {};
  for (const value of [sys.niveau, sys.level, sys.niveau_total, sys.levelTotal]) {
    const n = num(value, null);
    if (Number.isFinite(n) && n >= 1) return Math.max(1, Math.floor(n));
  }
  return null;
}

function readNestedLevel(root, wantedSlug, classId = null) {
  if (!root || typeof root !== "object") return null;
  const keys = [wantedSlug, classId].filter(Boolean);
  for (const containerName of ["niveaux_par_classe", "niveauxParClasse", "levelsByClass", "classLevels", "classes", "classData", "multiclassLevels", "multiclasse", "multiclass"]) {
    const container = root[containerName];
    if (!container || typeof container !== "object") continue;
    for (const key of keys) {
      const direct = num(container[key], null);
      if (Number.isFinite(direct)) return direct;
      const entry = container[key];
      const nested = num(entry?.niveau ?? entry?.level ?? entry?.currentLevel ?? entry?.niveauActuel ?? entry?.value, null);
      if (Number.isFinite(nested)) return nested;
    }
    for (const nestedName of ["niveaux", "levels", "byClass", "classes", "entries"]) {
      const nestedContainer = container[nestedName];
      if (!nestedContainer || typeof nestedContainer !== "object") continue;
      for (const key of keys) {
        const direct = num(nestedContainer[key], null);
        if (Number.isFinite(direct)) return direct;
        const entry = nestedContainer[key];
        const nested = num(entry?.niveau ?? entry?.level ?? entry?.currentLevel ?? entry?.niveauActuel ?? entry?.value, null);
        if (Number.isFinite(nested)) return nested;
      }
    }
  }
  return null;
}

function parseXpRange(raw) {
  const text = String(raw ?? "").trim();
  const values = text.match(/[0-9][0-9.\s]*/g)?.map(v => num(v, NaN)).filter(Number.isFinite) ?? [];
  return { min: values[0] ?? 0, max: values[1] ?? null };
}

function progressionRows(classSystem) {
  const progression = Array.isArray(classSystem?.progression) ? classSystem.progression : [];
  return progression.map((row, index) => {
    const range = parseXpRange(row?.xp ?? row?.experience ?? row?.xpRange ?? row?.niveau_xp ?? "");
    return { ...row, niveau: num(row?.niveau ?? row?.level, index + 1), xpMin: range.min, xpMax: range.max };
  }).filter(r => Number(r.niveau) > 0).sort((a, b) => Number(a.niveau) - Number(b.niveau));
}

function levelForClassXp(classSystem, xpValue) {
  const xp = Math.max(0, Math.floor(num(xpValue, 0) || 0));
  const rows = progressionRows(classSystem);
  if (!rows.length) return 1;
  let current = rows[0];
  for (const row of rows) if (xp >= Number(row.xpMin || 0)) current = row;
  return Math.max(1, Math.floor(Number(current.niveau) || 1));
}

function spellClassLevel(actor, classKey = null) {
  const manual = manualActorLevel(actor);
  if (Number.isFinite(manual) && manual >= 1) return manual;

  const wantedSlug = slug(classKey ?? "");
  const items = classItems(actor);
  const cls = wantedSlug ? items.find(c => classSlug(c) === wantedSlug) : items[0];
  const sys = actor?.system ?? {};

  for (const root of [sys, actor?.flags?.add2e]) {
    const nested = readNestedLevel(root, wantedSlug, cls?.id);
    if (Number.isFinite(nested) && nested >= 1) return Math.max(1, Math.floor(nested));
  }

  for (const value of [cls?.system?.niveau, cls?.system?.level, cls?.system?.currentLevel, cls?.system?.niveauActuel]) {
    const n = num(value, null);
    if (Number.isFinite(n) && n >= 1) return Math.max(1, Math.floor(n));
  }

  const xpByClass = sys.xp_par_classe ?? sys.xpParClasse ?? sys.classXp ?? sys.xpByClass ?? {};
  if (wantedSlug && xpByClass && typeof xpByClass === "object" && cls?.system) {
    const xp = xpByClass[wantedSlug] ?? xpByClass[cls.id] ?? xpByClass[cls.name] ?? null;
    if (xp !== null && xp !== undefined) return levelForClassXp(cls.system, xp);
  }

  const fallback = num(sys.niveau ?? sys.level ?? sys.niveau_total ?? sys.levelTotal ?? sys.details_classe?.niveau ?? sys.details_classe?.level, 1);
  return Math.max(1, Math.floor(fallback || 1));
}

function classForEntry(actor, entry) {
  const firstSource = Array.isArray(entry?.sources) ? entry.sources[0] : null;
  const wantedSlug = slug(entry?.classSlug ?? firstSource?.classSlug ?? "");
  if (wantedSlug) {
    const found = classItems(actor).find(cls => classSlug(cls) === wantedSlug);
    if (found) return found;
  }
  const key = norm(entry?.key);
  return classItems(actor).find(cls => {
    const casting = cls?.system?.spellcasting ?? {};
    const lists = arr(casting.lists).map(norm);
    if (lists.includes(key)) return true;
    const entries = Array.isArray(casting.entries) ? casting.entries : Array.isArray(casting.pools) ? casting.pools : [];
    return entries.some(e => norm(e.key ?? e.list ?? e.liste ?? e.name ?? e.label ?? e.type) === key);
  }) ?? classItems(actor)[0] ?? null;
}

function getActorClassItemForSpellcasting(actor) {
  return classItems(actor)[0] || null;
}

function readSpellcastingSource(actor) {
  const classItem = getActorClassItemForSpellcasting(actor);
  const classSpellcasting = classItem?.system?.spellcasting;
  const actorSpellcasting = actor?.system?.spellcasting;
  if (classSpellcasting && typeof classSpellcasting === "object") return classSpellcasting;
  if (actorSpellcasting && typeof actorSpellcasting === "object") return actorSpellcasting;
  return {};
}

function entriesFromCasting(casting, classItem = null) {
  const cSlug = classItem ? classSlug(classItem) : null;
  const className = classItem?.name ?? null;
  const rawEntries = Array.isArray(casting?.entries) ? casting.entries : Array.isArray(casting?.pools) ? casting.pools : null;
  if (rawEntries) {
    return rawEntries.map((e, idx) => {
      const key = norm(e.key ?? e.list ?? e.liste ?? e.name ?? e.label ?? e.type);
      return {
        index: idx,
        key,
        label: e.label || label(key),
        startsAt: Number(e.startsAt ?? e.startLevel ?? e.niveauDepart ?? casting.startsAt ?? 1) || 1,
        maxSpellLevel: Number(e.maxSpellLevel ?? e.maxLevel ?? e.maxNiveauSort ?? casting.maxSpellLevel ?? 0) || 0,
        slotsField: e.slotsField || e.slotField || e.progressionField || null,
        notes: e.notes || "",
        classSlug: cSlug,
        className
      };
    }).filter(e => e.key);
  }
  const lists = arr(casting?.lists).map(norm).filter(Boolean);
  return [...new Set(lists)].map((key, idx) => ({
    index: idx,
    key,
    label: label(key),
    startsAt: Number(casting?.startsAt ?? 1) || 1,
    maxSpellLevel: Number(casting?.maxSpellLevel ?? 0) || 0,
    slotsField: null,
    notes: casting?.notes || "",
    classSlug: cSlug,
    className
  }));
}

function mergeEntries(entries) {
  const byKey = new Map();
  for (const entry of entries) {
    const key = norm(entry?.key);
    if (!key) continue;
    if (!byKey.has(key)) byKey.set(key, { ...entry, key, label: label(key), classSlug: null, className: null, startsAt: Number(entry.startsAt ?? 1) || 1, maxSpellLevel: Number(entry.maxSpellLevel ?? 0) || 0, sources: [] });
    const merged = byKey.get(key);
    merged.sources.push(entry);
    merged.startsAt = Math.min(Number(merged.startsAt ?? 1) || 1, Number(entry.startsAt ?? 1) || 1);
    merged.maxSpellLevel = Math.max(Number(merged.maxSpellLevel ?? 0) || 0, Number(entry.maxSpellLevel ?? 0) || 0);
  }
  return [...byKey.values()];
}

function getSpellcastingEntries(actor) {
  if (isMulticlass(actor)) {
    const raw = [];
    const seen = new Set();
    for (const cls of classItems(actor)) {
      const casting = cls?.system?.spellcasting;
      if (!casting || typeof casting !== "object" || casting.enabled === false) continue;
      for (const entry of entriesFromCasting(casting, cls)) {
        const key = `${entry.classSlug || "classe"}:${entry.key}`;
        if (seen.has(key)) continue;
        seen.add(key);
        raw.push(entry);
      }
    }
    const merged = mergeEntries(raw);
    if (merged.length) return merged;
  }
  return mergeEntries(entriesFromCasting(readSpellcastingSource(actor), getActorClassItemForSpellcasting(actor)));
}

function getSpellListsFromItem(sort) {
  if (typeof globalThis.add2eGetSpellListsFromItem === "function" && globalThis.add2eGetSpellListsFromItem !== getSpellListsFromItem) {
    try { return globalThis.add2eGetSpellListsFromItem(sort); } catch (_e) {}
  }
  const sys = sort?.system ?? {};
  const fromLists = arr(sys.spellLists).map(norm).filter(Boolean);
  if (fromLists.length) return [...new Set(fromLists)];
  const legacy = sys.classe || sys.class || sys.liste;
  const key = norm(legacy);
  return key ? [key] : [];
}

function isObjectMagicSpell(sort) {
  if (typeof globalThis.add2eIsObjectMagicSpellForPreparation === "function") return globalThis.add2eIsObjectMagicSpellForPreparation(sort);
  const sys = sort?.system ?? {};
  const flags = sort?.flags?.add2e ?? {};
  return sys.isPower === true || sys.isObjectPower === true || !!sys.sourceWeaponId || !!sys.sourceItemId || sys.powerIndex !== undefined || flags.sourceType === "objet_magique" || !!flags.sourceItemId || !!flags.sourceWeaponId || String(sys.composantes ?? "").toLowerCase().includes("objet");
}

function isCapacitySpell(sort) {
  if (typeof globalThis.add2eIsCapacitySpellForPreparation === "function") return globalThis.add2eIsCapacitySpellForPreparation(sort);
  const sys = sort?.system ?? {};
  const flags = sort?.flags?.add2e ?? {};
  return sys.isCapacity === true || sys.isCapacite === true || sys.usageType === "classFeature" || !!sys.sourceCapacite || !!sys.sourceFeature || flags.sourceType === "capacite" || flags.sourceType === "capacity";
}

function isRegularSpell(sort) {
  return !isObjectMagicSpell(sort) && !isCapacitySpell(sort);
}

function readSlotValue(raw, spellLevel, key) {
  if (typeof globalThis.add2eSpellSyncReadSlotValue === "function") return globalThis.add2eSpellSyncReadSlotValue(raw, spellLevel, key);
  const idx = Math.max(0, Number(spellLevel) - 1);
  if (Array.isArray(raw)) return num(raw[idx], 0) || 0;
  if (raw && typeof raw === "object") return num(raw[spellLevel] ?? raw[String(spellLevel)] ?? raw[idx] ?? raw[String(idx)] ?? raw[key], 0) || 0;
  if (raw !== undefined && raw !== null && raw !== "") return num(raw, 0) || 0;
  return null;
}

function progressionRowForActor(actor, entry = null) {
  const classItem = entry ? classForEntry(actor, entry) : getActorClassItemForSpellcasting(actor);
  const details = classItem?.system || actor?.system?.details_classe || {};
  const progression = Array.isArray(details.progression) ? details.progression : [];
  const level = entry ? spellClassLevel(actor, entry.classSlug) : spellClassLevel(actor, classSlug(classItem));
  return progression.find(row => Number(row?.niveau ?? row?.level) === level) ?? progression[level - 1] ?? {};
}

function getSlotsForSingleEntryLevel(actor, entry, spellLevel) {
  const row = progressionRowForActor(actor, entry);
  const key = norm(entry?.key);
  const entryLabel = entry?.label || label(key);
  const lvl = Number(spellLevel) || 1;
  const tryArray = raw => readSlotValue(raw, lvl, key);

  for (const containerName of ["spellSlotsByList", "spellsByList", "spellsPerLevelByList", "sortsParListe"]) {
    const c = row?.[containerName];
    if (!c || typeof c !== "object") continue;
    for (const [rawContainerKey, value] of Object.entries(c)) {
      if (norm(rawContainerKey) !== key) continue;
      const v = tryArray(value);
      if (v !== null) return v;
    }
  }

  const directFields = [
    entry?.slotsField,
    `spellsPerLevel_${key}`,
    `spellsPerLevel${entryLabel}`,
    `spellsPerLevel${String(entryLabel).replace(/\s+/g, "")}`,
    key === "druide" ? "spellsPerLevelDruide" : null,
    key === "magicien" ? "spellsPerLevelMagicien" : null,
    key === "clerc" ? "spellsPerLevelClerc" : null,
    key === "illusionniste" ? "spellsPerLevelIllusionniste" : null
  ].filter(Boolean);

  for (const field of directFields) {
    const v = tryArray(row?.[field]);
    if (v !== null) return v;
  }

  const v = tryArray(row?.spellsPerLevel) ?? tryArray(row?.sortsParNiveau);
  return v ?? 0;
}

function getSlotsForEntryLevel(actor, entry, spellLevel) {
  const sources = Array.isArray(entry?.sources) && entry.sources.length ? entry.sources : [entry];
  let total = 0;
  for (const source of sources) {
    const actorLevel = spellClassLevel(actor, source.classSlug);
    const startsAt = Number(source.startsAt || 1);
    const max = Number(source.maxSpellLevel || 0);
    const lvl = Number(spellLevel) || 1;
    if (actorLevel < startsAt) continue;
    if (max && lvl > max) continue;
    total += getSlotsForSingleEntryLevel(actor, source, lvl);
  }
  return total;
}

function getSpellSlotPoolsByLevel(actor) {
  const entries = getSpellcastingEntries(actor);
  const pools = {};
  for (const entry of entries) {
    const slotsByLevel = {};
    const maxSpellLevel = Number(entry.maxSpellLevel) || 9;
    const actorLevel = Math.max(...(entry.sources ?? [entry]).map(s => spellClassLevel(actor, s.classSlug)));
    for (let lvl = 1; lvl <= maxSpellLevel; lvl++) slotsByLevel[lvl] = getSlotsForEntryLevel(actor, entry, lvl);
    pools[entry.key] = { ...entry, actorLevel, slotsByLevel };
  }
  return pools;
}

function entryAvailableForSpell(actor, entry, spellLevel) {
  const sources = Array.isArray(entry?.sources) && entry.sources.length ? entry.sources : [entry];
  return sources.some(source => {
    const actorLevel = spellClassLevel(actor, source.classSlug);
    const startsAt = Number(source.startsAt || 1);
    const max = Number(source.maxSpellLevel || 0);
    return actorLevel >= startsAt && (!max || Number(spellLevel) <= max);
  });
}

function getSpellEntryForSpell(actor, sort) {
  if (!isRegularSpell(sort)) return null;
  const spellLevel = Number(sort?.system?.niveau ?? sort?.system?.level ?? 0) || 0;
  const sortLists = getSpellListsFromItem(sort);
  const entries = getSpellcastingEntries(actor);
  const matches = entries.filter(e => sortLists.includes(e.key));
  if (!matches.length) return null;
  return matches.find(e => entryAvailableForSpell(actor, e, spellLevel)) || matches[0] || null;
}

function canActorUseSpell(actor, sort) {
  if (!isRegularSpell(sort)) return { ok: false, reason: "not-regular-spell", sortLists: [], entries: getSpellcastingEntries(actor), entry: null };
  const spellLevel = Number(sort?.system?.niveau ?? sort?.system?.level ?? 0) || 0;
  const sortLists = getSpellListsFromItem(sort);
  const entries = getSpellcastingEntries(actor);
  const matching = entries.filter(e => sortLists.includes(e.key));
  if (!matching.length) return { ok: false, reason: "list", sortLists, entries, entry: null };
  for (const entry of matching) if (entryAvailableForSpell(actor, entry, spellLevel)) return { ok: true, reason: "ok", sortLists, entries, entry, actorLevel: spellClassLevel(actor, entry.sources?.[0]?.classSlug ?? entry.classSlug), spellLevel };
  const entry = matching[0] ?? null;
  return { ok: false, reason: "level", sortLists, entries, entry, actorLevel: entry ? spellClassLevel(actor, entry.sources?.[0]?.classSlug ?? entry.classSlug) : 0, spellLevel };
}

const originalGetSpellListsFromItem = globalThis.add2eGetSpellListsFromItem;
globalThis.add2eSpellClassLevel = spellClassLevel;
globalThis.add2eGetSpellcastingEntries = getSpellcastingEntries;
globalThis.add2eGetSpellSlotPoolsByLevel = getSpellSlotPoolsByLevel;
globalThis.add2eGetSlotsForEntryLevel = getSlotsForEntryLevel;
globalThis.add2eGetSpellEntryForSpell = getSpellEntryForSpell;
globalThis.add2eCanActorUseSpell = canActorUseSpell;

// On conserve la logique enrichie installée par 16-preparation-display quand elle est chargée ensuite.
if (!globalThis.add2eGetSpellListsFromItem && originalGetSpellListsFromItem) globalThis.add2eGetSpellListsFromItem = originalGetSpellListsFromItem;

Hooks.on("updateActor", (actor, changed) => {
  if (!actor) return;
  const changedLevel = foundry.utils.hasProperty(changed, "system.niveau") ||
    foundry.utils.hasProperty(changed, "system.level") ||
    foundry.utils.hasProperty(changed, "system.niveau_total") ||
    foundry.utils.hasProperty(changed, "system.levelTotal") ||
    foundry.utils.hasProperty(changed, "system.multiclasse") ||
    foundry.utils.hasProperty(changed, "system.niveaux_par_classe") ||
    foundry.utils.hasProperty(changed, "system.niveauxParClasse");
  if (!changedLevel) return;
  window.setTimeout(() => globalThis.add2eRerenderActorSheet?.(actor, true), 30);
});

console.log("[ADD2E][SPELLCASTING][MANUAL_LEVEL_COMPAT]", VERSION);
