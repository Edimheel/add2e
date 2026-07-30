// ADD2E — Effects Engine.
// Façade publique : les modules installent les règles génériques,
// tandis que les règles raciales strictes sont centralisées dans 50-analysis.mjs.

import { installEffectsEngineCore } from "./effects-engine/00-core.mjs";
import { installEffectsEngineTagsAndFeatures } from "./effects-engine/10-tags-features.mjs";
import { installEffectsEngineDefense } from "./effects-engine/20-defense.mjs";
import { installEffectsEngineDamage } from "./effects-engine/30-resistance-damage.mjs";
import { installEffectsEngineMonk } from "./effects-engine/40-monk.mjs";
import { installEffectsEngineAnalysis } from "./effects-engine/50-analysis.mjs";

globalThis.ADD2E_EFFECTS_ENGINE_VERSION = "2026-07-30-canonical-transformation-movement-v6";

class Add2eEffectsEngine {}

installEffectsEngineCore(Add2eEffectsEngine);
installEffectsEngineTagsAndFeatures(Add2eEffectsEngine);
installEffectsEngineDefense(Add2eEffectsEngine);
installEffectsEngineDamage(Add2eEffectsEngine);
installEffectsEngineMonk(Add2eEffectsEngine);
installEffectsEngineAnalysis(Add2eEffectsEngine);

function installPublicNormalizationContract(Engine) {
  Object.defineProperty(Engine, "normalizeKey", {
    configurable: true,
    writable: true,
    value(value) {
      return this.normalizeTag(value).replace(/s$/, "");
    }
  });
}

function installPassiveClassFeatureContract(Engine) {
  const baseNormalizeClassFeature = Engine.normalizeClassFeature?.bind(Engine);

  Object.defineProperties(Engine, {
    isClassFeaturePassive: {
      configurable: true,
      writable: true,
      value(feature) {
        if (!feature || typeof feature !== "object") return false;
        const type = this.normalizeKey(feature.type ?? feature.kind ?? feature.category ?? "");
        const hasOnUse = Boolean(String(feature.on_use ?? feature.onUse ?? feature.onUseScript ?? feature.script ?? "").trim());
        if (feature.activable === true || feature.active === true || hasOnUse) return false;
        if (["active", "activable", "action", "capacite_active"].includes(type)) return false;
        if (feature.passive === false) return false;
        if (feature.passive === true) return true;
        if (["passive", "rule", "regle", "always_on", "permanent"].includes(type)) return true;
        return true;
      }
    },

    classFeatureStableId: {
      configurable: true,
      writable: true,
      value(feature, index = 0) {
        const raw = feature?.id
          ?? feature?._id
          ?? feature?.key
          ?? feature?.slug
          ?? feature?.flags?.add2e?.id
          ?? feature?.flags?.add2e?.key
          ?? feature?.name
          ?? feature?.label
          ?? feature?.title
          ?? feature?.nom
          ?? `feature-${index + 1}`;
        return this.normalizeTag(raw).replace(/-/g, "_").replace(/_+/g, "_") || `feature_${index + 1}`;
      }
    },

    addClassFeatureTagsInto: {
      configurable: true,
      writable: true,
      value(dst, raw, level = null) {
        const classLevel = Number(level);
        if (!Number.isFinite(classLevel) || classLevel < 1) return;
        const entries = Array.isArray(raw) ? raw : (raw && typeof raw === "object" ? Object.values(raw) : []);
        for (const feature of entries) {
          if (!this.isClassFeaturePassive(feature) || !this.isClassFeatureUnlocked(feature, classLevel)) continue;
          for (const value of [
            feature.tags, feature.tag, feature.effectTags, feature.effets,
            feature.effects, feature.flags?.add2e?.tags, feature.flags?.add2e?.effectTags
          ]) this.addTagsInto(dst, value);
        }
      }
    },

    normalizeClassFeature: {
      configurable: true,
      writable: true,
      value(feature, source = {}) {
        const normalized = baseNormalizeClassFeature
          ? baseNormalizeClassFeature(feature, source)
          : {
              ...foundry.utils.deepClone(feature),
              minLevel: this.classFeatureMinLevel(feature),
              maxLevel: this.classFeatureMaxLevel(feature),
              available: true,
              activable: feature?.activable === true,
              ...source
            };
        return {
          ...normalized,
          passive: this.isClassFeaturePassive(feature)
        };
      }
    },

    getClassFeaturePassiveRules: {
      configurable: true,
      writable: true,
      value(actor) {
        const rules = [];
        const represented = new Set();
        const effects = actor?.effects?.contents ?? actor?.effects ?? [];
        for (const effect of effects) {
          if (!effect || effect.disabled || effect.flags?.add2e?.autoClassPassiveEffect !== true) continue;
          const passiveKey = String(effect.flags?.add2e?.passiveKey ?? "").trim();
          const sourceItemId = String(effect.flags?.add2e?.sourceItemId ?? "").trim();
          const featureId = String(effect.flags?.add2e?.classFeatureId ?? "").trim();
          const key = passiveKey || (sourceItemId && featureId ? `${sourceItemId}|${featureId}` : "");
          if (key) represented.add(key);
        }

        const features = this.getUnlockedClassFeatures(actor);
        features.forEach((feature, index) => {
          if (!this.isClassFeaturePassive(feature)) return;
          const featureId = this.classFeatureStableId(feature, index);
          const sourceItemId = feature?._add2eClassItemId ?? null;
          const passiveKey = sourceItemId ? `${sourceItemId}|${featureId}` : "";
          if (passiveKey && represented.has(passiveKey)) return;

          const raws = [feature?.rules, feature?.flags?.add2e?.rules];
          for (const raw of raws) {
            for (const rule of this.toRules(raw)) {
              rules.push({
                ...rule,
                source: {
                  ...(rule?.source && typeof rule.source === "object" ? rule.source : {}),
                  feature,
                  featureId,
                  featureName: feature?.name ?? feature?.label ?? feature?.title ?? "Capacité de classe",
                  classItemId: sourceItemId,
                  classItemUuid: feature?._add2eClassItemUuid ?? null,
                  className: feature?._add2eClassName ?? null,
                  classLevel: Number(feature?._add2eClassLevel) || Number(feature?.minLevel) || null,
                  actor
                }
              });
            }
          }
        });
        return rules;
      }
    }
  });
}

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
        const applies = (category === "poison" && has("poison"))
          || (category === "baguettes" && (has("baguette") || has("baguettes") || has("baton") || has("staff")))
          || (category === "sorts" && (has("magie") || has("magic") || has("sort") || has("sorts") || has("spell")));
        if (!applies) return 0;
        if (typeof this.resolveAbilityDerived !== "function") {
          throw new Error("Le résolveur canonique ADD2E de Constitution est indisponible pour les sauvegardes.");
        }
        const constitution = this.resolveAbilityDerived(actor, "constitution", {
          domain: "saving-throw",
          type: category,
          source: "racial-constitution-save",
          consumer: "effects-engine"
        });
        return Math.max(0, Math.min(5, Math.floor((Number(constitution?.total) || 0) / 3.5)));
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
              ...(rule?.source && typeof rule.source === "object" ? rule.source : {}),
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

function add2eTransformationArray(value) {
  if (Array.isArray(value)) return value;
  if (value?.contents) return Array.from(value.contents);
  if (typeof value?.values === "function") return Array.from(value.values());
  return value ? Array.from(value) : [];
}

function add2eTransformationClone(value) {
  if (value === undefined || value === null) return value;
  if (foundry?.utils?.deepClone) return foundry.utils.deepClone(value);
  if (foundry?.utils?.duplicate) return foundry.utils.duplicate(value);
  return JSON.parse(JSON.stringify(value));
}

function add2eTransformationNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  if (value && typeof value === "object") {
    for (const key of ["value", "total", "current", "actuel", "base", "speed", "movement", "vitesse"]) {
      const nested = add2eTransformationNumber(value?.[key]);
      if (nested !== null) return nested;
    }
    return null;
  }
  const match = String(value).replace(/,/g, ".").match(/[+\-]?\d+(?:\.\d+)?/);
  const number = match ? Number(match[0]) : NaN;
  return Number.isFinite(number) ? number : null;
}

function add2eTransformationGetProperty(object, path) {
  if (foundry?.utils?.getProperty) return foundry.utils.getProperty(object, path);
  return String(path).split(".").reduce((current, key) => current?.[key], object);
}

function add2eTransformationKey(value) {
  return String(value ?? "")
    .trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function add2eTransformationMeta(document) {
  const meta = document?.flags?.add2e?.capabilityTransformation;
  return meta && typeof meta === "object" ? meta : null;
}

function add2eTransformationActiveEffects(actor, sourceKey = null) {
  const requested = sourceKey === null || sourceKey === undefined ? "" : String(sourceKey).trim();
  return add2eTransformationArray(actor?.effects)
    .filter(effect => effect?.disabled !== true)
    .filter(effect => {
      const meta = add2eTransformationMeta(effect);
      return meta?.kind === "form" && String(meta.sourceKey ?? "").trim() && (!requested || meta.sourceKey === requested);
    })
    .sort((left, right) => {
      const leftTick = add2eTransformationNumber(add2eTransformationMeta(left)?.activatedAtTick) ?? -1;
      const rightTick = add2eTransformationNumber(add2eTransformationMeta(right)?.activatedAtTick) ?? -1;
      return rightTick - leftTick || String(right?.id ?? "").localeCompare(String(left?.id ?? ""));
    });
}

function add2eGetActiveCapabilityTransformation(actor, options = {}) {
  return add2eTransformationActiveEffects(actor, options?.sourceKey)[0] ?? null;
}

function add2eGetCapabilityTransformationCombatProfile(actor, options = {}) {
  const effect = add2eGetActiveCapabilityTransformation(actor, options);
  if (!effect) return null;
  const meta = add2eTransformationMeta(effect) ?? {};
  const combat = meta.combat && typeof meta.combat === "object" ? meta.combat : {};
  const movementProfile = add2eTransformationClone(combat.movement ?? meta.movement ?? null);
  const movement = movementProfile && typeof movementProfile === "object"
    ? String(movementProfile.ground ?? movementProfile.sol ?? movementProfile.value ?? movementProfile.speed ?? movementProfile.vitesse ?? "").trim()
    : String(movementProfile ?? "").trim();
  return {
    effect,
    effectId: effect.id ?? null,
    sourceKey: String(meta.sourceKey ?? ""),
    formKey: String(meta.formKey ?? ""),
    category: String(meta.category ?? ""),
    label: String(meta.label ?? effect.name ?? "Transformation"),
    armorClass: add2eTransformationNumber(combat.armorClass ?? combat.ca ?? combat.ac ?? meta.armorClass ?? meta.ca ?? meta.ac),
    thac0: add2eTransformationNumber(combat.thac0 ?? combat.thaco ?? meta.thac0 ?? meta.thaco),
    movement,
    movementProfile,
    movementMode: String(combat.movementMode ?? combat.modeDeplacement ?? meta.movementMode ?? meta.modeDeplacement ?? ""),
    size: combat.size ?? combat.taille ?? meta.size ?? meta.taille ?? null,
    raw: meta
  };
}

function add2eTransformationClassItems(actor) {
  return add2eTransformationArray(actor?.items).filter(item => String(item?.type ?? "").toLowerCase() === "classe");
}

function add2eTransformationClassLevel(actor, classItem) {
  const system = classItem?.system ?? {};
  const key = String(system.slug ?? system.label ?? system.nom ?? system.name ?? classItem?.name ?? "")
    .trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const level = Number(actor?.system?.niveaux_par_classe?.[key] ?? system.niveau ?? system.level ?? actor?.system?.niveau ?? 1);
  return Math.max(1, Math.floor(Number.isFinite(level) ? level : 1));
}

function add2eTransformationTagList(value) {
  if (Array.isArray(value)) return value.map(entry => String(entry ?? "").trim()).filter(Boolean);
  if (typeof value === "string") return value.split(/[,;|\n]+/g).map(entry => entry.trim()).filter(Boolean);
  return [];
}

function add2eTransformationMergeTags(existing, additions) {
  const result = [...add2eTransformationTagList(existing)];
  for (const raw of additions) {
    const tag = String(raw ?? "").trim();
    if (tag && !result.some(value => value.toLowerCase() === tag.toLowerCase())) result.push(tag);
  }
  return result;
}

const ADD2E_TRANSFORMATION_MOVEMENT_TARGETS = Object.freeze({
  ground: "ground", sol: "ground", terrestre: "ground", marche: "ground",
  flight: "flight", fly: "flight", vol: "flight", aerien: "flight", aerienne: "flight",
  ascent: "ascent", montee: "ascent", monter: "ascent",
  descent: "descent", descente: "descent", descendre: "descent",
  vertical: "vertical", levitation: "vertical",
  underwater: "underwater", sous_eau: "underwater", aquatique: "underwater",
  swim: "swim", nage: "swim", nager: "swim"
});

function add2eTransformationMovementTarget(value, fallback = "ground") {
  return ADD2E_TRANSFORMATION_MOVEMENT_TARGETS[add2eTransformationKey(value)] ?? fallback;
}

function add2eTransformationMovementEntries(profile = {}) {
  const raw = profile.movement ?? profile.vitesse ?? profile.speed ?? null;
  const explicitTarget = add2eTransformationMovementTarget(
    profile.movementTarget ?? profile.movementMode ?? profile.modeDeplacement ?? profile.travelMode ?? profile.mode,
    "ground"
  );
  const entries = [];
  const push = (target, value) => {
    const speed = add2eTransformationNumber(value);
    if (speed === null || speed < 0) return;
    entries.push({ target: add2eTransformationMovementTarget(target, explicitTarget), value: speed });
  };

  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const [key, value] of Object.entries(raw)) {
      if (["mode", "target", "type", "label", "unit", "unite"].includes(add2eTransformationKey(key))) continue;
      const target = ADD2E_TRANSFORMATION_MOVEMENT_TARGETS[add2eTransformationKey(key)];
      if (target) push(target, value);
    }
    if (!entries.length) push(raw.target ?? raw.mode ?? explicitTarget, raw.value ?? raw.speed ?? raw.vitesse ?? raw.movement);
  } else push(explicitTarget, raw);

  const unique = new Map();
  for (const entry of entries) unique.set(entry.target, entry);
  return [...unique.values()];
}

function add2eTransformationMovementModifier(effect, meta, entry, profile = {}) {
  const sourceKey = String(meta?.sourceKey ?? effect?.id ?? "transformation");
  const formKey = String(meta?.formKey ?? profile.formKey ?? profile.form ?? "");
  const size = profile.size ?? profile.taille ?? meta?.size ?? meta?.taille ?? null;
  return {
    id: `transformation:${sourceKey}:movement:${entry.target}`,
    domain: "movement",
    target: entry.target,
    operation: "set",
    value: entry.value,
    priority: Math.max(1, Number(profile.movementPriority ?? profile.priority) || 260),
    stacking: { mode: "exclusive", group: `transformation-movement:${entry.target}` },
    conditions: { active: true },
    metadata: {
      label: String(profile.label ?? meta?.label ?? effect?.name ?? "Transformation"),
      producer: "capability-transformation",
      movementMode: entry.target,
      modes: [entry.target],
      transformation: formKey || null,
      size,
      ignoresEncumbrance: profile.ignoreEncumbrance === true || profile.ignoresEncumbrance === true
    }
  };
}

async function add2eApplyCapabilityTransformationMovementProfile(actor, profile = {}) {
  const sourceKey = String(profile.sourceKey ?? profile.key ?? "").trim();
  const explicitEffect = profile.effect?.document ?? profile.effect ?? null;
  const effect = explicitEffect?.parent === actor
    ? explicitEffect
    : add2eGetActiveCapabilityTransformation(actor, sourceKey ? { sourceKey } : {});
  const entries = add2eTransformationMovementEntries(profile);
  if (!effect?.update) {
    if (!entries.length) return { applied: false, effect: null, modifiers: [] };
    throw new Error("La transformation active est introuvable pour matérialiser son mouvement canonique.");
  }
  const meta = add2eTransformationClone(add2eTransformationMeta(effect) ?? {});
  const existing = add2eTransformationArray(effect.flags?.add2e?.modifiers)
    .filter(modifier => !(
      add2eTransformationKey(modifier?.domain) === "movement"
      && add2eTransformationKey(modifier?.metadata?.producer) === "capability_transformation"
    ));
  const modifiers = entries.map(entry => add2eTransformationMovementModifier(effect, meta, entry, profile));
  const oldMovementTags = new Set([
    "mouvement:ground", "mouvement:flight", "mouvement:ascent", "mouvement:descent",
    "mouvement:vertical", "mouvement:underwater", "mouvement:swim"
  ]);
  const retainedTags = add2eTransformationTagList(effect.flags?.add2e?.tags)
    .filter(tag => !oldMovementTags.has(add2eTransformationKey(tag).replace(/^mouvement_/, "mouvement:")));
  const tags = add2eTransformationMergeTags(retainedTags, [
    "transformation",
    meta.formKey ? `forme:${meta.formKey}` : "",
    profile.size ?? profile.taille ?? meta.size ?? meta.taille ? `taille:${profile.size ?? profile.taille ?? meta.size ?? meta.taille}` : "",
    ...entries.map(entry => `mouvement:${entry.target}`)
  ].filter(Boolean));
  meta.movement = add2eTransformationClone(profile.movement ?? profile.vitesse ?? profile.speed ?? null);
  meta.movementModes = entries.map(entry => entry.target);
  if (profile.size ?? profile.taille) meta.size = profile.size ?? profile.taille;
  await effect.update({
    "flags.add2e.capabilityTransformation": meta,
    "flags.add2e.modifiers": [...existing, ...modifiers],
    "flags.add2e.tags": tags,
    "flags.add2e.effectTags": tags
  }, { add2eInternal: true, add2eReason: "capability-transformation-canonical-movement", render: false });
  await globalThis.add2eRecalcMoveXp?.(actor, { mode: "movement" });
  return { applied: modifiers.length > 0, effect, modifiers };
}

function add2eCaptureCapabilityTransformationCombatState(actor) {
  const actorSystem = {};
  for (const path of ["system.ca", "system.ca_optimale", "system.ca_naturel", "system.ca_total", "system.thac0"]) {
    actorSystem[path] = add2eTransformationClone(add2eTransformationGetProperty(actor, path));
  }
  const classes = add2eTransformationClassItems(actor).map(item => ({
    id: item.id,
    progression: add2eTransformationClone(item?.system?.progression),
    thac0: add2eTransformationClone(item?.system?.thac0)
  })).filter(entry => entry.id);
  return { actorSystem, classes };
}

async function add2eApplyCapabilityTransformationCombatProfile(actor, profile = {}) {
  if (!actor?.update) return false;
  const armorClass = add2eTransformationNumber(profile.armorClass ?? profile.ca ?? profile.ac);
  const thac0 = add2eTransformationNumber(profile.thac0 ?? profile.thaco);
  const actorUpdate = {};
  if (armorClass !== null) {
    actorUpdate["system.ca"] = armorClass;
    actorUpdate["system.ca_optimale"] = armorClass;
    actorUpdate["system.ca_naturel"] = armorClass;
    actorUpdate["system.ca_total"] = armorClass;
  }
  if (thac0 !== null) actorUpdate["system.thac0"] = thac0;
  if (Object.keys(actorUpdate).length) await actor.update(actorUpdate, { add2eInternal: true, add2eReason: "capability-transformation-combat-profile" });

  await add2eApplyCapabilityTransformationMovementProfile(actor, profile);

  if (thac0 === null || !actor.updateEmbeddedDocuments) return true;
  const updates = [];
  for (const classItem of add2eTransformationClassItems(actor)) {
    const progression = Array.isArray(classItem?.system?.progression) ? add2eTransformationClone(classItem.system.progression) : [];
    const level = add2eTransformationClassLevel(actor, classItem);
    const index = progression.findIndex(row => Number(row?.niveau ?? row?.level) === level);
    const rowIndex = index >= 0 ? index : (level - 1 < progression.length ? level - 1 : -1);
    if (rowIndex < 0 || !progression[rowIndex] || typeof progression[rowIndex] !== "object") continue;
    progression[rowIndex] = { ...progression[rowIndex], thac0 };
    updates.push({ _id: classItem.id, "system.progression": progression, "system.thac0": thac0 });
  }
  if (updates.length) await actor.updateEmbeddedDocuments("Item", updates, { add2eInternal: true, add2eReason: "capability-transformation-combat-profile" });
  return true;
}

async function add2eRestoreCapabilityTransformationCombatState(actor, snapshot = {}) {
  if (!actor?.update) return false;
  const actorUpdate = snapshot?.actorSystem && typeof snapshot.actorSystem === "object" ? snapshot.actorSystem : {};
  delete actorUpdate["system.vitesse_deplacement"];
  delete actorUpdate["system.movement"];
  delete actorUpdate["system.mouvement"];
  if (Object.keys(actorUpdate).length) await actor.update(actorUpdate, { add2eInternal: true, add2eReason: "capability-transformation-combat-restore" });
  const updates = (Array.isArray(snapshot?.classes) ? snapshot.classes : []).filter(entry => entry?.id).map(entry => ({
    _id: entry.id,
    "system.progression": add2eTransformationClone(entry.progression),
    "system.thac0": add2eTransformationClone(entry.thac0)
  }));
  if (updates.length && actor.updateEmbeddedDocuments) await actor.updateEmbeddedDocuments("Item", updates, { add2eInternal: true, add2eReason: "capability-transformation-combat-restore" });
  await globalThis.add2eRecalcMoveXp?.(actor, { mode: "movement" });
  return true;
}

function add2eCaptureCapabilityTransformationWeaponAllowance(actor) {
  return add2eTransformationClassItems(actor).map(item => {
    const system = item?.system ?? {};
    return {
      id: item.id,
      hasArmesAutorisees: Object.prototype.hasOwnProperty.call(system, "armes_autorisees"),
      hasWeaponsAllowed: Object.prototype.hasOwnProperty.call(system, "weaponsAllowed"),
      hasWeaponRestriction: Object.prototype.hasOwnProperty.call(system, "weaponRestriction"),
      armesAutorisees: add2eTransformationClone(system.armes_autorisees),
      weaponsAllowed: add2eTransformationClone(system.weaponsAllowed),
      weaponRestriction: add2eTransformationClone(system.weaponRestriction)
    };
  }).filter(entry => entry.id);
}

async function add2eGrantCapabilityTransformationWeaponAllowance(actor, tags = []) {
  if (!actor?.updateEmbeddedDocuments) return false;
  const additions = add2eTransformationArray(tags).map(value => String(value ?? "").trim()).filter(Boolean);
  const allowed = add2eTransformationMergeTags([], [...additions, ...additions.map(tag => tag.includes(":") ? tag : `type_arme:${tag}`)]);
  if (!allowed.length) return true;

  const updates = [];
  for (const classItem of add2eTransformationClassItems(actor)) {
    const system = classItem.system ?? {};
    const update = {
      _id: classItem.id,
      "system.armes_autorisees": add2eTransformationMergeTags(system.armes_autorisees, allowed),
      "system.weaponsAllowed": add2eTransformationMergeTags(system.weaponsAllowed, allowed)
    };
    const restriction = system.weaponRestriction && typeof system.weaponRestriction === "object" ? add2eTransformationClone(system.weaponRestriction) : null;
    const tagMode = restriction && (
      add2eTransformationTagList(restriction.allowedTags).length > 0 ||
      add2eTransformationTagList(restriction.forbiddenTags).length > 0 ||
      String(restriction.mode ?? "").toLowerCase().includes("tag")
    );
    if (tagMode) {
      restriction.alwaysAllowedTags = add2eTransformationMergeTags(restriction.alwaysAllowedTags, allowed);
      update["system.weaponRestriction"] = restriction;
    }
    updates.push(update);
  }
  if (updates.length) await actor.updateEmbeddedDocuments("Item", updates, { add2eInternal: true, add2eReason: "capability-transformation-weapon-allowance" });
  return true;
}

async function add2eRestoreCapabilityTransformationWeaponAllowance(actor, snapshot = []) {
  if (!actor?.updateEmbeddedDocuments) return false;
  const updates = [];
  for (const entry of Array.isArray(snapshot) ? snapshot : []) {
    if (!entry?.id) continue;
    const update = { _id: entry.id };
    if (entry.hasArmesAutorisees === false) update["system.-=armes_autorisees"] = null;
    else update["system.armes_autorisees"] = add2eTransformationClone(entry.armesAutorisees);
    if (entry.hasWeaponsAllowed === false) update["system.-=weaponsAllowed"] = null;
    else update["system.weaponsAllowed"] = add2eTransformationClone(entry.weaponsAllowed);
    if (entry.hasWeaponRestriction === false) update["system.-=weaponRestriction"] = null;
    else if (Object.prototype.hasOwnProperty.call(entry, "weaponRestriction")) update["system.weaponRestriction"] = add2eTransformationClone(entry.weaponRestriction);
    updates.push(update);
  }
  if (updates.length) await actor.updateEmbeddedDocuments("Item", updates, { add2eInternal: true, add2eReason: "capability-transformation-weapon-allowance-restore" });
  return true;
}

function add2eIsCapabilityTransformationNaturalAttack(item) {
  const meta = add2eTransformationMeta(item);
  return !!(meta?.kind === "natural-attack" && String(meta?.sourceKey ?? "").trim());
}

function add2eIsCapabilityTransformationNaturalAttackActive(actor, item) {
  if (!add2eIsCapabilityTransformationNaturalAttack(item)) return false;
  const attack = add2eTransformationMeta(item) ?? {};
  const effect = add2eGetActiveCapabilityTransformation(actor, { sourceKey: attack.sourceKey });
  if (!effect) return false;
  const formKey = String(add2eTransformationMeta(effect)?.formKey ?? "").trim();
  const attackFormKey = String(attack.formKey ?? "").trim();
  return !formKey || !attackFormKey || formKey === attackFormKey;
}

installPublicNormalizationContract(Add2eEffectsEngine);
installPassiveClassFeatureContract(Add2eEffectsEngine);
installGenericSaveExtensions(Add2eEffectsEngine);
installSingleReadActionRules(Add2eEffectsEngine);
installGateOnUseOutcomeContract(Add2eEffectsEngine);

globalThis.Add2eEffectsEngine = Add2eEffectsEngine;
globalThis.ADD2E_CAPABILITY_TRANSFORMATIONS_VERSION = "2026-07-30-canonical-transformation-movement-v4";
globalThis.add2eGetActiveCapabilityTransformation = add2eGetActiveCapabilityTransformation;
globalThis.add2eGetCapabilityTransformationCombatProfile = add2eGetCapabilityTransformationCombatProfile;
globalThis.add2eCaptureCapabilityTransformationCombatState = add2eCaptureCapabilityTransformationCombatState;
globalThis.add2eApplyCapabilityTransformationMovementProfile = add2eApplyCapabilityTransformationMovementProfile;
globalThis.add2eApplyCapabilityTransformationCombatProfile = add2eApplyCapabilityTransformationCombatProfile;
globalThis.add2eRestoreCapabilityTransformationCombatState = add2eRestoreCapabilityTransformationCombatState;
globalThis.add2eCaptureCapabilityTransformationWeaponAllowance = add2eCaptureCapabilityTransformationWeaponAllowance;
globalThis.add2eGrantCapabilityTransformationWeaponAllowance = add2eGrantCapabilityTransformationWeaponAllowance;
globalThis.add2eRestoreCapabilityTransformationWeaponAllowance = add2eRestoreCapabilityTransformationWeaponAllowance;
globalThis.add2eIsCapabilityTransformationNaturalAttack = add2eIsCapabilityTransformationNaturalAttack;
globalThis.add2eIsCapabilityTransformationNaturalAttackActive = add2eIsCapabilityTransformationNaturalAttackActive;
