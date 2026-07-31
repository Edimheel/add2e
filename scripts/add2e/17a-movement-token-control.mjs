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

const MOVEMENT_TURN_STATE_FLAG = "movementTurnState";
const MOVEMENT_APPROVAL_REQUEST = "ADD2E_MOVEMENT_APPROVAL_REQUEST";
const MOVEMENT_APPROVAL_RESPONSE = "ADD2E_MOVEMENT_APPROVAL_RESPONSE";
const MOVEMENT_APPROVAL_TIMEOUT_MS = 90_000;
const MOVEMENT_SOCKET_CHANNEL = "system.add2e";
const nativeMovementCache = new Map();
const pendingMovementApprovals = new Map();
const pendingMovementByToken = new Map();
const handledMovementApprovals = new Set();
let gmApprovalQueue = Promise.resolve();

function unitToMeters(distance, unit) {
  const value = norm(unit);
  if (["ft", "feet", "foot", "pied", "pieds", "pi"].includes(value)) return distance * 0.3048;
  if (["km", "kilometre", "kilometres"].includes(value)) return distance * 1000;
  return distance;
}

function round2(value) {
  return Math.round(Math.max(0, Number(value) || 0) * 100) / 100;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function randomId() {
  try {
    const id = foundry?.utils?.randomID?.(24);
    if (id) return id;
  } catch (_error) {}
  try { return crypto.randomUUID(); }
  catch (_error) { return `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
}

function isPoint(value) {
  return Number.isFinite(Number(value?.x)) && Number.isFinite(Number(value?.y));
}

function point(value, fallback = {}) {
  const candidate = value?.position ?? value?.destination ?? value?.point ?? value ?? {};
  return {
    x: Number(candidate?.x ?? fallback?.x ?? 0),
    y: Number(candidate?.y ?? fallback?.y ?? 0),
    elevation: Number(candidate?.elevation ?? candidate?.z ?? fallback?.elevation ?? fallback?.z ?? 0)
  };
}

function sceneUnits(tokenDoc) {
  const scene = tokenDoc?.parent ?? canvas?.scene ?? null;
  return {
    size: Number(scene?.grid?.size ?? canvas?.grid?.size ?? 100) || 100,
    distance: Number(scene?.grid?.distance ?? canvas?.scene?.grid?.distance ?? 1) || 1,
    unit: scene?.grid?.units ?? canvas?.scene?.grid?.units ?? "m"
  };
}

function tokenCenter(tokenDoc, position) {
  const { size } = sceneUnits(tokenDoc);
  return {
    x: Number(position?.x ?? tokenDoc?.x ?? 0) + Number(tokenDoc?.width ?? 1) * size / 2,
    y: Number(position?.y ?? tokenDoc?.y ?? 0) + Number(tokenDoc?.height ?? 1) * size / 2
  };
}

function nativeMovementOrigin(tokenDoc, movement = {}) {
  return isPoint(movement?.origin) ? point(movement.origin, tokenDoc) : point(tokenDoc);
}

function nativeMovementTarget(tokenDoc, movement = {}) {
  if (isPoint(movement?.destination)) return point(movement.destination, tokenDoc);
  const pending = movement?.pending?.waypoints ?? [];
  const last = pending[pending.length - 1];
  if (isPoint(last)) return point(last, tokenDoc);
  return point(tokenDoc);
}

function nativeHorizontalMeters(tokenDoc, movement = {}, phase = "pre") {
  const sections = phase === "pre"
    ? [movement?.pending, movement?.passed]
    : [movement?.passed, movement?.pending];
  const unit = tokenDoc?.parent?.grid?.units ?? canvas?.scene?.grid?.units ?? "m";
  for (const section of sections) {
    const distance = Number(section?.distance);
    if (Number.isFinite(distance) && distance >= 0) return round2(unitToMeters(distance, unit));
  }
  return null;
}

function nativeMovementCacheKey(tokenDoc, movement = {}) {
  return `${tokenDoc?.uuid ?? tokenDoc?.id ?? "token"}:${movement?.id ?? "movement"}`;
}

function movementComponents(tokenDoc, target, { from = null, horizontalOverride = null } = {}) {
  const origin = point(from ?? tokenDoc, tokenDoc);
  const destination = point(target, tokenDoc);
  const { size, distance, unit } = sceneUnits(tokenDoc);
  const left = tokenCenter(tokenDoc, origin);
  const right = tokenCenter(tokenDoc, destination);
  const horizontal = Number.isFinite(Number(horizontalOverride))
    ? Math.max(0, Number(horizontalOverride))
    : unitToMeters((Math.hypot(right.x - left.x, right.y - left.y) / size) * distance, unit);
  const elevationDelta = unitToMeters(destination.elevation - origin.elevation, unit);
  return {
    origin,
    destination,
    horizontal: round2(horizontal),
    ascent: round2(Math.max(0, elevationDelta)),
    descent: round2(Math.max(0, -elevationDelta)),
    elevationDelta: Math.round(elevationDelta * 100) / 100
  };
}

function activeCombat() {
  const combat = game.combat ?? null;
  if (!combat) return null;
  const started = combat.started === true || Number(combat.round) > 0;
  return started ? combat : null;
}

function combatantForToken(tokenDoc) {
  const combat = activeCombat();
  if (!combat || !tokenDoc?.id) return null;
  const sceneId = tokenDoc.parent?.id ?? canvas?.scene?.id ?? null;
  return Array.from(combat.combatants ?? []).find(combatant => {
    const tokenId = combatant.tokenId ?? combatant.token?.id ?? combatant.token?.document?.id;
    const combatantSceneId = combatant.sceneId ?? combatant.token?.parent?.id ?? sceneId;
    return String(tokenId ?? "") === String(tokenDoc.id)
      && (!sceneId || !combatantSceneId || String(combatantSceneId) === String(sceneId));
  }) ?? null;
}

function combatRoundKey(tokenDoc) {
  const combat = activeCombat();
  const combatant = combatantForToken(tokenDoc);
  if (!combat || !combatant) return null;
  return `${combat.id}:${Math.max(1, Number(combat.round) || 1)}`;
}

function emptySpentState() {
  return { ratio: 0, horizontal: 0, ascent: 0, descent: 0 };
}

function spentThisRound(tokenDoc) {
  const key = combatRoundKey(tokenDoc);
  if (!key || !tokenDoc) return emptySpentState();
  const state = tokenDoc.getFlag?.("add2e", MOVEMENT_TURN_STATE_FLAG) ?? {};
  if (state.key !== key) return emptySpentState();
  return {
    ratio: Math.max(0, Number(state.ratio) || 0),
    horizontal: Math.max(0, Number(state.horizontal) || 0),
    ascent: Math.max(0, Number(state.ascent) || 0),
    descent: Math.max(0, Number(state.descent) || 0)
  };
}

function movementScaleStatus(ratio) {
  if (!Number.isFinite(ratio)) return { key: "red", label: "impossible", blocked: true };
  if (ratio <= 1.0001) return { key: "green", label: "autorisé", blocked: false };
  if (ratio <= 2.0001) return { key: "orange", label: "dépassé", blocked: true };
  return { key: "red", label: "largement dépassé", blocked: true };
}

function movementModeSpeed(details, target) {
  const entry = details?.movementModes?.[target] ?? null;
  return entry?.available ? Math.max(0, Number(entry.preciseValue ?? entry.value) || 0) : 0;
}

function environmentKey(tokenDoc) {
  const tokenFlags = tokenDoc?.flags?.add2e ?? {};
  const sceneFlags = tokenDoc?.parent?.flags?.add2e ?? canvas?.scene?.flags?.add2e ?? {};
  return norm(tokenFlags.environment ?? tokenFlags.milieu ?? sceneFlags.environment ?? sceneFlags.milieu ?? "");
}

function explicitMovementMode(tokenDoc) {
  return norm(tokenDoc?.flags?.add2e?.movementMode ?? tokenDoc?.flags?.add2e?.modeDeplacement ?? "");
}

function selectHorizontalMode(details, tokenDoc, components) {
  const modes = details?.movementModes ?? {};
  const explicit = explicitMovementMode(tokenDoc);
  const aliases = {
    sol: "ground", terrestre: "ground", ground: "ground",
    vol: "flight", aerien: "flight", aerienne: "flight", flight: "flight",
    sous_eau: "underwater", underwater: "underwater", aquatique: "underwater",
    nage: "swim", swim: "swim"
  };
  const requested = aliases[explicit] ?? explicit;
  if (requested && modes[requested]?.available) return requested;
  const environment = environmentKey(tokenDoc);
  if (["underwater", "sous_eau", "aquatique", "eau"].includes(environment)) {
    if (modes.underwater?.available) return "underwater";
    if (modes.swim?.available) return "swim";
  }
  const airborne = Math.max(components.origin.elevation, components.destination.elevation) > 0.001;
  if (airborne && modes.flight?.available) return "flight";
  return "ground";
}

function selectVerticalMode(details, direction) {
  const modes = details?.movementModes ?? {};
  if (direction === "ascent") {
    if (modes.ascent?.available) return "ascent";
    if (modes.vertical?.available) return "vertical";
    if (modes.flight?.available) return "flight";
  }
  if (direction === "descent") {
    if (modes.descent?.available) return "descent";
    if (modes.vertical?.available) return "vertical";
    if (modes.flight?.available) return "flight";
  }
  return direction;
}

function componentRatio(distance, speed) {
  if (distance <= 0.0001) return 0;
  return speed > 0 ? distance / speed : Number.POSITIVE_INFINITY;
}

function movementBudget(details, tokenDoc, components) {
  const horizontalMode = selectHorizontalMode(details, tokenDoc, components);
  const ascentMode = selectVerticalMode(details, "ascent");
  const descentMode = selectVerticalMode(details, "descent");
  const speeds = {
    horizontal: movementModeSpeed(details, horizontalMode),
    ascent: movementModeSpeed(details, ascentMode),
    descent: movementModeSpeed(details, descentMode)
  };
  const ratios = {
    horizontal: componentRatio(components.horizontal, speeds.horizontal),
    ascent: componentRatio(components.ascent, speeds.ascent),
    descent: componentRatio(components.descent, speeds.descent)
  };
  return {
    modes: { horizontal: horizontalMode, ascent: ascentMode, descent: descentMode },
    speeds,
    ratios,
    ratio: ratios.horizontal + ratios.ascent + ratios.descent
  };
}

function movementSummary(result) {
  const pieces = [];
  if (result.components.horizontal > 0) pieces.push(`${result.components.horizontal.toFixed(1)} m ${result.budget.modes.horizontal}`);
  if (result.components.ascent > 0) pieces.push(`+${result.components.ascent.toFixed(1)} m`);
  if (result.components.descent > 0) pieces.push(`-${result.components.descent.toFixed(1)} m`);
  return pieces.length ? pieces.join(" · ") : "0 m";
}

function activeGm() {
  const collection = Array.from(game.users ?? []);
  const preferred = game.users?.activeGM ?? collection.find(user => user.active && user.isGM && user.isActiveGM === true);
  return preferred ?? collection.find(user => user.active && user.isGM) ?? null;
}

function movementApprovalTokenKey(tokenDoc) {
  return `${tokenDoc?.parent?.id ?? canvas?.scene?.id ?? "scene"}:${tokenDoc?.id ?? "token"}`;
}

function movementWaypoints(movement = {}, target = {}) {
  const pending = Array.isArray(movement?.pending?.waypoints) ? movement.pending.waypoints : [];
  const source = pending.length ? pending : [movement?.destination ?? target];
  const waypoints = source.filter(isPoint).map(entry => {
    const position = point(entry, target);
    const waypoint = { x: position.x, y: position.y, elevation: position.elevation };
    for (const key of ["action", "checkpoint", "explicit", "snapped"]) {
      const value = entry?.[key];
      if (["string", "boolean", "number"].includes(typeof value)) waypoint[key] = value;
    }
    return waypoint;
  });
  const destination = point(target);
  const last = waypoints[waypoints.length - 1];
  if (!last || last.x !== destination.x || last.y !== destination.y || last.elevation !== destination.elevation) {
    waypoints.push(destination);
  }
  return waypoints;
}

function movementReplayOptions(movement = {}, operation = {}, requestId = "") {
  const options = {
    showRuler: true,
    add2eIgnoreMovement: true,
    add2eMovementApprovalId: requestId
  };
  if (typeof movement?.autoRotate === "boolean") options.autoRotate = movement.autoRotate;
  else if (typeof operation?.autoRotate === "boolean") options.autoRotate = operation.autoRotate;
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
    tokenName: tokenDoc?.name ?? result?.actor?.name ?? "Token",
    sceneName: tokenDoc?.parent?.name ?? canvas?.scene?.name ?? "Scène",
    movement: movementSummary(result),
    speeds: speedRows.join(" · ") || "Aucune vitesse disponible",
    spentPercent: Math.round((Number(result?.spent?.ratio) || 0) * 100),
    attemptPercent: Number.isFinite(Number(result?.budget?.ratio)) ? Math.round(Number(result.budget.ratio) * 100) : null,
    totalPercent: Number.isFinite(Number(result?.nextRatio)) ? Math.round(Number(result.nextRatio) * 100) : null,
    round: activeCombat()?.round ?? null
  };
}

function clearPendingApproval(requestId, reason = null) {
  const pending = pendingMovementApprovals.get(requestId);
  if (!pending) return null;
  clearTimeout(pending.timer);
  pendingMovementApprovals.delete(requestId);
  if (pendingMovementByToken.get(pending.tokenKey) === requestId) pendingMovementByToken.delete(pending.tokenKey);
  if (reason) ui.notifications?.warn?.(reason);
  return pending;
}

function requestMovementApproval(tokenDoc, movement, operation, result) {
  const gm = activeGm();
  if (!gm) {
    ui.notifications.warn("Le déplacement dépasse la limite et aucun MJ actif ne peut le valider.");
    return false;
  }
  const tokenKey = movementApprovalTokenKey(tokenDoc);
  const existingId = pendingMovementByToken.get(tokenKey);
  if (existingId && pendingMovementApprovals.has(existingId)) {
    ui.notifications.info("Une demande de déplacement est déjà en attente pour ce token.");
    return false;
  }

  const requestId = randomId();
  const requesterId = String(game.user?.id ?? "");
  const packet = {
    type: MOVEMENT_APPROVAL_REQUEST,
    requestId,
    requesterId,
    gmId: String(gm.id),
    sceneId: String(tokenDoc?.parent?.id ?? canvas?.scene?.id ?? ""),
    tokenId: String(tokenDoc?.id ?? ""),
    actorId: String(tokenDoc?.actor?.id ?? ""),
    waypoints: movementWaypoints(movement, nativeMovementTarget(tokenDoc, movement)),
    moveOptions: movementReplayOptions(movement, operation, requestId),
    summary: approvalSnapshot(tokenDoc, result, requesterId)
  };
  const timer = setTimeout(() => {
    clearPendingApproval(requestId, "La demande de déplacement a expiré sans réponse du MJ.");
  }, MOVEMENT_APPROVAL_TIMEOUT_MS);
  pendingMovementApprovals.set(requestId, { requestId, tokenKey, timer, packet });
  pendingMovementByToken.set(tokenKey, requestId);

  try {
    game.socket.emit(MOVEMENT_SOCKET_CHANNEL, packet);
    ui.notifications.info(`Déplacement bloqué : demande envoyée à ${gm.name}.`);
  } catch (error) {
    clearPendingApproval(requestId);
    console.error(`${ADD2E_MOVE_XP_TAG}[TOKEN][APPROVAL_REQUEST_ERROR]`, error);
    ui.notifications.error("Impossible d’envoyer la demande de déplacement au MJ.");
  }
  return false;
}

function approvalDialogContent(packet) {
  const summary = packet?.summary ?? {};
  const total = summary.totalPercent == null ? "impossible" : `${summary.totalPercent} %`;
  const attempt = summary.attemptPercent == null ? "impossible" : `${summary.attemptPercent} %`;
  return `<div class="add2e-dialog add2e-movement-approval" style="min-width:430px;display:grid;gap:9px;">
    <p><b>${escapeHtml(summary.requesterName)}</b> demande à dépasser le mouvement de combat de <b>${escapeHtml(summary.actorName)}</b>.</p>
    <table style="width:100%;">
      <tbody>
        <tr><th style="text-align:left;">Scène</th><td>${escapeHtml(summary.sceneName)}</td></tr>
        <tr><th style="text-align:left;">Round</th><td>${escapeHtml(summary.round ?? "—")}</td></tr>
        <tr><th style="text-align:left;">Déplacement tenté</th><td>${escapeHtml(summary.movement)}</td></tr>
        <tr><th style="text-align:left;">Vitesse résolue</th><td>${escapeHtml(summary.speeds)}</td></tr>
        <tr><th style="text-align:left;">Déjà consommé</th><td>${escapeHtml(summary.spentPercent)} %</td></tr>
        <tr><th style="text-align:left;">Coût de ce déplacement</th><td>${escapeHtml(attempt)}</td></tr>
        <tr><th style="text-align:left;">Total après déplacement</th><td><b>${escapeHtml(total)}</b></td></tr>
      </tbody>
    </table>
    <p style="margin:0;">Autoriser déplacera automatiquement le token. Refuser le laissera à sa position actuelle.</p>
  </div>`;
}

async function promptMovementApproval(packet) {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.wait) throw new Error("DialogV2 est indisponible pour valider le déplacement.");
  const answer = await DialogV2.wait({
    window: { title: "Valider un dépassement de mouvement" },
    modal: true,
    rejectClose: false,
    content: approvalDialogContent(packet),
    buttons: [
      {
        action: "approve",
        label: "Autoriser le déplacement",
        icon: "fa-solid fa-check",
        default: true
      },
      {
        action: "deny",
        label: "Refuser",
        icon: "fa-solid fa-xmark"
      }
    ]
  });
  return answer === "approve";
}

async function executeApprovedMovement(packet) {
  const scene = game.scenes?.get?.(packet.sceneId) ?? null;
  const tokenDoc = scene?.tokens?.get?.(packet.tokenId) ?? null;
  if (!tokenDoc) throw new Error("Le token demandé n’existe plus dans la scène.");
  if (typeof tokenDoc.move !== "function") throw new Error("L’API native TokenDocument.move est indisponible.");
  const completed = await tokenDoc.move(packet.waypoints, {
    ...(packet.moveOptions ?? {}),
    showRuler: true,
    add2eIgnoreMovement: true,
    add2eMovementApprovalId: packet.requestId,
    add2eMovementRequesterId: packet.requesterId
  });
  if (completed === false) throw new Error("Foundry a interrompu le déplacement autorisé.");
}

function sendMovementApprovalResponse(packet, approved, error = null) {
  game.socket.emit(MOVEMENT_SOCKET_CHANNEL, {
    type: MOVEMENT_APPROVAL_RESPONSE,
    requestId: packet.requestId,
    requesterId: packet.requesterId,
    gmId: String(game.user?.id ?? ""),
    gmName: game.user?.name ?? "MJ",
    approved: approved === true,
    error: error ? String(error?.message ?? error) : null
  });
}

function handleMovementApprovalRequest(packet) {
  if (!packet || packet.type !== MOVEMENT_APPROVAL_REQUEST) return;
  if (!game.user?.isGM || String(packet.gmId ?? "") !== String(game.user.id ?? "")) return;
  if (handledMovementApprovals.has(packet.requestId)) return;
  handledMovementApprovals.add(packet.requestId);

  gmApprovalQueue = gmApprovalQueue
    .catch(() => undefined)
    .then(async () => {
      let approved = false;
      let error = null;
      try {
        approved = await promptMovementApproval(packet);
        if (approved) await executeApprovedMovement(packet);
      } catch (caught) {
        error = caught;
        approved = false;
        console.error(`${ADD2E_MOVE_XP_TAG}[TOKEN][APPROVAL_GM_ERROR]`, caught);
        ui.notifications.error(`Validation du déplacement impossible : ${caught.message}`);
      }
      sendMovementApprovalResponse(packet, approved, error);
      setTimeout(() => handledMovementApprovals.delete(packet.requestId), MOVEMENT_APPROVAL_TIMEOUT_MS);
    });
}

function handleMovementApprovalResponse(packet) {
  if (!packet || packet.type !== MOVEMENT_APPROVAL_RESPONSE) return;
  if (String(packet.requesterId ?? "") !== String(game.user?.id ?? "")) return;
  const pending = clearPendingApproval(packet.requestId);
  if (!pending) return;
  if (packet.approved === true) {
    ui.notifications.info(`${packet.gmName ?? "Le MJ"} a autorisé le déplacement.`);
    return;
  }
  const detail = packet.error ? ` (${packet.error})` : "";
  ui.notifications.warn(`${packet.gmName ?? "Le MJ"} a refusé le déplacement${detail}.`);
}

function installMovementApprovalSocket() {
  if (globalThis.__ADD2E_MOVEMENT_APPROVAL_SOCKET__ === ADD2E_MOVE_XP_VERSION) return;
  globalThis.__ADD2E_MOVEMENT_APPROVAL_SOCKET__ = ADD2E_MOVE_XP_VERSION;
  game.socket.on(MOVEMENT_SOCKET_CHANNEL, packet => {
    if (packet?.type === MOVEMENT_APPROVAL_REQUEST) handleMovementApprovalRequest(packet);
    else if (packet?.type === MOVEMENT_APPROVAL_RESPONSE) handleMovementApprovalResponse(packet);
  });
}

function rememberCombatMovement(tokenDoc, result) {
  const key = combatRoundKey(tokenDoc);
  if (!key || !result || !tokenDoc) return;
  const state = {
    key,
    ratio: round2(result.nextRatio),
    horizontal: round2(result.spent.horizontal + result.components.horizontal),
    ascent: round2(result.spent.ascent + result.components.ascent),
    descent: round2(result.spent.descent + result.components.descent),
    modes: result.budget.modes
  };
  tokenDoc.setFlag("add2e", MOVEMENT_TURN_STATE_FLAG, state)
    .catch(error => console.warn(`${ADD2E_MOVE_XP_TAG}[TOKEN][ROUND_STATE_ERROR]`, error));
}

export function computeTokenMovementScale(tokenDoc, target = {}, { movement = null, phase = "legacy", from = null } = {}) {
  const actor = tokenDoc?.actor;
  if (!actor || actor.type !== "personnage") return null;
  const origin = from ?? (movement ? nativeMovementOrigin(tokenDoc, movement) : point(tokenDoc));
  const horizontalOverride = movement ? nativeHorizontalMeters(tokenDoc, movement, phase) : null;
  const components = movementComponents(tokenDoc, target, { from: origin, horizontalOverride });
  const details = computeMovement(actor, {
    token: tokenDoc,
    scene: tokenDoc.parent ?? canvas?.scene ?? null,
    consumer: "movement-token-control"
  });
  const budget = movementBudget(details, tokenDoc, components);
  const enforced = Boolean(combatRoundKey(tokenDoc));
  const spent = enforced ? spentThisRound(tokenDoc) : emptySpentState();
  const nextRatio = spent.ratio + budget.ratio;
  const status = movementScaleStatus(nextRatio);
  return {
    actor,
    movement: details,
    components,
    budget,
    spent,
    enforced,
    inCombat: Boolean(activeCombat()),
    nextRatio,
    next: nextRatio,
    max: 1,
    origin: components.origin,
    target: components.destination,
    status
  };
}

export function validateTokenMovement(tokenDoc, changes, options = {}, movement = null) {
  if (options?.add2eIgnoreMovement || !game.settings.get("add2e", "enforceTokenMovement")) {
    return { allowed: true, result: null };
  }
  if (!changes || (changes.x === undefined && changes.y === undefined && changes.elevation === undefined && changes.z === undefined)) {
    return { allowed: true, result: null };
  }
  const actor = tokenDoc?.actor;
  if (!actor || actor.type !== "personnage") return { allowed: true, result: null };
  const result = computeTokenMovementScale(tokenDoc, changes, { movement, phase: movement ? "pre" : "legacy" });
  if (!result || !result.enforced) return { allowed: true, result };
  if (game.user.isGM || !result.status.blocked) return { allowed: true, result };
  return { allowed: false, result };
}

function localMovementUser(user, operation = {}) {
  const userId = user?.id ?? operation?.userId ?? operation?.user?.id ?? null;
  return !userId || String(userId) === String(game.user?.id ?? "");
}

function clearCombatMovementStates() {
  if (!game.user?.isGM) return;
  for (const token of canvas?.tokens?.placeables ?? []) {
    if (token.actor?.type !== "personnage") continue;
    token.document.unsetFlag("add2e", MOVEMENT_TURN_STATE_FLAG).catch(() => undefined);
  }
}

function clearAllPendingApprovals(reason = null) {
  for (const requestId of [...pendingMovementApprovals.keys()]) clearPendingApproval(requestId, reason);
  pendingMovementByToken.clear();
}

export function installMovementTokenControl() {
  if (globalThis.__ADD2E_MOVEMENT_TOKEN_CONTROL__ === ADD2E_MOVE_XP_VERSION) return;
  globalThis.__ADD2E_MOVEMENT_TOKEN_CONTROL__ = ADD2E_MOVE_XP_VERSION;

  Hooks.once("ready", async () => {
    installMovementApprovalSocket();
    log("[READY]", {
      version: ADD2E_MOVE_XP_VERSION,
      display: "foundry-native-token-ruler",
      combatPolicy: "strict-one-times-resolved-movement-per-round-with-gm-approval",
      explorationPolicy: "unrestricted"
    });
    if (!game.user.isGM) return;
    for (const actor of game.actors?.filter(actor => actor.type === "personnage") ?? []) {
      await recalc(actor, { mode: "movement" })
        .catch(error => console.warn(`${ADD2E_MOVE_XP_TAG}[READY][SKIP]`, actor?.name, error));
    }
  });

  Hooks.on("preMoveToken", (tokenDoc, movement, operation = {}) => {
    if (!tokenDoc?.actor || tokenDoc.actor.type !== "personnage") return true;
    try { movement.showRuler = true; } catch (_error) {}
    const target = nativeMovementTarget(tokenDoc, movement);
    const checked = validateTokenMovement(
      tokenDoc,
      target,
      { ...operation, add2eNativeMovement: true, userId: game.user?.id ?? null },
      movement
    );
    if (!checked.allowed) {
      requestMovementApproval(tokenDoc, movement, operation, checked.result);
      return false;
    }
    nativeMovementCache.set(nativeMovementCacheKey(tokenDoc, movement), { result: checked.result, target });
    return true;
  });

  Hooks.on("moveToken", (tokenDoc, movement, operation = {}, user = null) => {
    if (!tokenDoc?.actor || tokenDoc.actor.type !== "personnage") return;
    const key = nativeMovementCacheKey(tokenDoc, movement);
    const cached = nativeMovementCache.get(key) ?? null;
    nativeMovementCache.delete(key);
    const target = nativeMovementTarget(tokenDoc, movement);
    const result = cached?.result ?? computeTokenMovementScale(tokenDoc, target, { movement, phase: "post" });
    if (!result?.enforced || !localMovementUser(user, operation)) return;
    rememberCombatMovement(tokenDoc, result);
  });

  Hooks.on("deleteToken", tokenDoc => {
    const prefix = `${tokenDoc?.uuid ?? tokenDoc?.id ?? "token"}:`;
    for (const key of nativeMovementCache.keys()) if (key.startsWith(prefix)) nativeMovementCache.delete(key);
    const tokenKey = movementApprovalTokenKey(tokenDoc);
    const requestId = pendingMovementByToken.get(tokenKey);
    if (requestId) clearPendingApproval(requestId, "La demande a été annulée car le token a été supprimé.");
  });

  Hooks.on("deleteCombat", () => {
    nativeMovementCache.clear();
    handledMovementApprovals.clear();
    clearAllPendingApprovals("La demande a été annulée car le combat est terminé.");
    clearCombatMovementStates();
  });
}
