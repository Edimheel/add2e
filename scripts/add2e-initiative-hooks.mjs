// scripts/add2e-initiative-hooks.mjs
// ADD2E — hooks d'initiative.

import { ADD2E_INITIATIVE_VERSION, hasProperty, initiativeState } from "./add2e-initiative-constants.mjs";
import { currentCombatant, getCombatOrder, scheduleInitiativeSort, scheduleLocalSync } from "./add2e-initiative-order.mjs";
import { installInitiativeChatCard } from "./add2e-initiative-chat.mjs";
import { patchInitiativeIcons } from "./add2e-initiative-icons.mjs";
import { canTokenInteractNow, clearFoundryMovementTrailAggressive } from "./add2e-initiative-locks.mjs";

const MOVEMENT_KEYS = ["x", "y", "elevation", "rotation"];
const ROUND_SCOPED_FLAG_PATHS = [
  ["initiativeAction", "flags.add2e.-=initiativeAction"],
  ["initiativeSituation", "flags.add2e.-=initiativeSituation"]
];
let canonicalTurnEventTimer = null;
let roundDataCleanupTimer = null;

function hasAnyProperty(obj, keys) {
  return keys.some(key => hasProperty(obj ?? {}, key));
}

function combatFor(combatant) {
  return combatant?.combat ?? game.combat;
}

function patchTrackerIcons(app, html) {
  if (app?.options?.id === "combat" || app?.tabName === "combat" || app?.id === "combat") patchInitiativeIcons(html);
}

function responsibleInitiativeGM() {
  if (!game.user?.isGM) return false;
  const activeGM = game.users?.activeGM
    ?? Array.from(game.users ?? []).find(user => user?.active && user?.isGM)
    ?? null;
  return !activeGM || activeGM.id === game.user.id;
}

function scopedRound(data) {
  const round = Number(data?.round);
  return Number.isFinite(round) ? Math.max(0, Math.floor(round)) : 0;
}

function roundDataIsCurrent(data, combat, force = false) {
  if (!data || typeof data !== "object" || force) return false;
  const storedRound = scopedRound(data);
  if (combat?.started !== true) return storedRound === 0;
  const currentRound = Math.max(1, Math.floor(Number(combat?.round) || 1));
  if (currentRound === 1) return storedRound === 0 || storedRound === 1;
  return storedRound === currentRound;
}

export async function cleanupInitiativeRoundData(combat = game.combat, { reason = "round-cleanup", force = false } = {}) {
  if (!combat?.combatants || !responsibleInitiativeGM()) return { cleaned: 0, skipped: true };

  const updates = [];
  for (const combatant of combat.combatants ?? []) {
    const flags = combatant?.flags?.add2e ?? {};
    const update = { _id: combatant.id };
    let changed = false;
    for (const [flagName, deletionPath] of ROUND_SCOPED_FLAG_PATHS) {
      if (!Object.prototype.hasOwnProperty.call(flags, flagName)) continue;
      if (roundDataIsCurrent(flags[flagName], combat, force)) continue;
      update[deletionPath] = null;
      changed = true;
    }
    if (changed) updates.push(update);
  }

  if (!updates.length) return { cleaned: 0, skipped: false };
  await combat.updateEmbeddedDocuments("Combatant", updates, {
    add2eInitiativeRoundCleanup: true,
    add2eInitiativeVersion: ADD2E_INITIATIVE_VERSION,
    add2eReason: reason
  });
  Hooks.callAll("add2eInitiativeRoundDataCleared", combat, {
    reason,
    round: Number(combat.round ?? 0),
    combatantIds: updates.map(update => update._id)
  });
  return { cleaned: updates.length, skipped: false };
}

function scheduleInitiativeRoundDataCleanup(combat, reason, delay = 0, { force = false } = {}) {
  if (!combat) return;
  clearTimeout(roundDataCleanupTimer);
  roundDataCleanupTimer = setTimeout(() => {
    cleanupInitiativeRoundData(combat, { reason, force }).catch(error => {
      console.error("[ADD2E][INIT][ROUND_CLEANUP][ERROR]", error);
    });
  }, Math.max(0, Number(delay) || 0));
}

function scheduleCanonicalTurnEvent(combat, reason, delay = 0) {
  if (!combat) return;
  clearTimeout(canonicalTurnEventTimer);
  canonicalTurnEventTimer = setTimeout(() => {
    const active = currentCombatant(combat);
    Hooks.callAll("add2eInitiativeTurnChanged", combat, {
      reason,
      round: Number(combat.round ?? 0),
      turn: Number(combat.turn ?? 0),
      combatantId: active?.id ?? null
    });
  }, Math.max(0, Number(delay) || 0));
}

export function add2eInitiativeDebug(label = "debug", combat = game.combat) {
  const turns = getCombatOrder(combat);
  return {
    label,
    version: ADD2E_INITIATIVE_VERSION,
    rule: "high-first",
    started: combat?.started ?? null,
    round: combat?.round ?? null,
    turn: combat?.turn ?? null,
    current: combat?.current ?? null,
    active: currentCombatant(combat)?.name ?? null,
    turns: turns.map((c, index) => ({ index, id: c.id, name: c.name, initiative: c.initiative, sort: c.sort, tokenId: c.tokenId }))
  };
}

export function installHooks() {
  if (initiativeState.hooksInstalled) return;
  initiativeState.hooksInstalled = true;

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

  Hooks.on("updateCombat", (combat, changes, options) => {
    const startedChanged = hasProperty(changes ?? {}, "started");
    const roundChanged = hasProperty(changes ?? {}, "round");
    if (startedChanged || roundChanged) {
      const ended = startedChanged && !combat?.started;
      scheduleInitiativeRoundDataCleanup(combat, ended ? "combat-end" : "round-change", 10, { force: ended });
    }

    if (options?.add2eInitiativeSort || options?.add2eInitiativeNavigation) return;
    if (startedChanged && combat?.started) {
      scheduleLocalSync(combat, { delay: 80, selectToken: true, reason: "combat-start" });
      scheduleCanonicalTurnEvent(combat, "combat-start", 85);
      return;
    }
    if (hasAnyProperty(changes, ["turn", "round"])) {
      scheduleLocalSync(combat, { delay: 40, selectToken: true, reason: "combat-update" });
      scheduleCanonicalTurnEvent(combat, "combat-update", 45);
    }
  });

  Hooks.on("combatTurn", combat => {
    scheduleLocalSync(combat, { delay: 30, selectToken: true, reason: "combat-turn" });
    scheduleCanonicalTurnEvent(combat, "combat-turn", 35);
  });
  Hooks.on("combatRound", combat => {
    scheduleInitiativeRoundDataCleanup(combat, "combat-round", 10);
    scheduleLocalSync(combat, { delay: 30, selectToken: true, reason: "combat-round" });
    scheduleCanonicalTurnEvent(combat, "combat-round", 35);
  });
  Hooks.on("canvasReady", () => scheduleLocalSync(game.combat, { delay: 180, selectToken: false, reason: "refresh" }));
  Hooks.on("hoverToken", clearFoundryMovementTrailAggressive);
  Hooks.on("refreshToken", clearFoundryMovementTrailAggressive);

  Hooks.on("renderCombatTracker", (_app, html) => patchInitiativeIcons(html));
  Hooks.on("renderCombatantConfig", () => setTimeout(() => patchInitiativeIcons(document), 50));
  Hooks.on("renderSidebarTab", patchTrackerIcons);

  scheduleInitiativeRoundDataCleanup(game.combat, "ready", 0);
  globalThis.add2eCleanupInitiativeRoundData = cleanupInitiativeRoundData;
  installInitiativeChatCard();
}
