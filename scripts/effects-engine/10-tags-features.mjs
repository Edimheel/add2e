// ADD2E — Effects Engine / tags, capacités et résistances générales.
// Les règles d'action restent génériques : aucun sort n'est nommé ici.

import {
  classItems as add2eCanonicalClassItems,
  classProgression as add2eCanonicalClassProgression,
  classSlug as add2eCanonicalClassSlug,
  raceItem as add2eCanonicalRaceItem,
  raceSlug as add2eCanonicalRaceSlug
} from "../add2e/17b-multiclass-core.mjs";

const register = (Engine, methods) => Object.defineProperties(
  Engine,
  Object.fromEntries(Object.entries(methods).map(([name, value]) => [
    name,
    { value, configurable: true, writable: true }
  ]))
);

export function installEffectsEngineTagsAndFeatures(Engine) {
  register(Engine, {
    addClassFeatureTagsInto(dst, raw, level = null) {
      const classLevel = Number(level);
      if (!Number.isFinite(classLevel) || classLevel < 1) return;
      if (!Array.isArray(raw)) return;
      for (const feature of raw) {
        if (!this.isClassFeatureUnlocked(feature, classLevel)) continue;
        this.addTagsInto(dst, feature.tags);
      }
    },

    classFeatureMinLevel(feature) {
      const value = Number(feature?.minLevel);
      if (!Number.isFinite(value) || value < 1) {
        throw new Error(`Capacité de classe « ${feature?.name ?? "inconnue"} » sans minLevel canonique.`);
      }
      return Math.floor(value);
    },

    classFeatureMaxLevel(feature) {
      const raw = feature?.maxLevel;
      if (raw === undefined || raw === null || raw === "") return null;
      const value = Number(raw);
      if (!Number.isFinite(value) || value < 1) {
        throw new Error(`Capacité de classe « ${feature?.name ?? "inconnue"} » avec maxLevel canonique invalide.`);
      }
      return Math.floor(value);
    },

    isClassFeatureUnlocked(feature, level) {
      if (!feature || typeof feature !== "object") return false;
      const min = this.classFeatureMinLevel(feature);
      const max = this.classFeatureMaxLevel(feature);
      return level >= min && (max === null || level <= max);
    },

    getEmbeddedClassItems(actor) {
      return add2eCanonicalClassItems(actor);
    },

    getEmbeddedClassLevel(item) {
      if (!item) return null;
      const progression = add2eCanonicalClassProgression(item);
      return progression.hasLevel ? progression.level : null;
    },

    normalizeClassFeature(feature, source = {}) {
      const name = String(feature?.name ?? "").trim();
      if (!name) throw new Error("Capacité de classe sans name canonique.");
      return {
        ...foundry.utils.deepClone(feature),
        name,
        minLevel: this.classFeatureMinLevel(feature),
        maxLevel: this.classFeatureMaxLevel(feature),
        available: true,
        activable: feature?.activable === true,
        ...source
      };
    },

    isClassFeatureActivable(feature) {
      return feature?.activable === true;
    },

    getUnlockedClassFeatures(actor) {
      if (!actor) return [];
      const out = [];
      const embeddedClasses = this.getEmbeddedClassItems(actor);
      const push = (raw, level, source = {}) => {
        const classLevel = Number(level);
        if (!Number.isFinite(classLevel) || classLevel < 1) return;
        if (!Array.isArray(raw)) return;
        for (const feature of raw) {
          if (!this.isClassFeatureUnlocked(feature, classLevel)) continue;
          out.push(this.normalizeClassFeature(feature, source));
        }
      };

      for (const item of embeddedClasses) {
        const level = this.getEmbeddedClassLevel(item);
        if (level === null) {
          throw new Error(`Niveau canonique absent sur l’Item classe « ${item?.name ?? item?.id ?? "inconnu"} ».`);
        }
        push(item.system?.classFeatures, level, {
          _add2eClassItemId: item.id ?? null,
          _add2eClassItemUuid: item.uuid ?? null,
          _add2eClassName: item.name ?? "Classe",
          _add2eClassLevel: level
        });
      }

      const seen = new Set();
      return out.filter(feature => {
        const source = feature._add2eClassItemId ?? "classe";
        const key = `${source}|${feature.minLevel}|${feature.name}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    },

    getActiveClassFeatures(actor) {
      return this.getUnlockedClassFeatures(actor).filter(feature => this.isClassFeatureActivable(feature));
    },

    getAllAlignmentLabels() {
      return [
        "Loyal Bon",
        "Loyal Neutre",
        "Loyal Mauvais",
        "Neutre Bon",
        "Neutre Absolu",
        "Neutre Mauvais",
        "Chaotique Bon",
        "Chaotique Neutre",
        "Chaotique Mauvais"
      ];
    },

    alignmentSlug(value) {
      const normalized = String(value ?? "")
        .trim()
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[’']/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "");
      return normalized === "neutre" ? "neutre_absolu" : normalized;
    },

    alignmentLabelForSlug(slug) {
      const normalized = this.alignmentSlug(slug);
      return this.getAllAlignmentLabels().find(label => this.alignmentSlug(label) === normalized) ?? "";
    },

    getClassAllowedAlignments(classData) {
      const system = classData?.system ?? classData ?? {};
      const raw = system.alignements_autorises;
      if (!Array.isArray(raw) || !raw.length) {
        throw new Error(`Classe « ${classData?.name ?? system?.label ?? "inconnue"} » sans alignements_autorises canoniques.`);
      }
      const seen = new Set();
      const out = [];
      for (const value of raw) {
        const slug = this.alignmentSlug(value);
        const label = this.alignmentLabelForSlug(slug);
        if (!slug || !label) {
          throw new Error(`Alignement de classe non canonique : « ${String(value ?? "")} ».`);
        }
        if (seen.has(slug)) continue;
        seen.add(slug);
        out.push(label);
      }
      return out;
    },

    getActorAllowedAlignments(actor) {
      const all = this.getAllAlignmentLabels();
      const classItems = this.getEmbeddedClassItems(actor);
      if (!classItems.length) return all;

      let allowed = null;
      for (const classItem of classItems) {
        const classAllowed = this.getClassAllowedAlignments(classItem);
        const slugs = new Set(classAllowed.map(value => this.alignmentSlug(value)).filter(Boolean));
        if (allowed === null) allowed = slugs;
        else allowed = new Set([...allowed].filter(slug => slugs.has(slug)));
      }

      return all.filter(label => allowed?.has?.(this.alignmentSlug(label)));
    },

    isAlignmentAllowedForClass(alignment, classData) {
      const allowed = this.getClassAllowedAlignments(classData);
      const current = this.alignmentSlug(alignment);
      return !!current && allowed.some(value => this.alignmentSlug(value) === current);
    },

    isActorAlignmentAllowedForClass(actor, classData) {
      return this.isAlignmentAllowedForClass(actor?.system?.alignement ?? "", classData);
    },

    pickClassAlignment(actor, classData, fallback = "") {
      const current = actor?.system?.alignement ?? String(fallback ?? "");
      const allowed = this.getClassAllowedAlignments(classData);
      const currentSlug = this.alignmentSlug(current);
      const currentAllowed = allowed.find(value => this.alignmentSlug(value) === currentSlug);
      if (currentAllowed) return currentAllowed;
      return allowed[0] ?? String(fallback ?? "");
    },

    getRacialTagsForRace() {
      return [];
    },

    getRaceSlug(actor) {
      const item = add2eCanonicalRaceItem(actor);
      return item ? add2eCanonicalRaceSlug(item) : "";
    },

    getActiveTags(actor) {
      if (!actor) return [];
      const tags = [];
      const embeddedClasses = this.getEmbeddedClassItems(actor);

      this.addTagsInto(tags, actor.flags?.add2e?.racialTags);
      this.addTagsInto(tags, actor.flags?.add2e?.classTags);
      if (actor.getFlag) {
        try { this.addTagsInto(tags, actor.getFlag("add2e", "racialTags")); } catch {}
        try { this.addTagsInto(tags, actor.getFlag("add2e", "classTags")); } catch {}
      }

      for (const effect of actor.effects ?? []) {
        if (effect.disabled) continue;
        if (effect.flags?.add2e?.autoClassPassiveEffect === true) continue;
        if (effect.origin) {
          try {
            const source = fromUuidSync(effect.origin);
            if (source && source.parent === actor && source.system?.equipee === false) continue;
          } catch {}
        }
        this.addEffectTagsInto(tags, effect);
      }

      for (const item of actor.items ?? []) {
        const type = String(item.type || "").toLowerCase();
        const isClass = type === "classe";
        const always = type === "race" || isClass;
        const equippedTypes = ["arme", "armure", "objet", "weapon", "armor", "equipment", "object", "magic", "objet_magique"];

        if (!always && !equippedTypes.includes(type)) continue;
        if (equippedTypes.includes(type) && item.system?.equipee !== true) continue;

        for (const value of [
          item.system?.tags, item.system?.tag, item.system?.effectTags,
          item.system?.effets, item.system?.effects,
          item.flags?.add2e?.tags, item.flags?.add2e?.effectTags
        ]) this.addTagsInto(tags, value);

        this.addEmbeddedItemEffectTagsInto(tags, item);
        if (isClass) this.addClassFeatureTagsInto(tags, item.system?.classFeatures, this.getEmbeddedClassLevel(item));

        if (item.getFlag) {
          try { this.addTagsInto(tags, item.getFlag("add2e", "tags")); } catch {}
          try { this.addTagsInto(tags, item.getFlag("add2e", "effectTags")); } catch {}
        }
      }

      const monk = embeddedClasses.find(item => add2eCanonicalClassSlug(item) === "moine") ?? null;
      const monkLevel = this.getEmbeddedClassLevel(monk);
      if (monk && monkLevel === null) {
        throw new Error(`Niveau canonique absent sur l’Item classe Moine « ${monk?.name ?? monk?.id ?? "inconnu"} ».`);
      }
      if (monk) {
        const progression = Array.isArray(monk.system?.progression) ? monk.system.progression : [];
        const row = progression.find(entry => Number(entry?.niveau) === monkLevel) ?? null;
        this.addTagsInto(tags, row?.tags);
      }

      return [...new Set(tags.map(tag => this.normalizeTag(tag)).filter(Boolean))];
    },

    getContextTags(subject) {
      if (!subject) return [];
      const tags = [];
      const system = subject.system ?? {};
      for (const raw of [
        system.tags, system.tag, system.effectTags, system.effets, system.effects,
        system.race, system.type, system.type_monstre, system.categorie,
        system.alignement,
        subject.flags?.add2e?.tags, subject.flags?.add2e?.effectTags
      ]) this.addTagsInto(tags, raw);
      this.addTagsInto(tags, this.getActiveTags(subject));
      return [...new Set(tags.map(tag => this.normalizeTag(tag)).filter(Boolean))];
    },

    toRules(raw) {
      if (Array.isArray(raw)) return raw.filter(rule => rule && typeof rule === "object");
      if (raw && typeof raw === "object") return Array.isArray(raw.rules)
        ? raw.rules.filter(rule => rule && typeof rule === "object")
        : [raw];
      return [];
    },

    getActiveRules(actor) {
      const rules = [];
      const effects = actor?.effects?.contents ?? actor?.effects ?? [];
      for (const effect of effects) {
        if (!effect || effect.disabled) continue;
        const raws = [effect.flags?.add2e?.rules];
        if (effect.getFlag) {
          try { raws.push(effect.getFlag("add2e", "rules")); } catch {}
        }
        for (const raw of raws) {
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
      }
      return rules;
    },

    getClassFeaturePassiveRules(actor) {
      const rules = [];
      const features = this.getUnlockedClassFeatures(actor);
      for (const feature of features) {
        const raws = [feature?.rules, feature?.flags?.add2e?.rules];
        for (const raw of raws) {
          for (const rule of this.toRules(raw)) {
            rules.push({
              ...rule,
              source: {
                feature,
                featureName: feature?.name ?? "Capacité de classe",
                classItemId: feature?._add2eClassItemId ?? null,
                classItemUuid: feature?._add2eClassItemUuid ?? null,
                className: feature?._add2eClassName ?? null,
                classLevel: Number(feature?._add2eClassLevel) || null,
                actor
              }
            });
          }
        }
      }
      return rules;
    },

    getClassProgressionEntryForPassiveRule(rule, context = {}) {
      const actor = context?.actor ?? rule?.source?.actor ?? null;
      if (!actor) return null;
      const classItemId = String(rule?.source?.classItemId ?? "").trim();
      if (!classItemId) return null;
      const classItem = this.getEmbeddedClassItems(actor).find(item => String(item.id) === classItemId) ?? null;
      if (!classItem) return null;
      const progressionState = add2eCanonicalClassProgression(classItem);
      if (!progressionState.hasLevel) return null;
      const level = Number(rule?.source?.classLevel ?? progressionState.level);
      if (!Number.isFinite(level) || level < 1) return null;
      const source = String(rule?.progressionSource ?? rule?.progression ?? "progression").trim() || "progression";
      const progression = Array.isArray(classItem.system?.[source]) ? classItem.system[source] : [];
      if (!progression.length) return null;
      return progression.find(entry => Number(entry?.niveau) === level) ?? null;
    },

    getPassiveRuleProgressionValue(rule, context = {}) {
      const field = String(rule?.field ?? rule?.path ?? rule?.progressionField ?? "").trim();
      if (!field) return null;
      const row = this.getClassProgressionEntryForPassiveRule(rule, context);
      if (!row) return null;
      let value = row;
      for (const part of field.split(".").map(p => p.trim()).filter(Boolean)) value = value?.[part];
      const number = this.readNumber(value);
      return Number.isFinite(number) ? number : null;
    },

    getPassiveRuleNumber(rule, context = {}) {
      const sourceKey = this.normalizeKey(rule?.valueSource ?? rule?.sourceValue ?? "");
      if (["progressionfield", "progression_field", "progressionchamp", "champ_progression"].includes(sourceKey)) {
        const progressionValue = this.getPassiveRuleProgressionValue(rule, context);
        if (Number.isFinite(progressionValue)) return progressionValue;
      }

      const raw = rule?.value ?? rule?.amount ?? rule?.bonus ?? rule?.modifier;
      const direct = this.readNumber(raw);
      if (Number.isFinite(direct)) return direct;

      const classLevel = Number(rule?.source?.classLevel ?? context?.classLevel);
      const multiplier = Number(rule?.multiplier ?? rule?.factor ?? 1);
      const offset = Number(rule?.offset ?? 0) || 0;

      if (sourceKey === "classlevel" || sourceKey === "niveauclasse" || sourceKey === "niveau_classe") {
        return (Number.isFinite(classLevel) ? classLevel : 0) * (Number.isFinite(multiplier) ? multiplier : 1) + offset;
      }

      const text = String(raw ?? "").replace(/\s+/g, "").toLowerCase();
      if (text === "classlevel/2" || text === "niveauclasse/2" || text === "niveau_classe/2") {
        return (Number.isFinite(classLevel) ? classLevel : 0) / 2;
      }

      return 0;
    },

    passiveRuleActionTagsMatch(rule, actionTags) {
      const any = this.ruleTags(rule?.actionAnyTags ?? rule?.anyActionTags);
      const all = this.ruleTags(rule?.actionAllTags ?? rule?.allActionTags);
      const notAny = this.ruleTags(rule?.actionNotAnyTags ?? rule?.notActionAnyTags ?? rule?.excludeActionAnyTags);
      const notAll = this.ruleTags(rule?.actionNotAllTags ?? rule?.notActionAllTags ?? rule?.excludeActionAllTags);

      if (any.length && !any.some(tag => actionTags.has(tag))) return false;
      if (all.length && !all.every(tag => actionTags.has(tag))) return false;
      if (notAny.length && notAny.some(tag => actionTags.has(tag))) return false;
      if (notAll.length && !notAll.every(tag => actionTags.has(tag))) return false;
      return true;
    },

    getPassiveArmorClassBase(actor, context = {}) {
      const rules = [
        ...this.getActiveRules(actor),
        ...this.getClassFeaturePassiveRules(actor)
      ];
      const candidates = [];
      for (const rawRule of rules) {
        const rule = rawRule?.scope || rawRule?.ruleScope ? rawRule : { ...rawRule, scope: "owner" };
        const kind = this.normalizeKey(rule?.kind ?? rule?.type ?? "");
        if (!["armor_class_base", "classe_armure_base", "defense_base", "ca_base"].includes(kind)) continue;
        if (!this.actionRuleScopeMatches(rule, { ...context, ruleScope: context?.ruleScope ?? "owner" })) continue;
        const value = this.getPassiveRuleNumber(rule, { ...context, actor });
        if (!Number.isFinite(value)) continue;
        candidates.push({
          value,
          ignoreDex: rule?.ignoreDex === true || rule?.ignore_dex === true || this.normalizeKey(rule?.dex ?? "") === "ignore",
          label: rule?.label ?? rule?.name ?? rule?.source?.featureName ?? "CA passive",
          rule
        });
      }
      if (!candidates.length) return { applied: false, value: null, ignoreDex: false, candidates: [] };
      const best = candidates.sort((left, right) => left.value - right.value)[0];
      return { applied: true, ...best, candidates };
    },

    getPassiveCombatModifiers(actor, context = {}) {
      const actionType = this.normalizeKey(context?.type ?? context?.actionType ?? "attaque");
      const actionTags = new Set([
        ...this.ruleTags(context?.actionTags),
        ...this.ruleTags(context?.combatTags),
        ...this.ruleTags(context?.combatProfile?.tags),
        ...this.ruleTags(context?.combatProfile?.tagSet ? Array.from(context.combatProfile.tagSet) : [])
      ]);
      const subjectTags = new Set(this.ruleTags(context?.subjectTags ?? this.getActiveTags(actor)));
      const out = { toucher: 0, degats: 0, ca: 0, details: [], rules: [] };
      const rules = [
        ...this.getActiveRules(actor),
        ...this.getClassFeaturePassiveRules(actor)
      ];

      for (const rawRule of rules) {
        const rule = rawRule?.scope || rawRule?.ruleScope ? rawRule : { ...rawRule, scope: "owner" };
        const kind = this.normalizeKey(rule?.kind ?? rule?.type ?? "");
        if (!["attack_modifier", "combat_modifier", "attaque_modifier", "modificateur_combat"].includes(kind)) continue;
        if (!this.actionRuleScopeMatches(rule, { ...context, ruleScope: context?.ruleScope ?? "owner" })) continue;
        if (!this.actionRuleMatches(rule, actionType, subjectTags, actionTags, context)) continue;
        if (!this.passiveRuleActionTagsMatch(rule, actionTags)) continue;

        const selector = this.normalizeKey(rule?.selector ?? rule?.stat ?? rule?.target ?? rule?.appliesTo ?? "");
        const mode = this.normalizeKey(rule?.mode ?? "add");
        const target = selector.includes("degat") || selector.includes("damage") ? "degats"
          : selector.includes("ca") || selector.includes("armor") || selector.includes("defense") ? "ca"
            : "toucher";

        let value = 0;
        if (mode === "cancel_ability_bonus" || mode === "annule_bonus_caracteristique") {
          const ability = this.normalizeKey(rule?.ability ?? rule?.carac ?? rule?.characteristic ?? "");
          const abilityInfo = context?.abilityModifiers?.[target] ?? null;
          const currentAbility = this.normalizeKey(abilityInfo?.ability ?? abilityInfo?.carac ?? "");
          if (!ability || !currentAbility || ability !== currentAbility) continue;
          value = -(Number(abilityInfo?.value) || 0);
        } else {
          value = this.getPassiveRuleNumber(rule, { ...context, actor });
        }

        if (!value) continue;
        out[target] += value;
        out.rules.push(rule);
        out.details.push(`${rule?.label ?? rule?.name ?? rule?.source?.featureName ?? "Règle passive"} : ${value >= 0 ? "+" : ""}${value}`);
      }

      return out;
    },

    ruleTags(raw) {
      return this.toArray(raw).map(tag => this.normalizeTag(tag)).filter(Boolean);
    },

    actionRuleScopeMatches(rule, action = {}) {
      const requested = this.normalizeKey(action.ruleScope ?? "target");
      const scope = this.normalizeKey(rule.scope ?? rule.ruleScope ?? "target");
      if (requested === "owner" || requested === "self") return scope === "owner" || scope === "self";
      return scope !== "owner" && scope !== "self";
    },

    actionRuleMatches(rule, actionType, subjectTags, actionTags, action = {}) {
      const actions = this.ruleTags(rule.actions ?? rule.action);
      if (actions.length && !actions.includes(actionType)) return false;
      if (rule.requireContact === true && action.contact !== true) return false;

      const subjectAny = this.ruleTags(rule.subjectAnyTags);
      const subjectAll = this.ruleTags(rule.subjectAllTags);
      const actionAny = this.ruleTags(rule.actionAnyTags);
      const actionAll = this.ruleTags(rule.actionAllTags);

      if (subjectAny.length && !subjectAny.some(tag => subjectTags.has(tag))) return false;
      if (subjectAll.length && !subjectAll.every(tag => subjectTags.has(tag))) return false;
      if (actionAny.length && !actionAny.some(tag => actionTags.has(tag))) return false;
      if (actionAll.length && !actionAll.every(tag => actionTags.has(tag))) return false;
      return true;
    },

    async evaluateActionRules(actor, action = {}) {
      const actionType = this.normalizeKey(action?.type ?? "");
      const subjectTags = new Set(this.ruleTags(action?.subjectTags ?? action?.actorTags));
      const actionTags = new Set(this.ruleTags(action?.actionTags));
      const matchedRules = [];
      const gateResults = [];

      for (const rule of this.getActiveRules(actor)) {
        const kind = this.normalizeKey(rule.kind);
        if (kind !== "block_action" && kind !== "save_gate") continue;
        if (!this.actionRuleScopeMatches(rule, action)) continue;
        if (!this.actionRuleMatches(rule, actionType, subjectTags, actionTags, action)) continue;

        if (kind === "block_action") {
          matchedRules.push({
            kind: "block_action",
            label: String(rule.label ?? "Action bloquée par un effet actif."),
            source: rule.source ?? null,
            rule
          });
          continue;
        }

        if (typeof this.rollActionSave !== "function") {
          throw new Error("Le résolveur canonique de sauvegardes ADD2E n’est pas installé.");
        }
        const save = await this.rollActionSave(
          action.saveActor ?? action.actor ?? action.sourceActor ?? null,
          rule.saveType ?? "sorts",
          Number(rule.saveBonus) || 0,
          {
            source: rule.source?.effectName ?? rule.label ?? "action-rule-save-gate",
            ruleScope: action.ruleScope,
            actionType,
            actionTags: [...actionTags],
            createChat: action.createSaveChat === true,
            showDice: action.showSaveDice !== false
          }
        );
        const failureMode = this.normalizeKey(rule.onFailure ?? rule.onFail ?? "block");
        const allowed = save.canRoll ? save.success : failureMode !== "block";
        const entry = {
          kind: "save_gate",
          label: String(rule.label ?? "Un jet de protection est requis avant cette action."),
          source: rule.source ?? null,
          rule,
          save,
          allowed
        };
        gateResults.push(entry);
        if (!allowed) matchedRules.push(entry);
      }

      return {
        allowed: matchedRules.length === 0,
        blocked: matchedRules.length > 0,
        matchedRules,
        gateResults,
        details: matchedRules.map(entry => entry.label)
      };
    },

    hasTag(actor, tag) {
      return this.getActiveTags(actor).includes(this.normalizeTag(tag));
    },

    hasImmunity(actor, tag) {
      const wanted = this.normalizeTag(tag);
      const tags = this.getActiveTags(actor);
      return tags.includes(wanted)
        || tags.some(current => current.startsWith("immunite:")
          && wanted.includes(this.normalizeTag(current.split(":")[1] || "")));
    },

    getResistanceAliases(type) {
      const raw = this.normalizeTag(type);
      const aliases = new Set([raw]);

      if (["charme", "charm", "sommeil", "sleep", "suggestion", "charme_suggestion"].includes(raw)) {
        for (const value of ["charme_sommeil", "charme", "sommeil", "suggestion", "charme_suggestion"]) aliases.add(value);
      }
      if (["esp", "perception_extrasensorielle", "pensee", "pensees"].includes(raw)) {
        aliases.add("esp");
        aliases.add("perception_extrasensorielle");
      }
      if (["maladie", "disease"].includes(raw)) {
        aliases.add("maladie");
        aliases.add("disease");
      }

      return [...aliases].filter(Boolean);
    },

    getResistanceInfo(actor, typeResist) {
      const tags = this.getActiveTags(actor);
      const aliases = this.getResistanceAliases(typeResist);
      for (const alias of aliases) {
        const tag = tags.find(current => current.startsWith(`resistance:${alias}:`));
        if (!tag) continue;
        let pct = Number(tag.split(":")[2]) || 0;
        pct = pct >= 0 && pct <= 1 ? pct * 100 : pct;
        return {
          found: true,
          type: String(typeResist ?? ""),
          matchedType: alias,
          tag,
          pct: Math.max(0, Math.min(100, pct))
        };
      }
      return { found: false, type: String(typeResist ?? ""), matchedType: "", tag: "", pct: 0 };
    },

    checkResistanceDetails(actor, typeResist, options = {}) {
      const info = this.getResistanceInfo(actor, typeResist);
      if (!info.found) {
        const result = {
          found: false,
          resiste: false,
          type: String(typeResist ?? ""),
          matchedType: "",
          tag: "",
          pct: 0,
          jet: 0,
          details: `Aucune résistance contre ${typeResist}`
        };
        globalThis.add2eLastResistanceRoll = result;
        return result;
      }

      const jet = Math.ceil(Math.random() * 100);
      const resiste = jet <= info.pct;
      const result = {
        found: true,
        resiste,
        type: info.type,
        matchedType: info.matchedType,
        tag: info.tag,
        pct: info.pct,
        jet,
        details: `Résistance ${info.pct}% contre ${typeResist} : jet ${jet} => ${resiste ? "réussite" : "échec"}`
      };

      globalThis.add2eLastResistanceRoll = result;
      if (options.chat !== false) {
        const createChatCard = globalThis.add2eCreateChatCard;
        if (typeof createChatCard !== "function") {
          throw new Error("L’API commune de carte chat ADD2E est indisponible pour le jet de résistance.");
        }
        void createChatCard({
          actor,
          title: "Résistance",
          icon: "fas fa-shield-halved",
          variant: resiste ? "success" : "failure",
          rows: [
            { label: "Type", value: String(typeResist ?? "Résistance") },
            { label: "Chance", value: `${info.pct}%` },
            { label: "Jet", value: String(jet) }
          ],
          message: resiste ? "Résistance réussie." : "Résistance échouée."
        }).catch(error => console.error("[ADD2E][RESISTANCE][CHAT_ERROR]", error));
      }
      return result;
    },

    checkResistance(actor, typeResist, options = {}) {
      return this.checkResistanceDetails(actor, typeResist, options).resiste;
    }
  });
}
