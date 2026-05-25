// ========== CLASSE PRINCIPALE PERSONNAGE — ApplicationV2 ==========
// Feuille personnage ADD2E full ApplicationV2 : aucun héritage appv1, aucun pont ActorSheet.

const ADD2E_ACTOR_SHEET_V2_VERSION = "2026-05-25-application-v2-token-header-v2";
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
  const el = sheet?.element;
  if (!el) return null;
  return el.jquery ? el[0] : el;
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
  } catch (err) {
    console.warn("[ADD2E][ACTOR_SHEET][APPLICATION_V2_CSS] injection impossible", err);
    return false;
  }
}

function add2eBindApplicationV2Close(sheet) {
  try {
    const root = add2eGetElementForApplicationV2(sheet);
    if (!root || root.dataset.add2eCloseBound === "1") return;
    root.dataset.add2eCloseBound = "1";

    root.addEventListener("click", ev => {
      const btn = ev.target?.closest?.('[data-action="close"], .header-control.close, .window-header .close, .window-close');
      if (!btn || !root.contains(btn)) return;
      ev.preventDefault();
      ev.stopPropagation();
      ev.stopImmediatePropagation?.();
      sheet.close({ force: true });
    }, true);
  } catch (err) {
    console.warn("[ADD2E][ACTOR_SHEET][APPLICATION_V2_CLOSE] binding impossible", err);
  }
}

function add2eTokenConfigPosition(sheet) {
  const options = { parent: sheet?.actor ?? sheet?.document ?? null };
  const pos = sheet?.position ?? {};
  if (Number.isFinite(pos.top)) options.top = pos.top + 40;
  if (Number.isFinite(pos.left) && Number.isFinite(pos.width)) options.left = pos.left + Math.max(0, Math.floor((pos.width - 460) / 2));
  return options;
}

async function add2eTryRenderTokenConfig(createApp) {
  try {
    const app = createApp?.();
    if (!app?.render) return false;
    await app.render(true);
    return true;
  } catch (err) {
    console.warn("[ADD2E][ACTOR_SHEET_V2][TOKEN_CONFIG][TRY_FAILED]", err);
    return false;
  }
}

async function add2eOpenPrototypeTokenConfig(sheet, event = null) {
  const actor = sheet?.actor ?? sheet?.document;
  if (!actor) return ui.notifications?.warn?.("Aucun acteur associé à cette feuille.");

  if (!(game.user?.isGM || actor.isOwner)) {
    return ui.notifications?.warn?.("Vous n'avez pas les droits nécessaires pour modifier le prototype de token.");
  }

  event?.preventDefault?.();
  event?.stopPropagation?.();

  try {
    if (typeof sheet._onConfigureToken === "function") {
      await sheet._onConfigureToken(event);
      return;
    }

    if (typeof sheet._configureToken === "function") {
      await sheet._configureToken(event);
      return;
    }

    const token = actor.prototypeToken ?? actor.prototypeTokenDocument;
    if (!token) return ui.notifications?.warn?.("Prototype de token introuvable pour cet acteur.");

    const options = add2eTokenConfigPosition(sheet);
    const PrototypeTokenConfigClass =
      foundry?.applications?.sheets?.PrototypeTokenConfig
      ?? CONFIG?.Token?.prototypeSheetClass
      ?? globalThis.PrototypeTokenConfig;
    const TokenConfigClass =
      foundry?.applications?.sheets?.TokenConfig
      ?? CONFIG?.Token?.sheetClass
      ?? globalThis.TokenConfig;

    if (PrototypeTokenConfigClass) {
      if (await add2eTryRenderTokenConfig(() => new PrototypeTokenConfigClass({ document: token, parent: actor, ...options }))) return;
      if (await add2eTryRenderTokenConfig(() => new PrototypeTokenConfigClass(token, { parent: actor, ...options }))) return;
      if (await add2eTryRenderTokenConfig(() => new PrototypeTokenConfigClass(actor, { parent: actor, ...options }))) return;
    }

    if (token.sheet?.render) {
      try {
        await token.sheet.render(true, { parent: actor, ...options });
        return;
      } catch (err) {
        console.warn("[ADD2E][ACTOR_SHEET_V2][TOKEN_CONFIG][TOKEN_SHEET_FAILED]", err);
      }
    }

    if (TokenConfigClass) {
      if (await add2eTryRenderTokenConfig(() => new TokenConfigClass(token, { parent: actor, ...options }))) return;
      if (await add2eTryRenderTokenConfig(() => new TokenConfigClass({ document: token, parent: actor, ...options }))) return;
    }

    return ui.notifications?.error?.("Impossible d'ouvrir la configuration du prototype de token.");
  } catch (err) {
    console.error("[ADD2E][ACTOR_SHEET_V2][TOKEN_CONFIG][ERROR]", err);
    return ui.notifications?.error?.("Erreur à l'ouverture du prototype de token. Voir la console.");
  }
}

function add2eEnsureTokenHeaderControl(sheet) {
  try {
    const root = add2eGetElementForApplicationV2(sheet);
    const header = root?.querySelector?.(".window-header");
    if (!header || header.dataset.add2eTokenControl === "1") return;
    header.dataset.add2eTokenControl = "1";

    const controls = header.querySelector(".window-controls, .header-controls") ?? header;
    const before = controls.querySelector('[data-action="close"], .close, .window-close');
    const button = document.createElement("button");
    button.type = "button";
    button.className = "header-control icon fa-solid fa-user-circle add2e-token-config";
    button.dataset.action = "add2e-token-config";
    button.title = "Configurer le prototype de token";
    button.setAttribute("aria-label", "Configurer le prototype de token");
    button.innerHTML = '<i class="fa-solid fa-user-circle"></i>';
    button.addEventListener("click", ev => add2eOpenPrototypeTokenConfig(sheet, ev), true);

    if (before?.parentElement === controls) controls.insertBefore(button, before);
    else controls.appendChild(button);
  } catch (err) {
    console.warn("[ADD2E][ACTOR_SHEET_V2][TOKEN_CONFIG][HEADER_CONTROL] impossible", err);
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
      resizable: true,
      controls: [
        {
          action: "add2e-token-config",
          icon: "fa-solid fa-user-circle",
          label: "Prototype de token",
          visible: true
        }
      ]
    },
    form: {
      submitOnChange: true,
      closeOnSubmit: false,
      handler: Add2eActorSheet._add2eSubmitForm
    },
    actions: {
      "add2e-token-config": Add2eActorSheet._add2eConfigurePrototypeToken
    }
  };

  static PARTS = {
    main: { template: "systems/add2e/templates/actor/character-sheet.hbs" }
  };

  static async _add2eConfigurePrototypeToken(event) {
    const sheet = this;
    return add2eOpenPrototypeTokenConfig(sheet, event);
  }

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

  get actor() { return this.document; }
  get object() { return this.document; }
  get isEditable() { return this.options?.editable ?? this.document?.isOwner ?? false; }

  async _prepareContext(options = {}) {
    add2eEnsureApplicationV2CharacterCss();
    const context = await this.getData(options);
    context.document = this.document;
    context.actor = this.document;
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
    add2eEnsureTokenHeaderControl(this);
    const html = add2eAsJQuery(add2eGetElementForApplicationV2(this));
    if (!html.length) return;

    try { this.activateListeners?.(html); }
    catch (err) { console.warn("[ADD2E][ACTOR_SHEET_V2][LISTENERS] Erreur activateListeners", err); }

    try { add2eEnhanceCharacterSheetUi?.(this, html); } catch (_err) {}
    try { this._add2eActivateTab?.(this._add2eActiveTab || this._add2eReadStoredTab?.() || "resume", html); } catch (_err) {}
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
    try { sessionStorage.setItem(this._add2eTabStorageKey(), active); } catch (_e) {}
  }
}

try {
  globalThis.ADD2E_ACTOR_SHEET_V2_VERSION = ADD2E_ACTOR_SHEET_V2_VERSION;
  globalThis.ADD2E_ACTOR_SHEET_V2_CSS_PATH = ADD2E_ACTOR_SHEET_V2_CSS_PATH;
  globalThis.add2eEnsureApplicationV2CharacterCss = add2eEnsureApplicationV2CharacterCss;
  globalThis.add2eBindApplicationV2Close = add2eBindApplicationV2Close;
  globalThis.add2eEnsureTokenHeaderControl = add2eEnsureTokenHeaderControl;
  globalThis.add2eOpenPrototypeTokenConfig = add2eOpenPrototypeTokenConfig;
  globalThis.Add2eActorSheet = Add2eActorSheet;
  delete globalThis.ADD2E_ACTOR_SHEET_LEGACY_BRIDGE;
} catch (_e) {}

add2eEnsureApplicationV2CharacterCss();
console.log("[ADD2E][ACTOR_SHEET][APPLICATION_V2_FULL]", ADD2E_ACTOR_SHEET_V2_VERSION);