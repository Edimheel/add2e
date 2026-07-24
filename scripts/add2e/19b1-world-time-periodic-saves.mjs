// ============================================================================
// ADD2E — Temps hors combat : sauvegardes périodiques canoniques.
// Compatible Foundry V13/V14/V15.
// ============================================================================
import { add2eTimeCurrentTick } from "./19a-time-engine.mjs";
import {
  add2eWorldTimeAllActors,
  add2eWorldTimeIsResponsibleGM
} from "./19b0-world-time-actors.mjs";

export const ADD2E_WORLD_TIME_PERIODIC_SAVE_VERSION = "2026-07-24-periodic-save-canonical-executor-v3";

const TAG = "[ADD2E][WORLD_TIME]";
const PERIODIC_SAVE_FLAG = "periodicSave";
const PERIODIC_SAVE_PROCESSING = new Set();
const SAVE_TYPES = Object.freeze({
  mort_paralysie: Object.freeze({ index: 0, label: "Paralysie / poison / mort magique" }),
  petrification: Object.freeze({ index: 1, label: "Pétrification / polymorphose" }),
  baguettes: Object.freeze({ index: 2, label: "Baguettes et badines" }),
  souffle: Object.freeze({ index: 3, label: "Souffles" }),
  sorts: Object.freeze({ index: 4, label: "Sortilèges" })
});

let PERIODIC_SAVE_HOOK_REGISTERED = false;
let PERIODIC_SAVE_SCHEDULED = false;

function warn(label, data = {}) {
  console.warn(`${TAG}${label}`, data);
}

function numberOr(value, fallback = NaN) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clone(value) {
  try {
    return foundry.utils.deepClone(value);
  } catch (_error) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value ?? null));
  }
}

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizedSaveType(value) {
  const aliases = {
    paralysie: "mort_paralysie",
    paralysis: "mort_paralysie",
    poison: "mort_paralysie",
    mort: "mort_paralysie",
    mort_magique: "mort_paralysie",
    death: "mort_paralysie",
    petrifaction: "petrification",
    polymorphose: "petrification",
    polymorph: "petrification",
    baguette: "baguettes",
    wand: "baguettes",
    wands: "baguettes",
    breath: "souffle",
    souffles: "souffle",
    spell: "sorts",
    spells: "sorts",
    sort: "sorts",
    sortilege: "sorts",
    sortileges: "sorts"
  };
  const raw = normalize(value || "sorts");
  const key = aliases[raw] ?? raw;
  const definition = SAVE_TYPES[key] ?? SAVE_TYPES.sorts;
  const canonicalKey = SAVE_TYPES[key] ? key : "sorts";
  return { key: canonicalKey, index: definition.index, label: definition.label };
}

function periodicSaveConfig(value = {}) {
  const raw = value && typeof value === "object" ? value : {};
  const type = normalizedSaveType(raw.category ?? raw.type ?? raw.saveType ?? "sorts");
  const context = raw.context && typeof raw.context === "object" ? clone(raw.context) : {};
  return {
    category: type.key,
    index: type.index,
    label: String(raw.label ?? type.label),
    context
  };
}

function periodicSaveState(effect) {
  const raw = effect?.flags?.add2e?.[PERIODIC_SAVE_FLAG];
  if (!raw || typeof raw !== "object" || raw.enabled !== true) return null;

  const intervalTicks = Math.max(1, Math.floor(numberOr(raw.intervalTicks, NaN)));
  const nextSaveTick = Math.floor(numberOr(raw.nextSaveTick, NaN));
  if (!Number.isFinite(intervalTicks) || !Number.isFinite(nextSaveTick)) return null;

  return {
    ...clone(raw),
    version: String(raw.version ?? ADD2E_WORLD_TIME_PERIODIC_SAVE_VERSION),
    intervalTicks,
    nextSaveTick,
    attempts: Math.max(0, Math.floor(numberOr(raw.attempts, 0))),
    intervalLabel: String(raw.intervalLabel ?? "délai spécial"),
    save: periodicSaveConfig(raw.save),
    resolution: raw.resolution && typeof raw.resolution === "object" ? clone(raw.resolution) : {},
    cleanup: raw.cleanup && typeof raw.cleanup === "object" ? clone(raw.cleanup) : {},
    chat: raw.chat && typeof raw.chat === "object" ? clone(raw.chat) : {}
  };
}

function periodicSaveRecipients(actor) {
  const ids = new Set();
  for (const user of ChatMessage.getWhisperRecipients?.("GM") ?? []) {
    if (user?.id) ids.add(user.id);
  }

  const ownerLevel = CONST.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3;
  for (const user of game.users ?? []) {
    if (!user || user.isGM) continue;
    let owner = false;
    try {
      owner = actor?.testUserPermission?.(user, "OWNER") === true;
    } catch (_error) {}
    if (!owner) {
      const explicit = numberOr(actor?.ownership?.[user.id] ?? actor?.permission?.[user.id], 0);
      const fallback = numberOr(actor?.ownership?.default ?? actor?.permission?.default, 0);
      owner = explicit >= ownerLevel || fallback >= ownerLevel;
    }
    if (owner) ids.add(user.id);
  }
  return Array.from(ids);
}

function periodicTemplate(text, context) {
  return String(text ?? "").replace(
    /\{(actor|effect|interval|source|save)\}/g,
    (_match, key) => String(context[key] ?? "")
  );
}

function periodicChatDetails(state) {
  const raw = state?.chat?.details;
  const rows = Array.isArray(raw)
    ? raw
    : (raw && typeof raw === "object"
      ? Object.entries(raw).map(([label, value]) => ({ label, value }))
      : []);
  return rows
    .map(row => ({ label: String(row?.label ?? "").trim(), value: row?.value }))
    .filter(row => row.label && row.value !== null && row.value !== undefined && row.value !== "");
}

function periodicSequencerNames(state) {
  const raw = state?.cleanup?.sequencerEffectNames ?? state?.cleanup?.sequencerEffectName ?? [];
  return (Array.isArray(raw) ? raw : [raw])
    .map(value => String(value ?? "").trim())
    .filter(Boolean);
}

function periodicTokenTemplate(value, actor, token) {
  return String(value ?? "")
    .replaceAll("{tokenId}", String(token?.id ?? ""))
    .replaceAll("{actorId}", String(actor?.id ?? ""))
    .replaceAll("{actorUuid}", String(actor?.uuid ?? ""));
}

async function cleanupPeriodicSaveVfx(actor, state) {
  const names = periodicSequencerNames(state);
  if (!names.length || typeof Sequencer === "undefined") return;

  for (const token of actor?.getActiveTokens?.() ?? []) {
    for (const template of names) {
      const name = periodicTokenTemplate(template, actor, token);
      if (!name) continue;
      try {
        Sequencer.EffectManager.endEffects({ name, object: token });
      } catch (error) {
        warn("[PERIODIC_SAVE][VFX_END_FAILED]", {
          actor: actor?.name,
          tokenId: token?.id,
          name,
          error
        });
      }
    }
  }
}

async function rollPeriodicSave(actor, state, effect) {
  if (typeof globalThis.add2eRollSavingThrow !== "function") {
    throw new Error("L’exécuteur canonique ADD2E de sauvegardes est indisponible.");
  }

  const context = state.save?.context && typeof state.save.context === "object"
    ? clone(state.save.context)
    : {};
  const result = await globalThis.add2eRollSavingThrow(actor, state.save.index, {
    ...context,
    source: context.source ?? `periodic-save:${effect?.uuid ?? effect?.id ?? "effect"}`,
    sourceEffect: effect,
    frontale: context.frontale === true,
    createChat: false,
    showDice: true
  });
  if (!result?.ok) {
    throw new Error(`Aucune valeur pour la sauvegarde périodique ${state.save.label} de ${actor?.name ?? "l’acteur"}.`);
  }
  return result;
}

function periodicModifierDetails(save) {
  const applied = save?.resolution?.bonusResolution?.applied ?? [];
  if (!applied.length) return "Aucun";
  return applied.map(entry => {
    const modifier = entry?.modifier ?? entry;
    const value = Number(modifier?.value) || 0;
    const label = modifier?.metadata?.label ?? modifier?.source?.name ?? "Modificateur";
    return `${label} ${value >= 0 ? "+" : ""}${value}`;
  }).join(" ; ");
}

async function resolvePeriodicSaveOutcome(actor, effect, state, outcome) {
  const actionKey = outcome === "success" ? "onSuccess" : "onFailure";
  const defaultAction = outcome === "success" ? "delete-effect" : "keep-effect";
  const action = String(state?.resolution?.[actionKey] ?? defaultAction).trim().toLowerCase();

  if (outcome === "success") await cleanupPeriodicSaveVfx(actor, state);
  if (!actor?.effects?.get?.(effect?.id)) return { action: "missing-effect", terminal: true };

  if (action === "delete-effect") {
    await actor.deleteEmbeddedDocuments("ActiveEffect", [effect.id], {
      add2ePeriodicSave: true,
      add2ePeriodicSaveOutcome: outcome
    });
    return { action, terminal: true };
  }
  if (action === "disable-effect") {
    await effect.update({ disabled: true }, {
      add2ePeriodicSave: true,
      add2ePeriodicSaveOutcome: outcome
    });
    return { action, terminal: true };
  }
  if (action === "keep-effect" && outcome === "success") {
    await effect.update({
      [`flags.add2e.${PERIODIC_SAVE_FLAG}.enabled`]: false
    }, {
      add2ePeriodicSave: true,
      add2ePeriodicSaveOutcome: outcome
    });
    return { action, terminal: true };
  }
  return { action: "keep-effect", terminal: false };
}

async function notifyPeriodicSave(actor, effect, state, attempts, {
  success = false,
  nextSaveTick = null
} = {}) {
  const whisper = periodicSaveRecipients(actor);
  if (!whisper.length || !attempts.length) return false;
  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    warn("[PERIODIC_SAVE][CHAT_UNAVAILABLE]", { actor: actor?.name, effectId: effect?.id });
    return false;
  }

  const last = attempts[attempts.length - 1];
  const actorName = actor?.name ?? "La cible";
  const sourceName = String(state?.chat?.sourceName ?? state?.sourceName ?? effect?.name ?? "Effet");
  const effectName = String(effect?.name ?? effect?.label ?? sourceName);
  const context = {
    actor: actorName,
    effect: effectName,
    interval: state.intervalLabel,
    source: sourceName,
    save: state.save.label
  };
  const chat = state.chat ?? {};
  const image = String(chat.img ?? effect?.img ?? effect?.icon ?? actor?.img ?? "icons/svg/d20-black.svg");
  const heading = success
    ? String(chat.successHeading ?? "EFFET TERMINÉ")
    : String(chat.failureHeading ?? "EFFET MAINTENU");
  const defaultText = success
    ? "{actor} réussit sa sauvegarde périodique."
    : "{actor} échoue à sa sauvegarde périodique. Prochain jet dans {interval}.";
  const outcome = periodicTemplate(
    success ? (chat.successText ?? defaultText) : (chat.failureText ?? defaultText),
    context
  );

  const rows = [
    { label: "Sauvegarde", value: state.save.label },
    { label: "D20", value: last.d20 },
    { label: "Bonus", value: `${last.bonus >= 0 ? "+" : ""}${last.bonus}` },
    { label: "Total", value: last.total },
    { label: "Seuil", value: last.target },
    { label: "Modificateurs", value: periodicModifierDetails(last) },
    { label: "Tentatives", value: attempts.length },
    !success && Number.isFinite(numberOr(nextSaveTick, NaN))
      ? { label: "Prochain contrôle", value: `Tick ADD2E ${Math.floor(Number(nextSaveTick))}` }
      : null,
    ...periodicChatDetails(state)
  ].filter(Boolean);

  const options = {
    actor,
    title: String(chat.title ?? "Sauvegarde périodique"),
    icon: "fas fa-clock-rotate-left",
    variant: success ? "success" : "failure",
    source: {
      name: sourceName,
      img: image,
      type: "Effet temporaire",
      meta: state.intervalLabel
    },
    target: {
      name: actorName,
      img: actor?.img,
      type: "Acteur",
      meta: state.save.label
    },
    rows,
    message: `${heading} — ${outcome}`,
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor }),
      whisper,
      rolls: attempts.map(attempt => attempt.roll).filter(Boolean),
      flags: {
        add2e: {
          periodicSaveMessage: true,
          actorId: actor?.id ?? null,
          actorUuid: actor?.uuid ?? null,
          effectId: effect?.id ?? null,
          success,
          attempts: attempts.length,
          saveType: last.resolution?.key ?? state.save.category,
          saveTarget: last.target,
          saveBonus: last.bonus,
          saveTotal: last.total,
          saveMental: last.resolution?.context?.mental === true,
          saveResolverVersion: last.version ?? null,
          tick: add2eTimeCurrentTick(),
          version: ADD2E_WORLD_TIME_PERIODIC_SAVE_VERSION
        }
      }
    }
  };

  try {
    const preview = globalThis.add2eBuildChatCard(options);
    if (!String(preview ?? "").trim()) throw new Error("Carte de sauvegarde périodique vide.");
    await globalThis.add2eCreateChatCard(options);
    return true;
  } catch (error) {
    warn("[PERIODIC_SAVE][CHAT_FAILED]", {
      actor: actor?.name,
      effectId: effect?.id,
      error
    });
    return false;
  }
}

async function processPeriodicSaveEffect(actor, effect) {
  if (!actor?.effects?.get?.(effect?.id) || effect?.disabled) {
    return { processed: false, reason: "inactive" };
  }
  if (!add2eWorldTimeIsResponsibleGM()) {
    return { processed: false, reason: "not-responsible-gm" };
  }

  const state = periodicSaveState(effect);
  if (!state) return { processed: false, reason: "not-periodic" };

  const key = `${actor?.uuid ?? actor?.id ?? "actor"}::${effect.id}`;
  if (PERIODIC_SAVE_PROCESSING.has(key)) {
    return { processed: false, reason: "already-processing" };
  }

  PERIODIC_SAVE_PROCESSING.add(key);
  try {
    const currentTick = add2eTimeCurrentTick();
    if (currentTick < state.nextSaveTick) {
      return {
        processed: false,
        reason: "not-due",
        nextSaveTick: state.nextSaveTick
      };
    }

    const attempts = [];
    let dueTick = state.nextSaveTick;
    let success = false;
    const maximum = 1000;

    while (dueTick <= currentTick && attempts.length < maximum) {
      const save = await rollPeriodicSave(actor, state, effect);
      attempts.push({ ...save, dueTick });
      if (save.success) {
        success = true;
        break;
      }
      dueTick += state.intervalTicks;
    }

    if (!attempts.length) return { processed: false, reason: "no-attempt" };

    if (success) {
      const resolution = await resolvePeriodicSaveOutcome(actor, effect, state, "success");
      await notifyPeriodicSave(actor, effect, state, attempts, { success: true });
      return {
        processed: true,
        success: true,
        attempts: attempts.length,
        resolution
      };
    }

    if (attempts.length >= maximum && dueTick <= currentTick) {
      warn("[PERIODIC_SAVE][SAVE_CAP_REACHED]", {
        actor: actor.name,
        effectId: effect.id,
        currentTick,
        dueTick,
        attempts: attempts.length
      });
    }

    const failureResolution = await resolvePeriodicSaveOutcome(actor, effect, state, "failure");
    if (failureResolution.terminal || !actor.effects?.get?.(effect.id)) {
      await notifyPeriodicSave(actor, effect, state, attempts, { success: false });
      return {
        processed: true,
        success: false,
        attempts: attempts.length,
        resolution: failureResolution
      };
    }

    await effect.update({
      [`flags.add2e.${PERIODIC_SAVE_FLAG}.nextSaveTick`]: dueTick,
      [`flags.add2e.${PERIODIC_SAVE_FLAG}.lastSaveTick`]: attempts[attempts.length - 1].dueTick,
      [`flags.add2e.${PERIODIC_SAVE_FLAG}.attempts`]: state.attempts + attempts.length,
      [`flags.add2e.${PERIODIC_SAVE_FLAG}.lastCheckTick`]: currentTick,
      [`flags.add2e.${PERIODIC_SAVE_FLAG}.version`]: ADD2E_WORLD_TIME_PERIODIC_SAVE_VERSION
    }, { add2ePeriodicSave: true });
    await notifyPeriodicSave(actor, effect, state, attempts, {
      success: false,
      nextSaveTick: dueTick
    });
    return {
      processed: true,
      success: false,
      attempts: attempts.length,
      nextSaveTick: dueTick
    };
  } catch (error) {
    console.error(`${TAG}[PERIODIC_SAVE][PROCESS_FAILED]`, {
      actor: actor?.name,
      effectId: effect?.id,
      error
    });
    return { processed: false, reason: "error", error };
  } finally {
    PERIODIC_SAVE_PROCESSING.delete(key);
  }
}

export async function add2eWorldTimeProcessPeriodicSaves({ reason = "manual" } = {}) {
  if (!add2eWorldTimeIsResponsibleGM()) {
    return {
      ok: false,
      reason: "not-responsible-gm",
      actors: 0,
      processed: 0,
      succeeded: 0
    };
  }

  const rows = add2eWorldTimeAllActors();
  let processed = 0;
  let succeeded = 0;
  for (const { actor } of rows) {
    for (const effect of Array.from(actor.effects ?? [])) {
      const result = await processPeriodicSaveEffect(actor, effect);
      if (result.processed) processed += 1;
      if (result.success) succeeded += 1;
    }
  }

  return {
    ok: true,
    reason,
    actors: rows.length,
    processed,
    succeeded,
    tick: add2eTimeCurrentTick(),
    version: ADD2E_WORLD_TIME_PERIODIC_SAVE_VERSION
  };
}

export function add2eScheduleWorldTimePeriodicSaveProcessing(reason) {
  if (!add2eWorldTimeIsResponsibleGM() || PERIODIC_SAVE_SCHEDULED) return false;
  PERIODIC_SAVE_SCHEDULED = true;
  window.setTimeout(() => {
    PERIODIC_SAVE_SCHEDULED = false;
    add2eWorldTimeProcessPeriodicSaves({ reason })
      .catch(error => console.error(`${TAG}[PERIODIC_SAVE][SCHEDULE_FAILED]`, {
        reason,
        error
      }));
  }, 0);
  return true;
}

export function add2eRegisterWorldTimePeriodicSaveHook() {
  if (PERIODIC_SAVE_HOOK_REGISTERED) return false;
  PERIODIC_SAVE_HOOK_REGISTERED = true;
  Hooks.on("updateSetting", setting => {
    const key = String(setting?.key ?? setting?.id ?? "");
    if (key === "add2e.worldTimeTick" || key === "worldTimeTick") {
      add2eScheduleWorldTimePeriodicSaveProcessing("time-tick");
    }
  });
  return true;
}
