// ============================================================================
// ADD2E — États vitaux : synchronisation token / combat tracker.
// Version : 2026-06-01-vital-status-split-sync-v1
// ============================================================================

import {
  ADD2E_VITAL_ICONS,
  ADD2E_VITAL_STATUS,
  ADD2E_VITAL_STATUS_EFFECT_IDS,
  add2eVitalArray,
  add2eVitalDesiredStatus,
  add2eVitalEffectKind,
  add2eVitalIsMonster,
  add2eVitalNorm,
  add2eVitalReadHP,
  add2eVitalStatusAliases
} from "./18a-vital-status-core.mjs";

export const ADD2E_VITAL_STATUS_SYNC_VERSION = "2026-06-01-vital-status-split-sync-v1";

const ADD2E_VITAL_SYNC_LOCK = new Set();

function add2eVitalMergeObject(base, patch) {
  try {
    return foundry.utils.mergeObject(
      foundry.utils.deepClone(base ?? {}),
      foundry.utils.deepClone(patch ?? {}),
      { inplace: false, insertKeys: true, overwrite: true }
    );
  } catch (_err) {
    return { ...(base ?? {}), ...(patch ?? {}) };
  }
}

export function add2eVitalRegisterStatusEffects() {
  CONFIG.statusEffects = Array.isArray(CONFIG.statusEffects) ? CONFIG.statusEffects : [];
  CONFIG.specialStatusEffects ??= {};
  CONFIG.specialStatusEffects.DEFEATED = "dead";

  const definitions = [
    {
      _id: ADD2E_VITAL_STATUS_EFFECT_IDS.dead,
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
      _id: ADD2E_VITAL_STATUS_EFFECT_IDS.unconscious,
      id: "unconscious",
      name: "Inconscient",
      label: "Inconscient",
      img: ADD2E_VITAL_STATUS.unconscious.icon,
      icon: ADD2E_VITAL_STATUS.unconscious.icon,
      statuses: ["unconscious", "incapacitated"],
      flags: { core: { statusId: "unconscious" }, add2e: { vitalStatus: "unconscious", autoVitalStatus: true } }
    }
  ];

  for (const definition of definitions) {
    const wanted = add2eVitalNorm(definition.id);
    const index = CONFIG.statusEffects.findIndex(effect => add2eVitalStatusAliases(effect).includes(wanted));
    if (index >= 0) CONFIG.statusEffects[index] = add2eVitalMergeObject(CONFIG.statusEffects[index], definition);
    else CONFIG.statusEffects.push(foundry.utils?.deepClone ? foundry.utils.deepClone(definition) : { ...definition });
  }

  console.log("[ADD2E][VITAL_STATUS][REGISTER_STATUS]", {
    version: globalThis.ADD2E_ACTIVE_EFFECTS_EXPIRE_VERSION,
    core: globalThis.ADD2E_VITAL_STATUS_CORE_VERSION,
    sync: ADD2E_VITAL_STATUS_SYNC_VERSION,
    defeatedStatus: CONFIG.specialStatusEffects.DEFEATED,
    hasDead: CONFIG.statusEffects.some(effect => add2eVitalStatusAliases(effect).includes("dead")),
    hasUnconscious: CONFIG.statusEffects.some(effect => add2eVitalStatusAliases(effect).includes("unconscious"))
  });
}

export async function add2eVitalRemoveActorVitalEffects(_actor) {
  return 0;
}

export async function add2eVitalSetActorStatus(_actor, _statusId, _active, _overlay = false) {
  return false;
}

export async function add2eVitalCleanWrongMonsterActorEffects(actor, desired) {
  if (!actor || !add2eVitalIsMonster(actor)) return { removedActorEffects: 0, removedKinds: [] };

  const ids = [];
  const removedKinds = [];

  for (const effect of actor.effects ?? []) {
    const kind = add2eVitalEffectKind(effect);
    if (!kind) continue;

    if (desired === "dead" && kind === "unconscious") {
      ids.push(effect.id);
      removedKinds.push(kind);
    }

    if (desired === null && (kind === "dead" || kind === "unconscious")) {
      ids.push(effect.id);
      removedKinds.push(kind);
    }
  }

  const validIds = ids.filter(id => id && actor.effects?.get?.(id));
  if (!validIds.length) return { removedActorEffects: 0, removedKinds };

  try {
    await actor.deleteEmbeddedDocuments("ActiveEffect", validIds, { add2eVitalMonsterCleanup: true });
    console.log("[ADD2E][VITAL_STATUS][MONSTER_EFFECT_CLEANUP]", {
      actor: actor.name,
      desired,
      ids: validIds,
      removedKinds
    });
    return { removedActorEffects: validIds.length, removedKinds };
  } catch (err) {
    const msg = String(err?.message || err || "");
    if (msg.includes("does not exist") || msg.includes("n'existe pas")) {
      console.warn("[ADD2E][VITAL_STATUS][MONSTER_EFFECT_CLEANUP][STALE]", { actor: actor.name, desired, ids: validIds, err });
      return { removedActorEffects: 0, removedKinds };
    }
    console.warn("[ADD2E][VITAL_STATUS][MONSTER_EFFECT_CLEANUP][WARN]", { actor: actor.name, desired, ids: validIds, err });
    return { removedActorEffects: 0, removedKinds, error: msg };
  }
}

function add2eVitalGetActorTokens(actor) {
  const tokens = [];
  try { tokens.push(...(actor?.getActiveTokens?.(true, true) ?? [])); } catch (_e) {}
  try { tokens.push(...(canvas?.tokens?.placeables ?? []).filter(t => t?.actor?.id === actor?.id || t?.document?.actorId === actor?.id)); } catch (_e) {}
  const seen = new Set();
  return tokens.filter(t => {
    const id = t?.document?.uuid ?? t?.id ?? t?.document?.id;
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return !!t?.document;
  });
}

function add2eVitalCleanTokenEffects(effects) {
  const clean = [];
  const removed = [];
  for (const value of add2eVitalArray(effects)) {
    if (ADD2E_VITAL_ICONS.has(value)) {
      removed.push(value);
      continue;
    }
    const n = add2eVitalNorm(value);
    if (n.includes("skull") || n.includes("unconscious") || n.includes("daze")) {
      removed.push(value);
      continue;
    }
    clean.push(value);
  }
  return { clean, removed };
}

function add2eVitalIconForDesired(actor, desired) {
  if (add2eVitalIsMonster(actor)) return desired === "dead" ? ADD2E_VITAL_STATUS.dead.icon : null;
  if (desired === "dead") return ADD2E_VITAL_STATUS.dead.icon;
  if (desired === "unconscious") return ADD2E_VITAL_STATUS.unconscious.icon;
  return null;
}

async function add2eVitalSetTokenEffects(token, actor, desired) {
  const doc = token?.document ?? token;
  if (!doc?.update) return false;

  const currentEffects = add2eVitalArray(doc.effects ?? doc._source?.effects ?? []);
  const { clean: cleanEffects, removed } = add2eVitalCleanTokenEffects(currentEffects);
  const desiredIcon = add2eVitalIconForDesired(actor, desired);
  if (desiredIcon && !cleanEffects.includes(desiredIcon)) cleanEffects.push(desiredIcon);

  const currentOverlay = doc.overlayEffect ?? doc._source?.overlayEffect ?? "";
  const currentOverlayNorm = add2eVitalNorm(currentOverlay);
  const patch = {};

  if (currentEffects.length !== cleanEffects.length || currentEffects.some((v, i) => v !== cleanEffects[i])) patch.effects = cleanEffects;
  if (ADD2E_VITAL_ICONS.has(currentOverlay) || currentOverlayNorm.includes("skull") || currentOverlayNorm.includes("daze") || currentOverlayNorm.includes("unconscious")) patch.overlayEffect = null;

  if (!Object.keys(patch).length) return false;
  await doc.update(patch, { add2eVitalStatusSync: true });
  console.log("[ADD2E][VITAL_STATUS][TOKEN_ICON]", {
    token: doc.name,
    actor: actor?.name,
    isMonster: add2eVitalIsMonster(actor),
    desired,
    desiredIcon,
    removed,
    effects: cleanEffects
  });
  return true;
}

function add2eVitalCombatantsForActor(actor) {
  const combats = [game.combat, ...add2eVitalArray(game.combats)].filter(Boolean);
  const out = [];
  const seen = new Set();
  for (const combat of combats) {
    for (const combatant of add2eVitalArray(combat?.combatants)) {
      if (!combatant?.id) continue;
      const sameActor = combatant.actor?.id === actor?.id || combatant.actorId === actor?.id || combatant.token?.actorId === actor?.id;
      if (!sameActor) continue;
      const key = `${combat.id}:${combatant.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(combatant);
    }
  }
  return out;
}

function add2eVitalActorHasDefeatedCombatant(actor) {
  return add2eVitalCombatantsForActor(actor).some(combatant => combatant?.defeated === true || combatant?.flags?.core?.defeated === true || combatant?.flags?.add2e?.inactive === true);
}

async function add2eVitalSetDefeated(actor, defeated) {
  const combatants = add2eVitalCombatantsForActor(actor);
  let changed = 0;
  for (const combatant of combatants) {
    if (!combatant?.update) continue;
    if (combatant.defeated === defeated) continue;
    try {
      await combatant.update({ defeated }, { add2eVitalStatusSync: true });
      changed += 1;
    } catch (err) {
      console.warn("[ADD2E][VITAL_STATUS][DEFEATED][WARN]", { actor: actor?.name, combatant: combatant?.id, defeated, err });
    }
  }
  return changed;
}

async function add2eVitalSyncTokenState(actor, desired, { preserveDefeated = false } = {}) {
  const tokens = add2eVitalGetActorTokens(actor);
  let tokenEffects = 0;
  if (!preserveDefeated) {
    for (const token of tokens) {
      try {
        if (await add2eVitalSetTokenEffects(token, actor, desired)) tokenEffects += 1;
      } catch (err) {
        console.warn("[ADD2E][VITAL_STATUS][TOKEN_EFFECT][WARN]", { actor: actor?.name, token: token?.name, desired, err });
      }
    }
  }
  const defeated = preserveDefeated ? 0 : await add2eVitalSetDefeated(actor, desired !== null);
  return { tokenEffects, defeated, tokenCount: tokens.length, preserveDefeated };
}

export async function add2eSyncActorVitalStatus(actor, { reason = "sync" } = {}) {
  if (!actor || !["personnage", "monster"].includes(add2eVitalNorm(actor?.type)) && !add2eVitalIsMonster(actor)) return false;
  if (!game.user?.isGM) return false;
  const lockKey = actor.uuid ?? actor.id;
  if (ADD2E_VITAL_SYNC_LOCK.has(lockKey)) return false;
  ADD2E_VITAL_SYNC_LOCK.add(lockKey);
  try {
    add2eVitalRegisterStatusEffects();
    const desired = add2eVitalDesiredStatus(actor);
    const isMonster = add2eVitalIsMonster(actor);
    const trackerDefeated = add2eVitalActorHasDefeatedCombatant(actor);
    const preserveDefeated = !isMonster && trackerDefeated && desired === null;
    const before = add2eVitalArray(actor?.effects).filter(e => add2eVitalEffectKind(e)).map(e => ({ id: e.id, name: e.name, kind: add2eVitalEffectKind(e), icon: e.icon }));

    const monsterCleanupBefore = await add2eVitalCleanWrongMonsterActorEffects(actor, desired);
    const actorStatus = null;
    const tokenState = await add2eVitalSyncTokenState(actor, desired, { preserveDefeated });
    const monsterCleanupAfter = await add2eVitalCleanWrongMonsterActorEffects(actor, desired);

    console.log("[ADD2E][VITAL_STATUS][SYNC]", {
      reason,
      actor: actor.name,
      actorId: actor.id,
      type: actor.type,
      isMonster,
      hp: add2eVitalReadHP(actor),
      desired,
      trackerDefeated,
      preserveDefeated,
      monsterSameFlowRule: isMonster,
      actorStatus,
      removed: (monsterCleanupBefore.removedActorEffects ?? 0) + (monsterCleanupAfter.removedActorEffects ?? 0),
      monsterCleanupBefore,
      monsterCleanupAfter,
      before,
      tokenState
    });
    return true;
  } catch (err) {
    console.error("[ADD2E][VITAL_STATUS][ERROR]", { actor: actor?.name, reason, err });
    return false;
  } finally {
    ADD2E_VITAL_SYNC_LOCK.delete(lockKey);
  }
}
