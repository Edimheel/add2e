// scripts/add2e-attack/04b-attack-roll-core.mjs
// ADD2E — Point d'entrée du combat normal.
// Les portes d'action des ActiveEffects sont installées hors du combat,
// par le façage effects-engine.mjs après le chargement des modules.
// Les VFX d'armes sont déclenchés explicitement une seule fois après la résolution canonique.

import { add2eAttackRoll as add2eAttackRollBase } from "./04-attack-roll.mjs";

export const ADD2E_ATTACK_ROLL_CORE_VERSION = "2026-07-24-normal-combat-explicit-weapon-vfx-v3";

globalThis.ADD2E_ATTACK_ROLL_SPLIT_VERSION = ADD2E_ATTACK_ROLL_CORE_VERSION;

function add2eActorFromAttackPayload(payload = {}) {
  return payload.actor
    ?? (payload.actorId ? game.actors?.get?.(payload.actorId) : null)
    ?? payload.token?.actor
    ?? payload.sourceToken?.actor
    ?? canvas?.tokens?.controlled?.[0]?.actor
    ?? null;
}

function add2eWeaponFromAttackPayload(actor, payload = {}) {
  return payload.arme
    ?? payload.weapon
    ?? payload.item
    ?? (actor && payload.itemId ? actor.items?.get?.(payload.itemId) : null)
    ?? (actor && payload.armeId ? actor.items?.get?.(payload.armeId) : null)
    ?? (actor && payload.weaponId ? actor.items?.get?.(payload.weaponId) : null)
    ?? null;
}

function add2eSourceTokenFromAttackPayload(actor, payload = {}) {
  if (payload.sourceToken) return payload.sourceToken;
  if (payload.token) return payload.token;
  const controlled = canvas?.tokens?.controlled ?? [];
  return controlled.find(token => token?.actor?.id === actor?.id || token?.document?.actorId === actor?.id)
    ?? actor?.getActiveTokens?.()?.[0]
    ?? actor?.token?.object
    ?? actor?.token
    ?? null;
}

function add2eTargetTokenFromAttackPayload(payload = {}) {
  return payload.targetToken
    ?? payload.cibleToken
    ?? Array.from(game.user?.targets ?? [])[0]
    ?? null;
}

async function add2ePlayResolvedWeaponVfx({ actor, weapon, sourceToken, targetToken } = {}) {
  if (!actor || !weapon || !targetToken || typeof globalThis.ADD2E_PLAY_WEAPON_FX !== "function") return false;
  try {
    return await globalThis.ADD2E_PLAY_WEAPON_FX({
      actor,
      weapon,
      sourceToken,
      targetToken
    });
  } catch (error) {
    console.warn("[ADD2E][JB2A][WEAPON][RESOLVED_ATTACK_VFX_ERROR]", {
      actor: actor?.name,
      weapon: weapon?.name,
      error
    });
    return false;
  }
}

async function add2eAttackRollWithResolvedWeaponVfx(...args) {
  const payload = args?.[0] ?? {};
  const actor = add2eActorFromAttackPayload(payload);
  const weapon = add2eWeaponFromAttackPayload(actor, payload);
  const sourceToken = add2eSourceTokenFromAttackPayload(actor, payload);
  const targetTokenBeforeRoll = add2eTargetTokenFromAttackPayload(payload);

  const result = await add2eAttackRollBase.apply(this, args);
  if (result === true) {
    await add2ePlayResolvedWeaponVfx({
      actor,
      weapon,
      sourceToken,
      targetToken: payload.targetToken
        ?? payload.cibleToken
        ?? targetTokenBeforeRoll
        ?? Array.from(game.user?.targets ?? [])[0]
        ?? null
    });
  }
  return result;
}

Object.defineProperties(add2eAttackRollWithResolvedWeaponVfx, {
  __add2eDirectResolvedWeaponFx: { value: ADD2E_ATTACK_ROLL_CORE_VERSION, configurable: true },
  __add2eOriginalAttackRoll: { value: add2eAttackRollBase, configurable: true }
});

globalThis.add2eAttackRoll = add2eAttackRollWithResolvedWeaponVfx;

export { add2eAttackRollWithResolvedWeaponVfx as add2eAttackRoll };