// scripts/add2e-attack/01-core-helpers.mjs
// ADD2E — Helpers communs attaque / dégâts / sorts.

/**
 * scripts/add2e-attack.js
 * Gestion des attaques, dégâts et sorts pour AD&D 2e
 * VERSION : 2026-05-05-attack-v25-scene-token-computed-ca
 * - Profil de combat générique par tags
 * - Bonus de caractéristique sans dépendance aux noms d’armes
 * - Consommation automatique des armes temporaires à usage unique
 */

globalThis.ADD2E_ATTACK_VERSION = "2026-05-05-attack-v25-scene-token-computed-ca";

// --- TABLE 39 : THAC0 MONSTRES ---
const MONSTER_THACO_TABLE = [
  { min: 0,    max: 0.99, thaco: 20 },
  { min: 1,    max: 1.99, thaco: 19 },
  { min: 2,    max: 2.99, thaco: 19 },
  { min: 3,    max: 3.99, thaco: 17 },
  { min: 4,    max: 4.99, thaco: 17 },
  { min: 5,    max: 5.99, thaco: 15 },
  { min: 6,    max: 6.99, thaco: 15 },
  { min: 7,    max: 7.99, thaco: 13 },
  { min: 8,    max: 8.99, thaco: 13 },
  { min: 9,    max: 9.99, thaco: 11 },
  { min: 10,   max: 10.99, thaco: 11 },
  { min: 11,   max: 11.99, thaco: 9 },
  { min: 12,   max: 12.99, thaco: 9 },
  { min: 13,   max: 13.99, thaco: 7 },
  { min: 14,   max: 14.99, thaco: 7 },
  { min: 15,   max: 15.99, thaco: 5 },
  { min: 16,   max: 999,   thaco: 5 }
];

const ADD2E_SORT_FIELD_ALIASES = Object.freeze({
  ecole: ["ecole", "école", "school"],
  portee: ["portee", "portée", "range"],
  duree: ["duree", "durée", "duration"],
  cible: ["cible", "target", "targets"],
  zone_effet: ["zone_effet", "zoneEffet", "area", "areaOfEffect"],
  temps_incantation: ["temps_incantation", "tempsIncantation", "castingTime", "casting_time"],
  composantes: ["composantes", "components", "componentes", "composants"],
  composants_materiels: ["composants_materiels", "composantsMateriels", "materialComponents", "material_components", "components.material", "components.materials"],
  description: ["description", "description_reelle", "description_texte", "description_html"],
  onUse: ["onUse", "onuse", "on_use"]
});

function add2eIsFilledSpellValue(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

function add2eGetSystemLike(source) {
  return source?.system ?? source ?? {};
}

function add2eGetProperty(source, path) {
  if (!source || !path) return undefined;
  try {
    if (foundry?.utils?.getProperty) return foundry.utils.getProperty(source, path);
  } catch (_err) {}
  const parts = String(path).split(".");
  let cur = source;
  for (const part of parts) {
    if (cur === undefined || cur === null) return undefined;
    cur = cur[part];
  }
  return cur;
}

function add2eExtractScriptPath(raw) {
  if (!raw) return "";
  let value = raw;
  if (Array.isArray(value)) value = value.find(v => typeof v === "string" && v.includes(".js")) ?? value[0] ?? "";
  value = String(value ?? "").trim();
  if (value.includes(",")) {
    value = value.split(",").map(s => s.trim()).find(s => s.endsWith(".js")) ?? value.split(",")[0].trim();
  }
  return value;
}

export function add2eGetSortField(source, canonicalField, fallback = "") {
  const sys = add2eGetSystemLike(source);
  const aliases = ADD2E_SORT_FIELD_ALIASES[canonicalField] ?? [canonicalField];
  for (const alias of aliases) {
    const value = add2eGetProperty(sys, alias);
    if (add2eIsFilledSpellValue(value)) return value;
  }
  return fallback;
}

export function add2eGetSortOnUsePath(source) {
  const sys = add2eGetSystemLike(source);
  for (const alias of ADD2E_SORT_FIELD_ALIASES.onUse) {
    const value = add2eExtractScriptPath(add2eGetProperty(sys, alias));
    if (value) return value;
  }
  return "";
}

export function add2eGetSortMaterialComponents(source) {
  const value = add2eGetSortField(source, "composants_materiels", []);
  return value === "" ? [] : value;
}

export function add2eGetSortComponentsText(source) {
  return String(add2eGetSortField(source, "composantes", "") ?? "");
}

export function getMonsterThaco(hdString) {
  const match = String(hdString).match(/^(\d+)/);
  const hd = match ? parseFloat(match[1]) : 1;
  const entry = MONSTER_THACO_TABLE.find(e => hd >= e.min && hd <= e.max);
  return entry ? entry.thaco : 20;
}

export function formatSortChamp(val, niveau = 1) {
  if (!val) return "-";
  if (typeof val === "object") {
    const v = val.valeur !== undefined ? val.valeur : "";
    const u = val.unite ? (" " + val.unite) : "";
    return `${v}${u}`.trim() || "-";
  }
  return val;
}

export function getEffetTypeByNom(arme, mappingTable) {
  const nom = (arme.name || arme.system?.nom || "").toLowerCase();
  for (const entry of mappingTable) {
    if (entry.patterns.some(p => nom.includes(p))) {
      return entry.type;
    }
  }
  return "";
}

export function plageToRollFormula(plage) {
  if (typeof plage !== "string") return plage;

  const v = plage.trim().toLowerCase();

  // Si c'est déjà une formule Foundry, on ne touche pas.
  if (v.includes("d")) return plage;

  // Conversion AD&D correcte des plages de dégâts.
  const table = {
    "1-2": "1d2",
    "1-3": "1d3",
    "1-4": "1d4",
    "1-6": "1d6",
    "1-8": "1d8",
    "1-10": "1d10",
    "1-12": "1d12",

    "2-5": "1d4+1",
    "2-7": "1d6+1",
    "2-8": "2d4",
    "2-12": "2d6",
    "2-16": "2d8",

    "3-9": "3d3",
    "3-12": "3d4",
    "3-18": "3d6"
  };

  return table[v] || plage;
}

globalThis.getMonsterThaco = getMonsterThaco;
globalThis.formatSortChamp = formatSortChamp;
globalThis.plageToRollFormula = plageToRollFormula;
globalThis.add2eGetSortField = add2eGetSortField;
globalThis.add2eGetSortOnUsePath = add2eGetSortOnUsePath;
globalThis.add2eGetSortMaterialComponents = add2eGetSortMaterialComponents;
globalThis.add2eGetSortComponentsText = add2eGetSortComponentsText;
