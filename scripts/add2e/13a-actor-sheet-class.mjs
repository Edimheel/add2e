// ========== CLASSE PRINCIPALE PERSONNAGE ==========
const ADD2E_ACTOR_SHEET_V1 = foundry.appv1?.sheets?.ActorSheet;
if (!ADD2E_ACTOR_SHEET_V1) throw new Error("[ADD2E] foundry.appv1.sheets.ActorSheet introuvable.");

class Add2eActorSheet extends ADD2E_ACTOR_SHEET_V1 {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["add2e", "sheet", "actor", "personnage"],
      template: "systems/add2e/templates/actor/character-sheet.hbs",
      width: 1050,
      height: 900,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "resume" }]
    });
  }

  _add2eGetNativeActiveTab() {
    const tabs = Array.isArray(this._tabs) ? this._tabs : [];
    const primary = tabs.find(t => t?.group === "primary") ?? tabs[0];
    return primary?.active || null;
  }

  _add2eSetNativeActiveTab(tab) {
    if (!tab) return;
    const tabs = Array.isArray(this._tabs) ? this._tabs : [];
    for (const t of tabs) {
      if (t) t.active = tab;
    }
  }

  _onChangeTab(event, tabs, active) {
    super._onChangeTab?.(event, tabs, active);
    if (!active) return;
    this._add2eActiveTab = active;
    this._add2eSetNativeActiveTab(active);
    try {
      sessionStorage.setItem(this._add2eTabStorageKey(), active);
    } catch (e) {}
  }
}

globalThis.Add2eActorSheet = Add2eActorSheet;
try { globalThis.Add2eActorSheet = Add2eActorSheet; } catch (_e) {}
