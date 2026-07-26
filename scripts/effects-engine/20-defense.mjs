// ADD2E — Effects Engine / résolution canonique des défenses et de la CA.
// Compatible Foundry V13/V14/V15.

const register = (Engine, methods) => Object.defineProperties(
  Engine,
  Object.fromEntries(Object.entries(methods).map(([name, value]) => [
    name,
    { value, configurable: true, writable: true }
  ]))
);

const ADD2E_ARMOR_CLASS_RESOLVER_VERSION = "2026-07-26-canonical-armor-class-v5-derived-dexterity";

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

const ADD2E_DEFENSIVE_EQUIPMENT_TYPES = new Set([
  "arme", "weapon", "armure", "armor", "objet", "object",
  "equipment", "magic", "objet_magique"
]);

function add2eArmorEffects(actor) {
  const seen = new Set();
  const values = [
    ...(actor?.effects?.contents ?? actor?.effects ?? []),
    ...(actor?.appliedEffects ?? [])
  ];
  return values.filter(effect => {
    const id = String(effect?.uuid ?? effect?.id ?? "");
    if (!effect || effect.disabled === true || effect.isSuppressed === true) return false;
    if (id && seen.has(id)) return false;
    if (id) seen.add(id);
    return true;
  });
}

function add2eArmorSource(document, fallbackKind = "effect") {
  const flags = document?.flags?.add2e ?? {};
  return {
    kind: String(flags.sourceType ?? flags.sourceKind ?? document?.type ?? fallbackKind),
    id: String(flags.sourceItemId ?? document?.id ?? document?._id ?? document?.name ?? fallbackKind),
    uuid: String(flags.sourceItemUuid ?? document?.uuid ?? ""),
    name: String(flags.sourceName ?? document?.name ?? document?.label ?? "Défense")
  };
}

function add2eArmorTarget(engine, value) {
  const key = engine.normalizeKey(value);
  if (["natural", "naturel", "ca_naturel", "ca-naturel", "armor_class_natural", "armor-class-natural", "classe_armure_naturelle", "classe-armure-naturelle"].includes(key)) return "naturel";
  if (["total", "ca", "ac", "armor_class", "armor-class", "classe_armure", "classe-armure", "ca_total", "ca-total"].includes(key)) return "total";
  return key;
}

function add2eArmorCanonicalModifier(engine, raw, targetFallback = "total") {
  const normalized = engine.normalizeModifier(raw, { domain: "armor-class", target: targetFallback });
  if (!normalized || normalized.domain !== "armor-class") return null;
  const target = add2eArmorTarget(engine, normalized.target);
  if (!["naturel", "total", "all"].includes(target)) return null;

  const sourceContext = raw?._context ?? {};
  const sourceItem = sourceContext.sourceItem ?? null;
  const sourceType = String(sourceItem?.type ?? "").toLowerCase();
  if (sourceItem && ADD2E_DEFENSIVE_EQUIPMENT_TYPES.has(sourceType) && !engine.itemEquipped(sourceItem)) return null;

  return { ...normalized, target, _context: sourceContext };
}

function add2eArmorChangeModifier(engine, effect, change, index) {
  const rawKey = String(change?.key ?? "");
  const target = rawKey === "system.ca_naturel" ? "naturel"
    : rawKey === "system.ca_total" ? "total"
      : null;
  if (!target) return null;

  const mode = Number(change?.mode);
  const modes = globalThis.CONST?.ACTIVE_EFFECT_MODES ?? {};
  let operation = null;
  let value = Number(change?.value);
  if (!Number.isFinite(value)) return null;
  if (mode === (modes.ADD ?? 2)) operation = "add";
  else if (mode === (modes.MULTIPLY ?? 1)) operation = "multiply";
  else if (mode === (modes.OVERRIDE ?? 5)) operation = "set";
  else if (mode === (modes.DOWNGRADE ?? 3)) {
    operation = "minmax";
    value = { max: value };
  } else if (mode === (modes.UPGRADE ?? 4)) {
    operation = "minmax";
    value = { min: value };
  } else return null;

  const source = add2eArmorSource(effect);
  return engine.createModifier({
    id: `${source.id}:armor-class:${target}:change:${index}`,
    domain: "armor-class",
    target,
    operation,
    value,
    priority: 100,
    stacking: operation === "set"
      ? { mode: "replace", group: `armor-class:${target}:override` }
      : { mode: "stack", group: null },
    source,
    metadata: { label: source.name, producer: "active-effect-change" }
  });
}

function add2eArmorChangeModifiers(engine, actor) {
  const modifiers = [];
  for (const effect of add2eArmorEffects(actor)) {
    (effect.changes ?? []).forEach((change, index) => {
      const modifier = add2eArmorChangeModifier(engine, effect, change, index);
      if (modifier) modifiers.push(modifier);
    });
  }
  return modifiers;
}

function add2eArmorTransformation(actor) {
  const profile = globalThis.add2eGetCapabilityTransformationCombatProfile?.(actor) ?? null;
  const armorClass = Number(profile?.armorClass);
  return Number.isFinite(armorClass) ? { ...profile, armorClass } : null;
}

function add2eArmorContextSubtype(engine, context = {}) {
  return engine.normalizeTag(context.sousType ?? context.attackSubtype ?? context.subtype ?? "");
}

function add2eArmorIsProjectile(subtype) {
  return ["projectile", "projectile_propulse", "projectile_lance"].includes(subtype);
}

function add2eArmorTagModifiers(engine, actor, context = {}) {
  const modifiers = [];
  const subtype = add2eArmorContextSubtype(engine, context);
  const projectile = add2eArmorIsProjectile(subtype) || context.isDistance === true;
  const melee = !projectile && (context.contact === true || context.type === "melee" || context.type === "attaque");
  const magical = context.magical === true || ["magique", "magic"].includes(engine.normalizeTag(context.damageType ?? context.typeDegats ?? context.attackType));
  const source = { kind: "active-tags", id: actor?.id ?? "actor", uuid: actor?.uuid ?? "", name: actor?.name ?? "Acteur" };
  let sequence = 0;

  const push = (value, label, tag) => {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount === 0) return;
    modifiers.push(engine.createModifier({
      id: `${source.id}:armor-class:tag:${sequence++}`,
      domain: "armor-class",
      target: "total",
      operation: "add",
      value: amount,
      priority: 100,
      stacking: { mode: "stack", group: null },
      source,
      metadata: { label, sourceTag: tag, producer: "active-tag" }
    }));
  };

  for (const rawTag of engine.getActiveTags?.(actor) ?? []) {
    const tag = engine.normalizeTag(rawTag);
    const parts = tag.split(":");
    const last = Number(parts.at(-1));
    if (!Number.isFinite(last) || last === 0) continue;

    if (tag.startsWith("bonus_ca:")) push(-Math.abs(last), "Bonus de CA", tag);
    else if (tag.startsWith("malus_ca:")) push(Math.abs(last), "Malus de CA", tag);
    else if (projectile && tag.startsWith("bonus_ca_projectile:")) push(-Math.abs(last), "Bonus de CA contre les projectiles", tag);
    else if (melee && tag.startsWith("bonus_ca_melee:")) push(-Math.abs(last), "Bonus de CA en mêlée", tag);
    else if (magical && tag.startsWith("bonus_ca_magique:")) push(-Math.abs(last), "Bonus de CA contre la magie", tag);
    else if (tag.startsWith("bonus_ca_conditionnel:")) {
      const matcher = engine.normalizeTag(parts.slice(1, -1).join(":"));
      const applies = matcher === subtype
        || (matcher === "projectile" && projectile)
        || (matcher === "melee" && melee)
        || (matcher === "magique" && magical);
      if (applies) push(-Math.abs(last), `Bonus de CA conditionnel (${matcher})`, tag);
    }
  }
  return modifiers;
}

function add2eArmorConditionalFixedCandidate(engine, actor, context = {}) {
  const tags = engine.getActiveTags?.(actor) ?? [];
  const subtype = add2eArmorContextSubtype(engine, context);
  const candidates = [];
  const frontOnly = tags.includes("condition:attaque_frontale")
    || tags.includes("condition:frontale")
    || tags.includes("frontale:oui");
  if (frontOnly && context.frontale === false) return null;

  const push = (tag, label) => {
    const value = Number(tag.split(":").at(-1));
    if (Number.isFinite(value)) candidates.push({ ca: value, tag, label });
  };

  for (const tag of tags) {
    if (subtype === "projectile_lance" && tag.startsWith("ca_fixe_projectile_lance:")) push(tag, "projectile lancé à la main");
    else if (subtype === "projectile_propulse" && tag.startsWith("ca_fixe_projectile_propulse:")) push(tag, "projectile propulsé");
    else if (subtype === "autres" && tag.startsWith("ca_fixe_autres:")) push(tag, "attaque de mêlée");
    else if (subtype && tag.startsWith(`ca_fixe_${subtype}:`)) push(tag, subtype);
    else if (tag.startsWith("ca_fixe_conditionnelle:")) {
      const parts = tag.split(":");
      const matcher = engine.normalizeTag(parts.slice(1, -1).join(":"));
      if (!matcher || matcher === subtype || (matcher === "projectile" && add2eArmorIsProjectile(subtype))) push(tag, matcher || "conditionnelle");
    }
  }
  return candidates.sort((left, right) => left.ca - right.ca)[0] ?? null;
}

function add2eArmorDeduplicate(modifiers = []) {
  const seen = new Set();
  return modifiers.filter(modifier => {
    if (!modifier) return false;
    const source = modifier.source ?? {};
    const key = JSON.stringify([
      modifier.domain,
      modifier.target,
      modifier.operation,
      modifier.value,
      modifier.priority,
      modifier.stacking?.mode,
      modifier.stacking?.group,
      source.uuid ?? source.id ?? source.name ?? ""
    ]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function add2eArmorLayerModifier(engine, { id, target = "naturel", value, source, label, priority = 50 }) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount === 0) return null;
  return engine.createModifier({
    id,
    domain: "armor-class",
    target,
    operation: "add",
    value: amount,
    priority,
    stacking: { mode: "stack", group: null },
    source,
    metadata: { label, producer: "armor-layer" }
  });
}

export function installEffectsEngineDefense(Engine) {
  register(Engine, {
    getDexDefense(actor, context = {}) {
      if (!actor) return 0;
      if (typeof this.resolveAbilityDerived !== "function") {
        throw new Error("Le résolveur canonique ADD2E des ajustements de caractéristiques n’est pas disponible.");
      }
      const derived = this.resolveAbilityDerived(actor, "dexterite", {
        ...context,
        domain: context.domain ?? "armor-class",
        type: context.type ?? "defensive-dexterity",
        source: context.source ?? "armor-class-dexterity",
        consumer: context.consumer ?? "effects-engine-defense"
      });
      const value = Number(derived?.profile?.def);
      return Number.isFinite(value) ? value : 0;
    },

    resolveArmorClass(actor, context = {}) {
      if (!actor) throw new Error("Acteur manquant pour la résolution de CA.");
      const system = actor.system ?? {};
      const items = this.equippedItems(actor);
      const armors = items.filter(item => ["armure", "armor"].includes(String(item.type ?? "").toLowerCase()));
      const objects = items.filter(item => !["armure", "armor"].includes(String(item.type ?? "").toLowerCase()));
      const worn = armors.filter(item => !this.isShieldItem(item) && !this.isHelmetItem(item));
      const shields = armors.filter(item => this.isShieldItem(item));
      const helmets = armors.filter(item => this.isHelmetItem(item));
      const defensiveObjects = objects.filter(item => this.itemFixedCA(item) !== null || this.itemDefenseBonus(item) !== 0);
      const actorType = String(actor.type ?? "").toLowerCase();
      const storedActorCA = actorType !== "personnage"
        ? this.readNumber(
          system.armorClass,
          system.ca,
          system.ac,
          system.ca_naturel,
          system.defense?.armorClass,
          system.defense?.ca,
          system.combat?.armorClass,
          system.combat?.ca
        )
        : null;
      const useStoredActorBase = Number.isFinite(storedActorCA)
        && !worn.length
        && !shields.length
        && !helmets.length
        && !defensiveObjects.length;

      const transformation = add2eArmorTransformation(actor);
      const monk = typeof this.getMonkMartialProgression === "function" ? this.getMonkMartialProgression(actor) : null;
      const monkArmorClass = Number(monk?.armorClass);
      const passiveArmorClass = typeof this.getPassiveArmorClassBase === "function"
        ? this.getPassiveArmorClassBase(actor, { ...context, ruleScope: "owner", source: context.source ?? "armor-class" })
        : null;
      const passiveBase = Number(passiveArmorClass?.value);

      let armorBase = 10;
      let armorName = "Aucune";
      let selectedArmor = null;
      for (const armor of worn) {
        const ac = this.readNumber(armor.system?.ac, armor.system?.ca, armor.system?.armorClass, armor.system?.base_ca, armor.system?.baseAC);
        if (Number.isFinite(ac) && ac < armorBase) {
          armorBase = ac;
          armorName = armor.name;
          selectedArmor = armor;
        }
      }

      let fixedCA = null;
      let fixedSource = "";
      let fixedItem = null;
      for (const object of objects) {
        const ca = this.itemFixedCA(object);
        if (Number.isFinite(ca) && (fixedCA === null || ca < fixedCA)) {
          fixedCA = ca;
          fixedSource = object.name;
          fixedItem = object;
        }
      }

      const mode = transformation ? "transformation"
        : useStoredActorBase ? "stored"
          : Number.isFinite(monkArmorClass) ? "monk"
            : passiveArmorClass?.applied && Number.isFinite(passiveBase) ? "passive"
              : "equipment";
      const fixedCAActive = mode === "equipment" && Number.isFinite(fixedCA);
      const base = transformation ? transformation.armorClass
        : mode === "stored" ? storedActorCA
          : mode === "monk" ? monkArmorClass
            : mode === "passive" ? passiveBase
              : fixedCAActive ? fixedCA
                : armorBase;

      const ignoreDex = !!transformation || mode === "stored" || mode === "monk" || passiveArmorClass?.ignoreDex === true || context.ignoreDex === true || context.ignoresDex === true;
      const ignoreShield = !!transformation || mode === "stored" || mode === "monk" || mode === "passive" || context.ignoreShield === true || context.ignoresShield === true;
      const ignoreEquipmentLayers = !!transformation || mode === "stored" || mode === "monk" || mode === "passive";
      const naturalModifiers = [];
      const totalModifiers = [];
      const selectedArmorMagicBonus = selectedArmor ? this.itemDefenseBonus(selectedArmor) : 0;
      const armorMagicBonus = !ignoreEquipmentLayers && !fixedCAActive ? selectedArmorMagicBonus : 0;
      const ignoredArmorMagicBonus = selectedArmorMagicBonus - armorMagicBonus;

      if (armorMagicBonus) {
        const modifier = add2eArmorLayerModifier(this, {
          id: `${selectedArmor.id}:armor-class:armor-magic`,
          value: -Math.abs(armorMagicBonus),
          source: add2eArmorSource(selectedArmor, "armor"),
          label: `${selectedArmor.name} — bonus magique`
        });
        if (modifier) naturalModifiers.push(modifier);
      }

      const dex = ignoreDex ? 0 : this.getDexDefense(actor, {
        ...context,
        source: context.source ?? "armor-class-dexterity"
      });
      const dexModifier = add2eArmorLayerModifier(this, {
        id: `${actor.id}:armor-class:dexterity`,
        value: dex,
        source: { kind: "ability", id: actor.id, uuid: actor.uuid ?? "", name: actor.name },
        label: "Dextérité défensive"
      });
      if (dexModifier) naturalModifiers.push(dexModifier);

      let shieldBonus = 0;
      const shieldSources = [];
      if (!ignoreShield) {
        for (const shield of shields) {
          const baseShield = Math.max(1, Math.abs(this.readNumber(shield.system?.ac, shield.system?.ca, shield.system?.armorClass) ?? 1));
          const magic = this.itemDefenseBonus(shield);
          const amount = baseShield + magic;
          shieldBonus += amount;
          shieldSources.push(`${shield.name}:${amount}`);
          const modifier = add2eArmorLayerModifier(this, {
            id: `${shield.id}:armor-class:shield`,
            value: -Math.abs(amount),
            source: add2eArmorSource(shield, "shield"),
            label: shield.name
          });
          if (modifier) naturalModifiers.push(modifier);
        }
      }

      let helmetBonus = 0;
      if (!ignoreEquipmentLayers) {
        for (const helmet of helmets) {
          const amount = Math.abs(this.readNumber(helmet.system?.ac, helmet.system?.ca, helmet.system?.armorClass) ?? 0) + this.itemDefenseBonus(helmet);
          helmetBonus += amount;
          const modifier = add2eArmorLayerModifier(this, {
            id: `${helmet.id}:armor-class:helmet`,
            value: -Math.abs(amount),
            source: add2eArmorSource(helmet, "helmet"),
            label: helmet.name
          });
          if (modifier) naturalModifiers.push(modifier);
        }
      }

      let objectProtectionBonus = 0;
      const objectSources = [];
      if (!transformation && mode !== "stored") {
        for (const object of objects) {
          if (object === fixedItem || this.itemFixedCA(object) !== null) continue;
          const bonus = this.itemDefenseBonus(object);
          if (!bonus) continue;
          objectProtectionBonus += bonus;
          objectSources.push(`${object.name}:${bonus}`);
          const modifier = add2eArmorLayerModifier(this, {
            id: `${object.id}:armor-class:object-protection`,
            target: "total",
            value: -Math.abs(bonus),
            source: add2eArmorSource(object, "equipment"),
            label: object.name
          });
          if (modifier) totalModifiers.push(modifier);
        }
      }

      const contextForModifiers = { ...context, actor, armorClassMode: mode, position: context.position };
      const collected = (typeof this.collect === "function" ? this.collect(actor, contextForModifiers) : [])
        .map(modifier => add2eArmorCanonicalModifier(this, modifier))
        .filter(Boolean);
      const changeModifiers = mode === "stored" ? [] : add2eArmorChangeModifiers(this, actor);

      if (!transformation) {
        naturalModifiers.push(...collected.filter(modifier => modifier.target === "naturel"));
        naturalModifiers.push(...changeModifiers.filter(modifier => modifier.target === "naturel"));
        totalModifiers.push(...collected.filter(modifier => modifier.target === "total" || modifier.target === "all"));
        totalModifiers.push(...changeModifiers.filter(modifier => modifier.target === "total"));
        totalModifiers.push(...add2eArmorTagModifiers(this, actor, context));
      } else {
        totalModifiers.push(...add2eArmorTagModifiers(this, actor, context).filter(modifier => /projectile|conditionnel/i.test(modifier.metadata?.label ?? "")));
      }

      const naturalResolution = this.resolve(actor, {
        domain: "armor-class",
        target: "naturel",
        base,
        context: contextForModifiers,
        modifiers: add2eArmorDeduplicate(naturalModifiers)
      });

      const conditionalFixed = add2eArmorConditionalFixedCandidate(this, actor, context);
      if (conditionalFixed && !transformation) {
        totalModifiers.push(this.createModifier({
          id: `${actor.id}:armor-class:conditional-fixed:${conditionalFixed.tag}`,
          domain: "armor-class",
          target: "total",
          operation: "minmax",
          value: { max: conditionalFixed.ca },
          priority: 300,
          stacking: { mode: "lowest", group: "armor-class:conditional-fixed" },
          source: { kind: "active-effect", id: actor.id, uuid: actor.uuid ?? "", name: conditionalFixed.label },
          metadata: { label: `CA fixe — ${conditionalFixed.label}`, sourceTag: conditionalFixed.tag }
        }));
      }

      const totalResolution = this.resolve(actor, {
        domain: "armor-class",
        target: "total",
        base: naturalResolution.total,
        context: contextForModifiers,
        modifiers: add2eArmorDeduplicate(totalModifiers)
      });
      const armorLayerCA = Number(base) - Math.abs(Number(armorMagicBonus) || 0);

      return {
        mode,
        armorBase,
        armorName,
        selectedArmor,
        armorMagicBonus,
        ignoredArmorMagicBonus,
        fixedCA,
        fixedSource,
        fixedCAActive,
        storedActorCA: Number.isFinite(storedActorCA) ? storedActorCA : null,
        transformation,
        monk,
        passiveArmorClass,
        baseAfterFixed: base,
        armorLayerCA,
        dex,
        dexIgnored: ignoreDex,
        shieldBonus,
        shieldSources,
        shieldIgnored: ignoreShield,
        helmetBonus,
        objectProtectionBonus,
        objectSources,
        caNaturel: Number(naturalResolution.total),
        caTotal: Number(totalResolution.total),
        syntheticArmorAC: armorLayerCA - objectProtectionBonus,
        naturalResolution,
        totalResolution,
        conditionalFixed: transformation ? null : conditionalFixed,
        context,
        version: ADD2E_ARMOR_CLASS_RESOLVER_VERSION
      };
    },

    getMagicPassiveDefense(actor, context = {}) {
      return this.resolveArmorClass(actor, context);
    },

    getCAFixe(actor, context = {}) {
      return this.getConditionalFixedCA(actor, context).ca;
    },

    getConditionalFixedCA(actor, context = {}) {
      const candidate = add2eArmorConditionalFixedCandidate(this, actor, context);
      return candidate
        ? { ca: candidate.ca, applied: true, reason: "fixed-ca", sourceTag: candidate.tag, label: candidate.label, candidates: [candidate], tags: this.getActiveTags(actor), context }
        : { ca: null, applied: false, reason: "none", tags: this.getActiveTags(actor), context };
    },

    getCABonus(actor, context = {}) {
      const resolved = this.resolveArmorClass(actor, context);
      return Math.max(0, Number(resolved.caNaturel) - Number(resolved.caTotal));
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
      for (const tag of this.getActiveTags(actor)) if (tag.startsWith("bonus_save_frontal:")) bonus += Number(tag.split(":")[1]) || 0;
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
        if (type === "tout" || type === "all" || (type && normalized.includes(type))) bonus += Number(parts[2]) || 0;
      }
      return bonus;
    },

    getBonusSaveConstitution(actor, saveType) {
      const tags = this.getActiveTags(actor);
      const normalized = this.normalizeKey(saveType);
      const poison = normalized.includes("poison");
      const magic = normalized.includes("magie") || normalized.includes("magic") || normalized.includes("sort")
        || normalized.includes("baguette") || normalized.includes("badine") || normalized.includes("baton")
        || normalized.includes("paralysie") || normalized.includes("petrification") || normalized.includes("souffle");
      let bonus = 0;
      if (poison && tags.includes("bonus_save_vs:poison:const")) bonus += this.getConstitutionSaveBonus(actor);
      if (magic && (tags.includes("bonus_save_vs:magie:const") || tags.includes("bonus_save_vs:sort:const") || tags.includes("bonus_save_vs:baguette:const"))) bonus += this.getConstitutionSaveBonus(actor);
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
      return !!normalized && normalized.length >= 3 && ADD2E_COMBAT_IDENTITY_PREFIXES.some(prefix => normalized.startsWith(prefix));
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
      addField(subject?.type);
      addField(system.race);
      addField(system.type_monstre);
      addField(system.type);
      addField(system.categorie);
      addField(system.alignement);
      addField(system.alignment);
      addField(system.details?.alignment);
      for (const raw of [system.tags, system.effectTags, subject?.flags?.add2e?.tags, subject?.flags?.add2e?.effectTags, this.getActiveTags(subject)]) addIdentityTags(raw);
      return tags;
    },

    combatantTagSetMatches(tagSet, matcher) {
      const wanted = this.normalizeTag(matcher);
      if (!wanted) return false;
      const stripped = wanted.replace(/^(?:race|type|type_monstre|monstre|creature|creature_label|alignement|alignment):/, "");
      if (!stripped) return false;
      return [wanted, stripped, `type_monstre:${stripped}`, `monstre:${stripped}`, `race:${stripped}`, `creature:${stripped}`, `creature_label:${stripped}`, `type:${stripped}`, `alignement:${stripped}`, `alignment:${stripped}`]
        .some(candidate => tagSet?.has?.(candidate));
    },

    isEvilCombatant(subject) {
      const tags = this.getCombatantTagSet(subject);
      return ["alignement:mauvais", "alignment:evil", "loyal_mauvais", "neutre_mauvais", "chaotique_mauvais", "mauvais", "evil"]
        .some(tag => this.combatantTagSetMatches(tags, tag));
    },

    getAttackModifierAgainst(defender, attacker) {
      const defenderTags = this.getActiveTags(defender);
      const attackerTags = this.getCombatantTagSet(attacker);
      const details = [];
      let value = 0;
      const isEvil = this.isEvilCombatant(attacker);
      const hasProtectionSpecificMalus = defenderTags.includes("protection:mal") && defenderTags.some(tag => tag.startsWith("malus_attaque_creature_mauvaise:"));
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
          if (amount) { value -= amount; details.push(`Effet défensif cible : -${amount} au toucher`); }
          continue;
        }
        if (tag.startsWith("malus_attaque_creature_mauvaise:")) {
          const amount = Math.abs(this.readNumber(tag.split(":")[1]) ?? 0);
          if (amount && isEvil) { value -= amount; details.push(`Protection contre le Mal : -${amount} au toucher`); }
          continue;
        }
        if (tag.startsWith("malus_attaque_vs:") || tag.startsWith("malus_toucher_vs:")) {
          const parts = tag.split(":");
          const matcher = parts.slice(1, -1).join(":");
          const amount = Math.abs(this.readNumber(parts.at(-1)) ?? 0);
          if (matcher && amount && this.combatantTagSetMatches(attackerTags, matcher)) { value -= amount; details.push(`Effet défensif cible (${matcher}) : -${amount} au toucher`); }
          continue;
        }
        if (tag.startsWith("bonus_attaque_ennemi:")) {
          const amount = this.readNumber(tag.split(":")[1]) ?? 0;
          if (amount) { value += amount; details.push(`Effet défensif cible : ${amount >= 0 ? "+" : ""}${amount} au toucher`); }
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

  globalThis.ADD2E_ARMOR_CLASS_RESOLVER_VERSION = ADD2E_ARMOR_CLASS_RESOLVER_VERSION;
}
