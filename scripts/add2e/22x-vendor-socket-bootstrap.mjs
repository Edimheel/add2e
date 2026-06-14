// ADD2E — Bootstrap monnaie, UI boutiques et achats joueurs isolés.
// Version : 2026-06-14-shop-bootstrap-v9-disable-player-move-xp-item-recalc

import { COINS as VENDOR_COINS, buyLocal as vendorBuyLocal } from "./22a-vendor-core.mjs";
import { COINS as ARMORER_COINS, buyLocal as armorerBuyLocal, getArmorerDisplayItems, itemKey as armorerItemKey } from "./22c-armorer-core.mjs";

export const ADD2E_VENDOR_PLAYER_BUY = "ADD2E_VENDOR_PLAYER_BUY_V2";
export const ADD2E_VENDOR_PLAYER_BUY_RESULT = "ADD2E_VENDOR_PLAYER_BUY_RESULT_V2";
export const ADD2E_ARMORER_PLAYER_BUY = "ADD2E_ARMORER_PLAYER_BUY_V2";
export const ADD2E_ARMORER_PLAYER_BUY_RESULT = "ADD2E_ARMORER_PLAYER_BUY_RESULT_V2";
const LEGACY_BUY_REQUEST = "ADD2E_VENDOR_BUY_REQUEST";
const LEGACY_BUY_RESULT = "ADD2E_VENDOR_BUY_RESULT";
const LEGACY_ARMORER_REQUEST = "ADD2E_ARMORER_BUY_REQUEST";
const LEGACY_ARMORER_RESULT = "ADD2E_ARMORER_BUY_RESULT";
const DIAG = "[ADD2E][SHOP][BUY_DIAG]";
const PERM = "[ADD2E][SHOP][PERMISSION_DIAG]";
const VENDOR_NAME = "Marchand de composants et projectiles";
const ARMORER_NAME = "Armurier";

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
  console.warn(`${DIAG}[${label}]`, { user: game.user?.name, userId: game.user?.id, isGM: game.user?.isGM, activeGM: game.users?.activeGM?.id, version: "2026-06-14-shop-bootstrap-v9-disable-player-move-xp-item-recalc", ...data });
}

function permissionDiag(label, data = {}) {
  console.warn(`${PERM}[${label}]`, { user: game.user?.name, userId: game.user?.id, isGM: game.user?.isGM, version: "2026-06-14-shop-bootstrap-v9-disable-player-move-xp-item-recalc", ...data });
}

function isShopDoc(actor) {
  return actor?.name === VENDOR_NAME || actor?.name === ARMORER_NAME || actor?.getFlag?.("add2e", "isVendor") === true || actor?.getFlag?.("add2e", "isArmorer") === true;
}

function installPlayerUpdateDiagnostics() {
  if (game.user?.isGM || globalThis.__ADD2E_SHOP_PLAYER_UPDATE_DIAG_V2) return;
  globalThis.__ADD2E_SHOP_PLAYER_UPDATE_DIAG_V2 = true;
  const ActorClass = CONFIG?.Actor?.documentClass ?? globalThis.Actor;
  const ItemClass = CONFIG?.Item?.documentClass ?? globalThis.Item;
  const patch = (proto, method, label, predicate) => {
    if (!proto || typeof proto[method] !== "function" || proto[`__add2eShopDiag_${method}_${label}`]) return;
    proto[`__add2eShopDiag_${method}_${label}`] = true;
    const original = proto[method];
    proto[method] = function(...args) {
      try { if (predicate(this)) permissionDiag(label, { document: this.name, documentId: this.id, uuid: this.uuid, update: args?.[0], options: args?.[1], stack: new Error().stack }); }
      catch (err) { console.warn(`${PERM}[DIAG_ERROR]`, err); }
      return original.apply(this, args);
    };
  };
  patch(ActorClass?.prototype, "update", "PLAYER_SHOP_ACTOR_UPDATE_ATTEMPT", doc => isShopDoc(doc));
  patch(ItemClass?.prototype, "update", "PLAYER_SHOP_ITEM_UPDATE_ATTEMPT", doc => isShopDoc(doc?.parent));
  permissionDiag("PLAYER_UPDATE_DIAGNOSTICS_INSTALLED");
}

function hookCallback(entry) {
  if (typeof entry === "function") return entry;
  return entry?.fn ?? entry?.callback ?? entry?.hook ?? null;
}

function isMoveXpItemRecalcHook(entry) {
  const fn = hookCallback(entry);
  if (typeof fn !== "function") return false;
  let src = "";
  try { src = Function.prototype.toString.call(fn); } catch (_e) { return false; }
  return src.includes("recalc(actor") && src.includes("mode: \"movement\"") && src.includes("actor.type === \"personnage\"");
}

function removeMoveXpItemRecalcHooksForPlayers() {
  if (game.user?.isGM || globalThis.__ADD2E_MOVE_XP_PLAYER_ITEM_RECALC_REMOVED_V1) return;
  globalThis.__ADD2E_MOVE_XP_PLAYER_ITEM_RECALC_REMOVED_V1 = true;
  const buckets = [];
  for (const hookName of ["createItem", "updateItem", "deleteItem"]) {
    const direct = Hooks?._hooks?.[hookName];
    const legacy = Hooks?.events?.[hookName];
    if (Array.isArray(direct)) buckets.push({ hookName, list: direct, source: "_hooks" });
    if (Array.isArray(legacy) && legacy !== direct) buckets.push({ hookName, list: legacy, source: "events" });
  }
  const removed = [];
  for (const bucket of buckets) {
    const before = bucket.list.length;
    for (let i = bucket.list.length - 1; i >= 0; i--) {
      if (isMoveXpItemRecalcHook(bucket.list[i])) bucket.list.splice(i, 1);
    }
    const count = before - bucket.list.length;
    if (count > 0) removed.push({ hookName: bucket.hookName, source: bucket.source, count });
  }
  permissionDiag("MOVE_XP_PLAYER_ITEM_RECALC_HOOK_REMOVAL", { removed });
}

export function normalizeShopCurrency() {
  normalizeCoins(VENDOR_COINS);
  normalizeCoins(ARMORER_COINS);
  game.add2e = game.add2e ?? {};
  game.add2e.shopCurrencyVersion = "2026-06-14-shop-bootstrap-v9-disable-player-move-xp-item-recalc";
  game.add2e.shopBuyDiagnosticsVersion = "2026-06-14-shop-bootstrap-v9-disable-player-move-xp-item-recalc";
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

async function resolveArmorerItem(armorer, data) {
  const direct = data.itemId ? armorer?.items?.get(data.itemId) : null;
  if (direct) return direct;
  const items = await getArmorerDisplayItems(armorer);
  return items.find(i => String(i.id) === String(data.itemId) || (data.itemKey && armorerItemKey(i) === data.itemKey)) ?? null;
}

function registerIsolatedPlayerBuySocket() {
  if (globalThis.__ADD2E_SHOP_PLAYER_BUY_SOCKET_V8) { diag("SOCKET_ALREADY_REGISTERED"); return; }
  globalThis.__ADD2E_SHOP_PLAYER_BUY_SOCKET_V8 = true;
  diag("SOCKET_REGISTERED");
  game.socket?.on?.("system.add2e", async data => {
    if (!data || typeof data !== "object") return;
    if ([LEGACY_BUY_REQUEST, LEGACY_BUY_RESULT, LEGACY_ARMORER_REQUEST, LEGACY_ARMORER_RESULT].includes(data.type)) {
      diag("LEGACY_EVENT_SEEN", { type: data.type, requestId: data.requestId, sourceUserId: data.userId, vendorId: data.vendorId, armorerId: data.armorerId, buyerId: data.buyerId, itemId: data.itemId, itemKey: data.itemKey, quantity: data.quantity });
      return;
    }
    if (data.type === ADD2E_VENDOR_PLAYER_BUY_RESULT || data.type === ADD2E_ARMORER_PLAYER_BUY_RESULT) {
      diag("RESULT_SEEN", { type: data.type, requestId: data.requestId, targetUserId: data.userId, ok: data.ok, message: data.message });
      if (data.userId === game.user?.id) (data.ok ? ui.notifications?.info : ui.notifications?.warn)?.(data.message ?? (data.ok ? "Achat effectué." : "Achat impossible."));
      return;
    }
    if (data.type === ADD2E_VENDOR_PLAYER_BUY) return handleVendorBuy(data);
    if (data.type === ADD2E_ARMORER_PLAYER_BUY) return handleArmorerBuy(data);
  });
}

async function handleVendorBuy(data) {
  diag("VENDOR_REQUEST_SEEN", { requestId: data.requestId, sourceUserId: data.userId, vendorId: data.vendorId, buyerId: data.buyerId, buyerUuid: data.buyerUuid, itemId: data.itemId, quantity: data.quantity, responsibleGM: isResponsibleGM() });
  if (!isResponsibleGM()) return;
  normalizeShopCurrency();
  const vendor = game.actors?.get(data.vendorId) ?? null;
  const buyer = data.buyerUuid ? await fromUuid(data.buyerUuid).catch(err => { diag("BUYER_UUID_RESOLVE_ERROR", { requestId: data.requestId, buyerUuid: data.buyerUuid, message: err?.message }); return null; }) : game.actors?.get(data.buyerId) ?? null;
  const item = vendor?.items?.get(data.itemId) ?? null;
  let result = { ok: false, message: "Achat impossible." };
  try { result = await vendorBuyLocal({ vendor, buyer, item, quantity: data.quantity }, { confirm: false }); diag("GM_VENDOR_BUYLOCAL_RESULT", { requestId: data.requestId, ok: result.ok, message: result.message }); }
  catch (err) { diag("GM_VENDOR_BUYLOCAL_ERROR", { requestId: data.requestId, message: err?.message, stack: err?.stack }); result = { ok: false, message: err?.message ?? "Erreur pendant l’achat." }; }
  game.socket?.emit?.("system.add2e", { type: ADD2E_VENDOR_PLAYER_BUY_RESULT, requestId: data.requestId, userId: data.userId, ok: !!result.ok, message: result.message });
}

async function handleArmorerBuy(data) {
  diag("ARMORER_REQUEST_SEEN", { requestId: data.requestId, sourceUserId: data.userId, armorerId: data.armorerId, buyerId: data.buyerId, buyerUuid: data.buyerUuid, itemId: data.itemId, itemKey: data.itemKey, quantity: data.quantity, responsibleGM: isResponsibleGM() });
  if (!isResponsibleGM()) return;
  normalizeShopCurrency();
  const armorer = game.actors?.get(data.armorerId) ?? null;
  const buyer = data.buyerUuid ? await fromUuid(data.buyerUuid).catch(err => { diag("ARMORER_BUYER_UUID_RESOLVE_ERROR", { requestId: data.requestId, buyerUuid: data.buyerUuid, message: err?.message }); return null; }) : game.actors?.get(data.buyerId) ?? null;
  const item = await resolveArmorerItem(armorer, data);
  diag("GM_ARMORER_RESOLVED", { requestId: data.requestId, armorer: armorer?.name, buyer: buyer?.name, buyerUuid: buyer?.uuid, item: item?.name, itemId: item?.id, itemKey: item ? armorerItemKey(item) : null, quantity: data.quantity });
  let result = { ok: false, message: "Achat armurier impossible." };
  try { result = await armorerBuyLocal({ armorer, buyer, item, quantity: data.quantity }, { confirm: false }); diag("GM_ARMORER_BUYLOCAL_RESULT", { requestId: data.requestId, ok: result.ok, message: result.message }); }
  catch (err) { diag("GM_ARMORER_BUYLOCAL_ERROR", { requestId: data.requestId, message: err?.message, stack: err?.stack }); result = { ok: false, message: err?.message ?? "Erreur pendant l’achat armurier." }; }
  game.socket?.emit?.("system.add2e", { type: ADD2E_ARMORER_PLAYER_BUY_RESULT, requestId: data.requestId, userId: data.userId, ok: !!result.ok, message: result.message });
}

normalizeShopCurrency();
Hooks.once("ready", () => { normalizeShopCurrency(); loadShopStylesheet(); installPlayerUpdateDiagnostics(); removeMoveXpItemRecalcHooksForPlayers(); registerIsolatedPlayerBuySocket(); });