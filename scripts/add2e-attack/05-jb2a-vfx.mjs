// scripts/add2e-attack/05-jb2a-vfx.mjs
// ADD2E — VFX JB2A Premium sécurisés pour sorts et attaques d'armes.
// Version : 2026-06-19-v9-weapon-fx-stable-hook

globalThis.ADD2E_JB2A_VFX_VERSION = "2026-06-19-v9-weapon-fx-stable-hook";

const ADD2E_JB2A_PRESET_CANDIDATES = {
  divine: [
    "modules/jb2a_patreon/Library/2nd_Level/Divine_Smite/DivineSmite_01_Regular_YellowWhite_Target_400x400.webm",
    "modules/JB2A_DnD5e/Library/2nd_Level/Divine_Smite/DivineSmite_01_Regular_BlueYellow_Target_400x400.webm",
    "modules/jb2a_patreon/Library/1st_Level/Bless/Bless_01_Regular_Yellow_Intro_400x400.webm",
    "modules/JB2A_DnD5e/Library/1st_Level/Bless/Bless_01_Regular_Yellow_Intro_400x400.webm"
  ],
  bless: [
    "modules/jb2a_patreon/Library/2nd_Level/Divine_Smite/DivineSmite_01_Regular_YellowWhite_Target_400x400.webm",
    "modules/JB2A_DnD5e/Library/2nd_Level/Divine_Smite/DivineSmite_01_Regular_BlueYellow_Target_400x400.webm",
    "modules/JB2A_DnD5e/Library/Generic/Conditions/Boon01/ConditionBoon01_020_Green_600x600.webm",
    "modules/JB2A_DnD5e/Library/Generic/Conditions/Boon01/ConditionBoon01_012_Green_600x600.webm",
    "modules/jb2a_patreon/Library/1st_Level/Bless/Bless_01_Regular_Yellow_Intro_400x400.webm",
    "modules/JB2A_DnD5e/Library/1st_Level/Bless/Bless_01_Regular_Yellow_Intro_400x400.webm"
  ],
  curse: [
    "modules/jb2a_patreon/Library/2nd_Level/Divine_Smite/DivineSmite_01_Dark_Red_Target_400x400.webm",
    "modules/JB2A_DnD5e/Library/Generic/Conditions/Curse01/ConditionCurse01_020_Red_600x600.webm",
    "modules/JB2A_DnD5e/Library/Generic/Conditions/Curse01/ConditionCurse01_016_Red_600x600.webm",
    "modules/JB2A_DnD5e/Library/Generic/Conditions/Curse01/ConditionCurse01_005_Red_600x600.webm",
    "modules/jb2a_patreon/Library/Generic/Token_Stage/TokenStageHex01_01_Regular_Red_400x400.webm"
  ],
  protection: [
    "modules/jb2a_patreon/Library/Generic/Shield/Shield_01_Regular_Yellow_400x400.webm",
    "modules/JB2A_DnD5e/Library/Generic/Shield/Shield_01_Regular_Yellow_400x400.webm",
    "modules/jb2a_patreon/Library/Generic/Shield/Shield_01_Regular_Blue_400x400.webm",
    "modules/JB2A_DnD5e/Library/Generic/Shield/Shield_01_Regular_Blue_400x400.webm",
    "modules/jb2a_patreon/Library/2nd_Level/Divine_Smite/DivineSmite_01_Regular_YellowWhite_Target_400x400.webm"
  ],
  protection_dark: [
    "modules/jb2a_patreon/Library/Generic/Shield/Shield_01_Regular_Purple_400x400.webm",
    "modules/JB2A_DnD5e/Library/Generic/Shield/Shield_01_Regular_Purple_400x400.webm",
    "modules/jb2a_patreon/Library/Generic/Shield/Shield_01_Regular_Red_400x400.webm",
    "modules/JB2A_DnD5e/Library/Generic/Shield/Shield_01_Regular_Red_400x400.webm",
    "modules/JB2A_DnD5e/Library/Generic/Conditions/Curse01/ConditionCurse01_016_Red_600x600.webm"
  ],
  command: [
    "modules/jb2a_patreon/Library/Generic/Energy/DodecahedronRuneAbove_01_Dark_Purple_600x600.webm",
    "modules/jb2a_patreon/Library/Generic/Energy/DodecahedronStarAbove_01_Dark_Purple_600x600.webm",
    "modules/jb2a_patreon/Library/Generic/Marker/MarkerFear_01_Dark_Purple_400x400.webm",
    "modules/JB2A_DnD5e/Library/Generic/Marker/MarkerFear_01_Dark_Purple_400x400.webm",
    "modules/JB2A_DnD5e/Library/Generic/Conditions/Curse01/ConditionCurse01_016_Red_600x600.webm"
  ],
  water: [
    "modules/jb2a_patreon/Library/Generic/Liquid/LiquidSplash01_Bright_Blue_400x400.webm",
    "modules/JB2A_DnD5e/Library/Generic/Impact/ImpactWater02_01_Regular_Blue_600x600.webm",
    "modules/JB2A_DnD5e/Library/Generic/Cast/CastWater02_01_Regular_Blue_400x400.webm",
    "modules/jb2a_patreon/Library/Generic/Liquid/WaterSplashConeLoop_01_01_Regular_Blue_600x600.webm",
    "modules/JB2A_DnD5e/Library/Generic/Liquid/WaterSplashConeLoop_01_01_Regular_Blue_600x600.webm"
  ],
  dry: [
    "modules/jb2a_patreon/Library/Generic/Smoke/SmokePuff01_01_Dark_Black_400x400.webm",
    "modules/jb2a_patreon/Library/2nd_Level/Misty_Step/MistyStep_01_Dark_Red_400x400.webm",
    "modules/JB2A_DnD5e/Library/Generic/Smoke/SmokePuff01_01_Regular_Grey_400x400.webm",
    "modules/jb2a_patreon/Library/Generic/Smoke/SmokePuffRing01_01_Dark_Black_400x400.webm"
  ],
  detection: [
    "modules/jb2a_patreon/Library/Generic/Energy/DodecahedronStarAbove_01_Regular_BlueYellow_600x600.webm",
    "modules/jb2a_patreon/Library/Generic/Energy/DodecahedronRuneAbove_01_Regular_BlueYellow_600x600.webm",
    "modules/jb2a_patreon/Library/1st_Level/Detect_Magic/DetectMagicCircle_01_Regular_Purple_1200x1200.webm",
    "modules/JB2A_DnD5e/Library/1st_Level/Detect_Magic/DetectMagicCircle_01_Regular_Blue_1200x1200.webm"
  ],
  evil_detection: [
    "modules/jb2a_patreon/Library/Generic/Energy/DodecahedronSkullAbove_01_Dark_GreenPurple_600x600.webm",
    "modules/jb2a_patreon/Library/Generic/Marker/MarkerFear_03_Dark_Purple_400x400.webm",
    "modules/JB2A_DnD5e/Library/Generic/Conditions/Curse01/ConditionCurse01_001_Red_600x600.webm",
    "modules/JB2A_DnD5e/Library/Generic/Marker/MarkerFear_01_Dark_Purple_400x400.webm"
  ],
  good_detection: [
    "modules/jb2a_patreon/Library/2nd_Level/Divine_Smite/DivineSmite_01_Regular_BlueYellow_Target_400x400.webm",
    "modules/jb2a_patreon/Library/1st_Level/Bless/Bless_01_Regular_Blue_Intro_400x400.webm",
    "modules/JB2A_DnD5e/Library/1st_Level/Bless/Bless_01_Regular_Yellow_Intro_400x400.webm"
  ],
  fear: [
    "modules/jb2a_patreon/Library/Generic/Marker/MarkerFear_03_Dark_Orange_400x400.webm",
    "modules/jb2a_patreon/Library/Generic/Marker/MarkerFear_02_Dark_Orange_400x400.webm",
    "modules/JB2A_DnD5e/Library/Generic/Marker/MarkerFear_01_Dark_Purple_400x400.webm"
  ],
  calm: [
    "modules/jb2a_patreon/Library/Generic/Creature/FairiesInwardBurst01_01_Regular_BluePurple_600x600.webm",
    "modules/JB2A_DnD5e/Library/Generic/Butterflies/ButterfliesInwardBurst01_01_Regular_BluePurple_600x600.webm",
    "modules/jb2a_patreon/Library/1st_Level/Bless/Bless_01_Regular_Blue_Intro_400x400.webm",
    "modules/jb2a_patreon/Library/1st_Level/Bless/Bless_01_Regular_Green_Intro_400x400.webm"
  ],
  heal: [
    "modules/jb2a_patreon/Library/Generic/Healing/HealingAbility_02_Regular_TealYellow_Burst_600x600.webm",
    "modules/jb2a_patreon/Library/Generic/Healing/HealingAbility_02_Regular_GreenOrange_Burst_600x600.webm",
    "modules/jb2a_patreon/Library/1st_Level/Cure_Wounds/CureWounds_01_Green_400x400.webm",
    "modules/JB2A_DnD5e/Library/1st_Level/Cure_Wounds/CureWounds_01_Blue_400x400.webm"
  ],
  light: [
    "modules/jb2a_patreon/Library/Generic/Marker/MarkerLightIntro_01_Regular_Yellow_400x400.webm",
    "modules/JB2A_DnD5e/Library/Generic/Marker/MarkerLightIntro_01_Regular_Blue_400x400.webm"
  ],
  weapon_slash: [
    "jb2a.melee_attack.slashing.one_handed",
    "jb2a.melee_attack.slashing.two_handed",
    "modules/jb2a_patreon/Library/Generic/Weapon_Attacks/Melee/Sword_01_Regular_White_800x800.webm",
    "modules/JB2A_DnD5e/Library/Generic/Weapon_Attacks/Melee/Sword_01_Regular_White_800x800.webm",
    "modules/JB2A_DnD5e/Library/2nd_Level/Divine_Smite/DivineSmite_01_Regular_BlueYellow_Target_400x400.webm"
  ],
  weapon_cleave: [
    "jb2a.melee_attack.slashing.two_handed",
    "modules/jb2a_patreon/Library/Generic/Weapon_Attacks/Melee/Axe_01_Regular_White_800x800.webm",
    "modules/JB2A_DnD5e/Library/Generic/Weapon_Attacks/Melee/Axe_01_Regular_White_800x800.webm",
    "modules/JB2A_DnD5e/Library/2nd_Level/Divine_Smite/DivineSmite_01_Regular_BlueYellow_Target_400x400.webm"
  ],
  weapon_pierce: [
    "jb2a.melee_attack.piercing.one_handed",
    "jb2a.melee_attack.piercing.two_handed",
    "modules/jb2a_patreon/Library/Generic/Weapon_Attacks/Melee/Piercing_01_Regular_White_800x800.webm",
    "modules/JB2A_DnD5e/Library/Generic/Weapon_Attacks/Melee/Piercing_01_Regular_White_800x800.webm",
    "modules/JB2A_DnD5e/Library/2nd_Level/Divine_Smite/DivineSmite_01_Regular_BlueYellow_Target_400x400.webm"
  ],
  weapon_bludgeon: [
    "jb2a.melee_attack.bludgeoning.one_handed",
    "jb2a.melee_attack.bludgeoning.two_handed",
    "modules/jb2a_patreon/Library/Generic/Weapon_Attacks/Melee/Mace_01_Regular_White_800x800.webm",
    "modules/JB2A_DnD5e/Library/Generic/Weapon_Attacks/Melee/Mace_01_Regular_White_800x800.webm",
    "modules/JB2A_DnD5e/Library/2nd_Level/Divine_Smite/DivineSmite_01_Regular_BlueYellow_Target_400x400.webm"
  ],
  weapon_arrow: [
    "jb2a.arrow.physical.white",
    "jb2a.arrow.physical.01.white",
    "modules/jb2a_patreon/Library/Generic/Weapon_Attacks/Ranged/Arrow01_01_Regular_White_30ft_1600x400.webm",
    "modules/JB2A_DnD5e/Library/Generic/Weapon_Attacks/Ranged/Arrow01_01_Regular_White_30ft_1600x400.webm",
    "modules/JB2A_DnD5e/Library/2nd_Level/Divine_Smite/DivineSmite_01_Regular_BlueYellow_Target_400x400.webm"
  ],
  weapon_bolt: [
    "jb2a.bolt.physical.white",
    "jb2a.arrow.physical.01.white",
    "modules/jb2a_patreon/Library/Generic/Weapon_Attacks/Ranged/Bolt01_01_Regular_White_30ft_1600x400.webm",
    "modules/JB2A_DnD5e/Library/Generic/Weapon_Attacks/Ranged/Bolt01_01_Regular_White_30ft_1600x400.webm",
    "modules/JB2A_DnD5e/Library/2nd_Level/Divine_Smite/DivineSmite_01_Regular_BlueYellow_Target_400x400.webm"
  ],
  weapon_stone: [
    "jb2a.boulder.toss.01.15ft",
    "jb2a.throwing_rock",
    "modules/JB2A_DnD5e/Library/2nd_Level/Divine_Smite/DivineSmite_01_Regular_BlueYellow_Target_400x400.webm"
  ],
  weapon_firearm: [
    "jb2a.bullet.01.orange",
    "jb2a.muzzle_flash.01.orange",
    "modules/JB2A_DnD5e/Library/2nd_Level/Divine_Smite/DivineSmite_01_Regular_BlueYellow_Target_400x400.webm"
  ],
  weapon_ensnare: [
    "jb2a.entangle.01.complete.green",
    "jb2a.web.01",
    "modules/JB2A_DnD5e/Library/Generic/Conditions/Boon01/ConditionBoon01_012_Green_600x600.webm"
  ],
  weapon_whip: [
    "jb2a.melee_attack.slashing.one_handed",
    "modules/JB2A_DnD5e/Library/2nd_Level/Divine_Smite/DivineSmite_01_Regular_BlueYellow_Target_400x400.webm"
  ],
  weapon_default: [
    "modules/JB2A_DnD5e/Library/2nd_Level/Divine_Smite/DivineSmite_01_Regular_BlueYellow_Target_400x400.webm",
    "modules/jb2a_patreon/Library/2nd_Level/Divine_Smite/DivineSmite_01_Regular_YellowWhite_Target_400x400.webm"
  ]
};

const ADD2E_SPELL_KEY_TO_JB2A_PRESET = {
  benediction: "bless",
  malediction: "curse",
  injonction: "command",
  commandement: "command",
  protection_contre_le_mal: "protection",
  protection_contre_le_bien: "protection_dark",
  aquagenese: "water",
  creation_d_eau: "water",
  destruction_eau: "dry",
  detection_magie: "detection",
  detection_du_mal: "evil_detection",
  detection_du_bien: "good_detection",
  apaisement: "calm",
  epouvante: "fear",
  soins_des_blessures_legeres: "heal",
  soins_mineurs: "heal",
  blessures_legeres: "curse"
};

const ADD2E_JB2A_FILE_CACHE = new Map();

function add2eNormalizeFxKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function add2eFirstString(...values) {
  for (const value of values.flat(Infinity)) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function add2eArray(value) {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(add2eArray);
  if (value instanceof Set) return [...value];
  if (typeof value?.values === "function" && typeof value !== "string") return [...value.values()];
  if (typeof value === "object") return Object.values(value);
  return [value];
}

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

function add2eGetActorToken(actor) {
  if (!actor) return null;
  const controlled = globalThis.canvas?.tokens?.controlled ?? [];
  return controlled.find(t => t?.actor?.id === actor.id || t?.document?.actorId === actor.id)
    ?? actor.getActiveTokens?.()[0]
    ?? actor.token?.object
    ?? actor.token
    ?? null;
}

function add2eModuleLooksActiveForPath(path) {
  const p = String(path || "");
  if (p.startsWith("modules/jb2a_patreon/")) return game.modules?.get?.("jb2a_patreon")?.active !== false;
  if (p.startsWith("modules/JB2A_DnD5e/") || p.startsWith("modules/jb2a_dnd5e/")) return game.modules?.get?.("JB2A_DnD5e")?.active !== false;
  return true;
}

async function add2eJb2aFileExists(path) {
  path = String(path || "").trim();
  if (!path || !path.includes("/")) return false;
  if (!add2eModuleLooksActiveForPath(path)) return false;
  if (ADD2E_JB2A_FILE_CACHE.has(path)) return ADD2E_JB2A_FILE_CACHE.get(path);
  try {
    const response = await fetch(path, { method: "GET", cache: "force-cache", headers: { Range: "bytes=0-1" } });
    const ok = !!response.ok || response.status === 206;
    ADD2E_JB2A_FILE_CACHE.set(path, ok);
    return ok;
  } catch (_e) {
    ADD2E_JB2A_FILE_CACHE.set(path, false);
    return false;
  }
}

function add2eSequencerEntryFile(entry) {
  if (!entry) return "";
  if (typeof entry === "string") return entry;
  if (typeof entry.file === "string") return entry.file;
  if (typeof entry.file === "function") {
    try { return String(entry.file() ?? ""); } catch (_e) { return ""; }
  }
  if (Array.isArray(entry.file)) return add2eFirstString(entry.file);
  if (Array.isArray(entry.files)) return add2eFirstString(entry.files);
  return "";
}

function add2eResolveSequencerDatabaseCandidate(candidate) {
  const key = String(candidate ?? "").trim();
  if (!key || key.includes("/")) return "";
  const db = globalThis.Sequencer?.Database;
  if (!db) return "";
  for (const fn of ["getEntry", "get", "getPathsUnder"]) {
    if (typeof db?.[fn] !== "function") continue;
    try {
      const entry = db[fn](key);
      if (Array.isArray(entry)) return add2eFirstString(entry.map(add2eSequencerEntryFile));
      const file = add2eSequencerEntryFile(entry);
      if (file) return file;
    } catch (_e) {}
  }
  return "";
}

async function add2ePickJb2aFiles(preset = "divine", max = 2, explicitCandidates = []) {
  const key = add2eNormalizeFxKey(preset || "divine") || "divine";
  const candidates = [...add2eArray(explicitCandidates), ...(ADD2E_JB2A_PRESET_CANDIDATES[key] ?? [])];
  const files = [];
  for (const candidate of candidates) {
    if (files.length >= max) break;
    const resolved = add2eResolveSequencerDatabaseCandidate(candidate) || String(candidate ?? "").trim();
    if (!resolved) continue;
    if (resolved.includes("/") && await add2eJb2aFileExists(resolved)) files.push(resolved);
  }
  if (!files.length) console.warn("[ADD2E][JB2A][MISSING_PRESET] Aucun fichier JB2A trouvé pour le preset.", { preset: key, candidates });
  return [...new Set(files)];
}

export async function add2ePlayJb2aPremiumFx(target, preset = "divine", options = {}) {
  try {
    if (typeof Sequence === "undefined") return false;
    const key = add2eNormalizeFxKey(preset || "divine") || "divine";
    const tokenObj = add2eGetTokenLikeObject(target);
    const point = add2eGetTokenLikeCenter(target);
    if (!tokenObj && !point) return false;
    const maxFiles = Math.max(1, Math.min(3, Number(options.maxFiles ?? 2) || 2));
    const files = await add2ePickJb2aFiles(key, maxFiles, options.files ?? options.file ?? []);
    if (!files.length) return false;
    globalThis.ADD2E_LAST_CLERC_FX_AT = Date.now();
    let played = false;
    let step = 0;
    for (const file of files) {
      const seq = new Sequence();
      const effect = seq.effect().file(file);
      if (tokenObj) effect.attachTo(tokenObj);
      else effect.atLocation(point);
      effect
        .scaleToObject(options.scaleToObject ?? (step === 0 ? 1.35 : 1.1))
        .opacity(options.opacity ?? (step === 0 ? 0.9 : 0.75))
        .belowTokens(options.belowTokens ?? step > 0);
      await seq.play();
      played = true;
      step += 1;
    }
    return played;
  } catch (e) {
    console.warn("[ADD2E][JB2A][ERROR] VFX ignoré pour ne pas bloquer l'action.", { preset, error: e });
    return false;
  }
}

function add2eGetWeaponJb2aConfig(weapon) {
  const s = weapon?.system ?? weapon?.data ?? {};
  const f = weapon?.flags?.add2e ?? {};
  const explicit = s.jb2a ?? s.jb2aFx ?? f.jb2a ?? f.jb2aFx ?? {};
  if (typeof explicit === "string") return { preset: explicit, mode: "" };
  return {
    ...(typeof explicit === "object" && explicit ? explicit : {}),
    preset: explicit?.preset ?? explicit?.type ?? s.jb2aPreset ?? f.jb2aPreset ?? "",
    mode: explicit?.mode ?? s.jb2aMode ?? f.jb2aMode ?? "",
    file: explicit?.file ?? explicit?.files ?? s.jb2aFile ?? f.jb2aFile ?? null
  };
}

function add2eInferWeaponJb2aPreset(weapon) {
  const s = weapon?.system ?? weapon?.data ?? {};
  const text = add2eNormalizeFxKey([
    weapon?.name,
    s.nom,
    s.categorie,
    s.category,
    s.type,
    s.type_arme,
    s.type_degats,
    s.damageType,
    s.proprietes,
    s.tags,
    s.effectTags
  ].flatMap(add2eArray).join(" "));
  if (/(arquebuse|pistolet|mousquet|arme_feu|arme_a_feu|feu)/.test(text)) return { preset: "weapon_firearm", mode: "projectile" };
  if (/(arbalete|carreau|bolt)/.test(text)) return { preset: "weapon_bolt", mode: "projectile" };
  if (/(arc|fleche|flèche|sarbacane|aiguille|arrow)/.test(text)) return { preset: "weapon_arrow", mode: "projectile" };
  if (/(fronde|balle|pierre|stone)/.test(text)) return { preset: "weapon_stone", mode: "projectile" };
  if (/(filet|lasso|bolas|entrave|attrape_homme)/.test(text)) return { preset: "weapon_ensnare", mode: "projectile" };
  if (/(fouet|martinet|whip)/.test(text)) return { preset: "weapon_whip", mode: "impact" };
  if (/(hache|bardiche|hallebarde|guisarme|voulge|arme_hast|axe)/.test(text)) return { preset: "weapon_cleave", mode: "impact" };
  if (/(baton|bâton|massue|masse|marteau|fleau|fléau|contond|bludgeon|mace|hammer)/.test(text)) return { preset: "weapon_bludgeon", mode: "impact" };
  if (/(dague|lance|pique|perfor|trident|stylet|javelot|fourche|pierce)/.test(text)) return { preset: "weapon_pierce", mode: "impact" };
  if (/(tranch|epee|épée|sabre|cimeterre|rapiere|rapière|slash|sword)/.test(text)) return { preset: "weapon_slash", mode: "impact" };
  return { preset: "weapon_default", mode: "impact" };
}

async function add2ePlayWeaponAttackFx({ actor, weapon, sourceToken, targetToken } = {}) {
  try {
    if (typeof Sequence === "undefined" || !weapon) return false;
    const explicit = add2eGetWeaponJb2aConfig(weapon);
    const inferred = add2eInferWeaponJb2aPreset(weapon);
    const preset = add2eNormalizeFxKey(explicit.preset || inferred.preset || "weapon_default") || "weapon_default";
    const mode = add2eNormalizeFxKey(explicit.mode || inferred.mode || "impact") || "impact";
    const files = await add2ePickJb2aFiles(preset, 1, explicit.file ?? explicit.files ?? []);
    if (!files.length) return false;
    const src = add2eGetTokenLikeObject(sourceToken) ?? add2eGetActorToken(actor);
    const target = add2eGetTokenLikeObject(targetToken) ?? Array.from(game.user?.targets ?? [])[0] ?? null;
    const point = add2eGetTokenLikeCenter(target) ?? add2eGetTokenLikeCenter(src);
    if (!src && !point) return false;
    const seq = new Sequence();
    const effect = seq.effect().file(files[0]);
    if (mode === "projectile" && src && target && typeof effect.stretchTo === "function") effect.atLocation(src).stretchTo(target);
    else if (target) effect.attachTo(target);
    else if (point) effect.atLocation(point);
    else return false;
    effect.scaleToObject(1).opacity(0.9);
    await seq.play();
    console.log("[ADD2E][JB2A][WEAPON][PLAY]", { weapon: weapon?.name, preset, mode, file: files[0] });
    return true;
  } catch (e) {
    console.warn("[ADD2E][JB2A][WEAPON][ERROR] VFX d'arme ignoré pour ne pas bloquer l'attaque.", { weapon: weapon?.name, error: e });
    return false;
  }
}

function add2eWrapAttackRollForWeaponFx(fn) {
  if (typeof fn !== "function") return fn;
  if (fn.__add2eWeaponFxWrapped) return fn;
  if (fn.name === "add2eAttackRollPending") return fn;
  const original = fn;
  const wrapped = async function add2eAttackRollWeaponFxWrapper(...args) {
    const payload = args[0] ?? {};
    const actor = payload.actor ?? (payload.actorId ? game.actors?.get?.(payload.actorId) : null) ?? null;
    const weapon = payload.arme ?? payload.weapon ?? payload.item ?? (actor && payload.itemId ? actor.items?.get?.(payload.itemId) : null) ?? null;
    const sourceToken = payload.token ?? payload.sourceToken ?? add2eGetActorToken(actor);
    const targetTokenBeforeRoll = payload.targetToken ?? Array.from(game.user?.targets ?? [])[0] ?? null;
    const result = await original.apply(this, args);
    if (weapon?.type === "arme") await add2ePlayWeaponAttackFx({ actor, weapon, sourceToken, targetToken: payload.targetToken ?? targetTokenBeforeRoll ?? Array.from(game.user?.targets ?? [])[0] ?? null });
    return result;
  };
  wrapped.__add2eWeaponFxWrapped = true;
  wrapped.__add2eOriginalAttackRoll = original;
  return wrapped;
}

function add2eInstallWeaponAttackPatch() {
  if (globalThis.__ADD2E_WEAPON_FX_ATTACK_ACCESSOR === globalThis.ADD2E_JB2A_VFX_VERSION) return true;
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "add2eAttackRoll");
  let stored = add2eWrapAttackRollForWeaponFx(globalThis.add2eAttackRoll);
  try {
    Object.defineProperty(globalThis, "add2eAttackRoll", {
      configurable: true,
      get() { return stored; },
      set(value) { stored = add2eWrapAttackRollForWeaponFx(value); }
    });
    globalThis.__ADD2E_WEAPON_FX_ATTACK_ACCESSOR = globalThis.ADD2E_JB2A_VFX_VERSION;
    if (descriptor?.set && typeof descriptor.set === "function") descriptor.set.call(globalThis, stored);
    return true;
  } catch (e) {
    console.warn("[ADD2E][JB2A][WEAPON][PATCH_ERROR] Accroche attaque non installée.", e);
    globalThis.add2eAttackRoll = stored;
    return false;
  }
}

function add2eScheduleWeaponAttackPatch() {
  let attempts = 0;
  const tryPatch = () => {
    attempts += 1;
    add2eInstallWeaponAttackPatch();
    const fn = globalThis.add2eAttackRoll;
    if ((typeof fn === "function" && fn.__add2eWeaponFxWrapped) || attempts >= 60) return;
    setTimeout(tryPatch, 250);
  };
  tryPatch();
}

async function add2ePlayCentralSpellFx(spellKey = "divine", context = {}) {
  const key = add2eNormalizeFxKey(spellKey || "divine") || "divine";
  const preset = ADD2E_SPELL_KEY_TO_JB2A_PRESET[key] || key || "divine";
  const targets = Array.isArray(context.targetTokens) ? context.targetTokens.filter(Boolean) : [];
  if (!targets.length) {
    const singleTarget = context.targetToken ?? context.target ?? null;
    if (singleTarget) targets.push(singleTarget);
  }
  if (!targets.length) {
    const fallbackCaster = context.casterToken ?? context.caster ?? context.sourceToken ?? null;
    if (fallbackCaster) targets.push(fallbackCaster);
  }
  let played = false;
  for (const target of targets) played = await add2ePlayJb2aPremiumFx(target, preset, context.jb2aOptions ?? {}) || played;
  return played;
}

globalThis.ADD2E_CLERC_PLAY_LAUNCH_FX = add2ePlayJb2aPremiumFx;
globalThis.ADD2E_PLAY_SPELL_FX = add2ePlayCentralSpellFx;
globalThis.ADD2E_PLAY_WEAPON_FX = add2ePlayWeaponAttackFx;
globalThis.ADD2E_JB2A_PRESET_CANDIDATES = ADD2E_JB2A_PRESET_CANDIDATES;
globalThis.ADD2E_SPELL_KEY_TO_JB2A_PRESET = ADD2E_SPELL_KEY_TO_JB2A_PRESET;
add2eScheduleWeaponAttackPatch();

Hooks.once("ready", () => {
  globalThis.ADD2E_PLAY_SPELL_FX = add2ePlayCentralSpellFx;
  globalThis.ADD2E_PLAY_WEAPON_FX = add2ePlayWeaponAttackFx;
  globalThis.ADD2E_JB2A_PRESET_CANDIDATES = ADD2E_JB2A_PRESET_CANDIDATES;
  globalThis.ADD2E_SPELL_KEY_TO_JB2A_PRESET = ADD2E_SPELL_KEY_TO_JB2A_PRESET;
  add2eScheduleWeaponAttackPatch();
  console.log("[ADD2E][JB2A][VERSION]", globalThis.ADD2E_JB2A_VFX_VERSION);
});
