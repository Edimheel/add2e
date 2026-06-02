// ============================================================================
// ADD2E — Moteur générique de rounds de combat.
// Version : 2026-06-02-round-engine-v1-combat-tracker
//
// Rôle :
// - Unifie les traitements liés au passage des rounds du Combat Tracker.
// - Sert de point central pour les durées d'effets, les effets de sorts,
//   les états vitaux et les pertes de PV automatiques.
// - Compatible Foundry V13/V14/V15 : ApplicationV2/DialogV2 non concernés ici,
//   hooks combatRound/combatTurnChange utilisés quand disponibles, updateCombat
//   conservé comme filet de compatibilité.
// ============================================================================

import {
  add2eVitalIsMonster,
  add2eVitalNorm,
  add2eVitalNumber,
  add2eVitalReadHP
} from "./18a-vital-status-core.mjs";
import {
  add2eSyncActorVitalStatus,
  add2eVitalRegisterStatusEffects
} from "./18b-vital-status-sync.mjs";
import { add2eExpireTemporaryEffectsForActor } from "./18c-active-effects-expiration.mjs";

export const ADD2E_ROUND_ENGINE_VERSION = "2026-06-02-round-engine-v1-combat-tracker";

const TAG = "[ADD2E][ROUND_ENGINE]";
const FLAG_SCOPE = "add2e";
const FLAG_PROCESSED = "roundEngineProcessed";
const LOCAL_PROCESSED = new Set();
const LOCAL_LIMIT = 200;

function log(label, data = {}) {
  console.log(`${TAG}${label}`, data);
}

function warn(label, data = {}) {
  console.warn(`${TAG}${label}`, data);
}

function error(label, data = {}) {
  console.error(`${TAG}${label}`, data);
}

function toArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (value instanceof Set) return [...value];
  if (typeof value.values === "function") return [...value.values()];
  if (typeof value[Symbol.iterator] === "function" && typeof value !== "string") return [...value];
  return [value];
}

function nowIso() {
  try { return new Date().toISOString(); }
  catch (_err) { return String(Date.now()); }
}

function isResponsibleGM() {
  if (!game.user?.isGM) return false;
  if (typeof game.user.isActiveGM === "boolean") return game.user.isActiveGM;
  return game.users?.activeGM?.id === game.user.id || !game.users?.activeGM;
}

function combatId(combat) {
  return combat?.uuid ?? combat?.id ?? "combat";
}

function roundNumber(combat, fallback = 0) {
  const n = Number(combat?.round ?? fallback ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function roundKey(combat, round) {
  return `${combatId(combat)}::round::${round}`;
}

function rememberLocalKey(key) {
  LOCAL_PROCESSED.add(key);
  if (LOCAL_PROCESSED.size <= LOCAL_LIMIT) return;
  const first = LOCAL_PROCESSED.values().next().value;
  if (first) LOCAL_PROCESSED.delete(first);
}

async function wasRoundAlreadyProcessed(combat, round, source) {
  const key = roundKey(combat, round);
  if (LOCAL_PROCESSED.has(key)) return true;

  try {
    const data = combat?.getFlag?.(FLAG_SCOPE, FLAG_PROCESSED) ?? null;
    if (data?.round === round && data?.combatId === combatId(combat)) {
      rememberLocalKey(key);
      return true;
    }
  } catch (_err) {}

  try {
    await combat?.setFlag?.(FLAG_SCOPE, FLAG_PROCESSED, {
      version: ADD2E_ROUND_ENGINE_VERSION,
      combatId: combatId(combat),
      round,
      source,
      processedAt: nowIso()
    });
  } catch (err) {
    warn("[FLAG_WRITE_FAILED]", { combat: combat?.id, round, source, err });
  }

  rememberLocalKey(key);
  return false;
}

function combatantActor(combatant) {
  return combatant?.actor ?? combatant?.token?.actor ?? combatant?.token?.document?.actor ?? null;
}

function actorKey(actor) {
  return actor?.uuid ?? actor?.id ?? actor?.name ?? Math.random().toString(36);
}

function uniqueCombatActors(combat) {
  const out = [];
  const seen = new Set();

  for (const combatant of toArray(combat?.combatants)) {
    const actor = combatantActor(combatant);
    if (!actor) continue;

    const key = actorKey(actor);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ actor, combatant });
  }

  return out;
}

function readFlag(effect, path) {
  try {
    if (typeof effect?.getFlag === "function") {
      const parts = String(path).split(".");
      if (parts.length === 1) return effect.getFlag(FLAG_SCOPE, parts[0]);
    }
  } catch (_err) {}

  try {
    return foundry.utils.getProperty(effect?.flags?.[FLAG_SCOPE] ?? {}, path);
  } catch (_err) {
    return undefined;
  }
}

function firstNumber(...values) {
  for (const value of values) {
    const n = add2eVitalNumber(value, NaN);
    if (Number.isFinite(n)) return n;
  }
  return NaN;
}

function normalizeDurationUnit(value) {
  const unit = add2eVitalNorm(value);
  if (["round", "rounds", "round_de_combat", "rounds_de_combat", "combat_round", "combat_rounds"].includes(unit)) return "round";
  if (["tour", "tours", "turn", "turns"].includes(unit)) return "turn";
  if (["segment", "segments"].includes(unit)) return "segment";
  return unit || "round";
}

function durationRoundsFromEffect(effect) {
  const duration = effect?.duration ?? {};
  const flags = effect?.flags?.[FLAG_SCOPE] ?? {};
  const roundEngine = flags.roundEngine ?? {};
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
    genericDuration.rounds,
    genericDuration.durationRounds
  );
  if (Number.isFinite(explicitRounds) && explicitRounds > 0) return explicitRounds;

  const value = firstNumber(roundEngine.value, roundEngine.duration, genericDuration.value, genericDuration.duration, flags.duree, flags.durationValue);
  const unit = normalizeDurationUnit(roundEngine.unit ?? genericDuration.unit ?? flags.durationUnit ?? flags.unite ?? flags.unit ?? "round");

  if (!Number.isFinite(value) || value <= 0) return NaN;

  if (unit === "round") return value;
  if (unit === "turn") return value;
  if (unit === "segment") return Math.max(1, Math.ceil(value / 10));

  return NaN;
}

async function normalizeGenericEffectDurations(actor, currentRound) {
  if (!actor) return { normalized: 0, skipped: 0 };

  let normalized = 0;
  let skipped = 0;

  for (const effect of Array.from(actor.effects ?? [])) {
    if (!effect || effect.disabled) continue;

    const rounds = durationRoundsFromEffect(effect);
    if (!Number.isFinite(rounds) || rounds <= 0) {
      skipped += 1;
      continue;
    }

    const duration = effect.duration ?? {};
    const hasNativeRounds = Number.isFinite(add2eVitalNumber(duration.rounds, NaN));
    const hasStartRound = Number.isFinite(add2eVitalNumber(duration.startRound, NaN));
    const patch = {};

    if (!hasNativeRounds) patch["duration.rounds"] = Math.max(1, Math.floor(rounds));
    if (!hasStartRound) patch["duration.startRound"] = currentRound;

    patch["flags.add2e.roundEngine.version"] = ADD2E_ROUND_ENGINE_VERSION;
    patch["flags.add2e.roundEngine.managed"] = true;
    patch["flags.add2e.roundEngine.unit"] = "round";
    patch["flags.add2e.roundEngine.totalRounds"] = Math.max(1, Math.floor(rounds));

    if (!Object.keys(patch).length) continue;

    try {
      if (!actor.effects.get(effect.id)) continue;
      await effect.update(patch, { add2eRoundEngine: true });
      normalized += 1;
    } catch (err) {
      const msg = String(err?.message || err || "");
      if (msg.includes("does not exist") || msg.includes("n'existe pas")) continue;
      warn("[EFFECT_DURATION_NORMALIZE_FAILED]", { actor: actor.name, effect: effect.name, effectId: effect.id, err });
    }
  }

  return { normalized, skipped };
}

function isCharacterActor(actor) {
  return add2eVitalNorm(actor?.type) === "personnage" && !add2eVitalIsMonster(actor);
}

function hpUpdatePath(actor) {
  const sys = actor?.system ?? {};
  if (sys.pdv !== undefined) return "system.pdv";
  if (sys.pv?.value !== undefined) return "system.pv.value";
  if (sys.hp?.value !== undefined) return "system.hp.value";
  if (sys.hp !== undefined && typeof sys.hp !== "object") return "system.hp";
  if (sys.points_de_coup !== undefined) return "system.points_de_coup";
  return "system.pdv";
}

async function applyNegativeHpRoundLoss(actor, currentRound, combat) {
  if (!isCharacterActor(actor)) return { applied: false, reason: "not-character" };

  const hp = add2eVitalReadHP(actor);
  if (!Number.isFinite(hp)) return { applied: false, reason: "hp-invalid" };
  if (!(hp < 0 && hp > -11)) return { applied: false, reason: "hp-out-of-range", hp };

  const nextHp = hp - 1;
  const path = hpUpdatePath(actor);

  await actor.update({ [path]: nextHp }, {
    add2eRoundEngine: true,
    add2eRoundEngineReason: "negative-hp-round-loss",
    add2eCombatId: combat?.id ?? null,
    add2eCombatRound: currentRound
  });

  log("[NEGATIVE_HP_LOSS]", {
    actor: actor.name,
    actorId: actor.id,
    combat: combat?.id ?? null,
    round: currentRound,
    path,
    before: hp,
    after: nextHp
  });

  return { applied: true, hp, nextHp, path };
}

async function processActorForRound(actor, combatant, currentRound, combat, { perRound = false, source = "unknown" } = {}) {
  const duration = await normalizeGenericEffectDurations(actor, currentRound);
  const expired = await add2eExpireTemporaryEffectsForActor(actor, currentRound);
  const negativeHp = perRound ? await applyNegativeHpRoundLoss(actor, currentRound, combat) : { applied: false, reason: "scan-only" };
  const vital = await add2eSyncActorVitalStatus(actor, { reason: `round-engine:${source}` });

  return {
    actor: actor.name,
    actorId: actor.id,
    actorUuid: actor.uuid ?? null,
    combatantId: combatant?.id ?? null,
    duration,
    expired,
    negativeHp,
    vital
  };
}

async function processCombat(combat, { source = "unknown", perRound = false } = {}) {
  if (!combat) return { processed: false, reason: "no-combat" };
  if (!isResponsibleGM()) return { processed: false, reason: "not-responsible-gm" };

  const currentRound = roundNumber(combat);
  if (currentRound <= 0) return { processed: false, reason: "round-zero", round: currentRound };

  add2eVitalRegisterStatusEffects();

  const rows = uniqueCombatActors(combat);
  const actors = [];

  for (const { actor, combatant } of rows) {
    try {
      actors.push(await processActorForRound(actor, combatant, currentRound, combat, { perRound, source }));
    } catch (err) {
      error("[ACTOR_PROCESS_ERROR]", { actor: actor?.name, actorId: actor?.id, round: currentRound, source, err });
      actors.push({ actor: actor?.name ?? "Acteur", actorId: actor?.id ?? null, error: String(err?.message || err) });
    }
  }

  const result = {
    processed: true,
    version: ADD2E_ROUND_ENGINE_VERSION,
    combat: combat.id,
    round: currentRound,
    source,
    perRound,
    actorCount: actors.length,
    actors
  };

  log(perRound ? "[ROUND_PROCESSED]" : "[COMBAT_SCAN]", result);
  return result;
}

export async function add2eRoundEngineOnCombatProgress(combat, changed = {}, { source = "updateCombat", forceRound = false, scanOnly = false } = {}) {
  if (!combat) return false;
  if (!isResponsibleGM()) return false;

  const hasRound = forceRound || Object.prototype.hasOwnProperty.call(changed ?? {}, "round");
  const hasTurn = Object.prototype.hasOwnProperty.call(changed ?? {}, "turn");
  if (!hasRound && !hasTurn && !scanOnly) return false;

  const currentRound = roundNumber(combat, changed?.round);

  if (hasRound && !scanOnly) {
    const already = await wasRoundAlreadyProcessed(combat, currentRound, source);
    if (already) {
      log("[ROUND_DUPLICATE_SKIP]", { combat: combat.id, round: currentRound, source });
      return false;
    }
    await processCombat(combat, { source, perRound: true });
    return true;
  }

  await processCombat(combat, { source, perRound: false });
  return true;
}

export function add2eRegisterRoundEngineHooks() {
  if (globalThis.__ADD2E_ROUND_ENGINE_REGISTERED) return false;
  globalThis.__ADD2E_ROUND_ENGINE_REGISTERED = true;

  Hooks.on("combatRound", (combat, round, options, userId) => {
    add2eRoundEngineOnCombatProgress(combat, { round: round ?? combat?.round }, { source: "combatRound", forceRound: true })
      .catch(err => error("[HOOK_COMBAT_ROUND_ERROR]", { err, combat: combat?.id, round, options, userId }));
  });

  Hooks.on("combatTurnChange", (combat, prior, current, options, userId) => {
    add2eRoundEngineOnCombatProgress(combat, { turn: combat?.turn }, { source: "combatTurnChange", scanOnly: true })
      .catch(err => error("[HOOK_COMBAT_TURN_CHANGE_ERROR]", { err, combat: combat?.id, prior, current, options, userId }));
  });

  Hooks.on("combatTurn", (combat, turn, options, userId) => {
    add2eRoundEngineOnCombatProgress(combat, { turn: turn ?? combat?.turn }, { source: "combatTurn", scanOnly: true })
      .catch(err => error("[HOOK_COMBAT_TURN_ERROR]", { err, combat: combat?.id, turn, options, userId }));
  });

  Hooks.on("updateCombat", (combat, changed, options, userId) => {
    add2eRoundEngineOnCombatProgress(combat, changed ?? {}, { source: "updateCombat" })
      .catch(err => error("[HOOK_UPDATE_COMBAT_ERROR]", { err, combat: combat?.id, changed, options, userId }));
  });

  game.add2e = game.add2e ?? {};
  game.add2e.roundEngineVersion = ADD2E_ROUND_ENGINE_VERSION;
  globalThis.ADD2E_ROUND_ENGINE_VERSION = ADD2E_ROUND_ENGINE_VERSION;
  globalThis.add2eRoundEngineOnCombatProgress = add2eRoundEngineOnCombatProgress;

  log("[REGISTERED]", {
    version: ADD2E_ROUND_ENGINE_VERSION,
    hooks: ["combatRound", "combatTurnChange", "combatTurn", "updateCombat"],
    mode: "combat-tracker"
  });

  return true;
}
