// ADD2E — Multiclassage : règles et état canonique
// Item.system est la définition de chaque classe.
// system.multiclasse.classes contient uniquement l'état de progression de ces Items.

import {
  MULTICLASS_SCHEMA,
  canonicalClassStates,
  canonicalMulticlass,
  classItems,
  classSlug,
  cloneItemData,
  itemLabel,
  norm,
  num,
  pickClassAlignment,
  systemRace,
  warn
} from "./17b-multiclass-core.mjs";

const MULTICLASS_CANDIDATE_PACKS = {
  race: ["add2e.races"],
  classe: ["add2e.classes"]
};

const MULTICLASS_CANDIDATE_CACHE = {
  race: null,
  classe: null
};

function candidateKey(data) {
  const sys = data?.system ?? {};
  return norm(data?.name ?? sys.slug ?? sys.label ?? sys.name ?? sys.nom ?? data?.id ?? "");
}

function dedupeCandidates(items) {
  const seen = new Set();
  const output = [];
  for (const item of items ?? []) {
    const key = candidateKey(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }
  return output;
}

async function loadCandidatePack(type) {
  const wanted = String(type ?? "").toLowerCase();
  const docs = [];

  for (const packId of MULTICLASS_CANDIDATE_PACKS[wanted] ?? []) {
    const pack = game?.packs?.get?.(packId);
    if (!pack) {
      warn("[COMPENDIUM_MISSING]", { type: wanted, packId });
      continue;
    }

    try {
      const index = await pack.getIndex({ fields: ["name", "type", "system.slug", "system.label"] });
      for (const entry of index) {
        if (String(entry?.type ?? "").toLowerCase() !== wanted) continue;
        const doc = await pack.getDocument(entry._id);
        const data = cloneItemData(doc);
        if (data) docs.push(data);
      }
    } catch (error) {
      warn("[COMPENDIUM_LOAD_ERROR]", { type: wanted, packId, error });
    }
  }

  return dedupeCandidates(docs);
}

export async function preloadMulticlassCandidatePacks(type = null) {
  const types = type ? [String(type).toLowerCase()] : Object.keys(MULTICLASS_CANDIDATE_CACHE);
  for (const wanted of types) {
    if (!Object.prototype.hasOwnProperty.call(MULTICLASS_CANDIDATE_CACHE, wanted)) continue;
    if (!Array.isArray(MULTICLASS_CANDIDATE_CACHE[wanted])) {
      MULTICLASS_CANDIDATE_CACHE[wanted] = await loadCandidatePack(wanted);
    }
  }
  return type ? (MULTICLASS_CANDIDATE_CACHE[String(type).toLowerCase()] ?? []) : MULTICLASS_CANDIDATE_CACHE;
}

Hooks.once("ready", () => {
  preloadMulticlassCandidatePacks().catch(error => warn("[COMPENDIUM_PRELOAD_ERROR]", error));
});

export function comboTokens(combo) {
  if (Array.isArray(combo)) return combo.map(norm).filter(Boolean);
  if (typeof combo === "string") return combo.split(/[+/;,|\n]+/).map(norm).filter(Boolean);
  if (combo && typeof combo === "object" && Array.isArray(combo.classes)) return combo.classes.map(norm).filter(Boolean);
  return [];
}

export function allowedCombosFromRace(raceData) {
  const sys = raceData?.system ?? raceData ?? {};
  const combos = Array.isArray(sys.multiclassing?.allowedCombinations) ? sys.multiclassing.allowedCombinations : [];
  return combos.map(comboTokens).map(tokens => [...new Set(tokens)]).filter(tokens => tokens.length >= 2);
}

export function raceAllowsClassSet(raceData, names) {
  const wanted = [...new Set((names ?? []).map(norm).filter(Boolean))];
  if (wanted.length <= 1) return true;
  return allowedCombosFromRace(raceData).some(combo => wanted.every(key => combo.includes(key)));
}

export function classRaceMaxLevel(classData, raceData) {
  const sys = classData?.system ?? classData ?? {};
  const rules = sys.raceRestriction?.races ?? {};
  const raceKey = `race:${norm(itemLabel(raceData, "Race"))}`;
  const rule = rules[raceKey] ?? rules[norm(raceKey)] ?? null;
  const value = Number(rule?.maxLevel ?? rule?.niveauMax ?? rule?.max ?? 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function raceMatchesClassRules(raceData, classData) {
  const sys = classData?.system ?? classData ?? {};
  const rules = sys.raceRestriction?.races ?? null;
  if (!rules || typeof rules !== "object" || !Object.keys(rules).length) return true;
  const raceKey = `race:${norm(itemLabel(raceData, "Race"))}`;
  const rule = rules[raceKey] ?? rules[norm(raceKey)] ?? null;
  return rule?.allowed === true;
}

export function classPrerequisitesOk(actor, classData, raceData = null, options = {}) {
  if (typeof globalThis.checkClassStatMin === "function") {
    const alignment = pickClassAlignment(actor, classData);
    return globalThis.checkClassStatMin(
      actor,
      classData,
      raceData,
      alignment,
      { silent: options?.notify !== true, ignoreLevelMax: true }
    ) === true;
  }
  return raceMatchesClassRules(raceData ?? systemRace(actor), classData);
}

export function worldItemsByType(type) {
  const wanted = String(type ?? "").toLowerCase();
  const cached = MULTICLASS_CANDIDATE_CACHE[wanted];
  if (Array.isArray(cached) && cached.length) return cached.map(cloneItemData).filter(Boolean);
  return Array.from(game?.items ?? [])
    .filter(item => String(item?.type ?? "").toLowerCase() === wanted)
    .map(cloneItemData)
    .filter(Boolean);
}

export function uniqueRaces(actor) {
  const current = actor?.items?.find?.(item => String(item?.type ?? "").toLowerCase() === "race") ?? null;
  const seen = new Set();
  return [...(current ? [cloneItemData(current)] : []), ...worldItemsByType("race")]
    .filter(Boolean)
    .filter(race => {
      const key = norm(itemLabel(race, "Race"));
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function currentRaceOrCompatibleAlternatives(actor, predicate) {
  const current = systemRace(actor);
  const ordered = [];
  const seen = new Set();

  const pushIfValid = race => {
    const key = norm(itemLabel(race, "Race"));
    if (!race || !key || seen.has(key) || !predicate(race)) return;
    seen.add(key);
    ordered.push(race);
  };

  pushIfValid(current);
  for (const race of uniqueRaces(actor)) pushIfValid(race);
  return ordered;
}

export function wantedClassNames(actor, classData = null) {
  const names = classItems(actor).map(item => item.name);
  if (!classData) return names;
  const wanted = classSlug(classData);
  return classItems(actor).some(item => classSlug(item) === wanted)
    ? names
    : [...names, itemLabel(classData, "Classe")];
}

export function raceCompatibleForMulticlass(actor, classData, raceData) {
  return raceAllowsClassSet(raceData, wantedClassNames(actor, classData))
    && raceMatchesClassRules(raceData, classData)
    && classPrerequisitesOk(actor, classData, raceData, { notify: false });
}

export function raceCandidatesForClass(actor, classData) {
  return currentRaceOrCompatibleAlternatives(actor, race => raceCompatibleForMulticlass(actor, classData, race));
}

export function monoClassOptionsForDroppedClass(actor, classData) {
  return currentRaceOrCompatibleAlternatives(actor, race =>
    raceMatchesClassRules(race, classData) && classPrerequisitesOk(actor, classData, race, { notify: false })
  ).map(raceData => ({ action: "monoclass", classData, raceData }));
}

export function parseXpRange(raw) {
  const values = String(raw ?? "").match(/[0-9][0-9.\s]*/g)
    ?.map(value => num(value, NaN))
    .filter(Number.isFinite) ?? [];
  return { min: values[0] ?? 0, max: values[1] ?? null };
}

export function progressionRows(classSystem) {
  const progression = Array.isArray(classSystem?.progression) ? classSystem.progression : [];
  return progression
    .map((row, index) => {
      const range = parseXpRange(row?.xp ?? row?.experience ?? row?.xpRange ?? row?.niveau_xp ?? "");
      return {
        ...row,
        niveau: num(row?.niveau ?? row?.level ?? index + 1, index + 1),
        xpMin: range.min,
        xpMax: range.max
      };
    })
    .filter(row => row.niveau > 0)
    .sort((left, right) => left.niveau - right.niveau);
}

export function levelForClassXp(classSystem, xpValue) {
  const xp = Math.max(0, Math.floor(num(xpValue, 0)));
  const rows = progressionRows(classSystem);
  if (!rows.length) return 1;
  let current = rows[0];
  for (const row of rows) if (xp >= row.xpMin) current = row;
  return Math.max(1, Number(current.niveau) || 1);
}

export function minXpForClassLevel(classSystem, levelValue) {
  const level = Math.max(1, Math.floor(num(levelValue, 1)));
  const rows = progressionRows(classSystem);
  const row = rows.find(entry => Number(entry.niveau) === level)
    ?? rows.filter(entry => Number(entry.niveau) <= level).at(-1)
    ?? rows[0]
    ?? null;
  return Math.max(0, Math.floor(num(row?.xpMin, 0)));
}

export function nextXpForClassLevel(classSystem, level) {
  const next = progressionRows(classSystem).find(row => Number(row.niveau) > Number(level));
  return next ? Math.max(0, Number(next.xpMin) || 0) : 0;
}

export function classTitleForLevel(classSystem, level) {
  const rows = progressionRows(classSystem);
  const rowTitle = rows.find(row => Number(row.niveau) === Number(level))?.title;
  if (rowTitle) return rowTitle;
  const titles = Array.isArray(classSystem?.titlesByLevel) ? classSystem.titlesByLevel : [];
  return titles.find(title =>
    Number(level) >= Number(title.minLevel ?? title.niveauMin ?? 0)
    && Number(level) <= Number(title.maxLevel ?? title.niveauMax ?? 999)
  )?.title ?? "";
}

function uniqueClassDocs(docs) {
  const seen = new Set();
  const output = [];
  for (const doc of docs ?? []) {
    const slug = classSlug(doc);
    if (!doc || !slug || seen.has(slug)) continue;
    seen.add(slug);
    output.push(doc);
  }
  return output;
}

function classDocForRecord(docs, record) {
  const itemId = String(record?.itemId ?? "");
  const slug = norm(record?.slug);
  return docs.find(doc =>
    (itemId && String(doc.id ?? "") === itemId)
    || (slug && classSlug(doc) === slug)
  ) ?? null;
}

export function canonicalStateRecord(classDoc, { level = 1, xp = 0 } = {}) {
  const system = classDoc?.system ?? {};
  return {
    itemId: classDoc?.id ?? null,
    uuid: classDoc?.uuid ?? null,
    name: classDoc?.name ?? itemLabel(classDoc, "Classe"),
    slug: classSlug(classDoc),
    level: Math.max(1, Math.floor(num(level, 1))),
    xp: Math.max(0, Math.floor(num(xp, 0))),
    title: "",
    nextXp: 0,
    levelMaxRace: 0
  };
}

function materializeEntries(actor, { docs = classItems(actor), classStates = null, raceData = systemRace(actor) } = {}) {
  const uniqueDocs = uniqueClassDocs(docs);
  const records = Array.isArray(classStates)
    ? classStates.filter(entry => entry && typeof entry === "object")
    : canonicalClassStates(actor);

  if (!records.length || !uniqueDocs.length) return [];
  const entries = [];
  const consumedIds = new Set();

  for (const record of records) {
    const doc = classDocForRecord(uniqueDocs, record);
    if (!doc || consumedIds.has(doc.id)) continue;
    consumedIds.add(doc.id);

    const system = foundry.utils.deepClone(doc.system ?? {});
    let level = Math.max(1, Math.floor(num(record.level, 1)));
    let xp = Math.max(0, Math.floor(num(record.xp, 0)));
    const maxLevel = classRaceMaxLevel(doc, raceData);

    if (maxLevel > 0 && level > maxLevel) level = maxLevel;
    xp = Math.max(xp, minXpForClassLevel(system, level));
    if (maxLevel > 0 && level >= maxLevel) xp = Math.max(xp, minXpForClassLevel(system, maxLevel));

    const title = classTitleForLevel(system, level);
    entries.push({
      doc,
      itemId: doc.id ?? null,
      uuid: doc.uuid ?? null,
      name: doc.name ?? itemLabel(doc, "Classe"),
      slug: classSlug(doc),
      system,
      level,
      xp,
      title,
      nextXp: nextXpForClassLevel(system, level),
      levelMaxRace: maxLevel,
      hitDie: system.hitDie ?? system.dv ?? null,
      spellcasting: system.spellcasting ?? null
    });
  }

  return entries;
}

export function canonicalMulticlassEntries(actor) {
  return materializeEntries(actor);
}

function displaySpellcasting(entries) {
  const lists = [...new Set(entries.flatMap(entry =>
    entry.spellcasting?.enabled && Array.isArray(entry.spellcasting.lists)
      ? entry.spellcasting.lists
      : []
  ).filter(Boolean))];

  return lists.length
    ? {
      enabled: true,
      mode: "multiclass",
      type: "prepared",
      lists,
      usesSlots: true,
      usesPreparation: true,
      preparationSource: "multiclasse.classes"
    }
    : null;
}

function legacyProjection(entries) {
  const xp = {};
  const levels = {};
  const titles = {};
  const next = {};
  const max = {};

  for (const entry of entries) {
    xp[entry.slug] = entry.xp;
    levels[entry.slug] = entry.level;
    titles[entry.slug] = entry.title;
    next[entry.slug] = entry.nextXp;
    if (entry.levelMaxRace > 0) max[entry.slug] = entry.levelMaxRace;
  }

  return { xp, levels, titles, next, max };
}

export function multiclassUpdatePayload(actor, options = {}) {
  const docs = options?.docs ?? classItems(actor);
  const raceData = options?.raceData ?? systemRace(actor);
  const explicitStates = options?.classStates ?? null;
  const entries = materializeEntries(actor, { docs, classStates: explicitStates, raceData });

  if (entries.length <= 1) return null;

  const projection = legacyProjection(entries);
  const label = entries.map(entry => entry.name).join(" / ");
  const maxLevel = Math.max(...entries.map(entry => entry.level));
  const totalXp = entries.reduce((sum, entry) => sum + entry.xp, 0);
  const nextValues = entries.map(entry => entry.nextXp).filter(value => value > 0);
  const nextXp = nextValues.length ? Math.min(...nextValues) : 0;

  const canonicalClasses = entries.map(entry => ({
    itemId: entry.itemId,
    uuid: entry.uuid,
    name: entry.name,
    slug: entry.slug,
    level: entry.level,
    xp: entry.xp,
    title: entry.title,
    nextXp: entry.nextXp,
    levelMaxRace: entry.levelMaxRace
  }));

  return {
    "system.multiclasse": {
      schema: MULTICLASS_SCHEMA,
      enabled: true,
      mode: "racial",
      xpSplit: "equal",
      label,
      classes: canonicalClasses
    },
    "system.classe": label,
    "system.details_classe": {
      label,
      name: label,
      multiclass: true,
      source: "multiclasse.classes"
    },
    "system.xp": totalXp,
    "system.niveau": maxLevel,
    "system.niveau_suggere": maxLevel,
    "system.titre": entries.map(entry => `${entry.name} ${entry.level}${entry.title ? ` (${entry.title})` : ""}`).join(" / "),
    "system.progression_xp": entries.map(entry =>
      `${entry.name} ${entry.xp.toLocaleString()}${entry.nextXp ? ` / ${entry.nextXp.toLocaleString()} XP` : " XP"}${entry.levelMaxRace ? ` — max racial ${entry.levelMaxRace}` : ""}`
    ).join(" — "),
    "system.xp_next": nextXp,
    "system.xp_to_next": nextXp ? Math.max(0, nextXp - Math.min(...entries.map(entry => entry.xp))) : 0,
    "system.xp_percent": 0,
    "system.spellcasting": displaySpellcasting(entries),

    // Projections de compatibilité temporaire pour les mécaniques historiques.
    // Elles sont toujours réécrites depuis system.multiclasse.classes et ne sont
    // jamais relues par les opérations de multiclassage.
    "system.xp_par_classe": projection.xp,
    "system.niveaux_par_classe": projection.levels,
    "system.titres_par_classe": projection.titles,
    "system.xp_next_par_classe": projection.next,
    "system.niveau_max_par_classe": projection.max,

    // Anciennes copies de définitions de classe : supprimées, pas synchronisées.
    "system.-=classes": null,
    "system.-=details_classes": null
  };
}

export function monoClassCleanupPayload() {
  return {
    "system.multiclasse": {
      schema: MULTICLASS_SCHEMA,
      enabled: false,
      mode: "mono",
      xpSplit: "none",
      label: "",
      classes: []
    },
    "system.-=classes": null,
    "system.-=details_classes": null,
    "system.-=xp_par_classe": null,
    "system.-=niveaux_par_classe": null,
    "system.-=titres_par_classe": null,
    "system.-=xp_next_par_classe": null,
    "system.-=niveau_max_par_classe": null
  };
}

// Migration unique. Les champs historiques ne sont lus qu'ici, avant d'être
// remplacés par le schéma 2. Aucun chemin de règle n'appelle cette lecture.
export function legacyMulticlassMigrationPayload(actor) {
  const docs = uniqueClassDocs(classItems(actor));
  if (docs.length <= 1) return null;
  if (canonicalMulticlass(actor)) return multiclassUpdatePayload(actor);

  const sys = actor?.system ?? {};
  const legacyState = sys.multiclasse ?? {};
  const legacyOrder = Array.isArray(legacyState.classes)
    ? legacyState.classes.map(entry => norm(typeof entry === "string" ? entry : entry?.slug)).filter(Boolean)
    : [];
  const xpMap = sys.xp_par_classe && typeof sys.xp_par_classe === "object" ? sys.xp_par_classe : {};
  const levelMap = sys.niveaux_par_classe && typeof sys.niveaux_par_classe === "object" ? sys.niveaux_par_classe : {};
  const legacyWasMonoclass = legacyState?.enabled !== true
    && Object.keys(xpMap).length === 0
    && Object.keys(levelMap).length === 0;

  const orderedDocs = [...docs].sort((left, right) => {
    const leftIndex = legacyOrder.indexOf(classSlug(left));
    const rightIndex = legacyOrder.indexOf(classSlug(right));
    return (leftIndex < 0 ? Number.MAX_SAFE_INTEGER : leftIndex) - (rightIndex < 0 ? Number.MAX_SAFE_INTEGER : rightIndex);
  });

  const states = orderedDocs.map((doc, index) => {
    const slug = classSlug(doc);
    const inheritedMonoclass = legacyWasMonoclass && index === 0;
    const rawXp = xpMap[slug] ?? (inheritedMonoclass ? sys.xp : 0);
    const rawLevel = levelMap[slug] ?? (inheritedMonoclass ? sys.niveau : null);
    const xp = Math.max(0, Math.floor(num(rawXp, 0)));
    const level = rawLevel === null || rawLevel === undefined
      ? levelForClassXp(doc.system ?? {}, xp)
      : Math.max(1, Math.floor(num(rawLevel, 1)));
    return canonicalStateRecord(doc, { level, xp });
  });

  return multiclassUpdatePayload(actor, {
    docs: orderedDocs,
    classStates: states,
    raceData: systemRace(actor)
  });
}

export function monoClassStateFromActor(actor, classDoc) {
  const level = Math.max(1, Math.floor(num(actor?.system?.niveau, 1)));
  const xp = Math.max(0, Math.floor(num(actor?.system?.xp, 0)));
  return canonicalStateRecord(classDoc, { level, xp });
}
