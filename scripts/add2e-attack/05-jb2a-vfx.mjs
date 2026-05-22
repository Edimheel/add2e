// scripts/add2e-attack/05-jb2a-vfx.mjs
// ADD2E — VFX JB2A Premium sécurisés.
// Version : 2026-05-21-v3-target-first-no-yellow-curse

globalThis.ADD2E_JB2A_VFX_VERSION = "2026-05-21-v3-target-first-no-yellow-curse";

const ADD2E_JB2A_PRESET_CANDIDATES = {
  divine: [
    "modules/jb2a_patreon/Library/Generic/Cast/GenericCast01_01_Regular_Yellow_400x400.webm",
    "modules/JB2A_DnD5e/Library/Generic/Cast/GenericCast01_01_Regular_Yellow_400x400.webm",
    "modules/JB2A_DnD5e/Library/Generic/Magic_Signs/ConjurationCircleIntro_02_Regular_Yellow_800x800.webm",
    "modules/JB2A_DnD5e/Library/Generic/Magic_Signs/AbjurationCircleIntro_02_Regular_Blue_800x800.webm"
  ],
  bless: [
    "modules/jb2a_patreon/Library/1st_Level/Bless/Bless_01_Regular_Yellow_Intro_400x400.webm",
    "modules/JB2A_DnD5e/Library/1st_Level/Bless/Bless_01_Regular_Yellow_Intro_400x400.webm",
    "modules/JB2A_DnD5e/Library/Generic/Conditions/Boon01/ConditionBoon01_001_Green_600x600.webm",
    "modules/jb2a_patreon/Library/Generic/Cast/GenericCast01_01_Regular_Yellow_400x400.webm",
    "modules/JB2A_DnD5e/Library/Generic/Cast/GenericCast01_01_Regular_Yellow_400x400.webm"
  ],
  curse: [
    "modules/jb2a_patreon/Library/Generic/Cast/GenericCast01_01_Regular_Purple_400x400.webm",
    "modules/JB2A_DnD5e/Library/Generic/Cast/GenericCast01_01_Regular_Purple_400x400.webm",
    "modules/jb2a_patreon/Library/Generic/Cast/GenericCast01_01_Regular_Dark_Red_400x400.webm",
    "modules/JB2A_DnD5e/Library/Generic/Cast/GenericCast01_01_Regular_Dark_Red_400x400.webm",
    "modules/JB2A_DnD5e/Library/Generic/Magic_Signs/NecromancyCircleIntro_02_Regular_Purple_800x800.webm"
  ],
  water: [
    "modules/jb2a_patreon/Library/Generic/Cast/GenericCast01_01_Regular_Blue_400x400.webm",
    "modules/JB2A_DnD5e/Library/Generic/Cast/GenericCast01_01_Regular_Blue_400x400.webm",
    "modules/JB2A_DnD5e/Library/Generic/Marker/MarkerLightIntro_01_Regular_Blue_400x400.webm"
  ],
  detection: [
    "modules/jb2a_patreon/Library/Generic/Cast/GenericCast01_01_Regular_Green_400x400.webm",
    "modules/JB2A_DnD5e/Library/Generic/Cast/GenericCast01_01_Regular_Green_400x400.webm",
    "modules/jb2a_patreon/Library/Generic/Cast/GenericCast01_01_Regular_Yellow_400x400.webm",
    "modules/JB2A_DnD5e/Library/Generic/Cast/GenericCast01_01_Regular_Yellow_400x400.webm"
  ],
  fear: [
    "modules/jb2a_patreon/Library/Generic/Cast/GenericCast01_01_Regular_Dark_Red_400x400.webm",
    "modules/JB2A_DnD5e/Library/Generic/Cast/GenericCast01_01_Regular_Dark_Red_400x400.webm",
    "modules/JB2A_DnD5e/Library/Generic/Cast/GenericCast01_01_Regular_Purple_400x400.webm"
  ],
  heal: [
    "modules/jb2a_patreon/Library/1st_Level/Cure_Wounds/CureWounds_01_Green_400x400.webm",
    "modules/JB2A_DnD5e/Library/1st_Level/Cure_Wounds/CureWounds_01_Blue_400x400.webm",
    "modules/JB2A_DnD5e/Library/Generic/Healing/HealingAbility_01_Green_400x400.webm"
  ],
  light: [
    "modules/jb2a_patreon/Library/Generic/Marker/MarkerLightIntro_01_Regular_Yellow_400x400.webm",
    "modules/JB2A_DnD5e/Library/Generic/Marker/MarkerLightIntro_01_Regular_Blue_400x400.webm"
  ]
};

const ADD2E_SPELL_KEY_TO_JB2A_PRESET = {
  benediction: "bless",
  malediction: "curse",
  aquagenese: "water",
  destruction_eau: "water",
  detection_magie: "detection",
  detection_du_mal: "fear",
  detection_du_bien: "bless",
  apaisement: "bless",
  epouvante: "fear"
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
  if (p.startsWith("modules/jb2a_patreon/")) return game.modules?.get?.("jb2a_patreon")?.active !== false;
  if (p.startsWith("modules/JB2A_DnD5e/") || p.startsWith("modules/jb2a_dnd5e/")) return game.modules?.get?.("JB2A_DnD5e")?.active !== false;
  return true;
}

async function add2eJb2aFileExists(path) {
  path = String(path || "").trim();
  if (!path) return false;
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

async function add2ePickJb2aFile(preset = "divine") {
  const key = add2eNormalizeFxKey(preset || "divine") || "divine";
  const presetCandidates = ADD2E_JB2A_PRESET_CANDIDATES[key] ?? [];
  const candidates = key === "divine"
    ? presetCandidates
    : presetCandidates;

  for (const candidate of candidates) {
    if (await add2eJb2aFileExists(candidate)) return candidate;
  }

  // Pas de fallback jaune pour les presets spécifiques : si le fichier n'existe pas,
  // on ne joue rien au lieu de transformer une malédiction en effet divin jaune.
  if (key !== "divine") {
    console.warn("[ADD2E][JB2A][MISSING_PRESET] Aucun fichier JB2A trouvé pour le preset spécifique.", { preset: key, candidates });
    return "";
  }

  return "";
}

export async function add2ePlayJb2aPremiumFx(target, preset = "divine", options = {}) {
  try {
    if (typeof Sequence === "undefined") return false;

    const key = add2eNormalizeFxKey(preset || "divine") || "divine";
    const tokenObj = add2eGetTokenLikeObject(target);
    const point = add2eGetTokenLikeCenter(target);
    if (!tokenObj && !point) return false;

    const file = await add2ePickJb2aFile(key);
    if (!file) return false;

    globalThis.ADD2E_LAST_CLERC_FX_AT = Date.now();

    const seq = new Sequence();
    const effect = seq.effect().file(file);

    if (tokenObj) effect.attachTo(tokenObj);
    else effect.atLocation(point);

    effect
      .scaleToObject(options.scaleToObject ?? 1.15)
      .opacity(options.opacity ?? 0.85)
      .belowTokens(options.belowTokens ?? false);

    await seq.play();
    console.log("[ADD2E][JB2A][PLAY]", { preset: key, file, target: tokenObj?.name ?? null });
    return true;
  } catch (e) {
    console.warn("[ADD2E][JB2A][ERROR] VFX ignoré pour ne pas bloquer l'action.", { preset, error: e });
    return false;
  }
}

async function add2ePlayCentralSpellFx(spellKey = "divine", context = {}) {
  const key = add2eNormalizeFxKey(spellKey || "divine") || "divine";
  const preset = ADD2E_SPELL_KEY_TO_JB2A_PRESET[key] || key || "divine";

  const targets = Array.isArray(context.targetTokens)
    ? context.targetTokens.filter(Boolean)
    : [];

  if (!targets.length) {
    const singleTarget = context.targetToken ?? context.target ?? null;
    if (singleTarget) targets.push(singleTarget);
  }

  if (!targets.length) {
    const fallbackCaster = context.casterToken ?? context.caster ?? context.sourceToken ?? null;
    if (fallbackCaster) targets.push(fallbackCaster);
  }

  let played = false;
  for (const target of targets) {
    played = await add2ePlayJb2aPremiumFx(target, preset, context.jb2aOptions ?? {}) || played;
  }

  return played;
}

// Compat ancien moteur + nouveau registre centralisé.
globalThis.ADD2E_CLERC_PLAY_LAUNCH_FX = add2ePlayJb2aPremiumFx;
globalThis.ADD2E_PLAY_SPELL_FX = add2ePlayCentralSpellFx;

Hooks.once("ready", () => {
  globalThis.ADD2E_PLAY_SPELL_FX = add2ePlayCentralSpellFx;
  console.log("[ADD2E][JB2A][VERSION]", globalThis.ADD2E_JB2A_VFX_VERSION);
});
