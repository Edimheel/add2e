// ADD2E — Effects Engine.
// Façade publique : les modules installent les règles génériques,
// tandis que les règles raciales strictes sont centralisées dans 50-analysis.mjs.

import { installEffectsEngineCore } from "./effects-engine/00-core.mjs";
import { installEffectsEngineTagsAndFeatures } from "./effects-engine/10-tags-features.mjs";
import { installEffectsEngineDefense } from "./effects-engine/20-defense.mjs";
import { installEffectsEngineDamage } from "./effects-engine/30-resistance-damage.mjs";
import { installEffectsEngineMonk } from "./effects-engine/40-monk.mjs";
import { installEffectsEngineAnalysis } from "./effects-engine/50-analysis.mjs";

globalThis.ADD2E_EFFECTS_ENGINE_VERSION = "2026-07-05-racial-profile-engine-v3";

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

function add2eRacialChatEscape(value) {
  try { return foundry.utils.escapeHTML(String(value ?? "")); } catch {}
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function add2eRacialActorCandidates() {
  const candidates = [
    ...(canvas?.tokens?.placeables ?? []).map(token => token?.actor),
    ...Array.from(game?.actors ?? []),
    game?.user?.character ?? null
  ].filter(Boolean);
  return [...new Map(candidates.map(actor => [actor.uuid ?? actor.id, actor])).values()];
}

function add2eRacialActorFromHud() {
  const actorId = String(globalThis.add2eHudCheck?.()?.actorId ?? "").trim();
  if (actorId) {
    const tokenActor = (canvas?.tokens?.controlled ?? []).find(token => token?.actor?.id === actorId)?.actor
      ?? (canvas?.tokens?.placeables ?? []).find(token => token?.actor?.id === actorId)?.actor
      ?? null;
    return tokenActor ?? game?.actors?.get?.(actorId) ?? null;
  }
  return (canvas?.tokens?.controlled ?? []).length === 1
    ? canvas.tokens.controlled[0]?.actor ?? null
    : game?.user?.character ?? null;
}

function add2eRacialActorFromControl(control) {
  if (control?.matches?.("[data-add2e-hud-racial-action][data-racial-capability-id]")) {
    const hudActor = add2eRacialActorFromHud();
    if (hudActor) return hudActor;
  }

  for (const actor of add2eRacialActorCandidates()) {
    for (const app of Object.values(actor?.apps ?? {})) {
      const root = app?.element?.jquery ? app.element[0] : app?.element;
      if (root && (root === control || root.contains?.(control))) return actor;
    }
  }
  return null;
}

function add2eCanUseRacialCapability(actor) {
  return game?.user?.isGM === true
    || actor?.isOwner === true
    || actor?.testUserPermission?.(game?.user, "OWNER") === true;
}

async function add2eCreateRacialVisionChat(actor, capability, enabled) {
  const color = enabled ? "#176a70" : "#6c5350";
  const background = enabled ? "#eefafa" : "#f7f1ef";
  const state = enabled ? "Activée" : "Désactivée";
  const content = `<div class="add2e-card-racial" style="border:2px solid ${color};border-radius:12px;padding:10px;background:${background};color:#24180f;font-family:var(--font-primary);">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;"><i class="fas ${add2eRacialChatEscape(capability?.iconClass || "fa-eye")}" style="font-size:1.55em;color:${color};"></i><strong style="font-size:1.08em;color:${color};">${add2eRacialChatEscape(capability?.label || "Capacité raciale")}</strong><span style="margin-left:auto;font-weight:900;">Capacité raciale</span></div>
    <div>État : <strong style="color:${color};">${state}</strong></div>
    ${capability?.description ? `<div style="margin-top:6px;font-size:.9em;line-height:1.35;">${add2eRacialChatEscape(capability.description)}</div>` : ""}
  </div>`;
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
    flags: {
      add2e: {
        racialCapability: {
          actorId: actor?.id ?? "",
          raceSourceId: capability?.sourceId ?? "",
          capabilityId: capability?.id ?? "infravision",
          action: "vision-toggle",
          enabled: enabled === true
        }
      }
    }
  });
}

async function add2eUseUniformRacialCapability(actor, capabilityId, sheet = null) {
  const Engine = globalThis.Add2eEffectsEngine;
  const id = String(capabilityId ?? "").trim();
  if (!actor || !Engine || !id) return false;
  if (!add2eCanUseRacialCapability(actor)) {
    ui.notifications?.warn?.("Vous ne pouvez pas utiliser les capacités de cet acteur.");
    return false;
  }

  const capability = Engine.getRacialAction?.(actor, id);
  if (!capability) {
    ui.notifications?.warn?.("Capacité raciale introuvable.");
    return false;
  }

  if (capability.actionType === "vision-toggle") {
    const enabled = capability.enabled !== true;
    const outcome = await Engine.setRacialVision?.(actor, enabled, { reason: "racial-capability-uniform-chat" });
    if (!outcome || outcome.reason === "missing-actor") {
      ui.notifications?.error?.("Impossible de modifier l’infravision raciale.");
      return false;
    }
    await add2eCreateRacialVisionChat(actor, capability, enabled);
    await sheet?.render?.(false);
    await globalThis.add2eRefreshActionHud?.();
    return true;
  }

  const rollCapability = globalThis.add2eRollRacialCapability;
  if (typeof rollCapability !== "function") {
    ui.notifications?.error?.("Le moteur des capacités raciales n’est pas chargé.");
    return false;
  }

  const result = await rollCapability(actor, capability.id);
  if (!result?.ok) {
    ui.notifications?.error?.("Le jet de capacité raciale n’a pas pu être résolu.");
    return false;
  }
  return true;
}

function installRacialCapabilityChatBridge() {
  if (globalThis.__ADD2E_RACIAL_CAPABILITY_CHAT_BRIDGE_V1) return;
  globalThis.__ADD2E_RACIAL_CAPABILITY_CHAT_BRIDGE_V1 = true;

  globalThis.add2eUseRacialCapabilityFromElement = async (actor, element, sheet = null) => {
    const capabilityId = String(element?.dataset?.racialCapabilityId ?? "").trim();
    return add2eUseUniformRacialCapability(actor, capabilityId, sheet);
  };

  document.addEventListener("click", event => {
    const target = event.target instanceof Element ? event.target : null;
    const control = target?.closest?.(".add2e-racial-capability-use[data-racial-capability-id], [data-add2e-hud-racial-action='use'][data-racial-capability-id]");
    if (!control) return;

    const actor = add2eRacialActorFromControl(control);
    if (!actor) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    void add2eUseUniformRacialCapability(actor, control.dataset.racialCapabilityId, null);
  }, true);
}

installGenericSaveExtensions(Add2eEffectsEngine);
installSingleReadActionRules(Add2eEffectsEngine);
installGateOnUseOutcomeContract(Add2eEffectsEngine);

globalThis.Add2eEffectsEngine = Add2eEffectsEngine;
Hooks.once("ready", installRacialCapabilityChatBridge);
