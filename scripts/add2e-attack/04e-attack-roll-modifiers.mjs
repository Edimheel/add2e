// scripts/add2e-attack/04e-attack-roll-modifiers.mjs
// ADD2E — Modificateurs d'attaque génériques.

import {
  add2eNormalizeAttackTag,
  add2eTagSetMatches,
  add2eGetAttackAbilityModifier
} from "./03-attack-rules.mjs";

export const ADD2E_ATTACK_MODIFIERS_VERSION = "2026-07-22-magic-weapon-scoped-modifiers-v3";

const ADD2E_ATTACK_WEAPON_TYPES = new Set(["arme", "weapon"]);
const ADD2E_ATTACK_MAGIC_ITEM_EFFECT_FLAG = "magicItemCatalogueEffect";

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
  const n = Number(String(rawValue ?? "").trim().replace(",", "."));
  return Number.isFinite(n) ? n : defaultValue;
}

function add2eAttackNormalizeModifierTag(rawTag) {
  const raw = String(rawTag ?? "").trim();
  const signed = raw.match(/^(.*:)([+-]\d+(?:[.,]\d+)?)$/);
  if (!signed) return add2eNormalizeAttackTag(raw);
  const prefix = add2eNormalizeAttackTag(signed[1]);
  return prefix ? `${prefix}${signed[2].replace(",", ".")}` : "";
}

function add2eAttackGetActiveTargetEffectTags(cible) {
  const tags = new Set();
  if (typeof Add2eEffectsEngine !== "undefined" && typeof Add2eEffectsEngine.getActiveTags === "function") {
    add2eAttackPushNormalizedTag(tags, Add2eEffectsEngine.getActiveTags(cible) ?? []);
  }
  return tags;
}

function add2eAttackEffectTags(effect) {
  const tags = new Set();
  add2eAttackPushNormalizedTag(tags, effect?.flags?.add2e?.tags);
  add2eAttackPushNormalizedTag(tags, effect?.flags?.add2e?.effectTags);
  if (effect?.getFlag) {
    try { add2eAttackPushNormalizedTag(tags, effect.getFlag("add2e", "tags")); } catch (_error) {}
    try { add2eAttackPushNormalizedTag(tags, effect.getFlag("add2e", "effectTags")); } catch (_error) {}
  }
  return tags;
}

function add2eAttackMagicWeaponTagContext(actor, arme) {
  const scopedTags = new Set();
  const selectedTags = new Set();
  const selectedEffects = [];
  if (!actor || !arme?.id) return { scopedTags, selectedTags, selectedEffects };

  for (const effect of actor.effects ?? []) {
    if (effect?.disabled || effect?.flags?.add2e?.[ADD2E_ATTACK_MAGIC_ITEM_EFFECT_FLAG] !== true) continue;
    const sourceItemId = String(effect.flags?.add2e?.sourceItemId ?? "");
    const sourceItem = actor.items?.get?.(sourceItemId)
      ?? Array.from(actor.items ?? []).find(item => String(item?.id ?? "") === sourceItemId)
      ?? null;
    if (!ADD2E_ATTACK_WEAPON_TYPES.has(String(sourceItem?.type ?? "").toLowerCase())) continue;

    const effectTags = add2eAttackEffectTags(effect);
    effectTags.forEach(tag => scopedTags.add(add2eAttackNormalizeModifierTag(tag)));
    if (sourceItemId !== String(arme.id)) continue;
    selectedEffects.push(effect);
    effectTags.forEach(tag => selectedTags.add(add2eAttackNormalizeModifierTag(tag)));
  }

  return { scopedTags, selectedTags, selectedEffects };
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

function add2eAttackConditionalTag(tag, prefix, targetTags) {
  if (!tag.startsWith(prefix)) return null;
  const parts = tag.slice(prefix.length).split(":");
  const value = add2eAttackParseSignedValue(parts.pop(), NaN);
  const matcher = add2eNormalizeAttackTag(parts.join(":"));
  if (!matcher || !Number.isFinite(value)) return null;
  if (!targetTags.has(matcher) && !add2eTagSetMatches(targetTags, matcher)) return null;
  return { matcher, value };
}

function add2eAttackBestConditional(current, candidate) {
  if (!Number.isFinite(candidate)) return current;
  if (!Number.isFinite(current)) return candidate;
  return Math.max(current, candidate);
}

function add2eAttackApplyModifierTag({ tag, actor, combatProfile, targetTags, touch, damage, conditionals }) {
  if (!tag) return;
  if (add2eAttackApplySignedFlatTags({ tag, touch, damage })) return;

  const conditionalAttack = add2eAttackConditionalTag(tag, "bonus_attaque_conditionnel:", targetTags);
  if (conditionalAttack) {
    conditionals.attack = add2eAttackBestConditional(conditionals.attack, conditionalAttack.value);
    conditionals.attackDetails = conditionalAttack;
    return;
  }

  const conditionalDamage = add2eAttackConditionalTag(tag, "bonus_degats_conditionnel:", targetTags);
  if (conditionalDamage) {
    conditionals.damage = add2eAttackBestConditional(conditionals.damage, conditionalDamage.value);
    conditionals.damageDetails = conditionalDamage;
    return;
  }

  if (tag.startsWith("bonus_touche:")) {
    const parts = tag.split(":");
    const matcher = parts[1];
    const valeur = Number(parts[2]) || 0;
    if (matcher && add2eTagSetMatches(combatProfile?.tagSet, matcher)) touch.value += valeur;
    return;
  }

  if (tag.startsWith("bonus_degats_vs:")) {
    const parts = tag.split(":");
    const matcher = add2eNormalizeAttackTag(parts[1]);
    const valeurRaw = String(parts[2] ?? "").trim().toLowerCase();
    if (matcher && (targetTags.has(matcher) || add2eTagSetMatches(targetTags, matcher))) {
      damage.value += valeurRaw === "niveau" ? (Number(actor?.system?.niveau) || 1) : (Number(valeurRaw) || 0);
    }
  }
}

function add2eAttackAbilityModifierContext(actor, combatProfile) {
  const toucherCarac = combatProfile?.toucherCarac ?? null;
  const degatsCarac = combatProfile?.degatsCarac ?? null;
  return {
    toucher: {
      ability: toucherCarac,
      value: toucherCarac ? add2eGetAttackAbilityModifier(actor, toucherCarac, "toucher") : 0
    },
    degats: {
      ability: degatsCarac,
      value: degatsCarac ? add2eGetAttackAbilityModifier(actor, degatsCarac, "degats") : 0
    }
  };
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

export function add2eAttackComputeActiveAttackModifiers({ actor, cible, arme = null, combatProfile }) {
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
    const conditionals = { attack: null, damage: null, attackDetails: null, damageDetails: null };
    const weaponMagic = add2eAttackMagicWeaponTagContext(actor, arme);

    for (const rawTag of activeTags) {
      const tag = add2eAttackNormalizeModifierTag(rawTag);
      if (!tag || weaponMagic.scopedTags.has(tag)) continue;
      add2eAttackApplyModifierTag({ tag, actor, combatProfile, targetTags, touch, damage, conditionals });
    }

    for (const tag of weaponMagic.selectedTags) {
      add2eAttackApplyModifierTag({ tag, actor, combatProfile, targetTags, touch, damage, conditionals });
    }

    if (Number.isFinite(conditionals.attack)) {
      touch.value += conditionals.attack;
      touch.details.push(`Bonus conditionnel (${conditionals.attackDetails?.matcher ?? "cible"}) : ${conditionals.attack >= 0 ? "+" : ""}${conditionals.attack}`);
    }
    if (Number.isFinite(conditionals.damage)) {
      damage.value += conditionals.damage;
      damage.details.push(`Bonus conditionnel aux dégâts (${conditionals.damageDetails?.matcher ?? "cible"}) : ${conditionals.damage >= 0 ? "+" : ""}${conditionals.damage}`);
    }

    if (typeof Add2eEffectsEngine.getPassiveCombatModifiers === "function") {
      const passive = Add2eEffectsEngine.getPassiveCombatModifiers(actor, {
        type: "attaque",
        ruleScope: "owner",
        actor,
        target: cible,
        sourceItem: arme,
        sourceItemId: arme?.id ?? null,
        combatProfile,
        actionTags: combatProfile?.tags ?? [],
        abilityModifiers: add2eAttackAbilityModifierContext(actor, combatProfile)
      });
      touch.value += Number(passive?.toucher) || 0;
      damage.value += Number(passive?.degats) || 0;
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
