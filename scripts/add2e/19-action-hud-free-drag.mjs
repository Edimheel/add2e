// ADD2E — Correctif HUD : déplacement libre + repli fiable
// Version : 2026-05-24-v11-combatant-priority-bottom-anchor
//
// Ce module complète add2e-action-hud.mjs.
// Le repli est capturé sur pointerdown, avant les handlers click internes du HUD.
// La position sauvegardée reste la référence : un redimensionnement de fenêtre ne la réécrit plus.
// Les applications d'état automatiques sont silencieuses pour éviter les boucles de logs.
// Le HUD ne peut plus sortir de l'écran.
// Lors du repli/ouverture, le bas du HUD reste ancré : le panneau se replie vers le haut.
// Le redimensionnement manuel est capturé ici pour éviter les sauts provoqués par les handlers concurrents.
// En combat, le HUD suit toujours le combattant actif et non le token sélectionné.

const ADD2E_ACTION_HUD_FREE_DRAG_VERSION = "2026-05-24-v11-combatant-priority-bottom-anchor";
const ADD2E_HUD_ID = "add2e-action-hud";
const ADD2E_HUD_STORAGE_KEY = "add2e.actionHud.state.v8";
const ADD2E_HUD_TAG = "[ADD2E][ACTION_HUD][FIX]";

globalThis.ADD2E_ACTION_HUD_FREE_DRAG_VERSION = ADD2E_ACTION_HUD_FREE_DRAG_VERSION;

let add2eHudSuppressClickUntil = 0;
let add2eHudDragging = false;
let add2eHudResizing = false;
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
  if (max < min) return min;
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
    #${ADD2E_HUD_ID} [data-action] { user-select:auto; touch-action:auto; }
    #${ADD2E_HUD_ID} [data-resize-handle] { cursor:nwse-resize !important; user-select:none; touch-action:none; }
    @media (max-width:760px) {
      #${ADD2E_HUD_ID} { right:auto !important; width:var(--add2e-hud-free-width, 560px) !important; min-width:280px !important; max-width:calc(100vw - 16px) !important; }
    }
  `;
  document.head.appendChild(style);
}

function add2eHudFixInsidePosition(hud, left, top) {
  const margin = 8;
  const width = Math.max(1, Number(hud?.offsetWidth || hud?.getBoundingClientRect?.().width || 360));
  const height = Math.max(1, Number(hud?.offsetHeight || hud?.getBoundingClientRect?.().height || 80));

  const maxLeft = Math.max(margin, window.innerWidth - width - margin);
  const maxTop = Math.max(margin, window.innerHeight - height - margin);

  return {
    left: add2eHudFixClamp(left, margin, maxLeft),
    top: add2eHudFixClamp(top, margin, maxTop)
  };
}

function add2eHudFixApplyPosition(hud, left, top) {
  hud.style.setProperty("left", `${Math.round(left)}px`, "important");
  hud.style.setProperty("top", `${Math.round(top)}px`, "important");
  hud.style.setProperty("right", "auto", "important");
  hud.style.setProperty("bottom", "auto", "important");
}

function add2eHudFixKeepInside(hud, { save = true, reason = "keep-inside", log = true } = {}) {
  if (!hud || add2eHudDragging || add2eHudResizing) return false;

  const rect = hud.getBoundingClientRect();
  const pos = add2eHudFixInsidePosition(hud, rect.left, rect.top);
  const changed = Math.round(pos.left) !== Math.round(rect.left) || Math.round(pos.top) !== Math.round(rect.top);
  if (!changed) return false;

  add2eHudFixApplyPosition(hud, pos.left, pos.top);
  if (save) add2eHudFixSaveState({ left: Math.round(pos.left), top: Math.round(pos.top), width: Math.round(hud.offsetWidth || rect.width || 560) });
  if (log) console.log(`${ADD2E_HUD_TAG}[KEEP_INSIDE]`, { reason, left: Math.round(pos.left), top: Math.round(pos.top) });
  return true;
}

function add2eHudFixPreserveBottom(hud, wantedBottom, { save = true, reason = "bottom-anchor", log = true } = {}) {
  if (!hud || add2eHudDragging || add2eHudResizing) return false;

  const margin = 8;
  const rect = hud.getBoundingClientRect();
  const bottom = add2eHudFixClamp(Number(wantedBottom), margin + rect.height, window.innerHeight - margin);
  const desiredTop = bottom - rect.height;
  const pos = add2eHudFixInsidePosition(hud, rect.left, desiredTop);

  const changed = Math.round(pos.left) !== Math.round(rect.left) || Math.round(pos.top) !== Math.round(rect.top);
  if (!changed) return false;

  add2eHudFixApplyPosition(hud, pos.left, pos.top);
  if (save) add2eHudFixSaveState({ left: Math.round(pos.left), top: Math.round(pos.top), width: Math.round(hud.offsetWidth || rect.width || 560) });
  if (log) console.log(`${ADD2E_HUD_TAG}[BOTTOM_ANCHOR]`, { reason, bottom: Math.round(bottom), left: Math.round(pos.left), top: Math.round(pos.top) });
  return true;
}

function add2eHudFixSetRetracted(hud, retracted, reason = "manual", { save = true, log = true } = {}) {
  if (!hud) return;
  const panel = add2eHudFixPanel(hud);
  const beforeBottom = hud.getBoundingClientRect().bottom;
  const wasRetracted = hud.classList.contains("collapsed") || hud.classList.contains("a2e-hud-menu-retracted");
  const panelHadInlineNone = panel?.style?.display === "none";

  hud.classList.toggle("collapsed", retracted);
  hud.classList.toggle("a2e-hud-menu-retracted", retracted);

  if (panel) {
    if (retracted) panel.style.setProperty("display", "none", "important");
    else panel.style.removeProperty("display");
  }

  add2eHudFixPreserveBottom(hud, beforeBottom, { save, reason: `${reason}:${retracted ? "retracted" : "open"}`, log });
  add2eHudFixKeepInside(hud, { save, reason: `${reason}:inside`, log: false });

  if (save) {
    const r = hud.getBoundingClientRect();
    add2eHudFixSaveState({
      menuRetracted: retracted,
      hudCollapsed: retracted,
      left: Math.round(r.left),
      top: Math.round(r.top),
      width: Math.round(hud.offsetWidth || r.width || 560)
    });
  }

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
  if (!hud || add2eHudDragging || add2eHudResizing) return;
  const state = add2eHudFixReadState();
  let left = Number(state.left);
  let top = Number(state.top);
  const width = Number(state.width);
  const maxMenuHeight = Number(state.maxMenuHeight);

  if (!Number.isFinite(left)) left = hud.getBoundingClientRect().left;
  if (!Number.isFinite(top)) top = hud.getBoundingClientRect().top;

  if (Number.isFinite(width)) hud.style.setProperty("width", `${Math.round(width)}px`, "important");
  if (Number.isFinite(maxMenuHeight)) hud.style.setProperty("--a2e-hud-menu-max", `${Math.round(maxMenuHeight)}px`);
  hud.style.setProperty("--add2e-hud-free-width", hud.style.width || `${hud.offsetWidth || 560}px`);

  const pos = constrainVisible ? add2eHudFixInsidePosition(hud, left, top) : { left, top };
  if (Number.isFinite(pos.left) && Number.isFinite(pos.top)) add2eHudFixApplyPosition(hud, pos.left, pos.top);
}

function add2eHudFixApplyState(hud) {
  if (!hud || add2eHudDragging || add2eHudResizing) return;
  const state = add2eHudFixReadState();
  add2eHudFixApplyGeometryFromState(hud, { constrainVisible: true });
  add2eHudFixSetRetracted(hud, state.menuRetracted === true || state.hudCollapsed === true, "apply-state", { save: false, log: false });
}

function add2eHudFixPrevent(ev) {
  ev.preventDefault();
  ev.stopPropagation();
  ev.stopImmediatePropagation?.();
  add2eHudSuppressClickUntil = Date.now() + 450;
}

function add2eHudFixStartResize(ev) {
  const handle = ev.target?.closest?.("[data-resize-handle]");
  const hud = ev.target?.closest?.(`#${ADD2E_HUD_ID}`);
  if (!handle || !hud || ev.button !== 0) return false;

  add2eHudFixPrevent(ev);
  add2eHudResizing = true;

  const state = add2eHudFixReadState();
  const rect = hud.getBoundingClientRect();
  const panel = add2eHudFixPanel(hud);
  const startX = ev.clientX;
  const startY = ev.clientY;
  const startWidth = rect.width;
  const startMaxMenuHeight = Number(state.maxMenuHeight) || Number(panel?.offsetHeight) || 320;
  const fixedLeft = rect.left;
  const fixedTop = rect.top;

  add2eHudFixApplyPosition(hud, fixedLeft, fixedTop);

  let moved = false;
  let nextWidth = startWidth;
  let nextMaxMenuHeight = startMaxMenuHeight;

  const move = e => {
    moved = true;
    const margin = 8;
    const maxWidth = Math.max(360, window.innerWidth - Math.max(margin, fixedLeft) - margin);
    nextWidth = add2eHudFixClamp(startWidth + (e.clientX - startX), 360, maxWidth);
    nextMaxMenuHeight = add2eHudFixClamp(startMaxMenuHeight + (e.clientY - startY), 110, Math.max(140, window.innerHeight - fixedTop - margin));

    hud.style.setProperty("width", `${Math.round(nextWidth)}px`, "important");
    hud.style.setProperty("--a2e-hud-menu-max", `${Math.round(nextMaxMenuHeight)}px`);
    hud.style.setProperty("--add2e-hud-free-width", `${Math.round(nextWidth)}px`);
    add2eHudFixApplyPosition(hud, fixedLeft, fixedTop);
  };

  const up = () => {
    window.removeEventListener("pointermove", move, true);
    window.removeEventListener("pointerup", up, true);
    add2eHudResizing = false;

    if (moved) {
      add2eHudFixKeepInside(hud, { save: false, reason: "resize-end", log: false });
      const r = hud.getBoundingClientRect();
      add2eHudFixSaveState({
        left: Math.round(r.left),
        top: Math.round(r.top),
        width: Math.round(hud.offsetWidth || r.width || nextWidth),
        maxMenuHeight: Math.round(nextMaxMenuHeight)
      });
      console.log(`${ADD2E_HUD_TAG}[RESIZE_SAVE]`, {
        left: Math.round(r.left),
        top: Math.round(r.top),
        width: Math.round(hud.offsetWidth || r.width || nextWidth),
        maxMenuHeight: Math.round(nextMaxMenuHeight)
      });
    }
  };

  window.addEventListener("pointermove", move, true);
  window.addEventListener("pointerup", up, true);
  return true;
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
    const pos = add2eHudFixInsidePosition(hud, startLeft + e.clientX - startX, startTop + e.clientY - startY);
    add2eHudFixApplyPosition(hud, pos.left, pos.top);
  };

  const up = () => {
    window.removeEventListener("pointermove", move, true);
    window.removeEventListener("pointerup", up, true);
    add2eHudDragging = false;
    if (moved) {
      add2eHudFixKeepInside(hud, { save: false, reason: "drag-end", log: false });
      const r = hud.getBoundingClientRect();
      add2eHudFixSaveState({ left: Math.round(r.left), top: Math.round(r.top), width: Math.round(hud.offsetWidth || r.width || 560) });
      console.log(`${ADD2E_HUD_TAG}[DRAG_SAVE]`, { left: Math.round(r.left), top: Math.round(r.top), width: Math.round(hud.offsetWidth || r.width || 560) });
    }
  };

  window.addEventListener("pointermove", move, true);
  window.addEventListener("pointerup", up, true);
}

function add2eHudFixPointerDown(ev) {
  if (add2eHudFixStartResize(ev)) return;
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
  if (add2eHudApplyScheduled || add2eHudDragging || add2eHudResizing) return;
  add2eHudApplyScheduled = true;
  requestAnimationFrame(() => {
    add2eHudApplyScheduled = false;
    add2eHudFixInstall();
  });
}

function add2eHudFixOnResize() {
  const hud = add2eHudFixHud();
  if (!hud || add2eHudDragging || add2eHudResizing) return;
  add2eHudFixApplyGeometryFromState(hud, { constrainVisible: true });

  const now = Date.now();
  if (now - add2eHudLastResizeLog > 500) {
    add2eHudLastResizeLog = now;
    const r = hud.getBoundingClientRect();
    console.log(`${ADD2E_HUD_TAG}[WINDOW_RESIZE_KEEP_POSITION]`, { visualLeft: Math.round(r.left), visualTop: Math.round(r.top), visualBottom: Math.round(r.bottom), stored: add2eHudFixReadState() });
  }
}

const ADD2E_ACTION_HUD_COMBAT_PRIORITY_VERSION = "2026-05-24-v1-active-combatant-wins";
globalThis.ADD2E_ACTION_HUD_COMBAT_PRIORITY_VERSION = ADD2E_ACTION_HUD_COMBAT_PRIORITY_VERSION;

function add2eHudFixCombatantById(combat, id) {
  if (!combat || !id) return null;
  return combat.combatants?.get?.(id)
    ?? combat.combatants?.find?.(c => c.id === id)
    ?? combat.turns?.find?.(c => c.id === id)
    ?? null;
}

function add2eHudFixCombatantByTurn(combat, turn) {
  const index = Number(turn);
  if (!combat || !Number.isInteger(index) || index < 0) return null;
  return combat.turns?.[index]
    ?? Array.from(combat.combatants ?? [])[index]
    ?? null;
}

function add2eHudFixCurrentCombatant(combat = game.combat) {
  if (!combat) return null;
  const currentId = combat.current?.combatantId ?? combat.combatantId ?? null;
  return add2eHudFixCombatantById(combat, currentId)
    ?? combat.combatant
    ?? add2eHudFixCombatantByTurn(combat, combat.current?.turn ?? combat.turn)
    ?? combat.combatants?.find?.(c => c.active === true)
    ?? null;
}

function add2eHudFixTokenFromCombatant(combatant) {
  if (!combatant) return null;
  try {
    if (combatant.token?.object) return combatant.token.object;
    if (combatant.tokenId && canvas?.tokens?.get) return canvas.tokens.get(combatant.tokenId) ?? null;
    if (combatant.token?.id && canvas?.tokens?.get) return canvas.tokens.get(combatant.token.id) ?? null;
  } catch (_err) {}
  return null;
}

function add2eHudFixCanShowCombatActor(actor) {
  if (!actor) return false;
  const type = String(actor.type ?? "").toLowerCase();
  if (type === "personnage") return game.user?.isGM || actor.isOwner || actor.testUserPermission?.(game.user, "OWNER");
  if (type === "monster") return game.user?.isGM === true;
  return false;
}

function add2eHudFixFollowCurrentCombatant(combat = game.combat, { forceOpen = false, reason = "combat-sync" } = {}) {
  if (!combat) return false;
  const hudExists = Boolean(add2eHudFixHud());
  if (!forceOpen && !hudExists) return false;

  const combatant = add2eHudFixCurrentCombatant(combat);
  const actor = combatant?.actor ?? null;
  if (!add2eHudFixCanShowCombatActor(actor)) {
    if (hudExists && typeof globalThis.add2eCloseActionHud === "function") globalThis.add2eCloseActionHud();
    return false;
  }

  if (typeof globalThis.add2eRenderActionHud !== "function") return false;
  globalThis.add2eRenderActionHud(actor, add2eHudFixTokenFromCombatant(combatant));
  const hud = add2eHudFixHud();
  if (hud) add2eHudFixApplyState(hud);
  console.log(`${ADD2E_HUD_TAG}[COMBATANT_PRIORITY]`, { reason, combatant: combatant?.name, actor: actor?.name });
  return true;
}

function add2eHudFixScheduleCombatFollow(combat = game.combat, options = {}) {
  if (!combat) return;
  for (const delay of [80, 180, 340]) {
    window.setTimeout(() => add2eHudFixFollowCurrentCombatant(combat, options), delay);
  }
}

function add2eHudFixIsCombatTurnChange(changes = {}) {
  return foundry.utils.hasProperty(changes, "turn")
    || foundry.utils.hasProperty(changes, "round")
    || foundry.utils.hasProperty(changes, "current")
    || foundry.utils.hasProperty(changes, "current.turn")
    || foundry.utils.hasProperty(changes, "current.round")
    || foundry.utils.hasProperty(changes, "current.combatantId")
    || foundry.utils.hasProperty(changes, "combatantId");
}

function add2eHudFixDebug() {
  const hud = add2eHudFixHud();
  const panel = add2eHudFixPanel(hud);
  const rect = hud?.getBoundingClientRect?.();
  const combatant = add2eHudFixCurrentCombatant(game.combat);
  return {
    version: ADD2E_ACTION_HUD_FREE_DRAG_VERSION,
    combatPriorityVersion: ADD2E_ACTION_HUD_COMBAT_PRIORITY_VERSION,
    hud: Boolean(hud),
    classes: hud ? [...hud.classList] : [],
    state: add2eHudFixReadState(),
    rect: rect ? { left: Math.round(rect.left), top: Math.round(rect.top), bottom: Math.round(rect.bottom), right: Math.round(rect.right), width: Math.round(rect.width), height: Math.round(rect.height), viewportW: window.innerWidth, viewportH: window.innerHeight } : null,
    panelInlineDisplay: panel?.style?.display ?? null,
    panelComputedDisplay: panel ? getComputedStyle(panel).display : null,
    activeTab: hud?.querySelector?.("[data-hud-tab].active")?.dataset?.hudTab ?? null,
    resizing: add2eHudResizing,
    dragging: add2eHudDragging,
    combatant: combatant ? { id: combatant.id, name: combatant.name, actor: combatant.actor?.name, actorType: combatant.actor?.type } : null
  };
}

globalThis.add2eHudFixDebug = add2eHudFixDebug;
globalThis.add2eHudForceRetract = () => add2eHudFixSetRetracted(add2eHudFixHud(), true, "console-force", { save: true, log: true });
globalThis.add2eHudForceOpen = () => add2eHudFixSetRetracted(add2eHudFixHud(), false, "console-force", { save: true, log: true });
globalThis.add2eHudFollowCurrentCombatant = () => add2eHudFixFollowCurrentCombatant(game.combat, { forceOpen: true, reason: "console-force" });

document.addEventListener("pointerdown", add2eHudFixPointerDown, true);
document.addEventListener("click", add2eHudFixClick, true);

Hooks.on("controlToken", () => {
  if (game.combat) add2eHudFixScheduleCombatFollow(game.combat, { reason: "controlToken-combat-lock" });
});

Hooks.on("updateCombat", (combat, changes) => {
  if (!add2eHudFixIsCombatTurnChange(changes ?? {})) return;
  add2eHudFixScheduleCombatFollow(combat, { forceOpen: true, reason: "updateCombat" });
});

Hooks.on("combatTurn", combat => add2eHudFixScheduleCombatFollow(combat, { forceOpen: true, reason: "combatTurn" }));
Hooks.on("combatRound", combat => add2eHudFixScheduleCombatFollow(combat, { forceOpen: true, reason: "combatRound" }));
Hooks.on("combatStart", combat => add2eHudFixScheduleCombatFollow(combat, { forceOpen: true, reason: "combatStart" }));
Hooks.on("createCombatant", combatant => { if (combatant?.combat === game.combat) add2eHudFixScheduleCombatFollow(game.combat, { forceOpen: true, reason: "createCombatant" }); });
Hooks.on("updateCombatant", combatant => { if (combatant?.combat === game.combat) add2eHudFixScheduleCombatFollow(game.combat, { forceOpen: true, reason: "updateCombatant" }); });
Hooks.on("deleteCombatant", combatant => { if (combatant?.combat === game.combat) add2eHudFixScheduleCombatFollow(game.combat, { forceOpen: true, reason: "deleteCombatant" }); });

Hooks.once("ready", () => {
  add2eHudFixInstall();
  const observer = new MutationObserver(() => add2eHudFixScheduleInstall());
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener("resize", add2eHudFixOnResize);
  game.add2e = game.add2e ?? {};
  game.add2e.actionHudFreeDragVersion = ADD2E_ACTION_HUD_FREE_DRAG_VERSION;
  game.add2e.actionHudCombatPriorityVersion = ADD2E_ACTION_HUD_COMBAT_PRIORITY_VERSION;
  game.add2e.followCurrentCombatantHud = globalThis.add2eHudFollowCurrentCombatant;
  if (game.combat) add2eHudFixScheduleCombatFollow(game.combat, { forceOpen: true, reason: "ready" });
});

console.log(`${ADD2E_HUD_TAG} Module chargé`, ADD2E_ACTION_HUD_FREE_DRAG_VERSION);
