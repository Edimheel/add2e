// scripts/add2e-item-sheet.mjs
// ADD2E — Feuille lisible dédiée aux items de type "classe"
// Cette feuille réconcilie l'affichage avec les clés réellement présentes
// dans les exports Foundry d'items classe.
// Elle garde l'export Add2eItemSheet attendu par add2e.mjs.

export const ADD2E_ITEM_SHEET_VERSION = "2026-05-01-class-export-keys-v3";
globalThis.ADD2E_ITEM_SHEET_VERSION = ADD2E_ITEM_SHEET_VERSION;
globalThis.ADD2E_CLASS_SHEET_VERSION = ADD2E_ITEM_SHEET_VERSION;

function add2eIsEmpty(value) {
  return value === undefined || value === null || value === "";
}

function add2eMaybeJson(value) {
  if (typeof value !== "string") return value;

  const s = value.trim();
  if (!s || s === "[object Object]") return "";

  if (
    (s.startsWith("[") && s.endsWith("]")) ||
    (s.startsWith("{") && s.endsWith("}"))
  ) {
    try {
      return JSON.parse(s);
    } catch (e) {
      return value;
    }
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

    return s
      .split(/[,;\n|]+/)
      .map(v => v.trim())
      .filter(Boolean);
  }

  if (typeof value === "object") {
    const keys = [
      "allowedTags",
      "forbiddenTags",
      "lists",
      "spellLists",
      "value",
      "values",
      "tags",
      "tag",
      "list",
      "items"
    ];

    for (const key of keys) {
      if (key in value) return add2eToArray(value[key]);
    }

    // Objet à clés numériques exporté par un formulaire Foundry
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

  if (Array.isArray(value)) {
    return value.filter(v => v && typeof v === "object");
  }

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
  return add2eToArray(value).map(t => ({
    raw: String(t),
    label: add2eHumanTag(t)
  }));
}

function add2eRestrictionObject(primary, legacyAllowed, legacyShield) {
  const parsed = add2eMaybeJson(primary);

  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    return {
      allowedTags: add2eToArray(parsed.allowedTags),
      forbiddenTags: add2eToArray(parsed.forbiddenTags),
      legacyAllowed: [],
      legacyShield: false,
      source: "tags"
    };
  }

  const legacy = add2eToArray(legacyAllowed);

  return {
    allowedTags: [],
    forbiddenTags: [],
    legacyAllowed: legacy,
    legacyShield: legacyShield === true,
    source: legacy.length || legacyShield === true ? "legacy" : "empty"
  };
}

function add2eFeatureDisplay(feature, actorLevel = null) {
  const minLevel = Number(feature.minLevel ?? feature.level ?? feature.niveau ?? 1) || 1;
  const hasActorLevel = Number.isFinite(Number(actorLevel)) && Number(actorLevel) > 0;
  const active = hasActorLevel ? Number(actorLevel) >= minLevel : false;

  const tags = [
    ...add2eToArray(feature.tags),
    ...add2eToArray(feature.tag),
    ...add2eToArray(feature.effectTags),
    ...add2eToArray(feature.effets),
    ...add2eToArray(feature.effects)
  ];

  return {
    name: feature.name ?? feature.label ?? feature.titre ?? "Capacité",
    minLevel,
    description: feature.description ?? feature.desc ?? "",
    tags: add2eBadges(tags),
    statusLabel: hasActorLevel ? (active ? "Disponible" : "Plus tard") : `Niveau ${minLevel}`,
    statusClass: hasActorLevel ? (active ? "active" : "locked") : "neutral",
    uses: feature.uses ?? null
  };
}

function add2eProgressionRows(progression) {
  const saveLabels = ["Paralysie", "Pétrification", "Baguettes", "Souffles", "Sorts"];

  return add2eToObjectArray(progression)
    .map(row => ({
      niveau: row.niveau ?? row.level ?? "",
      xp: row.xp ?? "",
      thac0: row.thac0 ?? row.thaco ?? "",
      saves: add2eToArray(row.savingThrows ?? row.sauvegardes).map((value, index) => ({
        label: saveLabels[index] ?? `JS ${index + 1}`,
        value
      })),
      spells: add2eToArray(row.spellsPerLevel ?? row.sortsParNiveau).map((value, index) => ({
        level: index + 1,
        value
      }))
    }))
    .filter(row => row.niveau || row.xp || row.thac0 || row.saves.length || row.spells.length)
    .sort((a, b) => Number(a.niveau || 0) - Number(b.niveau || 0));
}

function add2eTitleRows(titles) {
  return add2eToObjectArray(titles)
    .map(t => ({
      minLevel: t.minLevel ?? t.niveau ?? t.level ?? "",
      maxLevel: t.maxLevel ?? t.niveau ?? t.level ?? "",
      title: t.title ?? t.titre ?? t.name ?? ""
    }))
    .filter(t => t.minLevel || t.maxLevel || t.title);
}

function add2eAttackRows(attacks) {
  return add2eToObjectArray(attacks)
    .map(a => ({
      minLevel: a.minLevel ?? a.niveau ?? "",
      maxLevel: a.maxLevel ?? a.niveau ?? "",
      attacks: a.attacks ?? a.value ?? a.nombre ?? ""
    }))
    .filter(a => a.minLevel || a.maxLevel || a.attacks);
}

function add2eSpellReqRows(reqs) {
  return add2eToObjectArray(reqs)
    .map(r => ({
      spellLevel: r.spellLevel ?? r.niveau ?? "",
      ability: add2eHumanText(r.requires?.ability ?? r.ability ?? ""),
      min: r.requires?.min ?? r.min ?? ""
    }))
    .filter(r => r.spellLevel || r.ability || r.min);
}

function add2eUsefulPermanentTags(tags) {
  const ignorePrefixes = [
    "classe:",
    "lanceur:",
    "sorts:",
    "preparation:",
    "armures:",
    "boucliers:",
    "type_action:",
    "interdit:"
  ];

  return add2eToArray(tags).filter(tag => {
    const t = add2eNormalizeTag(tag);
    return !ignorePrefixes.some(prefix => t.startsWith(prefix));
  });
}

function add2eDerivedSpellcasting(system, itemName) {
  const sc = add2eMaybeJson(system.spellcasting);
  const hasObject = sc && typeof sc === "object" && !Array.isArray(sc);

  const casterType = system.casterType || (hasObject ? sc.mode : "");
  const casterAbility = system.casterAbility || (hasObject ? (sc.ability || sc.abilityKey) : "");
  const spellLists = add2eToArray(system.spellLists || (hasObject ? sc.lists : []));
  const derivedLists = spellLists.length ? spellLists : (casterType ? [itemName] : []);

  return {
    enabled: hasObject ? !!sc.enabled : !!casterType,
    enabledLabel: hasObject ? (sc.enabled ? "Oui" : "Non") : (casterType ? "Oui" : "Non"),
    mode: add2eHumanText(hasObject ? (sc.mode || casterType || "—") : (casterType || "—")),
    type: add2eHumanText(hasObject ? (sc.type || "—") : "—"),
    ability: add2eHumanText(hasObject ? (sc.ability || sc.abilityKey || casterAbility || "—") : (casterAbility || "—")),
    startsAt: hasObject ? (sc.startsAt ?? "—") : "—",
    maxSpellLevel: hasObject ? (sc.maxSpellLevel ?? "—") : "—",
    usesSlots: hasObject ? !!sc.usesSlots : false,
    usesPreparation: hasObject ? !!sc.usesPreparation : false,
    preparationSource: add2eHumanText(hasObject ? (sc.preparationSource || "—") : "—"),
    lists: derivedLists.map(v => add2eHumanText(v))
  };
}

function add2eClassData(item, editable) {
  const system = item.system ?? {};
  const parentActor = item.parent?.documentName === "Actor" ? item.parent : null;
  const actorLevel = parentActor ? Number(parentActor.system?.niveau) || 1 : null;

  const weaponRestriction = add2eRestrictionObject(
    system.weaponRestriction,
    system.weaponsAllowed,
    false
  );

  const armorRestriction = add2eRestrictionObject(
    system.armorRestriction,
    system.armorAllowed,
    system.shieldAllowed
  );

  const spellcasting = add2eDerivedSpellcasting(system, item.name);

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
      primaryAbility: add2eHumanText(system.primaryAbility || system.casterAbility || system.principale || "—"),
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
      weaponLegacyAllowed: weaponRestriction.legacyAllowed.map(v => add2eHumanText(v)),
      weaponIsEmpty: weaponRestriction.source === "empty",

      armorAllowed: add2eBadges(armorRestriction.allowedTags),
      armorForbidden: add2eBadges(armorRestriction.forbiddenTags),
      armorLegacyAllowed: armorRestriction.legacyAllowed.map(v => add2eHumanText(v)),
      shieldLegacyAllowed: armorRestriction.legacyShield,
      armorIsEmpty: armorRestriction.source === "empty"
    },

    spellcasting,
    spellLists: spellcasting.lists,
    spellAccessRequirements: add2eSpellReqRows(system.spellAccessRequirements),
    classFeatures: add2eToObjectArray(system.classFeatures)
      .map(f => add2eFeatureDisplay(f, actorLevel))
      .sort((a, b) => a.minLevel - b.minLevel || String(a.name).localeCompare(String(b.name), "fr")),
    progressionRows: add2eProgressionRows(system.progression),
    titleRows: add2eTitleRows(system.titlesByLevel),
    attackRows: add2eAttackRows(system.attacksPerRound),
    savingThrows: add2eToArray(system.savingThrows).map(v => add2eHumanText(v)),
    strengthAdjustments: add2eToObjectArray(system.strengthAdjustments)
  };
}

export class Add2eClassSheet extends ItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["add2e", "sheet", "item", "classe"],
      template: "systems/add2e/templates/item/classe-sheet.hbs",
      width: 980,
      height: 820,
      resizable: true,
      tabs: [{ navSelector: ".tabs", contentSelector: ".sheet-body", initial: "resume" }]
    });
  }

  getData(options = {}) {
    const data = super.getData(options);

    data.item = this.object;
    data.system = this.object.system ?? {};

    Object.assign(data, add2eClassData(this.object, data.editable));

    return data;
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.find(".tabs a").on("click", ev => {
      ev.preventDefault();

      const tab = ev.currentTarget.dataset.tab;

      html.find(".tabs a").removeClass("active");
      html.find(ev.currentTarget).addClass("active");

      html.find(".content").addClass("hidden");
      html.find(`.content[data-tab="${tab}"]`).removeClass("hidden");
    });
  }

  async _updateObject(event, formData) {
    await this.object.update(formData);
  }
}

export const Add2eItemSheet = Add2eClassSheet;
