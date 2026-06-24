// ============================================================
// ADD2E — Capacités activables de classe : exécution on_use
// Version : 2026-06-24-active-class-abilities-thief-final-resolver-v7
// Format accepté pour les objets classe :
// - system.activeClassFeatures : boutons / capacités utilisables
// - system.classFeatures       : capacités passives ou mixtes
// - system.passiveClassFeatures: capacités passives
// - anciens alias conservés : capacitesClasse, classFeaturesDebloquees
// ============================================================

const ADD2E_CLASS_ACTIVE_ABILITIES_VERSION = "2026-06-24-active-class-abilities-thief-final-resolver-v7";
globalThis.ADD2E_CLASS_ACTIVE_ABILITIES_VERSION = ADD2E_CLASS_ACTIVE_ABILITIES_VERSION;
console.log("[ADD2E][CAPACITES][VERSION]", ADD2E_CLASS_ACTIVE_ABILITIES_VERSION);

function add2eToClassFeatureArray(value) {
  if (Array.isArray(value)) return value.filter(v => v && typeof v === "object");
  if (value && typeof value === "object") return Object.values(value).filter(v => v && typeof v === "object");
  return [];
}

function add2eFeatureMinLevel(feature) {
  return Number(feature?.minLevel ?? feature?.minimumLevel ?? feature?.niveauMin ?? feature?.level ?? feature?.niveau ?? 1) || 1;
}

function add2eFeatureMaxLevel(feature) {
  const raw = feature?.maxLevel ?? feature?.maximumLevel ?? feature?.niveauMax ?? feature?.max;
  if (raw === undefined || raw === null || raw === "") return 999;
  return Number(raw) || 999;
}

function add2eFeatureName(feature) {
  return String(feature?.name ?? feature?.label ?? feature?.title ?? feature?.nom ?? "").trim();
}

function add2eFeatureOnUse(feature) {
  return String(feature?.on_use ?? feature?.onUse ?? feature?.script ?? feature?.macro ?? "").trim();
}

function add2eFeatureKey(feature) {
  const raw = feature?.id ?? feature?._id ?? feature?.key ?? feature?.slug ?? feature?.skillKey ?? feature?.name ?? feature?.label ?? feature?.title ?? feature?.nom ?? "";
  if (typeof add2eNormalizeEquipTag === "function") return add2eNormalizeEquipTag(raw);
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[_\s-]+/g, "_");
}

function add2eClassSlugFromSystem(system, name = "") {
  return add2eFeatureKey({ id: system?.slug ?? system?.label ?? system?.nom ?? system?.name ?? name });
}

function add2eClassLevelForSlug(actor, slug, fallback = 1) {
  const key = add2eFeatureKey({ id: slug });
  const map = actor?.system?.niveaux_par_classe ?? {};
  if (key && map[key] !== undefined) return Math.max(1, Number(map[key]) || 1);
  return Math.max(1, Number(fallback ?? actor?.system?.niveau ?? 1) || 1);
}

function add2eClassSystemEntry(system, { name = "", slug = "", level = 1, itemId = null } = {}) {
  if (!system || typeof system !== "object") return null;
  return {
    ...system,
    _add2eClassSlug: slug || add2eClassSlugFromSystem(system, name),
    _add2eClassName: name || system.label || system.nom || system.name || "Classe",
    _add2eClassLevel: Math.max(1, Number(level) || 1),
    _add2eClassItemId: itemId
  };
}

function add2ePushClassFeatures(out, value, source = "unknown", classSystem = null) {
  for (const feature of add2eToClassFeatureArray(value)) {
    out.push({
      ...feature,
      _add2eFeatureSource: feature?._add2eFeatureSource ?? source,
      _add2eClassSlug: feature?._add2eClassSlug ?? classSystem?._add2eClassSlug ?? null,
      _add2eClassName: feature?._add2eClassName ?? classSystem?._add2eClassName ?? null,
      _add2eClassLevel: feature?._add2eClassLevel ?? classSystem?._add2eClassLevel ?? null
    });
  }
}

function add2eGetActorClassSystems(actor) {
  const sys = actor?.system ?? {};
  const classItems = actor?.items?.filter?.(i => String(i?.type || "").toLowerCase() === "classe") ?? [];

  // Les objets classe embarqués sont la source de vérité, en mono comme en multiclassage.
  // Cela exclut les reliquats de details_classe après un remplacement de classe.
  if (classItems.length) {
    return classItems.map(item => {
      const slug = add2eClassSlugFromSystem(item.system ?? {}, item.name);
      return add2eClassSystemEntry(item.system ?? {}, {
        name: item.name,
        slug,
        level: add2eClassLevelForSlug(actor, slug, item.system?.niveau ?? item.system?.level ?? sys.niveau ?? 1),
        itemId: item.id
      });
    }).filter(Boolean);
  }

  const details = sys.details_classe && typeof sys.details_classe === "object" ? sys.details_classe : null;
  const monoLevel = Number(sys.niveau ?? 1) || 1;

  // Secours pour les acteurs anciens qui ne possèdent pas encore d'objet classe.
  if (details) {
    return [add2eClassSystemEntry(details, {
      name: details?.label ?? details?.name ?? sys.classe ?? "Classe",
      slug: add2eClassSlugFromSystem(details, sys.classe),
      level: monoLevel
    })].filter(Boolean);
  }

  return [add2eClassSystemEntry(sys, {
    name: sys.classe ?? "Acteur",
    slug: add2eClassSlugFromSystem(sys, sys.classe),
    level: monoLevel
  })].filter(Boolean);
}

function add2eGetActorClassFeatures(actor) {
  const features = [];
  const seen = new Set();

  for (const system of add2eGetActorClassSystems(actor)) {
    add2ePushClassFeatures(features, system.activeClassFeatures, "activeClassFeatures", system);
    add2ePushClassFeatures(features, system.activableClassFeatures, "activableClassFeatures", system);
    add2ePushClassFeatures(features, system.classFeaturesActives, "classFeaturesActives", system);
    add2ePushClassFeatures(features, system.capacitesActives, "capacitesActives", system);
    add2ePushClassFeatures(features, system.capacitesActivables, "capacitesActivables", system);
    add2ePushClassFeatures(features, system.classFeatures, "classFeatures", system);
    add2ePushClassFeatures(features, system.classFeaturesDebloquees, "classFeaturesDebloquees", system);
    add2ePushClassFeatures(features, system.capacitesClasse, "capacitesClasse", system);
    add2ePushClassFeatures(features, system.passiveClassFeatures, "passiveClassFeatures", system);
    add2ePushClassFeatures(features, system.passiveFeatures, "passiveFeatures", system);
    add2ePushClassFeatures(features, system.capacitesPassives, "capacitesPassives", system);
  }

  return features.filter(feature => {
    const key = add2eFeatureKey(feature);
    const onUse = add2eFeatureOnUse(feature);
    const source = String(feature?._add2eFeatureSource ?? "");
    const classSlug = String(feature?._add2eClassSlug ?? "");
    const unique = `${classSlug}|${key}|${onUse}|${source}`;
    if (!key && !onUse) return false;
    if (seen.has(unique)) return false;
    seen.add(unique);
    return true;
  });
}

function add2eIsFeatureActivable(feature) {
  if (!feature || typeof feature !== "object") return false;
  if (feature.activable === true) return true;
  if (feature.active === true && feature.passive !== true) return true;
  if (feature.usageType === "classFeature" && add2eFeatureOnUse(feature)) return true;
  if (String(feature?._add2eFeatureSource ?? "") === "activeClassFeatures") return true;
  return false;
}

function add2eIsThiefClassFeature(feature) {
  const values = [
    feature?._add2eClassSlug,
    feature?._add2eClassName,
    feature?.sourceClassSlug,
    feature?.sourceClassName,
    feature?.classSlug,
    feature?.className,
    feature?.classe,
    feature?.class
  ].map(value => add2eFeatureKey({ id: value })).filter(Boolean);

  return values.some(value => value === "voleur" || value.startsWith("voleur_") || value.endsWith("_voleur") || value.includes("voleur"));
}

function add2eIsThiefSkillFeature(feature) {
  const name = add2eFeatureKey({ name: add2eFeatureName(feature) });
  const key = add2eFeatureKey({ id: feature?.skillKey ?? feature?.key ?? feature?.slug ?? "" });
  const joined = `${name} ${key}`;
  return [
    "faculte_de_voleur", "facultes_de_voleur", "competence_de_voleur", "competences_de_voleur",
    "pickpocket", "faire_les_poches", "crochetage", "serrure", "piege", "desamorc",
    "deplacement_silencieux", "silence", "dissimulation", "cacher", "ecoute", "auditiv",
    "ouie", "entendre", "bruit", "escalade", "grimper", "lecture_langues",
    "lecture_des_langues", "frappe_dans_le_dos", "attaque_dans_le_dos", "backstab",
    "attaque_sournoise", "assassination", "assassinat"
  ].some(token => joined.includes(token));
}

function add2eThiefActivityStatus(actor) {
  try {
    const status = globalThis.add2eGetThiefActivityEquipmentStatus?.(actor);
    if (status && typeof status === "object") return status;
  } catch (err) {
    console.warn("[ADD2E][CAPACITES][VOLEUR][ACTIVITE]", err);
  }
  return { applies: false, ok: true, message: "" };
}

function add2eFeatureActorLevel(actor, feature = null) {
  const slug = add2eFeatureKey({ id: feature?._add2eClassSlug ?? feature?.classSlug ?? feature?.sourceClassSlug ?? "" });
  if (slug && actor?.system?.niveaux_par_classe?.[slug] !== undefined) return Math.max(1, Number(actor.system.niveaux_par_classe[slug]) || 1);
  return Math.max(1, Number(feature?._add2eClassLevel ?? actor?.system?.niveau ?? 1) || 1);
}

function add2eGetActorActivableClassFeatures(actor, { includeLocked = true } = {}) {
  const thiefStatus = add2eThiefActivityStatus(actor);
  return add2eGetActorClassFeatures(actor).filter(f => {
    if (!add2eIsFeatureActivable(f)) return false;
    // Le panneau rouge remplace complètement le bloc provenant de la classe Voleur.
    // Les capacités des autres classes, telles que Vade-rétro, restent disponibles.
    if (thiefStatus.applies && thiefStatus.ok === false && add2eIsThiefClassFeature(f)) return false;
    // Les compétences Voleur standard sont rendues séparément par le HUD et la feuille.
    if (thiefStatus.applies && add2eIsThiefSkillFeature(f)) return false;
    if (includeLocked) return true;
    const level = add2eFeatureActorLevel(actor, f);
    return level >= add2eFeatureMinLevel(f) && level <= add2eFeatureMaxLevel(f);
  });
}

function add2eGetActorPassiveClassFeatures(actor, { includeLocked = true } = {}) {
  const thiefStatus = add2eThiefActivityStatus(actor);
  return add2eGetActorClassFeatures(actor).filter(f => {
    if (add2eIsFeatureActivable(f)) return false;
    if (thiefStatus.applies && thiefStatus.ok === false && add2eIsThiefClassFeature(f)) return false;
    if (includeLocked) return true;
    const level = add2eFeatureActorLevel(actor, f);
    return level >= add2eFeatureMinLevel(f) && level <= add2eFeatureMaxLevel(f);
  });
}

function add2eDatasetValue(dataset, keys) {
  if (!dataset) return undefined;
  for (const k of keys) if (dataset[k] !== undefined && dataset[k] !== null && String(dataset[k]).trim() !== "") return dataset[k];
  return undefined;
}

function add2eFindClassFeatureFromElement(actor, element) {
  const allFeatures = add2eGetActorClassFeatures(actor);
  const activeFeatures = add2eGetActorActivableClassFeatures(actor);
  const el = element instanceof HTMLElement ? element : element?.[0];
  if (!el) return null;

  const holder = el.closest?.("[data-feature-index], [data-feature-name], [data-feature-id], [data-feature-key], [data-on-use], [data-skill-key]") ?? el;
  const ds = holder?.dataset ?? el?.dataset ?? {};

  const rawIndex = add2eDatasetValue(ds, ["featureIndex", "index", "idx"]);
  if (rawIndex !== undefined) {
    const idx = Number(rawIndex);
    if (Number.isInteger(idx)) {
      const byOriginalIndex = allFeatures[idx];
      if (add2eIsFeatureActivable(byOriginalIndex)) return byOriginalIndex;
      const byActiveIndex = activeFeatures[idx];
      if (byActiveIndex) return byActiveIndex;
    }
  }

  const rawOnUse = add2eDatasetValue(ds, ["onUse", "onuse", "on_use"]);
  if (rawOnUse !== undefined) {
    const wanted = String(rawOnUse).trim();
    const byScript = activeFeatures.find(f => add2eFeatureOnUse(f) === wanted);
    if (byScript) return byScript;
  }

  const rawSkillKey = add2eDatasetValue(ds, ["skillKey", "skill", "competence", "competenceKey"]);
  if (rawSkillKey !== undefined) {
    const wanted = typeof add2eNormalizeThiefSkillKey === "function" ? add2eNormalizeThiefSkillKey(rawSkillKey) : add2eFeatureKey({ skillKey: rawSkillKey });
    const bySkill = activeFeatures.find(f => {
      const skill = typeof add2eNormalizeThiefSkillKey === "function" ? add2eNormalizeThiefSkillKey(f.skillKey ?? f.key ?? f.slug ?? f.name) : add2eFeatureKey({ skillKey: f.skillKey ?? f.key ?? f.slug ?? f.name });
      return skill === wanted;
    });
    if (bySkill) return bySkill;
  }

  const rawId = add2eDatasetValue(ds, ["featureId", "featureKey", "id", "key"]);
  if (rawId !== undefined) {
    const wanted = add2eFeatureKey({ id: rawId });
    const byId = activeFeatures.find(f => [f.id, f._id, f.key, f.slug, f.skillKey, f.name, f.label, f.title, f.nom].map(v => add2eFeatureKey({ id: v })).filter(Boolean).includes(wanted));
    if (byId) return byId;
  }

  const rawName = add2eDatasetValue(ds, ["featureName", "name", "feature", "nom"]);
  if (rawName !== undefined) {
    const wanted = add2eFeatureKey({ name: rawName });
    const byName = activeFeatures.find(f => add2eFeatureKey({ name: add2eFeatureName(f) }) === wanted);
    if (byName) return byName;
  }

  let cursor = el;
  for (let depth = 0; cursor && depth < 8; depth++, cursor = cursor.parentElement) {
    const text = add2eFeatureKey({ name: cursor.textContent ?? "" });
    if (!text || text === "utiliser") continue;
    const matches = activeFeatures.filter(f => {
      const n = add2eFeatureKey({ name: add2eFeatureName(f) });
      return n && text.includes(n);
    });
    if (matches.length === 1) return matches[0];
  }

  if (activeFeatures.length === 1) return activeFeatures[0];
  return null;
}

async function add2eExecuteClassFeatureOnUse(actor, feature, sheet = null) {
  if (!actor) {
    ui.notifications.error("Capacité de classe : acteur introuvable.");
    return false;
  }
  if (!feature) {
    ui.notifications.error("Capacité de classe introuvable dans les données de l'acteur.");
    return false;
  }

  const level = add2eFeatureActorLevel(actor, feature);
  const min = add2eFeatureMinLevel(feature);
  const max = add2eFeatureMaxLevel(feature);
  const name = add2eFeatureName(feature) || "Capacité";

  if (level < min || level > max) {
    ui.notifications.warn(`La capacité « ${name} » n'est pas disponible au niveau ${level}.`);
    return false;
  }

  // Compatibilité avec les anciennes entrées classe : une compétence de voleur
  // est toujours résolue par le moteur de compétence, jamais par fetch(on_use).
  if (add2eIsThiefSkillFeature(feature)) {
    const thiefStatus = add2eThiefActivityStatus(actor);
    if (thiefStatus.applies && !thiefStatus.ok) {
      ui.notifications.warn(thiefStatus.message || "Les capacités de voleur sont indisponibles avec l'équipement actuellement porté.");
      return false;
    }
    if (thiefStatus.applies) {
      if (typeof globalThis.add2eRollThiefSkill !== "function") {
        ui.notifications.error("Le moteur des compétences de voleur n'est pas chargé.");
        return false;
      }
      const skillKey = feature?.skillKey ?? feature?.key ?? feature?.slug ?? feature?.name ?? name;
      return (await globalThis.add2eRollThiefSkill(actor, skillKey)) !== false;
    }
  }

  const onUse = add2eFeatureOnUse(feature);
  if (!onUse) {
    ui.notifications.warn(`La capacité « ${name} » n'a pas de script on_use.`);
    return false;
  }

  try {
    const url = onUse.includes("?") ? `${onUse}&cb=${Date.now()}` : `${onUse}?cb=${Date.now()}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const code = await response.text();
    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
    const runner = new AsyncFunction("actor", "feature", "item", "sort", "game", "ui", "ChatMessage", "Roll", "foundry", "canvas", code);
    const result = await runner(actor, feature, feature, null, game, ui, ChatMessage, Roll, foundry, canvas);
    sheet?._add2eRememberActiveTab?.();
    sheet?.render?.(false);
    return result !== false;
  } catch (err) {
    console.error("[ADD2E][CAPACITE][ON_USE][ERREUR]", { actor: actor.name, feature: name, onUse, err });
    ui.notifications.error(`Erreur pendant l'utilisation de « ${name} » : ${err.message}`);
    return false;
  }
}

async function add2eUseClassFeatureFromElement(actor, element, sheet = null) {
  const feature = add2eFindClassFeatureFromElement(actor, element);
  return add2eExecuteClassFeatureOnUse(actor, feature, sheet);
}

const ADD2E_THIEF_SKILL_ROWS = [
  ["pickpocket", "Pickpocket"],
  ["crochetage_serrures", "Crochetage / ouverture des serrures"],
  ["detection_pieges", "Détection / désamorçage des pièges"],
  ["deplacement_silencieux", "Déplacement silencieux"],
  ["dissimulation", "Dissimulation"],
  ["ecoute", "Écoute"],
  ["escalade", "Escalade"],
  ["lecture_langues", "Lecture des langues"]
];

const ADD2E_THIEF_SKILL_ALIASES = {
  pick_pockets: "pickpocket", pick_pocket: "pickpocket", pickpockets: "pickpocket", pickpocket: "pickpocket",
  open_locks: "crochetage_serrures", open_lock: "crochetage_serrures", crochetage: "crochetage_serrures", crochetage_serrures: "crochetage_serrures", ouverture_serrures: "crochetage_serrures", ouverture_de_serrures: "crochetage_serrures",
  find_remove_traps: "detection_pieges", find_traps: "detection_pieges", remove_traps: "detection_pieges", detect_traps: "detection_pieges", detection_pieges: "detection_pieges", detection_de_pieges: "detection_de_pieges", desamorcage_pieges: "detection_pieges",
  move_silently: "deplacement_silencieux", deplacement_silencieux: "deplacement_silencieux",
  hide_in_shadows: "dissimulation", dissimulation: "dissimulation", dissimulation_dans_l_ombre: "dissimulation", dissimulation_dans_lombre: "dissimulation",
  hear_noise: "ecoute", hear_noises: "ecoute", listen: "ecoute", detect_noise: "ecoute", ecoute: "ecoute",
  climb_walls: "escalade", climb_wall: "escalade", escalade: "escalade",
  read_languages: "lecture_langues", read_language: "lecture_langues", lecture_langues: "lecture_langues", lecture_des_langues: "lecture_langues"
};

function add2eNormalizeThiefSkillKeyLocal(value) {
  if (typeof globalThis.add2eNormalizeThiefSkillKey === "function") return globalThis.add2eNormalizeThiefSkillKey(value);
  const raw = String(value ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, "").replace(/[_\s-]+/g, "_");
  return ADD2E_THIEF_SKILL_ALIASES[raw] ?? raw;
}

function add2eGetActorClassProgression(actor, classSlug = null) {
  const wanted = add2eFeatureKey({ id: classSlug ?? "" });
  const systems = add2eGetActorClassSystems(actor);
  const ordered = wanted
    ? systems.filter(s => s._add2eClassSlug === wanted || add2eFeatureKey({ id: s._add2eClassName }) === wanted)
      .concat(systems.filter(s => s._add2eClassSlug !== wanted && add2eFeatureKey({ id: s._add2eClassName }) !== wanted))
    : systems;

  for (const system of ordered) {
    const level = add2eClassLevelForSlug(actor, system._add2eClassSlug, system._add2eClassLevel ?? actor?.system?.niveau ?? 1);
    const progression = system?.progression;
    if (!Array.isArray(progression)) continue;
    const byLevel = progression.find(p => Number(p?.level ?? p?.niveau ?? 0) === level);
    if (byLevel) return byLevel;
    if (progression[level - 1]) return progression[level - 1];
  }
  return null;
}

function add2eIsThiefClassSystem(system) {
  const values = [
    system?._add2eClassSlug,
    system?._add2eClassName,
    system?.slug,
    system?.label,
    system?.nom,
    system?.name,
    ...(Array.isArray(system?.tags) ? system.tags : []),
    ...(Array.isArray(system?.effectTags) ? system.effectTags : [])
  ].map(v => add2eFeatureKey({ id: v })).filter(Boolean);
  return values.some(v => v === "voleur" || v.includes("voleur"));
}

function add2eGetActorThiefProgression(actor) {
  const thiefSystem = add2eGetActorClassSystems(actor).find(add2eIsThiefClassSystem);
  if (!thiefSystem) return add2eGetActorClassProgression(actor, "voleur");
  return add2eGetActorClassProgression(actor, thiefSystem._add2eClassSlug || "voleur");
}

function add2eGetActorThiefSkillTable(actor) {
  const progression = add2eGetActorThiefProgression(actor);
  const raw = progression?.thiefSkills ?? progression?.voleurSkills ?? progression?.competencesVoleur ?? null;
  const output = {};

  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const [key, value] of Object.entries(raw)) output[add2eNormalizeThiefSkillKeyLocal(key)] = Number(value ?? 0) || 0;
  }

  if (!Object.keys(output).length && Array.isArray(progression?.skills)) {
    const keys = ADD2E_THIEF_SKILL_ROWS.map(([key]) => key);
    for (let i = 0; i < keys.length; i++) output[keys[i]] = Number(progression.skills[i] ?? 0) || 0;
  }

  if (!Object.keys(output).length) return [];
  return ADD2E_THIEF_SKILL_ROWS.map(([key, label]) => ({ key, label, value: Number(output[key] ?? 0) || 0 }));
}

function add2eInstallClassAbilityListeners() {
  if (globalThis.ADD2E_CLASS_ABILITY_LISTENERS_INSTALLED) return;
  globalThis.ADD2E_CLASS_ABILITY_LISTENERS_INSTALLED = true;
  document.addEventListener("click", async event => {
    const thiefButton = event.target.closest?.(".add2e-thief-skill-roll[data-skill-key]");
    if (!thiefButton) return;
    event.preventDefault();
    event.stopPropagation();
    const sheetRoot = thiefButton.closest(".add2e-character-v3");
    const appEl = sheetRoot?.closest?.(".application, .app, .window-app");
    const appId = appEl?.dataset?.appid || appEl?.id?.replace(/^app-/, "");
    const app = Object.values(ui.windows ?? {}).find(w => String(w.appId) === String(appId) || String(w.id) === String(appId));
    const actor = app?.actor ?? canvas?.tokens?.controlled?.[0]?.actor ?? game.user?.character ?? null;
    const skillKey = add2eNormalizeThiefSkillKeyLocal(thiefButton.dataset.skillKey);
    if (!actor) return ui.notifications.error("Acteur introuvable pour le jet de compétence de voleur.");
    if (typeof globalThis.add2eRollThiefSkill !== "function") return ui.notifications.error("Le moteur de jet des compétences de voleur n'est pas chargé.");
    await globalThis.add2eRollThiefSkill(actor, skillKey);
  }, true);
}

if (game?.ready) add2eInstallClassAbilityListeners();
else Hooks.once("ready", add2eInstallClassAbilityListeners);

globalThis.add2eGetActorClassFeatures = add2eGetActorClassFeatures;
globalThis.add2eGetActorActivableClassFeatures = add2eGetActorActivableClassFeatures;
globalThis.add2eGetActorPassiveClassFeatures = add2eGetActorPassiveClassFeatures;
globalThis.add2eUseClassFeatureFromElement = add2eUseClassFeatureFromElement;
globalThis.add2eExecuteClassFeatureOnUse = add2eExecuteClassFeatureOnUse;
try { globalThis.add2eToClassFeatureArray = add2eToClassFeatureArray; } catch (_e) {}
try { globalThis.add2eFeatureMinLevel = add2eFeatureMinLevel; } catch (_e) {}
try { globalThis.add2eFeatureMaxLevel = add2eFeatureMaxLevel; } catch (_e) {}
try { globalThis.add2eFeatureName = add2eFeatureName; } catch (_e) {}
try { globalThis.add2eFeatureOnUse = add2eFeatureOnUse; } catch (_e) {}
try { globalThis.add2eFeatureKey = add2eFeatureKey; } catch (_e) {}
try { globalThis.add2eIsFeatureActivable = add2eIsFeatureActivable; } catch (_e) {}
try { globalThis.add2eIsThiefClassFeature = add2eIsThiefClassFeature; } catch (_e) {}
try { globalThis.add2eIsThiefSkillFeature = add2eIsThiefSkillFeature; } catch (_e) {}
try { globalThis.add2eFeatureActorLevel = add2eFeatureActorLevel; } catch (_e) {}
try { globalThis.add2eGetActorClassSystems = add2eGetActorClassSystems; } catch (_e) {}
try { globalThis.add2eFindClassFeatureFromElement = add2eFindClassFeatureFromElement; } catch (_e) {}
try { globalThis.add2eGetActorClassProgression = add2eGetActorClassProgression; } catch (_e) {}
try { globalThis.add2eGetActorThiefSkillTable = add2eGetActorThiefSkillTable; } catch (_e) {}
try { globalThis.ADD2E_CLASS_ACTIVE_ABILITIES_VERSION = ADD2E_CLASS_ACTIVE_ABILITIES_VERSION; } catch (_e) {}

function add2eFilterBlockedThiefClassFeatures(actor, features) {
  const list = Array.isArray(features) ? features : [];
  const status = add2eThiefActivityStatus(actor);
  if (!status?.applies || status.ok !== false) return list;
  return list.filter(feature => !add2eIsThiefClassFeature(feature));
}

function add2eInstallThiefActivityFeatureResolverGuard() {
  const install = () => {
    const resolver = globalThis.add2eGetActorActivableClassFeatures;
    if (typeof resolver !== "function" || resolver.__add2eThiefActivityFeatureResolverGuard === true) return;

    const guarded = function add2eGetActorActivableClassFeaturesWithThiefEquipmentGuard(actor, options = {}) {
      const result = resolver.call(this, actor, options);
      const filter = features => add2eFilterBlockedThiefClassFeatures(actor, features);
      return typeof result?.then === "function" ? result.then(filter) : filter(result);
    };

    guarded.__add2eThiefActivityFeatureResolverGuard = true;
    guarded.__add2eThiefActivityFeatureResolverOriginal = resolver;
    globalThis.add2eGetActorActivableClassFeatures = guarded;
  };

  const deferInstall = () => setTimeout(install, 0);
  if (game?.ready) deferInstall();
  else Hooks.once("ready", deferInstall);
}

add2eInstallThiefActivityFeatureResolverGuard();
try { globalThis.add2eFilterBlockedThiefClassFeatures = add2eFilterBlockedThiefClassFeatures; } catch (_e) {}