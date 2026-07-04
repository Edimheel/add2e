// ============================================================
// ADD2E — Capacités activables de classe : exécution on_use
// Les Items classe sont la source de vérité pour les niveaux et les capacités.
// Compatible Foundry V13 / V14 / V15.
// ============================================================

const ADD2E_CLASS_ACTIVE_ABILITIES_VERSION = "2026-07-04-thief-hud-canonical-resolver-v11";
const ADD2E_THIEF_DEFAULT_ORDER = [
  "pickpocket",
  "crochetage_serrures",
  "detection_pieges",
  "deplacement_silencieux",
  "dissimulation",
  "ecoute",
  "escalade",
  "frappe_dans_le_dos"
];
const ADD2E_THIEF_DEFAULT_LABELS = {
  pickpocket: "Pickpocket",
  crochetage_serrures: "Crochetage de serrures",
  detection_pieges: "Détection/désamorçage des pièges",
  deplacement_silencieux: "Déplacement silencieux",
  dissimulation: "Dissimulation dans l’ombre",
  ecoute: "Acuité auditive",
  escalade: "Escalade",
  frappe_dans_le_dos: "Attaque dans le dos",
  lecture_langues: "Lecture des langues"
};
const ADD2E_THIEF_SKILL_ALIASES = {
  pick_pockets: "pickpocket", pick_pocket: "pickpocket", pickpockets: "pickpocket", pickpocket: "pickpocket",
  open_locks: "crochetage_serrures", open_lock: "crochetage_serrures", crochetage: "crochetage_serrures", crochetage_serrures: "crochetage_serrures", ouverture_serrures: "crochetage_serrures", ouverture_de_serrures: "crochetage_serrures",
  find_remove_traps: "detection_pieges", find_traps: "detection_pieges", remove_traps: "detection_pieges", detect_traps: "detection_pieges", detection_pieges: "detection_pieges", detection_de_pieges: "detection_pieges", desamorcage_pieges: "detection_pieges", desamorcage_de_pieges: "detection_pieges",
  move_silently: "deplacement_silencieux", deplacement_silencieux: "deplacement_silencieux",
  hide_in_shadows: "dissimulation", dissimulation: "dissimulation", dissimulation_dans_l_ombre: "dissimulation", dissimulation_dans_lombre: "dissimulation",
  hear_noise: "ecoute", hear_noises: "ecoute", detect_noise: "ecoute", listen: "ecoute", acuite_auditive: "ecoute", ecoute: "ecoute",
  climb_walls: "escalade", climb_wall: "escalade", escalade: "escalade",
  backstab: "frappe_dans_le_dos", attaque_dans_le_dos: "frappe_dans_le_dos", frappe_dans_le_dos: "frappe_dans_le_dos",
  read_languages: "lecture_langues", read_language: "lecture_langues", lecture_langues: "lecture_langues", lecture_des_langues: "lecture_langues"
};

// Le HUD garde son rendu compact natif. Cette valeur empêche la surcouche de
// l’onglet Capacités de remplacer son HTML par celui de la feuille.
globalThis.__ADD2E_CAPABILITIES_HUD_MIRROR_V1 = true;
globalThis.ADD2E_CLASS_ACTIVE_ABILITIES_VERSION = ADD2E_CLASS_ACTIVE_ABILITIES_VERSION;

function add2eClone(value) {
  if (foundry?.utils?.deepClone) return foundry.utils.deepClone(value);
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function add2eToClassFeatureArray(value) {
  if (Array.isArray(value)) return value.filter(entry => entry && typeof entry === "object");
  if (value && typeof value === "object") return Object.values(value).filter(entry => entry && typeof entry === "object");
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
  return String(feature?._add2eHudLabel ?? feature?.name ?? feature?.label ?? feature?.title ?? feature?.nom ?? "").trim();
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

function add2eNormalizeThiefSkillKeyLocal(value) {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[_\s-]+/g, "_");
  return ADD2E_THIEF_SKILL_ALIASES[raw] ?? raw;
}

function add2eClassSlugFromSystem(system, name = "") {
  return add2eFeatureKey({ id: system?.slug ?? system?.label ?? system?.nom ?? system?.name ?? name });
}

function add2eClassItemLevel(item, fallback = null) {
  const value = Number(item?.system?.niveau ?? item?.system?.level);
  if (Number.isFinite(value) && value >= 1) return Math.floor(value);
  const fallbackValue = Number(fallback);
  return Number.isFinite(fallbackValue) && fallbackValue >= 1 ? Math.floor(fallbackValue) : null;
}

function add2eIsThiefClassIdentity(system, name = "") {
  const value = add2eClassSlugFromSystem(system, name);
  return value === "voleur" || value.includes("voleur") || value === "assassin" || value.includes("assassin");
}

function add2eNormalizeThiefProgressionSystem(system, name = "") {
  const copy = add2eClone(system ?? {}) ?? {};
  if (!add2eIsThiefClassIdentity(copy, name)) return copy;

  copy.thiefSkillLabels = {
    ...ADD2E_THIEF_DEFAULT_LABELS,
    ...(copy.thiefSkillLabels && typeof copy.thiefSkillLabels === "object" ? copy.thiefSkillLabels : {})
  };
  copy.thiefSkillOrder = Array.isArray(copy.thiefSkillOrder) && copy.thiefSkillOrder.length
    ? copy.thiefSkillOrder.map(add2eNormalizeThiefSkillKeyLocal)
    : [...ADD2E_THIEF_DEFAULT_ORDER];

  if (!Array.isArray(copy.progression)) return copy;
  copy.progression = copy.progression.map(sourceRow => {
    const row = { ...(sourceRow ?? {}) };
    const rawSkills = row.thiefSkills && typeof row.thiefSkills === "object" && !Array.isArray(row.thiefSkills)
      ? { ...row.thiefSkills }
      : {};

    // Nouveau JSON Voleur : ces deux valeurs sont séparées de thiefSkills.
    const backstab = Number(row.backstabMultiplier);
    if (Number.isFinite(backstab) && backstab > 0) rawSkills.frappe_dans_le_dos = backstab;

    const readLanguages = Number(row.readLanguages);
    if (Number.isFinite(readLanguages) && readLanguages > 0) rawSkills.lecture_langues = readLanguages;

    row.thiefSkills = rawSkills;
    return row;
  });
  return copy;
}

function add2eClassSystemEntry(system, { name = "", slug = "", level = null, itemId = null } = {}) {
  if (!system || typeof system !== "object" || !Number.isInteger(level) || level < 1) return null;
  const normalizedSystem = add2eNormalizeThiefProgressionSystem(system, name);
  return {
    ...normalizedSystem,
    _add2eClassSlug: slug || add2eClassSlugFromSystem(normalizedSystem, name),
    _add2eClassName: name || normalizedSystem.label || normalizedSystem.nom || normalizedSystem.name || "Classe",
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
  const output = [];
  const seen = new Set();
  for (const system of add2eGetActorClassSystems(actor)) {
    add2ePushClassFeatures(output, system.activeClassFeatures, "activeClassFeatures", system);
    add2ePushClassFeatures(output, system.activableClassFeatures, "activableClassFeatures", system);
    add2ePushClassFeatures(output, system.classFeaturesActives, "classFeaturesActives", system);
    add2ePushClassFeatures(output, system.capacitesActives, "capacitesActives", system);
    add2ePushClassFeatures(output, system.capacitesActivables, "capacitesActivables", system);
    add2ePushClassFeatures(output, system.classFeatures, "classFeatures", system);
    add2ePushClassFeatures(output, system.classFeaturesDebloquees, "classFeaturesDebloquees", system);
    add2ePushClassFeatures(output, system.capacitesClasse, "capacitesClasse", system);
    add2ePushClassFeatures(output, system.passiveClassFeatures, "passiveClassFeatures", system);
    add2ePushClassFeatures(output, system.passiveFeatures, "passiveFeatures", system);
    add2ePushClassFeatures(output, system.capacitesPassives, "capacitesPassives", system);
  }

  return output.filter(feature => {
    const key = add2eFeatureKey(feature);
    const unique = `${feature?._add2eClassItemId ?? feature?._add2eClassSlug ?? ""}|${key}|${add2eFeatureOnUse(feature)}|${feature?._add2eFeatureSource ?? ""}`;
    if (!key && !add2eFeatureOnUse(feature)) return false;
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
  return String(feature?._add2eFeatureSource ?? "") === "activeClassFeatures";
}

function add2eIsThiefClassFeature(feature) {
  const values = [feature?._add2eClassSlug, feature?._add2eClassName, feature?.sourceClassSlug, feature?.sourceClassName, feature?.classSlug, feature?.className, feature?.classe, feature?.class]
    .map(value => add2eFeatureKey({ id: value })).filter(Boolean);
  return values.some(value => value === "voleur" || value.includes("voleur") || value === "assassin" || value.includes("assassin"));
}

function add2eIsThiefSkillFeature(feature) {
  const name = add2eFeatureKey({ name: feature?.name ?? feature?.label ?? feature?.title ?? "" });
  const key = add2eNormalizeThiefSkillKeyLocal(feature?.skillKey ?? feature?.key ?? feature?.slug ?? "");
  const joined = `${name} ${key}`;
  return [
    "pickpocket", "faire_les_poches", "crochetage", "serrure", "piege", "desamorc",
    "deplacement_silencieux", "dissimulation", "ecoute", "auditiv", "hear_noise",
    "escalade", "climb", "lecture_langues", "read_languages", "frappe_dans_le_dos", "backstab",
    "assassinat", "assassination"
  ].some(token => joined.includes(token));
}

function add2eThiefActivityStatus(actor) {
  try {
    const status = globalThis.add2eGetThiefActivityEquipmentStatus?.(actor);
    if (status && typeof status === "object") return status;
  } catch (error) {
    console.warn("[ADD2E][CAPACITES][VOLEUR][ACTIVITE]", error);
  }
  return { applies: false, ok: true, message: "" };
}

function add2eFeatureActorLevel(_actor, feature = null) {
  const level = Number(feature?._add2eClassLevel);
  return Number.isFinite(level) && level >= 1 ? Math.floor(level) : null;
}

function add2eFindThiefSkill(actor, feature) {
  const key = add2eNormalizeThiefSkillKeyLocal(feature?.skillKey ?? feature?.key ?? feature?.slug ?? feature?.name ?? "");
  const rows = globalThis.add2eGetActorThiefSkills?.(actor) ?? [];
  return rows.find(row => add2eNormalizeThiefSkillKeyLocal(row?.key ?? row?.label ?? "") === key) ?? null;
}

function add2eHudFeatureLabel(feature, skill) {
  const label = String(feature?.name ?? feature?.label ?? "Capacité").trim();
  const display = String(skill?.display ?? "").trim();
  return display ? `${label} — ${display}` : label;
}

function add2eGetActorActivableClassFeatures(actor, { includeLocked = true } = {}) {
  const thiefStatus = add2eThiefActivityStatus(actor);
  return add2eGetActorClassFeatures(actor)
    .filter(feature => add2eIsFeatureActivable(feature))
    .filter(feature => {
      if (thiefStatus.applies && thiefStatus.ok === false && add2eIsThiefClassFeature(feature)) return false;
      if (includeLocked) return true;
      const level = add2eFeatureActorLevel(actor, feature);
      return level !== null && level >= add2eFeatureMinLevel(feature) && level <= add2eFeatureMaxLevel(feature);
    })
    .map(feature => {
      if (!add2eIsThiefSkillFeature(feature)) return feature;
      const skill = add2eFindThiefSkill(actor, feature);
      // Lecture des langues n’existe pas avant son niveau d’acquisition.
      if (!skill) return null;
      return {
        ...feature,
        _add2eThiefSkill: skill,
        _add2eHudLabel: add2eHudFeatureLabel(feature, skill)
      };
    })
    .filter(Boolean);
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
  for (const key of keys) {
    const value = dataset?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return undefined;
}

function add2eFindClassFeatureFromElement(actor, element) {
  const allFeatures = add2eGetActorClassFeatures(actor);
  const activeFeatures = add2eGetActorActivableClassFeatures(actor, { includeLocked: false });
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
      if (activeFeatures[index]) return activeFeatures[index];
    }
  }

  const rawSkill = add2eDatasetValue(dataset, ["skillKey", "skill", "competence", "competenceKey"]);
  if (rawSkill !== undefined) {
    const wanted = add2eNormalizeThiefSkillKeyLocal(rawSkill);
    const bySkill = activeFeatures.find(feature => add2eNormalizeThiefSkillKeyLocal(feature?.skillKey ?? feature?.key ?? feature?.slug ?? feature?.name) === wanted);
    if (bySkill) return bySkill;
  }

  const rawId = add2eDatasetValue(dataset, ["featureId", "featureKey", "id", "key"]);
  if (rawId !== undefined) {
    const wanted = add2eFeatureKey({ id: rawId });
    const byId = activeFeatures.find(feature => [feature.id, feature._id, feature.key, feature.slug, feature.skillKey, feature.name, feature.label]
      .map(value => add2eFeatureKey({ id: value })).includes(wanted));
    if (byId) return byId;
  }

  const rawName = add2eDatasetValue(dataset, ["featureName", "name", "feature", "nom"]);
  if (rawName !== undefined) {
    const wanted = add2eFeatureKey({ name: rawName });
    const byName = activeFeatures.find(feature => add2eFeatureKey({ name: feature?.name ?? feature?.label ?? "" }) === wanted);
    if (byName) return byName;
  }
  return activeFeatures.length === 1 ? activeFeatures[0] : null;
}

async function add2eExecuteClassFeatureOnUse(actor, feature, sheet = null) {
  if (!actor) return ui.notifications.error("Capacité de classe : acteur introuvable."), false;
  if (!feature) return ui.notifications.error("Capacité de classe introuvable dans les données de l’acteur."), false;

  const level = add2eFeatureActorLevel(actor, feature);
  const min = add2eFeatureMinLevel(feature);
  const max = add2eFeatureMaxLevel(feature);
  const name = String(feature?.name ?? feature?.label ?? "Capacité").trim();
  if (level === null || level < min || level > max) {
    ui.notifications.warn(`La capacité « ${name} » n’est pas disponible pour sa classe à son niveau actuel.`);
    return false;
  }

  if (add2eIsThiefSkillFeature(feature)) {
    const thiefStatus = add2eThiefActivityStatus(actor);
    if (thiefStatus.applies && !thiefStatus.ok) {
      ui.notifications.warn(thiefStatus.message || "Les capacités de voleur sont indisponibles avec l’équipement actuellement porté.");
      return false;
    }
    const roll = globalThis.add2eRollThiefSkill;
    if (typeof roll !== "function") {
      ui.notifications.error("Le moteur des compétences de voleur n’est pas chargé.");
      return false;
    }
    const skillKey = add2eNormalizeThiefSkillKeyLocal(feature?.skillKey ?? feature?.key ?? feature?.slug ?? feature?.name ?? name);
    return (await roll(actor, skillKey)) !== false;
  }

  const onUse = add2eFeatureOnUse(feature);
  if (!onUse) {
    ui.notifications.warn(`La capacité « ${name} » n’a pas de script on_use.`);
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
    ui.notifications.error(`Erreur pendant l’utilisation de « ${name} » : ${error.message}`);
    return false;
  }
}

async function add2eUseClassFeatureFromElement(actor, element, sheet = null) {
  return add2eExecuteClassFeatureOnUse(actor, add2eFindClassFeatureFromElement(actor, element), sheet);
}

function add2eHudActorFromCurrentState() {
  const actorId = String(globalThis.add2eHudCheck?.()?.actorId ?? "").trim();
  if (!actorId) return null;
  const token = [
    ...(canvas?.tokens?.controlled ?? []),
    ...(canvas?.tokens?.placeables ?? [])
  ].find(candidate => candidate?.actor?.id === actorId);
  return token?.actor ?? game.actors?.get?.(actorId) ?? null;
}

function add2eHudThiefSkillKeyFromButton(actor, button) {
  const row = button?.closest?.(".row");
  const displayed = String(row?.querySelector?.(".title")?.textContent ?? "")
    .split("—")[0]
    .trim();
  if (!displayed) return null;

  const displayedKey = add2eFeatureKey({ name: displayed });
  const skills = globalThis.add2eGetActorThiefSkills?.(actor) ?? [];
  const match = skills.find(skill => {
    const candidates = [skill?.label, skill?.shortLabel, skill?.key]
      .map(value => add2eFeatureKey({ name: value }))
      .filter(Boolean);
    return candidates.includes(displayedKey);
  });
  return match ? add2eNormalizeThiefSkillKeyLocal(match.key) : null;
}

function add2eInstallHudThiefSkillBridge() {
  if (globalThis.__ADD2E_HUD_THIEF_SKILL_BRIDGE_V1) return;
  globalThis.__ADD2E_HUD_THIEF_SKILL_BRIDGE_V1 = true;

  document.addEventListener("click", event => {
    const button = event.target?.closest?.("#add2e-action-hud button[data-action='use-feature']");
    if (!button) return;

    const actor = add2eHudActorFromCurrentState();
    const skillKey = actor ? add2eHudThiefSkillKeyFromButton(actor, button) : null;
    if (!actor || !skillKey) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();

    const relay = document.createElement("button");
    relay.dataset.skillKey = skillKey;
    void add2eUseClassFeatureFromElement(actor, relay, null);
  }, true);
}

function add2eGetActorClassProgression(actor, classSlug = null) {
  const wanted = add2eFeatureKey({ id: classSlug ?? "" });
  const systems = add2eGetActorClassSystems(actor);
  const ordered = wanted
    ? systems.filter(system => system._add2eClassSlug === wanted || add2eFeatureKey({ id: system._add2eClassName }) === wanted)
      .concat(systems.filter(system => system._add2eClassSlug !== wanted && add2eFeatureKey({ id: system._add2eClassName }) !== wanted))
    : systems;
  for (const system of ordered) {
    const progression = system?.progression;
    const level = system?._add2eClassLevel;
    if (!Array.isArray(progression) || !Number.isInteger(level)) continue;
    const row = progression.find(entry => Number(entry?.niveau ?? entry?.level ?? 0) === level) ?? progression[level - 1] ?? null;
    if (row) return row;
  }
  return null;
}

function add2eGetActorThiefProgression(actor) {
  const thiefSystem = add2eGetActorClassSystems(actor).find(system => add2eIsThiefClassIdentity(system, system?._add2eClassName));
  return thiefSystem ? add2eGetActorClassProgression(actor, thiefSystem._add2eClassSlug) : null;
}

function add2eGetActorThiefSkillTable(actor) {
  const progression = add2eGetActorThiefProgression(actor);
  const raw = progression?.thiefSkills && typeof progression.thiefSkills === "object" ? progression.thiefSkills : {};
  const rows = [];
  for (const key of ADD2E_THIEF_DEFAULT_ORDER) {
    if (raw[key] === undefined || raw[key] === null) continue;
    const value = Number(raw[key]) || 0;
    const multiplier = key === "frappe_dans_le_dos";
    rows.push({ key, label: ADD2E_THIEF_DEFAULT_LABELS[key], base: value, value, finalValue: value, bonusTotal: 0, display: multiplier ? `×${value}` : `${value}%`, baseDisplay: multiplier ? `×${value}` : `${value}%`, type: multiplier ? "multiplier" : "percent", canRoll: !multiplier });
  }
  if (raw.lecture_langues !== undefined && raw.lecture_langues !== null) {
    const value = Number(raw.lecture_langues) || 0;
    rows.push({ key: "lecture_langues", label: ADD2E_THIEF_DEFAULT_LABELS.lecture_langues, base: value, value, finalValue: value, bonusTotal: 0, display: `${value}%`, baseDisplay: `${value}%`, type: "percent", canRoll: true });
  }
  return rows;
}

function add2eRestoreHudCapabilityPresentation() {
  const id = "add2e-hud-capability-presentation-reset";
  document.getElementById(id)?.remove();
  const style = document.createElement("style");
  style.id = id;
  style.textContent = `
    #add2e-action-hud section[data-section="capacites"] > .a2e-hud-racial-capabilities,
    #add2e-action-hud section[data-section="effets"] > .a2e-hud-racial-effects,
    #add2e-action-hud .a2e-hud-racial-panel { display:grid !important; }
    #add2e-action-hud .a2e-hud-racial-title { display:block !important; }
    #add2e-action-hud .a2e-hud-racial-effects .a2e-hud-racial-row .meta { display:flex !important; }
    #add2e-action-hud .a2e-hud-racial-effects .a2e-hud-racial-row .a2e-hud-racial-description,
    #add2e-action-hud .a2e-hud-racial-capabilities .a2e-hud-racial-row .a2e-hud-racial-description { display:block !important; }
    #add2e-action-hud .add2e-capacites-hud-root { display:none !important; }
  `;
  document.head.appendChild(style);
}

Hooks.once("init", () => {
  // 06-class-effects-thief.mjs est chargé avant init : son normaliseur existe ici.
  const previous = globalThis.add2eNormalizeThiefSkillKey;
  if (!globalThis.__ADD2E_THIEF_SKILL_ALIAS_NORMALIZER_V2) {
    globalThis.__ADD2E_THIEF_SKILL_ALIAS_NORMALIZER_V2 = true;
    globalThis.add2eNormalizeThiefSkillKey = value => {
      const local = add2eNormalizeThiefSkillKeyLocal(value);
      if (local !== String(value ?? "")) return local;
      const normalized = typeof previous === "function" ? previous(value) : local;
      return ADD2E_THIEF_SKILL_ALIASES[normalized] ?? normalized;
    };
  }
});

Hooks.once("ready", () => {
  add2eRestoreHudCapabilityPresentation();
  add2eInstallHudThiefSkillBridge();
  Hooks.on("renderActorSheet", () => setTimeout(add2eRestoreHudCapabilityPresentation, 0));
});

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
globalThis.add2eNormalizeThiefSkillKeyLocal = add2eNormalizeThiefSkillKeyLocal;
