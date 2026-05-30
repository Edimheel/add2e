// scripts/add2e-initiative.mjs
// ADD2E — Initiative stable.
// Règle : 1d6, le plus petit score agit en premier.

const ADD2E_INITIATIVE_VERSION = "2026-05-30-initiative-no-inactive-skip-v1";
const ADD2E_INITIATIVE_D6_ICON = "systems/add2e/assets/D6_3D_tracker.png";
const TAG = "[ADD2E][INIT]";

let configured = false;
let patched = false;
let hooksInstalled = false;
let sorting = false;
let warningAt = 0;
let sortTimer = null;
let localSyncTimer = null;

globalThis.ADD2E_INITIATIVE_VERSION = ADD2E_INITIATIVE_VERSION;

function configureInitiative() {
  if (configured) return;
  configured = true;
  CONFIG.Combat ??= {};
  CONFIG.Combat.initiative = { formula: "1d6", decimals: 2 };
}

function hasProperty(obj, path) {
  return globalThis.foundry?.utils?.hasProperty ? globalThis.foundry.utils.hasProperty(obj, path) : path in (obj ?? {});
}

function initiativeValue(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function compareCombatantsAscending(a, b) {
  const ai = initiativeValue(a?.initiative);
  const bi = initiativeValue(b?.initiative);
  if (ai === null && bi === null) return String(a?.id ?? "").localeCompare(String(b?.id ?? ""));
  if (ai === null) return 1;
  if (bi === null) return -1;
  if (ai !== bi) return ai - bi;
  return String(a?.id ?? "").localeCompare(String(b?.id ?? ""));
}

function sortedCombatants(combat = game.combat) {
  return Array.from(combat?.combatants ?? []).sort(compareCombatantsAscending);
}

function combatTurnIndex(combat = game.combat, turns = sortedCombatants(combat)) {
  if (!turns.length) return 0;
  const raw = Number(combat?.turn ?? combat?.current?.turn ?? 0);
  const n = Number.isFinite(raw) ? Math.floor(raw) : 0;
  return Math.max(0, Math.min(turns.length - 1, n));
}

function adjacentSortedIndex(turns, startIndex, direction = 1) {
  if (!turns.length) return { index: 0, wrapped: false };
  const dir = direction >= 0 ? 1 : -1;
  const start = Math.max(0, Math.min(turns.length - 1, Number(startIndex) || 0));
  const raw = start + dir;
  const wrapped = raw >= turns.length || raw < 0;
  const index = ((raw % turns.length) + turns.length) % turns.length;
  return { index, wrapped };
}

function setLocalTurn(combat, turns, index) {
  if (!combat || !turns?.length) return false;
  const safe = Math.max(0, Math.min(turns.length - 1, Number(index) || 0));
  combat.turns = turns;
  if (combat.started) {
    combat.turn = safe;
    if (combat.current && typeof combat.current === "object") {
      combat.current.turn = safe;
      combat.current.combatantId = turns[safe]?.id ?? combat.current.combatantId;
    }
  }
  return true;
}

function applyLocalOrder(combat = game.combat, { first = false } = {}) {
  if (!combat) return false;
  const turns = sortedCombatants(combat);
  if (!turns.length) return false;
  const index = first ? 0 : combatTurnIndex(combat, turns);
  return setLocalTurn(combat, turns, index);
}

function currentCombatant(combat = game.combat) {
  if (!combat?.started) return null;
  const turns = Array.isArray(combat.turns) && combat.turns.length ? combat.turns : sortedCombatants(combat);
  return turns[combatTurnIndex(combat, turns)] ?? combat.combatant ?? null;
}

function tokenFromCombatant(combatant) {
  return combatant?.token?.object ?? (combatant?.tokenId ? canvas?.tokens?.get?.(combatant.tokenId) : null) ?? null;
}

function selectCurrentToken(combat = game.combat) {
  if (!combat?.started) return false;
  const token = tokenFromCombatant(currentCombatant(combat));
  if (!token?.control) return false;
  try {
    token.control({ releaseOthers: true });
    return true;
  } catch (err) {
    console.warn(`${TAG}[TOKEN_SELECT][ERROR]`, err);
    return false;
  }
}

function scheduleLocalSync(combat = game.combat, { delay = 120, selectToken = false } = {}) {
  if (!combat) return;
  clearTimeout(localSyncTimer);
  localSyncTimer = setTimeout(() => {
    applyLocalOrder(combat);
    if (selectToken) selectCurrentToken(combat);
  }, delay);
}

async function setCombatTurn(combat, index, { roundDelta = 0 } = {}) {
  const turns = sortedCombatants(combat);
  if (!turns.length) return combat;
  const safe = Math.max(0, Math.min(turns.length - 1, Number(index) || 0));
  const round = Math.max(1, Number(combat.round ?? 1) + roundDelta);
  await combat.update({ round, turn: safe }, { add2eInitiativeNavigation: true });
  setLocalTurn(combat, turns, safe);
  selectCurrentToken(combat);
  syncActionHudToCombatant(combat, { reason: "turn" });
  return combat;
}

async function forceFirstSortedTurn(combat = game.combat) {
  if (!combat) return combat;
  const turns = sortedCombatants(combat);
  if (!turns.length) return combat;
  return setCombatTurn(combat, 0);
}

async function advanceSortedTurn(combat = game.combat, direction = 1) {
  if (!combat) return combat;
  applyLocalOrder(combat);
  const turns = sortedCombatants(combat);
  if (!turns.length) return combat;
  const current = combatTurnIndex(combat, turns);
  const next = adjacentSortedIndex(turns, current, direction);
  let roundDelta = 0;
  if (direction >= 0 && next.wrapped) roundDelta = 1;
  else if (direction < 0 && next.wrapped) roundDelta = Number(combat.round ?? 1) > 1 ? -1 : 0;
  return setCombatTurn(combat, next.index, { roundDelta });
}

function patchNativeSort(target) {
  if (!target || typeof target._sortCombatants !== "function") return false;
  if (target._sortCombatants.__add2eLowFirst === ADD2E_INITIATIVE_VERSION) return true;
  const original = target._sortCombatants.__add2eOriginal ?? target._sortCombatants;
  target._sortCombatants = function add2eSortCombatantsLowFirst(a, b) {
    if (game?.system?.id === "add2e") return compareCombatantsAscending(a, b);
    return original.call(this, a, b);
  };
  target._sortCombatants.__add2eLowFirst = ADD2E_INITIATIVE_VERSION;
  target._sortCombatants.__add2eOriginal = original;
  return true;
}

function installCombatPatch() {
  if (patched) return true;
  const proto = globalThis.Combat?.prototype;
  if (!proto) return false;

  patchNativeSort(proto);
  patchNativeSort(globalThis.Combat);

  if (proto.setupTurns && proto.setupTurns.__add2eLowFirstSetup !== ADD2E_INITIATIVE_VERSION) {
    const original = proto.setupTurns.__add2eOriginal ?? proto.setupTurns;
    proto.setupTurns = function add2eSetupTurnsLowFirst(...args) {
      const result = original.apply(this, args);
      if (game?.system?.id === "add2e") applyLocalOrder(this);
      return result;
    };
    proto.setupTurns.__add2eLowFirstSetup = ADD2E_INITIATIVE_VERSION;
    proto.setupTurns.__add2eOriginal = original;
  }

  if (proto.startCombat && proto.startCombat.__add2eLowFirstStart !== ADD2E_INITIATIVE_VERSION) {
    const original = proto.startCombat.__add2eOriginal ?? proto.startCombat;
    proto.startCombat = async function add2eStartCombatLowFirst(...args) {
      const result = await original.apply(this, args);
      if (game?.system?.id === "add2e") await forceFirstSortedTurn(this);
      return result;
    };
    proto.startCombat.__add2eLowFirstStart = ADD2E_INITIATIVE_VERSION;
    proto.startCombat.__add2eOriginal = original;
  }

  if (proto.nextTurn && proto.nextTurn.__add2eLowFirstNext !== ADD2E_INITIATIVE_VERSION) {
    const original = proto.nextTurn.__add2eOriginal ?? proto.nextTurn;
    proto.nextTurn = function add2eNextTurnLowFirst(...args) {
      if (game?.system?.id !== "add2e") return original.apply(this, args);
      return advanceSortedTurn(this, 1);
    };
    proto.nextTurn.__add2eLowFirstNext = ADD2E_INITIATIVE_VERSION;
    proto.nextTurn.__add2eOriginal = original;
  }

  if (proto.previousTurn && proto.previousTurn.__add2eLowFirstPrevious !== ADD2E_INITIATIVE_VERSION) {
    const original = proto.previousTurn.__add2eOriginal ?? proto.previousTurn;
    proto.previousTurn = function add2ePreviousTurnLowFirst(...args) {
      if (game?.system?.id !== "add2e") return original.apply(this, args);
      return advanceSortedTurn(this, -1);
    };
    proto.previousTurn.__add2eLowFirstPrevious = ADD2E_INITIATIVE_VERSION;
    proto.previousTurn.__add2eOriginal = original;
  }

  patched = true;
  return true;
}

async function sortInitiativeAscending(combat = game.combat) {
  if (!combat || sorting) return false;
  const combatants = Array.from(combat.combatants ?? []);
  if (!combatants.length) return false;
  const turns = sortedCombatants(combat);
  const updates = turns.map((c, index) => ({ _id: c.id, sort: index })).filter(update => {
    const current = combatants.find(c => c.id === update._id);
    return current && Number(current.sort) !== Number(update.sort);
  });
  sorting = true;
  try {
    if (updates.length) await combat.updateEmbeddedDocuments("Combatant", updates, { add2eInitiativeSort: true });
    applyLocalOrder(combat);
    return true;
  } catch (err) {
    console.error(`${TAG}[SORT_ASC][ERROR]`, err);
    return false;
  } finally {
    sorting = false;
  }
}

function scheduleInitiativeSort(combat = game.combat) {
  if (!combat) return;
  clearTimeout(sortTimer);
  sortTimer = setTimeout(() => sortInitiativeAscending(combat), 100);
}

function patchInitiativeIcons(root = document) {
  try {
    const scope = root?.jquery ? root[0] : root;
    if (!scope?.querySelectorAll) return;
    const selector = "button.combatant-control.roll,[data-action='rollInitiative'],[data-control='rollInitiative']";
    for (const button of scope.querySelectorAll(selector)) {
      const icon = button.querySelector?.("i.fa-dice-d20, i.fa-dice-d6, i.fa-dice");
      if (icon && !button.querySelector(".add2e-init-d6-icon")) {
        const img = document.createElement("img");
        img.src = ADD2E_INITIATIVE_D6_ICON;
        img.alt = "D6";
        img.className = "add2e-init-d6-icon";
        img.style.width = "22px";
        img.style.height = "22px";
        img.style.objectFit = "contain";
        img.style.verticalAlign = "middle";
        icon.replaceWith(img);
      }
      button.title = "Lancer l'initiative ADD2E (1d6, le plus petit commence)";
    }
  } catch (err) {
    console.warn(`${TAG}[D6_ICON][ERROR]`, err);
  }
}

function escapeHtml(value) {
  try {
    return globalThis.foundry?.utils?.escapeHTML ? globalThis.foundry.utils.escapeHTML(String(value ?? "")) : String(value ?? "");
  } catch (_e) {
    const div = document.createElement("div");
    div.textContent = String(value ?? "");
    return div.innerHTML;
  }
}

function speakerActor(speaker = {}) {
  if (speaker.token && canvas?.tokens?.get) return canvas.tokens.get(speaker.token)?.actor ?? null;
  if (speaker.actor) return game.actors?.get?.(speaker.actor) ?? null;
  return null;
}

function speakerToken(speaker = {}) {
  if (!speaker.token || !canvas?.tokens?.get) return null;
  return canvas.tokens.get(speaker.token) ?? null;
}

function isInitiativeMessage(message, data = {}) {
  const flags = data.flags ?? message?.flags ?? {};
  const flavor = String(data.flavor ?? message?.flavor ?? "").toLowerCase();
  const speaker = data.speaker ?? message?.speaker ?? {};
  const roll = (data.rolls ?? message?.rolls ?? [])?.[0] ?? null;
  const formula = String(roll?.formula ?? roll?._formula ?? "").replace(/\s+/g, "").toLowerCase();
  if (flags?.add2e?.initiativeRoll || flags?.core?.initiativeRoll) return true;
  if (flavor.includes("initiative")) return true;
  return formula === "1d6" && !!speaker?.actor;
}

function initiativeChatContent(message, data = {}) {
  const speaker = data.speaker ?? message?.speaker ?? {};
  const actor = speakerActor(speaker);
  const token = speakerToken(speaker);
  const name = token?.name ?? actor?.name ?? speaker.alias ?? "Combattant";
  const img = token?.document?.texture?.src ?? actor?.img ?? ADD2E_INITIATIVE_D6_ICON;
  const roll = (data.rolls ?? message?.rolls ?? [])?.[0] ?? null;
  const result = Number.isFinite(Number(roll?.total ?? roll?._total)) ? Number(roll?.total ?? roll?._total) : "—";
  return `<div class="add2e-init-chat-card" style="border:1px solid #7c4a16;border-radius:10px;background:linear-gradient(135deg,#2a1708,#4b2a0e);color:#f7ead2;padding:10px 12px;box-shadow:0 2px 8px rgba(0,0,0,.35);font-family:serif;"><div style="display:flex;align-items:center;gap:10px;"><img src="${escapeHtml(img)}" alt="" style="width:42px;height:42px;border-radius:8px;object-fit:cover;border:1px solid rgba(255,255,255,.25);background:#111;"><div style="flex:1;min-width:0;"><div style="font-size:15px;font-weight:700;text-transform:uppercase;color:#ffd891;">Initiative</div><div style="font-size:18px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(name)}</div></div><div style="text-align:center;min-width:58px;background:rgba(255,255,255,.12);border:1px solid rgba(255,216,145,.35);border-radius:8px;padding:5px 8px;"><div style="font-size:11px;text-transform:uppercase;color:#ffd891;">D6</div><div style="font-size:26px;line-height:1;font-weight:900;color:#ffffff;">${escapeHtml(result)}</div></div></div><div style="margin-top:8px;font-size:12px;color:#ead6b0;display:flex;justify-content:space-between;gap:10px;"><span>Le plus petit résultat agit en premier.</span><span style="white-space:nowrap;">1d6</span></div></div>`;
}

function installInitiativeChatCard() {
  if (globalThis.__ADD2E_INIT_CHAT_CARD_INSTALLED === ADD2E_INITIATIVE_VERSION) return;
  globalThis.__ADD2E_INIT_CHAT_CARD_INSTALLED = ADD2E_INITIATIVE_VERSION;
  Hooks.on("preCreateChatMessage", (message, data) => {
    try {
      if (!isInitiativeMessage(message, data)) return;
      message.updateSource?.({
        content: initiativeChatContent(message, data),
        flavor: "Initiative ADD2E",
        "flags.add2e.initiativeRoll": true,
        "flags.add2e.initiativeChatCardVersion": ADD2E_INITIATIVE_VERSION
      });
    } catch (err) {
      console.warn(`${TAG}[CHAT][ERROR]`, err);
    }
  });
}

function combatantMatchesActor(combatant, actor) {
  return Boolean(combatant && actor && (combatant.actor?.id === actor.id || combatant.actorId === actor.id));
}

function canActorActNow(actor, { notify = false } = {}) {
  const combatant = currentCombatant(game.combat);
  if (!game.combat?.started || !combatant) return true;
  if (game.user?.isGM) return true;
  if (combatantMatchesActor(combatant, actor)) return true;
  if (notify) {
    const now = Date.now();
    if (now - warningAt > 900) {
      warningAt = now;
      ui.notifications?.info?.(`${actor?.name ?? "Cet acteur"} ne peut pas agir. C'est le tour de ${combatant.name}.`);
    }
  }
  return false;
}

function canTokenInteractNow(tokenOrDoc, { notify = false } = {}) {
  if (!game.combat?.started || game.user?.isGM) return true;
  const actor = tokenOrDoc?.actor ?? tokenOrDoc?.object?.actor ?? null;
  return canActorActNow(actor, { notify });
}

function installTokenMoveLock() {
  const proto = globalThis.Token?.prototype;
  if (!proto) return;
  for (const method of ["_onDragLeftStart", "_onDragLeftMove", "_onDragLeftDrop", "_onDragLeftCancel"]) {
    const original = proto[method];
    if (typeof original !== "function" || original.__add2eLock === ADD2E_INITIATIVE_VERSION) continue;
    proto[method] = function add2eTokenMoveLock(...args) {
      if (!canTokenInteractNow(this, { notify: true })) return false;
      return original.apply(this, args);
    };
    proto[method].__add2eLock = ADD2E_INITIATIVE_VERSION;
    proto[method].__add2eOriginal = original;
  }
}

function resolveActionActor(argsLike) {
  const args = Array.isArray(argsLike) ? argsLike : [];
  const first = args[0] ?? null;
  if (first?.actor) return first.actor;
  if (first?.actorId) return game.actors?.get?.(first.actorId) ?? null;
  if (first?.token?.actor) return first.token.actor;
  if (first?.tokenId) return canvas?.tokens?.get?.(first.tokenId)?.actor ?? null;
  return canvas?.tokens?.controlled?.[0]?.actor ?? game.user?.character ?? null;
}

function installActionLocks() {
  for (const name of ["add2eAttackRoll", "add2eCastSpell", "cast_spell", "add2eExecuteClassFeatureOnUse"]) {
    const current = globalThis[name];
    if (typeof current !== "function" || current.__add2eLock === ADD2E_INITIATIVE_VERSION) continue;
    const wrapped = async function add2eActionLock(...args) {
      const actor = resolveActionActor(args);
      if (!canActorActNow(actor, { notify: true })) return false;
      return current.apply(this, args);
    };
    wrapped.__add2eLock = ADD2E_INITIATIVE_VERSION;
    wrapped.__add2eOriginal = current;
    globalThis[name] = wrapped;
  }
}

function resetRulerLike(ruler) {
  try { if (typeof ruler?.reset === "function") ruler.reset(); } catch (_e) {}
}

function clearFoundryMovementTrail(token = null) {
  for (const t of (token ? [token] : Array.from(canvas?.tokens?.placeables ?? []))) {
    resetRulerLike(t?._ruler);
    resetRulerLike(t?._hoverRuler);
  }
  resetRulerLike(canvas?.controls?.ruler);
  return true;
}

function clearFoundryMovementTrailAggressive(token = null) {
  clearFoundryMovementTrail(token);
  setTimeout(() => clearFoundryMovementTrail(token), 20);
  return true;
}

function syncActionHudToCombatant(combat = game.combat, { reason = "combat" } = {}) {
  if (!combat?.started || !document.getElementById("add2e-action-hud")) return false;
  const combatant = currentCombatant(combat);
  const actor = combatant?.actor ?? null;
  if (!actor || typeof globalThis.add2eRenderActionHud !== "function") return false;
  try {
    globalThis.add2eRenderActionHud(actor, tokenFromCombatant(combatant), { reason: `initiative-${reason}` });
    return true;
  } catch (err) {
    console.warn(`${TAG}[HUD_FOLLOW][ERROR]`, err);
    return false;
  }
}

function add2eInitiativeDebug(label = "debug", combat = game.combat) {
  const turns = sortedCombatants(combat);
  return {
    label,
    version: ADD2E_INITIATIVE_VERSION,
    started: combat?.started ?? null,
    round: combat?.round ?? null,
    turn: combat?.turn ?? null,
    current: combat?.current ?? null,
    active: currentCombatant(combat)?.name ?? null,
    turns: turns.map((c, i) => ({ index: i, id: c.id, name: c.name, initiative: c.initiative, tokenId: c.tokenId }))
  };
}

function exposeGlobals() {
  game.add2e = game.add2e ?? {};
  game.add2e.initiativeVersion = ADD2E_INITIATIVE_VERSION;
  globalThis.add2eConfigureInitiative = configureInitiative;
  globalThis.add2eSortInitiativeAscending = sortInitiativeAscending;
  globalThis.add2eScheduleInitiativeSort = scheduleInitiativeSort;
  globalThis.add2eCanActorActNow = canActorActNow;
  globalThis.add2eCanTokenInteractNow = canTokenInteractNow;
  globalThis.add2eSyncActionHudToCombatant = syncActionHudToCombatant;
  globalThis.add2eSyncCombatAfterRefresh = scheduleLocalSync;
  globalThis.add2eScheduleRefreshSync = scheduleLocalSync;
  globalThis.add2eDebugCombatState = add2eInitiativeDebug;
  globalThis.add2eSelectActiveCombatantToken = selectCurrentToken;
  globalThis.add2eClearFoundryMovementTrail = clearFoundryMovementTrailAggressive;
  globalThis.add2eForceFirstSortedTurn = forceFirstSortedTurn;
  globalThis.triInitiativeAscendant = sortInitiativeAscending;
}

function installHooks() {
  if (hooksInstalled) return;
  hooksInstalled = true;

  Hooks.on("preUpdateToken", (tokenDoc, changes, options, userId) => {
    if (options?.add2eIgnoreTurnLock) return;
    if (!(hasProperty(changes ?? {}, "x") || hasProperty(changes ?? {}, "y") || hasProperty(changes ?? {}, "elevation") || hasProperty(changes ?? {}, "rotation"))) return;
    if (game.users?.get?.(userId)?.isGM) return;
    if (!canTokenInteractNow(tokenDoc, { notify: game.user?.id === userId })) return false;
  });

  Hooks.on("updateCombatant", (combatant, changes, options) => {
    if (options?.add2eInitiativeSort) return;
    if (hasProperty(changes ?? {}, "initiative")) scheduleInitiativeSort(combatant.combat ?? game.combat);
  });
  Hooks.on("createCombatant", (combatant, options) => { if (!options?.add2eInitiativeSort) scheduleInitiativeSort(combatant.combat ?? game.combat); });
  Hooks.on("deleteCombatant", (combatant, options) => { if (!options?.add2eInitiativeSort) scheduleInitiativeSort(combatant.combat ?? game.combat); });

  Hooks.on("updateCombat", (combat, changes, options) => {
    if (options?.add2eInitiativeSort || options?.add2eInitiativeNavigation) return;
    if (hasProperty(changes ?? {}, "started") && combat?.started) {
      setTimeout(() => forceFirstSortedTurn(combat), 80);
      return;
    }
    if (hasProperty(changes ?? {}, "turn") || hasProperty(changes ?? {}, "round")) scheduleLocalSync(combat, { delay: 40, selectToken: true });
  });

  Hooks.on("combatTurn", combat => scheduleLocalSync(combat, { delay: 30, selectToken: true }));
  Hooks.on("combatRound", combat => scheduleLocalSync(combat, { delay: 30, selectToken: true }));
  Hooks.on("canvasReady", () => scheduleLocalSync(game.combat, { delay: 180, selectToken: game.combat?.started }));
  Hooks.on("hoverToken", token => clearFoundryMovementTrailAggressive(token));
  Hooks.on("refreshToken", token => clearFoundryMovementTrailAggressive(token));

  Hooks.on("renderCombatTracker", (_app, html) => patchInitiativeIcons(html));
  Hooks.on("renderCombatantConfig", () => setTimeout(() => patchInitiativeIcons(document), 50));
  Hooks.on("renderSidebarTab", (app, html) => {
    if (app?.options?.id === "combat" || app?.tabName === "combat" || app?.id === "combat") patchInitiativeIcons(html);
  });

  installInitiativeChatCard();
}

Hooks.once("init", configureInitiative);
Hooks.once("ready", () => {
  configureInitiative();
  installCombatPatch();
  exposeGlobals();
  installTokenMoveLock();
  installActionLocks();
  installHooks();
  patchInitiativeIcons(document);
  setTimeout(() => scheduleInitiativeSort(game.combat), 500);
  setTimeout(() => scheduleLocalSync(game.combat, { delay: 0, selectToken: game.combat?.started }), 900);
});

export {
  configureInitiative as add2eConfigureInitiative,
  sortInitiativeAscending as add2eSortInitiativeAscending,
  canActorActNow as add2eCanActorActNow,
  syncActionHudToCombatant as add2eSyncActionHudToCombatant,
  scheduleLocalSync as add2eSyncCombatAfterRefresh,
  add2eInitiativeDebug as add2eDebugCombatState,
  clearFoundryMovementTrailAggressive as add2eDisableMovementHistoryRecording
};
