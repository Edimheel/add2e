// scripts/actor-sheet/race-class-compatibility.mjs
// ADD2E — Compatibilité race/classe.

import {
  add2eNormalizeTags,
  add2eSlug,
  add2eNumber
} from "./utils.mjs";

export function add2eCompatibilityRuleFromValue(value) {
  if (value === undefined) return null;

  if (value === false) return { allowed: false, maxLevel: null, note: "Interdit" };
  if (value === true || value === null) return { allowed: true, maxLevel: null, note: "Autorisé" };

  if (typeof value === "number") return { allowed: true, maxLevel: value, note: `Autorisé jusqu'au niveau ${value}` };

  if (typeof value === "string") {
    const raw = value.trim().toLowerCase();
    const normalized = add2eSlug(raw);

    if (["non", "no", "false", "interdit", "forbidden", "deny", "refus"].includes(normalized)) {
      return { allowed: false, maxLevel: null, note: "Interdit" };
    }

    if (["oui", "yes", "true", "autorise", "allowed", "allow"].includes(normalized)) {
      return { allowed: true, maxLevel: null, note: "Autorisé" };
    }

    const n = Number(raw);
    if (Number.isFinite(n)) return { allowed: true, maxLevel: n, note: `Autorisé jusqu'au niveau ${n}` };

    return { allowed: true, maxLevel: null, note: value };
  }

  if (typeof value === "object") {
    const allowedRaw = value.allowed ?? value.autorise ?? value.autorisé ?? value.ok ?? true;
    const base = add2eCompatibilityRuleFromValue(allowedRaw) ?? { allowed: true, maxLevel: null };
    const maxRaw = value.maxLevel ?? value.niveauMax ?? value.limiteNiveau ?? value.levelMax ?? value.max;
    const maxLevel = maxRaw === null || maxRaw === undefined || maxRaw === "" ? null : Number(maxRaw);

    return {
      allowed: base.allowed !== false,
      maxLevel: Number.isFinite(maxLevel) ? maxLevel : null,
      note: value.note ?? value.description ?? base.note ?? ""
    };
  }

  return null;
}

export function add2eBuildRaceCompatibilityFromClassSystem(classSystem) {
  const output = {
    hasRules: false,
    mode: "allow_tags",
    source: "classe",
    races: {},
    ignoredFreeText: ""
  };

  if (!classSystem || typeof classSystem !== "object") return output;

  if (typeof classSystem.prerequis?.race === "string") output.ignoredFreeText = classSystem.prerequis.race;

  const raw = classSystem.raceRestriction;
  if (!raw || typeof raw !== "object") return output;

  output.hasRules = true;
  output.mode = add2eSlug(raw.mode ?? "allow_tags") || "allow_tags";
  output.source = String(raw.source ?? "classe");

  const rules = raw.races;
  if (!rules || typeof rules !== "object" || Array.isArray(rules)) return output;

  for (const [tag, value] of Object.entries(rules)) {
    const slug = add2eSlug(tag);
    if (!slug) continue;
    const rule = add2eCompatibilityRuleFromValue(value);
    if (rule) output.races[slug] = rule;
  }

  return output;
}

export function add2eRaceCandidateKeys(raceName, raceSystem = {}) {
  const keys = [];
  const add = value => {
    const slug = add2eSlug(value);
    if (slug) keys.push(slug);
  };

  add(raceName);
  add(raceSystem?.slug);
  add(raceSystem?.key);
  add(raceSystem?.id);
  add(raceSystem?.name);
  add(raceSystem?.label);

  const mainSlug = add2eSlug(raceName || raceSystem?.slug || raceSystem?.name || raceSystem?.label);
  if (mainSlug) add(`race:${mainSlug}`);

  for (const tag of add2eNormalizeTags(raceSystem?.identityTags ?? raceSystem?.raceTags ?? raceSystem?.tags)) add(tag);
  for (const tag of add2eNormalizeTags(raceSystem?.appliedTags)) add(tag);

  for (const tag of add2eNormalizeTags(raceSystem?.effectTags)) {
    if (String(tag).startsWith("race:")) add(tag);
  }

  return [...new Set(keys)].filter(Boolean);
}

export function add2eRaceIdentityTags(raceName, raceSystem = {}) {
  const tags = [];
  const mainSlug = add2eSlug(raceSystem?.slug || raceSystem?.key || raceName || raceSystem?.name || raceSystem?.label);

  if (mainSlug) tags.push(`race:${mainSlug}`);

  for (const tag of add2eNormalizeTags(raceSystem?.identityTags ?? raceSystem?.raceTags)) {
    if (tag) tags.push(tag);
  }

  return [...new Set(tags.map(t => String(t).trim()).filter(Boolean))];
}

export function add2eFindRaceCompatibilityRule(compatibility, raceName, raceSystem = {}) {
  if (!compatibility?.hasRules) return null;

  const candidates = add2eRaceCandidateKeys(raceName, raceSystem);

  for (const candidate of candidates) {
    if (compatibility.races[candidate]) return compatibility.races[candidate];
  }

  for (const [key, rule] of Object.entries(compatibility.races)) {
    const keySlug = add2eSlug(key);
    if (candidates.includes(keySlug)) return rule;
  }

  return null;
}

export function add2eEvaluateCompatibilityRule({ rule, actor, raceName, className, compatibility, sourceSide }) {
  if (!rule) return null;

  if (rule.allowed === false) {
    const sourceLabel = sourceSide === "classe" ? `La classe "${className}"` : `La race "${raceName}"`;
    const targetLabel = sourceSide === "classe" ? `la race "${raceName}"` : `la classe "${className}"`;

    return {
      ok: false,
      checked: true,
      sourceSide,
      compatibility,
      rule,
      reason: `${sourceLabel} interdit ${targetLabel}. ${rule.note || ""}`.trim()
    };
  }

  const level = add2eNumber(actor?.system?.niveau, 1);
  if (typeof rule.maxLevel === "number" && Number.isFinite(rule.maxLevel) && level > rule.maxLevel) {
    return {
      ok: false,
      checked: true,
      sourceSide,
      compatibility,
      rule,
      reason: `Compatibilité limitée au niveau ${rule.maxLevel} pour ${raceName} / ${className}, mais le personnage est niveau ${level}.`
    };
  }

  return {
    ok: true,
    checked: true,
    sourceSide,
    compatibility,
    rule,
    reason: typeof rule.maxLevel === "number" ? `Compatible, limite de niveau ${rule.maxLevel}.` : "Compatible."
  };
}

export function add2eCheckRaceClassCompatibility({ raceName, raceSystem, className, classSystem, actor }) {
  const raceCandidates = add2eRaceCandidateKeys(raceName, raceSystem);
  const displayRaceName = raceName || raceSystem?.name || raceSystem?.label || raceSystem?.slug || raceCandidates[0] || "race inconnue";

  if (!className) {
    return { ok: true, checked: false, sourceSide: "none", raceCandidates, reason: "Classe absente : aucune vérification race/classe nécessaire." };
  }

  if (!raceName && !raceCandidates.length) {
    return { ok: true, checked: false, sourceSide: "none", raceCandidates, reason: "Race absente : aucune vérification race/classe nécessaire." };
  }

  const classCompatibility = add2eBuildRaceCompatibilityFromClassSystem(classSystem);

  if (!classCompatibility.hasRules) {
    return {
      ok: false,
      checked: true,
      sourceSide: "classe",
      compatibility: classCompatibility,
      ignoredClassFreeText: classCompatibility.ignoredFreeText,
      reason: `La classe "${className}" ne possède pas de system.raceRestriction structuré. Drop refusé pour éviter une compatibilité implicite.`
    };
  }

  const rule = add2eFindRaceCompatibilityRule(classCompatibility, displayRaceName, raceSystem);
  const mode = add2eSlug(classCompatibility.mode || "allow_tags");

  if (!rule) {
    if (["allow", "allow_tag", "allow_tags", "liste_blanche", "whitelist", "autorise", "autorisees", "autorisées"].includes(mode)) {
      return {
        ok: false,
        checked: true,
        sourceSide: "classe",
        compatibility: classCompatibility,
        raceCandidates,
        reason: `La classe "${className}" n'autorise pas la race "${displayRaceName}".`
      };
    }

    return {
      ok: true,
      checked: true,
      sourceSide: "classe",
      compatibility: classCompatibility,
      raceCandidates,
      reason: `Aucune interdiction de race trouvée sur la classe "${className}" pour "${displayRaceName}".`
    };
  }

  const evaluated = add2eEvaluateCompatibilityRule({
    rule,
    actor,
    raceName: displayRaceName,
    className,
    compatibility: classCompatibility,
    sourceSide: "classe"
  });
  evaluated.raceCandidates = raceCandidates;
  return evaluated;
}
