// ADD2E — Actor sheet getData ApplicationV2
// Full V2 : aucun appel ActorSheet.prototype.
// Version : 2026-06-28-spell-row-component-availability-v3

if (!globalThis.Add2eActorSheet) throw new Error("[ADD2E] Add2eActorSheet doit être chargé avant getData.");

globalThis.Add2eActorSheet.prototype.getData = async function getData() {
  const data = this._add2eNativeGetData();
  const sys = data.actor.system;
  const items = data.actor.items ?? [];

  const classItem = data.actor.items.find(i => i.type === "classe") || null;

  if (classItem && classItem.system) {
    sys.details_classe = foundry.utils.duplicate(classItem.system);
    sys.classe = classItem.name;
    sys.classe_img = classItem.img;
    sys.spellcasting = foundry.utils.duplicate(classItem.system.spellcasting ?? null);
  } else {
    sys.details_classe = {};
    sys.classe = "";
    sys.classe_img = "";
    sys.spellcasting = null;
  }

  const spellEntriesForDisplay = add2eGetSpellcastingEntries(data.actor);
  data.spellLists = spellEntriesForDisplay.map(e => e.label || add2eSpellLabel(e.key));
  data.spellcastingEntries = spellEntriesForDisplay;
  data.spellSlotsByPool = add2eGetSpellSlotPoolsByLevel(data.actor);

  let raceItem = null;
  let raceKey = sys.race || "";

  if (raceKey && items.some(i => i.type === "race" && i.id === raceKey)) {
    raceItem = items.find(i => i.type === "race" && i.id === raceKey);
  }
  if (!raceItem && raceKey) {
    raceItem = items.find(i => i.type === "race" && (i.name || "").toLowerCase() === raceKey.toLowerCase());
  }
  if (!raceItem) raceItem = items.find(i => i.type === "race") || null;

  let details_race = {};
  if (raceItem && raceItem.system) {
    const rawCaps = raceItem.system.capacites;
    let capacites = [];
    if (Array.isArray(rawCaps)) capacites = rawCaps.filter(c => !!c && typeof c === "string");
    else if (rawCaps && typeof rawCaps === "object") capacites = Object.values(rawCaps).filter(c => !!c && typeof c === "string");

    details_race = {
      nom: raceItem.name || "",
      img: raceItem.img || "",
      bonus_caracteristiques: raceItem.system.bonus_caracteristiques || {},
      capacites,
      description: raceItem.system.description || "",
      langues: raceItem.system.langues || "",
      movement: raceItem.system.movement !== undefined ? raceItem.system.movement : 0,
      taille: raceItem.system.taille || "",
      âge_debut: raceItem.system["âge_debut"] || "",
      esperance_vie: raceItem.system["espérance_vie"] || "",
      description_longue: raceItem.system.description_longue || "",
      note_md: raceItem.system.note_md || "",
      limites_classes: raceItem.system.limites_classes || {},
      min_caracteristiques: raceItem.system.min_caracteristiques || {},
      max_caracteristiques: raceItem.system.max_caracteristiques || {}
    };
  }

  sys.details_race = details_race;
  sys.movement = details_race.movement || 0;
  data.movement = sys.movement;

  let details_classe = sys.details_classe || {};
  details_classe.specialAbilities = Array.isArray(details_classe.specialAbilities)
    ? details_classe.specialAbilities
    : (details_classe.specialAbilities ? Object.values(details_classe.specialAbilities) : []);
  sys.details_classe = details_classe;

  for (const c of CARACS) {
    const base = (typeof sys[`${c}_base`] === "number") ? sys[`${c}_base`] : 10;
    const race = (typeof sys[`${c}_race`] === "number") ? sys[`${c}_race`] : 0;
    sys[c] = base + race;
  }

  const classeNorm = String(sys.classe || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f’']/g, "");

  data.canExceptionalStrength =
    (Number(sys.force) === 18) &&
    (classeNorm.includes("guerrier") || classeNorm.includes("paladin") || classeNorm.includes("rodeur") || classeNorm.includes("ranger"));

  if (data.canExceptionalStrength && (sys.force_ex === undefined || sys.force_ex === null)) sys.force_ex = 0;

  let niveau = Number(sys.niveau);
  if (!Number.isInteger(niveau) || niveau < 1) niveau = 1;
  if (Array.isArray(sys.niveau)) niveau = Number(sys.niveau.find(x => typeof x === "number" && !isNaN(x))) || 1;

  const progTab = sys.details_classe?.progression || [];
  const progressionCourante = progTab.length >= niveau ? progTab[niveau - 1] : null;

  if (progressionCourante && typeof progressionCourante.title === "undefined") {
    const titles = sys.details_classe?.titlesByLevel;
    if (Array.isArray(titles) && titles.length) {
      const t = titles.find(x => niveau >= Number(x.minLevel ?? x.niveau ?? 0) && niveau <= Number(x.maxLevel ?? x.niveau ?? 999));
      if (t && (t.title || t.titre)) progressionCourante.title = t.title || t.titre;
    }
    if (typeof progressionCourante.title === "undefined") progressionCourante.title = "";
  }

  const isMonk = (sys.details_classe?.label || sys.details_classe?.nom || sys.details_classe?.name || "")
    .toLowerCase().normalize("NFD").replace(/[\u0300-\u036f’']/g, '')
    .includes("moine");
  if (isMonk && progressionCourante && typeof progressionCourante.monkAC !== "undefined") sys.ca_naturel = progressionCourante.monkAC;

  data.progressionCourante = progressionCourante;

  const classFeaturesForDisplay = (typeof add2eGetActorClassFeatures === "function" ? add2eGetActorClassFeatures(this.actor) : [])
    .map((feature, index) => ({ ...feature, __featureIndex: index }))
    .filter(feature => {
      const featureLevel = typeof add2eFeatureActorLevel === "function" ? add2eFeatureActorLevel(this.actor, feature) : niveau;
      return featureLevel >= add2eFeatureMinLevel(feature) && featureLevel <= add2eFeatureMaxLevel(feature);
    });

  data.activeClassFeatures = classFeaturesForDisplay.filter(feature => typeof add2eIsFeatureActivable === "function" ? add2eIsFeatureActivable(feature) : feature.activable === true);
  data.passiveClassFeatures = classFeaturesForDisplay.filter(feature => !(typeof add2eIsFeatureActivable === "function" ? add2eIsFeatureActivable(feature) : feature.activable === true));
  data.thiefSkillRows = typeof add2eGetActorThiefSkillTable === "function" ? add2eGetActorThiefSkillTable(this.actor) : [];

  data.listeArmes = items.filter(item => item.type === "arme");
  data.listeArmures = items.filter(item => item.type === "armure");
  data.thiefSkills = data.thiefSkillRows;
  data.listeObjets = items.filter(i => i.type === "objet");

  let poidsTotal = 0;
  data.listeObjets.forEach(o => {
    const qte = Number(o.system.quantite) || 1;
    const pds = Number(o.system.poids) || 0;
    poidsTotal += (qte * pds);
  });
  data.poidsTotalObjets = poidsTotal;

  const armure = data.listeArmures.find(i => i.system.equipee && !(i.name.toLowerCase().includes('bouclier') || i.name.toLowerCase().includes('heaume') || i.name.toLowerCase().includes('casque')));
  const bouclier = data.listeArmures.find(i => i.system.equipee && i.name.toLowerCase().includes('bouclier'));
  const heaume = data.listeArmures.find(i => i.system.equipee && (i.name.toLowerCase().includes('heaume') || i.name.toLowerCase().includes('casque')));

  const acArmure = armure ? (Number(armure.system.ac) || 10) : 10;
  const acBouclier = bouclier ? (Number(bouclier.system.ac) || 0) : 0;
  const acHeaume = heaume ? (Number(heaume.system.ac) || 0) : 0;
  const bonusAcArmure = armure ? (Number(armure.system.bonus_ac) || 0) : 0;
  const bonusAcBouclier = bouclier ? (Number(bouclier.system.bonus_ac) || 0) : 0;
  const bonusAcHeaume = heaume ? (Number(heaume.system.bonus_ac) || 0) : 0;
  const bonusDex = typeof sys.dex_def === "number" ? sys.dex_def : 0;

  sys.armure_equipee = armure || null;
  sys.bouclier_equipe = bouclier || null;
  sys.heaume_equipe = heaume || null;

  let caPhysique = 10;
  if (isMonk && progressionCourante && typeof progressionCourante.monkAC !== "undefined") {
    caPhysique = progressionCourante.monkAC;
  } else {
    const baseDepart = armure ? acArmure : 10;
    caPhysique = baseDepart + bonusDex + bonusAcArmure;
    if (bouclier) caPhysique = caPhysique - acBouclier + bonusAcBouclier;
    if (heaume) caPhysique = caPhysique - acHeaume + bonusAcHeaume;
  }

  let magicDefense = null;
  if (typeof Add2eEffectsEngine !== "undefined" && typeof Add2eEffectsEngine.getMagicPassiveDefense === "function") {
    magicDefense = Add2eEffectsEngine.getMagicPassiveDefense(this.actor, { physicalCA: caPhysique, armure, bouclier, heaume, source: "actor-sheet" });
    sys.ca_naturel = magicDefense.caNaturel;
    sys.ca_total = magicDefense.caTotal;
  } else {
    sys.ca_naturel = caPhysique;
    let caTotale = caPhysique;
    if (typeof Add2eEffectsEngine !== "undefined") {
      const bonusMagique = Add2eEffectsEngine.getCABonus(this.actor);
      if (bonusMagique !== 0) caTotale -= bonusMagique;
    }
    sys.ca_total = caTotale;
  }
  if (this.actor.system.ca_total !== sys.ca_total || this.actor.system.ca_naturel !== sys.ca_naturel) {
    this.actor.update({ "system.ca_naturel": sys.ca_naturel, "system.ca_total": sys.ca_total });
  }

  let bonusArmureToucher = 0;
  let bonusArmureDegats = 0;
  for (const piece of [armure, bouclier, heaume].filter(Boolean)) {
    bonusArmureToucher += Number(piece.system.bonus_toucher || 0);
    bonusArmureDegats += Number(piece.system.bonus_degats || 0);
  }

  const arme = data.listeArmes.find(i => i.system.equipee) || null;
  sys.arme_equipee = arme;

  const thaco = data.progressionCourante?.thac0 || sys.thaco || 20;
  const typeDegats = arme?.system.type_degats || "";
  const armeBonusToucher = arme ? (
    typeof Add2eEffectsEngine !== "undefined" && typeof Add2eEffectsEngine.getMagicWeaponBonus === "function"
      ? Add2eEffectsEngine.getMagicWeaponBonus(arme, "hit")
      : Number(arme.system.bonus_hit || 0)
  ) : 0;
  const armeBonusDegats = arme ? (
    typeof Add2eEffectsEngine !== "undefined" && typeof Add2eEffectsEngine.getMagicWeaponBonus === "function"
      ? Add2eEffectsEngine.getMagicWeaponBonus(arme, "damage")
      : Number(arme.system.bonus_dom || 0)
  ) : 0;
  let bonusToucher = 0;
  let bonusDegats = 0;

  if (arme) {
    if ((typeDegats || "").includes("tranchant") || (typeDegats || "").includes("contondant")) {
      bonusToucher = (Number(sys.force_bonus_toucher) || 0) + armeBonusToucher + bonusArmureToucher;
      bonusDegats = (Number(sys.force_bonus_degats) || 0) + armeBonusDegats + bonusArmureDegats;
    } else if ((typeDegats || "").includes("perforant")) {
      bonusToucher = (Number(sys.dex_att) || 0) + armeBonusToucher + bonusArmureToucher;
      bonusDegats = (Number(sys.dex_att) || 0) + armeBonusDegats + bonusArmureDegats;
    } else {
      bonusToucher = armeBonusToucher + bonusArmureToucher;
      bonusDegats = armeBonusDegats + bonusArmureDegats;
    }
  }

  const degatsMoyen = arme?.system.dégâts?.contre_moyen || "-";
  const degatsGrand = arme?.system.dégâts?.contre_grand || "-";
  const degatsAffiche = degatsMoyen + " / " + degatsGrand;

  data.combatDefense = {
    armure: armure ? armure.name : "<em>Aucune</em>",
    bouclier: bouclier ? bouclier.name : "<em>Aucun</em>",
    heaume: heaume ? heaume.name : "<em>Aucun</em>",
    ac_naturelle: sys.ca_naturel,
    ac_totale: sys.ca_total,
    objets_magiques_defense: magicDefense,
    arme: arme ? arme.name : "<em>Aucune</em>",
    thaco,
    degats: degatsAffiche,
    type_degats: typeDegats,
    bonus_toucher: bonusToucher,
    bonus_degats: bonusDegats
  };

  data.saveTitles = [
    "Jet de Paralysie / Poison / Mort magique",
    "Jet de Pétrification / Polymorphose",
    "Jet de Baguettes",
    "Jet de Souffles",
    "Jet de Sortilèges"
  ];
  data.saveShortLabels = ["Paralysie", "Pétrif.", "Baguettes", "Souffles", "Sorts"];
  data.forceExValues = [];
  for (let i = 1; i <= 100; i++) data.forceExValues.push({ value: i, label: i === 100 ? "00" : i.toString().padStart(2, "0") });

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
  const slotPools = add2eGetSpellSlotPoolsByLevel(this.actor);

  for (const niv of niveauxSorts) {
    const pools = [];
    let totalCount = 0;
    let totalMax = 0;

    for (const [key, pool] of Object.entries(slotPools)) {
      const max = Number(pool.slotsByLevel?.[niv] || 0) || 0;
      const count = add2eCountPreparedForEntryLevel(this.actor, pool, niv);
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

  const add2eActorLevelForSpells = Math.max(1, Number(this.actor.system?.niveau ?? 1) || 1);
  const add2eSpellEntriesForHbs = add2eGetSpellcastingEntries(this.actor);
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
      const count = add2eCountPreparedForEntryLevel(this.actor, entry, spellLevel);
      const max = add2eGetSlotsForEntryLevel(this.actor, entry, spellLevel);
      return { key: add2eEntryKeyForHbs(entry), label: add2eEntryLabelForHbs(entry), count, max, full: max > 0 && count >= max, over: max > 0 && count > max };
    })
    .filter(counter => counter.max > 0);

  data.add2eSpellSummaryRows = add2eSpellEntriesForHbs.map(entry => {
    const maxSpellLevel = Number(entry?.maxSpellLevel ?? add2eMaxSpellLevelForHbs) || add2eMaxSpellLevelForHbs;
    const levels = [];
    for (let spellLevel = 1; spellLevel <= maxSpellLevel; spellLevel++) {
      const count = add2eCountPreparedForEntryLevel(this.actor, entry, spellLevel);
      const max = add2eGetSlotsForEntryLevel(this.actor, entry, spellLevel);
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
      statuses = globalThis.add2eGetSpellComponentStatus(this.actor, sort) ?? [];
    } catch (error) {
      console.warn("[ADD2E][SHEET][SPELL_COMPONENT_STATUS] Lecture impossible", { actor: this.actor?.name, sort: sort?.name, error });
      return [];
    }

    if (!Array.isArray(statuses)) return [];
    return statuses.map(status => {
      const alternativeNames = Array.isArray(status?.alternatives)
        ? status.alternatives
          .map(alternative => add2eNormalizeMaterialLabel(alternative?.name ?? alternative?.label ?? alternative?.key ?? ""))
          .filter(Boolean)
        : [];
      const label = alternativeNames.length
        ? alternativeNames.join(" ou ")
        : add2eNormalizeMaterialLabel(status?.name ?? status?.selectedName ?? status?.key ?? "");
      const quantity = Math.max(1, Number(status?.quantity ?? status?.selectedQuantity ?? 1) || 1);
      const available = status?.available === true;
      return {
        label: label || "Composant",
        available,
        quantity,
        showQuantity: quantity > 1 && !alternativeNames.length,
        title: available
          ? `Composant disponible${quantity > 1 ? ` (quantité requise : ${quantity})` : ""}`
          : `Composant manquant ou quantité insuffisante${quantity > 1 ? ` (quantité requise : ${quantity})` : ""}`
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
    const composantsMateriels = composantsMaterielsStatus.length
      ? composantsMaterielsStatus.map(status => `${status.label}${status.showQuantity ? ` ×${status.quantity}` : ""}`).join(", ")
      : add2eSpellRowMaterialDisplay(s);

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
        const total = add2eCountPreparedForEntryLevel(this.actor, entry, spellLevel);
        const max = add2eGetSlotsForEntryLevel(this.actor, entry, spellLevel);
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

  data.activeEffectsList = this.actor.effects.map(eff => {
    let desc = eff.getFlag("core", "description") || eff.flags?.add2e?.desc || eff.description || "";
    if (!desc && eff.flags?.add2e?.tags) desc = "<small>" + eff.flags.add2e.tags.join(", ") + "</small>";
    let durationStr = "";
    if (typeof eff.duration?.remaining !== "undefined") durationStr = `${eff.duration.remaining} rounds`;
    else if (typeof eff.duration?.rounds !== "undefined") durationStr = `${eff.duration.rounds} rounds`;
    else if (typeof eff.duration?.seconds !== "undefined") durationStr = `${eff.duration.seconds} sec`;
    return { id: eff.id, name: eff.name || "", img: eff.img || "icons/svg/aura.svg", description: desc, duration: durationStr, sourceName: eff.parent?.name || eff.origin || "" };
  });

  data.alignementsDisponibles = (sys.alignements_autorises && Array.isArray(sys.alignements_autorises)) ? sys.alignements_autorises : [];
  data.activeTab = this._add2eGetNativeActiveTab?.() || this._add2eActiveTab || this._add2eReadStoredTab?.() || "resume";

  return data;
};
