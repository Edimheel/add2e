// ADD2E — Orchestration des boutiques sur le moteur SHOP commun.
// Les catalogues restent dans les compendiums ; les Actors ne portent que leur état commercial.
// Compatible Foundry V13/V14/V15.

import {
  ADD2E_VENDOR_VERSION,
  VENDOR_SETTING,
  getShopType,
  registerRecoveryHooks,
  patchActorSheetMoney,
  registerGlobals,
  findVendor,
  createVendor,
  moveToFolder as moveVendorToFolder,
  updateTokenSize as updateVendorTokenSize,
  ensureStock as ensureVendorStock
} from "./22a-vendor-core.mjs";

import {
  bindAllVendorTokens,
  patchVendorTokenClick,
  registerUiGlobals,
  registerVendorDirectoryButton
} from "./22b-vendor-app.mjs";

import {
  ADD2E_ARMORER_VERSION,
  ARMORER_SETTING,
  registerGlobals as registerArmorerGlobals,
  findArmorer,
  createArmorer,
  moveToFolder as moveArmorerToFolder,
  updateTokenSize as updateArmorerTokenSize,
  ensureStock as ensureArmorerStock
} from "./22c-armorer-core.mjs";

import {
  bindAllArmorerTokens,
  patchArmorerTokenClick,
  registerArmorerUiGlobals,
  registerArmorerDirectoryButton
} from "./22d-armorer-app.mjs";

import {
  ADD2E_CONSUMABLES_VERSION,
  registerGlobals as registerConsumablesGlobals
} from "./22e-consumables-core.mjs";

const ADD2E_SHOP_ORCHESTRATION_VERSION = "2026-08-08-shop-compendium-catalog-v6";
const ADD2E_SHOP_HP_VERSION = "2026-06-15-shop-hp-one-multiclass-v1";
const ADD2E_SHOP_HP = 1;
const SPELL_COMPONENTS_SETTING = "gestionComposantsSorts";
const ADD2E_SHOP_TILE_VERSION = "2026-08-08-shop-tiles-v5";
const ADD2E_SHOP_TILE_FLAG_SCOPE = "add2e";
const ADD2E_SHOP_TILE_FLAG_KEY = "shopType";
const ADD2E_SHOP_TILE_TYPES = new Set(["vendor", "general", "armorer"]);
const ADD2E_SHOP_TILE_CLICK_DISTANCE = 8;
const ADD2E_SHOP_TILE_CLICK_DURATION = 1200;
const SHOP_TILE_OPEN_LOCKS = new Map();
const SHOP_TILE_CANVAS_STATE = { stage: null, down: null, onDown: null, onUp: null, onCancel: null };
let shopActorsHiddenHookRegistered = false;
let shopTileHooksRegistered = false;

function isShopActor(actor) {
  return !!getShopType(actor);
}

function shopTokenDisplayAlwaysValue() {
  return CONST?.TOKEN_DISPLAY_MODES?.ALWAYS ?? 50;
}

function shopHitPointUpdate() {
  return {
    "system.pdv": ADD2E_SHOP_HP,
    "system.pv": ADD2E_SHOP_HP,
    "system.points_de_coup": ADD2E_SHOP_HP,
    "system.points_de_vie": ADD2E_SHOP_HP,
    "system.pv_max": ADD2E_SHOP_HP,
    "system.hp.value": ADD2E_SHOP_HP,
    "system.hp.max": ADD2E_SHOP_HP,
    "system.attributes.hp.value": ADD2E_SHOP_HP,
    "system.attributes.hp.max": ADD2E_SHOP_HP,
    "flags.add2e.shopHpVersion": ADD2E_SHOP_HP_VERSION
  };
}

function shopActorNeedsHitPointUpdate(actor) {
  const system = actor?.system ?? {};
  const values = [system.pdv, system.pv, system.points_de_coup, system.points_de_vie, system.pv_max, system.hp?.value, system.hp?.max, system.attributes?.hp?.value, system.attributes?.hp?.max];
  return actor?.getFlag?.("add2e", "shopHpVersion") !== ADD2E_SHOP_HP_VERSION || values.some(value => Number(value) !== ADD2E_SHOP_HP);
}

async function enforceShopHitPoints() {
  if (!game.user?.isGM) return false;
  for (const actor of game.actors ?? []) {
    if (!isShopActor(actor) || !shopActorNeedsHitPointUpdate(actor)) continue;
    await actor.update(shopHitPointUpdate(), { add2eReason: "shop-hit-points-one" });
  }
  game.add2e = game.add2e ?? {};
  game.add2e.shopHpVersion = ADD2E_SHOP_HP_VERSION;
  return true;
}

async function enforceShopActors() {
  if (!game.user?.isGM) return false;

  let vendor = await findVendor();
  if (!vendor) vendor = await createVendor({ force: true });
  if (vendor) {
    await moveVendorToFolder(vendor);
    await updateVendorTokenSize(vendor);
    await ensureVendorStock(vendor);
  }

  let armorer = findArmorer();
  if (!armorer) armorer = await createArmorer({ force: true });
  if (armorer) {
    await moveArmorerToFolder(armorer);
    await updateArmorerTokenSize(armorer);
    await ensureArmorerStock(armorer);
  }

  return true;
}

async function enforceShopTokenPresentation() {
  if (!game.user?.isGM) return false;
  const displayName = shopTokenDisplayAlwaysValue();
  for (const actor of game.actors ?? []) {
    if (!isShopActor(actor)) continue;
    const update = {};
    if (actor.prototypeToken?.displayName !== displayName) update["prototypeToken.displayName"] = displayName;
    if (actor.prototypeToken?.lockRotation !== true) update["prototypeToken.lockRotation"] = true;
    if (actor.ownership?.default !== 0) update["ownership.default"] = 0;
    if (Object.keys(update).length) await actor.update(update, { add2eReason: "shop-token-presentation" });
  }

  for (const scene of game.scenes ?? []) {
    const updates = [];
    for (const tokenDoc of scene.tokens ?? []) {
      const actor = game.actors?.get?.(tokenDoc.actorId) ?? tokenDoc.actor ?? null;
      if (!isShopActor(actor)) continue;
      const update = { _id: tokenDoc.id };
      let changed = false;
      if (tokenDoc.displayName !== displayName) { update.displayName = displayName; changed = true; }
      if (tokenDoc.lockRotation !== true) { update.lockRotation = true; changed = true; }
      if (changed) updates.push(update);
    }
    if (updates.length) await scene.updateEmbeddedDocuments("Token", updates, { add2eReason: "shop-token-presentation" });
  }

  game.add2e = game.add2e ?? {};
  game.add2e.shopOrchestrationVersion = ADD2E_SHOP_ORCHESTRATION_VERSION;
  return true;
}

function hideShopActorsFromPlayers() {
  if (shopActorsHiddenHookRegistered) return;
  shopActorsHiddenHookRegistered = true;
  Hooks.on("renderActorDirectory", (_app, html) => {
    if (game.user?.isGM) return;
    const root = html?.jquery ? html[0] : html;
    if (!root?.querySelectorAll) return;
    for (const actor of game.actors ?? []) {
      if (!isShopActor(actor)) continue;
      const selector = `[data-document-id="${actor.id}"], [data-entry-id="${actor.id}"], [data-actor-id="${actor.id}"]`;
      for (const node of root.querySelectorAll(selector)) node.remove();
    }
  });
}

function tileDocument(tile) {
  return tile?.document ?? tile ?? null;
}

function shopTileType(tile) {
  const document = tileDocument(tile);
  const raw = document?.getFlag?.(ADD2E_SHOP_TILE_FLAG_SCOPE, ADD2E_SHOP_TILE_FLAG_KEY) ?? document?.flags?.[ADD2E_SHOP_TILE_FLAG_SCOPE]?.[ADD2E_SHOP_TILE_FLAG_KEY] ?? "";
  const type = String(raw ?? "").trim().toLowerCase();
  return ADD2E_SHOP_TILE_TYPES.has(type) ? type : "";
}

function shopTileKey(tile) {
  const document = tileDocument(tile);
  return document?.uuid ?? document?.id ?? tile?.id ?? null;
}

function shopTileOpenLock(tile) {
  const key = `${game.user?.id ?? "unknown"}:${shopTileKey(tile) ?? "unknown"}`;
  const now = Date.now();
  if (SHOP_TILE_OPEN_LOCKS.has(key) && now - SHOP_TILE_OPEN_LOCKS.get(key) < 750) return false;
  SHOP_TILE_OPEN_LOCKS.set(key, now);
  return true;
}

async function openShopFromTile(tile) {
  const type = shopTileType(tile);
  if (!type || game.user?.isGM || !shopTileOpenLock(tile)) return false;
  const openShop = type === "armorer" ? game.add2e?.openArmorer : game.add2e?.openVendor;
  if (typeof openShop !== "function") return false;
  await openShop();
  return true;
}

function shopTilePointerId(event) {
  return event?.pointerId ?? event?.data?.pointerId ?? "mouse";
}

function shopTileIsPrimaryPointer(event) {
  const button = event?.button ?? event?.data?.button ?? event?.nativeEvent?.button ?? event?.data?.originalEvent?.button;
  return button == null || button === 0;
}

function shopTilePointerPosition(event) {
  const global = event?.global ?? event?.data?.global ?? null;
  if (global && Number.isFinite(global.x) && Number.isFinite(global.y)) {
    try {
      const point = canvas?.stage?.toLocal?.(global);
      if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) return { x: point.x, y: point.y };
    } catch (_error) {}
  }
  const getLocalPosition = event?.getLocalPosition ?? event?.data?.getLocalPosition;
  if (typeof getLocalPosition === "function") {
    try {
      const point = getLocalPosition.call(event?.data ?? event, canvas?.stage);
      if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) return { x: point.x, y: point.y };
    } catch (_error) {}
  }
  return null;
}

function shopTileContainsPoint(tile, point) {
  const document = tileDocument(tile);
  const x = Number(document?.x);
  const y = Number(document?.y);
  const width = Number(document?.width);
  const height = Number(document?.height);
  if (![x, y, width, height, point?.x, point?.y].every(Number.isFinite) || width <= 0 || height <= 0) return false;
  let px = point.x;
  let py = point.y;
  const rotation = Number(document?.rotation ?? 0);
  if (Number.isFinite(rotation) && rotation !== 0) {
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const radians = (-rotation * Math.PI) / 180;
    const dx = px - centerX;
    const dy = py - centerY;
    px = centerX + (dx * Math.cos(radians)) - (dy * Math.sin(radians));
    py = centerY + (dx * Math.sin(radians)) + (dy * Math.cos(radians));
  }
  return px >= x && px <= x + width && py >= y && py <= y + height;
}

function shopTileAtPoint(point) {
  const tiles = Array.from(canvas?.tiles?.placeables ?? [])
    .filter(tile => shopTileType(tile) && tile?.isVisible !== false)
    .sort((left, right) => Number(right?.zIndex ?? right?.document?.sort ?? 0) - Number(left?.zIndex ?? left?.document?.sort ?? 0));
  return tiles.find(tile => shopTileContainsPoint(tile, point)) ?? null;
}

function bindShopTileCanvasClick() {
  const stage = canvas?.stage;
  if (!stage?.on || SHOP_TILE_CANVAS_STATE.stage === stage) return;
  if (SHOP_TILE_CANVAS_STATE.stage?.off) {
    SHOP_TILE_CANVAS_STATE.stage.off("pointerdown", SHOP_TILE_CANVAS_STATE.onDown);
    SHOP_TILE_CANVAS_STATE.stage.off("pointerup", SHOP_TILE_CANVAS_STATE.onUp);
    SHOP_TILE_CANVAS_STATE.stage.off("pointerupoutside", SHOP_TILE_CANVAS_STATE.onCancel);
    SHOP_TILE_CANVAS_STATE.stage.off("pointercancel", SHOP_TILE_CANVAS_STATE.onCancel);
  }
  SHOP_TILE_CANVAS_STATE.stage = stage;
  SHOP_TILE_CANVAS_STATE.down = null;
  SHOP_TILE_CANVAS_STATE.onDown = event => {
    if (game.user?.isGM || !shopTileIsPrimaryPointer(event)) return;
    const point = shopTilePointerPosition(event);
    if (!point) return;
    SHOP_TILE_CANVAS_STATE.down = { pointerId: shopTilePointerId(event), point, time: Date.now() };
  };
  SHOP_TILE_CANVAS_STATE.onCancel = () => { SHOP_TILE_CANVAS_STATE.down = null; };
  SHOP_TILE_CANVAS_STATE.onUp = event => {
    if (game.user?.isGM || !shopTileIsPrimaryPointer(event)) return;
    const down = SHOP_TILE_CANVAS_STATE.down;
    SHOP_TILE_CANVAS_STATE.down = null;
    if (!down || down.pointerId !== shopTilePointerId(event)) return;
    const point = shopTilePointerPosition(event);
    if (!point || Date.now() - down.time > ADD2E_SHOP_TILE_CLICK_DURATION) return;
    if (Math.hypot(point.x - down.point.x, point.y - down.point.y) > ADD2E_SHOP_TILE_CLICK_DISTANCE) return;
    const tile = shopTileAtPoint(point);
    if (tile) window.setTimeout(() => { void openShopFromTile(tile); }, 0);
  };
  stage.on("pointerdown", SHOP_TILE_CANVAS_STATE.onDown);
  stage.on("pointerup", SHOP_TILE_CANVAS_STATE.onUp);
  stage.on("pointerupoutside", SHOP_TILE_CANVAS_STATE.onCancel);
  stage.on("pointercancel", SHOP_TILE_CANVAS_STATE.onCancel);
}

function appElement(html) {
  return html?.jquery ? html[0] : html;
}

function configTileDocument(app) {
  const candidate = app?.document ?? app?.object ?? app?.options?.document ?? app?.options?.object ?? null;
  const document = tileDocument(candidate);
  return document?.documentName === "Tile" ? document : null;
}

function injectShopTileConfigField(app, html) {
  if (!game.user?.isGM) return;
  const tile = configTileDocument(app);
  if (!tile) return;
  const root = appElement(html);
  const form = root?.matches?.("form") ? root : root?.querySelector?.("form");
  if (!form || form.querySelector(".add2e-shop-tile-field")) return;
  const type = shopTileType(tile);
  const group = globalThis.document.createElement("div");
  group.className = "form-group add2e-shop-tile-field";
  group.innerHTML = `
    <label for="add2e-shop-tile-type">Boutique ADD2E</label>
    <div class="form-fields">
      <select id="add2e-shop-tile-type" name="flags.add2e.shopType">
        <option value="" ${type === "" ? "selected" : ""}>Aucune</option>
        <option value="general" ${type === "vendor" || type === "general" ? "selected" : ""}>Marchand général</option>
        <option value="armorer" ${type === "armorer" ? "selected" : ""}>Armurier</option>
      </select>
    </div>
    <p class="hint">Les joueurs ouvrent cette boutique par clic simple sur la tuile.</p>`;
  const footer = form.querySelector("footer.form-footer, .form-footer, .sheet-footer");
  if (footer?.parentElement) footer.before(group);
  else form.append(group);
}

function registerShopTileHooks() {
  if (shopTileHooksRegistered) return;
  shopTileHooksRegistered = true;
  Hooks.on("renderTileConfig", injectShopTileConfigField);
  Hooks.on("canvasReady", bindShopTileCanvasClick);
}

Hooks.once("init", () => {
  game.settings.register("add2e", VENDOR_SETTING, {
    name: "ADD2E — Création du vendeur système",
    hint: "Version du marchand général créé automatiquement.",
    scope: "world",
    config: false,
    type: String,
    default: ""
  });
  game.settings.register("add2e", ARMORER_SETTING, {
    name: "ADD2E — Création de l’armurier système",
    hint: "Version de l’armurier créé automatiquement.",
    scope: "world",
    config: false,
    type: String,
    default: ""
  });
  game.settings.register("add2e", SPELL_COMPONENTS_SETTING, {
    name: "ADD2E — Gestion des composants de sorts",
    hint: "Si coché, les sorts vérifient et consomment les composants matériels. Décochez cette option pour ignorer les composants.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
  registerVendorDirectoryButton();
  registerArmorerDirectoryButton();
  hideShopActorsFromPlayers();
  registerShopTileHooks();
});

Hooks.once("ready", async () => {
  registerGlobals();
  registerConsumablesGlobals();
  registerUiGlobals();
  registerArmorerGlobals();
  registerArmorerUiGlobals();

  await enforceShopActors().catch(error => console.warn("[ADD2E][SHOP][ENSURE_ACTORS]", error));
  await enforceShopHitPoints().catch(error => console.warn("[ADD2E][SHOP][HIT_POINTS]", error));
  await enforceShopTokenPresentation().catch(error => console.warn("[ADD2E][SHOP][TOKEN_PRESENTATION]", error));

  registerRecoveryHooks();
  patchActorSheetMoney();
  patchVendorTokenClick();
  patchArmorerTokenClick();
  bindShopTileCanvasClick();

  window.setTimeout(bindAllVendorTokens, 500);
  window.setTimeout(bindAllArmorerTokens, 500);

  game.add2e = game.add2e ?? {};
  game.add2e.shopTileVersion = ADD2E_SHOP_TILE_VERSION;

  console.log("[ADD2E][SHOP][READY]", {
    vendor: ADD2E_VENDOR_VERSION,
    armorer: ADD2E_ARMORER_VERSION,
    consumables: ADD2E_CONSUMABLES_VERSION,
    orchestration: ADD2E_SHOP_ORCHESTRATION_VERSION,
    hp: ADD2E_SHOP_HP_VERSION,
    tiles: ADD2E_SHOP_TILE_VERSION
  });
});
