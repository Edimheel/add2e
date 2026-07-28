// scripts/add2e-initiative.mjs
// ADD2E — point d'entrée et service canonique d'initiative.

import {
  ADD2E_INITIATIVE_VERSION,
  TAG,
  configureInitiative,
  initiativeState
} from "./add2e-initiative-constants.mjs";
import {
  advanceSortedTurn,
  compareCombatantsAscending,
  currentCombatant,
  forceFirstSortedTurn,
  installCombatPatch,
  isInactiveCombatant,
  scheduleInitiativeSort,
  scheduleLocalSync,
  selectCurrentToken,
  sortInitiativeAscending,
  sortedCombatants
} from "./add2e-initiative-order.mjs";
import { installInitiativeIconPatch, patchInitiativeIcons } from "./add2e-initiative-icons.mjs";
import {
  canActorActNow,
  canTokenInteractNow,
  clearFoundryMovementTrailAggressive,
  installActionLocks,
  installTokenMoveLock,
  syncActionHudToCombatant
} from "./add2e-initiative-locks.mjs";
import { add2eInitiativeDebug, installHooks } from "./add2e-initiative-hooks.mjs";
import { createInitiativeChatCard } from "./add2e-initiative-chat.mjs";

function initiativeEngine() {
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine ?? null;
  if (!engine || typeof engine.resolve !== "function") {
    throw new Error("Le moteur canonique ADD2E des modificateurs d'initiative est indisponible.");
  }
  return engine;
}

function initiativeFormula(options = {}) {
  return String(options?.formula ?? CONFIG.Combat?.initiative?.formula ?? "1d6").trim() || "1d6";
}

function initiativeIds(ids) {
  const list = Array.isArray(ids) ? ids : [ids];
  return [...new Set(list.map(value => String(value ?? "").trim()).filter(Boolean))];
}

function initiativeResolutionWithoutActor(base) {
  const total = Number(base);
  return {
    domain: "initiative",
    target: "roll",
    base: Number.isFinite(total) ? total : 0,
    total: Number.isFinite(total) ? total : 0,
    applied: [],
    rejected: []
  };
}

export function resolveInitiative(actor, {
  base = 0,
  combat = game.combat,
  combatant = null,
  formula = "1d6",
  context = {}
} = {}) {
  const numericBase = Number(base);
  const safeBase = Number.isFinite(numericBase) ? numericBase : 0;
  if (!actor) return initiativeResolutionWithoutActor(safeBase);

  return initiativeEngine().resolve(actor, {
    domain: "initiative",
    target: "roll",
    base: safeBase,
    rounding: "round",
    context: {
      ...context,
      actor,
      combat,
      combatant,
      formula,
      actionType: "initiative",
      source: context.source ?? "combat-initiative"
    }
  });
}

function combatantSpeakerOptions(combatant, options = {}) {
  const messageOptions = options?.messageOptions && typeof options.messageOptions === "object"
    ? { ...options.messageOptions }
    : {};
  return {
    messageOptions,
    messageMode: options?.messageMode ?? null,
    combatant
  };
}

async function restoreCurrentCombatant(combat, combatantId, updateTurn) {
  if (!combat?.started || updateTurn === false || !combatantId) return;
  const turns = sortedCombatants(combat);
  const index = turns.findIndex(entry => String(entry.id) === String(combatantId));
  if (index < 0 || Number(combat.turn) === index) return;
  await combat.update({ turn: index }, { add2eInitiativeNavigation: true });
}

export async function rollInitiative(combat, ids, options = {}) {
  if (!combat?.combatants) throw new Error("Combat introuvable pour le jet d'initiative ADD2E.");
  const selected = initiativeIds(ids)
    .map(id => combat.combatants.get?.(id) ?? Array.from(combat.combatants ?? []).find(entry => entry.id === id))
    .filter(Boolean);
  if (!selected.length) return combat;

  const formula = initiativeFormula(options);
  const activeId = combat.current?.combatantId ?? combat.combatant?.id ?? null;
  const updates = [];
  const messages = [];

  for (const combatant of selected) {
    const initiativeRoll = typeof combatant.getInitiativeRoll === "function"
      ? combatant.getInitiativeRoll(formula)
      : new Roll(formula, combatant.actor?.getRollData?.() ?? {});
    const roll = await initiativeRoll.evaluate();
    const resolution = resolveInitiative(combatant.actor ?? null, {
      base: roll.total,
      combat,
      combatant,
      formula,
      context: {
        source: "combat-roll-initiative",
        tokenId: combatant.tokenId ?? null,
        actorId: combatant.actorId ?? combatant.actor?.id ?? null
      }
    });
    const total = Number(resolution?.total);
    if (!Number.isFinite(total)) {
      throw new Error(`Initiative invalide pour ${combatant.name ?? combatant.id}.`);
    }

    updates.push({ _id: combatant.id, initiative: total });
    messages.push({
      ...combatantSpeakerOptions(combatant, options),
      roll,
      formula,
      resolution
    });
  }

  await combat.updateEmbeddedDocuments("Combatant", updates, {
    add2eInitiativeResolution: true,
    add2eInitiativeSort: true
  });

  if (combat.started) await sortInitiativeAscending(combat);
  else combat.setupTurns?.();
  await restoreCurrentCombatant(combat, activeId, options.updateTurn);

  for (const message of messages) await createInitiativeChatCard(message);

  Hooks.callAll("add2eInitiativeRolled", combat, {
    version: ADD2E_INITIATIVE_VERSION,
    formula,
    updates,
    combatantIds: updates.map(update => update._id)
  });
  return combat;
}

export function installInitiativeRollPatch() {
  if (initiativeState.rollPatched) return true;
  const proto = globalThis.Combat?.prototype;
  if (!proto || typeof proto.rollInitiative !== "function") return false;
  if (proto.rollInitiative.__add2eCanonicalInitiative === ADD2E_INITIATIVE_VERSION) {
    initiativeState.rollPatched = true;
    return true;
  }

  const original = proto.rollInitiative.__add2eOriginal ?? proto.rollInitiative;
  proto.rollInitiative = function add2eCanonicalRollInitiative(ids, options = {}) {
    if (game?.system?.id !== "add2e") return original.call(this, ids, options);
    return rollInitiative(this, ids, options);
  };
  proto.rollInitiative.__add2eCanonicalInitiative = ADD2E_INITIATIVE_VERSION;
  proto.rollInitiative.__add2eOriginal = original;
  initiativeState.rollPatched = true;
  return true;
}

function exposeGlobals() {
  game.add2e = game.add2e ?? {};
  game.add2e.initiativeVersion = ADD2E_INITIATIVE_VERSION;
  game.add2e.initiative = {
    version: ADD2E_INITIATIVE_VERSION,
    resolve: resolveInitiative,
    roll: rollInitiative,
    compare: compareCombatantsAscending,
    order: sortedCombatants,
    current: currentCombatant,
    canTakeTurn: combatant => !isInactiveCombatant(combatant),
    advance: advanceSortedTurn
  };

  Object.assign(globalThis, {
    add2eConfigureInitiative: configureInitiative,
    add2eResolveInitiative: resolveInitiative,
    add2eRollInitiative: rollInitiative,
    add2eCompareInitiative: compareCombatantsAscending,
    add2eGetCombatOrder: sortedCombatants,
    add2eGetCurrentCombatant: currentCombatant,
    add2eCanCombatantTakeTurn: combatant => !isInactiveCombatant(combatant),
    add2eAdvanceCombatTurn: advanceSortedTurn,
    add2eSortInitiative: sortInitiativeAscending,
    add2eScheduleInitiativeSort: scheduleInitiativeSort,
    add2eCanActorActNow: canActorActNow,
    add2eCanTokenInteractNow: canTokenInteractNow,
    add2eSyncActionHudToCombatant: syncActionHudToCombatant,
    add2eSyncCombatAfterRefresh: scheduleLocalSync,
    add2eScheduleRefreshSync: scheduleLocalSync,
    add2eDebugCombatState: add2eInitiativeDebug,
    add2eSelectActiveCombatantToken: selectCurrentToken,
    add2eClearFoundryMovementTrail: clearFoundryMovementTrailAggressive,
    add2eForceFirstSortedTurn: forceFirstSortedTurn
  });
}

function installInitiativeCore() {
  configureInitiative();
  installCombatPatch();
  installInitiativeRollPatch();
}

Hooks.once("init", installInitiativeCore);
Hooks.once("setup", installInitiativeCore);
Hooks.once("ready", () => {
  installInitiativeCore();
  installInitiativeIconPatch();
  exposeGlobals();
  installTokenMoveLock();
  installActionLocks();
  installHooks();
  patchInitiativeIcons(ui?.combat?.element ?? document);
  console.log(`${TAG}[CANONICAL_READY]`, ADD2E_INITIATIVE_VERSION);
});

export {
  configureInitiative as add2eConfigureInitiative,
  resolveInitiative as add2eResolveInitiative,
  rollInitiative as add2eRollInitiative,
  compareCombatantsAscending as add2eCompareInitiative,
  sortedCombatants as add2eGetCombatOrder,
  currentCombatant as add2eGetCurrentCombatant,
  advanceSortedTurn as add2eAdvanceCombatTurn,
  canActorActNow as add2eCanActorActNow,
  syncActionHudToCombatant as add2eSyncActionHudToCombatant,
  scheduleLocalSync as add2eSyncCombatAfterRefresh,
  add2eInitiativeDebug as add2eDebugCombatState,
  clearFoundryMovementTrailAggressive as add2eDisableMovementHistoryRecording
};
