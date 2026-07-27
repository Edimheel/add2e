// ADD2E — Contrôle et aperçu du déplacement des tokens.
// Compatible Foundry V13/V14/V15.

import {
  ADD2E_MOVE_XP_VERSION,
  ADD2E_MOVE_XP_TAG,
  computeMovement,
  recalc,
  log
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
  const value = String(unit ?? "").toLowerCase();
  if (["ft", "feet", "foot", "pied", "pieds", "pi"].includes(value)) return distance * 0.3048;
  if (["km", "kilometre", "kilomètre", "kilometres", "kilomètres"].includes(value)) return distance * 1000;
  return distance;
}

function tokenDistanceMeters(tokenDoc, changes, from = null) {
  const scene = tokenDoc.parent ?? canvas?.scene;
  const size = Number(scene?.grid?.size ?? canvas?.grid?.size ?? 100) || 100;
  const distance = Number(scene?.grid?.distance ?? canvas?.scene?.grid?.distance ?? 1) || 1;
  const unit = scene?.grid?.units ?? canvas?.scene?.grid?.units ?? "m";
  const ox = Number(from?.x ?? tokenDoc.x ?? 0) + Number(tokenDoc.width ?? 1) * size / 2;
  const oy = Number(from?.y ?? tokenDoc.y ?? 0) + Number(tokenDoc.height ?? 1) * size / 2;
  const nx = Number(changes.x ?? tokenDoc.x ?? 0) + Number(tokenDoc.width ?? 1) * size / 2;
  const ny = Number(changes.y ?? tokenDoc.y ?? 0) + Number(tokenDoc.height ?? 1) * size / 2;
  return unitToMeters((Math.hypot(nx - ox, ny - oy) / size) * distance, unit);
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

function nativeMovementTarget(tokenDoc, movement = {}) {
  if (isPoint(movement?.destination)) return { x: Number(movement.destination.x), y: Number(movement.destination.y) };
  const pending = movement?.pending?.waypoints ?? [];
  const last = pending[pending.length - 1];
  if (isPoint(last)) return { x: Number(last.x), y: Number(last.y) };
  return { x: Number(tokenDoc?.x ?? 0), y: Number(tokenDoc?.y ?? 0) };
}

function movementOrigin(tokenDoc) {
  return tokenDoc.getFlag("add2e", "lastAllowedPosition") ?? { x: tokenDoc.x, y: tokenDoc.y };
}

function nativeMovementOrigin(tokenDoc, movement = {}) {
  if (isPoint(movement?.origin)) return { x: Number(movement.origin.x), y: Number(movement.origin.y) };
  return movementOrigin(tokenDoc);
}

function nativeMovementMeters(tokenDoc, movement = {}, phase = "pre") {
  const sections = phase === "pre"
    ? [movement?.pending, movement?.passed]
    : [movement?.passed, movement?.pending];
  const unit = tokenDoc?.parent?.grid?.units ?? canvas?.scene?.grid?.units ?? "m";

  for (const section of sections) {
    const distance = Number(section?.distance);
    if (Number.isFinite(distance) && distance > 0) return Math.round(unitToMeters(distance, unit) * 100) / 100;
  }
  return null;
}

function nativeMovementCacheKey(tokenDoc, movement = {}) {
  return `${tokenDoc?.uuid ?? tokenDoc?.id ?? "token"}:${movement?.id ?? "movement"}`;
}

function combatTurnKey() {
  const combat = game.combat;
  return combat ? `${combat.id}:${combat.round ?? 0}:${combat.turn ?? 0}` : null;
}

function spentThisTurn(tokenDoc) {
  const key = combatTurnKey();
  if (!key || !tokenDoc) return 0;
  const state = tokenDoc.getFlag("add2e", MOVEMENT_TURN_STATE_FLAG) ?? {};
  return state.key === key ? Math.max(0, Number(state.spentMeters) || 0) : 0;
}

function movementScaleStatus(distance, max) {
  if (max <= 0) return { key: "red", label: "rouge", color: 0xd91e18, blocked: true };
  if (distance <= max + 0.01) return { key: "green", label: "vert", color: 0x2ecc71, blocked: false };
  if (distance <= (max * 2) + 0.01) return { key: "orange", label: "orange", color: 0xf39c12, blocked: true };
  return { key: "red", label: "rouge", color: 0xd91e18, blocked: true };
}

function drawMovementScale(tokenDoc, status, distance, max) {
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
    token._add2eMovementScale = { status: status.key, distance, max };
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
    maxWidth: "240px",
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
    const point = canvas.stage.toGlobal(new globalThis.PIXI.Point(center.x, center.y));
    const xScale = rendererWidth > 0 ? rect.width / rendererWidth : 1;
    const yScale = rendererHeight > 0 ? rect.height / rendererHeight : 1;
    return { x: rect.left + (Number(point.x) * xScale), y: rect.top + (Number(point.y) * yScale) };
  }
  return null;
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
  label.textContent = `Mouvement : ${result.next.toFixed(1)} m / ${result.max.toFixed(1)} m`;
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
  if (!isPoint(candidate)) return null;
  return { x: Number(candidate.x), y: Number(candidate.y) };
}

function snapDragPoint(token, point) {
  if (!point) return null;
  try {
    const snapped = token?.getSnappedPosition?.(point) ?? canvas?.grid?.getSnappedPoint?.(point);
    if (isPoint(snapped)) return { x: Number(snapped.x), y: Number(snapped.y) };
  } catch (_error) {}
  return point;
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
    const point = dragPoint(candidate);
    if (point) return snapDragPoint(token, point);
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
  drawMovementScale(token.document, result.status, result.next, result.max);
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
  movementPreview.origin = { x: Number(token.document.x ?? 0), y: Number(token.document.y ?? 0) };
  movementPreview.target = null;
  movementPreview.event = event ?? null;
  movementPreview.active = true;
  scheduleLiveMovementPreview(token, event);
}

function installMovementDragPreview() {
  const proto = globalThis.Token?.prototype;
  if (!proto) return;

  const wrappers = {
    _onDragLeftStart: (token, event, result) => {
      if (result !== false) beginLiveMovementPreview(token, event);
    },
    _onDragLeftMove: (token, event, result) => {
      if (result !== false) scheduleLiveMovementPreview(token, event);
    },
    _onDragLeftDrop: token => clearLiveMovementPreview(token),
    _onDragLeftCancel: token => clearLiveMovementPreview(token)
  };

  for (const [method, after] of Object.entries(wrappers)) {
    const original = proto[method];
    if (typeof original !== "function" || original.__add2eMovementPreview === ADD2E_MOVE_XP_VERSION) continue;

    const wrapped = function add2eMovementDragPreview(...args) {
      const result = original.apply(this, args);
      const complete = value => {
        after(this, args[0], value);
        return value;
      };
      return result?.then ? result.then(complete) : complete(result);
    };
    wrapped.__add2eMovementPreview = ADD2E_MOVE_XP_VERSION;
    wrapped.__add2eMovementPreviewOriginal = original;
    proto[method] = wrapped;
  }

  const destinationMethod = proto._updateDragDestination;
  if (typeof destinationMethod === "function" && destinationMethod.__add2eMovementDestinationPreview !== ADD2E_MOVE_XP_VERSION) {
    const wrappedDestination = function add2eMovementDestinationPreview(point, ...args) {
      const result = destinationMethod.call(this, point, ...args);
      const complete = value => {
        if (movementPreview.active && movementPreview.token === this) {
          const target = dragPoint(value) ?? dragPoint(point) ?? liveDragTarget(this, movementPreview.event);
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
  const options = {
    actor: result.actor,
    title: "Déplacement dépassé",
    icon: "fas fa-person-walking-arrow-right",
    variant: "failure",
    source: { name: result.actor.name, img: result.actor.img, type: "Déplacement" },
    rows: [
      { label: "Utilisateur", value: movedBy },
      { label: "Distance", value: `${result.next.toFixed(1)} m / ${result.max.toFixed(1)} m` },
      { label: "État", value: result.status.label }
    ],
    chatData: {
      whisper: recipients,
      flags: {
        add2e: {
          movementAlert: true,
          tokenId: tokenDoc?.id ?? null,
          status: result.status.key,
          distance: result.next,
          max: result.max,
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
  if (!result || result.next <= result.max + 0.01) return;

  const sceneId = tokenDoc?.parent?.id ?? canvas?.scene?.id ?? "scene";
  const turnKey = combatTurnKey() ?? "hors-combat";
  const dedupKey = `${sceneId}:${tokenDoc?.id ?? "token"}:${turnKey}:${result.status.key}:${Math.round(result.next * 10)}`;
  const now = Date.now();
  const previous = movementAlertCache.get(dedupKey) ?? 0;
  if ((now - previous) < MOVE_ALERT_DEDUP_MS) return;
  movementAlertCache.set(dedupKey, now);

  const movedBy = game.users?.get?.(userId ?? game.user?.id)?.name ?? game.user?.name ?? "Utilisateur";
  const recipients = ChatMessage.getWhisperRecipients?.("GM")?.map(user => user.id).filter(Boolean) ?? [];
  if (recipients.length) {
    createMovementAlertCard(tokenDoc, result, movedBy, recipients)
      .catch(error => console.warn(`${ADD2E_MOVE_XP_TAG}[TOKEN][GM_ALERT_ERROR]`, error));
  }

  if (game.user.isGM) ui.notifications.warn(`${result.actor.name} dépasse son mouvement (${result.status.label}) : ${result.next.toFixed(1)} m / ${result.max.toFixed(1)} m.`);
}

function rememberAllowedMovement(tokenDoc, changes, result) {
  if (!result || !tokenDoc) return;
  if (game.combat) {
    const key = combatTurnKey();
    if (!key) return;
    const state = {
      key,
      spentMeters: Math.max(0, Math.round((Number(result.next) || 0) * 100) / 100)
    };
    tokenDoc.setFlag("add2e", MOVEMENT_TURN_STATE_FLAG, state)
      .catch(error => console.warn(`${ADD2E_MOVE_XP_TAG}[TOKEN][TURN_STATE_ERROR]`, error));
  } else {
    tokenDoc.setFlag("add2e", "lastAllowedPosition", { x: changes.x ?? tokenDoc.x, y: changes.y ?? tokenDoc.y })
      .catch(error => console.warn(`${ADD2E_MOVE_XP_TAG}[TOKEN][ORIGIN_FLAG_ERROR]`, error));
  }
}

export function computeTokenMovementScale(tokenDoc, changes = {}, { movement = null, phase = "legacy", from = null } = {}) {
  const actor = tokenDoc.actor;
  if (!actor || actor.type !== "personnage") return null;

  const details = computeMovement(actor);
  const max = Number(details.actuel ?? actor.system?.movement ?? actor.system?.vitesse_deplacement ?? 0) || 0;
  const origin = from ?? (movement ? nativeMovementOrigin(tokenDoc, movement) : (game.combat ? { x: tokenDoc.x, y: tokenDoc.y } : movementOrigin(tokenDoc)));
  const nativeDistance = movement ? nativeMovementMeters(tokenDoc, movement, phase) : null;
  const delta = nativeDistance ?? tokenDistanceMeters(tokenDoc, changes, origin);
  const spent = game.combat ? spentThisTurn(tokenDoc) : 0;
  const next = Math.round((spent + delta) * 100) / 100;
  const status = movementScaleStatus(next, max);

  return { actor, movement: details, max, origin, delta, spent, next, status };
}

export function validateTokenMovement(tokenDoc, changes, options = {}, movement = null) {
  if (options?.add2eIgnoreMovement || !game.settings.get("add2e", "enforceTokenMovement")) return { allowed: true, result: null };
  if (!changes || (changes.x === undefined && changes.y === undefined)) return { allowed: true, result: null };
  const actor = tokenDoc.actor;
  if (!actor || actor.type !== "personnage") return { allowed: true, result: null };

  const result = computeTokenMovementScale(tokenDoc, changes, { movement, phase: movement ? "pre" : "legacy" });
  if (!result) return { allowed: true, result: null };

  if (result.next > result.max + 0.01) notifyGmsMovementExceeded(tokenDoc, result, { userId: options?.userId ?? game.user?.id ?? null });
  if (game.user.isGM || !result.status.blocked) return { allowed: true, result };

  ui.notifications.warn(`${actor.name} dépasse son mouvement (${result.status.label}) : ${result.next.toFixed(1)} m / ${result.max.toFixed(1)} m.`);
  return { allowed: false, result };
}

function drawResultAfterAnimation(tokenDoc, result, movement = null) {
  const draw = () => drawMovementScale(tokenDoc, result.status, result.next, result.max);
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
        await recalc(actor, { mode: "movement" }).catch(error => console.warn(`${ADD2E_MOVE_XP_TAG}[READY][SKIP]`, actor?.name, error));
      }
    }
    for (const token of canvas?.tokens?.placeables ?? []) {
      if (token.actor?.type === "personnage") token.document.setFlag("add2e", "lastAllowedPosition", { x: token.document.x, y: token.document.y });
    }
  });

  Hooks.on("canvasReady", () => clearLiveMovementPreview(null, { clearScale: false }));

  Hooks.on("preMoveToken", (tokenDoc, movement, operation = {}) => {
    if (!usesNativeTokenMovementHooks()) return true;
    if (!tokenDoc?.actor || tokenDoc.actor.type !== "personnage") return true;

    const target = nativeMovementTarget(tokenDoc, movement);
    const checked = validateTokenMovement(tokenDoc, target, { ...operation, add2eNativeMovement: true, userId: game.user?.id ?? null }, movement);
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
    const checked = validateTokenMovement(tokenDoc, changes, options);
    return checked.allowed;
  });

  Hooks.on("updateToken", (tokenDoc, changes, _options = {}, userId = null) => {
    if (usesNativeTokenMovementHooks()) return;
    if (!changes || (changes.x === undefined && changes.y === undefined)) return;
    if (!game.settings.get("add2e", "enforceTokenMovement")) return;

    const result = computeTokenMovementScale(tokenDoc, { x: tokenDoc.x, y: tokenDoc.y });
    if (!result) return;
    drawMovementScale(tokenDoc, result.status, result.next, result.max);
    if (!userId || game.user?.id === userId) rememberAllowedMovement(tokenDoc, { x: tokenDoc.x, y: tokenDoc.y }, result);
  });

  Hooks.on("controlToken", token => {
    if (token?.actor?.type !== "personnage") return;
    token.document.setFlag("add2e", "lastAllowedPosition", { x: token.document.x, y: token.document.y });
    const result = computeTokenMovementScale(token.document, { x: token.document.x, y: token.document.y });
    if (result) drawMovementScale(token.document, result.status, result.next, result.max);
  });
}
