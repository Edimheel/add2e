// ADD2E — Point d'entrée getData de la feuille ApplicationV2.
// Les comportements restent répartis en modules fonctionnels.

import "./13b-actor-sheet-get-data-core.mjs";

const ADD2E_SPELL_SLOT_BONUS_VERSION = "2026-07-12-generic-wisdom-slot-bonus-v1";
globalThis.ADD2E_SPELL_SLOT_BONUS_VERSION = ADD2E_SPELL_SLOT_BONUS_VERSION;

const ADD2E_WISDOM_BONUS_SPELLS = Object.freeze({
  13: Object.freeze([1]),
  14: Object.freeze([2]),
  15: Object.freeze([2, 1]),
  16: Object.freeze([2, 2]),
  17: Object.freeze([2, 2, 1]),
  18: Object.freeze([2, 2, 1, 1]),
  19: Object.freeze([3, 2, 1, 2]),
  20: Object.freeze([3, 3, 2, 2]),
  21: Object.freeze([3, 3, 2, 3, 1]),
  22: Object.freeze([3, 3, 3, 3, 2]),
  23: Object.freeze([3, 3, 3, 3, 2, 1]),
  24: Object.freeze([3, 3, 3, 3, 3, 2]),
  25: Object.freeze([3, 3, 3, 3, 3, 3, 1])
});

function add2eSpellSlotBonusNormalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function add2eSpellSlotBonusNumber(value, fallback = 0) {
  if (value && typeof value === "object") {
    for (const key of ["value", "total", "current", "base", "actuel"]) {
      const candidate = Number(value[key]);
      if (Number.isFinite(candidate)) return candidate;
    }
  }
  const candidate = Number(value);
  return Number.isFinite(candidate) ? candidate : fallback;
}

function add2eSpellSlotBonusAbility(actor, ability) {
  const system = actor?.system ?? {};
  const key = add2eSpellSlotBonusNormalize(ability);
  const aliases = ["wis", "wisdom", "sagesse"].includes(key)
    ? ["sagesse", "wis", "wisdom"]
    : [key];

  for (const alias of aliases) {
    for (const field of [alias, `${alias}_total`, `${alias}Total`]) {
      const score = add2eSpellSlotBonusNumber(system[field], NaN);
      if (Number.isFinite(score)) return score;
    }

    const base = add2eSpellSlotBonusNumber(system[`${alias}_base`], NaN);
    if (Number.isFinite(base)) {
      return base
        + add2eSpellSlotBonusNumber(system[`${alias}_race`], 0)
        + add2eSpellSlotBonusNumber(system.bonus_caracteristiques?.[alias], 0);
    }
  }
  return 0;
}

function add2eWisdomBonusSpellSlots(actor, spellLevel) {
  const wisdom = Math.max(0, Math.min(25, Math.floor(add2eSpellSlotBonusAbility(actor, "sagesse"))));
  const row = ADD2E_WISDOM_BONUS_SPELLS[wisdom] ?? [];
  return Math.max(0, add2eSpellSlotBonusNumber(row[Math.max(0, Number(spellLevel) - 1)], 0));
}

function add2eSpellSlotBonusClassItem(actor, source) {
  const classes = Array.from(actor?.items ?? []).filter(item => String(item?.type ?? "").toLowerCase() === "classe");
  const id = String(source?.classItemId ?? source?.sourceClassId ?? source?.itemId ?? "").trim();
  if (id) return actor?.items?.get?.(id) ?? classes.find(item => String(item.id) === id) ?? null;

  const wanted = add2eSpellSlotBonusNormalize(source?.classSlug ?? source?.className ?? "");
  if (!wanted) return null;
  return classes.find(item => {
    const system = item.system ?? {};
    return [item.name, system.slug, system.label, system.nom, system.name]
      .map(add2eSpellSlotBonusNormalize)
      .includes(wanted);
  }) ?? null;
}

function add2eSpellSlotBonusEligibleClass(classItem) {
  const system = classItem?.system ?? {};
  const casting = system.spellcasting ?? {};
  if (!classItem || casting.enabled === false) return false;

  const mode = add2eSpellSlotBonusNormalize(casting.mode ?? system.casterType);
  const type = add2eSpellSlotBonusNormalize(casting.type);
  const ability = add2eSpellSlotBonusNormalize(casting.ability ?? casting.abilityKey ?? system.casterAbility);
  const startsAt = Math.max(1, add2eSpellSlotBonusNumber(casting.startsAt, 1));

  return mode === "divine"
    && (type === "prepared" || casting.usesPreparation === true)
    && ["sagesse", "wis", "wisdom"].includes(ability)
    && startsAt === 1;
}

function add2eSpellSlotBonusRules(actor) {
  const engine = globalThis.Add2eEffectsEngine;
  const rules = [];
  if (typeof engine?.getActiveRules === "function") {
    try { rules.push(...(engine.getActiveRules(actor) ?? [])); }
    catch (_error) {}
  }
  if (typeof engine?.getClassFeaturePassiveRules === "function") {
    try { rules.push(...(engine.getClassFeaturePassiveRules(actor) ?? [])); }
    catch (_error) {}
  }
  return rules.filter(rule => rule && typeof rule === "object");
}

function add2eGenericSpellSlotEffectBonus(actor, entry, spellLevel) {
  const entryKey = add2eSpellSlotBonusNormalize(entry?.key);
  let total = 0;

  for (const rule of add2eSpellSlotBonusRules(actor)) {
    if (add2eSpellSlotBonusNormalize(rule.kind ?? rule.type ?? rule.ruleType) !== "spell_slot_bonus") continue;

    const wantedList = add2eSpellSlotBonusNormalize(rule.list ?? rule.entry ?? rule.spellList ?? "all");
    if (wantedList && !["all", "tout", "any", entryKey].includes(wantedList)) continue;

    const wantedLevel = rule.spellLevel ?? rule.level ?? rule.niveauSort ?? rule.niveau_sort;
    if (wantedLevel !== undefined && wantedLevel !== null && wantedLevel !== "" && Number(wantedLevel) !== Number(spellLevel)) continue;

    total += add2eSpellSlotBonusNumber(rule.value ?? rule.amount ?? rule.bonus, 0);
  }

  return total;
}

function add2eSpellSlotBonusDetails(actor, entry, spellLevel) {
  const sources = Array.isArray(entry?.sources) && entry.sources.length ? entry.sources : [entry];
  const wisdom = sources.some(source => add2eSpellSlotBonusEligibleClass(add2eSpellSlotBonusClassItem(actor, source)))
    ? add2eWisdomBonusSpellSlots(actor, spellLevel)
    : 0;
  const effects = add2eGenericSpellSlotEffectBonus(actor, entry, spellLevel);

  return {
    total: wisdom + effects,
    wisdom,
    effects,
    abilityScore: add2eSpellSlotBonusAbility(actor, "sagesse"),
    spellLevel: Number(spellLevel) || 1,
    entryKey: add2eSpellSlotBonusNormalize(entry?.key),
    version: ADD2E_SPELL_SLOT_BONUS_VERSION
  };
}

function add2eInstallGenericSpellSlotBonuses() {
  const baseSlots = globalThis.add2eGetSlotsForEntryLevel;
  const basePools = globalThis.add2eGetSpellSlotPoolsByLevel;
  const getEntries = globalThis.add2eGetSpellcastingEntries;

  if (typeof baseSlots !== "function" || typeof basePools !== "function" || typeof getEntries !== "function") return false;
  if (baseSlots.__add2eGenericWisdomSlots === true) return true;

  const slotsWithBonuses = function add2eGetSlotsForEntryLevelWithBonuses(actor, entry, spellLevel) {
    const base = Math.max(0, add2eSpellSlotBonusNumber(baseSlots(actor, entry, spellLevel), 0));
    return Math.max(0, base + add2eSpellSlotBonusDetails(actor, entry, spellLevel).total);
  };
  slotsWithBonuses.__add2eGenericWisdomSlots = true;
  slotsWithBonuses.__add2eBaseFunction = baseSlots;
  globalThis.add2eGetSlotsForEntryLevel = slotsWithBonuses;

  globalThis.add2eGetSpellSlotPoolsByLevel = function add2eGetSpellSlotPoolsByLevelWithBonuses(actor) {
    const entries = getEntries(actor);
    const pools = {};

    for (const entry of entries) {
      const sources = Array.isArray(entry?.sources) && entry.sources.length ? entry.sources : [];
      if (!sources.length) continue;

      const maxSpellLevel = Number(entry.maxSpellLevel) || 9;
      const actorLevel = Math.max(0, ...sources.map(source => globalThis.add2eSpellClassLevel?.(actor, source) ?? 0));
      const slotsByLevel = {};
      const baseSlotsByLevel = {};
      const bonusSlotsByLevel = {};

      for (let level = 1; level <= maxSpellLevel; level += 1) {
        const base = Math.max(0, add2eSpellSlotBonusNumber(baseSlots(actor, entry, level), 0));
        const bonus = add2eSpellSlotBonusDetails(actor, entry, level);
        baseSlotsByLevel[level] = base;
        bonusSlotsByLevel[level] = bonus;
        slotsByLevel[level] = Math.max(0, base + bonus.total);
      }

      pools[entry.key] = {
        ...entry,
        actorLevel,
        slotsByLevel,
        baseSlotsByLevel,
        bonusSlotsByLevel
      };
    }

    return pools;
  };

  globalThis.add2eGetWisdomBonusSpellSlots = actor => {
    const result = {};
    for (let level = 1; level <= 7; level += 1) result[level] = add2eWisdomBonusSpellSlots(actor, level);
    return result;
  };
  globalThis.add2eGetSpellSlotBonusDetails = add2eSpellSlotBonusDetails;
  globalThis.add2eGetGenericSpellSlotEffectBonus = add2eGenericSpellSlotEffectBonus;
  return true;
}

add2eInstallGenericSpellSlotBonuses();

Hooks.on("updateActor", (actor, changed) => {
  if (actor?.type !== "personnage") return;
  const flat = foundry.utils.flattenObject(changed ?? {});
  if (!Object.keys(flat).some(path => /^(system\.)?(sagesse|sagesse_base|sagesse_race|bonus_caracteristiques\.sagesse)$/.test(path))) return;
  window.setTimeout(() => globalThis.add2eRerenderActorSheet?.(actor, true), 30);
});

// ============================================================
// Mécaniques génériques exploitées par les capacités du Druide.
// ============================================================
const ADD2E_CLASS_MECHANICS_VERSION = "2026-07-12-generic-class-mechanics-v1";
globalThis.ADD2E_CLASS_MECHANICS_VERSION = ADD2E_CLASS_MECHANICS_VERSION;

function add2eClassMechanicAbilityAliases(value) {
  const key = add2eSpellSlotBonusNormalize(value);
  if (["wis", "wisdom", "sagesse"].includes(key)) return ["sagesse", "wis", "wisdom"];
  if (["cha", "charisma", "charisme"].includes(key)) return ["charisme", "cha", "charisma"];
  if (["int", "intelligence"].includes(key)) return ["intelligence", "int"];
  if (["dex", "dexterity", "dexterite"].includes(key)) return ["dexterite", "dex", "dexterity"];
  if (["con", "constitution"].includes(key)) return ["constitution", "con"];
  if (["str", "strength", "force"].includes(key)) return ["force", "str", "strength"];
  return [key];
}

function add2eClassMechanicAbility(actor, ability) {
  for (const alias of add2eClassMechanicAbilityAliases(ability)) {
    const score = add2eSpellSlotBonusAbility(actor, alias);
    if (Number.isFinite(score) && score > 0) return score;
  }
  return 0;
}

function add2eSpellAccessRequirementForSource(actor, source, spellLevel) {
  const classItem = add2eSpellSlotBonusClassItem(actor, source);
  const requirements = Array.isArray(classItem?.system?.spellAccessRequirements)
    ? classItem.system.spellAccessRequirements
    : [];
  const level = Number(spellLevel) || 0;
  const requirement = requirements.find(entry => Number(entry?.spellLevel ?? entry?.level ?? entry?.niveauSort) === level) ?? null;
  if (!requirement) return { ok: true, classItem, spellLevel: level, requirement: null };

  const requires = requirement.requires ?? requirement.requirement ?? requirement;
  const ability = requires.ability ?? requires.abilityKey ?? requires.caracteristique ?? "";
  const minimum = Number(requires.min ?? requires.minimum ?? requires.score ?? 0) || 0;
  const score = add2eClassMechanicAbility(actor, ability);
  return {
    ok: !minimum || score >= minimum,
    classItem,
    spellLevel: level,
    requirement,
    ability: add2eSpellSlotBonusNormalize(ability),
    minimum,
    score
  };
}

function add2eSpellAccessEntryDetails(actor, entry, spellLevel) {
  const sources = Array.isArray(entry?.sources) && entry.sources.length ? entry.sources : [entry];
  const details = sources.map(source => ({ source, ...add2eSpellAccessRequirementForSource(actor, source, spellLevel) }));
  return {
    ok: details.some(detail => detail.ok),
    details,
    eligibleSources: details.filter(detail => detail.ok).map(detail => detail.source),
    blockedSources: details.filter(detail => !detail.ok)
  };
}

function add2eInstallSpellAccessRequirements() {
  const baseSlots = globalThis.add2eGetSlotsForEntryLevel;
  const basePools = globalThis.add2eGetSpellSlotPoolsByLevel;
  const baseCanUse = globalThis.add2eCanActorUseSpell;
  if (typeof baseSlots !== "function" || typeof basePools !== "function") return false;
  if (baseSlots.__add2eSpellAccessRequirements === true) return true;

  const slotsWithRequirements = function add2eGetSlotsForEntryLevelWithRequirements(actor, entry, spellLevel) {
    const access = add2eSpellAccessEntryDetails(actor, entry, spellLevel);
    if (!access.ok) return 0;
    const filteredEntry = Array.isArray(entry?.sources)
      ? { ...entry, sources: access.eligibleSources }
      : entry;
    return Math.max(0, add2eSpellSlotBonusNumber(baseSlots(actor, filteredEntry, spellLevel), 0));
  };
  slotsWithRequirements.__add2eSpellAccessRequirements = true;
  slotsWithRequirements.__add2eBaseFunction = baseSlots;
  globalThis.add2eGetSlotsForEntryLevel = slotsWithRequirements;

  globalThis.add2eGetSpellSlotPoolsByLevel = function add2eGetSpellSlotPoolsByLevelWithRequirements(actor) {
    const pools = basePools(actor) ?? {};
    for (const pool of Object.values(pools)) {
      const maxSpellLevel = Number(pool?.maxSpellLevel) || 9;
      pool.accessRequirementsByLevel ??= {};
      for (let level = 1; level <= maxSpellLevel; level += 1) {
        const access = add2eSpellAccessEntryDetails(actor, pool, level);
        pool.accessRequirementsByLevel[level] = access;
        if (access.ok) continue;
        if (pool.slotsByLevel) pool.slotsByLevel[level] = 0;
        if (pool.baseSlotsByLevel) pool.baseSlotsByLevel[level] = 0;
        if (pool.bonusSlotsByLevel?.[level] && typeof pool.bonusSlotsByLevel[level] === "object") {
          pool.bonusSlotsByLevel[level] = {
            ...pool.bonusSlotsByLevel[level],
            total: 0,
            wisdom: 0,
            effects: 0,
            blockedByAbilityRequirement: true,
            access
          };
        }
      }
    }
    return pools;
  };

  if (typeof baseCanUse === "function") {
    globalThis.add2eCanActorUseSpell = function add2eCanActorUseSpellWithRequirements(actor, sort) {
      const result = baseCanUse(actor, sort);
      if (!result?.ok || !result.entry) return result;
      const spellLevel = Number(sort?.system?.niveau ?? sort?.system?.level ?? result.spellLevel ?? 0) || 0;
      const access = add2eSpellAccessEntryDetails(actor, result.entry, spellLevel);
      if (access.ok) return { ...result, accessRequirements: access };
      return {
        ...result,
        ok: false,
        reason: "ability-requirement",
        accessRequirements: access,
        requiredAbility: access.blockedSources[0]?.ability ?? "",
        requiredScore: access.blockedSources[0]?.minimum ?? 0,
        currentScore: access.blockedSources[0]?.score ?? 0
      };
    };
  }

  globalThis.add2eGetSpellAccessRequirementForSource = add2eSpellAccessRequirementForSource;
  globalThis.add2eGetSpellAccessEntryDetails = add2eSpellAccessEntryDetails;
  return true;
}

function add2eInstallElementalSaveBonuses() {
  const engine = globalThis.Add2eEffectsEngine;
  if (!engine || engine.__add2eElementalSaveBonuses === true) return Boolean(engine);
  const baseCategory = typeof engine.getSaveCategory === "function" ? engine.getSaveCategory.bind(engine) : null;
  const baseBonus = typeof engine.getSaveBonusVs === "function" ? engine.getSaveBonusVs.bind(engine) : null;

  engine.getSaveCategory = function getSaveCategoryWithElements(value) {
    const key = add2eSpellSlotBonusNormalize(value);
    if (/feu|fire|flamme|incend/.test(key)) return "feu";
    if (/foudre|electric|lightning|eclair/.test(key)) return "foudre";
    return baseCategory?.(value) ?? key;
  };

  engine.getSaveBonusVs = function getSaveBonusVsWithElements(actor, vsType) {
    const category = this.getSaveCategory(vsType);
    if (!["feu", "foudre"].includes(category)) return baseBonus?.(actor, vsType) ?? 0;

    const aliases = category === "feu"
      ? new Set(["feu", "fire", "flamme", "incendie"])
      : new Set(["foudre", "electricite", "electricity", "lightning", "eclair"]);
    let general = 0;
    let elemental = 0;
    for (const tag of this.getActiveTags?.(actor) ?? []) {
      if (tag.startsWith("bonus_save:")) {
        general += Number(tag.split(":")[1]) || 0;
        continue;
      }
      if (!tag.startsWith("bonus_save_vs:")) continue;
      const [, rawMatcher, rawValue] = tag.split(":");
      const matcher = add2eSpellSlotBonusNormalize(rawMatcher);
      if (matcher === "all" || matcher === "tout") general += Number(rawValue) || 0;
      else if (aliases.has(matcher)) elemental = Math.max(elemental, Number(rawValue) || 0);
    }
    return general + elemental;
  };

  const baseHasImmunity = typeof engine.hasImmunity === "function" ? engine.hasImmunity.bind(engine) : null;
  engine.hasImmunity = function hasImmunityWithConditionalClassTags(actor, immunityType) {
    const key = add2eSpellSlotBonusNormalize(immunityType);
    if ((key.includes("charme") || key.includes("charm")) && (key.includes("bois") || key.includes("woodland"))) {
      const tags = this.getActiveTags?.(actor) ?? [];
      if (tags.includes("immunite:charme_creatures_bois") || tags.includes("immunite:charme:creatures_bois")) return true;
    }
    return baseHasImmunity?.(actor, immunityType) ?? false;
  };

  engine.__add2eElementalSaveBonuses = true;
  return true;
}

function add2eGetClassNatureMechanics(actor) {
  const engine = globalThis.Add2eEffectsEngine;
  const tags = new Set(engine?.getActiveTags?.(actor) ?? []);
  const classItems = Array.from(actor?.items ?? []).filter(item => String(item?.type ?? "").toLowerCase() === "classe");
  const natureClass = classItems.find(item => {
    const values = [item.name, item.system?.slug, item.system?.label, ...(Array.isArray(item.system?.tags) ? item.system.tags : [])]
      .map(add2eSpellSlotBonusNormalize);
    return values.some(value => value === "druide" || value === "classe_druide");
  }) ?? null;
  const level = natureClass ? Number(globalThis.add2eSpellClassLevel?.(actor, { classItemId: natureClass.id }) ?? natureClass.system?.niveau ?? 0) || 0 : 0;

  return {
    classItem: natureClass,
    level,
    identifyPlants: tags.has("identification:plantes"),
    identifyAnimals: tags.has("identification:animaux"),
    identifyPureWater: tags.has("identification:eau_pure"),
    woodlandNoTrace: tags.has("deplacement_sans_trace:bois") && tags.has("terrain:boise"),
    extraNaturalLanguages: tags.has("langue_naturelle:supplementaire") ? Math.max(0, level - 2) : 0,
    immuneWoodlandCharm: tags.has("immunite:charme_creatures_bois") || tags.has("immunite:charme:creatures_bois"),
    animalShape: tags.has("forme_animale") || tags.has("forme_animale:3_jour"),
    saveBonusFire: engine?.getSaveBonusVs?.(actor, "feu") ?? 0,
    saveBonusLightning: engine?.getSaveBonusVs?.(actor, "foudre") ?? 0,
    version: ADD2E_CLASS_MECHANICS_VERSION
  };
}

add2eInstallSpellAccessRequirements();
add2eInstallElementalSaveBonuses();
globalThis.add2eGetClassNatureMechanics = add2eGetClassNatureMechanics;
