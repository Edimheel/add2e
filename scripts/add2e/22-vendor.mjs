// ADD2E — Vendeur système : point d'entrée.
// Les boutiques sont découpées pour séparer la logique métier des interfaces ApplicationV2.

import {
  ADD2E_VENDOR_VERSION,
  VENDOR_SETTING,
  ensureVendorOnLaunch,
  registerRecoveryHooks,
  patchActorSheetMoney,
  patchAttackRollProjectileConsumption,
  registerGlobals,
  isVendorActor
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
  ensureArmorerOnLaunch,
  registerGlobals as registerArmorerGlobals,
  registerSockets as registerArmorerSockets,
  isArmorerActor
} from "./22c-armorer-core.mjs";

import {
  bindAllArmorerTokens,
  patchArmorerTokenClick,
  registerArmorerUiGlobals,
  registerArmorerDirectoryButton
} from "./22d-armorer-app.mjs";

const ADD2E_SHOP_TOKEN_PRESENTATION_VERSION = "2026-05-28-shop-token-name-lock-rotation-hide-actors-v2";

function add2eShopTokenDisplayAlwaysValue() {
  return CONST?.TOKEN_DISPLAY_MODES?.ALWAYS ?? 50;
}

function add2eIsShopActor(actor) {
  return isVendorActor(actor) || isArmorerActor(actor);
}

async function add2eEnforceShopTokenPresentation() {
  if (!game.user?.isGM) return false;

  const displayName = add2eShopTokenDisplayAlwaysValue();
  const actorUpdates = [];

  for (const actor of game.actors ?? []) {
    if (!add2eIsShopActor(actor)) continue;
    const update = {};
    if (actor.prototypeToken?.displayName !== displayName) update["prototypeToken.displayName"] = displayName;
    if (actor.prototypeToken?.lockRotation !== true) update["prototypeToken.lockRotation"] = true;
    if (actor.ownership?.default !== 0) update["ownership.default"] = 0;
    if (!Object.keys(update).length) continue;
    await actor.update(update, { add2eReason: "shop-token-presentation" }).catch(err => console.warn("[ADD2E][SHOP_TOKEN][ACTOR]", actor.name, err));
    actorUpdates.push(actor.name);
  }

  const sceneUpdates = [];
  for (const scene of game.scenes ?? []) {
    const updates = [];
    for (const tokenDoc of scene.tokens ?? []) {
      const actor = game.actors?.get?.(tokenDoc.actorId) ?? tokenDoc.actor ?? null;
      if (!add2eIsShopActor(actor)) continue;
      const update = { _id: tokenDoc.id };
      let changed = false;
      if (tokenDoc.displayName !== displayName) { update.displayName = displayName; changed = true; }
      if (tokenDoc.lockRotation !== true) { update.lockRotation = true; changed = true; }
      if (changed) updates.push(update);
    }
    if (!updates.length) continue;
    await scene.updateEmbeddedDocuments("Token", updates, { add2eReason: "shop-token-presentation" }).catch(err => console.warn("[ADD2E][SHOP_TOKEN][SCENE]", scene.name, err));
    sceneUpdates.push({ scene: scene.name, count: updates.length });
  }

  game.add2e = game.add2e ?? {};
  game.add2e.shopTokenPresentationVersion = ADD2E_SHOP_TOKEN_PRESENTATION_VERSION;
  globalThis.ADD2E_SHOP_TOKEN_PRESENTATION_VERSION = ADD2E_SHOP_TOKEN_PRESENTATION_VERSION;

  console.log("[ADD2E][SHOP_TOKEN][PRESENTATION]", {
    version: ADD2E_SHOP_TOKEN_PRESENTATION_VERSION,
    displayName,
    lockRotation: true,
    actorUpdates,
    sceneUpdates
  });

  return true;
}

function add2eHideShopActorsFromPlayers() {
  if (globalThis.__ADD2E_HIDE_SHOP_ACTORS_FROM_PLAYERS_V2) return;
  globalThis.__ADD2E_HIDE_SHOP_ACTORS_FROM_PLAYERS_V2 = true;
  Hooks.on("renderActorDirectory", (_app, html) => {
    if (game.user?.isGM) return;
    const root = html?.jquery ? html[0] : html;
    if (!root?.querySelectorAll) return;
    for (const actor of game.actors ?? []) {
      if (!add2eIsShopActor(actor)) continue;
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

  registerVendorDirectoryButton();
  registerArmorerDirectoryButton();
  add2eHideShopActorsFromPlayers();
});

Hooks.once("ready", async () => {
  registerGlobals();
  registerUiGlobals();
  registerArmorerGlobals();
  registerArmorerUiGlobals();
  registerArmorerSockets();

  await ensureVendorOnLaunch().catch(err => console.warn("[ADD2E][VENDOR][AUTO_CREATE]", err));
  await ensureArmorerOnLaunch().catch(err => console.warn("[ADD2E][ARMORER][AUTO_CREATE]", err));
  await add2eEnforceShopTokenPresentation().catch(err => console.warn("[ADD2E][SHOP_TOKEN][PRESENTATION]", err));

  registerRecoveryHooks();
  patchActorSheetMoney();
  patchVendorTokenClick();
  patchArmorerTokenClick();

  window.setTimeout(bindAllVendorTokens, 500);
  window.setTimeout(bindAllArmorerTokens, 500);
  window.setTimeout(patchAttackRollProjectileConsumption, 800);
  window.setTimeout(patchAttackRollProjectileConsumption, 2000);

  console.log("[ADD2E][VENDOR][VERSION]", ADD2E_VENDOR_VERSION);
  console.log("[ADD2E][ARMORER][VERSION]", ADD2E_ARMORER_VERSION);
});