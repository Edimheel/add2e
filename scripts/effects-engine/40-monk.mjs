// ADD2E — Effects Engine / progression et capacités du moine.
// Extraction fonctionnelle sans changement de règle.

const register = (Engine, methods) => Object.defineProperties(
  Engine,
  Object.fromEntries(Object.entries(methods).map(([name, value]) => [
    name,
    { value, configurable: true, writable: true }
  ]))
);

export function installEffectsEngineMonk(Engine) {
  register(Engine, {
    getActorClassSystem(actor) {
      return actor?.items?.find?.(item => String(item.type || "").toLowerCase() === "classe")?.system
        ?? actor?.system?.details_classe
        ?? null;
    },

    isMonk(actor) {
      const classSystem = this.getActorClassSystem(actor);
      const label = this.normalizeKey(
        classSystem?.label || classSystem?.name || classSystem?.nom || actor?.system?.classe || ""
      );
      return label.includes("moine") || this.hasTag(actor, "classe:moine");
    },

    getClassProgressionEntry(actor, field = "progression") {
      const classSystem = this.getActorClassSystem(actor);
      const level = this.getActorLevel(actor);
      const progression = classSystem?.[field] ?? classSystem?.progression ?? [];
      if (!Array.isArray(progression) || !progression.length) return null;
      return progression.find(entry => Number(entry?.niveau ?? entry?.level) === level)
        ?? progression[Math.max(0, Math.min(progression.length - 1, level - 1))]
        ?? null;
    },

    getMonkProgression(actor) {
      return this.isMonk(actor)
        ? this.getClassProgressionEntry(actor, "monkProgression") ?? this.getClassProgressionEntry(actor, "progression")
        : null;
    },

    getMonkArmorClass(actor) {
      const progression = this.getMonkProgression(actor);
      const value = Number(progression?.monkAC ?? progression?.caMoine ?? progression?.ca_moine);
      return Number.isFinite(value) ? value : null;
    },

    getMonkMove(actor) {
      const progression = this.getMonkProgression(actor);
      const value = Number(progression?.move ?? progression?.movement ?? progression?.mouvement);
      return Number.isFinite(value) ? value : null;
    },

    getMonkOpenDoors(actor) {
      const progression = this.getMonkProgression(actor);
      const value = Number(progression?.openDoors ?? progression?.ouvrir_portes);
      return Number.isFinite(value) ? value : null;
    },

    getMonkUnarmedDamage(actor) {
      const progression = this.getMonkProgression(actor);
      return String(progression?.unarmedDamage ?? progression?.main_nue ?? progression?.damage ?? "").trim();
    },

    getMonkAttacksPerRound(actor) {
      const progression = this.getMonkProgression(actor);
      return String(progression?.attacksPerRound ?? progression?.attaquesParRound ?? "").trim();
    },

    getMonkStunParalyze(actor) {
      const progression = this.getMonkProgression(actor);
      const value = Number(progression?.stunParalyze ?? progression?.etourdissement ?? progression?.paralysie);
      return Number.isFinite(value) ? value : 0;
    },

    getMonkSlowFall(actor) {
      const progression = this.getMonkProgression(actor);
      const value = Number(progression?.slowFall ?? progression?.chute_ralentie);
      return Number.isFinite(value) ? value : 0;
    },

    getMonkSelfHealPerDay(actor) {
      const progression = this.getMonkProgression(actor);
      const value = Number(progression?.selfHealPerDay ?? progression?.auto_soin);
      return Number.isFinite(value) ? value : 0;
    },

    getMonkWeaponDamageBonus(actor) {
      const progression = this.getMonkProgression(actor);
      const value = Number(progression?.monkWeaponDamageBonus ?? progression?.bonusDegatsArme ?? progression?.bonus_degats_arme);
      return Number.isFinite(value) ? value : (this.isMonk(actor) ? Math.floor(this.getActorLevel(actor) / 2) : 0);
    },

    hasMonkDiseaseImmunity(actor) {
      return this.hasImmunity(actor, "maladie");
    },

    getMonkProgressionTags(actor) {
      const progression = this.getMonkProgression(actor);
      return progression ? this.toArray(progression.tags).map(tag => this.normalizeTag(tag)).filter(Boolean) : [];
    },

    getMonkResistCharmSuggestion(actor) {
      const progression = this.getMonkProgression(actor);
      const value = Number(progression?.resistCharmSuggestion ?? progression?.resistance_charme_suggestion);
      return Number.isFinite(value) ? value : 0;
    },

    getMonkResistESP(actor) {
      const progression = this.getMonkProgression(actor);
      const value = Number(progression?.resistESP ?? progression?.resistance_esp);
      return Number.isFinite(value) ? value : 0;
    },

    hasMonkQuiveringPalm(actor) {
      const progression = this.getMonkProgression(actor);
      return !!progression?.quiveringPalm
        || this.hasTag(actor, "moine:paume_palpitante")
        || this.hasTag(actor, "paume_palpitante");
    },

    getClassFeaturePassiveRules(actor) {
      const rules = [];
      const features = typeof this.getUnlockedClassFeatures === "function" ? this.getUnlockedClassFeatures(actor) : [];
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

    getPassiveRuleNumber(rule, context = {}) {
      const raw = rule?.value ?? rule?.amount ?? rule?.bonus ?? rule?.modifier;
      const direct = this.readNumber(raw);
      if (Number.isFinite(direct)) return direct;

      const sourceKey = this.normalizeKey(rule?.valueSource ?? rule?.sourceValue ?? "");
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
        ...(typeof this.getActiveRules === "function" ? this.getActiveRules(actor) : []),
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
        ...(typeof this.getActiveRules === "function" ? this.getActiveRules(actor) : []),
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

    getMonkSummary(actor) {
      const progression = this.getMonkProgression(actor);
      if (!progression) return null;
      return {
        level: this.getActorLevel(actor),
        title: progression.title ?? "",
        armorClass: this.getMonkArmorClass(actor),
        move: this.getMonkMove(actor),
        openDoors: this.getMonkOpenDoors(actor),
        unarmedDamage: this.getMonkUnarmedDamage(actor),
        weaponDamageBonus: this.getMonkWeaponDamageBonus(actor),
        attacksPerRound: this.getMonkAttacksPerRound(actor),
        stunParalyze: this.getMonkStunParalyze(actor),
        slowFall: this.getMonkSlowFall(actor),
        selfHealPerDay: this.getMonkSelfHealPerDay(actor),
        resistCharmSuggestion: this.getMonkResistCharmSuggestion(actor),
        resistESP: this.getMonkResistESP(actor),
        quiveringPalm: this.hasMonkQuiveringPalm(actor),
        activeCapabilities: this.getActiveClassFeatures(actor)
      };
    }
  });
}
