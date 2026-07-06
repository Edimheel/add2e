// ADD2E — Boutiques accessibles depuis des tuiles de scène.
// Utilise les applications existantes du marchand et de l’armurier.

const VERSION = "2026-07-06-shop-tiles-v1";
const FLAG_SCOPE = "add2e";
const FLAG_KEY = "shopType";
const SHOP_TYPES = new Set(["vendor", "armorer"]);

function tileDocument(tile) {
  return tile?.document ?? tile ?? null;
}

function getShopType(tile) {
  const document = tileDocument(tile);
  const raw = document?.getFlag?.(FLAG_SCOPE, FLAG_KEY) ?? document?.flags?.[FLAG_SCOPE]?.[FLAG_KEY] ?? "";
  const shopType = String(raw ?? "").trim().toLowerCase();
  return SHOP_TYPES.has(shopType) ? shopType : "";
}

function shopLabel(shopType) {
  return shopType === "armorer" ? "Armurier" : shopType === "vendor" ? "Marchand" : "Aucune boutique";
}

function getTileKey(tile) {
  const document = tileDocument(tile);
  return document?.uuid ?? document?.id ?? tile?.id ?? null;
}

function selectedTile() {
  return canvas?.tiles?.controlled?.[0] ?? null;
}

function openLock(tile) {
  const key = `${game.user?.id ?? "unknown"}:${getTileKey(tile) ?? "unknown"}`;
  const now = Date.now();
  const locks = globalThis.__ADD2E_SHOP_TILE_OPEN_LOCK ??= {};
  if (locks[key] && now - locks[key] < 750) return false;
  locks[key] = now;
  return true;
}

async function openShopFromTile(tile, { allowGM = false } = {}) {
  const shopType = getShopType(tile);
  if (!shopType || (!allowGM && game.user?.isGM)) return false;
  if (!openLock(tile)) return false;

  const openShop = shopType === "armorer"
    ? game.add2e?.openArmorer
    : game.add2e?.openVendor;

  if (typeof openShop !== "function") {
    ui.notifications?.warn?.("La boutique ADD2E n’est pas encore disponible.");
    return false;
  }

  await openShop();
  return true;
}

function removeTileBinding(tile) {
  const handler = tile?.__add2eShopTileTapHandler;
  if (handler) tile.off?.("pointertap", handler);
  delete tile?.__add2eShopTileTapHandler;
  delete tile?.__add2eShopTileBound;
  if (tile?.cursor === "pointer") tile.cursor = null;
}

export function bindAllShopTiles() {
  for (const tile of canvas?.tiles?.placeables ?? []) {
    const shopType = getShopType(tile);
    if (!shopType) {
      removeTileBinding(tile);
      continue;
    }

    if (tile.__add2eShopTileBound) continue;
    const handler = event => {
      if (game.user?.isGM) return;
      event?.stopPropagation?.();
      void openShopFromTile(tile);
    };

    tile.__add2eShopTileTapHandler = handler;
    tile.__add2eShopTileBound = true;
    try {
      tile.cursor = "pointer";
      tile.eventMode = "static";
      tile.interactive = true;
      tile.on?.("pointertap", handler);
    } catch (_error) {
      removeTileBinding(tile);
    }
  }
}

class Add2eShopTileConfigApp extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "add2e-shop-tile-config-{id}",
    classes: ["add2e", "add2e-shop-tile-config"],
    tag: "section",
    window: { title: "Configurer la boutique de la tuile", resizable: false },
    position: { width: 430, height: "auto" }
  };

  constructor({ tile } = {}, options = {}) {
    super(options);
    this.tile = tile;
    this.shopType = getShopType(tile);
  }

  get document() {
    return tileDocument(this.tile);
  }

  async _prepareContext() {
    return {
      tileName: this.document?.name || this.tile?.name || "Tuile sans nom",
      shopType: this.shopType
    };
  }

  async _renderHTML(context) {
    const root = document.createElement("section");
    root.innerHTML = `
      <style>
        .add2e-shop-tile-config { background: #e7d29a; color: #2b2113; padding: .75rem; }
        .add2e-shop-tile-config p { margin: 0 0 .7rem; padding: .5rem .65rem; border: 1px solid rgba(110,76,23,.24); border-radius: 8px; background: rgba(255,250,236,.76); }
        .add2e-shop-tile-config label { display: block; margin-bottom: .3rem; font-weight: 800; }
        .add2e-shop-tile-config select { width: 100%; min-height: 30px; border: 1px solid rgba(88,56,13,.45); border-radius: 6px; background: #fffbf0; color: #2d210f; font-weight: 700; }
        .add2e-shop-tile-config .actions { display: flex; justify-content: flex-end; gap: .45rem; margin-top: .85rem; }
        .add2e-shop-tile-config button { border: 1px solid rgba(81,52,16,.42); border-radius: 6px; padding: .4rem .65rem; background: linear-gradient(180deg,#6a4518,#49300f); color: #f8e7b4; font-weight: 800; cursor: pointer; }
        .add2e-shop-tile-config button[data-action="preview"] { margin-right: auto; background: linear-gradient(180deg,#315f80,#1e4058); }
      </style>
      <p><strong>${foundry.utils.escapeHTML(context.tileName)}</strong><br>Les joueurs ouvrent la boutique par clic simple sur cette tuile.</p>
      <label for="add2e-shop-tile-type">Boutique</label>
      <select id="add2e-shop-tile-type" name="shopType">
        <option value="" ${context.shopType === "" ? "selected" : ""}>Aucune</option>
        <option value="vendor" ${context.shopType === "vendor" ? "selected" : ""}>Marchand</option>
        <option value="armorer" ${context.shopType === "armorer" ? "selected" : ""}>Armurier</option>
      </select>
      <div class="actions">
        <button type="button" data-action="preview">Ouvrir la boutique</button>
        <button type="button" data-action="cancel">Annuler</button>
        <button type="button" data-action="save">Enregistrer</button>
      </div>`;
    return root;
  }

  _replaceHTML(result, content) {
    content.replaceChildren(result);
  }

  async _onRender(context, options) {
    await super._onRender?.(context, options);
    const root = this.element;
    root.querySelectorAll("[data-action]").forEach(button => button.addEventListener("click", event => {
      const action = event.currentTarget.dataset.action;
      if (action === "save") void this.save();
      if (action === "preview") void this.preview();
      if (action === "cancel") void this.close();
    }));
  }

  selectedShopType() {
    const value = this.element?.querySelector("[name='shopType']")?.value ?? "";
    return SHOP_TYPES.has(value) ? value : "";
  }

  async save() {
    const document = this.document;
    if (!document || !game.user?.isGM) return;
    const shopType = this.selectedShopType();
    if (shopType) await document.setFlag(FLAG_SCOPE, FLAG_KEY, shopType);
    else await document.unsetFlag(FLAG_SCOPE, FLAG_KEY);
    this.shopType = shopType;
    bindAllShopTiles();
    ui.notifications?.info?.(`Tuile configurée : ${shopLabel(shopType)}.`);
    await this.close();
  }

  async preview() {
    const shopType = this.selectedShopType();
    if (!shopType) return ui.notifications?.warn?.("Choisis d’abord Marchand ou Armurier.");
    this.shopType = shopType;
    const opened = await openShopFromTile(this.tile, { allowGM: true });
    if (!opened) ui.notifications?.warn?.("La boutique ADD2E n’est pas disponible.");
  }
}

const configApps = () => globalThis.__ADD2E_SHOP_TILE_CONFIG_APPS ??= new Map();

export async function openShopTileConfig(tile = null) {
  if (!game.user?.isGM) return false;
  tile = tile ?? selectedTile();
  const key = getTileKey(tile);
  if (!tile || !key) {
    ui.notifications?.warn?.("Sélectionne d’abord une tuile.");
    return false;
  }

  const existing = configApps().get(key);
  if (existing?.rendered) {
    existing.tile = tile;
    existing.shopType = getShopType(tile);
    existing.render({ force: true });
    existing.bringToFront?.();
    return existing;
  }

  const app = new Add2eShopTileConfigApp({ tile });
  configApps().set(key, app);
  app.render({ force: true });
  return app;
}

export function registerShopTileControls() {
  if (globalThis.__ADD2E_SHOP_TILE_CONTROLS_V1) return;
  globalThis.__ADD2E_SHOP_TILE_CONTROLS_V1 = true;

  Hooks.on("getSceneControlButtons", controls => {
    if (!game.user?.isGM) return;
    const tileControl = controls?.find(control => control.name === "tiles");
    if (!tileControl?.tools || tileControl.tools.some(tool => tool.name === "add2e-shop-tile")) return;
    tileControl.tools.push({
      name: "add2e-shop-tile",
      title: "Configurer une boutique ADD2E",
      icon: "fas fa-store",
      button: true,
      visible: true,
      onClick: () => void openShopTileConfig()
    });
  });
}

registerShopTileControls();

Hooks.once("ready", () => {
  bindAllShopTiles();
  Hooks.on("canvasReady", bindAllShopTiles);
  Hooks.on("createTile", () => setTimeout(bindAllShopTiles, 100));
  Hooks.on("updateTile", () => setTimeout(bindAllShopTiles, 100));

  game.add2e = game.add2e ?? {};
  game.add2e.openShopTileConfig = openShopTileConfig;
  game.add2e.shopTileVersion = VERSION;
});