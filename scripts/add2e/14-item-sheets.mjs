const ADD2E_ITEM_SHEETS_VERSION = "2026-06-16-item-sheets-sort-canonical-display-v1";
globalThis.ADD2E_ITEM_SHEETS_VERSION = ADD2E_ITEM_SHEETS_VERSION;

const { ApplicationV2 } = foundry.applications.api;

function add2eItemsCollection() {
  return foundry.documents.collections.Items;
}

function add2eGetTextEditorImplementation() {
  return foundry.applications.ux.TextEditor?.implementation ?? null;
}

function add2eGetFilePickerClass() {
  return foundry.applications.apps.FilePicker ?? null;
}

async function add2eRenderTemplate(path, data) {
  return foundry.applications.handlebars.renderTemplate(path, data);
}

async function add2eEnrichDescription(raw, item = null) {
  const text = String(raw ?? "").trim();
  if (!text) return "";
  const editor = add2eGetTextEditorImplementation();
  if (!editor?.enrichHTML) return text;
  try {
    return await editor.enrichHTML(text, { async: true, relativeTo: item ?? undefined });
  } catch (_err) {
    return text;
  }
}

function add2ePlainValue(value) {
  if (value === "on") return true;
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}

function add2eCollectFormData(root) {
  const form = root?.matches?.("form") ? root : root?.querySelector?.("form");
  if (!form) return {};

  const flat = Object.fromEntries(new FormData(form).entries());

  for (const checkbox of form.querySelectorAll('input[type="checkbox"][name]')) {
    flat[checkbox.name] = checkbox.checked;
  }

  for (const [key, value] of Object.entries(flat)) flat[key] = add2ePlainValue(value);
  return foundry.utils.expandObject(flat);
}

function add2eMergeCleanName(item, updateData) {
  if (!updateData || typeof updateData !== "object") return updateData;
  if (Object.prototype.hasOwnProperty.call(updateData, "name")) {
    updateData.name = String(updateData.name ?? "").trim() || item?.name || "Item";
  }
  return updateData;
}

function add2eRegisterImgPicker(root, sheet) {
  const item = sheet?.item ?? sheet?.document ?? sheet?.object;
  if (!root?.querySelector || !item) return;

  for (const img of root.querySelectorAll('img[data-edit="img"]')) {
    img.addEventListener("click", ev => {
      ev.preventDefault();
      const FilePicker = add2eGetFilePickerClass();
      if (!FilePicker) return;
      new FilePicker({
        type: "image",
        current: item.img,
        callback: path => {
          item.update({ img: path });
          img.src = path;
          root.querySelector('input[name="img"]')?.setAttribute("value", path);
        }
      }).render(true);
    });
  }
}

function add2eToArrayForSheet(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(v => v !== undefined && v !== null && String(v).trim() !== "");
  if (typeof value === "object") return Object.values(value).filter(v => v !== undefined && v !== null && String(v).trim() !== "");
  if (typeof value === "string") return value.split(/[,;|\n]+/).map(v => v.trim()).filter(Boolean);
  return [];
}

function add2eIsFilledSheetValue(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

function add2eSheetGetProperty(source, path) {
  if (!source || !path) return undefined;
  try {
    if (foundry?.utils?.getProperty) return foundry.utils.getProperty(source, path);
  } catch (_err) {}
  const parts = String(path).split(".");
  let cur = source;
  for (const part of parts) {
    if (cur === undefined || cur === null) return undefined;
    cur = cur[part];
  }
  return cur;
}

function add2eFormatSheetFieldValue(value) {
  if (!add2eIsFilledSheetValue(value)) return "";
  if (Array.isArray(value)) return value.map(v => add2eFormatSheetFieldValue(v)).filter(Boolean).join(", ");
  if (typeof value === "object") {
    const raw = value.raw ?? value.texte ?? value.text ?? value.label ?? value.nom ?? value.name;
    if (add2eIsFilledSheetValue(raw)) return String(raw).trim();
    const valeur = value.valeur ?? value.value ?? value.nombre ?? value.number ?? "";
    const unite = value.unite ?? value.unit ?? "";
    const joined = `${valeur ?? ""}${unite ? ` ${unite}` : ""}`.trim();
    if (joined) return joined;
    return Object.values(value).map(v => add2eFormatSheetFieldValue(v)).filter(Boolean).join(", ");
  }
  return String(value).trim();
}

function add2eFirstSheetField(system, aliases, fallback = "") {
  for (const alias of aliases) {
    const value = add2eSheetGetProperty(system, alias);
    if (add2eIsFilledSheetValue(value)) return add2eFormatSheetFieldValue(value);
  }
  return fallback;
}

function add2eCloneSheetSystem(system) {
  try {
    if (foundry?.utils?.deepClone) return foundry.utils.deepClone(system ?? {});
    if (foundry?.utils?.duplicate) return foundry.utils.duplicate(system ?? {});
  } catch (_err) {}
  try { return JSON.parse(JSON.stringify(system ?? {})); }
  catch (_err) { return { ...(system ?? {}) }; }
}

function add2eBuildSortSheetSystem(system) {
  const source = system ?? {};
  const sheet = add2eCloneSheetSystem(source);
  sheet.ecole = add2eFirstSheetField(source, ["ecole", "école", "school"], sheet.ecole ?? "");
  sheet.portee = add2eFirstSheetField(source, ["portee", "portée", "range"], sheet.portee ?? "");
  sheet.duree = add2eFirstSheetField(source, ["duree", "durée", "duration"], sheet.duree ?? "");
  sheet.temps_incantation = add2eFirstSheetField(source, ["temps_incantation", "tempsIncantation", "castingTime", "casting_time"], sheet.temps_incantation ?? "");
  sheet.zone_effet = add2eFirstSheetField(source, ["zone_effet", "zoneEffet", "area", "areaOfEffect"], sheet.zone_effet ?? "");
  sheet.composantes = add2eFirstSheetField(source, ["composantes", "components", "componentes", "composants"], sheet.composantes ?? "");
  sheet.jet_sauvegarde = add2eFirstSheetField(source, ["jet_sauvegarde", "jetSauvegarde", "savingThrow", "saving_throw"], sheet.jet_sauvegarde ?? "");
  sheet.onUse = add2eFirstSheetField(source, ["onUse", "onuse", "on_use"], sheet.onUse ?? "");
  sheet.description = add2eFirstSheetField(source, ["description", "description_reelle", "description_texte", "description_html"], sheet.description ?? "");
  return sheet;
}

function add2eRootFromContent(content) {
  if (content instanceof HTMLElement) return content;
  if (content?.[0] instanceof HTMLElement) return content[0];
  return null;
}

function add2eCurrentActiveTab(root) {
  return root.querySelector(".sheet-tabs .active[data-tab], .tabs .active[data-tab]")?.dataset?.tab
    ?? root.querySelector(".tab.active[data-tab], .content:not(.hidden)[data-tab]")?.dataset?.tab
    ?? root.querySelector(".sheet-tabs [data-tab], .tabs [data-tab]")?.dataset?.tab
    ?? root.querySelector("[data-tab]")?.dataset?.tab
    ?? "";
}

function add2eActivateSheetTab(root, tab) {
  if (!root || !tab) return;

  root.querySelectorAll(".sheet-tabs [data-tab], .tabs [data-tab]").forEach(link => {
    link.classList.toggle("active", link.dataset.tab === tab);
  });

  root.querySelectorAll(".sheet-body .tab[data-tab], .sheet-body .content[data-tab], .tab[data-tab], .content[data-tab]").forEach(panel => {
    const active = panel.dataset.tab === tab;
    panel.classList.toggle("active", active);
    panel.classList.toggle("hidden", !active);
    panel.style.display = active ? "" : "none";
  });
}

function add2eInstallSheetTabs(root) {
  if (!root?.querySelector) return;
  const links = [...root.querySelectorAll(".sheet-tabs [data-tab], .tabs [data-tab]")];
  if (!links.length) return;

  const initial = add2eCurrentActiveTab(root);
  add2eActivateSheetTab(root, initial);

  for (const link of links) {
    link.addEventListener("click", ev => {
      ev.preventDefault();
      ev.stopPropagation();
      add2eActivateSheetTab(root, ev.currentTarget.dataset.tab);
    });
  }
}

function add2eApplyV2SheetLayout(root, app) {
  if (!root?.querySelector) return;

  const content = app?.element?.querySelector?.(".window-content")
    ?? root.closest?.(".window-content")
    ?? root.parentElement;

  if (content) {
    content.style.overflow = "hidden";
    content.style.padding = "0";
    content.style.minHeight = "0";
  }

  const form = root.matches?.("form") ? root : root.querySelector?.("form");
  const sheetRoot = form ?? root.firstElementChild ?? root;

  if (sheetRoot) {
    sheetRoot.classList.add("add2e-v2-sheet-layout");
    sheetRoot.style.height = "100%";
    sheetRoot.style.minHeight = "0";
    sheetRoot.style.display = "flex";
    sheetRoot.style.flexDirection = "column";
    sheetRoot.style.overflow = "hidden";
  }

  const header = sheetRoot?.querySelector?.(".sheet-header, header");
  const tabs = sheetRoot?.querySelector?.(".sheet-tabs, .tabs");
  const body = sheetRoot?.querySelector?.(".sheet-body");

  if (header) header.style.flex = "0 0 auto";
  if (tabs) tabs.style.flex = "0 0 auto";

  if (body) {
    body.style.flex = "1 1 auto";
    body.style.minHeight = "0";
    body.style.overflow = "auto";
    body.style.position = "relative";
  } else if (sheetRoot) {
    sheetRoot.style.overflow = "auto";
  }

  for (const panel of sheetRoot?.querySelectorAll?.(".sheet-body .tab, .sheet-body .content") ?? []) {
    panel.style.maxWidth = "100%";
  }
}

class Add2eItemSheetV2 extends ApplicationV2 {
  static TEMPLATE = "";
  static DEFAULT_OPTIONS = {
    classes: ["add2e", "sheet", "item"],
    tag: "section",
    window: { title: "ADD2E Item", resizable: true },
    position: { width: 500, height: 500 }
  };

  constructor(document, options = {}) {
    super({
      id: `add2e-${document?.type ?? "item"}-sheet-${document?.id ?? foundry.utils.randomID()}`,
      ...options
    });
    this.object = document;
    this.document = document;
    this.item = document;
  }

  get title() {
    return this.item?.name ?? super.title;
  }

  get editable() {
    return this.item?.isOwner === true || game.user?.isGM === true;
  }

  render(options = {}) {
    if (typeof options === "boolean") return super.render({ force: options });
    return super.render(options);
  }

  async getData(_options = {}) {
    const item = this.item;
    const system = item?.system ?? {};
    return {
      item,
      document: item,
      object: item,
      system,
      editable: this.editable,
      owner: item?.isOwner,
      limited: item?.limited,
      options: this.options,
      cssClass: this.editable ? "editable" : "locked",
      name: item?.name ?? "",
      img: item?.img || "icons/svg/mystery-man.svg",
      descriptionHTML: await add2eEnrichDescription(system?.description, item)
    };
  }

  async _renderHTML(_context, options) {
    const data = await this.getData(options);
    const html = await add2eRenderTemplate(this.constructor.TEMPLATE, data);
    const wrapper = document.createElement("div");
    wrapper.classList.add("add2e-v2-render-root");
    wrapper.innerHTML = html;
    return wrapper;
  }

  _replaceHTML(result, content, _options) {
    content.replaceChildren(...result.childNodes);
    add2eApplyV2SheetLayout(add2eRootFromContent(content), this);
    this.activateListeners(content);
  }

  activateListeners(content) {
    const root = add2eRootFromContent(content);
    if (!root) return;
    add2eApplyV2SheetLayout(root, this);
    add2eInstallSheetTabs(root);
    add2eRegisterImgPicker(root, this);
    this._activateAutoSubmit(root);
  }

  _activateAutoSubmit(root) {
    const form = root.matches?.("form") ? root : root.querySelector?.("form");
    if (!form || !this.editable) return;

    const submit = async event => {
      event?.preventDefault?.();
      const updateData = add2eMergeCleanName(this.item, add2eCollectFormData(form));
      await this._updateObject(event, updateData);
    };

    form.addEventListener("submit", submit);
    for (const input of form.querySelectorAll("input, textarea, select")) {
      input.addEventListener("change", submit);
    }
  }

  async _updateObject(_event, updateData) {
    if (!this.item || !this.editable) return;
    await this.item.update(updateData);
  }
}

class Add2eArmureSheet extends Add2eItemSheetV2 {
  static TEMPLATE = "systems/add2e/templates/item/armure-sheet.hbs";
  static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
    classes: ["add2e", "sheet", "item", "armure"],
    window: { title: "ADD2E Armure", resizable: true },
    position: { width: 560, height: 520 }
  }, { inplace: false });

  activateListeners(content) {
    super.activateListeners(content);
    const root = add2eRootFromContent(content);
    root?.querySelector?.(".toggle-equip")?.addEventListener("click", async ev => {
      ev.preventDefault();
      await this.item.update({ "system.equipee": !this.item.system.equipee });
      this.render({ force: true });
    });
  }
}

globalThis.Add2eArmureSheet = Add2eArmureSheet;
add2eItemsCollection().registerSheet("add2e", Add2eArmureSheet, {
  types: ["armure"],
  makeDefault: true,
  label: "ADD2e Armure"
});

class Add2eObjetSheet extends Add2eItemSheetV2 {
  static TEMPLATE = "systems/add2e/templates/item/objet-sheet.hbs";
  static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
    classes: ["add2e", "sheet", "item", "objet", "objet-magique"],
    window: { title: "ADD2E Objet", resizable: true },
    position: { width: 820, height: 760 }
  }, { inplace: false });

  async getData(options = {}) {
    const data = await super.getData(options);
    const system = data.system ?? {};
    const powersRaw = system.pouvoirs ?? system.powers ?? system.pouvoirsMagiques ?? system.magicalPowers ?? [];
    data.pouvoirs = Array.isArray(powersRaw)
      ? powersRaw.filter(p => p && typeof p === "object")
      : (powersRaw && typeof powersRaw === "object" ? Object.values(powersRaw).filter(p => p && typeof p === "object") : []);
    data.tags = add2eToArrayForSheet(system.tags);
    data.effectTags = add2eToArrayForSheet(system.effectTags ?? system.effets ?? system.effects);
    data.charges = {
      value: Number(system.charges?.value ?? system.chargesValeur ?? system.current_charges ?? system.currentCharges ?? 0) || 0,
      max: Number(system.charges?.max ?? system.max_charges ?? system.maxCharges ?? system.charges_max ?? 0) || 0
    };
    data.isMagicItem = system.magique === true || system.magic === true || String(system.categorie ?? "").toLowerCase().includes("magique");
    return data;
  }
}

globalThis.Add2eObjetSheet = Add2eObjetSheet;
add2eItemsCollection().registerSheet("add2e", Add2eObjetSheet, {
  types: ["objet"],
  makeDefault: true,
  canConfigure: true,
  canBeDefault: true,
  label: "ADD2e Objet"
});

class Add2eArmeSheet extends Add2eItemSheetV2 {
  static TEMPLATE = "systems/add2e/templates/item/arme-sheet.hbs";
  static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
    classes: ["add2e", "sheet", "item", "arme"],
    window: { title: "ADD2E Arme", resizable: true },
    position: { width: 560, height: 520 }
  }, { inplace: false });
}

globalThis.Add2eArmeSheet = Add2eArmeSheet;
add2eItemsCollection().registerSheet("add2e", Add2eArmeSheet, {
  types: ["arme"],
  makeDefault: true,
  label: "ADD2e Arme"
});

class Add2eSortSheet extends Add2eItemSheetV2 {
  static TEMPLATE = "systems/add2e/templates/item/sort-sheet.hbs";
  static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
    classes: ["add2e", "sheet", "item", "sort"],
    window: { title: "ADD2E Sort", resizable: true },
    position: { width: 640, height: 720 }
  }, { inplace: false });

  async getData(options = {}) {
    const data = await super.getData(options);
    data.system = add2eBuildSortSheetSystem(data.system ?? {});
    data.system.number ??= "";
    data.system.diet ??= "";
    data.system.encounterTable ??= "";
    data.listeArmes = [];
    data.listeArmures = [];
    data.listeSorts = [];

    if (this.item?.parent?.documentName === "Actor") {
      const actorItems = this.item.parent.items || [];
      data.listeArmes = actorItems.filter(i => i.type === "arme");
      data.listeArmures = actorItems.filter(i => i.type === "armure");
      data.listeSorts = actorItems.filter(i => i.type === "sort");
    }

    const sortsParNiveau = {};
    for (const sort of data.listeSorts) {
      let niveau = Number(sort.system?.niveau || sort.system?.level || 1);
      if (!niveau || isNaN(niveau)) niveau = 1;
      if (!sortsParNiveau[niveau]) sortsParNiveau[niveau] = [];
      sortsParNiveau[niveau].push(sort);
    }
    data.sortsParNiveau = sortsParNiveau;
    data.niveauxSorts = Object.keys(sortsParNiveau).map(Number).sort((a, b) => a - b);
    data.sortsMemorizedByLevel = {};
    data.descriptionHTML = await add2eEnrichDescription(data.system?.description, this.item);
    return data;
  }
}

globalThis.Add2eSortSheet = Add2eSortSheet;
add2eItemsCollection().registerSheet("add2e", Add2eSortSheet, {
  types: ["sort"],
  makeDefault: true,
  label: "ADD2e Sort"
});

class Add2eRaceSheet extends Add2eItemSheetV2 {
  static TEMPLATE = "systems/add2e/templates/item/race-sheet.hbs";
  static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
    classes: ["add2e", "sheet", "item", "race-sheet-modern"],
    window: { title: "ADD2E Race", resizable: true },
    position: { width: 760, height: 760 }
  }, { inplace: false });

  async getData(options = {}) {
    const data = await super.getData(options);
    const toArray = obj => Array.isArray(obj)
      ? obj
      : typeof obj === "object" && obj !== null
        ? Object.entries(obj).filter(([k, v]) => !["NEW", "NEW_KEY", "NEW_VAL"].includes(k) && v !== "" && v !== null && v !== undefined).map(([, v]) => v)
        : [];

    data.system.capacites = toArray(data.system.capacites);
    if (typeof data.system.limites_classes !== "object" || Array.isArray(data.system.limites_classes)) data.system.limites_classes = {};
    if (typeof data.system.min_caracteristiques !== "object" || Array.isArray(data.system.min_caracteristiques)) data.system.min_caracteristiques = {};
    if (typeof data.system.max_caracteristiques !== "object" || Array.isArray(data.system.max_caracteristiques)) data.system.max_caracteristiques = {};
    if (typeof data.system.bonus_caracteristiques !== "object" || Array.isArray(data.system.bonus_caracteristiques)) data.system.bonus_caracteristiques = {};
    data.system.description ??= "";
    data.system.description_longue ??= "";
    data.system.note_md ??= "";
    data.system.langues ??= "";
    data.system.vitesse ??= "";
    data.system.taille ??= "";
    data.system["âge_debut"] ??= "";
    data.system["espérance_vie"] ??= "";
    return data;
  }

  async _updateObject(event, updateData) {
    if (updateData.system?.bonus_caracteristiques?.NEW_KEY) {
      const k = String(updateData.system.bonus_caracteristiques.NEW_KEY ?? "").trim();
      const v = Number(updateData.system.bonus_caracteristiques.NEW_VAL) || 0;
      if (k) updateData[`system.bonus_caracteristiques.${k}`] = v;
      delete updateData.system.bonus_caracteristiques.NEW_KEY;
      delete updateData.system.bonus_caracteristiques.NEW_VAL;
    }
    if (updateData.system?.capacites?.NEW) {
      const newCap = String(updateData.system.capacites.NEW ?? "").trim();
      if (newCap) {
        const caps = Array.isArray(this.item.system.capacites) ? [...this.item.system.capacites] : [];
        caps.push(newCap);
        updateData["system.capacites"] = caps;
      }
      delete updateData.system.capacites.NEW;
    }
    await super._updateObject(event, updateData);
    this.render({ force: true });
  }
}

globalThis.Add2eRaceSheet = Add2eRaceSheet;
add2eItemsCollection().registerSheet("add2e", Add2eRaceSheet, {
  types: ["race"],
  makeDefault: true,
  label: "ADD2e Race"
});

const ADD2E_ITEM_SHEET_V2_BY_TYPE = {
  armure: Add2eArmureSheet,
  objet: Add2eObjetSheet,
  arme: Add2eArmeSheet,
  sort: Add2eSortSheet,
  race: Add2eRaceSheet
};

function add2eCreateItemSheetV2Fallback(item) {
  if (!item || item.documentName !== "Item") return null;
  const SheetClass = ADD2E_ITEM_SHEET_V2_BY_TYPE[item.type] ?? null;
  if (!SheetClass) return null;
  return new SheetClass(item);
}

function add2eFindPropertyDescriptor(proto, property) {
  let cur = proto;
  while (cur) {
    const desc = Object.getOwnPropertyDescriptor(cur, property);
    if (desc) return desc;
    cur = Object.getPrototypeOf(cur);
  }
  return null;
}

function add2eInstallItemSheetV2FallbackGetter() {
  const ItemDocument = foundry.documents.Item;
  const proto = ItemDocument?.prototype;
  if (!proto || proto._add2eItemSheetV2FallbackInstalled) return;

  const originalSheetDescriptor = add2eFindPropertyDescriptor(proto, "sheet");
  const originalGetter = originalSheetDescriptor?.get ?? null;

  Object.defineProperty(proto, "sheet", {
    configurable: true,
    get() {
      let sheet = null;
      if (originalGetter) {
        try { sheet = originalGetter.call(this); }
        catch (_err) { sheet = null; }
      }
      return sheet ?? add2eCreateItemSheetV2Fallback(this);
    }
  });

  Object.defineProperty(proto, "_add2eItemSheetV2FallbackInstalled", {
    configurable: true,
    value: true
  });
}

Hooks.once("ready", add2eInstallItemSheetV2FallbackGetter);

try { globalThis.Add2eItemSheetV2 = Add2eItemSheetV2; } catch (_e) {}
try { globalThis.Add2eArmureSheet = Add2eArmureSheet; } catch (_e) {}
try { globalThis.Add2eObjetSheet = Add2eObjetSheet; } catch (_e) {}
try { globalThis.Add2eArmeSheet = Add2eArmeSheet; } catch (_e) {}
try { globalThis.Add2eSortSheet = Add2eSortSheet; } catch (_e) {}
try { globalThis.Add2eRaceSheet = Add2eRaceSheet; } catch (_e) {}
try { globalThis.add2eInstallItemSheetV2FallbackGetter = add2eInstallItemSheetV2FallbackGetter; } catch (_e) {}
