// ADD2E — Moine : synchronisation de l'arme virtuelle Main nue.
function add2eGetMonkClassSystem(actor) {
  const item = actor?.items?.find?.(i => i.type === "classe") ?? null;
  const sys = item?.system ?? {};
  const details = actor?.system?.details_classe ?? {};
  const label = add2eNormalizeEquipTag(item?.name || sys.label || details.label || details.name || actor?.system?.classe || "");
  const tags = [
    ...(Array.isArray(sys.tags) ? sys.tags : []),
    ...(Array.isArray(details.tags) ? details.tags : [])
  ].map(add2eNormalizeEquipTag);
  if (!label.includes("moine") && !tags.includes("classe:moine")) return null;
  return { ...add2eDeepClone(details), ...add2eDeepClone(sys) };
}

function add2eGetMonkProgressionRow(actor) {
  const cls = add2eGetMonkClassSystem(actor);
  if (!cls) return null;
  const level = Number(actor?.system?.niveau ?? 1) || 1;
  const prog = Array.isArray(cls.monkProgression) && cls.monkProgression.length
    ? cls.monkProgression
    : Array.isArray(cls.progression) ? cls.progression : [];
  return prog.find(r => Number(r.level ?? r.niveau) === level) ?? prog[level - 1] ?? prog[0] ?? null;
}

function add2eMonkDamageParts(raw) {
  if (raw && typeof raw === "object") raw = raw.raw ?? raw.value ?? raw.contre_moyen ?? raw.medium ?? raw.moyen;
  const parts = String(raw ?? "1d6/1d3").split(/[\/|]/).map(p => p.trim()).filter(Boolean);
  const moyen = parts[0] || "1d6";
  const grand = parts[1] || moyen;
  return { raw: `${moyen} / ${grand}`, moyen, grand };
}

function add2eIsMonkAutoUnarmed(item) {
  if (!item || item.type !== "arme") return false;
  const name = add2eNormalizeEquipTag(item.name);
  const sys = item.system ?? {};
  return ["main_nue", "mainnue"].includes(name)
    || (sys.add2eAutoCreated === true && add2eNormalizeEquipTag(sys.sourceClasse) === "moine")
    || add2eNormalizeEquipTag(sys.sourceCapacite) === "main_nue_moine";
}

async function add2eSyncMonkUnarmedWeapon(actor) {
  if (!actor || actor.type !== "personnage") return false;
  const cls = add2eGetMonkClassSystem(actor);
  const existing = actor.items?.filter?.(add2eIsMonkAutoUnarmed) ?? [];

  if (!cls) {
    if (existing.length) await actor.deleteEmbeddedDocuments("Item", existing.map(i => i.id));
    return false;
  }

  const row = add2eGetMonkProgressionRow(actor) ?? {};
  const dmg = add2eMonkDamageParts(row.unarmedDamage ?? row.main_nue ?? row.damage ?? actor.system?.moine?.main_nue);
  const system = {
    nom: "Main nue",
    equipee: true,
    categorie: "melee",
    type_degats: "contondant",
    type_arme: "main_nue",
    famille_arme: "main_nue",
    degats: dmg.raw,
    "dégâts": { contre_moyen: dmg.moyen, contre_grand: dmg.grand },
    bonus_hit: 0,
    bonus_dom: 0,
    facteur_rapidité: 1,
    portee_courte: 0,
    portee_moyenne: 0,
    portee_longue: 0,
    tags: ["arme", "arme:main_nue", "type_arme:main_nue", "famille_arme:main_nue", "usage:corps_a_corps", "degat:contondant", "combat:mains_nues", "classe:moine"],
    effectTags: ["arme", "arme:main_nue", "type_arme:main_nue", "usage:corps_a_corps", "degat:contondant", "classe:moine"],
    add2eAutoCreated: true,
    sourceClasse: "moine",
    sourceCapacite: "main_nue_moine"
  };

  await actor.update({
    "system.moine.main_nue": dmg.raw,
    "system.moine.main_nue_contre_moyen": dmg.moyen,
    "system.moine.main_nue_contre_grand": dmg.grand
  }, { add2eInternal: true });

  if (existing.length) {
    const [first, ...duplicates] = existing;
    await actor.updateEmbeddedDocuments("Item", [{ _id: first.id, name: "Main nue", img: first.img || "icons/svg/fist.svg", system }]);
    if (duplicates.length) await actor.deleteEmbeddedDocuments("Item", duplicates.map(i => i.id));
  } else {
    await actor.createEmbeddedDocuments("Item", [{ type: "arme", name: "Main nue", img: "icons/svg/fist.svg", system, flags: { add2e: { autoCreated: true, sourceClasse: "moine", sourceCapacite: "main_nue_moine" } } }]);
  }
  return true;
}

globalThis.add2eSyncMonkUnarmedWeapon = add2eSyncMonkUnarmedWeapon;


function add2eGetRaceTagsForLevelCap(actor) {
  const tags = new Set();
  const push = (value) => {
    const tag = add2eNormalizeEquipTag(value);
    if (tag) tags.add(tag);
  };
  const pushArray = (value) => {
    if (Array.isArray(value)) value.forEach(push);
    else if (value && typeof value === "object") Object.values(value).forEach(pushArray);
    else push(value);
  };

  const raceItems = actor?.items?.filter?.(i => i.type === "race") ?? [];
  for (const race of raceItems) {
    push(`race:${race.system?.slug || race.name}`);
    pushArray(race.system?.tags);
    pushArray(race.system?.identityTags);
  }

  const details = actor?.system?.details_race ?? {};
  push(`race:${details.slug || details.label || details.name || actor?.system?.race || ""}`);
  pushArray(details.tags);
  pushArray(details.identityTags);
  push(`race:${actor?.system?.race || ""}`);

  return tags;
}

function add2eGetClassMaxLevelForActor(actor, classSystem = null) {
  const cls = classSystem ?? add2eGetActorClassSystem(actor);
  if (!cls || typeof cls !== "object") return null;

  const progression = Array.isArray(cls.progression) ? cls.progression : [];
  const progressionMax = progression
    .map((row, index) => Number(row?.niveau ?? row?.level ?? index + 1) || 0)
    .filter(n => Number.isFinite(n) && n > 0)
    .reduce((max, n) => Math.max(max, n), 0);

  let maxLevel = progressionMax > 0 ? progressionMax : null;

  const raceRules = cls.raceRestriction?.races;
  if (raceRules && typeof raceRules === "object") {
    const raceTags = add2eGetRaceTagsForLevelCap(actor);
    for (const [rawTag, rule] of Object.entries(raceRules)) {
      const tag = add2eNormalizeEquipTag(rawTag);
      if (!tag || !raceTags.has(tag) || rule?.allowed === false) continue;
      const raceMax = Number(rule?.maxLevel ?? rule?.niveauMax ?? rule?.max);
      if (Number.isFinite(raceMax) && raceMax > 0) {
        maxLevel = maxLevel ? Math.min(maxLevel, raceMax) : raceMax;
      }
    }
  }

  return Number.isFinite(maxLevel) && maxLevel > 0 ? Math.floor(maxLevel) : null;
}

function add2eClampLevelToClassMax(actor, desiredLevel, classSystem = null, { notify = false } = {}) {
  const minLevel = 1;
  let level = Math.max(minLevel, Number.parseInt(desiredLevel, 10) || minLevel);
  const maxLevel = add2eGetClassMaxLevelForActor(actor, classSystem);

  if (maxLevel && level > maxLevel) {
    if (notify) {
      const clsName = classSystem?.label || classSystem?.name || classSystem?.nom || actor?.system?.classe || "cette classe";
      ui.notifications.warn(`${clsName} est limité au niveau ${maxLevel}. Niveau ramené à ${maxLevel}.`);
    }
    return { level: maxLevel, maxLevel, changed: true, original: level };
  }

  return { level, maxLevel, changed: false, original: level };
}

async function add2eClampActorLevelToClassMax(actor, classSystem = null, options = {}) {
  if (!actor || actor.type !== "personnage") return null;
  const clamp = add2eClampLevelToClassMax(actor, actor.system?.niveau, classSystem, options);
  if (clamp.changed) {
    await actor.update({ "system.niveau": clamp.level }, { add2eInternal: true });
    actor.sheet?.render?.(false);
  }
  return clamp;
}

globalThis.add2eGetClassMaxLevelForActor = add2eGetClassMaxLevelForActor;
globalThis.add2eClampActorLevelToClassMax = add2eClampActorLevelToClassMax;


// Anti-réentrée pour le recalcul auto des caracs
const ACTIVE_CARAC_AUTO = new Set();

// Exposition globale conservée pour compatibilité avec le code legacy et les scripts onUse.
try { globalThis.add2eGetMonkClassSystem = add2eGetMonkClassSystem; } catch (_e) {}
try { globalThis.add2eGetMonkProgressionRow = add2eGetMonkProgressionRow; } catch (_e) {}
try { globalThis.add2eMonkDamageParts = add2eMonkDamageParts; } catch (_e) {}
try { globalThis.add2eIsMonkAutoUnarmed = add2eIsMonkAutoUnarmed; } catch (_e) {}
try { globalThis.add2eSyncMonkUnarmedWeapon = add2eSyncMonkUnarmedWeapon; } catch (_e) {}
try { globalThis.add2eGetRaceTagsForLevelCap = add2eGetRaceTagsForLevelCap; } catch (_e) {}
try { globalThis.add2eGetClassMaxLevelForActor = add2eGetClassMaxLevelForActor; } catch (_e) {}
try { globalThis.add2eClampLevelToClassMax = add2eClampLevelToClassMax; } catch (_e) {}
try { globalThis.add2eClampActorLevelToClassMax = add2eClampActorLevelToClassMax; } catch (_e) {}
try { globalThis.ACTIVE_CARAC_AUTO = ACTIVE_CARAC_AUTO; } catch (_e) {}
