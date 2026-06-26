// ADD2E — Progression de classe canonique
// Un monoclasse est une collection d'un Item classe ; un multiclassé en a plusieurs.
// Compatible Foundry V13/V14/V15.

import { MULTICLASS_VERSION, classItems as coreClassItems, classProgression, classProgressionUpdate, classSlug } from "./17b-multiclass-core.mjs";

const VERSION = "2026-06-26-class-item-progression-unified-v1";
const TAG = "[ADD2E][CLASSE][CANONIQUE]";
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
const hasClasses = actor => actor?.type === "personnage" && classes(actor).length > 0;
const isMulti = actor => hasClasses(actor) && classes(actor).length > 1;
const keyFor = entry => classSlug(entry?.item) || String(entry?.itemId ?? "");

function same(left, right) {
  if (left === right) return true;
  return foundry?.utils?.deepEqual
    ? foundry.utils.deepEqual(left, right)
    : JSON.stringify(left) === JSON.stringify(right);
}

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

function currentXpFor(entry) {
  const row = progressionRows(entry.item).find(value => n(value?.niveau ?? value?.level, 0) === entry.level)
    ?? progressionRows(entry.item).filter(value => n(value?.niveau ?? value?.level, 0) <= entry.level).at(-1)
    ?? null;
  return parseXpMinimum(row?.xp ?? row?.experience ?? row?.xpRange ?? row?.niveau_xp);
}

function nextXpFor(entry) {
  const next = progressionRows(entry.item).find(row => n(row?.niveau ?? row?.level, 0) > entry.level);
  return next ? parseXpMinimum(next?.xp ?? next?.experience ?? next?.xpRange ?? next?.niveau_xp) : 0;
}

function entriesFor(actor) {
  if (!hasClasses(actor)) return [];
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
      currentXp: currentXpFor(entry),
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
  if (entries.length === 1) return foundry.utils.deepClone(entries[0].system?.spellcasting ?? null);
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

function progressionLines(entries) {
  return entries.map(entry => ({
    itemId: entry.itemId,
    name: entry.name,
    slug: entry.slug,
    level: entry.level,
    xp: entry.xp,
    title: entry.title,
    nextXp: entry.nextXp,
    levelMaxRace: entry.levelMaxRace
  }));
}

function summaryFromEntries(actor, entries) {
  if (!entries.length) return null;
  const multi = entries.length > 1;
  const label = entries.map(entry => entry.name).join(" / ");
  const title = entries.map(entry => `${entry.name} ${entry.level}${entry.title ? ` (${entry.title})` : ""}`).join(" / ");
  const totalXp = multi ? entries.reduce((total, entry) => total + entry.xp, 0) : entries[0].xp;
  const displayLevel = multi ? Math.max(...entries.map(entry => entry.level)) : entries[0].level;
  const thac0 = bestThac0(entries);
  const saves = bestSaves(entries);
  const nextValues = entries.map(entry => entry.nextXp).filter(value => value > 0);
  const nextXp = multi ? (nextValues.length ? Math.min(...nextValues) : 0) : entries[0].nextXp;
  const progress = multi
    ? entries.map(entry => `${entry.name} ${entry.xp.toLocaleString()}${entry.nextXp ? ` / ${entry.nextXp.toLocaleString()} XP` : " XP"}`).join(" — ")
    : `${entries[0].xp.toLocaleString()}${entries[0].nextXp ? ` / ${entries[0].nextXp.toLocaleString()} XP` : " XP"}`;
  const minXp = multi ? Math.min(...entries.map(entry => entry.currentXp)) : entries[0].currentXp;
  const percent = nextXp > minXp ? Math.max(0, Math.min(100, Math.floor(((totalXp - minXp) / (nextXp - minXp)) * 100))) : 100;
  const stored = actor.system?.multiclasse && typeof actor.system.multiclasse === "object" ? actor.system.multiclasse : {};
  const { classes: _legacyClasses, ...metadata } = stored;

  return {
    lines: progressionLines(entries),
    multi,
    label,
    title,
    thac0,
    saves,
    values: {
      classe: label,
      details_classe: multi
        ? { label, name: label, multiclass: true, source: "class-items" }
        : {
          ...foundry.utils.deepClone(entries[0].system ?? {}),
          name: entries[0].name,
          label: entries[0].system?.label ?? entries[0].name,
          slug: entries[0].slug,
          sourceItemId: entries[0].itemId,
          sourceItemUuid: entries[0].item?.uuid
        },
      classe_img: multi ? "" : entries[0].item?.img ?? "",
      spellcasting: combinedSpellcasting(entries),
      niveau: displayLevel,
      niveau_suggere: displayLevel,
      xp: totalXp,
      titre: title,
      progression_xp: progress,
      xp_next: nextXp,
      xp_to_next: nextXp ? Math.max(0, nextXp - (multi ? Math.min(...entries.map(entry => entry.xp)) : entries[0].xp)) : 0,
      xp_percent: percent,
      multiclasse: {
        ...metadata,
        schema: Number(metadata.schema ?? 3) || 3,
        enabled: multi,
        mode: multi ? "racial" : "mono",
        xpSplit: multi ? "equal" : "none",
        label
      }
    }
  };
}

function applySummaryToView(data, summary) {
  const system = data?.actor?.system;
  if (!system || !summary) return data;
  for (const [key, value] of Object.entries(summary.values)) system[key] = foundry.utils.deepClone(value);
  if (summary.thac0 !== null) system.thaco = summary.thac0;
  if (summary.saves) system.sauvegardes = foundry.utils.deepClone(summary.saves);

  data.classProgression = {
    enabled: true,
    isMulticlass: summary.multi,
    classes: summary.lines,
    title: summary.title
  };
  data.multiclass = {
    enabled: summary.multi,
    classes: summary.lines,
    title: summary.title
  };

  const first = summary.lines[0];
  const progression = summary.multi
    ? { ...(data.progressionCourante ?? {}), title: summary.title, _add2eMulticlassComposite: true }
    : foundry.utils.deepClone(entriesFor(data.document ?? data.actor)?.[0]?.row ?? data.progressionCourante ?? {});
  progression.title = summary.multi ? summary.title : first?.title ?? progression.title ?? "";
  if (summary.thac0 !== null) {
    progression.thac0 = summary.thac0;
    progression.thaco = summary.thac0;
  }
  if (summary.saves) {
    progression.savingThrows = foundry.utils.deepClone(summary.saves);
    progression.sauvegardes = foundry.utils.deepClone(summary.saves);
  }
  data.progressionCourante = progression;
  if (data.combatDefense && summary.thac0 !== null) data.combatDefense.thaco = summary.thac0;
  data.canExceptionalStrength = Number(system.force ?? 0) === 18
    && summary.lines.some(entry => ["guerrier", "paladin", "rodeur", "ranger"].includes(entry.slug));
  return data;
}

function applyClassProgressionToSheet(actor, data) {
  const entries = entriesFor(actor);
  if (!entries.length || !data) return data;
  return applySummaryToView(data, summaryFromEntries(actor, entries));
}

async function ensureCanonicalClassProgression(actor) {
  if (!hasClasses(actor)) return false;
  const docs = classes(actor);
  const missing = docs.filter(item => {
    const state = classProgression(item);
    return !state.hasLevel || !state.hasXp;
  });
  if (!missing.length) return true;

  if (docs.length > 1) {
    const migrate = globalThis.add2eMigrateLegacyMulticlassActor;
    const result = typeof migrate === "function" ? await migrate(actor) : null;
    return result?.ok === true;
  }

  const classDoc = docs[0];
  const update = classProgressionUpdate(classDoc, {
    level: Math.max(1, Math.floor(n(actor.system?.niveau, 1))),
    xp: Math.max(0, Math.floor(n(actor.system?.xp, 0)))
  });
  if (!update) return false;
  await actor.updateEmbeddedDocuments("Item", [update], {
    add2eInternal: true,
    add2eMulticlassInternal: true,
    add2eReason: "single-class-item-progression-migration"
  });
  return true;
}

async function syncClassProgressionSummary(actor, { reason = "class-item-progression-summary" } = {}) {
  if (!(await ensureCanonicalClassProgression(actor))) return false;
  const entries = entriesFor(actor);
  const summary = summaryFromEntries(actor, entries);
  if (!summary) return false;
  const updates = {};
  for (const [key, value] of Object.entries(summary.values)) {
    const path = `system.${key}`;
    if (!same(foundry.utils.getProperty(actor, path), value)) updates[path] = value;
  }
  if (summary.thac0 !== null && Number(actor.system?.thaco) !== summary.thac0) updates["system.thaco"] = summary.thac0;
  if (summary.saves && !same(actor.system?.sauvegardes, summary.saves)) updates["system.sauvegardes"] = summary.saves;
  if (!Object.keys(updates).length) return true;
  await actor.update(updates, {
    add2eInternal: true,
    add2eMulticlassInternal: true,
    add2eReason: reason,
    render: false
  });
  return true;
}

async function syncHp(actor, { syncCurrent = false, force = false, reason = "multiclass-item-progression" } = {}) {
  if (!isMulti(actor)) return false;
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

function bindDirectClassFields(sheet) {
  const actor = sheet?.document ?? sheet?.actor;
  const root = sheet?.element?.jquery ? sheet.element[0] : sheet?.element;
  if (!actor || !hasClasses(actor) || !root?.addEventListener || root.dataset.add2eClassProgressionFields === VERSION) return;
  root.dataset.add2eClassProgressionFields = VERSION;
  root.addEventListener("change", event => {
    const input = event.target?.closest?.("input[data-class-progression-field]");
    if (!input || !root.contains(input)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    const sync = globalThis.add2eMulticlassDirectFieldSync;
    if (typeof sync !== "function") {
      ui.notifications?.error?.("Le gestionnaire de progression de classe est indisponible.");
      return;
    }
    sync(sheet, input).catch(error => console.warn(`${TAG}[DIRECT_FIELD_ERROR]`, error));
  }, true);
}

function queue(actor, reason) {
  if (!hasClasses(actor)) return;
  const id = String(actor.uuid ?? actor.id);
  clearTimeout(timers.get(id));
  timers.set(id, setTimeout(async () => {
    timers.delete(id);
    try {
      await syncClassProgressionSummary(actor, { reason: `${reason}:summary` });
      if (isMulti(actor)) await syncHp(actor, { reason: `${reason}:hp` });
    } catch (error) {
      console.warn(`${TAG}[SYNC_ERROR]`, { actor: actor?.name, error });
    }
  }, 0));
}

function installSheetPatch() {
  const proto = globalThis.Add2eActorSheet?.prototype;
  if (!proto || proto.__add2eClassProgressionPatch === VERSION) return;

  if (typeof proto.autoSetPointsDeCoup === "function" && !proto.__add2eOriginalAutoSetPointsDeCoup) {
    proto.__add2eOriginalAutoSetPointsDeCoup = proto.autoSetPointsDeCoup;
    proto.autoSetPointsDeCoup = async function add2eClassItemHp(options = {}) {
      const actor = this.document ?? this.actor;
      return isMulti(actor) ? syncHp(actor, options) : this.__add2eOriginalAutoSetPointsDeCoup(options);
    };
  }

  if (typeof proto.getData === "function" && !proto.__add2eOriginalClassProgressionGetData) {
    proto.__add2eOriginalClassProgressionGetData = proto.getData;
    proto.getData = async function add2eClassProgressionSheetData(...args) {
      const data = await this.__add2eOriginalClassProgressionGetData.apply(this, args);
      return applyClassProgressionToSheet(this.document ?? this.actor, data);
    };
  }

  if (typeof proto._onRender === "function" && !proto.__add2eOriginalClassProgressionOnRender) {
    proto.__add2eOriginalClassProgressionOnRender = proto._onRender;
    proto._onRender = async function add2eClassProgressionOnRender(...args) {
      const result = await this.__add2eOriginalClassProgressionOnRender.apply(this, args);
      bindDirectClassFields(this);
      return result;
    };
  }

  proto.__add2eClassProgressionPatch = VERSION;
}

globalThis.add2eSyncMulticlassHp = syncHp;
globalThis.add2eSyncMulticlassCombatSummary = (actor, options = {}) => syncClassProgressionSummary(actor, options);
globalThis.add2eMulticlassClassEntries = entriesFor;
globalThis.add2eApplyMulticlassProgressionToSheet = applyClassProgressionToSheet;
globalThis.add2eApplyClassProgressionToSheet = applyClassProgressionToSheet;
globalThis.add2eSyncClassProgressionSummary = syncClassProgressionSummary;
globalThis.add2eEnsureCanonicalClassProgression = ensureCanonicalClassProgression;
globalThis.add2eBindDirectMulticlassFields = bindDirectClassFields;

installDirectThiefReaders();
Hooks.once("init", installSheetPatch);
Hooks.once("ready", async () => {
  installSheetPatch();
  window.setTimeout(installDirectThiefReaders, 25);
  if (!game.user?.isGM) return;
  for (const actor of game.actors?.filter(entry => entry.type === "personnage" && classes(entry).length) ?? []) {
    try {
      await ensureCanonicalClassProgression(actor);
      await syncClassProgressionSummary(actor, { reason: "class-item-progression-ready" });
      if (isMulti(actor)) await syncHp(actor, { reason: "class-item-progression-ready-hp" });
    } catch (error) {
      console.warn(`${TAG}[READY_SYNC_ERROR]`, { actor: actor?.name, error });
    }
  }
});
setTimeout(installSheetPatch, 0);
Hooks.on("createItem", item => { if (String(item?.type ?? "").toLowerCase() === "classe") queue(item.parent, "create-class-item"); });
Hooks.on("updateItem", (item, _changes, options = {}) => {
  if (options?.add2eInternal || options?.add2eMulticlassInternal || String(item?.type ?? "").toLowerCase() !== "classe") return;
  queue(item.parent, "update-class-item");
});
Hooks.on("deleteItem", item => { if (String(item?.type ?? "").toLowerCase() === "classe") queue(item.parent, "delete-class-item"); });