// ============================================================================
// ADD2E — Tracker de combat horizontal
// ApplicationV2 / DialogV2 — Compatible Foundry V13/V14/V15.
// Le document Combat reste l'unique source de vérité.
// ============================================================================

import {
  add2eMultipleAttackHudStatus,
  currentCombatant,
  isInactiveCombatant,
  sortedCombatants
} from "../add2e-initiative-order.mjs";

export const ADD2E_HORIZONTAL_TRACKER_VERSION = "2026-07-14-horizontal-combat-tracker-v4";

const ApplicationV2 = foundry?.applications?.api?.ApplicationV2;
const DialogV2 = foundry?.applications?.api?.DialogV2;
if (!ApplicationV2) throw new Error("[ADD2E][HORIZONTAL_TRACKER] ApplicationV2 introuvable.");

const STYLE_ID = "add2e-horizontal-combat-tracker-style";
const SKIP_STATUS_IDS = new Set([
  "dead", "defeated", "unconscious", "incapacitated", "inactive",
  "mort", "inconscient", "hors-combat", "hors-jeu",
  "paralyzed", "paralysed", "paralyse",
  "petrified", "petrifie",
  "stunned", "etourdi",
  "asleep", "sleeping", "endormi",
  "neutralized", "neutralise"
]);

let trackerApp = null;
let refreshTimer = null;
let layoutTimer = null;
let navigationRunning = false;
let sidebarObserver = null;

function esc(value) {
  if (foundry?.utils?.escapeHTML) return foundry.utils.escapeHTML(String(value ?? ""));
  const node = document.createElement("div");
  node.textContent = String(value ?? "");
  return node.innerHTML;
}

function normalizeStatus(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function effectStatuses(effect) {
  const statuses = new Set();
  for (const status of effect?.statuses ?? []) statuses.add(normalizeStatus(status?.id ?? status));
  for (const value of [
    effect?.statusId,
    effect?.flags?.core?.statusId,
    effect?.flags?.add2e?.statusId,
    effect?.flags?.add2e?.vitalStatus,
    effect?.name
  ]) {
    const normalized = normalizeStatus(value);
    if (normalized) statuses.add(normalized);
  }
  return statuses;
}

function combatantSkipReason(combatant) {
  if (!combatant) return "Combattant introuvable";
  if (isInactiveCombatant(combatant)) return "Incapable d’agir";

  for (const document of [combatant, combatant.token, combatant.actor].filter(Boolean)) {
    if (document?.flags?.add2e?.skipCombatTurn === true) return "Tour neutralisé";
    for (const effect of document?.effects ?? []) {
      if (effect?.disabled || effect?.isSuppressed) continue;
      if (effect?.flags?.add2e?.skipCombatTurn === true) return effect.name || "Tour neutralisé";
      for (const status of effectStatuses(effect)) {
        if (SKIP_STATUS_IDS.has(status)) return effect.name || status;
      }
    }
  }
  return "";
}

function trackerCombat() {
  const combat = game.combat;
  return combat?.combatants?.size ? combat : null;
}

function activeCombatantId(combat) {
  if (!combat?.started) return null;
  return combat?.current?.combatantId ?? combat?.combatant?.id ?? currentCombatant(combat)?.id ?? null;
}

function combatantImage(combatant, hiddenForPlayer = false) {
  if (hiddenForPlayer) return "icons/svg/mystery-man.svg";
  return combatant?.actor?.img
    ?? combatant?.token?.texture?.src
    ?? combatant?.actor?.prototypeToken?.texture?.src
    ?? "icons/svg/mystery-man.svg";
}

function userCanManage(combatant) {
  return game.user?.isGM === true || combatant?.actor?.isOwner === true;
}

function visibleSidebarRect() {
  const selectors = [
    "#sidebar",
    "#ui-right-column",
    "#interface #sidebar",
    ".sidebar-popout"
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (!element) continue;
    const style = getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden") continue;
    const rect = element.getBoundingClientRect();
    if (rect.width > 20 && rect.right > window.innerWidth - 20) return rect;
  }
  return null;
}

function applyTrackerLayout() {
  const element = document.getElementById("add2e-horizontal-combat-tracker");
  if (!element) return;

  const leftMargin = window.innerWidth <= 800 ? 6 : 74;
  const sidebar = visibleSidebarRect();
  const rightEdge = sidebar ? Math.max(leftMargin + 320, sidebar.left - 10) : window.innerWidth - 10;
  const width = Math.max(320, rightEdge - leftMargin);

  element.style.setProperty("left", `${leftMargin}px`, "important");
  element.style.setProperty("right", "auto", "important");
  element.style.setProperty("width", `${width}px`, "important");
  element.style.setProperty("max-width", `${width}px`, "important");
  element.style.setProperty("transform", "none", "important");
}

function scheduleTrackerLayout(delay = 0) {
  clearTimeout(layoutTimer);
  layoutTimer = setTimeout(applyTrackerLayout, Math.max(0, Number(delay) || 0));
}

function ensureLayoutObserver() {
  if (sidebarObserver || !document.body) return;
  sidebarObserver = new MutationObserver(() => scheduleTrackerLayout(20));
  sidebarObserver.observe(document.body, {
    attributes: true,
    childList: true,
    subtree: true,
    attributeFilter: ["class", "style", "data-tab"]
  });
  window.addEventListener("resize", () => scheduleTrackerLayout(20), { passive: true });
}

function ensureStyles() {
  if (!document?.head) return;
  document.getElementById(STYLE_ID)?.remove();

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #add2e-horizontal-combat-tracker {
      position: fixed !important;
      top: 10px !important;
      height: auto !important;
      z-index: 110 !important;
      background: transparent !important;
      border: 0 !important;
      box-shadow: none !important;
      pointer-events: none !important;
    }
    #add2e-horizontal-combat-tracker .window-header { display: none !important; }
    #add2e-horizontal-combat-tracker .window-content {
      padding: 0 !important;
      overflow: visible !important;
      background: transparent !important;
      pointer-events: none !important;
    }
    .add2e-horizontal-tracker-shell {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      padding: 2px 0;
      background: transparent;
      pointer-events: none;
      color: #f1e7c6;
    }
    .add2e-horizontal-controls {
      display: flex;
      flex: 0 0 auto;
      align-items: center;
      gap: 7px;
      pointer-events: auto;
    }
    .add2e-horizontal-round {
      min-width: 98px;
      padding: 8px 10px;
      border: 1px solid rgba(205,170,82,.8);
      border-radius: 9px;
      background: rgba(54,43,23,.82);
      box-shadow: 0 3px 10px rgba(0,0,0,.35);
      text-align: center;
      font-size: 1rem;
      font-weight: 900;
      color: #f0cf72;
      backdrop-filter: blur(3px);
    }
    .add2e-horizontal-round small {
      display: block;
      margin-bottom: 2px;
      font-size: .7rem;
      color: #d8cfb5;
    }
    .add2e-horizontal-control {
      display: inline-grid;
      place-items: center;
      width: 42px;
      height: 42px;
      padding: 0;
      border: 1px solid #9d8038;
      border-radius: 9px;
      background: rgba(67,52,25,.88);
      box-shadow: 0 3px 10px rgba(0,0,0,.35);
      color: #f8e9b1;
      font-size: 1rem;
      cursor: pointer;
      backdrop-filter: blur(3px);
    }
    .add2e-horizontal-control:hover { filter: brightness(1.2); }
    .add2e-horizontal-control:disabled { opacity: .42; cursor: not-allowed; }
    .add2e-horizontal-control.start { width: auto; min-width: 112px; padding: 0 12px; }
    .add2e-horizontal-list {
      display: flex;
      flex: 1 1 auto;
      align-items: flex-end;
      gap: 10px;
      min-width: 0;
      overflow-x: auto;
      overflow-y: visible;
      padding: 10px 8px 12px;
      pointer-events: auto;
      scrollbar-width: thin;
      scrollbar-color: #8b7134 transparent;
    }
    .add2e-horizontal-card {
      position: relative;
      flex: 0 0 110px;
      width: 110px;
      height: 140px;
      overflow: hidden;
      padding: 0;
      border: 2px solid rgba(111,104,88,.95);
      border-radius: 10px;
      background: transparent;
      box-shadow: 0 4px 11px rgba(0,0,0,.52);
      transition: transform .14s ease, filter .14s ease, border-color .14s ease;
    }
    .add2e-horizontal-card.active {
      transform: translateY(-5px) scale(1.07);
      border: 4px solid #d94335;
      box-shadow: 0 0 0 2px rgba(255,210,76,.72), 0 7px 16px rgba(0,0,0,.58);
      z-index: 4;
    }
    .add2e-horizontal-card.inactive { filter: grayscale(.9) brightness(.55); }
    .add2e-horizontal-card.hidden-combatant { filter: saturate(.3); }
    .add2e-horizontal-card img {
      position: absolute;
      inset: 0;
      display: block;
      width: 100%;
      height: 100%;
      margin: 0;
      border: 0;
      border-radius: 0;
      object-fit: cover;
      object-position: center;
      cursor: pointer;
    }
    .add2e-horizontal-card::after {
      content: "";
      position: absolute;
      inset: auto 0 0;
      height: 45%;
      pointer-events: none;
      background: linear-gradient(transparent, rgba(0,0,0,.82));
    }
    .add2e-horizontal-init {
      position: absolute;
      top: 5px;
      right: 5px;
      display: grid;
      place-items: center;
      min-width: 32px;
      height: 32px;
      padding: 0 7px;
      border: 2px solid #e0c45e;
      border-radius: 999px;
      background: rgba(24,26,30,.9);
      color: #fff1b2;
      font-size: .92rem;
      font-weight: 900;
      z-index: 6;
      cursor: pointer;
    }
    .add2e-horizontal-name {
      position: absolute;
      left: 5px;
      right: 5px;
      bottom: 5px;
      z-index: 5;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      text-align: center;
      font-size: .78rem;
      font-weight: 900;
      color: #fff8df;
      text-shadow: 0 1px 3px #000, 0 0 4px #000;
    }
    .add2e-horizontal-state {
      position: absolute;
      left: 6px;
      top: 6px;
      display: grid;
      place-items: center;
      width: 28px;
      height: 28px;
      border: 1px solid #efaaaa;
      border-radius: 999px;
      background: rgba(123,31,31,.94);
      color: #fff;
      z-index: 6;
    }
    .add2e-horizontal-attacks {
      position: absolute;
      left: 5px;
      right: 5px;
      bottom: 25px;
      z-index: 5;
      padding: 3px 4px;
      border-radius: 4px;
      background: rgba(0,0,0,.72);
      font-size: .64rem;
      line-height: 1.08;
      text-align: center;
      color: #fff2b4;
    }
    .add2e-horizontal-menu {
      position: fixed;
      z-index: 300;
      display: grid;
      min-width: 205px;
      padding: 6px;
      border: 1px solid #947a3d;
      border-radius: 8px;
      background: #202328;
      box-shadow: 0 8px 24px rgba(0,0,0,.72);
    }
    .add2e-horizontal-menu button {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 7px 9px;
      border: 0;
      background: transparent;
      color: #eee6cf;
      text-align: left;
      cursor: pointer;
    }
    .add2e-horizontal-menu button:hover { background: #4b4029; }
    .add2e-horizontal-menu button.danger { color: #ffaaa2; }
    @media (max-width: 800px) {
      #add2e-horizontal-combat-tracker { top: 4px !important; }
      .add2e-horizontal-tracker-shell { gap: 6px; }
      .add2e-horizontal-controls { gap: 4px; }
      .add2e-horizontal-round { min-width: 76px; padding: 6px; font-size: .84rem; }
      .add2e-horizontal-control { width: 36px; height: 36px; }
      .add2e-horizontal-control.start { min-width: 92px; padding: 0 8px; }
      .add2e-horizontal-card { flex-basis: 92px; width: 92px; height: 118px; }
    }
  `;
  document.head.appendChild(style);
}

async function confirmAction({ title, content, yes = "Confirmer" }) {
  if (!DialogV2?.confirm) return window.confirm(String(content).replace(/<[^>]+>/g, " "));
  return DialogV2.confirm({
    window: { title },
    content,
    yes: { label: yes, icon: "fas fa-check" },
    no: { label: "Annuler", icon: "fas fa-times" },
    modal: true
  });
}

async function rollCombatants(combat, ids) {
  const allowedIds = ids.filter(id => {
    const combatant = combat?.combatants?.get?.(id);
    return combatant && userCanManage(combatant);
  });
  if (!allowedIds.length) return ui.notifications?.warn?.("Aucune initiative autorisée à lancer.");
  return combat.rollInitiative(allowedIds, {
    updateTurn: false,
    messageOptions: { rollMode: game.settings?.get?.("core", "rollMode") ?? "publicroll" }
  });
}

async function advanceAndSkip(combat, direction = 1) {
  if (!combat?.started || navigationRunning) return;
  navigationRunning = true;
  try {
    const maximum = Math.max(1, combat.combatants?.size ?? 1);
    for (let attempt = 0; attempt < maximum; attempt += 1) {
      if (direction >= 0) await combat.nextTurn();
      else await combat.previousTurn();
      const current = currentCombatant(combat);
      const reason = combatantSkipReason(current);
      if (!reason) return current;
      ui.notifications?.info?.(`${current?.name ?? "Combattant"} est sauté : ${reason}.`);
    }
    ui.notifications?.warn?.("Aucun combattant capable d’agir n’a été trouvé.");
  } finally {
    navigationRunning = false;
  }
}

class Add2eHorizontalCombatTracker extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "add2e-horizontal-combat-tracker",
    classes: ["add2e", "add2e-horizontal-combat-tracker"],
    tag: "section",
    window: { frame: false, positioned: true, minimizable: false, resizable: false },
    position: { width: 1200, height: "auto", top: 8, left: 74 }
  };

  async _prepareContext() {
    const combat = trackerCombat();
    if (!combat) return { visible: false, combatants: [] };

    const started = combat.started === true;
    const activeId = activeCombatantId(combat);
    const combatants = sortedCombatants(combat)
      .filter(combatant => game.user?.isGM || combatant.hidden !== true)
      .map(combatant => {
        const hiddenForPlayer = combatant.hidden === true && !game.user?.isGM;
        const skipReason = combatantSkipReason(combatant);
        return {
          id: combatant.id,
          name: hiddenForPlayer ? "Combattant masqué" : combatant.name,
          image: combatantImage(combatant, hiddenForPlayer),
          initiative: combatant.initiative,
          hasInitiative: combatant.initiative !== null && combatant.initiative !== undefined,
          active: started && combatant.id === activeId,
          inactive: Boolean(skipReason),
          skipReason,
          hidden: combatant.hidden === true,
          canManage: userCanManage(combatant),
          attackStatus: started ? add2eMultipleAttackHudStatus(combatant.actor, combat) : null
        };
      });

    return {
      visible: true,
      started,
      round: started ? Number(combat.round ?? 1) : 0,
      isGM: game.user?.isGM === true,
      combatants
    };
  }

  async _renderHTML(context) {
    const root = document.createElement("section");
    if (!context.visible) return root;

    const cards = context.combatants.map(combatant => `
      <article class="add2e-horizontal-card${combatant.active ? " active" : ""}${combatant.inactive ? " inactive" : ""}${combatant.hidden ? " hidden-combatant" : ""}"
        data-combatant-id="${esc(combatant.id)}" title="${esc(combatant.name)}${combatant.skipReason ? ` — ${esc(combatant.skipReason)}` : ""}">
        <img src="${esc(combatant.image)}" alt="${esc(combatant.name)}" data-action="focus-token">
        <button type="button" class="add2e-horizontal-init" data-action="roll-one" ${combatant.canManage ? "" : "disabled"}
          title="${combatant.hasInitiative ? "Relancer l’initiative" : "Lancer l’initiative au d6"}">
          ${combatant.hasInitiative ? esc(combatant.initiative) : '<i class="fas fa-dice-d6"></i>'}
        </button>
        ${combatant.inactive ? `<span class="add2e-horizontal-state" title="${esc(combatant.skipReason)}"><i class="fas fa-ban"></i></span>` : ""}
        ${combatant.attackStatus ? `<div class="add2e-horizontal-attacks ${esc(combatant.attackStatus.css)}">${esc(combatant.attackStatus.detail)}</div>` : ""}
        <div class="add2e-horizontal-name">${esc(combatant.name)}</div>
      </article>`).join("");

    root.innerHTML = `
      <div class="add2e-horizontal-tracker-shell">
        <div class="add2e-horizontal-controls">
          <div class="add2e-horizontal-round"><small>${context.started ? "COMBAT" : "PRÉPARATION"}</small>${context.started ? `Round ${context.round}` : "Initiative"}</div>
          <button type="button" class="add2e-horizontal-control" data-action="previous-turn" title="Tour précédent" ${context.started ? "" : "disabled"}><i class="fas fa-chevron-left"></i></button>
          <button type="button" class="add2e-horizontal-control" data-action="next-turn" title="Tour suivant" ${context.started ? "" : "disabled"}><i class="fas fa-chevron-right"></i></button>
          <button type="button" class="add2e-horizontal-control" data-action="roll-missing" title="Lancer les initiatives manquantes"><i class="fas fa-dice-d6"></i></button>
          ${context.isGM && !context.started ? '<button type="button" class="add2e-horizontal-control start" data-action="start-combat" title="Démarrer le combat"><i class="fas fa-play"></i>&nbsp;Démarrer</button>' : ""}
          ${context.isGM && context.started ? '<button type="button" class="add2e-horizontal-control" data-action="end-combat" title="Terminer le combat"><i class="fas fa-flag-checkered"></i></button>' : ""}
        </div>
        <div class="add2e-horizontal-list">${cards}</div>
      </div>`;
    return root;
  }

  _replaceHTML(result, content) {
    content.replaceChildren(result);
  }

  async _onRender(context, options) {
    await super._onRender?.(context, options);
    const root = this.element;
    if (!root?.querySelector) return;
    for (const control of root.querySelectorAll("[data-action]")) control.addEventListener("click", event => void this._onAction(event));
    for (const card of root.querySelectorAll("[data-combatant-id]")) {
      card.addEventListener("dblclick", event => void this._openSheet(event));
      card.addEventListener("contextmenu", event => void this._openContextMenu(event));
    }
    scheduleTrackerLayout(0);
    root.querySelector(".add2e-horizontal-card.active")?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }

  combatantFromEvent(event) {
    const id = event?.currentTarget?.closest?.("[data-combatant-id]")?.dataset?.combatantId
      ?? event?.target?.closest?.("[data-combatant-id]")?.dataset?.combatantId;
    return id ? game.combat?.combatants?.get?.(id) ?? null : null;
  }

  async _onAction(event) {
    event.preventDefault();
    event.stopPropagation();
    const combat = trackerCombat();
    if (!combat) return;
    const action = String(event.currentTarget?.dataset?.action ?? "");
    const combatant = this.combatantFromEvent(event);

    if (action === "start-combat" && game.user?.isGM && !combat.started) return combat.startCombat();
    if (action === "next-turn" && combat.started) return advanceAndSkip(combat, 1);
    if (action === "previous-turn" && combat.started) return advanceAndSkip(combat, -1);
    if (action === "roll-one" && combatant) return rollCombatants(combat, [combatant.id]);
    if (action === "roll-missing") {
      const ids = Array.from(combat.combatants ?? [])
        .filter(entry => entry.initiative === null || entry.initiative === undefined)
        .map(entry => entry.id);
      return ids.length ? rollCombatants(combat, ids) : ui.notifications?.info?.("Toutes les initiatives sont déjà renseignées.");
    }
    if (action === "focus-token" && combatant) return this._focusCombatant(combatant);
    if (action === "end-combat" && game.user?.isGM && combat.started) {
      const confirmed = await confirmAction({ title: "Terminer le combat", content: "<p>Terminer le combat en cours ?</p>", yes: "Terminer" });
      if (confirmed) return combat.endCombat();
    }
  }

  _focusCombatant(combatant) {
    const token = combatant?.token?.object ?? canvas?.tokens?.get?.(combatant?.tokenId);
    if (!token) return ui.notifications?.warn?.("Le token de ce combattant n’est pas présent sur la scène.");
    canvas?.animatePan?.({ x: token.center.x, y: token.center.y, duration: 250 });
    if (userCanManage(combatant)) token.control?.({ releaseOthers: true });
  }

  _openSheet(event) {
    const combatant = this.combatantFromEvent(event);
    if (!combatant?.actor || !userCanManage(combatant)) return;
    combatant.actor.sheet?.render?.(true);
  }

  _closeContextMenu() {
    document.querySelector(".add2e-horizontal-menu")?.remove();
  }

  _openContextMenu(event) {
    event.preventDefault();
    event.stopPropagation();
    this._closeContextMenu();
    const combatant = this.combatantFromEvent(event);
    if (!combatant || !userCanManage(combatant)) return;

    const menu = document.createElement("div");
    menu.className = "add2e-horizontal-menu";
    menu.style.left = `${Math.min(event.clientX, window.innerWidth - 225)}px`;
    menu.style.top = `${Math.min(event.clientY, window.innerHeight - 250)}px`;
    menu.innerHTML = `
      <button data-menu-action="sheet"><i class="fas fa-user"></i> Ouvrir la fiche</button>
      <button data-menu-action="focus"><i class="fas fa-crosshairs"></i> Centrer le token</button>
      <button data-menu-action="initiative"><i class="fas fa-dice-d6"></i> Relancer l’initiative</button>
      ${game.user?.isGM ? `<button data-menu-action="hidden"><i class="fas fa-${combatant.hidden ? "eye" : "eye-slash"}"></i> ${combatant.hidden ? "Révéler" : "Masquer"}</button>
      <button data-menu-action="defeated"><i class="fas fa-skull"></i> ${combatant.defeated ? "Rétablir" : "Marquer vaincu"}</button>
      <button data-menu-action="reset"><i class="fas fa-rotate-left"></i> Effacer l’initiative</button>
      <button class="danger" data-menu-action="remove"><i class="fas fa-trash"></i> Retirer du combat</button>` : ""}`;

    for (const button of menu.querySelectorAll("[data-menu-action]")) button.addEventListener("click", clickEvent => void this._onMenuAction(clickEvent, combatant));
    document.body.appendChild(menu);
    setTimeout(() => document.addEventListener("pointerdown", () => this._closeContextMenu(), { once: true }), 0);
  }

  async _onMenuAction(event, combatant) {
    event.preventDefault();
    event.stopPropagation();
    const action = String(event.currentTarget?.dataset?.menuAction ?? "");
    this._closeContextMenu();
    const combat = game.combat;
    if (!combat || !combatant) return;

    if (action === "sheet") return combatant.actor?.sheet?.render?.(true);
    if (action === "focus") return this._focusCombatant(combatant);
    if (action === "initiative") return rollCombatants(combat, [combatant.id]);
    if (!game.user?.isGM) return;
    if (action === "hidden") return combatant.update({ hidden: !combatant.hidden });
    if (action === "defeated") return combatant.update({ defeated: !combatant.defeated });
    if (action === "reset") return combatant.update({ initiative: null });
    if (action === "remove") {
      const confirmed = await confirmAction({ title: "Retirer du combat", content: `<p>Retirer <b>${esc(combatant.name)}</b> du combat ?</p>`, yes: "Retirer" });
      if (confirmed) return combat.deleteEmbeddedDocuments("Combatant", [combatant.id]);
    }
  }
}

function getTrackerApp() {
  trackerApp ??= new Add2eHorizontalCombatTracker();
  return trackerApp;
}

function refreshTracker({ delay = 40 } = {}) {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(async () => {
    const combat = trackerCombat();
    const app = getTrackerApp();
    if (combat) {
      ensureStyles();
      await app.render({ force: true });
      scheduleTrackerLayout(0);
    } else if (app.rendered) {
      await app.close();
    }
  }, Math.max(0, Number(delay) || 0));
}

const REFRESH_HOOKS = [
  "createCombat", "updateCombat", "deleteCombat",
  "createCombatant", "updateCombatant", "deleteCombatant",
  "createActiveEffect", "updateActiveEffect", "deleteActiveEffect",
  "updateActor", "updateToken", "canvasReady", "collapseSidebar"
];

Hooks.once("ready", () => {
  ensureStyles();
  ensureLayoutObserver();
  refreshTracker({ delay: 0 });
  game.add2e ??= {};
  game.add2e.horizontalCombatTracker = {
    version: ADD2E_HORIZONTAL_TRACKER_VERSION,
    refresh: refreshTracker,
    layout: applyTrackerLayout,
    app: () => getTrackerApp(),
    skipReason: combatantSkipReason
  };
  globalThis.ADD2E_HORIZONTAL_TRACKER_VERSION = ADD2E_HORIZONTAL_TRACKER_VERSION;
});

for (const hook of REFRESH_HOOKS) Hooks.on(hook, () => refreshTracker());
