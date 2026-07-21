// scripts/add2e/magic-power-effects-adapter.mjs
// ADD2E — Adaptateur des pouvoirs d'objets magiques vers Effects Engine.
// Lot 1 : nettoyage des paramètres optionnels et effets passifs automatiques.
// Compatible Foundry V13/V14/V15.

const ADD2E_MAGIC_POWER_EFFECTS_ADAPTER_VERSION = "2026-07-21-magic-power-effects-adapter-v1";
const ADD2E_MAGIC_POWER_EFFECT_FLAG = "magicItemCatalogueEffect";
const ADD2E_MAGIC_POWER_UNSET = Symbol("add2e-magic-power-unset");

function add2eMagicEffectClone(value) {
  if (value === undefined || value === null) return value;
  try { return foundry.utils.deepClone(value); }
  catch (_error) {
    try { return structuredClone(value); }
    catch (_cloneError) { return JSON.parse(JSON.stringify(value)); }
  }
}

function add2eMagicEffectNormalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function add2eMagicEffectArray(value) {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(add2eMagicEffectArray);
  if (value instanceof Set) return [...value].flatMap(add2eMagicEffectArray);
  if (typeof value === "string") return value.split(/[,;\n|]+/g).map(entry => entry.trim()).filter(Boolean);
  if (typeof value === "object") {
    for (const key of ["values", "items", "list", "lists", "tags", "effectTags", "types", "categories"]) {
      if (value[key] !== undefined && value[key] !== null) return add2eMagicEffectArray(value[key]);
    }
  }
  return [value];
}

function add2eMagicEffectNumber(...values) {
  for (const value of values) {
    if (value === undefined || value === null || value === "") continue;
    const number = Number(String(value).replace(",", "."));
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function add2eMagicEffectSigned(value) {
  const number = Number(value) || 0;
  return `${number >= 0 ? "+" : ""}${number}`;
}

function add2eMagicEffectHasValue(value) {
  if (value === undefined || value === null || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

function add2eMagicEffectResolveTemplate(value, parameters = {}) {
  if (Array.isArray(value)) {
    return value
      .map(entry => add2eMagicEffectResolveTemplate(entry, parameters))
      .filter(entry => entry !== ADD2E_MAGIC_POWER_UNSET);
  }
  if (value && typeof value === "object") {
    const output = {};
    for (const [key, entry] of Object.entries(value)) {
      const resolved = add2eMagicEffectResolveTemplate(entry, parameters);
      if (resolved !== ADD2E_MAGIC_POWER_UNSET) output[key] = resolved;
    }
    return output;
  }
  if (typeof value !== "string") return add2eMagicEffectClone(value);

  const exact = value.match(/^@([A-Za-z0-9_]+)$/);
  if (exact) {
    return Object.prototype.hasOwnProperty.call(parameters, exact[1])
      ? add2eMagicEffectClone(parameters[exact[1]])
      : ADD2E_MAGIC_POWER_UNSET;
  }

  let unresolved = false;
  const replaced = value.replace(/@([A-Za-z0-9_]+)/g, (_match, key) => {
    if (!Object.prototype.hasOwnProperty.call(parameters, key)) {
      unresolved = true;
      return "";
    }
    const replacement = parameters[key];
    return typeof replacement === "object" ? JSON.stringify(replacement) : String(replacement);
  });
  return unresolved ? ADD2E_MAGIC_POWER_UNSET : replaced;
}

function add2eCleanMagicCataloguePower(power) {
  if (!power || typeof power !== "object" || power.kind !== "catalogue") return add2eMagicEffectClone(power);
  const clean = add2eMagicEffectClone(power);
  const parameters = clean.parameters && typeof clean.parameters === "object" && !Array.isArray(clean.parameters)
    ? clean.parameters
    : {};
  const templates = Array.isArray(clean.effectTemplates) && clean.effectTemplates.length
    ? clean.effectTemplates
    : Array.isArray(clean.effects)
      ? clean.effects
      : [];
  clean.effects = add2eMagicEffectResolveTemplate(templates, parameters);
  return clean;
}

function add2eCleanMagicItemCataloguePowersValue(value) {
  if (Array.isArray(value)) return value.map(add2eCleanMagicCataloguePower);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, power]) => [key, add2eCleanMagicCataloguePower(power)]));
  }
  return value;
}

function add2eMagicEffectCataloguePowers(item) {
  const raw = item?.system?.pouvoirs
    ?? item?.system?.powers
    ?? item?.system?.pouvoirsMagiques
    ?? item?.system?.magicalPowers
    ?? [];
  const powers = Array.isArray(raw) ? raw : raw && typeof raw === "object" ? Object.values(raw) : [];
  return powers.filter(power => power && typeof power === "object" && power.kind === "catalogue");
}

function add2eMagicEffectItemEquipped(item) {
  const system = item?.system ?? {};
  return system.equipee === true
    || system.equipped === true
    || system.portee === true
    || system.worn === true;
}

function add2eMagicEffectPowerPassive(power) {
  if (add2eMagicEffectNormalize(power?.automation) !== "automatic") return false;
  const type = add2eMagicEffectNormalize(power?.activation?.type);
  const trigger = add2eMagicEffectNormalize(power?.activation?.trigger);
  if (["passive", "automatic", "always_on", "permanent"].includes(type)) return true;
  return ["equipped", "equip", "worn", "carried", "porte", "portee"]
    .some(token => trigger.includes(token));
}

function add2eMagicEffectPushTags(target, prefix, values, suffix = null) {
  for (const value of add2eMagicEffectArray(values)) {
    const normalized = add2eMagicEffectNormalize(value);
    if (!normalized) continue;
    target.add(suffix === null ? `${prefix}:${normalized}` : `${prefix}:${normalized}:${suffix}`);
  }
}

function add2eMagicEffectFirstList(effect, keys) {
  for (const key of keys) {
    if (add2eMagicEffectHasValue(effect?.[key])) return add2eMagicEffectArray(effect[key]);
  }
  return [];
}

function add2eMagicEffectCompileDefinition(effect = {}) {
  const type = add2eMagicEffectNormalize(effect.type ?? effect.kind ?? effect.category);
  const tags = new Set();
  const rules = [];

  const immunityTypes = add2eMagicEffectFirstList(effect, [
    "attackAny", "damageAny", "damageTypes", "immunities", "types", "elements", "conditions", "targetAny"
  ]);
  if (["damage_immunity", "attack_immunity", "condition_immunity", "immunity", "immunite"].includes(type)) {
    add2eMagicEffectPushTags(tags, "immunite", immunityTypes);
  } else if (type.endsWith("_immunity") || type.endsWith("_immunite")) {
    const inferred = type.replace(/_(?:immunity|immunite)$/, "");
    add2eMagicEffectPushTags(tags, "immunite", immunityTypes.length ? immunityTypes : [inferred]);
  }

  const resistanceTypes = add2eMagicEffectFirstList(effect, [
    "attackAny", "damageAny", "damageTypes", "resistances", "types", "elements", "targetAny", "against"
  ]);
  if (["damage_resistance", "magic_resistance", "resistance", "resistance_damage"].includes(type)) {
    const inferred = type === "magic_resistance" ? ["magie"] : [];
    const types = resistanceTypes.length ? resistanceTypes : inferred;
    const percentage = effect.percentage ?? effect.percent ?? effect.pct ?? effect.value ?? effect.amount ?? effect.reduction;
    const suffix = add2eMagicEffectHasValue(percentage) ? String(percentage) : null;
    add2eMagicEffectPushTags(tags, "resistance", types, suffix);
  }

  if (["saving_throw_bonus", "save_bonus", "saving_bonus", "bonus_save", "saving_throw_modifier"].includes(type)) {
    const value = add2eMagicEffectNumber(effect.bonus, effect.value, effect.amount, effect.modifier);
    if (Number.isFinite(value) && value !== 0) {
      const categories = add2eMagicEffectFirstList(effect, ["saveAny", "categories", "category", "against", "types", "targetAny"]);
      if (categories.length) add2eMagicEffectPushTags(tags, "bonus_save_vs", categories, add2eMagicEffectSigned(value));
      else tags.add(`bonus_save:${add2eMagicEffectSigned(value)}`);
    }
  }

  if (["attack_bonus", "hit_bonus", "damage_bonus", "combat_bonus", "attack_damage_bonus"].includes(type)) {
    const attack = add2eMagicEffectNumber(effect.attackBonus, effect.hitBonus, effect.bonusToucher, effect.toucher, type !== "damage_bonus" ? effect.bonus : null);
    const damage = add2eMagicEffectNumber(effect.damageBonus, effect.bonusDegats, effect.degats, type === "damage_bonus" ? effect.bonus : null);
    if (Number.isFinite(attack) && attack !== 0) tags.add(`bonus_attaque:${add2eMagicEffectSigned(attack)}`);
    if (Number.isFinite(damage) && damage !== 0) tags.add(`bonus_degats:${add2eMagicEffectSigned(damage)}`);
  }

  if (["armor_class_bonus", "ac_bonus", "defense_bonus", "protection_bonus"].includes(type)) {
    const value = add2eMagicEffectNumber(effect.bonus, effect.value, effect.amount, effect.armorClassBonus, effect.acBonus);
    if (Number.isFinite(value) && value !== 0) tags.add(`bonus_ca:${add2eMagicEffectSigned(value)}`);
  }

  const explicitTags = add2eMagicEffectArray(effect.tags ?? effect.effectTags);
  for (const rawTag of explicitTags) {
    const tag = String(rawTag ?? "").trim();
    if (tag) tags.add(tag);
  }
  if (Array.isArray(effect.rules)) rules.push(...add2eMagicEffectClone(effect.rules));
  else if (effect.rule && typeof effect.rule === "object") rules.push(add2eMagicEffectClone(effect.rule));

  return { type, tags: [...tags], rules };
}

function add2eMagicEffectCompilePower(power) {
  if (!add2eMagicEffectPowerPassive(power)) return null;
  const tags = new Set();
  const rules = [];
  const handledTypes = [];
  for (const effect of Array.isArray(power.effects) ? power.effects : []) {
    const compiled = add2eMagicEffectCompileDefinition(effect);
    if (compiled.type) handledTypes.push(compiled.type);
    for (const tag of compiled.tags) tags.add(tag);
    rules.push(...compiled.rules);
  }
  if (!tags.size && !rules.length) return null;
  return {
    tags: [...tags],
    rules,
    handledTypes: [...new Set(handledTypes)]
  };
}

function add2eMagicEffectPowerKey(item, power, index) {
  return `${item.id}:${index}:${String(power.catalogueId ?? power.id ?? "power")}`;
}

function add2eMagicEffectSignature(value) {
  const text = JSON.stringify(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function add2eMagicEffectData(actor, item, power, index, compiled) {
  const powerKey = add2eMagicEffectPowerKey(item, power, index);
  const base = {
    name: `${item.name} — ${power.name ?? power.label ?? power.catalogueId ?? "Pouvoir"}`,
    img: power.img || item.img || "icons/svg/aura.svg",
    origin: item.uuid ?? null,
    disabled: false,
    transfer: false,
    duration: {},
    changes: [],
    description: `Pouvoir passif automatique de ${item.name}. Actif tant que l'objet est équipé.`,
    flags: {
      add2e: {
        [ADD2E_MAGIC_POWER_EFFECT_FLAG]: true,
        adapterVersion: ADD2E_MAGIC_POWER_EFFECTS_ADAPTER_VERSION,
        sourceItemId: item.id,
        sourceItemUuid: item.uuid ?? null,
        sourceItemName: item.name,
        magicPowerId: String(power.catalogueId ?? power.id ?? ""),
        magicPowerIndex: index,
        magicPowerKey: powerKey,
        tags: compiled.tags,
        effectTags: compiled.tags,
        rules: compiled.rules,
        handledTypes: compiled.handledTypes,
        activation: add2eMagicEffectClone(power.activation ?? {}),
        catalogue: add2eMagicEffectClone(power.catalogue ?? {})
      }
    }
  };
  base.flags.add2e.signature = add2eMagicEffectSignature({
    name: base.name,
    img: base.img,
    origin: base.origin,
    tags: compiled.tags,
    rules: compiled.rules,
    handledTypes: compiled.handledTypes
  });
  return base;
}

function add2eMagicEffectActorForItem(item) {
  const parent = item?.parent ?? item?.actor ?? null;
  return parent?.documentName === "Actor" ? parent : null;
}

function add2eMagicEffectExistingForItem(actor, itemId) {
  return Array.from(actor?.effects ?? []).filter(effect => (
    effect?.flags?.add2e?.[ADD2E_MAGIC_POWER_EFFECT_FLAG] === true
    && String(effect.flags.add2e.sourceItemId ?? "") === String(itemId ?? "")
  ));
}

async function add2eRemoveMagicItemCatalogueEffects(item, actorOverride = null) {
  const actor = actorOverride ?? add2eMagicEffectActorForItem(item);
  if (!actor) return { deleted: 0 };
  const ids = add2eMagicEffectExistingForItem(actor, item?.id).map(effect => effect.id).filter(Boolean);
  if (ids.length) await actor.deleteEmbeddedDocuments("ActiveEffect", ids, { add2eMagicPowerEffectsAdapter: true });
  return { deleted: ids.length };
}

async function add2eSyncMagicItemCatalogueEffects(item) {
  const actor = add2eMagicEffectActorForItem(item);
  if (!actor || !item?.id) return { ok: false, reason: "item-not-embedded" };

  const existing = add2eMagicEffectExistingForItem(actor, item.id);
  const desired = new Map();
  if (add2eMagicEffectItemEquipped(item)) {
    add2eMagicEffectCataloguePowers(item).forEach((power, index) => {
      const compiled = add2eMagicEffectCompilePower(power);
      if (!compiled) return;
      const data = add2eMagicEffectData(actor, item, power, index, compiled);
      desired.set(data.flags.add2e.magicPowerKey, data);
    });
  }

  const deletes = [];
  const updates = [];
  const existingKeys = new Set();
  for (const effect of existing) {
    const key = String(effect.flags?.add2e?.magicPowerKey ?? "");
    const data = desired.get(key);
    if (!data) {
      deletes.push(effect.id);
      continue;
    }
    existingKeys.add(key);
    if (String(effect.flags?.add2e?.signature ?? "") !== String(data.flags.add2e.signature)) {
      updates.push({ _id: effect.id, ...data });
    }
  }
  const creates = [...desired.entries()]
    .filter(([key]) => !existingKeys.has(key))
    .map(([, data]) => data);

  if (deletes.length) await actor.deleteEmbeddedDocuments("ActiveEffect", deletes, { add2eMagicPowerEffectsAdapter: true });
  if (updates.length) await actor.updateEmbeddedDocuments("ActiveEffect", updates, { add2eMagicPowerEffectsAdapter: true });
  if (creates.length) await actor.createEmbeddedDocuments("ActiveEffect", creates, { add2eMagicPowerEffectsAdapter: true });

  return { ok: true, deleted: deletes.length, updated: updates.length, created: creates.length, desired: desired.size };
}

async function add2eSyncActorMagicItemCatalogueEffects(actor) {
  if (!actor) return { items: 0, created: 0, updated: 0, deleted: 0 };
  const magicItems = Array.from(actor.items ?? []).filter(item => add2eMagicEffectCataloguePowers(item).length > 0);
  const totals = { items: magicItems.length, created: 0, updated: 0, deleted: 0 };
  for (const item of magicItems) {
    const result = await add2eSyncMagicItemCatalogueEffects(item);
    totals.created += Number(result.created) || 0;
    totals.updated += Number(result.updated) || 0;
    totals.deleted += Number(result.deleted) || 0;
  }
  return totals;
}

function add2eMagicEffectPowersEqual(left, right) {
  try { return JSON.stringify(left) === JSON.stringify(right); }
  catch (_error) { return false; }
}

function add2eMagicEffectCleanCreateSource(item) {
  const raw = item?.system?.pouvoirs;
  if (raw === undefined) return;
  const clean = add2eCleanMagicItemCataloguePowersValue(raw);
  if (!add2eMagicEffectPowersEqual(raw, clean)) item.updateSource({ "system.pouvoirs": clean });
}

function add2eMagicEffectCleanUpdateSource(change) {
  const raw = foundry.utils.getProperty(change, "system.pouvoirs");
  if (raw === undefined) return;
  const clean = add2eCleanMagicItemCataloguePowersValue(raw);
  if (!add2eMagicEffectPowersEqual(raw, clean)) foundry.utils.setProperty(change, "system.pouvoirs", clean);
}

function add2eMagicEffectRunForLocalUser(userId) {
  return !userId || String(userId) === String(game.user?.id ?? "");
}

function add2eMagicEffectPrimaryActiveGM() {
  if (!game.user?.isGM) return false;
  const activeGM = game.users?.activeGM
    ?? Array.from(game.users ?? []).find(user => user.active && user.isGM)
    ?? null;
  return !activeGM || String(activeGM.id) === String(game.user.id);
}

async function add2eMagicEffectMigrateExistingItems() {
  if (!add2eMagicEffectPrimaryActiveGM()) return;
  const documents = [
    ...Array.from(game.items ?? []),
    ...Array.from(game.actors ?? []).flatMap(actor => Array.from(actor.items ?? []))
  ];
  for (const item of documents) {
    const raw = item?.system?.pouvoirs;
    if (raw === undefined) continue;
    const clean = add2eCleanMagicItemCataloguePowersValue(raw);
    if (!add2eMagicEffectPowersEqual(raw, clean)) {
      await item.update({ "system.pouvoirs": clean }, { add2eMagicPowerEffectsAdapter: true });
    }
  }
  for (const actor of game.actors ?? []) await add2eSyncActorMagicItemCatalogueEffects(actor);
}

globalThis.ADD2E_MAGIC_POWER_EFFECTS_ADAPTER_VERSION = ADD2E_MAGIC_POWER_EFFECTS_ADAPTER_VERSION;
globalThis.add2eCleanMagicItemCataloguePowers = add2eCleanMagicItemCataloguePowersValue;
globalThis.add2eSyncMagicItemCatalogueEffects = add2eSyncMagicItemCatalogueEffects;
globalThis.add2eSyncActorMagicItemCatalogueEffects = add2eSyncActorMagicItemCatalogueEffects;
globalThis.add2eRemoveMagicItemCatalogueEffects = add2eRemoveMagicItemCatalogueEffects;

Hooks.on("preCreateItem", item => add2eMagicEffectCleanCreateSource(item));
Hooks.on("preUpdateItem", (_item, change, options = {}) => {
  if (options.add2eMagicPowerEffectsAdapter) return;
  add2eMagicEffectCleanUpdateSource(change);
});
Hooks.on("createItem", (item, _options, userId) => {
  if (!add2eMagicEffectRunForLocalUser(userId)) return;
  add2eSyncMagicItemCatalogueEffects(item).catch(error => console.error("[ADD2E][MAGIC_POWER_EFFECTS][CREATE_ITEM]", error));
});
Hooks.on("updateItem", (item, _change, options = {}, userId) => {
  if (options.add2eMagicPowerEffectsAdapter || !add2eMagicEffectRunForLocalUser(userId)) return;
  add2eSyncMagicItemCatalogueEffects(item).catch(error => console.error("[ADD2E][MAGIC_POWER_EFFECTS][UPDATE_ITEM]", error));
});
Hooks.on("deleteItem", (item, _options, userId) => {
  if (!add2eMagicEffectRunForLocalUser(userId)) return;
  add2eRemoveMagicItemCatalogueEffects(item).catch(error => console.error("[ADD2E][MAGIC_POWER_EFFECTS][DELETE_ITEM]", error));
});
Hooks.once("ready", () => {
  game.add2e ??= {};
  game.add2e.magicPowerEffects = {
    version: ADD2E_MAGIC_POWER_EFFECTS_ADAPTER_VERSION,
    cleanPowers: add2eCleanMagicItemCataloguePowersValue,
    syncItem: add2eSyncMagicItemCatalogueEffects,
    syncActor: add2eSyncActorMagicItemCatalogueEffects,
    removeItemEffects: add2eRemoveMagicItemCatalogueEffects
  };
  add2eMagicEffectMigrateExistingItems().catch(error => console.error("[ADD2E][MAGIC_POWER_EFFECTS][READY]", error));
});
