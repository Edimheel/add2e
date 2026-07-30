// scripts/add2e-action-hud.mjs
// ADD2E — Point d'entrée du HUD d'action rapide.
// Le cœur canonique possède seul les armes, attaques, sorts et équipements.

export {
  add2eRenderActionHud,
  add2eRefreshActionHud,
  add2eCloseActionHud
} from "./add2e-action-hud/core.mjs";

const ADD2E_HUD_COMPLEMENTS_VERSION = "2026-07-30-hud-complements-only-v12";
const ADD2E_HUD_ID = "add2e-action-hud";
const ADD2E_HUD_COMPLEMENTS_STYLE_ID = "add2e-action-hud-complements-style";

let suppressMutation = false;
let bodyObserver = null;
let rootObserver = null;
let observedRoot = null;
let thiefRenderScheduled = false;
let thiefRendering = false;
let familiarRenderScheduled = false;
let familiarRendering = false;
let racialRenderScheduled = false;
let racialRendering = false;

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
    #${ADD2E_HUD_ID} .a2e-hud-familiar-actions{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:7px 8px;border:1px solid rgba(113,155,218,.7);border-radius:10px;background:rgba(58,88,136,.22)}
    #${ADD2E_HUD_ID} .a2e-hud-familiar-actions-title{flex:1 1 100%;color:#d9ebff;font-size:.82em;font-weight:900}
    #${ADD2E_HUD_ID} .a2e-hud-familiar-action{display:inline-flex;align-items:center;gap:5px;min-height:30px;padding:5px 9px;border:1px solid rgba(152,194,255,.75);border-radius:8px;background:rgba(90,136,204,.32);color:#eff7ff;font-size:.8em;font-weight:900;cursor:pointer}
    #${ADD2E_HUD_ID} .a2e-hud-familiar-action:hover{filter:brightness(1.2)}
    #${ADD2E_HUD_ID} .a2e-hud-racial-panel{display:grid;gap:6px;padding:7px;border:1px solid rgba(126,181,221,.74);border-radius:10px;background:rgba(41,81,125,.24)}
    #${ADD2E_HUD_ID} .a2e-hud-racial-title{color:#d9ebff;font-size:.82em;font-weight:950}
    #${ADD2E_HUD_ID} .a2e-hud-racial-row{border-color:rgba(126,181,221,.54);background:rgba(10,24,42,.24)}
    #${ADD2E_HUD_ID} .a2e-hud-racial-icon{color:#e8f4ff;border-color:rgba(152,194,255,.85);background:rgba(64,116,175,.35)}
    #${ADD2E_HUD_ID} .a2e-hud-racial-icon i{font-size:1.25em}
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

function familiarEffectData(effect) {
  return effect?.flags?.add2e?.familiar ?? effect?.getFlag?.("add2e", "familiar") ?? null;
}

function familiarActionEffects(actor) {
  return Array.from(actor?.effects ?? [])
    .filter(effect => effect?.disabled !== true && effect?.isSuppressed !== true)
    .map(effect => ({ effect, data: familiarEffectData(effect) }))
    .filter(({ data }) => data?.kind === "action" && ["share-senses", "toggle-follow"].includes(String(data.action ?? "")));
}

function familiarActionInfo(data = {}) {
  if (data.action === "share-senses") return { icon: "fa-eye", label: "Vision partagée", title: "Voir avec les sens du familier" };
  return { icon: "fa-link", label: "Suivi", title: "Activer ou désactiver le suivi automatique" };
}

function familiarSignature(actor, rows) {
  return JSON.stringify({
    actorId: actor?.id ?? "",
    rows: rows.map(({ effect, data }) => ({
      id: effect?.id ?? effect?._id ?? "",
      action: data?.action ?? "",
      name: effect?.name ?? "",
      description: effect?.description ?? ""
    }))
  });
}

function familiarHtml(actor, rows) {
  const controls = rows.map(({ effect, data }) => {
    const info = familiarActionInfo(data);
    return `<button type="button" class="a2e-hud-familiar-action a2e-familiar-effect-action" data-actor-id="${esc(actor.id)}" data-effect-id="${esc(effect.id ?? effect._id ?? "")}" data-familiar-action="${esc(data.action)}" title="${esc(info.title)}"><i class="fas ${info.icon}"></i> ${esc(info.label)}</button>`;
  }).join("");
  return `<div class="a2e-hud-familiar-actions-title"><i class="fas fa-paw"></i> Commandes du familier</div>${controls}`;
}

function renderFamiliarActions() {
  if (familiarRendering) return;
  const root = document.getElementById(ADD2E_HUD_ID);
  const actor = currentHudActor();
  const section = root?.querySelector?.('[data-section="effets"]');
  if (!root || !actor || !section) return;
  const rows = familiarActionEffects(actor);
  const existing = section.querySelector(':scope > .a2e-hud-familiar-actions');
  if (!rows.length) {
    existing?.remove?.();
    return;
  }
  const signature = familiarSignature(actor, rows);
  if (existing?.dataset?.add2eHudFamiliarSignature === signature) return;
  familiarRendering = true;
  withMutationSuppressed(() => {
    ensureStyles();
    existing?.remove?.();
    const panel = document.createElement("div");
    panel.className = "a2e-hud-familiar-actions";
    panel.dataset.add2eHudFamiliarSignature = signature;
    panel.innerHTML = familiarHtml(actor, rows);
    section.prepend(panel);
  });
  familiarRendering = false;
}

function scheduleFamiliarActions() {
  if (familiarRenderScheduled) return;
  familiarRenderScheduled = true;
  const raf = globalThis.requestAnimationFrame ?? (callback => window.setTimeout(callback, 16));
  raf(() => {
    familiarRenderScheduled = false;
    renderFamiliarActions();
  });
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
  return typeof engine?.getRacialActions === "function" ? engine : null;
}

function racialPassives(actor) {
  const engine = racialEngine();
  if (!engine) return [];
  return engine.getRacialPassiveEffects?.(actor)
    ?? engine.getRacialVirtualEffects?.(actor)?.filter(effect => effect?.kind !== "capability")
    ?? [];
}

function racialCapabilities(actor) {
  return racialEngine()?.getRacialActions?.(actor)?.filter(capability => capability?.activable !== false) ?? [];
}

function racialIcon(capability) {
  const explicit = String(capability?.iconClass ?? "").trim();
  if (explicit) return explicit;
  const key = String(capability?.id ?? capability?.label ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (key.includes("infravision") || key.includes("vision")) return "fa-eye";
  if (key.includes("porte")) return "fa-door-closed";
  if (key.includes("pente")) return "fa-mountain";
  if (key.includes("direction") || key.includes("profondeur")) return "fa-compass";
  if (key.includes("paroi") || key.includes("construction")) return "fa-hammer";
  if (key.includes("piege")) return "fa-triangle-exclamation";
  if (key.includes("surprise")) return "fa-user-ninja";
  return "fa-dice-d20";
}

function racialRequirementLabel(value) {
  return {
    within_three_meters: "à 3 m ou moins",
    search_active: "recherche active",
    underground: "sous terre",
    concentration: "concentration",
    alone: "isolé",
    no_metal_armor: "sans armure de métal",
    opens_door: "après ouverture d’une porte",
    no_intense_light: "aucune lumière ou chaleur intense"
  }[String(value ?? "").trim()] ?? String(value ?? "").replaceAll("_", " ");
}

function racialRequirements(capability) {
  const value = capability?.requires;
  const raw = Array.isArray(value) ? value : (value instanceof Set ? [...value] : (value ? Object.values(value) : []));
  return raw.map(racialRequirementLabel).filter(Boolean);
}

function racialSignature(actor, passives, capabilities) {
  return JSON.stringify({
    actorId: actor?.id ?? "",
    passives: passives.map(effect => [effect.id, effect.name, effect.description]),
    capabilities: capabilities.map(capability => [capability.id, capability.label, capability.description, capability.formula, capability.successAt, capability.requires, capability.actionType, capability.enabled])
  });
}

function racialPassiveRow(effect) {
  return `<div class="row effect-row a2e-hud-racial-row"><img src="${esc(effect.img || "icons/svg/aura.svg")}" alt=""><div><div class="title">${esc(effect.name)}</div><div class="meta"><span>${esc(effect.sourceName || "Race")}</span><span>${esc(effect.duration || "Permanent")}</span></div><div class="a2e-hud-racial-description">${esc(effect.description)}</div></div><span aria-hidden="true"></span></div>`;
}

function racialCapabilityRow(capability) {
  const isVisionToggle = capability?.actionType === "vision-toggle";
  const conditions = (!isVisionToggle || capability?.enabled !== true) ? racialRequirements(capability) : [];
  const state = isVisionToggle
    ? (capability?.enabled ? "Active" : "Inactive")
    : (capability?.canRoll ? `Jet ${capability.formula} : réussite ≤ ${capability.successAt}` : "Capacité narrative");
  const conditionLabel = conditions.length ? `<span>Conditions : ${esc(conditions.join(", "))}</span>` : "";
  const title = isVisionToggle
    ? `${capability?.enabled ? "Désactiver" : "Activer"} ${capability.label}`
    : (capability.canRoll ? `Lancer ${capability.label}` : capability.label);
  const icon = isVisionToggle && capability?.enabled ? "fa-eye-slash" : racialIcon(capability);
  const control = (isVisionToggle || capability.canRoll)
    ? `<button type="button" class="img-act a2e-hud-racial-icon" data-add2e-hud-racial-action="use" data-racial-capability-id="${esc(capability.id)}" title="${esc(title)}"><i class="fas ${icon}"></i></button>`
    : '<span aria-hidden="true"></span>';
  return `<div class="row a2e-hud-racial-row">${control}<div><div class="title">${esc(capability.label)}</div><div class="meta"><span>Capacité raciale</span><span>${esc(state)}</span>${conditionLabel}</div><div class="a2e-hud-racial-description">${esc(capability.description)}</div></div></div>`;
}

function renderRacialPanels() {
  if (racialRendering) return;
  const root = document.getElementById(ADD2E_HUD_ID);
  const actor = currentHudActor();
  const engine = racialEngine();
  if (!root || !actor || !engine) return;
  const passives = racialPassives(actor);
  const capabilities = racialCapabilities(actor);
  const signature = racialSignature(actor, passives, capabilities);

  racialRendering = true;
  withMutationSuppressed(() => {
    ensureStyles();
    const effectsSection = root.querySelector('[data-section="effets"]');
    if (effectsSection) {
      const existing = effectsSection.querySelector(':scope > .a2e-hud-racial-effects');
      if (!passives.length) existing?.remove?.();
      else if (existing?.dataset?.add2eHudRacialSignature !== signature) {
        existing?.remove?.();
        const panel = document.createElement("div");
        panel.className = "a2e-hud-racial-panel a2e-hud-racial-effects";
        panel.dataset.add2eHudRacialSignature = signature;
        panel.innerHTML = `<div class="a2e-hud-racial-title"><i class="fas fa-dna"></i> Effets raciaux</div>${passives.map(racialPassiveRow).join("")}`;
        effectsSection.prepend(panel);
        for (const empty of effectsSection.querySelectorAll(':scope > .empty')) empty.remove();
      }
    }

    const capabilitiesSection = root.querySelector('[data-section="capacites"]');
    if (capabilitiesSection) {
      const existing = capabilitiesSection.querySelector(':scope > .a2e-hud-racial-capabilities');
      if (!capabilities.length) existing?.remove?.();
      else if (existing?.dataset?.add2eHudRacialSignature !== signature) {
        existing?.remove?.();
        const panel = document.createElement("div");
        panel.className = "a2e-hud-racial-panel a2e-hud-racial-capabilities";
        panel.dataset.add2eHudRacialSignature = signature;
        panel.innerHTML = `<div class="a2e-hud-racial-title"><i class="fas fa-dna"></i> Capacités raciales</div>${capabilities.map(racialCapabilityRow).join("")}`;
        capabilitiesSection.prepend(panel);
        for (const empty of capabilitiesSection.querySelectorAll(':scope > .empty')) empty.remove();
      }
    }
  });
  racialRendering = false;
}

function scheduleRacialPanels() {
  if (racialRenderScheduled) return;
  racialRenderScheduled = true;
  const raf = globalThis.requestAnimationFrame ?? (callback => window.setTimeout(callback, 16));
  raf(() => {
    racialRenderScheduled = false;
    renderRacialPanels();
  });
}

async function runRacialCapability(actor, capabilityId) {
  const use = globalThis.add2eUseRacialCapabilityFromElement;
  if (typeof use !== "function") {
    ui.notifications?.error?.("Le contrôleur des capacités raciales de la feuille n’est pas chargé.");
    return false;
  }
  const relay = document.createElement("button");
  relay.dataset.racialCapabilityId = String(capabilityId ?? "");
  return use(actor, relay, null);
}

function scheduleComplements() {
  scheduleThiefActivity();
  scheduleFamiliarActions();
  scheduleRacialPanels();
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

  document.addEventListener("click", async event => {
    const racial = event.target?.closest?.("[data-add2e-hud-racial-action][data-racial-capability-id]");
    if (!racial) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    const actor = currentHudActor();
    if (!actor) return ui.notifications?.warn?.("Acteur HUD introuvable.");
    await runRacialCapability(actor, racial.dataset.racialCapabilityId);
    scheduleRacialPanels();
  }, true);

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
