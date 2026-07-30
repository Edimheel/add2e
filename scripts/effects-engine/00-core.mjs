// ADD2E — Effects Engine / point d’entrée du noyau partagé.
// Compatible Foundry V13/V14/V15.

import {
  ADD2E_MODIFIER_RESOLVER_VERSION,
  canonicalKey,
  isObject
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

const ADD2E_MODIFIER_CONTEXT_CONDITIONS_VERSION = "2026-07-30-movement-context-conditions-v1";

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

function installContextConditionExtensions(Engine) {
  const baseEvaluate = Engine.evaluateModifierConditions.bind(Engine);
  const baseItemEquipped = Engine.itemEquipped.bind(Engine);

  Object.defineProperties(Engine, {
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
