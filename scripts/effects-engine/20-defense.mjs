// ADD2E — Effects Engine / défenses, CA et bonus de sauvegarde.
// Les identités de monstre sont comparées strictement à partir de leurs champs et tags techniques.

const register = (Engine, methods) => Object.defineProperties(
  Engine,
  Object.fromEntries(Object.entries(methods).map(([name, value]) => [
    name,
    { value, configurable: true, writable: true }
  ]))
);

const ADD2E_COMBAT_IDENTITY_PREFIXES = [
  "type_monstre:",
  "monstre:",
  "race:",
  "creature:",
  "creature_label:",
  "type:",
  "alignement:",
  "alignment:"
];

export function installEffectsEngineDefense(Engine) {
  register(Engine, {
    getMagicPassiveDefense(actor, context = {}) {
      const transformation = globalThis.add2eGetCapabilityTransformationCombatProfile?.(actor) ?? null;
      const transformationCA = Number(transformation?.armorClass);
      if (Number.isFinite(transformationCA)) {
        return {
          armorBase: transformationCA,
          armorName: transformation.label || "Transformation",
          armorMagicBonus: 0,
          ignoredArmorMagicBonus: 0,
          fixedCA: null,
          fixedSource: "",
          fixedCAActive: false,
          baseAfterFixed: transformationCA,
          armorLayerCA: transformationCA,
          dex: 0,
          shieldBonus: 0,
          shieldSources: [],
          helmetBonus: 0,
          objectProtectionBonus: 0,
          objectSources: [],
          caNaturel: transformationCA,
          caTotal: transformationCA,
          syntheticArmorAC: transformationCA,
          transformation: {
            sourceKey: transformation.sourceKey,
            formKey: transformation.formKey,
            label: transformation.label,
            armorClass: transformation.armorClass,
            thac0: transformation.thac0,
            movement: transformation.movement,
            effectId: transformation.effectId
          },
          context,
          version: globalThis.ADD2E_EFFECTS_ENGINE_VERSION
        };
      }

      const items = this.equippedItems(actor);
      const armors = items.filter(item => ["armure", "armor"].includes(String(item.type ?? "").toLowerCase()));
      const objects = items.filter(item => !["armure", "armor"].includes(String(item.type ?? "").toLowerCase()));
      const worn = armors.filter(item => !this.isShieldItem(item) && !this.isHelmetItem(item));
      const shields = armors.filter(item => this.isShieldItem(item));
      const helmets = armors.filter(item => this.isHelmetItem(item));

      let armorBase = 10;
      let armorName = "Aucune";
      let armorMagicBonus = 0;

      for (const armor of worn) {
        const ac = this.readNumber(
          armor.system?.ac, armor.system?.ca, armor.system?.armorClass,
          armor.system?.base_ca, armor.system?.baseAC
        );
        if (Number.isFinite(ac) && ac < armorBase) {
          armorBase = ac;
          armorName = armor.name;
          armorMagicBonus = this.itemDefenseBonus(armor);
        }
      }

      let fixedCA = null;
      let fixedSource = "";
      for (const object of objects) {
        const ca = this.itemFixedCA(object);
        if (Number.isFinite(ca) && (fixedCA === null || ca < fixedCA)) {
          fixedCA = ca;
          fixedSource = object.name;
        }
      }

      const fixedCAActive = Number.isFinite(fixedCA);
      const baseAfterFixed = fixedCAActive ? fixedCA : armorBase;
      const appliedArmorMagicBonus = fixedCAActive ? 0 : armorMagicBonus;

      let shieldBonus = 0;
      let helmetBonus = 0;
      let objectProtectionBonus = 0;
      const shieldSources = [];
      const objectSources = [];

      for (const shield of shields) {
        const base = Math.max(1, Math.abs(this.readNumber(shield.system?.ac, shield.system?.ca, shield.system?.armorClass) ?? 1));
        const magic = this.itemDefenseBonus(shield);
        shieldBonus += base + magic;
        shieldSources.push(`${shield.name}:${base + magic}`);
      }

      for (const helmet of helmets) {
        helmetBonus += Math.abs(this.readNumber(helmet.system?.ac, helmet.system?.ca, helmet.system?.armorClass) ?? 0)
          + this.itemDefenseBonus(helmet);
      }

      for (const object of objects) {
        if (this.itemFixedCA(object) !== null) continue;
        const bonus = this.itemDefenseBonus(object);
        if (bonus) {
          objectProtectionBonus += bonus;
          objectSources.push(`${object.name}:${bonus}`);
        }
      }

      const dex = this.getDexDefense(actor);
      const armorLayerCA = baseAfterFixed - appliedArmorMagicBonus;
      const caNaturel = armorLayerCA + dex - shieldBonus - helmetBonus;
      const caTotal = caNaturel - objectProtectionBonus;

      return {
        armorBase,
        armorName,
        armorMagicBonus: appliedArmorMagicBonus,
        ignoredArmorMagicBonus: fixedCAActive ? armorMagicBonus : 0,
        fixedCA,
        fixedSource,
        fixedCAActive,
        baseAfterFixed,
        armorLayerCA,
        dex,
        shieldBonus,
        shieldSources,
        helmetBonus,
        objectProtectionBonus,
        objectSources,
        caNaturel,
        caTotal,
        syntheticArmorAC: armorLayerCA - objectProtectionBonus,
        context,
        version: globalThis.ADD2E_EFFECTS_ENGINE_VERSION
      };
    },

    getCAFixe(actor, context = {}) {
      return this.getConditionalFixedCA(actor, context).ca;
    },

    getConditionalFixedCA(actor, context = {}) {
      const tags = this.getActiveTags(actor);
      const frontOnly = tags.includes("condition:attaque_frontale")
        || tags.includes("condition:frontale")
        || tags.includes("frontale:oui");

      if (frontOnly && context.frontale === false) {
        return { ca: null, applied: false, reason: "not-front", tags, context };
      }

      const sousType = this.normalizeTag(context.sousType ?? context.attackSubtype ?? context.type ?? "");
      const candidates = [];

      const pushTag = (prefix, label) => {
        for (const tag of tags) {
          if (!tag.startsWith(prefix)) continue;
          const value = Number(tag.split(":")[1]);
          if (Number.isFinite(value)) candidates.push({ ca: value, tag, label });
        }
      };

      if (sousType === "projectile_lance") pushTag("ca_fixe_projectile_lance:", "projectile lancé à la main");
      else if (sousType === "projectile_propulse") pushTag("ca_fixe_projectile_propulse:", "projectile propulsé");
      else pushTag("ca_fixe_autres:", "attaque frontale");

      pushTag(`ca_fixe_${sousType}:`, sousType || "conditionnelle");

      for (const tag of tags) {
        if (!tag.startsWith("ca_fixe_conditionnelle:")) continue;
        const parts = tag.split(":");
        if (parts.length >= 3 && (parts[1] === sousType || !parts[1])) {
          const value = Number(parts[2]);
          if (Number.isFinite(value)) candidates.push({ ca: value, tag, label: parts[1] || "conditionnelle" });
        }
      }

      const passive = this.getMagicPassiveDefense(actor, context).fixedCA;
      if (Number.isFinite(passive)) {
        candidates.push({ ca: passive, tag: "magic-passive-fixed-ca", label: "CA fixe passive" });
      }

      if (!candidates.length) return { ca: null, applied: false, reason: "none", tags, context };
      const best = candidates.sort((a, b) => a.ca - b.ca)[0];
      return {
        ca: best.ca,
        applied: true,
        reason: "fixed-ca",
        sourceTag: best.tag,
        label: best.label,
        candidates,
        tags,
        context
      };
    },

    getCABonus(actor, context = {}) {
      let bonus = 0;
      for (const tag of this.getActiveTags(actor)) {
        if (tag.startsWith("bonus_ca:")) bonus += Number(tag.split(":")[1]) || 0;
        if (context.type === "magique" && tag.startsWith("bonus_ca_magique:")) bonus += Number(tag.split(":")[1]) || 0;
        if (context.type === "melee" && tag.startsWith("bonus_ca_melee:")) bonus += Number(tag.split(":")[1]) || 0;
        if (context.type === "projectile" && tag.startsWith("bonus_ca_projectile:")) bonus += Number(tag.split(":")[1]) || 0;
      }
      return bonus + this.getMagicPassiveDefense(actor, context).objectProtectionBonus;
    },

    getBonusCAVs(actor, typeAttaquant) {
      const normalized = this.normalizeKey(typeAttaquant);
      let bonus = 0;
      for (const tag of this.getActiveTags(actor)) {
        if (!tag.startsWith("bonus_ca_vs:")) continue;
        const [, type, value] = tag.split(":");
        if (this.normalizeKey(type) === normalized) bonus += Number(value) || 0;
      }
      return bonus;
    },

    getSaveBonusFrontal(actor) {
      let bonus = 0;
      for (const tag of this.getActiveTags(actor)) {
        if (tag.startsWith("bonus_save_frontal:")) bonus += Number(tag.split(":")[1]) || 0;
      }
      return bonus;
    },

    getSaveBonusVs(actor, vsType) {
      if (!actor || !vsType) return 0;
      let bonus = 0;
      const normalized = this.normalizeKey(vsType);

      for (const tag of this.getActiveTags(actor)) {
        if (tag.startsWith("bonus_save:")) {
          bonus += Number(tag.split(":")[1]) || 0;
          continue;
        }
        if (!tag.startsWith("bonus_save_vs:")) continue;

        const parts = tag.split(":");
        const type = this.normalizeKey(parts[1] || "");
        if (parts[2] === "const") continue;
        if (type === "tout" || type === "all" || (type && normalized.includes(type))) {
          bonus += Number(parts[2]) || 0;
        }
      }

      return bonus;
    },

    getBonusSaveConstitution(actor, saveType) {
      const tags = this.getActiveTags(actor);
      const normalized = this.normalizeKey(saveType);
      const poison = normalized.includes("poison");
      const magic = normalized.includes("magie")
        || normalized.includes("magic")
        || normalized.includes("sort")
        || normalized.includes("baguette")
        || normalized.includes("badine")
        || normalized.includes("baton")
        || normalized.includes("paralysie")
        || normalized.includes("petrification")
        || normalized.includes("souffle");

      let bonus = 0;
      if (poison && tags.includes("bonus_save_vs:poison:const")) {
        bonus += this.getConstitutionSaveBonus(actor);
      }
      if (magic && (
        tags.includes("bonus_save_vs:magie:const")
        || tags.includes("bonus_save_vs:sort:const")
        || tags.includes("bonus_save_vs:baguette:const")
      )) {
        bonus += this.getConstitutionSaveBonus(actor);
      }
      return bonus;
    },

    getBonusTouche(actor, typeArme) {
      const normalized = this.normalizeKey(typeArme);
      if (!normalized) return 0;
      let bonus = 0;
      for (const tag of this.getActiveTags(actor)) {
        if (!tag.startsWith("bonus_touche:")) continue;
        const [, weapon, value] = tag.split(":");
        if (this.normalizeKey(weapon) === normalized) bonus += Number(value) || 0;
      }
      return bonus;
    },

    getBonusToucheVs(actor, typeCible) {
      const normalized = this.normalizeKey(typeCible);
      let bonus = 0;
      for (const tag of this.getActiveTags(actor)) {
        if (!tag.startsWith("bonus_touche_vs:")) continue;
        const [, target, value] = tag.split(":");
        if (this.normalizeKey(target) === normalized) bonus += Number(value) || 0;
      }
      return bonus;
    },

    isCombatIdentityTag(tag) {
      const normalized = this.normalizeTag(tag);
      if (!normalized || normalized.length < 3) return false;
      return ADD2E_COMBAT_IDENTITY_PREFIXES.some(prefix => normalized.startsWith(prefix));
    },

    getCombatantTagSet(subject) {
      const tags = new Set();
      const system = subject?.system ?? {};
      const addField = raw => {
        for (const value of this.toArray(raw)) {
          const tag = this.normalizeTag(value);
          if (tag && tag.length >= 3) tags.add(tag);
        }
      };
      const addIdentityTags = raw => {
        for (const value of this.toArray(raw)) {
          const tag = this.normalizeTag(value);
          if (!this.isCombatIdentityTag(tag)) continue;
          tags.add(tag);
          const bare = tag.replace(/^(?:race|type|type_monstre|monstre|creature|creature_label|alignement|alignment):/, "");
          if (bare && bare.length >= 3) tags.add(bare);
        }
      };

      // Champs d’identité : l’espèce system.type_monstre est prioritaire pour les monstres.
      addField(subject?.type);
      addField(system.race);
      addField(system.type_monstre);
      addField(system.type);
      addField(system.categorie);
      addField(system.alignement);
      addField(system.alignment);
      addField(system.details?.alignment);

      // Tags structurés uniquement. Les chaînes dégradées et les tags non identitaires sont ignorés.
      for (const raw of [
        system.tags,
        system.effectTags,
        subject?.flags?.add2e?.tags,
        subject?.flags?.add2e?.effectTags,
        this.getActiveTags(subject)
      ]) addIdentityTags(raw);

      return tags;
    },

    combatantTagSetMatches(tagSet, matcher) {
      const wanted = this.normalizeTag(matcher);
      if (!wanted) return false;
      const stripped = wanted.replace(/^(?:race|type|type_monstre|monstre|creature|creature_label|alignement|alignment):/, "");
      if (!stripped) return false;

      const exactCandidates = new Set([
        wanted,
        stripped,
        `type_monstre:${stripped}`,
        `monstre:${stripped}`,
        `race:${stripped}`,
        `creature:${stripped}`,
        `creature_label:${stripped}`,
        `type:${stripped}`,
        `alignement:${stripped}`,
        `alignment:${stripped}`
      ]);

      return [...exactCandidates].some(candidate => tagSet?.has?.(candidate));
    },

    isEvilCombatant(subject) {
      const tags = this.getCombatantTagSet(subject);
      return [
        "alignement:mauvais",
        "alignment:evil",
        "loyal_mauvais",
        "neutre_mauvais",
        "chaotique_mauvais",
        "mauvais",
        "evil"
      ].some(tag => this.combatantTagSetMatches(tags, tag));
    },

    getAttackModifierAgainst(defender, attacker) {
      const defenderTags = this.getActiveTags(defender);
      const attackerTags = this.getCombatantTagSet(attacker);
      const details = [];
      let value = 0;
      const isEvil = this.isEvilCombatant(attacker);
      const hasProtectionSpecificMalus = defenderTags.includes("protection:mal")
        && defenderTags.some(tag => tag.startsWith("malus_attaque_creature_mauvaise:"));

      for (const rawTag of defenderTags) {
        const tag = this.normalizeTag(rawTag);
        if (!tag) continue;

        if (tag.startsWith("bonus_ca_vs:")) {
          const parts = tag.split(":");
          const matcher = parts.slice(1, -1).join(":");
          const amount = this.readNumber(parts.at(-1)) ?? 0;
          if (matcher && amount && this.combatantTagSetMatches(attackerTags, matcher)) {
            const modifier = -Math.abs(amount);
            value += modifier;
            details.push(`Défense raciale (${matcher}) : ${modifier} au toucher`);
          }
          continue;
        }

        if (tag.startsWith("malus_toucher_ennemi:") || tag.startsWith("malus_attaque_ennemi:")) {
          if (hasProtectionSpecificMalus) continue;
          const amount = Math.abs(this.readNumber(tag.split(":")[1]) ?? 0);
          if (amount) {
            value -= amount;
            details.push(`Effet défensif cible : -${amount} au toucher`);
          }
          continue;
        }

        if (tag.startsWith("malus_attaque_creature_mauvaise:")) {
          const amount = Math.abs(this.readNumber(tag.split(":")[1]) ?? 0);
          if (amount && isEvil) {
            value -= amount;
            details.push(`Protection contre le Mal : -${amount} au toucher`);
          }
          continue;
        }

        if (tag.startsWith("malus_attaque_vs:") || tag.startsWith("malus_toucher_vs:")) {
          const parts = tag.split(":");
          const matcher = parts.slice(1, -1).join(":");
          const amount = Math.abs(this.readNumber(parts.at(-1)) ?? 0);
          if (matcher && amount && this.combatantTagSetMatches(attackerTags, matcher)) {
            value -= amount;
            details.push(`Effet défensif cible (${matcher}) : -${amount} au toucher`);
          }
          continue;
        }

        if (tag.startsWith("bonus_attaque_ennemi:")) {
          const amount = this.readNumber(tag.split(":")[1]) ?? 0;
          if (amount) {
            value += amount;
            details.push(`Effet défensif cible : ${amount >= 0 ? "+" : ""}${amount} au toucher`);
          }
        }
      }

      return { value, details, attackerTags, defenderTags };
    },

    getAttackBonusAgainst(attacker, defender) {
      const attackerTags = this.getActiveTags(attacker);
      const defenderTags = this.getCombatantTagSet(defender);
      const details = [];
      let value = 0;

      for (const rawTag of attackerTags) {
        const tag = this.normalizeTag(rawTag);
        if (!tag?.startsWith("bonus_touche_vs:")) continue;
        const parts = tag.split(":");
        const matcher = parts.slice(1, -1).join(":");
        const amount = this.readNumber(parts.at(-1)) ?? 0;
        if (matcher && amount && this.combatantTagSetMatches(defenderTags, matcher)) {
          value += amount;
          details.push(`Bonus racial contre ${matcher} : ${amount >= 0 ? "+" : ""}${amount} au toucher`);
        }
      }

      return { value, details, attackerTags, defenderTags };
    }
  });
}
