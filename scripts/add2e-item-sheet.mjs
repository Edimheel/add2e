// scripts/add2e-item-sheet.mjs
// ADD2E — Feuille lisible dédiée aux Items de type "classe".
// ApplicationV2 / ItemSheetV2 — compatible Foundry V13/V14/V15.

import { classProgression } from "./add2e/17b-multiclass-core.mjs";

export const ADD2E_ITEM_SHEET_VERSION = "2026-08-12-application-v2-class-sheet-v2";
globalThis.ADD2E_ITEM_SHEET_VERSION = ADD2E_ITEM_SHEET_VERSION;
globalThis.ADD2E_CLASS_SHEET_VERSION = ADD2E_ITEM_SHEET_VERSION;

const ADD2E_APP_API = foundry?.applications?.api ?? {};
const ADD2E_SHEETS_API = foundry?.applications?.sheets ?? {};
const ADD2E_HANDLEBARS_MIXIN = ADD2E_APP_API.HandlebarsApplicationMixin;
const ADD2E_ITEM_SHEET_V2 = ADD2E_SHEETS_API.ItemSheetV2 ?? ADD2E_APP_API.DocumentSheetV2;

if (!ADD2E_HANDLEBARS_MIXIN) throw new Error("[ADD2E][CLASS_SHEET] HandlebarsApplicationMixin introuvable.");
if (!ADD2E_ITEM_SHEET_V2) throw new Error("[ADD2E][CLASS_SHEET] ItemSheetV2/DocumentSheetV2 introuvable.");

const Add2eBaseItemSheet = ADD2E_HANDLEBARS_MIXIN(ADD2E_ITEM_SHEET_V2);

function add2eIsEmpty(value) {
  return value === undefined || value === null || value === "";
}

function add2eMaybeJson(value) {
  if (typeof value !== "string") return value;
  const s = value.trim();
  if (!s || s === "[object Object]") return "";
  if ((s.startsWith("[") && s.endsWith("]")) || (s.startsWith("{") && s.endsWith("}"))) {
    try { return JSON.parse(s); }
    catch (_error) { return value; }
  }
  return value;
}

function add2eToArray(value) {
  value = add2eMaybeJson(value);
  if (add2eIsEmpty(value)) return [];
  if (Array.isArray(value)) {
    return value
      .flatMap(v => add2eToArray(v))
      .filter(v => v !== undefined && v !== null && String(v).trim() !== "");
  }
  if (typeof value === "string") {
    const s = value.trim();
    if (!s || s === "[object Object]") return [];
    return s.split(/[,;\n|]+/).map(v => v.trim()).filter(Boolean);
  }
  if (typeof value === "object") {
    const keys = ["allowedTags", "forbiddenTags", "lists", "spellLists", "value", "values", "tags", "tag", "list", "items"];
    for (const key of keys) if (key in value) return add2eToArray(value[key]);
    const numericValues = Object.keys(value)
      .filter(k => /^\d+$/.test(k))
      .sort((a, b) => Number(a) - Number(b))
      .map(k => value[k]);
    if (numericValues.length) return add2eToArray(numericValues);
  }
  return [];
}

function add2eToObjectArray(value) {
  value = add2eMaybeJson(value);
  if (add2eIsEmpty(value)) return [];
  if (Array.isArray(value)) return value.filter(v => v && typeof v === "object");
  if (typeof value === "object") {
    if (Array.isArray(value.items)) return add2eToObjectArray(value.items);
    if (Array.isArray(value.values)) return add2eToObjectArray(value.values);
    if (Array.isArray(value.value)) return add2eToObjectArray(value.value);
    const numericValues = Object.keys(value)
      .filter(k => /^\d+$/.test(k))
      .sort((a, b) => Number(a) - Number(b))
      .map(k => value[k]);
    if (numericValues.length) return add2eToObjectArray(numericValues);
    return [value];
  }
  return [];
}

function add2eNormalizeTag(tag) {
  return String(tag ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_");
}

function add2eHumanText(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "—";
  return raw
    .replace(/_/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\bDe\b/g, "de")
    .replace(/\bDu\b/g, "du")
    .replace(/\bDes\b/g, "des")
    .replace(/\bLa\b/g, "la")
    .replace(/\bLe\b/g, "le")
    .replace(/\bLes\b/g, "les")
    .replace(/\bEt\b/g, "et");
}

function add2eHumanTag(tag) {
  const raw = String(tag ?? "").trim();
  if (!raw) return "—";
  const t = add2eNormalizeTag(raw);
  const p = t.split(":");
  const fixed = {
    "classe:clerc": "Clerc",
    "classe:druide": "Druide",
    "lanceur:divin": "Lanceur divin",
    "lanceur:druidique": "Lanceur druidique",
    "langage:druidique": "Langage secret druidique",
    "sorts:clerc": "Sorts de clerc",
    "sorts:druide": "Sorts de druide",
    "preparation:priere": "Préparation par prière",
    "symbole_sacre:requis": "Symbole sacré requis",
    "vade_retro": "Vade retro",
    "repousser:morts_vivants": "Repousser les morts-vivants",
    "commander:morts_vivants": "Commander les morts-vivants",
    "forme_animale": "Forme animale",
    "forme_animale:3_jour": "Forme animale — 3 fois par jour",
    "identification:plantes": "Identification des plantes",
    "identification:animaux": "Identification des animaux",
    "identification:eau_pure": "Identification de l’eau pure",
    "deplacement_sans_trace:bois": "Déplacement sans trace en milieu boisé",
    "immunite:charme_creatures_bois": "Immunité aux charmes des créatures des bois",
    "immunite:charme:creatures_bois": "Immunité aux charmes des créatures des bois"
  };
  if (fixed[t]) return fixed[t];
  if (p[0] === "bonus_save_vs" && p.length >= 3) {
    const val = Number(p[2]);
    const sign = val > 0 ? "+" : "";
    return `${sign}${Number.isFinite(val) ? val : p[2]} aux jets de sauvegarde contre ${String(p[1] ?? "").replace(/_/g, " ")}`;
  }
  if (p[0] === "type_arme" && p[1]) return `Type d’arme : ${String(p[1]).replace(/_/g, " ")}`;
  if (p[0] === "arme" && p[1]) return `Arme : ${String(p[1]).replace(/_/g, " ")}`;
  if (p[0] === "type_armure" && p[1]) return `Type d’armure : ${String(p[1]).replace(/_/g, " ")}`;
  if (p[0] === "armure" && p[1]) return `Armure : ${String(p[1]).replace(/_/g, " ")}`;
  if (p[0] === "matiere" && p[1]) return `Matière : ${String(p[1]).replace(/_/g, " ")}`;
  if (p[0] === "interdit" && p[1]) return `Interdit : ${String(p[1]).replace(/_/g, " ")}`;
  if (p[0] === "rang" && p[1]) return `Rang : ${String(p[1]).replace(/_/g, " ")}`;
  if (p[0] === "condition" && p[1]) return `Condition : ${String(p[1]).replace(/_/g, " ")}`;
  if (p[0] === "forteresse" && p[1]) return `Forteresse : ${String(p[1]).replace(/_/g, " ")}`;
  if (p[0] === "revenu" && p[1]) return `Revenu : ${String(p[1]).replace(/_/g, " ")}`;
  if (p[0] === "suivants" && p[1]) return `Suivants : ${String(p[1]).replace(/_/g, " ")}`;
  if (t === "bouclier") return "Bouclier";
  return add2eHumanText(raw);
}

function add2eBadges(value) {
  return add2eToArray(value).map(t => ({ raw: String(t), label: add2eHumanTag(t) }));
}

function add2eRestrictionObject(primary) {
  const parsed = add2eMaybeJson(primary);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { allowedTags: [], forbiddenTags: [], source: "empty" };
  }
  return {
    allowedTags: add2eToArray(parsed.allowedTags),
    forbiddenTags: add2eToArray(parsed.forbiddenTags),
    source: "tags"
  };
}

function add2eFeatureDisplay(feature, classLevel = null) {
  const rawLevel = feature?.minLevel ?? 1;
  const minLevel = Number(rawLevel);
  if (!Number.isInteger(minLevel) || minLevel < 1) {
    throw new Error(`Capacité de classe « ${feature?.name ?? feature?.label ?? "inconnue"} » : minLevel canonique invalide.`);
  }
  const hasClassLevel = Number.isInteger(classLevel) && classLevel >= 1;
  const active = hasClassLevel ? classLevel >= minLevel : false;
  const tags = [
    ...add2eToArray(feature.tags),
    ...add2eToArray(feature.effectTags)
  ];
  return {
    name: feature.name ?? feature.label ?? "Capacité",
    minLevel,
    description: feature.description ?? "",
    tags: add2eBadges(tags),
    statusLabel: hasClassLevel ? (active ? "Disponible" : "Plus tard") : `Niveau ${minLevel}`,
    statusClass: hasClassLevel ? (active ? "active" : "locked") : "neutral",
    uses: feature.uses ?? null
  };
}

function add2eProgressionRows(progression) {
  const saveLabels = ["Paralysie", "Pétrification", "Baguettes", "Souffles", "Sorts"];
  return add2eToObjectArray(progression)
    .map(row => {
      const niveau = Number(row?.niveau);
      if (!Number.isInteger(niveau) || niveau < 1) {
        throw new Error("Une ligne de progression de classe ne possède pas de niveau canonique valide.");
      }
      return {
        niveau,
        xp: row?.xp ?? "",
        thac0: row?.thac0 ?? "",
        saves: add2eToArray(row?.savingThrows).map((value, index) => ({ label: saveLabels[index] ?? `JS ${index + 1}`, value })),
        spells: add2eToArray(row?.spellsPerLevel).map((value, index) => ({ level: index + 1, value }))
      };
    })
    .sort((a, b) => a.niveau - b.niveau);
}

function add2eTitleRows(titles) {
  return add2eToObjectArray(titles)
    .map(t => ({ minLevel: t?.minLevel ?? "", maxLevel: t?.maxLevel ?? "", title: t?.title ?? "" }))
    .filter(t => t.minLevel || t.maxLevel || t.title);
}

function add2eAttackRows(attacks) {
  return add2eToObjectArray(attacks)
    .map(a => ({ minLevel: a?.minLevel ?? "", maxLevel: a?.maxLevel ?? "", attacks: a?.attacks ?? "" }))
    .filter(a => a.minLevel || a.maxLevel || a.attacks);
}

function add2eSpellReqRows(reqs) {
  return add2eToObjectArray(reqs)
    .map(r => ({
      spellLevel: r?.spellLevel ?? "",
      ability: add2eHumanText(r?.requires?.ability ?? ""),
      min: r?.requires?.min ?? ""
    }))
    .filter(r => r.spellLevel || r.ability || r.min);
}

function add2eUsefulPermanentTags(tags) {
  const ignorePrefixes = ["classe:", "lanceur:", "sorts:", "preparation:", "armures:", "boucliers:", "type_action:", "interdit:"];
  return add2eToArray(tags).filter(tag => {
    const t = add2eNormalizeTag(tag);
    return !ignorePrefixes.some(prefix => t.startsWith(prefix));
  });
}

function add2eDerivedSpellcasting(system) {
  const sc = add2eMaybeJson(system.spellcasting);
  const hasObject = sc && typeof sc === "object" && !Array.isArray(sc);
  if (!hasObject) {
    return {
      enabled: false,
      enabledLabel: "Non",
      mode: "—",
      type: "—",
      ability: "—",
      startsAt: "—",
      maxSpellLevel: "—",
      usesSlots: false,
      usesPreparation: false,
      preparationSource: "—",
      lists: []
    };
  }
  return {
    enabled: sc.enabled === true,
    enabledLabel: sc.enabled === true ? "Oui" : "Non",
    mode: add2eHumanText(sc.mode ?? "—"),
    type: add2eHumanText(sc.type ?? "—"),
    ability: add2eHumanText(sc.ability ?? sc.abilityKey ?? "—"),
    startsAt: sc.startsAt ?? "—",
    maxSpellLevel: sc.maxSpellLevel ?? "—",
    usesSlots: sc.usesSlots === true,
    usesPreparation: sc.usesPreparation === true,
    preparationSource: add2eHumanText(sc.preparationSource ?? "—"),
    lists: add2eToArray(sc.lists).map(v => add2eHumanText(v))
  };
}

function add2eClassData(item, editable) {
  const system = item?.system ?? {};
  const parentActor = item?.parent?.documentName === "Actor" ? item.parent : null;
  const progressionState = parentActor ? classProgression(item) : null;
  if (parentActor && !progressionState?.hasLevel) {
    throw new Error(`Niveau canonique absent sur l’Item classe « ${item?.name ?? item?.id ?? "inconnu"} ».`);
  }
  const classLevel = progressionState?.hasLevel ? progressionState.level : null;
  const weaponRestriction = add2eRestrictionObject(system.weaponRestriction);
  const armorRestriction = add2eRestrictionObject(system.armorRestriction);
  const spellcasting = add2eDerivedSpellcasting(system);
  const ruleNotes = add2eToArray(system.ruleNotes);
  const classFeatureNote = String(system.classFeatureNote ?? "").trim();
  const description = system.description || "";
  const notes = system.notes || "";

  return {
    canEditClass: !!(game.user?.isGM && editable),
    summary: {
      label: system.label || item.name,
      hitDie: system.hitDie ?? "—",
      hdPerLevel: system.hdPerLevel || "",
      hpFormula: system.hpFormula || "—",
      hpAfterLevel: system.hpAfter14 ?? system.hpAfter9 ?? "",
      primaryAbility: add2eHumanText(system.primaryAbility || "—"),
      description,
      notes,
      ruleNotes,
      classFeatureNote,
      hasAnyNotes: !!description || !!notes || ruleNotes.length || !!classFeatureNote,
      spellcastingNote: system.spellcastingNote || ""
    },
    specialAbilities: add2eToArray(system.specialAbilities),
    permanentFeatures: add2eBadges(add2eUsefulPermanentTags(system.tags)),
    effectTags: add2eBadges(system.effectTags),
    restrictions: {
      weaponAllowed: add2eBadges(weaponRestriction.allowedTags),
      weaponForbidden: add2eBadges(weaponRestriction.forbiddenTags),
      weaponLegacyAllowed: [],
      weaponIsEmpty: weaponRestriction.source === "empty",
      armorAllowed: add2eBadges(armorRestriction.allowedTags),
      armorForbidden: add2eBadges(armorRestriction.forbiddenTags),
      armorLegacyAllowed: [],
      shieldLegacyAllowed: false,
      armorIsEmpty: armorRestriction.source === "empty"
    },
    spellcasting,
    spellLists: spellcasting.lists,
    spellAccessRequirements: add2eSpellReqRows(system.spellAccessRequirements),
    classFeatures: add2eToObjectArray(system.classFeatures)
      .map(feature => add2eFeatureDisplay(feature, classLevel))
      .sort((a, b) => a.minLevel - b.minLevel || String(a.name).localeCompare(String(b.name), "fr")),
    progressionRows: add2eProgressionRows(system.progression),
    titleRows: add2eTitleRows(system.titlesByLevel),
    attackRows: add2eAttackRows(system.attacksPerRound),
    savingThrows: add2eToArray(system.savingThrows).map(v => add2eHumanText(v)),
    strengthAdjustments: add2eToObjectArray(system.strengthAdjustments)
  };
}

function add2eClassSheetRoot(sheet) {
  const element = sheet?.element;
  return element?.jquery ? element[0] : element ?? null;
}

function add2eActivateClassSheetTab(sheet, tab) {
  const root = add2eClassSheetRoot(sheet);
  if (!root) return;
  const activeTab = String(tab || "resume");
  sheet._add2eActiveTab = activeTab;
  for (const link of root.querySelectorAll(".tabs a[data-tab]")) {
    link.classList.toggle("active", String(link.dataset.tab) === activeTab);
  }
  for (const content of root.querySelectorAll(".content[data-tab]")) {
    content.classList.toggle("hidden", String(content.dataset.tab) !== activeTab);
  }
}

export class Add2eClassSheet extends Add2eBaseItemSheet {
  static DEFAULT_OPTIONS = {
    id: "add2e-classe-{id}",
    classes: ["add2e", "sheet", "item", "classe", "add2e-class-v2-app"],
    tag: "div",
    position: { width: 980, height: 820 },
    window: { title: "ADD2E | Fiche Classe", resizable: true }
  };

  static PARTS = {
    main: { template: "systems/add2e/templates/item/classe-sheet.hbs" }
  };

  async _prepareContext(options = {}) {
    const context = await super._prepareContext(options);
    const item = this.document;
    context.document = item;
    context.item = item;
    context.system = item?.system ?? {};
    context.owner = item?.isOwner ?? false;
    context.editable = this.isEditable;
    context.options = this.options ?? {};
    Object.assign(context, add2eClassData(item, this.isEditable));
    return context;
  }

  async _preparePartContext(_partId, context, _options = {}) {
    return context;
  }

  async _add2eUpdateFromForm(form) {
    if (!this.isEditable || !form || !this.document?.update) return false;
    const flat = {};
    for (const [key, value] of new FormData(form).entries()) flat[key] = value;
    const update = foundry.utils.expandObject(flat);
    if (typeof update.name === "string") {
      update.name = update.name.trim() || this.document.name || "Classe";
    }
    await this.document.update(update, { add2eInternal: true, add2eReason: "class-sheet-v2-form" });
    return true;
  }

  async _onRender(context, options = {}) {
    await super._onRender?.(context, options);
    const root = add2eClassSheetRoot(this);
    if (!root) return;

    const activeTab = this._add2eActiveTab || "resume";
    add2eActivateClassSheetTab(this, activeTab);

    for (const link of root.querySelectorAll(".tabs a[data-tab]")) {
      link.addEventListener("click", event => {
        event.preventDefault();
        add2eActivateClassSheetTab(this, link.dataset.tab || "resume");
      });
    }

    const form = root.querySelector("form.add2e-class-readable-sheet");
    if (form && this.isEditable) {
      form.addEventListener("submit", event => {
        event.preventDefault();
        void this._add2eUpdateFromForm(form);
      });
      form.addEventListener("change", () => {
        void this._add2eUpdateFromForm(form);
      });
    }

    const portrait = root.querySelector("img[data-edit='img']");
    if (portrait && this.isEditable) {
      portrait.dataset.action = "editImage";
      portrait.removeAttribute("data-edit");
    }
  }
}

export const Add2eItemSheet = Add2eClassSheet;
