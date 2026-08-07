// scripts/add2e-attack/04b-attack-roll-core.mjs
// ADD2E — Point d'entrée du combat normal.
// Les portes d'action des ActiveEffects sont installées hors du combat,
// par le façage effects-engine.mjs après le chargement des modules.
// Les VFX d'armes sont déclenchés explicitement une seule fois après la résolution canonique.

import { add2eAttackRoll as add2eAttackRollBase } from "./04-attack-roll.mjs";
import {
  resolveProjectileForAttack,
  spendProjectileForAttack
} from "../add2e/22a-vendor-core.mjs";

export const ADD2E_ATTACK_ROLL_CORE_VERSION = "2026-08-07-canonical-projectile-path-v4";

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

function add2eProjectileWeaponForAttack(weapon, projectile) {
  const projectileSystem = projectile?.system ?? {};
  const weaponSystem = weapon?.system ?? {};
  const systemForAttack = {
    ...weaponSystem,
    degats: projectileSystem.degats ?? projectileSystem.dégâts ?? weaponSystem.degats,
    dégâts: projectileSystem.dégâts ?? projectileSystem.degats ?? weaponSystem.dégâts,
    type_degats: projectileSystem.type_degats ?? weaponSystem.type_degats
  };

  return new Proxy(weapon, {
    get(target, property, receiver) {
      if (property === "system") return systemForAttack;
      return Reflect.get(target, property, receiver);
    }
  });
}

async function add2ePrepareProjectileAttack(actor, weapon, payload) {
  if (!actor || !weapon) {
    return { ok: true, payload, attackWeapon: weapon, consumeProjectile: false };
  }

  const resolved = resolveProjectileForAttack({ actor, arme: weapon });
  if (!resolved.required || resolved.ignored) {
    return { ok: true, payload, attackWeapon: weapon, consumeProjectile: false };
  }

  if (!resolved.ok || !resolved.projectile) {
    await spendProjectileForAttack({ actor, arme: weapon });
    return { ok: false, payload, attackWeapon: weapon, consumeProjectile: false };
  }

  const attackWeapon = add2eProjectileWeaponForAttack(weapon, resolved.projectile);
  return {
    ok: true,
    payload: { ...payload, actor, arme: attackWeapon },
    attackWeapon,
    consumeProjectile: true
  };
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
  const projectile = await add2ePrepareProjectileAttack(actor, weapon, payload);
  if (!projectile.ok) return false;

  const attackArgs = [projectile.payload, ...args.slice(1)];
  const result = await add2eAttackRollBase.apply(this, attackArgs);
  if (result === true) {
    if (projectile.consumeProjectile) {
      await spendProjectileForAttack({ actor, arme: weapon });
    }
    await add2ePlayResolvedWeaponVfx({
      actor,
      weapon: projectile.attackWeapon ?? weapon,
      sourceToken,
      targetToken: projectile.payload.targetToken
        ?? projectile.payload.cibleToken
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