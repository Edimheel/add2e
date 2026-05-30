// scripts/add2e-initiative.mjs
// ADD2E — point d'entrée initiative.

import { ADD2E_INITIATIVE_VERSION, configureInitiative } from "./add2e-initiative-constants.mjs";
import {
  forceFirstSortedTurn,
  installCombatPatch,
  scheduleInitiativeSort,
  scheduleLocalSync,
  selectCurrentToken,
  sortInitiativeAscending
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

function exposeGlobals() {
  game.add2e = game.add2e ?? {};
  game.add2e.initiativeVersion = ADD2E_INITIATIVE_VERSION;

  Object.assign(globalThis, {
    add2eConfigureInitiative: configureInitiative,
    add2eSortInitiativeAscending: sortInitiativeAscending,
    add2eScheduleInitiativeSort: scheduleInitiativeSort,
    add2eCanActorActNow: canActorActNow,
    add2eCanTokenInteractNow: canTokenInteractNow,
    add2eSyncActionHudToCombatant: syncActionHudToCombatant,
    add2eSyncCombatAfterRefresh: scheduleLocalSync,
    add2eScheduleRefreshSync: scheduleLocalSync,
    add2eDebugCombatState: add2eInitiativeDebug,
    add2eSelectActiveCombatantToken: selectCurrentToken,
    add2eClearFoundryMovementTrail: clearFoundryMovementTrailAggressive,
    add2eForceFirstSortedTurn: forceFirstSortedTurn,
    triInitiativeAscendant: sortInitiativeAscending
  });
}

Hooks.once("init", configureInitiative);

Hooks.once("ready", () => {
  configureInitiative();
  installCombatPatch();
  installInitiativeIconPatch();
  exposeGlobals();
  installTokenMoveLock();
  installActionLocks();
  installHooks();
  patchInitiativeIcons(ui?.combat?.element ?? document);
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
