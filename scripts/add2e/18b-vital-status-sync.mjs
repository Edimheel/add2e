// ============================================================================
// ADD2E — États vitaux : synchronisation token / combat tracker.
// Version : 2026-06-01-vital-status-split-sync-v8-native-monster-dead
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

export const ADD2E_VITAL_STATUS_SYNC_VERSION = "2026-06-01-vital-status-split-sync-v8-native-monster-dead";

const ADD2E_OLD_MONSTER_DEAD_VISUAL_ICON = "systems/add2e/assets/icons/add2e-monster-dead.svg";
const ADD2E_OLD_MONSTER_DEAD_EFFECT_ID = "ADD2Emondead0001";
const ADD2E_OLD_MONSTER_DEAD_STATUS_ID = "add2e-monster-dead";
const ADD2E_VITAL_TOKEN_ICONS = new Set([...ADD2E_VITAL_ICONS, ADD2E_OLD_MONSTER_DEAD_VISUAL_ICON]);
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

function add2eVitalTokenDiagnostic(token, actor, label = "token") {
  const doc = token?.document ?? token;
  const object = token?.object ?? token;
  const actorFromToken = token?.actor ?? doc?.actor ?? object?.actor ?? null;
  return {
    label,
    tokenName: doc?.name ?? token?.name ?? object?.name,
    tokenId: doc?.id ?? token?.id,
    tokenUuid: doc?.uuid,
    actor: actor?.name,
    actorId: actor?.id,
    tokenActor: actorFromToken?.name,
    tokenActorId: actorFromToken?.id,
    actorMatches: !!actor && !!actorFromToken && actor.id === actorFromToken.id,
    actorLink: doc?.actorLink,
    actorIdOnToken: doc?.actorId,
    overlayEffect: doc?.overlayEffect ?? doc?._source?.overlayEffect ?? null,
    effects: add2eVitalArray(doc?.effects ?? doc?._source?.effects ?? []),
    hidden: doc?.hidden,
    visible: object?.visible,
    rendered: object?.rendered,
    isOwner: actor?.isOwner,
    textureSrc: object?.texture?.baseTexture?.resource?.src ?? object?.texture?.source?.src ?? null
  };
}

function add2eVitalIsOldMonsterDeadVisualEffect(effect) {
  const statuses = new Set(add2eVitalArray(effect?.statuses ?? effect?.system?.statuses ?? []).map(add2eVitalNorm));
  return String(effect?.id ?? effect?._id ?? "") === ADD2E_OLD_MONSTER_DEAD_EFFECT_ID ||
    statuses.has(ADD2E_OLD_MONSTER_DEAD_STATUS_ID) ||
    effect?.flags?.add2e?.monsterDeadVisual === true ||
    effect?.img === ADD2E_OLD_MONSTER_DEAD_VISUAL_ICON ||
    effect?.icon === ADD2E_OLD_MONSTER_DEAD_VISUAL_ICON;
}

function add2eVitalActorEffectsDiagnostic(actor) {
  return add2eVitalArray(actor?.effects).map(effect => ({
    id: effect?.id,
    name: effect?.name,
    img: effect?.img,
    icon: effect?.icon,
    statuses: [...(effect?.statuses ?? [])],
    flags: effect?.flags,
    kind: add2eVitalEffectKind(effect),
    oldMonsterVisual: add2eVitalIsOldMonsterDeadVisualEffect(effect)
  }));
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
    hasUnconscious: CONFIG.statusEffects.some(effect => add2eVitalStatusAliases(effect).includes("unconscious")),
    deadIcon: ADD2E_VITAL_STATUS.dead.icon,
    unconsciousIcon: ADD2E_VITAL_STATUS.unconscious.icon
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
  const scanned = [];

  for (const effect of actor.effects ?? []) {
    const kind = add2eVitalEffectKind(effect);
    const isOldMonsterVisual = add2eVitalIsOldMonsterDeadVisualEffect(effect);

    scanned.push({
      id: effect?.id,
      name: effect?.name,
      img: effect?.img,
      statuses: [...(effect?.statuses ?? [])],
      kind,
      isOldMonsterVisual,
      flags: effect?.flags
    });

    if (!kind && !isOldMonsterVisual) continue;

    // Monstre mort : on conserve l'effet natif Mort, car c'est lui qui donne l'icône/token et le visuel tracker.
    // On supprime seulement Inconscient et les anciens effets visuels ADD2E créés pendant les essais.
    if (desired === "dead") {
      if (kind === "unconscious" || isOldMonsterVisual) {
        ids.push(effect.id);
        removedKinds.push(isOldMonsterVisual ? "old-monster-visual-effect" : kind);
      }
      continue;
    }

    // Monstre vivant : aucun état vital ne doit rester.
    if (desired === null && (kind === "dead" || kind === "unconscious" || isOldMonsterVisual)) {
      ids.push(effect.id);
      removedKinds.push(isOldMonsterVisual ? "old-monster-visual-effect" : kind);
    }
  }

  console.log("[ADD2E][VITAL_STATUS][MONSTER_EFFECT_SCAN]", {
    actor: actor.name,
    desired,
    scanned,
    ids,
    removedKinds
  });

  const validIds = ids.filter(id => id && actor.effects?.get?.(id));
  if (!validIds.length) return { removedActorEffects: 0, removedKinds, scanned };

  try {
    await actor.deleteEmbeddedDocuments("ActiveEffect", validIds, { add2eVitalMonsterCleanup: true });
    console.log("[ADD2E][VITAL_STATUS][MONSTER_EFFECT_CLEANUP]", {
      actor: actor.name,
      desired,
      ids: validIds,
      removedKinds,
      remainingEffects: add2eVitalActorEffectsDiagnostic(actor)
    });
    return { removedActorEffects: validIds.length, removedKinds, scanned };
  } catch (err) {
    const msg = String(err?.message || err || "");
    if (msg.includes("does not exist") || msg.includes("n'existe pas")) {
      console.warn("[ADD2E][VITAL_STATUS][MONSTER_EFFECT_CLEANUP][STALE]", { actor: actor.name, desired, ids: validIds, err });
      return { removedActorEffects: 0, removedKinds, scanned };
    }
    console.warn("[ADD2E][VITAL_STATUS][MONSTER_EFFECT_CLEANUP][WARN]", { actor: actor.name, desired, ids: validIds, err });
    return { removedActorEffects: 0, removedKinds, scanned, error: msg };
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
    if (value === ADD2E_OLD_MONSTER_DEAD_VISUAL_ICON) {
      removed.push(value);
      continue;
    }
    const n = add2eVitalNorm(value);
    if (n.includes("add2e_monster_dead")) {
      removed.push(value);
      continue;
    }
    clean.push(value);
  }
  return { clean, removed };
}

function add2eVitalIconForDesired(actor, desired) {
  if (desired === "dead") return ADD2E_VITAL_STATUS.dead.icon;
  if (desired === "unconscious") return ADD2E_VITAL_STATUS.unconscious.icon;
  return null;
}

async function add2eVitalSetTokenEffects(token, actor, desired) {
  const doc = token?.document ?? token;
  if (!doc?.update) return false;

  const isMonster = add2eVitalIsMonster(actor);
  const currentEffects = add2eVitalArray(doc.effects ?? doc._source?.effects ?? []);
  const { clean: cleanEffects, removed } = add2eVitalCleanTokenEffects(currentEffects);
  const desiredIcon = add2eVitalIconForDesired(actor, desired);
  const currentOverlay = doc.overlayEffect ?? doc._source?.overlayEffect ?? "";
  const currentOverlayNorm = add2eVitalNorm(currentOverlay);
  const patch = {};
  const beforeDoc = add2eVitalTokenDiagnostic(token, actor, "before-token-update");

  if (desiredIcon && !cleanEffects.includes(desiredIcon)) cleanEffects.push(desiredIcon);
  if (currentEffects.length !== cleanEffects.length || currentEffects.some((v, i) => v !== cleanEffects[i])) patch.effects = cleanEffects;
  if (currentOverlay === ADD2E_OLD_MONSTER_DEAD_VISUAL_ICON || currentOverlayNorm.includes("add2e_monster_dead")) patch.overlayEffect = null;

  console.log("[ADD2E][VITAL_STATUS][TOKEN_PATCH_PREPARE]", {
    token: doc.name,
    actor: actor?.name,
    isMonster,
    desired,
    desiredIcon,
    currentOverlay,
    currentEffects,
    cleanEffects,
    removed,
    patch,
    beforeDoc
  });

  if (!Object.keys(patch).length) {
    console.log("[ADD2E][VITAL_STATUS][TOKEN_PATCH_SKIP]", {
      reason: "no-patch",
      token: doc.name,
      actor: actor?.name,
      desired,
      afterDoc: add2eVitalTokenDiagnostic(token, actor, "skip-no-patch")
    });
    return false;
  }

  await doc.update(patch, { add2eVitalStatusSync: true });

  const afterDoc = add2eVitalTokenDiagnostic(token, actor, "after-token-update");
  let textureLoaded = null;
  try {
    if (desiredIcon && foundry?.canvas?.loadTexture) {
      const texture = await foundry.canvas.loadTexture(desiredIcon);
      textureLoaded = !!texture;
    } else if (desiredIcon && globalThis.loadTexture) {
      const texture = await globalThis.loadTexture(desiredIcon);
      textureLoaded = !!texture;
    }
  } catch (err) {
    textureLoaded = String(err?.message || err || "");
  }

  console.log("[ADD2E][VITAL_STATUS][TOKEN_ICON]", {
    token: doc.name,
    actor: actor?.name,
    isMonster,
    desired,
    desiredIcon,
    patch,
    textureLoaded,
    beforeDoc,
    afterDoc
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
  const isMonster = add2eVitalIsMonster(actor);
  let changed = 0;

  for (const combatant of combatants) {
    if (!combatant?.update) continue;

    try {
      const inactive = Boolean(defeated);
      const currentInactive = combatant.flags?.add2e?.inactive === true;
      const currentVital = combatant.flags?.add2e?.vitalStatus ?? null;
      const wantedVital = inactive ? "dead" : null;
      const same = combatant.defeated === inactive && currentInactive === inactive && currentVital === wantedVital;

      console.log("[ADD2E][VITAL_STATUS][DEFEATED_PREPARE]", {
        actor: actor?.name,
        combatant: combatant.id,
        isMonster,
        inactive,
        defeatedBefore: combatant.defeated,
        currentInactive,
        currentVital,
        wantedVital,
        same,
        flags: combatant.flags
      });

      if (same) continue;

      await combatant.update({
        defeated: inactive,
        "flags.add2e.inactive": inactive,
        "flags.add2e.inactiveReason": inactive ? wantedVital : null,
        "flags.add2e.vitalStatus": wantedVital
      }, { add2eVitalStatusSync: true });

      console.log("[ADD2E][VITAL_STATUS][DEFEATED_FLAG]", {
        actor: actor?.name,
        combatant: combatant.id,
        isMonster,
        inactive,
        defeated: combatant.defeated,
        flags: combatant.flags
      });
      changed += 1;
    } catch (err) {
      console.warn("[ADD2E][VITAL_STATUS][DEFEATED][WARN]", { actor: actor?.name, combatant: combatant?.id, defeated, isMonster, err });
    }
  }

  return changed;
}

async function add2eVitalSyncTokenState(actor, desired, { preserveDefeated = false } = {}) {
  const tokens = add2eVitalGetActorTokens(actor);
  let tokenEffects = 0;

  console.log("[ADD2E][VITAL_STATUS][TOKEN_SYNC_START]", {
    actor: actor?.name,
    actorId: actor?.id,
    desired,
    preserveDefeated,
    tokenCount: tokens.length,
    tokens: tokens.map(t => add2eVitalTokenDiagnostic(t, actor, "sync-start-token"))
  });

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

  console.log("[ADD2E][VITAL_STATUS][TOKEN_SYNC_END]", {
    actor: actor?.name,
    desired,
    tokenEffects,
    defeated,
    tokenCount: tokens.length,
    tokens: tokens.map(t => add2eVitalTokenDiagnostic(t, actor, "sync-end-token"))
  });

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
    const before = add2eVitalActorEffectsDiagnostic(actor);
    const tokenBefore = add2eVitalGetActorTokens(actor).map(t => add2eVitalTokenDiagnostic(t, actor, "final-before"));

    const monsterCleanupBefore = await add2eVitalCleanWrongMonsterActorEffects(actor, desired);
    const actorStatus = null;
    const tokenState = await add2eVitalSyncTokenState(actor, desired, { preserveDefeated });
    const monsterCleanupAfter = await add2eVitalCleanWrongMonsterActorEffects(actor, desired);
    const tokenAfter = add2eVitalGetActorTokens(actor).map(t => add2eVitalTokenDiagnostic(t, actor, "final-after"));

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
      nativeDefeatedState: true,
      actorStatus,
      removed: (monsterCleanupBefore.removedActorEffects ?? 0) + (monsterCleanupAfter.removedActorEffects ?? 0),
      monsterCleanupBefore,
      monsterCleanupAfter,
      before,
      afterEffects: add2eVitalActorEffectsDiagnostic(actor),
      tokenBefore,
      tokenAfter,
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
