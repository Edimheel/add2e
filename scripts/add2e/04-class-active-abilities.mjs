// ============================================================
// ADD2E — Capacités activables de classe : exécution on_use
// Les Items classe sont la seule source de niveau.
// ============================================================

const ADD2E_CLASS_ACTIVE_ABILITIES_VERSION = "2026-06-25-active-class-abilities-item-level-v8";
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

function add2eClassItemLevel(item, fallback = null) {
  const value = Number(item?.system?.niveau ?? item?.system?.level);
  if (Number.isFinite(value) && value >= 1) return Math.floor(value);
  const defaultValue = Number(fallback);
  return Number.isFinite(defaultValue) && defaultValue >= 1 ? Math.floor(defaultValue) : null;
}

function add2eClassSystemEntry(system, { name = "", slug = "", level = null, itemId = null } = {}) {
  if (!system || typeof system !== "object" || !Number.isInteger(level) || level < 1) return null;
  return {
    ...system,
    _add2eClassSlug: slug || add2eClassSlugFromSystem(system, name),
    _add2eClassName: name || system.label || system.nom || system.name || "Classe",
    _add2eClassLevel: level,
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
      _add2eClassLevel: feature?._add2eClassLevel ?? classSystem?._add2eClassLevel ?? null,
      _add2eClassItemId: feature?._add2eClassItemId ?? classSystem?._add2eClassItemId ?? null
    });
  }
}

function add2eGetActorClassSystems(actor) {
  const classDocs = Array.from(actor?.items ?? []).filter(item => String(item?.type ?? "").toLowerCase() === "classe");
  return classDocs.map(item => {
    const level = add2eClassItemLevel(item);
    if (level === null) return null;
    return add2eClassSystemEntry(item.system ?? {}, {
      name: item.name,
      slug: add2eClassSlugFromSystem(item.system ?? {}, item.name),
      level,
      itemId: item.id
    });
  }).filter(Boolean);
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
    const classId = String(feature?._add2eClassItemId ?? feature?._add2eClassSlug ?? "");
    const unique = `${classId}|${key}|${onUse}|${source}`;
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

function add2eFeatureActorLevel(_actor, feature = null) {
  const level = Number(feature?._add2eClassLevel);
  return Number.isFinite(level) && level >= 1 ? Math.floor(level) : null;
}

function add2eGetActorActivableClassFeatures(actor, { includeLocked = true } = {}) {
  const thiefStatus = add2eThiefActivityStatus(actor);
  return add2eGetActorClassFeatures(actor).filter(feature => {
    if (!add2eIsFeatureActivable(feature)) return false;
    if (thiefStatus.applies && thiefStatus.ok === false && add2eIsThiefClassFeature(feature)) return false;
    if (thiefStatus.applies && add2eIsThiefSkillFeature(feature)) return false;
    if (includeLocked) return true;
    const level = add2eFeatureActorLevel(actor, feature);
    return level !== null && level >= add2eFeatureMinLevel(feature) && level <= add2eFeatureMaxLevel(feature);
  });
}

function add2eGetActorPassiveClassFeatures(actor, { includeLocked = true } = {}) {
  const thiefStatus = add2eThiefActivityStatus(actor);
  return add2eGetActorClassFeatures(actor).filter(feature => {
    if (add2eIsFeatureActivable(feature)) return false;
    if (thiefStatus.applies && thiefStatus.ok === false && add2eIsThiefClassFeature(feature)) return false;
    if (includeLocked) return true;
    const level = add2eFeatureActorLevel(actor, feature);
    return level !== null && level >= add2eFeatureMinLevel(feature) && level <= add2eFeatureMaxLevel(feature);
  });
}

function add2eDatasetValue(dataset, keys) {
  if (!dataset) return undefined;
  for (const key of keys) if (dataset[key] !== undefined && dataset[key] !== null && String(dataset[key]).trim() !== "") return dataset[key];
  return undefined;
}

function add2eFindClassFeatureFromElement(actor, element) {
  const allFeatures = add2eGetActorClassFeatures(actor);
  const activeFeatures = add2eGetActorActivableClassFeatures(actor);
  const el = element instanceof HTMLElement ? element : element?.[0];
  if (!el) return null;

  const holder = el.closest?.("[data-feature-index], [data-feature-name], [data-feature-id], [data-feature-key], [data-on-use], [data-skill-key]") ?? el;
  const dataset = holder?.dataset ?? el?.dataset ?? {};

  const rawIndex = add2eDatasetValue(dataset, ["featureIndex", "index", "idx"]);
  if (rawIndex !== undefined) {
    const index = Number(rawIndex);
    if (Number.isInteger(index)) {
      const byOriginalIndex = allFeatures[index];
      if (add2eIsFeatureActivable(byOriginalIndex)) return byOriginalIndex;
      const byActiveIndex = activeFeatures[index];
      if (byActiveIndex) return byActiveIndex;
    }
  }

  const rawOnUse = add2eDatasetValue(dataset, ["onUse", "onuse", "on_use"]);
  if (rawOnUse !== undefined) {
    const wanted = String(rawOnUse).trim();
    const byScript = activeFeatures.find(feature => add2eFeatureOnUse(feature) === wanted);
    if (byScript) return byScript;
  }

  const rawSkillKey = add2eDatasetValue(dataset, ["skillKey", "skill", "competence", "competenceKey"]);
  if (rawSkillKey !== undefined) {
    const wanted = typeof add2eNormalizeThiefSkillKey === "function" ? add2eNormalizeThiefSkillKey(rawSkillKey) : add2eFeatureKey({ skillKey: rawSkillKey });
    const bySkill = activeFeatures.find(feature => {
      const skill = typeof add2eNormalizeThiefSkillKey === "function"
        ? add2eNormalizeThiefSkillKey(feature.skillKey ?? feature.key ?? feature.slug ?? feature.name)
        : add2eFeatureKey({ skillKey: feature.skillKey ?? feature.key ?? feature.slug ?? feature.name });
      return skill === wanted;
    });
    if (bySkill) return bySkill;
  }

  const rawId = add2eDatasetValue(dataset, ["featureId", "featureKey", "id", "key"]);
  if (rawId !== undefined) {
    const wanted = add2eFeatureKey({ id: rawId });
    const byId = activeFeatures.find(feature => [feature.id, feature._id, feature.key, feature.slug, feature.skillKey, feature.name, feature.label, feature.title, feature.nom]
      .map(value => add2eFeatureKey({ id: value })).filter(Boolean).includes(wanted));
    if (byId) return byId;
  }

  const rawName = add2eDatasetValue(dataset, ["featureName", "name", "feature", "nom"]);
  if (rawName !== undefined) {
    const wanted = add2eFeatureKey({ name: rawName });
    const byName = activeFeatures.find(feature => add2eFeatureKey({ name: add2eFeatureName(feature) }) === wanted);
    if (byName) return byName;
  }

  let cursor = el;
  for (let depth = 0; cursor && depth < 8; depth += 1, cursor = cursor.parentElement) {
    const text = add2eFeatureKey({ name: cursor.textContent ?? "" });
    if (!text || text === "utiliser") continue;
    const matches = activeFeatures.filter(feature => {
      const name = add2eFeatureKey({ name: add2eFeatureName(feature) });
      return name && text.includes(name);
    });
    if (matches.length === 1) return matches[0];
  }

  return activeFeatures.length === 1 ? activeFeatures[0] : null;
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

  if (level === null || level < min || level > max) {
    ui.notifications.warn(`La capacité « ${name} » n'est pas disponible pour sa classe à son niveau actuel.`);
    return false;
  }

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
    const AsyncFunction = Object.getPrototypeOf(async function() {}).constructor;
    const runner = new AsyncFunction("actor", "feature", "item", "sort", "game", "ui", "ChatMessage", "Roll", "foundry", "canvas", code);
    const result = await runner(actor, feature, feature, null, game, ui, ChatMessage, Roll, foundry, canvas);
    sheet?._add2eRememberActiveTab?.();
    sheet?.render?.(false);
    return result !== false;
  } catch (error) {
    console.error("[ADD2E][CAPACITE][ON_USE][ERREUR]", { actor: actor.name, feature: name, onUse, error });
    ui.notifications.error(`Erreur pendant l'utilisation de « ${name} » : ${error.message}`);
    return false;
  }
}

async function add2eUseClassFeatureFromElement(actor, element, sheet = null) {
  return add2eExecuteClassFeatureOnUse(actor, add2eFindClassFeatureFromElement(actor, element), sheet);
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
  find_remove_traps: "detection_pieges", find_traps: "detection_pieges", remove_traps: "detection_pieges", detect_traps: "detection_pieges", detection_pieges: "detection_pieges", detection_de_pieges: "detection_pieges", desamorcage_pieges: "detection_pieges",
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
    ? systems.filter(system => system._add2eClassSlug === wanted || add2eFeatureKey({ id: system._add2eClassName }) === wanted)
      .concat(systems.filter(system => system._add2eClassSlug !== wanted && add2eFeatureKey({ id: system._add2eClassName }) !== wanted))
    : systems;

  for (const system of ordered) {
    const level = system._add2eClassLevel;
    const progression = system?.progression;
    if (!Array.isArray(progression) || !Number.isInteger(level)) continue;
    const byLevel = progression.find(row => Number(row?.level ?? row?.niveau ?? 0) === level);
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
  ].map(value => add2eFeatureKey({ id: value })).filter(Boolean);
  return values.some(value => value === "voleur" || value.includes("voleur"));
}

function add2eGetActorThiefProgression(actor) {
  const thiefSystem = add2eGetActorClassSystems(actor).find(add2eIsThiefClassSystem);
  return thiefSystem ? add2eGetActorClassProgression(actor, thiefSystem._add2eClassSlug) : null;
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
    for (let index = 0; index < keys.length; index += 1) output[keys[index]] = Number(progression.skills[index] ?? 0) || 0;
  }

  return ADD2E_THIEF_SKILL_ROWS.map(([key, label]) => ({
    key,
    label,
    value: output[key] ?? 0,
    display: `${output[key] ?? 0}%`,
    type: "percent",
    canRoll: true
  })).filter(row => Object.prototype.hasOwnProperty.call(output, row.key));
}

globalThis.add2eFeatureMinLevel = add2eFeatureMinLevel;
globalThis.add2eFeatureMaxLevel = add2eFeatureMaxLevel;
globalThis.add2eFeatureActorLevel = add2eFeatureActorLevel;
globalThis.add2eGetActorClassSystems = add2eGetActorClassSystems;
globalThis.add2eGetActorClassFeatures = add2eGetActorClassFeatures;
globalThis.add2eGetActorActivableClassFeatures = add2eGetActorActivableClassFeatures;
globalThis.add2eGetActorPassiveClassFeatures = add2eGetActorPassiveClassFeatures;
globalThis.add2eFindClassFeatureFromElement = add2eFindClassFeatureFromElement;
globalThis.add2eExecuteClassFeatureOnUse = add2eExecuteClassFeatureOnUse;
globalThis.add2eUseClassFeatureFromElement = add2eUseClassFeatureFromElement;
globalThis.add2eGetActorClassProgression = add2eGetActorClassProgression;
globalThis.add2eGetActorThiefProgression = add2eGetActorThiefProgression;
globalThis.add2eGetActorThiefSkillTable = add2eGetActorThiefSkillTable;