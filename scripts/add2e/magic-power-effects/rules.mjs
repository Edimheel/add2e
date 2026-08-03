// ADD2E — Pouvoirs d'objets magiques / compilation des règles et changements ActiveEffect.

import { clone, hasValue, list, norm, number, passivePower, signed, toRounds, uniqueBy } from "./runtime.mjs";

const ABILITY_ALIASES = Object.freeze({
  force: "force", strength: "force", str: "force",
  dexterite: "dexterite", dexterity: "dexterite", dex: "dexterite",
  constitution: "constitution", con: "constitution",
  intelligence: "intelligence", int: "intelligence",
  sagesse: "sagesse", wisdom: "sagesse", wis: "sagesse",
  charisme: "charisme", charisma: "charisme", cha: "charisme"
});

const SOCIAL_TARGET_ALIASES = Object.freeze({
  human: ["human", "humain", "humaine"],
  humain: ["human", "humain", "humaine"],
  humanoid: [
    "humanoid", "humanoide", "human", "humain", "humaine",
    "dwarf", "nain", "elf", "elfe", "gnome", "halfling", "petite-gens", "petite_gens",
    "half-elf", "half_elf", "demi-elfe", "demi_elfe",
    "half-orc", "half_orc", "demi-orque", "demi_orque",
    "orc", "orque", "goblin", "gobelin", "hobgoblin", "hobgobelin",
    "bugbear", "gobelours", "kobold", "gnoll", "ogre", "troll",
    "lizardman", "lizardfolk", "homme-lezard", "homme_lezard"
  ],
  humanoide: [
    "humanoid", "humanoide", "human", "humain", "humaine",
    "dwarf", "nain", "elf", "elfe", "gnome", "halfling", "petite-gens", "petite_gens",
    "half-elf", "half_elf", "demi-elfe", "demi_elfe",
    "half-orc", "half_orc", "demi-orque", "demi_orque",
    "orc", "orque", "goblin", "gobelin", "hobgoblin", "hobgobelin",
    "bugbear", "gobelours", "kobold", "gnoll", "ogre", "troll",
    "lizardman", "lizardfolk", "homme-lezard", "homme_lezard"
  ]
});

const DAMAGE_ALIASES = Object.freeze({
  feu: ["feu", "fire"], fire: ["feu", "fire"],
  froid: ["froid", "cold"], cold: ["froid", "cold"],
  acide: ["acide", "acid"], acid: ["acide", "acid"],
  electricite: ["electricite", "electricity", "foudre", "lightning"],
  electricity: ["electricite", "electricity", "foudre", "lightning"],
  foudre: ["electricite", "electricity", "foudre", "lightning"],
  lightning: ["electricite", "electricity", "foudre", "lightning"],
  poison: ["poison"],
  magie: ["magie", "magic"], magic: ["magie", "magic"],
  sommeil: ["sommeil", "sleep"], sleep: ["sommeil", "sleep"],
  charme: ["charme", "charm"], charm: ["charme", "charm"]
});

const MOVEMENT_TYPES = new Set([
  "movement_mode", "movement_bonus", "movement_modifier", "movement_multiplier", "movement_override",
  "movement_speed_multiplier", "speed_bonus", "speed_modifier", "speed_multiplier", "speed_override",
  "base_movement", "fixed_movement", "movement_weight_step_penalty", "weight_step_movement_penalty"
]);

const MOVEMENT_WEIGHT_STEP_TYPES = new Set([
  "movement_weight_step_penalty", "weight_step_movement_penalty"
]);

const ARMOR_BONUS_TYPES = new Set([
  "armor_class_bonus", "armor_bonus", "ac_bonus", "defense_bonus", "protection_bonus"
]);

const MOVEMENT_TARGET_ALIASES = Object.freeze({
  ground: "ground", sol: "ground", terrestre: "ground", marche: "ground", walking: "ground",
  flight: "flight", fly: "flight", vol: "flight", aerien: "flight", aerienne: "flight",
  ascent: "ascent", montee: "ascent", monter: "ascent",
  descent: "descent", descente: "descent", descendre: "descent",
  vertical: "vertical", levitation: "vertical",
  underwater: "underwater", sous_eau: "underwater", aquatique: "underwater",
  swim: "swim", nage: "swim", nager: "swim"
});

export const ruleType = rule => norm(rule?.type ?? rule?.kind ?? rule?.category ?? "");
export const canonicalAbility = value => ABILITY_ALIASES[norm(value)] ?? "";
export const damageAliases = value => DAMAGE_ALIASES[norm(value)] ?? (norm(value) ? [norm(value)] : []);

export function rulesOf(effect) {
  const raw = effect?.flags?.add2e?.rules;
  if (Array.isArray(raw)) return raw.filter(rule => rule && typeof rule === "object");
  if (!raw || typeof raw !== "object") return [];
  if (Array.isArray(raw.rules)) return raw.rules.filter(rule => rule && typeof rule === "object");
  return [raw];
}

const changeKey = change => `${change.key}|${Number(change.mode)}|${String(change.value)}|${Number(change.priority ?? 0)}`;
const modifierKey = modifier => JSON.stringify([
  modifier?.domain, modifier?.target, modifier?.operation, modifier?.value,
  modifier?.priority, modifier?.stacking, modifier?.conditions, modifier?.metadata
]);
export const uniqueChanges = changes => uniqueBy(changes.filter(change => change?.key), changeKey);
export const uniqueModifiers = modifiers => uniqueBy(modifiers.filter(modifier => modifier?.domain && modifier?.target), modifierKey);
export const uniqueTags = tags => uniqueBy(tags.map(value => String(value ?? "").trim()).filter(Boolean), value => norm(value));

function values(effect, keys) {
  return keys.flatMap(key => hasValue(effect?.[key]) ? list(effect[key]) : []);
}

function pushTag(tags, prefix, rawValues, suffix = null) {
  list(rawValues).map(norm).filter(Boolean).forEach(value => {
    tags.add(suffix == null ? `${prefix}:${value}` : `${prefix}:${value}:${suffix}`);
  });
}

function movementTarget(value) {
  const key = norm(value);
  return MOVEMENT_TARGET_ALIASES[key] ?? "";
}

function movementConditions(effect) {
  const conditions = effect?.conditions && typeof effect.conditions === "object" && !Array.isArray(effect.conditions)
    ? clone(effect.conditions)
    : {};
  const mappings = [
    ["terrain", ["terrain", "terrains"]],
    ["environment", ["environment", "environments", "milieu", "milieux"]],
    ["size", ["size", "sizes", "taille", "tailles"]],
    ["transformation", ["transformation", "transformations", "form", "forms", "forme", "formes"]],
    ["status", ["status", "statuses", "etat", "etats"]]
  ];
  for (const [target, keys] of mappings) {
    const raw = values(effect, keys);
    if (raw.length && conditions[target] === undefined) conditions[target] = raw;
  }
  return conditions;
}

function movementWeightStepConfig(effect, type) {
  if (!MOVEMENT_WEIGHT_STEP_TYPES.has(type)) return null;
  const threshold = number(
    effect.threshold,
    effect.freeWeight,
    effect.freeWeightGp,
    effect.startWeight,
    effect.startAt
  );
  const step = number(
    effect.step,
    effect.weightStep,
    effect.stepWeight,
    effect.weightPerStep
  );
  const rawPenalty = number(
    effect.penaltyPerStep,
    effect.penalty,
    effect.value,
    effect.amount,
    effect.modifier
  );
  if (!Number.isFinite(threshold)
    || threshold < 0
    || !Number.isFinite(step)
    || step <= 0
    || !Number.isFinite(rawPenalty)
    || rawPenalty === 0) return null;
  const requestedRounding = norm(effect.stepRounding ?? effect.rounding ?? "floor");
  return {
    kind: "carried-weight-step-penalty",
    threshold,
    step,
    penaltyPerStep: -Math.abs(rawPenalty),
    rounding: ["floor", "ceil", "round"].includes(requestedRounding) ? requestedRounding : "floor",
    weightUnit: norm(effect.weightUnit ?? effect.unit ?? "gp") || "gp"
  };
}

function movementCompilation(effect, type, tags, modifiers) {
  if (!MOVEMENT_TYPES.has(type)) return;
  const weightStep = movementWeightStepConfig(effect, type);
  const explicitMode = norm(effect.operation ?? effect.applyMode ?? effect.application ?? effect.mode);
  const multiplier = number(effect.multiplier, effect.factor, effect.coefficient);
  const direct = number(effect.value, effect.amount, effect.bonus, effect.modifier, effect.speed, effect.movement, effect.distance);
  const multiply = !weightStep && (type.includes("multiplier") || ["multiply", "multiplication", "multiplier", "factor"].includes(explicitMode));
  const override = !weightStep && (type.includes("override") || type.includes("fixed") || type === "base_movement"
    || ["override", "set", "fixed", "replace", "impose", "imposed"].includes(explicitMode));
  const value = weightStep ? 0 : multiply ? multiplier ?? direct : direct ?? multiplier;
  const operation = weightStep ? "add" : multiply ? "multiply" : override ? "set" : "add";
  const priority = Math.max(1, Math.floor(number(effect.priority) ?? 100));
  const requestedModes = values(effect, [
    "target", "targets", "movementTarget", "movementTargets", "movementMode", "movementModes",
    "modeName", "travelMode", "movementType", "modes"
  ]).map(movementTarget).filter(Boolean);
  if (!requestedModes.length && type === "movement_mode") {
    const candidate = movementTarget(effect.mode ?? effect.value ?? effect.movement);
    if (candidate) requestedModes.push(candidate);
  }
  const targets = [...new Set(requestedModes.length ? requestedModes : ["ground"])];
  for (const target of targets) {
    tags.add(`mouvement:${target}`);
    tags.add(`movement_mode:${target}`);
  }
  if (weightStep) {
    tags.add("mouvement_dynamique:poids_par_palier");
    tags.add("movement_dynamic:carried_weight_step_penalty");
  } else if (Number.isFinite(value)) {
    const tagValue = operation === "multiply" ? String(value) : signed(value);
    tags.add(`mouvement_${operation}:${tagValue}`);
    tags.add(`movement_${operation}:${tagValue}`);
  }
  if (!weightStep && !Number.isFinite(value)) return;

  const conditions = movementConditions(effect);
  const requestedStacking = norm(effect?.stacking?.mode ?? effect?.stackingMode ?? effect?.cumul ?? "");
  for (const target of targets) {
    const defaultStacking = operation === "set"
      ? { mode: "exclusive", group: `movement:${target}:override` }
      : operation === "multiply"
        ? { mode: "highest", group: `movement:${target}:multiplier` }
        : { mode: "stack", group: `movement:${target}:bonus` };
    const stacking = requestedStacking
      ? { mode: requestedStacking, group: String(effect?.stacking?.group ?? effect?.stackingGroup ?? defaultStacking.group) }
      : defaultStacking;
    modifiers.push({
      domain: "movement",
      target,
      operation,
      value,
      priority,
      stacking,
      conditions,
      metadata: {
        label: effect.label ?? effect.name ?? "Déplacement magique",
        producer: "magic-item-catalogue",
        effectType: type,
        modes: targets,
        movementMode: target,
        ignoresEncumbrance: effect.ignoreEncumbrance === true || effect.ignoresEncumbrance === true,
        ...(weightStep ? { dynamicValue: weightStep } : {}),
        ...(hasValue(effect.fatigueRule) ? { fatigueRule: clone(effect.fatigueRule) } : {})
      }
    });
  }
}

function characteristicCompilation(effect, type, tags, rules) {
  const bonusTypes = ["ability_bonus", "characteristic_bonus", "stat_bonus", "attribute_bonus"];
  const overrideTypes = ["ability_override", "characteristic_override", "stat_override", "attribute_override"];
  const modifierTypes = ["ability_modifier"];
  if (![...bonusTypes, ...overrideTypes, ...modifierTypes].includes(type)) return;
  const rawValue = number(effect.value, effect.bonus, effect.amount, effect.modifier, effect.score);
  if (!Number.isFinite(rawValue)) return;
  const abilities = [...new Set(values(effect, ["ability", "abilities", "stat", "stats", "attribute", "attributes", "characteristic", "characteristics", "target", "targetAny"])
    .map(canonicalAbility).filter(Boolean))];
  const explicitMode = norm(effect.mode ?? effect.operation ?? effect.applyMode);
  const override = overrideTypes.includes(type) || ["override", "set", "fixed", "replace", "impose", "imposed"].includes(explicitMode);
  const penalty = modifierTypes.includes(type) && ["penalty", "malus", "subtract", "subtraction", "soustraire"].includes(explicitMode);
  const value = penalty ? -Math.abs(rawValue) : rawValue;
  const priority = Math.max(1, Math.floor(number(effect.priority) ?? 100));
  const operation = override ? "override" : "add";

  for (const ability of abilities) {
    if (override) tags.add(`carac_override:${ability}:${value}`);
    else tags.add(`bonus_carac:${ability}:${signed(value)}`);
    rules.push({
      kind: override ? "characteristic_override" : "characteristic_bonus",
      type,
      characteristic: ability,
      value,
      operation,
      priority
    });
  }
}

function socialCompilation(effect, type, tags, rules, modifiers) {
  if (!["reaction_bonus", "reaction_modifier", "reaction_minimum"].includes(type)) return;
  const value = number(effect.value, effect.bonus, effect.amount, effect.minimum, effect.reactionBonus);
  if (!Number.isFinite(value)) return;
  const requested = norm(effect.operation ?? effect.mode ?? (type === "reaction_minimum" ? "minimum" : "add"));
  const minimum = type === "reaction_minimum" || ["minimum", "min", "at_least", "floor"].includes(requested);
  const targetAny = uniqueTags(values(effect, ["targetAny", "targets", "against", "creatureTypes", "races"]));
  const targetRaces = uniqueTags(targetAny.flatMap(target => SOCIAL_TARGET_ALIASES[norm(target)] ?? [target]));
  const priority = Math.max(1, Math.floor(number(effect.priority) ?? 100));
  const conditions = targetRaces.length ? { targetRaces } : {};
  const operation = minimum ? "minmax" : "add";
  const modifierValue = minimum ? { min: value, max: null } : value;
  tags.add(minimum ? `reaction_minimum:${value}` : `reaction_bonus:${signed(value)}`);
  targetAny.forEach(target => tags.add(`reaction_vs:${target}`));
  rules.push({ source: "magic-item-catalogue", type, kind: "reaction_modifier", value, operation, targetAny, priority });
  modifiers.push({
    domain: "reaction",
    target: "encounter",
    operation,
    value: modifierValue,
    priority,
    stacking: { mode: "stack", group: "reaction:magic-item" },
    conditions,
    metadata: {
      label: effect.label ?? effect.name ?? (minimum ? "Réaction minimale" : "Bonus aux réactions"),
      effectType: type,
      targetAny,
      targetRaces
    }
  });
}

function fixedArmorClassCompilation(effect, type, tags, rules) {
  if (!["fixed_armor_class", "armor_class_fixed", "armor_class_base", "fixed_ac", "ac_fixed",
    "classe_armure_fixe", "classe_armure_base", "ca_fixe", "ca_base", "defense_base"].includes(type)) return;
  const value = number(effect.value, effect.amount, effect.armorClass, effect.armor_class, effect.ac, effect.ca, effect.fixedCA, effect.fixedAc, effect.base);
  if (!Number.isFinite(value)) return;
  const ignoreDex = effect.ignoreDex === true || effect.ignore_dex === true || norm(effect.dex) === "ignore";
  tags.add(`ca_fixe:${value}`);
  tags.add(`fixed_ca:${value}`);
  rules.push({ kind: "armor_class_base", type: "armor_class_base", value, ignoreDex, label: effect.label ?? effect.name ?? "CA fixe magique" });
}

function defenseCompilation(effect, type, tags) {
  if (["damage_immunity", "attack_immunity", "condition_immunity", "immunity", "immunite"].includes(type)
    || type.endsWith("_immunity") || type.endsWith("_immunite")) {
    const inferred = type.replace(/_(?:immunity|immunite)$/, "");
    const raw = values(effect, ["attackAny", "damageAny", "damageTypes", "immunities", "types", "elements", "conditions", "targetAny", "against"]);
    for (const entry of raw.length ? raw : [inferred]) {
      for (const alias of damageAliases(entry)) {
        tags.add(`immunite:${alias}`);
        tags.add(`immunity:${alias}`);
      }
    }
  }
  if (["damage_resistance", "magic_resistance", "resistance", "resistance_damage"].includes(type)) {
    const raw = values(effect, ["attackAny", "damageAny", "damageTypes", "resistances", "types", "elements", "targetAny", "against", "kind"]);
    const targets = raw.length ? raw : type === "magic_resistance" ? ["magie"] : [];
    const percentage = number(effect.percentage, effect.percent, effect.pct, effect.value, effect.amount, effect.reduction);
    for (const entry of targets) {
      for (const alias of damageAliases(entry)) {
        if (Number.isFinite(percentage)) tags.add(`resistance:${alias}:${percentage}`);
        else tags.add(`resistance:${alias}`);
      }
    }
  }
  if (["saving_throw_bonus", "save_bonus", "saving_bonus", "bonus_save", "saving_throw_modifier", "permanent_save_modifier"].includes(type)) {
    let value = number(effect.bonus, effect.value, effect.amount, effect.modifier, effect.penalty);
    if (type === "permanent_save_modifier" && Number.isFinite(value) && value > 0) value = -Math.abs(value);
    const targets = values(effect, ["saveAny", "saveType", "saveTypes", "categories", "category", "against", "types", "targetAny"]);
    if (Number.isFinite(value) && value !== 0) {
      targets.length ? pushTag(tags, "bonus_save_vs", targets, signed(value)) : tags.add(`bonus_save:${signed(value)}`);
    }
  }
}

function armorClassTarget(effect, context = {}) {
  const requested = norm(effect.armorClassTarget ?? effect.armor_class_target ?? effect.target);
  if (["naturel", "natural"].includes(requested)) return "naturel";
  if (["total", "all", "tout"].includes(requested)) return "total";
  const sourceType = norm(context.sourceItem?.type ?? context.sourceItem?.system?.type);
  return ["armure", "armor"].includes(sourceType) ? "naturel" : "total";
}

function combatCompilation(effect, type, tags, rules, modifiers, context = {}) {
  if (["attack_bonus", "hit_bonus", "damage_bonus", "combat_bonus", "attack_damage_bonus", "weapon_magic_bonus"].includes(type)) {
    const attack = number(effect.attackBonus, effect.hitBonus, effect.bonusToucher, effect.toucher,
      type !== "damage_bonus" ? effect.bonus ?? effect.value : null);
    const damage = number(effect.damageBonus, effect.bonusDegats, effect.degats,
      type === "damage_bonus" ? effect.bonus ?? effect.value : null);
    if (attack) tags.add(`bonus_attaque:${signed(attack)}`);
    if (damage) tags.add(`bonus_degats:${signed(damage)}`);
  }
  if (ARMOR_BONUS_TYPES.has(type)) {
    const rawValue = number(effect.bonus, effect.value, effect.amount, effect.armorClassBonus, effect.acBonus);
    if (Number.isFinite(rawValue) && rawValue !== 0) {
      const bonus = Math.abs(rawValue);
      const target = armorClassTarget(effect, context);
      const priority = Math.max(1, Math.floor(number(effect.priority) ?? (100 + bonus)));
      const stacking = {
        mode: "unique-source",
        group: `armor-class:${target}:source-bonus`
      };
      rules.push({
        source: "magic-item-catalogue",
        kind: "armor_class_bonus",
        type,
        value: bonus,
        armorClassTarget: target,
        priority,
        stacking
      });
      modifiers.push({
        domain: "armor-class",
        target,
        operation: "add",
        value: -bonus,
        priority,
        stacking,
        conditions: {},
        metadata: {
          label: effect.label ?? effect.name ?? "Bonus de classe d’armure",
          producer: "magic-item-catalogue",
          effectType: type,
          armorClassTarget: target
        }
      });
    }
  }
  if (["conditional_attack_bonus", "conditional_damage_bonus"].includes(type)) {
    const value = number(effect.value, effect.bonus, effect.amount);
    const prefix = type === "conditional_attack_bonus" ? "bonus_attaque_conditionnel" : "bonus_degats_conditionnel";
    if (Number.isFinite(value)) pushTag(tags, prefix, effect.targetAny ?? effect.targets ?? effect.against, signed(value));
  }
  if (type === "conditional_armor_bonus") {
    const value = number(effect.value, effect.bonus, effect.amount, effect.armorBonus, effect.acBonus);
    const conditions = values(effect, ["condition", "conditions", "targetAny", "against"]).map(norm).filter(Boolean);
    if (Number.isFinite(value)) {
      for (const condition of conditions.length ? conditions : ["all"]) {
        if (["projectile", "projectiles", "missile", "missiles", "ranged"].includes(condition)) tags.add(`bonus_ca_projectile:${signed(value)}`);
        else tags.add(`bonus_ca_conditionnel:${condition}:${signed(value)}`);
      }
      rules.push({ kind: "conditional_armor_bonus", type, conditions: conditions.length ? conditions : ["all"], value });
    }
  }
  if (type === "negate_magic_projectile") {
    const chance = Math.max(0, Math.min(100, number(effect.chance, effect.percentage, effect.percent, effect.value) ?? 0));
    const arc = norm(effect.arc ?? effect.direction ?? effect.zone ?? "any") || "any";
    if (chance > 0) {
      tags.add(`negate_magic_projectile:${arc}:${chance}`);
      rules.push({ kind: "negate_magic_projectile", type, arc, chance });
    }
  }
}

export function compileDefinition(effect = {}, context = {}) {
  const type = ruleType(effect);
  const tags = new Set(list(effect.tags ?? effect.effectTags).map(String).filter(Boolean));
  const rules = [];
  const periodic = [];
  const changes = [];
  const modifiers = [];

  movementCompilation(effect, type, tags, modifiers);
  characteristicCompilation(effect, type, tags, rules);
  socialCompilation(effect, type, tags, rules, modifiers);
  fixedArmorClassCompilation(effect, type, tags, rules);
  defenseCompilation(effect, type, tags);
  combatCompilation(effect, type, tags, rules, modifiers, context);

  if (type === "regeneration") {
    const points = Math.max(0, Math.floor(number(effect.points, effect.value, effect.amount) ?? 0));
    const intervalRounds = toRounds(effect.interval);
    if (points && intervalRounds) {
      tags.add("regeneration");
      tags.add(`regeneration:${points}:${intervalRounds}`);
      periodic.push({
        type, points, interval: effect.interval, intervalRounds,
        restoresLostParts: effect.restoresLostParts === true,
        deathWindow: effect.deathWindow ?? null,
        deathWindowRounds: toRounds(effect.deathWindow),
        exceptions: list(effect.exceptions).map(norm).filter(Boolean)
      });
    }
  }
  if (type === "progressive_weapon_bonus") {
    const cycle = list(effect.cycle).map(Number).filter(Number.isFinite);
    if (cycle.length) periodic.push({ type, cycle });
  }

  if (Array.isArray(effect.rules)) rules.push(...clone(effect.rules));
  else if (effect.rule && typeof effect.rule === "object") rules.push(clone(effect.rule));
  if (type && type !== "charges" && !MOVEMENT_TYPES.has(type)
    && !ARMOR_BONUS_TYPES.has(type)
    && !["reaction_bonus", "reaction_modifier", "reaction_minimum"].includes(type)) {
    rules.push({ source: "magic-item-catalogue", type, ...clone(effect) });
  }
  return {
    type,
    tags: uniqueTags([...tags]),
    rules,
    periodic,
    changes: uniqueChanges(changes),
    modifiers: uniqueModifiers(modifiers)
  };
}

export function compilePower(power, { requirePassive = true, sourceItem = null } = {}) {
  if (requirePassive && !passivePower(power)) return null;
  const tags = new Set();
  const rules = [];
  const periodic = [];
  const changes = [];
  const modifiers = [];
  const handledTypes = [];
  for (const effect of Array.isArray(power?.effects) ? power.effects : []) {
    const compiled = compileDefinition(effect, { sourceItem });
    if (compiled.type) handledTypes.push(compiled.type);
    compiled.tags.forEach(tag => tags.add(tag));
    rules.push(...compiled.rules);
    periodic.push(...compiled.periodic);
    changes.push(...compiled.changes);
    modifiers.push(...compiled.modifiers);
  }
  return tags.size || rules.length || periodic.length || changes.length || modifiers.length
    ? {
        tags: uniqueTags([...tags]),
        rules,
        periodic,
        changes: uniqueChanges(changes),
        modifiers: uniqueModifiers(modifiers),
        handledTypes: [...new Set(handledTypes)]
      }
    : null;
}

export function compiledFromRules(rules = [], { sourceItem = null } = {}) {
  const tags = [];
  const changes = [];
  const modifiers = [];
  const normalizedRules = [];
  for (const rule of rules) {
    const compiled = compileDefinition(rule, { sourceItem });
    tags.push(...compiled.tags);
    changes.push(...compiled.changes);
    modifiers.push(...compiled.modifiers);
    normalizedRules.push(...compiled.rules);
  }
  return {
    tags: uniqueTags(tags),
    changes: uniqueChanges(changes),
    modifiers: uniqueModifiers(modifiers),
    rules: normalizedRules
  };
}

export function fixedArmorClassRule(rule = {}) {
  const type = ruleType(rule);
  if (!["fixed_armor_class", "armor_class_fixed", "armor_class_base", "fixed_ac", "ac_fixed",
    "classe_armure_fixe", "classe_armure_base", "ca_fixe", "ca_base", "defense_base"].includes(type)
    && norm(rule?.kind) !== "armor_class_base") return null;
  const value = number(rule.value, rule.amount, rule.armorClass, rule.armor_class, rule.ac, rule.ca, rule.fixedCA, rule.fixedAc, rule.base);
  if (!Number.isFinite(value)) return null;
  return { value, ignoreDex: rule.ignoreDex === true || rule.ignore_dex === true || norm(rule.dex) === "ignore", rule };
}
