import {
  ADD2E_VITAL_STATUS,
  add2eVitalArray,
  add2eVitalDesiredStatus,
  add2eVitalIsMonster,
  add2eVitalNorm,
  add2eVitalReadHP,
  add2eVitalStatusAliases
} from "./18a-vital-status-core.mjs";

export const ADD2E_VITAL_STATUS_SYNC_VERSION = "2026-06-01-vital-status-split-sync-v19-clear-recovered-character-inactive";

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

function effectSummary(actor) {
  return add2eVitalArray(actor?.effects).map(e => ({
    id: e.id,
    name: e.name,
    img: e.img,
    statuses: [...(e.statuses ?? [])],
    add2e: e.flags?.add2e ?? null,
    core: e.flags?.core ?? null
  }));
}

function tokenDiagnostic(token, actor, label = "token") {
  const doc = token?.document ?? token;
  const tokenActor = token?.actor ?? doc?.actor ?? null;
  return {
    label,
    token: doc?.name ?? token?.name,
    tokenId: doc?.id ?? token?.id,
    tokenUuid: doc?.uuid,
    actor: actor?.name,
    actorId: actor?.id,
    actorLink: doc?.actorLink,
    tokenActor: tokenActor?.name ?? null,
    tokenActorId: tokenActor?.id ?? null,
    tokenActorType: tokenActor?.type ?? null,
    tokenActorIsToken: tokenActor?.isToken ?? null,
    docEffects: add2eVitalArray(doc?.effects ?? doc?._source?.effects ?? []),
    docOverlayEffect: doc?.overlayEffect ?? doc?._source?.overlayEffect ?? null,
    actorEffects: effectSummary(tokenActor)
  };
}

function hasRealDeadEffect(actor) {
  return add2eVitalArray(actor?.effects).some(e => {
    const statuses = new Set(add2eVitalArray(e?.statuses ?? e?.system?.statuses ?? []).map(add2eVitalNorm));
    return statuses.has("dead") || add2eVitalNorm(e?.flags?.core?.statusId) === "dead" || e?.img === ADD2E_VITAL_STATUS.dead.icon || add2eVitalNorm(e?.name) === "mort";
  });
}

function isVitalInactiveReason(value) {
  const reason = add2eVitalNorm(value);
  return ["dead", "mort", "unconscious", "inconscient"].includes(reason);
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
    monsterMode: "foundry-toggle-status-effect",
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

function tokenActorFor(token) {
  return token?.actor ?? token?.document?.actor ?? token?.object?.actor ?? null;
}

async function syncMonsterTokenStatus(token, actor, status) {
  const doc = token?.document ?? token;
  const tokenActor = tokenActorFor(token);
  if (!tokenActor?.toggleStatusEffect || !doc?.id) return { changed: false, action: "no-toggle-status-effect", before: tokenDiagnostic(token, actor, "before-no-toggle") };

  const before = tokenDiagnostic(token, actor, "before-toggle-status");
  const active = status === "dead";

  if (!active) {
    const hasDead = hasRealDeadEffect(tokenActor);
    console.log("[ADD2E][VITAL_STATUS][MONSTER_STATUS_TOGGLE_SKIP_OFF]", {
      token: doc.name,
      tokenId: doc.id,
      actorLink: doc.actorLink,
      tokenActor: tokenActor.name,
      tokenActorId: tokenActor.id,
      tokenActorIsToken: tokenActor.isToken,
      hasDead,
      before
    });
    return { changed: false, action: "skip-toggle-dead-off", hasDead };
  }

  let result = null;
  try {
    result = await tokenActor.toggleStatusEffect("dead", { active: true, overlay: true });
  } catch (err) {
    console.warn("[ADD2E][VITAL_STATUS][MONSTER_STATUS_TOGGLE][WARN]", { token: doc.name, tokenId: doc.id, active, err, before });
    return { changed: false, action: "toggle-warn", error: String(err?.message || err || ""), before };
  }

  const after = tokenDiagnostic(token, actor, "after-toggle-status");
  console.log("[ADD2E][VITAL_STATUS][MONSTER_STATUS_TOGGLE]", {
    token: doc.name,
    tokenId: doc.id,
    actorLink: doc.actorLink,
    tokenActor: tokenActor.name,
    tokenActorId: tokenActor.id,
    tokenActorIsToken: tokenActor.isToken,
    status,
    active,
    resultType: result?.constructor?.name ?? typeof result,
    resultId: result?.id ?? null,
    before,
    after
  });

  return { changed: result !== undefined, action: "toggle-dead-on", result: result?.id ?? result };
}

async function syncCharacterToken(token, actor, status) {
  const doc = token?.document ?? token;
  if (!doc?.update) return false;

  const icon = desiredIcon(status);
  const before = add2eVitalArray(doc.effects ?? doc._source?.effects ?? []);
  const after = before.filter(value => value !== ADD2E_VITAL_STATUS.dead.icon && value !== ADD2E_VITAL_STATUS.unconscious.icon);
  if (icon && !after.includes(icon)) after.push(icon);

  const patch = {};
  if (before.length !== after.length || before.some((value, index) => value !== after[index])) patch.effects = after;
  if (!Object.keys(patch).length) return false;

  await doc.update(patch, { add2eVitalStatusSync: true });
  console.log("[ADD2E][VITAL_STATUS][CHARACTER_TOKEN_SYNC]", { actor: actor?.name, token: doc.name, status, icon, patch });
  return true;
}

async function syncToken(token, actor, status) {
  if (add2eVitalIsMonster(actor)) return syncMonsterTokenStatus(token, actor, status);
  return { changed: await syncCharacterToken(token, actor, status), action: "character-token" };
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

function shouldPreserveManualInactive(actor) {
  return actorCombatants(actor).some(combatant => {
    const add2e = combatant?.flags?.add2e ?? {};
    const vitalStatus = add2e.vitalStatus;
    const inactiveReason = add2e.inactiveReason;
    const isVitalInactive = isVitalInactiveReason(vitalStatus) || isVitalInactiveReason(inactiveReason);
    const inactive = combatant?.defeated === true || combatant?.flags?.core?.defeated === true || add2e.inactive === true;
    return inactive && !isVitalInactive;
  });
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
      defeated: inactive,
      vitalStatus: wantedStatus
    });
    changed += 1;
  }
  return changed;
}

async function syncTokensAndCombat(actor, status, preserveInactive) {
  const tokens = actorTokens(actor);
  let tokenEffects = 0;
  const tokenResults = [];
  if (!preserveInactive) {
    for (const token of tokens) {
      const result = await syncToken(token, actor, status);
      tokenResults.push({ tokenId: token?.document?.id ?? token?.id, token: token?.document?.name ?? token?.name, result });
      if (result?.changed) tokenEffects += 1;
    }
  }
  const combatants = preserveInactive ? 0 : await syncCombatants(actor, status !== null, status);
  return { tokenEffects, combatants, tokenCount: tokens.length, monsterMode: add2eVitalIsMonster(actor) ? "foundry-toggle-status-effect" : "actor", tokenResults };
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
    const preserveInactive = !isMonster && status === null && shouldPreserveManualInactive(actor);
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
      tokenActorEffect: isMonster,
      tokenOverlay: false,
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
