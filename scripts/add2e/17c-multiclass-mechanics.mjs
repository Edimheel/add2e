// ADD2E — Progression de classe canonique et points de vie canoniques.
// Un monoclasse est une collection d'un Item classe ; un multiclassé en a plusieurs.
// Le calcul des PV reçoit directement un Actor et ne dépend d'aucune feuille.
// Compatible Foundry V13/V14/V15.

import { MULTICLASS_VERSION, classItems as coreClassItems, classProgression, classProgressionUpdate, classSlug } from "./17b-multiclass-core.mjs";

const VERSION = "2026-08-10-canonical-hit-point-mutation-v13-render-batch";
const TAG = "[ADD2E][CLASSE][CANONIQUE]";
const timers = new Map();
const hitPointQueues = new Map();
const lastHitPointResolutions = new Map();

globalThis.ADD2E_MULTICLASS_MECHANICS_VERSION = VERSION;

const n = (value, fallback = 0) => {
  const out = Number(value);
  return Number.isFinite(out) ? out : fallback;
};
const classes = actor => coreClassItems(actor);
const hasClasses = actor => actor?.type === "personnage" && classes(actor).length > 0;
const keyFor = entry => classSlug(entry?.item) || String(entry?.itemId ?? "");

function same(left, right) {
  if (left === right) return true;
  return foundry?.utils?.deepEqual
    ? foundry.utils.deepEqual(left, right)
    : JSON.stringify(left) === JSON.stringify(right);
}

function clone(value) {
  if (value === undefined || value === null) return value;
  if (typeof foundry?.utils?.deepClone === "function") return foundry.utils.deepClone(value);
  if (typeof foundry?.utils?.duplicate === "function") return foundry.utils.duplicate(value);
  return JSON.parse(JSON.stringify(value));
}

function progressionRows(item) {
  return Array.isArray(item?.system?.progression) ? item.system.progression : [];
}

function rowFor(item, level) {
  const rows = progressionRows(item);
  return rows.find(row => n(row?.niveau ?? row?.level, 0) === level) ?? rows[Math.max(0, level - 1)] ?? {};
}

function parseXpMinimum(value) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.floor(value));
  const raw = String(value ?? "").replace(/\s+/g, "");
  const match = raw.match(/\d[\d.,]*/);
  return match ? Math.max(0, Math.floor(Number(match[0].replace(/\./g, "").replace(",", ".")) || 0)) : 0;
}

function titleFor(entry) {
  const direct = String(entry?.row?.title ?? entry?.row?.titre ?? "").trim();
  if (direct) return direct;
  const titles = Array.isArray(entry?.system?.titlesByLevel) ? entry.system.titlesByLevel : [];
  return String(titles.find(row => entry.level >= n(row?.minLevel ?? row?.niveauMin, 0)
    && entry.level <= n(row?.maxLevel ?? row?.niveauMax, 999))?.title ?? "").trim();
}

function currentXpFor(entry) {
  const row = progressionRows(entry.item).find(value => n(value?.niveau ?? value?.level, 0) === entry.level)
    ?? progressionRows(entry.item).filter(value => n(value?.niveau ?? value?.level, 0) <= entry.level).at(-1)
    ?? null;
  return parseXpMinimum(row?.xp ?? row?.experience ?? row?.xpRange ?? row?.niveau_xp);
}

function nextXpFor(entry) {
  const next = progressionRows(entry.item).find(row => n(row?.niveau ?? row?.level, 0) > entry.level);
  return next ? parseXpMinimum(next?.xp ?? next?.experience ?? next?.xpRange ?? next?.niveau_xp) : 0;
}

function entriesFor(actor, { includePnj = false } = {}) {
  const eligible = hasClasses(actor) || (includePnj && actor?.type === "pnj" && classes(actor).length > 0);
  if (!eligible) return [];
  return classes(actor).flatMap(item => {
    const state = classProgression(item);
    if (!state?.hasLevel || !state?.hasXp) return [];
    const level = state.level;
    const row = rowFor(item, level);
    const entry = { item, itemId: item.id, system: item.system ?? {}, level, xp: state.xp, row };
    return [{
      ...entry,
      name: item.name,
      slug: classSlug(item),
      title: titleFor(entry),
      currentXp: currentXpFor(entry),
      nextXp: nextXpFor(entry),
      levelMaxRace: 0
    }];
  });
}

function bestThac0(entries) {
  const values = entries.map(entry => n(entry.row?.thac0 ?? entry.row?.thaco, NaN)).filter(Number.isFinite);
  return values.length ? Math.min(...values) : null;
}

function bestSaves(entries) {
  const rows = entries.map(entry => entry.row?.savingThrows ?? entry.row?.sauvegardes ?? entry.row?.saves).filter(Array.isArray);
  if (!rows.length) return null;
  return Array.from({ length: Math.max(...rows.map(row => row.length)) }, (_value, index) => {
    const values = rows.map(row => n(row[index], NaN)).filter(Number.isFinite);
    return values.length ? Math.min(...values) : "";
  });
}

function combinedSpellcasting(entries) {
  if (entries.length === 1) return foundry.utils.deepClone(entries[0].system?.spellcasting ?? null);
  const lists = [...new Set(entries.flatMap(entry => {
    const spellcasting = entry.system?.spellcasting;
    return spellcasting?.enabled === true && Array.isArray(spellcasting.lists) ? spellcasting.lists : [];
  }).filter(Boolean))];
  return lists.length ? {
    enabled: true,
    mode: "multiclass",
    type: "prepared",
    lists,
    usesSlots: true,
    usesPreparation: true,
    preparationSource: "class-items"
  } : null;
}

function progressionLines(entries) {
  return entries.map(entry => ({
    itemId: entry.itemId,
    name: entry.name,
    slug: entry.slug,
    level: entry.level,
    xp: entry.xp,
    title: entry.title,
    nextXp: entry.nextXp,
    levelMaxRace: entry.levelMaxRace
  }));
}

function summaryFromEntries(actor, entries) {
  if (!entries.length) return null;
  const multi = entries.length > 1;
  const label = entries.map(entry => entry.name).join(" / ");
  const title = entries.map(entry => `${entry.name} ${entry.level}${entry.title ? ` (${entry.title})` : ""}`).join(" / ");
  const totalXp = multi ? entries.reduce((total, entry) => total + entry.xp, 0) : entries[0].xp;
  const displayLevel = multi ? Math.max(...entries.map(entry => entry.level)) : entries[0].level;
  const thac0 = bestThac0(entries);
  const saves = bestSaves(entries);
  const nextValues = entries.map(entry => entry.nextXp).filter(value => value > 0);
  const nextXp = multi ? (nextValues.length ? Math.min(...nextValues) : 0) : entries[0].nextXp;
  const progress = multi
    ? entries.map(entry => `${entry.name} ${entry.xp.toLocaleString()}${entry.nextXp ? ` / ${entry.nextXp.toLocaleString()} XP` : " XP"}`).join(" — ")
    : `${entries[0].xp.toLocaleString()}${entries[0].nextXp ? ` / ${entries[0].nextXp.toLocaleString()} XP` : " XP"}`;
  const minXp = multi ? Math.min(...entries.map(entry => entry.currentXp)) : entries[0].currentXp;
  const percent = nextXp > minXp ? Math.max(0, Math.min(100, Math.floor(((totalXp - minXp) / (nextXp - minXp)) * 100))) : 100;
  const stored = actor.system?.multiclasse && typeof actor.system.multiclasse === "object" ? actor.system.multiclasse : {};
  const { classes: _legacyClasses, ...metadata } = stored;

  return {
    lines: progressionLines(entries),
    multi,
    label,
    title,
    thac0,
    saves,
    values: {
      classe: label,
      details_classe: multi
        ? { label, name: label, multiclass: true, source: "class-items" }
        : {
          ...foundry.utils.deepClone(entries[0].system ?? {}),
          name: entries[0].name,
          label: entries[0].system?.label ?? entries[0].name,
          slug: entries[0].slug,
          sourceItemId: entries[0].itemId,
          sourceItemUuid: entries[0].item?.uuid
        },
      classe_img: multi ? "" : entries[0].item?.img ?? "",
      spellcasting: combinedSpellcasting(entries),
      niveau: displayLevel,
      niveau_suggere: displayLevel,
      xp: totalXp,
      titre: title,
      progression_xp: progress,
      xp_next: nextXp,
      xp_to_next: nextXp ? Math.max(0, nextXp - (multi ? Math.min(...entries.map(entry => entry.xp)) : entries[0].xp)) : 0,
      xp_percent: percent,
      multiclasse: {
        ...metadata,
        schema: Number(metadata.schema ?? 3) || 3,
        enabled: multi,
        mode: multi ? "racial" : "mono",
        xpSplit: multi ? "equal" : "none",
        label
      }
    }
  };
}

function applySummaryToView(data, summary) {
  const system = data?.actor?.system;
  if (!system || !summary) return data;
  for (const [key, value] of Object.entries(summary.values)) system[key] = foundry.utils.deepClone(value);
  if (summary.thac0 !== null) system.thaco = summary.thac0;
  if (summary.saves) system.sauvegardes = foundry.utils.deepClone(summary.saves);

  data.classProgression = {
    enabled: true,
    isMulticlass: summary.multi,
    classes: summary.lines,
    title: summary.title
  };
  data.multiclass = {
    enabled: summary.multi,
    classes: summary.lines,
    title: summary.title
  };

  const first = summary.lines[0];
  const progression = summary.multi
    ? { ...(data.progressionCourante ?? {}), title: summary.title, _add2eMulticlassComposite: true }
    : foundry.utils.deepClone(entriesFor(data.document ?? data.actor)?.[0]?.row ?? data.progressionCourante ?? {});
  progression.title = summary.multi ? summary.title : first?.title ?? progression.title ?? "";
  if (summary.thac0 !== null) {
    progression.thac0 = summary.thac0;
    progression.thaco = summary.thac0;
  }
  if (summary.saves) {
    progression.savingThrows = foundry.utils.deepClone(summary.saves);
    progression.sauvegardes = foundry.utils.deepClone(summary.saves);
  }
  data.progressionCourante = progression;
  if (data.combatDefense && summary.thac0 !== null) data.combatDefense.thaco = summary.thac0;
  data.canExceptionalStrength = Number(system.force ?? 0) === 18
    && summary.lines.some(entry => ["guerrier", "paladin", "rodeur", "ranger"].includes(entry.slug));
  return data;
}

function applyClassProgressionToSheet(actor, data) {
  const entries = entriesFor(actor);
  if (!entries.length || !data) return data;
  return applySummaryToView(data, summaryFromEntries(actor, entries));
}

async function ensureCanonicalClassProgression(actor) {
  if (!hasClasses(actor)) return false;
  const docs = classes(actor);
  const missing = docs.filter(item => {
    const state = classProgression(item);
    return !state.hasLevel || !state.hasXp;
  });
  if (!missing.length) return true;

  if (docs.length > 1) {
    const migrate = globalThis.add2eMigrateLegacyMulticlassActor;
    const result = typeof migrate === "function" ? await migrate(actor) : null;
    return result?.ok === true;
  }

  const classDoc = docs[0];
  const update = classProgressionUpdate(classDoc, {
    level: Math.max(1, Math.floor(n(actor.system?.niveau, 1))),
    xp: Math.max(0, Math.floor(n(actor.system?.xp, 0)))
  });
  if (!update) return false;
  await actor.updateEmbeddedDocuments("Item", [update], {
    add2eInternal: true,
    add2eMulticlassInternal: true,
    add2eReason: "single-class-item-progression-migration",
    render: false
  });
  return true;
}

async function syncClassProgressionSummary(actor, { reason = "class-item-progression-summary" } = {}) {
  if (!(await ensureCanonicalClassProgression(actor))) return false;
  const entries = entriesFor(actor);
  const summary = summaryFromEntries(actor, entries);
  if (!summary) return false;
  const updates = {};
  for (const [key, value] of Object.entries(summary.values)) {
    const path = `system.${key}`;
    if (!same(foundry.utils.getProperty(actor, path), value)) updates[path] = value;
  }
  if (summary.thac0 !== null && Number(actor.system?.thaco) !== summary.thac0) updates["system.thaco"] = summary.thac0;
  if (summary.saves && !same(actor.system?.sauvegardes, summary.saves)) updates["system.sauvegardes"] = summary.saves;
  if (!Object.keys(updates).length) return true;
  await actor.update(updates, {
    add2eInternal: true,
    add2eMulticlassInternal: true,
    add2eReason: reason,
    render: false
  });
  return true;
}

function hitPointEngine() {
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine ?? null;
  if (typeof engine?.resolveHitPoints !== "function" || typeof engine?.setHitPoints !== "function") {
    throw new Error("Le résolveur/mutateur canonique ADD2E des points de vie n’est pas disponible.");
  }
  if (typeof engine?.resolveAbilityDerived !== "function") {
    throw new Error("Le résolveur canonique ADD2E des ajustements de caractéristiques n’est pas disponible.");
  }
  return engine;
}

function hitDieFor(entry) {
  const die = Math.floor(n(entry?.system?.hitDie ?? entry?.system?.dv, 0));
  return die > 0 ? die : 0;
}

function isWarriorEntry(entry) {
  return ["guerrier", "paladin", "ranger", "rodeur"].includes(String(entry?.slug ?? ""));
}

function constitutionHitPointBonus(actor, entries = []) {
  const engine = hitPointEngine();
  const multi = entries.length > 1;
  const derived = engine.resolveAbilityDerived(actor, "constitution", {
    domain: "hit-points",
    type: multi ? "multiclass-hit-points" : "single-class-hit-points",
    source: "canonical-hit-points",
    consumer: "class-item-progression"
  });

  if (!multi && entries[0]) {
    const progression = typeof globalThis.add2eResolveConstitutionHitPointProgression === "function"
      ? globalThis.add2eResolveConstitutionHitPointProgression(actor, entries[0].item)
      : null;
    const profileValue = isWarriorEntry(entries[0])
      ? derived?.profile?.pv_guerrier ?? derived?.profile?.pv
      : derived?.profile?.pv;
    const value = Number(progression?.constitutionBonusPerDie ?? profileValue);
    return Number.isFinite(value) ? Math.trunc(value) : 0;
  }

  const profileValue = entries.some(isWarriorEntry)
    ? derived?.profile?.pv_guerrier ?? derived?.profile?.pv
    : derived?.profile?.pv;
  const value = Number(profileValue);
  return Number.isFinite(value) ? Math.trunc(value) : 0;
}

function singleClassHitPointBase(actor, entry, { force = false } = {}) {
  const hitDie = hitDieFor(entry);
  if (!hitDie) throw new Error(`Dé de vie invalide pour la classe ${entry?.name ?? "inconnue"}.`);
  const level = Math.max(1, Math.floor(n(entry.level, 1)));
  const constitutionBonusPerDie = constitutionHitPointBonus(actor, [entry]);
  let rolls = Array.isArray(actor.system?.hpRolls) && !force ? [...actor.system.hpRolls] : [];

  if (!Number.isFinite(Number(rolls[0]))) rolls[0] = hitDie;
  for (let index = 1; index < level; index += 1) {
    const current = Number(rolls[index]);
    if (Number.isFinite(current) && current >= 1 && current <= hitDie) continue;
    rolls[index] = 1 + Math.floor(Math.random() * hitDie);
  }
  rolls = rolls.slice(0, level).map((value, index) => index === 0
    ? (Number.isFinite(Number(value)) ? Number(value) : hitDie)
    : Math.max(1, Math.min(hitDie, Math.floor(n(value, 1)))));

  const classContributions = rolls.map((roll, index) => ({
    level: index + 1,
    classItemId: entry.itemId,
    classItemUuid: entry.item?.uuid ?? null,
    className: entry.name,
    hitDie,
    roll,
    constitutionBonus: constitutionBonusPerDie,
    total: Math.max(1, roll + constitutionBonusPerDie)
  }));
  const baseMaximum = Math.max(1, classContributions.reduce((total, row) => total + row.total, 0));
  return { mode: "single-class", level, rolls, constitutionBonusPerDie, classContributions, baseMaximum };
}

function multiclassHitPointBase(actor, entries, { force = false } = {}) {
  const level = Math.max(...entries.map(entry => Math.max(1, Math.floor(n(entry.level, 1)))));
  const constitutionBonusPerDie = constitutionHitPointBonus(actor, entries);
  const rolls = Array.isArray(actor.system?.hpRollsMulticlass) && !force
    ? clone(actor.system.hpRollsMulticlass)
    : [];
  const classContributions = [];
  let baseMaximum = 0;

  for (let index = 0; index < level; index += 1) {
    const activeEntries = entries.filter(entry => entry.level > index && hitDieFor(entry) > 0);
    if (!activeEntries.length) continue;
    rolls[index] ??= {};
    let totalRolls = 0;
    const sources = [];

    for (const entry of activeEntries) {
      const hitDie = hitDieFor(entry);
      const key = keyFor(entry);
      let roll = n(rolls[index][key], NaN);
      if (!Number.isFinite(roll) || roll < 1 || roll > hitDie) {
        roll = index === 0 ? hitDie : 1 + Math.floor(Math.random() * hitDie);
        rolls[index][key] = roll;
      }
      totalRolls += roll;
      sources.push({
        classItemId: entry.itemId,
        classItemUuid: entry.item?.uuid ?? null,
        className: entry.name,
        classSlug: entry.slug,
        hitDie,
        roll
      });
    }

    const divisor = activeEntries.length;
    const total = Math.max(1, Math.floor(((totalRolls + constitutionBonusPerDie) / divisor) + 0.5));
    baseMaximum += total;
    classContributions.push({
      level: index + 1,
      sources,
      totalRolls,
      constitutionBonus: constitutionBonusPerDie,
      divisor,
      total
    });
  }

  return {
    mode: "multiclass",
    level,
    rolls: rolls.slice(0, level),
    constitutionBonusPerDie,
    classContributions,
    baseMaximum: Math.max(1, Math.floor(baseMaximum))
  };
}

function hitPointActorKey(actor) {
  return String(actor?.uuid ?? actor?.id ?? "");
}

function hitPointContext(actor, entries, level, reason) {
  const levelBySource = Object.fromEntries(entries.flatMap(entry => [
    [entry.itemId, entry.level],
    [entry.item?.uuid, entry.level]
  ]).filter(([key]) => Boolean(key)));
  const mode = entries.length > 1 ? "multiclass" : "single-class";
  return {
    actor,
    level,
    source: reason,
    consumer: "canonical-class-hit-points",
    mode,
    classLevels: entries.map(entry => ({
      itemId: entry.itemId,
      uuid: entry.item?.uuid,
      level: entry.level,
      slug: entry.slug
    })),
    levelBySource
  };
}

function currentHitPointModifierProfile(actor, context) {
  const engine = hitPointEngine();
  if (typeof engine.prepareHitPointModifiers !== "function" || typeof engine.resolve !== "function") {
    throw new Error("Le résolveur canonique des modificateurs de PV courants est indisponible.");
  }
  const modifiers = engine.prepareHitPointModifiers(actor, "current", context);
  const unsupported = modifiers.filter(modifier => String(modifier?.operation ?? "add") !== "add");
  if (unsupported.length) {
    const labels = unsupported.map(modifier => modifier?.source?.name ?? modifier?.id ?? "modificateur inconnu").join(", ");
    throw new Error(`Les modificateurs persistants de PV courants acceptent uniquement l’opération add : ${labels}.`);
  }
  const resolution = engine.resolve(actor, {
    domain: "hit-points",
    target: "current",
    base: 0,
    context,
    modifiers,
    rounding: "floor"
  });
  return {
    total: Number(resolution?.total) || 0,
    modifiers,
    resolution
  };
}

function getHitPointCurrentBase(actor, options = {}) {
  if (!actor?.system) return 0;
  const previousMaximum = n(options.previousMaximum, n(actor.system?.points_de_coup, 0));
  const previousCurrent = n(options.previousCurrent, n(actor.system?.pdv, previousMaximum));
  const requested = Number(options.previousCurrentBase);
  if (Number.isFinite(requested)) {
    return { value: requested, source: "explicit" };
  }

  const last = lastHitPointResolutions.get(hitPointActorKey(actor));
  const lastBase = Number(last?.currentBase);
  const lastMaximum = Number(last?.finalMaximum);
  const lastCurrent = Number(last?.finalCurrent);
  if (Number.isFinite(lastBase) && lastMaximum === previousMaximum && Number.isFinite(lastCurrent)) {
    return {
      value: lastBase + (previousCurrent - lastCurrent),
      source: previousCurrent === lastCurrent ? "last-resolution" : "last-resolution-current-delta"
    };
  }

  const entries = options.entries ?? entriesFor(actor, { includePnj: actor.type === "pnj" });
  const level = Number(options.level) || Math.max(1, ...entries.map(entry => n(entry.level, 1)));
  const context = options.context ?? hitPointContext(
    actor,
    entries,
    level,
    options.reason ?? "hit-points-current-base"
  );
  const profile = currentHitPointModifierProfile(actor, context);
  return {
    value: previousCurrent - profile.total,
    source: "active-current-modifier-inversion",
    previousAdjustment: profile.total
  };
}

async function calculateHitPointState(actor, options = {}) {
  const force = options.force === true;
  const reason = options.reason ?? "hit-points-recalculate";
  if (!actor?.system) return { ok: false, reason: "actor-without-system" };
  if (actor.type === "personnage" && !(await ensureCanonicalClassProgression(actor))) {
    return { ok: false, reason: "class-progression-unavailable" };
  }

  const entries = entriesFor(actor, { includePnj: actor.type === "pnj" });
  if (!entries.length) return { ok: false, reason: "no-canonical-class-entry" };
  const base = entries.length === 1
    ? singleClassHitPointBase(actor, entries[0], { force })
    : multiclassHitPointBase(actor, entries, { force });
  const engine = hitPointEngine();
  const context = hitPointContext(actor, entries, base.level, reason);
  const previousMaximum = n(actor.system?.points_de_coup, 0);
  const previousCurrent = n(actor.system?.pdv, previousMaximum);
  const previousCurrentBaseState = getHitPointCurrentBase(actor, {
    previousMaximum,
    previousCurrent,
    previousCurrentBase: options.previousCurrentBase,
    entries,
    level: base.level,
    context,
    reason
  });
  const previousCurrentBase = n(previousCurrentBaseState.value, previousCurrent);
  const resolution = engine.resolveHitPoints(actor, {
    baseMaximum: base.baseMaximum,
    previousMaximum,
    previousCurrent: previousCurrentBase,
    level: base.level,
    source: reason,
    consumer: "canonical-class-hit-points",
    context: {
      mode: base.mode,
      classLevels: context.classLevels,
      levelBySource: context.levelBySource
    }
  });

  const updates = {};
  if (base.mode === "single-class") {
    if (!same(actor.system?.hpRolls ?? [], base.rolls)) updates["system.hpRolls"] = base.rolls;
  } else if (!same(actor.system?.hpRollsMulticlass ?? [], base.rolls)) {
    updates["system.hpRollsMulticlass"] = base.rolls;
  }
  if (previousMaximum !== Number(resolution.maximum.total)) updates["system.points_de_coup"] = resolution.maximum.total;
  if (previousCurrent !== Number(resolution.current.total)) updates["system.pdv"] = resolution.current.total;

  const currentBase = Number(resolution.current?.base) || 0;
  const currentUnclampedTotal = Number(resolution.current?.unclampedTotal ?? resolution.current?.total) || 0;
  const currentAdjustment = currentUnclampedTotal - currentBase;

  return {
    ok: true,
    actorId: actor.id,
    actorUuid: actor.uuid,
    actorName: actor.name,
    reason,
    force,
    mode: base.mode,
    level: base.level,
    baseMaximum: base.baseMaximum,
    constitutionBonusPerDie: base.constitutionBonusPerDie,
    classContributions: base.classContributions,
    rolls: clone(base.rolls),
    previousMaximum,
    previousCurrent,
    previousCurrentBase,
    previousCurrentBaseSource: previousCurrentBaseState.source,
    maximum: Number(resolution.maximum.total),
    current: Number(resolution.current.total),
    currentBase,
    currentAdjustment,
    maximumResolution: {
      additionsTotal: resolution.maximum?.additionsTotal ?? null,
      multiplierTotal: resolution.maximum?.multiplierTotal ?? null,
      applied: (resolution.maximum?.applied ?? []).map(entry => ({
        id: entry?.modifier?.id ?? null,
        value: entry?.modifier?.value ?? null,
        operation: entry?.modifier?.operation ?? null,
        source: entry?.modifier?.source?.name ?? null
      })),
      rejected: (resolution.maximum?.rejected ?? []).map(entry => ({
        id: entry?.modifier?.id ?? null,
        reason: entry?.reason ?? null
      }))
    },
    currentResolution: {
      base: currentBase,
      unclampedTotal: currentUnclampedTotal,
      total: Number(resolution.current.total),
      adjustment: currentAdjustment,
      additionsTotal: resolution.current?.additionsTotal ?? null,
      multiplierTotal: resolution.current?.multiplierTotal ?? null,
      applied: (resolution.current?.applied ?? []).map(entry => ({
        id: entry?.modifier?.id ?? null,
        value: entry?.modifier?.value ?? null,
        operation: entry?.modifier?.operation ?? null,
        source: entry?.modifier?.source?.name ?? null
      })),
      rejected: (resolution.current?.rejected ?? []).map(entry => ({
        id: entry?.modifier?.id ?? null,
        reason: entry?.reason ?? null
      }))
    },
    updates
  };
}

async function applyHitPointState(actor, options = {}) {
  const state = await calculateHitPointState(actor, options);
  if (!state.ok) {
    console.warn("[ADD2E][HP_CANONICAL][SKIPPED]", { actor: actor?.name, ...state });
    return false;
  }

  const updates = clone(state.updates ?? {});
  const writeMaximum = Object.prototype.hasOwnProperty.call(updates, "system.points_de_coup");
  const writeCurrent = Object.prototype.hasOwnProperty.call(updates, "system.pdv");
  delete updates["system.points_de_coup"];
  delete updates["system.pdv"];
  const written = writeMaximum || writeCurrent || Object.keys(updates).length > 0;

  if (written) {
    const engine = hitPointEngine();
    await engine.setHitPoints(actor, {
      ...(writeMaximum ? { maximum: state.maximum } : {}),
      ...(writeCurrent ? { current: state.current } : {}),
      updates,
      reason: state.reason,
      updateOptions: {
        add2eMulticlassInternal: true,
        add2eHitPointResolution: true,
        render: false
      }
    });
  }

  const finalState = {
    ...state,
    written,
    finalMaximum: n(actor.system?.points_de_coup, state.maximum),
    finalCurrent: n(actor.system?.pdv, state.current)
  };
  lastHitPointResolutions.set(hitPointActorKey(actor), clone(finalState));
  return true;
}

function add2eRecalculateHitPoints(actor, options = {}) {
  if (!actor?.id || !actor?.system) return Promise.resolve(false);
  const key = hitPointActorKey(actor);
  const previous = hitPointQueues.get(key) ?? Promise.resolve(true);
  const task = previous
    .catch(error => {
      console.error("[ADD2E][HP_CANONICAL][PREVIOUS_ERROR]", { actor: actor?.name, error });
      return false;
    })
    .then(() => applyHitPointState(actor, options));
  hitPointQueues.set(key, task);
  const cleanup = () => {
    if (hitPointQueues.get(key) === task) hitPointQueues.delete(key);
  };
  task.then(cleanup, cleanup);
  return task;
}

function getLastHitPointResolution(actor) {
  const key = typeof actor === "string" ? actor : hitPointActorKey(actor);
  return clone(lastHitPointResolutions.get(key) ?? null);
}

function bindDirectClassFields(sheet) {
  const actor = sheet?.document ?? sheet?.actor;
  const root = sheet?.element?.jquery ? sheet.element[0] : sheet?.element;
  if (!actor || !hasClasses(actor) || !root?.addEventListener || root.dataset.add2eClassProgressionFields === VERSION) return;
  root.dataset.add2eClassProgressionFields = VERSION;
  root.addEventListener("change", event => {
    const input = event.target?.closest?.("input[data-class-progression-field]");
    if (!input || !root.contains(input)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    const sync = globalThis.add2eMulticlassDirectFieldSync;
    if (typeof sync !== "function") {
      ui.notifications?.error?.("Le gestionnaire de progression de classe est indisponible.");
      return;
    }
    sync(sheet, input).catch(error => console.warn(`${TAG}[DIRECT_FIELD_ERROR]`, error));
  }, true);
}

function queue(actor, reason) {
  if (!hasClasses(actor)) return;
  const id = String(actor.uuid ?? actor.id);
  clearTimeout(timers.get(id));
  timers.set(id, setTimeout(async () => {
    timers.delete(id);
    try {
      await syncClassProgressionSummary(actor, { reason: `${reason}:summary` });
      await add2eRecalculateHitPoints(actor, { reason: `${reason}:hp` });
    } catch (error) {
      console.warn(`${TAG}[SYNC_ERROR]`, { actor: actor?.name, error });
    }
  }, 0));
}

function internalClassMutation(options = {}) {
  return options?.add2eInternal === true
    || options?.add2eMulticlassInternal === true
    || options?.add2eClassDrop === true
    || options?.add2eSpellSync === true;
}

function installSheetPatch() {
  const proto = globalThis.Add2eActorSheet?.prototype;
  if (!proto || proto.__add2eClassProgressionPatch === VERSION) return;

  if (typeof proto.getData === "function" && !proto.__add2eOriginalClassProgressionGetData) {
    proto.__add2eOriginalClassProgressionGetData = proto.getData;
    proto.getData = async function add2eClassProgressionSheetData(...args) {
      const data = await this.__add2eOriginalClassProgressionGetData.apply(this, args);
      return applyClassProgressionToSheet(this.document ?? this.actor, data);
    };
  }

  if (typeof proto._onRender === "function" && !proto.__add2eOriginalClassProgressionOnRender) {
    proto.__add2eOriginalClassProgressionOnRender = proto._onRender;
    proto._onRender = async function add2eClassProgressionOnRender(...args) {
      const result = await this.__add2eOriginalClassProgressionOnRender.apply(this, args);
      bindDirectClassFields(this);
      return result;
    };
  }

  proto.__add2eClassProgressionPatch = VERSION;
}

function responsibleReadyGM() {
  if (!game.user?.isGM) return false;
  const activeGM = game.users?.activeGM ?? Array.from(game.users ?? []).find(user => user.active && user.isGM) ?? null;
  return !activeGM || activeGM.id === game.user.id;
}

globalThis.add2eRecalculateHitPoints = add2eRecalculateHitPoints;
globalThis.add2eCalculateHitPointState = calculateHitPointState;
globalThis.add2eGetLastHitPointResolution = getLastHitPointResolution;
globalThis.add2eGetHitPointCurrentBase = actor => getHitPointCurrentBase(actor).value;
globalThis.add2eSyncMulticlassCombatSummary = (actor, options = {}) => syncClassProgressionSummary(actor, options);
globalThis.add2eMulticlassClassEntries = entriesFor;
globalThis.add2eApplyMulticlassProgressionToSheet = applyClassProgressionToSheet;
globalThis.add2eApplyClassProgressionToSheet = applyClassProgressionToSheet;
globalThis.add2eSyncClassProgressionSummary = syncClassProgressionSummary;
globalThis.add2eEnsureCanonicalClassProgression = ensureCanonicalClassProgression;
globalThis.add2eBindDirectMulticlassFields = bindDirectClassFields;

Hooks.once("init", installSheetPatch);
Hooks.once("ready", async () => {
  installSheetPatch();
  if (!responsibleReadyGM()) return;
  for (const actor of game.actors?.filter(entry => entry.type === "personnage" && classes(entry).length) ?? []) {
    try {
      await ensureCanonicalClassProgression(actor);
      await syncClassProgressionSummary(actor, { reason: "class-item-progression-ready" });
      await add2eRecalculateHitPoints(actor, { reason: "class-item-progression-ready-hp" });
    } catch (error) {
      console.warn(`${TAG}[READY_SYNC_ERROR]`, { actor: actor?.name, error });
    }
  }
});
setTimeout(installSheetPatch, 0);
Hooks.on("createItem", (item, options = {}) => {
  if (internalClassMutation(options)) return;
  if (String(item?.type ?? "").toLowerCase() === "classe") queue(item.parent, "create-class-item");
});
Hooks.on("updateItem", (item, _changes = {}, options = {}) => {
  if (internalClassMutation(options)) return;
  if (String(item?.type ?? "").toLowerCase() === "classe") queue(item.parent, "update-class-item");
});
Hooks.on("deleteItem", (item, options = {}) => {
  if (internalClassMutation(options)) return;
  if (String(item?.type ?? "").toLowerCase() === "classe") queue(item.parent, "delete-class-item");
});