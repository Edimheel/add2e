// ADD2E — Vendeur système : point d'entrée.
// Les boutiques sont découpées pour séparer la logique métier des interfaces ApplicationV2.

import {
  ADD2E_VENDOR_VERSION,
  VENDOR_SETTING,
  ensureVendorOnLaunch,
  registerRecoveryHooks,
  patchActorSheetMoney,
  patchAttackRollProjectileConsumption,
  registerGlobals
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
  registerGlobals as registerArmorerGlobals
} from "./22c-armorer-core.mjs";

import {
  bindAllArmorerTokens,
  patchArmorerTokenClick,
  registerArmorerUiGlobals,
  registerArmorerDirectoryButton
} from "./22d-armorer-app.mjs";

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
});

Hooks.once("ready", async () => {
  registerGlobals();
  registerUiGlobals();
  registerArmorerGlobals();
  registerArmorerUiGlobals();

  await ensureVendorOnLaunch().catch(err => console.warn("[ADD2E][VENDOR][AUTO_CREATE]", err));
  await ensureArmorerOnLaunch().catch(err => console.warn("[ADD2E][ARMORER][AUTO_CREATE]", err));

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