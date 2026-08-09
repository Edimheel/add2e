// ADD2E — Effects Engine / résolution canonique des défenses, de la CA et des sauvegardes.
// Compatible Foundry V13/V14/V15.

const register = (Engine, methods) => Object.defineProperties(
  Engine,
  Object.fromEntries(Object.entries(methods).map(([name, value]) => [
    name,
    { value, configurable: true, writable: true }
  ]))
);

const ADD2E_ARMOR_CLASS_RESOLVER_VERSION = "2026-07-26-canonical-armor-class-v5-derived-dexterity";
const ADD2E_SAVE_RESOLVER_VERSION = "2026-08-09-canonical-save-owner-v8";

const ADD2E_SAVE_DEFINITIONS = Object.freeze([
  Object.freeze({ index: 0, key: "mort_paralysie", label: "Paralysie / poison / mort magique", shortLabel: "Paralysie", icon: "fas fa-skull-crossbones", aliases: Object.freeze(["mort_paralysie", "mort", "mort_magique", "paralysie", "poison", "death", "paralysis"]) }),
  Object.freeze({ index: 1, key: "petrification", label: "Pétrification / polymorphose", shortLabel: "Pétrification", icon: "fas fa-gem", aliases: Object.freeze(["petrification", "polymorphose", "polymorph", "metamorphose", "transformation"]) }),
  Object.freeze({ index: 2, key: "baguettes", label: "Baguettes, bâtons et bâtonnets", shortLabel: "Baguettes", icon: "fas fa-magic", aliases: Object.freeze(["baguette", "baguettes", "badine", "badines", "baton", "batons", "batonnet", "batonnets", "wand", "wands", "rod", "rods", "staff", "staves"]) }),
  Object.freeze({ index: 3, key: "souffle", label: "Souffles", shortLabel: "Souffles", icon: "fas fa-fire", aliases: Object.freeze(["souffle", "souffles", "breath", "breath_weapon", "breath_weapons"]) }),
  Object.freeze({ index: 4, key: "sorts", label: "Sortilèges", shortLabel: "Sorts", icon: "fas fa-scroll", aliases: Object.freeze(["sort", "sorts", "sortilege", "sortileges", "spell", "spells", "magie", "magic"]) })
]);

const ADD2E_MONSTER_FIGHTER_SAVE_PROGRESSION = Object.freeze([
  Object.freeze({ level: 0, saves: Object.freeze([16, 18, 17, 20, 19]) }),
  Object.freeze({ level: 1, saves: Object.freeze([14, 15, 16, 17, 17]) }),
  Object.freeze({ level: 3, saves: Object.freeze([13, 14, 15, 16, 16]) }),
  Object.freeze({ level: 5, saves: Object.freeze([11, 12, 13, 13, 14]) }),
  Object.freeze({ level: 7, saves: Object.freeze([10, 11, 12, 12, 13]) }),
  Object.freeze({ level: 9, saves: Object.freeze([8, 9, 10, 9, 11]) }),
  Object.freeze({ level: 11, saves: Object.freeze([7, 8, 9, 8, 10]) }),
  Object.freeze({ level: 13, saves: Object.freeze([5, 6, 7, 5, 8]) }),
  Object.freeze({ level: 15, saves: Object.freeze([4, 5, 6, 4, 7]) }),
  Object.freeze({ level: 17, saves: Object.freeze([3, 4, 5, 4, 6]) })
]);

const ADD2E_MENTAL_SAVE_KEYS = new Set([
  "mental", "attaque_mentale", "mental_attack", "charme", "charm", "hypnose", "hypnosis",
  "illusion", "peur", "effroi", "fear", "possession", "suggestion", "seduction", "telepathie",
  "telepathy", "fantasme", "phantasm", "enchantement", "enchantment"
]);

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

function add2eSaveNormalize(engine, value) {
  if (typeof engine?.normalizeTag !== "function") throw new Error("La normalisation canonique ADD2E n’est pas disponible.");
  return String(engine.normalizeTag(value) ?? "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function add2eSaveTag(engine, value) {
  if (typeof engine?.normalizeTag !== "function") throw new Error("La normalisation canonique ADD2E n’est pas disponible.");
  return String(engine.normalizeTag(value) ?? "");
}

function add2eSaveArray(value) {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(add2eSaveArray);
  if (value instanceof Set) return [...value].flatMap(add2eSaveArray);
  if (typeof value === "string") return value.split(/[,;|\n]+/g).map(entry => entry.trim()).filter(Boolean);
  return [value];
}

function add2eSaveDefinition(engine, value) {
  const numeric = Number(value);
  if (Number.isInteger(numeric) && numeric >= 0 && numeric < ADD2E_SAVE_DEFINITIONS.length) return ADD2E_SAVE_DEFINITIONS[numeric];
  const normalized = add2eSaveNormalize(engine, value);
  if (!normalized) return null;
  return ADD2E_SAVE_DEFINITIONS.find(definition => definition.key === normalized || definition.aliases.includes(normalized)) ?? null;
}

function add2eSaveReadFromCollection(engine, raw, definition) {
  if (!definition || raw === undefined || raw === null) return null;
  if (Array.isArray(raw)) {
    const value = engine.readNumber(raw[definition.index]);
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  if (typeof raw !== "object") return null;
  const accepted = new Set([definition.key, ...definition.aliases, `save${definition.index}`]);
  for (const [rawKey, rawValue] of Object.entries(raw)) {
    if (!accepted.has(add2eSaveNormalize(engine, rawKey))) continue;
    const value = engine.readNumber(rawValue);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return null;
}

function add2eSaveClassSources(engine, actor, definition) {
  if (typeof engine.getEmbeddedClassItems !== "function" || typeof engine.getEmbeddedClassLevel !== "function" || typeof engine.getClassProgressionEntryForPassiveRule !== "function") {
    throw new Error("Les API canoniques de progression de classe ADD2E ne sont pas disponibles.");
  }
  const sources = [];
  for (const classItem of engine.getEmbeddedClassItems(actor)) {
    const classLevel = engine.getEmbeddedClassLevel(classItem);
    if (!Number.isFinite(classLevel) || classLevel < 1) continue;
    const progression = engine.getClassProgressionEntryForPassiveRule({
      progression: "progression",
      source: {
        actor,
        classItemId: classItem?.id ?? null,
        classItemUuid: classItem?.uuid ?? null,
        className: classItem?.name ?? classItem?.system?.label ?? "Classe",
        classLevel
      }
    }, { actor });
    const target = add2eSaveReadFromCollection(engine, progression?.savingThrows, definition);
    if (!Number.isFinite(target) || target <= 0) continue;
    sources.push({
      kind: "class",
      target,
      classItem,
      className: classItem?.name ?? classItem?.system?.label ?? "Classe",
      classLevel: Number(classLevel),
      progression
    });
  }
  return sources;
}

function add2eMonsterHitDice(actor) {
  const raw = actor?.system?.hitDice;
  if (raw === undefined || raw === null || raw === "") return null;
  if (Number.isFinite(Number(raw)) && Number(raw) > 0) return Math.floor(Number(raw));
  const match = String(raw).trim().match(/\d+/);
  return match && Number(match[0]) > 0 ? Number(match[0]) : null;
}

function add2eSaveMonsterSource(actor, definition) {
  const actorType = String(actor?.type ?? "").trim().toLowerCase();
  if (!["monster", "monstre"].includes(actorType)) return null;
  const hitDice = add2eMonsterHitDice(actor);
  if (!Number.isFinite(hitDice) || hitDice < 1) return null;
  const progression = [...ADD2E_MONSTER_FIGHTER_SAVE_PROGRESSION].reverse().find(row => hitDice >= row.level) ?? null;
  const target = Number(progression?.saves?.[definition.index]);
  if (!Number.isFinite(target) || target <= 0) return null;
  return { kind: "monster-progression", target, actor, hitDice, progression, name: `Progression de guerrier · ${hitDice} DV` };
}

function add2eSaveTargetResolution(engine, actor, definition, context = {}) {
  const explicit = engine.readNumber(context.saveTarget, context.targetSave, context.threshold);
  if (Number.isFinite(explicit) && explicit > 0) {
    const selected = { kind: "context", target: explicit, name: context.saveTargetLabel ?? "Contexte de l’action" };
    return { definition, target: explicit, selected, candidates: [selected], classSources: [], actorSource: null, monsterSource: null, source: "context" };
  }
  const classSources = add2eSaveClassSources(engine, actor, definition);
  const monsterSource = add2eSaveMonsterSource(actor, definition);
  const candidates = classSources.length ? classSources : monsterSource ? [monsterSource] : [];
  const selected = [...candidates].sort((left, right) => Number(left.target) - Number(right.target))[0] ?? null;
  return {
    definition,
    target: Number(selected?.target),
    selected,
    candidates,
    classSources,
    actorSource: null,
    monsterSource,
    source: classSources.length ? "classes" : monsterSource ? "monster-progression" : "none"
  };
}

function add2eSaveContextKeys(engine, definition, context = {}) {
  const keys = new Set(["all", "tout", definition.key, ...definition.aliases].map(value => add2eSaveNormalize(engine, value)).filter(Boolean));
  const raw = [
    context.attackType, context.effectType, context.spellType, context.saveContext,
    context.category, context.saveCategory, context.type, context.actionType, context.source,
    ...add2eSaveArray(context.tags), ...add2eSaveArray(context.actionTags),
    ...add2eSaveArray(context.effectTags), ...add2eSaveArray(context.spellTags)
  ];
  for (const value of raw) {
    const normalized = add2eSaveNormalize(engine, value);
    if (!normalized) continue;
    keys.add(normalized);
    for (const part of normalized.split("_")) if (part) keys.add(part);
  }
  if ([...keys].some(key => ADD2E_MENTAL_SAVE_KEYS.has(key))) keys.add("mental");
  return keys;
}

function add2eSaveTagMatches(engine, definition, matcher, context = {}) {
  const normalized = add2eSaveNormalize(engine, matcher);
  return !!normalized && add2eSaveContextKeys(engine, definition, context).has(normalized);
}

function add2eSaveConstitutionBonus(engine, actor) {
  if (typeof engine.resolveAbility !== "function") throw new Error("Le résolveur canonique des caractéristiques ADD2E n’est pas disponible.");
  const total = Number(engine.resolveAbility(actor, "constitution", { type: "save", source: "saving-throw:constitution" })?.total);
  if (!Number.isFinite(total)) return 0;
  return Math.max(0, Math.min(5, Math.floor(total / 3.5)));
}

function add2eSaveIsMentalContext(engine, context = {}) {
  if (context.mental === true || context.mentalAttack === true || context.attackMental === true) return true;
  const keys = add2eSaveContextKeys(engine, ADD2E_SAVE_DEFINITIONS[4], context);
  return [...keys].some(key => ADD2E_MENTAL_SAVE_KEYS.has(key));
}

function add2eSaveMentalWisdomModifier(engine, actor, definition, context = {}) {
  if (!add2eSaveIsMentalContext(engine, context)) return null;
  if (typeof engine.resolveAbilityDerived !== "function") throw new Error("Le résolveur canonique des ajustements dérivés ADD2E n’est pas disponible.");
  const wisdomDerived = engine.resolveAbilityDerived(actor, "sagesse", {
    ...context,
    actor,
    type: "save",
    actionType: "save",
    source: `${context.source ?? "saving-throw"}:mental-wisdom`
  });
  const wisdom = Number(wisdomDerived?.total);
  const value = Number(wisdomDerived?.profile?.magie);
  if (!Number.isFinite(value) || value === 0) return null;
  return engine.createModifier({
    id: `${actor.id}:save:${definition.key}:mental-wisdom`,
    domain: "save",
    target: definition.key,
    operation: "add",
    value,
    priority: 100,
    stacking: { mode: "unique-source", group: "save:mental-wisdom" },
    source: { kind: "ability", id: `${actor.id}:sagesse`, uuid: actor.uuid ?? "", name: "Sagesse" },
    metadata: {
      label: "Ajustement de Sagesse contre les attaques mentales",
      producer: "resolved-ability-derived",
      ability: "sagesse",
      abilityValue: Number.isFinite(wisdom) ? wisdom : null,
      mental: true
    }
  });
}

function add2eSaveTransientModifiers(engine, actor, definition, context = {}) {
  const raw = context.saveModifiers ?? context.transientSaveModifiers ?? [];
  const entries = Array.isArray(raw) ? raw : [raw];
  const modifiers = [];
  entries.forEach((entry, index) => {
    if (entry === undefined || entry === null || entry === "") return;
    const data = typeof entry === "number" ? { value: entry } : entry;
    if (!data || typeof data !== "object") return;
    const value = Number(data.value ?? data.amount ?? data.bonus ?? data.modifier);
    if (!Number.isFinite(value) || value === 0) return;
    const requestedTarget = data.target ?? data.saveType ?? data.category ?? definition.key;
    if (!add2eSaveTagMatches(engine, definition, requestedTarget, context)) return;
    const label = String(data.label ?? data.name ?? "Modificateur circonstanciel de sauvegarde").trim();
    const id = String(data.id ?? `${context.source ?? "save"}:transient:${index}`);
    modifiers.push(engine.createModifier({
      id,
      domain: "save",
      target: definition.key,
      operation: String(data.operation ?? "add"),
      value,
      priority: Number.isFinite(Number(data.priority)) ? Number(data.priority) : 1000,
      stacking: data.stacking && typeof data.stacking === "object" ? data.stacking : { mode: "stack", group: null },
      source: {
        kind: String(data.source?.kind ?? "situational"),
        id: String(data.source?.id ?? id),
        uuid: String(data.source?.uuid ?? context.sourceItem?.uuid ?? ""),
        name: String(data.source?.name ?? context.sourceItem?.name ?? label)
      },
      metadata: {
        ...(data.metadata && typeof data.metadata === "object" ? data.metadata : {}),
        label,
        producer: "save-context",
        transient: true
      }
    }));
  });
  return modifiers;
}

function add2eSaveTagModifiers(engine, actor, definition, context = {}) {
  if (typeof engine.getActiveTags !== "function") throw new Error("La collecte canonique des tags ADD2E n’est pas disponible.");
  const modifiers = [];
  const push = ({ tag, value, label, suffix }) => {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount === 0) return;
    modifiers.push(engine.createModifier({
      id: `${actor.id}:save:${definition.key}:${suffix}:${tag}`,
      domain: "save",
      target: definition.key,
      operation: "add",
      value: amount,
      priority: 100,
      stacking: { mode: "stack", group: null },
      source: { kind: "tag", id: `${actor.id}:${tag}`, uuid: actor.uuid ?? "", name: actor.name ?? "Acteur" },
      metadata: { label, sourceTag: tag, producer: "save-tag-normalization" }
    }));
  };

  for (const rawTag of engine.getActiveTags(actor)) {
    const tag = add2eSaveTag(engine, rawTag);
    if (!tag) continue;
    if (tag.startsWith("bonus_save:")) {
      push({ tag, value: Number(tag.split(":").at(-1)), label: "Bonus général de sauvegarde", suffix: "general" });
      continue;
    }
    if (context.frontale === true && tag.startsWith("bonus_save_frontal:")) {
      push({ tag, value: Number(tag.split(":").at(-1)), label: "Bonus frontal de sauvegarde", suffix: "frontal" });
      continue;
    }
    if (!tag.startsWith("bonus_save_vs:")) continue;
    const parts = tag.split(":");
    const rawValue = parts.at(-1);
    const matcher = parts.slice(1, -1).join(":");
    if (!add2eSaveTagMatches(engine, definition, matcher, context)) continue;
    if (rawValue === "const") {
      push({ tag, value: add2eSaveConstitutionBonus(engine, actor), label: `Bonus racial de Constitution contre ${definition.shortLabel.toLowerCase()}`, suffix: "constitution" });
    } else {
      push({ tag, value: Number(rawValue), label: `Bonus de sauvegarde contre ${matcher || definition.shortLabel.toLowerCase()}`, suffix: "conditional" });
    }
  }
  return modifiers;
}

function add2eSaveCanonicalModifiers(engine, actor, definition, context = {}) {
  if (typeof engine.collect !== "function" || typeof engine.normalizeModifier !== "function") throw new Error("Le collecteur canonique de modificateurs ADD2E n’est pas disponible.");
  const modifiers = [];
  for (const raw of engine.collect(actor, context)) {
    const normalized = engine.normalizeModifier(raw, { source: raw?.source });
    if (!normalized || normalized.domain !== "save") continue;
    const sourceContext = raw?._context ?? {};
    const sourceItem = sourceContext.sourceItem ?? null;
    const sourceType = String(sourceItem?.type ?? "").toLowerCase();
    if (sourceItem && ADD2E_DEFENSIVE_EQUIPMENT_TYPES.has(sourceType) && !engine.itemEquipped(sourceItem)) continue;
    const target = add2eSaveNormalize(engine, normalized.target);
    if (!add2eSaveTagMatches(engine, definition, target, context)) continue;
    modifiers.push({ ...normalized, target: target === "all" || target === "tout" ? "all" : definition.key, _context: sourceContext });
  }
  return modifiers;
}

function add2eSaveDeduplicate(modifiers = []) {
  const seen = new Set();
  return modifiers.filter(modifier => {
    if (!modifier) return false;
    const source = modifier.source ?? {};
    const sourceTag = String(modifier.metadata?.sourceTag ?? "");
    const key = sourceTag || JSON.stringify([
      modifier.id, modifier.domain, modifier.target, modifier.operation, modifier.value,
      modifier.priority, modifier.stacking?.mode, modifier.stacking?.group,
      source.uuid ?? source.id ?? source.name ?? ""
    ]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function add2eResolveSavingThrow(engine, actor, saveType, context = {}) {
  if (!actor) throw new Error("Acteur manquant pour la résolution du jet de sauvegarde.");
  const definition = add2eSaveDefinition(engine, saveType);
  if (!definition) throw new Error(`Catégorie de sauvegarde inconnue : ${saveType}`);
  const saveContext = {
    ...context,
    actor,
    type: "save",
    actionType: "save",
    saveType: definition.key,
    saveCategory: definition.key,
    saveIndex: definition.index,
    source: context.source ?? "canonical-save-resolver"
  };
  const targetResolution = add2eSaveTargetResolution(engine, actor, definition, saveContext);
  const canonical = add2eSaveCanonicalModifiers(engine, actor, definition, saveContext);
  const canonicalSourceTags = new Set(canonical.map(modifier => String(modifier?.metadata?.sourceTag ?? "")).filter(Boolean));
  const tagModifiers = add2eSaveTagModifiers(engine, actor, definition, saveContext)
    .filter(modifier => !canonicalSourceTags.has(String(modifier?.metadata?.sourceTag ?? "")));
  const mentalWisdom = add2eSaveMentalWisdomModifier(engine, actor, definition, saveContext);
  const transient = add2eSaveTransientModifiers(engine, actor, definition, saveContext);
  const bonusResolution = engine.resolve(actor, {
    domain: "save",
    target: definition.key,
    base: 0,
    context: saveContext,
    modifiers: add2eSaveDeduplicate([
      ...canonical,
      ...tagModifiers,
      ...(mentalWisdom ? [mentalWisdom] : []),
      ...transient
    ])
  });
  return {
    definition,
    index: definition.index,
    key: definition.key,
    label: definition.label,
    target: targetResolution.target,
    targetResolution,
    bonus: Number(bonusResolution.total) || 0,
    bonusResolution,
    context: saveContext,
    version: ADD2E_SAVE_RESOLVER_VERSION
  };
}

async function add2eRollSavingThrow(engine, actor, saveType, options = {}) {
  const { createChat: _createChat = false, showDice = true, source = "canonical-save-executor", ...context } = options ?? {};
  if (!actor) {
    return { ok: false, canRoll: false, reason: "missing-actor", actor: null, resolution: null, roll: null, d20: null, bonus: 0, total: null, target: null, threshold: null, success: false, chatMessage: null, version: ADD2E_SAVE_RESOLVER_VERSION };
  }
  const resolution = engine.resolveSavingThrow(actor, saveType, { ...context, source });
  const target = Number(resolution?.target);
  if (!Number.isFinite(target) || target <= 0) {
    return { ok: false, canRoll: false, reason: "missing-target", actor, resolution, roll: null, d20: null, bonus: Number(resolution?.bonus) || 0, total: null, target: null, threshold: null, success: false, chatMessage: null, version: ADD2E_SAVE_RESOLVER_VERSION };
  }
  const roll = new Roll("1d20");
  await roll.evaluate();
  if (showDice !== false) {
    try { await game.dice3d?.showForRoll?.(roll); } catch (_error) {}
  }
  const d20 = Number(roll.total) || 0;
  const bonus = Number(resolution.bonus) || 0;
  const total = d20 + bonus;
  const success = total >= target;
  return {
    ok: true,
    canRoll: true,
    reason: "rolled",
    actor,
    resolution,
    roll,
    d20,
    bonus,
    total,
    target,
    threshold: target,
    success,
    chatMessage: null,
    version: ADD2E_SAVE_RESOLVER_VERSION
  };
}

function add2eInstallCanonicalSaveResolver(Engine) {
  register(Engine, {
    getSaveCategory(value) {
      const definition = add2eSaveDefinition(this, value);
      if (definition) return definition.key;
      const key = add2eSaveNormalize(this, value);
      if (key.includes("peur") || key.includes("fear")) return "peur";
      if (key.includes("poison")) return "poison";
      return key;
    },

    resolveSavingThrow(actor, saveType, context = {}) {
      return add2eResolveSavingThrow(this, actor, saveType, context);
    },

    rollSavingThrow(actor, saveType, options = {}) {
      return add2eRollSavingThrow(this, actor, saveType, options);
    },

    getSaveTarget(actor, saveType, context = {}) {
      return this.resolveSavingThrow(actor, saveType, { ...context, source: context.source ?? "get-save-target" }).target;
    },

    getSaveBonus(actor, saveType, options = {}) {
      return this.resolveSavingThrow(actor, saveType, { ...options, source: options.source ?? "get-save-bonus" }).bonus;
    },

    getActionSaveThreshold(actor, saveType = "sorts", context = {}) {
      return this.resolveSavingThrow(actor, saveType, { ...context, source: context.source ?? "action-save-threshold" }).target;
    },

    async rollActionSave(actor, saveType = "sorts", bonus = 0, context = {}) {
      const numericBonus = Number(bonus) || 0;
      const saveModifiers = [
        ...add2eSaveArray(context.saveModifiers),
        ...(numericBonus ? [{
          id: `${context.source ?? "action-save"}:explicit-bonus`,
          value: numericBonus,
          target: saveType,
          label: context.bonusLabel ?? "Bonus de sauvegarde de l’action",
          source: { kind: "action", id: context.source ?? "action-save", name: context.bonusLabel ?? "Action" }
        }] : [])
      ];
      const result = await this.rollSavingThrow(actor, saveType, {
        ...context,
        saveModifiers,
        source: context.source ?? "action-save",
        createChat: context.createChat === true,
        showDice: context.showDice !== false
      });
      return {
        ...result,
        type: result.resolution?.key ?? String(saveType ?? ""),
        threshold: Number(result.target),
        total: Number(result.total) || 0,
        bonus: Number(result.bonus) || 0,
        canRoll: result.ok === true
      };
    }
  });

  Engine.__add2eCanonicalSaveResolverVersion = ADD2E_SAVE_RESOLVER_VERSION;
  globalThis.ADD2E_SAVE_RESOLVER_VERSION = ADD2E_SAVE_RESOLVER_VERSION;
  globalThis.add2eResolveSavingThrow = (actor, saveType, context = {}) => Engine.resolveSavingThrow(actor, saveType, context);
  globalThis.add2eRollSavingThrow = (actor, saveType, options = {}) => Engine.rollSavingThrow(actor, saveType, options);
  globalThis.add2eGetSaveTarget = (actor, saveType, context = {}) => Engine.getSaveTarget(actor, saveType, context);
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

      const dex = ignoreDex ? 0 : this.getDexDefense(actor, { ...context, source: context.source ?? "armor-class-dexterity" });
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

  add2eInstallCanonicalSaveResolver(Engine);
  globalThis.ADD2E_ARMOR_CLASS_RESOLVER_VERSION = ADD2E_ARMOR_CLASS_RESOLVER_VERSION;
}