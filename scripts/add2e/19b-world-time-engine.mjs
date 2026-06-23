// ============================================================================
// ADD2E — Gestion du temps hors combat.
// Version : 2026-06-18-world-time-any-gm-v1
//
// Rôle :
// - Avancer le temps de jeu hors combat par commandes MJ.
// - Réutiliser le même tick global que le moteur de combat.
// - Expirer les ActiveEffect gérés par ADD2E_TIME_ENGINE.
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
  add2eTimeToRounds
} from "./19a-time-engine.mjs";
import { add2eExpireTemporaryEffectsForActor } from "./18c-active-effects-expiration.mjs";
import { add2eSyncActorVitalStatus, add2eVitalRegisterStatusEffects } from "./18b-vital-status-sync.mjs";

export const ADD2E_WORLD_TIME_ENGINE_VERSION = "2026-06-18-world-time-any-gm-v1";

const TAG = "[ADD2E][WORLD_TIME]";
const TOOL_NAME = "add2e-world-time";
let APP_INSTANCE = null;
let TOOLBAR_HOOK_REGISTERED = false;

function log(label, data = {}) { console.log(`${TAG}${label}`, data); }
function warn(label, data = {}) { console.warn(`${TAG}${label}`, data); }
function esc(value) { return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#039;"); }
function chatStyleData() { return CONST.CHAT_MESSAGE_STYLES ? { style: CONST.CHAT_MESSAGE_STYLES.OTHER } : { type: CONST.CHAT_MESSAGE_TYPES?.OTHER ?? 0 }; }
function isWorldTimeGM() { return game.user?.isGM === true; }
function unitLabel(unit) { return ({ segment: "segment", round: "round", turn: "tour", minute: "minute", hour: "heure" })[unit] ?? unit ?? "round"; }

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

export async function add2eWorldTimeExpireAllActors({ reason = "world-time", currentRound = null } = {}) {
  if (!isWorldTimeGM()) return { ok: false, reason: "not-gm", actors: 0, deleted: 0, messages: 0, rows: [] };
  add2eRegisterTimeEngineApi();
  add2eVitalRegisterStatusEffects();

  const actorRows = allWorldActors();
  const rows = [];
  let deleted = 0;
  let messages = 0;

  for (const { actor, source } of actorRows) {
    try {
      const round = currentRound ?? game.combat?.round ?? 0;
      await game.add2e?.time?.normalizeActorEffects?.(actor, round);
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

  const result = { ok: true, reason, actors: actorRows.length, deleted, messages, rows, tick: add2eTimeCurrentTick() };
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
  const advanced = await add2eTimeAdvanceTick(rounds, { reason: reason || `advance-${amount}-${unit}` });
  const after = add2eTimeCurrentTick();
  const expired = await add2eWorldTimeExpireAllActors({ reason: `world-time:${unit}` });
  const label = `${amount} ${unitLabel(unit)}${amount > 1 ? "s" : ""}`;

  await notifyAdvance({ before, after, delta: rounds, label, reason, expired });
  ui.notifications?.info?.(`Temps ADD2E avancé : ${label} (${rounds} round(s)). Effets expirés : ${expired.deleted ?? 0}.`);

  const result = { ok: true, before, after, delta: rounds, value: amount, unit, label, reason, advanced, expired };
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
globalThis.add2eInstallWorldTimeSceneButton = installSceneControlButton;

export function add2eRegisterWorldTimeEngine() {
  add2eRegisterTimeEngineApi();
  game.add2e = game.add2e ?? {};
  game.add2e.time = game.add2e.time ?? {};
  game.add2e.time.worldVersion = ADD2E_WORLD_TIME_ENGINE_VERSION;
  game.add2e.time.advance = add2eWorldTimeAdvance;
  game.add2e.time.expireAll = add2eWorldTimeExpireAllActors;
  game.add2e.time.open = add2eOpenWorldTimeApplication;
  globalThis.ADD2E_WORLD_TIME_ENGINE_VERSION = ADD2E_WORLD_TIME_ENGINE_VERSION;
  globalThis.ADD2EWorldTimeApplication = ADD2EWorldTimeApplication;
  globalThis.add2eWorldTimeAdvance = add2eWorldTimeAdvance;
  globalThis.add2eWorldTimeExpireAllActors = add2eWorldTimeExpireAllActors;
  globalThis.add2eOpenWorldTimeApplication = add2eOpenWorldTimeApplication;
  registerToolbarHook();
  log("[REGISTERED]", { version: ADD2E_WORLD_TIME_ENGINE_VERSION, tick: add2eTimeCurrentTick(), toolbar: "xp-pattern", scan: "world+tokens+combatants" });
  return true;
}