// scripts/add2e/item-sheet-registration.mjs
// ADD2E — Enregistrement strict des fiches d'items spécialisées.
// Compatible Foundry V13/V14/V15 — ApplicationV2 / DialogV2.
// Version : 2026-08-04-canonical-power-source-v6

import { Add2eItemSheet } from "../add2e-item-sheet.mjs";
globalThis.Add2eItemSheet = Add2eItemSheet;

const MAGIC_ITEM_TYPES = new Set(["arme", "armure", "objet"]);
const EDITOR_VERSION = "2026-08-04-canonical-power-source-v6";
const BONUS_DEFINITIONS = Object.freeze({
  attack: Object.freeze({ label: "Bonus au toucher", effectType: "attack_bonus", field: "attackBonus" }),
  damage: Object.freeze({ label: "Bonus aux dégâts", effectType: "damage_bonus", field: "damageBonus" }),
  armor: Object.freeze({ label: "Bonus de CA", effectType: "armor_class_bonus", field: "bonus" }),
  fixedArmor: Object.freeze({ label: "CA fixe", effectType: "fixed_armor_class", field: "value" })
});

function clone(value) {
  if (value === undefined) return undefined;
  try { return foundry.utils.deepClone(value); }
  catch (_error) { return structuredClone(value); }
}

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function norm(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9:+*_.-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function format(value) {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value !== "object") return String(value);
  try { return JSON.stringify(value, null, 2); }
  catch (_error) { return String(value); }
}

function optionalNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const result = Number(String(value).replace(",", "."));
  return Number.isFinite(result) ? result : null;
}

function number(value, fallback = 0) {
  const result = optionalNumber(value);
  return result === null ? fallback : result;
}

function signed(value) {
  const result = number(value, 0);
  return `${result >= 0 ? "+" : ""}${result}`;
}

function hasOwn(object, key) {
  return Boolean(object && Object.prototype.hasOwnProperty.call(object, key));
}

function defaultActorTokenLink(actor, data = {}) {
  const type = String(actor?.type ?? data?.type ?? "").trim().toLowerCase();
  if (type === "personnage") return true;
  if (["monstre", "monster"].includes(type)) return false;
  return null;
}

function defaultCharacterSightRange() {
  const distance = Number(canvas?.scene?.grid?.distance ?? game?.scenes?.active?.grid?.distance ?? 1);
  return Number.isFinite(distance) && distance > 0 ? distance * 5 : 5;
}

function canonicalPowers(system = {}) {
  const powers = system?.pouvoirs;
  return Array.isArray(powers)
    ? powers.filter(power => power && typeof power === "object" && !Array.isArray(power))
    : [];
}

function powerStore(item) {
  return {
    path: "system.pouvoirs",
    entries: canonicalPowers(item?.system ?? {}),
    raw: Array.isArray(item?.system?.pouvoirs) ? item.system.pouvoirs : []
  };
}

function effectArray(power) {
  return Array.isArray(power?.effects)
    ? power.effects.filter(effect => effect && typeof effect === "object" && !Array.isArray(effect))
    : [];
}

function effectBonusValues(effect = {}) {
  const type = norm(effect.type);
  const values = {};

  if (type === BONUS_DEFINITIONS.attack.effectType) {
    const value = optionalNumber(effect.attackBonus);
    if (Number.isFinite(value) && value !== 0) values.attack = value;
  }

  if (type === BONUS_DEFINITIONS.damage.effectType) {
    const value = optionalNumber(effect.damageBonus);
    if (Number.isFinite(value) && value !== 0) values.damage = value;
  }

  if (type === BONUS_DEFINITIONS.armor.effectType) {
    const value = optionalNumber(effect.bonus);
    if (Number.isFinite(value) && value !== 0) values.armor = Math.abs(value);
  }

  if (type === BONUS_DEFINITIONS.fixedArmor.effectType) {
    const value = optionalNumber(effect.value);
    if (Number.isFinite(value)) values.fixedArmor = value;
  }

  return values;
}

function powerBonusSummary(power) {
  const result = { attack: 0, damage: 0, armor: 0, fixedArmor: null };

  for (const effect of effectArray(power)) {
    const values = effectBonusValues(effect);
    result.attack += Number(values.attack) || 0;
    result.damage += Number(values.damage) || 0;
    result.armor += Number(values.armor) || 0;

    if (Number.isFinite(values.fixedArmor)) {
      result.fixedArmor = result.fixedArmor === null
        ? values.fixedArmor
        : Math.min(result.fixedArmor, values.fixedArmor);
    }
  }

  return result;
}

function itemPowerBonusSummary(item) {
  const result = { attack: 0, damage: 0, armor: 0, fixedArmor: null };

  for (const power of canonicalPowers(item?.system ?? {})) {
    const values = powerBonusSummary(power);
    result.attack += values.attack;
    result.damage += values.damage;
    result.armor += values.armor;

    if (Number.isFinite(values.fixedArmor)) {
      result.fixedArmor = result.fixedArmor === null
        ? values.fixedArmor
        : Math.min(result.fixedArmor, values.fixedArmor);
    }
  }

  return result;
}

function powerFieldValue(item, key) {
  const value = itemPowerBonusSummary(item)[String(key ?? "")];
  return value === null || value === undefined ? "" : value;
}

function powerValueLabel(power) {
  const values = powerBonusSummary(power);
  return [
    values.attack ? `${BONUS_DEFINITIONS.attack.label} ${signed(values.attack)}` : "",
    values.damage ? `${BONUS_DEFINITIONS.damage.label} ${signed(values.damage)}` : "",
    values.armor ? `${BONUS_DEFINITIONS.armor.label} ${signed(values.armor)}` : "",
    Number.isFinite(values.fixedArmor) ? `${BONUS_DEFINITIONS.fixedArmor.label} ${values.fixedArmor}` : ""
  ].filter(Boolean).join(" · ");
}

const CATEGORY_LABELS = Object.freeze({
  attribute: "Caractéristiques",
  charges: "Charges",
  combat: "Combat",
  consumable: "Consommable",
  control: "Contrôle",
  curse: "Malédiction",
  defense: "Défense",
  destruction: "Destruction",
  detection: "Détection",
  environment: "Environnement",
  healing: "Guérison",
  holy: "Sacré",
  illusion: "Illusion",
  immunity: "Immunité",
  light: "Lumière",
  movement: "Déplacement",
  negation: "Négation",
  poison: "Poison",
  protection: "Protection",
  random: "Aléatoire",
  ranged: "Distance",
  resistance: "Résistance",
  restriction: "Restriction",
  scroll: "Parchemin",
  social: "Social",
  spell: "Sort",
  summoning: "Invocation",
  survival: "Survie",
  transformation: "Transformation"
});

function categoryLabel(value) {
  return CATEGORY_LABELS[norm(value)] ?? String(value ?? "Autre");
}

function automationLabel(value) {
  return Object.freeze({
    automatic: "Automatique",
    assisted: "Assisté par le MD",
    manual: "Manuel",
    chat_card: "Carte de chat"
  })[norm(value)] ?? String(value ?? "—");
}

function activationLabel(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "—";
  return [value.type, value.trigger]
    .map(entry => String(entry ?? "").trim())
    .filter(Boolean)
    .join(" — ") || "—";
}

function sheetPowers(item) {
  return canonicalPowers(item?.system ?? {}).map((power, index) => {
    const parameters = power.parameters && typeof power.parameters === "object" && !Array.isArray(power.parameters)
      ? power.parameters
      : {};
    const effects = effectArray(power);
    const section = String(power.source?.section ?? "").trim();
    const page = String(power.source?.page ?? "").trim();
    const canonicalValueLabel = powerValueLabel(power);
    const kind = String(power.kind ?? "").trim();

    return {
      ...power,
      _add2eIndex: index,
      _add2eName: String(power.name ?? `Pouvoir ${index + 1}`).trim(),
      _add2eCost: Math.max(0, Number(power.cost ?? 0) || 0),
      _add2eKindLabel: kind === "catalogue"
        ? "Catalogue canonique"
        : kind === "generated"
          ? "Pouvoir généré canonique"
          : "Pouvoir canonique",
      _add2eCategoryLabel: categoryLabel(power.category),
      _add2eAutomationLabel: automationLabel(power.automation),
      _add2eActivationLabel: activationLabel(power.activation),
      _add2eHasParameters: Object.keys(parameters).length > 0,
      _add2eParametersJson: format(parameters),
      _add2eHasEffects: effects.length > 0,
      _add2eEffectsJson: format(effects),
      _add2eSourceLabel: [section, page ? `page ${page}` : ""].filter(Boolean).join(", ") || "—",
      _add2eHasCanonicalValue: Boolean(canonicalValueLabel),
      _add2eCanonicalValueLabel: canonicalValueLabel
    };
  });
}

async function resolveItem(uuid) {
  const value = String(uuid ?? "").trim();
  if (!value) return null;

  try {
    const document = await fromUuid(value);
    if (document?.documentName === "Item") return document;
  } catch (_error) {}

  const id = value.split(".").at(-1);
  return game.items?.get?.(id)
    ?? game.actors?.contents?.flatMap(actor => actor.items?.contents ?? []).find(item => item.id === id)
    ?? null;
}

function resolveTemplates(value, parameters) {
  if (Array.isArray(value)) return value.map(entry => resolveTemplates(entry, parameters));

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, resolveTemplates(entry, parameters)])
    );
  }

  if (typeof value !== "string") return clone(value);

  const exact = value.match(/^@([A-Za-z0-9_]+)$/);
  if (exact && hasOwn(parameters, exact[1])) return clone(parameters[exact[1]]);

  return value.replace(/@([A-Za-z0-9_]+)/g, (match, key) => {
    if (!hasOwn(parameters, key)) return match;
    return typeof parameters[key] === "object"
      ? JSON.stringify(parameters[key])
      : String(parameters[key]);
  });
}

async function editCanonical(definition, current = {}) {
  const configure = globalThis.add2eMagicCatalogueConfigurePower;
  if (typeof configure !== "function") {
    ui.notifications.error("L’éditeur canonique lisible des pouvoirs est indisponible.");
    return null;
  }
  return configure(definition, current);
}

async function editEmbeddedPower(power) {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.wait) {
    ui.notifications.error("DialogV2 est introuvable.");
    return null;
  }

  const name = String(power.name ?? "Pouvoir").trim() || "Pouvoir";
  const description = String(power.description ?? "");
  const cost = Math.max(0, Number(power.cost ?? 0) || 0);

  return DialogV2.wait({
    window: { title: `Modifier — ${name}` },
    modal: true,
    rejectClose: false,
    content: `<div class="add2e-dialog" style="min-width:520px;padding:10px;display:grid;gap:8px">
      <label>Nom affiché<input name="name" value="${esc(name)}"></label>
      <label>Coût en charges<input name="cost" type="number" min="0" step="1" value="${cost}"></label>
      <label>Description<textarea name="description" rows="6">${esc(description)}</textarea></label>
    </div>`,
    buttons: [
      {
        action: "save",
        label: "Enregistrer",
        icon: "fa-solid fa-check",
        default: true,
        callback: (_event, button, dialog) => {
          const root = button?.form ?? dialog?.element;
          const nextName = String(root?.querySelector('[name="name"]')?.value ?? "").trim();
          if (!nextName) return false;

          return {
            name: nextName,
            cost: Math.max(0, Math.trunc(Number(root?.querySelector('[name="cost"]')?.value ?? 0) || 0)),
            description: String(root?.querySelector('[name="description"]')?.value ?? "")
          };
        }
      },
      {
        action: "cancel",
        label: "Annuler",
        icon: "fa-solid fa-xmark",
        callback: () => null
      }
    ]
  });
}

async function storePower(item, index, power) {
  const next = canonicalPowers(item?.system ?? {}).map(clone);
  if (!next[index]) return false;
  next[index] = power;
  await item.update(
    { "system.pouvoirs": next },
    { add2eMagicPowerSheetEditor: true }
  );
  return true;
}

async function editPower(itemUuid, powerIndex) {
  const item = await resolveItem(itemUuid);
  if (!item) {
    ui.notifications.error("L’objet magique est introuvable.");
    return false;
  }

  if (item.isOwner === false) {
    ui.notifications.warn("Tu ne peux pas modifier cet objet.");
    return false;
  }

  const index = Number(powerIndex);
  const powers = canonicalPowers(item?.system ?? {});
  const power = Number.isInteger(index) ? powers[index] : null;

  if (!power || typeof power !== "object" || Array.isArray(power)) {
    ui.notifications.error("Le pouvoir sélectionné est introuvable.");
    return false;
  }

  let next;

  if (power.kind === "catalogue") {
    if (!power.catalogueId) {
      ui.notifications.error("Le pouvoir de catalogue ne possède pas de catalogueId canonique.");
      return false;
    }

    if (typeof globalThis.add2eLoadMagicPowerCatalogue !== "function") {
      ui.notifications.error("Le catalogue de pouvoirs est indisponible.");
      return false;
    }

    const catalogue = await globalThis.add2eLoadMagicPowerCatalogue();
    const definition = catalogue?.powerById?.get?.(String(power.catalogueId));

    if (!definition) {
      ui.notifications.error(`Pouvoir inconnu : ${power.catalogueId}.`);
      return false;
    }

    const parameters = await editCanonical(definition, power.parameters ?? {});
    if (parameters === null) return false;

    next = {
      ...clone(power),
      schema: 2,
      kind: "catalogue",
      catalogueId: definition.id,
      name: definition.label,
      label: definition.label,
      category: definition.category,
      automation: definition.automation,
      activation: clone(definition.activation ?? {}),
      parameters: clone(parameters),
      effects: resolveTemplates(definition.effects ?? [], parameters),
      effectTemplates: clone(definition.effects ?? []),
      compatibility: clone(definition.compatibility ?? {}),
      validation: clone(definition.validation ?? {}),
      source: clone(definition.source ?? {}),
      catalogue: {
        id: catalogue?.manifest?.catalogueId ?? catalogue?.manifest?.id ?? "add2e-gdm-magic-powers",
        version: catalogue?.manifest?.version ?? "",
        runtimeVersion: catalogue?.runtimeVersion ?? ""
      }
    };
  } else {
    const edited = await editEmbeddedPower(power);
    if (!edited || typeof edited !== "object") return false;

    next = {
      ...clone(power),
      name: edited.name,
      label: edited.name,
      description: edited.description,
      cost: edited.cost
    };
  }

  if (!await storePower(item, index, next)) return false;

  ui.notifications.info(`${next.name ?? "Pouvoir"} a été mis à jour.`);
  item.sheet?.render?.({ force: true });
  return true;
}

export function add2eRegisterClassItemSheet() {
  const options = {
    types: ["classe"],
    makeDefault: true,
    canConfigure: true,
    canBeDefault: true,
    label: "ADD2E | Fiche Classe"
  };

  const ItemsCollection = foundry?.documents?.collections?.Items;
  if (ItemsCollection?.registerSheet) {
    ItemsCollection.registerSheet("add2e", Add2eItemSheet, options);
  }

  const DocumentSheetConfig = foundry?.applications?.apps?.DocumentSheetConfig;
  const ItemDocument = CONFIG?.Item?.documentClass ?? foundry?.documents?.Item;

  if (DocumentSheetConfig?.registerSheet && ItemDocument) {
    try {
      DocumentSheetConfig.registerSheet(ItemDocument, "add2e", Add2eItemSheet, options);
    } catch (error) {
      console.warn("[ADD2E][SHEETS] Enregistrement de la fiche de classe impossible.", error);
    }
  }

  console.log("[ADD2E][SHEETS] Fiche Item.classe enregistrée :", Add2eItemSheet?.name);
}

function registerHelpers() {
  if (typeof Handlebars === "undefined") return;
  Handlebars.registerHelper("add2eMagicSheetPowers", item => sheetPowers(item));
  Handlebars.registerHelper("add2eMagicPowerFieldValue", (item, key) => powerFieldValue(item, key));
}

globalThis.add2eRegisterClassItemSheet = add2eRegisterClassItemSheet;
globalThis.add2eMagicBuilderEditPower = editPower;
globalThis.add2eMagicBuilderSheetPowers = sheetPowers;
globalThis.add2eMagicPowerFieldValue = powerFieldValue;
globalThis.ADD2E_MAGIC_POWER_SHEET_EDITOR_VERSION = EDITOR_VERSION;

registerHelpers();

Hooks.on("preCreateActor", (actor, data = {}) => {
  const type = String(actor?.type ?? data?.type ?? "").trim().toLowerCase();
  const actorLink = defaultActorTokenLink(actor, data);
  if (actorLink === null) return;

  const prototypeToken = { actorLink };
  if (type === "personnage") {
    prototypeToken.sight = {
      enabled: true,
      angle: 270,
      range: defaultCharacterSightRange()
    };
  }

  actor.updateSource({ prototypeToken });
});

Hooks.once("init", () => {
  registerHelpers();
  console.log("ADD2e | Initialisation du système...");
  add2eRegisterClassItemSheet();
});
