// ADD2E — Mécaniques multiclasses canoniques
// Les Items classe portent seuls la progression.
// Compatible Foundry V13/V14/V15.

import {
  classItems as coreClassItems,
  classProgression,
  multiclassEnabled
} from "./17b-multiclass-core.mjs";

const VERSION = "2026-06-25-item-progression-mechanics-v3";
const TAG = "[ADD2E][MULTICLASSE][MECA]";
const hpTimers = new Map();

globalThis.ADD2E_MULTICLASS_MECHANICS_VERSION = VERSION;

function warn(label, data = {}) {
  console.warn(`${TAG}${label}`, data);
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function classItems(actor) {
  return coreClassItems(actor);
}

function isMulticlassActor(actor) {
  return actor?.type === "personnage" && multiclassEnabled(actor);
}

function classEntries(actor) {
  if (!isMulticlassActor(actor)) return [];
  const entries = [];
  for (const item of classItems(actor)) {
    const progression = classProgression(item);
    if (!progression?.hasLevel || !progression?.hasXp) {
      warn("[ITEM_PROGRESSION_MISSING]", { actor: actor?.name, className: item?.name, itemId: item?.id });
      continue;
    }

    const rows = Array.isArray(item.system?.progression) ? item.system.progression : [];
    const row = rows.find(entry => number(entry?.niveau ?? entry?.level, 0) === progression.level)
      ?? rows[Math.max(0, progression.level - 1)]
      ?? {};

    entries.push({
      item,
      itemId: item.id,
      name: item.name,
      level: progression.level,
      xp: progression.xp,
      system: item.system ?? {},
      row
    });
  }
  return entries;
}

function bestThac0(entries) {
  const values = entries
    .map(entry => number(entry.row?.thac0 ?? entry.row?.thaco ?? entry.row?.tac0 ?? entry.row?.taco, NaN))
    .filter(Number.isFinite);
  return values.length ? Math.min(...values) : null;
}

function bestSavingThrows(entries) {
  const rows = entries
    .map(entry => entry.row?.savingThrows ?? entry.row?.sauvegardes ?? entry.row?.saves)
    .filter(Array.isArray);
  if (!rows.length) return null;

  const length = Math.max(...rows.map(row => row.length));
  return Array.from({ length }, (_value, index) => {
    const values = rows.map(row => number(row[index], NaN)).filter(Number.isFinite);
    return values.length ? Math.min(...values) : "";
  });
}

function classUsesExceptionalStrength(entry) {
  const text = [
    entry?.item?.name,
    entry?.system?.slug,
    entry?.system?.label,
    entry?.system?.nom,
    entry?.system?.name
  ].join(" ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f’']/g, "");

  return text.includes("guerrier") || text.includes("paladin") || text.includes("rodeur") || text.includes("ranger");
}

function actorCanUseExceptionalStrength(actor, entries = null) {
  if (Number(actor?.system?.force ?? 0) !== 18) return false;
  return (entries ?? classEntries(actor)).some(classUsesExceptionalStrength);
}

async function syncMulticlassCombatSummary(actor, { reason = "multiclass-combat-summary" } = {}) {
  const entries = classEntries(actor);
  if (!entries.length) return false;

  const updates = {};
  const thac0 = bestThac0(entries);
  const saves = bestSavingThrows(entries);
  if (thac0 !== null) updates["system.thaco"] = thac0;
  if (saves) updates["system.sauvegardes"] = saves;
  if (!Object.keys(updates).length) return false;

  await actor.update(updates, {
    add2eInternal: true,
    add2eMulticlassInternal: true,
    add2eReason: reason,
    render: false
  });
  return true;
}

async function syncMulticlassHp(actor, { syncCurrent = false, force = false, reason = "multiclass-item-progression" } = {}) {
  const entries = classEntries(actor);
  if (!entries.length) return false;

  const maxLevel = Math.max(...entries.map(entry => entry.level));
  const conBonus = number(actor.system?.con_pv, 0);
  const hpRolls = Array.isArray(actor.system?.hpRollsMulticlass) && !force
    ? foundry.utils.deepClone(actor.system.hpRollsMulticlass)
    : [];

  let hpMax = 0;
  for (let levelIndex = 0; levelIndex < maxLevel; levelIndex += 1) {
    let levelHp = 0;
    let classCount = 0;

    for (const entry of entries) {
      if (entry.level <= levelIndex) continue;
      const hitDie = number(entry.system?.hitDie ?? entry.system?.dv, 0);
      if (hitDie <= 0) continue;

      hpRolls[levelIndex] ??= {};
      let roll = number(hpRolls[levelIndex]?.[entry.itemId], NaN);
      if (!Number.isFinite(roll) || roll < 1 || roll > hitDie || (force && levelIndex > 0)) {
        roll = levelIndex === 0 ? hitDie : 1 + Math.floor(Math.random() * hitDie);
        hpRolls[levelIndex][entry.itemId] = roll;
      }

      levelHp += roll;
      classCount += 1;
    }

    if (classCount > 0) hpMax += Math.max(1, Math.ceil(levelHp / classCount)) + conBonus;
  }

  const updates = {
    "system.hpRollsMulticlass": hpRolls,
    "system.points_de_coup": Math.max(1, Math.floor(hpMax))
  };
  if (syncCurrent) updates["system.pdv"] = updates["system.points_de_coup"];

  await actor.update(updates, {
    add2eInternal: true,
    add2eMulticlassInternal: true,
    add2eReason: reason
  });
  return true;
}

function queueMulticlassStateSync(actor, reason) {
  if (!isMulticlassActor(actor)) return;
  const key = String(actor.uuid ?? actor.id);
  clearTimeout(hpTimers.get(key));
  hpTimers.set(key, setTimeout(async () => {
    hpTimers.delete(key);
    try {
      await syncMulticlassCombatSummary(actor, { reason: `${reason}:combat` });
      await syncMulticlassHp(actor, { reason: `${reason}:hp` });
    } catch (error) {
      warn("[ITEM_STATE_SYNC_ERROR]", { actor: actor?.name, error });
    }
  }, 0));
}

function installSheetPatch() {
  const proto = globalThis.Add2eActorSheet?.prototype;
  if (!proto || proto.__add2eMulticlassMechanicsPatch === VERSION) return false;

  if (typeof proto.autoSetPointsDeCoup === "function" && !proto.__add2eOriginalAutoSetPointsDeCoup) {
    proto.__add2eOriginalAutoSetPointsDeCoup = proto.autoSetPointsDeCoup;
    proto.autoSetPointsDeCoup = async function add2eItemProgressionAutoSetPointsDeCoup(options = {}) {
      if (!isMulticlassActor(this.actor)) return this.__add2eOriginalAutoSetPointsDeCoup(options);
      return syncMulticlassHp(this.actor, options);
    };
  }

  proto.__add2eMulticlassMechanicsPatch = VERSION;
  return true;
}

function installWhenReady() {
  installSheetPatch();
}

globalThis.add2eSyncMulticlassHp = syncMulticlassHp;
globalThis.add2eSyncMulticlassCombatSummary = syncMulticlassCombatSummary;
globalThis.add2eMulticlassClassEntries = classEntries;
globalThis.add2eMulticlassCanUseExceptionalStrength = actorCanUseExceptionalStrength;

Hooks.once("init", installWhenReady);
Hooks.once("ready", installWhenReady);
setTimeout(installWhenReady, 0);

Hooks.on("createItem", item => {
  const actor = item?.parent;
  if (String(item?.type ?? "").toLowerCase() !== "classe") return;
  queueMulticlassStateSync(actor, "create-class-item");
});

Hooks.on("updateItem", (item, _changes, options = {}) => {
  if (options?.add2eInternal || options?.add2eMulticlassInternal) return;
  const actor = item?.parent;
  if (String(item?.type ?? "").toLowerCase() !== "classe") return;
  queueMulticlassStateSync(actor, "update-class-item");
});

Hooks.on("deleteItem", item => {
  const actor = item?.parent;
  if (String(item?.type ?? "").toLowerCase() !== "classe") return;
  queueMulticlassStateSync(actor, "delete-class-item");
});