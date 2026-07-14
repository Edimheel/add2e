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

export const ADD2E_HORIZONTAL_TRACKER_VERSION = "2026-07-14-horizontal-combat-tracker-v2";

const Add2eApplicationV2 = foundry?.applications?.api?.ApplicationV2;
const Add2eDialogV2 = foundry?.applications?.api?.DialogV2;
if (!Add2eApplicationV2) throw new Error("[ADD2E][HORIZONTAL_TRACKER] ApplicationV2 introuvable.");

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
let navigationRunning = false;

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

  const documents = [combatant, combatant.token, combatant.actor].filter(Boolean);
  for (const document of documents) {
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
  return combatant?.token?.texture?.src
    ?? combatant?.actor?.prototypeToken?.texture?.src
    ?? combatant?.actor?.img
    ?? "icons/svg/mystery-man.svg";
}

function userCanManage(combatant) {
  return game.user?.isGM === true || combatant?.actor?.isOwner === true;
}

function ensureStyles() {
  if (!document?.head || document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #add2e-horizontal-combat-tracker{position:fixed!important;top:8px!important;left:50%!important;transform:translateX(-50%)!important;width:min(96vw,1500px)!important;height:auto!important;z-index:110!important;background:transparent!important;border:0!important;box-shadow:none!important;pointer-events:none}
    #add2e-horizontal-combat-tracker .window-header{display:none!important}
    #add2e-horizontal-combat-tracker .window-content{padding:0!important;overflow:visible!important;background:transparent!important;pointer-events:none}
    .add2e-horizontal-tracker-shell{display:grid;grid-template-columns:auto auto minmax(0,1fr) auto auto;align-items:center;gap:7px;padding:7px 9px;border:1px solid rgba(205,170,82,.72);border-radius:12px;background:linear-gradient(180deg,rgba(28,31,36,.96),rgba(13,15,18,.94));box-shadow:0 5px 18px rgba(0,0,0,.62);pointer-events:auto;color:#f1e7c6}
    .add2e-horizontal-round{min-width:82px;text-align:center;font-weight:900;color:#f0cf72}.add2e-horizontal-round small{display:block;font-size:.67rem;color:#bbb29b}
    .add2e-horizontal-control{display:inline-grid;place-items:center;width:34px;height:34px;padding:0;border:1px solid #876d31;border-radius:8px;background:linear-gradient(180deg,#57451f,#2e2514);color:#f8e9b1;cursor:pointer}
    .add2e-horizontal-control:hover{filter:brightness(1.2)}.add2e-horizontal-control:disabled{opacity:.42;cursor:not-allowed}
    .add2e-horizontal-control.start{width:auto;min-width:96px;padding:0 10px}
    .add2e-horizontal-list{display:flex;align-items:flex-end;gap:7px;min-width:0;overflow-x:auto;overflow-y:hidden;padding:4px 3px 6px;scrollbar-width:thin;scrollbar-color:#8b7134 transparent}
    .add2e-horizontal-card{position:relative;display:grid;grid-template-rows:auto 66px auto;flex:0 0 76px;gap:2px;padding:4px;border:1px solid #6f6858;border-radius:9px;background:linear-gradient(180deg,#393b40,#202227);box-shadow:0 2px 6px rgba(0,0,0,.45);transition:transform .14s ease,filter .14s ease,border-color .14s ease}
    .add2e-horizontal-card.active{transform:translateY(-3px) scale(1.06);border:3px solid #d94335;background:linear-gradient(180deg,#5b302d,#271b1b);box-shadow:0 0 0 2px rgba(255,210,76,.55),0 5px 13px rgba(0,0,0,.65);z-index:4}
    .add2e-horizontal-card.inactive{filter:grayscale(.9) brightness(.55)}.add2e-horizontal-card.hidden-combatant{filter:saturate(.3)}
    .add2e-horizontal-init{position:absolute;top:-7px;right:-7px;display:grid;place-items:center;min-width:26px;height:26px;padding:0 5px;border:2px solid #d5b855;border-radius:999px;background:#17191d;color:#fff1b2;font-weight:900;z-index:5;cursor:pointer}
    .add2e-horizontal-card img{width:100%;height:66px;object-fit:cover;border:1px solid #17191d;border-radius:6px;cursor:pointer}
    .add2e-horizontal-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:center;font-size:.69rem;font-weight:900;color:#f4ecd4}
    .add2e-horizontal-state{position:absolute;left:5px;top:29px;display:grid;place-items:center;width:23px;height:23px;border-radius:999px;background:#7b1f1f;color:#fff;border:1px solid #efaaaa}
    .add2e-horizontal-attacks{position:absolute;left:3px;right:3px;bottom:20px;padding:2px 3px;border-radius:4px;background:rgba(0,0,0,.78);font-size:.58rem;line-height:1.05;text-align:center;color:#fff2b4}
    .add2e-horizontal-actions{display:flex;gap:5px;align-items:center}.add2e-horizontal-menu{position:fixed;z-index:300;display:grid;min-width:205px;padding:6px;border:1px solid #947a3d;border-radius:8px;background:#202328;box-shadow:0 8px 24px rgba(0,0,0,.72)}
    .add2e-horizontal-menu button{display:flex;align-items:center;gap:8px;padding:7px 9px;border:0;background:transparent;color:#eee6cf;text-align:left;cursor:pointer}.add2e-horizontal-menu button:hover{background:#4b4029}.add2e-horizontal-menu button.danger{color:#ffaaa2}
    @media(max-width:800px){#add2e-horizontal-combat-tracker{top:4px!important;width:98vw!important}.add2e-horizontal-tracker-shell{grid-template-columns:auto minmax(0,1fr) auto}.add2e-horizontal-round{grid-column:1}.add2e-horizontal-actions{grid-column:3}.add2e-horizontal-control.previous{display:none}.add2e-horizontal-card{flex-basis:68px;grid-template-rows:auto 58px auto}.add2e-horizontal-card img{height:58px}}
  `;
  document.head.appendChild(style);
}

async function confirmAction({ title, content, yes = "Confirmer" }) {
  if (!Add2eDialogV2?.confirm) return window.confirm(String(content).replace(/<[^>]+>/g, " "));
  return Add2eDialogV2.confirm({
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

class Add2eHorizontalCombatTracker extends Add2eApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "add2e-horizontal-combat-tracker",
    classes: ["add2e", "add2e-horizontal-combat-tracker"],
    tag: "section",
    window: { frame: false, positioned: true, minimizable: false, resizable: false },
    position: { width: 1200, height: "auto", top: 8 }
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
        const attackStatus = started ? add2eMultipleAttackHudStatus(combatant.actor, combat) : null;
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
          attackStatus
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
        <button type="button" class="add2e-horizontal-init" data-action="roll-one" ${combatant.canManage ? "" : "disabled"}
          title="${combatant.hasInitiative ? "Relancer l’initiative" : "Lancer l’initiative au d6"}">
          ${combatant.hasInitiative ? esc(combatant.initiative) : '<i class="fas fa-dice-d6"></i>'}
        </button>
        <img src="${esc(combatant.image)}" alt="${esc(combatant.name)}" data-action="focus-token">
        ${combatant.inactive ? `<span class="add2e-horizontal-state" title="${esc(combatant.skipReason)}"><i class="fas fa-ban"></i></span>` : ""}
        ${combatant.attackStatus ? `<div class="add2e-horizontal-attacks ${esc(combatant.attackStatus.css)}">${esc(combatant.attackStatus.detail)}</div>` : ""}
        <div class="add2e-horizontal-name">${esc(combatant.name)}</div>
      </article>`).join("");

    root.innerHTML = `
      <div class="add2e-horizontal-tracker-shell">
        <div class="add2e-horizontal-round"><small>${context.started ? "COMBAT" : "PRÉPARATION"}</small>${context.started ? `Round ${context.round}` : "Initiative"}</div>
        <button type="button" class="add2e-horizontal-control previous" data-action="previous-turn" title="Tour précédent" ${context.started ? "" : "disabled"}><i class="fas fa-chevron-left"></i></button>
        <div class="add2e-horizontal-list">${cards}</div>
        <button type="button" class="add2e-horizontal-control" data-action="next-turn" title="Tour suivant" ${context.started ? "" : "disabled"}><i class="fas fa-chevron-right"></i></button>
        <div class="add2e-horizontal-actions">
          <button type="button" class="add2e-horizontal-control" data-action="roll-missing" title="Lancer les initiatives manquantes"><i class="fas fa-dice-d6"></i></button>
          ${context.isGM && !context.started ? '<button type="button" class="add2e-horizontal-control start" data-action="start-combat" title="Démarrer le combat"><i class="fas fa-play"></i>&nbsp;Démarrer</button>' : ""}
          ${context.isGM && context.started ? '<button type="button" class="add2e-horizontal-control" data-action="end-combat" title="Terminer le combat"><i class="fas fa-flag-checkered"></i></button>' : ""}
        </div>
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
    } else if (app.rendered) {
      await app.close();
    }
  }, Math.max(0, Number(delay) || 0));
}

const REFRESH_HOOKS = [
  "createCombat", "updateCombat", "deleteCombat",
  "createCombatant", "updateCombatant", "deleteCombatant",
  "createActiveEffect", "updateActiveEffect", "deleteActiveEffect",
  "updateActor", "updateToken", "canvasReady"
];

Hooks.once("ready", () => {
  ensureStyles();
  refreshTracker({ delay: 0 });
  game.add2e ??= {};
  game.add2e.horizontalCombatTracker = {
    version: ADD2E_HORIZONTAL_TRACKER_VERSION,
    refresh: refreshTracker,
    app: () => getTrackerApp(),
    skipReason: combatantSkipReason
  };
  globalThis.ADD2E_HORIZONTAL_TRACKER_VERSION = ADD2E_HORIZONTAL_TRACKER_VERSION;
});

for (const hook of REFRESH_HOOKS) Hooks.on(hook, () => refreshTracker());
