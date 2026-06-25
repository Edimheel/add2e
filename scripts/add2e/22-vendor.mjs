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

const ADD2E_SHOP_ORCHESTRATION_VERSION = "2026-06-25-armorer-source-rules-sync-v3";
const ADD2E_SHOP_HP_VERSION = "2026-06-15-shop-hp-one-multiclass-v1";
const ADD2E_SHOP_HP = 1;
const SPELL_COMPONENTS_SETTING = "gestionComposantsSorts";

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

  console.log("[ADD2E][SHOP][READY]", {
    vendor: ADD2E_VENDOR_VERSION,
    armorer: ADD2E_ARMORER_VERSION,
    consumables: ADD2E_CONSUMABLES_VERSION,
    orchestration: ADD2E_SHOP_ORCHESTRATION_VERSION,
    hp: ADD2E_SHOP_HP_VERSION
  });
});