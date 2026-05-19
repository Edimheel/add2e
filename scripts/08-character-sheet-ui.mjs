// ============================================================
// ADD2E — 08 Character Sheet UI — point d'entrée
// Fichier découpé :
// - 08-character-sheet-ui-00-utils.mjs
// - 08-character-sheet-ui-01-effects.mjs
// - 08-character-sheet-ui-02-capacites.mjs
// - 08-character-sheet-ui-03-styles.mjs
// ============================================================
import {
  ADD2E_CHARACTER_SHEET_UI_VERSION,
  getSheetRoot,
  expose
} from "./08-character-sheet-ui-00-utils.mjs";
import { injectEffectsTab } from "./08-character-sheet-ui-01-effects.mjs";
import { injectCapacitesTab } from "./08-character-sheet-ui-02-capacites.mjs";
import { injectCharacterUiStyles } from "./08-character-sheet-ui-03-styles.mjs";

console.log("[ADD2E][CHARACTER_UI][VERSION]", ADD2E_CHARACTER_SHEET_UI_VERSION);

export function add2eEnhanceCharacterSheetUi(sheet, html) {
  const actor = sheet?.actor ?? sheet?.document;
  if (!actor || actor.type !== "personnage") return;

  const sheetRoot = getSheetRoot(html);
  if (!sheetRoot) return;

  injectEffectsTab(sheet, sheetRoot);
  injectCapacitesTab(sheet, sheetRoot);
  injectCharacterUiStyles(sheetRoot);

  sheet._add2eActivateTab?.(sheet._add2eActiveTab || sheet._add2eReadStoredTab?.() || "resume", sheetRoot);
}

function bindOnRender(app, html) {
  const actor = app?.actor ?? app?.document;
  if (actor?.type !== "personnage") return;

  for (const delay of [50, 150, 300]) {
    setTimeout(() => {
      try {
        add2eEnhanceCharacterSheetUi(app, html);
      } catch (err) {
        console.warn("[ADD2E][CHARACTER_UI][SPLIT] Injection impossible.", err);
      }
    }, delay);
  }
}

Hooks.on("renderActorSheet", bindOnRender);
Hooks.on("renderApplication", bindOnRender);

expose("add2eEnhanceCharacterSheetUi", add2eEnhanceCharacterSheetUi);
