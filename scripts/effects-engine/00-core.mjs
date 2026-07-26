// ADD2E — Effects Engine / noyau partagé.
// Résolveur canonique des modificateurs, caractéristiques dérivées et primitives métier existantes.
// Compatible Foundry V13/V14/V15.

import { add2eTimeEffectData } from "../add2e/19a-time-engine.mjs";

const ADD2E_MODIFIER_RESOLVER_VERSION = "2026-07-26-bonus-bigbang-derived-abilities-v2";
const ADD2E_ABILITY_DERIVED_VERSION = "2026-07-26-canonical-derived-abilities-engine-v3";
const ADD2E_MODIFIER_DOMAINS = new Set([
  "ability", "attack", "damage", "armor-class", "save", "movement",
  "initiative", "hit-points", "spell-slot", "skill", "reaction",
  "morale", "encumbrance", "level", "resource", "resistance"
]);
const ADD2E_MODIFIER_OPERATIONS = new Set(["add", "set", "multiply", "minmax"]);
const ADD2E_MODIFIER_STACKING = new Set(["stack", "highest", "lowest", "replace", "unique-source", "exclusive"]);
const ADD2E_ABILITIES = new Set(["force", "dexterite", "constitution", "intelligence", "sagesse", "charisme"]);
const ADD2E_ABILITY_MIN = 3;
const ADD2E_ABILITY_MAX = 25;

const register = (Engine, methods) => Object.defineProperties(
  Engine,
  Object.fromEntries(Object.entries(methods).map(([name, value]) => [
    name,
    { value, configurable: true, writable: true }
  ]))
);

const clone = value => {
  try { return foundry.utils.deepClone(value); }
  catch (_error) { return JSON.parse(JSON.stringify(value ?? null)); }
};

const escapeHtml = value => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#039;");

const isObject = value => !!value && typeof value === "object" && !Array.isArray(value);

const canonicalKey = value => String(value ?? "")
  .trim()
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[’']/g, "")
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/-+/g, "-")
  .replace(/^-+|-+$/g, "");

const abilityKey = value => {
  const key = canonicalKey(value);
  const aliases = {
    strength: "force",
    str: "force",
    dexterity: "dexterite",
    dex: "dexterite",
    con: "constitution",
    int: "intelligence",
    wisdom: "sagesse",
    wis: "sagesse",
    charisma: "charisme",
    cha: "charisme"
  };
  return aliases[key] ?? key;
};

const sourceStableKey = source => String(source?.uuid ?? source?.id ?? source?.name ?? "").trim();

const modifierSignature = modifier => JSON.stringify([
  modifier?.domain,
  modifier?.target,
  modifier?.operation,
  modifier?.value,
  modifier?.priority,
  modifier?.stacking?.mode,
  modifier?.stacking?.group,
  sourceStableKey(modifier?.source)
]);

const rawList = value => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (isObject(value)) return Object.values(value);
  return [];
};

const effectArray = actor => Array.from(actor?.effects?.contents ?? actor?.effects ?? []);
const itemArray = actor => Array.from(actor?.items?.contents ?? actor?.items ?? []);

// =========================================================
// Profils dérivés canoniques AD&D 2e — scores 3 à 25
// =========================================================
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

function installAbilityDerivedResolver(Engine) {
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

function potionContextActor(context = {}) {
  return context.actor ?? context.args?.[0]?.actor ?? null;
}

function potionContextItem(context = {}) {
  return context.sourceItem ?? context.item ?? context.args?.[0]?.sourceItem ?? context.args?.[0]?.item ?? null;
}

async function potionRoll(formula, actor, flavor) {
  const roll = await new Roll(String(formula || "0")).evaluate();
  await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor });
  return Number(roll.total) || 0;
}

function potionTargets(actor, selfOnly = false) {
  if (selfOnly) return actor ? [actor] : [];
  const targets = Array.from(game.user?.targets ?? []).map(token => token.actor).filter(Boolean);
  return targets.length ? targets : (actor ? [actor] : []);
}

function potionHpDescriptor(actor) {
  const system = actor?.system ?? {};
  return [
    { path: "system.pdv", value: system.pdv, max: system.points_de_coup },
    { path: "system.pv.value", value: system.pv?.value, max: system.pv?.max },
    { path: "system.hp.value", value: system.hp?.value, max: system.hp?.max },
    { path: "system.points_de_vie.value", value: system.points_de_vie?.value, max: system.points_de_vie?.max }
  ].find(row => Number.isFinite(Number(row.value))) ?? null;
}

async function potionDuration(actor, config = {}) {
  if (config.durationFormula) {
    const total = await potionRoll(config.durationFormula, actor, `${config.name} — durée`);
    return Math.max(0, total * (Number(config.durationMultiplier) || 1));
  }
  return Math.max(0, Number(config.durationRounds) || 0);
}

function characteristicRuleModifier(Engine, rule, defaults = {}, index = 0) {
  const kind = canonicalKey(rule?.kind ?? rule?.type);
  if (!["characteristic-bonus", "characteristic-override"].includes(kind)) return null;
  const target = abilityKey(rule?.characteristic ?? rule?.ability ?? rule?.target);
  if (!ADD2E_ABILITIES.has(target)) return null;
  const operation = kind === "characteristic-override" ? "set" : "add";
  const source = {
    ...(isObject(defaults.source) ? defaults.source : {}),
    ...(isObject(rule?.source) ? rule.source : {})
  };
  return Engine.createModifier({
    id: String(rule?.id ?? `${sourceStableKey(source) || "effect"}:${target}:${operation}:${index}`),
    domain: "ability",
    target,
    operation,
    value: Number(rule?.value ?? rule?.amount ?? rule?.bonus),
    priority: Number(rule?.priority ?? defaults.priority ?? 100),
    stacking: rule?.stacking ?? (operation === "set"
      ? { mode: "replace", group: `ability:${target}:override` }
      : { mode: "stack", group: null }),
    conditions: clone(rule?.conditions ?? {}),
    source,
    metadata: {
      label: String(rule?.label ?? defaults.label ?? source?.name ?? "Modificateur de caractéristique"),
      displayValue: rule?.displayValue ?? rule?.display_value ?? null,
      profile: clone(rule?.profile ?? {})
    }
  });
}

function characteristicChangeDescriptor(change) {
  const rawKey = String(change?.key ?? "");
  const direct = rawKey.match(/^system\.(force|dexterite|constitution|intelligence|sagesse|charisme)(?:_base)?$/);
  if (direct) return { target: direct[1], derived: false };

  const displays = {
    "system.for_aff": "force",
    "system.dex_aff": "dexterite",
    "system.con_aff": "constitution",
    "system.int_aff": "intelligence",
    "system.sag_aff": "sagesse",
    "system.cha_aff": "charisme"
  };
  if (displays[rawKey]) return { target: displays[rawKey], derived: true };

  if (/^system\.(?:force_bonus_toucher|force_bonus_degats|force_poids|force_ouvrir|force_tordre|force_bonus_porte|charge_max|charge_max_bench)$/.test(rawKey)) {
    return { target: "force", derived: true };
  }
  return null;
}

function characteristicChangeModifier(Engine, change, defaults = {}, index = 0) {
  const descriptor = characteristicChangeDescriptor(change);
  if (!descriptor || descriptor.derived) return null;
  const mode = Number(change?.mode);
  const target = descriptor.target;
  let operation = null;
  let value = Number(change?.value);
  if (!Number.isFinite(value)) return null;
  if (mode === (CONST.ACTIVE_EFFECT_MODES?.ADD ?? 2)) operation = "add";
  else if (mode === (CONST.ACTIVE_EFFECT_MODES?.MULTIPLY ?? 1)) operation = "multiply";
  else if (mode === (CONST.ACTIVE_EFFECT_MODES?.OVERRIDE ?? 5)) operation = "set";
  else if (mode === (CONST.ACTIVE_EFFECT_MODES?.DOWNGRADE ?? 3)) {
    operation = "minmax";
    value = { max: value };
  } else if (mode === (CONST.ACTIVE_EFFECT_MODES?.UPGRADE ?? 4)) {
    operation = "minmax";
    value = { min: value };
  } else return null;

  const source = isObject(defaults.source) ? defaults.source : {};
  return Engine.createModifier({
    id: `${sourceStableKey(source) || "effect"}:${target}:${operation}:change:${index}`,
    domain: "ability",
    target,
    operation,
    value,
    priority: Number(change?.priority ?? defaults.priority ?? 100),
    stacking: operation === "set"
      ? { mode: "replace", group: `ability:${target}:override` }
      : { mode: "stack", group: null },
    source,
    metadata: { label: String(defaults.label ?? source?.name ?? "Effet de caractéristique") }
  });
}

function numericCharacteristicTag(value) {
  const key = canonicalKey(value);
  return /^(?:bonus|malus|penalite)-(?:caracteristique|force|dexterite|constitution|intelligence|sagesse|charisme)(?:-|$)/.test(key)
    || /^(?:force|dexterite|constitution|intelligence|sagesse|charisme)-[+-]?\d/.test(key);
}

function canonicalizeCharacteristicEffectData(Engine, rawData, effect = null) {
  const data = isObject(rawData) ? clone(rawData) : {};
  const currentFlags = effect?.flags?.add2e ?? {};
  const incomingFlags = data?.flags?.add2e ?? {};
  const flags = { ...clone(currentFlags), ...clone(incomingFlags) };
  const rules = rawList(flags.rules);
  const changes = Array.isArray(data.changes)
    ? data.changes
    : Array.from(effect?.changes ?? []);
  const hasCharacteristicRule = rules.some(rule => ["characteristic-bonus", "characteristic-override"].includes(canonicalKey(rule?.kind ?? rule?.type)));
  const hasCharacteristicChange = changes.some(change => characteristicChangeDescriptor(change));
  const marked = flags.characteristicEffect === true;
  if (!hasCharacteristicRule && !hasCharacteristicChange && !marked) return null;

  const source = {
    kind: canonicalKey(flags.sourceType ?? flags.sourceKind ?? "effect") || "effect",
    id: String(flags.sourceItemId ?? effect?.id ?? data?._id ?? "").trim(),
    uuid: String(flags.sourceItemUuid ?? effect?.uuid ?? "").trim(),
    name: String(flags.classFeatureName ?? flags.sourceName ?? effect?.name ?? data?.name ?? "Effet").trim()
  };
  if (!source.id && !source.uuid) source.id = String(flags.passiveKey ?? flags.classFeatureId ?? data?.name ?? "effect");

  const existing = rawList(flags.modifiers)
    .map(raw => Engine.normalizeModifier(raw, { source }))
    .filter(Boolean);
  const converted = [];

  rules.forEach((rule, index) => {
    const modifier = characteristicRuleModifier(Engine, rule, { source, label: source.name }, index);
    if (modifier) converted.push(modifier);
  });
  changes.forEach((change, index) => {
    const modifier = characteristicChangeModifier(Engine, change, { source, label: source.name }, index);
    if (modifier) converted.push(modifier);
  });

  if (marked && !converted.length && flags.characteristic) {
    const target = abilityKey(flags.characteristic);
    if (ADD2E_ABILITIES.has(target) && Number.isFinite(Number(flags.characteristicValue))) {
      converted.push(Engine.createModifier({
        id: `${sourceStableKey(source)}:${target}:set`,
        domain: "ability",
        target,
        operation: "set",
        value: Number(flags.characteristicValue),
        priority: Number(flags.priority ?? 100),
        stacking: { mode: "replace", group: `ability:${target}:override` },
        source,
        metadata: {
          label: source.name,
          displayValue: flags.characteristicDisplayValue ?? flags.characteristicValue,
          profile: clone(flags.characteristicProfile ?? {})
        }
      }));
    }
  }

  const deduped = new Map();
  for (const modifier of [...existing, ...converted]) {
    if (!modifier) continue;
    deduped.set(modifierSignature(modifier), modifier);
  }

  const remainingRules = rules.filter(rule => !["characteristic-bonus", "characteristic-override"].includes(canonicalKey(rule?.kind ?? rule?.type)));
  const remainingChanges = changes.filter(change => !characteristicChangeDescriptor(change));
  const filterTags = value => {
    const list = Array.isArray(value) ? value : (typeof value === "string" ? value.split(/[,;\n|]+/) : []);
    return list.filter(tag => !numericCharacteristicTag(tag));
  };

  flags.modifiers = [...deduped.values()];
  flags.rules = remainingRules;
  if (flags.tags !== undefined) flags.tags = filterTags(flags.tags);
  if (flags.effectTags !== undefined) flags.effectTags = filterTags(flags.effectTags);

  return { flags: { ...(data.flags ?? {}), add2e: flags }, changes: remainingChanges };
}

function installCharacteristicEffectCanonicalization(Engine) {
  if (globalThis.__ADD2E_CHARACTERISTIC_EFFECT_CANONICALIZATION__ === ADD2E_MODIFIER_RESOLVER_VERSION) return;
  globalThis.__ADD2E_CHARACTERISTIC_EFFECT_CANONICALIZATION__ = ADD2E_MODIFIER_RESOLVER_VERSION;

  Hooks.on("preCreateActiveEffect", (effect, data = {}) => {
    const source = typeof effect?.toObject === "function" ? effect.toObject() : data;
    const canonical = canonicalizeCharacteristicEffectData(Engine, source, effect);
    if (canonical) effect?.updateSource?.(canonical);
  });

  Hooks.on("preUpdateActiveEffect", (effect, changes = {}) => {
    const base = typeof effect?.toObject === "function" ? effect.toObject() : {};
    const merged = foundry.utils.mergeObject(base, clone(changes), { inplace: false, insertKeys: true, overwrite: true });
    const canonical = canonicalizeCharacteristicEffectData(Engine, merged, effect);
    if (!canonical) return;
    changes.changes = canonical.changes;
    changes.flags = canonical.flags;
  });

  Hooks.once("ready", () => {
    if (!game.user?.isGM || game.users?.activeGM?.id !== game.user.id) return;
    for (const actor of game.actors?.contents ?? []) {
      const updates = [];
      for (const effect of effectArray(actor)) {
        const canonical = canonicalizeCharacteristicEffectData(Engine, effect.toObject(), effect);
        if (!canonical) continue;
        const before = JSON.stringify({
          modifiers: effect.flags?.add2e?.modifiers ?? [],
          rules: effect.flags?.add2e?.rules ?? [],
          tags: effect.flags?.add2e?.tags ?? [],
          effectTags: effect.flags?.add2e?.effectTags ?? [],
          changes: Array.from(effect.changes ?? [])
        });
        const after = JSON.stringify({
          modifiers: canonical.flags?.add2e?.modifiers ?? [],
          rules: canonical.flags?.add2e?.rules ?? [],
          tags: canonical.flags?.add2e?.tags ?? [],
          effectTags: canonical.flags?.add2e?.effectTags ?? [],
          changes: canonical.changes
        });
        if (before !== after) updates.push({ _id: effect.id, ...canonical });
      }
      if (updates.length) {
        actor.updateEmbeddedDocuments("ActiveEffect", updates, {
          add2eInternal: true,
          add2eReason: "bonus-bigbang-characteristic-effect-migration"
        }).catch(error => console.error("[ADD2E][MODIFIERS][MIGRATION]", { actor: actor.name, error }));
      }
    }
  });
}

export function installEffectsEngineCore(Engine) {
  register(Engine, {
    normalizeTag(v) {
      return String(v ?? "").trim().toLowerCase().normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[’']/g, "")
        .replace(/\s+/g, "_");
    },

    normalizeKey(v) {
      return canonicalKey(v);
    },

    toArray(v) {
      if (!v) return [];
      if (Array.isArray(v)) return v;
      if (v instanceof Set) return [...v];
      if (typeof v === "string") return v.split(/[,;\n|]+/).map(s => s.trim()).filter(Boolean);
      if (typeof v === "object") {
        for (const k of ["value", "tags", "list", "items", "effectTags"]) {
          if (v[k] !== undefined && v[k] !== null) return this.toArray(v[k]);
        }
      }
      return [];
    },

    readNumber(...vals) {
      for (const v of vals) {
        if (v === undefined || v === null || v === "") continue;
        if (typeof v === "object") {
          const n = this.readNumber(v.value, v.current, v.actuel, v.total, v.max);
          if (Number.isFinite(n)) return n;
          continue;
        }
        const n = Number(String(v).replace(",", "."));
        if (Number.isFinite(n)) return n;
      }
      return null;
    },

    normalizeModifier(raw = {}, defaults = {}) {
      if (!isObject(raw)) return null;
      const domain = canonicalKey(raw.domain ?? defaults.domain);
      const target = abilityKey(raw.target ?? defaults.target);
      const operation = canonicalKey(raw.operation ?? defaults.operation ?? "add");
      const priorityValue = Number(raw.priority ?? defaults.priority ?? 100);
      const priority = Number.isFinite(priorityValue) ? priorityValue : 100;
      const rawStacking = isObject(raw.stacking) ? raw.stacking : { mode: raw.stacking };
      const stackingMode = canonicalKey(rawStacking?.mode ?? defaults?.stacking?.mode ?? "stack") || "stack";
      const stacking = {
        mode: stackingMode,
        group: String(rawStacking?.group ?? defaults?.stacking?.group ?? "").trim() || null
      };
      const sourceRaw = {
        ...(isObject(defaults.source) ? defaults.source : {}),
        ...(isObject(raw.source) ? raw.source : {})
      };
      const source = {
        kind: canonicalKey(sourceRaw.kind ?? "effect") || "effect",
        id: String(sourceRaw.id ?? "").trim(),
        uuid: String(sourceRaw.uuid ?? "").trim(),
        name: String(sourceRaw.name ?? "").trim()
      };
      let value = raw.value;
      if (operation === "minmax") {
        const bounds = isObject(value) ? value : {};
        const minimum = bounds.min === undefined || bounds.min === null || bounds.min === "" ? null : Number(bounds.min);
        const maximum = bounds.max === undefined || bounds.max === null || bounds.max === "" ? null : Number(bounds.max);
        value = {
          min: Number.isFinite(minimum) ? minimum : null,
          max: Number.isFinite(maximum) ? maximum : null
        };
      } else {
        value = Number(value);
      }
      const id = String(raw.id ?? `${sourceStableKey(source) || "modifier"}:${domain}:${target}:${operation}:${priority}`).trim();
      return {
        id,
        domain,
        target,
        operation,
        value,
        priority,
        stacking,
        conditions: clone(raw.conditions ?? {}),
        source,
        duration: clone(raw.duration ?? null),
        metadata: clone(raw.metadata ?? {})
      };
    },

    validateModifier(raw = {}, defaults = {}) {
      const modifier = this.normalizeModifier(raw, defaults);
      const errors = [];
      if (!modifier) errors.push("modifier-invalid");
      else {
        if (!ADD2E_MODIFIER_DOMAINS.has(modifier.domain)) errors.push(`domain:${modifier.domain || "missing"}`);
        if (!modifier.target) errors.push("target:missing");
        if (!ADD2E_MODIFIER_OPERATIONS.has(modifier.operation)) errors.push(`operation:${modifier.operation || "missing"}`);
        if (!ADD2E_MODIFIER_STACKING.has(modifier.stacking?.mode)) errors.push(`stacking:${modifier.stacking?.mode || "missing"}`);
        if (!sourceStableKey(modifier.source)) errors.push("source:missing");
        if (modifier.operation === "minmax") {
          if (modifier.value?.min === null && modifier.value?.max === null) errors.push("value:bounds-missing");
        } else if (!Number.isFinite(Number(modifier.value))) errors.push("value:not-number");
      }
      return { valid: errors.length === 0, errors, modifier };
    },

    createModifier(raw = {}, defaults = {}) {
      const result = this.validateModifier(raw, defaults);
      if (!result.valid) throw new Error(`Modificateur ADD2E invalide : ${result.errors.join(", ")}`);
      return result.modifier;
    },

    collectDocumentModifiers(document, defaults = {}) {
      if (!document) return [];
      let raw = document.flags?.add2e?.modifiers;
      if ((raw === undefined || raw === null) && document.getFlag) {
        try { raw = document.getFlag("add2e", "modifiers"); } catch (_error) {}
      }
      return rawList(raw).map(entry => {
        const normalized = this.normalizeModifier(entry, defaults);
        const validation = this.validateModifier(normalized);
        return validation.valid ? validation.modifier : null;
      }).filter(Boolean);
    },

    collect(actor, context = {}) {
      if (!actor) return [];
      const collected = [];
      const pushDocument = (document, defaults, sourceContext = {}) => {
        for (const modifier of this.collectDocumentModifiers(document, defaults)) {
          collected.push({
            ...modifier,
            _context: {
              sourceDocument: document,
              sourceItem: sourceContext.sourceItem ?? null,
              sourceEffect: sourceContext.sourceEffect ?? null
            }
          });
        }
      };

      pushDocument(actor, {
        source: { kind: "actor", id: actor.id, uuid: actor.uuid, name: actor.name }
      });

      for (const effect of effectArray(actor)) {
        if (!effect || effect.disabled === true || effect.isSuppressed === true) continue;
        const flags = effect.flags?.add2e ?? {};
        pushDocument(effect, {
          source: {
            kind: canonicalKey(flags.sourceType ?? flags.sourceKind ?? "effect") || "effect",
            id: String(flags.sourceItemId ?? effect.id ?? ""),
            uuid: String(flags.sourceItemUuid ?? effect.uuid ?? ""),
            name: String(flags.classFeatureName ?? effect.name ?? "")
          }
        }, { sourceEffect: effect });
      }

      for (const item of itemArray(actor)) {
        if (!item) continue;
        pushDocument(item, {
          source: {
            kind: canonicalKey(item.flags?.add2e?.sourceType ?? item.type ?? "item") || "item",
            id: item.id,
            uuid: item.uuid,
            name: item.name
          }
        }, { sourceItem: item });

        for (const effect of Array.from(item.effects?.contents ?? item.effects ?? [])) {
          if (!effect || effect.disabled === true || effect.isSuppressed === true) continue;
          pushDocument(effect, {
            source: {
              kind: canonicalKey(effect.flags?.add2e?.sourceType ?? item.type ?? "item-effect") || "item-effect",
              id: String(item.id ?? effect.id ?? ""),
              uuid: String(item.uuid ?? effect.uuid ?? ""),
              name: String(effect.name ?? item.name ?? "")
            }
          }, { sourceItem: item, sourceEffect: effect });
        }
      }

      const seen = new Set();
      return collected.filter(modifier => {
        const key = `${modifier.id}|${sourceStableKey(modifier.source)}|${modifierSignature(modifier)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    },

    evaluateModifierConditions(modifier, context = {}) {
      const conditions = isObject(modifier?.conditions) ? modifier.conditions : {};
      const sourceContext = modifier?._context ?? {};
      const sourceItem = sourceContext.sourceItem ?? context.sourceItem ?? context.item ?? null;
      const sourceEffect = sourceContext.sourceEffect ?? null;
      const targetActor = context.targetActor ?? context.target?.actor ?? context.target ?? null;
      const includes = (actual, expected) => {
        const wanted = Array.isArray(expected) ? expected : [expected];
        const actualKey = canonicalKey(actual);
        return wanted.map(canonicalKey).includes(actualKey);
      };

      if (conditions.active !== undefined) {
        const active = sourceEffect ? sourceEffect.disabled !== true && sourceEffect.isSuppressed !== true : true;
        if (active !== Boolean(conditions.active)) return { applicable: false, reason: "condition-active" };
      }
      if (conditions.equipped !== undefined) {
        const equipped = sourceItem ? this.itemEquipped(sourceItem) : false;
        if (equipped !== Boolean(conditions.equipped)) return { applicable: false, reason: "condition-equipped" };
      }
      if (conditions.sourceType && !includes(modifier?.source?.kind, conditions.sourceType)) return { applicable: false, reason: "condition-source-type" };
      if (conditions.actorType && !includes(context.actor?.type, conditions.actorType)) return { applicable: false, reason: "condition-actor-type" };
      if (conditions.itemId && String(sourceItem?.id ?? context.item?.id ?? "") !== String(conditions.itemId)) return { applicable: false, reason: "condition-item-id" };
      if (conditions.itemIds && !rawList(conditions.itemIds).map(String).includes(String(sourceItem?.id ?? context.item?.id ?? ""))) return { applicable: false, reason: "condition-item-ids" };

      const weaponType = context.weaponType ?? context.item?.system?.famille_arme ?? context.item?.system?.type_arme ?? context.item?.system?.type;
      if (conditions.weaponType && !includes(weaponType, conditions.weaponType)) return { applicable: false, reason: "condition-weapon-type" };
      if (conditions.weaponTypes && !includes(weaponType, conditions.weaponTypes)) return { applicable: false, reason: "condition-weapon-types" };
      if (conditions.targetType && !includes(targetActor?.type ?? context.targetType, conditions.targetType)) return { applicable: false, reason: "condition-target-type" };
      const targetRace = context.targetRace ?? targetActor?.system?.race ?? targetActor?.system?.details_race?.slug ?? targetActor?.system?.details_race?.name;
      if (conditions.targetRace && !includes(targetRace, conditions.targetRace)) return { applicable: false, reason: "condition-target-race" };
      if (conditions.targetRaces && !includes(targetRace, conditions.targetRaces)) return { applicable: false, reason: "condition-target-races" };
      if (conditions.position && !includes(context.position, conditions.position)) return { applicable: false, reason: "condition-position" };

      if (conditions.range !== undefined && conditions.range !== null) {
        if (isObject(conditions.range)) {
          const distance = Number(context.distance ?? context.range);
          if (!Number.isFinite(distance)) return { applicable: false, reason: "condition-range-missing" };
          const minimum = Number(conditions.range.min);
          const maximum = Number(conditions.range.max);
          if (Number.isFinite(minimum) && distance < minimum) return { applicable: false, reason: "condition-range-min" };
          if (Number.isFinite(maximum) && distance > maximum) return { applicable: false, reason: "condition-range-max" };
        } else if (!includes(context.rangeBand ?? context.range, conditions.range)) {
          return { applicable: false, reason: "condition-range" };
        }
      }
      return { applicable: true, reason: "applicable" };
    },

    applyStacking(modifiers = []) {
      const accepted = [];
      const rejected = [];
      const grouped = new Map();

      for (const modifier of modifiers) {
        const mode = modifier.stacking?.mode ?? "stack";
        if (mode === "stack") {
          accepted.push(modifier);
          continue;
        }
        const group = modifier.stacking?.group || `${modifier.domain}:${modifier.target}`;
        const sourcePart = mode === "unique-source" ? `:${sourceStableKey(modifier.source)}` : "";
        const key = `${mode}:${group}${sourcePart}`;
        const list = grouped.get(key) ?? [];
        list.push(modifier);
        grouped.set(key, list);
      }

      const stableSort = (left, right) => {
        const priority = Number(right.priority) - Number(left.priority);
        if (priority) return priority;
        return sourceStableKey(left.source).localeCompare(sourceStableKey(right.source));
      };

      for (const [key, list] of grouped.entries()) {
        const mode = key.split(":")[0];
        let winner = null;
        if (mode === "highest") {
          winner = [...list].sort((left, right) => Number(right.value) - Number(left.value) || stableSort(left, right))[0];
        } else if (mode === "lowest") {
          winner = [...list].sort((left, right) => Number(left.value) - Number(right.value) || stableSort(left, right))[0];
        } else {
          winner = [...list].sort(stableSort)[0];
        }
        accepted.push(winner);
        for (const modifier of list) {
          if (modifier !== winner) rejected.push({ modifier, reason: `stacking-${mode}` });
        }
      }
      return { accepted, rejected };
    },

    resolve(actor, query = {}) {
      const domain = canonicalKey(query.domain);
      const target = abilityKey(query.target);
      if (!ADD2E_MODIFIER_DOMAINS.has(domain)) throw new Error(`Domaine de modificateur inconnu : ${domain || "vide"}`);
      if (!target) throw new Error("Cible de modificateur manquante.");

      const baseValue = Number(query.base ?? 0);
      const base = Number.isFinite(baseValue) ? baseValue : 0;
      const context = { ...(query.context ?? {}), actor, item: query.item ?? query.context?.item, targetActor: query.targetActor ?? query.context?.targetActor };
      const all = Array.isArray(query.modifiers) ? query.modifiers : this.collect(actor, context);
      const applicable = [];
      const rejected = [];

      for (const raw of all) {
        const modifier = this.normalizeModifier(raw, { source: raw?.source });
        const validation = this.validateModifier(modifier);
        if (!validation.valid) {
          rejected.push({ modifier: raw, reason: `invalid:${validation.errors.join("|")}` });
          continue;
        }
        if (modifier.domain !== domain || ![target, "all"].includes(modifier.target)) continue;
        modifier._context = raw?._context ?? {};
        const condition = this.evaluateModifierConditions(modifier, context);
        if (!condition.applicable) {
          rejected.push({ modifier, reason: condition.reason });
          continue;
        }
        applicable.push(modifier);
      }

      const stacking = this.applyStacking(applicable);
      rejected.push(...stacking.rejected);
      const ordered = [...stacking.accepted].sort((left, right) => {
        const priority = Number(left.priority) - Number(right.priority);
        if (priority) return priority;
        return sourceStableKey(left.source).localeCompare(sourceStableKey(right.source));
      });

      let afterOverride = base;
      let override = null;
      const additions = [];
      const multipliers = [];
      const bounds = [];

      for (const modifier of ordered) {
        if (modifier.operation === "set") {
          afterOverride = Number(modifier.value);
          override = { modifier, value: afterOverride };
        } else if (modifier.operation === "add") additions.push(modifier);
        else if (modifier.operation === "multiply") multipliers.push(modifier);
        else if (modifier.operation === "minmax") bounds.push(modifier);
      }

      const additionsTotal = additions.reduce((total, modifier) => total + Number(modifier.value), 0);
      const afterAdditions = afterOverride + additionsTotal;
      const multiplierTotal = multipliers.reduce((total, modifier) => total * Number(modifier.value), 1);
      const afterMultipliers = afterAdditions * multiplierTotal;
      let afterBounds = afterMultipliers;
      for (const modifier of bounds) {
        const minimum = modifier.value?.min;
        const maximum = modifier.value?.max;
        if (Number.isFinite(minimum)) afterBounds = Math.max(afterBounds, minimum);
        if (Number.isFinite(maximum)) afterBounds = Math.min(afterBounds, maximum);
      }

      const rounding = canonicalKey(query.rounding ?? "none");
      const total = rounding === "floor" ? Math.floor(afterBounds)
        : rounding === "ceil" ? Math.ceil(afterBounds)
          : rounding === "round" ? Math.round(afterBounds)
            : afterBounds;

      const applied = ordered.map(modifier => ({
        modifier,
        contribution: modifier.operation === "add"
          ? Number(modifier.value)
          : modifier.operation === "multiply"
            ? Number(modifier.value)
            : modifier.operation === "set"
              ? Number(modifier.value)
              : clone(modifier.value),
        reason: "applicable"
      }));

      return {
        domain,
        target,
        base,
        additionsTotal,
        multiplierTotal,
        override,
        total,
        applied,
        rejected,
        stages: { afterOverride, afterAdditions, afterMultipliers, afterBounds }
      };
    },

    explain(actor, query = {}) {
      return this.resolve(actor, { ...query, explain: true });
    },

    getAbilityBase(actor, ability) {
      const target = abilityKey(ability);
      if (!ADD2E_ABILITIES.has(target)) throw new Error(`Caractéristique inconnue : ${target || ability}`);
      const value = Number(actor?.system?.[`${target}_base`] ?? actor?.system?.[target] ?? 10);
      return Number.isFinite(value) ? value : 10;
    },

    resolveAbility(actor, ability, context = {}) {
      const target = abilityKey(ability);
      return this.resolve(actor, {
        domain: "ability",
        target,
        base: this.getAbilityBase(actor, target),
        context
      });
    },

    addTagsInto(dst, raw) {
      if (!dst) return;
      const add = typeof dst.add === "function"
        ? value => dst.add(value)
        : typeof dst.push === "function"
          ? value => dst.push(value)
          : null;
      if (!add) return;
      for (const tag of this.toArray(raw)) {
        const normalized = this.normalizeTag(tag);
        if (normalized) add(normalized);
      }
    },

    addEffectTagsInto(dst, effect) {
      if (!effect) return;
      this.addTagsInto(dst, effect.flags?.add2e?.tags);
      this.addTagsInto(dst, effect.flags?.add2e?.effectTags);
      if (!effect.getFlag) return;
      try { this.addTagsInto(dst, effect.getFlag("add2e", "tags")); } catch {}
      try { this.addTagsInto(dst, effect.getFlag("add2e", "effectTags")); } catch {}
    },

    addEmbeddedItemEffectTagsInto(dst, item) {
      const effects = item?.effects?.contents ?? item?.effects ?? [];
      for (const effect of effects) if (!effect?.disabled) this.addEffectTagsInto(dst, effect);
    },

    getActorLevel(actor) {
      const system = actor?.system ?? {};
      for (const value of [system.niveau, system.level, system.details?.level, system.details?.niveau]) {
        const level = Number(value);
        if (Number.isFinite(level) && level > 0) return level;
      }
      return 1;
    },

    itemTags(item) {
      const system = item?.system ?? {};
      const out = [];
      for (const value of [
        item?.name, system.nom, system.categorie, system.category, system.type,
        system.sousType, system.sous_type, system.famille, system.famille_arme,
        system.tags, system.tag, system.effectTags, system.effets, system.effects,
        item?.flags?.add2e?.tags, item?.flags?.add2e?.effectTags
      ]) this.addTagsInto(out, value);
      return [...new Set(out.map(tag => this.normalizeTag(tag)).filter(Boolean))];
    },

    itemText(item) {
      return this.itemTags(item).join(" ");
    },

    itemEquipped(item) {
      const system = item?.system ?? {};
      return system.equipee === true || system.equipped === true || system.portee === true || system.worn === true;
    },

    isShieldItem(item) {
      const text = this.itemText(item);
      return text.includes("bouclier") || text.includes("shield");
    },

    isHelmetItem(item) {
      const text = this.itemText(item);
      return text.includes("heaume") || text.includes("casque") || text.includes("helmet");
    },

    bonusFromName(item) {
      const match = String(item?.name ?? item?.system?.nom ?? "").match(/\+\s*(\d+)/);
      return match ? Number(match[1]) || 0 : 0;
    },

    looksMagical(item) {
      const system = item?.system ?? {};
      const text = this.itemText(item);
      return system.magique === true
        || system.magic === true
        || text.includes("magique")
        || text.includes("magic")
        || /\+\s*\d+/.test(String(item?.name ?? ""));
    },

    itemDefenseBonus(item) {
      const system = item?.system ?? {};
      let bonus = Math.abs(this.readNumber(
        system.bonus_ca, system.bonus_ac, system.ca_bonus, system.ac_bonus,
        system.protectionBonus, system.protection_bonus
      ) ?? 0);
      for (const tag of this.itemTags(item)) {
        const match = tag.match(/^(?:bonus_ca|bonus_ac|protection|protection_ca):([+\-]?\d+)$/);
        if (match) bonus += Math.abs(Number(match[1]) || 0);
      }
      if (!bonus && this.looksMagical(item)) {
        const type = String(item?.type ?? "").toLowerCase();
        const text = this.itemText(item);
        if (type === "armure" || type === "armor" || text.includes("anneau") || text.includes("bague") || text.includes("cape") || text.includes("protection")) {
          bonus = this.bonusFromName(item);
        }
      }
      return bonus;
    },

    itemFixedCA(item) {
      const system = item?.system ?? {};
      const type = String(item?.type ?? "").toLowerCase();
      const text = this.itemText(item);
      let ca = this.readNumber(
        system.ca_fixe, system.caFixe, system.fixedCA, system.fixed_ac, system.ac_fixe, system.acFixe
      );
      for (const tag of this.itemTags(item)) {
        const match = tag.match(/^(?:ca_fixe|ca_fixe_autres|ac_fixe|fixed_ca|classe_armure):([+\-]?\d+)$/);
        if (match) ca = Number(match[1]);
      }
      if (!Number.isFinite(ca)
        && (type === "objet" || type === "object" || type === "equipment")
        && (text.includes("bracelet") || text.includes("bracer"))) {
        const match = String(item?.name ?? system.nom ?? "").match(/(?:ca|classe\s+d[’']?armure|ac)\s*([\-]?\d+)/i)
          || String(item?.name ?? system.nom ?? "").match(/\b([\-]?\d+)\b\s*$/);
        if (match) ca = Number(match[1]);
      }
      return Number.isFinite(ca) ? ca : null;
    },

    getMagicWeaponBonus(item, kind = "hit") {
      const system = item?.system ?? {};
      const value = kind === "damage"
        ? this.readNumber(system.bonus_dom, system.bonus_degats, system.damage_bonus, system.degats_bonus, system.bonusDegats)
        : this.readNumber(system.bonus_hit, system.bonus_toucher, system.hit_bonus, system.attack_bonus, system.bonusAttaque);
      if (Number.isFinite(value)) return value;
      return this.looksMagical(item) ? this.bonusFromName(item) : 0;
    },

    equippedItems(actor, types = null) {
      const allowed = types ? new Set(types.map(type => String(type).toLowerCase())) : null;
      return [...(actor?.items ?? [])].filter(item => {
        const type = String(item?.type ?? "").toLowerCase();
        return (!allowed || allowed.has(type)) && this.itemEquipped(item);
      });
    },

    getDexDefense(actor) {
      const passiveArmorClass = typeof this.getPassiveArmorClassBase === "function"
        ? this.getPassiveArmorClassBase(actor, { ruleScope: "owner", source: "dex-defense" })
        : null;
      if (passiveArmorClass?.ignoreDex === true) return 0;

      const dex = this.resolveAbility(actor, "dexterite").total;
      if (dex <= 3) return 4;
      if (dex === 4) return 3;
      if (dex === 5) return 2;
      if (dex === 6) return 1;
      if (dex <= 14) return 0;
      if (dex === 15) return -1;
      if (dex === 16) return -2;
      if (dex === 17) return -3;
      return -4;
    },

    async createTimedEffect({ actor, name, img = null, sourceItem = null, rounds = 0, unit = "round", description = "", tags = [], rules = [], modifiers = [], changes = [], endMessage = null, silentExpiration = false, extraFlags = {} } = {}) {
      if (!actor) throw new Error("Acteur introuvable pour l’effet temporaire.");
      const canonicalModifiers = rawList(modifiers).map((modifier, index) => this.createModifier(modifier, {
        source: {
          kind: canonicalKey(extraFlags?.sourceType ?? sourceItem?.type ?? "effect") || "effect",
          id: String(sourceItem?.id ?? `${name || "effect"}-${index}`),
          uuid: String(sourceItem?.uuid ?? ""),
          name: String(sourceItem?.name ?? name ?? "Effet")
        }
      }));
      const data = add2eTimeEffectData({
        name,
        img: img || sourceItem?.img || "icons/svg/aura.svg",
        origin: sourceItem?.uuid ?? null,
        rounds,
        unit,
        description,
        tags,
        changes,
        source: "objet_magique",
        caster: actor,
        sourceItem,
        endMessage,
        silentExpiration,
        extraFlags: {
          rules: clone(rules),
          modifiers: clone(canonicalModifiers),
          genericEffect: true,
          ...clone(extraFlags)
        }
      });
      const [effect] = await actor.createEmbeddedDocuments("ActiveEffect", [data]);
      return effect ?? null;
    },

    async createTimedCharacteristicEffect({ actor, characteristic, value, displayValue = null, profile = {}, priority = 100, rules = [], changes = [], ...options } = {}) {
      const ability = abilityKey(characteristic);
      if (!actor || !ADD2E_ABILITIES.has(ability) || value === undefined || value === null || value === "") {
        throw new Error("Override de caractéristique invalide.");
      }
      const sourceItem = options.sourceItem ?? null;
      const source = {
        kind: canonicalKey(options.extraFlags?.sourceType ?? sourceItem?.type ?? "effect") || "effect",
        id: String(sourceItem?.id ?? options.extraFlags?.sourceItemId ?? `${options.name ?? "effect"}:${ability}`),
        uuid: String(sourceItem?.uuid ?? options.extraFlags?.sourceItemUuid ?? ""),
        name: String(sourceItem?.name ?? options.name ?? "Effet de caractéristique")
      };
      const modifier = this.createModifier({
        id: `${sourceStableKey(source)}:${ability}:set`,
        domain: "ability",
        target: ability,
        operation: "set",
        value: Number(value),
        priority,
        stacking: { mode: "replace", group: `ability:${ability}:override` },
        source,
        metadata: {
          label: source.name,
          displayValue: displayValue ?? value,
          profile: clone(profile)
        }
      });
      return this.createTimedEffect({
        ...options,
        actor,
        rules,
        changes,
        modifiers: [...rawList(options.modifiers), modifier],
        extraFlags: {
          ...(options.extraFlags ?? {}),
          characteristicEffect: true,
          characteristic: ability,
          characteristicValue: value,
          characteristicDisplayValue: displayValue ?? value,
          characteristicProfile: clone(profile)
        }
      });
    },

    async postGenericEffectChat(actor, title, html, item = null) {
      if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
        throw new Error("Les constructeurs de carte de chat ADD2E ne sont pas disponibles.");
      }
      const container = document.createElement("div");
      container.innerHTML = String(html ?? "");
      const message = String(container.textContent ?? "").replace(/\s+/g, " ").trim();
      const options = {
        actor,
        title,
        icon: "fas fa-wand-magic-sparkles",
        variant: "magic",
        source: {
          name: item?.name ?? actor?.name ?? "Source",
          img: item?.img ?? actor?.img ?? "icons/svg/aura.svg",
          type: item ? "Objet" : "Acteur"
        },
        message
      };
      globalThis.add2eBuildChatCard(options);
      return globalThis.add2eCreateChatCard(options);
    },

    async applyConfiguredEffect(context, config = {}) {
      const actor = potionContextActor(context);
      const item = potionContextItem(context);
      if (!actor) return false;

      if (config.kind === "healing") {
        const total = await potionRoll(config.formula, actor, config.name);
        const hp = potionHpDescriptor(actor);
        if (!hp) {
          await this.postGenericEffectChat(actor, config.name, `<p>Soins obtenus : <b>${total}</b>. Aucun champ de points de vie compatible n’a été trouvé.</p>`, item);
          return true;
        }
        const before = Number(hp.value) || 0;
        const maximum = Number.isFinite(Number(hp.max)) ? Number(hp.max) : before + total;
        const after = Math.min(maximum, before + total);
        await actor.update({ [hp.path]: after }, { add2eInternal: true, add2eReason: "potion-healing" });
        await this.postGenericEffectChat(actor, config.name, `<p>Points de vie : <b>${before} → ${after}</b>.</p><p>Soins effectifs : <b>${after - before}</b>.</p>`, item);
        return true;
      }

      if (config.kind === "age") {
        const total = await potionRoll(config.formula, actor, config.name);
        const system = actor.system ?? {};
        const target = [
          ["system.age", system.age],
          ["system.details.age", system.details?.age],
          ["system.age_actuel", system.age_actuel]
        ].find(([, current]) => Number.isFinite(Number(current)));
        if (target) {
          const [path, before] = target;
          const after = Math.max(0, Number(before) - total);
          await actor.update({ [path]: after }, { add2eInternal: true, add2eReason: "potion-age" });
          await this.postGenericEffectChat(actor, config.name, `<p>Âge : <b>${before} → ${after}</b>.</p>`, item);
        } else {
          await this.postGenericEffectChat(actor, config.name, `<p>Réduction d’âge à appliquer : <b>${total}</b> an(s).</p>`, item);
        }
        return true;
      }

      if (config.kind === "deception") {
        await this.createTimedEffect({
          actor,
          name: config.name,
          img: item?.img || "icons/svg/aura.svg",
          sourceItem: item,
          description: config.description || "",
          tags: ["objet_magique", "potion", `potion:${config.slug}`, "tromperie"],
          rules: [{ kind: "deception", apparentEffect: config.apparentEffect || "soins" }],
          extraFlags: { potion: true, potionSlug: config.slug, deceptivePotion: true }
        });
        await this.postGenericEffectChat(actor, config.name, "<p>Le consommateur croit que la potion a produit l’effet attendu. Aucun bénéfice réel n’est appliqué.</p>", item);
        return true;
      }

      if (config.kind === "heroism") {
        const level = this.getActorLevel(actor);
        if (level >= Number(config.maxLevelExclusive ?? Infinity)) {
          ui.notifications.warn(`${config.name} est sans effet sur un personnage de niveau ${level}.`);
          return false;
        }
        const row = (config.levelTable ?? []).find(entry => level >= Number(entry.min) && level <= Number(entry.max));
        if (!row) return false;
        const temporaryHp = await potionRoll(row.hpDice, actor, `${config.name} — points de vie temporaires`);
        const rounds = await potionDuration(actor, config);
        await this.createTimedEffect({
          actor,
          name: config.name,
          img: item?.img || "icons/svg/aura.svg",
          sourceItem: item,
          rounds,
          description: config.description || "",
          tags: ["objet_magique", "potion", `potion:${config.slug}`, ...(config.tags ?? [])],
          rules: [
            { kind: "temporary_levels", value: Number(row.bonus) || 0 },
            { kind: "temporary_hp", value: temporaryHp }
          ],
          endMessage: `L’effet ${config.name} prend fin sur {actor}.`,
          extraFlags: { potion: true, potionSlug: config.slug, temporaryLevels: Number(row.bonus) || 0, temporaryHp }
        });
        await this.postGenericEffectChat(actor, config.name, `<p>Niveaux temporaires : <b>+${Number(row.bonus) || 0}</b>.</p><p>Points de vie temporaires : <b>${temporaryHp}</b>.</p>${rounds ? `<p>Durée : <b>${rounds} round(s).</b></p>` : ""}`, item);
        return true;
      }

      const rounds = await potionDuration(actor, config);
      const targets = potionTargets(actor, config.selfOnly === true);
      if (!targets.length) return false;
      if (config.confirm === true) {
        const DialogV2 = foundry.applications?.api?.DialogV2;
        if (!DialogV2?.confirm) throw new Error("DialogV2 est indisponible.");
        const accepted = await DialogV2.confirm({
          window: { title: config.name || "Effet" },
          modal: true,
          content: `<div class="add2e-dialog"><p><b>${escapeHtml(config.name || "Effet")}</b></p><p>Cible(s) : <b>${escapeHtml(targets.map(target => target.name).join(", "))}</b></p>${config.saveNote ? `<p>${escapeHtml(config.saveNote)}</p>` : ""}<p>Appliquer l’effet ?</p></div>`,
          yes: { label: "Appliquer", icon: "fa-solid fa-check" },
          no: { label: "Annuler", icon: "fa-solid fa-xmark" }
        });
        if (!accepted) return false;
      }
      for (const target of targets) {
        await this.createTimedEffect({
          actor: target,
          name: config.name,
          img: item?.img || "icons/svg/aura.svg",
          sourceItem: item,
          rounds,
          description: config.description || config.rule || "",
          tags: ["objet_magique", "potion", `potion:${config.slug}`, ...(config.tags ?? [])],
          rules: config.rules ?? [],
          modifiers: config.modifiers ?? [],
          endMessage: config.endMessage ?? `L’effet ${config.name} prend fin sur {actor}.`,
          extraFlags: { potion: true, potionSlug: config.slug, ...(config.extraFlags ?? {}) }
        });
      }
      await this.postGenericEffectChat(actor, config.name, `<p>Effet appliqué à : <b>${escapeHtml(targets.map(target => target.name).join(", "))}</b>.</p>${rounds ? `<p>Durée : <b>${rounds} round(s).</b></p>` : ""}${config.rule ? `<p>${escapeHtml(config.rule)}</p>` : ""}`, item);
      return true;
    }
  });

  installAbilityDerivedResolver(Engine);
  installCharacteristicEffectCanonicalization(Engine);
  globalThis.ADD2E_EFFECTS = Engine;
  globalThis.ADD2E_MODIFIER_RESOLVER_VERSION = ADD2E_MODIFIER_RESOLVER_VERSION;
}
