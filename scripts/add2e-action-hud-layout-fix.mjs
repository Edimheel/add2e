// scripts/add2e-action-hud-layout-fix.mjs
// ADD2E — Correctif de layout du HUD d'action rapide
// Version : 2026-05-16-v1-stats-single-line
//
// Objectif : forcer PV / CA / THAC0 à tenir ensemble sur une seule ligne,
// sans retour automatique ni masquage, en plaçant les statistiques à droite
// de l'identité du personnage.

const ADD2E_ACTION_HUD_LAYOUT_FIX_VERSION = "2026-05-16-v1-stats-single-line";
const TAG = "[ADD2E][ACTION_HUD][LAYOUT_FIX]";
const STYLE_ID = "add2e-action-hud-layout-fix-style";

function add2eInjectActionHudLayoutFix() {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #add2e-action-hud {
      width: 760px !important;
      max-width: calc(100vw - 140px) !important;
    }

    #add2e-action-hud .a2e-hud-header {
      grid-template-columns: 88px minmax(0, 1fr) 34px !important;
      min-height: 86px !important;
      align-items: center !important;
    }

    #add2e-action-hud .a2e-hud-main {
      display: grid !important;
      grid-template-columns: minmax(180px, 1fr) max-content !important;
      grid-template-rows: 24px 24px !important;
      column-gap: 12px !important;
      row-gap: 0 !important;
      align-items: center !important;
      align-content: center !important;
      min-width: 0 !important;
      overflow: visible !important;
    }

    #add2e-action-hud .a2e-hud-name {
      grid-column: 1 !important;
      grid-row: 1 !important;
      min-width: 0 !important;
    }

    #add2e-action-hud .a2e-hud-subtitle {
      grid-column: 1 !important;
      grid-row: 2 !important;
      min-width: 0 !important;
    }

    #add2e-action-hud .a2e-hud-metrics {
      grid-column: 2 !important;
      grid-row: 1 / span 2 !important;
      display: grid !important;
      grid-template-columns: max-content max-content max-content !important;
      gap: 5px !important;
      align-items: center !important;
      justify-content: end !important;
      width: max-content !important;
      max-width: none !important;
      overflow: visible !important;
      white-space: nowrap !important;
      flex-wrap: nowrap !important;
    }

    #add2e-action-hud .a2e-hud-pill {
      height: 24px !important;
      min-width: 0 !important;
      max-width: none !important;
      padding: 1px 8px !important;
      font-size: 0.76em !important;
      line-height: 1 !important;
      white-space: nowrap !important;
      flex: 0 0 auto !important;
    }

    @media (max-width: 900px) {
      #add2e-action-hud {
        width: calc(100vw - 24px) !important;
        max-width: calc(100vw - 24px) !important;
        left: 12px !important;
        right: 12px !important;
      }

      #add2e-action-hud .a2e-hud-main {
        grid-template-columns: minmax(140px, 1fr) max-content !important;
        column-gap: 8px !important;
      }

      #add2e-action-hud .a2e-hud-pill {
        padding: 1px 6px !important;
        font-size: 0.72em !important;
      }
    }

    @media (max-width: 680px) {
      #add2e-action-hud .a2e-hud-main {
        grid-template-columns: 1fr !important;
        grid-template-rows: 21px 19px 24px !important;
      }

      #add2e-action-hud .a2e-hud-metrics {
        grid-column: 1 !important;
        grid-row: 3 !important;
        justify-content: start !important;
      }
    }
  `;

  document.head.appendChild(style);
  console.log(`${TAG}[INJECT]`, ADD2E_ACTION_HUD_LAYOUT_FIX_VERSION);
}

Hooks.once("init", () => {
  game.add2e = game.add2e ?? {};
  game.add2e.actionHudLayoutFixVersion = ADD2E_ACTION_HUD_LAYOUT_FIX_VERSION;
});

Hooks.once("ready", () => {
  add2eInjectActionHudLayoutFix();
  setTimeout(add2eInjectActionHudLayoutFix, 250);
});

Hooks.on("canvasReady", () => setTimeout(add2eInjectActionHudLayoutFix, 100));
Hooks.on("renderApplication", () => setTimeout(add2eInjectActionHudLayoutFix, 50));

export { add2eInjectActionHudLayoutFix };
