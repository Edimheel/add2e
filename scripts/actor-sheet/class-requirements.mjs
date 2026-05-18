// scripts/actor-sheet/class-requirements.mjs
// ADD2E — Pré-requis mécaniques de classe.

import {
  ADD2E_CARACS,
  add2eNumber,
  add2eGetProperty,
  add2eRaceAbilityValue,
  add2eGetAbilityBase,
  add2eSlug,
  add2eNormalizeTags
} from "./utils.mjs";

const ADD2E_ABILITY_ALIASES = {
  str: "force",
  for: "force",
  force: "force",
  dex: "dexterite",
  dexterite: "dexterite",
  dexterité: "dexterite",
  dext: "dexterite",
  con: "constitution",
  constitution: "constitution",
  int: "intelligence",
  intelligence: "intelligence",
  wis: "sagesse",
  sag: "sagesse",
  sagesse: "sagesse",
  cha: "charisme",
  charisme: "charisme"
};

export function add2eNormalizeAbilityKey(value) {
  const slug = add2eSlug(value);
  return ADD2E_ABILITY_ALIASES[slug] ?? slug;
}

export function add2eProjectedAbilities(actor, raceSystem = null) {
  const out = {};
  const adjustments = raceSystem
    ? (
        raceSystem?.abilityAdjustments ||
        raceSystem?.data?.abilityAdjustments ||
        raceSystem?.bonus_caracteristiques ||
        {}
      )
    : null;

  for (const c of ADD2E_CARACS) {
    if (adjustments) {
      const base = add2eGetAbilityBase(actor, c);
      const raceBonus = add2eRaceAbilityValue(
        adjustments,
        ({ force: "str", dexterite: "dex", constitution: "con", intelligence: "int", sagesse: "wis", charisme: "cha" })[c],
        c
      );
      const divers = add2eNumber(add2eGetProperty(actor?.system, `bonus_divers_caracteristiques.${c}`), 0);
      out[c] = base + raceBonus + divers;
    } else {
      out[c] = add2eNumber(actor?.system?.[c], 10);
    }
  }

  return out;
}

export function add2eAlignmentSlug(value) {
  const raw = add2eSlug(value);

  const aliases = {
    loyal_bon: "loyal_bon",
    lb: "loyal_bon",
    lawful_good: "loyal_bon",
    loyal_neutre: "loyal_neutre",
    ln: "loyal_neutre",
    lawful_neutral: "loyal_neutre",
    loyal_mauvais: "loyal_mauvais",
    lm: "loyal_mauvais",
    loyal_mal: "loyal_mauvais",
    lawful_evil: "loyal_mauvais",
    neutre_bon: "neutre_bon",
    nb: "neutre_bon",
    neutral_good: "neutre_bon",
    neutre_absolu: "neutre_absolu",
    neutre: "neutre_absolu",
    n: "neutre_absolu",
    true_neutral: "neutre_absolu",
    neutral: "neutre_absolu",
    neutre_mauvais: "neutre_mauvais",
    nm: "neutre_mauvais",
    neutre_mal: "neutre_mauvais",
    neutral_evil: "neutre_mauvais",
    chaotique_bon: "chaotique_bon",
    cb: "chaotique_bon",
    chaotic_good: "chaotique_bon",
    chaotique_neutre: "chaotique_neutre",
    cn: "chaotique_neutre",
    chaotic_neutral: "chaotique_neutre",
    chaotique_mauvais: "chaotique_mauvais",
    cm: "chaotique_mauvais",
    chaotique_mal: "chaotique_mauvais",
    chaotic_evil: "chaotique_mauvais"
  };

  return aliases[raw] ?? raw;
}

export function add2eGetActorAlignmentSlug(actor) {
  const sys = actor?.system ?? {};
  const raw = sys.alignement ?? sys.alignment ?? sys.details?.alignement ?? "";
  return add2eAlignmentSlug(raw);
}

export function add2eGetRequirementTagsFromClassSystem(classSystem) {
  const tags = [];

  tags.push(...add2eNormalizeTags(classSystem?.requirementTags));
  tags.push(...add2eNormalizeTags(classSystem?.requirementsTags));
  tags.push(...add2eNormalizeTags(classSystem?.prerequisiteTags));
  tags.push(...add2eNormalizeTags(classSystem?.prerequisTags));

  return [...new Set(tags.map(t => String(t).trim()).filter(Boolean))];
}

export function add2eEvaluateRequirementTag(tag, context = {}) {
  const original = String(tag ?? "").trim();
  if (!original) return { ok: true, ignored: true, tag: original };

  const parts = original.split(":").map(p => add2eSlug(p));
  const root = parts[0] || "";

  if (!["prerequis", "prerequisite", "requirement", "requirements"].includes(root)) {
    return { ok: true, ignored: true, tag: original };
  }

  const kind = parts[1] || "";

  if (["caracteristique", "carac", "ability", "stat", "score"].includes(kind)) {
    const ability = add2eNormalizeAbilityKey(parts[2]);
    const op = parts[3] || "min";
    const expected = Number(parts[4]);
    const current = add2eNumber(context.abilities?.[ability], NaN);

    if (!ability || !Number.isFinite(expected) || !Number.isFinite(current)) {
      return {
        ok: false,
        ignored: false,
        tag: original,
        reason: `Pré-requis invalide ou impossible à lire : ${original}`
      };
    }

    if (["min", "minimum", "gte", "au_moins"].includes(op) && current < expected) {
      return {
        ok: false,
        ignored: false,
        tag: original,
        reason: `${context.className || "Classe"} requiert ${ability} ${expected} minimum ; valeur actuelle ${current}.`
      };
    }

    if (["max", "maximum", "lte", "au_plus"].includes(op) && current > expected) {
      return {
        ok: false,
        ignored: false,
        tag: original,
        reason: `${context.className || "Classe"} requiert ${ability} ${expected} maximum ; valeur actuelle ${current}.`
      };
    }

    return { ok: true, ignored: false, tag: original };
  }

  if (["alignement", "alignment"].includes(kind)) {
    const op = parts[2] || "";
    const expected = add2eAlignmentSlug(parts.slice(3).join("_"));
    const current = add2eAlignmentSlug(context.alignmentSlug || "");

    if (["not", "interdit", "forbidden", "deny", "sauf", "exclude"].includes(op)) {
      if (expected && current && current === expected) {
        return {
          ok: false,
          ignored: false,
          tag: original,
          reason: `${context.className || "Classe"} interdit l'alignement ${expected}.`
        };
      }
      return { ok: true, ignored: false, tag: original };
    }

    if (["allow", "allowed", "autorise", "autorisees", "autorise", "only", "seulement"].includes(op)) {
      if (!expected) {
        return {
          ok: false,
          ignored: false,
          tag: original,
          reason: `Pré-requis d'alignement invalide : ${original}`
        };
      }

      if (!current || current !== expected) {
        return {
          ok: false,
          ignored: false,
          tag: original,
          reason: `${context.className || "Classe"} requiert l'alignement ${expected}. Alignement actuel : ${current || "non renseigné"}.`
        };
      }

      return { ok: true, ignored: false, tag: original };
    }
  }

  return {
    ok: true,
    ignored: true,
    tag: original,
    reason: `Tag de prérequis ignoré par le moteur actuel : ${original}`
  };
}

export function add2eCheckClassRequirements({ actor, className, classSystem, projectedAbilities = null }) {
  const tags = add2eGetRequirementTagsFromClassSystem(classSystem);

  if (!tags.length) {
    return {
      ok: true,
      checked: false,
      tags: [],
      reason: "Aucun system.requirementTags sur la classe."
    };
  }

  const abilities = projectedAbilities ?? add2eProjectedAbilities(actor, null);
  const alignmentSlug = add2eGetActorAlignmentSlug(actor);
  const results = tags.map(tag => add2eEvaluateRequirementTag(tag, {
    actor,
    className,
    classSystem,
    abilities,
    alignmentSlug
  }));

  const failures = results.filter(r => r && r.ok === false);

  if (failures.length) {
    return {
      ok: false,
      checked: true,
      tags,
      results,
      failures,
      reason: failures[0].reason || `Pré-requis de classe non respecté pour ${className}.`
    };
  }

  return {
    ok: true,
    checked: true,
    tags,
    results,
    reason: "Pré-requis de classe respectés."
  };
}
