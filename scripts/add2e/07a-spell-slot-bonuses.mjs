// ADD2E — Bonus génériques d'emplacements de sorts.
// Complète le quota de progression sans modifier les données de classe.

const ADD2E_SPELL_SLOT_BONUS_VERSION = "2026-07-12-generic-spell-slot-bonus-v2";
globalThis.ADD2E_SPELL_SLOT_BONUS_VERSION = ADD2E_SPELL_SLOT_BONUS_VERSION;

const WISDOM_BONUS_SPELLS = Object.freeze({
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

function normalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function number(value, fallback = 0) {
  if (value && typeof value === "object") {
    for (const key of ["value", "total", "current", "base", "actuel"]) {
      const candidate = Number(value[key]);
      if (Number.isFinite(candidate)) return candidate;
    }
  }
  const candidate = Number(value);
  return Number.isFinite(candidate) ? candidate : fallback;
}

function classItems(actor) {
  return Array.from(actor?.items ?? []).filter(item => String(item?.type ?? "").toLowerCase() === "classe");
}

function sourceClass(actor, source) {
  const id = String(source?.classItemId ?? source?.sourceClassId ?? source?.itemId ?? "").trim();
  if (id) return actor?.items?.get?.(id) ?? classItems(actor).find(item => item.id === id) ?? null;
  const wanted = normalize(source?.classSlug ?? source?.className ?? source?.key ?? "");
  if (!wanted) return null;
  return classItems(actor).find(item => {
    const system = item.system ?? {};
    return [item.name, system.slug, system.label, system.nom, system.name].map(normalize).includes(wanted);
  }) ?? null;
}

function actorAbility(actor, ability) {
  const system = actor?.system ?? {};
  const key = normalize(ability);
  const aliases = key === "wis" || key === "wisdom" ? ["sagesse", "wis", "wisdom"] : [key];
  for (const alias of aliases) {
    for (const field of [alias, `${alias}_total`, `${alias}Total`, `${alias}_base`]) {
      const score = number(system[field], NaN);
      if (!Number.isFinite(score)) continue;
      if (field.endsWith("_base")) {
        return score
          + number(system[`${alias}_race`], 0)
          + number(system.bonus_caracteristiques?.[alias], 0);
      }
      return score;
    }
  }
  return 0;
}

function wisdomBonusByLevel(actor, spellLevel) {
  const wisdom = Math.max(0, Math.min(25, Math.floor(actorAbility(actor, "sagesse"))));
  const row = WISDOM_BONUS_SPELLS[wisdom] ?? [];
  return Math.max(0, number(row[Math.max(0, Number(spellLevel) - 1)], 0));
}

function isFullPreparedDivineCaster(classItem) {
  const system = classItem?.system ?? {};
  const casting = system.spellcasting ?? {};
  if (casting.enabled === false) return false;
  const mode = normalize(casting.mode ?? system.casterType);
  const type = normalize(casting.type);
  const ability = normalize(casting.ability ?? casting.abilityKey ?? system.casterAbility);
  const startsAt = Math.max(1, number(casting.startsAt, 1));
  return mode === "divine"
    && (type === "prepared" || casting.usesPreparation === true)
    && ["sagesse", "wis", "wisdom"].includes(ability)
    && startsAt === 1;
}

function ruleArray(actor) {
  const engine = globalThis.Add2eEffectsEngine;
  const rules = [];
  if (engine?.getActiveRules) {
    try { rules.push(...(engine.getActiveRules(actor) ?? [])); } catch (_error) {}
  }
  if (engine?.getClassFeaturePassiveRules) {
    try { rules.push(...(engine.getClassFeaturePassiveRules(actor) ?? [])); } catch (_error) {}
  }
  const seen = new Set();
  return rules.filter(rule => {
    if (!rule || typeof rule !== "object") return false;
    const source = rule.source ?? {};
    const key = JSON.stringify([
      normalize(rule.kind ?? rule.type), rule.list ?? rule.entry ?? rule.spellList,
      rule.spellLevel ?? rule.level, rule.value ?? rule.amount,
      source.effectId, source.classItemId, source.featureId
    ]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function ruleMatches(rule, entry, spellLevel) {
  if (normalize(rule.kind ?? rule.type ?? rule.ruleType) !== "spell_slot_bonus") return false;
  const wantedList = normalize(rule.list ?? rule.entry ?? rule.spellList ?? "all");
  const entryKey = normalize(entry?.key);
  if (wantedList && !["all", "tout", "any", entryKey].includes(wantedList)) return false;
  const wantedLevel = rule.spellLevel ?? rule.level ?? rule.niveauSort ?? rule.niveau_sort;
  if (wantedLevel !== undefined && wantedLevel !== null && wantedLevel !== "" && Number(wantedLevel) !== Number(spellLevel)) return false;
  return true;
}

function genericEffectBonus(actor, entry, spellLevel) {
  let total = 0;
  const details = [];
  for (const rule of ruleArray(actor)) {
    if (!ruleMatches(rule, entry, spellLevel)) continue;
    const amount = number(rule.value ?? rule.amount ?? rule.bonus, 0);
    if (!amount) continue;
    total += amount;
    details.push({ amount, rule, source: rule.source ?? null });
  }
  return { total, details };
}

function wisdomBonusForEntry(actor, entry, spellLevel) {
  const sources = Array.isArray(entry?.sources) && entry.sources.length ? entry.sources : [entry];
  const eligible = sources.some(source => isFullPreparedDivineCaster(sourceClass(actor, source)));
  return eligible ? wisdomBonusByLevel(actor, spellLevel) : 0;
}

function spellSlotBonusDetails(actor, entry, spellLevel) {
  const wisdom = wisdomBonusForEntry(actor, entry, spellLevel);
  const generic = genericEffectBonus(actor, entry, spellLevel);
  return {
    total: wisdom + generic.total,
    wisdom,
    effects: generic.total,
    effectDetails: generic.details,
    abilityScore: actorAbility(actor, "sagesse"),
    entryKey: normalize(entry?.key),
    spellLevel: Number(spellLevel) || 1,
    version: ADD2E_SPELL_SLOT_BONUS_VERSION
  };
}

function addBonusesToPools(actor, pools) {
  if (!pools || typeof pools !== "object") return pools;
  for (const pool of Object.values(pools)) {
    if (!pool || typeof pool !== "object") continue;
    const levels = pool.slotsByLevel ?? {};
    const maxSpellLevel = Math.max(0, Number(pool.maxSpellLevel) || Object.keys(levels).length || 0);
    pool.baseSlotsByLevel = {};
    pool.bonusSlotsByLevel = {};
    for (let spellLevel = 1; spellLevel <= maxSpellLevel; spellLevel += 1) {
      const base = Math.max(0, number(levels[spellLevel] ?? levels[String(spellLevel)], 0));
      const details = spellSlotBonusDetails(actor, pool, spellLevel);
      pool.baseSlotsByLevel[spellLevel] = base;
      pool.bonusSlotsByLevel[spellLevel] = details;
      levels[spellLevel] = base + details.total;
    }
  }
  return pools;
}

function install() {
  const originalSlots = globalThis.add2eGetSlotsForEntryLevel;
  const originalPools = globalThis.add2eGetSpellSlotPoolsByLevel;
  if (typeof originalSlots !== "function" || typeof originalPools !== "function") return false;

  if (originalSlots.__add2eGenericSpellSlotBonus !== true) {
    const wrappedSlots = function add2eGetSlotsForEntryLevelWithBonuses(actor, entry, spellLevel) {
      const base = Math.max(0, number(originalSlots(actor, entry, spellLevel), 0));
      return base + spellSlotBonusDetails(actor, entry, spellLevel).total;
    };
    wrappedSlots.__add2eGenericSpellSlotBonus = true;
    wrappedSlots.__add2eBaseFunction = originalSlots;
    globalThis.add2eGetSlotsForEntryLevel = wrappedSlots;
  }

  if (originalPools.__add2eGenericSpellSlotBonus !== true) {
    const wrappedPools = function add2eGetSpellSlotPoolsByLevelWithBonuses(actor) {
      return addBonusesToPools(actor, originalPools(actor));
    };
    wrappedPools.__add2eGenericSpellSlotBonus = true;
    wrappedPools.__add2eBaseFunction = originalPools;
    globalThis.add2eGetSpellSlotPoolsByLevel = wrappedPools;
  }

  return true;
}

function rerenderForAbility(actor, changed) {
  if (!actor || actor.type !== "personnage") return;
  const flat = foundry.utils.flattenObject(changed ?? {});
  if (!Object.keys(flat).some(path => /^(system\.)?(sagesse|sagesse_base|sagesse_race|bonus_caracteristiques\.sagesse)$/.test(path))) return;
  window.setTimeout(() => globalThis.add2eRerenderActorSheet?.(actor, true), 30);
}

Hooks.once("ready", () => {
  install();
  Hooks.on("updateActor", rerenderForAbility);
});

install();

globalThis.add2eInstallGenericSpellSlotBonuses = install;
globalThis.add2eGetWisdomBonusSpellSlots = actor => {
  const result = {};
  for (let level = 1; level <= 7; level += 1) result[level] = wisdomBonusByLevel(actor, level);
  return result;
};
globalThis.add2eGetSpellSlotBonusDetails = spellSlotBonusDetails;
globalThis.add2eGetGenericSpellSlotEffectBonus = genericEffectBonus;
