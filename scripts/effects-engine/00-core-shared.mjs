// ADD2E — Effects Engine / utilitaires et constantes partagés.
// Compatible Foundry V13/V14/V15.

export const ADD2E_MODIFIER_RESOLVER_VERSION = "2026-07-26-bonus-bigbang-derived-abilities-v2";
export const ADD2E_ABILITY_DERIVED_VERSION = "2026-07-26-canonical-derived-abilities-engine-v3";

export const ADD2E_MODIFIER_DOMAINS = new Set([
  "ability", "attack", "damage", "armor-class", "save", "movement",
  "initiative", "hit-points", "spell-slot", "skill", "reaction",
  "morale", "encumbrance", "level", "resource", "resistance"
]);

export const ADD2E_MODIFIER_OPERATIONS = new Set(["add", "set", "multiply", "minmax"]);
export const ADD2E_MODIFIER_STACKING = new Set(["stack", "highest", "lowest", "replace", "unique-source", "exclusive"]);
export const ADD2E_ABILITIES = new Set(["force", "dexterite", "constitution", "intelligence", "sagesse", "charisme"]);
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

export const sourceStableKey = source => String(source?.uuid ?? source?.id ?? source?.name ?? "").trim();

export const modifierSignature = modifier => JSON.stringify([
  modifier?.domain,
  modifier?.target,
  modifier?.operation,
  modifier?.value,
  modifier?.priority,
  modifier?.stacking?.mode,
  modifier?.stacking?.group,
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
