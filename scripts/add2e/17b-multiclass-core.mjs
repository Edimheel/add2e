// ADD2E — Multiclassage : helpers noyau
// Version : 2026-06-13-multiclass-core-v1

export const MULTICLASS_VERSION = "2026-06-13-multiclass-split-v1";
export const INTERNAL = "add2eMulticlassInternal";
export const TAG = "[ADD2E][MULTICLASSE]";

export function warn(label, data = {}) { console.warn(`${TAG}${label}`, data); }

export function num(value, fallback = 0) {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (value && typeof value === "object") {
    for (const key of ["value", "valeur", "total", "current", "base", "max", "niveau", "level", "xp"]) {
      if (value[key] !== undefined && value[key] !== null && typeof value[key] !== "object") return num(value[key], fallback);
    }
  }
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;
  const n = Number(raw.replace(/\s+/g, "").replace(/\./g, "").replace(/,/g, ".").replace(/[^0-9.+\-]/g, ""));
  return Number.isFinite(n) ? n : fallback;
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
    .replace(/^_|_$/g, "");
}

export function esc(value) {
  const div = document.createElement("div");
  div.textContent = String(value ?? "");
  return div.innerHTML;
}

export function cloneItemData(itemLike) {
  const data = typeof itemLike?.toObject === "function" ? itemLike.toObject() : foundry.utils.deepClone(itemLike ?? {});
  if (!data || typeof data !== "object") return null;
  const copy = foundry.utils.deepClone(data);
  copy._id = undefined;
  copy._stats = undefined;
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
  return (actor?.items?.contents ?? Array.from(actor?.items ?? []))
    .filter(i => String(i.type || "").toLowerCase() === "classe");
}

export function raceItem(actor) {
  return actor?.items?.find?.(i => String(i.type || "").toLowerCase() === "race") ?? null;
}

export function systemRace(actor, override = null) {
  if (override) return override;
  const item = raceItem(actor);
  if (item) return item;
  const sys = actor?.system ?? {};
  return { name: sys.race ?? sys.details_race?.label ?? sys.details_race?.name ?? "Race", system: sys.details_race ?? {} };
}

export function multiclassEnabled(actor) {
  return actor?.type === "personnage" && (actor.system?.multiclasse?.enabled === true || classItems(actor).length > 1);
}

export function pickClassAlignment(actor, classData) {
  try {
    if (typeof add2ePickClassAlignment === "function") return add2ePickClassAlignment(actor, classData?.system ?? classData ?? {});
  } catch (err) { warn("[ALIGNMENT_PICK_ERROR]", err); }
  return actor?.system?.alignement ?? "";
}
