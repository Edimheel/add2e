// ============================================================================
// ADD2E — Gestion du temps hors combat.
// Version : 2026-07-04-world-time-periodic-saves-generic-v4
//
// Rôle :
// - Avancer le temps de jeu hors combat par commandes MJ.
// - Réutiliser le même tick global que le moteur de combat.
// - Expirer les ActiveEffect gérés par ADD2E_TIME_ENGINE.
// - Résoudre les sauvegardes périodiques génériques des ActiveEffect.
// - Inclure les acteurs synthétiques de tokens, notamment les monstres non liés.
// - Fournir une interface MJ ApplicationV2 + DialogV2.
// - Ajouter le bouton Temps dans la barre gauche avec le même modèle que XP.
// - Compatible Foundry V13/V14/V15.
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

export const ADD2E_WORLD_TIME_ENGINE_VERSION = "2026-07-04-world-time-periodic-saves-generic-v4";

const TAG = "[ADD2E][WORLD_TIME]";
const TOOL_NAME = "add2e-world-time";
const PERIODIC_SAVE_VERSION = "2026-07-04-periodic-save-generic-v1";
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
let APP_INSTANCE = null;
let TOOLBAR_HOOK_REGISTERED = false;
let PERIODIC_SAVE_HOOK_REGISTERED = false;
let PERIODIC_SAVE_SCHEDULED = false;

function log(label, data = {}) { console.log(`${TAG}${label}`, data); }
function warn(label, data = {}) { console.warn(`${TAG}${label}`, data); }
function esc(value) { return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#039;"); }
function chatStyleData() { return CONST.CHAT_MESSAGE_STYLES ? { style: CONST.CHAT_MESSAGE_STYLES.OTHER } : { type: CONST.CHAT_MESSAGE_TYPES?.OTHER ?? 0 }; }
function isWorldTimeGM() { return game.user?.isGM === true; }
function unitLabel(unit) { return ({ segment: "segment", round: "round", turn: "tour", minute: "minute", hour: "heure" })[unit] ?? unit ?? "round"; }
function numberOr(value, fallback = NaN) { const number = Number(value); return Number.isFinite(number) ? number : fallback; }

function isResponsibleWorldTimeGM() {
  if (!game.user?.isGM) return false;
  if (typeof game.user.isActiveGM === "boolean") return game.user.isActiveGM;
  return game.users?.activeGM?.id === game.user.id || !game.users?.activeGM;
}

function actorScanKey(actor, sourceKey = "") {
  return actor?.uuid ?? actor?.id ?? sourceKey ?? actor?.name ?? foundry.utils.randomID();
}

function pushActor(out, seen, actor, source = "unknown", sourceKey = "") {
  if (!actor) return;
  const key = actorScanKey(actor, sourceKey);
  if (!key || seen.has(key)) return;
  seen.add(key);
  out.push({ actor, source });
}

function tokenActor(tokenLike) {
  return tokenLike?.actor ?? tokenLike?.document?.actor ?? tokenLike?.object?.actor ?? null;
}

function combatantActor(combatant) {
  return combatant?.actor ?? combatant?.token?.actor ?? combatant?.token?.document?.actor ?? null;
}

function collectionValues(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value.contents !== "undefined") return Array.from(value.contents ?? []);
  if (typeof value.values === "function") return Array.from(value.values());
  if (typeof value[Symbol.iterator] === "function" && typeof value !== "string") return Array.from(value);
  return [];
}

function allWorldActors() {
  const out = [];
  const seen = new Set();

  for (const actor of collectionValues(game.actors)) pushActor(out, seen, actor, "world-actor");
  for (const combatant of collectionValues(game.combat?.combatants)) pushActor(out, seen, combatantActor(combatant), "combatant", combatant?.id ?? combatant?.tokenId ?? "");
  for (const token of canvas?.tokens?.placeables ?? []) pushActor(out, seen, tokenActor(token), "canvas-token", token?.document?.uuid ?? token?.id ?? "");
  for (const tokenDoc of collectionValues(canvas?.scene?.tokens)) pushActor(out, seen, tokenActor(tokenDoc), "active-scene-token", tokenDoc?.uuid ?? tokenDoc?.id ?? "");
  for (const scene of collectionValues(game.scenes)) {
    for (const tokenDoc of collectionValues(scene?.tokens)) {
      pushActor(out, seen, tokenActor(tokenDoc), "scene-token", tokenDoc?.uuid ?? `${scene?.id ?? "scene"}.${tokenDoc?.id ?? "token"}`);
    }
  }

  return out;
}

function renderOpenMonsterSheets(actor = null) {
  for (const app of Object.values(ui.windows ?? {})) {
    const sheetActor = app?.actor ?? app?.object ?? app?.document ?? null;
    if (!sheetActor || sheetActor.type !== "monster") continue;
    if (actor && sheetActor.id !== actor.id && sheetActor.uuid !== actor.uuid) continue;
    try { app.render(false); }
    catch (_err) {}
  }
}

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
    version: String(raw.version ?? PERIODIC_SAVE_VERSION),
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
    version: PERIODIC_SAVE_VERSION,
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
      flags: { add2e: { periodicSaveMessage: true, actorId: actor?.id ?? null, actorUuid: actor?.uuid ?? null, effectId: effect?.id ?? null, success, attempts: attempts.length, tick: add2eTimeCurrentTick(), version: PERIODIC_SAVE_VERSION } },
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
  if (!isResponsibleWorldTimeGM()) return { processed: false, reason: "not-responsible-gm" };

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
  if (!isResponsibleWorldTimeGM()) return { ok: false, reason: "not-responsible-gm", actors: 0, processed: 0, succeeded: 0 };

  const rows = allWorldActors();
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

function schedulePeriodicSaveProcessing(reason) {
  if (!isResponsibleWorldTimeGM() || PERIODIC_SAVE_SCHEDULED) return;
  PERIODIC_SAVE_SCHEDULED = true;
  window.setTimeout(() => {
    PERIODIC_SAVE_SCHEDULED = false;
    add2eWorldTimeProcessPeriodicSaves({ reason })
      .catch(error => console.error(`${TAG}[PERIODIC_SAVE][SCHEDULE_FAILED]`, { reason, error }));
  }, 0);
}

function registerPeriodicSaveHook() {
  if (PERIODIC_SAVE_HOOK_REGISTERED) return false;
  PERIODIC_SAVE_HOOK_REGISTERED = true;
  Hooks.on("updateSetting", setting => {
    const key = String(setting?.key ?? setting?.id ?? "");
    if (key === "add2e.worldTimeTick" || key === "worldTimeTick") schedulePeriodicSaveProcessing("time-tick");
  });
  return true;
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
    const gmIds = ChatMessage.getWhisperRecipients?.("GM")?.map(u => u.id).filter(Boolean) ?? [];
    await ChatMessage.create({
      whisper: gmIds.length ? gmIds : undefined,
      content: `<div class="add2e-chat-card add2e-world-time" style="border:1px solid #7b5e57;border-radius:8px;overflow:hidden;background:#fffaf4;color:#3b2a22;font-family:var(--font-primary);"><div style="background:#6d4c41;color:white;padding:7px 9px;font-weight:900;">Temps ADD2E avancé</div><div style="padding:8px 10px;line-height:1.35;font-size:13px;"><div><b>Avance :</b> ${esc(label)} — ${delta} round(s) moteur.</div><div><b>Tick :</b> ${before} → ${after}</div>${reason ? `<div><b>Raison :</b> ${esc(reason)}</div>` : ""}<div><b>Acteurs scannés :</b> ${Number(expired?.actors ?? 0)}</div><div><b>Effets expirés :</b> ${Number(expired?.deleted ?? 0)}</div></div></div>`,
      flags: { add2e: { worldTimeAdvanceMessage: true, before, after, delta, label, reason, expired, version: ADD2E_WORLD_TIME_ENGINE_VERSION, timeEngineVersion: ADD2E_TIME_ENGINE_VERSION } },
      ...chatStyleData()
    });
  } catch (err) { warn("[CHAT_NOTIFY_FAILED]", { err }); }
}

export async function add2eWorldTimeExpireAllActors({ reason = "world-time", currentRound = null, normalize = true } = {}) {
  if (!isWorldTimeGM()) return { ok: false, reason: "not-gm", actors: 0, deleted: 0, messages: 0, rows: [] };
  add2eRegisterTimeEngineApi();
  add2eVitalRegisterStatusEffects();

  const periodicSaves = await add2eWorldTimeProcessPeriodicSaves({ reason: `${reason}:periodic-saves` });
  const actorRows = allWorldActors();
  const rows = [];
  let deleted = 0;
  let messages = 0;

  for (const { actor, source } of actorRows) {
    try {
      const round = currentRound ?? game.combat?.round ?? 0;
      if (normalize) await add2eTimeNormalizeActorEffects(actor, round);
      const result = await add2eExpireTemporaryEffectsForActor(actor, currentRound ?? game.combat?.round ?? null);
      await add2eSyncActorVitalStatus(actor, { reason });
      if (actor.type === "monster") renderOpenMonsterSheets(actor);
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
  if (!isWorldTimeGM()) {
    ui.notifications?.warn?.("Temps ADD2E : réservé au MJ.");
    return { ok: false, reason: "not-gm" };
  }

  add2eRegisterTimeEngineApi();
  const amount = Math.max(0, Number(value) || 0);
  const rounds = add2eTimeToRounds(amount, unit);
  if (!Number.isFinite(rounds) || rounds <= 0) {
    ui.notifications?.warn?.("Temps ADD2E : durée invalide.");
    return { ok: false, reason: "invalid-duration", value, unit };
  }

  const before = add2eTimeCurrentTick();
  const actorRows = allWorldActors();
  const normalized = await normalizeWorldActorEffects(actorRows, game.combat?.round ?? 0);
  const advanced = await add2eTimeAdvanceTick(rounds, { reason: reason || `advance-${amount}-${unit}` });
  const after = add2eTimeCurrentTick();
  const expired = await add2eWorldTimeExpireAllActors({ reason: `world-time:${unit}`, normalize: false });
  const label = `${amount} ${unitLabel(unit)}${amount > 1 ? "s" : ""}`;

  await notifyAdvance({ before, after, delta: rounds, label, reason, expired });
  ui.notifications?.info?.(`Temps ADD2E avancé : ${label} (${rounds} round(s)). Effets expirés : ${expired.deleted ?? 0}.`);

  const result = { ok: true, before, after, delta: rounds, value: amount, unit, label, reason, normalized, advanced, expired };
  log("[ADVANCE]", result);
  return result;
}

async function askCustomAdvance() {
  const DialogV2 = foundry.applications?.api?.DialogV2;
  if (!DialogV2) { ui.notifications?.error?.("Temps ADD2E : DialogV2 introuvable."); return null; }
  return await DialogV2.wait({
    window: { title: "Avancer le temps ADD2E" },
    content: `<form class="add2e-world-time-custom" style="display:flex;flex-direction:column;gap:8px;font-family:var(--font-primary);"><div class="form-group"><label style="font-weight:bold;">Valeur</label><input type="number" name="value" value="1" min="1" step="1" style="width:100%;"></div><div class="form-group"><label style="font-weight:bold;">Unité</label><select name="unit" style="width:100%;"><option value="segment">Segment</option><option value="round">Round</option><option value="turn">Tour</option><option value="minute">Minute</option><option value="hour">Heure</option></select></div><div class="form-group"><label style="font-weight:bold;">Raison / note MJ</label><input type="text" name="reason" value="" style="width:100%;" placeholder="Exploration, voyage, fouille, repos..."></div></form>`,
    buttons: [
      { action: "advance", label: "Avancer", icon: "fa-solid fa-clock", default: true, callback: (event, button) => ({ value: Number(button.form.elements.value?.value || 1), unit: String(button.form.elements.unit?.value || "round"), reason: String(button.form.elements.reason?.value || "") }) },
      { action: "cancel", label: "Annuler", icon: "fa-solid fa-xmark", callback: () => null }
    ],
    rejectClose: false
  });
}

export class ADD2EWorldTimeApplication extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "add2e-world-time-app",
    tag: "section",
    window: { title: "Temps ADD2E", icon: "fa-solid fa-hourglass-half", resizable: true },
    position: { width: 380, height: "auto" },
    actions: {
      advanceSegment: ADD2EWorldTimeApplication._advanceSegment,
      advanceRound: ADD2EWorldTimeApplication._advanceRound,
      advanceTurn: ADD2EWorldTimeApplication._advanceTurn,
      advance10Minutes: ADD2EWorldTimeApplication._advance10Minutes,
      advanceHour: ADD2EWorldTimeApplication._advanceHour,
      custom: ADD2EWorldTimeApplication._custom,
      scan: ADD2EWorldTimeApplication._scan
    }
  };

  async _renderHTML() {
    const tick = add2eTimeCurrentTick();
    return `<div class="add2e-world-time" style="padding:10px;font-family:var(--font-primary);"><div style="border:1px solid #8d6e63;border-radius:8px;background:#fffaf4;padding:8px;margin-bottom:8px;text-align:center;"><div style="font-weight:900;color:#4e342e;font-size:15px;">Temps ADD2E hors combat</div><div style="font-size:12px;color:#6d4c41;margin-top:4px;">Tick global actuel : <b>${tick}</b> round(s)</div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;"><button type="button" data-action="advanceSegment"><i class="fa-solid fa-forward-step"></i> +1 segment</button><button type="button" data-action="advanceRound"><i class="fa-solid fa-forward"></i> +1 round</button><button type="button" data-action="advanceTurn"><i class="fa-solid fa-clock"></i> +1 tour</button><button type="button" data-action="advance10Minutes"><i class="fa-solid fa-clock-rotate-left"></i> +10 minutes</button><button type="button" data-action="advanceHour"><i class="fa-solid fa-hourglass"></i> +1 heure</button><button type="button" data-action="custom"><i class="fa-solid fa-sliders"></i> Personnalisé</button></div><button type="button" data-action="scan" style="width:100%;margin-top:8px;"><i class="fa-solid fa-magnifying-glass"></i> Scanner les expirations sans avancer</button><div style="font-size:11px;color:#6d4c41;margin-top:8px;line-height:1.35;">Bouton barre gauche : modèle XP. Console : <code>game.add2e.time.open()</code>.</div></div>`;
  }

  _replaceHTML(result, content) { content.innerHTML = result; }
  static async _advanceSegment() { await add2eWorldTimeAdvance({ value: 1, unit: "segment", reason: "Bouton MJ : +1 segment" }); APP_INSTANCE?.render({ force: true }); }
  static async _advanceRound() { await add2eWorldTimeAdvance({ value: 1, unit: "round", reason: "Bouton MJ : +1 round" }); APP_INSTANCE?.render({ force: true }); }
  static async _advanceTurn() { await add2eWorldTimeAdvance({ value: 1, unit: "turn", reason: "Bouton MJ : +1 tour" }); APP_INSTANCE?.render({ force: true }); }
  static async _advance10Minutes() { await add2eWorldTimeAdvance({ value: 10, unit: "minute", reason: "Bouton MJ : +10 minutes" }); APP_INSTANCE?.render({ force: true }); }
  static async _advanceHour() { await add2eWorldTimeAdvance({ value: 1, unit: "hour", reason: "Bouton MJ : +1 heure" }); APP_INSTANCE?.render({ force: true }); }
  static async _custom() { const data = await askCustomAdvance(); if (!data) return; await add2eWorldTimeAdvance(data); APP_INSTANCE?.render({ force: true }); }
  static async _scan() { const result = await add2eWorldTimeExpireAllActors({ reason: "world-time-scan" }); ui.notifications?.info?.(`Scan temps ADD2E : ${result.deleted ?? 0} effet(s) expiré(s).`); APP_INSTANCE?.render({ force: true }); }
}

export function add2eOpenWorldTimeApplication() {
  if (!game.user?.isGM) { ui.notifications?.warn?.("Temps ADD2E : réservé au MJ."); return null; }
  APP_INSTANCE = APP_INSTANCE ?? new ADD2EWorldTimeApplication();
  APP_INSTANCE.render({ force: true });
  return APP_INSTANCE;
}

function openWorldTimeFromTool() { add2eOpenWorldTimeApplication(); }
function worldTimeToolDefinition() { return { name: TOOL_NAME, title: "ADD2E — Temps", icon: "fas fa-hourglass-half", button: true, visible: game.user?.isGM === true, onChange: openWorldTimeFromTool }; }

function installToolInControl(control, tool = worldTimeToolDefinition()) {
  if (!control) return false;
  if (Array.isArray(control.tools)) {
    const existing = control.tools.find(t => t?.name === tool.name || t?.id === tool.name);
    if (existing) Object.assign(existing, tool);
    else control.tools.push(tool);
    return true;
  }
  if (control.tools instanceof Map) {
    const existing = control.tools.get(tool.name);
    if (existing) Object.assign(existing, tool);
    else control.tools.set(tool.name, tool);
    return true;
  }
  if (control.tools && typeof control.tools === "object") {
    control.tools[tool.name] = { ...(control.tools[tool.name] ?? {}), ...tool };
    return true;
  }
  control.tools = [tool];
  return true;
}

function installSceneControlButton(controls) {
  const tool = worldTimeToolDefinition();
  if (Array.isArray(controls)) {
    const tokenControl = controls.find(c => c?.name === "token" || c?.name === "tokens") ?? controls[0];
    if (installToolInControl(tokenControl, tool)) return;
    controls.push({ name: "add2e", title: "ADD2E", icon: "fas fa-dragon", tools: [tool], activeTool: tool.name });
    return;
  }
  if (controls && typeof controls === "object") {
    const tokenControl = controls.token ?? controls.tokens ?? Object.values(controls).find(c => c?.name === "token" || c?.name === "tokens");
    if (installToolInControl(tokenControl, tool)) return;
    controls.add2e = controls.add2e ?? { name: "add2e", title: "ADD2E", icon: "fas fa-dragon", tools: {} };
    installToolInControl(controls.add2e, tool);
  }
}

function registerToolbarHook() {
  if (TOOLBAR_HOOK_REGISTERED) return false;
  TOOLBAR_HOOK_REGISTERED = true;
  Hooks.on("getSceneControlButtons", installSceneControlButton);
  return true;
}

registerToolbarHook();
registerPeriodicSaveHook();
globalThis.add2eInstallWorldTimeSceneButton = installSceneControlButton;

export function add2eRegisterWorldTimeEngine() {
  add2eRegisterTimeEngineApi();
  game.add2e = game.add2e ?? {};
  game.add2e.time = game.add2e.time ?? {};
  game.add2e.time.worldVersion = ADD2E_WORLD_TIME_ENGINE_VERSION;
  game.add2e.time.advance = add2eWorldTimeAdvance;
  game.add2e.time.expireAll = add2eWorldTimeExpireAllActors;
  game.add2e.time.processPeriodicSaves = add2eWorldTimeProcessPeriodicSaves;
  game.add2e.time.open = add2eOpenWorldTimeApplication;
  globalThis.ADD2E_WORLD_TIME_ENGINE_VERSION = ADD2E_WORLD_TIME_ENGINE_VERSION;
  globalThis.ADD2E_PERIODIC_SAVE_VERSION = PERIODIC_SAVE_VERSION;
  globalThis.ADD2EWorldTimeApplication = ADD2EWorldTimeApplication;
  globalThis.add2eWorldTimeAdvance = add2eWorldTimeAdvance;
  globalThis.add2eWorldTimeExpireAllActors = add2eWorldTimeExpireAllActors;
  globalThis.add2eWorldTimeProcessPeriodicSaves = add2eWorldTimeProcessPeriodicSaves;
  globalThis.add2eOpenWorldTimeApplication = add2eOpenWorldTimeApplication;
  registerToolbarHook();
  registerPeriodicSaveHook();
  schedulePeriodicSaveProcessing("world-time-ready");
  log("[REGISTERED]", { version: ADD2E_WORLD_TIME_ENGINE_VERSION, tick: add2eTimeCurrentTick(), toolbar: "xp-pattern", scan: "world+tokens+combatants", periodicSave: PERIODIC_SAVE_VERSION });
  return true;
}