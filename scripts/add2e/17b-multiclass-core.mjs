// ADD2E — Multiclassage : noyau canonique
// Source de vérité : chaque Item embarqué de type "classe".
// La définition et la progression (system.niveau / system.xp) vivent ensemble.

export const MULTICLASS_VERSION = "2026-06-25-item-progression-v2";
export const MULTICLASS_SCHEMA = 3;
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

export function classItem(actor, itemOrSlug) {
  if (!actor) return null;
  const itemId = typeof itemOrSlug === "object" ? String(itemOrSlug?.id ?? "") : "";
  const slug = typeof itemOrSlug === "object" ? classSlug(itemOrSlug) : norm(itemOrSlug);
  return classItems(actor).find(item =>
    (itemId && String(item.id ?? "") === itemId)
    || (slug && classSlug(item) === slug)
  ) ?? null;
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

function exactInteger(value, minimum = 0) {
  const parsed = num(value, NaN);
  if (!Number.isFinite(parsed)) return null;
  const integer = Math.floor(parsed);
  return integer >= minimum ? integer : null;
}

/**
 * Lit exclusivement les champs de progression de l'Item classe.
 * Aucun champ de l'acteur n'est consulté ici.
 */
export function classProgression(item, { level = 1, xp = 0 } = {}) {
  const system = item?.system ?? {};
  const itemLevel = exactInteger(system.niveau, 1);
  const itemXp = exactInteger(system.xp, 0);
  return {
    level: itemLevel ?? Math.max(1, Math.floor(num(level, 1))),
    xp: itemXp ?? Math.max(0, Math.floor(num(xp, 0))),
    hasLevel: itemLevel !== null,
    hasXp: itemXp !== null
  };
}

export function classProgressionUpdate(item, { level, xp } = {}) {
  const update = { _id: item?.id };
  if (!update._id) return null;
  if (level !== undefined) update["system.niveau"] = Math.max(1, Math.floor(num(level, 1)));
  if (xp !== undefined) update["system.xp"] = Math.max(0, Math.floor(num(xp, 0)));
  return update;
}

/**
 * Métadonnées d'acteur uniquement : elles ne portent jamais de progression.
 */
export function canonicalMulticlass(actor) {
  if (actor?.type !== "personnage" || classItems(actor).length <= 1) return null;
  const stored = actor?.system?.multiclasse;
  return {
    schema: MULTICLASS_SCHEMA,
    enabled: true,
    mode: stored?.mode === "racial" ? "racial" : "racial",
    xpSplit: stored?.xpSplit === "equal" ? "equal" : "equal",
    label: String(stored?.label ?? "")
  };
}

export function canonicalClassState(actor, itemOrSlug) {
  const item = typeof itemOrSlug === "object" && itemOrSlug?.type === "classe"
    ? itemOrSlug
    : classItem(actor, itemOrSlug);
  if (!item) return null;
  const progression = classProgression(item);
  return {
    itemId: item.id ?? null,
    uuid: item.uuid ?? null,
    name: item.name ?? itemLabel(item, "Classe"),
    slug: classSlug(item),
    level: progression.level,
    xp: progression.xp,
    hasLevel: progression.hasLevel,
    hasXp: progression.hasXp
  };
}

export function canonicalClassStates(actor) {
  return classItems(actor).map(item => canonicalClassState(actor, item)).filter(Boolean);
}

export function canonicalClassLevel(actor, itemOrSlug, fallback = 1) {
  const state = canonicalClassState(actor, itemOrSlug);
  return state?.hasLevel ? state.level : Math.max(1, Math.floor(num(fallback, 1)));
}

export function canonicalClassXp(actor, itemOrSlug, fallback = 0) {
  const state = canonicalClassState(actor, itemOrSlug);
  return state?.hasXp ? state.xp : Math.max(0, Math.floor(num(fallback, 0)));
}

export function multiclassEnabled(actor) {
  return actor?.type === "personnage" && classItems(actor).length > 1;
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
  globalThis.add2eClassProgression = classProgression;
} catch (_error) {}