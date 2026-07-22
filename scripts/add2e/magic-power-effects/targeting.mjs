// ADD2E — Pouvoirs d'objets magiques / ciblage, portée, zones et sauvegardes.

import { clone, norm, number, hasValue, resolveExecutionParameters } from "./runtime.mjs";

export function actorToken(actor) {
  const controlled = canvas?.tokens?.controlled ?? [];
  return controlled.find(token => token?.actor?.id === actor?.id)
    ?? actor?.getActiveTokens?.()?.[0] ?? actor?.token?.object ?? actor?.token ?? null;
}

export function selectedTokens() {
  return Array.from(game.user?.targets ?? []).filter(token => token?.actor);
}

export function tokenForActor(actor) {
  if (!actor) return null;
  return canvas?.tokens?.placeables?.find?.(token => token?.actor?.id === actor.id)
    ?? actor?.getActiveTokens?.()?.[0] ?? actor?.token?.object ?? actor?.token ?? null;
}

function normalizedTargetMode(parameters = {}, power = {}) {
  const explicit = norm(parameters.target ?? parameters.targetMode ?? parameters.targetType ?? parameters.scope ?? "");
  if (explicit) return explicit;
  if (normalizeZone(parameters).active) return "targets";
  const trigger = norm(power?.activation?.trigger);
  if (trigger.includes("self") || trigger.includes("wearer") || trigger.includes("porteur")) return "self";
  if (trigger.includes("touch")) return "touch";
  return "selected_or_self";
}

export function resolveTargets(actor, power, effect, parameters = resolveExecutionParameters(power, effect)) {
  const mode = normalizedTargetMode(parameters, power);
  const selected = selectedTokens();
  const selectedActors = selected.map(token => token.actor).filter(Boolean);
  let actors = [];
  let tokens = [];
  let required = false;
  if (["self", "owner", "wearer", "porteur", "caster", "user"].includes(mode)) {
    actors = actor ? [actor] : [];
    tokens = actors.map(tokenForActor).filter(Boolean);
  } else if (["selected", "target", "creature", "single", "one", "cible"].includes(mode)) {
    required = true;
    actors = selectedActors.slice(0, 1);
    tokens = selected.slice(0, 1);
  } else if (["targets", "multiple", "creatures", "all_selected", "selected_targets", "zone", "area"].includes(mode)) {
    required = true;
    actors = selectedActors;
    tokens = selected;
  } else if (["touch", "toucher"].includes(mode)) {
    actors = selectedActors.length ? selectedActors.slice(0, 1) : actor ? [actor] : [];
    tokens = selected.length ? selected.slice(0, 1) : actors.map(tokenForActor).filter(Boolean);
  } else {
    actors = selectedActors.length ? selectedActors : actor ? [actor] : [];
    tokens = selected.length ? selected : actors.map(tokenForActor).filter(Boolean);
  }
  const unique = new Map();
  actors.forEach((target, position) => {
    if (!target) return;
    unique.set(String(target.uuid ?? target.id), { actor: target, token: tokens[position] ?? tokenForActor(target) });
  });
  const entries = [...unique.values()];
  return {
    mode,
    required,
    ok: entries.length > 0 || required === false,
    reason: entries.length || !required ? "" : "target-required",
    actors: entries.map(entry => entry.actor),
    tokens: entries.map(entry => entry.token).filter(Boolean),
    entries
  };
}

export function distanceValue(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "object") return number(value.value, value.amount, value.distance, value.range, value.radius);
  const match = String(value).match(/-?\d+(?:[.,]\d+)?/);
  return match ? Number(match[0].replace(",", ".")) : null;
}

function measureDistance(sourceToken, targetToken) {
  if (!sourceToken || !targetToken || sourceToken === targetToken) return 0;
  try {
    if (typeof globalThis.add2eMeasureTokenGridDistance === "function") {
      const measured = Number(globalThis.add2eMeasureTokenGridDistance(sourceToken, targetToken));
      if (Number.isFinite(measured)) return measured;
    }
  } catch (_error) {}
  const source = sourceToken.center ?? { x: sourceToken.x ?? sourceToken.document?.x ?? 0, y: sourceToken.y ?? sourceToken.document?.y ?? 0 };
  const target = targetToken.center ?? { x: targetToken.x ?? targetToken.document?.x ?? 0, y: targetToken.y ?? targetToken.document?.y ?? 0 };
  try {
    const measured = canvas?.grid?.measurePath?.([source, target])?.distance;
    if (Number.isFinite(Number(measured))) return Number(measured);
  } catch (_error) {}
  const pixels = Math.hypot(Number(target.x) - Number(source.x), Number(target.y) - Number(source.y));
  const gridSize = Number(canvas?.scene?.grid?.size ?? canvas?.grid?.size ?? 1) || 1;
  const gridDistance = Number(canvas?.scene?.grid?.distance ?? 1) || 1;
  return pixels / gridSize * gridDistance;
}

export function canonicalZoneShape(value) {
  const shape = norm(value);
  if (["radius", "circle", "circular", "sphere", "spherical", "rayon", "cercle", "spherique"].includes(shape)) return "radius";
  if (["cone", "conical", "cone_area"].includes(shape)) return "cone";
  if (["line", "ligne", "ray", "beam", "corridor"].includes(shape)) return "line";
  return shape;
}

export function normalizeZone(parameters = {}) {
  const raw = parameters.area ?? parameters.zone;
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const shape = canonicalZoneShape(parameters.shape ?? source.shape ?? source.type ?? (parameters.radius != null ? "radius" : ""));
  const radius = distanceValue(parameters.radius ?? source.radius ?? source.rayon);
  const length = distanceValue(source.length ?? source.longueur ?? parameters.length ?? parameters.longueur);
  const width = distanceValue(source.width ?? source.largeur ?? parameters.width ?? parameters.largeur);
  const angle = number(source.angle, parameters.angle);
  const direction = number(source.direction, source.orientation, source.rotation, parameters.direction, parameters.orientation, parameters.rotation);
  const active = hasValue(raw) || Number.isFinite(radius) || !!shape;
  return { active, shape: shape || (Number.isFinite(radius) ? "radius" : ""), radius, length, width, angle, direction, raw: clone(raw) };
}

export function resolveRangeAndZone(actor, power, effect, targetResolution, parameters = resolveExecutionParameters(power, effect)) {
  const sourceToken = actorToken(actor);
  const maximum = distanceValue(parameters.range);
  const zone = normalizeZone(parameters);
  const distances = (targetResolution?.entries ?? []).map(entry => ({
    ...entry,
    distance: sourceToken && entry.token ? measureDistance(sourceToken, entry.token) : null
  }));
  const outOfRange = Number.isFinite(maximum)
    ? distances.filter(entry => Number.isFinite(entry.distance) && entry.distance > maximum) : [];
  const inRange = distances.filter(entry => !outOfRange.includes(entry));
  return {
    ok: outOfRange.length === 0,
    reason: outOfRange.length ? "target-out-of-range" : "",
    sourceToken, maximum, zone, entries: distances, inRange, outOfRange,
    verifiable: !!sourceToken && distances.every(entry => !entry.token || Number.isFinite(entry.distance))
  };
}

function tokenCenter(token) {
  if (!token) return null;
  return token.center ?? {
    x: Number(token.x ?? token.document?.x ?? 0) + Number(token.w ?? 0) / 2,
    y: Number(token.y ?? token.document?.y ?? 0) + Number(token.h ?? 0) / 2
  };
}

function sceneUnitsToPixels(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  const gridSize = Number(canvas?.scene?.grid?.size ?? canvas?.grid?.size ?? 1) || 1;
  const gridDistance = Number(canvas?.scene?.grid?.distance ?? 1) || 1;
  return amount / gridDistance * gridSize;
}

const angleDifference = (left, right) => Math.abs(((Number(right) - Number(left) + 540) % 360) - 180);
const foundryBearing = (source, target) => (Math.atan2(Number(target.y) - Number(source.y), Number(target.x) - Number(source.x)) * 180 / Math.PI + 90 + 360) % 360;

function pointInZone(source, target, zone, sourceToken) {
  const shape = canonicalZoneShape(zone?.shape);
  const direction = Number.isFinite(Number(zone?.direction)) ? Number(zone.direction)
    : Number(sourceToken?.document?.rotation ?? sourceToken?.rotation ?? 0) || 0;
  const dx = Number(target.x) - Number(source.x);
  const dy = Number(target.y) - Number(source.y);
  const distance = Math.hypot(dx, dy);
  if (shape === "radius") {
    const radius = sceneUnitsToPixels(zone.radius);
    return Number.isFinite(radius) ? distance <= radius : null;
  }
  if (shape === "cone") {
    const length = sceneUnitsToPixels(zone.length ?? zone.radius);
    const angle = Number(zone.angle);
    if (!Number.isFinite(length) || !Number.isFinite(angle) || angle <= 0) return null;
    return distance <= length && angleDifference(direction, foundryBearing(source, target)) <= angle / 2;
  }
  if (shape === "line") {
    const length = sceneUnitsToPixels(zone.length ?? zone.radius);
    const width = sceneUnitsToPixels(zone.width);
    if (!Number.isFinite(length) || !Number.isFinite(width) || width <= 0) return null;
    const radians = (direction - 90) * Math.PI / 180;
    const ux = Math.cos(radians);
    const uy = Math.sin(radians);
    const projection = dx * ux + dy * uy;
    const perpendicular = Math.abs(dx * uy - dy * ux);
    return projection >= 0 && projection <= length && perpendicular <= width / 2;
  }
  return null;
}

export function resolveAffectedTargets(context) {
  const { targets, rangeZone } = context;
  if (!targets?.ok) return { ok: false, reason: targets?.reason || "target-required", actors: [], tokens: [], entries: [] };
  if (!rangeZone?.ok) return { ok: false, reason: rangeZone?.reason || "target-out-of-range", actors: [], tokens: [], entries: [] };
  const entries = [...(rangeZone?.inRange ?? targets.entries ?? [])];
  const zone = rangeZone?.zone;
  if (!zone?.active) {
    return { ok: entries.length > 0 || targets.required === false, reason: entries.length || !targets.required ? "" : "target-required", entries,
      actors: entries.map(entry => entry.actor).filter(Boolean), tokens: entries.map(entry => entry.token).filter(Boolean), zoneApplied: false };
  }
  const source = tokenCenter(rangeZone.sourceToken);
  if (!source) return { ok: false, reason: "zone-source-token-required", actors: [], tokens: [], entries: [] };
  const checked = [];
  for (const entry of entries) {
    const point = tokenCenter(entry.token);
    if (!point) return { ok: false, reason: "zone-target-token-required", actors: [], tokens: [], entries: [] };
    const inside = pointInZone(source, point, zone, rangeZone.sourceToken);
    if (inside == null) return { ok: false, reason: "zone-definition-incomplete", actors: [], tokens: [], entries: [] };
    if (inside) checked.push(entry);
  }
  return {
    ok: checked.length > 0,
    reason: checked.length ? "" : "no-target-in-zone",
    entries: checked,
    actors: checked.map(entry => entry.actor).filter(Boolean),
    tokens: checked.map(entry => entry.token).filter(Boolean),
    zoneApplied: true,
    zone
  };
}

export function normalizeSaveRule(raw) {
  if (raw == null || raw === "" || raw === false) return null;
  if (raw === true) return { type: "sorts", bonus: 0, onSuccess: "unspecified", onFailure: "full", raw };
  if (typeof raw === "string") return { type: norm(raw) || "sorts", bonus: 0, onSuccess: "unspecified", onFailure: "full", raw };
  if (typeof raw !== "object" || Array.isArray(raw)) return null;
  const type = norm(raw.type ?? raw.saveType ?? raw.category ?? raw.jet ?? raw.value ?? "sorts") || "sorts";
  const bonus = number(raw.bonus, raw.modifier, raw.saveModifier, raw.adjustment) ?? 0;
  const successRaw = norm(raw.onSuccess ?? raw.success ?? raw.successEffect ?? raw.resultOnSuccess ?? raw.reussite ?? "");
  const failureRaw = norm(raw.onFailure ?? raw.failure ?? raw.failureEffect ?? raw.resultOnFailure ?? raw.echec ?? "");
  const onSuccess = raw.halfOnSuccess === true || raw.halfDamage === true || ["half", "moitie", "half_damage"].includes(successRaw)
    ? "half" : ["none", "negate", "annule", "no_effect", "zero"].includes(successRaw) ? "negate" : successRaw || "unspecified";
  return { type, bonus, onSuccess, onFailure: failureRaw || "full", raw: clone(raw) };
}

export async function resolveSaves(targetResolution, parameters = {}) {
  const rule = normalizeSaveRule(parameters.save);
  if (!rule) return { required: false, rule: null, results: [], complete: true };
  const engine = globalThis.Add2eEffectsEngine;
  const results = [];
  for (const target of targetResolution?.actors ?? []) {
    if (typeof engine?.rollActionSave !== "function") {
      results.push({ actor: target, canRoll: false, success: false, reason: "effects-engine-unavailable" });
      continue;
    }
    const save = await engine.rollActionSave(target, rule.type, Number(rule.bonus) || 0);
    results.push({ actor: target, ...save });
  }
  return { required: true, rule, results, complete: results.length > 0 && results.every(result => result.canRoll !== false) };
}

export function powerContext(actor, item, power, index, effect, sheet = null) {
  const parameters = resolveExecutionParameters(power, effect);
  const targets = resolveTargets(actor, power, effect, parameters);
  const rangeZone = resolveRangeAndZone(actor, power, effect, targets, parameters);
  return { actor, item, power, index, effect, sheet, parameters, targets, rangeZone };
}
