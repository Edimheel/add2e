// ADD2E — Effects Engine.
// Façade publique : l'API globale historique reste inchangée.

import { installEffectsEngineCore } from "./effects-engine/00-core.mjs";
import { installEffectsEngineTagsAndFeatures } from "./effects-engine/10-tags-features.mjs";
import { installEffectsEngineDefense } from "./effects-engine/20-defense.mjs";
import { installEffectsEngineDamage } from "./effects-engine/30-resistance-damage.mjs";
import { installEffectsEngineMonk } from "./effects-engine/40-monk.mjs";
import { installEffectsEngineAnalysis } from "./effects-engine/50-analysis.mjs";

globalThis.ADD2E_EFFECTS_ENGINE_VERSION = "2026-06-30-action-gate-owner-block-notice-v3";

class Add2eEffectsEngine {}

installEffectsEngineCore(Add2eEffectsEngine);
installEffectsEngineTagsAndFeatures(Add2eEffectsEngine);
installEffectsEngineDefense(Add2eEffectsEngine);
installEffectsEngineDamage(Add2eEffectsEngine);
installEffectsEngineMonk(Add2eEffectsEngine);
installEffectsEngineAnalysis(Add2eEffectsEngine);

function installSingleReadActionRules(Engine) {
  Object.defineProperty(Engine, "getActiveRules", {
    configurable: true,
    writable: true,
    value(actor) {
      const rules = [];
      const effects = actor?.effects?.contents ?? actor?.effects ?? [];
      for (const effect of effects) {
        if (!effect || effect.disabled) continue;
        let raw = effect.flags?.add2e?.rules;
        if ((raw === undefined || raw === null) && effect.getFlag) {
          try { raw = effect.getFlag("add2e", "rules"); } catch {}
        }
        for (const rule of this.toRules(raw)) {
          rules.push({
            ...rule,
            source: {
              effectId: effect.id ?? null,
              effectName: effect.name ?? "",
              effect,
              actor
            }
          });
        }
      }
      return rules;
    }
  });
}

function installGateOnUseOutcomeContract(Engine) {
  const evaluate = Engine.evaluateActionRules;
  Object.defineProperty(Engine, "evaluateActionRules", {
    configurable: true,
    writable: true,
    async value(actor, action = {}) {
      const result = await evaluate.call(this, actor, action);
      const actionType = this.normalizeKey(action?.type ?? "");
      const actionScope = this.normalizeKey(action?.ruleScope ?? "");
      const ownerBlock = actionType === "attaque" && (actionScope === "owner" || actionScope === "self")
        ? result?.matchedRules?.find(entry => entry?.kind === "block_action")
        : null;

      if (ownerBlock) {
        const effectName = String(ownerBlock?.source?.effectName ?? "Effet actif").trim() || "Effet actif";
        ui.notifications?.info?.(`${effectName} est actif : aucune action offensive n'est possible.`);
      }

      for (const gate of result?.gateResults ?? []) {
        if (gate?.kind !== "save_gate" || gate.allowed === false) continue;
        const rule = gate.rule ?? {};
        const onUseWhen = this.normalizeKey(rule.onUseWhen ?? rule.handler?.onUseWhen ?? "failure");
        if (onUseWhen === "always" || onUseWhen === "any" || onUseWhen === "success") continue;
        gate.rule = {
          ...rule,
          onUse: "",
          handler: rule.handler && typeof rule.handler === "object"
            ? { ...rule.handler, onUse: "" }
            : rule.handler
        };
      }
      return result;
    }
  });
}

installSingleReadActionRules(Add2eEffectsEngine);
installGateOnUseOutcomeContract(Add2eEffectsEngine);

globalThis.Add2eEffectsEngine = Add2eEffectsEngine;