// ============================================================================
// ADD2E — Marquage visuel des combattants inactifs dans le tracker.
// Version : 2026-06-01-combat-tracker-inactive-visual-v1
// Compatible Foundry V13/V14/V15 — aucun Dialog/Application V1.
// ============================================================================

export const ADD2E_COMBAT_TRACKER_INACTIVE_VISUAL_VERSION = "2026-06-01-combat-tracker-inactive-visual-v1";

function add2eCombatantArray(combatants) {
  if (!combatants) return [];
  if (Array.isArray(combatants)) return combatants;
  if (typeof combatants.values === "function") return [...combatants.values()];
  return Object.values(combatants);
}

function add2eEnsureInactiveTrackerStyle() {
  if (document.getElementById("add2e-inactive-tracker-style")) return;

  const style = document.createElement("style");
  style.id = "add2e-inactive-tracker-style";
  style.textContent = `
    #combat-tracker .combatant.add2e-combatant-inactive,
    .combat-tracker .combatant.add2e-combatant-inactive,
    [data-combatant-id].add2e-combatant-inactive {
      opacity: 0.55;
      filter: grayscale(0.75);
    }

    #combat-tracker .combatant.add2e-combatant-inactive .token-name,
    .combat-tracker .combatant.add2e-combatant-inactive .token-name,
    [data-combatant-id].add2e-combatant-inactive .token-name,
    [data-combatant-id].add2e-combatant-inactive .name {
      text-decoration: line-through;
      color: #9a9a9a;
    }

    .add2e-inactive-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-left: 0.35rem;
      padding: 0.05rem 0.35rem;
      border-radius: 999px;
      font-size: 0.65rem;
      line-height: 1.1;
      font-weight: 700;
      color: #f0f0f0;
      background: rgba(120, 20, 20, 0.9);
      border: 1px solid rgba(255, 255, 255, 0.35);
      white-space: nowrap;
    }
  `;
  document.head.appendChild(style);
}

function add2eFindCombatantRows(root, combatantId) {
  if (!root || !combatantId) return [];
  const selectors = [
    `[data-combatant-id="${combatantId}"]`,
    `[data-combatant-id='${combatantId}']`,
    `[data-document-id="${combatantId}"]`,
    `[data-document-id='${combatantId}']`,
    `li.combatant[data-combatant-id="${combatantId}"]`,
    `.combatant[data-combatant-id="${combatantId}"]`
  ];

  const rows = [];
  for (const selector of selectors) {
    try {
      rows.push(...root.querySelectorAll(selector));
    } catch (_err) {}
  }
  return [...new Set(rows)];
}

function add2eApplyInactiveMarkerToRow(row, combatant) {
  if (!row || !combatant) return false;

  const inactive = combatant.flags?.add2e?.inactive === true;
  row.classList.toggle("add2e-combatant-inactive", inactive);
  row.dataset.add2eInactive = inactive ? "true" : "false";

  const existing = row.querySelector(".add2e-inactive-badge");
  if (!inactive) {
    existing?.remove?.();
    return false;
  }

  if (existing) return true;

  const badge = document.createElement("span");
  badge.className = "add2e-inactive-badge";
  badge.textContent = "INACTIF";
  badge.title = "ADD2E : ce combattant est inactif et sera sauté par l’initiative.";

  const target = row.querySelector(".token-name") || row.querySelector(".name") || row.querySelector("h4") || row;
  target.appendChild(badge);
  return true;
}

export function add2eRenderInactiveCombatTracker(app, html, data) {
  const root = html?.[0] ?? html;
  if (!(root instanceof HTMLElement)) return;

  add2eEnsureInactiveTrackerStyle();

  const combat = app?.viewed ?? app?.combat ?? game.combat;
  const combatants = add2eCombatantArray(combat?.combatants);
  const result = [];

  for (const combatant of combatants) {
    if (!combatant?.id) continue;
    const rows = add2eFindCombatantRows(root, combatant.id);
    for (const row of rows) {
      const marked = add2eApplyInactiveMarkerToRow(row, combatant);
      result.push({
        combatant: combatant.name,
        combatantId: combatant.id,
        inactive: combatant.flags?.add2e?.inactive === true,
        defeated: combatant.defeated,
        marked,
        rowClass: row.className
      });
    }
  }

  if (result.length) {
    console.log("[ADD2E][INIT][TRACKER_INACTIVE_VISUAL]", {
      version: ADD2E_COMBAT_TRACKER_INACTIVE_VISUAL_VERSION,
      combatId: combat?.id,
      result
    });
  }
}

Hooks.on("renderCombatTracker", add2eRenderInactiveCombatTracker);
Hooks.on("renderCombatTrackerHTML", add2eRenderInactiveCombatTracker);
