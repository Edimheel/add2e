// ADD2E — Effects Engine / résistances, dégâts élémentaires et sauvegardes des objets.
// Les cartes de sort sont portées par leurs scripts onUse.

const register = (Engine, methods) => Object.defineProperties(
  Engine,
  Object.fromEntries(Object.entries(methods).map(([name, value]) => [
    name,
    { value, configurable: true, writable: true }
  ]))
);

// Guide du Maître — Matrice des jets de protection pour les objets magiques et non magiques.
// Ordre des colonnes : acide, boule de feu, chute, coup critique, coup normal,
// décharge électrique, désintégration, feu magique, feu normal, foudre, froid magique.
const OBJECT_SAVE_ATTACKS = Object.freeze([
  "acid",
  "fireball",
  "fall",
  "critical_hit",
  "normal_hit",
  "electric_discharge",
  "disintegration",
  "magic_fire",
  "normal_fire",
  "lightning",
  "magic_cold"
]);

const OBJECT_SAVE_MATRIX = Object.freeze({
  bone_ivory: Object.freeze([11, 17, 6, 16, 10, 1, 20, 9, 3, 8, 2]),
  ceramic: Object.freeze([4, 5, 11, 18, 12, 1, 19, 3, 2, 2, 4]),
  cloth: Object.freeze([12, 20, 2, 6, 3, 1, 20, 16, 13, 18, 1]),
  crystal_flask: Object.freeze([6, 10, 13, 19, 14, 5, 20, 6, 3, 15, 7]),
  glass: Object.freeze([5, 11, 14, 20, 15, 1, 20, 7, 4, 17, 6]),
  leather_tome: Object.freeze([10, 13, 1, 4, 2, 1, 20, 6, 4, 13, 3]),
  liquid: Object.freeze([15, 15, 0, 0, 0, 15, 20, 14, 13, 18, 12]),
  hard_metal: Object.freeze([7, 6, 2, 6, 2, 1, 17, 2, 1, 11, 1]),
  soft_metal_gem: Object.freeze([13, 18, 4, 14, 9, 1, 19, 13, 5, 16, 1]),
  mirror: Object.freeze([12, 14, 13, 20, 15, 1, 20, 9, 5, 18, 6]),
  parchment_paper: Object.freeze([16, 25, 0, 11, 6, 1, 20, 21, 18, 20, 2]),
  small_stone_gem: Object.freeze([3, 7, 4, 17, 7, 2, 18, 3, 2, 14, 1]),
  thin_wood_rope: Object.freeze([9, 15, 2, 13, 6, 1, 20, 11, 9, 10, 1]),
  thick_wood_rope: Object.freeze([8, 11, 1, 10, 3, 1, 19, 7, 5, 12, 1])
});

const OBJECT_SAVE_MATERIAL_ALIASES = Object.freeze({
  os: "bone_ivory",
  bone: "bone_ivory",
  ivoire: "bone_ivory",
  ivory: "bone_ivory",
  ceramique: "ceramic",
  ceramic: "ceramic",
  porcelaine: "ceramic",
  porcelain: "ceramic",
  vetement: "cloth",
  tissu: "cloth",
  cloth: "cloth",
  cristal: "crystal_flask",
  crystal: "crystal_flask",
  fiole: "crystal_flask",
  flask: "crystal_flask",
  verre: "glass",
  glass: "glass",
  cuir: "leather_tome",
  leather: "leather_tome",
  tome: "leather_tome",
  liquide: "liquid",
  liquid: "liquid",
  metal_dur: "hard_metal",
  hard_metal: "hard_metal",
  metal_tendre: "soft_metal_gem",
  soft_metal: "soft_metal_gem",
  joyau: "soft_metal_gem",
  jewel: "soft_metal_gem",
  miroir: "mirror",
  mirror: "mirror",
  parchemin: "parchment_paper",
  parchment: "parchment_paper",
  papier: "parchment_paper",
  paper: "parchment_paper",
  petite_pierre: "small_stone_gem",
  small_stone: "small_stone_gem",
  gemme: "small_stone_gem",
  gem: "small_stone_gem",
  bois_fin: "thin_wood_rope",
  thin_wood: "thin_wood_rope",
  corde_fine: "thin_wood_rope",
  thin_rope: "thin_wood_rope",
  bois_epais: "thick_wood_rope",
  thick_wood: "thick_wood_rope",
  corde_epaisse: "thick_wood_rope",
  thick_rope: "thick_wood_rope"
});

const OBJECT_SAVE_ATTACK_ALIASES = Object.freeze({
  acide: "acid",
  acid: "acid",
  boule_de_feu: "fireball",
  fireball: "fireball",
  souffle_de_feu: "fireball",
  chute: "fall",
  fall: "fall",
  coup_critique: "critical_hit",
  critical_hit: "critical_hit",
  coup_normal: "normal_hit",
  normal_hit: "normal_hit",
  decharge_electrique: "electric_discharge",
  electric_discharge: "electric_discharge",
  electricite: "electric_discharge",
  desintegration: "disintegration",
  disintegration: "disintegration",
  feu_magique: "magic_fire",
  magic_fire: "magic_fire",
  feu_normal: "normal_fire",
  normal_fire: "normal_fire",
  foudre: "lightning",
  lightning: "lightning",
  froid_magique: "magic_cold",
  magic_cold: "magic_cold"
});

function localNormalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function objectTags(item) {
  const values = [
    item?.system?.tags,
    item?.system?.effectTags,
    item?.flags?.add2e?.tags,
    item?.flags?.add2e?.effectTags
  ];
  const result = [];
  const add = value => {
    if (Array.isArray(value)) return value.forEach(add);
    if (value instanceof Set) return [...value].forEach(add);
    if (typeof value === "string") return value.split(/[,;|\n]+/g).forEach(entry => entry.trim() && result.push(entry.trim()));
  };
  values.forEach(add);
  return result;
}

function readObjectMaterial(itemOrMaterial) {
  if (typeof itemOrMaterial === "string") return itemOrMaterial;
  const explicit = itemOrMaterial?.system?.materiau
    ?? itemOrMaterial?.system?.matériau
    ?? itemOrMaterial?.system?.material
    ?? itemOrMaterial?.flags?.add2e?.materiau
    ?? itemOrMaterial?.flags?.add2e?.material
    ?? "";
  if (String(explicit).trim()) return explicit;
  const materialTag = objectTags(itemOrMaterial).find(tag => /^(?:materiau|matériau|material)\s*[:=]/i.test(tag));
  return materialTag ? materialTag.replace(/^(?:materiau|matériau|material)\s*[:=]\s*/i, "") : "";
}

function readMagicEnhancement(item) {
  const values = [
    item?.system?.bonus,
    item?.system?.bonus_magique,
    item?.system?.bonusMagique,
    item?.system?.enchantement,
    item?.system?.enhancement
  ];
  for (const value of values) {
    const match = String(value ?? "").match(/[+-]?\d+/);
    if (match) return Math.max(0, Number(match[0]) || 0);
  }
  return 0;
}

function damageSaveContext(element, context = {}) {
  const normalized = localNormalize(element);
  return {
    ...context,
    category: context.category ?? normalized,
    effectType: context.effectType ?? normalized,
    saveContext: context.saveContext ?? normalized,
    tags: [
      ...(Array.isArray(context.tags) ? context.tags : context.tags ? [context.tags] : []),
      ...(normalized ? [normalized, `damage:${normalized}`] : [])
    ],
    source: context.source ?? "damage-resistance-save"
  };
}

export function installEffectsEngineDamage(Engine) {
  register(Engine, {
    getObjectSaveMaterial(itemOrMaterial) {
      const raw = localNormalize(readObjectMaterial(itemOrMaterial));
      if (!raw) return "";
      if (Object.hasOwn(OBJECT_SAVE_MATRIX, raw)) return raw;
      return OBJECT_SAVE_MATERIAL_ALIASES[raw] ?? "";
    },

    getObjectSaveAttack(value) {
      const raw = localNormalize(value);
      if (!raw) return "";
      if (OBJECT_SAVE_ATTACKS.includes(raw)) return raw;
      return OBJECT_SAVE_ATTACK_ALIASES[raw] ?? "";
    },

    getObjectSaveThreshold(itemOrMaterial, attackType) {
      const material = this.getObjectSaveMaterial(itemOrMaterial);
      const attack = this.getObjectSaveAttack(attackType);
      const column = OBJECT_SAVE_ATTACKS.indexOf(attack);
      if (!material || column < 0) return null;
      const threshold = OBJECT_SAVE_MATRIX[material]?.[column];
      return Number.isFinite(Number(threshold)) ? Number(threshold) : null;
    },

    getObjectSaveMagicBonus(item, { ownType = false } = {}) {
      const magical = item?.system?.magique === true
        || item?.system?.magic === true
        || item?.system?.isMagic === true
        || item?.flags?.add2e?.magicItem === true;
      if (!magical) return ownType ? 5 : 0;
      const enhancement = readMagicEnhancement(item);
      const base = 2 + Math.max(0, enhancement - 1);
      return base + (ownType ? 5 : 0);
    },

    async rollObjectSave(itemOrMaterial, attackType, { modifier = 0, ownType = false } = {}) {
      const material = this.getObjectSaveMaterial(itemOrMaterial);
      const attack = this.getObjectSaveAttack(attackType);
      const threshold = this.getObjectSaveThreshold(material, attack);
      if (!material || !attack || threshold === null) {
        return { canRoll: false, material, attack, threshold: null, modifier: 0, total: 0, success: false, roll: null };
      }
      const magicBonus = typeof itemOrMaterial === "string" ? (ownType ? 5 : 0) : this.getObjectSaveMagicBonus(itemOrMaterial, { ownType });
      const finalModifier = (Number(modifier) || 0) + magicBonus;
      const roll = await new Roll("1d20").evaluate();
      const die = Number(roll.total) || 0;
      const total = die + finalModifier;
      return {
        canRoll: true,
        material,
        attack,
        threshold,
        modifier: finalModifier,
        die,
        total,
        success: threshold <= 0 || total >= threshold,
        roll
      };
    },

    getConstitutionTotal(actor, context = {}) {
      if (!actor) return 0;
      if (typeof this.resolveAbility !== "function") {
        throw new Error("Le résolveur canonique ADD2E des caractéristiques n’est pas disponible.");
      }
      const resolution = this.resolveAbility(actor, "constitution", {
        ...context,
        domain: context.domain ?? "save",
        type: context.type ?? "constitution-save-bonus",
        source: context.source ?? "constitution-save-bonus",
        consumer: context.consumer ?? "effects-engine-resistance"
      });
      const total = Number(resolution?.total);
      return Number.isFinite(total) ? total : 0;
    },

    getConstitutionSaveBonus(actor, context = {}) {
      return Math.max(0, Math.min(5, Math.floor(this.getConstitutionTotal(actor, context) / 3.5)));
    },

    getDamageContext(type = "", details = "") {
      const raw = `${String(type ?? "")} ${String(details ?? "")}`;
      const normalized = this.normalizeTag(raw);
      const typeKey = this.normalizeTag(type);
      const detailKey = this.normalizeTag(details);
      const cold = typeKey.includes("froid") || typeKey.includes("cold") || detailKey.includes("froid") || detailKey.includes("cold");
      const fire = typeKey.includes("feu") || typeKey.includes("fire") || detailKey.includes("feu") || detailKey.includes("fire");
      const element = cold ? "froid" : fire ? "feu" : "";
      const natural = element === "froid" && (
        normalized.includes("froid_naturel")
        || normalized.includes("cold_natural")
        || normalized.includes("froidnaturel")
      );
      const temperatureMatch = raw.match(/(?:temperature|temp)\s*[:=]\s*(-?\d+(?:[.,]\d+)?)/i);
      const temperature = temperatureMatch ? Number(String(temperatureMatch[1]).replace(",", ".")) : null;
      return { element, natural, temperature, raw, normalized };
    },

    getNaturalTemperatureLimit(tags, element) {
      for (const tag of tags) {
        const match = tag.match(new RegExp(`^temperature:${element}_naturel:(-?\\d+(?:\\.\\d+)?)$`));
        if (match) return Number(match[1]);
      }
      return null;
    },

    getDamageReductionFactor(value, fallback) {
      const normalized = this.normalizeTag(value);
      if (["annule", "zero", "0"].includes(normalized)) return 0;
      if (["quart", "quarter", "25", "0_25"].includes(normalized)) return 0.25;
      if (["moitie", "half", "50", "0_5"].includes(normalized)) return 0.5;
      const numeric = Number(String(value).replace(",", "."));
      if (Number.isFinite(numeric) && numeric >= 0 && numeric <= 1) return numeric;
      if (Number.isFinite(numeric) && numeric > 1 && numeric <= 100) return numeric / 100;
      return fallback;
    },

    getDamageResistanceRule(actor, element) {
      if (!actor || !element) return { found: false };
      const tags = this.getActiveTags(actor);
      const active = tags.includes(`resistance:${element}`)
        || tags.includes(`etat:resistance_${element}`)
        || tags.includes(`sort:resistance_au_${element}`)
        || tags.includes(`damage:resistance:${element}`);
      if (!active) return { found: false, tags };

      const failedTag = tags.find(tag => tag.startsWith(`reduction_degats:${element}:echec:`))
        ?? tags.find(tag => tag.startsWith(`degats_${element}_si_save_rate:`))
        ?? "";
      const succeededTag = tags.find(tag => tag.startsWith(`reduction_degats:${element}:reussite:`))
        ?? tags.find(tag => tag.startsWith(`degats_${element}_si_save_reussi:`))
        ?? "";
      const saveContext = damageSaveContext(element, { source: "damage-resistance-rule" });
      const bonus = typeof this.getSaveBonus === "function"
        ? Number(this.getSaveBonus(actor, "sorts", saveContext)) || 0
        : 0;

      return {
        found: true,
        tags,
        element,
        bonus,
        saveContext,
        failedMultiplier: this.getDamageReductionFactor(failedTag.split(":").at(-1), 0.5),
        succeededMultiplier: this.getDamageReductionFactor(succeededTag.split(":").at(-1), 0.25)
      };
    },

    getDamageSaveThreshold(actor, context = {}) {
      if (typeof this.getSaveTarget !== "function") {
        throw new Error("Le propriétaire canonique ADD2E des jets de sauvegarde n’est pas disponible.");
      }
      const threshold = Number(this.getSaveTarget(actor, "sorts", {
        ...context,
        source: context.source ?? "damage-save-threshold"
      }));
      return Number.isFinite(threshold) && threshold > 0 ? threshold : null;
    },

    async rollDamageSave(actor, bonus = 0, context = {}) {
      if (typeof this.rollSavingThrow !== "function") {
        throw new Error("L’exécuteur canonique ADD2E des jets de sauvegarde n’est pas disponible.");
      }
      const numericBonus = Number(bonus) || 0;
      const inheritedModifiers = Array.isArray(context.saveModifiers)
        ? context.saveModifiers
        : context.saveModifiers === undefined || context.saveModifiers === null
          ? []
          : [context.saveModifiers];
      const saveModifiers = [
        ...inheritedModifiers,
        ...(numericBonus ? [{
          id: `${context.source ?? "damage-save"}:explicit-bonus`,
          target: "sorts",
          value: numericBonus,
          label: context.bonusLabel ?? "Bonus explicite de sauvegarde aux dégâts",
          source: {
            kind: "damage",
            id: context.source ?? "damage-save",
            name: context.bonusLabel ?? "Résistance aux dégâts"
          }
        }] : [])
      ];
      const result = await this.rollSavingThrow(actor, "sorts", {
        ...context,
        saveModifiers,
        source: context.source ?? "damage-save",
        createChat: false,
        showDice: context.showDice !== false
      });
      return {
        ...result,
        canRoll: result?.ok === true,
        threshold: Number(result?.target),
        bonus: Number(result?.bonus) || 0
      };
    },

    async resolveIncomingDamage(actor, { amount = 0, type = "", details = "", chat = true } = {}) {
      const original = Math.max(0, Number(amount) || 0);
      if (!actor || original <= 0) return { amount: original, applied: false, original };

      const context = this.getDamageContext(type, details);
      if (!context.element) return { amount: original, applied: false, original, context };

      const tags = this.getActiveTags(actor);
      const naturalLimit = this.getNaturalTemperatureLimit(tags, context.element);

      if (
        context.natural
        && Number.isFinite(context.temperature)
        && Number.isFinite(naturalLimit)
        && context.temperature >= naturalLimit
      ) {
        return {
          amount: 0,
          applied: true,
          original,
          element: context.element,
          context,
          naturalProtection: true,
          naturalLimit,
          save: null
        };
      }

      const rule = this.getDamageResistanceRule(actor, context.element);
      if (!rule.found) return { amount: original, applied: false, original, context };

      const save = await this.rollDamageSave(actor, 0, damageSaveContext(context.element, {
        ...rule.saveContext,
        source: "damage-resistance-save"
      }));
      const multiplier = save.canRoll && save.success ? rule.succeededMultiplier : rule.failedMultiplier;
      const reduced = Math.max(1, Math.floor(original * multiplier));

      return {
        amount: reduced,
        applied: true,
        original,
        element: context.element,
        context,
        rule,
        save,
        naturalProtection: false
      };
    }
  });
}
