// scripts/add2e-attack/04e-attack-roll-modifiers.mjs
// ADD2E — Producteurs et résolution canonique des modificateurs d'attaque/dégâts.
// Compatible Foundry V13/V14/V15.

import {
  add2eNormalizeAttackTag,
  add2eTagSetMatches,
  add2eGetAttackAbilityModifier
} from "./03-attack-rules.mjs";

export const ADD2E_ATTACK_MODIFIERS_VERSION = "2026-07-24-targetless-canonical-preview-v6";

const ADD2E_ATTACK_WEAPON_TYPES = new Set(["arme", "weapon"]);
const ADD2E_ATTACK_MAGIC_ITEM_EFFECT_FLAG = "magicItemCatalogueEffect";

function add2eAttackEffectsEngine() {
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine ?? null;
  if (!engine || typeof engine.createModifier !== "function" || typeof engine.resolve !== "function") {
    throw new Error("Le résolveur canonique ADD2E des modificateurs de combat n’est pas disponible.");
  }
  return engine;
}

function add2eAttackPushNormalizedTag(set, value) {
  if (!set || value === undefined || value === null || value === "") return;
  if (Array.isArray(value)) return void value.forEach(v => add2eAttackPushNormalizedTag(set, v));
  if (value instanceof Set) return void [...value].forEach(v => add2eAttackPushNormalizedTag(set, v));
  if (typeof value === "object") return void Object.values(value).forEach(v => add2eAttackPushNormalizedTag(set, v));
  if (typeof value !== "string") return;

  for (const part of value.split(/[,;|]/)) {
    const normalized = add2eNormalizeAttackTag(part);
    if (!normalized) continue;
    set.add(normalized);
    set.add(normalized.replace(/^race:/, ""));
    set.add(normalized.replace(/^type:/, ""));
    set.add(normalized.replace(/^type_monstre:/, ""));
    set.add(normalized.replace(/^creature:/, ""));
    set.add(normalized.replace(/^alignement:/, ""));
    set.add(normalized.replace(/^alignment:/, ""));
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
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine;
  if (cible && typeof engine?.getActiveTags === "function") add2eAttackPushNormalizedTag(targetTags, engine.getActiveTags(cible) ?? []);
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
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine;
  if (typeof engine?.getActiveTags === "function") add2eAttackPushNormalizedTag(actorTags, engine.getActiveTags(actor) ?? []);
  return actorTags;
}

function add2eAttackParseSignedValue(rawValue, defaultValue = 0) {
  const value = Number(String(rawValue ?? "").trim().replace(",", "."));
  return Number.isFinite(value) ? value : defaultValue;
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
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine;
  if (cible && typeof engine?.getActiveTags === "function") add2eAttackPushNormalizedTag(tags, engine.getActiveTags(cible) ?? []);
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

function add2eAttackSource(kind, id, name, uuid = "") {
  return {
    kind: add2eNormalizeAttackTag(kind) || "combat",
    id: String(id ?? name ?? kind ?? "combat"),
    uuid: String(uuid ?? ""),
    name: String(name ?? "Modificateur de combat")
  };
}

function add2eAttackCreateModifier(engine, {
  id,
  domain,
  target,
  value,
  source,
  label,
  priority = 100,
  stacking = { mode: "stack", group: null },
  conditions = {},
  metadata = {}
}) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount === 0) return null;
  return engine.createModifier({
    id: String(id),
    domain,
    target,
    operation: "add",
    value: amount,
    priority,
    stacking,
    conditions,
    source,
    metadata: { label: String(label ?? source?.name ?? "Modificateur de combat"), ...metadata }
  });
}

function add2eAttackPushModifier(list, modifier) {
  if (modifier) list.push(modifier);
}

function add2eAttackFlatTagDescriptor(tag) {
  const definitions = [
    ["bonus_attaque:", "attack", "toucher", "Effet actif au toucher"],
    ["bonus_toucher:", "attack", "toucher", "Effet actif au toucher"],
    ["bonus:toucher:", "attack", "toucher", "Effet actif au toucher"],
    ["malus_attaque:", "attack", "toucher", "Effet actif au toucher"],
    ["malus_toucher:", "attack", "toucher", "Effet actif au toucher"],
    ["malus:toucher:", "attack", "toucher", "Effet actif au toucher"],
    ["bonus_degats:", "damage", "degats", "Effet actif aux dégâts"],
    ["bonus:degats:", "damage", "degats", "Effet actif aux dégâts"],
    ["malus_degats:", "damage", "degats", "Effet actif aux dégâts"],
    ["malus:degats:", "damage", "degats", "Effet actif aux dégâts"]
  ];
  for (const [prefix, domain, target, label] of definitions) {
    if (!tag.startsWith(prefix)) continue;
    return { domain, target, label, value: add2eAttackParseSignedValue(tag.slice(prefix.length), 0) };
  }
  return null;
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

function add2eAttackTagModifiers({ engine, tag, actor, combatProfile, targetTags, source, sequence }) {
  const modifiers = [];
  if (!tag) return modifiers;

  const flat = add2eAttackFlatTagDescriptor(tag);
  if (flat) {
    add2eAttackPushModifier(modifiers, add2eAttackCreateModifier(engine, {
      id: `${source.id}:${flat.domain}:${flat.target}:tag:${sequence}`,
      domain: flat.domain,
      target: flat.target,
      value: flat.value,
      source,
      label: flat.label,
      metadata: { sourceTag: tag }
    }));
    return modifiers;
  }

  const conditionalAttack = add2eAttackConditionalTag(tag, "bonus_attaque_conditionnel:", targetTags);
  if (conditionalAttack) {
    add2eAttackPushModifier(modifiers, add2eAttackCreateModifier(engine, {
      id: `${source.id}:attack:conditional:${conditionalAttack.matcher}:${sequence}`,
      domain: "attack",
      target: "toucher",
      value: conditionalAttack.value,
      source,
      label: `Bonus conditionnel (${conditionalAttack.matcher})`,
      stacking: { mode: "highest", group: "attack:conditional-target" },
      metadata: { matcher: conditionalAttack.matcher, sourceTag: tag }
    }));
    return modifiers;
  }

  const conditionalDamage = add2eAttackConditionalTag(tag, "bonus_degats_conditionnel:", targetTags);
  if (conditionalDamage) {
    add2eAttackPushModifier(modifiers, add2eAttackCreateModifier(engine, {
      id: `${source.id}:damage:conditional:${conditionalDamage.matcher}:${sequence}`,
      domain: "damage",
      target: "degats",
      value: conditionalDamage.value,
      source,
      label: `Bonus conditionnel aux dégâts (${conditionalDamage.matcher})`,
      stacking: { mode: "highest", group: "damage:conditional-target" },
      metadata: { matcher: conditionalDamage.matcher, sourceTag: tag }
    }));
    return modifiers;
  }

  if (tag.startsWith("bonus_touche:")) {
    const parts = tag.split(":");
    const matcher = parts[1];
    const value = Number(parts[2]) || 0;
    if (matcher && add2eTagSetMatches(combatProfile?.tagSet, matcher)) {
      add2eAttackPushModifier(modifiers, add2eAttackCreateModifier(engine, {
        id: `${source.id}:attack:weapon:${matcher}:${sequence}`,
        domain: "attack",
        target: "toucher",
        value,
        source,
        label: `Bonus au toucher avec ${matcher}`,
        metadata: { matcher, sourceTag: tag }
      }));
    }
    return modifiers;
  }

  if (tag.startsWith("bonus_degats_vs:")) {
    const parts = tag.split(":");
    const matcher = add2eNormalizeAttackTag(parts[1]);
    const rawValue = String(parts[2] ?? "").trim().toLowerCase();
    if (matcher && (targetTags.has(matcher) || add2eTagSetMatches(targetTags, matcher))) {
      const value = rawValue === "niveau" ? (Number(actor?.system?.niveau) || 1) : (Number(rawValue) || 0);
      add2eAttackPushModifier(modifiers, add2eAttackCreateModifier(engine, {
        id: `${source.id}:damage:target:${matcher}:${sequence}`,
        domain: "damage",
        target: "degats",
        value,
        source,
        label: `Bonus aux dégâts contre ${matcher}`,
        metadata: { matcher, sourceTag: tag }
      }));
    }
  }

  return modifiers;
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

function add2eAttackWeaponBaseModifiers(engine, arme) {
  const hit = typeof engine.getMagicWeaponBonus === "function"
    ? Number(engine.getMagicWeaponBonus(arme, "hit")) || 0
    : Number(arme?.system?.bonus_hit) || 0;
  const damage = typeof engine.getMagicWeaponBonus === "function"
    ? Number(engine.getMagicWeaponBonus(arme, "damage")) || 0
    : Number(arme?.system?.bonus_dom) || 0;
  return { hit, damage };
}

function add2eAttackCanonicalTarget(modifier) {
  const domain = add2eNormalizeAttackTag(modifier?.domain);
  const target = add2eNormalizeAttackTag(modifier?.target);
  if (domain === "attack" && ["attaque", "attack", "roll", "hit", "toucher"].includes(target)) return { ...modifier, target: "toucher" };
  if (domain === "damage" && ["damage", "roll", "dommage", "dommages", "degat", "degats"].includes(target)) return { ...modifier, target: "degats" };
  return modifier;
}

function add2eAttackResolutionDetails(resolution) {
  return Array.isArray(resolution?.applied)
    ? resolution.applied.map(entry => {
      const modifier = entry?.modifier ?? {};
      const label = modifier?.metadata?.label ?? modifier?.source?.name ?? modifier?.id ?? "Modificateur";
      const value = Number(modifier?.value) || 0;
      return `${label} : ${value >= 0 ? "+" : ""}${value}`;
    })
    : [];
}

export async function add2eAttackResolveTargetAttackGate({ actor, cible, actionTags = [], contact = false, source = "attack-roll" } = {}) {
  if (!actor || !cible) return { allowed: true, reason: "missing-actor-or-target", gateResults: [] };
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine;
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
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine;
  if (!actor || !cible || typeof engine?.getActiveTags !== "function") {
    return { value: 0, details: [], attackerTags: new Set(), targetEffectTags: new Set() };
  }

  const targetEffectTags = add2eAttackGetActiveTargetEffectTags(cible);
  const defense = typeof engine.getAttackModifierAgainst === "function"
    ? engine.getAttackModifierAgainst(cible, actor)
    : { value: 0, details: [], attackerTags: add2eAttackBuildActorTagSet(actor) };

  return {
    value: Number(defense.value) || 0,
    details: defense.details ?? [],
    attackerTags: defense.attackerTags ?? add2eAttackBuildActorTagSet(actor),
    targetEffectTags
  };
}

export function add2eAttackComputeActiveAttackModifiers({ actor, cible = null, arme = null, combatProfile }) {
  const engine = add2eAttackEffectsEngine();
  const targetTags = add2eAttackBuildTargetTagSet(cible);
  const abilityModifiers = add2eAttackAbilityModifierContext(actor, combatProfile);
  const weaponBase = add2eAttackWeaponBaseModifiers(engine, arme);
  const context = {
    type: "attaque",
    actionType: "attaque",
    ruleScope: "owner",
    actor,
    target: cible,
    targetActor: cible,
    sourceItem: arme,
    sourceItemId: arme?.id ?? null,
    item: arme,
    weaponType: arme?.system?.famille_arme ?? arme?.system?.type_arme ?? arme?.system?.type ?? null,
    weaponTags: combatProfile?.tags ?? [],
    targetTags: [...targetTags],
    combatProfile,
    actionTags: combatProfile?.tags ?? [],
    abilityModifiers,
    previewWithoutTarget: !cible
  };

  const collected = (typeof engine.collect === "function" ? engine.collect(actor, context) : [])
    .map(add2eAttackCanonicalTarget)
    .filter(modifier => {
      const domain = add2eNormalizeAttackTag(modifier?.domain);
      if (!["attack", "damage"].includes(domain)) return false;
      const sourceItem = modifier?._context?.sourceItem ?? null;
      // Les champs de base de l'arme sont normalisés explicitement ci-dessous.
      // Les effets conditionnels de cette arme restent produits depuis leur ActiveEffect.
      return !sourceItem || String(sourceItem.id ?? "") !== String(arme?.id ?? "");
    });

  const produced = [];
  let sequence = 0;
  const activeTags = typeof engine.getActiveTags === "function" ? engine.getActiveTags(actor) ?? [] : [];
  const weaponMagic = add2eAttackMagicWeaponTagContext(actor, arme);
  const actorTagSource = add2eAttackSource("active-tags", actor?.id, actor?.name, actor?.uuid);

  for (const rawTag of activeTags) {
    const tag = add2eAttackNormalizeModifierTag(rawTag);
    if (!tag || weaponMagic.scopedTags.has(tag)) continue;
    produced.push(...add2eAttackTagModifiers({ engine, tag, actor, combatProfile, targetTags, source: actorTagSource, sequence: sequence++ }));
  }

  const weaponTagSource = add2eAttackSource("weapon-effect", arme?.id, arme?.name, arme?.uuid);
  for (const tag of weaponMagic.selectedTags) {
    produced.push(...add2eAttackTagModifiers({ engine, tag, actor, combatProfile, targetTags, source: weaponTagSource, sequence: sequence++ }));
  }

  const abilitySource = add2eAttackSource("ability", actor?.id, actor?.name, actor?.uuid);
  add2eAttackPushModifier(produced, add2eAttackCreateModifier(engine, {
    id: `${actor?.id}:attack:ability:${abilityModifiers.toucher.ability ?? "none"}`,
    domain: "attack",
    target: "toucher",
    value: abilityModifiers.toucher.value,
    source: abilitySource,
    label: `Caractéristique ${String(abilityModifiers.toucher.ability ?? "").toUpperCase() || "attaque"}`,
    metadata: { ability: abilityModifiers.toucher.ability, producer: "ability-table" }
  }));
  add2eAttackPushModifier(produced, add2eAttackCreateModifier(engine, {
    id: `${actor?.id}:damage:ability:${abilityModifiers.degats.ability ?? "none"}`,
    domain: "damage",
    target: "degats",
    value: abilityModifiers.degats.value,
    source: abilitySource,
    label: `Caractéristique ${String(abilityModifiers.degats.ability ?? "").toUpperCase() || "dégâts"}`,
    metadata: { ability: abilityModifiers.degats.ability, producer: "ability-table" }
  }));

  const weaponSource = add2eAttackSource("weapon", arme?.id, arme?.name, arme?.uuid);
  add2eAttackPushModifier(produced, add2eAttackCreateModifier(engine, {
    id: `${arme?.id}:attack:weapon-base`,
    domain: "attack",
    target: "toucher",
    value: weaponBase.hit,
    source: weaponSource,
    label: `${arme?.name ?? "Arme"} — bonus au toucher`,
    metadata: { producer: "weapon-base-field" }
  }));
  add2eAttackPushModifier(produced, add2eAttackCreateModifier(engine, {
    id: `${arme?.id}:damage:weapon-base`,
    domain: "damage",
    target: "degats",
    value: weaponBase.damage,
    source: weaponSource,
    label: `${arme?.name ?? "Arme"} — bonus aux dégâts`,
    metadata: { producer: "weapon-base-field" }
  }));

  const racialAttack = cible && typeof engine.getAttackBonusAgainst === "function"
    ? engine.getAttackBonusAgainst(actor, cible)
    : { value: 0, details: [] };
  const bonusRacialVs = Number(racialAttack.value) || 0;
  add2eAttackPushModifier(produced, add2eAttackCreateModifier(engine, {
    id: `${actor?.id}:attack:racial-target`,
    domain: "attack",
    target: "toucher",
    value: bonusRacialVs,
    source: add2eAttackSource("race", actor?.flags?.add2e?.racialAbilitySource?.id ?? actor?.id, actor?.system?.race ?? "Race"),
    label: racialAttack.details?.[0] ?? "Bonus racial contre la cible"
  }));

  const passive = typeof engine.getPassiveCombatModifiers === "function"
    ? engine.getPassiveCombatModifiers(actor, context)
    : { toucher: 0, degats: 0, details: [] };
  add2eAttackPushModifier(produced, add2eAttackCreateModifier(engine, {
    id: `${actor?.id}:attack:passive-rules`,
    domain: "attack",
    target: "toucher",
    value: Number(passive?.toucher) || 0,
    source: add2eAttackSource("passive-rules", actor?.id, "Règles passives", actor?.uuid),
    label: passive?.details?.filter(detail => /toucher|attaque/i.test(detail)).join(" ; ") || "Règles passives au toucher"
  }));
  add2eAttackPushModifier(produced, add2eAttackCreateModifier(engine, {
    id: `${actor?.id}:damage:passive-rules`,
    domain: "damage",
    target: "degats",
    value: Number(passive?.degats) || 0,
    source: add2eAttackSource("passive-rules", actor?.id, "Règles passives", actor?.uuid),
    label: passive?.details?.filter(detail => /degat|damage/i.test(detail)).join(" ; ") || "Règles passives aux dégâts"
  }));

  const targetDefensive = add2eAttackComputeTargetDefensiveAttackModifiers({ actor, cible });
  const bonusDefenseCible = Number(targetDefensive.value) || 0;
  add2eAttackPushModifier(produced, add2eAttackCreateModifier(engine, {
    id: `${cible?.id}:attack:defensive-target`,
    domain: "attack",
    target: "toucher",
    value: bonusDefenseCible,
    source: add2eAttackSource("target-defense", cible?.id, cible?.name, cible?.uuid),
    label: targetDefensive.details?.join(" ; ") || "Défense de la cible"
  }));

  const allModifiers = [...collected, ...produced];
  const attackResolution = engine.resolve(actor, {
    domain: "attack",
    target: "toucher",
    base: 0,
    item: arme,
    targetActor: cible,
    context,
    modifiers: allModifiers
  });
  const damageResolution = engine.resolve(actor, {
    domain: "damage",
    target: "degats",
    base: 0,
    item: arme,
    targetActor: cible,
    context,
    modifiers: allModifiers
  });

  // 04-attack-roll.mjs ajoute encore séparément la caractéristique et les champs
  // de l'arme pour ses lignes d'affichage. On retire exactement ces valeurs du
  // complément renvoyé : le total utilisé reste celui du résolveur canonique.
  const legacyDisplayedAttackParts = abilityModifiers.toucher.value + weaponBase.hit;
  const legacyDisplayedDamageParts = abilityModifiers.degats.value + weaponBase.damage;

  return {
    bonusToucheEffets: (Number(attackResolution.total) || 0) - legacyDisplayedAttackParts,
    bonusDegatsEffets: (Number(damageResolution.total) || 0) - legacyDisplayedDamageParts,
    bonusRacialVs: 0,
    bonusRacialVsReported: bonusRacialVs,
    bonusDefenseCible,
    targetTags,
    targetDefensiveAttackDetails: targetDefensive.details ?? [],
    racialTargetAttackDetails: racialAttack.details ?? [],
    attackResolution,
    damageResolution,
    persistentAttackTotal: Number(attackResolution.total) || 0,
    persistentDamageTotal: Number(damageResolution.total) || 0,
    attackModifierDetails: add2eAttackResolutionDetails(attackResolution),
    damageModifierDetails: add2eAttackResolutionDetails(damageResolution)
  };
}

globalThis.ADD2E_ATTACK_MODIFIERS_VERSION = ADD2E_ATTACK_MODIFIERS_VERSION;
