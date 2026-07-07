// ============================================================================
// ADD2E — Temps hors combat : sauvegardes périodiques.
// Compatible Foundry V13/V14/V15.
// ============================================================================
import { add2eTimeCurrentTick } from "./19a-time-engine.mjs";
import {
  add2eWorldTimeAllActors,
  add2eWorldTimeIsResponsibleGM
} from "./19b0-world-time-actors.mjs";

export const ADD2E_WORLD_TIME_PERIODIC_SAVE_VERSION = "2026-07-04-periodic-save-generic-v1";

const TAG = "[ADD2E][WORLD_TIME]";
const PERIODIC_SAVE_FLAG = "periodicSave";
const LEGACY_CHARM_PERIODIC_SAVE_FLAG = "charmPeriodicSave";
const PERIODIC_SAVE_PROCESSING = new Set();
const SAVE_TYPES = {
  paralysie: { index: 0, label: "Paralysie" },
  petrification: { index: 1, label: "Pétrification" },
  baguettes: { index: 2, label: "Baguettes" },
  souffles: { index: 3, label: "Souffles" },
  sorts: { index: 4, label: "Sorts" }
};
let PERIODIC_SAVE_HOOK_REGISTERED = false;
let PERIODIC_SAVE_SCHEDULED = false;

function warn(label, data = {}) { console.warn(`${TAG}${label}`, data); }
function esc(value) { return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
function chatStyleData() { return CONST.CHAT_MESSAGE_STYLES ? { style: CONST.CHAT_MESSAGE_STYLES.OTHER } : { type: CONST.CHAT_MESSAGE_TYPES?.OTHER ?? 0 }; }
function numberOr(value, fallback = NaN) { const number = Number(value); return Number.isFinite(number) ? number : fallback; }

function normalizedSaveType(value) {
  const raw = String(value ?? "sorts")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
  const aliases = {
    paralysis: "paralysie",
    petrification: "petrification",
    petrifaction: "petrification",
    wand: "baguettes",
    wands: "baguettes",
    baguette: "baguettes",
    breath: "souffles",
    spells: "sorts",
    spell: "sorts",
    sort: "sorts"
  };
  const key = aliases[raw] ?? raw;
  const definition = SAVE_TYPES[key] ?? SAVE_TYPES.sorts;
  return { key, index: definition.index, label: definition.label };
}

function periodicSaveConfig(value = {}) {
  const raw = value && typeof value === "object" ? value : {};
  const type = normalizedSaveType(raw.category ?? raw.type ?? raw.saveType ?? "sorts");
  const bonus = raw.bonus && typeof raw.bonus === "object" ? raw.bonus : {};
  return {
    category: type.key,
    index: type.index,
    label: String(raw.label ?? type.label),
    bonus: {
      mode: String(bonus.mode ?? "none"),
      ability: String(bonus.ability ?? ""),
      minimum: numberOr(bonus.minimum, NaN),
      subtract: numberOr(bonus.subtract, 0),
      flat: numberOr(bonus.flat, 0),
      label: String(bonus.label ?? "")
    }
  };
}

function periodicSaveState(effect) {
  const raw = effect?.flags?.add2e?.[PERIODIC_SAVE_FLAG];
  if (!raw || typeof raw !== "object" || raw.enabled !== true) return null;

  const intervalTicks = Math.max(1, Math.floor(numberOr(raw.intervalTicks, NaN)));
  const nextSaveTick = Math.floor(numberOr(raw.nextSaveTick, NaN));
  if (!Number.isFinite(intervalTicks) || !Number.isFinite(nextSaveTick)) return null;

  return {
    ...raw,
    version: String(raw.version ?? ADD2E_WORLD_TIME_PERIODIC_SAVE_VERSION),
    intervalTicks,
    nextSaveTick,
    attempts: Math.max(0, Math.floor(numberOr(raw.attempts, 0))),
    intervalLabel: String(raw.intervalLabel ?? "délai spécial"),
    save: periodicSaveConfig(raw.save),
    resolution: raw.resolution && typeof raw.resolution === "object" ? raw.resolution : {},
    cleanup: raw.cleanup && typeof raw.cleanup === "object" ? raw.cleanup : {},
    chat: raw.chat && typeof raw.chat === "object" ? raw.chat : {}
  };
}

function legacyCharmToPeriodicSave(effect) {
  const old = effect?.flags?.add2e?.[LEGACY_CHARM_PERIODIC_SAVE_FLAG];
  if (!old || typeof old !== "object" || old.enabled !== true) return null;

  const intervalTicks = Math.max(1, Math.floor(numberOr(old.intervalTicks, NaN)));
  const nextSaveTick = Math.floor(numberOr(old.nextSaveTick, NaN));
  if (!Number.isFinite(intervalTicks) || !Number.isFinite(nextSaveTick)) return null;

  const intelligence = Math.max(0, Math.floor(numberOr(old.intelligence, 0)));
  const sourceName = String(old.spellName ?? effect?.name ?? "Effet");
  return {
    version: ADD2E_WORLD_TIME_PERIODIC_SAVE_VERSION,
    enabled: true,
    kind: "saving-throw",
    sourceName,
    intervalTicks,
    intervalLabel: String(old.intervalLabel ?? "délai spécial"),
    intervalDays: numberOr(old.intervalDays, NaN),
    createdAtTick: numberOr(old.createdAtTick, NaN),
    nextSaveTick,
    lastSaveTick: old.lastSaveTick ?? null,
    attempts: Math.max(0, Math.floor(numberOr(old.attempts, 0))),
    save: {
      category: "sorts",
      label: "Sorts",
      bonus: { mode: "score-minus", ability: "sagesse", minimum: 15, subtract: 14, label: "Sag" }
    },
    resolution: { onSuccess: "delete-effect", onFailure: "keep-effect" },
    cleanup: { sequencerEffectNames: ["charme-effect-{tokenId}"] },
    chat: {
      title: "Sauvegarde périodique",
      sourceName,
      successHeading: "CHARME ROMPU",
      failureHeading: "CHARME MAINTENU",
      successText: "{actor} réussit son jet et se libère du charme.",
      failureText: "{actor} reste charmé. Prochain jet dans {interval}.",
      details: [{ label: "Intelligence", value: intelligence }]
    }
  };
}

async function ensurePeriodicSaveState(effect) {
  const canonical = periodicSaveState(effect);
  if (canonical) return canonical;

  const migrated = legacyCharmToPeriodicSave(effect);
  if (!migrated) return null;

  await effect.update({
    [`flags.add2e.${PERIODIC_SAVE_FLAG}`]: migrated,
    [`flags.add2e.-=${LEGACY_CHARM_PERIODIC_SAVE_FLAG}`]: null
  }, { add2ePeriodicSaveMigration: true });
  return periodicSaveState({ flags: { add2e: { [PERIODIC_SAVE_FLAG]: migrated } } });
}

function actorAbilityScore(actor, requestedAbility) {
  const normalized = String(requestedAbility ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
  const aliases = {
    force: { fields: ["force", "force_base", "for_aff"], ability: "str" },
    strength: { fields: ["force", "force_base", "for_aff"], ability: "str" },
    dexterite: { fields: ["dexterite", "dexterite_base", "dex_aff"], ability: "dex" },
    dexterity: { fields: ["dexterite", "dexterite_base", "dex_aff"], ability: "dex" },
    constitution: { fields: ["constitution", "constitution_base", "con_aff"], ability: "con" },
    intelligence: { fields: ["intelligence", "intelligence_base", "int_aff"], ability: "int" },
    sagesse: { fields: ["sagesse", "sagesse_base", "sag_aff"], ability: "wis" },
    wisdom: { fields: ["sagesse", "sagesse_base", "sag_aff"], ability: "wis" },
    charisme: { fields: ["charisme", "charisme_base", "cha_aff"], ability: "cha" },
    charisma: { fields: ["charisme", "charisme_base", "cha_aff"], ability: "cha" }
  };
  const definition = aliases[normalized];
  if (!definition) return 0;

  const system = actor?.system ?? {};
  for (const field of definition.fields) {
    const value = numberOr(system?.[field], NaN);
    if (Number.isFinite(value)) return value;
  }
  return numberOr(system?.abilities?.[definition.ability]?.value, 0) || 0;
}

function periodicSaveAbilityBonus(actor, config) {
  const bonus = config?.bonus ?? {};
  const flat = numberOr(bonus.flat, 0);
  if (String(bonus.mode ?? "none") !== "score-minus" || !bonus.ability) return flat;

  const score = actorAbilityScore(actor, bonus.ability);
  const minimum = numberOr(bonus.minimum, Infinity);
  if (!Number.isFinite(score) || score < minimum) return flat;
  return flat + score - numberOr(bonus.subtract, 0);
}

function savingThrowValue(container, saveType) {
  if (!container) return NaN;
  if (Array.isArray(container)) return numberOr(container[saveType.index], NaN);

  const candidates = [
    saveType.key,
    saveType.label,
    saveType.key === "petrification" ? "pétrification" : null,
    saveType.key === "sorts" ? "spells" : null,
    saveType.index
  ];
  for (const key of candidates) {
    if (key === null) continue;
    const value = numberOr(container?.[key], NaN);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return NaN;
}

function periodicSaveThreshold(actor, config) {
  const system = actor?.system ?? {};
  const candidates = [
    savingThrowValue(system.sauvegardes, config),
    savingThrowValue(system.savingThrows, config),
    savingThrowValue(system.saves, config),
    savingThrowValue(system.save, config)
  ];

  const level = Math.max(1, Math.floor(numberOr(system.niveau ?? system.level, 1)));
  const classItem = actor?.items?.find?.(entry => entry.type === "classe");
  candidates.push(savingThrowValue(classItem?.system?.progression?.[level - 1]?.savingThrows, config));

  for (const value of candidates) if (Number.isFinite(value) && value > 0) return value;
  return 15;
}

async function rollPeriodicSave(actor, state) {
  const config = state.save;
  const engine = globalThis.Add2eEffectsEngine;
  const abilityBonus = periodicSaveAbilityBonus(actor, config);

  if (typeof engine?.rollActionSave === "function") {
    const result = await engine.rollActionSave(actor, config.category, abilityBonus);
    if (result?.canRoll) {
      return {
        total: numberOr(result.total, 0),
        threshold: numberOr(result.threshold, periodicSaveThreshold(actor, config)),
        success: result.success === true,
        abilityBonus,
        racialBonus: numberOr(result.racialBonus, 0)
      };
    }
  }

  const threshold = periodicSaveThreshold(actor, config);
  const racialBonus = numberOr(engine?.getSaveBonus?.(actor, config.category), 0);
  const totalBonus = abilityBonus + racialBonus;
  const formula = totalBonus ? `1d20${totalBonus >= 0 ? "+" : ""}${totalBonus}` : "1d20";
  const roll = await new Roll(formula).evaluate({ async: true });
  if (game.dice3d) await game.dice3d.showForRoll(roll);

  const total = numberOr(roll.total, 0);
  return { total, threshold, success: total >= threshold, abilityBonus, racialBonus };
}

function periodicSaveBonusLabel(save, state) {
  const details = [];
  const abilityBonus = numberOr(save?.abilityBonus, 0);
  const racialBonus = numberOr(save?.racialBonus, 0);
  const abilityLabel = String(state?.save?.bonus?.label || state?.save?.bonus?.ability || "carac");
  if (abilityBonus) details.push(`${abilityBonus >= 0 ? "+" : ""}${abilityBonus} ${abilityLabel}`);
  if (racialBonus) details.push(`${racialBonus >= 0 ? "+" : ""}${racialBonus} racial`);
  return details.length ? ` (${details.join(" ; ")})` : "";
}

function periodicSaveRecipients(actor) {
  const ids = new Set();
  for (const user of ChatMessage.getWhisperRecipients?.("GM") ?? []) if (user?.id) ids.add(user.id);

  const ownerLevel = CONST.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3;
  for (const user of game.users ?? []) {
    if (!user || user.isGM) continue;
    let owner = false;
    try { owner = actor?.testUserPermission?.(user, "OWNER") === true; }
    catch (_error) {}
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
  return String(text ?? "").replace(/\{(actor|effect|interval|source|save)\}/g, (_match, key) => String(context[key] ?? ""));
}

function periodicChatDetails(state) {
  const raw = state?.chat?.details;
  const rows = Array.isArray(raw) ? raw : (raw && typeof raw === "object" ? Object.entries(raw).map(([label, value]) => ({ label, value })) : []);
  return rows
    .map(row => ({ label: String(row?.label ?? "").trim(), value: row?.value }))
    .filter(row => row.label && row.value !== null && row.value !== undefined && row.value !== "");
}

function periodicSequencerNames(state) {
  const raw = state?.cleanup?.sequencerEffectNames ?? state?.cleanup?.sequencerEffectName ?? [];
  return (Array.isArray(raw) ? raw : [raw]).map(value => String(value ?? "").trim()).filter(Boolean);
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
        warn("[PERIODIC_SAVE][VFX_END_FAILED]", { actor: actor?.name, tokenId: token?.id, name, error });
      }
    }
  }
}

async function resolvePeriodicSaveOutcome(actor, effect, state, outcome) {
  const actionKey = outcome === "success" ? "onSuccess" : "onFailure";
  const defaultAction = outcome === "success" ? "delete-effect" : "keep-effect";
  const action = String(state?.resolution?.[actionKey] ?? defaultAction).trim().toLowerCase();

  if (outcome === "success") await cleanupPeriodicSaveVfx(actor, state);
  if (!actor?.effects?.get?.(effect?.id)) return { action: "missing-effect", terminal: true };

  if (action === "delete-effect") {
    await actor.deleteEmbeddedDocuments("ActiveEffect", [effect.id], { add2ePeriodicSave: true, add2ePeriodicSaveOutcome: outcome });
    return { action, terminal: true };
  }
  if (action === "disable-effect") {
    await effect.update({ disabled: true }, { add2ePeriodicSave: true, add2ePeriodicSaveOutcome: outcome });
    return { action, terminal: true };
  }
  if (action === "keep-effect" && outcome === "success") {
    await effect.update({ [`flags.add2e.${PERIODIC_SAVE_FLAG}.enabled`]: false }, { add2ePeriodicSave: true, add2ePeriodicSaveOutcome: outcome });
    return { action, terminal: true };
  }
  return { action: "keep-effect", terminal: false };
}

async function notifyPeriodicSave(actor, effect, state, attempts, { success = false, nextSaveTick = null } = {}) {
  const whisper = periodicSaveRecipients(actor);
  if (!whisper.length || !attempts.length) return false;

  const last = attempts[attempts.length - 1];
  const actorName = actor?.name ?? "La cible";
  const sourceName = String(state?.chat?.sourceName ?? state?.sourceName ?? effect?.name ?? "Effet");
  const effectName = String(effect?.name ?? effect?.label ?? sourceName);
  const context = { actor: actorName, effect: effectName, interval: state.intervalLabel, source: sourceName, save: state.save.label };
  const chat = state.chat ?? {};
  const image = String(chat.img ?? effect?.img ?? effect?.icon ?? actor?.img ?? "icons/svg/d20-black.svg");
  const heading = success
    ? String(chat.successHeading ?? "EFFET TERMINÉ")
    : String(chat.failureHeading ?? "EFFET MAINTENU");
  const defaultText = success
    ? "{actor} réussit sa sauvegarde périodique."
    : "{actor} échoue à sa sauvegarde périodique. Prochain jet dans {interval}.";
  const outcome = periodicTemplate(success ? (chat.successText ?? defaultText) : (chat.failureText ?? defaultText), context);
  const countText = attempts.length === 1
    ? `Jet : <b>${last.total}</b>${esc(periodicSaveBonusLabel(last, state))} contre <b>${last.threshold}</b>.`
    : `${attempts.length} jets périodiques étaient dus ; dernier jet : <b>${last.total}</b>${esc(periodicSaveBonusLabel(last, state))} contre <b>${last.threshold}</b>.`;
  const next = !success && Number.isFinite(numberOr(nextSaveTick, NaN))
    ? `<div style="margin-top:5px;font-size:11px;color:#5d4037;">Prochain contrôle au tick ADD2E <b>${Math.floor(Number(nextSaveTick))}</b>.</div>`
    : "";
  const details = periodicChatDetails(state)
    .map(row => `<span>${esc(row.label)} : <b>${esc(row.value)}</b></span>`)
    .join("&nbsp;&nbsp;•&nbsp;&nbsp;");
  const detailLine = details ? `<div style="margin-top:6px;font-size:11px;color:#6c3483;text-align:center;">${details}</div>` : "";

  try {
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      whisper,
      content: `<div class="add2e-chat-card add2e-periodic-save" style="border:1px solid #8e44ad;border-radius:8px;overflow:hidden;background:#fff7fd;color:#3c1c46;font-family:var(--font-primary);"><div style="display:flex;align-items:center;gap:8px;background:#7d3c98;color:#fff;padding:7px 9px;"><img src="${esc(image)}" style="width:36px;height:36px;object-fit:cover;border-radius:4px;border:1px solid #e8daef;background:#fff;"><div style="flex:1;line-height:1.15;"><div style="font-weight:900;font-size:13px;">${esc(chat.title ?? "Sauvegarde périodique")}</div><div style="font-size:12px;opacity:.95;">${esc(sourceName)}</div></div></div><div style="padding:8px 10px;background:#fff7fd;"><div style="font-size:13px;margin-bottom:5px;"><b>Cible :</b> ${esc(actorName)}</div><div style="border:1px solid ${success ? "#2e8b57" : "#b9770e"};border-radius:6px;background:#fff;padding:8px;text-align:center;font-size:13px;line-height:1.35;"><div style="font-weight:900;color:${success ? "#1e8449" : "#af601a"};">${esc(heading)}</div><div style="margin-top:4px;">${esc(outcome)}</div><div style="margin-top:4px;">${countText}</div></div>${next}${detailLine}</div></div>`,
      flags: { add2e: { periodicSaveMessage: true, actorId: actor?.id ?? null, actorUuid: actor?.uuid ?? null, effectId: effect?.id ?? null, success, attempts: attempts.length, tick: add2eTimeCurrentTick(), version: ADD2E_WORLD_TIME_PERIODIC_SAVE_VERSION } },
      ...chatStyleData()
    });
    return true;
  } catch (error) {
    warn("[PERIODIC_SAVE][CHAT_FAILED]", { actor: actor?.name, effectId: effect?.id, error });
    return false;
  }
}

async function processPeriodicSaveEffect(actor, effect) {
  if (!actor?.effects?.get?.(effect?.id) || effect?.disabled) return { processed: false, reason: "inactive" };
  if (!add2eWorldTimeIsResponsibleGM()) return { processed: false, reason: "not-responsible-gm" };

  const state = await ensurePeriodicSaveState(effect);
  if (!state) return { processed: false, reason: "not-periodic" };

  const key = `${actor?.uuid ?? actor?.id ?? "actor"}::${effect.id}`;
  if (PERIODIC_SAVE_PROCESSING.has(key)) return { processed: false, reason: "already-processing" };

  PERIODIC_SAVE_PROCESSING.add(key);
  try {
    const currentTick = add2eTimeCurrentTick();
    if (currentTick < state.nextSaveTick) return { processed: false, reason: "not-due", nextSaveTick: state.nextSaveTick };

    const attempts = [];
    let dueTick = state.nextSaveTick;
    let success = false;
    const maximum = 1000;

    while (dueTick <= currentTick && attempts.length < maximum) {
      const save = await rollPeriodicSave(actor, state);
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
      return { processed: true, success: true, attempts: attempts.length, resolution };
    }

    if (attempts.length >= maximum && dueTick <= currentTick) {
      warn("[PERIODIC_SAVE][SAVE_CAP_REACHED]", { actor: actor.name, effectId: effect.id, currentTick, dueTick, attempts: attempts.length });
    }

    const failureResolution = await resolvePeriodicSaveOutcome(actor, effect, state, "failure");
    if (failureResolution.terminal || !actor.effects?.get?.(effect.id)) {
      await notifyPeriodicSave(actor, effect, state, attempts, { success: false });
      return { processed: true, success: false, attempts: attempts.length, resolution: failureResolution };
    }

    await effect.update({
      [`flags.add2e.${PERIODIC_SAVE_FLAG}.nextSaveTick`]: dueTick,
      [`flags.add2e.${PERIODIC_SAVE_FLAG}.lastSaveTick`]: attempts[attempts.length - 1].dueTick,
      [`flags.add2e.${PERIODIC_SAVE_FLAG}.attempts`]: state.attempts + attempts.length,
      [`flags.add2e.${PERIODIC_SAVE_FLAG}.lastCheckTick`]: currentTick
    }, { add2ePeriodicSave: true });
    await notifyPeriodicSave(actor, effect, state, attempts, { success: false, nextSaveTick: dueTick });
    return { processed: true, success: false, attempts: attempts.length, nextSaveTick: dueTick };
  } catch (error) {
    console.error(`${TAG}[PERIODIC_SAVE][PROCESS_FAILED]`, { actor: actor?.name, effectId: effect?.id, error });
    return { processed: false, reason: "error", error };
  } finally {
    PERIODIC_SAVE_PROCESSING.delete(key);
  }
}

export async function add2eWorldTimeProcessPeriodicSaves({ reason = "manual" } = {}) {
  if (!add2eWorldTimeIsResponsibleGM()) return { ok: false, reason: "not-responsible-gm", actors: 0, processed: 0, succeeded: 0 };

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

  return { ok: true, reason, actors: rows.length, processed, succeeded, tick: add2eTimeCurrentTick() };
}

export function add2eScheduleWorldTimePeriodicSaveProcessing(reason) {
  if (!add2eWorldTimeIsResponsibleGM() || PERIODIC_SAVE_SCHEDULED) return false;
  PERIODIC_SAVE_SCHEDULED = true;
  window.setTimeout(() => {
    PERIODIC_SAVE_SCHEDULED = false;
    add2eWorldTimeProcessPeriodicSaves({ reason })
      .catch(error => console.error(`${TAG}[PERIODIC_SAVE][SCHEDULE_FAILED]`, { reason, error }));
  }, 0);
  return true;
}

export function add2eRegisterWorldTimePeriodicSaveHook() {
  if (PERIODIC_SAVE_HOOK_REGISTERED) return false;
  PERIODIC_SAVE_HOOK_REGISTERED = true;
  Hooks.on("updateSetting", setting => {
    const key = String(setting?.key ?? setting?.id ?? "");
    if (key === "add2e.worldTimeTick" || key === "worldTimeTick") add2eScheduleWorldTimePeriodicSaveProcessing("time-tick");
  });
  return true;
}
