// ============================================================================
// ADD2E — Expiration des effets temporaires.
// Version : 2026-06-14-active-effects-expiration-combat-first-v1
// ============================================================================

import { add2eVitalEffectKind } from "./18a-vital-status-core.mjs";
import {
  add2eTimeNormalizeEffect,
  add2eTimeRemainingRounds
} from "./19a-time-engine.mjs";

export const ADD2E_ACTIVE_EFFECTS_EXPIRATION_VERSION = "2026-06-14-active-effects-expiration-combat-first-v1";

function numeric(value, fallback = NaN) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function hasTimedDuration(effect) {
  const duration = effect?.duration ?? {};
  const flags = effect?.flags?.add2e ?? {};
  return Number.isFinite(Number(duration.rounds)) ||
    Number.isFinite(Number(duration.remaining)) ||
    Number.isFinite(Number(flags.rounds)) ||
    Number.isFinite(Number(flags.durationRounds)) ||
    Number.isFinite(Number(flags.dureeRounds)) ||
    Number.isFinite(Number(flags.duree_rounds)) ||
    Number.isFinite(Number(flags.roundEngine?.totalRounds)) ||
    Number.isFinite(Number(flags.timeEngine?.totalRounds)) ||
    Number.isFinite(Number(flags.duration?.rounds)) ||
    Number.isFinite(Number(flags.duration?.durationRounds));
}

function combatRemaining(effect, currentRound) {
  const duration = effect?.duration ?? {};
  const totalRounds = numeric(duration.rounds, NaN);
  const startRound = numeric(duration.startRound, NaN);
  const round = numeric(currentRound, NaN);
  if (!Number.isFinite(totalRounds) || totalRounds <= 0) return null;
  if (!Number.isFinite(startRound) || startRound <= 0) return null;
  if (!Number.isFinite(round) || round <= 0) return null;
  const elapsed = Math.max(0, round - startRound);
  return {
    totalRounds,
    elapsed,
    remaining: Math.max(0, totalRounds - elapsed),
    startRound,
    currentRound: round,
    clock: "combat"
  };
}

function remainingForEffect(effect, currentRound) {
  const byCombat = combatRemaining(effect, currentRound);
  if (byCombat) return byCombat;

  const byTime = add2eTimeRemainingRounds(effect, currentRound);
  if (byTime) return byTime;

  const nativeRemaining = numeric(effect?.duration?.remaining, NaN);
  if (Number.isFinite(nativeRemaining)) return { remaining: nativeRemaining, clock: "native" };

  return null;
}

async function deleteTemporaryLinkedItem(actor, effect) {
  const temporaryItemId = effect?.flags?.add2e?.temporaryItemId;
  if (temporaryItemId && actor.items?.get(temporaryItemId)) await actor.deleteEmbeddedDocuments("Item", [temporaryItemId]);
}

export async function add2eExpireTemporaryEffectsForActor(actor, currentRound = game.combat?.round ?? 0) {
  if (!actor) return { actor: null, deleted: 0, ids: [] };

  const effectiveRound = numeric(currentRound, game.combat?.round ?? 0);
  const toDelete = [];

  for (const effect of Array.from(actor.effects ?? [])) {
    if (!effect) continue;
    if (add2eVitalEffectKind(effect)) continue;
    if (effect.disabled) continue;
    if (!actor.effects.get(effect.id)) continue;
    if (!hasTimedDuration(effect)) continue;

    try {
      await add2eTimeNormalizeEffect(effect, effectiveRound);
    } catch (err) {
      const msg = String(err?.message || err || "");
      if (msg.includes("does not exist") || msg.includes("n'existe pas")) continue;
      console.warn("[ADD2E][AUTO-REMOVE][NORMALIZE_FAILED]", { actor: actor.name, effectId: effect.id, effectName: effect.name, err });
    }

    if (!actor.effects.get(effect.id)) continue;

    const remainingData = remainingForEffect(effect, effectiveRound);
    const remaining = Number(remainingData?.remaining);
    if (Number.isFinite(remaining) && remaining <= 0) toDelete.push(effect.id);
  }

  const validIds = [...new Set(toDelete)].filter(id => id && actor.effects.get(id));
  if (!validIds.length) return { actor: actor.name, deleted: 0, ids: [] };

  console.log("[ADD2E][AUTO-REMOVE] Suppression auto des effets expirés", { actor: actor.name, ids: validIds });

  let deleted = 0;
  for (const effectId of validIds) {
    const effect = actor.effects.get(effectId);
    if (!effect) continue;

    try {
      await deleteTemporaryLinkedItem(actor, effect);
      if (actor.effects.get(effectId)) await actor.deleteEmbeddedDocuments("ActiveEffect", [effectId]);
      deleted += 1;
    } catch (err) {
      const msg = String(err?.message || err || "");
      if (msg.includes("does not exist") || msg.includes("n'existe pas")) {
        console.warn("[ADD2E][AUTO-REMOVE][ALREADY_GONE] Effet déjà absent, suppression ignorée", { actor: actor.name, effectId, err });
        continue;
      }
      console.error("[ADD2E][AUTO-REMOVE][DELETE_ERROR] Suppression impossible", { actor: actor.name, effectId, err });
    }
  }

  return { actor: actor.name, deleted, ids: validIds };
}
