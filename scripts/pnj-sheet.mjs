import { classItems, classProgression, classSlug, cloneItemData } from "./add2e/17b-multiclass-core.mjs";
import { add2eRollCharacteristicCard, add2eRollSaveCard } from "./add2e/13d-actor-sheet-listeners-rolls.mjs";

const PNJ_SHEET_VERSION = "2026-07-06-pnj-character-layout-v3";
const PNJ_TYPE = "pnj";
const APP_API = foundry?.applications?.api ?? {};
const SHEETS_API = foundry?.applications?.sheets ?? {};
const HandlebarsApplicationMixin = APP_API.HandlebarsApplicationMixin;
const ActorSheetV2 = SHEETS_API.ActorSheetV2 ?? SHEETS_API.DocumentSheetV2 ?? APP_API.DocumentSheetV2;
const DialogV2 = APP_API.DialogV2;
const ActorsCollection = foundry.documents.collections.Actors;

if (!HandlebarsApplicationMixin || !ActorSheetV2) {
  throw new Error("[ADD2E][PNJ] ActorSheetV2/DocumentSheetV2 ou HandlebarsApplicationMixin introuvable.");
}

const PnjSheetBase = HandlebarsApplicationMixin(ActorSheetV2);
const TABS = new Set(["resume", "combat", "sorts", "equipement", "notes"]);
const CARACS = [
  ["force", "FOR", "Force"],
  ["dexterite", "DEX", "Dextérité"],
  ["constitution", "CON", "Constitution"],
  ["intelligence", "INT", "Intelligence"],
  ["sagesse", "SAG", "Sagesse"],
  ["charisme", "CHA", "Charisme"]
];
const SAVE_LABELS = [
  "Paralysie / poison / mort",
  "Pétrification / polymorphose",
  "Baguettes et badines",
  "Souffles",
  "Sortilèges"
];
const MARTIAL_CLASSES = new Set(["guerrier", "paladin", "rodeur", "ranger"]);
const GEAR_TYPES = new Set(["objet", "equipement", "consommable", "loot", "conteneur"]);

globalThis.ADD2E_PNJ_SHEET_VERSION = PNJ_SHEET_VERSION;

function number(value, fallback = 0) {
  const result = Number(value);
  return Number.isFinite(result) ? result : fallback;
}

function clone(value) {
  if (foundry?.utils?.deepClone) return foundry.utils.deepClone(value);
  if (foundry?.utils?.duplicate) return foundry.utils.duplicate(value);
  return JSON.parse(JSON.stringify(value ?? {}));
}

function isEqual(left, right) {
  if (typeof foundry?.utils?.deepEqual === "function") return foundry.utils.deepEqual(left, right);
  return JSON.stringify(left) === JSON.stringify(right);
}

function asArray(value) {
  if (Array.isArray(value)) return value.flatMap(asArray);
  if (value === null || value === undefined || value === "") return [];
  if (typeof value === "string") return value.split(/[,;|\n]+/).map(entry => entry.trim()).filter(Boolean);
  if (typeof value === "object") {
    for (const key of ["entries", "lists", "values", "items", "tags"]) {
      if (value[key] !== undefined) return asArray(value[key]);
    }
  }
  return [value];
}

function signed(value) {
  const result = number(value, 0);
  return result > 0 ? `+${result}` : String(result);
}

function equipped(item) {
  const system = item?.system ?? {};
  return system.equipee === true || system.equipped === true || system.portee === true || system.worn === true;
}

function isShield(item) {
  const text = `${item?.name ?? ""} ${asArray(item?.system?.tags).join(" ")}`.toLowerCase();
  return text.includes("bouclier") || text.includes("shield");
}

function isHelmet(item) {
  const text = `${item?.name ?? ""} ${asArray(item?.system?.tags).join(" ")}`.toLowerCase();
  return text.includes("heaume") || text.includes("casque") || text.includes("helmet");
}

function classRow(item, level) {
  const rows = Array.isArray(item?.system?.progression) ? item.system.progression : [];
  return rows.find(row => number(row?.niveau ?? row?.level, 0) === level) ?? rows[Math.max(0, level - 1)] ?? {};
}

function classTitle(item, level, row) {
  const direct = String(row?.title ?? row?.titre ?? "").trim();
  if (direct) return direct;
  const titles = Array.isArray(item?.system?.titlesByLevel) ? item.system.titlesByLevel : [];
  const found = titles.find(entry => level >= number(entry?.minLevel ?? entry?.niveauMin, 0) && level <= number(entry?.maxLevel ?? entry?.niveauMax, 999));
  return String(found?.title ?? found?.titre ?? "").trim();
}

function classEntries(actor) {
  return classItems(actor).map(item => {
    const state = classProgression(item, { level: 1, xp: 0 });
    const level = Math.max(1, state.level);
    const row = classRow(item, level);
    const saves = Array.isArray(row?.savingThrows)
      ? row.savingThrows
      : (Array.isArray(row?.sauvegardes) ? row.sauvegardes : []);
    return {
      id: item.id,
      item,
      name: item.name,
      img: item.img || "icons/svg/book.svg",
      slug: classSlug(item),
      level,
      row,
      title: classTitle(item, level, row),
      thac0: number(row?.thac0 ?? row?.thaco, 20),
      saves
    };
  });
}

function bestSaves(entries) {
  const rows = entries.map(entry => entry.saves).filter(row => Array.isArray(row) && row.length >= 5);
  if (!rows.length) return [20, 20, 20, 20, 20];
  return Array.from({ length: 5 }, (_unused, index) => {
    const candidates = rows.map(row => number(row[index], NaN)).filter(Number.isFinite);
    return candidates.length ? Math.min(...candidates) : 20;
  });
}

function classSummary(actor) {
  const entries = classEntries(actor);
  const names = entries.map(entry => entry.name);
  const titles = entries.map(entry => `${entry.name} ${entry.level}${entry.title ? ` (${entry.title})` : ""}`);
  const thacos = entries.map(entry => entry.thac0).filter(Number.isFinite);
  const multi = entries.length > 1;
  const primary = entries[0]?.item ?? null;
  const primarySystem = primary?.system ?? {};
  const spellLists = new Set();

  for (const entry of entries) {
    const casting = entry.item?.system?.spellcasting;
    for (const source of [entry.item?.system?.spellLists, entry.item?.system?.lists, casting?.lists, casting?.spellLists]) {
      for (const list of asArray(source)) if (String(list ?? "").trim()) spellLists.add(list);
    }
  }

  const thac0 = thacos.length ? Math.min(...thacos) : 20;
  return {
    entries,
    values: {
      classe: names.join(" / "),
      details_classe: multi
        ? { label: names.join(" / "), name: names.join(" / "), multiclass: true, source: "pnj-class-items" }
        : { ...clone(primarySystem), name: primary?.name ?? "", label: primarySystem.label ?? primary?.name ?? "", sourceItemId: primary?.id ?? null, sourceItemUuid: primary?.uuid ?? null },
      spellcasting: spellLists.size ? { enabled: true, mode: multi ? "multiclass" : "prepared", lists: [...spellLists] } : {},
      niveau: entries.length ? Math.max(...entries.map(entry => entry.level)) : 1,
      xp: 0,
      titre: titles.join(" / "),
      thaco: thac0,
      thac0,
      sauvegardes: bestSaves(entries),
      multiclasse: { enabled: multi, mode: "manuel", label: names.join(" / ") }
    }
  };
}

function racialBonus(actor, key) {
  const bonuses = actor?.system?.bonus_caracteristiques ?? {};
  return number(bonuses?.[key] ?? actor?.system?.[`${key}_race`], 0);
}

function abilityAdjustment(actor, key) {
  const system = actor?.system ?? {};
  const labels = {
    force: `${signed(system.force_bonus_toucher)} toucher · ${signed(system.force_bonus_degats)} dégâts`,
    dexterite: `${signed(system.dex_att)} toucher · ${signed(system.dex_def)} CA`,
    constitution: `${signed(system.con_pv)} PV`,
    intelligence: `${signed(system.int_langues)} langues`,
    sagesse: `${signed(system.sag_magie)} résistance magie`,
    charisme: `${signed(system.cha_react)} réaction`
  };
  return labels[key] ?? "—";
}

function attributes(actor) {
  return CARACS.map(([key, short, label]) => {
    const base = number(actor.system?.[`${key}_base`] ?? actor.system?.[key], 10);
    const racial = racialBonus(actor, key);
    return {
      key,
      short,
      label,
      base,
      racial,
      racialSigned: signed(racial),
      total: base + racial,
      adjustment: abilityAdjustment(actor, key)
    };
  });
}

function canUseExceptionalStrength(actor) {
  const strength = number(actor.system?.force_base ?? actor.system?.force, 10) + racialBonus(actor, "force");
  return strength === 18 && classEntries(actor).some(entry => MARTIAL_CLASSES.has(entry.slug));
}

function forceExValues(selected) {
  return Array.from({ length: 101 }, (_unused, value) => ({
    value,
    label: value === 0 ? "—" : String(value).padStart(2, "0"),
    selected: number(selected, 0) === value
  }));
}

function spellsByLevel(actor) {
  const levels = new Map();
  for (const item of actor.items ?? []) {
    if (String(item?.type ?? "").toLowerCase() !== "sort") continue;
    const level = Math.max(1, number(item.system?.niveau ?? item.system?.level, 1));
    const rows = levels.get(level) ?? [];
    rows.push({
      id: item.id,
      name: item.name,
      img: item.img || "icons/svg/book.svg",
      memorized: Math.max(0, number(item.getFlag?.("add2e", "memorizedCount") ?? item.flags?.add2e?.memorizedCount, 0))
    });
    levels.set(level, rows);
  }
  return [...levels.entries()]
    .sort(([left], [right]) => left - right)
    .map(([level, spells]) => ({ level, spells: spells.sort((left, right) => left.name.localeCompare(right.name, "fr")) }));
}

function defense(actor) {
  try {
    const magic = globalThis.Add2eEffectsEngine?.getMagicPassiveDefense?.(actor, { source: "pnj-sheet" });
    if (Number.isFinite(Number(magic?.caTotal))) {
      return { natural: Number(magic.caNaturel ?? magic.caTotal), total: Number(magic.caTotal), dexDefense: number(actor.system?.dex_def, 0) };
    }
  } catch (_error) {}

  const equippedItems = Array.from(actor?.items ?? []).filter(equipped);
  const armors = equippedItems.filter(item => String(item?.type ?? "").toLowerCase() === "armure");
  const body = armors.filter(item => !isShield(item) && !isHelmet(item));
  const shields = armors.filter(isShield);
  const helmets = armors.filter(isHelmet);
  const bodyValues = body.map(item => number(item.system?.ac ?? item.system?.ca, 10)).filter(Number.isFinite);
  const armor = bodyValues.length ? Math.min(...bodyValues) : 10;
  const shield = shields.reduce((sum, item) => sum + Math.max(0, number(item.system?.ac ?? item.system?.ca, 1)), 0);
  const helmet = helmets.reduce((sum, item) => sum + Math.max(0, number(item.system?.ac ?? item.system?.ca, 0)), 0);
  const dexDefense = number(actor?.system?.dex_def, 0);
  const natural = armor + dexDefense - shield - helmet;
  const magic = equippedItems.filter(item => GEAR_TYPES.has(String(item.type ?? "").toLowerCase()))
    .reduce((sum, item) => sum + Math.max(0, number(item.system?.bonus_ca ?? item.system?.bonus_ac ?? item.system?.ca_bonus, 0)), 0);
  return { natural, total: natural - magic, dexDefense };
}

function actorView(actor, system) {
  return {
    id: actor.id,
    _id: actor.id,
    uuid: actor.uuid,
    name: actor.name,
    img: actor.img,
    type: actor.type,
    system: clone(system ?? actor.system ?? {}),
    flags: clone(actor.flags ?? {}),
    items: actor.items,
    effects: actor.effects,
    isOwner: actor.isOwner === true,
    limited: actor.limited === true
  };
}

async function droppedItemData(event) {
  let raw;
  try { raw = JSON.parse(event?.dataTransfer?.getData("text/plain") || "{}"); }
  catch (_error) { return null; }
  if (raw?.type !== "Item") return null;

  let data = raw.data ?? null;
  if (!data && raw.uuid) {
    const doc = await globalThis.fromUuid?.(raw.uuid);
    if (doc?.documentName === "Item") data = doc.toObject();
  }
  if (!data && raw.pack && (raw.id || raw._id)) {
    const pack = game.packs.get(raw.pack);
    const doc = pack ? await pack.getDocument(raw.id ?? raw._id) : null;
    if (doc?.documentName === "Item") data = doc.toObject();
  }
  if (!data || typeof data !== "object") return null;

  const copy = clone(data);
  delete copy._id;
  delete copy._stats;
  return copy;
}

function isIgnoredSupply(data) {
  const api = globalThis.ADD2E_CONSUMABLES ?? game?.add2e?.consumables;
  try {
    return api?.add2eIsAmmunition?.(data) === true || api?.add2eIsSpellComponent?.(data) === true;
  } catch (_error) {
    return false;
  }
}

function sourceClassId(item) {
  const flags = item?.flags?.add2e ?? {};
  return String(flags.autoGrantedByClassId ?? flags.sourceClassId ?? flags.sourceItemId ?? flags.classId ?? "");
}

async function chooseImage(actor) {
  const Picker = globalThis.FilePicker;
  if (!Picker) return false;
  new Picker({
    type: "image",
    current: actor.img,
    callback: path => actor.update({ img: path, "prototypeToken.texture.src": path })
  }).render(true);
  return true;
}

export class Add2ePnjSheet extends PnjSheetBase {
  static DEFAULT_OPTIONS = {
    id: "add2e-pnj-{id}",
    classes: ["add2e", "sheet", "actor", "pnj", "add2e-pnj-v2"],
    tag: "form",
    position: { width: 1050, height: 900 },
    window: { title: "ADD2e — PNJ", resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false, handler: Add2ePnjSheet._onSubmitForm }
  };

  static PARTS = { main: { template: "systems/add2e/templates/actor/pnj-sheet.hbs" } };

  static async _onSubmitForm(_event, _form, formData) {
    const sheet = this;
    const actor = sheet?.document;
    if (!actor?.update) return;

    const object = formData?.object ?? {};
    const expanded = foundry.utils.expandObject(object);
    const update = {};
    if (expanded.system) update.system = expanded.system;
    if (typeof expanded.name === "string" && expanded.name.trim()) update.name = expanded.name.trim();
    if (!Object.keys(update).length) return;

    await actor.update(update, { add2eReason: "pnj-sheet-form" });
    const abilityChanged = Object.keys(object).some(key => /^system\.(force|dexterite|constitution|intelligence|sagesse|charisme)(?:_|$)/.test(key));
    if (abilityChanged) await sheet.recalculateAll({ reason: "pnj-sheet-ability-change" });
  }

  get actor() { return this.document; }

  _tabStorageKey() { return `add2e.pnj.${this.document?.id ?? "unknown"}.activeTab`; }

  _activeTab() {
    const selected = this._pnjActiveTab ?? (() => {
      try { return sessionStorage.getItem(this._tabStorageKey()); }
      catch (_error) { return null; }
    })();
    return TABS.has(selected) ? selected : "resume";
  }

  _setActiveTab(tab, root = null) {
    const selected = TABS.has(tab) ? tab : "resume";
    this._pnjActiveTab = selected;
    try { sessionStorage.setItem(this._tabStorageKey(), selected); } catch (_error) {}

    const element = root?.jquery ? root[0] : root;
    if (!element) return selected;
    element.querySelector(".a2e-active-tab-input")?.setAttribute("value", selected);
    element.querySelectorAll(".a2e-tabs .item[data-tab]").forEach(entry => entry.classList.toggle("active", entry.dataset.tab === selected));
    element.querySelectorAll(".sheet-body .a2e-tab-content[data-tab]").forEach(entry => entry.classList.toggle("active", entry.dataset.tab === selected));
    return selected;
  }

  async _prepareContext(options = {}) {
    const context = await this.getData(options);
    context.document = this.document;
    context.actor = actorView(this.document, context.system);
    context.owner = this.document?.isOwner ?? false;
    context.editable = this.isEditable;
    context.options = this.options ?? {};
    return context;
  }

  async _preparePartContext(_partId, context, _options = {}) { return context; }

  async getData() {
    const actor = this.document;
    const summary = classSummary(actor);
    const system = clone(actor.system ?? {});
    for (const [key, value] of Object.entries(summary.values)) system[key] = clone(value);

    const activeTab = this._activeTab();
    const race = actor.items.find(item => String(item?.type ?? "").toLowerCase() === "race") ?? null;
    const itemRow = item => ({
      id: item.id,
      name: item.name,
      img: item.img || "icons/svg/item-bag.svg",
      equipped: equipped(item),
      ac: number(item.system?.ac ?? item.system?.ca, "—"),
      quantity: number(item.system?.quantite ?? item.system?.quantity, 1)
    });
    const saves = (summary.values.sauvegardes ?? [20, 20, 20, 20, 20])
      .map((value, index) => ({ index, label: SAVE_LABELS[index], value }));
    const combatDefense = defense(actor);

    return {
      system,
      activeTab,
      tabResume: activeTab === "resume",
      tabCombat: activeTab === "combat",
      tabSorts: activeTab === "sorts",
      tabEquipement: activeTab === "equipement",
      tabNotes: activeTab === "notes",
      raceName: race?.name ?? system.race ?? "Aucune",
      classLabel: summary.values.classe || "Aucune",
      classes: summary.entries,
      isMulticlass: summary.entries.length > 1,
      attributes: attributes(actor),
      saves,
      combatDefense,
      weapons: actor.items.filter(item => String(item?.type ?? "").toLowerCase() === "arme").map(itemRow),
      armors: actor.items.filter(item => String(item?.type ?? "").toLowerCase() === "armure").map(itemRow),
      gear: actor.items.filter(item => GEAR_TYPES.has(String(item?.type ?? "").toLowerCase())).map(itemRow),
      spellLevels: spellsByLevel(actor),
      canExceptionalStrength: canUseExceptionalStrength(actor),
      forceExValues: forceExValues(actor.system?.force_ex)
    };
  }

  async _onRender(context, options = {}) {
    await super._onRender?.(context, options);
    const root = this.element?.jquery ? this.element[0] : this.element;
    this.activateListeners(root);
    this._setActiveTab(this._activeTab(), root);
  }

  async _onDrop(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    return false;
  }

  async _syncClassSummary(reason = "pnj-class-summary") {
    const summary = classSummary(this.document);
    const update = {};
    for (const [key, value] of Object.entries(summary.values)) {
      if (!isEqual(this.document.system?.[key], value)) update[`system.${key}`] = value;
    }
    if (Object.keys(update).length) await this.document.update(update, { add2eInternal: true, add2eReason: reason, render: false });
    return summary;
  }

  async autoSetPointsDeCoup({ syncCurrent = false, force = false, reason = "pnj-hp" } = {}) {
    const actor = this.document;
    const entries = classEntries(actor);
    if (!entries.length) return false;

    const conBonus = number(actor.system?.con_pv, 0);
    const update = {};
    let max = 0;

    if (entries.length === 1) {
      const entry = entries[0];
      const die = Math.max(1, number(entry.item.system?.hitDie ?? entry.item.system?.dv, 1));
      const rolls = Array.isArray(actor.system?.hpRolls) && !force ? clone(actor.system.hpRolls) : [];
      if (!Number.isFinite(number(rolls[0], NaN))) rolls[0] = die;
      for (let index = 1; index < entry.level; index += 1) {
        const current = number(rolls[index], NaN);
        if (!Number.isFinite(current) || current < 1 || current > die) rolls[index] = 1 + Math.floor(Math.random() * die);
      }
      for (let index = 0; index < entry.level; index += 1) max += (index === 0 ? die : number(rolls[index], 1)) + conBonus;
      update["system.hpRolls"] = rolls;
    } else {
      const rolls = Array.isArray(actor.system?.hpRollsMulticlass) && !force ? clone(actor.system.hpRollsMulticlass) : [];
      const highest = Math.max(...entries.map(entry => entry.level));
      for (let index = 0; index < highest; index += 1) {
        let total = 0;
        let count = 0;
        for (const entry of entries) {
          if (entry.level <= index) continue;
          const die = Math.max(1, number(entry.item.system?.hitDie ?? entry.item.system?.dv, 1));
          const key = entry.slug || entry.id;
          rolls[index] ??= {};
          let result = number(rolls[index][key], NaN);
          if (!Number.isFinite(result) || result < 1 || result > die || (force && index > 0)) {
            result = index === 0 ? die : 1 + Math.floor(Math.random() * die);
            rolls[index][key] = result;
          }
          total += result;
          count += 1;
        }
        if (count) max += Math.max(1, Math.ceil(total / count)) + conBonus;
      }
      update["system.hpRollsMulticlass"] = rolls;
    }

    update["system.points_de_coup"] = Math.max(1, Math.floor(max));
    if (syncCurrent) update["system.pdv"] = update["system.points_de_coup"];
    await actor.update(update, { add2eInternal: true, add2eReason: reason, render: false });
    return true;
  }

  async autoSetCaracAjustements() {
    const actor = this.document;
    const characterMethod = globalThis.Add2eActorSheet?.prototype?.autoSetCaracAjustements;
    if (typeof characterMethod === "function") {
      const bridge = { actor, autoSetPointsDeCoup: options => this.autoSetPointsDeCoup(options) };
      await characterMethod.call(bridge);
    }

    const totals = {};
    for (const [key] of CARACS) totals[`system.${key}`] = number(actor.system?.[`${key}_base`] ?? actor.system?.[key], 10) + racialBonus(actor, key);
    await actor.update(totals, { add2eInternal: true, add2eReason: "pnj-ability-totals", render: false });
    return true;
  }

  async _recalculateDefense() {
    const values = defense(this.document);
    await this.document.update({ "system.ca_naturel": values.natural, "system.ca_total": values.total }, { add2eInternal: true, add2eReason: "pnj-defense", render: false });
    return values;
  }

  async recalculateAll({ syncCurrentHp = false, reason = "pnj-recalculate" } = {}) {
    await this.autoSetCaracAjustements();
    await this._syncClassSummary(`${reason}:classes`);
    await this.autoSetPointsDeCoup({ syncCurrent: syncCurrentHp, reason: `${reason}:hp` });
    await this._recalculateDefense();
  }

  async _applyRace(data) {
    if (typeof globalThis.add2eApplyRaceItemDataToActor !== "function") throw new Error("Le gestionnaire de race ADD2E est indisponible.");
    await globalThis.add2eApplyRaceItemDataToActor(this.document, data, this, { notify: true, reason: "pnj-race-drop" });
    await this.recalculateAll({ reason: "pnj-race-drop" });
  }

  async _addClass(data) {
    const actor = this.document;
    const existing = classEntries(actor);
    const slug = classSlug(data);

    if (existing.some(entry => entry.slug === slug)) {
      ui.notifications.warn(`${data.name} est déjà attribuée à ce PNJ.`);
      return false;
    }
    if (existing.length >= 3) {
      if (DialogV2?.alert) await DialogV2.alert({ window: { title: "Maximum atteint" }, content: "<p>Un PNJ ne peut pas avoir plus de trois classes.</p>", ok: { label: "Compris" }, modal: true });
      else ui.notifications.warn("Un PNJ ne peut pas avoir plus de trois classes.");
      return false;
    }

    const itemData = cloneItemData(data) ?? clone(data);
    itemData.type = "classe";
    itemData.system ??= {};
    itemData.system.niveau = Math.max(1, number(itemData.system.niveau, 1));
    itemData.system.xp = 0;
    itemData.flags ??= {};
    itemData.flags.add2e ??= {};
    itemData.flags.add2e.pnjClass = true;

    const [classDoc] = await actor.createEmbeddedDocuments("Item", [itemData], { add2eInternal: true, add2eReason: "pnj-add-class" });
    if (!classDoc) return false;

    const effects = (classDoc.effects?.contents ?? []).map(effect => {
      const dataEffect = effect.toObject();
      delete dataEffect._id;
      dataEffect.origin = classDoc.uuid;
      dataEffect.transfer = false;
      dataEffect.flags ??= {};
      dataEffect.flags.add2e = {
        ...(dataEffect.flags.add2e ?? {}),
        sourceType: "classe",
        sourceItemId: classDoc.id,
        sourceItemUuid: classDoc.uuid,
        sourceClasse: classDoc.name
      };
      return dataEffect;
    });
    if (effects.length) await actor.createEmbeddedDocuments("ActiveEffect", effects, { add2eInternal: true, add2eReason: "pnj-add-class-effects" });

    try { await globalThis.add2eSyncActorSpellsFromClass?.(actor, classDoc, { mode: "append", showWait: true }); }
    catch (error) { console.warn("[ADD2E][PNJ][SPELL_SYNC]", error); }

    await this.recalculateAll({ syncCurrentHp: true, reason: "pnj-add-class" });
    return true;
  }

  async _removeClass(item) {
    if (!item) return false;
    const actor = this.document;
    const effectIds = actor.effects
      .filter(effect => String(effect.origin ?? "") === String(item.uuid ?? "") || String(effect.flags?.add2e?.sourceItemId ?? "") === String(item.id))
      .map(effect => effect.id);
    const spellIds = actor.items
      .filter(candidate => String(candidate.type ?? "").toLowerCase() === "sort" && sourceClassId(candidate) === String(item.id))
      .map(candidate => candidate.id);
    if (effectIds.length) await actor.deleteEmbeddedDocuments("ActiveEffect", effectIds, { add2eInternal: true, add2eReason: "pnj-remove-class-effects" });
    if (spellIds.length) await actor.deleteEmbeddedDocuments("Item", spellIds, { add2eInternal: true, add2eReason: "pnj-remove-class-spells" });
    await actor.deleteEmbeddedDocuments("Item", [item.id], { add2eInternal: true, add2eReason: "pnj-remove-class" });
    await this.recalculateAll({ reason: "pnj-remove-class" });
    return true;
  }

  async _setClassLevel(item, value) {
    if (!item) return false;
    const level = Math.max(1, Math.floor(number(value, 1)));
    await item.update({ "system.niveau": level, "system.xp": 0 }, { add2eInternal: true, add2eReason: "pnj-class-level" });
    try { await globalThis.add2eSyncActorSpellsFromClass?.(this.document, item, { mode: "append", showWait: true }); }
    catch (error) { console.warn("[ADD2E][PNJ][SPELL_LEVEL_SYNC]", error); }
    await this.recalculateAll({ reason: "pnj-class-level" });
    return true;
  }

  async _equip(item) {
    if (!item) return false;
    const actor = this.document;
    const willEquip = !equipped(item);
    if (String(item.type ?? "").toLowerCase() === "armure" && willEquip && !isShield(item) && !isHelmet(item)) {
      const updates = actor.items
        .filter(candidate => String(candidate.type ?? "").toLowerCase() === "armure" && candidate.id !== item.id && !isShield(candidate) && !isHelmet(candidate) && equipped(candidate))
        .map(candidate => ({ _id: candidate.id, "system.equipee": false }));
      if (updates.length) await actor.updateEmbeddedDocuments("Item", updates, { add2eInternal: true, add2eReason: "pnj-equip-body-armor" });
    }
    await item.update({ "system.equipee": willEquip }, { add2eInternal: true, add2eReason: "pnj-equip-item" });
    await this._recalculateDefense();
    return true;
  }

  async _adjustCarac(key, delta) {
    if (!CARACS.some(([entry]) => entry === key)) return false;
    const actor = this.document;
    const current = number(actor.system?.[`${key}_base`] ?? actor.system?.[key], 10);
    const next = Math.max(3, Math.min(25, current + number(delta, 0)));
    await actor.update({ [`system.${key}_base`]: next }, { add2eReason: "pnj-adjust-carac" });
    await this.recalculateAll({ reason: "pnj-adjust-carac" });
    return true;
  }

  async _setExceptionalStrength(value) {
    const forceEx = Math.max(0, Math.min(100, Math.trunc(number(value, 0))));
    await this.document.update({ "system.force_ex": forceEx }, { add2eInternal: true, add2eReason: "pnj-force-ex" });
    await this.recalculateAll({ reason: "pnj-force-ex" });
  }

  async _dropItem(event) {
    if (this._pnjDropLock) return false;
    this._pnjDropLock = true;
    try {
      const data = await droppedItemData(event);
      if (!data) return false;
      if (isIgnoredSupply(data)) {
        ui.notifications.info("Les PNJ n’utilisent ni projectiles ni composants de sorts.");
        return false;
      }

      const type = String(data.type ?? "").toLowerCase();
      if (type === "race") await this._applyRace(data);
      else if (type === "classe") await this._addClass(data);
      else {
        const [created] = await this.document.createEmbeddedDocuments("Item", [data], { add2eInternal: true, add2eReason: "pnj-item-drop" });
        if (created?.type === "sort" && created.getFlag("add2e", "memorizedCount") === undefined) await created.setFlag("add2e", "memorizedCount", 0);
        await this._recalculateDefense();
      }
      return true;
    } finally {
      window.setTimeout(() => { this._pnjDropLock = false; }, 0);
    }
  }

  activateListeners(content) {
    const root = content?.jquery ? content[0] : content;
    const sheetRoot = root?.querySelector?.(".add2e-pnj-sheet") ?? root;
    if (!(sheetRoot instanceof HTMLElement) || sheetRoot.dataset.add2ePnjListeners === PNJ_SHEET_VERSION) return;
    sheetRoot.dataset.add2ePnjListeners = PNJ_SHEET_VERSION;

    sheetRoot.addEventListener("dragover", event => event.preventDefault(), true);
    sheetRoot.addEventListener("drop", event => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      this._dropItem(event).then(changed => {
        if (changed) this.render({ force: false });
      }).catch(error => console.error("[ADD2E][PNJ][DROP]", error));
    }, true);

    sheetRoot.addEventListener("change", event => {
      const target = event.target;
      const classLevel = target?.closest?.('[data-action="class-level"]');
      if (classLevel) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        this._setClassLevel(this.document.items.get(classLevel.dataset.itemId), classLevel.value)
          .then(() => this.render({ force: false }))
          .catch(error => console.error("[ADD2E][PNJ][CLASS_LEVEL]", error));
        return;
      }
      const forceEx = target?.closest?.('[data-action="force-ex"]');
      if (forceEx) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        this._setExceptionalStrength(forceEx.value)
          .then(() => this.render({ force: false }))
          .catch(error => console.error("[ADD2E][PNJ][FORCE_EX]", error));
      }
    }, true);

    sheetRoot.addEventListener("click", event => {
      const control = event.target?.closest?.("[data-action]");
      if (!control || !sheetRoot.contains(control)) return;
      const action = control.dataset.action;
      const item = this.document.items.get(control.dataset.itemId);
      const rerender = () => this.render({ force: false });
      event.preventDefault();

      if (action === "switch-tab") return this._setActiveTab(control.dataset.tab, sheetRoot);
      if (action === "edit-image") return chooseImage(this.document);
      if (action === "roll-stat") return add2eRollCharacteristicCard(this.document, control.dataset.stat);
      if (action === "roll-save") return add2eRollSaveCard(this.document, number(control.dataset.saveIndex, 0));
      if (action === "adjust-carac") return this._adjustCarac(control.dataset.carac, control.dataset.delta).then(rerender);
      if (action === "delete-class" && item) return this._removeClass(item).then(rerender);
      if (action === "equip-item" && item) return this._equip(item).then(rerender);
      if (action === "attack" && item) {
        if (typeof globalThis.add2eAttackRoll !== "function") return ui.notifications.warn("Le moteur d’attaque ADD2E est indisponible.");
        return globalThis.add2eAttackRoll({ actor: this.document, arme: item });
      }
      if (action === "cast-spell" && item) {
        if (typeof globalThis.add2eCastSpell !== "function") return ui.notifications.warn("Le moteur de sorts ADD2E est indisponible.");
        return globalThis.add2eCastSpell({ actor: this.document, sort: item }).then(rerender);
      }
      if (action === "spell-memory" && item) {
        const current = Math.max(0, number(item.getFlag("add2e", "memorizedCount"), 0));
        return item.setFlag("add2e", "memorizedCount", Math.max(0, current + number(control.dataset.delta, 0))).then(rerender);
      }
      if (action === "open-item" && item) return item.sheet.render(true);
      if (action === "delete-item" && item) {
        return this.document.deleteEmbeddedDocuments("Item", [item.id], { add2eReason: "pnj-delete-item" })
          .then(async () => { await this._recalculateDefense(); rerender(); });
      }
    }, true);
  }
}

function installPnjComponentBypass() {
  const endpoints = [globalThis.ADD2E_CONSUMABLES, game?.add2e?.consumables].filter(Boolean);
  for (const endpoint of new Set(endpoints)) {
    if (typeof endpoint?.add2eReserveSpellComponents !== "function" || endpoint.__add2ePnjComponentBypass === PNJ_SHEET_VERSION) continue;
    const original = endpoint.add2eReserveSpellComponents.bind(endpoint);
    endpoint.add2eReserveSpellComponents = async (actor, sort) => actor?.type === PNJ_TYPE
      ? { blocked: false, skipped: true, actor, sort }
      : original(actor, sort);
    endpoint.__add2ePnjComponentBypass = PNJ_SHEET_VERSION;
  }
  if (globalThis.ADD2E_CONSUMABLES?.add2eReserveSpellComponents) globalThis.add2eReserveSpellComponents = globalThis.ADD2E_CONSUMABLES.add2eReserveSpellComponents;
}

function installPnjRecalculationHooks() {
  Hooks.on("updateItem", (item, _changes, options = {}) => {
    const actor = item?.parent;
    if (actor?.type !== PNJ_TYPE || options?.add2eInternal) return;
    const sheet = actor.sheet;
    if (sheet instanceof Add2ePnjSheet && ["armure", "arme", "objet", "equipement", "consommable", "classe"].includes(String(item.type ?? "").toLowerCase())) {
      sheet.recalculateAll({ reason: "pnj-item-update" }).catch(error => console.warn("[ADD2E][PNJ][RECALC]", error));
    }
  });
}

ActorsCollection.registerSheet("add2e", Add2ePnjSheet, {
  types: [PNJ_TYPE],
  makeDefault: true,
  label: "ADD2e — PNJ"
});

Hooks.once("ready", () => {
  installPnjComponentBypass();
  installPnjRecalculationHooks();
});

try { globalThis.Add2ePnjSheet = Add2ePnjSheet; } catch (_error) {}
