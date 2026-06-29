// scripts/add2e-attack/04b-attack-roll-core.mjs
// ADD2E — Point d'entrée de résolution d'attaque.
// Les règles d'ActiveEffect sont évaluées par effects-engine.mjs ;
// ce fichier fournit uniquement le contexte générique de l'action.

import { add2eAttackRoll as add2eAttackRollCore } from "./04-attack-roll.mjs";
import {
  add2eMeasureTokenGridDistance,
  add2eGetCombatStatProfile,
  add2eCollectAttackTags,
  add2eNormalizeAttackTag
} from "./03-attack-rules.mjs";
import { add2eAttackMeasureContactAndDistance } from "./04g-attack-roll-range.mjs";

export const ADD2E_ATTACK_ROLL_CORE_VERSION = "2026-06-29-generic-effect-action-gates-v3";

const ADD2E_NATURAL_CONTACT_ATTACKS = new Set([
  "griffe", "griffes", "morsure", "bec", "serre", "serres", "dard", "queue", "coup_de_queue",
  "tentacule", "tentacules", "corne", "cornes", "sabot", "sabots", "poing", "poings", "pince", "pinces",
  "piquants", "epines", "contact", "toucher", "constriction", "ecrasement"
]);

function add2eResolveActor(args = {}) {
  return args.actor ?? (args.actorId ? game.actors?.get?.(args.actorId) : null) ?? null;
}

function add2eResolveWeapon(actor, args = {}) {
  return args.arme ?? (args.itemId ? actor?.items?.get?.(args.itemId) : null) ?? null;
}

function add2eResolveSourceToken(actor) {
  return (canvas?.tokens?.controlled ?? []).find(token => token?.actor?.id === actor?.id || token?.document?.actorId === actor?.id)
    ?? actor?.getActiveTokens?.()[0]
    ?? actor?.token?.object
    ?? actor?.token
    ?? null;
}

function add2eResolveTargetToken(args = {}) {
  return args.targetToken
    ?? args.cibleToken
    ?? Array.from(game.user?.targets ?? [])[0]
    ?? null;
}

function add2eResolveTargetActor(targetToken) {
  return targetToken?.actor
    ?? targetToken?.document?.actor
    ?? (targetToken?.document?.actorId ? game.actors?.get?.(targetToken.document.actorId) : null)
    ?? null;
}

function add2eAddNormalizedContextTag(tags, value) {
  const normalized = add2eNormalizeAttackTag(value);
  if (normalized) tags.add(normalized);
  return normalized;
}

function add2eHasNaturalContactName(value) {
  const normalized = add2eNormalizeAttackTag(value);
  if (!normalized) return false;
  return [...ADD2E_NATURAL_CONTACT_ATTACKS].some(key => (
    normalized === key
    || normalized.startsWith(`${key}_`)
    || normalized.endsWith(`_${key}`)
    || normalized.includes(`_${key}_`)
  ));
}

function add2eBuildActionContextTags(arme) {
  const tags = new Set(add2eCollectAttackTags(arme));
  const system = arme?.system ?? {};
  const values = [
    arme?.name,
    system.nom,
    system.type,
    system.type_arme,
    system.categorie,
    system.category,
    system.famille,
    system.famille_arme
  ];

  const explicitlyNatural = [
    "type_arme:naturelle",
    "type:naturelle",
    "usage:naturelle",
    "trait:naturelle"
  ].some(tag => tags.has(tag));

  if (explicitlyNatural || values.some(add2eHasNaturalContactName) || [...tags].some(add2eHasNaturalContactName)) {
    tags.add("type_arme:naturelle");
  }

  return [...tags];
}

function add2eBuildActorContextTags(actor, engine) {
  const tags = new Set(engine?.getContextTags?.(actor) ?? []);
  const system = actor?.system ?? {};
  const values = [
    actor?.type,
    system.type,
    system.type_monstre,
    system.categorie,
    system.race,
    system.tags,
    system.effectTags,
    actor?.flags?.add2e?.tags,
    actor?.flags?.add2e?.effectTags
  ];

  for (const value of values) {
    const rawValues = Array.isArray(value) ? value : [value];
    for (const rawValue of rawValues) {
      const normalized = add2eAddNormalizedContextTag(tags, rawValue);
      if (!normalized) continue;
      if (normalized.includes("animal")) tags.add("creature:animal");
      if (normalized.includes("enchante")) tags.add("creature:enchantee");
      if (normalized.includes("invoque") || normalized.includes("summon")) tags.add("creature:invoquee");
    }
  }

  for (const rawTag of [...tags]) {
    const tag = add2eNormalizeAttackTag(rawTag);
    if (!tag) continue;
    if (tag.startsWith("invocation:") || tag.startsWith("summon:") || tag.startsWith("summoned:")) tags.add("creature:invoquee");
    if (tag.includes("enchante")) tags.add("creature:enchantee");
    if (tag.includes("animal")) tags.add("creature:animal");
  }

  const alignment = [system.alignement, system.alignment, system.details?.alignment]
    .map(value => add2eNormalizeAttackTag(value))
    .filter(Boolean)
    .join(" ");
  if (alignment.includes("mauvais") || alignment.includes("evil")) tags.add("alignement:mauvais");
  if (alignment.includes("bon") || alignment.includes("good")) tags.add("alignement:bon");
  if (alignment.includes("neutre") || alignment.includes("neutral")) tags.add("alignement:neutre");

  return [...tags];
}

function add2eEvaluateGenericActionGate(args = {}) {
  const engine = globalThis.Add2eEffectsEngine;
  if (typeof engine?.evaluateActionRules !== "function") return { allowed: true, reason: "effects-engine-unavailable", details: [] };

  const actor = add2eResolveActor(args);
  const arme = add2eResolveWeapon(actor, args);
  const targetToken = add2eResolveTargetToken(args);
  const cible = add2eResolveTargetActor(targetToken);
  if (!actor || !arme || !targetToken || !cible) return { allowed: true, reason: "attack-context-incomplete", details: [] };

  const sourceToken = add2eResolveSourceToken(actor);
  const contact = sourceToken
    ? !!add2eAttackMeasureContactAndDistance({
      srcToken: sourceToken,
      cibleToken: targetToken,
      measureDistance: add2eMeasureTokenGridDistance
    }).auContact
    : false;
  const combatProfile = add2eGetCombatStatProfile(arme);

  return engine.evaluateActionRules(cible, {
    type: "attaque",
    contact: contact && !!combatProfile.isCorpsACorps,
    subjectTags: add2eBuildActorContextTags(actor, engine),
    actionTags: add2eBuildActionContextTags(arme)
  });
}

export async function add2eAttackRoll(args = {}) {
  const gate = add2eEvaluateGenericActionGate(args);
  if (gate?.allowed === false) {
    ui.notifications?.warn?.(gate.details?.[0] ?? "Cette attaque est empêchée par un effet actif.");
    return false;
  }
  return add2eAttackRollCore(args);
}

globalThis.add2eAttackRoll = add2eAttackRoll;
globalThis.ADD2E_ATTACK_ROLL_SPLIT_VERSION = ADD2E_ATTACK_ROLL_CORE_VERSION;
