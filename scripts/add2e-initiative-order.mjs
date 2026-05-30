// scripts/add2e-initiative-order.mjs
// ADD2E — ordre, tri et navigation d'initiative.
// Règle : 1d6, le plus petit score agit en premier.

import { ADD2E_INITIATIVE_VERSION, TAG, initiativeState } from "./add2e-initiative-constants.mjs";

export function initiativeValue(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function compareCombatantsAscending(a, b) {
  const ai = initiativeValue(a?.initiative);
  const bi = initiativeValue(b?.initiative);
  if (ai === null && bi === null) return String(a?.id ?? "").localeCompare(String(b?.id ?? ""));
  if (ai === null) return 1;
  if (bi === null) return -1;
  if (ai !== bi) return ai - bi;
  return String(a?.id ?? "").localeCompare(String(b?.id ?? ""));
}

export function sortedCombatants(combat = game.combat) {
  return Array.from(combat?.combatants ?? []).sort(compareCombatantsAscending);
}

export function combatTurnIndex(combat = game.combat, turns = sortedCombatants(combat)) {
  if (!turns.length) return 0;
  const raw = Number(combat?.turn ?? combat?.current?.turn ?? 0);
  const n = Number.isFinite(raw) ? Math.floor(raw) : 0;
  return Math.max(0, Math.min(turns.length - 1, n));
}

function adjacentSortedIndex(turns, startIndex, direction = 1) {
  if (!turns.length) return { index: 0, wrapped: false };
  const dir = direction >= 0 ? 1 : -1;
  const start = Math.max(0, Math.min(turns.length - 1, Number(startIndex) || 0));
  const raw = start + dir;
  const wrapped = raw >= turns.length || raw < 0;
  const index = ((raw % turns.length) + turns.length) % turns.length;
  return { index, wrapped };
}

export function setLocalTurn(combat, turns, index) {
  if (!combat || !turns?.length) return false;
  const safe = Math.max(0, Math.min(turns.length - 1, Number(index) || 0));
  combat.turns = turns;
  if (combat.started) {
    combat.turn = safe;
    if (combat.current && typeof combat.current === "object") {
      combat.current.turn = safe;
      combat.current.combatantId = turns[safe]?.id ?? combat.current.combatantId;
    }
  }
  return true;
}

export function applyLocalOrder(combat = game.combat, { first = false } = {}) {
  if (!combat) return false;
  const turns = sortedCombatants(combat);
  if (!turns.length) return false;
  const index = first ? 0 : combatTurnIndex(combat, turns);
  return setLocalTurn(combat, turns, index);
}

export function currentCombatant(combat = game.combat) {
  if (!combat?.started) return null;
  const turns = Array.isArray(combat.turns) && combat.turns.length ? combat.turns : sortedCombatants(combat);
  return turns[combatTurnIndex(combat, turns)] ?? combat.combatant ?? null;
}

export function tokenFromCombatant(combatant) {
  return combatant?.token?.object ?? (combatant?.tokenId ? canvas?.tokens?.get?.(combatant.tokenId) : null) ?? null;
}

export function selectCurrentToken(combat = game.combat) {
  if (!combat?.started) return false;
  const token = tokenFromCombatant(currentCombatant(combat));
  if (!token?.control) return false;
  try {
    token.control({ releaseOthers: true });
    return true;
  } catch (err) {
    console.warn(`${TAG}[TOKEN_SELECT][ERROR]`, err);
    return false;
  }
}

export function scheduleLocalSync(combat = game.combat, { delay = 120, selectToken = false } = {}) {
  if (!combat) return;
  clearTimeout(initiativeState.localSyncTimer);
  initiativeState.localSyncTimer = setTimeout(() => {
    applyLocalOrder(combat);
    if (selectToken) selectCurrentToken(combat);
  }, delay);
}

export async function setCombatTurn(combat, index, { roundDelta = 0 } = {}) {
  const turns = sortedCombatants(combat);
  if (!turns.length) return combat;
  const safe = Math.max(0, Math.min(turns.length - 1, Number(index) || 0));
  const round = Math.max(1, Number(combat.round ?? 1) + roundDelta);
  await combat.update({ round, turn: safe }, { add2eInitiativeNavigation: true });
  setLocalTurn(combat, turns, safe);
  selectCurrentToken(combat);
  if (typeof globalThis.add2eSyncActionHudToCombatant === "function") {
    globalThis.add2eSyncActionHudToCombatant(combat, { reason: "turn" });
  }
  return combat;
}

export async function forceFirstSortedTurn(combat = game.combat) {
  if (!combat) return combat;
  const turns = sortedCombatants(combat);
  if (!turns.length) return combat;
  return setCombatTurn(combat, 0);
}

export async function advanceSortedTurn(combat = game.combat, direction = 1) {
  if (!combat) return combat;
  applyLocalOrder(combat);
  const turns = sortedCombatants(combat);
  if (!turns.length) return combat;
  const current = combatTurnIndex(combat, turns);
  const next = adjacentSortedIndex(turns, current, direction);
  let roundDelta = 0;
  if (direction >= 0 && next.wrapped) roundDelta = 1;
  else if (direction < 0 && next.wrapped) roundDelta = Number(combat.round ?? 1) > 1 ? -1 : 0;
  return setCombatTurn(combat, next.index, { roundDelta });
}

export async function sortInitiativeAscending(combat = game.combat) {
  if (!combat || initiativeState.sorting) return false;
  const combatants = Array.from(combat.combatants ?? []);
  if (!combatants.length) return false;
  const turns = sortedCombatants(combat);
  const updates = turns.map((c, index) => ({ _id: c.id, sort: index })).filter(update => {
    const current = combatants.find(c => c.id === update._id);
    return current && Number(current.sort) !== Number(update.sort);
  });
  initiativeState.sorting = true;
  try {
    if (updates.length) await combat.updateEmbeddedDocuments("Combatant", updates, { add2eInitiativeSort: true });
    applyLocalOrder(combat);
    return true;
  } catch (err) {
    console.error(`${TAG}[SORT_ASC][ERROR]`, err);
    return false;
  } finally {
    initiativeState.sorting = false;
  }
}

export function scheduleInitiativeSort(combat = game.combat) {
  if (!combat) return;
  clearTimeout(initiativeState.sortTimer);
  initiativeState.sortTimer = setTimeout(() => sortInitiativeAscending(combat), 100);
}

export function patchNativeSort(target) {
  if (!target || typeof target._sortCombatants !== "function") return false;
  if (target._sortCombatants.__add2eLowFirst === ADD2E_INITIATIVE_VERSION) return true;
  const original = target._sortCombatants.__add2eOriginal ?? target._sortCombatants;
  target._sortCombatants = function add2eSortCombatantsLowFirst(a, b) {
    if (game?.system?.id === "add2e") return compareCombatantsAscending(a, b);
    return original.call(this, a, b);
  };
  target._sortCombatants.__add2eLowFirst = ADD2E_INITIATIVE_VERSION;
  target._sortCombatants.__add2eOriginal = original;
  return true;
}

export function installCombatPatch() {
  if (initiativeState.patched) return true;
  const proto = globalThis.Combat?.prototype;
  if (!proto) return false;

  patchNativeSort(proto);
  patchNativeSort(globalThis.Combat);

  if (proto.setupTurns && proto.setupTurns.__add2eLowFirstSetup !== ADD2E_INITIATIVE_VERSION) {
    const original = proto.setupTurns.__add2eOriginal ?? proto.setupTurns;
    proto.setupTurns = function add2eSetupTurnsLowFirst(...args) {
      const result = original.apply(this, args);
      if (game?.system?.id === "add2e") applyLocalOrder(this);
      return result;
    };
    proto.setupTurns.__add2eLowFirstSetup = ADD2E_INITIATIVE_VERSION;
    proto.setupTurns.__add2eOriginal = original;
  }

  if (proto.startCombat && proto.startCombat.__add2eLowFirstStart !== ADD2E_INITIATIVE_VERSION) {
    const original = proto.startCombat.__add2eOriginal ?? proto.startCombat;
    proto.startCombat = async function add2eStartCombatLowFirst(...args) {
      const result = await original.apply(this, args);
      if (game?.system?.id === "add2e") await forceFirstSortedTurn(this);
      return result;
    };
    proto.startCombat.__add2eLowFirstStart = ADD2E_INITIATIVE_VERSION;
    proto.startCombat.__add2eOriginal = original;
  }

  if (proto.nextTurn && proto.nextTurn.__add2eLowFirstNext !== ADD2E_INITIATIVE_VERSION) {
    const original = proto.nextTurn.__add2eOriginal ?? proto.nextTurn;
    proto.nextTurn = function add2eNextTurnLowFirst(...args) {
      if (game?.system?.id !== "add2e") return original.apply(this, args);
      return advanceSortedTurn(this, 1);
    };
    proto.nextTurn.__add2eLowFirstNext = ADD2E_INITIATIVE_VERSION;
    proto.nextTurn.__add2eOriginal = original;
  }

  if (proto.previousTurn && proto.previousTurn.__add2eLowFirstPrevious !== ADD2E_INITIATIVE_VERSION) {
    const original = proto.previousTurn.__add2eOriginal ?? proto.previousTurn;
    proto.previousTurn = function add2ePreviousTurnLowFirst(...args) {
      if (game?.system?.id !== "add2e") return original.apply(this, args);
      return advanceSortedTurn(this, -1);
    };
    proto.previousTurn.__add2eLowFirstPrevious = ADD2E_INITIATIVE_VERSION;
    proto.previousTurn.__add2eOriginal = original;
  }

  initiativeState.patched = true;
  return true;
}
