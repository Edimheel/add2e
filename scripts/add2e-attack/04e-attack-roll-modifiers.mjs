// scripts/add2e-attack/04e-attack-roll-modifiers.mjs
// ADD2E - Attaque 04e : helpers generiques de modificateurs d'attaque.

import { add2eNormalizeAttackTag, add2eTagSetMatches } from "./03-attack-rules.mjs";

export const ADD2E_ATTACK_MODIFIERS_VERSION = "2026-05-22-target-defensive-modifiers-v2";

function add2eAttackPushNormalizedTag(set, value) {
  if (!set || value === undefined || value === null || value === "") return;

  if (Array.isArray(value)) {
    for (const v of value) add2eAttackPushNormalizedTag(set, v);
    return;
  }

  if (value instanceof Set) {
    for (const v of value) add2eAttackPushNormalizedTag(set, v);
    return;
  }

  if (typeof value === "object") {
    for (const v of Object.values(value)) add2eAttackPushNormalizedTag(set, v);
    return;
  }

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

function add2eAttackTagSetHasMatcher(tagSet, matcher) {
  const m = add2eNormalizeAttackTag(matcher);
  if (!m) return false;
  if (tagSet.has(m)) return true;

  const stripped = m
    .replace(/^race:/, "")
    .replace(/^type:/, "")
    .replace(/^type_monstre:/, "")
    .replace(/^creature:/, "")
    .replace(/^alignement:/, "")
    .replace(/^alignment:/, "");

  if (tagSet.has(stripped)) return true;

  for (const tag of tagSet) {
    if (tag === m || tag === stripped) return true;
    if (tag.endsWith(`:${m}`) || tag.endsWith(`:${stripped}`)) return true;
    if (tag.includes(m) || tag.includes(stripped)) return true;
  }

  return false;
}

function add2eAttackIsEvilTagSet(tagSet) {
  return add2eAttackTagSetHasMatcher(tagSet, "alignement:mauvais") ||
    add2eAttackTagSetHasMatcher(tagSet, "alignment:evil") ||
    add2eAttackTagSetHasMatcher(tagSet, "loyal_mauvais") ||
    add2eAttackTagSetHasMatcher(tagSet, "neutre_mauvais") ||
    add2eAttackTagSetHasMatcher(tagSet, "chaotique_mauvais") ||
    add2eAttackTagSetHasMatcher(tagSet, "mauvais") ||
    add2eAttackTagSetHasMatcher(tagSet, "evil");
}

function add2eAttackParseSignedValue(rawValue, defaultValue = 0) {
  const n = Number(String(rawValue ?? "").trim());
  return Number.isFinite(n) ? n : defaultValue;
}

function add2eAttackTagSetHasPrefix(tagSet, prefix) {
  const p = add2eNormalizeAttackTag(prefix);
  for (const tag of tagSet) {
    if (tag.startsWith(p)) return true;
  }
  return false;
}

export function add2eAttackComputeTargetDefensiveAttackModifiers({ actor, cible }) {
  let value = 0;
  const details = [];

  if (!actor || !cible || typeof Add2eEffectsEngine === "undefined" || typeof Add2eEffectsEngine.getActiveTags !== "function") {
    return { value, details, attackerTags: new Set(), targetEffectTags: new Set() };
  }

  const attackerTags = add2eAttackBuildActorTagSet(actor);
  const targetEffectTags = new Set();
  add2eAttackPushNormalizedTag(targetEffectTags, Add2eEffectsEngine.getActiveTags(cible) ?? []);

  const isEvil = add2eAttackIsEvilTagSet(attackerTags);
  const hasProtectionSpecificMalus =
    targetEffectTags.has("protection:mal") &&
    add2eAttackTagSetHasPrefix(targetEffectTags, "malus_attaque_creature_mauvaise:");

  for (const rawTag of targetEffectTags) {
    const tag = add2eNormalizeAttackTag(rawTag);
    if (!tag) continue;

    // Format simple : malus_toucher_ennemi:2
    // Applique un malus general a tout attaquant ennemi qui frappe la cible protegee.
    // Si le meme effet porte aussi un tag specifique de Protection contre le Mal,
    // on laisse le tag specifique gerer le cas pour eviter un double -2.
    if (tag.startsWith("malus_toucher_ennemi:") || tag.startsWith("malus_attaque_ennemi:")) {
      if (hasProtectionSpecificMalus) continue;

      const amount = Math.abs(add2eAttackParseSignedValue(tag.split(":")[1], 0));
      if (amount) {
        value -= amount;
        details.push(`Effet defensif cible : -${amount} au toucher`);
      }
      continue;
    }

    // Format explicite pour Protection contre le Mal et variantes similaires.
    if (tag.startsWith("malus_attaque_creature_mauvaise:")) {
      const amount = Math.abs(add2eAttackParseSignedValue(tag.split(":")[1], 0));
      if (amount && isEvil) {
        value -= amount;
        details.push(`Protection contre le Mal : -${amount} au toucher`);
      }
      continue;
    }

    // Formats generiques :
    // malus_attaque_vs:<tag_attaquant>:<valeur>
    // malus_toucher_vs:<tag_attaquant>:<valeur>
    // Exemple : malus_attaque_vs:alignement:mauvais:2
    if (tag.startsWith("malus_attaque_vs:") || tag.startsWith("malus_toucher_vs:")) {
      const parts = tag.split(":");
      const amount = Math.abs(add2eAttackParseSignedValue(parts.at(-1), 0));
      const matcher = parts.slice(1, -1).join(":");

      if (amount && matcher && add2eAttackTagSetHasMatcher(attackerTags, matcher)) {
        value -= amount;
        details.push(`Effet defensif cible (${matcher}) : -${amount} au toucher`);
      }
      continue;
    }

    // Format volontairement signe : bonus_attaque_ennemi:-2
    // Permet de modeliser d'autres sorts sans creer un nouveau code specifique.
    if (tag.startsWith("bonus_attaque_ennemi:")) {
      const amount = add2eAttackParseSignedValue(tag.split(":")[1], 0);
      if (amount) {
        value += amount;
        details.push(`Effet defensif cible : ${amount >= 0 ? "+" : ""}${amount} au toucher`);
      }
    }
  }

  return { value, details, attackerTags, targetEffectTags };
}

export function add2eAttackComputeActiveAttackModifiers({ actor, cible, combatProfile }) {
  let bonusToucheEffets = 0;
  let bonusDegatsEffets = 0;
  let bonusRacialVs = 0;
  const targetTags = add2eAttackBuildTargetTagSet(cible);
  let targetDefensiveAttackDetails = [];

  if (typeof Add2eEffectsEngine !== "undefined") {
    const typeCible = cible?.system?.type_monstre || cible?.system?.race || "";
    bonusRacialVs = Add2eEffectsEngine.getBonusToucheVs(actor, typeCible);

    const activeTags = Add2eEffectsEngine.getActiveTags(actor) ?? [];

    for (const rawTag of activeTags) {
      const t = add2eNormalizeAttackTag(rawTag);

      if (t.startsWith("bonus_attaque:")) {
        bonusToucheEffets += Number(t.split(":")[1]) || 0;
        continue;
      }

      if (t.startsWith("bonus_touche:")) {
        const parts = t.split(":");
        const matcher = parts[1];
        const valeur = Number(parts[2]) || 0;

        if (matcher && add2eTagSetMatches(combatProfile.tagSet, matcher)) {
          bonusToucheEffets += valeur;
        }
        continue;
      }

      if (t.startsWith("bonus_degats_vs:")) {
        const parts = t.split(":");
        const matcher = add2eNormalizeAttackTag(parts[1]);
        const valeurRaw = String(parts[2] ?? "").trim().toLowerCase();

        if (matcher && targetTags.has(matcher)) {
          const valeur = valeurRaw === "niveau"
            ? (Number(actor?.system?.niveau) || 1)
            : (Number(valeurRaw) || 0);

          bonusDegatsEffets += valeur;
        }
      }
    }

    const targetDefensive = add2eAttackComputeTargetDefensiveAttackModifiers({ actor, cible });
    if (targetDefensive.value !== 0) {
      bonusToucheEffets += targetDefensive.value;
      targetDefensiveAttackDetails = targetDefensive.details;

      console.log("[ADD2E][ATTAQUE][EFFETS_DEFENSIFS_CIBLE]", {
        attaquant: actor?.name,
        cible: cible?.name,
        value: targetDefensive.value,
        details: targetDefensive.details,
        attackerTags: [...targetDefensive.attackerTags],
        targetEffectTags: [...targetDefensive.targetEffectTags]
      });
    }
  }

  return {
    bonusToucheEffets,
    bonusDegatsEffets,
    bonusRacialVs,
    targetTags,
    targetDefensiveAttackDetails
  };
}

globalThis.ADD2E_ATTACK_MODIFIERS_VERSION = ADD2E_ATTACK_MODIFIERS_VERSION;

console.log("[ADD2E][ATTACK][04E][MODIFIERS_LOADED]", ADD2E_ATTACK_MODIFIERS_VERSION);
