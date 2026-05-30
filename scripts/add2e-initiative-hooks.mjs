// scripts/add2e-initiative-hooks.mjs
// ADD2E — hooks d'initiative.

import { ADD2E_INITIATIVE_VERSION, hasProperty, initiativeState } from "./add2e-initiative-constants.mjs";
import {
  forceFirstSortedTurn,
  scheduleInitiativeSort,
  scheduleLocalSync,
  sortedCombatants,
  currentCombatant
} from "./add2e-initiative-order.mjs";
import { patchInitiativeIcons } from "./add2e-initiative-icons.mjs";
import { installInitiativeChatCard } from "./add2e-initiative-chat.mjs";
import { canTokenInteractNow, clearFoundryMovementTrailAggressive } from "./add2e-initiative-locks.mjs";

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
    turns: turns.map((c, i) => ({ index: i, id: c.id, name: c.name, initiative: c.initiative, tokenId: c.tokenId }))
  };
}

export function installHooks() {
  if (initiativeState.hooksInstalled) return;
  initiativeState.hooksInstalled = true;

  Hooks.on("preUpdateToken", (tokenDoc, changes, options, userId) => {
    if (options?.add2eIgnoreTurnLock) return;
    if (!(hasProperty(changes ?? {}, "x") || hasProperty(changes ?? {}, "y") || hasProperty(changes ?? {}, "elevation") || hasProperty(changes ?? {}, "rotation"))) return;
    if (game.users?.get?.(userId)?.isGM) return;
    if (!canTokenInteractNow(tokenDoc, { notify: game.user?.id === userId })) return false;
  });

  Hooks.on("updateCombatant", (combatant, changes, options) => {
    if (options?.add2eInitiativeSort) return;
    if (hasProperty(changes ?? {}, "initiative")) scheduleInitiativeSort(combatant.combat ?? game.combat);
  });

  Hooks.on("createCombatant", (combatant, options) => {
    if (!options?.add2eInitiativeSort) scheduleInitiativeSort(combatant.combat ?? game.combat);
  });

  Hooks.on("deleteCombatant", (combatant, options) => {
    if (!options?.add2eInitiativeSort) scheduleInitiativeSort(combatant.combat ?? game.combat);
  });

  Hooks.on("updateCombat", (combat, changes, options) => {
    if (options?.add2eInitiativeSort || options?.add2eInitiativeNavigation) return;
    if (hasProperty(changes ?? {}, "started") && combat?.started) {
      setTimeout(() => forceFirstSortedTurn(combat), 80);
      return;
    }
    if (hasProperty(changes ?? {}, "turn") || hasProperty(changes ?? {}, "round")) {
      scheduleLocalSync(combat, { delay: 40, selectToken: true });
    }
  });

  Hooks.on("combatTurn", combat => scheduleLocalSync(combat, { delay: 30, selectToken: true }));
  Hooks.on("combatRound", combat => scheduleLocalSync(combat, { delay: 30, selectToken: true }));
  Hooks.on("canvasReady", () => scheduleLocalSync(game.combat, { delay: 180, selectToken: game.combat?.started }));
  Hooks.on("hoverToken", token => clearFoundryMovementTrailAggressive(token));
  Hooks.on("refreshToken", token => clearFoundryMovementTrailAggressive(token));

  Hooks.on("renderCombatTracker", (_app, html) => patchInitiativeIcons(html));
  Hooks.on("renderCombatantConfig", () => setTimeout(() => patchInitiativeIcons(document), 50));
  Hooks.on("renderSidebarTab", (app, html) => {
    if (app?.options?.id === "combat" || app?.tabName === "combat" || app?.id === "combat") patchInitiativeIcons(html);
  });

  installInitiativeChatCard();
}
