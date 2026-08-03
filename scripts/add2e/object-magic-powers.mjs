// scripts/add2e/object-magic-powers.mjs
// ADD2E — Façade publique des pouvoirs et du créateur d'objets magiques.
// Compatible Foundry V13/V14/V15 — ApplicationV2 / DialogV2.

import {
  ADD2E_MAGIC_ITEM_BUILDER_VERSION,
  add2eMagicClone,
  add2eMagicReadNumber
} from "./object-magic/core.mjs";
import {
  add2eBuildVirtualObjectPowerSort as add2eBuildVirtualObjectPowerSortRuntime,
  add2eExecuteObjectMagicPower as add2eExecuteObjectMagicPowerRuntime,
  add2eMagicItemEquippedOrUsable as add2eMagicItemEquippedOrUsableRuntime,
  add2eMagicLooksMagical,
  add2eMagicObjectActivePowerEntries as add2eMagicObjectActivePowerEntriesRuntime,
  add2eMagicObjectChargeInfo,
  add2eMagicObjectPowerArray as add2eMagicObjectPowerArrayRuntime,
  add2eMagicObjectRawPowers as add2eMagicObjectRawPowersRuntime,
  add2eMagicPowerGeneratedId,
  add2eObjectPowerCost,
  add2eObjectPowerCurrentCharges,
  add2eObjectPowerMaxCharges,
  add2eObjectPowerOnUsePath,
  add2eObjectPowerSetCharges
} from "./object-magic/power-runtime.mjs";
import {
  add2eUiBuildObjectMagicSection,
  add2eUiCollectObjectMagicGroups,
  add2eUiCollectObjectMagicPowers,
  add2eUiInjectObjectMagicSection
} from "./object-magic/inventory-ui.mjs";
import {
  add2eMagicBuilderApplyBase,
  add2eMagicBuilderChooseBase,
  add2eMagicBuilderClearBase,
  add2eMagicBuilderDropBase,
  add2eMagicBuilderDropPower,
  add2eMagicBuilderRemovePower,
  installMagicEnchantmentBuilderHooks
} from "./object-magic/enchantment-builder.mjs";
import {
  add2eMagicBuilderCreateMagicItem,
  installMagicItemCreatorHooks
} from "./object-magic/item-creator.mjs";

export * from "./object-magic/core.mjs";
export * from "./object-magic/power-runtime.mjs";
export * from "./object-magic/inventory-ui.mjs";
export * from "./object-magic/enchantment-builder.mjs";
export * from "./object-magic/profiles.mjs";
export * from "./object-magic/catalogue-editor.mjs";
export * from "./object-magic/item-creator.mjs";

const ADD2E_MAGIC_POWER_FIELDS = ["pouvoirs", "powers", "pouvoirsMagiques", "magicalPowers"];
const ADD2E_MAGIC_MODIFIER_DEFINITIONS = Object.freeze({
  attack: Object.freeze({
    key: "attack",
    id: "magic-item-builder:attack:bonus",
    domain: "attack",
    target: "toucher",
    operation: "add",
    marker: "attack",
    field: "bonusToucher",
    name: "Bonus magique au toucher",
    valueLabel: "Bonus au toucher",
    category: "Combat",
    icon: "icons/svg/sword.svg"
  }),
  damage: Object.freeze({
    key: "damage",
    id: "magic-item-builder:damage:bonus",
    domain: "damage",
    target: "degats",
    operation: "add",
    marker: "damage",
    field: "bonusDegats",
    name: "Bonus magique aux dégâts",
    valueLabel: "Bonus aux dégâts",
    category: "Combat",
    icon: "icons/svg/blood.svg"
  }),
  armor: Object.freeze({
    key: "armor",
    id: "magic-item-builder:armor-class:bonus",
    domain: "armor-class",
    target: null,
    operation: "add",
    marker: "armor-class",
    field: "bonusCA",
    name: "Bonus magique d’armure ou de bouclier",
    valueLabel: "Bonus de CA",
    category: "Défense",
    icon: "icons/svg/shield.svg"
  }),
  fixedArmor: Object.freeze({
    key: "fixedArmor",
    id: "magic-item-builder:armor-class:fixed",
    domain: "armor-class",
    target: null,
    operation: "minmax",
    marker: "armor-class-fixed",
    field: "caFixe",
    name: "Classe d’armure magique fixe",
    valueLabel: "CA fixe",
    category: "Défense",
    icon: "icons/svg/shield.svg"
  })
});
const ADD2E_MAGIC_ATTACK_POWER_TYPES = new Set([
  "attack_bonus", "hit_bonus", "combat_bonus", "attack_damage_bonus", "weapon_magic_bonus"
]);
const ADD2E_MAGIC_DAMAGE_POWER_TYPES = new Set([
  "damage_bonus", "combat_bonus", "attack_damage_bonus", "weapon_magic_bonus"
]);
const ADD2E_MAGIC_FIXED_ARMOR_POWER_TYPES = new Set([
  "fixed_armor_class", "armor_class_fixed", "armor_class_base", "fixed_ac", "ac_fixed",
  "classe_armure_fixe", "classe_armure_base", "ca_fixe", "ca_base", "defense_base"
]);
const add2eMagicOriginalSheetPowers = typeof globalThis.add2eMagicBuilderSheetPowers === "function"
  ? globalThis.add2eMagicBuilderSheetPowers
  : null;
let add2eCanonicalMagicHooksInstalled = false;

function add2eMagicBoolean(value) {
  if (value === true || value === 1) return true;
  const normalized = String(value ?? "").trim().toLowerCase();
  return ["true", "1", "on", "yes", "oui", "equipped", "worn", "portee", "porté"].includes(normalized);
}

function add2eMagicText(...values) {
  for (const value of values) {
    if (value === undefined || value === null || typeof value === "object") continue;
    const text = String(value).trim();
    if (text && text !== "[object Object]") return text;
  }
  return "";
}

function add2eMagicNorm(value) {
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

function add2eMagicArray(value) {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value;
  if (value instanceof Set) return [...value];
  if (typeof value === "object") return Object.values(value);
  return [value];
}

function add2eMagicGet(source, path) {
  try { return foundry.utils.getProperty(source, path); }
  catch (_error) { return String(path).split(".").reduce((current, key) => current?.[key], source); }
}

function add2eMagicSet(source, path, value) {
  try { return foundry.utils.setProperty(source, path, value); }
  catch (_error) {
    const parts = String(path).split(".");
    let current = source;
    while (parts.length > 1) {
      const key = parts.shift();
      current[key] ??= {};
      current = current[key];
    }
    current[parts[0]] = value;
    return true;
  }
}

function add2eMagicOwnPath(source, path) {
  try {
    const flat = foundry.utils.flattenObject(source ?? {});
    return Object.prototype.hasOwnProperty.call(flat, path);
  } catch (_error) {
    return add2eMagicGet(source, path) !== undefined;
  }
}

function add2eMagicFirstNumber(...values) {
  for (const value of values) {
    if (value === undefined || value === null || value === "") continue;
    const number = Number(String(value).replace(",", "."));
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function add2eMagicLinkedSpellEffect(power) {
  return (Array.isArray(power?.effects) ? power.effects : [])
    .find(effect => ["linked_spell", "linked-spell", "sort_lie", "sort-lié"].includes(String(effect?.type ?? effect?.kind ?? "").trim().toLowerCase()))
    ?? null;
}

function add2eMagicLinkedSpellDocument(power) {
  const effect = add2eMagicLinkedSpellEffect(power);
  const uuid = add2eMagicText(
    effect?.spellUuid,
    power?.parameters?.spellUuid,
    power?.spellUuid,
    power?.linkedSpell?.spellUuid,
    power?.linkedSpell?.uuid,
    power?.linkedSpell?.sourceUuid
  );
  if (!uuid || typeof globalThis.fromUuidSync !== "function") return null;
  try { return globalThis.fromUuidSync(uuid) ?? null; }
  catch (_error) { return null; }
}

export function add2eMagicObjectPowerDisplayName(power, item = null) {
  const effect = add2eMagicLinkedSpellEffect(power);
  const linkedDocument = add2eMagicLinkedSpellDocument(power);
  return add2eMagicText(
    power?.parameters?.spellName,
    effect?.spellName,
    effect?.name,
    effect?.nom,
    power?.spellName,
    power?.linkedSpell?.spellName,
    power?.linkedSpell?.name,
    linkedDocument?.name,
    power?.name,
    power?.nom,
    power?.label,
    item?.name,
    "Pouvoir magique"
  );
}

function add2eMagicActivationNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? value : null;
  if (typeof value === "string") {
    const match = value.trim().match(/-?\d+(?:[.,]\d+)?/);
    if (!match) return null;
    const number = Number(match[0].replace(",", "."));
    return Number.isFinite(number) && number >= 0 ? number : null;
  }
  if (typeof value === "object") {
    for (const key of ["segments", "segment", "initiativeSegment", "castingTime", "activationTime", "time", "value", "amount", "cost"]) {
      const number = add2eMagicActivationNumber(value[key]);
      if (Number.isFinite(number)) return number;
    }
  }
  return null;
}

export function add2eMagicObjectPowerActivation(power) {
  const effect = add2eMagicLinkedSpellEffect(power);
  const linkedDocument = add2eMagicLinkedSpellDocument(power);
  const linkedSystem = linkedDocument?.system ?? power?.linkedSpell?.system ?? {};
  const candidates = [
    power?.initiativeSegment,
    power?.temps_incantation,
    power?.castingTime,
    power?.casting_time,
    power?.activationTime,
    power?.parameters?.initiativeSegment,
    power?.parameters?.activationTime,
    power?.parameters?.castingTime,
    effect?.initiativeSegment,
    effect?.activationTime,
    power?.activation,
    linkedSystem?.initiativeSegment,
    linkedSystem?.temps_incantation,
    linkedSystem?.castingTime,
    linkedSystem?.casting_time
  ];
  let segment = null;
  for (const candidate of candidates) {
    segment = add2eMagicActivationNumber(candidate);
    if (Number.isFinite(segment)) break;
  }
  const label = Number.isFinite(segment)
    ? `${segment} segment${segment > 1 ? "s" : ""}`
    : add2eMagicText(
        power?.activationLabel,
        power?.activation?.label,
        power?.activation?.text,
        power?.temps_incantation,
        power?.castingTime,
        power?.casting_time,
        effect?.activationLabel,
        linkedSystem?.temps_incantation,
        linkedSystem?.castingTime,
        linkedSystem?.casting_time,
        "Objet magique"
      );
  return { segment: Number.isFinite(segment) ? segment : null, label };
}

function add2eDecorateMagicPower(power, item = null) {
  const decorated = add2eMagicClone(power ?? {});
  const linkedDocument = add2eMagicLinkedSpellDocument(power);
  const activation = add2eMagicObjectPowerActivation(power);
  const displayName = add2eMagicObjectPowerDisplayName(power, item);
  decorated.catalogueLabel ??= add2eMagicText(power?.label, power?.name, power?.nom);
  decorated.name = displayName;
  decorated.nom = displayName;
  decorated.displayName = displayName;
  decorated.activationLabel = activation.label;
  decorated.temps_incantation = activation.label;
  if (activation.segment !== null) decorated.initiativeSegment = activation.segment;
  if (decorated.kind === "catalogue" && !add2eObjectPowerOnUsePath(decorated)) {
    decorated.onUse = "add2e://magic-catalogue";
    decorated.onuse = decorated.onUse;
    decorated.on_use = decorated.onUse;
  }
  if (linkedDocument?.img) decorated.img = linkedDocument.img;
  return decorated;
}

function add2eBuildDisplayVirtualObjectPowerSort(actor, itemSource, power, index) {
  const decorated = add2eDecorateMagicPower(power, itemSource);
  const sort = add2eBuildVirtualObjectPowerSortRuntime(actor, itemSource, decorated, index);
  const activation = add2eMagicObjectPowerActivation(decorated);
  const source = {
    name: decorated.name,
    ...(decorated.img ? { img: decorated.img } : {}),
    "system.temps_incantation": activation.label,
    ...(activation.segment !== null ? { "system.initiativeSegment": activation.segment } : {})
  };
  try { sort?.updateSource?.(source); }
  catch (_error) {}
  return sort;
}

export function add2eMagicItemPowerUsable(item) {
  if (add2eMagicItemEquippedOrUsableRuntime(item)) return true;
  const system = item?.system ?? {};
  return [system.equipee, system.equipped, system.estEquipee, system.worn, system.portee]
    .some(add2eMagicBoolean);
}

export function add2eMagicObjectConfiguredRawPowers(item) {
  const system = item?.system ?? {};
  return system.pouvoirs
    ?? system.powers
    ?? system.pouvoirsMagiques
    ?? system.magicalPowers
    ?? add2eMagicObjectRawPowersRuntime(item)
    ?? [];
}

export function add2eMagicObjectConfiguredPowerArray(item) {
  const raw = add2eMagicObjectConfiguredRawPowers(item);
  if (Array.isArray(raw)) return raw.filter(power => power && typeof power === "object");
  if (raw && typeof raw === "object") return Object.values(raw).filter(power => power && typeof power === "object");
  return add2eMagicObjectPowerArrayRuntime(item);
}

export function add2eMagicObjectConfiguredPowerEntries(item) {
  return add2eMagicObjectConfiguredPowerArray(item)
    .map((power, index) => ({ power: add2eDecorateMagicPower(power, item), index }))
    .filter(entry => add2eObjectPowerOnUsePath(entry.power));
}

function add2eMagicCanonicalEffectKey(value) {
  return add2eMagicNorm(value).replace(/_/g, "-");
}

function add2eMagicPowerMarkers(power) {
  return add2eMagicArray(power?.canonicalizedEffects).map(add2eMagicCanonicalEffectKey).filter(Boolean);
}

function add2eMagicPowerRepresents(power, marker) {
  return add2eMagicPowerMarkers(power).includes(add2eMagicCanonicalEffectKey(marker));
}

function add2eMagicTemplateParameterKeys(value, keys = new Set()) {
  if (Array.isArray(value)) {
    value.forEach(entry => add2eMagicTemplateParameterKeys(entry, keys));
    return keys;
  }
  if (value && typeof value === "object") {
    Object.values(value).forEach(entry => add2eMagicTemplateParameterKeys(entry, keys));
    return keys;
  }
  if (typeof value !== "string") return keys;
  for (const match of value.matchAll(/@([A-Za-z0-9_]+)/g)) keys.add(match[1]);
  return keys;
}

function add2eMagicCombatEffectValues(effect = {}) {
  const type = add2eMagicNorm(effect.type ?? effect.kind ?? effect.category);
  const values = {};
  if (ADD2E_MAGIC_ATTACK_POWER_TYPES.has(type)) {
    const value = add2eMagicFirstNumber(
      effect.attackBonus,
      effect.hitBonus,
      effect.bonusToucher,
      effect.toucher,
      type !== "damage_bonus" ? effect.bonus ?? effect.value : null
    );
    if (Number.isFinite(value) && value !== 0) values.attack = value;
  }
  if (ADD2E_MAGIC_DAMAGE_POWER_TYPES.has(type)) {
    const value = add2eMagicFirstNumber(
      effect.damageBonus,
      effect.bonusDegats,
      effect.degats,
      type === "damage_bonus" ? effect.bonus ?? effect.value : null
    );
    if (Number.isFinite(value) && value !== 0) values.damage = value;
  }
  if (ADD2E_MAGIC_FIXED_ARMOR_POWER_TYPES.has(type)) {
    const value = add2eMagicFirstNumber(
      effect.value,
      effect.amount,
      effect.armorClass,
      effect.armor_class,
      effect.ac,
      effect.ca,
      effect.fixedCA,
      effect.fixedAc,
      effect.base
    );
    if (Number.isFinite(value)) values.fixedArmor = value;
  }
  return values;
}

function add2eMagicCanonicalizePower(power) {
  const next = add2eMagicClone(power ?? {});
  const effects = add2eMagicArray(next.effects).filter(effect => effect && typeof effect === "object");
  const templates = add2eMagicArray(next.effectTemplates).filter(effect => effect && typeof effect === "object");
  const values = { attack: [], damage: [], fixedArmor: [] };
  const markers = new Set(add2eMagicPowerMarkers(next));
  const removedTemplates = [];

  const keepEffects = effects.filter(effect => {
    const extracted = add2eMagicCombatEffectValues(effect);
    const keys = Object.keys(extracted);
    if (!keys.length) return true;
    for (const key of keys) {
      values[key].push(extracted[key]);
      markers.add(ADD2E_MAGIC_MODIFIER_DEFINITIONS[key].marker);
    }
    return false;
  });
  const keepTemplates = templates.filter(effect => {
    const extracted = add2eMagicCombatEffectValues(effect);
    const keys = Object.keys(extracted);
    if (!keys.length) return true;
    removedTemplates.push(effect);
    for (const key of keys) markers.add(ADD2E_MAGIC_MODIFIER_DEFINITIONS[key].marker);
    return false;
  });

  next.effects = keepEffects;
  next.effectTemplates = keepTemplates;
  if (removedTemplates.length && next.parameters && typeof next.parameters === "object" && !Array.isArray(next.parameters)) {
    for (const key of add2eMagicTemplateParameterKeys(removedTemplates)) delete next.parameters[key];
  }
  next.canonicalizedEffects = [...markers];
  return { power: next, values };
}

function add2eMagicCanonicalizePowerStore(system = {}) {
  for (const field of ADD2E_MAGIC_POWER_FIELDS) {
    const raw = system[field];
    if (!Array.isArray(raw) && (!raw || typeof raw !== "object")) continue;
    const values = { attack: [], damage: [], fixedArmor: [] };
    const presentations = { attack: false, damage: false, fixedArmor: false };
    if (Array.isArray(raw)) {
      const powers = raw.map(power => {
        if (!power || typeof power !== "object") return power;
        const result = add2eMagicCanonicalizePower(power);
        for (const key of Object.keys(values)) values[key].push(...result.values[key]);
        for (const key of Object.keys(presentations)) presentations[key] ||= add2eMagicPowerRepresents(result.power, ADD2E_MAGIC_MODIFIER_DEFINITIONS[key].marker);
        return result.power;
      });
      return { field, raw: powers, values, presentations };
    }
    const powers = {};
    for (const [key, power] of Object.entries(raw)) {
      if (!power || typeof power !== "object") {
        powers[key] = power;
        continue;
      }
      const result = add2eMagicCanonicalizePower(power);
      powers[key] = result.power;
      for (const valueKey of Object.keys(values)) values[valueKey].push(...result.values[valueKey]);
      for (const valueKey of Object.keys(presentations)) presentations[valueKey] ||= add2eMagicPowerRepresents(result.power, ADD2E_MAGIC_MODIFIER_DEFINITIONS[valueKey].marker);
    }
    return { field, raw: powers, values, presentations };
  }
  return {
    field: "pouvoirs",
    raw: null,
    values: { attack: [], damage: [], fixedArmor: [] },
    presentations: { attack: false, damage: false, fixedArmor: false }
  };
}

function add2eMagicSinglePowerValue(values, label) {
  const distinct = [...new Set(add2eMagicArray(values).map(Number).filter(Number.isFinite))];
  if (distinct.length > 1) throw new Error(`${label} est défini par plusieurs pouvoirs avec des valeurs différentes.`);
  return distinct.length ? distinct[0] : null;
}

function add2eMagicModifierList(source) {
  const flags = source?.flags ?? source?._source?.flags ?? {};
  return Array.isArray(flags?.add2e?.modifiers) ? flags.add2e.modifiers : [];
}

function add2eMagicFindModifier(source, definition) {
  return add2eMagicModifierList(source).find(modifier => modifier?.id === definition.id)
    ?? add2eMagicModifierList(source).find(modifier => modifier?.domain === definition.domain
      && modifier?.operation === definition.operation
      && modifier?.metadata?.producer === "magic-item-builder"
      && (!definition.target || modifier?.target === definition.target))
    ?? null;
}

function add2eMagicModifierDisplayValue(modifier, definition) {
  if (!modifier) return null;
  if (definition.operation === "minmax") {
    const value = Number(modifier?.value?.max);
    return Number.isFinite(value) ? value : null;
  }
  const value = Number(modifier.value);
  if (!Number.isFinite(value)) return null;
  return definition.key === "armor" ? Math.abs(value) : value;
}

function add2eMagicItemType(source) {
  return String(source?.type ?? "").trim().toLowerCase();
}

function add2eMagicItemApplication(source) {
  const requested = String(source?.system?.enchantement?.application ?? "").trim().toLowerCase();
  if (["source", "porteur"].includes(requested)) return requested;
  return add2eMagicItemType(source) === "arme" ? "source" : "porteur";
}

function add2eMagicBuildModifier(source, definition, value, existing = null) {
  const type = add2eMagicItemType(source);
  const target = definition.domain === "armor-class"
    ? type === "armure" ? "naturel" : "total"
    : definition.target;
  const sourceKind = type === "arme" ? "weapon" : type === "armure" ? "armor" : "equipment";
  const fixed = definition.operation === "minmax";
  const normalizedValue = fixed
    ? { max: Number(value) }
    : definition.key === "armor"
      ? -Math.abs(Number(value))
      : Number(value);
  return {
    ...(existing ? add2eMagicClone(existing) : {}),
    id: definition.id,
    domain: definition.domain,
    target,
    operation: definition.operation,
    value: normalizedValue,
    priority: fixed ? 300 : 100,
    stacking: { mode: "stack", group: null },
    conditions: { equipped: true },
    source: {
      ...(existing?.source ?? {}),
      kind: sourceKind,
      id: String(source?.id ?? source?._id ?? ""),
      uuid: String(source?.uuid ?? ""),
      name: String(source?.name ?? "Objet magique")
    },
    metadata: {
      ...(existing?.metadata ?? {}),
      label: `${source?.name ?? "Objet magique"} — ${definition.valueLabel.toLowerCase()}`,
      producer: "magic-item-builder",
      profile: String(source?.flags?.add2e?.magicItemProfile ?? source?.type ?? "objet"),
      application: add2eMagicItemApplication(source)
    }
  };
}

function add2eMagicBaseWeaponValue(source, key) {
  const base = source?.system?.enchantement?.baseStats ?? {};
  return key === "attack"
    ? add2eMagicFirstNumber(base.bonusToucher, 0) ?? 0
    : add2eMagicFirstNumber(base.bonusDegats, 0) ?? 0;
}

function add2eMagicCleanCombatTags(system = {}, builder = {}) {
  const generated = new Set(add2eMagicArray(builder.generatedTags).map(value => String(value ?? "").trim()).filter(Boolean));
  const isCombatBonus = value => /^(bonus_attaque|bonus_toucher|bonus_degats):[+-]?\d/i.test(String(value ?? "").trim());
  const tags = add2eMagicArray(system.effectTags)
    .map(value => String(value ?? "").trim())
    .filter(value => value && !generated.has(value) && !isCombatBonus(value));
  system.effectTags = tags;
  builder.generatedTags = add2eMagicArray(builder.generatedTags).filter(value => !isCombatBonus(value));
}

function add2eMagicWriteCanonicalMetadata(source, modifierIds) {
  source.flags ??= {};
  source.flags.add2e ??= {};
  const builder = source.flags.add2e.magicItemBuilder && typeof source.flags.add2e.magicItemBuilder === "object"
    ? add2eMagicClone(source.flags.add2e.magicItemBuilder)
    : {};
  const retained = add2eMagicArray(builder.generatedModifiers)
    .map(String)
    .filter(id => ![
      ADD2E_MAGIC_MODIFIER_DEFINITIONS.attack.id,
      ADD2E_MAGIC_MODIFIER_DEFINITIONS.damage.id,
      ADD2E_MAGIC_MODIFIER_DEFINITIONS.fixedArmor.id
    ].includes(id));
  builder.version = ADD2E_MAGIC_ITEM_BUILDER_VERSION;
  builder.generatedModifiers = [...new Set([...retained, ...modifierIds])];
  add2eMagicCleanCombatTags(source.system ??= {}, builder);
  source.flags.add2e.magicItemBuilder = builder;
  source.flags.add2e.magicItemBuilderVersion = ADD2E_MAGIC_ITEM_BUILDER_VERSION;
}

function add2eMagicClearLegacyCombatFields(source) {
  const system = source.system ??= {};
  const enchantment = system.enchantement ??= {};
  enchantment.bonusToucher = 0;
  enchantment.bonusDegats = 0;
  enchantment.caFixe = null;
  if (add2eMagicItemType(source) === "arme") {
    system.bonus_hit = add2eMagicBaseWeaponValue(source, "attack");
    system.bonus_dom = add2eMagicBaseWeaponValue(source, "damage");
  } else {
    system.bonus_toucher = 0;
    system.bonus_degats = 0;
  }
  for (const key of ["ca_fixe", "caFixe", "fixedCA", "fixed_ac", "ac_fixe", "acFixe"]) delete system[key];
}

function add2eMagicResolveCreateValue(source, powerSummary, key) {
  const definition = ADD2E_MAGIC_MODIFIER_DEFINITIONS[key];
  const powerValue = add2eMagicSinglePowerValue(powerSummary.values[key], definition.valueLabel);
  const fieldValue = add2eMagicFirstNumber(source?.system?.enchantement?.[definition.field]);
  if (powerValue !== null && fieldValue !== null && fieldValue !== 0 && fieldValue !== powerValue) {
    throw new Error(`${definition.valueLabel} du champ (${fieldValue}) diffère de celui du pouvoir (${powerValue}). Utilisez une seule valeur.`);
  }
  return powerValue ?? fieldValue ?? null;
}

function add2eMagicNormalizeCreateItem(item) {
  const source = add2eMagicClone(item?.toObject?.() ?? item?._source ?? {});
  if (!["arme", "armure", "objet"].includes(add2eMagicItemType(source))) return;
  if (source?.system?.magique !== true && source?.system?.magic !== true && !source?.flags?.add2e?.magicItemBuilder) return;
  try {
    const powerSummary = add2eMagicCanonicalizePowerStore(source.system ?? {});
    const modifiers = add2eMagicModifierList(source)
      .filter(modifier => ![
        ADD2E_MAGIC_MODIFIER_DEFINITIONS.attack.id,
        ADD2E_MAGIC_MODIFIER_DEFINITIONS.damage.id,
        ADD2E_MAGIC_MODIFIER_DEFINITIONS.fixedArmor.id
      ].includes(modifier?.id));
    const generated = [];
    for (const key of ["attack", "damage", "fixedArmor"]) {
      const definition = ADD2E_MAGIC_MODIFIER_DEFINITIONS[key];
      const value = add2eMagicResolveCreateValue(source, powerSummary, key);
      if (value === null || !Number.isFinite(Number(value)) || (!Number(value) && key !== "fixedArmor")) continue;
      const modifier = add2eMagicBuildModifier(source, definition, value, add2eMagicFindModifier(source, definition));
      modifiers.push(modifier);
      generated.push(definition.id);
    }
    source.flags ??= {};
    source.flags.add2e ??= {};
    source.flags.add2e.modifiers = modifiers;
    if (powerSummary.raw !== null) source.system[powerSummary.field] = powerSummary.raw;
    add2eMagicClearLegacyCombatFields(source);
    add2eMagicWriteCanonicalMetadata(source, generated);
    item.updateSource({ system: source.system, flags: source.flags });
  } catch (error) {
    ui.notifications?.error?.(error.message);
    return false;
  }
}

function add2eMagicChangedPowerField(change) {
  return ADD2E_MAGIC_POWER_FIELDS.find(field => add2eMagicOwnPath(change, `system.${field}`)) ?? null;
}

function add2eMagicNormalizeUpdateItem(item, change, options = {}) {
  if (options?.add2eCanonicalMagicModifiers === true || !["arme", "armure", "objet"].includes(add2eMagicItemType(item))) return;
  const powerField = add2eMagicChangedPowerField(change);
  const relevant = powerField
    || add2eMagicOwnPath(change, "system.enchantement.bonusToucher")
    || add2eMagicOwnPath(change, "system.enchantement.bonusDegats")
    || add2eMagicOwnPath(change, "system.enchantement.caFixe")
    || add2eMagicOwnPath(change, "system.enchantement.application");
  if (!relevant) return;

  const current = add2eMagicClone(item?.toObject?.() ?? item?._source ?? {});
  let expanded;
  try { expanded = foundry.utils.expandObject(add2eMagicClone(change)); }
  catch (_error) { expanded = add2eMagicClone(change); }
  let merged;
  try { merged = foundry.utils.mergeObject(current, expanded, { inplace: false, insertKeys: true, overwrite: true, recursive: true }); }
  catch (_error) { merged = { ...current, ...expanded }; }

  try {
    const oldSummary = add2eMagicCanonicalizePowerStore(current.system ?? {});
    const nextSummary = add2eMagicCanonicalizePowerStore(merged.system ?? {});
    const modifiers = add2eMagicModifierList(merged)
      .filter(modifier => ![
        ADD2E_MAGIC_MODIFIER_DEFINITIONS.attack.id,
        ADD2E_MAGIC_MODIFIER_DEFINITIONS.damage.id,
        ADD2E_MAGIC_MODIFIER_DEFINITIONS.fixedArmor.id
      ].includes(modifier?.id));
    const generated = [];

    for (const key of ["attack", "damage", "fixedArmor"]) {
      const definition = ADD2E_MAGIC_MODIFIER_DEFINITIONS[key];
      const currentModifier = add2eMagicFindModifier(current, definition);
      const currentValue = add2eMagicModifierDisplayValue(currentModifier, definition);
      const explicitField = add2eMagicOwnPath(change, `system.enchantement.${definition.field}`);
      const requestedField = explicitField
        ? add2eMagicFirstNumber(add2eMagicGet(change, `system.enchantement.${definition.field}`)) ?? 0
        : null;
      const powerValue = add2eMagicSinglePowerValue(nextSummary.values[key], definition.valueLabel);
      const oldPresentation = oldSummary.presentations[key] === true;
      const nextPresentation = nextSummary.presentations[key] === true;
      let value = currentValue;

      if (explicitField) {
        const representedValue = powerValue ?? (nextPresentation ? currentValue : null);
        if (nextPresentation && requestedField !== 0 && representedValue !== null && requestedField !== representedValue) {
          throw new Error(`${definition.valueLabel} est représenté par un pouvoir avec la valeur ${representedValue}. Modifiez ou retirez ce pouvoir avant de saisir ${requestedField}.`);
        }
        value = nextPresentation ? representedValue : requestedField;
      } else if (powerField) {
        if (nextPresentation) value = powerValue ?? currentValue;
        else if (oldPresentation) value = null;
      }

      if (value === null || !Number.isFinite(Number(value)) || (!Number(value) && key !== "fixedArmor")) continue;
      const modifier = add2eMagicBuildModifier(merged, definition, value, currentModifier);
      modifiers.push(modifier);
      generated.push(definition.id);
    }

    merged.flags ??= {};
    merged.flags.add2e ??= {};
    merged.flags.add2e.modifiers = modifiers;
    if (powerField && nextSummary.raw !== null) merged.system[nextSummary.field] = nextSummary.raw;
    add2eMagicClearLegacyCombatFields(merged);
    add2eMagicWriteCanonicalMetadata(merged, generated);

    add2eMagicSet(change, "flags.add2e.modifiers", merged.flags.add2e.modifiers);
    add2eMagicSet(change, "flags.add2e.magicItemBuilder", merged.flags.add2e.magicItemBuilder);
    add2eMagicSet(change, "flags.add2e.magicItemBuilderVersion", ADD2E_MAGIC_ITEM_BUILDER_VERSION);
    add2eMagicSet(change, "system.enchantement.bonusToucher", 0);
    add2eMagicSet(change, "system.enchantement.bonusDegats", 0);
    add2eMagicSet(change, "system.enchantement.caFixe", null);
    add2eMagicSet(change, "system.effectTags", merged.system.effectTags ?? []);
    if (add2eMagicItemType(merged) === "arme") {
      add2eMagicSet(change, "system.bonus_hit", merged.system.bonus_hit ?? 0);
      add2eMagicSet(change, "system.bonus_dom", merged.system.bonus_dom ?? 0);
    } else {
      add2eMagicSet(change, "system.bonus_toucher", 0);
      add2eMagicSet(change, "system.bonus_degats", 0);
    }
    if (powerField && nextSummary.raw !== null) add2eMagicSet(change, `system.${nextSummary.field}`, nextSummary.raw);
    options.add2eCanonicalMagicModifiers = true;
  } catch (error) {
    ui.notifications?.error?.(error.message);
    return false;
  }
}

function add2eMagicRenderCanonicalFields(app, html) {
  const item = app?.document ?? app?.item ?? app?.object ?? null;
  if (item?.documentName !== "Item") return;
  queueMicrotask(() => {
    const root = html instanceof HTMLElement
      ? html
      : html?.[0] instanceof HTMLElement
        ? html[0]
        : app?.element?.jquery
          ? app.element[0]
          : app?.element;
    if (!root?.querySelector) return;
    for (const key of ["attack", "damage", "fixedArmor"]) {
      const definition = ADD2E_MAGIC_MODIFIER_DEFINITIONS[key];
      const field = root.querySelector(`[name="system.enchantement.${definition.field}"]`);
      if (!field) continue;
      const modifier = add2eMagicFindModifier(item, definition);
      const value = add2eMagicModifierDisplayValue(modifier, definition);
      const fallback = add2eMagicFirstNumber(item?.system?.enchantement?.[definition.field]) ?? 0;
      const display = value ?? fallback;
      field.value = display === null ? "" : String(display);
      field.setAttribute("value", field.value);
    }
  });
}

function add2eMagicCanonicalSheetPowers(item) {
  const sourceRows = typeof add2eMagicOriginalSheetPowers === "function"
    ? add2eMagicOriginalSheetPowers(item)
    : [];
  const rows = Array.isArray(sourceRows) ? sourceRows.map(row => add2eMagicClone(row)) : [];

  for (const definition of Object.values(ADD2E_MAGIC_MODIFIER_DEFINITIONS)) {
    const modifier = add2eMagicFindModifier(item, definition);
    const value = add2eMagicModifierDisplayValue(modifier, definition);
    if (value === null || !Number.isFinite(Number(value)) || (!Number(value) && definition.key !== "fixedArmor")) continue;
    const storedIndex = rows.findIndex(row => add2eMagicPowerRepresents(row, definition.marker));
    const stored = storedIndex >= 0 ? rows[storedIndex] : null;
    const signed = definition.key === "fixedArmor"
      ? String(value)
      : `${Number(value) >= 0 ? "+" : ""}${Number(value)}`;
    const virtual = {
      ...(stored ?? {}),
      img: stored?.img || item?.img || definition.icon,
      _add2eIndex: stored?._add2eIndex ?? -1,
      _add2eName: stored?._add2eName || definition.name,
      _add2eCost: stored?._add2eCost ?? 0,
      _add2eKindLabel: "Catalogue canonique",
      _add2eCategoryLabel: definition.category,
      _add2eAutomationLabel: "Automatique",
      _add2eActivationLabel: "Équipé",
      _add2eSourceLabel: String(modifier?.source?.name ?? item?.name ?? "Item"),
      _add2eHasParameters: false,
      _add2eHasEffects: false,
      _add2eVirtualModifier: true,
      _add2eVirtualModifierKey: definition.key,
      _add2eHasStoredPower: storedIndex >= 0,
      _add2eCanonicalValueLabel: `${definition.valueLabel} : ${signed}`,
      _add2eCanonicalDescription: definition.key === "fixedArmor"
        ? "Cette classe d’armure fixe est lue directement dans le modificateur canonique de cet Item lorsqu’il est équipé."
        : "Ce bonus est lu directement dans le modificateur canonique de cet Item lorsqu’il est équipé."
    };
    if (storedIndex >= 0) rows[storedIndex] = virtual;
    else rows.push(virtual);
  }
  return rows;
}

function installCanonicalMagicSheetPowerHelper() {
  if (typeof Handlebars === "undefined") return false;
  Handlebars.registerHelper("add2eMagicSheetPowers", item => add2eMagicCanonicalSheetPowers(item));
  globalThis.add2eMagicBuilderSheetPowers = add2eMagicCanonicalSheetPowers;
  return true;
}

function installCanonicalMagicWeaponBonusBridge() {
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine ?? null;
  if (!engine || typeof engine.getMagicWeaponBonus !== "function") return false;
  if (engine.__add2eCanonicalMagicWeaponBonusBridge === true) return true;
  const original = engine.getMagicWeaponBonus.bind(engine);
  engine.getMagicWeaponBonus = function add2eCanonicalMagicWeaponBonus(item, kind = "hit") {
    const definition = kind === "damage"
      ? ADD2E_MAGIC_MODIFIER_DEFINITIONS.damage
      : ADD2E_MAGIC_MODIFIER_DEFINITIONS.attack;
    const modifier = add2eMagicFindModifier(item, definition);
    const canonical = add2eMagicModifierDisplayValue(modifier, definition);
    const base = Number(original(item, kind)) || 0;
    return base + (Number(canonical) || 0);
  };
  engine.__add2eCanonicalMagicWeaponBonusBridge = true;
  return true;
}

async function add2eExecuteObjectMagicPowerGuarded(actor, itemSource, power, index, sheet = null) {
  if (!add2eMagicItemPowerUsable(itemSource)) {
    ui.notifications?.warn?.(`${itemSource?.name ?? "L’objet magique"} doit être équipé pour utiliser ce pouvoir.`);
    return false;
  }
  if ((power?.kind === "catalogue" || add2eObjectPowerOnUsePath(power) === "add2e://magic-catalogue")
    && typeof globalThis.add2eExecuteMagicCataloguePower === "function") {
    return globalThis.add2eExecuteMagicCataloguePower(actor, itemSource, power, index, sheet);
  }
  return add2eExecuteObjectMagicPowerRuntime(actor, itemSource, power, index, sheet);
}

let add2eMagicCreatorButtonHooksInstalled = false;

function add2eMagicCreatorDirectoryRoot(app, html) {
  if (html instanceof HTMLElement) return html;
  if (html?.[0] instanceof HTMLElement) return html[0];
  const element = app?.element;
  return element?.jquery ? element[0] : element;
}

function add2eInstallCanonicalMagicCreatorButton(app, html) {
  const root = add2eMagicCreatorDirectoryRoot(app, html);
  if (!root?.querySelector) return false;
  if (root.querySelector(".add2e-create-magic-item")) return true;
  const header = root.querySelector(".directory-header .header-actions, .directory-header .action-buttons, .directory-header");
  if (!header) return false;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "add2e-create-magic-item";
  button.dataset.add2eUnifiedCreator = "true";
  button.title = "Créer un objet, une arme ou une armure magique";
  button.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i> Créer un objet magique';
  button.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    add2eMagicBuilderCreateMagicItem(app).catch(error => {
      console.error("[ADD2E][OBJET_MAGIQUE][CREATE_ERROR]", error);
      ui.notifications?.error?.(error?.message || "Erreur pendant la création de l’objet magique.");
    });
  });
  header.appendChild(button);
  return true;
}

function installCanonicalMagicCreatorButtonHooks() {
  if (add2eMagicCreatorButtonHooksInstalled) return;
  add2eMagicCreatorButtonHooksInstalled = true;
  Hooks.on("renderItemDirectory", add2eInstallCanonicalMagicCreatorButton);
  Hooks.on("renderSidebarTab", (app, html) => {
    const id = String(app?.options?.id ?? app?.id ?? app?.constructor?.name ?? "").toLowerCase();
    if (id.includes("item")) add2eInstallCanonicalMagicCreatorButton(app, html);
  });
  Hooks.once("ready", () => {
    queueMicrotask(() => add2eInstallCanonicalMagicCreatorButton(ui?.items, ui?.items?.element));
  });
}

function installCanonicalMagicModifierHooks() {
  if (add2eCanonicalMagicHooksInstalled) return;
  add2eCanonicalMagicHooksInstalled = true;
  Hooks.on("preCreateItem", add2eMagicNormalizeCreateItem);
  Hooks.on("preUpdateItem", add2eMagicNormalizeUpdateItem);
  Hooks.on("renderApplicationV2", add2eMagicRenderCanonicalFields);
  Hooks.on("renderItemSheet", add2eMagicRenderCanonicalFields);
  Hooks.once("ready", installCanonicalMagicWeaponBonusBridge);
}

Object.assign(globalThis, {
  add2eObjectPowerOnUsePath,
  add2eObjectPowerCost,
  add2eObjectPowerMaxCharges,
  add2eObjectPowerCurrentCharges,
  add2eObjectPowerSetCharges,
  add2eBuildVirtualObjectPowerSort: add2eBuildDisplayVirtualObjectPowerSort,
  add2eExecuteObjectMagicPower: add2eExecuteObjectMagicPowerGuarded,
  add2eMagicItemEquippedOrUsable: add2eMagicItemPowerUsable,
  add2eMagicObjectRawPowers: add2eMagicObjectConfiguredRawPowers,
  add2eMagicObjectPowerArray: add2eMagicObjectConfiguredPowerArray,
  add2eMagicObjectActivePowerEntries: add2eMagicObjectConfiguredPowerEntries,
  add2eMagicObjectRuntimePowerEntries: add2eMagicObjectActivePowerEntriesRuntime,
  add2eMagicReadNumber,
  add2eMagicObjectChargeInfo,
  add2eMagicLooksMagical,
  add2eMagicPowerGeneratedId,
  add2eMagicObjectPowerDisplayName,
  add2eMagicObjectPowerActivation,
  add2eMagicBuilderSheetPowers: add2eMagicCanonicalSheetPowers,
  add2eUiCollectObjectMagicGroups,
  add2eUiCollectObjectMagicPowers,
  add2eUiBuildObjectMagicSection,
  add2eUiInjectObjectMagicSection,
  ADD2E_MAGIC_ITEM_BUILDER_VERSION,
  add2eMagicBuilderChooseBase,
  add2eMagicBuilderDropBase,
  add2eMagicBuilderClearBase,
  add2eMagicBuilderDropPower,
  add2eMagicBuilderRemovePower,
  add2eMagicBuilderApplyBase,
  add2eCreateMagicItem: add2eMagicBuilderCreateMagicItem
});

installCanonicalMagicSheetPowerHelper();
Hooks.once("init", installCanonicalMagicSheetPowerHelper);
installCanonicalMagicCreatorButtonHooks();
installMagicEnchantmentBuilderHooks();
installMagicItemCreatorHooks();
installCanonicalMagicModifierHooks();
installCanonicalMagicWeaponBonusBridge();
