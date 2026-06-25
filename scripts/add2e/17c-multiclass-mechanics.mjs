// ADD2E — Mécaniques multiclasses canoniques
// Chaque mécanique lit le niveau et l'XP sur l'Item classe concerné.

import {
  classItems as coreClassItems,
  classProgression,
  classSlug as coreClassSlug,
  multiclassEnabled
} from "./17b-multiclass-core.mjs";

const VERSION = "2026-06-25-item-progression-mechanics-v2";
const TAG = "[ADD2E][MULTICLASSE][MECA]";
globalThis.ADD2E_MULTICLASS_MECHANICS_VERSION = VERSION;

function warn(label, data = {}) { console.warn(`${TAG}${label}`, data); }
function n(value, fallback = 0) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }
function norm(value) {
  return String(value ?? "").trim().toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
}
function arr(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(arr).filter(Boolean);
  if (typeof value === "string") return value.split(/[,;|\n/]+/).map(entry => entry.trim()).filter(Boolean);
  if (typeof value === "object") return Object.values(value).flatMap(arr).filter(Boolean);
  return [value];
}
function spellKey(value) { return typeof globalThis.add2eNormalizeSpellKey === "function" ? globalThis.add2eNormalizeSpellKey(value) : norm(value); }
function spellLabel(value) { return typeof globalThis.add2eSpellLabel === "function" ? globalThis.add2eSpellLabel(value) : String(value ?? ""); }
function classItems(actor) { return coreClassItems(actor); }
function classSlug(itemOrSystem) { return coreClassSlug(itemOrSystem); }
function isMulticlassActor(actor) { return multiclassEnabled(actor); }

function multiclassEntries(actor) {
  if (!isMulticlassActor(actor)) return [];
  const entries = [];
  for (const item of classItems(actor)) {
    const progression = classProgression(item);
    if (!progression.hasLevel || !progression.hasXp) {
      warn("[ITEM_PROGRESSION_MISSING]", { actor: actor?.name, className: item?.name, itemId: item?.id });
      continue;
    }
    const rows = Array.isArray(item.system?.progression) ? item.system.progression : [];
    const row = rows.find(entry => n(entry?.niveau ?? entry?.level, 0) === progression.level)
      ?? rows[Math.max(0, progression.level - 1)]
      ?? {};
    entries.push({
      item,
      system: item.system ?? {},
      itemId: item.id,
      slug: classSlug(item),
      name: item.name,
      level: progression.level,
      xp: progression.xp,
      progression: rows,
      row
    });
  }
  return entries;
}

function isExceptionalStrengthClass(entry) {
  const system = entry?.system ?? {};
  const text = [entry?.slug, entry?.name, system.slug, system.label, system.nom, system.name, system.classe, system.class]
    .map(norm).join(" ");
  return text.includes("guerrier") || text.includes("paladin") || text.includes("rodeur") || text.includes("ranger");
}
function actorCanUseExceptionalStrength(actor, entries = null) {
  if (Number(actor?.system?.force ?? 0) !== 18) return false;
  return (entries ?? multiclassEntries(actor)).some(isExceptionalStrengthClass);
}
function rowValue(row, keys, fallback = null) {
  for (const key of keys) if (row?.[key] !== undefined && row?.[key] !== null && row?.[key] !== "") return row[key];
  return fallback;
}
function bestThac0(entries) {
  const values = entries.map(entry => n(rowValue(entry.row, ["thac0", "thaco", "tac0", "taco"], NaN), NaN)).filter(Number.isFinite);
  return values.length ? Math.min(...values) : null;
}
function bestSavingThrows(entries) {
  const rows = entries.map(entry => rowValue(entry.row, ["savingThrows", "sauvegardes", "saves"], null)).filter(Array.isArray);
  if (!rows.length) return null;
  const length = Math.max(...rows.map(row => row.length));
  return Array.from({ length }, (_value, index) => {
    const values = rows.map(row => n(row[index], NaN)).filter(Number.isFinite);
    return values.length ? Math.min(...values) : "";
  });
}

function progressionRowForActor(actor, classEntryOrKey = null) {
  if (!isMulticlassActor(actor)) {
    return typeof globalThis.__add2eOriginalGetProgressionRowForActor === "function"
      ? globalThis.__add2eOriginalGetProgressionRowForActor(actor)
      : {};
  }
  const entries = multiclassEntries(actor);
  const wanted = norm(classEntryOrKey?.key ?? classEntryOrKey?.slug ?? classEntryOrKey?.classSlug ?? classEntryOrKey ?? "");
  if (wanted) {
    const entry = entries.find(candidate => candidate.slug === wanted || norm(candidate.name) === wanted);
    if (entry) return entry.row ?? {};
  }
  return {
    thac0: bestThac0(entries) ?? actor.system?.thaco ?? 20,
    savingThrows: bestSavingThrows(entries) ?? actor.system?.sauvegardes ?? [],
    _add2eMulticlassComposite: true
  };
}

function slotValue(raw, spellLevel, key) {
  if (typeof globalThis.add2eSpellSyncReadSlotValue === "function") return globalThis.add2eSpellSyncReadSlotValue(raw, spellLevel, key);
  if (Array.isArray(raw)) return n(raw[spellLevel - 1], 0);
  if (raw && typeof raw === "object") return n(raw[spellLevel] ?? raw[String(spellLevel)] ?? raw[`niveau${spellLevel}`], 0);
  return null;
}
function slotsFromRow(row, spellEntry, spellLevel) {
  const key = spellKey(spellEntry?.key);
  const label = spellEntry?.label || spellLabel(key);
  for (const containerName of ["spellSlotsByList", "spellsByList", "spellsPerLevelByList", "sortsParListe"]) {
    const container = row?.[containerName];
    if (!container || typeof container !== "object") continue;
    for (const [rawKey, value] of Object.entries(container)) {
      if (spellKey(rawKey) !== key) continue;
      const count = slotValue(value, Number(spellLevel), key);
      if (count !== null) return count;
    }
  }
  const directFields = [
    spellEntry?.slotsField,
    `spellsPerLevel_${key}`,
    `spellsPerLevel${label}`,
    `spellsPerLevel${String(label).replace(/\s+/g, "")}`,
    key === "druide" ? "spellsPerLevelDruide" : null,
    key === "magicien" ? "spellsPerLevelMagicien" : null,
    key === "clerc" ? "spellsPerLevelClerc" : null,
    key === "illusionniste" ? "spellsPerLevelIllusionniste" : null
  ].filter(Boolean);
  for (const field of directFields) {
    const count = slotValue(row?.[field], Number(spellLevel), key);
    if (count !== null) return count;
  }
  return slotValue(row?.spellsPerLevel, Number(spellLevel), key)
    ?? slotValue(row?.sortsParNiveau, Number(spellLevel), key)
    ?? 0;
}
function currentMaxSpellLevelForSource(entry, spellEntry) {
  const startsAt = n(spellEntry.startsAt, 1);
  if (entry.level < startsAt) return 0;
  const declaredMax = n(spellEntry.maxSpellLevel, 0) || 9;
  let max = 0;
  for (let level = 1; level <= declaredMax; level++) if (slotsFromRow(entry.row, spellEntry, level) > 0) max = level;
  return max;
}
function spellcastingEntriesForClass(entry) {
  const casting = entry.system?.spellcasting;
  if (!casting || typeof casting !== "object" || casting.enabled === false) return [];
  const rawEntries = Array.isArray(casting.entries) ? casting.entries : (Array.isArray(casting.pools) ? casting.pools : null);
  const makeEntry = (raw, index) => {
    const key = spellKey(raw?.key ?? raw?.list ?? raw?.liste ?? raw?.name ?? raw?.label ?? raw?.type);
    const output = {
      ...(raw ?? {}), index, key, label: raw?.label || spellLabel(key),
      startsAt: n(raw?.startsAt ?? raw?.startLevel ?? raw?.niveauDepart ?? casting.startsAt ?? 1, 1),
      maxSpellLevel: n(raw?.maxSpellLevel ?? raw?.maxLevel ?? raw?.maxNiveauSort ?? casting.maxSpellLevel ?? 0, 0),
      slotsField: raw?.slotsField || raw?.slotField || raw?.progressionField || null,
      classSlug: entry.slug, className: entry.name, classLevel: entry.level
    };
    output.currentMaxSpellLevel = currentMaxSpellLevelForSource(entry, output);
    return output;
  };
  if (rawEntries) return rawEntries.map(makeEntry).filter(entry => entry.key);
  const lists = arr(casting.lists).map(spellKey).filter(Boolean);
  return [...new Set(lists)].map((key, index) => makeEntry({ key, label: spellLabel(key), startsAt: casting.startsAt, maxSpellLevel: casting.maxSpellLevel }, index));
}
function mergeSpellEntriesByList(entries) {
  const byKey = new Map();
  for (const source of entries) {
    const key = spellKey(source.key);
    if (!key) continue;
    if (!byKey.has(key)) byKey.set(key, {
      ...source, key, poolKey: key, label: spellLabel(key), classSlug: null, className: null,
      classLevel: 0, startsAt: 999, maxSpellLevel: 0, currentMaxSpellLevel: 0, sources: []
    });
    const merged = byKey.get(key);
    merged.sources.push(source);
    merged.classLevel = Math.max(n(merged.classLevel, 0), n(source.classLevel, 0));
    merged.startsAt = Math.min(n(merged.startsAt, 999), n(source.startsAt, 1));
    merged.maxSpellLevel = Math.max(n(merged.maxSpellLevel, 0), n(source.currentMaxSpellLevel, 0));
    merged.currentMaxSpellLevel = merged.maxSpellLevel;
  }
  return [...byKey.values()].filter(entry => entry.maxSpellLevel > 0 || entry.sources.some(source => n(source.classLevel, 1) >= n(source.startsAt, 1)));
}
function multiclassSpellcastingEntries(actor) {
  if (!isMulticlassActor(actor)) return typeof globalThis.__add2eOriginalGetSpellcastingEntries === "function" ? globalThis.__add2eOriginalGetSpellcastingEntries(actor) : [];
  return mergeSpellEntriesByList(multiclassEntries(actor).flatMap(spellcastingEntriesForClass));
}
function multiclassSlotsForEntryLevel(actor, spellEntry, spellLevel) {
  if (!isMulticlassActor(actor)) return typeof globalThis.__add2eOriginalGetSlotsForEntryLevel === "function" ? globalThis.__add2eOriginalGetSlotsForEntryLevel(actor, spellEntry, spellLevel) : 0;
  const sources = Array.isArray(spellEntry?.sources) && spellEntry.sources.length ? spellEntry.sources : [spellEntry];
  let total = 0;
  for (const source of sources) {
    const entry = multiclassEntries(actor).find(candidate => candidate.slug === source?.classSlug);
    if (!entry || entry.level < n(source.startsAt, 1)) continue;
    const declaredMax = n(source.maxSpellLevel, 0) || 9;
    if (Number(spellLevel) > declaredMax) continue;
    total += slotsFromRow(entry.row, source, Number(spellLevel));
  }
  return total;
}
function multiclassSpellSlotPoolsByLevel(actor) {
  if (!isMulticlassActor(actor)) return typeof globalThis.__add2eOriginalGetSpellSlotPoolsByLevel === "function" ? globalThis.__add2eOriginalGetSpellSlotPoolsByLevel(actor) : {};
  const pools = {};
  for (const entry of multiclassSpellcastingEntries(actor)) {
    const slotsByLevel = {};
    for (let level = 1; level <= n(entry.maxSpellLevel, 0); level++) slotsByLevel[level] = multiclassSlotsForEntryLevel(actor, entry, level);
    pools[entry.key] = { ...entry, poolKey: entry.key, slotsByLevel };
  }
  return pools;
}
function multiclassSpellEntryForSpell(actor, sort) {
  if (!isMulticlassActor(actor)) return typeof globalThis.__add2eOriginalGetSpellEntryForSpell === "function" ? globalThis.__add2eOriginalGetSpellEntryForSpell(actor, sort) : null;
  if (globalThis.add2eIsObjectMagicSpellForPreparation?.(sort)) return null;
  const spellLevel = n(sort?.system?.niveau ?? sort?.system?.level, 0);
  const lists = typeof globalThis.add2eGetSpellListsFromItem === "function" ? globalThis.add2eGetSpellListsFromItem(sort) : arr(sort?.system?.spellLists).map(spellKey);
  const matches = multiclassSpellcastingEntries(actor).filter(entry => lists.includes(entry.key));
  return matches.find(entry => multiclassSlotsForEntryLevel(actor, entry, spellLevel) > 0 && (!n(entry.maxSpellLevel, 0) || spellLevel <= n(entry.maxSpellLevel, 0))) ?? matches[0] ?? null;
}
function multiclassCanUseSpell(actor, sort) {
  if (!isMulticlassActor(actor)) return typeof globalThis.__add2eOriginalCanActorUseSpell === "function" ? globalThis.__add2eOriginalCanActorUseSpell(actor, sort) : { ok: false, reason: "missing-original" };
  if (globalThis.add2eIsObjectMagicSpellForPreparation?.(sort)) return { ok: false, reason: "object-power", sortLists: [], entries: multiclassSpellcastingEntries(actor), entry: null };
  const spellLevel = n(sort?.system?.niveau ?? sort?.system?.level, 0);
  const sortLists = typeof globalThis.add2eGetSpellListsFromItem === "function" ? globalThis.add2eGetSpellListsFromItem(sort) : arr(sort?.system?.spellLists).map(spellKey);
  const entries = multiclassSpellcastingEntries(actor);
  const matching = entries.filter(entry => sortLists.includes(entry.key));
  if (!matching.length) return { ok: false, reason: "list", sortLists, entries, entry: null };
  for (const entry of matching) {
    if (n(entry.maxSpellLevel, 0) && spellLevel > n(entry.maxSpellLevel, 0)) continue;
    if (multiclassSlotsForEntryLevel(actor, entry, spellLevel) <= 0) continue;
    return { ok: true, reason: "ok", sortLists, entries, entry, actorLevel: entry.classLevel, classLevel: entry.classLevel, spellLevel };
  }
  return { ok: false, reason: "level", sortLists, entries, entry: matching[0] ?? null, spellLevel };
}

function featureLevel(feature, actor) {
  const slug = norm(feature?._add2eClassSlug ?? feature?.classSlug ?? feature?.sourceClassSlug ?? "");
  if (slug) {
    const entry = multiclassEntries(actor).find(candidate => candidate.slug === slug);
    if (entry) return entry.level;
  }
  return n(feature?._add2eClassLevel, 1);
}
function sourceFeaturesFromSystem(system, source) {
  const output = [];
  const push = value => {
    const list = typeof globalThis.add2eToClassFeatureArray === "function" ? globalThis.add2eToClassFeatureArray(value) : arr(value).filter(entry => entry && typeof entry === "object");
    for (const feature of list) output.push({ ...feature, _add2eFeatureSource: feature?._add2eFeatureSource ?? source });
  };
  for (const field of ["activeClassFeatures", "activableClassFeatures", "classFeaturesActives", "capacitesActives", "capacitesActivables", "classFeatures", "classFeaturesDebloquees", "capacitesClasse", "passiveClassFeatures", "passiveFeatures", "capacitesPassives"]) push(system?.[field]);
  return output;
}
function multiclassActorClassFeatures(actor) {
  if (!isMulticlassActor(actor)) return typeof globalThis.__add2eOriginalGetActorClassFeatures === "function" ? globalThis.__add2eOriginalGetActorClassFeatures(actor) : [];
  const output = [];
  const seen = new Set();
  for (const entry of multiclassEntries(actor)) {
    for (const feature of sourceFeaturesFromSystem(entry.system, entry.name)) {
      const key = typeof globalThis.add2eFeatureKey === "function" ? globalThis.add2eFeatureKey(feature) : norm(feature?.key ?? feature?.name);
      const onUse = typeof globalThis.add2eFeatureOnUse === "function" ? globalThis.add2eFeatureOnUse(feature) : String(feature?.on_use ?? feature?.onUse ?? "");
      const unique = `${entry.slug}|${key}|${onUse}`;
      if ((!key && !onUse) || seen.has(unique)) continue;
      seen.add(unique);
      output.push({ ...feature, _add2eClassSlug: entry.slug, _add2eClassName: entry.name, _add2eClassLevel: entry.level });
    }
  }
  return output;
}
function unlockedFeatures(actor, activable, includeLocked) {
  return multiclassActorClassFeatures(actor).filter(feature => {
    const isActivable = typeof globalThis.add2eIsFeatureActivable === "function" ? globalThis.add2eIsFeatureActivable(feature) : !!feature.activable;
    if (isActivable !== activable) return false;
    if (includeLocked) return true;
    const level = featureLevel(feature, actor);
    const min = typeof globalThis.add2eFeatureMinLevel === "function" ? globalThis.add2eFeatureMinLevel(feature) : n(feature.minLevel ?? feature.niveauMin ?? 1, 1);
    const max = typeof globalThis.add2eFeatureMaxLevel === "function" ? globalThis.add2eFeatureMaxLevel(feature) : n(feature.maxLevel ?? feature.niveauMax ?? 999, 999);
    return level >= min && level <= max;
  });
}
function multiclassActivableClassFeatures(actor, { includeLocked = true } = {}) { return unlockedFeatures(actor, true, includeLocked); }
function multiclassPassiveClassFeatures(actor, { includeLocked = true } = {}) { return unlockedFeatures(actor, false, includeLocked); }
function spellClassLevel(actor, classKey) {
  if (!isMulticlassActor(actor)) return Math.max(1, n(actor?.system?.niveau, 1));
  const wanted = norm(classKey);
  const entry = multiclassEntries(actor).find(candidate => candidate.slug === wanted || norm(candidate.name) === wanted);
  return Math.max(1, n(entry?.level, 1));
}

async function syncMulticlassHp(actor, { syncCurrent = false, force = false, reason = "multiclass-item-progression" } = {}) {
  if (!isMulticlassActor(actor)) return false;
  const entries = multiclassEntries(actor);
  if (!entries.length) return false;
  const maxLevel = Math.max(...entries.map(entry => entry.level));
  const conBonus = n(actor.system?.con_pv, 0);
  const hpRolls = Array.isArray(actor.system?.hpRollsMulticlass) && !force ? foundry.utils.deepClone(actor.system.hpRollsMulticlass) : [];
  let hpMax = 0;
  for (let levelIndex = 0; levelIndex < maxLevel; levelIndex++) {
    let levelHp = 0;
    let classCount = 0;
    for (const entry of entries) {
      if (entry.level <= levelIndex) continue;
      const hitDie = n(entry.system?.hitDie ?? entry.system?.dv, 0);
      if (!hitDie) continue;
      hpRolls[levelIndex] ??= {};
      let roll = n(hpRolls[levelIndex]?.[entry.slug], NaN);
      if (!Number.isFinite(roll) || roll < 1 || roll > hitDie || (force && levelIndex > 0)) {
        roll = levelIndex === 0 ? hitDie : 1 + Math.floor(Math.random() * hitDie);
        hpRolls[levelIndex][entry.slug] = roll;
      }
      levelHp += roll;
      classCount += 1;
    }
    if (classCount > 0) hpMax += Math.max(1, Math.ceil(levelHp / classCount)) + conBonus;
  }
  const updates = { "system.hpRollsMulticlass": hpRolls, "system.points_de_coup": Math.max(1, Math.floor(hpMax)) };
  if (syncCurrent) updates["system.pdv"] = updates["system.points_de_coup"];
  await actor.update(updates, { add2eInternal: true, add2eReason: reason });
  return true;
}

function installGlobalPatches() {
  if (!globalThis.__add2eOriginalGetProgressionRowForActor && typeof globalThis.add2eGetProgressionRowForActor === "function") globalThis.__add2eOriginalGetProgressionRowForActor = globalThis.add2eGetProgressionRowForActor;
  if (!globalThis.__add2eOriginalGetSpellcastingEntries && typeof globalThis.add2eGetSpellcastingEntries === "function") globalThis.__add2eOriginalGetSpellcastingEntries = globalThis.add2eGetSpellcastingEntries;
  if (!globalThis.__add2eOriginalGetSlotsForEntryLevel && typeof globalThis.add2eGetSlotsForEntryLevel === "function") globalThis.__add2eOriginalGetSlotsForEntryLevel = globalThis.add2eGetSlotsForEntryLevel;
  if (!globalThis.__add2eOriginalGetSpellSlotPoolsByLevel && typeof globalThis.add2eGetSpellSlotPoolsByLevel === "function") globalThis.__add2eOriginalGetSpellSlotPoolsByLevel = globalThis.add2eGetSpellSlotPoolsByLevel;
  if (!globalThis.__add2eOriginalGetSpellEntryForSpell && typeof globalThis.add2eGetSpellEntryForSpell === "function") globalThis.__add2eOriginalGetSpellEntryForSpell = globalThis.add2eGetSpellEntryForSpell;
  if (!globalThis.__add2eOriginalCanActorUseSpell && typeof globalThis.add2eCanActorUseSpell === "function") globalThis.__add2eOriginalCanActorUseSpell = globalThis.add2eCanActorUseSpell;
  if (!globalThis.__add2eOriginalGetActorClassFeatures && typeof globalThis.add2eGetActorClassFeatures === "function") globalThis.__add2eOriginalGetActorClassFeatures = globalThis.add2eGetActorClassFeatures;
  if (!globalThis.__add2eOriginalGetActorActivableClassFeatures && typeof globalThis.add2eGetActorActivableClassFeatures === "function") globalThis.__add2eOriginalGetActorActivableClassFeatures = globalThis.add2eGetActorActivableClassFeatures;
  if (!globalThis.__add2eOriginalGetActorPassiveClassFeatures && typeof globalThis.add2eGetActorPassiveClassFeatures === "function") globalThis.__add2eOriginalGetActorPassiveClassFeatures = globalThis.add2eGetActorPassiveClassFeatures;
  globalThis.add2eGetProgressionRowForActor = progressionRowForActor;
  globalThis.add2eGetSpellcastingEntries = multiclassSpellcastingEntries;
  globalThis.add2eGetSlotsForEntryLevel = multiclassSlotsForEntryLevel;
  globalThis.add2eGetSpellSlotPoolsByLevel = multiclassSpellSlotPoolsByLevel;
  globalThis.add2eGetSpellEntryForSpell = multiclassSpellEntryForSpell;
  globalThis.add2eCanActorUseSpell = multiclassCanUseSpell;
  globalThis.add2eGetActorClassFeatures = multiclassActorClassFeatures;
  globalThis.add2eGetActorActivableClassFeatures = multiclassActivableClassFeatures;
  globalThis.add2eGetActorPassiveClassFeatures = multiclassPassiveClassFeatures;
  globalThis.add2eSpellClassLevel = spellClassLevel;
  globalThis.add2eSyncMulticlassHp = syncMulticlassHp;
}

function installSheetPatch() {
  const proto = globalThis.Add2eActorSheet?.prototype;
  if (!proto || proto.__add2eMulticlassMechanicsPatch === VERSION) return false;
  if (typeof proto.autoSetPointsDeCoup === "function" && !proto.__add2eOriginalAutoSetPointsDeCoup) {
    proto.__add2eOriginalAutoSetPointsDeCoup = proto.autoSetPointsDeCoup;
    proto.autoSetPointsDeCoup = async function add2eItemProgressionAutoSetPointsDeCoup(options = {}) {
      if (!isMulticlassActor(this.actor)) return this.__add2eOriginalAutoSetPointsDeCoup(options);
      return syncMulticlassHp(this.actor, options);
    };
  }
  if (typeof proto.getData === "function" && !proto.__add2eOriginalMulticlassMechanicsGetData) {
    const originalGetData = proto.getData;
    proto.__add2eOriginalMulticlassMechanicsGetData = originalGetData;
    proto.getData = async function add2eItemProgressionMechanicsGetData(...args) {
      const data = await originalGetData.apply(this, args);
      const actor = this.actor;
      if (!isMulticlassActor(actor)) return data;
      const entries = multiclassEntries(actor);
      const thaco = bestThac0(entries);
      const saves = bestSavingThrows(entries);
      data.combatDefense = data.combatDefense ?? {};
      if (thaco !== null) data.combatDefense.thaco = thaco;
      if (saves) data.actor.system.sauvegardes = saves;
      data.canExceptionalStrength = actorCanUseExceptionalStrength(actor, entries);
      if (data.canExceptionalStrength && (data.actor.system.force_ex === undefined || data.actor.system.force_ex === null || data.actor.system.force_ex === "")) data.actor.system.force_ex = 0;
      const features = multiclassActorClassFeatures(actor);
      data.activeClassFeatures = unlockedFeatures(actor, true, false);
      data.passiveClassFeatures = unlockedFeatures(actor, false, false);
      data.multiclassFeatures = features;
      return data;
    };
  }
  proto.__add2eMulticlassMechanicsPatch = VERSION;
  return true;
}

function installWhenReady() { installGlobalPatches(); installSheetPatch(); }
Hooks.once("ready", installWhenReady);
Hooks.on("init", installWhenReady);
setTimeout(installWhenReady, 0);