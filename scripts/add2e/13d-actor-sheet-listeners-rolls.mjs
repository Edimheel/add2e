// ADD2E — Actor sheet listeners : jets de caractéristiques, sauvegardes et HUD.
// Compatible Foundry V13/V14/V15.

export const ADD2E_SHEET_ROLL_DELEGATION_VERSION = "2026-07-24-canonical-save-executor-v7-final";
const ADD2E_SAVE_RESOLVER_VERSION = "2026-07-24-canonical-save-resolver-v5-final";

const ADD2E_SAVE_DEFINITIONS = Object.freeze([
  Object.freeze({
    index: 0,
    key: "mort_paralysie",
    label: "Paralysie / poison / mort magique",
    shortLabel: "Paralysie",
    icon: "fas fa-skull-crossbones",
    aliases: Object.freeze(["mort_paralysie", "mort", "mort_magique", "paralysie", "poison", "death", "paralysis"])
  }),
  Object.freeze({
    index: 1,
    key: "petrification",
    label: "Pétrification / polymorphose",
    shortLabel: "Pétrification",
    icon: "fas fa-gem",
    aliases: Object.freeze(["petrification", "polymorphose", "polymorph", "metamorphose", "transformation"])
  }),
  Object.freeze({
    index: 2,
    key: "baguettes",
    label: "Baguettes, bâtons et bâtonnets",
    shortLabel: "Baguettes",
    icon: "fas fa-magic",
    aliases: Object.freeze(["baguette", "baguettes", "badine", "badines", "baton", "batons", "batonnet", "batonnets", "wand", "wands", "rod", "rods", "staff", "staves"])
  }),
  Object.freeze({
    index: 3,
    key: "souffle",
    label: "Souffles",
    shortLabel: "Souffles",
    icon: "fas fa-fire",
    aliases: Object.freeze(["souffle", "souffles", "breath", "breath_weapon", "breath_weapons"])
  }),
  Object.freeze({
    index: 4,
    key: "sorts",
    label: "Sortilèges",
    shortLabel: "Sorts",
    icon: "fas fa-scroll",
    aliases: Object.freeze(["sort", "sorts", "sortilege", "sortileges", "spell", "spells", "magie", "magic"])
  })
]);

const ADD2E_SAVE_EQUIPMENT_TYPES = new Set([
  "arme", "weapon", "armure", "armor", "objet", "object",
  "equipment", "magic", "objet_magique"
]);

const ADD2E_MENTAL_SAVE_KEYS = new Set([
  "mental", "attaque_mentale", "mental_attack", "charme", "charm",
  "hypnose", "hypnosis", "illusion", "peur", "effroi", "fear",
  "possession", "suggestion", "seduction", "telepathie", "telepathy",
  "fantasme", "phantasm", "enchantement", "enchantment"
]);

export async function add2eEvaluateRollSafe(formula) {
  const roll = new Roll(String(formula || "0"));
  await roll.evaluate();
  return roll;
}

function add2eSheetRollEffectsEngine() {
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine ?? null;
  if (!engine) return null;
  add2eInstallCanonicalSaveResolver(engine);
  return engine;
}

function add2eSaveNormalize(engine, value) {
  const raw = typeof engine?.normalizeTag === "function"
    ? engine.normalizeTag(value)
    : String(value ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return String(raw ?? "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function add2eSaveTag(engine, value) {
  return typeof engine?.normalizeTag === "function"
    ? String(engine.normalizeTag(value) ?? "")
    : String(value ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_");
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
  if (Number.isInteger(numeric) && numeric >= 0 && numeric < ADD2E_SAVE_DEFINITIONS.length) {
    return ADD2E_SAVE_DEFINITIONS[numeric];
  }
  const normalized = add2eSaveNormalize(engine, value);
  if (!normalized) return null;
  return ADD2E_SAVE_DEFINITIONS.find(definition =>
    definition.key === normalized || definition.aliases.includes(normalized)
  ) ?? null;
}

function add2eSaveReadNumber(engine, ...values) {
  if (typeof engine?.readNumber === "function") return engine.readNumber(...values);
  for (const value of values) {
    if (value === undefined || value === null || value === "") continue;
    if (typeof value === "object") {
      const nested = add2eSaveReadNumber(engine, value.value, value.current, value.actuel, value.total, value.max);
      if (Number.isFinite(nested)) return nested;
      continue;
    }
    const number = Number(String(value).replace(",", "."));
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function add2eSaveReadFromCollection(engine, raw, definition) {
  if (!definition || raw === undefined || raw === null) return null;
  if (Array.isArray(raw)) {
    const value = add2eSaveReadNumber(engine, raw[definition.index]);
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  if (typeof raw !== "object") return null;

  const accepted = new Set([definition.key, ...definition.aliases, `save${definition.index}`]);
  for (const [rawKey, rawValue] of Object.entries(raw)) {
    if (!accepted.has(add2eSaveNormalize(engine, rawKey))) continue;
    const value = add2eSaveReadNumber(engine, rawValue);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return null;
}

function add2eSaveDirectActorValues(system, definition) {
  const common = [
    system?.[`sauvegarde_${definition.key}`],
    system?.[`save_${definition.key}`],
    system?.[`jp_${definition.key}`]
  ];
  if (definition.key === "mort_paralysie") {
    return [...common, system?.sauvegarde_mort, system?.sauvegarde_paralysie, system?.sauvegarde_poison, system?.jp_mort, system?.jp_paralysie, system?.jp_poison];
  }
  if (definition.key === "petrification") {
    return [...common, system?.sauvegarde_petrification, system?.sauvegarde_polymorphose, system?.jp_petrification, system?.jp_polymorphose];
  }
  if (definition.key === "baguettes") {
    return [...common, system?.sauvegarde_baguettes, system?.sauvegarde_batons, system?.sauvegarde_batonnets, system?.jp_baguettes, system?.jp_batons];
  }
  if (definition.key === "souffle") {
    return [...common, system?.sauvegarde_souffle, system?.sauvegarde_souffles, system?.jp_souffle, system?.jp_souffles];
  }
  return [...common, system?.sauvegarde_sortileges, system?.sauvegarde_sorts, system?.jp_sort, system?.jp_sorts, system?.jp_sortileges];
}

function add2eSaveClassSources(engine, actor, definition) {
  const sources = [];
  const classItems = typeof engine.getEmbeddedClassItems === "function"
    ? engine.getEmbeddedClassItems(actor)
    : Array.from(actor?.items ?? []).filter(item => String(item?.type ?? "").toLowerCase() === "classe");

  for (const classItem of classItems) {
    const classLevel = typeof engine.getEmbeddedClassLevel === "function"
      ? engine.getEmbeddedClassLevel(classItem)
      : add2eSaveReadNumber(engine, classItem?.system?.niveau, classItem?.system?.level);

    let progression = null;
    if (typeof engine.getClassProgressionEntryForPassiveRule === "function") {
      progression = engine.getClassProgressionEntryForPassiveRule({
        progression: "progression",
        source: {
          actor,
          classItemId: classItem?.id ?? null,
          classItemUuid: classItem?.uuid ?? null,
          className: classItem?.name ?? classItem?.system?.label ?? "Classe",
          classLevel
        }
      }, { actor });
    }

    if (!progression) {
      const rows = Array.isArray(classItem?.system?.progression) ? classItem.system.progression : [];
      progression = rows.find(row => Number(row?.niveau ?? row?.level) === Number(classLevel))
        ?? rows[Math.max(0, Math.min(rows.length - 1, Number(classLevel || 1) - 1))]
        ?? null;
    }

    const target = add2eSaveReadFromCollection(
      engine,
      progression?.savingThrows
        ?? progression?.saves
        ?? progression?.jets_sauvegarde
        ?? progression?.sauvegardes,
      definition
    );
    if (!Number.isFinite(target) || target <= 0) continue;

    sources.push({
      kind: "class",
      target,
      classItem,
      className: classItem?.name ?? classItem?.system?.label ?? "Classe",
      classLevel: Number(classLevel) || null,
      progression
    });
  }
  return sources;
}

function add2eSaveActorSource(engine, actor, definition) {
  const system = actor?.system ?? {};
  for (const raw of [
    system.sauvegardes,
    system.calculatedSaves,
    system.savingThrows,
    system.saves,
    system.jets_sauvegarde,
    system.defense?.savingThrows,
    system.combat?.savingThrows,
    actor?.calculatedSaves
  ]) {
    const target = add2eSaveReadFromCollection(engine, raw, definition);
    if (Number.isFinite(target) && target > 0) {
      return { kind: "actor", target, actor, name: actor?.name ?? "Acteur" };
    }
  }

  const target = add2eSaveReadNumber(engine, ...add2eSaveDirectActorValues(system, definition));
  return Number.isFinite(target) && target > 0
    ? { kind: "actor", target, actor, name: actor?.name ?? "Acteur" }
    : null;
}

function add2eSaveTargetResolution(engine, actor, definition, context = {}) {
  const explicit = add2eSaveReadNumber(engine, context.saveTarget, context.targetSave, context.threshold);
  if (Number.isFinite(explicit) && explicit > 0) {
    const selected = { kind: "context", target: explicit, name: context.saveTargetLabel ?? "Contexte de l’action" };
    return {
      definition,
      target: explicit,
      selected,
      candidates: [selected],
      classSources: [],
      actorSource: null,
      source: "context"
    };
  }

  const classSources = add2eSaveClassSources(engine, actor, definition);
  const actorSource = add2eSaveActorSource(engine, actor, definition);
  const candidates = classSources.length ? classSources : (actorSource ? [actorSource] : []);
  const selected = [...candidates].sort((left, right) => Number(left.target) - Number(right.target))[0] ?? null;
  return {
    definition,
    target: Number(selected?.target),
    selected,
    candidates,
    classSources,
    actorSource,
    source: classSources.length ? "classes" : actorSource ? "actor" : "none"
  };
}

function add2eSaveContextKeys(engine, definition, context = {}) {
  const keys = new Set(["all", "tout", definition.key, ...definition.aliases].map(value => add2eSaveNormalize(engine, value)).filter(Boolean));
  const raw = [
    context.attackType,
    context.effectType,
    context.spellType,
    context.saveContext,
    context.category,
    context.saveCategory,
    context.type,
    context.actionType,
    context.source,
    ...add2eSaveArray(context.tags),
    ...add2eSaveArray(context.actionTags),
    ...add2eSaveArray(context.effectTags),
    ...add2eSaveArray(context.spellTags)
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
  if (!normalized) return false;
  return add2eSaveContextKeys(engine, definition, context).has(normalized);
}

function add2eSaveConstitutionBonus(engine, actor) {
  const total = typeof engine.resolveAbility === "function"
    ? Number(engine.resolveAbility(actor, "constitution", { type: "save", source: "saving-throw" })?.total)
    : add2eSaveReadNumber(engine, actor?.system?.constitution_base, actor?.system?.constitution);
  if (!Number.isFinite(total)) return 0;
  return Math.max(0, Math.min(5, Math.floor(total / 3.5)));
}

function add2eSaveIsMentalContext(engine, context = {}) {
  if (context.mental === true || context.mentalAttack === true || context.attackMental === true) return true;
  const keys = add2eSaveContextKeys(engine, ADD2E_SAVE_DEFINITIONS[4], context);
  return [...keys].some(key => ADD2E_MENTAL_SAVE_KEYS.has(key));
}

function add2eSaveWisdomAdjustment(value) {
  const wisdom = Number(value);
  if (!Number.isFinite(wisdom)) return 0;
  if (wisdom <= 3) return -3;
  if (wisdom === 4) return -2;
  if (wisdom <= 7) return -1;
  if (wisdom <= 14) return 0;
  if (wisdom === 15) return 1;
  if (wisdom === 16) return 2;
  if (wisdom === 17) return 3;
  return 4;
}

function add2eSaveMentalWisdomModifier(engine, actor, definition, context = {}) {
  if (!add2eSaveIsMentalContext(engine, context)) return null;
  const wisdom = typeof engine.resolveAbility === "function"
    ? Number(engine.resolveAbility(actor, "sagesse", {
        ...context,
        actor,
        type: "save",
        actionType: "save",
        source: `${context.source ?? "saving-throw"}:mental-wisdom`
      })?.total)
    : add2eSaveReadNumber(
        engine,
        actor?.system?.sagesse_base,
        actor?.system?.sagesse,
        actor?.system?.sag_aff,
        actor?.system?.abilities?.wis?.value
      );
  const value = add2eSaveWisdomAdjustment(wisdom);
  if (!Number.isFinite(value) || value === 0) return null;

  return engine.createModifier({
    id: `${actor.id}:save:${definition.key}:mental-wisdom`,
    domain: "save",
    target: definition.key,
    operation: "add",
    value,
    priority: 100,
    stacking: { mode: "unique-source", group: "save:mental-wisdom" },
    source: {
      kind: "ability",
      id: `${actor.id}:sagesse`,
      uuid: actor.uuid ?? "",
      name: "Sagesse"
    },
    metadata: {
      label: "Ajustement de Sagesse contre les attaques mentales",
      producer: "resolved-ability",
      ability: "sagesse",
      abilityValue: wisdom,
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
      stacking: data.stacking && typeof data.stacking === "object"
        ? data.stacking
        : { mode: "stack", group: null },
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
  const modifiers = [];
  const tags = typeof engine.getActiveTags === "function" ? engine.getActiveTags(actor) : [];
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
      source: {
        kind: "tag",
        id: `${actor.id}:${tag}`,
        uuid: actor.uuid ?? "",
        name: actor.name ?? "Acteur"
      },
      metadata: { label, sourceTag: tag, producer: "save-tag-normalization" }
    }));
  };

  for (const rawTag of tags) {
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
      push({
        tag,
        value: add2eSaveConstitutionBonus(engine, actor),
        label: `Bonus racial de Constitution contre ${definition.shortLabel.toLowerCase()}`,
        suffix: "constitution"
      });
    } else {
      push({
        tag,
        value: Number(rawValue),
        label: `Bonus de sauvegarde contre ${matcher || definition.shortLabel.toLowerCase()}`,
        suffix: "conditional"
      });
    }
  }
  return modifiers;
}

function add2eSaveCanonicalModifiers(engine, actor, definition, context = {}) {
  const collected = typeof engine.collect === "function" ? engine.collect(actor, context) : [];
  const modifiers = [];

  for (const raw of collected) {
    const normalized = engine.normalizeModifier(raw, { source: raw?.source });
    if (!normalized || normalized.domain !== "save") continue;

    const sourceContext = raw?._context ?? {};
    const sourceItem = sourceContext.sourceItem ?? null;
    const sourceType = String(sourceItem?.type ?? "").toLowerCase();
    if (sourceItem && ADD2E_SAVE_EQUIPMENT_TYPES.has(sourceType) && !engine.itemEquipped(sourceItem)) continue;

    const target = add2eSaveNormalize(engine, normalized.target);
    if (!add2eSaveTagMatches(engine, definition, target, context)) continue;
    modifiers.push({
      ...normalized,
      target: target === "all" || target === "tout" ? "all" : definition.key,
      _context: sourceContext
    });
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
      modifier.id,
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
  const canonicalSourceTags = new Set(
    canonical.map(modifier => String(modifier?.metadata?.sourceTag ?? "")).filter(Boolean)
  );
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

async function add2eResolveMonsterSheetTarget(engine, actor, definition) {
  if (String(actor?.type ?? "").toLowerCase() !== "monster") return null;
  try {
    const data = await actor?.sheet?.getData?.();
    for (const raw of [data?.calculatedSaves, data?.sauvegardes, data?.savingThrows, data?.saves]) {
      const target = add2eSaveReadFromCollection(engine, raw, definition);
      if (Number.isFinite(target) && target > 0) return target;
    }
  } catch (_error) {}
  return null;
}

async function add2eRollSavingThrow(engine, actor, saveType, options = {}) {
  const {
    createChat = false,
    showDice = true,
    source = "canonical-save-executor",
    ...context
  } = options ?? {};

  if (!actor) {
    return {
      ok: false,
      canRoll: false,
      reason: "missing-actor",
      actor: null,
      resolution: null,
      roll: null,
      d20: null,
      bonus: 0,
      total: null,
      target: null,
      threshold: null,
      success: false,
      chatMessage: null,
      version: ADD2E_SAVE_RESOLVER_VERSION
    };
  }

  let resolution = engine.resolveSavingThrow(actor, saveType, { ...context, source });
  let target = Number(resolution?.target);
  if (!Number.isFinite(target) || target <= 0) {
    const monsterTarget = await add2eResolveMonsterSheetTarget(engine, actor, resolution?.definition ?? add2eSaveDefinition(engine, saveType));
    if (Number.isFinite(monsterTarget) && monsterTarget > 0) {
      resolution = engine.resolveSavingThrow(actor, saveType, {
        ...context,
        source,
        saveTarget: monsterTarget,
        saveTargetLabel: "Sauvegarde calculée du monstre"
      });
      target = Number(resolution?.target);
    }
  }

  if (!Number.isFinite(target) || target <= 0) {
    return {
      ok: false,
      canRoll: false,
      reason: "missing-target",
      actor,
      resolution,
      roll: null,
      d20: null,
      bonus: Number(resolution?.bonus) || 0,
      total: null,
      target: null,
      threshold: null,
      success: false,
      chatMessage: null,
      version: ADD2E_SAVE_RESOLVER_VERSION
    };
  }

  const roll = await add2eEvaluateRollSafe("1d20");
  if (showDice !== false) {
    try { await game.dice3d?.showForRoll?.(roll); } catch (_error) {}
  }
  const d20 = Number(roll.total) || 0;
  const bonus = Number(resolution.bonus) || 0;
  const total = d20 + bonus;
  const success = total >= target;
  const result = {
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

  if (createChat === true) {
    result.chatMessage = await add2eCreateSavingThrowCard({ actor, roll, resolution, total, success });
  }
  return result;
}

function add2eInstallCanonicalSaveResolver(engine) {
  if (!engine || engine.__add2eCanonicalSaveResolverVersion === ADD2E_SAVE_RESOLVER_VERSION) return engine;
  Object.defineProperties(engine, {
    resolveSavingThrow: {
      configurable: true,
      writable: true,
      value(actor, saveType, context = {}) {
        return add2eResolveSavingThrow(this, actor, saveType, context);
      }
    },
    rollSavingThrow: {
      configurable: true,
      writable: true,
      value(actor, saveType, options = {}) {
        return add2eRollSavingThrow(this, actor, saveType, options);
      }
    },
    getSaveTarget: {
      configurable: true,
      writable: true,
      value(actor, saveType, context = {}) {
        return this.resolveSavingThrow(actor, saveType, { ...context, source: context.source ?? "get-save-target" }).target;
      }
    },
    getSaveBonus: {
      configurable: true,
      writable: true,
      value(actor, saveType, options = {}) {
        return this.resolveSavingThrow(actor, saveType, {
          ...options,
          source: options.source ?? "get-save-bonus"
        }).bonus;
      }
    },
    getActionSaveThreshold: {
      configurable: true,
      writable: true,
      value(actor, saveType = "sorts", context = {}) {
        return this.resolveSavingThrow(actor, saveType, {
          ...context,
          source: context.source ?? "action-save-threshold"
        }).target;
      }
    },
    rollActionSave: {
      configurable: true,
      writable: true,
      async value(actor, saveType = "sorts", bonus = 0, context = {}) {
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
    }
  });
  engine.__add2eCanonicalSaveResolverVersion = ADD2E_SAVE_RESOLVER_VERSION;
  globalThis.ADD2E_SAVE_RESOLVER_VERSION = ADD2E_SAVE_RESOLVER_VERSION;
  return engine;
}

function add2eSaveSigned(value) {
  const number = Number(value) || 0;
  return `${number >= 0 ? "+" : ""}${number}`;
}

function add2eSaveSourceLabel(resolution) {
  const selected = resolution?.targetResolution?.selected;
  if (selected?.kind === "class") {
    return [selected.className, selected.classLevel ? `niveau ${selected.classLevel}` : ""]
      .filter(Boolean)
      .join(" · ");
  }
  return selected?.name ?? "Valeur de l’acteur";
}

function add2eSaveModifierLabel(entry) {
  const modifier = entry?.modifier ?? entry;
  const label = String(modifier?.metadata?.label ?? modifier?.source?.name ?? "Modificateur").trim();
  const value = modifier?.operation === "add"
    ? add2eSaveSigned(modifier.value)
    : String(entry?.contribution ?? modifier?.value ?? "");
  return `${label} ${value}`.trim();
}

async function add2eCreateSavingThrowCard({ actor, roll, resolution, total, success }) {
  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    throw new Error("Le constructeur commun des cartes de chat ADD2E n’est pas disponible.");
  }

  const applied = resolution.bonusResolution?.applied ?? [];
  const options = {
    actor,
    title: resolution.label,
    icon: resolution.definition.icon,
    variant: success ? "success" : "failure",
    source: {
      name: actor.name,
      img: actor.img,
      type: "Jet de sauvegarde",
      meta: add2eSaveSourceLabel(resolution)
    },
    rows: [
      { label: "Seuil", value: resolution.target },
      { label: "D20", value: Number(roll.total) || 0 },
      { label: "Modificateurs", value: add2eSaveSigned(resolution.bonus) },
      { label: "Total", value: total },
      { label: "Détail", value: applied.length ? applied.map(add2eSaveModifierLabel).join(" ; ") : "Aucun" }
    ],
    message: success ? "Réussite du jet de sauvegarde." : "Échec du jet de sauvegarde.",
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor }),
      rolls: [roll],
      flags: {
        add2e: {
          saveRoll: true,
          saveType: resolution.key,
          saveIndex: resolution.index,
          saveTarget: resolution.target,
          saveBonus: resolution.bonus,
          saveTotal: total,
          saveSuccess: success,
          saveMental: add2eSaveIsMentalContext(add2eSheetRollEffectsEngine(), resolution.context),
          saveResolverVersion: ADD2E_SAVE_RESOLVER_VERSION
        }
      }
    }
  };

  const preview = globalThis.add2eBuildChatCard(options);
  if (!String(preview ?? "").trim()) throw new Error("La carte de sauvegarde ADD2E n’a pas pu être construite.");
  return globalThis.add2eCreateChatCard(options);
}

export async function add2eRollCharacteristicCard(actor, carac) {
  if (!actor) return ui.notifications.warn("Aucun acteur pour ce jet.");
  const key = String(carac ?? "").trim().toLowerCase();
  const labels = {
    force: "Force",
    dexterite: "Dextérité",
    constitution: "Constitution",
    intelligence: "Intelligence",
    sagesse: "Sagesse",
    charisme: "Charisme"
  };
  const icons = {
    force: "fas fa-dumbbell",
    dexterite: "fas fa-running",
    constitution: "fas fa-heartbeat",
    intelligence: "fas fa-brain",
    sagesse: "fas fa-eye",
    charisme: "fas fa-theater-masks"
  };
  const engine = add2eSheetRollEffectsEngine();
  const resolved = typeof engine?.resolveAbility === "function"
    ? engine.resolveAbility(actor, key, { type: "ability-check", source: "actor-sheet-ability-roll" })
    : null;
  const target = Number(resolved?.total ?? actor.system?.[key] ?? actor.system?.[`${key}_base`] ?? 10) || 10;
  const roll = await add2eEvaluateRollSafe("1d20");
  try { await game.dice3d?.showForRoll?.(roll); } catch (_error) {}
  const total = Number(roll.total) || 0;
  const success = total <= target;

  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    throw new Error("Le constructeur commun des cartes de chat ADD2E n’est pas disponible.");
  }
  const options = {
    actor,
    title: labels[key] ?? key.toUpperCase() ?? "Caractéristique",
    icon: icons[key] ?? "fas fa-dice-d20",
    variant: success ? "success" : "failure",
    source: { name: actor.name, img: actor.img, type: "Test de caractéristique" },
    rows: [
      { label: "Seuil", value: target },
      { label: "D20", value: total }
    ],
    message: success ? "Réussite du test de caractéristique." : "Échec du test de caractéristique.",
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor }),
      rolls: [roll],
      flags: { add2e: { abilityRoll: true, ability: key, abilityTarget: target, abilitySuccess: success } }
    }
  };
  globalThis.add2eBuildChatCard(options);
  return globalThis.add2eCreateChatCard(options);
}

export async function add2eRollSaveCard(actor, saveType, context = {}) {
  if (!actor) return ui.notifications.warn("Aucun acteur pour ce jet.");
  const engine = add2eSheetRollEffectsEngine();
  if (!engine?.rollSavingThrow) {
    throw new Error("L’exécuteur canonique ADD2E de sauvegardes n’est pas disponible.");
  }

  const result = await engine.rollSavingThrow(actor, saveType, {
    ...context,
    frontale: context.frontale !== false,
    source: context.source ?? "actor-sheet-save-roll",
    createChat: true,
    showDice: true
  });
  if (!result.ok) {
    const label = result.resolution?.label ?? "sauvegarde";
    return ui.notifications.warn(`Aucune valeur pour le jet ${label}.`);
  }
  return result.chatMessage;
}

function add2eHudRollActorFallback() {
  const hudState = globalThis.add2eHudFixDebug?.();
  return canvas?.tokens?.controlled?.[0]?.actor
    ?? game.actors?.get?.(hudState?.actorId)
    ?? game.user?.character
    ?? null;
}

export function add2eInstallHudSheetRollBridge() {
  const engine = add2eSheetRollEffectsEngine();
  if (engine) add2eInstallCanonicalSaveResolver(engine);
  globalThis.ADD2E_SHEET_ROLL_DELEGATION_VERSION = ADD2E_SHEET_ROLL_DELEGATION_VERSION;
  globalThis.ADD2E_SAVE_RESOLVER_VERSION = ADD2E_SAVE_RESOLVER_VERSION;
  globalThis.add2eResolveSavingThrow = (actor, saveType, context = {}) => {
    const current = add2eSheetRollEffectsEngine();
    if (!current?.resolveSavingThrow) {
      throw new Error("Le résolveur canonique ADD2E de sauvegardes n’est pas disponible.");
    }
    return current.resolveSavingThrow(actor, saveType, context);
  };
  globalThis.add2eRollSavingThrow = async (actor, saveType, options = {}) => {
    const current = add2eSheetRollEffectsEngine();
    if (!current?.rollSavingThrow) {
      throw new Error("L’exécuteur canonique ADD2E de sauvegardes n’est pas disponible.");
    }
    return current.rollSavingThrow(actor, saveType, options);
  };
  globalThis.add2eGetSaveTarget = (actor, saveType, context = {}) =>
    globalThis.add2eResolveSavingThrow(actor, saveType, { ...context, source: context.source ?? "global-get-save-target" }).target;
  globalThis.add2eRollCharacteristicCard = add2eRollCharacteristicCard;
  globalThis.add2eRollSaveCard = add2eRollSaveCard;

  if (globalThis.__add2eHudSheetRollBridgeV1) return;
  globalThis.__add2eHudSheetRollBridgeV1 = true;
  document.addEventListener("click", async event => {
    const button = event.target?.closest?.(
      "#add2e-action-hud [data-action='roll-ability'], #add2e-action-hud [data-action='roll-save']"
    );
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();

    const actor = add2eHudRollActorFallback();
    if (!actor) return ui.notifications.warn("Aucun acteur sélectionné pour le jet.");
    if (button.dataset.action === "roll-ability") {
      return add2eRollCharacteristicCard(actor, button.dataset.ability);
    }
    if (button.dataset.action === "roll-save") {
      return add2eRollSaveCard(actor, Number(button.dataset.saveIndex), {
        source: "action-hud-save-roll"
      });
    }
  }, true);
}