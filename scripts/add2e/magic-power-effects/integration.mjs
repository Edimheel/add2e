// ADD2E — Pouvoirs d'objets magiques / intégration Foundry et API publique.

import {
  VERSION, EFFECT_HANDLERS, INTERNAL_EFFECT_OPTION, INTERNAL_NORMALIZE_OPTION, TIME_SETTING,
  cleanPowers, currentTick, equal, list, norm, number, primaryGM,
  registerEffectHandler, normalizeExecutionResult, resolveExecutionParameters
} from "./runtime.mjs";
import { resolveTargets, resolveRangeAndZone, resolveAffectedTargets, resolveSaves } from "./targeting.mjs";
import { damageAliases, fixedArmorClassRule, rulesOf } from "./rules.mjs";
import { migrateEffects, normalizeEffectDocument, removeItemEffects, syncActor, syncItem } from "./passive-effects.mjs";
import { processPeriodic } from "./periodic-effects.mjs";
import { registerDefaultHandlers } from "./handlers.mjs";
import { enhanceSpellParameterDialog, linkedSpellHandler, spellIndex } from "./spells.mjs";
import { bindSheet, executePower, installEntriesBridge } from "./execution.mjs";

let periodicQueue = Promise.resolve();

function activeEffects(actor) {
  const seen = new Set();
  const result = [];
  for (const effect of [...(actor?.effects?.contents ?? actor?.effects ?? []), ...(actor?.appliedEffects ?? [])]) {
    const key = String(effect?.uuid ?? effect?.id ?? "");
    if (!effect || effect.disabled === true || effect.isSuppressed === true || effect.active === false || !key || seen.has(key)) continue;
    seen.add(key);
    result.push(effect);
  }
  return result;
}

function fixedArmorClassForActor(actor) {
  const candidates = [];
  for (const effect of activeEffects(actor)) {
    for (const rule of rulesOf(effect)) {
      const fixed = fixedArmorClassRule(rule);
      if (!fixed) continue;
      candidates.push({ ...fixed, effect, label: String(rule?.label ?? rule?.name ?? effect.name ?? "CA fixe magique") });
    }
  }
  if (!candidates.length) return null;
  return candidates.sort((left, right) => left.value - right.value)[0];
}

function applyFixedArmorClassToDefense(base, candidate) {
  if (!candidate) return base;
  const currentFixed = number(base?.fixedCA);
  if (Number.isFinite(currentFixed) && currentFixed <= candidate.value) return base;
  const dex = candidate.ignoreDex ? 0 : number(base?.dex) ?? 0;
  const shieldBonus = number(base?.shieldBonus) ?? 0;
  const helmetBonus = number(base?.helmetBonus) ?? 0;
  const objectProtectionBonus = number(base?.objectProtectionBonus) ?? 0;
  const naturalAdjustment = number(base?.effectCaNaturelAdjustment) ?? 0;
  const totalAdjustment = number(base?.effectCaTotalAdjustment) ?? 0;
  const armorLayerCA = candidate.value;
  const caNaturel = armorLayerCA + dex - shieldBonus - helmetBonus + naturalAdjustment;
  const caTotal = caNaturel - objectProtectionBonus + totalAdjustment;
  return {
    ...(base ?? {}),
    fixedCA: candidate.value,
    fixedSource: candidate.label,
    fixedCAActive: true,
    baseAfterFixed: candidate.value,
    armorLayerCA,
    dex,
    ignoredArmorMagicBonus: number(base?.armorMagicBonus) ?? number(base?.ignoredArmorMagicBonus) ?? 0,
    armorMagicBonus: 0,
    caNaturel,
    caTotal,
    syntheticArmorAC: armorLayerCA - objectProtectionBonus,
    magicPowerFixedArmorClass: {
      value: candidate.value,
      ignoreDex: candidate.ignoreDex,
      effectId: candidate.effect?.id ?? null,
      effectName: candidate.effect?.name ?? candidate.label
    }
  };
}

function damageTypeAliases(options = {}) {
  const raw = [options.type, options.details]
    .flatMap(value => String(value ?? "").split(/[,;|/\s]+/g))
    .map(norm).filter(Boolean);
  return [...new Set(raw.flatMap(damageAliases))];
}

function resistancePercentage(tags, aliases) {
  let best = null;
  for (const tag of tags) {
    for (const alias of aliases) {
      const match = String(tag).match(new RegExp(`^resistance:${alias}:([0-9]+(?:\\.[0-9]+)?)$`));
      if (!match) continue;
      let pct = Number(match[1]);
      if (!Number.isFinite(pct)) continue;
      if (pct >= 0 && pct <= 1) pct *= 100;
      pct = Math.max(0, Math.min(100, pct));
      best = best === null ? pct : Math.max(best, pct);
    }
  }
  return best;
}

function installEngineBridge() {
  const engine = globalThis.Add2eEffectsEngine;
  if (!engine || engine.__add2eMagicPowerModularBridge === VERSION) return;
  const originalDefense = typeof engine.getMagicPassiveDefense === "function"
    ? engine.getMagicPassiveDefense.bind(engine)
    : actor => ({ caNaturel: number(actor?.system?.ca_naturel) ?? 10, caTotal: number(actor?.system?.ca_total) ?? 10 });
  const originalDamage = typeof engine.resolveIncomingDamage === "function" ? engine.resolveIncomingDamage.bind(engine) : null;

  engine.getMagicPassiveDefense = function add2eMagicPowerDefense(actor, context = {}) {
    return applyFixedArmorClassToDefense(originalDefense(actor, context), fixedArmorClassForActor(actor));
  };

  if (originalDamage) {
    engine.resolveIncomingDamage = async function add2eMagicPowerIncomingDamage(actor, options = {}) {
      const original = Math.max(0, Number(options.amount) || 0);
      if (!actor || original <= 0) return originalDamage(actor, options);
      const tags = new Set((typeof this.getActiveTags === "function" ? this.getActiveTags(actor) : []).map(norm));
      const aliases = damageTypeAliases(options);
      const immunity = aliases.find(alias => tags.has(`immunite:${alias}`)
        || tags.has(`immunity:${alias}`)
        || tags.has(`immunite:degats:${alias}`)
        || tags.has(`damage_immunity:${alias}`));
      if (immunity) return { amount: 0, applied: true, original, immunity: true, immunityType: immunity, save: null };

      const resolved = await originalDamage(actor, options);
      if (resolved?.applied === true) return resolved;
      const percentage = resistancePercentage(tags, aliases);
      if (!Number.isFinite(percentage) || percentage <= 0) return resolved;
      const reduced = Math.max(0, Math.floor(original * (1 - percentage / 100)));
      return {
        ...(resolved ?? {}),
        amount: reduced,
        applied: true,
        original,
        resistance: true,
        resistancePercentage: percentage,
        resistanceTypes: aliases
      };
    };
  }
  engine.__add2eMagicPowerModularBridge = VERSION;
}

function actorForEffect(effect) {
  const parent = effect?.parent;
  if (parent?.documentName === "Actor") return parent;
  if (parent?.actor?.documentName === "Actor") return parent.actor;
  return null;
}

async function refreshActor(actor) {
  if (!actor || actor.type !== "personnage") return;
  try { await actor.sheet?.autoSetCaracAjustements?.(); } catch (error) {
    console.warn("[ADD2E][MAGIC_POWER_EFFECTS][CARACTERISTICS_REFRESH]", error);
  }
  try { await globalThis.add2eRecalcMoveXp?.(actor, { reason: "magic-power-effect" }); } catch (error) {
    console.warn("[ADD2E][MAGIC_POWER_EFFECTS][MOVEMENT_REFRESH]", error);
  }
  if (actor.sheet?.rendered) actor.sheet.render(false);
}

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
  if (!primaryGM()) return { items: 0, actors: 0, effects: 0 };
  let items = 0;
  let actors = 0;
  let effects = 0;
  const documents = [
    ...Array.from(game.items ?? []),
    ...Array.from(game.actors ?? []).flatMap(actor => Array.from(actor.items ?? []))
  ];
  for (const item of documents) {
    const raw = item?.system?.pouvoirs;
    if (raw === undefined) continue;
    const clean = cleanPowers(raw);
    if (!equal(raw, clean)) {
      await item.update({ "system.pouvoirs": clean }, { [INTERNAL_EFFECT_OPTION]: true });
      items += 1;
    }
  }
  for (const actor of game.actors ?? []) {
    const sync = await syncActor(actor);
    if (sync.created || sync.updated || sync.deleted) actors += 1;
    effects += await migrateEffects(actor);
    await refreshActor(actor);
  }
  return { items, actors, effects };
}

function exposeApi() {
  globalThis.ADD2E_MAGIC_POWER_EFFECTS_ADAPTER_VERSION = VERSION;
  globalThis.add2eCleanMagicItemCataloguePowers = cleanPowers;
  globalThis.add2eSyncMagicItemCatalogueEffects = syncItem;
  globalThis.add2eSyncActorMagicItemCatalogueEffects = syncActor;
  globalThis.add2eRemoveMagicItemCatalogueEffects = removeItemEffects;
  globalThis.add2eProcessMagicItemRegeneration = processPeriodic;
  globalThis.add2eProcessMagicItemPeriodicEffects = processPeriodic;
  globalThis.add2eExecuteMagicCataloguePower = executePower;
  globalThis.add2eMagicPowerSpellIndex = spellIndex;
  globalThis.add2eResolveMagicPowerParameters = resolveExecutionParameters;
  globalThis.add2eResolveMagicPowerTargets = resolveTargets;
  globalThis.add2eResolveMagicPowerRangeAndZone = resolveRangeAndZone;
  globalThis.add2eResolveMagicPowerAffectedTargets = resolveAffectedTargets;
  globalThis.add2eResolveMagicPowerSaves = resolveSaves;
  globalThis.add2eRegisterMagicPowerEffectHandler = registerEffectHandler;
  globalThis.add2eNormalizeMagicPowerExecutionResult = normalizeExecutionResult;
  globalThis.add2eNormalizeMagicPowerEffect = normalizeEffectDocument;
  globalThis.add2eGetMagicPowerFixedArmorClass = fixedArmorClassForActor;
}

registerDefaultHandlers(linkedSpellHandler);
exposeApi();

Hooks.on("preCreateItem", cleanCreate);
Hooks.on("preUpdateItem", (_item, change, options = {}) => {
  if (!options[INTERNAL_EFFECT_OPTION]) cleanUpdate(change);
});
Hooks.on("createItem", (item, _options, userId) => {
  if (localUser(userId)) syncItem(item).catch(error => console.error("[ADD2E][MAGIC_POWER_EFFECTS][CREATE_ITEM]", error));
});
Hooks.on("updateItem", (item, _change, options = {}, userId) => {
  if (!options[INTERNAL_EFFECT_OPTION] && localUser(userId)) {
    syncItem(item).catch(error => console.error("[ADD2E][MAGIC_POWER_EFFECTS][UPDATE_ITEM]", error));
  }
});
Hooks.on("deleteItem", (item, _options, userId) => {
  if (localUser(userId)) removeItemEffects(item).catch(error => console.error("[ADD2E][MAGIC_POWER_EFFECTS][DELETE_ITEM]", error));
});
Hooks.on("createActiveEffect", (effect, _options = {}, userId = null) => {
  if (!localUser(userId)) return;
  normalizeEffectDocument(effect)
    .then(() => refreshActor(actorForEffect(effect)))
    .catch(error => console.error("[ADD2E][MAGIC_POWER_EFFECTS][CREATE_EFFECT]", error));
});
Hooks.on("updateActiveEffect", (effect, _changes = {}, options = {}, userId = null) => {
  if (options[INTERNAL_NORMALIZE_OPTION] || !localUser(userId)) return;
  normalizeEffectDocument(effect)
    .then(() => refreshActor(actorForEffect(effect)))
    .catch(error => console.error("[ADD2E][MAGIC_POWER_EFFECTS][UPDATE_EFFECT]", error));
});
Hooks.on("deleteActiveEffect", effect => {
  refreshActor(actorForEffect(effect)).catch(error => console.error("[ADD2E][MAGIC_POWER_EFFECTS][DELETE_EFFECT]", error));
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
  enhanceSpellParameterDialog(app, html)
    .catch(error => console.error("[ADD2E][MAGIC_POWER_EFFECTS][SPELL_SELECTOR]", error));
});
Hooks.once("ready", () => {
  installEntriesBridge();
  installEngineBridge();
  game.add2e ??= {};
  game.add2e.magicPowerEffects = {
    version: VERSION,
    cleanPowers,
    syncItem,
    syncActor,
    removeItemEffects,
    processRegeneration: processPeriodic,
    processPeriodic,
    executePower,
    spellIndex,
    resolveParameters: resolveExecutionParameters,
    resolveTargets,
    resolveRangeAndZone,
    resolveAffectedTargets,
    resolveSaves,
    registerEffectHandler,
    normalizeExecutionResult,
    normalizeEffect: normalizeEffectDocument,
    fixedArmorClassForActor,
    handlers: EFFECT_HANDLERS
  };
  migrate().catch(error => console.error("[ADD2E][MAGIC_POWER_EFFECTS][READY]", error));
});
