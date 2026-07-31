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
const MOVE_ALERT_DEDUP_MS = 900;
const movementAlertCache = new Map();
const nativeMovementCache = new Map();

function unitToMeters(distance, unit) {
  const value = norm(unit);
  if (["ft", "feet", "foot", "pied", "pieds", "pi"].includes(value)) return distance * 0.3048;
  if (["km", "kilometre", "kilometres"].includes(value)) return distance * 1000;
  return distance;
}

function round2(value) {
  return Math.round(Math.max(0, Number(value) || 0) * 100) / 100;
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

async function createMovementAlertCard(tokenDoc, result, movedBy, recipients) {
  const build = globalThis.add2eBuildChatCard;
  const create = globalThis.add2eCreateChatCard;
  if (typeof build !== "function" || typeof create !== "function") {
    throw new Error("Les constructeurs communs de cartes ADD2E ne sont pas disponibles.");
  }
  const percent = Number.isFinite(result.nextRatio) ? `${Math.round(result.nextRatio * 100)} %` : "impossible";
  const options = {
    actor: result.actor,
    title: "Déplacement de combat dépassé",
    icon: "fas fa-person-walking-arrow-right",
    variant: "failure",
    source: { name: result.actor.name, img: result.actor.img, type: "Déplacement" },
    rows: [
      { label: "Utilisateur", value: movedBy },
      { label: "Déplacement tenté", value: movementSummary(result) },
      { label: "Budget du round", value: percent },
      { label: "Vitesse", value: `${result.budget.speeds.horizontal || 0} m/round` },
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
          combatRound: activeCombat()?.round ?? null,
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
  if (!result?.enforced || result.nextRatio <= 1.0001) return;
  const sceneId = tokenDoc?.parent?.id ?? canvas?.scene?.id ?? "scene";
  const roundKey = combatRoundKey(tokenDoc) ?? "combat";
  const dedupKey = `${sceneId}:${tokenDoc?.id ?? "token"}:${roundKey}:${Math.round(result.nextRatio * 100)}`;
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
  if (game.user.isGM) {
    const percent = Number.isFinite(result.nextRatio) ? Math.round(result.nextRatio * 100) : "∞";
    ui.notifications.warn(`${result.actor.name} dépasse son mouvement de combat : ${percent} % du round.`);
  }
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
  if (result.nextRatio > 1.0001) notifyGmsMovementExceeded(tokenDoc, result, { userId: options?.userId ?? game.user?.id ?? null });
  if (game.user.isGM || !result.status.blocked) return { allowed: true, result };
  const percent = Number.isFinite(result.nextRatio) ? Math.round(result.nextRatio * 100) : "∞";
  ui.notifications.warn(`${actor.name} dépasse son mouvement de combat : ${percent} % du round.`);
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

export function installMovementTokenControl() {
  if (globalThis.__ADD2E_MOVEMENT_TOKEN_CONTROL__ === ADD2E_MOVE_XP_VERSION) return;
  globalThis.__ADD2E_MOVEMENT_TOKEN_CONTROL__ = ADD2E_MOVE_XP_VERSION;

  Hooks.once("ready", async () => {
    log("[READY]", {
      version: ADD2E_MOVE_XP_VERSION,
      display: "foundry-native-token-ruler",
      combatPolicy: "strict-one-times-resolved-movement-per-round",
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
    if (!checked.allowed) return false;
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
  });

  Hooks.on("deleteCombat", () => {
    movementAlertCache.clear();
    nativeMovementCache.clear();
    clearCombatMovementStates();
  });
}
