// ADD2E — Effects Engine / utilitaires et constantes partagés.
// Compatible Foundry V13/V14/V15.

export const ADD2E_MODIFIER_RESOLVER_VERSION = "2026-07-27-canonical-hit-points-v1";
export const ADD2E_ABILITY_DERIVED_VERSION = "2026-07-26-canonical-derived-abilities-engine-v3";
export const ADD2E_HIT_POINTS_VERSION = "2026-07-27-hit-points-domain-v1";

export const ADD2E_MODIFIER_DOMAINS = new Set([
  "ability", "attack", "damage", "armor-class", "save", "movement",
  "initiative", "hit-points", "spell-slot", "skill", "reaction",
  "morale", "encumbrance", "level", "resource", "resistance"
]);

export const ADD2E_MODIFIER_OPERATIONS = new Set(["add", "set", "multiply", "minmax"]);
export const ADD2E_MODIFIER_STACKING = new Set(["stack", "highest", "lowest", "replace", "unique-source", "exclusive"]);
export const ADD2E_ABILITIES = new Set(["force", "dexterite", "constitution", "intelligence", "sagesse", "charisme"]);
export const ADD2E_HIT_POINT_TARGETS = new Set(["maximum", "current"]);
export const ADD2E_HIT_POINT_CALCULATIONS = new Set(["fixed", "per-level"]);
export const ADD2E_ABILITY_MIN = 3;
export const ADD2E_ABILITY_MAX = 25;

export const register = (Engine, methods) => Object.defineProperties(
  Engine,
  Object.fromEntries(Object.entries(methods).map(([name, value]) => [
    name,
    { value, configurable: true, writable: true }
  ]))
);

export const clone = value => {
  try { return foundry.utils.deepClone(value); }
  catch (_error) { return JSON.parse(JSON.stringify(value ?? null)); }
};

export const escapeHtml = value => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#039;");

export const isObject = value => !!value && typeof value === "object" && !Array.isArray(value);

export const canonicalKey = value => String(value ?? "")
  .trim()
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[’']/g, "")
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/-+/g, "-")
  .replace(/^-+|-+$/g, "");

export const abilityKey = value => {
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

export const hitPointTargetKey = value => {
  const key = canonicalKey(value);
  const aliases = {
    max: "maximum",
    maximum: "maximum",
    hp: "maximum",
    pv: "maximum",
    "hp-max": "maximum",
    "hp-maximum": "maximum",
    "pv-max": "maximum",
    "pv-maximum": "maximum",
    "points-de-coup": "maximum",
    points_de_coup: "maximum",
    current: "current",
    courant: "current",
    actuel: "current",
    pdv: "current",
    "hp-current": "current",
    "pv-current": "current",
    "pv-courants": "current",
    all: "all",
    tout: "all"
  };
  return aliases[key] ?? key;
};

export const hitPointCalculationKey = value => {
  const key = canonicalKey(value);
  const aliases = {
    fixed: "fixed",
    fixe: "fixed",
    flat: "fixed",
    constant: "fixed",
    "per-level": "per-level",
    perlevel: "per-level",
    niveau: "per-level",
    "par-niveau": "per-level",
    "by-level": "per-level"
  };
  return aliases[key] ?? key;
};

export const sourceStableKey = source => [source?.uuid, source?.id, source?.name]
  .map(value => String(value ?? "").trim())
  .find(Boolean) ?? "";

export const modifierSignature = modifier => JSON.stringify([
  modifier?.domain,
  modifier?.target,
  modifier?.operation,
  modifier?.value,
  modifier?.priority,
  modifier?.stacking?.mode,
  modifier?.stacking?.group,
  modifier?.metadata?.calculation,
  modifier?.metadata?.levelSource,
  sourceStableKey(modifier?.source)
]);

export const rawList = value => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (isObject(value)) return Object.values(value);
  return [];
};

export const effectArray = actor => Array.from(actor?.effects?.contents ?? actor?.effects ?? []);
export const itemArray = actor => Array.from(actor?.items?.contents ?? actor?.items ?? []);
