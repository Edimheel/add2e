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

const ADD2E_MODIFIER_CONTEXT_CONDITIONS_VERSION = "2026-07-31-movement-context-conditions-v3";

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

        appendDocument(scene, "scene", { sourceScene: scene });
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
            actual: context.terrain ?? context.scene?.flags?.add2e?.terrain,
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
        const source = Array.isArray(query.modifiers) ? query.modifiers : this.collect(actor, context);
        const modifiers = source.map(modifier => dynamicMovementValue(modifier, context));
        return baseResolve(actor, { ...query, context, modifiers });
      }
    }
  });

  globalThis.ADD2E_MODIFIER_CONTEXT_CONDITIONS_VERSION = ADD2E_MODIFIER_CONTEXT_CONDITIONS_VERSION;
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
