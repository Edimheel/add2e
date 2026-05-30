// scripts/add2e-initiative-hooks.mjs
// ADD2E — hooks d'initiative.

import { ADD2E_INITIATIVE_VERSION, hasProperty, initiativeState } from "./add2e-initiative-constants.mjs";
import { currentCombatant, forceFirstSortedTurn, scheduleInitiativeSort, scheduleLocalSync, sortedCombatants } from "./add2e-initiative-order.mjs";
import { installInitiativeChatCard } from "./add2e-initiative-chat.mjs";
import { patchInitiativeIcons } from "./add2e-initiative-icons.mjs";
import { canTokenInteractNow, clearFoundryMovementTrailAggressive } from "./add2e-initiative-locks.mjs";

const MOVEMENT_KEYS = ["x", "y", "elevation", "rotation"];

function hasAnyProperty(obj, keys) {
  return keys.some(key => hasProperty(obj ?? {}, key));
}

function combatFor(combatant) {
  return combatant?.combat ?? game.combat;
}

function patchTrackerIcons(app, html) {
  if (app?.options?.id === "combat" || app?.tabName === "combat" || app?.id === "combat") patchInitiativeIcons(html);
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
    active: currentCombatant(combat)?.name ?? null,
    turns: turns.map((c, index) => ({ index, id: c.id, name: c.name, initiative: c.initiative, tokenId: c.tokenId }))
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
    if (options?.add2eInitiativeSort || options?.add2eInitiativeNavigation) return;
    if (hasProperty(changes ?? {}, "started") && combat?.started) return setTimeout(() => forceFirstSortedTurn(combat), 80);
    if (hasAnyProperty(changes, ["turn", "round"])) scheduleLocalSync(combat, { delay: 40, selectToken: true });
  });

  Hooks.on("combatTurn", combat => scheduleLocalSync(combat, { delay: 30, selectToken: true }));
  Hooks.on("combatRound", combat => scheduleLocalSync(combat, { delay: 30, selectToken: true }));
  Hooks.on("canvasReady", () => scheduleLocalSync(game.combat, { delay: 180, selectToken: game.combat?.started }));
  Hooks.on("hoverToken", clearFoundryMovementTrailAggressive);
  Hooks.on("refreshToken", clearFoundryMovementTrailAggressive);

  Hooks.on("renderCombatTracker", (_app, html) => patchInitiativeIcons(html));
  Hooks.on("renderCombatantConfig", () => setTimeout(() => patchInitiativeIcons(document), 50));
  Hooks.on("renderSidebarTab", patchTrackerIcons);

  installInitiativeChatCard();
}
