// ============================================================================
// ADD2E — Service générique de gestion du temps et des durées.
// Version : 2026-06-06-time-engine-world-tick-v1
//
// Rôle :
// - Fournit un format commun pour les durées en rounds.
// - Convertit tours / segments / rounds vers des rounds moteur ADD2E.
// - Ajoute un tick global de temps de jeu utilisable hors combat.
// - Normalise les ActiveEffect existants pour le moteur de rounds et de temps.
// - Expose des helpers réutilisables par les scripts onUse sans dépendre d'un sort.
// - Compatible Foundry V13/V14/V15.
// ============================================================================

export const ADD2E_TIME_ENGINE_VERSION = "2026-06-06-time-engine-world-tick-v1";

const TAG = "[ADD2E][TIME_ENGINE]";
const FLAG_SCOPE = "add2e";
const SETTING_SCOPE = "add2e";
export const ADD2E_TIME_TICK_SETTING = "worldTimeTick";
export const ADD2E_TIME_TICK_LABEL = "Temps ADD2E — compteur global en rounds";

function log(label, data = {}) { console.log(`${TAG}${label}`, data); }
function warn(label, data = {}) { console.warn(`${TAG}${label}`, data); }

function norm(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9:+*_.-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function number(value, fallback = NaN) {
  if (value === null || value === undefined || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function getProperty(obj, path) {
  try { return foundry.utils.getProperty(obj, path); }
  catch (_err) { return undefined; }
}

function deepClone(value) {
  try { return foundry.utils.deepClone(value); }
  catch (_err) {
    try { return JSON.parse(JSON.stringify(value)); }
    catch (_e) { return value; }
  }
}

function currentCombatData() {
  return {
    round: game.combat?.round ?? null,
    turn: game.combat?.turn ?? null,
    combat: game.combat?.id ?? null,
    worldTime: game.time?.worldTime ?? null
  };
}

export function add2eTimeRegisterSettings() {
  if (!game?.settings) return false;
  try {
    if (!game.settings.settings?.has?.(`${SETTING_SCOPE}.${ADD2E_TIME_TICK_SETTING}`)) {
      game.settings.register(SETTING_SCOPE, ADD2E_TIME_TICK_SETTING, {
        name: ADD2E_TIME_TICK_LABEL,
        hint: "Compteur de temps de jeu ADD2E, exprimé en rounds moteur. Le MJ le fait avancer hors combat ; le Combat Tracker l'avance en combat.",
        scope: "world",
        config: false,
        type: Number,
        default: 0
      });
    }
    return true;
  } catch (err) {
    warn("[SETTINGS_REGISTER_FAILED]", { err });
    return false;
  }
}

export function add2eTimeCurrentTick() {
  try {
    add2eTimeRegisterSettings();
    const value = Number(game.settings.get(SETTING_SCOPE, ADD2E_TIME_TICK_SETTING));
    return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  } catch (_err) {
    return 0;
  }
}

export async function add2eTimeSetTick(value, { reason = "manual" } = {}) {
  if (!game.user?.isGM) return { ok: false, reason: "not-gm", tick: add2eTimeCurrentTick() };
  add2eTimeRegisterSettings();
  const next = Math.max(0, Math.floor(Number(value) || 0));
  await game.settings.set(SETTING_SCOPE, ADD2E_TIME_TICK_SETTING, next);
  log("[TICK_SET]", { tick: next, reason });
  return { ok: true, tick: next, reason };
}

export async function add2eTimeAdvanceTick(rounds = 0, { reason = "manual" } = {}) {
  if (!game.user?.isGM) return { ok: false, reason: "not-gm", before: add2eTimeCurrentTick(), after: add2eTimeCurrentTick(), delta: 0 };
  const delta = Math.max(0, Math.floor(Number(rounds) || 0));
  const before = add2eTimeCurrentTick();
  const after = before + delta;
  await add2eTimeSetTick(after, { reason });
  log("[TICK_ADVANCE]", { before, after, delta, reason });
  return { ok: true, before, after, delta, reason };
}

export function add2eTimeNormalizeUnit(value) {
  const unit = norm(value || "round");

  if (["round", "rounds", "round_de_combat", "rounds_de_combat", "combat_round", "combat_rounds", "r"].includes(unit)) return "round";
  if (["tour", "tours", "turn", "turns", "t"].includes(unit)) return "turn";
  if (["minute", "minutes", "min", "mn"].includes(unit)) return "minute";
  if (["hour", "hours", "heure", "heures", "h"].includes(unit)) return "hour";
  if (["segment", "segments", "seg", "segs", "s"].includes(unit)) return "segment";
  if (["special", "speciale", "manual", "manuelle", "permanent", "permanente", "until_removed", "jusqua_suppression"].includes(unit)) return "special";

  return unit || "round";
}

export function add2eTimeFormulaToRounds(formula, level = 1) {
  const lvl = Math.max(1, Number(level) || 1);
  if (formula === null || formula === undefined || formula === "") return 0;
  if (typeof formula === "number") return Math.max(0, Math.floor(formula));

  const raw = String(formula).trim();
  const simpleNumber = Number(raw);
  if (Number.isFinite(simpleNumber)) return Math.max(0, Math.floor(simpleNumber));

  switch (raw) {
    case "level": return lvl;
    case "level*2": return lvl * 2;
    case "level*3": return lvl * 3;
    case "level*4": return lvl * 4;
    case "level*5": return lvl * 5;
    case "level*10": return lvl * 10;
    case "2+level": return 2 + lvl;
    case "10+level": return 10 + lvl;
    case "10+5*level": return 10 + (5 * lvl);
    case "min10_level*10": return Math.max(10, lvl * 10);
    default: break;
  }

  const normalized = raw.replace(/niveau|lvl/gi, "level").replace(/\s+/g, "");
  if (/^[0-9+*().level-]+$/.test(normalized)) {
    try {
      const expr = normalized.replace(/level/g, String(lvl));
      const result = Function(`"use strict"; return (${expr});`)();
      const n = Number(result);
      if (Number.isFinite(n)) return Math.max(0, Math.floor(n));
    } catch (_err) {}
  }

  return 0;
}

export function add2eTimeToRounds(value, unit = "round", { level = 1 } = {}) {
  const normalizedUnit = add2eTimeNormalizeUnit(unit);
  if (normalizedUnit === "special") return 0;

  const amount = typeof value === "string" && /level|niveau|lvl/.test(value)
    ? add2eTimeFormulaToRounds(value, level)
    : number(value, NaN);

  if (!Number.isFinite(amount) || amount <= 0) return 0;

  if (normalizedUnit === "round") return Math.max(1, Math.floor(amount));
  if (normalizedUnit === "turn") return Math.max(1, Math.floor(amount * 10));
  if (normalizedUnit === "minute") return Math.max(1, Math.floor(amount));
  if (normalizedUnit === "hour") return Math.max(1, Math.floor(amount * 60));
  if (normalizedUnit === "segment") return Math.max(1, Math.ceil(amount / 10));

  return Math.max(1, Math.floor(amount));
}

export function add2eTimeDurationData(rounds, { startNow = true } = {}) {
  const n = Number(rounds);
  if (!Number.isFinite(n) || n <= 0) return {};

  const combat = currentCombatData();
  return {
    rounds: Math.max(1, Math.floor(n)),
    startRound: startNow ? combat.round : null,
    startTurn: startNow ? combat.turn : null,
    startTime: combat.worldTime,
    combat: combat.combat
  };
}

export function add2eTimeFlags({
  source = "unknown",
  rounds = 0,
  unit = "round",
  endMessage = null,
  silentExpiration = false,
  extra = {}
} = {}) {
  const totalRounds = Math.max(0, Math.floor(Number(rounds) || 0));
  const startTick = add2eTimeCurrentTick();
  const out = {
    timeEngine: {
      version: ADD2E_TIME_ENGINE_VERSION,
      source,
      managed: totalRounds > 0,
      unit: add2eTimeNormalizeUnit(unit),
      totalRounds,
      startTick,
      createdAtTick: startTick,
      createdAt: Date.now()
    },
    roundEngine: {
      version: ADD2E_TIME_ENGINE_VERSION,
      managed: totalRounds > 0,
      unit: "round",
      totalRounds,
      startTick
    },
    ...deepClone(extra)
  };

  if (endMessage) {
    out.endMessage = String(endMessage);
    out.roundEngine.endMessage = String(endMessage);
  }

  if (silentExpiration) {
    out.silentExpiration = true;
    out.roundEngine.silentExpiration = true;
  }

  return out;
}

export function add2eTimeEffectData({
  name,
  img = null,
  origin = null,
  rounds = 0,
  unit = "round",
  description = "",
  tags = [],
  changes = [],
  source = "spell",
  caster = null,
  sourceItem = null,
  endMessage = null,
  silentExpiration = false,
  extraFlags = {}
} = {}) {
  const totalRounds = add2eTimeToRounds(rounds, unit, { level: extraFlags?.level ?? 1 });
  const cleanTags = Array.isArray(tags) ? tags.map(t => norm(t)).filter(Boolean) : [];
  const add2eFlags = add2eTimeFlags({
    source,
    rounds: totalRounds,
    unit: "round",
    endMessage,
    silentExpiration,
    extra: {
      sourceItemUuid: sourceItem?.uuid ?? origin ?? null,
      casterId: caster?.id ?? null,
      casterUuid: caster?.uuid ?? null,
      tags: [...new Set(cleanTags)],
      ...deepClone(extraFlags)
    }
  });

  return {
    name: name || sourceItem?.name || "Effet temporaire",
    img: img || sourceItem?.img || "icons/svg/aura.svg",
    origin: origin ?? sourceItem?.uuid ?? null,
    disabled: false,
    transfer: false,
    duration: add2eTimeDurationData(totalRounds),
    description,
    flags: { [FLAG_SCOPE]: add2eFlags },
    changes: Array.isArray(changes) ? changes : []
  };
}

function readAdd2eFlag(effect, path) {
  try {
    if (typeof effect?.getFlag === "function" && !String(path).includes(".")) {
      return effect.getFlag(FLAG_SCOPE, path);
    }
  } catch (_err) {}

  return getProperty(effect?.flags?.[FLAG_SCOPE] ?? {}, path);
}

function firstNumber(...values) {
  for (const value of values) {
    const n = number(value, NaN);
    if (Number.isFinite(n)) return n;
  }
  return NaN;
}

export function add2eTimeRoundsFromEffect(effect) {
  const duration = effect?.duration ?? {};
  const flags = effect?.flags?.[FLAG_SCOPE] ?? {};
  const roundEngine = flags.roundEngine ?? {};
  const timeEngine = flags.timeEngine ?? {};
  const genericDuration = flags.duration ?? {};

  const nativeRounds = firstNumber(duration.rounds);
  if (Number.isFinite(nativeRounds) && nativeRounds > 0) return nativeRounds;

  const explicitRounds = firstNumber(
    flags.rounds,
    flags.durationRounds,
    flags.dureeRounds,
    flags.duree_rounds,
    flags.roundDuration,
    roundEngine.rounds,
    roundEngine.durationRounds,
    roundEngine.dureeRounds,
    roundEngine.totalRounds,
    timeEngine.rounds,
    timeEngine.durationRounds,
    timeEngine.totalRounds,
    genericDuration.rounds,
    genericDuration.durationRounds
  );
  if (Number.isFinite(explicitRounds) && explicitRounds > 0) return explicitRounds;

  const rawValue = firstNumber(
    timeEngine.value,
    timeEngine.duration,
    roundEngine.value,
    roundEngine.duration,
    genericDuration.value,
    genericDuration.duration,
    flags.duree,
    flags.durationValue
  );
  const rawUnit = timeEngine.unit ?? roundEngine.unit ?? genericDuration.unit ?? flags.durationUnit ?? flags.unite ?? flags.unit ?? "round";
  return add2eTimeToRounds(rawValue, rawUnit);
}

export function add2eTimeStartTickFromEffect(effect) {
  const flags = effect?.flags?.[FLAG_SCOPE] ?? {};
  return firstNumber(
    flags.timeEngine?.startTick,
    flags.timeEngine?.createdAtTick,
    flags.roundEngine?.startTick,
    flags.startTick
  );
}

export function add2eTimeRemainingRounds(effect, currentRound = game.combat?.round ?? 0) {
  const rounds = add2eTimeRoundsFromEffect(effect);
  if (!Number.isFinite(rounds) || rounds <= 0) return null;

  const startTick = add2eTimeStartTickFromEffect(effect);
  if (Number.isFinite(startTick)) {
    const currentTick = add2eTimeCurrentTick();
    const elapsedTick = Math.max(0, currentTick - startTick);
    return { totalRounds: rounds, elapsed: elapsedTick, remaining: Math.max(0, rounds - elapsedTick), startTick, currentTick, clock: "world" };
  }

  const startRound = number(effect?.duration?.startRound, NaN);
  if (!Number.isFinite(startRound)) return { totalRounds: rounds, elapsed: 0, remaining: rounds, startRound: null, clock: "combat" };

  const elapsed = Math.max(0, Number(currentRound || 0) - startRound);
  return { totalRounds: rounds, elapsed, remaining: Math.max(0, rounds - elapsed), startRound, clock: "combat" };
}

export async function add2eTimeNormalizeEffect(effect, currentRound = game.combat?.round ?? 0) {
  if (!effect || effect.disabled) return { normalized: false, reason: "inactive" };

  const rounds = add2eTimeRoundsFromEffect(effect);
  if (!Number.isFinite(rounds) || rounds <= 0) return { normalized: false, reason: "no-duration" };

  const duration = effect.duration ?? {};
  const hasNativeRounds = Number.isFinite(number(duration.rounds, NaN));
  const hasStartRound = Number.isFinite(number(duration.startRound, NaN));
  const hasStartTick = Number.isFinite(add2eTimeStartTickFromEffect(effect));
  const totalRounds = Math.max(1, Math.floor(rounds));
  const currentTick = add2eTimeCurrentTick();
  const patch = {};

  if (!hasNativeRounds) patch["duration.rounds"] = totalRounds;
  if (!hasStartRound) patch["duration.startRound"] = Number(currentRound) || game.combat?.round || 1;

  patch["flags.add2e.timeEngine.version"] = ADD2E_TIME_ENGINE_VERSION;
  patch["flags.add2e.timeEngine.managed"] = true;
  patch["flags.add2e.timeEngine.totalRounds"] = totalRounds;
  patch["flags.add2e.timeEngine.unit"] = "round";
  patch["flags.add2e.roundEngine.version"] = ADD2E_TIME_ENGINE_VERSION;
  patch["flags.add2e.roundEngine.managed"] = true;
  patch["flags.add2e.roundEngine.totalRounds"] = totalRounds;
  patch["flags.add2e.roundEngine.unit"] = "round";

  if (!hasStartTick) {
    patch["flags.add2e.timeEngine.startTick"] = currentTick;
    patch["flags.add2e.timeEngine.createdAtTick"] = currentTick;
    patch["flags.add2e.roundEngine.startTick"] = currentTick;
  }

  if (!Object.keys(patch).length) return { normalized: false, reason: "no-patch" };

  await effect.update(patch, { add2eTimeEngine: true });
  return { normalized: true, rounds: totalRounds, patch };
}

export async function add2eTimeNormalizeActorEffects(actor, currentRound = game.combat?.round ?? 0) {
  if (!actor) return { normalized: 0, skipped: 0, errors: 0 };

  let normalized = 0;
  let skipped = 0;
  let errors = 0;

  for (const effect of Array.from(actor.effects ?? [])) {
    if (!effect || effect.disabled) { skipped += 1; continue; }

    try {
      if (!actor.effects.get(effect.id)) continue;
      const result = await add2eTimeNormalizeEffect(effect, currentRound);
      if (result.normalized) normalized += 1;
      else skipped += 1;
    } catch (err) {
      const msg = String(err?.message || err || "");
      if (msg.includes("does not exist") || msg.includes("n'existe pas")) continue;
      errors += 1;
      warn("[NORMALIZE_EFFECT_FAILED]", { actor: actor.name, effect: effect.name, effectId: effect.id, err });
    }
  }

  return { normalized, skipped, errors };
}

export async function add2eCreateTimedActiveEffect(actor, effectData, { removeTags = [], replace = false } = {}) {
  if (!actor) return { ok: false, reason: "no-actor" };

  const normalizedRemoveTags = removeTags.map(t => norm(t)).filter(Boolean);
  if (replace && effectData?.flags?.add2e?.tags?.length) {
    normalizedRemoveTags.push(...effectData.flags.add2e.tags.map(t => norm(t)).filter(Boolean));
  }

  if (normalizedRemoveTags.length) {
    const ids = Array.from(actor.effects ?? [])
      .filter(effect => {
        const tags = readAdd2eFlag(effect, "tags") ?? [];
        const list = Array.isArray(tags) ? tags.map(t => norm(t)) : [];
        return normalizedRemoveTags.some(t => list.includes(t));
      })
      .map(effect => effect.id)
      .filter(Boolean);

    if (ids.length) await actor.deleteEmbeddedDocuments("ActiveEffect", ids);
  }

  const created = await actor.createEmbeddedDocuments("ActiveEffect", [effectData]);
  return { ok: !!created?.[0], effect: created?.[0] ?? null };
}

export function add2eRegisterTimeEngineApi() {
  add2eTimeRegisterSettings();
  game.add2e = game.add2e ?? {};
  const previous = game.add2e.time ?? {};
  game.add2e.timeEngineVersion = ADD2E_TIME_ENGINE_VERSION;
  game.add2e.time = {
    ...previous,
    version: ADD2E_TIME_ENGINE_VERSION,
    registerSettings: add2eTimeRegisterSettings,
    currentTick: add2eTimeCurrentTick,
    setTick: add2eTimeSetTick,
    advanceTick: add2eTimeAdvanceTick,
    normalizeUnit: add2eTimeNormalizeUnit,
    formulaToRounds: add2eTimeFormulaToRounds,
    toRounds: add2eTimeToRounds,
    durationData: add2eTimeDurationData,
    flags: add2eTimeFlags,
    effectData: add2eTimeEffectData,
    roundsFromEffect: add2eTimeRoundsFromEffect,
    startTickFromEffect: add2eTimeStartTickFromEffect,
    remainingRounds: add2eTimeRemainingRounds,
    normalizeEffect: add2eTimeNormalizeEffect,
    normalizeActorEffects: add2eTimeNormalizeActorEffects,
    createTimedActiveEffect: add2eCreateTimedActiveEffect
  };

  globalThis.ADD2E_TIME_ENGINE_VERSION = ADD2E_TIME_ENGINE_VERSION;
  globalThis.ADD2E_TIME_ENGINE = game.add2e.time;

  log("[REGISTERED]", { version: ADD2E_TIME_ENGINE_VERSION, tick: add2eTimeCurrentTick() });
  return true;
}
