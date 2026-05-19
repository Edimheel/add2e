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

function add2eRefreshActorSheetsForItemChange(item, reason = "item-change") {
  const actor = item?.parent;
  if (!actor || actor.documentName !== "Actor" || actor.type !== "personnage") return;

  const type = String(item.type || "").toLowerCase();
  if (!["objet", "arme", "armure", "object", "magic", "objet_magique", "classe", "race", "sort"].includes(type)) return;

  const hasPowers = (() => {
    try {
      if (typeof globalThis.add2eMagicObjectActivePowerEntries === "function") {
        return globalThis.add2eMagicObjectActivePowerEntries(item).length > 0;
      }
    } catch (_e) {}
    const sys = item.system ?? {};
    const raw = sys.pouvoirs ?? sys.powers ?? sys.pouvoirsMagiques ?? sys.magicalPowers ?? sys.sorts ?? sys.spells ?? [];
    return Array.isArray(raw) ? raw.length > 0 : !!(raw && typeof raw === "object" && Object.keys(raw).length);
  })();

  if (!["objet", "arme", "armure", "object", "magic", "objet_magique"].includes(type) || hasPowers) {
    for (const app of Object.values(actor.apps ?? {})) {
      try {
        app._add2eRememberActiveTab?.(app.element, app._add2eActiveTab || app._add2eReadStoredTab?.() || "sorts");
        app.render(false);
      } catch (err) {
        console.warn("[ADD2E][CHARACTER_UI][REFRESH_ITEM] Impossible de rafraîchir la fiche", { actor: actor.name, item: item.name, reason, err });
      }
    }
  }
}

Hooks.on("renderActorSheet", bindOnRender);
Hooks.on("renderApplication", bindOnRender);

for (const hookName of ["createItem", "updateItem", "deleteItem"]) {
  Hooks.on(hookName, (item, _changes, _options, _userId) => {
    setTimeout(() => add2eRefreshActorSheetsForItemChange(item, hookName), 80);
  });
}

expose("add2eEnhanceCharacterSheetUi", add2eEnhanceCharacterSheetUi);
