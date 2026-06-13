/**
 * scripts/add2e.mjs
 * Point d'entrée ADD2E.
 * Fichier découpé en modules dans scripts/add2e/*.mjs.
 */
import "./add2e-initiative.mjs";
import "./add2e/00-legacy-global-helpers.mjs";
import "./add2e/spell-dialog-ui.mjs";
import "./add2e/item-sheet-registration.mjs";
import "./add2e/handlebars-helpers.mjs";
import "./add2e/character-sheet-templates.mjs";
import "./add2e/monster-sheet-capabilities.mjs";
import "./add2e/01-macros-base-caracs.mjs";
import "./add2e/02-spell-sync.mjs";
import "./add2e/02b-spell-sync-dedupe.mjs";
import "./add2e/03-equipment-rules.mjs";
import "./add2e/04-class-active-abilities.mjs";
import "./add2e/object-magic-powers.mjs";
import "./add2e/06-class-effects-thief.mjs";
import "./add2e/07-spellcasting-rules.mjs";
import "./add2e/09-race-class-drop.mjs";
import "./add2e/10-monk-rules.mjs";
import "./add2e/11-character-data-prep.mjs";
import "./add2e/12-carac-roller.mjs";
import "./add2e/13-actor-sheet-legacy.mjs";
import "./add2e/14-item-sheets.mjs";
import "./add2e/15-validation-sockets.mjs";
import "./add2e/16-preparation-display.mjs";
import "./add2e/17-movement-xp.mjs";
import "./add2e/17b-multiclass.mjs";
import "./add2e/17c-multiclass-mechanics.mjs";
import "./add2e/18-token-state-overlay.mjs";
import "./add2e/20-session-xp.mjs";
import "./add2e/21-consumables.mjs";

const ADD2E_DIALOG_V2_ALERT_FALLBACK_VERSION = "2026-06-13-dialog-v2-alert-single-ok-v1";
globalThis.ADD2E_DIALOG_V2_ALERT_FALLBACK_VERSION = ADD2E_DIALOG_V2_ALERT_FALLBACK_VERSION;

function add2eInstallDialogV2AlertFallback() {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2 || typeof DialogV2.alert === "function" || typeof DialogV2.wait !== "function") return false;

  DialogV2.alert = async function add2eDialogV2AlertFallback({ window = {}, content = "", ok = {}, modal = true, classes = [] } = {}) {
    return DialogV2.wait({
      classes,
      window,
      content,
      buttons: [{ action: "ok", label: ok?.label || "OK", default: true, callback: () => true }],
      modal,
      rejectClose: false,
      close: () => true
    });
  };

  game.add2e = game.add2e ?? {};
  game.add2e.dialogV2AlertFallbackVersion = ADD2E_DIALOG_V2_ALERT_FALLBACK_VERSION;
  console.log("[ADD2E][DIALOG_V2][ALERT_FALLBACK]", ADD2E_DIALOG_V2_ALERT_FALLBACK_VERSION);
  return true;
}

Hooks.once("init", () => add2eInstallDialogV2AlertFallback());
Hooks.once("ready", () => add2eInstallDialogV2AlertFallback());
