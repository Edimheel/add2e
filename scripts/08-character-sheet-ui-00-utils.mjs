// ============================================================
// ADD2E — 08 Character Sheet UI — 00 utilitaires
// ============================================================
export const ADD2E_CHARACTER_SHEET_UI_VERSION = "2026-07-01-character-ui-duration-flags-v12";

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

function finiteDuration(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : null;
}

function add2eCurrentDurationTick() {
  try {
    const tick = finiteDuration(globalThis.game?.settings?.get?.("add2e", "worldTimeTick"));
    if (tick !== null) return tick;
  } catch (_error) {}

  try {
    const tick = finiteDuration(globalThis.game?.add2e?.time?.currentTick?.());
    if (tick !== null) return tick;
  } catch (_error) {}

  return 0;
}

function add2eManagedEffectRemainingRounds(effect) {
  const flags = effect?.flags?.add2e ?? {};
  const timeEngine = flags.timeEngine ?? {};
  const roundEngine = flags.roundEngine ?? {};
  const total = finiteDuration(
    timeEngine.totalRounds
      ?? roundEngine.totalRounds
      ?? flags.durationRounds
      ?? flags.dureeRounds
      ?? flags.duree_rounds
  );

  if (total === null || total <= 0) return null;

  const startTick = finiteDuration(
    timeEngine.startTick
      ?? timeEngine.createdAtTick
      ?? roundEngine.startTick
      ?? flags.startTick
  ) ?? 0;
  const elapsed = Math.max(0, add2eCurrentDurationTick() - startTick);
  return Math.max(0, total - elapsed);
}

export function formatDuration(effect) {
  const managedRemaining = add2eManagedEffectRemainingRounds(effect);
  if (managedRemaining !== null) return `${managedRemaining} rounds`;

  try {
    const remaining = globalThis.game?.add2e?.time?.remainingRounds?.(effect)?.remaining;
    const rounds = finiteDuration(remaining);
    if (rounds !== null) return `${rounds} rounds`;
  } catch (_error) {}

  const nativeRemaining = finiteDuration(effect?.duration?.remaining);
  if (nativeRemaining !== null) return `${nativeRemaining} rounds`;

  const nativeRounds = finiteDuration(effect?.duration?.rounds);
  if (nativeRounds !== null) return `${nativeRounds} rounds`;

  const seconds = finiteDuration(effect?.duration?.seconds);
  if (seconds !== null) return `${seconds} sec`;

  return effect?.isTemporary ? "Temporaire" : "Permanente";
}

expose("ADD2E_CHARACTER_SHEET_UI_VERSION", ADD2E_CHARACTER_SHEET_UI_VERSION);
expose("add2eUiEscapeHtml", escapeHtml);
expose("add2eUiNormalizeText", normalizeText);
expose("add2eUiGetSpellPoolsByLevel", getSpellPoolsByLevel);
expose("add2eUiGetMemorizedSpellsByLevel", getMemorizedSpellsByLevel);
expose("add2eUiFormatDuration", formatDuration);