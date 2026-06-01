// ============================================================================
// ADD2E — Point d'entrée : expiration des effets + états vitaux.
// Version : 2026-06-01-active-effects-expire-split-entry-v2
// ============================================================================

import { ADD2E_VITAL_STATUS_CORE_VERSION } from "./add2e/18a-vital-status-core.mjs";
import {
  ADD2E_VITAL_STATUS_SYNC_VERSION,
  add2eSyncActorVitalStatus,
  add2eVitalRegisterStatusEffects
} from "./add2e/18b-vital-status-sync.mjs";
import {
  ADD2E_ACTIVE_EFFECTS_EXPIRATION_VERSION,
  add2eExpireTemporaryEffectsForActor
} from "./add2e/18c-active-effects-expiration.mjs";

globalThis.ADD2E_ACTIVE_EFFECTS_EXPIRE_VERSION = "2026-06-01-active-effects-expire-split-entry-v2";
globalThis.ADD2E_VITAL_STATUS_CORE_VERSION = ADD2E_VITAL_STATUS_CORE_VERSION;
globalThis.ADD2E_VITAL_STATUS_SYNC_VERSION = ADD2E_VITAL_STATUS_SYNC_VERSION;
globalThis.ADD2E_ACTIVE_EFFECTS_EXPIRATION_VERSION = ADD2E_ACTIVE_EFFECTS_EXPIRATION_VERSION;
globalThis.add2eSyncActorVitalStatus = add2eSyncActorVitalStatus;
globalThis.add2eVitalRegisterStatusEffects = add2eVitalRegisterStatusEffects;

console.log("[ADD2E][AUTO-REMOVE][VERSION]", {
  entry: globalThis.ADD2E_ACTIVE_EFFECTS_EXPIRE_VERSION,
  core: ADD2E_VITAL_STATUS_CORE_VERSION,
  sync: ADD2E_VITAL_STATUS_SYNC_VERSION,
  expiration: ADD2E_ACTIVE_EFFECTS_EXPIRATION_VERSION
});

Hooks.once("init", add2eVitalRegisterStatusEffects);
Hooks.once("setup", add2eVitalRegisterStatusEffects);
Hooks.once("ready", add2eVitalRegisterStatusEffects);

Hooks.on("updateActor", async (actor, changed, options, userId) => {
  if (!game.user?.isGM) return;
  if (options?.add2eVitalStatusSync) return;

  const hpChanged = foundry.utils.hasProperty(changed, "system.pdv") ||
    foundry.utils.hasProperty(changed, "system.pv") ||
    foundry.utils.hasProperty(changed, "system.hp") ||
    foundry.utils.hasProperty(changed, "system.points_de_coup");

  if (!hpChanged) return;
  window.setTimeout(() => add2eSyncActorVitalStatus(actor, { reason: "updateActor:hp" }), 30);
});

Hooks.once("ready", () => {
  if (!game.user?.isGM) return;

  window.setTimeout(() => {
    add2eVitalRegisterStatusEffects();

    for (const actor of game.actors ?? []) {
      add2eSyncActorVitalStatus(actor, { reason: "ready-scan" });
    }

    for (const token of canvas?.tokens?.placeables ?? []) {
      if (token?.actor) add2eSyncActorVitalStatus(token.actor, { reason: "ready-token-scan" });
    }
  }, 500);
});

Hooks.on("updateCombat", async (combat, changed, options, userId) => {
  if (!("round" in changed) && !("turn" in changed)) return;

  const currentRound = combat.round ?? 0;
  console.log("[ADD2E][AUTO-REMOVE] updateCombat déclenché :", { round: currentRound, changed });

  try {
    add2eVitalRegisterStatusEffects();

    for (const combatant of combat.combatants || []) {
      if (!combatant) continue;

      const actor = combatant.actor;
      if (!actor) {
        console.warn("[ADD2E][AUTO-REMOVE] combatant sans actor :", combatant);
        continue;
      }

      await add2eExpireTemporaryEffectsForActor(actor, currentRound);
      await add2eSyncActorVitalStatus(actor, { reason: "updateCombat:scan" });
    }
  } catch (err) {
    console.error("[ADD2E][AUTO-REMOVE] ERREUR dans updateCombat(auto-remove-effects) :", err);
  }
});
