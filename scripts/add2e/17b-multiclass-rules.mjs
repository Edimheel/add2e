// ADD2E — Multiclassage : règles, progression et payload
// Version : 2026-06-16-multiclass-rules-compendium-aliases-v2

import { classItems, classSlug, cloneItemData, itemLabel, norm, num, pickClassAlignment, systemRace, warn } from "./17b-multiclass-core.mjs";

const MULTICLASS_CANDIDATE_PACKS = {
  race: ["add2e.races"],
  classe: ["add2e.classes"]
};

const MULTICLASS_CANDIDATE_CACHE = {
  race: null,
  classe: null
};

function mNorm(value) {
  const n = norm(value);
  const aliases = {
    illusioniste: "illusionniste",
    illusionnist: "illusionniste",
    illusionniste: "illusionniste",
    demi_orc: "demi_orque",
    demi_orque: "demi_orque",
    half_orc: "demi_orque"
  };
  return aliases[n] ?? n;
}

function candidateKey(data) {
  const sys = data?.system ?? {};
  return mNorm(data?.name ?? sys.slug ?? sys.label ?? sys.name ?? sys.nom ?? data?.id ?? "");
}

function dedupeCandidates(items) {
  const seen = new Set();
  const out = [];
  for (const item of items ?? []) {
    const key = candidateKey(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

async function loadCandidatePack(type) {
  const wanted = String(type ?? "").toLowerCase();
  const docs = [];

  for (const packId of MULTICLASS_CANDIDATE_PACKS[wanted] ?? []) {
    const pack = game?.packs?.get?.(packId);
    if (!pack) {
      warn("[MULTICLASS][COMPENDIUM_MISSING]", { type: wanted, packId });
      continue;
    }

    try {
      const index = await pack.getIndex({ fields: ["name", "type", "system.slug", "system.label"] });
      for (const entry of index) {
        if (String(entry?.type ?? "").toLowerCase() !== wanted) continue;
        const doc = await pack.getDocument(entry._id);
        if (!doc) continue;
        const data = cloneItemData(doc);
        if (data) {
          data.flags = data.flags ?? {};
          data.flags.add2e = data.flags.add2e ?? {};
          data.flags.add2e.dropResolvedFromCompendium = true;
          data.flags.add2e.dropResolvedUuid = doc.uuid;
          data.pack = doc.pack;
          data.uuid = doc.uuid;
          docs.push(data);
        }
      }
    } catch (err) {
      warn("[MULTICLASS][COMPENDIUM_LOAD_ERROR]", { type: wanted, packId, err });
    }
  }

  return dedupeCandidates(docs);
}

export async function preloadMulticlassCandidatePacks(type = null) {
  const types = type ? [String(type).toLowerCase()] : Object.keys(MULTICLASS_CANDIDATE_CACHE);
  for (const wanted of types) {
    if (!Object.prototype.hasOwnProperty.call(MULTICLASS_CANDIDATE_CACHE, wanted)) continue;
    if (Array.isArray(MULTICLASS_CANDIDATE_CACHE[wanted])) continue;
    MULTICLASS_CANDIDATE_CACHE[wanted] = await loadCandidatePack(wanted);
  }
  return type ? (MULTICLASS_CANDIDATE_CACHE[String(type).toLowerCase()] ?? []) : MULTICLASS_CANDIDATE_CACHE;
}

Hooks.once("ready", () => {
  preloadMulticlassCandidatePacks().catch(err => warn("[MULTICLASS][COMPENDIUM_PRELOAD_ERROR]", err));
});

export function comboTokens(combo) {
  if (Array.isArray(combo)) return combo.map(mNorm).filter(Boolean);
  if (typeof combo === "string") return combo.split(/[+/;,|\n]+/).map(mNorm).filter(Boolean);
  if (combo && typeof combo === "object" && Array.isArray(combo.classes)) return combo.classes.map(mNorm).filter(Boolean);
  return [];
}

export function allowedCombosFromRace(raceData) {
  const sys = raceData?.system ?? raceData ?? {};
  const combos = Array.isArray(sys.multiclassing?.allowedCombinations) ? sys.multiclassing.allowedCombinations : [];
  return combos.map(comboTokens).map(tokens => [...new Set(tokens)]).filter(tokens => tokens.length >= 2);
}

export function raceAllowsClassSet(raceData, names) {
  const wanted = [...new Set(names.map(mNorm).filter(Boolean))];
  if (wanted.length <= 1) return true;
  const combos = allowedCombosFromRace(raceData);
  const ok = combos.some(combo => wanted.every(c => combo.includes(c)));
  if (!ok && globalThis.ADD2E_DEBUG_MULTICLASS === true) {
    console.warn("[ADD2E][MULTICLASSE][COMBO_REFUSED]", { race: itemLabel(raceData, "Race"), wanted, combos });
  }
  return ok;
}

function raceRuleKeys(raceData) {
  const label = itemLabel(raceData, "Race");
  const key = mNorm(label);
  return [...new Set([key, `race:${key}`, `race_${key}`])];
}

export function classRaceMaxLevel(classData, raceData) {
  const sys = classData?.system ?? classData ?? {};
  const rules = sys.raceRestriction?.races ?? {};
  let rule = null;
  for (const key of raceRuleKeys(raceData)) {
    rule = rules[key] ?? rules[norm(key)] ?? null;
    if (rule) break;
  }
  const value = Number(rule?.maxLevel ?? rule?.niveauMax ?? rule?.max ?? 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function raceMatchesClassRules(raceData, classData) {
  try {
    if (typeof add2eRaceMatchesClassRules === "function") return add2eRaceMatchesClassRules(raceData, classData) === true;
  } catch (err) { warn("[RACE_MATCH_GLOBAL_ERROR]", err); }
  const sys = classData?.system ?? classData ?? {};
  const rules = sys.raceRestriction?.races ?? null;
  if (!rules || typeof rules !== "object" || !Object.keys(rules).length) return true;
  for (const key of raceRuleKeys(raceData)) {
    const rule = rules[key] ?? rules[norm(key)] ?? null;
    if (rule) return rule.allowed === true;
  }
  return false;
}

export function classPrerequisitesOk(actor, classData, raceData = null, options = {}) {
  try {
    if (typeof checkClassStatMin === "function") {
      const alignment = pickClassAlignment(actor, classData);
      return checkClassStatMin(actor, classData, raceData, alignment, { silent: options?.notify !== true, ignoreLevelMax: true }) === true;
    }
  } catch (err) { warn("[PREREQUIS][ERROR]", err); }
  return raceMatchesClassRules(raceData ?? systemRace(actor), classData);
}

export function worldItemsByType(type) {
  const wanted = String(type ?? "").toLowerCase();
  const cached = MULTICLASS_CANDIDATE_CACHE[wanted];
  if (Array.isArray(cached) && cached.length) return cached.map(cloneItemData).filter(Boolean);

  try {
    if (typeof add2eWorldItemsByType === "function") return add2eWorldItemsByType(type);
  } catch (err) { warn("[WORLD_ITEMS_GLOBAL_ERROR]", err); }
  return Array.from(game?.items ?? []).filter(i => String(i.type || "").toLowerCase() === String(type).toLowerCase()).map(cloneItemData).filter(Boolean);
}

export function uniqueRaces(actor) {
  const current = actor?.items?.find?.(i => String(i.type || "").toLowerCase() === "race") ?? null;
  const seen = new Set();
  return [...(current ? [cloneItemData(current)] : []), ...worldItemsByType("race")].filter(Boolean).filter(race => {
    const key = mNorm(itemLabel(race, "Race"));
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
    const key = mNorm(itemLabel(race, "Race"));
    if (!race || !key || seen.has(key)) return;
    if (!predicate(race)) return;
    seen.add(key);
    ordered.push(race);
  };

  pushIfValid(current);
  for (const race of uniqueRaces(actor)) pushIfValid(race);
  return ordered;
}

export function wantedClassNames(actor, classData = null) {
  const existing = classItems(actor).map(c => c.name);
  if (!classData) return existing;
  const slug = classSlug(classData);
  if (classItems(actor).some(c => classSlug(c) === slug)) return existing;
  return [...existing, itemLabel(classData, "Classe")];
}

export function raceCompatibleForMulticlass(actor, classData, raceData) {
  return raceAllowsClassSet(raceData, wantedClassNames(actor, classData)) && raceMatchesClassRules(raceData, classData) && classPrerequisitesOk(actor, classData, raceData, { notify: false });
}

export function raceCandidatesForClass(actor, classData) {
  return currentRaceOrCompatibleAlternatives(actor, race => raceCompatibleForMulticlass(actor, classData, race));
}

export function monoClassOptionsForDroppedClass(actor, classData) {
  return currentRaceOrCompatibleAlternatives(actor, race => raceMatchesClassRules(race, classData) && classPrerequisitesOk(actor, classData, race, { notify: false })).map(raceData => ({ action: "monoclass", classData, raceData }));
}

export function parseXpRange(raw) {
  const values = String(raw ?? "").match(/[0-9][0-9.\s]*/g)?.map(v => num(v, NaN)).filter(Number.isFinite) ?? [];
  return { min: values[0] ?? 0, max: values[1] ?? null };
}

export function progressionRows(classSystem) {
  const progression = Array.isArray(classSystem?.progression) ? classSystem.progression : [];
  return progression.map((row, index) => {
    const range = parseXpRange(row?.xp ?? row?.experience ?? row?.xpRange ?? row?.niveau_xp ?? "");
    return { ...row, niveau: num(row?.niveau ?? row?.level ?? index + 1, index + 1), xpMin: range.min, xpMax: range.max };
  }).filter(r => r.niveau > 0).sort((a, b) => a.niveau - b.niveau);
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
  const row = rows.find(r => Number(r.niveau) === level) ?? rows.filter(r => Number(r.niveau) <= level).at(-1) ?? rows[0] ?? null;
  return Math.max(0, Math.floor(num(row?.xpMin, 0)));
}

export function nextXpForClassLevel(classSystem, level) {
  const next = progressionRows(classSystem).find(row => Number(row.niveau) > Number(level));
  return next ? Number(next.xpMin) || 0 : 0;
}

export function classTitleForLevel(classSystem, level) {
  const rows = progressionRows(classSystem);
  const rowTitle = rows.find(row => Number(row.niveau) === Number(level))?.title;
  if (rowTitle) return rowTitle;
  const titles = Array.isArray(classSystem?.titlesByLevel) ? classSystem.titlesByLevel : [];
  return titles.find(t => Number(level) >= Number(t.minLevel ?? t.niveauMin ?? 0) && Number(level) <= Number(t.maxLevel ?? t.niveauMax ?? 999))?.title ?? "";
}

export function multiclassUpdatePayload(actor, extraClassDoc = null, xpByClass = null, levelByClass = null, raceDataOverride = null) {
  const docs = classItems(actor);
  if (extraClassDoc) docs.push(extraClassDoc);
  const raceData = raceDataOverride ?? systemRace(actor);
  const xpMapSource = { ...(foundry.utils.deepClone(actor.system?.xp_par_classe ?? {})), ...(xpByClass ?? {}) };
  const levelOverrides = levelByClass && typeof levelByClass === "object" ? levelByClass : {};
  const entries = [];
  const seen = new Set();

  for (const doc of docs) {
    const slug = classSlug(doc);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    const sys = foundry.utils.deepClone(doc.system ?? {});
    let xp = Math.max(0, Math.floor(num(xpMapSource[slug], 0)));
    let level = Object.prototype.hasOwnProperty.call(levelOverrides, slug) ? Math.max(1, Math.floor(num(levelOverrides[slug], 1))) : levelForClassXp(sys, xp);
    if (Object.prototype.hasOwnProperty.call(levelOverrides, slug)) xp = minXpForClassLevel(sys, level);
    const maxLevel = classRaceMaxLevel(doc, raceData);
    if (maxLevel > 0 && level > maxLevel) { level = maxLevel; xp = minXpForClassLevel(sys, level); }
    const title = classTitleForLevel(sys, level);
    entries.push({ id: doc.id ?? null, uuid: doc.uuid ?? null, name: doc.name ?? itemLabel(doc, "Classe"), slug, level, xp, title, hitDie: sys.hitDie ?? sys.dv ?? null, spellcasting: sys.spellcasting ?? null, levelMaxRace: maxLevel, system: sys });
  }

  if (entries.length <= 1) return null;
  const xpMap = {}, levelMap = {}, titleMap = {}, nextMap = {}, maxMap = {};
  for (const e of entries) {
    xpMap[e.slug] = e.xp;
    levelMap[e.slug] = e.level;
    titleMap[e.slug] = e.title;
    nextMap[e.slug] = nextXpForClassLevel(e.system, e.level);
    if (e.levelMaxRace) maxMap[e.slug] = e.levelMaxRace;
  }
  const maxLevel = Math.max(...entries.map(e => e.level));
  const totalXp = Object.values(xpMap).reduce((sum, value) => sum + num(value, 0), 0);
  const label = entries.map(e => e.name).join(" / ");
  const nextValues = Object.values(nextMap).filter(v => Number(v) > 0);
  const nextXp = nextValues.length ? Math.min(...nextValues) : 0;
  const spellLists = [...new Set(entries.flatMap(e => e.spellcasting?.enabled && Array.isArray(e.spellcasting.lists) ? e.spellcasting.lists : []).filter(Boolean))];

  return {
    "system.classe": label,
    "system.details_classe": entries[0]?.system ?? {},
    "system.classes": entries,
    "system.multiclasse.enabled": true,
    "system.multiclasse.classes": entries,
    "system.multiclasse.label": label,
    "system.multiclasse.race": itemLabel(raceData, "Race"),
    "system.niveau": maxLevel,
    "system.niveau_par_classe": levelMap,
    "system.xp_par_classe": xpMap,
    "system.titre_par_classe": titleMap,
    "system.xp_prochain_par_classe": nextMap,
    "system.niveau_max_par_classe": maxMap,
    "system.xp": totalXp,
    "system.xp_prochain": nextXp,
    "system.titre": entries.map(e => e.title).filter(Boolean).join(" / "),
    "system.spellcasting": spellLists.length ? { enabled: true, lists: spellLists } : entries[0]?.spellcasting ?? null
  };
}
