// ADD2E — Pouvoirs d'objets magiques / intégration Foundry et API publique.

import {
  VERSION, EFFECT_HANDLERS, INTERNAL_EFFECT_OPTION, INTERNAL_NORMALIZE_OPTION, TIME_SETTING,
  cleanPowers, currentTick, equal, list, norm, number, primaryGM,
  registerEffectHandler, normalizeExecutionResult, resolveExecutionParameters
} from "./runtime.mjs";
import { resolveTargets, resolveRangeAndZone, resolveAffectedTargets, resolveSaves } from "./targeting.mjs";
import { canonicalAbility, damageAliases, fixedArmorClassRule, rulesOf } from "./rules.mjs";
import { migrateEffects, normalizeEffectDocument, removeItemEffects, syncActor, syncItem } from "./passive-effects.mjs";
import { processPeriodic } from "./periodic-effects.mjs";
import { registerDefaultHandlers } from "./handlers.mjs";
import { enhanceSpellParameterDialog, linkedSpellHandler, spellIndex } from "./spells.mjs";
import { bindSheet, executePower, installEntriesBridge } from "./execution.mjs";

let periodicQueue = Promise.resolve();

const CHARACTERISTICS = Object.freeze([
  "force", "dexterite", "constitution", "intelligence", "sagesse", "charisme"
]);
const CHARACTERISTIC_BRIDGE_VERSION = `${VERSION}-characteristics-v1`;

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

function sourceSystem(actor) {
  return actor?._source?.system ?? actor?.system ?? {};
}

function naturalCharacteristic(actor, ability) {
  const source = sourceSystem(actor);
  const base = number(source?.[`${ability}_base`], source?.[ability]) ?? 10;
  const racialBonuses = source?.bonus_caracteristiques && typeof source.bonus_caracteristiques === "object"
    ? source.bonus_caracteristiques
    : {};
  const hasRacialBonus = Object.prototype.hasOwnProperty.call(racialBonuses, ability);
  const racial = hasRacialBonus
    ? number(racialBonuses[ability]) ?? 0
    : number(source?.[`${ability}_race`]) ?? 0;
  const diverse = number(source?.bonus_divers_caracteristiques?.[ability]) ?? 0;
  return {
    base,
    racial,
    diverse,
    natural: base + racial + diverse
  };
}

function characteristicRulesForActor(actor) {
  const entries = [];
  let sequence = 0;
  for (const effect of activeEffects(actor)) {
    for (const rule of rulesOf(effect)) {
      const kind = norm(rule?.kind);
      if (!["characteristic_bonus", "characteristic_override"].includes(kind)) continue;
      const characteristic = canonicalAbility(rule?.characteristic ?? rule?.ability ?? rule?.stat ?? rule?.attribute);
      const value = number(rule?.value, rule?.amount, rule?.bonus, rule?.modifier, rule?.score);
      if (!characteristic || !Number.isFinite(value)) continue;
      entries.push({
        characteristic,
        operation: kind === "characteristic_override" ? "override" : "add",
        value,
        priority: Math.max(1, Math.floor(number(rule?.priority) ?? 100)),
        sequence: sequence++,
        effectId: effect.id ?? null,
        effectName: effect.name ?? "Effet magique",
        rule
      });
    }
  }
  return entries.sort((left, right) => left.priority - right.priority || left.sequence - right.sequence);
}

function resolveMagicCharacteristics(actor) {
  const rules = characteristicRulesForActor(actor);
  const result = {};
  for (const ability of CHARACTERISTICS) {
    const natural = naturalCharacteristic(actor, ability);
    const applied = [];
    let effective = natural.natural;
    for (const rule of rules) {
      if (rule.characteristic !== ability) continue;
      const before = effective;
      effective = rule.operation === "override" ? rule.value : effective + rule.value;
      applied.push({ ...rule, before, after: effective });
    }
    result[ability] = {
      ability,
      ...natural,
      effective,
      modifier: effective - natural.natural,
      active: applied.length > 0,
      rules: applied
    };
  }
  return result;
}

function effectiveCharacteristic(actor, ability) {
  const key = canonicalAbility(ability);
  if (!key) return null;
  return resolveMagicCharacteristics(actor)[key]?.effective ?? null;
}

function tableEntry(name, key, fallback) {
  const table = globalThis?.[name];
  const entry = table?.[key];
  return entry && typeof entry === "object" ? entry : fallback;
}

function valuesEqual(left, right) {
  if (left === right) return true;
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) return leftNumber === rightNumber;
  return false;
}

function installCharacteristicBridge() {
  const Sheet = globalThis.Add2eActorSheet;
  if (!Sheet?.prototype || Sheet.prototype.__add2eMagicCharacteristicBridge === CHARACTERISTIC_BRIDGE_VERSION) return;
  const original = Sheet.prototype.autoSetCaracAjustements;

  Sheet.prototype.autoSetCaracAjustements = async function add2eMagicCharacteristicRecalculation() {
    if (!this.actor?.system) return;
    if (this.actor.type !== "personnage") {
      if (typeof original === "function") return original.call(this);
      return;
    }
    if (this._autoSetCaracsInProgress) return;
    this._autoSetCaracsInProgress = true;
    try {
      const source = sourceSystem(this.actor);
      const baseUpdates = {};
      for (const ability of CHARACTERISTICS) {
        const currentBase = number(source?.[`${ability}_base`]);
        if (!Number.isFinite(currentBase)) {
          baseUpdates[`system.${ability}_base`] = number(source?.[ability]) ?? 10;
        }
      }
      if (Object.keys(baseUpdates).length) {
        await this.actor.update(baseUpdates, {
          add2eInternal: true,
          add2eReason: "magic-characteristics-initialize-base",
          render: false
        });
      }

      const details = resolveMagicCharacteristics(this.actor);
      const totals = Object.fromEntries(CHARACTERISTICS.map(ability => [ability, details[ability].effective]));
      const allowExceptional = globalThis.add2eActorCanUseExceptionalStrength?.(this.actor) === true;
      const forceEx = Number(this.actor.system?.force_ex ?? source?.force_ex ?? 0) || 0;
      let forceKey = totals.force;
      if (totals.force === 18 && allowExceptional) {
        if (forceEx >= 1 && forceEx <= 50) forceKey = "18/01-50";
        else if (forceEx >= 51 && forceEx <= 75) forceKey = "18/51-75";
        else if (forceEx >= 76 && forceEx <= 90) forceKey = "18/76-90";
        else if (forceEx >= 91 && forceEx <= 99) forceKey = "18/91-99";
        else if (forceEx === 100) forceKey = "18/00";
      }

      const forceBonus = tableEntry("FORCE_TABLE", forceKey, { toucher: 0, degats: 0, poids: 0, ouvrir: "—", tordre: "—" });
      const dexBonus = tableEntry("DEXTERITE_TABLE", totals.dexterite, { att: 0, def: 0 });
      const conBonus = tableEntry("CONSTITUTION_TABLE", totals.constitution, { pv: 0, trauma: 0, resu: 0 });
      const intBonus = tableEntry("INTELLIGENCE_TABLE", totals.intelligence, { langues: 0, chance_sort: 0, min_sort: 0, max_sort: 0, sort_par_niveau: 0 });
      const sagBonus = tableEntry("SAGESSE_TABLE", totals.sagesse, { magie: 0, sort_suppl: 0, echec: 0 });
      const chaBonus = tableEntry("CHARISME_TABLE", totals.charisme, { compagnons: 0, loy: 0, react: 0 });

      const fullUpdate = {
        "system.force": totals.force,
        "system.dexterite": totals.dexterite,
        "system.constitution": totals.constitution,
        "system.intelligence": totals.intelligence,
        "system.sagesse": totals.sagesse,
        "system.charisme": totals.charisme,
        "system.for_aff": totals.force,
        "system.dex_aff": totals.dexterite,
        "system.con_aff": totals.constitution,
        "system.int_aff": totals.intelligence,
        "system.sag_aff": totals.sagesse,
        "system.cha_aff": totals.charisme,
        "system.force_bonus_toucher": Number(forceBonus.toucher || 0),
        "system.force_bonus_degats": Number(forceBonus.degats || 0),
        "system.force_poids": forceBonus.poids ?? 0,
        "system.force_ouvrir": forceBonus.ouvrir ?? "—",
        "system.force_tordre": forceBonus.tordre ?? "—",
        "system.force_bonus_porte": forceBonus.ouvrir ?? "—",
        "system.charge_max": typeof forceBonus.poids === "number" ? forceBonus.poids : 0,
        "system.charge_max_bench": typeof forceBonus.poids === "number" ? forceBonus.poids : 0,
        "system.dex_att": Number(dexBonus.att || 0),
        "system.dex_def": Number(dexBonus.def || 0),
        "system.con_pv": Number(conBonus.pv || 0),
        "system.con_trauma": Number(conBonus.trauma || 0),
        "system.con_resu": Number(conBonus.resu || 0),
        "system.int_langues": Number(intBonus.langues || 0),
        "system.int_chance_sort": Number(intBonus.chance_sort || 0),
        "system.int_min_sort": Number(intBonus.min_sort || 0),
        "system.int_max_sort": Number(intBonus.max_sort || 0),
        "system.int_sort_par_niveau": Number(intBonus.sort_par_niveau || 0),
        "system.sag_magie": Number(sagBonus.magie || 0),
        "system.sag_sort_suppl": Number(sagBonus.sort_suppl || 0),
        "system.sag_echec": Number(sagBonus.echec || 0),
        "system.cha_compagnons": Number(chaBonus.compagnons || 0),
        "system.cha_loy": Number(chaBonus.loy || 0),
        "system.cha_react": Number(chaBonus.react || 0)
      };

      const sourceDocument = this.actor?._source ?? this.actor;
      const diff = {};
      for (const [path, value] of Object.entries(fullUpdate)) {
        const current = foundry.utils.getProperty(sourceDocument, path);
        if (!valuesEqual(current, value)) diff[path] = value;
      }
      if (Object.keys(diff).length) {
        await this.actor.update(diff, {
          add2eInternal: true,
          add2eReason: "magic-characteristics-recalculate",
          render: false
        });
      }
      if (typeof this.autoSetPointsDeCoup === "function") await this.autoSetPointsDeCoup();
    } catch (error) {
      console.error("[ADD2E][MAGIC_POWER_EFFECTS][CHARACTERISTICS]", error);
      this._autoSetCaracsInProgress = false;
      if (typeof original === "function") {
        try { await original.call(this); } catch (_fallbackError) {}
      }
    } finally {
      this._autoSetCaracsInProgress = false;
    }
  };

  Sheet.prototype.autoSetCaracAjustements.__add2eBaseFunction = original;
  Sheet.prototype.__add2eMagicCharacteristicBridge = CHARACTERISTIC_BRIDGE_VERSION;
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
  if (!engine) return;
  engine.getMagicCharacteristicDetails = resolveMagicCharacteristics;
  engine.getEffectiveCharacteristic = effectiveCharacteristic;
  if (engine.__add2eMagicPowerModularBridge === VERSION) return;
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

function installSheetBridge() {
  const Sheet = globalThis.Add2eActorSheet;
  if (!Sheet?.prototype || Sheet.prototype.__add2eMagicPowerModularSheet === VERSION) return;
  const originalGetData = Sheet.prototype.getData;
  Sheet.prototype.getData = async function add2eMagicPowerSheetData(...args) {
    const data = await originalGetData.apply(this, args);
    try {
      if (this.actor?.type !== "personnage") return data;
      installEngineBridge();
      const characteristics = resolveMagicCharacteristics(this.actor);
      data.magicCharacteristics = characteristics;
      for (const ability of CHARACTERISTICS) {
        const effective = characteristics[ability].effective;
        if (data.actor?.system) data.actor.system[ability] = effective;
        if (data.system) data.system[ability] = effective;
      }

      const defense = globalThis.Add2eEffectsEngine?.getMagicPassiveDefense?.(this.actor, { source: "magic-power-effects" });
      if (defense) {
        data.combatDefense ??= {};
        data.combatDefense.ac_naturelle = defense.caNaturel;
        data.combatDefense.ac_totale = defense.caTotal;
        data.combatDefense.objets_magiques_defense = defense;
        if (defense.fixedCAActive) data.combatDefense.armure = `${defense.fixedSource} <small style="color:#7f704d;">(CA fixe, armure ignorée)</small>`;
      }
    } catch (error) {
      console.warn("[ADD2E][MAGIC_POWER_EFFECTS][SHEET]", error);
    }
    return data;
  };
  Sheet.prototype.__add2eMagicPowerModularSheet = VERSION;
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
  globalThis.add2eGetMagicCharacteristicRules = characteristicRulesForActor;
  globalThis.add2eResolveMagicCharacteristics = resolveMagicCharacteristics;
  globalThis.add2eGetEffectiveCharacteristic = effectiveCharacteristic;
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
  installCharacteristicBridge();
  installEngineBridge();
  installSheetBridge();
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
    characteristicRulesForActor,
    resolveMagicCharacteristics,
    effectiveCharacteristic,
    handlers: EFFECT_HANDLERS
  };
  migrate().catch(error => console.error("[ADD2E][MAGIC_POWER_EFFECTS][READY]", error));
});
