/**
 * scripts/add2e.js
 * Feuille custom pour AD&D 2e Descartes — Foundry VTT v12+
 */
// 1. IMPORT (Obligatoire tout en haut)
import { Add2eItemSheet } from "./add2e-item-sheet.mjs";

// 2. INITIALISATION (enregistrement strict des fiches)
function add2eRegisterClassItemSheet() {
  const options = {
    types: ["classe"],
    makeDefault: true,
    canConfigure: true,
    canBeDefault: true,
    label: "ADD2E | Fiche Classe"
  };

  // API historique encore disponible en Foundry v13.
  // Important : cette fiche est limitée au type Item "classe".
  Items.registerSheet("add2e", Add2eItemSheet, options);

  // API DocumentSheetConfig : double sécurité pour forcer Item.classe
  // sur la fiche de classe, et jamais sur la fiche acteur.
  const DSC = globalThis.DocumentSheetConfig ?? foundry?.applications?.apps?.DocumentSheetConfig;
  if (DSC?.registerSheet) {
    try {
      DSC.registerSheet(Item, "add2e", Add2eItemSheet, options);
    } catch (e) {
      // En v13, Items.registerSheet suffit. Ce fallback ne doit pas bloquer.
      console.warn("[ADD2E][SHEETS] DocumentSheetConfig classe non appliqué, fallback Items.registerSheet conservé.", e);
    }
  }

  console.log("[ADD2E][SHEETS] Fiche Item.classe enregistrée :", Add2eItemSheet?.name);
}

Hooks.once("init", function() {
  console.log("ADD2e | Initialisation du système...");

  // IMPORTANT : Add2eItemSheet est réservée au type d'item classe.
  // Ne pas désenregistrer la feuille core globale, sinon les autres types
  // ou les réglages de feuille peuvent basculer sur une mauvaise fiche.
  add2eRegisterClassItemSheet();
});
async function createAdd2eMacro(data, slot) {
  let item = null;
  if (data.uuid) item = await fromUuid(data.uuid);
  if (!item || !item.type || !item.parent || item.parent.documentName !== "Actor") {
    ui.notifications.warn("Impossible de créer la macro : objet ou acteur introuvable.");
    console.warn("[ADD2e DEBUG] Impossible de créer la macro, item =", item);
    return;
  }
  // --- ARME ---
  if (item.type === "arme") {
    const uuid = item.uuid;
    const command = `
(async () => {
  const arme = await fromUuid("${uuid}");
  const actor = arme?.parent;
  if (actor && arme) {
    add2eAttackRoll({ actor, arme });
  } else {
    ui.notifications.warn("Arme ou personnage introuvable !");
  }
})();
    `.trim();

    let macro = await Macro.create({
      name: `[Attaque] ${item.parent.name} - ${item.name}`,
      type: "script",
      img: item.img || "icons/svg/sword.svg",
      command
    }, { renderSheet: false });
    game.user.assignHotbarMacro(macro, slot);
  }
  // --- SORT ---
  else if (item.type === "sort") {
    const uuid = item.uuid;
    const command = `
(async () => {
  const sort = await fromUuid("${uuid}");
  const actor = sort?.parent;
  if (actor && sort) {
    ui.notifications.info("Sort " + sort.name + " lancé pour " + actor.name + " !");
    // Tu peux mettre ici ta logique custom si besoin
  } else {
    ui.notifications.warn("Sort ou personnage introuvable !");
  }
})();
    `.trim();

    let macro = await Macro.create({
      name: `[Sort] ${item.parent.name} - ${item.name}`,
      type: "script",
      img: item.img || "icons/svg/book.svg",
      command
    }, { renderSheet: false });
    game.user.assignHotbarMacro(macro, slot);
  }
  // --- AUTRE TYPE ---
  else {
    ui.notifications.warn(`Type d'item non supporté pour macro : ${item.type}`);
    console.warn("[ADD2e DEBUG] Type d'item non supporté :", item.type, item);
  }
}

// Helpers Handlebars
if (typeof Handlebars !== "undefined" && !Handlebars.helpers.json) {
  Handlebars.registerHelper("json", ctx => JSON.stringify(ctx, null, 2));
}
if (!Handlebars.helpers.subtract) Handlebars.registerHelper("subtract", (a, b) => a - b);
if (!Handlebars.helpers.eq)       Handlebars.registerHelper("eq", (a, b) => a === b);
if (!Handlebars.helpers.add) Handlebars.registerHelper("add", (a, b) =>
  Number(a ?? 0) + Number(b ?? 0)
);
if (!Handlebars.helpers.gt)       Handlebars.registerHelper("gt", (a, b) => Number(a) > Number(b));
if (typeof Handlebars !== "undefined" && !Handlebars.helpers.array) {
  Handlebars.registerHelper("array", function() {
    // On retire le dernier argument (obj Handlebars)
    return Array.prototype.slice.call(arguments, 0, -1);
  });
}
if (typeof Handlebars !== "undefined" && !Handlebars.helpers.lowercase) {
  Handlebars.registerHelper("lowercase", function(str) {
    return (str||"").toLowerCase();
  });
}
if (typeof Handlebars !== "undefined" && !Handlebars.helpers.padLeft) {
  Handlebars.registerHelper("padLeft", function(value, width, char) {
    value = (value !== undefined && value !== null) ? String(value) : "";
    width = parseInt(width) || 2;
    char = (typeof char === "string" && char.length) ? char : "0";
    while (value.length < width) value = char + value;
    return value;
  });
}
if (typeof Handlebars !== "undefined" && !Handlebars.helpers.formatSortChamp) {
  Handlebars.registerHelper("formatSortChamp", function(val) {
    if (!val) return "-";
    if (typeof val === "object") {
      const v = val.valeur !== undefined ? val.valeur : "";
      const u = val.unite ? (" " + val.unite) : "";
      return `${v}${u}`.trim() || "-";
    }
    return val;
  });
}

if (typeof Handlebars !== "undefined") {
  // Capitalise la première lettre
  Handlebars.registerHelper("capitalize", str =>
    (str && typeof str === "string") ? str.charAt(0).toUpperCase() + str.slice(1) : str
  );

  // Met en majuscule
  Handlebars.registerHelper("uppercase", str =>
    (str && typeof str === "string") ? str.toUpperCase() : str
  );

  // Sous-chaîne (substr)
  Handlebars.registerHelper("substr", (str, start, len) =>
    (str && typeof str === "string") ? str.substr(start, len) : str
  );

  // Concatène deux strings
  Handlebars.registerHelper("concat", function () {
    // Prend tous les arguments sauf le dernier (qui est options)
    return Array.from(arguments).slice(0, -1).join('');
  });

  // Crée un array (utile pour boucler sur une liste fixe dans le HBS)
  Handlebars.registerHelper("array", function () {
    return Array.prototype.slice.call(arguments, 0, -1);
  });
}

if (typeof Handlebars !== "undefined" && !Handlebars.helpers.getFlag) {
  Handlebars.registerHelper("getFlag", function(item, flag) {
    try {
      // Pour éviter les crashs si getFlag n'est pas dispo (ex : preview)
      if (!item || typeof item.getFlag !== "function") return false;
      const [scope, key] = flag.split('.');
      return item.getFlag(scope, key);
    } catch {
      return false;
    }
  });
}
if (typeof Handlebars !== "undefined" && !Handlebars.helpers.toSpecialArray) {
  Handlebars.registerHelper("toSpecialArray", function (val) {
    // Si déjà un tableau, clone-le et filtre les vides/NEW
    if (Array.isArray(val)) {
      return val.filter(e => !!e && e !== "" && e !== "NEW");
    }
    // Si objet à clés numériques, convertis-le
    if (typeof val === "object" && val !== null) {
      return Object.values(val).filter(e => !!e && e !== "" && e !== "NEW");
    }
    // Rien à afficher
    return [];
  });
}
if (typeof Handlebars !== "undefined" && !Handlebars.helpers.length) {
  Handlebars.registerHelper('length', function(x) { return x ? x.length : 0; });
}
async function add2e_saveBaseCaracs(actor) {
  const CARACS = ["force", "dexterite", "constitution", "intelligence", "sagesse", "charisme"];
  let baseCaracs = {};
  for (const c of CARACS) {
    baseCaracs[c] = typeof actor.system?.[`${c}_base`] === "number" ? actor.system[`${c}_base`] : 10;
  }
 await actor.setFlag("add2e", "base_caracs", baseCaracs);
}
// ============================================================
// ADD2E — Synchronisation automatique des sorts au drop de classe
// Fonctionne dans add2e.mjs, sans actor-sheet.mjs
// ============================================================

function add2eSpellSyncClone(value) {
  if (value === undefined || value === null) return value;
  if (foundry?.utils?.deepClone) return foundry.utils.deepClone(value);
  if (foundry?.utils?.duplicate) return foundry.utils.duplicate(value);
  return JSON.parse(JSON.stringify(value));
}

function add2eSpellSyncMaybeJson(value) {
  if (typeof value !== "string") return value;

  const s = value.trim();
  if (!s) return value;

  if (
    (s.startsWith("{") && s.endsWith("}")) ||
    (s.startsWith("[") && s.endsWith("]"))
  ) {
    try {
      return JSON.parse(s);
    } catch (e) {
      return value;
    }
  }

  return value;
}

function add2eSpellSyncNormalize(value) {
  const s = String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[\s\-]+/g, "_")
    .replace(/_+/g, "_");

  const aliases = {
    cleric: "clerc",
    clerical: "clerc",
    clercs: "clerc",
    priest: "clerc",
    priests: "clerc",
    pretre: "clerc",
    pretres: "clerc",

    druid: "druide",
    druids: "druide",
    druides: "druide",
    druidique: "druide"
  };

  return aliases[s] ?? s;
}

function add2eSpellSyncArray(value) {
  value = add2eSpellSyncMaybeJson(value);

  if (value === undefined || value === null || value === "") return [];

  if (Array.isArray(value)) {
    return value.flatMap(v => add2eSpellSyncArray(v));
  }

  if (typeof value === "string") {
    return value
      .split(/[,;|\n]+/)
      .map(v => v.trim())
      .filter(Boolean);
  }

  if (typeof value === "object") {
    for (const key of [
      "lists",
      "spellLists",
      "classes",
      "classe",
      "class",
      "value",
      "values",
      "list",
      "tags",
      "items"
    ]) {
      if (value[key] !== undefined) return add2eSpellSyncArray(value[key]);
    }

    const numericValues = Object.keys(value)
      .filter(k => /^\d+$/.test(k))
      .sort((a, b) => Number(a) - Number(b))
      .map(k => value[k]);

    if (numericValues.length) return add2eSpellSyncArray(numericValues);
  }

  return [value];
}

function add2eSpellSyncClassLists(classItem) {
  const sys = classItem?.system ?? {};
  const sc = add2eSpellSyncMaybeJson(sys.spellcasting);

  const raw = [
    ...add2eSpellSyncArray(sys.spellLists),
    ...add2eSpellSyncArray(sys.sorts),
    ...add2eSpellSyncArray(sys.tags),
    ...add2eSpellSyncArray(sc?.lists),
    ...add2eSpellSyncArray(sc?.spellLists)
  ];

  const lists = raw
    .map(add2eSpellSyncNormalize)
    .filter(Boolean);

  // Fallback si une ancienne classe n'a pas encore spellcasting.lists.
  const className = add2eSpellSyncNormalize(classItem?.name ?? "");
  if (className.includes("clerc")) lists.push("clerc");
  if (className.includes("druide")) lists.push("druide");

  return [...new Set(lists)].filter(v => ["clerc", "druide"].includes(v));
}

function add2eSpellSyncSpellLevel(system = {}) {
  const raw =
    system.niveau ??
    system.niveau_sort ??
    system.spellLevel ??
    system.level ??
    system.lvl ??
    0;

  const match = String(raw).match(/\d+/);
  return match ? Number(match[0]) || 0 : 0;
}

function add2eSpellSyncSpellLists(system = {}) {
  const raw = [
    ...add2eSpellSyncArray(system.spellLists),
    ...add2eSpellSyncArray(system.lists),
    ...add2eSpellSyncArray(system.classes),
    ...add2eSpellSyncArray(system.classe),
    ...add2eSpellSyncArray(system.class),
    ...add2eSpellSyncArray(system.tags),
    ...add2eSpellSyncArray(system.effectTags)
  ];

  return [...new Set(raw.map(add2eSpellSyncNormalize).filter(Boolean))];
}

function add2eSpellSyncNumber(value) {
  value = add2eSpellSyncMaybeJson(value);

  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "boolean") return value ? 1 : 0;

  if (typeof value === "string") {
    const s = value.trim();
    if (!s || s === "—" || s === "-" || /^n[\/ ]?a$/i.test(s)) return 0;
    const m = s.match(/-?\d+/);
    return m ? Number(m[0]) || 0 : 0;
  }

  if (value && typeof value === "object") {
    for (const key of ["value", "valeur", "slots", "slot", "count", "nombre", "nb", "max"]) {
      if (value[key] !== undefined && value[key] !== null && typeof value[key] !== "object") {
        return add2eSpellSyncNumber(value[key]);
      }
    }
  }

  return 0;
}

function add2eSpellSyncSlotsArray(value) {
  value = add2eSpellSyncMaybeJson(value);

  if (!value) return [];

  if (Array.isArray(value)) return value;

  if (typeof value === "string") {
    const s = value.trim();
    if (!s) return [];
    if (/[,;|/\s]+/.test(s) && /\d/.test(s)) {
      return s
        .split(/[,;|/\s]+/)
        .map(v => v.trim())
        .filter(v => v !== "");
    }
    return [];
  }

  if (typeof value === "object") {
    for (const key of ["slots", "slot", "value", "values", "spellsPerLevel", "sortsParNiveau", "sorts_par_niveau", "spells", "spellSlots"]) {
      if (Array.isArray(value[key]) || typeof value[key] === "string") return add2eSpellSyncSlotsArray(value[key]);
    }

    return Object.keys(value)
      .filter(k => /^\d+$/.test(k))
      .sort((a, b) => Number(a) - Number(b))
      .map(k => value[k]);
  }

  return [];
}

function add2eSpellSyncReadSlotValue(raw, spellLevelOrIndex, listKey = "") {
  raw = add2eSpellSyncMaybeJson(raw);
  if (raw === undefined || raw === null || raw === "") return null;

  const numeric = Number(spellLevelOrIndex);
  const idx = numeric >= 1 ? numeric - 1 : 0;
  const oneBased = idx + 1;
  const wantedList = add2eSpellSyncNormalize(listKey);

  const arr = add2eSpellSyncSlotsArray(raw);
  if (arr.length) {
    if (idx >= 0 && idx < arr.length) return add2eSpellSyncNumber(arr[idx]);
    return 0;
  }

  if (typeof raw !== "object") return null;

  if (wantedList) {
    for (const [rawKey, value] of Object.entries(raw)) {
      if (add2eSpellSyncNormalize(rawKey) !== wantedList) continue;
      const v = add2eSpellSyncReadSlotValue(value, oneBased, "");
      if (v !== null) return v;
    }
  }

  for (const key of ["slots", "slot", "value", "values", "spellsPerLevel", "sortsParNiveau", "sorts_par_niveau", "spells", "spellSlots"]) {
    if (raw[key] === undefined) continue;
    const v = add2eSpellSyncReadSlotValue(raw[key], oneBased, wantedList);
    if (v !== null) return v;
  }

  if (Object.prototype.hasOwnProperty.call(raw, String(oneBased))) {
    return add2eSpellSyncNumber(raw[String(oneBased)]);
  }

  if (Object.prototype.hasOwnProperty.call(raw, String(idx))) {
    return add2eSpellSyncNumber(raw[String(idx)]);
  }

  return null;
}

function add2eSpellSyncMaxSpellLevel(classItem, actorLevel) {
  const sys = classItem?.system ?? {};
  const sc = add2eSpellSyncMaybeJson(sys.spellcasting);

  const level = Math.max(1, Number(actorLevel) || 1);
  const startsAt = Math.max(1, Number(sc?.startsAt ?? sys.startsAt ?? 1) || 1);
  const hardMax = Math.max(1, Number(sc?.maxSpellLevel ?? sys.maxSpellLevel ?? 9) || 9);

  if (level < startsAt) return 0;

  const progression = add2eSpellSyncMaybeJson(sys.progression);
  const rows = Array.isArray(progression) ? progression : [];

  const row =
    rows.find(r => Number(r?.niveau ?? r?.level) === level) ??
    rows[level - 1] ??
    null;

  const maxFromArray = (raw) => {
    const arr = add2eSpellSyncSlotsArray(raw);
    let max = 0;
    arr.forEach((value, index) => {
      const n = add2eSpellSyncNumber(value);
      if (n > 0) max = Math.max(max, index + 1);
    });
    return max;
  };

  const maxFromContainer = (raw) => {
    raw = add2eSpellSyncMaybeJson(raw);
    if (!raw || typeof raw !== "object") return 0;

    let max = 0;

    if (Array.isArray(raw)) return maxFromArray(raw);

    for (const value of Object.values(raw)) {
      if (Array.isArray(value)) {
        max = Math.max(max, maxFromArray(value));
        continue;
      }

      if (value && typeof value === "object") {
        max = Math.max(
          max,
          maxFromArray(value),
          maxFromArray(value.slots),
          maxFromArray(value.value),
          maxFromArray(value.values),
          maxFromArray(value.spellsPerLevel),
          maxFromArray(value.sortsParNiveau)
        );
      }
    }

    return max;
  };

  let maxFromSlots = 0;

  if (row && typeof row === "object") {
    // Ligne simple : Clerc/Druide/Magicien classique.
    for (const field of [
      "spellsPerLevel",
      "sortsParNiveau",
      "sorts_par_niveau",
      "spells",
      "slots",
      "spellSlots"
    ]) {
      maxFromSlots = Math.max(maxFromSlots, maxFromArray(row[field]));
    }

    // Lignes multiples : Ranger, classes mixtes, ou progression séparée par liste.
    for (const container of [
      "spellSlotsByList",
      "spellsByList",
      "spellsPerLevelByList",
      "sortsParListe"
    ]) {
      maxFromSlots = Math.max(maxFromSlots, maxFromContainer(row[container]));
    }

    // Champs directs nommés : spellsPerLevelClerc, spellsPerLevelDruide, etc.
    for (const [key, value] of Object.entries(row)) {
      if (!/^spellsPerLevel|^sortsParNiveau|^spellSlots/i.test(key)) continue;
      maxFromSlots = Math.max(maxFromSlots, maxFromArray(value), maxFromContainer(value));
    }
  }

  if (maxFromSlots > 0) return Math.min(maxFromSlots, hardMax);

  // Si aucune progression n'est exploitable, on évite d'importer tous les niveaux.
  // Niveau 1 reste le fallback sûr pour les classes divines simples.
  return Math.min(1, hardMax);
}

function add2eSpellSyncGetProgressionRow(actor, actorLevel = null) {
  const level = Math.max(1, Number(actorLevel ?? actor?.system?.niveau) || 1);
  const classItem = actor?.items?.find?.(i => String(i.type || "").toLowerCase() === "classe") ?? null;
  const details = classItem?.system ?? actor?.system?.details_classe ?? {};
  const progression = add2eSpellSyncMaybeJson(details?.progression);
  const rows = Array.isArray(progression) ? progression : [];

  return rows.find(r => Number(r?.niveau ?? r?.level) === level) ?? rows[level - 1] ?? null;
}

function add2eSpellSyncSlotProbe(actor, classLists, spellLevel) {
  const lvl = Number(spellLevel) || 0;
  const row = add2eSpellSyncGetProgressionRow(actor);
  const wanted = (classLists ?? []).map(add2eSpellSyncNormalize).filter(Boolean);

  if (!row || typeof row !== "object" || lvl < 1) {
    return { found: false, count: 0, source: "no-row" };
  }

  let found = false;
  let count = 0;

  const read = (raw, listKey = "", source = "") => {
    if (raw === undefined || raw === null || raw === "") return;
    const v = add2eSpellSyncReadSlotValue(raw, lvl, listKey);
    if (v === null) return;
    found = true;
    count = Math.max(count, Number(v) || 0);
  };

  // Champs simples : Clerc/Druide/Magicien classique.
  for (const field of [
    "spellsPerLevel",
    "sortsParNiveau",
    "sorts_par_niveau",
    "spells",
    "slots",
    "spellSlots"
  ]) {
    read(row[field], "", field);
  }

  // Conteneurs séparés par liste : { Clerc: [..], Druide: [..] }.
  for (const containerName of [
    "spellSlotsByList",
    "spellsByList",
    "spellsPerLevelByList",
    "sortsParListe"
  ]) {
    const c = row[containerName];
    if (!c || typeof c !== "object") continue;

    for (const [rawKey, value] of Object.entries(c)) {
      const key = add2eSpellSyncNormalize(rawKey);
      if (wanted.length && !wanted.includes(key)) continue;
      read(value, key, `${containerName}.${rawKey}`);
    }
  }

  // Champs nommés : spellsPerLevelClerc, spellsPerLevel_clerc, spellSlotsDruide, etc.
  for (const [rawField, value] of Object.entries(row)) {
    const field = add2eSpellSyncNormalize(rawField);
    if (!/^(spellsperlevel|sortsparniveau|spellslots|slots)/i.test(field)) continue;

    const matchesNamedList = !wanted.length || wanted.some(list => field.includes(list));
    if (!matchesNamedList) continue;

    read(value, "", rawField);
  }

  return { found, count, source: found ? "progression" : "no-slot-source" };
}

function add2eSpellSyncCanUseSpellLevel(actor, classLists, spellLevel, fallbackMaxSpellLevel) {
  const lvl = Number(spellLevel) || 0;
  if (lvl < 1) return false;

  // Source prioritaire : progression de classe au niveau ACTUEL.
  // Cette lecture est plus robuste que l'affichage UI : elle accepte tableaux,
  // objets à clés numériques et chaînes du type "6, 6, 5, 4, 3, 2, 1".
  const probe = add2eSpellSyncSlotProbe(actor, classLists, lvl);
  if (probe.found) return probe.count > 0;

  // Fallback UI existant, conservé pour compatibilité.
  try {
    if (typeof add2eGetSpellSlotPoolsByLevel === "function") {
      const pools = add2eGetSpellSlotPoolsByLevel(actor) ?? {};
      let sawMatchingPool = false;

      for (const rawList of classLists ?? []) {
        const key = add2eSpellSyncNormalize(rawList);
        const pool = pools[key];
        if (!pool) continue;

        sawMatchingPool = true;
        const slots = Number(pool.slotsByLevel?.[lvl] ?? 0) || 0;
        if (slots > 0) return true;
      }

      if (sawMatchingPool) return false;
    }
  } catch (e) {
    console.warn("[ADD2E][CLASS_DROP_SPELLS] Fallback maxSpellLevel utilisé.", e);
  }

  // Fallback uniquement si aucune progression exploitable n'a été trouvée.
  return lvl <= (Number(fallbackMaxSpellLevel) || 0);
}

function add2eSpellSyncStableKey(name, system = {}) {
  const spellName = add2eSpellSyncNormalize(name ?? system.nom ?? system.name ?? "");
  const spellLevel = add2eSpellSyncSpellLevel(system ?? {});
  return `${spellLevel}|${spellName}`;
}

function add2eSpellSyncExistingKeys(actor) {
  const keys = new Set();

  for (const item of actor?.items?.filter?.(i => String(i.type || "").toLowerCase() === "sort") ?? []) {
    const key = add2eSpellSyncStableKey(item.name, item.system ?? {});
    if (key && key !== "0|") keys.add(key);
  }

  return keys;
}

function add2eSpellSyncMaxExistingLevel(actor, classLists = []) {
  const wantedLists = new Set((classLists ?? []).map(add2eSpellSyncNormalize).filter(Boolean));
  let max = 0;

  for (const item of actor?.items?.filter?.(i => String(i.type || "").toLowerCase() === "sort") ?? []) {
    const itemLists = add2eSpellSyncSpellLists(item.system ?? {});
    if (wantedLists.size && itemLists.length && !itemLists.some(l => wantedLists.has(l))) continue;

    const lvl = add2eSpellSyncSpellLevel(item.system ?? {});
    if (lvl > max) max = lvl;
  }

  return max;
}

function add2eSpellSyncGetLastMax(actor) {
  return Number(actor?.getFlag?.("add2e", "autoSpellSyncMaxLevel") ?? 0) || 0;
}

async function add2eSpellSyncSetLastMax(actor, value) {
  if (!actor?.setFlag) return;
  const n = Math.max(0, Number(value) || 0);
  await actor.setFlag("add2e", "autoSpellSyncMaxLevel", n);
}

function add2eSpellSyncOpenWaitMessage({ actor, classItem, mode, minSpellLevel, maxSpellLevel } = {}) {
  const title = mode === "missing" ? "Import des nouveaux sorts" : "Import des sorts de classe";
  const range = mode === "missing" && minSpellLevel > 0
    ? `Niveaux de sort ${minSpellLevel} à ${maxSpellLevel}`
    : `Jusqu’au niveau de sort ${maxSpellLevel}`;

  const content = `
    <div class="add2e-spell-sync-wait" style="padding:0.8em 0.9em;line-height:1.45;">
      <p style="margin:0 0 0.55em 0;"><b>${title}</b></p>
      <p style="margin:0 0 0.35em 0;">Personnage : <b>${actor?.name ?? "—"}</b></p>
      <p style="margin:0 0 0.35em 0;">Classe : <b>${classItem?.name ?? "—"}</b></p>
      <p style="margin:0 0 0.7em 0;">${range}</p>
      <div style="display:flex;align-items:center;gap:0.55em;color:#6f4b12;font-weight:700;">
        <i class="fas fa-spinner fa-spin"></i>
        <span>Synchronisation en cours, ne fermez pas la fiche...</span>
      </div>
    </div>
  `;

  try {
    const dialog = new Dialog({
      title,
      content,
      buttons: {},
      close: () => {}
    }, { width: 420, height: "auto" });

    dialog.render(true);
    return dialog;
  } catch (e) {
    ui.notifications.info(`${title} en cours...`);
    return null;
  }
}

function add2eSpellSyncCloseWaitMessage(dialog) {
  try {
    dialog?.close?.({ submit: false });
  } catch (e) {}
}


function add2eSpellSyncIndexEntryData(entry) {
  if (Array.isArray(entry)) return entry[1] ?? { _id: entry[0], id: entry[0] };
  return entry ?? {};
}

function add2eSpellSyncIndexEntryId(entry) {
  if (Array.isArray(entry)) {
    const data = entry[1] ?? {};
    return data._id ?? data.id ?? entry[0] ?? null;
  }

  return entry?._id ?? entry?.id ?? entry?.uuid?.split?.(".")?.at?.(-1) ?? null;
}

function add2eSpellSyncMatchesClassLists(sortOrSystem, classLists = []) {
  const system = sortOrSystem?.system ?? sortOrSystem ?? {};
  const wantedLists = new Set((classLists ?? []).map(add2eSpellSyncNormalize).filter(Boolean));
  if (!wantedLists.size) return false;

  const spellLists = add2eSpellSyncSpellLists(system);
  return spellLists.some(list => wantedLists.has(list));
}

async function add2ePruneActorSpellsForClassLevel(actor, classItem, actorLevel, options = {}) {
  if (!actor || !classItem || classItem.type !== "classe") {
    return { handled: false, deleted: 0, maxSpellLevel: 0 };
  }

  const classLists = add2eSpellSyncClassLists(classItem);
  if (!classLists.length) return { handled: false, deleted: 0, maxSpellLevel: 0 };

  const level = Math.max(1, Number(actorLevel ?? actor.system?.niveau) || 1);
  const maxSpellLevel = add2eSpellSyncMaxSpellLevel(classItem, level);
  const idsToDelete = [];

  for (const sort of actor.items?.filter?.(i => String(i.type || "").toLowerCase() === "sort") ?? []) {
    const sys = sort.system ?? {};
    const spellLevel = add2eSpellSyncSpellLevel(sys);
    const matchesClass = add2eSpellSyncMatchesClassLists(sys, classLists);
    if (!matchesClass) continue;

    const canStillUse = maxSpellLevel >= 1 && add2eSpellSyncCanUseSpellLevel(actor, classLists, spellLevel, maxSpellLevel);
    if (canStillUse) continue;

    idsToDelete.push(sort.id);
  }

  if (idsToDelete.length) {
    console.log("[ADD2E][LEVEL_SPELL_SYNC][PRUNE] Suppression des sorts non accessibles", {
      actor: actor.name,
      classe: classItem.name,
      actorLevel: level,
      maxSpellLevel,
      idsToDelete
    });

    await actor.deleteEmbeddedDocuments("Item", idsToDelete, { add2eInternal: true });
  }

  await add2eSpellSyncSetLastMax(actor, maxSpellLevel);

  if (options.notify !== false && idsToDelete.length) {
    ui.notifications.info(`Sorts non accessibles retirés : ${idsToDelete.length}.`);
  }

  return {
    handled: true,
    deleted: idsToDelete.length,
    maxSpellLevel,
    actorLevel: level
  };
}

async function add2eSyncActorSpellsFromClass(actor, classItem, options = {}) {
  if (!actor || !classItem || classItem.type !== "classe") {
    return { handled: false, imported: 0, deleted: 0 };
  }

  const mode = options.mode === "missing" ? "missing" : "replace";
  const showWait = options.showWait !== false;
  const classLists = add2eSpellSyncClassLists(classItem);

  if (!classLists.length) {
    return { handled: false, imported: 0, deleted: 0, reason: "no-cleric-druid-list" };
  }

  const actorLevel = Math.max(1, Number(options.actorLevel ?? actor.system?.niveau) || 1);
  const maxSpellLevel = add2eSpellSyncMaxSpellLevel(classItem, actorLevel);
  const minSpellLevel = Math.max(1, Number(options.minSpellLevel ?? 1) || 1);

  console.log("[ADD2E][CLASS_DROP_SPELLS][START]", {
    actor: actor.name,
    classe: classItem.name,
    actorLevel,
    classLists,
    maxSpellLevel,
    minSpellLevel,
    mode
  });

  const waitDialog = showWait
    ? await add2eSpellSyncOpenWaitMessage({ actor, classItem, mode, minSpellLevel, maxSpellLevel })
    : null;

  try {
    const existingSpellIds = actor.items
      .filter(i => i.type === "sort")
      .map(i => i.id);

    // Drop de classe : remise à zéro complète demandée.
    // Changement de niveau : surtout ne pas supprimer les sorts déjà présents.
    if (mode === "replace" && existingSpellIds.length) {
      await actor.deleteEmbeddedDocuments("Item", existingSpellIds);
    }

    if (maxSpellLevel < 1 || minSpellLevel > maxSpellLevel) {
      await add2eSpellSyncSetLastMax(actor, maxSpellLevel);
      return {
        handled: true,
        imported: 0,
        deleted: mode === "replace" ? existingSpellIds.length : 0,
        maxSpellLevel,
        mode
      };
    }

    const pack = game.packs.get("add2e.sorts");

    if (!pack) {
      ui.notifications.error("Compendium de sorts introuvable : add2e.sorts");
      console.error("[ADD2E][CLASS_DROP_SPELLS][ERROR] Compendium introuvable add2e.sorts");
      return {
        handled: true,
        imported: 0,
        deleted: mode === "replace" ? existingSpellIds.length : 0,
        maxSpellLevel,
        error: "missing-pack",
        mode
      };
    }

    await pack.getIndex();

    const existingKeys = mode === "missing" ? add2eSpellSyncExistingKeys(actor) : new Set();
    const docsToImport = [];
    const scanStatsByLevel = {};
    const addScanStat = (level, reason) => {
      const lvl = Number(level) || 0;
      if (!scanStatsByLevel[lvl]) scanStatsByLevel[lvl] = {};
      scanStatsByLevel[lvl][reason] = (scanStatsByLevel[lvl][reason] || 0) + 1;
    };

    for (const entry of Array.from(pack.index ?? [])) {
      const entryData = add2eSpellSyncIndexEntryData(entry);
      const entryId = add2eSpellSyncIndexEntryId(entry);

      if (entryData.type && entryData.type !== "sort") continue;
      if (!entryId) {
        console.warn("[ADD2E][CLASS_DROP_SPELLS][SKIP] Entrée de compendium sans id", entry);
        continue;
      }

      let spell = null;
      try {
        spell = await pack.getDocument(entryId);
      } catch (err) {
        console.warn("[ADD2E][CLASS_DROP_SPELLS][SKIP] Sort de compendium illisible", {
          pack: pack.collection,
          entryId,
          entry: entryData,
          err
        });
        continue;
      }

      if (!spell || spell.type !== "sort") continue;

      const spellLevel = add2eSpellSyncSpellLevel(spell.system ?? {});
      if (spellLevel < minSpellLevel) {
        addScanStat(spellLevel, "skip-below-min");
        continue;
      }
      if (!add2eSpellSyncCanUseSpellLevel(actor, classLists, spellLevel, maxSpellLevel)) {
        addScanStat(spellLevel, "skip-level-not-accessible");
        continue;
      }

      const spellLists = add2eSpellSyncSpellLists(spell.system ?? {});
      const usable = spellLists.some(list => classLists.includes(list));
      if (!usable) {
        addScanStat(spellLevel, `skip-list:${spellLists.join("/") || "none"}`);
        continue;
      }

      const stableKey = add2eSpellSyncStableKey(spell.name, spell.system ?? {});
      if (mode === "missing" && existingKeys.has(stableKey)) {
        addScanStat(spellLevel, "skip-already-present");
        continue;
      }
      existingKeys.add(stableKey);

      addScanStat(spellLevel, "import");
      docsToImport.push(spell);
    }

    docsToImport.sort((a, b) => {
      const la = add2eSpellSyncSpellLevel(a.system ?? {});
      const lb = add2eSpellSyncSpellLevel(b.system ?? {});
      return la - lb || String(a.name).localeCompare(String(b.name), "fr");
    });

    const createData = docsToImport.map(spell => {
      const data = spell.toObject();

      delete data._id;
      data.folder = null;

      foundry.utils.setProperty(data, "flags.add2e.autoGrantedByClass", classItem.name);
      foundry.utils.setProperty(data, "flags.add2e.autoGrantedByClassId", classItem.id);
      foundry.utils.setProperty(data, "flags.add2e.autoGrantedSpellSync", true);
      foundry.utils.setProperty(data, "flags.add2e.autoGrantedAtActorLevel", actorLevel);

      return data;
    });

    if (createData.length) {
      await actor.createEmbeddedDocuments("Item", createData);
    }

    await add2eSpellSyncSetLastMax(actor, maxSpellLevel);

    console.log("[ADD2E][CLASS_DROP_SPELLS][DONE]", {
      actor: actor.name,
      classe: classItem.name,
      actorLevel,
      classLists,
      maxSpellLevel,
      minSpellLevel,
      deleted: mode === "replace" ? existingSpellIds.length : 0,
      imported: createData.length,
      mode,
      scanStatsByLevel,
      importedNames: docsToImport.map(s => s.name)
    });

    return {
      handled: true,
      imported: createData.length,
      deleted: mode === "replace" ? existingSpellIds.length : 0,
      maxSpellLevel,
      minSpellLevel,
      mode
    };
  } finally {
    add2eSpellSyncCloseWaitMessage(waitDialog);
  }
}

async function add2eSyncNewSpellLevelsAfterActorLevelChange(actor, newLevel) {
  if (!actor || actor.type !== "personnage") return null;

  console.log("[ADD2E][LEVEL_SPELL_SYNC][START]", {
    actor: actor?.name,
    newLevel,
    currentLevel: actor?.system?.niveau
  });

  const classItem = actor.items?.find?.(i => String(i.type || "").toLowerCase() === "classe") ?? null;
  if (!classItem) return null;

  const classLists = add2eSpellSyncClassLists(classItem);
  if (!classLists.length) return null;

  const level = Math.max(1, Number(newLevel ?? actor.system?.niveau) || 1);
  const maxSpellLevel = add2eSpellSyncMaxSpellLevel(classItem, level);
  const lastFlagMax = add2eSpellSyncGetLastMax(actor);
  const existingMaxBeforePrune = add2eSpellSyncMaxExistingLevel(actor, classLists);
  const knownBeforePrune = Math.max(lastFlagMax, existingMaxBeforePrune);

  // Important : en cas de baisse de niveau, on retire les sorts de classe
  // qui ne sont plus accessibles. Sinon le HBS garde une section pour ces niveaux.
  const prune = await add2ePruneActorSpellsForClassLevel(actor, classItem, level, { notify: true });
  const existingMaxAfterPrune = add2eSpellSyncMaxExistingLevel(actor, classLists);

  if (maxSpellLevel < knownBeforePrune) {
    console.log("[ADD2E][LEVEL_SPELL_SYNC][LEVEL_DOWN_OR_CAP_DOWN]", {
      actor: actor.name,
      classe: classItem.name,
      newLevel: level,
      knownBeforePrune,
      existingMaxBeforePrune,
      existingMaxAfterPrune,
      maxSpellLevel,
      deleted: prune?.deleted ?? 0
    });

    add2eRerenderActorSheet(actor, false);
    return {
      handled: true,
      imported: 0,
      deleted: prune?.deleted ?? 0,
      skipped: true,
      reason: "level-down-or-cap-down",
      previousKnownMax: knownBeforePrune,
      maxSpellLevel
    };
  }

  const previousKnownMax = Math.max(lastFlagMax, existingMaxAfterPrune);

  if (maxSpellLevel <= previousKnownMax) {
    // Sécurité : même si le flag indique déjà ce niveau, on vérifie les sorts manquants.
    // Cela corrige les anciens essais où le flag était monté mais où les sorts de niveau 7 n'avaient pas été copiés.
    const missing = await add2eSyncActorSpellsFromClass(actor, classItem, {
      mode: "missing",
      actorLevel: level,
      minSpellLevel: 1,
      showWait: false
    });

    await add2eSpellSyncSetLastMax(actor, maxSpellLevel);
    console.log("[ADD2E][LEVEL_SPELL_SYNC][NO_NEW_LEVEL_CHECK_MISSING]", {
      actor: actor.name,
      classe: classItem.name,
      newLevel: level,
      previousKnownMax,
      maxSpellLevel,
      importedMissing: missing?.imported ?? 0,
      deleted: prune?.deleted ?? 0
    });

    if ((prune?.deleted ?? 0) > 0 || (missing?.imported ?? 0) > 0) add2eRerenderActorSheet(actor, false);
    return {
      handled: true,
      imported: missing?.imported ?? 0,
      deleted: prune?.deleted ?? 0,
      skipped: true,
      previousKnownMax,
      maxSpellLevel
    };
  }

  ui.notifications.info(`Nouveau niveau de sorts atteint : import des sorts de niveau ${previousKnownMax + 1} à ${maxSpellLevel}.`);

  const result = await add2eSyncActorSpellsFromClass(actor, classItem, {
    mode: "missing",
    actorLevel: level,
    minSpellLevel: previousKnownMax + 1,
    showWait: true
  });

  if (result?.handled && result.imported > 0) {
    ui.notifications.info(`Nouveaux sorts importés : ${result.imported}.`);
  } else if (result?.handled) {
    ui.notifications.info("Aucun nouveau sort manquant à importer.");
  }

  if ((result?.imported ?? 0) > 0 || (prune?.deleted ?? 0) > 0) {
    add2eRerenderActorSheet(actor, false);
  }

  return {
    ...(result ?? {}),
    deleted: (result?.deleted ?? 0) + (prune?.deleted ?? 0)
  };
}
// La synchronisation des sorts de classe est appelée directement dans Add2eActorSheet._onDrop,
// après validation des prérequis, création réelle de l’item classe et mise à jour de l’acteur.
// Ne pas utiliser de Hooks.on("createItem") ici : ce hook se déclenche trop tôt dans le flux de drop
// et peut aussi se déclencher lors d’imports/macros qui ne sont pas un vrai changement de classe.

/**
 * Handler factorisé pour toutes les actions sur items (arme, armure, sort, objet, etc.)
 * @param {Object} params
 * - actor: L'acteur cible (this.actor dans une fiche)
 * - action: 'edit', 'delete', 'equip'
 * - itemId: l'ID de l'item
 * - itemType: 'arme', 'armure', 'sort', 'objet', etc. (optionnel)
 * - sheet: la fiche active (this) pour render si besoin
 */

// ============================================================
// ADD2E — Restrictions équipement génériques par tags
// Source principale : Item "classe" embarqué sur l'acteur.
// Ne code aucune classe en dur dans add2e.mjs.
// ============================================================
function add2eDeepClone(value) {
  if (value === undefined || value === null) return value;
  if (foundry?.utils?.deepClone) return foundry.utils.deepClone(value);
  if (foundry?.utils?.duplicate) return foundry.utils.duplicate(value);
  return JSON.parse(JSON.stringify(value));
}

function add2eNormalizeEquipTag(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[\s\-]+/g, "_")
    .replace(/_+/g, "_");
}

function add2eToEquipArray(value) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value
      .flatMap(v => add2eToEquipArray(v))
      .filter(v => v !== null && v !== undefined && String(v).trim() !== "");
  }

  if (typeof value === "string") {
    const s = value.trim();
    if (!s) return [];
    return s.split(/[,;\n|]+/).map(x => x.trim()).filter(Boolean);
  }

  if (value && typeof value === "object") {
    for (const key of [
      "value",
      "list",
      "lists",
      "items",
      "tags",
      "effectTags",
      "allowedTags",
      "forbiddenTags",
      "armorAllowed",
      "armures_autorisees",
      "weaponsAllowed",
      "armes_autorisees"
    ]) {
      if (value[key] !== undefined && value[key] !== null) return add2eToEquipArray(value[key]);
    }
  }

  return [];
}

function add2ePushEquipTag(target, rawTag) {
  const tag = add2eNormalizeEquipTag(rawTag);
  if (!tag) return;

  target.add(tag);

  // Compat effectTags avec underscores, ex: categorie_armure_moyenne.
  const variants = [
    ["categorie_armure_", "categorie_armure:"],
    ["type_armure_exact_", "type_armure_exact:"],
    ["type_armure_", "type_armure:"],
    ["type_arme_", "type_arme:"],
    ["famille_arme_", "famille_arme:"],
    ["degat_", "degat:"],
    ["usage_", "usage:"],
    ["armure_", "armure:"],
    ["arme_", "arme:"]
  ];

  for (const [prefix, replacement] of variants) {
    if (tag.startsWith(prefix) && tag.length > prefix.length) {
      target.add(replacement + tag.slice(prefix.length));
    }
  }
}

function add2ePushEquipTags(target, raw) {
  for (const tag of add2eToEquipArray(raw)) add2ePushEquipTag(target, tag);
}

function add2eHasUsefulValue(value) {
  if (value === true || value === false) return true;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim() !== "";
  if (value && typeof value === "object") return Object.keys(value).length > 0;
  return false;
}

function add2eGetActorClassItem(actor) {
  const classItems = actor?.items?.filter?.(i => String(i?.type ?? "").toLowerCase() === "classe") ?? [];
  if (!classItems.length) return null;

  const details = actor?.system?.details_classe ?? {};
  const wanted = add2eNormalizeEquipTag(
    actor?.system?.classe ||
    details.label ||
    details.nom ||
    details.name ||
    details.classe ||
    ""
  );

  if (wanted) {
    const found = classItems.find(i => {
      const sys = i.system ?? {};
      const names = [
        i.name,
        sys.label,
        sys.nom,
        sys.name,
        sys.classe
      ].map(add2eNormalizeEquipTag).filter(Boolean);

      return names.includes(wanted);
    });
    if (found) return found;
  }

  return classItems[0] ?? null;
}

function add2eGetActorClassSystem(actor) {
  const details = add2eDeepClone(actor?.system?.details_classe ?? {}) || {};
  const classItem = add2eGetActorClassItem(actor);
  const itemSystem = add2eDeepClone(classItem?.system ?? {}) || {};

  // Base : details_classe pour conserver les données déjà calculées.
  // Priorité : item Classe embarqué pour les règles source de restrictions.
  let merged;
  if (foundry?.utils?.mergeObject) {
    merged = foundry.utils.mergeObject(details, itemSystem, {
      inplace: false,
      recursive: true
    });
  } else {
    merged = { ...details, ...itemSystem };
  }

  const ruleFields = [
    "weaponRestriction",
    "armorRestriction",
    "armorAllowed",
    "armures_autorisees",
    "weaponsAllowed",
    "armes_autorisees",
    "shieldAllowed",
    "tags"
  ];

  for (const field of ruleFields) {
    if (add2eHasUsefulValue(itemSystem[field])) {
      merged[field] = add2eDeepClone(itemSystem[field]);
    }
  }

  merged.__classItemId = classItem?.id ?? null;
  merged.__classItemName = classItem?.name ?? null;

  return merged;
}

function add2eGetItemEquipTags(item) {
  const tags = new Set();
  const sys = item?.system ?? {};
  const type = String(item?.type ?? "").toLowerCase();

  add2ePushEquipTags(tags, sys.tags);
  add2ePushEquipTags(tags, sys.tag);
  add2ePushEquipTags(tags, sys.effectTags);
  add2ePushEquipTags(tags, sys.effecttags);
  add2ePushEquipTags(tags, sys.effets);
  add2ePushEquipTags(tags, sys.effects);
  add2ePushEquipTags(tags, item?.flags?.add2e?.tags);

  const nameNorm = add2eNormalizeEquipTag(item?.name ?? sys.nom ?? "");
  const catNorm = add2eNormalizeEquipTag(sys.categorie ?? sys.category ?? "");
  const typeNorm = add2eNormalizeEquipTag(sys.type ?? sys.type_arme ?? sys.type_armure ?? "");
  const familleNorm = add2eNormalizeEquipTag(sys.famille ?? sys.famille_arme ?? "");
  const props = add2eToEquipArray(sys.proprietes ?? sys.properties ?? sys.type_degats ?? sys["type_dégâts"] ?? sys.degats ?? sys["dégâts"]);

  if (type === "arme" || type === "weapon") {
    tags.add("arme");
    if (nameNorm) {
      tags.add(`arme:${nameNorm}`);
      tags.add(`type_arme:${nameNorm}`);
    }
    if (typeNorm) tags.add(`type_arme:${typeNorm}`);
    if (familleNorm) tags.add(`famille_arme:${familleNorm}`);

    for (const p of props) {
      const prop = add2eNormalizeEquipTag(p);
      if (!prop) continue;

      tags.add(prop);
      tags.add(`arme:${prop}`);

      if (prop.includes("contondant")) tags.add("degat:contondant");
      if (prop.includes("tranchant")) tags.add("degat:tranchant");
      if (prop.includes("perforant") || prop.includes("pointu")) tags.add("degat:perforant");
      if (prop.includes("distance") || prop.includes("projectile")) tags.add("usage:distance");
      if (prop.includes("lancer") || prop.includes("jet")) tags.add("usage:lancer");
      if (prop.includes("deux_mains") || prop.includes("2_mains")) tags.add("usage:deux_mains");
      if (prop.includes("corps_a_corps") || prop.includes("melee") || prop.includes("melee")) tags.add("usage:corps_a_corps");
    }

    const damageText = add2eNormalizeEquipTag(sys.type_degats ?? sys["type_dégâts"] ?? "");
    if (damageText.includes("contondant")) tags.add("degat:contondant");
    if (damageText.includes("tranchant")) tags.add("degat:tranchant");
    if (damageText.includes("perforant") || damageText.includes("pointu")) tags.add("degat:perforant");

    if (sys.deuxMains === true) tags.add("usage:deux_mains");
    if (sys.arme_de_jet === true || sys.portee_courte || sys.portee_moyenne || sys.portee_longue) tags.add("usage:distance");
  }

  if (type === "armure" || type === "armor") {
    tags.add("armure");
    if (nameNorm) {
      tags.add(`armure:${nameNorm}`);
      tags.add(`type_armure:${nameNorm}`);
    }
    if (catNorm) {
      tags.add(`armure:${catNorm}`);
      tags.add(`categorie_armure:${catNorm}`);
    }
    if (typeNorm) tags.add(`type_armure:${typeNorm}`);

    if (nameNorm.includes("bouclier") || catNorm.includes("bouclier")) {
      tags.add("bouclier");
      tags.add("armure:bouclier");
      tags.add("categorie_armure:bouclier");
    }

    if (
      nameNorm.includes("heaume") ||
      nameNorm.includes("casque") ||
      catNorm.includes("heaume") ||
      catNorm.includes("casque")
    ) {
      tags.add("heaume");
      tags.add("casque");
    }

    for (const p of props) {
      const prop = add2eNormalizeEquipTag(p);
      if (!prop) continue;

      tags.add(prop);
      tags.add(`armure:${prop}`);

      if (prop.includes("legere")) tags.add("categorie_armure:legere");
      if (prop.includes("moyenne")) tags.add("categorie_armure:moyenne");
      if (prop.includes("lourde")) tags.add("categorie_armure:lourde");
      if (prop.includes("bouclier")) {
        tags.add("bouclier");
        tags.add("categorie_armure:bouclier");
      }
    }
  }

  return [...tags].filter(Boolean);
}

function add2eHasTagRestriction(restriction) {
  return !!restriction && (
    add2eToEquipArray(restriction.allowedTags).length > 0 ||
    add2eToEquipArray(restriction.forbiddenTags).length > 0 ||
    String(restriction.mode ?? "").toLowerCase().includes("tag")
  );
}

function add2eCheckItemTagRestriction(item, restriction = {}) {
  const itemTags = add2eGetItemEquipTags(item);
  const itemSet = new Set(itemTags);

  const allowedTags = add2eToEquipArray(restriction.allowedTags)
    .map(add2eNormalizeEquipTag)
    .filter(Boolean);

  const forbiddenTags = add2eToEquipArray(restriction.forbiddenTags)
    .map(add2eNormalizeEquipTag)
    .filter(Boolean);

  // Tags d'exception : permettent d'autoriser un type précis même s'il
  // appartient à une famille ou à un type de dégâts normalement interdit.
  // Exemple : forbiddenTags ["degat:perforant"] + overrideForbiddenTags ["type_arme:dague"].
  const overrideForbiddenTags = [
    ...add2eToEquipArray(restriction.overrideForbiddenTags),
    ...add2eToEquipArray(restriction.exceptionTags),
    ...add2eToEquipArray(restriction.alwaysAllowedTags),
    ...add2eToEquipArray(restriction.allowEvenIfForbiddenTags)
  ]
    .map(add2eNormalizeEquipTag)
    .filter(Boolean);

  const matchedOverride = overrideForbiddenTags.find(t => itemSet.has(t));
  const matchedAllowed = allowedTags.find(t => itemSet.has(t));
  const matchedForbidden = forbiddenTags.find(t => itemSet.has(t));

  if (matchedOverride) {
    return {
      ok: true,
      reason: "override-forbidden",
      matchedForbidden: matchedForbidden ?? null,
      matchedAllowed: matchedOverride,
      matchedOverride,
      itemTags,
      allowedTags,
      forbiddenTags,
      overrideForbiddenTags
    };
  }

  // Règle importante pour les armes à dégâts mixtes :
  // si au moins un tag autorisé correspond, l'item est autorisé même s'il
  // possède aussi un tag interdit. Exemple : Morgenstern = degat:contondant
  // + degat:perforant ; le clerc peut l'utiliser grâce au dégât contondant.
  if (matchedAllowed) {
    return {
      ok: true,
      reason: matchedForbidden ? "allowed-despite-forbidden-tag" : "allowed",
      matchedForbidden: matchedForbidden ?? null,
      matchedAllowed,
      matchedOverride: null,
      itemTags,
      allowedTags,
      forbiddenTags,
      overrideForbiddenTags
    };
  }

  if (matchedForbidden) {
    return {
      ok: false,
      reason: "forbidden",
      matchedForbidden,
      matchedAllowed: null,
      matchedOverride: null,
      itemTags,
      allowedTags,
      forbiddenTags,
      overrideForbiddenTags
    };
  }

  if (!allowedTags.length) {
    return {
      ok: true,
      reason: "no-allowed-tags",
      matchedForbidden: null,
      matchedAllowed: null,
      matchedOverride: null,
      itemTags,
      allowedTags,
      forbiddenTags,
      overrideForbiddenTags
    };
  }

  return {
    ok: false,
    reason: "no-match",
    matchedForbidden: null,
    matchedAllowed: null,
    matchedOverride: null,
    itemTags,
    allowedTags,
    forbiddenTags,
    overrideForbiddenTags
  };
}

function add2eItemNameNorm(item) {
  return add2eNormalizeEquipTag(item?.name ?? item?.system?.nom ?? "");
}

function add2eIsShield(item) {
  const tags = new Set(add2eGetItemEquipTags(item));
  const name = add2eItemNameNorm(item);
  return tags.has("bouclier") || tags.has("categorie_armure:bouclier") || name.includes("bouclier");
}

function add2eIsHelmet(item) {
  const tags = new Set(add2eGetItemEquipTags(item));
  const name = add2eItemNameNorm(item);
  return tags.has("heaume") || tags.has("casque") || name.includes("heaume") || name.includes("casque");
}

function add2eLegacyAllowsItemByNameOrTag(item, allowedRaw, kind) {
  const allowed = add2eToEquipArray(allowedRaw).map(add2eNormalizeEquipTag).filter(Boolean);
  const itemTags = new Set(add2eGetItemEquipTags(item));
  const itemName = add2eItemNameNorm(item);
  const cat = add2eNormalizeEquipTag(item?.system?.categorie ?? item?.system?.category ?? "");

  if (!allowed.length) return { ok: true, reason: "legacy-empty-allow" };
  if (allowed.includes("toutes") || allowed.includes("toute") || allowed.includes("all")) return { ok: true, reason: "legacy-all" };
  if (allowed.includes("aucune") || allowed.includes("aucun") || allowed.includes("none")) return { ok: false, reason: "legacy-none" };

  const matched = allowed.find(a =>
    itemTags.has(a) ||
    itemTags.has(`${kind}:${a}`) ||
    itemTags.has(`type_${kind}:${a}`) ||
    itemTags.has(`categorie_${kind}:${a}`) ||
    itemTags.has(`categorie_armure:${a}`) ||
    itemTags.has(`type_arme:${a}`) ||
    itemTags.has(`famille_arme:${a}`) ||
    itemName.includes(a) ||
    (cat && cat.includes(a))
  );

  return matched
    ? { ok: true, reason: "legacy-match", matchedAllowed: matched }
    : { ok: false, reason: "legacy-no-match", allowed, itemTags: [...itemTags] };
}

function add2eCheckEquipmentAllowedForClass(actor, item, kind) {
  const classe = add2eGetActorClassSystem(actor);
  const classeLabel = classe.label || classe.nom || classe.name || classe.__classItemName || "classe inconnue";

  if (kind === "arme") {
    const restriction = classe.weaponRestriction ?? {};
    if (add2eHasTagRestriction(restriction)) {
      const check = add2eCheckItemTagRestriction(item, restriction);
      return { ...check, classe, classeLabel, mode: "weaponRestriction" };
    }

    const legacy = add2eLegacyAllowsItemByNameOrTag(
      item,
      classe.armes_autorisees ?? classe.weaponsAllowed ?? [],
      "arme"
    );

    return { ...legacy, classe, classeLabel, mode: "legacy-weapon" };
  }

  if (kind === "armure") {
    const restriction = classe.armorRestriction ?? {};
    if (add2eHasTagRestriction(restriction)) {
      const check = add2eCheckItemTagRestriction(item, restriction);
      return { ...check, classe, classeLabel, mode: "armorRestriction" };
    }

    if (add2eIsShield(item)) {
      const shieldAllowed =
        classe.shieldAllowed === true ||
        add2eToEquipArray(classe.armorAllowed ?? classe.armures_autorisees ?? [])
          .map(add2eNormalizeEquipTag)
          .some(v => ["toutes", "toute", "all", "bouclier", "boucliers"].includes(v));

      return {
        ok: !!shieldAllowed,
        reason: shieldAllowed ? "legacy-shield-allowed" : "legacy-shield-forbidden",
        classe,
        classeLabel,
        mode: "legacy-armor"
      };
    }

    const legacy = add2eLegacyAllowsItemByNameOrTag(
      item,
      classe.armorAllowed ?? classe.armures_autorisees ?? [],
      "armure"
    );

    return { ...legacy, classe, classeLabel, mode: "legacy-armor" };
  }

  return { ok: true, reason: "no-kind", classe, classeLabel, mode: "none" };
}

globalThis.add2eNormalizeEquipTag = add2eNormalizeEquipTag;
globalThis.add2eToEquipArray = add2eToEquipArray;
globalThis.add2eGetActorClassSystem = add2eGetActorClassSystem;
globalThis.add2eGetItemEquipTags = add2eGetItemEquipTags;
globalThis.add2eCheckEquipmentAllowedForClass = add2eCheckEquipmentAllowedForClass;


// ============================================================
// ADD2E — Capacités activables de classe : exécution on_use
// ============================================================
function add2eToClassFeatureArray(value) {
  if (Array.isArray(value)) return value.filter(v => v && typeof v === "object");
  if (value && typeof value === "object") return Object.values(value).filter(v => v && typeof v === "object");
  return [];
}

function add2eFeatureMinLevel(feature) {
  return Number(feature?.minLevel ?? feature?.minimumLevel ?? feature?.niveauMin ?? feature?.level ?? feature?.niveau ?? 1) || 1;
}

function add2eFeatureMaxLevel(feature) {
  const raw = feature?.maxLevel ?? feature?.maximumLevel ?? feature?.niveauMax ?? feature?.max;
  if (raw === undefined || raw === null || raw === "") return 999;
  return Number(raw) || 999;
}

function add2eGetActorClassFeatures(actor) {
  const sys = actor?.system ?? {};
  const details = sys.details_classe ?? {};
  const candidates =
    details.classFeatures ??
    details.capacitesClasse ??
    sys.classFeatures ??
    sys.capacitesClasse ??
    [];
  return add2eToClassFeatureArray(candidates);
}

function add2eGetActorActivableClassFeatures(actor, { includeLocked = true } = {}) {
  const level = Number(actor?.system?.niveau ?? 1) || 1;
  return add2eGetActorClassFeatures(actor).filter(f => {
    if (f?.activable !== true) return false;
    if (includeLocked) return true;
    return level >= add2eFeatureMinLevel(f) && level <= add2eFeatureMaxLevel(f);
  });
}

function add2eDatasetValue(dataset, keys) {
  if (!dataset) return undefined;
  for (const k of keys) {
    if (dataset[k] !== undefined && dataset[k] !== null && String(dataset[k]).trim() !== "") return dataset[k];
  }
  return undefined;
}

function add2eFeatureName(feature) {
  return String(feature?.name ?? feature?.label ?? feature?.title ?? feature?.nom ?? "").trim();
}

function add2eFeatureOnUse(feature) {
  return String(feature?.on_use ?? feature?.onUse ?? feature?.script ?? feature?.macro ?? "").trim();
}

function add2eFindClassFeatureFromElement(actor, element) {
  const allFeatures = add2eGetActorClassFeatures(actor);
  const activeFeatures = add2eGetActorActivableClassFeatures(actor);
  const el = element instanceof HTMLElement ? element : element?.[0];
  if (!el) return null;

  const holder = el.closest?.("[data-feature-index], [data-feature-name], [data-feature-id], [data-feature-key], [data-on-use]") ?? el;
  const ds = holder?.dataset ?? el?.dataset ?? {};

  const rawIndex = add2eDatasetValue(ds, ["featureIndex", "index", "idx"]);
  if (rawIndex !== undefined) {
    const idx = Number(rawIndex);
    if (Number.isInteger(idx)) {
      const byOriginalIndex = allFeatures[idx];
      if (byOriginalIndex?.activable === true) return byOriginalIndex;
      const byActiveIndex = activeFeatures[idx];
      if (byActiveIndex) return byActiveIndex;
    }
  }

  const rawOnUse = add2eDatasetValue(ds, ["onUse", "onuse", "on_use"]);
  if (rawOnUse !== undefined) {
    const wanted = String(rawOnUse).trim();
    const byScript = activeFeatures.find(f => add2eFeatureOnUse(f) === wanted);
    if (byScript) return byScript;
  }

  const rawId = add2eDatasetValue(ds, ["featureId", "featureKey", "id", "key"]);
  if (rawId !== undefined) {
    const wanted = add2eNormalizeEquipTag(rawId);
    const byId = activeFeatures.find(f => {
      const values = [f.id, f._id, f.key, f.slug, f.name, f.label, f.title, f.nom]
        .map(add2eNormalizeEquipTag)
        .filter(Boolean);
      return values.includes(wanted);
    });
    if (byId) return byId;
  }

  const rawName = add2eDatasetValue(ds, ["featureName", "name", "feature", "nom"]);
  if (rawName !== undefined) {
    const wanted = add2eNormalizeEquipTag(rawName);
    const byName = activeFeatures.find(f => add2eNormalizeEquipTag(add2eFeatureName(f)) === wanted);
    if (byName) return byName;
  }

  let cursor = el;
  for (let depth = 0; cursor && depth < 8; depth++, cursor = cursor.parentElement) {
    const text = add2eNormalizeEquipTag(cursor.textContent ?? "");
    if (!text || text === "utiliser") continue;

    const matches = activeFeatures.filter(f => {
      const n = add2eNormalizeEquipTag(add2eFeatureName(f));
      return n && text.includes(n);
    });

    if (matches.length === 1) return matches[0];
  }

  if (activeFeatures.length === 1) return activeFeatures[0];
  return null;
}

async function add2eExecuteClassFeatureOnUse(actor, feature, sheet = null) {
  if (!actor) {
    ui.notifications.error("Capacité de classe : acteur introuvable.");
    return false;
  }

  if (!feature) {
    ui.notifications.error("Capacité de classe introuvable dans les données de l'acteur.");
    return false;
  }

  const level = Number(actor.system?.niveau ?? 1) || 1;
  const min = add2eFeatureMinLevel(feature);
  const max = add2eFeatureMaxLevel(feature);
  const name = add2eFeatureName(feature) || "Capacité";

  if (level < min || level > max) {
    ui.notifications.warn(`La capacité « ${name} » n'est pas disponible au niveau ${level}.`);
    return false;
  }

  const onUse = add2eFeatureOnUse(feature);
  if (!onUse) {
    ui.notifications.warn(`La capacité « ${name} » n'a pas de script on_use.`);
    return false;
  }

  try {
    const url = onUse.includes("?") ? `${onUse}&cb=${Date.now()}` : `${onUse}?cb=${Date.now()}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);

    const code = await response.text();
    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
    const runner = new AsyncFunction(
      "actor",
      "feature",
      "item",
      "sort",
      "game",
      "ui",
      "ChatMessage",
      "Roll",
      "foundry",
      "canvas",
      code
    );

    const result = await runner(actor, feature, feature, null, game, ui, ChatMessage, Roll, foundry, canvas);

    console.log("[ADD2E][CAPACITE][ON_USE]", {
      actor: actor.name,
      feature: name,
      onUse,
      result
    });

    sheet?._add2eRememberActiveTab?.();
    sheet?.render?.(false);
    return result !== false;
  } catch (err) {
    console.error("[ADD2E][CAPACITE][ON_USE][ERREUR]", { actor: actor.name, feature: name, onUse, err });
    ui.notifications.error(`Erreur pendant l'utilisation de « ${name} » : ${err.message}`);
    return false;
  }
}

async function add2eUseClassFeatureFromElement(actor, element, sheet = null) {
  const feature = add2eFindClassFeatureFromElement(actor, element);
  return add2eExecuteClassFeatureOnUse(actor, feature, sheet);
}

globalThis.add2eGetActorClassFeatures = add2eGetActorClassFeatures;
globalThis.add2eGetActorActivableClassFeatures = add2eGetActorActivableClassFeatures;
globalThis.add2eUseClassFeatureFromElement = add2eUseClassFeatureFromElement;

globalThis.add2eExecuteClassFeatureOnUse = add2eExecuteClassFeatureOnUse;


// ============================================================
// ADD2E — Exécution directe des pouvoirs d'objets magiques
// Important : un pouvoir d'objet n'est pas un vrai Item sort de l'acteur.
// On exécute donc son onUse directement, avec un contexte compatible
// avec les scripts de sorts existants.
// ============================================================
function add2eObjectPowerOnUsePath(power) {
  return String(power?.onUse ?? power?.onuse ?? power?.on_use ?? power?.script ?? power?.macro ?? "").trim();
}

function add2eObjectPowerCost(power) {
  return Math.max(0, Number(power?.cout ?? power?.cost ?? power?.chargeCost ?? 0) || 0);
}

function add2eObjectPowerMaxCharges(itemSource, power, idx) {
  const sys = itemSource?.system ?? {};
  const globalMax = Number(sys?.charges?.max ?? sys?.max_charges ?? sys?.maxCharges ?? sys?.chargesMax ?? 0) || 0;
  if (globalMax > 0) return globalMax;
  return Number(power?.max ?? power?.chargesMax ?? power?.maxCharges ?? power?.charges?.max ?? power?.charges ?? 1) || 1;
}

function add2eObjectPowerCurrentCharges(itemSource, power, idx) {
  const sys = itemSource?.system ?? {};
  const cost = add2eObjectPowerCost(power);

  // Un pouvoir permanent / gratuit doit rester lançable même si l'objet n'a pas de réserve de charges.
  // Exemple : Anneau d'invisibilité. La mécanique existante passe par add2eCastSpell,
  // qui vérifie le flag memorizedCount ; on renvoie donc 1 pour les pouvoirs à coût 0.
  if (cost <= 0) return 1;

  const globalMax = Number(sys?.charges?.max ?? sys?.max_charges ?? sys?.maxCharges ?? sys?.chargesMax ?? 0) || 0;

  if (globalMax > 0) {
    const flag = itemSource.getFlag?.("add2e", "global_charges");
    if (flag !== undefined && flag !== null && flag !== "") return Number(flag) || 0;
    return Number(sys?.charges?.value ?? sys?.chargesValeur ?? sys?.charges_value ?? globalMax) || 0;
  }

  const flag = itemSource.getFlag?.("add2e", `charges_${idx}`);
  if (flag !== undefined && flag !== null && flag !== "") return Number(flag) || 0;
  return Number(power?.charges?.value ?? power?.charges ?? power?.value ?? power?.max ?? 1) || 0;
}

async function add2eObjectPowerSetCharges(itemSource, power, idx, value) {
  const sys = itemSource?.system ?? {};
  const globalMax = Number(sys?.charges?.max ?? sys?.max_charges ?? sys?.maxCharges ?? sys?.chargesMax ?? 0) || 0;
  const next = Math.max(0, Number(value) || 0);

  if (globalMax > 0) {
    await itemSource.setFlag?.("add2e", "global_charges", next);
    if (sys?.charges && typeof sys.charges === "object") {
      await itemSource.update({ "system.charges.value": next });
    }
    return;
  }

  await itemSource.setFlag?.("add2e", `charges_${idx}`, next);
}

function add2eBuildVirtualObjectPowerSort(actor, itemSource, power, idx) {
  const generatedId = typeof add2eMagicPowerGeneratedId === "function"
    ? add2eMagicPowerGeneratedId(itemSource, idx)
    : itemSource.id.substring(0, 14) + idx.toString().padStart(2, "0");

  const onUse = add2eObjectPowerOnUsePath(power);
  const cost = add2eObjectPowerCost(power);
  const max = cost <= 0 ? Math.max(1, add2eObjectPowerMaxCharges(itemSource, power, idx)) : add2eObjectPowerMaxCharges(itemSource, power, idx);
  const current = cost <= 0 ? 1 : add2eObjectPowerCurrentCharges(itemSource, power, idx);

  const fakeData = {
    _id: generatedId,
    name: String(power?.name ?? power?.nom ?? itemSource?.name ?? "Pouvoir").trim() || "Pouvoir",
    type: "sort",
    img: power?.img || itemSource?.img || "icons/svg/aura.svg",
    system: {
      niveau: Number(power?.niveau ?? power?.level ?? 1) || 1,
      école: power?.ecole || power?.["école"] || "Magique",
      description: power?.description || power?.desc || itemSource?.system?.description || "",
      composantes: "Objet",
      temps_incantation: power?.activation || power?.temps_incantation || "Objet magique",
      isPower: true,
      isObjectPower: true,
      sourceItemId: itemSource.id,
      sourceWeaponId: itemSource.id,
      sourceItemName: itemSource.name,
      powerIndex: idx,
      cost,
      cout: cost,
      max,
      isGlobalCharge: Number(itemSource?.system?.charges?.max ?? itemSource?.system?.max_charges ?? 0) > 0,
      onUse,
      onuse: onUse,
      on_use: onUse,
      objetMagicOnUse: power?.objetMagicOnUse || power?.fallbackOnUse || "",
      linkedSpell: power?.linkedSpell || null
    },
    flags: {
      add2e: {
        memorizedCount: current,
        originalOnUse: onUse,
        sourceType: "objet_magique",
        sourceItemId: itemSource.id,
        sourceItemName: itemSource.name,
        powerIndex: idx
      }
    }
  };

  const sort = new Item(fakeData, { parent: actor });
  sort.getFlag = (scope, key) => {
    if (scope !== "add2e") return null;
    if (key === "memorizedCount") return cost <= 0 ? 1 : add2eObjectPowerCurrentCharges(itemSource, power, idx);
    if (key === "originalOnUse") return onUse;
    return fakeData.flags?.add2e?.[key] ?? null;
  };
  return sort;
}

async function add2eExecuteObjectMagicPower(actor, itemSource, power, idx, sheet = null) {
  if (!actor || !itemSource || !power) {
    ui.notifications.error("Pouvoir d'objet magique introuvable.");
    return false;
  }

  const powerName = String(power?.name ?? power?.nom ?? itemSource.name ?? "Pouvoir").trim() || "Pouvoir";
  const onUse = add2eObjectPowerOnUsePath(power);
  const cost = add2eObjectPowerCost(power);
  const current = add2eObjectPowerCurrentCharges(itemSource, power, idx);

  if (cost > 0 && current < cost) {
    ui.notifications.warn(`${itemSource.name} n'a pas assez de charges pour utiliser ${powerName}.`);
    return false;
  }

  const sort = add2eBuildVirtualObjectPowerSort(actor, itemSource, power, idx);

  try {
    let result = true;

    if (onUse) {
      const url = onUse.includes("?") ? `${onUse}&cb=${Date.now()}` : `${onUse}?cb=${Date.now()}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);

      const code = await response.text();
      const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
      const scope = {
        actor,
        item: itemSource,
        sourceItem: itemSource,
        sort,
        power,
        pouvoir: power,
        powerIndex: idx,
        isObjectPower: true
      };
      const args = [{ actor, item: itemSource, sourceItem: itemSource, sort, power, pouvoir: power, powerIndex: idx, scope }];

      const runner = new AsyncFunction(
        "actor",
        "item",
        "sourceItem",
        "sort",
        "power",
        "pouvoir",
        "powerIndex",
        "scope",
        "args",
        "game",
        "ui",
        "ChatMessage",
        "Roll",
        "foundry",
        "canvas",
        code
      );

      result = await runner(actor, itemSource, itemSource, sort, power, power, idx, scope, args, game, ui, ChatMessage, Roll, foundry, canvas);
    } else {
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<div class="add2e chat-card"><h3>${powerName}</h3><p>${power?.description || itemSource?.system?.description || "Pouvoir d'objet magique utilisé."}</p></div>`
      });
    }

    // Convention ADD2E : un script peut retourner false pour ne pas consommer la ressource.
    if (result !== false && cost > 0) {
      await add2eObjectPowerSetCharges(itemSource, power, idx, current - cost);
    }

    if (result !== false) {
      console.log("[ADD2E][OBJET_MAGIQUE][POUVOIR_OK]", { actor: actor.name, item: itemSource.name, power: powerName, onUse, cost });
      sheet?._add2eRememberActiveTab?.();
      sheet?.render?.(false);
      return true;
    }

    console.log("[ADD2E][OBJET_MAGIQUE][POUVOIR_ANNULE]", { actor: actor.name, item: itemSource.name, power: powerName, onUse });
    return false;
  } catch (err) {
    console.error("[ADD2E][OBJET_MAGIQUE][POUVOIR_ERREUR]", { actor: actor.name, item: itemSource.name, power: powerName, onUse, err });
    ui.notifications.error(`Erreur pendant l'utilisation de ${powerName} : ${err.message}`);
    return false;
  }
}

globalThis.add2eExecuteObjectMagicPower = add2eExecuteObjectMagicPower;

// ============================================================
// ADD2E — Nettoyage effets de classe + compétences de voleur
// ============================================================
function add2eClassEffectKey(value) {
  return add2eNormalizeEquipTag(value);
}

function add2eEffectFlagValue(effect, keys = []) {
  const flags = effect?.flags?.add2e ?? {};
  for (const key of keys) {
    const value = flags?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return null;
}

function add2eShouldDeleteEffectForClassPurge(effect, itemsToDelete = []) {
  const origin = String(effect?.origin || "");
  const itemUuids = itemsToDelete.map(i => i.uuid).filter(Boolean);
  const itemIds = itemsToDelete.map(i => i.id).filter(Boolean);

  if (itemUuids.includes(origin)) return true;
  if (itemIds.some(id => origin.endsWith(`.${id}`))) return true;

  const oldClassItems = itemsToDelete.filter(i => String(i.type || "").toLowerCase() === "classe");
  if (!oldClassItems.length) return false;

  const oldClassKeys = new Set();
  for (const cls of oldClassItems) {
    const sys = cls.system ?? {};
    for (const value of [cls.name, sys.label, sys.nom, sys.name, sys.classe, sys.slug]) {
      const key = add2eClassEffectKey(value);
      if (key) oldClassKeys.add(key);
    }
    if (cls.id) oldClassKeys.add(add2eClassEffectKey(cls.id));
    if (cls.uuid) oldClassKeys.add(add2eClassEffectKey(cls.uuid));
  }

  const flags = effect?.flags?.add2e ?? {};
  const sourceType = add2eClassEffectKey(flags.sourceType ?? flags.type ?? flags.kind ?? "");
  const sourceClass = add2eClassEffectKey(
    flags.sourceClasse ?? flags.sourceClass ?? flags.className ?? flags.classe ?? flags.classKey ?? ""
  );
  const sourceId = add2eClassEffectKey(flags.sourceItemId ?? flags.sourceClassId ?? flags.classId ?? "");
  const effectName = add2eClassEffectKey(effect?.name ?? effect?.label ?? "");

  if (["classe", "class", "class_feature", "capacite_classe", "classfeature"].includes(sourceType)) return true;
  if (sourceClass && oldClassKeys.has(sourceClass)) return true;
  if (sourceId && oldClassKeys.has(sourceId)) return true;

  // Compatibilité avec les anciens effets non tagués, ex. "Moine — capacités niveau X".
  if (effectName && [...oldClassKeys].some(k => k && effectName.includes(k))) return true;

  return false;
}


function add2eCollectUnlockedClassEffectTags(actor, classItem = null) {
  const tags = new Set();
  const level = Math.max(1, Number(actor?.system?.niveau) || 1);
  const cls = classItem ?? actor?.items?.find?.(i => String(i.type || "").toLowerCase() === "classe") ?? null;
  const systems = [actor?.system?.details_classe, cls?.system].filter(Boolean);

  const push = (value) => {
    for (const raw of add2eToEquipArray(value)) {
      const tag = add2eNormalizeEquipTag(raw);
      if (tag) tags.add(tag);
    }
  };

  const pushFeatures = (features) => {
    const list = Array.isArray(features)
      ? features
      : (features && typeof features === "object" ? Object.values(features) : []);

    for (const feature of list) {
      if (!feature || typeof feature !== "object") continue;
      const min = Number(feature.minLevel ?? feature.minimumLevel ?? feature.level ?? feature.niveau ?? 1) || 1;
      const maxRaw = feature.maxLevel ?? feature.maximumLevel ?? feature.maxNiveau;
      const max = maxRaw === undefined || maxRaw === null || maxRaw === "" ? 999 : Number(maxRaw) || 999;
      if (level < min || level > max) continue;

      push(feature.tags);
      push(feature.tag);
      push(feature.effectTags);
      push(feature.effets);
      push(feature.effects);
      push(feature.flags?.add2e?.tags);
      push(feature.flags?.add2e?.effectTags);
    }
  };

  for (const sys of systems) {
    push(sys.tags);
    push(sys.tag);
    push(sys.effectTags);
    push(sys.effets);
    push(sys.effects);
    push(sys.flags?.add2e?.tags);
    pushFeatures(sys.classFeatures);
    pushFeatures(sys.classFeaturesDebloquees);
  }

  return [...tags].filter(Boolean);
}

async function add2eSyncClassPassiveEffect(actor) {
  if (!actor) return null;

  const classItem = actor.items?.find?.(i => String(i.type || "").toLowerCase() === "classe") ?? null;
  const existing = actor.effects?.filter?.(eff => eff.flags?.add2e?.autoClassPassiveEffect === true) ?? [];

  if (!classItem) {
    const ids = existing.map(e => e.id).filter(Boolean);
    if (ids.length) await actor.deleteEmbeddedDocuments("ActiveEffect", ids);
    return null;
  }

  const tags = add2eCollectUnlockedClassEffectTags(actor, classItem);
  const label = `${classItem.name} — effets de classe`;

  if (!tags.length) {
    const ids = existing.map(e => e.id).filter(Boolean);
    if (ids.length) await actor.deleteEmbeddedDocuments("ActiveEffect", ids);
    return null;
  }

  const data = {
    name: label,
    label,
    icon: classItem.img || "icons/svg/aura.svg",
    origin: classItem.uuid,
    disabled: false,
    transfer: false,
    changes: [],
    flags: {
      add2e: {
        autoClassPassiveEffect: true,
        sourceType: "classe",
        sourceClasse: classItem.name,
        sourceItemId: classItem.id,
        sourceItemUuid: classItem.uuid,
        tags,
        effectTags: tags
      }
    }
  };

  const current = existing[0] ?? null;
  const oldIds = existing.slice(1).map(e => e.id).filter(Boolean);
  if (oldIds.length) await actor.deleteEmbeddedDocuments("ActiveEffect", oldIds);

  if (current) {
    await current.update(data, { render: false });
    return current;
  }

  const [created] = await actor.createEmbeddedDocuments("ActiveEffect", [data]);
  return created ?? null;
}

globalThis.add2eSyncClassPassiveEffect = add2eSyncClassPassiveEffect;

function add2eNormalizeThiefSkillKey(value) {
  const key = add2eNormalizeEquipTag(value)
    .replace(/^competence_voleur:/, "")
    .replace(/^competences_voleur:/, "")
    .replace(/^thief_skill:/, "")
    .replace(/^voleur:/, "");

  const aliases = {
    pick_pockets: "pickpocket",
    pick_pocket: "pickpocket",
    pickpockets: "pickpocket",
    pickpocket: "pickpocket",
    vol_a_la_tire: "pickpocket",
    tire_laine: "pickpocket",

    open_locks: "crochetage_serrures",
    open_lock: "crochetage_serrures",
    crochetage: "crochetage_serrures",
    crochetage_de_serrures: "crochetage_serrures",
    crochetage_serrure: "crochetage_serrures",
    crochetage_serrures: "crochetage_serrures",
    ouverture_de_serrures: "crochetage_serrures",
    ouverture_serrures: "crochetage_serrures",
    ouvrir_serrures: "crochetage_serrures",

    find_remove_traps: "detection_pieges",
    find_traps: "detection_pieges",
    remove_traps: "detection_pieges",
    detect_traps: "detection_pieges",
    detection_desamorcage_des_pieges: "detection_pieges",
    detection_desamorcage_pieges: "detection_pieges",
    detection_pieges: "detection_pieges",
    detection_de_pieges: "detection_pieges",
    desamorcage_pieges: "detection_pieges",
    desamorcage_de_pieges: "detection_pieges",
    pieges: "detection_pieges",

    move_silently: "deplacement_silencieux",
    deplacement_silencieux: "deplacement_silencieux",
    deplacement_en_silence: "deplacement_silencieux",
    silence: "deplacement_silencieux",

    hide_in_shadows: "dissimulation",
    dissimulation_dans_l_ombre: "dissimulation",
    dissimulation_dans_lombre: "dissimulation",
    dissimulation: "dissimulation",
    ombre: "dissimulation",

    detect_noise: "ecoute",
    acuite_auditive: "ecoute",
    ecoute: "ecoute",
    ecouter: "ecoute",

    climb_walls: "escalade",
    escalade: "escalade",
    grimper: "escalade",

    backstab: "frappe_dans_le_dos",
    attaque_dans_le_dos: "frappe_dans_le_dos",
    frappe_dans_le_dos: "frappe_dans_le_dos",
    dos: "frappe_dans_le_dos",

    read_languages: "lecture_langues",
    read_language: "lecture_langues",
    lecture_des_langues: "lecture_langues",
    lecture_langues: "lecture_langues",
    langues: "lecture_langues",

    assassination: "assassinat",
    assassinate: "assassinat",
    assassiner: "assassinat",
    assassinat: "assassinat",
    comp_assassin: "assassinat",
    competence_assassin: "assassinat"
  };

  return aliases[key] ?? key;
}

function add2eThiefToArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(v => add2eThiefToArray(v));
  if (typeof value === "string") return value.split(/[,;|\n]+/).map(v => v.trim()).filter(Boolean);
  return [value];
}

function add2eReadThiefBonusValue(rawValue) {
  if (typeof rawValue === "number") return rawValue;
  if (typeof rawValue === "string" && rawValue.trim() !== "") return Number(rawValue) || 0;
  if (rawValue && typeof rawValue === "object") {
    const v = rawValue.value ?? rawValue.bonus ?? rawValue.mod ?? rawValue.adjustment ?? rawValue.valeur ?? rawValue.malus;
    return Number(v) || 0;
  }
  return 0;
}

function add2eGetThiefBonusFromMap(map, key) {
  if (!map) return 0;
  const wanted = add2eNormalizeThiefSkillKey(key);
  let total = 0;

  const accepts = rawKey => {
    const normKey = add2eNormalizeThiefSkillKey(rawKey);
    return [wanted, "all", "toutes", "global", "*"].includes(normKey);
  };

  if (Array.isArray(map)) {
    for (const entry of map) {
      if (!entry) continue;
      if (typeof entry === "string") {
        // Format accepté : bonus_voleur:crochetage_serrures:10
        const parsed = add2eParseThiefBonusTag(entry);
        if (parsed && accepts(parsed.key)) total += parsed.value;
        continue;
      }
      if (typeof entry === "object") {
        const rawKey = entry.key ?? entry.skill ?? entry.competence ?? entry.compétence ?? entry.name ?? entry.label ?? entry.id ?? "all";
        if (accepts(rawKey)) total += add2eReadThiefBonusValue(entry);
      }
    }
    return total;
  }

  if (typeof map === "string") {
    for (const token of map.split(/[,;|\n]+/).map(x => x.trim()).filter(Boolean)) {
      const parsed = add2eParseThiefBonusTag(token);
      if (parsed && accepts(parsed.key)) total += parsed.value;
    }
    return total;
  }

  if (typeof map !== "object") return 0;

  for (const [rawKey, rawValue] of Object.entries(map)) {
    if (!accepts(rawKey)) continue;
    total += add2eReadThiefBonusValue(rawValue);
  }

  return total;
}

function add2ePushThiefBonus(out, label, map, key) {
  const value = add2eGetThiefBonusFromMap(map, key);
  if (value !== 0) out.push({ label, value });
}

function add2eGetActorRaceSystem(actor) {
  const details = add2eDeepClone(actor?.system?.details_race ?? {}) || {};
  const raceItem = actor?.items?.find?.(i => String(i?.type || "").toLowerCase() === "race") ?? null;
  const itemSystem = add2eDeepClone(raceItem?.system ?? {}) || {};

  if (foundry?.utils?.mergeObject) {
    return foundry.utils.mergeObject(details, itemSystem, { inplace: false, recursive: true });
  }
  return { ...details, ...itemSystem };
}

function add2eGetThiefClassSystem(actor) {
  try {
    const merged = add2eGetActorClassSystem(actor);
    if (merged && typeof merged === "object") return merged;
  } catch (err) {
    console.warn("[ADD2E][VOLEUR][CLASSE] Fallback details_classe.", err);
  }
  return actor?.system?.details_classe ?? {};
}

function add2eGetEquippedThiefBonusMaps(actor) {
  const maps = [];
  for (const item of actor?.items ?? []) {
    const sys = item.system ?? {};
    const equipped = sys.equipee === true || sys.equipped === true || sys.portee === true || sys.active === true;
    if (!equipped) continue;

    const sources = [
      sys.thiefSkillAdjustments,
      sys.thiefSkillBonuses,
      sys.thief_adjustments,
      sys.thief_bonuses,
      sys.voleurSkillAdjustments,
      sys.voleurSkillBonuses,
      sys.bonus_competences_voleur,
      sys.malus_competences_voleur,
      sys.skillBonuses?.voleur,
      sys.skillAdjustments?.voleur,
      item.flags?.add2e?.thiefSkillAdjustments,
      item.flags?.add2e?.thiefSkillBonuses
    ];

    for (const map of sources) {
      if (map && typeof map === "object") maps.push({ label: item.name, map });
    }
  }
  return maps;
}

function add2eGetThiefDexBonus(actor, key) {
  const details = add2eGetThiefClassSystem(actor);
  const dex = Number(
    actor?.system?.dex_aff ??
    actor?.system?.dexterite ??
    actor?.system?.dexterite_base ??
    0
  ) || 0;

  const sources = [
    details.thiefSkillDexAdjustments,
    details.thiefDexAdjustments,
    actor?.system?.thiefSkillDexAdjustments,
    actor?.system?.thiefDexAdjustments
  ];

  for (const table of sources) {
    if (!table || typeof table !== "object") continue;
    const row = table[String(dex)] ?? table[dex];
    const value = add2eGetThiefBonusFromMap(row, key);
    if (value !== 0) return { value, label: `Dextérité ${dex}` };
  }

  return { value: 0, label: `Dextérité ${dex}` };
}

function add2eParseThiefBonusTag(raw) {
  const norm = add2eNormalizeEquipTag(raw);
  if (!norm) return null;

  const prefixes = [
    "bonus_voleur",
    "bonus_competence_voleur",
    "bonus_competences_voleur",
    "bonus_thief_skill",
    "thief_skill_bonus",
    "malus_voleur",
    "malus_competence_voleur",
    "malus_competences_voleur",
    "malus_thief_skill",
    "thief_skill_malus"
  ];

  for (const prefix of prefixes) {
    if (norm === prefix) continue;
    if (!norm.startsWith(prefix + ":") && !norm.startsWith(prefix + "_")) continue;

    const isMalus = prefix.startsWith("malus") || prefix.endsWith("malus");
    const rest = norm.slice(prefix.length + 1);
    const sep = norm[prefix.length];
    let skillKey = "all";
    let value = 0;

    if (sep === ":") {
      const parts = rest.split(":").filter(Boolean);
      if (parts.length === 1) value = Number(parts[0]) || 0;
      else {
        skillKey = parts.slice(0, -1).join(":");
        value = Number(parts.at(-1)) || 0;
      }
    } else {
      const m = rest.match(/^(.*)_(-?\d+)$/);
      if (!m) continue;
      skillKey = m[1] || "all";
      value = Number(m[2]) || 0;
    }

    if (isMalus) value = -Math.abs(value);
    return { key: add2eNormalizeThiefSkillKey(skillKey), value };
  }

  return null;
}

function add2eGetActiveTagThiefBonuses(actor, key) {
  const out = [];
  const wanted = add2eNormalizeThiefSkillKey(key);
  let tags = [];

  try {
    if (typeof Add2eEffectsEngine !== "undefined" && Add2eEffectsEngine?.getActiveTags) {
      tags = Add2eEffectsEngine.getActiveTags(actor) ?? [];
    }
  } catch (err) {
    console.warn("[ADD2E][VOLEUR][BONUS TAGS] Impossible de lire les tags actifs.", err);
  }

  for (const raw of tags) {
    const parsed = add2eParseThiefBonusTag(raw);
    if (!parsed) continue;
    if (![wanted, "all", "toutes", "global", "*"].includes(parsed.key)) continue;
    if (parsed.value !== 0) out.push({ label: "Effets actifs", value: parsed.value });
  }

  return out;
}

function add2eGetThiefSkillBonuses(actor, key) {
  const out = [];
  const details = add2eGetThiefClassSystem(actor);
  const race = add2eGetActorRaceSystem(actor);

  for (const map of [
    actor?.system?.thiefSkillAdjustments,
    actor?.system?.thiefSkillBonuses,
    actor?.system?.voleurSkillAdjustments,
    actor?.system?.voleurSkillBonuses,
    actor?.system?.bonus_competences_voleur,
    actor?.system?.bonusCompetencesVoleur
  ]) add2ePushThiefBonus(out, "Acteur", map, key);

  for (const map of [
    details.thiefSkillAdjustments,
    details.thiefSkillBonuses,
    details.thief_adjustments,
    details.thief_bonuses,
    details.voleurSkillAdjustments,
    details.voleurSkillBonuses,
    details.bonus_competences_voleur,
    details.bonus_competence_voleur,
    details.bonus_voleur,
    details.malus_competences_voleur,
    details.skillBonuses?.voleur,
    details.skillAdjustments?.voleur
  ]) add2ePushThiefBonus(out, "Classe", map, key);

  for (const map of [
    race.thief_adjustments,
    race.thief_bonuses,
    race.thiefSkillAdjustments,
    race.thiefSkillBonuses,
    race.voleurSkillAdjustments,
    race.voleurSkillBonuses,
    race.bonus_competences_voleur,
    race.bonus_competence_voleur,
    race.bonus_voleur,
    race.malus_competences_voleur,
    race.skillBonuses?.voleur,
    race.skillAdjustments?.voleur
  ]) add2ePushThiefBonus(out, "Race", map, key);

  const dexBonus = add2eGetThiefDexBonus(actor, key);
  if (dexBonus.value !== 0) out.push(dexBonus);

  for (const src of add2eGetEquippedThiefBonusMaps(actor)) {
    add2ePushThiefBonus(out, src.label, src.map, key);
  }

  out.push(...add2eGetActiveTagThiefBonuses(actor, key));

  return out.filter(b => Number(b.value || 0) !== 0);
}

function add2eFormatSigned(value) {
  const n = Number(value) || 0;
  return `${n >= 0 ? "+" : ""}${n}`;
}

function add2eBuildThiefSkillRow({ keyRaw, labelRaw, valueRaw, actor, type = "percent", canRoll = true }) {
  const key = add2eNormalizeThiefSkillKey(keyRaw || labelRaw);
  if (!key) return null;

  const base = Number(valueRaw ?? 0);
  if (!Number.isFinite(base)) return null;

  const isBackstab = key.includes("frappe") || key.includes("dos") || key.includes("backstab");
  const finalType = isBackstab ? "multiplier" : type;
  const bonuses = finalType === "multiplier" ? [] : add2eGetThiefSkillBonuses(actor, key);
  const bonusTotal = bonuses.reduce((sum, b) => sum + (Number(b.value) || 0), 0);
  const finalValue = finalType === "multiplier" ? base : Math.max(0, base + bonusTotal);
  const bonusDisplay = bonusTotal === 0 ? "" : add2eFormatSigned(bonusTotal);
  const detailParts = [
    `Base ${finalType === "multiplier" ? `×${base}` : `${base}%`}`,
    ...bonuses.map(b => `${b.label} ${add2eFormatSigned(b.value)}%`)
  ];

  return {
    key,
    label: String(labelRaw || keyRaw || key).trim(),
    shortLabel: String(labelRaw || keyRaw || key).trim()
      .replace(/^Détection\/désamorçage des pièges$/i, "Pièges")
      .replace(/^Détection de pièges$/i, "Pièges")
      .replace(/^Crochetage de serrures$/i, "Crochetage")
      .replace(/^Ouverture de serrures$/i, "Serrures")
      .replace(/^Déplacement silencieux$/i, "Silence")
      .replace(/^Dissimulation dans l’ombre$/i, "Dissimulation")
      .replace(/^Lecture des langues$/i, "Langues"),
    base,
    value: finalValue,
    finalValue,
    bonusTotal,
    bonusDisplay,
    bonuses,
    display: finalType === "multiplier" ? `×${finalValue}` : `${finalValue}%`,
    baseDisplay: finalType === "multiplier" ? `×${base}` : `${base}%`,
    type: finalType,
    canRoll: finalType !== "multiplier" && canRoll === true,
    note: finalType === "multiplier" ? "Multiplicateur d'attaque dans le dos" : "Jet de pourcentage : réussite si d100 ≤ score",
    breakdownTitle: detailParts.join(" | ")
  };
}

function add2eGetActorThiefSkills(actor, progressionRow = null) {
  const details = add2eGetThiefClassSystem(actor);
  const level = Math.max(1, Number(actor?.system?.niveau ?? 1) || 1);
  const progression = Array.isArray(details.progression) ? details.progression : [];
  const row = progressionRow || progression.find((r, idx) => Number(r?.niveau ?? r?.level ?? idx + 1) === level) || null;
  if (!row) return [];

  const labelsObj = details.thiefSkillLabels && typeof details.thiefSkillLabels === "object"
    ? details.thiefSkillLabels
    : null;
  const order = Array.isArray(details.thiefSkillOrder) && details.thiefSkillOrder.length
    ? details.thiefSkillOrder.map(add2eNormalizeThiefSkillKey)
    : labelsObj
      ? Object.keys(labelsObj).map(add2eNormalizeThiefSkillKey)
      : [];

  const legacyLabels = Array.isArray(details.skillLabels) ? details.skillLabels : [];
  const legacyValues = Array.isArray(row.skills) ? row.skills : [];
  const structured = row.thiefSkills && typeof row.thiefSkills === "object" ? row.thiefSkills : {};

  const rows = [];
  const pushed = new Set();

  const pushSkill = (keyRaw, labelRaw, valueRaw, opts = {}) => {
    const skill = add2eBuildThiefSkillRow({ keyRaw, labelRaw, valueRaw, actor, ...opts });
    if (!skill || pushed.has(skill.key)) return;
    pushed.add(skill.key);
    rows.push(skill);
  };

  if (order.length) {
    for (let idx = 0; idx < order.length; idx++) {
      const key = order[idx];
      const label = labelsObj?.[key] ?? legacyLabels[idx] ?? key;
      const value = structured[key] ?? legacyValues[idx];
      pushSkill(key, label, value);
    }
  }

  // Compatibilité pure avec l'ancien couple skillLabels/progression.skills.
  if (!rows.length && legacyLabels.length && legacyValues.length) {
    legacyLabels.forEach((label, idx) => pushSkill(label, label, legacyValues[idx]));
  }

  const readLanguages = Number(row.readLanguages ?? row.read_languages ?? row.lectureLangues ?? structured.read_languages ?? structured.lecture_langues ?? 0) || 0;
  if (readLanguages > 0 && !pushed.has("lecture_langues")) {
    pushSkill("lecture_langues", "Lecture des langues", readLanguages);
  }

  return rows;
}

async function add2ePromptThiefSkillModifiers(actor, skill) {
  return new Promise(resolve => {
    const isPickpocket = skill.key === "pickpocket";
    const content = `
      <form class="add2e-thief-roll-dialog">
        <div style="margin-bottom:0.6em;">
          <b>${skill.label}</b><br>
          <span>Score actuel : ${skill.display}</span>
        </div>
        <div style="margin-bottom:0.6em;">
          <label>Modificateur situationnel</label>
          <input type="number" name="mod" value="0" step="1" style="width:5em;">
        </div>
        ${isPickpocket ? `
          <div style="margin-bottom:0.6em;">
            <label>Niveau de la cible</label>
            <input type="number" name="targetLevel" value="" min="0" step="1" style="width:5em;">
            <p style="margin:0.3em 0 0;color:#666;font-size:0.9em;">Pickpocket : –5 % par niveau de la cible au-dessus du niveau 3.</p>
          </div>
        ` : ""}
      </form>
    `;

    new Dialog({
      title: `Jet de ${skill.label}`,
      content,
      buttons: {
        roll: {
          label: "Lancer",
          callback: html => {
            const form = html[0]?.querySelector?.("form") ?? html.find?.("form")?.[0];
            const mod = Number(form?.querySelector?.('[name="mod"]')?.value ?? 0) || 0;
            const targetLevel = Number(form?.querySelector?.('[name="targetLevel"]')?.value ?? 0) || 0;
            resolve({ mod, targetLevel });
          }
        },
        cancel: { label: "Annuler", callback: () => resolve(null) }
      },
      default: "roll",
      close: () => resolve(null)
    }).render(true);
  });
}

async function add2eRollThiefSkill(actor, key) {
  if (!actor) return ui.notifications.warn("Acteur introuvable.");

  const details = add2eGetThiefClassSystem(actor);
  const level = Math.max(1, Number(actor.system?.niveau ?? 1) || 1);
  const progression = Array.isArray(details.progression) ? details.progression : [];
  const row = progression.find((r, idx) => Number(r?.niveau ?? r?.level ?? idx + 1) === level) || null;
  const skills = add2eGetActorThiefSkills(actor, row);
  const wanted = add2eNormalizeThiefSkillKey(key);
  const skill = skills.find(s => s.key === wanted);

  if (!skill) return ui.notifications.warn("Compétence de voleur introuvable pour ce niveau.");
  if (!skill.canRoll) return ui.notifications.info(`${skill.label} : ${skill.display}. Aucun jet automatique requis.`);

  const options = await add2ePromptThiefSkillModifiers(actor, skill);
  if (!options) return;

  const isAssassination = skill.key === "assassinat";
  const situational = Number(options.mod || 0) || 0;
  const targetLevel = Number(options.targetLevel || 0) || 0;
  const targetPenalty = skill.key === "pickpocket" && targetLevel > 3 ? -5 * (targetLevel - 3) : 0;
  const finalValue = Math.max(0, Number(skill.value || 0) + situational + targetPenalty);

  const roll = await new Roll("1d100").evaluate({ async: true });
  if (game.dice3d) await game.dice3d.showForRoll(roll);

  const success = roll.total <= finalValue;
  const noticed = skill.key === "pickpocket" && roll.total >= finalValue + 21;
  const color = success ? "#1f8f4d" : "#b3261e";
  const allDetails = [
    { label: "Base", value: skill.base },
    ...skill.bonuses,
    ...(situational !== 0 ? [{ label: "Situation", value: situational }] : []),
    ...(targetPenalty !== 0 ? [{ label: `Cible niveau ${targetLevel}`, value: targetPenalty }] : [])
  ];

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
      <div class="add2e-card-test" style="border-radius:12px;border:1px solid ${color};background:#fffdf6;padding:0.75em 1em;font-family:var(--font-primary);">
        <div style="display:flex;align-items:center;gap:0.6em;margin-bottom:0.4em;">
          <i class="fas fa-mask" style="color:${color};font-size:1.5em;"></i>
          <b style="color:${color};font-size:1.12em;">${skill.label}</b>
          <span style="margin-left:auto;color:#666;">${isAssassination ? "Compétence d’assassin" : "Compétence de voleur"}</span>
        </div>
        <div>Score final : <b>${finalValue}%</b> — Jet : <b>${roll.total}</b></div>
        <div style="font-size:0.9em;color:#555;margin-top:0.35em;">
          ${allDetails.map(d => `${d.label} ${add2eFormatSigned(d.value)}%`).join(" ; ")}
        </div>
        <div style="margin-top:0.35em;font-weight:800;color:${color};">${success ? "Réussite" : "Échec"}</div>
        ${isAssassination && success ? `<div style="margin-top:0.25em;color:#1f8f4d;font-weight:700;">Assassinat réussi : effet létal à appliquer selon les conditions de scène et l’arbitrage du MJ.</div>` : ""}
        ${isAssassination && !success ? `<div style="margin-top:0.25em;color:#b3261e;font-weight:700;">Assassinat manqué.</div>` : ""}
        ${noticed ? `<div style="margin-top:0.25em;color:#b3261e;font-weight:700;">La victime remarque la tentative de pickpocket.</div>` : ""}
      </div>
    `
  });
}

globalThis.add2eGetActorThiefSkills = add2eGetActorThiefSkills;
globalThis.add2eRollThiefSkill = add2eRollThiefSkill;
globalThis.add2eParseThiefBonusTag = add2eParseThiefBonusTag;

async function handleItemAction({ actor, action, itemId, itemType, sheet }) {
  if (!actor || !action || !itemId) return;

  const item = actor.items.get(itemId);
  if (!item) return;

  const effectiveType = (() => {
    const t = (itemType || item.type || "").toLowerCase();
    if (t === "weapon") return "arme";
    if (t === "armor") return "armure";
    return t;
  })();

  // EDIT
  if (action === "edit") {
    return item.sheet?.render(true);
  }

  // DELETE
  if (action === "delete") {
    await actor.deleteEmbeddedDocuments("Item", [item.id]);
    sheet?._add2eRememberActiveTab?.();
    sheet?.render(false);
    return;
  }

  // EQUIP
  if (action === "equip") {

    // =======================
    // ----- OBJETS (Divers) -
    // =======================
    if (effectiveType === "objet") {
      await item.update({ "system.equipee": !item.system.equipee });
      sheet?._add2eRememberActiveTab?.();
      sheet?.render(false);
      return;
    }

    // =======================
    // ----- ARMES -----------
    // =======================
    if (effectiveType === "arme") {
      const check = add2eCheckEquipmentAllowedForClass(actor, item, "arme");

      console.log("[ADD2E][EQUIPEMENT][ARME][CHECK]", {
        actor: actor.name,
        classe: check.classeLabel,
        classItem: check.classe?.__classItemName ?? null,
        item: item.name,
        mode: check.mode,
        reason: check.reason,
        ok: check.ok,
        matchedAllowed: check.matchedAllowed ?? null,
        matchedForbidden: check.matchedForbidden ?? null,
        itemTags: check.itemTags ?? add2eGetItemEquipTags(item),
        allowedTags: check.allowedTags ?? null,
        forbiddenTags: check.forbiddenTags ?? null
      });

      if (!check.ok) {
        const reason = check.reason === "forbidden"
          ? `tag interdit : ${check.matchedForbidden}`
          : "arme non autorisée par les restrictions de classe";

        ui.notifications.error(
          `⚠️ Cette arme (« ${item.name} ») est interdite pour votre classe (${check.classeLabel}) — ${reason}.`
        );
        return;
      }

      const dejaEquipee = item.system.equipee === true;
      const estDeuxMains = !!item.system.deuxMains || add2eGetItemEquipTags(item).includes("usage:deux_mains");

      const isJet = !!item.system.arme_de_jet ||
        !!item.system.portee_courte ||
        !!item.system.portee_moyenne ||
        !!item.system.portee_longue ||
        add2eGetItemEquipTags(item).includes("usage:distance") ||
        add2eGetItemEquipTags(item).includes("usage:lancer");

      const isContact = !isJet;

      if (dejaEquipee) {
        await item.update({ "system.equipee": false });
        sheet?._add2eRememberActiveTab?.();
        sheet?.render(false);
        return;
      }

      if (estDeuxMains) {
        const bouclierEquipe = actor.items.find(i => {
          const t = (i.type || "").toLowerCase();
          return (t === "armure" || t === "armor") && i.system.equipee && add2eIsShield(i);
        });

        if (bouclierEquipe) {
          ui.notifications.error(
            `⚠️ Impossible d'équiper une arme à deux mains si un bouclier est équipé (${bouclierEquipe.name}).`
          );
          return;
        }
      }

      for (const a of actor.items.filter(i => {
        const t = (i.type || "").toLowerCase();
        return (t === "arme" || t === "weapon") && i.id !== item.id;
      })) {
        const aTags = add2eGetItemEquipTags(a);
        const aIsJet = !!a.system.arme_de_jet ||
          !!a.system.portee_courte ||
          !!a.system.portee_moyenne ||
          !!a.system.portee_longue ||
          aTags.includes("usage:distance") ||
          aTags.includes("usage:lancer");

        const aIsContact = !aIsJet;

        if ((isJet && aIsJet) || (isContact && aIsContact)) {
          await a.update({ "system.equipee": false });
        }
      }

      await item.update({ "system.equipee": true });
      sheet?._add2eRememberActiveTab?.();
      sheet?.render(false);
      return;
    }

    // =======================
    // --- ARMURE / BOUCLIER / HEAUME ---
    // =======================
    if (effectiveType === "armure") {
      const estDejaEquipee = item.system.equipee === true;

      const estBouclier = add2eIsShield(item);
      const estHeaume = add2eIsHelmet(item);
      const estArmure = !estBouclier && !estHeaume;

      const check = add2eCheckEquipmentAllowedForClass(actor, item, "armure");

      console.log("[ADD2E][EQUIPEMENT][ARMURE][CHECK]", {
        actor: actor.name,
        classe: check.classeLabel,
        classItem: check.classe?.__classItemName ?? null,
        item: item.name,
        mode: check.mode,
        reason: check.reason,
        ok: check.ok,
        matchedAllowed: check.matchedAllowed ?? null,
        matchedForbidden: check.matchedForbidden ?? null,
        itemTags: check.itemTags ?? add2eGetItemEquipTags(item),
        allowedTags: check.allowedTags ?? null,
        forbiddenTags: check.forbiddenTags ?? null
      });

      const isMonk = ((check.classe?.label || check.classe?.nom || check.classe?.name || check.classeLabel || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f’']/g, "")
        .includes("moine"));

      const armorsAllowed = add2eToEquipArray(check.classe?.armorAllowed ?? check.classe?.armures_autorisees ?? [])
        .map(add2eNormalizeEquipTag);

      if (!add2eHasTagRestriction(check.classe?.armorRestriction) && isMonk && armorsAllowed.includes("aucune")) {
        ui.notifications.error(`⚠️ Les Moines ne peuvent jamais porter d’armure !`);
        return;
      }

      if (estBouclier) {
        const armeDeuxMains = actor.items.find(i => {
          const t = (i.type || "").toLowerCase();
          const tags = add2eGetItemEquipTags(i);
          return (t === "arme" || t === "weapon") && i.system.equipee && (!!i.system.deuxMains || tags.includes("usage:deux_mains"));
        });

        if (armeDeuxMains) {
          ui.notifications.error(
            `⚠️ Impossible d'équiper un bouclier avec une arme à deux mains (${armeDeuxMains.name}) déjà équipée.`
          );
          return;
        }
      }

      // Si déjà équipé → déséquipe sans contrôle de restriction.
      if (estDejaEquipee) {
        await item.update({ "system.equipee": false });
      } else {
        if (!check.ok) {
          const reason = check.reason === "forbidden"
            ? `tag interdit : ${check.matchedForbidden}`
            : "protection non autorisée par les restrictions de classe";

          const typeLabel = estBouclier ? "Ce bouclier" : estHeaume ? "Ce heaume" : "Cette armure";
          ui.notifications.error(
            `⚠️ ${typeLabel} (« ${item.name} ») est interdit pour votre classe (${check.classeLabel}) — ${reason}.`
          );
          return;
        }

        for (const i of actor.items) {
          const t = (i.type || "").toLowerCase();
          if ((t === "armure" || t === "armor") && i.id !== item.id) {
            if (
              (estArmure && !add2eIsShield(i) && !add2eIsHelmet(i)) ||
              (estBouclier && add2eIsShield(i)) ||
              (estHeaume && add2eIsHelmet(i))
            ) {
              await i.update({ "system.equipee": false });
            }
          }
        }

        if (estBouclier) {
          for (const arme of actor.items.filter(a => {
            const t = (a.type || "").toLowerCase();
            const tags = add2eGetItemEquipTags(a);
            return (t === "arme" || t === "weapon") && a.system.equipee && (!!a.system.deuxMains || tags.includes("usage:deux_mains"));
          })) {
            await arme.update({ "system.equipee": false });
            ui.notifications.warn(`Arme à deux mains déséquipée car un bouclier est équipé.`);
          }
        }

        await item.update({ "system.equipee": true });
      }

      const itemsEquipes = actor.items.filter(i => {
        const t = (i.type || "").toLowerCase();
        return (t === "armure" || t === "armor") && i.system.equipee;
      });

      const armure = itemsEquipes.find(i => !add2eIsShield(i) && !add2eIsHelmet(i));
      const bouclier = itemsEquipes.find(i => add2eIsShield(i));
      const heaume = itemsEquipes.find(i => add2eIsHelmet(i));

      let ca_total = actor.system.ca_naturel || 10;

      if (armure) ca_total = Number(armure.system.ac);
      if (bouclier) ca_total -= Number(bouclier.system.ac);
      if (heaume) ca_total -= Number(heaume.system.ac);

      ca_total += actor.system.dex_def || 0;

      await actor.update({ "system.ca_total": ca_total });

      sheet?._add2eRememberActiveTab?.();
      sheet?.render(false);
      return;
    }
  }
}


function showAdd2eDiceRollerDialog() {
  let html = `
    <form class="flexcol" style="gap:0.7em">
      <div style="display:flex;align-items:center;gap:1em;justify-content:center;">
        <label for="add2e-nb-dice" style="min-width:5.5em;">Nombre :</label>
        <input id="add2e-nb-dice" type="number" min="1" max="100" value="1" style="width:3.5em;">
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:0.4em;justify-content:center;margin-top:0.5em;">
        ${[4,6,8,10,12,20,100].map(f => 
          `<button type="button" class="dice-btn" data-faces="${f}" style="padding:0.45em 1em;font-size:1.13em;font-weight:600;background:#efe9f6;border-radius:7px;border:1.5px solid #9d8bd2;color:#674197;box-shadow:0 2px 5px #0001;">
            d${f}
          </button>`
        ).join('')}
      </div>
    </form>
  `;
  new Dialog({
    title: "Lancer de dés (AD&D2e)",
    content: html,
    render: dlgHtml => {
      dlgHtml.find('.dice-btn').on('click', async function(ev) {
        ev.preventDefault();
        const faces = Number($(this).data('faces'));
        const nb = Math.max(1, parseInt(dlgHtml.find('#add2e-nb-dice').val()) || 1);
        const formula = `${nb}d${faces}`;
        const roll = new Roll(formula);
        await roll.evaluate();
        roll.toMessage({
          flavor: `<b>Lancer de ${nb}d${faces}</b> (par le lanceur de dés AD&D2e)`
        });
        dlgHtml.closest('.window-app').remove();
      });
    },
    buttons: { cancel: { label: "Annuler" } },
    default: "cancel"
  }, { width: 340 }).render(true);
}
function add2e_updateFinalCaracs(actor) {
  const CARACS = ["force", "dexterite", "constitution", "intelligence", "sagesse", "charisme"];
  const updates = {};

  for (let c of CARACS) {
    const base = getProperty(actor.system, `${c}_base`) ?? 10;
    const bonusRace = getProperty(actor.system.bonus_caracteristiques, c) ?? 0;
    const bonusDivers = getProperty(actor.system.bonus_divers_caracteristiques, c) ?? 0;

    updates[`system.${c}`] = base + bonusRace + bonusDivers;
  }

  return actor.update(updates);
}

function formatSortChamp(val) {
  if (!val) return "-";
  if (typeof val === "object") {
    // Gère { valeur: ..., unite: ... }
    const v = val.valeur !== undefined ? val.valeur : "";
    const u = val.unite ? (" " + val.unite) : "";
    return `${v}${u}`.trim() || "-";
  }
  return val;
}
globalThis.formatSortChamp = formatSortChamp;


// ============================================================
// ADD2E — Spellcasting générique par lignes de sorts
// Supporte les classes simples (Clerc, Druide, Magicien, Paladin)
// et les classes mixtes comme le Ranger : Druidique + Magicien.
// ============================================================
globalThis.ADD2E_SPELL_PREPARATION_VERSION = "2026-05-04-consolidated-v20-level-cap";

function add2eRerenderActorSheet(actor, force = true) {
  if (!actor) return false;

  try {
    if (actor.sheet?.render) {
      actor.sheet.render(force);
      return true;
    }
  } catch (err) {
    console.warn("[ADD2E][SHEET][RERENDER] actor.sheet.render impossible", err);
  }

  try {
    for (const app of Object.values(ui.windows ?? {})) {
      const appActor = app?.actor ?? app?.document;
      if (appActor?.id === actor.id && app?.render) {
        app.render(force);
        return true;
      }
    }
  } catch (err) {
    console.warn("[ADD2E][SHEET][RERENDER] ui.windows impossible", err);
  }

  return false;
}
globalThis.add2eRerenderActorSheet = add2eRerenderActorSheet;

function add2eNormalizeSpellKey(value) {
  const v = String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[\s_-]+/g, "_");

  const aliases = {
    cleric: "clerc",
    clerc: "clerc",
    priest: "clerc",
    pretre: "clerc",
    prêtre: "clerc",

    druid: "druide",
    druide: "druide",
    druidique: "druide",

    wizard: "magicien",
    mage: "magicien",
    magic_user: "magicien",
    magicien: "magicien",
    magician: "magicien",

    illusionist: "illusionniste",
    illusionniste: "illusionniste"
  };

  return aliases[v] || v;
}

function add2eSpellLabel(value) {
  const key = add2eNormalizeSpellKey(value);
  const labels = {
    clerc: "Clerc",
    druide: "Druidique",
    magicien: "Magicien",
    illusionniste: "Illusionniste"
  };
  return labels[key] || String(value ?? key ?? "—");
}

function add2eToArray(value) {
  if (Array.isArray(value)) return value.filter(v => v !== undefined && v !== null && String(v).trim() !== "");
  if (typeof value === "string") return value.split(/[,;|]/).map(s => s.trim()).filter(Boolean);
  return [];
}

function add2eGetActorClassItemForSpellcasting(actor) {
  return actor?.items?.find?.(i => String(i.type || "").toLowerCase() === "classe") || null;
}

function add2eGetProgressionRowForActor(actor) {
  const level = Math.max(1, Number(actor?.system?.niveau) || 1);
  const classItem = add2eGetActorClassItemForSpellcasting(actor);
  const details = classItem?.system || actor?.system?.details_classe || {};
  const progression = Array.isArray(details.progression) ? details.progression : [];
  return progression[level - 1] || {};
}

function add2eReadSpellcastingSource(actor) {
  const classItem = add2eGetActorClassItemForSpellcasting(actor);
  const classSpellcasting = classItem?.system?.spellcasting;
  const actorSpellcasting = actor?.system?.spellcasting;

  // Priorité à la classe embarquée, car c'est la source de règles.
  if (classSpellcasting && typeof classSpellcasting === "object") return classSpellcasting;
  if (actorSpellcasting && typeof actorSpellcasting === "object") return actorSpellcasting;
  return {};
}

function add2eGetSpellcastingEntries(actor) {
  const casting = add2eReadSpellcastingSource(actor);
  const rawEntries = Array.isArray(casting.entries) ? casting.entries
    : Array.isArray(casting.pools) ? casting.pools
    : null;

  let entries = [];

  if (rawEntries) {
    entries = rawEntries.map((e, idx) => {
      const rawKey = e.key ?? e.list ?? e.liste ?? e.name ?? e.label ?? e.type;
      const key = add2eNormalizeSpellKey(rawKey);
      return {
        index: idx,
        key,
        label: e.label || add2eSpellLabel(key),
        startsAt: Number(e.startsAt ?? e.startLevel ?? e.niveauDepart ?? casting.startsAt ?? 1) || 1,
        maxSpellLevel: Number(e.maxSpellLevel ?? e.maxLevel ?? e.maxNiveauSort ?? casting.maxSpellLevel ?? 0) || 0,
        slotsField: e.slotsField || e.slotField || e.progressionField || null,
        notes: e.notes || ""
      };
    }).filter(e => e.key);
  } else {
    const lists = add2eToArray(casting.lists).map(add2eNormalizeSpellKey).filter(Boolean);
    entries = [...new Set(lists)].map((key, idx) => ({
      index: idx,
      key,
      label: add2eSpellLabel(key),
      startsAt: Number(casting.startsAt ?? 1) || 1,
      maxSpellLevel: Number(casting.maxSpellLevel ?? 0) || 0,
      slotsField: null,
      notes: casting.notes || ""
    }));
  }

  return entries;
}

function add2eGetSpellListsFromItem(sort) {
  const sys = sort?.system ?? {};
  const fromLists = add2eToArray(sys.spellLists).map(add2eNormalizeSpellKey).filter(Boolean);
  if (fromLists.length) return [...new Set(fromLists)];

  // Fallback legacy.
  const legacy = sys.classe || sys.class || sys.liste;
  const key = add2eNormalizeSpellKey(legacy);
  return key ? [key] : [];
}

function add2eGetSlotsForEntryLevel(actor, entry, spellLevel) {
  const row = add2eGetProgressionRowForActor(actor);
  const key = add2eNormalizeSpellKey(entry?.key);
  const label = entry?.label || add2eSpellLabel(key);
  const idx = Math.max(0, Number(spellLevel) - 1);

  const tryArray = (raw) => add2eSpellSyncReadSlotValue(raw, idx + 1, key);

  // Nouveau modèle conseillé : progression[].spellSlotsByList.{Druide/Magicien/Clerc}
  // Lecture robuste : les clés sont comparées après normalisation.
  // Ainsi Druide, druide, Druidique, Magicien ou wizard pointent vers la même ligne interne.
  for (const containerName of ["spellSlotsByList", "spellsByList", "spellsPerLevelByList", "sortsParListe"]) {
    const c = row?.[containerName];
    if (!c || typeof c !== "object") continue;

    for (const [rawContainerKey, value] of Object.entries(c)) {
      if (add2eNormalizeSpellKey(rawContainerKey) !== key) continue;
      const v = tryArray(value);
      if (v !== null) return v;
    }
  }

  // Champs directs pratiques.
  const directFields = [
    entry?.slotsField,
    `spellsPerLevel_${key}`,
    `spellsPerLevel${label}`,
    `spellsPerLevel${label.replace(/\s+/g, "")}`,
    key === "druide" ? "spellsPerLevelDruide" : null,
    key === "magicien" ? "spellsPerLevelMagicien" : null,
    key === "clerc" ? "spellsPerLevelClerc" : null,
    key === "illusionniste" ? "spellsPerLevelIllusionniste" : null
  ].filter(Boolean);

  for (const field of directFields) {
    const v = tryArray(row?.[field]);
    if (v !== null) return v;
  }

  // Legacy : une seule ligne de sorts.
  const entries = add2eGetSpellcastingEntries(actor);
  if (entries.length <= 1) {
    const v = tryArray(row?.spellsPerLevel) ?? tryArray(row?.sortsParNiveau);
    return v ?? 0;
  }

  return 0;
}

function add2eGetSpellSlotPoolsByLevel(actor) {
  const entries = add2eGetSpellcastingEntries(actor);
  const pools = {};
  const actorLevel = Math.max(1, Number(actor?.system?.niveau) || 1);

  for (const entry of entries) {
    const slotsByLevel = {};
    const maxSpellLevel = Number(entry.maxSpellLevel) || 9;
    for (let lvl = 1; lvl <= maxSpellLevel; lvl++) {
      slotsByLevel[lvl] = actorLevel >= Number(entry.startsAt || 1)
        ? add2eGetSlotsForEntryLevel(actor, entry, lvl)
        : 0;
    }
    pools[entry.key] = { ...entry, slotsByLevel };
  }

  return pools;
}

function add2eGetSpellEntryForSpell(actor, sort) {
  const actorLevel = Math.max(1, Number(actor?.system?.niveau) || 1);
  const spellLevel = Number(sort?.system?.niveau ?? sort?.system?.level ?? 0) || 0;
  const sortLists = add2eGetSpellListsFromItem(sort);
  const entries = add2eGetSpellcastingEntries(actor);

  const matches = entries.filter(e => sortLists.includes(e.key));
  if (!matches.length) return null;

  // On renvoie d'abord une entrée réellement disponible au niveau courant.
  const available = matches.find(e => {
    const startsAt = Number(e.startsAt || 1);
    const max = Number(e.maxSpellLevel || 0);
    return actorLevel >= startsAt && (!max || spellLevel <= max);
  });

  return available || matches[0] || null;
}

function add2eCanActorUseSpell(actor, sort) {
  const actorLevel = Math.max(1, Number(actor?.system?.niveau) || 1);
  const spellLevel = Number(sort?.system?.niveau ?? sort?.system?.level ?? 0) || 0;
  const sortLists = add2eGetSpellListsFromItem(sort);
  const entries = add2eGetSpellcastingEntries(actor);
  const matching = entries.filter(e => sortLists.includes(e.key));

  if (!matching.length) {
    return { ok: false, reason: "list", sortLists, entries, entry: null };
  }

  for (const entry of matching) {
    const startsAt = Number(entry.startsAt || 1);
    const max = Number(entry.maxSpellLevel || 0);
    if (actorLevel < startsAt) return { ok: false, reason: "start", sortLists, entries, entry, actorLevel, spellLevel };
    if (max && spellLevel > max) return { ok: false, reason: "max-level", sortLists, entries, entry, actorLevel, spellLevel };

    return { ok: true, reason: "ok", sortLists, entries, entry, actorLevel, spellLevel };
  }

  return { ok: false, reason: "unknown", sortLists, entries, entry: matching[0] ?? null, actorLevel, spellLevel };
}

function add2eGetMemorizedByList(sort) {
  const raw = sort?.getFlag?.("add2e", "memorizedByList") ?? sort?.flags?.add2e?.memorizedByList ?? {};
  return raw && typeof raw === "object" && !Array.isArray(raw) ? foundry.utils.deepClone(raw) : {};
}

function add2eGetMemorizedCountForEntry(sort, entry) {
  const key = add2eNormalizeSpellKey(entry?.key);
  if (!sort || !key) return 0;

  const byList = add2eGetMemorizedByList(sort);
  if (Object.prototype.hasOwnProperty.call(byList, key)) {
    return Number(byList[key] ?? 0) || 0;
  }

  // Compatibilité anciens sorts : si le sort ne correspond qu'à une seule liste,
  // son ancien memorizedCount est considéré comme le compteur de cette liste.
  const lists = add2eGetSpellListsFromItem(sort);
  if (lists.length <= 1 && lists.includes(key)) {
    return Number(sort.getFlag?.("add2e", "memorizedCount") ?? sort.flags?.add2e?.memorizedCount ?? 0) || 0;
  }

  return 0;
}

async function add2eSetMemorizedCountForEntry(sort, entry, value) {
  const key = add2eNormalizeSpellKey(entry?.key);
  if (!sort || !key) return;

  const byList = add2eGetMemorizedByList(sort);
  byList[key] = Math.max(0, Number(value) || 0);

  // Nettoyage des zéros pour garder les flags lisibles.
  for (const k of Object.keys(byList)) {
    if ((Number(byList[k]) || 0) <= 0) delete byList[k];
  }

  const total = Object.values(byList).reduce((sum, v) => sum + (Number(v) || 0), 0);

  await sort.setFlag("add2e", "memorizedByList", byList);
  await sort.setFlag("add2e", "memorizedCount", total);
}

function add2eGetTotalMemorizedCount(sort) {
  const byList = add2eGetMemorizedByList(sort);
  const totalByList = Object.values(byList).reduce((sum, v) => sum + (Number(v) || 0), 0);
  if (totalByList > 0) return totalByList;
  return Number(sort?.getFlag?.("add2e", "memorizedCount") ?? sort?.flags?.add2e?.memorizedCount ?? 0) || 0;
}

function add2eCountPreparedForEntryLevel(actor, entry, spellLevel) {
  const key = add2eNormalizeSpellKey(entry?.key);
  const lvl = Number(spellLevel) || 1;
  let total = 0;

  for (const s of actor?.items?.filter?.(i => String(i.type || "").toLowerCase() === "sort") ?? []) {
    const sLvl = Number(s.system?.niveau ?? s.system?.level ?? 1) || 1;
    if (sLvl !== lvl) continue;
    const sEntry = add2eGetSpellEntryForSpell(actor, s);
    if (sEntry && add2eNormalizeSpellKey(sEntry.key) === key) {
      total += add2eGetMemorizedCountForEntry(s, entry);
    }
  }

  return total;
}

globalThis.add2eGetSpellcastingEntries = add2eGetSpellcastingEntries;
globalThis.add2eGetSpellSlotPoolsByLevel = add2eGetSpellSlotPoolsByLevel;
globalThis.add2eCanActorUseSpell = add2eCanActorUseSpell;
globalThis.add2eGetMemorizedCountForEntry = add2eGetMemorizedCountForEntry;
globalThis.add2eSetMemorizedCountForEntry = add2eSetMemorizedCountForEntry;
globalThis.add2eGetTotalMemorizedCount = add2eGetTotalMemorizedCount;

function evalFormuleValeur(valeur, niveau) {
  if (typeof valeur === "object" && typeof valeur.valeur !== "undefined") valeur = valeur.valeur;
  if (typeof valeur !== "string") return valeur;
  // Remplace "@niv" par le niveau réel (supporte aussi "@niveau")
  let expr = valeur.replace(/@niv(?![a-z])/gi, niveau).replace(/@niveau/gi, niveau);
  try {
    // Évite les expressions trop complexes, mais "safe" pour additions/mult
    // eslint-disable-next-line no-new-func
    return Function(`return (${expr});`)();
  } catch {
    return valeur;
  }
}

// ============================================================
// ADD2E — Améliorations UI feuille personnage
// - Onglet Effets injecté automatiquement
// - Onglet Sorts : préparation déplacée au début de ligne
// - Onglet Sorts : nombre mémorisé / maximum affiché à côté de "Sort"
// - Onglet Sorts : nom du sort cliquable au lieu du petit livre
// - Onglet Sorts : suppression de l'action "lancer" dans la colonne Actions
// ============================================================
function add2eUiEscapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function add2eUiNormalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function add2eUiGetSpellSlotsByLevel(actor) {
  const pools = add2eGetSpellSlotPoolsByLevel(actor);
  const totals = {};

  for (const pool of Object.values(pools)) {
    for (const [lvl, max] of Object.entries(pool.slotsByLevel || {})) {
      totals[lvl] = (Number(totals[lvl]) || 0) + (Number(max) || 0);
    }
  }

  return totals;
}

function add2eUiGetSpellPoolsByLevel(actor) {
  const pools = add2eGetSpellSlotPoolsByLevel(actor);
  const out = {};

  for (const [key, pool] of Object.entries(pools)) {
    for (const [lvl, max] of Object.entries(pool.slotsByLevel || {})) {
      const spellLevel = Number(lvl) || 1;
      if (!out[spellLevel]) out[spellLevel] = [];
      out[spellLevel].push({
        key,
        label: pool.label || add2eSpellLabel(key),
        startsAt: Number(pool.startsAt || 1),
        maxSpellLevel: Number(pool.maxSpellLevel || 0),
        max: Number(max) || 0,
        count: add2eCountPreparedForEntryLevel(actor, pool, spellLevel)
      });
    }
  }

  return out;
}

function add2eUiGetMemorizedSpellsByLevel(actor) {
  const countByLevel = {};
  for (const sort of actor?.items?.filter?.(i => String(i.type || "").toLowerCase() === "sort") ?? []) {
    const niv = Number(sort.system?.niveau || sort.system?.level || 1) || 1;
    const count = add2eGetTotalMemorizedCount(sort);
    countByLevel[niv] = (countByLevel[niv] || 0) + count;
  }
  return countByLevel;
}

function add2eUiFormatDuration(effect) {
  if (typeof effect?.duration?.remaining !== "undefined") return `${effect.duration.remaining} rounds`;
  if (typeof effect?.duration?.rounds !== "undefined") return `${effect.duration.rounds} rounds`;
  if (typeof effect?.duration?.seconds !== "undefined") return `${effect.duration.seconds} sec`;
  return "—";
}

function add2eUiBuildEffectsTab(sheet) {
  const actor = sheet?.actor;
  const effects = Array.from(actor?.effects ?? []);

  const rows = effects.length ? effects.map(eff => {
    const desc = eff.getFlag?.("core", "description")
      || eff.flags?.add2e?.desc
      || eff.description
      || (Array.isArray(eff.flags?.add2e?.tags) ? `<small>${add2eUiEscapeHtml(eff.flags.add2e.tags.join(", "))}</small>` : "");
    const sourceName = eff.parent?.name || eff.origin || "—";

    return `
      <tr>
        <td style="width:42px;text-align:center;">
          <img src="${add2eUiEscapeHtml(eff.img || "icons/svg/aura.svg")}" alt="" style="width:28px;height:28px;border:0;object-fit:cover;">
        </td>
        <td><strong>${add2eUiEscapeHtml(eff.name || eff.label || "Effet")}</strong></td>
        <td>${add2eUiEscapeHtml(sourceName)}</td>
        <td>${add2eUiEscapeHtml(add2eUiFormatDuration(eff))}</td>
        <td class="a2e-small">${desc}</td>
        <td style="white-space:nowrap;text-align:center;">
          <a class="effect-edit add2e-effect-edit a2e-action-icon a2e-action-edit" data-effect-id="${add2eUiEscapeHtml(eff.id)}" title="Éditer l’effet">
            <i class="fas fa-edit"></i>
          </a>
          <a class="effect-delete add2e-effect-delete a2e-action-icon a2e-action-delete" data-effect-id="${add2eUiEscapeHtml(eff.id)}" title="Supprimer l’effet">
            <i class="fas fa-trash"></i>
          </a>
        </td>
      </tr>`;
  }).join("") : `
      <tr>
        <td colspan="6" class="a2e-muted" style="text-align:center;padding:0.8em;">Aucun effet actif.</td>
      </tr>`;

  return `
    <section class="a2e-panel add2e-effects-panel">
      <h2><i class="fas fa-sparkles"></i> Effets actifs</h2>
      <div class="a2e-panel-body">
        <table class="a2e-table add2e-effects-table">
          <thead>
            <tr>
              <th></th>
              <th>Effet</th>
              <th>Source</th>
              <th>Durée</th>
              <th>Description</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>`;
}


function add2eMagicItemEquippedOrUsable(item) {
  // IMPORTANT : ce helper sert maintenant à l'AFFICHAGE des objets magiques possédés,
  // pas à l'exclusivité d'équipement. Un bâton magique peut être déséquipé automatiquement
  // quand une autre arme est équipée ; ses pouvoirs doivent quand même rester visibles
  // dans la section Objets magiques de la fiche.
  return !!item;
}

function add2eMagicObjectRawPowers(item) {
  const sys = item?.system ?? {};
  return sys.pouvoirs
    ?? sys.powers
    ?? sys.pouvoirsMagiques
    ?? sys.magicalPowers
    ?? sys.sorts
    ?? sys.spells
    ?? [];
}

function add2eMagicObjectPowerArray(item) {
  const raw = add2eMagicObjectRawPowers(item);
  if (Array.isArray(raw)) return raw.filter(p => p && typeof p === "object");
  if (raw && typeof raw === "object") return Object.values(raw).filter(p => p && typeof p === "object");
  return [];
}

function add2eMagicReadNumber(...values) {
  for (const value of values) {
    if (value === undefined || value === null || value === "") continue;
    if (typeof value === "object") {
      const nested = add2eMagicReadNumber(value.value, value.current, value.actuel, value.max);
      if (Number.isFinite(nested)) return nested;
      continue;
    }
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return NaN;
}

function add2eMagicObjectChargeInfo(item, powers = null) {
  const sys = item?.system ?? {};
  const list = powers ?? add2eMagicObjectPowerArray(item);

  const maxCandidates = [
    sys.max_charges,
    sys.maxCharges,
    sys.charges_max,
    sys.chargesMax,
    sys.max,
    sys.charges?.max,
    sys.charges?.maximum,
    ...list.map(p => p.max ?? p.maxCharges ?? p.chargesMax ?? p.charges_max)
  ];

  let max = add2eMagicReadNumber(...maxCandidates);
  if (!Number.isFinite(max) || max < 0) max = 0;

  const currentCandidates = [
    item?.getFlag?.("add2e", "global_charges"),
    item?.getFlag?.("add2e", "charges"),
    sys.charges,
    sys.current_charges,
    sys.currentCharges,
    sys.charges_actuelles,
    sys.chargesRestantes,
    sys.remainingCharges,
    sys.charges?.value,
    sys.charges?.current,
    sys.charges?.actuel,
    sys.charges?.remaining
  ];

  let current = add2eMagicReadNumber(...currentCandidates);
  if (!Number.isFinite(current)) current = max;
  if (max > 0) current = Math.max(0, Math.min(current, max));

  return { current, max, label: max > 0 ? `${current}/${max}` : "—" };
}

function add2eMagicLooksMagical(item) {
  const sys = item?.system ?? {};
  const tags = add2eToEquipArray(sys.tags ?? sys.effectTags ?? sys.effets ?? sys.effects).map(add2eNormalizeEquipTag);
  const name = String(item?.name ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return tags.some(t => t.includes("magique") || t.includes("magic"))
    || name.includes("magique")
    || sys.magique === true
    || sys.magic === true;
}

function add2eMagicPowerGeneratedId(item, index) {
  return String(item?.id ?? "00000000000000").substring(0, 14) + String(index).padStart(2, "0");
}

function add2eUiCollectObjectMagicGroups(actor) {
  const groups = [];

  const itemsSources = actor?.items?.filter?.(item => {
    const type = String(item?.type ?? "").toLowerCase();
    if (!["arme", "armure", "objet", "object", "magic", "objet_magique"].includes(type)) return false;

    if (!add2eMagicItemEquippedOrUsable(item)) return false;

    const powers = add2eMagicObjectPowerArray(item);
    const hasPowers = powers.length > 0;
    const charges = add2eMagicObjectChargeInfo(item, powers);
    const hasCharges = charges.max > 0;

    return hasPowers || hasCharges || add2eMagicLooksMagical(item);
  }) ?? [];

  for (const itemSource of itemsSources) {
    let pouvoirs = add2eMagicObjectPowerArray(itemSource);

    if (!pouvoirs.length) {
      pouvoirs = [{
        name: itemSource.name,
        img: itemSource.img,
        description: itemSource.system?.description ?? itemSource.system?.desc ?? "Objet magique sans pouvoir détaillé.",
        max: itemSource.system?.max_charges ?? itemSource.system?.maxCharges ?? itemSource.system?.charges_max ?? itemSource.system?.chargesMax ?? itemSource.system?.charges ?? 0,
        niveau: 1
      }];
    }

    const chargeInfo = add2eMagicObjectChargeInfo(itemSource, pouvoirs);
    const maxGlobal = Number(chargeInfo.max) || 0;
    const isGlobal = maxGlobal > 0;

    const powers = [];
    for (let idx = 0; idx < pouvoirs.length; idx++) {
      const p = pouvoirs[idx] ?? {};
      const max = isGlobal ? maxGlobal : (Number(p.max ?? p.maxCharges ?? p.chargesMax ?? p.charges_max ?? itemSource.system?.charges ?? 1) || 1);
      const charges = isGlobal
        ? chargeInfo.current
        : (itemSource.getFlag?.("add2e", `charges_${idx}`) ?? p.charges ?? itemSource.system?.charges ?? max);

      powers.push({
        id: add2eMagicPowerGeneratedId(itemSource, idx),
        name: String(p.name || p.nom || itemSource.name || "Pouvoir").trim() || "Pouvoir",
        img: p.img || itemSource.img || "icons/svg/aura.svg",
        sourceItemId: itemSource.id,
        sourceName: itemSource.name || "Objet magique",
        sourceImg: itemSource.img || "icons/svg/item-bag.svg",
        niveau: Number(p.niveau ?? p.level ?? 1) || 1,
        description: p.description || p.desc || "",
        charges: Number(charges) || 0,
        max,
        cost: Number(p.cout ?? p.cost ?? 0) || 0
      });
    }

    groups.push({
      itemId: itemSource.id,
      itemName: itemSource.name || "Objet magique",
      itemImg: itemSource.img || "icons/svg/item-bag.svg",
      charges: chargeInfo.current,
      max: chargeInfo.max,
      chargeLabel: chargeInfo.label,
      powers: powers.sort((a, b) => String(a.name).localeCompare(String(b.name), "fr"))
    });
  }

  return groups.sort((a, b) => String(a.itemName).localeCompare(String(b.itemName), "fr"));
}

function add2eUiCollectObjectMagicPowers(actor) {
  return add2eUiCollectObjectMagicGroups(actor).flatMap(group => group.powers);
}

function add2eUiBuildObjectMagicSection(actor) {
  const groups = add2eUiCollectObjectMagicGroups(actor);

  const content = groups.length ? groups.map(group => {
    const rows = group.powers.length ? group.powers.map(power => `
      <tr class="add2e-object-magic-power-row" data-sort-id="${add2eUiEscapeHtml(power.id)}">
        <td style="width:46px;text-align:center;">
          <img class="sort-cast-img add2e-object-magic-cast" data-sort-id="${add2eUiEscapeHtml(power.id)}" src="${add2eUiEscapeHtml(power.img)}" title="Utiliser ${add2eUiEscapeHtml(power.name)}" style="width:32px;height:32px;border:1px solid #6f4b12;border-radius:6px;object-fit:cover;cursor:pointer;">
        </td>
        <td><strong>${add2eUiEscapeHtml(power.name)}</strong><br><small>Niveau ${Number(power.niveau) || 1}${power.cost ? ` — coût ${Number(power.cost)}` : ""}</small></td>
        <td class="a2e-small">${add2eUiEscapeHtml(power.description || "")}</td>
      </tr>
    `).join("") : `
      <tr>
        <td colspan="3" class="a2e-muted" style="text-align:center;padding:0.6em;">Aucun pouvoir détaillé.</td>
      </tr>
    `;

    return `
      <div class="add2e-object-magic-group" data-item-id="${add2eUiEscapeHtml(group.itemId)}" style="border:1px solid #d9bf73;border-radius:9px;margin-bottom:8px;background:#fffdf6;overflow:hidden;">
        <div class="add2e-object-magic-header" style="display:flex;align-items:center;gap:8px;padding:7px 9px;background:#ead99d;border-bottom:1px solid #dac276;color:#3d2b0a;font-weight:900;">
          <img src="${add2eUiEscapeHtml(group.itemImg)}" alt="" style="width:28px;height:28px;border:1px solid #6f4b12;border-radius:6px;object-fit:cover;">
          <span style="flex:1;">${add2eUiEscapeHtml(group.itemName)}</span>
          <span title="Charges restantes / charges maximum" style="padding:2px 8px;border:1px solid #9f7a24;border-radius:999px;background:#fffaf0;white-space:nowrap;">Charges ${add2eUiEscapeHtml(group.chargeLabel)}</span>
        </div>
        <table class="a2e-table add2e-object-magic-table" style="margin:0;">
          <thead>
            <tr>
              <th style="width:46px;">Utiliser</th>
              <th>Pouvoir</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }).join("") : `
    <div class="a2e-muted" style="text-align:center;padding:0.8em;border:1px solid #dac276;border-radius:9px;background:#fffdf6;">
      Aucun objet magique équipé ou doté d’un pouvoir utilisable.
    </div>
  `;

  return `
    <section class="a2e-panel add2e-object-magic-panel">
      <h2><i class="fas fa-wand-sparkles"></i> Objets magiques</h2>
      <div class="a2e-panel-body">${content}</div>
    </section>
  `;
}


globalThis.add2eUiCollectObjectMagicGroups = add2eUiCollectObjectMagicGroups;
globalThis.add2eUiCollectObjectMagicPowers = add2eUiCollectObjectMagicPowers;
function add2eUiInjectObjectMagicSection(spellContainer, actor) {
  if (!spellContainer || !actor) return;

  // IMPORTANT : le conteneur doit être le contenu de l'onglet Sorts,
  // jamais le bouton d'onglet [data-tab="sorts"].
  if (spellContainer.matches?.(".item, a.item, .sheet-tabs, .tabs, nav")) {
    console.warn("[ADD2E][OBJETS_MAGIQUES][UI] Conteneur invalide, injection annulée.", spellContainer);
    return;
  }

  spellContainer.querySelectorAll(".add2e-object-magic-panel").forEach(el => el.remove());

  const html = add2eUiBuildObjectMagicSection(actor);
  if (!html) return;

  const wrapper = document.createElement("div");
  wrapper.innerHTML = html.trim();
  const panel = wrapper.firstElementChild;
  if (!panel) return;

  // Placement voulu : après le résumé des listes, mais avant les tables de sorts.
  const summary = spellContainer.querySelector(".a2e-spellcasting-summary");
  const firstSpellPanel = Array.from(spellContainer.querySelectorAll(".a2e-panel"))
    .find(p => p.querySelector?.("table.sort-table"));

  if (summary) {
    spellContainer.insertBefore(panel, summary.nextElementSibling || firstSpellPanel || null);
  } else if (firstSpellPanel) {
    spellContainer.insertBefore(panel, firstSpellPanel);
  } else {
    spellContainer.insertBefore(panel, spellContainer.firstElementChild || null);
  }
}

function add2eEnhanceCharacterSheetUi(sheet, html) {
  const actor = sheet?.actor;
  if (!actor) return;

  const root = html?.jquery ? html[0] : html;
  if (!root) return;

  const sheetRoot = root.matches?.(".add2e-character-v3")
    ? root
    : root.querySelector?.(".add2e-character-v3") || root;

  if (!sheetRoot) return;

  // ------------------------------------------------------------
  // 1. Onglet Effets
  // ------------------------------------------------------------
  const tabs = sheetRoot.querySelector(".a2e-tabs.sheet-tabs.tabs, .sheet-tabs.tabs, .a2e-tabs");
  const body = sheetRoot.querySelector(".sheet-body");

  if (tabs && body && !tabs.querySelector('[data-tab="effets"]')) {
    const effectsTab = document.createElement("a");
    effectsTab.className = "item";
    effectsTab.dataset.tab = "effets";
    effectsTab.innerHTML = '<i class="fas fa-sparkles"></i> Effets';
    tabs.appendChild(effectsTab);
  }

  if (body && !body.querySelector('[data-tab="effets"]')) {
    const effectsContent = document.createElement("div");
    effectsContent.className = "tab a2e-tab-content";
    effectsContent.dataset.tab = "effets";
    effectsContent.innerHTML = add2eUiBuildEffectsTab(sheet);
    body.appendChild(effectsContent);
  } else {
    const effectsContent = body?.querySelector('[data-tab="effets"]');
    const effectsPanel = effectsContent?.querySelector(".add2e-effects-panel");
    if (effectsPanel) effectsPanel.outerHTML = add2eUiBuildEffectsTab(sheet);
  }

  $(sheetRoot).find('[data-tab="effets"]')
    .off("click.add2e-effects-tab")
    .on("click.add2e-effects-tab", ev => {
      ev.preventDefault();
      sheet._add2eActivateTab?.("effets", sheetRoot);
    });

  $(sheetRoot).find(".add2e-effect-edit, .effect-edit")
    .off("click.add2e-effects")
    .on("click.add2e-effects", ev => {
      ev.preventDefault();
      const effectId = $(ev.currentTarget).data("effect-id");
      const effect = actor.effects.get(effectId);
      if (effect) effect.sheet.render(true);
    });

  $(sheetRoot).find(".add2e-effect-delete, .effect-delete")
    .off("click.add2e-effects")
    .on("click.add2e-effects", async ev => {
      ev.preventDefault();
      sheet._add2eRememberActiveTab?.(sheetRoot);
      const effectId = $(ev.currentTarget).data("effect-id");
      if (effectId) {
        await actor.deleteEmbeddedDocuments("ActiveEffect", [effectId]);
        sheet.render(false);
      }
    });

  // ------------------------------------------------------------
  // 2. Onglet Sorts : affichage lisible des lignes de sorts
  // ------------------------------------------------------------
  const poolsByLevel = add2eUiGetSpellPoolsByLevel(actor);
  const entries = add2eGetSpellcastingEntries(actor);

  const spellTab =
    sheetRoot.querySelector('.sheet-body .a2e-tab-content[data-tab="sorts"]') ||
    sheetRoot.querySelector('.sheet-body .a2e-tab-content[data-tab="sort"]') ||
    sheetRoot.querySelector('.sheet-body .tab[data-tab="sorts"]') ||
    sheetRoot.querySelector('.sheet-body .tab[data-tab="sort"]') ||
    sheetRoot.querySelector('.sheet-body [data-tab="sorts"]') ||
    sheetRoot.querySelector('.sheet-body [data-tab="sort"]');

  const firstSortTable = sheetRoot.querySelector("table.sort-table");
  const spellContainer = spellTab || firstSortTable?.closest?.(".a2e-tab-content, .tab") || firstSortTable?.parentElement;

  if (spellContainer && entries.length && !spellContainer.querySelector(".a2e-spellcasting-summary")) {
    const summary = document.createElement("div");
    summary.className = "a2e-spellcasting-summary";
    summary.innerHTML = `
      <strong>Sorts utilisables :</strong>
      ${entries.map(e => `
        <span class="a2e-spell-pool-summary">
          ${add2eUiEscapeHtml(e.label || add2eSpellLabel(e.key))}
          <small>niv. ${Number(e.startsAt || 1)}+, sorts ${Number(e.maxSpellLevel || 0) || "—"}</small>
        </span>
      `).join("")}
    `;
    spellContainer.insertBefore(summary, spellContainer.firstElementChild || null);
  }

  if (spellContainer) add2eUiInjectObjectMagicSection(spellContainer, actor);

  for (const table of sheetRoot.querySelectorAll("table.sort-table")) {
    const panel = table.closest(".a2e-panel") || table.parentElement;
    const panelText = panel?.querySelector?.("h2, h3")?.textContent || panel?.textContent || "";
    const levelMatch = panelText.match(/niveau\s*(\d+)/i);
    const spellLevel = levelMatch ? Number(levelMatch[1]) : null;
    const pools = spellLevel ? (poolsByLevel[spellLevel] || []) : [];

    const headers = Array.from(table.querySelectorAll("thead th"));
    const sortHeader = headers.find(th => add2eUiNormalizeText(th.textContent) === "sort");
    if (sortHeader && spellLevel && !sortHeader.querySelector(".a2e-sort-pool-labels")) {
      const activePools = pools.filter(p => Number(p.max) > 0 || Number(p.count) > 0);
      const poolHtml = activePools.length
        ? activePools.map(p => `
          <span class="a2e-sort-slot-label a2e-sort-slot-${add2eUiEscapeHtml(p.key)}" title="${add2eUiEscapeHtml(p.label)} : préparés / maximum">
            ${add2eUiEscapeHtml(p.label)} ${Number(p.count) || 0}/${Number(p.max) || 0}
          </span>`).join("")
        : `<span class="a2e-sort-slot-label muted" title="Aucun emplacement disponible à ce niveau">0</span>`;
      sortHeader.innerHTML = `Sort <span class="a2e-sort-pool-labels">${poolHtml}</span>`;
    }

    const memIndex = headers.findIndex(th => add2eUiNormalizeText(th.textContent).includes("memorisation"));
    if (memIndex >= 0) {
      headers[memIndex].style.display = "none";
      for (const row of table.querySelectorAll("tbody tr")) {
        const cells = Array.from(row.children).filter(el => el.tagName === "TD" || el.tagName === "TH");
        if (cells[memIndex]) cells[memIndex].style.display = "none";
      }
    }

    for (const row of table.querySelectorAll("tbody tr")) {
      if (row.classList.contains("sort-description")) continue;
      const sortId = row.querySelector("[data-sort-id]")?.dataset?.sortId || row.querySelector("[data-sort-id]")?.getAttribute("data-sort-id");
      const sort = sortId ? actor.items.get(sortId) : null;
      if (!sort) continue;

      const check = add2eCanActorUseSpell(actor, sort);
      const entry = check.entry || add2eGetSpellEntryForSpell(actor, sort);
      const label = entry?.label || add2eGetSpellListsFromItem(sort).map(add2eSpellLabel).join(" / ") || "Sort";

      const memBadge = row.querySelector(".sort-memorize-badge");
      if (memBadge && entry) {
        const memCount = add2eGetMemorizedCountForEntry(sort, entry);
        memBadge.textContent = `${memCount}`;
        memBadge.title = `Sort préparé comme ${entry.label}`;
        memBadge.dataset.spellEntryKey = entry.key;
      }
      for (const btn of row.querySelectorAll(".sort-memorize-plus, .sort-memorize-minus")) {
        if (entry) btn.dataset.spellEntryKey = entry.key;
      }

      const cells = Array.from(row.children).filter(el => el.tagName === "TD" || el.tagName === "TH");
      const targetCell = cells.find(td => td.textContent?.trim() && !td.querySelector("img")) || cells[0];
      if (targetCell) {
        let badge = row.querySelector(".a2e-sort-list-badge");
        if (!badge) {
          badge = document.createElement("span");
          badge.className = "a2e-sort-list-badge";
          targetCell.appendChild(document.createTextNode(" "));
          targetCell.appendChild(badge);
        }
        badge.className = `a2e-sort-list-badge ${check.ok ? "ok" : "locked"}`;
        badge.title = check.ok
          ? `${label} — utilisable`
          : check.reason === "start"
            ? `${label} — disponible à partir du niveau ${entry?.startsAt}`
            : check.reason === "max-level"
              ? `${label} — niveau de sort maximum ${entry?.maxSpellLevel}`
              : `${label} — non autorisé par cette classe`;
        badge.textContent = label;
      }
    }
  }

  // Supprime le badge global déjà affiché à droite du titre de niveau,
  // puisqu'il est maintenant affiché à côté de "Sort" dans l'en-tête.
  for (const badge of sheetRoot.querySelectorAll(".sort-memorize-badge")) {
    if (!badge.closest("tbody tr")) badge.remove();
  }

  // ------------------------------------------------------------
  // 3. Onglet Sorts : préparation +/- au début de la ligne
  // ------------------------------------------------------------
  for (const row of sheetRoot.querySelectorAll("table.sort-table tbody tr")) {
    const controls = Array.from(row.querySelectorAll(".sort-memorize-minus, .sort-memorize-plus, .sort-memorize-badge"));
    if (!controls.length) continue;

    const firstCell = row.querySelector("td");
    if (!firstCell || firstCell.querySelector(".a2e-sort-prep-controls")) continue;

    const wrap = document.createElement("div");
    wrap.className = "a2e-sort-prep-controls";
    wrap.title = "Préparer / retirer un sort préparé";

    const ordered = [
      row.querySelector(".sort-memorize-minus"),
      row.querySelector(".sort-memorize-badge"),
      row.querySelector(".sort-memorize-plus")
    ].filter(Boolean);

    for (const el of ordered) wrap.appendChild(el);
    firstCell.prepend(wrap);
  }

  // ------------------------------------------------------------
  // 4. Onglet Sorts : nom cliquable au lieu du petit livre
  // ------------------------------------------------------------
  for (const toggle of Array.from(sheetRoot.querySelectorAll(".toggle-sort-desc-chat"))) {
    const sortId = toggle.dataset?.sortId || toggle.getAttribute("data-sort-id");
    const row = toggle.closest("tr");
    if (!row || !sortId) continue;

    const cells = Array.from(row.children).filter(el => el.tagName === "TD" || el.tagName === "TH");
    const nameCell = cells.find(td => td.textContent?.trim() && !td.querySelector(".sort-memorize-badge") && !td.querySelector("img")) || cells[1] || cells[0];

    if (nameCell && !nameCell.querySelector(".a2e-sort-name-link")) {
      const iconClone = nameCell.querySelector("i.toggle-sort-desc-chat");
      if (iconClone) iconClone.remove();

      const rawName = nameCell.textContent.trim();
      const link = document.createElement("a");
      link.href = "#";
      link.className = "a2e-sort-name-link";
      link.dataset.sortId = sortId;
      link.textContent = rawName || "Détail du sort";

      nameCell.textContent = "";
      nameCell.appendChild(link);
    }

    toggle.remove();
  }

  $(sheetRoot).find(".a2e-sort-name-link")
    .off("click.add2e-sort-desc")
    .on("click.add2e-sort-desc", function(ev) {
      ev.preventDefault();
      ev.stopPropagation();
      const sortId = $(this).data("sort-id");
      const descRow = $(sheetRoot).find(`#desc-chat-${sortId}`);
      descRow.slideToggle(160);
      return false;
    });

  // ------------------------------------------------------------
  // 5. Onglet Sorts : retirer l'action Lancer de la colonne Actions
  // ------------------------------------------------------------
  for (const el of Array.from(sheetRoot.querySelectorAll(".sort-cast"))) {
    if (!el.classList.contains("sort-cast-img")) el.remove();
  }

  // Styles injectés une seule fois dans la feuille.
  if (!sheetRoot.querySelector("style[data-add2e-ui-enhance='1']")) {
    const style = document.createElement("style");
    style.dataset.add2eUiEnhance = "1";
    style.textContent = `
      .add2e-character-v3 .a2e-spellcasting-summary {
        margin:0 0 8px 0;
        padding:7px 9px;
        border:1px solid #d9bf73;
        border-radius:9px;
        background:#fff8df;
        color:#3d2b0a;
        line-height:1.45;
      }
      .add2e-character-v3 .a2e-spell-pool-summary {
        display:inline-flex;
        align-items:center;
        gap:0.35em;
        margin:2px 4px;
        padding:2px 7px;
        border:1px solid #c49a41;
        border-radius:999px;
        background:#fffdf6;
        font-weight:900;
      }
      .add2e-character-v3 .a2e-spell-pool-summary small {
        color:#7f704d;
        font-weight:700;
      }
      .add2e-character-v3 .a2e-sort-slot-label {
        display:inline-block;
        margin-left:0.45em;
        padding:0.08em 0.45em;
        border-radius:999px;
        background:#7c39c3;
        color:#fff;
        font-weight:900;
        font-size:0.9em;
        line-height:1.45em;
      }
      .add2e-character-v3 .a2e-sort-slot-label.muted {
        background:#918873;
      }
      .add2e-character-v3 .a2e-sort-slot-druide {
        background:#2f8f4e;
      }
      .add2e-character-v3 .a2e-sort-slot-magicien {
        background:#7c39c3;
      }
      .add2e-character-v3 .a2e-sort-slot-clerc {
        background:#b88924;
      }
      .add2e-character-v3 .a2e-sort-list-badge {
        display:inline-block;
        margin-left:0.35em;
        padding:0.05em 0.45em;
        border-radius:999px;
        font-size:0.78em;
        line-height:1.35;
        font-weight:900;
        vertical-align:middle;
        border:1px solid rgba(0,0,0,0.12);
      }
      .add2e-character-v3 .a2e-sort-list-badge.ok {
        background:#eaf8ef;
        color:#226d3b;
      }
      .add2e-character-v3 .a2e-sort-list-badge.locked {
        background:#f3eee1;
        color:#8a611d;
      }
      .add2e-character-v3 .a2e-sort-prep-controls {
        display:inline-flex;
        align-items:center;
        gap:0.25em;
        margin-right:0.45em;
        vertical-align:middle;
      }
      .add2e-character-v3 .a2e-sort-prep-controls .sort-memorize-badge {
        margin:0;
      }
      .add2e-character-v3 .a2e-sort-name-link {
        color:#2f250c;
        font-weight:900;
        text-decoration:none;
        border-bottom:1px dotted #7c39c3;
        cursor:pointer;
      }
      .add2e-character-v3 .a2e-sort-name-link:hover {
        color:#7c39c3;
        text-shadow:0 0 3px rgba(124,57,195,0.18);
      }
      .add2e-character-v3 .add2e-object-magic-panel {
        border-color:#b88924;
        box-shadow:0 1px 6px rgba(80,58,10,0.16);
      }
      .add2e-character-v3 .add2e-object-magic-panel > h2 {
        background:linear-gradient(180deg, #ead99d, #dfc36f);
      }
      .add2e-character-v3 .add2e-object-magic-table td,
      .add2e-character-v3 .add2e-object-magic-table th,
      .add2e-character-v3 .add2e-effects-table td,
      .add2e-character-v3 .add2e-effects-table th {
        vertical-align:middle;
      }
    `;
    sheetRoot.prepend(style);
  }

  sheet._add2eActivateTab?.(sheet._add2eActiveTab || sheet._add2eReadStoredTab?.() || "resume", sheetRoot);
}

/**
 * Ajoute la gestion universelle du clic image avec data-edit="img" ou data-edit="img_portrait"
 * Utilise majImageToken pour les acteurs (img), .update pour les items,
 * gère aussi le portrait (img_portrait sur l'acteur).
 * À appeler dans activateListeners(html) de chaque feuille.
 */
function add2eRegisterImgPicker(html, sheet) {
  // Image générale (avatar, icône, token, sort, etc.)
  html.find('img[data-edit="img"]').off().on('click', ev => {
    ev.preventDefault();
    // Détecte le contexte : acteur, item, etc.
    const isActor = !!sheet.actor;
    const isItem  = !!sheet.item && !sheet.actor;
    let currentImg = "icons/svg/mystery-man.svg";
    let updateFn   = null;

    if (isActor) {
      currentImg = sheet.actor.img || currentImg;
      updateFn = path => majImageToken(sheet.actor, path);
    } else if (isItem) {
      currentImg = sheet.item.img || currentImg;
      updateFn = path => sheet.item.update({ img: path });
    } else {
      return;
    }

    new FilePicker({
      type: "image",
      current: currentImg,
      callback: path => {
        updateFn(path);
        html.find('img[data-edit="img"]').attr('src', path);
        html.find('input[name="img"]').val(path);
      }
    }).render(true);
  });

  // Portrait spécial (champ dédié : actor.system.img_portrait)
  html.find('img[data-edit="img_portrait"]').off().on('click', ev => {
    ev.preventDefault();
    // Attention : ici, on ne touche que l'acteur
    if (!sheet.actor) return;
    new FilePicker({
      type: "image",
      current: sheet.actor.system.img_portrait || "icons/svg/mystery-man.svg",
      callback: path => {
        sheet.actor.update({ "system.img_portrait": path });
        html.find('img[data-edit="img_portrait"]').attr('src', path);
      }
    }).render(true);
  });
}


function canCastSpell(spellData, actor) {
  const normalize = v => (v ?? "").toString().toLowerCase().trim();

  const sys =
    spellData?.system ??
    spellData?.data?.system ??
    {};

  // LOG 1
  console.log("[canCastSpell] sort:", spellData.name, sys.spellLists, sys.niveau);

  // Le sort DOIT avoir spellLists
  if (!Array.isArray(sys.spellLists) || !sys.spellLists.length) {
    console.log("[canCastSpell] REFUS: sort sans spellLists");
    return false;
  }

  const casting = actor.system?.spellcasting;

  // LOG 2
  console.log("[canCastSpell] actor spellcasting:", casting);

  if (!casting || !Array.isArray(casting.lists) || !casting.lists.length) {
    console.log("[canCastSpell] REFUS: acteur sans spellcasting.lists");
    return false;
  }

  const sortLists  = sys.spellLists.map(normalize);
  const actorLists = casting.lists.map(normalize);

  // LOG 3
  console.log("[canCastSpell] intersection:", sortLists, actorLists);

  if (!sortLists.some(l => actorLists.includes(l))) {
    console.log("[canCastSpell] REFUS: listes incompatibles");
    return false;
  }

  const actorLevel = Number(actor.system?.niveau) || 1;
  const spellLevel = Number(sys.niveau) || 1;

  if (casting.startsAt && actorLevel < casting.startsAt) {
    console.log("[canCastSpell] REFUS: niveau trop bas");
    return false;
  }

  if (casting.maxSpellLevel && spellLevel > casting.maxSpellLevel) {
    console.log("[canCastSpell] REFUS: niveau de sort trop élevé");
    return false;
  }

  const prog = actor.system?.details_classe?.progression?.[actorLevel - 1] || {};
  const slots = Array.isArray(prog.spellsPerLevel)
    ? Number(prog.spellsPerLevel[spellLevel - 1]) || 0
    : 0;

  // LOG 4
  console.log("[canCastSpell] slots:", slots);

  if (slots <= 0) {
    console.log("[canCastSpell] REFUS: aucun slot");
    return false;
  }

  console.log("[canCastSpell] OK");
  return true;
}


function add2eRaceTagsFromData(raceData) {
  const sys = raceData?.system ?? {};
  const tags = new Set();

  for (const raw of [
    ...add2eToEquipArray(sys.identityTags),
    ...add2eToEquipArray(sys.tags),
    ...add2eToEquipArray(raceData?.flags?.add2e?.tags)
  ]) {
    const tag = add2eNormalizeEquipTag(raw);
    if (tag.startsWith("race:")) tags.add(tag);
  }

  if (!tags.size) {
    const name = add2eNormalizeEquipTag(raceData?.name ?? sys.label ?? sys.nom ?? "");
    if (name) tags.add(`race:${name}`);
  }

  return [...tags];
}

function add2eClassRuleSystem(classeItem) {
  const sys = add2eDeepClone(classeItem?.system ?? {}) || {};
  const hasRaceRules = !!sys.raceRestriction?.races && Object.keys(sys.raceRestriction.races).length > 0;
  const hasReqTags = add2eToEquipArray(sys.requirementTags).length > 0;

  // Micro-fallback : si l'item droppé est une copie incomplète, on relit l'item Monde du même nom.
  // On ne crée pas de second système : on complète seulement les champs de règles manquants.
  if ((!hasRaceRules || !hasReqTags) && classeItem?.name && game?.items) {
    const worldClass = game.items.find(i => i.type === "classe" && i.name === classeItem.name);
    const worldSys = worldClass?.system;

    if (worldSys) {
      if (!hasRaceRules && worldSys.raceRestriction?.races) {
        sys.raceRestriction = add2eDeepClone(worldSys.raceRestriction);
      }
      if (!hasReqTags && add2eToEquipArray(worldSys.requirementTags).length) {
        sys.requirementTags = add2eDeepClone(worldSys.requirementTags);
      }
      for (const field of ["alignment", "alignements_autorises", "caracs_min"]) {
        if (!add2eHasUsefulValue(sys[field]) && add2eHasUsefulValue(worldSys[field])) {
          sys[field] = add2eDeepClone(worldSys[field]);
        }
      }
    }
  }

  return sys;
}

function add2eClassAllowedAlignments(classeSystem) {
  return add2eToEquipArray(
    classeSystem?.alignements_autorises ??
    classeSystem?.alignment ??
    []
  ).filter(Boolean);
}

function add2ePickClassAlignment(actor, classeSystem) {
  const allowed = add2eClassAllowedAlignments(classeSystem);
  if (!allowed.length) return actor?.system?.alignement ?? "";

  const current = add2eNormalizeEquipTag(actor?.system?.alignement ?? "");
  const allowedNorm = allowed.map(add2eNormalizeEquipTag);

  if (current && allowedNorm.includes(current)) return actor.system.alignement;
  return allowed[0];
}


// ============================================================
// ADD2E — Auto-compatibilité race / classe au drop
// Objectif : ne plus bloquer un drop uniquement parce que la race
// ou la classe courante est incompatible. Comme pour l'alignement,
// on choisit automatiquement une race ou une classe compatible.
// ============================================================
function add2eDropDebugRaceClass(...args) {
  if (globalThis.ADD2E_DEBUG_RACE_CLASSE === true) {
    console.log("[ADD2E][DROP][RACE_CLASSE]", ...args);
  }
}

function add2eItemDataCloneForDrop(itemLike) {
  if (!itemLike) return null;
  const data = typeof itemLike.toObject === "function" ? itemLike.toObject() : add2eDeepClone(itemLike);
  if (!data || typeof data !== "object") return null;
  delete data._id;
  delete data._stats;
  return data;
}

function add2eWorldItemsByType(type) {
  const wanted = String(type ?? "").toLowerCase();
  return Array.from(game?.items ?? [])
    .filter(i => String(i?.type ?? "").toLowerCase() === wanted)
    .map(i => add2eItemDataCloneForDrop(i))
    .filter(Boolean);
}

function add2eRaceCandidateLabel(raceData) {
  return String(raceData?.name ?? raceData?.system?.label ?? raceData?.system?.nom ?? "Race").trim() || "Race";
}

function add2eClassCandidateLabel(classData) {
  return String(classData?.name ?? classData?.system?.label ?? classData?.system?.nom ?? "Classe").trim() || "Classe";
}

function add2eRaceMatchesClassRules(raceData, classData) {
  const cls = add2eClassRuleSystem(classData);
  const rules = cls?.raceRestriction?.races;
  if (!rules || typeof rules !== "object" || !Object.keys(rules).length) return true;

  const raceTags = add2eRaceTagsFromData(raceData).map(add2eNormalizeEquipTag);
  const normalizedRules = {};
  for (const [tag, rule] of Object.entries(rules)) normalizedRules[add2eNormalizeEquipTag(tag)] = rule;

  const matched = raceTags.find(t => Object.prototype.hasOwnProperty.call(normalizedRules, t));
  if (!matched) return false;
  return normalizedRules[matched]?.allowed === true;
}

function add2eFindCompatibleRaceForClass(actor, classData, alignmentCandidate = null) {
  const currentRaces = (actor?.items?.filter?.(i => String(i.type).toLowerCase() === "race") ?? [])
    .map(i => add2eItemDataCloneForDrop(i))
    .filter(Boolean);

  const candidates = [
    ...currentRaces,
    ...add2eWorldItemsByType("race")
  ];

  const seen = new Set();
  for (const raceData of candidates) {
    const key = add2eNormalizeEquipTag(raceData?.name ?? raceData?.system?.slug ?? raceData?.system?.label ?? "");
    if (!key || seen.has(key)) continue;
    seen.add(key);

    if (!add2eRaceMatchesClassRules(raceData, classData)) continue;

    const ok = typeof checkClassStatMin === "function"
      ? checkClassStatMin(actor, classData, raceData, alignmentCandidate, { silent: true, ignoreLevelMax: true })
      : true;

    if (ok) {
      add2eDropDebugRaceClass("Race compatible trouvée pour classe", {
        actor: actor?.name,
        classe: add2eClassCandidateLabel(classData),
        race: add2eRaceCandidateLabel(raceData),
        alignmentCandidate
      });
      return raceData;
    }
  }

  return null;
}

function add2eFindCompatibleClassForRace(actor, raceData) {
  const currentClasses = (actor?.items?.filter?.(i => String(i.type).toLowerCase() === "classe") ?? [])
    .map(i => add2eItemDataCloneForDrop(i))
    .filter(Boolean);

  const candidates = [
    ...currentClasses,
    ...add2eWorldItemsByType("classe")
  ];

  const seen = new Set();
  for (const classData of candidates) {
    const key = add2eNormalizeEquipTag(classData?.name ?? classData?.system?.slug ?? classData?.system?.label ?? "");
    if (!key || seen.has(key)) continue;
    seen.add(key);

    if (!add2eRaceMatchesClassRules(raceData, classData)) continue;

    const alignmentCandidate = add2ePickClassAlignment(actor, classData.system ?? {});
    const ok = typeof checkClassStatMin === "function"
      ? checkClassStatMin(actor, classData, raceData, alignmentCandidate, { silent: true, ignoreLevelMax: true })
      : true;

    if (ok) {
      add2eDropDebugRaceClass("Classe compatible trouvée pour race", {
        actor: actor?.name,
        race: add2eRaceCandidateLabel(raceData),
        classe: add2eClassCandidateLabel(classData),
        alignmentCandidate
      });
      return { classData, alignmentCandidate };
    }
  }

  return null;
}

async function add2eApplyRaceItemDataToActor(actor, raceData, sheet = null, options = {}) {
  if (!actor || !raceData || raceData.type !== "race") return null;

  const data = add2eItemDataCloneForDrop(raceData);
  data.type = "race";

  const existingRaces = actor.items.filter(i => String(i.type || "").toLowerCase() === "race");
  for (const oldRace of existingRaces) {
    const raceEffects = actor.effects.filter(eff => eff.origin === oldRace.uuid);
    if (raceEffects.length) {
      const ids = raceEffects.map(e => e.id).filter(id => actor.effects.has(id));
      if (ids.length) await actor.deleteEmbeddedDocuments("ActiveEffect", ids, { add2eInternal: true });
    }
    await oldRace.delete({ render: false });
  }

  await actor.update({ "system.bonus_caracteristiques": {} }, { add2eInternal: true });

  const [raceDoc] = await actor.createEmbeddedDocuments("Item", [data], { add2eInternal: true });
  if (!raceDoc) return null;

  if (raceDoc.effects.contents?.length) {
    const actorEffects = raceDoc.effects.contents.map(eff => {
      const effectData = foundry.utils.duplicate(eff.toObject());
      effectData.origin = raceDoc.uuid;
      effectData.disabled = false;
      effectData.transfer = false;
      effectData.flags = effectData.flags ?? {};
      effectData.flags.add2e = {
        ...(effectData.flags.add2e ?? {}),
        sourceType: "race",
        sourceItemId: raceDoc.id,
        sourceItemUuid: raceDoc.uuid
      };
      return effectData;
    });
    await actor.createEmbeddedDocuments("ActiveEffect", actorEffects, { add2eInternal: true });
  }

  const raceSystem = foundry.utils.deepClone(raceDoc.system ?? {});
  await actor.update({
    "system.race": raceDoc.name,
    "system.details_race": {
      ...raceSystem,
      name: raceDoc.name,
      label: raceSystem.label || raceDoc.name,
      img: raceDoc.img || raceSystem.img || ""
    },
    "system.bonus_caracteristiques": raceSystem.bonus_caracteristiques
      ? foundry.utils.deepClone(raceSystem.bonus_caracteristiques)
      : {}
  }, { add2eInternal: true });

  if (typeof sheet?.autoSetCaracAjustements === "function") await sheet.autoSetCaracAjustements();

  if (options.notify !== false) {
    ui.notifications.info(`Race ajustée automatiquement : ${raceDoc.name}.`);
  }

  return raceDoc;
}

async function add2eApplyClassItemDataToActor(actor, classData, sheet = null, options = {}) {
  if (!actor || !classData || classData.type !== "classe") return null;

  const data = add2eItemDataCloneForDrop(classData);
  data.type = "classe";

  const alignmentCandidate = options.alignmentCandidate ?? add2ePickClassAlignment(actor, data.system ?? {});

  const typesToDelete = ["classe", "sort", "arme", "armure", "spell", "weapon", "armor"];
  const itemsToDelete = actor.items.filter(i => typesToDelete.includes(String(i.type || "").toLowerCase()));
  const effectsToDelete = actor.effects.filter(eff => add2eShouldDeleteEffectForClassPurge(eff, itemsToDelete));

  for (const eff of effectsToDelete) await eff.delete({ render: false });
  for (const it of itemsToDelete) await it.delete({ render: false });

  const [classDoc] = await actor.createEmbeddedDocuments("Item", [data], { add2eInternal: true });
  if (!classDoc) return null;

  if (classDoc.effects.contents?.length) {
    const actorEffects = classDoc.effects.contents.map(eff => {
      const effectData = foundry.utils.duplicate(eff.toObject());
      effectData.origin = classDoc.uuid;
      effectData.disabled = false;
      effectData.transfer = false;
      effectData.flags = effectData.flags ?? {};
      effectData.flags.add2e = {
        ...(effectData.flags.add2e ?? {}),
        sourceType: "classe",
        sourceClasse: classDoc.name,
        sourceItemId: classDoc.id,
        sourceItemUuid: classDoc.uuid
      };
      return effectData;
    });
    await actor.createEmbeddedDocuments("ActiveEffect", actorEffects, { add2eInternal: true });
  }

  const classSystem = foundry.utils.deepClone(classDoc.system ?? {});
  const levelClamp = add2eClampLevelToClassMax(actor, actor.system?.niveau, classSystem, { notify: true });
  const alns = add2eClassAllowedAlignments(classSystem);
  const updates = {
    "system.classe": classDoc.name,
    "system.details_classe": classSystem,
    "system.spellcasting": classSystem.spellcasting ?? null,
    "system.alignements_autorises": alns
  };

  if (levelClamp.changed) updates["system.niveau"] = levelClamp.level;
  if (alignmentCandidate) updates["system.alignement"] = alignmentCandidate;

  if (classDoc.system?.progression?.[0]?.sauvegardes) {
    updates["system.sauvegardes"] = foundry.utils.duplicate(classDoc.system.progression[0].sauvegardes);
  }

  await actor.update(updates, { add2eInternal: true });

  if (typeof sheet?.autoSetCaracAjustements === "function") await sheet.autoSetCaracAjustements();
  if (typeof sheet?.autoSetPointsDeCoup === "function") {
    await sheet.autoSetPointsDeCoup({ syncCurrent: true, force: true, reason: options.reason || "auto-class-compat" });
  }

  try { await add2eSyncMonkUnarmedWeapon(actor); }
  catch (e) { console.warn("[ADD2E][MOINE] Erreur synchronisation Main nue après changement auto classe :", e); }

  try { await add2eSyncClassPassiveEffect(actor); }
  catch (e) { console.warn("[ADD2E][CLASSE][EFFETS] Erreur effets classe après changement auto classe :", e); }

  try {
    const spellSync = await add2eSyncActorSpellsFromClass(actor, classDoc, { mode: "replace", showWait: true });
    if (spellSync?.handled) ui.notifications.info(`Sorts de ${classDoc.name} synchronisés : ${spellSync.imported} importé(s).`);
  } catch (e) {
    console.error("[ADD2E][CLASSE][SORTS] Erreur synchronisation sorts après changement auto classe :", e);
    ui.notifications.error("Erreur pendant la synchronisation des sorts de classe.");
  }

  if (options.notify !== false) ui.notifications.info(`Classe ajustée automatiquement : ${classDoc.name}.`);

  return classDoc;
}

globalThis.add2eFindCompatibleRaceForClass = add2eFindCompatibleRaceForClass;
globalThis.add2eFindCompatibleClassForRace = add2eFindCompatibleClassForRace;
globalThis.add2eApplyRaceItemDataToActor = add2eApplyRaceItemDataToActor;
globalThis.add2eApplyClassItemDataToActor = add2eApplyClassItemDataToActor;

function checkClassStatMin(actor, classeItem, candidateRaceData = null, candidateAlignment = null, options = {}) {
  const silent = options?.silent === true;
  const ignoreLevelMax = options?.ignoreLevelMax === true;
  const classeSystem = add2eClassRuleSystem(classeItem);
  const actorSystem = actor?.system ?? {};
  const manques = [];

  const raceItems =
    actor?.items?.filter?.(i => String(i.type || "").toLowerCase() === "race") ?? [];

  const wantedRace = add2eNormalizeEquipTag(
    actorSystem.race ||
    actorSystem.details_race?.label ||
    actorSystem.details_race?.name ||
    actorSystem.details_race?.nom ||
    ""
  );

  const matchedRaceItem = wantedRace
    ? raceItems.find(r => {
        const sys = r.system ?? {};
        return [
          r.id,
          r.name,
          sys.slug,
          sys.label,
          sys.name,
          sys.nom
        ].map(add2eNormalizeEquipTag).includes(wantedRace);
      })
    : null;

  // Si actor.system.race est plus récent que les items embarqués, on valide contre
  // la race affichée/persistée plutôt que contre un ancien item orphelin.
  const actorRaceFallback = wantedRace
    ? {
        name: actorSystem.race || actorSystem.details_race?.label || actorSystem.details_race?.name || actorSystem.details_race?.nom || wantedRace,
        system: {
          ...(actorSystem.details_race ?? {}),
          slug: actorSystem.details_race?.slug || wantedRace,
          tags: add2eToEquipArray(actorSystem.details_race?.tags).length
            ? actorSystem.details_race.tags
            : [`race:${wantedRace}`],
          identityTags: add2eToEquipArray(actorSystem.details_race?.identityTags).length
            ? actorSystem.details_race.identityTags
            : [`race:${wantedRace}`],
          bonus_caracteristiques: actorSystem.bonus_caracteristiques ?? actorSystem.details_race?.bonus_caracteristiques ?? {}
        }
      }
    : null;

  const raceData =
    candidateRaceData ??
    matchedRaceItem ??
    actorRaceFallback ??
    raceItems[0] ??
    null;

  const raceTags = add2eRaceTagsFromData(raceData);
  const actorLevel = Number(actorSystem.niveau ?? 1) || 1;

  const candidateRaceBonus = candidateRaceData?.system?.bonus_caracteristiques ?? null;
  const currentRaceBonus = actorSystem.bonus_caracteristiques ?? {};

  const caracTotal = (carac) => {
    const base = Number(actorSystem[`${carac}_base`] ?? actorSystem[carac] ?? 10) || 10;
    const race = Number((candidateRaceBonus ?? currentRaceBonus)?.[carac] ?? actorSystem[`${carac}_race`] ?? 0) || 0;
    return base + race;
  };

  // Compatibilité race/classe : source unique = objet classe via raceRestriction.
  // Les anciens champs raceAllowed ne sont utilisés qu'en fallback si l'objet
  // classe n'a pas encore été migré.
  const races = classeSystem.raceRestriction?.races;
  const hasRaceRestriction = races && typeof races === "object" && Object.keys(races).length > 0;

  if (hasRaceRestriction) {
    if (!raceData) {
      manques.push("race requise pour vérifier la compatibilité de classe");
    } else {
      const normalizedRules = {};
      for (const [tag, rule] of Object.entries(races)) {
        normalizedRules[add2eNormalizeEquipTag(tag)] = rule;
      }

      const matchedTag = raceTags.find(tag => Object.prototype.hasOwnProperty.call(normalizedRules, tag));

      if (!matchedTag) {
        manques.push(`race non autorisée (${raceTags.join(", ") || "aucun tag race:*"})`);
      } else {
        const rule = normalizedRules[matchedTag] ?? {};
        if (rule.allowed !== true) manques.push(`race interdite (${matchedTag})`);

        const maxLevel = Number(rule.maxLevel ?? rule.niveauMax ?? rule.max);
        if (!ignoreLevelMax && Number.isFinite(maxLevel) && maxLevel > 0 && actorLevel > maxLevel) {
          manques.push(`${matchedTag} limité au niveau ${maxLevel}`);
        }
      }
    }
  } else if (raceData) {
    const legacyAllowed = add2eToEquipArray(classeSystem.raceAllowed).map(add2eNormalizeEquipTag).filter(Boolean);
    if (legacyAllowed.length) {
      const matchedLegacy = raceTags.some(t => legacyAllowed.includes(t.replace(/^race:/, "")) || legacyAllowed.includes(t));
      if (!matchedLegacy) manques.push(`race non autorisée (${raceTags.join(", ") || "aucun tag race:*"})`);
    }
  }

  // Ancien champ conservé pour compatibilité des objets déjà créés.
  const min = classeSystem.caracs_min || {};
  for (const [carac, rawMin] of Object.entries(min)) {
    const minVal = Number(rawMin);
    if (!Number.isFinite(minVal)) continue;

    const total = caracTotal(carac);
    if (total < minVal) manques.push(`${carac} ${total} < ${minVal}`);
  }

  // Alignements déclarés par l'objet classe.
  const allowedAlignments = add2eClassAllowedAlignments(classeSystem);
  const currentAlignmentRaw = candidateAlignment ?? actorSystem.alignement ?? "";
  const currentAlignment = add2eNormalizeEquipTag(currentAlignmentRaw);
  if (allowedAlignments.length) {
    const allowedNorm = allowedAlignments.map(add2eNormalizeEquipTag);
    if (!currentAlignment || !allowedNorm.includes(currentAlignment)) {
      manques.push(`alignement requis : ${allowedAlignments.join(" ou ")}`);
    }
  }

  // Nouveau système générique par tags de prérequis.
  // Les tags prerequis:alignement:allow:* multiples sont interprétés en OU.
  const requirementTags = add2eToEquipArray(classeSystem.requirementTags)
    .map(add2eNormalizeEquipTag)
    .filter(Boolean);

  const allowedAlignmentTags = [];
  const forbiddenAlignmentTags = [];

  for (const tag of requirementTags) {
    const parts = tag.split(":");
    if (parts[0] !== "prerequis" || parts[1] !== "alignement") continue;

    const mode = parts[2];
    const wanted = add2eNormalizeEquipTag(parts.slice(3).join(":"));
    if (!wanted) continue;

    if (mode === "allow") allowedAlignmentTags.push(wanted);
    if (mode === "not") forbiddenAlignmentTags.push(wanted);
  }

  if (currentAlignment) {
    const forbiddenMatch = forbiddenAlignmentTags.find(a => currentAlignment === a);
    if (forbiddenMatch) manques.push(`alignement interdit : ${currentAlignmentRaw || actorSystem.alignement}`);

    const uniqueAllowedAlignments = [...new Set(allowedAlignmentTags)];
    if (uniqueAllowedAlignments.length && !uniqueAllowedAlignments.includes(currentAlignment)) {
      manques.push(`alignement requis : ${uniqueAllowedAlignments.join(" ou ")}`);
    }
  }

  for (const tag of requirementTags) {
    const parts = tag.split(":");
    if (parts[0] !== "prerequis") continue;

    if (parts[1] === "alignement") continue;

    if (parts[1] === "caracteristique") {
      const carac = parts[2];
      const op = parts[3];
      const target = Number(parts[4]);
      if (!carac || !Number.isFinite(target)) continue;

      const total = caracTotal(carac);
      if (op === "min" && total < target) manques.push(`${carac} ${total} < ${target}`);
      if (op === "max" && total > target) manques.push(`${carac} ${total} > ${target}`);
    }

    if (parts[1] === "niveau") {
      const op = parts[2];
      const target = Number(parts[3]);
      if (!Number.isFinite(target)) continue;

      if (op === "min" && actorLevel < target) manques.push(`niveau ${actorLevel} < ${target}`);
      if (op === "max" && actorLevel > target && !ignoreLevelMax) manques.push(`niveau ${actorLevel} > ${target}`);
    }

    if (parts[1] === "tag") {
      const mode = parts[2];
      const wanted = add2eNormalizeEquipTag(parts.slice(3).join(":"));
      if (!wanted) continue;

      const activeTags = typeof Add2eEffectsEngine !== "undefined"
        ? Add2eEffectsEngine.getActiveTags(actor)
        : [];

      const has = activeTags.map(add2eNormalizeEquipTag).includes(wanted);
      if (mode === "required" && !has) manques.push(`tag requis absent : ${wanted}`);
      if (mode === "forbidden" && has) manques.push(`tag interdit présent : ${wanted}`);
    }
  }

  if (manques.length) {
    if (!silent) {
      ui.notifications.warn(`Prérequis insuffisants pour la classe "${classeItem.name}" (${manques.join(", ")})`);
      console.warn("[ADD2e] Classe refusée, prérequis non atteints :", {
        actor: actor?.name,
        classe: classeItem?.name,
        race: raceData?.name ?? null,
        raceTags,
        alignementTeste: currentAlignmentRaw,
        manques
      });
    }
    return false;
  }

  return true;
}

const CARACS = ["force", "dexterite", "constitution", "intelligence", "sagesse", "charisme"];
const CARAC_SHORT = {
  force: "FOR",
  dexterite: "DEX",
  constitution: "CON",
  intelligence: "INT",
  sagesse: "SAG",
  charisme: "CHA"
};


// ADD2E — Moine : synchronisation de l'arme virtuelle Main nue.
function add2eGetMonkClassSystem(actor) {
  const item = actor?.items?.find?.(i => i.type === "classe") ?? null;
  const sys = item?.system ?? {};
  const details = actor?.system?.details_classe ?? {};
  const label = add2eNormalizeEquipTag(item?.name || sys.label || details.label || details.name || actor?.system?.classe || "");
  const tags = [
    ...(Array.isArray(sys.tags) ? sys.tags : []),
    ...(Array.isArray(details.tags) ? details.tags : [])
  ].map(add2eNormalizeEquipTag);
  if (!label.includes("moine") && !tags.includes("classe:moine")) return null;
  return { ...add2eDeepClone(details), ...add2eDeepClone(sys) };
}

function add2eGetMonkProgressionRow(actor) {
  const cls = add2eGetMonkClassSystem(actor);
  if (!cls) return null;
  const level = Number(actor?.system?.niveau ?? 1) || 1;
  const prog = Array.isArray(cls.monkProgression) && cls.monkProgression.length
    ? cls.monkProgression
    : Array.isArray(cls.progression) ? cls.progression : [];
  return prog.find(r => Number(r.level ?? r.niveau) === level) ?? prog[level - 1] ?? prog[0] ?? null;
}

function add2eMonkDamageParts(raw) {
  if (raw && typeof raw === "object") raw = raw.raw ?? raw.value ?? raw.contre_moyen ?? raw.medium ?? raw.moyen;
  const parts = String(raw ?? "1d6/1d3").split(/[\/|]/).map(p => p.trim()).filter(Boolean);
  const moyen = parts[0] || "1d6";
  const grand = parts[1] || moyen;
  return { raw: `${moyen} / ${grand}`, moyen, grand };
}

function add2eIsMonkAutoUnarmed(item) {
  if (!item || item.type !== "arme") return false;
  const name = add2eNormalizeEquipTag(item.name);
  const sys = item.system ?? {};
  return ["main_nue", "mainnue"].includes(name)
    || (sys.add2eAutoCreated === true && add2eNormalizeEquipTag(sys.sourceClasse) === "moine")
    || add2eNormalizeEquipTag(sys.sourceCapacite) === "main_nue_moine";
}

async function add2eSyncMonkUnarmedWeapon(actor) {
  if (!actor || actor.type !== "personnage") return false;
  const cls = add2eGetMonkClassSystem(actor);
  const existing = actor.items?.filter?.(add2eIsMonkAutoUnarmed) ?? [];

  if (!cls) {
    if (existing.length) await actor.deleteEmbeddedDocuments("Item", existing.map(i => i.id));
    return false;
  }

  const row = add2eGetMonkProgressionRow(actor) ?? {};
  const dmg = add2eMonkDamageParts(row.unarmedDamage ?? row.main_nue ?? row.damage ?? actor.system?.moine?.main_nue);
  const system = {
    nom: "Main nue",
    equipee: true,
    categorie: "melee",
    type_degats: "contondant",
    type_arme: "main_nue",
    famille_arme: "main_nue",
    degats: dmg.raw,
    "dégâts": { contre_moyen: dmg.moyen, contre_grand: dmg.grand },
    bonus_hit: 0,
    bonus_dom: 0,
    facteur_rapidité: 1,
    portee_courte: 0,
    portee_moyenne: 0,
    portee_longue: 0,
    tags: ["arme", "arme:main_nue", "type_arme:main_nue", "famille_arme:main_nue", "usage:corps_a_corps", "degat:contondant", "combat:mains_nues", "classe:moine"],
    effectTags: ["arme", "arme:main_nue", "type_arme:main_nue", "usage:corps_a_corps", "degat:contondant", "classe:moine"],
    add2eAutoCreated: true,
    sourceClasse: "moine",
    sourceCapacite: "main_nue_moine"
  };

  await actor.update({
    "system.moine.main_nue": dmg.raw,
    "system.moine.main_nue_contre_moyen": dmg.moyen,
    "system.moine.main_nue_contre_grand": dmg.grand
  }, { add2eInternal: true });

  if (existing.length) {
    const [first, ...duplicates] = existing;
    await actor.updateEmbeddedDocuments("Item", [{ _id: first.id, name: "Main nue", img: first.img || "icons/svg/fist.svg", system }]);
    if (duplicates.length) await actor.deleteEmbeddedDocuments("Item", duplicates.map(i => i.id));
  } else {
    await actor.createEmbeddedDocuments("Item", [{ type: "arme", name: "Main nue", img: "icons/svg/fist.svg", system, flags: { add2e: { autoCreated: true, sourceClasse: "moine", sourceCapacite: "main_nue_moine" } } }]);
  }
  return true;
}

globalThis.add2eSyncMonkUnarmedWeapon = add2eSyncMonkUnarmedWeapon;


function add2eGetRaceTagsForLevelCap(actor) {
  const tags = new Set();
  const push = (value) => {
    const tag = add2eNormalizeEquipTag(value);
    if (tag) tags.add(tag);
  };
  const pushArray = (value) => {
    if (Array.isArray(value)) value.forEach(push);
    else if (value && typeof value === "object") Object.values(value).forEach(pushArray);
    else push(value);
  };

  const raceItems = actor?.items?.filter?.(i => i.type === "race") ?? [];
  for (const race of raceItems) {
    push(`race:${race.system?.slug || race.name}`);
    pushArray(race.system?.tags);
    pushArray(race.system?.identityTags);
  }

  const details = actor?.system?.details_race ?? {};
  push(`race:${details.slug || details.label || details.name || actor?.system?.race || ""}`);
  pushArray(details.tags);
  pushArray(details.identityTags);
  push(`race:${actor?.system?.race || ""}`);

  return tags;
}

function add2eGetClassMaxLevelForActor(actor, classSystem = null) {
  const cls = classSystem ?? add2eGetActorClassSystem(actor);
  if (!cls || typeof cls !== "object") return null;

  const progression = Array.isArray(cls.progression) ? cls.progression : [];
  const progressionMax = progression
    .map((row, index) => Number(row?.niveau ?? row?.level ?? index + 1) || 0)
    .filter(n => Number.isFinite(n) && n > 0)
    .reduce((max, n) => Math.max(max, n), 0);

  let maxLevel = progressionMax > 0 ? progressionMax : null;

  const raceRules = cls.raceRestriction?.races;
  if (raceRules && typeof raceRules === "object") {
    const raceTags = add2eGetRaceTagsForLevelCap(actor);
    for (const [rawTag, rule] of Object.entries(raceRules)) {
      const tag = add2eNormalizeEquipTag(rawTag);
      if (!tag || !raceTags.has(tag) || rule?.allowed === false) continue;
      const raceMax = Number(rule?.maxLevel ?? rule?.niveauMax ?? rule?.max);
      if (Number.isFinite(raceMax) && raceMax > 0) {
        maxLevel = maxLevel ? Math.min(maxLevel, raceMax) : raceMax;
      }
    }
  }

  return Number.isFinite(maxLevel) && maxLevel > 0 ? Math.floor(maxLevel) : null;
}

function add2eClampLevelToClassMax(actor, desiredLevel, classSystem = null, { notify = false } = {}) {
  const minLevel = 1;
  let level = Math.max(minLevel, Number.parseInt(desiredLevel, 10) || minLevel);
  const maxLevel = add2eGetClassMaxLevelForActor(actor, classSystem);

  if (maxLevel && level > maxLevel) {
    if (notify) {
      const clsName = classSystem?.label || classSystem?.name || classSystem?.nom || actor?.system?.classe || "cette classe";
      ui.notifications.warn(`${clsName} est limité au niveau ${maxLevel}. Niveau ramené à ${maxLevel}.`);
    }
    return { level: maxLevel, maxLevel, changed: true, original: level };
  }

  return { level, maxLevel, changed: false, original: level };
}

async function add2eClampActorLevelToClassMax(actor, classSystem = null, options = {}) {
  if (!actor || actor.type !== "personnage") return null;
  const clamp = add2eClampLevelToClassMax(actor, actor.system?.niveau, classSystem, options);
  if (clamp.changed) {
    await actor.update({ "system.niveau": clamp.level }, { add2eInternal: true });
    actor.sheet?.render?.(false);
  }
  return clamp;
}

globalThis.add2eGetClassMaxLevelForActor = add2eGetClassMaxLevelForActor;
globalThis.add2eClampActorLevelToClassMax = add2eClampActorLevelToClassMax;


// Anti-réentrée pour le recalcul auto des caracs
const ACTIVE_CARAC_AUTO = new Set();

// =======================
//  HOOK UNIQUE updateActor
// =======================
Hooks.on("updateActor", async (actor, changes, options, userId) => {
  // 0. Anti-boucle pour la synchro (tokens / socket)
  if (options?._fromSync) {
    console.log(
      `[SYNC][SKIP] Boucle évitée (flag _fromSync) pour`,
      actor?.name || actor?.id || "???"
    );
    return;
  }

  // 0.1. Anti-spam ABSOLU : si les seuls "changements" sont l'_id, on IGNORE TOUT
  const changeKeys = Object.keys(changes ?? {});
  if (changeKeys.length === 1 && changeKeys[0] === "_id") {
    // Si tu veux vérifier que ça passe bien ici, décommente la ligne suivante :
    // console.debug("[SYNC][SKIP] updateActor ignoré (_id seul) pour", actor?.name || actor?.id || "???");
    return;
  }

  // À partir d'ici, on est sûr que ce n'est PAS un update “vide”
  console.log(
    `[SYNC][HOOK] updateActor déclenché pour :`,
    actor?.name || actor?.id || "???",
    "(ID:", actor?.id || "???", ") | changes :",
    changes
  );

  // =====================================================
  // 0) Garde anti-boucle + gestion PV au changement de niveau
  // =====================================================
  if (options?.add2eInternal) return;

  // Niveau maximum : si la classe possède une progression limitée, on ramène immédiatement au niveau max réel.
  if (changes?.system && Object.prototype.hasOwnProperty.call(changes.system, "niveau")) {
    const clamp = add2eClampLevelToClassMax(actor, changes.system.niveau, null, { notify: true });
    if (clamp.changed) {
      console.warn("[ADD2E][NIVEAU][MAX] Niveau supérieur au maximum de classe : correction automatique", {
        actor: actor?.name,
        niveauDemande: clamp.original,
        niveauMax: clamp.maxLevel,
        niveauApplique: clamp.level
      });
      await actor.update({ "system.niveau": clamp.level }, { add2eInternal: true });
      changes.system.niveau = clamp.level;
    }
  }

  // Au changement de niveau : on recalcule PV max (system.points_de_coup) et on aligne PV courant (system.pdv)
  if (changes?.system && Object.prototype.hasOwnProperty.call(changes.system, "niveau")) {
    const lvl = Number(changes.system.niveau) || Number(actor.system?.niveau) || 1;

    try {
      console.log(`[ADD2E][HP] Changement de niveau détecté -> recalcul PV max + PV courant (niveau=${lvl})`, { actor: actor?.name });

      // Priorité : si la feuille fournit la méthode, on l'utilise (même logique que drop classe)
      if (actor.sheet?.autoSetPointsDeCoup) {
        await actor.sheet.autoSetPointsDeCoup({ syncCurrent: true, force: true, reason: "level-change" });
      } else {
        // Fallback minimal (si la feuille n'est pas instanciée)
        const classeItem = actor.items?.find(i => i.type === "classe");
        const prog = classeItem?.system?.progression;
        const hpMax = Array.isArray(prog) && prog[lvl - 1] && prog[lvl - 1].pdv !== undefined ? Number(prog[lvl - 1].pdv) : NaN;
        if (Number.isFinite(hpMax) && hpMax > 0) {
          await actor.update({ "system.points_de_coup": hpMax, "system.pdv": hpMax }, { add2eInternal: true });
        }
      }
    } catch (e) {
      console.warn("[ADD2E][HP] Erreur recalcul PV au changement de niveau :", e);
    }
    try {
      await add2eSyncMonkUnarmedWeapon(actor);
    } catch (e) {
      console.warn("[ADD2E][MOINE] Erreur synchronisation Main nue au changement de niveau :", e);
    }

    try {
      await add2eSyncNewSpellLevelsAfterActorLevelChange(actor, lvl);
    } catch (e) {
      console.error("[ADD2E][LEVEL_SPELL_SYNC] Erreur import / nettoyage des sorts au changement de niveau :", {
        actor: actor?.name,
        niveau: lvl,
        err: e
      });
      ui.notifications.error("Erreur pendant la synchronisation des sorts au changement de niveau. Voir la console.");
    }
  }



  // =====================================================
  // 1) Auto-save & recalcul des bonus caracs (PATCH anti-bug)
  // =====================================================
  try {
    if (actor.type === "personnage" && changes.system) {
let caracChanged = false;

      // On évite les re-entrées infinies sur le même acteur
      if (caracChanged && !ACTIVE_CARAC_AUTO.has(actor.id)) {
        ACTIVE_CARAC_AUTO.add(actor.id);
        try {
          if (typeof actor.sheet?.autoSetCaracAjustements === "function") {
            await actor.sheet.autoSetCaracAjustements();
          } else if (typeof actor.autoSetCaracAjustements === "function") {
            await actor.autoSetCaracAjustements();
          }
          console.log("[CARAC] autoSetCaracAjustements exécuté pour", actor.name);
          // Forcer le refresh de la fiche si elle est ouverte (sinon les readonly restent visuellement figés)
        if (actor.sheet?.rendered) actor.sheet.render(false);

        } finally {
          ACTIVE_CARAC_AUTO.delete(actor.id);
        }
      }
    }
  } catch (e) {
    console.warn("[CARAC] Erreur auto-set ajustements caracs :", e);
  }

  // =====================================================
  // 2) Gestion auto des états INCONSCIENT / MORT (PV)
  // =====================================================
  try {
    // Seul le MJ actif gère les états
    if (game.user.isGM && game.user.id === game.users.activeGM?.id) {
      const HP_PATHS = ["system.points_de_coup", "system.pdv"];
      let hpPathChanged = null;

      for (const path of HP_PATHS) {
        if (foundry.utils.hasProperty(changes, path)) {
          hpPathChanged = path;
          break;
        }
      }

      if (hpPathChanged) {
        const newHP = Number(foundry.utils.getProperty(actor, hpPathChanged) ?? 0);

        const DEAD_STATUS        = "dead";
        const UNCONSCIOUS_STATUS = "unconscious";

        if (newHP <= -11) {
          // Mort : overlay "dead"
          await actor.toggleStatusEffect(UNCONSCIOUS_STATUS, { active: false, overlay: false });
          await actor.toggleStatusEffect(DEAD_STATUS,        { active: true,  overlay: true  });
          console.log("[HP-STATE] Overlay auto -> MORT pour", actor.name);
        } else if (newHP <= 0) {
          // Inconscient : overlay "unconscious"
          await actor.toggleStatusEffect(DEAD_STATUS,        { active: false, overlay: false });
          await actor.toggleStatusEffect(UNCONSCIOUS_STATUS, { active: true,  overlay: true  });
          console.log("[HP-STATE] Overlay auto -> INCONSCIENT pour", actor.name);
        } else {
          // PV > 0 : on enlève tout
          await actor.toggleStatusEffect(DEAD_STATUS,        { active: false, overlay: false });
          await actor.toggleStatusEffect(UNCONSCIOUS_STATUS, { active: false, overlay: false });
          console.log("[HP-STATE] Nettoyage auto des états HP pour", actor.name);
        }
      }
    }
  } catch (e) {
    console.warn("[HP-STATE] Erreur auto-gestion états HP :", e);
  }

  // =====================================================
  // 3) Synchronisation des tokens liés
  //    → Pour les tokens LIÉS, Foundry synchronise déjà.
  //      On ne refait PAS de actor.update() ici.
  // =====================================================
  try {
    const tokens = actor.getDependentTokens?.({ linked: true }) || [];
    if (!tokens.length) {
      console.log(
        `[SYNC] Aucun token lié trouvé pour`,
        actor?.name || actor?.id || "???",
        "."
      );
      return;
    }

    console.log(
      `[SYNC] Tokens liés détectés pour`,
      actor?.name || actor?.id || "???",
      `(${tokens.length} token(s)). Pas de resync manuelle (Foundry gère déjà).`
    );

    // Surtout NE PAS faire de tokenDoc.actor.update(...) ici.
  } catch (e) {
    console.warn("[SYNC] Erreur lors du traitement des tokens liés :", e);
  }
});

// ===============================
// TABLES AJUSTEMENTS CARACTÉRISTIQUES
// ===============================
const FORCE_TABLE = {
  3:   { toucher: -3, degats: -1, poids: -350, ouvrir: "1", tordre: "0%" },
  4:   { toucher: -2, degats: -1, poids: -250, ouvrir: "1", tordre: "0%" },
  5:   { toucher: -2, degats: -1, poids: -250, ouvrir: "1", tordre: "0%" },
  6:   { toucher: -1, degats: 0,  poids: -150, ouvrir: "1", tordre: "0%" },
  7:   { toucher: -1, degats: 0,  poids: -150, ouvrir: "1", tordre: "0%" },
  8:   { toucher:  0, degats: 0,  poids: 0,    ouvrir: "1-2", tordre: "1%" },
  9:   { toucher:  0, degats: 0,  poids: 0,    ouvrir: "1-2", tordre: "1%" },
  10:  { toucher:  0, degats: 0,  poids: 0,    ouvrir: "1-2", tordre: "2%" },
  11:  { toucher:  0, degats: 0,  poids: 0,    ouvrir: "1-2", tordre: "2%" },
  12:  { toucher:  0, degats: 0,  poids: 100,  ouvrir: "1-2", tordre: "4%" },
  13:  { toucher:  0, degats: 0,  poids: 100,  ouvrir: "1-2", tordre: "4%" },
  14:  { toucher:  0, degats: 0,  poids: 200,  ouvrir: "1-2", tordre: "7%" },
  15:  { toucher:  0, degats: 0,  poids: 200,  ouvrir: "1-2", tordre: "7%" },
  16:  { toucher:  0, degats: 1,  poids: 350,  ouvrir: "1-3", tordre: "10%" },
  17:  { toucher:  1, degats: 1,  poids: 500,  ouvrir: "1-3", tordre: "13%" },
  18:  { toucher:  1, degats: 2,  poids: 750,  ouvrir: "1-3", tordre: "16%" },
  "18/01-50": { toucher: 1, degats: 3, poids: 1000, ouvrir: "1-3", tordre: "20%" },
  "18/51-75": { toucher: 2, degats: 3, poids: 1250, ouvrir: "1-4", tordre: "25%" },
  "18/76-90": { toucher: 2, degats: 4, poids: 1500, ouvrir: "1-4", tordre: "30%" },
  "18/91-99": { toucher: 2, degats: 5, poids: 2000, ouvrir: "1-4 (1)", tordre: "35%" },
  "18/00":    { toucher: 3, degats: 6, poids: 3000, ouvrir: "1-5 (2)", tordre: "40%" }
};
const INTELLIGENCE_TABLE = {3:{langues:0,chance_sort:0,min_sort:0,max_sort:0},4:{langues:0,chance_sort:0,min_sort:0,max_sort:0},5:{langues:0,chance_sort:0,min_sort:0,max_sort:0},6:{langues:0,chance_sort:0,min_sort:0,max_sort:0},7:{langues:0,chance_sort:0,min_sort:0,max_sort:0},8:{langues:1,chance_sort:0,min_sort:0,max_sort:0},9:{langues:1,chance_sort:35,min_sort:4,max_sort:6},10:{langues:2,chance_sort:45,min_sort:5,max_sort:7},11:{langues:2,chance_sort:45,min_sort:5,max_sort:7},12:{langues:3,chance_sort:45,min_sort:5,max_sort:7},13:{langues:3,chance_sort:55,min_sort:6,max_sort:9},14:{langues:4,chance_sort:55,min_sort:6,max_sort:9},15:{langues:4,chance_sort:65,min_sort:7,max_sort:11},16:{langues:5,chance_sort:65,min_sort:7,max_sort:11},17:{langues:6,chance_sort:75,min_sort:8,max_sort:14},18:{langues:7,chance_sort:85,min_sort:9,max_sort:18}}; // eslint-disable-line
const SAGESSE_TABLE = {3:{magie:-3,sort_suppl:0,echec:80},4:{magie:-2,sort_suppl:0,echec:75},5:{magie:-1,sort_suppl:0,echec:70},6:{magie:-1,sort_suppl:0,echec:65},7:{magie:-1,sort_suppl:0,echec:60},8:{magie:0,sort_suppl:0,echec:55},9:{magie:0,sort_suppl:0,echec:20},10:{magie:0,sort_suppl:0,echec:15},11:{magie:0,sort_suppl:0,echec:10},12:{magie:0,sort_suppl:0,echec:5},13:{magie:0,sort_suppl:1,echec:0},14:{magie:0,sort_suppl:2,echec:0},15:{magie:0,sort_suppl:2,echec:0},16:{magie:0,sort_suppl:2,echec:0},17:{magie:0,sort_suppl:3,echec:0},18:{magie:0,sort_suppl:4,echec:0}}; // eslint-disable-line
const DEXTERITE_TABLE = {3:{att:-3,def:+4},4:{att:-2,def:+3},5:{att:-1,def:+2},6:{att:0,def:+1},7:{att:0,def:0},8:{att:0,def:0},9:{att:0,def:0},10:{att:0,def:0},11:{att:0,def:0},12:{att:0,def:0},13:{att:0,def:0},14:{att:0,def:-1},15:{att:0,def:-1},16:{att:+1,def:-2},17:{att:+2,def:-3},18:{att:+3,def:-4}}; // eslint-disable-line
const CONSTITUTION_TABLE = {3:{pv:-2,trauma:35,resu:40},4:{pv:-1,trauma:40,resu:45},5:{pv:-1,trauma:45,resu:50},6:{pv:-1,trauma:50,resu:55},7:{pv:0,trauma:55,resu:60},8:{pv:0,trauma:60,resu:65},9:{pv:0,trauma:65,resu:70},10:{pv:0,trauma:70,resu:75},11:{pv:0,trauma:75,resu:80},12:{pv:0,trauma:80,resu:85},13:{pv:0,trauma:85,resu:90},14:{pv:0,trauma:88,resu:92},15:{pv:+1,trauma:91,resu:94},16:{pv:+2,trauma:95,resu:96},17:{pv:+2,trauma:97,resu:98},18:{pv:+2,trauma:99,resu:100}}; // eslint-disable-line
const CHARISME_TABLE = {3:{compagnons:1,loy:-30,react:-25},4:{compagnons:1,loy:-25,react:-20},5:{compagnons:2,loy:-20,react:-15},6:{compagnons:2,loy:-15,react:-10},7:{compagnons:3,loy:-10,react:-5},8:{compagnons:3,loy:-5,react:0},9:{compagnons:4,loy:0,react:0},10:{compagnons:4,loy:0,react:0},11:{compagnons:4,loy:0,react:0},12:{compagnons:5,loy:0,react:0},13:{compagnons:6,loy:+5,react:5},14:{compagnons:7,loy:+10,react:10},15:{compagnons:8,loy:+15,react:15},16:{compagnons:9,loy:+20,react:25},17:{compagnons:10,loy:+30,react:30},18:{compagnons:15,loy:+40,react:35}}; // eslint-disable-line

async function consommerSortMemorise(actor, nomSort, niveau = 1) {
  // Ex: stockage classique: actor.system.memorized[1]['Sommeil'] = 2
  let chemin = `system.memorized.${niveau}.${nomSort}`;
  let nb = foundry.utils.getProperty(actor, chemin) ?? 0;
  if (nb > 0) {
    await actor.update({ [chemin]: nb - 1 });
    ui.notifications.info(`${nomSort} (niv.${niveau}) consommé pour ${actor.name} (${nb - 1} restants)`);
  } else {
    ui.notifications.warn(`${actor.name} n'a plus de ${nomSort} (niv.${niveau}) mémorisé !`);
  }
}

// Fonction utilitaire à placer une fois dans ton script
async function majImageToken(actor, newImg) {
  // Vérifie si c'est bien un ActorDocument
  if (!actor || typeof actor.update !== "function") return;
  // Patch à la fois token.img et prototypeToken.texture.src (pour compatibilité tous Foundry)
  let maj = {
    img: newImg,
    "token.img": newImg,
    "prototypeToken.texture.src": newImg
  };
  await actor.update(maj);
}
async function triInitiativeAscendant() {
  if (!game.combat) return;
  const sortedCombatants = game.combat.combatants.contents.slice().sort((a, b) => {
    if (a.initiative == null && b.initiative == null) return 0;
    if (a.initiative == null) return 1;
    if (b.initiative == null) return -1;
    return a.initiative - b.initiative;
  });
  await game.combat.updateEmbeddedDocuments("Combatant",
    sortedCombatants.map((c, i) => ({ _id: c.id, sort: i }))
  );
  ui.combat.render(true);
}

// Appelé à chaque changement d'initiative d'un combattant
Hooks.on("updateCombatant", async (combatant, changes, diff, userId) => {
  if (changes.initiative !== undefined) {
    // On attend que tous les changements soient faits (cas des rollAll, etc.)
    setTimeout(() => {
      triInitiativeAscendant();
    }, 100); // petit délai pour éviter le conflit avec Foundry
  }
});

// Appelé à chaque changement général du combat (parfois Foundry retrie ici !)
Hooks.on("updateCombat", async (combat, changes, diff, userId) => {
  setTimeout(() => {
    triInitiativeAscendant();
  }, 100); // délai pour éviter la course
});

// Convertit une plage de type "2-8" en formule Roll "1d7+1"
function plageToRollFormula(plage) {
  if (typeof plage !== "string") return plage;
  const match = plage.match(/^(\d+)\s*-\s*(\d+)$/);
  if (!match) return plage;
  const min = Number(match[1]);
  const max = Number(match[2]);
  if (isNaN(min) || isNaN(max) || max <= min) return plage;
  const faces = max - min + 1;
  const bonus = min - 1;
  return `1d${faces}` + (bonus > 0 ? `+${bonus}` : "");
}

// ========== FONCTION ROLL HP ==============
function rollHitDice(hdString) {
  if (!hdString) return 0;
  const match = hdString.match(/^(\d+)d(\d+)(?:\s*\+\s*(\d+))?$/i);
  if (!match) return 0;
  const nb = Number(match[1]);
  const faces = Number(match[2]);
  const bonus = Number(match[3] || 0);
  let total = 0;
  for (let i = 0; i < nb; i++) total += Math.floor(Math.random() * faces) + 1;
  total += bonus;
  return total;
}
// =========================================================
// GROS BLOC "READY" UNIQUE (A coller une seule fois)
// =========================================================
Hooks.once("ready", () => {
  console.log("ADD2E | Ready Hook - start");

  // =========================================================
  // [ADD2E][SPELLCASTING] ASSURE actor.system.spellcasting
  // Source STRICTE (JSON) : item "classe" embarqué sur l'acteur
  // -> classItem.system.spellcasting
  // AUCUNE déduction par nom de classe, aucun fallback else.
  // =========================================================
  (async () => {
    try {
      if (!game.user.isGM) {
        console.log("[ADD2E][SPELLCASTING] SKIP (not GM)");
        return;
      }

      console.log("%c[ADD2E][SPELLCASTING] ready assure start", "color:#8e44ad;font-weight:bold;");

      const actors = game.actors?.contents || [];
      console.log("[ADD2E][SPELLCASTING] actors count =", actors.length);

      for (const actor of actors) {
        const current = actor.system?.spellcasting;

        // Log état initial
        console.log("[ADD2E][SPELLCASTING] actor state", {
          id: actor.id,
          name: actor.name,
          currentSpellcasting: current
        });

        // Si déjà présent => on ne touche pas
        if (current !== undefined && current !== null) {
          console.log("[ADD2E][SPELLCASTING] OK (already present)", { id: actor.id, name: actor.name });
          continue;
        }

        // Source stricte : item "classe"
        const classItem = actor.items?.find(i => i.type === "classe") || null;
        const scFromClass = classItem?.system?.spellcasting ?? null;

        console.log("[ADD2E][SPELLCASTING] classItem", classItem ? {
          id: classItem.id,
          name: classItem.name,
          hasSpellcasting: !!scFromClass
        } : null);

        console.log("[ADD2E][SPELLCASTING] scFromClass(raw) =", scFromClass);

        if (!scFromClass || typeof scFromClass !== "object") {
          console.warn("[ADD2E][SPELLCASTING] SKIP (no classItem.system.spellcasting)", {
            actorId: actor.id,
            actorName: actor.name,
            classItem: classItem ? { id: classItem.id, name: classItem.name } : null
          });
          continue;
        }

        if (!Array.isArray(scFromClass.lists) || scFromClass.lists.length === 0) {
          console.warn("[ADD2E][SPELLCASTING] SKIP (invalid spellcasting.lists)", {
            actorId: actor.id,
            actorName: actor.name,
            lists: scFromClass.lists
          });
          continue;
        }

        const patchValue = foundry.utils.duplicate(scFromClass);
        console.log("[ADD2E][SPELLCASTING] PATCH apply", {
          actorId: actor.id,
          actorName: actor.name,
          patchValue
        });

        await actor.update({ "system.spellcasting": patchValue });

        console.log("%c[ADD2E][SPELLCASTING] PATCH OK", "color:#27ae60;font-weight:bold;", {
          actorId: actor.id,
          actorName: actor.name,
          spellcastingNow: actor.system?.spellcasting
        });
      }

      console.log("%c[ADD2E][SPELLCASTING] ready assure end", "color:#8e44ad;font-weight:bold;");
    } catch (e) {
      console.error("[ADD2E][SPELLCASTING] ready assure ERROR:", e);
    }
  })();

  // --- le reste de TON ready hook peut rester inchangé en dessous ---
});

// ========== CLASSE ROLLER CLICK-TO-ASSIGN ==========
class Add2eCaracRoller {
  constructor(sheet) {
    this.sheet = sheet;
    this.values = [];
    this.used = {};
    this.assigned = {};
    this.selectedIdx = null;
    this._dlgHtml = null;
    this.dialogRef = null;
    // Save the old base values for rollback
    this._oldValues = {};
    for (const c of CARACS) {
      this._oldValues[c] = sheet.actor.system[`${c}_base`];
    }
    this.render();
  }
  static rollCarac() {
    let rolls = [];
    for (let i = 0; i < 4; i++) rolls.push(Math.floor(Math.random() * 6) + 1);
    rolls.sort((a, b) => b - a);
    return rolls[0] + rolls[1] + rolls[2];
  }

  async render() {
  this.values = [];
  this.used = {};
  this.assigned = {};
  this.selectedIdx = null;
  let rolls = [];
  for (let i = 0; i < 7; i++) rolls.push(Add2eCaracRoller.rollCarac());
  rolls.sort((a, b) => b - a);
  this.values = rolls.slice(0, 6);

  // Génère le HTML du popup, mais laisse la zone guide vide (sera remplie dynamiquement)
  let html = `
    <style>
      .add2e-carac-popup { font-family: var(--font-primary); }
      .add2e-carac-values { display: flex; gap: 0.7em; justify-content: center; margin-bottom: 1em; }
      .add2e-carac-value { background: #e8d4b0; border-radius: 8px; padding: 0.5em 1em; font-size:1.3em; font-weight:bold; cursor: pointer; box-shadow: 0 2px 6px #0001; text-align:center; min-width:2.9em;}
      .add2e-carac-value.used { opacity: 0.55; background: #bbb; cursor: not-allowed;}
      .add2e-carac-value.selected { outline: 3px solid #8e44ad; background: #ffeaa7;}
      .add2e-carac-help { font-size: 0.97em; color: #88704b; text-align: center; margin-bottom: 1em;}
      .add2e-carac-apply { text-align: center; margin-top: 1em; }
      .add2e-carac-apply button { padding: 0.5em 1.3em; font-size: 1em; background: #8e44ad; color: #fff; border: none; border-radius: 6px; cursor: pointer;}
      .assigned-label { font-size: 0.85em; color: #164a1b; margin-top: 0.3em; display: block; font-weight: 500;}
      ul.class-short {margin:0.5em 0 0.2em 1em;padding-left:0.6em;}
      ul.class-short li {margin-bottom:0.1em;}
      .class-short .c {font-weight:bold;color:#6a3c99;}
      .class-short .carac {font-weight:bold;color:#194;}
    </style>
    <div class="add2e-carac-popup">
      <div class="add2e-carac-help">
        Cliquez sur une valeur, puis sur une caractéristique à assigner.<br>
        <b>Astuce :</b> Cliquez sur une carac déjà affectée pour la remplacer.
      </div>
      <div class="add2e-carac-values">
        ${this.values.map((v, i) => {
          let caracAffectee = Object.entries(this.assigned).find(([_, idx]) => idx === i);
          let short = caracAffectee ? caracAffectee[0].slice(0,3).toUpperCase() : "—";
          return `
            <div class="add2e-carac-value${this.used[i] ? ' used' : ''}" data-idx="${i}">
              ${v}
              <div class="assigned-label">${short}</div>
            </div>`;
        }).join("")}
      </div>
      <div id="classes-suggestions" style="margin:0.6em 0 0.1em 0.1em;"></div>
      <div class="add2e-carac-apply">
        <button class="apply-caracs-btn">Valider</button>
      </div>
    </div>
  `;

  let dialogRef = new Dialog({
    title: "Tirage des caractéristiques",
    content: html,
    render: dlgHtml => {
      this._dlgHtml = dlgHtml;
      this._setupClickHandlers();
      if (this.sheet) this.sheet._enableCaracClickAssign(this);
      this._updateCaracDisplay();
dlgHtml.find('.apply-caracs-btn').on('click', async ev => {
  const caracList = CARACS;
  if (!caracList.every(c => this.assigned[c] !== undefined)) {
    ui.notifications.warn("Toutes les caractéristiques doivent être affectées !");
    return;
  }

  // 1. Prépare les updates ET vérifie s’il y a des caracs > 18
  let updates = {};
  let overflows = [];
  for (let carac of caracList) {
    let idx = this.assigned[carac];
    if (typeof idx !== "undefined") {
      const base = this.values[idx];
      const bonusRacial = this.sheet.actor.system[`${carac}_race`] || 0;
      const total = base + bonusRacial;
      updates[`system.${carac}_base`] = base;
      if (total > 18) {
        overflows.push({
          carac,
          base,
          bonusRacial,
          total
        });
      }
    }
  }

  // 2. S’il y a des débordements, on confirme
  if (overflows.length) {
    let caracsTxt = overflows.map(o =>
      `<li><b>${CARAC_SHORT[o.carac]}</b> : base ${o.base} + bonus racial ${o.bonusRacial} = <span style="color:#e74c3c;font-weight:bold;">${o.total}</span> <b>→ 18</b></li>`
    ).join("");
    const confirmed = await Dialog.confirm({
      title: "Caractéristique supérieure à 18",
      content: `<p>Une ou plusieurs caractéristiques dépassent 18 après bonus racial.<br>
      Elles seront ramenées à 18 :</p><ul>${caracsTxt}</ul>
      <p>Confirmez-vous l’assignation ?</p>`,
      yes: () => true,
      no: () => false,
      defaultYes: true
    });
    if (!confirmed) return;
    // Applique le cap à 18
    for (let o of overflows) {
      // On baisse la base pour que base + bonus == 18
      let cappedBase = 18 - o.bonusRacial;
      updates[`system.${o.carac}_base`] = Math.max(3, cappedBase); // Jamais <3
    }
  }

  // 3. Applique les updates
  await this.sheet.actor.update(updates);
  await this.sheet.actor.setFlag("add2e", "base_caracs", updates);
  if (typeof this.sheet.autoSetCaracAjustements === "function") {
    await this.sheet.autoSetCaracAjustements();
  }
  await this.sheet.render(false);
  ui.notifications.info("Affectation terminée !");
  dlgHtml.closest('.window-app').remove();
});


    },
    close: () => { this._restoreOldCaracs(); },
    buttons: { cancel: { label: "Annuler" } },
    default: "cancel"
  }, { width: 480, height: "auto" });

  dialogRef.render(true);
  this.dialogRef = dialogRef;

  // Affichage synthétique des classes accessibles (remplit la div juste après affichage)
  this.classesSynthese().then(synth => {
    if (this._dlgHtml) this._dlgHtml.find('#classes-suggestions').html(synth);
  });

  // Force la popup à l’avant-plan
  setTimeout(() => {
    const dialogEl = document.querySelector('.window-app.dialog');
    if (dialogEl && dialogEl.querySelector('.add2e-carac-popup')) {
      dialogEl.style.zIndex = 9999;
    }
  }, 60);
}

  _setupClickHandlers() {
    this._dlgHtml.find('.add2e-carac-value').off('click').on('click', ev => {
      const idx = Number(ev.currentTarget.dataset.idx);
      if (this.used[idx]) return;
      this.selectedIdx = idx;
      this._dlgHtml.find('.add2e-carac-value').removeClass('selected');
      $(ev.currentTarget).addClass('selected');
      $('.carac-drop-target').addClass('assignable');
    });
  }

  // Affichage synthétique des classes accessibles selon la répartition possible des valeurs
async classesSynthese() {
  let classes = game.items.filter(i => i.type === "classe");

  // Si aucune classe dans le monde, charge depuis le compendium
  if (!classes.length) {
    const pack = game.packs.get("add2e.classes");
    if (!pack) {
      console.error("[ADD2e] Compendium 'add2e.classes' introuvable !");
      return "<em>Compendium des classes introuvable.</em>";
    }
    const content = await pack.getDocuments();
    classes = content.filter(i => i.type === "classe");
  }

  if (!classes.length) return "<em>Aucune classe trouvée</em>";

  const values = [...this.values].sort((a, b) => b - a); // scores décroissants
  const caracShort = { force:'FOR', dexterite:'DEX', constitution:'CON', intelligence:'INT', sagesse:'SAG', charisme:'CHA' };
  let html = '<div style="margin:0.6em 0 0.2em 0.1em;font-size:1.05em;"><b>Classes accessibles et valeur à placer :</b></div>';
  html += '<ul style="padding-left:1.1em;line-height:1.5em;font-size:1.05em;">';

  for (const cls of classes) {
    const caracsMin = cls.system.caracs_min || {};
    const requis = Object.entries(caracsMin);

    let valeursDisponibles = [...values];
    let match = true;
    let caracPlacements = [];

    for (let [carac, min] of requis) {
      const idx = valeursDisponibles.findIndex(val => val >= min);
      if (idx === -1) {
        match = false;
        break;
      }
      const val = valeursDisponibles[idx];
      caracPlacements.push(`<b>${caracShort[carac] || carac}</b> <span style="color:#219150;font-weight:bold">${val}</span>`);
      valeursDisponibles.splice(idx, 1); // empêche la réutilisation
    }

    if (match) {
      html += `<li><b style="color:#6a3c99">${cls.name}</b> : ${caracPlacements.join(', ')}</li>`;
    }
  }

  html += '</ul>';
  return html;
}



assignToCarac(caracName) {
  if (this.selectedIdx === null) return;
  let idx = this.selectedIdx;
  // Unassign any carac that was already using this value
  if (Object.values(this.assigned).includes(idx)) {
    const prevCarac = Object.keys(this.assigned).find(cn => this.assigned[cn] === idx);
    if (prevCarac) this.unassignCarac(prevCarac);
  }
  // Unassign previous value from caracName
  if (this.assigned[caracName] !== undefined) {
    const prevIdx = this.assigned[caracName];
    delete this.used[prevIdx];
    this._dlgHtml.find(`.add2e-carac-value[data-idx=${prevIdx}]`).removeClass('used');
  }
  this.assigned[caracName] = idx;
  this.used[idx] = caracName;
  this._dlgHtml.find(`.add2e-carac-value[data-idx=${idx}]`).addClass('used');
  this.selectedIdx = null;
  this._dlgHtml.find('.add2e-carac-value').removeClass('selected');
  $('.carac-drop-target').removeClass('assignable');
  this._updateCaracDisplay();
  this._updateAssignLabels();
  if (this._dlgHtml) {
    // Correction ici : appel direct, sans surcouche de texte
    this.classesSynthese().then(html => {
      this._dlgHtml.find('#classes-suggestions').html(html);
    });
  }
  this._setupClickHandlers();
}

unassignCarac(caracName) {
  if (this.assigned[caracName] !== undefined) {
    const idx = this.assigned[caracName];
    delete this.assigned[caracName];
    delete this.used[idx];
    this._dlgHtml.find(`.add2e-carac-value[data-idx=${idx}]`).removeClass('used');
    this._updateCaracDisplay();
    this._updateAssignLabels();
    if (this._dlgHtml) {
      // Correction ici : appel direct, sans surcouche de texte
      this.classesSynthese().then(html => {
        this._dlgHtml.find('#classes-suggestions').html(html);
      });
    }
    this._setupClickHandlers();
  }
}

_updateCaracDisplay() {
  for (const c of CARACS) {
    const el = this.sheet.element.find(`.carac-drop-target[data-carac="${c}"]`);
    const bonusRacial = this.sheet.actor.system[`${c}_race`] || 0;
    let html = '';
    if (this.assigned[c] !== undefined) {
      const base = this.values[this.assigned[c]];
      const total = base + bonusRacial;
      html = `<span style="font-size:1.22em;font-weight:bold;">${total}</span>
        <div style="font-size:0.40em;line-height:1.2em;color:#777;margin-top:1px;">
          <span style="color:#555;">base : </span>${base}<br>
          <span style="color:#555;">bonus : </span><span style="color:${bonusRacial>0?'#1abc9c':'#e74c3c'};">
            ${bonusRacial>0?'+':''}${bonusRacial}
          </span>
        </div>`;
      el.addClass('carac-assigned').html(html);
    } else {
      const base = this._oldValues[c];
      const total = base + bonusRacial;
      html = `<span style="font-size:1.22em;font-weight:bold;">${total}</span>
        <div style="font-size:0.40em;line-height:1.2em;color:#777;margin-top:1px;">
          <span style="color:#555;">base : </span>${base}<br>
          <span style="color:#555;">bonus : </span><span style="color:${bonusRacial>0?'#1abc9c':'#e74c3c'};">
            ${bonusRacial>0?'+':''}${bonusRacial}
          </span>
        </div>`;
      el.removeClass('carac-assigned').html(html);
    }
  }
}


_updateAssignLabels() {
  for (let i = 0; i < this.values.length; i++) {
    let carac = null;
    for (let c of CARACS) {
      if (this.assigned[c] === i) carac = c;
    }
    let txt = carac ? carac.slice(0,3).toUpperCase() : "—";
    let el = this._dlgHtml.find(`.add2e-carac-value[data-idx=${i}] .assigned-label`);
    if (el.length) el.html(txt);
  }
}
async suggestClassesAndPlacements() {
  let classes = game.items.filter(i => i.type === "classe");

  if (!classes.length) {
    const pack = game.packs.get("add2e.classes"); // Vérifie bien l'ID exact
    if (!pack) {
      console.error("[ADD2e] Compendium 'add2e.classes' introuvable !");
      return "<em>Compendium des classes introuvable.</em>";
    }
    const content = await pack.getDocuments();
    classes = content.filter(i => i.type === "classe");
  }
  const caracs = CARACS.reduce((acc, c) => {
    const base = this.assigned[c] !== undefined ? this.values[this.assigned[c]] : 0;
    acc[c] = base + (this.sheet.actor.system[`${c}_race`] || 0);
    return acc;
  }, {});
  // Valeurs non attribuées
  const nonAttribuees = this.values.filter((v, i) => !Object.values(this.assigned).includes(i));
  let suggestions = [];
  for (const cls of classes) {
    const caracsMin = cls.system.caracs_min || {};
    let preReqOk = true, preReqManquantes = [];
    for (let [carac, min] of Object.entries(caracsMin)) {
      const current = caracs[carac] || 0;
      if (current >= min) continue;
      const possible = nonAttribuees.some(val => val >= min);
      if (!possible) preReqOk = false;
      preReqManquantes.push({carac, min, possible});
    }
    // Texte selon situation
    if (Object.keys(caracsMin).length === 0) {
      suggestions.push(`<li><b>${cls.name}</b> : <span style="color:green;">✔️ Pas de prérequis</span></li>`);
    } else if (preReqOk && preReqManquantes.length === 0) {
      suggestions.push(`<li><b style="color:green;">${cls.name}</b> : <span style="color:green;">✔️ Tous les prérequis remplis</span></li>`);
    } else if (preReqOk) {
      // Liste les prérequis à placer
      let txt = preReqManquantes.map(pr =>
        pr.possible
          ? `Placez au moins <b>${pr.min}</b> en <b>${pr.carac.toUpperCase()}</b>`
          : `<span style="color:red">Impossible d’avoir ${pr.min} en ${pr.carac.toUpperCase()}</span>`
      ).join(", ");
      suggestions.push(`<li><b>${cls.name}</b> : ${txt}</li>`);
    } else {
      suggestions.push(`<li style="color:#aaa;"><del>${cls.name}</del> : <span style="color:#aaa;">Prérequis inatteignables avec ce tirage</span></li>`);
    }
  }
  return `<ul style="margin-left:1em;">${suggestions.join("\n")}</ul>`;
}

  _restoreOldCaracs() {
    // Quand on annule ou ferme, on restaure les valeurs initiales
    for (const c of CARACS) {
      this.sheet.actor.update({ [`system.${c}_base`]: this._oldValues[c] });
      // Restaure l'affichage sur la fiche
      this.sheet.element.find(`.carac-drop-target[data-carac="${c}"]`)
        .removeClass('carac-assigned')
        .text(this._oldValues[c]);
    }
  }
}
window.Add2eCaracRoller = Add2eCaracRoller;

// ========== CLASSE PRINCIPALE PERSONNAGE ==========
class Add2eActorSheet extends ActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["add2e", "sheet", "actor", "personnage"],
      template: "systems/add2e/templates/actor/character-sheet.hbs",
      width: 1050,
      height: 900,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "resume" }]
    });
  }

  _add2eGetNativeActiveTab() {
    const tabs = Array.isArray(this._tabs) ? this._tabs : [];
    const primary = tabs.find(t => t?.group === "primary") ?? tabs[0];
    return primary?.active || null;
  }

  _add2eSetNativeActiveTab(tab) {
    if (!tab) return;
    const tabs = Array.isArray(this._tabs) ? this._tabs : [];
    for (const t of tabs) {
      if (t) t.active = tab;
    }
  }

  _onChangeTab(event, tabs, active) {
    super._onChangeTab?.(event, tabs, active);
    if (!active) return;
    this._add2eActiveTab = active;
    this._add2eSetNativeActiveTab(active);
    try {
      sessionStorage.setItem(this._add2eTabStorageKey(), active);
    } catch (e) {}
  }

async getData() {
  const data = await super.getData();
  const sys = data.actor.system;
// =====================================================
// [FIX] SYNCHRONISATION CLASSE DEPUIS L'ITEM RÉEL
// =====================================================
const classItem = data.actor.items.find(i => i.type === "classe") || null;

if (classItem && classItem.system) {
  sys.details_classe = foundry.utils.duplicate(classItem.system);
  sys.classe = classItem.name;
  sys.classe_img = classItem.img;

  // >>> AJOUT CRITIQUE <<<
  sys.spellcasting = foundry.utils.duplicate(classItem.system.spellcasting ?? null);
console.log("[ADD2E][getData] classe=", sys.classe, "niveau=", sys.niveau, "spellcasting=", sys.spellcasting);

} else {
  sys.details_classe = {};
  sys.classe = "";
  sys.classe_img = "";
  sys.spellcasting = null;
}

const spellEntriesForDisplay = add2eGetSpellcastingEntries(data.actor);
data.spellLists = spellEntriesForDisplay.map(e => e.label || add2eSpellLabel(e.key));
data.spellcastingEntries = spellEntriesForDisplay;
data.spellSlotsByPool = add2eGetSpellSlotPoolsByLevel(data.actor);

  // --- Récupération robuste de la race (id OU nom, insensible à la casse) ---
  let raceItem = null;
  let raceKey = sys.race || "";
  let items = data.actor.items ?? [];

  // 1. Par id (meilleure pratique Foundry)
  if (raceKey && items.some(i => i.type === "race" && i.id === raceKey)) {
    raceItem = items.find(i => i.type === "race" && i.id === raceKey);
  }
  // 2. Sinon par nom (legacy, compatibilité)
  if (!raceItem && raceKey) {
    raceItem = items.find(i => i.type === "race" && (i.name || "").toLowerCase() === raceKey.toLowerCase());
  }
  // 3. Fallback sur la première race trouvée
  if (!raceItem) {
    raceItem = items.find(i => i.type === "race") || null;
  }
  if (!raceItem) {
    // Log détaillé : type et nom de chaque item pour diagnostic
    console.warn(
      "[ADD2e debug] AUCUNE RACE TROUVEE pour", raceKey,
      "dans", items.map(i => `${i.name} [${i.type}]`)
    );
    console.warn("[ADD2e debug] raceKey =", raceKey, "| Champ system.race =", sys.race);
  }

  // -- Préparation des capacités raciales --
  let details_race = {};
  if (raceItem && raceItem.system) {
    let rawCaps = raceItem.system.capacites;
    let capacites = [];
    if (Array.isArray(rawCaps)) capacites = rawCaps.filter(c => !!c && typeof c === "string");
    else if (rawCaps && typeof rawCaps === "object") capacites = Object.values(rawCaps).filter(c => !!c && typeof c === "string");
    else capacites = [];
    details_race = {
      nom: raceItem.name || "",
      img: raceItem.img || "",
      bonus_caracteristiques: raceItem.system.bonus_caracteristiques || {},
      capacites: capacites,
      description: raceItem.system.description || "",
      langues: raceItem.system.langues || "",
      movement: raceItem.system.movement !== undefined ? raceItem.system.movement : 0,
      taille: raceItem.system.taille || "",
      âge_debut: raceItem.system["âge_debut"] || "",
      esperance_vie: raceItem.system["espérance_vie"] || "",
      description_longue: raceItem.system.description_longue || "",
      note_md: raceItem.system.note_md || "",
      limites_classes: raceItem.system.limites_classes || {},
      min_caracteristiques: raceItem.system.min_caracteristiques || {},
      max_caracteristiques: raceItem.system.max_caracteristiques || {}
    };
  }
  sys.details_race = details_race;

  sys.movement = details_race.movement || 0;
  data.movement = sys.movement;

  // --- Préparation des capacités spéciales de classe ---
  let details_classe = sys.details_classe || {};
  details_classe.specialAbilities = Array.isArray(details_classe.specialAbilities)
    ? details_classe.specialAbilities
    : (details_classe.specialAbilities ? Object.values(details_classe.specialAbilities) : []);
  sys.details_classe = details_classe;

  for (let c of CARACS) {
    let base = (typeof sys[`${c}_base`] === "number") ? sys[`${c}_base`] : 10;
    let race = (typeof sys[`${c}_race`] === "number") ? sys[`${c}_race`] : 0;
    sys[c] = base + race;
  }
  let classe = (sys.classe || "").toLowerCase();
  let forceLabel = "" + sys.force;
  if (sys.force === 18 && (
    classe.includes("guerrier") ||
    classe.includes("paladin") ||
    classe.includes("ranger")
  )) {
    let forceEx = Number(sys.force_ex || 0);
    let forceExLabel = forceEx === 100 ? "00" : (forceEx < 10 ? "0" + forceEx : "" + forceEx);
    forceLabel = `18/${forceExLabel}`;
    sys.force_label = forceLabel;
  } else {
    sys.force_label = "" + sys.force;
  }
  // Affichage force exceptionnelle (UI)
const classeNorm = String(sys.classe || "")
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f’']/g, "");

data.canExceptionalStrength =
  (Number(sys.force) === 18) &&
  (classeNorm.includes("guerrier") || classeNorm.includes("paladin") || classeNorm.includes("rodeur") || classeNorm.includes("ranger"));

// Valeur par défaut (évite undefined)
if (data.canExceptionalStrength && (sys.force_ex === undefined || sys.force_ex === null)) {
  sys.force_ex = 0;
}

  let niveau = Number(sys.niveau);
  if (!Number.isInteger(niveau) || niveau < 1) niveau = 1;
  if (Array.isArray(sys.niveau)) {
    niveau = Number(sys.niveau.find(x => typeof x === "number" && !isNaN(x))) || 1;
  }
  const progTab = sys.details_classe?.progression || [];
  const progressionCourante = progTab.length >= niveau ? progTab[niveau - 1] : null;
  // =====================================================
// [AJOUT] TITRE DE CLASSE SELON LE NIVEAU (sans redondance)
// =====================================================
if (progressionCourante && typeof progressionCourante.title === "undefined") {
  const titles = sys.details_classe?.titlesByLevel;
  if (Array.isArray(titles) && titles.length) {
    const t = titles.find(x =>
      niveau >= Number(x.minLevel ?? x.niveau ?? 0) &&
      niveau <= Number(x.maxLevel ?? x.niveau ?? 999)
    );
    if (t && (t.title || t.titre)) {
      progressionCourante.title = t.title || t.titre;
    }
  }
  // Fallback propre (facultatif mais évite "undefined" côté HBS)
  if (typeof progressionCourante.title === "undefined") progressionCourante.title = "";
}

 
// =====================================================
// ADD2E — Résolution des spellLists (avec fallback legacy)
// =====================================================
const normalize = v => (v || "").toString().toLowerCase();

const deriveSpellListsFromClasse = (classe) => {
  switch (normalize(classe)) {
    case "clerc":       return ["cleric"];
    case "druide":      return ["cleric"]; // divin (liste prêtre)
    case "magicien":    return ["wizard"];
    case "illusionniste": return ["wizard"];
    default:            return [];
  }
};

const getSortSpellLists = (sort) => {
  if (Array.isArray(sort.system?.spellLists) && sort.system.spellLists.length) {
    return sort.system.spellLists.map(normalize);
  }
  return deriveSpellListsFromClasse(sort.system?.classe);
};

const getActorSpellLists = (actor) => {
  const lists = actor.system?.spellcasting?.lists;
  if (Array.isArray(lists) && lists.length) {
    return lists.map(normalize);
  }
  // fallback legacy : classe principale
  return deriveSpellListsFromClasse(actor.system?.details_classe?.label);
};

const intersects = (a, b) => a.some(x => b.includes(x));

  // PATCH moine : CA naturelle = monkAC progression si moine
  const isMonk = (sys.details_classe?.label || sys.details_classe?.nom || sys.details_classe?.name || "")
    .toLowerCase().normalize("NFD").replace(/[\u0300-\u036f’']/g, '')
    .includes("moine");
  if (isMonk && progressionCourante && typeof progressionCourante.monkAC !== "undefined") {
    sys.ca_naturel = progressionCourante.monkAC;
  }
  data.progressionCourante = progressionCourante;

  // Capacités de classe visibles : uniquement celles débloquées au niveau actuel.
  // Les capacités de niveau supérieur restent dans le JSON pour le moteur, mais ne sont pas affichées.
  const classFeaturesForDisplay = add2eGetActorClassFeatures(this.actor)
    .map((feature, index) => ({ ...feature, __featureIndex: index }))
    .filter(feature => niveau >= add2eFeatureMinLevel(feature) && niveau <= add2eFeatureMaxLevel(feature));

  data.activeClassFeatures = classFeaturesForDisplay.filter(feature => feature.activable === true);
  data.passiveClassFeatures = classFeaturesForDisplay.filter(feature => feature.activable !== true);

  data.listeArmes = items.filter(item => item.type === "arme");
  data.listeArmures = items.filter(item => item.type === "armure");
  data.thiefSkills = add2eGetActorThiefSkills(this.actor, progressionCourante);
// [AJOUT] Récupération de l'équipement divers
    data.listeObjets = items.filter(i => i.type === "objet");

    // Calcul du poids total de l'équipement (Optionnel)
    let poidsTotal = 0;
    data.listeObjets.forEach(o => {
        let qte = Number(o.system.quantite) || 1;
        let pds = Number(o.system.poids) || 0;
        poidsTotal += (qte * pds);
    });
    data.poidsTotalObjets = poidsTotal;
// -- Bloc bonus d'armure, CA, etc. --
  const armure = data.listeArmures.find(i => i.system.equipee && !(i.name.toLowerCase().includes('bouclier') || i.name.toLowerCase().includes('heaume') || i.name.toLowerCase().includes('casque')));
  const bouclier = data.listeArmures.find(i => i.system.equipee && i.name.toLowerCase().includes('bouclier'));
  const heaume = data.listeArmures.find(i => i.system.equipee && (i.name.toLowerCase().includes('heaume') || i.name.toLowerCase().includes('casque')));

  let acArmure = armure ? (Number(armure.system.ac) || 10) : 10;
  let acBouclier = bouclier ? (Number(bouclier.system.ac) || 0) : 0;
  let acHeaume = heaume ? (Number(heaume.system.ac) || 0) : 0;
  
  let bonusAcArmure = armure ? (Number(armure.system.bonus_ac) || 0) : 0;
  let bonusAcBouclier = bouclier ? (Number(bouclier.system.bonus_ac) || 0) : 0;
  let bonusAcHeaume = heaume ? (Number(heaume.system.bonus_ac) || 0) : 0;
  
  let acBase = 10;
  let bonusDex = typeof sys.dex_def === "number" ? sys.dex_def : 0;
  
  sys.armure_equipee = armure || null;
  sys.bouclier_equipe = bouclier || null;
  sys.heaume_equipe = heaume || null;

  // 1. CALCUL CA PHYSIQUE (BASE)
  // --------------------------------------------
  let caPhysique = 10;

  if (isMonk && progressionCourante && typeof progressionCourante.monkAC !== "undefined") {
    // Cas spécial Moine
    caPhysique = progressionCourante.monkAC;
  } else {
    // Si une armure est portée, elle remplace le 10 de base
    let baseDepart = armure ? acArmure : 10;
    caPhysique = baseDepart + bonusDex + bonusAcArmure;
    
    // Application Bouclier et Heaume (réduisent la CA)
    if (bouclier) {
        caPhysique -= acBouclier; 
        caPhysique += bonusAcBouclier;
    }
    if (heaume) {
        caPhysique -= acHeaume; 
        caPhysique += bonusAcHeaume;
    }
  }
  
  // Stockage de la "CA de Base" (Physique) pour l'affichage
  sys.ca_naturel = caPhysique;

  // 2. CALCUL CA TOTALE (MAGIQUE)
  // --------------------------------------------
  let caTotale = caPhysique;

  // Intégration des bonus CA du moteur d'effets (Anneaux, Bâtons, Sorts)
  if (typeof Add2eEffectsEngine !== "undefined") {
    const bonusMagique = Add2eEffectsEngine.getCABonus(this.actor); 
    // Règle AD&D : Un "Bonus" à la CA réduit le score
    if (bonusMagique !== 0) {
      caTotale -= bonusMagique;
    }
  }
  sys.ca_total = caTotale;

  // 3. MISE A JOUR BASE DE DONNÉES (CRITIQUE)
  // --------------------------------------------
  // On ne met à jour que si la valeur a changé pour éviter les boucles infinies
  if (this.actor.system.ca_total !== sys.ca_total) {
      // Utilisation de await si possible, sinon la promesse s'exécute en fond
      this.actor.update({ "system.ca_total": sys.ca_total });
  }

  // 4. CALCULS OFFENSIFS (Reste du code inchangé)
  // --------------------------------------------
  let bonusArmureToucher = 0;
  let bonusArmureDegats = 0;
  if (armure) {
    bonusArmureToucher += Number(armure.system.bonus_toucher || 0);
    bonusArmureDegats += Number(armure.system.bonus_degats || 0);
  }
  if (bouclier) {
    bonusArmureToucher += Number(bouclier.system.bonus_toucher || 0);
    bonusArmureDegats += Number(bouclier.system.bonus_degats || 0);
  }
  if (heaume) {
    bonusArmureToucher += Number(heaume.system.bonus_toucher || 0);
    bonusArmureDegats += Number(heaume.system.bonus_degats || 0);
  }

  const arme = data.listeArmes.find(i => i.system.equipee) || null;
  sys.arme_equipee = arme;

  let thaco = data.progressionCourante?.thac0 || sys.thaco || 20;
  let typeDegats = arme?.system.type_degats || "";
  let armeBonusToucher = arme ? Number(arme.system.bonus_hit || 0) : 0;
  let armeBonusDegats = arme ? Number(arme.system.bonus_dom || 0) : 0;
  let bonusToucher = 0;
  let bonusDegats = 0;
  
  if (arme) {
    if ((typeDegats || "").includes("tranchant") || (typeDegats || "").includes("contondant")) {
      bonusToucher = (Number(sys.force_bonus_toucher) || 0) + armeBonusToucher + bonusArmureToucher;
      bonusDegats = (Number(sys.force_bonus_degats) || 0) + armeBonusDegats + bonusArmureDegats;
    } else if ((typeDegats || "").includes("perforant")) {
      bonusToucher = (Number(sys.dex_att) || 0) + armeBonusToucher + bonusArmureToucher;
      bonusDegats = (Number(sys.dex_att) || 0) + armeBonusDegats + bonusArmureDegats;
    } else {
      bonusToucher = armeBonusToucher + bonusArmureToucher;
      bonusDegats = armeBonusDegats + bonusArmureDegats;
    }
  }

  let degatsMoyen = arme?.system.dégâts?.contre_moyen || "-";
  let degatsGrand = arme?.system.dégâts?.contre_grand || "-";
  let degatsAffiche = degatsMoyen + " / " + degatsGrand;

  // Construction de l'objet pour le template HTML
  data.combatDefense = {
    armure: armure ? armure.name : "<em>Aucune</em>",
    bouclier: bouclier ? bouclier.name : "<em>Aucun</em>",
    heaume: heaume ? heaume.name : "<em>Aucun</em>",
    ac_naturelle: sys.ca_naturel, // Affiche 7 (Base)
    ac_totale: sys.ca_total,       // Affiche 4 (Modifiée)
    arme: arme ? arme.name : "<em>Aucune</em>",
    thaco: thaco,
    degats: degatsAffiche,
    type_degats: typeDegats,
    bonus_toucher: bonusToucher,
    bonus_degats: bonusDegats
  };

  data.saveTitles = [
    "Jet de Paralysie / Poison / Mort magique",
    "Jet de Pétrification / Polymorphose",
    "Jet de Baguettes",
    "Jet de Souffles",
    "Jet de Sortilèges"
  ];
  data.saveShortLabels = [
    "Paralysie", "Pétrif.", "Baguettes", "Souffles", "Sorts"
  ];
  data.forceExValues = [];
  for (let i = 1; i <= 100; i++) {
    let display = (i === 100) ? "00" : i.toString().padStart(2, "0");
    data.forceExValues.push({ value: i, label: display });
  }
   const sorts = items.filter(i => i.type === "sort");
  const add2eObjectMagicPowersForHbs = [];
  const sortsParNiveau = {};

// =====================================================
// [MODIF] INJECTION DES POUVOIRS (Tous types d'items)
// Source stable : tous les objets magiques possédés par l'acteur,
// même si un autre équipement les déséquipe automatiquement.
// =====================================================
const itemsAvecPouvoirs = items.filter(i => {
  if (!["arme", "armure", "objet", "object", "magic", "objet_magique"].includes(String(i.type || "").toLowerCase())) return false;

  const pouvoirs = typeof add2eMagicObjectPowerArray === "function"
    ? add2eMagicObjectPowerArray(i)
    : (() => {
        const raw = i.system?.pouvoirs ?? i.system?.powers ?? i.system?.pouvoirsMagiques ?? i.system?.magicalPowers ?? i.system?.sorts ?? i.system?.spells;
        if (Array.isArray(raw)) return raw.filter(p => p && typeof p === "object");
        if (raw && typeof raw === "object") return Object.values(raw).filter(p => p && typeof p === "object");
        return [];
      })();

  if (pouvoirs.length > 0) return true;

  const charges = typeof add2eMagicObjectChargeInfo === "function"
    ? add2eMagicObjectChargeInfo(i, pouvoirs)
    : { max: Number(i.system?.max_charges ?? i.system?.maxCharges ?? i.system?.charges_max ?? i.system?.chargesMax ?? 0) || 0 };

  if ((Number(charges.max) || 0) > 0) return true;

  return typeof add2eMagicLooksMagical === "function" ? add2eMagicLooksMagical(i) : false;
});

for (const itemSource of itemsAvecPouvoirs) {
  let pouvoirs = typeof add2eMagicObjectPowerArray === "function"
    ? add2eMagicObjectPowerArray(itemSource)
    : [];

  // Objet magique sans pouvoir détaillé : on garde une entrée visible,
  // mais elle ne crée pas une fausse action de lancement inutile.
  if (!pouvoirs.length) continue;

  const chargeInfo = typeof add2eMagicObjectChargeInfo === "function"
    ? add2eMagicObjectChargeInfo(itemSource, pouvoirs)
    : { current: Number(itemSource.system?.charges ?? 0) || 0, max: Number(itemSource.system?.max_charges ?? itemSource.system?.maxCharges ?? 0) || 0 };

  const maxGlobal = Number(chargeInfo.max) || 0;
  const isGlobal  = maxGlobal > 0;

  pouvoirs.forEach((p, idx) => {
    let iconImage = p.img;

    const realSpell = game.items.find(i =>
      i.type === "sort" && i.name.toLowerCase() === String(p.name || p.nom || "").toLowerCase()
    );

    if (realSpell) iconImage = realSpell.img;
    if (!iconImage) iconImage = itemSource.img;

    const generatedId = typeof add2eMagicPowerGeneratedId === "function"
      ? add2eMagicPowerGeneratedId(itemSource, idx)
      : itemSource.id.substring(0, 14) + idx.toString().padStart(2, "0");

    const powerMax = isGlobal
      ? maxGlobal
      : (Number(p.max ?? p.maxCharges ?? p.chargesMax ?? p.charges_max ?? p.charges ?? 1) || 1);

    const fakeSpellData = {
      _id: generatedId,
      name: `${p.name || p.nom || itemSource.name}`,
      type: "sort",
      img: iconImage,
      system: {
        niveau: p.niveau || p.level || 1,
        école: p.ecole || p["école"] || "Magique",
        description: p.description || p.desc || "",
        composantes: "Objet",
        temps_incantation: "1",
        isPower: true,
        sourceWeaponId: itemSource.id,
        sourceItemId: itemSource.id,
        sourceItemName: itemSource.name,
        powerIndex: idx,
        cost: p.cout || p.cost || 0,
        max: powerMax,
        isGlobalCharge: isGlobal,
        onUse: p.onUse || p.onuse || p.on_use || p.script || "",
        onuse: p.onuse || p.onUse || p.on_use || p.script || "",
        on_use: p.on_use || p.onUse || p.onuse || p.script || "",
        objetMagicOnUse: p.objetMagicOnUse || p.fallbackOnUse || "",
        linkedSpell: p.linkedSpell || null
      }
    };

    const virtualSpell = new Item(fakeSpellData, { parent: this.actor });

    virtualSpell.getFlag = (scope, key) => {
      if (scope !== "add2e") return null;
      if (key === "memorizedCount") {
        if (isGlobal) {
          const val = itemSource.getFlag("add2e", "global_charges");
          return (val !== undefined) ? val : chargeInfo.current;
        }
        const charges = itemSource.getFlag("add2e", `charges_${idx}`);
        return (charges !== undefined) ? charges : powerMax;
      }
      return null;
    };

    add2eObjectMagicPowersForHbs.push(virtualSpell);
    // Compatibilité HBS natif : le template existant lit les pouvoirs d’objets via la liste des sorts virtuels.
    sorts.push(virtualSpell);
  });
}

data.add2eObjectMagicPowers = add2eObjectMagicPowersForHbs.map(power => ({
  id: power.id || power._id,
  name: power.name || "Pouvoir",
  img: power.img || "icons/svg/aura.svg",
  niveau: Number(power.system?.niveau ?? 1) || 1,
  description: power.system?.description || "",
  sourceItemId: power.system?.sourceWeaponId || power.system?.sourceItemId || "",
  powerIndex: power.system?.powerIndex ?? null,
  charges: Number(power.getFlag?.("add2e", "memorizedCount") ?? power.system?.max ?? 0) || 0,
  max: Number(power.system?.max ?? 0) || 0,
  cost: Number(power.system?.cost ?? 0) || 0,
  onUse: power.system?.onUse || power.system?.onuse || power.system?.on_use || "",
  onuse: power.system?.onuse || power.system?.onUse || power.system?.on_use || "",
  on_use: power.system?.on_use || power.system?.onUse || power.system?.onuse || ""
}));

    // =====================================================
  for (const sort of sorts) {
    let niveau = Number(sort.system.niveau) || 1;
    if (!sortsParNiveau[niveau]) sortsParNiveau[niveau] = [];
    sortsParNiveau[niveau].push(sort);
  }
  const niveauxSorts = Object.keys(sortsParNiveau).map(Number).sort((a, b) => a - b);
  data.sortsParNiveau = sortsParNiveau;
  data.niveauxSorts = niveauxSorts;

  // ----- LIMITES DE SORTS PRÉPARÉS PAR LIGNE DE SORTS -----
  const sortsMemorizedByLevel = {};
  const spellPoolsByLevel = {};
  const slotPools = add2eGetSpellSlotPoolsByLevel(this.actor);

  for (const niv of niveauxSorts) {
    const pools = [];
    let totalCount = 0;
    let totalMax = 0;

    for (const [key, pool] of Object.entries(slotPools)) {
      const max = Number(pool.slotsByLevel?.[niv] || 0) || 0;
      const count = add2eCountPreparedForEntryLevel(this.actor, pool, niv);
      totalCount += count;
      totalMax += max;
      pools.push({
        key,
        label: pool.label || add2eSpellLabel(key),
        count,
        max,
        startsAt: pool.startsAt,
        maxSpellLevel: pool.maxSpellLevel
      });
    }

    spellPoolsByLevel[niv] = pools;
    sortsMemorizedByLevel[niv] = {
      count: totalCount,
      max: totalMax,
      pools,
      byList: Object.fromEntries(pools.map(p => [p.key, { count: p.count, max: p.max, label: p.label }]))
    };
  }

  data.sortsMemorizedByLevel = sortsMemorizedByLevel;
  data.spellPoolsByLevel = spellPoolsByLevel;

  // ----- DONNÉES NATIVES HBS : préparation par liste et par niveau -----
  // Le template character-sheet.hbs utilise directement ces champs ; il n'y a plus
  // besoin de remplacer/masquer des blocs après rendu.
  const add2eActorLevelForSpells = Math.max(1, Number(this.actor.system?.niveau ?? 1) || 1);
  const add2eSpellEntriesForHbs = add2eGetSpellcastingEntries(this.actor);

  const add2eSpellItemLevel = (sort) => Number(sort?.system?.niveau ?? sort?.system?.level ?? 1) || 1;
  const add2eEntryLabelForHbs = (entry) => entry?.label || add2eSpellLabel(entry?.key);
  const add2eEntryKeyForHbs = (entry) => add2eNormalizeSpellKey(entry?.key);

  const add2eMaxSpellLevelFromEntries = add2eSpellEntriesForHbs.reduce((max, entry) => {
    const v = Number(entry?.maxSpellLevel ?? 0) || 0;
    return Math.max(max, v);
  }, 0);

  const add2eMaxSpellLevelFromItems = sorts.reduce((max, sort) => Math.max(max, add2eSpellItemLevel(sort)), 0);
  const add2eMaxSpellLevelForHbs = Math.max(add2eMaxSpellLevelFromEntries, add2eMaxSpellLevelFromItems, 0);

  const add2eBuildCountersForLevel = (spellLevel) => {
    return add2eSpellEntriesForHbs
      .filter(entry => {
        const maxSpellLevel = Number(entry?.maxSpellLevel ?? 0) || 0;
        return !maxSpellLevel || Number(spellLevel) <= maxSpellLevel;
      })
      .map(entry => {
        const count = add2eCountPreparedForEntryLevel(this.actor, entry, spellLevel);
        const max = add2eGetSlotsForEntryLevel(this.actor, entry, spellLevel);
        return {
          key: add2eEntryKeyForHbs(entry),
          label: add2eEntryLabelForHbs(entry),
          count,
          max,
          full: max > 0 && count >= max,
          over: max > 0 && count > max
        };
      })
      .filter(counter => counter.max > 0);
  };

  data.add2eSpellSummaryRows = add2eSpellEntriesForHbs.map(entry => {
    const maxSpellLevel = Number(entry?.maxSpellLevel ?? add2eMaxSpellLevelForHbs) || add2eMaxSpellLevelForHbs;
    const levels = [];
    for (let spellLevel = 1; spellLevel <= maxSpellLevel; spellLevel++) {
      const count = add2eCountPreparedForEntryLevel(this.actor, entry, spellLevel);
      const max = add2eGetSlotsForEntryLevel(this.actor, entry, spellLevel);
      if (max > 0) {
        levels.push({ spellLevel, count, max });
      }
    }
    return {
      key: add2eEntryKeyForHbs(entry),
      label: add2eEntryLabelForHbs(entry),
      levels
    };
  }).filter(row => row.levels.length);

  data.add2eSpellLevels = [];

  const add2eIsObjectPowerRow = (sort) => {
    const sys = sort?.system ?? {};
    return sys.isPower === true
      || sys.isObjectPower === true
      || sys.sourceWeaponId
      || sys.sourceItemId
      || sys.powerIndex !== undefined
      || String(sys.composantes ?? "").toLowerCase().includes("objet");
  };

  const add2eIsCapacitySpellRow = (sort) => {
    const sys = sort?.system ?? {};
    const flags = sort?.flags?.add2e ?? {};
    return sys.isCapacity === true
      || sys.isCapacite === true
      || sys.usageType === "classFeature"
      || sys.sourceCapacite
      || sys.sourceFeature
      || flags.sourceType === "capacite"
      || flags.sourceType === "capacity";
  };

  const add2eBuildSpellRowForHbs = (sort, spellLevel) => {
    const spellLists = add2eGetSpellListsFromItem(sort);
    const allowedEntries = add2eSpellEntriesForHbs.filter(entry => {
      const key = add2eEntryKeyForHbs(entry);
      const startsAt = Number(entry?.startsAt ?? 1) || 1;
      const maxSpellLevel = Number(entry?.maxSpellLevel ?? 0) || 0;
      return spellLists.includes(key)
        && add2eActorLevelForSpells >= startsAt
        && (!maxSpellLevel || spellLevel <= maxSpellLevel);
    });

    const matchingLabels = add2eSpellEntriesForHbs
      .filter(entry => spellLists.includes(add2eEntryKeyForHbs(entry)))
      .map(add2eEntryLabelForHbs);

    const isObjectPower = add2eIsObjectPowerRow(sort);
    const isCapacity = add2eIsCapacitySpellRow(sort);

    return {
      id: sort.id || sort._id,
      name: sort.name || "Sort",
      img: sort.img || "icons/svg/book.svg",
      ecole: sort.system?.école || sort.system?.ecole || sort.system?.school || "",
      description: sort.system?.description || "",
      composantes: sort.system?.composantes || "",
      temps_incantation: sort.system?.temps_incantation || "",
      portee: sort.system?.portee || sort.system?.portée || null,
      duree: sort.system?.duree || sort.system?.durée || null,
      isObjectPower,
      isCapacity,
      isRegularSpell: !isObjectPower && !isCapacity,
      objectPowerCharges: isObjectPower ? (Number(sort.getFlag?.("add2e", "memorizedCount") ?? sort.flags?.add2e?.memorizedCount ?? sort.system?.max ?? 0) || 0) : 0,
      listLabel: matchingLabels.length ? matchingLabels.join(" / ") : (spellLists.map(add2eSpellLabel).join(" / ") || "Non autorisé"),
      entries: allowedEntries.map(entry => {
        const count = add2eGetMemorizedCountForEntry(sort, entry);
        const total = add2eCountPreparedForEntryLevel(this.actor, entry, spellLevel);
        const max = add2eGetSlotsForEntryLevel(this.actor, entry, spellLevel);
        return {
          key: add2eEntryKeyForHbs(entry),
          label: add2eEntryLabelForHbs(entry),
          count,
          total,
          max,
          over: max > 0 && total > max
        };
      })
    };
  };

  const add2eMakeSpellGroup = ({ key, label, title, kind, counter, sorts }) => ({
    key,
    label,
    title,
    kind,
    counter: counter || { key, label, count: 0, max: 0 },
    sorts: sorts || []
  });

  for (let spellLevel = 1; spellLevel <= add2eMaxSpellLevelForHbs; spellLevel++) {
    const counters = add2eBuildCountersForLevel(spellLevel);
    const levelSorts = sorts
      .filter(sort => add2eSpellItemLevel(sort) === spellLevel)
      .sort((a, b) => String(a?.name ?? "").localeCompare(String(b?.name ?? "")));

    if (!counters.length && !levelSorts.length) continue;

    const sortRows = levelSorts.map(sort => add2eBuildSpellRowForHbs(sort, spellLevel));
    const regularRows = sortRows.filter(row => row.isRegularSpell);
    const objectPowerRows = sortRows.filter(row => row.isObjectPower);
    const capacityRows = sortRows.filter(row => row.isCapacity);

    const groups = [];

    // Les pouvoirs d'objets magiques doivent apparaître avant les sorts du niveau.
    if (objectPowerRows.length) {
      groups.push(add2eMakeSpellGroup({
        key: "objet_magique",
        label: "Effets d'objet magique",
        title: "Effets d'objet magique",
        kind: "object-power",
        counter: { key: "objet_magique", label: "Effets d'objet magique", count: objectPowerRows.length, max: objectPowerRows.length },
        sorts: objectPowerRows
      }));
    }

    if (capacityRows.length) {
      groups.push(add2eMakeSpellGroup({
        key: "capacite",
        label: "Capacités",
        title: "Capacités",
        kind: "capacity",
        counter: { key: "capacite", label: "Capacités", count: capacityRows.length, max: capacityRows.length },
        sorts: capacityRows
      }));
    }

    for (const counter of counters) {
      const key = add2eNormalizeSpellKey(counter.key);
      const label = counter.label || add2eSpellLabel(key);
      const groupedSorts = regularRows.filter(row => row.entries.some(entry => add2eNormalizeSpellKey(entry.key) === key));

      // Une section est affichée si le niveau de sort est réellement accessible
      // au niveau actuel du personnage. Elle peut donc être vide si aucun sort
      // de ce niveau n'a encore été importé, mais elle disparaît dès que le
      // personnage n'a plus d'emplacement pour ce niveau.
      groups.push(add2eMakeSpellGroup({
        key,
        label,
        title: `Sorts de ${String(label).toLowerCase()}`,
        kind: "spell-list",
        counter,
        sorts: groupedSorts
      }));
    }

    if (!groups.length) continue;

    data.add2eSpellLevels.push({ spellLevel, counters, groups, sorts: sortRows });
  }


  // ----- ENRICHISSEMENT DES EFFETS ACTIFS POUR L’AFFICHAGE -----
  data.activeEffectsList = this.actor.effects.map(eff => {
    let desc = eff.getFlag("core", "description")
      || eff.flags?.add2e?.desc
      || eff.description
      || "";
    if (!desc && eff.flags?.add2e?.tags) {
      desc = "<small>" + eff.flags.add2e.tags.join(", ") + "</small>";
    }
    let durationStr = "";
    if (typeof eff.duration?.remaining !== "undefined") {
      durationStr = `${eff.duration.remaining} rounds`;
    } else if (typeof eff.duration?.rounds !== "undefined") {
      durationStr = `${eff.duration.rounds} rounds`;
    } else if (typeof eff.duration?.seconds !== "undefined") {
      durationStr = `${eff.duration.seconds} sec`;
    }
    return {
      id: eff.id,
      name: eff.name || "",
      img: eff.img || "icons/svg/aura.svg",
      description: desc,
      duration: durationStr,
      sourceName: eff.parent?.name || eff.origin || "",
    };
  });

  // Place la bonne liste des alignements autorisés pour la classe courante
  const alignementsDisponibles =
    (sys.alignements_autorises && Array.isArray(sys.alignements_autorises))
      ? sys.alignements_autorises
      : [];
  data.alignementsDisponibles = alignementsDisponibles;

  // Onglet actif persistant pendant la vie de la fiche.
  // Important : actor-sheet.mjs n'est pas chargé par system.json dans ce système ;
  // la logique d'onglets doit donc rester ici, dans add2e.mjs.
  data.activeTab = this._add2eGetNativeActiveTab?.() || this._add2eActiveTab || this._add2eReadStoredTab?.() || "resume";

  return data;
}



async autoSetCaracAjustements() {
  if (this._autoSetCaracsInProgress) return;
  if (!this.actor || !this.actor.system) {
    console.warn("[ADD2E] autoSetCaracAjustements : actor ou actor.system manquant");
    return;
  }

  const s = this.actor.system;
  this._autoSetCaracsInProgress = true;

  try {
    // ============================
    // 1) Initialisation des *_base
    // ============================
    const CARACS_LIST = ["force","dexterite","constitution","intelligence","sagesse","charisme"];
    let baseUpdates = {};

    for (const c of CARACS_LIST) {
      const baseKey = `${c}_base`;
      if (typeof s[baseKey] !== "number" || isNaN(s[baseKey])) {
        baseUpdates[`system.${baseKey}`] = Number(s[c]) || 10;
      }
    }

    if (Object.keys(baseUpdates).length > 0) {
      await this.actor.update(baseUpdates);
    }

    // =====================================
    // 2) Totaux caracs (base + bonus race)
    //    (compat: *_race OU bonus_caracteristiques.*)
    // =====================================
    const totalCaracs = {};
    for (const c of CARACS_LIST) {
      const base = Number(this.actor.system?.[`${c}_base`] ?? s[`${c}_base`] ?? 10) || 10;

      // compat anciens champs "*_race"
      const legacyRace = Number(this.actor.system?.[`${c}_race`] ?? s[`${c}_race`] ?? 0) || 0;

      // champ actuel dans ta feuille: bonus_caracteristiques.force etc.
      const bonusCaracs = this.actor.system?.bonus_caracteristiques || s.bonus_caracteristiques || {};
      const bonusRace = Number(bonusCaracs?.[c] ?? 0) || 0;

      totalCaracs[c] = base + (bonusRace || legacyRace);
    }

    // Valeurs d'affichage (utilisées dans _fullUpdate)
    const forAff = totalCaracs.force;
    const dexAff = totalCaracs.dexterite;
    const conAff = totalCaracs.constitution;
    const intAff = totalCaracs.intelligence;
    const sagAff = totalCaracs.sagesse;
    const chaAff = totalCaracs.charisme;

    // ============================
    // 3) FORCE (inclut 18/xx)
    // ============================
    // Normalisation robuste (accents, apostrophes)
    const classeStr = String(s.classe || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f’']/g, "");

    // Flag porté par la classe (si tu le stockes dans details_classe)
    const allowExFromClass =
      !!(s.details_classe?.allowExceptionalStrength || s.details_classe?.allowExceptionalStrength === true);

    // Compat rétro : si pas de flag, on garde l'ancien test par nom
    const allowExLegacy =
      classeStr.includes("guerrier") || classeStr.includes("paladin") || classeStr.includes("rodeur") || classeStr.includes("ranger");

    const allowExceptional = allowExFromClass || allowExLegacy;

    let valForce = totalCaracs.force;
    let forceEx = Number(s.force_ex || 0);
    let forceKey = valForce;

    if (valForce === 18 && allowExceptional) {
      if (forceEx >= 1 && forceEx <= 50)       forceKey = "18/01-50";
      else if (forceEx >= 51 && forceEx <= 75) forceKey = "18/51-75";
      else if (forceEx >= 76 && forceEx <= 90) forceKey = "18/76-90";
      else if (forceEx >= 91 && forceEx <= 99) forceKey = "18/91-99";
      else if (forceEx === 100)                forceKey = "18/00";
    }

    // IMPORTANT: évite ReferenceError
    let forceBonus = { toucher: 0, degats: 0, poids: 0, ouvrir: "—", tordre: "—" };
    if (typeof FORCE_TABLE !== "undefined" && FORCE_TABLE && FORCE_TABLE[forceKey]) {
      forceBonus = FORCE_TABLE[forceKey];
    }

    const forBonusToucher = Number(forceBonus.toucher || 0);
    const forBonusDegats  = Number(forceBonus.degats  || 0);

    // Compat ancienne feuille vs nouvelle (tu affiches désormais force_poids/ouvrir/tordre)
    const forcePoids  = forceBonus.poids ?? 0;
    const forceOuvrir = forceBonus.ouvrir ?? "—";
    const forceTordre = forceBonus.tordre ?? "—";

    // (Legacy) certains endroits de ton code utilisaient "force_bonus_porte" / charges
    const forBonusPorte = forceOuvrir;

    // Charge max (si tu avais déjà ces champs ailleurs; fallback neutre sinon)
    const chargeMax      = (typeof forcePoids === "number") ? forcePoids : 0;
    const chargeMaxBench = (typeof forcePoids === "number") ? forcePoids : 0;

    // ============================
    // 4) AUTRES TABLES (si présentes)
    // ============================
    const dexBonus = (typeof DEXTERITE_TABLE !== "undefined" && DEXTERITE_TABLE?.[dexAff]) || { att: 0, def: 0 };
    const conBonus = (typeof CONSTITUTION_TABLE !== "undefined" && CONSTITUTION_TABLE?.[conAff]) || { pv: 0, trauma: 0, resu: 0 };
    const intBonus = (typeof INTELLIGENCE_TABLE !== "undefined" && INTELLIGENCE_TABLE?.[intAff]) || { langues: 0, chance_sort: 0, min_sort: 0, max_sort: 0, sort_par_niveau: 0 };
    const sagBonus = (typeof SAGESSE_TABLE !== "undefined" && SAGESSE_TABLE?.[sagAff]) || { magie: 0, sort_suppl: 0, echec: 0 };
    const chaBonus = (typeof CHARISME_TABLE !== "undefined" && CHARISME_TABLE?.[chaAff]) || { compagnons: 0, loy: 0, react: 0 };

    // ============================
    // 5) Update global + diff
    // ============================
    const _fullUpdate = {
      // Affichages
      "system.for_aff": forAff,
      "system.dex_aff": dexAff,
      "system.con_aff": conAff,
      "system.int_aff": intAff,
      "system.sag_aff": sagAff,
      "system.cha_aff": chaAff,

      // Force (nouveaux champs affichés sur ta feuille)
      "system.force_bonus_toucher": forBonusToucher,
      "system.force_bonus_degats": forBonusDegats,
      "system.force_poids": forcePoids,
      "system.force_ouvrir": forceOuvrir,
      "system.force_tordre": forceTordre,

      // Legacy/compat (si tu as encore des usages ailleurs)
      "system.force_bonus_porte": forBonusPorte,
      "system.charge_max": chargeMax,
      "system.charge_max_bench": chargeMaxBench,

      // Dex / Con / Int / Sag / Cha (si tu les exploites ailleurs)
      "system.dex_att": Number(dexBonus.att || 0),
      "system.dex_def": Number(dexBonus.def || 0),

      "system.con_pv": Number(conBonus.pv || 0),
      "system.con_trauma": Number(conBonus.trauma || 0),
      "system.con_resu": Number(conBonus.resu || 0),

      "system.int_langues": Number(intBonus.langues || 0),
      "system.int_chance_sort": Number(intBonus.chance_sort || 0),
      "system.int_min_sort": Number(intBonus.min_sort || 0),
      "system.int_max_sort": Number(intBonus.max_sort || 0),
      "system.int_sort_par_niveau": Number(intBonus.sort_par_niveau || 0),

      "system.sag_magie": Number(sagBonus.magie || 0),
      "system.sag_sort_suppl": Number(sagBonus.sort_suppl || 0),
      "system.sag_echec": Number(sagBonus.echec || 0),

      "system.cha_compagnons": Number(chaBonus.compagnons || 0),
      "system.cha_loy": Number(chaBonus.loy || 0),
      "system.cha_react": Number(chaBonus.react || 0)
    };

    const _getProp = foundry?.utils?.getProperty;
    const _diff = {};
    for (const [k, v] of Object.entries(_fullUpdate)) {
      const cur = _getProp ? _getProp(this.actor, k) : undefined;
      if (cur !== v) _diff[k] = v;
    }

    if (Object.keys(_diff).length) {
      await this.actor.update(_diff);
    } else {
      console.log("%c[ADD2E][CARACS] Ajustements déjà à jour (aucune update).", "color:#777");
    }

    // ============================
    // 6) PV auto (si présent)
    // ============================
    if (typeof this.autoSetPointsDeCoup === "function") {
      await this.autoSetPointsDeCoup();
    }

  } catch (e) {
    console.error("[ADD2E] Erreur dans autoSetCaracAjustements()", e);
  } finally {
    this._autoSetCaracsInProgress = false;
  }
}




  async autoSetPointsDeCoup({ syncCurrent = false, force = false, reason = "unknown" } = {}) {
  try {
    const actor = this.actor;
    if (!actor?.system) return;

    const s = actor.system;
    const lvl = Math.max(1, Number(s.niveau) || 1);

    // Classe (priorité: item "classe", sinon details_classe)
    const classeItem = actor.items?.find(i => i.type === "classe");
    const cls = classeItem?.system || s.details_classe || null;
    if (!cls) {
      console.warn("[ADD2E][HP] Classe introuvable, PV non recalculés", { actor: actor.name, reason });
      return;
    }

    const hitDie = Number(cls.hitDie || 0);
    if (!Number.isFinite(hitDie) || hitDie <= 0) {
      console.warn("[ADD2E][HP] hitDie invalide, PV non recalculés", { actor: actor.name, hitDie, reason });
      return;
    }

    // Bonus CON par niveau (calculé par autoSetCaracAjustements -> system.con_pv)
    const conBonus = Number(s.con_pv || 0);

    // Jets mémorisés : hpRolls[i] = jet du niveau (i+1)
    let hpRolls = Array.isArray(s.hpRolls) ? [...s.hpRolls] : [];
    if (force) hpRolls = [];

    // Niveau 1 : max du dé
    if (hpRolls.length < 1 || !Number.isFinite(hpRolls[0])) {
      hpRolls[0] = hitDie;
    }

    // Niveaux 2+ : jet 1..hitDie
    for (let i = 1; i < lvl; i++) {
      const cur = hpRolls[i];
      if (Number.isFinite(cur) && cur >= 1 && cur <= hitDie) continue;

      // Jet sûr sans parseur de formule
      const roll = 1 + Math.floor(Math.random() * hitDie);
      hpRolls[i] = roll;
    }

    // Calcul PV max selon votre règle
    let hpMax = 0;
    for (let i = 0; i < lvl; i++) {
      const diePart = (i === 0) ? hitDie : (Number(hpRolls[i]) || 1);
      hpMax += diePart + conBonus;
    }

    if (!Number.isFinite(hpMax) || hpMax < 1) hpMax = 1;

    const up = {
      "system.hpRolls": hpRolls,
      "system.points_de_coup": hpMax
    };
    if (syncCurrent) up["system.pdv"] = hpMax;

    await actor.update(up, { add2eInternal: true });

    console.log("[ADD2E][HP] PV recalculés (max niv1 + jets) OK", {
      actor: actor.name,
      lvl,
      hitDie,
      conBonus,
      hpMax,
      reason
    });

  } catch (e) {
    console.warn("[ADD2E][HP] Erreur autoSetPointsDeCoup :", e);
  }
}


  _enableCaracClickAssign(roller) {
  this.element.find('.carac-drop-target').each((i, el) => {
  el.classList.add("clickable");
  el.onclick = ev => {
    const carac = el.dataset.carac;
    if (roller.assigned[carac] !== undefined) {
      roller.unassignCarac(carac); 
    } else {
      roller.assignToCarac(carac);
    }
  };
  });
  
 }


  // =====================================================
  // ADD2E — MÉMOIRE DES ONGLET DE LA FEUILLE PERSONNAGE
  // =====================================================
  // Le système charge cette classe depuis add2e.mjs. Le fichier actor-sheet.mjs
  // n'est pas chargé par system.json. Toute la logique d'onglets doit donc être ici.

  _add2eTabStorageKey() {
    return `add2e.actor.${this.actor?.id || "unknown"}.activeTab`;
  }

  _add2eReadStoredTab() {
    try {
      return sessionStorage.getItem(this._add2eTabStorageKey()) || null;
    } catch (e) {
      return null;
    }
  }

  _add2eSheetRoot(html = null) {
    const source = html ?? this.element;
    if (!source) return null;

    const root = source.jquery ? source[0] : source;
    if (!root) return null;

    if (root.matches?.(".add2e-character-v3")) return root;
    if (root.querySelector?.(".add2e-character-v3")) return root.querySelector(".add2e-character-v3");
    if (root.matches?.("form.sheet.actor.add2e")) return root;
    if (root.querySelector?.("form.sheet.actor.add2e")) return root.querySelector("form.sheet.actor.add2e");

    return root;
  }

  _add2eCurrentTabFromHtml(html = null) {
    const root = this._add2eSheetRoot(html);
    if (!root) return this._add2eActiveTab || this._add2eReadStoredTab() || "resume";

    return (
      this._add2eGetNativeActiveTab?.() ||
      root.querySelector(".sheet-tabs .item.active[data-tab]")?.dataset?.tab ||
      root.querySelector(".a2e-tabs .item.active[data-tab]")?.dataset?.tab ||
      root.querySelector(".sheet-body .tab.active[data-tab]")?.dataset?.tab ||
      root.querySelector(".a2e-tab-content.active[data-tab]")?.dataset?.tab ||
      root.querySelector(".a2e-active-tab-input")?.value ||
      this._add2eActiveTab ||
      this._add2eReadStoredTab() ||
      "resume"
    );
  }

  _add2eRememberActiveTab(html = null, explicitTab = null) {
    const tab = explicitTab || this._add2eCurrentTabFromHtml(html) || "resume";
    this._add2eActiveTab = tab;
    this._add2eSetNativeActiveTab?.(tab);

    try {
      sessionStorage.setItem(this._add2eTabStorageKey(), tab);
    } catch (e) {}

    const root = this._add2eSheetRoot(html);
    const hidden = root?.querySelector?.(".a2e-active-tab-input");
    if (hidden) hidden.value = tab;

    return tab;
  }

  _add2eActivateTab(tabName = null, html = null) {
    const root = this._add2eSheetRoot(html);
    if (!root) return;

    const tab = tabName || this._add2eActiveTab || this._add2eReadStoredTab() || "resume";
    this._add2eRememberActiveTab(root, tab);

    root.querySelectorAll(".sheet-tabs .item[data-tab], .a2e-tabs .item[data-tab]").forEach(el => {
      el.classList.toggle("active", el.dataset.tab === tab);
    });

    root.querySelectorAll(".sheet-body .tab[data-tab], .a2e-tab-content[data-tab]").forEach(el => {
      el.classList.toggle("active", el.dataset.tab === tab);
    });
  }

  _add2eBindPersistentTabs(html) {
    const root = this._add2eSheetRoot(html);
    if (!root) return;

    const initial = this._add2eGetNativeActiveTab?.() || this._add2eActiveTab || this._add2eReadStoredTab() || "resume";
    this._add2eActivateTab(initial, root);
    setTimeout(() => this._add2eActivateTab(this._add2eActiveTab || this._add2eReadStoredTab() || "resume"), 0);

    // Capture avant les handlers d'action : mémorise l'onglet courant avant equip/delete/update/render.
    if (root.dataset.add2eTabsCaptureBound !== "1") {
      root.dataset.add2eTabsCaptureBound = "1";
      root.addEventListener("pointerdown", ev => {
        const tabLink = ev.target.closest?.(".sheet-tabs .item[data-tab], .a2e-tabs .item[data-tab]");
        if (tabLink && root.contains(tabLink)) {
          this._add2eRememberActiveTab(root, tabLink.dataset.tab || "resume");
          return;
        }
        this._add2eRememberActiveTab(root);
      }, true);
      root.addEventListener("change", () => this._add2eRememberActiveTab(root), true);
    }

    $(root).find(".sheet-tabs .item[data-tab], .a2e-tabs .item[data-tab]")
      .off("click.add2e-tabs")
      .on("click.add2e-tabs", ev => {
        ev.preventDefault();
        const tab = ev.currentTarget.dataset.tab || "resume";
        this._add2eActivateTab(tab, root);
      });

    $(root)
      .off("mousedown.add2e-tab-memory change.add2e-tab-memory keydown.add2e-tab-memory")
      .on("mousedown.add2e-tab-memory change.add2e-tab-memory keydown.add2e-tab-memory", () => {
        this._add2eRememberActiveTab(root);
      });
  }

  render(force=false, options={}) {
    try {
      if (this.rendered) this._add2eRememberActiveTab(this.element);
    } catch (e) {}
    const result = super.render(force, options);
    const refreshUi = () => {
      this._add2eActivateTab(this._add2eActiveTab || this._add2eReadStoredTab() || "resume");
      try {
        add2eEnhanceCharacterSheetUi(this, this.element);
      } catch (err) {
        console.warn("[ADD2E][OBJETS_MAGIQUES][UI] Réinjection après render impossible.", err);
      }
    };
    for (const delay of [0, 80, 220]) setTimeout(refreshUi, delay);
    return result;
  }

  activateListeners(html) {
    super.activateListeners(html);
    const self = this;
add2eRegisterImgPicker(html, this);
this._add2eBindPersistentTabs(html);
add2eEnhanceCharacterSheetUi(this, html);

// -- Gestion des effets actifs (édition et suppression) --
 html.find('.effect-edit').off().on('click', ev => {
  ev.preventDefault();
  const effectId = $(ev.currentTarget).data('effect-id');
  const effect = this.actor.effects.get(effectId);
  if (effect) effect.sheet.render(true);
});

html.find('.effect-delete').off().on('click', async ev => {
  ev.preventDefault();
  this._add2eRememberActiveTab(html);
  const effectId = $(ev.currentTarget).data('effect-id');
  if (effectId) {
    await this.actor.deleteEmbeddedDocuments("ActiveEffect", [effectId]);
    this.render(false);
  }
});


html.find('.carac-btn').off('click.add2e').on('click.add2e', async ev => {
  ev.preventDefault();
  this._add2eRememberActiveTab(html);
  const carac = ev.currentTarget.dataset.carac;
  const isPlus = ev.currentTarget.classList.contains('plus');
  let baseVal = Number(this.actor.system[`${carac}_base`] || 10);
  baseVal = Math.max(3, Math.min(18, baseVal + (isPlus ? 1 : -1)));
  await this.actor.update({ [`system.${carac}_base`]: baseVal });

  // Sauvegarde immédiatement après changement
  const CARACS = ["force", "dexterite", "constitution", "intelligence", "sagesse", "charisme"];
  let baseCaracs = {};
  for (const c of CARACS) {
    baseCaracs[c] = typeof this.actor.system?.[`${c}_base`] === "number" ? this.actor.system[`${c}_base`] : 10;
  }
  await this.actor.setFlag("add2e", "base_caracs", baseCaracs);

  // Recalcule et met à jour les bonus de carac !
  if (typeof this.autoSetCaracAjustements === "function") {
    await this.autoSetCaracAjustements();
  }
  // Si tes bonus sont calculés côté script mais non enregistrés sur l’acteur :
  // Ajoute explicitement une MAJ de l’actor pour forcer l’update
  const recalculatedBonuses = this.calcCaracBonuses ? this.calcCaracBonuses() : {};
  // Ex : calcCaracBonuses() doit retourner un objet du type
  // { "system.force_bonus_toucher": 1, ... }
  if (recalculatedBonuses && Object.keys(recalculatedBonuses).length) {
    await this.actor.update(recalculatedBonuses);
  }

  // Rafraîchir la fiche pour refléter les nouvelles valeurs
  await this.render(false);
});

html.find('.roll-stat').off('click.add2e').on('click.add2e', async ev => {
  ev.preventDefault();
  const carac = ev.currentTarget.dataset.stat;
  const label = carac?.toUpperCase() || 'Caractéristique';
  const val = Number(this.actor.system[carac]) || 10;
  const roll = new Roll('1d20');
  await roll.evaluate();

  // LANCE DICE SO NICE sans créer de message gris
  if (game.dice3d) await game.dice3d.showForRoll(roll);

  // Choix d’icône et de couleur selon la carac
  const caracIcon = {
    force: "fa-dumbbell",
    dexterite: "fa-running",
    constitution: "fa-heartbeat",
    intelligence: "fa-brain",
    sagesse: "fa-eye",
    charisme: "fa-theater-masks"
  }[carac] || "fa-dice-d20";
  const caracColor = {
    force: "#4ab878",
    dexterite: "#f3aa3c",
    constitution: "#e74c3c",
    intelligence: "#2980b9",
    sagesse: "#9b59b6",
    charisme: "#e056fd"
  }[carac] || "#6c4e95";
  const reussite = roll.total <= val;

  const htmlCard = `
    <div class="add2e-card-test" style="
      border-radius:13px; box-shadow:0 2px 10px #b5e7c388;
      background:linear-gradient(100deg,#f9fcfa 90%,#e4fbf1 100%);
      border:1.4px solid ${caracColor}; max-width:420px; padding:0.85em 1.1em 0.8em 1.1em; font-family: var(--font-primary);
    ">
      <div style="display:flex; align-items:center; gap:0.7em; margin-bottom:0.5em;">
        <i class="fas ${caracIcon}" style="font-size:2em;color:${caracColor};"></i>
        <span style="font-size:1.17em; font-weight:bold; color:${caracColor};">${label}</span>
        <span style="margin-left:auto; font-size:1em; font-weight:500; color:#666;">Test de caractéristique</span>
      </div>
      <div style="font-size:1.11em; margin-bottom:0.25em;">
        Seuil&nbsp;: <b>${val}</b>
        &nbsp;&nbsp;|&nbsp;&nbsp;Résultat&nbsp;: <b>${roll.total}</b>
      </div>
      <div style="margin:0.2em 0 0.1em 0; font-size:1.1em;">
        <span style="font-weight:600; color:${reussite ? "#1cb360" : "#c34040"};">
          ${reussite ? "✔️ Réussite" : "❌ Échec"}
        </span>
      </div>
    </div>
  `;

  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: this.actor }),
    content: htmlCard
  });
});

html.find('.roll-save').off('click.add2e').on('click.add2e', async ev => {
  ev.preventDefault();
  const idx = Number(ev.currentTarget.dataset.save);

  // Récupère les valeurs (modifie ici si besoin selon ta structure)
  const saves = this.actor.system.details_classe?.progression?.[this.actor.system.niveau - 1]?.savingThrows
    || this.actor.system.sauvegardes || [];
  const noms = ["Paralysie", "Pétrification", "Baguettes", "Souffles", "Sorts"];
  const nom = noms[idx] || "Jet";
  const valeur = Number(saves[idx]);
  if (!valeur) return ui.notifications.warn("Aucune valeur pour ce jet.");

  const roll = new Roll('1d20');
  await roll.evaluate();

  // LANCE DICE SO NICE sans créer de message gris
  if (game.dice3d) await game.dice3d.showForRoll(roll);

  let bonusSave = 0;
  if (typeof Add2eEffectsEngine !== "undefined") {
    try {
      const analyse = Add2eEffectsEngine.analyze?.(this.actor, { type: "save", vsType: nom, frontale: true }) ?? {};
      bonusSave = Number(analyse.bonus_save || 0);
    } catch (e) {
      console.warn("[ADD2E][SAVE] Erreur analyse effets de sauvegarde", e);
    }
  }

  const totalJet = Number(roll.total || 0) + bonusSave;

  // Icônes et couleurs par type de save
  const saveIcons = ["fa-skull-crossbones","fa-mountain","fa-magic","fa-fire","fa-scroll"];
  const icon = saveIcons[idx] || "fa-dice-d20";
  const colors = ["#c48642","#6394e8","#b12f95","#e67e22","#a173d9"];
  const color = colors[idx] || "#6c4e95";
  const reussite = totalJet >= valeur;

  const htmlCard = `
    <div class="add2e-card-test" style="
      border-radius:13px; box-shadow:0 2px 10px #cfdfff88;
      background:linear-gradient(100deg,#f9fafd 90%,#e6e8fb 100%);
      border:1.4px solid ${color}; max-width:420px; padding:0.85em 1.1em 0.8em 1.1em; font-family: var(--font-primary);
    ">
      <div style="display:flex; align-items:center; gap:0.7em; margin-bottom:0.5em;">
        <i class="fas ${icon}" style="font-size:2em;color:${color};"></i>
        <span style="font-size:1.12em; font-weight:bold; color:${color};">${nom}</span>
        <span style="margin-left:auto; font-size:1em; font-weight:500; color:#666;">Jet de sauvegarde</span>
      </div>
      <div style="font-size:1.09em; margin-bottom:0.25em;">
        Seuil&nbsp;: <b>${valeur}</b>
        &nbsp;&nbsp;|&nbsp;&nbsp;Résultat&nbsp;: <b>${roll.total}</b>
        ${bonusSave ? `&nbsp;&nbsp;|&nbsp;&nbsp;Effets&nbsp;: <b>${bonusSave >= 0 ? "+" : ""}${bonusSave}</b> → <b>${totalJet}</b>` : ""}
      </div>
      <div style="margin:0.2em 0 0.1em 0; font-size:1.1em;">
        <span style="font-weight:600; color:${reussite ? "#1cb360" : "#c34040"};">
          ${reussite ? "✔️ Réussite" : "❌ Échec"}
        </span>
      </div>
    </div>
  `;

  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: this.actor }),
    content: htmlCard
  });
});

html.find('.add2e-thief-skill-roll').off('click.add2e').on('click.add2e', async ev => {
  ev.preventDefault();
  ev.stopPropagation();
  const key = $(ev.currentTarget).data('thief-skill-key');
  await add2eRollThiefSkill(this.actor, key);
});

// 2. Click sur image/nom = attaque directe
html.find('.arme-img-attack').off('click').on('click', async ev => {
  const itemId = $(ev.currentTarget).data("item-id");
  const arme = this.actor.items.get(itemId);
  if (!arme) return;
  await globalThis.add2eAttackRoll({ actor: this.actor, arme });
});

html.find('.arme-img-attack').attr('draggable', 'true').off('dragstart').on('dragstart', ev => {
  const itemId = $(ev.currentTarget).data("item-id");
  const item = this.actor.items.get(itemId);
  if (!item) return;
  // Utilise l’UUID Foundry v10+ (fonctionne pour tout item, monstre ou non)
  const dragData = {
    type: "Item",
    uuid: item.uuid // Toujours la bonne référence
  };
  ev.originalEvent.dataTransfer.setData("text/plain", JSON.stringify(dragData));
});

// 2. Actions diverses groupées
html.find('[data-action]').off().on('click', async ev => {
  ev.stopPropagation();
  this._add2eRememberActiveTab(html);

  const $el = $(ev.currentTarget);
  const action = $el.data('action');
  const itemId = $el.data('item-id');
  const sortId = $el.data('sort-id');

  const actionNorm = String(action ?? "").trim().toLowerCase();
  const hasFeatureMarker =
    $el.data("feature-index") !== undefined ||
    $el.data("feature-name") !== undefined ||
    $el.data("feature-id") !== undefined ||
    $el.data("feature-key") !== undefined ||
    $el.data("on-use") !== undefined ||
    $el.closest("[data-feature-index], [data-feature-name], [data-feature-id], [data-feature-key], [data-on-use]").length > 0;

  const candidateFeature = add2eFindClassFeatureFromElement(this.actor, ev.currentTarget);
  const looksLikeFeatureUse =
    hasFeatureMarker ||
    actionNorm.includes("feature") ||
    actionNorm.includes("capacite") ||
    actionNorm.includes("capacité") ||
    actionNorm === "use-class-feature" ||
    actionNorm === "class-feature-use" ||
    (candidateFeature && !itemId && !sortId && (
      actionNorm === "use" ||
      actionNorm === "utiliser" ||
      actionNorm.includes("use") ||
      String($el.text() ?? "").trim().toLowerCase().includes("utiliser")
    ));

  if (looksLikeFeatureUse && candidateFeature) {
    await add2eExecuteClassFeatureOnUse(this.actor, candidateFeature, this);
    return;
  }

  if (looksLikeFeatureUse && !candidateFeature) {
    console.warn("[ADD2E][CAPACITE][CLICK] Bouton détecté mais capacité introuvable", {
      action,
      dataset: { ...($el[0]?.dataset ?? {}) },
      text: $el.text?.(),
      features: add2eGetActorActivableClassFeatures(this.actor).map(f => ({
        name: add2eFeatureName(f),
        on_use: add2eFeatureOnUse(f)
      }))
    });
    ui.notifications.warn("Capacité de classe introuvable pour ce bouton. Voir console [ADD2E][CAPACITE][CLICK].");
    return;
  }

  await handleItemAction({
    actor: this.actor,
    action,
    itemId,
    sheet: this
  });
});

// Fallback pour les boutons Utiliser de capacité qui n'ont pas data-action.
html.find('.add2e-feature-use, button, a, .a2e-btn').off('click.add2eFeatureFallback').on('click.add2eFeatureFallback', async ev => {
  const $el = $(ev.currentTarget);
  if ($el.data('item-id') || $el.data('sort-id')) return;

  const label = String($el.text?.() ?? "").trim().toLowerCase();
  const action = String($el.data('action') ?? "").trim().toLowerCase();
  const hasFeatureMarker =
    $el.hasClass('add2e-feature-use') ||
    $el.data("feature-index") !== undefined ||
    $el.data("feature-name") !== undefined ||
    $el.data("feature-id") !== undefined ||
    $el.data("feature-key") !== undefined ||
    $el.data("on-use") !== undefined;

  if (!hasFeatureMarker && !label.includes("utiliser") && !action.includes("feature") && !action.includes("capacite") && !action.includes("capacité")) return;

  const feature = add2eFindClassFeatureFromElement(this.actor, ev.currentTarget);
  if (!feature) return;

  ev.preventDefault();
  ev.stopPropagation();
  this._add2eRememberActiveTab(html);
  await add2eExecuteClassFeatureOnUse(this.actor, feature, this);
});

html.find('.roll-initiative-btn').off().on('click', async ev => {
  ev.preventDefault();
  const arme = this.actor.items.find(i => i.type === "arme" && i.system.equipee);
  const facteur = arme ? (Number(arme.system.facteur_rapidité) || 0) : 0;
  const roll = new Roll("1d6 + " + facteur);
  await roll.evaluate();
  await this.actor.update({ "system.initiative": roll.total });

  // Mets à jour dans le combat tracker si token actif
  const token = this.actor.getActiveTokens()[0];
  if (token && game.combat) {
    const combatant = game.combat.combatants.find(c => c.tokenId === token.id);
    if (combatant) {
      await combatant.update({ initiative: roll.total });
      await triInitiativeAscendant();
    }
  }
  roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor: this.actor }),
    flavor: `Initiative (facteur arme ${facteur >= 0 ? "+" : ""}${facteur})`
  });
});

// Depuis la fiche (dans ton click handler)
html.find('.arme-thaco-roll').off().on('click', async ev => {
  const itemId = $(ev.currentTarget).data("item-id");
  const arme = this.actor.items.get(itemId);
  if (!arme) return;
  await add2eAttackRoll({ actor: this.actor, arme });
});

    html.find('input[name="actor.name"]').off('change.add2e').on("change.add2e", async ev => {
      const newName = ev.target.value.trim();
      if (newName && newName !== this.actor.name) {
        await this.actor.update({ name: newName });
        this.render(false);
      }
    });

    html.find('.roll-caracs-btn').off('click.add2e').on('click.add2e', ev => {
      ev.preventDefault();
      if (typeof Add2eCaracRoller !== "undefined") {
        new Add2eCaracRoller(this);
      } else {
        ui.notifications.warn("Le module de tirage de caractéristiques n'est pas chargé !");
      }
    });

html.find('.armure-equip').off().on('click', async ev => {
  ev.preventDefault();
  ev.stopPropagation();
  this._add2eRememberActiveTab(html);

  const itemId = $(ev.currentTarget).data("item-id");
  await handleItemAction({
    actor: this.actor,
    action: "equip",
    itemId,
    itemType: "armure",
    sheet: this
  });
});

// Édition d'une armure
html.find('.armure-edit').off().on('click', ev => {
  const itemId = $(ev.currentTarget).data("item-id");
  const item = this.actor.items.get(itemId);
  if (item) item.sheet.render(true);
});

// Suppression d'une armure
html.find('.armure-delete').off().on('click', async ev => {
  const itemId = $(ev.currentTarget).data("item-id");
  await this.actor.deleteEmbeddedDocuments("Item", [itemId]);
  this.render(false);
});
// ============================================================
    // GESTION ÉQUIPEMENT (OBJETS DIVERS)
    // ============================================================

    // 1. CRÉER UN OBJET
    html.find('.objet-create').off("click").on("click", async ev => {
      ev.preventDefault();
      await Item.create({
        name: "Nouvel Objet",
        type: "objet",
        img: "icons/containers/bags/sack-cloth-tan.webp",
        system: { quantite: 1, poids: 0, equipee: false }
      }, { parent: this.actor });
    });

// 2. ÉQUIPER / DÉSÉQUIPER (Avec Script & Effets)
    html.find('.objet-equip').off("click").on("click", async ev => {
      ev.preventDefault();
      const li = $(ev.currentTarget).closest(".item");
      const itemId = li.data("itemId");
      const item = this.actor.items.get(itemId);
      
      if (item) {
         // 1. Bascule de l'état (Équipé <-> Non équipé)
         const newState = !item.system.equipee;
         await item.update({"system.equipee": newState});
         
         if (newState) {
             // --- CAS ACTIVATION (Équipé) ---
             // On regarde s'il y a un script 'onUse' à lancer
             const scriptPath = item.system.onUse || item.system.onuse;
             
             if (scriptPath) {
                 try {
                    const response = await fetch(scriptPath);
                    if (response.ok) {
                        const code = await response.text();
                        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
                        
                        // On passe 'item' comme source. 'sort' est null ici.
                        const fn = new AsyncFunction("actor", "item", "sort", code);
                        await fn(this.actor, item, null);
                        
                        ui.notifications.info(`${item.name} : Activé`);
                    } else {
                        console.warn(`[ADD2e] Script introuvable : ${scriptPath}`);
                    }
                 } catch(e) {
                    console.error(`[ADD2e] Erreur script objet :`, e);
                    ui.notifications.error(`Erreur script sur ${item.name}`);
                 }
             }
         } else {
             // --- CAS DÉSACTIVATION (Déséquipé) ---
             // On supprime automatiquement les effets liés à cet objet
             // (Ceux dont l'origine est l'UUID de l'objet)
             const effectsToDelete = this.actor.effects
                .filter(e => e.origin === item.uuid)
                .map(e => e.id);
             
             if (effectsToDelete.length > 0) {
                 await this.actor.deleteEmbeddedDocuments("ActiveEffect", effectsToDelete);
                 ui.notifications.info(`${item.name} : Désactivé (Effets retirés)`);
             }
         }

         // 3. Rafraîchissement de la fiche
         this.render(false);
      }
    });

    // 3. ÉDITER
    html.find('.objet-edit').off("click").on("click", ev => {
       ev.preventDefault();
       const li = $(ev.currentTarget).closest(".item");
       const itemId = li.data("itemId");
       const item = this.actor.items.get(itemId);
       if (item) item.sheet.render(true);
    });

    // 4. SUPPRIMER
    html.find('.objet-delete').off("click").on("click", async ev => {
       ev.preventDefault();
       const li = $(ev.currentTarget).closest(".item");
       const itemId = li.data("itemId");
       await this.actor.deleteEmbeddedDocuments("Item", [itemId]);
    });
    html.find('input[name="system.niveau"]').off('change.add2e').on("change.add2e", async ev => {
      let v = parseInt(ev.target.value, 10) || 1;
      const clamp = add2eClampLevelToClassMax(this.actor, v, null, { notify: true });
      v = clamp.level;
      ev.target.value = v;
      await this.actor.update({ "system.niveau": v });
      try { await add2eSyncMonkUnarmedWeapon(this.actor); } catch (e) { console.warn("[ADD2E][MOINE] Sync niveau échoué", e); }
      try { await add2eSyncClassPassiveEffect(this.actor); } catch (e) { console.warn("[ADD2E][CLASSE][EFFETS] Sync niveau échoué", e); }
      this.render(false);
    });
// Accordéon description (affiche/masque la description du sort)
html.find('.toggle-sort-desc-chat').off('click').on('click', function(ev) {
  ev.preventDefault();
  ev.stopPropagation();
  const sortId = $(this).data('sort-id');
  const descRow = html.find(`#desc-chat-${sortId}`);
  descRow.slideToggle(160);
  return false;
});

// Éditer le sort
html.find('.sort-edit').off().on('click', function(ev) {
  ev.preventDefault();
  ev.stopPropagation();
  const sortId = $(this).data('sort-id');
  const sort = self.actor.items.get(sortId);
  if (sort) sort.sheet.render(true);
  return false;
});

// Supprimer le sort
html.find('.sort-delete').off().on('click', async function(ev) {
  ev.preventDefault();
  ev.stopPropagation();
  const sortId = $(this).data('sort-id');
  await self.actor.deleteEmbeddedDocuments("Item", [sortId]);
  add2eRerenderActorSheet(self.actor);
  return false;
});

// Dans votre Add2eSortSheet.activateListeners(html)
html.find('.sort-memorize-plus, .sort-memorize-minus')
  .off('click')
  .on('click', async ev => {
    ev.preventDefault();
    ev.stopPropagation();

    const $btn = $(ev.currentTarget);
    const sortId = $btn.data('sort-id');
    const sort = this.actor.items.get(sortId);
    if (!sort) return;

    const isPlus = $btn.hasClass('sort-memorize-plus');
    const niv = Number(sort.system?.niveau ?? sort.system?.level ?? 1) || 1;
    const requestedEntryKey = add2eNormalizeSpellKey($btn.data('spell-entry-key') || $btn.attr('data-spell-entry-key') || "");

    let check = add2eCanActorUseSpell(this.actor, sort);

    if (requestedEntryKey) {
      const entries = add2eGetSpellcastingEntries(this.actor);
      const sortLists = add2eGetSpellListsFromItem(sort);
      const requestedEntry = entries.find(e => add2eNormalizeSpellKey(e.key) === requestedEntryKey) || null;

      if (!requestedEntry || !sortLists.includes(requestedEntryKey)) {
        return ui.notifications.warn(`Ce sort ne peut pas être préparé comme ${requestedEntry?.label || requestedEntryKey}.`);
      }

      const actorLevel = Math.max(1, Number(this.actor?.system?.niveau) || 1);
      const startsAt = Number(requestedEntry.startsAt || 1);
      const maxLevel = Number(requestedEntry.maxSpellLevel || 0);

      if (actorLevel < startsAt) {
        return ui.notifications.warn(`${requestedEntry.label || "Cette ligne de sorts"} n'est disponible qu'à partir du niveau ${startsAt}.`);
      }
      if (maxLevel && niv > maxLevel) {
        return ui.notifications.warn(`${requestedEntry.label || "Cette ligne de sorts"} ne permet pas les sorts de niveau ${niv}.`);
      }

      check = { ok: true, reason: "ok", entry: requestedEntry };
    }

    if (!check.ok) {
      const entry = check.entry;
      if (check.reason === "start") {
        return ui.notifications.warn(`${entry?.label || "Cette ligne de sorts"} n'est disponible qu'à partir du niveau ${entry?.startsAt}.`);
      }
      if (check.reason === "max-level") {
        return ui.notifications.warn(`${entry?.label || "Cette ligne de sorts"} ne permet pas les sorts de niveau ${niv}.`);
      }
      return ui.notifications.warn(`Ce sort n'est pas autorisé pour cette classe.`);
    }

    const entry = check.entry;
    let cur = add2eGetMemorizedCountForEntry(sort, entry);

    if (isPlus) {
      const limit = add2eGetSlotsForEntryLevel(this.actor, entry, niv);
      const total = add2eCountPreparedForEntryLevel(this.actor, entry, niv);

      if (limit <= 0) {
        return ui.notifications.warn(`Aucun emplacement ${entry.label} de niveau ${niv} disponible.`);
      }

      if (total >= limit) {
        return ui.notifications.warn(`Limite atteinte : ${entry.label} niveau ${niv} (${total}/${limit}).`);
      }

      cur++;
    } else {
      if (cur > 0) cur--;
      else return ui.notifications.warn(`Aucun emplacement ${entry.label} à libérer.`);
    }

    await add2eSetMemorizedCountForEntry(sort, entry, cur);
    add2eRerenderActorSheet(this.actor);
  });

// Clic pour lancer le sort ou un pouvoir d'objet magique
// -----------------------------------------------------------
// Mécanique conservée : les pouvoirs d'objets sont reconstruits en faux Item sort,
// puis envoyés dans add2eCastSpell comme le faisait déjà le Bâton de Magius.
// Le branchement est seulement rendu délégué pour rester actif après les réinjections UI.
html
  .off("click.add2eSortCast")
  .on("click.add2eSortCast", ".sort-cast, .sort-cast-img, .add2e-object-magic-cast", async function(ev) {
    ev.preventDefault();
    ev.stopPropagation();

    const sortId = String(
      this.dataset?.sortId ||
      this.getAttribute?.("data-sort-id") ||
      $(this).data("sort-id") ||
      ""
    ).trim();

    const debug = !!globalThis.ADD2E_DEBUG_OBJETS_MAGIQUES;

    if (debug) {
      console.group("[ADD2E][OBJETS_MAGIQUES][CLICK]");
      console.log("element", this);
      console.log("sortId", sortId);
    }

    if (!sortId) {
      if (debug) console.groupEnd();
      ui.notifications.warn("Impossible de lancer : identifiant du sort introuvable.");
      return false;
    }

    // 1. Sort réel présent dans l'acteur.
    let sort = self.actor.items.get(sortId) ?? null;

    if (debug) console.log("Sort réel trouvé", !!sort, sort);

    // 2. Pouvoir virtuel d'objet magique : on retrouve l'objet source + l'index du pouvoir.
    if (!sort) {
      const itemSources = self.actor.items.filter(i => {
        if (!["arme", "armure", "objet", "object", "magic", "objet_magique"].includes(String(i.type || "").toLowerCase())) return false;

        // Ne pas filtrer agressivement sur equipee : la section objets magiques affiche volontairement
        // les objets magiques possédés, et le Bâton de Magius fonctionnait avec cette logique souple.
        if (typeof add2eMagicItemEquippedOrUsable === "function") {
          if (!add2eMagicItemEquippedOrUsable(i)) return false;
        } else if (i.system?.equipee === false) return false;

        const pouvoirs = typeof add2eMagicObjectPowerArray === "function"
          ? add2eMagicObjectPowerArray(i)
          : (() => {
              const raw = i.system?.pouvoirs ?? i.system?.powers ?? i.system?.pouvoirsMagiques ?? i.system?.magicalPowers ?? i.system?.sorts ?? i.system?.spells;
              if (Array.isArray(raw)) return raw.filter(p => p && typeof p === "object");
              if (raw && typeof raw === "object") return Object.values(raw).filter(p => p && typeof p === "object");
              return [];
            })();

        return pouvoirs.length > 0;
      });

      if (debug) {
        console.log("Sources objets magiques candidates", itemSources.map(i => ({ id: i.id, name: i.name, type: i.type })));
      }

      for (const itemSource of itemSources) {
        const pouvoirs = typeof add2eMagicObjectPowerArray === "function"
          ? add2eMagicObjectPowerArray(itemSource)
          : (() => {
              const raw = itemSource.system?.pouvoirs ?? itemSource.system?.powers ?? itemSource.system?.pouvoirsMagiques ?? itemSource.system?.magicalPowers ?? itemSource.system?.sorts ?? itemSource.system?.spells;
              if (Array.isArray(raw)) return raw.filter(p => p && typeof p === "object");
              if (raw && typeof raw === "object") return Object.values(raw).filter(p => p && typeof p === "object");
              return [];
            })();

        for (let idx = 0; idx < pouvoirs.length; idx++) {
          const generatedId = typeof add2eMagicPowerGeneratedId === "function"
            ? add2eMagicPowerGeneratedId(itemSource, idx)
            : itemSource.id.substring(0, 14) + idx.toString().padStart(2, "0");

          if (debug) {
            console.log("[CHECK POUVOIR OBJET]", {
              item: itemSource.name,
              idx,
              generatedId,
              sortId,
              match: generatedId === sortId,
              pouvoir: pouvoirs[idx]
            });
          }

          if (generatedId !== sortId) continue;

          if (typeof add2eBuildVirtualObjectPowerSort === "function") {
            sort = add2eBuildVirtualObjectPowerSort(self.actor, itemSource, pouvoirs[idx], idx);
          } else {
            const p = pouvoirs[idx];
            const onUse = String(p?.onUse ?? p?.onuse ?? p?.on_use ?? p?.script ?? "").trim();
            const cost = Math.max(0, Number(p?.cout ?? p?.cost ?? 0) || 0);
            const maxGlobal = Number(itemSource.system?.charges?.max ?? itemSource.system?.max_charges ?? 0) || 0;
            const isGlobal = maxGlobal > 0;
            const max = cost <= 0 ? 1 : (isGlobal ? maxGlobal : (Number(p?.max ?? p?.charges ?? 1) || 1));

            sort = new Item({
              _id: generatedId,
              name: String(p?.name ?? p?.nom ?? itemSource.name ?? "Pouvoir"),
              type: "sort",
              img: p?.img || itemSource.img,
              system: {
                niveau: Number(p?.niveau ?? p?.level ?? 1) || 1,
                école: p?.ecole || p?.["école"] || "Magique",
                description: p?.description || "",
                composantes: "Objet",
                temps_incantation: p?.activation || "Objet magique",
                isPower: true,
                isObjectPower: true,
                sourceWeaponId: itemSource.id,
                sourceItemId: itemSource.id,
                sourceItemName: itemSource.name,
                powerIndex: idx,
                cost,
                cout: cost,
                max,
                isGlobalCharge: isGlobal,
                onUse,
                onuse: onUse,
                on_use: onUse
              },
              flags: {
                add2e: {
                  memorizedCount: cost <= 0 ? 1 : max,
                  originalOnUse: onUse,
                  sourceType: "objet_magique",
                  sourceItemId: itemSource.id,
                  sourceItemName: itemSource.name,
                  powerIndex: idx
                }
              }
            }, { parent: self.actor });

            sort.getFlag = (scope, key) => {
              if (scope !== "add2e") return null;
              if (key === "memorizedCount") return cost <= 0 ? 1 : max;
              if (key === "originalOnUse") return onUse;
              return sort.flags?.add2e?.[key] ?? null;
            };
          }

          if (debug) {
            console.log("[POUVOIR VIRTUEL REBRANCHÉ]", {
              sort,
              system: sort?.system,
              flags: sort?.flags,
              memorizedCount: sort?.getFlag?.("add2e", "memorizedCount")
            });
          }

          break;
        }

        if (sort) break;
      }
    }

    // 3. Lancement par la mécanique existante.
    if (sort) {
      if (typeof globalThis.add2eCastSpell === "function") {
        if (debug) {
          console.log("[LANCEMENT add2eCastSpell]", {
            actor: self.actor?.name,
            sort: sort.name,
            sortId: sort.id,
            system: sort.system,
            flags: sort.flags
          });
          console.groupEnd();
        }

        await globalThis.add2eCastSpell({ actor: self.actor, sort });
        self.render(false);
      } else {
        if (debug) console.groupEnd();
        ui.notifications.error("La fonction add2eCastSpell est introuvable.");
      }
    } else {
      if (debug) {
        console.warn("Aucun sort/pouvoir retrouvé pour", sortId);
        console.groupEnd();
      }
      ui.notifications.warn("Impossible de retrouver les données de ce sort ou pouvoir d'objet magique.");
    }

    return false;
  });

// Drag’n’drop de l’icône
html.find('.sort-cast-img')
  .off('dragstart')
  .on('dragstart', ev => {
    const sortId = $(ev.currentTarget).data('sort-id');
    const item   = this.actor.items.get(sortId);
    if (!item) return;
    ev.originalEvent.dataTransfer.setData(
      "text/plain",
      JSON.stringify({ type: "Item", uuid: item.uuid })
    );
  });
html.find('.file-picker').off().on('click', ev => {
    const target = $(ev.currentTarget).data('target');
    new FilePicker({
      type: "image",
      current: this.item.img || "icons/svg/mystery-man.svg",
      callback: path => {
        this.item.update({ [target]: path });
        html.find('input[name="img"]').val(path);
        html.find('img[alt="Icône"]').attr('src', path);
      }
    }).render(true);
  });
html.find('input[name="name"]').off('change.add2e').on("change.add2e", async ev => {
  const newName = ev.target.value.trim();
  if (newName && newName !== this.actor.name) {
    // 1. Mets à jour l'acteur (name)
    await this.actor.update({ name: newName });
    // 2. Mets à jour le prototype du token (pour les nouveaux tokens)
    await this.actor.update({ "prototypeToken.name": newName });

    // 3. Mets à jour les tokens existants sur la scène (optionnel)
    for (let t of this.actor.getActiveTokens()) {
      if (t.document && t.document.name !== newName) {
        await t.document.update({ name: newName });
      }
    }

    this.render(false);
  }
});

html.find('.file-picker').off().on('click', ev => {
  const target = $(ev.currentTarget).data('target');
  new FilePicker({
    type: "image",
    current: this.actor.img || "icons/svg/mystery-man.svg",
    callback: path => {
      majImageToken(this.actor, path);
      html.find('input[name="img"]').val(path);
      html.find('img[alt="Image du monstre"]').attr('src', path); // adapte si besoin
    }
  }).render(true);
});

     this.autoSetCaracAjustements();
  }

async _onDrop(event) {
  event.preventDefault();
  event.stopPropagation();
  let raw;
  try {
    raw = JSON.parse(event.dataTransfer.getData("text/plain"));
  } catch {
    console.warn("[ADD2E] Drop non JSON, fallback natif");
    return super._onDrop(event);
  }

  if (raw.type !== "Item") return super._onDrop(event);

  let itemData = raw.data;
  if (!itemData && raw.uuid) {
    const doc = await fromUuid(raw.uuid);
    if (doc instanceof Item) itemData = doc.toObject();
  }
  if (!itemData && raw.pack && raw.id) {
    const pack = game.packs.get(raw.pack);
    const ent = pack && await pack.getDocument(raw.id);
    if (ent instanceof Item) itemData = ent.toObject();
  }
  if (!itemData) {
    console.warn("[ADD2E] _onDrop impossible de reconstruire itemData", raw);
    return super._onDrop(event);
  }

  const VALID = ["arme", "armure", "sort", "classe", "race"];
  if (!VALID.includes(itemData.type)) return super._onDrop(event);

 // --- Validation générique du drop de sort par lignes de sorts
if (itemData.type === "sort") {
  console.log("=== [ADD2E DROP SORT][POOLS] ===");
  console.log("actor:", { id: this.actor?.id, name: this.actor?.name });
  console.log("itemData:", itemData);

  let source = null;

  if (itemData.uuid) {
    source = await fromUuid(itemData.uuid);
  }

  if (!source && itemData.pack && itemData._id) {
    const pack = game.packs.get(itemData.pack);
    if (pack) source = await pack.getDocument(itemData._id);
  }

  if (!source && itemData.system) {
    source = { name: itemData.name, type: itemData.type, system: itemData.system };
  }

  if (!source || !source.system) {
    console.log("[ADD2E DROP SORT][POOLS] ❌ FAIL: source unresolved");
    ui.notifications.error("Impossible de résoudre le sort.");
    return false;
  }

  const check = add2eCanActorUseSpell(this.actor, source);

  console.log("[ADD2E DROP SORT][POOLS] check:", {
    sort: source.name,
    sortLists: check.sortLists,
    actorEntries: check.entries,
    selectedEntry: check.entry,
    reason: check.reason,
    actorLevel: check.actorLevel,
    spellLevel: check.spellLevel
  });

  if (!check.sortLists?.length) {
    ui.notifications.error(`Sort non migré : “${source.name}” n’a pas system.spellLists.`);
    return false;
  }

  if (!check.ok) {
    const entry = check.entry;
    if (check.reason === "list") {
      ui.notifications.error(`${this.actor.name} ne peut pas apprendre ou préparer “${source.name}” : ligne de sort non autorisée (${check.sortLists.map(add2eSpellLabel).join(", ")}).`);
    } else if (check.reason === "start") {
      ui.notifications.error(`${this.actor.name} ne peut pas encore préparer “${source.name}” : ${entry?.label || "cette ligne"} commence au niveau ${entry?.startsAt}.`);
    } else if (check.reason === "max-level") {
      ui.notifications.error(`${this.actor.name} ne peut pas préparer “${source.name}” : ${entry?.label || "cette ligne"} est limitée aux sorts de niveau ${entry?.maxSpellLevel}.`);
    } else {
      ui.notifications.error(`${this.actor.name} ne peut pas apprendre ou préparer “${source.name}”.`);
    }
    return false;
  }

  console.log("[ADD2E DROP SORT][POOLS] ✅ DROP SORT OK", {
    sort: source.name,
    list: check.entry?.label,
    spellLevel: check.spellLevel
  });
}
// --- Prévalidation race/classe AVANT toute modification de l'acteur.
  // Important : on ne met plus à jour system.classe/details_classe avant validation,
  // sinon un drop refusé laisse la fiche avec des données mélangées.
  // Si seule la compatibilité race/classe bloque, on corrige automatiquement
  // comme pour l'alignement : drop classe => race compatible ; drop race => classe compatible.
  let add2eClassAlignmentCandidate = null;
  let add2eAutoRaceCandidateData = null;
  let add2eAutoClassCandidateData = null;
  let add2eAutoClassAlignmentCandidate = null;

  if (itemData.type === "classe") {
    add2eClassAlignmentCandidate = add2ePickClassAlignment(this.actor, itemData.system ?? {});

    if (typeof checkClassStatMin === "function") {
      let ok = checkClassStatMin(this.actor, itemData, null, add2eClassAlignmentCandidate, { silent: true, ignoreLevelMax: true });

      if (!ok) {
        const compatibleRace = add2eFindCompatibleRaceForClass(this.actor, itemData, add2eClassAlignmentCandidate);
        if (compatibleRace) {
          add2eAutoRaceCandidateData = compatibleRace;
          ok = checkClassStatMin(this.actor, itemData, compatibleRace, add2eClassAlignmentCandidate, { silent: true, ignoreLevelMax: true });
        }
      }

      if (!ok) {
        // Dernier appel non silencieux pour conserver le message précis des vrais prérequis bloquants.
        checkClassStatMin(this.actor, itemData, add2eAutoRaceCandidateData, add2eClassAlignmentCandidate, { silent: false, ignoreLevelMax: true });
        console.warn("[ADD2e] Blocage prise de classe (aucune race compatible trouvée ou prérequis NON atteints)", {
          actor: this.actor?.name,
          classe: itemData?.name,
          raceAuto: add2eAutoRaceCandidateData?.name ?? null,
          alignementTeste: add2eClassAlignmentCandidate
        });
        add2eRerenderActorSheet(this.actor);
        return false;
      }
    } else {
      console.warn("[ADD2e] Fonction checkClassStatMin NON trouvée !");
    }
  }

  if (itemData.type === "race") {
    const existingClass = this.actor.items.find(i => i.type === "classe");
    if (existingClass && typeof checkClassStatMin === "function") {
      let existingAlignment = add2ePickClassAlignment(this.actor, existingClass.system ?? {});
      let ok = checkClassStatMin(
        this.actor,
        existingClass,
        itemData,
        existingAlignment,
        { silent: true, ignoreLevelMax: true }
      );

      if (!ok) {
        const compatibleClass = add2eFindCompatibleClassForRace(this.actor, itemData);
        if (compatibleClass?.classData) {
          add2eAutoClassCandidateData = compatibleClass.classData;
          add2eAutoClassAlignmentCandidate = compatibleClass.alignmentCandidate;
          ok = checkClassStatMin(
            this.actor,
            add2eAutoClassCandidateData,
            itemData,
            add2eAutoClassAlignmentCandidate,
            { silent: true, ignoreLevelMax: true }
          );
        }
      }

      if (!ok) {
        checkClassStatMin(
          this.actor,
          add2eAutoClassCandidateData ?? existingClass,
          itemData,
          add2eAutoClassAlignmentCandidate ?? existingAlignment,
          { silent: false, ignoreLevelMax: true }
        );
        console.warn("[ADD2e] Blocage prise de race (aucune classe compatible trouvée ou prérequis NON atteints)", {
          actor: this.actor?.name,
          race: itemData?.name,
          classeActuelle: existingClass?.name,
          classeAuto: add2eAutoClassCandidateData?.name ?? null
        });
        add2eRerenderActorSheet(this.actor);
        return false;
      }
    }
  }

  // Drop d'une classe incompatible avec la race actuelle : on remplace la race avant
  // de créer la classe, afin que la fiche reste cohérente et que le niveau max racial
  // soit calculé sur la bonne race.
  if (itemData.type === "classe" && add2eAutoRaceCandidateData) {
    await add2eApplyRaceItemDataToActor(this.actor, add2eAutoRaceCandidateData, this, {
      notify: true,
      reason: "class-drop-race-auto-compat"
    });
  }

  // --- Remplace ancienne race (et ses effets)
  if (itemData.type === "race") {
    const existingRaces = this.actor.items.filter(i => i.type === "race");
    for (const oldRace of existingRaces) {
      const raceEffects = this.actor.effects.filter(eff => eff.origin === oldRace.uuid);
      if (raceEffects.length) {
        const ids = raceEffects.map(e => e.id).filter(id => this.actor.effects.has(id));
        if (ids.length) {
          await this.actor.deleteEmbeddedDocuments("ActiveEffect", ids);
        }
      }
      await oldRace.delete();
    }
    // Supprime les anciens bonus raciaux
    await this.actor.update({ "system.bonus_caracteristiques": {} });
  }


// --- Changement de classe : purge ancienne classe + sorts + armes + armures
// Important : on ne supprime PAS la race.
// Important : suppression item par item, plus fiable sur token non lié / acteur synthétique.
if (itemData.type === "classe") {
  console.log("=== [ADD2E][DROP CLASSE][PURGE] ===", {
    actor: this.actor.name,
    nouvelleClasse: itemData.name,
    actorIsToken: this.actor.isToken ?? false,
    tokenId: this.actor.token?.id ?? null
  });

  const typesToDelete = ["classe", "sort", "arme", "armure", "spell", "weapon", "armor"];

  const itemsToDelete = this.actor.items.filter(i =>
    typesToDelete.includes(String(i.type || "").toLowerCase())
  );

  console.log("[ADD2E][DROP CLASSE][PURGE] items à supprimer :", itemsToDelete.map(i => ({
    id: i.id,
    name: i.name,
    type: i.type,
    uuid: i.uuid
  })));

  // Effets liés aux items supprimés et effets de classe générés sans origine fiable.
  const effectsToDelete = this.actor.effects.filter(eff =>
    add2eShouldDeleteEffectForClassPurge(eff, itemsToDelete)
  );

  console.log("[ADD2E][DROP CLASSE][PURGE] effets liés à supprimer :", effectsToDelete.map(e => ({
    id: e.id,
    name: e.name,
    origin: e.origin
  })));

  for (const eff of effectsToDelete) {
    await eff.delete({ render: false });
  }

  for (const it of itemsToDelete) {
    console.log("[ADD2E][DROP CLASSE][PURGE] suppression item :", {
      id: it.id,
      name: it.name,
      type: it.type
    });

    await it.delete({ render: false });
  }

  console.log("[ADD2E][DROP CLASSE][PURGE] items restants après purge :", this.actor.items.map(i => ({
    id: i.id,
    name: i.name,
    type: i.type
  })));
}

  // --- Anti-doublon (évite d'ajouter deux fois le même item)
  if (["arme", "armure", "sort"].includes(itemData.type)) {
    if (this.actor.items.some(i => i.name === itemData.name && i.type === itemData.type)) {
      ui.notifications.warn(`"${itemData.name}" est déjà présent sur cet acteur.`);
      return false;
    }
  }

  // --- Création de l'Item
  const [itemDoc] = await this.actor.createEmbeddedDocuments("Item", [foundry.utils.duplicate(itemData)]);
  if (!itemDoc) {
    console.warn("[ADD2E] Échec de création de l'item (itemDoc undefined) :", itemData);
    return false;
  }

   // --- Application effets embarqués SAUF pour les sorts
  if (itemData.type !== "sort" && itemDoc.effects.contents?.length) {
    const actorEffects = itemDoc.effects.contents.map(eff => {
      const data = foundry.utils.duplicate(eff.toObject());
      data.origin = itemDoc.uuid;
      data.disabled = false;
      data.transfer = false;
      data.flags = data.flags ?? {};
      data.flags.add2e = {
        ...(data.flags.add2e ?? {}),
        sourceType: itemDoc.type === "classe" ? "classe" : itemDoc.type,
        sourceClasse: itemDoc.type === "classe" ? itemDoc.name : undefined,
        sourceItemId: itemDoc.id,
        sourceItemUuid: itemDoc.uuid
      };
      return data;
    });
    await this.actor.createEmbeddedDocuments("ActiveEffect", actorEffects);
  }

  // --- Traitement spécial classe (alignements, etc.)
  // La mise à jour complète de system.classe/details_classe est faite plus bas,
  // après création effective de l'item classe.

  // --- Application effets et bonus pour race
  if (itemData.type === "race") {
    const raceSystem = foundry.utils.deepClone(itemDoc.system ?? {});
    await this.actor.update({
      "system.race": itemDoc.name,
      "system.details_race": {
        ...raceSystem,
        name: itemDoc.name,
        label: raceSystem.label || itemDoc.name,
        img: itemDoc.img || raceSystem.img || ""
      },
      "system.bonus_caracteristiques": raceSystem.bonus_caracteristiques
        ? foundry.utils.deepClone(raceSystem.bonus_caracteristiques)
        : {}
    });

    if (typeof this.autoSetCaracAjustements === "function") {
      await this.autoSetCaracAjustements();
    }

    // Drop d'une race incompatible avec la classe actuelle : on remplace la classe
    // par une classe compatible après l'application de la nouvelle race.
    if (add2eAutoClassCandidateData) {
      await add2eApplyClassItemDataToActor(this.actor, add2eAutoClassCandidateData, this, {
        alignmentCandidate: add2eAutoClassAlignmentCandidate,
        notify: true,
        reason: "race-drop-class-auto-compat"
      });
    } else {
      // La race peut modifier le niveau maximum autorisé de la classe actuelle.
      // On accepte le drop, puis on ramène proprement le niveau si nécessaire.
      try {
        const currentClass = this.actor.items.find(i => i.type === "classe");
        if (currentClass) {
          const classSystem = foundry.utils.deepClone(currentClass.system ?? this.actor.system?.details_classe ?? {});
          const clamp = add2eClampLevelToClassMax(this.actor, this.actor.system?.niveau, classSystem, { notify: true });
          if (clamp.changed) {
            await this.actor.update({ "system.niveau": clamp.level }, { add2eInternal: true });
            if (typeof this.autoSetPointsDeCoup === "function") {
              await this.autoSetPointsDeCoup({ syncCurrent: true, force: true, reason: "race-drop-level-clamp" });
            }
          }
        }
      } catch (e) {
        console.warn("[ADD2E][DROP RACE][NIVEAU MAX] Erreur correction niveau max après drop race", e);
      }
    }
  }

  // --- Application effets + sauvegardes pour classe
  if (itemData.type === "classe") {
    const classSystem = foundry.utils.deepClone(itemDoc.system ?? {});
    const levelClamp = add2eClampLevelToClassMax(this.actor, this.actor.system?.niveau, classSystem, { notify: true });
    const alns = add2eClassAllowedAlignments(classSystem);
    const updates = {
      "system.classe": itemDoc.name,
      "system.details_classe": classSystem,
      "system.spellcasting": classSystem.spellcasting ?? null,
      "system.alignements_autorises": alns
    };

    if (levelClamp.changed) {
      updates["system.niveau"] = levelClamp.level;
    }

    if (add2eClassAlignmentCandidate) {
      updates["system.alignement"] = add2eClassAlignmentCandidate;
    }

    if (itemDoc.system?.progression?.[0]?.sauvegardes) {
      updates["system.sauvegardes"] = foundry.utils.duplicate(itemDoc.system.progression[0].sauvegardes);
    }

    await this.actor.update(updates);
    if (typeof this.autoSetCaracAjustements === "function") {
      await this.autoSetCaracAjustements();
    }
   if (typeof this.autoSetPointsDeCoup === "function") {
  await this.autoSetPointsDeCoup({ syncCurrent: true, force: true, reason: "class-drop" });
}
    try {
      await add2eSyncMonkUnarmedWeapon(this.actor);
    } catch (e) {
      console.warn("[ADD2E][MOINE] Erreur synchronisation Main nue après drop classe :", e);
    }

    try {
      await add2eSyncClassPassiveEffect(this.actor);
    } catch (e) {
      console.warn("[ADD2E][CLASSE][EFFETS] Erreur synchronisation des effets de classe :", e);
    }

    try {
      const spellSync = await add2eSyncActorSpellsFromClass(this.actor, itemDoc, { mode: "replace", showWait: true });
      if (spellSync?.handled) {
        ui.notifications.info(
          `Sorts de ${itemDoc.name} synchronisés : ${spellSync.imported} importé(s).`
        );
      }
    } catch (e) {
      console.error("[ADD2E][CLASSE][SORTS] Erreur synchronisation des sorts après drop classe :", e);
      ui.notifications.error("Erreur pendant la synchronisation des sorts de classe.");
    }
  }

  this.render(false);
  return true;
}




}

Actors.registerSheet("add2e", Add2eActorSheet, {
  types: ["personnage"], makeDefault: true, label: "ADD2e Personnage"
});




globalThis.Add2eActorSheet = Add2eActorSheet;
class Add2eArmureSheet extends ItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["add2e", "sheet", "item", "armure"],
      template: "systems/add2e/templates/item/armure-sheet.hbs",
      width: 500,
      height: 430,
      resizable: true
    });
  }
  async getData() {
  const data = await super.getData();
      data.system = data.item.system;
  data.img = this.item.img || "icons/svg/mystery-man.svg";
  return data;
}

  activateListeners(html) {
    super.activateListeners(html);
    add2eRegisterImgPicker(html, this);
    // Ajoute ici des listeners custom si besoin (ex : bouton, bascule équipee…)
    html.find(".toggle-equip").on("click", async ev => {
      ev.preventDefault();
      const value = !this.item.system.equipee;
      await this.item.update({"system.equipee": value});
      this.render(false);
    });
 
  }
}
globalThis.Add2eArmureSheet = Add2eArmureSheet;
Items.registerSheet("add2e", Add2eArmureSheet, {
  types: ["armure"],
  makeDefault: true,
  label: "ADD2e Armure"
});


class Add2eObjetSheet extends ItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["add2e", "sheet", "item", "objet", "objet-magique"],
      template: "systems/add2e/templates/item/objet-sheet.hbs",
      width: 760,
      height: "auto",
      resizable: true,
      tabs: [{ navSelector: ".tabs", contentSelector: ".sheet-body", initial: "resume" }]
    });
  }

  async getData(options = {}) {
    const data = await super.getData(options);
    const item = this.item ?? this.object;
    const system = item?.system ?? {};

    const toArray = value => {
      if (!value) return [];
      if (Array.isArray(value)) return value.filter(v => v !== undefined && v !== null && String(v).trim() !== "");
      if (typeof value === "object") return Object.values(value).filter(v => v !== undefined && v !== null && String(v).trim() !== "");
      if (typeof value === "string") return value.split(/[,;|\n]+/).map(v => v.trim()).filter(Boolean);
      return [];
    };

    const powersRaw = system.pouvoirs ?? system.powers ?? system.pouvoirsMagiques ?? system.magicalPowers ?? [];
    const pouvoirs = Array.isArray(powersRaw)
      ? powersRaw.filter(p => p && typeof p === "object")
      : (powersRaw && typeof powersRaw === "object" ? Object.values(powersRaw).filter(p => p && typeof p === "object") : []);

    data.item = item;
    data.system = system;
    data.img = item?.img || "icons/svg/mystery-man.svg";
    data.pouvoirs = pouvoirs;
    data.tags = toArray(system.tags);
    data.effectTags = toArray(system.effectTags ?? system.effets ?? system.effects);
    data.charges = {
      value: Number(system.charges?.value ?? system.chargesValeur ?? system.current_charges ?? system.currentCharges ?? 0) || 0,
      max: Number(system.charges?.max ?? system.max_charges ?? system.maxCharges ?? system.charges_max ?? 0) || 0
    };
    data.isMagicItem = system.magique === true || system.magic === true || String(system.categorie ?? "").toLowerCase().includes("magique");

    return data;
  }

  activateListeners(html) {
    super.activateListeners(html);
    add2eRegisterImgPicker(html, this);

    html.find(".tabs a").off("click.add2e-objet-tab").on("click.add2e-objet-tab", ev => {
      ev.preventDefault();
      const tab = ev.currentTarget.dataset.tab;
      html.find(".tabs a").removeClass("active");
      html.find(ev.currentTarget).addClass("active");
      html.find(".sheet-body .content").addClass("hidden");
      html.find(`.sheet-body .content[data-tab="${tab}"]`).removeClass("hidden");
    });
  }
}

globalThis.Add2eObjetSheet = Add2eObjetSheet;
Items.registerSheet("add2e", Add2eObjetSheet, {
  types: ["objet"],
  makeDefault: true,
  canConfigure: true,
  canBeDefault: true,
  label: "ADD2e Objet"
});

class Add2eArmeSheet extends ItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["add2e", "sheet", "item", "arme"],
      template: "systems/add2e/templates/item/arme-sheet.hbs",
      width: 500,
      height: 400,
      resizable: true
    });
  }
  async getData() {
  const data = await super.getData();
      data.system = data.item.system;
  data.img = this.item.img || "icons/svg/mystery-man.svg";
  return data;
}
    activateListeners(html) {
    super.activateListeners(html);
add2eRegisterImgPicker(html, this);
  }

}
globalThis.Add2eArmeSheet = Add2eArmeSheet;
Items.registerSheet("add2e", Add2eArmeSheet, {
  types: ["arme"],
  makeDefault: true,
  label: "ADD2e Arme"
});
class Add2eSortSheet extends ItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["add2e", "sheet", "item", "sort"],
      template: "systems/add2e/templates/item/sort-sheet.hbs", // Chemin réel de ton template sort
      width: 500,
      height: "auto",
      resizable: true
    });
  }

 async getData() {
  const data = await super.getData();

  // Pour une ItemSheet (sort), toujours utiliser this.item
  data.name   = this.item?.name ?? "";
  data.img    = this.item?.img ?? "icons/svg/mystery-man.svg";
  data.system = this.item?.system ?? {};

  data.system.number         ??= "";
  data.system.diet           ??= "";
  data.system.encounterTable ??= "";

  // Les listes d’items (armes/armures/sorts) n’ont pas de sens dans une fiche de sort isolée
  // Sauf si la fiche sort est affichée “embarquée” dans un acteur (cas Foundry rare, mais tu peux le garder en fallback)
  data.listeArmes   = [];
  data.listeArmures = [];
  data.listeSorts   = [];

  if (this.item?.parent && this.item.parent.documentName === "Actor") {
    // L’item est bien embarqué sur un acteur (fiche PJ)
    const actorItems = this.item.parent.items || [];
    data.listeArmes   = actorItems.filter(i => i.type === "arme");
    data.listeArmures = actorItems.filter(i => i.type === "armure");
    data.listeSorts   = actorItems.filter(i => i.type === "sort");
  }

  // SECTION CRITIQUE POUR SORTS PAR NIVEAU
  const sorts = data.listeSorts ?? [];
  const sortsParNiveau = {};
  for (const sort of sorts) {
    let niveau = Number(sort.system?.niveau || sort.system?.level || 1);
    if (!niveau || isNaN(niveau)) niveau = 1;
    if (!sortsParNiveau[niveau]) sortsParNiveau[niveau] = [];
    sortsParNiveau[niveau].push(sort);
  }
  const niveauxSorts = Object.keys(sortsParNiveau).map(Number).sort((a, b) => a - b);

  data.sortsParNiveau = sortsParNiveau;
  data.niveauxSorts = niveauxSorts;

  // Champ pour la section “mémorisés” du template
  data.sortsMemorizedByLevel = {};

  return data;
}



    activateListeners(html) {
    super.activateListeners(html);
add2eRegisterImgPicker(html, this);
  }
}
globalThis.Add2eSortSheet = Add2eSortSheet;
Items.registerSheet("add2e", Add2eSortSheet, {
  types: ["sort"],
  makeDefault: true,
  label: "ADD2e Sort"
});


class Add2eRaceSheet extends ItemSheet {
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ["add2e", "sheet", "item", "race-sheet-modern"],
      template: "systems/add2e/templates/item/race-sheet.hbs",
      width: 700,
      height: "auto",
      resizable: true,
      tabs: [{navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "main"}],
      scrollY: [".sheet-body"],
    });
  }

async getData() {
  const data = await super.getData();
  // Patch sécurité pour éviter les erreurs "undefined"
  data.system = data.system || data.item?.system || {};

  // -- Transforme les objets en array pour Handlebars si besoin --
  const toArray = obj =>
    Array.isArray(obj)
      ? obj
      : typeof obj === "object" && obj !== null
        ? Object.entries(obj)
            .filter(([k]) => !["NEW", "NEW_KEY", "NEW_VAL"].includes(k))
            .filter(([k, v]) => v !== "" && v !== null && v !== undefined)
            .map(([_, v]) => v)
        : [];

  // Capacités raciales (toujours array pour le HBS)
  data.system.capacites = toArray(data.system.capacites);

  // Limites de classes (clé → valeur)
  if (typeof data.system.limites_classes !== "object" || Array.isArray(data.system.limites_classes))
    data.system.limites_classes = {};
  // Min/Max caracs
  if (typeof data.system.min_caracteristiques !== "object" || Array.isArray(data.system.min_caracteristiques))
    data.system.min_caracteristiques = {};
  if (typeof data.system.max_caracteristiques !== "object" || Array.isArray(data.system.max_caracteristiques))
    data.system.max_caracteristiques = {};
  // Bonus caracs
  if (typeof data.system.bonus_caracteristiques !== "object" || Array.isArray(data.system.bonus_caracteristiques))
    data.system.bonus_caracteristiques = {};

  // Valeurs textuelles (par défaut vide)
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


  activateListeners(html) {
    super.activateListeners(html);
 
    // Image picker Foundry natif
    html.find('img[data-edit="img"]').off().on('click', ev => {
      ev.preventDefault();
      new FilePicker({
        type: "image",
        current: this.item.img,
        callback: path => {
          this.item.update({ img: path });
          html.find('img[data-edit="img"]').attr('src', path);
          html.find('input[name="img"]').val(path);
        }
      }).render(true);
    });

    // Autosave sur modification des champs (optionnel)
    html.find('input, textarea, select').on('change', async (event) => {
      event.preventDefault();
      const form = html.find('form')[0] || html[0];
      const formData = new FormData(form);
      let updateData = foundry.utils.expandObject(Object.fromEntries(formData));

      // Ajoute un nouveau bonus carac si les champs sont remplis
      if (updateData.system?.bonus_caracteristiques?.NEW_KEY) {
        const k = updateData.system.bonus_caracteristiques.NEW_KEY.trim();
        const v = Number(updateData.system.bonus_caracteristiques.NEW_VAL) || 0;
        if (k) {
          updateData[`system.bonus_caracteristiques.${k}`] = v;
        }
        delete updateData.system.bonus_caracteristiques.NEW_KEY;
        delete updateData.system.bonus_caracteristiques.NEW_VAL;
      }
      // Ajout nouvelle capacité
      if (updateData.system?.capacites?.NEW) {
        const newCap = updateData.system.capacites.NEW.trim();
        if (newCap) {
          const caps = this.item.system.capacites ? [...this.item.system.capacites] : [];
          caps.push(newCap);
          updateData['system.capacites'] = caps;
        }
        delete updateData.system.capacites.NEW;
      }

      await this.item.update(updateData);
      this.render(false);
    });
  }
}


globalThis.Add2eRaceSheet = Add2eRaceSheet;
Items.registerSheet("add2e", Add2eRaceSheet, {
  types: ["race"],
  makeDefault: true,
  label: "ADD2e Race"
});

// ===============================
// ENREGISTREMENT SYSTEME
// ===============================
// -----------------------------
// Configuration et fiches (INIT)
// -----------------------------

// -------------------------------------------------
// Boutons de la barre de scène & Combat Tracker (READY)
// -------------------------------------------------


// --- VALIDATION DES FICHES ITEM ADD2E ---
// Si un vieux rendu ou une mauvaise configuration a mis en cache une fiche
// incorrecte pour les items classe, on vide le cache de sheet au lancement.
Hooks.once("ready", () => {
  add2eRegisterClassItemSheet();

  const clearClassSheetCache = (item) => {
    if (!item || item.type !== "classe") return;

    if (item._sheet && !(item._sheet instanceof Add2eItemSheet)) {
      console.warn("[ADD2E][SHEETS] Cache de fiche classe incorrect vidé", {
        item: item.name,
        cachedSheet: item._sheet?.constructor?.name,
        expected: Add2eItemSheet?.name
      });
      item._sheet = null;
    }
  };

  for (const item of game.items ?? []) clearClassSheetCache(item);

  for (const actor of game.actors ?? []) {
    for (const item of actor.items ?? []) clearClassSheetCache(item);
  }

  console.log("[ADD2E][SHEETS] Contrôle Item.classe", {
    importedClassSheet: Add2eItemSheet?.name,
    exampleWorldClassSheet: game.items.find(i => i.type === "classe")?.sheet?.constructor?.name ?? null,
    exampleEmbeddedClassSheet: game.actors.find(a => a.items?.some(i => i.type === "classe"))?.items?.find(i => i.type === "classe")?.sheet?.constructor?.name ?? null
  });
});

// --- SOCKET dégâts/états ADD2E + hook MJ --- 

Hooks.on("preCreateItem", (itemData, options, userId) => {
  if (itemData.type === "sort" && Array.isArray(itemData.effects)) {
    for (let eff of itemData.effects) {
      eff.transfer = false;
      eff.disabled = true;
    }
  }
});

async function rollInitiativeD6(combatants) {
    if (!combatants.length) return;
    for (const comb of combatants) {
        const roll = await new Roll("1d6").evaluate({async:true});
        // Mise à jour Acteur ET Combattant
        if (comb.actor) await comb.actor.update({ "system.initiative": roll.total });
        await comb.update({ initiative: roll.total });
        
        await ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: comb.actor }),
            content: `Initiative : <b>${roll.total}</b> (1d6)`,
            flavor: "Initiative"
        });
    }
}
// =========================================================
// NETTOYAGE AUTOMATIQUE (Suppression d'objet)
// =========================================================

/**
 * Déclenché quand un objet est supprimé.
 * Supprime les Effets Actifs (Bonus CA, etc.) qui proviennent de cet objet.
 */
Hooks.on("deleteItem", async (item, options, userId) => {
  // 1. Sécurité : On agit seulement si c'est l'utilisateur courant qui a fait l'action
  if (game.user.id !== userId) return;
  
  // 2. Vérifie que l'item appartient bien à un acteur
  if (!item.parent || item.parent.documentName !== "Actor") return;

  const actor = item.parent;

  // 3. Recherche des effets liés à cet objet.
  // Pour les classes, on supprime aussi les anciens effets générés sans origin fiable.
  const effectsToDelete = actor.effects
    .filter(e => item.type === "classe" ? add2eShouldDeleteEffectForClassPurge(e, [item]) : e.origin === item.uuid)
    .map(e => e.id);

  // 4. Suppression
  if (effectsToDelete.length > 0) {
    console.log(`[ADD2e] Suppression des effets liés à l'objet supprimé : ${item.name}`);
    await actor.deleteEmbeddedDocuments("ActiveEffect", effectsToDelete);
    
    // Petit feedback visuel
    ui.notifications.info(`Les effets de ${item.name} se sont dissipés.`);
  }
  
});
// =========================================================
// ADD2E — RELAIS MJ GÉNÉRIQUE POUR LES SCRIPTS DE SORTS
// À placer tout en bas de scripts/add2e.mjs
// Ne contient aucune logique spécifique à un sort.
// =========================================================
Hooks.once("ready", () => {
  if (globalThis.ADD2E_GM_OPERATION_RELAY_REGISTERED) return;
  globalThis.ADD2E_GM_OPERATION_RELAY_REGISTERED = true;

  console.log("%c[ADD2E][GM-RELAY] Relais MJ générique chargé", "color:#27ae60;font-weight:bold;");

  function isResponsibleGM() {
    if (!game.user.isGM) return false;
    if (typeof game.user.isActiveGM === "boolean") return game.user.isActiveGM;
    return game.users.activeGM?.id === game.user.id;
  }

  function resolveScene(sceneId) {
    return game.scenes.get(sceneId) || canvas.scene || game.scenes.active || null;
  }

  async function resolveActor(payload) {
    if (payload.actorUuid) {
      try {
        const doc = await fromUuid(payload.actorUuid);
        if (doc) return doc;
      } catch (e) {
        console.warn("[ADD2E][GM-RELAY] actorUuid non résolu :", payload.actorUuid, e);
      }
    }

    if (payload.sceneId && payload.tokenId) {
      const scene = resolveScene(payload.sceneId);
      const tokenDoc = scene?.tokens?.get(payload.tokenId);
      if (tokenDoc?.actor) return tokenDoc.actor;
    }

    if (payload.actorId) {
      return game.actors.get(payload.actorId) ?? null;
    }

    return null;
  }

  function findAmbientLight(scene, payload) {
    if (!scene) return null;

    if (payload.lightId) {
      const byId = scene.lights.get(payload.lightId);
      if (byId) return byId;
    }

    if (payload.requestId) {
      const byRequest = scene.lights.find(l =>
        l.flags?.add2e?.requestId === payload.requestId ||
        l.getFlag?.("add2e", "requestId") === payload.requestId
      );

      if (byRequest) return byRequest;
    }

    if (
      Number.isFinite(Number(payload.x)) &&
      Number.isFinite(Number(payload.y))
    ) {
      const px = Number(payload.x);
      const py = Number(payload.y);

      return scene.lights.find(l => {
        const lx = Number(l.x);
        const ly = Number(l.y);

        const samePos =
          Number.isFinite(lx) &&
          Number.isFinite(ly) &&
          Math.abs(lx - px) < 4 &&
          Math.abs(ly - py) < 4;

        const sameSpell =
          !payload.spellName ||
          l.flags?.add2e?.spellName === payload.spellName ||
          l.getFlag?.("add2e", "spellName") === payload.spellName;

        const sameActor =
          !payload.actorId ||
          l.flags?.add2e?.actorId === payload.actorId ||
          l.flags?.add2e?.actorUuid === payload.actorUuid ||
          l.getFlag?.("add2e", "actorId") === payload.actorId ||
          l.getFlag?.("add2e", "actorUuid") === payload.actorUuid;

        return samePos && sameSpell && sameActor;
      }) ?? null;
    }

    return null;
  }

  game.socket.on("system.add2e", async data => {
    console.log("[ADD2E SOCKET][RECU]", {
  user: game.user.name,
  isGM: game.user.isGM,
  data
});
    // -----------------------------------------------------
    // Appliquer un ActiveEffect sur un acteur cible
    // IMPORTANT : ce bloc doit rester tout en haut du socket,
    // juste après le log [ADD2E SOCKET][RECU].
    // -----------------------------------------------------
    if (data.type === "applyActiveEffect") {
      if (!game.user.isGM) return;

      console.log("[ADD2E SOCKET][applyActiveEffect][START]", data);

      let targetActor = null;

      // 1. UUID complet Actor / ActorDelta / Token Actor
      if (data.actorUuid) {
        try {
          const doc = await fromUuid(data.actorUuid);

          console.log("[ADD2E SOCKET][applyActiveEffect][fromUuid]", {
            actorUuid: data.actorUuid,
            documentName: doc?.documentName,
            name: doc?.name,
            uuid: doc?.uuid,
            doc
          });

          if (doc?.documentName === "Actor") {
            targetActor = doc;
          }
          else if (doc?.documentName === "ActorDelta") {
            targetActor = doc.parent?.actor ?? null;
          }
        } catch (e) {
          console.warn("[ADD2E SOCKET][applyActiveEffect] actorUuid invalide :", data.actorUuid, e);
        }
      }

      // 2. Scène + token
      if (!targetActor && data.sceneId && data.tokenId) {
        const scene = game.scenes.get(data.sceneId);
        const tokenDoc = scene?.tokens?.get(data.tokenId);

        console.log("[ADD2E SOCKET][applyActiveEffect][sceneToken]", {
          sceneId: data.sceneId,
          tokenId: data.tokenId,
          sceneName: scene?.name,
          tokenName: tokenDoc?.name,
          tokenActor: tokenDoc?.actor
        });

        if (tokenDoc?.actor) {
          targetActor = tokenDoc.actor;
        }
      }

      // 3. Token actif sur canvas
      if (!targetActor && data.tokenId && canvas?.tokens) {
        const token = canvas.tokens.get(data.tokenId);

        console.log("[ADD2E SOCKET][applyActiveEffect][canvasToken]", {
          tokenId: data.tokenId,
          tokenName: token?.name,
          tokenActor: token?.actor
        });

        if (token?.actor) {
          targetActor = token.actor;
        }
      }

      // 4. Acteur monde lié
      if (!targetActor && data.actorId) {
        targetActor = game.actors.get(data.actorId);

        console.log("[ADD2E SOCKET][applyActiveEffect][worldActor]", {
          actorId: data.actorId,
          actor: targetActor
        });
      }

      if (!targetActor) {
        console.warn("[ADD2E SOCKET][applyActiveEffect] ACTEUR CIBLE INTROUVABLE", data);
        return;
      }

      const effectData = foundry.utils.deepClone(data.effectData || {});

      if (!effectData.name && effectData.label) effectData.name = effectData.label;
      if (!effectData.label && effectData.name) effectData.label = effectData.name;

      effectData.flags ??= {};
      effectData.flags.add2e ??= {};
      effectData.flags.add2e.appliedBySocket = true;
      effectData.flags.add2e.appliedByGM = game.user.id;
      effectData.flags.add2e.appliedAt = Date.now();

      console.log("[ADD2E SOCKET][applyActiveEffect] APPLICATION SUR ACTEUR", {
        actorName: targetActor.name,
        actorId: targetActor.id,
        actorUuid: targetActor.uuid,
        actorDocumentName: targetActor.documentName,
        effectData
      });

      try {
        const created = await targetActor.createEmbeddedDocuments("ActiveEffect", [effectData]);

        console.log("[ADD2E SOCKET][applyActiveEffect] EFFET CRÉÉ", {
          actor: targetActor.name,
          created
        });
      } catch (e) {
        console.error("[ADD2E SOCKET][applyActiveEffect] ERREUR CREATE ActiveEffect", {
          actor: targetActor,
          effectData,
          error: e
        });
      }

      return;
    }
    if (!data || data.type !== "ADD2E_GM_OPERATION") return;
    if (!isResponsibleGM()) return;

    const operation = data.operation;
    const payload = data.payload ?? {};

    console.log("[ADD2E][GM-RELAY] opération reçue :", {
      operation,
      payload
    });

    // -----------------------------------------------------
    // Créer une lumière ambiante
    // -----------------------------------------------------
    if (operation === "createAmbientLight") {
      const scene = resolveScene(payload.sceneId);

      if (!scene) {
        console.warn("[ADD2E][GM-RELAY][createAmbientLight] scène introuvable :", payload);
        return;
      }

      const lightData = {
        x: Number(payload.x ?? 0),
        y: Number(payload.y ?? 0),
        rotation: Number(payload.rotation ?? 0),
        walls: payload.walls !== false,
        vision: payload.vision === true,
        config: {
          dim: Number(payload.dim ?? 6),
          bright: Number(payload.bright ?? 3),
          angle: Number(payload.angle ?? 360),
          color: payload.color ?? "#fffec4",
          alpha: Number(payload.alpha ?? 0.5),
          coloration: Number(payload.coloration ?? 1),
          luminosity: Number(payload.luminosity ?? 0.5),
          attenuation: Number(payload.attenuation ?? 0.5),
          animation: payload.animation ?? {
            type: "torch",
            speed: 2,
            intensity: 2,
            reverse: false
          }
        },
        flags: {
          add2e: foundry.utils.duplicate(payload.flags?.add2e ?? {})
        }
      };

      const created = await scene.createEmbeddedDocuments("AmbientLight", [lightData]);
      const lightDoc = created?.[0];

      console.log("[ADD2E][GM-RELAY][createAmbientLight] créée :", {
        scene: scene.name,
        lightId: lightDoc?.id,
        requestId: payload.flags?.add2e?.requestId
      });

      return;
    }

    // -----------------------------------------------------
    // Supprimer une lumière ambiante
    // -----------------------------------------------------
    if (operation === "deleteAmbientLight") {
      const scene = resolveScene(payload.sceneId);

      if (!scene) {
        console.warn("[ADD2E][GM-RELAY][deleteAmbientLight] scène introuvable :", payload);
        return;
      }

      const lightDoc = findAmbientLight(scene, payload);

      if (!lightDoc) {
        console.warn("[ADD2E][GM-RELAY][deleteAmbientLight] lumière introuvable :", payload);
        return;
      }

      console.log("[ADD2E][GM-RELAY][deleteAmbientLight] suppression :", {
        scene: scene.name,
        lightId: lightDoc.id
      });

      await lightDoc.delete();
      return;
    }

    // -----------------------------------------------------
    // Mettre à jour un token
    // -----------------------------------------------------
    if (operation === "updateToken") {
      const scene = resolveScene(payload.sceneId);
      const tokenDoc = scene?.tokens?.get(payload.tokenId);

      if (!scene || !tokenDoc) {
        console.warn("[ADD2E][GM-RELAY][updateToken] scène/token introuvable :", payload);
        return;
      }

      console.log("[ADD2E][GM-RELAY][updateToken] update :", {
        scene: scene.name,
        token: tokenDoc.name,
        updateData: payload.updateData
      });

      await tokenDoc.update(payload.updateData ?? {});
      return;
    }

    // -----------------------------------------------------
    // Créer un ActiveEffect
    // -----------------------------------------------------
    if (operation === "createActiveEffect") {
      const targetActor = await resolveActor(payload);

      if (!targetActor) {
        console.warn("[ADD2E][GM-RELAY][createActiveEffect] acteur introuvable :", payload);
        return;
      }

      const effectData = foundry.utils.duplicate(payload.effectData ?? {});
      delete effectData._id;

      console.log("[ADD2E][GM-RELAY][createActiveEffect] création :", {
        actor: targetActor.name,
        actorUuid: targetActor.uuid,
        effectData
      });

      await targetActor.createEmbeddedDocuments("ActiveEffect", [effectData]);
      return;
    }

    console.warn("[ADD2E][GM-RELAY] opération inconnue :", operation, payload);
  });
});

// ============================================================
// ADD2E — Affichage compact des emplacements de préparation
// V25 : affichage strict par type de magie dans Résumé + Sorts.
// Format voulu : Druide : N1 0/1 N2 0/0 ; Magicien : N1 0/1.
// Le panneau est toujours reconstruit au rendu pour éviter les restes
// quand la classe est remplacée puis redéposée.
// ============================================================

// ============================================================
// ADD2E — Sorts : affichage natif HBS
// Les anciennes injections visuelles V24–V30 ont été supprimées.
// Le HBS affiche les sous-listes ; ce fichier conserve uniquement
// les données, la validation et les boutons + / -.
// ============================================================

function add2eBindNativeHbsSpellPreparationControls(actor, root) {
  if (!actor || !root) return;

  root.querySelectorAll(".a2e-spell-entry-plus, .a2e-spell-entry-minus").forEach(btn => {
    btn.onclick = async ev => {
      ev.preventDefault();
      ev.stopPropagation();

      const sortId = btn.dataset.sortId;
      const entryKey = add2eNormalizeSpellKey(btn.dataset.entryKey);
      const sort = actor.items.get(sortId);
      if (!sort) return ui.notifications.warn("Sort introuvable.");

      const entry = add2eGetSpellcastingEntries(actor).find(e => add2eNormalizeSpellKey(e.key) === entryKey);
      if (!entry) return ui.notifications.warn("Type de préparation introuvable.");

      const check = add2eCanActorUseSpell(actor, sort);
      const sortLists = add2eGetSpellListsFromItem(sort);
      const spellLevel = Number(sort.system?.niveau ?? sort.system?.level ?? 1) || 1;
      const actorLevel = Math.max(1, Number(actor.system?.niveau ?? 1) || 1);
      const startsAt = Number(entry.startsAt ?? 1) || 1;
      const maxSpellLevel = Number(entry.maxSpellLevel ?? 0) || 0;

      if (!sortLists.includes(entryKey)) return ui.notifications.warn(`Ce sort n'appartient pas à la liste ${entry.label}.`);
      if (actorLevel < startsAt) return ui.notifications.warn(`${entry.label} n'est disponible qu'à partir du niveau ${startsAt}.`);
      if (maxSpellLevel && spellLevel > maxSpellLevel) return ui.notifications.warn(`${entry.label} ne permet pas les sorts de niveau ${spellLevel}.`);
      if (!check.ok && add2eNormalizeSpellKey(check.entry?.key) !== entryKey) return ui.notifications.warn("Ce sort n'est pas autorisé pour cette classe.");

      let cur = add2eGetMemorizedCountForEntry(sort, entry);
      const isPlus = btn.classList.contains("a2e-spell-entry-plus");

      if (isPlus) {
        const limit = add2eGetSlotsForEntryLevel(actor, entry, spellLevel);
        const total = add2eCountPreparedForEntryLevel(actor, entry, spellLevel);
        if (limit <= 0) return ui.notifications.warn(`Aucun emplacement ${entry.label} de niveau ${spellLevel} disponible.`);
        if (total >= limit) return ui.notifications.warn(`Limite atteinte : ${entry.label} niveau ${spellLevel} (${total}/${limit}).`);
        cur++;
      } else {
        if (cur <= 0) return ui.notifications.warn(`Aucun sort ${entry.label} à retirer.`);
        cur--;
      }

      await add2eSetMemorizedCountForEntry(sort, entry, cur);
      add2eRerenderActorSheet(actor);
    };
  });
}

Hooks.on("renderActorSheet", (app, html) => {
  const actor = app?.actor ?? app?.document;
  const root = html?.[0] ?? html;
  setTimeout(() => add2eBindNativeHbsSpellPreparationControls(actor, root), 20);
  for (const delay of [40, 120, 260]) {
    setTimeout(() => {
      try {
        if (actor?.type === "personnage") add2eEnhanceCharacterSheetUi(app, html);
      } catch (err) {
        console.warn("[ADD2E][OBJETS_MAGIQUES][UI] Injection après rendu impossible.", err);
      }
    }, delay);
  }
});

Hooks.on("renderApplication", (app, html) => {
  const actor = app?.actor ?? app?.document;
  const root = html?.[0] ?? html;
  setTimeout(() => add2eBindNativeHbsSpellPreparationControls(actor, root), 20);
  for (const delay of [40, 120, 260]) {
    setTimeout(() => {
      try {
        if (actor?.type === "personnage") add2eEnhanceCharacterSheetUi(app, html);
      } catch (err) {
        console.warn("[ADD2E][OBJETS_MAGIQUES][UI] Injection application impossible.", err);
      }
    }, delay);
  }
});

console.log("ADD2E | Spell preparation native HBS V31 loaded");
 