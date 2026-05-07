/**
 * scripts/add2e-attack.js
 * Gestion des attaques, dégâts et sorts pour AD&D 2e
 * VERSION : 2026-05-05-attack-v25-scene-token-computed-ca
 * - Profil de combat générique par tags
 * - Bonus de caractéristique sans dépendance aux noms d’armes
 * - Consommation automatique des armes temporaires à usage unique
 */

globalThis.ADD2E_ATTACK_VERSION = "2026-05-05-attack-v25-scene-token-computed-ca";

// --- TABLE 39 : THAC0 MONSTRES ---
const MONSTER_THACO_TABLE = [
  { min: 0,    max: 0.99, thaco: 20 },
  { min: 1,    max: 1.99, thaco: 19 },
  { min: 2,    max: 2.99, thaco: 19 },
  { min: 3,    max: 3.99, thaco: 17 },
  { min: 4,    max: 4.99, thaco: 17 },
  { min: 5,    max: 5.99, thaco: 15 },
  { min: 6,    max: 6.99, thaco: 15 },
  { min: 7,    max: 7.99, thaco: 13 },
  { min: 8,    max: 8.99, thaco: 13 },
  { min: 9,    max: 9.99, thaco: 11 },
  { min: 10,   max: 10.99, thaco: 11 },
  { min: 11,   max: 11.99, thaco: 9 },
  { min: 12,   max: 12.99, thaco: 9 },
  { min: 13,   max: 13.99, thaco: 7 },
  { min: 14,   max: 14.99, thaco: 7 },
  { min: 15,   max: 15.99, thaco: 5 },
  { min: 16,   max: 999,   thaco: 5 }
];

function getMonsterThaco(hdString) {
  const match = String(hdString).match(/^(\d+)/);
  const hd = match ? parseFloat(match[1]) : 1;
  const entry = MONSTER_THACO_TABLE.find(e => hd >= e.min && hd <= e.max);
  return entry ? entry.thaco : 20;
}

function formatSortChamp(val, niveau = 1) {
  if (!val) return "-";
  if (typeof val === "object") {
    const v = val.valeur !== undefined ? val.valeur : "";
    const u = val.unite ? (" " + val.unite) : "";
    return `${v}${u}`.trim() || "-";
  }
  return val;
}

/**
 * Application des dégâts via le système de Flag (Unifié)
 */
/**
 * Application des dégâts via le système de Flag (Émetteur)
 */
/**
 * Application universelle de dégâts
 * - Joueur : envoie un "flag" de dégâts au MJ via socket
 * - MJ     : applique directement
 */
/**
 * Application universelle de dégâts
 * - Joueur : envoie un "flag" de dégâts au MJ via socket
 * - MJ     : applique directement
 */
async function add2eApplyDamage({ cible, montant, type = "", details = "" }) {
  if (!cible) {
    ui.notifications.error("Pas de cible !");
    return;
  }

  const dmg = Number(montant) || 0;
  console.log(`ADD2E SOCKET | 🎯 Demande de dégâts (${dmg}) sur`, cible?.name);

  // === CAS JOUEUR : on envoie un FLAG au MJ ===
  if (!game.user.isGM) {
    if (!game.socket) {
      console.warn("ADD2E SOCKET | ⚠️ game.socket indisponible côté joueur.");
      ui.notifications.error("Socket Foundry indisponible (game.socket).");
      return;
    }

    const tokenId =
      cible.token?.id ||
      (cible instanceof Token ? cible.id : null);

    const actorId =
      cible.actor?.id || // si cible = Token
      cible.id;          // si cible = Actor

    const flagData = {
      montant: dmg,
      type,
      details,
      source: "attack",
      fromUserId: game.user.id,
      timestamp: Date.now()
    };

    console.log("ADD2E SOCKET | 📤 Joueur -> emit applyDamageFlag :", {
      tokenId,
      actorId,
      flagData
    });

    game.socket.emit("system.add2e", {
      type: "applyDamageFlag",
      tokenId,
      actorId,
      flagData
    });

    ui.notifications.info(`Dégâts (${dmg}) envoyés au MJ.`);
    return;
  }

  // === CAS MJ : application directe ===
  console.log("ADD2E SOCKET | 🛠️ MJ -> Application directe dégâts.");

  const actor = cible.actor || cible;

  // Alignement strict sur ta fiche :
  // - max = system.points_de_coup
  // - courant = system.pdv
  const maxHP = Number(actor.system?.points_de_coup) || 0;

  // Si pdv n'existe pas, on l'initialise au max (sans toucher au max).
  let currentHP = actor.system?.pdv;
  if (currentHP === undefined || currentHP === null || currentHP === "" || isNaN(Number(currentHP))) {
    currentHP = maxHP;
  } else {
    currentHP = Number(currentHP) || 0;
  }

  const oldHP = currentHP;
  const newHP = oldHP - dmg; // dmg>0 => dégâts, dmg<0 => soins

  // Mise à jour UNIQUEMENT des PV courants
  // (PV max = points_de_coup ne bouge jamais ici)
  const updateData = { "system.pdv": newHP };

  // Optionnel mais recommandé : si pdv était absent, on force l’écriture (déjà inclus)
  await actor.update(updateData);

  console.log(
    `ADD2E SOCKET | 💉 PV courants sur ${actor.name} : ${oldHP} -> ${newHP} (${dmg >= 0 ? "-" : "+"}${Math.abs(dmg)}) | PV max inchangé = ${maxHP}`
  );

  // === Gestion états inconscient / mort via status overlay (MJ seulement) ===
  try {
    const DEAD_STATUS = "dead";
    const UNCONSCIOUS_STATUS = "unconscious";

    const toggleStatus = async (id, options) => {
      if (!id) return;
      await actor.toggleStatusEffect(id, options);
    };

    if (newHP <= -11) {
      await toggleStatus(UNCONSCIOUS_STATUS, { active: false, overlay: false });
      await toggleStatus(DEAD_STATUS,        { active: true,  overlay: true  });
      console.log("ADD2E SOCKET | 🎭 Statut overlay : MORT");
    } else if (newHP <= 0) {
      await toggleStatus(DEAD_STATUS,        { active: false, overlay: false });
      await toggleStatus(UNCONSCIOUS_STATUS, { active: true,  overlay: true  });
      console.log("ADD2E SOCKET | 🎭 Statut overlay : INCONSCIENT");
    } else {
      await toggleStatus(DEAD_STATUS,        { active: false, overlay: false });
      await toggleStatus(UNCONSCIOUS_STATUS, { active: false, overlay: false });
      console.log("ADD2E SOCKET | 🎭 Statut overlay : aucun (PV > 0)");
    }
  } catch (e) {
    console.warn("ADD2E SOCKET | ⚠️ Erreur mise à jour overlay HP (MJ direct) :", e);
  }

  ui.notifications.info(`${actor.name} prend ${dmg} dégâts.`);
}

// accès global pour macros
globalThis.add2eApplyDamage = add2eApplyDamage;



function getEffetTypeByNom(arme, mappingTable) {
  const nom = (arme.name || arme.system?.nom || "").toLowerCase();
  for (const entry of mappingTable) {
    if (entry.patterns.some(p => nom.includes(p))) {
      return entry.type;
    }
  }
  return "";
}

function plageToRollFormula(plage) {
  if (typeof plage !== "string") return plage;

  const v = plage.trim().toLowerCase();

  // Si c'est déjà une formule Foundry, on ne touche pas.
  if (v.includes("d")) return plage;

  // Conversion AD&D correcte des plages de dégâts.
  const table = {
    "1-2": "1d2",
    "1-3": "1d3",
    "1-4": "1d4",
    "1-6": "1d6",
    "1-8": "1d8",
    "1-10": "1d10",
    "1-12": "1d12",

    "2-5": "1d4+1",
    "2-7": "1d6+1",
    "2-8": "2d4",
    "2-12": "2d6",
    "2-16": "2d8",

    "3-9": "3d3",
    "3-12": "3d4",
    "3-18": "3d6"
  };

  return table[v] || plage;
}

// ============================================================
// ADD2E — Profil de combat générique par tags
// ------------------------------------------------------------
// Le script ne teste pas les noms d’armes.
// Les objets armes déclarent leur comportement avec des tags :
// - usage:corps_a_corps       => FOR toucher + FOR dégâts
// - usage:lancer              => FOR toucher + FOR dégâts
// - usage:projectile_propulse => DEX toucher
// Cas spéciaux sans modifier le code :
// - mod_carac:toucher:force / dexterite / none
// - mod_carac:degats:force / dexterite / none
// ============================================================
function add2eNormalizeAttackTag(value) {
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

function add2eToAttackArray(value) {
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

function add2eCollectAttackTags(arme) {
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

function add2eTagSetHas(tags, ...values) {
  const set = tags instanceof Set ? tags : new Set(tags ?? []);
  return values.some(value => set.has(add2eNormalizeAttackTag(value)));
}

function add2eTagSetMatches(tags, matcher) {
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


function add2eNormalizeAngleDeg(angle) {
  const n = Number(angle);
  if (!Number.isFinite(n)) return 0;
  return ((n % 360) + 360) % 360;
}

function add2eAngleDiffDeg(a, b) {
  const d = Math.abs(add2eNormalizeAngleDeg(a) - add2eNormalizeAngleDeg(b)) % 360;
  return d > 180 ? 360 - d : d;
}

function add2eTokenCenterPoint(token) {
  if (!token) return null;
  if (token.center) return { x: Number(token.center.x), y: Number(token.center.y) };
  const doc = token.document ?? token;
  const gridSize = canvas?.grid?.size || 100;
  return {
    x: Number(doc.x || 0) + Number(doc.width || 1) * gridSize / 2,
    y: Number(doc.y || 0) + Number(doc.height || 1) * gridSize / 2
  };
}

function add2eMeasureTokenGridDistance(tokenA, tokenB, { gridSpaces = true } = {}) {
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

function add2eGetBackArcInfo(attackerToken, targetToken) {
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


function add2eBuildManualPositionInfo(zone, autoInfo = {}) {
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

function add2eResolveSelectedPositionInfo(selectedZone, autoInfo) {
  const z = String(selectedZone || "front").trim().toLowerCase();
  if (z === "auto") return autoInfo?.ok ? autoInfo : add2eBuildManualPositionInfo("front", autoInfo);
  return add2eBuildManualPositionInfo(z, autoInfo);
}

function add2eGetEquippedShieldForAttack(actor) {
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

function add2eGetShieldIgnoredCAAdjustment(actor) {
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

function add2eGetDexIgnoredCAAdjustment(actor) {
  const raw = actor?.system?.dex_def;
  const dexDef = Number(raw);
  if (!Number.isFinite(dexDef) || dexDef === 0) return { value: 0, raw: 0 };

  // Dans la fiche, la DEX défensive est ajoutée à la CA.
  // Bonne DEX = valeur négative ; mauvaise DEX = valeur positive.
  // L'ignorer revient à soustraire cette valeur de la CA finale.
  return { value: -dexDef, raw: dexDef };
}

function add2eBuildPositionAttackAdjustment(actor, positionInfo) {
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

function add2eGetCombatStatProfile(arme) {
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

function add2eGetAttackAbilityModifier(actor, key, usage) {
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

function add2eAttackAbilityLabel(key) {
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

function add2eIsOneUseWeapon(arme) {
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

async function add2eConsumeOneUseWeaponAfterAttack(actor, arme) {
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


function add2eNormalizeAttackSkillKey(value) {
  return add2eNormalizeAttackTag(value)
    .replace(/^competence_voleur:/, "")
    .replace(/^competences_voleur:/, "")
    .replace(/^thief_skill:/, "")
    .replace(/^voleur:/, "");
}

function add2eIsBackstabSkillKey(value) {
  const key = add2eNormalizeAttackSkillKey(value);
  return key === "frappe_dans_le_dos" ||
    key === "attaque_dans_le_dos" ||
    key === "attaque_sournoise" ||
    key === "backstab" ||
    key === "sneak_attack" ||
    (key.includes("dos") && (key.includes("frappe") || key.includes("attaque"))) ||
    (key.includes("sournoise") && key.includes("attaque"));
}

function add2eAttackClone(value) {
  if (value === undefined || value === null) return value;
  try {
    if (foundry?.utils?.deepClone) return foundry.utils.deepClone(value);
    if (foundry?.utils?.duplicate) return foundry.utils.duplicate(value);
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}

function add2eAttackClassNames(actor) {
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

function add2eAttackFindClassItem(actor) {
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

function add2eAttackFindWorldClassSystem(actor) {
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

function add2eGetActorClassSystemForAttack(actor) {
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

function add2eAttackIsAssassinClass(cls, actor) {
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

function add2eAttackIsThiefLikeClass(cls, actor) {
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

function add2eGetAttackProgressionRow(actor) {
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

function add2eGetBackstabInfo(actor) {
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

function add2eGetAssassinationTargetLevel(cible) {
  const sys = cible?.system ?? {};
  const direct = Number(sys.niveau ?? sys.level ?? sys.niveau_effectif ?? sys.challengeLevel ?? sys.niveau_monstre);
  if (Number.isFinite(direct) && direct >= 0) return Math.floor(direct);

  const hdRaw = String(sys.hitDice ?? sys.dv ?? sys.des_de_vie ?? sys.hit_dice ?? "").trim();
  const match = hdRaw.match(/(\d+)/);
  if (match) return Math.max(0, Number(match[1]) || 0);

  return 0;
}

function add2eGetAssassinationBracketKey(level) {
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

function add2eReadAssassinationChanceFromClass(cls, assassinLevel, targetLevel) {
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

function add2eGetAssassinationInfo(actor, cible = null) {
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

async function add2eRollAssassinationForAttack({ actor, score, situational = 0 }) {
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

/**
 * Script principal d'attaque AD&D2e
 */
async function add2eAttackRoll({ actor, arme, actorId, itemId }) {
  if (!actor && actorId) actor = game.actors.get(actorId);
  if (!arme && itemId && actor) arme = actor.items.get(itemId);

  if (!actor) return ui.notifications.warn("Acteur introuvable !");
  if (!arme) return ui.notifications.warn("Arme introuvable !");
  if (!arme.system.equipee) return ui.notifications.warn(`L'arme "${arme.name}" n'est pas équipée !`);

  // Si l'attaque part depuis une fiche de token non lié, actor.token.object est la vraie source scène.
  // actor.getActiveTokens()[0] peut pointer sur un autre token du même acteur ou sur l'acteur de base.
  const srcToken = actor?.token?.object ?? actor.getActiveTokens()[0];
  const chatImg = srcToken?.document.texture.src || actor.img;

  const cibleToken = Array.from(game.user.targets)[0];
  const cible = cibleToken ? cibleToken.actor : null;
  if (!cibleToken) return ui.notifications.warn("Aucune cible sélectionnée !");

  console.log("[ADD2E][ATTAQUE][SCENE_TOKEN_SOURCE][V25]", {
    attaquant: actor?.name,
    attaquantActorId: actor?.id,
    attaquantTokenId: actor?.token?.id ?? null,
    srcTokenId: srcToken?.id ?? null,
    cible: cible?.name,
    cibleActorId: cible?.id,
    cibleTokenId: cibleToken?.id,
    cibleEstActeurDeToken: !!cible?.token,
    cibleSystemStocke: {
      ca_total: cible?.system?.ca_total,
      ca_naturel: cible?.system?.ca_naturel,
      armorClass: cible?.system?.armorClass,
      ca: cible?.system?.ca,
      dexterite: cible?.system?.dexterite,
      dexterite_base: cible?.system?.dexterite_base
    }
  });
// =======================
// CONTRÔLE DISTANCE AVANT DIALOGUE
// =======================
const isDistanceWeapon = (arme.system.portee_courte ?? 0) > 0;

let distanceCible = 0;
let auContact = false;

try {
  if (srcToken && cibleToken) {
    distanceCible = add2eMeasureTokenGridDistance(srcToken, cibleToken, { gridSpaces: true });

    // Calcul du contact même pour les armes possédant une portée.
    // Exemple : dague utilisable au contact ET parfois lancée.
    const gridSize = canvas.grid.size;

    const sLeft = srcToken.document.x / gridSize;
    const sTop = srcToken.document.y / gridSize;
    const sRight = sLeft + (srcToken.document.width || 1);
    const sBottom = sTop + (srcToken.document.height || 1);

    const tLeft = cibleToken.document.x / gridSize;
    const tTop = cibleToken.document.y / gridSize;
    const tRight = tLeft + (cibleToken.document.width || 1);
    const tBottom = tTop + (cibleToken.document.height || 1);

    const gapX = Math.max(0, tLeft - sRight, sLeft - tRight);
    const gapY = Math.max(0, tTop - sBottom, sTop - tBottom);

    auContact = gapX <= 0.01 && gapY <= 0.01;
  }
} catch (e) {
  console.warn("ADD2E | Erreur mesure distance/contact :", e);
  distanceCible = 0;
  auContact = false;
}

// Arme strictement de contact : bloquée au-delà du contact.
// Les armes avec portée peuvent encore être utilisées à distance, mais les options
// attaque sournoise/assassinat ne seront proposées que si la cible est au contact.
if (!isDistanceWeapon && !auContact) {
  ui.notifications.error("Cible trop éloignée pour une arme de contact.");
  return;
}

// Arme à distance : bloquée hors portée longue
if (isDistanceWeapon) {
  const porteeLongue = Number(arme.system.portee_longue) || 0;

  if (porteeLongue > 0 && distanceCible > porteeLongue) {
    ui.notifications.error("Cible hors de portée.");
    return;
  }
}

  const preCombatProfile = add2eGetCombatStatProfile(arme);
  const backstabInfo = add2eGetBackstabInfo(actor);
  const assassinationInfo = add2eGetAssassinationInfo(actor, cible);
  const backArcInfo = add2eGetBackArcInfo(srcToken, cibleToken);

  console.log("[ADD2E][ATTAQUE][POSITION][AUTO][V25]", {
    attaquant: actor?.name,
    cible: cible?.name,
    srcToken: srcToken?.name,
    cibleToken: cibleToken?.name,
    zone: backArcInfo?.zone,
    label: backArcInfo?.label,
    targetRotation: backArcInfo?.targetRotation,
    targetFrontAngle: backArcInfo?.targetFrontAngle,
    targetBackAngle: backArcInfo?.targetBackAngle,
    angleTargetToAttacker: backArcInfo?.angleTargetToAttacker,
    diffFront: backArcInfo?.diffFront,
    diffBack: backArcInfo?.diffBack,
    isFront: backArcInfo?.isFront,
    isFlank: backArcInfo?.isFlank,
    isRearFlank: backArcInfo?.isRearFlank,
    isBehind: backArcInfo?.isBehind,
    note: "Diagnostic uniquement : la position réellement appliquée est choisie dans la fenêtre d’attaque."
  });

  // La rotation des illustrations de token n'est pas une donnée fiable de facing :
  // certaines images regardent déjà vers le haut/bas sans que document.rotation change.
  // On affiche donc le diagnostic automatique, mais la résolution applique par défaut FACE.
  // Le MJ/joueur choisit explicitement Flanc/Dos dans la fenêtre si la situation le justifie.
  const defaultPositionInfo = add2eBuildManualPositionInfo("front", backArcInfo);
  const positionAttackAdjustment = add2eBuildPositionAttackAdjustment(cible, defaultPositionInfo);
  const specialAttackWeaponCompatible = !preCombatProfile.isProjectilePropulse;
  const specialAttackPositionCompatible = auContact;
  const canUseBackstab = backstabInfo.available && backstabInfo.multiplier > 1 && specialAttackWeaponCompatible && specialAttackPositionCompatible;
  const canUseAssassination = assassinationInfo.available && assassinationInfo.score > 0 && specialAttackWeaponCompatible && specialAttackPositionCompatible;

  console.log("[ADD2E][ATTAQUE][SOURNOISE/ASSASSINAT][ELIGIBILITE]", {
    acteur: actor.name,
    arme: arme.name,
    auContact,
    isDistanceWeapon,
    positionAuto: backArcInfo,
    positionParDefaut: defaultPositionInfo,
    positionAttackAdjustment,
    combatProfile: preCombatProfile,
    classeVoleurOuAssassin: add2eAttackIsThiefLikeClass(add2eGetActorClassSystemForAttack(actor), actor),
    backstabInfo,
    assassinationInfo,
    specialAttackWeaponCompatible,
    specialAttackPositionCompatible,
    canUseBackstab,
    canUseAssassination
  });

  const attackDistanceLabel = auContact
    ? "Contact"
    : (isDistanceWeapon ? `${Number(distanceCible || 0).toFixed(1)} cases` : "Hors contact");

  const backstabStatusLabel = canUseBackstab
    ? `Disponible : +4 toucher, dégâts ×${backstabInfo.multiplier}`
    : (backstabInfo.available
      ? "Non disponible : pas dans le dos, hors contact ou arme non compatible"
      : "Non disponible : aucune progression de frappe dans le dos");

  const assassinationStatusLabel = canUseAssassination
    ? `Disponible : ${assassinationInfo.score}% contre cible niv. ${assassinationInfo.targetLevel} si l’attaque touche`
    : (assassinationInfo.available
      ? "Non disponible : pas dans le dos, hors contact ou arme non compatible"
      : "Non disponible : aucune compétence d’assassinat");

  const specialOptionsVisible = canUseBackstab || canUseAssassination || backstabInfo.available || assassinationInfo.available;

  return new Promise((resolve) => {
    new Dialog({
      title: "Bonus/Malus d’attaque",
      content: `
        <style>
          .add2e-attack-form {
            --a2e-gold: #b88924;
            --a2e-dark: #5d3d0d;
            --a2e-line: #d9bf73;
            --a2e-bg: #fff8df;
            display: grid;
            gap: 8px;
            color: #2f250c;
          }
          .add2e-attack-top {
            display: grid;
            grid-template-columns: 1fr 36px 1fr;
            gap: 8px;
            align-items: center;
          }
          .add2e-attack-box {
            border: 1px solid var(--a2e-line);
            border-radius: 9px;
            background: #fffdf4;
            padding: 8px 10px;
          }
          .add2e-attack-label {
            font-size: .76rem;
            font-weight: 900;
            text-transform: uppercase;
            color: var(--a2e-dark);
          }
          .add2e-attack-name {
            font-size: 1.05rem;
            font-weight: 900;
            margin-top: 2px;
          }
          .add2e-attack-pill {
            display: inline-flex;
            margin-top: 5px;
            padding: 2px 7px;
            border: 1px solid #d4af55;
            border-radius: 999px;
            background: #fff3c7;
            font-weight: 800;
            color: var(--a2e-dark);
          }
          .add2e-attack-arrow {
            text-align: center;
            font-size: 1.7rem;
            color: var(--a2e-dark);
          }
          .add2e-attack-line {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            border: 1px solid var(--a2e-line);
            border-radius: 9px;
            background: #fffdf4;
            padding: 8px 10px;
          }
          .add2e-attack-line label,
          .add2e-check-title {
            font-weight: 900;
            color: #3b2a0f;
          }
          .add2e-attack-line input[type="number"] {
            width: 74px;
            border: 1px solid var(--a2e-line);
            border-radius: 7px;
            background: #fffaf0;
            padding: 5px 7px;
            font-weight: 900;
            text-align: center;
          }
          .add2e-special-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
          }
          .add2e-check {
            display: grid;
            grid-template-columns: 24px 1fr;
            gap: 8px;
            align-items: center;
            border: 1px solid var(--a2e-line);
            border-radius: 9px;
            background: #fff8e8;
            padding: 9px 10px;
          }
          .add2e-check input[type="checkbox"] {
            width: 18px;
            height: 18px;
          }
          .add2e-check-meta {
            margin-top: 2px;
            font-size: .86rem;
            color: #6b5a2a;
            font-weight: 800;
          }
        </style>

        <form class="add2e-attack-form">
          <div class="add2e-attack-top">
            <div class="add2e-attack-box">
              <div class="add2e-attack-label">Attaquant</div>
              <div class="add2e-attack-name">${actor.name}</div>
              <span class="add2e-attack-pill">${arme.name}</span>
            </div>
            <div class="add2e-attack-arrow">→</div>
            <div class="add2e-attack-box">
              <div class="add2e-attack-label">Cible</div>
              <div class="add2e-attack-name">${cible?.name ?? "Cible"}</div>
              <span class="add2e-attack-pill">${attackDistanceLabel}</span>
              <span class="add2e-attack-pill">Position : Face</span>
              <span class="add2e-attack-pill" title="Diagnostic uniquement">Auto : ${backArcInfo.label}</span>
            </div>
          </div>

          <div class="add2e-attack-line">
            <label for="add2e-bonus-attaque">Modificateur au toucher</label>
            <input id="add2e-bonus-attaque" type="number" value="0" step="1">
          </div>

          <div class="add2e-attack-line">
            <label for="add2e-position-zone">Position réelle</label>
            <select id="add2e-position-zone" style="width:160px;border:1px solid var(--a2e-line);border-radius:7px;background:#fffaf0;padding:5px 7px;font-weight:900;">
              <option value="front" selected>Face</option>
              <option value="flank">Flanc</option>
              <option value="rear-flank">Flanc arrière</option>
              <option value="rear">Dos</option>
              <option value="auto">Auto détecté (${backArcInfo.label})</option>
            </select>
          </div>

          <div style="margin:-4px 0 6px 0;font-size:.78rem;color:#6b5a2a;font-weight:800;line-height:1.25;">
            La position automatique est un diagnostic. Par défaut la résolution applique Face pour éviter les faux dos liés à la rotation des images de token.
          </div>

          ${positionAttackAdjustment.details.length ? `
          <div class="add2e-attack-line" style="font-weight:800;color:#5d3d0d;align-items:flex-start;">
            <span>Position</span>
            <span style="text-align:right;">${positionAttackAdjustment.details.join("<br>")}</span>
          </div>
          ` : ""}

          ${specialOptionsVisible ? `
          <div class="add2e-special-grid">
            ${canUseBackstab ? `
            <label class="add2e-check">
              <input type="checkbox" id="add2e-backstab">
              <span>
                <span class="add2e-check-title">Attaque sournoise</span>
                <span class="add2e-check-meta">+4 toucher · dégâts ×${backstabInfo.multiplier}</span>
              </span>
            </label>
            ` : ""}

            ${canUseAssassination ? `
            <label class="add2e-check">
              <input type="checkbox" id="add2e-assassinat-confirm">
              <span>
                <span class="add2e-check-title">Assassinat</span>
                <span class="add2e-check-meta">${assassinationInfo.score}% si l’attaque touche</span>
              </span>
            </label>
            ` : ""}
          </div>

          ${canUseAssassination ? `
          <div class="add2e-attack-line">
            <label for="add2e-assassinat-mod">Modificateur assassinat</label>
            <input id="add2e-assassinat-mod" type="number" value="0" step="1">
          </div>
          ` : ""}
          ` : ""}
        </form>
      `,
      buttons: {
        ok: {
          label: "Lancer l'attaque",
          callback: async (dlgHtml) => {
            const userBonus = Number(dlgHtml.find("#add2e-bonus-attaque").val()) || 0;
            const selectedPositionZone = String(dlgHtml.find("#add2e-position-zone").val() || "front");
            const activePositionInfo = add2eResolveSelectedPositionInfo(selectedPositionZone, backArcInfo);
            const activePositionAttackAdjustment = add2eBuildPositionAttackAdjustment(cible, activePositionInfo);
            const useBackstab = canUseBackstab && activePositionInfo.isBehind && !!dlgHtml.find("#add2e-backstab").is(":checked");
            const useAssassination = canUseAssassination && activePositionInfo.isBehind && !!dlgHtml.find("#add2e-assassinat-confirm").is(":checked");
            const assassinatMod = Number(dlgHtml.find("#add2e-assassinat-mod").val()) || 0;
            const categorieArme = arme.system.categorie || "melee";

            console.log("[ADD2E][ATTAQUE][POSITION][APPLIQUEE][V25]", {
              attaquant: actor?.name,
              cible: cible?.name,
              selectedPositionZone,
              activePositionInfo,
              activePositionAttackAdjustment,
              auto: backArcInfo
            });

            // --- Calcul portée et malus ---
            let dist = 0, malusPortee = 0, descPortee = "", typePortee = "Contact";
            const isDistance = (arme.system.portee_courte ?? 0) > 0;

            if (isDistance) {
              const pC = Number(arme.system.portee_courte) || 0;
              const pM = Number(arme.system.portee_moyenne) || 0;
              const pL = Number(arme.system.portee_longue) || 0;

              if (srcToken && cibleToken) {
                try {
                  const d = add2eMeasureTokenGridDistance(srcToken, cibleToken, { gridSpaces: true });
                  dist = d;
                } catch (e) { dist = 0; }
              }

              if (auContact) { descPortee = "Contact"; typePortee = "Contact"; }
              else if (dist <= pC) { descPortee = "Courte"; typePortee = "Courte"; }
              else if (dist <= pM) { descPortee = "Moyenne"; typePortee = "Moyenne"; malusPortee = -2; }
              else if (dist <= pL) { descPortee = "Longue"; typePortee = "Longue"; malusPortee = -5; }
              else { descPortee = "Hors de portée"; typePortee = "Loin"; }
            } else {
              dist = 1;
              descPortee = "Contact";
              typePortee = "Contact";
            }

            // --- 1. THAC0 ---
            const sys = actor.system || {};

            const add2eReadStrictNumber = (value) => {
              if (value === undefined || value === null || value === "") return null;
              const n = Number(value);
              return Number.isFinite(n) ? n : null;
            };

            const add2eNormalizeAttackText = (value) => String(value ?? "")
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .replace(/[’']/g, "")
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "_")
              .replace(/_+/g, "_")
              .replace(/^_|_$/g, "");

            const add2eAttackReadFirstNumber = (...values) => {
              for (const v of values) {
                const n = add2eReadStrictNumber(v);
                if (n !== null) return n;
              }
              return null;
            };

            const add2eAttackIsEquipped = (item) => {
              const sysItem = item?.system ?? {};
              return sysItem.equipee === true || sysItem.equipped === true || sysItem.portee === true || sysItem.worn === true;
            };

            const add2eAttackItemTags = (item) => {
              const sysItem = item?.system ?? {};
              const raw = [
                item?.name,
                sysItem.nom,
                sysItem.categorie,
                sysItem.type,
                ...(Array.isArray(sysItem.tags) ? sysItem.tags : []),
                ...(Array.isArray(sysItem.effectTags) ? sysItem.effectTags : [])
              ];
              return raw.map(add2eNormalizeAttackText).filter(Boolean);
            };

            const add2eAttackItemHasAnyTag = (item, ...needles) => {
              const text = add2eAttackItemTags(item).join(" ");
              return needles.some(n => text.includes(add2eNormalizeAttackText(n)));
            };

            const add2eAttackDexDefenseFromScore = (score) => {
              const dex = Number(score);
              if (!Number.isFinite(dex)) return 0;
              if (dex <= 3) return 4;
              if (dex === 4) return 3;
              if (dex === 5) return 2;
              if (dex === 6) return 1;
              if (dex <= 14) return 0;
              if (dex === 15) return -1;
              if (dex === 16) return -2;
              if (dex === 17) return -3;
              return -4;
            };

            const add2eAttackGetDexDefenseMod = (targetActor) => {
              const s = targetActor?.system ?? {};

              const direct = add2eAttackReadFirstNumber(
                s.dex_defense,
                s.dexDefense,
                s.ca_defense,
                s.caDefense,
                s.defense_ca,
                s.defenseCA,
                s.dexterite_defense,
                s.dexteriteDefense,
                s.dexterite_ca_defense,
                s.mod_dex_defense,
                s.modDexDefense,
                s?.caracs?.dexterite?.ca,
                s?.caracs?.dexterite?.defense,
                s?.caracs?.dex?.ca,
                s?.caracs?.dex?.defense,
                s?.abilities?.dex?.defense,
                s?.abilities?.dexterite?.defense
              );
              if (direct !== null) return { value: direct, source: "stored-dex-defense" };

              const score = add2eAttackReadFirstNumber(
                s.dexterite,
                s.dexterite_base,
                s.dex,
                s.dex_base,
                s.dexterity,
                s.dexterity_base,
                s?.caracs?.dexterite?.value,
                s?.caracs?.dexterite?.base,
                s?.abilities?.dex?.value,
                s?.abilities?.dex?.base
              );

              return {
                value: add2eAttackDexDefenseFromScore(score ?? 10),
                source: score === null ? "dex-default-10" : `dex-score-${score}`
              };
            };

            const add2eAttackGetArmorBaseCA = (targetActor) => {
              let best = 10;
              let source = "base-10";

              for (const item of targetActor?.items ?? []) {
                if (item?.type !== "armure") continue;
                if (!add2eAttackIsEquipped(item)) continue;
                if (add2eAttackItemHasAnyTag(item, "bouclier", "shield", "heaume", "casque", "helmet")) continue;

                const si = item.system ?? {};
                const itemCA = add2eAttackReadFirstNumber(si.ca, si.ac, si.armorClass, si.ca_base, si.base_ca, si.caTotal, si.ca_total);
                if (itemCA !== null && itemCA < best) {
                  best = itemCA;
                  source = `armure:${item.name}`;
                }
              }

              return { value: best, source };
            };

            const add2eAttackGetShieldAdjustment = (targetActor) => {
              let total = 0;
              const sources = [];

              for (const item of targetActor?.items ?? []) {
                if (item?.type !== "armure") continue;
                if (!add2eAttackIsEquipped(item)) continue;
                if (!add2eAttackItemHasAnyTag(item, "bouclier", "shield")) continue;

                const si = item.system ?? {};
                const raw = add2eAttackReadFirstNumber(si.bonus_ca, si.bonus_ac, si.ca_bonus, si.ac_bonus, si.mod_ca, si.mod_ac);
                const adj = raw === null ? -1 : (raw > 0 ? -raw : raw);
                total += adj;
                sources.push(`${item.name}:${adj}`);
              }

              return { value: total, source: sources.length ? sources.join(", ") : "none" };
            };

            const add2eAttackComputeCharacterDisplayedCA = (targetActor) => {
              const s = targetActor?.system ?? {};
              const armor = add2eAttackGetArmorBaseCA(targetActor);
              const dex = add2eAttackGetDexDefenseMod(targetActor);
              const shield = add2eAttackGetShieldAdjustment(targetActor);

              const total = armor.value + dex.value + shield.value;
              const stored = {
                ca: s.ca,
                armorClass: s.armorClass,
                ca_total: s.ca_total,
                ca_naturel: s.ca_naturel
              };

              return {
                caTotal: total,
                armorBase: armor.value,
                armorSource: armor.source,
                dexMod: dex.value,
                dexSource: dex.source,
                shieldMod: shield.value,
                shieldSource: shield.source,
                stored
              };
            };

            let thaco = null;

            if (actor.type === "personnage") {
              const classeItem = actor.items?.find(i => i.type === "classe");
              const niv = Number(sys.niveau) || 1;
              const prog = Array.isArray(classeItem?.system?.progression)
                ? classeItem.system.progression[niv - 1]
                : null;

              if (prog && prog.thac0 !== undefined && prog.thac0 !== null && prog.thac0 !== "") {
                thaco = add2eReadStrictNumber(prog.thac0);
                if (thaco === null) {
                  ui.notifications.error(`${actor.name} : progression de classe invalide, thac0 non numérique au niveau ${niv}.`);
                  console.error("[ADD2E][ATTAQUE][THAC0][INVALID_CLASS_PROGRESSION]", {
                    acteur: actor.name,
                    classe: classeItem?.name,
                    niveau: niv,
                    valeur: prog.thac0,
                    progression: prog
                  });
                  resolve(false);
                  return;
                }
              } else {
                thaco = add2eReadStrictNumber(sys.thac0);
                if (thaco === null) {
                  ui.notifications.error(`${actor.name} : THAC0 absent. Corrige system.thac0 ou la progression de classe.`);
                  console.error("[ADD2E][ATTAQUE][THAC0][MISSING_PERSONNAGE]", {
                    acteur: actor.name,
                    attendu: "system.thac0 ou item classe system.progression[niveau-1].thac0",
                    system: sys,
                    classe: classeItem?.name,
                    classeSystem: classeItem?.system
                  });
                  resolve(false);
                  return;
                }
              }
            } else {
              thaco = add2eReadStrictNumber(sys.thac0);
              if (thaco === null) {
                ui.notifications.error(`${actor.name} : THAC0 monstre absent. Corrige le JSON du monstre : system.thac0.`);
                console.error("[ADD2E][ATTAQUE][THAC0][MISSING_MONSTER]", {
                  acteur: actor.name,
                  attendu: "system.thac0",
                  system: sys
                });
                resolve(false);
                return;
              }
            }

            // --- 2. BONUS ATTAQUE ---
            let bonusHit = Number(arme.system.bonus_hit || 0);
            let bonusDom = Number(arme.system.bonus_dom || 0);
            let modCaracToucher = 0;
            let modCaracDegats = 0;

            const combatProfile = add2eGetCombatStatProfile(arme);
            const modCaracToucherLabel = add2eAttackAbilityLabel(combatProfile.toucherCarac);

            if (combatProfile.toucherCarac) {
              modCaracToucher = add2eGetAttackAbilityModifier(actor, combatProfile.toucherCarac, "toucher");
            }

            if (combatProfile.degatsCarac) {
              modCaracDegats = add2eGetAttackAbilityModifier(actor, combatProfile.degatsCarac, "degats");
            }

            console.log("[ADD2E][ATTAQUE][PROFIL COMBAT TAGS]", {
              acteur: actor.name,
              arme: arme.name,
              tags: combatProfile.tags,
              toucherCarac: combatProfile.toucherCarac,
              degatsCarac: combatProfile.degatsCarac,
              modCaracToucher,
              modCaracDegats
            });

            let bonusToucheEffets = 0;
let bonusDegatsEffets = 0;
let bonusRacialVs = 0;

if (typeof Add2eEffectsEngine !== "undefined") {
  const typeCible = cible.system.type_monstre || cible.system.race || "";
  bonusRacialVs = Add2eEffectsEngine.getBonusToucheVs(actor, typeCible);

  const activeTags = Add2eEffectsEngine.getActiveTags(actor) ?? [];

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

  for (const rawTag of activeTags) {
    const t = add2eNormalizeAttackTag(rawTag);

    // Bonus global : Bénédiction / Malédiction
    if (t.startsWith("bonus_attaque:")) {
      bonusToucheEffets += Number(t.split(":")[1]) || 0;
      continue;
    }

    // Bonus conditionnel selon un tag générique de l’arme :
    // bonus_touche:epee:1 matche famille_arme:epee, type_arme:epee ou arme:epee.
    if (t.startsWith("bonus_touche:")) {
      const parts = t.split(":");
      const matcher = parts[1];
      const valeur = Number(parts[2]) || 0;

      if (matcher && add2eTagSetMatches(combatProfile.tagSet, matcher)) {
        bonusToucheEffets += valeur;
      }
      continue;
    }

    // Bonus générique aux dégâts selon la cible.
    // Format : bonus_degats_vs:<tag_cible>:<nombre|niveau>
    // Exemple Ranger : bonus_degats_vs:orque:niveau.
    if (t.startsWith("bonus_degats_vs:")) {
      const parts = t.split(":");
      const matcher = add2eNormalizeAttackTag(parts[1]);
      const valeurRaw = String(parts[2] ?? "").trim().toLowerCase();

      if (matcher && targetTags.has(matcher)) {
        const valeur = valeurRaw === "niveau"
          ? (Number(actor.system?.niveau) || 1)
          : (Number(valeurRaw) || 0);

        bonusDegatsEffets += valeur;
      }
    }
  }

  if (bonusDegatsEffets !== 0) {
    console.log("[ADD2E][ATTAQUE][BONUS DEGATS VS CIBLE]", {
      acteur: actor.name,
      cible: cible?.name,
      targetTags: [...targetTags],
      bonusDegatsEffets
    });
  }
}

// =======================
// DETAIL BONUS TOUCHER
// =======================
let bonusDetails = [];

if (modCaracToucher !== 0) {
  bonusDetails.push({ label: "Caractéristique", value: modCaracToucher });
}

if (bonusHit !== 0) {
  bonusDetails.push({ label: "Arme", value: bonusHit });
}

if (malusPortee !== 0) {
  bonusDetails.push({ label: "Portée", value: malusPortee });
}

if (userBonus !== 0) {
  bonusDetails.push({ label: "Bonus temporaire", value: userBonus });
}

if (bonusToucheEffets !== 0) {
  bonusDetails.push({ label: "Effets actifs", value: bonusToucheEffets });
}

if (bonusRacialVs !== 0) {
  bonusDetails.push({ label: "Bonus racial / ennemi", value: bonusRacialVs });
}

if (bonusDegatsEffets !== 0) {
  bonusDetails.push({ label: "Bonus dégâts vs cible", value: bonusDegatsEffets });
}

const bonusAttaqueSournoise = useBackstab ? 4 : 0;
if (bonusAttaqueSournoise !== 0) {
  bonusDetails.push({ label: "Attaque sournoise", value: bonusAttaqueSournoise });
}

const bonusPositionToucher = !useBackstab ? (Number(activePositionAttackAdjustment.hitBonus) || 0) : 0;
if (bonusPositionToucher !== 0) {
  bonusDetails.push({ label: "Position", value: bonusPositionToucher });
}

let totalBonusToucher =
  modCaracToucher +
  bonusHit +
  malusPortee +
  userBonus +
  bonusToucheEffets +
  bonusRacialVs +
  bonusAttaqueSournoise +
  bonusPositionToucher;
  let totalBonusDegats = modCaracDegats + bonusDom + (Number(bonusDegatsEffets) || 0);

            // --- 3. CA CIBLE ---
            const isTouchAttack =
              add2eTagSetHas(combatProfile.tags, "arme:toucher", "type_arme:toucher", "attaque:toucher", "attaque_speciale:toucher", "attaque_speciale:contact") ||
              /\b(toucher|touch)\b/i.test(String(arme?.name ?? ""));

            let sysCible = cible.system || {};
            let nomCible = cible.name;
            let tailleCible = (sysCible.taille || sysCible.size || "M").toUpperCase();

            let caBaseCible = null;
            let caFinaleCible = null;
            let caSourceCible = "";

            let caComputedDetails = null;

            if (cible.type === "personnage") {
              // Source de résolution personnage : calcul de la CA affichée par la fiche depuis les données du token scène.
              // On ne lit plus system.ca_total directement, car ton log montre qu'il peut rester à 1 alors que la fiche
              // affiche 7 après recalcul. La valeur jouable est donc reconstruite : armure équipée + mod. DEX défense + bouclier.
              caComputedDetails = add2eAttackComputeCharacterDisplayedCA(cible);
              caSourceCible = "computed-token-scene:armor+dexDefense+shield";
              caBaseCible = caComputedDetails.caTotal;

              const storedNums = Object.fromEntries(
                Object.entries(caComputedDetails.stored).map(([k, v]) => [k, add2eReadStrictNumber(v)])
              );

              if (storedNums.ca_total !== null && storedNums.ca_total !== caBaseCible) {
                console.warn("[ADD2E][ATTAQUE][CA][TOKEN_STORED_CA_STALE][V25]", {
                  cible: nomCible,
                  attaqueContact: isTouchAttack,
                  caUtilisee: caBaseCible,
                  formule: caComputedDetails,
                  valeursStockeesSurToken: caComputedDetails.stored,
                  note: "system.ca_total du token est ignoré car il ne correspond pas à la CA affichée/calculée."
                });
              }
            } else {
              // Monstre : le JSON bestiaire doit fournir system.armorClass.
              caSourceCible = "system.armorClass";
              caBaseCible = add2eReadStrictNumber(sysCible.armorClass);
            }

            if (caBaseCible === null) {
              ui.notifications.error(`${nomCible} : CA absente. Corrige le JSON / les données acteur : ${caSourceCible}.`);
              console.error("[ADD2E][ATTAQUE][CA][MISSING_OR_INVALID]", {
                cible: nomCible,
                type: cible.type,
                attendu: caSourceCible,
                attaqueContact: isTouchAttack,
                valeurs: {
                  ca: sysCible.ca,
                  armorClass: sysCible.armorClass,
                  ca_total: sysCible.ca_total,
                  ca_naturel: sysCible.ca_naturel
                },
                system: sysCible
              });
              resolve(false);
              return;
            }

            // La résolution d'attaque utilise la CA stricte choisie ci-dessus.
            // Personnage : system.ca_total. Monstre : system.armorClass.
            // Aucun remplacement par ca_naturel, ca_fixe ou analyse dynamique ici.
            caFinaleCible = caBaseCible;

            console.log("[ADD2E][ATTAQUE][CA][STRICT_SOURCE][V25]", {
              cible: nomCible,
              type: cible.type,
              source: caSourceCible,
              attaqueContact: isTouchAttack,
              caBaseCible,
              caFinaleCible,
              computed: caComputedDetails,
              valeursStockeesSurToken: {
                ca_total: sysCible.ca_total,
                ca_naturel: sysCible.ca_naturel,
                armorClass: sysCible.armorClass,
                ca: sysCible.ca
              }
            });

            const caAvantPosition = caFinaleCible;
            if (activePositionAttackAdjustment.caAdjustment !== 0) {
              caFinaleCible += activePositionAttackAdjustment.caAdjustment;
            }

            // --- 4. TYPE D'ARMURE ---
            let typeArmureCible = caBaseCible;
            if (cible.items) {
              const armurePortee = cible.items.find(i =>
                i.type === "armure" && i.system.equipee &&
                !i.name.toLowerCase().includes("bouclier") &&
                !i.name.toLowerCase().includes("heaume") &&
                !i.name.toLowerCase().includes("casque")
              );
              if (armurePortee && typeof armurePortee.system.ac === "number") {
                typeArmureCible = Number(armurePortee.system.ac);
              }
            }
            typeArmureCible = Math.max(2, Math.min(10, Math.round(Number(typeArmureCible))));

            let ajustementCA = 0;
            if (Array.isArray(arme.system.ajustement_ca)) {
              let idx = typeArmureCible - 2;
              if (idx < 0) idx = 0; if (idx > 8) idx = 8;
              if (idx < arme.system.ajustement_ca.length) {
                ajustementCA = Number(arme.system.ajustement_ca[idx]) || 0;
              }
            }

            // --- 5. RESOLUTION ---
            let valeurPourToucher = thaco - caFinaleCible - ajustementCA;

            // ✅ ORDONNANCEMENT: d'abord les dés 3D, ensuite le chat (attaque)
            const roll = await (new Roll("1d20")).evaluate();
            if (game.dice3d) await game.dice3d.showForRoll(roll);
            await new Promise(r => setTimeout(r, 300));

            const d20 = roll.total;
            const totalAuToucher = d20 + totalBonusToucher;

            // Logique de touche (20 touche toujours, 1 rate toujours)
            const seuilFinalD20 = valeurPourToucher - totalBonusToucher;

            // 20 touche toujours, 1 rate toujours
            const estTouche = (d20 === 20) || (d20 !== 1 && d20 >= seuilFinalD20);

            const finalResult = estTouche;

            // Dégâts
            let degats = 0;
            let degatsAvantMultiplicateur = 0;
            let formulaDegats = "1d6";
            let detailsDegats = "";
            let typeDegats = arme.system.type_degats || "contondant";
            const backstabMultiplier = useBackstab ? Math.max(1, Number(backstabInfo.multiplier) || 1) : 1;
            let assassinatResult = null;

            if (finalResult) {
              const isGrand = ["G", "L", "LARGE"].includes(tailleCible);
              let rawDmg = isGrand ? arme.system.dégâts?.contre_grand : arme.system.dégâts?.contre_moyen;
              if (!rawDmg) rawDmg = "1d6";

              formulaDegats = plageToRollFormula(rawDmg);

              if (totalBonusDegats !== 0) {
                formulaDegats += (totalBonusDegats > 0 ? `+${totalBonusDegats}` : `${totalBonusDegats}`);
              }

              const rDmg = await (new Roll(formulaDegats)).evaluate();

              // ✅ ORDONNANCEMENT: dés dégâts avant le chat
              if (game.dice3d) await game.dice3d.showForRoll(rDmg);
              await new Promise(r => setTimeout(r, 300));

              degatsAvantMultiplicateur = Math.max(1, rDmg.total);
              degats = backstabMultiplier > 1
                ? Math.max(1, degatsAvantMultiplicateur * backstabMultiplier)
                : degatsAvantMultiplicateur;
              detailsDegats = backstabMultiplier > 1
                ? `${rDmg.result} × ${backstabMultiplier}`
                : rDmg.result;

              if (useAssassination) {
                assassinatResult = await add2eRollAssassinationForAttack({
                  actor,
                  score: assassinationInfo.score,
                  situational: assassinatMod
                });
              }

              if (cible) {
                await add2eApplyDamage({ cible, montant: degats, source: arme.name, lanceur: actor, silent: true });
              }
            }

            // --- 6. MESSAGE CHAT ---
            const colorResult = finalResult ? "#2ecc71" : "#e74c3c";
            const textResult = finalResult ? "TOUCHÉ !" : "Raté.";
            const iconResult = finalResult ? "fa-check" : "fa-times";

            let txtAjust = `${ajustementCA >= 0 ? "+" : ""}${ajustementCA}`;
            if (ajustementCA < 0) txtAjust = `<span style="color:#c0392b;">${txtAjust}</span>`;
            else if (ajustementCA > 0) txtAjust = `<span style="color:#18b531;">${txtAjust}</span>`;

            // Affichage du calcul simple (ex: 11 + 5 = 16)
            const signeBonus = totalBonusToucher >= 0 ? "+" : "";
            const calculSimple = `<b>${d20}</b> <span style="color:#888;font-size:0.8em;">(d20)</span> ${signeBonus} ${totalBonusToucher} = <b style="font-size:1.1em;">${totalAuToucher}</b>`;

            let chatContent = `
            <div class="add2e-chat-card" style="font-family:var(--font-primary); background:#fff; border:1px solid #aaa; border-radius:5px; padding:5px;">
               <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                  <div style="text-align:center;">
                     <img src="${actor.img || 'icons/svg/mystery-man.svg'}" style="width:48px;height:48px;border-radius:5px;border:1px solid #333;">
                     <div style="font-weight:bold; font-size:0.9em; margin-top:2px;">${actor.name}</div>
                     <div style="font-size:0.8em; color:#666;">${arme.name}</div>
                  </div>
                  <div style="font-size:2em; color:#aaa;">&rarr;</div>
                  <div style="text-align:center;">
                     <img src="${cible.img || 'icons/svg/mystery-man.svg'}" style="width:48px;height:48px;border-radius:5px;border:1px solid #333;">
                     <div style="font-weight:bold; font-size:0.9em; margin-top:2px;">${nomCible}</div>
                  </div>
               </div>

               <div style="text-align:center; font-size:1em; margin-bottom:10px;">
                  ${actor.name} tente de frapper <b>${nomCible}</b> avec sa <b>${arme.name}</b> !
               </div>

               <div style="text-align:center; color:#666; font-size:0.9em; margin-bottom:5px;">
                  Portée: <b>${descPortee}</b> — ${typePortee}
               </div>

               <div style="background:#f1f5f9; padding:8px; border-radius:5px; text-align:center; margin-bottom:10px; font-size:1.1em;">
                   <i class="fas fa-dice-d20"></i> ${calculSimple}
               </div>

               <div style="text-align:center; margin-bottom:10px;">
                   Seuil à atteindre au d20 : <span style="font-weight:bold; color:#d35400;">${seuilFinalD20}</span>
               </div>

               <div style="text-align:center; margin-bottom:10px; font-size:1.4em; font-weight:bold; color:${colorResult};">
                   <i class="fas ${iconResult}"></i> ${textResult}
               </div>

               ${finalResult ? `
               <div style="text-align:center; border-top:1px dashed #ccc; padding-top:5px; margin-bottom:10px;">
                   <span style="font-size:1.2em;">Dégâts : <b>${degats}</b></span>
                   <div style="font-size:0.8em; color:#7f8c8d;">(${formulaDegats} -> ${detailsDegats})</div>
                   ${useBackstab ? `<div style="font-size:0.9em;color:#7a4b00;font-weight:700;margin-top:0.25em;">Attaque sournoise : dégâts ×${backstabMultiplier}</div>` : ""}
                   ${activePositionAttackAdjustment.details.length ? `<div style="font-size:0.82em;color:#6b5a2a;font-weight:700;margin-top:0.25em;">Position : ${activePositionAttackAdjustment.details.join(" · ")}</div>` : ""}
               </div>` : ''}

               ${assassinatResult ? `
               <div style="border:1px solid ${assassinatResult.success ? "#1f8f4d" : "#b3261e"}; background:${assassinatResult.success ? "#eefaf2" : "#fff1f0"}; border-radius:6px; padding:7px; margin-bottom:10px; text-align:center;">
                 <div style="font-weight:900;color:${assassinatResult.success ? "#1f8f4d" : "#b3261e"};">Assassinat ${assassinatResult.success ? "réussi" : "échoué"}</div>
                 <div style="font-size:0.92em;">Jet : <b>${assassinatResult.total}</b> / Score : <b>${assassinatResult.finalScore}%</b></div>
                 <div style="font-size:0.82em;color:#666;">${assassinationInfo.breakdownTitle}${assassinatResult.situational ? ` | Situation ${assassinatResult.situational >= 0 ? "+" : ""}${assassinatResult.situational}%` : ""}</div>
               </div>
               ` : ""}

               <details style="margin-top:8px; font-size:1.05em; color:#333;">
  <summary style="cursor:pointer; font-weight:bold; font-size:1.1em;">
    Détails simples du jet
  </summary>

  <div style="margin-top:8px; line-height:1.55; background:#f8fafc; border:1px solid #d0d7de; border-radius:6px; padding:8px;">

    <div><b>Base THAC0 :</b> ${thaco}</div>
    <div><b>Classe d’armure cible :</b> ${caFinaleCible}${activePositionAttackAdjustment.caAdjustment ? ` <span style="color:#7a4b00;">(position : ${caAvantPosition} → ${caFinaleCible})</span>` : ""}</div>
    ${activePositionAttackAdjustment.details.length ? `<div><b>Position :</b> ${activePositionAttackAdjustment.details.join(" ; ")}</div>` : ""}
    <div><b>Seuil sans modificateur :</b> ${valeurPourToucher}</div>

    <hr style="margin:6px 0;">

    <div><b>Modificateur ${modCaracToucherLabel} :</b> ${modCaracToucher >= 0 ? "+" : ""}${modCaracToucher}</div>
    <div><b>Modificateur magique arme :</b> ${bonusHit >= 0 ? "+" : ""}${bonusHit}</div>
    <div><b>Modificateur effets actifs :</b> ${bonusToucheEffets >= 0 ? "+" : ""}${bonusToucheEffets}</div>
    <div><b>Modificateur portée :</b> ${malusPortee >= 0 ? "+" : ""}${malusPortee} (${descPortee})</div>
    <div><b>Modificateur temporaire :</b> ${userBonus >= 0 ? "+" : ""}${userBonus}</div>
    ${useBackstab ? `<div><b>Attaque sournoise :</b> +4 toucher, dégâts ×${backstabMultiplier}</div>` : ""}
    ${useAssassination ? `<div><b>Assassinat :</b> ${assassinationInfo.score}%${assassinatMod ? ` (${assassinatMod >= 0 ? "+" : ""}${assassinatMod} situation)` : ""}</div>` : ""}
    <div><b>Modificateur armure / arme :</b> ${ajustementCA >= 0 ? "+" : ""}${ajustementCA}</div>

    <hr style="margin:6px 0;">

    <div style="font-size:1.15em;">
      <b>Total modificateur :</b>
      <span style="font-weight:bold; color:#2563eb;">
        ${totalBonusToucher >= 0 ? "+" : ""}${totalBonusToucher}
      </span>
    </div>

    <div style="font-size:1.15em;">
      <b>Seuil final au d20 :</b>
      <span style="font-weight:bold; color:#15803d;">
        ${seuilFinalD20}
      </span>
    </div>

  </div>
</details>
            </div>
            `;

            await ChatMessage.create({
              speaker: ChatMessage.getSpeaker({ actor }),
              content: chatContent,
              avatar: chatImg
            });

            await add2eConsumeOneUseWeaponAfterAttack(actor, arme);

            resolve();
          }
        },
        cancel: { label: "Annuler" }
      },
      default: "ok"
    }, {
      width: 660,
      classes: ["add2e", "add2e-attack-dialog"]
    }).render(true);
  });
}



// ============================================================
// ADD2E — VFX JB2A Premium par chemins fichiers directs
// ------------------------------------------------------------
// La liste JB2A fournie montre que les assets existent comme chemins fichiers :
// modules/JB2A_DnD5e/... et/ou modules/jb2a_patreon/...
// On n'utilise donc PAS les clés Sequencer.Database du type "jb2a.xxx".
// Cela évite l'erreur Sequencer : Cannot read properties of null (reading 'baseTexture').
// ============================================================
const ADD2E_JB2A_PRESET_CANDIDATES = {
  heal: [
    "modules/jb2a_patreon/Library/1st_Level/Cure_Wounds/CureWounds_01_Green_400x400.webm",
    "modules/JB2A_DnD5e/Library/1st_Level/Cure_Wounds/CureWounds_01_Blue_400x400.webm",
    "modules/JB2A_DnD5e/Library/Generic/Healing/HealingAbility_01_Green_400x400.webm",
    "modules/JB2A_DnD5e/Library/Generic/Healing/HealingAbility_03_Regular_BlueGreen_600x600.webm"
  ],
  harm: [
    "modules/jb2a_patreon/Library/Generic/Conditions/Curse01/ConditionCurse01_001_Purple_600x600.webm",
    "modules/JB2A_DnD5e/Library/Generic/Conditions/Curse01/ConditionCurse01_001_Red_600x600.webm",
    "modules/JB2A_DnD5e/Library/Generic/Magic_Signs/NecromancyCircleIntro_02_Dark_Green_800x800.webm",
    "modules/JB2A_DnD5e/Library/Generic/Energy/EnergyStrand_01_Regular_Purple_05ft_600x400.webm"
  ],
  bless: [
    "modules/jb2a_patreon/Library/1st_Level/Bless/Bless_01_Regular_Yellow_Intro_400x400.webm",
    "modules/JB2A_DnD5e/Library/1st_Level/Bless/Bless_01_Regular_Yellow_Intro_400x400.webm",
    "modules/JB2A_DnD5e/Library/Generic/Conditions/Boon01/ConditionBoon01_001_Green_600x600.webm",
    "modules/JB2A_DnD5e/Library/Generic/Magic_Signs/ConjurationCircleIntro_02_Regular_Yellow_800x800.webm"
  ],
  curse: [
    "modules/jb2a_patreon/Library/Generic/Conditions/Curse01/ConditionCurse01_001_Red_600x600.webm",
    "modules/JB2A_DnD5e/Library/Generic/Conditions/Curse01/ConditionCurse01_001_Red_600x600.webm",
    "modules/JB2A_DnD5e/Library/Generic/Magic_Signs/NecromancyCircleIntro_02_Dark_Green_800x800.webm",
    "modules/JB2A_DnD5e/Library/Generic/Marker/MarkerFear_01_Dark_Purple_400x400.webm"
  ],
  protection: [
    "modules/jb2a_patreon/Library/1st_Level/Shield/Shield_01_Regular_Yellow_Complete_400x400.webm",
    "modules/JB2A_DnD5e/Library/1st_Level/Shield/Shield_01_Regular_Blue_Complete_400x400.webm",
    "modules/JB2A_DnD5e/Library/Generic/Magic_Signs/AbjurationCircleIntro_02_Regular_Blue_800x800.webm",
    "modules/JB2A_DnD5e/Library/Generic/Energy/ShieldEldritchWebAbove01_01_Dark_Purple_400x400.webm"
  ],
  detection: [
    "modules/jb2a_patreon/Library/1st_Level/Detect_Magic/DetectMagicCircle_01_Regular_Purple_1200x1200.webm",
    "modules/JB2A_DnD5e/Library/1st_Level/Detect_Magic/DetectMagicCircle_01_Regular_Blue_1200x1200.webm",
    "modules/JB2A_DnD5e/Library/Generic/Magic_Signs/DivinationCircleIntro_02_Regular_Blue_800x800.webm",
    "modules/JB2A_DnD5e/Library/Generic/Eyes/Eyes_Few01_01_Dark_Green_600x600.webm"
  ],
  water: [
    "modules/jb2a_patreon/Library/Generic/Cast/CastWater02_01_Regular_Blue_400x400.webm",
    "modules/JB2A_DnD5e/Library/Generic/Cast/CastWater02_01_Regular_Blue_400x400.webm",
    "modules/JB2A_DnD5e/Library/Generic/Liquid/LiquidSplash01_Regular_Blue_400x400.webm",
    "modules/JB2A_DnD5e/Library/Generic/Liquid/WaterSplashLoop_01_01_Regular_Blue_600x600.webm"
  ],
  command: [
    "modules/jb2a_patreon/Library/Generic/Magic_Signs/EnchantmentCircleIntro_02_Regular_Pink_800x800.webm",
    "modules/JB2A_DnD5e/Library/Generic/Magic_Signs/EnchantmentCircleIntro_02_Regular_Pink_800x800.webm",
    "modules/JB2A_DnD5e/Library/Generic/Marker/MarkerHorror_01_Regular_Purple_400x400.webm",
    "modules/JB2A_DnD5e/Library/Generic/Marker/MarkerFear_01_Dark_Purple_400x400.webm"
  ],
  fire: [
    "modules/jb2a_patreon/Library/Cantrip/Sacred_Flame/SacredFlameTarget_01_Regular_Yellow_400x400.webm",
    "modules/JB2A_DnD5e/Library/Cantrip/Sacred_Flame/SacredFlameTarget_01_Regular_Yellow_400x400.webm",
    "modules/JB2A_DnD5e/Library/Generic/Marker/MarkerLightIntro_01_Regular_Blue_400x400.webm",
    "modules/JB2A_DnD5e/Library/Generic/Fireflies/Fireflies_01_Green_Many01_400x400.webm"
  ],
  light: [
    "modules/jb2a_patreon/Library/Generic/Marker/MarkerLightIntro_01_Regular_Yellow_400x400.webm",
    "modules/JB2A_DnD5e/Library/Generic/Marker/MarkerLightIntro_01_Regular_Blue_400x400.webm",
    "modules/JB2A_DnD5e/Library/Generic/Marker/MarkerLightOrbComplete_01_Regular_Blue_400x400.webm",
    "modules/JB2A_DnD5e/Library/Cantrip/Dancing_Lights/DancingLights_01_Yellow_200x200.webm"
  ],
  plant: [
    "modules/jb2a_patreon/Library/1st_Level/Entangle/Entangle_01_Green_400x400.webm",
    "modules/JB2A_DnD5e/Library/1st_Level/Entangle/Entangle_01_Green_400x400.webm",
    "modules/JB2A_DnD5e/Library/1st_Level/Entangle/EntangleLoop02_02_Regular_Green_500x500.webm",
    "modules/JB2A_DnD5e/Library/Generic/Healing/HealingAbility_01_Green_400x400.webm"
  ],
  cold: [
    "modules/jb2a_patreon/Library/Generic/Ice/ShieldIceAbove01_01_Regular_Blue_400x400.webm",
    "modules/JB2A_DnD5e/Library/Generic/Ice/ShieldIceAbove01_01_Regular_Blue_400x400.webm",
    "modules/JB2A_DnD5e/Library/Generic/Ice/SnowflakeBurst_01_Regular_BlueWhite_Burst_600x600.webm",
    "modules/JB2A_DnD5e/Library/Generic/Impact/FrostImpact_01_Regular_White_600x600.webm"
  ],
  divine: [
    "modules/jb2a_patreon/Library/Generic/Cast/GenericCast01_01_Regular_Yellow_400x400.webm",
    "modules/JB2A_DnD5e/Library/Generic/Cast/GenericCast01_01_Regular_Yellow_400x400.webm",
    "modules/JB2A_DnD5e/Library/Generic/Magic_Signs/ConjurationCircleIntro_02_Regular_Yellow_800x800.webm",
    "modules/JB2A_DnD5e/Library/Generic/Magic_Signs/AbjurationCircleIntro_02_Regular_Blue_800x800.webm"
  ]
};

const ADD2E_JB2A_FILE_CACHE = new Map();

function add2eGetTokenLikeCenter(target) {
  if (!target) return null;
  if (target.center) return target.center;
  if (target.object?.center) return target.object.center;
  if (target.documentName === "Actor") return target.getActiveTokens?.()[0]?.center ?? null;
  if (target.actor?.getActiveTokens) return target.center ?? null;
  return null;
}

function add2eGetTokenLikeObject(target) {
  if (!target) return null;
  if (target.center && target.document) return target;
  if (target.object?.center) return target.object;
  if (target.documentName === "Actor") return target.getActiveTokens?.()[0] ?? null;
  return null;
}

function add2eModuleLooksActiveForPath(path) {
  const p = String(path || "");
  if (p.startsWith("modules/jb2a_patreon/")) {
    return game.modules?.get?.("jb2a_patreon")?.active !== false;
  }
  if (p.startsWith("modules/JB2A_DnD5e/") || p.startsWith("modules/jb2a_dnd5e/")) {
    return game.modules?.get?.("JB2A_DnD5e")?.active !== false;
  }
  return true;
}

async function add2eJb2aFileExists(path) {
  path = String(path || "").trim();
  if (!path) return false;
  if (!add2eModuleLooksActiveForPath(path)) return false;
  if (ADD2E_JB2A_FILE_CACHE.has(path)) return ADD2E_JB2A_FILE_CACHE.get(path);

  try {
    // GET avec range minimal : plus fiable que HEAD sur certaines installations Foundry.
    const response = await fetch(path, {
      method: "GET",
      cache: "force-cache",
      headers: { Range: "bytes=0-1" }
    });
    const ok = !!response.ok || response.status === 206;
    ADD2E_JB2A_FILE_CACHE.set(path, ok);
    return ok;
  } catch (e) {
    ADD2E_JB2A_FILE_CACHE.set(path, false);
    return false;
  }
}

async function add2ePickJb2aFile(preset = "divine") {
  const key = String(preset || "divine").toLowerCase();
  const candidates = [
    ...(ADD2E_JB2A_PRESET_CANDIDATES[key] ?? []),
    ...(ADD2E_JB2A_PRESET_CANDIDATES.divine ?? [])
  ];

  for (const candidate of candidates) {
    if (await add2eJb2aFileExists(candidate)) return candidate;
  }

  return "";
}

async function add2ePlayJb2aPremiumFx(target, preset = "divine", options = {}) {
  try {
    if (typeof Sequence === "undefined") return false;

    const tokenObj = add2eGetTokenLikeObject(target);
    const point = add2eGetTokenLikeCenter(target);
    if (!tokenObj && !point) return false;

    const file = await add2ePickJb2aFile(preset);
    if (!file) {
      console.warn("[ADD2E][JB2A][SKIP] Aucun chemin fichier JB2A valide trouvé pour le preset.", {
        preset,
        candidates: ADD2E_JB2A_PRESET_CANDIDATES[String(preset || "divine").toLowerCase()] ?? []
      });
      return false;
    }

    globalThis.ADD2E_LAST_CLERC_FX_AT = Date.now();

    const seq = new Sequence();
    const effect = seq.effect().file(file);

    if (tokenObj) effect.attachTo(tokenObj);
    else effect.atLocation(point);

    effect
      .scaleToObject(options.scaleToObject ?? 1.25)
      .opacity(options.opacity ?? 0.85)
      .belowTokens(options.belowTokens ?? false);

    await seq.play();

    console.log("[ADD2E][JB2A][PLAY]", { preset, file });
    return true;
  } catch (e) {
    console.warn("[ADD2E][JB2A][ERROR] VFX JB2A ignoré pour ne pas bloquer le sort.", {
      preset,
      error: e
    });
    return false;
  }
}

globalThis.ADD2E_CLERC_PLAY_LAUNCH_FX = add2ePlayJb2aPremiumFx;

/**
 * Lancer de sort (Script + Gestion Charges Objet)
 * VERSION : 2026-05-04-cast-spell-sync-memorizedByList-v16
 *
 * Règle stricte :
 * - onUse === true  => le sort est réellement lancé, le coût reste consommé ;
 * - onUse === false => annulation / cible manquante / invalide, le coût est remboursé ;
 * - toute autre valeur => erreur stricte, coût remboursé, aucun fallback undefined.
 *
 * Correctif V15 :
 * - le compteur était bien décrémenté dans flags.add2e.memorizedCount,
 *   mais la fiche ouverte pouvait rester visuellement à 1.
 * - on force maintenant la mise à jour du flag par Item.update(),
 *   puis on rafraîchit explicitement les fiches acteur ouvertes et le badge DOM.
 */
async function add2eCastSpell({ actor, sort } = {}) {
  if (!actor || !sort) {
    ui.notifications.warn("Lanceur ou sort introuvable.");
    return false;
  }

  console.log("[ADD2E][CAST_SPELL] Début", {
    actor: actor.name,
    sort: sort.name,
    sortId: sort.id,
    sortType: sort.type,
    isPower: !!sort.system?.isPower,
    onUse: sort.system?.onUse,
    onuse: sort.system?.onuse,
    on_use: sort.system?.on_use
  });

  let canCast = false;
  let labelCharge = "";
  let spellToUse = sort;
  let reservedCost = null;

  function add2eExtractScriptPath(raw) {
    if (!raw) return "";

    let value = raw;

    if (Array.isArray(value)) {
      value = value.find(v => typeof v === "string" && v.includes(".js")) ?? value[0] ?? "";
    }

    value = String(value ?? "").trim();

    // Protection contre les imports corrompus : "a.js,a.js" => "a.js".
    if (value.includes(",")) {
      value = value
        .split(",")
        .map(s => s.trim())
        .find(s => s.endsWith(".js")) ?? value.split(",")[0].trim();
    }

    return value;
  }

  function add2eGetCasterToken(actorDoc) {
    return (
      canvas?.tokens?.controlled?.[0] ??
      actorDoc?.getActiveTokens?.()?.[0] ??
      null
    );
  }

  function add2eRenderApplication(app) {
    if (!app || typeof app.render !== "function") return;

    try {
      app.render({ force: true });
      return;
    } catch (e) {}

    try {
      app.render(true);
      return;
    } catch (e) {}

    try {
      app.render(false);
    } catch (e) {}
  }

  function add2eUpdateVisibleMemorizedBadges(actorDoc, sortDoc, value) {
    const textValue = String(Math.max(0, Number(value) || 0));

    try {
      const roots = Array.from(document.querySelectorAll(".add2e-character-v3"));

      for (const root of roots) {
        const rows = Array.from(root.querySelectorAll([
          `[data-item-id="${sortDoc.id}"]`,
          `[data-itemid="${sortDoc.id}"]`,
          `[data-id="${sortDoc.id}"]`,
          `[data-uuid="${sortDoc.uuid}"]`
        ].join(",")));

        for (const row of rows) {
          const badges = row.querySelectorAll?.(".sort-memorize-badge, [data-memorized-count], [data-add2e-memorized-count]") ?? [];
          for (const badge of badges) {
            badge.textContent = textValue;
            badge.dataset.memorizedCount = textValue;
            badge.dataset.add2eMemorizedCount = textValue;
          }
        }
      }
    } catch (e) {
      console.warn("[ADD2E][CAST_SPELL][UI_REFRESH][DOM_BADGE_FAILED]", e);
    }
  }

  async function add2eRefreshActorSpellSheets(actorDoc, sortDoc, value) {
    add2eUpdateVisibleMemorizedBadges(actorDoc, sortDoc, value);

    try {
      add2eRenderApplication(actorDoc?.sheet);
    } catch (e) {}

    // Certaines feuilles ApplicationV2 ne sont pas dans actor.sheet au moment du refresh.
    // On force donc aussi toutes les fenêtres ouvertes dont le document/actor correspond.
    try {
      for (const app of Object.values(ui.windows ?? {})) {
        const doc = app?.actor ?? app?.document ?? app?.object ?? null;
        const sameActor = doc?.documentName === "Actor" && String(doc.id) === String(actorDoc.id);
        const sameItem = doc?.documentName === "Item" && String(doc.id) === String(sortDoc.id);
        if (sameActor || sameItem) add2eRenderApplication(app);
      }
    } catch (e) {}

    // Deuxième passage léger après que Foundry a propagé updateItem/updateActor.
    setTimeout(() => {
      add2eUpdateVisibleMemorizedBadges(actorDoc, sortDoc, value);
      try { add2eRenderApplication(actorDoc?.sheet); } catch (e) {}
    }, 80);
  }

  function add2eDeepCloneForSpell(value) {
    if (value === undefined || value === null) return value;
    try {
      if (foundry?.utils?.deepClone) return foundry.utils.deepClone(value);
      if (foundry?.utils?.duplicate) return foundry.utils.duplicate(value);
      return JSON.parse(JSON.stringify(value));
    } catch (e) {
      return value;
    }
  }

  function add2eNormalizeSpellCounterPath(value) {
    return String(value ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[’']/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function add2eIsMemorizedByListCounterPath(path) {
    const p = add2eNormalizeSpellCounterPath(path);

    // On évite les champs structurels ou maxima éventuels.
    if (!p) return false;
    if (p.includes("max") || p.includes("maximum") || p.includes("total") || p.includes("capacity") || p.includes("capacite")) return false;
    if (p.includes("niveau_max") || p.includes("level_max")) return false;

    return true;
  }

  function add2eAdjustMemorizedByListValue(rawByList, targetTotal) {
    const target = Math.max(0, Number(targetTotal) || 0);

    if (rawByList === undefined || rawByList === null || rawByList === "") {
      return { changed: false, value: rawByList, beforeSum: 0, afterSum: 0, leaves: [] };
    }

    if (typeof rawByList === "number") {
      return {
        changed: rawByList !== target,
        value: target,
        beforeSum: Number(rawByList) || 0,
        afterSum: target,
        leaves: [{ path: "", before: Number(rawByList) || 0, after: target }]
      };
    }

    if (typeof rawByList !== "object") {
      return { changed: false, value: rawByList, beforeSum: 0, afterSum: 0, leaves: [] };
    }

    const clone = add2eDeepCloneForSpell(rawByList);
    const leaves = [];

    function scan(obj, pathParts = []) {
      if (!obj || typeof obj !== "object") return;

      for (const [key, value] of Object.entries(obj)) {
        const nextPath = [...pathParts, key];
        const path = nextPath.join(".");

        if (typeof value === "number" && Number.isFinite(value) && add2eIsMemorizedByListCounterPath(path)) {
          leaves.push({ parent: obj, key, path, before: value });
          continue;
        }

        if (value && typeof value === "object" && !Array.isArray(value)) {
          scan(value, nextPath);
        }
      }
    }

    scan(clone, []);

    if (!leaves.length) {
      return { changed: false, value: clone, beforeSum: 0, afterSum: 0, leaves: [] };
    }

    const beforeSum = leaves.reduce((sum, leaf) => sum + (Number(leaf.parent[leaf.key]) || 0), 0);
    let delta = target - beforeSum;

    if (delta < 0) {
      let remaining = Math.abs(delta);

      // On retire d'abord sur les compteurs positifs. Cela garde un total cohérent
      // pour les structures du type { clerc: 1, druide: 1 }.
      for (const leaf of leaves) {
        if (remaining <= 0) break;
        const current = Math.max(0, Number(leaf.parent[leaf.key]) || 0);
        if (current <= 0) continue;
        const dec = Math.min(current, remaining);
        leaf.parent[leaf.key] = current - dec;
        remaining -= dec;
      }
    } else if (delta > 0) {
      // Remboursement : on remet l'écart sur le premier compteur existant.
      const first = leaves[0];
      first.parent[first.key] = Math.max(0, Number(first.parent[first.key]) || 0) + delta;
    }

    const afterSum = leaves.reduce((sum, leaf) => sum + (Number(leaf.parent[leaf.key]) || 0), 0);
    const changed = afterSum !== beforeSum || beforeSum !== target;

    return {
      changed,
      value: clone,
      beforeSum,
      afterSum,
      leaves: leaves.map(leaf => ({
        path: leaf.path,
        before: leaf.before,
        after: Number(leaf.parent[leaf.key]) || 0
      }))
    };
  }

  async function add2eSetMemorizedCount(actorDoc, sortDoc, value, reason = "") {
    const next = Math.max(0, Number(value) || 0);

    const byListBefore = await sortDoc.getFlag("add2e", "memorizedByList");
    const byListSync = add2eAdjustMemorizedByListValue(byListBefore, next);

    const updateData = {
      "flags.add2e.memorizedCount": next
    };

    // Très important : la fiche peut afficher flags.add2e.memorizedByList,
    // alors que la limite de relance utilise flags.add2e.memorizedCount.
    // On synchronise donc les deux compteurs.
    if (byListSync.changed) {
      updateData["flags.add2e.memorizedByList"] = byListSync.value;
    }

    await sortDoc.update(updateData);

    await add2eRefreshActorSpellSheets(actorDoc, sortDoc, next);

    const after = Number(await sortDoc.getFlag("add2e", "memorizedCount")) || 0;
    const byListAfter = await sortDoc.getFlag("add2e", "memorizedByList");

    console.log("[ADD2E][CAST_SPELL][MEMORIZED][SET]", {
      actor: actorDoc.name,
      sort: sortDoc.name,
      reason,
      wanted: next,
      after,
      memorizedByListSync: {
        changed: byListSync.changed,
        beforeSum: byListSync.beforeSum,
        afterSum: byListSync.afterSum,
        leaves: byListSync.leaves,
        before: byListBefore,
        after: byListAfter
      }
    });

    return after;
  }

  async function add2ePlayGenericCastVfx(actorDoc, sortDoc) {
    const casterToken = add2eGetCasterToken(actorDoc);
    const targetToken = Array.from(game.user.targets ?? [])[0] ?? casterToken;
    const point = targetToken?.center ?? casterToken?.center ?? null;

    if (!point || !canvas?.ready) return;

    // Effet natif Foundry : ne dépend pas de JB2A.
    try {
      if (typeof canvas.ping === "function") {
        canvas.ping(point, {
          style: "pulse",
          color: "#b88924",
          size: 96,
          duration: 900
        });
      } else if (typeof canvas.controls?.ping === "function") {
        canvas.controls.ping(point, {
          style: "pulse",
          color: "#b88924",
          size: 96,
          duration: 900
        });
      }
    } catch (e) {
      console.warn("[ADD2E][CAST_SPELL][VFX] Ping impossible.", e);
    }

    // Texte flottant Foundry.
    try {
      if (canvas.interface?.createScrollingText) {
        canvas.interface.createScrollingText(
          point,
          `✦ ${sortDoc?.name ?? "Sort"} ✦`,
          {
            anchor: CONST.TEXT_ANCHOR_POINTS?.CENTER ?? 0,
            direction: CONST.TEXT_ANCHOR_POINTS?.TOP ?? 1,
            distance: 1.5,
            fontSize: 30,
            fill: "#f5d37a",
            stroke: "#3a2608",
            strokeThickness: 4,
            duration: 1400
          }
        );
      }
    } catch (e) {
      console.warn("[ADD2E][CAST_SPELL][VFX] Texte flottant impossible.", e);
    }

    // JB2A Premium sécurisé : on ne joue une animation que si Sequencer confirme
    // que la clé existe réellement dans sa base. Sinon, on garde seulement le VFX natif.
    try {
      const lastSpecificFx = Number(globalThis.ADD2E_LAST_CLERC_FX_AT || 0);
      if (Date.now() - lastSpecificFx > 800 && typeof globalThis.ADD2E_CLERC_PLAY_LAUNCH_FX === "function") {
        await globalThis.ADD2E_CLERC_PLAY_LAUNCH_FX(targetToken ?? casterToken, "divine");
      }
    } catch (e) {
      console.warn("[ADD2E][CAST_SPELL][JB2A] VFX générique ignoré.", e);
    }
  }

  async function add2eRefundReservedCost(reason = "") {
    if (!reservedCost) return false;

    try {
      if (reservedCost.kind === "memorized") {
        const now = Number(await reservedCost.sort.getFlag("add2e", "memorizedCount")) || 0;

        // Si une autre mécanique a déjà modifié le compteur, on évite d'écraser.
        if (now !== reservedCost.after) {
          console.warn("[ADD2E][CAST_SPELL][REFUND][MEMORIZED][SKIP_CHANGED]", {
            reason,
            sort: reservedCost.sort.name,
            before: reservedCost.before,
            after: reservedCost.after,
            now
          });
          await add2eRefreshActorSpellSheets(actor, reservedCost.sort, now);
          return false;
        }

        await add2eSetMemorizedCount(actor, reservedCost.sort, reservedCost.before, `refund:${reason}`);

        console.log("[ADD2E][CAST_SPELL][REFUND][MEMORIZED]", {
          reason,
          sort: reservedCost.sort.name,
          restored: reservedCost.before
        });

        return true;
      }

      if (reservedCost.kind === "power") {
        const { weapon, isGlobalMode, flagKey, before, after } = reservedCost;
        const now = Number(await weapon.getFlag("add2e", flagKey)) || 0;

        // Les anciens scripts d'objet peuvent déjà rembourser eux-mêmes.
        if (now !== after) {
          console.warn("[ADD2E][CAST_SPELL][REFUND][POWER][SKIP_CHANGED]", {
            reason,
            weapon: weapon.name,
            flagKey,
            before,
            after,
            now
          });
          return false;
        }

        await weapon.setFlag("add2e", flagKey, before);

        console.log("[ADD2E][CAST_SPELL][REFUND][POWER]", {
          reason,
          weapon: weapon.name,
          flagKey,
          isGlobalMode,
          restored: before
        });

        return true;
      }
    } catch (e) {
      console.error("[ADD2E][CAST_SPELL][REFUND][ERROR]", e, reservedCost);
    }

    return false;
  }

  async function add2eCreateFallbackSpellChat(actorDoc, sortDoc, chargeLabel = "") {
    const info = sortDoc.system ?? {};
    const niveauPerso = Number(actorDoc.system?.niveau) || Number(info.niveau) || 1;

    const details = [
      { label: "Portée",   val: formatSortChamp(info.portee, niveauPerso) },
      { label: "Durée",    val: formatSortChamp(info.duree, niveauPerso) },
      { label: "Cible",    val: formatSortChamp(info.cible, niveauPerso) },
      { label: "Incant.",  val: formatSortChamp(info.temps_incantation, niveauPerso) }
    ];

    const htmlMsg = `
      <div class="add2e-spell-card" style="
        border-radius: 12px;
        box-shadow: 0 2px 10px #715aab33;
        background: linear-gradient(100deg, #f8f6fc 90%, #e8def8 100%);
        border: 1.5px solid #9373c7;
        margin: 0.3em 0 0.2em 0;
        max-width: 440px;
        padding: 0.5em 1.3em 0.5em 1em;
        font-family: var(--font-primary);
      ">
        <div style="display: flex; align-items: center; gap: 0.7em;">
          <img src="${sortDoc.img || "icons/svg/book.svg"}" alt="" style="width:46px; height:46px; border-radius:7px; box-shadow:0 1px 4px #0002; object-fit:contain;">
          <span style="font-size:1.18em; font-weight:bold; color:#6841a2;">${sortDoc.name}</span>
          <span style="margin-left:auto; color:#8e44ad; font-size:0.97em; font-weight:600;">Niv. ${info.niveau || "-"}</span>
          <span style="font-size:0.9em; font-weight:bold; margin-left:5px;">${chargeLabel}</span>
        </div>
        <table style="margin:0.3em 0 0.3em 0; width:100%; font-size:0.98em;">
          ${details.map(d => `<tr>
            <td style="color:#8571a5; font-weight:600; width:120px;">${d.label}</td>
            <td style="color:#222; font-weight:500;">${d.val || "-"}</td>
          </tr>`).join("")}
        </table>
        <details open style="margin-top:0.2em; background: #eee8fa; border-radius: 6px; border:1px solid #e1d2fb;">
          <summary style="cursor:pointer; color:#6a3c99; font-size:1em; font-weight: 600;">Description</summary>
          <div style="color:#48307a; font-size:0.99em; margin-top:0.3em; margin-bottom:0.2em; padding:0.15em 0.4em 0.25em 0.2em;">
            ${info.description || "<em>Aucune description.</em>"}
          </div>
        </details>
      </div>`;

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: actorDoc }),
      content: htmlMsg,
      ...(CONST.CHAT_MESSAGE_STYLES
        ? { style: CONST.CHAT_MESSAGE_STYLES.OTHER }
        : { type: CONST.CHAT_MESSAGE_TYPES?.OTHER ?? 0 })
    });
  }

  // =========================================================
  // 1. RÉSERVATION DU COÛT AVANT SCRIPT
  // =========================================================

  if (sort.system?.isPower) {
    const weapon = actor.items.get(sort.system.sourceWeaponId);
    if (!weapon) {
      ui.notifications.error("Objet source introuvable.");
      return false;
    }

    const maxChargesGlobal = Number(weapon.system?.max_charges || 0);
    const isGlobalMode = maxChargesGlobal > 0;

    let current = 0;
    let max = 0;
    let flagKey = "";

    if (isGlobalMode) {
      flagKey = "global_charges";
      const val = await weapon.getFlag("add2e", flagKey);
      max = maxChargesGlobal;
      current = (val !== undefined && val !== null) ? Number(val) : max;
    } else {
      flagKey = `charges_${sort.system.powerIndex}`;
      const val = await weapon.getFlag("add2e", flagKey);
      max = Number(sort.system.max || 1);
      current = (val !== undefined && val !== null) ? Number(val) : max;
    }

    const cost = Number(sort.system.cost || 1);

    if (current < cost) {
      ui.notifications.warn(`L'objet ${weapon.name} n'a plus assez de charges (${current}/${cost} req).`);
      return false;
    }

    const newCharges = current - cost;
    await weapon.setFlag("add2e", flagKey, newCharges);

    reservedCost = {
      kind: "power",
      weapon,
      isGlobalMode,
      flagKey,
      before: current,
      after: newCharges,
      max,
      cost
    };

    canCast = true;
    labelCharge = `<span style="color:#d35400;">Charges : ${newCharges}/${max}</span>`;

    console.log("[ADD2E][CAST_SPELL][COST_RESERVED][POWER]", reservedCost);

    // Recherche du vrai sort dans les objets monde, comme l'ancien code.
    const baseName = sort.name.replace(/\s\(.*?\)$/, "").trim();
    const realSpell = game.items.find(i =>
      i.type === "sort" &&
      i.name.toLowerCase() === baseName.toLowerCase()
    );
    if (realSpell) spellToUse = realSpell;
  }

  else {
    const mem = Number(await sort.getFlag("add2e", "memorizedCount")) || 0;

    if (mem <= 0) {
      ui.notifications.warn(`Le sort "${sort.name}" n'est plus mémorisé !`);
      console.warn("[ADD2E][CAST_SPELL][MEMORIZED][EMPTY]", {
        actor: actor.name,
        sort: sort.name,
        memorizedCount: mem
      });
      await add2eRefreshActorSpellSheets(actor, sort, 0);
      return false;
    }

    const newMem = Math.max(0, mem - 1);
    await add2eSetMemorizedCount(actor, sort, newMem, "reserve before onUse");

    reservedCost = {
      kind: "memorized",
      sort,
      before: mem,
      after: newMem
    };

    canCast = true;
    labelCharge = `<span style="color:#2980b9;">Reste : ${newMem}</span>`;

    console.log("[ADD2E][CAST_SPELL][COST_RESERVED][MEMORIZED]", {
      actor: actor.name,
      sort: sort.name,
      before: mem,
      after: newMem
    });
  }

  if (!canCast) return false;

  // =========================================================
  // 2. EXÉCUTION DU SCRIPT ON USE
  // =========================================================

  const info = spellToUse.system ?? {};
  const scriptPath = add2eExtractScriptPath(info.onUse || info.onuse || info.on_use);

  let launched = true;
  let scriptExecuted = false;

  if (scriptPath) {
    scriptExecuted = true;

    try {
      const response = await fetch(scriptPath, { cache: "no-store" });

      if (!response.ok) {
        await add2eRefundReservedCost("script introuvable");

        ui.notifications.error(`${spellToUse.name} : script onUse introuvable.`);
        console.error("[ADD2E][CAST_SPELL][ONUSE][FETCH_FAILED]", {
          sort: spellToUse.name,
          scriptPath,
          status: response.status,
          statusText: response.statusText
        });

        return false;
      }

      const code = await response.text();
      const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
      const casterToken = add2eGetCasterToken(actor);

      const fn = new AsyncFunction(
        "actor",
        "item",
        "sort",
        "token",
        "args",
        "sourceItem",
        code
      );

      const result = await fn.call(
        spellToUse,
        actor,
        spellToUse,
        sort,
        casterToken,
        [{
          actor,
          item: spellToUse,
          sort,
          token: casterToken,
          sourceItem: spellToUse
        }],
        spellToUse
      );

      if (result === true) launched = true;
      else if (result === false) launched = false;
      else {
        launched = false;
        console.error("[ADD2E][CAST_SPELL][BAD_RETURN_STRICT]", {
          sort: spellToUse.name,
          result,
          message: "Le onUse doit retourner true ou false. Aucun fallback undefined : le coût réservé sera remboursé."
        });
        ui.notifications.error(`${spellToUse.name} : le script onUse doit retourner true ou false.`);
      }

      console.log("[ADD2E][CAST_SPELL][ONUSE_RESULT]", {
        sort: spellToUse.name,
        result,
        consumed: launched
      });

    } catch(e) {
      await add2eRefundReservedCost("erreur script");
      console.error("[ADD2E][CAST_SPELL][ONUSE][ERROR]", {
        sort: spellToUse.name,
        scriptPath,
        error: e
      });
      ui.notifications.error(`${spellToUse.name} : erreur dans le script onUse.`);
      return false;
    }
  }

  // =========================================================
  // 3. REMBOURSEMENT SI LE SCRIPT REFUSE LE LANCEMENT
  // =========================================================

  if (!launched) {
    await add2eRefundReservedCost("onUse false");

    console.log("[ADD2E][CAST_SPELL][NOT_CONSUMED]", {
      actor: actor.name,
      sort: spellToUse.name
    });

    return false;
  }

  // =========================================================
  // 4. EFFETS VISUELS ET MESSAGE FALLBACK
  // =========================================================

  await add2ePlayGenericCastVfx(actor, spellToUse);

  // Si aucun script n’existe, on garde le message déclaratif du système.
  // Si un script existe, il gère son propre message de chat.
  if (!scriptExecuted) {
    await add2eCreateFallbackSpellChat(actor, spellToUse, labelCharge);
  }

  await add2eRefreshActorSpellSheets(actor, sort, reservedCost?.kind === "memorized" ? reservedCost.after : undefined);

  console.log("[ADD2E][CAST_SPELL][CONSUMED]", {
    actor: actor.name,
    sort: spellToUse.name,
    reservedCost
  });

  return true;
}

// Exports globaux
globalThis.add2eAttackRoll = add2eAttackRoll;
globalThis.add2eCastSpell = add2eCastSpell;
globalThis.cast_spell = add2eCastSpell;
globalThis.add2eGetBackstabInfo = add2eGetBackstabInfo;
globalThis.add2eGetAssassinationInfo = add2eGetAssassinationInfo;
globalThis.add2eGetBackArcInfo = add2eGetBackArcInfo;
globalThis.add2eBuildPositionAttackAdjustment = add2eBuildPositionAttackAdjustment;