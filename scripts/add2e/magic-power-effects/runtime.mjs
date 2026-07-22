// ADD2E — Pouvoirs d'objets magiques / socle partagé.
// Compatible Foundry V13/V14/V15.

export const VERSION = "2026-07-22-magic-power-effects-modular-v1";
export const SPELL_PACK_ID = "add2e.sorts";
export const EFFECT_FLAG = "magicItemCatalogueEffect";
export const TIME_SETTING = "add2e.worldTimeTick";
export const INTERNAL_ON_USE = "add2e://magic-catalogue";
export const INTERNAL_EFFECT_OPTION = "add2eMagicPowerEffectsAdapter";
export const INTERNAL_NORMALIZE_OPTION = "add2eMagicPowerNormalize";

const UNSET = Symbol("add2e-magic-power-unset");
export const EFFECT_HANDLERS = new Map();
let spellIndexPromise = null;

export function clone(value) {
  if (value == null) return value;
  try { return foundry.utils.deepClone(value); }
  catch (_error) {
    try { return structuredClone(value); }
    catch (_cloneError) { return JSON.parse(JSON.stringify(value)); }
  }
}

export function merge(base, update) {
  try {
    return foundry.utils.mergeObject(clone(base ?? {}), clone(update ?? {}), {
      inplace: false,
      insertKeys: true,
      overwrite: true,
      recursive: true
    });
  } catch (_error) {
    return { ...(base ?? {}), ...(update ?? {}) };
  }
}

export function norm(value) {
  return String(value ?? "").trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "").replace(/[^a-z0-9:+*_.-]+/g, "_")
    .replace(/_+/g, "_").replace(/^_+|_+$/g, "");
}

export function esc(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

export function list(value) {
  if (value == null || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(list);
  if (value instanceof Set) return [...value].flatMap(list);
  if (typeof value === "string") return value.split(/[,;\n|]+/g).map(entry => entry.trim()).filter(Boolean);
  if (typeof value === "object") {
    for (const key of ["values", "items", "list", "lists", "tags", "effectTags", "types", "categories"]) {
      if (value[key] != null) return list(value[key]);
    }
  }
  return [value];
}

export function number(...values) {
  for (const value of values) {
    if (value == null || value === "") continue;
    if (typeof value === "object" && !Array.isArray(value)) {
      const nested = number(value.value, value.amount, value.total, value.current, value.actuel, value.max);
      if (Number.isFinite(nested)) return nested;
      continue;
    }
    const result = Number(String(value).replace(",", "."));
    if (Number.isFinite(result)) return result;
  }
  return null;
}

export const signed = value => `${Number(value) >= 0 ? "+" : ""}${Number(value) || 0}`;
export const hasValue = value => value != null && value !== "" && (!Array.isArray(value) || value.length > 0)
  && (typeof value !== "object" || Array.isArray(value) || Object.keys(value).length > 0);

export function equal(left, right) {
  try { return JSON.stringify(left) === JSON.stringify(right); }
  catch (_error) { return false; }
}

export function uniqueBy(values, keyOf = value => JSON.stringify(value)) {
  const seen = new Set();
  return values.filter(value => {
    const key = keyOf(value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function resolveTemplate(value, parameters = {}) {
  if (Array.isArray(value)) return value.map(entry => resolveTemplate(entry, parameters)).filter(entry => entry !== UNSET);
  if (value && typeof value === "object") {
    const output = {};
    for (const [key, entry] of Object.entries(value)) {
      const resolved = resolveTemplate(entry, parameters);
      if (resolved !== UNSET) output[key] = resolved;
    }
    return output;
  }
  if (typeof value !== "string") return clone(value);
  const exact = value.match(/^@([A-Za-z0-9_]+)$/);
  if (exact) return Object.prototype.hasOwnProperty.call(parameters, exact[1]) ? clone(parameters[exact[1]]) : UNSET;
  let missing = false;
  const replaced = value.replace(/@([A-Za-z0-9_]+)/g, (_match, key) => {
    if (!Object.prototype.hasOwnProperty.call(parameters, key)) { missing = true; return ""; }
    return typeof parameters[key] === "object" ? JSON.stringify(parameters[key]) : String(parameters[key]);
  });
  return missing ? UNSET : replaced;
}

export function cleanPower(power) {
  if (!power || typeof power !== "object" || power.kind !== "catalogue") return clone(power);
  const clean = clone(power);
  const parameters = clean.parameters && typeof clean.parameters === "object" && !Array.isArray(clean.parameters)
    ? clean.parameters : {};
  const templates = Array.isArray(clean.effectTemplates) && clean.effectTemplates.length
    ? clean.effectTemplates : Array.isArray(clean.effects) ? clean.effects : [];
  clean.effects = resolveTemplate(templates, parameters);
  return clean;
}

export function cleanPowers(value) {
  if (Array.isArray(value)) return value.map(cleanPower);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, power]) => [key, cleanPower(power)]));
  }
  return value;
}

export function powerArray(item) {
  const raw = item?.system?.pouvoirs ?? item?.system?.powers ?? item?.system?.pouvoirsMagiques
    ?? item?.system?.magicalPowers ?? [];
  return (Array.isArray(raw) ? raw : raw && typeof raw === "object" ? Object.values(raw) : [])
    .filter(power => power && typeof power === "object");
}

export const cataloguePowers = item => powerArray(item).filter(power => power.kind === "catalogue");

export function itemUsable(item) {
  try {
    if (typeof globalThis.add2eMagicItemEquippedOrUsable === "function") {
      return globalThis.add2eMagicItemEquippedOrUsable(item);
    }
  } catch (_error) {}
  const system = item?.system ?? {};
  return system.equipee === true || system.equipped === true || system.portee === true || system.worn === true;
}

export function passivePower(power) {
  if (norm(power?.automation) !== "automatic") return false;
  const type = norm(power?.activation?.type);
  const trigger = norm(power?.activation?.trigger);
  if (["passive", "automatic", "always_on", "permanent"].includes(type)) return true;
  const activation = `${type} ${trigger}`;
  return ["equipped", "equip", "worn", "carried", "porte", "portee", "time", "attack", "damage", "hit", "round", "projectile", "target", "drawn"]
    .some(token => activation.includes(token));
}

export function durationParts(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number") return { value, unit: "round" };
  if (typeof value === "object") {
    const amount = number(value.value, value.amount, value.nombre, value.rounds, value.duration);
    return Number.isFinite(amount) && amount > 0
      ? { value: amount, unit: value.unit ?? value.units ?? value.unite ?? value.type ?? "round" }
      : null;
  }
  const match = String(value).trim().match(/^([0-9]+(?:[.,][0-9]+)?)\s*(.*)$/);
  if (!match) return null;
  const amount = Number(match[1].replace(",", "."));
  return Number.isFinite(amount) && amount > 0 ? { value: amount, unit: match[2].trim() || "round" } : null;
}

export function toRounds(value) {
  const parts = durationParts(value);
  if (!parts) return 0;
  if (typeof game?.add2e?.time?.toRounds === "function") {
    const result = Number(game.add2e.time.toRounds(parts.value, parts.unit));
    if (Number.isFinite(result) && result > 0) return Math.max(1, Math.floor(result));
  }
  const unit = norm(parts.unit);
  if (["turn", "turns", "tour", "tours"].includes(unit)) return Math.max(1, Math.floor(parts.value * 10));
  if (["hour", "hours", "heure", "heures"].includes(unit)) return Math.max(1, Math.floor(parts.value * 60));
  if (["segment", "segments"].includes(unit)) return Math.max(1, Math.ceil(parts.value / 10));
  return Math.max(1, Math.floor(parts.value));
}

export function currentTick() {
  const apiValue = game?.add2e?.time?.currentTick?.();
  if (Number.isFinite(Number(apiValue))) return Math.max(0, Math.floor(Number(apiValue)));
  try { return Math.max(0, Math.floor(Number(game.settings.get("add2e", "worldTimeTick")) || 0)); }
  catch (_error) { return 0; }
}

export function parameterValue(power, effect, keys, fallback = undefined) {
  const wanted = Array.isArray(keys) ? keys : [keys];
  for (const source of [effect, power?.parameters, power, power?.activation]) {
    if (!source || typeof source !== "object") continue;
    for (const key of wanted) {
      if (Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined) return clone(source[key]);
    }
  }
  return clone(fallback);
}

export function resolveExecutionParameters(power, effect = {}) {
  const merged = merge(power?.parameters ?? {}, effect ?? {});
  const formulaValue = parameterValue(power, effect, ["formula", "dice", "roll", "damageFormula", "amount", "points", "value"]);
  const chargeCost = number(parameterValue(power, effect, ["chargeCost", "cost", "cout"]));
  return {
    ...merged,
    target: parameterValue(power, effect, ["target", "targetMode", "targetType", "scope", "cible"]),
    range: parameterValue(power, effect, ["range", "portee", "distance", "maxDistance"]),
    area: parameterValue(power, effect, ["area", "zone"]),
    radius: parameterValue(power, effect, ["radius", "rayon"]),
    shape: parameterValue(power, effect, ["shape", "areaShape", "zoneShape", "forme"]),
    duration: parameterValue(power, effect, ["duration", "duree"]),
    save: parameterValue(power, effect, ["save", "savingThrow", "saving_throw", "jetSauvegarde", "jet_protection"]),
    chargeCost: Number.isFinite(chargeCost) ? Math.max(0, Math.floor(chargeCost)) : null,
    frequency: parameterValue(power, effect, ["frequency", "frequence", "usesPerPeriod", "frequencyPerTarget"]),
    formula: formulaValue == null || formulaValue === "" ? null : String(formulaValue)
  };
}

export function executionResult(status, data = {}) {
  const normalized = norm(status || data.status || "failed");
  const ok = data.ok ?? normalized === "success";
  return {
    complete: data.complete !== false,
    chargesManaged: data.chargesManaged === true,
    consumeCharges: data.consumeCharges !== false,
    targets: Array.isArray(data.targets) ? data.targets : [],
    rows: Array.isArray(data.rows) ? data.rows : [],
    details: Array.isArray(data.details) ? data.details : [],
    unresolvedTypes: Array.isArray(data.unresolvedTypes) ? data.unresolvedTypes : [],
    reason: data.reason ?? "",
    error: data.error ?? null,
    ...data,
    ok: ok === true,
    status: normalized || (ok ? "success" : "failed")
  };
}

export function normalizeExecutionResult(value, defaults = {}) {
  if (value == null) return executionResult("skipped", { ...defaults, ok: false, complete: false });
  if (value === true) return executionResult("success", { ...defaults, ok: true });
  if (value === false) return executionResult("failed", { ...defaults, ok: false });
  if (typeof value !== "object") return executionResult("failed", { ...defaults, ok: false, reason: "invalid-handler-result" });
  const status = value.status ?? (value.ok === true ? "success" : value.handled?.includes?.("cancel") ? "cancelled" : "failed");
  return executionResult(status, { ...defaults, ...value });
}

export function registerEffectHandler(types, handler) {
  if (typeof handler !== "function") throw new TypeError("Le gestionnaire d'effet doit être une fonction.");
  for (const raw of Array.isArray(types) ? types : [types]) {
    const type = norm(raw);
    if (type) EFFECT_HANDLERS.set(type, handler);
  }
  return handler;
}

export const effectHandler = type => EFFECT_HANDLERS.get(norm(type)) ?? null;
export const powerName = (power, item) => String(power?.name ?? power?.nom ?? power?.label ?? power?.catalogueId ?? item?.name ?? "Pouvoir magique").trim();
export const effectTypes = power => [...new Set((power?.effects ?? []).map(effect => norm(effect?.type ?? effect?.kind ?? effect?.category)).filter(Boolean))];

export function hp(actor) {
  const system = actor?.system ?? {};
  const candidates = [
    ["system.pdv", system.pdv, system.points_de_coup],
    ["system.pv.value", system.pv?.value, system.pv?.max],
    ["system.hp.value", system.hp?.value, system.hp?.max],
    ["system.hp", typeof system.hp === "number" ? system.hp : null, system.hp_max ?? system.max_hp],
    ["system.points_de_vie.value", system.points_de_vie?.value, system.points_de_vie?.max],
    ["system.attributes.hp.value", system.attributes?.hp?.value, system.attributes?.hp?.max]
  ];
  for (const [path, valueRaw, maxRaw] of candidates) {
    const value = number(valueRaw);
    const max = number(maxRaw);
    if (Number.isFinite(value) && Number.isFinite(max) && max > 0) return { path, value, max };
  }
  return null;
}

export function primaryGM() {
  if (!game.user?.isGM) return false;
  const active = game.users?.activeGM ?? Array.from(game.users ?? []).find(user => user.active && user.isGM);
  return !active || String(active.id) === String(game.user.id);
}

export function getSpellIndexPromise() { return spellIndexPromise; }
export function setSpellIndexPromise(value) { spellIndexPromise = value; return value; }
