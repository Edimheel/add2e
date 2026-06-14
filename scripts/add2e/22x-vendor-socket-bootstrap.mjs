// ADD2E — Bootstrap socket, monnaie et UI boutiques.
// Version : 2026-06-14-shop-bootstrap-v4-isolated-player-buy

import { registerSockets, COINS as VENDOR_COINS, buyLocal } from "./22a-vendor-core.mjs";
import { COINS as ARMORER_COINS } from "./22c-armorer-core.mjs";

export const ADD2E_VENDOR_PLAYER_BUY = "ADD2E_VENDOR_PLAYER_BUY_V2";
export const ADD2E_VENDOR_PLAYER_BUY_RESULT = "ADD2E_VENDOR_PLAYER_BUY_RESULT_V2";

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

function isResponsibleGM() {
  if (!game.user?.isGM) return false;
  if (typeof game.user.isActiveGM === "boolean") return game.user.isActiveGM;
  return game.users?.activeGM?.id === game.user.id || !game.users?.activeGM;
}

export function normalizeShopCurrency() {
  normalizeCoins(VENDOR_COINS);
  normalizeCoins(ARMORER_COINS);
  game.add2e = game.add2e ?? {};
  game.add2e.shopCurrencyVersion = "2026-06-14-shop-bootstrap-v4-isolated-player-buy";
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

function registerIsolatedPlayerBuySocket() {
  if (globalThis.__ADD2E_VENDOR_PLAYER_BUY_V2_SOCKET) return;
  globalThis.__ADD2E_VENDOR_PLAYER_BUY_V2_SOCKET = true;
  game.socket?.on?.("system.add2e", async data => {
    if (!data || typeof data !== "object") return;
    if (data.type === ADD2E_VENDOR_PLAYER_BUY_RESULT) {
      if (data.userId !== game.user?.id) return;
      data.ok ? ui.notifications?.info?.(data.message ?? "Achat effectué.") : ui.notifications?.warn?.(data.message ?? "Achat impossible.");
      return;
    }
    if (data.type !== ADD2E_VENDOR_PLAYER_BUY || !isResponsibleGM()) return;
    normalizeShopCurrency();
    const vendor = game.actors?.get(data.vendorId) ?? null;
    const buyer = data.buyerUuid ? await fromUuid(data.buyerUuid).catch(() => null) : game.actors?.get(data.buyerId) ?? null;
    const item = vendor?.items?.get(data.itemId) ?? null;
    let result = { ok: false, message: "Achat impossible." };
    try {
      result = await buyLocal({ vendor, buyer, item, quantity: data.quantity }, { confirm: false });
    } catch (err) {
      result = { ok: false, message: err?.message ?? "Erreur pendant l’achat." };
    }
    game.socket?.emit?.("system.add2e", {
      type: ADD2E_VENDOR_PLAYER_BUY_RESULT,
      requestId: data.requestId,
      userId: data.userId,
      ok: !!result.ok,
      message: result.message
    });
  });
}

normalizeShopCurrency();

Hooks.once("ready", () => {
  normalizeShopCurrency();
  loadShopStylesheet();
  registerSockets();
  registerIsolatedPlayerBuySocket();
});