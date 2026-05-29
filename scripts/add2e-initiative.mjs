// scripts/add2e-initiative.mjs
// ADD2E — Initiative indépendante.
// Règle gérée ici : initiative simple au d6, ordre ascendant.
// Surprise volontairement non gérée dans ce module.

const ADD2E_INITIATIVE_VERSION = "2026-05-29-init-turn-lock-clear-move-history-v4";
const TAG = "[ADD2E][INIT]";
const ADD2E_INITIATIVE_D6_ICON = "systems/add2e/assets/D6_3D_tracker.png";

const ADD2E_TURN_LOCK_VERSION = "2026-05-29-turn-lock-clear-move-history-v4";
const ADD2E_INIT_CHAT_CARD_VERSION = "2026-05-28-init-chat-card-v1";

globalThis.ADD2E_INITIATIVE_VERSION = ADD2E_INITIATIVE_VERSION;
globalThis.ADD2E_TURN_LOCK_VERSION = ADD2E_TURN_LOCK_VERSION;
globalThis.ADD2E_INIT_CHAT_CARD_VERSION = ADD2E_INIT_CHAT_CARD_VERSION;

let add2eInitiativeSortRunning = false;
let add2eInitiativeSortTimer = null;
let add2eInitiativeConfigured = false;
let add2eLegacyHooksCleaned = false;
let add2eTurnWarningAt = 0;

function add2eConfigureInitiative() {
  if (add2eInitiativeConfigured) return;
  add2eInitiativeConfigured = true;

  CONFIG.Combat ??= {};
  CONFIG.Combat.initiative = {
    formula: "1d6",
    decimals: 2
  };

  console.log(`${TAG}[CONFIG]`, {
    version: ADD2E_INITIATIVE_VERSION,
    formula: CONFIG.Combat.initiative.formula,
    order: "ascending",
    surprise: "not-managed"
  });
}

function add2eHookFnSource(entry) {
  const fn = entry?.fn ?? entry?.callback ?? entry;
  if (typeof fn !== "function") return "";
  try { return Function.prototype.toString.call(fn); }
  catch (_e) { return ""; }
}

function add2eRemoveLegacyInitiativeHooksFromStore(store) {
  if (!store || typeof store !== "object") return 0;

  let removed = 0;
  for (const hookName of ["updateCombatant", "updateCombat"]) {
    let entries = store[hookName];
    if (!Array.isArray(entries)) continue;

    const before = entries.length;
    entries = entries.filter(entry => {
      const src = add2eHookFnSource(entry);
      const isLegacyInitiativeHook =
        src.includes("triInitiativeAscendant") ||
        src.includes("game.combat.combatants.contents.slice().sort") ||
        src.includes("updateEmbeddedDocuments(\"Combatant\"");
      return !isLegacyInitiativeHook;
    });

    removed += before - entries.length;
    store[hookName] = entries;
  }

  return removed;
}

function add2eRemoveLegacyInitiativeHooks() {
  if (add2eLegacyHooksCleaned) return 0;
  add2eLegacyHooksCleaned = true;

  let removed = 0;
  try { removed += add2eRemoveLegacyInitiativeHooksFromStore(Hooks.events); } catch (_e) {}
  try { removed += add2eRemoveLegacyInitiativeHooksFromStore(Hooks._hooks); } catch (_e) {}

  console.log(`${TAG}[LEGACY_HOOKS_CLEAN]`, { version: ADD2E_INITIATIVE_VERSION, removed });
  return removed;
}

function add2eInitiativeNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function add2eSortInitiativeAscending(combat = game.combat) {
  if (!combat || add2eInitiativeSortRunning) return false;

  const combatants = Array.from(combat.combatants ?? []);
  if (!combatants.length) return false;

  const sorted = combatants.slice().sort((a, b) => {
    const ai = add2eInitiativeNumber(a.initiative);
    const bi = add2eInitiativeNumber(b.initiative);

    if (ai === null && bi === null) return 0;
    if (ai === null) return 1;
    if (bi === null) return -1;
    if (ai !== bi) return ai - bi;

    return String(a.id).localeCompare(String(b.id));
  });

  const updates = sorted
    .map((combatant, index) => ({ _id: combatant.id, sort: index }))
    .filter(update => {
      const current = combatants.find(c => c.id === update._id);
      return current && Number(current.sort) !== Number(update.sort);
    });

  if (!updates.length) return false;

  add2eInitiativeSortRunning = true;
  try {
    console.log(`${TAG}[SORT_ASC]`, {
      combat: combat.id,
      order: sorted.map(c => ({ id: c.id, name: c.name, initiative: c.initiative, sort: c.sort }))
    });

    await combat.updateEmbeddedDocuments("Combatant", updates, { add2eInitiativeSort: true });
    ui.combat?.render?.(true);
    return true;
  } catch (err) {
    console.error(`${TAG}[SORT_ASC][ERROR]`, err);
    return false;
  } finally {
    add2eInitiativeSortRunning = false;
  }
}

function add2eScheduleInitiativeSort(combat = game.combat) {
  if (!combat) return;
  clearTimeout(add2eInitiativeSortTimer);
  add2eInitiativeSortTimer = setTimeout(() => add2eSortInitiativeAscending(combat), 100);
}

function add2eEscapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = String(value ?? "");
  return div.innerHTML;
}

function add2eSpeakerActor(speaker = {}) {
  if (speaker.token && canvas?.tokens?.get) {
    const token = canvas.tokens.get(speaker.token);
    if (token?.actor) return token.actor;
  }
  if (speaker.actor) return game.actors?.get?.(speaker.actor) ?? null;
  return null;
}

function add2eSpeakerToken(speaker = {}) {
  if (!speaker.token || !canvas?.tokens?.get) return null;
  return canvas.tokens.get(speaker.token) ?? null;
}

function add2eLooksLikeInitiativeMessage(message, data = {}) {
  const flags = data.flags ?? message?.flags ?? {};
  const flavor = String(data.flavor ?? message?.flavor ?? "").toLowerCase();
  const speaker = data.speaker ?? message?.speaker ?? {};
  const rolls = data.rolls ?? message?.rolls ?? [];
  const firstRoll = rolls?.[0] ?? null;
  const formula = String(firstRoll?.formula ?? firstRoll?._formula ?? "").toLowerCase();

  if (flags?.core?.initiativeRoll || flags?.add2e?.initiativeRoll) return true;
  if (flavor.includes("initiative")) return true;
  if (formula === "1d6" && speaker?.actor && game.combat?.combatants?.some?.(c => c.actor?.id === speaker.actor)) return true;
  return false;
}

function add2eInitiativeRollTotal(message, data = {}) {
  const roll = (data.rolls ?? message?.rolls ?? [])?.[0] ?? null;
  const total = Number(roll?.total ?? roll?._total);
  return Number.isFinite(total) ? total : null;
}

function add2eBuildInitiativeChatContent(message, data = {}) {
  const speaker = data.speaker ?? message?.speaker ?? {};
  const actor = add2eSpeakerActor(speaker);
  const token = add2eSpeakerToken(speaker);
  const name = token?.name ?? actor?.name ?? speaker.alias ?? "Combattant";
  const img = token?.document?.texture?.src ?? actor?.img ?? ADD2E_INITIATIVE_D6_ICON;
  const total = add2eInitiativeRollTotal(message, data);
  const result = total === null ? "—" : total;

  return `
    <div class="add2e-init-chat-card" style="border:1px solid #7c4a16;border-radius:10px;background:linear-gradient(135deg,#2a1708,#4b2a0e);color:#f7ead2;padding:10px 12px;box-shadow:0 2px 8px rgba(0,0,0,.35);font-family:serif;">
      <div style="display:flex;align-items:center;gap:10px;">
        <img src="${add2eEscapeHtml(img)}" alt="" style="width:42px;height:42px;border-radius:8px;object-fit:cover;border:1px solid rgba(255,255,255,.25);background:#111;">
        <div style="flex:1;min-width:0;">
          <div style="font-size:15px;font-weight:700;letter-spacing:.03em;text-transform:uppercase;color:#ffd891;">Initiative</div>
          <div style="font-size:18px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${add2eEscapeHtml(name)}</div>
        </div>
        <div style="text-align:center;min-width:58px;background:rgba(255,255,255,.12);border:1px solid rgba(255,216,145,.35);border-radius:8px;padding:5px 8px;">
          <div style="font-size:11px;text-transform:uppercase;color:#ffd891;">D6</div>
          <div style="font-size:26px;line-height:1;font-weight:900;color:#ffffff;">${add2eEscapeHtml(result)}</div>
        </div>
      </div>
      <div style="margin-top:8px;font-size:12px;color:#ead6b0;display:flex;justify-content:space-between;gap:10px;">
        <span>Ordre ADD2E : initiative basse en premier.</span>
        <span style="white-space:nowrap;">1d6</span>
      </div>
    </div>`;
}

function add2eInstallInitiativeChatCard() {
  if (globalThis.__ADD2E_INIT_CHAT_CARD_INSTALLED === ADD2E_INIT_CHAT_CARD_VERSION) return;
  globalThis.__ADD2E_INIT_CHAT_CARD_INSTALLED = ADD2E_INIT_CHAT_CARD_VERSION;

  Hooks.on("preCreateChatMessage", (message, data, options, userId) => {
    try {
      if (!add2eLooksLikeInitiativeMessage(message, data)) return;
      const content = add2eBuildInitiativeChatContent(message, data);
      message.updateSource?.({
        content,
        flavor: "Initiative ADD2E",
        "flags.add2e.initiativeRoll": true,
        "flags.add2e.initiativeChatCardVersion": ADD2E_INIT_CHAT_CARD_VERSION
      });
    } catch (err) {
      console.warn(`${TAG}[CHAT_CARD][ERROR]`, err);
    }
  });
}

function add2eIsCombatActive(combat = game.combat) {
  return Boolean(combat && combat.started && combat.combatant);
}

function add2eCombatantMatchesActor(combatant, actor) {
  if (!combatant || !actor) return false;
  if (combatant.actor?.id && combatant.actor.id === actor.id) return true;
  if (combatant.actorId && combatant.actorId === actor.id) return true;
  return false;
}

function add2eCombatantMatchesToken(combatant, tokenDocument) {
  if (!combatant || !tokenDocument) return false;
  if (combatant.tokenId && combatant.tokenId === tokenDocument.id) return true;
  if (combatant.token?.id && combatant.token.id === tokenDocument.id) return true;
  const actor = tokenDocument.actor ?? tokenDocument.object?.actor ?? null;
  return add2eCombatantMatchesActor(combatant, actor);
}

function add2eCanActorActNow(actor, { notify = false } = {}) {
  const combat = game.combat;
  if (!add2eIsCombatActive(combat)) return true;
  if (game.user?.isGM) return true;
  if (add2eCombatantMatchesActor(combat.combatant, actor)) return true;

  if (notify) add2eNotifyNotTurn(actor);
  return false;
}

function add2eCanTokenActNow(tokenDocument, { notify = false } = {}) {
  const combat = game.combat;
  if (!add2eIsCombatActive(combat)) return true;
  if (game.user?.isGM) return true;
  if (add2eCombatantMatchesToken(combat.combatant, tokenDocument)) return true;

  if (notify) add2eNotifyNotTurn(tokenDocument?.actor ?? tokenDocument?.object?.actor ?? null);
  return false;
}

function add2eNotifyNotTurn(actor = null) {
  const now = Date.now();
  if (now - add2eTurnWarningAt < 900) return;
  add2eTurnWarningAt = now;
  const current = game.combat?.combatant;
  const currentName = current?.name ?? current?.actor?.name ?? "l'acteur actif";
  const actorName = actor?.name ? `${actor.name} ne peut pas agir.` : "Ce token ne peut pas agir.";
  ui.notifications?.info?.(`${actorName} C'est le tour de ${currentName}.`);
}

function add2eResolveActionActor(argsLike) {
  const args = Array.isArray(argsLike) ? argsLike : [];
  const first = args[0] ?? null;
  const source = first && typeof first === "object" ? first : {};
  if (source.actor) return source.actor;
  if (source.actorId) return game.actors?.get?.(source.actorId) ?? null;
  if (source.token?.actor) return source.token.actor;
  if (source.tokenId && canvas?.tokens?.get?.(source.tokenId)?.actor) return canvas.tokens.get(source.tokenId).actor;
  return canvas?.tokens?.controlled?.[0]?.actor ?? game.user?.character ?? null;
}

function add2eHasMovementChange(changes = {}) {
  return ["x", "y", "elevation", "rotation"].some(path => foundry.utils.hasProperty(changes, path));
}

function add2eClearObjectMovementState(obj) {
  if (!obj || typeof obj !== "object") return;
  const clearArrayKeys = [
    "movementHistory", "movement", "path", "waypoints", "segments",
    "_movementHistory", "_movement", "_path", "_waypoints", "_segments",
    "_dragPath", "_rulerPath", "_movementPath", "_previewPath"
  ];

  for (const key of clearArrayKeys) {
    try {
      if (Array.isArray(obj[key])) obj[key].length = 0;
      else if (obj[key]?.clear instanceof Function) obj[key].clear();
    } catch (_e) {}
  }

  for (const key of ["_preview", "preview", "_dragRuler", "dragRuler", "_movementPreview", "movementPreview"]) {
    try {
      if (obj[key]?.clear instanceof Function) obj[key].clear();
      else if (obj[key]?.destroy instanceof Function) obj[key].destroy({ children: true });
      obj[key] = null;
    } catch (_e) {}
  }
}

function add2eClearMovementHighlightLayers() {
  const layerNames = ["movement", "move", "ruler", "ruler-history", "movement-history", "token-movement", "token-ruler", "drag-ruler", "add2e-movement"];
  for (const name of layerNames) {
    try { canvas?.interface?.grid?.clearHighlightLayer?.(name); } catch (_e) {}
    try { canvas?.grid?.clearHighlightLayer?.(name); } catch (_e) {}
  }
}

function add2eClearRulerState() {
  try {
    const ruler = canvas?.controls?.ruler;
    add2eClearObjectMovementState(ruler);
    ruler?.clear?.();
    ruler?._endMeasurement?.();
    ruler?._onMouseUp?.({});
    ruler?.renderFlags?.set?.({ refresh: true });
  } catch (_e) {}
}

function add2eClearTokenMovementHistory(tokenDocument = null) {
  const targetToken = tokenDocument?.object ?? canvas?.tokens?.get?.(tokenDocument?.id) ?? null;
  const tokens = targetToken ? [targetToken] : Array.from(canvas?.tokens?.placeables ?? []);

  for (const token of tokens) {
    try {
      add2eClearObjectMovementState(token);
      add2eClearObjectMovementState(token?.document);
      token?._onDragLeftCancel?.({});
      token?.mouseInteractionManager?.cancel?.();
      token?.renderFlags?.set?.({ refresh: true, refreshPosition: true });
      token?.refresh?.();
    } catch (_e) {}
  }

  add2eClearRulerState();
  add2eClearMovementHighlightLayers();
  try { canvas?.controls?.clear?.(); } catch (_e) {}
  try { canvas?.perception?.update?.({ refresh: true }, true); } catch (_e) {}
}

function add2eClearDeniedMovementPreview(tokenDocument = null) {
  window.setTimeout(() => add2eClearTokenMovementHistory(tokenDocument), 0);
}

function add2eInstallMovementTurnLock() {
  if (globalThis.__ADD2E_TURN_LOCK_MOVEMENT_INSTALLED === ADD2E_TURN_LOCK_VERSION) return;
  globalThis.__ADD2E_TURN_LOCK_MOVEMENT_INSTALLED = ADD2E_TURN_LOCK_VERSION;

  Hooks.on("preUpdateToken", (tokenDocument, changes, options, userId) => {
    try {
      if (userId !== game.user?.id) return;
      if (!add2eHasMovementChange(changes)) return;
      if (options?.add2eAllowOutOfTurn || options?.add2eIgnoreTurnLock) return;
      if (add2eCanTokenActNow(tokenDocument, { notify: true })) return;
      add2eClearDeniedMovementPreview(tokenDocument);
      return false;
    } catch (err) {
      console.warn(`${TAG}[TURN_LOCK][MOVE][ERROR]`, err);
    }
  });

  Hooks.on("hoverToken", (token, hovered) => {
    if (!hovered || !add2eIsCombatActive()) return;
    add2eClearTokenMovementHistory(token?.document ?? token);
  });

  Hooks.on("controlToken", token => {
    if (!add2eIsCombatActive()) return;
    add2eClearTokenMovementHistory(token?.document ?? token);
  });
}

function add2eWrapActionFunction(name, label) {
  const current = globalThis[name];
  if (typeof current !== "function") return false;
  if (current.__add2eTurnGuardVersion === ADD2E_TURN_LOCK_VERSION) return true;

  const wrapped = async function add2eTurnLockedActionWrapper(...args) {
    const actor = add2eResolveActionActor(args);
    if (!add2eCanActorActNow(actor, { notify: true })) return false;
    return current.apply(this, args);
  };

  wrapped.__add2eTurnGuardVersion = ADD2E_TURN_LOCK_VERSION;
  wrapped.__add2eOriginal = current;
  globalThis[name] = wrapped;

  console.log(`${TAG}[TURN_LOCK][WRAP]`, { name, label, version: ADD2E_TURN_LOCK_VERSION });
  return true;
}

function add2eInstallActionTurnLocks() {
  add2eWrapActionFunction("add2eAttackRoll", "attaque");
  add2eWrapActionFunction("add2eCastSpell", "sort");
  if (globalThis.cast_spell === globalThis.add2eCastSpell || typeof globalThis.cast_spell === "function") {
    add2eWrapActionFunction("cast_spell", "sort alias");
  }
}

function add2eExposeInitiativeGlobals() {
  globalThis.add2eConfigureInitiative = add2eConfigureInitiative;
  globalThis.add2eSortInitiativeAscending = add2eSortInitiativeAscending;
  globalThis.add2eScheduleInitiativeSort = add2eScheduleInitiativeSort;
  globalThis.add2ePatchCombatTrackerInitiativeIcons = add2ePatchCombatTrackerInitiativeIcons;
  globalThis.add2eCanActorActNow = add2eCanActorActNow;
  globalThis.add2eCanTokenActNow = add2eCanTokenActNow;
  globalThis.add2eClearDeniedMovementPreview = add2eClearDeniedMovementPreview;
  globalThis.add2eClearTokenMovementHistory = add2eClearTokenMovementHistory;
  globalThis.triInitiativeAscendant = add2eSortInitiativeAscending;
}

function add2eMakeD6Image() {
  const img = document.createElement("img");
  img.src = ADD2E_INITIATIVE_D6_ICON;
  img.alt = "D6";
  img.className = "add2e-init-d6-icon";
  img.style.width = "22px";
  img.style.height = "22px";
  img.style.objectFit = "contain";
  img.style.verticalAlign = "middle";
  img.style.border = "0";
  img.style.margin = "0";
  img.style.padding = "0";
  img.style.filter = "drop-shadow(0 0 2px rgba(255,255,255,.35))";
  return img;
}

function add2eIsCombatantInitiativeButton(button) {
  if (!button?.closest) return false;
  const row = button.closest(".combatant, li[data-combatant-id], [data-combatant-id]");
  if (!row) return false;
  const isRollAction =
    button.matches?.("button.combatant-control.roll") ||
    button.matches?.("[data-action='rollInitiative']") ||
    button.matches?.("[data-control='rollInitiative']") ||
    button.classList?.contains("roll");
  return !!isRollAction;
}

function add2ePatchInitiativeButtonBackground(button) {
  if (!add2eIsCombatantInitiativeButton(button)) return false;

  button.style.setProperty("background-image", `url('${ADD2E_INITIATIVE_D6_ICON}')`, "important");
  button.style.setProperty("background-size", "contain", "important");
  button.style.setProperty("background-repeat", "no-repeat", "important");
  button.style.setProperty("background-position", "center", "important");
  button.dataset.add2eD6InitiativeIcon = "1";
  button.title = button.title || "Lancer l'initiative ADD2E (1d6)";
  return true;
}

function add2ePatchOneInitiativeElement(el) {
  if (!el) return false;

  const button = el.matches?.("button, a")
    ? el
    : el.closest?.("button, a") ?? el.querySelector?.("button, a");
  if (!add2eIsCombatantInitiativeButton(button)) return false;

  const icon = button.querySelector?.("i.fa-dice-d20");
  if (icon && !button.querySelector(".add2e-init-d6-icon")) icon.replaceWith(add2eMakeD6Image());
  return add2ePatchInitiativeButtonBackground(button);
}

function add2ePatchCombatTrackerInitiativeIcons(root = document) {
  try {
    const scope = root?.jquery ? root[0] : root;
    if (!scope?.querySelectorAll) return 0;

    const selectors = [
      "#combat-tracker .combatant button.combatant-control.roll",
      "#combat .combatant button.combatant-control.roll",
      ".combat-sidebar .combatant button.combatant-control.roll",
      "#combat-tracker [data-combatant-id] button.combatant-control.roll",
      "#combat [data-combatant-id] button.combatant-control.roll",
      ".combat-sidebar [data-combatant-id] button.combatant-control.roll",
      "#combat-tracker .combatant [data-action='rollInitiative']",
      "#combat .combatant [data-action='rollInitiative']",
      ".combat-sidebar .combatant [data-action='rollInitiative']",
      "#combat-tracker [data-combatant-id] [data-action='rollInitiative']",
      "#combat [data-combatant-id] [data-action='rollInitiative']",
      ".combat-sidebar [data-combatant-id] [data-action='rollInitiative']"
    ];

    const elements = new Set();
    for (const selector of selectors) {
      for (const el of scope.querySelectorAll(selector)) elements.add(el);
    }

    let changed = 0;
    for (const el of elements) {
      if (add2ePatchOneInitiativeElement(el)) changed++;
    }

    return changed;
  } catch (err) {
    console.warn(`${TAG}[D6_ICON][ERROR]`, err);
    return 0;
  }
}

function add2eInstallInitiativeHooks() {
  Hooks.on("updateCombatant", (combatant, changes, options, userId) => {
    if (options?.add2eInitiativeSort) return;
    if (!foundry.utils.hasProperty(changes ?? {}, "initiative")) return;

    console.log(`${TAG}[UPDATE_COMBATANT]`, {
      combatant: combatant?.name,
      initiative: changes.initiative,
      userId
    });

    add2eScheduleInitiativeSort(combatant.combat ?? game.combat);
  });

  Hooks.on("createCombatant", (combatant, options, userId) => {
    if (options?.add2eInitiativeSort) return;

    console.log(`${TAG}[CREATE_COMBATANT]`, {
      combatant: combatant?.name,
      initiative: combatant?.initiative,
      userId
    });

    add2eScheduleInitiativeSort(combatant.combat ?? game.combat);
  });

  Hooks.on("deleteCombatant", (combatant, options, userId) => {
    if (options?.add2eInitiativeSort) return;
    add2eScheduleInitiativeSort(combatant.combat ?? game.combat);
    setTimeout(() => add2eClearTokenMovementHistory(), 50);
  });

  Hooks.on("updateCombat", combat => {
    setTimeout(() => add2eClearTokenMovementHistory(), 50);
  });

  Hooks.on("combatTurn", combat => {
    setTimeout(() => add2eClearTokenMovementHistory(), 50);
  });

  Hooks.on("combatRound", combat => {
    setTimeout(() => add2eClearTokenMovementHistory(), 50);
  });

  Hooks.on("renderCombatTracker", (app, html, data) => {
    add2ePatchCombatTrackerInitiativeIcons(html);
  });

  Hooks.on("renderCombatantConfig", () => {
    setTimeout(() => add2ePatchCombatTrackerInitiativeIcons(document), 50);
  });

  Hooks.on("renderSidebarTab", (app, html, data) => {
    if (app?.options?.id === "combat" || app?.tabName === "combat" || app?.id === "combat") {
      add2ePatchCombatTrackerInitiativeIcons(html);
      setTimeout(() => add2ePatchCombatTrackerInitiativeIcons(document), 50);
    }
  });

  add2eInstallInitiativeChatCard();
  add2eInstallMovementTurnLock();

  console.log(`${TAG}[HOOKS_INSTALLED]`, { version: ADD2E_INITIATIVE_VERSION });
}

Hooks.once("init", add2eConfigureInitiative);

Hooks.once("ready", () => {
  add2eConfigureInitiative();
  add2eRemoveLegacyInitiativeHooks();
  add2eExposeInitiativeGlobals();
  add2ePatchCombatTrackerInitiativeIcons(document);
  add2eInstallActionTurnLocks();
  setTimeout(() => add2ePatchCombatTrackerInitiativeIcons(document), 500);
  setTimeout(() => add2ePatchCombatTrackerInitiativeIcons(document), 1500);
  setTimeout(() => add2eInstallActionTurnLocks(), 800);
  setTimeout(() => add2eInstallActionTurnLocks(), 2000);
  setTimeout(() => add2eClearTokenMovementHistory(), 500);
});

add2eExposeInitiativeGlobals();
add2eInstallInitiativeHooks();
