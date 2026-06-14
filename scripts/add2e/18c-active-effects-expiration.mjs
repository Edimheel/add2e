// ============================================================================
// ADD2E — Expiration des effets temporaires.
// Version : 2026-06-01-active-effects-expiration-split-v1
// ============================================================================

import { add2eVitalEffectKind } from "./18a-vital-status-core.mjs";

export const ADD2E_ACTIVE_EFFECTS_EXPIRATION_VERSION = "2026-06-01-active-effects-expiration-split-v1";

export async function add2eExpireTemporaryEffectsForActor(actor, currentRound) {
  if (!actor) return { actor: null, deleted: 0, ids: [] };

  const toDelete = [];

  for (const effect of Array.from(actor.effects ?? [])) {
    if (!effect) continue;
    if (add2eVitalEffectKind(effect)) continue;

    const dur = effect.duration || {};
    if (effect.disabled) continue;
    if (typeof dur.rounds !== "number" || Number.isNaN(dur.rounds)) continue;

    const totalRounds = dur.rounds;
    let startRound = dur.startRound;

    if (typeof startRound !== "number" || Number.isNaN(startRound)) {
      try {
        if (!actor.effects.get(effect.id)) continue;
        await effect.update({ "duration.startRound": currentRound });
        startRound = currentRound;
      } catch (err) {
        const msg = String(err?.message || err || "");
        if (msg.includes("does not exist") || msg.includes("n'existe pas")) {
          console.warn("[ADD2E][AUTO-REMOVE][STALE_UPDATE] Effet déjà absent pendant l'initialisation startRound", {
            actor: actor.name,
            effectId: effect.id,
            effectName: effect.name
          });
          continue;
        }
        throw err;
      }
    }

    const elapsed = Math.max(0, currentRound - startRound);
    const remaining = totalRounds - elapsed;
    if (remaining <= 0) toDelete.push(effect.id);
  }

  const validIds = toDelete.filter(id => id && actor.effects.get(id));
  if (!validIds.length) return { actor: actor.name, deleted: 0, ids: [] };

  console.log("[ADD2E][AUTO-REMOVE] Suppression auto des effets expirés", { actor: actor.name, ids: validIds });

  let deleted = 0;
  for (const effectId of validIds) {
    if (!actor.effects.get(effectId)) continue;

    try {
      const effect = actor.effects.get(effectId);
      const temporaryItemId = effect?.flags?.add2e?.temporaryItemId;
      if (temporaryItemId && actor.items?.get(temporaryItemId)) await actor.deleteEmbeddedDocuments("Item", [temporaryItemId]);
      await actor.deleteEmbeddedDocuments("ActiveEffect", [effectId]);
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
