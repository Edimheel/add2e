// ADD2E — Pouvoirs d'objets magiques / orchestration d'exécution et liaison aux feuilles.
// Compatible Foundry V13/V14/V15.

import {
  INTERNAL_ON_USE, cleanPower, currentTick, effectHandler, effectTypes, executionResult, hasValue,
  itemUsable, list, norm, normalizeExecutionResult, number, passivePower, powerArray, powerName
} from "./runtime.mjs";
import { resolveExecutionParameters } from "./runtime.mjs";
import { powerContext, resolveTargets } from "./targeting.mjs";
import { syncItem, findGenerated } from "./passive-effects.mjs";
import { createCard, confirmPower, parameterRows } from "./chat.mjs";
import { linkedPower, linkedSpellEffect } from "./spells.mjs";

const USAGE_FLAG = "magicPowerUsage";
const CONSTRAINT_KEYS = Object.freeze([
  "target", "targetMode", "targetType", "targetAny", "targets", "range", "portee", "area", "zone", "radius",
  "maxTargets", "maxHitDice", "maxTotalHitDice", "frequency", "frequence", "frequencyPerTarget"
]);
const ANY_TARGETS = new Set(["all", "any", "creature", "creatures", "tous", "tout", "cible", "targets"]);
const HUMANS = new Set(["human", "humain", "humaine", "humains", "humaines"]);
const HUMANOIDS = new Set([
  "humanoid", "humanoide", "humanoides", "human", "humain", "humaine", "humains", "humaines",
  "dwarf", "nain", "naine", "elf", "elfe", "gnome", "halfling", "petite_gens", "petite-gens",
  "half_elf", "half-elf", "demi_elfe", "demi-elfe", "half_orc", "half-orc", "demi_orque", "demi-orque",
  "orc", "orque", "goblin", "gobelin", "hobgoblin", "hobgobelin", "bugbear", "gobelours", "kobold",
  "gnoll", "ogre", "troll", "lizardman", "lizardfolk", "homme_lezard", "homme-lezard"
]);

function constraintSources(power) {
  const effects = Array.isArray(power?.effects) ? power.effects : [];
  const constrained = effects.filter(effect => CONSTRAINT_KEYS.some(key => hasValue(effect?.[key])));
  return constrained.length ? constrained : [{}];
}

function usageKey(power, index) {
  return norm(power?.catalogueId ?? power?.id ?? power?.name ?? `power_${index}`) || `power_${index}`;
}

function actorTags(actor) {
  const tags = new Set();
  const push = value => {
    for (const raw of list(value)) {
      const tag = norm(raw);
      if (!tag) continue;
      tags.add(tag);
      for (const separator of [":", "/"]) {
        const parts = tag.split(separator).filter(Boolean);
        parts.forEach(part => tags.add(part));
      }
    }
  };
  try { push(globalThis.Add2eEffectsEngine?.getActiveTags?.(actor)); } catch (_error) {}
  push(actor?.type);
  push(actor?.flags?.add2e?.tags);
  push(actor?.flags?.add2e?.effectTags);
  const system = actor?.system ?? {};
  for (const value of [
    system.race, system.espece, system.espèce, system.creatureType, system.creature_type,
    system.typeCreature, system.type_creature, system.category, system.categorie,
    system.details?.race, system.details?.type, system.details?.creatureType,
    system.tags, system.effectTags
  ]) push(value);
  for (const effect of actor?.effects ?? []) {
    if (effect?.disabled === true) continue;
    push(effect?.flags?.add2e?.tags);
    push(effect?.flags?.add2e?.effectTags);
  }
  return tags;
}

function targetMatches(actor, requirement) {
  const wanted = norm(requirement);
  if (!wanted || ANY_TARGETS.has(wanted)) return true;
  const tags = actorTags(actor);
  if (tags.has(wanted)) return true;
  if (HUMANS.has(wanted)) return [...HUMANS].some(tag => tags.has(tag));
  if (["humanoid", "humanoide", "humanoides"].includes(wanted)) {
    if ([...HUMANOIDS].some(tag => tags.has(tag))) return true;
    return ["character", "personnage", "pj", "pnj"].includes(norm(actor?.type));
  }
  return false;
}

function actorLevel(actor) {
  const system = actor?.system ?? {};
  const direct = number(system.niveau, system.level, system.details?.niveau, system.details?.level);
  if (Number.isFinite(direct) && direct > 0) return Math.max(1, Math.floor(direct));
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine;
  try {
    const levels = (engine?.getEmbeddedClassItems?.(actor) ?? [])
      .map(item => Number(engine?.getEmbeddedClassLevel?.(item)))
      .filter(value => Number.isFinite(value) && value > 0);
    if (levels.length) return Math.max(...levels.map(Math.floor));
  } catch (_error) {}
  return 1;
}

function actorHitDice(actor) {
  const system = actor?.system ?? {};
  for (const raw of [
    system.hitDice, system.hit_dice, system.dv, system.hd,
    system.details?.hitDice, system.details?.hit_dice, system.details?.dv,
    system.niveau, system.level, system.details?.niveau, system.details?.level
  ]) {
    if (raw === undefined || raw === null || raw === "") continue;
    const direct = Number(raw);
    if (Number.isFinite(direct) && direct > 0) return Math.max(1, Math.floor(direct));
    const match = String(raw).match(/\d+(?:[.,]\d+)?/);
    if (match) return Math.max(1, Math.floor(Number(match[0].replace(",", "."))));
  }
  return actorLevel(actor);
}

async function evaluateLimit(raw, actor) {
  if (!hasValue(raw)) return null;
  const source = raw && typeof raw === "object" && !Array.isArray(raw)
    ? raw.formula ?? raw.value ?? raw.amount ?? raw.max ?? raw.total
    : raw;
  const direct = Number(source);
  if (Number.isFinite(direct)) return Math.max(0, Math.floor(direct));
  const formula = String(source ?? "").trim();
  if (!formula) return null;
  try {
    const level = actorLevel(actor);
    const roll = new Roll(formula.replace(/@niveau\b/gi, "@level"), { level, niveau: level });
    await roll.evaluate();
    return Number.isFinite(Number(roll.total)) ? Math.max(0, Math.floor(Number(roll.total))) : null;
  } catch (_error) {
    return null;
  }
}

function frequencySpec(raw, perTarget = false) {
  if (!hasValue(raw)) return null;
  let value = 1;
  let unit = "round";
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    value = number(raw.value, raw.amount, raw.count, raw.every, raw.interval) ?? 1;
    unit = norm(raw.unit ?? raw.units ?? raw.type ?? raw.period ?? raw.per ?? "round");
  } else {
    const text = norm(raw);
    const match = text.match(/(\d+(?:[.,]\d+)?)/);
    value = match ? Number(match[1].replace(",", ".")) : 1;
    if (/day|jour|daily|quotid/.test(text)) unit = "day";
    else if (/hour|heure/.test(text)) unit = "hour";
    else if (/turn|tour/.test(text)) unit = "turn";
    else if (/minute|min/.test(text)) unit = "minute";
    else if (/round|ronde/.test(text)) unit = "round";
  }
  const factors = { round: 1, rounds: 1, minute: 1, minutes: 1, turn: 10, turns: 10, tour: 10, tours: 10,
    hour: 60, hours: 60, heure: 60, heures: 60, day: 1440, days: 1440, jour: 1440, jours: 1440 };
  const factor = factors[unit] ?? 1;
  const rounds = Math.max(1, Math.floor((Number(value) || 1) * factor));
  return { raw, value: Number(value) || 1, unit, rounds, perTarget };
}

function usageStamp() {
  return {
    tick: currentTick(),
    combatId: game.combat?.id ?? null,
    round: Number.isFinite(Number(game.combat?.round)) ? Number(game.combat.round) : null,
    turn: Number.isFinite(Number(game.combat?.turn)) ? Number(game.combat.turn) : null,
    worldTime: Number.isFinite(Number(game.time?.worldTime)) ? Number(game.time.worldTime) : null
  };
}

function elapsedRounds(previous, current) {
  if (!previous) return Infinity;
  if (previous.combatId && current.combatId && previous.combatId === current.combatId
    && Number.isFinite(previous.round) && Number.isFinite(current.round)) {
    return Math.max(0, current.round - previous.round);
  }
  if (Number.isFinite(previous.tick) && Number.isFinite(current.tick)) return Math.max(0, current.tick - previous.tick);
  return 0;
}

function cloneUsage(value) {
  try { return foundry.utils.deepClone(value ?? {}); }
  catch (_error) { return JSON.parse(JSON.stringify(value ?? {})); }
}

function frequencyMessage(spec, remaining) {
  const label = spec.unit === "day" || spec.unit === "jour" ? "jour"
    : spec.unit === "hour" || spec.unit === "heure" ? "heure"
      : spec.unit === "turn" || spec.unit === "tour" ? "tour"
        : "round";
  return `Ce pouvoir est limité à une utilisation par ${label}. Il sera de nouveau disponible dans ${remaining} round(s) ADD2E.`;
}

async function validateConstraints(actor, item, power, index, sheet) {
  const usage = { global: null, perTarget: null, targets: [] };
  const checkedActors = new Map();
  for (const effect of constraintSources(power)) {
    const parameters = resolveExecutionParameters(power, effect);
    const context = powerContext(actor, item, power, index, effect, sheet);
    const constrainedTarget = [
      parameters.target, parameters.targetAny, parameters.maxTargets, parameters.maxHitDice,
      parameters.maxTotalHitDice, parameters.range, parameters.area, parameters.radius
    ].some(hasValue);
    if ((context.targets?.required || constrainedTarget) && !context.targets?.actors?.length) {
      ui.notifications.warn("Sélectionnez au moins une cible pour ce pouvoir.");
      return { ok: false, reason: "target-required", usage };
    }
    if (context.rangeZone && !context.rangeZone.ok) {
      const names = context.rangeZone.outOfRange?.map(entry => entry.actor?.name).filter(Boolean).join(", ");
      ui.notifications.warn(names ? `Cible(s) hors de portée : ${names}.` : "Une cible du pouvoir est hors de portée.");
      return { ok: false, reason: "target-out-of-range", usage };
    }
    const targets = context.targets?.actors ?? [];
    targets.forEach(target => checkedActors.set(String(target.uuid ?? target.id), target));

    const requiredCategories = list(parameters.targetAny ?? effect.targetAny ?? effect.targets).map(norm).filter(Boolean);
    if (requiredCategories.length) {
      const rejected = targets.filter(target => !requiredCategories.some(category => targetMatches(target, category)));
      if (rejected.length) {
        ui.notifications.warn(`Cible(s) incompatible(s) avec ce pouvoir : ${rejected.map(target => target.name).join(", ")}.`);
        return { ok: false, reason: "target-category-mismatch", usage };
      }
    }

    const maxTargets = await evaluateLimit(parameters.maxTargets ?? effect.maxTargets, actor);
    if (Number.isFinite(maxTargets) && targets.length > maxTargets) {
      ui.notifications.warn(`Ce pouvoir accepte au maximum ${maxTargets} cible(s).`);
      return { ok: false, reason: "too-many-targets", usage };
    }

    const maxHitDice = await evaluateLimit(parameters.maxHitDice ?? effect.maxHitDice, actor);
    if (Number.isFinite(maxHitDice)) {
      const rejected = targets.filter(target => actorHitDice(target) > maxHitDice);
      if (rejected.length) {
        ui.notifications.warn(`Dés de vie/niveaux trop élevés : ${rejected.map(target => `${target.name} (${actorHitDice(target)})`).join(", ")} — maximum ${maxHitDice}.`);
        return { ok: false, reason: "target-hit-dice-too-high", usage };
      }
    }

    const maxTotalHitDice = await evaluateLimit(parameters.maxTotalHitDice ?? effect.maxTotalHitDice, actor);
    if (Number.isFinite(maxTotalHitDice)) {
      const total = targets.reduce((sum, target) => sum + actorHitDice(target), 0);
      if (total > maxTotalHitDice) {
        ui.notifications.warn(`Le total des dés de vie/niveaux ciblés est de ${total}, pour un maximum de ${maxTotalHitDice}.`);
        return { ok: false, reason: "target-hit-dice-pool-exceeded", usage };
      }
    }

    usage.global ??= frequencySpec(parameters.frequency ?? effect.frequency, false);
    usage.perTarget ??= frequencySpec(parameters.frequencyPerTarget ?? effect.frequencyPerTarget, true);
  }
  usage.targets = [...checkedActors.values()];

  const state = item.getFlag?.("add2e", USAGE_FLAG) ?? {};
  const entry = state?.[usageKey(power, index)] ?? {};
  const stamp = usageStamp();
  if (usage.global && entry.global) {
    const elapsed = elapsedRounds(entry.global, stamp);
    if (elapsed < usage.global.rounds) {
      ui.notifications.warn(frequencyMessage(usage.global, usage.global.rounds - elapsed));
      return { ok: false, reason: "frequency-global", usage };
    }
  }
  if (usage.perTarget) {
    const blocked = usage.targets.filter(target => {
      const previous = entry.targets?.[String(target.uuid ?? target.id)];
      return previous && elapsedRounds(previous, stamp) < usage.perTarget.rounds;
    });
    if (blocked.length) {
      ui.notifications.warn(`Fréquence par cible non écoulée pour : ${blocked.map(target => target.name).join(", ")}.`);
      return { ok: false, reason: "frequency-per-target", usage };
    }
  }
  return { ok: true, usage };
}

async function recordUsage(item, power, index, usage) {
  if (!usage?.global && !usage?.perTarget) return;
  const state = cloneUsage(item.getFlag?.("add2e", USAGE_FLAG) ?? {});
  const key = usageKey(power, index);
  const entry = state[key] && typeof state[key] === "object" ? state[key] : {};
  const stamp = usageStamp();
  if (usage.global) entry.global = stamp;
  if (usage.perTarget) {
    entry.targets = entry.targets && typeof entry.targets === "object" ? entry.targets : {};
    for (const target of usage.targets ?? []) entry.targets[String(target.uuid ?? target.id)] = stamp;
  }
  entry.updatedAt = stamp;
  state[key] = entry;
  await item.setFlag("add2e", USAGE_FLAG, state);
}

async function assisted(actor, item, power, unresolvedTypes = []) {
  const targets = resolveTargets(actor, power, {}, resolveExecutionParameters(power, {})).actors;
  await createCard(actor, item, power, {
    variant: "ability",
    rows: parameterRows(power),
    message: "Résolution assistée : appliquez les choix, jets, sauvegardes ou conséquences indiqués par le pouvoir et sa source.",
    targets
  });
  return executionResult("assisted", { ok: true, handled: "assisted", complete: false, unresolvedTypes, targets });
}

function powerCost(power) {
  const linked = linkedSpellEffect(power);
  const value = Number(power?.cout ?? power?.cost ?? power?.chargeCost ?? power?.parameters?.chargeCost ?? linked?.chargeCost);
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

async function executeRegisteredEffects(actor, item, power, index, sheet = null) {
  const results = [];
  const unresolvedTypes = [];
  for (const effect of power.effects ?? []) {
    const type = norm(effect?.type ?? effect?.kind ?? effect?.category);
    const handler = effectHandler(type);
    if (!handler) {
      if (type) unresolvedTypes.push(type);
      continue;
    }
    const result = normalizeExecutionResult(await handler(powerContext(actor, item, power, index, effect, sheet)), {
      handled: type,
      complete: true
    });
    results.push(result);
    if (result.status === "cancelled" || (result.ok === false && result.status === "failed")) break;
  }
  const successes = results.filter(result => result.ok && result.status !== "assisted");
  const cancelled = results.find(result => result.status === "cancelled");
  const failed = results.find(result => result.status === "failed" && !result.ok);
  if (cancelled) return executionResult("cancelled", { ...cancelled, results, unresolvedTypes, consumeCharges: false });
  if (failed && !successes.length) return executionResult("failed", { ...failed, results, unresolvedTypes, consumeCharges: false });
  if (successes.length) {
    return executionResult("success", {
      ok: true,
      handled: successes.map(result => result.handled).filter(Boolean).join(","),
      complete: unresolvedTypes.length === 0 && results.every(result => result.complete !== false),
      chargesManaged: results.some(result => result.chargesManaged === true),
      consumeCharges: results.every(result => result.consumeCharges !== false),
      results,
      unresolvedTypes
    });
  }
  if (results.some(result => result.status === "assisted")) return executionResult("assisted", { ok: false, complete: false, results, unresolvedTypes });
  return executionResult("skipped", { ok: false, complete: false, results, unresolvedTypes });
}

export async function executePower(actor, item, power, index = 0, sheet = null) {
  if (!actor || !item || power?.kind !== "catalogue") {
    ui.notifications.error("Pouvoir du catalogue introuvable.");
    return false;
  }
  if (!itemUsable(item)) {
    ui.notifications.warn(`${item.name} doit être équipé ou utilisable.`);
    return false;
  }
  const clean = cleanPower(power);
  const preflight = await validateConstraints(actor, item, clean, index, sheet);
  if (!preflight.ok) return false;
  if (!await confirmPower(actor, item, clean)) return false;
  const linked = !!linkedSpellEffect(clean);
  const cost = powerCost(clean);
  const current = linked ? 0 : Number(globalThis.add2eObjectPowerCurrentCharges?.(item, clean, index)) || 0;
  if (!linked && cost > 0 && current < cost) {
    ui.notifications.warn(`${item.name} n'a pas assez de charges.`);
    return false;
  }
  try {
    let result;
    if (passivePower(clean)) {
      await syncItem(item);
      await createCard(actor, item, clean, {
        title: "Pouvoir passif",
        rows: parameterRows(clean),
        message: "Ce pouvoir est appliqué automatiquement par l'ActiveEffect lié à l'objet."
      });
      result = executionResult("success", { handled: "passive" });
    } else {
      result = normalizeExecutionResult(await linkedPower(actor, item, clean, index));
      if (result.status === "skipped") result = await executeRegisteredEffects(actor, item, clean, index, sheet);
      if (result.status === "cancelled") return false;
      if (linked && !result.ok) return false;
      if (!result.ok) result = await assisted(actor, item, clean, result.unresolvedTypes ?? effectTypes(clean));
    }
    if (result.ok && cost > 0 && result.chargesManaged !== true && result.consumeCharges !== false) {
      await globalThis.add2eObjectPowerSetCharges?.(item, clean, index, current - cost);
    }
    if (result.ok) {
      await recordUsage(item, clean, index, preflight.usage);
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

export function installEntriesBridge() {
  if (globalThis.__add2eMagicCatalogueEntriesBridgeV4) return;
  globalThis.__add2eMagicCatalogueEntriesBridgeV4 = true;
  const original = globalThis.add2eMagicObjectActivePowerEntries;
  globalThis.add2eMagicObjectActivePowerEntries = item => {
    const rows = typeof original === "function" ? [...(original(item) ?? [])] : [];
    const indexes = new Set(rows.map(entry => Number(entry?.index)).filter(Number.isFinite));
    powerArray(item).forEach((power, index) => {
      if (power.kind !== "catalogue" || indexes.has(index)) return;
      const presented = foundry.utils.deepClone(power);
      presented.onUse ||= INTERNAL_ON_USE;
      presented.onuse ||= presented.onUse;
      presented.on_use ||= presented.onUse;
      rows.push({ power: presented, index });
    });
    return rows.sort((left, right) => Number(left.index) - Number(right.index));
  };
}

function rootOf(app, html) {
  return html instanceof HTMLElement ? html
    : html?.[0] instanceof HTMLElement ? html[0]
      : app?.element instanceof HTMLElement ? app.element
        : app?.element?.[0] instanceof HTMLElement ? app.element[0] : null;
}

export function bindSheet(app, html) {
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
