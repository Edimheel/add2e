// scripts/add2e/item-sheet-registration.mjs
// ADD2E — Enregistrement strict des fiches d'items spécialisées.
// Compatible Foundry V13/V14/V15 — ApplicationV2 / DialogV2.
// Version : 2026-08-04-canonical-power-source-v5

import { Add2eItemSheet } from "../add2e-item-sheet.mjs";
globalThis.Add2eItemSheet = Add2eItemSheet;

const POWER_FIELDS = ["pouvoirs", "powers", "pouvoirsMagiques", "magicalPowers"];
const MAGIC_ITEM_TYPES = new Set(["arme", "armure", "objet"]);
const EDITOR_VERSION = "2026-08-04-canonical-power-source-v5";
const MIGRATION_VERSION = "2026-08-04-canonical-power-source-v5";
const MIGRATION_FLAG = "canonicalPowerSourceVersion";
const BUILDER_MODIFIER_IDS = new Set([
  "magic-item-builder:attack:bonus",
  "magic-item-builder:damage:bonus",
  "magic-item-builder:armor-class:bonus",
  "magic-item-builder:armor-class:fixed"
]);
const BONUS_DEFINITIONS = Object.freeze({
  attack: Object.freeze({ label: "Bonus au toucher", name: "Bonus magique au toucher", category: "combat", effectType: "attack_bonus", field: "attackBonus" }),
  damage: Object.freeze({ label: "Bonus aux dégâts", name: "Bonus magique aux dégâts", category: "combat", effectType: "damage_bonus", field: "damageBonus" }),
  armor: Object.freeze({ label: "Bonus de CA", name: "Bonus magique de classe d’armure", category: "defense", effectType: "armor_class_bonus", field: "bonus" }),
  fixedArmor: Object.freeze({ label: "CA fixe", name: "Classe d’armure magique fixe", category: "defense", effectType: "fixed_armor_class", field: "value" })
});
const ATTACK_TYPES = new Set(["attack_bonus", "hit_bonus", "combat_bonus", "attack_damage_bonus", "weapon_magic_bonus"]);
const DAMAGE_TYPES = new Set(["damage_bonus", "combat_bonus", "attack_damage_bonus", "weapon_magic_bonus"]);
const ARMOR_TYPES = new Set(["armor_class_bonus", "armor_bonus", "ac_bonus", "defense_bonus", "protection_bonus"]);
const FIXED_ARMOR_TYPES = new Set([
  "fixed_armor_class", "armor_class_fixed", "armor_class_base", "fixed_ac", "ac_fixed",
  "classe_armure_fixe", "classe_armure_base", "ca_fixe", "ca_base", "defense_base"
]);
const OBSOLETE_ENCHANTMENT_FIELDS = Object.freeze([
  "bonusToucher", "bonusDegats", "bonusCA", "caFixe",
  "bonus_toucher", "bonus_degats", "bonus_ca", "ca_fixe",
  "basePoids", "baseWeightValue", "basePoidsUnite", "baseWeightUnit",
  "basePoidsEncombrementPo", "baseEncumbranceGoldPieces"
]);
const OBSOLETE_POWER_FIELDS = Object.freeze(["powers", "pouvoirsMagiques", "magicalPowers"]);
const OBSOLETE_MAGIC_SYSTEM_FIELDS = Object.freeze([
  "bonus_toucher", "bonus_degats", "bonus_ac", "bonus_ca", "ca_fixe", "caFixe"
]);

function clone(value) {
  if (value === undefined) return undefined;
  try { return foundry.utils.deepClone(value); }
  catch (_error) { return structuredClone(value); }
}
function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
function norm(value) {
  return String(value ?? "").trim().toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, "")
    .replace(/[^a-z0-9:+*_.-]+/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
}
function list(value) {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(list);
  if (value instanceof Set) return [...value].flatMap(list);
  if (typeof value === "string") return value.split(/[,;|\n]+/g).map(entry => entry.trim()).filter(Boolean);
  if (typeof value === "object") {
    for (const key of ["value", "values", "list", "lists", "items", "entries", "tags", "effectTags", "targets", "types"]) {
      if (value[key] !== undefined && value[key] !== null) return list(value[key]);
    }
    return Object.values(value).flatMap(list);
  }
  return [value];
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
function forcedDeletion() {
  const ForcedDeletion = foundry?.data?.operators?.ForcedDeletion;
  if (typeof ForcedDeletion?.create !== "function") {
    throw new Error("[ADD2E][MIGRATION] foundry.data.operators.ForcedDeletion est requis par Foundry V13/V14/V15.");
  }
  return ForcedDeletion.create(null);
}
function addDeletion(update, source, path, sourceKey) {
  if (!hasOwn(source, sourceKey)) return;
  update[path] = forcedDeletion();
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

function powerStore(item) {
  const system = item?.system ?? {};
  let empty = null;
  for (const field of POWER_FIELDS) {
    const raw = system[field];
    let store = null;
    if (Array.isArray(raw)) store = { path: `system.${field}`, entries: raw, keys: raw.map((_entry, index) => index), object: false, raw };
    else if (raw && typeof raw === "object") {
      const keys = Object.keys(raw);
      store = { path: `system.${field}`, entries: keys.map(key => raw[key]), keys, object: true, raw };
    }
    if (!store) continue;
    if (store.entries.length) return store;
    empty ??= store;
  }
  return empty ?? { path: "system.pouvoirs", entries: [], keys: [], object: false, raw: [] };
}
function rawPowers(system = {}) {
  for (const field of POWER_FIELDS) {
    const raw = system[field];
    if (Array.isArray(raw)) return raw.filter(entry => entry && typeof entry === "object");
    if (raw && typeof raw === "object") return Object.values(raw).filter(entry => entry && typeof entry === "object");
  }
  return [];
}
function effectArray(power) {
  const raw = power?.effects;
  if (Array.isArray(raw)) return raw.filter(effect => effect && typeof effect === "object");
  if (raw && typeof raw === "object") return Object.values(raw).filter(effect => effect && typeof effect === "object");
  return [];
}
function firstOptional(...values) {
  for (const value of values) {
    const candidate = optionalNumber(value);
    if (candidate !== null) return candidate;
  }
  return null;
}
function firstNonZero(...values) {
  for (const value of values) {
    const candidate = optionalNumber(value);
    if (candidate !== null && candidate !== 0) return candidate;
  }
  return null;
}
function effectBonusValues(effect = {}) {
  const type = norm(effect.type ?? effect.kind ?? effect.category);
  const values = {};
  if (ATTACK_TYPES.has(type)) {
    const value = firstOptional(effect.attackBonus, effect.hitBonus, effect.bonusToucher, effect.toucher, effect.bonus, effect.value);
    if (Number.isFinite(value) && value !== 0) values.attack = value;
  }
  if (DAMAGE_TYPES.has(type)) {
    const value = firstOptional(effect.damageBonus, effect.bonusDegats, effect.degats, effect.bonus, effect.value);
    if (Number.isFinite(value) && value !== 0) values.damage = value;
  }
  if (ARMOR_TYPES.has(type)) {
    const value = firstOptional(effect.bonus, effect.value, effect.amount, effect.armorClassBonus, effect.acBonus);
    if (Number.isFinite(value) && value !== 0) values.armor = Math.abs(value);
  }
  if (FIXED_ARMOR_TYPES.has(type)) {
    const value = firstOptional(effect.value, effect.amount, effect.armorClass, effect.armor_class, effect.ac, effect.ca, effect.fixedCA, effect.fixedAc, effect.base);
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
      result.fixedArmor = result.fixedArmor === null ? values.fixedArmor : Math.min(result.fixedArmor, values.fixedArmor);
    }
  }
  return result;
}
function itemPowerBonusSummary(item) {
  const result = { attack: 0, damage: 0, armor: 0, fixedArmor: null };
  for (const power of rawPowers(item?.system ?? {})) {
    const values = powerBonusSummary(power);
    result.attack += values.attack;
    result.damage += values.damage;
    result.armor += values.armor;
    if (Number.isFinite(values.fixedArmor)) {
      result.fixedArmor = result.fixedArmor === null ? values.fixedArmor : Math.min(result.fixedArmor, values.fixedArmor);
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

const CATEGORY_LABELS = {
  attribute: "Caractéristiques", charges: "Charges", combat: "Combat", consumable: "Consommable",
  control: "Contrôle", curse: "Malédiction", defense: "Défense", destruction: "Destruction",
  detection: "Détection", environment: "Environnement", healing: "Guérison", holy: "Sacré",
  illusion: "Illusion", immunity: "Immunité", light: "Lumière", movement: "Déplacement",
  negation: "Négation", poison: "Poison", protection: "Protection", random: "Aléatoire",
  ranged: "Distance", resistance: "Résistance", restriction: "Restriction", scroll: "Parchemin",
  social: "Social", spell: "Sort", summoning: "Invocation", survival: "Survie", transformation: "Transformation"
};
function categoryLabel(value) { return CATEGORY_LABELS[norm(value)] ?? String(value ?? "Autre"); }
function automationLabel(value) {
  return ({ automatic: "Automatique", assisted: "Assisté par le MD", manual: "Manuel", chat_card: "Carte de chat" })[norm(value)] ?? String(value ?? "—");
}
function activationLabel(value) {
  if (!value) return "—";
  if (typeof value === "string") return value;
  return [value.type, value.trigger].map(entry => String(entry ?? "").trim()).filter(Boolean).join(" — ") || "—";
}
function sheetPowers(item) {
  return powerStore(item).entries
    .map((power, index) => ({ power, index }))
    .filter(entry => entry.power && typeof entry.power === "object")
    .map(({ power, index }) => {
      const parameters = power.parameters && typeof power.parameters === "object" ? power.parameters : {};
      const effects = effectArray(power);
      const section = String(power.source?.section ?? "").trim();
      const page = String(power.source?.page ?? "").trim();
      const canonicalValueLabel = powerValueLabel(power);
      return {
        ...power,
        _add2eIndex: index,
        _add2eName: String(power.name ?? power.nom ?? power.label ?? `Pouvoir ${index + 1}`).trim(),
        _add2eCost: Math.max(0, Number(power.cout ?? power.cost ?? power.chargeCost ?? 0) || 0),
        _add2eKindLabel: power.catalogueId || power.kind === "catalogue" ? "Catalogue canonique" : "Pouvoir embarqué",
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
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, resolveTemplates(entry, parameters)]));
  }
  if (typeof value !== "string") return clone(value);
  const exact = value.match(/^@([A-Za-z0-9_]+)$/);
  if (exact && hasOwn(parameters, exact[1])) return clone(parameters[exact[1]]);
  return value.replace(/@([A-Za-z0-9_]+)/g, (match, key) => {
    if (!hasOwn(parameters, key)) return match;
    return typeof parameters[key] === "object" ? JSON.stringify(parameters[key]) : String(parameters[key]);
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
  const name = String(power.name ?? power.nom ?? power.label ?? "Pouvoir").trim() || "Pouvoir";
  const description = String(power.description ?? power.desc ?? "");
  const cost = Math.max(0, Number(power.cout ?? power.cost ?? power.chargeCost ?? 0) || 0);
  return DialogV2.wait({
    window: { title: `Modifier — ${name}` },
    modal: true,
    rejectClose: false,
    content: `<div class="add2e-dialog" style="min-width:520px;padding:10px;display:grid;gap:8px"><label>Nom affiché<input name="name" value="${esc(name)}"></label><label>Coût en charges<input name="cost" type="number" min="0" step="1" value="${cost}"></label><label>Description<textarea name="description" rows="6">${esc(description)}</textarea></label></div>`,
    buttons: [
      {
        action: "save", label: "Enregistrer", icon: "fa-solid fa-check", default: true,
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
      { action: "cancel", label: "Annuler", icon: "fa-solid fa-xmark", callback: () => null }
    ]
  });
}
async function storePower(item, store, index, power) {
  if (store.object) {
    const next = clone(store.raw);
    const key = store.keys[index];
    if (key === undefined) return false;
    next[key] = power;
    await item.update({ [store.path]: next }, { add2eMagicPowerSheetEditor: true });
  } else {
    const next = store.entries.map(clone);
    if (!next[index]) return false;
    next[index] = power;
    await item.update({ [store.path]: next }, { add2eMagicPowerSheetEditor: true });
  }
  return true;
}
async function editPower(itemUuid, powerIndex) {
  const item = await resolveItem(itemUuid);
  if (!item) return ui.notifications.error("L’objet magique est introuvable."), false;
  if (item.isOwner === false) return ui.notifications.warn("Tu ne peux pas modifier cet objet."), false;
  const store = powerStore(item);
  const index = Number(powerIndex);
  const power = Number.isInteger(index) ? store.entries[index] : null;
  if (!power || typeof power !== "object") return ui.notifications.error("Le pouvoir sélectionné est introuvable."), false;
  let next;
  if (power.catalogueId) {
    if (typeof globalThis.add2eLoadMagicPowerCatalogue !== "function") return ui.notifications.error("Le catalogue de pouvoirs est indisponible."), false;
    const catalogue = await globalThis.add2eLoadMagicPowerCatalogue();
    const definition = catalogue?.powerById?.get?.(String(power.catalogueId));
    if (!definition) return ui.notifications.error(`Pouvoir inconnu : ${power.catalogueId}.`), false;
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
    next = { ...clone(power), name: edited.name, nom: edited.name, label: edited.name, description: edited.description, cout: edited.cost, cost: edited.cost };
  }
  if (!await storePower(item, store, index, next)) return false;
  ui.notifications.info(`${next.name ?? next.nom ?? "Pouvoir"} a été mis à jour.`);
  item.sheet?.render?.({ force: true });
  return true;
}

function magicItemType(source) { return String(source?.type ?? "").trim().toLowerCase(); }
function itemHasMagicSignals(source) {
  const system = source?.system ?? {};
  return MAGIC_ITEM_TYPES.has(magicItemType(source)) && Boolean(
    system.magique === true
    || system.magic === true
    || rawPowers(system).length
    || (system.enchantement && typeof system.enchantement === "object")
    || source?.flags?.add2e?.magicItemProfile
    || source?.flags?.add2e?.magicPowerCatalogue
    || source?.flags?.add2e?.magicItemBuilder
  );
}
function builderModifierValue(source, key) {
  const modifiers = Array.isArray(source?.flags?.add2e?.modifiers) ? source.flags.add2e.modifiers : [];
  const id = ({
    attack: "magic-item-builder:attack:bonus",
    damage: "magic-item-builder:damage:bonus",
    armor: "magic-item-builder:armor-class:bonus",
    fixedArmor: "magic-item-builder:armor-class:fixed"
  })[key];
  const modifier = modifiers.find(entry => entry?.id === id);
  if (!modifier) return null;
  return key === "fixedArmor" ? optionalNumber(modifier?.value?.max) : optionalNumber(modifier.value);
}
function removeBuilderModifiers(source) {
  const modifiers = Array.isArray(source?.flags?.add2e?.modifiers) ? source.flags.add2e.modifiers : [];
  return modifiers.filter(modifier => !BUILDER_MODIFIER_IDS.has(String(modifier?.id ?? "")) && modifier?.metadata?.producer !== "magic-item-builder");
}
function legacyBonusValues(source) {
  const raw = source?.system?.enchantement;
  const enchantment = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  return {
    attack: firstNonZero(enchantment.bonusToucher, enchantment.bonus_toucher, builderModifierValue(source, "attack")),
    damage: firstNonZero(enchantment.bonusDegats, enchantment.bonus_degats, builderModifierValue(source, "damage")),
    armor: firstNonZero(enchantment.bonusCA, enchantment.bonus_ca, builderModifierValue(source, "armor")),
    fixedArmor: firstOptional(enchantment.caFixe, enchantment.ca_fixe, builderModifierValue(source, "fixedArmor"))
  };
}
function generatedPower(key, value, application) {
  const definition = BONUS_DEFINITIONS[key];
  const effectValue = key === "armor" ? Math.abs(Number(value)) : Number(value);
  return {
    schema: 2,
    kind: "generated",
    name: definition.name,
    label: definition.name,
    category: definition.category,
    automation: "automatic",
    activation: { type: "passive", trigger: "equipped" },
    parameters: { application },
    effects: [{ type: definition.effectType, [definition.field]: effectValue, application }],
    compatibility: {},
    validation: {},
    source: { section: "Migration canonique ADD2E" }
  };
}
function ensurePowerValue(powers, key, value, application) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return;
  if (key !== "fixedArmor" && Number(value) === 0) return;
  const alreadyStored = powers.some(power => {
    const summary = powerBonusSummary(power);
    return key === "fixedArmor" ? Number.isFinite(summary.fixedArmor) : Number(summary[key]) !== 0;
  });
  if (!alreadyStored) powers.push(generatedPower(key, value, application));
}
function canonicalBaseWeight(enchantment = {}) {
  const raw = enchantment.baseWeight && typeof enchantment.baseWeight === "object" ? enchantment.baseWeight : {};
  return {
    value: optionalNumber(raw.value ?? enchantment.basePoids ?? enchantment.baseWeightValue),
    unit: String(raw.unit ?? enchantment.basePoidsUnite ?? enchantment.baseWeightUnit ?? "").trim(),
    encumbranceGoldPieces: optionalNumber(raw.encumbranceGoldPieces ?? enchantment.basePoidsEncombrementPo ?? enchantment.baseEncumbranceGoldPieces)
  };
}
function canonicalBaseStats(enchantment = {}) {
  const raw = enchantment.baseStats && typeof enchantment.baseStats === "object" ? enchantment.baseStats : {};
  return {
    bonusToucher: number(raw.bonusToucher, 0),
    bonusDegats: number(raw.bonusDegats, 0),
    bonusCA: number(raw.bonusCA, 0),
    caFixe: optionalNumber(raw.caFixe)
  };
}
function cleanLegacyMagicTags(system = {}, generatedTags = []) {
  const generated = new Set(list(generatedTags).map(tag => String(tag).trim().toLowerCase()).filter(Boolean));
  return list(system.effectTags ?? system.effets ?? system.effects)
    .map(tag => String(tag ?? "").trim())
    .filter(Boolean)
    .filter(tag => !generated.has(tag.toLowerCase()))
    .filter(tag => !/^(bonus_attaque|bonus_toucher|bonus_degats):[+-]?\d+(?:[.,]\d+)?$/i.test(tag));
}
function buildCanonicalPowerMigration(source) {
  if (!itemHasMagicSignals(source)) return null;
  if (source?.flags?.add2e?.[MIGRATION_FLAG] === MIGRATION_VERSION) return null;
  const system = source.system ?? {};
  const rawEnchant = system.enchantement && typeof system.enchantement === "object" && !Array.isArray(system.enchantement)
    ? system.enchantement
    : {};
  const application = ["source", "porteur"].includes(String(rawEnchant.application ?? "").trim())
    ? String(rawEnchant.application).trim()
    : magicItemType(source) === "arme" ? "source" : "porteur";
  const baseStats = canonicalBaseStats(rawEnchant);
  const powers = rawPowers(system).map(clone);
  const legacy = legacyBonusValues(source);
  ensurePowerValue(powers, "attack", legacy.attack, application);
  ensurePowerValue(powers, "damage", legacy.damage, application);
  ensurePowerValue(powers, "armor", legacy.armor, application);
  ensurePowerValue(powers, "fixedArmor", legacy.fixedArmor, application);

  const currentBuilder = source?.flags?.add2e?.magicItemBuilder && typeof source.flags.add2e.magicItemBuilder === "object"
    ? source.flags.add2e.magicItemBuilder
    : {};
  const update = {
    "system.pouvoirs": powers,
    "system.magique": true,
    "system.enchantement.schema": 3,
    "system.enchantement.baseUuid": String(rawEnchant.baseUuid ?? source?.flags?.add2e?.baseItemUuid ?? "").trim(),
    "system.enchantement.baseName": String(rawEnchant.baseName ?? source?.flags?.add2e?.baseItemName ?? "").trim(),
    "system.enchantement.baseType": String(rawEnchant.baseType ?? source?.flags?.add2e?.baseItemType ?? "").trim(),
    "system.enchantement.baseWeight": canonicalBaseWeight(rawEnchant),
    "system.enchantement.application": application,
    "system.enchantement.baseStats": baseStats,
    "system.effectTags": cleanLegacyMagicTags(system, currentBuilder.generatedTags),
    "flags.add2e.modifiers": removeBuilderModifiers(source),
    "flags.add2e.magicItemBuilder": {
      ...clone(currentBuilder),
      generatedTags: [],
      generatedModifiers: []
    },
    [`flags.add2e.${MIGRATION_FLAG}`]: MIGRATION_VERSION
  };

  for (const field of OBSOLETE_ENCHANTMENT_FIELDS) {
    addDeletion(update, rawEnchant, `system.enchantement.${field}`, field);
  }
  for (const field of OBSOLETE_POWER_FIELDS) {
    addDeletion(update, system, `system.${field}`, field);
  }
  for (const field of OBSOLETE_MAGIC_SYSTEM_FIELDS) {
    addDeletion(update, system, `system.${field}`, field);
  }
  if (magicItemType(source) === "arme") {
    if (hasOwn(system, "bonus_hit") && (legacy.attack !== null || hasOwn(rawEnchant, "bonusToucher") || hasOwn(rawEnchant, "bonus_toucher"))) {
      update["system.bonus_hit"] = baseStats.bonusToucher;
    }
    if (hasOwn(system, "bonus_dom") && (legacy.damage !== null || hasOwn(rawEnchant, "bonusDegats") || hasOwn(rawEnchant, "bonus_degats"))) {
      update["system.bonus_dom"] = baseStats.bonusDegats;
    }
  }
  return update;
}
async function migrateCanonicalPowerSources() {
  if (!game.user?.isGM) return { scanned: 0, migrated: 0, failed: 0 };
  const activeGM = game.users?.activeGM ?? Array.from(game.users ?? []).find(user => user.active && user.isGM);
  if (activeGM && String(activeGM.id) !== String(game.user.id)) return { scanned: 0, migrated: 0, failed: 0 };
  const documents = [
    ...Array.from(game.items ?? []),
    ...Array.from(game.actors ?? []).flatMap(actor => Array.from(actor.items ?? []))
  ];
  const result = { scanned: documents.length, migrated: 0, failed: 0 };
  for (const item of documents) {
    const source = clone(item?.toObject?.() ?? item?._source ?? {});
    const update = buildCanonicalPowerMigration(source);
    if (!update) continue;
    try {
      await item.update(update, { add2eCanonicalPowerMigration: MIGRATION_VERSION, add2eInternal: true, render: false });
      result.migrated += 1;
    } catch (error) {
      result.failed += 1;
      console.error("[ADD2E][MAGIC_ITEM][POWER_SOURCE_MIGRATION]", { item: item?.name, itemId: item?.id, error });
    }
  }
  console.log("[ADD2E][MAGIC_ITEM][POWER_SOURCE_MIGRATION_DONE]", { version: MIGRATION_VERSION, ...result });
  return result;
}

function renderPowerBackedFields(app, html) {
  const item = app?.document ?? app?.item ?? app?.object ?? null;
  if (item?.documentName !== "Item" || !MAGIC_ITEM_TYPES.has(String(item.type ?? "").toLowerCase())) return;
  queueMicrotask(() => {
    const root = html instanceof HTMLElement
      ? html
      : html?.[0] instanceof HTMLElement
        ? html[0]
        : app?.element?.jquery
          ? app.element[0]
          : app?.element;
    if (!root?.querySelectorAll) return;
    const fields = { bonusToucher: "attack", bonusDegats: "damage", bonusCA: "armor", caFixe: "fixedArmor" };
    for (const [fieldName, key] of Object.entries(fields)) {
      for (const field of root.querySelectorAll(`[name="system.enchantement.${fieldName}"]`)) {
        field.value = String(powerFieldValue(item, key));
        field.disabled = true;
        field.readOnly = true;
        field.setAttribute("aria-readonly", "true");
        field.title = "Valeur fournie par un pouvoir canonique.";
      }
    }
  });
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
  if (ItemsCollection?.registerSheet) ItemsCollection.registerSheet("add2e", Add2eItemSheet, options);
  const DocumentSheetConfig = foundry?.applications?.apps?.DocumentSheetConfig;
  const ItemDocument = CONFIG?.Item?.documentClass ?? foundry?.documents?.Item;
  if (DocumentSheetConfig?.registerSheet && ItemDocument) {
    try { DocumentSheetConfig.registerSheet(ItemDocument, "add2e", Add2eItemSheet, options); }
    catch (error) { console.warn("[ADD2E][SHEETS] Enregistrement de la fiche de classe impossible.", error); }
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
globalThis.add2eMigrateCanonicalPowerSources = migrateCanonicalPowerSources;
globalThis.add2eMigrateMagicItemData = async itemOrUuid => {
  const item = itemOrUuid?.documentName === "Item" ? itemOrUuid : await resolveItem(itemOrUuid);
  if (!item) return false;
  const update = buildCanonicalPowerMigration(clone(item.toObject?.() ?? item._source ?? {}));
  if (!update) return false;
  await item.update(update, { add2eCanonicalPowerMigration: MIGRATION_VERSION, add2eInternal: true });
  return true;
};
globalThis.ADD2E_MAGIC_POWER_SHEET_EDITOR_VERSION = EDITOR_VERSION;
globalThis.ADD2E_MAGIC_ITEM_DATA_MIGRATION_VERSION = MIGRATION_VERSION;
registerHelpers();

Hooks.on("preCreateActor", (actor, data = {}) => {
  const type = String(actor?.type ?? data?.type ?? "").trim().toLowerCase();
  const actorLink = defaultActorTokenLink(actor, data);
  if (actorLink === null) return;
  const prototypeToken = { actorLink };
  if (type === "personnage") prototypeToken.sight = { enabled: true, angle: 270, range: defaultCharacterSightRange() };
  actor.updateSource({ prototypeToken });
});
Hooks.on("renderApplicationV2", renderPowerBackedFields);
Hooks.once("init", () => {
  registerHelpers();
  console.log("ADD2e | Initialisation du système...");
  add2eRegisterClassItemSheet();
});
Hooks.once("ready", () => {
  migrateCanonicalPowerSources().catch(error => console.error("[ADD2E][MAGIC_ITEM][POWER_SOURCE_MIGRATION_READY]", error));
});
