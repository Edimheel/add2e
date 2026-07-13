const ADD2E_ITEM_SHEETS_VERSION = "2026-07-13-item-sheet-arcane-scroll-editor-v1";
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

const ADD2E_ARCANE_ITEM_SHEET_VERSION = "2026-07-13-arcane-item-sheet-v1";
const ADD2E_ARCANE_ITEM_LISTS = new Set(["magicien", "illusionniste"]);

globalThis.ADD2E_ARCANE_ITEM_SHEET_VERSION = ADD2E_ARCANE_ITEM_SHEET_VERSION;

function add2eArcaneNorm(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function add2eArcaneArray(value) {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(add2eArcaneArray);
  if (value instanceof Set) return [...value].flatMap(add2eArcaneArray);
  if (typeof value === "string") return value.split(/[,;|\n]+/g).map(entry => entry.trim()).filter(Boolean);
  if (typeof value === "object") {
    for (const key of ["lists", "spellLists", "classes", "classe", "class", "items", "value", "values"]) {
      if (value[key] !== undefined) return add2eArcaneArray(value[key]);
    }
  }
  return [value];
}

function add2eArcaneListKey(value) {
  try {
    if (typeof globalThis.add2eNormalizeSpellKey === "function") return globalThis.add2eNormalizeSpellKey(value);
  } catch (_error) {}
  const key = add2eArcaneNorm(value);
  return ({ wizard: "magicien", mage: "magicien", magician: "magicien", magic_user: "magicien", illusionist: "illusionniste" })[key] ?? key;
}

function add2eArcaneData(item) {
  const value = item?.system?.arcaneDocument;
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function add2eArcaneKind(item) {
  return String(add2eArcaneData(item).kind ?? item?.flags?.add2e?.arcaneDocumentKind ?? "").trim().toLowerCase();
}

function add2eArcaneObjectIsScroll(item) {
  if (String(item?.type ?? "").toLowerCase() !== "objet") return false;
  if (add2eArcaneKind(item) === "spell-scroll") return true;
  const name = add2eArcaneNorm(item?.name);
  const subtype = add2eArcaneNorm(item?.system?.sousType ?? item?.system?.sous_type);
  return subtype.includes("parchemin_de_sort")
    || (name.startsWith("parchemin") && (name.includes("magicien") || name.includes("illusionniste") || name.includes("sort")));
}

function add2eArcaneObjectIsBook(item) {
  if (String(item?.type ?? "").toLowerCase() !== "objet") return false;
  if (add2eArcaneKind(item) === "spellbook") return true;
  const name = add2eArcaneNorm(item?.name);
  const subtype = add2eArcaneNorm(item?.system?.sousType ?? item?.system?.sous_type);
  return subtype.includes("livre_de_sorts") || name.startsWith("livre_de_sorts");
}

function add2eArcaneContainerList(item) {
  const data = add2eArcaneData(item);
  for (const value of [data.ownerList, data.spellList, item?.flags?.add2e?.ownerSpellList]) {
    const key = add2eArcaneListKey(value);
    if (ADD2E_ARCANE_ITEM_LISTS.has(key)) return key;
  }
  const text = add2eArcaneNorm(`${item?.name ?? ""} ${item?.system?.sousType ?? ""}`);
  if (text.includes("illusionniste")) return "illusionniste";
  if (text.includes("magicien")) return "magicien";
  return "";
}

function add2eArcaneSpellLists(item) {
  try {
    if (typeof globalThis.add2eGetSpellListsFromItem === "function") {
      return [...new Set(globalThis.add2eGetSpellListsFromItem(item).map(add2eArcaneListKey).filter(Boolean))];
    }
  } catch (_error) {}
  const system = item?.system ?? {};
  const flags = item?.flags?.add2e ?? {};
  return [...new Set([
    flags.knownSpellLists,
    flags.learnedSpellLists,
    flags.grantedSpellLists,
    system.spellLists,
    system.lists,
    system.liste,
    system.liste_sort,
    system.listeSort,
    system.classe,
    system.class
  ].flatMap(add2eArcaneArray).map(add2eArcaneListKey).filter(Boolean))];
}

function add2eArcaneSpellLevel(item) {
  return Math.max(1, Number(item?.system?.niveau ?? item?.system?.level ?? item?.system?.niveau_sort ?? item?.system?.spellLevel ?? 1) || 1);
}

function add2eArcaneSourceUuid(item) {
  return String(item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? item?.flags?.add2e?.sourceUuid ?? item?.uuid ?? "").trim();
}

function add2eArcaneNormalizeEntry(entry, fallbackList = "") {
  if (!entry) return null;
  const name = String(entry.name ?? entry.nom ?? entry.label ?? "").trim();
  if (!name) return null;
  const level = Math.max(1, Number(entry.level ?? entry.niveau ?? entry.spellLevel ?? 1) || 1);
  const lists = [...new Set([
    entry.lists,
    entry.spellLists,
    entry.classes,
    entry.classe,
    entry.class,
    fallbackList
  ].flatMap(add2eArcaneArray).map(add2eArcaneListKey).filter(Boolean))];
  return {
    key: String(entry.key ?? entry.stableKey ?? entry.spellKey ?? "").trim() || `${lists[0] ?? "sort"}|${level}|${add2eArcaneNorm(name)}`,
    name,
    level,
    lists,
    sourceUuid: String(entry.sourceUuid ?? entry.uuid ?? entry.sourceId ?? "").trim(),
    img: String(entry.img ?? entry.image ?? "icons/svg/book.svg")
  };
}

function add2eArcaneDocumentEntries(item) {
  let source = null;
  try {
    const apiEntries = globalThis.ADD2E_ARCANE_DOCUMENTS?.documentEntries?.(item);
    if (Array.isArray(apiEntries)) source = apiEntries;
  } catch (_error) {}
  const data = add2eArcaneData(item);
  if (!source) source = Array.isArray(data.spells) ? data.spells : data.spell ? [data.spell] : Array.isArray(item?.system?.sorts) ? item.system.sorts : [];
  const fallbackList = add2eArcaneContainerList(item);
  const seen = new Set();
  const entries = [];
  for (const raw of source) {
    const entry = add2eArcaneNormalizeEntry(raw, fallbackList);
    if (!entry) continue;
    const unique = `${entry.key}|${entry.lists.join(",")}`;
    if (seen.has(unique)) continue;
    seen.add(unique);
    entries.push({
      ...entry,
      listLabel: entry.lists.map(list => list === "illusionniste" ? "Illusionniste" : list === "magicien" ? "Magicien" : list).join(" / ") || "Liste inconnue"
    });
  }
  return entries.sort((left, right) => left.level - right.level || left.name.localeCompare(right.name, "fr"));
}

function add2eArcaneEntryFromSpell(container, spell) {
  if (String(spell?.type ?? "").toLowerCase() !== "sort") return { ok: false, message: "Déposez un Item de type sort." };
  if (spell.system?.isPower === true || spell.system?.isObjectPower === true || spell.system?.isCapacity === true || spell.flags?.add2e?.spellFamily?.generated === true) {
    return { ok: false, message: "Les pouvoirs, capacités et variantes générées ne peuvent pas être inscrits sur ce parchemin." };
  }
  const preferredList = add2eArcaneContainerList(container);
  const arcaneLists = add2eArcaneSpellLists(spell).filter(list => ADD2E_ARCANE_ITEM_LISTS.has(list));
  if (preferredList && !arcaneLists.includes(preferredList)) {
    return { ok: false, message: `${spell.name} n'appartient pas à la liste ${preferredList === "illusionniste" ? "Illusionniste" : "Magicien"}.` };
  }
  const lists = preferredList ? [preferredList] : arcaneLists;
  if (!lists.length) return { ok: false, message: `${spell.name} n'est ni un sort de Magicien ni un sort d'Illusionniste.` };
  const level = add2eArcaneSpellLevel(spell);
  return {
    ok: true,
    entry: {
      key: `${lists[0]}|${level}|${add2eArcaneNorm(spell.name)}`,
      name: spell.name,
      level,
      lists,
      sourceUuid: add2eArcaneSourceUuid(spell),
      img: spell.img || "icons/svg/book.svg"
    }
  };
}

async function add2eArcaneDialogConfirm({ title, content, yesLabel = "Confirmer" }) {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.wait) {
    ui.notifications.error("DialogV2 est introuvable.");
    return false;
  }
  return await DialogV2.wait({
    window: { title },
    modal: true,
    rejectClose: false,
    content,
    buttons: [
      { action: "yes", label: yesLabel, icon: "fa-solid fa-check", default: true, callback: () => true },
      { action: "no", label: "Annuler", icon: "fa-solid fa-xmark", callback: () => false }
    ]
  }) === true;
}

async function add2eArcaneResolveDrop(event) {
  let data = null;
  const editor = foundry?.applications?.ux?.TextEditor?.implementation ?? globalThis.TextEditor ?? null;
  try { data = editor?.getDragEventData?.(event) ?? null; } catch (_error) {}
  if (!data) {
    try { data = JSON.parse(event?.dataTransfer?.getData?.("text/plain") || "null"); } catch (_error) { data = null; }
  }
  if (!data || (data.type && data.type !== "Item")) return null;
  if (data.uuid && typeof fromUuid === "function") {
    try {
      const document = await fromUuid(data.uuid);
      if (document?.documentName === "Item") return document;
    } catch (_error) {}
  }
  const documentClass = CONFIG?.Item?.documentClass;
  if (typeof documentClass?.fromDropData === "function") {
    try {
      const document = await documentClass.fromDropData(data);
      if (document?.documentName === "Item") return document;
    } catch (_error) {}
  }
  if (data.pack && data.id) {
    try { return await game.packs?.get?.(data.pack)?.getDocument?.(data.id) ?? null; } catch (_error) {}
  }
  return null;
}

async function add2eArcaneStoreEntries(item, entries) {
  const current = add2eArcaneData(item);
  const spellList = add2eArcaneContainerList(item);
  const next = {
    ...foundry.utils.deepClone(current),
    schema: 1,
    kind: "spell-scroll",
    personal: false,
    spells: entries.map(entry => ({
      key: entry.key,
      name: entry.name,
      level: entry.level,
      lists: entry.lists,
      sourceUuid: entry.sourceUuid,
      img: entry.img
    }))
  };
  delete next.spell;
  if (spellList) next.spellList = spellList;
  const update = {
    "system.arcaneDocument": next,
    "system.magique": true,
    "system.consommable": true,
    "flags.add2e.arcaneDocumentKind": "spell-scroll",
    "flags.add2e.arcaneItemSheetVersion": ADD2E_ARCANE_ITEM_SHEET_VERSION
  };
  if (!String(item?.system?.sousType ?? "").trim()) update["system.sousType"] = "parchemin_de_sort";
  await item.update(update, { add2eInternal: true, add2eArcaneItemSheet: true, render: false });
}

async function add2eArcaneAddDroppedSpell(container, spell) {
  const built = add2eArcaneEntryFromSpell(container, spell);
  if (!built.ok) {
    ui.notifications.warn(built.message);
    return false;
  }
  const entries = add2eArcaneDocumentEntries(container);
  const duplicate = entries.some(entry => entry.key === built.entry.key || (
    add2eArcaneNorm(entry.name) === add2eArcaneNorm(built.entry.name)
    && Number(entry.level) === Number(built.entry.level)
    && entry.lists.some(list => built.entry.lists.includes(list))
  ));
  if (duplicate) {
    ui.notifications.info(`${built.entry.name} est déjà inscrit sur ${container.name}.`);
    return false;
  }
  await add2eArcaneStoreEntries(container, [...entries, built.entry]);
  ui.notifications.info(`${built.entry.name} a été inscrit sur ${container.name}.`);
  return true;
}

async function add2eArcaneRemoveEntry(container, spellKey) {
  const entries = add2eArcaneDocumentEntries(container);
  const entry = entries.find(candidate => String(candidate.key) === String(spellKey));
  if (!entry) return false;
  const confirmed = await add2eArcaneDialogConfirm({
    title: `Retirer ${entry.name}`,
    content: `<div class="add2e-dialog" style="min-width:460px;padding:8px;"><p>Retirer <b>${entry.name}</b> de <b>${container.name}</b> ?</p><p>Le parchemin restera disponible et pourra recevoir un autre sort.</p></div>`,
    yesLabel: "Retirer l'inscription"
  });
  if (!confirmed) return false;
  await add2eArcaneStoreEntries(container, entries.filter(candidate => String(candidate.key) !== String(spellKey)));
  return true;
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

  _canUserView(user) {
    const limited = CONST?.DOCUMENT_OWNERSHIP_LEVELS?.LIMITED ?? 1;
    return this.item?.testUserPermission?.(user, limited) === true;
  }

  _canUserEdit(user) {
    const owner = CONST?.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3;
    return this.item?.testUserPermission?.(user, owner) === true;
  }

  get isEditable() {
    return this._canUserEdit(game.user);
  }

  get editable() {
    return this.isEditable;
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

    const isScroll = add2eArcaneObjectIsScroll(this.item);
    const isBook = add2eArcaneObjectIsBook(this.item);
    const list = add2eArcaneContainerList(this.item);
    data.isArcaneDocument = isScroll || isBook;
    data.isSpellScrollDocument = isScroll;
    data.isSpellbookDocument = isBook;
    data.arcaneEntries = data.isArcaneDocument ? add2eArcaneDocumentEntries(this.item) : [];
    data.arcaneSpellListLabel = list === "illusionniste" ? "Illusionniste" : list === "magicien" ? "Magicien" : "Magicien / Illusionniste";
    data.canManageArcaneEntries = this.editable && isScroll;
    return data;
  }

  activateListeners(content) {
    super.activateListeners(content);
    const root = add2eRootFromContent(content);
    if (!root) return;

    const dropZone = root.querySelector(".add2e-arcane-drop-zone");
    if (dropZone && this.editable) {
      const clearDrag = () => dropZone.classList.remove("is-dragover");
      dropZone.addEventListener("dragenter", event => {
        event.preventDefault();
        event.stopPropagation();
        dropZone.classList.add("is-dragover");
      });
      dropZone.addEventListener("dragover", event => {
        event.preventDefault();
        event.stopPropagation();
        if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
        dropZone.classList.add("is-dragover");
      });
      dropZone.addEventListener("dragleave", clearDrag);
      dropZone.addEventListener("drop", async event => {
        event.preventDefault();
        event.stopPropagation();
        clearDrag();
        try {
          const spell = await add2eArcaneResolveDrop(event);
          if (!spell) {
            ui.notifications.warn("Le sort déposé est introuvable.");
            return;
          }
          if (await add2eArcaneAddDroppedSpell(this.item, spell)) this.render({ force: true });
        } catch (error) {
          console.error("[ADD2E][ARCANE_ITEM_SHEET][DROP_ERROR]", { item: this.item?.name, error });
          ui.notifications.error(error?.message || "Erreur pendant l'inscription du sort.");
        }
      });
    }

    for (const button of root.querySelectorAll(".add2e-arcane-remove-entry")) {
      button.addEventListener("click", async event => {
        event.preventDefault();
        event.stopPropagation();
        try {
          if (await add2eArcaneRemoveEntry(this.item, button.dataset.spellKey ?? "")) this.render({ force: true });
        } catch (error) {
          console.error("[ADD2E][ARCANE_ITEM_SHEET][REMOVE_ERROR]", { item: this.item?.name, error });
          ui.notifications.error(error?.message || "Erreur pendant le retrait du sort.");
        }
      });
    }
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
