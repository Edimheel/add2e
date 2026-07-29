// ADD2E — utilitaires partagés du HUD d'action.

export const ADD2E_ACTION_HUD_VERSION = "2026-07-29-v54-split-canonical-initiative";
export const HUD_ID = "add2e-action-hud";
export const STYLE_ID = "add2e-action-hud-style";
export const STORAGE_KEY = "add2e.actionHud.state.v46";
export const LEGACY_STORAGE_KEYS = ["add2e.actionHud.state.v45", "add2e.actionHud.state.v44", "add2e.actionHud.state.v43"];
export const TAG = "[ADD2E][ACTION_HUD]";
export const EDGE_PAD = 0;
export const HANDLE_VISIBLE = 42;
export const TABS = ["attaques", "sorts", "capacites", "equipement", "effets", "sauvegardes", "caracs"];

export const COINS = [["pp", "PP"], ["po", "PO"], ["pe", "PE"], ["pa", "PA"], ["pc", "PC"]];
export const CARACS = [
  ["force", "FOR", "Force", "fa-fist-raised"],
  ["dexterite", "DEX", "Dextérité", "fa-running"],
  ["constitution", "CON", "Constitution", "fa-heart"],
  ["intelligence", "INT", "Intelligence", "fa-brain"],
  ["sagesse", "SAG", "Sagesse", "fa-eye"],
  ["charisme", "CHA", "Charisme", "fa-comments"]
];
export const SAVES = [
  ["Paralysie", "Paralysie / poison / mort", "fa-skull-crossbones", "ruby"],
  ["Pétrification", "Pétrification / métamorphose", "fa-mountain", "amber"],
  ["Baguettes", "Baguettes, bâtons et bâtonnets", "fa-magic", "violet"],
  ["Souffles", "Souffles", "fa-wind", "cyan"],
  ["Sorts", "Sortilèges", "fa-scroll", "emerald"]
];

export function esc(value) {
  try { return foundry.utils.escapeHTML(String(value ?? "")); }
  catch (_error) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  }
}

export function arr(value) {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(arr);
  if (value instanceof Set) return [...value];
  if (typeof value?.values === "function") return [...value.values()];
  if (typeof value === "object") return Object.values(value);
  return [value];
}

export function num(value, fallback = 0) {
  if (typeof value === "string") {
    const match = value.match(/-?\d+(?:[.,]\d+)?/);
    if (!match) return fallback;
    value = match[0].replace(",", ".");
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function lower(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export function norm(value) {
  return lower(value).replace(/[’']/g, "").replace(/[^a-z0-9:_-]+/g, "_").replace(/^_|_$/g, "");
}

export function slug(value) {
  return lower(value).replace(/[’']/g, "_").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
export function hud() { return document.getElementById(HUD_ID); }
export function actorItems(actor) { return Array.from(actor?.items ?? []).filter(item => item && item.type); }
export function actorEffects(actor) { return Array.from(actor?.effects ?? []).filter(Boolean); }
export function getItem(actor, id) { return actor?.items?.get?.(id) ?? actorItems(actor).find(item => item.id === id || item._id === id) ?? null; }
export function tokenFor(actor) { return canvas?.tokens?.controlled?.find?.(token => token.actor?.id === actor?.id) ?? actor?.getActiveTokens?.()[0] ?? null; }
export function actorType(actor) { return norm(actor?.type ?? actor?._source?.type ?? actor?.baseActor?.type ?? ""); }
export function canUse(actor) { return !!actor && (game.user?.isGM || actor.isOwner || actor.testUserPermission?.(game.user, "OWNER")); }
export function isMonsterActor(actor) { return actorType(actor) === "monster"; }
export function usesProjectileInventory(actor) { return actorType(actor) === "personnage"; }
export function relevant(actor) {
  const type = actorType(actor);
  if (type === "personnage" || type === "pnj") return canUse(actor);
  if (type === "monster") return game.user?.isGM === true;
  return false;
}
export function controlledRelevantTokens() { return (canvas?.tokens?.controlled ?? []).filter(token => token?.actor && relevant(token.actor)); }
export function hudTargetFromControlledSelection({ allowCharacterFallback = true } = {}) {
  const controlled = controlledRelevantTokens();
  if (controlled.length === 1) return { actor: controlled[0].actor, token: controlled[0], ambiguous: false };
  if (controlled.length > 1) return { actor: null, token: null, ambiguous: true };
  const character = allowCharacterFallback ? game.user?.character : null;
  if (character && relevant(character)) return { actor: character, token: tokenFor(character), ambiguous: false };
  return { actor: null, token: null, ambiguous: false };
}
