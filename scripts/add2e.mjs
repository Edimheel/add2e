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
import "./add2e/18-token-state-overlay.mjs";
import "./add2e/19-action-hud-free-drag.mjs";
import "./add2e/20-session-xp.mjs";
import "./add2e/21-session-xp-v13-fix.mjs";

// ADD2E — HUD maison : suivi du combattant actif
// Pas de nouveau fichier : ce patch complète les scripts HUD existants chargés ci-dessus.
const ADD2E_ACTION_HUD_COMBAT_SYNC_VERSION = "2026-05-24-action-hud-combat-turn-sync-inline-v1";
globalThis.ADD2E_ACTION_HUD_COMBAT_SYNC_VERSION = ADD2E_ACTION_HUD_COMBAT_SYNC_VERSION;

function add2eCombatHudElement() {
  return document.getElementById("add2e-action-hud");
}

function add2eCombatHudCurrentCombatant(combat = game.combat) {
  if (!combat) return null;
  return combat.combatant ?? combat.combatants?.get?.(combat.current?.combatantId) ?? null;
}

function add2eCombatHudTokenFromCombatant(combatant) {
  if (!combatant) return null;
  try {
    if (combatant.token?.object) return combatant.token.object;
    if (combatant.tokenId && canvas?.tokens?.get) return canvas.tokens.get(combatant.tokenId) ?? null;
    if (combatant.token?.id && canvas?.tokens?.get) return canvas.tokens.get(combatant.token.id) ?? null;
  } catch (_err) {}
  return null;
}

function add2eCombatHudCanShowActor(actor) {
  if (!actor) return false;
  const type = String(actor.type ?? "").toLowerCase();
  if (type === "personnage") return game.user.isGM || actor.isOwner || actor.testUserPermission?.(game.user, "OWNER");
  if (type === "monster") return game.user.isGM;
  return false;
}

function add2eCombatHudFollowCurrent(combat = game.combat, { forceOpen = false } = {}) {
  const hudExists = !!add2eCombatHudElement();
  if (!forceOpen && !hudExists) return false;

  const combatant = add2eCombatHudCurrentCombatant(combat);
  const actor = combatant?.actor ?? null;
  if (!add2eCombatHudCanShowActor(actor)) {
    if (hudExists) globalThis.add2eCloseActionHud?.();
    return false;
  }

  if (typeof globalThis.add2eRenderActionHud !== "function") return false;
  globalThis.add2eRenderActionHud(actor, add2eCombatHudTokenFromCombatant(combatant));
  return true;
}

function add2eCombatHudScheduleFollow(combat = game.combat, options = {}) {
  window.setTimeout(() => add2eCombatHudFollowCurrent(combat, options), 80);
}

Hooks.on("updateCombat", (combat, changes) => {
  if (!foundry.utils.hasProperty(changes ?? {}, "turn") && !foundry.utils.hasProperty(changes ?? {}, "round")) return;
  add2eCombatHudScheduleFollow(combat);
});

Hooks.on("createCombatant", combatant => {
  if (combatant?.combat === game.combat) add2eCombatHudScheduleFollow(game.combat);
});

Hooks.on("deleteCombatant", combatant => {
  if (combatant?.combat === game.combat) add2eCombatHudScheduleFollow(game.combat);
});

Hooks.once("ready", () => {
  globalThis.add2eHudFollowCurrentCombatant = () => add2eCombatHudFollowCurrent(game.combat, { forceOpen: true });
  game.add2e = game.add2e ?? {};
  game.add2e.actionHudCombatSyncVersion = ADD2E_ACTION_HUD_COMBAT_SYNC_VERSION;
  game.add2e.followCurrentCombatantHud = globalThis.add2eHudFollowCurrentCombatant;
  console.log("[ADD2E][ACTION_HUD][COMBAT_SYNC]", ADD2E_ACTION_HUD_COMBAT_SYNC_VERSION);
});
