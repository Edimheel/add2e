// ADD2E — Définitions boutiques reconstruites.
// Version : 2026-06-14-shop-flags-v2

export const SHOP_REBUILD_VERSION = "2026-06-14-shop-flags-v2";
export const SHOP_SCOPE = "add2e";

export const COINS = [
  { key: "pp", label: "PP", pc: 500 },
  { key: "po", label: "PO", pc: 100 },
  { key: "pe", label: "PE", pc: 50 },
  { key: "pa", label: "PA", pc: 10 },
  { key: "pc", label: "PC", pc: 1 }
];

export function low(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export function key(value) {
  return low(value).replace(/[’']/g, "_").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export function esc(value) {
  const div = document.createElement("div");
  div.textContent = String(value ?? "");
  return div.innerHTML;
}

export function num(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}
