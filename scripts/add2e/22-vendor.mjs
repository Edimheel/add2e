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

import {
  ADD2E_CONSUMABLES_VERSION,
  registerGlobals as registerConsumablesGlobals,
  registerSockets as registerConsumablesSockets
} from "./22e-consumables-core.mjs";

const ADD2E_SHOP_TOKEN_PRESENTATION_VERSION = "2026-05-28-shop-token-name-lock-rotation-hide-actors-v2";
const ADD2E_SHOP_BUYER_SELECTOR_VERSION = "2026-06-12-shop-buyer-selector-visible-header-v2";

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

function add2eShopActorTypeLabel(actor) {
  const type = String(actor?.type ?? "").toLowerCase();
  if (type === "personnage") return "Personnages";
  if (type === "monster") return "Monstres";
  return "Autres acteurs";
}

function add2eShopBuyerOptions(selectedId = "") {
  const groups = new Map();
  for (const actor of game.actors ?? []) {
    if (!actor?.id || add2eIsShopActor(actor)) continue;
    const label = add2eShopActorTypeLabel(actor);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(actor);
  }
  for (const actors of groups.values()) actors.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  return [...groups.entries()].map(([label, actors]) => `<optgroup label="${foundry.utils.escapeHTML(label)}">${actors.map(actor => `<option value="${foundry.utils.escapeHTML(actor.id)}" ${actor.id === selectedId ? "selected" : ""}>${foundry.utils.escapeHTML(actor.name)}</option>`).join("")}</optgroup>`).join("");
}

function add2eAppElement(app) {
  if (app?.element instanceof HTMLElement) return app.element;
  if (app?.element?.[0] instanceof HTMLElement) return app.element[0];
  return null;
}

function add2eFindAppForRoot(root) {
  for (const app of Object.values(ui.windows ?? {})) {
    const el = add2eAppElement(app);
    if (el && (el === root || el.contains(root))) return app;
  }
  return null;
}

function add2eShopRoots(root = null) {
  const roots = [];
  if (root?.matches?.(".add2e-vendor-root,.add2e-armorer-root")) roots.push(root);
  if (root?.querySelectorAll) roots.push(...root.querySelectorAll(".add2e-vendor-root,.add2e-armorer-root"));
  if (!roots.length) roots.push(...document.querySelectorAll(".add2e-vendor-root,.add2e-armorer-root"));
  return [...new Set(roots)];
}

function add2eInjectShopBuyerSelector(root = null) {
  if (!game.user?.isGM) return false;
  let changed = false;

  for (const base of add2eShopRoots(root)) {
    if (!base || base.dataset.add2eShopBuyerSelector === "1") continue;
    const isVendorRoot = base.matches(".add2e-vendor-root");
    const headerText = base.querySelector(isVendorRoot ? ".add2e-vendor-header p" : ".add2e-armorer-header p");
    if (!headerText) continue;
    const app = add2eFindAppForRoot(base);
    const buyer = app?.buyer ?? null;
    const buttonColor = isVendorRoot ? "#7b4b16" : "#6b4a25";
    const borderColor = isVendorRoot ? "#d9bf73" : "#b9965e";

    headerText.style.cssText = "display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:8px;";
    headerText.innerHTML = `<button type="button" class="add2e-shop-buyer-label" style="border:2px solid ${borderColor};border-radius:8px;background:${buttonColor};color:#ffe7a8;font-weight:950;padding:6px 10px;cursor:default;">Dans la peau de...</button><select class="add2e-shop-buyer-select" style="min-height:34px;min-width:280px;max-width:440px;border:2px solid ${borderColor};border-radius:8px;background:#fffaf0;color:#241a10;font-weight:950;padding:5px 8px;">${add2eShopBuyerOptions(buyer?.id)}</select><span style="font-weight:850;color:${isVendorRoot ? "#fff2c2" : "#f3e4c9"};">Acteur courant : <strong>${foundry.utils.escapeHTML(buyer?.name ?? "aucun")}</strong></span>`;

    const select = headerText.querySelector(".add2e-shop-buyer-select");
    select?.addEventListener("change", event => {
      const next = game.actors?.get?.(event.currentTarget.value);
      const liveApp = add2eFindAppForRoot(base);
      if (!next || !liveApp) return;
      liveApp.buyer = next;
      liveApp.render?.({ force: true });
      ui.notifications?.info?.(`Achats dans la peau de ${next.name}.`);
    });

    base.dataset.add2eShopBuyerSelector = "1";
    changed = true;
  }
  return changed;
}

function add2eInstallShopBuyerSelectorHooks() {
  if (globalThis.__ADD2E_SHOP_BUYER_SELECTOR_V2) return;
  globalThis.__ADD2E_SHOP_BUYER_SELECTOR_V2 = true;
  const injectSoon = root => window.setTimeout(() => add2eInjectShopBuyerSelector(root), 0);
  Hooks.on("renderApplication", app => injectSoon(add2eAppElement(app)));
  const observer = new MutationObserver(mutations => {
    if (mutations.some(m => [...m.addedNodes].some(n => n?.nodeType === 1 && (n.matches?.(".add2e-vendor-root,.add2e-armorer-root") || n.querySelector?.(".add2e-vendor-root,.add2e-armorer-root"))))) injectSoon(document.body);
  });
  if (document.body) observer.observe(document.body, { childList: true, subtree: true });
  game.add2e = game.add2e ?? {};
  game.add2e.shopBuyerSelectorVersion = ADD2E_SHOP_BUYER_SELECTOR_VERSION;
  globalThis.ADD2E_SHOP_BUYER_SELECTOR_VERSION = ADD2E_SHOP_BUYER_SELECTOR_VERSION;
  globalThis.add2eInjectShopBuyerSelector = add2eInjectShopBuyerSelector;
  injectSoon(document.body);
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
  registerConsumablesGlobals();
  registerUiGlobals();
  registerArmorerGlobals();
  registerArmorerUiGlobals();
  registerArmorerSockets();
  registerConsumablesSockets();

  await ensureVendorOnLaunch().catch(err => console.warn("[ADD2E][VENDOR][AUTO_CREATE]", err));
  await ensureArmorerOnLaunch().catch(err => console.warn("[ADD2E][ARMORER][AUTO_CREATE]", err));
  await add2eEnforceShopTokenPresentation().catch(err => console.warn("[ADD2E][SHOP_TOKEN][PRESENTATION]", err));

  registerRecoveryHooks();
  patchActorSheetMoney();
  patchVendorTokenClick();
  patchArmorerTokenClick();
  add2eInstallShopBuyerSelectorHooks();

  window.setTimeout(bindAllVendorTokens, 500);
  window.setTimeout(bindAllArmorerTokens, 500);
  window.setTimeout(patchAttackRollProjectileConsumption, 800);
  window.setTimeout(patchAttackRollProjectileConsumption, 2000);

  console.log("[ADD2E][VENDOR][VERSION]", ADD2E_VENDOR_VERSION);
  console.log("[ADD2E][CONSUMABLES][VERSION]", ADD2E_CONSUMABLES_VERSION);
  console.log("[ADD2E][ARMORER][VERSION]", ADD2E_ARMORER_VERSION);
  console.log("[ADD2E][SHOP_BUYER_SELECTOR][VERSION]", ADD2E_SHOP_BUYER_SELECTOR_VERSION);
});
