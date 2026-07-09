// scripts/add2e-initiative-order.mjs
// ADD2E — ordre, tri et navigation d'initiative.
// Règle : 1d6, le plus petit score agit en premier.
// Le fichier lit les états inactifs, mais ne les modifie jamais.

import { ADD2E_INITIATIVE_VERSION, TAG, initiativeState } from "./add2e-initiative-constants.mjs";

const INACTIVE_STATUS_IDS = new Set(["dead", "defeated", "unconscious", "incapacitated", "inactive", "inactif", "mort", "inconscient", "hors-combat", "hors-jeu"]);
const TRUE_VALUES = new Set(["true", "1", "yes", "oui", "dead", "defeated", "inactive", "inactif", "mort", "inconscient", "hors-combat", "hors-jeu"]);
const HP_PATHS = ["system.pv.value", "system.pv.actuel", "system.pv.current", "system.hp.value", "system.hp.current", "system.points_de_vie.actuel", "system.pointsVie.actuel", "system.pdv_actuel", "system.pdv"];
const FLAG_PATHS = ["defeated", "isDefeated", "flags.core.defeated", "flags.add2e.defeated", "flags.add2e.inactif", "flags.add2e.inactive", "flags.add2e.horsJeu", "flags.add2e.horsCombat", "system.defeated", "system.inactif", "system.inactive", "system.horsJeu", "system.horsCombat", "system.etat.mort", "system.etat.inconscient"];

function isCombatStarted(combat = game.combat) {
  return Boolean(combat?.started && Number(combat?.round ?? 0) > 0);
}

function getProperty(obj, path) {
  try {
    return globalThis.foundry?.utils?.getProperty ? foundry.utils.getProperty(obj, path) : path.split(".").reduce((o, k) => o?.[k], obj);
  } catch (_err) {
    return undefined;
  }
}

function safeSetting(namespace, key) {
  try { return game.settings?.get?.(namespace, key); } catch (_err) { return undefined; }
}

function boolSetting(value) {
  return typeof value === "boolean" ? value : null;
}

function objectBool(value, keys) {
  if (!value || typeof value !== "object") return null;
  for (const key of keys) {
    const parsed = boolSetting(value[key]);
    if (parsed !== null) return parsed;
  }
  return null;
}

function skipInactiveRotationEnabled() {
  const keys = ["skipDefeated", "skipDefeatedCombatants", "skipInactive", "skipInactiveCombatants"];
  const trackerConfig = safeSetting("core", "combatTrackerConfig");
  const fromConfig = objectBool(trackerConfig, keys);
  if (fromConfig !== null) {
    console.log(`${TAG}[INACTIVE][OPTION]`, { source: "core.combatTrackerConfig", value: fromConfig, trackerConfig });
    return fromConfig;
  }
  for (const key of keys) {
    const parsed = boolSetting(safeSetting("core", key));
    if (parsed !== null) {
      console.log(`${TAG}[INACTIVE][OPTION]`, { source: `core.${key}`, value: parsed });
      return parsed;
    }
  }
  console.log(`${TAG}[INACTIVE][OPTION]`, { source: "not-found", value: false, trackerConfig });
  return false;
}

function statusSetHasInactive(statuses) {
  if (!statuses) return false;
  for (const status of statuses) {
    const id = String(status?.id ?? status ?? "").toLowerCase();
    if (INACTIVE_STATUS_IDS.has(id)) return true;
  }
  return false;
}

function effectsHaveInactiveStatus(document) {
  return Array.from(document?.effects ?? []).some(effect => {
    if (effect?.disabled) return false;
    if (statusSetHasInactive(effect?.statuses)) return true;
    const id = String(effect?.statuses?.first?.() ?? effect?.statusId ?? effect?.id ?? effect?.name ?? "").toLowerCase();
    return INACTIVE_STATUS_IDS.has(id);
  });
}

function valueMeansInactive(value) {
  if (value === true) return true;
  if (typeof value === "string") return TRUE_VALUES.has(value.trim().toLowerCase());
  return false;
}

function documentHasInactiveFlag(document) {
  if (!document) return false;
  return FLAG_PATHS.some(path => valueMeansInactive(getProperty(document, path)));
}

function actorHp(actor) {
  for (const path of HP_PATHS) {
    const raw = getProperty(actor, path);
    if (raw === undefined || raw === null || raw === "") continue;
    const value = Number(raw);
    if (Number.isFinite(value)) return { path, value };
  }
  return { path: null, value: null };
}

export function isInactiveCombatant(combatant) {
  if (!combatant) return false;
  const tokenDoc = combatant.token ?? null;
  const actor = combatant.actor ?? tokenDoc?.actor ?? null;
  const hp = actorHp(actor);
  const inactive = Boolean(
    documentHasInactiveFlag(combatant) ||
    documentHasInactiveFlag(tokenDoc) ||
    documentHasInactiveFlag(actor) ||
    statusSetHasInactive(combatant.statuses) ||
    statusSetHasInactive(tokenDoc?.statuses) ||
    statusSetHasInactive(actor?.statuses) ||
    effectsHaveInactiveStatus(combatant) ||
    effectsHaveInactiveStatus(tokenDoc) ||
    effectsHaveInactiveStatus(actor) ||
    (hp.value !== null && hp.value <= 0)
  );
  console.log(`${TAG}[INACTIVE][CHECK]`, { combatant: combatant?.name ?? combatant?.id ?? null, combatantId: combatant?.id ?? null, actor: actor?.name ?? null, inactive, defeated: combatant?.defeated ?? null, coreDefeated: combatant?.flags?.core?.defeated ?? null, hpPath: hp.path, hpValue: hp.value });
  return inactive;
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

function activeCombatantId(combat = game.combat) {
  return combat?.current?.combatantId ?? combat?.combatant?.id ?? null;
}

export function combatTurnIndex(combat = game.combat, turns = sortedCombatants(combat)) {
  if (!turns.length) return 0;
  const activeId = activeCombatantId(combat);
  const activeIndex = activeId ? turns.findIndex(c => c.id === activeId) : -1;
  if (activeIndex >= 0) return activeIndex;
  return numericTurnIndex(combat, turns);
}

function numericTurnIndex(combat = game.combat, turns = sortedCombatants(combat)) {
  if (!turns.length) return 0;
  const raw = Number(combat?.turn ?? combat?.current?.turn ?? 0);
  return Math.max(0, Math.min(turns.length - 1, Number.isFinite(raw) ? Math.floor(raw) : 0));
}

function combatRound(combat = game.combat) {
  const round = Number(combat?.round ?? 1);
  return Number.isFinite(round) && round > 0 ? Math.floor(round) : 1;
}

function setLocalTurnsOnly(combat, turns) {
  if (!combat || !turns?.length) return false;
  combat.turns = turns;
  return true;
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

function firstEligibleIndex(turns) {
  if (!turns.length || !skipInactiveRotationEnabled()) return 0;
  const index = turns.findIndex(c => !isInactiveCombatant(c));
  return index >= 0 ? index : 0;
}

function resolveNextActiveTurn(turns, current, direction) {
  let next = current;
  let roundDelta = 0;
  const skipped = [];
  for (let attempt = 0; attempt < turns.length; attempt += 1) {
    next += direction;
    if (next >= turns.length) { next = 0; roundDelta += 1; }
    else if (next < 0) { next = turns.length - 1; roundDelta -= 1; }
    const candidate = turns[next];
    if (!isInactiveCombatant(candidate)) {
      console.log(`${TAG}[INACTIVE][NEXT]`, { currentIndex: current, selectedIndex: next, selected: candidate?.name ?? candidate?.id ?? null, direction, roundDelta, skipped });
      return { index: next, roundDelta };
    }
    skipped.push({ index: next, name: candidate?.name ?? candidate?.id ?? null });
  }
  console.log(`${TAG}[INACTIVE][NEXT][ALL_SKIPPED]`, { currentIndex: current, direction, skipped });
  return { index: current, roundDelta: 0 };
}

function localIndex(combat, turns, first) {
  if (first) return firstEligibleIndex(turns);
  const current = combatTurnIndex(combat, turns);
  if (skipInactiveRotationEnabled() && isInactiveCombatant(turns[current])) return resolveNextActiveTurn(turns, current, 1).index;
  return current;
}

export function applyLocalOrder(combat = game.combat, { first = false, reason = "local-order" } = {}) {
  if (!combat || !isCombatStarted(combat)) return false;
  const turns = sortedCombatants(combat);
  if (!turns.length) return false;
  const index = localIndex(combat, turns, first);
  console.log(`${TAG}[INACTIVE][APPLY_LOCAL]`, { reason, round: combat?.round ?? null, previousTurn: combat?.turn ?? null, selectedIndex: index, selected: turns[index]?.name ?? turns[index]?.id ?? null });
  return setLocalTurn(combat, turns, index);
}

export function currentCombatant(combat = game.combat) {
  if (!isCombatStarted(combat)) return null;
  const turns = Array.isArray(combat.turns) && combat.turns.length ? combat.turns : sortedCombatants(combat);
  return turns[combatTurnIndex(combat, turns)] ?? null;
}

export function tokenFromCombatant(combatant) {
  return combatant?.token?.object ?? (combatant?.tokenId ? canvas?.tokens?.get?.(combatant.tokenId) : null) ?? null;
}

export function selectCurrentToken(combat = game.combat) {
  if (!isCombatStarted(combat)) return false;
  const combatant = currentCombatant(combat);
  const token = tokenFromCombatant(combatant);
  if (!token?.control) return false;
  try {
    token.control({ releaseOthers: true });
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
  const target = turns[safeIndex];
  console.log(`${TAG}[INACTIVE][UPDATE_TURN]`, { round: safeRound, turn: safeIndex, target: target?.name ?? target?.id ?? null, targetInactive: isInactiveCombatant(target) });
  await combat.update({ round: safeRound, turn: safeIndex }, { add2eInitiativeNavigation: true });
  setLocalTurn(combat, turns, safeIndex);
  selectCurrentToken(combat);
  if (typeof globalThis.add2eSyncActionHudToCombatant === "function") globalThis.add2eSyncActionHudToCombatant(combat, { reason: "turn" });
  return combat;
}

export async function forceFirstSortedTurn(combat = game.combat) {
  if (!combat || !isCombatStarted(combat)) return combat;
  const turns = sortedCombatants(combat);
  if (!turns.length) return combat;
  setLocalTurn(combat, turns, firstEligibleIndex(turns));
  selectCurrentToken(combat);
  return combat;
}

export async function advanceSortedTurn(combat = game.combat, step = 1) {
  if (!combat || !isCombatStarted(combat)) return combat;
  const turns = sortedCombatants(combat);
  if (!turns.length) return combat;
  const current = numericTurnIndex(combat, turns);
  const direction = step >= 0 ? 1 : -1;
  let next = current + direction;
  let round = combatRound(combat);
  const skipInactive = skipInactiveRotationEnabled();
  console.log(`${TAG}[INACTIVE][ADVANCE]`, { round, currentIndex: current, current: turns[current]?.name ?? turns[current]?.id ?? null, direction, skipInactive, currentInactive: isInactiveCombatant(turns[current]) });
  if (skipInactive) {
    const resolved = resolveNextActiveTurn(turns, current, direction);
    next = resolved.index;
    round = Math.max(1, round + resolved.roundDelta);
  } else if (next >= turns.length) { next = 0; round += 1; }
  else if (next < 0) { next = turns.length - 1; round = Math.max(1, round - 1); }
  return updateTurn(combat, next, round);
}

export async function sortInitiativeAscending(combat = game.combat) {
  if (!combat || initiativeState.sorting) return false;
  const combatants = Array.from(combat.combatants ?? []);
  if (!combatants.length || !isCombatStarted(combat)) return false;
  const turns = sortedCombatants(combat);
  const updates = turns.map((c, index) => ({ _id: c.id, sort: index })).filter(update => {
    const current = combatants.find(c => c.id === update._id);
    return current && Number(current.sort) !== Number(update.sort);
  });
  initiativeState.sorting = true;
  try {
    if (updates.length) await combat.updateEmbeddedDocuments("Combatant", updates, { add2eInitiativeSort: true });
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
      if (game?.system?.id === "add2e") setLocalTurnsOnly(this, sortedCombatants(this));
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
