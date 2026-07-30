// ADD2E — Contrôle et aperçu des déplacements terrestres, aériens, verticaux et aquatiques.
// Compatible Foundry V13/V14/V15.

import {
  ADD2E_MOVE_XP_VERSION,
  ADD2E_MOVE_XP_TAG,
  computeMovement,
  recalc,
  log,
  norm
} from "./17a-movement-xp-domain.mjs";

const MOVE_ALERT_DEDUP_MS = 900;
const MOVE_PREVIEW_LABEL_ID = "add2e-movement-preview";
const MOVEMENT_TURN_STATE_FLAG = "movementTurnState";
const movementAlertCache = new Map();
const nativeMovementCache = new Map();
const movementPreview = {
  token: null,
  origin: null,
  target: null,
  event: null,
  frame: null,
  active: false
};

function unitToMeters(distance, unit) {
  const value = norm(unit);
  if (["ft", "feet", "foot", "pied", "pieds", "pi"].includes(value)) return distance * 0.3048;
  if (["km", "kilometre", "kilometres"].includes(value)) return distance * 1000;
  return distance;
}

function round2(value) {
  return Math.round(Math.max(0, Number(value) || 0) * 100) / 100;
}

function foundryGeneration() {
  const generation = Number(game?.release?.generation ?? String(game?.version ?? "").split(".")[0]);
  return Number.isFinite(generation) ? generation : 0;
}

function usesNativeTokenMovementHooks() {
  return foundryGeneration() >= 14;
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
    scene,
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

function movementOrigin(tokenDoc) {
  const stored = tokenDoc?.getFlag?.("add2e", "lastAllowedPosition") ?? null;
  return point(stored, tokenDoc);
}

function nativeMovementOrigin(tokenDoc, movement = {}) {
  return isPoint(movement?.origin) ? point(movement.origin, tokenDoc) : movementOrigin(tokenDoc);
}

function nativeMovementTarget(tokenDoc, movement = {}) {
  if (isPoint(movement?.destination)) return point(movement.destination, tokenDoc);
  const pending = movement?.pending?.waypoints ?? [];
  const last = pending[pending.length - 1];
  if (isPoint(last)) return point(last, tokenDoc);
  return point(tokenDoc);
}

function nativeHorizontalMeters(tokenDoc, movement = {}, phase = "pre") {
  const sections = phase === "pre" ? [movement?.pending, movement?.passed] : [movement?.passed, movement?.pending];
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

function combatTurnKey() {
  const combat = game.combat;
  return combat ? `${combat.id}:${combat.round ?? 0}:${combat.turn ?? 0}` : null;
}

function emptySpentState() {
  return { ratio: 0, horizontal: 0, ascent: 0, descent: 0 };
}

function spentThisTurn(tokenDoc) {
  const key = combatTurnKey();
  if (!key || !tokenDoc) return emptySpentState();
  const state = tokenDoc.getFlag("add2e", MOVEMENT_TURN_STATE_FLAG) ?? {};
  if (state.key !== key) return emptySpentState();
  return {
    ratio: Math.max(0, Number(state.ratio) || 0),
    horizontal: Math.max(0, Number(state.horizontal) || 0),
    ascent: Math.max(0, Number(state.ascent) || 0),
    descent: Math.max(0, Number(state.descent) || 0)
  };
}

function movementScaleStatus(ratio) {
  if (!Number.isFinite(ratio)) return { key: "red", label: "rouge", color: 0xd91e18, blocked: true };
  if (ratio <= 1.0001) return { key: "green", label: "vert", color: 0x2ecc71, blocked: false };
  if (ratio <= 2.0001) return { key: "orange", label: "orange", color: 0xf39c12, blocked: true };
  return { key: "red", label: "rouge", color: 0xd91e18, blocked: true };
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
    vol: "flight", aerien: "flight", flight: "flight",
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
  } else if (direction === "descent") {
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

function drawMovementScale(tokenDoc, status, result) {
  const token = canvas?.tokens?.get?.(tokenDoc.id);
  const Graphics = globalThis.PIXI?.Graphics;
  if (!token || !Graphics) return;
  try {
    if (!token._add2eMovementScaleRing) {
      token._add2eMovementScaleRing = new Graphics();
      token.addChild(token._add2eMovementScaleRing);
    }
    const graphics = token._add2eMovementScaleRing;
    const width = Number(token.w ?? token.width ?? canvas.grid.size) || canvas.grid.size;
    const height = Number(token.h ?? token.height ?? canvas.grid.size) || canvas.grid.size;
    graphics.clear?.();
    if (typeof graphics.roundRect === "function" && typeof graphics.stroke === "function") {
      graphics.roundRect(-3, -3, width + 6, height + 6, 10);
      graphics.stroke({ width: 5, color: status.color, alpha: 0.95 });
    } else {
      graphics.lineStyle(5, status.color, 0.95);
      graphics.drawRoundedRect(-3, -3, width + 6, height + 6, 10);
    }
    graphics.zIndex = 9999;
    token.sortChildren?.();
    token._add2eMovementScale = {
      status: status.key,
      ratio: result?.nextRatio ?? 0,
      modes: result?.budget?.modes ?? {}
    };
  } catch (error) {
    console.warn(`${ADD2E_MOVE_XP_TAG}[TOKEN][SCALE_DRAW_ERROR]`, error);
  }
}

function clearMovementScale(tokenDoc) {
  const token = canvas?.tokens?.get?.(tokenDoc?.id);
  if (!token?._add2eMovementScaleRing) return;
  try {
    token._add2eMovementScaleRing.clear?.();
    token._add2eMovementScale = null;
  } catch (_error) {}
}

function movementPreviewLabel() {
  if (!document?.body) return null;
  let label = document.getElementById(MOVE_PREVIEW_LABEL_ID);
  if (label) return label;
  label = document.createElement("div");
  label.id = MOVE_PREVIEW_LABEL_ID;
  label.setAttribute("aria-live", "polite");
  Object.assign(label.style, {
    position: "fixed",
    display: "none",
    zIndex: "10000",
    pointerEvents: "none",
    maxWidth: "360px",
    padding: "5px 8px",
    border: "1px solid #2ecc71",
    borderRadius: "7px",
    background: "rgba(15, 44, 28, .94)",
    boxShadow: "0 2px 8px rgba(0, 0, 0, .35)",
    color: "#fff",
    fontFamily: "var(--font-primary, Signika, sans-serif)",
    fontSize: "13px",
    fontWeight: "700",
    whiteSpace: "nowrap"
  });
  document.body.appendChild(label);
  return label;
}

function dragEventData(event) {
  return event?.interactionData ?? event?.data ?? event ?? {};
}

function dragClientPosition(event, token = null) {
  const data = dragEventData(event);
  const raw = data?.originalEvent ?? event?.originalEvent ?? event?.nativeEvent ?? event;
  const directX = Number(raw?.clientX);
  const directY = Number(raw?.clientY);
  if (Number.isFinite(directX) && Number.isFinite(directY)) return { x: directX, y: directY };
  const global = data?.global ?? event?.global ?? null;
  const view = canvas?.app?.view ?? canvas?.app?.renderer?.view ?? null;
  const rect = view?.getBoundingClientRect?.() ?? null;
  const rendererWidth = Number(canvas?.app?.renderer?.width ?? view?.width ?? 0);
  const rendererHeight = Number(canvas?.app?.renderer?.height ?? view?.height ?? 0);
  if (rect && isPoint(global)) {
    const xScale = rendererWidth > 0 ? rect.width / rendererWidth : 1;
    const yScale = rendererHeight > 0 ? rect.height / rendererHeight : 1;
    return { x: rect.left + (Number(global.x) * xScale), y: rect.top + (Number(global.y) * yScale) };
  }
  const center = token?.center ?? null;
  if (rect && isPoint(center) && typeof canvas?.stage?.toGlobal === "function" && globalThis.PIXI?.Point) {
    const screen = canvas.stage.toGlobal(new globalThis.PIXI.Point(center.x, center.y));
    const xScale = rendererWidth > 0 ? rect.width / rendererWidth : 1;
    const yScale = rendererHeight > 0 ? rect.height / rendererHeight : 1;
    return { x: rect.left + (Number(screen.x) * xScale), y: rect.top + (Number(screen.y) * yScale) };
  }
  return null;
}

function movementSummary(result) {
  const pieces = [];
  if (result.components.horizontal > 0) pieces.push(`${result.components.horizontal.toFixed(1)} m ${result.budget.modes.horizontal}`);
  if (result.components.ascent > 0) pieces.push(`+${result.components.ascent.toFixed(1)} m`);
  if (result.components.descent > 0) pieces.push(`−${result.components.descent.toFixed(1)} m`);
  return pieces.length ? pieces.join(" · ") : "0 m";
}

function showMovementPreviewLabel(token, event, result) {
  const label = movementPreviewLabel();
  if (!label || !result) return;
  const colors = {
    green: { border: "#2ecc71", background: "rgba(15, 75, 45, .95)" },
    orange: { border: "#f39c12", background: "rgba(100, 58, 4, .95)" },
    red: { border: "#d91e18", background: "rgba(105, 18, 16, .96)" }
  };
  const color = colors[result.status.key] ?? colors.green;
  const percent = Number.isFinite(result.nextRatio) ? Math.round(result.nextRatio * 100) : "∞";
  label.textContent = `Mouvement : ${movementSummary(result)} · budget ${percent}%`;
  label.style.borderColor = color.border;
  label.style.background = color.background;
  label.style.display = "block";
  const client = dragClientPosition(event, token);
  if (client) {
    label.style.left = `${Math.max(8, Math.round(client.x + 16))}px`;
    label.style.top = `${Math.max(8, Math.round(client.y + 16))}px`;
  }
}

function hideMovementPreviewLabel() {
  const label = document?.getElementById?.(MOVE_PREVIEW_LABEL_ID);
  if (label) label.style.display = "none";
}

function dragPoint(value) {
  const candidate = value?.position ?? value?.destination ?? value?.point ?? value;
  return isPoint(candidate) ? point(candidate) : null;
}

function snapDragPoint(token, value) {
  if (!value) return null;
  try {
    const snapped = token?.getSnappedPosition?.(value) ?? canvas?.grid?.getSnappedPoint?.(value);
    if (isPoint(snapped)) return { ...point(snapped), elevation: Number(value.elevation ?? token?.document?.elevation ?? 0) };
  } catch (_error) {}
  return point(value, token?.document);
}

function liveDragTarget(token, event) {
  if (movementPreview.token === token && isPoint(movementPreview.target)) return movementPreview.target;
  const data = dragEventData(event);
  const candidates = [
    token?._dragData?.destination,
    token?._dragData?.position,
    token?._preview?.document,
    token?._preview,
    token?.preview?.document,
    token?.preview,
    data?.destination,
    data?.position,
    data?.current,
    event?.destination,
    event?.position
  ];
  for (const candidate of candidates) {
    const value = dragPoint(candidate);
    if (value) return snapDragPoint(token, value);
  }
  return null;
}

function clearLiveMovementPreview(token = null, { clearScale = true } = {}) {
  const active = movementPreview.token;
  if (token && active && token !== active) return;
  if (movementPreview.frame) cancelAnimationFrame(movementPreview.frame);
  movementPreview.frame = null;
  movementPreview.active = false;
  movementPreview.origin = null;
  movementPreview.target = null;
  movementPreview.event = null;
  movementPreview.token = null;
  hideMovementPreviewLabel();
  if (clearScale && active?.document) clearMovementScale(active.document);
}

function updateLiveMovementPreview(token, event = null, target = null) {
  if (!movementPreview.active || movementPreview.token !== token || !token?.document) return;
  const resolvedTarget = target ?? movementPreview.target ?? liveDragTarget(token, event ?? movementPreview.event);
  if (!resolvedTarget) return;
  movementPreview.target = snapDragPoint(token, resolvedTarget);
  if (event) movementPreview.event = event;
  const result = computeTokenMovementScale(token.document, movementPreview.target, { from: movementPreview.origin });
  if (!result) return;
  drawMovementScale(token.document, result.status, result);
  showMovementPreviewLabel(token, movementPreview.event, result);
}

function scheduleLiveMovementPreview(token, event = null, target = null) {
  if (event) movementPreview.event = event;
  if (target) movementPreview.target = snapDragPoint(token, target);
  if (movementPreview.frame) cancelAnimationFrame(movementPreview.frame);
  movementPreview.frame = requestAnimationFrame(() => {
    movementPreview.frame = null;
    updateLiveMovementPreview(token, movementPreview.event, movementPreview.target);
  });
}

function beginLiveMovementPreview(token, event) {
  if (!game.settings.get("add2e", "enforceTokenMovement")) return;
  if (!token?.document || token.actor?.type !== "personnage") return;
  movementPreview.token = token;
  movementPreview.origin = point(token.document);
  movementPreview.target = null;
  movementPreview.event = event ?? null;
  movementPreview.active = true;
  scheduleLiveMovementPreview(token, event);
}

function installMovementDragPreview() {
  const proto = globalThis.Token?.prototype;
  if (!proto) return;
  const wrappers = {
    _onDragLeftStart: (token, event, result) => { if (result !== false) beginLiveMovementPreview(token, event); },
    _onDragLeftMove: (token, event, result) => { if (result !== false) scheduleLiveMovementPreview(token, event); },
    _onDragLeftDrop: token => clearLiveMovementPreview(token),
    _onDragLeftCancel: token => clearLiveMovementPreview(token)
  };
  for (const [method, after] of Object.entries(wrappers)) {
    const original = proto[method];
    if (typeof original !== "function" || original.__add2eMovementPreview === ADD2E_MOVE_XP_VERSION) continue;
    const wrapped = function add2eMovementDragPreview(...args) {
      const result = original.apply(this, args);
      const complete = value => { after(this, args[0], value); return value; };
      return result?.then ? result.then(complete) : complete(result);
    };
    wrapped.__add2eMovementPreview = ADD2E_MOVE_XP_VERSION;
    wrapped.__add2eMovementPreviewOriginal = original;
    proto[method] = wrapped;
  }
  const destinationMethod = proto._updateDragDestination;
  if (typeof destinationMethod === "function" && destinationMethod.__add2eMovementDestinationPreview !== ADD2E_MOVE_XP_VERSION) {
    const wrappedDestination = function add2eMovementDestinationPreview(destination, ...args) {
      const result = destinationMethod.call(this, destination, ...args);
      const complete = value => {
        if (movementPreview.active && movementPreview.token === this) {
          const target = dragPoint(value) ?? dragPoint(destination) ?? liveDragTarget(this, movementPreview.event);
          if (target) scheduleLiveMovementPreview(this, movementPreview.event, target);
        }
        return value;
      };
      return result?.then ? result.then(complete) : complete(result);
    };
    wrappedDestination.__add2eMovementDestinationPreview = ADD2E_MOVE_XP_VERSION;
    wrappedDestination.__add2eMovementPreviewOriginal = destinationMethod;
    proto._updateDragDestination = wrappedDestination;
  }
  if (!globalThis.__ADD2E_MOVEMENT_PREVIEW_ESCAPE_BOUND__) {
    globalThis.__ADD2E_MOVEMENT_PREVIEW_ESCAPE_BOUND__ = true;
    window.addEventListener("keydown", event => {
      if (event.key === "Escape") clearLiveMovementPreview();
    }, true);
  }
}

async function createMovementAlertCard(tokenDoc, result, movedBy, recipients) {
  const build = globalThis.add2eBuildChatCard;
  const create = globalThis.add2eCreateChatCard;
  if (typeof build !== "function" || typeof create !== "function") {
    throw new Error("Les constructeurs communs de cartes ADD2E ne sont pas disponibles.");
  }
  const percent = Number.isFinite(result.nextRatio) ? `${Math.round(result.nextRatio * 100)} %` : "impossible";
  const options = {
    actor: result.actor,
    title: "Déplacement dépassé",
    icon: "fas fa-person-walking-arrow-right",
    variant: "failure",
    source: { name: result.actor.name, img: result.actor.img, type: "Déplacement" },
    rows: [
      { label: "Utilisateur", value: movedBy },
      { label: "Déplacement", value: movementSummary(result) },
      { label: "Budget du round", value: percent },
      { label: "Modes", value: Object.values(result.budget.modes).filter(Boolean).join(" / ") },
      { label: "État", value: result.status.label }
    ],
    chatData: {
      whisper: recipients,
      flags: {
        add2e: {
          movementAlert: true,
          tokenId: tokenDoc?.id ?? null,
          status: result.status.key,
          ratio: result.nextRatio,
          components: result.components,
          modes: result.budget.modes,
          version: ADD2E_MOVE_XP_VERSION
        }
      }
    }
  };
  const preview = build(options);
  if (!String(preview ?? "").trim()) throw new Error("La carte d’alerte de déplacement ADD2E est vide.");
  return create(options);
}

function notifyGmsMovementExceeded(tokenDoc, result, { userId = null } = {}) {
  if (!result || result.nextRatio <= 1.0001) return;
  const sceneId = tokenDoc?.parent?.id ?? canvas?.scene?.id ?? "scene";
  const turnKey = combatTurnKey() ?? "hors-combat";
  const dedupKey = `${sceneId}:${tokenDoc?.id ?? "token"}:${turnKey}:${result.status.key}:${Math.round(result.nextRatio * 100)}`;
  const now = Date.now();
  const previous = movementAlertCache.get(dedupKey) ?? 0;
  if ((now - previous) < MOVE_ALERT_DEDUP_MS) return;
  movementAlertCache.set(dedupKey, now);
  const movedBy = game.users?.get?.(userId ?? game.user?.id)?.name ?? game.user?.name ?? "Utilisateur";
  const recipients = ChatMessage.getWhisperRecipients?.("GM")?.map(user => user.id).filter(Boolean) ?? [];
  if (recipients.length) createMovementAlertCard(tokenDoc, result, movedBy, recipients)
    .catch(error => console.warn(`${ADD2E_MOVE_XP_TAG}[TOKEN][GM_ALERT_ERROR]`, error));
  if (game.user.isGM) {
    const percent = Number.isFinite(result.nextRatio) ? Math.round(result.nextRatio * 100) : "∞";
    ui.notifications.warn(`${result.actor.name} dépasse son mouvement (${result.status.label}) : ${percent} % du round.`);
  }
}

function rememberAllowedMovement(tokenDoc, target, result) {
  if (!result || !tokenDoc) return;
  if (game.combat) {
    const key = combatTurnKey();
    if (!key) return;
    const state = {
      key,
      ratio: round2(result.nextRatio),
      horizontal: round2(result.spent.horizontal + result.components.horizontal),
      ascent: round2(result.spent.ascent + result.components.ascent),
      descent: round2(result.spent.descent + result.components.descent),
      modes: result.budget.modes
    };
    tokenDoc.setFlag("add2e", MOVEMENT_TURN_STATE_FLAG, state)
      .catch(error => console.warn(`${ADD2E_MOVE_XP_TAG}[TOKEN][TURN_STATE_ERROR]`, error));
  } else {
    const destination = point(target, tokenDoc);
    tokenDoc.setFlag("add2e", "lastAllowedPosition", destination)
      .catch(error => console.warn(`${ADD2E_MOVE_XP_TAG}[TOKEN][ORIGIN_FLAG_ERROR]`, error));
  }
}

export function computeTokenMovementScale(tokenDoc, target = {}, { movement = null, phase = "legacy", from = null } = {}) {
  const actor = tokenDoc?.actor;
  if (!actor || actor.type !== "personnage") return null;
  const origin = from ?? (movement ? nativeMovementOrigin(tokenDoc, movement) : (game.combat ? point(tokenDoc) : movementOrigin(tokenDoc)));
  const horizontalOverride = movement ? nativeHorizontalMeters(tokenDoc, movement, phase) : null;
  const components = movementComponents(tokenDoc, target, { from: origin, horizontalOverride });
  const details = computeMovement(actor, {
    token: tokenDoc,
    scene: tokenDoc.parent ?? canvas?.scene ?? null,
    consumer: "movement-token-control"
  });
  const budget = movementBudget(details, tokenDoc, components);
  const spent = game.combat ? spentThisTurn(tokenDoc) : emptySpentState();
  const nextRatio = spent.ratio + budget.ratio;
  const status = movementScaleStatus(nextRatio);
  return {
    actor,
    movement: details,
    components,
    budget,
    spent,
    nextRatio,
    next: nextRatio,
    max: 1,
    origin: components.origin,
    target: components.destination,
    status
  };
}

export function validateTokenMovement(tokenDoc, changes, options = {}, movement = null) {
  if (options?.add2eIgnoreMovement || !game.settings.get("add2e", "enforceTokenMovement")) return { allowed: true, result: null };
  if (!changes || (changes.x === undefined && changes.y === undefined && changes.elevation === undefined && changes.z === undefined)) return { allowed: true, result: null };
  const actor = tokenDoc?.actor;
  if (!actor || actor.type !== "personnage") return { allowed: true, result: null };
  const result = computeTokenMovementScale(tokenDoc, changes, { movement, phase: movement ? "pre" : "legacy" });
  if (!result) return { allowed: true, result: null };
  if (result.nextRatio > 1.0001) notifyGmsMovementExceeded(tokenDoc, result, { userId: options?.userId ?? game.user?.id ?? null });
  if (game.user.isGM || !result.status.blocked) return { allowed: true, result };
  const percent = Number.isFinite(result.nextRatio) ? Math.round(result.nextRatio * 100) : "∞";
  ui.notifications.warn(`${actor.name} dépasse son mouvement (${result.status.label}) : ${percent} % du round.`);
  return { allowed: false, result };
}

function drawResultAfterAnimation(tokenDoc, result, movement = null) {
  const draw = () => drawMovementScale(tokenDoc, result.status, result);
  const ended = movement?.animation?.ended;
  if (ended && typeof ended.then === "function") ended.then(draw).catch(draw);
  else draw();
}

export function installMovementTokenControl() {
  if (globalThis.__ADD2E_MOVEMENT_TOKEN_CONTROL__ === ADD2E_MOVE_XP_VERSION) return;
  globalThis.__ADD2E_MOVEMENT_TOKEN_CONTROL__ = ADD2E_MOVE_XP_VERSION;

  Hooks.once("ready", async () => {
    log("[READY]", { version: ADD2E_MOVE_XP_VERSION, generation: foundryGeneration() });
    installMovementDragPreview();
    if (game.user.isGM) {
      for (const actor of game.actors?.filter(actor => actor.type === "personnage") ?? []) {
        await recalc(actor, { mode: "movement" })
          .catch(error => console.warn(`${ADD2E_MOVE_XP_TAG}[READY][SKIP]`, actor?.name, error));
      }
    }
    for (const token of canvas?.tokens?.placeables ?? []) {
      if (token.actor?.type === "personnage") {
        token.document.setFlag("add2e", "lastAllowedPosition", point(token.document));
      }
    }
  });

  Hooks.on("canvasReady", () => clearLiveMovementPreview(null, { clearScale: false }));

  Hooks.on("preMoveToken", (tokenDoc, movement, operation = {}) => {
    if (!usesNativeTokenMovementHooks()) return true;
    if (!tokenDoc?.actor || tokenDoc.actor.type !== "personnage") return true;
    const target = nativeMovementTarget(tokenDoc, movement);
    const checked = validateTokenMovement(
      tokenDoc,
      target,
      { ...operation, add2eNativeMovement: true, userId: game.user?.id ?? null },
      movement
    );
    if (!checked.allowed) return false;
    nativeMovementCache.set(nativeMovementCacheKey(tokenDoc, movement), { result: checked.result, target });
    return true;
  });

  Hooks.on("moveToken", (tokenDoc, movement, _operation = {}, user = null) => {
    if (!usesNativeTokenMovementHooks()) return;
    if (!tokenDoc?.actor || tokenDoc.actor.type !== "personnage") return;
    const key = nativeMovementCacheKey(tokenDoc, movement);
    const cached = nativeMovementCache.get(key) ?? null;
    nativeMovementCache.delete(key);
    const target = nativeMovementTarget(tokenDoc, movement);
    const result = cached?.result ?? computeTokenMovementScale(tokenDoc, target, { movement, phase: "post" });
    if (!result) return;
    drawResultAfterAnimation(tokenDoc, result, movement);
    if (!user?.id || game.user?.id === user.id) rememberAllowedMovement(tokenDoc, target, result);
  });

  Hooks.on("preUpdateToken", (tokenDoc, changes, options) => {
    if (usesNativeTokenMovementHooks()) return true;
    return validateTokenMovement(tokenDoc, changes, options).allowed;
  });

  Hooks.on("updateToken", (tokenDoc, changes, _options = {}, userId = null) => {
    if (usesNativeTokenMovementHooks()) return;
    if (!changes || (changes.x === undefined && changes.y === undefined && changes.elevation === undefined && changes.z === undefined)) return;
    if (!game.settings.get("add2e", "enforceTokenMovement")) return;
    const target = point(tokenDoc);
    const result = computeTokenMovementScale(tokenDoc, target);
    if (!result) return;
    drawMovementScale(tokenDoc, result.status, result);
    if (!userId || game.user?.id === userId) rememberAllowedMovement(tokenDoc, target, result);
  });

  Hooks.on("controlToken", token => {
    if (token?.actor?.type !== "personnage") return;
    token.document.setFlag("add2e", "lastAllowedPosition", point(token.document));
    const result = computeTokenMovementScale(token.document, point(token.document));
    if (result) drawMovementScale(token.document, result.status, result);
  });

  Hooks.on("deleteToken", tokenDoc => {
    nativeMovementCache.delete(tokenDoc?.uuid ?? tokenDoc?.id ?? "");
    clearMovementScale(tokenDoc);
  });

  Hooks.on("deleteCombat", () => {
    for (const token of canvas?.tokens?.placeables ?? []) {
      if (token.actor?.type === "personnage") token.document.unsetFlag("add2e", MOVEMENT_TURN_STATE_FLAG).catch(() => undefined);
    }
  });
}
