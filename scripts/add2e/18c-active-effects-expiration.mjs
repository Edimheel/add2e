// ============================================================================
// ADD2E — Expiration des effets temporaires.
// Version : 2026-06-14-active-effects-expiration-time-tick-v2
// ============================================================================

import { add2eVitalEffectKind } from "./18a-vital-status-core.mjs";
import {
  add2eTimeNormalizeEffect,
  add2eTimeRemainingRounds
} from "./19a-time-engine.mjs";

export const ADD2E_ACTIVE_EFFECTS_EXPIRATION_VERSION = "2026-06-14-active-effects-expiration-time-tick-v2";

function isFiniteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n);
}

function numeric(value, fallback = NaN) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function hasTimedDuration(effect) {
  const duration = effect?.duration ?? {};
  const flags = effect?.flags?.add2e ?? {};
  return isFiniteNumber(duration.rounds) ||
    isFiniteNumber(duration.remaining) ||
    isFiniteNumber(flags.rounds) ||
    isFiniteNumber(flags.durationRounds) ||
    isFiniteNumber(flags.dureeRounds) ||
    isFiniteNumber(flags.duree_rounds) ||
    isFiniteNumber(flags.roundEngine?.totalRounds) ||
    isFiniteNumber(flags.timeEngine?.totalRounds) ||
    isFiniteNumber(flags.duration?.rounds) ||
    isFiniteNumber(flags.duration?.durationRounds);
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

    const remainingData = add2eTimeRemainingRounds(effect, effectiveRound);
    let remaining = remainingData?.remaining;

    if (!Number.isFinite(Number(remaining)) && Number.isFinite(Number(effect.duration?.remaining))) {
      remaining = Number(effect.duration.remaining);
    }

    if (Number.isFinite(Number(remaining)) && Number(remaining) <= 0) toDelete.push(effect.id);
  }

  const validIds = toDelete.filter(id => id && actor.effects.get(id));
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
