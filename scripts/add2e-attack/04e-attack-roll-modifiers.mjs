// scripts/add2e-attack/04e-attack-roll-modifiers.mjs
// ADD2E — Modificateurs d'attaque génériques.

import { add2eNormalizeAttackTag, add2eTagSetMatches } from "./03-attack-rules.mjs";

export const ADD2E_ATTACK_MODIFIERS_VERSION = "2026-07-08-monk-passive-force-cancel-v2";

function add2eAttackPushNormalizedTag(set, value) {
  if (!set || value === undefined || value === null || value === "") return;
  if (Array.isArray(value)) return void value.forEach(v => add2eAttackPushNormalizedTag(set, v));
  if (value instanceof Set) return void [...value].forEach(v => add2eAttackPushNormalizedTag(set, v));
  if (typeof value === "object") return void Object.values(value).forEach(v => add2eAttackPushNormalizedTag(set, v));
  if (typeof value !== "string") return;

  for (const part of value.split(/[,;|]/)) {
    const n = add2eNormalizeAttackTag(part);
    if (!n) continue;
    set.add(n);
    set.add(n.replace(/^race:/, ""));
    set.add(n.replace(/^type:/, ""));
    set.add(n.replace(/^type_monstre:/, ""));
    set.add(n.replace(/^creature:/, ""));
    set.add(n.replace(/^alignement:/, ""));
    set.add(n.replace(/^alignment:/, ""));
  }
}

export function add2eAttackBuildTargetTagSet(cible) {
  const targetTags = new Set();
  add2eAttackPushNormalizedTag(targetTags, cible?.name);
  add2eAttackPushNormalizedTag(targetTags, cible?.type);
  add2eAttackPushNormalizedTag(targetTags, cible?.system?.race);
  add2eAttackPushNormalizedTag(targetTags, cible?.system?.type);
  add2eAttackPushNormalizedTag(targetTags, cible?.system?.type_monstre);
  add2eAttackPushNormalizedTag(targetTags, cible?.system?.categorie);
  add2eAttackPushNormalizedTag(targetTags, cible?.system?.alignement);
  add2eAttackPushNormalizedTag(targetTags, cible?.system?.alignment);
  add2eAttackPushNormalizedTag(targetTags, cible?.system?.details?.alignment);
  add2eAttackPushNormalizedTag(targetTags, cible?.system?.tags);
  add2eAttackPushNormalizedTag(targetTags, cible?.system?.effectTags);
  add2eAttackPushNormalizedTag(targetTags, cible?.flags?.add2e?.tags);
  if (typeof Add2eEffectsEngine !== "undefined" && typeof Add2eEffectsEngine.getActiveTags === "function") {
    add2eAttackPushNormalizedTag(targetTags, Add2eEffectsEngine.getActiveTags(cible) ?? []);
  }
  return targetTags;
}

export function add2eAttackBuildActorTagSet(actor) {
  const actorTags = new Set();
  add2eAttackPushNormalizedTag(actorTags, actor?.name);
  add2eAttackPushNormalizedTag(actorTags, actor?.type);
  add2eAttackPushNormalizedTag(actorTags, actor?.system?.race);
  add2eAttackPushNormalizedTag(actorTags, actor?.system?.type);
  add2eAttackPushNormalizedTag(actorTags, actor?.system?.type_monstre);
  add2eAttackPushNormalizedTag(actorTags, actor?.system?.categorie);
  add2eAttackPushNormalizedTag(actorTags, actor?.system?.alignement);
  add2eAttackPushNormalizedTag(actorTags, actor?.system?.alignment);
  add2eAttackPushNormalizedTag(actorTags, actor?.system?.details?.alignment);
  add2eAttackPushNormalizedTag(actorTags, actor?.system?.tags);
  add2eAttackPushNormalizedTag(actorTags, actor?.system?.effectTags);
  add2eAttackPushNormalizedTag(actorTags, actor?.flags?.add2e?.tags);
  if (typeof Add2eEffectsEngine !== "undefined" && typeof Add2eEffectsEngine.getActiveTags === "function") {
    add2eAttackPushNormalizedTag(actorTags, Add2eEffectsEngine.getActiveTags(actor) ?? []);
  }
  return actorTags;
}

function add2eAttackParseSignedValue(rawValue, defaultValue = 0) {
  const n = Number(String(rawValue ?? "").trim());
  return Number.isFinite(n) ? n : defaultValue;
}

function add2eAttackGetActiveTargetEffectTags(cible) {
  const tags = new Set();
  if (typeof Add2eEffectsEngine !== "undefined" && typeof Add2eEffectsEngine.getActiveTags === "function") {
    add2eAttackPushNormalizedTag(tags, Add2eEffectsEngine.getActiveTags(cible) ?? []);
  }
  return tags;
}

function add2eAttackApplyFlatActiveTagModifier({ tag, prefix, label, accumulator }) {
  if (!tag.startsWith(prefix)) return false;
  const amount = add2eAttackParseSignedValue(tag.slice(prefix.length), 0);
  if (!amount) return true;
  accumulator.value += amount;
  accumulator.details.push(`${label} : ${amount >= 0 ? "+" : ""}${amount}`);
  return true;
}

function add2eAttackApplySignedFlatTags({ tag, touch, damage }) {
  if (add2eAttackApplyFlatActiveTagModifier({ tag, prefix: "bonus_attaque:", label: "Effet actif au toucher", accumulator: touch })) return true;
  if (add2eAttackApplyFlatActiveTagModifier({ tag, prefix: "bonus_toucher:", label: "Effet actif au toucher", accumulator: touch })) return true;
  if (add2eAttackApplyFlatActiveTagModifier({ tag, prefix: "bonus:toucher:", label: "Effet actif au toucher", accumulator: touch })) return true;
  if (add2eAttackApplyFlatActiveTagModifier({ tag, prefix: "malus_attaque:", label: "Effet actif au toucher", accumulator: touch })) return true;
  if (add2eAttackApplyFlatActiveTagModifier({ tag, prefix: "malus_toucher:", label: "Effet actif au toucher", accumulator: touch })) return true;
  if (add2eAttackApplyFlatActiveTagModifier({ tag, prefix: "malus:toucher:", label: "Effet actif au toucher", accumulator: touch })) return true;
  if (add2eAttackApplyFlatActiveTagModifier({ tag, prefix: "bonus_degats:", label: "Effet actif aux dégâts", accumulator: damage })) return true;
  if (add2eAttackApplyFlatActiveTagModifier({ tag, prefix: "bonus:degats:", label: "Effet actif aux dégâts", accumulator: damage })) return true;
  if (add2eAttackApplyFlatActiveTagModifier({ tag, prefix: "malus_degats:", label: "Effet actif aux dégâts", accumulator: damage })) return true;
  if (add2eAttackApplyFlatActiveTagModifier({ tag, prefix: "malus:degats:", label: "Effet actif aux dégâts", accumulator: damage })) return true;
  return false;
}

function add2eAttackIsMonkUnarmedProfile(combatProfile) {
  const tags = combatProfile?.tagSet ?? combatProfile?.tags ?? [];
  return add2eTagSetMatches(tags, "main_nue")
    || add2eTagSetMatches(tags, "arme:main_nue")
    || add2eTagSetMatches(tags, "type_arme:main_nue")
    || add2eTagSetMatches(tags, "combat:mains_nues");
}

function add2eAttackApplyMonkPassiveDamage({ tag, actor, combatProfile, damage }) {
  if (tag !== "bonus_degats:moine:demi_niveau") return false;
  if (add2eAttackIsMonkUnarmedProfile(combatProfile)) return true;
  const engineBonus = typeof Add2eEffectsEngine !== "undefined" && typeof Add2eEffectsEngine.getMonkWeaponDamageBonus === "function"
    ? Add2eEffectsEngine.getMonkWeaponDamageBonus(actor)
    : null;
  const fallbackBonus = Number(actor?.system?.moine?.passifs?.weaponDamageBonus);
  const bonus = Number.isFinite(Number(engineBonus)) ? Number(engineBonus) : (Number.isFinite(fallbackBonus) ? fallbackBonus : 0);
  if (!bonus) return true;
  damage.value += bonus;
  damage.details.push(`Bonus martial du moine : +${bonus}`);
  return true;
}

function add2eAttackApplyMonkForceCancellation({ tag, actor, combatProfile, touch, damage, state }) {
  const hitCancel = tag === "force_bonus:toucher:ignore" && add2eNormalizeAttackTag(combatProfile?.toucherCarac) === "force";
  const damageCancel = tag === "force_bonus:degats:ignore" && add2eNormalizeAttackTag(combatProfile?.degatsCarac) === "force";

  if (hitCancel && !state.forceHitCancelled) {
    const amount = Number(actor?.system?.force_bonus_toucher) || 0;
    if (amount) {
      touch.value -= amount;
      touch.details.push(`Force ignorée par le moine : ${amount > 0 ? "-" : "+"}${Math.abs(amount)} au toucher`);
    }
    state.forceHitCancelled = true;
    return true;
  }

  if (damageCancel && !state.forceDamageCancelled) {
    const amount = Number(actor?.system?.force_bonus_degats) || 0;
    if (amount) {
      damage.value -= amount;
      damage.details.push(`Force ignorée par le moine : ${amount > 0 ? "-" : "+"}${Math.abs(amount)} aux dégâts`);
    }
    state.forceDamageCancelled = true;
    return true;
  }

  return false;
}

export async function add2eAttackResolveTargetAttackGate({ actor, cible, actionTags = [], contact = false, source = "attack-roll" } = {}) {
  if (!actor || !cible) return { allowed: true, reason: "missing-actor-or-target", gateResults: [] };
  const engine = globalThis.Add2eEffectsEngine;
  if (typeof engine?.evaluateActionRules !== "function") return { allowed: true, reason: "effects-engine-unavailable", gateResults: [] };

  return engine.evaluateActionRules(cible, {
    type: "attaque",
    ruleScope: "target",
    source,
    actor,
    sourceActor: actor,
    saveActor: actor,
    contact,
    subjectTags: [...add2eAttackBuildActorTagSet(actor)],
    actionTags
  });
}

export function add2eAttackComputeTargetDefensiveAttackModifiers({ actor, cible }) {
  if (!actor || !cible || typeof Add2eEffectsEngine === "undefined" || typeof Add2eEffectsEngine.getActiveTags !== "function") {
    return { value: 0, details: [], attackerTags: new Set(), targetEffectTags: new Set() };
  }

  const targetEffectTags = add2eAttackGetActiveTargetEffectTags(cible);
  const defense = typeof Add2eEffectsEngine.getAttackModifierAgainst === "function"
    ? Add2eEffectsEngine.getAttackModifierAgainst(cible, actor)
    : { value: 0, details: [], attackerTags: add2eAttackBuildActorTagSet(actor) };

  return {
    value: Number(defense.value) || 0,
    details: defense.details ?? [],
    attackerTags: defense.attackerTags ?? add2eAttackBuildActorTagSet(actor),
    targetEffectTags
  };
}

export function add2eAttackComputeActiveAttackModifiers({ actor, cible, combatProfile }) {
  let bonusToucheEffets = 0;
  let bonusDegatsEffets = 0;
  let bonusRacialVs = 0;
  let bonusDefenseCible = 0;
  const targetTags = add2eAttackBuildTargetTagSet(cible);
  let targetDefensiveAttackDetails = [];
  let racialTargetAttackDetails = [];

  if (typeof Add2eEffectsEngine !== "undefined") {
    const racialAttack = typeof Add2eEffectsEngine.getAttackBonusAgainst === "function"
      ? Add2eEffectsEngine.getAttackBonusAgainst(actor, cible)
      : { value: 0, details: [] };
    bonusRacialVs = Number(racialAttack.value) || 0;
    racialTargetAttackDetails = racialAttack.details ?? [];

    const activeTags = Add2eEffectsEngine.getActiveTags(actor) ?? [];
    const touch = { value: 0, details: [] };
    const damage = { value: 0, details: [] };
    const state = { forceHitCancelled: false, forceDamageCancelled: false };

    for (const rawTag of activeTags) {
      const tag = add2eNormalizeAttackTag(rawTag);
      if (!tag) continue;

      if (add2eAttackApplyMonkForceCancellation({ tag, actor, combatProfile, touch, damage, state })) continue;
      if (add2eAttackApplyMonkPassiveDamage({ tag, actor, combatProfile, damage })) continue;
      if (add2eAttackApplySignedFlatTags({ tag, touch, damage })) continue;

      if (tag.startsWith("bonus_touche:")) {
        const parts = tag.split(":");
        const matcher = parts[1];
        const valeur = Number(parts[2]) || 0;
        if (matcher && add2eTagSetMatches(combatProfile.tagSet, matcher)) bonusToucheEffets += valeur;
        continue;
      }
      if (tag.startsWith("bonus_degats_vs:")) {
        const parts = tag.split(":");
        const matcher = add2eNormalizeAttackTag(parts[1]);
        const valeurRaw = String(parts[2] ?? "").trim().toLowerCase();
        if (matcher && targetTags.has(matcher)) {
          bonusDegatsEffets += valeurRaw === "niveau" ? (Number(actor?.system?.niveau) || 1) : (Number(valeurRaw) || 0);
        }
      }
    }

    if (touch.value) bonusToucheEffets += touch.value;
    if (damage.value) bonusDegatsEffets += damage.value;

    const targetDefensive = add2eAttackComputeTargetDefensiveAttackModifiers({ actor, cible });
    bonusDefenseCible = Number(targetDefensive.value) || 0;
    targetDefensiveAttackDetails = targetDefensive.details ?? [];
  }

  // La carte existante affiche bonusToucheEffets mais totalise séparément bonusRacialVs.
  // Les fusionner ici évite une seconde règle d'affichage tout en conservant exactement le même total final.
  const bonusToucheAffiche = bonusToucheEffets + bonusRacialVs + bonusDefenseCible;

  return {
    bonusToucheEffets: bonusToucheAffiche,
    bonusDegatsEffets,
    bonusRacialVs: 0,
    bonusRacialVsReported: bonusRacialVs,
    bonusDefenseCible,
    targetTags,
    targetDefensiveAttackDetails,
    racialTargetAttackDetails
  };
}

globalThis.ADD2E_ATTACK_MODIFIERS_VERSION = ADD2E_ATTACK_MODIFIERS_VERSION;
