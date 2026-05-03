// scripts/actor-sheet.mjs
// ADD2E — Drop race/classe : compatibilité UNIQUE portée par les objets classe via tags.
// Aucune restriction lue côté race, aucune table codée en dur.

const { ActorSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;

// =====================================================
// OUTILS
// =====================================================

const ADD2E_CARACS = [
  "force",
  "dexterite",
  "constitution",
  "intelligence",
  "sagesse",
  "charisme"
];

function add2eNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function add2eGetProperty(obj, path) {
  try {
    if (foundry?.utils?.getProperty) return foundry.utils.getProperty(obj, path);
  } catch (e) {}

  try {
    if (typeof getProperty === "function") return getProperty(obj, path);
  } catch (e) {}

  return String(path || "")
    .split(".")
    .reduce((o, k) => (o && typeof o === "object" ? o[k] : undefined), obj);
}

function add2eRaceAbilityValue(adjustments, shortKey, longKey) {
  return Number(adjustments?.[shortKey] ?? adjustments?.[longKey] ?? 0);
}

function add2eToTextList(value) {
  if (!value) return "";

  if (Array.isArray(value)) {
    return value.filter(Boolean).join(", ");
  }

  if (typeof value === "object") {
    return Object.values(value).filter(Boolean).join(", ");
  }

  return String(value);
}

function add2eToMultilineText(value) {
  if (!value) return "";

  if (Array.isArray(value)) {
    return value.filter(Boolean).join("\n");
  }

  if (typeof value === "object") {
    return Object.values(value).filter(Boolean).join("\n");
  }

  return String(value);
}

function add2eNormalizeTags(raw) {
  const result = [];

  const add = (v) => {
    if (!v) return;

    if (Array.isArray(v)) {
      for (const x of v) add(x);
      return;
    }

    if (v instanceof Set) {
      for (const x of Array.from(v)) add(x);
      return;
    }

    if (typeof v === "object") {
      if (Array.isArray(v.value)) add(v.value);
      else if (Array.isArray(v.tags)) add(v.tags);
      else if (Array.isArray(v.list)) add(v.list);
      else if (Array.isArray(v.items)) add(v.items);
      else if (Array.isArray(v.effectTags)) add(v.effectTags);
      else if (typeof v.value === "string") add(v.value);
      else if (typeof v.tags === "string") add(v.tags);
      else if (typeof v.list === "string") add(v.list);
      else if (typeof v.items === "string") add(v.items);
      else if (typeof v.effectTags === "string") add(v.effectTags);
      return;
    }

    String(v)
      .split(/[,;\n]+/)
      .map(t => t.trim())
      .filter(Boolean)
      .forEach(t => result.push(t));
  };

  add(raw);

  return [...new Set(result)];
}

function add2eSlug(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[_\s-]+/g, "_")
    .replace(/s$/, "");
}

function add2eCollectTagsFromEffect(effect) {
  if (!effect) return [];

  return [
    ...add2eNormalizeTags(effect.flags?.add2e?.tags),
    ...add2eNormalizeTags(effect.flags?.add2e?.effectTags)
  ];
}

function add2eCollectTagsFromItem(item) {
  const tags = [];
  if (!item) return tags;

  tags.push(...add2eNormalizeTags(item.system?.tags));
  tags.push(...add2eNormalizeTags(item.system?.tag));
  tags.push(...add2eNormalizeTags(item.system?.effectTags));
  tags.push(...add2eNormalizeTags(item.system?.effets));
  tags.push(...add2eNormalizeTags(item.system?.effects));
  tags.push(...add2eNormalizeTags(item.flags?.add2e?.tags));
  tags.push(...add2eNormalizeTags(item.flags?.add2e?.effectTags));

  const effects = item.effects?.contents ?? item.effects ?? [];
  for (const effect of effects) {
    tags.push(...add2eCollectTagsFromEffect(effect));
  }

  return [...new Set(tags)].filter(Boolean);
}

function add2eGetAbilityBase(actor, carac) {
  const sys = actor?.system ?? {};

  const explicitBase = Number(sys[`${carac}_base`]);
  if (Number.isFinite(explicitBase)) return explicitBase;

  const current = add2eNumber(sys[carac], 10);
  const oldRaceBonus = add2eNumber(sys.bonus_caracteristiques?.[carac], 0);
  const oldDiversBonus = add2eNumber(sys.bonus_divers_caracteristiques?.[carac], 0);

  return current - oldRaceBonus - oldDiversBonus;
}

async function add2eUpdateFinalCaracsLocal(actor) {
  if (!actor) return;

  const updates = {};

  for (const c of ADD2E_CARACS) {
    const base = add2eGetAbilityBase(actor, c);
    const bonusRace = add2eNumber(add2eGetProperty(actor.system, `bonus_caracteristiques.${c}`), 0);
    const bonusDivers = add2eNumber(add2eGetProperty(actor.system, `bonus_divers_caracteristiques.${c}`), 0);

    updates[`system.${c}_base`] = base;
    updates[`system.${c}`] = base + bonusRace + bonusDivers;
  }

  await actor.update(updates);
}

function add2eGetActorClassName(actor) {
  const sys = actor?.system ?? {};
  const ownedClass = actor?.items?.find?.(i => String(i.type).toLowerCase() === "classe");

  return (
    sys.details_classe?.name ||
    sys.details_classe?.label ||
    sys.details_classe?.slug ||
    sys.classe ||
    ownedClass?.name ||
    ownedClass?.system?.label ||
    ownedClass?.system?.slug ||
    ""
  );
}

function add2eGetActorClassSystem(actor) {
  const sys = actor?.system ?? {};

  if (sys.details_classe && typeof sys.details_classe === "object") {
    return sys.details_classe;
  }

  const ownedClass = actor?.items?.find?.(i => String(i.type).toLowerCase() === "classe");
  if (!ownedClass) return {};

  const system = foundry.utils.deepClone(ownedClass.system ?? {});
  system.name ??= ownedClass.name;
  system.label ??= ownedClass.name;
  system.appliedTags ??= add2eCollectTagsFromItem(ownedClass);
  return system;
}

function add2eGetActorRaceName(actor) {
  const sys = actor?.system ?? {};
  const ownedRace = actor?.items?.find?.(i => String(i.type).toLowerCase() === "race");

  return (
    sys.details_race?.name ||
    sys.details_race?.label ||
    sys.details_race?.slug ||
    sys.race ||
    ownedRace?.name ||
    ownedRace?.system?.label ||
    ownedRace?.system?.slug ||
    ""
  );
}

function add2eGetActorRaceSystem(actor) {
  const sys = actor?.system ?? {};

  if (sys.details_race && typeof sys.details_race === "object") {
    const details = foundry.utils.deepClone(sys.details_race);
    details.appliedTags = [
      ...add2eNormalizeTags(details.appliedTags),
      ...add2eNormalizeTags(actor?.flags?.add2e?.racialTags)
    ];
    return details;
  }

  const ownedRace = actor?.items?.find?.(i => String(i.type).toLowerCase() === "race");
  if (!ownedRace) return {};

  const system = foundry.utils.deepClone(ownedRace.system ?? {});
  system.name ??= ownedRace.name;
  system.label ??= ownedRace.name;
  system.appliedTags = [
    ...add2eRaceIdentityTags(ownedRace.name, system),
    ...add2eCollectTagsFromItem(ownedRace),
    ...add2eNormalizeTags(actor?.flags?.add2e?.racialTags)
  ];

  return system;
}

function add2eClassNameFromItem(item) {
  return item?.system?.slug || item?.system?.name || item?.system?.label || item?.name || "";
}

function add2eRaceNameFromItem(item) {
  return item?.system?.slug || item?.system?.name || item?.system?.label || item?.name || "";
}

function add2eCompatibilityRuleFromValue(value) {
  if (value === undefined) return null;

  if (value === false) {
    return { allowed: false, maxLevel: null, note: "Interdit" };
  }

  if (value === true || value === null) {
    return { allowed: true, maxLevel: null, note: "Autorisé" };
  }

  if (typeof value === "number") {
    return { allowed: true, maxLevel: value, note: `Autorisé jusqu'au niveau ${value}` };
  }

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
    if (Number.isFinite(n)) {
      return { allowed: true, maxLevel: n, note: `Autorisé jusqu'au niveau ${n}` };
    }

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

function add2eBuildRaceCompatibilityFromClassSystem(classSystem) {
  const output = {
    hasRules: false,
    mode: "allow_tags",
    source: "classe",
    races: {},
    ignoredFreeText: ""
  };

  if (!classSystem || typeof classSystem !== "object") return output;

  // Le texte libre reste affichable dans la fiche, mais il n'est jamais interprété.
  if (typeof classSystem.prerequis?.race === "string") {
    output.ignoredFreeText = classSystem.prerequis.race;
  }

  // Système unique attendu sur tous les objets classe :
  // system.raceRestriction.races, indexé par tags raciaux.
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

function add2eRaceCandidateKeys(raceName, raceSystem = {}) {
  const keys = [];

  const add = (value) => {
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

  for (const tag of add2eNormalizeTags(raceSystem?.identityTags ?? raceSystem?.raceTags ?? raceSystem?.tags)) {
    add(tag);
  }

  for (const tag of add2eNormalizeTags(raceSystem?.appliedTags)) {
    add(tag);
  }

  for (const tag of add2eNormalizeTags(raceSystem?.effectTags)) {
    // On ne transforme pas les effets raciaux en identité, mais si une race a été
    // mal saisie avec race:* dans effectTags, on garde la sécurité.
    if (String(tag).startsWith("race:")) add(tag);
  }

  return [...new Set(keys)].filter(Boolean);
}

function add2eRaceIdentityTags(raceName, raceSystem = {}) {
  const tags = [];
  const mainSlug = add2eSlug(raceSystem?.slug || raceSystem?.key || raceName || raceSystem?.name || raceSystem?.label);

  if (mainSlug) tags.push(`race:${mainSlug}`);

  for (const tag of add2eNormalizeTags(raceSystem?.identityTags ?? raceSystem?.raceTags)) {
    if (tag) tags.push(tag);
  }

  return [...new Set(tags.map(t => String(t).trim()).filter(Boolean))];
}

function add2eFindRaceCompatibilityRule(compatibility, raceName, raceSystem = {}) {
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

function add2eEvaluateCompatibilityRule({ rule, actor, raceName, className, compatibility, sourceSide }) {
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
    reason: typeof rule.maxLevel === "number"
      ? `Compatible, limite de niveau ${rule.maxLevel}.`
      : "Compatible."
  };
}

function add2eCheckRaceClassCompatibility({ raceName, raceSystem, className, classSystem, actor }) {
  const raceCandidates = add2eRaceCandidateKeys(raceName, raceSystem);
  const displayRaceName = raceName || raceSystem?.name || raceSystem?.label || raceSystem?.slug || raceCandidates[0] || "race inconnue";

  if (!className) {
    return {
      ok: true,
      checked: false,
      sourceSide: "none",
      raceCandidates,
      reason: "Classe absente : aucune vérification race/classe nécessaire."
    };
  }

  if (!raceName && !raceCandidates.length) {
    return {
      ok: true,
      checked: false,
      sourceSide: "none",
      raceCandidates,
      reason: "Race absente : aucune vérification race/classe nécessaire."
    };
  }

  // Système unique : la compatibilité race/classe est portée par l'objet classe.
  // Le script ne lit aucune restriction côté race.
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


// =====================================================
// PRÉREQUIS DE CLASSE PAR TAGS
// =====================================================
// Système unique : les prérequis mécaniques exploitables sont dans
// system.requirementTags de l'objet classe.
// Le champ system.prerequis reste un texte lisible, jamais interprété.

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

function add2eNormalizeAbilityKey(value) {
  const slug = add2eSlug(value);
  return ADD2E_ABILITY_ALIASES[slug] ?? slug;
}

function add2eProjectedAbilities(actor, raceSystem = null) {
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

function add2eAlignmentSlug(value) {
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

function add2eGetActorAlignmentSlug(actor) {
  const sys = actor?.system ?? {};
  const raw = sys.alignement ?? sys.alignment ?? sys.details?.alignement ?? "";
  return add2eAlignmentSlug(raw);
}

function add2eGetRequirementTagsFromClassSystem(classSystem) {
  const tags = [];

  tags.push(...add2eNormalizeTags(classSystem?.requirementTags));
  tags.push(...add2eNormalizeTags(classSystem?.requirementsTags));
  tags.push(...add2eNormalizeTags(classSystem?.prerequisiteTags));
  tags.push(...add2eNormalizeTags(classSystem?.prerequisTags));

  return [...new Set(tags.map(t => String(t).trim()).filter(Boolean))];
}

function add2eEvaluateRequirementTag(tag, context = {}) {
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

function add2eCheckClassRequirements({ actor, className, classSystem, projectedAbilities = null }) {
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


async function add2eDeleteOwnedItemsOfType(actor, type) {
  if (!actor?.items) return;

  const ids = actor.items
    .filter(i => String(i.type).toLowerCase() === String(type).toLowerCase())
    .map(i => i.id)
    .filter(Boolean);

  if (ids.length) {
    console.log(`[ADD2E][DROP][CLEAN] Suppression anciens items ${type} :`, ids);
    await actor.deleteEmbeddedDocuments("Item", ids);
  }
}

async function add2eCreateOwnedClone(actor, item, sourceType) {
  if (!actor || !item?.toObject) return null;

  const data = foundry.utils.deepClone(item.toObject());
  delete data._id;
  data.flags ??= {};
  data.flags.add2e ??= {};
  data.flags.add2e.appliedAs = sourceType;
  data.flags.add2e.appliedAt = Date.now();

  const created = await actor.createEmbeddedDocuments("Item", [data], { keepId: false });
  return created?.[0] ?? null;
}

async function add2eDeleteActorEffectsBySourceType(actor, sourceType) {
  if (!actor?.effects) return;

  const ids = actor.effects
    .filter(e => e.flags?.add2e?.sourceType === sourceType)
    .map(e => e.id)
    .filter(Boolean);

  if (ids.length) {
    console.log(`[ADD2E][DROP][CLEAN] Suppression anciens effets acteur ${sourceType} :`, ids);
    await actor.deleteEmbeddedDocuments("ActiveEffect", ids);
  }
}

// =====================================================
// FEUILLE ACTEUR ADD2E
// =====================================================

export class Add2eActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["add2e", "sheet", "actor", "personnage"],
      template: "systems/add2e/templates/actor/character-sheet.hbs",
      width: 1050,
      height: 900
    });
  }

  async getData(opts) {
    const ctx = await super.getData(opts);

    ctx.actor = this.actor;
    ctx.system = this.actor.system;
    ctx.items = this.actor.items?.contents ?? [];
    ctx.isGM = game.user.isGM;

    ctx.activeTab = this.actor.getFlag("add2e", "activeSheetTab") || this._add2eActiveTab || "resume";

    return ctx;
  }

  // =====================================================
  // ONGLET CLASSIQUE PERSISTANT
  // =====================================================

  _add2eRoot(html = null) {
    const element = html ?? this.element;
    if (!element) return null;

    if (element instanceof HTMLElement) return element;
    if (element.jquery && element[0] instanceof HTMLElement) return element[0];
    if (element[0] instanceof HTMLElement) return element[0];
    if (element.querySelector) return element;

    return null;
  }

  _add2eSheetRoot(html = null) {
    const root = this._add2eRoot(html);
    if (!root) return null;

    if (root.matches?.(".add2e-character-v3")) return root;
    return root.querySelector?.(".add2e-character-v3") ?? null;
  }

  _add2eActivateTab(tabName = "resume", html = null) {
    const sheet = this._add2eSheetRoot(html);
    if (!sheet) return;

    const tab = tabName || "resume";
    this._add2eActiveTab = tab;

    const hidden = sheet.querySelector(".a2e-active-tab-input");
    if (hidden) hidden.value = tab;

    sheet.querySelectorAll(".a2e-tabs .item[data-tab]").forEach(link => {
      link.classList.toggle("active", link.dataset.tab === tab);
    });

    sheet.querySelectorAll(".sheet-body .a2e-tab-content[data-tab]").forEach(section => {
      section.classList.toggle("active", section.dataset.tab === tab);
    });
  }

  _add2eBindTabs(html = null) {
    const sheet = this._add2eSheetRoot(html);
    if (!sheet) return;

    const initialTab =
      this.actor.getFlag("add2e", "activeSheetTab") ||
      this._add2eActiveTab ||
      sheet.querySelector(".a2e-tabs .item.active[data-tab]")?.dataset?.tab ||
      "resume";

    this._add2eActivateTab(initialTab, sheet);

    if (sheet.dataset.add2eTabsDelegated === "1") return;
    sheet.dataset.add2eTabsDelegated = "1";

    sheet.addEventListener("click", event => {
      const link = event.target.closest?.(".a2e-tabs .item[data-tab]");
      if (!link || !sheet.contains(link)) return;

      event.preventDefault();

      const tab = link.dataset.tab || "resume";
      this._add2eActivateTab(tab, sheet);

      if (this.actor?.isOwner) {
        this.actor.setFlag("add2e", "activeSheetTab", tab).catch(err => {
          console.warn("[ADD2E][TABS] Impossible de mémoriser l’onglet actif.", err);
        });
      }
    });
  }

  activateListeners(html) {
    super.activateListeners?.(html);
    this._add2eBindTabs(html);
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    this._add2eBindTabs(this.element);
  }

  async _onDropItem(event, data) {
    console.log("[add2e] DROP ITEM :", data);

    let item = null;

    if (data?.uuid) {
      item = await fromUuid(data.uuid);
    }

    if (!item) {
      ui.notifications.warn("Objet déposé introuvable.");
      return;
    }

    // =====================================================
    // DROP RACE
    // =====================================================
    if (item.type === "race") {
      const raceName = item.name;
      const raceSystem = foundry.utils.deepClone(item.system ?? {});
      const droppedRaceTags = [
        ...add2eRaceIdentityTags(raceName, raceSystem),
        ...add2eCollectTagsFromItem(item)
      ].filter(Boolean);
      raceSystem.appliedTags = droppedRaceTags;

      const currentClassName = add2eGetActorClassName(this.actor);
      const currentClassSystem = add2eGetActorClassSystem(this.actor);

      const compat = add2eCheckRaceClassCompatibility({
        raceName,
        raceSystem,
        className: currentClassName,
        classSystem: currentClassSystem,
        actor: this.actor
      });

      if (!compat.ok) {
        ui.notifications.error(compat.reason);
        console.warn("[ADD2E][DROP RACE][REFUS COMPATIBILITE]", {
          actor: this.actor.name,
          race: raceName,
          classe: currentClassName,
          compat
        });
        return;
      }

      const projectedAbilities = add2eProjectedAbilities(this.actor, raceSystem);
      const requirements = add2eCheckClassRequirements({
        actor: this.actor,
        className: currentClassName,
        classSystem: currentClassSystem,
        projectedAbilities
      });

      if (!requirements.ok) {
        ui.notifications.error(requirements.reason);
        console.warn("[ADD2E][DROP RACE][REFUS PREREQUIS CLASSE]", {
          actor: this.actor.name,
          race: raceName,
          classe: currentClassName,
          projectedAbilities,
          requirements
        });
        return;
      }

      const adjustments =
        raceSystem?.abilityAdjustments ||
        raceSystem?.data?.abilityAdjustments ||
        raceSystem?.bonus_caracteristiques ||
        {};

      const racialTags = droppedRaceTags;

      const bases = {};
      for (const c of ADD2E_CARACS) bases[c] = add2eGetAbilityBase(this.actor, c);

      await add2eDeleteOwnedItemsOfType(this.actor, "race");
      await add2eDeleteActorEffectsBySourceType(this.actor, "race");

      const raceDetails = {
        ...raceSystem,
        name: raceName,
        label: raceName,
        uuid: item.uuid ?? "",
        sourceId: item.id ?? "",
        appliedTags: racialTags,
        compatibilityChecked: compat,
        requirementsChecked: requirements
      };

      const maj = {
        "system.race": raceName,
        "system.details_race": raceDetails,

        "system.force_base": bases.force,
        "system.dexterite_base": bases.dexterite,
        "system.constitution_base": bases.constitution,
        "system.intelligence_base": bases.intelligence,
        "system.sagesse_base": bases.sagesse,
        "system.charisme_base": bases.charisme,

        "system.bonus_caracteristiques.force":
          add2eRaceAbilityValue(adjustments, "str", "force"),

        "system.bonus_caracteristiques.dexterite":
          add2eRaceAbilityValue(adjustments, "dex", "dexterite"),

        "system.bonus_caracteristiques.constitution":
          add2eRaceAbilityValue(adjustments, "con", "constitution"),

        "system.bonus_caracteristiques.intelligence":
          add2eRaceAbilityValue(adjustments, "int", "intelligence"),

        "system.bonus_caracteristiques.sagesse":
          add2eRaceAbilityValue(adjustments, "wis", "sagesse"),

        "system.bonus_caracteristiques.charisme":
          add2eRaceAbilityValue(adjustments, "cha", "charisme"),

        "system.langues":
          add2eToTextList(raceSystem?.languages ?? raceSystem?.langues),

        "system.special_racial":
          add2eToMultilineText(raceSystem?.specialAbilities ?? raceSystem?.special_racial ?? raceSystem?.capacites),

        "system.vitesse_deplacement":
          raceSystem?.speed ?? raceSystem?.vitesse ?? raceSystem?.movement ?? raceSystem?.vitesse_deplacement ?? this.actor.system?.vitesse_deplacement ?? ""
      };

      console.log("[ADD2E][DROP RACE][APPLICATION ATOMIQUE]", {
        actor: this.actor.name,
        ancienneRace: add2eGetActorRaceName(this.actor),
        nouvelleRace: raceName,
        classeActuelle: currentClassName,
        compat,
        bases,
        maj,
        racialTags,
        requirements
      });

      await this.actor.update(maj);
      await this.actor.setFlag("add2e", "racialTags", racialTags);
      await this.actor.setFlag("add2e", "raceClassCompatibility", compat);
      await this.actor.setFlag("add2e", "classRequirements", requirements);

      await add2eCreateOwnedClone(this.actor, item, "race");
      await add2eUpdateFinalCaracsLocal(this.actor);

      ui.notifications.info(`Race "${raceName}" appliquée. ${compat.reason}`);
      return;
    }

    // =====================================================
    // DROP CLASSE
    // =====================================================
    if (item.type !== "classe") {
      return;
    }

    const classeSystem = foundry.utils.deepClone(item.system ?? {});
    const currentRaceName = add2eGetActorRaceName(this.actor);
    const currentRaceSystem = add2eGetActorRaceSystem(this.actor);

    const compat = add2eCheckRaceClassCompatibility({
      raceName: currentRaceName,
      raceSystem: currentRaceSystem,
      className: add2eClassNameFromItem(item),
      classSystem: classeSystem,
      actor: this.actor
    });

    if (!compat.ok) {
      ui.notifications.error(compat.reason);
      console.warn("[ADD2E][DROP CLASSE][REFUS COMPATIBILITE]", {
        actor: this.actor.name,
        race: currentRaceName,
        raceSystem: currentRaceSystem,
        classe: item.name,
        classSystem: classeSystem,
        compat
      });
      return;
    }

    const requirements = add2eCheckClassRequirements({
      actor: this.actor,
      className: add2eClassNameFromItem(item),
      classSystem: classeSystem
    });

    if (!requirements.ok) {
      ui.notifications.error(requirements.reason);
      console.warn("[ADD2E][DROP CLASSE][REFUS PREREQUIS]", {
        actor: this.actor.name,
        race: currentRaceName,
        classe: item.name,
        requirements
      });
      return;
    }

    await add2eDeleteOwnedItemsOfType(this.actor, "classe");
    await add2eDeleteActorEffectsBySourceType(this.actor, "classe");

    const classTags = add2eCollectTagsFromItem(item);

    const maj = {
      "system.classe": item.name,
      "system.nom": this.actor.name,
      "system.niveau": 1,

      "system.points_de_coup":
        Number(item.system?.hitDie ?? item.system?.dv ?? 8),

      "system.special":
        add2eToMultilineText(item.system?.specialAbilities ?? item.system?.special ?? item.system?.capacites),

      "system.alignement":
        Array.isArray(item.system?.alignment)
          ? item.system.alignment[0]
          : (item.system?.alignment ?? ""),

      "system.armure_portee":
        add2eToTextList(item.system?.armorAllowed ?? item.system?.armures_autorisees),

      "system.bouclier":
        item.system?.shieldAllowed ? "Oui" : "Non",

      "system.pv_par_niveau":
        item.system?.hdPerLevel ?? "",

      "system.principale":
        item.system?.primaryAbility ?? "",

      "system.xp_progression":
        item.system?.progression ? JSON.stringify(item.system.progression) : "",

      "system.details_classe": {
        ...classeSystem,
        name: item.name,
        label: item.name,
        appliedTags: classTags,
        compatibilite_race: compat,
        requirementsChecked: requirements
      }
    };

    console.log("[ADD2E][DROP CLASSE][APPLICATION ATOMIQUE]", {
      actor: this.actor.name,
      raceActuelle: currentRaceName,
      classe: item.name,
      compat,
      requirements,
      maj,
      classTags
    });

    await this.actor.update(maj);
    await this.actor.setFlag("add2e", "classTags", classTags);
    await this.actor.setFlag("add2e", "raceClassCompatibility", compat);
    await this.actor.setFlag("add2e", "classRequirements", requirements);

    await add2eCreateOwnedClone(this.actor, item, "classe");

    ui.notifications.info(`Classe "${item.name}" appliquée. ${compat.reason}`);
  }
}

// =====================================================
// ONGLET ACTIF — PERSISTANCE ROBUSTE V15
// =====================================================
// Problème corrigé : quand une action de feuille déclenche un rerender
// (équiper une arme, éditer un item, modifier un champ), Foundry reconstruit
// le HTML. On mémorise donc l'onglet AVANT toute action dans la feuille,
// puis on le restaure après chaque reconstruction du DOM.

const ADD2E_ACTOR_TAB_KEY = "add2e.actorSheet.activeTab.";
globalThis.ADD2E_ACTOR_TABS_LAST ??= {};

function add2eSheetActorId(sheet) {
  if (!sheet) return "unknown";

  const fromSheet =
    sheet.dataset?.actorId ||
    sheet.getAttribute?.("data-actor-id") ||
    sheet.closest?.("[data-actor-id]")?.dataset?.actorId ||
    sheet.closest?.("[data-document-id]")?.dataset?.documentId ||
    "";

  if (fromSheet) return String(fromSheet);

  const app = sheet.closest?.(".application, .app, .window-app");
  const appId = app?.dataset?.appid || app?.id || "";

  return appId ? `app:${appId}` : "unknown";
}

function add2eSheetStorageKeys(sheet) {
  const actorId = add2eSheetActorId(sheet);
  return [
    `${ADD2E_ACTOR_TAB_KEY}${actorId}`,
    `${ADD2E_ACTOR_TAB_KEY}last`
  ];
}

function add2eSheetCurrentTab(sheet) {
  if (!sheet) return "resume";

  return (
    sheet.querySelector(".a2e-tabs .item.active[data-tab]")?.dataset?.tab ||
    sheet.querySelector(".sheet-body .a2e-tab-content.active[data-tab]")?.dataset?.tab ||
    sheet.querySelector(".a2e-active-tab-input")?.value ||
    sheet.dataset?.activeTab ||
    "resume"
  );
}

function add2eSheetRememberTab(sheet, tabName = null) {
  if (!sheet) return;

  const tab = tabName || add2eSheetCurrentTab(sheet) || "resume";

  sheet.dataset.activeTab = tab;

  const hidden = sheet.querySelector(".a2e-active-tab-input");
  if (hidden) hidden.value = tab;

  for (const key of add2eSheetStorageKeys(sheet)) {
    try {
      sessionStorage.setItem(key, tab);
      localStorage.setItem(key, tab);
    } catch (e) {}
  }

  globalThis.ADD2E_ACTOR_TABS_LAST[add2eSheetActorId(sheet)] = tab;
  globalThis.ADD2E_ACTOR_TABS_LAST.last = tab;
}

function add2eSheetStoredTab(sheet) {
  if (!sheet) return "resume";

  const actorId = add2eSheetActorId(sheet);
  const keys = add2eSheetStorageKeys(sheet);

  return (
    globalThis.ADD2E_ACTOR_TABS_LAST[actorId] ||
    globalThis.ADD2E_ACTOR_TABS_LAST.last ||
    keys.map(k => {
      try { return sessionStorage.getItem(k); } catch (e) { return null; }
    }).find(Boolean) ||
    keys.map(k => {
      try { return localStorage.getItem(k); } catch (e) { return null; }
    }).find(Boolean) ||
    sheet.querySelector(".a2e-active-tab-input")?.value ||
    "resume"
  );
}

function add2eSheetActivateTab(sheet, tabName = "resume") {
  if (!sheet) return;

  const tab = tabName || "resume";

  sheet.dataset.activeTab = tab;

  const hidden = sheet.querySelector(".a2e-active-tab-input");
  if (hidden) hidden.value = tab;

  sheet.querySelectorAll(".a2e-tabs .item[data-tab]").forEach(link => {
    link.classList.toggle("active", link.dataset.tab === tab);
  });

  sheet.querySelectorAll(".sheet-body .a2e-tab-content[data-tab]").forEach(section => {
    section.classList.toggle("active", section.dataset.tab === tab);
  });
}

function add2eSheetRestoreTab(sheet) {
  if (!sheet) return;

  const tab = add2eSheetStoredTab(sheet) || "resume";

  add2eSheetActivateTab(sheet, tab);
  add2eSheetRememberTab(sheet, tab);
}

function add2eRestoreAllActorSheetTabs() {
  for (const sheet of document.querySelectorAll(".add2e-character-v3")) {
    add2eSheetRestoreTab(sheet);
  }
}

function add2eInstallActorSheetTabPersistence() {
  if (globalThis.ADD2E_ACTOR_SHEET_TABS_V15_INSTALLED) return;
  globalThis.ADD2E_ACTOR_SHEET_TABS_V15_INSTALLED = true;

  document.addEventListener("pointerdown", event => {
    const sheet = event.target.closest?.(".add2e-character-v3");
    if (!sheet) return;

    const tabLink = event.target.closest?.(".a2e-tabs .item[data-tab]");
    if (tabLink) {
      add2eSheetActivateTab(sheet, tabLink.dataset.tab || "resume");
      add2eSheetRememberTab(sheet, tabLink.dataset.tab || "resume");
      return;
    }

    add2eSheetRememberTab(sheet);
  }, true);

  document.addEventListener("click", event => {
    const link = event.target.closest?.(".add2e-character-v3 .a2e-tabs .item[data-tab]");
    if (!link) return;

    event.preventDefault();

    const sheet = link.closest(".add2e-character-v3");
    const tab = link.dataset.tab || "resume";

    add2eSheetActivateTab(sheet, tab);
    add2eSheetRememberTab(sheet, tab);

    const actorId = add2eSheetActorId(sheet);
    const actor = game.actors?.get(actorId);
    if (actor?.isOwner) {
      actor.setFlag("add2e", "activeSheetTab", tab).catch(() => {});
    }
  }, true);

  document.addEventListener("change", event => {
    const sheet = event.target.closest?.(".add2e-character-v3");
    if (sheet) add2eSheetRememberTab(sheet);
  }, true);

  document.addEventListener("submit", event => {
    const sheet = event.target.closest?.(".add2e-character-v3");
    if (sheet) add2eSheetRememberTab(sheet);
  }, true);

  const delayedRestore = () => {
    requestAnimationFrame(() => {
      add2eRestoreAllActorSheetTabs();
      setTimeout(add2eRestoreAllActorSheetTabs, 30);
      setTimeout(add2eRestoreAllActorSheetTabs, 120);
    });
  };

  Hooks.on("renderAdd2eActorSheet", delayedRestore);
  Hooks.on("renderActorSheet", delayedRestore);
  Hooks.on("renderApplication", delayedRestore);
  Hooks.on("updateActor", delayedRestore);
  Hooks.on("updateItem", delayedRestore);
  Hooks.on("createItem", delayedRestore);
  Hooks.on("deleteItem", delayedRestore);

  const observer = new MutationObserver(() => delayedRestore());
  observer.observe(document.body, { childList: true, subtree: true });

  delayedRestore();

  console.log("[ADD2E][TABS] Persistance robuste V15 installée.");
}

if (game?.ready) {
  add2eInstallActorSheetTabPersistence();
} else {
  Hooks.once("ready", add2eInstallActorSheetTabPersistence);
}

globalThis.Add2eActorSheet = Add2eActorSheet;

// =====================================================
// ENREGISTREMENT FEUILLE ACTEUR
// =====================================================

Hooks.once("init", () => {
  console.log("[add2e] Hook init : override ActorSheet");

  try {
    Actors.unregisterSheet("core", ActorSheet);
  } catch (e) {
    console.warn("[add2e] Impossible de désenregistrer la feuille core ActorSheet :", e);
  }

  Actors.registerSheet("add2e", Add2eActorSheet, {
    types: ["personnage", "monster"],
    makeDefault: true,
    label: "ADD2e Descartes (FR)"
  });

  console.log("[add2e] Feuille acteur ADD2E enregistrée.");
});
