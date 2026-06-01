import {
  ADD2E_VITAL_STATUS,
  add2eVitalArray,
  add2eVitalDesiredStatus,
  add2eVitalIsMonster,
  add2eVitalNorm,
  add2eVitalReadHP,
  add2eVitalStatusAliases
} from "./18a-vital-status-core.mjs";

export const ADD2E_VITAL_STATUS_SYNC_VERSION = "2026-06-01-vital-status-split-sync-v13-token-only-monsters";

const LOCKS = new Set();

function mergeStatus(base, patch) {
  try {
    return foundry.utils.mergeObject(foundry.utils.deepClone(base ?? {}), foundry.utils.deepClone(patch ?? {}), { inplace: false, insertKeys: true, overwrite: true });
  } catch (_err) {
    return { ...(base ?? {}), ...(patch ?? {}) };
  }
}

function statusDebug(id) {
  const wanted = add2eVitalNorm(id);
  const effect = CONFIG.statusEffects?.find(e => add2eVitalStatusAliases(e).includes(wanted) || add2eVitalNorm(e?.id) === wanted || add2eVitalNorm(e?._id) === wanted);
  if (!effect) return null;
  return {
    id: effect.id,
    _id: effect._id,
    name: effect.name,
    label: effect.label,
    img: effect.img,
    icon: effect.icon,
    statuses: effect.statuses,
    special: effect.special,
    flags: effect.flags
  };
}

export function add2eVitalRegisterStatusEffects() {
  CONFIG.statusEffects = Array.isArray(CONFIG.statusEffects) ? CONFIG.statusEffects : [];
  CONFIG.specialStatusEffects ??= {};
  CONFIG.specialStatusEffects.DEFEATED = "dead";

  for (const definition of [
    {
      id: "dead",
      name: "Mort",
      label: "Mort",
      img: ADD2E_VITAL_STATUS.dead.icon,
      icon: ADD2E_VITAL_STATUS.dead.icon,
      statuses: ["dead"],
      special: "DEFEATED",
      flags: { core: { statusId: "dead" }, add2e: { vitalStatus: "dead", autoVitalStatus: true } }
    },
    {
      id: "unconscious",
      name: "Inconscient",
      label: "Inconscient",
      img: ADD2E_VITAL_STATUS.unconscious.icon,
      icon: ADD2E_VITAL_STATUS.unconscious.icon,
      statuses: ["unconscious", "incapacitated"],
      flags: { core: { statusId: "unconscious" }, add2e: { vitalStatus: "unconscious", autoVitalStatus: true } }
    }
  ]) {
    const wanted = add2eVitalNorm(definition.id);
    const index = CONFIG.statusEffects.findIndex(effect => add2eVitalStatusAliases(effect).includes(wanted) || add2eVitalNorm(effect?.id) === wanted || add2eVitalNorm(effect?._id) === wanted);
    if (index >= 0) CONFIG.statusEffects[index] = mergeStatus(CONFIG.statusEffects[index], definition);
    else CONFIG.statusEffects.push(foundry.utils?.deepClone ? foundry.utils.deepClone(definition) : { ...definition });
  }

  console.log("[ADD2E][VITAL_STATUS][REGISTER_STATUS]", {
    version: globalThis.ADD2E_ACTIVE_EFFECTS_EXPIRE_VERSION,
    core: globalThis.ADD2E_VITAL_STATUS_CORE_VERSION,
    sync: ADD2E_VITAL_STATUS_SYNC_VERSION,
    cleanup: false,
    monsterMode: "token-only",
    defeatedStatus: CONFIG.specialStatusEffects.DEFEATED,
    dead: statusDebug("dead"),
    unconscious: statusDebug("unconscious")
  });
}

function actorTokens(actor) {
  const tokens = [];
  try { tokens.push(...(actor?.getActiveTokens?.(true, true) ?? [])); } catch (_err) {}
  try { tokens.push(...(canvas?.tokens?.placeables ?? []).filter(t => t?.actor?.id === actor?.id || t?.document?.actorId === actor?.id)); } catch (_err) {}
  const seen = new Set();
  return tokens.filter(token => {
    const id = token?.document?.uuid ?? token?.id ?? token?.document?.id;
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return !!token?.document;
  });
}

function desiredIcon(status) {
  if (status === "dead") return ADD2E_VITAL_STATUS.dead.icon;
  if (status === "unconscious") return ADD2E_VITAL_STATUS.unconscious.icon;
  return null;
}

async function syncToken(token, actor, status) {
  const doc = token?.document ?? token;
  if (!doc?.update) return false;

  const icon = desiredIcon(status);
  const before = add2eVitalArray(doc.effects ?? doc._source?.effects ?? []);
  const after = before.filter(value => value !== ADD2E_VITAL_STATUS.dead.icon && value !== ADD2E_VITAL_STATUS.unconscious.icon && !String(value ?? "").includes("add2e-monster-dead"));
  if (icon && !after.includes(icon)) after.push(icon);

  const patch = {};
  if (before.length !== after.length || before.some((value, index) => value !== after[index])) patch.effects = after;

  const overlay = doc.overlayEffect ?? doc._source?.overlayEffect ?? null;
  if (overlay === ADD2E_VITAL_STATUS.dead.icon || overlay === ADD2E_VITAL_STATUS.unconscious.icon || String(overlay ?? "").includes("add2e-monster-dead")) patch.overlayEffect = null;

  if (!Object.keys(patch).length) return false;
  await doc.update(patch, { add2eVitalStatusSync: true });
  console.log("[ADD2E][VITAL_STATUS][TOKEN_SYNC]", {
    actor: actor?.name,
    actorId: actor?.id,
    token: doc.name,
    tokenId: doc.id,
    actorLink: doc.actorLink,
    status,
    icon,
    before,
    patch,
    after: add2eVitalArray(doc.effects ?? doc._source?.effects ?? [])
  });
  return true;
}

function actorCombatants(actor) {
  const combats = [game.combat, ...add2eVitalArray(game.combats)].filter(Boolean);
  const out = [];
  const seen = new Set();
  for (const combat of combats) {
    for (const combatant of add2eVitalArray(combat?.combatants)) {
      if (!combatant?.id) continue;
      const same = combatant.actor?.id === actor?.id || combatant.actorId === actor?.id || combatant.token?.actorId === actor?.id;
      if (!same) continue;
      const key = `${combat.id}:${combatant.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(combatant);
    }
  }
  return out;
}

function hasInactive(actor) {
  return actorCombatants(actor).some(combatant => combatant?.defeated === true || combatant?.flags?.core?.defeated === true || combatant?.flags?.add2e?.inactive === true);
}

async function syncCombatants(actor, inactive, status) {
  let changed = 0;
  for (const combatant of actorCombatants(actor)) {
    if (!combatant?.update) continue;
    const currentStatus = combatant.flags?.add2e?.vitalStatus ?? null;
    const wantedStatus = inactive ? status : null;
    const same = combatant.defeated === inactive && combatant.flags?.add2e?.inactive === inactive && currentStatus === wantedStatus;
    if (same) continue;
    await combatant.update({
      defeated: inactive,
      "flags.add2e.inactive": inactive,
      "flags.add2e.inactiveReason": inactive ? wantedStatus : null,
      "flags.add2e.vitalStatus": wantedStatus
    }, { add2eVitalStatusSync: true });
    console.log("[ADD2E][VITAL_STATUS][COMBATANT_SYNC]", {
      actor: actor?.name,
      actorId: actor?.id,
      combatant: combatant.id,
      tokenId: combatant.tokenId,
      inactive,
      vitalStatus: wantedStatus
    });
    changed += 1;
  }
  return changed;
}

async function syncTokensAndCombat(actor, status, preserveInactive) {
  let tokenEffects = 0;
  const tokens = actorTokens(actor);
  if (!preserveInactive) {
    for (const token of tokens) {
      if (await syncToken(token, actor, status)) tokenEffects += 1;
    }
  }
  const combatants = preserveInactive ? 0 : await syncCombatants(actor, status !== null, status);
  return { tokenEffects, combatants, tokenCount: tokens.length, monsterMode: add2eVitalIsMonster(actor) ? "token-only" : "actor" };
}

export async function add2eSyncActorVitalStatus(actor, { reason = "sync" } = {}) {
  if (!actor || !(add2eVitalNorm(actor?.type) === "personnage" || add2eVitalIsMonster(actor))) return false;
  if (!game.user?.isGM) return false;

  const key = actor.uuid ?? actor.id;
  if (LOCKS.has(key)) return false;
  LOCKS.add(key);

  try {
    add2eVitalRegisterStatusEffects();
    const status = add2eVitalDesiredStatus(actor);
    const isMonster = add2eVitalIsMonster(actor);
    const preserveInactive = !isMonster && hasInactive(actor) && status === null;
    const state = await syncTokensAndCombat(actor, status, preserveInactive);
    console.log("[ADD2E][VITAL_STATUS][SYNC]", {
      reason,
      actor: actor.name,
      actorId: actor.id,
      type: actor.type,
      isMonster,
      hp: add2eVitalReadHP(actor),
      status,
      preserveInactive,
      cleanup: false,
      tokenActorEffect: false,
      state
    });
    return true;
  } catch (err) {
    console.error("[ADD2E][VITAL_STATUS][ERROR]", { actor: actor?.name, reason, err });
    return false;
  } finally {
    LOCKS.delete(key);
  }
}
