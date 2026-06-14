// ADD2E — Bootstrap monnaie, UI boutiques et achat joueur isolé.
// Version : 2026-06-14-shop-bootstrap-v6-buy-diagnostics

import { COINS as VENDOR_COINS, buyLocal } from "./22a-vendor-core.mjs";
import { COINS as ARMORER_COINS } from "./22c-armorer-core.mjs";

export const ADD2E_VENDOR_PLAYER_BUY = "ADD2E_VENDOR_PLAYER_BUY_V2";
export const ADD2E_VENDOR_PLAYER_BUY_RESULT = "ADD2E_VENDOR_PLAYER_BUY_RESULT_V2";
const LEGACY_BUY_REQUEST = "ADD2E_VENDOR_BUY_REQUEST";
const LEGACY_BUY_RESULT = "ADD2E_VENDOR_BUY_RESULT";
const DIAG = "[ADD2E][SHOP][BUY_DIAG]";

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
  return game.user?.isGM && (typeof game.user.isActiveGM === "boolean" ? game.user.isActiveGM : game.users?.activeGM?.id === game.user.id || !game.users?.activeGM);
}

function diag(label, data = {}) {
  console.warn(`${DIAG}[${label}]`, {
    user: game.user?.name,
    userId: game.user?.id,
    isGM: game.user?.isGM,
    activeGM: game.users?.activeGM?.id,
    version: "2026-06-14-shop-bootstrap-v6-buy-diagnostics",
    ...data
  });
}

export function normalizeShopCurrency() {
  normalizeCoins(VENDOR_COINS);
  normalizeCoins(ARMORER_COINS);
  game.add2e = game.add2e ?? {};
  game.add2e.shopCurrencyVersion = "2026-06-14-shop-bootstrap-v6-buy-diagnostics";
  game.add2e.shopBuyDiagnosticsVersion = "2026-06-14-shop-bootstrap-v6-buy-diagnostics";
}

function loadStylesheetOnce(id, href) {
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

export function loadShopStylesheet() {
  loadStylesheetOnce("add2e-shop-ui-stylesheet", "systems/add2e/styles/add2e-shops.css");
  loadStylesheetOnce("add2e-shop-ui-compact-overrides", "systems/add2e/styles/add2e-shops-compact-overrides.css");
}

function registerIsolatedPlayerBuySocket() {
  if (globalThis.__ADD2E_VENDOR_PLAYER_BUY_V2_SOCKET) {
    diag("SOCKET_ALREADY_REGISTERED");
    return;
  }
  globalThis.__ADD2E_VENDOR_PLAYER_BUY_V2_SOCKET = true;
  diag("SOCKET_REGISTERED");
  game.socket?.on?.("system.add2e", async data => {
    if (!data || typeof data !== "object") return;
    if (data.type === LEGACY_BUY_REQUEST || data.type === LEGACY_BUY_RESULT) {
      diag("LEGACY_EVENT_SEEN", { type: data.type, requestId: data.requestId, sourceUserId: data.userId, vendorId: data.vendorId, buyerId: data.buyerId, itemId: data.itemId, quantity: data.quantity });
      return;
    }
    if (data.type === ADD2E_VENDOR_PLAYER_BUY_RESULT) {
      diag("RESULT_SEEN", { requestId: data.requestId, targetUserId: data.userId, ok: data.ok, message: data.message });
      if (data.userId === game.user?.id) (data.ok ? ui.notifications?.info : ui.notifications?.warn)?.(data.message ?? (data.ok ? "Achat effectué." : "Achat impossible."));
      return;
    }
    if (data.type !== ADD2E_VENDOR_PLAYER_BUY) return;
    diag("REQUEST_SEEN", { requestId: data.requestId, sourceUserId: data.userId, vendorId: data.vendorId, buyerId: data.buyerId, buyerUuid: data.buyerUuid, itemId: data.itemId, quantity: data.quantity, responsibleGM: isResponsibleGM() });
    if (!isResponsibleGM()) return;
    normalizeShopCurrency();
    const vendor = game.actors?.get(data.vendorId) ?? null;
    const buyer = data.buyerUuid ? await fromUuid(data.buyerUuid).catch(err => { diag("BUYER_UUID_RESOLVE_ERROR", { requestId: data.requestId, buyerUuid: data.buyerUuid, message: err?.message }); return null; }) : game.actors?.get(data.buyerId) ?? null;
    const item = vendor?.items?.get(data.itemId) ?? null;
    diag("GM_RESOLVED", { requestId: data.requestId, vendor: vendor?.name, vendorId: vendor?.id, buyer: buyer?.name, buyerId: buyer?.id, buyerUuid: buyer?.uuid, buyerOwnership: buyer?.ownership, item: item?.name, itemId: item?.id, quantity: data.quantity });
    let result = { ok: false, message: "Achat impossible." };
    try {
      result = await buyLocal({ vendor, buyer, item, quantity: data.quantity }, { confirm: false });
      diag("GM_BUYLOCAL_RESULT", { requestId: data.requestId, ok: result.ok, message: result.message });
    } catch (err) {
      diag("GM_BUYLOCAL_ERROR", { requestId: data.requestId, message: err?.message, stack: err?.stack });
      result = { ok: false, message: err?.message ?? "Erreur pendant l’achat." };
    }
    game.socket?.emit?.("system.add2e", { type: ADD2E_VENDOR_PLAYER_BUY_RESULT, requestId: data.requestId, userId: data.userId, ok: !!result.ok, message: result.message });
  });
}

normalizeShopCurrency();
Hooks.once("ready", () => { normalizeShopCurrency(); loadShopStylesheet(); registerIsolatedPlayerBuySocket(); });