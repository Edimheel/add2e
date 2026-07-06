// ADD2E — Vendeur système : orchestration minimale des boutiques.
// Architecture : le cœur gère les données, les ApplicationV2 gèrent les fenêtres.

import {
  ADD2E_VENDOR_VERSION,
  VENDOR_SETTING,
  registerRecoveryHooks,
  patchActorSheetMoney,
  registerGlobals,
  isVendorActor,
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
  registerSockets as registerArmorerSockets,
  isArmorerActor,
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
  registerGlobals as registerConsumablesGlobals,
  registerSockets as registerConsumablesSockets
} from "./22e-consumables-core.mjs";

const ADD2E_SHOP_ORCHESTRATION_VERSION = "2026-07-06-shop-tiles-v2";
const ADD2E_SHOP_HP_VERSION = "2026-06-15-shop-hp-one-multiclass-v1";
const ADD2E_SHOP_HP = 1;
const SPELL_COMPONENTS_SETTING = "gestionComposantsSorts";
const ADD2E_SHOP_TILE_VERSION = "2026-07-06-shop-tiles-v2";
const ADD2E_SHOP_TILE_FLAG_SCOPE = "add2e";
const ADD2E_SHOP_TILE_FLAG_KEY = "shopType";
const ADD2E_SHOP_TILE_TYPES = new Set(["vendor", "armorer"]);

// Seuls ces champs sont répliqués depuis le compendium vers le stock déjà
// existant de l'armurier. Prix, quantité et paramètres de stock sont conservés.
const ARMORER_WEAPON_RULE_FIELDS = [
  "tags",
  "effectTags",
  "effecttags",
  "categorie",
  "category",
  "type_arme",
  "typeArme",
  "arme_de_jet",
  "armeDeJet",
  "isThrown",
  "utilise_munition",
  "utiliseMunition",
  "projectileConsomme",
  "carquois",
  "portee_courte",
  "portee_moyenne",
  "portee_longue",
  "porteeCourte",
  "porteeMoyenne",
  "porteeLongue"
];

function isShopActor(actor) {
  return isVendorActor(actor) || isArmorerActor(actor);
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
  const sys = actor?.system ?? {};
  const values = [
    sys.pdv,
    sys.pv,
    sys.points_de_coup,
    sys.points_de_vie,
    sys.pv_max,
    sys.hp?.value,
    sys.hp?.max,
    sys.attributes?.hp?.value,
    sys.attributes?.hp?.max
  ];
  return actor?.getFlag?.("add2e", "shopHpVersion") !== ADD2E_SHOP_HP_VERSION
    || values.some(value => Number(value) !== ADD2E_SHOP_HP);
}

function armorerRuleSlug(value) {
  return String(value ?? "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, "_")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function armorerRuleKey(item) {
  return `arme:${armorerRuleSlug(item?.name)}`;
}

function armorerClone(value) {
  if (foundry?.utils?.deepClone) return foundry.utils.deepClone(value);
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function armorerSameValue(a, b) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

async function getArmorerWeaponSources() {
  const docs = [];
  const seen = new Set();
  const ids = ["add2e.armes", "world.armes"];

  for (const [id, pack] of game.packs ?? []) {
    const text = `${id} ${pack?.metadata?.label ?? ""}`;
    if (/\barmes?\b|weapons?/i.test(text) && !ids.includes(id)) ids.push(id);
  }

  for (const id of ids) {
    const pack = game.packs?.get?.(id);
    if (!pack) continue;
    let packDocs = [];
    try {
      packDocs = await pack.getDocuments();
    } catch (error) {
      console.warn("[ADD2E][ARMORER][SOURCE_SYNC][PACK_READ_FAIL]", id, error);
      continue;
    }

    for (const doc of packDocs) {
      if (doc?.type !== "arme") continue;
      const key = armorerRuleKey(doc);
      if (seen.has(key)) continue;
      seen.add(key);
      docs.push(doc);
    }
  }

  return docs;
}

/**
 * Met à jour le stock préexistant de l'armurier sans écraser son économie.
 * Les nouveaux achats recopient alors la bonne arme depuis ce stock.
 */
async function syncArmorerWeaponRules(armorer) {
  if (!game.user?.isGM || !armorer) return 0;

  const sources = await getArmorerWeaponSources();
  const sourceByKey = new Map(sources.map(source => [armorerRuleKey(source), source]));
  const updates = [];

  for (const stockItem of armorer.items ?? []) {
    if (stockItem?.type !== "arme") continue;

    const catalogKey = stockItem.getFlag?.("add2e", "armorerCatalogKey") ?? armorerRuleKey(stockItem);
    const source = sourceByKey.get(catalogKey) ?? sourceByKey.get(armorerRuleKey(stockItem));
    if (!source) continue;

    const sourceSystem = source.system ?? {};
    const update = { _id: stockItem.id };
    let changed = false;

    for (const field of ARMORER_WEAPON_RULE_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(sourceSystem, field)) continue;
      if (armorerSameValue(stockItem.system?.[field], sourceSystem[field])) continue;
      update[`system.${field}`] = armorerClone(sourceSystem[field]);
      changed = true;
    }

    if (changed) updates.push(update);
  }

  if (updates.length) {
    await armorer.updateEmbeddedDocuments("Item", updates, { add2eReason: "armorer-sync-source-weapon-rules" });
  }

  return updates.length;
}

async function enforceShopHitPoints() {
  if (!game.user?.isGM) return false;

  for (const actor of game.actors ?? []) {
    if (!isShopActor(actor) || !shopActorNeedsHitPointUpdate(actor)) continue;
    await actor.update(shopHitPointUpdate(), { add2eReason: "shop-hit-points-one" });
  }

  game.add2e = game.add2e ?? {};
  game.add2e.shopHpVersion = ADD2E_SHOP_HP_VERSION;
  globalThis.ADD2E_SHOP_HP_VERSION = ADD2E_SHOP_HP_VERSION;
  return true;
}

async function enforceShopActors() {
  if (!game.user?.isGM) return false;

  let vendor = findVendor();
  if (!vendor) vendor = await createVendor({ force: true });
  if (vendor) {
    await moveVendorToFolder(vendor);
    await updateVendorTokenSize(vendor);
    if (!Array.from(vendor.items ?? []).some(item => item?.getFlag?.("add2e", "vendorItem") === true)) await ensureVendorStock(vendor);
  }

  let armorer = findArmorer();
  if (!armorer) armorer = await createArmorer({ force: true });
  if (armorer) {
    await moveArmorerToFolder(armorer);
    await updateArmorerTokenSize(armorer);
    await ensureArmorerStock(armorer);
    await syncArmorerWeaponRules(armorer);
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
  globalThis.ADD2E_SHOP_ORCHESTRATION_VERSION = ADD2E_SHOP_ORCHESTRATION_VERSION;
  return true;
}

function hideShopActorsFromPlayers() {
  if (globalThis.__ADD2E_HIDE_SHOP_ACTORS_FROM_PLAYERS_V3) return;
  globalThis.__ADD2E_HIDE_SHOP_ACTORS_FROM_PLAYERS_V3 = true;
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
  const raw = document?.getFlag?.(ADD2E_SHOP_TILE_FLAG_SCOPE, ADD2E_SHOP_TILE_FLAG_KEY)
    ?? document?.flags?.[ADD2E_SHOP_TILE_FLAG_SCOPE]?.[ADD2E_SHOP_TILE_FLAG_KEY]
    ?? "";
  const type = String(raw ?? "").trim().toLowerCase();
  return ADD2E_SHOP_TILE_TYPES.has(type) ? type : "";
}

function shopTileTypeLabel(type) {
  return type === "armorer" ? "Armurier" : type === "vendor" ? "Marchand" : "Aucune boutique";
}

function shopTileKey(tile) {
  const document = tileDocument(tile);
  return document?.uuid ?? document?.id ?? tile?.id ?? null;
}

function shopTileEscape(value) {
  const text = String(value ?? "");
  return foundry?.utils?.escapeHTML?.(text) ?? text.replace(/[&<>'"]/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    "\"": "&quot;"
  }[character]));
}

function shopTileOpenLock(tile) {
  const key = `${game.user?.id ?? "unknown"}:${shopTileKey(tile) ?? "unknown"}`;
  const now = Date.now();
  const locks = globalThis.__ADD2E_SHOP_TILE_OPEN_LOCK ??= {};
  if (locks[key] && now - locks[key] < 750) return false;
  locks[key] = now;
  return true;
}

async function openShopFromTile(tile, { allowGM = false, shopType = null } = {}) {
  const type = shopType ?? shopTileType(tile);
  if (!ADD2E_SHOP_TILE_TYPES.has(type) || (!allowGM && game.user?.isGM)) return false;
  if (!shopTileOpenLock(tile)) return false;

  const openShop = type === "armorer"
    ? game.add2e?.openArmorer
    : game.add2e?.openVendor;

  if (typeof openShop !== "function") {
    ui.notifications?.warn?.("La boutique ADD2E n’est pas encore disponible.");
    return false;
  }

  await openShop();
  return true;
}

function removeShopTileBinding(tile) {
  const handler = tile?.__add2eShopTileTapHandler;
  if (handler) tile.off?.("pointertap", handler);
  delete tile?.__add2eShopTileTapHandler;
  delete tile?.__add2eShopTileBound;
  if (tile?.cursor === "pointer") tile.cursor = null;
}

function bindAllShopTiles() {
  for (const tile of canvas?.tiles?.placeables ?? []) {
    if (!shopTileType(tile)) {
      removeShopTileBinding(tile);
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
      removeShopTileBinding(tile);
    }
  }
}

function appElement(html) {
  return html?.jquery ? html[0] : html;
}

function tileFromConfigApp(app) {
  const candidate = app?.document ?? app?.object ?? app?.options?.document ?? app?.options?.object ?? null;
  const document = tileDocument(candidate);
  return document?.documentName === "Tile" || document?.constructor?.name === "TileDocument" ? document : null;
}

function injectShopTileConfigField(app, html) {
  if (!game.user?.isGM) return;
  const tile = tileFromConfigApp(app);
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
        <option value="vendor" ${type === "vendor" ? "selected" : ""}>Marchand</option>
        <option value="armorer" ${type === "armorer" ? "selected" : ""}>Armurier</option>
      </select>
    </div>
    <p class="hint">Les joueurs ouvrent cette boutique par clic simple sur la tuile.</p>`;

  const footer = form.querySelector("footer.form-footer, .form-footer, .sheet-footer");
  if (footer?.parentElement) footer.before(group);
  else form.append(group);
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
    this.shopType = shopTileType(tile);
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
    const root = globalThis.document.createElement("section");
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
      <p><strong>${shopTileEscape(context.tileName)}</strong><br>Les joueurs ouvrent la boutique par clic simple sur cette tuile.</p>
      <label for="add2e-shop-tile-config-type">Boutique</label>
      <select id="add2e-shop-tile-config-type" name="shopType">
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
    return ADD2E_SHOP_TILE_TYPES.has(value) ? value : "";
  }

  async save() {
    const document = this.document;
    if (!document || !game.user?.isGM) return;
    const type = this.selectedShopType();
    if (type) await document.setFlag(ADD2E_SHOP_TILE_FLAG_SCOPE, ADD2E_SHOP_TILE_FLAG_KEY, type);
    else await document.unsetFlag(ADD2E_SHOP_TILE_FLAG_SCOPE, ADD2E_SHOP_TILE_FLAG_KEY);
    this.shopType = type;
    bindAllShopTiles();
    ui.notifications?.info?.(`Tuile configurée : ${shopTileTypeLabel(type)}.`);
    await this.close();
  }

  async preview() {
    const type = this.selectedShopType();
    if (!type) return ui.notifications?.warn?.("Choisis d’abord Marchand ou Armurier.");
    const opened = await openShopFromTile(this.tile, { allowGM: true, shopType: type });
    if (!opened) ui.notifications?.warn?.("La boutique ADD2E n’est pas disponible.");
  }
}

const shopTileConfigApps = () => globalThis.__ADD2E_SHOP_TILE_CONFIG_APPS ??= new Map();

async function openShopTileConfig(tile = null) {
  if (!game.user?.isGM) return false;
  tile = tile ?? canvas?.tiles?.controlled?.[0] ?? null;
  const key = shopTileKey(tile);
  if (!tile || !key) {
    ui.notifications?.warn?.("Sélectionne d’abord une tuile.");
    return false;
  }

  const existing = shopTileConfigApps().get(key);
  if (existing?.rendered) {
    existing.tile = tile;
    existing.shopType = shopTileType(tile);
    existing.render({ force: true });
    existing.bringToFront?.();
    return existing;
  }

  const app = new Add2eShopTileConfigApp({ tile });
  shopTileConfigApps().set(key, app);
  app.render({ force: true });
  return app;
}

function injectShopTileHudButton(hud, html) {
  if (!game.user?.isGM) return;
  const tile = tileDocument(hud?.object ?? hud?.document ?? null);
  if (!tile || tile.documentName !== "Tile") return;

  const root = appElement(html);
  if (!root?.querySelector || root.querySelector(".add2e-shop-tile-config-button")) return;

  const button = globalThis.document.createElement("div");
  button.className = "control-icon add2e-shop-tile-config-button";
  button.dataset.action = "add2e-shop-tile-config";
  button.title = "Configurer la boutique ADD2E";
  button.setAttribute("aria-label", "Configurer la boutique ADD2E");
  button.innerHTML = '<i class="fas fa-store"></i>';
  button.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    void openShopTileConfig(hud.object ?? tile);
  });

  const target = root.querySelector(".col.right")
    ?? root.querySelector(".control-icon.config")?.parentElement
    ?? root.querySelector(".control-icon")?.parentElement
    ?? root;
  target.append(button);
}

function registerShopTileHooks() {
  if (globalThis.__ADD2E_SHOP_TILE_HOOKS_V2) return;
  globalThis.__ADD2E_SHOP_TILE_HOOKS_V2 = true;

  Hooks.on("renderTileConfig", injectShopTileConfigField);
  Hooks.on("renderTileHUD", injectShopTileHudButton);
  Hooks.on("canvasReady", bindAllShopTiles);
  Hooks.on("createTile", () => setTimeout(bindAllShopTiles, 100));
  Hooks.on("updateTile", () => setTimeout(bindAllShopTiles, 100));
}

Hooks.once("init", () => {
  game.settings.register("add2e", VENDOR_SETTING, {
    name: "ADD2E — Création du vendeur système",
    hint: "Version du vendeur de composants, projectiles et équipements créé automatiquement.",
    scope: "world",
    config: false,
    type: String,
    default: ""
  });

  game.settings.register("add2e", ARMORER_SETTING, {
    name: "ADD2E — Création de l’armurier système",
    hint: "Version de l’armurier d’armes et armures créé automatiquement.",
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
  registerArmorerSockets();
  registerConsumablesSockets();

  await enforceShopActors().catch(err => console.warn("[ADD2E][SHOP][ENSURE_ACTORS]", err));
  await enforceShopHitPoints().catch(err => console.warn("[ADD2E][SHOP][HIT_POINTS]", err));
  await enforceShopTokenPresentation().catch(err => console.warn("[ADD2E][SHOP][TOKEN_PRESENTATION]", err));

  registerRecoveryHooks();
  patchActorSheetMoney();
  patchVendorTokenClick();
  patchArmorerTokenClick();

  window.setTimeout(bindAllVendorTokens, 500);
  window.setTimeout(bindAllArmorerTokens, 500);
  window.setTimeout(bindAllShopTiles, 500);

  game.add2e = game.add2e ?? {};
  game.add2e.openShopTileConfig = openShopTileConfig;
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