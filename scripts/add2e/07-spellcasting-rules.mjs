// ============================================================
// ADD2E — Spellcasting par Items classe
// Version : 2026-07-26-int-wis-magic-canonical-v1
// Les Items classe sont l’unique source de niveau et de listes de sorts.
// Les profils dérivés canoniques sont l’unique source Intelligence/Sagesse.
// Compatible Foundry V13/V14/V15.
// ============================================================

globalThis.ADD2E_SPELL_PREPARATION_VERSION = "2026-07-26-int-wis-magic-canonical-v1";
globalThis.ADD2E_SPELL_FX_VERSION = "2026-05-21-spell-fx-central-v1";

function add2eRerenderActorSheet(actor, force = true) {
  if (!actor) return false;
  try {
    for (const app of Object.values(ui.windows ?? {})) {
      const appActor = app?.actor ?? app?.document ?? app?.object;
      if (appActor?.id === actor.id && app?.render) {
        app.render(force);
        return true;
      }
    }
  } catch (_error) {}
  return false;
}
globalThis.add2eRerenderActorSheet = add2eRerenderActorSheet;

function add2eNormalizeSpellKey(value) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[\s_-]+/g, "_");
  const aliases = {
    cleric: "clerc", clerc: "clerc", priest: "clerc", pretre: "clerc", prêtre: "clerc",
    paladin: "clerc",
    druid: "druide", druide: "druide", druidique: "druide",
    wizard: "magicien", mage: "magicien", magic_user: "magicien", magicien: "magicien", magician: "magicien",
    illusionist: "illusionniste", illusionniste: "illusionniste"
  };
  return aliases[normalized] || normalized;
}

function add2eSpellLabel(value) {
  const key = add2eNormalizeSpellKey(value);
  const labels = { clerc: "Clerc", druide: "Druide", magicien: "Magicien", illusionniste: "Illusionniste" };
  return labels[key] || String(value ?? key ?? "—");
}

function add2eToArray(value) {
  if (Array.isArray(value)) return value.filter(entry => entry !== undefined && entry !== null && String(entry).trim() !== "");
  if (typeof value === "string") return value.split(/[,;|]/).map(entry => entry.trim()).filter(Boolean);
  return [];
}

function add2eSpellSlug(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function add2eSpellNumber(value, fallback = null) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value === null || value === undefined || value === "") return fallback;
  if (value && typeof value === "object") {
    for (const key of ["value", "valeur", "total", "current", "base", "max", "niveau", "level", "xp"]) {
      const numeric = add2eSpellNumber(value[key], null);
      if (Number.isFinite(numeric)) return numeric;
    }
  }
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;
  const match = raw.match(/-?\d+(?:[.,]\d+)?/);
  if (!match) return fallback;
  const numeric = Number(match[0].replace(",", "."));
  return Number.isFinite(numeric) ? numeric : fallback;
}

function add2eSpellDerived(actor, ability, consumer = "spellcasting-rules") {
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine;
  if (!engine || typeof engine.resolveAbilityDerived !== "function") {
    throw new Error("Le résolveur canonique ADD2E des profils dérivés n’est pas disponible.");
  }
  return engine.resolveAbilityDerived(actor, ability, {
    source: "spellcasting-rules",
    consumer
  });
}

function add2eSpellClassItems(actor) {
  return Array.from(actor?.items ?? []).filter(item => String(item?.type ?? "").toLowerCase() === "classe");
}

function add2eSpellClassSlug(classDoc) {
  const system = classDoc?.system ?? {};
  return add2eSpellSlug(system.slug ?? system.label ?? system.nom ?? system.name ?? classDoc?.name ?? "classe");
}

function add2eSpellClassLevelFromItem(classDoc) {
  for (const value of [
    classDoc?.system?.niveau,
    classDoc?.system?.level,
    classDoc?.system?.currentLevel,
    classDoc?.system?.niveauActuel
  ]) {
    const level = add2eSpellNumber(value, null);
    if (Number.isFinite(level) && level >= 1) return Math.floor(level);
  }
  return 0;
}

function add2eResolveSpellClassItem(actor, source = null) {
  const classes = add2eSpellClassItems(actor);
  if (!classes.length) return null;

  const fromId = candidate => {
    const id = String(candidate ?? "").trim();
    return id ? classes.find(classDoc => String(classDoc?.id ?? "") === id) ?? null : null;
  };

  if (source && typeof source === "object") {
    const exact = fromId(source.id ?? source.itemId ?? source.classItemId ?? source.sourceClassId ?? source.sourceItemId);
    if (exact) return exact;

    const sourceSlug = add2eSpellSlug(source.classSlug ?? source.slug ?? source.className ?? source.name ?? "");
    if (sourceSlug) {
      const matches = classes.filter(classDoc => add2eSpellClassSlug(classDoc) === sourceSlug);
      if (matches.length === 1) return matches[0];
    }
    return null;
  }

  if (typeof source === "string" && source.trim()) {
    const slug = add2eSpellSlug(source);
    const matches = classes.filter(classDoc => add2eSpellClassSlug(classDoc) === slug);
    return matches.length === 1 ? matches[0] : null;
  }

  const spellcasters = classes.filter(classDoc => {
    const casting = classDoc?.system?.spellcasting;
    return casting && typeof casting === "object" && casting.enabled !== false;
  });
  return spellcasters.length === 1 ? spellcasters[0] : null;
}

function add2eActorIsMulticlass(actor) {
  return add2eSpellClassItems(actor).length > 1;
}

/** Le niveau est lu exclusivement sur l’Item classe exact. */
function add2eSpellClassLevel(actor, source = null) {
  const classDoc = add2eResolveSpellClassItem(actor, source);
  return classDoc ? add2eSpellClassLevelFromItem(classDoc) : 0;
}

function add2eSpellClassForEntry(actor, entry) {
  return add2eResolveSpellClassItem(actor, entry);
}

function add2eGetActorClassItemForSpellcasting(actor) {
  return add2eResolveSpellClassItem(actor);
}

function add2eGetProgressionRowForActor(actor, entry = null) {
  const classDoc = entry ? add2eSpellClassForEntry(actor, entry) : add2eGetActorClassItemForSpellcasting(actor);
  if (!classDoc) return {};
  const level = add2eSpellClassLevel(actor, classDoc);
  if (level < 1) return {};
  const progression = Array.isArray(classDoc.system?.progression) ? classDoc.system.progression : [];
  return progression.find(row => Number(row?.niveau ?? row?.level) === level) ?? progression[level - 1] ?? {};
}

function add2eReadSpellcastingSource(actor) {
  const classDoc = add2eGetActorClassItemForSpellcasting(actor);
  const casting = classDoc?.system?.spellcasting;
  return casting && typeof casting === "object" ? casting : {};
}

function add2eEntriesFromCasting(casting, classDoc = null) {
  const classSlug = classDoc ? add2eSpellClassSlug(classDoc) : null;
  const className = classDoc?.name ?? null;
  const classItemId = classDoc?.id ?? null;
  const rawEntries = Array.isArray(casting?.entries) ? casting.entries : Array.isArray(casting?.pools) ? casting.pools : null;

  if (rawEntries) {
    return rawEntries.map((entry, index) => {
      const rawKey = entry.key ?? entry.list ?? entry.liste ?? entry.name ?? entry.label ?? entry.type;
      const key = add2eNormalizeSpellKey(rawKey);
      return {
        index,
        key,
        label: entry.label || add2eSpellLabel(key),
        startsAt: Number(entry.startsAt ?? entry.startLevel ?? entry.niveauDepart ?? casting.startsAt ?? 1) || 1,
        maxSpellLevel: Number(entry.maxSpellLevel ?? entry.maxLevel ?? entry.maxNiveauSort ?? casting.maxSpellLevel ?? 0) || 0,
        slotsField: entry.slotsField || entry.slotField || entry.progressionField || null,
        notes: entry.notes || "",
        classItemId,
        classSlug,
        className
      };
    }).filter(entry => entry.key);
  }

  const lists = add2eToArray(casting?.lists).map(add2eNormalizeSpellKey).filter(Boolean);
  return [...new Set(lists)].map((key, index) => ({
    index,
    key,
    label: add2eSpellLabel(key),
    startsAt: Number(casting?.startsAt ?? 1) || 1,
    maxSpellLevel: Number(casting?.maxSpellLevel ?? 0) || 0,
    slotsField: null,
    notes: casting?.notes || "",
    classItemId,
    classSlug,
    className
  }));
}

function add2eMergeSpellcastingEntries(entries) {
  const byKey = new Map();
  for (const entry of entries ?? []) {
    const key = add2eNormalizeSpellKey(entry?.key);
    if (!key || !entry?.classItemId) continue;
    if (!byKey.has(key)) {
      byKey.set(key, {
        ...entry,
        key,
        label: add2eSpellLabel(key),
        classItemId: null,
        classSlug: null,
        className: null,
        startsAt: Number(entry.startsAt ?? 1) || 1,
        maxSpellLevel: Number(entry.maxSpellLevel ?? 0) || 0,
        sources: []
      });
    }
    const merged = byKey.get(key);
    merged.sources.push(entry);
    merged.startsAt = Math.min(Number(merged.startsAt ?? 1) || 1, Number(entry.startsAt ?? 1) || 1);
    merged.maxSpellLevel = Math.max(Number(merged.maxSpellLevel ?? 0) || 0, Number(entry.maxSpellLevel ?? 0) || 0);
  }
  return [...byKey.values()];
}

function add2eGetSpellcastingEntries(actor) {
  const entries = [];
  const seen = new Set();

  for (const classDoc of add2eSpellClassItems(actor)) {
    const casting = classDoc?.system?.spellcasting;
    if (!casting || typeof casting !== "object" || casting.enabled === false) continue;
    for (const entry of add2eEntriesFromCasting(casting, classDoc)) {
      const key = `${entry.classItemId}:${entry.key}`;
      if (seen.has(key)) continue;
      seen.add(key);
      entries.push(entry);
    }
  }

  return add2eMergeSpellcastingEntries(entries);
}

function add2eGetSpellListsFromItem(sort) {
  const system = sort?.system ?? {};
  const flags = sort?.flags?.add2e ?? {};
  const granted = [flags.grantedSpellLists, flags.learnedSpellLists, flags.knownSpellLists]
    .flatMap(add2eToArray)
    .map(add2eNormalizeSpellKey)
    .filter(Boolean);
  if (granted.length) return [...new Set(granted)];
  const fromLists = add2eToArray(system.spellLists).map(add2eNormalizeSpellKey).filter(Boolean);
  if (fromLists.length) return [...new Set(fromLists)];
  const legacy = system.classe || system.class || system.liste;
  const key = add2eNormalizeSpellKey(legacy);
  return key ? [key] : [];
}

function add2eIsObjectMagicSpellForPreparation(sort) {
  const system = sort?.system ?? {};
  const flags = sort?.flags?.add2e ?? {};
  return system.isPower === true || system.isObjectPower === true || !!system.sourceWeaponId || !!system.sourceItemId || system.powerIndex !== undefined || flags.sourceType === "objet_magique" || !!flags.sourceItemId || !!flags.sourceWeaponId || String(system.composantes ?? "").toLowerCase().includes("objet");
}

function add2eIsCapacitySpellForPreparation(sort) {
  const system = sort?.system ?? {};
  const flags = sort?.flags?.add2e ?? {};
  return system.isCapacity === true || system.isCapacite === true || system.usageType === "classFeature" || !!system.sourceCapacite || !!system.sourceFeature || flags.sourceType === "capacite" || flags.sourceType === "capacity";
}

function add2eIsRegularPreparableSpell(sort) {
  return !add2eIsObjectMagicSpellForPreparation(sort) && !add2eIsCapacitySpellForPreparation(sort);
}

function add2eReadSlotValue(raw, spellLevel, key) {
  if (typeof globalThis.add2eSpellSyncReadSlotValue === "function") return globalThis.add2eSpellSyncReadSlotValue(raw, spellLevel, key);
  const index = Math.max(0, Number(spellLevel) - 1);
  if (Array.isArray(raw)) return add2eSpellNumber(raw[index], 0) || 0;
  if (raw && typeof raw === "object") return add2eSpellNumber(raw[spellLevel] ?? raw[String(spellLevel)] ?? raw[index] ?? raw[String(index)] ?? raw[key], 0) || 0;
  if (raw !== undefined && raw !== null && raw !== "") return add2eSpellNumber(raw, 0) || 0;
  return null;
}

function add2eGetSlotsForSingleEntryLevel(actor, entry, spellLevel) {
  const classDoc = add2eSpellClassForEntry(actor, entry);
  if (!classDoc || add2eSpellClassLevel(actor, classDoc) < 1) return 0;
  const row = add2eGetProgressionRowForActor(actor, classDoc);
  if (!row || typeof row !== "object") return 0;

  const key = add2eNormalizeSpellKey(entry?.key);
  const label = entry?.label || add2eSpellLabel(key);
  const level = Number(spellLevel) || 1;
  const tryArray = raw => add2eReadSlotValue(raw, level, key);

  for (const containerName of ["spellSlotsByList", "spellsByList", "spellsPerLevelByList", "sortsParListe"]) {
    const container = row?.[containerName];
    if (!container || typeof container !== "object") continue;
    for (const [rawKey, value] of Object.entries(container)) {
      if (add2eNormalizeSpellKey(rawKey) !== key) continue;
      const slots = tryArray(value);
      if (slots !== null) return slots;
    }
  }

  const directFields = [
    entry?.slotsField,
    `spellsPerLevel_${key}`,
    `spellsPerLevel${label}`,
    `spellsPerLevel${String(label).replace(/\s+/g, "")}`,
    key === "druide" ? "spellsPerLevelDruide" : null,
    key === "magicien" ? "spellsPerLevelMagicien" : null,
    key === "clerc" ? "spellsPerLevelClerc" : null,
    key === "illusionniste" ? "spellsPerLevelIllusionniste" : null
  ].filter(Boolean);

  for (const field of directFields) {
    const slots = tryArray(row?.[field]);
    if (slots !== null) return slots;
  }

  return tryArray(row?.spellsPerLevel) ?? tryArray(row?.sortsParNiveau) ?? 0;
}

function add2eSpellAccessRequirementForSource(actor, source, spellLevel) {
  const classItem = add2eSpellClassForEntry(actor, source);
  const requirements = Array.isArray(classItem?.system?.spellAccessRequirements)
    ? classItem.system.spellAccessRequirements
    : [];
  const level = Number(spellLevel) || 0;
  const requirement = requirements.find(entry => Number(entry?.spellLevel ?? entry?.level ?? entry?.niveauSort) === level) ?? null;
  if (!requirement) return { ok: true, classItem, spellLevel: level, requirement: null };

  const requires = requirement.requires ?? requirement.requirement ?? requirement;
  const ability = String(requires.ability ?? requires.abilityKey ?? requires.caracteristique ?? "");
  const minimum = Number(requires.min ?? requires.minimum ?? requires.score ?? 0) || 0;
  const derived = ability ? add2eSpellDerived(actor, ability, "spell-access-requirement") : null;
  const score = Number(derived?.total) || 0;
  return {
    ok: !minimum || score >= minimum,
    classItem,
    spellLevel: level,
    requirement,
    ability: add2eSpellSlug(ability),
    minimum,
    score,
    derived
  };
}

function add2eSpellIntelligenceAccess(actor, entry, spellLevel) {
  const key = add2eNormalizeSpellKey(entry?.key);
  if (!["magicien", "illusionniste"].includes(key)) return { ok: true, applies: false, maximum: null, score: null };
  const derived = add2eSpellDerived(actor, "intelligence", "spell-level-access");
  const maximum = Math.max(0, Number(derived?.profile?.niveau_sort_max) || 0);
  const level = Number(spellLevel) || 0;
  return {
    ok: maximum > 0 && level <= maximum,
    applies: true,
    maximum,
    score: Number(derived?.total) || 0,
    derived
  };
}

function add2eSpellAccessEntryDetails(actor, entry, spellLevel) {
  const sources = Array.isArray(entry?.sources) && entry.sources.length ? entry.sources : [entry];
  const level = Number(spellLevel) || 0;
  const intelligence = add2eSpellIntelligenceAccess(actor, entry, level);
  const details = sources.map(source => {
    const actorLevel = add2eSpellClassLevel(actor, source);
    const startsAt = Number(source?.startsAt || 1);
    const maximum = Number(source?.maxSpellLevel || 0);
    const progression = {
      ok: actorLevel >= startsAt && (!maximum || level <= maximum),
      actorLevel,
      startsAt,
      maximum
    };
    const requirement = add2eSpellAccessRequirementForSource(actor, source, level);
    return {
      source,
      progression,
      requirement,
      intelligence,
      ok: progression.ok && requirement.ok && intelligence.ok
    };
  });
  return {
    ok: details.some(detail => detail.ok),
    details,
    eligibleSources: details.filter(detail => detail.ok).map(detail => detail.source),
    blockedSources: details.filter(detail => !detail.ok),
    intelligence
  };
}

function add2eSpellSlotBonusEligibleClass(classItem) {
  const system = classItem?.system ?? {};
  const casting = system.spellcasting ?? {};
  if (!classItem || casting.enabled === false) return false;
  const mode = add2eSpellSlug(casting.mode ?? system.casterType);
  const type = add2eSpellSlug(casting.type);
  const ability = add2eSpellSlug(casting.ability ?? casting.abilityKey ?? system.casterAbility);
  const startsAt = Math.max(1, add2eSpellNumber(casting.startsAt, 1));
  return mode === "divine"
    && (type === "prepared" || casting.usesPreparation === true)
    && ["sagesse", "wis", "wisdom"].includes(ability)
    && startsAt === 1;
}

function add2eSpellSlotRules(actor) {
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine;
  const rules = [];
  if (typeof engine?.getActiveRules === "function") {
    try { rules.push(...(engine.getActiveRules(actor) ?? [])); } catch (_error) {}
  }
  if (typeof engine?.getClassFeaturePassiveRules === "function") {
    try { rules.push(...(engine.getClassFeaturePassiveRules(actor) ?? [])); } catch (_error) {}
  }
  return rules.filter(rule => rule && typeof rule === "object");
}

function add2eGenericSpellSlotEffectBonus(actor, entry, spellLevel) {
  const entryKey = add2eNormalizeSpellKey(entry?.key);
  let total = 0;
  for (const rule of add2eSpellSlotRules(actor)) {
    if (add2eSpellSlug(rule.kind ?? rule.type ?? rule.ruleType) !== "spell_slot_bonus") continue;
    const wantedList = add2eNormalizeSpellKey(rule.list ?? rule.entry ?? rule.spellList ?? "all");
    if (wantedList && !["all", "tout", "any", entryKey].includes(wantedList)) continue;
    const wantedLevel = rule.spellLevel ?? rule.level ?? rule.niveauSort ?? rule.niveau_sort;
    if (wantedLevel !== undefined && wantedLevel !== null && wantedLevel !== "" && Number(wantedLevel) !== Number(spellLevel)) continue;
    total += add2eSpellNumber(rule.value ?? rule.amount ?? rule.bonus, 0) || 0;
  }
  return total;
}

function add2eWisdomBonusSpellSlots(actor, spellLevel) {
  const level = Math.max(1, Math.trunc(Number(spellLevel) || 1));
  const profile = add2eSpellDerived(actor, "sagesse", "divine-bonus-slots")?.profile ?? {};
  const byLevel = profile.bonusSortsParNiveau && typeof profile.bonusSortsParNiveau === "object"
    ? profile.bonusSortsParNiveau
    : {};
  return Math.max(0, add2eSpellNumber(byLevel[level], 0) || 0);
}

function add2eSpellSlotBonusDetails(actor, entry, spellLevel) {
  const access = add2eSpellAccessEntryDetails(actor, entry, spellLevel);
  if (!access.ok) {
    return {
      total: 0,
      wisdom: 0,
      effects: 0,
      abilityScore: Number(add2eSpellDerived(actor, "sagesse", "slot-details")?.total) || 0,
      spellLevel: Number(spellLevel) || 1,
      entryKey: add2eNormalizeSpellKey(entry?.key),
      blocked: true,
      access,
      version: globalThis.ADD2E_SPELL_PREPARATION_VERSION
    };
  }
  const sources = access.eligibleSources;
  const wisdom = sources.some(source => add2eSpellSlotBonusEligibleClass(add2eSpellClassForEntry(actor, source)))
    ? add2eWisdomBonusSpellSlots(actor, spellLevel)
    : 0;
  const effects = add2eGenericSpellSlotEffectBonus(actor, entry, spellLevel);
  return {
    total: wisdom + effects,
    wisdom,
    effects,
    abilityScore: Number(add2eSpellDerived(actor, "sagesse", "slot-details")?.total) || 0,
    spellLevel: Number(spellLevel) || 1,
    entryKey: add2eNormalizeSpellKey(entry?.key),
    blocked: false,
    access,
    version: globalThis.ADD2E_SPELL_PREPARATION_VERSION
  };
}

function add2eGetSlotsForEntryLevel(actor, entry, spellLevel) {
  const access = add2eSpellAccessEntryDetails(actor, entry, spellLevel);
  if (!access.ok) return 0;
  let base = 0;
  for (const source of access.eligibleSources) base += add2eGetSlotsForSingleEntryLevel(actor, source, spellLevel);
  return Math.max(0, base + add2eSpellSlotBonusDetails(actor, { ...entry, sources: access.eligibleSources }, spellLevel).total);
}

function add2eGetSpellSlotPoolsByLevel(actor) {
  const entries = add2eGetSpellcastingEntries(actor);
  const pools = {};
  for (const entry of entries) {
    const sources = Array.isArray(entry.sources) && entry.sources.length ? entry.sources : [];
    if (!sources.length) continue;
    const slotsByLevel = {};
    const baseSlotsByLevel = {};
    const bonusSlotsByLevel = {};
    const accessRequirementsByLevel = {};
    const maxSpellLevel = Number(entry.maxSpellLevel) || 9;
    const actorLevel = Math.max(0, ...sources.map(source => add2eSpellClassLevel(actor, source)));
    for (let level = 1; level <= maxSpellLevel; level += 1) {
      const access = add2eSpellAccessEntryDetails(actor, entry, level);
      accessRequirementsByLevel[level] = access;
      let base = 0;
      for (const source of access.eligibleSources) base += add2eGetSlotsForSingleEntryLevel(actor, source, level);
      const bonus = add2eSpellSlotBonusDetails(actor, { ...entry, sources: access.eligibleSources }, level);
      baseSlotsByLevel[level] = access.ok ? Math.max(0, base) : 0;
      bonusSlotsByLevel[level] = bonus;
      slotsByLevel[level] = access.ok ? Math.max(0, base + bonus.total) : 0;
    }
    pools[entry.key] = {
      ...entry,
      actorLevel,
      slotsByLevel,
      baseSlotsByLevel,
      bonusSlotsByLevel,
      accessRequirementsByLevel
    };
  }
  return pools;
}

function add2eEntryAvailableForSpell(actor, entry, spellLevel) {
  return add2eSpellAccessEntryDetails(actor, entry, spellLevel).ok;
}

function add2eGetSpellEntryForSpell(actor, sort) {
  if (!add2eIsRegularPreparableSpell(sort)) return null;
  const spellLevel = Number(sort?.system?.niveau ?? sort?.system?.level ?? 0) || 0;
  const spellLists = add2eGetSpellListsFromItem(sort);
  const entries = add2eGetSpellcastingEntries(actor);
  const matches = entries.filter(entry => spellLists.includes(entry.key));
  if (!matches.length) return null;
  return matches.find(entry => add2eEntryAvailableForSpell(actor, entry, spellLevel)) ?? null;
}

function add2eCanActorUseSpell(actor, sort) {
  if (!add2eIsRegularPreparableSpell(sort)) return { ok: false, reason: "not-regular-spell", sortLists: [], entries: add2eGetSpellcastingEntries(actor), entry: null };
  const spellLevel = Number(sort?.system?.niveau ?? sort?.system?.level ?? 0) || 0;
  const sortLists = add2eGetSpellListsFromItem(sort);
  const entries = add2eGetSpellcastingEntries(actor);
  const matching = entries.filter(entry => sortLists.includes(entry.key));
  if (!matching.length) return { ok: false, reason: "list", sortLists, entries, entry: null };

  for (const entry of matching) {
    const access = add2eSpellAccessEntryDetails(actor, entry, spellLevel);
    if (!access.ok) continue;
    const source = access.eligibleSources[0] ?? entry.sources?.[0] ?? entry;
    return { ok: true, reason: "ok", sortLists, entries, entry, actorLevel: add2eSpellClassLevel(actor, source), spellLevel, accessRequirements: access };
  }

  const entry = matching[0] ?? null;
  const access = entry ? add2eSpellAccessEntryDetails(actor, entry, spellLevel) : null;
  const source = entry?.sources?.[0] ?? entry;
  const intelligenceBlocked = access?.intelligence?.applies === true && access.intelligence.ok === false;
  const requirementBlocked = access?.blockedSources?.some(detail => detail.requirement?.ok === false);
  return {
    ok: false,
    reason: intelligenceBlocked ? "intelligence-level" : requirementBlocked ? "ability-requirement" : "level",
    sortLists,
    entries,
    entry,
    actorLevel: source ? add2eSpellClassLevel(actor, source) : 0,
    spellLevel,
    accessRequirements: access,
    maximumSpellLevel: intelligenceBlocked ? access.intelligence.maximum : null,
    intelligenceScore: intelligenceBlocked ? access.intelligence.score : null,
    requiredAbility: requirementBlocked ? access.blockedSources.find(detail => detail.requirement?.ok === false)?.requirement?.ability ?? "" : "",
    requiredScore: requirementBlocked ? access.blockedSources.find(detail => detail.requirement?.ok === false)?.requirement?.minimum ?? 0 : 0
  };
}

function add2eGetMemorizedByList(sort) {
  const raw = sort?.getFlag?.("add2e", "memorizedByList") ?? sort?.flags?.add2e?.memorizedByList ?? {};
  return raw && typeof raw === "object" && !Array.isArray(raw) ? foundry.utils.deepClone(raw) : {};
}

function add2eGetMemorizedCountForEntry(sort, entry) {
  const key = add2eNormalizeSpellKey(entry?.key);
  if (!sort || !key || !add2eIsRegularPreparableSpell(sort)) return 0;
  const lists = add2eGetSpellListsFromItem(sort).map(add2eNormalizeSpellKey).filter(Boolean);
  const legacyRaw = sort?.getFlag?.("add2e", "memorizedCount") ?? sort?.flags?.add2e?.memorizedCount;
  const legacyPresent = legacyRaw !== undefined && legacyRaw !== null && legacyRaw !== "";
  const legacyCount = Math.max(0, Number(legacyRaw) || 0);
  if (lists.length <= 1 && lists.includes(key) && legacyPresent) return legacyCount;
  const byList = add2eGetMemorizedByList(sort);
  if (Object.prototype.hasOwnProperty.call(byList, key)) return Math.max(0, Number(byList[key] ?? 0) || 0);
  return lists.length <= 1 && lists.includes(key) ? legacyCount : 0;
}

async function add2eSetMemorizedCountForEntry(sort, entry, value) {
  const key = add2eNormalizeSpellKey(entry?.key);
  if (!sort || !key || !add2eIsRegularPreparableSpell(sort)) return;
  const next = Math.max(0, Number(value) || 0);
  const byList = add2eGetMemorizedByList(sort);
  if (next > 0) byList[key] = next;
  else delete byList[key];
  for (const listKey of Object.keys(byList)) if ((Number(byList[listKey]) || 0) <= 0) delete byList[listKey];
  const total = Object.values(byList).reduce((sum, amount) => sum + (Number(amount) || 0), 0);
  await sort.update({
    "flags.add2e.memorizedByList": byList,
    "flags.add2e.memorizedCount": total
  }, { render: false, diff: false, add2eSpellPreparation: true });
}

function add2eGetTotalMemorizedCount(sort) {
  if (!sort || !add2eIsRegularPreparableSpell(sort)) return 0;
  const lists = add2eGetSpellListsFromItem(sort).map(add2eNormalizeSpellKey).filter(Boolean);
  const legacyRaw = sort?.getFlag?.("add2e", "memorizedCount") ?? sort?.flags?.add2e?.memorizedCount;
  const legacyPresent = legacyRaw !== undefined && legacyRaw !== null && legacyRaw !== "";
  if (lists.length <= 1 && legacyPresent) return Math.max(0, Number(legacyRaw) || 0);
  const byList = add2eGetMemorizedByList(sort);
  return Object.values(byList).reduce((sum, value) => sum + (Number(value) || 0), 0);
}

function add2eCountPreparedForEntryLevel(actor, entry, spellLevel) {
  const key = add2eNormalizeSpellKey(entry?.key);
  const level = Number(spellLevel) || 1;
  let total = 0;
  for (const sort of Array.from(actor?.items ?? []).filter(item => String(item?.type ?? "").toLowerCase() === "sort")) {
    if (!add2eIsRegularPreparableSpell(sort)) continue;
    const sortLevel = Number(sort.system?.niveau ?? sort.system?.level ?? 1) || 1;
    if (sortLevel !== level) continue;
    const lists = add2eGetSpellListsFromItem(sort).map(add2eNormalizeSpellKey).filter(Boolean);
    if (lists.includes(key)) total += add2eGetMemorizedCountForEntry(sort, entry);
  }
  return total;
}

Hooks.on("updateItem", (item, changed) => {
  const actor = item?.parent;
  if (actor?.type !== "personnage" || String(item?.type ?? "").toLowerCase() !== "classe") return;
  const flattened = foundry.utils.flattenObject(changed ?? {});
  if (!Object.prototype.hasOwnProperty.call(flattened, "system.niveau") && !Object.prototype.hasOwnProperty.call(flattened, "system.level")) return;
  window.setTimeout(() => add2eRerenderActorSheet(actor, true), 30);
});

Hooks.on("updateActor", (actor, changed) => {
  if (actor?.type !== "personnage") return;
  const flattened = foundry.utils.flattenObject(changed ?? {});
  if (!Object.keys(flattened).some(path => /^(system\.)?(intelligence|intelligence_base|sagesse|sagesse_base)$/.test(path) || path === "flags.add2e.modifiers")) return;
  window.setTimeout(() => add2eRerenderActorSheet(actor, true), 30);
});

globalThis.add2eNormalizeSpellKey = add2eNormalizeSpellKey;
globalThis.add2eSpellLabel = add2eSpellLabel;
globalThis.add2eSpellClassLevel = add2eSpellClassLevel;
globalThis.add2eGetSpellcastingEntries = add2eGetSpellcastingEntries;
globalThis.add2eGetSpellSlotPoolsByLevel = add2eGetSpellSlotPoolsByLevel;
globalThis.add2eGetSpellListsFromItem = add2eGetSpellListsFromItem;
globalThis.add2eGetSlotsForEntryLevel = add2eGetSlotsForEntryLevel;
globalThis.add2eGetSpellEntryForSpell = add2eGetSpellEntryForSpell;
globalThis.add2eCanActorUseSpell = add2eCanActorUseSpell;
globalThis.add2eIsObjectMagicSpellForPreparation = add2eIsObjectMagicSpellForPreparation;
globalThis.add2eIsCapacitySpellForPreparation = add2eIsCapacitySpellForPreparation;
globalThis.add2eIsRegularPreparableSpell = add2eIsRegularPreparableSpell;
globalThis.add2eGetMemorizedCountForEntry = add2eGetMemorizedCountForEntry;
globalThis.add2eSetMemorizedCountForEntry = add2eSetMemorizedCountForEntry;
globalThis.add2eGetTotalMemorizedCount = add2eGetTotalMemorizedCount;
globalThis.add2eCountPreparedForEntryLevel = add2eCountPreparedForEntryLevel;
globalThis.add2eGetWisdomBonusSpellSlots = actor => {
  const result = {};
  for (let level = 1; level <= 7; level += 1) result[level] = add2eWisdomBonusSpellSlots(actor, level);
  return result;
};
globalThis.add2eGetSpellSlotBonusDetails = add2eSpellSlotBonusDetails;
globalThis.add2eGetGenericSpellSlotEffectBonus = add2eGenericSpellSlotEffectBonus;
globalThis.add2eGetSpellAccessRequirementForSource = add2eSpellAccessRequirementForSource;
globalThis.add2eGetSpellAccessEntryDetails = add2eSpellAccessEntryDetails;
globalThis.add2eGetSpellIntelligenceAccess = add2eSpellIntelligenceAccess;

function evalFormuleValeur(valeur, niveau) {
  if (typeof valeur === "object" && typeof valeur.valeur !== "undefined") valeur = valeur.valeur;
  if (typeof valeur !== "string") return valeur;
  return valeur.replace(/@niv(?![a-z])/gi, String(niveau)).replace(/@niveau/gi, String(niveau));
}

const ADD2E_SPELL_FX_PRESETS = {
  default: { launch: "divine", target: "spark" },
  clerc_default: { launch: "divine", target: "spark" },
  druide_default: { launch: "nature", target: "nature" },
  magicien_default: { launch: "arcane", target: "spark" },
  illusionniste_default: { launch: "illusion", target: "illusion" },
  apaisement: { launch: "divine_soft", target: "calm" },
  epouvante: { launch: "divine_dark", target: "fear" },
  aquagenese: { launch: "water", target: "water" },
  destruction_eau: { launch: "water_dark", target: "dry" },
  benediction: { launch: "holy", target: "blessing" },
  malediction: { launch: "dark_prayer", target: "curse" },
  detection_magie: { launch: "detection", target: "magic_pulse" },
  detection_du_mal: { launch: "detection", target: "evil_pulse" },
  detection_du_bien: { launch: "detection", target: "good_pulse" }
};

globalThis.evalFormuleValeur = evalFormuleValeur;
globalThis.ADD2E_SPELL_FX_PRESETS = ADD2E_SPELL_FX_PRESETS;
