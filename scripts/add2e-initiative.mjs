// scripts/add2e-initiative.mjs
// ADD2E — Initiative propre.
// Règle système : initiative 1d6, le plus petit résultat agit en premier.
// Responsabilités : initiative, tri réel des tours, flèches suivant/précédent,
// carte de chat, icône D6, verrou des actions hors tour, suivi HUD.
// Le fichier ne gère pas le déplacement ; il neutralise seulement l'historique visuel/persisté.

const ADD2E_INITIATIVE_VERSION = "2026-05-30-d6-low-first-native-sort-v4-no-logs";
const ADD2E_INITIATIVE_ACTION_LOCK_VERSION = "2026-05-29-d6-low-first-action-lock-v2";
const ADD2E_INITIATIVE_CHAT_VERSION = "2026-05-29-d6-low-first-chat-v1";
const ADD2E_INITIATIVE_HUD_FOLLOW_VERSION = "2026-05-30-d6-low-first-hud-follow-refresh-sync-v4";
const ADD2E_MOVEMENT_HISTORY_DISABLED_VERSION = "2026-05-30-no-movement-history-record-v5";
const ADD2E_INDIVIDUAL_TURN_LOCK_VERSION = "2026-05-29-individual-turn-lock-v1";
const ADD2E_INITIATIVE_REFRESH_SYNC_VERSION = "2026-05-30-refresh-combat-tracker-token-sync-v4";
const ADD2E_INITIATIVE_D6_ICON = "systems/add2e/assets/D6_3D_tracker.png";
const TAG = "[ADD2E][INIT]";

let configured = false;
let sorting = false;
let refreshSyncing = false;
let sortTimer = null;
let hudFollowTimer = null;
let refreshSyncTimer = null;
let movementTrailTimer = null;
let warningAt = 0;
let combatPatchInstalled = false;
let movementHistoryPatchInstalled = false;
let tokenHoverPatchInstalled = false;
let tokenInteractionLockInstalled = false;
let lastHudCombatantKey = "";

globalThis.ADD2E_INITIATIVE_VERSION = ADD2E_INITIATIVE_VERSION;
globalThis.ADD2E_INITIATIVE_ACTION_LOCK_VERSION = ADD2E_INITIATIVE_ACTION_LOCK_VERSION;
globalThis.ADD2E_INITIATIVE_CHAT_VERSION = ADD2E_INITIATIVE_CHAT_VERSION;
globalThis.ADD2E_INITIATIVE_HUD_FOLLOW_VERSION = ADD2E_INITIATIVE_HUD_FOLLOW_VERSION;
globalThis.ADD2E_MOVEMENT_HISTORY_DISABLED_VERSION = ADD2E_MOVEMENT_HISTORY_DISABLED_VERSION;
globalThis.ADD2E_INDIVIDUAL_TURN_LOCK_VERSION = ADD2E_INDIVIDUAL_TURN_LOCK_VERSION;
globalThis.ADD2E_INITIATIVE_REFRESH_SYNC_VERSION = ADD2E_INITIATIVE_REFRESH_SYNC_VERSION;

function configureInitiative() {
  if (configured) return;
  configured = true;
  CONFIG.Combat ??= {};
  CONFIG.Combat.initiative = { formula: "1d6", decimals: 2 };
}

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
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

function sortedTurnIndex(combat = game.combat) {
  const n = num(combat?.turn ?? combat?.current?.turn, 0);
  return n >= 0 ? Math.floor(n) : 0;
}

function activeCombatantId(combat = game.combat) {
  return combat?.current?.combatantId ?? combat?.combatant?.id ?? null;
}

function sortedIndexForActive(combat = game.combat, turns = sortedCombatants(combat)) {
  if (!turns.length) return 0;
  const byTurn = Math.max(0, Math.min(turns.length - 1, sortedTurnIndex(combat)));
  if (Number.isFinite(Number(combat?.turn ?? combat?.current?.turn))) return byTurn;
  const id = activeCombatantId(combat);
  const byId = id ? turns.findIndex(c => c.id === id) : -1;
  return byId >= 0 ? byId : byTurn;
}

function currentCombatant(combat = game.combat) {
  if (!combat?.started) return null;
  const turns = Array.isArray(combat?.turns) && combat.turns.length ? combat.turns : sortedCombatants(combat);
  if (!turns.length) return combat?.combatant ?? null;
  const index = sortedIndexForActive(combat, turns);
  return turns[index] ?? combat?.combatant ?? null;
}

function tokenFromCombatant(combatant) {
  return combatant?.token?.object ?? (combatant?.tokenId ? canvas?.tokens?.get?.(combatant.tokenId) : null) ?? null;
}

function safeClone(value) {
  try {
    return globalThis.foundry?.utils?.deepClone ? globalThis.foundry.utils.deepClone(value) : JSON.parse(JSON.stringify(value));
  } catch (_e) {
    return value ?? null;
  }
}

function add2eInitiativeDebug(label, combat = game.combat, extra = {}) {
  return {
    label,
    combatId: combat?.id ?? null,
    started: combat?.started ?? null,
    round: combat?.round ?? null,
    turn: combat?.turn ?? null,
    current: combat?.current ? safeClone(combat.current) : null,
    activeId: activeCombatantId(combat),
    sorted: sortedCombatants(combat).map(c => ({ id: c.id, name: c.name, initiative: c.initiative, sort: c.sort, tokenId: c.tokenId })),
    extra
  };
}

function hookSource(entry) {
  const fn = entry?.fn ?? entry?.callback ?? entry;
  if (typeof fn !== "function") return "";
  try { return Function.prototype.toString.call(fn); } catch (_e) { return ""; }
}

function cleanupHooksFromStore(store, hookName, predicate) {
  const entries = store?.[hookName];
  if (!Array.isArray(entries)) return 0;
  const before = entries.length;
  store[hookName] = entries.filter(entry => !predicate(hookSource(entry), entry));
  return before - store[hookName].length;
}

function cleanupLegacyHooks() {
  let removed = 0;
  const clean = store => {
    if (!store || typeof store !== "object") return;
    for (const hookName of ["updateCombatant", "updateCombat"]) {
      removed += cleanupHooksFromStore(store, hookName, source => (
        source.includes("triInitiativeAscendant") ||
        source.includes("add2eClearCombatMovementHistoryOnce") ||
        source.includes("add2eClearTokenMovementHistory") ||
        source.includes("add2ePurgeCombatantMovementHistory") ||
        source.includes("movementHistory") ||
        source.includes("showMovementHistory") ||
        source.includes("updateEmbeddedDocuments(\"Combatant\"")
      ));
    }
  };
  try { clean(Hooks.events); } catch (_e) {}
  try { clean(Hooks._hooks); } catch (_e) {}
  return removed;
}

function applyAscendingTurns(combat = game.combat, { forceFirst = false } = {}) {
  if (!combat) return false;
  const turns = sortedCombatants(combat);
  if (!turns.length) return false;
  let index = forceFirst ? 0 : sortedIndexForActive(combat, turns);
  index = Math.max(0, Math.min(turns.length - 1, index));
  try {
    combat.turns = turns;
    if (combat.started || forceFirst) {
      combat.turn = index;
      if (combat.current && typeof combat.current === "object") {
        combat.current.turn = index;
        combat.current.combatantId = turns[index]?.id ?? combat.current.combatantId;
      }
    }
    return true;
  } catch (err) {
    console.warn(`${TAG}[APPLY_TURNS][ERROR]`, err);
    return false;
  }
}

function selectActiveCombatantToken(combat = game.combat, { reason = "sync" } = {}) {
  if (!combat?.started) return false;
  const combatant = currentCombatant(combat);
  const token = tokenFromCombatant(combatant);
  if (!token?.control) {
    console.warn(`${TAG}[TOKEN_SYNC][NO_TOKEN]`, { reason, combatant: combatant?.name ?? null, combatantId: combatant?.id ?? null, tokenId: combatant?.tokenId ?? null });
    return false;
  }
  try {
    if (!token.controlled) token.control({ releaseOthers: true });
    const others = Array.from(canvas?.tokens?.controlled ?? []).filter(t => t?.id !== token.id);
    for (const other of others) other?.release?.();
    return true;
  } catch (err) {
    console.warn(`${TAG}[TOKEN_SYNC][ERROR]`, err);
    return false;
  }
}

async function syncCombatAfterRefresh(combat = game.combat, { reason = "refresh", render = true, selectToken = true } = {}) {
  if (!combat || refreshSyncing) return false;
  const sorted = sortedCombatants(combat);
  if (!sorted.length) return false;
  refreshSyncing = true;
  try {
    combat.setupTurns?.();
    combat.turns = sorted;

    if (!combat.started) {
      if (render) ui.combat?.render?.(true);
      return true;
    }

    const index = sortedIndexForActive(combat, sorted);
    const active = sorted[index] ?? null;
    const needsUpdate = Number(combat.turn) !== index;
    if (needsUpdate && game.user?.isGM) await combat.update({ turn: index }, { add2eRefreshSync: true });

    combat.turns = sorted;
    combat.turn = index;
    if (combat.current && typeof combat.current === "object") {
      combat.current.round = Math.max(1, Number(combat.round ?? combat.current.round ?? 1));
      combat.current.turn = index;
      combat.current.combatantId = active?.id ?? combat.current.combatantId;
    }
    if (render) ui.combat?.render?.(true);
    if (selectToken) setTimeout(() => selectActiveCombatantToken(combat, { reason }), 80);
    scheduleHudFollow(combat, { forceOpen: false, reason });
    scheduleClearMovementTrail();
    return true;
  } catch (err) {
    console.warn(`${TAG}[REFRESH_SYNC][ERROR]`, err);
    return false;
  } finally {
    refreshSyncing = false;
  }
}

function scheduleRefreshSync(combat = game.combat, { reason = "refresh", delay = 120, render = true, selectToken = true } = {}) {
  if (!combat) return;
  clearTimeout(refreshSyncTimer);
  refreshSyncTimer = setTimeout(() => syncCombatAfterRefresh(combat, { reason, render, selectToken }), delay);
}

async function updateCombatTurnBySortedIndex(combat, newIndex, { roundDelta = 0 } = {}) {
  const turns = sortedCombatants(combat);
  if (!turns.length) return combat;
  const index = Math.max(0, Math.min(turns.length - 1, Number(newIndex) || 0));
  const round = Math.max(1, Number(combat.round ?? 1) + roundDelta);
  const target = turns[index];
  await combat.update({ round, turn: index }, { add2eRefreshSync: true });
  try {
    combat.turns = turns;
    combat.turn = index;
    if (combat.current && typeof combat.current === "object") {
      combat.current.round = round;
      combat.current.turn = index;
      combat.current.combatantId = target?.id ?? combat.current.combatantId;
    }
  } catch (_e) {}
  ui.combat?.render?.(true);
  selectActiveCombatantToken(combat, { reason: "navigation" });
  scheduleHudFollow(combat, { forceOpen: false, reason: "navigation" });
  scheduleClearMovementTrail();
  return combat;
}

async function forceFirstSortedTurn(combat = game.combat, reason = "start") {
  if (!combat) return combat;
  const turns = sortedCombatants(combat);
  if (!turns.length) return combat;
  const round = Math.max(1, Number(combat.round ?? 1));
  await combat.update({ round, turn: 0 }, { add2eRefreshSync: true });
  try {
    combat.turns = turns;
    combat.turn = 0;
    if (combat.current && typeof combat.current === "object") {
      combat.current.round = round;
      combat.current.turn = 0;
      combat.current.combatantId = turns[0]?.id ?? combat.current.combatantId;
    }
  } catch (_e) {}
  ui.combat?.render?.(true);
  selectActiveCombatantToken(combat, { reason });
  scheduleHudFollow(combat, { forceOpen: false, reason });
  scheduleClearMovementTrail();
  return combat;
}

async function advanceSortedTurn(combat = game.combat, direction = 1) {
  if (!combat) return combat;
  combat.setupTurns?.();
  applyAscendingTurns(combat, { reason: "advance" });
  const turns = sortedCombatants(combat);
  if (!turns.length) return combat;
  const rawTurn = Number(combat.turn ?? combat.current?.turn);
  if (!Number.isFinite(rawTurn) || rawTurn < 0) return updateCombatTurnBySortedIndex(combat, direction >= 0 ? 0 : turns.length - 1);
  const index = Math.max(0, Math.min(turns.length - 1, Math.floor(rawTurn)));
  let next = index + direction;
  let roundDelta = 0;
  if (next >= turns.length) { next = 0; roundDelta = 1; }
  else if (next < 0) { next = turns.length - 1; roundDelta = Number(combat.round ?? 1) > 1 ? -1 : 0; }
  return updateCombatTurnBySortedIndex(combat, next, { roundDelta });
}

function patchNativeCombatantSort(target) {
  if (!target || typeof target._sortCombatants !== "function") return false;
  if (target._sortCombatants.__add2eLowFirstNativeSort === ADD2E_INITIATIVE_VERSION) return false;
  const original = target._sortCombatants.__add2eOriginal ?? target._sortCombatants;
  target._sortCombatants = function add2eLowFirstNativeCombatSort(a, b) {
    if (game?.system?.id === "add2e") return compareCombatantsAscending(a, b);
    return original.call(this, a, b);
  };
  target._sortCombatants.__add2eLowFirstNativeSort = ADD2E_INITIATIVE_VERSION;
  target._sortCombatants.__add2eOriginal = original;
  return true;
}

function installCombatPatch() {
  if (combatPatchInstalled) return true;
  const proto = globalThis.Combat?.prototype;
  const ctor = globalThis.Combat;
  if (!proto) return false;

  patchNativeCombatantSort(proto);
  patchNativeCombatantSort(ctor);

  if (proto.setupTurns && proto.setupTurns.__add2eD6LowFirstTurnsPatch !== ADD2E_INITIATIVE_VERSION) {
    const originalSetupTurns = proto.setupTurns.__add2eOriginal ?? proto.setupTurns;
    proto.setupTurns = function add2eD6LowFirstSetupTurns(...args) {
      const result = originalSetupTurns.apply(this, args);
      try { if (game?.system?.id === "add2e") applyAscendingTurns(this, { reason: "setupTurnsPatch" }); }
      catch (err) { console.warn(`${TAG}[SETUP_TURNS_PATCH][ERROR]`, err); }
      return result;
    };
    proto.setupTurns.__add2eD6LowFirstTurnsPatch = ADD2E_INITIATIVE_VERSION;
    proto.setupTurns.__add2eOriginal = originalSetupTurns;
  }

  if (proto.startCombat && proto.startCombat.__add2eD6LowFirstStartPatch !== ADD2E_INITIATIVE_VERSION) {
    const originalStartCombat = proto.startCombat.__add2eOriginal ?? proto.startCombat;
    proto.startCombat = async function add2eD6LowFirstStartCombat(...args) {
      const result = await originalStartCombat.apply(this, args);
      if (game?.system?.id === "add2e") await forceFirstSortedTurn(this, "startCombat");
      return result;
    };
    proto.startCombat.__add2eD6LowFirstStartPatch = ADD2E_INITIATIVE_VERSION;
    proto.startCombat.__add2eOriginal = originalStartCombat;
  }

  if (proto.nextTurn && proto.nextTurn.__add2eD6LowFirstNavigationPatch !== ADD2E_INITIATIVE_VERSION) {
    const originalNextTurn = proto.nextTurn.__add2eOriginal ?? proto.nextTurn;
    proto.nextTurn = function add2eD6LowFirstNextTurn(...args) {
      if (game?.system?.id !== "add2e") return originalNextTurn.apply(this, args);
      return advanceSortedTurn(this, 1);
    };
    proto.nextTurn.__add2eD6LowFirstNavigationPatch = ADD2E_INITIATIVE_VERSION;
    proto.nextTurn.__add2eOriginal = originalNextTurn;
  }

  if (proto.previousTurn && proto.previousTurn.__add2eD6LowFirstNavigationPatch !== ADD2E_INITIATIVE_VERSION) {
    const originalPreviousTurn = proto.previousTurn.__add2eOriginal ?? proto.previousTurn;
    proto.previousTurn = function add2eD6LowFirstPreviousTurn(...args) {
      if (game?.system?.id !== "add2e") return originalPreviousTurn.apply(this, args);
      return advanceSortedTurn(this, -1);
    };
    proto.previousTurn.__add2eD6LowFirstNavigationPatch = ADD2E_INITIATIVE_VERSION;
    proto.previousTurn.__add2eOriginal = originalPreviousTurn;
  }

  combatPatchInstalled = true;
  return true;
}

async function sortInitiativeAscending(combat = game.combat) {
  if (!combat || sorting) return false;
  const combatants = Array.from(combat.combatants ?? []);
  if (!combatants.length) return false;
  const sorted = sortedCombatants(combat);
  const updates = sorted.map((combatant, index) => ({ _id: combatant.id, sort: index })).filter(update => {
    const current = combatants.find(c => c.id === update._id);
    return current && Number(current.sort) !== Number(update.sort);
  });
  sorting = true;
  try {
    if (updates.length) await combat.updateEmbeddedDocuments("Combatant", updates, { add2eInitiativeSort: true });
    combat.setupTurns?.();
    applyAscendingTurns(combat, { reason: "sort" });
    ui.combat?.render?.(true);
    if (combat.started) scheduleRefreshSync(combat, { reason: "sort", delay: 60 });
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

function escapeHtml(value) {
  try { return globalThis.foundry?.utils?.escapeHTML ? globalThis.foundry.utils.escapeHTML(String(value ?? "")) : String(value ?? ""); }
  catch (_e) { const div = document.createElement("div"); div.textContent = String(value ?? ""); return div.innerHTML; }
}

function speakerActor(speaker = {}) {
  if (speaker.token && canvas?.tokens?.get) {
    const token = canvas.tokens.get(speaker.token);
    if (token?.actor) return token.actor;
  }
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
  return formula === "1d6" && !!speaker?.actor && game.combat?.combatants?.some?.(c => c.actor?.id === speaker.actor);
}

function initiativeTotal(message, data = {}) {
  const roll = (data.rolls ?? message?.rolls ?? [])?.[0] ?? null;
  const total = Number(roll?.total ?? roll?._total);
  return Number.isFinite(total) ? total : null;
}

function initiativeChatContent(message, data = {}) {
  const speaker = data.speaker ?? message?.speaker ?? {};
  const actor = speakerActor(speaker);
  const token = speakerToken(speaker);
  const name = token?.name ?? actor?.name ?? speaker.alias ?? "Combattant";
  const img = token?.document?.texture?.src ?? actor?.img ?? ADD2E_INITIATIVE_D6_ICON;
  const result = initiativeTotal(message, data) ?? "—";
  return `<div class="add2e-init-chat-card" style="border:1px solid #7c4a16;border-radius:10px;background:linear-gradient(135deg,#2a1708,#4b2a0e);color:#f7ead2;padding:10px 12px;box-shadow:0 2px 8px rgba(0,0,0,.35);font-family:serif;"><div style="display:flex;align-items:center;gap:10px;"><img src="${escapeHtml(img)}" alt="" style="width:42px;height:42px;border-radius:8px;object-fit:cover;border:1px solid rgba(255,255,255,.25);background:#111;"><div style="flex:1;min-width:0;"><div style="font-size:15px;font-weight:700;letter-spacing:.03em;text-transform:uppercase;color:#ffd891;">Initiative</div><div style="font-size:18px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(name)}</div></div><div style="text-align:center;min-width:58px;background:rgba(255,255,255,.12);border:1px solid rgba(255,216,145,.35);border-radius:8px;padding:5px 8px;"><div style="font-size:11px;text-transform:uppercase;color:#ffd891;">D6</div><div style="font-size:26px;line-height:1;font-weight:900;color:#ffffff;">${escapeHtml(result)}</div></div></div><div style="margin-top:8px;font-size:12px;color:#ead6b0;display:flex;justify-content:space-between;gap:10px;"><span>Le plus petit résultat agit en premier.</span><span style="white-space:nowrap;">1d6</span></div></div>`;
}

function installInitiativeChatCard() {
  if (globalThis.__ADD2E_INIT_CHAT_CARD_INSTALLED === ADD2E_INITIATIVE_CHAT_VERSION) return;
  globalThis.__ADD2E_INIT_CHAT_CARD_INSTALLED = ADD2E_INITIATIVE_CHAT_VERSION;
  Hooks.on("preCreateChatMessage", (message, data) => {
    try {
      if (!isInitiativeMessage(message, data)) return;
      message.updateSource?.({
        content: initiativeChatContent(message, data),
        flavor: "Initiative ADD2E",
        "flags.add2e.initiativeRoll": true,
        "flags.add2e.initiativeChatCardVersion": ADD2E_INITIATIVE_CHAT_VERSION
      });
    } catch (err) {
      console.warn(`${TAG}[CHAT][ERROR]`, err);
    }
  });
}

function combatantMatchesActor(combatant, actor) {
  if (!combatant || !actor) return false;
  if (combatant.actor?.id && combatant.actor.id === actor.id) return true;
  if (combatant.actorId && combatant.actorId === actor.id) return true;
  return false;
}

function combatActive(combat = game.combat) {
  return Boolean(combat && combat.started && currentCombatant(combat));
}

function notifyNotTurn(actor = null) {
  const now = Date.now();
  if (now - warningAt < 900) return;
  warningAt = now;
  const active = currentCombatant();
  const activeName = active?.name ?? active?.actor?.name ?? "l'acteur actif";
  const actorName = actor?.name ? `${actor.name} ne peut pas agir.` : "Cet acteur ne peut pas agir.";
  ui.notifications?.info?.(`${actorName} C'est le tour de ${activeName}.`);
}

function canActorActNow(actor, { notify = false } = {}) {
  const combat = game.combat;
  if (!combatActive(combat)) return true;
  if (game.user?.isGM) return true;
  if (combatantMatchesActor(currentCombatant(combat), actor)) return true;
  if (notify) notifyNotTurn(actor);
  return false;
}

function hasProperty(obj, path) {
  return globalThis.foundry?.utils?.hasProperty ? globalThis.foundry.utils.hasProperty(obj, path) : path in (obj ?? {});
}

function isTokenPositionUpdate(changes = {}) {
  return hasProperty(changes, "x") || hasProperty(changes, "y") || hasProperty(changes, "elevation") || hasProperty(changes, "rotation");
}

function actorFromTokenDocument(tokenDoc) {
  return tokenDoc?.actor ?? tokenDoc?.object?.actor ?? null;
}

function canTokenInteractNow(tokenOrDoc, { notify = false } = {}) {
  if (!game.combat?.started) return true;
  if (game.user?.isGM) return true;
  const actor = tokenOrDoc?.actor ?? tokenOrDoc?.object?.actor ?? actorFromTokenDocument(tokenOrDoc);
  return canActorActNow(actor, { notify });
}

function blockOutOfTurnTokenInteraction(tokenOrDoc, { notify = true } = {}) {
  const ok = canTokenInteractNow(tokenOrDoc, { notify });
  if (!ok) {
    clearFoundryMovementTrailAggressive(tokenOrDoc?.object ?? tokenOrDoc ?? null);
    return false;
  }
  return true;
}

function patchTokenInteractionMethod(proto, methodName) {
  const original = proto?.[methodName];
  if (typeof original !== "function") return false;
  if (original.__add2eIndividualTurnLock === ADD2E_INDIVIDUAL_TURN_LOCK_VERSION) return false;
  proto[methodName] = function add2eIndividualTurnLock(...args) {
    if (!blockOutOfTurnTokenInteraction(this, { notify: true })) return false;
    return original.apply(this, args);
  };
  proto[methodName].__add2eIndividualTurnLock = ADD2E_INDIVIDUAL_TURN_LOCK_VERSION;
  proto[methodName].__add2eOriginal = original;
  return true;
}

function installTokenInteractionLock() {
  if (tokenInteractionLockInstalled) return true;
  const proto = globalThis.Token?.prototype;
  if (!proto) return false;
  for (const methodName of ["_onDragLeftStart", "_onDragLeftMove", "_onDragLeftDrop", "_onDragLeftCancel", "_onClickLeft2"]) patchTokenInteractionMethod(proto, methodName);
  tokenInteractionLockInstalled = true;
  game.add2e = game.add2e ?? {};
  game.add2e.individualTurnLockVersion = ADD2E_INDIVIDUAL_TURN_LOCK_VERSION;
  return true;
}

function resolveActionActor(argsLike) {
  const args = Array.isArray(argsLike) ? argsLike : [];
  const first = args[0] ?? null;
  const source = first && typeof first === "object" ? first : {};
  if (source.actor) return source.actor;
  if (source.actorId) return game.actors?.get?.(source.actorId) ?? null;
  if (source.token?.actor) return source.token.actor;
  if (source.tokenId && canvas?.tokens?.get?.(source.tokenId)?.actor) return canvas.tokens.get(source.tokenId).actor;
  return canvas?.tokens?.controlled?.[0]?.actor ?? game.user?.character ?? null;
}

function wrapActionFunction(name) {
  const current = globalThis[name];
  if (typeof current !== "function") return false;
  if (current.__add2eCleanInitiativeActionLock === ADD2E_INITIATIVE_ACTION_LOCK_VERSION) return true;
  const wrapped = async function add2eCleanInitiativeActionLock(...args) {
    const actor = resolveActionActor(args);
    if (!canActorActNow(actor, { notify: true })) return false;
    return current.apply(this, args);
  };
  wrapped.__add2eCleanInitiativeActionLock = ADD2E_INITIATIVE_ACTION_LOCK_VERSION;
  wrapped.__add2eOriginal = current;
  globalThis[name] = wrapped;
  return true;
}

function installActionLocks() {
  wrapActionFunction("add2eAttackRoll");
  wrapActionFunction("add2eCastSpell");
  wrapActionFunction("cast_spell");
  wrapActionFunction("add2eExecuteClassFeatureOnUse");
}

function makeD6Image() {
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

function isInitiativeButton(button) {
  if (!button?.closest) return false;
  const row = button.closest(".combatant, li[data-combatant-id], [data-combatant-id]");
  if (!row) return false;
  return Boolean(button.matches?.("button.combatant-control.roll") || button.matches?.("[data-action='rollInitiative']") || button.matches?.("[data-control='rollInitiative']") || button.classList?.contains("roll"));
}

function patchInitiativeButton(button) {
  if (!isInitiativeButton(button)) return false;
  const icon = button.querySelector?.("i.fa-dice-d20, i.fa-dice-d6, i.fa-dice");
  if (icon && !button.querySelector(".add2e-init-d6-icon")) icon.replaceWith(makeD6Image());
  button.style.setProperty("background-image", `url('${ADD2E_INITIATIVE_D6_ICON}')`, "important");
  button.style.setProperty("background-size", "contain", "important");
  button.style.setProperty("background-repeat", "no-repeat", "important");
  button.style.setProperty("background-position", "center", "important");
  button.dataset.add2eD6InitiativeIcon = "1";
  button.title = "Lancer l'initiative ADD2E (1d6, le plus petit commence)";
  return true;
}

function patchInitiativeIcons(root = document) {
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
    for (const selector of selectors) for (const el of scope.querySelectorAll(selector)) elements.add(el);
    let changed = 0;
    for (const el of elements) if (patchInitiativeButton(el)) changed++;
    return changed;
  } catch (err) {
    console.warn(`${TAG}[D6_ICON][ERROR]`, err);
    return 0;
  }
}

function actionHudIsOpen() {
  return Boolean(document.getElementById("add2e-action-hud"));
}

function syncActionHudToCombatant(combat = game.combat, { forceOpen = false, reason = "combat" } = {}) {
  if (!combat?.started) return false;
  applyAscendingTurns(combat, { reason: `hud-${reason}` });
  const combatant = currentCombatant(combat);
  const actor = combatant?.actor ?? null;
  if (!actor) return false;
  if (!forceOpen && !actionHudIsOpen()) return false;
  const token = tokenFromCombatant(combatant);
  const key = `${combat?.id ?? "combat"}.${combat?.turn ?? combat?.current?.turn ?? 0}.${combatant.id}.${actor.id}.${token?.id ?? "no-token"}`;
  if (lastHudCombatantKey === key && reason !== "manual") return true;
  lastHudCombatantKey = key;
  try {
    if (typeof globalThis.add2eRenderActionHud === "function") {
      globalThis.add2eRenderActionHud(actor, token, { reason: `initiative-${reason}` });
      return true;
    }
    if (typeof game.add2e?.openActionHud === "function") {
      game.add2e.openActionHud(actor);
      return true;
    }
  } catch (err) {
    console.warn(`${TAG}[HUD_FOLLOW][ERROR]`, err);
  }
  return false;
}

function scheduleHudFollow(combat = game.combat, { forceOpen = false, reason = "combat" } = {}) {
  if (!combat?.started) return;
  clearTimeout(hudFollowTimer);
  hudFollowTimer = setTimeout(() => syncActionHudToCombatant(combat, { forceOpen, reason }), 120);
}

function isMovementHistoryFlag(scope, key) {
  if (scope !== "add2e") return false;
  return ["movementTurnKey", "movementSpentMeters", "lastAllowedPosition", "movementScale"].includes(String(key));
}

function patchSetFlagHistoryBlock(cls) {
  const proto = cls?.prototype;
  if (!proto?.setFlag || proto.setFlag.__add2eNoMovementHistory === ADD2E_MOVEMENT_HISTORY_DISABLED_VERSION) return false;
  const original = proto.setFlag.__add2eOriginal ?? proto.setFlag;
  proto.setFlag = function add2eNoMovementHistorySetFlag(scope, key, value, ...rest) {
    if (isMovementHistoryFlag(scope, key)) return Promise.resolve(this);
    return original.call(this, scope, key, value, ...rest);
  };
  proto.setFlag.__add2eNoMovementHistory = ADD2E_MOVEMENT_HISTORY_DISABLED_VERSION;
  proto.setFlag.__add2eOriginal = original;
  return true;
}

function cleanupMovementHistoryHooksFromStore(store) {
  if (!store || typeof store !== "object") return 0;
  let removed = 0;
  removed += cleanupHooksFromStore(store, "updateToken", source => source.includes("computeTokenMovementScale") || source.includes("movementScale"));
  removed += cleanupHooksFromStore(store, "controlToken", source => source.includes("lastAllowedPosition") || source.includes("computeTokenMovementScale"));
  removed += cleanupHooksFromStore(store, "updateCombat", source => source.includes("movementTurnKey") || source.includes("movementSpentMeters"));
  return removed;
}

function cleanupMovementHistoryHooks() {
  let removed = 0;
  try { removed += cleanupMovementHistoryHooksFromStore(Hooks.events); } catch (_e) {}
  try { removed += cleanupMovementHistoryHooksFromStore(Hooks._hooks); } catch (_e) {}
  return removed;
}

function clearObjectMovementTrail(obj) {
  if (!obj) return;
  for (const target of [obj, obj.document].filter(Boolean)) {
    try { if (typeof target.clearMovementHistory === "function") target.clearMovementHistory(); } catch (_e) {}
    try { if (Array.isArray(target.movementHistory)) target.movementHistory.length = 0; } catch (_e) {}
    try { if (Array.isArray(target._movementHistory)) target._movementHistory.length = 0; } catch (_e) {}
    try { if (target._movementHistory?.clear) target._movementHistory.clear(); } catch (_e) {}
    try { if (target.movementHistory?.clear) target.movementHistory.clear(); } catch (_e) {}
  }
  try { obj._movementPath?.clear?.(); } catch (_e) {}
  try { obj._movementPath?.destroy?.({ children: true }); obj._movementPath = null; } catch (_e) {}
  try { obj._ruler?.reset?.(); } catch (_e) {}
  try { obj._ruler?.clear?.(); } catch (_e) {}
  try { obj._hoverRuler?.reset?.(); } catch (_e) {}
  try { obj._hoverRuler?.clear?.(); } catch (_e) {}
}

function clearFoundryMovementTrail(token = null) {
  const tokens = token ? [token] : Array.from(canvas?.tokens?.placeables ?? []);
  for (const t of tokens) clearObjectMovementTrail(t);
  try { canvas?.controls?.ruler?.reset?.(); } catch (_e) {}
  try { canvas?.controls?.ruler?.clear?.(); } catch (_e) {}
  try { canvas?.controls?.ruler?.clearPath?.(); } catch (_e) {}
  try { canvas?.controls?.ruler?._clear?.(); } catch (_e) {}
  for (const key of ["Token.Ruler", "movement", "Movement"]) {
    try { canvas?.interface?.grid?.clearHighlightLayer?.(key); } catch (_e) {}
  }
  return true;
}

function clearFoundryMovementTrailAggressive(token = null) {
  clearFoundryMovementTrail(token);
  try { requestAnimationFrame(() => clearFoundryMovementTrail(token)); } catch (_e) {}
  setTimeout(() => clearFoundryMovementTrail(token), 0);
  setTimeout(() => clearFoundryMovementTrail(token), 20);
  return true;
}

function scheduleClearMovementTrail(token = null) {
  clearFoundryMovementTrailAggressive(token);
  clearTimeout(movementTrailTimer);
  movementTrailTimer = setTimeout(() => clearFoundryMovementTrailAggressive(token), 40);
}

function patchTokenHoverMethod(proto, methodName) {
  const original = proto?.[methodName];
  if (typeof original !== "function") return false;
  if (original.__add2eNoMovementHoverTrail === ADD2E_MOVEMENT_HISTORY_DISABLED_VERSION) return false;
  proto[methodName] = function add2eNoMovementHoverTrail(...args) {
    clearFoundryMovementTrailAggressive(this);
    const result = original.apply(this, args);
    clearFoundryMovementTrailAggressive(this);
    return result;
  };
  proto[methodName].__add2eNoMovementHoverTrail = ADD2E_MOVEMENT_HISTORY_DISABLED_VERSION;
  proto[methodName].__add2eOriginal = original;
  return true;
}

function installTokenHoverPatch() {
  if (tokenHoverPatchInstalled) return true;
  const proto = globalThis.Token?.prototype;
  if (!proto) return false;
  for (const methodName of ["_onHoverIn", "_onHoverOut", "_onMouseOver", "_onMouseOut", "_onClickLeft", "refresh"]) patchTokenHoverMethod(proto, methodName);
  tokenHoverPatchInstalled = true;
  return true;
}

function installMovementHistoryBlock() {
  if (movementHistoryPatchInstalled) return true;
  movementHistoryPatchInstalled = true;
  patchSetFlagHistoryBlock(globalThis.Actor);
  patchSetFlagHistoryBlock(globalThis.TokenDocument ?? globalThis.foundry?.documents?.TokenDocument);
  cleanupMovementHistoryHooks();
  installTokenHoverPatch();
  game.add2e = game.add2e ?? {};
  game.add2e.movementHistoryDisabledVersion = ADD2E_MOVEMENT_HISTORY_DISABLED_VERSION;
  return true;
}

async function clearExistingMovementHistoryFlags() {
  if (!game.user?.isGM) return;
  const actorUpdates = [];
  for (const actor of game.actors ?? []) {
    if (actor?.flags?.add2e?.movementTurnKey !== undefined || actor?.flags?.add2e?.movementSpentMeters !== undefined) actorUpdates.push({ _id: actor.id, "flags.add2e.-=movementTurnKey": null, "flags.add2e.-=movementSpentMeters": null });
  }
  if (actorUpdates.length) await Actor.updateDocuments(actorUpdates, { add2eIgnoreMovementHistoryCleanup: true });
  for (const scene of game.scenes ?? []) {
    const tokenUpdates = [];
    for (const token of scene.tokens ?? []) {
      if (token?.flags?.add2e?.lastAllowedPosition !== undefined || token?.flags?.add2e?.movementScale !== undefined) tokenUpdates.push({ _id: token.id, "flags.add2e.-=lastAllowedPosition": null, "flags.add2e.-=movementScale": null });
    }
    if (tokenUpdates.length) await scene.updateEmbeddedDocuments("Token", tokenUpdates, { add2eIgnoreMovementHistoryCleanup: true });
  }
}

function exposeGlobals() {
  game.add2e = game.add2e ?? {};
  game.add2e.initiativeVersion = ADD2E_INITIATIVE_VERSION;
  game.add2e.initiativeHudFollowVersion = ADD2E_INITIATIVE_HUD_FOLLOW_VERSION;
  game.add2e.initiativeRefreshSyncVersion = ADD2E_INITIATIVE_REFRESH_SYNC_VERSION;
  game.add2e.movementHistoryDisabledVersion = ADD2E_MOVEMENT_HISTORY_DISABLED_VERSION;
  game.add2e.individualTurnLockVersion = ADD2E_INDIVIDUAL_TURN_LOCK_VERSION;
  globalThis.add2eConfigureInitiative = configureInitiative;
  globalThis.add2eSortInitiativeAscending = sortInitiativeAscending;
  globalThis.add2eScheduleInitiativeSort = scheduleInitiativeSort;
  globalThis.add2ePatchCombatTrackerInitiativeIcons = patchInitiativeIcons;
  globalThis.add2eCanActorActNow = canActorActNow;
  globalThis.add2eCanTokenInteractNow = canTokenInteractNow;
  globalThis.add2eSyncActionHudToCombatant = syncActionHudToCombatant;
  globalThis.add2eSyncCombatAfterRefresh = syncCombatAfterRefresh;
  globalThis.add2eScheduleRefreshSync = scheduleRefreshSync;
  globalThis.add2eDebugCombatState = add2eInitiativeDebug;
  globalThis.add2eSelectActiveCombatantToken = selectActiveCombatantToken;
  globalThis.add2eDisableMovementHistoryRecording = installMovementHistoryBlock;
  globalThis.add2eInstallIndividualTurnLock = installTokenInteractionLock;
  globalThis.add2eClearExistingMovementHistoryFlags = clearExistingMovementHistoryFlags;
  globalThis.add2eCleanupMovementHistoryHooks = cleanupMovementHistoryHooks;
  globalThis.add2eClearFoundryMovementTrail = clearFoundryMovementTrailAggressive;
  globalThis.add2eInstallTokenHoverPatch = installTokenHoverPatch;
  globalThis.add2eForceFirstSortedTurn = forceFirstSortedTurn;
  globalThis.triInitiativeAscendant = sortInitiativeAscending;
}

function installHooks() {
  Hooks.on("preUpdateToken", (tokenDoc, changes, options, userId) => {
    if (options?.add2eIgnoreTurnLock || !isTokenPositionUpdate(changes)) return;
    const user = game.users?.get?.(userId);
    if (user?.isGM) return;
    if (!blockOutOfTurnTokenInteraction(tokenDoc, { notify: game.user?.id === userId })) return false;
  });
  Hooks.on("updateCombatant", (combatant, changes, options) => {
    if (options?.add2eInitiativeSort) return;
    if (hasProperty(changes ?? {}, "initiative")) scheduleInitiativeSort(combatant.combat ?? game.combat);
  });
  Hooks.on("createCombatant", (combatant, options) => {
    if (!options?.add2eInitiativeSort) scheduleInitiativeSort(combatant.combat ?? game.combat);
  });
  Hooks.on("deleteCombatant", (combatant, options) => {
    if (!options?.add2eInitiativeSort) scheduleInitiativeSort(combatant.combat ?? game.combat);
  });
  Hooks.on("updateCombat", (combat, changes, options) => {
    if (options?.add2eInitiativeSort || options?.add2eRefreshSync) return;
    if (hasProperty(changes ?? {}, "started") && combat?.started) {
      setTimeout(() => forceFirstSortedTurn(combat, "updateCombat-started"), 80);
      return;
    }
    if (hasProperty(changes ?? {}, "turn") || hasProperty(changes ?? {}, "round") || hasProperty(changes ?? {}, "current")) {
      applyAscendingTurns(combat, { reason: "updateCombat" });
      if (combat?.started) scheduleRefreshSync(combat, { reason: "updateCombat", delay: 80 });
      scheduleHudFollow(combat, { forceOpen: false, reason: "updateCombat" });
      scheduleClearMovementTrail();
      ui.combat?.render?.(true);
    }
  });
  Hooks.on("combatTurn", combat => {
    scheduleRefreshSync(combat, { reason: "combatTurn", delay: 40 });
    scheduleHudFollow(combat, { forceOpen: false, reason: "combatTurn" });
    scheduleClearMovementTrail();
  });
  Hooks.on("combatRound", combat => {
    scheduleRefreshSync(combat, { reason: "combatRound", delay: 40 });
    scheduleHudFollow(combat, { forceOpen: false, reason: "combatRound" });
    scheduleClearMovementTrail();
  });
  Hooks.on("hoverToken", token => clearFoundryMovementTrailAggressive(token));
  Hooks.on("updateToken", tokenDoc => clearFoundryMovementTrailAggressive(tokenDoc?.object ?? null));
  Hooks.on("controlToken", token => clearFoundryMovementTrailAggressive(token));
  Hooks.on("refreshToken", token => clearFoundryMovementTrailAggressive(token));
  Hooks.on("canvasReady", () => {
    installTokenHoverPatch();
    installTokenInteractionLock();
    scheduleRefreshSync(game.combat, { reason: "canvasReady", delay: 180, selectToken: game.combat?.started });
    scheduleClearMovementTrail();
  });
  Hooks.on("deleteCombat", () => {
    lastHudCombatantKey = "";
    scheduleClearMovementTrail();
  });
  Hooks.on("renderCombatTracker", (app, html) => {
    patchInitiativeIcons(html);
    scheduleRefreshSync(game.combat, { reason: "renderCombatTracker", delay: 20, render: false, selectToken: game.combat?.started });
  });
  Hooks.on("renderCombatantConfig", () => setTimeout(() => patchInitiativeIcons(document), 50));
  Hooks.on("renderSidebarTab", (app, html) => {
    if (app?.options?.id === "combat" || app?.tabName === "combat" || app?.id === "combat") {
      patchInitiativeIcons(html);
      scheduleRefreshSync(game.combat, { reason: "renderSidebarTab", delay: 30, render: false, selectToken: game.combat?.started });
      setTimeout(() => patchInitiativeIcons(document), 50);
    }
  });
  installInitiativeChatCard();
}

Hooks.once("init", configureInitiative);
Hooks.once("ready", () => {
  configureInitiative();
  cleanupLegacyHooks();
  installCombatPatch();
  installMovementHistoryBlock();
  installTokenHoverPatch();
  installTokenInteractionLock();
  exposeGlobals();
  patchInitiativeIcons(document);
  installActionLocks();
  installHooks();
  clearExistingMovementHistoryFlags().catch(err => console.warn(`${TAG}[MOVE_HISTORY][CLEAN_ERROR]`, err));
  setTimeout(() => cleanupMovementHistoryHooks(), 300);
  setTimeout(() => installTokenHoverPatch(), 350);
  setTimeout(() => installTokenInteractionLock(), 360);
  setTimeout(() => patchInitiativeIcons(document), 500);
  setTimeout(() => patchInitiativeIcons(document), 1500);
  setTimeout(() => installActionLocks(), 800);
  setTimeout(() => installActionLocks(), 2000);
  setTimeout(() => installActionLocks(), 4000);
  setTimeout(() => scheduleInitiativeSort(game.combat), 700);
  setTimeout(() => scheduleRefreshSync(game.combat, { reason: "ready-early", delay: 0, selectToken: game.combat?.started }), 850);
  setTimeout(() => scheduleRefreshSync(game.combat, { reason: "ready-late", delay: 0, selectToken: game.combat?.started }), 1400);
  setTimeout(() => scheduleHudFollow(game.combat, { forceOpen: false, reason: "ready" }), 1000);
  setTimeout(() => scheduleClearMovementTrail(), 1200);
});

export { configureInitiative as add2eConfigureInitiative, sortInitiativeAscending as add2eSortInitiativeAscending, canActorActNow as add2eCanActorActNow, syncActionHudToCombatant as add2eSyncActionHudToCombatant, syncCombatAfterRefresh as add2eSyncCombatAfterRefresh, add2eInitiativeDebug as add2eDebugCombatState, installMovementHistoryBlock as add2eDisableMovementHistoryRecording };
