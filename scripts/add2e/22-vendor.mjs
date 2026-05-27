// ADD2E — Vendeur système : point d'entrée.
// Le vendeur est découpé pour séparer la logique métier de l'interface ApplicationV2.

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

Hooks.once("init", () => {
  game.settings.register("add2e", VENDOR_SETTING, {
    name: "ADD2E — Création du vendeur système",
    hint: "Version du vendeur de composants, projectiles et équipements créé automatiquement.",
    scope: "world",
    config: false,
    type: String,
    default: ""
  });

  registerVendorDirectoryButton();
});

Hooks.once("ready", async () => {
  registerGlobals();
  registerUiGlobals();

  await ensureVendorOnLaunch().catch(err => console.warn("[ADD2E][VENDOR][AUTO_CREATE]", err));

  registerRecoveryHooks();
  patchActorSheetMoney();
  patchVendorTokenClick();

  window.setTimeout(bindAllVendorTokens, 500);
  window.setTimeout(patchAttackRollProjectileConsumption, 800);
  window.setTimeout(patchAttackRollProjectileConsumption, 2000);

  console.log("[ADD2E][VENDOR][VERSION]", ADD2E_VENDOR_VERSION);
});
