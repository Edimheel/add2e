// ADD2E — Correctif HUD : déplacement libre + repli fiable
// Version : 2026-05-22-v7-no-apply-log-loop
//
// Ce module complète add2e-action-hud.mjs.
// Le repli est capturé sur pointerdown, avant les handlers click internes du HUD.
// La position sauvegardée reste la référence : un redimensionnement de fenêtre ne la réécrit plus.
// Les applications d'état automatiques sont silencieuses pour éviter les boucles de logs.

const ADD2E_ACTION_HUD_FREE_DRAG_VERSION = "2026-05-22-v7-no-apply-log-loop";
const ADD2E_HUD_ID = "add2e-action-hud";
const ADD2E_HUD_STORAGE_KEY = "add2e.actionHud.state.v8";
const ADD2E_HUD_TAG = "[ADD2E][ACTION_HUD][FIX]";

globalThis.ADD2E_ACTION_HUD_FREE_DRAG_VERSION = ADD2E_ACTION_HUD_FREE_DRAG_VERSION;

let add2eHudSuppressClickUntil = 0;
let add2eHudDragging = false;
let add2eHudLastResizeLog = 0;
let add2eHudApplyScheduled = false;

function add2eHudFixReadState() {
  try {
    const raw = JSON.parse(localStorage.getItem(ADD2E_HUD_STORAGE_KEY) || "null");
    if (raw && typeof raw === "object") return raw;
  } catch (_err) {}
  return {};
}

function add2eHudFixSaveState(partial) {
  try {
    const current = add2eHudFixReadState();
    localStorage.setItem(ADD2E_HUD_STORAGE_KEY, JSON.stringify({ ...current, ...partial }));
  } catch (_err) {}
}

function add2eHudFixClamp(n, min, max) {
  n = Number(n);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function add2eHudFixHud() {
  return document.getElementById(ADD2E_HUD_ID);
}

function add2eHudFixPanel(hud) {
  return hud?.querySelector?.(".a2e-hud-menu-panel") ?? null;
}

function add2eHudFixInjectStyle() {
  if (document.getElementById("add2e-action-hud-fix-style")) return;
  const style = document.createElement("style");
  style.id = "add2e-action-hud-fix-style";
  style.textContent = `
    #${ADD2E_HUD_ID} { right:auto !important; bottom:auto !important; touch-action:none; user-select:none; }
    #${ADD2E_HUD_ID}.collapsed .a2e-hud-menu-panel,
    #${ADD2E_HUD_ID}.a2e-hud-menu-retracted .a2e-hud-menu-panel { display:none !important; }
    #${ADD2E_HUD_ID}.collapsed .a2e-hud-icon-btn i,
    #${ADD2E_HUD_ID}.a2e-hud-menu-retracted .a2e-hud-icon-btn i { transform:rotate(180deg); }
    #${ADD2E_HUD_ID} .a2e-hud-shell,
    #${ADD2E_HUD_ID} .a2e-hud-header { cursor:move; }
    #${ADD2E_HUD_ID} button,
    #${ADD2E_HUD_ID} [data-hud-tab],
    #${ADD2E_HUD_ID} [data-action],
    #${ADD2E_HUD_ID} [data-resize-handle] { user-select:auto; touch-action:auto; }
    @media (max-width:760px) {
      #${ADD2E_HUD_ID} { right:auto !important; width:var(--add2e-hud-free-width, 560px) !important; min-width:280px !important; max-width:calc(100vw - 16px) !important; }
    }
  `;
  document.head.appendChild(style);
}

function add2eHudFixSetRetracted(hud, retracted, reason = "manual", { save = true, log = true } = {}) {
  if (!hud) return;
  const panel = add2eHudFixPanel(hud);
  const wasRetracted = hud.classList.contains("collapsed") || hud.classList.contains("a2e-hud-menu-retracted");
  const panelHadInlineNone = panel?.style?.display === "none";

  hud.classList.toggle("collapsed", retracted);
  hud.classList.toggle("a2e-hud-menu-retracted", retracted);

  if (panel) {
    if (retracted) panel.style.setProperty("display", "none", "important");
    else panel.style.removeProperty("display");
  }

  if (save) add2eHudFixSaveState({ menuRetracted: retracted, hudCollapsed: retracted });

  const changed = wasRetracted !== retracted || Boolean(panelHadInlineNone) !== Boolean(retracted);
  if (log && changed) {
    console.log(`${ADD2E_HUD_TAG}[COLLAPSE]`, { retracted, reason, panelDisplay: panel ? getComputedStyle(panel).display : null });
  }
}

function add2eHudFixToggleRetracted(hud, reason) {
  const state = add2eHudFixReadState();
  const currentlyRetracted = hud?.classList?.contains("collapsed") || hud?.classList?.contains("a2e-hud-menu-retracted") || state.menuRetracted === true || state.hudCollapsed === true;
  add2eHudFixSetRetracted(hud, !currentlyRetracted, reason, { save: true, log: true });
}

function add2eHudFixApplyGeometryFromState(hud, { constrainVisible = false } = {}) {
  if (!hud || add2eHudDragging) return;
  const state = add2eHudFixReadState();
  let left = Number(state.left);
  let top = Number(state.top);
  const width = Number(state.width);

  if (!Number.isFinite(left)) left = hud.getBoundingClientRect().left;
  if (!Number.isFinite(top)) top = hud.getBoundingClientRect().top;

  if (constrainVisible) {
    const visible = 42;
    left = add2eHudFixClamp(left, -hud.offsetWidth + visible, window.innerWidth - visible);
    top = add2eHudFixClamp(top, 0, window.innerHeight - visible);
  }

  if (Number.isFinite(left)) hud.style.setProperty("left", `${Math.round(left)}px`, "important");
  if (Number.isFinite(top)) hud.style.setProperty("top", `${Math.round(top)}px`, "important");
  if (Number.isFinite(width)) hud.style.setProperty("width", `${Math.round(width)}px`, "important");
  hud.style.setProperty("right", "auto", "important");
  hud.style.setProperty("bottom", "auto", "important");
  hud.style.setProperty("--add2e-hud-free-width", hud.style.width || `${hud.offsetWidth || 560}px`);
}

function add2eHudFixApplyState(hud) {
  if (!hud || add2eHudDragging) return;
  const state = add2eHudFixReadState();
  add2eHudFixApplyGeometryFromState(hud);
  add2eHudFixSetRetracted(hud, state.menuRetracted === true || state.hudCollapsed === true, "apply-state", { save: false, log: false });
}

function add2eHudFixPrevent(ev) {
  ev.preventDefault();
  ev.stopPropagation();
  ev.stopImmediatePropagation?.();
  add2eHudSuppressClickUntil = Date.now() + 450;
}

function add2eHudFixPointerControls(ev) {
  const hud = ev.target?.closest?.(`#${ADD2E_HUD_ID}`);
  if (!hud || ev.button !== 0) return false;

  const collapseButton = ev.target.closest?.('[data-action="toggle-collapse"]');
  if (collapseButton) {
    add2eHudFixPrevent(ev);
    add2eHudFixToggleRetracted(hud, "collapse-button-pointerdown");
    return true;
  }

  const tab = ev.target.closest?.("[data-hud-tab]");
  if (tab) {
    if (tab.classList.contains("active")) {
      add2eHudFixPrevent(ev);
      add2eHudFixToggleRetracted(hud, "active-tab-pointerdown");
      return true;
    }
    add2eHudFixSetRetracted(hud, false, "switch-tab-pointerdown", { save: true, log: true });
  }
  return false;
}

function add2eHudFixIsDragForbidden(target) {
  return Boolean(target?.closest?.("button,a,input,select,textarea,[data-action],[data-hud-tab],[data-resize-handle]"));
}

function add2eHudFixStartDrag(ev) {
  const hud = ev.target?.closest?.(`#${ADD2E_HUD_ID}`);
  if (!hud || ev.button !== 0) return;
  if (add2eHudFixIsDragForbidden(ev.target)) return;

  add2eHudFixPrevent(ev);
  add2eHudDragging = true;

  const rect = hud.getBoundingClientRect();
  const startX = ev.clientX;
  const startY = ev.clientY;
  const startLeft = rect.left;
  const startTop = rect.top;
  let moved = false;

  const move = e => {
    moved = true;
    const visible = 42;
    const nextLeft = add2eHudFixClamp(startLeft + e.clientX - startX, -hud.offsetWidth + visible, window.innerWidth - visible);
    const nextTop = add2eHudFixClamp(startTop + e.clientY - startY, 0, window.innerHeight - visible);
    hud.style.setProperty("left", `${Math.round(nextLeft)}px`, "important");
    hud.style.setProperty("top", `${Math.round(nextTop)}px`, "important");
    hud.style.setProperty("right", "auto", "important");
    hud.style.setProperty("bottom", "auto", "important");
  };

  const up = () => {
    window.removeEventListener("pointermove", move, true);
    window.removeEventListener("pointerup", up, true);
    add2eHudDragging = false;
    if (moved) {
      const r = hud.getBoundingClientRect();
      add2eHudFixSaveState({ left: Math.round(r.left), top: Math.round(r.top), width: Math.round(hud.offsetWidth || r.width || 560) });
      console.log(`${ADD2E_HUD_TAG}[DRAG_SAVE]`, { left: Math.round(r.left), top: Math.round(r.top), width: Math.round(hud.offsetWidth || r.width || 560) });
    }
  };

  window.addEventListener("pointermove", move, true);
  window.addEventListener("pointerup", up, true);
}

function add2eHudFixPointerDown(ev) {
  if (add2eHudFixPointerControls(ev)) return;
  add2eHudFixStartDrag(ev);
}

function add2eHudFixClick(ev) {
  if (Date.now() < add2eHudSuppressClickUntil && ev.target?.closest?.(`#${ADD2E_HUD_ID}`)) add2eHudFixPrevent(ev);
}

function add2eHudFixInstall() {
  add2eHudFixInjectStyle();
  const hud = add2eHudFixHud();
  if (hud) add2eHudFixApplyState(hud);
}

function add2eHudFixScheduleInstall() {
  if (add2eHudApplyScheduled) return;
  add2eHudApplyScheduled = true;
  requestAnimationFrame(() => {
    add2eHudApplyScheduled = false;
    add2eHudFixInstall();
  });
}

function add2eHudFixOnResize() {
  const hud = add2eHudFixHud();
  if (!hud || add2eHudDragging) return;
  add2eHudFixApplyGeometryFromState(hud, { constrainVisible: true });

  const now = Date.now();
  if (now - add2eHudLastResizeLog > 500) {
    add2eHudLastResizeLog = now;
    const r = hud.getBoundingClientRect();
    console.log(`${ADD2E_HUD_TAG}[WINDOW_RESIZE_KEEP_POSITION]`, { visualLeft: Math.round(r.left), visualTop: Math.round(r.top), stored: add2eHudFixReadState() });
  }
}

function add2eHudFixDebug() {
  const hud = add2eHudFixHud();
  const panel = add2eHudFixPanel(hud);
  const rect = hud?.getBoundingClientRect?.();
  return {
    version: ADD2E_ACTION_HUD_FREE_DRAG_VERSION,
    hud: Boolean(hud),
    classes: hud ? [...hud.classList] : [],
    state: add2eHudFixReadState(),
    rect: rect ? { left: Math.round(rect.left), top: Math.round(rect.top), width: Math.round(rect.width), height: Math.round(rect.height) } : null,
    panelInlineDisplay: panel?.style?.display ?? null,
    panelComputedDisplay: panel ? getComputedStyle(panel).display : null,
    activeTab: hud?.querySelector?.("[data-hud-tab].active")?.dataset?.hudTab ?? null
  };
}

globalThis.add2eHudFixDebug = add2eHudFixDebug;
globalThis.add2eHudForceRetract = () => add2eHudFixSetRetracted(add2eHudFixHud(), true, "console-force", { save: true, log: true });
globalThis.add2eHudForceOpen = () => add2eHudFixSetRetracted(add2eHudFixHud(), false, "console-force", { save: true, log: true });

document.addEventListener("pointerdown", add2eHudFixPointerDown, true);
document.addEventListener("click", add2eHudFixClick, true);

Hooks.once("ready", () => {
  add2eHudFixInstall();
  const observer = new MutationObserver(() => add2eHudFixScheduleInstall());
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener("resize", add2eHudFixOnResize);
});

console.log(`${ADD2E_HUD_TAG} Module chargé`, ADD2E_ACTION_HUD_FREE_DRAG_VERSION);
