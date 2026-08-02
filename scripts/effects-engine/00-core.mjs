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

export {
  FORCE_TABLE,
  DEXTERITE_TABLE,
  CONSTITUTION_TABLE,
  INTELLIGENCE_TABLE,
  SAGESSE_TABLE,
  CHARISME_TABLE,
  ADD2E_ABILITY_BOUNDS
};

const ADD2E_MODIFIER_CONTEXT_CONDITIONS_VERSION = "2026-08-02-integrated-movement-encumbrance-v10";
const ADD2E_MOVEMENT_METRE_PER_RATE = 3;
const ADD2E_GOLD_PIECES_PER_KILOGRAM = 20;
const ADD2E_GOLD_PIECES_PER_POUND = 10;
const ADD2E_ENCUMBRANCE_SETTINGS_VERSION = "2026-08-02-world-encumbrance-settings-v2";
const ADD2E_ARMOR_MOVEMENT_VERSION = "2026-08-02-canonical-armor-movement-v2";

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

function armorIsShield(item) {
  const system = item?.system ?? {};
  const identity = [
    system.type_armure,
    system.typeArmor,
    system.categorie,
    system.category,
    system.structure,
    system.nom,
    item?.name
  ].map(canonicalKey).filter(Boolean);
  return system.bouclier === true
    || system.shield === true
    || identity.some(value => value === "bouclier" || value.includes("bouclier"));
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

function armorIdentity(item) {
  const system = item?.system ?? {};
  return [
    system.type_armure,
    system.typeArmor,
    system.structure,
    system.categorie,
    system.category,
    system.properties,
    system.nom,
    system.enchantement?.baseName,
    item?.name
  ].map(canonicalKey).filter(Boolean).join(" ");
}

function armorBaseMovementRate(item) {
  if (!item || armorIsShield(item)) return null;
  const identity = armorIdentity(item);
  if (!identity) return null;

  if (identity.includes("maille-elfique") || identity.includes("cotte-de-mailles-elfique")) return 12;
  if (identity.includes("cuir-cloute") || identity.includes("cuir-cloutee")) return 9;
  if (identity.includes("plate-feuilletee") || identity.includes("plates-feuilletees")) return 6;
  if (identity.includes("armure-de-plaques") || identity.includes("armure-de-plates")) return 6;
  if (identity.includes("lorica") || identity.includes("plate") || identity.includes("plaques")) return 6;
  if (identity.includes("harnois") || identity.includes("hoqueton") || identity.includes("broigne")) return 9;
  if (identity.includes("maille") || identity.includes("cotte-de-mailles")) return 9;
  if (identity.includes("cuir")) return 12;
  return null;
}

function armorEffectiveMovementRate(item) {
  const baseRate = armorBaseMovementRate(item);
  if (!Number.isFinite(baseRate)) return null;
  if (!armorIsMagic(item)) return baseRate;
  if (baseRate <= 6) return 9;
  if (baseRate <= 9) return 12;
  return baseRate;
}

function armorMovementProfile(context = {}) {
  const entries = armorDocuments(context).map(item => {
    const baseRate = armorBaseMovementRate(item);
    const effectiveRate = armorEffectiveMovementRate(item);
    if (!Number.isFinite(baseRate) || !Number.isFinite(effectiveRate)) return null;
    return {
      item,
      itemId: String(item?.id ?? ""),
      itemUuid: String(item?.uuid ?? ""),
      name: String(item?.name ?? "Armure"),
      magical: armorIsMagic(item),
      baseRate,
      effectiveRate,
      capMetres: effectiveRate * ADD2E_MOVEMENT_METRE_PER_RATE
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

function armorWeightUnit(system = {}) {
  return canonicalKey(
    system.poids_unite
      ?? system.weightUnit
      ?? system.weight_unit
      ?? system.unite_poids
      ?? system["unité_poids"]
      ?? ""
  );
}

function armorBaseWeightGoldPieces(item) {
  const resolved = globalThis.add2eMagicBuilderResolveBaseWeight?.(item) ?? null;
  const resolvedGp = Number(resolved?.encumbranceGoldPieces);
  if (Number.isFinite(resolvedGp) && resolvedGp > 0) return resolvedGp;
  const resolvedValue = Number(resolved?.value);
  if (Number.isFinite(resolvedValue) && resolvedValue > 0) {
    const resolvedUnit = canonicalKey(resolved?.unit);
    if (["po", "pp", "gp", "piece-dor", "pieces-dor", "gold-piece", "gold-pieces"].includes(resolvedUnit)) return resolvedValue;
    if (["kg", "kilogramme", "kilogrammes", "kilogram", "kilograms"].includes(resolvedUnit)) {
      return resolvedValue * ADD2E_GOLD_PIECES_PER_KILOGRAM;
    }
    return resolvedValue * ADD2E_GOLD_PIECES_PER_POUND;
  }

  const system = item?.system ?? {};
  const explicit = Number(system.poids_encombrement_po ?? system.encumbrance_gp ?? system.encumbranceGoldPieces);
  if (Number.isFinite(explicit) && explicit >= 0) return explicit;

  const raw = Number(system.poids ?? system.weight ?? system.encombrement ?? system.encumbrance);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  const unit = armorWeightUnit(system);
  if (["po", "pp", "gp", "piece-dor", "pieces-dor", "gold-piece", "gold-pieces"].includes(unit)) return raw;
  if (["kg", "kilogramme", "kilogrammes", "kilogram", "kilograms"].includes(unit)) {
    return raw * ADD2E_GOLD_PIECES_PER_KILOGRAM;
  }
  if (["lb", "lbs", "livre", "livres", "pound", "pounds"].includes(unit)) {
    return raw * ADD2E_GOLD_PIECES_PER_POUND;
  }
  return raw * ADD2E_GOLD_PIECES_PER_POUND;
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

function carriedMagicArmorDocuments(Engine, actor) {
  return Array.from(actor?.items ?? []).filter(item => {
    const type = String(item?.type ?? "").toLowerCase();
    if (!["armure", "armor"].includes(type) || !armorIsMagic(item)) return false;
    if (Engine.itemEquipped(item)) return true;
    return !armorExplicitlyNotCarried(item);
  });
}

function canonicalMagicArmorWeightModifier(Engine, actor, query = {}, context = {}) {
  const domain = canonicalKey(query.domain);
  const target = canonicalKey(query.target);
  if (!actor || domain !== "encumbrance" || target !== "carried-weight") return null;

  const details = [];
  let adjustment = 0;
  for (const item of carriedMagicArmorDocuments(Engine, actor)) {
    const entry = armorInventoryEntry(context, item);
    const quantity = Math.max(1, Number(entry?.quantity ?? item?.system?.quantite ?? item?.system?.quantity ?? 1) || 1);
    const sourceWeight = Math.max(0, armorBaseWeightGoldPieces(item) * quantity);
    const currentWeight = Math.max(0, Number(entry?.total) || 0);
    const shield = armorIsShield(item);
    const desiredWeight = armorExplicitlyExempt(item)
      ? 0
      : shield
        ? sourceWeight
        : sourceWeight / 2;
    const delta = desiredWeight - currentWeight;
    if (Math.abs(delta) < 0.0001) continue;
    adjustment += delta;
    details.push({
      itemId: item?.id ?? null,
      itemUuid: item?.uuid ?? null,
      name: item?.name ?? "Armure magique",
      shield,
      equipped: Engine.itemEquipped(item),
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
    id: `${actor.id}:encumbrance:magic-armor-weight`,
    domain: "encumbrance",
    target: "carried-weight",
    operation: "add",
    value,
    priority: 6,
    stacking: { mode: "replace", group: "encumbrance-magic-armor-weight" },
    source: {
      kind: "armor-rule",
      id: `${actor.id}:magic-armor-weight`,
      uuid: actor.uuid ?? "",
      name: "Poids des armures magiques"
    },
    metadata: {
      label: "Poids canonique des armures magiques",
      producer: "canonical-magic-armor-weight",
      details,
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
  const rate = profile.capMetres / ADD2E_MOVEMENT_METRE_PER_RATE;
  return Math.max(0, Math.floor((rate * resolvedMultiplier) + 1e-9) * ADD2E_MOVEMENT_METRE_PER_RATE);
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

function actorMovementReferenceValue(actor, context = {}, base = 0) {
  const reference = Number(actor?.system?.vitesse_deplacement);
  if (!Number.isFinite(reference) || reference <= 0) return null;

  const armorProfile = armorMovementProfile(context);
  const referenceBase = Number.isFinite(armorProfile?.capMetres)
    ? Math.min(reference, armorProfile.capMetres)
    : reference;
  const category = canonicalKey(context.encumbranceCategory ?? "");
  if (category === "surcharge") return 0;
  if (category === "severe") return Math.max(0, Math.min(referenceBase, Number(base) || 0));

  const multiplier = Number(context.encumbranceMultiplier);
  const resolvedMultiplier = Number.isFinite(multiplier) ? Math.max(0, multiplier) : 1;
  const movementRate = referenceBase / ADD2E_MOVEMENT_METRE_PER_RATE;
  return Math.max(0, Math.floor((movementRate * resolvedMultiplier) + 1e-9) * ADD2E_MOVEMENT_METRE_PER_RATE);
}

function canonicalActorMovementReferenceModifier(Engine, actor, query = {}, context = {}) {
  if (!actor || String(actor.type ?? "").toLowerCase() !== "personnage") return null;
  const domain = canonicalKey(query.domain);
  const target = canonicalKey(query.target);
  if (domain !== "movement" || !["ground", "sol", "terrestre"].includes(target)) return null;

  const value = actorMovementReferenceValue(actor, context, query.base);
  if (!Number.isFinite(value)) return null;
  const natural = Number(context.movementSource?.value ?? context.naturalBase);
  if (Number.isFinite(natural) && natural > 0 && Math.abs(value - Number(query.base ?? 0)) < 0.0001) return null;

  const armorProfile = armorMovementProfile(context);
  return Engine.createModifier({
    id: `${actor.id}:movement:actor-reference`,
    domain: "movement",
    target: "ground",
    operation: "set",
    value,
    priority: 10,
    stacking: { mode: "stack", group: null },
    source: {
      kind: "actor-reference",
      id: actor.id,
      uuid: actor.uuid ?? "",
      name: actor.name ?? "Personnage"
    },
    metadata: {
      label: "Mouvement de référence de l’acteur",
      producer: "actor-movement-reference",
      reference: Number(actor.system?.vitesse_deplacement),
      naturalBase: Number.isFinite(natural) ? natural : null,
      armorCapMetres: armorProfile?.capMetres ?? null,
      armorName: armorProfile?.selected?.name ?? null,
      encumbranceCategory: context.encumbranceCategory ?? null,
      encumbranceMultiplier: context.encumbranceMultiplier ?? null
    }
  });
}

function canonicalEncumbranceCombatModifier(Engine, actor, query = {}, context = {}) {
  if (!encumbranceEnabled()) return null;
  if (!actor || String(actor.type ?? "").toLowerCase() !== "personnage") return null;
  const domain = canonicalKey(query.domain);
  const target = canonicalKey(query.target);
  const isAttack = domain === "attack" && ["toucher", "hit", "attack", "attaque"].includes(target);
  const isArmorClass = domain === "armor-class" && ["total", "all"].includes(target);
  if (!isAttack && !isArmorClass) return null;

  const compute = globalThis.add2eComputeMovement;
  if (typeof compute !== "function") {
    if (globalThis.game?.ready) {
      throw new Error("Le domaine canonique movement/encumbrance n’est pas chargé pour la résolution de combat.");
    }
    return null;
  }

  const movement = compute(actor, {
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
        const magicArmorWeight = canonicalMagicArmorWeightModifier(this, actor, query, context);
        if (magicArmorWeight && !source.some(modifier => String(modifier?.id ?? "") === String(magicArmorWeight.id))) {
          source.push(magicArmorWeight);
        }
        const armorMovement = canonicalArmorMovementModifier(this, actor, query, context);
        if (armorMovement && !source.some(modifier => String(modifier?.id ?? "") === String(armorMovement.id))) {
          source.push(armorMovement);
        }
        const movementReference = canonicalActorMovementReferenceModifier(this, actor, query, context);
        if (movementReference && !source.some(modifier => String(modifier?.id ?? "") === String(movementReference.id))) {
          source.push(movementReference);
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

// ---------------------------------------------------------------------------
// Domaine canonique XP, mouvement et encombrement.
// Cette section était auparavant isolée dans 17a-movement-xp-domain.mjs.
// ---------------------------------------------------------------------------

export const ADD2E_MOVE_XP_VERSION = "2026-08-02-effects-engine-integrated-v18";
export const ADD2E_MOVE_XP_TAG = "[ADD2E][MOVE_XP]";
export const ADD2E_MOVE_XP_INTERNAL = "add2eMoveXpInternal";
export const ADD2E_MOVE_XP_RECALC_DELAY_MS = 140;

const MISSING_MOVEMENT_BASE_WARNED = new Set();
const GOLD_PIECES_PER_KILOGRAM = 20;
const GOLD_PIECES_PER_POUND = 10;
const ADND_MOVEMENT_INCH_METRES = 3;
const WORN_CLOTHING_POUNDS = 5;
const MOVEMENT_TARGETS = Object.freeze([
  "ground", "flight", "ascent", "descent", "vertical", "underwater", "swim"
]);

const ENCUMBRANCE_TABLE_POUNDS = Object.freeze({
  2: { unencumbered: 1, light: 2, moderate: 3, heavy: 4, severe: 6 },
  3: { unencumbered: 5, light: 6, moderate: 7, heavy: 9, severe: 10 },
  4: { unencumbered: 10, light: 13, moderate: 16, heavy: 19, severe: 25 },
  5: { unencumbered: 10, light: 13, moderate: 16, heavy: 19, severe: 25 },
  6: { unencumbered: 20, light: 29, moderate: 38, heavy: 46, severe: 55 },
  7: { unencumbered: 20, light: 29, moderate: 38, heavy: 46, severe: 55 },
  8: { unencumbered: 35, light: 50, moderate: 65, heavy: 80, severe: 90 },
  9: { unencumbered: 35, light: 50, moderate: 65, heavy: 80, severe: 90 },
  10: { unencumbered: 40, light: 58, moderate: 76, heavy: 96, severe: 110 },
  11: { unencumbered: 40, light: 58, moderate: 76, heavy: 96, severe: 110 },
  12: { unencumbered: 45, light: 69, moderate: 93, heavy: 117, severe: 140 },
  13: { unencumbered: 45, light: 69, moderate: 93, heavy: 117, severe: 140 },
  14: { unencumbered: 55, light: 85, moderate: 115, heavy: 145, severe: 170 },
  15: { unencumbered: 55, light: 85, moderate: 115, heavy: 145, severe: 170 },
  16: { unencumbered: 70, light: 100, moderate: 130, heavy: 160, severe: 195 },
  17: { unencumbered: 85, light: 121, moderate: 157, heavy: 193, severe: 220 },
  18: { unencumbered: 110, light: 149, moderate: 188, heavy: 227, severe: 255 },
  "18/01-50": { unencumbered: 135, light: 174, moderate: 213, heavy: 252, severe: 280 },
  "18/51-75": { unencumbered: 160, light: 199, moderate: 238, heavy: 277, severe: 305 },
  "18/76-90": { unencumbered: 185, light: 224, moderate: 263, heavy: 302, severe: 330 },
  "18/91-99": { unencumbered: 235, light: 274, moderate: 313, heavy: 352, severe: 380 },
  "18/00": { unencumbered: 335, light: 374, moderate: 413, heavy: 452, severe: 480 }
});

const SUPERNATURAL_STRENGTH_CAPACITY_POUNDS = Object.freeze({
  19: { unencumbered: 485, severe: 640 },
  20: { unencumbered: 535, severe: 700 },
  21: { unencumbered: 635, severe: 810 },
  22: { unencumbered: 785, severe: 970 },
  23: { unencumbered: 935, severe: 1130 },
  24: { unencumbered: 1235, severe: 1440 },
  25: { unencumbered: 1535, severe: 1750 }
});

export function log(label, data = {}) {
  console.log(`${ADD2E_MOVE_XP_TAG}${label}`, data);
}

export function num(value, fallback = 0) {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value && typeof value === "object") {
    for (const key of ["value", "valeur", "total", "current", "actuel", "base", "max", "vitesse", "movement"]) {
      if (value[key] !== undefined && value[key] !== null && typeof value[key] !== "object") return num(value[key], fallback);
    }
    return fallback;
  }

  let raw = String(value ?? "").trim().replace(/\u00a0/g, " ").replace(/\s+/g, "");
  if (!raw) return fallback;
  raw = raw.replace(/[^0-9.,+\-]/g, "");
  if (!raw) return fallback;
  if (raw.includes(",") && raw.includes(".")) {
    if (raw.lastIndexOf(",") > raw.lastIndexOf(".")) raw = raw.replace(/\./g, "").replace(",", ".");
    else raw = raw.replace(/,/g, "");
  } else if (raw.includes(",")) raw = raw.replace(",", ".");
  else if (/^[+\-]?\d{1,3}(?:\.\d{3})+$/.test(raw)) raw = raw.replace(/\./g, "");
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function norm(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function firstPositive(...values) {
  for (const value of values) {
    const out = num(value, NaN);
    if (Number.isFinite(out) && out > 0) return out;
  }
  return 0;
}

function round2(value) {
  return Math.round(Math.max(0, num(value, 0)) * 100) / 100;
}

function clone(value) {
  if (value === undefined || value === null) return value;
  try {
    return foundry?.utils?.deepClone ? foundry.utils.deepClone(value) : JSON.parse(JSON.stringify(value));
  } catch (_error) {
    return value;
  }
}

function records(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value && typeof value === "object") return Object.values(value).filter(Boolean);
  return [];
}

function scalars(value) {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(scalars);
  if (value instanceof Set) return [...value].flatMap(scalars);
  if (typeof value === "object") {
    for (const key of ["values", "items", "list", "tags", "effectTags", "modes", "value"]) {
      if (value[key] !== undefined) return scalars(value[key]);
    }
    return [];
  }
  return String(value).split(/[,;|\n]+/g).map(entry => entry.trim()).filter(Boolean);
}

export function sameValue(left, right) {
  if (left === right) return true;
  const leftNumber = num(left, NaN);
  const rightNumber = num(right, NaN);
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) return leftNumber === rightNumber;
  if (foundry?.utils?.deepEqual) return foundry.utils.deepEqual(left, right);
  return JSON.stringify(left) === JSON.stringify(right);
}

export function getPath(document, path) {
  return foundry?.utils?.getProperty ? foundry.utils.getProperty(document, path) : undefined;
}

export function changedUpdatePayload(actor, updates = {}) {
  return Object.fromEntries(Object.entries(updates).filter(([path, value]) => !sameValue(getPath(actor, path), value)));
}

export function changeValue(changes, path) {
  return foundry.utils.hasProperty(changes, path) ? foundry.utils.getProperty(changes, path) : undefined;
}

export function changedPath(actor, changes, path) {
  return foundry.utils.hasProperty(changes, path) && !sameValue(changeValue(changes, path), getPath(actor, path));
}

export function classItems(actor) {
  return Array.from(actor?.items ?? []).filter(item => String(item?.type ?? "").toLowerCase() === "classe");
}

function classItem(actor) {
  const classes = classItems(actor);
  return classes.length === 1 ? classes[0] : null;
}

function raceItem(actor) {
  return Array.from(actor?.items ?? []).find(item => String(item?.type ?? "").toLowerCase() === "race") ?? null;
}

export function isMulticlassActor(actor) {
  return actor?.type === "personnage" && classItems(actor).length > 1;
}

function parseXpRange(raw) {
  const text = String(raw ?? "").trim();
  const values = text.match(/[0-9][0-9.\s]*/g)?.map(value => num(value, NaN)).filter(Number.isFinite) ?? [];
  return { min: values[0] ?? 0, max: values[1] ?? null, raw: text };
}

function xpRows(actor) {
  const cls = classItem(actor)?.system ?? actor?.system?.details_classe ?? {};
  const progression = Array.isArray(cls.progression) ? cls.progression : [];
  return progression.map((row, index) => {
    const range = parseXpRange(row?.xpRange ?? row?.xp_range ?? row?.experience ?? row?.niveau_xp ?? row?.xp ?? "");
    return {
      ...row,
      niveau: num(row?.niveau ?? row?.level ?? index + 1, index + 1),
      xpMin: range.min,
      xpMax: range.max,
      xpLabel: range.raw
    };
  }).filter(row => row.niveau > 0).sort((left, right) => left.niveau - right.niveau);
}

export function minXpForLevel(actor, level = null) {
  if (isMulticlassActor(actor)) return 0;
  const value = Math.max(1, num(level ?? actor?.system?.niveau, 1));
  const row = xpRows(actor).find(entry => Number(entry.niveau) === value);
  return Math.max(0, Number(row?.xpMin ?? 0) || 0);
}

function levelForXp(actor, xpValue) {
  if (isMulticlassActor(actor)) return null;
  const xp = Math.max(0, Math.floor(num(xpValue, 0)));
  const rows = xpRows(actor);
  if (!rows.length) return Math.max(1, num(actor?.system?.niveau, 1));
  let current = rows[0];
  for (const row of rows) if (xp >= row.xpMin) current = row;
  return Number(current.niveau) || 1;
}

function xpMeta(actor, levelValue, xpValue) {
  const level = Math.max(1, num(levelValue, 1));
  const xp = Math.max(0, Math.floor(num(xpValue, 0)));
  const rows = xpRows(actor);
  const currentMin = minXpForLevel(actor, level);
  const next = rows.find(row => Number(row.niveau) > level) ?? null;
  const nextXp = next ? Number(next.xpMin) || 0 : 0;
  const span = nextXp > currentMin ? nextXp - currentMin : 1;
  return {
    xp,
    level,
    requiredMin: currentMin,
    suggestedLevel: levelForXp(actor, xp),
    nextLevel: next?.niveau ?? null,
    nextXp,
    xpToNext: next ? Math.max(0, nextXp - xp) : 0,
    percent: next ? Math.max(0, Math.min(100, Math.floor(((xp - currentMin) / span) * 100))) : 100,
    progressionLabel: next ? `${xp.toLocaleString()} / ${nextXp.toLocaleString()} XP` : `${xp.toLocaleString()} XP — niveau maximum de la table`,
    hasProgression: rows.length > 0
  };
}

export function computeXp(actor) {
  if (isMulticlassActor(actor)) {
    return {
      xp: null, level: null, requiredMin: null, suggestedLevel: null, nextLevel: null,
      nextXp: null, xpToNext: null, percent: null,
      progressionLabel: "Progression gérée par les Items classe",
      hasProgression: false,
      multiclass: true
    };
  }
  const level = Math.max(1, num(actor?.system?.niveau, 1));
  const xp = Math.max(0, Math.floor(num(actor?.system?.xp, 0)));
  return xpMeta(actor, level, xp);
}

function effectsEngine() {
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine ?? null;
  if (!engine || typeof engine.resolve !== "function") {
    throw new Error("Le moteur canonique ADD2E des domaines movement/encumbrance est indisponible.");
  }
  return engine;
}

function canonicalResolve(actor, { domain, target, base = 0, context = {} } = {}) {
  const cleanContext = { ...context, terrain: "__add2e_movement_terrain_ignored__" };
  const engine = effectsEngine();
  const collected = typeof engine.collect === "function"
    ? engine.collect(actor, cleanContext).filter(modifier => norm(modifier?.source?.kind) !== "scene")
    : undefined;
  return engine.resolve(actor, {
    domain,
    target,
    base: num(base, 0),
    ...(Array.isArray(collected) ? { modifiers: collected } : {}),
    context: {
      ...cleanContext,
      actor,
      actionType: domain,
      source: context.source ?? "movement-encumbrance"
    }
  });
}

function currentProgressionRowForClass(item) {
  if (!item) return null;
  const level = Math.max(1, num(item.system?.niveau ?? item.system?.level, 1));
  const progression = Array.isArray(item.system?.progression) ? item.system.progression : [];
  return progression.find(row => Number(row?.niveau ?? row?.level) === level) ?? progression[level - 1] ?? null;
}

function directMovementMetres(system = {}) {
  const value = firstPositive(
    system.mouvement,
    system.movement,
    system.vitesse,
    system.vitesse_deplacement,
    system.deplacement,
    system["déplacement"],
    system.monkMove,
    system.monkMovement,
    system.baseMovement
  );
  return value > 0 ? { value, rawValue: value, unit: "metres", field: "direct" } : null;
}

function progressionMovementMetres(row = {}) {
  const direct = directMovementMetres(row);
  if (direct) return direct;
  const monkInches = firstPositive(row?.monk?.movement);
  return monkInches > 0
    ? { value: round2(monkInches * ADND_MOVEMENT_INCH_METRES), rawValue: monkInches, unit: "adnd-inch", field: "monk.movement" }
    : null;
}

function naturalMovementSource(actor) {
  const sources = [];
  const race = raceItem(actor);
  const raceMovement = directMovementMetres(race?.system ?? {});
  if (raceMovement?.value > 0) {
    sources.push({ kind: "race", itemId: race.id, itemUuid: race.uuid, name: race.name, ...raceMovement });
  }
  for (const item of classItems(actor)) {
    const progressionMovement = progressionMovementMetres(currentProgressionRowForClass(item) ?? {});
    const classMovement = directMovementMetres(item.system ?? {});
    const movement = progressionMovement ?? classMovement;
    if (!movement?.value) continue;
    sources.push({
      kind: progressionMovement ? "class-progression" : "class",
      itemId: item.id,
      itemUuid: item.uuid,
      name: item.name,
      level: Math.max(1, num(item.system?.niveau ?? item.system?.level, 1)),
      ...movement
    });
  }
  const actorMovement = actor?.type === "personnage" ? null : directMovementMetres(actor?.system ?? {});
  if (actorMovement?.value > 0) {
    sources.push({ kind: "actor", itemId: null, itemUuid: actor?.uuid ?? null, name: actor?.name ?? "Acteur", ...actorMovement });
  }
  const selected = [...sources].sort((left, right) => {
    const priority = { "class-progression": 4, race: 3, class: 2, actor: 1 };
    return right.value - left.value || (priority[right.kind] ?? 0) - (priority[left.kind] ?? 0);
  })[0] ?? null;
  return { value: selected?.value ?? 0, selected, sources, missing: !selected };
}

function supernaturalEncumbranceProfile(score) {
  const source = SUPERNATURAL_STRENGTH_CAPACITY_POUNDS[score];
  if (!source) return null;
  const span = Math.max(0, source.severe - source.unencumbered);
  return {
    unencumbered: source.unencumbered,
    light: source.unencumbered + Math.floor(span * 0.25),
    moderate: source.unencumbered + Math.floor(span * 0.5),
    heavy: source.unencumbered + Math.floor(span * 0.75),
    severe: source.severe,
    source: "strength-weight-allowance-max-press"
  };
}

function strengthEncumbranceTableProfile(derived) {
  const tableKey = String(derived?.tableKey ?? derived?.score ?? "");
  const exact = ENCUMBRANCE_TABLE_POUNDS[tableKey] ?? null;
  const score = Math.max(2, Math.min(25, Math.floor(num(derived?.score, 10))));
  const pounds = exact ?? supernaturalEncumbranceProfile(score) ?? ENCUMBRANCE_TABLE_POUNDS[18];
  const limitsPounds = {
    unencumbered: round2(pounds.unencumbered),
    light: round2(pounds.light),
    moderate: round2(pounds.moderate),
    heavy: round2(pounds.heavy),
    severe: round2(pounds.severe)
  };
  const limitsGoldPieces = Object.fromEntries(
    Object.entries(limitsPounds).map(([key, value]) => [key, round2(value * GOLD_PIECES_PER_POUND)])
  );
  return {
    tableKey,
    score,
    source: exact ? "phb-table-47" : (pounds.source ?? "phb-table-47"),
    pounds: limitsPounds,
    goldPieces: limitsGoldPieces
  };
}

function strengthEncumbranceProfile(actor) {
  const engine = effectsEngine();
  if (typeof engine.resolveAbilityDerived !== "function") {
    throw new Error("Le résolveur canonique ADD2E de Force est indisponible pour l’encombrement.");
  }
  const derived = engine.resolveAbilityDerived(actor, "force", {
    domain: "encumbrance",
    type: "movement-encumbrance",
    source: "movement-encumbrance",
    consumer: "movement"
  });
  return {
    derived,
    weightAdjustment: num(derived?.profile?.poids, 0),
    capacityProfile: strengthEncumbranceTableProfile(derived)
  };
}

function itemTags(item) {
  const system = item?.system ?? {};
  const flags = item?.flags?.add2e ?? {};
  return new Set([
    ...scalars(system.tags),
    ...scalars(system.effectTags),
    ...scalars(flags.tags),
    ...scalars(flags.effectTags)
  ].map(norm).filter(Boolean));
}

function itemEquipped(item) {
  try { return effectsEngine().itemEquipped(item); }
  catch (_error) {
    const system = item?.system ?? {};
    return system.equipe === true || system.equipee === true || system.equipped === true || system.porte === true || system.portee === true;
  }
}

function itemEncumbranceExemption(item) {
  const system = item?.system ?? {};
  const flags = item?.flags?.add2e ?? {};
  const category = norm(system.categorie ?? system.category);
  const subtype = norm(system.sousType ?? system.subType ?? system.subtype);
  const tags = itemTags(item);

  if (flags.ignoreEncumbrance === true || system.ignoreEncumbrance === true || system.encumbranceExempt === true) {
    return "explicit";
  }
  if (category === "composant_sort" || subtype === "composant" || tags.has("composant_sort")) {
    return "spell-component";
  }
  if (tags.has("objet_outils_de_voleur") || tags.has("outils_de_voleur")) {
    return "thief-tools";
  }
  if (category === "vetement" && itemEquipped(item)) {
    return "worn-clothing-standard-weight";
  }
  return null;
}

function itemIsCarried(item) {
  const type = String(item?.type ?? "").toLowerCase();
  if (["classe", "race", "sort", "spell"].includes(type)) return false;
  const system = item?.system ?? {};
  const flags = item?.flags?.add2e ?? {};
  const exemption = itemEncumbranceExemption(item);

  if (itemEquipped(item)) return !exemption;

  const carriedState = [
    system.transporte,
    system.transporté,
    system.carried,
    system.inInventory,
    flags.carried
  ].find(value => typeof value === "boolean");
  if (carriedState === false) return false;
  return !exemption;
}

function normalizedWeightUnit(system = {}) {
  return norm(system.poids_unite ?? system.weightUnit ?? system.weight_unit ?? system.unite_poids ?? system["unité_poids"] ?? "");
}

function magicArmorIsWeightless(item) {
  const system = item?.system ?? {};
  const type = String(item?.type ?? "").toLowerCase();
  const isArmor = ["armure", "armor"].includes(type);
  const isShield = system.bouclier === true || norm(system.type_armure) === "bouclier" || norm(system.categorie) === "bouclier";
  return isArmor && !isShield && (system.magique === true || system.magic === true);
}

function resolvedBaseItemWeight(item) {
  const resolver = globalThis.add2eMagicBuilderResolveBaseWeight;
  if (typeof resolver !== "function") return null;
  const resolved = resolver(item);
  if (!resolved || typeof resolved !== "object") return null;
  const explicitGp = num(resolved.encumbranceGoldPieces, NaN);
  if (Number.isFinite(explicitGp) && explicitGp > 0) {
    return { value: explicitGp, rawValue: explicitGp, rawUnit: "gp", source: `magic-base:${resolved.match ?? "resolved"}` };
  }
  const rawValue = num(resolved.value, NaN);
  if (!(rawValue > 0)) return null;
  const unit = norm(resolved.unit);
  if (["po", "pp", "gp", "piece_dor", "pieces_dor", "gold_piece", "gold_pieces"].includes(unit)) {
    return { value: rawValue, rawValue, rawUnit: unit, source: `magic-base:${resolved.match ?? "resolved"}` };
  }
  if (["kg", "kilogramme", "kilogrammes", "kilogram", "kilograms"].includes(unit)) {
    return { value: round2(rawValue * GOLD_PIECES_PER_KILOGRAM), rawValue, rawUnit: unit, source: `magic-base:${resolved.match ?? "resolved"}` };
  }
  return { value: round2(rawValue * GOLD_PIECES_PER_POUND), rawValue, rawUnit: unit || "pound", source: `magic-base:${resolved.match ?? "resolved"}` };
}

function itemWeightGoldPieces(item) {
  const system = item?.system ?? {};
  if (magicArmorIsWeightless(item)) {
    const baseWeight = resolvedBaseItemWeight(item);
    return { value: 0, rawValue: baseWeight?.rawValue ?? num(system.poids ?? system.weight, 0), rawUnit: baseWeight?.rawUnit ?? normalizedWeightUnit(system) || "source", source: "magic-armor-weightless" };
  }
  const explicitGp = num(system.poids_encombrement_po ?? system.encumbrance_gp ?? system.encumbranceGoldPieces, NaN);
  if (Number.isFinite(explicitGp) && explicitGp >= 0) {
    return { value: explicitGp, rawValue: explicitGp, rawUnit: "gp", source: "poids_encombrement_po" };
  }
  const rawValue = num(system.poids ?? system.weight ?? system.encombrement ?? system.encumbrance, 0);
  if (!(rawValue > 0)) {
    const baseWeight = resolvedBaseItemWeight(item);
    if (baseWeight) return baseWeight;
    return { value: 0, rawValue: 0, rawUnit: normalizedWeightUnit(system) || null, source: "zero" };
  }
  const unit = normalizedWeightUnit(system);
  if (["po", "pp", "gp", "piece_dor", "pieces_dor", "gold_piece", "gold_pieces"].includes(unit)) {
    return { value: rawValue, rawValue, rawUnit: unit, source: "explicit-gp" };
  }
  if (["kg", "kilogramme", "kilogrammes", "kilogram", "kilograms"].includes(unit)) {
    return { value: round2(rawValue * GOLD_PIECES_PER_KILOGRAM), rawValue, rawUnit: unit, source: "explicit-kg" };
  }
  if (["lb", "lbs", "livre", "livres", "pound", "pounds"].includes(unit)) {
    return { value: round2(rawValue * GOLD_PIECES_PER_POUND), rawValue, rawUnit: unit, source: "explicit-pound" };
  }
  const type = String(item?.type ?? "").toLowerCase();
  if (["arme", "weapon", "armure", "armor"].includes(type)) {
    return { value: round2(rawValue * GOLD_PIECES_PER_POUND), rawValue, rawUnit: "pound", source: "item-type-pound" };
  }
  return { value: round2(rawValue * GOLD_PIECES_PER_KILOGRAM), rawValue, rawUnit: "kg", source: "object-default-kg" };
}

function itemWeightEntry(item) {
  const system = item?.system ?? {};
  const quantity = Math.max(0, num(system.quantite ?? system.quantity ?? 1, 1));
  const normalized = itemWeightGoldPieces(item);
  return {
    kind: "item",
    item,
    itemId: item?.id ?? null,
    itemUuid: item?.uuid ?? null,
    name: item?.name ?? "Objet",
    quantity,
    rawUnitWeight: normalized.rawValue,
    weightUnit: normalized.rawUnit,
    weightSource: normalized.source,
    unitWeight: round2(normalized.value),
    total: round2(quantity * normalized.value)
  };
}

function moneyWeightEntry(actor) {
  const money = actor?.flags?.add2e?.monnaie ?? {};
  const denominations = Object.fromEntries(["pp", "po", "pe", "pa", "pc"].map(key => [key, Math.max(0, Math.floor(num(money?.[key], 0)))]));
  const quantity = Object.values(denominations).reduce((sum, value) => sum + value, 0);
  return {
    kind: "money",
    item: null,
    itemId: null,
    itemUuid: null,
    name: "Monnaie transportée",
    quantity,
    denominations,
    rawUnitWeight: 1,
    weightUnit: "coin",
    weightSource: "flags.add2e.monnaie",
    unitWeight: 1,
    total: round2(quantity)
  };
}

function wornClothingWeightEntry(actor) {
  const items = actor?.items?.contents ?? Array.from(actor?.items ?? []);
  const worn = items.filter(item => {
    const system = item?.system ?? {};
    const category = norm(system.categorie ?? system.category);
    return category === "vetement" && itemEquipped(item);
  });
  if (!worn.length) return null;
  return {
    kind: "worn-clothing",
    item: null,
    itemId: null,
    itemUuid: null,
    itemIds: worn.map(item => item.id),
    name: "Vêtements portés",
    quantity: 1,
    rawUnitWeight: WORN_CLOTHING_POUNDS,
    weightUnit: "pound",
    weightSource: "phb-standard-worn-clothing",
    unitWeight: WORN_CLOTHING_POUNDS * GOLD_PIECES_PER_POUND,
    total: WORN_CLOTHING_POUNDS * GOLD_PIECES_PER_POUND
  };
}

function carriedInventory(actor) {
  const itemEntries = (actor?.items?.contents ?? Array.from(actor?.items ?? [])).filter(itemIsCarried).map(itemWeightEntry).filter(entry => entry.total > 0);
  const coinEntry = moneyWeightEntry(actor);
  const clothingEntry = wornClothingWeightEntry(actor);
  const entries = [...itemEntries];
  if (coinEntry.total > 0) entries.push(coinEntry);
  if (clothingEntry?.total > 0) entries.push(clothingEntry);
  return { entries, total: round2(entries.reduce((sum, entry) => sum + entry.total, 0)) };
}

function equippedArmor(actor) {
  return (actor?.items?.contents ?? Array.from(actor?.items ?? [])).filter(item => {
    const type = String(item?.type ?? "").toLowerCase();
    if (!["armure", "armor"].includes(type) || !itemEquipped(item)) return false;
    const system = item?.system ?? {};
    const identity = norm(`${system.type_armure ?? ""} ${system.categorie ?? ""} ${system.nom ?? ""} ${item?.name ?? ""}`);
    return system.bouclier !== true && !identity.includes("bouclier");
  });
}

function activeEffects(actor) {
  const seen = new Set();
  const result = [];
  for (const effect of [...(actor?.effects?.contents ?? actor?.effects ?? []), ...(actor?.appliedEffects ?? [])]) {
    const key = String(effect?.uuid ?? effect?.id ?? "");
    if (!effect || effect.disabled === true || effect.isSuppressed === true || effect.active === false || !key || seen.has(key)) continue;
    seen.add(key);
    result.push(effect);
  }
  return result;
}

function activeStatuses(actor) {
  const statuses = new Set();
  for (const effect of activeEffects(actor)) {
    for (const status of effect.statuses ?? []) {
      const key = norm(status?.id ?? status);
      if (key) statuses.add(key);
    }
  }
  return [...statuses];
}

function transformationContext(actor, token = null) {
  const candidates = [];
  const add = (effect, raw, source) => {
    if (!raw || typeof raw !== "object") return;
    const kind = norm(raw.kind ?? raw.type ?? "");
    const form = kind === "size"
      ? raw.formKey ?? raw.form ?? raw.forme ?? raw.transformation ?? null
      : raw.formKey ?? raw.form ?? raw.forme ?? raw.transformation ?? raw.movementMode ?? raw.mode ?? null;
    const size = raw.size ?? raw.taille ?? raw.sizeCategory ?? raw.gabarit ?? null;
    const factor = num(raw.factor ?? raw.scale ?? raw.sizeFactor, NaN);
    candidates.push({
      effectId: effect?.id ?? null,
      source,
      form,
      size,
      factor: Number.isFinite(factor) ? factor : null,
      raw: clone(raw)
    });
  };

  for (const effect of activeEffects(actor)) {
    const flags = effect?.flags?.add2e ?? {};
    add(effect, flags.capabilityTransformation, "capabilityTransformation");
    add(effect, flags.movement, "movement");
    for (const tag of scalars(flags.tags ?? flags.effectTags)) {
      const key = norm(tag);
      if (key.startsWith("forme_")) add(effect, { form: key.slice(6) }, "tag");
      else if (key.startsWith("transformation_")) add(effect, { form: key.slice(15) }, "tag");
      else if (key.startsWith("taille_")) add(effect, { size: key.slice(7) }, "tag");
    }
  }

  const tokenTransform = token?.flags?.add2e?.tokenTransform ?? null;
  add(null, tokenTransform, "tokenTransform");

  const lastCandidate = predicate => [...candidates].reverse().find(predicate) ?? null;
  const formSource = lastCandidate(candidate => candidate.form !== null
    && candidate.form !== undefined
    && String(candidate.form).trim() !== "");
  const sizeSource = lastCandidate(candidate => candidate.size !== null
    && candidate.size !== undefined
    && String(candidate.size).trim() !== "");
  const factorSource = lastCandidate(candidate => Number.isFinite(Number(candidate.factor)));
  const selected = candidates[candidates.length - 1] ?? null;

  return {
    selected,
    candidates,
    formSource,
    sizeSource,
    factorSource,
    form: formSource?.form ?? null,
    size: sizeSource?.size ?? null,
    factor: factorSource?.factor ?? null
  };
}

function explicitContextValue(options, key) {
  return Object.prototype.hasOwnProperty.call(options ?? {}, key) ? options[key] : undefined;
}

function movementRuntimeToken(actor, options = {}) {
  if (options.persistent === true) return null;
  const direct = options.token?.document ?? options.token ?? null;
  if (direct) return direct;
  const controlled = canvas?.tokens?.controlled?.find?.(token => token?.actor?.id === actor?.id) ?? null;
  if (controlled?.document) return controlled.document;
  const active = actor?.getActiveTokens?.(true, true) ?? [];
  const currentSceneId = canvas?.scene?.id ?? null;
  const current = active.find(token => (token?.document?.parent?.id ?? token?.scene?.id) === currentSceneId) ?? active[0] ?? null;
  return current?.document ?? current ?? null;
}

function movementRuntimeContext(actor, options = {}) {
  const actorFlags = actor?.flags?.add2e ?? {};
  const persistent = options.persistent === true;
  const token = movementRuntimeToken(actor, options);
  const tokenFlags = token?.flags?.add2e ?? {};
  const scene = persistent ? null : (options.scene ?? token?.parent ?? canvas?.scene ?? null);
  const sceneFlags = scene?.flags?.add2e ?? {};
  const explicitEnvironment = explicitContextValue(options, "environment");
  const explicitMilieu = explicitContextValue(options, "milieu");
  const environment = explicitEnvironment !== undefined
    ? explicitEnvironment
    : explicitMilieu !== undefined
      ? explicitMilieu
      : tokenFlags.environment ?? tokenFlags.milieu ?? (persistent
        ? actorFlags.environment ?? actorFlags.milieu ?? null
        : sceneFlags.environment ?? sceneFlags.milieu ?? actorFlags.environment ?? actorFlags.milieu ?? null);
  return {
    token,
    scene: persistent ? null : scene,
    environment,
    milieu: environment,
    persistent,
    consumer: options.consumer ?? (persistent ? "movement-persistent-mirror" : "movement-runtime")
  };
}

function movementContext(actor, source, inventory, armor, strength, options = {}) {
  const system = actor?.system ?? {};
  const flags = actor?.flags?.add2e ?? {};
  const runtime = movementRuntimeContext(actor, options);
  const transformed = transformationContext(actor, runtime.token);
  const transformation = options.transformation ?? transformed.form ?? flags.transformation ?? system.transformation ?? system.forme ?? system.form ?? null;
  const size = options.size ?? transformed.size ?? system.taille ?? system.size ?? system.gabarit ?? flags.size ?? null;
  return {
    source: "movement-encumbrance",
    consumer: runtime.consumer,
    movementSource: clone(source),
    inventory: {
      total: inventory.total,
      entries: inventory.entries.map(entry => ({
        kind: entry.kind,
        itemId: entry.itemId,
        itemUuid: entry.itemUuid,
        itemIds: clone(entry.itemIds),
        name: entry.name,
        quantity: entry.quantity,
        denominations: clone(entry.denominations),
        rawUnitWeight: entry.rawUnitWeight,
        weightUnit: entry.weightUnit,
        weightSource: entry.weightSource,
        unitWeight: entry.unitWeight,
        total: entry.total
      }))
    },
    armor,
    equippedArmor: armor,
    strength: strength.derived,
    strengthEncumbrance: clone(strength.capacityProfile),
    size,
    taille: size,
    transformation,
    form: transformation,
    forme: transformation,
    transformationFactor: transformed.factor,
    sizeFactor: transformed.factor,
    transformationContext: transformed,
    environment: runtime.environment,
    milieu: runtime.milieu,
    statuses: options.statuses ?? activeStatuses(actor),
    token: runtime.token,
    scene: runtime.scene,
    persistent: runtime.persistent,
    movementMode: options.movementMode ?? options.mode ?? null,
    movementModes: options.movementModes ?? null
  };
}

function resolvedTotal(resolution, fallback = 0) {
  return round2(num(resolution?.total, fallback));
}

function encumbranceCategory(weight, limits) {
  if (weight > limits.severe) {
    return { label: "Surcharge", category: "surcharge", multiplier: 0, attackPenalty: -4, armorClassPenalty: 3 };
  }
  if (weight > limits.heavy) {
    return { label: "Encombrement sévère", category: "severe", multiplier: null, attackPenalty: -4, armorClassPenalty: 3 };
  }
  if (weight > limits.moderate) {
    return { label: "Encombrement lourd", category: "lourd", multiplier: 1 / 3, attackPenalty: -2, armorClassPenalty: 1 };
  }
  if (weight > limits.light) {
    return { label: "Encombrement modéré", category: "modere", multiplier: 1 / 2, attackPenalty: -1, armorClassPenalty: 0 };
  }
  if (weight > limits.unencumbered) {
    return { label: "Encombrement léger", category: "leger", multiplier: 2 / 3, attackPenalty: 0, armorClassPenalty: 0 };
  }
  return { label: "Sans encombrement", category: "sans_encombrement", multiplier: 1, attackPenalty: 0, armorClassPenalty: 0 };
}

function categoryBaseMultiplier(category, naturalBase) {
  if (category.category === "surcharge") return 0;
  if (category.category === "severe") {
    return naturalBase > 0 ? Math.min(1, ADND_MOVEMENT_INCH_METRES / naturalBase) : 0;
  }
  return Math.max(0, num(category.multiplier, 1));
}

function encumberedMovementMetres(naturalBase, multiplier, category) {
  if (!(naturalBase > 0) || category === "surcharge" || !(multiplier > 0)) return 0;
  const movementRate = naturalBase / ADND_MOVEMENT_INCH_METRES;
  const adjustedRate = Math.max(0, Math.floor((movementRate * multiplier) + 1e-9));
  return round2(adjustedRate * ADND_MOVEMENT_INCH_METRES);
}

function collectModes(...resolutions) {
  const modes = new Set();
  const add = value => {
    for (const entry of scalars(value)) {
      const key = norm(entry);
      if (key) modes.add(key);
    }
  };
  for (const resolution of resolutions.filter(Boolean)) {
    for (const entry of resolution?.applied ?? []) {
      add(entry?.modes);
      add(entry?.mode);
      add(entry?.metadata?.modes);
      add(entry?.modifier?.modes);
      add(entry?.modifier?.mode);
      add(entry?.modifier?.metadata?.modes);
      add(entry?.source?.metadata?.modes);
    }
  }
  return [...modes];
}

function environmentMode(environment) {
  const key = norm(environment);
  if (["underwater", "sous_eau", "aquatique", "water", "eau"].includes(key)) return "underwater";
  return null;
}

function canonicalMovementMode(raw, movementModes = {}) {
  const key = norm(raw);
  const aliases = {
    terrestre: "ground",
    sol: "ground",
    ground: "ground",
    vol: "flight",
    flight: "flight",
    aerien: "flight",
    aerienne: "flight",
    montee: "ascent",
    ascent: "ascent",
    descente: "descent",
    descent: "descent",
    vertical: "vertical",
    levitation: "vertical",
    sous_eau: "underwater",
    underwater: "underwater",
    aquatique: "underwater",
    nage: "swim",
    swim: "swim"
  };
  const target = aliases[key] ?? key;
  return MOVEMENT_TARGETS.includes(target) && movementModes[target]?.available ? target : "ground";
}

function emptyMovement() {
  const modeData = Object.fromEntries(MOVEMENT_TARGETS.map(target => [target, { target, base: 0, value: 0, available: target === "ground", resolution: null }]));
  return {
    naturalBase: 0,
    baseNaturelle: 0,
    base: 0,
    actuel: 0,
    vitesse: 0,
    poids: 0,
    poidsPo: 0,
    poidsKg: 0,
    forcePoids: 0,
    limiteSansEncombrement: 0,
    limiteLegere: 0,
    limiteModeree: 0,
    limiteLourde: 0,
    limiteSevere: 0,
    limiteNormale: 0,
    limiteSurcharge: 0,
    categorie: "sans_encombrement",
    label: "Sans encombrement",
    multiplier: 1,
    attaquePenalite: 0,
    classeArmurePenalite: 0,
    modeActif: "ground",
    modes: [],
    modesMagiques: [],
    movementModes: modeData,
    metresTour: 0,
    donjonRoundMetres: 0,
    segmentMetres: 0,
    exterieurDemiJourKm: 0
  };
}

export function computeMovement(actor, options = {}) {
  if (!actor) return emptyMovement();
  const source = naturalMovementSource(actor);
  const inventory = carriedInventory(actor);
  const armor = equippedArmor(actor);
  const strength = strengthEncumbranceProfile(actor);
  const context = movementContext(actor, source, inventory, armor, strength, options);

  const carriedWeightResolution = canonicalResolve(actor, {
    domain: "encumbrance",
    target: "carried-weight",
    base: inventory.total,
    context: { ...context, encumbranceTarget: "carried-weight" }
  });
  const weight = resolvedTotal(carriedWeightResolution, inventory.total);

  const capacityKeys = ["unencumbered", "light", "moderate", "heavy", "severe"];
  const capacityResolutions = {};
  const resolvedLimits = {};
  let previousLimit = 0;
  for (const key of capacityKeys) {
    const base = strength.capacityProfile.goldPieces[key];
    const resolution = canonicalResolve(actor, {
      domain: "encumbrance",
      target: `capacity.${key}`,
      base,
      context: { ...context, carriedWeight: weight, capacityTier: key }
    });
    const total = Math.max(previousLimit, resolvedTotal(resolution, base));
    capacityResolutions[key] = resolution;
    resolvedLimits[key] = total;
    previousLimit = total;
  }

  const category = encumbranceCategory(weight, resolvedLimits);
  const multiplierBase = categoryBaseMultiplier(category, source.value);
  const multiplierResolution = canonicalResolve(actor, {
    domain: "encumbrance",
    target: "movement-multiplier",
    base: multiplierBase,
    context: {
      ...context,
      carriedWeight: weight,
      limits: clone(resolvedLimits),
      encumbranceCategory: category.category
    }
  });
  const multiplier = Math.max(0, num(multiplierResolution?.total, multiplierBase));
  const movementBase = encumberedMovementMetres(source.value, multiplier, category.category);

  const attackPenaltyResolution = canonicalResolve(actor, {
    domain: "encumbrance",
    target: "attack-penalty",
    base: category.attackPenalty,
    context: {
      ...context,
      carriedWeight: weight,
      limits: clone(resolvedLimits),
      encumbranceCategory: category.category
    }
  });
  const armorClassPenaltyResolution = canonicalResolve(actor, {
    domain: "encumbrance",
    target: "armor-class-penalty",
    base: category.armorClassPenalty,
    context: {
      ...context,
      carriedWeight: weight,
      limits: clone(resolvedLimits),
      encumbranceCategory: category.category
    }
  });
  const attackPenalty = num(attackPenaltyResolution?.total, category.attackPenalty);
  const armorClassPenalty = num(armorClassPenaltyResolution?.total, category.armorClassPenalty);

  const sharedMovementContext = {
    ...context,
    naturalBase: source.value,
    carriedWeight: weight,
    encumbranceMultiplier: multiplier,
    encumbranceCategory: category.category,
    encumbranceCombat: { attackPenalty, armorClassPenalty },
    limits: clone(resolvedLimits)
  };

  const movementModes = {};
  for (const target of MOVEMENT_TARGETS) {
    const base = target === "ground" ? movementBase : 0;
    const resolution = canonicalResolve(actor, {
      domain: "movement",
      target,
      base,
      context: { ...sharedMovementContext, movementMode: target }
    });
    const value = Math.max(0, num(resolution?.total, base));
    const applied = Array.isArray(resolution?.applied) ? resolution.applied : [];
    movementModes[target] = {
      target,
      base: round2(base),
      value: round2(value),
      preciseValue: round2(value),
      available: target === "ground" || applied.length > 0 || value > 0,
      resolution
    };
  }

  const requestedMode = options.movementMode ?? options.mode ?? environmentMode(context.environment) ?? "ground";
  const modeActif = canonicalMovementMode(requestedMode, movementModes);
  const selected = movementModes[modeActif] ?? movementModes.ground;
  const actuel = selected.value;
  const allResolutions = MOVEMENT_TARGETS.map(target => movementModes[target].resolution);
  const modes = collectModes(...allResolutions);
  const canonicalApplied = allResolutions.flatMap(resolution => Array.isArray(resolution?.applied) ? resolution.applied : []);

  if (source.missing && options.warnMissingBase !== false) {
    const key = String(actor.uuid ?? actor.id ?? actor.name ?? "actor");
    if (!MISSING_MOVEMENT_BASE_WARNED.has(key)) {
      MISSING_MOVEMENT_BASE_WARNED.add(key);
      console.warn(`${ADD2E_MOVE_XP_TAG}[MOVEMENT][MISSING_BASE]`, {
        actor: actor.name,
        actorId: actor.id,
        message: "Aucun mouvement explicite n’est défini sur l’acteur, l’Item race ou les Items classe."
      });
    }
  }

  return {
    naturalBase: round2(source.value),
    baseNaturelle: round2(source.value),
    base: round2(movementBase),
    actuel,
    vitesse: actuel,
    modeActif,
    poids: weight,
    poidsPo: weight,
    poidsKg: round2(weight / GOLD_PIECES_PER_KILOGRAM),
    forcePoids: strength.weightAdjustment,
    forceProfilEncombrement: clone(strength.capacityProfile),
    limiteSansEncombrement: resolvedLimits.unencumbered,
    limiteLegere: resolvedLimits.light,
    limiteModeree: resolvedLimits.moderate,
    limiteLourde: resolvedLimits.heavy,
    limiteSevere: resolvedLimits.severe,
    limiteNormale: resolvedLimits.unencumbered,
    limiteSurcharge: resolvedLimits.severe,
    categorie: category.category,
    label: category.label,
    multiplier,
    attaquePenalite: attackPenalty,
    classeArmurePenalite: armorClassPenalty,
    modes,
    modesMagiques: modes,
    movementModes,
    source,
    contextScope: {
      persistent: context.persistent === true,
      tokenId: context.token?.id ?? null,
      sceneId: context.scene?.id ?? null,
      environment: context.environment ?? null,
      size: context.size ?? null,
      transformation: context.transformation ?? null,
      factor: context.transformationFactor ?? null
    },
    inventory: clone(context.inventory),
    encumbrance: {
      carriedWeight: carriedWeightResolution,
      capacities: capacityResolutions,
      capacityProfile: clone(strength.capacityProfile),
      limits: clone(resolvedLimits),
      movementMultiplier: multiplierResolution,
      attackPenalty: attackPenaltyResolution,
      armorClassPenalty: armorClassPenaltyResolution,
      category: category.category,
      label: category.label
    },
    movementResolution: movementModes.ground.resolution,
    movementResolutions: Object.fromEntries(MOVEMENT_TARGETS.map(target => [target, movementModes[target].resolution])),
    magic: {
      active: canonicalApplied.length > 0,
      naturalBase: round2(source.value),
      base: selected.preciseValue,
      modes,
      rules: canonicalApplied
    },
    metresTour: actuel,
    donjonRoundMetres: actuel,
    segmentMetres: round2(actuel / 10),
    exterieurDemiJourKm: round2(actuel * 1.6)
  };
}

export function magicMovementRules(actor, options = {}) {
  return computeMovement(actor, options)?.magic?.rules ?? [];
}

export function movementUpdates(actor) {
  const movement = computeMovement(actor, { persistent: true, consumer: "movement-persistent-mirror", movementMode: "ground" });
  return {
    updates: {
      "system.mouvement": movement
    },
    movement
  };
}

export function flatActorUpdates(actor, { mode = "auto", incoming = {} } = {}) {
  const movementOnly = movementUpdates(actor);
  if (mode === "movement" || isMulticlassActor(actor) || actor?.type !== "personnage") {
    return { updates: movementOnly.updates, xp: computeXp(actor), movement: movementOnly.movement, multiclass: isMulticlassActor(actor) };
  }
  const incomingLevel = incoming["system.niveau"] !== undefined ? Math.max(1, num(incoming["system.niveau"], 1)) : Math.max(1, num(actor?.system?.niveau, 1));
  const incomingXp = incoming["system.xp"] !== undefined ? Math.max(0, Math.floor(num(incoming["system.xp"], 0))) : Math.max(0, Math.floor(num(actor?.system?.xp, 0)));
  let level = incomingLevel;
  let xp = incomingXp;
  if (mode === "level") xp = minXpForLevel(actor, level);
  else if (mode === "xp") {
    xp = Math.max(xp, minXpForLevel(actor, level));
    const suggested = levelForXp(actor, xp);
    if (game.settings.get("add2e", "xpAutoLevel") && suggested > level) level = suggested;
  } else xp = Math.max(xp, minXpForLevel(actor, level));
  const meta = xpMeta(actor, level, xp);
  const currentTitle = xpRows(actor).find(row => Number(row.niveau) === level)?.title ?? actor?.system?.titre ?? "";
  const updates = {
    "system.xp": xp,
    "system.niveau": level,
    "system.progression_xp": meta.progressionLabel,
    "system.xp_next": meta.nextXp,
    "system.xp_to_next": meta.xpToNext,
    "system.xp_percent": meta.percent,
    "system.niveau_suggere": meta.suggestedLevel,
    ...movementOnly.updates
  };
  if (currentTitle) updates["system.titre"] = currentTitle;
  return { updates, xp: meta, movement: movementOnly.movement, multiclass: false };
}

export async function recalc(actor, { mode = "auto", notify = false } = {}) {
  if (!actor) return null;
  const result = flatActorUpdates(actor, { mode });
  const updates = changedUpdatePayload(actor, result.updates);
  result.updates = updates;
  result.skipped = Object.keys(updates).length === 0;
  if (!result.skipped) {
    await actor.update(updates, { [ADD2E_MOVE_XP_INTERNAL]: true, add2eReason: `move-xp-recalc:${mode}`, render: false });
  }
  if (notify && mode === "level" && actor.type === "personnage" && !result.multiclass) {
    ui.notifications.info(`${actor.name} : XP ajustée au niveau ${result.xp.level} (${result.xp.xp.toLocaleString()} XP).`);
  }
  return result;
}

async function createXpCard(actor, { title = "Expérience", rows = [], message = "", flags = {} } = {}) {
  const build = globalThis.add2eBuildChatCard;
  const create = globalThis.add2eCreateChatCard;
  if (typeof build !== "function" || typeof create !== "function") throw new Error("Les constructeurs communs de cartes ADD2E ne sont pas disponibles.");
  const options = {
    actor,
    title,
    icon: "fas fa-star",
    variant: "success",
    source: { name: actor?.name ?? "Acteur", img: actor?.img, type: "Progression" },
    rows,
    message,
    chatData: { flags: { add2e: { moveXp: true, version: ADD2E_MOVE_XP_VERSION, ...flags } } }
  };
  const preview = build(options);
  if (!String(preview ?? "").trim()) throw new Error("La carte d’XP ADD2E est vide.");
  return create(options);
}

export async function awardXp(actor, amount, { reason = "Gain d'expérience", percentBonus = 0 } = {}) {
  if (!actor || actor.type !== "personnage") return null;
  const base = Math.max(0, Math.floor(num(amount, 0)));
  const bonus = Math.max(0, Math.floor(base * (num(percentBonus, 0) / 100)));
  const total = base + bonus;
  if (isMulticlassActor(actor)) {
    const applyCanonical = globalThis.add2eSessionXpApplyToActor;
    if (typeof applyCanonical !== "function") {
      ui.notifications.error("Le moteur d’XP canonique des Items classe n’est pas chargé.");
      return null;
    }
    const result = await applyCanonical(actor, total, reason);
    const details = result?.classes?.map(entry => `${entry.item?.name ?? "Classe"} ${entry.before ?? 0} → ${entry.after ?? 0}`).join(" ; ") ?? "";
    await createXpCard(actor, {
      rows: [
        { label: "Gain", value: `+${total.toLocaleString()} XP${bonus ? `, dont bonus ${bonus.toLocaleString()} XP` : ""}` },
        { label: "Répartition", value: details || "Items classe mis à jour" }
      ],
      message: reason || "Progression multiclasses mise à jour.",
      flags: { multiclass: true, total, bonus }
    });
    return { total, bonus, ...result };
  }
  const before = Math.max(0, Math.floor(num(actor.system?.xp, 0)));
  const after = before + total;
  const result = flatActorUpdates(actor, { mode: "xp", incoming: { "system.xp": after } });
  const updates = changedUpdatePayload(actor, result.updates);
  if (Object.keys(updates).length) await actor.update(updates, { add2eReason: "move-xp-award" });
  const displayedXp = Number(updates["system.xp"] ?? result.xp.xp ?? after) || after;
  const displayedLevel = String(updates["system.niveau"] ?? result.xp.level ?? actor.system?.niveau ?? "-");
  await createXpCard(actor, {
    rows: [
      { label: "Gain", value: `+${total.toLocaleString()} XP${bonus ? `, dont bonus ${bonus.toLocaleString()} XP` : ""}` },
      { label: "Expérience", value: `${before.toLocaleString()} → ${displayedXp.toLocaleString()} XP` },
      { label: "Niveau actuel", value: displayedLevel }
    ],
    message: reason || "Gain d’expérience",
    flags: { multiclass: false, total, bonus, before, after: displayedXp }
  });
  return { before, after: displayedXp, total, bonus, ...result };
}

export async function promptXp(actor) {
  if (!actor || actor.type !== "personnage") return;
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.wait) {
    ui.notifications.warn("DialogV2 indisponible : attribution d'XP annulée.");
    return;
  }
  const content = [
    "<form>",
    '<div class="form-group"><label>XP à ajouter</label><input type="number" name="amount" value="0" step="1"></div>',
    '<div class="form-group"><label>Bonus %</label><input type="number" name="percentBonus" value="0" step="1"></div>',
    '<div class="form-group"><label>Motif</label><input type="text" name="reason" value="Récompense d’aventure"></div>',
    "</form>"
  ].join("");
  const result = await DialogV2.wait({
    window: { title: `Attribuer de l'XP — ${actor.name}` },
    content,
    buttons: [
      {
        action: "add",
        label: "Ajouter",
        default: true,
        callback: (_event, button, dialog) => {
          const form = button?.form ?? dialog?.element?.querySelector?.("form") ?? null;
          return {
            action: "add",
            amount: form?.elements?.amount?.value ?? form?.amount?.value ?? 0,
            percentBonus: form?.elements?.percentBonus?.value ?? form?.percentBonus?.value ?? 0,
            reason: form?.elements?.reason?.value ?? form?.reason?.value ?? "Récompense d'aventure"
          };
        }
      },
      { action: "cancel", label: "Annuler", callback: () => ({ action: "cancel" }) }
    ],
    modal: true,
    rejectClose: false,
    close: () => ({ action: "cancel" })
  });
  if (result?.action === "add") await awardXp(actor, result.amount, { reason: result.reason, percentBonus: result.percentBonus });
}
