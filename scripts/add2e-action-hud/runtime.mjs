// ADD2E — branchement des hooks du HUD d'action.

import { ADD2E_ACTION_HUD_VERSION, TAG, controlledRelevantTokens, hud, hudTargetFromControlledSelection, relevant, tokenFor } from "./shared.mjs";

export function installActionHudRuntime(api) {
  if (globalThis.__ADD2E_ACTION_HUD_RUNTIME === ADD2E_ACTION_HUD_VERSION) return true;
  globalThis.__ADD2E_ACTION_HUD_RUNTIME = ADD2E_ACTION_HUD_VERSION;

  Hooks.once("init", () => {
    game.add2e = game.add2e ?? {};
    game.add2e.actionHudVersion = ADD2E_ACTION_HUD_VERSION;
    game.add2e.openActionHud = (actor = null) => {
      const target = actor ? { actor, token: tokenFor(actor) } : hudTargetFromControlledSelection({ allowCharacterFallback: true });
      return api.renderHud(target.actor, target.token, { reason: "api-open" });
    };
    game.add2e.closeActionHud = api.closeHud;
    game.add2e.refreshActionHud = () => {
      const state = api.getRuntimeState();
      return state.actor ? api.renderHud(state.actor, state.token, { reason: "api-refresh-current" }) : api.refreshHud("api-refresh");
    };
    game.add2e.resetActionHudPosition = api.resetHudPosition;
    Object.assign(globalThis, {
      add2eRenderActionHud: api.renderHud,
      add2eRefreshActionHud: api.refreshHud,
      add2eCloseActionHud: api.closeHud,
      add2eResetActionHudPosition: api.resetHudPosition,
      add2eHudCheck: () => {
        const state = api.getRuntimeState();
        return {
          version: ADD2E_ACTION_HUD_VERSION,
          actor: state.actor?.name ?? null,
          actorId: state.actor?.id ?? null,
          controlledTokens: controlledRelevantTokens().map(token => ({ id: token.id, actor: token.actor?.name ?? null, actorId: token.actor?.id ?? null })),
          activeTab: state.activeTab,
          selectedSpellGroup: state.selectedSpellGroup,
          attackRoll: typeof globalThis.add2eAttackRoll,
          castSpell: typeof globalThis.add2eCastSpell,
          rollCarac: typeof globalThis.add2eRollCharacteristicCard,
          rollSave: typeof globalThis.add2eRollSaveCard,
          featureUse: typeof globalThis.add2eExecuteClassFeatureOnUse,
          hud: !!hud()
        };
      }
    });
    console.log(`${TAG}[INIT]`, ADD2E_ACTION_HUD_VERSION);
  });

  Hooks.once("ready", () => {
    document.addEventListener("pointerdown", api.pointerDown, true);
    document.addEventListener("mousedown", api.pointerDown, true);
    document.addEventListener("touchstart", api.pointerDown, true);
    window.addEventListener("resize", () => api.applyGeometry(hud(), true));
    setTimeout(() => {
      api.bindCanvasControlledTokenClick();
      api.refreshHud("ready", { allowCharacterFallback: true, closeWhenEmpty: false });
    }, 300);
  });

  Hooks.on("controlToken", (token, controlled) => {
    api.setManualIntent(500);
    setTimeout(() => {
      api.bindCanvasControlledTokenClick();
      if (controlled && token?.actor && relevant(token.actor)) return api.renderHud(token.actor, token, { reason: "controlToken-selected" });
      return api.refreshHud("controlToken", { allowCharacterFallback: true, closeWhenEmpty: true });
    }, 60);
  });

  Hooks.on("canvasReady", () => setTimeout(() => {
    api.bindCanvasControlledTokenClick();
    api.refreshHud("canvasReady", { allowCharacterFallback: true, closeWhenEmpty: false });
  }, 150));

  Hooks.on("add2eInitiativeTurnChanged", combat => setTimeout(() => api.followCombat(combat, false), 40));

  Hooks.on("updateActor", actor => {
    const state = api.getRuntimeState();
    if (actor?.id === state.actor?.id && !state.dragging && !state.resizing) setTimeout(() => api.renderHud(actor, state.token, { reason: "updateActor" }), 80);
  });

  for (const hookName of ["createItem", "updateItem", "deleteItem", "createActiveEffect", "updateActiveEffect", "deleteActiveEffect"]) {
    Hooks.on(hookName, document => {
      const state = api.getRuntimeState();
      const actor = document?.parent;
      if (actor?.id === state.actor?.id && !state.dragging && !state.resizing) setTimeout(() => api.renderHud(actor, state.token, { reason: hookName }), 80);
    });
  }
  return true;
}
