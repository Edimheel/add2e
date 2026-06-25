// ADD2E — Mécaniques multiclasses canoniques
// Les Items classe sont la seule source pour la feuille et les règles.
// Compatible Foundry V13/V14/V15.

import { MULTICLASS_VERSION, classItems as coreClassItems, classProgression, classSlug, multiclassEnabled } from "./17b-multiclass-core.mjs";

const VERSION = "2026-06-25-item-progression-mechanics-v6";
const TAG = "[ADD2E][MULTICLASSE][MECA]";
const timers = new Map();
const THIEF_LABELS = {
  pickpocket: "Faire les poches",
  crochetage_serrures: "Crochetage de serrures",
  detection_pieges: "Détection/désamorçage des pièges",
  deplacement_silencieux: "Déplacement silencieux",
  dissimulation: "Dissimulation dans l’ombre",
  ecoute: "Écoute",
  escalade: "Escalade",
  frappe_dans_le_dos: "Frappe dans le dos",
  lecture_langues: "Lecture des langues",
  assassinat: "Assassinat"
};

globalThis.ADD2E_MULTICLASS_MECHANICS_VERSION = VERSION;

const n = (value, fallback = 0) => {
  const out = Number(value);
  return Number.isFinite(out) ? out : fallback;
};
const classes = actor => coreClassItems(actor);
const isMulti = actor => actor?.type === "personnage" && multiclassEnabled(actor);
const keyFor = entry => classSlug(entry?.item) || String(entry?.itemId ?? "");

function normalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function progressionRows(item) {
  return Array.isArray(item?.system?.progression) ? item.system.progression : [];
}

function rowFor(item, level) {
  const rows = progressionRows(item);
  return rows.find(row => n(row?.niveau ?? row?.level, 0) === level) ?? rows[Math.max(0, level - 1)] ?? {};
}

function parseXpMinimum(value) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.floor(value));
  const raw = String(value ?? "").replace(/\s+/g, "");
  const match = raw.match(/\d[\d.,]*/);
  return match ? Math.max(0, Math.floor(Number(match[0].replace(/\./g, "").replace(",", ".")) || 0)) : 0;
}

function titleFor(entry) {
  const direct = String(entry?.row?.title ?? entry?.row?.titre ?? "").trim();
  if (direct) return direct;
  const titles = Array.isArray(entry?.system?.titlesByLevel) ? entry.system.titlesByLevel : [];
  return String(titles.find(row => entry.level >= n(row?.minLevel ?? row?.niveauMin, 0)
    && entry.level <= n(row?.maxLevel ?? row?.niveauMax, 999))?.title ?? "").trim();
}

function nextXpFor(entry) {
  const next = progressionRows(entry.item).find(row => n(row?.niveau ?? row?.level, 0) > entry.level);
  return next ? parseXpMinimum(next?.xp ?? next?.experience ?? next?.xpRange ?? next?.niveau_xp) : 0;
}

function entriesFor(actor) {
  if (!isMulti(actor)) return [];
  return classes(actor).flatMap(item => {
    const state = classProgression(item);
    if (!state?.hasLevel || !state?.hasXp) return [];
    const level = state.level;
    const row = rowFor(item, level);
    const entry = { item, itemId: item.id, system: item.system ?? {}, level, xp: state.xp, row };
    return [{
      ...entry,
      name: item.name,
      slug: classSlug(item),
      title: titleFor(entry),
      nextXp: nextXpFor(entry),
      levelMaxRace: 0
    }];
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

function combinedSpellcasting(entries) {
  const lists = [...new Set(entries.flatMap(entry => {
    const spellcasting = entry.system?.spellcasting;
    return spellcasting?.enabled === true && Array.isArray(spellcasting.lists) ? spellcasting.lists : [];
  }).filter(Boolean))];
  return lists.length ? {
    enabled: true,
    mode: "multiclass",
    type: "prepared",
    lists,
    usesSlots: true,
    usesPreparation: true,
    preparationSource: "class-items"
  } : null;
}

function applyCompositeProgressionToSheet(actor, data) {
  const entries = entriesFor(actor);
  if (!entries.length || !data) return data;

  const thac0 = bestThac0(entries);
  const saves = bestSaves(entries);
  const label = entries.map(entry => entry.name).join(" / ");
  const title = entries.map(entry => `${entry.name} ${entry.level}${entry.title ? ` (${entry.title})` : ""}`).join(" / ");
  const system = data.actor?.system;

  if (system) {
    system.classe = label;
    system.details_classe = { label, name: label, multiclass: true, source: "class-items" };
    system.spellcasting = combinedSpellcasting(entries);
    system.niveau = Math.max(...entries.map(entry => entry.level));
    system.xp = entries.reduce((total, entry) => total + entry.xp, 0);
    system.titre = title;
    system.progression_xp = entries.map(entry => `${entry.name} ${entry.xp.toLocaleString()}${entry.nextXp ? ` / ${entry.nextXp.toLocaleString()} XP` : " XP"}`).join(" — ");
    if (thac0 !== null) system.thaco = thac0;
    if (saves) system.sauvegardes = foundry.utils.deepClone(saves);
  }

  data.multiclass = {
    enabled: true,
    classes: entries.map(entry => ({
      itemId: entry.itemId,
      name: entry.name,
      slug: entry.slug,
      level: entry.level,
      xp: entry.xp,
      title: entry.title,
      nextXp: entry.nextXp,
      levelMaxRace: entry.levelMaxRace
    })),
    title
  };

  const progression = { ...(data.progressionCourante ?? {}), title, _add2eMulticlassComposite: true };
  if (thac0 !== null) {
    progression.thac0 = thac0;
    progression.thaco = thac0;
  }
  if (saves) {
    progression.savingThrows = foundry.utils.deepClone(saves);
    progression.sauvegardes = foundry.utils.deepClone(saves);
  }
  data.progressionCourante = progression;

  if (data.combatDefense && thac0 !== null) data.combatDefense.thaco = thac0;
  data.canExceptionalStrength = Number(system?.force ?? actor.system?.force) === 18
    && entries.some(entry => ["guerrier", "paladin", "rodeur", "ranger"].includes(entry.slug));
  return data;
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

function thiefItem(actor) {
  return classes(actor).find(item => {
    const system = item.system ?? {};
    const tags = Array.isArray(system.tags) ? system.tags : [];
    const values = [item.name, system.slug, system.label, system.nom, system.name, ...tags].map(normalize);
    return values.some(value => value === "voleur" || value === "classe_voleur" || value.includes("voleur"));
  }) ?? null;
}

function thiefKey(value) {
  const raw = normalize(value)
    .replace(/^competences?_voleur_?/, "")
    .replace(/^thief_skill_?/, "")
    .replace(/^voleur_?/, "");
  const aliases = {
    pick_pockets: "pickpocket", pick_pocket: "pickpocket", pickpockets: "pickpocket", vol_a_la_tire: "pickpocket", tire_laine: "pickpocket",
    open_locks: "crochetage_serrures", open_lock: "crochetage_serrures", crochetage: "crochetage_serrures", crochetage_serrure: "crochetage_serrures", ouverture_de_serrures: "crochetage_serrures",
    find_remove_traps: "detection_pieges", find_traps: "detection_pieges", remove_traps: "detection_pieges", detect_traps: "detection_pieges", desamorcage_pieges: "detection_pieges",
    move_silently: "deplacement_silencieux", deplacement_en_silence: "deplacement_silencieux", silence: "deplacement_silencieux",
    hide_in_shadows: "dissimulation", dissimulation_dans_l_ombre: "dissimulation",
    detect_noise: "ecoute", acuite_auditive: "ecoute", ecouter: "ecoute",
    climb_walls: "escalade", grimper: "escalade",
    backstab: "frappe_dans_le_dos", attaque_dans_le_dos: "frappe_dans_le_dos", dos: "frappe_dans_le_dos",
    read_languages: "lecture_langues", lecture_des_langues: "lecture_langues", langues: "lecture_langues",
    assassination: "assassinat", assassiner: "assassinat", competence_assassin: "assassinat"
  };
  return aliases[raw] ?? raw;
}

function thiefProgression(actor) {
  const item = thiefItem(actor);
  if (!item) return null;
  const state = classProgression(item);
  if (!state.hasLevel) return null;
  return { item, system: item.system ?? {}, level: state.level, row: rowFor(item, state.level) };
}

function thiefSkills(actor) {
  const progression = thiefProgression(actor);
  if (!progression) return [];
  const { system, row } = progression;
  const labels = system.thiefSkillLabels && typeof system.thiefSkillLabels === "object" ? system.thiefSkillLabels : {};
  const structured = row?.thiefSkills ?? row?.voleurSkills ?? row?.competencesVoleur ?? {};
  const legacyValues = Array.isArray(row?.skills) ? row.skills : [];
  const legacyLabels = Array.isArray(system.skillLabels) ? system.skillLabels : [];
  const order = Array.isArray(system.thiefSkillOrder) && system.thiefSkillOrder.length
    ? system.thiefSkillOrder
    : (Object.keys(labels).length ? Object.keys(labels) : (Object.keys(structured).length ? Object.keys(structured) : Object.keys(THIEF_LABELS)));
  const rows = [];
  const seen = new Set();

  for (let index = 0; index < order.length; index += 1) {
    const key = thiefKey(order[index]);
    if (!key || seen.has(key)) continue;
    const raw = structured?.[key] ?? structured?.[order[index]] ?? legacyValues[index];
    if (raw === undefined || raw === null || raw === "") continue;
    const value = Math.max(0, n(raw, 0));
    seen.add(key);
    rows.push({
      key,
      label: String(labels?.[key] ?? labels?.[order[index]] ?? legacyLabels[index] ?? THIEF_LABELS[key] ?? order[index]),
      value,
      finalValue: value,
      base: value,
      display: key === "frappe_dans_le_dos" ? `×${value}` : `${value}%`,
      type: key === "frappe_dans_le_dos" ? "multiplier" : "percent",
      canRoll: key !== "frappe_dans_le_dos"
    });
  }
  return rows;
}

function installDirectThiefReaders() {
  globalThis.__ADD2E_THIEF_ITEM_PROJECTION__ = MULTICLASS_VERSION;
  globalThis.add2eGetActorThiefProgression = actor => thiefProgression(actor)?.row ?? null;
  globalThis.add2eGetActorThiefSkillTable = actor => thiefSkills(actor);
  globalThis.add2eGetActorThiefSkills = actor => thiefSkills(actor);
  globalThis.add2eThiefClassLevel = actor => thiefProgression(actor)?.level ?? null;
}

function bindDirectMulticlassFields(sheet) {
  const actor = sheet?.document ?? sheet?.actor;
  const root = sheet?.element?.jquery ? sheet.element[0] : sheet?.element;
  if (!actor || !isMulti(actor) || !root?.addEventListener || root.dataset.add2eMulticlassFieldsV2 === VERSION) return;
  root.dataset.add2eMulticlassFieldsV2 = VERSION;
  root.addEventListener("change", event => {
    const input = event.target?.closest?.("input[data-class-progression-field]");
    if (!input || !root.contains(input)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    const sync = globalThis.add2eMulticlassDirectFieldSync;
    if (typeof sync !== "function") {
      ui.notifications?.error?.("Le gestionnaire de progression multiclasses est indisponible.");
      return;
    }
    sync(sheet, input).catch(error => console.warn(`${TAG}[DIRECT_FIELD_ERROR]`, error));
  }, true);
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
      const actor = this.document ?? this.actor;
      return isMulti(actor) ? syncHp(actor, options) : this.__add2eOriginalAutoSetPointsDeCoup(options);
    };
  }

  if (typeof proto.getData === "function" && !proto.__add2eOriginalMulticlassMechanicsGetData) {
    proto.__add2eOriginalMulticlassMechanicsGetData = proto.getData;
    proto.getData = async function add2eMulticlassCompositeSheetData(...args) {
      const data = await this.__add2eOriginalMulticlassMechanicsGetData.apply(this, args);
      const actor = this.document ?? this.actor;
      return isMulti(actor) ? applyCompositeProgressionToSheet(actor, data) : data;
    };
  }

  if (typeof proto._onRender === "function" && !proto.__add2eOriginalMulticlassMechanicsOnRender) {
    proto.__add2eOriginalMulticlassMechanicsOnRender = proto._onRender;
    proto._onRender = async function add2eMulticlassOnRender(...args) {
      const result = await this.__add2eOriginalMulticlassMechanicsOnRender.apply(this, args);
      bindDirectMulticlassFields(this);
      return result;
    };
  }

  proto.__add2eMulticlassMechanicsPatch = VERSION;
}

globalThis.add2eSyncMulticlassHp = syncHp;
globalThis.add2eSyncMulticlassCombatSummary = (actor, options = {}) => syncCombat(actor, options.reason);
globalThis.add2eMulticlassClassEntries = entriesFor;
globalThis.add2eApplyMulticlassProgressionToSheet = applyCompositeProgressionToSheet;
globalThis.add2eBindDirectMulticlassFields = bindDirectMulticlassFields;

installDirectThiefReaders();
Hooks.once("init", installSheetPatch);
Hooks.once("ready", () => {
  installSheetPatch();
  window.setTimeout(installDirectThiefReaders, 25);
});
setTimeout(installSheetPatch, 0);
Hooks.on("createItem", item => { if (String(item?.type ?? "").toLowerCase() === "classe") queue(item.parent, "create-class-item"); });
Hooks.on("updateItem", (item, _changes, options = {}) => {
  if (options?.add2eInternal || options?.add2eMulticlassInternal || String(item?.type ?? "").toLowerCase() !== "classe") return;
  queue(item.parent, "update-class-item");
});
Hooks.on("deleteItem", item => { if (String(item?.type ?? "").toLowerCase() === "classe") queue(item.parent, "delete-class-item"); });