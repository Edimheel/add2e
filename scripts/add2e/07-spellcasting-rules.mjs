// ============================================================
// ADD2E — Spellcasting générique par lignes de sorts
// Version : 2026-06-10-multiclass-class-specific-spell-levels-v2-global-prepared-counter
// Supporte les classes simples et les multiclasses AD&D 2e.
// Pour un multiclassé, chaque liste de sorts utilise le niveau propre
// de la classe qui fournit cette liste.
// ============================================================
globalThis.ADD2E_SPELL_PREPARATION_VERSION = "2026-06-10-multiclass-class-specific-spell-levels-v2-global-prepared-counter";
globalThis.ADD2E_SPELL_FX_VERSION = "2026-05-21-spell-fx-central-v1";

function add2eRerenderActorSheet(actor, force = true) {
  if (!actor) return false;
  try {
    for (const app of Object.values(ui.windows ?? {})) {
      const appActor = app?.actor ?? app?.document ?? app?.object;
      if (appActor?.id === actor.id && app?.render) {
        app.render(force);
        return true;
      }
    }
  } catch (_err) {}
  return false;
}
globalThis.add2eRerenderActorSheet = add2eRerenderActorSheet;

function add2eNormalizeSpellKey(value) {
  const v = String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[\s_-]+/g, "_");
  const aliases = {
    cleric: "clerc", clerc: "clerc", priest: "clerc", pretre: "clerc", prêtre: "clerc",
    druid: "druide", druide: "druide", druidique: "druide",
    wizard: "magicien", mage: "magicien", magic_user: "magicien", magicien: "magicien", magician: "magicien",
    illusionist: "illusionniste", illusionniste: "illusionniste"
  };
  return aliases[v] || v;
}

function add2eSpellLabel(value) {
  const key = add2eNormalizeSpellKey(value);
  const labels = { clerc: "Clerc", druide: "Druidique", magicien: "Magicien", illusionniste: "Illusionniste" };
  return labels[key] || String(value ?? key ?? "—");
}

function add2eToArray(value) {
  if (Array.isArray(value)) return value.filter(v => v !== undefined && v !== null && String(v).trim() !== "");
  if (typeof value === "string") return value.split(/[,;|]/).map(s => s.trim()).filter(Boolean);
  return [];
}

function add2eSpellSlug(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function add2eSpellClassItems(actor) {
  return actor?.items?.filter?.(i => String(i.type || "").toLowerCase() === "classe") ?? [];
}

function add2eSpellClassSlug(cls) {
  const sys = cls?.system ?? {};
  return add2eSpellSlug(sys.slug ?? sys.label ?? sys.nom ?? sys.name ?? cls?.name ?? "classe");
}

function add2eActorIsMulticlass(actor) {
  return actor?.system?.multiclasse?.enabled === true || add2eSpellClassItems(actor).length > 1;
}

function add2eSpellClassLevel(actor, classSlug = null) {
  const slug = add2eSpellSlug(classSlug ?? "");
  if (slug && actor?.system?.niveaux_par_classe && actor.system.niveaux_par_classe[slug] !== undefined) {
    return Math.max(1, Number(actor.system.niveaux_par_classe[slug]) || 1);
  }
  return Math.max(1, Number(actor?.system?.niveau) || 1);
}

function add2eSpellClassForEntry(actor, entry) {
  const slug = add2eSpellSlug(entry?.classSlug ?? "");
  if (slug) {
    const found = add2eSpellClassItems(actor).find(cls => add2eSpellClassSlug(cls) === slug);
    if (found) return found;
  }
  const key = add2eNormalizeSpellKey(entry?.key);
  return add2eSpellClassItems(actor).find(cls => {
    const casting = cls?.system?.spellcasting ?? {};
    const lists = add2eToArray(casting.lists).map(add2eNormalizeSpellKey);
    if (lists.includes(key)) return true;
    const entries = Array.isArray(casting.entries) ? casting.entries : Array.isArray(casting.pools) ? casting.pools : [];
    return entries.some(e => add2eNormalizeSpellKey(e.key ?? e.list ?? e.liste ?? e.name ?? e.label ?? e.type) === key);
  }) ?? add2eSpellClassItems(actor)[0] ?? null;
}

function add2eGetActorClassItemForSpellcasting(actor) {
  return add2eSpellClassItems(actor)[0] || null;
}

function add2eGetProgressionRowForActor(actor, entry = null) {
  const classItem = entry ? add2eSpellClassForEntry(actor, entry) : add2eGetActorClassItemForSpellcasting(actor);
  const details = classItem?.system || actor?.system?.details_classe || {};
  const progression = Array.isArray(details.progression) ? details.progression : [];
  const level = entry ? add2eSpellClassLevel(actor, entry.classSlug) : Math.max(1, Number(actor?.system?.niveau) || 1);
  return progression.find(row => Number(row?.niveau ?? row?.level) === level) ?? progression[level - 1] ?? {};
}

function add2eReadSpellcastingSource(actor) {
  const classItem = add2eGetActorClassItemForSpellcasting(actor);
  const classSpellcasting = classItem?.system?.spellcasting;
  const actorSpellcasting = actor?.system?.spellcasting;
  if (classSpellcasting && typeof classSpellcasting === "object") return classSpellcasting;
  if (actorSpellcasting && typeof actorSpellcasting === "object") return actorSpellcasting;
  return {};
}

function add2eEntriesFromCasting(casting, classItem = null) {
  const classSlug = classItem ? add2eSpellClassSlug(classItem) : null;
  const className = classItem?.name ?? null;
  const rawEntries = Array.isArray(casting?.entries) ? casting.entries : Array.isArray(casting?.pools) ? casting.pools : null;
  if (rawEntries) {
    return rawEntries.map((e, idx) => {
      const rawKey = e.key ?? e.list ?? e.liste ?? e.name ?? e.label ?? e.type;
      const key = add2eNormalizeSpellKey(rawKey);
      return {
        index: idx,
        key,
        label: e.label || add2eSpellLabel(key),
        startsAt: Number(e.startsAt ?? e.startLevel ?? e.niveauDepart ?? casting.startsAt ?? 1) || 1,
        maxSpellLevel: Number(e.maxSpellLevel ?? e.maxLevel ?? e.maxNiveauSort ?? casting.maxSpellLevel ?? 0) || 0,
        slotsField: e.slotsField || e.slotField || e.progressionField || null,
        notes: e.notes || "",
        classSlug,
        className
      };
    }).filter(e => e.key);
  }
  const lists = add2eToArray(casting?.lists).map(add2eNormalizeSpellKey).filter(Boolean);
  return [...new Set(lists)].map((key, idx) => ({
    index: idx,
    key,
    label: add2eSpellLabel(key),
    startsAt: Number(casting?.startsAt ?? 1) || 1,
    maxSpellLevel: Number(casting?.maxSpellLevel ?? 0) || 0,
    slotsField: null,
    notes: casting?.notes || "",
    classSlug,
    className
  }));
}

function add2eGetSpellcastingEntries(actor) {
  if (add2eActorIsMulticlass(actor)) {
    const out = [];
    const seen = new Set();
    for (const cls of add2eSpellClassItems(actor)) {
      const casting = cls?.system?.spellcasting;
      if (!casting || typeof casting !== "object" || casting.enabled === false) continue;
      for (const entry of add2eEntriesFromCasting(casting, cls)) {
        const key = `${entry.classSlug || "classe"}:${entry.key}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(entry);
      }
    }
    if (out.length) return out;
  }
  return add2eEntriesFromCasting(add2eReadSpellcastingSource(actor), add2eGetActorClassItemForSpellcasting(actor));
}

function add2eGetSpellListsFromItem(sort) {
  const sys = sort?.system ?? {};
  const fromLists = add2eToArray(sys.spellLists).map(add2eNormalizeSpellKey).filter(Boolean);
  if (fromLists.length) return [...new Set(fromLists)];
  const legacy = sys.classe || sys.class || sys.liste;
  const key = add2eNormalizeSpellKey(legacy);
  return key ? [key] : [];
}

function add2eIsObjectMagicSpellForPreparation(sort) {
  const sys = sort?.system ?? {};
  const flags = sort?.flags?.add2e ?? {};
  return sys.isPower === true || sys.isObjectPower === true || !!sys.sourceWeaponId || !!sys.sourceItemId || sys.powerIndex !== undefined || flags.sourceType === "objet_magique" || !!flags.sourceItemId || !!flags.sourceWeaponId || String(sys.composantes ?? "").toLowerCase().includes("objet");
}

function add2eReadSlotValue(raw, spellLevel, key) {
  if (typeof globalThis.add2eSpellSyncReadSlotValue === "function") return globalThis.add2eSpellSyncReadSlotValue(raw, spellLevel, key);
  const idx = Math.max(0, Number(spellLevel) - 1);
  if (Array.isArray(raw)) return Number(raw[idx] ?? 0) || 0;
  if (raw && typeof raw === "object") return Number(raw[spellLevel] ?? raw[String(spellLevel)] ?? raw[idx] ?? 0) || 0;
  if (raw !== undefined && raw !== null && raw !== "") return Number(raw) || 0;
  return null;
}

function add2eGetSlotsForEntryLevel(actor, entry, spellLevel) {
  const row = add2eGetProgressionRowForActor(actor, entry);
  const key = add2eNormalizeSpellKey(entry?.key);
  const label = entry?.label || add2eSpellLabel(key);
  const idx = Math.max(0, Number(spellLevel) - 1);
  const tryArray = (raw) => add2eReadSlotValue(raw, idx + 1, key);

  for (const containerName of ["spellSlotsByList", "spellsByList", "spellsPerLevelByList", "sortsParListe"]) {
    const c = row?.[containerName];
    if (!c || typeof c !== "object") continue;
    for (const [rawContainerKey, value] of Object.entries(c)) {
      if (add2eNormalizeSpellKey(rawContainerKey) !== key) continue;
      const v = tryArray(value);
      if (v !== null) return v;
    }
  }

  const directFields = [
    entry?.slotsField,
    `spellsPerLevel_${key}`,
    `spellsPerLevel${label}`,
    `spellsPerLevel${label.replace(/\s+/g, "")}`,
    key === "druide" ? "spellsPerLevelDruide" : null,
    key === "magicien" ? "spellsPerLevelMagicien" : null,
    key === "clerc" ? "spellsPerLevelClerc" : null,
    key === "illusionniste" ? "spellsPerLevelIllusionniste" : null
  ].filter(Boolean);

  for (const field of directFields) {
    const v = tryArray(row?.[field]);
    if (v !== null) return v;
  }

  const entries = add2eGetSpellcastingEntries(actor);
  if (entries.length <= 1) {
    const v = tryArray(row?.spellsPerLevel) ?? tryArray(row?.sortsParNiveau);
    return v ?? 0;
  }
  return 0;
}

function add2eGetSpellSlotPoolsByLevel(actor) {
  const entries = add2eGetSpellcastingEntries(actor);
  const pools = {};
  for (const entry of entries) {
    const slotsByLevel = {};
    const maxSpellLevel = Number(entry.maxSpellLevel) || 9;
    const actorLevel = add2eSpellClassLevel(actor, entry.classSlug);
    for (let lvl = 1; lvl <= maxSpellLevel; lvl++) {
      slotsByLevel[lvl] = actorLevel >= Number(entry.startsAt || 1) ? add2eGetSlotsForEntryLevel(actor, entry, lvl) : 0;
    }
    pools[entry.key] = { ...entry, actorLevel, slotsByLevel };
  }
  return pools;
}

function add2eGetSpellEntryForSpell(actor, sort) {
  if (add2eIsObjectMagicSpellForPreparation(sort)) return null;
  const spellLevel = Number(sort?.system?.niveau ?? sort?.system?.level ?? 0) || 0;
  const sortLists = add2eGetSpellListsFromItem(sort);
  const entries = add2eGetSpellcastingEntries(actor);
  const matches = entries.filter(e => sortLists.includes(e.key));
  if (!matches.length) return null;
  const available = matches.find(e => {
    const actorLevel = add2eSpellClassLevel(actor, e.classSlug);
    const startsAt = Number(e.startsAt || 1);
    const max = Number(e.maxSpellLevel || 0);
    return actorLevel >= startsAt && (!max || spellLevel <= max);
  });
  return available || matches[0] || null;
}

function add2eCanActorUseSpell(actor, sort) {
  if (add2eIsObjectMagicSpellForPreparation(sort)) return { ok: false, reason: "object-power", sortLists: [], entries: add2eGetSpellcastingEntries(actor), entry: null };
  const spellLevel = Number(sort?.system?.niveau ?? sort?.system?.level ?? 0) || 0;
  const sortLists = add2eGetSpellListsFromItem(sort);
  const entries = add2eGetSpellcastingEntries(actor);
  const matching = entries.filter(e => sortLists.includes(e.key));
  if (!matching.length) return { ok: false, reason: "list", sortLists, entries, entry: null };
  for (const entry of matching) {
    const actorLevel = add2eSpellClassLevel(actor, entry.classSlug);
    const startsAt = Number(entry.startsAt || 1);
    const max = Number(entry.maxSpellLevel || 0);
    if (actorLevel < startsAt) continue;
    if (max && spellLevel > max) continue;
    return { ok: true, reason: "ok", sortLists, entries, entry, actorLevel, spellLevel };
  }
  const entry = matching[0] ?? null;
  return { ok: false, reason: "level", sortLists, entries, entry, actorLevel: entry ? add2eSpellClassLevel(actor, entry.classSlug) : 0, spellLevel };
}

function add2eGetMemorizedByList(sort) {
  const raw = sort?.getFlag?.("add2e", "memorizedByList") ?? sort?.flags?.add2e?.memorizedByList ?? {};
  return raw && typeof raw === "object" && !Array.isArray(raw) ? foundry.utils.deepClone(raw) : {};
}

function add2eGetMemorizedCountForEntry(sort, entry) {
  const key = add2eNormalizeSpellKey(entry?.key);
  if (!sort || !key || add2eIsObjectMagicSpellForPreparation(sort)) return 0;
  const lists = add2eGetSpellListsFromItem(sort);
  const legacyRaw = sort.getFlag?.("add2e", "memorizedCount") ?? sort.flags?.add2e?.memorizedCount;
  const legacyPresent = legacyRaw !== undefined && legacyRaw !== null && legacyRaw !== "";
  const legacyCount = Number(legacyRaw) || 0;
  if (lists.length <= 1 && lists.includes(key) && legacyPresent) return Math.max(0, legacyCount);
  const byList = add2eGetMemorizedByList(sort);
  if (Object.prototype.hasOwnProperty.call(byList, key)) return Math.max(0, Number(byList[key] ?? 0) || 0);
  if (lists.length <= 1 && lists.includes(key)) return Math.max(0, legacyCount);
  return 0;
}

async function add2eSetMemorizedCountForEntry(sort, entry, value) {
  const key = add2eNormalizeSpellKey(entry?.key);
  if (!sort || !key || add2eIsObjectMagicSpellForPreparation(sort)) return;
  const byList = add2eGetMemorizedByList(sort);
  byList[key] = Math.max(0, Number(value) || 0);
  for (const k of Object.keys(byList)) if ((Number(byList[k]) || 0) <= 0) delete byList[k];
  const total = Object.values(byList).reduce((sum, v) => sum + (Number(v) || 0), 0);
  await sort.update({ "flags.add2e.memorizedByList": byList, "flags.add2e.memorizedCount": total }, { render: false, diff: true });
}

function add2eGetTotalMemorizedCount(sort) {
  if (add2eIsObjectMagicSpellForPreparation(sort)) return 0;
  const legacyRaw = sort?.getFlag?.("add2e", "memorizedCount") ?? sort?.flags?.add2e?.memorizedCount;
  if (legacyRaw !== undefined && legacyRaw !== null && legacyRaw !== "") return Math.max(0, Number(legacyRaw) || 0);
  const byList = add2eGetMemorizedByList(sort);
  return Object.values(byList).reduce((sum, v) => sum + (Number(v) || 0), 0);
}

function add2eCountPreparedForEntryLevel(actor, entry, spellLevel) {
  const key = add2eNormalizeSpellKey(entry?.key);
  const lvl = Number(spellLevel) || 1;
  let total = 0;
  for (const s of actor?.items?.filter?.(i => String(i.type || "").toLowerCase() === "sort") ?? []) {
    if (add2eIsObjectMagicSpellForPreparation(s)) continue;
    const sLvl = Number(s.system?.niveau ?? s.system?.level ?? 1) || 1;
    if (sLvl !== lvl) continue;
    const sEntry = add2eGetSpellEntryForSpell(actor, s);
    if (sEntry && add2eNormalizeSpellKey(sEntry.key) === key) total += add2eGetMemorizedCountForEntry(s, entry);
  }
  return total;
}

globalThis.add2eNormalizeSpellKey = add2eNormalizeSpellKey;
globalThis.add2eSpellLabel = add2eSpellLabel;
globalThis.add2eSpellClassLevel = add2eSpellClassLevel;
globalThis.add2eGetSpellcastingEntries = add2eGetSpellcastingEntries;
globalThis.add2eGetSpellSlotPoolsByLevel = add2eGetSpellSlotPoolsByLevel;
globalThis.add2eCanActorUseSpell = add2eCanActorUseSpell;
globalThis.add2eIsObjectMagicSpellForPreparation = add2eIsObjectMagicSpellForPreparation;
globalThis.add2eGetMemorizedCountForEntry = add2eGetMemorizedCountForEntry;
globalThis.add2eSetMemorizedCountForEntry = add2eSetMemorizedCountForEntry;
globalThis.add2eGetTotalMemorizedCount = add2eGetTotalMemorizedCount;
globalThis.add2eCountPreparedForEntryLevel = add2eCountPreparedForEntryLevel;

function evalFormuleValeur(valeur, niveau) {
  if (typeof valeur === "object" && typeof valeur.valeur !== "undefined") valeur = valeur.valeur;
  if (typeof valeur !== "string") return valeur;
  let expr = valeur.replace(/@niv(?![a-z])/gi, niveau).replace(/@niveau/gi, niveau);
  try { return Function(`return (${expr});`)(); }
  catch { return valeur; }
}

const ADD2E_SPELL_FX_PRESETS = {
  default: { launch: "divine", target: "spark" },
  clerc_default: { launch: "divine", target: "spark" },
  apaisement: { launch: "divine_soft", target: "calm" },
  epouvante: { launch: "divine_dark", target: "fear" },
  aquagenese: { launch: "water", target: "water" },
  destruction_eau: { launch: "water_dark", target: "dry" },
  benediction: { launch: "holy", target: "blessing" },
  malediction: { launch: "dark_prayer", target: "curse" },
  detection_magie: { launch: "detection", target: "magic_pulse" },
  detection_du_mal: { launch: "detection", target: "evil_pulse" },
  detection_du_bien: { launch: "detection", target: "good_pulse" }
};

globalThis.ADD2E_SPELL_FX_PRESETS = ADD2E_SPELL_FX_PRESETS;

function add2eFxColor(preset) {
  const colors = {
    divine: "#f5d37a", divine_soft: "#f8e7a1", divine_dark: "#a23a2e", holy: "#ffd76a", dark_prayer: "#5b366e",
    blessing: "#ffe28a", curse: "#6a2d7a", calm: "#9fd6ff", fear: "#b33a2e", water: "#58bde8",
    water_dark: "#3c7894", dry: "#d0a35a", detection: "#d7b15a", magic_pulse: "#8660d8", evil_pulse: "#c23b32",
    good_pulse: "#fff1a8", spark: "#f5d37a"
  };
  return colors[preset] || colors.default || "#f5d37a";
}
