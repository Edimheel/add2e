// ADD2E — Feuille Dummy minimale.
// Compatible Foundry V13/V14/V15, ApplicationV2 uniquement.

const DUMMY_SHEET_VERSION = "2026-07-06-dummy-actor-layout-v2";
const DUMMY_TYPE = "dummy";
const ActorsCollection = foundry?.documents?.collections?.Actors;
const AppApi = foundry?.applications?.api ?? {};
const SheetsApi = foundry?.applications?.sheets ?? {};
const HandlebarsApplicationMixin = AppApi.HandlebarsApplicationMixin;
const DocumentSheetV2 = SheetsApi.ActorSheetV2 ?? SheetsApi.DocumentSheetV2 ?? AppApi.DocumentSheetV2;

if (!HandlebarsApplicationMixin) throw new Error("[ADD2E][DUMMY] HandlebarsApplicationMixin introuvable.");
if (!DocumentSheetV2) throw new Error("[ADD2E][DUMMY] ActorSheetV2/DocumentSheetV2 introuvable.");
if (!ActorsCollection) throw new Error("[ADD2E][DUMMY] Collection Actors introuvable.");

globalThis.ADD2E_DUMMY_SHEET_VERSION = DUMMY_SHEET_VERSION;

const DummySheetBase = HandlebarsApplicationMixin(DocumentSheetV2);

function clone(value) {
  if (typeof foundry?.utils?.deepClone === "function") return foundry.utils.deepClone(value);
  if (typeof foundry?.utils?.duplicate === "function") return foundry.utils.duplicate(value);
  return JSON.parse(JSON.stringify(value ?? {}));
}

function actorView(actor) {
  return {
    id: actor?.id,
    _id: actor?.id,
    uuid: actor?.uuid,
    name: actor?.name ?? "",
    img: actor?.img ?? "icons/svg/mystery-man.svg",
    type: actor?.type,
    system: clone(actor?.system ?? {}),
    flags: clone(actor?.flags ?? {}),
    isOwner: actor?.isOwner === true,
    limited: actor?.limited === true
  };
}

async function chooseImage(actor) {
  const Picker = globalThis.FilePicker;
  if (!actor?.update || !Picker) return false;

  new Picker({
    type: "image",
    current: actor.img,
    callback: async path => {
      if (!path) return;
      await actor.update({ img: path, "prototypeToken.texture.src": path }, { add2eReason: "dummy-image" });
    }
  }).render(true);
  return true;
}

export class Add2eDummySheet extends DummySheetBase {
  static DEFAULT_OPTIONS = {
    id: "add2e-dummy-{id}",
    classes: ["add2e", "sheet", "actor", "dummy", "add2e-dummy-v2-app"],
    tag: "form",
    position: { width: 820, height: 640 },
    window: { title: "Dummy", resizable: true },
    form: {
      submitOnChange: true,
      closeOnSubmit: false,
      handler: Add2eDummySheet._onSubmitForm
    }
  };

  static PARTS = {
    main: { template: "systems/add2e/templates/actor/dummy-sheet.hbs" }
  };

  get title() {
    const actor = this.document ?? this.actor;
    const name = String(actor?.name ?? "").trim();
    return name ? `Dummy : ${name}` : "Dummy";
  }

  static async _onSubmitForm(_event, _form, formData) {
    const app = this;
    const actor = app?.document ?? app?.actor;
    if (!actor?.update) return;

    const expanded = foundry.utils.expandObject(formData?.object ?? {});
    const notes = typeof expanded?.system?.notes === "string" ? expanded.system.notes : "";
    if (String(actor.system?.notes ?? "") === notes) return;
    await actor.update({ "system.notes": notes }, { add2eReason: "dummy-notes" });
  }

  async _prepareContext(_options = {}) {
    const actor = this.document ?? this.actor;
    const view = actorView(actor);
    return {
      actor: view,
      system: view.system,
      document: actor,
      owner: actor?.isOwner === true,
      editable: this.isEditable,
      options: this.options ?? {}
    };
  }

  async _preparePartContext(_partId, context, _options = {}) {
    return context;
  }

  async _onRender(context, options = {}) {
    await super._onRender?.(context, options);
    const root = this.element?.jquery ? this.element[0] : this.element;
    if (!(root instanceof HTMLElement) || root.dataset.add2eDummyListeners === DUMMY_SHEET_VERSION) return;
    root.dataset.add2eDummyListeners = DUMMY_SHEET_VERSION;

    root.addEventListener("click", event => {
      const button = event.target?.closest?.('[data-action="select-image"]');
      if (!button || !root.contains(button)) return;
      event.preventDefault();
      event.stopImmediatePropagation?.();
      chooseImage(this.document ?? this.actor).catch(error => console.warn("[ADD2E][DUMMY][IMAGE]", error));
    }, true);
  }

  async _onDrop(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    return false;
  }
}

ActorsCollection.registerSheet("add2e", Add2eDummySheet, {
  types: [DUMMY_TYPE],
  makeDefault: true,
  label: "ADD2e — Dummy"
});

try { globalThis.Add2eDummySheet = Add2eDummySheet; } catch (_error) {}
