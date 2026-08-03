// ADD2E — Pouvoirs d'objets magiques / synchronisation des ActiveEffects passifs.

import {
  VERSION, EFFECT_FLAG, INTERNAL_EFFECT_OPTION, INTERNAL_NORMALIZE_OPTION,
  cataloguePowers, clone, currentTick, equal, itemUsable, norm, number, powerArray
} from "./runtime.mjs";
import {
  compilePower, compiledFromRules, rulesOf, uniqueChanges, uniqueModifiers, uniqueTags
} from "./rules.mjs";

const NORMALIZE_LOCK = new Set();
const ARMOR_BONUS_TYPES = new Set([
  "armor_class_bonus", "armor_bonus", "ac_bonus", "defense_bonus", "protection_bonus"
]);
const changeSignature = change => `${String(change?.key ?? "")}|${Number(change?.mode ?? 0)}|${String(change?.value ?? "")}|${Number(change?.priority ?? 0)}`;
const modifierSignature = modifier => JSON.stringify([
  modifier?.domain, modifier?.target, modifier?.operation, modifier?.value,
  modifier?.priority, modifier?.stacking, modifier?.conditions, modifier?.metadata
]);

function signature(value) {
  const text = JSON.stringify(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

const powerKey = (item, power, index) => `${item.id}:${index}:${String(power.catalogueId ?? power.id ?? "power")}`;

function effectData(item, power, index, compiled) {
  const key = powerKey(item, power, index);
  const name = `${item.name} — ${power.name ?? power.label ?? power.catalogueId ?? "Pouvoir"}`;
  const flags = {
    [EFFECT_FLAG]: true,
    adapterVersion: VERSION,
    sourceItemId: item.id,
    sourceItemUuid: item.uuid ?? null,
    sourceItemName: item.name,
    magicPowerId: String(power.catalogueId ?? power.id ?? ""),
    magicPowerIndex: index,
    magicPowerKey: key,
    tags: compiled.tags,
    effectTags: compiled.tags,
    rules: compiled.rules,
    modifiers: compiled.modifiers,
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
        changes: compiled.changes,
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
        changes: compiled.changes,
        flags: { add2e: flags }
      };
  base.changes = uniqueChanges([...(base.changes ?? []), ...compiled.changes]);
  base.flags ??= {};
  base.flags.add2e = { ...(base.flags.add2e ?? {}), ...flags };
  base.flags.add2e.signature = signature({
    name: base.name,
    img: base.img,
    tags: compiled.tags,
    rules: compiled.rules,
    modifiers: compiled.modifiers,
    changes: base.changes,
    periodic: compiled.periodic,
    handledTypes: compiled.handledTypes
  });
  return base;
}

export const actorForItem = item => (item?.parent ?? item?.actor)?.documentName === "Actor" ? (item.parent ?? item.actor) : null;
export const existingForItem = (actor, itemId) => Array.from(actor?.effects ?? [])
  .filter(effect => effect.flags?.add2e?.[EFFECT_FLAG] === true
    && String(effect.flags.add2e.sourceItemId ?? "") === String(itemId ?? ""));

function sourceItemForEffect(effect) {
  const actor = effect?.parent?.documentName === "Actor" ? effect.parent : null;
  const itemId = String(effect?.flags?.add2e?.sourceItemId ?? "");
  if (!actor || !itemId) return null;
  return actor.items?.get?.(itemId)
    ?? Array.from(actor.items ?? []).find(item => String(item?.id ?? "") === itemId)
    ?? null;
}

function armorBonusPowerValues(item) {
  const values = [];
  for (const power of cataloguePowers(item)) {
    for (const effect of Array.isArray(power?.effects) ? power.effects : []) {
      const type = norm(effect?.type ?? effect?.kind ?? effect?.category);
      if (!ARMOR_BONUS_TYPES.has(type)) continue;
      const value = number(effect?.bonus, effect?.value, effect?.amount, effect?.armorClassBonus, effect?.acBonus);
      if (Number.isFinite(value) && value !== 0) values.push(Math.abs(value));
    }
  }
  return values;
}

async function normalizeItemArmorBonusSource(item) {
  const powerBonuses = armorBonusPowerValues(item);
  if (!powerBonuses.length) return { changed: false, reason: "no-power-bonus" };
  if (powerBonuses.length !== 1) {
    console.error("[ADD2E][MAGIC_POWER_EFFECTS][ARMOR_BONUS_DUPLICATE_POWERS]", {
      item: item?.name,
      itemId: item?.id,
      powerBonuses
    });
    return { changed: false, reason: "multiple-power-bonuses" };
  }

  const modifiers = Array.from(item?.flags?.add2e?.modifiers ?? []);
  const builderBonuses = modifiers.filter(modifier => modifier?.domain === "armor-class"
    && modifier?.operation === "add"
    && modifier?.metadata?.producer === "magic-item-builder");
  if (!builderBonuses.length) return { changed: false, reason: "power-only" };
  if (builderBonuses.length !== 1) {
    console.error("[ADD2E][MAGIC_POWER_EFFECTS][ARMOR_BONUS_DUPLICATE_FIELDS]", {
      item: item?.name,
      itemId: item?.id,
      builderBonuses
    });
    return { changed: false, reason: "multiple-field-bonuses" };
  }

  const powerBonus = powerBonuses[0];
  const fieldBonus = Math.abs(Number(builderBonuses[0].value) || 0);
  if (fieldBonus !== powerBonus) {
    console.error("[ADD2E][MAGIC_POWER_EFFECTS][ARMOR_BONUS_CONFLICT]", {
      item: item?.name,
      itemId: item?.id,
      fieldBonus,
      powerBonus
    });
    return { changed: false, reason: "conflicting-values" };
  }

  const retainedModifiers = modifiers.filter(modifier => modifier !== builderBonuses[0]);
  const generatedModifiers = Array.from(item?.flags?.add2e?.magicItemBuilder?.generatedModifiers ?? [])
    .filter(id => String(id) !== String(builderBonuses[0].id ?? "magic-item-builder:armor-class:bonus"));
  await item.update({
    "system.enchantement.bonusCA": 0,
    "flags.add2e.modifiers": retainedModifiers,
    "flags.add2e.magicItemBuilder.armorBonusSource": "power",
    "flags.add2e.magicItemBuilder.generatedModifiers": generatedModifiers
  }, { [INTERNAL_EFFECT_OPTION]: true, add2eInternal: true, render: false });
  return { changed: true, reason: "migrated-to-power", value: powerBonus };
}

export async function removeItemEffects(item, actorOverride = null) {
  const actor = actorOverride ?? actorForItem(item);
  if (!actor) return { deleted: 0 };
  const ids = existingForItem(actor, item?.id).map(effect => effect.id).filter(Boolean);
  if (ids.length) await actor.deleteEmbeddedDocuments("ActiveEffect", ids, { [INTERNAL_EFFECT_OPTION]: true });
  return { deleted: ids.length };
}

export async function syncItem(item) {
  const actor = actorForItem(item);
  if (!actor || !item?.id) return { ok: false, reason: "item-not-embedded" };
  await normalizeItemArmorBonusSource(item);
  const existing = existingForItem(actor, item.id);
  const desired = new Map();
  if (itemUsable(item)) {
    cataloguePowers(item).forEach((power, index) => {
      const compiled = compilePower(power, { sourceItem: item });
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
  if (deletes.length) await actor.deleteEmbeddedDocuments("ActiveEffect", deletes, { [INTERNAL_EFFECT_OPTION]: true });
  if (updates.length) await actor.updateEmbeddedDocuments("ActiveEffect", updates, { [INTERNAL_EFFECT_OPTION]: true });
  if (creates.length) await actor.createEmbeddedDocuments("ActiveEffect", creates, { [INTERNAL_EFFECT_OPTION]: true });
  return { ok: true, deleted: deletes.length, updated: updates.length, created: creates.length, desired: desired.size };
}

export async function syncActor(actor) {
  const items = Array.from(actor?.items ?? []).filter(item => cataloguePowers(item).length);
  const totals = { items: items.length, created: 0, updated: 0, deleted: 0 };
  for (const item of items) {
    const result = await syncItem(item);
    for (const key of ["created", "updated", "deleted"]) totals[key] += Number(result[key]) || 0;
  }
  return totals;
}

function relevantEffect(effect) {
  if (!effect || effect.disabled === true) return false;
  const flags = effect.flags?.add2e ?? {};
  return flags[EFFECT_FLAG] === true || flags.magicPowerActivation === true || flags.magicPowerCondition === true || rulesOf(effect).length > 0;
}

export async function normalizeEffectDocument(effect) {
  if (!effect?.id || !relevantEffect(effect)) return false;
  const lockKey = String(effect.uuid ?? effect.id);
  if (NORMALIZE_LOCK.has(lockKey)) return false;
  NORMALIZE_LOCK.add(lockKey);
  try {
    const previous = effect.flags?.add2e?.magicPowerNormalization ?? {};
    const oldChangeSignatures = new Set(Array.isArray(previous.generatedChangeSignatures) ? previous.generatedChangeSignatures : []);
    const oldModifierSignatures = new Set(Array.isArray(previous.generatedModifierSignatures) ? previous.generatedModifierSignatures : []);
    const oldTags = new Set(Array.isArray(previous.generatedTags) ? previous.generatedTags.map(String) : []);
    const baseChanges = Array.from(effect.changes ?? []).filter(change => !oldChangeSignatures.has(changeSignature(change)));
    const baseModifiers = Array.from(effect.flags?.add2e?.modifiers ?? [])
      .filter(modifier => !oldModifierSignatures.has(modifierSignature(modifier)));
    const baseTags = Array.from(effect.flags?.add2e?.tags ?? effect.flags?.add2e?.effectTags ?? [])
      .filter(tag => !oldTags.has(String(tag)));
    const compiled = compiledFromRules(rulesOf(effect), { sourceItem: sourceItemForEffect(effect) });
    const changes = uniqueChanges([...baseChanges, ...compiled.changes]);
    const modifiers = uniqueModifiers([...baseModifiers, ...compiled.modifiers]);
    const tags = uniqueTags([...baseTags, ...compiled.tags]);
    const state = {
      version: VERSION,
      generatedTags: compiled.tags,
      generatedChangeSignatures: compiled.changes.map(changeSignature),
      generatedModifierSignatures: compiled.modifiers.map(modifierSignature)
    };
    const update = {};
    if (!equal(Array.from(effect.changes ?? []), changes)) update.changes = changes;
    if (!equal(Array.from(effect.flags?.add2e?.modifiers ?? []), modifiers)) update["flags.add2e.modifiers"] = modifiers;
    if (!equal(Array.from(effect.flags?.add2e?.tags ?? []), tags)) update["flags.add2e.tags"] = tags;
    if (!equal(Array.from(effect.flags?.add2e?.effectTags ?? []), tags)) update["flags.add2e.effectTags"] = tags;
    if (!equal(previous, state)) update["flags.add2e.magicPowerNormalization"] = state;
    if (!Object.keys(update).length) return false;
    await effect.update(update, { [INTERNAL_NORMALIZE_OPTION]: true, add2eInternal: true, render: false });
    return true;
  } finally {
    NORMALIZE_LOCK.delete(lockKey);
  }
}

export async function migrateEffects(actor) {
  let updated = 0;
  for (const effect of actor?.effects?.contents ?? actor?.effects ?? []) {
    if (await normalizeEffectDocument(effect)) updated += 1;
  }
  return updated;
}

export function findGenerated(actor, id) {
  for (const item of actor?.items ?? []) {
    if (!itemUsable(item)) continue;
    const powers = powerArray(item);
    for (let index = 0; index < powers.length; index += 1) {
      const generated = String(globalThis.add2eMagicPowerGeneratedId?.(item, index)
        ?? String(item.id).substring(0, 14) + String(index).padStart(2, "0"));
      if (generated === String(id) && powers[index].kind === "catalogue") return { item, power: powers[index], index };
    }
  }
  return null;
}
