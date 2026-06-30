// ADD2E — Effects Engine / défenses, CA et bonus de sauvegarde.
// Extraction fonctionnelle sans changement de règle.

const register = (Engine, methods) => Object.defineProperties(
  Engine,
  Object.fromEntries(Object.entries(methods).map(([name, value]) => [
    name,
    { value, configurable: true, writable: true }
  ]))
);

export function installEffectsEngineDefense(Engine) {
  register(Engine, {
    getMagicPassiveDefense(actor, context = {}) {
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
    }
  });
}
