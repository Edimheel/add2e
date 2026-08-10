// ADD2E — Actor sheet getData : Race, Classe, capacités et équipement.

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

export function add2ePrepareActorSheetBaseData({ sheet, data }) {
  const actor = sheet.actor;
  const sys = data.actor.system;
  const items = data.actor.items ?? [];

  const classItem = data.actor.items.find(i => i.type === "classe") || null;
  if (classItem && classItem.system) {
    sys.details_classe = foundry.utils.duplicate(classItem.system);
    sys.classe = classItem.name;
    sys.classe_img = classItem.img;
    sys.spellcasting = foundry.utils.duplicate(classItem.system.spellcasting ?? null);
  } else {
    sys.details_classe = {};
    sys.classe = "";
    sys.classe_img = "";
    sys.spellcasting = null;
  }

  const spellEntriesForDisplay = add2eGetSpellcastingEntries(data.actor);
  data.spellLists = spellEntriesForDisplay.map(e => e.label || add2eSpellLabel(e.key));
  data.spellcastingEntries = spellEntriesForDisplay;
  data.spellSlotsByPool = add2eGetSpellSlotPoolsByLevel(data.actor);

  let raceItem = null;
  const raceKey = sys.race || "";
  if (raceKey && items.some(i => i.type === "race" && i.id === raceKey)) {
    raceItem = items.find(i => i.type === "race" && i.id === raceKey);
  }
  if (!raceItem && raceKey) {
    raceItem = items.find(i => i.type === "race" && (i.name || "").toLowerCase() === raceKey.toLowerCase());
  }
  if (!raceItem) raceItem = items.find(i => i.type === "race") || null;

  let details_race = {};
  if (raceItem && raceItem.system) {
    const rawCaps = raceItem.system.capacites;
    let capacites = [];
    if (Array.isArray(rawCaps)) capacites = rawCaps.filter(c => !!c && typeof c === "string");
    else if (rawCaps && typeof rawCaps === "object") capacites = Object.values(rawCaps).filter(c => !!c && typeof c === "string");
    details_race = {
      nom: raceItem.name || "",
      img: raceItem.img || "",
      bonus_caracteristiques: raceItem.system.bonus_caracteristiques || {},
      capacites,
      description: raceItem.system.description || "",
      langues: raceItem.system.langues || "",
      movement: raceItem.system.movement !== undefined ? raceItem.system.movement : 0,
      taille: raceItem.system.taille || "",
      âge_debut: raceItem.system["âge_debut"] || "",
      esperance_vie: raceItem.system["espérance_vie"] || "",
      description_longue: raceItem.system.description_longue || "",
      note_md: raceItem.system.note_md || "",
      limites_classes: raceItem.system.limites_classes || {},
      min_caracteristiques: raceItem.system.min_caracteristiques || {},
      max_caracteristiques: raceItem.system.max_caracteristiques || {}
    };
  }

  sys.details_race = details_race;
  data.movement = add2eSheetMovementData(actor);

  let details_classe = sys.details_classe || {};
  details_classe.specialAbilities = Array.isArray(details_classe.specialAbilities)
    ? details_classe.specialAbilities
    : (details_classe.specialAbilities ? Object.values(details_classe.specialAbilities) : []);
  sys.details_classe = details_classe;

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

  let niveau = Number(sys.niveau);
  if (!Number.isInteger(niveau) || niveau < 1) niveau = 1;
  if (Array.isArray(sys.niveau)) niveau = Number(sys.niveau.find(x => typeof x === "number" && !isNaN(x))) || 1;

  const progTab = sys.details_classe?.progression || [];
  const progressionCourante = progTab.length >= niveau ? progTab[niveau - 1] : null;
  if (progressionCourante && typeof progressionCourante.title === "undefined") {
    const titles = sys.details_classe?.titlesByLevel;
    if (Array.isArray(titles) && titles.length) {
      const t = titles.find(x => niveau >= Number(x.minLevel ?? x.niveau ?? 0) && niveau <= Number(x.maxLevel ?? x.niveau ?? 999));
      if (t && (t.title || t.titre)) progressionCourante.title = t.title || t.titre;
    }
    if (typeof progressionCourante.title === "undefined") progressionCourante.title = "";
  }

  const isMonk = (sys.details_classe?.label || sys.details_classe?.nom || sys.details_classe?.name || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f’']/g, "").includes("moine");
  if (isMonk && progressionCourante && typeof progressionCourante.monkAC !== "undefined") sys.ca_naturel = progressionCourante.monkAC;
  data.progressionCourante = progressionCourante;

  const classFeaturesForDisplay = (typeof add2eGetActorClassFeatures === "function" ? add2eGetActorClassFeatures(actor) : [])
    .map((feature, index) => ({ ...feature, __featureIndex: index }))
    .filter(feature => {
      const featureLevel = typeof add2eFeatureActorLevel === "function" ? add2eFeatureActorLevel(actor, feature) : niveau;
      return featureLevel >= add2eFeatureMinLevel(feature) && featureLevel <= add2eFeatureMaxLevel(feature);
    });
  data.activeClassFeatures = classFeaturesForDisplay.filter(feature => typeof add2eIsFeatureActivable === "function" ? add2eIsFeatureActivable(feature) : feature.activable === true);
  data.passiveClassFeatures = classFeaturesForDisplay.filter(feature => !(typeof add2eIsFeatureActivable === "function" ? add2eIsFeatureActivable(feature) : feature.activable === true));
  data.summaryClassFeatures = add2eBuildSummaryClassFeatures(classFeaturesForDisplay);
  data.thiefSkillRows = typeof add2eGetActorThiefSkillTable === "function" ? add2eGetActorThiefSkillTable(actor) : [];
  data.thiefActivity = add2ePrepareThiefActivityData(actor);

  data.listeArmes = items.filter(item => item.type === "arme");
  data.listeArmures = items.filter(item => item.type === "armure");
  data.thiefSkills = data.thiefSkillRows;
  data.listeObjets = items.filter(i => i.type === "objet");
  data.equipmentModifierSummaryByItemId = add2eSheetEquipmentModifierSummaries(abilityEngine, actor, data.listeObjets);

  return { actor, sys, items, niveau, progressionCourante, isMonk };
}
