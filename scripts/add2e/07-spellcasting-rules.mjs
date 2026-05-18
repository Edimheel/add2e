// ============================================================
// ADD2E — Spellcasting générique par lignes de sorts
// Supporte les classes simples (Clerc, Druide, Magicien, Paladin)
// et les classes mixtes comme le Ranger : Druidique + Magicien.
// ============================================================
globalThis.ADD2E_SPELL_PREPARATION_VERSION = "2026-05-04-consolidated-v20-level-cap";

function add2eRerenderActorSheet(actor, force = true) {
  if (!actor) return false;

  try {
    if (actor.sheet?.render) {
      actor.sheet.render(force);
      return true;
    }
  } catch (err) {
    console.warn("[ADD2E][SHEET][RERENDER] actor.sheet.render impossible", err);
  }

  try {
    for (const app of Object.values(ui.windows ?? {})) {
      const appActor = app?.actor ?? app?.document;
      if (appActor?.id === actor.id && app?.render) {
        app.render(force);
        return true;
      }
    }
  } catch (err) {
    console.warn("[ADD2E][SHEET][RERENDER] ui.windows impossible", err);
  }

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
    cleric: "clerc",
    clerc: "clerc",
    priest: "clerc",
    pretre: "clerc",
    prêtre: "clerc",

    druid: "druide",
    druide: "druide",
    druidique: "druide",

    wizard: "magicien",
    mage: "magicien",
    magic_user: "magicien",
    magicien: "magicien",
    magician: "magicien",

    illusionist: "illusionniste",
    illusionniste: "illusionniste"
  };

  return aliases[v] || v;
}

function add2eSpellLabel(value) {
  const key = add2eNormalizeSpellKey(value);
  const labels = {
    clerc: "Clerc",
    druide: "Druidique",
    magicien: "Magicien",
    illusionniste: "Illusionniste"
  };
  return labels[key] || String(value ?? key ?? "—");
}

function add2eToArray(value) {
  if (Array.isArray(value)) return value.filter(v => v !== undefined && v !== null && String(v).trim() !== "");
  if (typeof value === "string") return value.split(/[,;|]/).map(s => s.trim()).filter(Boolean);
  return [];
}

function add2eGetActorClassItemForSpellcasting(actor) {
  return actor?.items?.find?.(i => String(i.type || "").toLowerCase() === "classe") || null;
}

function add2eGetProgressionRowForActor(actor) {
  const level = Math.max(1, Number(actor?.system?.niveau) || 1);
  const classItem = add2eGetActorClassItemForSpellcasting(actor);
  const details = classItem?.system || actor?.system?.details_classe || {};
  const progression = Array.isArray(details.progression) ? details.progression : [];
  return progression[level - 1] || {};
}

function add2eReadSpellcastingSource(actor) {
  const classItem = add2eGetActorClassItemForSpellcasting(actor);
  const classSpellcasting = classItem?.system?.spellcasting;
  const actorSpellcasting = actor?.system?.spellcasting;

  // Priorité à la classe embarquée, car c'est la source de règles.
  if (classSpellcasting && typeof classSpellcasting === "object") return classSpellcasting;
  if (actorSpellcasting && typeof actorSpellcasting === "object") return actorSpellcasting;
  return {};
}

function add2eGetSpellcastingEntries(actor) {
  const casting = add2eReadSpellcastingSource(actor);
  const rawEntries = Array.isArray(casting.entries) ? casting.entries
    : Array.isArray(casting.pools) ? casting.pools
    : null;

  let entries = [];

  if (rawEntries) {
    entries = rawEntries.map((e, idx) => {
      const rawKey = e.key ?? e.list ?? e.liste ?? e.name ?? e.label ?? e.type;
      const key = add2eNormalizeSpellKey(rawKey);
      return {
        index: idx,
        key,
        label: e.label || add2eSpellLabel(key),
        startsAt: Number(e.startsAt ?? e.startLevel ?? e.niveauDepart ?? casting.startsAt ?? 1) || 1,
        maxSpellLevel: Number(e.maxSpellLevel ?? e.maxLevel ?? e.maxNiveauSort ?? casting.maxSpellLevel ?? 0) || 0,
        slotsField: e.slotsField || e.slotField || e.progressionField || null,
        notes: e.notes || ""
      };
    }).filter(e => e.key);
  } else {
    const lists = add2eToArray(casting.lists).map(add2eNormalizeSpellKey).filter(Boolean);
    entries = [...new Set(lists)].map((key, idx) => ({
      index: idx,
      key,
      label: add2eSpellLabel(key),
      startsAt: Number(casting.startsAt ?? 1) || 1,
      maxSpellLevel: Number(casting.maxSpellLevel ?? 0) || 0,
      slotsField: null,
      notes: casting.notes || ""
    }));
  }

  return entries;
}

function add2eGetSpellListsFromItem(sort) {
  const sys = sort?.system ?? {};
  const fromLists = add2eToArray(sys.spellLists).map(add2eNormalizeSpellKey).filter(Boolean);
  if (fromLists.length) return [...new Set(fromLists)];

  // Fallback legacy.
  const legacy = sys.classe || sys.class || sys.liste;
  const key = add2eNormalizeSpellKey(legacy);
  return key ? [key] : [];
}

function add2eGetSlotsForEntryLevel(actor, entry, spellLevel) {
  const row = add2eGetProgressionRowForActor(actor);
  const key = add2eNormalizeSpellKey(entry?.key);
  const label = entry?.label || add2eSpellLabel(key);
  const idx = Math.max(0, Number(spellLevel) - 1);

  const tryArray = (raw) => add2eSpellSyncReadSlotValue(raw, idx + 1, key);

  // Nouveau modèle conseillé : progression[].spellSlotsByList.{Druide/Magicien/Clerc}
  // Lecture robuste : les clés sont comparées après normalisation.
  // Ainsi Druide, druide, Druidique, Magicien ou wizard pointent vers la même ligne interne.
  for (const containerName of ["spellSlotsByList", "spellsByList", "spellsPerLevelByList", "sortsParListe"]) {
    const c = row?.[containerName];
    if (!c || typeof c !== "object") continue;

    for (const [rawContainerKey, value] of Object.entries(c)) {
      if (add2eNormalizeSpellKey(rawContainerKey) !== key) continue;
      const v = tryArray(value);
      if (v !== null) return v;
    }
  }

  // Champs directs pratiques.
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

  // Legacy : une seule ligne de sorts.
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
  const actorLevel = Math.max(1, Number(actor?.system?.niveau) || 1);

  for (const entry of entries) {
    const slotsByLevel = {};
    const maxSpellLevel = Number(entry.maxSpellLevel) || 9;
    for (let lvl = 1; lvl <= maxSpellLevel; lvl++) {
      slotsByLevel[lvl] = actorLevel >= Number(entry.startsAt || 1)
        ? add2eGetSlotsForEntryLevel(actor, entry, lvl)
        : 0;
    }
    pools[entry.key] = { ...entry, slotsByLevel };
  }

  return pools;
}

function add2eGetSpellEntryForSpell(actor, sort) {
  const actorLevel = Math.max(1, Number(actor?.system?.niveau) || 1);
  const spellLevel = Number(sort?.system?.niveau ?? sort?.system?.level ?? 0) || 0;
  const sortLists = add2eGetSpellListsFromItem(sort);
  const entries = add2eGetSpellcastingEntries(actor);

  const matches = entries.filter(e => sortLists.includes(e.key));
  if (!matches.length) return null;

  // On renvoie d'abord une entrée réellement disponible au niveau courant.
  const available = matches.find(e => {
    const startsAt = Number(e.startsAt || 1);
    const max = Number(e.maxSpellLevel || 0);
    return actorLevel >= startsAt && (!max || spellLevel <= max);
  });

  return available || matches[0] || null;
}

function add2eCanActorUseSpell(actor, sort) {
  const actorLevel = Math.max(1, Number(actor?.system?.niveau) || 1);
  const spellLevel = Number(sort?.system?.niveau ?? sort?.system?.level ?? 0) || 0;
  const sortLists = add2eGetSpellListsFromItem(sort);
  const entries = add2eGetSpellcastingEntries(actor);
  const matching = entries.filter(e => sortLists.includes(e.key));

  if (!matching.length) {
    return { ok: false, reason: "list", sortLists, entries, entry: null };
  }

  for (const entry of matching) {
    const startsAt = Number(entry.startsAt || 1);
    const max = Number(entry.maxSpellLevel || 0);
    if (actorLevel < startsAt) return { ok: false, reason: "start", sortLists, entries, entry, actorLevel, spellLevel };
    if (max && spellLevel > max) return { ok: false, reason: "max-level", sortLists, entries, entry, actorLevel, spellLevel };

    return { ok: true, reason: "ok", sortLists, entries, entry, actorLevel, spellLevel };
  }

  return { ok: false, reason: "unknown", sortLists, entries, entry: matching[0] ?? null, actorLevel, spellLevel };
}

function add2eGetMemorizedByList(sort) {
  const raw = sort?.getFlag?.("add2e", "memorizedByList") ?? sort?.flags?.add2e?.memorizedByList ?? {};
  return raw && typeof raw === "object" && !Array.isArray(raw) ? foundry.utils.deepClone(raw) : {};
}

function add2eGetMemorizedCountForEntry(sort, entry) {
  const key = add2eNormalizeSpellKey(entry?.key);
  if (!sort || !key) return 0;

  const byList = add2eGetMemorizedByList(sort);
  if (Object.prototype.hasOwnProperty.call(byList, key)) {
    return Number(byList[key] ?? 0) || 0;
  }

  // Compatibilité anciens sorts : si le sort ne correspond qu'à une seule liste,
  // son ancien memorizedCount est considéré comme le compteur de cette liste.
  const lists = add2eGetSpellListsFromItem(sort);
  if (lists.length <= 1 && lists.includes(key)) {
    return Number(sort.getFlag?.("add2e", "memorizedCount") ?? sort.flags?.add2e?.memorizedCount ?? 0) || 0;
  }

  return 0;
}

async function add2eSetMemorizedCountForEntry(sort, entry, value) {
  const key = add2eNormalizeSpellKey(entry?.key);
  if (!sort || !key) return;

  const byList = add2eGetMemorizedByList(sort);
  byList[key] = Math.max(0, Number(value) || 0);

  // Nettoyage des zéros pour garder les flags lisibles.
  for (const k of Object.keys(byList)) {
    if ((Number(byList[k]) || 0) <= 0) delete byList[k];
  }

  const total = Object.values(byList).reduce((sum, v) => sum + (Number(v) || 0), 0);

  await sort.setFlag("add2e", "memorizedByList", byList);
  await sort.setFlag("add2e", "memorizedCount", total);
}

function add2eGetTotalMemorizedCount(sort) {
  const byList = add2eGetMemorizedByList(sort);
  const totalByList = Object.values(byList).reduce((sum, v) => sum + (Number(v) || 0), 0);
  if (totalByList > 0) return totalByList;
  return Number(sort?.getFlag?.("add2e", "memorizedCount") ?? sort?.flags?.add2e?.memorizedCount ?? 0) || 0;
}

function add2eCountPreparedForEntryLevel(actor, entry, spellLevel) {
  const key = add2eNormalizeSpellKey(entry?.key);
  const lvl = Number(spellLevel) || 1;
  let total = 0;

  for (const s of actor?.items?.filter?.(i => String(i.type || "").toLowerCase() === "sort") ?? []) {
    const sLvl = Number(s.system?.niveau ?? s.system?.level ?? 1) || 1;
    if (sLvl !== lvl) continue;
    const sEntry = add2eGetSpellEntryForSpell(actor, s);
    if (sEntry && add2eNormalizeSpellKey(sEntry.key) === key) {
      total += add2eGetMemorizedCountForEntry(s, entry);
    }
  }

  return total;
}

globalThis.add2eGetSpellcastingEntries = add2eGetSpellcastingEntries;
globalThis.add2eGetSpellSlotPoolsByLevel = add2eGetSpellSlotPoolsByLevel;
globalThis.add2eCanActorUseSpell = add2eCanActorUseSpell;
globalThis.add2eGetMemorizedCountForEntry = add2eGetMemorizedCountForEntry;
globalThis.add2eSetMemorizedCountForEntry = add2eSetMemorizedCountForEntry;
globalThis.add2eGetTotalMemorizedCount = add2eGetTotalMemorizedCount;

function evalFormuleValeur(valeur, niveau) {
  if (typeof valeur === "object" && typeof valeur.valeur !== "undefined") valeur = valeur.valeur;
  if (typeof valeur !== "string") return valeur;
  // Remplace "@niv" par le niveau réel (supporte aussi "@niveau")
  let expr = valeur.replace(/@niv(?![a-z])/gi, niveau).replace(/@niveau/gi, niveau);
  try {
    // Évite les expressions trop complexes, mais "safe" pour additions/mult
    // eslint-disable-next-line no-new-func
    return Function(`return (${expr});`)();
  } catch {
    return valeur;
  }
}

// Exposition globale conservée pour compatibilité avec le code legacy et les scripts onUse.
try { globalThis.add2eRerenderActorSheet = add2eRerenderActorSheet; } catch (_e) {}
try { globalThis.add2eNormalizeSpellKey = add2eNormalizeSpellKey; } catch (_e) {}
try { globalThis.add2eSpellLabel = add2eSpellLabel; } catch (_e) {}
try { globalThis.add2eToArray = add2eToArray; } catch (_e) {}
try { globalThis.add2eGetActorClassItemForSpellcasting = add2eGetActorClassItemForSpellcasting; } catch (_e) {}
try { globalThis.add2eGetProgressionRowForActor = add2eGetProgressionRowForActor; } catch (_e) {}
try { globalThis.add2eReadSpellcastingSource = add2eReadSpellcastingSource; } catch (_e) {}
try { globalThis.add2eGetSpellcastingEntries = add2eGetSpellcastingEntries; } catch (_e) {}
try { globalThis.add2eGetSpellListsFromItem = add2eGetSpellListsFromItem; } catch (_e) {}
try { globalThis.add2eGetSlotsForEntryLevel = add2eGetSlotsForEntryLevel; } catch (_e) {}
try { globalThis.add2eGetSpellSlotPoolsByLevel = add2eGetSpellSlotPoolsByLevel; } catch (_e) {}
try { globalThis.add2eGetSpellEntryForSpell = add2eGetSpellEntryForSpell; } catch (_e) {}
try { globalThis.add2eCanActorUseSpell = add2eCanActorUseSpell; } catch (_e) {}
try { globalThis.add2eGetMemorizedByList = add2eGetMemorizedByList; } catch (_e) {}
try { globalThis.add2eGetMemorizedCountForEntry = add2eGetMemorizedCountForEntry; } catch (_e) {}
try { globalThis.add2eSetMemorizedCountForEntry = add2eSetMemorizedCountForEntry; } catch (_e) {}
try { globalThis.add2eGetTotalMemorizedCount = add2eGetTotalMemorizedCount; } catch (_e) {}
try { globalThis.add2eCountPreparedForEntryLevel = add2eCountPreparedForEntryLevel; } catch (_e) {}
try { globalThis.evalFormuleValeur = evalFormuleValeur; } catch (_e) {}
