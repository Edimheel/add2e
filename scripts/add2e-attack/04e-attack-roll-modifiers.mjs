// scripts/add2e-attack/04e-attack-roll-modifiers.mjs
// ADD2E - Attaque 04e : helpers generiques de modificateurs d'attaque.

import { add2eNormalizeAttackTag, add2eTagSetMatches } from "./03-attack-rules.mjs";

export function add2eAttackBuildTargetTagSet(cible) {
  const targetTags = new Set();

  const pushTargetTag = (value) => {
    if (Array.isArray(value)) {
      for (const v of value) pushTargetTag(v);
      return;
    }

    if (typeof value !== "string") return;

    for (const part of value.split(/[,;|]/)) {
      const n = add2eNormalizeAttackTag(part);
      if (!n) continue;

      targetTags.add(n);
      targetTags.add(n.replace(/^race:/, ""));
      targetTags.add(n.replace(/^type:/, ""));
      targetTags.add(n.replace(/^type_monstre:/, ""));
      targetTags.add(n.replace(/^creature:/, ""));
    }
  };

  pushTargetTag(cible?.name);
  pushTargetTag(cible?.system?.race);
  pushTargetTag(cible?.system?.type);
  pushTargetTag(cible?.system?.type_monstre);
  pushTargetTag(cible?.system?.categorie);
  pushTargetTag(cible?.system?.tags);
  pushTargetTag(cible?.system?.effectTags);
  pushTargetTag(cible?.flags?.add2e?.tags);

  return targetTags;
}

export function add2eAttackComputeActiveAttackModifiers({ actor, cible, combatProfile }) {
  let bonusToucheEffets = 0;
  let bonusDegatsEffets = 0;
  let bonusRacialVs = 0;
  const targetTags = add2eAttackBuildTargetTagSet(cible);

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
  }

  return {
    bonusToucheEffets,
    bonusDegatsEffets,
    bonusRacialVs,
    targetTags
  };
}

console.log("[ADD2E][ATTACK][04E][MODIFIERS_LOADED]");
