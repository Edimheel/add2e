// ADD2E — Pont mécanique multiclassage
// Version : 2026-06-10-multiclass-mechanics-v1
//
// Rôle : adapter les mécaniques historiques mono-classe au multiclassage sans réécrire
// les modules sources. Ce fichier est chargé après 17b-multiclass.mjs.

const VERSION = "2026-06-10-multiclass-mechanics-v1";
const TAG = "[ADD2E][MULTICLASSE][MECA]";

globalThis.ADD2E_MULTICLASS_MECHANICS_VERSION = VERSION;

function log(label, data = {}) { console.log(`${TAG}${label}`, data); }
function warn(label, data = {}) { console.warn(`${TAG}${label}`, data); }

function n(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function norm(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function arr(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(arr).filter(Boolean);
  if (typeof value === "string") return value.split(/[,;|\n/]+/).map(v => v.trim()).filter(Boolean);
  if (typeof value === "object") return Object.values(value).flatMap(arr).filter(Boolean);
  return [value];
}

function isMulticlassActor(actor) {
  return actor?.type === "personnage" && (actor.system?.multiclasse?.enabled === true || actor.items?.filter?.(i => String(i.type || "").toLowerCase() === "classe")?.length > 1);
}

function classSlug(itemOrSystem) {
  const sys = itemOrSystem?.system ?? itemOrSystem ?? {};
  return norm(sys.slug ?? sys.label ?? sys.nom ?? sys.name ?? itemOrSystem?.name ?? "classe");
}

function classItems(actor) {
  return actor?.items?.filter?.(i => String(i.type || "").toLowerCase() === "classe") ?? [];
}

function multiclassEntries(actor) {
  const xpMap = actor?.system?.xp_par_classe ?? {};
  const levelMap = actor?.system?.niveaux_par_classe ?? {};
  return classItems(actor).map(item => {
    const slug = classSlug(item);
    const level = Math.max(1, n(levelMap?.[slug] ?? item.system?.niveau ?? item.system?.level ?? actor.system?.niveau ?? 1, 1));
    const xp = Math.max(0, n(xpMap?.[slug] ?? item.system?.xp ?? 0, 0));
    const progression = Array.isArray(item.system?.progression) ? item.system.progression : [];
    const row = progression.find(r => n(r?.niveau ?? r?.level, 0) === level) ?? progression[level - 1] ?? {};
    return { item, system: item.system ?? {}, slug, name: item.name, level, xp, progression, row };
  });
}

function rowValue(row, keys, fallback = null) {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
}

function bestThac0(entries) {
  const values = entries
    .map(e => n(rowValue(e.row, ["thac0", "thaco", "tac0", "taco"], NaN), NaN))
    .filter(Number.isFinite);
  return values.length ? Math.min(...values) : null;
}

function bestSavingThrows(entries) {
  const rows = entries.map(e => rowValue(e.row, ["savingThrows", "sauvegardes", "saves"], null)).filter(v => Array.isArray(v));
  if (!rows.length) return null;
  const len = Math.max(...rows.map(r => r.length));
  const out = [];
  for (let i = 0; i < len; i++) {
    const values = rows.map(r => n(r[i], NaN)).filter(Number.isFinite);
    out[i] = values.length ? Math.min(...values) : "";
  }
  return out;
}

function add2eMulticlassProgressionRow(actor, classEntryOrKey = null) {
  if (!isMulticlassActor(actor)) {
    if (typeof globalThis.__add2eOriginalGetProgressionRowForActor === "function") return globalThis.__add2eOriginalGetProgressionRowForActor(actor);
    return {};
  }
  const entries = multiclassEntries(actor);
  const wanted = norm(classEntryOrKey?.key ?? classEntryOrKey?.slug ?? classEntryOrKey?.classSlug ?? classEntryOrKey ?? "");
  if (wanted) {
    const entry = entries.find(e => e.slug === wanted || norm(e.name) === wanted || norm(e.system?.spellcasting?.key) === wanted || arr(e.system?.spellcasting?.lists).map(norm).includes(wanted));
    if (entry) return entry.row ?? {};
  }
  return {
    thac0: bestThac0(entries) ?? actor.system?.thaco ?? 20,
    savingThrows: bestSavingThrows(entries) ?? actor.system?.sauvegardes ?? [],
    _add2eMulticlassComposite: true
  };
}

function spellcastingEntriesForClass(entry) {
  const casting = entry.system?.spellcasting;
  if (!casting || typeof casting !== "object" || casting.enabled === false) return [];
  const rawEntries = Array.isArray(casting.entries) ? casting.entries : Array.isArray(casting.pools) ? casting.pools : null;
  const sourceKey = entry.slug;
  if (rawEntries) {
    return rawEntries.map((e, index) => {
      const rawKey = e.key ?? e.list ?? e.liste ?? e.name ?? e.label ?? e.type;
      const key = typeof add2eNormalizeSpellKey === "function" ? add2eNormalizeSpellKey(rawKey) : norm(rawKey);
      return {
        ...e,
        index,
        key,
        label: e.label || (typeof add2eSpellLabel === "function" ? add2eSpellLabel(key) : key),
        startsAt: n(e.startsAt ?? e.startLevel ?? e.niveauDepart ?? casting.startsAt ?? 1, 1),
        maxSpellLevel: n(e.maxSpellLevel ?? e.maxLevel ?? e.maxNiveauSort ?? casting.maxSpellLevel ?? 0, 0),
        slotsField: e.slotsField || e.slotField || e.progressionField || null,
        classSlug: sourceKey,
        className: entry.name,
        classLevel: entry.level
      };
    }).filter(e => e.key);
  }

  const lists = arr(casting.lists).map(v => typeof add2eNormalizeSpellKey === "function" ? add2eNormalizeSpellKey(v) : norm(v)).filter(Boolean);
  return [...new Set(lists)].map((key, index) => ({
    index,
    key,
    label: typeof add2eSpellLabel === "function" ? add2eSpellLabel(key) : key,
    startsAt: n(casting.startsAt ?? 1, 1),
    maxSpellLevel: n(casting.maxSpellLevel ?? 0, 0),
    slotsField: null,
    notes: casting.notes || "",
    classSlug: sourceKey,
    className: entry.name,
    classLevel: entry.level
  }));
}

function add2eMulticlassSpellcastingEntries(actor) {
  if (!isMulticlassActor(actor)) {
    if (typeof globalThis.__add2eOriginalGetSpellcastingEntries === "function") return globalThis.__add2eOriginalGetSpellcastingEntries(actor);
    return [];
  }
  const seen = new Set();
  const out = [];
  for (const entry of multiclassEntries(actor)) {
    for (const spellEntry of spellcastingEntriesForClass(entry)) {
      const unique = `${spellEntry.classSlug}|${spellEntry.key}`;
      if (seen.has(unique)) continue;
      seen.add(unique);
      out.push(spellEntry);
    }
  }
  return out;
}

function slotValue(raw, spellLevel, key) {
  if (typeof add2eSpellSyncReadSlotValue === "function") return add2eSpellSyncReadSlotValue(raw, spellLevel, key);
  if (Array.isArray(raw)) return n(raw[spellLevel - 1], 0);
  if (raw && typeof raw === "object") return n(raw[spellLevel] ?? raw[String(spellLevel)] ?? raw[`niveau${spellLevel}`], 0);
  return null;
}

function add2eMulticlassSlotsForEntryLevel(actor, spellEntry, spellLevel) {
  if (!isMulticlassActor(actor)) {
    if (typeof globalThis.__add2eOriginalGetSlotsForEntryLevel === "function") return globalThis.__add2eOriginalGetSlotsForEntryLevel(actor, spellEntry, spellLevel);
    return 0;
  }
  const key = typeof add2eNormalizeSpellKey === "function" ? add2eNormalizeSpellKey(spellEntry?.key) : norm(spellEntry?.key);
  const entry = multiclassEntries(actor).find(e => e.slug === spellEntry?.classSlug) ?? multiclassEntries(actor).find(e => spellcastingEntriesForClass(e).some(se => se.key === key)) ?? null;
  const row = entry?.row ?? {};
  const label = spellEntry?.label || (typeof add2eSpellLabel === "function" ? add2eSpellLabel(key) : key);

  for (const containerName of ["spellSlotsByList", "spellsByList", "spellsPerLevelByList", "sortsParListe"]) {
    const c = row?.[containerName];
    if (!c || typeof c !== "object") continue;
    for (const [rawContainerKey, value] of Object.entries(c)) {
      const normalized = typeof add2eNormalizeSpellKey === "function" ? add2eNormalizeSpellKey(rawContainerKey) : norm(rawContainerKey);
      if (normalized !== key) continue;
      const v = slotValue(value, Number(spellLevel), key);
      if (v !== null) return v;
    }
  }

  const directFields = [
    spellEntry?.slotsField,
    `spellsPerLevel_${key}`,
    `spellsPerLevel${label}`,
    `spellsPerLevel${String(label).replace(/\s+/g, "")}`,
    key === "druide" ? "spellsPerLevelDruide" : null,
    key === "magicien" ? "spellsPerLevelMagicien" : null,
    key === "clerc" ? "spellsPerLevelClerc" : null,
    key === "illusionniste" ? "spellsPerLevelIllusionniste" : null
  ].filter(Boolean);

  for (const field of directFields) {
    const v = slotValue(row?.[field], Number(spellLevel), key);
    if (v !== null) return v;
  }

  const v = slotValue(row?.spellsPerLevel, Number(spellLevel), key) ?? slotValue(row?.sortsParNiveau, Number(spellLevel), key);
  return v ?? 0;
}

function add2eMulticlassSpellSlotPoolsByLevel(actor) {
  if (!isMulticlassActor(actor)) {
    if (typeof globalThis.__add2eOriginalGetSpellSlotPoolsByLevel === "function") return globalThis.__add2eOriginalGetSpellSlotPoolsByLevel(actor);
    return {};
  }
  const entries = add2eMulticlassSpellcastingEntries(actor);
  const pools = {};
  for (const entry of entries) {
    const slotsByLevel = {};
    const maxSpellLevel = n(entry.maxSpellLevel, 9) || 9;
    const actorLevel = n(entry.classLevel, 1);
    for (let lvl = 1; lvl <= maxSpellLevel; lvl++) {
      slotsByLevel[lvl] = actorLevel >= n(entry.startsAt, 1) ? add2eMulticlassSlotsForEntryLevel(actor, entry, lvl) : 0;
    }
    const poolKey = `${entry.classSlug}:${entry.key}`;
    pools[poolKey] = { ...entry, poolKey, slotsByLevel };
  }
  return pools;
}

function add2eMulticlassSpellEntryForSpell(actor, sort) {
  if (!isMulticlassActor(actor)) {
    if (typeof globalThis.__add2eOriginalGetSpellEntryForSpell === "function") return globalThis.__add2eOriginalGetSpellEntryForSpell(actor, sort);
    return null;
  }
  if (typeof add2eIsObjectMagicSpellForPreparation === "function" && add2eIsObjectMagicSpellForPreparation(sort)) return null;
  const spellLevel = n(sort?.system?.niveau ?? sort?.system?.level, 0);
  const sortLists = typeof add2eGetSpellListsFromItem === "function" ? add2eGetSpellListsFromItem(sort) : arr(sort?.system?.spellLists).map(norm);
  const matches = add2eMulticlassSpellcastingEntries(actor).filter(e => sortLists.includes(e.key));
  if (!matches.length) return null;
  return matches.find(e => n(e.classLevel, 1) >= n(e.startsAt, 1) && (!n(e.maxSpellLevel, 0) || spellLevel <= n(e.maxSpellLevel, 0))) ?? matches[0] ?? null;
}

function add2eMulticlassCanUseSpell(actor, sort) {
  if (!isMulticlassActor(actor)) {
    if (typeof globalThis.__add2eOriginalCanActorUseSpell === "function") return globalThis.__add2eOriginalCanActorUseSpell(actor, sort);
    return { ok: false, reason: "missing-original" };
  }
  if (typeof add2eIsObjectMagicSpellForPreparation === "function" && add2eIsObjectMagicSpellForPreparation(sort)) return { ok: false, reason: "object-power", sortLists: [], entries: add2eMulticlassSpellcastingEntries(actor), entry: null };
  const spellLevel = n(sort?.system?.niveau ?? sort?.system?.level, 0);
  const sortLists = typeof add2eGetSpellListsFromItem === "function" ? add2eGetSpellListsFromItem(sort) : arr(sort?.system?.spellLists).map(norm);
  const entries = add2eMulticlassSpellcastingEntries(actor);
  const matching = entries.filter(e => sortLists.includes(e.key));
  if (!matching.length) return { ok: false, reason: "list", sortLists, entries, entry: null };
  for (const entry of matching) {
    if (n(entry.classLevel, 1) < n(entry.startsAt, 1)) continue;
    if (n(entry.maxSpellLevel, 0) && spellLevel > n(entry.maxSpellLevel, 0)) continue;
    return { ok: true, reason: "ok", sortLists, entries, entry, actorLevel: entry.classLevel, classLevel: entry.classLevel, spellLevel };
  }
  return { ok: false, reason: "level", sortLists, entries, entry: matching[0] ?? null, spellLevel };
}

function featureLevel(feature, actor) {
  const sourceSlug = norm(feature?._add2eClassSlug ?? feature?.classSlug ?? feature?.sourceClassSlug ?? "");
  if (sourceSlug) return n(actor?.system?.niveaux_par_classe?.[sourceSlug], actor?.system?.niveau ?? 1);
  return n(actor?.system?.niveau, 1);
}

function sourceFeaturesFromSystem(system, source) {
  const out = [];
  const push = value => {
    const list = typeof add2eToClassFeatureArray === "function" ? add2eToClassFeatureArray(value) : arr(value).filter(v => v && typeof v === "object");
    for (const feature of list) out.push({ ...feature, _add2eFeatureSource: feature?._add2eFeatureSource ?? source });
  };
  push(system?.activeClassFeatures);
  push(system?.activableClassFeatures);
  push(system?.classFeaturesActives);
  push(system?.capacitesActives);
  push(system?.capacitesActivables);
  push(system?.classFeatures);
  push(system?.classFeaturesDebloquees);
  push(system?.capacitesClasse);
  push(system?.passiveClassFeatures);
  push(system?.passiveFeatures);
  push(system?.capacitesPassives);
  return out;
}

function add2eMulticlassActorClassFeatures(actor) {
  if (!isMulticlassActor(actor)) {
    if (typeof globalThis.__add2eOriginalGetActorClassFeatures === "function") return globalThis.__add2eOriginalGetActorClassFeatures(actor);
    return [];
  }
  const out = [];
  const seen = new Set();
  for (const entry of multiclassEntries(actor)) {
    for (const feature of sourceFeaturesFromSystem(entry.system, entry.name)) {
      const key = typeof add2eFeatureKey === "function" ? add2eFeatureKey(feature) : norm(feature?.key ?? feature?.name);
      const onUse = typeof add2eFeatureOnUse === "function" ? add2eFeatureOnUse(feature) : String(feature?.on_use ?? feature?.onUse ?? "");
      const unique = `${entry.slug}|${key}|${onUse}`;
      if (!key && !onUse) continue;
      if (seen.has(unique)) continue;
      seen.add(unique);
      out.push({ ...feature, _add2eClassSlug: entry.slug, _add2eClassName: entry.name, _add2eClassLevel: entry.level });
    }
  }
  return out;
}

function add2eMulticlassActivableClassFeatures(actor, { includeLocked = true } = {}) {
  return add2eMulticlassActorClassFeatures(actor).filter(f => {
    const activable = typeof add2eIsFeatureActivable === "function" ? add2eIsFeatureActivable(f) : !!f.activable;
    if (!activable) return false;
    if (includeLocked) return true;
    const level = featureLevel(f, actor);
    const min = typeof add2eFeatureMinLevel === "function" ? add2eFeatureMinLevel(f) : n(f.minLevel ?? f.niveauMin ?? 1, 1);
    const max = typeof add2eFeatureMaxLevel === "function" ? add2eFeatureMaxLevel(f) : n(f.maxLevel ?? f.niveauMax ?? 999, 999);
    return level >= min && level <= max;
  });
}

function add2eMulticlassPassiveClassFeatures(actor, { includeLocked = true } = {}) {
  return add2eMulticlassActorClassFeatures(actor).filter(f => {
    const activable = typeof add2eIsFeatureActivable === "function" ? add2eIsFeatureActivable(f) : !!f.activable;
    if (activable) return false;
    if (includeLocked) return true;
    const level = featureLevel(f, actor);
    const min = typeof add2eFeatureMinLevel === "function" ? add2eFeatureMinLevel(f) : n(f.minLevel ?? f.niveauMin ?? 1, 1);
    const max = typeof add2eFeatureMaxLevel === "function" ? add2eFeatureMaxLevel(f) : n(f.maxLevel ?? f.niveauMax ?? 999, 999);
    return level >= min && level <= max;
  });
}

function mergeRestrictions(base, added) {
  const out = foundry.utils.deepClone(base ?? {});
  out.allowedTags = [...new Set([...arr(out.allowedTags), ...arr(added?.allowedTags)].map(v => typeof add2eNormalizeEquipTag === "function" ? add2eNormalizeEquipTag(v) : norm(v)).filter(Boolean))];
  out.forbiddenTags = [...new Set([...arr(out.forbiddenTags), ...arr(added?.forbiddenTags)].map(v => typeof add2eNormalizeEquipTag === "function" ? add2eNormalizeEquipTag(v) : norm(v)).filter(Boolean))];
  out.overrideForbiddenTags = [...new Set([...arr(out.overrideForbiddenTags), ...arr(added?.overrideForbiddenTags), ...arr(added?.exceptionTags), ...arr(added?.alwaysAllowedTags)].map(v => typeof add2eNormalizeEquipTag === "function" ? add2eNormalizeEquipTag(v) : norm(v)).filter(Boolean))];
  return out;
}

function multiclassEquipmentAllowed(actor, item, kind) {
  if (!isMulticlassActor(actor)) {
    if (typeof globalThis.__add2eOriginalCheckEquipmentAllowedForClass === "function") return globalThis.__add2eOriginalCheckEquipmentAllowedForClass(actor, item, kind);
    return { ok: true, reason: "missing-original" };
  }
  const checks = [];
  for (const entry of multiclassEntries(actor)) {
    const fakeActor = { ...actor, system: { ...(actor.system ?? {}), classe: entry.name, details_classe: entry.system } };
    let check = null;
    if (typeof globalThis.__add2eOriginalCheckEquipmentAllowedForClass === "function") check = globalThis.__add2eOriginalCheckEquipmentAllowedForClass(fakeActor, item, kind);
    else check = { ok: true, reason: "no-original" };
    checks.push({ ...check, classSlug: entry.slug, classeLabel: entry.name });
  }

  const okChecks = checks.filter(c => c.ok);
  return okChecks.length
    ? { ...okChecks[0], ok: true, reason: "multiclass-any-class", checks, classeLabel: okChecks.map(c => c.classeLabel).join(" / ") }
    : { ...checks[0], ok: false, reason: "multiclass-no-class-allows", checks, classeLabel: checks.map(c => c.classeLabel).join(" / ") };
}

function installGlobalPatches() {
  if (!globalThis.__add2eOriginalGetProgressionRowForActor && typeof globalThis.add2eGetProgressionRowForActor === "function") globalThis.__add2eOriginalGetProgressionRowForActor = globalThis.add2eGetProgressionRowForActor;
  if (!globalThis.__add2eOriginalGetSpellcastingEntries && typeof globalThis.add2eGetSpellcastingEntries === "function") globalThis.__add2eOriginalGetSpellcastingEntries = globalThis.add2eGetSpellcastingEntries;
  if (!globalThis.__add2eOriginalGetSlotsForEntryLevel && typeof globalThis.add2eGetSlotsForEntryLevel === "function") globalThis.__add2eOriginalGetSlotsForEntryLevel = globalThis.add2eGetSlotsForEntryLevel;
  if (!globalThis.__add2eOriginalGetSpellSlotPoolsByLevel && typeof globalThis.add2eGetSpellSlotPoolsByLevel === "function") globalThis.__add2eOriginalGetSpellSlotPoolsByLevel = globalThis.add2eGetSpellSlotPoolsByLevel;
  if (!globalThis.__add2eOriginalGetSpellEntryForSpell && typeof globalThis.add2eGetSpellEntryForSpell === "function") globalThis.__add2eOriginalGetSpellEntryForSpell = globalThis.add2eGetSpellEntryForSpell;
  if (!globalThis.__add2eOriginalCanActorUseSpell && typeof globalThis.add2eCanActorUseSpell === "function") globalThis.__add2eOriginalCanActorUseSpell = globalThis.add2eCanActorUseSpell;
  if (!globalThis.__add2eOriginalGetActorClassFeatures && typeof globalThis.add2eGetActorClassFeatures === "function") globalThis.__add2eOriginalGetActorClassFeatures = globalThis.add2eGetActorClassFeatures;
  if (!globalThis.__add2eOriginalGetActorActivableClassFeatures && typeof globalThis.add2eGetActorActivableClassFeatures === "function") globalThis.__add2eOriginalGetActorActivableClassFeatures = globalThis.add2eGetActorActivableClassFeatures;
  if (!globalThis.__add2eOriginalGetActorPassiveClassFeatures && typeof globalThis.add2eGetActorPassiveClassFeatures === "function") globalThis.__add2eOriginalGetActorPassiveClassFeatures = globalThis.add2eGetActorPassiveClassFeatures;
  if (!globalThis.__add2eOriginalCheckEquipmentAllowedForClass && typeof globalThis.add2eCheckEquipmentAllowedForClass === "function") globalThis.__add2eOriginalCheckEquipmentAllowedForClass = globalThis.add2eCheckEquipmentAllowedForClass;

  globalThis.add2eGetProgressionRowForActor = add2eMulticlassProgressionRow;
  globalThis.add2eGetSpellcastingEntries = add2eMulticlassSpellcastingEntries;
  globalThis.add2eGetSlotsForEntryLevel = add2eMulticlassSlotsForEntryLevel;
  globalThis.add2eGetSpellSlotPoolsByLevel = add2eMulticlassSpellSlotPoolsByLevel;
  globalThis.add2eGetSpellEntryForSpell = add2eMulticlassSpellEntryForSpell;
  globalThis.add2eCanActorUseSpell = add2eMulticlassCanUseSpell;
  globalThis.add2eGetActorClassFeatures = add2eMulticlassActorClassFeatures;
  globalThis.add2eGetActorActivableClassFeatures = add2eMulticlassActivableClassFeatures;
  globalThis.add2eGetActorPassiveClassFeatures = add2eMulticlassPassiveClassFeatures;
  globalThis.add2eCheckEquipmentAllowedForClass = multiclassEquipmentAllowed;

  log("[GLOBAL_PATCHES_INSTALLED]", { version: VERSION });
}

function installSheetPatch() {
  const proto = globalThis.Add2eActorSheet?.prototype;
  if (!proto || proto.__add2eMulticlassMechanicsPatch === VERSION) return false;

  if (typeof proto.autoSetPointsDeCoup === "function" && !proto.__add2eOriginalAutoSetPointsDeCoup) {
    proto.__add2eOriginalAutoSetPointsDeCoup = proto.autoSetPointsDeCoup;
    proto.autoSetPointsDeCoup = async function add2eMulticlassAutoSetPointsDeCoup({ syncCurrent = false, force = false, reason = "multiclass" } = {}) {
      const actor = this.actor;
      if (!isMulticlassActor(actor)) return this.__add2eOriginalAutoSetPointsDeCoup({ syncCurrent, force, reason });
      const entries = multiclassEntries(actor);
      if (!entries.length) return;
      const maxLevel = Math.max(...entries.map(e => e.level));
      const conBonus = n(actor.system?.con_pv, 0);
      let hpRolls = Array.isArray(actor.system?.hpRollsMulticlass) && !force ? foundry.utils.deepClone(actor.system.hpRollsMulticlass) : [];
      let hpMax = 0;
      for (let levelIndex = 0; levelIndex < maxLevel; levelIndex++) {
        let levelHp = 0;
        let classCount = 0;
        for (const entry of entries) {
          if (entry.level <= levelIndex) continue;
          const hitDie = n(entry.system?.hitDie ?? entry.system?.dv, 0);
          if (!hitDie) continue;
          hpRolls[levelIndex] ??= {};
          let roll = n(hpRolls[levelIndex]?.[entry.slug], NaN);
          if (!Number.isFinite(roll) || roll < 1 || roll > hitDie || (force && levelIndex > 0)) {
            roll = levelIndex === 0 ? hitDie : 1 + Math.floor(Math.random() * hitDie);
            hpRolls[levelIndex][entry.slug] = roll;
          }
          levelHp += roll;
          classCount += 1;
        }
        if (classCount > 0) hpMax += Math.max(1, Math.ceil(levelHp / classCount)) + conBonus;
      }
      hpMax = Math.max(1, Math.floor(hpMax));
      const up = { "system.hpRollsMulticlass": hpRolls, "system.points_de_coup": hpMax };
      if (syncCurrent) up["system.pdv"] = hpMax;
      await actor.update(up, { add2eInternal: true, reason });
    };
  }

  if (typeof proto.getData === "function" && !proto.__add2eOriginalMulticlassMechanicsGetData) {
    const originalGetData = proto.getData;
    proto.__add2eOriginalMulticlassMechanicsGetData = originalGetData;
    proto.getData = async function add2eMulticlassMechanicsGetData(...args) {
      const data = await originalGetData.apply(this, args);
      const actor = this.actor;
      if (!isMulticlassActor(actor)) return data;
      const entries = multiclassEntries(actor);
      const thaco = bestThac0(entries);
      const saves = bestSavingThrows(entries);
      data.combatDefense = data.combatDefense ?? {};
      if (thaco !== null) data.combatDefense.thaco = thaco;
      if (saves) data.actor.system.sauvegardes = saves;

      const levelForFeature = feature => featureLevel(feature, actor);
      const allFeatures = add2eMulticlassActorClassFeatures(actor).map((feature, index) => ({ ...feature, __featureIndex: index }));
      const inLevel = feature => {
        const level = levelForFeature(feature);
        const min = typeof add2eFeatureMinLevel === "function" ? add2eFeatureMinLevel(feature) : n(feature.minLevel ?? feature.niveauMin ?? 1, 1);
        const max = typeof add2eFeatureMaxLevel === "function" ? add2eFeatureMaxLevel(feature) : n(feature.maxLevel ?? feature.niveauMax ?? 999, 999);
        return level >= min && level <= max;
      };
      data.activeClassFeatures = allFeatures.filter(feature => (typeof add2eIsFeatureActivable === "function" ? add2eIsFeatureActivable(feature) : !!feature.activable) && inLevel(feature));
      data.passiveClassFeatures = allFeatures.filter(feature => !(typeof add2eIsFeatureActivable === "function" ? add2eIsFeatureActivable(feature) : !!feature.activable) && inLevel(feature));
      data.progressionCourante = { ...(data.progressionCourante ?? {}), thac0: thaco ?? data.progressionCourante?.thac0, savingThrows: saves ?? data.progressionCourante?.savingThrows, title: actor.system?.titre ?? data.progressionCourante?.title ?? "" };
      data.spellcastingEntries = add2eMulticlassSpellcastingEntries(actor);
      data.spellSlotsByPool = add2eMulticlassSpellSlotPoolsByLevel(actor);
      return data;
    };
  }

  proto.__add2eMulticlassMechanicsPatch = VERSION;
  log("[SHEET_PATCH_INSTALLED]", { version: VERSION });
  return true;
}

installGlobalPatches();
installSheetPatch();
Hooks.once("ready", () => {
  installGlobalPatches();
  installSheetPatch();
});

try { globalThis.add2eMulticlassEntries = multiclassEntries; } catch (_e) {}
try { globalThis.add2eMulticlassBestThac0 = actor => bestThac0(multiclassEntries(actor)); } catch (_e) {}
try { globalThis.add2eMulticlassBestSavingThrows = actor => bestSavingThrows(multiclassEntries(actor)); } catch (_e) {}

log("[LOADED]", { version: VERSION });
