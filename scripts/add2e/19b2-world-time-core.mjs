// ============================================================================
// ADD2E — Temps hors combat : coeur d'avance et expiration.
// Compatible Foundry V13/V14/V15.
// ============================================================================
import {
  ADD2E_TIME_ENGINE_VERSION,
  add2eRegisterTimeEngineApi,
  add2eTimeAdvanceTick,
  add2eTimeCurrentTick,
  add2eTimeNormalizeActorEffects,
  add2eTimeToRounds
} from "./19a-time-engine.mjs";
import { add2eExpireTemporaryEffectsForActor } from "./18c-active-effects-expiration.mjs";
import { add2eSyncActorVitalStatus, add2eVitalRegisterStatusEffects } from "./18b-vital-status-sync.mjs";
import {
  add2eWorldTimeAllActors,
  add2eWorldTimeIsGM,
  add2eWorldTimeRenderOpenMonsterSheets
} from "./19b0-world-time-actors.mjs";
import { add2eWorldTimeProcessPeriodicSaves } from "./19b1-world-time-periodic-saves.mjs";

export const ADD2E_WORLD_TIME_CORE_VERSION = "2026-07-18-world-time-shared-chat-card-v2";

const TAG = "[ADD2E][WORLD_TIME]";

function log(label, data = {}) { console.log(`${TAG}${label}`, data); }
function warn(label, data = {}) { console.warn(`${TAG}${label}`, data); }
function chatStyleData() { return CONST.CHAT_MESSAGE_STYLES ? { style: CONST.CHAT_MESSAGE_STYLES.OTHER } : { type: CONST.CHAT_MESSAGE_TYPES?.OTHER ?? 0 }; }

export function add2eWorldTimeNormalizeUnit(value) {
  const unit = String(value ?? "round")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (["jour", "jours", "day", "days", "d"].includes(unit)) return "day";
  if (["semaine", "semaines", "week", "weeks", "w"].includes(unit)) return "week";
  return unit || "round";
}

function unitLabel(unit) {
  return ({
    segment: "segment",
    round: "round",
    turn: "tour",
    minute: "minute",
    hour: "heure",
    day: "jour",
    week: "semaine"
  })[unit] ?? unit ?? "round";
}

export function add2eWorldTimeToRounds(value, unit = "round") {
  const normalizedUnit = add2eWorldTimeNormalizeUnit(unit);
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (normalizedUnit === "day") return add2eTimeToRounds(amount * 24, "hour");
  if (normalizedUnit === "week") return add2eTimeToRounds(amount * 7 * 24, "hour");
  return add2eTimeToRounds(amount, normalizedUnit);
}

async function normalizeWorldActorEffects(actorRows, currentRound) {
  let normalized = 0;
  let skipped = 0;
  let errors = 0;

  for (const { actor, source } of actorRows) {
    try {
      const result = await add2eTimeNormalizeActorEffects(actor, currentRound);
      normalized += Number(result?.normalized ?? 0);
      skipped += Number(result?.skipped ?? 0);
      errors += Number(result?.errors ?? 0);
    } catch (err) {
      errors += 1;
      console.error(`${TAG}[ACTOR_NORMALIZE_FAILED]`, { actor: actor?.name, actorId: actor?.id, actorUuid: actor?.uuid, source, err });
    }
  }

  return { actors: actorRows.length, normalized, skipped, errors };
}

async function notifyAdvance({ before, after, delta, label, reason, expired }) {
  try {
    const createCard = globalThis.add2eCreateChatCard;
    if (typeof createCard !== "function") throw new Error("Constructeur de carte ADD2E indisponible.");

    const gmIds = ChatMessage.getWhisperRecipients?.("GM")?.map(user => user.id).filter(Boolean) ?? [];
    const rows = [
      { label: "Avance", value: label },
      { label: "Conversion", value: `${delta} round(s) moteur` },
      { label: "Tick global", value: `${before} → ${after}` },
      reason ? { label: "Raison", value: reason } : null,
      { label: "Acteurs scannés", value: Number(expired?.actors ?? 0) },
      { label: "Effets expirés", value: Number(expired?.deleted ?? 0) }
    ].filter(Boolean);

    await createCard({
      title: "Temps ADD2E avancé",
      icon: "fas fa-hourglass-half",
      variant: "time",
      source: {
        name: "Gestion du temps",
        img: "icons/svg/clockwork.svg",
        type: "ADD2E",
        meta: "Hors combat"
      },
      rows,
      chatData: {
        speaker: ChatMessage.getSpeaker(),
        whisper: gmIds.length ? gmIds : undefined,
        flags: {
          add2e: {
            worldTimeAdvanceMessage: true,
            before,
            after,
            delta,
            label,
            reason,
            expired,
            version: ADD2E_WORLD_TIME_CORE_VERSION,
            timeEngineVersion: ADD2E_TIME_ENGINE_VERSION
          }
        },
        ...chatStyleData()
      }
    });
  } catch (err) {
    warn("[CHAT_NOTIFY_FAILED]", { err });
  }
}

export async function add2eWorldTimeExpireAllActors({ reason = "world-time", currentRound = null, normalize = true } = {}) {
  if (!add2eWorldTimeIsGM()) return { ok: false, reason: "not-gm", actors: 0, deleted: 0, messages: 0, rows: [] };
  add2eRegisterTimeEngineApi();
  add2eVitalRegisterStatusEffects();

  const periodicSaves = await add2eWorldTimeProcessPeriodicSaves({ reason: `${reason}:periodic-saves` });
  const actorRows = add2eWorldTimeAllActors();
  const rows = [];
  let deleted = 0;
  let messages = 0;

  for (const { actor, source } of actorRows) {
    try {
      const round = currentRound ?? game.combat?.round ?? 0;
      if (normalize) await add2eTimeNormalizeActorEffects(actor, round);
      const result = await add2eExpireTemporaryEffectsForActor(actor, currentRound ?? game.combat?.round ?? null);
      await add2eSyncActorVitalStatus(actor, { reason });
      if (actor.type === "monster") add2eWorldTimeRenderOpenMonsterSheets(actor);
      if (result?.deleted || result?.messages) {
        rows.push({ actor: actor.name, actorId: actor.id ?? null, actorUuid: actor.uuid ?? null, actorType: actor.type ?? null, source, ...result });
        deleted += Number(result.deleted ?? 0);
        messages += Number(result.messages ?? 0);
      }
    } catch (err) {
      console.error(`${TAG}[ACTOR_EXPIRE_FAILED]`, { actor: actor.name, actorId: actor.id, actorUuid: actor.uuid, source, err });
      rows.push({ actor: actor.name, actorId: actor.id, actorUuid: actor.uuid ?? null, source, error: String(err?.message || err) });
    }
  }

  const result = { ok: true, reason, actors: actorRows.length, deleted, messages, rows, periodicSaves, tick: add2eTimeCurrentTick() };
  log("[EXPIRE_ALL]", result);
  return result;
}

export async function add2eWorldTimeAdvance({ value = 1, unit = "round", reason = "" } = {}) {
  if (!add2eWorldTimeIsGM()) {
    ui.notifications?.warn?.("Temps ADD2E : réservé au MJ.");
    return { ok: false, reason: "not-gm" };
  }

  add2eRegisterTimeEngineApi();
  const amount = Math.max(0, Number(value) || 0);
  const normalizedUnit = add2eWorldTimeNormalizeUnit(unit);
  const rounds = add2eWorldTimeToRounds(amount, normalizedUnit);
  if (!Number.isFinite(rounds) || rounds <= 0) {
    ui.notifications?.warn?.("Temps ADD2E : durée invalide.");
    return { ok: false, reason: "invalid-duration", value, unit: normalizedUnit };
  }

  const before = add2eTimeCurrentTick();
  const actorRows = add2eWorldTimeAllActors();
  const normalized = await normalizeWorldActorEffects(actorRows, game.combat?.round ?? 0);
  const advanced = await add2eTimeAdvanceTick(rounds, { reason: reason || `advance-${amount}-${normalizedUnit}` });
  const after = add2eTimeCurrentTick();
  const expired = await add2eWorldTimeExpireAllActors({ reason: `world-time:${normalizedUnit}`, normalize: false });
  const label = `${amount} ${unitLabel(normalizedUnit)}${amount > 1 ? "s" : ""}`;

  await notifyAdvance({ before, after, delta: rounds, label, reason, expired });
  ui.notifications?.info?.(`Temps ADD2E avancé : ${label} (${rounds} round(s)). Effets expirés : ${expired.deleted ?? 0}.`);

  const result = { ok: true, before, after, delta: rounds, value: amount, unit: normalizedUnit, label, reason, normalized, advanced, expired };
  log("[ADVANCE]", result);
  return result;
}
