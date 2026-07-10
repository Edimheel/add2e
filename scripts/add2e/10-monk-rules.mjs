// ADD2E — Moine : mécanique liée à l'Item classe Moine.
// Compatible Foundry V13/V14/V15.

const ADD2E_MONK_RULES_VERSION = "2026-07-10-canonical-progression-v4";
const ADD2E_MONK_UNARMED_SYNC_LOCK = new Set();
const ADD2E_MONK_UNARMED_IMG = "systems/add2e/assets/icones/armes/main-nue.webp";
const ADD2E_MONK_GENERATED_FEATURE_SOURCE = "10-monk-rules";
globalThis.ADD2E_MONK_RULES_VERSION = ADD2E_MONK_RULES_VERSION;

function add2eMonkNorm(value) {
  if (typeof globalThis.add2eNormalizeEquipTag === "function") return globalThis.add2eNormalizeEquipTag(value);
  return String(value ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function add2eMonkClone(value) {
  try { return foundry.utils.deepClone(value ?? {}); }
  catch (_error) { return { ...(value ?? {}) }; }
}

function add2eMonkToArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(add2eMonkToArray).filter(v => String(v ?? "").trim() !== "");
  if (typeof value === "string") return value.split(/[,;|\n]+/g).map(v => v.trim()).filter(Boolean);
  if (typeof value === "object") {
    for (const key of ["value", "list", "lists", "items", "tags", "allowedTags", "weaponsAllowed", "armes_autorisees"]) {
      if (value[key] !== undefined) return add2eMonkToArray(value[key]);
    }
  }
  return [value];
}

function add2eMonkUniqueList(...values) {
  const out = [];
  const seen = new Set();
  for (const value of values.flatMap(add2eMonkToArray)) {
    const raw = String(value ?? "").trim();
    const key = add2eMonkNorm(raw);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(raw);
  }
  return out;
}

function add2eMonkClassItem(actor) {
  return Array.from(actor?.items ?? []).find(item => {
    if (String(item?.type ?? "").toLowerCase() !== "classe") return false;
    const system = item.system ?? {};
    const label = add2eMonkNorm(item.name || system.slug || system.label || system.nom || system.name || "");
    const tags = (Array.isArray(system.tags) ? system.tags : []).map(add2eMonkNorm);
    return label === "moine" || label.includes("moine") || tags.includes("classe:moine") || tags.includes("classe_moine");
  }) ?? null;
}

function add2eMonkClassLevel(item) {
  const level = Number(item?.system?.niveau);
  return Number.isFinite(level) && level >= 1 ? Math.floor(level) : null;
}

function add2eGetMonkClassSystem(actor) {
  const item = add2eMonkClassItem(actor);
  return item ? add2eMonkClone(item.system ?? {}) : null;
}

function add2eGetMonkProgressionRow(actor) {
  const item = add2eMonkClassItem(actor);
  const level = add2eMonkClassLevel(item);
  if (!item || level === null) return null;
  const progression = Array.isArray(item.system?.progression) ? item.system.progression : [];
  return progression.find(row => Number(row?.level ?? row?.niveau) === level)
    ?? progression[Math.max(0, Math.min(progression.length - 1, level - 1))]
    ?? null;
}

function add2eMonkDamageParts(raw) {
  if (raw && typeof raw === "object") raw = raw.raw ?? raw.value ?? raw.contre_moyen ?? raw.medium ?? raw.moyen;
  const parts = String(raw ?? "1d6/1d3").split(/[\/|]/).map(part => part.trim()).filter(Boolean);
  const moyen = parts[0] || "1d6";
  const grand = parts[1] || moyen;
  return { raw: `${moyen} / ${grand}`, moyen, grand };
}

function add2eMonkDamagePartsFromEffectsEngine(actor) {
  const engine = globalThis.Add2eEffectsEngine ?? null;
  if (!engine || typeof engine.getMonkUnarmedDamageParts !== "function") return null;
  try {
    const damage = engine.getMonkUnarmedDamageParts(actor);
    if (!damage?.moyen && !damage?.grand) return null;
    const moyen = String(damage.moyen ?? damage.medium ?? "").trim();
    const grand = String(damage.grand ?? damage.large ?? moyen).trim();
    if (!moyen || !grand) return null;
    return { raw: String(damage.raw ?? `${moyen} / ${grand}`).trim(), moyen, grand };
  } catch (error) {
    console.warn("[ADD2E][MOINE][MAIN_NUE][ENGINE_DAMAGE_ERROR]", { actor: actor?.name, error });
    return null;
  }
}

function add2eMonkMoveFromEffectsEngine(actor) {
  const engine = globalThis.Add2eEffectsEngine ?? null;
  if (!engine) return 0;
  try {
    if (typeof engine.getMonkMove === "function") {
      const move = Number(engine.getMonkMove(actor));
      if (Number.isFinite(move) && move > 0) return Math.floor(move);
    }
    if (typeof engine.getMonkMartialProgression === "function") {
      const move = Number(engine.getMonkMartialProgression(actor)?.move);
      if (Number.isFinite(move) && move > 0) return Math.floor(move);
    }
  } catch (error) {
    console.warn("[ADD2E][MOINE][MOUVEMENT][ENGINE_MOVE_ERROR]", { actor: actor?.name, error });
  }
  return 0;
}

function add2eIsMonkAutoUnarmed(item) {
  if (!item || String(item.type ?? "").toLowerCase() !== "arme") return false;
  const system = item.system ?? {};
  const name = add2eMonkNorm(item.name);
  return ["main_nue", "mainnue"].includes(name)
    || (system.add2eAutoCreated === true && add2eMonkNorm(system.sourceClasse) === "moine")
    || add2eMonkNorm(system.sourceCapacite) === "main_nue_moine";
}

function add2eMonkUnarmedImgFor(item = null) {
  const current = String(item?.img ?? "").trim();
  if (current && !["icons/svg/fist.svg", "icons/svg/mystery-man.svg", "icons/svg/item-bag.svg", "assets/icones/armes/main-nue.svg"].includes(current)) return current;
  return ADD2E_MONK_UNARMED_IMG;
}

function add2eMonkFeatureKey(feature) {
  const rawKey = String(feature?.flags?.add2e?.key ?? feature?.key ?? "").replace(/^moine_passif:/i, "");
  const key = add2eMonkNorm(rawKey);
  const name = add2eMonkNorm(feature?.name ?? feature?.label ?? feature?.title ?? feature?.nom ?? "");
  return key || name;
}

function add2eIsGeneratedMonkFeature(feature) {
  return feature?.flags?.add2e?.generatedBy === ADD2E_MONK_GENERATED_FEATURE_SOURCE
    || String(feature?.key ?? "").startsWith("moine_passif:");
}

function add2eStripGeneratedMarker(feature) {
  const cleaned = add2eMonkClone(feature);
  if (cleaned.flags?.add2e) {
    delete cleaned.flags.add2e.generatedBy;
    delete cleaned.flags.add2e.monkPassive;
    delete cleaned.flags.add2e.key;
    if (!Object.keys(cleaned.flags.add2e).length) delete cleaned.flags.add2e;
    if (cleaned.flags && !Object.keys(cleaned.flags).length) delete cleaned.flags;
  }
  if (String(cleaned.key ?? "").startsWith("moine_passif:")) delete cleaned.key;
  return cleaned;
}

async function add2eCleanGeneratedMonkClassFeatures(monk) {
  if (!monk?.id || String(monk.type ?? "").toLowerCase() !== "classe") return false;
  const current = Array.isArray(monk.system?.classFeatures) ? monk.system.classFeatures.map(add2eMonkClone) : [];
  if (!current.length) return false;

  const naturalKeys = new Set(current.filter(feature => !add2eIsGeneratedMonkFeature(feature)).map(add2eMonkFeatureKey).filter(Boolean));
  let changed = false;
  const next = [];

  for (const feature of current) {
    if (!add2eIsGeneratedMonkFeature(feature)) {
      next.push(feature);
      continue;
    }

    const key = add2eMonkFeatureKey(feature);
    if (key && naturalKeys.has(key)) {
      changed = true;
      continue;
    }

    const cleaned = add2eStripGeneratedMarker(feature);
    if (JSON.stringify(cleaned) !== JSON.stringify(feature)) changed = true;
    next.push(cleaned);
  }

  if (!changed || JSON.stringify(current) === JSON.stringify(next)) return false;
  await monk.update({ "system.classFeatures": next }, { add2eInternal: true, add2eReason: "monk-generated-passive-cleanup" });
  return true;
}

async function add2eEnsureMonkUnarmedAllowed(monk) {
  if (!monk?.id || String(monk.type ?? "").toLowerCase() !== "classe") return false;
  const system = monk.system ?? {};
  const allowedTags = [
    "main_nue",
    "arme:main_nue",
    "type_arme:main_nue",
    "famille_arme:main_nue",
    "combat:mains_nues",
    "classe:moine"
  ];

  const updates = {};
  const currentAllowed = add2eMonkToArray(system.armes_autorisees ?? system.weaponsAllowed ?? []);
  const nextAllowed = add2eMonkUniqueList(currentAllowed, "main_nue");
  if (nextAllowed.length !== currentAllowed.length || !currentAllowed.map(add2eMonkNorm).includes("main_nue")) {
    updates["system.armes_autorisees"] = nextAllowed;
    if (system.weaponsAllowed !== undefined) updates["system.weaponsAllowed"] = nextAllowed;
  }

  if (system.weaponRestriction && typeof system.weaponRestriction === "object") {
    const currentRestrictionAllowed = add2eMonkToArray(system.weaponRestriction.allowedTags);
    const nextRestrictionAllowed = add2eMonkUniqueList(currentRestrictionAllowed, allowedTags);
    if (nextRestrictionAllowed.length !== currentRestrictionAllowed.length) {
      updates["system.weaponRestriction.allowedTags"] = nextRestrictionAllowed;
    }
  }

  if (!Object.keys(updates).length) return false;
  await monk.update(updates, { add2eInternal: true, add2eReason: "monk-unarmed-equipment-allowance" });
  return true;
}

async function add2eSyncMonkUnarmedWeapon(actor) {
  if (!actor || actor.type !== "personnage") return false;
  const monk = add2eMonkClassItem(actor);
  const existing = Array.from(actor.items ?? []).filter(add2eIsMonkAutoUnarmed);
  if (!monk) {
    if (existing.length) await actor.deleteEmbeddedDocuments("Item", existing.map(item => item.id), { add2eInternal: true });
    return false;
  }

  await add2eCleanGeneratedMonkClassFeatures(monk);
  await add2eEnsureMonkUnarmedAllowed(monk);

  const row = add2eGetMonkProgressionRow(actor);
  if (!row && !add2eMonkDamagePartsFromEffectsEngine(actor)) {
    console.warn("[ADD2E][MOINE][PROGRESSION_MISSING]", { actor: actor.name, classItemId: monk.id });
    return false;
  }

  const damage = add2eMonkDamagePartsFromEffectsEngine(actor)
    ?? add2eMonkDamageParts(row?.monk?.unarmedDamage ?? actor.system?.moine?.main_nue);
  const monkMove = add2eMonkMoveFromEffectsEngine(actor);
  if (monkMove > 0) {
    await monk.update({
      "system.mouvement": monkMove,
      "system.movement": monkMove,
      "system.vitesse_deplacement": monkMove
    }, { add2eInternal: true, add2eReason: "monk-movement-from-effects-engine" });
  }

  const system = {
    nom: "Main nue",
    equipee: true,
    categorie: "melee",
    type_degats: "contondant",
    type_arme: "main_nue",
    famille_arme: "main_nue",
    degats: damage.raw,
    "dégâts": { contre_moyen: damage.moyen, contre_grand: damage.grand },
    bonus_hit: 0,
    bonus_dom: 0,
    facteur_rapidité: 1,
    portee_courte: 0,
    portee_moyenne: 0,
    portee_longue: 0,
    tags: ["arme", "arme:main_nue", "type_arme:main_nue", "famille_arme:main_nue", "usage:corps_a_corps", "degat:contondant", "combat:mains_nues", "classe:moine", "mod_carac:toucher:none", "mod_carac:degats:none"],
    effectTags: ["arme", "arme:main_nue", "type_arme:main_nue", "famille_arme:main_nue", "usage:corps_a_corps", "degat:contondant", "combat:mains_nues", "classe:moine", "mod_carac:toucher:none", "mod_carac:degats:none"],
    add2eAutoCreated: true,
    sourceClasse: "moine",
    sourceClassId: monk.id,
    sourceCapacite: "main_nue_moine"
  };

  const actorUpdates = {
    "system.moine.main_nue": damage.raw,
    "system.moine.main_nue_contre_moyen": damage.moyen,
    "system.moine.main_nue_contre_grand": damage.grand
  };
  if (monkMove > 0) {
    actorUpdates["system.mouvement.base"] = monkMove;
    actorUpdates["system.movement"] = monkMove;
    actorUpdates["system.vitesse_deplacement"] = monkMove;
  }
  await actor.update(actorUpdates, { add2eInternal: true });

  if (existing.length) {
    const [first, ...duplicates] = existing;
    await actor.updateEmbeddedDocuments("Item", [{ _id: first.id, name: "Main nue", img: add2eMonkUnarmedImgFor(first), system }], { add2eInternal: true });
    if (duplicates.length) await actor.deleteEmbeddedDocuments("Item", duplicates.map(item => item.id), { add2eInternal: true });
  } else {
    await actor.createEmbeddedDocuments("Item", [{
      type: "arme",
      name: "Main nue",
      img: ADD2E_MONK_UNARMED_IMG,
      system,
      flags: { add2e: { autoCreated: true, sourceClasse: "moine", sourceClassId: monk.id, sourceCapacite: "main_nue_moine" } }
    }], { add2eInternal: true });
  }

  return true;
}

function add2eGetRaceTagsForLevelCap(actor) {
  const tags = new Set();
  const push = value => { const tag = add2eMonkNorm(value); if (tag) tags.add(tag); };
  const pushAll = value => { if (Array.isArray(value)) value.forEach(pushAll); else if (value && typeof value === "object") Object.values(value).forEach(pushAll); else push(value); };
  for (const race of Array.from(actor?.items ?? []).filter(item => String(item.type ?? "").toLowerCase() === "race")) {
    push(`race:${race.system?.slug || race.name}`);
    pushAll(race.system?.tags);
    pushAll(race.system?.identityTags);
  }
  return tags;
}

function add2eGetClassMaxLevelForActor(actor, classItemOrSystem = null) {
  const classItem = classItemOrSystem?.type === "classe" ? classItemOrSystem : null;
  const system = classItem?.system ?? classItemOrSystem ?? (Array.from(actor?.items ?? []).filter(item => String(item.type ?? "").toLowerCase() === "classe").length === 1 ? Array.from(actor.items).find(item => String(item.type ?? "").toLowerCase() === "classe")?.system : null);
  if (!system || typeof system !== "object") return null;
  const rows = Array.isArray(system.progression) ? system.progression : [];
  let maxLevel = rows.map((row, index) => Number(row?.niveau ?? row?.level ?? index + 1) || 0).reduce((max, value) => Math.max(max, value), 0) || null;
  const rules = system.raceRestriction?.races;
  if (rules && typeof rules === "object") {
    const tags = add2eGetRaceTagsForLevelCap(actor);
    for (const [rawTag, rule] of Object.entries(rules)) {
      if (!tags.has(add2eMonkNorm(rawTag)) || rule?.allowed === false) continue;
      const racial = Number(rule?.maxLevel ?? rule?.niveauMax ?? rule?.max);
      if (Number.isFinite(racial) && racial > 0) maxLevel = maxLevel ? Math.min(maxLevel, racial) : racial;
    }
  }
  return Number.isFinite(maxLevel) && maxLevel > 0 ? Math.floor(maxLevel) : null;
}

function add2eClampLevelToClassMax(actor, desiredLevel, classItemOrSystem = null, { notify = false } = {}) {
  const requested = Math.max(1, Number.parseInt(desiredLevel, 10) || 1);
  const maximum = add2eGetClassMaxLevelForActor(actor, classItemOrSystem);
  const level = maximum && requested > maximum ? maximum : requested;
  if (notify && level !== requested) ui.notifications.warn(`${classItemOrSystem?.name ?? classItemOrSystem?.label ?? "Cette classe"} est limitée au niveau ${maximum}. Niveau ramené à ${maximum}.`);
  return { level, maxLevel: maximum, changed: level !== requested, original: requested };
}

async function add2eClampActorLevelToClassMax(actor, classItemOrSystem = null, options = {}) {
  if (!actor || actor.type !== "personnage") return null;
  const item = classItemOrSystem?.type === "classe" ? classItemOrSystem : (Array.from(actor.items ?? []).filter(entry => String(entry.type ?? "").toLowerCase() === "classe").length === 1 ? Array.from(actor.items).find(entry => String(entry.type ?? "").toLowerCase() === "classe") : null);
  if (!item) return null;
  const current = Number(item.system?.niveau);
  if (!Number.isFinite(current) || current < 1) return null;
  const clamp = add2eClampLevelToClassMax(actor, current, item, options);
  if (clamp.changed) await actor.updateEmbeddedDocuments("Item", [{ _id: item.id, "system.niveau": clamp.level }], { add2eInternal: true });
  return clamp;
}

function add2eMonkActorFromEmbeddedItem(item) {
  const parent = item?.parent ?? item?.actor ?? null;
  return parent?.documentName === "Actor" ? parent : null;
}

function add2eMonkIsClassItem(item) {
  return String(item?.type ?? "").toLowerCase() === "classe";
}

function add2eMonkClassUpdateRelevant(changes = {}) {
  if (!changes || typeof changes !== "object") return true;
  return foundry.utils.hasProperty(changes, "name")
    || foundry.utils.hasProperty(changes, "system.niveau")
    || foundry.utils.hasProperty(changes, "system.level")
    || foundry.utils.hasProperty(changes, "system.progression")
    || foundry.utils.hasProperty(changes, "system.tags")
    || foundry.utils.hasProperty(changes, "system.slug")
    || foundry.utils.hasProperty(changes, "system.label")
    || foundry.utils.hasProperty(changes, "system.nom")
    || foundry.utils.hasProperty(changes, "system.name")
    || foundry.utils.hasProperty(changes, "system.classFeatures");
}

function add2eQueueMonkUnarmedSync(actor, reason = "item-class-change") {
  if (!actor || actor.type !== "personnage") return false;
  if (!actor.isOwner && !game.user?.isGM) return false;
  const key = String(actor.uuid ?? actor.id ?? actor.name ?? "unknown");
  if (ADD2E_MONK_UNARMED_SYNC_LOCK.has(key)) return false;
  ADD2E_MONK_UNARMED_SYNC_LOCK.add(key);
  setTimeout(async () => {
    try { await add2eSyncMonkUnarmedWeapon(actor); }
    catch (error) { console.error("[ADD2E][MOINE][MAIN_NUE][SYNC_ERROR]", { actor: actor?.name, reason, error }); }
    finally { ADD2E_MONK_UNARMED_SYNC_LOCK.delete(key); }
  }, 0);
  return true;
}

function add2eQueueExistingMonksSync() {
  if (!game.user?.isGM) return;
  setTimeout(() => {
    for (const actor of game.actors?.contents ?? []) {
      if (actor?.type !== "personnage") continue;
      const hasMonk = !!add2eMonkClassItem(actor);
      const hasAutoUnarmed = Array.from(actor.items ?? []).some(add2eIsMonkAutoUnarmed);
      if (hasMonk || hasAutoUnarmed) add2eQueueMonkUnarmedSync(actor, "ready-existing-monk-sync");
    }
  }, 250);
}

function add2eRegisterMonkItemHooks() {
  if (globalThis.ADD2E_MONK_ITEM_HOOKS_REGISTERED === ADD2E_MONK_RULES_VERSION) return;
  globalThis.ADD2E_MONK_ITEM_HOOKS_REGISTERED = ADD2E_MONK_RULES_VERSION;

  Hooks.on("createItem", (item, _options = {}, userId = null) => {
    if (userId && game.user?.id !== userId) return;
    if (!add2eMonkIsClassItem(item)) return;
    add2eQueueMonkUnarmedSync(add2eMonkActorFromEmbeddedItem(item), "create-class-item");
  });

  Hooks.on("updateItem", (item, changes = {}, _options = {}, userId = null) => {
    if (userId && game.user?.id !== userId) return;
    if (!add2eMonkIsClassItem(item) || !add2eMonkClassUpdateRelevant(changes)) return;
    add2eQueueMonkUnarmedSync(add2eMonkActorFromEmbeddedItem(item), "update-class-item");
  });

  Hooks.on("deleteItem", (item, _options = {}, userId = null) => {
    if (userId && game.user?.id !== userId) return;
    if (!add2eMonkIsClassItem(item)) return;
    add2eQueueMonkUnarmedSync(add2eMonkActorFromEmbeddedItem(item), "delete-class-item");
  });

  if (game?.ready) add2eQueueExistingMonksSync();
  else Hooks.once("ready", add2eQueueExistingMonksSync);
}

globalThis.add2eGetMonkClassItem = add2eMonkClassItem;
globalThis.add2eGetMonkClassSystem = add2eGetMonkClassSystem;
globalThis.add2eGetMonkProgressionRow = add2eGetMonkProgressionRow;
globalThis.add2eMonkDamageParts = add2eMonkDamageParts;
globalThis.add2eIsMonkAutoUnarmed = add2eIsMonkAutoUnarmed;
globalThis.add2eSyncMonkUnarmedWeapon = add2eSyncMonkUnarmedWeapon;
globalThis.add2eEnsureMonkUnarmedAllowed = add2eEnsureMonkUnarmedAllowed;
globalThis.add2eCleanGeneratedMonkClassFeatures = add2eCleanGeneratedMonkClassFeatures;
globalThis.add2eGetRaceTagsForLevelCap = add2eGetRaceTagsForLevelCap;
globalThis.add2eGetClassMaxLevelForActor = add2eGetClassMaxLevelForActor;
globalThis.add2eClampLevelToClassMax = add2eClampLevelToClassMax;
globalThis.add2eClampActorLevelToClassMax = add2eClampActorLevelToClassMax;
globalThis.add2eQueueMonkUnarmedSync = add2eQueueMonkUnarmedSync;

add2eRegisterMonkItemHooks();
