// ============================================================================
// ADD2E — Moteur générique de rounds de combat.
// Version : 2026-06-06-round-engine-world-time-v1
// ============================================================================

import {
  add2eVitalIsMonster,
  add2eVitalNorm,
  add2eVitalReadHP
} from "./18a-vital-status-core.mjs";
import {
  add2eSyncActorVitalStatus,
  add2eVitalRegisterStatusEffects
} from "./18b-vital-status-sync.mjs";
import { add2eExpireTemporaryEffectsForActor } from "./18c-active-effects-expiration.mjs";
import {
  ADD2E_TIME_ENGINE_VERSION,
  add2eRegisterTimeEngineApi,
  add2eTimeAdvanceTick,
  add2eTimeNormalizeActorEffects
} from "./19a-time-engine.mjs";

export const ADD2E_ROUND_ENGINE_VERSION = "2026-06-06-round-engine-world-time-v1";

const TAG = "[ADD2E][ROUND_ENGINE]";
const FLAG_SCOPE = "add2e";
const FLAG_PROCESSED = "roundEngineProcessed";
const LOCAL_PROCESSED = new Set();
const LOCAL_LIMIT = 200;
let FALLBACK_ACTOR_KEY = 0;

function log(label, data = {}) { console.log(`${TAG}${label}`, data); }
function warn(label, data = {}) { console.warn(`${TAG}${label}`, data); }
function error(label, data = {}) { console.error(`${TAG}${label}`, data); }

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

function combatId(combat) { return combat?.uuid ?? combat?.id ?? "combat"; }

function roundNumber(combat, fallback = 0) {
  const n = Number(combat?.round ?? fallback ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function roundKey(combat, round) { return `${combatId(combat)}::round::${round}`; }

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
      timeEngineVersion: ADD2E_TIME_ENGINE_VERSION,
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
  if (actor?.uuid) return actor.uuid;
  if (actor?.id) return actor.id;
  if (actor?.name) return actor.name;
  FALLBACK_ACTOR_KEY += 1;
  return `actor-${FALLBACK_ACTOR_KEY}`;
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

  log("[NEGATIVE_HP_LOSS]", { actor: actor.name, actorId: actor.id, combat: combat?.id ?? null, round: currentRound, path, before: hp, after: nextHp });
  return { applied: true, hp, nextHp, path };
}

async function processActorForRound(actor, combatant, currentRound, combat, { perRound = false, source = "unknown" } = {}) {
  const duration = await add2eTimeNormalizeActorEffects(actor, currentRound);
  const expired = await add2eExpireTemporaryEffectsForActor(actor, currentRound);
  const negativeHp = perRound ? await applyNegativeHpRoundLoss(actor, currentRound, combat) : { applied: false, reason: "scan-only" };
  const vital = await add2eSyncActorVitalStatus(actor, { reason: `round-engine:${source}` });
  return { actor: actor.name, actorId: actor.id, actorUuid: actor.uuid ?? null, combatantId: combatant?.id ?? null, duration, expired, negativeHp, vital };
}

async function processCombat(combat, { source = "unknown", perRound = false } = {}) {
  if (!combat) return { processed: false, reason: "no-combat" };
  if (!isResponsibleGM()) return { processed: false, reason: "not-responsible-gm" };
  const currentRound = roundNumber(combat);
  if (currentRound <= 0) return { processed: false, reason: "round-zero", round: currentRound };

  add2eRegisterTimeEngineApi();
  add2eVitalRegisterStatusEffects();

  if (perRound) {
    await add2eTimeAdvanceTick(1, { reason: `combat-round:${combat.id}:${currentRound}` });
  }

  const actors = [];
  for (const { actor, combatant } of uniqueCombatActors(combat)) {
    try {
      actors.push(await processActorForRound(actor, combatant, currentRound, combat, { perRound, source }));
    } catch (err) {
      error("[ACTOR_PROCESS_ERROR]", { actor: actor?.name, actorId: actor?.id, round: currentRound, source, err });
      actors.push({ actor: actor?.name ?? "Acteur", actorId: actor?.id ?? null, error: String(err?.message || err) });
    }
  }

  const result = { processed: true, version: ADD2E_ROUND_ENGINE_VERSION, timeEngineVersion: ADD2E_TIME_ENGINE_VERSION, combat: combat.id, round: currentRound, source, perRound, actorCount: actors.length, actors };
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
  add2eRegisterTimeEngineApi();

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

  log("[REGISTERED]", { version: ADD2E_ROUND_ENGINE_VERSION, timeEngineVersion: ADD2E_TIME_ENGINE_VERSION, hooks: ["combatRound", "combatTurnChange", "combatTurn", "updateCombat"], mode: "combat-tracker+world-time" });
  return true;
}
