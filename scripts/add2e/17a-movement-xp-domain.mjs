// ADD2E — Domaine XP, mouvement et encombrement canoniques.
// Compatible Foundry V13/V14/V15 — DialogV2 uniquement.

export const ADD2E_MOVE_XP_VERSION = "2026-07-30-canonical-movement-encumbrance-v10";
export const ADD2E_MOVE_XP_TAG = "[ADD2E][MOVE_XP]";
export const ADD2E_MOVE_XP_INTERNAL = "add2eMoveXpInternal";
export const ADD2E_MOVE_XP_RECALC_DELAY_MS = 140;

const MISSING_MOVEMENT_BASE_WARNED = new Set();

export function log(label, data = {}) {
  console.log(`${ADD2E_MOVE_XP_TAG}${label}`, data);
}

export function num(value, fallback = 0) {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value && typeof value === "object") {
    for (const key of ["value", "valeur", "total", "current", "actuel", "base", "max", "vitesse", "movement"]) {
      if (value[key] !== undefined && value[key] !== null && typeof value[key] !== "object") return num(value[key], fallback);
    }
    return fallback;
  }
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;
  const parsed = Number(raw.replace(/\s+/g, "").replace(/\./g, "").replace(/,/g, ".").replace(/[^0-9.+\-]/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function norm(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function firstPositive(...values) {
  for (const value of values) {
    const out = num(value, NaN);
    if (Number.isFinite(out) && out > 0) return out;
  }
  return 0;
}

function round2(value) {
  return Math.round(Math.max(0, num(value, 0)) * 100) / 100;
}

function clone(value) {
  if (value === undefined || value === null) return value;
  try { return foundry?.utils?.deepClone ? foundry.utils.deepClone(value) : JSON.parse(JSON.stringify(value)); }
  catch (_error) { return value; }
}

export function sameValue(left, right) {
  if (left === right) return true;
  const leftNumber = num(left, NaN);
  const rightNumber = num(right, NaN);
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) return leftNumber === rightNumber;
  if (foundry?.utils?.deepEqual) return foundry.utils.deepEqual(left, right);
  return JSON.stringify(left) === JSON.stringify(right);
}

export function getPath(document, path) {
  return foundry?.utils?.getProperty ? foundry.utils.getProperty(document, path) : undefined;
}

export function changedUpdatePayload(actor, updates = {}) {
  return Object.fromEntries(Object.entries(updates).filter(([path, value]) => !sameValue(getPath(actor, path), value)));
}

export function changeValue(changes, path) {
  return foundry.utils.hasProperty(changes, path) ? foundry.utils.getProperty(changes, path) : undefined;
}

export function changedPath(actor, changes, path) {
  return foundry.utils.hasProperty(changes, path) && !sameValue(changeValue(changes, path), getPath(actor, path));
}

export function classItems(actor) {
  return Array.from(actor?.items ?? []).filter(item => String(item?.type ?? "").toLowerCase() === "classe");
}

function classItem(actor) {
  const classes = classItems(actor);
  return classes.length === 1 ? classes[0] : null;
}

function raceItem(actor) {
  return Array.from(actor?.items ?? []).find(item => String(item?.type ?? "").toLowerCase() === "race") ?? null;
}

export function isMulticlassActor(actor) {
  return actor?.type === "personnage" && classItems(actor).length > 1;
}

function parseXpRange(raw) {
  const text = String(raw ?? "").trim();
  const values = text.match(/[0-9][0-9.\s]*/g)?.map(value => num(value, NaN)).filter(Number.isFinite) ?? [];
  return { min: values[0] ?? 0, max: values[1] ?? null, raw: text };
}

function xpRows(actor) {
  const cls = classItem(actor)?.system ?? actor?.system?.details_classe ?? {};
  const progression = Array.isArray(cls.progression) ? cls.progression : [];
  return progression
    .map((row, index) => {
      const range = parseXpRange(row?.xp ?? row?.experience ?? row?.xpRange ?? row?.niveau_xp ?? "");
      return {
        ...row,
        niveau: num(row?.niveau ?? row?.level ?? index + 1, index + 1),
        xpMin: range.min,
        xpMax: range.max,
        xpLabel: range.raw
      };
    })
    .filter(row => row.niveau > 0)
    .sort((left, right) => left.niveau - right.niveau);
}

export function minXpForLevel(actor, level = null) {
  if (isMulticlassActor(actor)) return 0;
  const value = Math.max(1, num(level ?? actor?.system?.niveau, 1));
  const row = xpRows(actor).find(entry => Number(entry.niveau) === value);
  return Math.max(0, Number(row?.xpMin ?? 0) || 0);
}

function levelForXp(actor, xpValue) {
  if (isMulticlassActor(actor)) return null;
  const xp = Math.max(0, Math.floor(num(xpValue, 0)));
  const rows = xpRows(actor);
  if (!rows.length) return Math.max(1, num(actor?.system?.niveau, 1));
  let current = rows[0];
  for (const row of rows) if (xp >= row.xpMin) current = row;
  return Number(current.niveau) || 1;
}

function xpMeta(actor, levelValue, xpValue) {
  const level = Math.max(1, num(levelValue, 1));
  const xp = Math.max(0, Math.floor(num(xpValue, 0)));
  const rows = xpRows(actor);
  const currentMin = minXpForLevel(actor, level);
  const next = rows.find(row => Number(row.niveau) > level) ?? null;
  const nextXp = next ? Number(next.xpMin) || 0 : 0;
  const span = nextXp > currentMin ? nextXp - currentMin : 1;
  return {
    xp,
    level,
    requiredMin: currentMin,
    suggestedLevel: levelForXp(actor, xp),
    nextLevel: next?.niveau ?? null,
    nextXp,
    xpToNext: next ? Math.max(0, nextXp - xp) : 0,
    percent: next ? Math.max(0, Math.min(100, Math.floor(((xp - currentMin) / span) * 100))) : 100,
    progressionLabel: next ? `${xp.toLocaleString()} / ${nextXp.toLocaleString()} XP` : `${xp.toLocaleString()} XP — niveau maximum de la table`,
    hasProgression: rows.length > 0
  };
}

export function computeXp(actor) {
  if (isMulticlassActor(actor)) {
    return {
      xp: null,
      level: null,
      requiredMin: null,
      suggestedLevel: null,
      nextLevel: null,
      nextXp: null,
      xpToNext: null,
      percent: null,
      progressionLabel: "Progression gérée par les Items classe",
      hasProgression: false,
      multiclass: true
    };
  }
  const level = Math.max(1, num(actor?.system?.niveau, 1));
  const xp = Math.max(0, Math.floor(num(actor?.system?.xp, 0)));
  return xpMeta(actor, level, xp);
}

function effectsEngine() {
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine ?? null;
  if (!engine || typeof engine.resolve !== "function") {
    throw new Error("Le moteur canonique ADD2E des domaines movement/encumbrance est indisponible.");
  }
  return engine;
}

function canonicalResolve(actor, { domain, target, base = 0, context = {} } = {}) {
  const safeBase = num(base, 0);
  return effectsEngine().resolve(actor, {
    domain,
    target,
    base: safeBase,
    context: {
      ...context,
      actor,
      actionType: domain,
      source: context.source ?? "movement-encumbrance"
    }
  });
}

function currentProgressionRowForClass(item) {
  if (!item) return null;
  const level = Math.max(1, num(item.system?.niveau ?? item.system?.level, 1));
  const progression = Array.isArray(item.system?.progression) ? item.system.progression : [];
  return progression.find(row => Number(row?.niveau ?? row?.level) === level) ?? progression[level - 1] ?? null;
}

function movementValue(system = {}) {
  return firstPositive(
    system.mouvement,
    system.movement,
    system.vitesse,
    system.vitesse_deplacement,
    system.deplacement,
    system["déplacement"],
    system.monkMove,
    system.monkMovement,
    system.baseMovement
  );
}

function naturalMovementSource(actor) {
  const sources = [];
  const race = raceItem(actor);
  const raceValue = movementValue(race?.system ?? {});
  if (raceValue > 0) {
    sources.push({ kind: "race", itemId: race.id, itemUuid: race.uuid, name: race.name, value: raceValue });
  }

  for (const item of classItems(actor)) {
    const row = currentProgressionRowForClass(item) ?? {};
    const progressionValue = movementValue(row);
    const classValue = movementValue(item.system ?? {});
    const value = progressionValue > 0 ? progressionValue : classValue;
    if (value > 0) {
      sources.push({
        kind: progressionValue > 0 ? "class-progression" : "class",
        itemId: item.id,
        itemUuid: item.uuid,
        name: item.name,
        level: Math.max(1, num(item.system?.niveau ?? item.system?.level, 1)),
        value
      });
    }
  }

  const selected = [...sources].sort((left, right) => right.value - left.value)[0] ?? null;
  return {
    value: selected?.value ?? 0,
    selected,
    sources,
    missing: !selected
  };
}

function strengthEncumbranceProfile(actor) {
  const engine = effectsEngine();
  if (typeof engine.resolveAbilityDerived !== "function") {
    throw new Error("Le résolveur canonique ADD2E de Force est indisponible pour l’encombrement.");
  }
  const derived = engine.resolveAbilityDerived(actor, "force", {
    domain: "encumbrance",
    type: "movement-encumbrance",
    source: "movement-encumbrance",
    consumer: "movement"
  });
  return {
    derived,
    weightAdjustment: num(derived?.profile?.poids, 0)
  };
}

function itemIsCarried(item) {
  const type = String(item?.type ?? "").toLowerCase();
  if (["classe", "race", "sort", "spell"].includes(type)) return false;
  const system = item?.system ?? {};
  const flags = item?.flags?.add2e ?? {};
  if (system.carried === false || system.transporte === false || system.transporté === false || system.inInventory === false) return false;
  if (flags.carried === false || flags.ignoreEncumbrance === true || system.ignoreEncumbrance === true) return false;
  return true;
}

function itemWeightEntry(item) {
  const system = item?.system ?? {};
  const quantity = Math.max(0, num(system.quantite ?? system.quantity ?? 1, 1));
  const unitWeight = Math.max(0, num(system.poids ?? system.weight ?? system.encombrement ?? system.encumbrance ?? 0, 0));
  return {
    item,
    itemId: item?.id ?? null,
    itemUuid: item?.uuid ?? null,
    name: item?.name ?? "Objet",
    quantity,
    unitWeight,
    total: round2(quantity * unitWeight)
  };
}

function carriedInventory(actor) {
  const entries = (actor?.items?.contents ?? Array.from(actor?.items ?? []))
    .filter(itemIsCarried)
    .map(itemWeightEntry)
    .filter(entry => entry.total > 0);
  return {
    entries,
    total: round2(entries.reduce((sum, entry) => sum + entry.total, 0))
  };
}

function equippedArmor(actor) {
  const engine = effectsEngine();
  return (actor?.items?.contents ?? Array.from(actor?.items ?? [])).filter(item => {
    const type = String(item?.type ?? "").toLowerCase();
    return ["armure", "armor"].includes(type) && engine.itemEquipped(item);
  });
}

function activeStatuses(actor) {
  const statuses = new Set();
  for (const effect of [...(actor?.effects?.contents ?? actor?.effects ?? []), ...(actor?.appliedEffects ?? [])]) {
    if (!effect || effect.disabled === true || effect.isSuppressed === true || effect.active === false) continue;
    for (const status of effect.statuses ?? []) {
      const key = norm(status?.id ?? status);
      if (key) statuses.add(key);
    }
  }
  return [...statuses];
}

function explicitContextValue(options, key) {
  return Object.prototype.hasOwnProperty.call(options ?? {}, key) ? options[key] : undefined;
}

function movementRuntimeToken(actor, options = {}) {
  if (options.persistent === true) return null;
  const direct = options.token?.document ?? options.token ?? null;
  if (direct) return direct;

  const controlled = canvas?.tokens?.controlled?.find?.(token => token?.actor?.id === actor?.id) ?? null;
  if (controlled?.document) return controlled.document;

  const active = actor?.getActiveTokens?.(true, true) ?? [];
  const currentSceneId = canvas?.scene?.id ?? null;
  const current = active.find(token => (token?.document?.parent?.id ?? token?.scene?.id) === currentSceneId) ?? active[0] ?? null;
  return current?.document ?? current ?? null;
}

function movementRuntimeContext(actor, options = {}) {
  const actorFlags = actor?.flags?.add2e ?? {};
  const persistent = options.persistent === true;
  const token = movementRuntimeToken(actor, options);
  const tokenFlags = token?.flags?.add2e ?? {};
  const scene = persistent ? null : (options.scene ?? token?.parent ?? canvas?.scene ?? null);
  const sceneFlags = scene?.flags?.add2e ?? {};

  const explicitTerrain = explicitContextValue(options, "terrain");
  const explicitEnvironment = explicitContextValue(options, "environment");
  const explicitMilieu = explicitContextValue(options, "milieu");

  const terrain = explicitTerrain !== undefined
    ? explicitTerrain
    : tokenFlags.terrain ?? (persistent ? actorFlags.terrain ?? null : sceneFlags.terrain ?? actorFlags.terrain ?? null);

  const environment = explicitEnvironment !== undefined
    ? explicitEnvironment
    : explicitMilieu !== undefined
      ? explicitMilieu
      : tokenFlags.environment
        ?? tokenFlags.milieu
        ?? (persistent
          ? actorFlags.environment ?? actorFlags.milieu ?? null
          : sceneFlags.environment ?? sceneFlags.milieu ?? actorFlags.environment ?? actorFlags.milieu ?? null);

  return {
    token,
    scene: persistent ? null : scene,
    terrain,
    environment,
    milieu: environment,
    persistent,
    consumer: options.consumer ?? (persistent ? "movement-persistent-mirror" : "movement-runtime")
  };
}

function movementContext(actor, source, inventory, armor, strength, options = {}) {
  const system = actor?.system ?? {};
  const flags = actor?.flags?.add2e ?? {};
  const runtime = movementRuntimeContext(actor, options);
  return {
    source: "movement-encumbrance",
    consumer: runtime.consumer,
    movementSource: clone(source),
    inventory: {
      total: inventory.total,
      entries: inventory.entries.map(entry => ({
        itemId: entry.itemId,
        itemUuid: entry.itemUuid,
        name: entry.name,
        quantity: entry.quantity,
        unitWeight: entry.unitWeight,
        total: entry.total
      }))
    },
    armor,
    equippedArmor: armor,
    strength: strength.derived,
    size: options.size ?? system.taille ?? system.size ?? system.gabarit ?? flags.size ?? null,
    transformation: options.transformation ?? flags.transformation ?? system.transformation ?? system.forme ?? system.form ?? null,
    terrain: runtime.terrain,
    environment: runtime.environment,
    milieu: runtime.milieu,
    statuses: options.statuses ?? activeStatuses(actor),
    token: runtime.token,
    scene: runtime.scene,
    persistent: runtime.persistent
  };
}

function resolvedTotal(resolution, fallback = 0) {
  return round2(num(resolution?.total, fallback));
}

function encumbranceCategory(weight, normalLimit, heavyLimit, maximumLimit) {
  if (weight > maximumLimit) return { label: "Surcharge", category: "surcharge", multiplier: 0 };
  if (weight > heavyLimit) return { label: "Très encombré", category: "tres_encombre", multiplier: 0.25 };
  if (weight > normalLimit) return { label: "Encombré", category: "encombre", multiplier: 0.5 };
  return { label: "Équipement normal", category: "normal", multiplier: 1 };
}

function collectModes(resolution) {
  const modes = new Set();
  const add = value => {
    const list = Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];
    for (const entry of list.flatMap(item => String(item ?? "").split(/[,;|\n]+/g))) {
      const key = norm(entry);
      if (key) modes.add(key);
    }
  };
  for (const entry of resolution?.applied ?? []) {
    add(entry?.modes);
    add(entry?.mode);
    add(entry?.metadata?.modes);
    add(entry?.modifier?.modes);
    add(entry?.modifier?.mode);
    add(entry?.modifier?.metadata?.modes);
    add(entry?.source?.metadata?.modes);
  }
  return [...modes];
}

function emptyMovement() {
  return {
    naturalBase: 0,
    baseNaturelle: 0,
    base: 0,
    actuel: 0,
    vitesse: 0,
    poids: 0,
    poidsKg: 0,
    forcePoids: 0,
    limiteNormale: 0,
    limiteLourde: 0,
    limiteSurcharge: 0,
    categorie: "normal",
    label: "Équipement normal",
    multiplier: 1,
    modes: [],
    modesMagiques: [],
    metresTour: 0,
    donjonRoundMetres: 0,
    segmentMetres: 0,
    exterieurDemiJourKm: 0
  };
}

export function computeMovement(actor, options = {}) {
  if (!actor || actor.type !== "personnage") return emptyMovement();

  const source = naturalMovementSource(actor);
  const inventory = carriedInventory(actor);
  const armor = equippedArmor(actor);
  const strength = strengthEncumbranceProfile(actor);
  const context = movementContext(actor, source, inventory, armor, strength, options);

  const carriedWeightResolution = canonicalResolve(actor, {
    domain: "encumbrance",
    target: "carried-weight",
    base: inventory.total,
    context: { ...context, encumbranceTarget: "carried-weight" }
  });
  const weight = resolvedTotal(carriedWeightResolution, inventory.total);

  const normalCapacityBase = Math.max(0, 500 + strength.weightAdjustment);
  const heavyCapacityBase = Math.max(normalCapacityBase, 1000 + strength.weightAdjustment);
  const maximumCapacityBase = Math.max(heavyCapacityBase, 1500 + strength.weightAdjustment);

  const normalCapacityResolution = canonicalResolve(actor, {
    domain: "encumbrance",
    target: "capacity.normal",
    base: normalCapacityBase,
    context: { ...context, carriedWeight: weight, capacityTier: "normal" }
  });
  const heavyCapacityResolution = canonicalResolve(actor, {
    domain: "encumbrance",
    target: "capacity.heavy",
    base: heavyCapacityBase,
    context: { ...context, carriedWeight: weight, capacityTier: "heavy" }
  });
  const maximumCapacityResolution = canonicalResolve(actor, {
    domain: "encumbrance",
    target: "capacity.maximum",
    base: maximumCapacityBase,
    context: { ...context, carriedWeight: weight, capacityTier: "maximum" }
  });

  const normalLimit = resolvedTotal(normalCapacityResolution, normalCapacityBase);
  const heavyLimit = Math.max(normalLimit, resolvedTotal(heavyCapacityResolution, heavyCapacityBase));
  const maximumLimit = Math.max(heavyLimit, resolvedTotal(maximumCapacityResolution, maximumCapacityBase));
  const category = encumbranceCategory(weight, normalLimit, heavyLimit, maximumLimit);

  const multiplierResolution = canonicalResolve(actor, {
    domain: "encumbrance",
    target: "movement-multiplier",
    base: category.multiplier,
    context: {
      ...context,
      carriedWeight: weight,
      limits: { normal: normalLimit, heavy: heavyLimit, maximum: maximumLimit },
      encumbranceCategory: category.category
    }
  });
  const multiplier = Math.max(0, num(multiplierResolution?.total, category.multiplier));
  const movementBase = Math.max(0, source.value * multiplier);

  const movementResolution = canonicalResolve(actor, {
    domain: "movement",
    target: "ground",
    base: movementBase,
    context: {
      ...context,
      naturalBase: source.value,
      carriedWeight: weight,
      encumbranceMultiplier: multiplier,
      encumbranceCategory: category.category,
      limits: { normal: normalLimit, heavy: heavyLimit, maximum: maximumLimit }
    }
  });

  const resolvedMovement = Math.max(0, num(movementResolution?.total, movementBase));
  const actuel = Math.floor(resolvedMovement);
  const modes = collectModes(movementResolution);
  const canonicalApplied = Array.isArray(movementResolution?.applied) ? movementResolution.applied : [];

  if (source.missing && options.warnMissingBase !== false) {
    const key = String(actor.uuid ?? actor.id ?? actor.name ?? "actor");
    if (!MISSING_MOVEMENT_BASE_WARNED.has(key)) {
      MISSING_MOVEMENT_BASE_WARNED.add(key);
      console.warn(`${ADD2E_MOVE_XP_TAG}[MOVEMENT][MISSING_BASE]`, {
        actor: actor.name,
        actorId: actor.id,
        message: "Aucun mouvement explicite n’est défini sur l’Item race ou les Items classe."
      });
    }
  }

  return {
    naturalBase: round2(source.value),
    baseNaturelle: round2(source.value),
    base: round2(movementBase),
    actuel,
    vitesse: actuel,
    poids: weight,
    poidsKg: round2(weight / 20),
    forcePoids: strength.weightAdjustment,
    limiteNormale: normalLimit,
    limiteLourde: heavyLimit,
    limiteSurcharge: maximumLimit,
    categorie: category.category,
    label: category.label,
    multiplier,
    modes,
    modesMagiques: modes,
    source,
    contextScope: {
      persistent: context.persistent === true,
      tokenId: context.token?.id ?? null,
      sceneId: context.scene?.id ?? null,
      terrain: context.terrain ?? null,
      environment: context.environment ?? null
    },
    encumbrance: {
      carriedWeight: carriedWeightResolution,
      capacities: {
        normal: normalCapacityResolution,
        heavy: heavyCapacityResolution,
        maximum: maximumCapacityResolution
      },
      movementMultiplier: multiplierResolution,
      category: category.category,
      label: category.label
    },
    movementResolution,
    magic: {
      active: canonicalApplied.length > 0,
      naturalBase: round2(source.value),
      base: round2(resolvedMovement),
      modes,
      rules: canonicalApplied
    },
    metresTour: actuel,
    donjonRoundMetres: actuel,
    segmentMetres: round2(actuel / 10),
    exterieurDemiJourKm: round2(actuel * 1.6)
  };
}

// Nom historique conservé uniquement comme vue de diagnostic des modificateurs
// canoniques appliqués. Aucune règle flags.add2e.rules n’est interprétée ici.
export function magicMovementRules(actor, options = {}) {
  return computeMovement(actor, options)?.movementResolution?.applied ?? [];
}

export function movementUpdates(actor) {
  const movement = computeMovement(actor, {
    persistent: true,
    consumer: "movement-persistent-mirror"
  });
  return {
    updates: {
      "system.mouvement": movement,
      "system.movement": movement.actuel,
      "system.vitesse_deplacement": movement.actuel
    },
    movement
  };
}

export function flatActorUpdates(actor, { mode = "auto", incoming = {} } = {}) {
  const movementOnly = movementUpdates(actor);
  if (mode === "movement" || isMulticlassActor(actor)) {
    return {
      updates: movementOnly.updates,
      xp: computeXp(actor),
      movement: movementOnly.movement,
      multiclass: isMulticlassActor(actor)
    };
  }

  const incomingLevel = incoming["system.niveau"] !== undefined
    ? Math.max(1, num(incoming["system.niveau"], 1))
    : Math.max(1, num(actor?.system?.niveau, 1));
  const incomingXp = incoming["system.xp"] !== undefined
    ? Math.max(0, Math.floor(num(incoming["system.xp"], 0)))
    : Math.max(0, Math.floor(num(actor?.system?.xp, 0)));

  let level = incomingLevel;
  let xp = incomingXp;
  if (mode === "level") xp = minXpForLevel(actor, level);
  else if (mode === "xp") {
    xp = Math.max(xp, minXpForLevel(actor, level));
    const suggested = levelForXp(actor, xp);
    if (game.settings.get("add2e", "xpAutoLevel") && suggested > level) level = suggested;
  } else {
    xp = Math.max(xp, minXpForLevel(actor, level));
  }

  const meta = xpMeta(actor, level, xp);
  const currentTitle = xpRows(actor).find(row => Number(row.niveau) === level)?.title ?? actor?.system?.titre ?? "";
  const updates = {
    "system.xp": xp,
    "system.niveau": level,
    "system.progression_xp": meta.progressionLabel,
    "system.xp_next": meta.nextXp,
    "system.xp_to_next": meta.xpToNext,
    "system.xp_percent": meta.percent,
    "system.niveau_suggere": meta.suggestedLevel,
    ...movementOnly.updates
  };
  if (currentTitle) updates["system.titre"] = currentTitle;
  return { updates, xp: meta, movement: movementOnly.movement, multiclass: false };
}

export async function recalc(actor, { mode = "auto", notify = false } = {}) {
  if (!actor || actor.type !== "personnage") return null;
  const result = flatActorUpdates(actor, { mode });
  const updates = changedUpdatePayload(actor, result.updates);
  result.updates = updates;
  result.skipped = Object.keys(updates).length === 0;
  if (!result.skipped) {
    await actor.update(updates, {
      [ADD2E_MOVE_XP_INTERNAL]: true,
      add2eReason: `move-xp-recalc:${mode}`,
      render: false
    });
  }
  if (notify && mode === "level" && !result.multiclass) {
    ui.notifications.info(`${actor.name} : XP ajustée au niveau ${result.xp.level} (${result.xp.xp.toLocaleString()} XP).`);
  }
  return result;
}

async function createXpCard(actor, { title = "Expérience", rows = [], message = "", flags = {} } = {}) {
  const build = globalThis.add2eBuildChatCard;
  const create = globalThis.add2eCreateChatCard;
  if (typeof build !== "function" || typeof create !== "function") {
    throw new Error("Les constructeurs communs de cartes ADD2E ne sont pas disponibles.");
  }
  const options = {
    actor,
    title,
    icon: "fas fa-star",
    variant: "success",
    source: { name: actor?.name ?? "Acteur", img: actor?.img, type: "Progression" },
    rows,
    message,
    chatData: { flags: { add2e: { moveXp: true, version: ADD2E_MOVE_XP_VERSION, ...flags } } }
  };
  const preview = build(options);
  if (!String(preview ?? "").trim()) throw new Error("La carte d’XP ADD2E est vide.");
  return create(options);
}

export async function awardXp(actor, amount, { reason = "Gain d'expérience", percentBonus = 0 } = {}) {
  if (!actor || actor.type !== "personnage") return null;
  const base = Math.max(0, Math.floor(num(amount, 0)));
  const bonus = Math.max(0, Math.floor(base * (num(percentBonus, 0) / 100)));
  const total = base + bonus;

  if (isMulticlassActor(actor)) {
    const applyCanonical = globalThis.add2eSessionXpApplyToActor;
    if (typeof applyCanonical !== "function") {
      ui.notifications.error("Le moteur d’XP canonique des Items classe n’est pas chargé.");
      return null;
    }
    const result = await applyCanonical(actor, total, reason);
    const details = result?.classes
      ?.map(entry => `${entry.item?.name ?? "Classe"} ${entry.before ?? 0} → ${entry.after ?? 0}`)
      .join(" ; ") ?? "";
    await createXpCard(actor, {
      rows: [
        { label: "Gain", value: `+${total.toLocaleString()} XP${bonus ? `, dont bonus ${bonus.toLocaleString()} XP` : ""}` },
        { label: "Répartition", value: details || "Items classe mis à jour" }
      ],
      message: reason || "Progression multiclasses mise à jour.",
      flags: { multiclass: true, total, bonus }
    });
    return { total, bonus, ...result };
  }

  const before = Math.max(0, Math.floor(num(actor.system?.xp, 0)));
  const after = before + total;
  const result = flatActorUpdates(actor, { mode: "xp", incoming: { "system.xp": after } });
  const updates = changedUpdatePayload(actor, result.updates);
  if (Object.keys(updates).length) await actor.update(updates, { add2eReason: "move-xp-award" });
  const displayedXp = Number(updates["system.xp"] ?? result.xp.xp ?? after) || after;
  const displayedLevel = String(updates["system.niveau"] ?? result.xp.level ?? actor.system?.niveau ?? "-");
  await createXpCard(actor, {
    rows: [
      { label: "Gain", value: `+${total.toLocaleString()} XP${bonus ? `, dont bonus ${bonus.toLocaleString()} XP` : ""}` },
      { label: "Expérience", value: `${before.toLocaleString()} → ${displayedXp.toLocaleString()} XP` },
      { label: "Niveau actuel", value: displayedLevel }
    ],
    message: reason || "Gain d’expérience",
    flags: { multiclass: false, total, bonus, before, after: displayedXp }
  });
  return { before, after: displayedXp, total, bonus, ...result };
}

export async function promptXp(actor) {
  if (!actor || actor.type !== "personnage") return;
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.wait) {
    ui.notifications.warn("DialogV2 indisponible : attribution d'XP annulée.");
    return;
  }
  const content = `<form><div class="form-group"><label>XP à ajouter</label><input type="number" name="amount" value="0" step="1"></div><div class="form-group"><label>Bonus %</label><input type="number" name="percentBonus" value="0" step="1"></div><div class="form-group"><label>Motif</label><input type="text" name="reason" value="Récompense d'aventure"></div></form>`;
  const result = await DialogV2.wait({
    window: { title: `Attribuer de l'XP — ${actor.name}` },
    content,
    buttons: [
      {
        action: "add",
        label: "Ajouter",
        default: true,
        callback: (_event, button, dialog) => {
          const form = button?.form ?? dialog?.element?.querySelector?.("form") ?? null;
          return {
            action: "add",
            amount: form?.elements?.amount?.value ?? form?.amount?.value ?? 0,
            percentBonus: form?.elements?.percentBonus?.value ?? form?.percentBonus?.value ?? 0,
            reason: form?.elements?.reason?.value ?? form?.reason?.value ?? "Récompense d'aventure"
          };
        }
      },
      { action: "cancel", label: "Annuler", callback: () => ({ action: "cancel" }) }
    ],
    modal: true,
    rejectClose: false,
    close: () => ({ action: "cancel" })
  });
  if (result?.action === "add") {
    await awardXp(actor, result.amount, {
      reason: result.reason,
      percentBonus: result.percentBonus
    });
  }
}
