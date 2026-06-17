// ADD2E — Pont mécanique multiclassage
// Version : 2026-06-12-multiclass-mechanics-v3-exceptional-strength-any-order
//
// Rôle : adapter les mécaniques historiques mono-classe au multiclassage sans réécrire
// les modules sources. Les sorts sont regroupés par liste réelle : clerc, druide,
// magicien, illusionniste. Les niveaux de sorts affichables sont bornés par les
// emplacements réellement disponibles au niveau courant de chaque classe.

const VERSION = "2026-06-12-multiclass-mechanics-v3-exceptional-strength-any-order";
const TAG = "[ADD2E][MULTICLASSE][MECA]";

globalThis.ADD2E_MULTICLASS_MECHANICS_VERSION = VERSION;

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

function spellKey(value) {
  return typeof globalThis.add2eNormalizeSpellKey === "function" ? globalThis.add2eNormalizeSpellKey(value) : norm(value);
}

function spellLabel(value) {
  return typeof globalThis.add2eSpellLabel === "function" ? globalThis.add2eSpellLabel(value) : String(value ?? "");
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

function isExceptionalStrengthClass(entry) {
  const sys = entry?.system ?? {};
  const text = [
    entry?.slug,
    entry?.name,
    sys.slug,
    sys.label,
    sys.nom,
    sys.name,
    sys.classe,
    sys.class
  ].map(norm).join(" ");
  return text.includes("guerrier") || text.includes("paladin") || text.includes("rodeur") || text.includes("ranger");
}

function actorCanUseExceptionalStrength(actor, entries = null) {
  const force = Number(actor?.system?.force ?? 0);
  if (force !== 18) return false;
  const list = entries ?? multiclassEntries(actor);
  return list.some(isExceptionalStrengthClass);
}

function rowValue(row, keys, fallback = null) {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
}

function bestThac0(entries) {
  const values = entries.map(e => n(rowValue(e.row, ["thac0", "thaco", "tac0", "taco"], NaN), NaN)).filter(Number.isFinite);
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
    const entry = entries.find(e => e.slug === wanted || norm(e.name) === wanted || spellcastingEntriesForClass(e).some(se => se.key === wanted || se.classSlug === wanted));
    if (entry) return entry.row ?? {};
  }
  return { thac0: bestThac0(entries) ?? actor.system?.thaco ?? 20, savingThrows: bestSavingThrows(entries) ?? actor.system?.sauvegardes ?? [], _add2eMulticlassComposite: true };
}

function slotValue(raw, spellLevel, key) {
  if (typeof globalThis.add2eSpellSyncReadSlotValue === "function") return globalThis.add2eSpellSyncReadSlotValue(raw, spellLevel, key);
  if (Array.isArray(raw)) return n(raw[spellLevel - 1], 0);
  if (raw && typeof raw === "object") return n(raw[spellLevel] ?? raw[String(spellLevel)] ?? raw[`niveau${spellLevel}`], 0);
  return null;
}

function slotsFromRow(row, spellEntry, spellLevel) {
  const key = spellKey(spellEntry?.key);
  const label = spellEntry?.label || spellLabel(key);

  for (const containerName of ["spellSlotsByList", "spellsByList", "spellsPerLevelByList", "sortsParListe"]) {
    const c = row?.[containerName];
    if (!c || typeof c !== "object") continue;
    for (const [rawContainerKey, value] of Object.entries(c)) {
      if (spellKey(rawContainerKey) !== key) continue;
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

function currentMaxSpellLevelForSource(entry, spellEntry) {
  const startsAt = n(spellEntry.startsAt, 1);
  if (entry.level < startsAt) return 0;
  const declaredMax = n(spellEntry.maxSpellLevel, 0) || 9;
  let max = 0;
  for (let lvl = 1; lvl <= declaredMax; lvl++) {
    if (slotsFromRow(entry.row, spellEntry, lvl) > 0) max = lvl;
  }
  return max;
}

function spellcastingEntriesForClass(entry) {
  const casting = entry.system?.spellcasting;
  if (!casting || typeof casting !== "object" || casting.enabled === false) return [];
  const rawEntries = Array.isArray(casting.entries) ? casting.entries : Array.isArray(casting.pools) ? casting.pools : null;
  const sourceKey = entry.slug;
  const makeEntry = (raw, index) => {
    const rawKey = raw?.key ?? raw?.list ?? raw?.liste ?? raw?.name ?? raw?.label ?? raw?.type;
    const key = spellKey(rawKey);
    const out = {
      ...(raw ?? {}),
      index,
      key,
      label: raw?.label || spellLabel(key),
      startsAt: n(raw?.startsAt ?? raw?.startLevel ?? raw?.niveauDepart ?? casting.startsAt ?? 1, 1),
      maxSpellLevel: n(raw?.maxSpellLevel ?? raw?.maxLevel ?? raw?.maxNiveauSort ?? casting.maxSpellLevel ?? 0, 0),
      slotsField: raw?.slotsField || raw?.slotField || raw?.progressionField || null,
      classSlug: sourceKey,
      className: entry.name,
      classLevel: entry.level
    };
    out.currentMaxSpellLevel = currentMaxSpellLevelForSource(entry, out);
    return out;
  };

  if (rawEntries) return rawEntries.map(makeEntry).filter(e => e.key);

  const lists = arr(casting.lists).map(spellKey).filter(Boolean);
  return [...new Set(lists)].map((key, index) => makeEntry({ key, label: spellLabel(key), startsAt: casting.startsAt, maxSpellLevel: casting.maxSpellLevel }, index));
}

function mergeSpellEntriesByList(entries) {
  const byKey = new Map();
  for (const source of entries) {
    const key = spellKey(source.key);
    if (!key) continue;
    if (!byKey.has(key)) {
      byKey.set(key, {
        ...source,
        key,
        poolKey: key,
        label: spellLabel(key),
        classSlug: null,
        className: null,
        classLevel: 0,
        startsAt: 999,
        maxSpellLevel: 0,
        currentMaxSpellLevel: 0,
        sources: []
      });
    }
    const merged = byKey.get(key);
    merged.sources.push(source);
    merged.classLevel = Math.max(n(merged.classLevel, 0), n(source.classLevel, 0));
    merged.startsAt = Math.min(n(merged.startsAt, 999), n(source.startsAt, 1));
    merged.maxSpellLevel = Math.max(n(merged.maxSpellLevel, 0), n(source.currentMaxSpellLevel, 0));
    merged.currentMaxSpellLevel = merged.maxSpellLevel;
  }
  return [...byKey.values()].filter(e => e.maxSpellLevel > 0 || e.sources.some(s => n(s.classLevel, 1) >= n(s.startsAt, 1)));
}

function add2eMulticlassSpellcastingEntries(actor) {
  if (!isMulticlassActor(actor)) {
    if (typeof globalThis.__add2eOriginalGetSpellcastingEntries === "function") return globalThis.__add2eOriginalGetSpellcastingEntries(actor);
    return [];
  }
  const sources = [];
  for (const entry of multiclassEntries(actor)) sources.push(...spellcastingEntriesForClass(entry));
  return mergeSpellEntriesByList(sources);
}

function add2eMulticlassSlotsForEntryLevel(actor, spellEntry, spellLevel) {
  if (!isMulticlassActor(actor)) {
    if (typeof globalThis.__add2eOriginalGetSlotsForEntryLevel === "function") return globalThis.__add2eOriginalGetSlotsForEntryLevel(actor, spellEntry, spellLevel);
    return 0;
  }
  const sources = Array.isArray(spellEntry?.sources) && spellEntry.sources.length ? spellEntry.sources : [spellEntry];
  let total = 0;
  for (const source of sources) {
    const entry = multiclassEntries(actor).find(e => e.slug === source?.classSlug) ?? null;
    if (!entry) continue;
    if (entry.level < n(source.startsAt, 1)) continue;
    const declaredMax = n(source.maxSpellLevel, 0) || 9;
    if (declaredMax && Number(spellLevel) > declaredMax) continue;
    total += slotsFromRow(entry.row, source, Number(spellLevel));
  }
  return total;
}

function add2eMulticlassSpellSlotPoolsByLevel(actor) {
  if (!isMulticlassActor(actor)) {
    if (typeof globalThis.__add2eOriginalGetSpellSlotPoolsByLevel === "function") return globalThis.__add2eOriginalGetSpellSlotPoolsByLevel(actor);
    return {};
  }
  const pools = {};
  for (const entry of add2eMulticlassSpellcastingEntries(actor)) {
    const slotsByLevel = {};
    const maxSpellLevel = n(entry.maxSpellLevel, 0);
    for (let lvl = 1; lvl <= maxSpellLevel; lvl++) slotsByLevel[lvl] = add2eMulticlassSlotsForEntryLevel(actor, entry, lvl);
    pools[entry.key] = { ...entry, poolKey: entry.key, slotsByLevel };
  }
  return pools;
}

function add2eMulticlassSpellEntryForSpell(actor, sort) {
  if (!isMulticlassActor(actor)) {
    if (typeof globalThis.__add2eOriginalGetSpellEntryForSpell === "function") return globalThis.__add2eOriginalGetSpellEntryForSpell(actor, sort);
    return null;
  }
  if (typeof globalThis.add2eIsObjectMagicSpellForPreparation === "function" && globalThis.add2eIsObjectMagicSpellForPreparation(sort)) return null;
  const spellLevel = n(sort?.system?.niveau ?? sort?.system?.level, 0);
  const sortLists = typeof globalThis.add2eGetSpellListsFromItem === "function" ? globalThis.add2eGetSpellListsFromItem(sort) : arr(sort?.system?.spellLists).map(spellKey);
  const matches = add2eMulticlassSpellcastingEntries(actor).filter(e => sortLists.includes(e.key));
  if (!matches.length) return null;
  return matches.find(e => add2eMulticlassSlotsForEntryLevel(actor, e, spellLevel) > 0 && (!n(e.maxSpellLevel, 0) || spellLevel <= n(e.maxSpellLevel, 0))) ?? matches[0] ?? null;
}

function add2eMulticlassCanUseSpell(actor, sort) {
  if (!isMulticlassActor(actor)) {
    if (typeof globalThis.__add2eOriginalCanActorUseSpell === "function") return globalThis.__add2eOriginalCanActorUseSpell(actor, sort);
    return { ok: false, reason: "missing-original" };
  }
  if (typeof globalThis.add2eIsObjectMagicSpellForPreparation === "function" && globalThis.add2eIsObjectMagicSpellForPreparation(sort)) return { ok: false, reason: "object-power", sortLists: [], entries: add2eMulticlassSpellcastingEntries(actor), entry: null };
  const spellLevel = n(sort?.system?.niveau ?? sort?.system?.level, 0);
  const sortLists = typeof globalThis.add2eGetSpellListsFromItem === "function" ? globalThis.add2eGetSpellListsFromItem(sort) : arr(sort?.system?.spellLists).map(spellKey);
  const entries = add2eMulticlassSpellcastingEntries(actor);
  const matching = entries.filter(e => sortLists.includes(e.key));
  if (!matching.length) return { ok: false, reason: "list", sortLists, entries, entry: null };
  for (const entry of matching) {
    if (n(entry.maxSpellLevel, 0) && spellLevel > n(entry.maxSpellLevel, 0)) continue;
    if (add2eMulticlassSlotsForEntryLevel(actor, entry, spellLevel) <= 0) continue;
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
    const list = typeof globalThis.add2eToClassFeatureArray === "function" ? globalThis.add2eToClassFeatureArray(value) : arr(value).filter(v => v && typeof v === "object");
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
      const key = typeof globalThis.add2eFeatureKey === "function" ? globalThis.add2eFeatureKey(feature) : norm(feature?.key ?? feature?.name);
      const onUse = typeof globalThis.add2eFeatureOnUse === "function" ? globalThis.add2eFeatureOnUse(feature) : String(feature?.on_use ?? feature?.onUse ?? "");
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
    const activable = typeof globalThis.add2eIsFeatureActivable === "function" ? globalThis.add2eIsFeatureActivable(f) : !!f.activable;
    if (!activable) return false;
    if (includeLocked) return true;
    const level = featureLevel(f, actor);
    const min = typeof globalThis.add2eFeatureMinLevel === "function" ? globalThis.add2eFeatureMinLevel(f) : n(f.minLevel ?? f.niveauMin ?? 1, 1);
    const max = typeof globalThis.add2eFeatureMaxLevel === "function" ? globalThis.add2eFeatureMaxLevel(f) : n(f.maxLevel ?? f.niveauMax ?? 999, 999);
    return level >= min && level <= max;
  });
}

function add2eMulticlassPassiveClassFeatures(actor, { includeLocked = true } = {}) {
  return add2eMulticlassActorClassFeatures(actor).filter(f => {
    const activable = typeof globalThis.add2eIsFeatureActivable === "function" ? globalThis.add2eIsFeatureActivable(f) : !!f.activable;
    if (activable) return false;
    if (includeLocked) return true;
    const level = featureLevel(f, actor);
    const min = typeof globalThis.add2eFeatureMinLevel === "function" ? globalThis.add2eFeatureMinLevel(f) : n(f.minLevel ?? f.niveauMin ?? 1, 1);
    const max = typeof globalThis.add2eFeatureMaxLevel === "function" ? globalThis.add2eFeatureMaxLevel(f) : n(f.maxLevel ?? f.niveauMax ?? 999, 999);
    return level >= min && level <= max;
  });
}

function multiclassEquipmentAllowed(actor, item, kind) {
  if (!isMulticlassActor(actor)) {
    if (typeof globalThis.__add2eOriginalCheckEquipmentAllowedForClass === "function") return globalThis.__add2eOriginalCheckEquipmentAllowedForClass(actor, item, kind);
    return { ok: true, reason: "missing-original" };
  }
  const checks = [];
  for (const entry of multiclassEntries(actor)) {
    const fakeActor = { ...actor, system: { ...(actor.system ?? {}), classe: entry.name, details_classe: entry.system } };
    const check = typeof globalThis.__add2eOriginalCheckEquipmentAllowedForClass === "function" ? globalThis.__add2eOriginalCheckEquipmentAllowedForClass(fakeActor, item, kind) : { ok: true, reason: "no-original" };
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
      data.canExceptionalStrength = actorCanUseExceptionalStrength(actor, entries);
      if (data.canExceptionalStrength && (data.actor.system.force_ex === undefined || data.actor.system.force_ex === null || data.actor.system.force_ex === "")) data.actor.system.force_ex = 0;
      const allFeatures = add2eMulticlassActorClassFeatures(actor);
      data.activeClassFeatures = allFeatures.filter(f => {
        const activable = typeof globalThis.add2eIsFeatureActivable === "function" ? globalThis.add2eIsFeatureActivable(f) : !!f.activable;
        if (!activable) return false;
        return featureLevel(f, actor) >= (typeof globalThis.add2eFeatureMinLevel === "function" ? globalThis.add2eFeatureMinLevel(f) : n(f.minLevel ?? f.niveauMin ?? 1, 1));
      });
      data.passiveClassFeatures = allFeatures.filter(f => !(typeof globalThis.add2eIsFeatureActivable === "function" ? globalThis.add2eIsFeatureActivable(f) : !!f.activable));
      return data;
    };
  }

  proto.__add2eMulticlassMechanicsPatch = VERSION;
  return true;
}

function installWhenReady() {
  installGlobalPatches();
  installSheetPatch();
}

Hooks.once("ready", installWhenReady);
Hooks.on("init", installWhenReady);
setTimeout(installWhenReady, 0);
