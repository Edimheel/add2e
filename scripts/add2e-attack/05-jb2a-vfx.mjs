// scripts/add2e-attack/05-jb2a-vfx.mjs
// ADD2E — VFX JB2A Premium sécurisés pour sorts et attaques d'armes.
// Version : 2026-06-29-persistent-darkness-ground-v1

globalThis.ADD2E_JB2A_VFX_VERSION = "2026-06-29-persistent-darkness-ground-v1";

const ADD2E_JB2A_WEAPON_FX_DEDUPE_MS = 1200;
globalThis.__ADD2E_JB2A_WEAPON_FX_DEDUPE_KEYS ??= new Map();

const ADD2E_JB2A_VISIBLE_IMPACT = [
  "modules/JB2A_DnD5e/Library/2nd_Level/Divine_Smite/DivineSmite_01_Regular_BlueYellow_Target_400x400.webm",
  "modules/jb2a_patreon/Library/2nd_Level/Divine_Smite/DivineSmite_01_Regular_YellowWhite_Target_400x400.webm"
];

const ADD2E_JB2A_WEAPON_SLASH = [
  "modules/JB2A_DnD5e/Library/Generic/Weapon_Attacks/Melee/Sword01_06_Regular_White_800x600.webm",
  ...ADD2E_JB2A_VISIBLE_IMPACT
];

const ADD2E_JB2A_WEAPON_CLEAVE = [
  "modules/JB2A_DnD5e/Library/Generic/Weapon_Attacks/Melee/Axe01_01_Regular_White_800x600.webm",
  "modules/JB2A_DnD5e/Library/Generic/Weapon_Attacks/Melee/Sword01_06_Regular_White_800x600.webm",
  ...ADD2E_JB2A_VISIBLE_IMPACT
];

const ADD2E_JB2A_WEAPON_PIERCE = [
  "modules/JB2A_DnD5e/Library/Generic/Weapon_Attacks/Melee/Piercing01_01_Regular_White_800x600.webm",
  "modules/JB2A_DnD5e/Library/Generic/Weapon_Attacks/Melee/Dagger01_01_Regular_White_800x600.webm",
  "modules/JB2A_DnD5e/Library/Generic/Weapon_Attacks/Melee/Sword01_06_Regular_White_800x600.webm",
  ...ADD2E_JB2A_VISIBLE_IMPACT
];

const ADD2E_JB2A_WEAPON_BLUDGEON = [
  "modules/JB2A_DnD5e/Library/Generic/Weapon_Attacks/Melee/Mace01_01_Regular_White_800x600.webm",
  "modules/JB2A_DnD5e/Library/Generic/Weapon_Attacks/Melee/Hammer01_01_Regular_White_800x600.webm",
  "modules/JB2A_DnD5e/Library/Generic/Weapon_Attacks/Melee/Sword01_06_Regular_White_800x600.webm",
  ...ADD2E_JB2A_VISIBLE_IMPACT
];

const ADD2E_JB2A_WEAPON_RANGED = [
  "modules/JB2A_DnD5e/Library/Generic/Weapon_Attacks/Ranged/Arrow01_01_Regular_White_30ft_1600x400.webm",
  "modules/JB2A_DnD5e/Library/Generic/Weapon_Attacks/Ranged/Bolt01_01_Regular_White_30ft_1600x400.webm",
  "modules/JB2A_DnD5e/Library/Generic/Weapon_Attacks/Melee/Sword01_06_Regular_White_800x600.webm",
  ...ADD2E_JB2A_VISIBLE_IMPACT
];

const ADD2E_JB2A_WEAPON_SPECIAL = [
  "modules/JB2A_DnD5e/Library/Generic/Conditions/Boon01/ConditionBoon01_012_Green_600x600.webm",
  "modules/JB2A_DnD5e/Library/Generic/Weapon_Attacks/Melee/Sword01_06_Regular_White_800x600.webm",
  ...ADD2E_JB2A_VISIBLE_IMPACT
];

const ADD2E_JB2A_DARKNESS_GROUND = [
  "modules/jb2a_patreon/Library/1st_Level/Darkness/Darkness_01_Regular_Black_600x600.webm",
  "modules/JB2A_DnD5e/Library/1st_Level/Darkness/Darkness_01_Regular_Black_600x600.webm",
  "modules/jb2a_patreon/Library/Generic/Marker/MarkerFear_01_Dark_Purple_400x400.webm",
  "modules/JB2A_DnD5e/Library/Generic/Marker/MarkerFear_01_Dark_Purple_400x400.webm"
];

const ADD2E_JB2A_PRESET_CANDIDATES = {
  divine: [
    "modules/jb2a_patreon/Library/2nd_Level/Divine_Smite/DivineSmite_01_Regular_YellowWhite_Target_400x400.webm",
    "modules/JB2A_DnD5e/Library/2nd_Level/Divine_Smite/DivineSmite_01_Regular_BlueYellow_Target_400x400.webm",
    "modules/jb2a_patreon/Library/1st_Level/Bless/Bless_01_Regular_Yellow_Intro_400x400.webm",
    "modules/JB2A_DnD5e/Library/1st_Level/Bless/Bless_01_Regular_Yellow_Intro_400x400.webm"
  ],
  bless: [
    "modules/JB2A_DnD5e/Library/Generic/Conditions/Boon01/ConditionBoon01_020_Green_600x600.webm",
    ...ADD2E_JB2A_VISIBLE_IMPACT
  ],
  curse: [
    "modules/JB2A_DnD5e/Library/Generic/Conditions/Curse01/ConditionCurse01_020_Red_600x600.webm",
    ...ADD2E_JB2A_VISIBLE_IMPACT
  ],
  protection: [
    "modules/JB2A_DnD5e/Library/Generic/Shield/Shield_01_Regular_Yellow_400x400.webm",
    ...ADD2E_JB2A_VISIBLE_IMPACT
  ],
  protection_dark: [
    "modules/JB2A_DnD5e/Library/Generic/Shield/Shield_01_Regular_Purple_400x400.webm",
    ...ADD2E_JB2A_VISIBLE_IMPACT
  ],
  command: [
    "modules/JB2A_DnD5e/Library/Generic/Marker/MarkerFear_01_Dark_Purple_400x400.webm",
    ...ADD2E_JB2A_VISIBLE_IMPACT
  ],
  water: [
    "modules/JB2A_DnD5e/Library/Generic/Impact/ImpactWater02_01_Regular_Blue_600x600.webm",
    ...ADD2E_JB2A_VISIBLE_IMPACT
  ],
  dry: [
    "modules/JB2A_DnD5e/Library/Generic/Smoke/SmokePuff01_01_Regular_Grey_400x400.webm",
    ...ADD2E_JB2A_VISIBLE_IMPACT
  ],
  detection: [
    "modules/JB2A_DnD5e/Library/1st_Level/Detect_Magic/DetectMagicCircle_01_Regular_Blue_1200x1200.webm",
    ...ADD2E_JB2A_VISIBLE_IMPACT
  ],
  evil_detection: [
    "modules/JB2A_DnD5e/Library/Generic/Marker/MarkerFear_01_Dark_Purple_400x400.webm",
    ...ADD2E_JB2A_VISIBLE_IMPACT
  ],
  good_detection: [...ADD2E_JB2A_VISIBLE_IMPACT],
  fear: [
    "modules/JB2A_DnD5e/Library/Generic/Marker/MarkerFear_01_Dark_Purple_400x400.webm",
    ...ADD2E_JB2A_VISIBLE_IMPACT
  ],
  calm: [
    "modules/JB2A_DnD5e/Library/Generic/Butterflies/ButterfliesInwardBurst01_Regular_BluePurple_600x600.webm",
    ...ADD2E_JB2A_VISIBLE_IMPACT
  ],
  heal: [
    "modules/JB2A_DnD5e/Library/1st_Level/Cure_Wounds/CureWounds_01_Blue_400x400.webm",
    ...ADD2E_JB2A_VISIBLE_IMPACT
  ],
  light: [
    "modules/JB2A_DnD5e/Library/Generic/Marker/MarkerLightIntro_01_Regular_Blue_400x400.webm",
    ...ADD2E_JB2A_VISIBLE_IMPACT
  ],
  darkness: ADD2E_JB2A_DARKNESS_GROUND,
  weapon_slash: [...ADD2E_JB2A_WEAPON_SLASH],
  weapon_cleave: [...ADD2E_JB2A_WEAPON_CLEAVE],
  weapon_pierce: [...ADD2E_JB2A_WEAPON_PIERCE],
  weapon_bludgeon: [...ADD2E_JB2A_WEAPON_BLUDGEON],
  weapon_arrow: [...ADD2E_JB2A_WEAPON_RANGED],
  weapon_bolt: [...ADD2E_JB2A_WEAPON_RANGED],
  weapon_stone: [...ADD2E_JB2A_WEAPON_RANGED],
  weapon_firearm: [...ADD2E_JB2A_WEAPON_RANGED],
  weapon_ensnare: [...ADD2E_JB2A_WEAPON_SPECIAL],
  weapon_whip: [...ADD2E_JB2A_WEAPON_SLASH],
  weapon_default: [...ADD2E_JB2A_WEAPON_SLASH]
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
  blessures_legeres: "curse",
  tenebres: "darkness"
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

function add2eCallEffectMethod(effect, method, ...args) {
  try {
    if (typeof effect?.[method] === "function") effect[method](...args);
  } catch (_e) {
    // Compatibilité Sequencer : certaines méthodes peuvent varier selon la version.
  }
  return effect;
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

async function add2ePickJb2aFiles(preset = "divine", max = 2, explicitCandidates = []) {
  const key = add2eNormalizeFxKey(preset || "divine") || "divine";
  const candidates = [...add2eArray(explicitCandidates), ...(ADD2E_JB2A_PRESET_CANDIDATES[key] ?? ADD2E_JB2A_VISIBLE_IMPACT)]
    .map(candidate => String(candidate ?? "").trim())
    .filter(candidate => candidate && candidate.includes("/"));
  const files = [];
  for (const candidate of candidates) {
    if (files.length >= max) break;
    if (await add2eJb2aFileExists(candidate)) files.push(candidate);
  }
  if (!files.length) console.warn("[ADD2E][JB2A][MISSING_PRESET] Aucun fichier JB2A direct trouvé pour le preset.", { preset: key, candidates });
  return [...new Set(files)];
}

function add2eEffectFlags(effect) {
  return effect?.flags?.add2e ?? effect?.getFlag?.("add2e") ?? {};
}

function add2eEffectTags(effect) {
  return add2eArray(add2eEffectFlags(effect)?.tags)
    .map(add2eNormalizeFxKey)
    .filter(Boolean);
}

function add2eDarknessEffectName(effect) {
  const identity = effect?.uuid ?? `${effect?.parent?.uuid ?? "actor"}:${effect?.id ?? effect?._id ?? "effect"}`;
  return `add2e-tenebres:${identity}`;
}

function add2eUnitToMeters(value, unit) {
  const key = String(unit ?? "m").toLowerCase();
  if (["ft", "feet", "foot", "pied", "pieds", "pi"].includes(key)) return value * 0.3048;
  if (["yd", "yard", "yards", "verge", "verges"].includes(key)) return value * 0.9144;
  if (["km", "kilometre", "kilomètre", "kilometres", "kilomètres"].includes(key)) return value * 1000;
  return value;
}

function add2eGroundScaleForFile(scene, file, radiusMeters = 6) {
  const gridSize = Number(scene?.grid?.size ?? canvas?.grid?.size ?? 100) || 100;
  const gridDistance = Number(scene?.grid?.distance ?? canvas?.grid?.distance ?? 1) || 1;
  const gridMeters = Math.max(0.0001, add2eUnitToMeters(gridDistance, scene?.grid?.units ?? canvas?.scene?.grid?.units ?? "m"));
  const diameterPixels = (Math.max(0.1, Number(radiusMeters) || 6) * 2 / gridMeters) * gridSize;
  const dimensions = String(file ?? "").match(/_(\d+)x(\d+)\.webm$/i);
  const nativePixels = Math.max(1, Number(dimensions?.[1] ?? 600), Number(dimensions?.[2] ?? 600));
  return Math.max(0.15, Math.min(12, diameterPixels / nativePixels));
}

function add2eCurrentSceneTokenObject(scene, tokenId) {
  if (!scene || scene.id !== canvas?.scene?.id || !tokenId) return null;
  return canvas.tokens?.get?.(tokenId)
    ?? canvas.tokens?.placeables?.find?.(token => token?.id === tokenId || token?.document?.id === tokenId)
    ?? null;
}

function add2ePayloadPoint(scene, payload = {}) {
  if (Number.isFinite(Number(payload.x)) && Number.isFinite(Number(payload.y))) {
    return { x: Number(payload.x), y: Number(payload.y) };
  }
  const tokenDoc = payload.tokenId ? scene?.tokens?.get?.(payload.tokenId) ?? null : null;
  if (!tokenDoc) return null;
  const size = Number(scene?.grid?.size ?? canvas?.grid?.size ?? 100) || 100;
  return {
    x: Number(tokenDoc.x ?? 0) + ((Number(tokenDoc.width ?? 1) || 1) * size / 2),
    y: Number(tokenDoc.y ?? 0) + ((Number(tokenDoc.height ?? 1) || 1) * size / 2)
  };
}

async function add2eEndPersistentGroundFx(name) {
  if (!name || !globalThis.Sequencer?.EffectManager?.endEffects) return false;
  try {
    await globalThis.Sequencer.EffectManager.endEffects({ name });
    return true;
  } catch (_error) {
    return false;
  }
}

async function add2ePlayPersistentDarknessGround(effect) {
  try {
    if (typeof Sequence === "undefined" || !globalThis.Sequencer?.EffectManager) return false;
    if (effect?.disabled) return false;
    if (!add2eEffectTags(effect).includes("sort:tenebres")) return false;

    const payload = add2eEffectFlags(effect)?.lightPayload ?? null;
    const scene = game.scenes?.get?.(payload?.sceneId) ?? canvas?.scene ?? null;
    if (!payload || !scene || scene.id !== canvas?.scene?.id) return false;

    const point = add2ePayloadPoint(scene, payload);
    if (!point) return false;

    const files = await add2ePickJb2aFiles("darkness", 1);
    if (!files.length) return false;

    const name = add2eDarknessEffectName(effect);
    await add2eEndPersistentGroundFx(name);

    const tokenObj = payload.type === "token" ? add2eCurrentSceneTokenObject(scene, payload.tokenId) : null;
    const seq = new Sequence();
    const visual = seq.effect().file(files[0]);
    if (tokenObj) visual.attachTo(tokenObj);
    else visual.atLocation(point);

    add2eCallEffectMethod(visual, "name", name);
    add2eCallEffectMethod(visual, "persist");
    add2eCallEffectMethod(visual, "scale", add2eGroundScaleForFile(scene, files[0], 6));
    add2eCallEffectMethod(visual, "opacity", 0.95);
    add2eCallEffectMethod(visual, "tint", "#000000");
    add2eCallEffectMethod(visual, "belowTokens", true);
    add2eCallEffectMethod(visual, "aboveLighting");
    add2eCallEffectMethod(visual, "fadeIn", 150);
    await seq.play();
    return true;
  } catch (_error) {
    return false;
  }
}

async function add2eClearPersistentDarknessGround(effect) {
  if (!add2eEffectTags(effect).includes("sort:tenebres")) return false;
  return add2eEndPersistentGroundFx(add2eDarknessEffectName(effect));
}

async function add2eRestorePersistentDarknessGrounds() {
  if (!canvas?.ready) return;
  for (const actor of game.actors?.contents ?? []) {
    for (const effect of actor.effects ?? []) {
      await add2ePlayPersistentDarknessGround(effect);
    }
  }
}

function add2eInstallPersistentDarknessGroundHooks() {
  if (globalThis.__ADD2E_PERSISTENT_DARKNESS_GROUND_VERSION === globalThis.ADD2E_JB2A_VFX_VERSION) return;
  globalThis.__ADD2E_PERSISTENT_DARKNESS_GROUND_VERSION = globalThis.ADD2E_JB2A_VFX_VERSION;

  Hooks.on("createActiveEffect", effect => {
    void add2ePlayPersistentDarknessGround(effect);
  });
  Hooks.on("deleteActiveEffect", effect => {
    void add2eClearPersistentDarknessGround(effect);
  });
  Hooks.on("updateActiveEffect", (effect, changes) => {
    if (changes?.disabled === true) void add2eClearPersistentDarknessGround(effect);
    if (changes?.disabled === false) void add2ePlayPersistentDarknessGround(effect);
  });
  Hooks.on("canvasReady", () => {
    void add2eRestorePersistentDarknessGrounds();
  });
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
  if (/(arquebuse|arme_feu|arme_a_feu)/.test(text)) return { preset: "weapon_firearm", mode: "impact" };
  if (/(arbalete|carreau|bolt)/.test(text)) return { preset: "weapon_bolt", mode: "impact" };
  if (/(arc|fleche|flèche|sarbacane|aiguille|arrow)/.test(text)) return { preset: "weapon_arrow", mode: "impact" };
  if (/(fronde|balle|pierre|stone)/.test(text)) return { preset: "weapon_stone", mode: "impact" };
  if (/(filet|lasso|bolas|entrave|attrape_homme)/.test(text)) return { preset: "weapon_ensnare", mode: "impact" };
  if (/(fouet|martinet|whip)/.test(text)) return { preset: "weapon_whip", mode: "impact" };
  if (/(hache|bardiche|hallebarde|guisarme|voulge|arme_hast|axe)/.test(text)) return { preset: "weapon_cleave", mode: "impact" };
  if (/(baton|bâton|massue|masse|marteau|fleau|fléau|contond|bludgeon|mace|hammer)/.test(text)) return { preset: "weapon_bludgeon", mode: "impact" };
  if (/(dague|lance|pique|perfor|trident|stylet|javelot|fourche|pierce)/.test(text)) return { preset: "weapon_pierce", mode: "impact" };
  if (/(tranch|epee|épée|sabre|cimeterre|rapiere|rapière|slash|sword)/.test(text)) return { preset: "weapon_slash", mode: "impact" };
  return { preset: "weapon_default", mode: "impact" };
}

function add2eBuildWeaponFxDedupeKey({ actor, weapon, sourceToken, targetToken } = {}) {
  const src = add2eGetTokenLikeObject(sourceToken) ?? add2eGetActorToken(actor);
  const target = add2eGetTokenLikeObject(targetToken) ?? Array.from(game.user?.targets ?? [])[0] ?? null;
  return [
    game.user?.id ?? "user",
    actor?.id ?? actor?.name ?? "actor",
    weapon?.id ?? weapon?.name ?? "weapon",
    src?.id ?? src?.document?.id ?? "source",
    target?.id ?? target?.document?.id ?? target?.name ?? "target"
  ].join("|");
}

function add2eEnterWeaponFxDedupe(key) {
  const now = Date.now();
  const map = globalThis.__ADD2E_JB2A_WEAPON_FX_DEDUPE_KEYS;
  if (!(map instanceof Map)) return true;
  for (const [k, ts] of map.entries()) {
    if ((now - Number(ts || 0)) > ADD2E_JB2A_WEAPON_FX_DEDUPE_MS) map.delete(k);
  }
  if (map.has(key)) return false;
  map.set(key, now);
  return true;
}

async function add2ePlayWeaponAttackFx({ actor, weapon, sourceToken, targetToken } = {}) {
  try {
    if (typeof Sequence === "undefined" || !weapon) return false;
    const dedupeKey = add2eBuildWeaponFxDedupeKey({ actor, weapon, sourceToken, targetToken });
    if (!add2eEnterWeaponFxDedupe(dedupeKey)) {
      console.warn("[ADD2E][JB2A][WEAPON][SKIP_DUPLICATE]", { weapon: weapon?.name, weaponType: weapon?.type, dedupeKey });
      return false;
    }
    const explicit = add2eGetWeaponJb2aConfig(weapon);
    const inferred = add2eInferWeaponJb2aPreset(weapon);
    const preset = add2eNormalizeFxKey(explicit.preset || inferred.preset || "weapon_default") || "weapon_default";
    const files = await add2ePickJb2aFiles(preset, 1, explicit.file ?? explicit.files ?? []);
    if (!files.length) return false;
    const src = add2eGetTokenLikeObject(sourceToken) ?? add2eGetActorToken(actor);
    const target = add2eGetTokenLikeObject(targetToken) ?? Array.from(game.user?.targets ?? [])[0] ?? null;
    const point = add2eGetTokenLikeCenter(target) ?? add2eGetTokenLikeCenter(src);
    if (!src && !point) return false;
    const seq = new Sequence();
    const effect = seq.effect().file(files[0]);
    if (src && target) {
      effect.atLocation(src).stretchTo(target);
    } else if (target) {
      effect.atLocation(target);
      add2eCallEffectMethod(effect, "scaleToObject", 1.35);
    } else if (point) {
      effect.atLocation(point);
      add2eCallEffectMethod(effect, "scale", 1.35);
    } else {
      return false;
    }
    add2eCallEffectMethod(effect, "opacity", 1);
    add2eCallEffectMethod(effect, "aboveLighting");
    add2eCallEffectMethod(effect, "zIndex", 1000);
    add2eCallEffectMethod(effect, "fadeIn", 50);
    add2eCallEffectMethod(effect, "fadeOut", 100);
    await seq.play();
    console.log("[ADD2E][JB2A][WEAPON][PLAY]", { weapon: weapon?.name, weaponType: weapon?.type, preset, mode: "oriented", file: files[0], source: src?.name ?? src?.id ?? null, target: target?.name ?? target?.id ?? null });
    return true;
  } catch (e) {
    console.warn("[ADD2E][JB2A][WEAPON][ERROR] VFX d'arme ignoré pour ne pas bloquer l'attaque.", { weapon: weapon?.name, weaponType: weapon?.type, error: e });
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
    if (weapon && result !== false) await add2ePlayWeaponAttackFx({ actor, weapon, sourceToken, targetToken: payload.targetToken ?? targetTokenBeforeRoll ?? Array.from(game.user?.targets ?? [])[0] ?? null });
    else if (!weapon) console.warn("[ADD2E][JB2A][WEAPON][SKIP_NO_WEAPON]", { actor: actor?.name, actorId: actor?.id, payloadKeys: Object.keys(payload ?? {}) });
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
globalThis.ADD2E_PLAY_PERSISTENT_DARKNESS_GROUND = add2ePlayPersistentDarknessGround;
globalThis.ADD2E_END_PERSISTENT_GROUND_FX = add2eEndPersistentGroundFx;
globalThis.ADD2E_JB2A_PRESET_CANDIDATES = ADD2E_JB2A_PRESET_CANDIDATES;
globalThis.ADD2E_SPELL_KEY_TO_JB2A_PRESET = ADD2E_SPELL_KEY_TO_JB2A_PRESET;
add2eInstallPersistentDarknessGroundHooks();
add2eScheduleWeaponAttackPatch();

Hooks.once("ready", () => {
  globalThis.ADD2E_PLAY_SPELL_FX = add2ePlayCentralSpellFx;
  globalThis.ADD2E_PLAY_WEAPON_FX = add2ePlayWeaponAttackFx;
  globalThis.ADD2E_PLAY_PERSISTENT_DARKNESS_GROUND = add2ePlayPersistentDarknessGround;
  globalThis.ADD2E_END_PERSISTENT_GROUND_FX = add2eEndPersistentGroundFx;
  globalThis.ADD2E_JB2A_PRESET_CANDIDATES = ADD2E_JB2A_PRESET_CANDIDATES;
  globalThis.ADD2E_SPELL_KEY_TO_JB2A_PRESET = ADD2E_SPELL_KEY_TO_JB2A_PRESET;
  add2eInstallPersistentDarknessGroundHooks();
  add2eScheduleWeaponAttackPatch();
  console.log("[ADD2E][JB2A][VERSION]", globalThis.ADD2E_JB2A_VFX_VERSION);
});
