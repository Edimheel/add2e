// ADD2E — Contrôle canonique du déplacement des tokens.
// Compatible Foundry V13/V14/V15 — ruler natif Foundry uniquement.

import {
  ADD2E_MOVE_XP_VERSION,
  ADD2E_MOVE_XP_TAG,
  computeMovement,
  recalc,
  log,
  norm
} from "./17a-movement-xp-domain.mjs";

const CONTROL_VERSION = "2026-07-31-native-ruler-gm-approval-v3";
const STATE_FLAG = "movementTurnState";
const REQUEST = "ADD2E_MOVEMENT_APPROVAL_REQUEST";
const RESPONSE = "ADD2E_MOVEMENT_APPROVAL_RESPONSE";
const TIMEOUT_MS = 90_000;
const SOCKET = "system.add2e";
const nativeCache = new Map();
const updateCache = new Map();
const pending = new Map();
const pendingByToken = new Map();
const handled = new Set();
const recorded = new Set();
let gmQueue = Promise.resolve();

const round2 = value => Math.round(Math.max(0, Number(value) || 0) * 100) / 100;
const isPoint = value => Number.isFinite(Number(value?.x)) && Number.isFinite(Number(value?.y));
const escapeHtml = value => String(value ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#039;");

function randomId() {
  try { return foundry?.utils?.randomID?.(24) || crypto.randomUUID(); }
  catch (_error) { return `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
}

function point(value, fallback = {}) {
  const source = value?.position ?? value?.destination ?? value?.point ?? value ?? {};
  return {
    x: Number(source?.x ?? fallback?.x ?? 0),
    y: Number(source?.y ?? fallback?.y ?? 0),
    elevation: Number(source?.elevation ?? source?.z ?? fallback?.elevation ?? fallback?.z ?? 0)
  };
}

function unitToMeters(distance, unit) {
  const key = norm(unit);
  if (["ft", "feet", "foot", "pied", "pieds", "pi"].includes(key)) return distance * 0.3048;
  if (["km", "kilometre", "kilometres"].includes(key)) return distance * 1000;
  return distance;
}

function sceneUnits(tokenDoc) {
  const scene = tokenDoc?.parent ?? canvas?.scene;
  return {
    size: Number(scene?.grid?.size ?? canvas?.grid?.size ?? 100) || 100,
    distance: Number(scene?.grid?.distance ?? 1) || 1,
    unit: scene?.grid?.units ?? "m"
  };
}

function waypointsOf(movement = {}, target = null) {
  const raw = [movement?.waypoints, movement?.pending?.waypoints, movement?.path, movement?.route]
    .find(Array.isArray) ?? [];
  const waypoints = raw.filter(isPoint).map(entry => {
    const p = point(entry, target ?? {});
    const out = { x: p.x, y: p.y, elevation: p.elevation };
    for (const key of ["action", "checkpoint", "explicit", "snapped"]) {
      if (["string", "boolean", "number"].includes(typeof entry?.[key])) out[key] = entry[key];
    }
    return out;
  });
  const rawDestination = movement?.destination ?? target;
  if (isPoint(rawDestination)) {
    const destination = point(rawDestination);
    const last = waypoints[waypoints.length - 1];
    if (!last || last.x !== destination.x || last.y !== destination.y || last.elevation !== destination.elevation) {
      waypoints.push(destination);
    }
  }
  return waypoints;
}

function movementOrigin(tokenDoc, movement = {}) {
  return isPoint(movement?.origin) ? point(movement.origin, tokenDoc) : point(tokenDoc);
}

function movementTarget(tokenDoc, movement = {}) {
  if (isPoint(movement?.destination)) return point(movement.destination, tokenDoc);
  const waypoints = waypointsOf(movement);
  const last = waypoints[waypoints.length - 1];
  return last ? point(last, tokenDoc) : point(tokenDoc);
}

function reportedHorizontal(tokenDoc, movement = {}, phase = "pre") {
  const sections = phase === "pre"
    ? [movement?.pending, movement?.passed, movement]
    : [movement?.passed, movement?.pending, movement];
  const unit = tokenDoc?.parent?.grid?.units ?? canvas?.scene?.grid?.units ?? "m";
  for (const section of sections) {
    for (const raw of [section?.distance, section?.cost, section?.measurement?.distance]) {
      const value = Number(raw);
      if (Number.isFinite(value) && value >= 0) return round2(unitToMeters(value, unit));
    }
  }
  return null;
}

function movementComponents(tokenDoc, target, { movement = null, from = null, horizontalOverride = null } = {}) {
  const origin = point(from ?? tokenDoc, tokenDoc);
  const destination = point(target, tokenDoc);
  const { size, distance, unit } = sceneUnits(tokenDoc);
  const route = waypointsOf(movement ?? {}, destination);
  const points = route.length ? route : [destination];
  let previous = origin;
  let horizontal = 0;
  let ascent = 0;
  let descent = 0;

  for (const raw of points) {
    const current = point(raw, previous);
    horizontal += unitToMeters((Math.hypot(current.x - previous.x, current.y - previous.y) / size) * distance, unit);
    const dz = unitToMeters(current.elevation - previous.elevation, unit);
    if (dz > 0) ascent += dz;
    else descent -= dz;
    previous = current;
  }
  if (Number.isFinite(Number(horizontalOverride))) horizontal = Math.max(0, Number(horizontalOverride));
  return { origin, destination, horizontal: round2(horizontal), ascent: round2(ascent), descent: round2(descent) };
}

function activeCombat() {
  const combat = game.combat;
  return combat && (combat.started === true || Number(combat.round) > 0) ? combat : null;
}

function combatantForToken(tokenDoc) {
  const combat = activeCombat();
  if (!combat || !tokenDoc?.id) return null;
  try {
    const direct = tokenDoc.combatant ?? combat.getCombatantByToken?.(tokenDoc.id);
    if (direct && (!direct.combat || direct.combat.id === combat.id)) return direct;
  } catch (_error) {}
  return Array.from(combat.combatants ?? []).find(combatant => {
    const tokenId = combatant.tokenId ?? combatant.token?.id ?? combatant.token?.document?.id;
    return String(tokenId ?? "") === String(tokenDoc.id);
  }) ?? null;
}

function combatRoundKey(tokenDoc) {
  const combat = activeCombat();
  if (!combat || !combatantForToken(tokenDoc)) return null;
  return `${combat.id}:${Math.max(1, Number(combat.round) || 1)}`;
}

function spentThisRound(tokenDoc) {
  const key = combatRoundKey(tokenDoc);
  const state = tokenDoc?.getFlag?.("add2e", STATE_FLAG) ?? {};
  if (!key || state.key !== key) return { ratio: 0, horizontal: 0, ascent: 0, descent: 0 };
  return {
    ratio: Math.max(0, Number(state.ratio) || 0),
    horizontal: Math.max(0, Number(state.horizontal) || 0),
    ascent: Math.max(0, Number(state.ascent) || 0),
    descent: Math.max(0, Number(state.descent) || 0)
  };
}

function movementStatus(ratio) {
  if (!Number.isFinite(ratio)) return { key: "red", label: "impossible", blocked: true };
  if (ratio <= 1.0001) return { key: "green", label: "autorisé", blocked: false };
  if (ratio <= 2.0001) return { key: "orange", label: "dépassé", blocked: true };
  return { key: "red", label: "largement dépassé", blocked: true };
}

function modeSpeed(details, target) {
  const entry = details?.movementModes?.[target];
  return entry?.available ? Math.max(0, Number(entry.preciseValue ?? entry.value) || 0) : 0;
}

function horizontalMode(details, tokenDoc, components) {
  const modes = details?.movementModes ?? {};
  const explicit = norm(tokenDoc?.flags?.add2e?.movementMode ?? tokenDoc?.flags?.add2e?.modeDeplacement ?? "");
  const aliases = {
    sol: "ground", terrestre: "ground", ground: "ground",
    vol: "flight", aerien: "flight", aerienne: "flight", flight: "flight",
    sous_eau: "underwater", underwater: "underwater", aquatique: "underwater",
    nage: "swim", swim: "swim"
  };
  const requested = aliases[explicit] ?? explicit;
  if (requested && modes[requested]?.available) return requested;
  const tokenFlags = tokenDoc?.flags?.add2e ?? {};
  const sceneFlags = tokenDoc?.parent?.flags?.add2e ?? canvas?.scene?.flags?.add2e ?? {};
  const environment = norm(tokenFlags.environment ?? tokenFlags.milieu ?? sceneFlags.environment ?? sceneFlags.milieu ?? "");
  if (["underwater", "sous_eau", "aquatique", "eau"].includes(environment)) {
    if (modes.underwater?.available) return "underwater";
    if (modes.swim?.available) return "swim";
  }
  if (Math.max(components.origin.elevation, components.destination.elevation) > 0.001 && modes.flight?.available) return "flight";
  return "ground";
}

function verticalMode(details, direction) {
  const modes = details?.movementModes ?? {};
  if (modes[direction]?.available) return direction;
  if (modes.vertical?.available) return "vertical";
  if (modes.flight?.available) return "flight";
  return direction;
}

function componentRatio(distance, speed) {
  if (distance <= 0.0001) return 0;
  return speed > 0 ? distance / speed : Number.POSITIVE_INFINITY;
}

function movementBudget(details, tokenDoc, components) {
  const modes = {
    horizontal: horizontalMode(details, tokenDoc, components),
    ascent: verticalMode(details, "ascent"),
    descent: verticalMode(details, "descent")
  };
  const speeds = {
    horizontal: modeSpeed(details, modes.horizontal),
    ascent: modeSpeed(details, modes.ascent),
    descent: modeSpeed(details, modes.descent)
  };
  const ratios = {
    horizontal: componentRatio(components.horizontal, speeds.horizontal),
    ascent: componentRatio(components.ascent, speeds.ascent),
    descent: componentRatio(components.descent, speeds.descent)
  };
  return { modes, speeds, ratios, ratio: ratios.horizontal + ratios.ascent + ratios.descent };
}

function movementSummary(result) {
  const rows = [];
  if (result.components.horizontal > 0) rows.push(`${result.components.horizontal.toFixed(1)} m ${result.budget.modes.horizontal}`);
  if (result.components.ascent > 0) rows.push(`+${result.components.ascent.toFixed(1)} m`);
  if (result.components.descent > 0) rows.push(`-${result.components.descent.toFixed(1)} m`);
  return rows.length ? rows.join(" · ") : "0 m";
}

function enforcementEnabled() {
  try { return game.settings.get("add2e", "enforceTokenMovement") !== false; }
  catch (_error) { return true; }
}

function activeGm() {
  const users = Array.from(game.users ?? []);
  const direct = game.users?.activeGM;
  if (direct?.active && direct.isGM) return direct;
  return users.find(user => user.active && user.isGM && user.isActiveGM === true)
    ?? users.find(user => user.active && user.isGM)
    ?? null;
}

function tokenApprovalKey(tokenDoc) {
  return `${tokenDoc?.parent?.id ?? canvas?.scene?.id ?? "scene"}:${tokenDoc?.id ?? "token"}`;
}

function clearPending(requestId, reason = null) {
  const entry = pending.get(requestId);
  if (!entry) return null;
  clearTimeout(entry.timer);
  pending.delete(requestId);
  if (pendingByToken.get(entry.tokenKey) === requestId) pendingByToken.delete(entry.tokenKey);
  if (reason) ui.notifications.warn(reason);
  return entry;
}

function replayOptions(movement, operation, requestId) {
  const options = { showRuler: true, add2eIgnoreMovement: true, add2eMovementApprovalId: requestId };
  if (typeof movement?.autoRotate === "boolean") options.autoRotate = movement.autoRotate;
  if (typeof operation?.animate === "boolean") options.animate = operation.animate;
  if (typeof operation?.method === "string" && operation.method) options.method = operation.method;
  return options;
}

function approvalSnapshot(tokenDoc, result, requesterId) {
  const requester = game.users?.get?.(requesterId) ?? game.user;
  const speedRows = Object.entries(result?.budget?.speeds ?? {})
    .filter(([, value]) => Number(value) > 0)
    .map(([mode, value]) => `${mode} ${round2(value)} m`);
  return {
    requesterName: requester?.name ?? "Joueur",
    actorName: result?.actor?.name ?? tokenDoc?.actor?.name ?? "Personnage",
    sceneName: tokenDoc?.parent?.name ?? canvas?.scene?.name ?? "Scène",
    movement: movementSummary(result),
    speeds: speedRows.join(" · ") || "Aucune vitesse disponible",
    spentPercent: Math.round((Number(result?.spent?.ratio) || 0) * 100),
    attemptPercent: Number.isFinite(Number(result?.budget?.ratio)) ? Math.round(Number(result.budget.ratio) * 100) : null,
    totalPercent: Number.isFinite(Number(result?.nextRatio)) ? Math.round(Number(result.nextRatio) * 100) : null,
    round: activeCombat()?.round ?? null
  };
}

function requestApproval(tokenDoc, movement, operation, result) {
  const gm = activeGm();
  if (!gm) {
    ui.notifications.warn("Le déplacement dépasse la limite et aucun MJ actif ne peut le valider.");
    return false;
  }
  const tokenKey = tokenApprovalKey(tokenDoc);
  const existing = pendingByToken.get(tokenKey);
  if (existing && pending.has(existing)) {
    ui.notifications.info("Une demande de déplacement est déjà en attente pour ce token.");
    return false;
  }
  const requestId = randomId();
  const requesterId = String(game.user?.id ?? "");
  const target = movementTarget(tokenDoc, movement);
  const waypoints = waypointsOf(movement, target);
  const packet = {
    type: REQUEST,
    requestId,
    requesterId,
    gmId: String(gm.id),
    sceneId: String(tokenDoc?.parent?.id ?? canvas?.scene?.id ?? ""),
    tokenId: String(tokenDoc?.id ?? ""),
    origin: movementOrigin(tokenDoc, movement),
    destination: target,
    waypoints: waypoints.length ? waypoints : [target],
    moveOptions: replayOptions(movement, operation, requestId),
    summary: approvalSnapshot(tokenDoc, result, requesterId)
  };
  const timer = setTimeout(() => clearPending(requestId, "La demande de déplacement a expiré sans réponse du MJ."), TIMEOUT_MS);
  pending.set(requestId, { tokenKey, timer, packet });
  pendingByToken.set(tokenKey, requestId);
  game.socket.emit(SOCKET, packet);
  console.info(`${ADD2E_MOVE_XP_TAG}[TOKEN][APPROVAL_REQUEST_SENT]`, packet);
  ui.notifications.info(`Déplacement bloqué : demande envoyée à ${gm.name}.`);
  return false;
}

function dialogContent(packet) {
  const s = packet.summary ?? {};
  const total = s.totalPercent == null ? "impossible" : `${s.totalPercent} %`;
  const attempt = s.attemptPercent == null ? "impossible" : `${s.attemptPercent} %`;
  return `<div class="add2e-dialog add2e-movement-approval" style="min-width:430px;display:grid;gap:9px;">
    <p><b>${escapeHtml(s.requesterName)}</b> demande à dépasser le mouvement de combat de <b>${escapeHtml(s.actorName)}</b>.</p>
    <table style="width:100%;"><tbody>
      <tr><th style="text-align:left;">Scène</th><td>${escapeHtml(s.sceneName)}</td></tr>
      <tr><th style="text-align:left;">Round</th><td>${escapeHtml(s.round ?? "—")}</td></tr>
      <tr><th style="text-align:left;">Déplacement tenté</th><td>${escapeHtml(s.movement)}</td></tr>
      <tr><th style="text-align:left;">Vitesse résolue</th><td>${escapeHtml(s.speeds)}</td></tr>
      <tr><th style="text-align:left;">Déjà consommé</th><td>${escapeHtml(s.spentPercent)} %</td></tr>
      <tr><th style="text-align:left;">Coût de ce déplacement</th><td>${escapeHtml(attempt)}</td></tr>
      <tr><th style="text-align:left;">Total après déplacement</th><td><b>${escapeHtml(total)}</b></td></tr>
    </tbody></table>
    <p style="margin:0;">Autoriser déplacera automatiquement le token. Refuser le laissera à sa position actuelle.</p>
  </div>`;
}

async function promptApproval(packet) {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.wait) throw new Error("DialogV2 est indisponible pour valider le déplacement.");
  return DialogV2.wait({
    window: { title: "Valider un dépassement de mouvement" },
    modal: true,
    rejectClose: false,
    content: dialogContent(packet),
    buttons: [
      { action: "approve", label: "Autoriser le déplacement", icon: "fa-solid fa-check", default: true, callback: () => true },
      { action: "deny", label: "Refuser", icon: "fa-solid fa-xmark", callback: () => false }
    ]
  });
}

function recordKey(tokenDoc, result) {
  const target = result?.target ?? result?.components?.destination ?? {};
  return `${combatRoundKey(tokenDoc) ?? "none"}:${tokenDoc?.id}:${target.x}:${target.y}:${target.elevation}:${round2(result?.spent?.ratio)}`;
}

function rememberMovement(tokenDoc, result) {
  const key = combatRoundKey(tokenDoc);
  if (!key || !result) return;
  const signature = recordKey(tokenDoc, result);
  if (recorded.has(signature)) return;
  recorded.add(signature);
  setTimeout(() => recorded.delete(signature), 2500);
  tokenDoc.setFlag("add2e", STATE_FLAG, {
    key,
    ratio: round2(result.nextRatio),
    horizontal: round2(result.spent.horizontal + result.components.horizontal),
    ascent: round2(result.spent.ascent + result.components.ascent),
    descent: round2(result.spent.descent + result.components.descent),
    modes: result.budget.modes
  }).catch(error => console.warn(`${ADD2E_MOVE_XP_TAG}[TOKEN][ROUND_STATE_ERROR]`, error));
}

async function executeApproved(packet) {
  const scene = game.scenes?.get?.(packet.sceneId);
  const tokenDoc = scene?.tokens?.get?.(packet.tokenId);
  if (!tokenDoc) throw new Error("Le token demandé n’existe plus dans la scène.");
  if (typeof tokenDoc.move !== "function") throw new Error("L’API native TokenDocument.move est indisponible.");
  const movement = { origin: packet.origin, destination: packet.destination, waypoints: packet.waypoints };
  const result = computeTokenMovementScale(tokenDoc, packet.destination, { movement, phase: "pre" });
  const completed = await tokenDoc.move(packet.waypoints, {
    ...(packet.moveOptions ?? {}),
    showRuler: true,
    add2eIgnoreMovement: true,
    add2eMovementApprovalId: packet.requestId,
    add2eMovementRequesterId: packet.requesterId
  });
  if (completed === false) throw new Error("Foundry a interrompu le déplacement autorisé.");
  if (result?.enforced) rememberMovement(tokenDoc, result);
}

function sendResponse(packet, approved, error = null) {
  game.socket.emit(SOCKET, {
    type: RESPONSE,
    requestId: packet.requestId,
    requesterId: packet.requesterId,
    gmId: String(game.user?.id ?? ""),
    gmName: game.user?.name ?? "MJ",
    approved: approved === true,
    error: error ? String(error?.message ?? error) : null
  });
}

function handleRequest(packet) {
  if (!packet || packet.type !== REQUEST) return;
  if (!game.user?.isGM || String(packet.gmId ?? "") !== String(game.user.id ?? "")) return;
  if (handled.has(packet.requestId)) return;
  handled.add(packet.requestId);
  console.info(`${ADD2E_MOVE_XP_TAG}[TOKEN][APPROVAL_REQUEST_RECEIVED]`, packet);
  gmQueue = gmQueue.catch(() => undefined).then(async () => {
    let approved = false;
    let error = null;
    try {
      approved = await promptApproval(packet) === true;
      if (approved) await executeApproved(packet);
    } catch (caught) {
      error = caught;
      approved = false;
      console.error(`${ADD2E_MOVE_XP_TAG}[TOKEN][APPROVAL_GM_ERROR]`, caught);
      ui.notifications.error(`Validation du déplacement impossible : ${caught.message}`);
    }
    sendResponse(packet, approved, error);
    setTimeout(() => handled.delete(packet.requestId), TIMEOUT_MS);
  });
}

function handleResponse(packet) {
  if (!packet || packet.type !== RESPONSE) return;
  if (String(packet.requesterId ?? "") !== String(game.user?.id ?? "")) return;
  if (!clearPending(packet.requestId)) return;
  if (packet.approved) ui.notifications.info(`${packet.gmName ?? "Le MJ"} a autorisé le déplacement.`);
  else ui.notifications.warn(`${packet.gmName ?? "Le MJ"} a refusé le déplacement${packet.error ? ` (${packet.error})` : ""}.`);
}

function installSocket() {
  if (globalThis.__ADD2E_MOVEMENT_APPROVAL_SOCKET__ === CONTROL_VERSION) return;
  globalThis.__ADD2E_MOVEMENT_APPROVAL_SOCKET__ = CONTROL_VERSION;
  game.socket.on(SOCKET, packet => {
    if (packet?.type === REQUEST) handleRequest(packet);
    else if (packet?.type === RESPONSE) handleResponse(packet);
  });
}

export function computeTokenMovementScale(tokenDoc, target = {}, { movement = null, phase = "legacy", from = null } = {}) {
  const actor = tokenDoc?.actor;
  if (!actor || actor.type !== "personnage") return null;
  const origin = from ?? (movement ? movementOrigin(tokenDoc, movement) : point(tokenDoc));
  const components = movementComponents(tokenDoc, target, {
    movement,
    from: origin,
    horizontalOverride: movement ? reportedHorizontal(tokenDoc, movement, phase) : null
  });
  const details = computeMovement(actor, {
    token: tokenDoc,
    scene: tokenDoc.parent ?? canvas?.scene,
    consumer: "movement-token-control"
  });
  const budget = movementBudget(details, tokenDoc, components);
  const enforced = Boolean(combatRoundKey(tokenDoc));
  const spent = enforced ? spentThisRound(tokenDoc) : { ratio: 0, horizontal: 0, ascent: 0, descent: 0 };
  const nextRatio = spent.ratio + budget.ratio;
  return {
    actor, movement: details, components, budget, spent, enforced,
    inCombat: Boolean(activeCombat()), nextRatio, next: nextRatio, max: 1,
    origin: components.origin, target: components.destination, status: movementStatus(nextRatio)
  };
}

export function validateTokenMovement(tokenDoc, changes, options = {}, movement = null) {
  if (options?.add2eIgnoreMovement || !enforcementEnabled()) return { allowed: true, result: null };
  if (!changes || (changes.x === undefined && changes.y === undefined && changes.elevation === undefined && changes.z === undefined)) {
    return { allowed: true, result: null };
  }
  if (!tokenDoc?.actor || tokenDoc.actor.type !== "personnage") return { allowed: true, result: null };
  const result = computeTokenMovementScale(tokenDoc, changes, { movement, phase: movement ? "pre" : "legacy" });
  if (!result || !result.enforced || game.user.isGM || !result.status.blocked) return { allowed: true, result };
  return { allowed: false, result };
}

function syntheticMovement(tokenDoc, changes) {
  const destination = point(changes, tokenDoc);
  return { origin: point(tokenDoc), destination, waypoints: [destination] };
}

function cacheKey(tokenDoc, target) {
  const p = point(target, tokenDoc);
  return `${tokenDoc?.uuid ?? tokenDoc?.id}:${p.x}:${p.y}:${p.elevation}`;
}

function clearStates() {
  if (!game.user?.isGM) return;
  for (const token of canvas?.tokens?.placeables ?? []) {
    if (token.actor?.type === "personnage") token.document.unsetFlag("add2e", STATE_FLAG).catch(() => undefined);
  }
}

export function installMovementTokenControl() {
  if (globalThis.__ADD2E_MOVEMENT_TOKEN_CONTROL__ === CONTROL_VERSION) return;
  globalThis.__ADD2E_MOVEMENT_TOKEN_CONTROL__ = CONTROL_VERSION;
  globalThis.ADD2E_MOVEMENT_TOKEN_CONTROL_VERSION = CONTROL_VERSION;

  Hooks.once("ready", async () => {
    installSocket();
    log("[READY]", {
      version: ADD2E_MOVE_XP_VERSION,
      controllerVersion: CONTROL_VERSION,
      display: "foundry-native-token-ruler",
      combatPolicy: "strict-one-times-resolved-movement-per-round-with-gm-approval",
      explorationPolicy: "unrestricted",
      enforcementEnabled: enforcementEnabled()
    });
    if (game.user.isGM && !enforcementEnabled()) {
      ui.notifications.warn("Le contrôle ADD2E des déplacements est désactivé dans les paramètres du monde.");
    }
    if (!game.user.isGM) return;
    for (const actor of game.actors?.filter(actor => actor.type === "personnage") ?? []) {
      await recalc(actor, { mode: "movement" })
        .catch(error => console.warn(`${ADD2E_MOVE_XP_TAG}[READY][SKIP]`, actor?.name, error));
    }
  });

  Hooks.on("preMoveToken", (tokenDoc, movement, operation = {}) => {
    if (!tokenDoc?.actor || tokenDoc.actor.type !== "personnage" || operation?.add2eIgnoreMovement) return true;
    try { movement.showRuler = true; } catch (_error) {}
    const target = movementTarget(tokenDoc, movement);
    const checked = validateTokenMovement(tokenDoc, target, operation, movement);
    if (!checked.allowed) {
      requestApproval(tokenDoc, movement, operation, checked.result);
      return false;
    }
    nativeCache.set(`${tokenDoc.uuid}:${movement?.id ?? "movement"}`, checked.result);
    updateCache.set(cacheKey(tokenDoc, target), checked.result);
    return true;
  });

  Hooks.on("preUpdateToken", (tokenDoc, changes = {}, options = {}, userId = null) => {
    if (options?.add2eIgnoreMovement) return true;
    if (!changes || (changes.x === undefined && changes.y === undefined && changes.elevation === undefined && changes.z === undefined)) return true;
    if (!tokenDoc?.actor || tokenDoc.actor.type !== "personnage") return true;
    const movement = syntheticMovement(tokenDoc, changes);
    const checked = validateTokenMovement(tokenDoc, movement.destination, { ...options, userId }, movement);
    if (!checked.allowed) {
      requestApproval(tokenDoc, movement, { ...options, userId }, checked.result);
      return false;
    }
    updateCache.set(cacheKey(tokenDoc, movement.destination), checked.result);
    return true;
  });

  Hooks.on("moveToken", (tokenDoc, movement, operation = {}, user = null) => {
    if (!tokenDoc?.actor || tokenDoc.actor.type !== "personnage") return;
    const target = movementTarget(tokenDoc, movement);
    const nativeKey = `${tokenDoc.uuid}:${movement?.id ?? "movement"}`;
    const result = nativeCache.get(nativeKey)
      ?? updateCache.get(cacheKey(tokenDoc, target))
      ?? computeTokenMovementScale(tokenDoc, target, { movement, phase: "post" });
    nativeCache.delete(nativeKey);
    updateCache.delete(cacheKey(tokenDoc, target));
    const userId = user?.id ?? operation?.userId ?? null;
    if (result?.enforced && (!userId || String(userId) === String(game.user?.id ?? ""))) rememberMovement(tokenDoc, result);
  });

  Hooks.on("updateToken", (tokenDoc, changes = {}, options = {}, userId = null) => {
    if (options?.add2eIgnoreMovement) return;
    if (!changes || (changes.x === undefined && changes.y === undefined && changes.elevation === undefined && changes.z === undefined)) return;
    if (userId && String(userId) !== String(game.user?.id ?? "")) return;
    const key = cacheKey(tokenDoc, tokenDoc);
    const result = updateCache.get(key);
    updateCache.delete(key);
    if (result?.enforced) rememberMovement(tokenDoc, result);
  });

  Hooks.on("deleteToken", tokenDoc => {
    const tokenKey = tokenApprovalKey(tokenDoc);
    const requestId = pendingByToken.get(tokenKey);
    if (requestId) clearPending(requestId, "La demande a été annulée car le token a été supprimé.");
  });

  Hooks.on("deleteCombat", () => {
    nativeCache.clear();
    updateCache.clear();
    recorded.clear();
    handled.clear();
    for (const requestId of [...pending.keys()]) clearPending(requestId, "La demande a été annulée car le combat est terminé.");
    clearStates();
  });
}
