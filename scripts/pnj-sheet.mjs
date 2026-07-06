/**
 * Feuille PNJ ADD2E — DocumentSheetV2 + ApplicationV2.
 * Les PNJ utilisent les Items race/classe du système sans validation de
 * compatibilité race/classe, prérequis de caractéristiques ou plafond racial.
 */
import { classItems, classProgression, classSlug, cloneItemData } from "./add2e/17b-multiclass-core.mjs";

const PNJ_SHEET_VERSION = "2026-07-06-pnj-document-sheet-v2-v2";
const PNJ_ACTOR_TYPE = "pnj";
const APP_API = foundry?.applications?.api ?? {};
const SHEETS_API = foundry?.applications?.sheets ?? {};
const HandlebarsApplicationMixin = APP_API.HandlebarsApplicationMixin;
const ActorSheetV2 = SHEETS_API.ActorSheetV2 ?? SHEETS_API.DocumentSheetV2 ?? APP_API.DocumentSheetV2;
const DialogV2 = APP_API.DialogV2;
const ActorsCollection = foundry.documents.collections.Actors;

if (!HandlebarsApplicationMixin || !ActorSheetV2) {
  throw new Error("[ADD2E][PNJ] ActorSheetV2/DocumentSheetV2 ou HandlebarsApplicationMixin introuvable.");
}

const Add2ePnjSheetBase = HandlebarsApplicationMixin(ActorSheetV2);
const CARACS = [
  ["force", "Force"], ["dexterite", "Dextérité"], ["constitution", "Constitution"],
  ["intelligence", "Intelligence"], ["sagesse", "Sagesse"], ["charisme", "Charisme"]
];
const SAVE_LABELS = ["Paralysie / Mort", "Baguettes", "Pétrification", "Souffles", "Sorts"];
const MARTIAL_CLASS_SLUGS = new Set(["guerrier", "paladin", "rodeur", "ranger"]);
const GEAR_TYPES = new Set(["objet", "equipement", "consommable", "loot", "conteneur"]);

globalThis.ADD2E_PNJ_SHEET_VERSION = PNJ_SHEET_VERSION;

function n(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clone(value) {
  if (foundry?.utils?.deepClone) return foundry.utils.deepClone(value);
  if (foundry?.utils?.duplicate) return foundry.utils.duplicate(value);
  return JSON.parse(JSON.stringify(value ?? {}));
}

function toArray(value) {
  if (Array.isArray(value)) return value.flatMap(toArray);
  if (value === undefined || value === null || value === "") return [];
  if (typeof value === "string") return value.split(/[,;|\n]+/).map(entry => entry.trim()).filter(Boolean);
  if (typeof value === "object") {
    for (const key of ["entries", "lists", "values", "items"]) {
      if (Array.isArray(value[key])) return value[key];
    }
  }
  return [value];
}

function itemIsEquipped(item) {
  const system = item?.system ?? {};
  return system.equipee === true || system.equipped === true || system.portee === true || system.worn === true;
}

function itemIsShield(item) {
  const text = `${item?.name ?? ""} ${toArray(item?.system?.tags).join(" ")}`.toLowerCase();
  return text.includes("bouclier") || text.includes("shield");
}

function itemIsHelmet(item) {
  const text = `${item?.name ?? ""} ${toArray(item?.system?.tags).join(" ")}`.toLowerCase();
  return text.includes("heaume") || text.includes("casque") || text.includes("helmet");
}

function itemClassRow(classItem, level) {
  const rows = Array.isArray(classItem?.system?.progression) ? classItem.system.progression : [];
  return rows.find(row => n(row?.niveau ?? row?.level, 0) === level) ?? rows[Math.max(0, level - 1)] ?? {};
}

function itemClassTitle(classItem, level, row = null) {
  const direct = String(row?.title ?? row?.titre ?? "").trim();
  if (direct) return direct;
  const titles = Array.isArray(classItem?.system?.titlesByLevel) ? classItem.system.titlesByLevel : [];
  const entry = titles.find(title => level >= n(title?.minLevel ?? title?.niveauMin, 0) && level <= n(title?.maxLevel ?? title?.niveauMax, 999));
  return String(entry?.title ?? entry?.titre ?? "").trim();
}

function pnjClassEntries(actor) {
  return classItems(actor).map(item => {
    const progression = classProgression(item, { level: 1, xp: 0 });
    const level = Math.max(1, progression.level);
    const row = itemClassRow(item, level);
    return {
      id: item.id,
      item,
      name: item.name,
      img: item.img || "icons/svg/book.svg",
      slug: classSlug(item),
      level,
      row,
      title: itemClassTitle(item, level, row),
      thac0: n(row?.thac0 ?? row?.thaco, 20),
      saves: Array.isArray(row?.savingThrows) ? row.savingThrows : (Array.isArray(row?.sauvegardes) ? row.sauvegardes : [])
    };
  });
}

function pnjBestSaves(entries) {
  const rows = entries.map(entry => entry.saves).filter(row => Array.isArray(row) && row.length >= 5);
  if (!rows.length) return [20, 20, 20, 20, 20];
  return Array.from({ length: 5 }, (_unused, index) => {
    const values = rows.map(row => n(row[index], NaN)).filter(Number.isFinite);
    return values.length ? Math.min(...values) : 20;
  });
}

function pnjClassSummary(actor) {
  const entries = pnjClassEntries(actor);
  const names = entries.map(entry => entry.name);
  const title = entries.map(entry => `${entry.name} ${entry.level}${entry.title ? ` (${entry.title})` : ""}`).join(" / ");
  const thacos = entries.map(entry => entry.thac0).filter(Number.isFinite);
  const multi = entries.length > 1;
  const primary = entries[0]?.item ?? null;
  const primarySystem = primary?.system ?? {};
  const spellLists = new Set();

  for (const entry of entries) {
    const casting = entry.item?.system?.spellcasting;
    for (const source of [entry.item?.system?.spellLists, entry.item?.system?.lists, casting?.lists, casting?.spellLists]) {
      for (const list of toArray(source)) if (String(list ?? "").trim()) spellLists.add(list);
    }
  }

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
      titre: title,
      thaco: thacos.length ? Math.min(...thacos) : 20,
      thac0: thacos.length ? Math.min(...thacos) : 20,
      sauvegardes: pnjBestSaves(entries),
      multiclasse: { enabled: multi, mode: "manuel", label: names.join(" / ") }
    }
  };
}

function pnjRaceBonus(actor, key) {
  const bonuses = actor?.system?.bonus_caracteristiques ?? {};
  return n(bonuses?.[key] ?? actor?.system?.[`${key}_race`], 0);
}

function pnjAttributeRows(actor) {
  return CARACS.map(([key, label]) => {
    const base = n(actor.system?.[`${key}_base`] ?? actor.system?.[key], 10);
    const racial = pnjRaceBonus(actor, key);
    return { key, label, base, racial, total: base + racial };
  });
}

function pnjCanUseExceptionalStrength(actor) {
  const strength = n(actor?.system?.force_base ?? actor?.system?.force, 10) + pnjRaceBonus(actor, "force");
  return strength === 18 && pnjClassEntries(actor).some(entry => MARTIAL_CLASS_SLUGS.has(entry.slug));
}

function pnjForceExValues(selected) {
  return Array.from({ length: 101 }, (_unused, value) => ({
    value,
    label: value === 0 ? "—" : String(value).padStart(2, "0"),
    selected: n(selected, 0) === value
  }));
}

function pnjSpellLevels(actor) {
  const byLevel = new Map();
  for (const item of actor.items ?? []) {
    if (String(item?.type ?? "").toLowerCase() !== "sort") continue;
    const level = Math.max(1, n(item.system?.niveau ?? item.system?.level, 1));
    const spells = byLevel.get(level) ?? [];
    spells.push({
      id: item.id,
      name: item.name,
      img: item.img || "icons/svg/book.svg",
      memorized: Math.max(0, n(item.getFlag?.("add2e", "memorizedCount") ?? item.flags?.add2e?.memorizedCount, 0))
    });
    byLevel.set(level, spells);
  }
  return [...byLevel.entries()].sort(([left], [right]) => left - right)
    .map(([level, spells]) => ({ level, spells: spells.sort((left, right) => left.name.localeCompare(right.name, "fr")) }));
}

function pnjDefense(actor) {
  try {
    const result = globalThis.Add2eEffectsEngine?.getMagicPassiveDefense?.(actor, { source: "pnj-sheet" });
    if (Number.isFinite(Number(result?.caTotal))) return { natural: Number(result.caNaturel ?? result.caTotal), total: Number(result.caTotal) };
  } catch (_error) {}

  const equipped = Array.from(actor?.items ?? []).filter(itemIsEquipped);
  const armors = equipped.filter(item => String(item.type ?? "").toLowerCase() === "armure");
  const bodyArmors = armors.filter(item => !itemIsShield(item) && !itemIsHelmet(item));
  const shields = armors.filter(itemIsShield);
  const helmets = armors.filter(itemIsHelmet);
  const armorValues = bodyArmors.map(item => n(item.system?.ac ?? item.system?.ca, 10)).filter(Number.isFinite);
  const armor = armorValues.length ? Math.min(...armorValues) : 10;
  const shieldBonus = shields.reduce((sum, item) => sum + Math.max(0, n(item.system?.ac ?? item.system?.ca, 1)), 0);
  const helmetBonus = helmets.reduce((sum, item) => sum + Math.max(0, n(item.system?.ac ?? item.system?.ca, 0)), 0);
  const natural = armor + n(actor?.system?.dex_def, 0) - shieldBonus - helmetBonus;
  const magicBonus = equipped.filter(item => GEAR_TYPES.has(String(item.type ?? "").toLowerCase()))
    .reduce((sum, item) => sum + Math.max(0, n(item.system?.bonus_ca ?? item.system?.bonus_ac ?? item.system?.ca_bonus, 0)), 0);
  return { natural, total: natural - magicBonus };
}

function pnjActorView(actor) {
  return {
    id: actor.id,
    _id: actor.id,
    uuid: actor.uuid,
    name: actor.name,
    img: actor.img,
    type: actor.type,
    system: clone(actor.system ?? {}),
    flags: clone(actor.flags ?? {}),
    items: actor.items,
    effects: actor.effects,
    isOwner: actor.isOwner === true,
    limited: actor.limited === true
  };
}

async function pnjResolveDropData(event) {
  let raw = null;
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

function pnjSourceClassId(item) {
  const flags = item?.flags?.add2e ?? {};
  return String(flags.autoGrantedByClassId ?? flags.sourceClassId ?? flags.sourceItemId ?? flags.classId ?? "");
}

async function pnjChooseImage(actor) {
  const Picker = globalThis.FilePicker ?? null;
  if (!Picker) return false;
  new Picker({
    type: "image",
    current: actor.img,
    callback: path => actor.update({ img: path, "prototypeToken.texture.src": path })
  }).render(true);
  return true;
}

export class Add2ePnjSheet extends Add2ePnjSheetBase {
  static DEFAULT_OPTIONS = {
    id: "add2e-pnj-{id}",
    classes: ["add2e", "sheet", "actor", "pnj", "add2e-pnj-v2"],
    tag: "form",
    position: { width: 980, height: 860 },
    window: { title: "ADD2e — PNJ", resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false, handler: Add2ePnjSheet._onSubmitForm }
  };

  static PARTS = {
    main: { template: "systems/add2e/templates/actor/pnj-sheet.hbs" }
  };

  static async _onSubmitForm(_event, _form, formData) {
    const sheet = this;
    const actor = sheet?.document;
    if (!actor?.update) return;

    const expanded = foundry.utils.expandObject(formData?.object ?? {});
    const update = {};
    if (expanded.system) update.system = expanded.system;
    if (typeof expanded.name === "string" && expanded.name.trim()) update.name = expanded.name.trim();
    if (!Object.keys(update).length) return;

    await actor.update(update, { add2eReason: "pnj-sheet-form" });
    const changedKeys = Object.keys(formData?.object ?? {});
    const abilityChanged = changedKeys.some(key => /^system\.(force|dexterite|constitution|intelligence|sagesse|charisme)(?:_|$)/.test(key));
    if (abilityChanged) await sheet.recalculateAll({ reason: "pnj-sheet-ability-change" });
  }

  get actor() { return this.document; }
  get title() { return this.document?.name ?? "PNJ"; }

  async _prepareContext(options = {}) {
    const actor = this.document;
    const context = await this.getData(options);
    context.document = actor;
    context.actor = pnjActorView(actor);
    context.owner = actor?.isOwner ?? false;
    context.editable = this.isEditable;
    context.options = this.options ?? {};
    return context;
  }

  async _preparePartContext(_partId, context, _options = {}) { return context; }

  async getData() {
    const actor = this.document;
    const sheetSystem = clone(actor.system ?? {});
    const summary = pnjClassSummary(actor);
    for (const [key, value] of Object.entries(summary.values)) sheetSystem[key] = clone(value);

    const race = actor.items.find(item => String(item.type ?? "").toLowerCase() === "race") ?? null;
    const saves = (summary.values.sauvegardes ?? [20, 20, 20, 20, 20])
      .map((value, index) => ({ index, label: SAVE_LABELS[index], value }));
    const itemData = item => ({
      id: item.id,
      name: item.name,
      img: item.img || "icons/svg/item-bag.svg",
      equipped: itemIsEquipped(item),
      ac: n(item.system?.ac ?? item.system?.ca, "—"),
      quantity: n(item.system?.quantite ?? item.system?.quantity, 1)
    });

    return {
      system: sheetSystem,
      raceName: race?.name ?? sheetSystem.race ?? "Aucune",
      classLabel: summary.values.classe || "Aucune",
      attributes: pnjAttributeRows(actor),
      classes: summary.entries,
      saves,
      weapons: actor.items.filter(item => String(item.type ?? "").toLowerCase() === "arme").map(itemData),
      armors: actor.items.filter(item => String(item.type ?? "").toLowerCase() === "armure").map(itemData),
      gear: actor.items.filter(item => GEAR_TYPES.has(String(item.type ?? "").toLowerCase())).map(itemData),
      spellLevels: pnjSpellLevels(actor),
      canExceptionalStrength: pnjCanUseExceptionalStrength(actor),
      forceExValues: pnjForceExValues(actor.system?.force_ex)
    };
  }

  async _onRender(context, options = {}) {
    await super._onRender?.(context, options);
    this.activateListeners(this.element?.jquery ? this.element[0] : this.element);
  }

  async _syncClassSummary(reason = "pnj-class-summary") {
    const summary = pnjClassSummary(this.document);
    const update = {};
    for (const [key, value] of Object.entries(summary.values)) {
      if (!foundry.utils.deepEqual?.(this.document.system?.[key], value)) update[`system.${key}`] = value;
    }
    if (Object.keys(update).length) await this.document.update(update, { add2eInternal: true, add2eReason: reason, render: false });
    return summary;
  }

  async autoSetPointsDeCoup({ syncCurrent = false, force = false, reason = "pnj-hp" } = {}) {
    const actor = this.document;
    const entries = pnjClassEntries(actor);
    if (!entries.length) return false;
    const conBonus = n(actor.system?.con_pv, 0);
    const update = {};
    let maximum = 0;

    if (entries.length === 1) {
      const entry = entries[0];
      const die = Math.max(1, n(entry.item.system?.hitDie ?? entry.item.system?.dv, 1));
      const rolls = Array.isArray(actor.system?.hpRolls) && !force ? clone(actor.system.hpRolls) : [];
      if (!Number.isFinite(n(rolls[0], NaN))) rolls[0] = die;
      for (let index = 1; index < entry.level; index += 1) {
        if (!Number.isFinite(n(rolls[index], NaN)) || n(rolls[index]) < 1 || n(rolls[index]) > die) rolls[index] = 1 + Math.floor(Math.random() * die);
      }
      for (let index = 0; index < entry.level; index += 1) maximum += (index === 0 ? die : n(rolls[index], 1)) + conBonus;
      update["system.hpRolls"] = rolls;
    } else {
      const rolls = Array.isArray(actor.system?.hpRollsMulticlass) && !force ? clone(actor.system.hpRollsMulticlass) : [];
      const highestLevel = Math.max(...entries.map(entry => entry.level));
      for (let index = 0; index < highestLevel; index += 1) {
        let total = 0;
        let count = 0;
        for (const entry of entries) {
          if (entry.level <= index) continue;
          const die = Math.max(1, n(entry.item.system?.hitDie ?? entry.item.system?.dv, 1));
          rolls[index] ??= {};
          const key = entry.slug || entry.id;
          let roll = n(rolls[index][key], NaN);
          if (!Number.isFinite(roll) || roll < 1 || roll > die || (force && index > 0)) {
            roll = index === 0 ? die : 1 + Math.floor(Math.random() * die);
            rolls[index][key] = roll;
          }
          total += roll;
          count += 1;
        }
        if (count) maximum += Math.max(1, Math.ceil(total / count)) + conBonus;
      }
      update["system.hpRollsMulticlass"] = rolls;
    }

    maximum = Math.max(1, Math.floor(maximum));
    update["system.points_de_coup"] = maximum;
    if (syncCurrent) update["system.pdv"] = maximum;
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
    const update = {};
    for (const [key] of CARACS) update[`system.${key}`] = n(actor.system?.[`${key}_base`] ?? actor.system?.[key], 10) + pnjRaceBonus(actor, key);
    await actor.update(update, { add2eInternal: true, add2eReason: "pnj-ability-totals", render: false });
    return true;
  }

  async _recalculateDefense() {
    const defense = pnjDefense(this.document);
    await this.document.update({ "system.ca_naturel": defense.natural, "system.ca_total": defense.total }, { add2eInternal: true, add2eReason: "pnj-defense", render: false });
    return defense;
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
    const existing = pnjClassEntries(actor);
    if (existing.length >= 3) {
      if (DialogV2?.alert) await DialogV2.alert({ window: { title: "Maximum atteint" }, content: "<p>Un PNJ ne peut pas avoir plus de trois classes.</p>", ok: { label: "Compris" }, modal: true });
      else ui.notifications.warn("Un PNJ ne peut pas avoir plus de trois classes.");
      return false;
    }

    const slug = classSlug(data);
    if (existing.some(entry => entry.slug === slug)) {
      ui.notifications.warn(`${data.name} est déjà attribuée à ce PNJ.`);
      return false;
    }

    const itemData = cloneItemData(data) ?? clone(data);
    itemData.type = "classe";
    itemData.system ??= {};
    itemData.system.niveau = Math.max(1, n(itemData.system.niveau, 1));
    itemData.system.xp = 0;
    itemData.flags ??= {};
    itemData.flags.add2e ??= {};
    itemData.flags.add2e.pnjClass = true;

    const [classDoc] = await actor.createEmbeddedDocuments("Item", [itemData], { add2eInternal: true, add2eReason: "pnj-add-class" });
    if (!classDoc) return false;

    const effects = (classDoc.effects?.contents ?? []).map(effect => {
      const effectData = effect.toObject();
      delete effectData._id;
      effectData.origin = classDoc.uuid;
      effectData.transfer = false;
      effectData.flags ??= {};
      effectData.flags.add2e = {
        ...(effectData.flags.add2e ?? {}),
        sourceType: "classe",
        sourceItemId: classDoc.id,
        sourceItemUuid: classDoc.uuid,
        sourceClasse: classDoc.name
      };
      return effectData;
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
    const effectIds = actor.effects.filter(effect => String(effect.origin ?? "") === String(item.uuid ?? "") || String(effect.flags?.add2e?.sourceItemId ?? "") === String(item.id)).map(effect => effect.id);
    const spellIds = actor.items.filter(candidate => String(candidate.type ?? "").toLowerCase() === "sort" && pnjSourceClassId(candidate) === String(item.id)).map(candidate => candidate.id);
    if (effectIds.length) await actor.deleteEmbeddedDocuments("ActiveEffect", effectIds, { add2eInternal: true, add2eReason: "pnj-remove-class-effects" });
    if (spellIds.length) await actor.deleteEmbeddedDocuments("Item", spellIds, { add2eInternal: true, add2eReason: "pnj-remove-class-spells" });
    await actor.deleteEmbeddedDocuments("Item", [item.id], { add2eInternal: true, add2eReason: "pnj-remove-class" });
    await this.recalculateAll({ reason: "pnj-remove-class" });
    return true;
  }

  async _equip(item) {
    if (!item) return false;
    const actor = this.document;
    const equipped = !itemIsEquipped(item);
    if (String(item.type ?? "").toLowerCase() === "armure" && equipped && !itemIsShield(item) && !itemIsHelmet(item)) {
      const updates = actor.items
        .filter(candidate => String(candidate.type ?? "").toLowerCase() === "armure" && candidate.id !== item.id && !itemIsShield(candidate) && !itemIsHelmet(candidate) && itemIsEquipped(candidate))
        .map(candidate => ({ _id: candidate.id, "system.equipee": false }));
      if (updates.length) await actor.updateEmbeddedDocuments("Item", updates, { add2eInternal: true, add2eReason: "pnj-equip-body-armor" });
    }
    await item.update({ "system.equipee": equipped }, { add2eInternal: true, add2eReason: "pnj-equip-item" });
    await this._recalculateDefense();
    return true;
  }

  async _setClassLevel(item, value) {
    if (!item) return false;
    const level = Math.max(1, Math.floor(n(value, 1)));
    await item.update({ "system.niveau": level, "system.xp": 0 }, { add2eInternal: true, add2eReason: "pnj-class-level" });
    try { await globalThis.add2eSyncActorSpellsFromClass?.(this.document, item, { mode: "append", showWait: true }); }
    catch (error) { console.warn("[ADD2E][PNJ][SPELL_SYNC_LEVEL]", error); }
    await this.recalculateAll({ reason: "pnj-class-level" });
    return true;
  }

  async _rollSave(index, threshold) {
    const roll = await new Roll("1d20").evaluate();
    if (game.dice3d) await game.dice3d.showForRoll(roll, game.user, true);
    const success = roll.total >= threshold;
    const label = SAVE_LABELS[index] ?? "Sauvegarde";
    const Chat = globalThis.ChatMessage;
    await Chat.create({
      speaker: Chat.getSpeaker({ actor: this.document }),
      content: `<div class="add2e-card-test" style="border:1px solid #7e2b25;border-radius:8px;padding:8px;background:#fffaf0"><strong>${label}</strong><div>Seuil : <b>${threshold}</b> — Jet : <b>${roll.total}</b></div><div style="font-weight:900;color:${success ? "#2d6b36" : "#9a2720"}">${success ? "SUCCÈS" : "ÉCHEC"}</div></div>`
    });
  }

  async _drop(event) {
    event.preventDefault();
    const data = await pnjResolveDropData(event);
    if (!data) return false;
    const type = String(data.type ?? "").toLowerCase();

    if (type === "race") await this._applyRace(data);
    else if (type === "classe") await this._addClass(data);
    else {
      const [created] = await this.document.createEmbeddedDocuments("Item", [data], { add2eInternal: true, add2eReason: "pnj-item-drop" });
      if (created?.type === "sort" && created.getFlag("add2e", "memorizedCount") === undefined) await created.setFlag("add2e", "memorizedCount", 0);
      await this._recalculateDefense();
    }

    this.render({ force: false });
    return false;
  }

  activateListeners(content) {
    const root = content?.jquery ? content[0] : content;
    if (!(root instanceof HTMLElement) || root.dataset.add2ePnjListeners === PNJ_SHEET_VERSION) return;
    root.dataset.add2ePnjListeners = PNJ_SHEET_VERSION;
    root.addEventListener("dragover", event => event.preventDefault());
    root.addEventListener("drop", event => this._drop(event).catch(error => console.error("[ADD2E][PNJ][DROP]", error)));
    root.addEventListener("change", event => {
      const input = event.target?.closest?.('[data-action="class-level"]');
      if (!input) return;
      this._setClassLevel(this.document.items.get(input.dataset.itemId), input.value)
        .then(() => this.render({ force: false }))
        .catch(error => console.error("[ADD2E][PNJ][CLASS_LEVEL]", error));
    });
    root.addEventListener("click", event => {
      const button = event.target?.closest?.("[data-action]");
      if (!button || !root.contains(button)) return;
      event.preventDefault();
      const action = button.dataset.action;
      const item = this.document.items.get(button.dataset.itemId);
      const rerender = () => this.render({ force: false });

      if (action === "tab") {
        const tab = button.dataset.tab || "identite";
        root.querySelectorAll(".a2e-pnj-tab").forEach(entry => entry.classList.toggle("active", entry.dataset.tab === tab));
        root.querySelectorAll(".a2e-pnj-content").forEach(entry => entry.classList.toggle("active", entry.dataset.tab === tab));
        return;
      }
      if (action === "edit-image") return pnjChooseImage(this.document);
      if (action === "roll-save") return this._rollSave(n(button.dataset.saveIndex, 0), n(button.dataset.saveValue, 20));
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
        const current = Math.max(0, n(item.getFlag("add2e", "memorizedCount"), 0));
        return item.setFlag("add2e", "memorizedCount", Math.max(0, current + n(button.dataset.delta, 0))).then(rerender);
      }
      if (action === "edit-item" && item) return item.sheet.render(true);
      if (action === "delete-item" && item) {
        return this.document.deleteEmbeddedDocuments("Item", [item.id], { add2eReason: "pnj-delete-item" })
          .then(async () => { await this._recalculateDefense(); rerender(); });
      }
    });
  }
}

function installPnjSpellComponentBypass() {
  const endpoints = [globalThis.ADD2E_CONSUMABLES, game?.add2e?.consumables].filter(Boolean);
  let patched = false;
  for (const endpoint of new Set(endpoints)) {
    if (typeof endpoint?.add2eReserveSpellComponents !== "function" || endpoint.__add2ePnjComponentBypass === PNJ_SHEET_VERSION) continue;
    const original = endpoint.add2eReserveSpellComponents.bind(endpoint);
    endpoint.add2eReserveSpellComponents = async (actor, sort) => actor?.type === PNJ_ACTOR_TYPE
      ? { blocked: false, skipped: true, actor, sort }
      : original(actor, sort);
    endpoint.__add2ePnjComponentBypass = PNJ_SHEET_VERSION;
    patched = true;
  }
  if (globalThis.ADD2E_CONSUMABLES?.add2eReserveSpellComponents) globalThis.add2eReserveSpellComponents = globalThis.ADD2E_CONSUMABLES.add2eReserveSpellComponents;
  return patched;
}

function installPnjRecalculationHooks() {
  Hooks.on("updateItem", (item, _changes, options = {}) => {
    const actor = item?.parent;
    if (actor?.type !== PNJ_ACTOR_TYPE || options?.add2eInternal) return;
    const sheet = actor.sheet;
    if (sheet instanceof Add2ePnjSheet && ["armure", "arme", "objet", "equipement", "consommable", "classe"].includes(String(item.type ?? "").toLowerCase())) {
      sheet.recalculateAll({ reason: "pnj-item-update" }).catch(error => console.warn("[ADD2E][PNJ][RECALC]", error));
    }
  });
}

ActorsCollection.registerSheet("add2e", Add2ePnjSheet, {
  types: [PNJ_ACTOR_TYPE],
  makeDefault: true,
  label: "ADD2e — PNJ"
});

Hooks.once("ready", () => {
  installPnjSpellComponentBypass();
  installPnjRecalculationHooks();
});

try { globalThis.Add2ePnjSheet = Add2ePnjSheet; } catch (_error) {}
