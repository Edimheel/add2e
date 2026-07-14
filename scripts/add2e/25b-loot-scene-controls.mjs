// ============================================================================
// ADD2E — Contrôle de scène pour créer et placer un coffre de butin
// Compatible Foundry V13/V14/V15.
// Réutilise exclusivement l'API publique du moteur de butin 25-loot.mjs.
// ============================================================================

export const ADD2E_LOOT_SCENE_CONTROL_VERSION = "2026-07-14-loot-scene-control-v2";

const CONTROL_NAME = "add2e-loot-chest";
const TOOL_NAME = "add2e-create-loot-chest";
const LOOT_VIEWPORT_STYLE_ID = "add2e-loot-viewport-fix";

function add2eEnsureLootViewportStyles() {
  if (!document?.head || document.getElementById(LOOT_VIEWPORT_STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = LOOT_VIEWPORT_STYLE_ID;
  style.textContent = `
    .add2e-loot-app {
      max-height: calc(100vh - 32px) !important;
    }

    .add2e-loot-app .window-content {
      min-height: 0 !important;
      overflow-x: hidden !important;
      overflow-y: auto !important;
      overscroll-behavior: contain;
    }

    .add2e-loot-app .add2e-loot-shell {
      min-height: 0 !important;
      height: auto !important;
    }

    @media (max-height: 760px) {
      .add2e-loot-app {
        max-height: calc(100vh - 16px) !important;
      }

      .add2e-loot-app .add2e-loot-list {
        max-height: min(330px, 38vh) !important;
      }
    }
  `;
  document.head.appendChild(style);
}

function add2eLootSceneCanUse() {
  return game.user?.isGM === true && canvas?.scene != null;
}

function add2eLootSceneCenter() {
  const stage = canvas?.stage;
  const dimensions = canvas?.dimensions;
  if (stage?.pivot) {
    return {
      x: Math.round(Number(stage.pivot.x) || Number(dimensions?.sceneX) + Number(dimensions?.sceneWidth) / 2 || 0),
      y: Math.round(Number(stage.pivot.y) || Number(dimensions?.sceneY) + Number(dimensions?.sceneHeight) / 2 || 0)
    };
  }
  return {
    x: Math.round(Number(dimensions?.sceneX) + Number(dimensions?.sceneWidth) / 2 || 0),
    y: Math.round(Number(dimensions?.sceneY) + Number(dimensions?.sceneHeight) / 2 || 0)
  };
}

async function add2eCreateAndPlaceLootChest() {
  if (!add2eLootSceneCanUse()) return ui.notifications?.warn?.("Une scène active est nécessaire pour placer un coffre.");

  const lootApi = game.add2e?.loot;
  if (typeof lootApi?.createChest !== "function") {
    return ui.notifications?.error?.("Le moteur de butin ADD2E n'est pas disponible.");
  }

  const actor = await lootApi.createChest({ name: "Coffre", locked: false });
  if (!actor) return;

  const center = add2eLootSceneCenter();
  const gridSize = Math.max(1, Number(canvas?.grid?.size ?? canvas?.dimensions?.size ?? 100));
  const width = Math.max(1, Number(actor.prototypeToken?.width ?? 1));
  const height = Math.max(1, Number(actor.prototypeToken?.height ?? 1));

  const tokenData = actor.getTokenDocument
    ? await actor.getTokenDocument({
        x: Math.round(center.x - (width * gridSize) / 2),
        y: Math.round(center.y - (height * gridSize) / 2)
      })
    : foundry.utils.mergeObject(actor.prototypeToken?.toObject?.() ?? actor.prototypeToken ?? {}, {
        actorId: actor.id,
        actorLink: true,
        x: Math.round(center.x - (width * gridSize) / 2),
        y: Math.round(center.y - (height * gridSize) / 2)
      }, { inplace: false, overwrite: true });

  const data = tokenData?.toObject ? tokenData.toObject() : tokenData;
  const created = await canvas.scene.createEmbeddedDocuments("Token", [data], {
    add2eReason: "loot-chest-place"
  });

  const tokenDocument = created?.[0] ?? null;
  ui.notifications?.info?.("Coffre de butin créé et placé sur la scène.");

  const token = tokenDocument?.object ?? canvas.tokens?.get?.(tokenDocument?.id) ?? null;
  if (token) {
    token.control?.({ releaseOthers: true });
    canvas.animatePan?.({ x: token.center?.x ?? center.x, y: token.center?.y ?? center.y, duration: 250 });
  }

  return { actor, tokenDocument };
}

function add2eAppendSceneControl(controls) {
  if (!game.user?.isGM) return;

  const tool = {
    name: TOOL_NAME,
    title: "Créer et placer un coffre de butin",
    icon: "fas fa-box-open",
    button: true,
    visible: true,
    onChange: (_event, active) => {
      if (active === false) return;
      void add2eCreateAndPlaceLootChest();
    }
  };

  if (Array.isArray(controls)) {
    let control = controls.find(entry => entry?.name === CONTROL_NAME);
    if (!control) {
      control = {
        name: CONTROL_NAME,
        title: "Butin ADD2E",
        icon: "fas fa-treasure-chest",
        layer: "tokens",
        visible: true,
        tools: []
      };
      controls.push(control);
    }
    control.tools ??= [];
    if (!control.tools.some(entry => entry?.name === TOOL_NAME)) control.tools.push(tool);
    return;
  }

  if (controls instanceof Map) {
    const control = controls.get(CONTROL_NAME) ?? {
      name: CONTROL_NAME,
      title: "Butin ADD2E",
      icon: "fas fa-box",
      layer: "tokens",
      visible: true,
      tools: new Map()
    };
    if (control.tools instanceof Map) control.tools.set(TOOL_NAME, tool);
    else {
      control.tools ??= [];
      if (!control.tools.some(entry => entry?.name === TOOL_NAME)) control.tools.push(tool);
    }
    controls.set(CONTROL_NAME, control);
    return;
  }

  if (controls && typeof controls === "object") {
    controls[CONTROL_NAME] ??= {
      name: CONTROL_NAME,
      title: "Butin ADD2E",
      icon: "fas fa-box",
      layer: "tokens",
      visible: true,
      tools: {}
    };
    const control = controls[CONTROL_NAME];
    if (Array.isArray(control.tools)) {
      if (!control.tools.some(entry => entry?.name === TOOL_NAME)) control.tools.push(tool);
    } else {
      control.tools ??= {};
      control.tools[TOOL_NAME] = tool;
    }
  }
}

Hooks.once("init", add2eEnsureLootViewportStyles);
Hooks.on("getSceneControlButtons", add2eAppendSceneControl);

Hooks.once("ready", () => {
  add2eEnsureLootViewportStyles();
  game.add2e ??= {};
  game.add2e.lootSceneControls = {
    version: ADD2E_LOOT_SCENE_CONTROL_VERSION,
    createAndPlace: add2eCreateAndPlaceLootChest
  };
  globalThis.ADD2E_LOOT_SCENE_CONTROL_VERSION = ADD2E_LOOT_SCENE_CONTROL_VERSION;
});
