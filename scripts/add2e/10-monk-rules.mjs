// ADD2E — Moine : mécanique liée à l'Item classe Moine.
// Compatible Foundry V13/V14/V15.

function add2eMonkNorm(value) {
  if (typeof globalThis.add2eNormalizeEquipTag === "function") return globalThis.add2eNormalizeEquipTag(value);
  return String(value ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
function add2eMonkClone(value) {
  try { return foundry.utils.deepClone(value ?? {}); } catch (_error) { return { ...(value ?? {}) }; }
}
function add2eMonkClassItem(actor) {
  return Array.from(actor?.items ?? []).find(item => {
    if (String(item?.type ?? "").toLowerCase() !== "classe") return false;
    const system = item.system ?? {};
    const label = add2eMonkNorm(item.name || system.slug || system.label || system.nom || system.name || "");
    const tags = (Array.isArray(system.tags) ? system.tags : []).map(add2eMonkNorm);
    return label === "moine" || label.includes("moine") || tags.includes("classe:moine");
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
  const system = item.system ?? {};
  const progression = Array.isArray(system.monkProgression) && system.monkProgression.length
    ? system.monkProgression
    : (Array.isArray(system.progression) ? system.progression : []);
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
function add2eIsMonkAutoUnarmed(item) {
  if (!item || String(item.type ?? "").toLowerCase() !== "arme") return false;
  const system = item.system ?? {};
  const name = add2eMonkNorm(item.name);
  return ["main_nue", "mainnue"].includes(name)
    || (system.add2eAutoCreated === true && add2eMonkNorm(system.sourceClasse) === "moine")
    || add2eMonkNorm(system.sourceCapacite) === "main_nue_moine";
}
async function add2eSyncMonkUnarmedWeapon(actor) {
  if (!actor || actor.type !== "personnage") return false;
  const monk = add2eMonkClassItem(actor);
  const existing = Array.from(actor.items ?? []).filter(add2eIsMonkAutoUnarmed);
  if (!monk) {
    if (existing.length) await actor.deleteEmbeddedDocuments("Item", existing.map(item => item.id), { add2eInternal: true });
    return false;
  }
  const row = add2eGetMonkProgressionRow(actor);
  if (!row) {
    console.warn("[ADD2E][MOINE][PROGRESSION_MISSING]", { actor: actor.name, classItemId: monk.id });
    return false;
  }
  const damage = add2eMonkDamageParts(row.unarmedDamage ?? row.main_nue ?? row.damage ?? actor.system?.moine?.main_nue);
  const system = {
    nom: "Main nue", equipee: true, categorie: "melee", type_degats: "contondant", type_arme: "main_nue", famille_arme: "main_nue",
    degats: damage.raw, "dégâts": { contre_moyen: damage.moyen, contre_grand: damage.grand }, bonus_hit: 0, bonus_dom: 0,
    facteur_rapidité: 1, portee_courte: 0, portee_moyenne: 0, portee_longue: 0,
    tags: ["arme", "arme:main_nue", "type_arme:main_nue", "famille_arme:main_nue", "usage:corps_a_corps", "degat:contondant", "combat:mains_nues", "classe:moine"],
    effectTags: ["arme", "arme:main_nue", "type_arme:main_nue", "usage:corps_a_corps", "degat:contondant", "classe:moine"],
    add2eAutoCreated: true, sourceClasse: "moine", sourceClassId: monk.id, sourceCapacite: "main_nue_moine"
  };
  await actor.update({
    "system.moine.main_nue": damage.raw,
    "system.moine.main_nue_contre_moyen": damage.moyen,
    "system.moine.main_nue_contre_grand": damage.grand
  }, { add2eInternal: true });
  if (existing.length) {
    const [first, ...duplicates] = existing;
    await actor.updateEmbeddedDocuments("Item", [{ _id: first.id, name: "Main nue", img: first.img || "icons/svg/fist.svg", system }], { add2eInternal: true });
    if (duplicates.length) await actor.deleteEmbeddedDocuments("Item", duplicates.map(item => item.id), { add2eInternal: true });
  } else {
    await actor.createEmbeddedDocuments("Item", [{ type: "arme", name: "Main nue", img: "icons/svg/fist.svg", system, flags: { add2e: { autoCreated: true, sourceClasse: "moine", sourceClassId: monk.id, sourceCapacite: "main_nue_moine" } } }], { add2eInternal: true });
  }
  return true;
}
function add2eGetRaceTagsForLevelCap(actor) {
  const tags = new Set();
  const push = value => { const tag = add2eMonkNorm(value); if (tag) tags.add(tag); };
  const pushAll = value => { if (Array.isArray(value)) value.forEach(pushAll); else if (value && typeof value === "object") Object.values(value).forEach(pushAll); else push(value); };
  for (const race of Array.from(actor?.items ?? []).filter(item => String(item.type ?? "").toLowerCase() === "race")) {
    push(`race:${race.system?.slug || race.name}`); pushAll(race.system?.tags); pushAll(race.system?.identityTags);
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

globalThis.add2eGetMonkClassItem = add2eMonkClassItem;
globalThis.add2eGetMonkClassSystem = add2eGetMonkClassSystem;
globalThis.add2eGetMonkProgressionRow = add2eGetMonkProgressionRow;
globalThis.add2eMonkDamageParts = add2eMonkDamageParts;
globalThis.add2eIsMonkAutoUnarmed = add2eIsMonkAutoUnarmed;
globalThis.add2eSyncMonkUnarmedWeapon = add2eSyncMonkUnarmedWeapon;
globalThis.add2eGetRaceTagsForLevelCap = add2eGetRaceTagsForLevelCap;
globalThis.add2eGetClassMaxLevelForActor = add2eGetClassMaxLevelForActor;
globalThis.add2eClampLevelToClassMax = add2eClampLevelToClassMax;
globalThis.add2eClampActorLevelToClassMax = add2eClampActorLevelToClassMax;