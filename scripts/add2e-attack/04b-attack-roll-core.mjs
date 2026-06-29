// scripts/add2e-attack/04b-attack-roll-core.mjs
// ADD2E — Point d'entrée de résolution d'attaque.
// Les règles d'ActiveEffect sont évaluées par effects-engine.mjs ;
// ce fichier ne fait que transmettre le contexte d'attaque.

import { add2eAttackRoll as add2eAttackRollCore } from "./04-attack-roll.mjs";
import { add2eMeasureTokenGridDistance, add2eGetCombatStatProfile } from "./03-attack-rules.mjs";
import { add2eAttackMeasureContactAndDistance } from "./04g-attack-roll-range.mjs";

export const ADD2E_ATTACK_ROLL_CORE_VERSION = "2026-06-29-generic-effect-action-gates-v2";

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

function add2eResolveTargetActor(targetToken) {
  return targetToken?.actor
    ?? targetToken?.document?.actor
    ?? (targetToken?.document?.actorId ? game.actors?.get?.(targetToken.document.actorId) : null)
    ?? null;
}

function add2eEvaluateGenericActionGate(args = {}) {
  const engine = globalThis.Add2eEffectsEngine;
  if (typeof engine?.evaluateActionRules !== "function") return { allowed: true, reason: "effects-engine-unavailable", details: [] };

  const actor = add2eResolveActor(args);
  const arme = add2eResolveWeapon(actor, args);
  const targetToken = Array.from(game.user?.targets ?? [])[0] ?? null;
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
    subjectTags: engine.getContextTags?.(actor) ?? [],
    actionTags: engine.itemTags?.(arme) ?? []
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
