// ========== CLASSE PRINCIPALE PERSONNAGE — ApplicationV2 ==========
// Feuille personnage ADD2E full ApplicationV2 : aucun héritage appv1, aucun pont ActorSheet.
// Le contexte rendu utilise une vue isolée du système de l'acteur.

const ADD2E_ACTOR_SHEET_V2_VERSION = "2026-06-25-application-v2-isolated-context-v8";
const ADD2E_ACTOR_SHEET_V2_CSS_ID = "add2e-application-v2-character-sheet-css";
const ADD2E_ACTOR_SHEET_V2_CSS_PATH = "systems/add2e/styles/application-v2-character-sheet.css";

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

function add2eGetElementForApplicationV2(sheet) {
  const element = sheet?.element;
  if (!element) return null;
  return element.jquery ? element[0] : element;
}

function add2eCloneSheetValue(value) {
  if (value === undefined || value === null) return value;
  if (foundry?.utils?.deepClone) return foundry.utils.deepClone(value);
  if (foundry?.utils?.duplicate) return foundry.utils.duplicate(value);
  return JSON.parse(JSON.stringify(value));
}

/**
 * Vue utilisée par les templates. Le document reste disponible dans
 * context.document ; les enrichissements de getData ne peuvent ainsi jamais
 * muter actor.system pendant un rendu.
 */
function add2eBuildActorSheetView(actor) {
  if (!actor) return null;
  return {
    id: actor.id,
    _id: actor.id,
    uuid: actor.uuid,
    name: actor.name,
    img: actor.img,
    type: actor.type,
    system: add2eCloneSheetValue(actor.system ?? {}),
    flags: add2eCloneSheetValue(actor.flags ?? {}),
    items: actor.items,
    effects: actor.effects,
    ownership: add2eCloneSheetValue(actor.ownership ?? {}),
    isOwner: actor.isOwner === true,
    hasPlayerOwner: actor.hasPlayerOwner === true,
    limited: actor.limited === true
  };
}

function add2eEnsureApplicationV2CharacterCss() {
  try {
    if (document.getElementById(ADD2E_ACTOR_SHEET_V2_CSS_ID)) return true;
    const href = `${ADD2E_ACTOR_SHEET_V2_CSS_PATH}?v=${encodeURIComponent(ADD2E_ACTOR_SHEET_V2_VERSION)}`;
    const link = document.createElement("link");
    link.id = ADD2E_ACTOR_SHEET_V2_CSS_ID;
    link.rel = "stylesheet";
    link.type = "text/css";
    link.href = href;
    document.head.appendChild(link);
    console.log("[ADD2E][ACTOR_SHEET][APPLICATION_V2_CSS] injected", href);
    return true;
  } catch (error) {
    console.warn("[ADD2E][ACTOR_SHEET][APPLICATION_V2_CSS] injection impossible", error);
    return false;
  }
}

function add2eBindApplicationV2Close(sheet) {
  try {
    const root = add2eGetElementForApplicationV2(sheet);
    if (!root || root.dataset.add2eCloseBound === "1") return;
    root.dataset.add2eCloseBound = "1";

    root.addEventListener("click", event => {
      const button = event.target?.closest?.('[data-action="close"], .header-control.close, .window-header .close, .window-close');
      if (!button || !root.contains(button)) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      sheet.close({ force: true });
    }, true);
  } catch (error) {
    console.warn("[ADD2E][ACTOR_SHEET][APPLICATION_V2_CLOSE] binding impossible", error);
  }
}

class Add2eActorSheet extends ADD2E_ACTOR_SHEET_BASE {
  static ADD2E_APPLICATION_V2_VERSION = ADD2E_ACTOR_SHEET_V2_VERSION;

  static DEFAULT_OPTIONS = {
    id: "add2e-personnage-{id}",
    classes: ["add2e", "sheet", "actor", "personnage", "add2e-character-v2-app"],
    tag: "form",
    position: { width: 1050, height: 900 },
    window: {
      title: "ADD2e Personnage",
      resizable: true
    },
    form: {
      submitOnChange: true,
      closeOnSubmit: false,
      handler: Add2eActorSheet._add2eSubmitForm
    }
  };

  static PARTS = {
    main: { template: "systems/add2e/templates/actor/character-sheet.hbs" }
  };

  static async _add2eSubmitForm(event, form, formData) {
    const app = this;
    const actor = app?.actor ?? app?.document;
    if (!actor?.update) return;

    const expanded = foundry.utils.expandObject(formData?.object ?? {});
    const updateData = {};

    if (expanded.system) updateData.system = expanded.system;
    if (typeof expanded.name === "string" && expanded.name.trim()) updateData.name = expanded.name.trim();
    if (typeof expanded.img === "string") updateData.img = expanded.img;
    if (expanded.flags) updateData.flags = expanded.flags;

    if (Object.keys(updateData).length) await actor.update(updateData);
  }

  async _prepareContext(options = {}) {
    add2eEnsureApplicationV2CharacterCss();
    const context = await this.getData(options);
    context.document = this.document;
    context.actor ??= add2eBuildActorSheetView(this.document);
    context.owner = this.document?.isOwner ?? false;
    context.editable = this.isEditable;
    context.options = this.options ?? {};
    return context;
  }

  async _preparePartContext(_partId, context, _options = {}) { return context; }

  async _onRender(context, options = {}) {
    await super._onRender?.(context, options);
    add2eEnsureApplicationV2CharacterCss();
    add2eBindApplicationV2Close(this);
    const html = add2eAsJQuery(add2eGetElementForApplicationV2(this));
    if (!html.length) return;

    try { this.activateListeners?.(html); }
    catch (error) { console.warn("[ADD2E][ACTOR_SHEET_V2][LISTENERS] Erreur activateListeners", error); }

    try { add2eEnhanceCharacterSheetUi?.(this, html); } catch (_error) {}
    try { this._add2eActivateTab?.(this._add2eActiveTab || this._add2eReadStoredTab?.() || "resume", html); } catch (_error) {}
  }

  async close(options = {}) {
    this._add2eClosing = true;
    try {
      return await super.close(options);
    } finally {
      this._add2eClosing = false;
    }
  }

  async _onDrop(event) {
    event?.preventDefault?.();
    return false;
  }

  _add2eNativeGetData() {
    const actor = this.document;
    const actorView = add2eBuildActorSheetView(actor);
    return {
      actor: actorView,
      document: actor,
      data: actorView?.system ?? {},
      system: actorView?.system ?? {},
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
    if (this._add2eClosing) return this;
    const renderOptions = (typeof force === "object" && force !== null)
      ? force
      : { ...(options ?? {}), force: !!force };
    return super.render(renderOptions);
  }

  _add2eGetNativeActiveTab() { return this._add2eActiveTab || this._add2eReadStoredTab?.() || null; }
  _add2eSetNativeActiveTab(tab) { if (tab) this._add2eActiveTab = tab; }

  _onChangeTab(event, tabs, active) {
    super._onChangeTab?.(event, tabs, active);
    if (!active) return;
    this._add2eActiveTab = active;
    this._add2eSetNativeActiveTab(active);
    try { sessionStorage.setItem(this._add2eTabStorageKey(), active); } catch (_error) {}
  }
}

try {
  globalThis.ADD2E_ACTOR_SHEET_V2_VERSION = ADD2E_ACTOR_SHEET_V2_VERSION;
  globalThis.ADD2E_ACTOR_SHEET_V2_CSS_PATH = ADD2E_ACTOR_SHEET_V2_CSS_PATH;
  globalThis.add2eEnsureApplicationV2CharacterCss = add2eEnsureApplicationV2CharacterCss;
  globalThis.add2eBindApplicationV2Close = add2eBindApplicationV2Close;
  globalThis.add2eBuildActorSheetView = add2eBuildActorSheetView;
  globalThis.Add2eActorSheet = Add2eActorSheet;
  delete globalThis.ADD2E_ACTOR_SHEET_LEGACY_BRIDGE;
} catch (_error) {}

add2eEnsureApplicationV2CharacterCss();
console.log("[ADD2E][ACTOR_SHEET][APPLICATION_V2_FULL]", ADD2E_ACTOR_SHEET_V2_VERSION);