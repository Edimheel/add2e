// ADD2E — Bootstrap socket, monnaie et UI boutiques.
// Version : 2026-06-14-shop-bootstrap-v3-compact-ui

import { registerSockets, COINS as VENDOR_COINS } from "./22a-vendor-core.mjs";
import { COINS as ARMORER_COINS } from "./22c-armorer-core.mjs";

const ADD2E_CURRENCY = [
  { key: "pp", label: "PP", pc: 1000000 },
  { key: "po", label: "PO", pc: 10000 },
  { key: "pa", label: "PA", pc: 100 },
  { key: "pc", label: "PC", pc: 1 }
];

function normalizeCoins(target) {
  if (!Array.isArray(target)) return;
  target.splice(0, target.length, ...ADD2E_CURRENCY.map(c => ({ ...c })));
}

export function normalizeShopCurrency() {
  normalizeCoins(VENDOR_COINS);
  normalizeCoins(ARMORER_COINS);
  game.add2e = game.add2e ?? {};
  game.add2e.shopCurrencyVersion = "2026-06-14-shop-bootstrap-v3-compact-ui";
  game.add2e.shopCurrency = { pcParPa: 100, paParPo: 100, poParPp: 100 };
}

function loadStylesheetOnce(id, href) {
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.type = "text/css";
  link.href = href;
  document.head.appendChild(link);
}

export function loadShopStylesheet() {
  loadStylesheetOnce("add2e-shop-ui-stylesheet", "systems/add2e/styles/add2e-shops.css");
  loadStylesheetOnce("add2e-shop-ui-compact-overrides", "systems/add2e/styles/add2e-shops-compact-overrides.css");
}

normalizeShopCurrency();

Hooks.once("ready", () => {
  normalizeShopCurrency();
  loadShopStylesheet();
  registerSockets();
});