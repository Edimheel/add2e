// ADD2E — Effects Engine / profils dérivés canoniques.
// Tables AD&D 2e et résolution des caractéristiques dérivées.
// Compatible Foundry V13/V14/V15.

import {
  ADD2E_ABILITY_DERIVED_VERSION,
  ADD2E_ABILITIES,
  ADD2E_ABILITY_MIN,
  ADD2E_ABILITY_MAX,
  abilityKey,
  canonicalKey,
  clone
} from "./00-core-shared.mjs";

export const FORCE_TABLE = {
  3: { toucher: -3, degats: -1, poids: -350, ouvrir: "1", tordre: "0%" },
  4: { toucher: -2, degats: -1, poids: -250, ouvrir: "1", tordre: "0%" },
  5: { toucher: -2, degats: -1, poids: -250, ouvrir: "1", tordre: "0%" },
  6: { toucher: -1, degats: 0, poids: -150, ouvrir: "1", tordre: "0%" },
  7: { toucher: -1, degats: 0, poids: -150, ouvrir: "1", tordre: "0%" },
  8: { toucher: 0, degats: 0, poids: 0, ouvrir: "1-2", tordre: "1%" },
  9: { toucher: 0, degats: 0, poids: 0, ouvrir: "1-2", tordre: "1%" },
  10: { toucher: 0, degats: 0, poids: 0, ouvrir: "1-2", tordre: "2%" },
  11: { toucher: 0, degats: 0, poids: 0, ouvrir: "1-2", tordre: "2%" },
  12: { toucher: 0, degats: 0, poids: 100, ouvrir: "1-2", tordre: "4%" },
  13: { toucher: 0, degats: 0, poids: 100, ouvrir: "1-2", tordre: "4%" },
  14: { toucher: 0, degats: 0, poids: 200, ouvrir: "1-2", tordre: "7%" },
  15: { toucher: 0, degats: 0, poids: 200, ouvrir: "1-2", tordre: "7%" },
  16: { toucher: 0, degats: 1, poids: 350, ouvrir: "1-3", tordre: "10%" },
  17: { toucher: 1, degats: 1, poids: 500, ouvrir: "1-3", tordre: "13%" },
  18: { toucher: 1, degats: 2, poids: 750, ouvrir: "1-3", tordre: "16%" },
  "18/01-50": { toucher: 1, degats: 3, poids: 1000, ouvrir: "1-3", tordre: "20%" },
  "18/51-75": { toucher: 2, degats: 3, poids: 1250, ouvrir: "1-4", tordre: "25%" },
  "18/76-90": { toucher: 2, degats: 4, poids: 1500, ouvrir: "1-4", tordre: "30%" },
  "18/91-99": { toucher: 2, degats: 5, poids: 2000, ouvrir: "1-4 (1)", tordre: "35%" },
  "18/00": { toucher: 3, degats: 6, poids: 3000, ouvrir: "1-5 (2)", tordre: "40%" },
  19: { toucher: 3, degats: 7, poids: 4500, ouvrir: "50 %", tordre: "50 %" },
  20: { toucher: 3, degats: 8, poids: 5000, ouvrir: "60 %", tordre: "60 %" },
  21: { toucher: 4, degats: 9, poids: 6000, ouvrir: "70 %", tordre: "70 %" },
  22: { toucher: 4, degats: 10, poids: 7500, ouvrir: "80 %", tordre: "80 %" },
  23: { toucher: 5, degats: 11, poids: 9000, ouvrir: "90 %", tordre: "90 %" },
  24: { toucher: 6, degats: 12, poids: 12000, ouvrir: "100 %", tordre: "100 %" },
  25: { toucher: 7, degats: 14, poids: 15000, ouvrir: "100 %", tordre: "100 %" }
};

export const DEXTERITE_TABLE = {
  3: { att: -3, def: 4 }, 4: { att: -2, def: 3 }, 5: { att: -1, def: 2 },
  6: { att: 0, def: 1 }, 7: { att: 0, def: 0 }, 8: { att: 0, def: 0 },
  9: { att: 0, def: 0 }, 10: { att: 0, def: 0 }, 11: { att: 0, def: 0 },
  12: { att: 0, def: 0 }, 13: { att: 0, def: 0 }, 14: { att: 0, def: -1 },
  15: { att: 0, def: -1 }, 16: { att: 1, def: -2 }, 17: { att: 2, def: -3 },
  18: { att: 3, def: -4 }, 19: { att: 3, def: -4 }, 20: { att: 3, def: -4 },
  21: { att: 4, def: -5 }, 22: { att: 4, def: -5 }, 23: { att: 4, def: -5 },
  24: { att: 5, def: -6 }, 25: { att: 5, def: -6 }
};

export const CONSTITUTION_TABLE = {
  3: { pv: -2, pv_guerrier: -2, trauma: 35, resu: 40, poison: 0, regeneration: null },
  4: { pv: -1, pv_guerrier: -1, trauma: 40, resu: 45, poison: 0, regeneration: null },
  5: { pv: -1, pv_guerrier: -1, trauma: 45, resu: 50, poison: 0, regeneration: null },
  6: { pv: -1, pv_guerrier: -1, trauma: 50, resu: 55, poison: 0, regeneration: null },
  7: { pv: 0, pv_guerrier: 0, trauma: 55, resu: 60, poison: 0, regeneration: null },
  8: { pv: 0, pv_guerrier: 0, trauma: 60, resu: 65, poison: 0, regeneration: null },
  9: { pv: 0, pv_guerrier: 0, trauma: 65, resu: 70, poison: 0, regeneration: null },
  10: { pv: 0, pv_guerrier: 0, trauma: 70, resu: 75, poison: 0, regeneration: null },
  11: { pv: 0, pv_guerrier: 0, trauma: 75, resu: 80, poison: 0, regeneration: null },
  12: { pv: 0, pv_guerrier: 0, trauma: 80, resu: 85, poison: 0, regeneration: null },
  13: { pv: 0, pv_guerrier: 0, trauma: 85, resu: 90, poison: 0, regeneration: null },
  14: { pv: 0, pv_guerrier: 0, trauma: 88, resu: 92, poison: 0, regeneration: null },
  15: { pv: 1, pv_guerrier: 1, trauma: 91, resu: 94, poison: 0, regeneration: null },
  16: { pv: 2, pv_guerrier: 2, trauma: 95, resu: 96, poison: 0, regeneration: null },
  17: { pv: 2, pv_guerrier: 3, trauma: 97, resu: 98, poison: 0, regeneration: null },
  18: { pv: 2, pv_guerrier: 4, trauma: 99, resu: 100, poison: 0, regeneration: null },
  19: { pv: 2, pv_guerrier: 5, trauma: 99, resu: 100, poison: 1, regeneration: null },
  20: { pv: 2, pv_guerrier: 5, trauma: 99, resu: 100, poison: 1, regeneration: "1/6 tours" },
  21: { pv: 2, pv_guerrier: 6, trauma: 99, resu: 100, poison: 2, regeneration: "1/5 tours" },
  22: { pv: 2, pv_guerrier: 6, trauma: 99, resu: 100, poison: 2, regeneration: "1/4 tours" },
  23: { pv: 2, pv_guerrier: 6, trauma: 99, resu: 100, poison: 3, regeneration: "1/3 tours" },
  24: { pv: 2, pv_guerrier: 7, trauma: 99, resu: 100, poison: 3, regeneration: "1/2 tours" },
  25: { pv: 2, pv_guerrier: 7, trauma: 100, resu: 100, poison: 4, regeneration: "1/tour" }
};

export const INTELLIGENCE_TABLE = {
  3: { langues: 0, chance_sort: 0, min_sort: 0, max_sort: 0, sort_par_niveau: 0, niveau_sort_max: 0, immunitesIllusions: [] },
  4: { langues: 0, chance_sort: 0, min_sort: 0, max_sort: 0, sort_par_niveau: 0, niveau_sort_max: 0, immunitesIllusions: [] },
  5: { langues: 0, chance_sort: 0, min_sort: 0, max_sort: 0, sort_par_niveau: 0, niveau_sort_max: 0, immunitesIllusions: [] },
  6: { langues: 0, chance_sort: 0, min_sort: 0, max_sort: 0, sort_par_niveau: 0, niveau_sort_max: 0, immunitesIllusions: [] },
  7: { langues: 0, chance_sort: 0, min_sort: 0, max_sort: 0, sort_par_niveau: 0, niveau_sort_max: 0, immunitesIllusions: [] },
  8: { langues: 1, chance_sort: 0, min_sort: 0, max_sort: 0, sort_par_niveau: 0, niveau_sort_max: 0, immunitesIllusions: [] },
  9: { langues: 1, chance_sort: 35, min_sort: 4, max_sort: 6, sort_par_niveau: 6, niveau_sort_max: 4, immunitesIllusions: [] },
  10: { langues: 2, chance_sort: 45, min_sort: 5, max_sort: 7, sort_par_niveau: 7, niveau_sort_max: 5, immunitesIllusions: [] },
  11: { langues: 2, chance_sort: 45, min_sort: 5, max_sort: 7, sort_par_niveau: 7, niveau_sort_max: 5, immunitesIllusions: [] },
  12: { langues: 3, chance_sort: 45, min_sort: 5, max_sort: 7, sort_par_niveau: 7, niveau_sort_max: 6, immunitesIllusions: [] },
  13: { langues: 3, chance_sort: 55, min_sort: 6, max_sort: 9, sort_par_niveau: 9, niveau_sort_max: 6, immunitesIllusions: [] },
  14: { langues: 4, chance_sort: 55, min_sort: 6, max_sort: 9, sort_par_niveau: 9, niveau_sort_max: 7, immunitesIllusions: [] },
  15: { langues: 4, chance_sort: 65, min_sort: 7, max_sort: 11, sort_par_niveau: 11, niveau_sort_max: 7, immunitesIllusions: [] },
  16: { langues: 5, chance_sort: 65, min_sort: 7, max_sort: 11, sort_par_niveau: 11, niveau_sort_max: 8, immunitesIllusions: [] },
  17: { langues: 6, chance_sort: 75, min_sort: 8, max_sort: 14, sort_par_niveau: 14, niveau_sort_max: 8, immunitesIllusions: [] },
  18: { langues: 7, chance_sort: 85, min_sort: 9, max_sort: 18, sort_par_niveau: 18, niveau_sort_max: 9, immunitesIllusions: [] },
  19: { langues: 8, chance_sort: 95, min_sort: 10, max_sort: "Tous", sort_par_niveau: "Tous", niveau_sort_max: 9, immunitesIllusions: [1] },
  20: { langues: 9, chance_sort: 96, min_sort: 10, max_sort: "Tous", sort_par_niveau: "Tous", niveau_sort_max: 9, immunitesIllusions: [1, 2] },
  21: { langues: 10, chance_sort: 97, min_sort: 10, max_sort: "Tous", sort_par_niveau: "Tous", niveau_sort_max: 9, immunitesIllusions: [1, 2, 3] },
  22: { langues: 11, chance_sort: 98, min_sort: 10, max_sort: "Tous", sort_par_niveau: "Tous", niveau_sort_max: 9, immunitesIllusions: [1, 2, 3, 4] },
  23: { langues: 12, chance_sort: 99, min_sort: 10, max_sort: "Tous", sort_par_niveau: "Tous", niveau_sort_max: 9, immunitesIllusions: [1, 2, 3, 4, 5] },
  24: { langues: 15, chance_sort: 100, min_sort: 10, max_sort: "Tous", sort_par_niveau: "Tous", niveau_sort_max: 9, immunitesIllusions: [1, 2, 3, 4, 5, 6] },
  25: { langues: 20, chance_sort: 100, min_sort: 10, max_sort: "Tous", sort_par_niveau: "Tous", niveau_sort_max: 9, immunitesIllusions: [1, 2, 3, 4, 5, 6, 7] }
};

const ADD2E_WISDOM_BONUS_SPELLS = {
  3: {}, 4: {}, 5: {}, 6: {}, 7: {}, 8: {}, 9: {}, 10: {}, 11: {}, 12: {},
  13: { 1: 1 },
  14: { 1: 2 },
  15: { 1: 2, 2: 1 },
  16: { 1: 2, 2: 2 },
  17: { 1: 2, 2: 2, 3: 1 },
  18: { 1: 2, 2: 2, 3: 1, 4: 1 },
  19: { 1: 3, 2: 2, 3: 2, 4: 1 },
  20: { 1: 3, 2: 3, 3: 2, 4: 2 },
  21: { 1: 3, 2: 3, 3: 3, 4: 2, 5: 1 },
  22: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 2 },
  23: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 },
  24: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2 },
  25: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3, 7: 1 }
};

const ADD2E_WISDOM_IMMUNITY_ADDITIONS = {
  19: ["cause_fear", "charm_person", "command", "friends", "hypnotism"],
  20: ["forget", "hold_person", "ray_of_enfeeblement", "scare"],
  21: ["fear"],
  22: ["charm_monster", "confusion", "emotion", "fumble", "suggestion"],
  23: ["chaos", "feeblemind", "hold_monster", "magic_jar", "quest"],
  24: ["geas", "mass_suggestion", "rod_of_rulership"],
  25: ["antipathy_sympathy", "death_spell", "mass_charm"]
};

export const SAGESSE_TABLE = (() => {
  const table = {};
  const immunites = [];
  for (let score = ADD2E_ABILITY_MIN; score <= ADD2E_ABILITY_MAX; score += 1) {
    if (ADD2E_WISDOM_IMMUNITY_ADDITIONS[score]) immunites.push(...ADD2E_WISDOM_IMMUNITY_ADDITIONS[score]);
    const magie = score <= 3 ? -3 : score === 4 ? -2 : score <= 7 ? -1 : score <= 14 ? 0 : score === 15 ? 1 : score === 16 ? 2 : score === 17 ? 3 : 4;
    const echec = ({ 3: 80, 4: 75, 5: 70, 6: 65, 7: 60, 8: 55, 9: 20, 10: 15, 11: 10, 12: 5 })[score] ?? 0;
    table[score] = {
      magie,
      bonusSortsParNiveau: { ...(ADD2E_WISDOM_BONUS_SPELLS[score] ?? {}) },
      echec,
      immunitesSorts: [...immunites]
    };
  }
  return table;
})();

export const CHARISME_TABLE = {
  3: { compagnons: 1, loy: -30, react: -25 }, 4: { compagnons: 1, loy: -25, react: -20 },
  5: { compagnons: 2, loy: -20, react: -15 }, 6: { compagnons: 2, loy: -15, react: -10 },
  7: { compagnons: 3, loy: -10, react: -5 }, 8: { compagnons: 3, loy: -5, react: 0 },
  9: { compagnons: 4, loy: 0, react: 0 }, 10: { compagnons: 4, loy: 0, react: 0 },
  11: { compagnons: 4, loy: 0, react: 0 }, 12: { compagnons: 5, loy: 0, react: 0 },
  13: { compagnons: 6, loy: 5, react: 5 }, 14: { compagnons: 7, loy: 10, react: 10 },
  15: { compagnons: 8, loy: 15, react: 15 }, 16: { compagnons: 9, loy: 20, react: 25 },
  17: { compagnons: 10, loy: 30, react: 30 }, 18: { compagnons: 15, loy: 40, react: 35 },
  19: { compagnons: 20, loy: 50, react: 40 }, 20: { compagnons: 25, loy: 60, react: 45 },
  21: { compagnons: 30, loy: 70, react: 50 }, 22: { compagnons: 35, loy: 80, react: 55 },
  23: { compagnons: 40, loy: 90, react: 60 }, 24: { compagnons: 45, loy: 100, react: 65 },
  25: { compagnons: 50, loy: 100, react: 70 }
};

const ADD2E_DERIVED_DEFAULTS = Object.freeze({
  force: Object.freeze({ toucher: 0, degats: 0, poids: 0, ouvrir: "—", tordre: "—" }),
  dexterite: Object.freeze({ att: 0, def: 0 }),
  constitution: Object.freeze({ pv: 0, pv_guerrier: 0, trauma: 0, resu: 0, poison: 0, regeneration: null }),
  intelligence: Object.freeze({ langues: 0, chance_sort: 0, min_sort: 0, max_sort: 0, sort_par_niveau: 0, niveau_sort_max: 0, immunitesIllusions: [] }),
  sagesse: Object.freeze({ magie: 0, bonusSortsParNiveau: {}, echec: 0, immunitesSorts: [] }),
  charisme: Object.freeze({ compagnons: 0, loy: 0, react: 0 })
});

export const ADD2E_ABILITY_BOUNDS = Object.freeze(Object.fromEntries(
  [...ADD2E_ABILITIES].map(ability => [ability, Object.freeze({ min: ADD2E_ABILITY_MIN, max: ADD2E_ABILITY_MAX })])
));

function add2eDerivedTable(ability) {
  return ({
    force: FORCE_TABLE,
    dexterite: DEXTERITE_TABLE,
    constitution: CONSTITUTION_TABLE,
    intelligence: INTELLIGENCE_TABLE,
    sagesse: SAGESSE_TABLE,
    charisme: CHARISME_TABLE
  })[ability] ?? null;
}

function add2eExceptionalStrengthClassEligible(actor) {
  return Array.from(actor?.items ?? [])
    .filter(item => String(item?.type ?? "").toLowerCase() === "classe")
    .some(item => {
      const values = [item?.name, item?.system?.slug, item?.system?.nom, item?.system?.name, item?.system?.label]
        .map(canonicalKey)
        .filter(Boolean);
      return values.some(value => value.includes("guerrier") || value.includes("paladin") || value.includes("ranger"));
    });
}

function add2eBoundAbilityScore(rawTotal) {
  const finite = Number.isFinite(Number(rawTotal)) ? Number(rawTotal) : ADD2E_ABILITY_MIN;
  const integer = Math.trunc(finite);
  const score = Math.max(ADD2E_ABILITY_MIN, Math.min(ADD2E_ABILITY_MAX, integer));
  const status = integer < ADD2E_ABILITY_MIN
    ? "below-minimum"
    : integer > ADD2E_ABILITY_MAX
      ? "above-maximum"
      : "within-range";
  return {
    rawTotal: finite,
    score,
    min: ADD2E_ABILITY_MIN,
    max: ADD2E_ABILITY_MAX,
    status,
    clamped: score !== integer
  };
}

function add2eDerivedProfileDirective(resolution) {
  const modifier = resolution?.override?.modifier ?? null;
  const metadata = modifier?.metadata && typeof modifier.metadata === "object" ? modifier.metadata : {};
  const rawProfile = metadata.profile && typeof metadata.profile === "object" && !Array.isArray(metadata.profile)
    ? clone(metadata.profile)
    : {};
  const embeddedMode = rawProfile.mode ?? rawProfile.profileMode ?? rawProfile.profile_mode;
  const modeValue = String(metadata.profileMode ?? metadata.profile_mode ?? metadata.derivedProfileMode ?? embeddedMode ?? "").trim().toLowerCase();
  const mode = ["table", "merge", "replace"].includes(modeValue)
    ? modeValue
    : Object.keys(rawProfile).length ? "merge" : "table";
  const tableKey = metadata.profileTableKey
    ?? metadata.profile_table_key
    ?? metadata.tableKey
    ?? rawProfile.tableKey
    ?? rawProfile.table_key
    ?? rawProfile.score
    ?? null;
  const exceptionalStrength = metadata.exceptionalStrength
    ?? metadata.exceptional_strength
    ?? rawProfile.exceptionalStrength
    ?? rawProfile.exceptional_strength
    ?? null;
  for (const key of ["mode", "profileMode", "profile_mode", "tableKey", "table_key", "score", "exceptionalStrength", "exceptional_strength"]) delete rawProfile[key];
  return {
    mode,
    tableKey,
    profile: rawProfile,
    exceptionalStrength,
    locked: metadata.profileLocked === true || metadata.locked === true,
    displayValue: metadata.displayValue ?? metadata.display_value ?? null,
    source: modifier?.source ?? null
  };
}

function add2eExceptionalStrengthPercentile(actor, directive, eligible, score) {
  if (!eligible || score !== 18 || directive.exceptionalStrength === false) return 0;
  const explicit = directive.exceptionalStrength && typeof directive.exceptionalStrength === "object"
    ? directive.exceptionalStrength.percentile ?? directive.exceptionalStrength.value
    : directive.exceptionalStrength;
  const raw = explicit ?? actor?.system?.force_ex ?? 0;
  return Math.max(0, Math.min(100, Math.trunc(Number(raw) || 0)));
}

function add2eExceptionalStrengthBand(percentile) {
  if (percentile >= 1 && percentile <= 50) return "18/01-50";
  if (percentile >= 51 && percentile <= 75) return "18/51-75";
  if (percentile >= 76 && percentile <= 90) return "18/76-90";
  if (percentile >= 91 && percentile <= 99) return "18/91-99";
  if (percentile === 100) return "18/00";
  return null;
}

function add2eResolveProfileTableKey(ability, table, score, directive, exceptionalStrength) {
  const explicit = directive.tableKey;
  if (ability === "force") {
    const explicitText = String(explicit ?? directive.displayValue ?? "").trim();
    if (Object.prototype.hasOwnProperty.call(table, explicitText) && explicitText.startsWith("18/")) {
      return exceptionalStrength.eligible ? explicitText : score;
    }
    if (exceptionalStrength.active) return exceptionalStrength.band;
  }
  if (explicit !== null && explicit !== undefined && explicit !== "") {
    const bounded = add2eBoundAbilityScore(explicit);
    if (Object.prototype.hasOwnProperty.call(table, bounded.score)) return bounded.score;
  }
  return score;
}

function add2eMergeDerivedProfile(base, override) {
  return foundry.utils.mergeObject(
    clone(base ?? {}),
    clone(override ?? {}),
    { inplace: false, insertKeys: true, overwrite: true }
  );
}

function add2eResolveAbilityDerived(Engine, actor, ability, context = {}) {
  if (!actor) throw new Error("Aucun acteur pour résoudre les ajustements de caractéristique.");
  if (typeof Engine?.resolveAbility !== "function") {
    throw new Error("Le résolveur canonique ADD2E des caractéristiques n’est pas disponible.");
  }

  const key = abilityKey(ability);
  const table = add2eDerivedTable(key);
  if (!table) throw new Error(`Caractéristique dérivée inconnue : ${String(ability ?? "") || "vide"}`);

  const resolution = Engine.resolveAbility(actor, key, {
    ...context,
    source: context.source ?? "ability-derived"
  });
  const bounds = add2eBoundAbilityScore(resolution?.total);
  const directive = add2eDerivedProfileDirective(resolution);
  const exceptionalEligible = key === "force" && bounds.score === 18 && add2eExceptionalStrengthClassEligible(actor);
  const percentile = add2eExceptionalStrengthPercentile(actor, directive, exceptionalEligible, bounds.score);
  const band = add2eExceptionalStrengthBand(percentile);
  const exceptionalStrength = {
    eligible: exceptionalEligible,
    active: exceptionalEligible && Boolean(band),
    percentile,
    band
  };
  const tableKey = add2eResolveProfileTableKey(key, table, bounds.score, directive, exceptionalStrength);
  const tableProfile = table?.[tableKey];
  if (!tableProfile) throw new Error(`Profil dérivé absent pour ${key} ${String(tableKey)}.`);

  const baseProfile = directive.mode === "replace"
    ? ADD2E_DERIVED_DEFAULTS[key]
    : add2eMergeDerivedProfile(ADD2E_DERIVED_DEFAULTS[key], tableProfile);
  const profile = directive.mode === "table"
    ? clone(baseProfile)
    : add2eMergeDerivedProfile(baseProfile, directive.profile);
  const displayValue = directive.displayValue
    ?? (key === "force" && exceptionalStrength.active ? tableKey : bounds.rawTotal);
  const source = directive.source ?? {};

  return {
    version: ADD2E_ABILITY_DERIVED_VERSION,
    actor,
    ability: key,
    rawTotal: bounds.rawTotal,
    total: bounds.rawTotal,
    score: bounds.score,
    bounds: {
      min: bounds.min,
      max: bounds.max,
      status: bounds.status,
      clamped: bounds.clamped
    },
    tableKey,
    displayValue,
    profile,
    profileSource: {
      mode: directive.mode,
      kind: String(source?.kind ?? (resolution?.override ? "override" : "base")),
      documentId: String(source?.id ?? "") || null,
      documentUuid: String(source?.uuid ?? "") || null,
      name: String(source?.name ?? "") || null,
      locked: directive.locked
    },
    exceptionalStrength,
    exceptionalStrengthEligible: exceptionalStrength.eligible,
    resolution
  };
}

export function installAbilityDerivedResolver(Engine) {
  if (!Engine?.resolveAbility) return false;
  if (Engine.__add2eAbilityDerivedVersion === ADD2E_ABILITY_DERIVED_VERSION) return true;
  Object.defineProperty(Engine, "resolveAbilityDerived", {
    configurable: true,
    writable: true,
    value(actor, ability, context = {}) {
      return add2eResolveAbilityDerived(Engine, actor, ability, context);
    }
  });
  Engine.__add2eAbilityDerivedVersion = ADD2E_ABILITY_DERIVED_VERSION;
  globalThis.ADD2E_ABILITY_DERIVED_VERSION = ADD2E_ABILITY_DERIVED_VERSION;
  globalThis.ADD2E_ABILITY_PROFILE_TABLES = Object.freeze({
    force: FORCE_TABLE,
    dexterite: DEXTERITE_TABLE,
    constitution: CONSTITUTION_TABLE,
    intelligence: INTELLIGENCE_TABLE,
    sagesse: SAGESSE_TABLE,
    charisme: CHARISME_TABLE
  });
  globalThis.ADD2E_ABILITY_BOUNDS = ADD2E_ABILITY_BOUNDS;
  globalThis.add2eActorCanUseExceptionalStrength = add2eExceptionalStrengthClassEligible;
  return true;
}
