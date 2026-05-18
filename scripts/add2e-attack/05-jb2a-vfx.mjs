// scripts/add2e-attack/05-jb2a-vfx.mjs
// ADD2E — VFX JB2A Premium sécurisés.

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
    "modules/JB2A_DnD5e/Library/Generic/Conditions/Boon01/ConditionBoon01_001_Green_600x600.webm"
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

export async function add2ePlayJb2aPremiumFx(target, preset = "divine", options = {}) {
  try {
    if (typeof Sequence === "undefined") return false;

    const tokenObj = add2eGetTokenLikeObject(target);
    const point = add2eGetTokenLikeCenter(target);
    if (!tokenObj && !point) return false;

    const file = await add2ePickJb2aFile(preset);
    if (!file) return false;

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
    console.warn("[ADD2E][JB2A][ERROR] VFX ignoré pour ne pas bloquer l'action.", { preset, error: e });
    return false;
  }
}

globalThis.ADD2E_CLERC_PLAY_LAUNCH_FX = add2ePlayJb2aPremiumFx;
