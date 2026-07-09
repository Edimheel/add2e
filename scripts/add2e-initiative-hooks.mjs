// scripts/add2e-initiative-hooks.mjs
// ADD2E — hooks d'initiative.

import { ADD2E_INITIATIVE_VERSION, hasProperty, initiativeState } from "./add2e-initiative-constants.mjs";
import {
  currentCombatant,
  isInactiveCombatant,
  scheduleInitiativeSort,
  scheduleLocalSync,
  sortedCombatants,
  add2eNotifyExtraAttackTurnLocal,
  add2ePatchMultipleAttackTracker
} from "./add2e-initiative-order.mjs";
import { installInitiativeChatCard } from "./add2e-initiative-chat.mjs";
import { patchInitiativeIcons } from "./add2e-initiative-icons.mjs";
import { canTokenInteractNow, clearFoundryMovementTrailAggressive } from "./add2e-initiative-locks.mjs";

const MOVEMENT_KEYS = ["x", "y", "elevation", "rotation"];
const ADD2E_MULTIPLE_ATTACK_ACTOR_FLAG = "multipleAttacks";
const ADD2E_MULTIPLE_ATTACK_PHASE_FLAG = "multipleAttackPhase";
const ADD2E_MULTIPLE_ATTACK_PENDING_FLAG = "multipleAttackPending";
const MULTIPLE_ATTACK_SOCKET_TYPE = "add2eMultipleAttackRecord";

function hasAnyProperty(obj, keys) {
  return keys.some(key => hasProperty(obj ?? {}, key));
}

function combatFor(combatant) {
  return combatant?.combat ?? game.combat;
}

function combatKey(combat) {
  return String(combat?.id ?? "active-combat");
}

function clone(value) {
  try { return foundry.utils.deepClone(value ?? {}); }
  catch (_err) { return JSON.parse(JSON.stringify(value ?? {})); }
}

function combatantByPayload(combat, payload) {
  const turns = sortedCombatants(combat);
  return turns.find(c => String(c.id) === String(payload?.combatantId ?? ""))
    ?? turns.find(c => String(c.actor?.id ?? c.actorId ?? "") === String(payload?.actorId ?? ""))
    ?? null;
}

async function persistMultipleAttackRecord(payload) {
  if (!game.user?.isGM || payload?.type !== MULTIPLE_ATTACK_SOCKET_TYPE) return false;
  const combat = game.combats?.get?.(payload.combatId) ?? game.combat;
  if (!combat || String(combat.id) !== String(payload.combatId)) return false;

  const combatant = combatantByPayload(combat, payload);
  const actor = combatant?.actor ?? game.actors?.get?.(payload.actorId) ?? null;
  if (!actor) return false;

  const state = payload.state && typeof payload.state === "object" ? clone(payload.state) : {};
  const pending = Math.max(0, Math.floor(Number(state.pending ?? 0) || 0));
  const round = Math.max(1, Math.floor(Number(state.round ?? combat.round ?? 1) || 1));
  const key = combatKey(combat);

  const actorStates = clone(actor.getFlag?.("add2e", ADD2E_MULTIPLE_ATTACK_ACTOR_FLAG) ?? actor.flags?.add2e?.[ADD2E_MULTIPLE_ATTACK_ACTOR_FLAG] ?? {});
  actorStates[key] = {
    ...state,
    round,
    pending,
    updatedByGM: true,
    updatedAt: Date.now()
  };
  try {
    await actor.setFlag("add2e", ADD2E_MULTIPLE_ATTACK_ACTOR_FLAG, actorStates);
  } catch (err) {
    console.warn("[ADD2E][INIT][MULTI_ATTACK][ACTOR_FLAG_SYNC_ERROR]", { actor: actor.name, err });
  }

  const pendingMap = clone(combat.getFlag?.("add2e", ADD2E_MULTIPLE_ATTACK_PENDING_FLAG) ?? combat.flags?.add2e?.[ADD2E_MULTIPLE_ATTACK_PENDING_FLAG] ?? {});
  const recordKey = String(combatant?.id ?? payload.actorId);
  if (pending > 0) {
    pendingMap[recordKey] = {
      actorId: actor.id,
      actorName: actor.name,
      combatantId: combatant?.id ?? null,
      round,
      pending,
      state: actorStates[key],
      updatedAt: Date.now()
    };
  } else {
    delete pendingMap[recordKey];
  }

  try {
    await combat.setFlag("add2e", ADD2E_MULTIPLE_ATTACK_PENDING_FLAG, pendingMap);
    return true;
  } catch (err) {
    console.warn("[ADD2E][INIT][MULTI_ATTACK][COMBAT_FLAG_SYNC_ERROR]", err);
    return false;
  }
}

function readMultipleAttackActorState(actor, combat, round) {
  const all = actor?.getFlag?.("add2e", ADD2E_MULTIPLE_ATTACK_ACTOR_FLAG) ?? actor?.flags?.add2e?.[ADD2E_MULTIPLE_ATTACK_ACTOR_FLAG] ?? {};
  const state = all?.[combatKey(combat)] ?? null;
  if (!state || typeof state !== "object") return null;
  if (Number(state.round) !== Number(round)) return null;
  const pending = Math.max(0, Math.floor(Number(state.pending ?? 0) || 0));
  return pending > 0 ? { ...state, pending } : null;
}

function readMultipleAttackCombatRecord(combat, round) {
  const pendingMap = combat?.getFlag?.("add2e", ADD2E_MULTIPLE_ATTACK_PENDING_FLAG) ?? combat?.flags?.add2e?.[ADD2E_MULTIPLE_ATTACK_PENDING_FLAG] ?? {};
  if (!pendingMap || typeof pendingMap !== "object") return null;

  const turns = sortedCombatants(combat);
  for (let index = 0; index < turns.length; index += 1) {
    const combatant = turns[index];
    const records = [pendingMap[String(combatant.id)], pendingMap[String(combatant.actor?.id ?? combatant.actorId ?? "")]].filter(Boolean);
    for (const record of records) {
      const pending = Math.max(0, Math.floor(Number(record?.pending ?? record?.state?.pending ?? 0) || 0));
      if (pending <= 0 || Number(record?.round ?? record?.state?.round) !== Number(round)) continue;
      if (isInactiveCombatant(combatant)) continue;
      return { round, index, combatant, state: { ...(record.state ?? {}), pending } };
    }
  }
  return null;
}

function pendingExtraFromPreviousRound(combat) {
  const round = Math.max(1, Math.floor(Number(combat?.round ?? 1) - 1));
  if (round < 1 || Number(combat?.round ?? 1) <= 1) return null;

  const combatRecord = readMultipleAttackCombatRecord(combat, round);
  if (combatRecord) return combatRecord;

  const turns = sortedCombatants(combat);
  for (let index = 0; index < turns.length; index += 1) {
    const combatant = turns[index];
    if (!combatant?.actor || isInactiveCombatant(combatant)) continue;
    const state = readMultipleAttackActorState(combatant.actor, combat, round);
    if (state) return { round, index, combatant, state };
  }
  return null;
}

async function recoverSkippedExtraAttackPhase(combat, changes, options = {}) {
  if (!game.user?.isGM || options?.add2eMultipleAttackRecovery) return false;
  if (!combat?.started || !hasProperty(changes ?? {}, "round")) return false;

  const currentPhase = combat?.getFlag?.("add2e", ADD2E_MULTIPLE_ATTACK_PHASE_FLAG) ?? combat?.flags?.add2e?.[ADD2E_MULTIPLE_ATTACK_PHASE_FLAG] ?? null;
  if (currentPhase?.phase === "extra" && Number(currentPhase.round) === Number(combat.round)) return false;

  const pending = pendingExtraFromPreviousRound(combat);
  if (!pending) return false;

  await combat.update({
    round: pending.round,
    turn: pending.index,
    "flags.add2e.multipleAttackPhase": {
      phase: "extra",
      round: pending.round,
      combatantId: pending.combatant.id,
      recovered: true,
      recoveredFromRound: Number(combat.round ?? 0),
      recoveredAt: Date.now()
    }
  }, {
    add2eInitiativeNavigation: true,
    add2eMultipleAttackRecovery: true
  });

  ui.notifications?.warn?.(`${pending.combatant.name} a encore ${pending.state.pending} attaque supplémentaire au round ${pending.round}.`);
  return true;
}

function patchTrackerIcons(app, html) {
  if (app?.options?.id === "combat" || app?.tabName === "combat" || app?.id === "combat") {
    patchInitiativeIcons(html);
    add2ePatchMultipleAttackTracker(html, game.combat);
  }
}

function scheduleExtraAttackLocalNotice(combat) {
  window.setTimeout(() => {
    add2eNotifyExtraAttackTurnLocal(combat);
    add2ePatchMultipleAttackTracker(ui?.combat?.element ?? document, combat);
  }, 60);
}

function scheduleNavigationClientSync(combat, reason = "initiative-navigation") {
  scheduleLocalSync(combat, { delay: 40, selectToken: true, reason });
  scheduleExtraAttackLocalNotice(combat);
}

export function add2eInitiativeDebug(label = "debug", combat = game.combat) {
  const turns = sortedCombatants(combat);
  return {
    label,
    version: ADD2E_INITIATIVE_VERSION,
    started: combat?.started ?? null,
    round: combat?.round ?? null,
    turn: combat?.turn ?? null,
    current: combat?.current ?? null,
    multipleAttackPhase: combat?.getFlag?.("add2e", "multipleAttackPhase") ?? combat?.flags?.add2e?.multipleAttackPhase ?? null,
    multipleAttackPending: combat?.getFlag?.("add2e", ADD2E_MULTIPLE_ATTACK_PENDING_FLAG) ?? combat?.flags?.add2e?.[ADD2E_MULTIPLE_ATTACK_PENDING_FLAG] ?? null,
    active: currentCombatant(combat)?.name ?? null,
    turns: turns.map((c, index) => ({ index, id: c.id, name: c.name, initiative: c.initiative, sort: c.sort, tokenId: c.tokenId }))
  };
}

globalThis.add2eInitiativeDebug = add2eInitiativeDebug;

export function installHooks() {
  if (initiativeState.hooksInstalled) return;
  initiativeState.hooksInstalled = true;

  try {
    game.socket?.on?.("system.add2e", payload => {
      persistMultipleAttackRecord(payload).catch(err => console.warn("[ADD2E][INIT][MULTI_ATTACK][SOCKET_ERROR]", err));
    });
  } catch (err) {
    console.warn("[ADD2E][INIT][MULTI_ATTACK][SOCKET_BIND_ERROR]", err);
  }

  Hooks.on("preUpdateToken", (tokenDoc, changes, options, userId) => {
    if (options?.add2eIgnoreTurnLock || !hasAnyProperty(changes, MOVEMENT_KEYS)) return;
    if (game.users?.get?.(userId)?.isGM) return;
    if (!canTokenInteractNow(tokenDoc, { notify: game.user?.id === userId })) return false;
  });

  Hooks.on("updateCombatant", (combatant, changes, options) => {
    if (!options?.add2eInitiativeSort && hasProperty(changes ?? {}, "initiative")) scheduleInitiativeSort(combatFor(combatant));
  });

  Hooks.on("createCombatant", (combatant, options) => { if (!options?.add2eInitiativeSort) scheduleInitiativeSort(combatFor(combatant)); });
  Hooks.on("deleteCombatant", (combatant, options) => { if (!options?.add2eInitiativeSort) scheduleInitiativeSort(combatFor(combatant)); });

  Hooks.on("updateCombat", async (combat, changes, options) => {
    if (options?.add2eInitiativeSort) return;

    if (await recoverSkippedExtraAttackPhase(combat, changes, options)) {
      scheduleNavigationClientSync(combat, "extra-attack-recovery");
      return;
    }

    if (options?.add2eInitiativeNavigation || options?.add2eMultipleAttackRecovery) {
      scheduleNavigationClientSync(combat, options?.add2eMultipleAttackRecovery ? "extra-attack-recovery" : "initiative-navigation");
      return;
    }

    if (hasProperty(changes ?? {}, "started") && combat?.started) {
      scheduleLocalSync(combat, { delay: 80, selectToken: true, reason: "combat-start" });
      scheduleExtraAttackLocalNotice(combat);
      return;
    }
    if (hasAnyProperty(changes, ["turn", "round"])) {
      scheduleLocalSync(combat, { delay: 40, selectToken: true, reason: "combat-update" });
      scheduleExtraAttackLocalNotice(combat);
    }
  });

  Hooks.on("combatTurn", combat => {
    scheduleLocalSync(combat, { delay: 30, selectToken: true, reason: "combat-turn" });
    scheduleExtraAttackLocalNotice(combat);
  });
  Hooks.on("combatRound", combat => {
    scheduleLocalSync(combat, { delay: 30, selectToken: true, reason: "combat-round" });
    scheduleExtraAttackLocalNotice(combat);
  });
  Hooks.on("canvasReady", () => scheduleLocalSync(game.combat, { delay: 180, selectToken: false, reason: "refresh" }));
  Hooks.on("hoverToken", clearFoundryMovementTrailAggressive);
  Hooks.on("refreshToken", clearFoundryMovementTrailAggressive);

  Hooks.on("renderCombatTracker", (_app, html) => {
    patchInitiativeIcons(html);
    add2ePatchMultipleAttackTracker(html, game.combat);
  });
  Hooks.on("renderCombatantConfig", () => setTimeout(() => {
    patchInitiativeIcons(document);
    add2ePatchMultipleAttackTracker(document, game.combat);
  }, 50));
  Hooks.on("renderSidebarTab", patchTrackerIcons);

  installInitiativeChatCard();
}
