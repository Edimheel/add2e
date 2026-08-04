// ADD2E — Point d’entrée mouvement, encombrement et XP.
// Les Items classe restent la seule source de progression multiclasses.
// Compatible Foundry V13/V14/V15 — ApplicationV2 / DialogV2.

import {
  ADD2E_MOVE_XP_VERSION,
  ADD2E_MOVE_XP_TAG,
  ADD2E_MOVE_XP_INTERNAL,
  ADD2E_MOVE_XP_RECALC_DELAY_MS,
  log,
  norm,
  sameValue,
  getPath,
  changedUpdatePayload,
  changeValue,
  changedPath,
  isMulticlassActor,
  computeXp,
  computeMovement,
  magicMovementRules,
  movementUpdates,
  flatActorUpdates,
  recalc,
  awardXp,
  promptXp,
  minXpForLevel
} from "./17a-movement-xp-domain.mjs";
import {
  installMovementTokenControl,
  validateTokenMovement,
  computeTokenMovementScale
} from "./17a-movement-token-control.mjs";

const recalculationTimers = new Map();
const MOVEMENT_DOMAINS = new Set(["movement", "encumbrance"]);
const ADD2E_ENCUMBRANCE_SETTINGS_VERSION = "2026-08-02-world-encumbrance-settings-v4";
const ADD2E_MOVEMENT_EFFECT_CONTEXT_VERSION = "2026-08-02-size-transformation-effect-context-v1";
const ADD2E_MOVEMENT_LOT_2G_VERSION = "2026-08-04-lot-2g-closure-v1";
const GOLD_PIECES_PER_KILOGRAM = 20;

const ITEM_MOVEMENT_FIELDS = Object.freeze([
  "system.mouvement", "system.movement", "system.vitesse",
  "system.deplacement", "system.déplacement", "system.monkMove", "system.monkMovement", "system.baseMovement",
  "system.progression", "system.poids", "system.weight", "system.encombrement", "system.encumbrance",
  "system.poids_unite", "system.weightUnit", "system.poids_encombrement_po", "system.encumbrance_gp",
  "system.quantite", "system.quantity", "system.carried", "system.transporte", "system.transporté",
  "system.inInventory", "system.ignoreEncumbrance", "system.encumbranceExempt",
  "system.facteur_taille", "system.taille_facteur", "system.sizeFactor", "system.encumbranceFactor",
  "system.categorie", "system.category", "system.sousType", "system.subType", "system.subtype",
  "system.tags", "system.effectTags", "system.equipe", "system.equipee", "system.equipped",
  "system.porte", "system.portee", "system.porté", "system.worn", "flags.add2e.modifiers",
  "flags.add2e.tags", "flags.add2e.effectTags", "flags.add2e.carried", "flags.add2e.ignoreEncumbrance",
  "flags.add2e.size", "flags.add2e.transformation"
]);

const ACTOR_MOVEMENT_FIELDS = Object.freeze([
  "system.force", "system.force_base", "system.force_ex",
  "system.bonus_caracteristiques.force", "system.bonus_divers_caracteristiques.force",
  "system.taille", "system.size", "system.gabarit", "system.transformation", "system.forme", "system.form",
  "system.facteur_taille", "system.taille_facteur", "system.sizeFactor", "system.encumbranceFactor",
  "system.mouvement", "system.movement",
  "flags.add2e.modifiers", "flags.add2e.size", "flags.add2e.transformation",
  "flags.add2e.environment", "flags.add2e.milieu", "flags.add2e.monnaie"
]);

const COMPUTED_MOVEMENT_SCALARS = Object.freeze([
  "system.movement"
]);

globalThis.ADD2E_MOVE_XP_VERSION = ADD2E_MOVE_XP_VERSION;
globalThis.ADD2E_MOVEMENT_REFERENCE_POLICY_VERSION = "2026-08-02-canonical-sources-only-v2";
globalThis.ADD2E_ENCUMBRANCE_SETTINGS_VERSION = ADD2E_ENCUMBRANCE_SETTINGS_VERSION;
globalThis.ADD2E_MOVEMENT_TERRAIN_POLICY_VERSION = "2026-08-02-terrain-out-of-scope-v1";
globalThis.ADD2E_MOVEMENT_EFFECT_CONTEXT_VERSION = ADD2E_MOVEMENT_EFFECT_CONTEXT_VERSION;
globalThis.ADD2E_MOVEMENT_LOT_2G_VERSION = ADD2E_MOVEMENT_LOT_2G_VERSION;

function movementEngine() {
  return globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine ?? null;
}

function canonicalMovementKey(value) {
  const engine = movementEngine();
  const normalized = typeof engine?.normalizeKey === "function"
    ? engine.normalizeKey(value)
    : norm(value).replace(/_/g, "-");
  return String(normalized ?? "").replace(/_/g, "-");
}

function finitePositiveFactor(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "object") {
    for (const key of [
      "factor", "sizeFactor", "encumbranceFactor", "weightFactor", "scale",
      "facteur", "facteurTaille", "facteur_taille", "facteurEncombrement"
    ]) {
      const nested = finitePositiveFactor(value?.[key]);
      if (nested !== null) return nested;
    }
    return null;
  }
  const parsed = Number(String(value).trim().replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function rawValues(value) {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(rawValues);
  if (value instanceof Set) return [...value].flatMap(rawValues);
  if (typeof value === "object") return Object.values(value).flatMap(rawValues);
  return [value];
}

function factorFromTags(...values) {
  for (const raw of values.flatMap(rawValues)) {
    const text = String(raw ?? "");
    for (const part of text.split(/[,;|\n]+/g)) {
      const match = part.match(/(?:facteur[\s_-]*taille|size[\s_-]*factor|encumbrance[\s_-]*factor|weight[\s_-]*factor)\s*[:=]\s*([0-9]+(?:[.,][0-9]+)?)/i);
      if (!match) continue;
      const factor = finitePositiveFactor(match[1]);
      if (factor !== null) return factor;
    }
  }
  return null;
}

function activeActorEffects(actor) {
  const seen = new Set();
  const result = [];
  for (const effect of [...(actor?.effects?.contents ?? actor?.effects ?? []), ...(actor?.appliedEffects ?? [])]) {
    const key = String(effect?.uuid ?? effect?.id ?? "");
    if (!effect || !key || seen.has(key) || effect.disabled === true || effect.isSuppressed === true || effect.active === false) continue;
    seen.add(key);
    result.push(effect);
  }
  return result;
}

function actorRaceItem(actor) {
  return Array.from(actor?.items ?? []).find(item => String(item?.type ?? "").toLowerCase() === "race") ?? null;
}

function movementSizeFactorProfile(actor, context = {}) {
  const candidates = [];
  const add = (factor, source, priority, detail = null) => {
    const value = finitePositiveFactor(factor);
    if (value === null) return;
    candidates.push({ factor: value, source, priority, detail });
  };

  add(context.transformationFactor, "contexte de transformation", 120, context.transformationContext?.factorSource ?? null);
  add(context.sizeFactor, "contexte de taille", 115, context.size ?? context.taille ?? null);

  for (const effect of activeActorEffects(actor)) {
    const flags = effect?.flags?.add2e ?? {};
    add(flags.capabilityTransformation, `effet : ${effect.name}`, 110, effect.uuid ?? effect.id);
    add(flags.movement, `effet : ${effect.name}`, 105, effect.uuid ?? effect.id);
    const tagged = factorFromTags(flags.tags, flags.effectTags);
    add(tagged, `tag d’effet : ${effect.name}`, 100, effect.uuid ?? effect.id);
  }

  const actorFlags = actor?.flags?.add2e ?? {};
  const actorSystem = actor?.system ?? {};
  add(actorFlags.transformation, "transformation de l’acteur", 90, actor.uuid ?? actor.id);
  add(actorFlags.size, "profil de taille de l’acteur", 85, actor.uuid ?? actor.id);
  add(
    actorSystem.facteur_taille
      ?? actorSystem.taille_facteur
      ?? actorSystem.sizeFactor
      ?? actorSystem.encumbranceFactor,
    "données de taille de l’acteur",
    80,
    actor.uuid ?? actor.id
  );
  add(factorFromTags(actorFlags.tags, actorFlags.effectTags, actorSystem.tags, actorSystem.effectTags), "tag de l’acteur", 75, actor.uuid ?? actor.id);

  const race = actorRaceItem(actor);
  const raceSystem = race?.system ?? {};
  const raceFlags = race?.flags?.add2e ?? {};
  add(raceFlags.size, `profil racial : ${race?.name ?? "race"}`, 65, race?.uuid ?? race?.id ?? null);
  add(
    raceSystem.facteur_taille
      ?? raceSystem.taille_facteur
      ?? raceSystem.sizeFactor
      ?? raceSystem.encumbranceFactor,
    `données raciales : ${race?.name ?? "race"}`,
    60,
    race?.uuid ?? race?.id ?? null
  );
  add(factorFromTags(raceFlags.tags, raceFlags.effectTags, raceSystem.tags, raceSystem.effectTags), `tag racial : ${race?.name ?? "race"}`, 55, race?.uuid ?? race?.id ?? null);

  const selected = candidates.sort((left, right) => right.priority - left.priority)[0] ?? null;
  return {
    factor: selected?.factor ?? 1,
    source: selected?.source ?? "aucun facteur explicite",
    detail: selected?.detail ?? null,
    explicit: Boolean(selected),
    candidates
  };
}

function movementIgnoreSources(engine, actor, query, context) {
  if (!engine || !actor) return [];
  const requestedTarget = canonicalMovementKey(query?.target);
  const source = Array.isArray(query?.modifiers)
    ? query.modifiers
    : typeof engine.collect === "function"
      ? engine.collect(actor, context)
      : [];
  const result = [];
  const seen = new Set();

  for (const raw of source) {
    const metadata = raw?.metadata ?? {};
    if (metadata.ignoresEncumbrance !== true) continue;
    const normalized = typeof engine.normalizeModifier === "function"
      ? engine.normalizeModifier(raw, { source: raw?.source })
      : raw;
    if (!normalized || canonicalMovementKey(normalized.domain) !== "movement") continue;
    const modifierTarget = canonicalMovementKey(normalized.target);
    if (![requestedTarget, "all"].includes(modifierTarget)) continue;
    normalized._context = raw?._context ?? {};
    const condition = typeof engine.evaluateModifierConditions === "function"
      ? engine.evaluateModifierConditions(normalized, { ...context, actor })
      : { applicable: true };
    if (!condition?.applicable) continue;
    const id = String(normalized.id ?? raw?.id ?? normalized.source?.id ?? "");
    const key = `${id}|${normalized.source?.uuid ?? normalized.source?.name ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      id,
      name: String(normalized.metadata?.label ?? normalized.source?.name ?? "Effet de mouvement"),
      sourceKind: String(normalized.source?.kind ?? ""),
      sourceId: String(normalized.source?.id ?? ""),
      sourceUuid: String(normalized.source?.uuid ?? "")
    });
  }
  return result;
}

function installMovementLot2GEngineExtensions() {
  const engine = movementEngine();
  if (!engine || typeof engine.resolve !== "function") return false;
  if (engine.__add2eMovementLot2GVersion === ADD2E_MOVEMENT_LOT_2G_VERSION) return true;

  const baseResolve = engine.resolve.bind(engine);
  Object.defineProperty(engine, "resolve", {
    configurable: true,
    writable: true,
    value(actor, query = {}) {
      const domain = canonicalMovementKey(query.domain);
      const target = canonicalMovementKey(query.target);
      const context = {
        ...(query.context ?? {}),
        actor,
        item: query.item ?? query.context?.item,
        targetActor: query.targetActor ?? query.context?.targetActor
      };

      let base = query.base;
      let ignoredBy = [];
      let sizeProfile = null;

      if (domain === "encumbrance" && target === "carried-weight") {
        const existingFactor = finitePositiveFactor(context.transformationFactor ?? context.sizeFactor);
        sizeProfile = movementSizeFactorProfile(actor, context);
        if (existingFactor === null && sizeProfile.explicit && Math.abs(sizeProfile.factor - 1) > 0.0001) {
          context.sizeFactor = sizeProfile.factor;
          context.sizeFactorSource = {
            source: sizeProfile.source,
            detail: sizeProfile.detail
          };
        }
      }

      if (domain === "movement") {
        ignoredBy = movementIgnoreSources(engine, actor, query, context);
        if (ignoredBy.length) {
          context.encumbranceIgnored = true;
          context.encumbranceIgnoreSources = ignoredBy;
          context.encumbranceMultiplier = 1;
          if (["ground", "sol", "terrestre"].includes(target)) {
            const naturalBase = Number(context.naturalBase ?? context.movementSource?.value);
            if (Number.isFinite(naturalBase) && naturalBase >= 0) base = naturalBase;
          }
        }
      }

      const resolution = baseResolve(actor, { ...query, base, context });
      if (ignoredBy.length) {
        resolution.encumbranceIgnored = true;
        resolution.encumbranceIgnoreSources = ignoredBy;
      }
      if (sizeProfile?.explicit) {
        resolution.sizeFactor = sizeProfile.factor;
        resolution.sizeFactorSource = sizeProfile.source;
      }
      return resolution;
    }
  });

  Object.defineProperty(engine, "__add2eMovementLot2GVersion", {
    configurable: true,
    writable: true,
    value: ADD2E_MOVEMENT_LOT_2G_VERSION
  });
  return true;
}

function round2(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function signed(value) {
  const number = Number(value) || 0;
  return `${number >= 0 ? "+" : ""}${number}`;
}

function movementCapacityRows(movement) {
  const activeKey = {
    sans_encombrement: "unencumbered",
    leger: "light",
    modere: "moderate",
    lourd: "heavy",
    severe: "severe",
    surcharge: "overload"
  }[String(movement?.categorie ?? "")] ?? "unencumbered";
  const rows = [
    ["unencumbered", "Sans encombrement", movement?.limiteSansEncombrement],
    ["light", "Léger", movement?.limiteLegere],
    ["moderate", "Modéré", movement?.limiteModeree],
    ["heavy", "Lourd", movement?.limiteLourde],
    ["severe", "Sévère", movement?.limiteSevere]
  ].map(([key, label, limit]) => ({
    key,
    label,
    limitPo: round2(limit),
    limitKg: round2((Number(limit) || 0) / GOLD_PIECES_PER_KILOGRAM),
    active: activeKey === key
  }));
  if (activeKey === "overload") {
    rows.push({ key: "overload", label: "Surcharge", limitPo: null, limitKg: null, active: true });
  }
  return rows;
}

function movementAppliedRows(resolution) {
  return Array.isArray(resolution?.applied)
    ? resolution.applied.map(entry => {
      const modifier = entry?.modifier ?? {};
      return {
        id: String(modifier.id ?? ""),
        label: String(modifier.metadata?.label ?? modifier.source?.name ?? modifier.id ?? "Modificateur"),
        source: String(modifier.source?.name ?? ""),
        domain: String(modifier.domain ?? ""),
        target: String(modifier.target ?? ""),
        operation: String(modifier.operation ?? ""),
        value: modifier.value
      };
    })
    : [];
}

function movementDisplayData(actor, movement) {
  const groundResolution = movement?.movementResolutions?.ground ?? movement?.movementResolution ?? null;
  const carriedWeightResolution = movement?.encumbrance?.carriedWeight ?? null;
  const ignoredBy = Array.isArray(groundResolution?.encumbranceIgnoreSources)
    ? groundResolution.encumbranceIgnoreSources
    : [];
  const armorModifier = movementAppliedRows(groundResolution)
    .find(row => String(row.id).includes(":movement:armor-cap")) ?? null;
  const sizeProfile = movementSizeFactorProfile(actor, {
    size: movement?.contextScope?.size,
    transformation: movement?.contextScope?.transformation,
    transformationFactor: movement?.contextScope?.factor
  });
  const selectedSource = movement?.source?.selected ?? null;
  const forceProfile = movement?.forceProfilEncombrement ?? {};

  return {
    naturalMovement: round2(movement?.naturalBase),
    finalMovement: round2(movement?.actuel),
    sourceLabel: String(selectedSource?.name ?? "Aucune source"),
    sourceKind: String(selectedSource?.kind ?? ""),
    weightPo: round2(movement?.poidsPo ?? movement?.poids),
    weightKg: round2(movement?.poidsKg),
    weightLabel: `${round2(movement?.poidsKg)} kg`,
    category: String(movement?.categorie ?? "sans_encombrement"),
    categoryLabel: String(movement?.label ?? "Sans encombrement"),
    multiplier: round2(movement?.multiplier ?? 1),
    attackPenalty: Number(movement?.attaquePenalite) || 0,
    attackPenaltyDisplay: signed(movement?.attaquePenalite),
    armorClassPenalty: Number(movement?.classeArmurePenalite) || 0,
    armorClassPenaltyDisplay: signed(movement?.classeArmurePenalite),
    strengthTableKey: String(forceProfile?.tableKey ?? forceProfile?.score ?? "—"),
    strengthSource: String(forceProfile?.source ?? ""),
    capacityRows: movementCapacityRows(movement),
    encumbranceIgnored: groundResolution?.encumbranceIgnored === true,
    ignoredBy,
    ignoredByLabel: ignoredBy.map(entry => entry.name).join(" · "),
    size: movement?.contextScope?.size ?? null,
    transformation: movement?.contextScope?.transformation ?? null,
    sizeFactor: Number(carriedWeightResolution?.sizeFactor ?? movement?.contextScope?.factor ?? sizeProfile.factor) || 1,
    sizeFactorSource: String(carriedWeightResolution?.sizeFactorSource ?? sizeProfile.source ?? ""),
    hasSizeFactor: Math.abs((Number(carriedWeightResolution?.sizeFactor ?? movement?.contextScope?.factor ?? sizeProfile.factor) || 1) - 1) > 0.0001,
    armorLabel: armorModifier?.source ?? "",
    hasArmorLimit: Boolean(armorModifier),
    inventoryCount: Array.isArray(movement?.inventory?.entries) ? movement.inventory.entries.length : 0
  };
}

function computeMovementForConsumers(actor, options = {}) {
  const movement = computeMovement(actor, options);
  if (!movement || typeof movement !== "object") return movement;
  return {
    ...movement,
    display: movementDisplayData(actor, movement)
  };
}

function resolveDiagnosticActor(actorOrId = null) {
  if (actorOrId?.documentName === "Actor") return actorOrId;
  if (actorOrId?.actor?.documentName === "Actor") return actorOrId.actor;
  if (typeof actorOrId === "string" && actorOrId.trim()) {
    const id = actorOrId.trim();
    return game.actors?.get?.(id)
      ?? Array.from(game.actors ?? []).find(actor => actor?.name === id)
      ?? null;
  }
  return canvas?.tokens?.controlled?.[0]?.actor
    ?? game.user?.character
    ?? null;
}

function movementDiagnosticInventoryRows(movement) {
  return (movement?.inventory?.entries ?? []).map(entry => ({
    type: String(entry?.kind ?? "item"),
    nom: String(entry?.name ?? "Objet"),
    quantité: Number(entry?.quantity) || 0,
    unité: String(entry?.weightUnit ?? ""),
    poidsUnitairePo: round2(entry?.unitWeight),
    totalPo: round2(entry?.total),
    totalKg: round2((Number(entry?.total) || 0) / GOLD_PIECES_PER_KILOGRAM),
    source: String(entry?.weightSource ?? "")
  }));
}

function movementDiagnosticAdjustmentRows(movement) {
  const resolution = movement?.encumbrance?.carriedWeight ?? null;
  const rows = [];
  for (const applied of resolution?.applied ?? []) {
    const modifier = applied?.modifier ?? {};
    const metadata = modifier?.metadata ?? {};
    const details = Array.isArray(metadata.details) ? metadata.details : [];
    if (details.length) {
      for (const detail of details) {
        const reason = detail?.armor
          ? detail?.shield
            ? "Bouclier magique : poids complet"
            : "Armure magique : demi-poids"
          : "Poids canonique de l’objet magique";
        rows.push({
          type: "objet",
          nom: String(detail?.name ?? modifier?.source?.name ?? "Objet magique"),
          politique: String(metadata.label ?? modifier?.source?.name ?? modifier?.id ?? "Ajustement"),
          opération: String(modifier?.operation ?? "add"),
          poidsSourcePo: round2(detail?.sourceWeight),
          poidsInventairePo: round2(detail?.currentWeight),
          poidsRetenuPo: round2(detail?.desiredWeight),
          ajustementPo: round2(detail?.adjustment),
          facteur: "",
          raison: reason
        });
      }
      continue;
    }

    const operation = String(modifier?.operation ?? "add");
    const contribution = Number(applied?.contribution);
    rows.push({
      type: "politique",
      nom: String(modifier?.source?.name ?? modifier?.id ?? "Politique"),
      politique: String(metadata.label ?? modifier?.source?.name ?? modifier?.id ?? "Ajustement"),
      opération: operation,
      poidsSourcePo: "",
      poidsInventairePo: "",
      poidsRetenuPo: "",
      ajustementPo: operation === "add" && Number.isFinite(contribution) ? round2(contribution) : "",
      facteur: operation === "multiply" ? round2(modifier?.value) : "",
      raison: String(metadata.producer ?? metadata.setting ?? "règle canonique")
    });
  }
  return rows;
}

function movementDiagnosticWeightAudit(movement) {
  const resolution = movement?.encumbrance?.carriedWeight ?? {};
  const inventoryRows = movementDiagnosticInventoryRows(movement);
  const adjustmentRows = movementDiagnosticAdjustmentRows(movement);
  const rawTotalPo = Number.isFinite(Number(resolution.base))
    ? Number(resolution.base)
    : Number(movement?.inventory?.total) || 0;
  const afterOverridePo = Number(resolution?.stages?.afterOverride ?? rawTotalPo) || 0;
  const additionsPo = Number(resolution?.additionsTotal) || 0;
  const afterAdditionsPo = Number(resolution?.stages?.afterAdditions ?? (afterOverridePo + additionsPo)) || 0;
  const multiplier = Number(resolution?.multiplierTotal) || 1;
  const finalPo = Number(resolution?.total ?? movement?.poidsPo ?? movement?.poids) || 0;
  const summary = {
    poidsBrutPo: round2(rawTotalPo),
    poidsBrutKg: round2(rawTotalPo / GOLD_PIECES_PER_KILOGRAM),
    aprèsRemplacementPo: round2(afterOverridePo),
    ajustementsPo: round2(additionsPo),
    aprèsAjustementsPo: round2(afterAdditionsPo),
    multiplicateur: round2(multiplier),
    poidsFinalPo: round2(finalPo),
    poidsFinalKg: round2(finalPo / GOLD_PIECES_PER_KILOGRAM),
    formule: `(${round2(afterOverridePo)} ${additionsPo >= 0 ? "+" : "−"} ${round2(Math.abs(additionsPo))}) × ${round2(multiplier)} = ${round2(finalPo)}`
  };
  return { summary, inventoryRows, adjustmentRows };
}

function diagnoseMovement(actorOrId = null, options = {}) {
  const actor = resolveDiagnosticActor(actorOrId);
  if (!actor) throw new Error("Sélectionne un token, fournis un acteur ou son identifiant.");
  const movement = computeMovementForConsumers(actor, {
    consumer: "movement-diagnostic",
    movementMode: options.movementMode ?? options.mode ?? "ground",
    token: options.token,
    scene: options.scene,
    environment: options.environment,
    transformation: options.transformation,
    size: options.size
  });
  const resolutions = movement?.movementResolutions ?? {};
  const applied = Object.entries(resolutions).flatMap(([mode, resolution]) => (
    movementAppliedRows(resolution).map(row => ({ mode, ...row }))
  ));
  const weightAudit = movementDiagnosticWeightAudit(movement);
  const report = {
    version: ADD2E_MOVEMENT_LOT_2G_VERSION,
    actor: { id: actor.id, uuid: actor.uuid, name: actor.name },
    source: movement?.source,
    display: movement?.display,
    inventory: movement?.inventory,
    weightAudit,
    encumbrance: movement?.encumbrance,
    movementModes: movement?.movementModes,
    appliedModifiers: applied
  };

  console.group(`${ADD2E_MOVE_XP_TAG}[DIAGNOSTIC] ${actor.name}`);
  console.log("Synthèse du mouvement", report.display);
  console.table(report.display?.capacityRows ?? []);
  console.groupCollapsed("Poids transporté — calcul consolidé");
  console.table([weightAudit.summary]);
  console.log("Inventaire brut");
  console.table(weightAudit.inventoryRows);
  console.log("Ajustements canoniques");
  console.table(weightAudit.adjustmentRows);
  console.groupEnd();
  console.log("Modificateurs de mouvement appliqués");
  console.table(applied);
  console.log("Rapport complet", report);
  console.groupEnd();
  return report;
}

installMovementLot2GEngineExtensions();
Hooks.once("init", installMovementLot2GEngineExtensions);

function actorTimerKey(actor) {
  return String(actor?.uuid ?? actor?.id ?? "");
}

function removeComputedMovementScalars(updates = {}) {
  for (const path of COMPUTED_MOVEMENT_SCALARS) delete updates[path];
  return updates;
}

function stripComputedMovementScalarsFromChanges(changes = {}) {
  for (const path of COMPUTED_MOVEMENT_SCALARS) {
    if (Object.prototype.hasOwnProperty.call(changes, path)) delete changes[path];
  }
  const system = changes?.system;
  if (system && typeof system === "object") delete system.movement;
  return changes;
}

function isComputedMovementWrite(options = {}) {
  if (options?.[ADD2E_MOVE_XP_INTERNAL]) return true;
  const reason = String(options?.add2eReason ?? "");
  return reason.startsWith("move-xp-recalc:") || reason === "move-xp-award";
}

async function recalcMovementState(actor, reason = "document-change") {
  if (!actor) return null;
  const result = movementUpdates(actor);
  const updates = removeComputedMovementScalars(changedUpdatePayload(actor, result.updates));
  if (!Object.keys(updates).length) return { ...result, updates, skipped: true };
  await actor.update(updates, {
    [ADD2E_MOVE_XP_INTERNAL]: true,
    add2eReason: `move-xp-recalc:movement:${reason}`,
    render: false
  });
  return { ...result, updates, skipped: false };
}

function queueMovementRecalc(actor, reason = "document-change") {
  if (!actor || actor.documentName !== "Actor" || actor.type !== "personnage") return;
  const key = actorTimerKey(actor);
  if (!key) return;
  const existing = recalculationTimers.get(key);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    recalculationTimers.delete(key);
    recalcMovementState(actor, reason)
      .catch(error => console.warn(`${ADD2E_MOVE_XP_TAG}[RECALC]`, { actor: actor.name, reason, error }));
  }, ADD2E_MOVE_XP_RECALC_DELAY_MS);
  recalculationTimers.set(key, timer);
}

function isPrimaryActiveGm() {
  if (!game.user?.isGM) return false;
  const activeGms = Array.from(game.users ?? [])
    .filter(user => user?.active && user?.isGM)
    .sort((left, right) => String(left.id ?? "").localeCompare(String(right.id ?? "")));
  return !activeGms.length || activeGms[0]?.id === game.user.id;
}

let worldSettingRecalcChain = Promise.resolve();

function queueAllMovementRecalcs(reason = "world-setting") {
  if (!isPrimaryActiveGm()) return;
  const actors = Array.from(game.actors ?? []).filter(actor => actor?.type === "personnage");
  worldSettingRecalcChain = worldSettingRecalcChain.then(async () => {
    for (const actor of actors) {
      try {
        await recalcMovementState(actor, reason);
      } catch (error) {
        console.warn(`${ADD2E_MOVE_XP_TAG}[SETTING_RECALC]`, { actor: actor.name, reason, error });
      }
      await new Promise(resolve => setTimeout(resolve, 25));
    }
  });
}

function readEncumbranceSettings() {
  const read = (key, fallback) => {
    try { return game.settings.get("add2e", key); }
    catch (_error) { return fallback; }
  };
  return {
    enabled: read("encumbranceEnabled", true) !== false,
    currencyWeight: read("encumbranceCurrencyWeight", false) === true,
    version: ADD2E_ENCUMBRANCE_SETTINGS_VERSION
  };
}

function registerAdd2eSetting(key, data) {
  const settings = globalThis.game?.settings;
  if (!settings?.register) return false;
  const fullKey = `add2e.${key}`;
  if (settings.settings?.has?.(fullKey)) return true;
  try {
    settings.register("add2e", key, data);
    return true;
  } catch (error) {
    console.error(`${ADD2E_MOVE_XP_TAG}[SETTING_REGISTER]`, { key: fullKey, error });
    return false;
  }
}

function registerMovementSettings() {
  const registered = [
    registerAdd2eSetting("xpAutoLevel", {
      name: "ADD2E — XP : niveau automatique",
      hint: "Quand l'XP atteint un seuil, le niveau est augmenté automatiquement.",
      scope: "world",
      config: true,
      type: Boolean,
      default: true
    }),
    registerAdd2eSetting("encumbranceEnabled", {
      name: "ADD2E — Gestion de l’encombrement",
      hint: "Applique le poids transporté aux déplacements ainsi que les pénalités d’attaque et de classe d’armure. Désactiver cette option neutralise uniquement l’encombrement ; les autres effets de mouvement restent actifs.",
      scope: "world",
      config: true,
      type: Boolean,
      default: true,
      onChange: () => queueAllMovementRecalcs("setting:encumbranceEnabled")
    }),
    registerAdd2eSetting("encumbranceCurrencyWeight", {
      name: "ADD2E — Compter la monnaie dans l’encombrement",
      hint: "Quand cette option est active, chaque pièce transportée compte pour une unité d’encombrement, quelle que soit sa valeur. Désactivée, la monnaie ne modifie pas les paliers de charge.",
      scope: "world",
      config: true,
      type: Boolean,
      default: false,
      onChange: () => queueAllMovementRecalcs("setting:encumbranceCurrencyWeight")
    }),
    registerAdd2eSetting("enforceTokenMovement", {
      name: "ADD2E — Contrôle canonique du déplacement",
      hint: "Clé de compatibilité interne. En combat, le contrôleur canonique est toujours actif et les dépassements des joueurs exigent une validation du MJ.",
      scope: "world",
      config: false,
      type: Boolean,
      default: true
    })
  ];

  const success = registered.every(Boolean);
  globalThis.ADD2E_ENCUMBRANCE_SETTINGS_REGISTERED = success;
  return success;
}

registerMovementSettings();
Hooks.once("init", registerMovementSettings);

function flattenedKeys(changes = {}) {
  const flattened = foundry.utils.flattenObject?.(changes) ?? changes;
  return Object.keys(flattened ?? {});
}

function changesTouchPaths(changes = {}, paths = []) {
  const keys = flattenedKeys(changes);
  return keys.some(key => paths.some(path => key === path || key.startsWith(`${path}.`) || path.startsWith(`${key}.`)));
}

function modifierEntries(document) {
  let raw = document?.flags?.add2e?.modifiers;
  if ((raw === undefined || raw === null) && typeof document?.getFlag === "function") {
    try { raw = document.getFlag("add2e", "modifiers"); }
    catch (_error) { raw = null; }
  }
  if (Array.isArray(raw)) return raw.filter(entry => entry && typeof entry === "object");
  if (raw && typeof raw === "object") return Object.values(raw).filter(entry => entry && typeof entry === "object");
  return [];
}

function documentHasMovementModifier(document) {
  return modifierEntries(document).some(modifier => MOVEMENT_DOMAINS.has(norm(modifier?.domain).replace(/_/g, "-")));
}

function itemHasWeightSource(item) {
  const system = item?.system ?? {};
  return ["poids", "weight", "encombrement", "encumbrance", "poids_encombrement_po", "encumbrance_gp"].some(key => {
    if (!Object.prototype.hasOwnProperty.call(system, key)) return false;
    const value = Number(system[key]);
    return Number.isFinite(value) ? value !== 0 : String(system[key] ?? "").trim() !== "";
  });
}

function itemCanAffectMovement(item, hookName, changes = {}, options = {}) {
  const actor = item?.parent;
  if (!actor || actor.documentName !== "Actor" || actor.type !== "personnage") return false;
  if (options?.add2eSpellSync || options?.add2eDropPurge || options?.add2eCompendiumTruth) return false;
  const type = String(item.type ?? "").toLowerCase();
  const structural = ["classe", "race"].includes(type);
  if (options?.add2eInternal && !structural) return false;
  if (structural) return true;
  if (documentHasMovementModifier(item) || itemHasWeightSource(item)) return true;
  if (hookName === "updateItem" && changesTouchPaths(changes, ITEM_MOVEMENT_FIELDS)) return true;
  return false;
}

function queueItemMovementRecalc(item, hookName, changes = {}, options = {}) {
  if (!itemCanAffectMovement(item, hookName, changes, options)) return;
  queueMovementRecalc(item.parent, `item:${hookName}`);
}

function effectActor(effect) {
  const parent = effect?.parent;
  if (parent?.documentName === "Actor") return parent;
  if (parent?.documentName === "Item" && parent.parent?.documentName === "Actor") return parent.parent;
  return null;
}

function effectHasStatus(effect) {
  const statuses = effect?.statuses;
  if (statuses instanceof Set && statuses.size > 0) return true;
  if (Array.isArray(statuses) && statuses.length > 0) return true;
  return Boolean(effect?.statusId || effect?.flags?.core?.statusId || effect?.flags?.add2e?.statusId || effect?.flags?.add2e?.vitalStatus);
}

function effectTagValues(effect) {
  const flags = effect?.flags?.add2e ?? {};
  const values = [];
  const append = raw => {
    if (raw === undefined || raw === null || raw === "") return;
    if (Array.isArray(raw)) {
      for (const entry of raw) append(entry);
      return;
    }
    if (raw instanceof Set) {
      for (const entry of raw) append(entry);
      return;
    }
    if (raw && typeof raw === "object") {
      for (const entry of Object.values(raw)) append(entry);
      return;
    }
    for (const entry of String(raw).split(/[,;|\n]+/g)) {
      const key = norm(entry);
      if (key) values.push(key);
    }
  };
  append(flags.tags);
  append(flags.effectTags);
  return values;
}

function effectHasMovementContext(effect) {
  const flags = effect?.flags?.add2e ?? {};
  if (flags.capabilityTransformation && typeof flags.capabilityTransformation === "object") return true;
  if (flags.movement && typeof flags.movement === "object") return true;
  return effectTagValues(effect).some(tag => (
    tag.startsWith("taille_")
    || tag.startsWith("forme_")
    || tag.startsWith("transformation_")
    || tag.startsWith("facteur_taille_")
    || tag.startsWith("mouvement_")
    || tag.startsWith("movement_")
    || tag.startsWith("encombrement_")
    || tag.startsWith("encumbrance_")
    || tag === "poids_augmente"
    || tag === "poids_reduit"
  ));
}

function effectTouchesMovement(effect, changes = {}) {
  if (documentHasMovementModifier(effect) || effectHasStatus(effect) || effectHasMovementContext(effect)) return true;
  if (changesTouchPaths(changes, [
    "flags.add2e.modifiers", "flags.add2e.capabilityTransformation", "flags.add2e.movement",
    "flags.add2e.tags", "flags.add2e.effectTags", "statuses", "disabled", "isSuppressed"
  ])) return true;
  const effectChanges = Array.isArray(effect?.changes) ? effect.changes : [];
  return effectChanges.some(change => {
    const key = String(change?.key ?? "");
    return ACTOR_MOVEMENT_FIELDS.some(path => key === path || key.startsWith(`${path}.`));
  });
}

function actorMovementSourceChanged(changes = {}) {
  return changesTouchPaths(changes, ACTOR_MOVEMENT_FIELDS);
}

function removeMovementUpdates(updates = {}) {
  for (const path of ["system.mouvement", ...COMPUTED_MOVEMENT_SCALARS]) delete updates[path];
  return updates;
}

Hooks.on("preUpdateActor", (actor, changes, options = {}) => {
  const computedMovementWrite = isComputedMovementWrite(options);
  if (computedMovementWrite) stripComputedMovementScalarsFromChanges(changes);
  if (options?.[ADD2E_MOVE_XP_INTERNAL] || options?.add2eInternal || !actor || actor.type !== "personnage") return true;

  const levelChanged = changedPath(actor, changes, "system.niveau");
  const xpChanged = changedPath(actor, changes, "system.xp");
  const movementChanged = ["system.mouvement.base", "system.movement"]
    .some(path => changedPath(actor, changes, path));
  if (!levelChanged && !xpChanged && !movementChanged) return true;

  if (isMulticlassActor(actor) && (levelChanged || xpChanged)) {
    if (movementChanged) {
      const derived = changedUpdatePayload(actor, movementUpdates(actor).updates);
      removeMovementUpdates(derived);
      if (Object.keys(derived).length) foundry.utils.mergeObject(changes, foundry.utils.expandObject(derived), { inplace: true });
    }
    return true;
  }

  const incoming = {};
  if (levelChanged) incoming["system.niveau"] = changeValue(changes, "system.niveau");
  if (xpChanged) incoming["system.xp"] = changeValue(changes, "system.xp");
  const mode = levelChanged && !xpChanged ? "level" : xpChanged ? "xp" : "movement";
  const result = flatActorUpdates(actor, { mode, incoming });
  const derived = changedUpdatePayload(actor, result.updates);
  removeComputedMovementScalars(derived);
  if (actorMovementSourceChanged(changes)) removeMovementUpdates(derived);
  if (Object.keys(derived).length) foundry.utils.mergeObject(changes, foundry.utils.expandObject(derived), { inplace: true });
  options.add2eReason = `move-xp-preupdate:${mode}`;
  log("[ACTOR][PREUPDATE]", { actor: actor.name, mode, multiclass: result.multiclass === true, updates: derived });
  return true;
});

Hooks.on("updateActor", (actor, changes = {}, options = {}) => {
  if (options?.[ADD2E_MOVE_XP_INTERNAL] || options?.add2eInternal || actor?.type !== "personnage") return;
  if (actorMovementSourceChanged(changes)) queueMovementRecalc(actor, "actor-movement-source");
});

Hooks.on("createActiveEffect", (effect, options = {}) => {
  if (options?.[ADD2E_MOVE_XP_INTERNAL] || options?.add2eInternal || !effectTouchesMovement(effect)) return;
  const actor = effectActor(effect);
  if (actor?.type === "personnage") queueMovementRecalc(actor, "effect:create");
});
Hooks.on("updateActiveEffect", (effect, changes = {}, options = {}) => {
  if (options?.[ADD2E_MOVE_XP_INTERNAL] || options?.add2eInternal || !effectTouchesMovement(effect, changes)) return;
  const actor = effectActor(effect);
  if (actor?.type === "personnage") queueMovementRecalc(actor, "effect:update");
});
Hooks.on("deleteActiveEffect", (effect, options = {}) => {
  if (options?.[ADD2E_MOVE_XP_INTERNAL] || options?.add2eInternal || !effectTouchesMovement(effect)) return;
  const actor = effectActor(effect);
  if (actor?.type === "personnage") queueMovementRecalc(actor, "effect:delete");
});

Hooks.on("renderActorSheet", (sheet, html) => {
  if (sheet?.actor?.type !== "personnage" || isMulticlassActor(sheet.actor)) return;
  const root = html?.jquery ? html[0] : html;
  const levelField = [...root?.querySelectorAll?.(".a2e-field") ?? []]
    .find(field => norm(field.querySelector?.("label")?.textContent ?? "") === "niveau");
  if (!root || root.querySelector("input[name='system.xp']") || !levelField) return;
  const field = document.createElement("div");
  field.className = "a2e-field a2e-xp-field";
  field.innerHTML = `<label>XP</label><div class="a2e-xp-inline" style="display:grid;grid-template-columns:minmax(0,1fr) 31px;gap:5px;align-items:center;"><input type="number" name="system.xp" value="${Number(sheet.actor.system?.xp ?? 0)}" min="0" step="1" title="${String(sheet.actor.system?.progression_xp ?? "").replace(/"/g, "&quot;")}"><button type="button" class="a2e-icon-btn" data-add2e-mx="xp" title="Ajouter de l'XP" style="height:29px;min-width:31px;padding:0;">+</button></div>`;
  levelField.insertAdjacentElement("afterend", field);
  field.querySelector("[data-add2e-mx='xp']")?.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    promptXp(sheet.actor);
  });
});

Hooks.on("renderAdd2eActorSheet", (sheet, html) => {
  if (sheet?.actor?.type !== "personnage" || isMulticlassActor(sheet.actor)) return;
  const root = html?.jquery ? html[0] : html;
  root?.querySelector?.("[data-add2e-mx='xp']")?.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    promptXp(sheet.actor);
  }, { once: true });
});

Hooks.on("createItem", (item, options = {}) => queueItemMovementRecalc(item, "createItem", {}, options));
Hooks.on("updateItem", (item, changes = {}, options = {}) => queueItemMovementRecalc(item, "updateItem", changes, options));
Hooks.on("deleteItem", (item, options = {}) => queueItemMovementRecalc(item, "deleteItem", {}, options));

installMovementTokenControl();

globalThis.add2eComputeXp = computeXp;
globalThis.add2eComputeMovement = computeMovementForConsumers;
globalThis.add2eGetMagicMovementRules = magicMovementRules;
globalThis.add2eRecalcMoveXp = recalc;
globalThis.add2eAwardXp = awardXp;
globalThis.add2ePromptXp = promptXp;
globalThis.add2eMinXpForLevel = minXpForLevel;
globalThis.add2eValidateTokenMovement = validateTokenMovement;
globalThis.add2eComputeTokenMovementScale = computeTokenMovementScale;
globalThis.add2eGetEncumbranceSettings = readEncumbranceSettings;
globalThis.add2eResolveMovementSizeFactor = movementSizeFactorProfile;
globalThis.add2eDiagnoseMovement = diagnoseMovement;