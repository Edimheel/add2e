/**
 * Feuille PNJ ADD2E — ApplicationV2.
 * Les PNJ utilisent les mêmes Items race/classe que les PJ, sans aucune
 * validation de compatibilité race/classe ou de plafond racial.
 */
import { classItems, classProgression, classSlug, cloneItemData } from "./add2e/17b-multiclass-core.mjs";

const { ApplicationV2 } = foundry.applications.api;
const ActorsCollection = foundry.documents.collections.Actors;
const ItemDocument = foundry.documents.Item;
const ChatMessageDocument = foundry.documents.ChatMessage;

const PNJ_SHEET_VERSION = "2026-07-06-pnj-application-v2-v1";
const PNJ_ACTOR_TYPE = "pnj";
const CARACS = [
  ["force", "Force"], ["dexterite", "Dextérité"], ["constitution", "Constitution"],
  ["intelligence", "Intelligence"], ["sagesse", "Sagesse"], ["charisme", "Charisme"]
];
const SAVE_LABELS = ["Paralysie / Mort", "Baguettes", "Pétrification", "Souffles", "Sorts"];
const MARTIAL_CLASS_SLUGS = new Set(["guerrier", "paladin", "rodeur", "ranger"]);
const GEAR_TYPES = new Set(["objet", "equipement", "consommable", "loot", "conteneur"]);

globalThis.ADD2E_PNJ_SHEET_VERSION = PNJ_SHEET_VERSION;

function n(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function norm(value) {
  return String(value ?? "").trim().toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function clone(value) {
  if (foundry?.utils?.deepClone) return foundry.utils.deepClone(value);
  if (foundry?.utils?.duplicate) return foundry.utils.duplicate(value);
  return JSON.parse(JSON.stringify(value ?? {}));
}

function array(value) {
  if (Array.isArray(value)) return value.flatMap(array);
  if (value === undefined || value === null || value === "") return [];
  if (typeof value === "string") return value.split(/[,;|\n]+/).map(entry => entry.trim()).filter(Boolean);
  if (typeof value === "object") {
    if (Array.isArray(value.entries)) return value.entries;
    if (Array.isArray(value.lists)) return value.lists;
    if (Array.isArray(value.values)) return value.values;
  }
  return [value];
}

function itemIsEquipped(item) {
  const system = item?.system ?? {};
  return system.equipee === true || system.equipped === true || system.portee === true || system.worn === true;
}

function isShield(item) {
  const text = `${item?.name ?? ""} ${array(item?.system?.tags).join(" ")}`.toLowerCase();
  return text.includes("bouclier") || text.includes("shield");
}

function isHelmet(item) {
  const text = `${item?.name ?? ""} ${array(item?.system?.tags).join(" ")}`.toLowerCase();
  return text.includes("heaume") || text.includes("casque") || text.includes("helmet");
}

function classRow(classItem, level) {
  const rows = Array.isArray(classItem?.system?.progression) ? classItem.system.progression : [];
  return rows.find(row => n(row?.niveau ?? row?.level, 0) === level) ?? rows[Math.max(0, level - 1)] ?? {};
}

function classTitle(classItem, level, row = null) {
  const direct = String(row?.title ?? row?.titre ?? "").trim();
  if (direct) return direct;
  const rows = Array.isArray(classItem?.system?.titlesByLevel) ? classItem.system.titlesByLevel : [];
  const found = rows.find(entry => level >= n(entry?.minLevel ?? entry?.niveauMin, 0) && level <= n(entry?.maxLevel ?? entry?.niveauMax, 999));
  return String(found?.title ?? found?.titre ?? "").trim();
}

function pnjClassEntries(actor) {
  return classItems(actor).map(item => {
    const state = classProgression(item, { level: 1, xp: 0 });
    const level = Math.max(1, state.level);
    const row = classRow(item, level);
    return {
      id: item.id,
      item,
      name: item.name,
      img: item.img || "icons/svg/book.svg",
      slug: classSlug(item),
      level,
      row,
      title: classTitle(item, level, row),
      thac0: n(row?.thac0 ?? row?.thaco, 20),
      saves: Array.isArray(row?.savingThrows) ? row.savingThrows : (Array.isArray(row?.sauvegardes) ? row.sauvegardes : [])
    };
  });
}

function pnjBestSaves(entries) {
  const rows = entries.map(entry => entry.saves).filter(row => Array.isArray(row) && row.length >= 5);
  if (!rows.length) return [20, 20, 20, 20, 20];
  return Array.from({ length: 5 }, (_entry, index) => {
    const values = rows.map(row => n(row[index], NaN)).filter(Number.isFinite);
    return values.length ? Math.min(...values) : 20;
  });
}

function pnjClassSummary(actor) {
  const entries = pnjClassEntries(actor);
  const names = entries.map(entry => entry.name);
  const labels = entries.map(entry => `${entry.name} ${entry.level}${entry.title ? ` (${entry.title})` : ""}`);
  const thacos = entries.map(entry => entry.thac0).filter(Number.isFinite);
  const multi = entries.length > 1;
  const primary = entries[0]?.item ?? null;
  const primarySystem = primary?.system ?? {};
  const spellLists = [];
  for (const entry of entries) {
    const casting = entry.item?.system?.spellcasting;
    for (const value of [entry.item?.system?.spellLists, entry.item?.system?.lists, casting?.lists, casting?.spellLists]) {
      for (const list of array(value)) if (list) spellLists.push(list);
    }
  }
  return {
    entries,
    updates: {
      "system.classe": names.join(" / "),
      "system.details_classe": multi ? { label: names.join(" / "), name: names.join(" / "), multiclass: true, source: "pnj-class-items" } : {
        ...clone(primarySystem), name: primary?.name ?? "", label: primarySystem.label ?? primary?.name ?? "", sourceItemId: primary?.id ?? null, sourceItemUuid: primary?.uuid ?? null
      },
      "system.spellcasting": spellLists.length ? { enabled: true, mode: multi ? "multiclass" : "prepared", lists: [...new Set(spellLists)] } : null,
      "system.niveau": entries.length ? Math.max(...entries.map(entry => entry.level)) : 1,
      "system.xp": 0,
      "system.titre": labels.join(" / "),
      "system.thaco": thacos.length ? Math.min(...thacos) : 20,
      "system.thac0": thacos.length ? Math.min(...thacos) : 20,
      "system.sauvegardes": pnjBestSaves(entries),
      "system.multiclasse": { enabled: multi, mode: "manuel", label: names.join(" / ") }
    }
  };
}

function pnjRacialBonus(actor, key) {
  const bonuses = actor?.system?.bonus_caracteristiques ?? {};
  return n(bonuses?.[key] ?? actor?.system?.[`${key}_race`], 0);
}

function pnjAttributeRows(actor) {
  return CARACS.map(([key, label]) => {
    const base = n(actor.system?.[`${key}_base`] ?? actor.system?.[key], 10);
    const racial = pnjRacialBonus(actor, key);
    return { key, label, base, racial, total: base + racial };
  });
}

function pnjCanExceptionalStrength(actor) {
  const total = n(actor?.system?.force_base ?? actor?.system?.force, 10) + pnjRacialBonus(actor, "force");
  return total === 18 && pnjClassEntries(actor).some(entry => MARTIAL_CLASS_SLUGS.has(entry.slug));
}

function pnjForceExValues(selected) {
  return Array.from({ length: 101 }, (_entry, value) => ({ value, label: value === 0 ? "—" : String(value).padStart(2, "0"), selected: Number(selected) === value }));
}

function pnjSpellLevels(actor) {
  const byLevel = new Map();
  for (const item of actor.items ?? []) {
    if (String(item?.type ?? "").toLowerCase() !== "sort") continue;
    const level = Math.max(1, n(item.system?.niveau ?? item.system?.level, 1));
    const list = byLevel.get(level) ?? [];
    list.push({ id: item.id, name: item.name, img: item.img || "icons/svg/book.svg", memorized: Math.max(0, n(item.getFlag?.("add2e", "memorizedCount") ?? item.flags?.add2e?.memorizedCount, 0)) });
    byLevel.set(level, list);
  }
  return [...byLevel.entries()].sort(([left], [right]) => left - right).map(([level, spells]) => ({ level, spells: spells.sort((left, right) => left.name.localeCompare(right.name, "fr")) }));
}

function pnjMagicDefense(actor) {
  try {
    const result = globalThis.Add2eEffectsEngine?.getMagicPassiveDefense?.(actor, { source: "pnj-sheet" });
    if (Number.isFinite(Number(result?.caTotal))) return { natural: Number(result.caNaturel ?? result.caTotal), total: Number(result.caTotal) };
  } catch (_error) {}

  const equipped = Array.from(actor?.items ?? []).filter(item => itemIsEquipped(item));
  const armors = equipped.filter(item => String(item.type ?? "").toLowerCase() === "armure");
  const body = armors.filter(item => !isShield(item) && !isHelmet(item));
  const shields = armors.filter(isShield);
  const helmets = armors.filter(isHelmet);
  const bodyAc = body.map(item => n(item.system?.ac ?? item.system?.ca, 10)).filter(Number.isFinite);
  const base = bodyAc.length ? Math.min(...bodyAc) : 10;
  const shield = shields.reduce((sum, item) => sum + Math.max(0, n(item.system?.ac ?? item.system?.ca, 1)), 0);
  const helmet = helmets.reduce((sum, item) => sum + Math.max(0, n(item.system?.ac ?? item.system?.ca, 0)), 0);
  const dex = n(actor?.system?.dex_def, 0);
  const natural = base + dex - shield - helmet;
  const objectBonus = equipped.filter(item => GEAR_TYPES.has(String(item.type ?? "").toLowerCase()))
    .reduce((sum, item) => sum + Math.max(0, n(item.system?.bonus_ca ?? item.system?.bonus_ac ?? item.system?.ca_bonus, 0)), 0);
  return { natural, total: natural - objectBonus };
}

async function pnjSetActorImage(actor) {
  const Picker = foundry?.applications?.apps?.FilePicker ?? globalThis.FilePicker ?? null;
  if (!Picker) return false;
  new Picker({ type: "image", current: actor.img, callback: path => actor.update({ img: path, "prototypeToken.texture.src": path }) }).render(true);
  return true;
}

async function pnjResolveDropData(event) {
  let raw = null;
  try { raw = JSON.parse(event?.dataTransfer?.getData("text/plain") || "{}"); } catch (_error) { return null; }
  if (raw?.type !== "Item") return null;
  let data = raw.data ?? null;
  if (!data && raw.uuid) {
    const resolveUuid = foundry?.utils?.fromUuid ?? globalThis.fromUuid;
    const doc = typeof resolveUuid === "function" ? await resolveUuid(raw.uuid) : null;
    if (doc instanceof ItemDocument) data = doc.toObject();
  }
  if (!data && raw.pack && (raw.id || raw._id)) {
    const pack = game.packs.get(raw.pack);
    const doc = pack ? await pack.getDocument(raw.id ?? raw._id) : null;
    if (doc instanceof ItemDocument) data = doc.toObject();
  }
  if (!data || typeof data !== "object") return null;
  delete data._id;
  delete data._stats;
  return clone(data);
}

function pnjSourceClassId(item) {
  const flags = item?.flags?.add2e ?? {};
  return String(flags.autoGrantedByClassId ?? flags.sourceClassId ?? flags.sourceItemId ?? flags.classId ?? "");
}

export class Add2ePnjSheet extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "add2e-pnj-sheet",
    classes: ["add2e", "sheet", "actor", "pnj"],
    tag: "section",
    window: { title: "ADD2e — PNJ", resizable: true },
    position: { width: 980, height: 860 }
  };

  constructor(document, options = {}) {
    super({ id: `add2e-pnj-sheet-${document?.id ?? foundry.utils.randomID()}`, ...options });
    this.actor = document;
    this.document = document;
    this.object = document;
    this._activeTab = "identite";
  }

  get title() { return this.actor?.name ?? "PNJ"; }
  get editable() { return this.actor?.isOwner === true || game.user?.isGM === true; }
  render(options = {}) { return super.render(typeof options === "boolean" ? { force: options } : options); }

  async getData() {
    const actor = this.actor;
    const system = clone(actor.system ?? {});
    const summary = pnjClassSummary(actor);
    for (const [path, value] of Object.entries(summary.updates)) foundry.utils.setProperty({ system }, path, clone(value));
    const race = actor.items.find(item => String(item.type ?? "").toLowerCase() === "race") ?? null;
    const entries = summary.entries;
    const saves = (summary.updates["system.sauvegardes"] ?? [20, 20, 20, 20, 20]).map((value, index) => ({ index, label: SAVE_LABELS[index], value }));
    const itemData = item => ({ id: item.id, name: item.name, img: item.img || "icons/svg/item-bag.svg", equipped: itemIsEquipped(item), ac: n(item.system?.ac ?? item.system?.ca, "—"), quantity: n(item.system?.quantite ?? item.system?.quantity, 1) });
    return {
      actor,
      system,
      raceName: race?.name ?? system.race ?? "Aucune",
      classLabel: summary.updates["system.classe"] || "Aucune",
      attributes: pnjAttributeRows(actor),
      classes: entries,
      saves,
      weapons: actor.items.filter(item => String(item.type ?? "").toLowerCase() === "arme").map(itemData),
      armors: actor.items.filter(item => String(item.type ?? "").toLowerCase() === "armure").map(itemData),
      gear: actor.items.filter(item => GEAR_TYPES.has(String(item.type ?? "").toLowerCase())).map(itemData),
      spellLevels: pnjSpellLevels(actor),
      canExceptionalStrength: pnjCanExceptionalStrength(actor),
      forceExValues: pnjForceExValues(actor.system?.force_ex),
      activeTab: this._activeTab
    };
  }

  async _renderHTML(_context, _options) {
    const html = await foundry.applications.handlebars.renderTemplate("systems/add2e/templates/actor/pnj-sheet.hbs", await this.getData());
    const wrapper = document.createElement("div");
    wrapper.innerHTML = html;
    return wrapper;
  }

  _replaceHTML(result, content, _options) {
    content.replaceChildren(...result.childNodes);
    this.activateListeners(content);
  }

  async _syncClassSummary(reason = "pnj-class-summary") {
    const summary = pnjClassSummary(this.actor);
    const updates = {};
    for (const [path, value] of Object.entries(summary.updates)) {
      if (!foundry.utils.deepEqual?.(foundry.utils.getProperty(this.actor, path), value)) updates[path] = value;
    }
    if (Object.keys(updates).length) await this.actor.update(updates, { add2eInternal: true, add2eReason: reason, render: false });
    return summary;
  }

  async autoSetPointsDeCoup({ syncCurrent = false, force = false, reason = "pnj-hp" } = {}) {
    const entries = pnjClassEntries(this.actor);
    if (!entries.length) return false;
    const conBonus = n(this.actor.system?.con_pv, 0);
    const updates = {};
    let max = 0;
    if (entries.length === 1) {
      const entry = entries[0];
      const die = Math.max(1, n(entry.item.system?.hitDie ?? entry.item.system?.dv, 1));
      const rolls = Array.isArray(this.actor.system?.hpRolls) && !force ? clone(this.actor.system.hpRolls) : [];
      if (!Number.isFinite(n(rolls[0], NaN))) rolls[0] = die;
      for (let index = 1; index < entry.level; index += 1) {
        if (!Number.isFinite(n(rolls[index], NaN)) || n(rolls[index]) < 1 || n(rolls[index]) > die) rolls[index] = 1 + Math.floor(Math.random() * die);
      }
      for (let index = 0; index < entry.level; index += 1) max += (index === 0 ? die : n(rolls[index], 1)) + conBonus;
      updates["system.hpRolls"] = rolls;
    } else {
      const rolls = Array.isArray(this.actor.system?.hpRollsMulticlass) && !force ? clone(this.actor.system.hpRollsMulticlass) : [];
      const highest = Math.max(...entries.map(entry => entry.level));
      for (let index = 0; index < highest; index += 1) {
        let total = 0;
        let count = 0;
        for (const entry of entries) {
          if (entry.level <= index) continue;
          const die = Math.max(1, n(entry.item.system?.hitDie ?? entry.item.system?.dv, 1));
          rolls[index] ??= {};
          const key = entry.slug || entry.id;
          let value = n(rolls[index][key], NaN);
          if (!Number.isFinite(value) || value < 1 || value > die || (force && index > 0)) {
            value = index === 0 ? die : 1 + Math.floor(Math.random() * die);
            rolls[index][key] = value;
          }
          total += value;
          count += 1;
        }
        if (count) max += Math.max(1, Math.ceil(total / count)) + conBonus;
      }
      updates["system.hpRollsMulticlass"] = rolls;
    }
    max = Math.max(1, Math.floor(max));
    updates["system.points_de_coup"] = max;
    if (syncCurrent) updates["system.pdv"] = max;
    await this.actor.update(updates, { add2eInternal: true, add2eReason: reason, render: false });
    return true;
  }

  async autoSetCaracAjustements() {
    const characterMethod = globalThis.Add2eActorSheet?.prototype?.autoSetCaracAjustements;
    if (typeof characterMethod === "function") {
      const bridge = { actor: this.actor, autoSetPointsDeCoup: options => this.autoSetPointsDeCoup(options) };
      await characterMethod.call(bridge);
    }
    const totals = {};
    for (const [key] of CARACS) totals[`system.${key}`] = n(this.actor.system?.[`${key}_base`] ?? this.actor.system?.[key], 10) + pnjRacialBonus(this.actor, key);
    await this.actor.update(totals, { add2eInternal: true, add2eReason: "pnj-ability-totals", render: false });
    return true;
  }

  async _recalculateDefense() {
    const defense = pnjMagicDefense(this.actor);
    await this.actor.update({ "system.ca_naturel": defense.natural, "system.ca_total": defense.total }, { add2eInternal: true, add2eReason: "pnj-defense", render: false });
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
    await globalThis.add2eApplyRaceItemDataToActor(this.actor, data, this, { notify: true, reason: "pnj-race-drop" });
    await this.recalculateAll({ reason: "pnj-race-drop" });
  }

  async _addClass(data) {
    const classes = pnjClassEntries(this.actor);
    if (classes.length >= 3) {
      const DialogV2 = foundry?.applications?.api?.DialogV2;
      const content = "<p>Un PNJ ne peut pas avoir plus de trois classes.</p>";
      if (DialogV2?.alert) await DialogV2.alert({ window: { title: "Maximum atteint" }, content, ok: { label: "Compris" }, modal: true });
      else ui.notifications.warn("Un PNJ ne peut pas avoir plus de trois classes.");
      return false;
    }
    const slug = classSlug(data);
    if (classes.some(entry => entry.slug === slug)) return ui.notifications.warn(`${data.name} est déjà attribuée à ce PNJ.`);
    const itemData = cloneItemData(data) ?? clone(data);
    itemData.type = "classe";
    itemData.system ??= {};
    itemData.system.niveau = Math.max(1, n(itemData.system.niveau, 1));
    itemData.system.xp = 0;
    itemData.flags ??= {};
    itemData.flags.add2e ??= {};
    itemData.flags.add2e.pnjClass = true;
    const [classDoc] = await this.actor.createEmbeddedDocuments("Item", [itemData], { add2eInternal: true, add2eReason: "pnj-add-class" });
    if (!classDoc) return false;
    const effects = (classDoc.effects?.contents ?? []).map(effect => {
      const effectData = effect.toObject();
      delete effectData._id;
      effectData.origin = classDoc.uuid;
      effectData.transfer = false;
      effectData.flags ??= {};
      effectData.flags.add2e = { ...(effectData.flags.add2e ?? {}), sourceType: "classe", sourceItemId: classDoc.id, sourceItemUuid: classDoc.uuid, sourceClasse: classDoc.name };
      return effectData;
    });
    if (effects.length) await this.actor.createEmbeddedDocuments("ActiveEffect", effects, { add2eInternal: true, add2eReason: "pnj-add-class-effects" });
    try { await globalThis.add2eSyncActorSpellsFromClass?.(this.actor, classDoc, { mode: "append", showWait: true }); } catch (error) { console.warn("[ADD2E][PNJ][SPELL_SYNC]", error); }
    await this.recalculateAll({ syncCurrentHp: true, reason: "pnj-add-class" });
    return true;
  }

  async _removeClass(item) {
    if (!item) return false;
    const effectIds = this.actor.effects.filter(effect => String(effect.origin ?? "") === String(item.uuid ?? "") || String(effect.flags?.add2e?.sourceItemId ?? "") === String(item.id)).map(effect => effect.id);
    const spellIds = this.actor.items.filter(candidate => String(candidate.type ?? "").toLowerCase() === "sort" && pnjSourceClassId(candidate) === String(item.id)).map(candidate => candidate.id);
    if (effectIds.length) await this.actor.deleteEmbeddedDocuments("ActiveEffect", effectIds, { add2eInternal: true, add2eReason: "pnj-remove-class-effects" });
    if (spellIds.length) await this.actor.deleteEmbeddedDocuments("Item", spellIds, { add2eInternal: true, add2eReason: "pnj-remove-class-spells" });
    await this.actor.deleteEmbeddedDocuments("Item", [item.id], { add2eInternal: true, add2eReason: "pnj-remove-class" });
    await this.recalculateAll({ reason: "pnj-remove-class" });
    return true;
  }

  async _removeRace(item) {
    if (!item) return false;
    const effectIds = this.actor.effects.filter(effect => String(effect.origin ?? "") === String(item.uuid ?? "") || String(effect.flags?.add2e?.sourceItemId ?? "") === String(item.id)).map(effect => effect.id);
    if (effectIds.length) await this.actor.deleteEmbeddedDocuments("ActiveEffect", effectIds, { add2eInternal: true, add2eReason: "pnj-remove-race-effects" });
    await this.actor.deleteEmbeddedDocuments("Item", [item.id], { add2eInternal: true, add2eReason: "pnj-remove-race" });
    await this.actor.update({ "system.race": "", "system.details_race": {}, "system.bonus_caracteristiques": {} }, { add2eInternal: true, add2eReason: "pnj-remove-race-data" });
    await this.recalculateAll({ reason: "pnj-remove-race" });
    return true;
  }

  async _equip(item) {
    if (!item) return false;
    const update = { "system.equipee": !itemIsEquipped(item) };
    if (String(item.type ?? "").toLowerCase() === "armure" && update["system.equipee"] === true && !isShield(item) && !isHelmet(item)) {
      const updates = this.actor.items.filter(candidate => String(candidate.type ?? "").toLowerCase() === "armure" && candidate.id !== item.id && !isShield(candidate) && !isHelmet(candidate) && itemIsEquipped(candidate))
        .map(candidate => ({ _id: candidate.id, "system.equipee": false }));
      if (updates.length) await this.actor.updateEmbeddedDocuments("Item", updates, { add2eInternal: true, add2eReason: "pnj-equip-body-armor" });
    }
    await item.update(update, { add2eInternal: true, add2eReason: "pnj-equip-item" });
    await this._recalculateDefense();
    return true;
  }

  async _setClassLevel(item, value) {
    const level = Math.max(1, Math.floor(n(value, 1)));
    await item.update({ "system.niveau": level, "system.xp": 0 }, { add2eInternal: true, add2eReason: "pnj-class-level" });
    try { await globalThis.add2eSyncActorSpellsFromClass?.(this.actor, item, { mode: "append", showWait: true }); } catch (error) { console.warn("[ADD2E][PNJ][SPELL_SYNC_LEVEL]", error); }
    await this.recalculateAll({ reason: "pnj-class-level" });
  }

  async _rollSave(index, threshold) {
    const roll = new Roll("1d20");
    await roll.evaluate();
    if (game.dice3d) await game.dice3d.showForRoll(roll, game.user, true);
    const success = roll.total >= threshold;
    const label = SAVE_LABELS[index] ?? "Sauvegarde";
    const content = `<div class="add2e-card-test" style="border:1px solid #7e2b25;border-radius:8px;padding:8px;background:#fffaf0"><strong>${label}</strong><div>Seuil : <b>${threshold}</b> — Jet : <b>${roll.total}</b></div><div style="font-weight:900;color:${success ? "#2d6b36" : "#9a2720"}">${success ? "SUCCÈS" : "ÉCHEC"}</div></div>`;
    await ChatMessageDocument.create({ speaker: ChatMessageDocument.getSpeaker({ actor: this.actor }), content });
  }

  async _drop(event) {
    event.preventDefault();
    const data = await pnjResolveDropData(event);
    if (!data) return false;
    const type = String(data.type ?? "").toLowerCase();
    if (type === "race") await this._applyRace(data);
    else if (type === "classe") await this._addClass(data);
    else {
      const [created] = await this.actor.createEmbeddedDocuments("Item", [data], { add2eInternal: true, add2eReason: "pnj-item-drop" });
      if (created?.type === "sort" && created.getFlag("add2e", "memorizedCount") === undefined) await created.setFlag("add2e", "memorizedCount", 0);
      await this._recalculateDefense();
    }
    this.render(false);
    return false;
  }

  async _saveForm(form) {
    const flat = Object.fromEntries(new FormData(form).entries());
    delete flat.name;
    const update = foundry.utils.expandObject(flat);
    const payload = {};
    if (update.system) payload.system = update.system;
    const name = String(form.querySelector('[name="name"]')?.value ?? "").trim();
    if (name) payload.name = name;
    await this.actor.update(payload, { add2eReason: "pnj-sheet-form" });
    const recalculation = Object.keys(flat).some(key => key.startsWith("system.force_") || key.startsWith("system.dexterite_") || key.startsWith("system.constitution_") || key.startsWith("system.intelligence_") || key.startsWith("system.sagesse_") || key.startsWith("system.charisme_"));
    if (recalculation) await this.recalculateAll({ reason: "pnj-sheet-ability-change" });
  }

  activateListeners(content) {
    const root = content instanceof HTMLElement ? content : content?.[0];
    if (!root) return;
    const form = root.matches("form") ? root : root.querySelector("form");
    root.addEventListener("dragover", event => event.preventDefault());
    root.addEventListener("drop", event => this._drop(event).catch(error => console.error("[ADD2E][PNJ][DROP]", error)));
    form?.addEventListener("change", event => {
      const target = event.target;
      if (target?.matches?.('[data-action="class-level"]')) return;
      this._saveForm(form).then(() => this.render(false)).catch(error => console.error("[ADD2E][PNJ][FORM]", error));
    });
    root.addEventListener("click", event => {
      const button = event.target?.closest?.("[data-action]");
      if (!button || !root.contains(button)) return;
      event.preventDefault();
      const action = button.dataset.action;
      const item = this.actor.items.get(button.dataset.itemId);
      const rerender = () => this.render(false);
      if (action === "tab") { this._activeTab = button.dataset.tab || "identite"; root.querySelectorAll(".a2e-pnj-tab").forEach(tab => tab.classList.toggle("active", tab.dataset.tab === this._activeTab)); root.querySelectorAll(".a2e-pnj-content").forEach(tab => tab.classList.toggle("active", tab.dataset.tab === this._activeTab)); return; }
      if (action === "edit-image") return pnjSetActorImage(this.actor);
      if (action === "roll-save") return this._rollSave(n(button.dataset.saveIndex, 0), n(button.dataset.saveValue, 20));
      if (action === "delete-class" && item) return this._removeClass(item).then(rerender);
      if (action === "delete-race" && item) return this._removeRace(item).then(rerender);
      if (action === "equip-item" && item) return this._equip(item).then(rerender);
      if (action === "attack" && item) {
        if (typeof globalThis.add2eAttackRoll !== "function") return ui.notifications.warn("Le moteur d’attaque ADD2E est indisponible.");
        return globalThis.add2eAttackRoll({ actor: this.actor, arme: item });
      }
      if (action === "cast-spell" && item) {
        if (typeof globalThis.add2eCastSpell !== "function") return ui.notifications.warn("Le moteur de sorts ADD2E est indisponible.");
        return globalThis.add2eCastSpell({ actor: this.actor, sort: item }).then(rerender);
      }
      if (action === "spell-memory" && item) {
        const current = Math.max(0, n(item.getFlag("add2e", "memorizedCount"), 0));
        return item.setFlag("add2e", "memorizedCount", Math.max(0, current + n(button.dataset.delta, 0))).then(rerender);
      }
      if (action === "edit-item" && item) return item.sheet.render(true);
      if (action === "delete-item" && item) return this.actor.deleteEmbeddedDocuments("Item", [item.id], { add2eReason: "pnj-delete-item" }).then(async () => { await this._recalculateDefense(); rerender(); });
    });
    root.addEventListener("change", event => {
      const input = event.target?.closest?.('[data-action="class-level"]');
      if (input) this._setClassLevel(this.actor.items.get(input.dataset.itemId), input.value).then(() => this.render(false));
    });
  }
}

function installPnjSpellComponentBypass() {
  const api = globalThis.ADD2E_CONSUMABLES;
  if (!api?.add2eReserveSpellComponents || api.__add2ePnjComponentBypass === PNJ_SHEET_VERSION) return false;
  const original = api.add2eReserveSpellComponents.bind(api);
  api.add2eReserveSpellComponents = async (actor, sort) => actor?.type === PNJ_ACTOR_TYPE ? { blocked: false, skipped: true, actor, sort } : original(actor, sort);
  api.__add2ePnjComponentBypass = PNJ_SHEET_VERSION;
  return true;
}

function installPnjRecalculationHooks() {
  Hooks.on("updateItem", (item, _changes, options = {}) => {
    const actor = item?.parent;
    if (actor?.type !== PNJ_ACTOR_TYPE || options?.add2eInternal) return;
    const sheet = actor.sheet;
    if (sheet instanceof Add2ePnjSheet && ["armure", "arme", "objet", "equipement", "consommable", "classe"].includes(String(item.type ?? "").toLowerCase())) sheet.recalculateAll({ reason: "pnj-item-update" }).catch(error => console.warn("[ADD2E][PNJ][RECALC]", error));
  });
}

ActorsCollection.registerSheet("add2e", Add2ePnjSheet, { types: [PNJ_ACTOR_TYPE], makeDefault: true, label: "ADD2e — PNJ" });
Hooks.once("ready", () => { installPnjSpellComponentBypass(); installPnjRecalculationHooks(); });
try { globalThis.Add2ePnjSheet = Add2ePnjSheet; } catch (_error) {}
