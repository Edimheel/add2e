// ADD2E — Actor sheet getData : Race, Classe, capacités et équipement.

import { classItems, classProgression, classSlug, raceItem, raceSlug } from "./17b-multiclass-core.mjs";

function add2eThiefActivityNormalize(value) {
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

export function add2ePrepareThiefActivityData(actor) {
  const resolver = globalThis.add2eGetThiefActivityEquipmentStatus;
  if (typeof resolver !== "function") {
    throw new Error("Le résolveur canonique ADD2E de l’équipement des activités de voleur est indisponible.");
  }
  const status = resolver(actor);
  if (!status || typeof status !== "object") {
    throw new Error("Le résolveur canonique ADD2E de l’équipement des activités de voleur a renvoyé un état invalide.");
  }
  return foundry.utils.deepClone(status);
}

function add2eSummaryClassFeatureKey(feature) {
  const raw = feature?.id
    ?? feature?._id
    ?? feature?.key
    ?? feature?.slug
    ?? feature?.name
    ?? feature?.label
    ?? feature?.title
    ?? feature?.nom
    ?? "";
  return add2eThiefActivityNormalize(raw);
}

function add2eBuildSummaryClassFeatures(features = []) {
  const classKeys = new Set(features.map(feature => add2eThiefActivityNormalize(
    feature?._add2eClassItemId ?? feature?._add2eClassSlug ?? feature?._add2eClassName ?? ""
  )).filter(Boolean));
  const showClassName = classKeys.size > 1;
  const seen = new Set();
  const result = [];

  for (const feature of features) {
    const name = String(feature?.name ?? feature?.label ?? feature?.title ?? feature?.nom ?? "").trim();
    const featureKey = add2eSummaryClassFeatureKey(feature);
    const classKey = add2eThiefActivityNormalize(
      feature?._add2eClassItemId ?? feature?._add2eClassSlug ?? feature?._add2eClassName ?? "classe"
    );
    const uniqueKey = `${classKey}|${featureKey}`;
    if (!name || !featureKey || seen.has(uniqueKey)) continue;
    seen.add(uniqueKey);

    result.push({
      name,
      description: String(feature?.description ?? feature?.desc ?? ""),
      className: String(feature?._add2eClassName ?? "").trim(),
      classLevel: Number(feature?._add2eClassLevel) || null,
      showClassName
    });
  }

  return result;
}

function add2eSheetRaceCapabilities(system) {
  const raw = system?.capacites;
  if (Array.isArray(raw)) return raw.filter(value => typeof value === "string" && value.trim());
  if (raw && typeof raw === "object") return Object.values(raw).filter(value => typeof value === "string" && value.trim());
  return [];
}

function add2eSheetRaceIdentity(actor) {
  const item = raceItem(actor);
  if (!item) return null;
  const system = item.system ?? {};
  return {
    itemId: item.id,
    uuid: item.uuid,
    slug: raceSlug(item),
    name: String(item.name ?? ""),
    img: String(item.img ?? ""),
    capacites: add2eSheetRaceCapabilities(system),
    description: String(system.description ?? ""),
    descriptionLongue: String(system.description_longue ?? ""),
    langues: system.langues ?? "",
    movement: system.movement ?? 0,
    taille: system.taille ?? "",
    ageDebut: system["âge_debut"] ?? "",
    esperanceVie: system["espérance_vie"] ?? "",
    noteMd: system.note_md ?? ""
  };
}

function add2eSheetClassIdentityRows(actor) {
  return classItems(actor).map(item => {
    const progression = classProgression(item);
    if (!progression.hasLevel || !progression.hasXp) {
      throw new Error(`Progression canonique absente sur l’Item classe « ${item.name ?? item.id} ».`);
    }
    return {
      itemId: item.id,
      uuid: item.uuid,
      slug: classSlug(item),
      name: String(item.name ?? ""),
      img: String(item.img ?? ""),
      level: progression.level,
      xp: progression.xp,
      description: String(item.system?.description ?? "")
    };
  });
}

function add2eSheetModifierValue(modifier) {
  const operation = String(modifier?.operation ?? "add");
  const raw = modifier?.value;
  if (operation === "add") {
    const value = Number(raw) || 0;
    return `${value >= 0 ? "+" : ""}${value}`;
  }
  if (operation === "set") return `= ${String(raw ?? "—")}`;
  if (operation === "multiply") return `× ${String(raw ?? "—")}`;
  if (operation === "minmax" && raw && typeof raw === "object") {
    if (raw.min !== undefined) return `min. ${raw.min}`;
    if (raw.max !== undefined) return `max. ${raw.max}`;
  }
  return String(raw ?? "—");
}

function add2eSheetAppliedModifierRows(resolution) {
  return Array.isArray(resolution?.applied)
    ? resolution.applied.map(entry => {
      const modifier = entry?.modifier ?? {};
      return {
        id: String(modifier.id ?? ""),
        label: String(modifier.metadata?.label ?? modifier.source?.name ?? modifier.id ?? "Modificateur"),
        value: add2eSheetModifierValue(modifier),
        sourceName: String(modifier.source?.name ?? ""),
        sourceKind: String(modifier.source?.kind ?? ""),
        domain: String(modifier.domain ?? ""),
        target: String(modifier.target ?? "")
      };
    })
    : [];
}

function add2eSheetAbilityDerivedData(engine, actor, ability) {
  const derived = engine.resolveAbilityDerived(actor, ability, {
    source: "actor-sheet-base-data",
    consumer: "application-v2"
  });
  const total = Number(derived?.total) || 0;
  const rawTotal = Number.isFinite(Number(derived?.rawTotal)) ? Number(derived.rawTotal) : total;
  const score = Number.isFinite(Number(derived?.score)) ? Number(derived.score) : total;
  const base = Number(derived?.resolution?.base);
  const adjustment = Number.isFinite(base) ? total - base : 0;
  const profile = foundry.utils.deepClone(derived?.profile ?? {});
  const bounds = foundry.utils.deepClone(derived?.bounds ?? { min: 3, max: 25, status: "within-range", clamped: false });
  const bonusSpellRows = Object.entries(profile.bonusSortsParNiveau ?? {})
    .map(([level, amount]) => ({ level: Number(level), amount: Number(amount) || 0 }))
    .filter(row => Number.isInteger(row.level) && row.level > 0 && row.amount > 0)
    .sort((left, right) => left.level - right.level);
  const spellImmunities = Array.isArray(profile.immunitesSorts) ? [...profile.immunitesSorts] : [];
  const illusionImmunities = Array.isArray(profile.immunitesIllusions) ? [...profile.immunitesIllusions] : [];

  return {
    total,
    rawTotal,
    score,
    base: Number.isFinite(base) ? base : total,
    adjustment,
    adjustmentDisplay: `${adjustment >= 0 ? "+" : ""}${adjustment}`,
    hasAdjustment: adjustment !== 0,
    displayValue: derived?.displayValue ?? total,
    tableKey: derived?.tableKey ?? score,
    bounds,
    boundsStatus: String(bounds.status ?? "within-range"),
    outOfBounds: bounds.status !== "within-range",
    boundsDisplay: bounds.status === "below-minimum"
      ? `Profil minimum ${bounds.min}`
      : bounds.status === "above-maximum"
        ? `Profil maximum ${bounds.max}`
        : `Profil ${score}`,
    profile,
    profileSource: foundry.utils.deepClone(derived?.profileSource ?? {}),
    modifiers: add2eSheetAppliedModifierRows(derived?.resolution),
    resolution: derived?.resolution,
    exceptionalStrength: foundry.utils.deepClone(derived?.exceptionalStrength ?? {}),
    exceptionalStrengthEligible: derived?.exceptionalStrength?.eligible === true || derived?.exceptionalStrengthEligible === true,
    bonusSpellRows,
    bonusSpellsSummary: bonusSpellRows.length
      ? bonusSpellRows.map(row => `N${row.level} +${row.amount}`).join(" · ")
      : "Aucun",
    spellImmunities,
    spellImmunitiesSummary: spellImmunities.length ? spellImmunities.join(", ") : "Aucune",
    illusionImmunities,
    illusionImmunitiesSummary: illusionImmunities.length
      ? illusionImmunities.map(level => `N${level}`).join(", ")
      : "Aucune"
  };
}

function add2eSheetEquipmentModifierSummaries(engine, actor, items) {
  if (typeof engine.collect !== "function") {
    throw new Error("Le collecteur canonique ADD2E des modificateurs n’est pas disponible.");
  }
  const itemIds = new Set(items.map(item => String(item.id)));
  const summaries = Object.fromEntries(items.map(item => [item.id, []]));
  const modifiers = engine.collect(actor, {
    actor,
    consumer: "actor-sheet-equipment-summary"
  });

  for (const modifier of modifiers) {
    const sourceItemId = String(modifier?._context?.sourceItem?.id ?? "");
    const sourceId = String(modifier?.source?.id ?? "");
    const itemId = itemIds.has(sourceItemId) ? sourceItemId : itemIds.has(sourceId) ? sourceId : "";
    if (!itemId) continue;
    const label = String(modifier?.metadata?.label ?? modifier?.source?.name ?? modifier?.id ?? "Effet");
    summaries[itemId].push(`${label} ${add2eSheetModifierValue(modifier)}`);
  }

  return Object.fromEntries(Object.entries(summaries).map(([itemId, entries]) => [itemId, entries.join(" · ")]));
}

function add2eSheetMovementData(actor) {
  const computeMovement = globalThis.add2eComputeMovement;
  if (typeof computeMovement !== "function") {
    throw new Error("Le résolveur canonique ADD2E du mouvement et de l’encombrement n’est pas disponible.");
  }
  const movement = computeMovement(actor, {
    consumer: "actor-sheet-application-v2",
    movementMode: "ground"
  });
  if (!movement || typeof movement !== "object") {
    throw new Error(`La résolution canonique du mouvement est invalide pour ${actor?.name ?? "acteur"}.`);
  }
  return foundry.utils.deepClone(movement);
}

function add2eSheetCharismaSocialData(actor) {
  const followersResolver = globalThis.add2eResolveCharismaFollowers;
  const loyaltyResolver = globalThis.add2eResolveCharismaLoyalty;
  const reactionResolver = globalThis.add2eResolveCharismaReaction;
  if (
    typeof followersResolver !== "function"
    || typeof loyaltyResolver !== "function"
    || typeof reactionResolver !== "function"
  ) {
    throw new Error("Les résolveurs canoniques ADD2E de réaction, loyauté et compagnons ne sont pas disponibles.");
  }

  const followers = followersResolver(actor, {
    source: "actor-sheet-charisma-followers",
    consumer: "application-v2"
  });
  const loyalty = loyaltyResolver(actor, {
    source: "actor-sheet-charisma-loyalty",
    consumer: "application-v2"
  });
  const reaction = reactionResolver(actor, {
    source: "actor-sheet-charisma-reaction",
    consumer: "application-v2"
  });

  return {
    followers: {
      base: Number(followers?.base) || 0,
      maximum: Math.max(0, Math.trunc(Number(followers?.maximum) || 0)),
      adjustment: Math.trunc(Number(followers?.adjustment) || 0),
      modifiers: add2eSheetAppliedModifierRows(followers?.resolution),
      description: "Nombre maximum de compagnons d’armes après résolution canonique du Charisme et des modificateurs applicables."
    },
    loyalty: {
      base: Number(loyalty?.base) || 0,
      baseChance: Number(loyalty?.baseChance) || 0,
      charismaAdjustment: Math.trunc(Number(loyalty?.charismaAdjustment) || 0),
      permanentAdjustment: Math.trunc(Number(loyalty?.permanentAdjustment) || 0),
      threshold: Math.max(0, Math.min(100, Math.trunc(Number(loyalty?.threshold) || 0))),
      modifiers: add2eSheetAppliedModifierRows(loyalty?.resolution),
      description: "Seuil final du test de loyauté après Charisme, effets actifs, objets et autres modificateurs canoniques."
    },
    reaction: {
      charismaAdjustment: Math.trunc(Number(reaction?.charismaAdjustment) || 0),
      permanentAdjustment: Math.trunc(Number(reaction?.permanentAdjustment) || 0),
      adjustment: Math.trunc(Number(reaction?.adjustment) || 0),
      modifiers: add2eSheetAppliedModifierRows(reaction?.resolution),
      description: "Ajustement final de réaction initiale après Charisme, effets actifs, objets et autres modificateurs canoniques."
    }
  };
}

function add2eRequireClassFeatureApis() {
  const api = {
    getFeatures: globalThis.add2eGetActorClassFeatures,
    featureLevel: globalThis.add2eFeatureActorLevel,
    minLevel: globalThis.add2eFeatureMinLevel,
    maxLevel: globalThis.add2eFeatureMaxLevel,
    isActivable: globalThis.add2eIsFeatureActivable,
    thiefTable: globalThis.add2eGetActorThiefSkillTable
  };
  for (const [key, value] of Object.entries(api)) {
    if (typeof value !== "function") throw new Error(`API canonique ADD2E de capacité de classe indisponible : ${key}.`);
  }
  return api;
}

export function add2ePrepareActorSheetBaseData({ sheet, data }) {
  const actor = sheet.actor;
  const sys = data.actor.system;
  const items = data.actor.items ?? [];

  data.classIdentityRows = add2eSheetClassIdentityRows(actor);
  data.raceIdentity = add2eSheetRaceIdentity(actor);

  const spellEntriesForDisplay = globalThis.add2eGetSpellcastingEntries?.(actor);
  if (!Array.isArray(spellEntriesForDisplay)) {
    throw new Error("Le résolveur canonique ADD2E des entrées d’incantation est indisponible ou invalide.");
  }
  if (typeof globalThis.add2eSpellLabel !== "function" || typeof globalThis.add2eGetSpellSlotPoolsByLevel !== "function") {
    throw new Error("Les API canoniques ADD2E d’affichage des emplacements de sorts sont indisponibles.");
  }
  data.spellLists = spellEntriesForDisplay.map(entry => entry.label || globalThis.add2eSpellLabel(entry.key));
  data.spellcastingEntries = spellEntriesForDisplay;
  data.spellSlotsByPool = globalThis.add2eGetSpellSlotPoolsByLevel(actor);
  data.movement = add2eSheetMovementData(actor);

  const abilityEngine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine;
  if (!abilityEngine || typeof abilityEngine.resolveAbilityDerived !== "function") {
    throw new Error("Le résolveur canonique ADD2E des caractéristiques dérivées n’est pas disponible.");
  }
  data.abilityDerived = {};
  for (const carac of CARACS) {
    const derived = add2eSheetAbilityDerivedData(abilityEngine, actor, carac);
    data.abilityDerived[carac] = derived;
    sys[carac] = derived.total;
  }
  data.abilityDerived.charisme.social = add2eSheetCharismaSocialData(actor);

  data.canExceptionalStrength = data.abilityDerived.force?.exceptionalStrengthEligible === true;
  if (data.canExceptionalStrength && (sys.force_ex === undefined || sys.force_ex === null)) sys.force_ex = 0;
  data.progressionCourante = null;

  const featureApi = add2eRequireClassFeatureApis();
  const classFeaturesForDisplay = featureApi.getFeatures(actor)
    .map((feature, index) => ({ ...feature, __featureIndex: index }))
    .filter(feature => {
      const featureLevel = Number(featureApi.featureLevel(actor, feature));
      if (!Number.isFinite(featureLevel)) {
        throw new Error(`Niveau canonique introuvable pour la capacité « ${feature?.name ?? feature?.key ?? "inconnue"} ».`);
      }
      return featureLevel >= featureApi.minLevel(feature) && featureLevel <= featureApi.maxLevel(feature);
    });
  data.activeClassFeatures = classFeaturesForDisplay.filter(feature => featureApi.isActivable(feature));
  data.passiveClassFeatures = classFeaturesForDisplay.filter(feature => !featureApi.isActivable(feature));
  data.summaryClassFeatures = add2eBuildSummaryClassFeatures(classFeaturesForDisplay);
  data.thiefSkillRows = featureApi.thiefTable(actor);
  data.thiefActivity = add2ePrepareThiefActivityData(actor);

  data.listeArmes = items.filter(item => item.type === "arme");
  data.listeArmures = items.filter(item => item.type === "armure");
  data.thiefSkills = data.thiefSkillRows;
  data.listeObjets = items.filter(item => item.type === "objet");
  data.equipmentModifierSummaryByItemId = add2eSheetEquipmentModifierSummaries(abilityEngine, actor, data.listeObjets);

  return { actor, sys, items };
}