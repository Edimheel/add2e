import { classItems, classProgression, classSlug, cloneItemData } from "./add2e/17b-multiclass-core.mjs";
import { add2ePrepareActorSheetBaseData } from "./add2e/13b-actor-sheet-get-data-base.mjs";
import { add2ePrepareActorSheetCombatData } from "./add2e/13b-actor-sheet-get-data-combat.mjs";
import { add2ePopulateActorSheetSpellData } from "./add2e/13b-actor-sheet-get-data-spells.mjs";
import { add2ePopulateActorSheetActiveEffectsData } from "./add2e/13b-actor-sheet-get-data-core.mjs";
import { add2eBindActorSheetSpellListeners } from "./add2e/13d-actor-sheet-listeners-spells.mjs";
import { add2eRollCharacteristicCard, add2eRollSaveCard } from "./add2e/13d-actor-sheet-listeners-rolls.mjs";
import { getMoney, formatMoney, isAmmunition, isComponent } from "./add2e/22a-vendor-core.mjs";

const PNJ_SHEET_VERSION = "2026-07-06-pnj-character-sheet-reuse-v7";
const PNJ_TYPE = "pnj";
const DialogV2 = foundry?.applications?.api?.DialogV2;
const ActorsCollection = foundry.documents.collections.Actors;
const CharacterSheetBase = globalThis.Add2eActorSheet;
const CARACS = ["force", "dexterite", "constitution", "intelligence", "sagesse", "charisme"];
const ALIGNMENTS = [
  "Loyal bon", "Neutre bon", "Chaotique bon",
  "Loyal neutre", "Neutre strict", "Chaotique neutre",
  "Loyal mauvais", "Neutre mauvais", "Chaotique mauvais"
];

if (!CharacterSheetBase) throw new Error("[ADD2E][PNJ] La feuille personnage ApplicationV2 doit être chargée avant la feuille PNJ.");
globalThis.ADD2E_PNJ_SHEET_VERSION = PNJ_SHEET_VERSION;

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clone(value) {
  if (foundry?.utils?.deepClone) return foundry.utils.deepClone(value);
  if (foundry?.utils?.duplicate) return foundry.utils.duplicate(value);
  return JSON.parse(JSON.stringify(value ?? {}));
}

function same(left, right) {
  if (typeof foundry?.utils?.deepEqual === "function") return foundry.utils.deepEqual(left, right);
  return JSON.stringify(left) === JSON.stringify(right);
}

function classRow(item, level) {
  const rows = Array.isArray(item?.system?.progression) ? item.system.progression : [];
  return rows.find(row => number(row?.niveau ?? row?.level, 0) === level) ?? rows[Math.max(0, level - 1)] ?? {};
}

function classTitle(item, level, row) {
  const direct = String(row?.title ?? row?.titre ?? "").trim();
  if (direct) return direct;
  const titles = Array.isArray(item?.system?.titlesByLevel) ? item.system.titlesByLevel : [];
  const title = titles.find(entry => level >= number(entry?.minLevel ?? entry?.niveauMin, 0) && level <= number(entry?.maxLevel ?? entry?.niveauMax, 999));
  return String(title?.title ?? title?.titre ?? "").trim();
}

function pnjClassEntries(actor) {
  return classItems(actor).map(item => {
    const progression = classProgression(item, { level: 1, xp: 0 });
    const level = Math.max(1, progression.level);
    const row = classRow(item, level);
    return {
      id: item.id,
      item,
      name: item.name,
      img: item.img || "icons/svg/book.svg",
      slug: classSlug(item),
      level,
      xp: progression.xp,
      row,
      title: classTitle(item, level, row),
      thac0: number(row?.thac0 ?? row?.thaco, 20),
      saves: Array.isArray(row?.savingThrows) ? row.savingThrows : (Array.isArray(row?.sauvegardes) ? row.sauvegardes : [])
    };
  });
}

function pnjBestSaves(entries) {
  const tables = entries.map(entry => entry.saves).filter(values => Array.isArray(values) && values.length >= 5);
  if (!tables.length) return [20, 20, 20, 20, 20];
  return Array.from({ length: 5 }, (_unused, index) => {
    const values = tables.map(table => number(table[index], NaN)).filter(Number.isFinite);
    return values.length ? Math.min(...values) : 20;
  });
}

function pnjClassState(actor) {
  const entries = pnjClassEntries(actor);
  const names = entries.map(entry => entry.name);
  const titles = entries.map(entry => `${entry.name} ${entry.level}${entry.title ? ` (${entry.title})` : ""}`);
  const thac0 = entries.length ? Math.min(...entries.map(entry => entry.thac0)) : 20;
  const saves = pnjBestSaves(entries);
  const source = entries.find(entry => entry.thac0 === thac0) ?? entries[0] ?? null;

  return {
    entries,
    update: {
      "system.classe": names.join(" / "),
      "system.niveau": entries.length ? Math.max(...entries.map(entry => entry.level)) : 1,
      "system.xp": 0,
      "system.titre": titles.join(" / "),
      "system.thaco": thac0,
      "system.thac0": thac0,
      "system.sauvegardes": saves,
      "system.multiclasse": { enabled: entries.length > 1, mode: "manuel", label: names.join(" / ") }
    },
    progression: {
      ...(clone(source?.row ?? {})),
      title: source?.title ?? "",
      thac0,
      savingThrows: saves
    },
    classProgression: {
      enabled: entries.length > 0,
      isMulticlass: entries.length > 1,
      classes: entries.map(entry => ({
        itemId: entry.id,
        name: entry.name,
        slug: entry.slug,
        level: entry.level,
        xp: entry.xp,
        nextXp: "",
        title: entry.title
      }))
    }
  };
}

function pnjRaceName(actor) {
  const race = actor?.items?.find?.(item => String(item?.type ?? "").toLowerCase() === "race") ?? null;
  return String(race?.name ?? actor?.system?.race ?? actor?.system?.details_race?.label ?? "").trim();
}

function pnjActorView(actor, system) {
  return {
    id: actor.id,
    _id: actor.id,
    uuid: actor.uuid,
    name: actor.name,
    img: actor.img,
    type: actor.type,
    system,
    flags: clone(actor.flags ?? {}),
    items: actor.items,
    effects: actor.effects,
    isOwner: actor.isOwner === true,
    limited: actor.limited === true
  };
}

function pnjItemBelongsToClass(item, classItem) {
  const flags = item?.flags?.add2e ?? {};
  const sourceId = String(flags.autoGrantedByClassId ?? flags.sourceClassId ?? flags.sourceItemId ?? flags.classId ?? "");
  const sourceSlug = String(flags.autoGrantedByClass ?? flags.sourceClassSlug ?? flags.sourceClasse ?? flags.sourceClass ?? "").trim().toLowerCase();
  return sourceId === String(classItem?.id ?? "") || (sourceSlug && sourceSlug === String(classItem?.system?.slug ?? classItem?.name ?? "").trim().toLowerCase());
}

async function pnjDroppedItemData(event, rawData = null) {
  let raw = rawData;
  if (!raw) {
    try { raw = JSON.parse(event?.dataTransfer?.getData("text/plain") || "{}"); }
    catch (_error) { return null; }
  }
  if (raw?.type !== "Item") return null;

  if (typeof globalThis.add2eResolveDropItemDataCompendiumFirst === "function") {
    const resolved = await globalThis.add2eResolveDropItemDataCompendiumFirst(raw).catch(() => null);
    if (resolved) {
      const copy = clone(resolved);
      delete copy._id;
      delete copy._stats;
      return copy;
    }
  }

  let data = raw.data ?? null;
  if (!data && raw.uuid) {
    const document = await globalThis.fromUuid?.(raw.uuid);
    if (document?.documentName === "Item") data = document.toObject();
  }
  if (!data && raw.pack && (raw.id || raw._id)) {
    const pack = game.packs.get(raw.pack);
    const document = pack ? await pack.getDocument(raw.id ?? raw._id) : null;
    if (document?.documentName === "Item") data = document.toObject();
  }
  if (!data || typeof data !== "object") return null;

  const copy = clone(data);
  delete copy._id;
  delete copy._stats;
  return copy;
}

async function pnjChooseImage(actor) {
  const Picker = globalThis.FilePicker;
  if (!Picker) return false;
  new Picker({
    type: "image",
    current: actor.img,
    callback: path => actor.update({ img: path, "prototypeToken.texture.src": path })
  }).render(true);
  return true;
}

export class Add2ePnjSheet extends CharacterSheetBase {
  static DEFAULT_OPTIONS = {
    id: "add2e-pnj-{id}",
    classes: ["add2e", "sheet", "actor", "pnj", "add2e-character-v2-app"],
    tag: "form",
    position: { width: 1050, height: 900 },
    window: { title: "ADD2e — PNJ", resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false, handler: Add2ePnjSheet._onSubmitForm }
  };

  static PARTS = { main: { template: "systems/add2e/templates/actor/pnj-sheet.hbs" } };

  static async _onSubmitForm(_event, _form, formData) {
    const app = this;
    const actor = app?.actor ?? app?.document;
    if (!actor?.update) return;

    const values = formData?.object ?? {};
    const expanded = foundry.utils.expandObject(values);
    const submittedProgression = foundry.utils.getProperty(expanded, "add2e.classProgression") ?? {};
    let classLevelChanged = false;

    for (const [itemId, state] of Object.entries(submittedProgression)) {
      if (!state || state.level === undefined) continue;
      const item = actor.items?.get?.(itemId);
      if (!item || String(item.type ?? "").toLowerCase() !== "classe") continue;
      const nextLevel = Math.max(1, Math.floor(number(state.level, 1)));
      const currentLevel = Math.max(1, Math.floor(number(item.system?.niveau, 1)));
      if (nextLevel === currentLevel) continue;
      await app._setClassLevel(item, nextLevel, { synchronize: false });
      classLevelChanged = true;
    }

    if (expanded.system?.race !== undefined) delete expanded.system.race;
    const update = {};
    if (expanded.system) update.system = expanded.system;
    if (expanded.flags) update.flags = expanded.flags;
    if (typeof expanded.name === "string" && expanded.name.trim()) update.name = expanded.name.trim();
    if (Object.keys(update).length) await actor.update(update, { add2eReason: "pnj-sheet-form" });

    const changedCarac = Object.keys(values).some(key => /^system\.(force|dexterite|constitution|intelligence|sagesse|charisme)(?:_|$)/.test(key));
    if (classLevelChanged) await app._syncDerived({ reason: "pnj-class-level-form" });
    else if (changedCarac && typeof app?._syncDerived === "function") await app._syncDerived({ reason: "pnj-sheet-caracteristics" });
  }

  async getData() {
    const actor = this.actor;
    const system = clone(actor.system ?? {});
    const data = { actor: pnjActorView(actor, system) };
    const state = add2ePrepareActorSheetBaseData({ sheet: this, data });
    const classState = pnjClassState(actor);
    const raceName = pnjRaceName(actor);

    for (const [path, value] of Object.entries(classState.update)) {
      const key = path.replace(/^system\./, "");
      state.sys[key] = clone(value);
    }
    state.sys.race = raceName;

    data.actor.system = state.sys;
    data.system = state.sys;
    data.classProgression = classState.classProgression;
    data.progressionCourante = classState.progression;
    data.isPnj = true;
    data.alignementsDisponibles = ALIGNMENTS;
    data.listeObjetsDivers = state.items.filter(item => item.type === "objet" && !isComponent(item) && !isAmmunition(item));
    data.add2eVendorMoney = getMoney(actor);
    data.add2eVendorMoneyLabel = formatMoney(data.add2eVendorMoney);
    data.listeCarquois = [];
    data.listeSacocheComposants = [];
    data.add2eConsumablesSummary = { carquoisQuantity: 0, sacocheQuantity: 0 };

    if (!state.sys.movement) state.sys.movement = number(actor.system?.movement ?? actor.system?.vitesse_deplacement, 12);

    add2ePrepareActorSheetCombatData({
      actor,
      data,
      sys: state.sys,
      progressionCourante: classState.progression,
      isMonk: false
    });
    add2ePopulateActorSheetSpellData({ actor, data, items: state.items });
    add2ePopulateActorSheetActiveEffectsData(actor, data);

    data.activeTab = this._add2eGetNativeActiveTab?.() || this._add2eActiveTab || this._add2eReadStoredTab?.() || "resume";
    this._add2ePreparedData = data;
    return data;
  }

  async _onRender(context, options = {}) {
    await super._onRender?.(context, options);
    const root = this.element?.jquery ? this.element[0] : this.element;
    const raceInput = root?.querySelector?.('input[name="system.race"]');
    if (raceInput) {
      raceInput.value = pnjRaceName(this.actor);
      raceInput.readOnly = true;
      raceInput.title = "Race définie par l’Item Race déposé sur le PNJ.";
    }
    this.activateListeners(root);
  }

  async _onDrop(event, rawData = null) {
    if (event?.__add2ePnjDropHandled) return false;
    if (event) event.__add2ePnjDropHandled = true;
    event?.preventDefault?.();
    event?.stopPropagation?.();

    let raw = rawData;
    if (!raw) {
      try { raw = JSON.parse(event?.dataTransfer?.getData("text/plain") || "{}"); }
      catch (_error) { return false; }
    }
    if (raw?.type !== "Item") return false;

    const itemData = await pnjDroppedItemData(event, raw);
    if (!itemData) return false;
    if (isAmmunition(itemData) || isComponent(itemData)) {
      ui.notifications.info("Les PNJ n’utilisent ni projectiles ni composants de sorts.");
      return false;
    }

    const type = String(itemData.type ?? "").toLowerCase();
    if (type === "race") return this._applyRace(itemData);
    if (type === "classe") return this._addClass(itemData);

    return super._onDrop(event, raw);
  }

  async _syncClassState(reason = "pnj-class-state") {
    const state = pnjClassState(this.actor);
    const update = {};
    for (const [path, value] of Object.entries(state.update)) {
      if (!same(foundry.utils.getProperty(this.actor, path), value)) update[path] = value;
    }
    if (Object.keys(update).length) await this.actor.update(update, { add2eInternal: true, add2eReason: reason, render: false });
    return state;
  }

  async _syncDerived({ syncCurrentHp = false, reason = "pnj-derived" } = {}) {
    const state = await this._syncClassState(`${reason}:classes`);
    if (typeof this.autoSetCaracAjustements === "function") await this.autoSetCaracAjustements();

    if (state.entries.length > 1 && typeof globalThis.add2eSyncMulticlassHp === "function") {
      await globalThis.add2eSyncMulticlassHp(this.actor, { syncCurrent: syncCurrentHp, reason: `${reason}:multiclass-hp` });
    } else if (typeof this.autoSetPointsDeCoup === "function") {
      await this.autoSetPointsDeCoup({ syncCurrent: syncCurrentHp, reason: `${reason}:hp` });
    }
  }

  async _applyRace(data) {
    if (typeof globalThis.add2eApplyRaceItemDataToActor !== "function") throw new Error("Le gestionnaire de race ADD2E est indisponible.");
    await globalThis.add2eApplyRaceItemDataToActor(this.actor, data, this, { notify: true, reason: "pnj-race-drop" });
    await this._syncDerived({ reason: "pnj-race-drop" });
    return true;
  }

  async _addClass(data) {
    const actor = this.actor;
    const existing = pnjClassEntries(actor);
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

    const [classItem] = await actor.createEmbeddedDocuments("Item", [itemData], { add2eInternal: true, add2eReason: "pnj-add-class" });
    if (!classItem) return false;

    const effects = (classItem.effects?.contents ?? []).map(effect => {
      const effectData = effect.toObject();
      delete effectData._id;
      effectData.origin = classItem.uuid;
      effectData.transfer = false;
      effectData.flags ??= {};
      effectData.flags.add2e = {
        ...(effectData.flags.add2e ?? {}),
        sourceType: "classe",
        sourceItemId: classItem.id,
        sourceItemUuid: classItem.uuid,
        sourceClasse: classItem.name
      };
      return effectData;
    });
    if (effects.length) await actor.createEmbeddedDocuments("ActiveEffect", effects, { add2eInternal: true, add2eReason: "pnj-add-class-effects" });

    try { await globalThis.add2eSyncActorSpellsFromClass?.(actor, classItem, { mode: "append", showWait: true }); }
    catch (error) { console.warn("[ADD2E][PNJ][SPELL_SYNC]", error); }

    await this._syncDerived({ syncCurrentHp: true, reason: "pnj-add-class" });
    return true;
  }

  async _removeClass(item) {
    if (!item) return false;
    const effectIds = this.actor.effects
      .filter(effect => String(effect.origin ?? "") === String(item.uuid ?? "") || pnjItemBelongsToClass(effect, item))
      .map(effect => effect.id);
    const spellIds = this.actor.items
      .filter(candidate => String(candidate.type ?? "").toLowerCase() === "sort" && pnjItemBelongsToClass(candidate, item))
      .map(candidate => candidate.id);
    if (effectIds.length) await this.actor.deleteEmbeddedDocuments("ActiveEffect", effectIds, { add2eInternal: true, add2eReason: "pnj-remove-class-effects" });
    if (spellIds.length) await this.actor.deleteEmbeddedDocuments("Item", spellIds, { add2eInternal: true, add2eReason: "pnj-remove-class-spells" });
    await this.actor.deleteEmbeddedDocuments("Item", [item.id], { add2eInternal: true, add2eReason: "pnj-remove-class" });
    await this._syncDerived({ reason: "pnj-remove-class" });
    return true;
  }

  async _setClassLevel(item, value, { synchronize = true } = {}) {
    if (!item) return false;
    const level = Math.max(1, Math.floor(number(value, 1)));
    await item.update({ "system.niveau": level, "system.xp": 0 }, { add2eInternal: true, add2eReason: "pnj-class-level" });
    try { await globalThis.add2eSyncActorSpellsFromClass?.(this.actor, item, { mode: "append", showWait: true }); }
    catch (error) { console.warn("[ADD2E][PNJ][SPELL_LEVEL_SYNC]", error); }
    if (synchronize) await this._syncDerived({ reason: "pnj-class-level" });
    return true;
  }

  async _equip(item) {
    if (!item) return false;
    const actor = this.actor;
    const equip = item.system?.equipee !== true;
    if (item.type === "armure" && equip) {
      const name = String(item.name ?? "").toLowerCase();
      const shield = name.includes("bouclier");
      const helmet = name.includes("heaume") || name.includes("casque");
      if (!shield && !helmet) {
        const updates = actor.items
          .filter(candidate => candidate.type === "armure" && candidate.id !== item.id && candidate.system?.equipee === true && !String(candidate.name ?? "").toLowerCase().includes("bouclier") && !/heaume|casque/.test(String(candidate.name ?? "").toLowerCase()))
          .map(candidate => ({ _id: candidate.id, "system.equipee": false }));
        if (updates.length) await actor.updateEmbeddedDocuments("Item", updates, { add2eInternal: true, add2eReason: "pnj-unequip-body-armor" });
      }
    }
    await item.update({ "system.equipee": equip }, { add2eInternal: true, add2eReason: "pnj-equip" });
    return true;
  }

  async _adjustCarac(carac, delta) {
    if (!CARACS.includes(carac)) return false;
    const current = number(this.actor.system?.[`${carac}_base`] ?? this.actor.system?.[carac], 10);
    const next = Math.max(3, Math.min(25, current + number(delta, 0)));
    await this.actor.update({ [`system.${carac}_base`]: next }, { add2eReason: "pnj-adjust-carac" });
    await this._syncDerived({ reason: "pnj-adjust-carac" });
    return true;
  }

  activateListeners(content) {
    const root = content?.jquery ? content[0] : content;
    const sheetRoot = root?.querySelector?.(".add2e-pnj-sheet") ?? root;
    if (!(sheetRoot instanceof HTMLElement) || sheetRoot.dataset.add2ePnjListeners === PNJ_SHEET_VERSION) return;
    sheetRoot.dataset.add2ePnjListeners = PNJ_SHEET_VERSION;
    const html = $(sheetRoot);

    this._add2eBindPersistentTabs?.(html);
    add2eBindActorSheetSpellListeners(this, html);

    sheetRoot.addEventListener("click", event => {
      const image = event.target?.closest?.('[data-edit="img"]');
      if (image && sheetRoot.contains(image)) {
        event.preventDefault();
        event.stopImmediatePropagation?.();
        return pnjChooseImage(this.actor);
      }

      const rollStat = event.target?.closest?.(".roll-stat[data-stat]");
      if (rollStat && sheetRoot.contains(rollStat)) {
        event.preventDefault();
        event.stopImmediatePropagation?.();
        return add2eRollCharacteristicCard(this.actor, rollStat.dataset.stat);
      }

      const rollSave = event.target?.closest?.(".roll-save[data-save]");
      if (rollSave && sheetRoot.contains(rollSave)) {
        event.preventDefault();
        event.stopImmediatePropagation?.();
        return add2eRollSaveCard(this.actor, number(rollSave.dataset.save, 0));
      }

      const carac = event.target?.closest?.(".carac-btn[data-carac]");
      if (carac && sheetRoot.contains(carac)) {
        event.preventDefault();
        event.stopImmediatePropagation?.();
        return this._adjustCarac(carac.dataset.carac, carac.classList.contains("plus") ? 1 : -1).then(() => this.render(false));
      }

      const effectEdit = event.target?.closest?.(".effect-edit[data-effect-id]");
      if (effectEdit && sheetRoot.contains(effectEdit)) {
        event.preventDefault();
        event.stopImmediatePropagation?.();
        return this.actor.effects.get(effectEdit.dataset.effectId)?.sheet?.render(true);
      }

      const effectDelete = event.target?.closest?.(".effect-delete[data-effect-id]");
      if (effectDelete && sheetRoot.contains(effectDelete)) {
        event.preventDefault();
        event.stopImmediatePropagation?.();
        return this.actor.deleteEmbeddedDocuments("ActiveEffect", [effectDelete.dataset.effectId]).then(() => this.render(false));
      }

      const attack = event.target?.closest?.(".arme-img-attack[data-item-id]");
      if (attack && sheetRoot.contains(attack)) {
        event.preventDefault();
        event.stopImmediatePropagation?.();
        const weapon = this.actor.items.get(attack.dataset.itemId);
        if (weapon && typeof globalThis.add2eAttackRoll === "function") return globalThis.add2eAttackRoll({ actor: this.actor, arme: weapon });
        return;
      }

      const control = event.target?.closest?.("[data-action]");
      if (!control || !sheetRoot.contains(control)) return;
      const item = this.actor.items.get(control.dataset.itemId);
      const action = control.dataset.action;
      event.preventDefault();
      event.stopImmediatePropagation?.();

      if (action === "equip" && item) return this._equip(item).then(() => this.render(false));
      if (action === "edit" && item) return item.sheet.render(true);
      if (action === "delete" && item) return this.actor.deleteEmbeddedDocuments("Item", [item.id], { add2eReason: "pnj-delete-item" }).then(() => this.render(false));
    }, true);
  }
}

function installPnjComponentBypass() {
  const api = globalThis.ADD2E_CONSUMABLES;
  if (!api?.add2eReserveSpellComponents || api.__add2ePnjComponentBypass === PNJ_SHEET_VERSION) return;
  const reserve = api.add2eReserveSpellComponents.bind(api);
  api.add2eReserveSpellComponents = async (actor, sort) => actor?.type === PNJ_TYPE
    ? { blocked: false, skipped: true, actor, sort }
    : reserve(actor, sort);
  api.__add2ePnjComponentBypass = PNJ_SHEET_VERSION;
}

ActorsCollection.registerSheet("add2e", Add2ePnjSheet, {
  types: [PNJ_TYPE],
  makeDefault: true,
  label: "ADD2e — PNJ"
});

Hooks.once("ready", installPnjComponentBypass);
try { globalThis.Add2ePnjSheet = Add2ePnjSheet; } catch (_error) {}
