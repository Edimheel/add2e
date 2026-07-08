// ADD2E — Effects Engine / tags, capacités et résistances générales.
// Les règles d'action restent génériques : aucun sort n'est nommé ici.

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
      const entries = Array.isArray(raw) ? raw : (raw && typeof raw === "object" ? Object.values(raw) : []);
      for (const feature of entries) {
        if (!this.isClassFeatureUnlocked(feature, classLevel)) continue;
        for (const value of [
          feature.tags, feature.tag, feature.effectTags, feature.effets,
          feature.effects, feature.flags?.add2e?.tags
        ]) this.addTagsInto(dst, value);
      }
    },

    classFeatureMinLevel(feature) {
      const value = Number(feature?.minLevel ?? feature?.minimumLevel ?? feature?.niveauMin ?? feature?.level ?? feature?.niveau ?? 1);
      return Number.isFinite(value) && value > 0 ? value : 1;
    },

    classFeatureMaxLevel(feature) {
      const raw = feature?.maxLevel ?? feature?.maximumLevel ?? feature?.niveauMax ?? feature?.max;
      if (raw === undefined || raw === null || raw === "") return null;
      const value = Number(raw);
      return Number.isFinite(value) && value > 0 ? value : null;
    },

    isClassFeatureUnlocked(feature, level) {
      if (!feature || typeof feature !== "object") return false;
      const min = this.classFeatureMinLevel(feature);
      const max = this.classFeatureMaxLevel(feature);
      return level >= min && (max === null || level <= max);
    },

    getEmbeddedClassItems(actor) {
      return Array.from(actor?.items ?? []).filter(item => String(item?.type ?? "").toLowerCase() === "classe");
    },

    getEmbeddedClassLevel(item) {
      const level = Number(item?.system?.niveau ?? item?.system?.level);
      return Number.isFinite(level) && level >= 1 ? Math.floor(level) : null;
    },

    normalizeClassFeature(feature, source = {}) {
      return {
        ...foundry.utils.deepClone(feature),
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
      const classItems = this.getEmbeddedClassItems(actor);
      const push = (raw, level, source = {}) => {
        const classLevel = Number(level);
        if (!Number.isFinite(classLevel) || classLevel < 1) return;
        const entries = Array.isArray(raw) ? raw : (raw && typeof raw === "object" ? Object.values(raw) : []);
        for (const feature of entries) {
          if (!this.isClassFeatureUnlocked(feature, classLevel)) continue;
          out.push(this.normalizeClassFeature(feature, source));
        }
      };

      if (classItems.length) {
        for (const item of classItems) {
          const level = this.getEmbeddedClassLevel(item);
          if (level === null) continue;
          push(item.system?.classFeatures, level, {
            _add2eClassItemId: item.id ?? null,
            _add2eClassItemUuid: item.uuid ?? null,
            _add2eClassName: item.name ?? item.system?.label ?? "Classe",
            _add2eClassLevel: level
          });
        }
      } else {
        // Compatibilité des anciens acteurs sans Item de classe embarqué.
        const level = this.getActorLevel(actor);
        push(actor.system?.classFeatures, level);
        push(actor.system?.details_classe?.classFeaturesDebloquees, level);
        push(actor.system?.details_classe?.classFeatures, level);
      }

      const seen = new Set();
      return out.filter(feature => {
        const source = feature._add2eClassItemId ?? "legacy";
        const key = `${source}|${feature.minLevel}|${feature.name ?? feature.label ?? feature.title ?? feature.nom ?? JSON.stringify(feature.tags ?? [])}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    },

    getActiveClassFeatures(actor) {
      return this.getUnlockedClassFeatures(actor).filter(feature => this.isClassFeatureActivable(feature));
    },

    getConstitutionTotal(actor) {
      const system = actor?.system ?? {};
      const direct = Number(system.constitution);
      if (!Number.isNaN(direct) && direct > 0) return direct;
      return Number(system.constitution_base || 0)
        + Number(system.constitution_race ?? system.bonus_caracteristiques?.constitution ?? 0)
        + Number(system.constitution_bonus ?? system.bonus_divers_caracteristiques?.constitution ?? 0);
    },

    getConstitutionSaveBonus(actor) {
      return Math.max(0, Math.min(5, Math.floor(this.getConstitutionTotal(actor) / 3.5)));
    },

    getRacialTagsForRace() {
      return [];
    },

    getRaceSlug(actor) {
      let raw = "";
      const race = actor?.system?.race;
      if (typeof race === "string") raw = race;
      else if (race && typeof race === "object") raw = race.value ?? race.name ?? race.label ?? "";
      raw = raw
        || actor?.system?.details_race?.slug
        || actor?.system?.details_race?.name
        || actor?.system?.details?.race
        || actor?.system?.race_nom
        || actor?.items?.find(item => String(item.type).toLowerCase() === "race")?.name
        || "";
      return String(raw).toLowerCase().normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[’']/g, "")
        .replace(/\s+/g, "-")
        .trim();
    },

    getActiveTags(actor) {
      if (!actor) return [];
      const tags = [];
      const classItems = this.getEmbeddedClassItems(actor);
      const legacyLevel = this.getActorLevel(actor);

      this.addTagsInto(tags, this.getRacialTagsForRace(this.getRaceSlug(actor)));
      this.addTagsInto(tags, actor.flags?.add2e?.racialTags);
      this.addTagsInto(tags, actor.flags?.add2e?.classTags);
      if (actor.getFlag) {
        try { this.addTagsInto(tags, actor.getFlag("add2e", "racialTags")); } catch {}
        try { this.addTagsInto(tags, actor.getFlag("add2e", "classTags")); } catch {}
      }

      // Les données d'acteur historiques ne sont une source qu'en l'absence
      // d'Items classe. Dès qu'ils existent, chacun porte son niveau propre.
      if (!classItems.length) {
        this.addClassFeatureTagsInto(tags, actor.system?.classFeatures, legacyLevel);
        this.addClassFeatureTagsInto(tags, actor.system?.details_classe?.classFeatures, legacyLevel);
      }

      for (const effect of actor.effects ?? []) {
        if (effect.disabled) continue;
        // Cet effet est un ancien cache des tags de classe. Les Items classe
        // sont désormais relus directement ci-dessous afin de ne jamais
        // conserver un déblocage calculé avec actor.system.niveau global.
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

      const monk = classItems.find(item => this.normalizeKey(item.system?.label || item.name || "").includes("moine")
        || this.toArray(item.system?.tags).map(tag => this.normalizeTag(tag)).includes("classe:moine"));

      const monkLevel = this.getEmbeddedClassLevel(monk);
      if (monk && monkLevel !== null) {
        const progression = Array.isArray(monk.system?.monkProgression) && monk.system.monkProgression.length
          ? monk.system.monkProgression
          : (Array.isArray(monk.system?.progression) ? monk.system.progression : []);
        const row = progression.find(entry => Number(entry?.niveau ?? entry?.level) === monkLevel)
          ?? progression[Math.max(0, Math.min(progression.length - 1, monkLevel - 1))]
          ?? null;
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
        system.alignement, system.alignment, system.details?.alignment,
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
                featureName: feature?.name ?? feature?.label ?? feature?.title ?? "Capacité de classe",
                classItemId: feature?._add2eClassItemId ?? null,
                classItemUuid: feature?._add2eClassItemUuid ?? null,
                className: feature?._add2eClassName ?? null,
                classLevel: Number(feature?._add2eClassLevel) || Number(feature?.minLevel) || null,
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
      const classItemId = rule?.source?.classItemId ?? null;
      const classItem = classItemId
        ? this.getEmbeddedClassItems(actor).find(item => item.id === classItemId)
        : this.getEmbeddedClassItems(actor)[0];
      const system = classItem?.system ?? actor.system?.details_classe ?? null;
      if (!system) return null;
      const level = Number(rule?.source?.classLevel ?? this.getEmbeddedClassLevel(classItem) ?? this.getActorLevel(actor));
      if (!Number.isFinite(level) || level < 1) return null;
      const source = String(rule?.progressionSource ?? rule?.progression ?? "progression").trim() || "progression";
      const progression = Array.isArray(system?.[source]) && system[source].length
        ? system[source]
        : (Array.isArray(system?.progression) ? system.progression : []);
      if (!progression.length) return null;
      return progression.find(entry => Number(entry?.niveau ?? entry?.level) === level)
        ?? progression[Math.max(0, Math.min(progression.length - 1, level - 1))]
        ?? null;
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

      const classLevel = Number(rule?.source?.classLevel ?? context?.classLevel ?? context?.actorLevel ?? this.getActorLevel(context?.actor));
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
      if (notAll.length && notAll.every(tag => actionTags.has(tag))) return false;
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
        const value = this.getPassiveRuleNumber(rule, { ...context, actor, actorLevel: this.getActorLevel(actor) });
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
          value = this.getPassiveRuleNumber(rule, { ...context, actor, actorLevel: this.getActorLevel(actor) });
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

    getActionSaveThreshold(actor, saveType = "sorts") {
      const system = actor?.system ?? {};
      const type = this.normalizeKey(saveType);
      const index = {
        mort: 0,
        paralysie: 0,
        poison: 0,
        baguette: 1,
        wand: 1,
        petrification: 2,
        transformation: 2,
        souffle: 3,
        breath: 3,
        sort: 4,
        sortilege: 4,
        spell: 4,
        magie: 4,
        magic: 4
      }[type];
      if (Number.isInteger(index) && Array.isArray(system.sauvegardes)) {
        const fromArray = this.readNumber(system.sauvegardes[index]);
        if (Number.isFinite(fromArray) && fromArray > 0) return fromArray;
      }

      const candidates = type === "sort" || type === "sortilege" || type === "spell" || type === "magie" || type === "magic"
        ? [
          system.sauvegarde_sortileges,
          system.sauvegarde_sorts,
          system.sauvegardes?.sortileges,
          system.sauvegardes?.sorts,
          system.saves?.sorts,
          system.saves?.spell,
          system.saves?.spells,
          system.saves?.magic,
          system.calculatedSaves?.sorts,
          system.calculatedSaves?.spell,
          system.calculatedSaves?.spells,
          system.jp_sort,
          system.jp_sorts,
          system.jp?.sorts,
          system.jp?.sortileges
        ]
        : [
          system.sauvegardes?.[type],
          system.saves?.[type],
          system.calculatedSaves?.[type],
          system.jp?.[type]
        ];
      return this.readNumber(...candidates);
    },

    async rollActionSave(actor, saveType = "sorts", bonus = 0) {
      const threshold = this.getActionSaveThreshold(actor, saveType);
      const value = Number(bonus) || 0;
      if (!Number.isFinite(threshold) || threshold <= 0) {
        return {
          canRoll: false,
          type: String(saveType ?? ""),
          threshold: NaN,
          total: 0,
          success: false,
          bonus: value,
          roll: null
        };
      }

      const formula = value ? `1d20${value >= 0 ? "+" : ""}${value}` : "1d20";
      const roll = await new Roll(formula).evaluate();
      if (game.dice3d) await game.dice3d.showForRoll(roll);
      const total = Number(roll.total) || 0;
      return {
        canRoll: true,
        type: String(saveType ?? ""),
        threshold,
        total,
        success: total >= threshold,
        bonus: value,
        roll
      };
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

        const save = await this.rollActionSave(
          action.saveActor ?? action.actor ?? action.sourceActor ?? null,
          rule.saveType ?? "sorts",
          Number(rule.saveBonus) || 0
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
      if (options.chat !== false && typeof ChatMessage !== "undefined") {
        ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor }),
          content: `<div class="add2e-chat-card"><b>Résistance</b> ${actor?.name || "Cible"} vs ${typeResist} : ${jet}/${info.pct}% — ${resiste ? "réussite" : "échec"}</div>`
        });
      }
      return result;
    },

    checkResistance(actor, typeResist, options = {}) {
      return this.checkResistanceDetails(actor, typeResist, options).resiste;
    }
  });
}
