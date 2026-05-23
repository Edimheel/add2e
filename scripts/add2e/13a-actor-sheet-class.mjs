// ========== CLASSE PRINCIPALE PERSONNAGE — ApplicationV2 ==========
// Migration complète hors appv1 : la feuille personnage utilise l'API V2.
// Les modules 13b à 13f gardent leurs méthodes legacy découpées ; un pont local
// fournit uniquement les appels V1 attendus par ces modules, sans hériter d'ActorSheet V1.

const ADD2E_ACTOR_SHEET_V2_VERSION = "2026-05-23-application-v2-migration-v1";

const ADD2E_APP_API = foundry?.applications?.api ?? {};
const ADD2E_SHEETS_API = foundry?.applications?.sheets ?? {};
const ADD2E_APPLICATION_V2 = ADD2E_APP_API.ApplicationV2;
const ADD2E_HANDLEBARS_MIXIN = ADD2E_APP_API.HandlebarsApplicationMixin;
const ADD2E_DOCUMENT_SHEET_V2 = ADD2E_SHEETS_API.ActorSheetV2 ?? ADD2E_SHEETS_API.DocumentSheetV2 ?? ADD2E_APP_API.DocumentSheetV2;

if (!ADD2E_APPLICATION_V2) throw new Error("[ADD2E] ApplicationV2 introuvable.");
if (!ADD2E_HANDLEBARS_MIXIN) throw new Error("[ADD2E] HandlebarsApplicationMixin introuvable.");
if (!ADD2E_DOCUMENT_SHEET_V2) throw new Error("[ADD2E] ActorSheetV2/DocumentSheetV2 introuvable.");

const ADD2E_ACTOR_SHEET_BASE = ADD2E_HANDLEBARS_MIXIN(ADD2E_DOCUMENT_SHEET_V2);

function add2eAsJQuery(element) {
  if (!element) return $();
  return element.jquery ? element : $(element);
}

function add2eGetElementForLegacy(sheet) {
  const el = sheet?.element;
  if (!el) return null;
  return el.jquery ? el[0] : el;
}

class Add2eActorSheet extends ADD2E_ACTOR_SHEET_BASE {
  static ADD2E_APPLICATION_V2_VERSION = ADD2E_ACTOR_SHEET_V2_VERSION;

  static DEFAULT_OPTIONS = {
    id: "add2e-personnage-{id}",
    classes: ["add2e", "sheet", "actor", "personnage"],
    tag: "form",
    position: {
      width: 1050,
      height: 900
    },
    window: {
      title: "ADD2e Personnage",
      resizable: true
    },
    form: {
      submitOnChange: true,
      closeOnSubmit: false
    },
    actions: {}
  };

  static PARTS = {
    main: {
      template: "systems/add2e/templates/actor/character-sheet.hbs"
    }
  };

  get actor() {
    return this.document;
  }

  get object() {
    return this.document;
  }

  get isEditable() {
    return this.options?.editable ?? this.document?.isOwner ?? false;
  }

  async _prepareContext(options = {}) {
    const context = await this.getData(options);
    context.document = this.document;
    context.actor = this.document;
    context.owner = this.document?.isOwner ?? false;
    context.editable = this.isEditable;
    context.options = this.options ?? {};
    return context;
  }

  async _preparePartContext(partId, context, options = {}) {
    return context;
  }

  async _onRender(context, options = {}) {
    await super._onRender?.(context, options);
    const html = add2eAsJQuery(add2eGetElementForLegacy(this));
    if (!html.length) return;

    try {
      this.activateListeners?.(html);
    } catch (err) {
      console.warn("[ADD2E][ACTOR_SHEET_V2][LISTENERS] Erreur activateListeners", err);
    }

    try {
      add2eEnhanceCharacterSheetUi?.(this, html);
    } catch (_err) {}

    try {
      this._add2eActivateTab?.(this._add2eActiveTab || this._add2eReadStoredTab?.() || "resume", html);
    } catch (_err) {}
  }

  async _onDrop(event) {
    return this._add2eNativeOnDrop(event);
  }

  async _add2eNativeOnDrop(event) {
    event?.preventDefault?.();
    return false;
  }

  _add2eNativeActivateListeners(_html) {
    // ApplicationV2 ne possède pas activateListeners. Les handlers ADD2E sont
    // branchés dans 13d depuis _onRender avec un objet jQuery de compatibilité.
  }

  _add2eNativeGetData() {
    const actor = this.document;
    return {
      actor,
      document: actor,
      data: actor?.system ?? {},
      system: actor?.system ?? {},
      items: actor?.items ?? [],
      effects: actor?.effects ?? [],
      owner: actor?.isOwner ?? false,
      editable: this.isEditable,
      limited: actor?.limited ?? false,
      options: this.options ?? {},
      cssClass: this.isEditable ? "editable" : "locked"
    };
  }

  _add2eNativeRender(force = false, options = {}) {
    const renderOptions = (typeof force === "object" && force !== null)
      ? force
      : { ...(options ?? {}), force: !!force };
    return super.render(renderOptions);
  }

  _add2eGetNativeActiveTab() {
    return this._add2eActiveTab || this._add2eReadStoredTab?.() || null;
  }

  _add2eSetNativeActiveTab(tab) {
    if (!tab) return;
    this._add2eActiveTab = tab;
  }

  _onChangeTab(event, tabs, active) {
    super._onChangeTab?.(event, tabs, active);
    if (!active) return;
    this._add2eActiveTab = active;
    this._add2eSetNativeActiveTab(active);
    try {
      sessionStorage.setItem(this._add2eTabStorageKey(), active);
    } catch (_e) {}
  }
}

// Pont legacy strictement limité aux modules ADD2E 13b/13c/13d/13e qui appellent
// encore ActorSheet.prototype.* après le découpage historique du fichier.
const ADD2E_LEGACY_ACTOR_SHEET_BRIDGE = {
  prototype: {
    getData: async function getData() {
      return this._add2eNativeGetData();
    },
    activateListeners: function activateListeners(html) {
      return this._add2eNativeActivateListeners?.(html);
    },
    render: function render(force = false, options = {}) {
      return this._add2eNativeRender(force, options);
    },
    _onDrop: async function _onDrop(event) {
      return this._add2eNativeOnDrop(event);
    }
  }
};

try {
  globalThis.ADD2E_ACTOR_SHEET_V2_VERSION = ADD2E_ACTOR_SHEET_V2_VERSION;
  globalThis.ADD2E_ORIGINAL_ACTOR_SHEET_GLOBAL = globalThis.ActorSheet ?? null;
  globalThis.ActorSheet = ADD2E_LEGACY_ACTOR_SHEET_BRIDGE;
  globalThis.Add2eActorSheet = Add2eActorSheet;
} catch (_e) {}

console.log("[ADD2E][ACTOR_SHEET][APPLICATION_V2]", ADD2E_ACTOR_SHEET_V2_VERSION);
