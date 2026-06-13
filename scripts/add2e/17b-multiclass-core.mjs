// ADD2E — Multiclassage : helpers noyau
// Version : 2026-06-13-multiclass-core-v1

export const MULTICLASS_VERSION = "2026-06-13-multiclass-split-v1";
export const INTERNAL = "add2eMulticlassInternal";
export const TAG = "[ADD2E][MULTICLASSE]";

export function warn(label, data = {}) { console.warn(`${TAG}${label}`, data); }

export function num(value, fallback = 0) {
  const n = Number(String(value ?? "").replace(/[^0-9.+-]/g, ""));
  return Number.isFinite(n) ? n : fallback;
}

export function norm(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export function esc(value) {
  const div = document.createElement("div");
  div.textContent = String(value ?? "");
  return div.innerHTML;
}
