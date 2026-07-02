// ADD2E — Actor sheet getData : préparation des données de sorts.

export function add2ePopulateActorSheetSpellData({ actor, data, items }) {
  const sorts = items.filter(i => i.type === "sort");
  const sortsParNiveau = {};
  for (const sort of sorts) {
    const niv = Number(sort.system.niveau) || 1;
    if (!sortsParNiveau[niv]) sortsParNiveau[niv] = [];
    sortsParNiveau[niv].push(sort);
  }

  const niveauxSorts = Object.keys(sortsParNiveau).map(Number).sort((a, b) => a - b);
  data.sortsParNiveau = sortsParNiveau;
  data.niveauxSorts = niveauxSorts;

  const sortsMemorizedByLevel = {};
  const spellPoolsByLevel = {};
  const slotPools = add2eGetSpellSlotPoolsByLevel(actor);

  for (const niv of niveauxSorts) {
    const pools = [];
    let totalCount = 0;
    let totalMax = 0;

    for (const [key, pool] of Object.entries(slotPools)) {
      const max = Number(pool.slotsByLevel?.[niv] || 0) || 0;
      const count = add2eCountPreparedForEntryLevel(actor, pool, niv);
      totalCount += count;
      totalMax += max;
      pools.push({ key, label: pool.label || add2eSpellLabel(key), count, max, startsAt: pool.startsAt, maxSpellLevel: pool.maxSpellLevel });
    }

    spellPoolsByLevel[niv] = pools;
    sortsMemorizedByLevel[niv] = {
      count: totalCount,
      max: totalMax,
      pools,
      byList: Object.fromEntries(pools.map(p => [p.key, { count: p.count, max: p.max, label: p.label }]))
    };
  }

  data.sortsMemorizedByLevel = sortsMemorizedByLevel;
  data.spellPoolsByLevel = spellPoolsByLevel;

  const add2eActorLevelForSpells = Math.max(1, Number(actor.system?.niveau ?? 1) || 1);
  const add2eSpellEntriesForHbs = add2eGetSpellcastingEntries(actor);
  const add2eSpellItemLevel = (sort) => Number(sort?.system?.niveau ?? sort?.system?.level ?? 1) || 1;
  const add2eEntryLabelForHbs = (entry) => entry?.label || add2eSpellLabel(entry?.key);
  const add2eEntryKeyForHbs = (entry) => add2eNormalizeSpellKey(entry?.key);

  const add2eMaxSpellLevelFromEntries = add2eSpellEntriesForHbs.reduce((max, entry) => Math.max(max, Number(entry?.maxSpellLevel ?? 0) || 0), 0);
  const add2eMaxSpellLevelFromItems = sorts.reduce((max, sort) => Math.max(max, add2eSpellItemLevel(sort)), 0);
  const add2eMaxSpellLevelForHbs = Math.max(add2eMaxSpellLevelFromEntries, add2eMaxSpellLevelFromItems, 0);

  const add2eBuildCountersForLevel = (spellLevel) => add2eSpellEntriesForHbs
    .filter(entry => {
      const maxSpellLevel = Number(entry?.maxSpellLevel ?? 0) || 0;
      return !maxSpellLevel || Number(spellLevel) <= maxSpellLevel;
    })
    .map(entry => {
      const count = add2eCountPreparedForEntryLevel(actor, entry, spellLevel);
      const max = add2eGetSlotsForEntryLevel(actor, entry, spellLevel);
      return { key: add2eEntryKeyForHbs(entry), label: add2eEntryLabelForHbs(entry), count, max, full: max > 0 && count >= max, over: max > 0 && count > max };
    })
    .filter(counter => counter.max > 0);

  data.add2eSpellSummaryRows = add2eSpellEntriesForHbs.map(entry => {
    const maxSpellLevel = Number(entry?.maxSpellLevel ?? add2eMaxSpellLevelForHbs) || add2eMaxSpellLevelForHbs;
    const levels = [];
    for (let spellLevel = 1; spellLevel <= maxSpellLevel; spellLevel++) {
      const count = add2eCountPreparedForEntryLevel(actor, entry, spellLevel);
      const max = add2eGetSlotsForEntryLevel(actor, entry, spellLevel);
      if (max > 0) levels.push({ spellLevel, count, max });
    }
    return { key: add2eEntryKeyForHbs(entry), label: add2eEntryLabelForHbs(entry), levels };
  }).filter(row => row.levels.length);

  data.add2eSpellLevels = [];

  const add2eIsObjectPowerRow = (sort) => {
    const s = sort?.system ?? {};
    return s.isPower === true || s.isObjectPower === true || s.sourceWeaponId || s.sourceItemId || s.powerIndex !== undefined || String(s.composantes ?? "").toLowerCase().includes("objet");
  };

  const add2eIsCapacitySpellRow = (sort) => {
    const s = sort?.system ?? {};
    const flags = sort?.flags?.add2e ?? {};
    return s.isCapacity === true || s.isCapacite === true || s.usageType === "classFeature" || s.sourceCapacite || s.sourceFeature || flags.sourceType === "capacite" || flags.sourceType === "capacity";
  };

  const add2eNormalizeMaterialLabel = (value) => String(value ?? "")
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^symbole sacre$/i, "symbole sacré")
    .replace(/^gousse ail$/i, "gousse d’ail")
    .replace(/^poudre argent$/i, "poudre d’argent")
    .replace(/^eau benite$/i, "eau bénite")
    .replace(/^eau maudite$/i, "eau maudite")
    .trim();

  const add2eIsTechnicalMaterialValue = (value) => {
    const text = String(value ?? "").trim();
    if (!text) return true;
    const normalized = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[_-]+/g, " ").trim();
    if (/^-?\d+(?:[.,]\d+)?$/.test(normalized)) return true;
    if (["true", "false", "oui", "non", "consomme", "consomme true", "consomme false", "consume", "consumed", "non consomme", "ne pas consommer", "manuel", "manuel du joueur", "manuel des joueurs", "source", "a completer", "aucun", "null", "undefined"].includes(normalized)) return true;
    if (normalized.startsWith("formulation source")) return true;
    if (normalized.startsWith("source ")) return true;
    if (normalized.includes("manuel des joueurs")) return true;
    return false;
  };

  const add2eCollectMaterialNames = (value, out = []) => {
    if (value === undefined || value === null || value === "") return out;
    if (Array.isArray(value)) {
      for (const entry of value) add2eCollectMaterialNames(entry, out);
      return out;
    }
    if (typeof value === "object") {
      const alternatives = value.alternatives ?? value.options ?? value.choix ?? value.auChoix ?? value.or;
      if (Array.isArray(alternatives) && alternatives.length) {
        const alt = [];
        for (const entry of alternatives) add2eCollectMaterialNames(entry, alt);
        if (alt.length) out.push(alt.join(" ou "));
        return out;
      }
      const direct = value.nom ?? value.name ?? value.label ?? value.item ?? value.itemName ?? value.component ?? value.composant ?? value.slug ?? value.id;
      if (direct !== undefined && direct !== null && String(direct).trim()) {
        const label = add2eNormalizeMaterialLabel(direct);
        if (!add2eIsTechnicalMaterialValue(label)) out.push(label);
        return out;
      }
      for (const [key, entry] of Object.entries(value)) {
        if (["quantite", "quantity", "qty", "nombre", "count", "consomme", "consume", "consumption", "consommation", "source", "reference", "note", "notes", "description", "condition", "conditions"].includes(String(key))) continue;
        add2eCollectMaterialNames(entry, out);
      }
      return out;
    }
    for (const part of String(value).split(/[,;|\n]+/g).map(v => add2eNormalizeMaterialLabel(v)).filter(Boolean)) {
      if (!add2eIsTechnicalMaterialValue(part)) out.push(part);
    }
    return out;
  };

  const add2eSpellRowMaterialDisplay = (system = {}) => {
    const names = add2eCollectMaterialNames(system.composants_materiels ?? []);
    if (!names.length) add2eCollectMaterialNames(system.composants_materiels_objets ?? [], names);
    if (!names.length) add2eCollectMaterialNames(system.composants_requis ?? [], names);
    const seen = new Set();
    const clean = [];
    for (const name of names) {
      const key = String(name).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_");
      if (!key || seen.has(key)) continue;
      seen.add(key);
      clean.push(name);
    }
    return clean.length ? clean.join(", ") : "—";
  };

  const add2eSpellRowComponentStatuses = (sort) => {
    if (typeof globalThis.add2eGetSpellComponentStatus !== "function") return [];

    let statuses = [];
    try {
      statuses = globalThis.add2eGetSpellComponentStatus(actor, sort) ?? [];
    } catch (error) {
      console.warn("[ADD2E][SHEET][SPELL_COMPONENT_STATUS] Lecture impossible", { actor: actor?.name, sort: sort?.name, error });
      return [];
    }

    if (!Array.isArray(statuses)) return [];
    return statuses.map(status => {
      const alternativeNames = Array.isArray(status?.alternatives)
        ? status.alternatives.map(alternative => add2eNormalizeMaterialLabel(alternative?.name ?? alternative?.label ?? alternative?.key ?? "")).filter(Boolean)
        : [];
      const label = alternativeNames.length ? alternativeNames.join(" ou ") : add2eNormalizeMaterialLabel(status?.name ?? status?.selectedName ?? status?.key ?? "");
      const quantity = Math.max(1, Number(status?.quantity ?? status?.selectedQuantity ?? 1) || 1);
      const available = status?.available === true;
      return {
        label: label || "Composant",
        available,
        quantity,
        showQuantity: quantity > 1 && !alternativeNames.length,
        title: available ? `Composant disponible${quantity > 1 ? ` (quantité requise : ${quantity})` : ""}` : `Composant manquant ou quantité insuffisante${quantity > 1 ? ` (quantité requise : ${quantity})` : ""}`
      };
    }).filter(status => status.label && status.label !== "Composant");
  };

  const add2eBuildSpellRowForHbs = (sort, spellLevel) => {
    const spellLists = add2eGetSpellListsFromItem(sort);
    const allowedEntries = add2eSpellEntriesForHbs.filter(entry => {
      const key = add2eEntryKeyForHbs(entry);
      const startsAt = Number(entry?.startsAt ?? 1) || 1;
      const maxSpellLevel = Number(entry?.maxSpellLevel ?? 0) || 0;
      return spellLists.includes(key) && add2eActorLevelForSpells >= startsAt && (!maxSpellLevel || spellLevel <= maxSpellLevel);
    });

    const matchingLabels = add2eSpellEntriesForHbs.filter(entry => spellLists.includes(add2eEntryKeyForHbs(entry))).map(add2eEntryLabelForHbs);
    const isObjectPower = add2eIsObjectPowerRow(sort);
    const isCapacity = add2eIsCapacitySpellRow(sort);
    const s = sort.system ?? {};
    const composantsMaterielsStatus = add2eSpellRowComponentStatuses(sort);
    const composantsMateriels = composantsMaterielsStatus.length ? composantsMaterielsStatus.map(status => `${status.label}${status.showQuantity ? ` ×${status.quantity}` : ""}`).join(", ") : add2eSpellRowMaterialDisplay(s);

    return {
      id: sort.id || sort._id,
      _id: sort.id || sort._id,
      uuid: sort.uuid,
      name: sort.name || "Sort",
      img: sort.img || "icons/svg/book.svg",
      system: foundry.utils.deepClone(s),
      flags: foundry.utils.deepClone(sort.flags ?? {}),
      ecole: s?.école || s?.ecole || s?.school || "",
      description: s?.description || "",
      composantes: s?.composantes || "",
      composants_materiels: composantsMateriels,
      composants_materiels_status: composantsMaterielsStatus,
      has_composants_materiels_status: composantsMaterielsStatus.length > 0,
      composants_materiels_brut: foundry.utils.deepClone(s?.composants_materiels ?? []),
      composants_materiels_objets: foundry.utils.deepClone(s?.composants_materiels_objets ?? []),
      composants_materiels_source: s?.composants_materiels_source || "",
      composants_requis: foundry.utils.deepClone(s?.composants_requis ?? []),
      temps_incantation: s?.temps_incantation || "",
      portee: s?.portee || s?.portée || null,
      duree: s?.duree || s?.durée || null,
      isObjectPower,
      isCapacity,
      isRegularSpell: !isObjectPower && !isCapacity,
      objectPowerCharges: isObjectPower ? (Number(sort.getFlag?.("add2e", "memorizedCount") ?? sort.flags?.add2e?.memorizedCount ?? s?.max ?? 0) || 0) : 0,
      listLabel: matchingLabels.length ? matchingLabels.join(" / ") : (spellLists.map(add2eSpellLabel).join(" / ") || "Non autorisé"),
      entries: allowedEntries.map(entry => {
        const count = add2eGetMemorizedCountForEntry(sort, entry);
        const total = add2eCountPreparedForEntryLevel(actor, entry, spellLevel);
        const max = add2eGetSlotsForEntryLevel(actor, entry, spellLevel);
        return { key: add2eEntryKeyForHbs(entry), label: add2eEntryLabelForHbs(entry), count, total, max, over: max > 0 && total > max };
      })
    };
  };

  const add2eMakeSpellGroup = ({ key, label, title, kind, counter, sorts }) => ({ key, label, title, kind, counter: counter || { key, label, count: 0, max: 0 }, sorts: sorts || [] });

  for (let spellLevel = 1; spellLevel <= add2eMaxSpellLevelForHbs; spellLevel++) {
    const counters = add2eBuildCountersForLevel(spellLevel);
    const levelSorts = sorts.filter(sort => add2eSpellItemLevel(sort) === spellLevel).sort((a, b) => String(a?.name ?? "").localeCompare(String(b?.name ?? "")));
    if (!counters.length && !levelSorts.length) continue;

    const sortRows = levelSorts.map(sort => add2eBuildSpellRowForHbs(sort, spellLevel));
    const regularRows = sortRows.filter(row => row.isRegularSpell);
    const objectPowerRows = sortRows.filter(row => row.isObjectPower);
    const capacityRows = sortRows.filter(row => row.isCapacity);
    const groups = [];

    if (objectPowerRows.length) groups.push(add2eMakeSpellGroup({ key: "objet_magique", label: "Effets d'objet magique", title: "Effets d'objet magique", kind: "object-power", counter: { key: "objet_magique", label: "Effets d'objet magique", count: objectPowerRows.length, max: objectPowerRows.length }, sorts: objectPowerRows }));
    if (capacityRows.length) groups.push(add2eMakeSpellGroup({ key: "capacite", label: "Capacités", title: "Capacités", kind: "capacity", counter: { key: "capacite", label: "Capacités", count: capacityRows.length, max: capacityRows.length }, sorts: capacityRows }));

    for (const counter of counters) {
      const key = add2eNormalizeSpellKey(counter.key);
      const label = counter.label || add2eSpellLabel(key);
      const groupedSorts = regularRows.filter(row => row.entries.some(entry => add2eNormalizeSpellKey(entry.key) === key));
      groups.push(add2eMakeSpellGroup({ key, label, title: `Sorts de ${String(label).toLowerCase()}`, kind: "spell-list", counter, sorts: groupedSorts }));
    }

    if (groups.length) data.add2eSpellLevels.push({ spellLevel, counters, groups, sorts: sortRows });
  }
}
