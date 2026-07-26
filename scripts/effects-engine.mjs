// ADD2E — Effects Engine.
// Façade publique : les modules installent les règles génériques,
// tandis que les règles raciales strictes sont centralisées dans 50-analysis.mjs.

import { installEffectsEngineCore } from "./effects-engine/00-core.mjs";
import { installEffectsEngineTagsAndFeatures } from "./effects-engine/10-tags-features.mjs";
import { installEffectsEngineDefense } from "./effects-engine/20-defense.mjs";
import { installEffectsEngineDamage } from "./effects-engine/30-resistance-damage.mjs";
import { installEffectsEngineMonk } from "./effects-engine/40-monk.mjs";
import { installEffectsEngineAnalysis } from "./effects-engine/50-analysis.mjs";

globalThis.ADD2E_EFFECTS_ENGINE_VERSION = "2026-07-23-canonical-modifiers-public-normalization-v5";

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
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function add2eTransformationGetProperty(object, path) {
  if (foundry?.utils?.getProperty) return foundry.utils.getProperty(object, path);
  return String(path).split(".").reduce((current, key) => current?.[key], object);
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
  return {
    effect,
    effectId: effect.id ?? null,
    sourceKey: String(meta.sourceKey ?? ""),
    formKey: String(meta.formKey ?? ""),
    category: String(meta.category ?? ""),
    label: String(meta.label ?? effect.name ?? "Transformation"),
    armorClass: add2eTransformationNumber(combat.armorClass ?? combat.ca ?? combat.ac ?? meta.armorClass ?? meta.ca ?? meta.ac),
    thac0: add2eTransformationNumber(combat.thac0 ?? combat.thaco ?? meta.thac0 ?? meta.thaco),
    movement: String(combat.movement ?? meta.movement ?? "").trim(),
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

function add2eCaptureCapabilityTransformationCombatState(actor) {
  const actorSystem = {};
  for (const path of ["system.ca", "system.ca_optimale", "system.ca_naturel", "system.ca_total", "system.thac0", "system.vitesse_deplacement"]) {
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
  const movement = String(profile.movement ?? "").trim();
  const actorUpdate = {};
  if (armorClass !== null) {
    actorUpdate["system.ca"] = armorClass;
    actorUpdate["system.ca_optimale"] = armorClass;
    actorUpdate["system.ca_naturel"] = armorClass;
    actorUpdate["system.ca_total"] = armorClass;
  }
  if (thac0 !== null) actorUpdate["system.thac0"] = thac0;
  if (movement) actorUpdate["system.vitesse_deplacement"] = movement;
  if (Object.keys(actorUpdate).length) await actor.update(actorUpdate, { add2eInternal: true, add2eReason: "capability-transformation-combat-profile" });

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
  if (Object.keys(actorUpdate).length) await actor.update(actorUpdate, { add2eInternal: true, add2eReason: "capability-transformation-combat-restore" });
  const updates = (Array.isArray(snapshot?.classes) ? snapshot.classes : []).filter(entry => entry?.id).map(entry => ({
    _id: entry.id,
    "system.progression": add2eTransformationClone(entry.progression),
    "system.thac0": add2eTransformationClone(entry.thac0)
  }));
  if (updates.length && actor.updateEmbeddedDocuments) await actor.updateEmbeddedDocuments("Item", updates, { add2eInternal: true, add2eReason: "capability-transformation-combat-restore" });
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
globalThis.ADD2E_CAPABILITY_TRANSFORMATIONS_VERSION = "2026-07-07-capability-transformations-v3";
globalThis.add2eGetActiveCapabilityTransformation = add2eGetActiveCapabilityTransformation;
globalThis.add2eGetCapabilityTransformationCombatProfile = add2eGetCapabilityTransformationCombatProfile;
globalThis.add2eCaptureCapabilityTransformationCombatState = add2eCaptureCapabilityTransformationCombatState;
globalThis.add2eApplyCapabilityTransformationCombatProfile = add2eApplyCapabilityTransformationCombatProfile;
globalThis.add2eRestoreCapabilityTransformationCombatState = add2eRestoreCapabilityTransformationCombatState;
globalThis.add2eCaptureCapabilityTransformationWeaponAllowance = add2eCaptureCapabilityTransformationWeaponAllowance;
globalThis.add2eGrantCapabilityTransformationWeaponAllowance = add2eGrantCapabilityTransformationWeaponAllowance;
globalThis.add2eRestoreCapabilityTransformationWeaponAllowance = add2eRestoreCapabilityTransformationWeaponAllowance;
globalThis.add2eIsCapabilityTransformationNaturalAttack = add2eIsCapabilityTransformationNaturalAttack;
globalThis.add2eIsCapabilityTransformationNaturalAttackActive = add2eIsCapabilityTransformationNaturalAttackActive;
