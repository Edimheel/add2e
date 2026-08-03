// ADD2E — Effects Engine / point d’entrée du noyau partagé.
// Compatible Foundry V13/V14/V15.

import {
  ADD2E_MODIFIER_RESOLVER_VERSION,
  canonicalKey,
  isObject,
  sourceStableKey,
  modifierSignature
} from "./00-core-shared.mjs";
import { installModifierResolver } from "./00-modifier-resolver.mjs";
import {
  installAbilityDerivedResolver,
  FORCE_TABLE,
  DEXTERITE_TABLE,
  CONSTITUTION_TABLE,
  INTELLIGENCE_TABLE,
  SAGESSE_TABLE,
  CHARISME_TABLE,
  ADD2E_ABILITY_BOUNDS
} from "./00-ability-derived.mjs";
import { installEnginePrimitives } from "./00-engine-primitives.mjs";
import { installCharacteristicEffectCanonicalization } from "./00-characteristic-effects.mjs";
import { add2eMagicBuilderResolveBaseWeight } from "../add2e/object-magic/enchantment-builder.mjs";

export {
  FORCE_TABLE,
  DEXTERITE_TABLE,
  CONSTITUTION_TABLE,
  INTELLIGENCE_TABLE,
  SAGESSE_TABLE,
  CHARISME_TABLE,
  ADD2E_ABILITY_BOUNDS
};

const ADD2E_MODIFIER_CONTEXT_CONDITIONS_VERSION = "2026-08-03-canonical-magic-item-weight-v12";
const ADD2E_MOVEMENT_METRES_PER_RATE = 3;
const ADD2E_GOLD_PIECES_PER_KILOGRAM = 20;
const ADD2E_GOLD_PIECES_PER_POUND = 10;
const ADD2E_ENCUMBRANCE_SETTINGS_VERSION = "2026-08-02-world-encumbrance-settings-v2";
const ADD2E_ARMOR_MOVEMENT_VERSION = "2026-08-03-canonical-magic-item-weight-v4";

const ADD2E_ARMOR_CATEGORY_MOVEMENT_RATES = Object.freeze({
  legere: 12,
  moyenne: 9,
  lourde: 6
});

const ADD2E_ARMOR_TYPE_MOVEMENT_RATES = Object.freeze({
  rembourree: 12,
  cuir: 12,
  "cuir-cloute": 9,
  ecailles: 9,
  "tunique-metallique": 9,
  mailles: 9,
  brigandine: 9,
  annelee: 9,
  cuirasse: 9,
  peau: 9,
  "torse-blinde": 6,
  bandes: 6,
  feuilletee: 6,
  plaques: 6
});

const ADD2E_MAGIC_ITEM_WEIGHT_TYPES = new Set([
  "arme", "weapon", "armure", "armor", "objet", "object",
  "equipment", "magic", "objet_magique", "objet-magique"
]);

function add2eWorldSetting(key, fallback) {
  try {
    const settings = globalThis.game?.settings;
    if (!settings?.get) return fallback;
    return settings.get("add2e", key);
  } catch (_error) {
    return fallback;
  }
}

function encumbranceEnabled() {
  return add2eWorldSetting("encumbranceEnabled", true) !== false;
}

function currencyEncumbranceEnabled() {
  return add2eWorldSetting("encumbranceCurrencyWeight", false) === true;
}

function actorMoneyQuantity(actor) {
  const money = actor?.flags?.add2e?.monnaie ?? {};
  return ["pp", "po", "pe", "pa", "pc"].reduce((total, key) => {
    const value = Number(money?.[key]);
    return total + (Number.isFinite(value) && value > 0 ? Math.floor(value) : 0);
  }, 0);
}

function disabledEncumbranceResolution(query = {}) {
  const domain = "encumbrance";
  const target = canonicalKey(query.target);
  const baseValue = Number(query.base ?? 0);
  const base = Number.isFinite(baseValue) ? baseValue : 0;
  const total = target === "movement-multiplier"
    ? 1
    : target.startsWith("capacity-")
      ? base
      : 0;
  return {
    domain,
    target,
    base,
    additionsTotal: 0,
    multiplierTotal: 1,
    override: null,
    total,
    applied: [],
    rejected: [],
    stages: {
      afterOverride: total,
      afterAdditions: total,
      afterMultipliers: total,
      afterBounds: total
    },
    disabled: true,
    policy: "world-setting:encumbranceEnabled"
  };
}

function canonicalCurrencyEncumbranceModifier(Engine, actor, query = {}) {
  if (!actor || currencyEncumbranceEnabled()) return null;
  const domain = canonicalKey(query.domain);
  const target = canonicalKey(query.target);
  if (domain !== "encumbrance" || target !== "carried-weight") return null;

  const quantity = actorMoneyQuantity(actor);
  if (!(quantity > 0)) return null;
  const base = Math.max(0, Number(query.base) || 0);
  const excluded = Math.min(base, quantity);
  if (!(excluded > 0)) return null;

  return Engine.createModifier({
    id: `${actor.id}:encumbrance:currency-policy`,
    domain: "encumbrance",
    target: "carried-weight",
    operation: "add",
    value: -excluded,
    priority: 5,
    stacking: { mode: "replace", group: "encumbrance-currency-policy" },
    source: {
      kind: "system-setting",
      id: "encumbranceCurrencyWeight",
      uuid: "",
      name: "Monnaie ignorée pour l’encombrement"
    },
    metadata: {
      label: "Monnaie ignorée pour l’encombrement",
      producer: "encumbrance-currency-policy",
      coinQuantity: quantity,
      excludedWeight: excluded,
      setting: "add2e.encumbranceCurrencyWeight"
    }
  });
}

function armorDocuments(context = {}) {
  const raw = context.equippedArmor ?? context.armor ?? [];
  const values = raw?.contents ?? raw;
  try { return Array.from(values ?? []).filter(Boolean); }
  catch (_error) { return []; }
}

function scalarValues(value) {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(scalarValues);
  if (value instanceof Set) return [...value].flatMap(scalarValues);
  if (isObject(value)) return Object.values(value).flatMap(scalarValues);
  return String(value).split(/[,;|\n]+/g).map(entry => entry.trim()).filter(Boolean);
}

function armorTags(item) {
  const system = item?.system ?? {};
  const flags = item?.flags?.add2e ?? {};
  return new Set([
    ...scalarValues(system.tags),
    ...scalarValues(system.effectTags),
    ...scalarValues(flags.tags),
    ...scalarValues(flags.effectTags)
  ].map(canonicalKey).filter(Boolean));
}

function armorTaggedValue(tags, prefixes = []) {
  for (const prefixValue of prefixes) {
    const prefix = canonicalKey(prefixValue);
    for (const tag of tags) {
      if (tag.startsWith(`${prefix}-`)) return tag.slice(prefix.length + 1);
    }
  }
  return "";
}

function armorNumericField(system, fields = []) {
  for (const field of fields) {
    const value = Number(system?.[field]);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return null;
}

function armorNumericTag(tags, prefixes = []) {
  const raw = armorTaggedValue(tags, prefixes);
  if (!raw) return null;
  const value = Number(raw.replace(/-/g, "."));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function armorTypeKey(item, tags = armorTags(item)) {
  const system = item?.system ?? {};
  return canonicalKey(
    system.type_armure
      ?? system.typeArmor
      ?? system.armorType
      ?? armorTaggedValue(tags, ["type_armure", "armor_type"])
  );
}

function armorCategoryKey(item, tags = armorTags(item)) {
  const system = item?.system ?? {};
  const raw = canonicalKey(
    system.categorie_armure
      ?? system.armorCategory
      ?? system.categorie
      ?? system.category
      ?? armorTaggedValue(tags, ["categorie_armure", "armor_category"])
  );
  const aliases = {
    light: "legere",
    leger: "legere",
    legere: "legere",
    medium: "moyenne",
    moyen: "moyenne",
    moyenne: "moyenne",
    heavy: "lourde",
    lourd: "lourde",
    lourde: "lourde"
  };
  return aliases[raw] ?? raw;
}

function armorIsShield(item) {
  const system = item?.system ?? {};
  const tags = armorTags(item);
  const type = armorTypeKey(item, tags);
  const category = armorCategoryKey(item, tags);
  return system.bouclier === true
    || system.shield === true
    || type === "bouclier"
    || type === "shield"
    || category === "bouclier"
    || category === "shield"
    || tags.has("armure-bouclier")
    || tags.has("armor-shield");
}

function armorIsMagic(item) {
  const system = item?.system ?? {};
  const flags = item?.flags?.add2e ?? {};
  return system.magique === true
    || system.magic === true
    || flags.isMagicItem === true
    || flags.magique === true
    || flags.magic === true;
}

function armorExplicitlyExempt(item) {
  const system = item?.system ?? {};
  const flags = item?.flags?.add2e ?? {};
  return system.ignoreEncumbrance === true
    || system.encumbranceExempt === true
    || flags.ignoreEncumbrance === true
    || flags.encumbranceExempt === true;
}

function armorCanonicalProfile(item) {
  if (!item) return null;
  const system = item?.system ?? {};
  const tags = armorTags(item);
  const shield = armorIsShield(item);
  const type = armorTypeKey(item, tags);
  const category = armorCategoryKey(item, tags);
  const explicitRate = armorNumericField(system, [
    "movement_rate",
    "movementRate",
    "mouvement_armure",
    "mouvementArmure",
    "armorMovementRate"
  ]);
  const taggedRate = armorNumericTag(tags, [
    "movement_rate",
    "mouvement_armure",
    "armor_movement_rate"
  ]);
  const typeRate = ADD2E_ARMOR_TYPE_MOVEMENT_RATES[type] ?? null;
  const categoryRate = ADD2E_ARMOR_CATEGORY_MOVEMENT_RATES[category] ?? null;
  const baseRate = shield ? null : explicitRate ?? taggedRate ?? typeRate ?? categoryRate;
  const explicitMagicRate = armorNumericField(system, [
    "magic_movement_rate",
    "magicMovementRate",
    "mouvement_armure_magique",
    "mouvementArmureMagique"
  ]) ?? armorNumericTag(tags, [
    "magic_movement_rate",
    "mouvement_armure_magique",
    "magic_armor_movement_rate"
  ]);
  const rateSource = explicitRate !== null
    ? "field"
    : taggedRate !== null
      ? "tag"
      : typeRate !== null
        ? "type_armure"
        : categoryRate !== null
          ? "categorie"
          : null;
  return {
    shield,
    magical: armorIsMagic(item),
    type,
    category,
    tags: [...tags],
    baseRate: Number.isFinite(baseRate) ? baseRate : null,
    explicitMagicRate,
    rateSource
  };
}

function armorBaseMovementRate(item) {
  return armorCanonicalProfile(item)?.baseRate ?? null;
}

function armorEffectiveMovementRate(item) {
  const profile = armorCanonicalProfile(item);
  const baseRate = profile?.baseRate;
  if (!Number.isFinite(baseRate)) return null;
  if (!profile.magical) return baseRate;
  if (Number.isFinite(profile.explicitMagicRate)) return profile.explicitMagicRate;
  if (baseRate <= 6) return 9;
  if (baseRate <= 9) return 12;
  return baseRate;
}

function armorMovementProfile(context = {}) {
  const entries = armorDocuments(context).map(item => {
    const canonical = armorCanonicalProfile(item);
    const baseRate = canonical?.baseRate;
    const effectiveRate = armorEffectiveMovementRate(item);
    if (!Number.isFinite(baseRate) || !Number.isFinite(effectiveRate)) return null;
    return {
      item,
      itemId: String(item?.id ?? ""),
      itemUuid: String(item?.uuid ?? ""),
      name: String(item?.name ?? "Armure"),
      magical: canonical.magical,
      shield: canonical.shield,
      type: canonical.type,
      category: canonical.category,
      rateSource: canonical.rateSource,
      baseRate,
      effectiveRate,
      capMetres: effectiveRate * ADD2E_MOVEMENT_METRES_PER_RATE
    };
  }).filter(Boolean);
  if (!entries.length) return null;
  const selected = [...entries].sort((left, right) => left.capMetres - right.capMetres)[0];
  return {
    selected,
    entries,
    capRate: selected.effectiveRate,
    capMetres: selected.capMetres
  };
}

function armorWeightUnit(system = {}, fallback = "") {
  return canonicalKey(
    system.poids_unite
      ?? system.weightUnit
      ?? system.weight_unit
      ?? system.unite_poids
      ?? system["unité_poids"]
      ?? fallback
  );
}

function weightGoldPieces(value, unit, fallbackUnit = "pound") {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const canonicalUnit = canonicalKey(unit || fallbackUnit);
  if (["po", "pp", "gp", "piece-dor", "pieces-dor", "gold-piece", "gold-pieces"].includes(canonicalUnit)) return amount;
  if (["kg", "kilogramme", "kilogrammes", "kilogram", "kilograms"].includes(canonicalUnit)) {
    return amount * ADD2E_GOLD_PIECES_PER_KILOGRAM;
  }
  if (["lb", "lbs", "livre", "livres", "pound", "pounds"].includes(canonicalUnit)) {
    return amount * ADD2E_GOLD_PIECES_PER_POUND;
  }
  return fallbackUnit === "kg"
    ? amount * ADD2E_GOLD_PIECES_PER_KILOGRAM
    : amount * ADD2E_GOLD_PIECES_PER_POUND;
}

function armorBaseWeightGoldPieces(item) {
  const system = item?.system ?? {};
  const type = String(item?.type ?? "").toLowerCase();
  const fallbackUnit = ["arme", "weapon", "armure", "armor"].includes(type) ? "pound" : "kg";
  const explicit = Number(system.poids_encombrement_po ?? system.encumbrance_gp ?? system.encumbranceGoldPieces);
  if (Number.isFinite(explicit) && explicit >= 0) return explicit;

  const raw = Number(system.poids ?? system.weight ?? system.encombrement ?? system.encumbrance);
  if (Number.isFinite(raw) && raw > 0) {
    return weightGoldPieces(raw, armorWeightUnit(system, fallbackUnit), fallbackUnit);
  }

  const resolved = add2eMagicBuilderResolveBaseWeight(item);
  const resolvedExplicit = Number(resolved?.encumbranceGoldPieces);
  if (Number.isFinite(resolvedExplicit) && resolvedExplicit > 0) return resolvedExplicit;
  return weightGoldPieces(resolved?.value, resolved?.unit, fallbackUnit);
}

function armorInventoryEntry(context, item) {
  const entries = context.inventory?.entries;
  if (!Array.isArray(entries)) return null;
  const itemId = String(item?.id ?? "");
  const itemUuid = String(item?.uuid ?? "");
  return entries.find(entry => (
    (itemId && String(entry?.itemId ?? "") === itemId)
    || (itemUuid && String(entry?.itemUuid ?? "") === itemUuid)
  )) ?? null;
}

function armorExplicitlyNotCarried(item) {
  const system = item?.system ?? {};
  const flags = item?.flags?.add2e ?? {};
  const state = [
    system.transporte,
    system.transporté,
    system.carried,
    system.inInventory,
    flags.carried
  ].find(value => typeof value === "boolean");
  return state === false;
}

function carriedMagicItemDocuments(Engine, actor) {
  return Array.from(actor?.items ?? []).filter(item => {
    const type = String(item?.type ?? "").toLowerCase();
    if (!ADD2E_MAGIC_ITEM_WEIGHT_TYPES.has(type) || !armorIsMagic(item)) return false;
    if (Engine.itemEquipped(item)) return true;
    return !armorExplicitlyNotCarried(item);
  });
}

function canonicalMagicItemWeightModifier(Engine, actor, query = {}, context = {}) {
  const domain = canonicalKey(query.domain);
  const target = canonicalKey(query.target);
  if (!actor || domain !== "encumbrance" || target !== "carried-weight") return null;

  const details = [];
  let adjustment = 0;
  for (const item of carriedMagicItemDocuments(Engine, actor)) {
    const entry = armorInventoryEntry(context, item);
    const quantity = Math.max(0, Number(entry?.quantity ?? item?.system?.quantite ?? item?.system?.quantity ?? 1) || 0);
    if (!(quantity > 0)) continue;
    const sourceWeight = Math.max(0, armorBaseWeightGoldPieces(item) * quantity);
    const currentWeight = Math.max(0, Number(entry?.total) || 0);
    const type = String(item?.type ?? "").toLowerCase();
    const armor = ["armure", "armor"].includes(type);
    const shield = armor && armorIsShield(item);
    const desiredWeight = armorExplicitlyExempt(item)
      ? 0
      : armor && !shield
        ? sourceWeight / 2
        : sourceWeight;
    const delta = desiredWeight - currentWeight;
    if (Math.abs(delta) < 0.0001) continue;
    adjustment += delta;
    details.push({
      itemId: item?.id ?? null,
      itemUuid: item?.uuid ?? null,
      name: item?.name ?? "Objet magique",
      type,
      armor,
      shield,
      equipped: Engine.itemEquipped(item),
      quantity,
      sourceWeight,
      currentWeight,
      desiredWeight,
      adjustment: delta
    });
  }
  if (!details.length || Math.abs(adjustment) < 0.0001) return null;

  const base = Math.max(0, Number(query.base) || 0);
  const value = Math.max(-base, adjustment);
  return Engine.createModifier({
    id: `${actor.id}:encumbrance:magic-item-weight`,
    domain: "encumbrance",
    target: "carried-weight",
    operation: "add",
    value,
    priority: 6,
    stacking: { mode: "replace", group: "encumbrance-magic-item-weight" },
    source: {
      kind: "item-rule",
      id: `${actor.id}:magic-item-weight`,
      uuid: actor.uuid ?? "",
      name: "Poids des objets magiques"
    },
    metadata: {
      label: "Poids canonique des objets magiques",
      producer: "canonical-magic-item-weight",
      details,
      version: ADD2E_ARMOR_MOVEMENT_VERSION
    }
  });
}

function canonicalTransformationWeightModifier(Engine, actor, query = {}, context = {}) {
  const domain = canonicalKey(query.domain);
  const target = canonicalKey(query.target);
  if (!actor || domain !== "encumbrance" || target !== "carried-weight") return null;
  const factor = Number(context.transformationFactor ?? context.sizeFactor);
  if (!Number.isFinite(factor) || factor <= 0 || Math.abs(factor - 1) < 0.0001) return null;

  const factorSource = context.transformationContext?.factorSource ?? null;
  const sourceId = factorSource?.effectId ?? `${actor.id}:size-transformation`;
  return Engine.createModifier({
    id: `${actor.id}:encumbrance:transformation-weight`,
    domain: "encumbrance",
    target: "carried-weight",
    operation: "multiply",
    value: factor,
    priority: 40,
    stacking: { mode: "replace", group: "encumbrance-transformation-weight" },
    source: {
      kind: "transformation",
      id: sourceId,
      uuid: "",
      name: context.transformation ?? context.form ?? context.forme ?? "Transformation de taille"
    },
    metadata: {
      label: `Facteur de poids de transformation ×${factor}`,
      producer: "canonical-transformation-weight",
      factor,
      form: context.transformation ?? context.form ?? context.forme ?? null,
      size: context.size ?? context.taille ?? null,
      version: ADD2E_ARMOR_MOVEMENT_VERSION
    }
  });
}

function armorCapAfterEncumbrance(profile, context = {}, base = 0) {
  if (!profile?.capMetres) return null;
  const category = canonicalKey(context.encumbranceCategory ?? "");
  if (category === "surcharge") return 0;
  if (category === "severe") return Math.max(0, Math.min(profile.capMetres, Number(base) || 0));
  const multiplier = Number(context.encumbranceMultiplier);
  const resolvedMultiplier = Number.isFinite(multiplier) ? Math.max(0, multiplier) : 1;
  const rate = profile.capMetres / ADD2E_MOVEMENT_METRES_PER_RATE;
  return Math.max(0, Math.floor((rate * resolvedMultiplier) + 1e-9) * ADD2E_MOVEMENT_METRES_PER_RATE);
}

function canonicalArmorMovementModifier(Engine, actor, query = {}, context = {}) {
  if (!actor || String(actor.type ?? "").toLowerCase() !== "personnage") return null;
  const domain = canonicalKey(query.domain);
  const target = canonicalKey(query.target);
  if (domain !== "movement" || !["ground", "sol", "terrestre"].includes(target)) return null;

  const profile = armorMovementProfile(context);
  if (!profile) return null;
  const base = Math.max(0, Number(query.base) || 0);
  const cap = armorCapAfterEncumbrance(profile, context, base);
  if (!Number.isFinite(cap)) return null;
  const value = Math.min(base, cap);
  if (value >= base - 0.0001) return null;

  return Engine.createModifier({
    id: `${actor.id}:movement:armor-cap`,
    domain: "movement",
    target: "ground",
    operation: "set",
    value,
    priority: 5,
    stacking: { mode: "stack", group: null },
    source: {
      kind: "armor-rule",
      id: profile.selected.itemId,
      uuid: profile.selected.itemUuid,
      name: profile.selected.name
    },
    metadata: {
      label: `Plafond de mouvement — ${profile.selected.name}`,
      producer: "canonical-armor-movement",
      armorType: profile.selected.type,
      armorCategory: profile.selected.category,
      armorRateSource: profile.selected.rateSource,
      armorBaseRate: profile.selected.baseRate,
      armorEffectiveRate: profile.selected.effectiveRate,
      armorCapMetres: profile.capMetres,
      resolvedCapMetres: cap,
      magical: profile.selected.magical,
      encumbranceCategory: context.encumbranceCategory ?? null,
      encumbranceMultiplier: context.encumbranceMultiplier ?? null,
      version: ADD2E_ARMOR_MOVEMENT_VERSION
    }
  });
}

function contextValues(raw) {
  if (raw === undefined || raw === null || raw === "") return [];
  if (raw instanceof Set) return [...raw].flatMap(contextValues);
  if (Array.isArray(raw)) return raw.flatMap(contextValues);
  if (!isObject(raw)) return [raw];

  const direct = [];
  for (const key of [
    "value", "id", "key", "slug", "name", "label", "type", "kind", "mode",
    "category", "categorie", "size", "taille", "form", "forme", "terrain", "environment", "milieu"
  ]) {
    if (raw[key] !== undefined && raw[key] !== null && raw[key] !== "") direct.push(raw[key]);
  }
  for (const key of ["values", "tags", "list", "items", "modes", "statuses", "terrains", "environments"]) {
    if (raw[key] !== undefined && raw[key] !== null) direct.push(raw[key]);
  }
  return direct.length ? direct.flatMap(contextValues) : [];
}

function canonicalValues(raw) {
  return [...new Set(contextValues(raw).map(canonicalKey).filter(Boolean))];
}

function conditionValues(conditions, keys) {
  return canonicalValues(keys.flatMap(key => (
    Object.prototype.hasOwnProperty.call(conditions, key) ? [conditions[key]] : []
  )));
}

function matchesContextCondition(conditions, keys, actual) {
  const expected = conditionValues(conditions, keys);
  if (!expected.length) return true;
  const actualValues = canonicalValues(actual);
  return actualValues.some(value => expected.includes(value));
}

function numericContextCondition(actualRaw, conditionRaw) {
  const actual = Number(actualRaw);
  if (!Number.isFinite(actual)) return { applicable: false, reason: "missing" };
  if (isObject(conditionRaw)) {
    const minimum = Number(conditionRaw.min ?? conditionRaw.minimum);
    const maximum = Number(conditionRaw.max ?? conditionRaw.maximum);
    if (Number.isFinite(minimum) && actual < minimum) return { applicable: false, reason: "min" };
    if (Number.isFinite(maximum) && actual > maximum) return { applicable: false, reason: "max" };
    return { applicable: true, reason: "range" };
  }
  const expected = Number(conditionRaw);
  if (!Number.isFinite(expected)) return { applicable: false, reason: "invalid" };
  return { applicable: actual === expected, reason: actual === expected ? "equal" : "value" };
}

function documentSource(document, fallbackKind) {
  const flags = document?.flags?.add2e ?? {};
  return {
    kind: canonicalKey(flags.sourceType ?? flags.sourceKind ?? fallbackKind) || fallbackKind,
    id: String(document?.id ?? document?._id ?? ""),
    uuid: String(document?.uuid ?? ""),
    name: String(document?.name ?? document?.label ?? fallbackKind)
  };
}

function dynamicMovementValue(modifier, context = {}) {
  const metadata = isObject(modifier?.metadata) ? modifier.metadata : {};
  const dynamic = isObject(metadata.dynamicValue) ? metadata.dynamicValue : null;
  const kind = canonicalKey(dynamic?.kind ?? "");
  if (kind !== "carried-weight-step-penalty") return modifier;

  const carriedWeight = Number(context.carriedWeight ?? context.inventory?.total);
  const threshold = Number(dynamic.threshold);
  const step = Number(dynamic.step);
  const penaltyPerStep = Number(dynamic.penaltyPerStep);
  const rounding = canonicalKey(dynamic.rounding ?? "floor") || "floor";
  if (!Number.isFinite(carriedWeight)
    || !Number.isFinite(threshold)
    || threshold < 0
    || !Number.isFinite(step)
    || step <= 0
    || !Number.isFinite(penaltyPerStep)) {
    return {
      ...modifier,
      value: 0,
      metadata: {
        ...metadata,
        dynamicValue: {
          ...dynamic,
          resolved: false,
          reason: "invalid-or-missing-weight-context"
        }
      }
    };
  }

  const excess = Math.max(0, carriedWeight - threshold);
  const rawSteps = excess / step;
  const steps = rounding === "ceil"
    ? Math.ceil(rawSteps)
    : rounding === "round"
      ? Math.round(rawSteps)
      : Math.floor(rawSteps);
  const value = steps * penaltyPerStep;
  return {
    ...modifier,
    value,
    metadata: {
      ...metadata,
      dynamicValue: {
        ...dynamic,
        resolved: true,
        carriedWeight,
        excess,
        steps,
        value
      }
    }
  };
}

function canonicalEncumbranceCombatModifier(Engine, actor, query = {}, context = {}) {
  if (!encumbranceEnabled()) return null;
  if (!actor || String(actor.type ?? "").toLowerCase() !== "personnage") return null;
  const domain = canonicalKey(query.domain);
  const target = canonicalKey(query.target);
  const isAttack = domain === "attack" && ["toucher", "hit", "attack", "attaque"].includes(target);
  const isArmorClass = domain === "armor-class" && ["total", "all"].includes(target);
  if (!isAttack && !isArmorClass) return null;

  const computeMovement = globalThis.add2eComputeMovement;
  if (typeof computeMovement !== "function") {
    if (globalThis.game?.ready) {
      throw new Error("Le domaine canonique movement/encumbrance n’est pas chargé pour la résolution de combat.");
    }
    return null;
  }

  const movement = computeMovement(actor, {
    token: context.token,
    scene: context.scene,
    environment: context.environment ?? context.milieu,
    transformation: context.transformation ?? context.form ?? context.forme,
    size: context.size ?? context.taille,
    movementMode: context.movementMode ?? "ground",
    consumer: isAttack ? "attack-encumbrance" : "armor-class-encumbrance"
  });
  const value = Number(isAttack ? movement?.attaquePenalite : movement?.classeArmurePenalite) || 0;
  if (!value) return null;

  const label = `Pénalité d’encombrement — ${movement?.label ?? movement?.categorie ?? "charge"}`;
  return Engine.createModifier({
    id: `${actor.id}:encumbrance:${domain}:${target}`,
    domain,
    target: isAttack ? "toucher" : "total",
    operation: "add",
    value,
    priority: 120,
    stacking: { mode: "replace", group: `encumbrance:${domain}:${target}` },
    source: {
      kind: "encumbrance",
      id: `${actor.id}:encumbrance`,
      uuid: actor.uuid ?? "",
      name: movement?.label ?? "Encombrement"
    },
    metadata: {
      label,
      producer: "canonical-encumbrance",
      category: movement?.categorie ?? null,
      carriedWeight: movement?.poidsPo ?? movement?.poids ?? null,
      movement: movement?.actuel ?? null,
      attackPenalty: movement?.attaquePenalite ?? 0,
      armorClassPenalty: movement?.classeArmurePenalite ?? 0
    }
  });
}

function installContextConditionExtensions(Engine) {
  const baseCollect = Engine.collect.bind(Engine);
  const baseEvaluate = Engine.evaluateModifierConditions.bind(Engine);
  const baseItemEquipped = Engine.itemEquipped.bind(Engine);
  const baseResolve = Engine.resolve.bind(Engine);

  Object.defineProperties(Engine, {
    collect: {
      configurable: true,
      writable: true,
      value(actor, context = {}) {
        const collected = baseCollect(actor, context);
        const token = context.token?.document ?? context.token ?? null;
        const scene = context.scene ?? token?.parent ?? null;

        const appendDocument = (document, fallbackKind, sourceContext = {}) => {
          if (!document || document === actor) return;
          const defaults = { source: documentSource(document, fallbackKind) };
          for (const modifier of this.collectDocumentModifiers(document, defaults)) {
            collected.push({
              ...modifier,
              _context: {
                sourceDocument: document,
                sourceItem: null,
                sourceEffect: null,
                sourceToken: sourceContext.sourceToken ?? null,
                sourceScene: sourceContext.sourceScene ?? null
              }
            });
          }
        };

        if (context.ignoreTerrain !== true) appendDocument(scene, "scene", { sourceScene: scene });
        appendDocument(token, "token", { sourceToken: token, sourceScene: scene });

        const seen = new Set();
        return collected.filter(modifier => {
          const key = `${modifier?.id ?? ""}|${sourceStableKey(modifier?.source)}|${modifierSignature(modifier)}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      }
    },

    itemEquipped: {
      configurable: true,
      writable: true,
      value(item) {
        if (baseItemEquipped(item)) return true;
        const system = item?.system ?? {};
        return system.equipe === true
          || system["équipé"] === true
          || system.porte === true
          || system["porté"] === true;
      }
    },

    armorIsShield: {
      configurable: true,
      writable: true,
      value(item) {
        return armorIsShield(item);
      }
    },

    armorCanonicalProfile: {
      configurable: true,
      writable: true,
      value(item) {
        const profile = armorCanonicalProfile(item);
        return profile ? { ...profile, tags: [...profile.tags] } : null;
      }
    },

    armorMovementProfile: {
      configurable: true,
      writable: true,
      value(context = {}) {
        return armorMovementProfile(context);
      }
    },

    evaluateModifierConditions: {
      configurable: true,
      writable: true,
      value(modifier, context = {}) {
        const base = baseEvaluate(modifier, context);
        if (!base?.applicable) return base;

        const conditions = isObject(modifier?.conditions) ? modifier.conditions : {};
        const checks = [
          {
            keys: ["terrain", "terrains"],
            actual: context.ignoreTerrain === true
              ? null
              : context.terrain ?? context.scene?.flags?.add2e?.terrain,
            reason: "condition-terrain"
          },
          {
            keys: ["environment", "environments", "milieu", "milieux"],
            actual: context.environment ?? context.milieu ?? context.scene?.flags?.add2e?.environment ?? context.scene?.flags?.add2e?.milieu,
            reason: "condition-environment"
          },
          {
            keys: ["size", "sizes", "taille", "tailles"],
            actual: context.size ?? context.taille ?? context.actor?.system?.taille ?? context.actor?.system?.size,
            reason: "condition-size"
          },
          {
            keys: ["transformation", "transformations", "form", "forms", "forme", "formes"],
            actual: context.transformation ?? context.form ?? context.forme,
            reason: "condition-transformation"
          },
          {
            keys: ["status", "statuses", "etat", "etats"],
            actual: context.statuses ?? context.status ?? context.etats ?? context.etat,
            reason: "condition-status"
          },
          {
            keys: ["encumbranceCategory", "encumbranceCategories", "categorieEncombrement", "categoriesEncombrement"],
            actual: context.encumbranceCategory ?? context.categorieEncombrement,
            reason: "condition-encumbrance-category"
          },
          {
            keys: ["movementMode", "movementModes", "modeDeplacement", "modesDeplacement"],
            actual: context.movementModes ?? context.movementMode ?? context.modesDeplacement ?? context.modeDeplacement,
            reason: "condition-movement-mode"
          },
          {
            keys: ["movementSourceKind", "movementSourceKinds", "sourceMouvement", "sourcesMouvement"],
            actual: context.movementSource?.selected?.kind ?? context.movementSourceKind,
            reason: "condition-movement-source"
          }
        ];

        for (const check of checks) {
          if (!matchesContextCondition(conditions, check.keys, check.actual)) {
            return { applicable: false, reason: check.reason };
          }
        }

        for (const [keys, actual, reason] of [
          [["carriedWeight", "poidsPorte", "poidsTransporte"], context.carriedWeight ?? context.inventory?.total, "condition-carried-weight"],
          [["naturalMovement", "mouvementNaturel"], context.naturalBase ?? context.movementSource?.value, "condition-natural-movement"]
        ]) {
          const key = keys.find(name => Object.prototype.hasOwnProperty.call(conditions, name));
          if (!key) continue;
          const result = numericContextCondition(actual, conditions[key]);
          if (!result.applicable) return { applicable: false, reason: `${reason}-${result.reason}` };
        }

        return { applicable: true, reason: "applicable" };
      }
    },

    resolve: {
      configurable: true,
      writable: true,
      value(actor, query = {}) {
        const context = {
          ...(query.context ?? {}),
          actor,
          item: query.item ?? query.context?.item,
          targetActor: query.targetActor ?? query.context?.targetActor
        };
        const domain = canonicalKey(query.domain);
        if (["movement", "encumbrance"].includes(domain)) {
          context.terrain = null;
          context.ignoreTerrain = true;
        }
        if (domain === "encumbrance" && !encumbranceEnabled()) {
          return disabledEncumbranceResolution(query);
        }

        const source = [
          ...(Array.isArray(query.modifiers) ? query.modifiers : this.collect(actor, context))
        ];
        const currencyPolicy = canonicalCurrencyEncumbranceModifier(this, actor, query);
        if (currencyPolicy && !source.some(modifier => String(modifier?.id ?? "") === String(currencyPolicy.id))) {
          source.push(currencyPolicy);
        }
        const magicItemWeight = canonicalMagicItemWeightModifier(this, actor, query, context);
        if (magicItemWeight && !source.some(modifier => String(modifier?.id ?? "") === String(magicItemWeight.id))) {
          source.push(magicItemWeight);
        }
        const transformationWeight = canonicalTransformationWeightModifier(this, actor, query, context);
        if (transformationWeight && !source.some(modifier => String(modifier?.id ?? "") === String(transformationWeight.id))) {
          source.push(transformationWeight);
        }
        const armorMovement = canonicalArmorMovementModifier(this, actor, query, context);
        if (armorMovement && !source.some(modifier => String(modifier?.id ?? "") === String(armorMovement.id))) {
          source.push(armorMovement);
        }
        const encumbranceModifier = canonicalEncumbranceCombatModifier(this, actor, query, context);
        if (encumbranceModifier && !source.some(modifier => String(modifier?.id ?? "") === String(encumbranceModifier.id))) {
          source.push(encumbranceModifier);
        }
        const modifiers = source.map(modifier => dynamicMovementValue(modifier, context));
        return baseResolve(actor, { ...query, context, modifiers });
      }
    }
  });

  globalThis.ADD2E_MODIFIER_CONTEXT_CONDITIONS_VERSION = ADD2E_MODIFIER_CONTEXT_CONDITIONS_VERSION;
  globalThis.ADD2E_ENCUMBRANCE_SETTINGS_VERSION = ADD2E_ENCUMBRANCE_SETTINGS_VERSION;
  globalThis.ADD2E_ARMOR_MOVEMENT_VERSION = ADD2E_ARMOR_MOVEMENT_VERSION;
}

export function installEffectsEngineCore(Engine) {
  installModifierResolver(Engine);
  installContextConditionExtensions(Engine);
  installAbilityDerivedResolver(Engine);
  installEnginePrimitives(Engine);
  installCharacteristicEffectCanonicalization(Engine);

  globalThis.ADD2E_EFFECTS = Engine;
  globalThis.ADD2E_MODIFIER_RESOLVER_VERSION = ADD2E_MODIFIER_RESOLVER_VERSION;
}
