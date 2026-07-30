// scripts/add2e-action-hud.mjs
// ADD2E — Point d'entrée du HUD d'action rapide.
// Le cœur canonique possède seul les armes, attaques, sorts, équipements et capacités.

export {
  add2eRenderActionHud,
  add2eRefreshActionHud,
  add2eCloseActionHud
} from "./add2e-action-hud/core.mjs";

const ADD2E_HUD_COMPLEMENTS_VERSION = "2026-07-30-hud-passive-complements-v14";
const ADD2E_HUD_ID = "add2e-action-hud";
const ADD2E_HUD_COMPLEMENTS_STYLE_ID = "add2e-action-hud-complements-style";

let suppressMutation = false;
let bodyObserver = null;
let rootObserver = null;
let observedRoot = null;
let thiefRenderScheduled = false;
let thiefRendering = false;
let racialEffectsRenderScheduled = false;
let racialEffectsRendering = false;

function esc(value) {
  try {
    return foundry.utils.escapeHTML(String(value ?? ""));
  } catch (_error) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }
}

function currentHudActor() {
  const state = globalThis.add2eHudCheck?.();
  const actorId = state?.actorId;
  if (actorId) {
    const tokenActor = (canvas?.tokens?.controlled ?? []).find(token => token?.actor?.id === actorId)?.actor
      ?? (canvas?.tokens?.placeables ?? []).find(token => token?.actor?.id === actorId)?.actor
      ?? null;
    return tokenActor ?? game.actors?.get?.(actorId) ?? null;
  }
  if ((canvas?.tokens?.controlled ?? []).length === 1) return canvas.tokens.controlled[0]?.actor ?? null;
  return game.user?.character ?? null;
}

function ensureStyles() {
  if (document.getElementById(ADD2E_HUD_COMPLEMENTS_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = ADD2E_HUD_COMPLEMENTS_STYLE_ID;
  style.textContent = `
    #${ADD2E_HUD_ID} .a2e-hud-thief-activity{display:grid;gap:7px;padding:9px;border:1px solid rgba(214,176,90,.38);border-radius:10px;background:rgba(255,250,235,.07)}
    #${ADD2E_HUD_ID} .a2e-hud-thief-warning{border:2px solid #8b0000;background:rgba(255,70,70,.82);color:#111;text-align:center;font-weight:900;line-height:1.3}
    #${ADD2E_HUD_ID} .a2e-hud-thief-warning h3{margin:0;color:#111;font-size:1.08em}
    #${ADD2E_HUD_ID} .a2e-hud-racial-panel{display:grid;gap:6px;padding:7px;border:1px solid rgba(126,181,221,.74);border-radius:10px;background:rgba(41,81,125,.24)}
    #${ADD2E_HUD_ID} .a2e-hud-racial-title{color:#d9ebff;font-size:.82em;font-weight:950}
    #${ADD2E_HUD_ID} .a2e-hud-racial-row{border-color:rgba(126,181,221,.54);background:rgba(10,24,42,.24)}
    #${ADD2E_HUD_ID} .a2e-hud-racial-description{color:#d8e8fa;font-size:.78em;line-height:1.35;margin-top:3px}
  `;
  document.head.appendChild(style);
}

function withMutationSuppressed(callback) {
  suppressMutation = true;
  try {
    return callback();
  } finally {
    window.setTimeout(() => { suppressMutation = false; }, 0);
  }
}

function thiefActivityStatus(actor) {
  try {
    const status = globalThis.add2eGetThiefActivityEquipmentStatus?.(actor);
    if (status && typeof status === "object") return status;
  } catch (error) {
    console.warn("[ADD2E][HUD][VOLEUR][ACTIVITE]", error);
  }
  return { applies: false, ok: true, blockingItems: [], message: "" };
}

function thiefSignature(status) {
  return JSON.stringify({
    applies: status?.applies === true,
    ok: status?.ok !== false,
    message: status?.message ?? "",
    blockingItems: (status?.blockingItems ?? []).map(item => item?.name ?? "")
  });
}

function thiefWarningHtml(status) {
  const names = (status?.blockingItems ?? []).map(item => String(item?.name ?? "").trim()).filter(Boolean);
  const equipment = names.length
    ? `Équipement actuellement incompatible : <strong>${esc(names.join(", "))}</strong>.`
    : "Un équipement actuellement porté est incompatible avec les activités de voleur.";
  const message = esc(status?.message || "Les capacités de voleur ne peuvent pas être utilisées avec l’équipement actuellement porté.");
  return `<h3><i class="fas fa-triangle-exclamation"></i> Capacités de voleur indisponibles</h3><div>${message}</div><div style="font-size:.84em;">${equipment}</div>`;
}

function renderThiefActivity() {
  if (thiefRendering) return;
  const root = document.getElementById(ADD2E_HUD_ID);
  const actor = currentHudActor();
  const section = root?.querySelector?.('[data-section="capacites"]');
  if (!root || !actor || !section) return;
  const status = thiefActivityStatus(actor);
  const panels = [...section.querySelectorAll(':scope > .a2e-hud-thief-activity')];
  if (!status.applies || status.ok !== false) {
    panels.forEach(panel => panel.remove());
    return;
  }
  const signature = thiefSignature(status);
  if (panels.length === 1 && panels[0]?.dataset?.add2eHudThiefSignature === signature) return;
  thiefRendering = true;
  withMutationSuppressed(() => {
    panels.forEach(panel => panel.remove());
    const panel = document.createElement("div");
    panel.className = "a2e-hud-thief-activity a2e-hud-thief-warning";
    panel.dataset.add2eHudThiefSignature = signature;
    panel.innerHTML = thiefWarningHtml(status);
    section.prepend(panel);
  });
  thiefRendering = false;
}

function scheduleThiefActivity() {
  if (thiefRenderScheduled) return;
  thiefRenderScheduled = true;
  const raf = globalThis.requestAnimationFrame ?? (callback => window.setTimeout(callback, 16));
  raf(() => {
    thiefRenderScheduled = false;
    renderThiefActivity();
  });
}

function racialEngine() {
  const engine = globalThis.Add2eEffectsEngine;
  if (typeof engine?.getRacialPassiveEffects === "function") return engine;
  if (typeof engine?.getRacialVirtualEffects === "function") return engine;
  return null;
}

function racialPassives(actor) {
  const engine = racialEngine();
  if (!engine) return [];
  return engine.getRacialPassiveEffects?.(actor)
    ?? engine.getRacialVirtualEffects?.(actor)?.filter(effect => effect?.kind !== "capability")
    ?? [];
}

function racialEffectsSignature(actor, passives) {
  return JSON.stringify({
    actorId: actor?.id ?? "",
    passives: passives.map(effect => [effect.id, effect.name, effect.description, effect.duration])
  });
}

function racialPassiveRow(effect) {
  return `<div class="row effect-row a2e-hud-racial-row"><img src="${esc(effect.img || "icons/svg/aura.svg")}" alt=""><div><div class="title">${esc(effect.name)}</div><div class="meta"><span>${esc(effect.sourceName || "Race")}</span><span>${esc(effect.duration || "Permanent")}</span></div><div class="a2e-hud-racial-description">${esc(effect.description)}</div></div><span aria-hidden="true"></span></div>`;
}

function renderRacialEffects() {
  if (racialEffectsRendering) return;
  const root = document.getElementById(ADD2E_HUD_ID);
  const actor = currentHudActor();
  const section = root?.querySelector?.('[data-section="effets"]');
  if (!root || !actor || !section) return;
  const passives = racialPassives(actor);
  const existing = section.querySelector(':scope > .a2e-hud-racial-effects');
  if (!passives.length) {
    existing?.remove?.();
    return;
  }
  const signature = racialEffectsSignature(actor, passives);
  if (existing?.dataset?.add2eHudRacialSignature === signature) return;
  racialEffectsRendering = true;
  withMutationSuppressed(() => {
    ensureStyles();
    existing?.remove?.();
    const panel = document.createElement("div");
    panel.className = "a2e-hud-racial-panel a2e-hud-racial-effects";
    panel.dataset.add2eHudRacialSignature = signature;
    panel.innerHTML = `<div class="a2e-hud-racial-title"><i class="fas fa-dna"></i> Effets raciaux</div>${passives.map(racialPassiveRow).join("")}`;
    section.prepend(panel);
    for (const empty of section.querySelectorAll(':scope > .empty')) empty.remove();
  });
  racialEffectsRendering = false;
}

function scheduleRacialEffects() {
  if (racialEffectsRenderScheduled) return;
  racialEffectsRenderScheduled = true;
  const raf = globalThis.requestAnimationFrame ?? (callback => window.setTimeout(callback, 16));
  raf(() => {
    racialEffectsRenderScheduled = false;
    renderRacialEffects();
  });
}

function scheduleComplements() {
  scheduleThiefActivity();
  scheduleRacialEffects();
}

function observeHudRoot(root) {
  if (observedRoot === root) return;
  rootObserver?.disconnect?.();
  observedRoot = root ?? null;
  if (!root) return;
  rootObserver = new MutationObserver(() => {
    if (!suppressMutation) scheduleComplements();
  });
  rootObserver.observe(root, { childList: true, subtree: true });
}

function installHudComplements() {
  if (globalThis.__ADD2E_HUD_COMPLEMENTS === ADD2E_HUD_COMPLEMENTS_VERSION) return;
  globalThis.__ADD2E_HUD_COMPLEMENTS = ADD2E_HUD_COMPLEMENTS_VERSION;
  ensureStyles();

  bodyObserver = new MutationObserver(() => {
    if (suppressMutation) return;
    const root = document.getElementById(ADD2E_HUD_ID);
    if (!root) return;
    observeHudRoot(root);
    scheduleComplements();
  });
  bodyObserver.observe(document.body, { childList: true, subtree: true });

  const root = document.getElementById(ADD2E_HUD_ID);
  if (root) observeHudRoot(root);

  Hooks.on("updateActor", actor => {
    if (actor?.id === currentHudActor()?.id) scheduleComplements();
  });
  for (const hookName of ["createActiveEffect", "updateActiveEffect", "deleteActiveEffect"]) {
    Hooks.on(hookName, effect => {
      if (effect?.parent?.id === currentHudActor()?.id) scheduleComplements();
    });
  }

  const refresh = globalThis.add2eRefreshActionHud;
  if (typeof refresh === "function" && !refresh.__add2eHudComplements) {
    const wrapped = async function add2eRefreshActionHudWithComplements(...args) {
      const result = await refresh.apply(this, args);
      const currentRoot = document.getElementById(ADD2E_HUD_ID);
      if (currentRoot) observeHudRoot(currentRoot);
      scheduleComplements();
      return result;
    };
    wrapped.__add2eHudComplements = ADD2E_HUD_COMPLEMENTS_VERSION;
    globalThis.add2eRefreshActionHud = wrapped;
  }

  game.add2e ??= {};
  game.add2e.actionHudComplementsVersion = ADD2E_HUD_COMPLEMENTS_VERSION;
  scheduleComplements();
}

if (game?.ready) installHudComplements();
else Hooks.once("ready", installHudComplements);
