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
