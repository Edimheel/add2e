// ADD2E — Multiclassage : règles et résumés
// Les Items classe portent leur définition et leur progression.
// system.multiclasse ne contient que des métadonnées et des résumés d'affichage.

import {
  MULTICLASS_SCHEMA,
  canonicalClassState,
  classItems,
  classProgression,
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
const MULTICLASS_CANDIDATE_CACHE = { race: null, classe: null };

function candidateKey(data) {
  const system = data?.system ?? {};
  return norm(data?.name ?? system.slug ?? system.label ?? system.name ?? system.nom ?? data?.id ?? "");
}

function dedupeCandidates(items) {
  const seen = new Set();
  return (items ?? []).filter(item => {
    const key = candidateKey(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function loadCandidatePack(type) {
  const docs = [];
  for (const packId of MULTICLASS_CANDIDATE_PACKS[String(type ?? "").toLowerCase()] ?? []) {
    const pack = game?.packs?.get?.(packId);
    if (!pack) {
      warn("[COMPENDIUM_MISSING]", { type, packId });
      continue;
    }
    try {
      const index = await pack.getIndex({ fields: ["name", "type", "system.slug", "system.label"] });
      for (const entry of index) {
        if (String(entry?.type ?? "").toLowerCase() !== String(type ?? "").toLowerCase()) continue;
        const document = await pack.getDocument(entry._id);
        const data = cloneItemData(document);
        if (data) docs.push(data);
      }
    } catch (error) {
      warn("[COMPENDIUM_LOAD_ERROR]", { type, packId, error });
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

Hooks.once("ready", () => preloadMulticlassCandidatePacks().catch(error => warn("[COMPENDIUM_PRELOAD_ERROR]", error)));

export function comboTokens(combo) {
  if (Array.isArray(combo)) return combo.map(norm).filter(Boolean);
  if (typeof combo === "string") return combo.split(/[+/;,|\n]+/).map(norm).filter(Boolean);
  if (combo && typeof combo === "object" && Array.isArray(combo.classes)) return combo.classes.map(norm).filter(Boolean);
  return [];
}

/**
 * La race est la source de vérité. Une combinaison de trois classes autorise
 * ses sous-ensembles pendant la construction progressive du multiclassage.
 */
export function allowedCombosFromRace(raceData) {
  const combos = Array.isArray((raceData?.system ?? raceData ?? {}).multiclassing?.allowedCombinations)
    ? (raceData?.system ?? raceData ?? {}).multiclassing.allowedCombinations
    : [];
  return combos.map(comboTokens).map(tokens => [...new Set(tokens)]).filter(tokens => tokens.length >= 2);
}

export function raceAllowsClassSet(raceData, names) {
  const wanted = [...new Set((names ?? []).map(norm).filter(Boolean))];
  if (wanted.length <= 1) return true;
  return allowedCombosFromRace(raceData).some(combo => wanted.every(key => combo.includes(key)));
}

export function classRaceMaxLevel(classData, raceData) {
  const rules = (classData?.system ?? classData ?? {}).raceRestriction?.races ?? {};
  const raceKey = `race:${norm(itemLabel(raceData, "Race"))}`;
  const rule = rules[raceKey] ?? rules[norm(raceKey)] ?? null;
  const value = Number(rule?.maxLevel ?? rule?.niveauMax ?? rule?.max ?? 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function raceMatchesClassRules(raceData, classData) {
  const rules = (classData?.system ?? classData ?? {}).raceRestriction?.races ?? null;
  if (!rules || typeof rules !== "object" || !Object.keys(rules).length) return true;
  const raceKey = `race:${norm(itemLabel(raceData, "Race"))}`;
  return (rules[raceKey] ?? rules[norm(raceKey)] ?? null)?.allowed === true;
}

export function classPrerequisitesOk(actor, classData, raceData = null, options = {}) {
  if (typeof globalThis.checkClassStatMin === "function") {
    return globalThis.checkClassStatMin(
      actor,
      classData,
      raceData,
      pickClassAlignment(actor, classData),
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
  const ordered = [];
  const seen = new Set();
  for (const race of [systemRace(actor), ...uniqueRaces(actor)]) {
    const key = norm(itemLabel(race, "Race"));
    if (!race || !key || seen.has(key) || !predicate(race)) continue;
    seen.add(key);
    ordered.push(race);
  }
  return ordered;
}

export function wantedClassNames(actor, classData = null) {
  const names = classItems(actor).map(item => item.name);
  if (!classData || classItems(actor).some(item => classSlug(item) === classSlug(classData))) return names;
  return [...names, itemLabel(classData, "Classe")];
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

function parseXpInteger(raw) {
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.max(0, Math.floor(raw));
  const compact = String(raw ?? "").trim().replace(/[.\s,]/g, "");
  if (!/^\d+$/.test(compact)) return NaN;
  const value = Number(compact);
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : NaN;
}

export function parseXpRange(raw) {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const value = parseXpInteger(raw);
    return { min: value, max: null };
  }
  const values = String(raw ?? "")
    .match(/[0-9][0-9.\s,]*/g)
    ?.map(parseXpInteger)
    .filter(Number.isFinite) ?? [];
  return { min: values[0] ?? 0, max: values[1] ?? null };
}

/**
 * Répartit exactement un total d'XP entre les classes d'un multiclassé.
 * Le quotient est identique pour toutes les classes et le reste entier est
 * attribué dans l'ordre des classes déjà présentes afin de ne perdre aucun XP.
 */
export function splitMulticlassXp(totalXpValue, classCountValue) {
  const totalXp = Math.max(0, Math.floor(num(totalXpValue, 0)));
  const classCount = Math.max(1, Math.floor(num(classCountValue, 1)));
  const base = Math.floor(totalXp / classCount);
  const remainder = totalXp - (base * classCount);
  return Array.from({ length: classCount }, (_entry, index) => base + (index < remainder ? 1 : 0));
}

export function progressionRows(classSystem) {
  return (Array.isArray(classSystem?.progression) ? classSystem.progression : [])
    .map((row, index) => {
      const range = parseXpRange(row?.xp ?? row?.experience ?? row?.xpRange ?? row?.niveau_xp ?? "");
      return { ...row, niveau: num(row?.niveau ?? row?.level ?? index + 1, index + 1), xpMin: range.min, xpMax: range.max };
    })
    .filter(row => row.niveau > 0)
    .sort((left, right) => left.niveau - right.niveau);
}

export function levelForClassXp(classSystem, xpValue) {
  const rows = progressionRows(classSystem);
  if (!rows.length) return 1;
  const xp = Math.max(0, Math.floor(num(xpValue, 0)));
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
  const rowTitle = progressionRows(classSystem).find(row => Number(row.niveau) === Number(level))?.title;
  if (rowTitle) return rowTitle;
  const titles = Array.isArray(classSystem?.titlesByLevel) ? classSystem.titlesByLevel : [];
  return titles.find(title => Number(level) >= Number(title.minLevel ?? title.niveauMin ?? 0)
    && Number(level) <= Number(title.maxLevel ?? title.niveauMax ?? 999))?.title ?? "";
}

function uniqueClassDocs(docs) {
  const seen = new Set();
  return (docs ?? []).filter(doc => {
    const slug = classSlug(doc);
    if (!doc || !slug || seen.has(slug)) return false;
    seen.add(slug);
    return true;
  });
}

export function canonicalStateRecord(classDoc, { level = 1, xp = 0 } = {}) {
  return {
    itemId: classDoc?.id ?? null,
    uuid: classDoc?.uuid ?? null,
    name: classDoc?.name ?? itemLabel(classDoc, "Classe"),
    slug: classSlug(classDoc),
    level: Math.max(1, Math.floor(num(level, 1))),
    xp: Math.max(0, Math.floor(num(xp, 0)))
  };
}

function materializeEntries(actor, { docs = classItems(actor), raceData = systemRace(actor) } = {}) {
  const entries = [];
  for (const doc of uniqueClassDocs(docs)) {
    const stored = classProgression(doc);
    if (!stored.hasLevel || !stored.hasXp) {
      throw new Error(`Item de classe « ${doc?.name ?? doc?.id ?? "inconnu"} » sans system.niveau/system.xp canonique.`);
    }
    let level = stored.level;
    let xp = stored.xp;
    const maxLevel = classRaceMaxLevel(doc, raceData);
    if (maxLevel > 0 && level > maxLevel) level = maxLevel;
    xp = Math.max(xp, minXpForClassLevel(doc.system ?? {}, level));
    entries.push({
      doc,
      itemId: doc.id ?? null,
      uuid: doc.uuid ?? null,
      name: doc.name ?? itemLabel(doc, "Classe"),
      slug: classSlug(doc),
      system: foundry.utils.deepClone(doc.system ?? {}),
      level,
      xp,
      title: classTitleForLevel(doc.system ?? {}, level),
      nextXp: nextXpForClassLevel(doc.system ?? {}, level),
      levelMaxRace: maxLevel,
      spellcasting: doc.system?.spellcasting ?? null
    });
  }
  return entries;
}

export function canonicalMulticlassEntries(actor) {
  return materializeEntries(actor);
}

function displaySpellcasting(entries) {
  const lists = [...new Set(entries.flatMap(entry =>
    entry.spellcasting?.enabled && Array.isArray(entry.spellcasting.lists) ? entry.spellcasting.lists : []
  ).filter(Boolean))];
  return lists.length ? {
    enabled: true,
    mode: "multiclass",
    type: "prepared",
    lists,
    usesSlots: true,
    usesPreparation: true,
    preparationSource: "class-items"
  } : null;
}

/** L'opérateur Foundry remplace définitivement la syntaxe -= dépréciée. */
function forcedDeletion() {
  const deletion = foundry?.data?.operators?.ForcedDeletion;
  if (!deletion) throw new Error("[ADD2E] FoundryData ForcedDeletion est indisponible.");
  return deletion;
}

function clearLegacyClassCopies() {
  const deletion = forcedDeletion();
  return {
    "system.classes": deletion,
    "system.details_classes": deletion,
    "system.xp_par_classe": deletion,
    "system.niveaux_par_classe": deletion,
    "system.titres_par_classe": deletion,
    "system.xp_next_par_classe": deletion,
    "system.niveau_max_par_classe": deletion,
    "system.multiclasse.classes": deletion
  };
}

export function multiclassUpdatePayload(actor, options = {}) {
  const entries = materializeEntries(actor, {
    docs: options?.docs ?? classItems(actor),
    raceData: options?.raceData ?? systemRace(actor)
  });
  if (entries.length <= 1) return null;

  const label = entries.map(entry => entry.name).join(" / ");
  const maxLevel = Math.max(...entries.map(entry => entry.level));
  const totalXp = entries.reduce((sum, entry) => sum + entry.xp, 0);
  const nextValues = entries.map(entry => entry.nextXp).filter(value => value > 0);
  const nextXp = nextValues.length ? Math.min(...nextValues) : 0;

  return {
    "system.multiclasse": {
      schema: MULTICLASS_SCHEMA,
      enabled: true,
      mode: "racial",
      xpSplit: "equal",
      label
    },
    "system.classe": label,
    "system.details_classe": { label, name: label, multiclass: true, source: "class-items" },
    "system.xp": totalXp,
    "system.niveau": maxLevel,
    "system.niveau_suggere": maxLevel,
    "system.titre": entries.map(entry => `${entry.name} ${entry.level}${entry.title ? ` (${entry.title})` : ""}`).join(" / "),
    "system.progression_xp": entries.map(entry => `${entry.name} ${entry.xp.toLocaleString()}${entry.nextXp ? ` / ${entry.nextXp.toLocaleString()} XP` : " XP"}${entry.levelMaxRace ? ` — max racial ${entry.levelMaxRace}` : ""}`).join(" — "),
    "system.xp_next": nextXp,
    "system.xp_to_next": nextXp ? Math.max(0, nextXp - Math.min(...entries.map(entry => entry.xp))) : 0,
    "system.xp_percent": 0,
    "system.spellcasting": displaySpellcasting(entries),
    ...(options?.presentation === true ? {} : clearLegacyClassCopies())
  };
}

export function monoClassCleanupPayload() {
  return {
    "system.multiclasse": { schema: MULTICLASS_SCHEMA, enabled: false, mode: "mono", xpSplit: "none", label: "" },
    ...clearLegacyClassCopies()
  };
}

export function classEntryFromItem(actor, classDoc) {
  const state = canonicalClassState(actor, classDoc);
  if (!state) return null;
  if (!state.hasLevel || !state.hasXp) {
    throw new Error(`Item de classe « ${classDoc?.name ?? classDoc?.id ?? "inconnu"} » sans system.niveau/system.xp canonique.`);
  }
  return canonicalStateRecord(classDoc, { level: state.level, xp: state.xp });
}
