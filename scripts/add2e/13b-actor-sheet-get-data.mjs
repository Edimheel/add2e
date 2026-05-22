// ADD2E — Actor sheet getData extrait de 13-actor-sheet-legacy.mjs
// Découpage structurel en attente de validation : ce fichier est volontairement isolé.

if (!globalThis.Add2eActorSheet) throw new Error("[ADD2E] Add2eActorSheet doit être chargé avant getData.");

globalThis.Add2eActorSheet.prototype.getData = async function getData() {
  const data = await ActorSheet.prototype.getData.call(this);
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

  const classFeaturesForDisplay = add2eGetActorClassFeatures(this.actor)
    .map((feature, index) => ({ ...feature, __featureIndex: index }))
    .filter(feature => niveau >= add2eFeatureMinLevel(feature) && niveau <= add2eFeatureMaxLevel(feature));

  data.activeClassFeatures = classFeaturesForDisplay.filter(feature => feature.activable === true);
  data.passiveClassFeatures = classFeaturesForDisplay.filter(feature => feature.activable !== true);

  data.listeArmes = items.filter(item => item.type === "arme");
  data.listeArmures = items.filter(item => item.type === "armure");
  data.thiefSkills = add2eGetActorThiefSkills(this.actor, progressionCourante);
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
  const add2eObjectMagicPowersForHbs = [];
  const add2eObjectMagicItemsForHbs = [];
  const magicItemTypes = ["arme", "armure", "objet", "object", "magic", "objet_magique"];

  const hasPowerOnUse = power => String(
    power?.onUse ?? power?.onuse ?? power?.on_use ?? power?.script ?? power?.macro ?? power?.objetMagicOnUse ?? power?.fallbackOnUse ?? power?.onUseSortPath ?? ""
  ).trim() !== "";

  const itemEquipped = item => item?.system?.equipee === true || item?.system?.equipped === true;

  const itemsAvecPouvoirs = items.filter(item => {
    if (!magicItemTypes.includes(String(item.type || "").toLowerCase())) return false;
    if (!itemEquipped(item)) return false;
    const entries = typeof add2eMagicObjectActivePowerEntries === "function"
      ? add2eMagicObjectActivePowerEntries(item)
      : (typeof add2eMagicObjectPowerArray === "function" ? add2eMagicObjectPowerArray(item).map((power, index) => ({ power, index })).filter(entry => hasPowerOnUse(entry.power)) : []);
    return entries.length > 0;
  });

  for (const itemSource of itemsAvecPouvoirs) {
    const powerEntries = typeof add2eMagicObjectActivePowerEntries === "function"
      ? add2eMagicObjectActivePowerEntries(itemSource)
      : add2eMagicObjectPowerArray(itemSource).map((power, index) => ({ power, index })).filter(entry => hasPowerOnUse(entry.power));

    if (!powerEntries.length) continue;

    const pouvoirs = powerEntries.map(entry => entry.power);
    const chargeInfo = typeof add2eMagicObjectChargeInfo === "function"
      ? add2eMagicObjectChargeInfo(itemSource, pouvoirs)
      : { current: Number(itemSource.system?.charges?.value ?? itemSource.system?.charges ?? 0) || 0, max: Number(itemSource.system?.charges?.max ?? itemSource.system?.max_charges ?? itemSource.system?.maxCharges ?? 0) || 0 };

    const maxGlobal = Number(chargeInfo.max) || 0;
    const currentGlobal = Number(chargeInfo.current) || 0;
    const isGlobal = maxGlobal > 0;
    const itemPowers = [];

    for (const { power: p, index: idx } of powerEntries) {
      let iconImage = p.img;
      const realSpell = game.items.find(i => i.type === "sort" && i.name.toLowerCase() === String(p.name || p.nom || "").toLowerCase());
      if (realSpell) iconImage = realSpell.img;
      if (!iconImage) iconImage = itemSource.img;

      const generatedId = typeof add2eMagicPowerGeneratedId === "function" ? add2eMagicPowerGeneratedId(itemSource, idx) : itemSource.id.substring(0, 14) + idx.toString().padStart(2, "0");
      const powerMax = isGlobal ? maxGlobal : (Number(p.max ?? p.maxCharges ?? p.chargesMax ?? p.charges_max ?? p.charges ?? 1) || 1);
      const onUse = String(p.onUse ?? p.onuse ?? p.on_use ?? p.script ?? p.macro ?? p.objetMagicOnUse ?? p.fallbackOnUse ?? p.onUseSortPath ?? "").trim();
      const powerCharges = isGlobal
        ? currentGlobal
        : (Number(itemSource.getFlag?.("add2e", `charges_${idx}`) ?? p.charges ?? p.uses ?? powerMax) || 0);
      const cost = Number(p.cout ?? p.cost ?? p.chargeCost ?? 0) || 0;

      const fakeSpellData = {
        _id: generatedId,
        name: `${p.name || p.nom || itemSource.name}`,
        type: "sort",
        img: iconImage,
        system: {
          niveau: p.niveau || p.level || 1,
          école: p.ecole || p["école"] || "Magique",
          description: p.description || p.desc || "",
          composantes: "Objet",
          temps_incantation: "1",
          isPower: true,
          sourceWeaponId: itemSource.id,
          sourceItemId: itemSource.id,
          sourceItemName: itemSource.name,
          sourceItemDescription: itemSource.system?.description || "",
          powerIndex: idx,
          cost,
          max: powerMax,
          isGlobalCharge: isGlobal,
          onUse,
          onuse: onUse,
          on_use: onUse,
          objetMagicOnUse: p.objetMagicOnUse || p.fallbackOnUse || "",
          linkedSpell: p.linkedSpell || null
        }
      };

      const virtualSpell = new Item(fakeSpellData, { parent: this.actor });
      virtualSpell.getFlag = (scope, key) => {
        if (scope !== "add2e") return null;
        if (key === "memorizedCount") {
          if (isGlobal) {
            const val = itemSource.getFlag("add2e", "global_charges");
            return (val !== undefined) ? val : currentGlobal;
          }
          const charges = itemSource.getFlag("add2e", `charges_${idx}`);
          return (charges !== undefined) ? charges : powerCharges;
        }
        return null;
      };

      const powerForHbs = {
        id: virtualSpell.id || virtualSpell._id,
        name: virtualSpell.name || "Pouvoir",
        img: virtualSpell.img || "icons/svg/aura.svg",
        niveau: Number(virtualSpell.system?.niveau ?? 1) || 1,
        description: virtualSpell.system?.description || "",
        sourceItemId: itemSource.id,
        sourceItemName: itemSource.name,
        sourceItemDescription: itemSource.system?.description || "",
        powerIndex: idx,
        charges: Number(virtualSpell.getFlag?.("add2e", "memorizedCount") ?? powerCharges) || 0,
        max: powerMax,
        cost,
        onUse,
        onuse: onUse,
        on_use: onUse
      };

      add2eObjectMagicPowersForHbs.push(virtualSpell);
      itemPowers.push(powerForHbs);
    }

    if (itemPowers.length) {
      add2eObjectMagicItemsForHbs.push({
        id: itemSource.id,
        name: itemSource.name,
        img: itemSource.img || "icons/svg/aura.svg",
        description: itemSource.system?.description || "",
        charges: isGlobal ? currentGlobal : null,
        max: isGlobal ? maxGlobal : null,
        powers: itemPowers
      });
    }
  }

  data.add2eObjectMagicPowers = add2eObjectMagicPowersForHbs.map(power => ({
    id: power.id || power._id,
    name: power.name || "Pouvoir",
    img: power.img || "icons/svg/aura.svg",
    niveau: Number(power.system?.niveau ?? 1) || 1,
    description: power.system?.description || "",
    sourceItemId: power.system?.sourceWeaponId || power.system?.sourceItemId || "",
    sourceItemName: power.system?.sourceItemName || "",
    sourceItemDescription: power.system?.sourceItemDescription || "",
    powerIndex: power.system?.powerIndex ?? null,
    charges: Number(power.getFlag?.("add2e", "memorizedCount") ?? power.system?.max ?? 0) || 0,
    max: Number(power.system?.max ?? 0) || 0,
    cost: Number(power.system?.cost ?? 0) || 0,
    onUse: power.system?.onUse || power.system?.onuse || power.system?.on_use || "",
    onuse: power.system?.onuse || power.system?.onUse || power.system?.on_use || "",
    on_use: power.system?.on_use || power.system?.onUse || power.system?.onuse || ""
  }));
  data.add2eObjectMagicItems = add2eObjectMagicItemsForHbs;

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

    return {
      id: sort.id || sort._id,
      name: sort.name || "Sort",
      img: sort.img || "icons/svg/book.svg",
      ecole: sort.system?.école || sort.system?.ecole || sort.system?.school || "",
      description: sort.system?.description || "",
      composantes: sort.system?.composantes || "",
      temps_incantation: sort.system?.temps_incantation || "",
      portee: sort.system?.portee || sort.system?.portée || null,
      duree: sort.system?.duree || sort.system?.durée || null,
      isObjectPower,
      isCapacity,
      isRegularSpell: !isObjectPower && !isCapacity,
      objectPowerCharges: isObjectPower ? (Number(sort.getFlag?.("add2e", "memorizedCount") ?? sort.flags?.add2e?.memorizedCount ?? sort.system?.max ?? 0) || 0) : 0,
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