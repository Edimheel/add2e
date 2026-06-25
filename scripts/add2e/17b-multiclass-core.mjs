// ADD2E — Multiclassage : noyau canonique
// Source de vérité : objets Item de type "classe" embarqués par l'acteur.
// Les définitions de classe restent dans Item.system ; l'état de progression
// multiclasses est porté uniquement par system.multiclasse.classes.

export const MULTICLASS_VERSION = "2026-06-25-canonical-class-state-v1";
export const MULTICLASS_SCHEMA = 2;
export const INTERNAL = "add2eMulticlassInternal";
export const TAG = "[ADD2E][MULTICLASSE]";

export function warn(label, data = {}) {
  console.warn(`${TAG}${label}`, data);
}

export function num(value, fallback = 0) {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (value && typeof value === "object") {
    for (const key of ["value", "valeur", "total", "current", "base", "max", "niveau", "level", "xp"]) {
      if (value[key] !== undefined && value[key] !== null && typeof value[key] !== "object") {
        return num(value[key], fallback);
      }
    }
  }
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;
  const parsed = Number(raw.replace(/\s+/g, "").replace(/\./g, "").replace(/,/g, ".").replace(/[^0-9.+\-]/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function norm(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function esc(value) {
  const div = document.createElement("div");
  div.textContent = String(value ?? "");
  return div.innerHTML;
}

export function cloneItemData(itemLike) {
  const data = typeof itemLike?.toObject === "function"
    ? itemLike.toObject()
    : foundry.utils.deepClone(itemLike ?? {});
  if (!data || typeof data !== "object") return null;
  const copy = foundry.utils.deepClone(data);
  delete copy._id;
  delete copy._stats;
  return copy;
}

export function itemLabel(data, fallback = "Item") {
  const sys = data?.system ?? data ?? {};
  return String(data?.name ?? sys.label ?? sys.nom ?? sys.name ?? fallback).trim() || fallback;
}

export function classSlug(data) {
  const sys = data?.system ?? data ?? {};
  return norm(sys.slug ?? sys.label ?? sys.nom ?? sys.name ?? data?.name ?? "classe");
}

export function classItems(actor) {
  const contents = actor?.items?.contents ?? Array.from(actor?.items ?? []);
  return contents.filter(item => String(item?.type ?? "").toLowerCase() === "classe");
}

export function raceItem(actor) {
  return actor?.items?.find?.(item => String(item?.type ?? "").toLowerCase() === "race") ?? null;
}

export function systemRace(actor, override = null) {
  if (override) return override;
  const item = raceItem(actor);
  if (item) return item;
  const sys = actor?.system ?? {};
  return {
    name: sys.race ?? sys.details_race?.label ?? sys.details_race?.name ?? "Race",
    system: sys.details_race ?? {}
  };
}

export function canonicalMulticlass(actor) {
  const value = actor?.system?.multiclasse;
  if (!value || typeof value !== "object") return null;
  if (Number(value.schema) !== MULTICLASS_SCHEMA || value.enabled !== true || !Array.isArray(value.classes)) return null;
  return value;
}

export function canonicalClassStates(actor) {
  const state = canonicalMulticlass(actor);
  return state ? state.classes.filter(entry => entry && typeof entry === "object") : [];
}

export function canonicalClassState(actor, itemOrSlug) {
  const states = canonicalClassStates(actor);
  const itemId = typeof itemOrSlug === "object" ? itemOrSlug?.id : "";
  const slug = typeof itemOrSlug === "object" ? classSlug(itemOrSlug) : norm(itemOrSlug);
  return states.find(entry =>
    (itemId && String(entry.itemId ?? "") === String(itemId))
    || (slug && norm(entry.slug) === slug)
  ) ?? null;
}

export function canonicalClassLevel(actor, itemOrSlug, fallback = 1) {
  const entry = canonicalClassState(actor, itemOrSlug);
  return Math.max(1, Math.floor(num(entry?.level, fallback)));
}

export function canonicalClassXp(actor, itemOrSlug, fallback = 0) {
  const entry = canonicalClassState(actor, itemOrSlug);
  return Math.max(0, Math.floor(num(entry?.xp, fallback)));
}

export function multiclassEnabled(actor) {
  if (actor?.type !== "personnage") return false;
  return canonicalMulticlass(actor)?.enabled === true || classItems(actor).length > 1;
}

export function pickClassAlignment(actor, classData) {
  try {
    if (typeof globalThis.add2ePickClassAlignment === "function") {
      return globalThis.add2ePickClassAlignment(actor, classData?.system ?? classData ?? {});
    }
  } catch (error) {
    warn("[ALIGNMENT_PICK_ERROR]", error);
  }
  return actor?.system?.alignement ?? "";
}

try {
  globalThis.add2eCanonicalMulticlass = canonicalMulticlass;
  globalThis.add2eCanonicalClassStates = canonicalClassStates;
  globalThis.add2eCanonicalClassState = canonicalClassState;
  globalThis.add2eCanonicalClassLevel = canonicalClassLevel;
  globalThis.add2eCanonicalClassXp = canonicalClassXp;
} catch (_error) {}
