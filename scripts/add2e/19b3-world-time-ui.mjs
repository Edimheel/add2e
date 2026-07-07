// ============================================================================
// ADD2E — Temps hors combat : interface MJ ApplicationV2 / DialogV2.
// Compatible Foundry V13/V14/V15.
// ============================================================================
import { add2eTimeCurrentTick } from "./19a-time-engine.mjs";
import {
  add2eWorldTimeAdvance,
  add2eWorldTimeExpireAllActors
} from "./19b2-world-time-core.mjs";

export const ADD2E_WORLD_TIME_UI_VERSION = "2026-07-07-world-time-ui-day-week-v1";

const TOOL_NAME = "add2e-world-time";
let APP_INSTANCE = null;
let TOOLBAR_HOOK_REGISTERED = false;

async function askCustomAdvance() {
  const DialogV2 = foundry.applications?.api?.DialogV2;
  if (!DialogV2) {
    ui.notifications?.error?.("Temps ADD2E : DialogV2 introuvable.");
    return null;
  }
  return DialogV2.wait({
    window: { title: "Avancer le temps ADD2E" },
    content: `<form class="add2e-world-time-custom" style="display:flex;flex-direction:column;gap:8px;font-family:var(--font-primary);"><div class="form-group"><label style="font-weight:bold;">Valeur</label><input type="number" name="value" value="1" min="1" step="1" style="width:100%;"></div><div class="form-group"><label style="font-weight:bold;">Unité</label><select name="unit" style="width:100%;"><option value="segment">Segment</option><option value="round">Round</option><option value="turn">Tour</option><option value="minute">Minute</option><option value="hour">Heure</option><option value="day">Jour</option><option value="week">Semaine</option></select></div><div class="form-group"><label style="font-weight:bold;">Raison / note MJ</label><input type="text" name="reason" value="" style="width:100%;" placeholder="Exploration, voyage, fouille, repos..."></div></form>`,
    buttons: [
      {
        action: "advance",
        label: "Avancer",
        icon: "fa-solid fa-clock",
        default: true,
        callback: (_event, button) => ({
          value: Number(button.form.elements.value?.value || 1),
          unit: String(button.form.elements.unit?.value || "round"),
          reason: String(button.form.elements.reason?.value || "")
        })
      },
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
      advanceDay: ADD2EWorldTimeApplication._advanceDay,
      advanceWeek: ADD2EWorldTimeApplication._advanceWeek,
      custom: ADD2EWorldTimeApplication._custom,
      scan: ADD2EWorldTimeApplication._scan
    }
  };

  async _renderHTML() {
    const tick = add2eTimeCurrentTick();
    return `<div class="add2e-world-time" style="padding:10px;font-family:var(--font-primary);"><div style="border:1px solid #8d6e63;border-radius:8px;background:#fffaf4;padding:8px;margin-bottom:8px;text-align:center;"><div style="font-weight:900;color:#4e342e;font-size:15px;">Temps ADD2E hors combat</div><div style="font-size:12px;color:#6d4c41;margin-top:4px;">Tick global actuel : <b>${tick}</b> round(s)</div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;"><button type="button" data-action="advanceSegment"><i class="fa-solid fa-forward-step"></i> +1 segment</button><button type="button" data-action="advanceRound"><i class="fa-solid fa-forward"></i> +1 round</button><button type="button" data-action="advanceTurn"><i class="fa-solid fa-clock"></i> +1 tour</button><button type="button" data-action="advance10Minutes"><i class="fa-solid fa-clock-rotate-left"></i> +10 minutes</button><button type="button" data-action="advanceHour"><i class="fa-solid fa-hourglass"></i> +1 heure</button><button type="button" data-action="advanceDay"><i class="fa-solid fa-sun"></i> +1 jour</button><button type="button" data-action="advanceWeek"><i class="fa-solid fa-calendar-week"></i> +1 semaine</button><button type="button" data-action="custom"><i class="fa-solid fa-sliders"></i> Personnalisé</button></div><button type="button" data-action="scan" style="width:100%;margin-top:8px;"><i class="fa-solid fa-magnifying-glass"></i> Scanner les expirations sans avancer</button><div style="font-size:11px;color:#6d4c41;margin-top:8px;line-height:1.35;">Bouton barre gauche : modèle XP. Console : <code>game.add2e.time.open()</code>.</div></div>`;
  }

  _replaceHTML(result, content) { content.innerHTML = result; }

  static async _advanceSegment() {
    await add2eWorldTimeAdvance({ value: 1, unit: "segment", reason: "Bouton MJ : +1 segment" });
    APP_INSTANCE?.render({ force: true });
  }

  static async _advanceRound() {
    await add2eWorldTimeAdvance({ value: 1, unit: "round", reason: "Bouton MJ : +1 round" });
    APP_INSTANCE?.render({ force: true });
  }

  static async _advanceTurn() {
    await add2eWorldTimeAdvance({ value: 1, unit: "turn", reason: "Bouton MJ : +1 tour" });
    APP_INSTANCE?.render({ force: true });
  }

  static async _advance10Minutes() {
    await add2eWorldTimeAdvance({ value: 10, unit: "minute", reason: "Bouton MJ : +10 minutes" });
    APP_INSTANCE?.render({ force: true });
  }

  static async _advanceHour() {
    await add2eWorldTimeAdvance({ value: 1, unit: "hour", reason: "Bouton MJ : +1 heure" });
    APP_INSTANCE?.render({ force: true });
  }

  static async _advanceDay() {
    await add2eWorldTimeAdvance({ value: 1, unit: "day", reason: "Bouton MJ : +1 jour" });
    APP_INSTANCE?.render({ force: true });
  }

  static async _advanceWeek() {
    await add2eWorldTimeAdvance({ value: 1, unit: "week", reason: "Bouton MJ : +1 semaine" });
    APP_INSTANCE?.render({ force: true });
  }

  static async _custom() {
    const data = await askCustomAdvance();
    if (!data) return;
    await add2eWorldTimeAdvance(data);
    APP_INSTANCE?.render({ force: true });
  }

  static async _scan() {
    const result = await add2eWorldTimeExpireAllActors({ reason: "world-time-scan" });
    ui.notifications?.info?.(`Scan temps ADD2E : ${result.deleted ?? 0} effet(s) expiré(s).`);
    APP_INSTANCE?.render({ force: true });
  }
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

function openWorldTimeFromTool() {
  add2eOpenWorldTimeApplication();
}

function worldTimeToolDefinition() {
  return {
    name: TOOL_NAME,
    title: "ADD2E — Temps",
    icon: "fas fa-hourglass-half",
    button: true,
    visible: game.user?.isGM === true,
    onChange: openWorldTimeFromTool
  };
}

function installToolInControl(control, tool = worldTimeToolDefinition()) {
  if (!control) return false;
  if (Array.isArray(control.tools)) {
    const existing = control.tools.find(entry => entry?.name === tool.name || entry?.id === tool.name);
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

export function add2eInstallWorldTimeSceneButton(controls) {
  const tool = worldTimeToolDefinition();
  if (Array.isArray(controls)) {
    const tokenControl = controls.find(control => control?.name === "token" || control?.name === "tokens") ?? controls[0];
    if (installToolInControl(tokenControl, tool)) return;
    controls.push({ name: "add2e", title: "ADD2E", icon: "fas fa-dragon", tools: [tool], activeTool: tool.name });
    return;
  }
  if (controls && typeof controls === "object") {
    const tokenControl = controls.token ?? controls.tokens ?? Object.values(controls).find(control => control?.name === "token" || control?.name === "tokens");
    if (installToolInControl(tokenControl, tool)) return;
    controls.add2e = controls.add2e ?? { name: "add2e", title: "ADD2E", icon: "fas fa-dragon", tools: {} };
    installToolInControl(controls.add2e, tool);
  }
}

export function add2eRegisterWorldTimeUi() {
  if (TOOLBAR_HOOK_REGISTERED) return false;
  TOOLBAR_HOOK_REGISTERED = true;
  Hooks.on("getSceneControlButtons", add2eInstallWorldTimeSceneButton);
  return true;
}
