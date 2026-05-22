// ADD2E — Déplacement libre du HUD d'action
// Version : 2026-05-22-v1-free-drag-anywhere
//
// Ce module complète add2e-action-hud.mjs sans le réécrire.
// Il permet de déplacer le HUD librement dans la fenêtre Foundry et neutralise
// les règles CSS qui forçaient sa position sur petits écrans.

const ADD2E_ACTION_HUD_FREE_DRAG_VERSION = "2026-05-22-v1-free-drag-anywhere";
const ADD2E_HUD_ID = "add2e-action-hud";
const ADD2E_HUD_STORAGE_KEY = "add2e.actionHud.state.v8";
const ADD2E_HUD_DRAG_TAG = "[ADD2E][ACTION_HUD][FREE_DRAG]";

globalThis.ADD2E_ACTION_HUD_FREE_DRAG_VERSION = ADD2E_ACTION_HUD_FREE_DRAG_VERSION;

function add2eHudFreeClamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function add2eHudFreeReadState() {
  try {
    const raw = JSON.parse(localStorage.getItem(ADD2E_HUD_STORAGE_KEY) || "null");
    if (raw && typeof raw === "object") return raw;
  } catch (_err) {}
  return {};
}

function add2eHudFreeSaveState(partial) {
  try {
    const current = add2eHudFreeReadState();
    localStorage.setItem(ADD2E_HUD_STORAGE_KEY, JSON.stringify({ ...current, ...partial }));
  } catch (_err) {}
}

function add2eHudFreeInjectStyle() {
  if (document.getElementById("add2e-action-hud-free-drag-style")) return;
  const style = document.createElement("style");
  style.id = "add2e-action-hud-free-drag-style";
  style.textContent = `
    #${ADD2E_HUD_ID} {
      right: auto !important;
      bottom: auto !important;
      touch-action: none;
    }

    #${ADD2E_HUD_ID} .a2e-hud-shell,
    #${ADD2E_HUD_ID} .a2e-hud-header {
      cursor: move;
    }

    #${ADD2E_HUD_ID} button,
    #${ADD2E_HUD_ID} input,
    #${ADD2E_HUD_ID} select,
    #${ADD2E_HUD_ID} textarea,
    #${ADD2E_HUD_ID} a,
    #${ADD2E_HUD_ID} [data-resize-handle] {
      cursor: auto;
      touch-action: auto;
    }

    @media (max-width: 760px) {
      #${ADD2E_HUD_ID} {
        left: var(--add2e-hud-free-left, 8px) !important;
        top: var(--add2e-hud-free-top, 120px) !important;
        right: auto !important;
        width: var(--add2e-hud-free-width, 560px) !important;
        min-width: 280px !important;
        max-width: calc(100vw - 16px) !important;
      }
    }
  `;
  document.head.appendChild(style);
}

function add2eHudFreeIsInteractiveTarget(target) {
  return Boolean(target?.closest?.("button,input,select,textarea,a,[data-resize-handle],[data-action],[data-hud-tab]"));
}

function add2eHudFreeApplyCssVars(hud) {
  if (!hud) return;
  hud.style.setProperty("--add2e-hud-free-left", hud.style.left || `${hud.offsetLeft || 8}px`);
  hud.style.setProperty("--add2e-hud-free-top", hud.style.top || `${hud.offsetTop || 120}px`);
  hud.style.setProperty("--add2e-hud-free-width", hud.style.width || `${hud.offsetWidth || 560}px`);
}

function add2eHudFreeConstrainToViewport(hud, left, top) {
  const marginVisible = 36;
  const width = Number(hud?.offsetWidth || 360);
  const height = Number(hud?.offsetHeight || 120);

  return {
    left: add2eHudFreeClamp(left, -width + marginVisible, window.innerWidth - marginVisible),
    top: add2eHudFreeClamp(top, 0, window.innerHeight - marginVisible)
  };
}

function add2eHudFreeInstallOnHud(hud) {
  if (!hud || hud.dataset.add2eFreeDragInstalled === "1") return;
  hud.dataset.add2eFreeDragInstalled = "1";

  add2eHudFreeApplyCssVars(hud);

  hud.addEventListener("pointerdown", ev => {
    if (ev.button !== 0) return;
    if (add2eHudFreeIsInteractiveTarget(ev.target)) return;

    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation?.();

    const rect = hud.getBoundingClientRect();
    const start = {
      x: ev.clientX,
      y: ev.clientY,
      left: rect.left,
      top: rect.top
    };

    let moved = false;

    const move = e => {
      moved = true;
      const pos = add2eHudFreeConstrainToViewport(
        hud,
        start.left + (e.clientX - start.x),
        start.top + (e.clientY - start.y)
      );

      hud.style.left = `${Math.round(pos.left)}px`;
      hud.style.top = `${Math.round(pos.top)}px`;
      hud.style.right = "auto";
      hud.style.bottom = "auto";
      add2eHudFreeApplyCssVars(hud);
    };

    const up = () => {
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", up, true);

      if (moved) {
        const rectAfter = hud.getBoundingClientRect();
        add2eHudFreeSaveState({
          left: Math.round(rectAfter.left),
          top: Math.round(rectAfter.top),
          width: Math.round(hud.offsetWidth || rectAfter.width || 560)
        });
      }
    };

    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerup", up, true);
  }, true);
}

function add2eHudFreeInstall() {
  add2eHudFreeInjectStyle();
  const hud = document.getElementById(ADD2E_HUD_ID);
  if (hud) add2eHudFreeInstallOnHud(hud);
}

Hooks.once("ready", () => {
  add2eHudFreeInstall();

  const observer = new MutationObserver(() => add2eHudFreeInstall());
  observer.observe(document.body, { childList: true, subtree: true });

  window.addEventListener("resize", () => {
    const hud = document.getElementById(ADD2E_HUD_ID);
    if (!hud) return;
    const rect = hud.getBoundingClientRect();
    const pos = add2eHudFreeConstrainToViewport(hud, rect.left, rect.top);
    hud.style.left = `${Math.round(pos.left)}px`;
    hud.style.top = `${Math.round(pos.top)}px`;
    add2eHudFreeApplyCssVars(hud);
    add2eHudFreeSaveState({ left: Math.round(pos.left), top: Math.round(pos.top), width: Math.round(hud.offsetWidth || 560) });
  });
});

console.log(`${ADD2E_HUD_DRAG_TAG} Module chargé`, ADD2E_ACTION_HUD_FREE_DRAG_VERSION);
