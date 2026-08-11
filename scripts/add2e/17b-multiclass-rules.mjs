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
  num,
  pickClassAlignment,
  raceSlug,
  systemRace,
  warn
} from "./17b-multiclass-core.mjs";

const MULTICLASS_CANDIDATE_PACKS = {
  race: ["add2e.races"],
  classe: ["add2e.classes"]
};
const MULTICLASS_CANDIDATE_CACHE = { race: null, classe: null };

function candidateKey(data) {
  const type = String(data?.type ?? "").toLowerCase();
  if (type === "race") return `race:${raceSlug(data)}`;
  if (type === "classe") return `classe:${classSlug(data)}`;
  throw new Error(`Type de candidat multiclassage invalide : ${data?.type ?? "absent"}.`);
}

function dedupeCandidates(items) {
  const seen = new Set();
  return (items ?? []).filter(item => {
    const key = candidateKey(item);
    if (seen.has(key)) return false;
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
      const index = await pack.getIndex({ fields: ["name", "type"] });
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

function canonicalCombinationClassSlug(value, raceData) {
  const slug = String(value ?? "").trim();
  if (!/^[a-z0-9_]+$/.test(slug)) {
    throw new Error(`Combinaison multiclassage invalide pour « ${raceData?.name ?? raceData?.id ?? "race inconnue"} » : slug de classe « ${value ?? ""} » non canonique.`);
  }
  return slug;
}

export function comboTokens(combo, raceData = null) {
  if (!combo || typeof combo !== "object" || !Array.isArray(combo.classes)) {
    throw new Error(`Combinaison multiclassage invalide pour « ${raceData?.name ?? raceData?.id ?? "race inconnue"} » : classes[] est requis.`);
  }
  return [...new Set(combo.classes.map(value => canonicalCombinationClassSlug(value, raceData)))];
}

/**
 * La race est la source de vérité. Une combinaison de trois classes autorise
 * ses sous-ensembles pendant la construction progressive du multiclassage.
 */
export function allowedCombosFromRace(raceData) {
  const combos = (raceData?.system ?? raceData ?? {}).multiclassing?.allowedCombinations;
  if (combos === undefined || combos === null) return [];
  if (!Array.isArray(combos)) {
    throw new Error(`Item race « ${raceData?.name ?? raceData?.id ?? "inconnu"} » : system.multiclassing.allowedCombinations doit être un tableau.`);
  }
  return combos.map(combo => comboTokens(combo, raceData)).filter(tokens => tokens.length >= 2);
}

export function raceAllowsClassSet(raceData, classSlugs) {
  const wanted = [...new Set((classSlugs ?? []).map(value => canonicalCombinationClassSlug(value, raceData)))];
  if (wanted.length <= 1) return true;
  return allowedCombosFromRace(raceData).some(combo => wanted.every(key => combo.includes(key)));
}

function classRaceRuleKey(raceData) {
  return `race:${raceSlug(raceData)}`;
}

export function classRaceMaxLevel(classData, raceData) {
  const rules = (classData?.system ?? classData ?? {}).raceRestriction?.races ?? null;
  if (!rules || typeof rules !== "object" || !Object.keys(rules).length) return 0;
  const rule = rules[classRaceRuleKey(raceData)] ?? null;
  if (!rule || rule.allowed !== true) return 0;
  if (rule.maxLevel === undefined || rule.maxLevel === null || rule.maxLevel === "") return 0;
  const value = Number(rule.maxLevel);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Restriction raciale invalide pour « ${classData?.name ?? classData?.id ?? "classe inconnue"} » et ${classRaceRuleKey(raceData)} : maxLevel doit être positif ou null.`);
  }
  return Math.floor(value);
}

export function raceMatchesClassRules(raceData, classData) {
  const rules = (classData?.system ?? classData ?? {}).raceRestriction?.races ?? null;
  if (!rules || typeof rules !== "object" || !Object.keys(rules).length) return true;
  return rules[classRaceRuleKey(raceData)]?.allowed === true;
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
  const current = systemRace(actor);
  const seen = new Set();
  return [...(current ? [cloneItemData(current)] : []), ...worldItemsByType("race")]
    .filter(Boolean)
    .filter(race => {
      const key = raceSlug(race);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function currentRaceOrCompatibleAlternatives(actor, predicate) {
  return uniqueRaces(actor).filter(race => predicate(race));
}

export function wantedClassSlugs(actor, classData = null) {
  const slugs = classItems(actor).map(item => classSlug(item));
  if (!classData) return slugs;
  const candidate = classSlug(classData);
  return slugs.includes(candidate) ? slugs : [...slugs, candidate];
}

export function raceCompatibleForMulticlass(actor, classData, raceData) {
  return raceAllowsClassSet(raceData, wantedClassSlugs(actor, classData))
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

/**
 * Retourne les lignes de progression canoniques d'une classe.
 * Contrat source unique : progression[].niveau entier et progression[].xp entier.
 */
export function progressionRows(classSystem) {
  const progression = classSystem?.progression;
  if (!Array.isArray(progression)) return [];

  const rows = progression.map((row, index) => {
    const niveau = Number(row?.niveau);
    const xp = Number(row?.xp);
    if (!Number.isInteger(niveau) || niveau < 1) {
      throw new Error(`Ligne de progression ${index + 1} sans niveau canonique.`);
    }
    if (!Number.isFinite(xp) || xp < 0) {
      throw new Error(`Ligne de progression niveau ${niveau} sans seuil XP canonique.`);
    }
    return {
      ...row,
      niveau,
      xp: Math.floor(xp),
      xpMin: Math.floor(xp),
      xpMax: null
    };
  }).sort((left, right) => left.niveau - right.niveau);

  for (let index = 0; index < rows.length - 1; index += 1) {
    rows[index].xpMax = Math.max(rows[index].xpMin, rows[index + 1].xpMin - 1);
  }
  return rows;
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
  return titles.find(title => Number(level) >= Number(title.minLevel)
    && Number(level) <= Number(title.maxLevel))?.title ?? "";
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
