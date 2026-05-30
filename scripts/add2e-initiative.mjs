// scripts/add2e-initiative.mjs
// ADD2E — point d'entrée initiative.
// Les modules préfixés add2e-initiative-* isolent le tri, les icônes, le chat, les verrous et les hooks.

import { ADD2E_INITIATIVE_VERSION, configureInitiative } from "./add2e-initiative-constants.mjs";
import {
  installCombatPatch,
  sortInitiativeAscending,
  scheduleInitiativeSort,
  scheduleLocalSync,
  forceFirstSortedTurn,
  selectCurrentToken
} from "./add2e-initiative-order.mjs";
import { patchInitiativeIcons } from "./add2e-initiative-icons.mjs";
import {
  canActorActNow,
  canTokenInteractNow,
  clearFoundryMovementTrailAggressive,
  installActionLocks,
  installTokenMoveLock,
  syncActionHudToCombatant
} from "./add2e-initiative-locks.mjs";
import { installHooks, add2eInitiativeDebug } from "./add2e-initiative-hooks.mjs";

function exposeGlobals() {
  game.add2e = game.add2e ?? {};
  game.add2e.initiativeVersion = ADD2E_INITIATIVE_VERSION;

  globalThis.add2eConfigureInitiative = configureInitiative;
  globalThis.add2eSortInitiativeAscending = sortInitiativeAscending;
  globalThis.add2eScheduleInitiativeSort = scheduleInitiativeSort;
  globalThis.add2eCanActorActNow = canActorActNow;
  globalThis.add2eCanTokenInteractNow = canTokenInteractNow;
  globalThis.add2eSyncActionHudToCombatant = syncActionHudToCombatant;
  globalThis.add2eSyncCombatAfterRefresh = scheduleLocalSync;
  globalThis.add2eScheduleRefreshSync = scheduleLocalSync;
  globalThis.add2eDebugCombatState = add2eInitiativeDebug;
  globalThis.add2eSelectActiveCombatantToken = selectCurrentToken;
  globalThis.add2eClearFoundryMovementTrail = clearFoundryMovementTrailAggressive;
  globalThis.add2eForceFirstSortedTurn = forceFirstSortedTurn;
  globalThis.triInitiativeAscendant = sortInitiativeAscending;
}

Hooks.once("init", configureInitiative);

Hooks.once("ready", () => {
  configureInitiative();
  installCombatPatch();
  exposeGlobals();
  installTokenMoveLock();
  installActionLocks();
  installHooks();
  patchInitiativeIcons(document);
  setTimeout(() => scheduleInitiativeSort(game.combat), 500);
  setTimeout(() => scheduleLocalSync(game.combat, { delay: 0, selectToken: game.combat?.started }), 900);
});

export {
  configureInitiative as add2eConfigureInitiative,
  sortInitiativeAscending as add2eSortInitiativeAscending,
  canActorActNow as add2eCanActorActNow,
  syncActionHudToCombatant as add2eSyncActionHudToCombatant,
  scheduleLocalSync as add2eSyncCombatAfterRefresh,
  add2eInitiativeDebug as add2eDebugCombatState,
  clearFoundryMovementTrailAggressive as add2eDisableMovementHistoryRecording
};
