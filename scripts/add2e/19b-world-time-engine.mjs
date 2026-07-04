// ============================================================================
// ADD2E — Gestion du temps hors combat.
// Version : 2026-07-04-world-time-charm-periodic-saves-v3
//
// Rôle :
// - Avancer le temps de jeu hors combat par commandes MJ.
// - Réutiliser le même tick global que le moteur de combat.
// - Expirer les ActiveEffect gérés par ADD2E_TIME_ENGINE.
// - Gérer les sauvegardes périodiques de Charme-personne.
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

export const ADD2E_WORLD_TIME_ENGINE_VERSION = "2026-07-04-world-time-charm-periodic-saves-v3";

const TAG = "[ADD2E][WORLD_TIME]";
const TOOL_NAME = "add2e-world-time";
const CHARM_PERIODIC_SAVE_FLAG = "charmPeriodicSave";
const CHARM_PERIODIC_SAVE_VERSION = "2026-07-04-charm-person-periodic-saves-v2";
const CHARM_PERIODIC_SAVE_PROCESSING = new Set();
let APP_INSTANCE = null;
let TOOLBAR_HOOK_REGISTERED = false;
let CHARM_PERIODIC_SAVE_HOOK_REGISTERED = false;
let CHARM_PERIODIC_SAVE_SCHEDULED = false;

function log(label, data = {}) { console.log(`${TAG}${label}`, data); }
function warn(label, data = {}) { console.warn(`${TAG}${label}`, data); }
function esc(value) { return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#039;"); }
function chatStyleData() { return CONST.CHAT_MESSAGE_STYLES ? { style: CONST.CHAT_MESSAGE_STYLES.OTHER } : { type: CONST.CHAT_MESSAGE_TYPES?.OTHER ?? 0 }; }
function isWorldTimeGM() { return game.user?.isGM === true; }
function unitLabel(unit) { return ({ segment: "segment", round: "round", turn: "tour", minute: "minute", hour: "heure" })[unit] ?? unit ?? "round"; }

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

  for (const combatant of collectionValues(game.combat?.combatants)) {
    pushActor(out, seen, combatantActor(combatant), "combatant", combatant?.id ?? combatant?.tokenId ?? "");
  }

  for (const token of canvas?.tokens?.placeables ?? []) {
    pushActor(out, seen, tokenActor(token), "canvas-token", token?.document?.uuid ?? token?.id ?? "");
  }

  for (const tokenDoc of collectionValues(canvas?.scene?.tokens)) {
    pushActor(out, seen, tokenActor(tokenDoc), "active-scene-token", tokenDoc?.uuid ?? tokenDoc?.id ?? "");
  }

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

function charmState(effect) {
  const state = effect?.flags?.add2e?.[CHARM_PERIODIC_SAVE_FLAG];
  if (!state || typeof state !== "object" || state.enabled !== true) return null;

  const intervalTicks = Math.max(1, Math.floor(Number(state.intervalTicks)));
  const nextSaveTick = Math.floor(Number(state.nextSaveTick));
  if (!Number.isFinite(intervalTicks) || !Number.isFinite(nextSaveTick)) return null;

  return {
    ...state,
    intelligence: Math.max(0, Math.floor(Number(state.intelligence) || 0)),
    intervalTicks,
    nextSaveTick,
    attempts: Math.max(0, Math.floor(Number(state.attempts) || 0)),
    intervalLabel: String(state.intervalLabel || "délai spécial")
  };
}

function charmSaveThreshold(actor) {
  const system = actor?.system ?? {};
  const direct = Number(system.sauvegardes?.sorts ?? system.saves?.spells ?? system.save_spells ?? NaN);
  if (Number.isFinite(direct) && direct > 0) return direct;

  const level = Math.max(1, Number(system.niveau ?? system.level ?? 1) || 1);
  const classItem = actor?.items?.find?.(entry => entry.type === "classe");
  const saves = classItem?.system?.progression?.[level - 1]?.savingThrows;
  const fromClass = Array.isArray(saves) ? Number(saves[4]) : NaN;
  return Number.isFinite(fromClass) && fromClass > 0 ? fromClass : 15;
}

function charmWisdom(actor) {
  return Number(
    actor?.system?.sagesse
      ?? actor?.system?.sagesse_base
      ?? actor?.system?.sag_aff
      ?? actor?.system?.abilities?.wis?.value
      ?? 0
  ) || 0;
}

async function charmRollSave(actor) {
  const engine = globalThis.Add2eEffectsEngine;
  const wisdom = charmWisdom(actor);
  const wisdomBonus = wisdom >= 15 ? wisdom - 14 : 0;

  if (typeof engine?.rollActionSave === "function") {
    const result = await engine.rollActionSave(actor, "sorts", wisdomBonus);
    if (result?.canRoll) {
      return {
        total: Number(result.total) || 0,
        threshold: Number(result.threshold) || charmSaveThreshold(actor),
        success: result.success === true,
        wisdomBonus,
        racialBonus: Number(result.racialBonus) || 0
      };
    }
  }

  const threshold = charmSaveThreshold(actor);
  const racialBonus = Number(engine?.getSaveBonus?.(actor, "sorts")) || 0;
  const totalBonus = wisdomBonus + racialBonus;
  const formula = totalBonus ? `1d20${totalBonus >= 0 ? "+" : ""}${totalBonus}` : "1d20";
  const roll = await new Roll(formula).evaluate({ async: true });
  if (game.dice3d) await game.dice3d.showForRoll(roll);

  const total = Number(roll.total) || 0;
  return { total, threshold, success: total >= threshold, wisdomBonus, racialBonus };
}

function charmSaveDetails(save) {
  const details = [];
  const wisdom = Number(save?.wisdomBonus) || 0;
  const racial = Number(save?.racialBonus) || 0;
  if (wisdom) details.push(`${wisdom >= 0 ? "+" : ""}${wisdom} Sag`);
  if (racial) details.push(`${racial >= 0 ? "+" : ""}${racial} racial`);
  return details.length ? ` (${details.join(" ; ")})` : "";
}

function charmRecipients(actor) {
  const ids = new Set();
  for (const user of ChatMessage.getWhisperRecipients?.("GM") ?? []) if (user?.id) ids.add(user.id);

  const ownerLevel = CONST.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3;
  for (const user of game.users ?? []) {
    if (!user || user.isGM) continue;
    let owner = false;
    try { owner = actor?.testUserPermission?.(user, "OWNER") === true; }
    catch (_error) {}
    if (!owner) {
      const explicit = Number(actor?.ownership?.[user.id] ?? actor?.permission?.[user.id] ?? 0);
      const fallback = Number(actor?.ownership?.default ?? actor?.permission?.default ?? 0);
      owner = explicit >= ownerLevel || fallback >= ownerLevel;
    }
    if (owner) ids.add(user.id);
  }
  return Array.from(ids);
}

async function endCharmVfx(actor) {
  if (typeof Sequencer === "undefined") return;
  for (const token of actor?.getActiveTokens?.() ?? []) {
    try {
      Sequencer.EffectManager.endEffects({ name: `charme-effect-${token.id}`, object: token });
    } catch (error) {
      warn("[CHARM_PERIODIC_SAVE][VFX_END_FAILED]", { actor: actor?.name, tokenId: token?.id, error });
    }
  }
}

async function notifyCharmPeriodicSave(actor, effect, state, attempts, { escaped = false, nextSaveTick = null } = {}) {
  const whisper = charmRecipients(actor);
  if (!whisper.length || !attempts.length) return false;

  const last = attempts[attempts.length - 1];
  const actorName = actor?.name ?? "La cible";
  const spellName = state.spellName || "Charme-personne";
  const img = effect?.img || effect?.icon || actor?.img || "icons/svg/status/heart.svg";
  const countText = attempts.length === 1
    ? `Jet : <b>${last.total}</b>${esc(charmSaveDetails(last))} contre <b>${last.threshold}</b>.`
    : `${attempts.length} jets périodiques étaient dus ; dernier jet : <b>${last.total}</b>${esc(charmSaveDetails(last))} contre <b>${last.threshold}</b>.`;
  const outcome = escaped
    ? `${esc(actorName)} réussit son jet et se libère du charme.`
    : `${esc(actorName)} reste charmé. Prochain jet dans <b>${esc(state.intervalLabel)}</b>.`;
  const next = !escaped && Number.isFinite(Number(nextSaveTick))
    ? `<div style="margin-top:5px;font-size:11px;color:#5d4037;">Prochain contrôle au tick ADD2E <b>${Math.floor(Number(nextSaveTick))}</b>.</div>`
    : "";

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    whisper,
    content: `<div class="add2e-chat-card add2e-charm-periodic-save" style="border:1px solid #8e44ad;border-radius:8px;overflow:hidden;background:#fff7fd;color:#3c1c46;font-family:var(--font-primary);"><div style="display:flex;align-items:center;gap:8px;background:#7d3c98;color:#fff;padding:7px 9px;"><img src="${esc(img)}" style="width:36px;height:36px;object-fit:cover;border-radius:4px;border:1px solid #e8daef;background:#fff;"><div style="flex:1;line-height:1.15;"><div style="font-weight:900;font-size:13px;">Sauvegarde périodique</div><div style="font-size:12px;opacity:.95;">${esc(spellName)}</div></div></div><div style="padding:8px 10px;background:#fff7fd;"><div style="font-size:13px;margin-bottom:5px;"><b>Cible :</b> ${esc(actorName)}</div><div style="border:1px solid ${escaped ? "#2e8b57" : "#b9770e"};border-radius:6px;background:#fff;padding:8px;text-align:center;font-size:13px;line-height:1.35;"><div style="font-weight:900;color:${escaped ? "#1e8449" : "#af601a"};">${escaped ? "CHARME ROMPU" : "CHARME MAINTENU"}</div><div style="margin-top:4px;">${outcome}</div><div style="margin-top:4px;">${countText}</div></div>${next}<div style="margin-top:6px;font-size:11px;color:#6c3483;text-align:center;">Intelligence : ${state.intelligence}</div></div></div>`,
    flags: { add2e: { charmPeriodicSaveMessage: true, actorId: actor?.id ?? null, actorUuid: actor?.uuid ?? null, effectId: effect?.id ?? null, escaped, attempts: attempts.length, tick: add2eTimeCurrentTick(), version: CHARM_PERIODIC_SAVE_VERSION } },
    ...chatStyleData()
  });
  return true;
}

async function processCharmPeriodicEffect(actor, effect) {
  const state = charmState(effect);
  if (!state || !actor?.effects?.get?.(effect.id) || effect.disabled) return { processed: false, reason: "inactive" };
  if (!isResponsibleWorldTimeGM()) return { processed: false, reason: "not-responsible-gm" };

  const key = `${actor?.uuid ?? actor?.id ?? "actor"}::${effect.id}`;
  if (CHARM_PERIODIC_SAVE_PROCESSING.has(key)) return { processed: false, reason: "already-processing" };

  CHARM_PERIODIC_SAVE_PROCESSING.add(key);
  try {
    const currentTick = add2eTimeCurrentTick();
    if (currentTick < state.nextSaveTick) return { processed: false, reason: "not-due", nextSaveTick: state.nextSaveTick };

    const attempts = [];
    let dueTick = state.nextSaveTick;
    let escaped = false;
    const maximum = 1000;

    while (dueTick <= currentTick && attempts.length < maximum) {
      const save = await charmRollSave(actor);
      attempts.push({ ...save, dueTick });
      if (save.success) {
        escaped = true;
        break;
      }
      dueTick += state.intervalTicks;
    }

    if (!attempts.length) return { processed: false, reason: "no-attempt" };

    if (escaped) {
      await endCharmVfx(actor);
      if (actor.effects?.get?.(effect.id)) await actor.deleteEmbeddedDocuments("ActiveEffect", [effect.id], { add2eCharmPeriodicSave: true });
      await notifyCharmPeriodicSave(actor, effect, state, attempts, { escaped: true });
      return { processed: true, escaped: true, attempts: attempts.length };
    }

    await effect.update({
      [`flags.add2e.${CHARM_PERIODIC_SAVE_FLAG}.nextSaveTick`]: dueTick,
      [`flags.add2e.${CHARM_PERIODIC_SAVE_FLAG}.lastSaveTick`]: attempts[attempts.length - 1].dueTick,
      [`flags.add2e.${CHARM_PERIODIC_SAVE_FLAG}.attempts`]: state.attempts + attempts.length,
      [`flags.add2e.${CHARM_PERIODIC_SAVE_FLAG}.lastCheckTick`]: currentTick
    }, { add2eCharmPeriodicSave: true });
    await notifyCharmPeriodicSave(actor, effect, state, attempts, { escaped: false, nextSaveTick: dueTick });
    return { processed: true, escaped: false, attempts: attempts.length, nextSaveTick: dueTick };
  } catch (error) {
    console.error(`${TAG}[CHARM_PERIODIC_SAVE][PROCESS_FAILED]`, { actor: actor?.name, effectId: effect?.id, error });
    return { processed: false, reason: "error", error };
  } finally {
    CHARM_PERIODIC_SAVE_PROCESSING.delete(key);
  }
}

export async function add2eWorldTimeProcessPeriodicCharms({ reason = "manual" } = {}) {
  if (!isResponsibleWorldTimeGM()) return { ok: false, reason: "not-responsible-gm", actors: 0, processed: 0, escaped: 0 };

  const rows = allWorldActors();
  let processed = 0;
  let escaped = 0;
  for (const { actor } of rows) {
    for (const effect of Array.from(actor.effects ?? [])) {
      const result = await processCharmPeriodicEffect(actor, effect);
      if (result.processed) processed += 1;
      if (result.escaped) escaped += 1;
    }
  }

  return { ok: true, reason, actors: rows.length, processed, escaped, tick: add2eTimeCurrentTick() };
}

function schedulePeriodicCharmProcessing(reason) {
  if (!isResponsibleWorldTimeGM() || CHARM_PERIODIC_SAVE_SCHEDULED) return;
  CHARM_PERIODIC_SAVE_SCHEDULED = true;
  window.setTimeout(() => {
    CHARM_PERIODIC_SAVE_SCHEDULED = false;
    add2eWorldTimeProcessPeriodicCharms({ reason })
      .catch(error => console.error(`${TAG}[CHARM_PERIODIC_SAVE][SCHEDULE_FAILED]`, { reason, error }));
  }, 0);
}

function registerPeriodicCharmSaveHook() {
  if (CHARM_PERIODIC_SAVE_HOOK_REGISTERED) return false;
  CHARM_PERIODIC_SAVE_HOOK_REGISTERED = true;
  Hooks.on("updateSetting", setting => {
    const key = String(setting?.key ?? setting?.id ?? "");
    if (key === "add2e.worldTimeTick") schedulePeriodicCharmProcessing("time-tick");
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

  const periodicCharms = await add2eWorldTimeProcessPeriodicCharms({ reason: `${reason}:periodic-charms` });
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

  const result = { ok: true, reason, actors: actorRows.length, deleted, messages, rows, periodicCharms, tick: add2eTimeCurrentTick() };
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
registerPeriodicCharmSaveHook();
globalThis.add2eInstallWorldTimeSceneButton = installSceneControlButton;

export function add2eRegisterWorldTimeEngine() {
  add2eRegisterTimeEngineApi();
  game.add2e = game.add2e ?? {};
  game.add2e.time = game.add2e.time ?? {};
  game.add2e.time.worldVersion = ADD2E_WORLD_TIME_ENGINE_VERSION;
  game.add2e.time.advance = add2eWorldTimeAdvance;
  game.add2e.time.expireAll = add2eWorldTimeExpireAllActors;
  game.add2e.time.processPeriodicCharms = add2eWorldTimeProcessPeriodicCharms;
  game.add2e.time.open = add2eOpenWorldTimeApplication;
  globalThis.ADD2E_WORLD_TIME_ENGINE_VERSION = ADD2E_WORLD_TIME_ENGINE_VERSION;
  globalThis.ADD2E_CHARM_PERIODIC_SAVE_VERSION = CHARM_PERIODIC_SAVE_VERSION;
  globalThis.ADD2EWorldTimeApplication = ADD2EWorldTimeApplication;
  globalThis.add2eWorldTimeAdvance = add2eWorldTimeAdvance;
  globalThis.add2eWorldTimeExpireAllActors = add2eWorldTimeExpireAllActors;
  globalThis.add2eWorldTimeProcessPeriodicCharms = add2eWorldTimeProcessPeriodicCharms;
  globalThis.add2eOpenWorldTimeApplication = add2eOpenWorldTimeApplication;
  registerToolbarHook();
  registerPeriodicCharmSaveHook();
  schedulePeriodicCharmProcessing("world-time-ready");
  log("[REGISTERED]", { version: ADD2E_WORLD_TIME_ENGINE_VERSION, tick: add2eTimeCurrentTick(), toolbar: "xp-pattern", scan: "world+tokens+combatants", charmPeriodicSave: CHARM_PERIODIC_SAVE_VERSION });
  return true;
}