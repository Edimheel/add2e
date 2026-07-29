// ============================================================================
// ADD2E — Tracker de combat horizontal
// ApplicationV2 / DialogV2 — Compatible Foundry V13/V14/V15.
// Interface directe du service canonique d'initiative ADD2E.
// ============================================================================

import { add2eMultipleAttackHudStatus } from "../add2e-initiative-order.mjs";
import {
  add2eAdvanceCombatTurn,
  add2eClearDeclaredInitiativeAction,
  add2eCombatantSkipReason,
  add2eGetCombatOrder,
  add2eGetCurrentCombatant,
  add2eGetDeclaredInitiativeAction,
  add2eGetInitiativeActionContext,
  add2eGetInitiativeSituation,
  add2eRollInitiative,
  add2eSetInitiativeSituation
} from "../add2e-initiative.mjs";

export const ADD2E_HORIZONTAL_TRACKER_VERSION = "2026-07-29-horizontal-combat-tracker-actions-v8";

const ApplicationV2 = foundry?.applications?.api?.ApplicationV2;
const DialogV2 = foundry?.applications?.api?.DialogV2;
if (!ApplicationV2) throw new Error("[ADD2E][HORIZONTAL_TRACKER] ApplicationV2 introuvable.");
if (!DialogV2) throw new Error("[ADD2E][HORIZONTAL_TRACKER] DialogV2 introuvable.");

const STYLE_ID = "add2e-horizontal-combat-tracker-style";

let trackerApp = null;
let refreshTimer = null;
let layoutTimer = null;
let sidebarObserver = null;
let contextMenuCloseHandler = null;

function esc(value) {
  if (foundry?.utils?.escapeHTML) return foundry.utils.escapeHTML(String(value ?? ""));
  const node = document.createElement("div");
  node.textContent = String(value ?? "");
  return node.innerHTML;
}

function signed(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "0";
  return `${number > 0 ? "+" : ""}${number}`;
}

function integer(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : fallback;
}

function trackerCombat() {
  const combat = game.combat;
  return combat?.combatants?.size ? combat : null;
}

function activeCombatantId(combat) {
  if (!combat?.started) return null;
  return add2eGetCurrentCombatant(combat)?.id ?? null;
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

function actionKindPresentation(action) {
  if (action?.kind === "weapon") {
    return { label: "Arme", icon: "fas fa-sword", segmentLabel: "rapidité" };
  }
  if (action?.kind === "spell") {
    return { label: "Sort", icon: "fas fa-wand-magic-sparkles", segmentLabel: "incantation" };
  }
  return { label: "Action", icon: "fas fa-bolt", segmentLabel: "segment" };
}

function initiativePresentation(combatant, combat) {
  const action = add2eGetDeclaredInitiativeAction(combatant, combat);
  const context = add2eGetInitiativeActionContext(combatant, combatant?.actor ?? null, combat);
  const situation = context?.situation ?? add2eGetInitiativeSituation(combatant, combat);
  const segment = Number(action?.segment);
  const kind = actionKindPresentation(action);
  const actionLabel = action
    ? `${action.label}${Number.isFinite(segment) ? ` · ${action.kind === "weapon" ? "R" : action.kind === "spell" ? "T" : "S"}${segment}` : ""}`
    : "";
  const actionTitle = action
    ? `${kind.label} déclarée : ${action.label}${Number.isFinite(segment) ? ` — ${kind.segmentLabel} ${segment}` : ""}`
    : "Aucune action déclarée";

  const modifier = Number(situation?.modifier) || 0;
  const surpriseSegments = Math.max(0, integer(situation?.surpriseSegments));
  const dexterityReaction = integer(situation?.dexterityReaction);
  const remainingSurpriseSegments = Math.max(0, integer(situation?.remainingSurpriseSegments));
  const situationParts = [];
  if (modifier) situationParts.push(`Sit ${signed(modifier)}`);
  if (surpriseSegments) situationParts.push(`Surp ${surpriseSegments}→${remainingSurpriseSegments}`);
  const situationLabel = situationParts.join(" · ");
  const situationTitle = situationParts.length
    ? [
        modifier ? `Modificateur de situation ${signed(modifier)}` : "",
        surpriseSegments
          ? `Surprise ${surpriseSegments} segment${surpriseSegments > 1 ? "s" : ""} — réaction DEX ${signed(dexterityReaction)} — reste ${remainingSurpriseSegments}`
          : ""
      ].filter(Boolean).join(" ; ")
    : "Aucune situation particulière";

  return {
    action,
    actionLabel,
    actionTitle,
    actionIcon: kind.icon,
    hasAction: Boolean(action),
    situation,
    situationLabel,
    situationTitle,
    hasSituation: Boolean(situationParts.length),
    surprised: remainingSurpriseSegments > 0,
    hasMeta: Boolean(action || situationParts.length)
  };
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
      z-index: 90 !important;
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
      pointer-events: none;
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
      pointer-events: auto;
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
      height: 58%;
      pointer-events: none;
      background: linear-gradient(transparent, rgba(0,0,0,.86));
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
    .add2e-horizontal-meta {
      position: absolute;
      left: 5px;
      right: 5px;
      bottom: 25px;
      z-index: 5;
      display: grid;
      gap: 2px;
      pointer-events: none;
    }
    .add2e-horizontal-card.has-attacks .add2e-horizontal-meta { bottom: 50px; }
    .add2e-horizontal-meta-line {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      min-width: 0;
      padding: 3px 4px;
      border: 1px solid rgba(222,195,111,.6);
      border-radius: 4px;
      background: rgba(24,26,30,.84);
      color: #fff4c9;
      font-size: .62rem;
      font-weight: 800;
      line-height: 1.05;
    }
    .add2e-horizontal-meta-line span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .add2e-horizontal-meta-line.situation { border-color: rgba(127,184,226,.72); color: #d8efff; }
    .add2e-horizontal-meta-line.situation.surprised { border-color: rgba(238,135,116,.85); color: #ffd8cf; }
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
      min-width: 235px;
      max-width: 310px;
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
    .add2e-initiative-situation-form {
      display: grid;
      gap: 12px;
      padding: 4px;
    }
    .add2e-initiative-situation-form .form-group {
      display: grid;
      grid-template-columns: minmax(155px, 1fr) minmax(90px, .65fr);
      align-items: center;
      gap: 10px;
      margin: 0;
    }
    .add2e-initiative-situation-form input[type="number"] { width: 100%; }
    .add2e-initiative-situation-form .checkbox {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .add2e-initiative-situation-summary {
      padding: 8px 10px;
      border: 1px solid rgba(143,119,57,.65);
      border-radius: 6px;
      background: rgba(143,119,57,.1);
      line-height: 1.35;
    }
    @media (max-width: 800px) {
      #add2e-horizontal-combat-tracker { top: 4px !important; }
      .add2e-horizontal-tracker-shell { gap: 6px; }
      .add2e-horizontal-controls { gap: 4px; }
      .add2e-horizontal-round { min-width: 76px; padding: 6px; font-size: .84rem; }
      .add2e-horizontal-control { width: 36px; height: 36px; }
      .add2e-horizontal-control.start { min-width: 92px; padding: 0 8px; }
      .add2e-horizontal-card { flex-basis: 96px; width: 96px; height: 124px; }
      .add2e-horizontal-meta-line { font-size: .57rem; }
    }
  `;
  document.head.appendChild(style);
}

async function confirmAction({ title, content, yes = "Confirmer" }) {
  if (!DialogV2?.confirm) {
    ui.notifications?.error?.("DialogV2 est indisponible.");
    return false;
  }
  return DialogV2.confirm({
    window: { title },
    content,
    yes: { label: yes, icon: "fas fa-check" },
    no: { label: "Annuler", icon: "fas fa-times" },
    modal: true
  });
}

async function editInitiativeSituation(combatant, combat) {
  if (!DialogV2?.wait) {
    ui.notifications?.error?.("DialogV2 est indisponible pour la situation d’initiative.");
    return false;
  }
  const current = add2eGetInitiativeSituation(combatant, combat);
  const context = add2eGetInitiativeActionContext(combatant, combatant?.actor ?? null, combat);
  const action = add2eGetDeclaredInitiativeAction(combatant, combat);
  const reaction = integer(context?.situation?.dexterityReaction);
  const remaining = Math.max(0, integer(context?.situation?.remainingSurpriseSegments));
  const actionText = action
    ? `${esc(action.label)}${Number.isFinite(Number(action.segment)) ? ` — ${action.kind === "weapon" ? "rapidité" : action.kind === "spell" ? "incantation" : "segment"} ${esc(action.segment)}` : ""}`
    : "Aucune action déclarée";

  const result = await DialogV2.wait({
    window: { title: `Initiative — ${combatant.name ?? "Combattant"}` },
    position: { width: 440 },
    content: `
      <form class="add2e-initiative-situation-form">
        <div class="add2e-initiative-situation-summary">
          <strong>Action :</strong> ${actionText}<br>
          <strong>Réaction DEX actuelle :</strong> ${esc(signed(reaction))}<br>
          <strong>Surprise restante actuelle :</strong> ${esc(remaining)}
        </div>
        <div class="form-group">
          <label for="add2e-initiative-modifier">Modificateur de situation</label>
          <input id="add2e-initiative-modifier" type="number" name="modifier" step="1" value="${esc(Number(current?.modifier) || 0)}">
        </div>
        <div class="form-group">
          <label for="add2e-surprise-segments">Segments de surprise</label>
          <input id="add2e-surprise-segments" type="number" name="surpriseSegments" min="0" step="1" value="${esc(Math.max(0, integer(current?.surpriseSegments)))}">
        </div>
        <label class="checkbox" for="add2e-apply-dexterity-reaction">
          <span>Appliquer la réaction de Dextérité</span>
          <input id="add2e-apply-dexterity-reaction" type="checkbox" name="applyDexterityReaction" ${current?.applyDexterityReaction !== false ? "checked" : ""}>
        </label>
      </form>`,
    buttons: [
      {
        action: "save",
        label: "Enregistrer",
        icon: "fas fa-save",
        default: true,
        callback: (_event, button) => {
          const form = button.form;
          const modifier = Number(form?.elements?.modifier?.value ?? 0);
          const surpriseSegments = Number(form?.elements?.surpriseSegments?.value ?? 0);
          return {
            modifier: Number.isFinite(modifier) ? modifier : 0,
            surpriseSegments: Number.isFinite(surpriseSegments) ? Math.max(0, Math.trunc(surpriseSegments)) : 0,
            applyDexterityReaction: form?.elements?.applyDexterityReaction?.checked === true
          };
        }
      },
      {
        action: "cancel",
        label: "Annuler",
        icon: "fas fa-times",
        callback: () => null
      }
    ],
    rejectClose: false
  });

  if (!result) return false;
  await add2eSetInitiativeSituation(combatant, {
    ...result,
    source: "horizontal-tracker"
  }, combat);
  return true;
}

async function clearInitiativeAction(combatant, combat) {
  const action = add2eGetDeclaredInitiativeAction(combatant, combat);
  if (!action) return ui.notifications?.info?.("Aucune action d’initiative n’est déclarée.");
  const confirmed = await confirmAction({
    title: "Effacer l’action déclarée",
    content: `<p>Effacer l’action <strong>${esc(action.label)}</strong> de <strong>${esc(combatant.name)}</strong> ?</p>`,
    yes: "Effacer"
  });
  if (!confirmed) return false;
  return add2eClearDeclaredInitiativeAction(combatant, combat);
}

async function rollCombatants(combat, ids) {
  const allowedIds = ids.filter(id => {
    const combatant = combat?.combatants?.get?.(id);
    return combatant && userCanManage(combatant);
  });
  if (!allowedIds.length) return ui.notifications?.warn?.("Aucune initiative autorisée à lancer.");
  return add2eRollInitiative(combat, allowedIds, {
    updateTurn: false,
    messageOptions: { rollMode: game.settings?.get?.("core", "rollMode") ?? "publicroll" }
  });
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
    const combatants = add2eGetCombatOrder(combat)
      .filter(combatant => game.user?.isGM || combatant.hidden !== true)
      .map(combatant => {
        const hiddenForPlayer = combatant.hidden === true && !game.user?.isGM;
        const skipReason = add2eCombatantSkipReason(combatant);
        const initiative = initiativePresentation(combatant, combat);
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
          attackStatus,
          ...initiative
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

    const cards = context.combatants.map(combatant => {
      const title = [
        combatant.name,
        combatant.skipReason,
        combatant.hasAction ? combatant.actionTitle : "",
        combatant.hasSituation ? combatant.situationTitle : ""
      ].filter(Boolean).join(" — ");
      const meta = combatant.hasMeta ? `
        <div class="add2e-horizontal-meta">
          ${combatant.hasAction ? `<div class="add2e-horizontal-meta-line action" title="${esc(combatant.actionTitle)}"><i class="${esc(combatant.actionIcon)}"></i><span>${esc(combatant.actionLabel)}</span></div>` : ""}
          ${combatant.hasSituation ? `<div class="add2e-horizontal-meta-line situation${combatant.surprised ? " surprised" : ""}" title="${esc(combatant.situationTitle)}"><i class="fas fa-triangle-exclamation"></i><span>${esc(combatant.situationLabel)}</span></div>` : ""}
        </div>` : "";

      return `
        <article class="add2e-horizontal-card${combatant.active ? " active" : ""}${combatant.inactive ? " inactive" : ""}${combatant.hidden ? " hidden-combatant" : ""}${combatant.attackStatus ? " has-attacks" : ""}"
          data-combatant-id="${esc(combatant.id)}" title="${esc(title)}">
          <img src="${esc(combatant.image)}" alt="${esc(combatant.name)}" data-action="focus-token">
          <button type="button" class="add2e-horizontal-init" data-action="roll-one" ${combatant.canManage ? "" : "disabled"}
            title="${combatant.hasInitiative ? "Relancer l’initiative" : "Lancer l’initiative au d6"}">
            ${combatant.hasInitiative ? esc(combatant.initiative) : '<i class="fas fa-dice-d6"></i>'}
          </button>
          ${combatant.inactive ? `<span class="add2e-horizontal-state" title="${esc(combatant.skipReason)}"><i class="fas fa-ban"></i></span>` : ""}
          ${meta}
          ${combatant.attackStatus ? `<div class="add2e-horizontal-attacks ${esc(combatant.attackStatus.css)}">${esc(combatant.attackStatus.detail)}</div>` : ""}
          <div class="add2e-horizontal-name">${esc(combatant.name)}</div>
        </article>`;
    }).join("");

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
    for (const control of root.querySelectorAll("[data-action]")) {
      control.addEventListener("click", event => void this._onAction(event));
    }
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
    if (action === "next-turn" && combat.started) return add2eAdvanceCombatTurn(combat, 1);
    if (action === "previous-turn" && combat.started) return add2eAdvanceCombatTurn(combat, -1);
    if (action === "roll-one" && combatant) return rollCombatants(combat, [combatant.id]);
    if (action === "roll-missing") {
      const ids = Array.from(combat.combatants ?? [])
        .filter(entry => entry.initiative === null || entry.initiative === undefined)
        .map(entry => entry.id);
      return ids.length ? rollCombatants(combat, ids) : ui.notifications?.info?.("Toutes les initiatives sont déjà renseignées.");
    }
    if (action === "focus-token" && combatant) return this._focusCombatant(combatant);
    if (action === "end-combat" && game.user?.isGM && combat.started) return combat.endCombat();
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
    if (contextMenuCloseHandler) {
      document.removeEventListener("pointerdown", contextMenuCloseHandler, true);
      contextMenuCloseHandler = null;
    }
    document.querySelector(".add2e-horizontal-menu")?.remove();
  }

  _openContextMenu(event) {
    event.preventDefault();
    event.stopPropagation();
    this._closeContextMenu();
    const combatant = this.combatantFromEvent(event);
    if (!combatant || !userCanManage(combatant)) return;

    const combat = game.combat;
    const action = add2eGetDeclaredInitiativeAction(combatant, combat);
    const menu = document.createElement("div");
    menu.className = "add2e-horizontal-menu";
    menu.innerHTML = `
      <button data-menu-action="sheet"><i class="fas fa-user"></i> Ouvrir la fiche</button>
      <button data-menu-action="focus"><i class="fas fa-crosshairs"></i> Centrer le token</button>
      <button data-menu-action="initiative"><i class="fas fa-dice-d6"></i> Relancer l’initiative</button>
      <button data-menu-action="situation"><i class="fas fa-triangle-exclamation"></i> Situation et surprise</button>
      ${action ? '<button data-menu-action="clear-action"><i class="fas fa-eraser"></i> Effacer l’action déclarée</button>' : ""}
      ${game.user?.isGM ? `<button data-menu-action="hidden"><i class="fas fa-${combatant.hidden ? "eye" : "eye-slash"}"></i> ${combatant.hidden ? "Révéler" : "Masquer"}</button>
      <button data-menu-action="defeated"><i class="fas fa-skull"></i> ${combatant.defeated ? "Rétablir" : "Marquer vaincu"}</button>
      <button data-menu-action="reset"><i class="fas fa-rotate-left"></i> Effacer l’initiative</button>
      <button class="danger" data-menu-action="remove"><i class="fas fa-trash"></i> Retirer du combat</button>` : ""}`;

    for (const button of menu.querySelectorAll("[data-menu-action]")) {
      button.addEventListener("click", clickEvent => void this._onMenuAction(clickEvent, combatant));
    }
    document.body.appendChild(menu);
    const rect = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(6, Math.min(event.clientX, window.innerWidth - rect.width - 6))}px`;
    menu.style.top = `${Math.max(6, Math.min(event.clientY, window.innerHeight - rect.height - 6))}px`;
    setTimeout(() => {
      contextMenuCloseHandler = pointerEvent => {
        if (menu.contains(pointerEvent.target)) return;
        this._closeContextMenu();
      };
      document.addEventListener("pointerdown", contextMenuCloseHandler, true);
    }, 0);
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
    if (action === "situation") return editInitiativeSituation(combatant, combat);
    if (action === "clear-action") return clearInitiativeAction(combatant, combat);
    if (!game.user?.isGM) return;
    if (action === "hidden") return combatant.update({ hidden: !combatant.hidden });
    if (action === "defeated") return combatant.update({ defeated: !combatant.defeated });
    if (action === "reset") return combatant.update({ initiative: null });
    if (action === "remove") {
      const confirmed = await confirmAction({
        title: "Retirer du combat",
        content: `<p>Retirer <b>${esc(combatant.name)}</b> du combat ?</p>`,
        yes: "Retirer"
      });
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
  "updateActor", "updateToken", "canvasReady", "collapseSidebar",
  "add2eInitiativeRolled", "add2eInitiativeTurnChanged",
  "add2eInitiativeActionDeclared", "add2eInitiativeSituationChanged"
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
    skipReason: add2eCombatantSkipReason,
    initiativeContext: add2eGetInitiativeActionContext
  };
  globalThis.ADD2E_HORIZONTAL_TRACKER_VERSION = ADD2E_HORIZONTAL_TRACKER_VERSION;
});

for (const hook of REFRESH_HOOKS) Hooks.on(hook, () => refreshTracker());
