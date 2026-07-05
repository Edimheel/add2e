// ADD2E — Effects Engine.
// Façade publique : les modules installent les règles génériques,
// tandis que les règles raciales strictes sont centralisées dans 50-analysis.mjs.

import { installEffectsEngineCore } from "./effects-engine/00-core.mjs";
import { installEffectsEngineTagsAndFeatures } from "./effects-engine/10-tags-features.mjs";
import { installEffectsEngineDefense } from "./effects-engine/20-defense.mjs";
import { installEffectsEngineDamage } from "./effects-engine/30-resistance-damage.mjs";
import { installEffectsEngineMonk } from "./effects-engine/40-monk.mjs";
import { installEffectsEngineAnalysis } from "./effects-engine/50-analysis.mjs";

globalThis.ADD2E_EFFECTS_ENGINE_VERSION = "2026-07-02-racial-profile-engine-v2";

class Add2eEffectsEngine {}

installEffectsEngineCore(Add2eEffectsEngine);
installEffectsEngineTagsAndFeatures(Add2eEffectsEngine);
installEffectsEngineDefense(Add2eEffectsEngine);
installEffectsEngineDamage(Add2eEffectsEngine);
installEffectsEngineMonk(Add2eEffectsEngine);
installEffectsEngineAnalysis(Add2eEffectsEngine);

function installGenericSaveExtensions(Engine) {
  const baseGetResistanceInfo = Engine.getResistanceInfo?.bind(Engine);
  const baseCheckResistanceDetails = Engine.checkResistanceDetails?.bind(Engine);
  const baseRollActionSave = Engine.rollActionSave?.bind(Engine);

  Object.defineProperties(Engine, {
    getSaveCategory: {
      configurable: true,
      writable: true,
      value(value) {
        const key = this.normalizeTag(value);
        if (!key) return "";
        if (key.includes("peur") || key.includes("fear")) return "peur";
        if (key.includes("poison")) return "poison";
        if (key.includes("baguette") || key.includes("wand") || key.includes("baton") || key.includes("rod") || key.includes("staff")) return "baguettes";
        if (key.includes("petrification") || key.includes("metamorph") || key.includes("transformation")) return "petrification";
        if (key.includes("souffle") || key.includes("breath")) return "souffle";
        if (key.includes("sort") || key.includes("magie") || key.includes("magic") || key.includes("spell")) return "sorts";
        if (key.includes("mort") || key.includes("paralys")) return "mort_paralysie";
        return key;
      }
    },
    getSaveBonusVs: {
      configurable: true,
      writable: true,
      value(actor, vsType) {
        if (!actor || !vsType) return 0;
        const category = this.getSaveCategory(vsType);
        const aliases = {
          peur: ["peur", "fear"],
          poison: ["poison"],
          baguettes: ["baguette", "baguettes", "wand", "rod", "staff", "baton", "batons", "batonnet", "batonnets"],
          petrification: ["petrification", "metamorphose", "transformation"],
          souffle: ["souffle", "breath"],
          sorts: ["sort", "sorts", "sortilege", "sortileges", "spell", "spells", "magie", "magic"],
          mort_paralysie: ["mort", "paralysie", "death"]
        }[category] ?? [this.normalizeTag(vsType)];
        let bonus = 0;
        for (const tag of this.getActiveTags(actor)) {
          if (tag.startsWith("bonus_save:")) {
            bonus += Number(tag.split(":")[1]) || 0;
            continue;
          }
          if (!tag.startsWith("bonus_save_vs:")) continue;
          const [, rawMatcher, rawValue] = tag.split(":");
          if (rawValue === "const") continue;
          const matcher = this.normalizeTag(rawMatcher);
          if (matcher === "tout" || matcher === "all" || aliases.some(alias => matcher === this.normalizeTag(alias))) bonus += Number(rawValue) || 0;
        }
        return bonus;
      }
    },
    getBonusSaveConstitution: {
      configurable: true,
      writable: true,
      value(actor, saveType) {
        const category = this.getSaveCategory(saveType);
        const tags = this.getActiveTags(actor);
        const has = matcher => tags.includes(`bonus_save_vs:${matcher}:const`);
        if (category === "poison" && has("poison")) return this.getConstitutionSaveBonus(actor);
        if (category === "baguettes" && (has("baguette") || has("baguettes") || has("baton") || has("staff"))) return this.getConstitutionSaveBonus(actor);
        if (category === "sorts" && (has("magie") || has("magic") || has("sort") || has("sorts") || has("spell"))) return this.getConstitutionSaveBonus(actor);
        return 0;
      }
    },
    getSaveBonus: {
      configurable: true,
      writable: true,
      value(actor, saveType, options = {}) {
        let bonus = this.getSaveBonusVs(actor, saveType) + this.getBonusSaveConstitution(actor, saveType);
        if (options.frontale === true) bonus += this.getSaveBonusFrontal(actor);
        return bonus;
      }
    },
    getResistanceInfo: {
      configurable: true,
      writable: true,
      value(actor, typeResist) {
        const aliases = this.getResistanceAliases(typeResist);
        const manualTag = this.getActiveTags(actor).find(tag => aliases.some(alias => tag === `resistance:${alias}:manual` || tag === `resistance:${alias}:manuelle`));
        if (manualTag) return { found: false, manual: true, type: String(typeResist ?? ""), matchedType: manualTag.split(":")[1] ?? "", tag: manualTag, pct: 0 };
        return baseGetResistanceInfo?.(actor, typeResist) ?? { found: false, type: String(typeResist ?? ""), matchedType: "", tag: "", pct: 0 };
      }
    },
    checkResistanceDetails: {
      configurable: true,
      writable: true,
      value(actor, typeResist, options = {}) {
        if (this.hasImmunity(actor, typeResist)) {
          const result = { found: true, immunise: true, resiste: true, type: String(typeResist ?? ""), matchedType: this.normalizeTag(typeResist), tag: `immunite:${this.normalizeTag(typeResist)}`, pct: 100, jet: 0, details: `Immunité contre ${typeResist}` };
          globalThis.add2eLastResistanceRoll = result;
          return result;
        }
        return baseCheckResistanceDetails?.(actor, typeResist, options) ?? { found: false, resiste: false, type: String(typeResist ?? ""), matchedType: "", tag: "", pct: 0, jet: 0 };
      }
    },
    rollActionSave: {
      configurable: true,
      writable: true,
      async value(actor, saveType = "sorts", bonus = 0) {
        const racialBonus = this.getSaveBonus(actor, saveType);
        const result = await baseRollActionSave?.(actor, saveType, (Number(bonus) || 0) + racialBonus);
        if (result && typeof result === "object") result.racialBonus = racialBonus;
        return result;
      }
    }
  });
}

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
  const evaluate = Engine.evaluateActionRules?.bind(Engine);
  if (typeof evaluate !== "function") return;
  Object.defineProperty(Engine, "evaluateActionRules", {
    configurable: true,
    writable: true,
    async value(actor, action = {}) {
      const result = await evaluate(actor, action);
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

installGenericSaveExtensions(Add2eEffectsEngine);
installSingleReadActionRules(Add2eEffectsEngine);
installGateOnUseOutcomeContract(Add2eEffectsEngine);

globalThis.Add2eEffectsEngine = Add2eEffectsEngine;
