// scripts/add2e/magic-power-effects-adapter.mjs
// ADD2E — Adaptateur et exécuteur universel des pouvoirs d'objets magiques.
// Étape 5, lot 4 — Foundry V13/V14/V15, ApplicationV2 / DialogV2.

const ADD2E_MAGIC_POWER_EFFECTS_ADAPTER_VERSION = "2026-07-21-magic-power-effects-adapter-v4-linked-spells-no-technical-fallback";
const SPELL_PACK_ID = "add2e.sorts";
const EFFECT_FLAG = "magicItemCatalogueEffect";
const TIME_SETTING = "add2e.worldTimeTick";
const INTERNAL_ON_USE = "add2e://magic-catalogue";
const UNSET = Symbol("add2e-magic-power-unset");
let periodicQueue = Promise.resolve();
let spellIndexPromise = null;

function clone(value) {
  if (value == null) return value;
  try { return foundry.utils.deepClone(value); }
  catch (_error) {
    try { return structuredClone(value); }
    catch (_cloneError) { return JSON.parse(JSON.stringify(value)); }
  }
}

function merge(base, update) {
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

function norm(value) {
  return String(value ?? "").trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "").replace(/[^a-z0-9:+*_.-]+/g, "_")
    .replace(/_+/g, "_").replace(/^_+|_+$/g, "");
}

function esc(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function list(value) {
  if (value == null || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(list);
  if (value instanceof Set) return [...value].flatMap(list);
  if (typeof value === "string") return value.split(/[,;\n|]+/g).map(v => v.trim()).filter(Boolean);
  if (typeof value === "object") {
    for (const key of ["values", "items", "list", "lists", "tags", "effectTags", "types", "categories"]) {
      if (value[key] != null) return list(value[key]);
    }
  }
  return [value];
}

function number(...values) {
  for (const value of values) {
    if (value == null || value === "") continue;
    const result = Number(String(value).replace(",", "."));
    if (Number.isFinite(result)) return result;
  }
  return null;
}

const signed = value => `${Number(value) >= 0 ? "+" : ""}${Number(value) || 0}`;
const hasValue = value => value != null && value !== "" && (!Array.isArray(value) || value.length > 0) && (typeof value !== "object" || Array.isArray(value) || Object.keys(value).length > 0);

function resolveTemplate(value, parameters = {}) {
  if (Array.isArray(value)) return value.map(v => resolveTemplate(v, parameters)).filter(v => v !== UNSET);
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
  if (exact) return Object.hasOwn(parameters, exact[1]) ? clone(parameters[exact[1]]) : UNSET;
  let missing = false;
  const replaced = value.replace(/@([A-Za-z0-9_]+)/g, (_match, key) => {
    if (!Object.hasOwn(parameters, key)) { missing = true; return ""; }
    return typeof parameters[key] === "object" ? JSON.stringify(parameters[key]) : String(parameters[key]);
  });
  return missing ? UNSET : replaced;
}

function cleanPower(power) {
  if (!power || typeof power !== "object" || power.kind !== "catalogue") return clone(power);
  const clean = clone(power);
  const parameters = clean.parameters && typeof clean.parameters === "object" && !Array.isArray(clean.parameters) ? clean.parameters : {};
  const templates = Array.isArray(clean.effectTemplates) && clean.effectTemplates.length
    ? clean.effectTemplates
    : Array.isArray(clean.effects) ? clean.effects : [];
  clean.effects = resolveTemplate(templates, parameters);
  return clean;
}

function cleanPowers(value) {
  if (Array.isArray(value)) return value.map(cleanPower);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, power]) => [key, cleanPower(power)]));
  return value;
}

function powerArray(item) {
  const raw = item?.system?.pouvoirs ?? item?.system?.powers ?? item?.system?.pouvoirsMagiques ?? item?.system?.magicalPowers ?? [];
  return (Array.isArray(raw) ? raw : raw && typeof raw === "object" ? Object.values(raw) : []).filter(power => power && typeof power === "object");
}

const cataloguePowers = item => powerArray(item).filter(power => power.kind === "catalogue");

function itemUsable(item) {
  try {
    if (typeof globalThis.add2eMagicItemEquippedOrUsable === "function") return globalThis.add2eMagicItemEquippedOrUsable(item);
  } catch (_error) {}
  const system = item?.system ?? {};
  return system.equipee === true || system.equipped === true || system.portee === true || system.worn === true;
}

function passivePower(power) {
  if (norm(power?.automation) !== "automatic") return false;
  const type = norm(power?.activation?.type);
  const trigger = norm(power?.activation?.trigger);
  if (["passive", "automatic", "always_on", "permanent"].includes(type)) return true;
  return ["equipped", "equip", "worn", "carried", "porte", "portee", "time", "attack", "damage", "hit", "round", "projectile", "target", "drawn"].some(token => trigger.includes(token));
}

function durationParts(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number") return { value, unit: "round" };
  if (typeof value === "object") {
    const amount = number(value.value, value.amount, value.nombre, value.rounds, value.duration);
    return Number.isFinite(amount) && amount > 0 ? { value: amount, unit: value.unit ?? value.units ?? value.unite ?? value.type ?? "round" } : null;
  }
  const match = String(value).trim().match(/^([0-9]+(?:[.,][0-9]+)?)\s*(.*)$/);
  if (!match) return null;
  const amount = Number(match[1].replace(",", "."));
  return Number.isFinite(amount) && amount > 0 ? { value: amount, unit: match[2].trim() || "round" } : null;
}

function toRounds(value) {
  const parts = durationParts(value);
  if (!parts) return 0;
  if (typeof game?.add2e?.time?.toRounds === "function") {
    const result = Number(game.add2e.time.toRounds(parts.value, parts.unit));
    return Number.isFinite(result) && result > 0 ? Math.max(1, Math.floor(result)) : 0;
  }
  const unit = norm(parts.unit);
  if (["turn", "turns", "tour", "tours"].includes(unit)) return Math.max(1, Math.floor(parts.value * 10));
  if (["hour", "hours", "heure", "heures"].includes(unit)) return Math.max(1, Math.floor(parts.value * 60));
  if (["segment", "segments"].includes(unit)) return Math.max(1, Math.ceil(parts.value / 10));
  return Math.max(1, Math.floor(parts.value));
}

function currentTick() {
  const apiValue = game?.add2e?.time?.currentTick?.();
  if (Number.isFinite(Number(apiValue))) return Math.max(0, Math.floor(Number(apiValue)));
  try { return Math.max(0, Math.floor(Number(game.settings.get("add2e", "worldTimeTick")) || 0)); }
  catch (_error) { return 0; }
}

function compileDefinition(effect = {}) {
  const type = norm(effect.type ?? effect.kind ?? effect.category);
  const tags = new Set(list(effect.tags ?? effect.effectTags).map(String).filter(Boolean));
  const rules = [];
  const periodic = [];
  const types = keys => keys.flatMap(key => hasValue(effect[key]) ? list(effect[key]) : []);
  const push = (prefix, values, suffix = null) => list(values).map(norm).filter(Boolean).forEach(value => tags.add(suffix == null ? `${prefix}:${value}` : `${prefix}:${value}:${suffix}`));

  if (["damage_immunity", "attack_immunity", "condition_immunity", "immunity", "immunite"].includes(type) || type.endsWith("_immunity") || type.endsWith("_immunite")) {
    const inferred = type.replace(/_(?:immunity|immunite)$/, "");
    const values = types(["attackAny", "damageAny", "damageTypes", "immunities", "types", "elements", "conditions", "targetAny"]);
    push("immunite", values.length ? values : [inferred]);
  }
  if (["damage_resistance", "magic_resistance", "resistance", "resistance_damage"].includes(type)) {
    const targets = types(["attackAny", "damageAny", "damageTypes", "resistances", "types", "elements", "targetAny", "against", "kind"]);
    const value = effect.percentage ?? effect.percent ?? effect.pct ?? effect.value ?? effect.amount ?? effect.reduction;
    push("resistance", targets.length ? targets : type === "magic_resistance" ? ["magie"] : [], hasValue(value) ? String(value) : null);
  }
  if (["saving_throw_bonus", "save_bonus", "saving_bonus", "bonus_save", "saving_throw_modifier"].includes(type)) {
    const value = number(effect.bonus, effect.value, effect.amount, effect.modifier);
    const targets = types(["saveAny", "categories", "category", "against", "types", "targetAny"]);
    if (Number.isFinite(value) && value !== 0) targets.length ? push("bonus_save_vs", targets, signed(value)) : tags.add(`bonus_save:${signed(value)}`);
  }
  if (["attack_bonus", "hit_bonus", "damage_bonus", "combat_bonus", "attack_damage_bonus", "weapon_magic_bonus"].includes(type)) {
    const attack = number(effect.attackBonus, effect.hitBonus, effect.bonusToucher, effect.toucher, type !== "damage_bonus" ? effect.bonus ?? effect.value : null);
    const damage = number(effect.damageBonus, effect.bonusDegats, effect.degats, type === "damage_bonus" ? effect.bonus ?? effect.value : null);
    if (attack) tags.add(`bonus_attaque:${signed(attack)}`);
    if (damage) tags.add(`bonus_degats:${signed(damage)}`);
  }
  if (["armor_class_bonus", "armor_bonus", "ac_bonus", "defense_bonus", "protection_bonus"].includes(type)) {
    const value = number(effect.bonus, effect.value, effect.amount, effect.armorClassBonus, effect.acBonus);
    if (value) tags.add(`bonus_ca:${signed(value)}`);
  }
  if (["conditional_attack_bonus", "conditional_damage_bonus"].includes(type)) {
    const value = number(effect.value, effect.bonus, effect.amount);
    const prefix = type === "conditional_attack_bonus" ? "bonus_attaque_conditionnel" : "bonus_degats_conditionnel";
    if (Number.isFinite(value)) push(prefix, effect.targetAny ?? effect.targets ?? effect.against, signed(value));
  }
  if (["ability_bonus", "characteristic_bonus", "stat_bonus", "attribute_bonus"].includes(type)) {
    const value = number(effect.value, effect.bonus, effect.amount, effect.modifier);
    if (Number.isFinite(value)) push("bonus_carac", effect.ability ?? effect.stat ?? effect.attribute ?? effect.characteristic ?? effect.targetAny, signed(value));
  }
  if (type === "regeneration") {
    const points = Math.max(0, Math.floor(number(effect.points, effect.value, effect.amount) ?? 0));
    const intervalRounds = toRounds(effect.interval);
    if (points && intervalRounds) {
      tags.add("regeneration");
      tags.add(`regeneration:${points}:${intervalRounds}`);
      periodic.push({
        type,
        points,
        interval: effect.interval,
        intervalRounds,
        restoresLostParts: effect.restoresLostParts === true,
        deathWindow: effect.deathWindow ?? null,
        deathWindowRounds: toRounds(effect.deathWindow),
        exceptions: list(effect.exceptions).map(norm).filter(Boolean)
      });
    }
  }
  if (type === "progressive_weapon_bonus") {
    const cycle = list(effect.cycle).map(Number).filter(Number.isFinite);
    if (cycle.length) periodic.push({ type, cycle });
  }
  if (Array.isArray(effect.rules)) rules.push(...clone(effect.rules));
  else if (effect.rule && typeof effect.rule === "object") rules.push(clone(effect.rule));
  if (type && type !== "charges") rules.push({ source: "magic-item-catalogue", type, ...clone(effect) });
  return { type, tags: [...tags], rules, periodic };
}

function compilePower(power) {
  if (!passivePower(power)) return null;
  const tags = new Set();
  const rules = [];
  const periodic = [];
  const handledTypes = [];
  for (const effect of Array.isArray(power.effects) ? power.effects : []) {
    const compiled = compileDefinition(effect);
    if (compiled.type) handledTypes.push(compiled.type);
    compiled.tags.forEach(tag => tags.add(tag));
    rules.push(...compiled.rules);
    periodic.push(...compiled.periodic);
  }
  return tags.size || rules.length || periodic.length
    ? { tags: [...tags], rules, periodic, handledTypes: [...new Set(handledTypes)] }
    : null;
}

const powerKey = (item, power, index) => `${item.id}:${index}:${String(power.catalogueId ?? power.id ?? "power")}`;
function signature(value) {
  const text = JSON.stringify(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function effectData(item, power, index, compiled) {
  const key = powerKey(item, power, index);
  const name = `${item.name} — ${power.name ?? power.label ?? power.catalogueId ?? "Pouvoir"}`;
  const flags = {
    [EFFECT_FLAG]: true,
    adapterVersion: ADD2E_MAGIC_POWER_EFFECTS_ADAPTER_VERSION,
    sourceItemId: item.id,
    sourceItemUuid: item.uuid ?? null,
    sourceItemName: item.name,
    magicPowerId: String(power.catalogueId ?? power.id ?? ""),
    magicPowerIndex: index,
    magicPowerKey: key,
    tags: compiled.tags,
    effectTags: compiled.tags,
    rules: compiled.rules,
    handledTypes: compiled.handledTypes,
    periodic: compiled.periodic,
    periodicState: { lastTick: currentTick(), lastAppliedTick: null, pulses: 0, healed: 0, cycleIndex: 0 },
    activation: clone(power.activation ?? {}),
    catalogue: clone(power.catalogue ?? {})
  };
  const base = typeof game?.add2e?.time?.effectData === "function"
    ? game.add2e.time.effectData({
        name,
        img: power.img || item.img || "icons/svg/aura.svg",
        origin: item.uuid ?? null,
        rounds: 0,
        unit: "round",
        description: `Pouvoir automatique de ${item.name}.`,
        tags: compiled.tags,
        changes: [],
        source: "magic-item",
        sourceItem: item,
        extraFlags: flags
      })
    : {
        name,
        img: power.img || item.img || "icons/svg/aura.svg",
        origin: item.uuid ?? null,
        disabled: false,
        transfer: false,
        duration: {},
        changes: [],
        flags: { add2e: flags }
      };
  base.flags ??= {};
  base.flags.add2e = { ...(base.flags.add2e ?? {}), ...flags };
  base.flags.add2e.signature = signature({
    name: base.name,
    img: base.img,
    tags: compiled.tags,
    rules: compiled.rules,
    periodic: compiled.periodic,
    handledTypes: compiled.handledTypes
  });
  return base;
}

const actorForItem = item => (item?.parent ?? item?.actor)?.documentName === "Actor" ? (item.parent ?? item.actor) : null;
const existingForItem = (actor, itemId) => Array.from(actor?.effects ?? []).filter(effect => effect.flags?.add2e?.[EFFECT_FLAG] === true && String(effect.flags.add2e.sourceItemId ?? "") === String(itemId ?? ""));

async function removeItemEffects(item, actorOverride = null) {
  const actor = actorOverride ?? actorForItem(item);
  if (!actor) return { deleted: 0 };
  const ids = existingForItem(actor, item?.id).map(effect => effect.id).filter(Boolean);
  if (ids.length) await actor.deleteEmbeddedDocuments("ActiveEffect", ids, { add2eMagicPowerEffectsAdapter: true });
  return { deleted: ids.length };
}

async function syncItem(item) {
  const actor = actorForItem(item);
  if (!actor || !item?.id) return { ok: false, reason: "item-not-embedded" };
  const existing = existingForItem(actor, item.id);
  const desired = new Map();
  if (itemUsable(item)) {
    cataloguePowers(item).forEach((power, index) => {
      const compiled = compilePower(power);
      if (!compiled) return;
      const data = effectData(item, power, index, compiled);
      desired.set(data.flags.add2e.magicPowerKey, data);
    });
  }
  const deletes = [];
  const updates = [];
  const existingKeys = new Set();
  for (const effect of existing) {
    const key = String(effect.flags?.add2e?.magicPowerKey ?? "");
    const data = desired.get(key);
    if (!data) { deletes.push(effect.id); continue; }
    existingKeys.add(key);
    if (String(effect.flags?.add2e?.signature ?? "") !== String(data.flags.add2e.signature)) {
      data.flags.add2e.periodicState = clone(effect.flags?.add2e?.periodicState ?? data.flags.add2e.periodicState);
      updates.push({ _id: effect.id, ...data });
    }
  }
  const creates = [...desired.entries()].filter(([key]) => !existingKeys.has(key)).map(([, data]) => data);
  if (deletes.length) await actor.deleteEmbeddedDocuments("ActiveEffect", deletes, { add2eMagicPowerEffectsAdapter: true });
  if (updates.length) await actor.updateEmbeddedDocuments("ActiveEffect", updates, { add2eMagicPowerEffectsAdapter: true });
  if (creates.length) await actor.createEmbeddedDocuments("ActiveEffect", creates, { add2eMagicPowerEffectsAdapter: true });
  return { ok: true, deleted: deletes.length, updated: updates.length, created: creates.length, desired: desired.size };
}

async function syncActor(actor) {
  const items = Array.from(actor?.items ?? []).filter(item => cataloguePowers(item).length);
  const totals = { items: items.length, created: 0, updated: 0, deleted: 0 };
  for (const item of items) {
    const result = await syncItem(item);
    for (const key of ["created", "updated", "deleted"]) totals[key] += Number(result[key]) || 0;
  }
  return totals;
}

function hp(actor) {
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

const periodicEntries = effect => Array.isArray(effect?.flags?.add2e?.periodic) ? effect.flags.add2e.periodic.filter(Boolean) : [];
const periodicEffects = actor => Array.from(actor?.effects ?? []).filter(effect => !effect.disabled && effect.flags?.add2e?.[EFFECT_FLAG] === true && periodicEntries(effect).length);

function allActors() {
  const map = new Map();
  const add = actor => actor && map.set(String(actor.uuid ?? actor.id), actor);
  for (const actor of game.actors ?? []) add(actor);
  for (const token of canvas?.tokens?.placeables ?? []) add(token.actor);
  for (const combat of game.combats ?? []) for (const combatant of combat.combatants ?? []) add(combatant.actor ?? combatant.token?.actor);
  return [...map.values()];
}

function primaryGM() {
  if (!game.user?.isGM) return false;
  const active = game.users?.activeGM ?? Array.from(game.users ?? []).find(user => user.active && user.isGM);
  return !active || String(active.id) === String(game.user.id);
}

async function regenCard(actor, item, effect, before, after, healed, pulses, intervalRounds) {
  if (typeof globalThis.add2eCreateChatCard !== "function") return;
  await globalThis.add2eCreateChatCard({
    actor,
    title: "Régénération",
    icon: "fas fa-heart-pulse",
    variant: "healing",
    source: {
      name: item?.name ?? effect.flags?.add2e?.sourceItemName ?? "Objet magique",
      img: item?.img ?? effect.img,
      type: "Objet magique",
      meta: effect.name
    },
    target: { name: actor.name, img: actor.img },
    rows: [
      { label: "Points récupérés", value: healed },
      { label: "Pulsations", value: pulses },
      { label: "Intervalle", value: `${intervalRounds} round(s) moteur` },
      { label: "Points de vie", value: `${before} → ${after}` }
    ],
    chatData: {
      flags: {
        add2e: {
          magicItemRegeneration: true,
          sourceItemId: item?.id,
          sourceEffectId: effect.id,
          actorId: actor.id,
          healed,
          pulses,
          before,
          after,
          intervalRounds,
          version: ADD2E_MAGIC_POWER_EFFECTS_ADAPTER_VERSION
        }
      }
    }
  });
}

async function applyRegeneration(actor, effect, tick) {
  const item = actor.items?.get?.(String(effect.flags?.add2e?.sourceItemId ?? ""));
  if (!item || !itemUsable(item)) return { applied: false, reason: "source-item-not-equipped" };
  const entries = periodicEntries(effect).filter(entry => norm(entry.type) === "regeneration");
  const descriptor = hp(actor);
  if (!entries.length || !descriptor) return { applied: false, reason: !entries.length ? "no-regeneration-entry" : "hp-schema-not-supported" };
  const state = clone(effect.flags?.add2e?.periodicState ?? {});
  const last = Number(state.lastTick);
  if (!Number.isFinite(last) || tick < last) {
    await effect.update({ "flags.add2e.periodicState.lastTick": tick }, { add2eMagicPowerEffectsAdapter: true });
    return { applied: false, reason: "clock-initialized" };
  }
  let pulses = 0;
  let requested = 0;
  let consumed = 0;
  for (const entry of entries) {
    const interval = Math.max(1, Math.floor(Number(entry.intervalRounds) || 0));
    const points = Math.max(0, Math.floor(Number(entry.points) || 0));
    const count = interval && points ? Math.floor((tick - last) / interval) : 0;
    if (count > 0) {
      pulses += count;
      requested += count * points;
      consumed = Math.max(consumed, count * interval);
    }
  }
  if (!pulses) return { applied: false, reason: "interval-not-reached" };
  const before = descriptor.value;
  const after = before > 0 ? Math.min(descriptor.max, before + requested) : before;
  const healed = Math.max(0, after - before);
  if (healed) {
    await actor.update({ [descriptor.path]: after }, {
      add2eMagicPowerRegeneration: true,
      add2eMagicPowerRegenerationEffectId: effect.id
    });
    await globalThis.add2eSyncActorVitalStatus?.(actor, { reason: "magic-item-regeneration" });
  }
  await effect.update({
    "flags.add2e.periodicState.lastTick": last + consumed,
    "flags.add2e.periodicState.lastAppliedTick": tick,
    "flags.add2e.periodicState.pulses": (Number(state.pulses) || 0) + pulses,
    "flags.add2e.periodicState.healed": (Number(state.healed) || 0) + healed,
    "flags.add2e.periodicState.lastResult": { before, after, healed, requested, pulses, tick }
  }, { add2eMagicPowerEffectsAdapter: true });
  if (healed) await regenCard(actor, item, effect, before, after, healed, pulses, Math.max(1, Number(entries[0].intervalRounds) || 1));
  return { applied: healed > 0, actor: actor.name, effect: effect.name, before, after, healed, requested, pulses, tick };
}

async function applyProgressive(actor, effect, tick) {
  const combat = game.combat;
  if (!combat?.started || !Array.from(combat.combatants ?? []).some(c => String(c.actorId ?? c.actor?.id) === String(actor.id))) {
    return { applied: false, reason: "actor-not-in-active-combat" };
  }
  const entry = periodicEntries(effect).find(value => norm(value.type) === "progressive_weapon_bonus");
  const cycle = list(entry?.cycle).map(Number).filter(Number.isFinite);
  const state = clone(effect.flags?.add2e?.periodicState ?? {});
  const last = Number(state.lastTick);
  if (!cycle.length || !Number.isFinite(last) || tick <= last) return { applied: false, reason: "no-new-round" };
  const step = Math.max(0, (Number(state.cycleIndex) || 0) + tick - last);
  const value = cycle[step % cycle.length];
  const tags = list(effect.flags?.add2e?.tags).filter(tag => !String(tag).startsWith("bonus_attaque:") && !String(tag).startsWith("bonus_degats:"));
  tags.push(`bonus_attaque:${signed(value)}`, `bonus_degats:${signed(value)}`);
  await effect.update({
    "flags.add2e.tags": tags,
    "flags.add2e.effectTags": tags,
    "flags.add2e.periodicState.lastTick": tick,
    "flags.add2e.periodicState.lastAppliedTick": tick,
    "flags.add2e.periodicState.cycleIndex": step
  }, { add2eMagicPowerEffectsAdapter: true });
  return { applied: true, actor: actor.name, effect: effect.name, value, tick };
}

async function processPeriodic(tick = currentTick()) {
  if (!primaryGM()) return { ok: false, reason: "not-primary-gm", tick };
  const rows = [];
  let effects = 0;
  let healed = 0;
  for (const actor of allActors()) {
    for (const effect of periodicEffects(actor)) {
      effects += 1;
      try {
        const types = periodicEntries(effect).map(entry => norm(entry.type));
        if (types.includes("regeneration")) {
          const result = await applyRegeneration(actor, effect, tick);
          rows.push(result);
          healed += Number(result.healed) || 0;
        }
        if (types.includes("progressive_weapon_bonus")) rows.push(await applyProgressive(actor, effect, tick));
      } catch (error) {
        console.error("[ADD2E][MAGIC_POWER_EFFECTS][PERIODIC_EFFECT]", { actor: actor.name, effect: effect.name, error });
      }
    }
  }
  return { ok: true, tick, effects, healed, rows };
}

const powerName = (power, item) => String(power?.name ?? power?.nom ?? power?.label ?? power?.catalogueId ?? item?.name ?? "Pouvoir magique").trim();
const effectTypes = power => [...new Set((power?.effects ?? []).map(effect => norm(effect?.type ?? effect?.kind ?? effect?.category)).filter(Boolean))];
const targetActors = actor => game.user?.targets?.size ? [...game.user.targets].map(token => token.actor).filter(Boolean) : [actor];

async function createCard(actor, item, power, {
  title = powerName(power, item),
  variant = "magic",
  rows = [],
  message = "",
  targets = []
} = {}) {
  if (typeof globalThis.add2eCreateChatCard !== "function") throw new Error("Le constructeur de carte ADD2E est indisponible.");
  return globalThis.add2eCreateChatCard({
    actor,
    title,
    icon: "fas fa-wand-magic-sparkles",
    variant,
    source: { name: item.name, img: item.img, type: "Objet magique", meta: powerName(power, item) },
    target: targets.length === 1 ? { name: targets[0].name, img: targets[0].img } : null,
    rows,
    message,
    chatData: {
      flags: {
        add2e: {
          magicItemCataloguePower: true,
          sourceItemId: item.id,
          magicPowerId: power.catalogueId ?? power.id,
          version: ADD2E_MAGIC_POWER_EFFECTS_ADAPTER_VERSION
        }
      }
    }
  });
}

function parameterRows(power) {
  const rows = [{ label: "Automatisation", value: power.automation ?? "manual" }];
  const activation = [power.activation?.type, power.activation?.trigger].filter(Boolean).join(" / ");
  if (activation) rows.push({ label: "Activation", value: activation });
  if (effectTypes(power).length) rows.push({ label: "Effets", value: effectTypes(power).join(", ") });
  for (const [key, value] of Object.entries(power.parameters ?? {})) {
    rows.push({ label: key, value: typeof value === "object" ? JSON.stringify(value) : String(value) });
  }
  return rows.slice(0, 12);
}

async function confirmPower(actor, item, power) {
  if (norm(power.automation) === "automatic" && !["action", "command", "use"].includes(norm(power.activation?.type))) return true;
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.confirm) throw new Error("DialogV2 est indisponible.");
  return DialogV2.confirm({
    window: { title: `Utiliser ${powerName(power, item)}` },
    modal: true,
    content: `<div class="add2e-dialog" style="min-width:480px;padding:8px;"><p><b>${esc(actor.name)}</b> utilise <b>${esc(powerName(power, item))}</b> depuis <b>${esc(item.name)}</b>.</p><p>Traitement : <b>${esc(effectTypes(power).join(", ") || "résolution assistée")}</b>.</p></div>`,
    yes: { label: "Utiliser le pouvoir", icon: "fa-solid fa-wand-magic-sparkles" },
    no: { label: "Annuler", icon: "fa-solid fa-xmark" }
  });
}

const formula = effect => {
  const value = effect.formula ?? effect.dice ?? effect.roll ?? effect.amount ?? effect.points ?? effect.value;
  return value == null || value === "" ? null : String(value);
};
async function evaluate(formulaText) {
  const roll = await new Roll(formulaText).evaluate();
  if (game.dice3d) await game.dice3d.showForRoll(roll);
  return roll;
}

async function applyHealing(actor, item, power, effect) {
  const formulaText = formula(effect);
  if (!formulaText) return null;
  const amount = Math.max(0, Math.floor(Number((await evaluate(formulaText)).total) || 0));
  const targets = targetActors(actor);
  const rows = [{ label: "Formule", value: formulaText }, { label: "Résultat", value: amount }];
  for (const target of targets) {
    const data = hp(target);
    if (!data || data.value <= 0) { rows.push({ label: target.name, value: "PV non modifiés" }); continue; }
    const after = Math.min(data.max, data.value + amount);
    if (after !== data.value) await target.update({ [data.path]: after }, { add2eMagicPowerExecution: true });
    rows.push({ label: target.name, value: `${data.value} → ${after} PV` });
  }
  await createCard(actor, item, power, { title: "Guérison magique", variant: "healing", rows, targets });
  return { ok: true, handled: "healing" };
}

async function applyDamage(actor, item, power, effect) {
  const formulaText = formula(effect);
  if (!formulaText || !game.user?.targets?.size) return null;
  const amount = Math.max(0, Math.floor(Number((await evaluate(formulaText)).total) || 0));
  const targets = targetActors(actor);
  const rows = [{ label: "Formule", value: formulaText }, { label: "Dégâts", value: amount }];
  for (const target of targets) {
    const data = hp(target);
    if (!data) { rows.push({ label: target.name, value: "PV non modifiés" }); continue; }
    const after = Math.max(0, data.value - amount);
    if (after !== data.value) await target.update({ [data.path]: after }, { add2eMagicPowerExecution: true });
    rows.push({ label: target.name, value: `${data.value} → ${after} PV` });
  }
  await createCard(actor, item, power, { title: "Dégâts magiques", variant: "damage", rows, targets });
  return { ok: true, handled: "damage" };
}

async function removeCondition(actor, item, power, effect) {
  const wanted = list(effect.conditions ?? effect.condition ?? effect.tags ?? effect.targetAny).map(norm).filter(Boolean);
  if (!wanted.length) return null;
  const targets = targetActors(actor);
  const rows = [];
  for (const target of targets) {
    const ids = Array.from(target.effects ?? []).filter(active => {
      const values = [active.name, ...list(active.flags?.add2e?.tags), ...list(active.flags?.add2e?.effectTags)].map(norm);
      return wanted.some(condition => values.some(value => value === condition || value.includes(condition)));
    }).map(active => active.id).filter(Boolean);
    if (ids.length) await target.deleteEmbeddedDocuments("ActiveEffect", ids, { add2eMagicPowerExecution: true });
    rows.push({ label: target.name, value: `${ids.length} effet(s) supprimé(s)` });
  }
  await createCard(actor, item, power, { title: "Dissipation d'état", variant: "success", rows, targets });
  return { ok: true, handled: "remove-condition" };
}

async function toggleLight(actor, item, power, effect) {
  const tokens = game.user?.targets?.size ? [...game.user.targets] : canvas?.tokens?.controlled ?? [];
  if (!tokens.length) return null;
  const radius = Math.max(0, Number(effect.radius ?? power.parameters?.radius ?? 6) || 6);
  const bright = Math.max(0, Number(effect.bright ?? Math.floor(radius / 2)) || 0);
  const rows = [];
  const powerId = String(power.catalogueId ?? power.id ?? "");
  for (const token of tokens) {
    const marker = token.document.flags?.add2e?.magicPowerLight;
    const active = marker && String(marker.itemId) === String(item.id) && String(marker.powerId) === powerId;
    if (active) {
      await token.document.update({ light: clone(marker.previous ?? { dim: 0, bright: 0 }), "flags.add2e.-=magicPowerLight": null });
      rows.push({ label: token.name, value: "Lumière éteinte" });
    } else {
      const previous = token.document.light?.toObject?.() ?? clone(token.document.light ?? { dim: 0, bright: 0 });
      await token.document.update({
        light: { dim: radius, bright, alpha: 0.25, angle: 360 },
        "flags.add2e.magicPowerLight": { itemId: item.id, powerId, previous }
      });
      rows.push({ label: token.name, value: `Lumière ${bright}/${radius}` });
    }
  }
  await createCard(actor, item, power, { title: "Lumière magique", rows, targets: tokens.map(token => token.actor).filter(Boolean) });
  return { ok: true, handled: "light" };
}

function powerDuration(power, effect) {
  for (const value of [
    effect.duration,
    effect.duree,
    effect.rounds != null ? { value: effect.rounds, unit: "round" } : null,
    effect.turns != null ? { value: effect.turns, unit: "turn" } : null,
    effect.durationRounds != null ? { value: effect.durationRounds, unit: "round" } : null,
    power.parameters?.duration,
    power.parameters?.rounds != null ? { value: power.parameters.rounds, unit: "round" } : null
  ]) {
    const parts = durationParts(value);
    if (parts) return parts;
  }
  return null;
}

async function temporaryEffect(actor, item, power, effect) {
  const duration = powerDuration(power, effect);
  const toggle = norm(power.activation?.trigger) === "toggle" || norm(effect.mode) === "toggle";
  if (!duration && !toggle) return null;
  const targets = targetActors(actor);
  const type = norm(effect.type);
  const key = `${item.id}:${power.catalogueId ?? power.id}:${type}`;
  const rows = [];
  for (const target of targets) {
    const existing = Array.from(target.effects ?? []).find(active => String(active.flags?.add2e?.magicPowerActivationKey ?? "") === key);
    if (existing && toggle) {
      await target.deleteEmbeddedDocuments("ActiveEffect", [existing.id], { add2eMagicPowerExecution: true });
      rows.push({ label: target.name, value: "Effet désactivé" });
      continue;
    }
    const tags = [...new Set([...list(effect.tags ?? effect.effectTags).map(String), `etat:${type}`])];
    const extraFlags = {
      magicPowerActivation: true,
      magicPowerActivationKey: key,
      sourceItemId: item.id,
      magicPowerId: power.catalogueId ?? power.id,
      tags,
      effectTags: tags,
      rules: [{ source: "magic-item-catalogue", type, ...clone(effect) }]
    };
    const data = typeof game?.add2e?.time?.effectData === "function"
      ? game.add2e.time.effectData({
          name: `${item.name} — ${powerName(power, item)}`,
          img: power.img || item.img,
          origin: item.uuid,
          rounds: duration?.value ?? 0,
          unit: duration?.unit ?? "round",
          description: `Effet activé par ${item.name}.`,
          tags,
          changes: [],
          source: "magic-item",
          sourceItem: item,
          extraFlags
        })
      : {
          name: `${item.name} — ${powerName(power, item)}`,
          img: power.img || item.img,
          origin: item.uuid,
          disabled: false,
          transfer: false,
          duration: duration ? { rounds: toRounds(duration) } : {},
          changes: [],
          flags: { add2e: extraFlags }
        };
    if (duration && typeof game?.add2e?.time?.createTimedActiveEffect === "function") {
      await game.add2e.time.createTimedActiveEffect(target, data);
    } else {
      await target.createEmbeddedDocuments("ActiveEffect", [data], { add2eMagicPowerExecution: true });
    }
    rows.push({ label: target.name, value: duration ? `${duration.value} ${duration.unit}` : "Effet activé" });
  }
  await createCard(actor, item, power, { title: "Effet magique", rows, targets });
  return { ok: true, handled: "temporary-effect" };
}

function onUsePath(document) {
  return String(
    document?.onUse ?? document?.onuse ?? document?.on_use ?? document?.script ?? document?.macro
    ?? document?.system?.onUse ?? document?.system?.onuse ?? document?.system?.on_use ?? document?.system?.script
    ?? ""
  ).trim();
}

async function executeScript(actor, item, power, index, path, linkedSpell = null) {
  if (!path || path === INTERNAL_ON_USE) return null;
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const code = await response.text();
  const AsyncFunction = Object.getPrototypeOf(async function() {}).constructor;
  const source = linkedSpell ?? item;
  const token = canvas?.tokens?.controlled?.[0] ?? actor.getActiveTokens?.()?.[0] ?? null;
  const scope = {
    actor,
    item: source,
    sourceItem: item,
    objectItem: item,
    sort: linkedSpell,
    linkedSpell,
    token,
    power,
    pouvoir: power,
    powerIndex: index,
    isObjectPower: true
  };
  const args = [{ ...scope, scope }];
  const runner = new AsyncFunction(
    "actor", "item", "sourceItem", "objectItem", "sort", "linkedSpell", "token", "power", "pouvoir", "powerIndex", "scope", "args",
    "game", "ui", "ChatMessage", "Roll", "foundry", "canvas",
    code
  );
  const result = await runner(actor, source, item, item, linkedSpell, linkedSpell, token, power, power, index, scope, args, game, ui, ChatMessage, Roll, foundry, canvas);
  return { ok: result !== false, handled: "linked-script", path };
}

function spellLevel(spell) {
  return Math.max(1, Number(spell?.system?.niveau ?? spell?.system?.level ?? spell?.niveau ?? spell?.level ?? 1) || 1);
}

function packIndexEntries(index) {
  if (!index) return [];
  if (Array.isArray(index.contents)) return index.contents;
  if (typeof index.values === "function") return [...index.values()];
  try { return [...index]; } catch (_error) { return []; }
}

async function spellIndex({ force = false } = {}) {
  if (force) spellIndexPromise = null;
  if (spellIndexPromise) return spellIndexPromise;
  spellIndexPromise = (async () => {
    const pack = game.packs?.get?.(SPELL_PACK_ID);
    if (!pack || String(pack.documentName ?? pack.metadata?.type ?? "") !== "Item") return [];
    let index;
    try {
      index = await pack.getIndex({ fields: ["name", "type", "img", "system.niveau", "system.level"] });
    } catch (_error) {
      try { index = await pack.getIndex(); } catch (_indexError) { return []; }
    }
    return packIndexEntries(index)
      .filter(entry => String(entry?.type ?? "").toLowerCase() === "sort")
      .map(entry => ({
        uuid: `Compendium.${SPELL_PACK_ID}.${entry._id}`,
        name: String(entry.name ?? "Sort"),
        img: entry.img ?? "icons/svg/book.svg",
        level: spellLevel(entry),
        source: String(pack.title ?? pack.metadata?.label ?? SPELL_PACK_ID)
      }))
      .sort((left, right) => Number(left.level) - Number(right.level) || left.name.localeCompare(right.name, "fr"));
  })();
  return spellIndexPromise;
}

function spellOptions(entries, selectedUuid = "", selectedName = "") {
  const selectedUuidText = String(selectedUuid ?? "").trim();
  const wantedName = norm(selectedName);
  const groups = new Map();
  for (const entry of entries) {
    if (!groups.has(entry.source)) groups.set(entry.source, []);
    groups.get(entry.source).push(entry);
  }
  const html = [...groups.entries()].map(([source, spells]) => {
    const options = spells.map(entry => {
      const selected = entry.uuid === selectedUuidText || (!selectedUuidText && wantedName && norm(entry.name) === wantedName);
      return `<option value="${esc(entry.uuid)}" data-spell-name="${esc(entry.name)}"${selected ? " selected" : ""}>Niv. ${Number(entry.level) || 1} — ${esc(entry.name)}</option>`;
    }).join("");
    return `<optgroup label="${esc(source)}">${options}</optgroup>`;
  }).join("");
  return `<option value="">— Choisir un sort du compendium —</option>${html}`;
}

async function chooseSpell(currentUuid = "", currentName = "") {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.wait) throw new Error("DialogV2 est indisponible.");
  const entries = await spellIndex();
  if (!entries.length) {
    ui.notifications.warn(`Le compendium ${SPELL_PACK_ID} ne contient aucun Item de type sort disponible.`);
    return null;
  }
  return DialogV2.wait({
    window: { title: "Choisir le sort équivalent" },
    modal: true,
    rejectClose: false,
    content: `<div class="add2e-dialog" style="min-width:620px;padding:10px;display:grid;gap:8px;"><p style="margin:0;">Choisissez dans le compendium ADD2E le sort que l'objet pourra lancer.</p><select name="spellUuid" size="14" style="width:100%;">${spellOptions(entries, currentUuid, currentName)}</select></div>`,
    buttons: [
      {
        action: "select",
        label: "Utiliser ce sort",
        icon: "fa-solid fa-wand-magic-sparkles",
        default: true,
        callback: (_event, button, dialog) => {
          const root = button?.form ?? dialog?.element;
          const select = root?.querySelector?.('[name="spellUuid"]');
          const uuid = String(select?.value ?? "").trim();
          const name = String(select?.selectedOptions?.[0]?.dataset?.spellName ?? "").trim();
          return uuid ? { uuid, name } : null;
        }
      },
      { action: "cancel", label: "Annuler", icon: "fa-solid fa-xmark", callback: () => null }
    ]
  });
}

async function resolveSpell(reference = {}) {
  const uuid = String(reference.spellUuid ?? reference.uuid ?? reference.sourceUuid ?? reference.sourceId ?? "").trim();
  const allowedPrefix = `Compendium.${SPELL_PACK_ID}.`;
  if (uuid) {
    if (!uuid.startsWith(allowedPrefix) || typeof fromUuid !== "function") return null;
    try {
      const document = await fromUuid(uuid);
      return document?.documentName === "Item" && String(document.type ?? "").toLowerCase() === "sort" ? document : null;
    } catch (_error) { return null; }
  }
  const name = norm(reference.spellName ?? reference.name ?? reference.nom ?? "");
  if (!name) return null;
  const entry = (await spellIndex()).find(candidate => norm(candidate.name) === name);
  if (!entry || typeof fromUuid !== "function") return null;
  try {
    const document = await fromUuid(entry.uuid);
    return document?.documentName === "Item" && String(document.type ?? "").toLowerCase() === "sort" ? document : null;
  } catch (_error) { return null; }
}

function linkedSpellEffect(power) {
  return (power?.effects ?? []).find(effect => norm(effect?.type ?? effect?.kind) === "linked_spell") ?? null;
}

function cleanSpellSource(spell) {
  const data = clone(spell?.toObject?.() ?? spell ?? {});
  delete data._id;
  delete data.folder;
  delete data.sort;
  delete data.ownership;
  delete data._stats;
  for (const effect of data.effects ?? []) {
    delete effect._id;
    delete effect.folder;
    delete effect.sort;
    delete effect._stats;
  }
  return data;
}

function linkedSpellCost(power, effect) {
  const value = number(
    effect?.chargeCost,
    power?.parameters?.chargeCost,
    power?.chargeCost,
    power?.cost,
    power?.cout
  );
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function buildVirtualSpell(actor, item, power, index, effect, spell) {
  let data = cleanSpellSource(spell);
  const overrides = effect?.overrides && typeof effect.overrides === "object" && !Array.isArray(effect.overrides)
    ? clone(effect.overrides)
    : {};
  const topLevelOverride = ["system", "flags", "name", "img", "effects", "type"].some(key => Object.hasOwn(overrides, key));
  if (Object.keys(overrides).length) {
    data = topLevelOverride ? merge(data, overrides) : { ...data, system: merge(data.system ?? {}, overrides) };
  }
  data._id = foundry?.utils?.randomID?.() ?? Math.random().toString(36).slice(2, 18);
  data.type = "sort";
  data.name = String(data.name ?? spell.name ?? effect.spellName ?? powerName(power, item));
  data.img = data.img || spell.img || item.img || "icons/svg/book.svg";
  data.system ??= {};
  data.flags ??= {};
  data.flags.add2e ??= {};
  const casterLevel = number(effect?.casterLevel, power?.parameters?.casterLevel);
  const activationTime = effect?.activationTime ?? power?.parameters?.activationTime;
  const cost = linkedSpellCost(power, effect);
  const max = Math.max(1, Number(
    item.system?.charges?.max
    ?? item.system?.max_charges
    ?? item.system?.maxCharges
    ?? item.system?.chargesMax
    ?? 1
  ) || 1);
  Object.assign(data.system, {
    isPower: true,
    isObjectPower: true,
    sourceItemId: item.id,
    sourceWeaponId: item.id,
    sourceItemName: item.name,
    powerIndex: index,
    cost,
    cout: cost,
    max,
    linkedSpellUuid: spell.uuid ?? effect.spellUuid ?? ""
  });
  if (Number.isFinite(casterLevel) && casterLevel > 0) {
    data.system.casterLevel = casterLevel;
    data.system.niveauLanceur = casterLevel;
    data.system.niveau_lanceur = casterLevel;
    data.flags.add2e.casterLevel = casterLevel;
  }
  if (hasValue(activationTime)) data.system.temps_incantation = activationTime;
  Object.assign(data.flags.add2e, {
    sourceType: "objet_magique",
    sourceItemId: item.id,
    sourceItemName: item.name,
    magicPowerId: power.catalogueId ?? power.id ?? "",
    powerIndex: index,
    linkedSpellUuid: spell.uuid ?? effect.spellUuid ?? ""
  });
  return new CONFIG.Item.documentClass(data, { parent: actor });
}

async function persistSpellChoice(item, index, selection) {
  if (!item || !selection?.uuid || !Number.isInteger(Number(index))) return false;
  const powers = powerArray(item).map(clone);
  const stored = powers[Number(index)];
  if (!stored) return false;
  stored.parameters ??= {};
  stored.parameters.spellUuid = selection.uuid;
  stored.parameters.spellName = selection.name;
  if (Array.isArray(stored.effects)) {
    stored.effects = stored.effects.map(effect => norm(effect?.type ?? effect?.kind) === "linked_spell"
      ? { ...effect, spellUuid: selection.uuid, spellName: selection.name }
      : effect);
  }
  await item.update({ "system.pouvoirs": powers }, {
    add2eMagicPowerEffectsAdapter: true,
    add2eMagicPowerExecution: true,
    render: false
  });
  return true;
}

async function castLinkedSpell(actor, item, power, index, effect) {
  let reference = {
    spellUuid: effect?.spellUuid ?? power?.parameters?.spellUuid,
    spellName: effect?.spellName ?? power?.parameters?.spellName
  };
  let spell = await resolveSpell(reference);
  if (!spell) {
    const selection = await chooseSpell(reference.spellUuid, reference.spellName);
    if (!selection) return { ok: false, handled: "linked-spell-cancelled", chargesManaged: true };
    reference = { spellUuid: selection.uuid, spellName: selection.name };
    spell = await resolveSpell(reference);
    if (!spell) throw new Error(`Le sort « ${selection.name || selection.uuid} » est introuvable.`);
    effect.spellUuid = selection.uuid;
    effect.spellName = selection.name;
    power.parameters ??= {};
    power.parameters.spellUuid = selection.uuid;
    power.parameters.spellName = selection.name;
    await persistSpellChoice(item, index, selection);
  }
  if (typeof globalThis.add2eCastSpell !== "function") throw new Error("Le moteur add2eCastSpell est indisponible.");
  const virtualSpell = buildVirtualSpell(actor, item, power, index, effect, spell);
  const launched = await globalThis.add2eCastSpell({
    actor,
    sort: virtualSpell,
    mode: "power",
    sourceItem: item
  });
  return {
    ok: launched === true,
    handled: "linked-spell",
    chargesManaged: true,
    spellUuid: spell.uuid,
    spellName: spell.name
  };
}

async function linkedPower(actor, item, power, index) {
  const linkedEffect = linkedSpellEffect(power);
  if (linkedEffect) return castLinkedSpell(actor, item, power, index, linkedEffect);
  const direct = onUsePath(power) || onUsePath(power.linkedSpell);
  if (direct) return executeScript(actor, item, power, index, direct);
  const linked = power.linkedSpell;
  if (!linked) return null;
  const spell = await resolveSpell(linked);
  const path = onUsePath(spell);
  return path ? executeScript(actor, item, power, index, path, spell) : null;
}

async function assisted(actor, item, power) {
  const targets = targetActors(actor);
  await createCard(actor, item, power, {
    variant: "ability",
    rows: parameterRows(power),
    message: "Résolution assistée : appliquez les choix, jets, sauvegardes ou conséquences indiqués par le pouvoir et sa source.",
    targets
  });
  return { ok: true, handled: "assisted" };
}

function powerCost(power) {
  const linked = linkedSpellEffect(power);
  const value = number(
    power?.cout,
    power?.cost,
    power?.chargeCost,
    power?.parameters?.chargeCost,
    linked?.chargeCost
  );
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

async function executePower(actor, item, power, index = 0, sheet = null) {
  if (!actor || !item || power?.kind !== "catalogue") {
    ui.notifications.error("Pouvoir du catalogue introuvable.");
    return false;
  }
  if (!itemUsable(item)) {
    ui.notifications.warn(`${item.name} doit être équipé ou utilisable.`);
    return false;
  }
  const clean = cleanPower(power);
  if (!await confirmPower(actor, item, clean)) return false;
  const linked = !!linkedSpellEffect(clean);
  const cost = powerCost(clean);
  const current = linked ? 0 : Number(globalThis.add2eObjectPowerCurrentCharges?.(item, clean, index)) || 0;
  if (!linked && cost > 0 && current < cost) {
    ui.notifications.warn(`${item.name} n'a pas assez de charges.`);
    return false;
  }
  try {
    let result = null;
    if (passivePower(clean)) {
      await syncItem(item);
      await createCard(actor, item, clean, {
        title: "Pouvoir passif",
        rows: parameterRows(clean),
        message: "Ce pouvoir est appliqué automatiquement par l'ActiveEffect lié à l'objet."
      });
      result = { ok: true, handled: "passive" };
    } else {
      result = await linkedPower(actor, item, clean, index);
      for (const effect of clean.effects ?? []) {
        if (result?.ok || result?.handled === "linked-spell-cancelled") break;
        const type = norm(effect.type ?? effect.kind ?? effect.category);
        if (["heal", "healing", "restore_hit_points", "cure_damage", "hit_point_healing"].includes(type)) result = await applyHealing(actor, item, clean, effect);
        else if (["damage", "direct_damage", "magic_damage", "area_damage"].includes(type) && !hasValue(effect.save ?? effect.savingThrow ?? effect.attackRoll)) result = await applyDamage(actor, item, clean, effect);
        else if (["remove_condition", "cure_condition", "remove_status", "dispel_condition"].includes(type)) result = await removeCondition(actor, item, clean, effect);
        else if (type === "light") result = await toggleLight(actor, item, clean, effect);
        else if (["invisibility", "flight", "flying", "ethereal_state", "haste", "slow", "protection", "movement_mode", "transformation", "polymorph", "status", "condition", "ability_bonus", "characteristic_bonus", "stat_bonus", "armor_bonus", "attack_bonus", "damage_bonus"].includes(type)) result = await temporaryEffect(actor, item, clean, effect);
      }
      if (result?.handled === "linked-spell-cancelled") return false;
      if (linked && !result?.ok) return false;
      if (!result?.ok) result = await assisted(actor, item, clean);
    }
    if (result?.ok && cost > 0 && result.chargesManaged !== true) {
      await globalThis.add2eObjectPowerSetCharges?.(item, clean, index, current - cost);
    }
    if (result?.ok) {
      sheet?._add2eRememberActiveTab?.();
      sheet?.render?.(false);
      return true;
    }
    return false;
  } catch (error) {
    console.error("[ADD2E][MAGIC_POWER_EFFECTS][EXECUTION]", {
      actor: actor.name,
      item: item.name,
      power: powerName(clean, item),
      error
    });
    ui.notifications.error(`Erreur pendant l'utilisation de ${powerName(clean, item)} : ${error.message}`);
    return false;
  }
}

function generatedId(item, index) {
  try {
    return String(globalThis.add2eMagicPowerGeneratedId?.(item, index) ?? String(item.id).substring(0, 14) + String(index).padStart(2, "0"));
  } catch (_error) {
    return String(item.id).substring(0, 14) + String(index).padStart(2, "0");
  }
}

function findGenerated(actor, id) {
  for (const item of actor?.items ?? []) {
    if (!itemUsable(item)) continue;
    const powers = powerArray(item);
    for (let index = 0; index < powers.length; index += 1) {
      if (generatedId(item, index) === String(id) && powers[index].kind === "catalogue") return { item, power: powers[index], index };
    }
  }
  return null;
}

function installEntriesBridge() {
  if (globalThis.__add2eMagicCatalogueEntriesBridgeV3) return;
  globalThis.__add2eMagicCatalogueEntriesBridgeV3 = true;
  const original = globalThis.add2eMagicObjectActivePowerEntries;
  globalThis.add2eMagicObjectActivePowerEntries = item => {
    const rows = typeof original === "function" ? [...(original(item) ?? [])] : [];
    const indexes = new Set(rows.map(entry => Number(entry?.index)).filter(Number.isFinite));
    powerArray(item).forEach((power, index) => {
      if (power.kind !== "catalogue" || indexes.has(index)) return;
      const presented = clone(power);
      presented.onUse ||= INTERNAL_ON_USE;
      presented.onuse ||= presented.onUse;
      presented.on_use ||= presented.onUse;
      rows.push({ power: presented, index });
    });
    return rows.sort((left, right) => Number(left.index) - Number(right.index));
  };
}

function rootOf(app, html) {
  return html instanceof HTMLElement
    ? html
    : html?.[0] instanceof HTMLElement
      ? html[0]
      : app?.element instanceof HTMLElement
        ? app.element
        : app?.element?.[0] instanceof HTMLElement
          ? app.element[0]
          : null;
}

function bindSheet(app, html) {
  const actor = app?.actor ?? app?.document ?? app?.object;
  const root = rootOf(app, html);
  if (actor?.documentName !== "Actor" || !root || root.dataset.add2eMagicCatalogueExecutionBound === "1") return;
  root.dataset.add2eMagicCatalogueExecutionBound = "1";
  root.addEventListener("click", async event => {
    const control = event.target?.closest?.(".sort-cast-img, .add2e-object-magic-cast");
    if (!control || !root.contains(control)) return;
    const resolved = findGenerated(actor, control.dataset?.sortId ?? control.getAttribute?.("data-sort-id"));
    if (!resolved) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    await executePower(actor, resolved.item, resolved.power, resolved.index, app);
  }, true);
}

async function enhanceSpellParameterDialog(app, html) {
  const root = rootOf(app, html);
  const form = root?.matches?.(".add2e-magic-power-parameter-form")
    ? root
    : root?.querySelector?.(".add2e-magic-power-parameter-form");
  if (!form || form.dataset.add2eSpellSelectorBound === "1") return;
  const input = form.querySelector('input[name="spellUuid"]');
  if (!input) return;
  form.dataset.add2eSpellSelectorBound = "1";
  const entries = await spellIndex();
  const spellNameInput = form.querySelector('[name="spellName"]');
  const select = document.createElement("select");
  select.name = "spellUuid";
  select.dataset.add2eParameterType = "uuid";
  select.style.width = "100%";
  select.innerHTML = spellOptions(entries, input.value, spellNameInput?.value ?? "");
  input.replaceWith(select);
  const syncName = () => {
    const name = String(select.selectedOptions?.[0]?.dataset?.spellName ?? "").trim();
    if (spellNameInput && name) spellNameInput.value = name;
  };
  select.addEventListener("change", syncName);
  if (select.value) syncName();
}

const equal = (left, right) => {
  try { return JSON.stringify(left) === JSON.stringify(right); }
  catch (_error) { return false; }
};
function cleanCreate(item) {
  const raw = item?.system?.pouvoirs;
  if (raw === undefined) return;
  const clean = cleanPowers(raw);
  if (!equal(raw, clean)) item.updateSource({ "system.pouvoirs": clean });
}
function cleanUpdate(change) {
  const raw = foundry.utils.getProperty(change, "system.pouvoirs");
  if (raw === undefined) return;
  const clean = cleanPowers(raw);
  if (!equal(raw, clean)) foundry.utils.setProperty(change, "system.pouvoirs", clean);
}
const localUser = userId => !userId || String(userId) === String(game.user?.id ?? "");

async function migrate() {
  if (!primaryGM()) return;
  const documents = [
    ...Array.from(game.items ?? []),
    ...Array.from(game.actors ?? []).flatMap(actor => Array.from(actor.items ?? []))
  ];
  for (const item of documents) {
    const raw = item?.system?.pouvoirs;
    if (raw === undefined) continue;
    const clean = cleanPowers(raw);
    if (!equal(raw, clean)) await item.update({ "system.pouvoirs": clean }, { add2eMagicPowerEffectsAdapter: true });
  }
  for (const actor of game.actors ?? []) await syncActor(actor);
}

globalThis.ADD2E_MAGIC_POWER_EFFECTS_ADAPTER_VERSION = ADD2E_MAGIC_POWER_EFFECTS_ADAPTER_VERSION;
globalThis.add2eCleanMagicItemCataloguePowers = cleanPowers;
globalThis.add2eSyncMagicItemCatalogueEffects = syncItem;
globalThis.add2eSyncActorMagicItemCatalogueEffects = syncActor;
globalThis.add2eRemoveMagicItemCatalogueEffects = removeItemEffects;
globalThis.add2eProcessMagicItemRegeneration = processPeriodic;
globalThis.add2eProcessMagicItemPeriodicEffects = processPeriodic;
globalThis.add2eExecuteMagicCataloguePower = executePower;
globalThis.add2eMagicPowerSpellIndex = spellIndex;

Hooks.on("preCreateItem", cleanCreate);
Hooks.on("preUpdateItem", (_item, change, options = {}) => {
  if (!options.add2eMagicPowerEffectsAdapter) cleanUpdate(change);
});
Hooks.on("createItem", (item, _options, userId) => {
  if (localUser(userId)) syncItem(item).catch(error => console.error("[ADD2E][MAGIC_POWER_EFFECTS][CREATE_ITEM]", error));
});
Hooks.on("updateItem", (item, _change, options = {}, userId) => {
  if (!options.add2eMagicPowerEffectsAdapter && localUser(userId)) syncItem(item).catch(error => console.error("[ADD2E][MAGIC_POWER_EFFECTS][UPDATE_ITEM]", error));
});
Hooks.on("deleteItem", (item, _options, userId) => {
  if (localUser(userId)) removeItemEffects(item).catch(error => console.error("[ADD2E][MAGIC_POWER_EFFECTS][DELETE_ITEM]", error));
});
Hooks.on("updateSetting", (setting, change) => {
  const key = String(setting?.key ?? setting?.id ?? setting?._id ?? "");
  if (key !== TIME_SETTING || !primaryGM()) return;
  const tick = Math.max(0, Math.floor(Number(change?.value ?? setting?.value ?? setting?._source?.value ?? currentTick()) || 0));
  periodicQueue = periodicQueue.catch(() => undefined).then(() => processPeriodic(tick));
});
Hooks.on("renderActorSheet", bindSheet);
Hooks.on("renderApplicationV2", (app, html) => {
  bindSheet(app, html);
  enhanceSpellParameterDialog(app, html).catch(error => console.error("[ADD2E][MAGIC_POWER_EFFECTS][SPELL_SELECTOR]", error));
});
Hooks.once("ready", () => {
  installEntriesBridge();
  game.add2e ??= {};
  game.add2e.magicPowerEffects = {
    version: ADD2E_MAGIC_POWER_EFFECTS_ADAPTER_VERSION,
    cleanPowers,
    syncItem,
    syncActor,
    removeItemEffects,
    processRegeneration: processPeriodic,
    processPeriodic,
    executePower,
    spellIndex
  };
  migrate().catch(error => console.error("[ADD2E][MAGIC_POWER_EFFECTS][READY]", error));
});
