// ADD2E — Effects Engine / point d’entrée du noyau partagé.
// Compatible Foundry V13/V14/V15.

import { ADD2E_MODIFIER_RESOLVER_VERSION } from "./00-core-shared.mjs";
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

export function installEffectsEngineCore(Engine) {
  installModifierResolver(Engine);
  installAbilityDerivedResolver(Engine);
  installEnginePrimitives(Engine);
  installCharacteristicEffectCanonicalization(Engine);

  globalThis.ADD2E_EFFECTS = Engine;
  globalThis.ADD2E_MODIFIER_RESOLVER_VERSION = ADD2E_MODIFIER_RESOLVER_VERSION;
}
