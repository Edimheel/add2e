// ADD2E — Bootstrap socket et monnaie marchands.
// Version : 2026-06-14-shop-currency-bootstrap-v1

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
  game.add2e.shopCurrencyVersion = "2026-06-14-shop-currency-bootstrap-v1";
  game.add2e.shopCurrency = {
    pcParPa: 100,
    paParPo: 100,
    poParPp: 100
  };
}

normalizeShopCurrency();

Hooks.once("ready", () => {
  normalizeShopCurrency();
  registerSockets();
});
