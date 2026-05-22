// ADD2E — Déplacement libre et repli du HUD d'action
// Version : 2026-05-22-v3-free-drag-stable-menu-collapse
//
// Complète add2e-action-hud.mjs sans le réécrire.
// - force la position sauvegardée après chaque rendu du HUD ;
// - remplace le drag interne par un seul drag stable capturé ici ;
// - clic sur l'onglet déjà actif : masque seulement le panneau de menu ;
// - clic sur la flèche : même repli visuel que l'onglet actif, avec onglets + en-tête visibles.

const ADD2E_ACTION_HUD_FREE_DRAG_VERSION = "2026-05-22-v3-free-drag-stable-menu-collapse";
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
      user-select: none;
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
    #${ADD2E_HUD_ID} [data-resize-handle],
    #${ADD2E_HUD_ID} [data-action],
    #${ADD2E_HUD_ID} [data-hud-tab] {
      touch-action: auto;
      user-select: auto;
    }

    #${ADD2E_HUD_ID}.a2e-hud-menu-retracted .a2e-hud-menu-panel,
    #${ADD2E_HUD_ID}.collapsed .a2e-hud-menu-panel {
      display: none !important;
    }

    #${ADD2E_HUD_ID}.a2e-hud-menu-retracted .a2e-hud-icon-btn i,
    #${ADD2E_HUD_ID}.collapsed .a2e-hud-icon-btn i {
      transform: rotate(180deg);
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
  return {
    left: add2eHudFreeClamp(left, -width + marginVisible, window.innerWidth - marginVisible),
    top: add2eHudFreeClamp(top, 0, window.innerHeight - marginVisible)
  };
}

function add2eHudFreeForceStoredGeometry(hud) {
  if (!hud || hud.dataset.add2eFreeDragging === "1") return;

  const state = add2eHudFreeReadState();
  const left = Number(state.left);
  const top = Number(state.top);
  const width = Number(state.width);

  if (Number.isFinite(left)) hud.style.setProperty("left", `${left}px`, "important");
  if (Number.isFinite(top)) hud.style.setProperty("top", `${top}px`, "important");
  if (Number.isFinite(width)) hud.style.setProperty("width", `${width}px`, "important");
  hud.style.setProperty("right", "auto", "important");
  hud.style.setProperty("bottom", "auto", "important");
  add2eHudFreeApplyCssVars(hud);
}

function add2eHudFreeApplyCollapseState(hud) {
  if (!hud) return;
  const state = add2eHudFreeReadState();
  hud.classList.toggle("a2e-hud-menu-retracted", state.menuRetracted === true);
}

function add2eHudFreeApplyState(hud) {
  if (!hud) return;
  add2eHudFreeForceStoredGeometry(hud);
  add2eHudFreeApplyCollapseState(hud);
}

function add2eHudFreeToggleMenu(hud) {
  const state = add2eHudFreeReadState();
  const next = state.menuRetracted !== true;
  add2eHudFreeSaveState({ menuRetracted: next, fullCollapsed: false });
  hud.classList.toggle("a2e-hud-menu-retracted", next);
  hud.classList.toggle("collapsed", next);
  add2eHudFreeApplyCssVars(hud);
}

function add2eHudFreeOpenMenu(hud) {
  add2eHudFreeSaveState({ menuRetracted: false, fullCollapsed: false });
  hud.classList.remove("a2e-hud-menu-retracted");
  hud.classList.remove("collapsed");
  add2eHudFreeApplyCssVars(hud);
}

function add2eHudFreeInstallOnHud(hud) {
  if (!hud) return;

  add2eHudFreeApplyState(hud);
  if (hud.dataset.add2eFreeDragInstalled === "1") return;
  hud.dataset.add2eFreeDragInstalled = "1";

  hud.addEventListener("click", ev => {
    const tab = ev.target.closest?.("[data-hud-tab]");
    if (tab) {
      const isActive = tab.classList.contains("active");
      if (isActive) {
        ev.preventDefault();
        ev.stopPropagation();
        ev.stopImmediatePropagation?.();
        add2eHudFreeToggleMenu(hud);
      } else {
        add2eHudFreeOpenMenu(hud);
      }
      return;
    }

    const collapse = ev.target.closest?.('[data-action="toggle-collapse"]');
    if (collapse) {
      ev.preventDefault();
      ev.stopPropagation();
      ev.stopImmediatePropagation?.();
      add2eHudFreeToggleMenu(hud);
    }
  }, true);

  hud.addEventListener("pointerdown", ev => {
    if (ev.button !== 0) return;
    if (add2eHudFreeIsInteractiveTarget(ev.target)) return;

    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation?.();

    hud.dataset.add2eFreeDragging = "1";
    const rect = hud.getBoundingClientRect();
    const start = { x: ev.clientX, y: ev.clientY, left: rect.left, top: rect.top };
    let moved = false;

    const move = e => {
      moved = true;
      const pos = add2eHudFreeConstrainToViewport(hud, start.left + (e.clientX - start.x), start.top + (e.clientY - start.y));
      hud.style.setProperty("left", `${Math.round(pos.left)}px`, "important");
      hud.style.setProperty("top", `${Math.round(pos.top)}px`, "important");
      hud.style.setProperty("right", "auto", "important");
      hud.style.setProperty("bottom", "auto", "important");
      add2eHudFreeApplyCssVars(hud);
    };

    const up = () => {
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", up, true);
      delete hud.dataset.add2eFreeDragging;

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

  const observer = new MutationObserver(() => {
    const hud = document.getElementById(ADD2E_HUD_ID);
    if (hud) add2eHudFreeInstallOnHud(hud);
  });
  observer.observe(document.body, { childList: true, subtree: true });

  window.addEventListener("resize", () => {
    const hud = document.getElementById(ADD2E_HUD_ID);
    if (!hud) return;
    const rect = hud.getBoundingClientRect();
    const pos = add2eHudFreeConstrainToViewport(hud, rect.left, rect.top);
    hud.style.setProperty("left", `${Math.round(pos.left)}px`, "important");
    hud.style.setProperty("top", `${Math.round(pos.top)}px`, "important");
    add2eHudFreeApplyCssVars(hud);
    add2eHudFreeSaveState({ left: Math.round(pos.left), top: Math.round(pos.top), width: Math.round(hud.offsetWidth || 560) });
  });
});

console.log(`${ADD2E_HUD_DRAG_TAG} Module chargé`, ADD2E_ACTION_HUD_FREE_DRAG_VERSION);
