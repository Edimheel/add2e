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
  const actorLevel = Math.max(1, Number(actor?.system?.niveau) || 1);
  const classItem = actor?.items?.find?.(i => String(i.type || "").toLowerCase() === "classe") || null;
  const details = classItem?.system || actor?.system?.details_classe || {};
  const progression = Array.isArray(details.progression) ? details.progression : [];
  const row = progression[actorLevel - 1] || {};
  const rawSlots = Array.isArray(row.spellsPerLevel)
    ? row.spellsPerLevel
    : (Array.isArray(row.sortsParNiveau) ? row.sortsParNiveau : []);

  const slotsByLevel = {};
  for (let i = 0; i < rawSlots.length; i++) {
    slotsByLevel[i + 1] = Number(rawSlots[i]) || 0;
  }

  return slotsByLevel;
}

function add2eUiGetMemorizedSpellsByLevel(actor) {
  const countByLevel = {};
  for (const sort of actor?.items?.filter?.(i => String(i.type || "").toLowerCase() === "sort") ?? []) {
    const niv = Number(sort.system?.niveau || sort.system?.level || 1) || 1;
    const count = Number(sort.getFlag?.("add2e", "memorizedCount") ?? 0) || 0;
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
  // 2. Onglet Sorts : affichage des slots à côté de la colonne Sort
  // ------------------------------------------------------------
  const slotsByLevel = add2eUiGetSpellSlotsByLevel(actor);
  const memorizedByLevel = add2eUiGetMemorizedSpellsByLevel(actor);

  for (const table of sheetRoot.querySelectorAll("table.sort-table")) {
    const panel = table.closest(".a2e-panel") || table.parentElement;
    const panelText = panel?.querySelector?.("h2, h3")?.textContent || panel?.textContent || "";
    const levelMatch = panelText.match(/niveau\s*(\d+)/i);
    const spellLevel = levelMatch ? Number(levelMatch[1]) : null;
    const max = spellLevel ? Number(slotsByLevel[spellLevel] || 0) : null;
    const count = spellLevel ? Number(memorizedByLevel[spellLevel] || 0) : null;

    const headers = Array.from(table.querySelectorAll("thead th"));
    const sortHeader = headers.find(th => add2eUiNormalizeText(th.textContent) === "sort");
    if (sortHeader && spellLevel && !sortHeader.querySelector(".a2e-sort-slot-label")) {
      sortHeader.innerHTML = `Sort <span class="a2e-sort-slot-label" title="Sorts préparés / lançables pour le niveau ${spellLevel}">${count} / ${max}</span>`;
    }

    const memIndex = headers.findIndex(th => add2eUiNormalizeText(th.textContent).includes("memorisation"));
    if (memIndex >= 0) {
      headers[memIndex].style.display = "none";
      for (const row of table.querySelectorAll("tbody tr")) {
        const cells = Array.from(row.children).filter(el => el.tagName === "TD" || el.tagName === "TH");
        if (cells[memIndex]) cells[memIndex].style.display = "none";
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


function checkClassStatMin(actor, classeItem) {
  const min = classeItem.system?.caracs_min || {};
  const base = actor.system || {};
  const bonus = base.bonus_caracteristiques || {};

  let ok = true, manque = [];

  for (let [c, v] of Object.entries(min)) {
    const valBase = Number(base[`${c}_base`] ?? 0);
    const modRace = Number(bonus[c] ?? 0);
    const valTotale = valBase + modRace;

    if (valTotale < v) {
      manque.push(`${c} ${valTotale} < ${v}`);
      ok = false;
    }
  }

  if (!ok) {
    ui.notifications.warn(`Caractéristiques insuffisantes pour la classe "${classeItem.name}" (${manque.join(", ")})`);
    console.warn("[ADD2e] Classe refusée, carac non atteintes :", manque);
  }

  return ok;
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

  // Au changement de niveau : on recalcule PV max (system.points_de_coup) et on aligne PV courant (system.pdv)
  if (changes?.system && Object.prototype.hasOwnProperty.call(changes.system, "niveau")) {
    try {
      const lvl = Number(changes.system.niveau) || Number(actor.system?.niveau) || 1;
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

const lists = data.actor.system.spellcasting?.lists || [];

const LABELS = {
  cleric: "Clerc",
  druid: "Druide",
  mage: "Magicien",
  wizard: "Magicien",
  illusionist: "Illusionniste"
};

data.spellLists = lists.map(k => LABELS[k] || k);

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
  data.listeArmes = items.filter(item => item.type === "arme");
  data.listeArmures = items.filter(item => item.type === "armure");
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
  const sortsParNiveau = {};

// =====================================================
// [MODIF] INJECTION DES POUVOIRS (Tous types d'items)
// =====================================================
// On cherche les pouvoirs sur Armes, Armures et Objets divers, tant qu'ils sont équipés
const itemsAvecPouvoirs = items.filter(i => {
  if (!["arme", "armure", "objet"].includes(i.type)) return false;
  if (!i.system?.equipee) return false;
  const p = i.system.pouvoirs;
  if (!p) return false;
  if (Array.isArray(p)) return p.length > 0;
  if (typeof p === "object") return Object.keys(p).length > 0;
  return false;
});

for (const itemSource of itemsAvecPouvoirs) {
  // Normalisation pouvoirs → toujours un tableau
  let pouvoirs = [];
  const raw = itemSource.system.pouvoirs;
  if (Array.isArray(raw)) {
    pouvoirs = raw.filter(p => p && typeof p === "object");
  } else if (raw && typeof raw === "object") {
    pouvoirs = Object.values(raw).filter(p => p && typeof p === "object");
  }
  if (!pouvoirs.length) continue;

  const maxGlobal = Number(itemSource.system.max_charges) || 0;
  const isGlobal  = maxGlobal > 0;

  pouvoirs.forEach((p, idx) => {
    // =====================================================
    // RECHERCHE D'ICONE INTELLIGENTE
    // =====================================================
    let iconImage = p.img;

    const realSpell = game.items.find(i =>
      i.type === "sort" && i.name.toLowerCase() === (p.name || "").toLowerCase()
    );

    if (realSpell) {
      iconImage = realSpell.img;
    }
    if (!iconImage) {
      iconImage = itemSource.img;
    }

    const fakeSpellData = {
      _id: itemSource.id.substring(0, 14) + idx.toString().padStart(2, "0"),
      name: `${p.name}`,
      type: "sort",
      img: iconImage,
      system: {
        niveau: p.niveau || 1,
        école: p.ecole || "Magique",
        description: p.description || "",
        composantes: "Objet",
        temps_incantation: "1",
        isPower: true,
        sourceWeaponId: itemSource.id,
        powerIndex: idx,
        cost: p.cout || 0,
        max: isGlobal ? maxGlobal : (p.max || 1),
        isGlobalCharge: isGlobal,
        onUse: p.onUse || ""
      }
    };

    const virtualSpell = new Item(fakeSpellData, { parent: this.actor });

    virtualSpell.getFlag = (scope, key) => {
      if (key === "memorizedCount") {
        if (isGlobal) {
          const val = itemSource.getFlag("add2e", "global_charges");
          return (val !== undefined) ? val : maxGlobal;
        } else {
          const charges = itemSource.getFlag("add2e", `charges_${idx}`);
          return (charges !== undefined) ? charges : p.max;
        }
      }
      return null;
    };

    sorts.push(virtualSpell);
  });
}

    // =====================================================
  for (const sort of sorts) {
    let niveau = Number(sort.system.niveau) || 1;
    if (!sortsParNiveau[niveau]) sortsParNiveau[niveau] = [];
    sortsParNiveau[niveau].push(sort);
  }
  const niveauxSorts = Object.keys(sortsParNiveau).map(Number).sort((a, b) => a - b);
  data.sortsParNiveau = sortsParNiveau;
  data.niveauxSorts = niveauxSorts;

  // ----- AJOUT LIMITES DE SORTS MÉMORISÉS -----
  const sortsMemorizedByLevel = {};
  for (const niv of niveauxSorts) {
    const sorts = sortsParNiveau[niv] || [];
    if (classe === "ranger") {
      const sortsDruide = sorts.filter(s => (s.system.classe || "").toLowerCase() === "druide");
      const sortsMagicien = sorts.filter(s => (s.system.classe || "").toLowerCase() === "magicien");
      let countDruide = 0, countMagicien = 0;
      for (const s of sortsDruide) {
        const mem = await s.getFlag("add2e", "memorizedCount");
        countDruide += Number(mem) || 0;
      }
      for (const s of sortsMagicien) {
        const mem = await s.getFlag("add2e", "memorizedCount");
        countMagicien += Number(mem) || 0;
      }
      let maxDruide = progressionCourante?.spellsPerLevel?.[niv-1] ?? 0;
      let maxMagicien = progressionCourante?.spellsPerLevel1?.[niv-1] ?? 0;
      sortsMemorizedByLevel[niv] = {
        druide: { count: countDruide, max: maxDruide },
        magicien: { count: countMagicien, max: maxMagicien }
      };
    } else {
      let count = 0;
      for (const s of sorts) {
        const mem = await s.getFlag("add2e", "memorizedCount");
        count += Number(mem) || 0;
      }
      let max = 0;
      if (classe === "paladin" && progressionCourante?.spellsPerLevelClerc) {
        max = progressionCourante.spellsPerLevelClerc[niv-1] || 0;
      } else if (progressionCourante?.spellsPerLevel) {
        max = progressionCourante.spellsPerLevel[niv-1] || 0;
      }
      sortsMemorizedByLevel[niv] = { count, max };
    }
  }
  data.sortsMemorizedByLevel = sortsMemorizedByLevel;

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
    setTimeout(() => this._add2eActivateTab(this._add2eActiveTab || this._add2eReadStoredTab() || "resume"), 0);
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

  // Icônes et couleurs par type de save
  const saveIcons = ["fa-skull-crossbones","fa-mountain","fa-magic","fa-fire","fa-scroll"];
  const icon = saveIcons[idx] || "fa-dice-d20";
  const colors = ["#c48642","#6394e8","#b12f95","#e67e22","#a173d9"];
  const color = colors[idx] || "#6c4e95";
  const reussite = roll.total > valeur;

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
  const sortId = $(ev.currentTarget).data('sort-id');
await handleItemAction({
  actor: this.actor,
  action,
  itemId,
  sheet: this
});
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
      let v = parseInt(ev.target.value) || 1;
      v = Math.max(1, v);
      ev.target.value = v;
      await this.actor.update({ "system.niveau": v });
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
  self.render(false);
  return false;
});

// Dans votre Add2eSortSheet.activateListeners(html)
html.find('.sort-memorize-plus, .sort-memorize-minus')
  .off('click')
  .on('click', async ev => {
    ev.preventDefault();
    ev.stopPropagation();
    const $btn   = $(ev.currentTarget);
    const sortId = $btn.data('sort-id');
    const sort   = this.actor.items.get(sortId);
    if (!sort) return;
    const isPlus      = $btn.hasClass('sort-memorize-plus');
    let cur          = Number(await sort.getFlag("add2e","memorizedCount")) || 0;
    if (isPlus) {
      // Calcul de la limite
      const niv       = Number(sort.system.niveau) || 1;
      const prog      = this.actor.system.details_classe?.progression?.[this.actor.system.niveau-1]||{};
 let limit = 0, total = 0;

// Comptage des sorts déjà mémorisés du même niveau
for (const s of this.actor.items.filter(i =>
  i.type === "sort" &&
  Number(i.system.niveau) === niv
)) {
  total += Number(await s.getFlag("add2e","memorizedCount")) || 0;
}


// Calcul générique de la limite
limit = prog?.spellsPerLevel?.[niv - 1] ?? 0;

// Vérification de la limite atteinte
if (limit && total >= limit) {
  return ui.notifications.warn(`Limite atteinte niveau ${niv} (${limit} max).`);
}

cur++;
    } else {
      if (cur>0) cur--;
      else return ui.notifications.warn("Aucun emplacement à libérer.");
    }
    await sort.setFlag("add2e","memorizedCount", cur);
    this.render(false);
  });

// Clic pour lancer le sort (séparé, sans conflit)
// -----------------------------------------------------------
    // GESTION DU LANCEMENT DE SORT (Compatible Virtuels & Réels)
    // -----------------------------------------------------------
    html.find('.sort-cast, .sort-cast-img').off('click').on('click', async function(ev) {
      ev.preventDefault();
      ev.stopPropagation();
      const sortId = $(this).data('sort-id');
      
      // 1. On cherche d'abord un VRAI sort (inventaire)
      let sort = self.actor.items.get(sortId);

 // 2. Si non trouvé, on cherche dans TOUS LES ITEMS ÉQUIPÉS (Pouvoirs virtuels)
  if (!sort) {
    const itemsSources = self.actor.items.filter(i => {
      if (!["arme", "armure", "objet"].includes(i.type)) return false;
      if (!i.system?.equipee) return false;
      const p = i.system.pouvoirs;
      if (!p) return false;
      if (Array.isArray(p)) return p.length > 0;
      if (typeof p === "object") return Object.keys(p).length > 0;
      return false;
    });
        
    // On parcourt les items pour retrouver celui qui a généré cet ID
    for (const itemSource of itemsSources) {
      // Normalisation pouvoirs → tableau
      let pouvoirs = [];
      const raw = itemSource.system.pouvoirs;
      if (Array.isArray(raw)) {
        pouvoirs = raw.filter(p => p && typeof p === "object");
      } else if (raw && typeof raw === "object") {
        pouvoirs = Object.values(raw).filter(p => p && typeof p === "object");
      }
      if (!pouvoirs.length) continue;

      const maxGlobal = Number(itemSource.system.max_charges) || 0;
      const isGlobal  = maxGlobal > 0;

      for (let idx = 0; idx < pouvoirs.length; idx++) {
        const p = pouvoirs[idx];
        const genId = itemSource.id.substring(0, 14) + idx.toString().padStart(2, "0");
             
        if (genId === sortId) {
          const fakeData = {
            _id: genId,
            name: `${p.name}`,
            type: "sort",
            img: p.img || itemSource.img,
            system: {
              niveau: p.niveau || 1,
              école: p.ecole || "Magique",
              description: p.description || "",
              isPower: true,
              sourceWeaponId: itemSource.id,
              powerIndex: idx,
              cost: p.cout || 0,
              max: isGlobal ? maxGlobal : (p.max || 1),
              isGlobalCharge: isGlobal,
              onUse: p.onUse || ""
            }
          };
               
          sort = new Item(fakeData, { parent: self.actor });
               
          sort.getFlag = (scope, key) => {
            if (key === "memorizedCount") {
              if (isGlobal) {
                const val = itemSource.getFlag("add2e", "global_charges");
                return (val !== undefined) ? val : maxGlobal;
              } else {
                const charges = itemSource.getFlag("add2e", `charges_${idx}`);
                return (charges !== undefined) ? charges : p.max;
              }
            }
            return null;
          };
          break;
        }
      }
      if (sort) break;
    }
  }


      // 3. Lancement
      if (sort) {
        if (typeof globalThis.add2eCastSpell === "function") {
           await globalThis.add2eCastSpell({ actor: self.actor, sort });
           // On rafraîchit la feuille pour mettre à jour le compteur de charges
           self.render(false);
        } else {
           ui.notifications.error("La fonction add2eCastSpell est introuvable.");
        }
      } else {
        ui.notifications.warn("Impossible de retrouver les données de ce sort.");
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

 // --- Validation générique du drop de sort (DEBUG)
if (itemData.type === "sort") {

  console.log("=== [ADD2E DROP SORT] ===");
  console.log("actor:", { id: this.actor?.id, name: this.actor?.name });
  console.log("itemData:", itemData);

  const normalize = v => (v ?? "").toString().toLowerCase().trim();

  let source = null;

  // 1) UUID
  console.log("[ADD2E DROP SORT] uuid:", itemData.uuid);
  if (itemData.uuid) {
    source = await fromUuid(itemData.uuid);
    console.log("[ADD2E DROP SORT] source via uuid:", source);
  }

  // 2) Compendium
  console.log("[ADD2E DROP SORT] pack:", itemData.pack, "_id:", itemData._id);
  if (!source && itemData.pack && itemData._id) {
    const pack = game.packs.get(itemData.pack);
    console.log("[ADD2E DROP SORT] resolved pack:", pack);
    if (pack) {
      source = await pack.getDocument(itemData._id);
      console.log("[ADD2E DROP SORT] source via pack:", source);
    }
  }

  // 3) Fallback local (itemData)
  if (!source && itemData.system) {
    source = { name: itemData.name, system: itemData.system };
    console.log("[ADD2E DROP SORT] source via fallback system:", source);
  }

  if (!source || !source.system) {
    console.log("[ADD2E DROP SORT] ❌ FAIL: source unresolved");
    ui.notifications.error("Impossible de résoudre le sort.");
    return false;
  }

  const sys = source.system;

  console.log("[ADD2E DROP SORT] sys.name:", source.name);
  console.log("[ADD2E DROP SORT] sys.spellLists:", sys.spellLists);
  console.log("[ADD2E DROP SORT] sys.niveau:", sys.niveau);

  const sortLists = Array.isArray(sys.spellLists)
    ? sys.spellLists.map(normalize).filter(Boolean)
    : [];

  console.log("[ADD2E DROP SORT] normalized sortLists:", sortLists);

  if (!sortLists.length) {
    console.log("[ADD2E DROP SORT] ❌ FAIL: no spellLists on spell");
    ui.notifications.error(`Sort non migré : “${source.name}” n’a pas system.spellLists.`);
    return false;
  }

  // =====================================================
  // IMPORTANT : Autorisation EXCLUSIVEMENT via system.spellcasting
  // - Pas de fallback classe
  // - Pas de fallback progression/slots
  // =====================================================
  const casting = this.actor.system?.spellcasting;

  console.log("[ADD2E DROP SORT] actor.system.spellcasting (raw):", casting);

  const actorLists = Array.isArray(casting?.lists)
    ? casting.lists.map(normalize).filter(Boolean)
    : [];

  const startsAt = Number(casting?.startsAt);
  const maxSpellLevel = Number(casting?.maxSpellLevel);

  console.log("[ADD2E DROP SORT] actorLists(normalized):", actorLists);
  console.log("[ADD2E DROP SORT] startsAt:", casting?.startsAt, "=>", startsAt, "| maxSpellLevel:", casting?.maxSpellLevel, "=>", maxSpellLevel);

  if (!actorLists.length) {
    console.log("[ADD2E DROP SORT] ❌ FAIL: actorLists empty (no spellcasting.lists)");
    ui.notifications.error(`${this.actor.name} ne peut pas apprendre ou mémoriser ce sort (“${source.name}”).`);
    return false;
  }

  // Intersection lignes sort vs lignes autorisées acteur
  const intersect = sortLists.filter(l => actorLists.includes(l));

  console.log("[ADD2E DROP SORT] intersection:", intersect);

  if (!intersect.length) {
    console.log("[ADD2E DROP SORT] ❌ FAIL: no intersection (line not allowed)");
    ui.notifications.error(`${this.actor.name} ne peut pas apprendre ou mémoriser ce sort (“${source.name}”).`);
    return false;
  }

  // Niveaux
  const actorLevelRaw = this.actor.system?.niveau;
  const actorLevel = Number(actorLevelRaw);

  const spellLevelRaw = sys.niveau;
  const spellLevel = Number(spellLevelRaw);

  console.log("[ADD2E DROP SORT] actorLevel:", actorLevelRaw, "=>", actorLevel, "| spellLevel:", spellLevelRaw, "=>", spellLevel);

  if (!Number.isFinite(actorLevel) || actorLevel <= 0) {
    console.log("[ADD2E DROP SORT] ❌ FAIL: actorLevel invalid");
    ui.notifications.error(`${this.actor.name} ne peut pas apprendre ou mémoriser ce sort (“${source.name}”).`);
    return false;
  }

  if (!Number.isFinite(spellLevel) || spellLevel <= 0) {
    console.log("[ADD2E DROP SORT] ❌ FAIL: spellLevel invalid");
    ui.notifications.error(`Niveau du sort invalide pour “${source.name}”.`);
    return false;
  }

  // startsAt (si défini)
  if (Number.isFinite(startsAt) && startsAt > 0 && actorLevel < startsAt) {
    console.log("[ADD2E DROP SORT] ❌ FAIL: actorLevel < startsAt", { actorLevel, startsAt });
    ui.notifications.error(`${this.actor.name} ne peut pas apprendre ou mémoriser ce sort (“${source.name}”).`);
    return false;
  }

  // maxSpellLevel (si défini)
  if (Number.isFinite(maxSpellLevel) && maxSpellLevel > 0 && spellLevel > maxSpellLevel) {
    console.log("[ADD2E DROP SORT] ❌ FAIL: spellLevel > maxSpellLevel", { spellLevel, maxSpellLevel });
    ui.notifications.error(`${this.actor.name} ne peut pas apprendre ou mémoriser ce sort (“${source.name}”).`);
    return false;
  }

  console.log("[ADD2E DROP SORT] ✅ DROP SORT OK (authorized by spellcasting only)", {
    actorLists,
    sortLists,
    intersection: intersect,
    startsAt: Number.isFinite(startsAt) ? startsAt : null,
    maxSpellLevel: Number.isFinite(maxSpellLevel) ? maxSpellLevel : null,
    actorLevel,
    spellLevel
  });
}
// --- Vérifie stats minimales pour la classe
  if (itemData.type === "classe") {
    if (typeof checkClassStatMin === "function") {
      // 🔥 CORRECTION : reset ancienne classe
await this.actor.update({ "system.-=details_classe": null });

// 🔥 applique la nouvelle classe correctement
await this.actor.update({
  "system.classe": itemData.name,
  "system.details_classe": foundry.utils.deepClone(itemData.system)
});
      const ok = checkClassStatMin(this.actor, itemData);
      if (!ok) {
        console.warn("[ADD2e] Blocage prise de classe (stats minimales NON atteintes)");
        return false;
      }
    } else {
      console.warn("[ADD2e] Fonction checkClassStatMin NON trouvée !");
    }
  }

  // --- Vérifie compatibilité race/classe avant tout changement
  if (itemData.type === "race") {
    const existingClass = this.actor.items.find(i => i.type === "classe");
    if (existingClass) {
      const allowedRaces = (existingClass.system?.raceAllowed || []).map(r => r.toLowerCase());
      const droppedRace = (itemData.name || itemData.system?.label || "").toLowerCase();
      if (allowedRaces.length && !allowedRaces.includes(droppedRace)) {
        ui.notifications.error(`La race "${itemData.name}" n'est pas compatible avec la classe "${existingClass.name}" déjà présente sur ce personnage.`);
        return false;
      }
    }
  }

  if (itemData.type === "classe") {
    const existingRace = this.actor.items.find(i => i.type === "race");
    if (existingRace) {
      const allowedRaces = (itemData.system?.raceAllowed || []).map(r => r.toLowerCase());
      const actorRace = (existingRace.name || existingRace.system?.label || "").toLowerCase();
      if (allowedRaces.length && !allowedRaces.includes(actorRace)) {
        ui.notifications.error(`La classe "${itemData.name}" n'est pas compatible avec la race "${existingRace.name}" déjà présente sur ce personnage.`);
        return false;
      }
    }
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

  // Effets liés aux items supprimés.
  // On cible l'origine exacte et, par sécurité, les origins qui finissent par l'id d'item.
  const itemUuidsToDelete = itemsToDelete.map(i => i.uuid).filter(Boolean);
  const itemIdsToDelete = itemsToDelete.map(i => i.id).filter(Boolean);

  const effectsToDelete = this.actor.effects.filter(eff => {
    const origin = String(eff.origin || "");
    return itemUuidsToDelete.includes(origin)
      || itemIdsToDelete.some(id => origin.endsWith(`.${id}`));
  });

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
      return data;
    });
    await this.actor.createEmbeddedDocuments("ActiveEffect", actorEffects);
  }

  // --- Traitement spécial classe (alignements, etc.)
  if (itemData.type === "classe") {
    const alns = itemDoc.system?.alignements_autorises
        || itemDoc.system?.alignment
        || [];
    await this.actor.update({
      "system.alignements_autorises": alns
    });
  }

  // --- Application effets et bonus pour race
  if (itemData.type === "race") {
    await this.actor.update({ "system.race": itemDoc.name });
    await this.actor.update({ "system.bonus_caracteristiques": null });
    await new Promise(r => setTimeout(r, 25));
    if (itemDoc.system?.bonus_caracteristiques) {
      await this.actor.update({
        "system.bonus_caracteristiques": foundry.utils.duplicate(itemDoc.system.bonus_caracteristiques)
      });
    }
    if (typeof this.autoSetCaracAjustements === "function") {
      await this.autoSetCaracAjustements();
    }
  }

  // --- Application effets + sauvegardes pour classe
  if (itemData.type === "classe") {
    const updates = {
  "system.classe": itemDoc.name
};

// details_classe sera recalculé automatiquement dans getData()
await this.actor.update(updates);

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
    if (itemDoc.name?.toLowerCase().includes("moine")) {
      const hasUnarmed = this.actor.items.some(i =>
        i.type === "arme" && i.name.trim().toLowerCase() === "main nue"
      );
      if (!hasUnarmed) {
        let degats = "1d6";
        if (itemDoc.system?.progression?.[0]?.main_nue) {
          degats = itemDoc.system.progression[0].main_nue;
        }
        await this.actor.createEmbeddedDocuments("Item", [{
          type: "arme",
          name: "main nue",
          system: { degats: degats }
        }]);
      }
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

  // 3. Recherche des effets liés à cet objet
  // On compare l'origine de l'effet (origin) avec l'UUID de l'objet supprimé
  const effectsToDelete = actor.effects
    .filter(e => e.origin === item.uuid)
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