// ADD2E — Pouvoirs d'objets magiques / gestionnaires d'effets actifs.

import {
  clone, durationParts, executionResult, hp, list, norm, number, powerName,
  registerEffectHandler, toRounds
} from "./runtime.mjs";
import { resolveAffectedTargets, resolveSaves, selectedTokens } from "./targeting.mjs";
import { compileDefinition, compiledFromRules, uniqueChanges, uniqueTags } from "./rules.mjs";
import { createCard, evaluate } from "./chat.mjs";

function saveResultFor(saveResolution, actor) {
  return saveResolution?.results?.find(result => String(result.actor?.id) === String(actor?.id)) ?? null;
}

function actorEffectTags(actor) {
  const tags = new Set([
    ...list(actor?.flags?.add2e?.tags),
    ...list(actor?.flags?.add2e?.effectTags)
  ].map(norm).filter(Boolean));
  for (const effect of actor?.effects ?? []) {
    if (effect.disabled) continue;
    for (const value of [effect.name, ...list(effect.flags?.add2e?.tags), ...list(effect.flags?.add2e?.effectTags)]) {
      const tag = norm(value);
      if (tag) tags.add(tag);
    }
  }
  return tags;
}

const CONDITION_SPECS = Object.freeze({
  fear: {
    label: "Peur",
    aliases: ["fear", "peur", "frightened", "frighten", "terror", "terreur"],
    tags: ["etat:peur", "peur", "fuite"],
    rules: [{ type: "state_condition", condition: "fear" }]
  },
  paralysis: {
    label: "Paralysie",
    aliases: ["paralysis", "paralysie", "paralyse", "paralyzed", "immobilization", "immobilisation"],
    tags: ["etat:paralysie", "paralysie", "paralyse", "immobilise"],
    rules: [{ type: "block_action", actions: ["move", "attack", "cast", "use-item"] }]
  },
  poison: {
    label: "Poison",
    aliases: ["poison", "poisoning", "poisoned", "empoisonnement", "empoisonne"],
    tags: ["etat:poison", "poison", "empoisonne"],
    rules: [{ type: "state_condition", condition: "poison" }]
  },
  slow: {
    label: "Ralentissement",
    aliases: ["slow", "slowing", "slowed", "ralentissement", "ralenti"],
    tags: ["etat:ralentissement", "ralentissement", "ralenti"],
    rules: [{ type: "state_condition", condition: "slow" }]
  },
  stun: {
    label: "Étourdissement",
    aliases: ["stun", "stunned", "area_stun_on_hit", "zone_stun", "etourdissement", "etourdi"],
    tags: ["etat:etourdissement", "etourdissement", "etourdi"],
    rules: [{ type: "block_action", actions: ["move", "attack", "cast", "use-item"] }]
  },
  control: {
    label: "Contrôle",
    aliases: ["control", "control_creature", "creature_control", "domination", "domination_aura", "suggestion", "charm_control"],
    tags: ["etat:controle", "controle", "domination"],
    rules: [{ type: "state_condition", condition: "controlled" }]
  }
});

function conditionSpec(type) {
  const wanted = norm(type);
  for (const [canonical, spec] of Object.entries(CONDITION_SPECS)) {
    if (canonical === wanted || spec.aliases.includes(wanted)) return { canonical, ...spec };
  }
  return { canonical: wanted, label: type || "État", aliases: [wanted], tags: [`etat:${wanted}`], rules: [] };
}

function targetImmuneToCondition(target, spec) {
  const tags = actorEffectTags(target);
  const aliases = [...new Set([spec.canonical, ...spec.aliases].map(norm).filter(Boolean))];
  return aliases.some(alias => tags.has(`immunite:${alias}`)
    || tags.has(`immunity:${alias}`)
    || tags.has(`immunite:condition:${alias}`)
    || tags.has(`condition_immunity:${alias}`))
    || tags.has("immunite:condition") || tags.has("condition_immunity:any");
}

export function powerDuration(power, effect) {
  for (const value of [
    effect?.duration,
    effect?.duree,
    effect?.rounds != null ? { value: effect.rounds, unit: "round" } : null,
    effect?.turns != null ? { value: effect.turns, unit: "turn" } : null,
    effect?.durationRounds != null ? { value: effect.durationRounds, unit: "round" } : null,
    power?.parameters?.duration,
    power?.parameters?.rounds != null ? { value: power.parameters.rounds, unit: "round" } : null
  ]) {
    const parts = durationParts(value);
    if (parts) return parts;
  }
  return null;
}

function conditionRules(spec, effect, actor, parameters) {
  const rules = [...spec.rules.map(clone)];
  if (spec.canonical === "slow") {
    const movement = number(parameters.movementMultiplier, parameters.speedMultiplier, effect.movementMultiplier, effect.speedMultiplier);
    const attacks = number(parameters.attackMultiplier, parameters.attacksMultiplier, effect.attackMultiplier, effect.attacksMultiplier);
    if (Number.isFinite(movement)) rules.push({ type: "movement_multiplier", value: movement });
    if (Number.isFinite(attacks)) rules.push({ type: "attack_multiplier", value: attacks });
  }
  if (spec.canonical === "control") {
    rules.push({
      type: "controlled_by",
      actorId: actor?.id ?? null,
      actorUuid: actor?.uuid ?? null,
      mode: norm(effect.type ?? "control")
    });
  }
  return rules;
}

async function createConditionEffect(target, context, spec, duration) {
  const { actor, item, power, effect, parameters } = context;
  const conditionKey = `${item.id}:${power.catalogueId ?? power.id}:${spec.canonical}`;
  const existingIds = Array.from(target.effects ?? [])
    .filter(active => String(active.flags?.add2e?.magicPowerConditionKey ?? "") === conditionKey)
    .map(active => active.id).filter(Boolean);
  if (existingIds.length) await target.deleteEmbeddedDocuments("ActiveEffect", existingIds, { add2eMagicPowerExecution: true });
  const rules = conditionRules(spec, effect, actor, parameters);
  const compiled = compiledFromRules(rules);
  const tags = uniqueTags([...spec.tags, ...list(effect.tags ?? effect.effectTags).map(String), ...compiled.tags]);
  const extraFlags = {
    magicPowerActivation: true,
    magicPowerCondition: true,
    magicPowerConditionKey: conditionKey,
    sourceItemId: item.id,
    sourceItemUuid: item.uuid ?? null,
    sourceActorId: actor.id,
    sourceActorUuid: actor.uuid ?? null,
    magicPowerId: power.catalogueId ?? power.id,
    conditionType: spec.canonical,
    tags,
    effectTags: tags,
    rules
  };
  const description = String(effect.description ?? power.description ?? `Effet ${spec.label} appliqué par ${item.name}.`);
  const data = typeof game?.add2e?.time?.effectData === "function"
    ? game.add2e.time.effectData({
        name: `${item.name} — ${spec.label}`,
        img: power.img || item.img || "icons/svg/aura.svg",
        origin: item.uuid,
        rounds: duration.value,
        unit: duration.unit,
        description,
        tags,
        changes: compiled.changes,
        source: "magic-item",
        sourceItem: item,
        extraFlags
      })
    : {
        name: `${item.name} — ${spec.label}`,
        img: power.img || item.img || "icons/svg/aura.svg",
        origin: item.uuid,
        disabled: false,
        transfer: false,
        duration: {
          rounds: toRounds(duration),
          startRound: game.combat?.round ?? null,
          startTime: game.time?.worldTime ?? null,
          combat: game.combat?.id ?? null
        },
        description,
        changes: compiled.changes,
        flags: { add2e: extraFlags }
      };
  if (typeof game?.add2e?.time?.createTimedActiveEffect === "function") await game.add2e.time.createTimedActiveEffect(target, data);
  else await target.createEmbeddedDocuments("ActiveEffect", [data], { add2eMagicPowerExecution: true });
}

async function applyDamage(target, amount, effect, parameters) {
  const descriptor = hp(target);
  if (!descriptor) return { before: null, after: null, applied: 0, resolution: null };
  let resolved = Math.max(0, Math.floor(Number(amount) || 0));
  let resolution = null;
  const engine = globalThis.Add2eEffectsEngine;
  if (resolved > 0 && typeof engine?.resolveIncomingDamage === "function") {
    resolution = await engine.resolveIncomingDamage(target, {
      amount: resolved,
      type: parameters.damageType ?? parameters.type ?? effect.damageType ?? effect.element ?? effect.typeDegats ?? "magie",
      details: parameters.damageDetails ?? effect.details ?? "objet magique",
      chat: false
    });
    if (Number.isFinite(Number(resolution?.amount))) resolved = Math.max(0, Math.floor(Number(resolution.amount)));
  }
  const before = descriptor.value;
  const after = Math.max(0, before - resolved);
  if (after !== before) await target.update({ [descriptor.path]: after }, { add2eMagicPowerExecution: true });
  return { before, after, applied: resolved, resolution };
}

async function conditionHandler(context) {
  const { actor, item, power, effect, parameters } = context;
  const spec = conditionSpec(effect.type ?? effect.kind ?? effect.category);
  const affected = resolveAffectedTargets(context);
  if (!affected.ok) {
    if (affected.reason === "target-out-of-range") ui.notifications.warn("Une cible du pouvoir est hors de portée.");
    if (affected.reason === "zone-definition-incomplete") ui.notifications.warn("La zone du pouvoir est incomplète : rayon, longueur, largeur ou angle manquant.");
    return executionResult("failed", { handled: spec.canonical, reason: affected.reason });
  }
  const saveResolution = await resolveSaves(affected, parameters);
  if (saveResolution.required && !saveResolution.complete) {
    return executionResult("assisted", { handled: spec.canonical, complete: false, reason: "saving-throw-unavailable", targets: affected.actors });
  }
  if (saveResolution.required && saveResolution.rule?.onSuccess === "unspecified") {
    return executionResult("assisted", { handled: spec.canonical, complete: false, reason: "save-success-outcome-unspecified", targets: affected.actors });
  }
  const duration = powerDuration(power, { ...effect, duration: parameters.duration ?? effect.duration });
  const formula = spec.canonical === "poison" ? parameters.formula : null;
  if (!duration && !formula) {
    return executionResult("assisted", { handled: spec.canonical, complete: false, reason: "condition-duration-missing", targets: affected.actors });
  }
  const rolledDamage = formula ? Math.max(0, Math.floor(Number((await evaluate(formula)).total) || 0)) : 0;
  const rows = [];
  const appliedTargets = [];
  for (const target of affected.actors) {
    if (targetImmuneToCondition(target, spec)) {
      rows.push({ label: target.name, value: `Immunisé à ${spec.label.toLowerCase()}` });
      continue;
    }
    const save = saveResultFor(saveResolution, target);
    const saved = saveResolution.required && save?.success === true;
    if (saved && saveResolution.rule.onSuccess === "negate") {
      rows.push({ label: target.name, value: "Jet de protection réussi — aucun effet" });
      continue;
    }
    let damageText = "";
    if (formula) {
      const requested = saved && saveResolution.rule.onSuccess === "half" ? Math.floor(rolledDamage / 2) : rolledDamage;
      const result = await applyDamage(target, requested, effect, parameters);
      damageText = result.before == null ? " — dégâts non appliqués" : ` — ${result.before} → ${result.after} PV`;
    }
    if (!saved && duration) {
      await createConditionEffect(target, context, spec, duration);
      appliedTargets.push(target);
      rows.push({ label: target.name, value: `${spec.label} — ${duration.value} ${duration.unit}${damageText}` });
    } else if (saved) rows.push({ label: target.name, value: `Jet de protection réussi${damageText}` });
    else rows.push({ label: target.name, value: `${spec.label}${damageText}` });
  }
  await createCard(actor, item, power, {
    title: spec.label,
    variant: spec.canonical === "poison" ? "damage" : "ability",
    rows,
    targets: affected.actors,
    message: affected.zoneApplied ? "Les cibles sélectionnées ont été filtrées selon la zone du pouvoir." : ""
  });
  return executionResult("success", { handled: spec.canonical, targets: affected.actors, appliedTargets, rows, saveResolution, zone: affected.zone ?? null });
}

async function healingHandler(context) {
  const { actor, item, power, parameters } = context;
  if (!parameters.formula) return executionResult("skipped", { handled: "healing", complete: false, reason: "formula-missing" });
  const affected = resolveAffectedTargets(context);
  if (!affected.ok) return executionResult("failed", { handled: "healing", reason: affected.reason });
  const amount = Math.max(0, Math.floor(Number((await evaluate(parameters.formula)).total) || 0));
  const rows = [{ label: "Formule", value: parameters.formula }, { label: "Résultat", value: amount }];
  for (const target of affected.actors) {
    const data = hp(target);
    if (!data || data.value <= 0) { rows.push({ label: target.name, value: "PV non modifiés" }); continue; }
    const after = Math.min(data.max, data.value + amount);
    if (after !== data.value) await target.update({ [data.path]: after }, { add2eMagicPowerExecution: true });
    rows.push({ label: target.name, value: `${data.value} → ${after} PV` });
  }
  await createCard(actor, item, power, { title: "Guérison magique", variant: "healing", rows, targets: affected.actors });
  return executionResult("success", { handled: "healing", targets: affected.actors, rows });
}

async function damageHandler(context) {
  const { actor, item, power, effect, parameters } = context;
  if (!parameters.formula) return executionResult("skipped", { handled: "damage", complete: false, reason: "formula-missing" });
  const affected = resolveAffectedTargets(context);
  if (!affected.ok || !affected.actors.length) {
    if (affected.reason === "target-out-of-range") ui.notifications.warn("Une cible du pouvoir est hors de portée.");
    return executionResult("failed", { handled: "damage", reason: affected.reason || "target-required" });
  }
  const saveResolution = await resolveSaves(affected, parameters);
  if (saveResolution.required && !saveResolution.complete) {
    return executionResult("assisted", { handled: "damage", complete: false, reason: "saving-throw-unavailable", targets: affected.actors });
  }
  if (saveResolution.required && saveResolution.rule?.onSuccess === "unspecified") {
    return executionResult("assisted", { handled: "damage", complete: false, reason: "save-success-outcome-unspecified", targets: affected.actors });
  }
  const amount = Math.max(0, Math.floor(Number((await evaluate(parameters.formula)).total) || 0));
  const rows = [{ label: "Formule", value: parameters.formula }, { label: "Dégâts", value: amount }];
  for (const target of affected.actors) {
    const save = saveResultFor(saveResolution, target);
    let requested = amount;
    if (save?.success) {
      if (saveResolution.rule.onSuccess === "half") requested = Math.floor(amount / 2);
      else if (saveResolution.rule.onSuccess === "negate") requested = 0;
    }
    const result = await applyDamage(target, requested, effect, parameters);
    if (result.before == null) { rows.push({ label: target.name, value: "PV non modifiés" }); continue; }
    const saveText = saveResolution.required ? save?.success ? " — sauvegarde réussie" : " — sauvegarde échouée" : "";
    const reductionText = result.applied !== requested ? ` — réduction ${requested} → ${result.applied}` : "";
    rows.push({ label: target.name, value: `${result.before} → ${result.after} PV${saveText}${reductionText}` });
  }
  await createCard(actor, item, power, {
    title: "Dégâts magiques", variant: "damage", rows, targets: affected.actors,
    message: affected.zoneApplied ? "Les cibles sélectionnées ont été filtrées selon la zone du pouvoir." : ""
  });
  return executionResult("success", { handled: "damage", targets: affected.actors, rows, saveResolution, zone: affected.zone ?? null });
}

async function removeConditionHandler(context) {
  const { actor, item, power, effect } = context;
  const wanted = list(effect.conditions ?? effect.condition ?? effect.tags ?? effect.targetAny).map(norm).filter(Boolean);
  if (!wanted.length) return executionResult("skipped", { handled: "remove-condition", complete: false, reason: "condition-missing" });
  const affected = resolveAffectedTargets(context);
  if (!affected.ok) return executionResult("failed", { handled: "remove-condition", reason: affected.reason });
  const rows = [];
  for (const target of affected.actors) {
    const ids = Array.from(target.effects ?? []).filter(active => {
      const values = [active.name, ...list(active.flags?.add2e?.tags), ...list(active.flags?.add2e?.effectTags)].map(norm);
      return wanted.some(condition => values.some(value => value === condition || value.includes(condition)));
    }).map(active => active.id).filter(Boolean);
    if (ids.length) await target.deleteEmbeddedDocuments("ActiveEffect", ids, { add2eMagicPowerExecution: true });
    rows.push({ label: target.name, value: `${ids.length} effet(s) supprimé(s)` });
  }
  await createCard(actor, item, power, { title: "Dissipation d'état", variant: "success", rows, targets: affected.actors });
  return executionResult("success", { handled: "remove-condition", targets: affected.actors, rows });
}

async function lightHandler(context) {
  const { actor, item, power, parameters } = context;
  const tokens = selectedTokens().length ? selectedTokens() : canvas?.tokens?.controlled ?? [];
  if (!tokens.length) return executionResult("failed", { handled: "light", reason: "token-required" });
  const radius = Math.max(0, Number(parameters.radius ?? 6) || 6);
  const bright = Math.max(0, Number(parameters.bright ?? Math.floor(radius / 2)) || 0);
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
  const actorTargets = tokens.map(token => token.actor).filter(Boolean);
  await createCard(actor, item, power, { title: "Lumière magique", rows, targets: actorTargets });
  return executionResult("success", { handled: "light", targets: actorTargets, rows });
}

async function temporaryEffectHandler(context) {
  const { actor, item, power, effect } = context;
  const duration = powerDuration(power, effect);
  const toggle = norm(power.activation?.trigger) === "toggle" || norm(effect.mode) === "toggle";
  if (!duration && !toggle) return executionResult("skipped", { handled: "temporary-effect", complete: false, reason: "duration-missing" });
  const affected = resolveAffectedTargets(context);
  if (!affected.ok) return executionResult("failed", { handled: "temporary-effect", reason: affected.reason });
  const type = norm(effect.type);
  const key = `${item.id}:${power.catalogueId ?? power.id}:${type}`;
  const compiled = compileDefinition(effect);
  const rows = [];
  for (const target of affected.actors) {
    const existing = Array.from(target.effects ?? []).find(active => String(active.flags?.add2e?.magicPowerActivationKey ?? "") === key);
    if (existing && toggle) {
      await target.deleteEmbeddedDocuments("ActiveEffect", [existing.id], { add2eMagicPowerExecution: true });
      rows.push({ label: target.name, value: "Effet désactivé" });
      continue;
    }
    const tags = uniqueTags([...compiled.tags, `etat:${type}`]);
    const extraFlags = {
      magicPowerActivation: true,
      magicPowerActivationKey: key,
      sourceItemId: item.id,
      sourceItemUuid: item.uuid ?? null,
      magicPowerId: power.catalogueId ?? power.id,
      tags,
      effectTags: tags,
      rules: compiled.rules
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
          changes: compiled.changes,
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
          changes: uniqueChanges(compiled.changes),
          flags: { add2e: extraFlags }
        };
    if (duration && typeof game?.add2e?.time?.createTimedActiveEffect === "function") await game.add2e.time.createTimedActiveEffect(target, data);
    else await target.createEmbeddedDocuments("ActiveEffect", [data], { add2eMagicPowerExecution: true });
    rows.push({ label: target.name, value: duration ? `${duration.value} ${duration.unit}` : "Effet activé" });
  }
  await createCard(actor, item, power, { title: "Effet magique", rows, targets: affected.actors });
  return executionResult("success", { handled: "temporary-effect", targets: affected.actors, rows });
}

export function registerDefaultHandlers(linkedSpellHandler) {
  registerEffectHandler(["linked_spell"], linkedSpellHandler);
  registerEffectHandler(["heal", "healing", "restore_hit_points", "cure_damage", "hit_point_healing"], healingHandler);
  registerEffectHandler(["damage", "direct_damage", "magic_damage", "area_damage"], damageHandler);
  registerEffectHandler(["remove_condition", "cure_condition", "remove_status", "dispel_condition"], removeConditionHandler);
  registerEffectHandler(["light"], lightHandler);
  registerEffectHandler([
    "invisibility", "flight", "flying", "ethereal_state", "haste", "protection",
    "movement_mode", "movement_bonus", "movement_modifier", "movement_multiplier", "movement_override",
    "speed_bonus", "speed_modifier", "speed_multiplier", "speed_override", "base_movement", "fixed_movement",
    "transformation", "state_transformation", "polymorph", "status", "condition",
    "ability_bonus", "characteristic_bonus", "stat_bonus", "attribute_bonus",
    "ability_override", "characteristic_override", "stat_override", "attribute_override",
    "armor_bonus", "armor_class_bonus", "attack_bonus", "damage_bonus",
    "fixed_armor_class", "armor_class_fixed", "armor_class_base", "fixed_ac", "ac_fixed", "ca_fixe", "ca_base"
  ], temporaryEffectHandler);
  registerEffectHandler([
    "fear", "peur", "frightened", "frighten", "terror", "terreur",
    "paralysis", "paralysie", "paralyse", "paralyzed", "immobilization", "immobilisation",
    "poison", "poisoning", "poisoned", "empoisonnement", "empoisonne",
    "slow", "slowing", "slowed", "ralentissement", "ralenti",
    "stun", "stunned", "area_stun_on_hit", "zone_stun", "etourdissement", "etourdi",
    "control", "control_creature", "creature_control", "domination", "domination_aura", "suggestion", "charm_control"
  ], conditionHandler);
}
