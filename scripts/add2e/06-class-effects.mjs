// ============================================================
// ADD2E — Nettoyage effets de classe + compétences de voleur
// ============================================================
const ADD2E_CLASS_PASSIVE_EFFECTS_VERSION = "2026-07-10-individual-passive-effects-v1";
const ADD2E_CLASS_PASSIVE_EFFECT_SYNC_LOCK = new Set();

function add2eClassEffectKey(value) {
  return add2eNormalizeEquipTag(value);
}

function add2eEffectFlagValue(effect, keys = []) {
  const flags = effect?.flags?.add2e ?? {};
  for (const key of keys) {
    const value = flags?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return null;
}

function add2eShouldDeleteEffectForClassPurge(effect, itemsToDelete = []) {
  const origin = String(effect?.origin || "");
  const itemUuids = itemsToDelete.map(i => i.uuid).filter(Boolean);
  const itemIds = itemsToDelete.map(i => i.id).filter(Boolean);

  if (itemUuids.includes(origin)) return true;
  if (itemIds.some(id => origin.endsWith(`.${id}`))) return true;

  const oldClassItems = itemsToDelete.filter(i => String(i.type || "").toLowerCase() === "classe");
  if (!oldClassItems.length) return false;

  const oldClassKeys = new Set();
  for (const cls of oldClassItems) {
    const sys = cls.system ?? {};
    for (const value of [cls.name, sys.label, sys.nom, sys.name, sys.classe, sys.slug]) {
      const key = add2eClassEffectKey(value);
      if (key) oldClassKeys.add(key);
    }
    if (cls.id) oldClassKeys.add(add2eClassEffectKey(cls.id));
    if (cls.uuid) oldClassKeys.add(add2eClassEffectKey(cls.uuid));
  }

  const flags = effect?.flags?.add2e ?? {};
  const sourceType = add2eClassEffectKey(flags.sourceType ?? flags.type ?? flags.kind ?? "");
  const sourceClass = add2eClassEffectKey(
    flags.sourceClasse ?? flags.sourceClass ?? flags.className ?? flags.classe ?? flags.classKey ?? ""
  );
  const sourceId = add2eClassEffectKey(flags.sourceItemId ?? flags.sourceClassId ?? flags.classId ?? "");
  const effectName = add2eClassEffectKey(effect?.name ?? effect?.label ?? "");

  if (["classe", "class", "class_feature", "capacite_classe", "classfeature"].includes(sourceType)) return true;
  if (sourceClass && oldClassKeys.has(sourceClass)) return true;
  if (sourceId && oldClassKeys.has(sourceId)) return true;

  if (effectName && [...oldClassKeys].some(k => k && effectName.includes(k))) return true;

  return false;
}

function add2eClassEffectClone(value) {
  if (value === undefined || value === null) return value;
  try { return foundry.utils.deepClone(value); }
  catch (_error) {
    try { return JSON.parse(JSON.stringify(value)); }
    catch (_cloneError) { return value; }
  }
}

function add2eClassItemLevel(actor, classItem) {
  const direct = Number(classItem?.system?.niveau ?? classItem?.system?.level);
  if (Number.isFinite(direct) && direct >= 1) return Math.floor(direct);

  try {
    const canonical = Number(globalThis.add2eCanonicalClassLevel?.(actor, classItem, NaN));
    if (Number.isFinite(canonical) && canonical >= 1) return Math.floor(canonical);
  } catch (_error) {}

  const classItems = Array.from(actor?.items ?? []).filter(item => String(item?.type ?? "").toLowerCase() === "classe");
  if (classItems.length === 1) {
    const legacy = Number(actor?.system?.niveau);
    if (Number.isFinite(legacy) && legacy >= 1) return Math.floor(legacy);
  }
  return null;
}

function add2eClassFeatureLevelRange(feature) {
  const min = Number(feature?.minLevel ?? feature?.minimumLevel ?? feature?.niveauMin ?? feature?.level ?? feature?.niveau ?? 1);
  const maxRaw = feature?.maxLevel ?? feature?.maximumLevel ?? feature?.niveauMax ?? feature?.max;
  const max = maxRaw === undefined || maxRaw === null || maxRaw === "" ? null : Number(maxRaw);
  return {
    min: Number.isFinite(min) && min >= 1 ? Math.floor(min) : 1,
    max: Number.isFinite(max) && max >= 1 ? Math.floor(max) : null
  };
}

function add2eClassFeatureUnlocked(feature, level) {
  const classLevel = Number(level);
  if (!Number.isFinite(classLevel) || classLevel < 1) return false;
  const range = add2eClassFeatureLevelRange(feature);
  return classLevel >= range.min && (range.max === null || classLevel <= range.max);
}

function add2eIsPassiveClassFeature(feature) {
  if (!feature || typeof feature !== "object") return false;
  const type = add2eClassEffectKey(feature.type ?? feature.kind ?? feature.category ?? "");
  const hasOnUse = Boolean(String(feature.on_use ?? feature.onUse ?? feature.onUseScript ?? feature.script ?? "").trim());
  if (feature.activable === true || feature.active === true || hasOnUse) return false;
  if (["active", "activable", "action", "capacite_active"].includes(type)) return false;
  if (feature.passive === false) return false;
  if (feature.passive === true) return true;
  if (["passive", "rule", "regle", "always_on", "permanent"].includes(type)) return true;
  return true;
}

function add2eClassFeatureStableId(feature, index = 0) {
  const raw = feature?.id
    ?? feature?._id
    ?? feature?.key
    ?? feature?.slug
    ?? feature?.flags?.add2e?.id
    ?? feature?.flags?.add2e?.key
    ?? feature?.name
    ?? feature?.label
    ?? feature?.title
    ?? feature?.nom
    ?? `feature-${index + 1}`;
  return add2eClassEffectKey(raw) || `feature_${index + 1}`;
}

function add2eClassFeatureEntries(system = {}) {
  const values = [];
  for (const raw of [system.classFeatures, system.classFeaturesDebloquees]) {
    const list = Array.isArray(raw) ? raw : (raw && typeof raw === "object" ? Object.values(raw) : []);
    values.push(...list);
  }
  const seen = new Set();
  return values.filter((feature, index) => {
    if (!feature || typeof feature !== "object") return false;
    const key = add2eClassFeatureStableId(feature, index);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function add2eClassFeatureTags(feature) {
  const tags = new Set();
  for (const value of [
    feature?.tags,
    feature?.tag,
    feature?.effectTags,
    feature?.effets,
    feature?.effects,
    feature?.flags?.add2e?.tags,
    feature?.flags?.add2e?.effectTags
  ]) {
    for (const raw of add2eToEquipArray(value)) {
      const tag = add2eNormalizeEquipTag(raw);
      if (tag) tags.add(tag);
    }
  }
  return [...tags];
}

function add2eClassFeatureRules(feature) {
  const rules = [];
  for (const raw of [feature?.rules, feature?.flags?.add2e?.rules]) {
    const list = Array.isArray(raw) ? raw : (raw && typeof raw === "object" ? [raw] : []);
    for (const rule of list) if (rule && typeof rule === "object") rules.push(add2eClassEffectClone(rule));
  }
  return rules;
}

function add2eCollectUnlockedClassEffectTags(actor, classItem = null) {
  const tags = new Set();
  const classItems = classItem
    ? [classItem]
    : Array.from(actor?.items ?? []).filter(item => String(item?.type ?? "").toLowerCase() === "classe");

  for (const item of classItems) {
    const level = add2eClassItemLevel(actor, item);
    if (level === null) continue;
    for (const feature of add2eClassFeatureEntries(item.system ?? {})) {
      if (!add2eIsPassiveClassFeature(feature) || !add2eClassFeatureUnlocked(feature, level)) continue;
      for (const tag of add2eClassFeatureTags(feature)) tags.add(tag);
    }
  }

  return [...tags];
}

function add2eBuildClassPassiveEffectData(actor, classItem, feature, featureIndex, level) {
  const featureId = add2eClassFeatureStableId(feature, featureIndex);
  const passiveKey = `${classItem.id}|${featureId}`;
  const range = add2eClassFeatureLevelRange(feature);
  const label = String(feature.name ?? feature.label ?? feature.title ?? feature.nom ?? "Capacité passive").trim() || "Capacité passive";
  const description = String(feature.description ?? feature.system?.description ?? feature.flags?.add2e?.description ?? "").trim();
  const image = String(feature.img ?? feature.icon ?? classItem.img ?? "icons/svg/aura.svg").trim() || "icons/svg/aura.svg";
  const tags = add2eClassFeatureTags(feature);
  const rules = add2eClassFeatureRules(feature).map(rule => ({
    ...rule,
    source: {
      ...(rule?.source && typeof rule.source === "object" ? rule.source : {}),
      classItemId: classItem.id,
      classItemUuid: classItem.uuid,
      className: classItem.name,
      classLevel: level,
      featureId,
      featureName: label
    }
  }));

  return {
    passiveKey,
    data: {
      name: label,
      label,
      img: image,
      icon: image,
      description,
      origin: classItem.uuid,
      disabled: false,
      transfer: false,
      changes: [],
      flags: {
        add2e: {
          autoClassPassiveEffect: true,
          classPassiveFeatureEffect: true,
          passiveKey,
          sourceType: "class_feature",
          sourceClasse: classItem.name,
          sourceItemId: classItem.id,
          sourceItemUuid: classItem.uuid,
          classFeatureId: featureId,
          classFeatureName: label,
          classFeatureMinLevel: range.min,
          classFeatureMaxLevel: range.max,
          classLevel: level,
          passive: true,
          description,
          tags,
          effectTags: tags,
          rules
        }
      }
    }
  };
}

async function add2eSyncClassPassiveEffect(actor) {
  if (!actor) return null;

  const classItems = Array.from(actor.items ?? []).filter(item => String(item?.type ?? "").toLowerCase() === "classe");
  const existing = Array.from(actor.effects ?? []).filter(effect => effect?.flags?.add2e?.autoClassPassiveEffect === true);
  const desired = new Map();

  for (const classItem of classItems) {
    const level = add2eClassItemLevel(actor, classItem);
    if (level === null) continue;
    const features = add2eClassFeatureEntries(classItem.system ?? {});
    features.forEach((feature, featureIndex) => {
      if (!add2eIsPassiveClassFeature(feature) || !add2eClassFeatureUnlocked(feature, level)) return;
      const entry = add2eBuildClassPassiveEffectData(actor, classItem, feature, featureIndex, level);
      desired.set(entry.passiveKey, entry.data);
    });
  }

  const existingByKey = new Map();
  const staleIds = [];
  for (const effect of existing) {
    const passiveKey = String(effect.flags?.add2e?.passiveKey ?? "").trim();
    const featureId = String(effect.flags?.add2e?.classFeatureId ?? "").trim();
    const sourceItemId = String(effect.flags?.add2e?.sourceItemId ?? "").trim();
    const key = passiveKey || (featureId && sourceItemId ? `${sourceItemId}|${featureId}` : "");
    if (!key) {
      staleIds.push(effect.id);
      continue;
    }
    const list = existingByKey.get(key) ?? [];
    list.push(effect);
    existingByKey.set(key, list);
  }

  const updates = [];
  const creates = [];
  const synchronized = [];

  for (const [passiveKey, data] of desired.entries()) {
    const matches = existingByKey.get(passiveKey) ?? [];
    const current = matches.shift() ?? null;
    staleIds.push(...matches.map(effect => effect.id).filter(Boolean));
    existingByKey.delete(passiveKey);
    if (current) {
      updates.push({ _id: current.id, ...data });
      synchronized.push(current);
    } else {
      creates.push(data);
    }
  }

  for (const effects of existingByKey.values()) staleIds.push(...effects.map(effect => effect.id).filter(Boolean));

  if (updates.length) await actor.updateEmbeddedDocuments("ActiveEffect", updates, { render: false, add2eInternal: true });
  const created = creates.length
    ? await actor.createEmbeddedDocuments("ActiveEffect", creates, { render: false, add2eInternal: true })
    : [];
  if (staleIds.length) await actor.deleteEmbeddedDocuments("ActiveEffect", [...new Set(staleIds)], { render: false, add2eInternal: true });

  return synchronized[0] ?? created[0] ?? null;
}

function add2eQueueClassPassiveEffectSync(actor, reason = "class-change") {
  if (!actor || actor.type !== "personnage") return false;
  if (!actor.isOwner && !game.user?.isGM) return false;
  const key = String(actor.uuid ?? actor.id ?? actor.name ?? "unknown");
  if (ADD2E_CLASS_PASSIVE_EFFECT_SYNC_LOCK.has(key)) return false;
  ADD2E_CLASS_PASSIVE_EFFECT_SYNC_LOCK.add(key);
  setTimeout(async () => {
    try { await add2eSyncClassPassiveEffect(actor); }
    catch (error) { console.error("[ADD2E][CLASS_PASSIVE_EFFECTS][SYNC_ERROR]", { actor: actor?.name, reason, error }); }
    finally { ADD2E_CLASS_PASSIVE_EFFECT_SYNC_LOCK.delete(key); }
  }, 0);
  return true;
}

function add2eRegisterClassPassiveEffectHooks() {
  if (globalThis.ADD2E_CLASS_PASSIVE_EFFECT_HOOKS_REGISTERED === ADD2E_CLASS_PASSIVE_EFFECTS_VERSION) return;
  globalThis.ADD2E_CLASS_PASSIVE_EFFECT_HOOKS_REGISTERED = ADD2E_CLASS_PASSIVE_EFFECTS_VERSION;

  const actorFromItem = item => {
    const parent = item?.parent ?? item?.actor ?? null;
    return parent?.documentName === "Actor" ? parent : null;
  };
  const isClassItem = item => String(item?.type ?? "").toLowerCase() === "classe";

  Hooks.on("createItem", (item, _options = {}, userId = null) => {
    if (userId && game.user?.id !== userId) return;
    if (!isClassItem(item)) return;
    add2eQueueClassPassiveEffectSync(actorFromItem(item), "create-class-item");
  });

  Hooks.on("updateItem", (item, changes = {}, _options = {}, userId = null) => {
    if (userId && game.user?.id !== userId) return;
    if (!isClassItem(item)) return;
    const relevant = !changes || typeof changes !== "object"
      || foundry.utils.hasProperty(changes, "name")
      || foundry.utils.hasProperty(changes, "system.niveau")
      || foundry.utils.hasProperty(changes, "system.level")
      || foundry.utils.hasProperty(changes, "system.classFeatures")
      || foundry.utils.hasProperty(changes, "system.classFeaturesDebloquees");
    if (relevant) add2eQueueClassPassiveEffectSync(actorFromItem(item), "update-class-item");
  });

  Hooks.on("deleteItem", (item, _options = {}, userId = null) => {
    if (userId && game.user?.id !== userId) return;
    if (!isClassItem(item)) return;
    add2eQueueClassPassiveEffectSync(actorFromItem(item), "delete-class-item");
  });

  Hooks.on("updateActor", (actor, changes = {}, _options = {}, userId = null) => {
    if (userId && game.user?.id !== userId) return;
    if (actor?.type !== "personnage") return;
    const relevant = foundry.utils.hasProperty(changes, "system.niveau")
      || foundry.utils.hasProperty(changes, "system.niveaux_par_classe")
      || foundry.utils.hasProperty(changes, "system.details_classe");
    if (relevant) add2eQueueClassPassiveEffectSync(actor, "update-actor-class-level");
  });

  Hooks.once("ready", () => {
    if (!game.user?.isGM) return;
    for (const actor of game.actors?.contents ?? []) {
      if (actor?.type === "personnage") add2eQueueClassPassiveEffectSync(actor, "ready-existing-actors");
    }
  });
}

globalThis.add2eSyncClassPassiveEffect = add2eSyncClassPassiveEffect;
globalThis.add2eQueueClassPassiveEffectSync = add2eQueueClassPassiveEffectSync;
add2eRegisterClassPassiveEffectHooks();

function add2eNormalizeThiefSkillKey(value) {
  const key = add2eNormalizeEquipTag(value)
    .replace(/^competence_voleur:/, "")
    .replace(/^competences_voleur:/, "")
    .replace(/^thief_skill:/, "")
    .replace(/^voleur:/, "");

  const aliases = {
    pick_pockets: "pickpocket", pick_pocket: "pickpocket", pickpockets: "pickpocket", pickpocket: "pickpocket", vol_a_la_tire: "pickpocket", tire_laine: "pickpocket",
    open_locks: "crochetage_serrures", open_lock: "crochetage_serrures", crochetage: "crochetage_serrures", crochetage_de_serrures: "crochetage_serrures", crochetage_serrure: "crochetage_serrures", crochetage_serrures: "crochetage_serrures", ouverture_de_serrures: "crochetage_serrures", ouverture_serrures: "crochetage_serrures", ouvrir_serrures: "crochetage_serrures",
    find_remove_traps: "detection_pieges", find_traps: "detection_pieges", remove_traps: "detection_pieges", detect_traps: "detection_pieges", detection_desamorcage_des_pieges: "detection_pieges", detection_desamorcage_pieges: "detection_pieges", detection_pieges: "detection_pieges", detection_de_pieges: "detection_pieges", desamorcage_pieges: "detection_pieges", desamorcage_de_pieges: "detection_pieges", pieges: "detection_pieges",
    move_silently: "deplacement_silencieux", deplacement_silencieux: "deplacement_silencieux", deplacement_en_silence: "deplacement_silencieux", silence: "deplacement_silencieux",
    hide_in_shadows: "dissimulation", dissimulation_dans_l_ombre: "dissimulation", dissimulation_dans_lombre: "dissimulation", dissimulation: "dissimulation", ombre: "dissimulation",
    detect_noise: "ecoute", acuite_auditive: "ecoute", ecoute: "ecoute", ecouter: "ecoute",
    climb_walls: "escalade", escalade: "escalade", grimper: "escalade",
    backstab: "frappe_dans_le_dos", attaque_dans_le_dos: "frappe_dans_le_dos", frappe_dans_le_dos: "frappe_dans_le_dos", dos: "frappe_dans_le_dos",
    read_languages: "lecture_langues", read_language: "lecture_langues", lecture_des_langues: "lecture_langues", lecture_langues: "lecture_langues", langues: "lecture_langues",
    assassination: "assassinat", assassinate: "assassinat", assassiner: "assassinat", assassinat: "assassinat", comp_assassin: "assassinat", competence_assassin: "assassinat"
  };
  return aliases[key] ?? key;
}

function add2eThiefToArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(v => add2eThiefToArray(v));
  if (typeof value === "string") return value.split(/[,;|\n]+/).map(v => v.trim()).filter(Boolean);
  return [value];
}

function add2eReadThiefBonusValue(rawValue) {
  if (typeof rawValue === "number") return rawValue;
  if (typeof rawValue === "string" && rawValue.trim() !== "") return Number(rawValue) || 0;
  if (rawValue && typeof rawValue === "object") {
    const v = rawValue.value ?? rawValue.bonus ?? rawValue.mod ?? rawValue.adjustment ?? rawValue.valeur ?? rawValue.malus;
    return Number(v) || 0;
  }
  return 0;
}

function add2eGetThiefBonusFromMap(map, key) {
  if (!map) return 0;
  const wanted = add2eNormalizeThiefSkillKey(key);
  let total = 0;
  const accepts = rawKey => {
    const normKey = add2eNormalizeThiefSkillKey(rawKey);
    return [wanted, "all", "toutes", "global", "*"].includes(normKey);
  };

  if (Array.isArray(map)) {
    for (const entry of map) {
      if (!entry) continue;
      if (typeof entry === "string") {
        const parsed = add2eParseThiefBonusTag(entry);
        if (parsed && accepts(parsed.key)) total += parsed.value;
        continue;
      }
      if (typeof entry === "object") {
        const rawKey = entry.key ?? entry.skill ?? entry.competence ?? entry.compétence ?? entry.name ?? entry.label ?? entry.id ?? "all";
        if (accepts(rawKey)) total += add2eReadThiefBonusValue(entry);
      }
    }
    return total;
  }

  if (typeof map === "string") {
    for (const token of map.split(/[,;|\n]+/).map(x => x.trim()).filter(Boolean)) {
      const parsed = add2eParseThiefBonusTag(token);
      if (parsed && accepts(parsed.key)) total += parsed.value;
    }
    return total;
  }

  if (typeof map !== "object") return 0;
  for (const [rawKey, rawValue] of Object.entries(map)) {
    if (!accepts(rawKey)) continue;
    total += add2eReadThiefBonusValue(rawValue);
  }
  return total;
}

function add2ePushThiefBonus(out, label, map, key) {
  const value = add2eGetThiefBonusFromMap(map, key);
  if (value !== 0) out.push({ label, value });
}

const ADD2E_THIEF_RACIAL_SLUG_ALIASES = {
  demi_elf: "demi_elfe", half_elf: "demi_elfe", halfelf: "demi_elfe",
  demi_orc: "demi_orque", demi_orque: "demi_orque", half_orc: "demi_orque", halforc: "demi_orque",
  elf: "elfe",
  dwarf: "nain",
  halfling: "petite_gens", petite_gens: "petite_gens", petit_gens: "petite_gens", petite_gen: "petite_gens"
};

function add2eNormalizeRaceReference(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function add2eGetActorRaceItem(actor) {
  const races = Array.from(actor?.items ?? []).filter(item => String(item?.type ?? "").toLowerCase() === "race");
  if (!races.length) return null;

  const stored = actor?.system?.race;
  const details = actor?.system?.details_race ?? {};
  const rawReferences = [
    ...(stored && typeof stored === "object" ? [stored.id, stored._id, stored.uuid, stored.slug, stored.name, stored.nom, stored.label] : [stored]),
    actor?.system?.raceId,
    actor?.system?.race_id,
    details.id,
    details._id,
    details.slug,
    details.name,
    details.nom,
    details.label
  ].map(value => String(value ?? "").trim()).filter(Boolean);

  const byId = races.find(item => rawReferences.some(reference => reference === item.id || reference === item.uuid));
  if (byId) return byId;

  const references = new Set(rawReferences.map(add2eNormalizeRaceReference).filter(Boolean));
  const byIdentity = races.find(item => {
    const system = item?.system ?? {};
    const identities = [item?.name, system.slug, system.name, system.nom, system.label]
      .map(add2eNormalizeRaceReference)
      .filter(Boolean);
    return identities.some(identity => references.has(identity));
  });

  return byIdentity ?? races[0];
}

function add2eGetActorRaceSystem(actor) {
  const details = add2eDeepClone(actor?.system?.details_race ?? {}) || {};
  const raceItem = add2eGetActorRaceItem(actor);
  const itemSystem = add2eDeepClone(raceItem?.system ?? {}) || {};
  if (foundry?.utils?.mergeObject) return foundry.utils.mergeObject(details, itemSystem, { inplace: false, recursive: true });
  return { ...details, ...itemSystem };
}

function add2eGetActorRaceSlug(actor, race = null) {
  const item = add2eGetActorRaceItem(actor);
  const source = race ?? add2eGetActorRaceSystem(actor);
  const raw = source?.slug ?? source?.label ?? source?.nom ?? source?.name ?? item?.system?.slug ?? item?.name ?? actor?.system?.race ?? "";
  const normalized = add2eNormalizeEquipTag(raw);
  return ADD2E_THIEF_RACIAL_SLUG_ALIASES[normalized] ?? normalized;
}

function add2eHasThiefBonusEntries(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim() !== "";
  return Boolean(value && typeof value === "object" && Object.keys(value).length > 0);
}

function add2eGetExplicitRaceThiefBonusMaps(race) {
  return [
    race?.thief_adjustments,
    race?.thief_bonuses,
    race?.thiefSkillAdjustments,
    race?.thiefSkillBonuses,
    race?.voleurSkillAdjustments,
    race?.voleurSkillBonuses,
    race?.bonus_competences_voleur,
    race?.bonus_competence_voleur,
    race?.bonus_voleur,
    race?.malus_competences_voleur,
    race?.skillBonuses?.voleur,
    race?.skillAdjustments?.voleur
  ].filter(add2eHasThiefBonusEntries);
}

function add2eIsThiefClassSystem(system) {
  const values = [
    system?._add2eClassSlug,
    system?._add2eClassName,
    system?.slug,
    system?.label,
    system?.nom,
    system?.name,
    system?.classe,
    ...(Array.isArray(system?.tags) ? system.tags : []),
    ...(Array.isArray(system?.effectTags) ? system.effectTags : [])
  ].map(add2eNormalizeEquipTag).filter(Boolean);
  return values.some(value => value === "voleur" || value.includes("voleur") || value === "assassin" || value.includes("assassin"));
}

function add2eGetThiefClassItem(actor) {
  return actor?.items?.find?.(item => {
    if (String(item?.type ?? "").toLowerCase() !== "classe") return false;
    return add2eIsThiefClassSystem({ ...(item?.system ?? {}), _add2eClassName: item?.name, _add2eClassItemId: item?.id });
  }) ?? null;
}

function add2eThiefClassItemLevel(actor, item) {
  const direct = Number(item?.system?.niveau ?? item?.system?.level);
  if (Number.isFinite(direct) && direct >= 1) return Math.floor(direct);

  try {
    const canonical = globalThis.add2eCanonicalClassLevel?.(actor, item, NaN);
    if (Number.isFinite(canonical) && canonical >= 1) return Math.floor(canonical);
  } catch (_error) {}

  return null;
}

function add2eGetThiefClassSystem(actor) {
  const directItem = add2eGetThiefClassItem(actor);
  const classSystems = globalThis.add2eGetActorClassSystems?.(actor);
  if (Array.isArray(classSystems)) {
    const thiefSystem = classSystems.find(system => {
      if (!add2eIsThiefClassSystem(system)) return false;
      return !directItem || !system?._add2eClassItemId || system._add2eClassItemId === directItem.id;
    });
    if (thiefSystem) return thiefSystem;
  }

  if (directItem) {
    const level = add2eThiefClassItemLevel(actor, directItem);
    return {
      ...(directItem.system ?? {}),
      _add2eClassSlug: add2eNormalizeEquipTag(directItem.system?.slug ?? directItem.system?.label ?? directItem.name),
      _add2eClassName: directItem.name,
      _add2eClassItemId: directItem.id,
      ...(level ? { _add2eClassLevel: level } : {})
    };
  }

  try {
    const merged = add2eGetActorClassSystem(actor);
    if (merged && typeof merged === "object" && add2eIsThiefClassSystem(merged)) return merged;
  } catch (err) {
    console.warn("[ADD2E][VOLEUR][CLASSE] Lecture de la classe fusionnée impossible.", err);
  }
  return {};
}

function add2eGetEquippedThiefBonusMaps(actor) {
  const maps = [];
  for (const item of actor?.items ?? []) {
    const sys = item.system ?? {};
    const equipped = sys.equipee === true || sys.equipped === true || sys.portee === true || sys.active === true;
    if (!equipped) continue;
    const sources = [
      sys.thiefSkillAdjustments, sys.thiefSkillBonuses, sys.thief_adjustments, sys.thief_bonuses,
      sys.voleurSkillAdjustments, sys.voleurSkillBonuses, sys.bonus_competences_voleur,
      sys.malus_competences_voleur, sys.skillBonuses?.voleur, sys.skillAdjustments?.voleur,
      item.flags?.add2e?.thiefSkillAdjustments, item.flags?.add2e?.thiefSkillBonuses
    ];
    for (const map of sources) if (map && typeof map === "object") maps.push({ label: item.name, map });
  }
  return maps;
}

function add2eGetActorFinalDexterity(actor) {
  const system = actor?.system ?? {};
  const base = Number(system.dexterite_base ?? system.dexterite ?? system.dex_aff ?? 0);
  const racial = Number(system.bonus_caracteristiques?.dexterite ?? system.dexterite_race ?? 0);
  const divers = Number(system.bonus_divers_caracteristiques?.dexterite ?? 0);
  const total = base + racial + divers;
  return Number.isFinite(total) && total > 0 ? Math.floor(total) : 0;
}

function add2eGetThiefDexBonus(actor, key) {
  const details = add2eGetThiefClassSystem(actor);
  const dex = add2eGetActorFinalDexterity(actor);
  const sources = [
    details?.thiefSkillDexAdjustments,
    details?.thiefDexAdjustments,
    actor?.system?.thiefSkillDexAdjustments,
    actor?.system?.thiefDexAdjustments
  ];
  for (const table of sources) {
    if (!table || typeof table !== "object") continue;
    const row = table[String(dex)] ?? table[dex];
    const value = add2eGetThiefBonusFromMap(row, key);
    if (value !== 0) return { value, label: `Dextérité ${dex}` };
  }
  return { value: 0, label: `Dextérité ${dex}` };
}

function add2eParseThiefBonusTag(raw) {
  const norm = add2eNormalizeEquipTag(raw);
  if (!norm) return null;
  const prefixes = ["bonus_voleur", "bonus_competence_voleur", "bonus_competences_voleur", "bonus_thief_skill", "thief_skill_bonus", "malus_voleur", "malus_competence_voleur", "malus_competences_voleur", "malus_thief_skill", "thief_skill_malus"];
  for (const prefix of prefixes) {
    if (norm === prefix) continue;
    if (!norm.startsWith(prefix + ":") && !norm.startsWith(prefix + "_")) continue;
    const isMalus = prefix.startsWith("malus") || prefix.endsWith("malus");
    const rest = norm.slice(prefix.length + 1);
    const sep = norm[prefix.length];
    let skillKey = "all";
    let value = 0;
    if (sep === ":") {
      const parts = rest.split(":").filter(Boolean);
      if (parts.length === 1) value = Number(parts[0]) || 0;
      else {
        skillKey = parts.slice(0, -1).join(":");
        value = Number(parts.at(-1)) || 0;
      }
    } else {
      const match = rest.match(/^(.*)_(-?\d+)$/);
      if (!match) continue;
      skillKey = match[1] || "all";
      value = Number(match[2]) || 0;
    }
    if (isMalus) value = -Math.abs(value);
    return { key: add2eNormalizeThiefSkillKey(skillKey), value };
  }
  return null;
}

function add2eGetActiveTagThiefBonuses(actor, key) {
  const out = [];
  const wanted = add2eNormalizeThiefSkillKey(key);
  let tags = [];
  try {
    if (typeof Add2eEffectsEngine !== "undefined" && Add2eEffectsEngine?.getActiveTags) tags = Add2eEffectsEngine.getActiveTags(actor) ?? [];
  } catch (err) {
    console.warn("[ADD2E][VOLEUR][BONUS TAGS] Impossible de lire les tags actifs.", err);
  }
  for (const raw of tags) {
    const parsed = add2eParseThiefBonusTag(raw);
    if (!parsed) continue;
    if (![wanted, "all", "toutes", "global", "*"].includes(parsed.key)) continue;
    if (parsed.value !== 0) out.push({ label: "Effets actifs", value: parsed.value });
  }
  return out;
}

function add2eGetThiefSkillBonuses(actor, key) {
  const out = [];
  const details = add2eGetThiefClassSystem(actor);
  const raceItem = add2eGetActorRaceItem(actor);
  const race = add2eGetActorRaceSystem(actor);
  for (const map of [actor?.system?.thiefSkillAdjustments, actor?.system?.thiefSkillBonuses, actor?.system?.voleurSkillAdjustments, actor?.system?.voleurSkillBonuses, actor?.system?.bonus_competences_voleur, actor?.system?.bonusCompetencesVoleur]) add2ePushThiefBonus(out, "Acteur", map, key);
  for (const map of [details.thiefSkillAdjustments, details.thiefSkillBonuses, details.thief_adjustments, details.thief_bonuses, details.voleurSkillAdjustments, details.voleurSkillBonuses, details.bonus_competences_voleur, details.bonus_competence_voleur, details.bonus_voleur, details.malus_competences_voleur, details.skillBonuses?.voleur, details.skillAdjustments?.voleur]) add2ePushThiefBonus(out, "Classe", map, key);

  const raceLabel = String(raceItem?.name ?? race?.label ?? race?.nom ?? race?.name ?? "Race").trim() || "Race";
  for (const map of add2eGetExplicitRaceThiefBonusMaps(race)) add2ePushThiefBonus(out, `Race — ${raceLabel}`, map, key);

  const dexBonus = add2eGetThiefDexBonus(actor, key);
  if (dexBonus.value !== 0) out.push(dexBonus);
  for (const src of add2eGetEquippedThiefBonusMaps(actor)) add2ePushThiefBonus(out, src.label, src.map, key);
  out.push(...add2eGetActiveTagThiefBonuses(actor, key));
  return out.filter(b => Number(b.value || 0) !== 0);
}

function add2eFormatSigned(value) {
  const n = Number(value) || 0;
  return `${n >= 0 ? "+" : ""}${n}`;
}

function add2eBuildThiefSkillRow({ keyRaw, labelRaw, valueRaw, actor, type = "percent", canRoll = true }) {
  const key = add2eNormalizeThiefSkillKey(keyRaw || labelRaw);
  if (!key) return null;
  const base = Number(valueRaw ?? 0);
  if (!Number.isFinite(base)) return null;
  const isBackstab = key.includes("frappe") || key.includes("dos") || key.includes("backstab");
  const finalType = isBackstab ? "multiplier" : type;
  const bonuses = finalType === "multiplier" ? [] : add2eGetThiefSkillBonuses(actor, key);
  const bonusTotal = bonuses.reduce((sum, b) => sum + (Number(b.value) || 0), 0);
  const finalValue = finalType === "multiplier" ? base : Math.max(0, base + bonusTotal);
  const bonusDisplay = bonusTotal === 0 ? "" : add2eFormatSigned(bonusTotal);
  const detailParts = [`Base ${finalType === "multiplier" ? `×${base}` : `${base}%`}`, ...bonuses.map(b => `${b.label} ${add2eFormatSigned(b.value)}%`)];
  return {
    key,
    label: String(labelRaw || keyRaw || key).trim(),
    shortLabel: String(labelRaw || keyRaw || key).trim().replace(/^Détection\/désamorçage des pièges$/i, "Pièges").replace(/^Détection de pièges$/i, "Pièges").replace(/^Crochetage de serrures$/i, "Crochetage").replace(/^Ouverture de serrures$/i, "Serrures").replace(/^Déplacement silencieux$/i, "Silence").replace(/^Dissimulation dans l’ombre$/i, "Dissimulation").replace(/^Lecture des langues$/i, "Langues"),
    base,
    value: finalValue,
    finalValue,
    bonusTotal,
    bonusDisplay,
    bonuses,
    display: finalType === "multiplier" ? `×${finalValue}` : `${finalValue}%`,
    baseDisplay: finalType === "multiplier" ? `×${base}` : `${base}%`,
    type: finalType,
    canRoll: finalType !== "multiplier" && canRoll === true,
    note: finalType === "multiplier" ? "Multiplicateur d'attaque dans le dos" : "Jet de pourcentage : réussite si d100 ≤ score",
    breakdownTitle: detailParts.join(" | ")
  };
}

function add2eThiefClassLevel(details, actor) {
  return Math.max(1, Number(details?._add2eClassLevel ?? actor?.system?.niveau ?? 1) || 1);
}

function add2eGetActorThiefSkills(actor, progressionRow = null) {
  const details = add2eGetThiefClassSystem(actor);
  const level = add2eThiefClassLevel(details, actor);
  const progression = Array.isArray(details.progression) ? details.progression : [];
  const row = progressionRow || progression.find((r, idx) => Number(r?.niveau ?? r?.level ?? idx + 1) === level) || null;
  if (!row) return [];

  const labelsObj = details.thiefSkillLabels && typeof details.thiefSkillLabels === "object" ? details.thiefSkillLabels : null;
  const order = Array.isArray(details.thiefSkillOrder) && details.thiefSkillOrder.length
    ? details.thiefSkillOrder.map(add2eNormalizeThiefSkillKey)
    : labelsObj ? Object.keys(labelsObj).map(add2eNormalizeThiefSkillKey) : [];
  const legacyLabels = Array.isArray(details.skillLabels) ? details.skillLabels : [];
  const legacyValues = Array.isArray(row.skills) ? row.skills : [];
  const structured = row.thiefSkills && typeof row.thiefSkills === "object" ? row.thiefSkills : {};
  const rows = [];
  const pushed = new Set();
  const pushSkill = (keyRaw, labelRaw, valueRaw, opts = {}) => {
    const skill = add2eBuildThiefSkillRow({ keyRaw, labelRaw, valueRaw, actor, ...opts });
    if (!skill || pushed.has(skill.key)) return;
    pushed.add(skill.key);
    rows.push(skill);
  };

  if (order.length) {
    for (let idx = 0; idx < order.length; idx += 1) {
      const key = order[idx];
      const label = labelsObj?.[key] ?? legacyLabels[idx] ?? key;
      const value = structured[key] ?? legacyValues[idx];
      pushSkill(key, label, value);
    }
  }
  if (!rows.length && legacyLabels.length && legacyValues.length) legacyLabels.forEach((label, idx) => pushSkill(label, label, legacyValues[idx]));
  const readLanguages = Number(row.readLanguages ?? row.read_languages ?? row.lectureLangues ?? structured.read_languages ?? structured.lecture_langues ?? 0) || 0;
  if (readLanguages > 0 && !pushed.has("lecture_langues")) pushSkill("lecture_langues", "Lecture des langues", readLanguages);
  return rows;
}

function add2eNormalizeThiefModifier(value) {
  const compact = String(value ?? "").trim().replace(/\s+/g, "").slice(0, 3);
  return /^[+-]?\d{0,2}$/.test(compact) ? (Number.parseInt(compact, 10) || 0) : 0;
}

async function add2ePromptThiefSkillModifiers(_actor, skill) {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.wait) return null;

  const content = `<form class="add2e-dialog add2e-thief-roll-dialog" style="display:grid;gap:.7em;"><div><strong>${skill.label}</strong><br><span class="a2e-muted">Score actuel : ${skill.display}</span></div><div style="display:flex;align-items:center;gap:.6em;"><label for="add2e-thief-skill-modifier">Modificateur</label><input id="add2e-thief-skill-modifier" name="mod" type="text" inputmode="numeric" autocomplete="off" maxlength="3" value="0" style="width:3ch;min-width:3ch;text-align:center;"></div></form>`;

  return DialogV2.wait({
    window: { title: `Jet de ${skill.label}` },
    content,
    buttons: [
      {
        action: "roll",
        label: "Lancer",
        default: true,
        callback: (_event, button) => ({ mod: add2eNormalizeThiefModifier(button.form?.elements?.mod?.value) })
      },
      { action: "cancel", label: "Annuler", callback: () => null }
    ],
    rejectClose: false,
    render: (_event, dialog) => {
      const input = dialog.element?.querySelector?.("input[name='mod']");
      if (!input) return;
      input.addEventListener("input", () => {
        input.value = String(input.value ?? "").replace(/[^0-9+-]/g, "").replace(/(?!^)[+-]/g, "").slice(0, 3);
      });
      input.focus();
      input.select();
    }
  });
}

async function add2eRollThiefSkill(actor, key) {
  if (!actor) return ui.notifications.warn("Acteur introuvable.");
  const details = add2eGetThiefClassSystem(actor);
  const level = add2eThiefClassLevel(details, actor);
  const progression = Array.isArray(details.progression) ? details.progression : [];
  const row = progression.find((r, idx) => Number(r?.niveau ?? r?.level ?? idx + 1) === level) || null;
  const skills = add2eGetActorThiefSkills(actor, row);
  const wanted = add2eNormalizeThiefSkillKey(key);
  const skill = skills.find(s => s.key === wanted);
  if (!skill) return ui.notifications.warn("Compétence de voleur introuvable pour ce niveau.");
  if (!skill.canRoll) return ui.notifications.info(`${skill.label} : ${skill.display}. Aucun jet automatique requis.`);

  const options = await add2ePromptThiefSkillModifiers(actor, skill);
  if (!options) return;
  const isAssassination = skill.key === "assassinat";
  const situational = Number(options.mod || 0) || 0;
  const finalValue = Math.max(0, Number(skill.value || 0) + situational);
  const roll = await new Roll("1d100").evaluate({ async: true });
  if (game.dice3d) await game.dice3d.showForRoll(roll);
  const success = roll.total <= finalValue;
  const noticed = skill.key === "pickpocket" && roll.total >= finalValue + 21;
  const color = success ? "#1f8f4d" : "#b3261e";
  const allDetails = [{ label: "Base", value: skill.base }, ...skill.bonuses, ...(situational !== 0 ? [{ label: "Situation", value: situational }] : [])];
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<div class="add2e-card-test" style="border-radius:12px;border:1px solid ${color};background:#fffdf6;padding:.75em 1em;font-family:var(--font-primary);"><div style="display:flex;align-items:center;gap:.6em;margin-bottom:.4em;"><i class="fas fa-mask" style="color:${color};font-size:1.5em;"></i><b style="color:${color};font-size:1.12em;">${skill.label}</b><span style="margin-left:auto;color:#666;">${isAssassination ? "Compétence d’assassin" : "Compétence de voleur"}</span></div><div>Score final : <b>${finalValue}%</b> — Jet : <b>${roll.total}</b></div><div style="font-size:.9em;color:#555;margin-top:.35em;">${allDetails.map(d => `${d.label} ${add2eFormatSigned(d.value)}%`).join(" ; ")}</div><div style="margin-top:.35em;font-weight:800;color:${color};">${success ? "Réussite" : "Échec"}</div>${isAssassination && success ? `<div style="margin-top:.25em;color:#1f8f4d;font-weight:700;">Assassinat réussi : effet létal à appliquer selon les conditions de scène et l’arbitrage du MJ.</div>` : ""}${isAssassination && !success ? `<div style="margin-top:.25em;color:#b3261e;font-weight:700;">Assassinat manqué.</div>` : ""}${noticed ? `<div style="margin-top:.25em;color:#b3261e;font-weight:700;">La victime remarque la tentative de pickpocket.</div>` : ""}</div>` });
}

globalThis.add2eGetActorThiefSkills = add2eGetActorThiefSkills;
globalThis.add2eGetActorThiefSkillTable = actor => add2eGetActorThiefSkills(actor);
globalThis.add2eRollThiefSkill = add2eRollThiefSkill;
globalThis.add2eParseThiefBonusTag = add2eParseThiefBonusTag;

async function handleItemAction({ actor, action, itemId, itemType, sheet }) {
  if (!actor || !action || !itemId) return;
  const item = actor.items.get(itemId);
  if (!item) return;
  const effectiveType = (() => {
    const t = (itemType || item.type || "").toLowerCase();
    if (t === "weapon") return "arme";
    if (t === "armor") return "armure";
    return t;
  })();

  if (action === "edit") return item.sheet?.render(true);
  if (action === "delete") {
    await actor.deleteEmbeddedDocuments("Item", [item.id]);
    sheet?._add2eRememberActiveTab?.();
    sheet?.render(false);
    return;
  }
  if (action !== "equip") return;

  if (effectiveType === "objet") {
    await item.update({ "system.equipee": !item.system.equipee });
    sheet?._add2eRememberActiveTab?.();
    sheet?.render(false);
    return;
  }

  if (effectiveType === "arme") {
    const check = add2eCheckEquipmentAllowedForClass(actor, item, "arme");
    if (!check.ok) {
      const reason = check.reason === "forbidden" ? `tag interdit : ${check.matchedForbidden}` : "arme non autorisée par les restrictions de classe";
      ui.notifications.error(`⚠️ Cette arme (« ${item.name} ») est interdite pour votre classe (${check.classeLabel}) — ${reason}.`);
      return;
    }
    const dejaEquipee = item.system.equipee === true;
    const estDeuxMains = !!item.system.deuxMains || add2eGetItemEquipTags(item).includes("usage:deux_mains");
    const isJet = !!item.system.arme_de_jet || !!item.system.portee_courte || !!item.system.portee_moyenne || !!item.system.portee_longue || add2eGetItemEquipTags(item).includes("usage:distance") || add2eGetItemEquipTags(item).includes("usage:lancer");
    const isContact = !isJet;
    if (dejaEquipee) {
      await item.update({ "system.equipee": false });
      sheet?._add2eRememberActiveTab?.();
      sheet?.render(false);
      return;
    }
    if (estDeuxMains) {
      const bouclierEquipe = actor.items.find(i => (String(i.type || "").toLowerCase() === "armure" || String(i.type || "").toLowerCase() === "armor") && i.system.equipee && add2eIsShield(i));
      if (bouclierEquipe) {
        ui.notifications.error(`⚠️ Impossible d'équiper une arme à deux mains si un bouclier est équipé (${bouclierEquipe.name}).`);
        return;
      }
    }
    for (const weapon of actor.items.filter(i => ["arme", "weapon"].includes(String(i.type || "").toLowerCase()) && i.id !== item.id)) {
      const tags = add2eGetItemEquipTags(weapon);
      const otherIsJet = !!weapon.system.arme_de_jet || !!weapon.system.portee_courte || !!weapon.system.portee_moyenne || !!weapon.system.portee_longue || tags.includes("usage:distance") || tags.includes("usage:lancer");
      if ((isJet && otherIsJet) || (isContact && !otherIsJet)) await weapon.update({ "system.equipee": false });
    }
    await item.update({ "system.equipee": true });
    sheet?._add2eRememberActiveTab?.();
    sheet?.render(false);
    return;
  }

  if (effectiveType === "armure") {
    const estDejaEquipee = item.system.equipee === true;
    const estBouclier = add2eIsShield(item);
    const estHeaume = add2eIsHelmet(item);
    const estArmure = !estBouclier && !estHeaume;
    const check = add2eCheckEquipmentAllowedForClass(actor, item, "armure");
    const isMonk = ((check.classe?.label || check.classe?.nom || check.classe?.name || check.classeLabel || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f’']/g, "").includes("moine"));
    const armorsAllowed = add2eToEquipArray(check.classe?.armorAllowed ?? check.classe?.armures_autorisees ?? []).map(add2eNormalizeEquipTag);
    if (!add2eHasTagRestriction(check.classe?.armorRestriction) && isMonk && armorsAllowed.includes("aucune")) {
      ui.notifications.error("⚠️ Les Moines ne peuvent jamais porter d’armure !");
      return;
    }
    if (estBouclier) {
      const armeDeuxMains = actor.items.find(i => {
        const t = String(i.type || "").toLowerCase();
        const tags = add2eGetItemEquipTags(i);
        return ["arme", "weapon"].includes(t) && i.system.equipee && (!!i.system.deuxMains || tags.includes("usage:deux_mains"));
      });
      if (armeDeuxMains) {
        ui.notifications.error(`⚠️ Impossible d'équiper un bouclier avec une arme à deux mains (${armeDeuxMains.name}) déjà équipée.`);
        return;
      }
    }
    if (estDejaEquipee) {
      await item.update({ "system.equipee": false });
    } else {
      if (!check.ok) {
        const reason = check.reason === "forbidden" ? `tag interdit : ${check.matchedForbidden}` : "protection non autorisée par les restrictions de classe";
        const typeLabel = estBouclier ? "Ce bouclier" : estHeaume ? "Ce heaume" : "Cette armure";
        ui.notifications.error(`⚠️ ${typeLabel} (« ${item.name} ») est interdit pour votre classe (${check.classeLabel}) — ${reason}.`);
        return;
      }
      for (const armor of actor.items) {
        const type = String(armor.type || "").toLowerCase();
        if (!["armure", "armor"].includes(type) || armor.id === item.id) continue;
        if ((estArmure && !add2eIsShield(armor) && !add2eIsHelmet(armor)) || (estBouclier && add2eIsShield(armor)) || (estHeaume && add2eIsHelmet(armor))) await armor.update({ "system.equipee": false });
      }
      if (estBouclier) {
        for (const weapon of actor.items.filter(a => {
          const type = String(a.type || "").toLowerCase();
          const tags = add2eGetItemEquipTags(a);
          return ["arme", "weapon"].includes(type) && a.system.equipee && (!!a.system.deuxMains || tags.includes("usage:deux_mains"));
        })) {
          await weapon.update({ "system.equipee": false });
          ui.notifications.warn("Arme à deux mains déséquipée car un bouclier est équipé.");
        }
      }
      await item.update({ "system.equipee": true });
    }
    const equipped = actor.items.filter(i => ["armure", "armor"].includes(String(i.type || "").toLowerCase()) && i.system.equipee);
    const armure = equipped.find(i => !add2eIsShield(i) && !add2eIsHelmet(i));
    const bouclier = equipped.find(i => add2eIsShield(i));
    const heaume = equipped.find(i => add2eIsHelmet(i));
    let caTotal = actor.system.ca_naturel || 10;
    if (armure) caTotal = Number(armure.system.ac);
    if (bouclier) caTotal -= Number(bouclier.system.ac);
    if (heaume) caTotal -= Number(heaume.system.ac);
    caTotal += actor.system.dex_def || 0;
    await actor.update({ "system.ca_total": caTotal });
    sheet?._add2eRememberActiveTab?.();
    sheet?.render(false);
  }
}

function showAdd2eDiceRollerDialog() {
  const DialogV2 = foundry.applications?.api?.DialogV2;
  if (!DialogV2?.wait) return ui.notifications.warn("DialogV2 indisponible.");
  const content = `<form style="display:grid;gap:.7em;"><div style="display:flex;align-items:center;gap:1em;justify-content:center;"><label for="add2e-nb-dice" style="min-width:5.5em;">Nombre :</label><input id="add2e-nb-dice" type="number" min="1" max="100" value="1" style="width:3.5em;"></div><div style="display:flex;flex-wrap:wrap;gap:.4em;justify-content:center;margin-top:.5em;">${[4, 6, 8, 10, 12, 20, 100].map(f => `<button type="button" data-faces="${f}" style="padding:.45em 1em;font-size:1.13em;font-weight:600;background:#efe9f6;border-radius:7px;border:1.5px solid #9d8bd2;color:#674197;box-shadow:0 2px 5px #0001;">d${f}</button>`).join("")}</div></form>`;
  DialogV2.wait({
    window: { title: "Lancer de dés (AD&D2e)" },
    content,
    buttons: [
      { action: "cancel", label: "Annuler", callback: () => null }
    ],
    rejectClose: false,
    render: (_event, dialog) => {
      dialog.element.querySelectorAll("[data-faces]").forEach(button => button.addEventListener("click", async event => {
        event.preventDefault();
        const faces = Number(button.dataset.faces);
        const nb = Math.max(1, parseInt(dialog.element.querySelector("#add2e-nb-dice")?.value) || 1);
        const roll = await new Roll(`${nb}d${faces}`).evaluate({ async: true });
        await roll.toMessage({ flavor: `<b>Lancer de ${nb}d${faces}</b> (par le lanceur de dés AD&D2e)` });
        dialog.close();
      }));
    }
  });
}

function add2e_updateFinalCaracs(actor) {
  const CARACS = ["force", "dexterite", "constitution", "intelligence", "sagesse", "charisme"];
  const updates = {};
  for (const c of CARACS) {
    const base = getProperty(actor.system, `${c}_base`) ?? 10;
    const bonusRace = getProperty(actor.system.bonus_caracteristiques, c) ?? 0;
    const bonusDivers = getProperty(actor.system.bonus_divers_caracteristiques, c) ?? 0;
    updates[`system.${c}`] = base + bonusRace + bonusDivers;
  }
  return actor.update(updates);
}

function formatSortChamp(val) {
  if (!val) return "-";
  if (typeof val === "object") {
    const v = val.valeur !== undefined ? val.valeur : "";
    const u = val.unite ? ` ${val.unite}` : "";
    return `${v}${u}`.trim() || "-";
  }
  return val;
}

globalThis.formatSortChamp = formatSortChamp;
try { globalThis.add2eClassEffectKey = add2eClassEffectKey; } catch (_e) {}
try { globalThis.add2eEffectFlagValue = add2eEffectFlagValue; } catch (_e) {}
try { globalThis.add2eShouldDeleteEffectForClassPurge = add2eShouldDeleteEffectForClassPurge; } catch (_e) {}
try { globalThis.add2eCollectUnlockedClassEffectTags = add2eCollectUnlockedClassEffectTags; } catch (_e) {}
try { globalThis.add2eSyncClassPassiveEffect = add2eSyncClassPassiveEffect; } catch (_e) {}
try { globalThis.add2eNormalizeThiefSkillKey = add2eNormalizeThiefSkillKey; } catch (_e) {}
try { globalThis.add2eThiefToArray = add2eThiefToArray; } catch (_e) {}
try { globalThis.add2eReadThiefBonusValue = add2eReadThiefBonusValue; } catch (_e) {}
try { globalThis.add2eGetThiefBonusFromMap = add2eGetThiefBonusFromMap; } catch (_e) {}
try { globalThis.add2ePushThiefBonus = add2ePushThiefBonus; } catch (_e) {}
try { globalThis.add2eGetActorRaceItem = add2eGetActorRaceItem; } catch (_e) {}
try { globalThis.add2eGetActorRaceSystem = add2eGetActorRaceSystem; } catch (_e) {}
try { globalThis.add2eGetActorRaceSlug = add2eGetActorRaceSlug; } catch (_e) {}
try { globalThis.add2eGetThiefClassSystem = add2eGetThiefClassSystem; } catch (_e) {}
try { globalThis.add2eGetEquippedThiefBonusMaps = add2eGetEquippedThiefBonusMaps; } catch (_e) {}
try { globalThis.add2eGetActorFinalDexterity = add2eGetActorFinalDexterity; } catch (_e) {}
try { globalThis.add2eGetThiefDexBonus = add2eGetThiefDexBonus; } catch (_e) {}
try { globalThis.add2eParseThiefBonusTag = add2eParseThiefBonusTag; } catch (_e) {}
try { globalThis.add2eGetActiveTagThiefBonuses = add2eGetActiveTagThiefBonuses; } catch (_e) {}
try { globalThis.add2eGetThiefSkillBonuses = add2eGetThiefSkillBonuses; } catch (_e) {}
try { globalThis.add2eFormatSigned = add2eFormatSigned; } catch (_e) {}
try { globalThis.add2eBuildThiefSkillRow = add2eBuildThiefSkillRow; } catch (_e) {}
try { globalThis.add2eGetActorThiefSkills = add2eGetActorThiefSkills; } catch (_e) {}
try { globalThis.add2eGetActorThiefSkillTable = actor => add2eGetActorThiefSkills(actor); } catch (_e) {}
try { globalThis.add2ePromptThiefSkillModifiers = add2ePromptThiefSkillModifiers; } catch (_e) {}
try { globalThis.add2eRollThiefSkill = add2eRollThiefSkill; } catch (_e) {}
try { globalThis.handleItemAction = handleItemAction; } catch (_e) {}
try { globalThis.showAdd2eDiceRollerDialog = showAdd2eDiceRollerDialog; } catch (_e) {}
try { globalThis.add2e_updateFinalCaracs = add2e_updateFinalCaracs; } catch (_e) {}
try { globalThis.formatSortChamp = formatSortChamp; } catch (_e) {}
