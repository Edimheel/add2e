// scripts/add2e-attack/03-attack-rules.mjs
// ADD2E — Règles et helpers de résolution d’attaque.

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

  // Normalisation des aliases les plus fréquents.
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

  const push = (raw) => {
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

  // Compatibilité anciens champs structurants.
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

    // bonus_touche:epee:1 doit pouvoir matcher famille_arme:epee,
    // type_arme:epee ou arme:epee sans coder tous les cas.
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

  // Foundry V13+ : measurePath remplace measureDistances.
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

  // Fallback non déprécié : distance de grille carrée par diagonale ADD2E simple.
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

  // Repère écran : 0° = Est, 90° = Sud, 180° = Ouest, 270° = Nord.
  const angleTargetToAttacker = add2eNormalizeAngleDeg(Math.atan2(dy, dx) * 180 / Math.PI);

  // Convention ADD2E pour la position : rotation 0° du token = face vers le bas de la scène.
  // Repère écran : 0° = Est, 90° = Sud, 180° = Ouest, 270° = Nord.
  // Donc une rotation Foundry 0° correspond à 90° dans ce repère.
  const targetRotation = add2eNormalizeAngleDeg(targetToken?.document?.rotation ?? targetToken?.rotation ?? 0);
  const targetFrontAngle = add2eNormalizeAngleDeg(90 + targetRotation);
  const targetBackAngle = add2eNormalizeAngleDeg(targetFrontAngle + 180);
  const diffBack = add2eAngleDiffDeg(angleTargetToAttacker, targetBackAngle);
  const diffFront = add2eAngleDiffDeg(angleTargetToAttacker, targetFrontAngle);

  // Découpage volontairement simple pour Foundry :
  // - Face : arc frontal large.
  // - Dos : arc arrière strict, utilisé pour attaque sournoise/assassinat.
  // - Flanc arrière : annule aussi la DEX défensive.
  // - Flanc : annule seulement le bouclier.
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

export function add2eGetEquippedShieldForAttack(actor) {
  return actor?.items?.find?.(i => {
    const name = String(i?.name ?? "").toLowerCase();
    const sys = i?.system ?? {};
    return i?.type === "armure" && sys.equipee && (
      name.includes("bouclier") ||
      String(sys.categorie ?? sys.category ?? "").toLowerCase().includes("bouclier") ||
      String(sys.properties ?? sys.proprietes ?? "").toLowerCase().includes("bouclier")
    );
  }) ?? null;
}

export function add2eGetShieldIgnoredCAAdjustment(actor) {
  const shield = add2eGetEquippedShieldForAttack(actor);
  if (!shield) return { value: 0, label: "", item: null };

  const ac = Number(shield.system?.ac) || 0;
  const bonusAc = Number(shield.system?.bonus_ac) || 0;

  // Dans la fiche, le bouclier fait : CA -= ac ; CA += bonus_ac.
  // Pour l'ignorer, on retire ce bénéfice en sens inverse.
  const value = Math.max(0, ac - bonusAc);
  return {
    value,
    label: shield.name,
    item: shield
  };
}

export function add2eGetDexIgnoredCAAdjustment(actor) {
  const raw = actor?.system?.dex_def;
  const dexDef = Number(raw);
  if (!Number.isFinite(dexDef) || dexDef === 0) return { value: 0, raw: 0 };

  // Dans la fiche, la DEX défensive est ajoutée à la CA.
  // Bonne DEX = valeur négative ; mauvaise DEX = valeur positive.
  // L'ignorer revient à soustraire cette valeur de la CA finale.
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

  let toucherCarac = null;
  let degatsCarac = null;

  if (!noToucherCarac) {
    if (has("mod_carac:toucher:force")) toucherCarac = "force";
    else if (has("mod_carac:toucher:dexterite")) toucherCarac = "dexterite";
    else if (has("mod_carac:toucher:intelligence")) toucherCarac = "intelligence";
    else if (has("mod_carac:toucher:sagesse")) toucherCarac = "sagesse";
    else if (has("mod_carac:toucher:charisme")) toucherCarac = "charisme";
    else if (isProjectilePropulse) toucherCarac = "dexterite";
    else if (isCorpsACorps || isLancer || defaultContact) toucherCarac = "force";
  }

  if (!noDegatsCarac) {
    if (has("mod_carac:degats:force")) degatsCarac = "force";
    else if (has("mod_carac:degats:dexterite")) degatsCarac = "dexterite";
    else if (has("mod_carac:degats:intelligence")) degatsCarac = "intelligence";
    else if (has("mod_carac:degats:sagesse")) degatsCarac = "sagesse";
    else if (has("mod_carac:degats:charisme")) degatsCarac = "charisme";
    else if (isCorpsACorps || isLancer || defaultContact) degatsCarac = "force";
  }

  return {
    tags: [...tags],
    tagSet: tags,
    toucherCarac,
    degatsCarac,
    isProjectilePropulse,
    isLancer,
    isCorpsACorps: isCorpsACorps || defaultContact
  };
}

export function add2eGetAttackAbilityModifier(actor, key, usage) {
  const sys = actor?.system ?? {};
  const normalized = add2eNormalizeAttackTag(key);

  if (normalized === "force") {
    return usage === "degats"
      ? Number(sys.force_bonus_degats) || 0
      : Number(sys.force_bonus_toucher) || 0;
  }

  if (normalized === "dexterite") {
    return usage === "degats"
      ? Number(sys.dex_degats ?? sys.dex_damage ?? 0) || 0
      : Number(sys.dex_att ?? sys.dex_bonus_toucher ?? 0) || 0;
  }

  // Extension générique pour de futures armes spéciales.
  // Exemple tag : mod_carac:toucher:sagesse.
  const candidates = usage === "degats"
    ? [`${normalized}_bonus_degats`, `${normalized}_degats`, `${normalized}_dom`]
    : [`${normalized}_bonus_toucher`, `${normalized}_att`, `${normalized}_attaque`];

  for (const field of candidates) {
    if (sys[field] !== undefined && sys[field] !== null && sys[field] !== "") {
      return Number(sys[field]) || 0;
    }
  }

  return 0;
}

export function add2eAttackAbilityLabel(key) {
  const normalized = add2eNormalizeAttackTag(key);
  const labels = {
    force: "FOR",
    dexterite: "DEX",
    constitution: "CON",
    intelligence: "INT",
    sagesse: "SAG",
    charisme: "CHA"
  };
  return labels[normalized] || "Carac.";
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


export function add2eNormalizeAttackSkillKey(value) {
  return add2eNormalizeAttackTag(value)
    .replace(/^competence_voleur:/, "")
    .replace(/^competences_voleur:/, "")
    .replace(/^thief_skill:/, "")
    .replace(/^voleur:/, "");
}

export function add2eIsBackstabSkillKey(value) {
  const key = add2eNormalizeAttackSkillKey(value);
  return key === "frappe_dans_le_dos" ||
    key === "attaque_dans_le_dos" ||
    key === "attaque_sournoise" ||
    key === "backstab" ||
    key === "sneak_attack" ||
    (key.includes("dos") && (key.includes("frappe") || key.includes("attaque"))) ||
    (key.includes("sournoise") && key.includes("attaque"));
}

export function add2eAttackClone(value) {
  if (value === undefined || value === null) return value;
  try {
    if (foundry?.utils?.deepClone) return foundry.utils.deepClone(value);
    if (foundry?.utils?.duplicate) return foundry.utils.duplicate(value);
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}

export function add2eAttackClassNames(actor) {
  const details = actor?.system?.details_classe ?? {};
  return [
    actor?.system?.classe,
    details?.label,
    details?.name,
    details?.nom,
    details?.classe,
    details?.slug
  ].map(v => add2eNormalizeAttackTag(v)).filter(Boolean);
}

export function add2eAttackFindClassItem(actor) {
  const items = actor?.items?.filter?.(i => String(i?.type ?? "").toLowerCase() === "classe") ?? [];
  if (!items.length) return null;
  const wanted = add2eAttackClassNames(actor);
  if (wanted.length) {
    const found = items.find(i => {
      const sys = i.system ?? {};
      const names = [i.name, sys.label, sys.name, sys.nom, sys.classe, sys.slug]
        .map(v => add2eNormalizeAttackTag(v))
        .filter(Boolean);
      return names.some(n => wanted.includes(n));
    });
    if (found) return found;
  }
  return items[0] ?? null;
}

export function add2eAttackFindWorldClassSystem(actor) {
  const wanted = add2eAttackClassNames(actor);
  const names = [
    actor?.system?.classe,
    actor?.system?.details_classe?.label,
    actor?.system?.details_classe?.name,
    actor?.system?.details_classe?.nom
  ].filter(Boolean);

  for (const name of names) {
    const item = game?.items?.getName?.(name);
    if (item?.type === "classe") return add2eAttackClone(item.system ?? {}) || {};
  }

  if (wanted.length) {
    const item = game?.items?.find?.(i => {
      if (i?.type !== "classe") return false;
      const sys = i.system ?? {};
      const names = [i.name, sys.label, sys.name, sys.nom, sys.classe, sys.slug]
        .map(v => add2eNormalizeAttackTag(v))
        .filter(Boolean);
      return names.some(n => wanted.includes(n));
    });
    if (item) return add2eAttackClone(item.system ?? {}) || {};
  }

  return {};
}

export function add2eGetActorClassSystemForAttack(actor) {
  const details = add2eAttackClone(actor?.system?.details_classe ?? {}) || {};
  const item = add2eAttackFindClassItem(actor);
  const itemSystem = add2eAttackClone(item?.system ?? {}) || {};
  const worldSystem = add2eAttackFindWorldClassSystem(actor);

  let merged = {};
  for (const part of [details, itemSystem, worldSystem]) {
    if (foundry?.utils?.mergeObject) {
      merged = foundry.utils.mergeObject(merged, part || {}, { inplace: false, recursive: true });
    } else {
      merged = { ...merged, ...(part || {}) };
    }
  }

  merged.__classItemId = item?.id ?? null;
  merged.__classItemName = item?.name ?? merged.label ?? merged.name ?? actor?.system?.classe ?? null;
  return merged;
}

export function add2eAttackIsAssassinClass(cls, actor) {
  const names = [
    cls?.label,
    cls?.name,
    cls?.nom,
    cls?.classe,
    cls?.slug,
    cls?.__classItemName,
    actor?.system?.classe
  ].map(v => add2eNormalizeAttackTag(v)).filter(Boolean);
  return names.some(n => n.includes("assassin"));
}

export function add2eAttackIsThiefLikeClass(cls, actor) {
  const names = [
    cls?.label,
    cls?.name,
    cls?.nom,
    cls?.classe,
    cls?.slug,
    cls?.__classItemName,
    actor?.system?.classe
  ].map(v => add2eNormalizeAttackTag(v)).filter(Boolean);
  return names.some(n => n.includes("voleur") || n.includes("assassin"));
}

export function add2eGetAttackProgressionRow(actor) {
  const level = Math.max(1, Number(actor?.system?.niveau ?? actor?.system?.level ?? 1) || 1);

  // Les monstres n'ont pas d'item classe ni de progression de classe.
  // On ne doit donc pas journaliser PROGRESSION MANQUANTE pour eux.
  if (actor?.type !== "personnage") {
    return { cls: {}, level, row: null, rowLevel: null, isMonster: true };
  }

  const cls = add2eGetActorClassSystemForAttack(actor);
  const progression = Array.isArray(cls.progression) ? cls.progression : [];

  const rows = progression
    .map((r, idx) => ({ row: r, level: Number(r?.niveau ?? r?.level ?? idx + 1) || (idx + 1), idx }))
    .filter(x => x.row && Number.isFinite(x.level))
    .sort((a, b) => a.level - b.level);

  const exact = rows.find(x => x.level === level) || null;

  if (!exact) {
    console.warn("[ADD2E][ATTAQUE][PROGRESSION MANQUANTE]", {
      actor: actor?.name,
      classe: cls.__classItemName || cls.label || cls.name,
      niveauActeur: level,
      niveauxDisponibles: rows.map(x => x.level)
    });
  }

  return { cls, level, row: exact?.row ?? null, rowLevel: exact?.level ?? null };
}

export function add2eGetBackstabInfo(actor) {
  const { cls, level, row } = add2eGetAttackProgressionRow(actor);

  try {
    if (typeof globalThis.add2eGetActorThiefSkills === "function") {
      const skills = globalThis.add2eGetActorThiefSkills(actor, row) ?? [];
      const skill = skills.find(s => add2eIsBackstabSkillKey(s?.key ?? s?.label));
      const value = Number(skill?.finalValue ?? skill?.value ?? skill?.base ?? 0) || 0;
      if (value > 1) {
        return {
          available: true,
          multiplier: value,
          label: skill?.label || "Frappe dans le dos",
          source: "add2eGetActorThiefSkills",
          level
        };
      }
    }
  } catch (err) {
    console.warn("[ADD2E][ATTAQUE SOURNOISE] Lecture via add2eGetActorThiefSkills impossible.", err);
  }

  const structured = row?.thiefSkills && typeof row.thiefSkills === "object" ? row.thiefSkills : {};
  const candidates = [
    row?.backstabMultiplier,
    row?.backstab_multiplier,
    row?.frappeDansLeDos,
    row?.frappe_dans_le_dos,
    row?.attaqueDansLeDos,
    row?.attaque_dans_le_dos,
    row?.attaqueSournoise,
    row?.attaque_sournoise,
    structured.frappe_dans_le_dos,
    structured.attaque_dans_le_dos,
    structured.attaque_sournoise,
    structured.backstab,
    structured.sneak_attack,
    cls.backstabMultiplier,
    cls.backstab_multiplier,
    cls.frappeDansLeDos,
    cls.frappe_dans_le_dos,
    cls.attaqueDansLeDos,
    cls.attaque_dans_le_dos
  ];

  for (const raw of candidates) {
    const value = Number(raw) || 0;
    if (value > 1) {
      return { available: true, multiplier: value, label: "Frappe dans le dos", source: "progression", level };
    }
  }

  const labels = Array.isArray(cls.skillLabels) ? cls.skillLabels : [];
  const values = Array.isArray(row?.skills) ? row.skills : [];
  const idx = labels.findIndex(label => add2eIsBackstabSkillKey(label));
  if (idx >= 0) {
    const value = Number(values[idx]) || 0;
    // Ancien format : si la valeur legacy est déjà un multiplicateur exploitable, on l’utilise.
    if (value > 1 && value <= 10) {
      return { available: true, multiplier: value, label: labels[idx] || "Frappe dans le dos", source: "legacy-skills", level };
    }
  }

  return { available: false, multiplier: 1, label: "Frappe dans le dos", source: "none", level };
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

export function add2eReadAssassinationChanceFromClass(cls, assassinLevel, targetLevel) {
  const table = cls?.assassinationTable ?? cls?.assassinatTable ?? cls?.tableAssassinat;
  if (!table || typeof table !== "object") return null;

  const levelKey = String(Math.max(1, Number(assassinLevel) || 1));
  const row = table[levelKey] ?? table[Number(levelKey)];
  if (!row || typeof row !== "object") return null;

  const bracket = add2eGetAssassinationBracketKey(targetLevel);
  const raw = row[bracket];
  if (raw === undefined || raw === null || raw === "" || raw === "—" || raw === "-") return null;

  const match = String(raw).match(/-?\d+/);
  const value = match ? Number(match[0]) : Number(raw);
  if (!Number.isFinite(value) || value <= 0) return null;

  return {
    score: Math.max(0, Math.min(100, value)),
    bracket,
    source: "assassinationTable"
  };
}

export function add2eGetAssassinationInfo(actor, cible = null) {
  const { cls, level, row, rowLevel } = add2eGetAttackProgressionRow(actor);

  if (!row) {
    return {
      available: false,
      score: 0,
      label: "Assassinat",
      breakdownTitle: `Aucune progression exacte pour le niveau ${level}`,
      source: "missing-progression",
      level,
      rowLevel,
      targetLevel: null,
      targetBracket: null
    };
  }

  const targetLevel = add2eGetAssassinationTargetLevel(cible);
  const tableResult = add2eReadAssassinationChanceFromClass(cls, rowLevel ?? level, targetLevel);
  if (tableResult) {
    return {
      available: true,
      score: tableResult.score,
      label: "Assassinat",
      breakdownTitle: `Table d’assassinat : assassin niveau ${rowLevel ?? level}, cible niveau ${targetLevel} (${tableResult.bracket})`,
      source: tableResult.source,
      level,
      rowLevel,
      targetLevel,
      targetBracket: tableResult.bracket
    };
  }

  try {
    if (typeof globalThis.add2eGetActorThiefSkills === "function") {
      const skills = globalThis.add2eGetActorThiefSkills(actor, row) ?? [];
      const skill = skills.find(s => add2eNormalizeAttackSkillKey(s?.key ?? s?.label) === "assassinat");
      const value = Number(skill?.finalValue ?? skill?.value ?? skill?.base ?? 0) || 0;
      if (value > 0) {
        return {
          available: true,
          score: value,
          label: skill?.label || "Assassinat",
          breakdownTitle: skill?.breakdownTitle || `Base ${value}%`,
          source: "add2eGetActorThiefSkills",
          level,
          rowLevel,
          targetLevel,
          targetBracket: add2eGetAssassinationBracketKey(targetLevel)
        };
      }
    }
  } catch (err) {
    console.warn("[ADD2E][ASSASSINAT] Lecture via add2eGetActorThiefSkills impossible.", err);
  }

  const structured = row?.thiefSkills && typeof row.thiefSkills === "object" ? row.thiefSkills : {};
  const candidates = [structured.assassinat, row?.assassinat, row?.assassination, row?.compAssassin, cls.assassinat];

  for (const raw of candidates) {
    if (raw === undefined || raw === null || raw === "") continue;
    const match = String(raw).match(/(-?\d+)/);
    const value = match ? Number(match[1]) : Number(raw);
    if (Number.isFinite(value) && value > 0) {
      return {
        available: true,
        score: value,
        label: "Assassinat",
        breakdownTitle: `Base ${value}%`,
        source: "progression",
        level,
        rowLevel,
        targetLevel,
        targetBracket: add2eGetAssassinationBracketKey(targetLevel)
      };
    }
  }

  return {
    available: false,
    score: 0,
    label: "Assassinat",
    breakdownTitle: "Aucune valeur d’assassinat dans la progression de ce niveau",
    source: "none",
    level,
    rowLevel,
    targetLevel,
    targetBracket: add2eGetAssassinationBracketKey(targetLevel)
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
globalThis.add2eGetActorClassSystemForAttack = add2eGetActorClassSystemForAttack;
