// scripts/add2e-attack/03-attack-rules.mjs
// ADD2E — Règles et helpers de résolution d’attaque.
// Version : 2026-08-05-canonical-thief-combat-skills-v2

import {
  add2eAttackComputeCharacterDisplayedCA
} from "./04d-attack-roll-defense.mjs";

export function add2eNormalizeAttackTag(value) {
  let tag = String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[\s\-]+/g, "_")
    .replace(/_+/g, "_");

  if (!tag) return "";

  const underscorePrefixes = [
    ["usage_", "usage:"],
    ["trait_", "trait:"],
    ["arme_", "arme:"],
    ["type_arme_", "type_arme:"],
    ["famille_arme_", "famille_arme:"],
    ["degat_", "degat:"],
    ["categorie_", "categorie:"],
    ["type_", "type:"],
    ["mod_carac_", "mod_carac:"]
  ];

  for (const [prefix, replacement] of underscorePrefixes) {
    if (tag.startsWith(prefix) && tag.length > prefix.length) {
      tag = replacement + tag.slice(prefix.length);
      break;
    }
  }

  tag = tag
    .replace(/:melee$/g, ":corps_a_corps")
    .replace(/:melee:/g, ":corps_a_corps:")
    .replace(/:mêlée$/g, ":corps_a_corps")
    .replace(/:dex$/g, ":dexterite")
    .replace(/:dext$/g, ":dexterite")
    .replace(/:aucun$/g, ":none");

  return tag;
}

export function add2eToAttackArray(value) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.flatMap(v => add2eToAttackArray(v));
  }

  if (typeof value === "string") {
    return value
      .split(/[,;|\n]+/)
      .map(v => v.trim())
      .filter(Boolean);
  }

  if (typeof value === "object") {
    for (const key of ["tags", "effectTags", "effecttags", "list", "items", "value"]) {
      if (value[key] !== undefined) return add2eToAttackArray(value[key]);
    }
  }

  return [];
}

export function add2eCollectAttackTags(arme) {
  const sys = arme?.system ?? {};
  const tags = new Set();

  const push = raw => {
    for (const value of add2eToAttackArray(raw)) {
      const tag = add2eNormalizeAttackTag(value);
      if (tag) tags.add(tag);
    }
  };

  push(sys.tags);
  push(sys.effectTags);
  push(sys.effecttags);
  push(sys.effets);
  push(sys.effects);
  push(arme?.flags?.add2e?.tags);

  const categorie = add2eNormalizeAttackTag(sys.categorie ?? sys.category ?? "");
  const type = add2eNormalizeAttackTag(sys.type ?? sys.type_arme ?? "");
  const famille = add2eNormalizeAttackTag(sys.famille ?? sys.famille_arme ?? "");
  const nom = add2eNormalizeAttackTag(arme?.name ?? sys.nom ?? "");

  if (categorie) tags.add(`categorie:${categorie}`);
  if (type) tags.add(`type:${type}`);
  if (famille) tags.add(`famille_arme:${famille}`);
  if (nom) {
    tags.add(`arme:${nom}`);
    tags.add(`type_arme:${nom}`);
  }

  return tags;
}

export function add2eTagSetHas(tags, ...values) {
  const set = tags instanceof Set ? tags : new Set(tags ?? []);
  return values.some(value => set.has(add2eNormalizeAttackTag(value)));
}

export function add2eTagSetMatches(tags, matcher) {
  const wanted = add2eNormalizeAttackTag(matcher);
  if (!wanted) return false;

  const set = tags instanceof Set ? tags : new Set(tags ?? []);
  if (set.has(wanted)) return true;

  for (const raw of set) {
    const tag = add2eNormalizeAttackTag(raw);
    if (!tag) continue;
    if (tag.endsWith(`:${wanted}`)) return true;
    if (tag.split(":").includes(wanted)) return true;
  }

  return false;
}

export function add2eNormalizeAngleDeg(angle) {
  const n = Number(angle);
  if (!Number.isFinite(n)) return 0;
  return ((n % 360) + 360) % 360;
}

export function add2eAngleDiffDeg(a, b) {
  const d = Math.abs(add2eNormalizeAngleDeg(a) - add2eNormalizeAngleDeg(b)) % 360;
  return d > 180 ? 360 - d : d;
}

export function add2eTokenCenterPoint(token) {
  if (!token) return null;
  if (token.center) return { x: Number(token.center.x), y: Number(token.center.y) };
  const doc = token.document ?? token;
  const gridSize = canvas?.grid?.size || 100;
  return {
    x: Number(doc.x || 0) + Number(doc.width || 1) * gridSize / 2,
    y: Number(doc.y || 0) + Number(doc.height || 1) * gridSize / 2
  };
}

export function add2eMeasureTokenGridDistance(tokenA, tokenB, { gridSpaces = true } = {}) {
  const a = add2eTokenCenterPoint(tokenA);
  const b = add2eTokenCenterPoint(tokenB);
  if (!a || !b) return 0;

  const grid = canvas?.grid;
  const gridSize = Number(grid?.size || 100) || 100;

  if (grid && typeof grid.measurePath === "function") {
    try {
      const result = grid.measurePath([a, b], { gridSpaces });
      const distance = Number(
        result?.distance ??
        result?.gridDistance ??
        result?.spaces ??
        result?.cost ??
        result
      );
      if (Number.isFinite(distance)) return distance;
    } catch (err) {
      console.warn("[ADD2E][ATTAQUE][DISTANCE][MEASURE_PATH_FAIL]", err);
    }
  }

  const dx = Math.abs(Number(b.x) - Number(a.x));
  const dy = Math.abs(Number(b.y) - Number(a.y));

  if (gridSpaces) return Math.max(dx, dy) / gridSize;

  const sceneDistance = Number(canvas?.scene?.grid?.distance || 1) || 1;
  return (Math.hypot(dx, dy) / gridSize) * sceneDistance;
}

export function add2eGetBackArcInfo(attackerToken, targetToken) {
  const attackerCenter = add2eTokenCenterPoint(attackerToken);
  const targetCenter = add2eTokenCenterPoint(targetToken);

  if (!attackerCenter || !targetCenter) {
    return {
      ok: false,
      zone: "unknown",
      isFront: false,
      isFlank: false,
      isRearFlank: false,
      isBehind: false,
      ignoresShield: false,
      ignoresDex: false,
      backAttackBonus: 0,
      reason: "token-missing",
      label: "Position inconnue"
    };
  }

  const dx = attackerCenter.x - targetCenter.x;
  const dy = attackerCenter.y - targetCenter.y;

  if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) {
    return {
      ok: false,
      zone: "unknown",
      isFront: false,
      isFlank: false,
      isRearFlank: false,
      isBehind: false,
      ignoresShield: false,
      ignoresDex: false,
      backAttackBonus: 0,
      reason: "same-center",
      label: "Position inconnue"
    };
  }

  const angleTargetToAttacker = add2eNormalizeAngleDeg(Math.atan2(dy, dx) * 180 / Math.PI);
  const targetRotation = add2eNormalizeAngleDeg(targetToken?.document?.rotation ?? targetToken?.rotation ?? 0);
  const targetFrontAngle = add2eNormalizeAngleDeg(90 + targetRotation);
  const targetBackAngle = add2eNormalizeAngleDeg(targetFrontAngle + 180);
  const diffBack = add2eAngleDiffDeg(angleTargetToAttacker, targetBackAngle);
  const diffFront = add2eAngleDiffDeg(angleTargetToAttacker, targetFrontAngle);

  const isBehind = diffBack <= 75;
  const isFront = !isBehind && diffFront <= 75;
  const isRearFlank = !isBehind && !isFront && diffBack <= 120;
  const isFlank = !isBehind && !isFront && !isRearFlank;

  let zone = "flank";
  let label = "Flanc";
  let reason = "flank";

  if (isBehind) {
    zone = "rear";
    label = "Dos";
    reason = "behind";
  } else if (isFront) {
    zone = "front";
    label = "Face";
    reason = "front";
  } else if (isRearFlank) {
    zone = "rear-flank";
    label = "Flanc arrière";
    reason = "rear-flank";
  }

  const ignoresShield = isFlank || isRearFlank || isBehind;
  const ignoresDex = isRearFlank || isBehind;
  const backAttackBonus = isBehind ? 2 : 0;

  return {
    ok: true,
    zone,
    isFront,
    isFlank,
    isRearFlank,
    isBehind,
    ignoresShield,
    ignoresDex,
    backAttackBonus,
    label,
    reason,
    targetRotation,
    targetFrontAngle,
    targetBackAngle,
    angleTargetToAttacker,
    diffBack,
    diffFront
  };
}

export function add2eBuildManualPositionInfo(zone, autoInfo = {}) {
  const normalized = String(zone || "front").trim().toLowerCase();

  const map = {
    front: {
      zone: "front",
      label: "Face",
      reason: "manual-front",
      isFront: true,
      isFlank: false,
      isRearFlank: false,
      isBehind: false,
      ignoresShield: false,
      ignoresDex: false,
      backAttackBonus: 0
    },
    flank: {
      zone: "flank",
      label: "Flanc",
      reason: "manual-flank",
      isFront: false,
      isFlank: true,
      isRearFlank: false,
      isBehind: false,
      ignoresShield: true,
      ignoresDex: false,
      backAttackBonus: 0
    },
    "rear-flank": {
      zone: "rear-flank",
      label: "Flanc arrière",
      reason: "manual-rear-flank",
      isFront: false,
      isFlank: false,
      isRearFlank: true,
      isBehind: false,
      ignoresShield: true,
      ignoresDex: true,
      backAttackBonus: 0
    },
    rear: {
      zone: "rear",
      label: "Dos",
      reason: "manual-rear",
      isFront: false,
      isFlank: false,
      isRearFlank: false,
      isBehind: true,
      ignoresShield: true,
      ignoresDex: true,
      backAttackBonus: 2
    }
  };

  const base = map[normalized] || map.front;

  return {
    ok: true,
    manual: true,
    autoZone: autoInfo?.zone || "unknown",
    autoLabel: autoInfo?.label || "Position auto inconnue",
    targetRotation: autoInfo?.targetRotation,
    targetFrontAngle: autoInfo?.targetFrontAngle,
    targetBackAngle: autoInfo?.targetBackAngle,
    angleTargetToAttacker: autoInfo?.angleTargetToAttacker,
    diffBack: autoInfo?.diffBack,
    diffFront: autoInfo?.diffFront,
    ...base
  };
}

export function add2eResolveSelectedPositionInfo(selectedZone, autoInfo) {
  const z = String(selectedZone || "front").trim().toLowerCase();
  if (z === "auto") return autoInfo?.ok ? autoInfo : add2eBuildManualPositionInfo("front", autoInfo);
  return add2eBuildManualPositionInfo(z, autoInfo);
}

export function add2eGetShieldIgnoredCAAdjustment(actor) {
  const defense = add2eAttackComputeCharacterDisplayedCA(actor, {
    source: "attack-position-shield",
    consumer: "attack-rules",
    ignoreShield: false,
    ignoresShield: false
  });
  const resolution = defense?.resolution ?? {};
  const value = Math.max(0, Number(resolution.shieldBonus) || 0);
  const labels = (resolution.shieldSources ?? [])
    .map(source => String(source ?? "").replace(/:[+\-]?\d+(?:\.\d+)?$/, ""))
    .filter(Boolean);
  return {
    value,
    label: labels.join(", "),
    item: null,
    resolution
  };
}

export function add2eGetDexIgnoredCAAdjustment(actor) {
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine ?? null;
  if (typeof engine?.resolveAbilityDerived !== "function") {
    throw new Error("Le résolveur canonique ADD2E des ajustements de caractéristiques n’est pas disponible.");
  }
  const derived = engine.resolveAbilityDerived(actor, "dexterite", {
    source: "attack-position-dex-defense",
    consumer: "attack-rules"
  });
  const dexDef = Number(derived?.profile?.def);
  if (!Number.isFinite(dexDef) || dexDef === 0) return { value: 0, raw: 0 };
  return { value: -dexDef, raw: dexDef };
}

export function add2eBuildPositionAttackAdjustment(actor, positionInfo) {
  const details = [];
  let caAdjustment = 0;
  let hitBonus = 0;

  if (!positionInfo?.ok) {
    return {
      caAdjustment,
      hitBonus,
      details,
      label: "Position inconnue",
      ignoresShield: false,
      ignoresDex: false
    };
  }

  if (positionInfo.ignoresShield) {
    const shield = add2eGetShieldIgnoredCAAdjustment(actor);
    if (shield.value) {
      caAdjustment += shield.value;
      details.push(`Bouclier ignoré${shield.label ? ` (${shield.label})` : ""} : CA +${shield.value}`);
    }
  }

  if (positionInfo.ignoresDex) {
    const dex = add2eGetDexIgnoredCAAdjustment(actor);
    if (dex.value) {
      caAdjustment += dex.value;
      details.push(`DEX défensive ignorée : CA ${dex.value >= 0 ? "+" : ""}${dex.value}`);
    }
  }

  if (positionInfo.backAttackBonus) {
    hitBonus += positionInfo.backAttackBonus;
    details.push(`Attaque de dos : +${positionInfo.backAttackBonus} toucher`);
  }

  return {
    caAdjustment,
    hitBonus,
    details,
    label: positionInfo.label,
    ignoresShield: !!positionInfo.ignoresShield,
    ignoresDex: !!positionInfo.ignoresDex
  };
}

function add2ePushUniqueAbility(list, ability) {
  const normalized = add2eNormalizeAttackTag(ability);
  if (normalized && !list.includes(normalized)) list.push(normalized);
}

export function add2eGetCombatStatProfile(arme) {
  const sys = arme?.system ?? {};
  const tags = add2eCollectAttackTags(arme);
  const has = (...values) => add2eTagSetHas(tags, ...values);

  const isProjectilePropulse = has(
    "usage:projectile_propulse",
    "categorie:projectile_propulse",
    "trait:projectile_propulse",
    "type:projectile_propulse"
  );

  const isLancer = has(
    "usage:lancer",
    "usage:jet",
    "usage:arme_de_jet",
    "categorie:projectile_lance",
    "trait:arme_de_jet",
    "type:arme_de_jet"
  );

  const isCorpsACorps = has(
    "usage:corps_a_corps",
    "usage:contact",
    "categorie:corps_a_corps",
    "categorie:contact",
    "categorie:melee",
    "type:corps_a_corps",
    "type:contact",
    "type:melee"
  );

  const noRange = Number(sys.portee_courte || 0) <= 0;
  const defaultContact = noRange && !isProjectilePropulse && !isLancer;

  const noToucherCarac = has("mod_carac:toucher:none");
  const noDegatsCarac = has("mod_carac:degats:none");
  const toucherCaracs = [];
  const degatsCaracs = [];

  if (!noToucherCarac) {
    for (const ability of ["force", "dexterite", "intelligence", "sagesse", "charisme"]) {
      if (has(`mod_carac:toucher:${ability}`)) add2ePushUniqueAbility(toucherCaracs, ability);
    }
    if (!toucherCaracs.length) {
      if (isProjectilePropulse) add2ePushUniqueAbility(toucherCaracs, "dexterite");
      else if (isLancer) {
        add2ePushUniqueAbility(toucherCaracs, "force");
        add2ePushUniqueAbility(toucherCaracs, "dexterite");
      } else if (isCorpsACorps || defaultContact) add2ePushUniqueAbility(toucherCaracs, "force");
    }
  }

  if (!noDegatsCarac) {
    for (const ability of ["force", "dexterite", "intelligence", "sagesse", "charisme"]) {
      if (has(`mod_carac:degats:${ability}`)) add2ePushUniqueAbility(degatsCaracs, ability);
    }
    if (!degatsCaracs.length && (isCorpsACorps || isLancer || defaultContact)) {
      add2ePushUniqueAbility(degatsCaracs, "force");
    }
  }

  const toucherCarac = toucherCaracs.length ? toucherCaracs.join("+") : null;
  const degatsCarac = degatsCaracs.length ? degatsCaracs.join("+") : null;

  return {
    tags: [...tags],
    tagSet: tags,
    toucherCarac,
    degatsCarac,
    toucherCaracs,
    degatsCaracs,
    isProjectilePropulse,
    isLancer,
    isCorpsACorps: isCorpsACorps || defaultContact
  };
}

function add2eAttackAbilityComponents(key) {
  const rawValues = Array.isArray(key) ? key : String(key ?? "").split("+");
  const components = [];
  for (const value of rawValues) add2ePushUniqueAbility(components, value);
  return components;
}

export function add2eGetAttackAbilityModifier(actor, key, usage) {
  const components = add2eAttackAbilityComponents(key);
  if (components.length > 1) {
    return components.reduce((total, ability) => total + add2eGetAttackAbilityModifier(actor, ability, usage), 0);
  }

  const normalized = components[0] ?? add2eNormalizeAttackTag(key);
  if (!normalized) return 0;
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine ?? null;
  if (typeof engine?.resolveAbilityDerived !== "function") {
    throw new Error("Le résolveur canonique ADD2E des ajustements de caractéristiques n’est pas disponible.");
  }

  const derived = engine.resolveAbilityDerived(actor, normalized, {
    source: "attack-ability-modifier",
    consumer: "attack-rules",
    usage
  });
  const profile = derived?.profile ?? {};

  if (normalized === "force") {
    return usage === "degats"
      ? Number(profile.degats) || 0
      : Number(profile.toucher) || 0;
  }

  if (normalized === "dexterite") {
    return usage === "degats"
      ? Number(profile.degats ?? 0) || 0
      : Number(profile.att ?? 0) || 0;
  }

  const candidates = usage === "degats"
    ? ["bonus_degats", "degats", "dom"]
    : ["bonus_toucher", "att", "attaque"];

  for (const field of candidates) {
    if (profile[field] !== undefined && profile[field] !== null && profile[field] !== "") {
      return Number(profile[field]) || 0;
    }
  }

  return 0;
}

export function add2eAttackAbilityLabel(key) {
  const labels = {
    force: "FOR",
    dexterite: "DEX",
    constitution: "CON",
    intelligence: "INT",
    sagesse: "SAG",
    charisme: "CHA"
  };
  const components = add2eAttackAbilityComponents(key);
  if (!components.length) return "Carac.";
  return components.map(component => labels[component] || "Carac.").join(" + ");
}

export function add2eIsOneUseWeapon(arme) {
  const tags = add2eCollectAttackTags(arme);
  return !!(
    arme?.system?.usageUnique === true ||
    arme?.system?.usage_unique === true ||
    arme?.system?.temporary === true ||
    arme?.system?.sourceCapacite === "paume_mortelle" ||
    arme?.flags?.add2e?.usageUnique === true ||
    arme?.flags?.add2e?.usage_unique === true ||
    arme?.flags?.add2e?.temporary === true ||
    arme?.flags?.add2e?.sourceCapacite === "paume_mortelle" ||
    add2eTagSetHas(tags, "usage_unique", "usage:unique", "combat:arme_temporaire", "moine:paume_mortelle")
  );
}

export async function add2eConsumeOneUseWeaponAfterAttack(actor, arme) {
  if (!actor || !arme || !add2eIsOneUseWeapon(arme)) return;

  try {
    const name = arme.name;
    await actor.deleteEmbeddedDocuments("Item", [arme.id]);
    ui.notifications.info(`${name} a été consommée et retirée des armes.`);
    console.log("[ADD2E][ATTAQUE][ARME USAGE UNIQUE][SUPPRESSION]", {
      actor: actor.name,
      itemId: arme.id,
      itemName: name
    });
  } catch (err) {
    console.warn("[ADD2E][ATTAQUE][ARME USAGE UNIQUE][ERREUR SUPPRESSION]", err);
  }
}

function add2eCanonicalThiefSkillKey(value) {
  const resolver = globalThis.add2eNormalizeThiefSkillKey;
  if (typeof resolver !== "function") {
    throw new Error("Le normalisateur canonique ADD2E des compétences de voleur est indisponible.");
  }
  return String(resolver(value) ?? "").trim();
}

function add2eCanonicalThiefProgression(actor) {
  const resolver = globalThis.add2eGetActorThiefProgression;
  if (typeof resolver !== "function") {
    throw new Error("Le résolveur canonique ADD2E de progression des compétences de voleur est indisponible.");
  }
  const row = resolver(actor);
  return row && typeof row === "object" ? row : null;
}

function add2eCanonicalThiefSkill(actor, key, progressionRow = null) {
  const resolver = globalThis.add2eGetActorThiefSkills;
  if (typeof resolver !== "function") {
    throw new Error("Le résolveur canonique ADD2E des compétences de voleur est indisponible.");
  }
  const wanted = add2eCanonicalThiefSkillKey(key);
  const rows = resolver(actor, progressionRow);
  if (!Array.isArray(rows)) {
    throw new Error("Le résolveur canonique ADD2E des compétences de voleur a renvoyé une valeur invalide.");
  }
  return rows.find(row => add2eCanonicalThiefSkillKey(row?.key) === wanted) ?? null;
}

function add2eThiefRowLevel(row) {
  const value = Number(row?.niveau ?? row?.level);
  return Number.isFinite(value) && value >= 1 ? Math.floor(value) : null;
}

export function add2eGetBackstabInfo(actor) {
  const row = add2eCanonicalThiefProgression(actor);
  const level = add2eThiefRowLevel(row);
  if (!row) {
    return {
      available: false,
      multiplier: 1,
      label: "Frappe dans le dos",
      source: "missing-canonical-progression",
      level
    };
  }

  const skill = add2eCanonicalThiefSkill(actor, "frappe_dans_le_dos", row);
  const multiplier = Number(skill?.finalValue ?? skill?.value ?? skill?.base);
  if (!Number.isFinite(multiplier) || multiplier <= 1) {
    return {
      available: false,
      multiplier: 1,
      label: skill?.label || "Frappe dans le dos",
      source: "missing-canonical-skill",
      level
    };
  }

  return {
    available: true,
    multiplier,
    label: skill?.label || "Frappe dans le dos",
    source: "add2eGetActorThiefSkills",
    level
  };
}

export function add2eGetAssassinationTargetLevel(cible) {
  const sys = cible?.system ?? {};
  const direct = Number(sys.niveau ?? sys.level ?? sys.niveau_effectif ?? sys.challengeLevel ?? sys.niveau_monstre);
  if (Number.isFinite(direct) && direct >= 0) return Math.floor(direct);

  const hdRaw = String(sys.hitDice ?? sys.dv ?? sys.des_de_vie ?? sys.hit_dice ?? "").trim();
  const match = hdRaw.match(/(\d+)/);
  if (match) return Math.max(0, Number(match[1]) || 0);

  return 0;
}

export function add2eGetAssassinationBracketKey(level) {
  const n = Math.max(0, Number(level) || 0);
  if (n <= 1) return "0-1";
  if (n <= 3) return "2-3";
  if (n <= 5) return "4-5";
  if (n <= 7) return "6-7";
  if (n <= 9) return "8-9";
  if (n <= 11) return "10-11";
  if (n <= 13) return "12-13";
  if (n <= 15) return "14-15";
  if (n <= 17) return "16-17";
  return "18+";
}

function add2eReadCanonicalAssassinationBase(row, targetLevel) {
  const table = row?.assassinationTableRow;
  if (!table || typeof table !== "object" || Array.isArray(table)) return null;
  const bracket = add2eGetAssassinationBracketKey(targetLevel);
  const raw = table[bracket];
  if (raw === undefined || raw === null || raw === "" || raw === "—" || raw === "-") return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return null;
  return {
    score: Math.max(0, Math.min(100, value)),
    bracket
  };
}

export function add2eGetAssassinationInfo(actor, cible = null) {
  const row = add2eCanonicalThiefProgression(actor);
  const level = add2eThiefRowLevel(row);
  const targetLevel = add2eGetAssassinationTargetLevel(cible);
  const targetBracket = add2eGetAssassinationBracketKey(targetLevel);

  if (!row) {
    return {
      available: false,
      score: 0,
      baseScore: 0,
      label: "Assassinat",
      breakdownTitle: "Aucune progression canonique d’assassin pour cet acteur",
      source: "missing-canonical-progression",
      level,
      rowLevel: level,
      targetLevel,
      targetBracket
    };
  }

  const tableResult = add2eReadCanonicalAssassinationBase(row, targetLevel);
  if (!tableResult) {
    return {
      available: false,
      score: 0,
      baseScore: 0,
      label: "Assassinat",
      breakdownTitle: `Aucune valeur dans progression.assassinationTableRow pour la cible ${targetBracket}`,
      source: "missing-assassinationTableRow-value",
      level,
      rowLevel: level,
      targetLevel,
      targetBracket
    };
  }

  const resolver = globalThis.add2eBuildThiefSkillRow;
  if (typeof resolver !== "function") {
    throw new Error("Le résolveur canonique ADD2E d’une compétence de voleur est indisponible.");
  }
  const resolved = resolver({
    keyRaw: "assassinat",
    valueRaw: tableResult.score,
    actor
  });
  if (!resolved) {
    throw new Error("La résolution canonique ADD2E de l’assassinat a échoué.");
  }

  return {
    available: true,
    score: Number(resolved.finalValue) || 0,
    baseScore: tableResult.score,
    label: resolved.label || "Assassinat",
    breakdownTitle: `${resolved.breakdownTitle} | Table d’assassinat : assassin niveau ${level ?? "?"}, cible niveau ${targetLevel} (${tableResult.bracket})`,
    source: "progression.assassinationTableRow+add2eBuildThiefSkillRow",
    resolution: resolved.resolution ?? null,
    bonuses: resolved.bonuses ?? [],
    level,
    rowLevel: level,
    targetLevel,
    targetBracket: tableResult.bracket
  };
}

export async function add2eRollAssassinationForAttack({ actor, score, situational = 0 }) {
  const finalScore = Math.max(0, Math.min(100, (Number(score) || 0) + (Number(situational) || 0)));
  const roll = await new Roll("1d100").evaluate();
  if (game.dice3d) await game.dice3d.showForRoll(roll);
  return {
    roll,
    total: roll.total,
    finalScore,
    success: roll.total <= finalScore,
    situational: Number(situational) || 0
  };
}

globalThis.add2eNormalizeAttackTag = add2eNormalizeAttackTag;
globalThis.add2eCollectAttackTags = add2eCollectAttackTags;
globalThis.add2eMeasureTokenGridDistance = add2eMeasureTokenGridDistance;
globalThis.add2eGetBackArcInfo = add2eGetBackArcInfo;
globalThis.add2eBuildPositionAttackAdjustment = add2eBuildPositionAttackAdjustment;
globalThis.add2eGetBackstabInfo = add2eGetBackstabInfo;
globalThis.add2eGetAssassinationInfo = add2eGetAssassinationInfo;
