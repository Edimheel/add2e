// ADD2E — Relais MJ : dégâts et effets.
// Version : 2026-06-14-gm-relay-effects-normalize-duration-v1

import { relayArray, relayNormalize, resolveActor } from "./15b0-gm-relay-common.mjs";

function currentCombatRound() {
  const round = Number(game.combat?.round ?? 0);
  return Number.isFinite(round) && round > 0 ? round : 0;
}

async function normalizeCreatedEffect(effect) {
  if (!effect) return;
  try {
    if (typeof game.add2e?.time?.normalizeEffect === "function") {
      await game.add2e.time.normalizeEffect(effect, currentCombatRound());
    }
  } catch (err) {
    console.warn("[ADD2E][GM-RELAY][ACTIVE_EFFECT_NORMALIZE_FAILED]", { effect: effect.name, effectId: effect.id, err });
  }
}

export async function applyDamage(payload) {
  const targetActor = await resolveActor(payload);
  if (!targetActor) return console.warn("[ADD2E][GM-RELAY][applyDamage] acteur introuvable :", payload);

  const sys = targetActor.system ?? {};
  const amount = Math.abs(Number(payload.montant) || 0);
  if (!amount) return;

  const max = Number(sys.points_de_coup)
    || Number(sys.pv_max)
    || Number(sys.points_de_vie)
    || Number(sys.hp?.max)
    || Number(sys.attributes?.hp?.max)
    || 0;

  const current = [sys.pdv, sys.pv, sys.hp?.value, sys.attributes?.hp?.value]
    .map(v => Number(v))
    .find(v => Number.isFinite(v)) ?? max;

  const isHeal = String(payload.type ?? "").toLowerCase().includes("soin") || Number(payload.montant) < 0;
  const next = isHeal ? Math.min(max || current + amount, current + amount) : current - amount;

  await targetActor.update(
    { "system.pdv": next },
    { add2eReason: "gm-relay-apply-damage", add2eDetails: payload.details }
  );
}

export async function deleteActiveEffects(payload) {
  const targetActor = await resolveActor(payload);
  if (!targetActor) return console.warn("[ADD2E][GM-RELAY][deleteActiveEffects] acteur introuvable :", payload);

  const ids = new Set(relayArray(payload.effectIds).filter(Boolean));
  const tagNorms = relayArray(payload.tags).map(relayNormalize);
  const nameNorms = relayArray(payload.names).map(relayNormalize);

  if (tagNorms.length || nameNorms.length) {
    for (const effect of targetActor.effects ?? []) {
      const tags = relayArray(effect.flags?.add2e?.tags ?? effect.getFlag?.("add2e", "tags") ?? []).map(relayNormalize);
      const name = relayNormalize(effect.name);
      if (tagNorms.some(t => tags.includes(t)) || nameNorms.some(n => name.includes(n))) ids.add(effect.id);
    }
  }

  const finalIds = [...ids].filter(Boolean);
  if (finalIds.length) await targetActor.deleteEmbeddedDocuments("ActiveEffect", finalIds);
}

export async function createActiveEffect(payload) {
  const targetActor = await resolveActor(payload);
  if (!targetActor) return console.warn("[ADD2E][GM-RELAY][createActiveEffect] acteur introuvable :", payload);

  const effectData = foundry.utils.duplicate(payload.effectData ?? {});
  delete effectData._id;
  const created = await targetActor.createEmbeddedDocuments("ActiveEffect", [effectData]);
  await normalizeCreatedEffect(created?.[0]);
}

export async function applyLegacyActiveEffect(data) {
  const targetActor = await resolveActor(data);
  if (!targetActor) return console.warn("[ADD2E SOCKET][applyActiveEffect] ACTEUR CIBLE INTROUVABLE", data);

  const effectData = foundry.utils.deepClone(data.effectData || {});
  if (!effectData.name && effectData.label) effectData.name = effectData.label;
  if (!effectData.label && effectData.name) effectData.label = effectData.name;
  effectData.flags ??= {};
  effectData.flags.add2e ??= {};
  effectData.flags.add2e.appliedBySocket = true;
  effectData.flags.add2e.appliedByGM = game.user.id;
  effectData.flags.add2e.appliedAt = Date.now();
  const created = await targetActor.createEmbeddedDocuments("ActiveEffect", [effectData]);
  await normalizeCreatedEffect(created?.[0]);
}
