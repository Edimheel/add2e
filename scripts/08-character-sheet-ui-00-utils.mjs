// ============================================================
// ADD2E — 08 Character Sheet UI — 00 utilitaires
// ============================================================
<<<<<<< HEAD
export const ADD2E_CHARACTER_SHEET_UI_VERSION = "2026-05-19-character-ui-split-v2-repush";
=======
export const ADD2E_CHARACTER_SHEET_UI_VERSION = "2026-05-19-character-ui-split-v10-monk-refresh";
>>>>>>> 3de7e039a4779c6b7a3f9a95f22618004cb090d3

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function slug(value) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function toArray(value) {
  if (Array.isArray(value)) return value.filter(v => v !== undefined && v !== null && String(v).trim() !== "");
  if (value && typeof value === "object") return Object.values(value).filter(v => v !== undefined && v !== null && String(v).trim() !== "");
  if (typeof value === "string") return value.split(/[,;|\n]+/).map(s => s.trim()).filter(Boolean);
  return [];
}

export function deepClone(value) {
  if (value === undefined || value === null) return value;
  if (globalThis.foundry?.utils?.deepClone) return foundry.utils.deepClone(value);
  if (globalThis.foundry?.utils?.duplicate) return foundry.utils.duplicate(value);
  return JSON.parse(JSON.stringify(value));
}

export function getSheetRoot(html) {
  const root = html?.jquery ? html[0] : html;
  if (!root) return null;
  return root.matches?.(".add2e-character-v3")
    ? root
    : root.querySelector?.(".add2e-character-v3") || root;
}

export function expose(name, value) {
  try { globalThis[name] = value; } catch (_e) {}
}

export function globalFn(name, fallback = null) {
  const fn = globalThis?.[name];
  return typeof fn === "function" ? fn : fallback;
}

export function normalizeEquipTag(value) {
  const fn = globalFn("add2eNormalizeEquipTag");
  if (fn) return fn(value);
  return slug(value).replace(/_/g, ":").replace(/:+/g, ":");
}

export function spellLabel(value) {
  const fn = globalFn("add2eSpellLabel");
  return fn ? fn(value) : String(value ?? "—");
}

export function getSpellPoolsByLevel(actor) {
  const fn = globalFn("add2eGetSpellSlotPoolsByLevel");
  const countFn = globalFn("add2eCountPreparedForEntryLevel");
  const pools = fn ? fn(actor) : {};
  const out = {};

  for (const [key, pool] of Object.entries(pools || {})) {
    for (const [lvl, max] of Object.entries(pool.slotsByLevel || {})) {
      const spellLevel = Number(lvl) || 1;
      if (!out[spellLevel]) out[spellLevel] = [];
      out[spellLevel].push({
        key,
        label: pool.label || spellLabel(key),
        startsAt: Number(pool.startsAt || 1),
        maxSpellLevel: Number(pool.maxSpellLevel || 0),
        max: Number(max) || 0,
        count: countFn ? countFn(actor, pool, spellLevel) : 0
      });
    }
  }

  return out;
}

export function getMemorizedSpellsByLevel(actor) {
  const countFn = globalFn("add2eGetTotalMemorizedCount");
  const countByLevel = {};
  for (const sort of actor?.items?.filter?.(i => String(i.type || "").toLowerCase() === "sort") ?? []) {
    const niv = Number(sort.system?.niveau || sort.system?.level || 1) || 1;
    const count = countFn ? countFn(sort) : 0;
    countByLevel[niv] = (countByLevel[niv] || 0) + count;
  }
  return countByLevel;
}

export function formatDuration(effect) {
  if (typeof effect?.duration?.remaining !== "undefined") return `${effect.duration.remaining} rounds`;
  if (typeof effect?.duration?.rounds !== "undefined") return `${effect.duration.rounds} rounds`;
  if (typeof effect?.duration?.seconds !== "undefined") return `${effect.duration.seconds} sec`;
  return "—";
}

expose("ADD2E_CHARACTER_SHEET_UI_VERSION", ADD2E_CHARACTER_SHEET_UI_VERSION);
expose("add2eUiEscapeHtml", escapeHtml);
expose("add2eUiNormalizeText", normalizeText);
expose("add2eUiGetSpellPoolsByLevel", getSpellPoolsByLevel);
expose("add2eUiGetMemorizedSpellsByLevel", getMemorizedSpellsByLevel);
expose("add2eUiFormatDuration", formatDuration);
