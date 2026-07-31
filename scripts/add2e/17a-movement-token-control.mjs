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

const CONTROL_VERSION = "2026-07-31-native-ruler-gm-approval-v7";
const STATE_FLAG = "movementTurnState";
const SOCKET = "system.add2e";
const REQUEST = "ADD2E_MOVEMENT_APPROVAL_REQUEST";
const RESPONSE = "ADD2E_MOVEMENT_APPROVAL_RESPONSE";
const TIMEOUT_MS = 90_000;
const PLAYER_DIALOG_WIDTH = 300;
const GM_DIALOG_WIDTH = 360;

const movementResultCache = new Map();
const spentStateCache = new Map();
const pendingApprovals = new Map();
const pendingApprovalByToken = new Map();
const handledApprovals = new Set();
const recordedMovements = new Set();
let gmApprovalQueue = Promise.resolve();

const runtimeState = {
  version: CONTROL_VERSION,
  loadedAt: Date.now(),
  ready: false,
  socketInstalled: false,
  hookCounts: { preMoveToken: 0, preUpdateToken: 0, moveToken: 0, updateToken: 0 },
  lastCheck: null,
  lastRequest: null,
  lastResponse: null,
  lastDenial: null
};

const round2 = value => Math.round(Math.max(0, Number(value) || 0) * 100) / 100;
const finite = value => Number.isFinite(Number(value));
const isPointLike = value => finite(value?.x) || finite(value?.y) || finite(value?.elevation) || finite(value?.z);

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
    return foundry?.utils?.randomID?.(24) || crypto.randomUUID();
  } catch (_error) {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

function dialogV2() {
  return foundry?.applications?.api?.DialogV2 ?? null;
}

function point(value, fallback = {}) {
  const source = value?.position ?? value?.destination ?? value?.point ?? value ?? {};
  return {
    x: finite(source?.x) ? Number(source.x) : Number(fallback?.x ?? 0),
    y: finite(source?.y) ? Number(source.y) : Number(fallback?.y ?? 0),
    elevation: finite(source?.elevation ?? source?.z)
      ? Number(source.elevation ?? source.z)
      : Number(fallback?.elevation ?? fallback?.z ?? 0)
  };
}

function unitToMeters(distance, unit) {
  const key = norm(unit);
  if (["ft", "feet", "foot", "pied", "pieds", "pi"].includes(key)) return distance * 0.3048;
  if (["km", "kilometre", "kilometres"].includes(key)) return distance * 1000;
  return distance;
}

function sceneUnits(tokenDoc) {
  const scene = tokenDoc?.parent ?? canvas?.scene ?? null;
  return {
    size: Number(scene?.grid?.size ?? canvas?.grid?.size ?? 100) || 100,
    distance: Number(scene?.grid?.distance ?? 1) || 1,
    unit: scene?.grid?.units ?? "m"
  };
}

function movementArrays(movement = {}) {
  return [
    movement?.pending?.waypoints,
    movement?.waypoints,
    movement?.path,
    movement?.route,
    movement?.passed?.waypoints
  ].filter(value => Array.isArray(value) && value.length > 0);
}

function movementWaypoints(tokenDoc, movement = {}, target = null) {
  const origin = point(movement?.origin, tokenDoc);
  const source = movementArrays(movement)[0] ?? [];
  const waypoints = [];
  let previous = origin;

  for (const entry of source) {
    if (!entry || typeof entry !== "object" || !isPointLike(entry)) continue;
    const current = point(entry, previous);
    const waypoint = { x: current.x, y: current.y, elevation: current.elevation };
    for (const key of ["action", "checkpoint", "explicit", "snapped"]) {
      const value = entry[key];
      if (["string", "boolean", "number"].includes(typeof value)) waypoint[key] = value;
    }
    waypoints.push(waypoint);
    previous = current;
  }

  const destinationSource = movement?.destination ?? target;
  if (destinationSource && isPointLike(destinationSource)) {
    const destination = point(destinationSource, previous);
    const last = waypoints.at(-1);
    if (!last || last.x !== destination.x || last.y !== destination.y || last.elevation !== destination.elevation) {
      waypoints.push(destination);
    }
  }
  return waypoints;
}

function movementOrigin(tokenDoc, movement = {}) {
  return point(movement?.origin, tokenDoc);
}

function movementTarget(tokenDoc, movement = {}, fallback = null) {
  if (movement?.destination && isPointLike(movement.destination)) return point(movement.destination, tokenDoc);
  const waypoints = movementWaypoints(tokenDoc, movement, fallback);
  return point(waypoints.at(-1) ?? fallback, tokenDoc);
}

function movementComponents(tokenDoc, movement = {}, target = null) {
  const origin = movementOrigin(tokenDoc, movement);
  const destination = movementTarget(tokenDoc, movement, target);
  const route = movementWaypoints(tokenDoc, movement, destination);
  const { size, distance, unit } = sceneUnits(tokenDoc);
  let previous = origin;
  let horizontal = 0;
  let ascent = 0;
  let descent = 0;

  for (const raw of route.length ? route : [destination]) {
    const current = point(raw, previous);
    horizontal += unitToMeters((Math.hypot(current.x - previous.x, current.y - previous.y) / size) * distance, unit);
    const elevationDelta = unitToMeters(current.elevation - previous.elevation, unit);
    if (elevationDelta > 0) ascent += elevationDelta;
    else descent += Math.abs(elevationDelta);
    previous = current;
  }

  return {
    origin,
    destination,
    waypoints: route.length ? route : [destination],
    horizontal: round2(horizontal),
    ascent: round2(ascent),
    descent: round2(descent)
  };
}

function combatStarted(combat) {
  return Boolean(combat && (combat.started === true || Number(combat.round) > 0));
}

function combatSceneId(combat) {
  return String(combat?.scene?.id ?? combat?.sceneId ?? combat?._source?.scene ?? "");
}

function combatantMatchesToken(combatant, tokenDoc) {
  const tokenId = combatant?.tokenId ?? combatant?.token?.id ?? combatant?.token?.document?.id;
  if (String(tokenId ?? "") !== String(tokenDoc?.id ?? "")) return false;
  const tokenSceneId = String(tokenDoc?.parent?.id ?? "");
  const combatantSceneId = String(combatant?.sceneId ?? combatant?.token?.parent?.id ?? combatSceneId(combatant?.combat) ?? "");
  return !tokenSceneId || !combatantSceneId || tokenSceneId === combatantSceneId;
}

function combatContainsToken(combat, tokenDoc) {
  if (!combatStarted(combat) || !tokenDoc?.id) return false;
  try {
    if (combat.getCombatantByToken?.(tokenDoc.id)) return true;
  } catch (_error) {}
  return Array.from(combat.combatants ?? []).some(combatant => combatantMatchesToken(combatant, tokenDoc));
}

function combatForToken(tokenDoc) {
  if (!tokenDoc) return null;
  const direct = tokenDoc.combatant?.combat ?? null;
  if (combatStarted(direct)) return direct;

  const combats = Array.from(game.combats?.contents ?? game.combats ?? []);
  const containing = combats.find(combat => combatContainsToken(combat, tokenDoc));
  if (containing) return containing;

  const current = game.combat ?? null;
  if (combatStarted(current) && combatContainsToken(current, tokenDoc)) return current;

  const sceneId = String(tokenDoc.parent?.id ?? canvas?.scene?.id ?? "");
  return combats.find(combat => combatStarted(combat) && combatSceneId(combat) === sceneId)
    ?? (combatStarted(current) && (!sceneId || combatSceneId(current) === sceneId) ? current : null);
}

function combatRoundKey(tokenDoc) {
  const combat = combatForToken(tokenDoc);
  return combat ? `${combat.id}:${Math.max(1, Number(combat.round) || 1)}` : null;
}

function tokenRoundStateKey(tokenDoc) {
  return `${tokenDoc?.parent?.id ?? "scene"}:${tokenDoc?.id ?? "token"}:${combatRoundKey(tokenDoc) ?? "none"}`;
}

function normalizeSpentState(value = {}) {
  return {
    ratio: Math.max(0, Number(value.ratio) || 0),
    horizontal: Math.max(0, Number(value.horizontal) || 0),
    ascent: Math.max(0, Number(value.ascent) || 0),
    descent: Math.max(0, Number(value.descent) || 0)
  };
}

function spentThisRound(tokenDoc) {
  const roundKey = combatRoundKey(tokenDoc);
  if (!roundKey) return normalizeSpentState();
  const local = normalizeSpentState(spentStateCache.get(tokenRoundStateKey(tokenDoc)));
  const stored = tokenDoc?.getFlag?.("add2e", STATE_FLAG) ?? {};
  const persisted = stored?.key === roundKey ? normalizeSpentState(stored) : normalizeSpentState();
  return local.ratio >= persisted.ratio ? local : persisted;
}

function movementStatus(ratio) {
  if (!Number.isFinite(ratio)) return { key: "red", label: "impossible", blocked: true };
  if (ratio <= 1.0001) return { key: "green", label: "autorisé", blocked: false };
  if (ratio <= 2.0001) return { key: "orange", label: "dépassé", blocked: true };
  return { key: "red", label: "largement dépassé", blocked: true };
}

function modeSpeed(details, target) {
  const entry = details?.movementModes?.[target] ?? null;
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
  if (result.components.horizontal > 0) rows.push(`${result.components.horizontal.toFixed(1)} m`);
  if (result.components.ascent > 0) rows.push(`+${result.components.ascent.toFixed(1)} m`);
  if (result.components.descent > 0) rows.push(`-${result.components.descent.toFixed(1)} m`);
  return rows.length ? rows.join(" · ") : "0 m";
}

function activeGm() {
  const users = Array.from(game.users ?? []);
  const direct = game.users?.activeGM;
  if (direct?.active && direct.isGM) return direct;
  return users.find(user => user.active && user.isGM && user.isActiveGM === true)
    ?? users.find(user => user.active && user.isGM)
    ?? null;
}

function responsibleGm() {
  if (!game.user?.isGM) return false;
  if (typeof game.user.isActiveGM === "boolean") return game.user.isActiveGM;
  return String(game.users?.activeGM?.id ?? "") === String(game.user.id ?? "");
}

function tokenApprovalKey(tokenDoc) {
  return `${tokenDoc?.parent?.id ?? canvas?.scene?.id ?? "scene"}:${tokenDoc?.id ?? "token"}`;
}

function movementCacheKey(tokenDoc, target) {
  const destination = point(target, tokenDoc);
  return `${tokenDoc?.uuid ?? tokenDoc?.id}:${destination.x}:${destination.y}:${destination.elevation}`;
}

function closeDialog(application) {
  if (!application) return;
  Promise.resolve(application.close?.({ animate: false })).catch(() => undefined);
}

function clearPendingApproval(requestId, reason = null) {
  const entry = pendingApprovals.get(requestId);
  if (!entry) return null;
  clearTimeout(entry.timer);
  closeDialog(entry.playerDialog);
  pendingApprovals.delete(requestId);
  if (pendingApprovalByToken.get(entry.tokenKey) === requestId) pendingApprovalByToken.delete(entry.tokenKey);
  if (reason) ui.notifications.warn(reason);
  return entry;
}

function playerWaitingContent() {
  return `<div class="add2e-dialog add2e-movement-waiting" style="box-sizing:border-box;width:276px;padding:16px 12px;text-align:center;color:#2f250c;">
    <div style="display:flex;align-items:center;justify-content:center;gap:9px;padding:11px 12px;border:1px solid #d5b15a;border-radius:8px;background:#fff8dd;font-size:.95rem;font-weight:950;">
      <i class="fa-solid fa-hourglass-half" aria-hidden="true"></i>
      <span>Validation MJ en attente</span>
    </div>
  </div>`;
}

function openPlayerWaitingDialog(requestId) {
  const DialogV2 = dialogV2();
  if (!DialogV2) return null;
  const dialog = new DialogV2({
    window: { title: "Déplacement" },
    classes: ["add2e-dialog", "add2e-movement-waiting-dialog"],
    position: { width: PLAYER_DIALOG_WIDTH, height: "auto" },
    modal: false,
    content: playerWaitingContent(),
    buttons: []
  });
  dialog.addEventListener?.("close", () => {
    const entry = pendingApprovals.get(requestId);
    if (entry?.playerDialog === dialog) entry.playerDialog = null;
  }, { once: true });
  Promise.resolve(dialog.render({ force: true }))
    .then(() => dialog.setPosition?.({ width: PLAYER_DIALOG_WIDTH, height: "auto" }))
    .catch(error => console.warn(`${ADD2E_MOVE_XP_TAG}[TOKEN][WAIT_DIALOG]`, error));
  return dialog;
}

function approvalSnapshot(tokenDoc, result, requesterId) {
  const requester = game.users?.get?.(requesterId) ?? game.user;
  const speed = Number(result?.budget?.speeds?.horizontal) || 0;
  return {
    requesterName: requester?.name ?? "Joueur",
    actorName: result?.actor?.name ?? tokenDoc?.actor?.name ?? "Personnage",
    movement: movementSummary(result),
    speed: `${round2(speed)} m`
  };
}

function requestApproval(tokenDoc, movement, operation, result) {
  if (result?.inCombat) {
    ui.notifications.warn("Déplacement impossible : la limite de mouvement en combat ne peut pas être dépassée.");
    return false;
  }

  const gm = activeGm();
  if (!gm) {
    ui.notifications.warn("Déplacement bloqué : aucun MJ actif ne peut valider le dépassement hors combat.");
    return false;
  }

  const tokenKey = tokenApprovalKey(tokenDoc);
  const existing = pendingApprovalByToken.get(tokenKey);
  if (existing && pendingApprovals.has(existing)) {
    const entry = pendingApprovals.get(existing);
    if (!entry?.playerDialog) entry.playerDialog = openPlayerWaitingDialog(existing);
    return false;
  }

  const requestId = randomId();
  const requesterId = String(game.user?.id ?? "");
  const target = movementTarget(tokenDoc, movement, result?.target);
  const waypoints = movementWaypoints(tokenDoc, movement, target);
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
    moveOptions: {
      showRuler: true,
      add2eIgnoreMovement: true,
      add2eMovementApprovalId: requestId,
      ...(typeof movement?.autoRotate === "boolean" ? { autoRotate: movement.autoRotate } : {}),
      ...(typeof operation?.animate === "boolean" ? { animate: operation.animate } : {}),
      ...(typeof operation?.method === "string" && operation.method ? { method: operation.method } : {})
    },
    summary: approvalSnapshot(tokenDoc, result, requesterId)
  };

  const timer = setTimeout(() => {
    clearPendingApproval(requestId, "La demande de déplacement a expiré sans réponse du MJ.");
  }, TIMEOUT_MS);
  const entry = { tokenKey, timer, packet, playerDialog: null };
  pendingApprovals.set(requestId, entry);
  pendingApprovalByToken.set(tokenKey, requestId);
  entry.playerDialog = openPlayerWaitingDialog(requestId);
  runtimeState.lastRequest = packet;

  try {
    game.socket.emit(SOCKET, packet);
    console.info(`${ADD2E_MOVE_XP_TAG}[TOKEN][APPROVAL_REQUEST_SENT]`, packet);
  } catch (error) {
    clearPendingApproval(requestId);
    console.error(`${ADD2E_MOVE_XP_TAG}[TOKEN][APPROVAL_REQUEST_ERROR]`, error);
    ui.notifications.error("La demande de déplacement n’a pas pu être envoyée au MJ.");
  }
  return false;
}

function approvalDialogContent(packet) {
  const summary = packet?.summary ?? {};
  const requester = escapeHtml(summary.requesterName ?? "Joueur");
  const actor = escapeHtml(summary.actorName ?? "Personnage");
  const movement = escapeHtml(summary.movement ?? "0 m");
  const speed = escapeHtml(summary.speed ?? "0 m");
  return `<div class="add2e-dialog add2e-movement-approval" style="box-sizing:border-box;width:336px;padding:2px;color:#2f250c;display:grid;gap:8px;">
    <div style="padding:8px 10px;border:1px solid #d5b15a;border-radius:7px;background:#fff8dd;">
      <div style="font-size:.72rem;font-weight:950;text-transform:uppercase;color:#5a3510;">${requester}</div>
      <div style="font-size:.95rem;font-weight:950;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${actor}</div>
    </div>
    <div style="display:grid;grid-template-columns:1fr auto;gap:5px 12px;padding:8px 10px;border:1px solid #d5b15a;border-radius:7px;background:#fffdf4;align-items:center;">
      <span style="font-weight:850;">Déplacement demandé</span><b>${movement}</b>
      <span style="font-weight:850;">Vitesse</span><b>${speed}</b>
    </div>
  </div>`;
}

async function promptApproval(packet) {
  const DialogV2 = dialogV2();
  if (!DialogV2?.wait) throw new Error("DialogV2 est indisponible pour valider le déplacement.");
  return DialogV2.wait({
    window: { title: "Déplacement hors combat" },
    classes: ["add2e-dialog", "add2e-movement-approval-dialog"],
    position: { width: GM_DIALOG_WIDTH, height: "auto" },
    modal: true,
    rejectClose: false,
    content: approvalDialogContent(packet),
    buttons: [
      {
        action: "approve",
        label: "Autoriser",
        icon: "fa-solid fa-check",
        default: true,
        callback: () => true
      },
      {
        action: "deny",
        label: "Refuser",
        icon: "fa-solid fa-xmark",
        callback: () => false
      }
    ]
  });
}

function movementRecordSignature(tokenDoc, result) {
  const target = result?.target ?? result?.components?.destination ?? {};
  return `${tokenRoundStateKey(tokenDoc)}:${target.x}:${target.y}:${target.elevation}:${round2(result?.spent?.ratio)}`;
}

function rememberMovement(tokenDoc, result, { persist = true } = {}) {
  const roundKey = combatRoundKey(tokenDoc);
  if (!roundKey || !result?.inCombat) return;
  const signature = movementRecordSignature(tokenDoc, result);
  if (recordedMovements.has(signature)) return;
  recordedMovements.add(signature);
  setTimeout(() => recordedMovements.delete(signature), 2500);

  const state = {
    key: roundKey,
    ratio: round2(result.nextRatio),
    horizontal: round2(result.spent.horizontal + result.components.horizontal),
    ascent: round2(result.spent.ascent + result.components.ascent),
    descent: round2(result.spent.descent + result.components.descent),
    modes: result.budget.modes
  };
  spentStateCache.set(tokenRoundStateKey(tokenDoc), state);
  if (persist) {
    tokenDoc.setFlag("add2e", STATE_FLAG, state)
      .catch(error => console.warn(`${ADD2E_MOVE_XP_TAG}[TOKEN][ROUND_STATE_ERROR]`, error));
  }
}

async function executeApprovedMovement(packet) {
  const scene = game.scenes?.get?.(packet.sceneId) ?? null;
  const tokenDoc = scene?.tokens?.get?.(packet.tokenId) ?? null;
  if (!tokenDoc) throw new Error("Le token demandé n’existe plus dans la scène.");
  if (combatForToken(tokenDoc)) throw new Error("Le combat a commencé : ce dépassement ne peut plus être autorisé.");

  let completed = false;
  if (typeof tokenDoc.move === "function") {
    completed = await tokenDoc.move(packet.waypoints, {
      ...(packet.moveOptions ?? {}),
      showRuler: true,
      add2eIgnoreMovement: true,
      add2eMovementApprovalId: packet.requestId,
      add2eMovementRequesterId: packet.requesterId
    });
  } else {
    await tokenDoc.update(point(packet.destination, tokenDoc), {
      add2eIgnoreMovement: true,
      add2eMovementApprovalId: packet.requestId,
      add2eMovementRequesterId: packet.requesterId
    });
    completed = true;
  }
  if (completed === false) throw new Error("Foundry a interrompu le déplacement autorisé.");
}

function sendApprovalResponse(packet, approved, error = null) {
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

function handleApprovalRequest(packet) {
  if (!packet || packet.type !== REQUEST || !game.user?.isGM) return;
  const assignedGm = game.users?.get?.(packet.gmId) ?? null;
  const assignedIsActive = Boolean(assignedGm?.active && assignedGm?.isGM);
  if (assignedIsActive && String(packet.gmId ?? "") !== String(game.user.id ?? "")) return;
  if (!assignedIsActive && !responsibleGm()) return;
  if (handledApprovals.has(packet.requestId)) return;
  handledApprovals.add(packet.requestId);
  runtimeState.lastRequest = packet;
  console.info(`${ADD2E_MOVE_XP_TAG}[TOKEN][APPROVAL_REQUEST_RECEIVED]`, packet);

  gmApprovalQueue = gmApprovalQueue.catch(() => undefined).then(async () => {
    let approved = false;
    let error = null;
    try {
      approved = await promptApproval(packet) === true;
      if (approved) await executeApprovedMovement(packet);
    } catch (caught) {
      approved = false;
      error = caught;
      console.error(`${ADD2E_MOVE_XP_TAG}[TOKEN][APPROVAL_GM_ERROR]`, caught);
      ui.notifications.error(`Validation du déplacement impossible : ${caught.message}`);
    }
    sendApprovalResponse(packet, approved, error);
    setTimeout(() => handledApprovals.delete(packet.requestId), TIMEOUT_MS);
  });
}

function handleApprovalResponse(packet) {
  if (!packet || packet.type !== RESPONSE) return;
  if (String(packet.requesterId ?? "") !== String(game.user?.id ?? "")) return;
  if (!clearPendingApproval(packet.requestId)) return;
  runtimeState.lastResponse = packet;
  if (packet.approved !== true) {
    ui.notifications.warn(`${packet.gmName ?? "Le MJ"} a refusé le déplacement${packet.error ? ` (${packet.error})` : ""}.`);
  }
}

function installSocket() {
  if (runtimeState.socketInstalled || !game.socket) return;
  runtimeState.socketInstalled = true;
  game.socket.on(SOCKET, packet => {
    if (packet?.type === REQUEST) handleApprovalRequest(packet);
    else if (packet?.type === RESPONSE) handleApprovalResponse(packet);
  });
}

export function computeTokenMovementScale(tokenDoc, target = {}, { movement = null } = {}) {
  const actor = tokenDoc?.actor;
  if (!actor || String(actor.type ?? "").toLowerCase() !== "personnage") return null;

  const syntheticMovement = movement ?? {
    origin: point(tokenDoc),
    destination: point(target, tokenDoc),
    pending: { waypoints: [point(target, tokenDoc)] }
  };
  const components = movementComponents(tokenDoc, syntheticMovement, target);
  const details = computeMovement(actor, {
    token: tokenDoc,
    scene: tokenDoc.parent ?? canvas?.scene ?? null,
    consumer: "movement-token-control"
  });
  const budget = movementBudget(details, tokenDoc, components);
  const combat = combatForToken(tokenDoc);
  const inCombat = Boolean(combat);
  const spent = inCombat ? spentThisRound(tokenDoc) : normalizeSpentState();
  const nextRatio = spent.ratio + budget.ratio;
  const status = movementStatus(nextRatio);
  const result = {
    actor,
    movement: details,
    components,
    budget,
    spent,
    enforced: inCombat,
    inCombat,
    nextRatio,
    next: nextRatio,
    max: 1,
    origin: components.origin,
    target: components.destination,
    status,
    decision: status.blocked ? (inCombat ? "deny-combat" : "request-gm") : "allow"
  };
  runtimeState.lastCheck = {
    at: Date.now(),
    actor: actor.name,
    token: tokenDoc.name,
    inCombat,
    enforced: inCombat,
    components,
    speeds: budget.speeds,
    spent,
    nextRatio,
    blocked: status.blocked,
    decision: result.decision
  };
  return result;
}

export function validateTokenMovement(tokenDoc, changes, options = {}, movement = null) {
  if (options?.add2eIgnoreMovement) return { allowed: true, result: null, decision: "allow" };
  if (!tokenDoc?.actor || String(tokenDoc.actor.type ?? "").toLowerCase() !== "personnage") {
    return { allowed: true, result: null, decision: "allow" };
  }
  const result = computeTokenMovementScale(tokenDoc, point(changes, tokenDoc), { movement });
  if (!result || game.user?.isGM || !result.status.blocked) return { allowed: true, result, decision: "allow" };
  return { allowed: false, result, decision: result.inCombat ? "deny-combat" : "request-gm" };
}

function handleRejectedMovement(tokenDoc, movement, operation, checked) {
  if (checked?.decision === "request-gm") return requestApproval(tokenDoc, movement, operation, checked.result);

  const result = checked?.result;
  runtimeState.lastDenial = {
    at: Date.now(),
    actor: result?.actor?.name ?? tokenDoc?.actor?.name ?? null,
    token: tokenDoc?.name ?? null,
    movement: movementSummary(result),
    speed: result?.budget?.speeds?.horizontal ?? null,
    spentPercent: Math.round((Number(result?.spent?.ratio) || 0) * 100),
    totalPercent: Number.isFinite(Number(result?.nextRatio)) ? Math.round(Number(result.nextRatio) * 100) : null,
    decision: "deny-combat"
  };
  ui.notifications.warn("Déplacement impossible : la limite de mouvement du round est atteinte.");
  return false;
}

function syntheticMovement(tokenDoc, changes = {}) {
  const destination = point(changes, tokenDoc);
  return { origin: point(tokenDoc), destination, pending: { waypoints: [destination] } };
}

function rememberResultForMove(tokenDoc, movement, result) {
  if (!result) return;
  const movementId = String(movement?.id ?? "");
  if (movementId) movementResultCache.set(`${tokenDoc.uuid}:${movementId}`, result);
  movementResultCache.set(movementCacheKey(tokenDoc, result.target), result);
}

function consumeCachedResult(tokenDoc, movement, target) {
  const movementId = String(movement?.id ?? "");
  const nativeKey = movementId ? `${tokenDoc.uuid}:${movementId}` : "";
  const destinationKey = movementCacheKey(tokenDoc, target);
  const result = (nativeKey ? movementResultCache.get(nativeKey) : null)
    ?? movementResultCache.get(destinationKey)
    ?? null;
  if (nativeKey) movementResultCache.delete(nativeKey);
  movementResultCache.delete(destinationKey);
  return result;
}

function clearCombatStates() {
  spentStateCache.clear();
  recordedMovements.clear();
  if (!responsibleGm()) return;
  for (const token of canvas?.tokens?.placeables ?? []) {
    if (String(token.actor?.type ?? "").toLowerCase() === "personnage") {
      token.document.unsetFlag("add2e", STATE_FLAG).catch(() => undefined);
    }
  }
}

function movementDiagnostics(tokenDoc = canvas?.tokens?.controlled?.[0]?.document ?? null) {
  const actor = tokenDoc?.actor ?? null;
  const combat = tokenDoc ? combatForToken(tokenDoc) : null;
  let movement = null;
  try {
    movement = actor ? computeMovement(actor, {
      token: tokenDoc,
      scene: tokenDoc?.parent ?? canvas?.scene ?? null,
      consumer: "movement-diagnostics"
    }) : null;
  } catch (error) {
    movement = { error: error.message };
  }
  const gm = activeGm();
  return {
    controllerVersion: CONTROL_VERSION,
    policy: {
      combat: "strict-no-override",
      exploration: "single-move-over-speed-requires-gm-approval"
    },
    runtime: foundry?.utils?.deepClone?.(runtimeState) ?? JSON.parse(JSON.stringify(runtimeState)),
    user: { id: game.user?.id, name: game.user?.name, isGM: game.user?.isGM },
    socket: { available: Boolean(game.socket), installed: runtimeState.socketInstalled, channel: SOCKET },
    activeGM: gm ? { id: gm.id, name: gm.name } : null,
    token: tokenDoc ? { id: tokenDoc.id, name: tokenDoc.name, sceneId: tokenDoc.parent?.id } : null,
    actor: actor ? { id: actor.id, name: actor.name, type: actor.type } : null,
    combat: combat ? { id: combat.id, round: combat.round, sceneId: combatSceneId(combat) } : null,
    roundKey: tokenDoc ? combatRoundKey(tokenDoc) : null,
    spent: tokenDoc ? spentThisRound(tokenDoc) : null,
    movement
  };
}

export function installMovementTokenControl() {
  if (globalThis.__ADD2E_MOVEMENT_TOKEN_CONTROL__ === CONTROL_VERSION) return;
  globalThis.__ADD2E_MOVEMENT_TOKEN_CONTROL__ = CONTROL_VERSION;
  globalThis.ADD2E_MOVEMENT_TOKEN_CONTROL_VERSION = CONTROL_VERSION;
  globalThis.ADD2E_MOVEMENT_TOKEN_CONTROL_STATE = runtimeState;
  globalThis.add2eDiagnoseTokenMovement = movementDiagnostics;

  if (game?.ready) runtimeState.ready = true;
  installSocket();

  console.info(`${ADD2E_MOVE_XP_TAG}[TOKEN][CONTROLLER_LOADED]`, {
    controllerVersion: CONTROL_VERSION,
    coreVersion: game?.version ?? game?.release?.version ?? null,
    socketInstalled: runtimeState.socketInstalled
  });

  Hooks.on("preMoveToken", (tokenDoc, movement, operation = {}) => {
    runtimeState.hookCounts.preMoveToken += 1;
    if (!tokenDoc?.actor || operation?.add2eIgnoreMovement) return true;
    try { movement.showRuler = true; } catch (_error) {}
    const target = movementTarget(tokenDoc, movement);
    const checked = validateTokenMovement(tokenDoc, target, operation, movement);
    if (!checked.allowed) return handleRejectedMovement(tokenDoc, movement, operation, checked);
    rememberResultForMove(tokenDoc, movement, checked.result);
    return true;
  });

  Hooks.on("preUpdateToken", (tokenDoc, changes = {}, options = {}, userId = null) => {
    runtimeState.hookCounts.preUpdateToken += 1;
    if (options?.add2eIgnoreMovement) return true;
    const touchesPosition = changes.x !== undefined || changes.y !== undefined || changes.elevation !== undefined || changes.z !== undefined;
    if (!touchesPosition || !tokenDoc?.actor) return true;
    const movement = syntheticMovement(tokenDoc, changes);
    const checked = validateTokenMovement(tokenDoc, movement.destination, { ...options, userId }, movement);
    if (!checked.allowed) return handleRejectedMovement(tokenDoc, movement, { ...options, userId }, checked);
    rememberResultForMove(tokenDoc, movement, checked.result);
    return true;
  });

  Hooks.on("moveToken", (tokenDoc, movement, operation = {}, user = null) => {
    runtimeState.hookCounts.moveToken += 1;
    if (!tokenDoc?.actor) return;
    const target = movementTarget(tokenDoc, movement);
    const result = consumeCachedResult(tokenDoc, movement, target)
      ?? computeTokenMovementScale(tokenDoc, target, { movement });
    if (!result?.inCombat) return;
    const requesterId = String(user?.id ?? operation?.userId ?? "");
    const isRequester = !requesterId || requesterId === String(game.user?.id ?? "");
    if (isRequester || responsibleGm()) rememberMovement(tokenDoc, result, { persist: responsibleGm() || isRequester });
  });

  Hooks.on("updateToken", (tokenDoc, changes = {}, options = {}, userId = null) => {
    runtimeState.hookCounts.updateToken += 1;
    if (options?.add2eIgnoreMovement) return;
    const touchesPosition = changes.x !== undefined || changes.y !== undefined || changes.elevation !== undefined || changes.z !== undefined;
    if (!touchesPosition || !tokenDoc?.actor) return;
    const result = consumeCachedResult(tokenDoc, null, tokenDoc);
    if (!result?.inCombat) return;
    const isRequester = !userId || String(userId) === String(game.user?.id ?? "");
    if (isRequester || responsibleGm()) rememberMovement(tokenDoc, result, { persist: responsibleGm() || isRequester });
  });

  Hooks.on("deleteToken", tokenDoc => {
    const requestId = pendingApprovalByToken.get(tokenApprovalKey(tokenDoc));
    if (requestId) clearPendingApproval(requestId, "La demande a été annulée car le token a été supprimé.");
  });

  Hooks.on("combatRound", () => clearCombatStates());
  Hooks.on("deleteCombat", () => {
    movementResultCache.clear();
    handledApprovals.clear();
    for (const requestId of [...pendingApprovals.keys()]) {
      clearPendingApproval(requestId, "La demande a été annulée car le combat est terminé.");
    }
    clearCombatStates();
  });

  Hooks.once("ready", async () => {
    runtimeState.ready = true;
    installSocket();
    log("[READY]", {
      version: ADD2E_MOVE_XP_VERSION,
      controllerVersion: CONTROL_VERSION,
      display: "foundry-native-token-ruler",
      combatPolicy: "strict-one-times-resolved-movement-per-round-no-override",
      explorationPolicy: "single-move-over-speed-requires-gm-approval",
      playerFeedback: "dialog-v2-waiting",
      socketInstalled: runtimeState.socketInstalled
    });
    console.info(`${ADD2E_MOVE_XP_TAG}[TOKEN][CONTROLLER_READY]`, movementDiagnostics());

    if (!game.user?.isGM) return;
    for (const actor of game.actors?.filter(actor => actor.type === "personnage") ?? []) {
      await recalc(actor, { mode: "movement" })
        .catch(error => console.warn(`${ADD2E_MOVE_XP_TAG}[READY][SKIP]`, actor?.name, error));
    }
  });
}
