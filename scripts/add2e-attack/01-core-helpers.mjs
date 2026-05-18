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
