// ADD2E — Mécaniques multiclasses canoniques
// Compatible Foundry V13/V14/V15.

import { classItems as coreClassItems, classProgression, classSlug, multiclassEnabled } from "./17b-multiclass-core.mjs";

const VERSION = "2026-06-25-item-progression-mechanics-v4";
const TAG = "[ADD2E][MULTICLASSE][MECA]";
const timers = new Map();

globalThis.ADD2E_MULTICLASS_MECHANICS_VERSION = VERSION;

const n = (value, fallback = 0) => {
  const out = Number(value);
  return Number.isFinite(out) ? out : fallback;
};
const classes = actor => coreClassItems(actor);
const isMulti = actor => actor?.type === "personnage" && multiclassEnabled(actor);
const keyFor = entry => classSlug(entry?.item) || String(entry?.itemId ?? "");

function entriesFor(actor) {
  if (!isMulti(actor)) return [];
  return classes(actor).flatMap(item => {
    const state = classProgression(item);
    if (!state?.hasLevel || !state?.hasXp) return [];
    const rows = Array.isArray(item.system?.progression) ? item.system.progression : [];
    const row = rows.find(value => n(value?.niveau ?? value?.level) === state.level) ?? rows[Math.max(0, state.level - 1)] ?? {};
    return [{ item, itemId: item.id, system: item.system ?? {}, level: state.level, xp: state.xp, row }];
  });
}

function bestThac0(entries) {
  const values = entries.map(entry => n(entry.row?.thac0 ?? entry.row?.thaco, NaN)).filter(Number.isFinite);
  return values.length ? Math.min(...values) : null;
}

function bestSaves(entries) {
  const rows = entries.map(entry => entry.row?.savingThrows ?? entry.row?.sauvegardes ?? entry.row?.saves).filter(Array.isArray);
  if (!rows.length) return null;
  return Array.from({ length: Math.max(...rows.map(row => row.length)) }, (_value, index) => {
    const values = rows.map(row => n(row[index], NaN)).filter(Number.isFinite);
    return values.length ? Math.min(...values) : "";
  });
}

async function syncCombat(actor, reason = "multiclass-combat-summary") {
  const entries = entriesFor(actor);
  if (!entries.length) return false;
  const updates = {};
  const thac0 = bestThac0(entries);
  const saves = bestSaves(entries);
  if (thac0 !== null) updates["system.thaco"] = thac0;
  if (saves) updates["system.sauvegardes"] = saves;
  if (!Object.keys(updates).length) return false;
  await actor.update(updates, { add2eInternal: true, add2eMulticlassInternal: true, add2eReason: reason, render: false });
  return true;
}

async function syncHp(actor, { syncCurrent = false, force = false, reason = "multiclass-item-progression" } = {}) {
  const entries = entriesFor(actor);
  if (!entries.length) return false;
  const rolls = Array.isArray(actor.system?.hpRollsMulticlass) && !force ? foundry.utils.deepClone(actor.system.hpRollsMulticlass) : [];
  const conBonus = n(actor.system?.con_pv);
  let max = 0;

  for (let index = 0; index < Math.max(...entries.map(entry => entry.level)); index += 1) {
    let total = 0;
    let count = 0;
    for (const entry of entries) {
      if (entry.level <= index) continue;
      const die = n(entry.system?.hitDie ?? entry.system?.dv);
      if (die <= 0) continue;
      rolls[index] ??= {};
      const key = keyFor(entry);
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

  const updates = { "system.hpRollsMulticlass": rolls, "system.points_de_coup": Math.max(1, Math.floor(max)) };
  if (syncCurrent) updates["system.pdv"] = updates["system.points_de_coup"];
  await actor.update(updates, { add2eInternal: true, add2eMulticlassInternal: true, add2eReason: reason });
  return true;
}

function queue(actor, reason) {
  if (!isMulti(actor)) return;
  const id = String(actor.uuid ?? actor.id);
  clearTimeout(timers.get(id));
  timers.set(id, setTimeout(async () => {
    timers.delete(id);
    try {
      await syncCombat(actor, `${reason}:combat`);
      await syncHp(actor, { reason: `${reason}:hp` });
    } catch (error) {
      console.warn(`${TAG}[SYNC_ERROR]`, { actor: actor?.name, error });
    }
  }, 0));
}

function installSheetPatch() {
  const proto = globalThis.Add2eActorSheet?.prototype;
  if (!proto || proto.__add2eMulticlassMechanicsPatch === VERSION) return;
  if (typeof proto.autoSetPointsDeCoup === "function" && !proto.__add2eOriginalAutoSetPointsDeCoup) {
    proto.__add2eOriginalAutoSetPointsDeCoup = proto.autoSetPointsDeCoup;
    proto.autoSetPointsDeCoup = async function add2eMulticlassHp(options = {}) {
      return isMulti(this.actor) ? syncHp(this.actor, options) : this.__add2eOriginalAutoSetPointsDeCoup(options);
    };
  }
  proto.__add2eMulticlassMechanicsPatch = VERSION;
}

globalThis.add2eSyncMulticlassHp = syncHp;
globalThis.add2eSyncMulticlassCombatSummary = (actor, options = {}) => syncCombat(actor, options.reason);
globalThis.add2eMulticlassClassEntries = entriesFor;

Hooks.once("init", installSheetPatch);
Hooks.once("ready", installSheetPatch);
setTimeout(installSheetPatch, 0);
Hooks.on("createItem", item => { if (String(item?.type ?? "").toLowerCase() === "classe") queue(item.parent, "create-class-item"); });
Hooks.on("updateItem", (item, _changes, options = {}) => {
  if (options?.add2eInternal || options?.add2eMulticlassInternal || String(item?.type ?? "").toLowerCase() !== "classe") return;
  queue(item.parent, "update-class-item");
});
Hooks.on("deleteItem", item => { if (String(item?.type ?? "").toLowerCase() === "classe") queue(item.parent, "delete-class-item"); });