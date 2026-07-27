// ADD2E — Objets magiques : noyau partagé.
// Compatible Foundry V13/V14/V15.

export const ADD2E_MAGIC_ITEM_BUILDER_VERSION = "2026-07-27-object-magic-split-v9";
export const ADD2E_MAGIC_ITEM_TYPES = new Set(["arme", "armure", "objet"]);
export const ADD2E_MAGIC_CATALOGUE_SELECTION_SCHEMA = 1;
export const ADD2E_MAGIC_CATALOGUE_POWER_SCHEMA = 2;
export const ADD2E_MAGIC_CREATOR_STATES = new WeakMap();

export function add2eObjectMagicEscapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function add2eObjectMagicToArray(value) {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(add2eObjectMagicToArray);
  if (value instanceof Set) return [...value].flatMap(add2eObjectMagicToArray);
  if (typeof value === "string") return value.split(/[,;\n|]+/g).map(entry => entry.trim()).filter(Boolean);
  if (typeof value === "object") {
    for (const key of ["value", "list", "lists", "items", "tags", "effectTags"]) {
      if (value[key] !== undefined && value[key] !== null) return add2eObjectMagicToArray(value[key]);
    }
  }
  return [value];
}

export function add2eObjectMagicNormalizeTag(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function add2eMagicClone(value) {
  try { return foundry.utils.deepClone(value); }
  catch (_error) {
    try { return structuredClone(value); }
    catch (_cloneError) { return JSON.parse(JSON.stringify(value ?? null)); }
  }
}

export function add2eMagicGetProperty(object, path) {
  try { return foundry.utils.getProperty(object, path); }
  catch (_error) { return String(path).split(".").reduce((current, key) => current?.[key], object); }
}

export function add2eMagicSetProperty(object, path, value) {
  try { return foundry.utils.setProperty(object, path, value); }
  catch (_error) {
    const parts = String(path).split(".");
    let current = object;
    while (parts.length > 1) {
      const key = parts.shift();
      current[key] ??= {};
      current = current[key];
    }
    current[parts[0]] = value;
    return true;
  }
}

export function add2eMagicMerge(base, update) {
  try {
    return foundry.utils.mergeObject(add2eMagicClone(base ?? {}), add2eMagicClone(update ?? {}), {
      inplace: false,
      insertKeys: true,
      overwrite: true,
      recursive: true
    });
  } catch (_error) {
    return { ...(base ?? {}), ...(update ?? {}) };
  }
}

export function add2eMagicNumber(value, fallback = 0) {
  if (value === undefined || value === null || value === "") return fallback;
  const number = Number(String(value).replace(",", "."));
  return Number.isFinite(number) ? number : fallback;
}

export function add2eMagicOptionalNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(String(value).replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

export function add2eMagicSigned(value) {
  const number = add2eMagicNumber(value, 0);
  return `${number >= 0 ? "+" : ""}${number}`;
}

export function add2eMagicMergeUniqueValues(...values) {
  const seen = new Set();
  const result = [];
  for (const raw of values) {
    for (const value of add2eObjectMagicToArray(raw)) {
      const text = String(value ?? "").trim();
      const key = text.toLowerCase();
      if (!text || seen.has(key)) continue;
      seen.add(key);
      result.push(text);
    }
  }
  return result;
}

export function add2eMagicReadNumber(...values) {
  for (const value of values) {
    if (value === undefined || value === null || value === "") continue;
    if (typeof value === "object") {
      const nested = add2eMagicReadNumber(value.value, value.current, value.actuel, value.remaining, value.max);
      if (Number.isFinite(nested)) return nested;
      continue;
    }
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return NaN;
}
