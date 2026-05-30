// scripts/add2e-initiative-order.mjs
// ADD2E — ordre, tri et navigation d'initiative.
// Règle : 1d6, le plus petit score agit en premier.

import { ADD2E_INITIATIVE_VERSION, TAG, initiativeState } from "./add2e-initiative-constants.mjs";

function isCombatStarted(combat = game.combat) {
  return Boolean(combat?.started && Number(combat?.round ?? 0) > 0);
}

function activeCombatantId(combat = game.combat) {
  return combat?.current?.combatantId ?? combat?.combatant?.id ?? null;
}

function logOrder(label, combat, turns = sortedCombatants(combat), extra = {}) {
  try {
    console.log(`${TAG}[ORDER][${label}]`, {
      started: combat?.started ?? null,
      round: combat?.round ?? null,
      turn: combat?.turn ?? null,
      current: combat?.current ?? null,
      nativeCombatant: combat?.combatant?.id ?? null,
      activeId: activeCombatantId(combat),
      activeName: currentCombatant(combat)?.name ?? null,
      turns: turns.map((c, index) => ({ index, id: c.id, name: c.name, initiative: c.initiative, sort: c.sort, inactive: isInactiveCombatant(c) })),
      ...extra
    });
  } catch (err) {
    console.warn(`${TAG}[ORDER][LOG_ERROR]`, err);
  }
}

function safeSettingGet(namespace, key) {
  try {
    return game.settings?.get?.(namespace, key);
  } catch (_err) {
    return undefined;
  }
}

function settingBoolean(value) {
  if (typeof value === "boolean") return value;
  if (!value || typeof value !== "object") return null;
  for (const key of ["skipInactive", "skipInactiveCombatants", "skipDefeated", "skipDefeatedCombatants"]) {
    if (typeof value[key] === "boolean") return value[key];
  }
  return null;
}

function shouldSkipInactiveCombatants() {
  for (const [namespace, key] of [
    ["core", "combatTrackerConfig"],
    ["core", "skipDefeated"],
    ["core", "skipDefeatedCombatants"],
    ["core", "skipInactive"],
    ["core", "skipInactiveCombatants"],
    ["add2e", "skipInactiveCombatants"]
  ]) {
    const parsed = settingBoolean(safeSettingGet(namespace, key));
    if (parsed !== null) return parsed;
  }
  return false;
}

function getProperty(obj, path) {
  try {
    return globalThis.foundry?.utils?.getProperty ? foundry.utils.getProperty(obj, path) : path.split(".").reduce((o, k) => o?.[k], obj);
  } catch (_err) {
    return undefined;
  }
}

function truthy(value) {
  if (value === true) return true;
  if (typeof value === "number") return value !== 0;
  if (typeof value !== "string") return false;
  return ["true", "1", "yes", "oui", "inactif", "inactive", "vaincu", "defeated"].includes(value.trim().toLowerCase());
}

function isInactiveCombatant(combatant) {
  if (!combatant) return false;
  if (truthy(combatant.defeated) || truthy(combatant.isDefeated)) return true;

  const actor = combatant.actor ?? null;
  const token = combatant.token ?? null;
  for (const source of [combatant, actor, token]) {
    if (!source) continue;
    for (const path of [
      "flags.add2e.inactif",
      "flags.add2e.inactive",
      "flags.add2e.horsJeu",
      "flags.add2e.outOfCombat",
      "system.inactif",
      "system.inactive",
      "system.horsJeu",
      "system.outOfCombat"
    ]) {
      if (truthy(getProperty(source, path))) return true;
    }
  }

  return false;
}

function nextTurnRespectingInactive(turns, current, direction) {
  let next = current;
  let roundDelta = 0;
  const skipped = [];

  for (let attempt = 0; attempt < turns.length; attempt += 1) {
    next += direction;
    if (next >= turns.length) {
      next = 0;
      roundDelta += 1;
    } else if (next < 0) {
      next = turns.length - 1;
      roundDelta -= 1;
    }

    const combatant = turns[next];
    if (!isInactiveCombatant(combatant)) return { next, roundDelta, skipped, allInactive: false };
    skipped.push({ index: next, id: combatant?.id ?? null, name: combatant?.name ?? null });
  }

  return { next: current, roundDelta: 0, skipped, allInactive: true };
}

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

  const activeId = activeCombatantId(combat);
  const activeIndex = activeId ? turns.findIndex(c => c.id === activeId) : -1;
  const raw = Number(combat?.turn ?? combat?.current?.turn ?? 0);
  const rawIndex = Math.max(0, Math.min(turns.length - 1, Number.isFinite(raw) ? Math.floor(raw) : 0));

  if (activeIndex >= 0) {
    if (activeIndex !== rawIndex) logOrder("TURN_INDEX_ID_RESOLVED", combat, turns, { activeId, activeIndex, rawIndex });
    return activeIndex;
  }

  return rawIndex;
}

function combatRound(combat = game.combat) {
  const round = Number(combat?.round ?? 1);
  return Number.isFinite(round) && round > 0 ? Math.floor(round) : 1;
}

function setLocalTurn(combat, turns, index) {
  if (!combat || !turns?.length || !isCombatStarted(combat)) return false;
  const safe = Math.max(0, Math.min(turns.length - 1, Number(index) || 0));
  combat.turns = turns;
  combat.turn = safe;
  if (combat.current && typeof combat.current === "object") {
    combat.current.turn = safe;
    combat.current.combatantId = turns[safe]?.id ?? combat.current.combatantId;
  }
  return true;
}

export function applyLocalOrder(combat = game.combat, { first = false, reason = "local" } = {}) {
  if (!combat) return false;
  const turns = sortedCombatants(combat);
  if (!turns.length) return false;
  if (!isCombatStarted(combat)) {
    if (reason === "refresh" || reason === "ready" || reason === "sort") logOrder("APPLY_LOCAL_ORDER_SKIPPED_NOT_STARTED", combat, turns, { reason });
    return false;
  }

  const before = { turn: combat.turn, currentId: combat.current?.combatantId ?? null, combatantId: combat.combatant?.id ?? null };
  const index = first ? 0 : combatTurnIndex(combat, turns);
  const changed = before.turn !== index || before.currentId !== turns[index]?.id;
  const ok = setLocalTurn(combat, turns, index);
  if (changed || reason === "refresh") logOrder("APPLY_LOCAL_ORDER", combat, turns, { reason, before, index, ok });
  return ok;
}

export function currentCombatant(combat = game.combat) {
  if (!isCombatStarted(combat)) return null;
  const turns = Array.isArray(combat.turns) && combat.turns.length ? combat.turns : sortedCombatants(combat);
  return turns[combatTurnIndex(combat, turns)] ?? combat.combatant ?? null;
}

export function tokenFromCombatant(combatant) {
  return combatant?.token?.object ?? (combatant?.tokenId ? canvas?.tokens?.get?.(combatant.tokenId) : null) ?? null;
}

export function selectCurrentToken(combat = game.combat) {
  if (!isCombatStarted(combat)) return false;
  const combatant = currentCombatant(combat);
  const token = tokenFromCombatant(combatant);
  if (!token?.control) {
    logOrder("TOKEN_SELECT_SKIP", combat, undefined, { combatant: combatant?.name ?? null, tokenId: combatant?.tokenId ?? null });
    return false;
  }
  try {
    token.control({ releaseOthers: true });
    logOrder("TOKEN_SELECT", combat, undefined, { combatant: combatant?.name ?? null, token: token.name ?? null });
    return true;
  } catch (err) {
    console.warn(`${TAG}[TOKEN_SELECT][ERROR]`, err);
    return false;
  }
}

export function scheduleLocalSync(combat = game.combat, { delay = 120, selectToken = false, reason = "sync" } = {}) {
  if (!combat) return;
  clearTimeout(initiativeState.localSyncTimer);
  initiativeState.localSyncTimer = setTimeout(() => {
    applyLocalOrder(combat, { reason });
    if (selectToken) selectCurrentToken(combat);
  }, delay);
}

async function updateTurn(combat, index, round = combatRound(combat)) {
  const turns = sortedCombatants(combat);
  if (!turns.length || !isCombatStarted(combat)) return combat;
  const safeIndex = Math.max(0, Math.min(turns.length - 1, Number(index) || 0));
  const safeRound = Math.max(1, Math.floor(Number(round) || 1));

  logOrder("UPDATE_TURN_BEFORE", combat, turns, { requestedIndex: index, safeIndex, safeRound });
  await combat.update({ round: safeRound, turn: safeIndex }, { add2eInitiativeNavigation: true });
  setLocalTurn(combat, turns, safeIndex);
  selectCurrentToken(combat);

  if (typeof globalThis.add2eSyncActionHudToCombatant === "function") {
    globalThis.add2eSyncActionHudToCombatant(combat, { reason: "turn" });
  }

  logOrder("UPDATE_TURN_AFTER", combat, turns, { safeIndex, safeRound });
  return combat;
}

export async function forceFirstSortedTurn(combat = game.combat) {
  if (!combat || !isCombatStarted(combat)) return combat;
  const turns = sortedCombatants(combat);
  if (!turns.length) return combat;
  const existing = combatTurnIndex(combat, turns);
  logOrder("START_SYNC_EXISTING_TURN", combat, turns, { existing, write: false });
  applyLocalOrder(combat, { reason: "start-sync" });
  selectCurrentToken(combat);
  return combat;
}

export async function advanceSortedTurn(combat = game.combat, step = 1) {
  if (!combat || !isCombatStarted(combat)) return combat;

  const turns = sortedCombatants(combat);
  if (!turns.length) return combat;

  const current = combatTurnIndex(combat, turns);
  const direction = step >= 0 ? 1 : -1;
  let next = current + direction;
  let round = combatRound(combat);
  const skipInactive = shouldSkipInactiveCombatants();

  if (skipInactive) {
    const resolved = nextTurnRespectingInactive(turns, current, direction);
    if (resolved.allInactive) {
      logOrder("SKIP_INACTIVE_ALL_SKIPPED", combat, turns, { step, current, skipped: resolved.skipped });
      return combat;
    }
    next = resolved.next;
    round = Math.max(1, round + resolved.roundDelta);
    if (resolved.skipped.length) logOrder("SKIP_INACTIVE_RESOLVED", combat, turns, { step, current, next, round, skipped: resolved.skipped });
  } else if (next >= turns.length) {
    next = 0;
    round += 1;
  } else if (next < 0) {
    next = turns.length - 1;
    round = Math.max(1, round - 1);
  }

  logOrder("ADVANCE", combat, turns, { step, current, next, round, skipInactive });
  return updateTurn(combat, next, round);
}

export async function sortInitiativeAscending(combat = game.combat) {
  if (!combat || initiativeState.sorting) return false;
  const combatants = Array.from(combat.combatants ?? []);
  if (!combatants.length) return false;

  const turns = sortedCombatants(combat);
  if (!isCombatStarted(combat)) {
    logOrder("SORT_SKIPPED_NOT_STARTED", combat, turns);
    return false;
  }

  const activeIndex = combatTurnIndex(combat, turns);
  const activeId = turns[activeIndex]?.id ?? null;
  const updates = turns.map((c, index) => ({ _id: c.id, sort: index })).filter(update => {
    const current = combatants.find(c => c.id === update._id);
    return current && Number(current.sort) !== Number(update.sort);
  });

  initiativeState.sorting = true;
  try {
    if (updates.length) {
      logOrder("SORT_UPDATES", combat, turns, { activeIndex, activeId, updates });
      await combat.updateEmbeddedDocuments("Combatant", updates, { add2eInitiativeSort: true });
    }
    applyLocalOrder(combat, { reason: "sort" });
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
      if (game?.system?.id === "add2e") applyLocalOrder(this, { reason: "setupTurns" });
      return result;
    };
    proto.setupTurns.__add2eLowFirstSetup = ADD2E_INITIATIVE_VERSION;
    proto.setupTurns.__add2eOriginal = original;
  }

  if (proto.startCombat && proto.startCombat.__add2eLowFirstStart !== ADD2E_INITIATIVE_VERSION) {
    const original = proto.startCombat.__add2eOriginal ?? proto.startCombat;
    proto.startCombat = async function add2eStartCombatLowFirst(...args) {
      const result = await original.apply(this, args);
      if (game?.system?.id === "add2e") scheduleLocalSync(this, { delay: 40, selectToken: true, reason: "startCombat" });
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
