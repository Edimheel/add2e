import {
  ADD2E_VITAL_STATUS,
  add2eVitalArray,
  add2eVitalDesiredStatus,
  add2eVitalIsMonster,
  add2eVitalNorm,
  add2eVitalReadHP,
  add2eVitalStatusAliases
} from "./18a-vital-status-core.mjs";

export const ADD2E_VITAL_STATUS_SYNC_VERSION = "2026-06-11-vital-status-sync-no-console-logs";

const LOCKS = new Set();
const ADD2E_STATUS_IDS = {
  dead: "ADD2Edead0000000",
  unconscious: "ADD2Eunconsc0000"
};

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
    actor: actor?.name,
    actorId: actor?.id,
    actorUuid: actor?.uuid ?? null,
    actorIsToken: actor?.isToken ?? null,
    actorTokenId: actorTokenDocumentId(actor),
    actorLink: doc?.actorLink,
    tokenActor: tokenActor?.name ?? null,
    tokenActorId: tokenActor?.id ?? null,
    tokenActorUuid: tokenActor?.uuid ?? null,
    tokenActorIsToken: tokenActor?.isToken ?? null,
    actorEffects: effectSummary(tokenActor)
  };
}

function statusIcon(statusId) {
  const id = add2eVitalNorm(statusId);
  if (id === "dead") return ADD2E_VITAL_STATUS.dead.icon;
  if (id === "unconscious") return ADD2E_VITAL_STATUS.unconscious.icon;
  return null;
}

function statusLabel(statusId) {
  const id = add2eVitalNorm(statusId);
  if (id === "dead") return "mort";
  if (id === "unconscious") return "inconscient";
  return id;
}

function hasRealStatusEffect(actor, statusId) {
  const wanted = add2eVitalNorm(statusId);
  const icon = statusIcon(wanted);
  const label = statusLabel(wanted);
  return add2eVitalArray(actor?.effects).some(e => {
    const statuses = new Set(add2eVitalArray(e?.statuses ?? e?.system?.statuses ?? []).map(add2eVitalNorm));
    return statuses.has(wanted)
      || add2eVitalNorm(e?.flags?.core?.statusId) === wanted
      || add2eVitalNorm(e?.flags?.add2e?.vitalStatus) === wanted
      || (!!icon && e?.img === icon)
      || add2eVitalNorm(e?.name) === label;
  });
}

function hasRealDeadEffect(actor) {
  return hasRealStatusEffect(actor, "dead");
}

function isVitalInactiveReason(value) {
  const reason = add2eVitalNorm(value);
  return ["dead", "mort", "unconscious", "inconscient"].includes(reason);
}

async function safeToggleActorStatus(actor, statusId, active, { overlay = false, label = "status" } = {}) {
  if (!actor?.toggleStatusEffect) return { changed: false, action: "no-toggle-status-effect", statusId, active };

  const exists = hasRealStatusEffect(actor, statusId);
  if (active && exists) return { changed: false, action: "skip-on-existing", statusId, active, exists };
  if (!active && !exists) return { changed: false, action: "skip-off-missing", statusId, active, exists };

  try {
    const result = await actor.toggleStatusEffect(statusId, { active, overlay: active ? overlay : false });
    return { changed: result !== undefined, action: active ? "toggle-on" : "toggle-off", statusId, active, result: result?.id ?? result ?? null };
  } catch (err) {
    const msg = String(err?.message || err || "");
    if (!active && (msg.includes("does not exist") || msg.includes("n'existe pas"))) {
      return { changed: false, action: "stale-off-ignored", statusId, active, error: msg };
    }
    console.warn(`[ADD2E][VITAL_STATUS][${label.toUpperCase()}_TOGGLE][WARN]`, {
      actor: actor?.name,
      actorId: actor?.id,
      statusId,
      active,
      statusDefinition: statusDebug(statusId),
      actorEffects: effectSummary(actor),
      errName: err?.name ?? null,
      errMessage: err?.message ?? msg,
      errString: String(err)
    });
    return { changed: false, action: "toggle-warn", statusId, active, error: msg };
  }
}

export function add2eVitalRegisterStatusEffects() {
  CONFIG.statusEffects = Array.isArray(CONFIG.statusEffects) ? CONFIG.statusEffects : [];
  CONFIG.specialStatusEffects ??= {};
  CONFIG.specialStatusEffects.DEFEATED = "dead";

  for (const definition of [
    {
      _id: ADD2E_STATUS_IDS.dead,
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
      _id: ADD2E_STATUS_IDS.unconscious,
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
}

function tokenActorFor(token) {
  return token?.actor ?? token?.document?.actor ?? token?.object?.actor ?? null;
}

function tokenDocumentId(token) {
  const doc = token?.document ?? token;
  return doc?.id ?? token?.id ?? null;
}

function actorTokenDocumentId(actor) {
  return actor?.token?.id ?? actor?.token?.document?.id ?? actor?.token?.object?.id ?? null;
}

function tokenMatchesActor(actor, token) {
  const doc = token?.document ?? token;
  const tokenActor = tokenActorFor(token);
  if (!actor || !doc) return false;

  if (actor.isToken === true) {
    const actorTokenId = actorTokenDocumentId(actor);
    if (actorTokenId && doc.id === actorTokenId) return true;
    if (actor.uuid && tokenActor?.uuid === actor.uuid) return true;
    return tokenActor === actor;
  }

  if (doc.actorLink === true) {
    return doc.actorId === actor.id || tokenActor?.id === actor.id || tokenActor === actor;
  }

  return false;
}

function actorTokens(actor) {
  const tokens = [];

  try { tokens.push(...(actor?.getActiveTokens?.(true, true) ?? [])); } catch (_err) {}
  try { tokens.push(...(canvas?.tokens?.placeables ?? []).filter(token => tokenMatchesActor(actor, token))); } catch (_err) {}

  const seen = new Set();
  return tokens.filter(token => {
    if (!tokenMatchesActor(actor, token)) return false;
    const id = token?.document?.uuid ?? token?.id ?? token?.document?.id;
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return !!token?.document;
  });
}

async function syncMonsterTokenStatus(token, actor, status) {
  const doc = token?.document ?? token;
  const tokenActor = tokenActorFor(token);
  if (!tokenActor?.toggleStatusEffect || !doc?.id) return { changed: false, action: "no-toggle-status-effect", before: tokenDiagnostic(token, actor, "before-no-toggle") };

  const active = status === "dead";
  if (!active) {
    const hasDead = hasRealDeadEffect(tokenActor);
    return { changed: false, action: "skip-toggle-dead-off", hasDead };
  }

  return safeToggleActorStatus(tokenActor, "dead", true, { overlay: true, label: "monster_status" });
}

async function syncCharacterStatus(actor, status) {
  const results = [];

  if (status === "dead") {
    results.push(await safeToggleActorStatus(actor, "unconscious", false, { label: "character_status" }));
    results.push(await safeToggleActorStatus(actor, "dead", true, { overlay: true, label: "character_status" }));
  } else if (status === "unconscious") {
    results.push(await safeToggleActorStatus(actor, "dead", false, { label: "character_status" }));
    results.push(await safeToggleActorStatus(actor, "unconscious", true, { overlay: true, label: "character_status" }));
  } else {
    results.push(await safeToggleActorStatus(actor, "dead", false, { label: "character_status" }));
    results.push(await safeToggleActorStatus(actor, "unconscious", false, { label: "character_status" }));
  }

  return { changed: results.some(r => r?.changed), action: "character-status-toggle", results };
}

async function syncToken(token, actor, status) {
  if (add2eVitalIsMonster(actor)) return syncMonsterTokenStatus(token, actor, status);
  return { changed: false, action: "character-token-skipped" };
}

function combatantMatchesActor(combatant, actor) {
  if (!combatant?.id || !actor) return false;

  const tokenDoc = combatant.token?.document ?? combatant.token ?? null;

  if (actor.isToken === true) {
    const actorTokenId = actorTokenDocumentId(actor);
    if (actorTokenId && combatant.tokenId === actorTokenId) return true;
    if (actor.uuid && combatant.actor?.uuid === actor.uuid) return true;
    return combatant.actor === actor;
  }

  if (tokenDoc?.actorLink === false) return false;
  return combatant.actor?.id === actor.id || combatant.actorId === actor.id || tokenDoc?.actorId === actor.id;
}

function actorCombatants(actor) {
  const combats = [game.combat, ...add2eVitalArray(game.combats)].filter(Boolean);
  const out = [];
  const seen = new Set();
  for (const combat of combats) {
    for (const combatant of add2eVitalArray(combat?.combatants)) {
      if (!combatantMatchesActor(combatant, actor)) continue;
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
  const defeated = status === "dead";
  for (const combatant of actorCombatants(actor)) {
    if (!combatant?.update) continue;
    const currentStatus = combatant.flags?.add2e?.vitalStatus ?? null;
    const wantedStatus = inactive ? status : null;
    const same = combatant.defeated === defeated && combatant.flags?.add2e?.inactive === inactive && currentStatus === wantedStatus;
    if (same) continue;
    await combatant.update({
      defeated,
      "flags.add2e.inactive": inactive,
      "flags.add2e.inactiveReason": inactive ? wantedStatus : null,
      "flags.add2e.vitalStatus": wantedStatus
    }, { add2eVitalStatusSync: true });
    changed += 1;
  }
  return changed;
}

async function syncTokensAndCombat(actor, status, preserveInactive) {
  const tokens = actorTokens(actor);
  let tokenEffects = 0;
  const tokenResults = [];
  const inactive = status !== null;
  const combatants = preserveInactive ? 0 : await syncCombatants(actor, inactive, status);

  if (add2eVitalIsMonster(actor)) {
    if (!preserveInactive) {
      for (const token of tokens) {
        const result = await syncToken(token, actor, status);
        tokenResults.push({ tokenId: token?.document?.id ?? token?.id, token: token?.document?.name ?? token?.name, result });
        if (result?.changed) tokenEffects += 1;
      }
    }
  } else if (!preserveInactive) {
    const result = await syncCharacterStatus(actor, status);
    tokenResults.push({ actor: actor?.name, actorId: actor?.id, result });
    if (result?.changed) tokenEffects += 1;
  }

  return {
    tokenEffects,
    combatants,
    tokenCount: tokens.length,
    monsterMode: add2eVitalIsMonster(actor) ? "foundry-toggle-status-effect-token-isolated" : "actor",
    characterMode: add2eVitalIsMonster(actor) ? null : "foundry-toggle-status-effect",
    tokenResults
  };
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
    await syncTokensAndCombat(actor, status, preserveInactive);
    return true;
  } catch (err) {
    console.error("[ADD2E][VITAL_STATUS][ERROR]", { actor: actor?.name, reason, err });
    return false;
  } finally {
    LOCKS.delete(key);
  }
}
