// ============================================================================
// ADD2E — Gestion du temps hors combat.
// Version : 2026-06-06-world-time-engine-v3-left-toolbar-xp-style
//
// Rôle :
// - Avancer le temps de jeu hors combat par commandes MJ.
// - Réutiliser le même tick global que le moteur de combat.
// - Expirer les ActiveEffect gérés par ADD2E_TIME_ENGINE.
// - Fournir une interface MJ ApplicationV2 + DialogV2.
// - Exposer l'interface dans la barre d'outils gauche comme le bouton XP.
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

export const ADD2E_WORLD_TIME_ENGINE_VERSION = "2026-06-06-world-time-engine-v3-left-toolbar-xp-style";

const TAG = "[ADD2E][WORLD_TIME]";
const SETTINGS_SCOPE = "add2e";
const MENU_KEY = "worldTimeControls";
let APP_INSTANCE = null;
let HOOKS_REGISTERED = false;
let MENU_REGISTERED = false;

function log(label, data = {}) { console.log(`${TAG}${label}`, data); }
function warn(label, data = {}) { console.warn(`${TAG}${label}`, data); }
function err(label, data = {}) { console.error(`${TAG}${label}`, data); }

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function chatStyleData() {
  return CONST.CHAT_MESSAGE_STYLES
    ? { style: CONST.CHAT_MESSAGE_STYLES.OTHER }
    : { type: CONST.CHAT_MESSAGE_TYPES?.OTHER ?? 0 };
}

function isResponsibleGM() {
  if (!game.user?.isGM) return false;
  if (typeof game.user.isActiveGM === "boolean") return game.user.isActiveGM;
  return game.users?.activeGM?.id === game.user.id || !game.users?.activeGM;
}

function allWorldActors() { return Array.from(game.actors ?? []).filter(Boolean); }

function unitLabel(unit) {
  switch (unit) {
    case "segment": return "segment";
    case "round": return "round";
    case "turn": return "tour";
    case "minute": return "minute";
    case "hour": return "heure";
    default: return unit || "round";
  }
}

async function notifyAdvance({ before, after, delta, label, reason, expired }) {
  try {
    const gmIds = ChatMessage.getWhisperRecipients?.("GM")?.map(u => u.id).filter(Boolean) ?? [];
    await ChatMessage.create({
      whisper: gmIds.length ? gmIds : undefined,
      content: `
        <div class="add2e-chat-card add2e-world-time"
             style="border:1px solid #7b5e57;border-radius:8px;overflow:hidden;background:#fffaf4;color:#3b2a22;font-family:var(--font-primary);">
          <div style="background:#6d4c41;color:white;padding:7px 9px;font-weight:900;">Temps ADD2E avancé</div>
          <div style="padding:8px 10px;line-height:1.35;font-size:13px;">
            <div><b>Avance :</b> ${htmlEscape(label)} — ${delta} round(s) moteur.</div>
            <div><b>Tick :</b> ${before} → ${after}</div>
            ${reason ? `<div><b>Raison :</b> ${htmlEscape(reason)}</div>` : ""}
            <div><b>Effets expirés :</b> ${Number(expired?.deleted ?? 0)}</div>
          </div>
        </div>`,
      flags: {
        add2e: {
          worldTimeAdvanceMessage: true,
          before,
          after,
          delta,
          label,
          reason,
          expired,
          version: ADD2E_WORLD_TIME_ENGINE_VERSION,
          timeEngineVersion: ADD2E_TIME_ENGINE_VERSION
        }
      },
      ...chatStyleData()
    });
  } catch (e) { warn("[CHAT_NOTIFY_FAILED]", { e }); }
}

export async function add2eWorldTimeExpireAllActors({ reason = "world-time", currentRound = null } = {}) {
  if (!isResponsibleGM()) return { ok: false, reason: "not-responsible-gm", actors: 0, deleted: 0, messages: 0, rows: [] };

  add2eRegisterTimeEngineApi();
  add2eVitalRegisterStatusEffects();

  const rows = [];
  let deleted = 0;
  let messages = 0;

  for (const actor of allWorldActors()) {
    try {
      await game.add2e?.time?.normalizeActorEffects?.(actor, currentRound ?? game.combat?.round ?? 0);
      const result = await add2eExpireTemporaryEffectsForActor(actor, currentRound ?? game.combat?.round ?? null);
      await add2eSyncActorVitalStatus(actor, { reason });
      if (result?.deleted || result?.messages) {
        rows.push({ actor: actor.name, ...result });
        deleted += Number(result.deleted ?? 0);
        messages += Number(result.messages ?? 0);
      }
    } catch (e) {
      err("[ACTOR_EXPIRE_FAILED]", { actor: actor.name, actorId: actor.id, e });
      rows.push({ actor: actor.name, actorId: actor.id, error: String(e?.message || e) });
    }
  }

  const result = { ok: true, reason, actors: allWorldActors().length, deleted, messages, rows, tick: add2eTimeCurrentTick() };
  log("[EXPIRE_ALL]", result);
  return result;
}

export async function add2eWorldTimeAdvance({ value = 1, unit = "round", reason = "" } = {}) {
  if (!isResponsibleGM()) {
    ui.notifications?.warn?.("Temps ADD2E : seul le MJ actif peut avancer le temps.");
    return { ok: false, reason: "not-responsible-gm" };
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
  if (!DialogV2) {
    ui.notifications?.error?.("Temps ADD2E : DialogV2 introuvable.");
    return null;
  }

  return await DialogV2.wait({
    window: { title: "Avancer le temps ADD2E" },
    content: `
      <form class="add2e-world-time-custom" style="display:flex;flex-direction:column;gap:8px;font-family:var(--font-primary);">
        <div class="form-group"><label style="font-weight:bold;">Valeur</label><input type="number" name="value" value="1" min="1" step="1" style="width:100%;"></div>
        <div class="form-group"><label style="font-weight:bold;">Unité</label><select name="unit" style="width:100%;"><option value="segment">Segment</option><option value="round">Round</option><option value="turn">Tour</option><option value="minute">Minute</option><option value="hour">Heure</option></select></div>
        <div class="form-group"><label style="font-weight:bold;">Raison / note MJ</label><input type="text" name="reason" value="" style="width:100%;" placeholder="Exploration, voyage, fouille, repos..."></div>
      </form>`,
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

  async _renderHTML(_context, _options) {
    const tick = add2eTimeCurrentTick();
    return `
      <div class="add2e-world-time" style="padding:10px;font-family:var(--font-primary);">
        <div style="border:1px solid #8d6e63;border-radius:8px;background:#fffaf4;padding:8px;margin-bottom:8px;text-align:center;">
          <div style="font-weight:900;color:#4e342e;font-size:15px;">Temps ADD2E hors combat</div>
          <div style="font-size:12px;color:#6d4c41;margin-top:4px;">Tick global actuel : <b>${tick}</b> round(s)</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
          <button type="button" data-action="advanceSegment"><i class="fa-solid fa-forward-step"></i> +1 segment</button>
          <button type="button" data-action="advanceRound"><i class="fa-solid fa-forward"></i> +1 round</button>
          <button type="button" data-action="advanceTurn"><i class="fa-solid fa-clock"></i> +1 tour</button>
          <button type="button" data-action="advance10Minutes"><i class="fa-solid fa-clock-rotate-left"></i> +10 minutes</button>
          <button type="button" data-action="advanceHour"><i class="fa-solid fa-hourglass"></i> +1 heure</button>
          <button type="button" data-action="custom"><i class="fa-solid fa-sliders"></i> Personnalisé</button>
        </div>
        <button type="button" data-action="scan" style="width:100%;margin-top:8px;"><i class="fa-solid fa-magnifying-glass"></i> Scanner les expirations sans avancer</button>
        <div style="font-size:11px;color:#6d4c41;margin-top:8px;line-height:1.35;">
          Accès : barre d'outils gauche, à côté du bouton XP, ou console <code>game.add2e.time.open()</code>.
        </div>
      </div>`;
  }

  _replaceHTML(result, content, _options) { content.innerHTML = result; }

  static async _advanceSegment() { await add2eWorldTimeAdvance({ value: 1, unit: "segment", reason: "Bouton MJ : +1 segment" }); APP_INSTANCE?.render({ force: true }); }
  static async _advanceRound() { await add2eWorldTimeAdvance({ value: 1, unit: "round", reason: "Bouton MJ : +1 round" }); APP_INSTANCE?.render({ force: true }); }
  static async _advanceTurn() { await add2eWorldTimeAdvance({ value: 1, unit: "turn", reason: "Bouton MJ : +1 tour" }); APP_INSTANCE?.render({ force: true }); }
  static async _advance10Minutes() { await add2eWorldTimeAdvance({ value: 10, unit: "minute", reason: "Bouton MJ : +10 minutes" }); APP_INSTANCE?.render({ force: true }); }
  static async _advanceHour() { await add2eWorldTimeAdvance({ value: 1, unit: "hour", reason: "Bouton MJ : +1 heure" }); APP_INSTANCE?.render({ force: true }); }
  static async _custom() { const data = await askCustomAdvance(); if (!data) return; await add2eWorldTimeAdvance(data); APP_INSTANCE?.render({ force: true }); }
  static async _scan() { const result = await add2eWorldTimeExpireAllActors({ reason: "world-time-scan" }); ui.notifications?.info?.(`Scan temps ADD2E : ${result.deleted ?? 0} effet(s) expiré(s).`); APP_INSTANCE?.render({ force: true }); }
}

export function add2eOpenWorldTimeApplication() {
  if (!game.user?.isGM) {
    ui.notifications?.warn?.("Temps ADD2E : réservé au MJ.");
    return null;
  }
  APP_INSTANCE = APP_INSTANCE ?? new ADD2EWorldTimeApplication();
  APP_INSTANCE.render({ force: true });
  return APP_INSTANCE;
}

function registerSettingsMenu() {
  if (MENU_REGISTERED || !game.settings?.registerMenu) return false;
  try {
    if (!game.settings.menus?.has?.(`${SETTINGS_SCOPE}.${MENU_KEY}`)) {
      game.settings.registerMenu(SETTINGS_SCOPE, MENU_KEY, {
        name: "Temps ADD2E",
        label: "Ouvrir la gestion du temps",
        hint: "Avancer le temps hors combat et déclencher les expirations d'effets temporaires.",
        icon: "fas fa-hourglass-half",
        type: ADD2EWorldTimeApplication,
        restricted: true
      });
    }
    MENU_REGISTERED = true;
    return true;
  } catch (e) {
    warn("[SETTINGS_MENU_FAILED]", { e });
    return false;
  }
}

function timeToolDefinition() {
  const open = () => add2eOpenWorldTimeApplication();
  return {
    name: "add2e-world-time",
    title: "ADD2E — Temps",
    icon: "fas fa-hourglass-half",
    button: true,
    visible: game.user?.isGM === true,
    onChange: open,
    onClick: open
  };
}

function installOrReplaceTool(control) {
  if (!control) return false;
  const tool = timeToolDefinition();

  if (Array.isArray(control.tools)) {
    const index = control.tools.findIndex(t => t?.name === tool.name || t?.id === tool.name);
    if (index >= 0) control.tools[index] = tool;
    else control.tools.push(tool);
    return true;
  }

  if (control.tools instanceof Map) {
    control.tools.set(tool.name, tool);
    return true;
  }

  if (control.tools && typeof control.tools === "object") {
    control.tools[tool.name] = tool;
    return true;
  }

  control.tools = [tool];
  return true;
}

function installSceneButton(controls) {
  if (!game.user?.isGM) return;

  if (Array.isArray(controls)) {
    const tokenControl = controls.find(c => c?.name === "token" || c?.name === "tokens") ?? controls[0];
    installOrReplaceTool(tokenControl);
    return;
  }

  if (controls && typeof controls === "object") {
    const tokenControl = controls.token ?? controls.tokens ?? Object.values(controls).find(c => c?.name === "token" || c?.name === "tokens");
    if (installOrReplaceTool(tokenControl)) return;
    controls.add2e = controls.add2e ?? { name: "add2e", title: "ADD2E", icon: "fas fa-dragon", tools: [] };
    installOrReplaceTool(controls.add2e);
  }
}

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

  registerSettingsMenu();

  if (!HOOKS_REGISTERED) {
    HOOKS_REGISTERED = true;
    Hooks.on("getSceneControlButtons", installSceneButton);
  }

  log("[REGISTERED]", { version: ADD2E_WORLD_TIME_ENGINE_VERSION, tick: add2eTimeCurrentTick(), menu: MENU_REGISTERED, toolbar: "xp-style-left-controls" });
  return true;
}
