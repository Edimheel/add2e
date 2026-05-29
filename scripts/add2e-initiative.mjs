// scripts/add2e-initiative.mjs
// ADD2E — Initiative propre.
// Règle système : initiative 1d6, le plus petit résultat agit en premier.
// Responsabilités : tri réel des tours, navigation, carte de chat, HUD, verrou d'action hors tour.
// Ne gère pas le déplacement ; bloque seulement les déplacements hors tour et l'historique visuel/persisté.

const ADD2E_INITIATIVE_VERSION = "2026-05-29-d6-low-first-start-first-v8";
const ADD2E_INITIATIVE_ACTION_LOCK_VERSION = "2026-05-29-d6-low-first-action-lock-v3";
const ADD2E_INITIATIVE_CHAT_VERSION = "2026-05-29-d6-low-first-chat-v2";
const ADD2E_INITIATIVE_HUD_FOLLOW_VERSION = "2026-05-29-d6-low-first-hud-follow-v8";
const ADD2E_MOVEMENT_HISTORY_DISABLED_VERSION = "2026-05-29-no-movement-history-record-v5";
const ADD2E_INDIVIDUAL_TURN_LOCK_VERSION = "2026-05-29-individual-turn-lock-v2";
const ADD2E_INITIATIVE_D6_ICON = "systems/add2e/assets/D6_3D_tracker.png";
const TAG = "[ADD2E][INIT]";

let configured = false;
let sorting = false;
let sortTimer = null;
let hudTimer = null;
let trailTimer = null;
let warningAt = 0;
let combatPatchInstalled = false;
let actionLocksInstalled = false;
let tokenPatchInstalled = false;
let flagPatchInstalled = false;
let chatCardInstalled = false;
let lastHudKey = "";

globalThis.ADD2E_INITIATIVE_VERSION = ADD2E_INITIATIVE_VERSION;
globalThis.ADD2E_INITIATIVE_ACTION_LOCK_VERSION = ADD2E_INITIATIVE_ACTION_LOCK_VERSION;
globalThis.ADD2E_INITIATIVE_CHAT_VERSION = ADD2E_INITIATIVE_CHAT_VERSION;
globalThis.ADD2E_INITIATIVE_HUD_FOLLOW_VERSION = ADD2E_INITIATIVE_HUD_FOLLOW_VERSION;
globalThis.ADD2E_MOVEMENT_HISTORY_DISABLED_VERSION = ADD2E_MOVEMENT_HISTORY_DISABLED_VERSION;
globalThis.ADD2E_INDIVIDUAL_TURN_LOCK_VERSION = ADD2E_INDIVIDUAL_TURN_LOCK_VERSION;

function configureInitiative() {
  if (configured) return;
  configured = true;
  CONFIG.Combat ??= {};
  CONFIG.Combat.initiative = { formula: "1d6", decimals: 2 };
  console.log(`${TAG}[CONFIG]`, { version: ADD2E_INITIATIVE_VERSION, formula: "1d6", order: "ascending" });
}

function n(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function initiativeValue(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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

function turnIndex(combat = game.combat) {
  const index = Math.floor(n(combat?.turn ?? combat?.current?.turn, 0));
  return Math.max(0, index);
}

function applySortedTurns(combat = game.combat, { forceFirst = false } = {}) {
  if (!combat) return false;
  const turns = sortedCombatants(combat);
  if (!turns.length) return false;
  const index = forceFirst ? 0 : Math.min(turns.length - 1, turnIndex(combat));
  try {
    combat.turns = turns;
    combat.turn = index;
    if (combat.current && typeof combat.current === "object") {
      combat.current.turn = index;
      combat.current.combatantId = turns[index]?.id ?? combat.current.combatantId;
    }
    return true;
  } catch (err) {
    console.warn(`${TAG}[APPLY_SORTED_TURNS][ERROR]`, err);
    return false;
  }
}

function currentCombatant(combat = game.combat) {
  const turns = Array.isArray(combat?.turns) && combat.turns.length ? combat.turns : sortedCombatants(combat);
  if (!turns.length) return combat?.combatant ?? null;
  const index = Math.min(turns.length - 1, turnIndex(combat));
  return turns[index] ?? combat?.combatant ?? null;
}

function tokenFromCombatant(combatant) {
  return combatant?.token?.object ?? (combatant?.tokenId ? canvas?.tokens?.get?.(combatant.tokenId) : null) ?? null;
}

function actorFromToken(tokenOrDoc) {
  return tokenOrDoc?.actor ?? tokenOrDoc?.object?.actor ?? null;
}

function actorMatchesCombatant(actor, combatant) {
  if (!actor || !combatant) return false;
  if (combatant.actor?.id && combatant.actor.id === actor.id) return true;
  if (combatant.actorId && combatant.actorId === actor.id) return true;
  return false;
}

function notifyNotTurn(actor = null) {
  const now = Date.now();
  if (now - warningAt < 900) return;
  warningAt = now;
  const active = currentCombatant();
  const activeName = active?.name ?? active?.actor?.name ?? "l'acteur actif";
  const actorName = actor?.name ? `${actor.name} ne peut pas agir.` : "Ce n'est pas votre tour.";
  ui.notifications?.info?.(`${actorName} C'est le tour de ${activeName}.`);
}

function canActorActNow(actor, { notify = false } = {}) {
  const combat = game.combat;
  if (!combat?.started) return true;
  if (game.user?.isGM) return true;
  if (!actor) return false;
  const active = currentCombatant(combat);
  const ok = actorMatchesCombatant(actor, active);
  if (!ok && notify) notifyNotTurn(actor);
  return ok;
}

function canTokenActNow(tokenOrDoc, { notify = false } = {}) {
  if (!game.combat?.started) return true;
  if (game.user?.isGM) return true;
  const actor = actorFromToken(tokenOrDoc);
  if (!actor) return true;
  return canActorActNow(actor, { notify });
}

function tokenPositionChanged(changes = {}) {
  return foundry.utils.hasProperty(changes, "x") || foundry.utils.hasProperty(changes, "y") || foundry.utils.hasProperty(changes, "elevation") || foundry.utils.hasProperty(changes, "rotation");
}

function clearOneTrail(obj) {
  if (!obj) return;
  for (const target of [obj, obj.document].filter(Boolean)) {
    try { target.clearMovementHistory?.(); } catch (_e) {}
    try { if (Array.isArray(target.movementHistory)) target.movementHistory.length = 0; } catch (_e) {}
    try { if (Array.isArray(target._movementHistory)) target._movementHistory.length = 0; } catch (_e) {}
    try { target.movementHistory?.clear?.(); } catch (_e) {}
    try { target._movementHistory?.clear?.(); } catch (_e) {}
  }
  try { obj._movementPath?.clear?.(); } catch (_e) {}
  try { obj._movementPath?.destroy?.({ children: true }); obj._movementPath = null; } catch (_e) {}
  try { obj._ruler?.clear?.(); } catch (_e) {}
  try { obj._hoverRuler?.clear?.(); } catch (_e) {}
}

function clearMovementTrail(token = null) {
  const tokens = token ? [token] : Array.from(canvas?.tokens?.placeables ?? []);
  for (const t of tokens) clearOneTrail(t);
  try { canvas?.controls?.ruler?.clear?.(); } catch (_e) {}
  try { canvas?.controls?.ruler?.clearPath?.(); } catch (_e) {}
  try { canvas?.controls?.ruler?._clear?.(); } catch (_e) {}
  for (const key of ["Token.Ruler", "movement", "Movement"]) {
    try { canvas?.grid?.clearHighlightLayer?.(key); } catch (_e) {}
    try { canvas?.interface?.grid?.clearHighlightLayer?.(key); } catch (_e) {}
  }
  return true;
}

function clearMovementTrailAggressive(token = null) {
  clearMovementTrail(token);
  try { requestAnimationFrame(() => clearMovementTrail(token)); } catch (_e) {}
  setTimeout(() => clearMovementTrail(token), 0);
  setTimeout(() => clearMovementTrail(token), 20);
  return true;
}

function scheduleClearMovementTrail(token = null) {
  clearMovementTrailAggressive(token);
  clearTimeout(trailTimer);
  trailTimer = setTimeout(() => clearMovementTrailAggressive(token), 40);
}

function actionHudIsOpen() {
  return Boolean(document.getElementById("add2e-action-hud"));
}

function renderHudForToken(token, { force = false, reason = "token" } = {}) {
  const actor = token?.actor ?? null;
  if (!actor) return false;
  if (!canActorActNow(actor, { notify: false })) return false;
  if (!force && !actionHudIsOpen()) return false;
  if (typeof globalThis.add2eRenderActionHud !== "function") return false;
  try {
    globalThis.add2eRenderActionHud(actor, token, { reason: `initiative-${reason}` });
    return true;
  } catch (err) {
    console.warn(`${TAG}[HUD_TOKEN][ERROR]`, err);
    return false;
  }
}

function syncHudToCombatant(combat = game.combat, { forceOpen = false, reason = "combat" } = {}) {
  applySortedTurns(combat);
  const combatant = currentCombatant(combat);
  const actor = combatant?.actor ?? null;
  if (!actor) return false;
  if (!forceOpen && !actionHudIsOpen()) return false;
  const token = tokenFromCombatant(combatant);
  const key = `${combat?.id ?? "combat"}.${combat?.turn ?? 0}.${combatant.id}.${actor.id}.${token?.id ?? "no-token"}`;
  if (lastHudKey === key && reason !== "manual") return true;
  lastHudKey = key;
  if (typeof globalThis.add2eRenderActionHud === "function") {
    try {
      globalThis.add2eRenderActionHud(actor, token, { reason: `initiative-${reason}` });
      return true;
    } catch (err) {
      console.warn(`${TAG}[HUD_FOLLOW][ERROR]`, err);
    }
  }
  return false;
}

function scheduleHudFollow(combat = game.combat, options = {}) {
  clearTimeout(hudTimer);
  hudTimer = setTimeout(() => syncHudToCombatant(combat, options), 100);
}

async function forceFirstSortedTurn(combat = game.combat, reason = "start") {
  if (!combat) return combat;
  const turns = sortedCombatants(combat);
  if (!turns.length) return combat;
  const round = Math.max(1, n(combat.round, 1));
  await combat.update({ round, turn: 0 });
  applySortedTurns(combat, { forceFirst: true });
  ui.combat?.render?.(true);
  scheduleHudFollow(combat, { forceOpen: false, reason });
  scheduleClearMovementTrail();
  console.log(`${TAG}[START_FIRST]`, { first: turns[0]?.name ?? null, order: turns.map(c => `${c.name}:${c.initiative}`) });
  return combat;
}

async function updateCombatTurnBySortedIndex(combat, index, { roundDelta = 0 } = {}) {
  const turns = sortedCombatants(combat);
  if (!turns.length) return combat;
  const nextIndex = Math.max(0, Math.min(turns.length - 1, n(index, 0)));
  const round = Math.max(1, n(combat.round, 1) + roundDelta);
  await combat.update({ round, turn: nextIndex });
  applySortedTurns(combat);
  ui.combat?.render?.(true);
  scheduleHudFollow(combat, { forceOpen: false, reason: "navigation" });
  scheduleClearMovementTrail();
  return combat;
}

async function advanceSortedTurn(combat = game.combat, direction = 1) {
  if (!combat) return combat;
  combat.setupTurns?.();
  applySortedTurns(combat);
  const turns = sortedCombatants(combat);
  if (!turns.length) return combat;
  let next = Math.min(turns.length - 1, turnIndex(combat)) + direction;
  let roundDelta = 0;
  if (next >= turns.length) { next = 0; roundDelta = 1; }
  if (next < 0) { next = turns.length - 1; roundDelta = n(combat.round, 1) > 1 ? -1 : 0; }
  return updateCombatTurnBySortedIndex(combat, next, { roundDelta });
}

async function sortInitiativeAscending(combat = game.combat) {
  if (!combat || sorting) return false;
  const combatants = Array.from(combat.combatants ?? []);
  const sorted = sortedCombatants(combat);
  if (!combatants.length || !sorted.length) return false;
  const updates = sorted.map((c, i) => ({ _id: c.id, sort: i })).filter(u => Number(combatants.find(c => c.id === u._id)?.sort) !== Number(u.sort));
  sorting = true;
  try {
    if (updates.length) await combat.updateEmbeddedDocuments("Combatant", updates, { add2eInitiativeSort: true });
    combat.setupTurns?.();
    applySortedTurns(combat);
    ui.combat?.render?.(true);
    return true;
  } catch (err) {
    console.error(`${TAG}[SORT][ERROR]`, err);
    return false;
  } finally {
    sorting = false;
  }
}

function scheduleInitiativeSort(combat = game.combat) {
  clearTimeout(sortTimer);
  sortTimer = setTimeout(() => sortInitiativeAscending(combat), 100);
}

function installCombatPatch() {
  if (combatPatchInstalled) return true;
  const proto = globalThis.Combat?.prototype;
  if (!proto) return false;
  if (proto.setupTurns && proto.setupTurns.__add2ePatch !== ADD2E_INITIATIVE_VERSION) {
    const original = proto.setupTurns.__add2eOriginal ?? proto.setupTurns;
    proto.setupTurns = function add2eSetupTurns(...args) {
      const result = original.apply(this, args);
      if (game?.system?.id === "add2e") applySortedTurns(this);
      return result;
    };
    proto.setupTurns.__add2eOriginal = original;
    proto.setupTurns.__add2ePatch = ADD2E_INITIATIVE_VERSION;
  }
  if (proto.startCombat && proto.startCombat.__add2ePatch !== ADD2E_INITIATIVE_VERSION) {
    const original = proto.startCombat.__add2eOriginal ?? proto.startCombat;
    proto.startCombat = async function add2eStartCombat(...args) {
      const result = await original.apply(this, args);
      if (game?.system?.id === "add2e") await forceFirstSortedTurn(this, "startCombat");
      return result;
    };
    proto.startCombat.__add2eOriginal = original;
    proto.startCombat.__add2ePatch = ADD2E_INITIATIVE_VERSION;
  }
  if (proto.nextTurn && proto.nextTurn.__add2ePatch !== ADD2E_INITIATIVE_VERSION) {
    const original = proto.nextTurn.__add2eOriginal ?? proto.nextTurn;
    proto.nextTurn = function add2eNextTurn(...args) { return game?.system?.id === "add2e" ? advanceSortedTurn(this, 1) : original.apply(this, args); };
    proto.nextTurn.__add2eOriginal = original;
    proto.nextTurn.__add2ePatch = ADD2E_INITIATIVE_VERSION;
  }
  if (proto.previousTurn && proto.previousTurn.__add2ePatch !== ADD2E_INITIATIVE_VERSION) {
    const original = proto.previousTurn.__add2eOriginal ?? proto.previousTurn;
    proto.previousTurn = function add2ePreviousTurn(...args) { return game?.system?.id === "add2e" ? advanceSortedTurn(this, -1) : original.apply(this, args); };
    proto.previousTurn.__add2eOriginal = original;
    proto.previousTurn.__add2ePatch = ADD2E_INITIATIVE_VERSION;
  }
  combatPatchInstalled = true;
  return true;
}

function wrapActionFunction(name) {
  const current = globalThis[name];
  if (typeof current !== "function") return false;
  if (current.__add2eActionLock === ADD2E_INITIATIVE_ACTION_LOCK_VERSION) return true;
  const wrapped = async function add2eActionLock(...args) {
    const source = args[0] && typeof args[0] === "object" ? args[0] : {};
    const actor = source.actor ?? (source.actorId ? game.actors?.get?.(source.actorId) : null) ?? source.token?.actor ?? (source.tokenId ? canvas?.tokens?.get?.(source.tokenId)?.actor : null) ?? canvas?.tokens?.controlled?.[0]?.actor ?? game.user?.character ?? null;
    if (!canActorActNow(actor, { notify: true })) return false;
    return current.apply(this, args);
  };
  wrapped.__add2eOriginal = current;
  wrapped.__add2eActionLock = ADD2E_INITIATIVE_ACTION_LOCK_VERSION;
  globalThis[name] = wrapped;
  return true;
}

function installActionLocks() {
  if (actionLocksInstalled) return true;
  for (const fn of ["add2eAttackRoll", "add2eCastSpell", "cast_spell", "add2eExecuteClassFeatureOnUse"]) wrapActionFunction(fn);
  actionLocksInstalled = true;
  return true;
}

function patchTokenMethod(proto, methodName, wrapper) {
  const original = proto?.[methodName];
  if (typeof original !== "function") return false;
  if (original.__add2eTurnLock === ADD2E_INDIVIDUAL_TURN_LOCK_VERSION) return false;
  proto[methodName] = wrapper(original);
  proto[methodName].__add2eOriginal = original;
  proto[methodName].__add2eTurnLock = ADD2E_INDIVIDUAL_TURN_LOCK_VERSION;
  return true;
}

function installTokenInteractionLock() {
  if (tokenPatchInstalled) return true;
  const proto = globalThis.Token?.prototype;
  if (!proto) return false;
  const blockDrag = original => function add2eBlockDragOutOfTurn(...args) {
    if (!canTokenActNow(this, { notify: true })) { clearMovementTrailAggressive(this); return false; }
    return original.apply(this, args);
  };
  const allowClickAndOpenHud = original => function add2eAllowClickAndOpenHud(...args) {
    const result = original.apply(this, args);
    renderHudForToken(this, { force: true, reason: "token-click" });
    return result;
  };
  for (const methodName of ["_onDragLeftStart", "_onDragLeftMove", "_onDragLeftDrop"]) patchTokenMethod(proto, methodName, blockDrag);
  for (const methodName of ["_onClickLeft", "_onClickLeft2"]) patchTokenMethod(proto, methodName, allowClickAndOpenHud);
  tokenPatchInstalled = true;
  game.add2e = game.add2e ?? {};
  game.add2e.individualTurnLockVersion = ADD2E_INDIVIDUAL_TURN_LOCK_VERSION;
  return true;
}

function patchFlagBlock(cls) {
  const proto = cls?.prototype;
  if (!proto?.setFlag || proto.setFlag.__add2eNoMovementHistory === ADD2E_MOVEMENT_HISTORY_DISABLED_VERSION) return false;
  const original = proto.setFlag.__add2eOriginal ?? proto.setFlag;
  proto.setFlag = function add2eNoMovementHistory(scope, key, value, ...rest) {
    if (scope === "add2e" && ["movementTurnKey", "movementSpentMeters", "lastAllowedPosition", "movementScale"].includes(String(key))) return Promise.resolve(this);
    return original.call(this, scope, key, value, ...rest);
  };
  proto.setFlag.__add2eOriginal = original;
  proto.setFlag.__add2eNoMovementHistory = ADD2E_MOVEMENT_HISTORY_DISABLED_VERSION;
  return true;
}

function installMovementHistoryBlock() {
  if (flagPatchInstalled) return true;
  patchFlagBlock(globalThis.Actor);
  patchFlagBlock(globalThis.TokenDocument ?? foundry?.documents?.TokenDocument);
  flagPatchInstalled = true;
  return true;
}

function escapeHtml(value) {
  try { return foundry.utils.escapeHTML(String(value ?? "")); }
  catch (_e) { const div = document.createElement("div"); div.textContent = String(value ?? ""); return div.innerHTML; }
}

function speakerActor(speaker = {}) {
  if (speaker.token && canvas?.tokens?.get) return canvas.tokens.get(speaker.token)?.actor ?? null;
  if (speaker.actor) return game.actors?.get?.(speaker.actor) ?? null;
  return null;
}

function isInitiativeMessage(message, data = {}) {
  const flags = data.flags ?? message?.flags ?? {};
  const flavor = String(data.flavor ?? message?.flavor ?? "").toLowerCase();
  const speaker = data.speaker ?? message?.speaker ?? {};
  const roll = (data.rolls ?? message?.rolls ?? [])?.[0] ?? null;
  const formula = String(roll?.formula ?? roll?._formula ?? "").replace(/\s+/g, "").toLowerCase();
  return Boolean(flags?.add2e?.initiativeRoll || flags?.core?.initiativeRoll || flavor.includes("initiative") || (formula === "1d6" && speaker?.actor));
}

function initiativeChatContent(message, data = {}) {
  const speaker = data.speaker ?? message?.speaker ?? {};
  const actor = speakerActor(speaker);
  const name = actor?.name ?? speaker.alias ?? "Combattant";
  const img = actor?.img ?? ADD2E_INITIATIVE_D6_ICON;
  const roll = (data.rolls ?? message?.rolls ?? [])?.[0] ?? null;
  const total = Number.isFinite(Number(roll?.total ?? roll?._total)) ? Number(roll?.total ?? roll?._total) : "—";
  return `<div class="add2e-init-chat-card" style="border:1px solid #7c4a16;border-radius:10px;background:linear-gradient(135deg,#2a1708,#4b2a0e);color:#f7ead2;padding:10px 12px;box-shadow:0 2px 8px rgba(0,0,0,.35);font-family:serif;"><div style="display:flex;align-items:center;gap:10px;"><img src="${escapeHtml(img)}" alt="" style="width:42px;height:42px;border-radius:8px;object-fit:cover;border:1px solid rgba(255,255,255,.25);background:#111;"><div style="flex:1;min-width:0;"><div style="font-size:15px;font-weight:700;letter-spacing:.03em;text-transform:uppercase;color:#ffd891;">Initiative</div><div style="font-size:18px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(name)}</div></div><div style="text-align:center;min-width:58px;background:rgba(255,255,255,.12);border:1px solid rgba(255,216,145,.35);border-radius:8px;padding:5px 8px;"><div style="font-size:11px;text-transform:uppercase;color:#ffd891;">D6</div><div style="font-size:26px;line-height:1;font-weight:900;color:#fff;">${escapeHtml(total)}</div></div></div><div style="margin-top:8px;font-size:12px;color:#ead6b0;display:flex;justify-content:space-between;gap:10px;"><span>Le plus petit résultat agit en premier.</span><span style="white-space:nowrap;">1d6</span></div></div>`;
}

function installInitiativeChatCard() {
  if (chatCardInstalled) return true;
  chatCardInstalled = true;
  Hooks.on("preCreateChatMessage", (message, data) => {
    try {
      if (!isInitiativeMessage(message, data)) return;
      message.updateSource?.({ content: initiativeChatContent(message, data), flavor: "Initiative ADD2E", "flags.add2e.initiativeRoll": true });
    } catch (err) { console.warn(`${TAG}[CHAT][ERROR]`, err); }
  });
}

function patchInitiativeIcons(root = document) {
  const scope = root?.jquery ? root[0] : root;
  if (!scope?.querySelectorAll) return 0;
  let count = 0;
  for (const button of scope.querySelectorAll("#combat-tracker .combatant button.combatant-control.roll,#combat .combatant button.combatant-control.roll,[data-combatant-id] [data-action='rollInitiative']")) {
    const icon = button.querySelector?.("i.fa-dice-d20, i.fa-dice-d6, i.fa-dice");
    if (icon && !button.querySelector(".add2e-init-d6-icon")) {
      const img = document.createElement("img");
      img.src = ADD2E_INITIATIVE_D6_ICON;
      img.alt = "D6";
      img.className = "add2e-init-d6-icon";
      img.style.width = "22px";
      img.style.height = "22px";
      img.style.objectFit = "contain";
      icon.replaceWith(img);
      count++;
    }
    button.title = "Lancer l'initiative ADD2E (1d6, le plus petit commence)";
  }
  return count;
}

function exposeGlobals() {
  game.add2e = game.add2e ?? {};
  game.add2e.initiativeVersion = ADD2E_INITIATIVE_VERSION;
  game.add2e.initiativeHudFollowVersion = ADD2E_INITIATIVE_HUD_FOLLOW_VERSION;
  game.add2e.movementHistoryDisabledVersion = ADD2E_MOVEMENT_HISTORY_DISABLED_VERSION;
  game.add2e.individualTurnLockVersion = ADD2E_INDIVIDUAL_TURN_LOCK_VERSION;
  globalThis.add2eSortInitiativeAscending = sortInitiativeAscending;
  globalThis.triInitiativeAscendant = sortInitiativeAscending;
  globalThis.add2eCanActorActNow = canActorActNow;
  globalThis.add2eCanTokenInteractNow = canTokenActNow;
  globalThis.add2eSyncActionHudToCombatant = syncHudToCombatant;
  globalThis.add2eClearFoundryMovementTrail = clearMovementTrailAggressive;
  globalThis.add2eForceFirstSortedTurn = forceFirstSortedTurn;
}

function installHooks() {
  Hooks.on("preUpdateToken", (tokenDoc, changes, options, userId) => {
    if (options?.add2eIgnoreTurnLock || !tokenPositionChanged(changes)) return;
    const user = game.users?.get?.(userId);
    if (user?.isGM) return;
    if (!canTokenActNow(tokenDoc, { notify: game.user?.id === userId })) return false;
  });
  Hooks.on("updateCombatant", (combatant, changes, options) => { if (!options?.add2eInitiativeSort && foundry.utils.hasProperty(changes ?? {}, "initiative")) scheduleInitiativeSort(combatant.combat ?? game.combat); });
  Hooks.on("createCombatant", (combatant, options) => { if (!options?.add2eInitiativeSort) scheduleInitiativeSort(combatant.combat ?? game.combat); });
  Hooks.on("deleteCombatant", (combatant, options) => { if (!options?.add2eInitiativeSort) scheduleInitiativeSort(combatant.combat ?? game.combat); });
  Hooks.on("updateCombat", (combat, changes, options) => {
    if (options?.add2eInitiativeSort) return;
    if (foundry.utils.hasProperty(changes ?? {}, "started") && combat?.started) { setTimeout(() => forceFirstSortedTurn(combat, "start"), 80); return; }
    if (foundry.utils.hasProperty(changes ?? {}, "turn") || foundry.utils.hasProperty(changes ?? {}, "round") || foundry.utils.hasProperty(changes ?? {}, "current")) {
      applySortedTurns(combat);
      scheduleHudFollow(combat, { forceOpen: false, reason: "updateCombat" });
      scheduleClearMovementTrail();
      ui.combat?.render?.(true);
    }
  });
  Hooks.on("controlToken", (token, controlled) => { scheduleClearMovementTrail(token); if (controlled) renderHudForToken(token, { force: true, reason: "controlToken" }); });
  Hooks.on("hoverToken", token => scheduleClearMovementTrail(token));
  Hooks.on("refreshToken", token => scheduleClearMovementTrail(token));
  Hooks.on("updateToken", tokenDoc => scheduleClearMovementTrail(tokenDoc?.object ?? null));
  Hooks.on("combatTurn", combat => { scheduleHudFollow(combat, { forceOpen: false, reason: "combatTurn" }); scheduleClearMovementTrail(); });
  Hooks.on("combatRound", combat => { scheduleHudFollow(combat, { forceOpen: false, reason: "combatRound" }); scheduleClearMovementTrail(); });
  Hooks.on("deleteCombat", () => { lastHudKey = ""; scheduleClearMovementTrail(); });
  Hooks.on("renderCombatTracker", (app, html) => patchInitiativeIcons(html));
  Hooks.on("renderSidebarTab", (app, html) => { if (app?.options?.id === "combat" || app?.tabName === "combat" || app?.id === "combat") patchInitiativeIcons(html); });
  Hooks.on("canvasReady", () => { installTokenInteractionLock(); scheduleClearMovementTrail(); });
  installInitiativeChatCard();
}

Hooks.once("init", configureInitiative);
Hooks.once("ready", () => {
  configureInitiative();
  installCombatPatch();
  installMovementHistoryBlock();
  installTokenInteractionLock();
  installActionLocks();
  exposeGlobals();
  installHooks();
  patchInitiativeIcons(document);
  setTimeout(() => patchInitiativeIcons(document), 500);
  setTimeout(() => patchInitiativeIcons(document), 1500);
  setTimeout(() => scheduleInitiativeSort(game.combat), 700);
  setTimeout(() => scheduleHudFollow(game.combat, { forceOpen: false, reason: "ready" }), 1000);
  setTimeout(() => scheduleClearMovementTrail(), 1200);
});

export {
  configureInitiative as add2eConfigureInitiative,
  sortInitiativeAscending as add2eSortInitiativeAscending,
  canActorActNow as add2eCanActorActNow,
  syncHudToCombatant as add2eSyncActionHudToCombatant,
  installMovementHistoryBlock as add2eDisableMovementHistoryRecording
};
