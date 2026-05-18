// ========== CLASSE PRINCIPALE PERSONNAGE ==========
class Add2eActorSheet extends ActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["add2e", "sheet", "actor", "personnage"],
      template: "systems/add2e/templates/actor/character-sheet.hbs",
      width: 1050,
      height: 900,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "resume" }]
    });
  }

  _add2eGetNativeActiveTab() {
    const tabs = Array.isArray(this._tabs) ? this._tabs : [];
    const primary = tabs.find(t => t?.group === "primary") ?? tabs[0];
    return primary?.active || null;
  }

  _add2eSetNativeActiveTab(tab) {
    if (!tab) return;
    const tabs = Array.isArray(this._tabs) ? this._tabs : [];
    for (const t of tabs) {
      if (t) t.active = tab;
    }
  }

  _onChangeTab(event, tabs, active) {
    super._onChangeTab?.(event, tabs, active);
    if (!active) return;
    this._add2eActiveTab = active;
    this._add2eSetNativeActiveTab(active);
    try {
      sessionStorage.setItem(this._add2eTabStorageKey(), active);
    } catch (e) {}
  }

async getData() {
  const data = await super.getData();
  const sys = data.actor.system;
// =====================================================
// [FIX] SYNCHRONISATION CLASSE DEPUIS L'ITEM RÉEL
// =====================================================
const classItem = data.actor.items.find(i => i.type === "classe") || null;

if (classItem && classItem.system) {
  sys.details_classe = foundry.utils.duplicate(classItem.system);
  sys.classe = classItem.name;
  sys.classe_img = classItem.img;

  // >>> AJOUT CRITIQUE <<<
  sys.spellcasting = foundry.utils.duplicate(classItem.system.spellcasting ?? null);
console.log("[ADD2E][getData] classe=", sys.classe, "niveau=", sys.niveau, "spellcasting=", sys.spellcasting);

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

  // --- Récupération robuste de la race (id OU nom, insensible à la casse) ---
  let raceItem = null;
  let raceKey = sys.race || "";
  let items = data.actor.items ?? [];

  // 1. Par id (meilleure pratique Foundry)
  if (raceKey && items.some(i => i.type === "race" && i.id === raceKey)) {
    raceItem = items.find(i => i.type === "race" && i.id === raceKey);
  }
  // 2. Sinon par nom (legacy, compatibilité)
  if (!raceItem && raceKey) {
    raceItem = items.find(i => i.type === "race" && (i.name || "").toLowerCase() === raceKey.toLowerCase());
  }
  // 3. Fallback sur la première race trouvée
  if (!raceItem) {
    raceItem = items.find(i => i.type === "race") || null;
  }
  if (!raceItem) {
    // Log détaillé : type et nom de chaque item pour diagnostic
    console.warn(
      "[ADD2e debug] AUCUNE RACE TROUVEE pour", raceKey,
      "dans", items.map(i => `${i.name} [${i.type}]`)
    );
    console.warn("[ADD2e debug] raceKey =", raceKey, "| Champ system.race =", sys.race);
  }

  // -- Préparation des capacités raciales --
  let details_race = {};
  if (raceItem && raceItem.system) {
    let rawCaps = raceItem.system.capacites;
    let capacites = [];
    if (Array.isArray(rawCaps)) capacites = rawCaps.filter(c => !!c && typeof c === "string");
    else if (rawCaps && typeof rawCaps === "object") capacites = Object.values(rawCaps).filter(c => !!c && typeof c === "string");
    else capacites = [];
    details_race = {
      nom: raceItem.name || "",
      img: raceItem.img || "",
      bonus_caracteristiques: raceItem.system.bonus_caracteristiques || {},
      capacites: capacites,
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

  // --- Préparation des capacités spéciales de classe ---
  let details_classe = sys.details_classe || {};
  details_classe.specialAbilities = Array.isArray(details_classe.specialAbilities)
    ? details_classe.specialAbilities
    : (details_classe.specialAbilities ? Object.values(details_classe.specialAbilities) : []);
  sys.details_classe = details_classe;

  for (let c of CARACS) {
    let base = (typeof sys[`${c}_base`] === "number") ? sys[`${c}_base`] : 10;
    let race = (typeof sys[`${c}_race`] === "number") ? sys[`${c}_race`] : 0;
    sys[c] = base + race;
  }
  let classe = (sys.classe || "").toLowerCase();
  let forceLabel = "" + sys.force;
  if (sys.force === 18 && (
    classe.includes("guerrier") ||
    classe.includes("paladin") ||
    classe.includes("ranger")
  )) {
    let forceEx = Number(sys.force_ex || 0);
    let forceExLabel = forceEx === 100 ? "00" : (forceEx < 10 ? "0" + forceEx : "" + forceEx);
    forceLabel = `18/${forceExLabel}`;
    sys.force_label = forceLabel;
  } else {
    sys.force_label = "" + sys.force;
  }
  // Affichage force exceptionnelle (UI)
const classeNorm = String(sys.classe || "")
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f’']/g, "");

data.canExceptionalStrength =
  (Number(sys.force) === 18) &&
  (classeNorm.includes("guerrier") || classeNorm.includes("paladin") || classeNorm.includes("rodeur") || classeNorm.includes("ranger"));

// Valeur par défaut (évite undefined)
if (data.canExceptionalStrength && (sys.force_ex === undefined || sys.force_ex === null)) {
  sys.force_ex = 0;
}

  let niveau = Number(sys.niveau);
  if (!Number.isInteger(niveau) || niveau < 1) niveau = 1;
  if (Array.isArray(sys.niveau)) {
    niveau = Number(sys.niveau.find(x => typeof x === "number" && !isNaN(x))) || 1;
  }
  const progTab = sys.details_classe?.progression || [];
  const progressionCourante = progTab.length >= niveau ? progTab[niveau - 1] : null;
  // =====================================================
// [AJOUT] TITRE DE CLASSE SELON LE NIVEAU (sans redondance)
// =====================================================
if (progressionCourante && typeof progressionCourante.title === "undefined") {
  const titles = sys.details_classe?.titlesByLevel;
  if (Array.isArray(titles) && titles.length) {
    const t = titles.find(x =>
      niveau >= Number(x.minLevel ?? x.niveau ?? 0) &&
      niveau <= Number(x.maxLevel ?? x.niveau ?? 999)
    );
    if (t && (t.title || t.titre)) {
      progressionCourante.title = t.title || t.titre;
    }
  }
  // Fallback propre (facultatif mais évite "undefined" côté HBS)
  if (typeof progressionCourante.title === "undefined") progressionCourante.title = "";
}

 
// =====================================================
// ADD2E — Résolution des spellLists (avec fallback legacy)
// =====================================================
const normalize = v => (v || "").toString().toLowerCase();

const deriveSpellListsFromClasse = (classe) => {
  switch (normalize(classe)) {
    case "clerc":       return ["cleric"];
    case "druide":      return ["cleric"]; // divin (liste prêtre)
    case "magicien":    return ["wizard"];
    case "illusionniste": return ["wizard"];
    default:            return [];
  }
};

const getSortSpellLists = (sort) => {
  if (Array.isArray(sort.system?.spellLists) && sort.system.spellLists.length) {
    return sort.system.spellLists.map(normalize);
  }
  return deriveSpellListsFromClasse(sort.system?.classe);
};

const getActorSpellLists = (actor) => {
  const lists = actor.system?.spellcasting?.lists;
  if (Array.isArray(lists) && lists.length) {
    return lists.map(normalize);
  }
  // fallback legacy : classe principale
  return deriveSpellListsFromClasse(actor.system?.details_classe?.label);
};

const intersects = (a, b) => a.some(x => b.includes(x));

  // PATCH moine : CA naturelle = monkAC progression si moine
  const isMonk = (sys.details_classe?.label || sys.details_classe?.nom || sys.details_classe?.name || "")
    .toLowerCase().normalize("NFD").replace(/[\u0300-\u036f’']/g, '')
    .includes("moine");
  if (isMonk && progressionCourante && typeof progressionCourante.monkAC !== "undefined") {
    sys.ca_naturel = progressionCourante.monkAC;
  }
  data.progressionCourante = progressionCourante;

  // Capacités de classe visibles : uniquement celles débloquées au niveau actuel.
  // Les capacités de niveau supérieur restent dans le JSON pour le moteur, mais ne sont pas affichées.
  const classFeaturesForDisplay = add2eGetActorClassFeatures(this.actor)
    .map((feature, index) => ({ ...feature, __featureIndex: index }))
    .filter(feature => niveau >= add2eFeatureMinLevel(feature) && niveau <= add2eFeatureMaxLevel(feature));

  data.activeClassFeatures = classFeaturesForDisplay.filter(feature => feature.activable === true);
  data.passiveClassFeatures = classFeaturesForDisplay.filter(feature => feature.activable !== true);

  data.listeArmes = items.filter(item => item.type === "arme");
  data.listeArmures = items.filter(item => item.type === "armure");
  data.thiefSkills = add2eGetActorThiefSkills(this.actor, progressionCourante);
// [AJOUT] Récupération de l'équipement divers
    data.listeObjets = items.filter(i => i.type === "objet");

    // Calcul du poids total de l'équipement (Optionnel)
    let poidsTotal = 0;
    data.listeObjets.forEach(o => {
        let qte = Number(o.system.quantite) || 1;
        let pds = Number(o.system.poids) || 0;
        poidsTotal += (qte * pds);
    });
    data.poidsTotalObjets = poidsTotal;
// -- Bloc bonus d'armure, CA, etc. --
  const armure = data.listeArmures.find(i => i.system.equipee && !(i.name.toLowerCase().includes('bouclier') || i.name.toLowerCase().includes('heaume') || i.name.toLowerCase().includes('casque')));
  const bouclier = data.listeArmures.find(i => i.system.equipee && i.name.toLowerCase().includes('bouclier'));
  const heaume = data.listeArmures.find(i => i.system.equipee && (i.name.toLowerCase().includes('heaume') || i.name.toLowerCase().includes('casque')));

  let acArmure = armure ? (Number(armure.system.ac) || 10) : 10;
  let acBouclier = bouclier ? (Number(bouclier.system.ac) || 0) : 0;
  let acHeaume = heaume ? (Number(heaume.system.ac) || 0) : 0;
  
  let bonusAcArmure = armure ? (Number(armure.system.bonus_ac) || 0) : 0;
  let bonusAcBouclier = bouclier ? (Number(bouclier.system.bonus_ac) || 0) : 0;
  let bonusAcHeaume = heaume ? (Number(heaume.system.bonus_ac) || 0) : 0;
  
  let acBase = 10;
  let bonusDex = typeof sys.dex_def === "number" ? sys.dex_def : 0;
  
  sys.armure_equipee = armure || null;
  sys.bouclier_equipe = bouclier || null;
  sys.heaume_equipe = heaume || null;

  // 1. CALCUL CA PHYSIQUE (BASE)
  // --------------------------------------------
  let caPhysique = 10;

  if (isMonk && progressionCourante && typeof progressionCourante.monkAC !== "undefined") {
    // Cas spécial Moine
    caPhysique = progressionCourante.monkAC;
  } else {
    // Si une armure est portée, elle remplace le 10 de base
    let baseDepart = armure ? acArmure : 10;
    caPhysique = baseDepart + bonusDex + bonusAcArmure;
    
    // Application Bouclier et Heaume (réduisent la CA)
    if (bouclier) {
        caPhysique -= acBouclier; 
        caPhysique += bonusAcBouclier;
    }
    if (heaume) {
        caPhysique -= acHeaume; 
        caPhysique += bonusAcHeaume;
    }
  }
  
  // Stockage de la "CA de Base" (Physique) pour l'affichage
  sys.ca_naturel = caPhysique;

  // 2. CALCUL CA TOTALE (MAGIQUE)
  // --------------------------------------------
  let caTotale = caPhysique;

  // Intégration des bonus CA du moteur d'effets (Anneaux, Bâtons, Sorts)
  if (typeof Add2eEffectsEngine !== "undefined") {
    const bonusMagique = Add2eEffectsEngine.getCABonus(this.actor); 
    // Règle AD&D : Un "Bonus" à la CA réduit le score
    if (bonusMagique !== 0) {
      caTotale -= bonusMagique;
    }
  }
  sys.ca_total = caTotale;

  // 3. MISE A JOUR BASE DE DONNÉES (CRITIQUE)
  // --------------------------------------------
  // On ne met à jour que si la valeur a changé pour éviter les boucles infinies
  if (this.actor.system.ca_total !== sys.ca_total) {
      // Utilisation de await si possible, sinon la promesse s'exécute en fond
      this.actor.update({ "system.ca_total": sys.ca_total });
  }

  // 4. CALCULS OFFENSIFS (Reste du code inchangé)
  // --------------------------------------------
  let bonusArmureToucher = 0;
  let bonusArmureDegats = 0;
  if (armure) {
    bonusArmureToucher += Number(armure.system.bonus_toucher || 0);
    bonusArmureDegats += Number(armure.system.bonus_degats || 0);
  }
  if (bouclier) {
    bonusArmureToucher += Number(bouclier.system.bonus_toucher || 0);
    bonusArmureDegats += Number(bouclier.system.bonus_degats || 0);
  }
  if (heaume) {
    bonusArmureToucher += Number(heaume.system.bonus_toucher || 0);
    bonusArmureDegats += Number(heaume.system.bonus_degats || 0);
  }

  const arme = data.listeArmes.find(i => i.system.equipee) || null;
  sys.arme_equipee = arme;

  let thaco = data.progressionCourante?.thac0 || sys.thaco || 20;
  let typeDegats = arme?.system.type_degats || "";
  let armeBonusToucher = arme ? Number(arme.system.bonus_hit || 0) : 0;
  let armeBonusDegats = arme ? Number(arme.system.bonus_dom || 0) : 0;
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

  let degatsMoyen = arme?.system.dégâts?.contre_moyen || "-";
  let degatsGrand = arme?.system.dégâts?.contre_grand || "-";
  let degatsAffiche = degatsMoyen + " / " + degatsGrand;

  // Construction de l'objet pour le template HTML
  data.combatDefense = {
    armure: armure ? armure.name : "<em>Aucune</em>",
    bouclier: bouclier ? bouclier.name : "<em>Aucun</em>",
    heaume: heaume ? heaume.name : "<em>Aucun</em>",
    ac_naturelle: sys.ca_naturel, // Affiche 7 (Base)
    ac_totale: sys.ca_total,       // Affiche 4 (Modifiée)
    arme: arme ? arme.name : "<em>Aucune</em>",
    thaco: thaco,
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
  data.saveShortLabels = [
    "Paralysie", "Pétrif.", "Baguettes", "Souffles", "Sorts"
  ];
  data.forceExValues = [];
  for (let i = 1; i <= 100; i++) {
    let display = (i === 100) ? "00" : i.toString().padStart(2, "0");
    data.forceExValues.push({ value: i, label: display });
  }
   const sorts = items.filter(i => i.type === "sort");
  const add2eObjectMagicPowersForHbs = [];
  const sortsParNiveau = {};

// =====================================================
// [MODIF] INJECTION DES POUVOIRS (Tous types d'items)
// Source stable : tous les objets magiques possédés par l'acteur,
// même si un autre équipement les déséquipe automatiquement.
// =====================================================
const itemsAvecPouvoirs = items.filter(i => {
  if (!["arme", "armure", "objet", "object", "magic", "objet_magique"].includes(String(i.type || "").toLowerCase())) return false;

  const pouvoirs = typeof add2eMagicObjectPowerArray === "function"
    ? add2eMagicObjectPowerArray(i)
    : (() => {
        const raw = i.system?.pouvoirs ?? i.system?.powers ?? i.system?.pouvoirsMagiques ?? i.system?.magicalPowers ?? i.system?.sorts ?? i.system?.spells;
        if (Array.isArray(raw)) return raw.filter(p => p && typeof p === "object");
        if (raw && typeof raw === "object") return Object.values(raw).filter(p => p && typeof p === "object");
        return [];
      })();

  if (pouvoirs.length > 0) return true;

  const charges = typeof add2eMagicObjectChargeInfo === "function"
    ? add2eMagicObjectChargeInfo(i, pouvoirs)
    : { max: Number(i.system?.max_charges ?? i.system?.maxCharges ?? i.system?.charges_max ?? i.system?.chargesMax ?? 0) || 0 };

  if ((Number(charges.max) || 0) > 0) return true;

  return typeof add2eMagicLooksMagical === "function" ? add2eMagicLooksMagical(i) : false;
});

for (const itemSource of itemsAvecPouvoirs) {
  let pouvoirs = typeof add2eMagicObjectPowerArray === "function"
    ? add2eMagicObjectPowerArray(itemSource)
    : [];

  // Objet magique sans pouvoir détaillé : on garde une entrée visible,
  // mais elle ne crée pas une fausse action de lancement inutile.
  if (!pouvoirs.length) continue;

  const chargeInfo = typeof add2eMagicObjectChargeInfo === "function"
    ? add2eMagicObjectChargeInfo(itemSource, pouvoirs)
    : { current: Number(itemSource.system?.charges ?? 0) || 0, max: Number(itemSource.system?.max_charges ?? itemSource.system?.maxCharges ?? 0) || 0 };

  const maxGlobal = Number(chargeInfo.max) || 0;
  const isGlobal  = maxGlobal > 0;

  pouvoirs.forEach((p, idx) => {
    let iconImage = p.img;

    const realSpell = game.items.find(i =>
      i.type === "sort" && i.name.toLowerCase() === String(p.name || p.nom || "").toLowerCase()
    );

    if (realSpell) iconImage = realSpell.img;
    if (!iconImage) iconImage = itemSource.img;

    const generatedId = typeof add2eMagicPowerGeneratedId === "function"
      ? add2eMagicPowerGeneratedId(itemSource, idx)
      : itemSource.id.substring(0, 14) + idx.toString().padStart(2, "0");

    const powerMax = isGlobal
      ? maxGlobal
      : (Number(p.max ?? p.maxCharges ?? p.chargesMax ?? p.charges_max ?? p.charges ?? 1) || 1);

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
        powerIndex: idx,
        cost: p.cout || p.cost || 0,
        max: powerMax,
        isGlobalCharge: isGlobal,
        onUse: p.onUse || p.onuse || p.on_use || p.script || "",
        onuse: p.onuse || p.onUse || p.on_use || p.script || "",
        on_use: p.on_use || p.onUse || p.onuse || p.script || "",
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
          return (val !== undefined) ? val : chargeInfo.current;
        }
        const charges = itemSource.getFlag("add2e", `charges_${idx}`);
        return (charges !== undefined) ? charges : powerMax;
      }
      return null;
    };

    add2eObjectMagicPowersForHbs.push(virtualSpell);
    // Compatibilité HBS natif : le template existant lit les pouvoirs d’objets via la liste des sorts virtuels.
    sorts.push(virtualSpell);
  });
}

data.add2eObjectMagicPowers = add2eObjectMagicPowersForHbs.map(power => ({
  id: power.id || power._id,
  name: power.name || "Pouvoir",
  img: power.img || "icons/svg/aura.svg",
  niveau: Number(power.system?.niveau ?? 1) || 1,
  description: power.system?.description || "",
  sourceItemId: power.system?.sourceWeaponId || power.system?.sourceItemId || "",
  powerIndex: power.system?.powerIndex ?? null,
  charges: Number(power.getFlag?.("add2e", "memorizedCount") ?? power.system?.max ?? 0) || 0,
  max: Number(power.system?.max ?? 0) || 0,
  cost: Number(power.system?.cost ?? 0) || 0,
  onUse: power.system?.onUse || power.system?.onuse || power.system?.on_use || "",
  onuse: power.system?.onuse || power.system?.onUse || power.system?.on_use || "",
  on_use: power.system?.on_use || power.system?.onUse || power.system?.onuse || ""
}));

    // =====================================================
  for (const sort of sorts) {
    let niveau = Number(sort.system.niveau) || 1;
    if (!sortsParNiveau[niveau]) sortsParNiveau[niveau] = [];
    sortsParNiveau[niveau].push(sort);
  }
  const niveauxSorts = Object.keys(sortsParNiveau).map(Number).sort((a, b) => a - b);
  data.sortsParNiveau = sortsParNiveau;
  data.niveauxSorts = niveauxSorts;

  // ----- LIMITES DE SORTS PRÉPARÉS PAR LIGNE DE SORTS -----
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
      pools.push({
        key,
        label: pool.label || add2eSpellLabel(key),
        count,
        max,
        startsAt: pool.startsAt,
        maxSpellLevel: pool.maxSpellLevel
      });
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

  // ----- DONNÉES NATIVES HBS : préparation par liste et par niveau -----
  // Le template character-sheet.hbs utilise directement ces champs ; il n'y a plus
  // besoin de remplacer/masquer des blocs après rendu.
  const add2eActorLevelForSpells = Math.max(1, Number(this.actor.system?.niveau ?? 1) || 1);
  const add2eSpellEntriesForHbs = add2eGetSpellcastingEntries(this.actor);

  const add2eSpellItemLevel = (sort) => Number(sort?.system?.niveau ?? sort?.system?.level ?? 1) || 1;
  const add2eEntryLabelForHbs = (entry) => entry?.label || add2eSpellLabel(entry?.key);
  const add2eEntryKeyForHbs = (entry) => add2eNormalizeSpellKey(entry?.key);

  const add2eMaxSpellLevelFromEntries = add2eSpellEntriesForHbs.reduce((max, entry) => {
    const v = Number(entry?.maxSpellLevel ?? 0) || 0;
    return Math.max(max, v);
  }, 0);

  const add2eMaxSpellLevelFromItems = sorts.reduce((max, sort) => Math.max(max, add2eSpellItemLevel(sort)), 0);
  const add2eMaxSpellLevelForHbs = Math.max(add2eMaxSpellLevelFromEntries, add2eMaxSpellLevelFromItems, 0);

  const add2eBuildCountersForLevel = (spellLevel) => {
    return add2eSpellEntriesForHbs
      .filter(entry => {
        const maxSpellLevel = Number(entry?.maxSpellLevel ?? 0) || 0;
        return !maxSpellLevel || Number(spellLevel) <= maxSpellLevel;
      })
      .map(entry => {
        const count = add2eCountPreparedForEntryLevel(this.actor, entry, spellLevel);
        const max = add2eGetSlotsForEntryLevel(this.actor, entry, spellLevel);
        return {
          key: add2eEntryKeyForHbs(entry),
          label: add2eEntryLabelForHbs(entry),
          count,
          max,
          full: max > 0 && count >= max,
          over: max > 0 && count > max
        };
      })
      .filter(counter => counter.max > 0);
  };

  data.add2eSpellSummaryRows = add2eSpellEntriesForHbs.map(entry => {
    const maxSpellLevel = Number(entry?.maxSpellLevel ?? add2eMaxSpellLevelForHbs) || add2eMaxSpellLevelForHbs;
    const levels = [];
    for (let spellLevel = 1; spellLevel <= maxSpellLevel; spellLevel++) {
      const count = add2eCountPreparedForEntryLevel(this.actor, entry, spellLevel);
      const max = add2eGetSlotsForEntryLevel(this.actor, entry, spellLevel);
      if (max > 0) {
        levels.push({ spellLevel, count, max });
      }
    }
    return {
      key: add2eEntryKeyForHbs(entry),
      label: add2eEntryLabelForHbs(entry),
      levels
    };
  }).filter(row => row.levels.length);

  data.add2eSpellLevels = [];

  const add2eIsObjectPowerRow = (sort) => {
    const sys = sort?.system ?? {};
    return sys.isPower === true
      || sys.isObjectPower === true
      || sys.sourceWeaponId
      || sys.sourceItemId
      || sys.powerIndex !== undefined
      || String(sys.composantes ?? "").toLowerCase().includes("objet");
  };

  const add2eIsCapacitySpellRow = (sort) => {
    const sys = sort?.system ?? {};
    const flags = sort?.flags?.add2e ?? {};
    return sys.isCapacity === true
      || sys.isCapacite === true
      || sys.usageType === "classFeature"
      || sys.sourceCapacite
      || sys.sourceFeature
      || flags.sourceType === "capacite"
      || flags.sourceType === "capacity";
  };

  const add2eBuildSpellRowForHbs = (sort, spellLevel) => {
    const spellLists = add2eGetSpellListsFromItem(sort);
    const allowedEntries = add2eSpellEntriesForHbs.filter(entry => {
      const key = add2eEntryKeyForHbs(entry);
      const startsAt = Number(entry?.startsAt ?? 1) || 1;
      const maxSpellLevel = Number(entry?.maxSpellLevel ?? 0) || 0;
      return spellLists.includes(key)
        && add2eActorLevelForSpells >= startsAt
        && (!maxSpellLevel || spellLevel <= maxSpellLevel);
    });

    const matchingLabels = add2eSpellEntriesForHbs
      .filter(entry => spellLists.includes(add2eEntryKeyForHbs(entry)))
      .map(add2eEntryLabelForHbs);

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
        return {
          key: add2eEntryKeyForHbs(entry),
          label: add2eEntryLabelForHbs(entry),
          count,
          total,
          max,
          over: max > 0 && total > max
        };
      })
    };
  };

  const add2eMakeSpellGroup = ({ key, label, title, kind, counter, sorts }) => ({
    key,
    label,
    title,
    kind,
    counter: counter || { key, label, count: 0, max: 0 },
    sorts: sorts || []
  });

  for (let spellLevel = 1; spellLevel <= add2eMaxSpellLevelForHbs; spellLevel++) {
    const counters = add2eBuildCountersForLevel(spellLevel);
    const levelSorts = sorts
      .filter(sort => add2eSpellItemLevel(sort) === spellLevel)
      .sort((a, b) => String(a?.name ?? "").localeCompare(String(b?.name ?? "")));

    if (!counters.length && !levelSorts.length) continue;

    const sortRows = levelSorts.map(sort => add2eBuildSpellRowForHbs(sort, spellLevel));
    const regularRows = sortRows.filter(row => row.isRegularSpell);
    const objectPowerRows = sortRows.filter(row => row.isObjectPower);
    const capacityRows = sortRows.filter(row => row.isCapacity);

    const groups = [];

    // Les pouvoirs d'objets magiques doivent apparaître avant les sorts du niveau.
    if (objectPowerRows.length) {
      groups.push(add2eMakeSpellGroup({
        key: "objet_magique",
        label: "Effets d'objet magique",
        title: "Effets d'objet magique",
        kind: "object-power",
        counter: { key: "objet_magique", label: "Effets d'objet magique", count: objectPowerRows.length, max: objectPowerRows.length },
        sorts: objectPowerRows
      }));
    }

    if (capacityRows.length) {
      groups.push(add2eMakeSpellGroup({
        key: "capacite",
        label: "Capacités",
        title: "Capacités",
        kind: "capacity",
        counter: { key: "capacite", label: "Capacités", count: capacityRows.length, max: capacityRows.length },
        sorts: capacityRows
      }));
    }

    for (const counter of counters) {
      const key = add2eNormalizeSpellKey(counter.key);
      const label = counter.label || add2eSpellLabel(key);
      const groupedSorts = regularRows.filter(row => row.entries.some(entry => add2eNormalizeSpellKey(entry.key) === key));

      // Une section est affichée si le niveau de sort est réellement accessible
      // au niveau actuel du personnage. Elle peut donc être vide si aucun sort
      // de ce niveau n'a encore été importé, mais elle disparaît dès que le
      // personnage n'a plus d'emplacement pour ce niveau.
      groups.push(add2eMakeSpellGroup({
        key,
        label,
        title: `Sorts de ${String(label).toLowerCase()}`,
        kind: "spell-list",
        counter,
        sorts: groupedSorts
      }));
    }

    if (!groups.length) continue;

    data.add2eSpellLevels.push({ spellLevel, counters, groups, sorts: sortRows });
  }


  // ----- ENRICHISSEMENT DES EFFETS ACTIFS POUR L’AFFICHAGE -----
  data.activeEffectsList = this.actor.effects.map(eff => {
    let desc = eff.getFlag("core", "description")
      || eff.flags?.add2e?.desc
      || eff.description
      || "";
    if (!desc && eff.flags?.add2e?.tags) {
      desc = "<small>" + eff.flags.add2e.tags.join(", ") + "</small>";
    }
    let durationStr = "";
    if (typeof eff.duration?.remaining !== "undefined") {
      durationStr = `${eff.duration.remaining} rounds`;
    } else if (typeof eff.duration?.rounds !== "undefined") {
      durationStr = `${eff.duration.rounds} rounds`;
    } else if (typeof eff.duration?.seconds !== "undefined") {
      durationStr = `${eff.duration.seconds} sec`;
    }
    return {
      id: eff.id,
      name: eff.name || "",
      img: eff.img || "icons/svg/aura.svg",
      description: desc,
      duration: durationStr,
      sourceName: eff.parent?.name || eff.origin || "",
    };
  });

  // Place la bonne liste des alignements autorisés pour la classe courante
  const alignementsDisponibles =
    (sys.alignements_autorises && Array.isArray(sys.alignements_autorises))
      ? sys.alignements_autorises
      : [];
  data.alignementsDisponibles = alignementsDisponibles;

  // Onglet actif persistant pendant la vie de la fiche.
  // Important : actor-sheet.mjs n'est pas chargé par system.json dans ce système ;
  // la logique d'onglets doit donc rester ici, dans add2e.mjs.
  data.activeTab = this._add2eGetNativeActiveTab?.() || this._add2eActiveTab || this._add2eReadStoredTab?.() || "resume";

  return data;
}



async autoSetCaracAjustements() {
  if (this._autoSetCaracsInProgress) return;
  if (!this.actor || !this.actor.system) {
    console.warn("[ADD2E] autoSetCaracAjustements : actor ou actor.system manquant");
    return;
  }

  const s = this.actor.system;
  this._autoSetCaracsInProgress = true;

  try {
    // ============================
    // 1) Initialisation des *_base
    // ============================
    const CARACS_LIST = ["force","dexterite","constitution","intelligence","sagesse","charisme"];
    let baseUpdates = {};

    for (const c of CARACS_LIST) {
      const baseKey = `${c}_base`;
      if (typeof s[baseKey] !== "number" || isNaN(s[baseKey])) {
        baseUpdates[`system.${baseKey}`] = Number(s[c]) || 10;
      }
    }

    if (Object.keys(baseUpdates).length > 0) {
      await this.actor.update(baseUpdates);
    }

    // =====================================
    // 2) Totaux caracs (base + bonus race)
    //    (compat: *_race OU bonus_caracteristiques.*)
    // =====================================
    const totalCaracs = {};
    for (const c of CARACS_LIST) {
      const base = Number(this.actor.system?.[`${c}_base`] ?? s[`${c}_base`] ?? 10) || 10;

      // compat anciens champs "*_race"
      const legacyRace = Number(this.actor.system?.[`${c}_race`] ?? s[`${c}_race`] ?? 0) || 0;

      // champ actuel dans ta feuille: bonus_caracteristiques.force etc.
      const bonusCaracs = this.actor.system?.bonus_caracteristiques || s.bonus_caracteristiques || {};
      const bonusRace = Number(bonusCaracs?.[c] ?? 0) || 0;

      totalCaracs[c] = base + (bonusRace || legacyRace);
    }

    // Valeurs d'affichage (utilisées dans _fullUpdate)
    const forAff = totalCaracs.force;
    const dexAff = totalCaracs.dexterite;
    const conAff = totalCaracs.constitution;
    const intAff = totalCaracs.intelligence;
    const sagAff = totalCaracs.sagesse;
    const chaAff = totalCaracs.charisme;

    // ============================
    // 3) FORCE (inclut 18/xx)
    // ============================
    // Normalisation robuste (accents, apostrophes)
    const classeStr = String(s.classe || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f’']/g, "");

    // Flag porté par la classe (si tu le stockes dans details_classe)
    const allowExFromClass =
      !!(s.details_classe?.allowExceptionalStrength || s.details_classe?.allowExceptionalStrength === true);

    // Compat rétro : si pas de flag, on garde l'ancien test par nom
    const allowExLegacy =
      classeStr.includes("guerrier") || classeStr.includes("paladin") || classeStr.includes("rodeur") || classeStr.includes("ranger");

    const allowExceptional = allowExFromClass || allowExLegacy;

    let valForce = totalCaracs.force;
    let forceEx = Number(s.force_ex || 0);
    let forceKey = valForce;

    if (valForce === 18 && allowExceptional) {
      if (forceEx >= 1 && forceEx <= 50)       forceKey = "18/01-50";
      else if (forceEx >= 51 && forceEx <= 75) forceKey = "18/51-75";
      else if (forceEx >= 76 && forceEx <= 90) forceKey = "18/76-90";
      else if (forceEx >= 91 && forceEx <= 99) forceKey = "18/91-99";
      else if (forceEx === 100)                forceKey = "18/00";
    }

    // IMPORTANT: évite ReferenceError
    let forceBonus = { toucher: 0, degats: 0, poids: 0, ouvrir: "—", tordre: "—" };
    if (typeof FORCE_TABLE !== "undefined" && FORCE_TABLE && FORCE_TABLE[forceKey]) {
      forceBonus = FORCE_TABLE[forceKey];
    }

    const forBonusToucher = Number(forceBonus.toucher || 0);
    const forBonusDegats  = Number(forceBonus.degats  || 0);

    // Compat ancienne feuille vs nouvelle (tu affiches désormais force_poids/ouvrir/tordre)
    const forcePoids  = forceBonus.poids ?? 0;
    const forceOuvrir = forceBonus.ouvrir ?? "—";
    const forceTordre = forceBonus.tordre ?? "—";

    // (Legacy) certains endroits de ton code utilisaient "force_bonus_porte" / charges
    const forBonusPorte = forceOuvrir;

    // Charge max (si tu avais déjà ces champs ailleurs; fallback neutre sinon)
    const chargeMax      = (typeof forcePoids === "number") ? forcePoids : 0;
    const chargeMaxBench = (typeof forcePoids === "number") ? forcePoids : 0;

    // ============================
    // 4) AUTRES TABLES (si présentes)
    // ============================
    const dexBonus = (typeof DEXTERITE_TABLE !== "undefined" && DEXTERITE_TABLE?.[dexAff]) || { att: 0, def: 0 };
    const conBonus = (typeof CONSTITUTION_TABLE !== "undefined" && CONSTITUTION_TABLE?.[conAff]) || { pv: 0, trauma: 0, resu: 0 };
    const intBonus = (typeof INTELLIGENCE_TABLE !== "undefined" && INTELLIGENCE_TABLE?.[intAff]) || { langues: 0, chance_sort: 0, min_sort: 0, max_sort: 0, sort_par_niveau: 0 };
    const sagBonus = (typeof SAGESSE_TABLE !== "undefined" && SAGESSE_TABLE?.[sagAff]) || { magie: 0, sort_suppl: 0, echec: 0 };
    const chaBonus = (typeof CHARISME_TABLE !== "undefined" && CHARISME_TABLE?.[chaAff]) || { compagnons: 0, loy: 0, react: 0 };

    // ============================
    // 5) Update global + diff
    // ============================
    const _fullUpdate = {
      // Affichages
      "system.for_aff": forAff,
      "system.dex_aff": dexAff,
      "system.con_aff": conAff,
      "system.int_aff": intAff,
      "system.sag_aff": sagAff,
      "system.cha_aff": chaAff,

      // Force (nouveaux champs affichés sur ta feuille)
      "system.force_bonus_toucher": forBonusToucher,
      "system.force_bonus_degats": forBonusDegats,
      "system.force_poids": forcePoids,
      "system.force_ouvrir": forceOuvrir,
      "system.force_tordre": forceTordre,

      // Legacy/compat (si tu as encore des usages ailleurs)
      "system.force_bonus_porte": forBonusPorte,
      "system.charge_max": chargeMax,
      "system.charge_max_bench": chargeMaxBench,

      // Dex / Con / Int / Sag / Cha (si tu les exploites ailleurs)
      "system.dex_att": Number(dexBonus.att || 0),
      "system.dex_def": Number(dexBonus.def || 0),

      "system.con_pv": Number(conBonus.pv || 0),
      "system.con_trauma": Number(conBonus.trauma || 0),
      "system.con_resu": Number(conBonus.resu || 0),

      "system.int_langues": Number(intBonus.langues || 0),
      "system.int_chance_sort": Number(intBonus.chance_sort || 0),
      "system.int_min_sort": Number(intBonus.min_sort || 0),
      "system.int_max_sort": Number(intBonus.max_sort || 0),
      "system.int_sort_par_niveau": Number(intBonus.sort_par_niveau || 0),

      "system.sag_magie": Number(sagBonus.magie || 0),
      "system.sag_sort_suppl": Number(sagBonus.sort_suppl || 0),
      "system.sag_echec": Number(sagBonus.echec || 0),

      "system.cha_compagnons": Number(chaBonus.compagnons || 0),
      "system.cha_loy": Number(chaBonus.loy || 0),
      "system.cha_react": Number(chaBonus.react || 0)
    };

    const _getProp = foundry?.utils?.getProperty;
    const _diff = {};
    for (const [k, v] of Object.entries(_fullUpdate)) {
      const cur = _getProp ? _getProp(this.actor, k) : undefined;
      if (cur !== v) _diff[k] = v;
    }

    if (Object.keys(_diff).length) {
      await this.actor.update(_diff);
    } else {
      console.log("%c[ADD2E][CARACS] Ajustements déjà à jour (aucune update).", "color:#777");
    }

    // ============================
    // 6) PV auto (si présent)
    // ============================
    if (typeof this.autoSetPointsDeCoup === "function") {
      await this.autoSetPointsDeCoup();
    }

  } catch (e) {
    console.error("[ADD2E] Erreur dans autoSetCaracAjustements()", e);
  } finally {
    this._autoSetCaracsInProgress = false;
  }
}




  async autoSetPointsDeCoup({ syncCurrent = false, force = false, reason = "unknown" } = {}) {
  try {
    const actor = this.actor;
    if (!actor?.system) return;

    const s = actor.system;
    const lvl = Math.max(1, Number(s.niveau) || 1);

    // Classe (priorité: item "classe", sinon details_classe)
    const classeItem = actor.items?.find(i => i.type === "classe");
    const cls = classeItem?.system || s.details_classe || null;
    if (!cls) {
      console.warn("[ADD2E][HP] Classe introuvable, PV non recalculés", { actor: actor.name, reason });
      return;
    }

    const hitDie = Number(cls.hitDie || 0);
    if (!Number.isFinite(hitDie) || hitDie <= 0) {
      console.warn("[ADD2E][HP] hitDie invalide, PV non recalculés", { actor: actor.name, hitDie, reason });
      return;
    }

    // Bonus CON par niveau (calculé par autoSetCaracAjustements -> system.con_pv)
    const conBonus = Number(s.con_pv || 0);

    // Jets mémorisés : hpRolls[i] = jet du niveau (i+1)
    let hpRolls = Array.isArray(s.hpRolls) ? [...s.hpRolls] : [];
    if (force) hpRolls = [];

    // Niveau 1 : max du dé
    if (hpRolls.length < 1 || !Number.isFinite(hpRolls[0])) {
      hpRolls[0] = hitDie;
    }

    // Niveaux 2+ : jet 1..hitDie
    for (let i = 1; i < lvl; i++) {
      const cur = hpRolls[i];
      if (Number.isFinite(cur) && cur >= 1 && cur <= hitDie) continue;

      // Jet sûr sans parseur de formule
      const roll = 1 + Math.floor(Math.random() * hitDie);
      hpRolls[i] = roll;
    }

    // Calcul PV max selon votre règle
    let hpMax = 0;
    for (let i = 0; i < lvl; i++) {
      const diePart = (i === 0) ? hitDie : (Number(hpRolls[i]) || 1);
      hpMax += diePart + conBonus;
    }

    if (!Number.isFinite(hpMax) || hpMax < 1) hpMax = 1;

    const up = {
      "system.hpRolls": hpRolls,
      "system.points_de_coup": hpMax
    };
    if (syncCurrent) up["system.pdv"] = hpMax;

    await actor.update(up, { add2eInternal: true });

    console.log("[ADD2E][HP] PV recalculés (max niv1 + jets) OK", {
      actor: actor.name,
      lvl,
      hitDie,
      conBonus,
      hpMax,
      reason
    });

  } catch (e) {
    console.warn("[ADD2E][HP] Erreur autoSetPointsDeCoup :", e);
  }
}


  _enableCaracClickAssign(roller) {
  this.element.find('.carac-drop-target').each((i, el) => {
  el.classList.add("clickable");
  el.onclick = ev => {
    const carac = el.dataset.carac;
    if (roller.assigned[carac] !== undefined) {
      roller.unassignCarac(carac); 
    } else {
      roller.assignToCarac(carac);
    }
  };
  });
  
 }


  // =====================================================
  // ADD2E — MÉMOIRE DES ONGLET DE LA FEUILLE PERSONNAGE
  // =====================================================
  // Le système charge cette classe depuis add2e.mjs. Le fichier actor-sheet.mjs
  // n'est pas chargé par system.json. Toute la logique d'onglets doit donc être ici.

  _add2eTabStorageKey() {
    return `add2e.actor.${this.actor?.id || "unknown"}.activeTab`;
  }

  _add2eReadStoredTab() {
    try {
      return sessionStorage.getItem(this._add2eTabStorageKey()) || null;
    } catch (e) {
      return null;
    }
  }

  _add2eSheetRoot(html = null) {
    const source = html ?? this.element;
    if (!source) return null;

    const root = source.jquery ? source[0] : source;
    if (!root) return null;

    if (root.matches?.(".add2e-character-v3")) return root;
    if (root.querySelector?.(".add2e-character-v3")) return root.querySelector(".add2e-character-v3");
    if (root.matches?.("form.sheet.actor.add2e")) return root;
    if (root.querySelector?.("form.sheet.actor.add2e")) return root.querySelector("form.sheet.actor.add2e");

    return root;
  }

  _add2eCurrentTabFromHtml(html = null) {
    const root = this._add2eSheetRoot(html);
    if (!root) return this._add2eActiveTab || this._add2eReadStoredTab() || "resume";

    return (
      this._add2eGetNativeActiveTab?.() ||
      root.querySelector(".sheet-tabs .item.active[data-tab]")?.dataset?.tab ||
      root.querySelector(".a2e-tabs .item.active[data-tab]")?.dataset?.tab ||
      root.querySelector(".sheet-body .tab.active[data-tab]")?.dataset?.tab ||
      root.querySelector(".a2e-tab-content.active[data-tab]")?.dataset?.tab ||
      root.querySelector(".a2e-active-tab-input")?.value ||
      this._add2eActiveTab ||
      this._add2eReadStoredTab() ||
      "resume"
    );
  }

  _add2eRememberActiveTab(html = null, explicitTab = null) {
    const tab = explicitTab || this._add2eCurrentTabFromHtml(html) || "resume";
    this._add2eActiveTab = tab;
    this._add2eSetNativeActiveTab?.(tab);

    try {
      sessionStorage.setItem(this._add2eTabStorageKey(), tab);
    } catch (e) {}

    const root = this._add2eSheetRoot(html);
    const hidden = root?.querySelector?.(".a2e-active-tab-input");
    if (hidden) hidden.value = tab;

    return tab;
  }

  _add2eActivateTab(tabName = null, html = null) {
    const root = this._add2eSheetRoot(html);
    if (!root) return;

    const tab = tabName || this._add2eActiveTab || this._add2eReadStoredTab() || "resume";
    this._add2eRememberActiveTab(root, tab);

    root.querySelectorAll(".sheet-tabs .item[data-tab], .a2e-tabs .item[data-tab]").forEach(el => {
      el.classList.toggle("active", el.dataset.tab === tab);
    });

    root.querySelectorAll(".sheet-body .tab[data-tab], .a2e-tab-content[data-tab]").forEach(el => {
      el.classList.toggle("active", el.dataset.tab === tab);
    });
  }

  _add2eBindPersistentTabs(html) {
    const root = this._add2eSheetRoot(html);
    if (!root) return;

    const initial = this._add2eGetNativeActiveTab?.() || this._add2eActiveTab || this._add2eReadStoredTab() || "resume";
    this._add2eActivateTab(initial, root);
    setTimeout(() => this._add2eActivateTab(this._add2eActiveTab || this._add2eReadStoredTab() || "resume"), 0);

    // Capture avant les handlers d'action : mémorise l'onglet courant avant equip/delete/update/render.
    if (root.dataset.add2eTabsCaptureBound !== "1") {
      root.dataset.add2eTabsCaptureBound = "1";
      root.addEventListener("pointerdown", ev => {
        const tabLink = ev.target.closest?.(".sheet-tabs .item[data-tab], .a2e-tabs .item[data-tab]");
        if (tabLink && root.contains(tabLink)) {
          this._add2eRememberActiveTab(root, tabLink.dataset.tab || "resume");
          return;
        }
        this._add2eRememberActiveTab(root);
      }, true);
      root.addEventListener("change", () => this._add2eRememberActiveTab(root), true);
    }

    $(root).find(".sheet-tabs .item[data-tab], .a2e-tabs .item[data-tab]")
      .off("click.add2e-tabs")
      .on("click.add2e-tabs", ev => {
        ev.preventDefault();
        const tab = ev.currentTarget.dataset.tab || "resume";
        this._add2eActivateTab(tab, root);
      });

    $(root)
      .off("mousedown.add2e-tab-memory change.add2e-tab-memory keydown.add2e-tab-memory")
      .on("mousedown.add2e-tab-memory change.add2e-tab-memory keydown.add2e-tab-memory", () => {
        this._add2eRememberActiveTab(root);
      });
  }

  render(force=false, options={}) {
    try {
      if (this.rendered) this._add2eRememberActiveTab(this.element);
    } catch (e) {}
    const result = super.render(force, options);
    const refreshUi = () => {
      this._add2eActivateTab(this._add2eActiveTab || this._add2eReadStoredTab() || "resume");
      try {
        add2eEnhanceCharacterSheetUi(this, this.element);
      } catch (err) {
        console.warn("[ADD2E][OBJETS_MAGIQUES][UI] Réinjection après render impossible.", err);
      }
    };
    for (const delay of [0, 80, 220]) setTimeout(refreshUi, delay);
    return result;
  }

  activateListeners(html) {
    super.activateListeners(html);
    const self = this;
add2eRegisterImgPicker(html, this);
this._add2eBindPersistentTabs(html);
add2eEnhanceCharacterSheetUi(this, html);

// -- Gestion des effets actifs (édition et suppression) --
 html.find('.effect-edit').off().on('click', ev => {
  ev.preventDefault();
  const effectId = $(ev.currentTarget).data('effect-id');
  const effect = this.actor.effects.get(effectId);
  if (effect) effect.sheet.render(true);
});

html.find('.effect-delete').off().on('click', async ev => {
  ev.preventDefault();
  this._add2eRememberActiveTab(html);
  const effectId = $(ev.currentTarget).data('effect-id');
  if (effectId) {
    await this.actor.deleteEmbeddedDocuments("ActiveEffect", [effectId]);
    this.render(false);
  }
});


html.find('.carac-btn').off('click.add2e').on('click.add2e', async ev => {
  ev.preventDefault();
  this._add2eRememberActiveTab(html);
  const carac = ev.currentTarget.dataset.carac;
  const isPlus = ev.currentTarget.classList.contains('plus');
  let baseVal = Number(this.actor.system[`${carac}_base`] || 10);
  baseVal = Math.max(3, Math.min(18, baseVal + (isPlus ? 1 : -1)));
  await this.actor.update({ [`system.${carac}_base`]: baseVal });

  // Sauvegarde immédiatement après changement
  const CARACS = ["force", "dexterite", "constitution", "intelligence", "sagesse", "charisme"];
  let baseCaracs = {};
  for (const c of CARACS) {
    baseCaracs[c] = typeof this.actor.system?.[`${c}_base`] === "number" ? this.actor.system[`${c}_base`] : 10;
  }
  await this.actor.setFlag("add2e", "base_caracs", baseCaracs);

  // Recalcule et met à jour les bonus de carac !
  if (typeof this.autoSetCaracAjustements === "function") {
    await this.autoSetCaracAjustements();
  }
  // Si tes bonus sont calculés côté script mais non enregistrés sur l’acteur :
  // Ajoute explicitement une MAJ de l’actor pour forcer l’update
  const recalculatedBonuses = this.calcCaracBonuses ? this.calcCaracBonuses() : {};
  // Ex : calcCaracBonuses() doit retourner un objet du type
  // { "system.force_bonus_toucher": 1, ... }
  if (recalculatedBonuses && Object.keys(recalculatedBonuses).length) {
    await this.actor.update(recalculatedBonuses);
  }

  // Rafraîchir la fiche pour refléter les nouvelles valeurs
  await this.render(false);
});

html.find('.roll-stat').off('click.add2e').on('click.add2e', async ev => {
  ev.preventDefault();
  const carac = ev.currentTarget.dataset.stat;
  const label = carac?.toUpperCase() || 'Caractéristique';
  const val = Number(this.actor.system[carac]) || 10;
  const roll = new Roll('1d20');
  await roll.evaluate();

  // LANCE DICE SO NICE sans créer de message gris
  if (game.dice3d) await game.dice3d.showForRoll(roll);

  // Choix d’icône et de couleur selon la carac
  const caracIcon = {
    force: "fa-dumbbell",
    dexterite: "fa-running",
    constitution: "fa-heartbeat",
    intelligence: "fa-brain",
    sagesse: "fa-eye",
    charisme: "fa-theater-masks"
  }[carac] || "fa-dice-d20";
  const caracColor = {
    force: "#4ab878",
    dexterite: "#f3aa3c",
    constitution: "#e74c3c",
    intelligence: "#2980b9",
    sagesse: "#9b59b6",
    charisme: "#e056fd"
  }[carac] || "#6c4e95";
  const reussite = roll.total <= val;

  const htmlCard = `
    <div class="add2e-card-test" style="
      border-radius:13px; box-shadow:0 2px 10px #b5e7c388;
      background:linear-gradient(100deg,#f9fcfa 90%,#e4fbf1 100%);
      border:1.4px solid ${caracColor}; max-width:420px; padding:0.85em 1.1em 0.8em 1.1em; font-family: var(--font-primary);
    ">
      <div style="display:flex; align-items:center; gap:0.7em; margin-bottom:0.5em;">
        <i class="fas ${caracIcon}" style="font-size:2em;color:${caracColor};"></i>
        <span style="font-size:1.17em; font-weight:bold; color:${caracColor};">${label}</span>
        <span style="margin-left:auto; font-size:1em; font-weight:500; color:#666;">Test de caractéristique</span>
      </div>
      <div style="font-size:1.11em; margin-bottom:0.25em;">
        Seuil&nbsp;: <b>${val}</b>
        &nbsp;&nbsp;|&nbsp;&nbsp;Résultat&nbsp;: <b>${roll.total}</b>
      </div>
      <div style="margin:0.2em 0 0.1em 0; font-size:1.1em;">
        <span style="font-weight:600; color:${reussite ? "#1cb360" : "#c34040"};">
          ${reussite ? "✔️ Réussite" : "❌ Échec"}
        </span>
      </div>
    </div>
  `;

  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: this.actor }),
    content: htmlCard
  });
});

html.find('.roll-save').off('click.add2e').on('click.add2e', async ev => {
  ev.preventDefault();
  const idx = Number(ev.currentTarget.dataset.save);

  // Récupère les valeurs (modifie ici si besoin selon ta structure)
  const saves = this.actor.system.details_classe?.progression?.[this.actor.system.niveau - 1]?.savingThrows
    || this.actor.system.sauvegardes || [];
  const noms = ["Paralysie", "Pétrification", "Baguettes", "Souffles", "Sorts"];
  const nom = noms[idx] || "Jet";
  const valeur = Number(saves[idx]);
  if (!valeur) return ui.notifications.warn("Aucune valeur pour ce jet.");

  const roll = new Roll('1d20');
  await roll.evaluate();

  // LANCE DICE SO NICE sans créer de message gris
  if (game.dice3d) await game.dice3d.showForRoll(roll);

  let bonusSave = 0;
  if (typeof Add2eEffectsEngine !== "undefined") {
    try {
      const analyse = Add2eEffectsEngine.analyze?.(this.actor, { type: "save", vsType: nom, frontale: true }) ?? {};
      bonusSave = Number(analyse.bonus_save || 0);
    } catch (e) {
      console.warn("[ADD2E][SAVE] Erreur analyse effets de sauvegarde", e);
    }
  }

  const totalJet = Number(roll.total || 0) + bonusSave;

  // Icônes et couleurs par type de save
  const saveIcons = ["fa-skull-crossbones","fa-mountain","fa-magic","fa-fire","fa-scroll"];
  const icon = saveIcons[idx] || "fa-dice-d20";
  const colors = ["#c48642","#6394e8","#b12f95","#e67e22","#a173d9"];
  const color = colors[idx] || "#6c4e95";
  const reussite = totalJet >= valeur;

  const htmlCard = `
    <div class="add2e-card-test" style="
      border-radius:13px; box-shadow:0 2px 10px #cfdfff88;
      background:linear-gradient(100deg,#f9fafd 90%,#e6e8fb 100%);
      border:1.4px solid ${color}; max-width:420px; padding:0.85em 1.1em 0.8em 1.1em; font-family: var(--font-primary);
    ">
      <div style="display:flex; align-items:center; gap:0.7em; margin-bottom:0.5em;">
        <i class="fas ${icon}" style="font-size:2em;color:${color};"></i>
        <span style="font-size:1.12em; font-weight:bold; color:${color};">${nom}</span>
        <span style="margin-left:auto; font-size:1em; font-weight:500; color:#666;">Jet de sauvegarde</span>
      </div>
      <div style="font-size:1.09em; margin-bottom:0.25em;">
        Seuil&nbsp;: <b>${valeur}</b>
        &nbsp;&nbsp;|&nbsp;&nbsp;Résultat&nbsp;: <b>${roll.total}</b>
        ${bonusSave ? `&nbsp;&nbsp;|&nbsp;&nbsp;Effets&nbsp;: <b>${bonusSave >= 0 ? "+" : ""}${bonusSave}</b> → <b>${totalJet}</b>` : ""}
      </div>
      <div style="margin:0.2em 0 0.1em 0; font-size:1.1em;">
        <span style="font-weight:600; color:${reussite ? "#1cb360" : "#c34040"};">
          ${reussite ? "✔️ Réussite" : "❌ Échec"}
        </span>
      </div>
    </div>
  `;

  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: this.actor }),
    content: htmlCard
  });
});

html.find('.add2e-thief-skill-roll').off('click.add2e').on('click.add2e', async ev => {
  ev.preventDefault();
  ev.stopPropagation();
  const key = $(ev.currentTarget).data('thief-skill-key');
  await add2eRollThiefSkill(this.actor, key);
});

// 2. Click sur image/nom = attaque directe
html.find('.arme-img-attack').off('click').on('click', async ev => {
  const itemId = $(ev.currentTarget).data("item-id");
  const arme = this.actor.items.get(itemId);
  if (!arme) return;
  await globalThis.add2eAttackRoll({ actor: this.actor, arme });
});

html.find('.arme-img-attack').attr('draggable', 'true').off('dragstart').on('dragstart', ev => {
  const itemId = $(ev.currentTarget).data("item-id");
  const item = this.actor.items.get(itemId);
  if (!item) return;
  // Utilise l’UUID Foundry v10+ (fonctionne pour tout item, monstre ou non)
  const dragData = {
    type: "Item",
    uuid: item.uuid // Toujours la bonne référence
  };
  ev.originalEvent.dataTransfer.setData("text/plain", JSON.stringify(dragData));
});

// 2. Actions diverses groupées
html.find('[data-action]').off().on('click', async ev => {
  ev.stopPropagation();
  this._add2eRememberActiveTab(html);

  const $el = $(ev.currentTarget);
  const action = $el.data('action');
  const itemId = $el.data('item-id');
  const sortId = $el.data('sort-id');

  const actionNorm = String(action ?? "").trim().toLowerCase();
  const hasFeatureMarker =
    $el.data("feature-index") !== undefined ||
    $el.data("feature-name") !== undefined ||
    $el.data("feature-id") !== undefined ||
    $el.data("feature-key") !== undefined ||
    $el.data("on-use") !== undefined ||
    $el.closest("[data-feature-index], [data-feature-name], [data-feature-id], [data-feature-key], [data-on-use]").length > 0;

  const candidateFeature = add2eFindClassFeatureFromElement(this.actor, ev.currentTarget);
  const looksLikeFeatureUse =
    hasFeatureMarker ||
    actionNorm.includes("feature") ||
    actionNorm.includes("capacite") ||
    actionNorm.includes("capacité") ||
    actionNorm === "use-class-feature" ||
    actionNorm === "class-feature-use" ||
    (candidateFeature && !itemId && !sortId && (
      actionNorm === "use" ||
      actionNorm === "utiliser" ||
      actionNorm.includes("use") ||
      String($el.text() ?? "").trim().toLowerCase().includes("utiliser")
    ));

  if (looksLikeFeatureUse && candidateFeature) {
    await add2eExecuteClassFeatureOnUse(this.actor, candidateFeature, this);
    return;
  }

  if (looksLikeFeatureUse && !candidateFeature) {
    console.warn("[ADD2E][CAPACITE][CLICK] Bouton détecté mais capacité introuvable", {
      action,
      dataset: { ...($el[0]?.dataset ?? {}) },
      text: $el.text?.(),
      features: add2eGetActorActivableClassFeatures(this.actor).map(f => ({
        name: add2eFeatureName(f),
        on_use: add2eFeatureOnUse(f)
      }))
    });
    ui.notifications.warn("Capacité de classe introuvable pour ce bouton. Voir console [ADD2E][CAPACITE][CLICK].");
    return;
  }

  await handleItemAction({
    actor: this.actor,
    action,
    itemId,
    sheet: this
  });
});

// Fallback pour les boutons Utiliser de capacité qui n'ont pas data-action.
html.find('.add2e-feature-use, button, a, .a2e-btn').off('click.add2eFeatureFallback').on('click.add2eFeatureFallback', async ev => {
  const $el = $(ev.currentTarget);
  if ($el.data('item-id') || $el.data('sort-id')) return;

  const label = String($el.text?.() ?? "").trim().toLowerCase();
  const action = String($el.data('action') ?? "").trim().toLowerCase();
  const hasFeatureMarker =
    $el.hasClass('add2e-feature-use') ||
    $el.data("feature-index") !== undefined ||
    $el.data("feature-name") !== undefined ||
    $el.data("feature-id") !== undefined ||
    $el.data("feature-key") !== undefined ||
    $el.data("on-use") !== undefined;

  if (!hasFeatureMarker && !label.includes("utiliser") && !action.includes("feature") && !action.includes("capacite") && !action.includes("capacité")) return;

  const feature = add2eFindClassFeatureFromElement(this.actor, ev.currentTarget);
  if (!feature) return;

  ev.preventDefault();
  ev.stopPropagation();
  this._add2eRememberActiveTab(html);
  await add2eExecuteClassFeatureOnUse(this.actor, feature, this);
});

html.find('.roll-initiative-btn').off().on('click', async ev => {
  ev.preventDefault();
  const arme = this.actor.items.find(i => i.type === "arme" && i.system.equipee);
  const facteur = arme ? (Number(arme.system.facteur_rapidité) || 0) : 0;
  const roll = new Roll("1d6 + " + facteur);
  await roll.evaluate();
  await this.actor.update({ "system.initiative": roll.total });

  // Mets à jour dans le combat tracker si token actif
  const token = this.actor.getActiveTokens()[0];
  if (token && game.combat) {
    const combatant = game.combat.combatants.find(c => c.tokenId === token.id);
    if (combatant) {
      await combatant.update({ initiative: roll.total });
      await triInitiativeAscendant();
    }
  }
  roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor: this.actor }),
    flavor: `Initiative (facteur arme ${facteur >= 0 ? "+" : ""}${facteur})`
  });
});

// Depuis la fiche (dans ton click handler)
html.find('.arme-thaco-roll').off().on('click', async ev => {
  const itemId = $(ev.currentTarget).data("item-id");
  const arme = this.actor.items.get(itemId);
  if (!arme) return;
  await add2eAttackRoll({ actor: this.actor, arme });
});

    html.find('input[name="actor.name"]').off('change.add2e').on("change.add2e", async ev => {
      const newName = ev.target.value.trim();
      if (newName && newName !== this.actor.name) {
        await this.actor.update({ name: newName });
        this.render(false);
      }
    });

    html.find('.roll-caracs-btn').off('click.add2e').on('click.add2e', ev => {
      ev.preventDefault();
      if (typeof Add2eCaracRoller !== "undefined") {
        new Add2eCaracRoller(this);
      } else {
        ui.notifications.warn("Le module de tirage de caractéristiques n'est pas chargé !");
      }
    });

html.find('.armure-equip').off().on('click', async ev => {
  ev.preventDefault();
  ev.stopPropagation();
  this._add2eRememberActiveTab(html);

  const itemId = $(ev.currentTarget).data("item-id");
  await handleItemAction({
    actor: this.actor,
    action: "equip",
    itemId,
    itemType: "armure",
    sheet: this
  });
});

// Édition d'une armure
html.find('.armure-edit').off().on('click', ev => {
  const itemId = $(ev.currentTarget).data("item-id");
  const item = this.actor.items.get(itemId);
  if (item) item.sheet.render(true);
});

// Suppression d'une armure
html.find('.armure-delete').off().on('click', async ev => {
  const itemId = $(ev.currentTarget).data("item-id");
  await this.actor.deleteEmbeddedDocuments("Item", [itemId]);
  this.render(false);
});
// ============================================================
    // GESTION ÉQUIPEMENT (OBJETS DIVERS)
    // ============================================================

    // 1. CRÉER UN OBJET
    html.find('.objet-create').off("click").on("click", async ev => {
      ev.preventDefault();
      await Item.create({
        name: "Nouvel Objet",
        type: "objet",
        img: "icons/containers/bags/sack-cloth-tan.webp",
        system: { quantite: 1, poids: 0, equipee: false }
      }, { parent: this.actor });
    });

// 2. ÉQUIPER / DÉSÉQUIPER (Avec Script & Effets)
    html.find('.objet-equip').off("click").on("click", async ev => {
      ev.preventDefault();
      const li = $(ev.currentTarget).closest(".item");
      const itemId = li.data("itemId");
      const item = this.actor.items.get(itemId);
      
      if (item) {
         // 1. Bascule de l'état (Équipé <-> Non équipé)
         const newState = !item.system.equipee;
         await item.update({"system.equipee": newState});
         
         if (newState) {
             // --- CAS ACTIVATION (Équipé) ---
             // On regarde s'il y a un script 'onUse' à lancer
             const scriptPath = item.system.onUse || item.system.onuse;
             
             if (scriptPath) {
                 try {
                    const response = await fetch(scriptPath);
                    if (response.ok) {
                        const code = await response.text();
                        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
                        
                        // On passe 'item' comme source. 'sort' est null ici.
                        const fn = new AsyncFunction("actor", "item", "sort", code);
                        await fn(this.actor, item, null);
                        
                        ui.notifications.info(`${item.name} : Activé`);
                    } else {
                        console.warn(`[ADD2e] Script introuvable : ${scriptPath}`);
                    }
                 } catch(e) {
                    console.error(`[ADD2e] Erreur script objet :`, e);
                    ui.notifications.error(`Erreur script sur ${item.name}`);
                 }
             }
         } else {
             // --- CAS DÉSACTIVATION (Déséquipé) ---
             // On supprime automatiquement les effets liés à cet objet
             // (Ceux dont l'origine est l'UUID de l'objet)
             const effectsToDelete = this.actor.effects
                .filter(e => e.origin === item.uuid)
                .map(e => e.id);
             
             if (effectsToDelete.length > 0) {
                 await this.actor.deleteEmbeddedDocuments("ActiveEffect", effectsToDelete);
                 ui.notifications.info(`${item.name} : Désactivé (Effets retirés)`);
             }
         }

         // 3. Rafraîchissement de la fiche
         this.render(false);
      }
    });

    // 3. ÉDITER
    html.find('.objet-edit').off("click").on("click", ev => {
       ev.preventDefault();
       const li = $(ev.currentTarget).closest(".item");
       const itemId = li.data("itemId");
       const item = this.actor.items.get(itemId);
       if (item) item.sheet.render(true);
    });

    // 4. SUPPRIMER
    html.find('.objet-delete').off("click").on("click", async ev => {
       ev.preventDefault();
       const li = $(ev.currentTarget).closest(".item");
       const itemId = li.data("itemId");
       await this.actor.deleteEmbeddedDocuments("Item", [itemId]);
    });
    html.find('input[name="system.niveau"]').off('change.add2e').on("change.add2e", async ev => {
      let v = parseInt(ev.target.value, 10) || 1;
      const clamp = add2eClampLevelToClassMax(this.actor, v, null, { notify: true });
      v = clamp.level;
      ev.target.value = v;
      await this.actor.update({ "system.niveau": v });
      try { await add2eSyncMonkUnarmedWeapon(this.actor); } catch (e) { console.warn("[ADD2E][MOINE] Sync niveau échoué", e); }
      try { await add2eSyncClassPassiveEffect(this.actor); } catch (e) { console.warn("[ADD2E][CLASSE][EFFETS] Sync niveau échoué", e); }
      this.render(false);
    });
// Accordéon description (affiche/masque la description du sort)
html.find('.toggle-sort-desc-chat').off('click').on('click', function(ev) {
  ev.preventDefault();
  ev.stopPropagation();
  const sortId = $(this).data('sort-id');
  const descRow = html.find(`#desc-chat-${sortId}`);
  descRow.slideToggle(160);
  return false;
});

// Éditer le sort
html.find('.sort-edit').off().on('click', function(ev) {
  ev.preventDefault();
  ev.stopPropagation();
  const sortId = $(this).data('sort-id');
  const sort = self.actor.items.get(sortId);
  if (sort) sort.sheet.render(true);
  return false;
});

// Supprimer le sort
html.find('.sort-delete').off().on('click', async function(ev) {
  ev.preventDefault();
  ev.stopPropagation();
  const sortId = $(this).data('sort-id');
  await self.actor.deleteEmbeddedDocuments("Item", [sortId]);
  add2eRerenderActorSheet(self.actor);
  return false;
});

// Dans votre Add2eSortSheet.activateListeners(html)
html.find('.sort-memorize-plus, .sort-memorize-minus')
  .off('click')
  .on('click', async ev => {
    ev.preventDefault();
    ev.stopPropagation();

    const $btn = $(ev.currentTarget);
    const sortId = $btn.data('sort-id');
    const sort = this.actor.items.get(sortId);
    if (!sort) return;

    const isPlus = $btn.hasClass('sort-memorize-plus');
    const niv = Number(sort.system?.niveau ?? sort.system?.level ?? 1) || 1;
    const requestedEntryKey = add2eNormalizeSpellKey($btn.data('spell-entry-key') || $btn.attr('data-spell-entry-key') || "");

    let check = add2eCanActorUseSpell(this.actor, sort);

    if (requestedEntryKey) {
      const entries = add2eGetSpellcastingEntries(this.actor);
      const sortLists = add2eGetSpellListsFromItem(sort);
      const requestedEntry = entries.find(e => add2eNormalizeSpellKey(e.key) === requestedEntryKey) || null;

      if (!requestedEntry || !sortLists.includes(requestedEntryKey)) {
        return ui.notifications.warn(`Ce sort ne peut pas être préparé comme ${requestedEntry?.label || requestedEntryKey}.`);
      }

      const actorLevel = Math.max(1, Number(this.actor?.system?.niveau) || 1);
      const startsAt = Number(requestedEntry.startsAt || 1);
      const maxLevel = Number(requestedEntry.maxSpellLevel || 0);

      if (actorLevel < startsAt) {
        return ui.notifications.warn(`${requestedEntry.label || "Cette ligne de sorts"} n'est disponible qu'à partir du niveau ${startsAt}.`);
      }
      if (maxLevel && niv > maxLevel) {
        return ui.notifications.warn(`${requestedEntry.label || "Cette ligne de sorts"} ne permet pas les sorts de niveau ${niv}.`);
      }

      check = { ok: true, reason: "ok", entry: requestedEntry };
    }

    if (!check.ok) {
      const entry = check.entry;
      if (check.reason === "start") {
        return ui.notifications.warn(`${entry?.label || "Cette ligne de sorts"} n'est disponible qu'à partir du niveau ${entry?.startsAt}.`);
      }
      if (check.reason === "max-level") {
        return ui.notifications.warn(`${entry?.label || "Cette ligne de sorts"} ne permet pas les sorts de niveau ${niv}.`);
      }
      return ui.notifications.warn(`Ce sort n'est pas autorisé pour cette classe.`);
    }

    const entry = check.entry;
    let cur = add2eGetMemorizedCountForEntry(sort, entry);

    if (isPlus) {
      const limit = add2eGetSlotsForEntryLevel(this.actor, entry, niv);
      const total = add2eCountPreparedForEntryLevel(this.actor, entry, niv);

      if (limit <= 0) {
        return ui.notifications.warn(`Aucun emplacement ${entry.label} de niveau ${niv} disponible.`);
      }

      if (total >= limit) {
        return ui.notifications.warn(`Limite atteinte : ${entry.label} niveau ${niv} (${total}/${limit}).`);
      }

      cur++;
    } else {
      if (cur > 0) cur--;
      else return ui.notifications.warn(`Aucun emplacement ${entry.label} à libérer.`);
    }

    await add2eSetMemorizedCountForEntry(sort, entry, cur);
    add2eRerenderActorSheet(this.actor);
  });

// Clic pour lancer le sort ou un pouvoir d'objet magique
// -----------------------------------------------------------
// Mécanique conservée : les pouvoirs d'objets sont reconstruits en faux Item sort,
// puis envoyés dans add2eCastSpell comme le faisait déjà le Bâton de Magius.
// Le branchement est seulement rendu délégué pour rester actif après les réinjections UI.
html
  .off("click.add2eSortCast")
  .on("click.add2eSortCast", ".sort-cast, .sort-cast-img, .add2e-object-magic-cast", async function(ev) {
    ev.preventDefault();
    ev.stopPropagation();

    const sortId = String(
      this.dataset?.sortId ||
      this.getAttribute?.("data-sort-id") ||
      $(this).data("sort-id") ||
      ""
    ).trim();

    const debug = !!globalThis.ADD2E_DEBUG_OBJETS_MAGIQUES;

    if (debug) {
      console.group("[ADD2E][OBJETS_MAGIQUES][CLICK]");
      console.log("element", this);
      console.log("sortId", sortId);
    }

    if (!sortId) {
      if (debug) console.groupEnd();
      ui.notifications.warn("Impossible de lancer : identifiant du sort introuvable.");
      return false;
    }

    // 1. Sort réel présent dans l'acteur.
    let sort = self.actor.items.get(sortId) ?? null;

    if (debug) console.log("Sort réel trouvé", !!sort, sort);

    // 2. Pouvoir virtuel d'objet magique : on retrouve l'objet source + l'index du pouvoir.
    if (!sort) {
      const itemSources = self.actor.items.filter(i => {
        if (!["arme", "armure", "objet", "object", "magic", "objet_magique"].includes(String(i.type || "").toLowerCase())) return false;

        // Ne pas filtrer agressivement sur equipee : la section objets magiques affiche volontairement
        // les objets magiques possédés, et le Bâton de Magius fonctionnait avec cette logique souple.
        if (typeof add2eMagicItemEquippedOrUsable === "function") {
          if (!add2eMagicItemEquippedOrUsable(i)) return false;
        } else if (i.system?.equipee === false) return false;

        const pouvoirs = typeof add2eMagicObjectPowerArray === "function"
          ? add2eMagicObjectPowerArray(i)
          : (() => {
              const raw = i.system?.pouvoirs ?? i.system?.powers ?? i.system?.pouvoirsMagiques ?? i.system?.magicalPowers ?? i.system?.sorts ?? i.system?.spells;
              if (Array.isArray(raw)) return raw.filter(p => p && typeof p === "object");
              if (raw && typeof raw === "object") return Object.values(raw).filter(p => p && typeof p === "object");
              return [];
            })();

        return pouvoirs.length > 0;
      });

      if (debug) {
        console.log("Sources objets magiques candidates", itemSources.map(i => ({ id: i.id, name: i.name, type: i.type })));
      }

      for (const itemSource of itemSources) {
        const pouvoirs = typeof add2eMagicObjectPowerArray === "function"
          ? add2eMagicObjectPowerArray(itemSource)
          : (() => {
              const raw = itemSource.system?.pouvoirs ?? itemSource.system?.powers ?? itemSource.system?.pouvoirsMagiques ?? itemSource.system?.magicalPowers ?? itemSource.system?.sorts ?? itemSource.system?.spells;
              if (Array.isArray(raw)) return raw.filter(p => p && typeof p === "object");
              if (raw && typeof raw === "object") return Object.values(raw).filter(p => p && typeof p === "object");
              return [];
            })();

        for (let idx = 0; idx < pouvoirs.length; idx++) {
          const generatedId = typeof add2eMagicPowerGeneratedId === "function"
            ? add2eMagicPowerGeneratedId(itemSource, idx)
            : itemSource.id.substring(0, 14) + idx.toString().padStart(2, "0");

          if (debug) {
            console.log("[CHECK POUVOIR OBJET]", {
              item: itemSource.name,
              idx,
              generatedId,
              sortId,
              match: generatedId === sortId,
              pouvoir: pouvoirs[idx]
            });
          }

          if (generatedId !== sortId) continue;

          if (typeof add2eBuildVirtualObjectPowerSort === "function") {
            sort = add2eBuildVirtualObjectPowerSort(self.actor, itemSource, pouvoirs[idx], idx);
          } else {
            const p = pouvoirs[idx];
            const onUse = String(p?.onUse ?? p?.onuse ?? p?.on_use ?? p?.script ?? "").trim();
            const cost = Math.max(0, Number(p?.cout ?? p?.cost ?? 0) || 0);
            const maxGlobal = Number(itemSource.system?.charges?.max ?? itemSource.system?.max_charges ?? 0) || 0;
            const isGlobal = maxGlobal > 0;
            const max = cost <= 0 ? 1 : (isGlobal ? maxGlobal : (Number(p?.max ?? p?.charges ?? 1) || 1));

            sort = new Item({
              _id: generatedId,
              name: String(p?.name ?? p?.nom ?? itemSource.name ?? "Pouvoir"),
              type: "sort",
              img: p?.img || itemSource.img,
              system: {
                niveau: Number(p?.niveau ?? p?.level ?? 1) || 1,
                école: p?.ecole || p?.["école"] || "Magique",
                description: p?.description || "",
                composantes: "Objet",
                temps_incantation: p?.activation || "Objet magique",
                isPower: true,
                isObjectPower: true,
                sourceWeaponId: itemSource.id,
                sourceItemId: itemSource.id,
                sourceItemName: itemSource.name,
                powerIndex: idx,
                cost,
                cout: cost,
                max,
                isGlobalCharge: isGlobal,
                onUse,
                onuse: onUse,
                on_use: onUse
              },
              flags: {
                add2e: {
                  memorizedCount: cost <= 0 ? 1 : max,
                  originalOnUse: onUse,
                  sourceType: "objet_magique",
                  sourceItemId: itemSource.id,
                  sourceItemName: itemSource.name,
                  powerIndex: idx
                }
              }
            }, { parent: self.actor });

            sort.getFlag = (scope, key) => {
              if (scope !== "add2e") return null;
              if (key === "memorizedCount") return cost <= 0 ? 1 : max;
              if (key === "originalOnUse") return onUse;
              return sort.flags?.add2e?.[key] ?? null;
            };
          }

          if (debug) {
            console.log("[POUVOIR VIRTUEL REBRANCHÉ]", {
              sort,
              system: sort?.system,
              flags: sort?.flags,
              memorizedCount: sort?.getFlag?.("add2e", "memorizedCount")
            });
          }

          break;
        }

        if (sort) break;
      }
    }

    // 3. Lancement par la mécanique existante.
    if (sort) {
      if (typeof globalThis.add2eCastSpell === "function") {
        if (debug) {
          console.log("[LANCEMENT add2eCastSpell]", {
            actor: self.actor?.name,
            sort: sort.name,
            sortId: sort.id,
            system: sort.system,
            flags: sort.flags
          });
          console.groupEnd();
        }

        await globalThis.add2eCastSpell({ actor: self.actor, sort });
        self.render(false);
      } else {
        if (debug) console.groupEnd();
        ui.notifications.error("La fonction add2eCastSpell est introuvable.");
      }
    } else {
      if (debug) {
        console.warn("Aucun sort/pouvoir retrouvé pour", sortId);
        console.groupEnd();
      }
      ui.notifications.warn("Impossible de retrouver les données de ce sort ou pouvoir d'objet magique.");
    }

    return false;
  });

// Drag’n’drop de l’icône
html.find('.sort-cast-img')
  .off('dragstart')
  .on('dragstart', ev => {
    const sortId = $(ev.currentTarget).data('sort-id');
    const item   = this.actor.items.get(sortId);
    if (!item) return;
    ev.originalEvent.dataTransfer.setData(
      "text/plain",
      JSON.stringify({ type: "Item", uuid: item.uuid })
    );
  });
html.find('.file-picker').off().on('click', ev => {
    const target = $(ev.currentTarget).data('target');
    new FilePicker({
      type: "image",
      current: this.item.img || "icons/svg/mystery-man.svg",
      callback: path => {
        this.item.update({ [target]: path });
        html.find('input[name="img"]').val(path);
        html.find('img[alt="Icône"]').attr('src', path);
      }
    }).render(true);
  });
html.find('input[name="name"]').off('change.add2e').on("change.add2e", async ev => {
  const newName = ev.target.value.trim();
  if (newName && newName !== this.actor.name) {
    // 1. Mets à jour l'acteur (name)
    await this.actor.update({ name: newName });
    // 2. Mets à jour le prototype du token (pour les nouveaux tokens)
    await this.actor.update({ "prototypeToken.name": newName });

    // 3. Mets à jour les tokens existants sur la scène (optionnel)
    for (let t of this.actor.getActiveTokens()) {
      if (t.document && t.document.name !== newName) {
        await t.document.update({ name: newName });
      }
    }

    this.render(false);
  }
});

html.find('.file-picker').off().on('click', ev => {
  const target = $(ev.currentTarget).data('target');
  new FilePicker({
    type: "image",
    current: this.actor.img || "icons/svg/mystery-man.svg",
    callback: path => {
      majImageToken(this.actor, path);
      html.find('input[name="img"]').val(path);
      html.find('img[alt="Image du monstre"]').attr('src', path); // adapte si besoin
    }
  }).render(true);
});

     this.autoSetCaracAjustements();
  }

async _onDrop(event) {
  event.preventDefault();
  event.stopPropagation();
  let raw;
  try {
    raw = JSON.parse(event.dataTransfer.getData("text/plain"));
  } catch {
    console.warn("[ADD2E] Drop non JSON, fallback natif");
    return super._onDrop(event);
  }

  if (raw.type !== "Item") return super._onDrop(event);

  let itemData = raw.data;
  if (!itemData && raw.uuid) {
    const doc = await fromUuid(raw.uuid);
    if (doc instanceof Item) itemData = doc.toObject();
  }
  if (!itemData && raw.pack && raw.id) {
    const pack = game.packs.get(raw.pack);
    const ent = pack && await pack.getDocument(raw.id);
    if (ent instanceof Item) itemData = ent.toObject();
  }
  if (!itemData) {
    console.warn("[ADD2E] _onDrop impossible de reconstruire itemData", raw);
    return super._onDrop(event);
  }

  const VALID = ["arme", "armure", "sort", "classe", "race"];
  if (!VALID.includes(itemData.type)) return super._onDrop(event);

 // --- Validation générique du drop de sort par lignes de sorts
if (itemData.type === "sort") {
  console.log("=== [ADD2E DROP SORT][POOLS] ===");
  console.log("actor:", { id: this.actor?.id, name: this.actor?.name });
  console.log("itemData:", itemData);

  let source = null;

  if (itemData.uuid) {
    source = await fromUuid(itemData.uuid);
  }

  if (!source && itemData.pack && itemData._id) {
    const pack = game.packs.get(itemData.pack);
    if (pack) source = await pack.getDocument(itemData._id);
  }

  if (!source && itemData.system) {
    source = { name: itemData.name, type: itemData.type, system: itemData.system };
  }

  if (!source || !source.system) {
    console.log("[ADD2E DROP SORT][POOLS] ❌ FAIL: source unresolved");
    ui.notifications.error("Impossible de résoudre le sort.");
    return false;
  }

  const check = add2eCanActorUseSpell(this.actor, source);

  console.log("[ADD2E DROP SORT][POOLS] check:", {
    sort: source.name,
    sortLists: check.sortLists,
    actorEntries: check.entries,
    selectedEntry: check.entry,
    reason: check.reason,
    actorLevel: check.actorLevel,
    spellLevel: check.spellLevel
  });

  if (!check.sortLists?.length) {
    ui.notifications.error(`Sort non migré : “${source.name}” n’a pas system.spellLists.`);
    return false;
  }

  if (!check.ok) {
    const entry = check.entry;
    if (check.reason === "list") {
      ui.notifications.error(`${this.actor.name} ne peut pas apprendre ou préparer “${source.name}” : ligne de sort non autorisée (${check.sortLists.map(add2eSpellLabel).join(", ")}).`);
    } else if (check.reason === "start") {
      ui.notifications.error(`${this.actor.name} ne peut pas encore préparer “${source.name}” : ${entry?.label || "cette ligne"} commence au niveau ${entry?.startsAt}.`);
    } else if (check.reason === "max-level") {
      ui.notifications.error(`${this.actor.name} ne peut pas préparer “${source.name}” : ${entry?.label || "cette ligne"} est limitée aux sorts de niveau ${entry?.maxSpellLevel}.`);
    } else {
      ui.notifications.error(`${this.actor.name} ne peut pas apprendre ou préparer “${source.name}”.`);
    }
    return false;
  }

  console.log("[ADD2E DROP SORT][POOLS] ✅ DROP SORT OK", {
    sort: source.name,
    list: check.entry?.label,
    spellLevel: check.spellLevel
  });
}
// --- Prévalidation race/classe AVANT toute modification de l'acteur.
  // Important : on ne met plus à jour system.classe/details_classe avant validation,
  // sinon un drop refusé laisse la fiche avec des données mélangées.
  // Si seule la compatibilité race/classe bloque, on corrige automatiquement
  // comme pour l'alignement : drop classe => race compatible ; drop race => classe compatible.
  let add2eClassAlignmentCandidate = null;
  let add2eAutoRaceCandidateData = null;
  let add2eAutoClassCandidateData = null;
  let add2eAutoClassAlignmentCandidate = null;

  if (itemData.type === "classe") {
    add2eClassAlignmentCandidate = add2ePickClassAlignment(this.actor, itemData.system ?? {});

    if (typeof checkClassStatMin === "function") {
      let ok = checkClassStatMin(this.actor, itemData, null, add2eClassAlignmentCandidate, { silent: true, ignoreLevelMax: true });

      if (!ok) {
        const compatibleRace = add2eFindCompatibleRaceForClass(this.actor, itemData, add2eClassAlignmentCandidate);
        if (compatibleRace) {
          add2eAutoRaceCandidateData = compatibleRace;
          ok = checkClassStatMin(this.actor, itemData, compatibleRace, add2eClassAlignmentCandidate, { silent: true, ignoreLevelMax: true });
        }
      }

      if (!ok) {
        // Dernier appel non silencieux pour conserver le message précis des vrais prérequis bloquants.
        checkClassStatMin(this.actor, itemData, add2eAutoRaceCandidateData, add2eClassAlignmentCandidate, { silent: false, ignoreLevelMax: true });
        console.warn("[ADD2e] Blocage prise de classe (aucune race compatible trouvée ou prérequis NON atteints)", {
          actor: this.actor?.name,
          classe: itemData?.name,
          raceAuto: add2eAutoRaceCandidateData?.name ?? null,
          alignementTeste: add2eClassAlignmentCandidate
        });
        add2eRerenderActorSheet(this.actor);
        return false;
      }
    } else {
      console.warn("[ADD2e] Fonction checkClassStatMin NON trouvée !");
    }
  }

  if (itemData.type === "race") {
    const existingClass = this.actor.items.find(i => i.type === "classe");
    if (existingClass && typeof checkClassStatMin === "function") {
      let existingAlignment = add2ePickClassAlignment(this.actor, existingClass.system ?? {});
      let ok = checkClassStatMin(
        this.actor,
        existingClass,
        itemData,
        existingAlignment,
        { silent: true, ignoreLevelMax: true }
      );

      if (!ok) {
        const compatibleClass = add2eFindCompatibleClassForRace(this.actor, itemData);
        if (compatibleClass?.classData) {
          add2eAutoClassCandidateData = compatibleClass.classData;
          add2eAutoClassAlignmentCandidate = compatibleClass.alignmentCandidate;
          ok = checkClassStatMin(
            this.actor,
            add2eAutoClassCandidateData,
            itemData,
            add2eAutoClassAlignmentCandidate,
            { silent: true, ignoreLevelMax: true }
          );
        }
      }

      if (!ok) {
        checkClassStatMin(
          this.actor,
          add2eAutoClassCandidateData ?? existingClass,
          itemData,
          add2eAutoClassAlignmentCandidate ?? existingAlignment,
          { silent: false, ignoreLevelMax: true }
        );
        console.warn("[ADD2e] Blocage prise de race (aucune classe compatible trouvée ou prérequis NON atteints)", {
          actor: this.actor?.name,
          race: itemData?.name,
          classeActuelle: existingClass?.name,
          classeAuto: add2eAutoClassCandidateData?.name ?? null
        });
        add2eRerenderActorSheet(this.actor);
        return false;
      }
    }
  }

  // Drop d'une classe incompatible avec la race actuelle : on remplace la race avant
  // de créer la classe, afin que la fiche reste cohérente et que le niveau max racial
  // soit calculé sur la bonne race.
  if (itemData.type === "classe" && add2eAutoRaceCandidateData) {
    await add2eApplyRaceItemDataToActor(this.actor, add2eAutoRaceCandidateData, this, {
      notify: true,
      reason: "class-drop-race-auto-compat"
    });
  }

  // --- Remplace ancienne race (et ses effets)
  if (itemData.type === "race") {
    const existingRaces = this.actor.items.filter(i => i.type === "race");
    for (const oldRace of existingRaces) {
      const raceEffects = this.actor.effects.filter(eff => eff.origin === oldRace.uuid);
      if (raceEffects.length) {
        const ids = raceEffects.map(e => e.id).filter(id => this.actor.effects.has(id));
        if (ids.length) {
          await this.actor.deleteEmbeddedDocuments("ActiveEffect", ids);
        }
      }
      await oldRace.delete();
    }
    // Supprime les anciens bonus raciaux
    await this.actor.update({ "system.bonus_caracteristiques": {} });
  }


// --- Changement de classe : purge ancienne classe + sorts + armes + armures
// Important : on ne supprime PAS la race.
// Important : suppression item par item, plus fiable sur token non lié / acteur synthétique.
if (itemData.type === "classe") {
  console.log("=== [ADD2E][DROP CLASSE][PURGE] ===", {
    actor: this.actor.name,
    nouvelleClasse: itemData.name,
    actorIsToken: this.actor.isToken ?? false,
    tokenId: this.actor.token?.id ?? null
  });

  const typesToDelete = ["classe", "sort", "arme", "armure", "spell", "weapon", "armor"];

  const itemsToDelete = this.actor.items.filter(i =>
    typesToDelete.includes(String(i.type || "").toLowerCase())
  );

  console.log("[ADD2E][DROP CLASSE][PURGE] items à supprimer :", itemsToDelete.map(i => ({
    id: i.id,
    name: i.name,
    type: i.type,
    uuid: i.uuid
  })));

  // Effets liés aux items supprimés et effets de classe générés sans origine fiable.
  const effectsToDelete = this.actor.effects.filter(eff =>
    add2eShouldDeleteEffectForClassPurge(eff, itemsToDelete)
  );

  console.log("[ADD2E][DROP CLASSE][PURGE] effets liés à supprimer :", effectsToDelete.map(e => ({
    id: e.id,
    name: e.name,
    origin: e.origin
  })));

  for (const eff of effectsToDelete) {
    await eff.delete({ render: false });
  }

  for (const it of itemsToDelete) {
    console.log("[ADD2E][DROP CLASSE][PURGE] suppression item :", {
      id: it.id,
      name: it.name,
      type: it.type
    });

    await it.delete({ render: false });
  }

  console.log("[ADD2E][DROP CLASSE][PURGE] items restants après purge :", this.actor.items.map(i => ({
    id: i.id,
    name: i.name,
    type: i.type
  })));
}

  // --- Anti-doublon (évite d'ajouter deux fois le même item)
  if (["arme", "armure", "sort"].includes(itemData.type)) {
    if (this.actor.items.some(i => i.name === itemData.name && i.type === itemData.type)) {
      ui.notifications.warn(`"${itemData.name}" est déjà présent sur cet acteur.`);
      return false;
    }
  }

  // --- Création de l'Item
  const [itemDoc] = await this.actor.createEmbeddedDocuments("Item", [foundry.utils.duplicate(itemData)]);
  if (!itemDoc) {
    console.warn("[ADD2E] Échec de création de l'item (itemDoc undefined) :", itemData);
    return false;
  }

   // --- Application effets embarqués SAUF pour les sorts
  if (itemData.type !== "sort" && itemDoc.effects.contents?.length) {
    const actorEffects = itemDoc.effects.contents.map(eff => {
      const data = foundry.utils.duplicate(eff.toObject());
      data.origin = itemDoc.uuid;
      data.disabled = false;
      data.transfer = false;
      data.flags = data.flags ?? {};
      data.flags.add2e = {
        ...(data.flags.add2e ?? {}),
        sourceType: itemDoc.type === "classe" ? "classe" : itemDoc.type,
        sourceClasse: itemDoc.type === "classe" ? itemDoc.name : undefined,
        sourceItemId: itemDoc.id,
        sourceItemUuid: itemDoc.uuid
      };
      return data;
    });
    await this.actor.createEmbeddedDocuments("ActiveEffect", actorEffects);
  }

  // --- Traitement spécial classe (alignements, etc.)
  // La mise à jour complète de system.classe/details_classe est faite plus bas,
  // après création effective de l'item classe.

  // --- Application effets et bonus pour race
  if (itemData.type === "race") {
    const raceSystem = foundry.utils.deepClone(itemDoc.system ?? {});
    await this.actor.update({
      "system.race": itemDoc.name,
      "system.details_race": {
        ...raceSystem,
        name: itemDoc.name,
        label: raceSystem.label || itemDoc.name,
        img: itemDoc.img || raceSystem.img || ""
      },
      "system.bonus_caracteristiques": raceSystem.bonus_caracteristiques
        ? foundry.utils.deepClone(raceSystem.bonus_caracteristiques)
        : {}
    });

    if (typeof this.autoSetCaracAjustements === "function") {
      await this.autoSetCaracAjustements();
    }

    // Drop d'une race incompatible avec la classe actuelle : on remplace la classe
    // par une classe compatible après l'application de la nouvelle race.
    if (add2eAutoClassCandidateData) {
      await add2eApplyClassItemDataToActor(this.actor, add2eAutoClassCandidateData, this, {
        alignmentCandidate: add2eAutoClassAlignmentCandidate,
        notify: true,
        reason: "race-drop-class-auto-compat"
      });
    } else {
      // La race peut modifier le niveau maximum autorisé de la classe actuelle.
      // On accepte le drop, puis on ramène proprement le niveau si nécessaire.
      try {
        const currentClass = this.actor.items.find(i => i.type === "classe");
        if (currentClass) {
          const classSystem = foundry.utils.deepClone(currentClass.system ?? this.actor.system?.details_classe ?? {});
          const clamp = add2eClampLevelToClassMax(this.actor, this.actor.system?.niveau, classSystem, { notify: true });
          if (clamp.changed) {
            await this.actor.update({ "system.niveau": clamp.level }, { add2eInternal: true });
            if (typeof this.autoSetPointsDeCoup === "function") {
              await this.autoSetPointsDeCoup({ syncCurrent: true, force: true, reason: "race-drop-level-clamp" });
            }
          }
        }
      } catch (e) {
        console.warn("[ADD2E][DROP RACE][NIVEAU MAX] Erreur correction niveau max après drop race", e);
      }
    }
  }

  // --- Application effets + sauvegardes pour classe
  if (itemData.type === "classe") {
    const classSystem = foundry.utils.deepClone(itemDoc.system ?? {});
    const levelClamp = add2eClampLevelToClassMax(this.actor, this.actor.system?.niveau, classSystem, { notify: true });
    const alns = add2eClassAllowedAlignments(classSystem);
    const updates = {
      "system.classe": itemDoc.name,
      "system.details_classe": classSystem,
      "system.spellcasting": classSystem.spellcasting ?? null,
      "system.alignements_autorises": alns
    };

    if (levelClamp.changed) {
      updates["system.niveau"] = levelClamp.level;
    }

    if (add2eClassAlignmentCandidate) {
      updates["system.alignement"] = add2eClassAlignmentCandidate;
    }

    if (itemDoc.system?.progression?.[0]?.sauvegardes) {
      updates["system.sauvegardes"] = foundry.utils.duplicate(itemDoc.system.progression[0].sauvegardes);
    }

    await this.actor.update(updates);
    if (typeof this.autoSetCaracAjustements === "function") {
      await this.autoSetCaracAjustements();
    }
   if (typeof this.autoSetPointsDeCoup === "function") {
  await this.autoSetPointsDeCoup({ syncCurrent: true, force: true, reason: "class-drop" });
}
    try {
      await add2eSyncMonkUnarmedWeapon(this.actor);
    } catch (e) {
      console.warn("[ADD2E][MOINE] Erreur synchronisation Main nue après drop classe :", e);
    }

    try {
      await add2eSyncClassPassiveEffect(this.actor);
    } catch (e) {
      console.warn("[ADD2E][CLASSE][EFFETS] Erreur synchronisation des effets de classe :", e);
    }

    try {
      const spellSync = await add2eSyncActorSpellsFromClass(this.actor, itemDoc, { mode: "replace", showWait: true });
      if (spellSync?.handled) {
        ui.notifications.info(
          `Sorts de ${itemDoc.name} synchronisés : ${spellSync.imported} importé(s).`
        );
      }
    } catch (e) {
      console.error("[ADD2E][CLASSE][SORTS] Erreur synchronisation des sorts après drop classe :", e);
      ui.notifications.error("Erreur pendant la synchronisation des sorts de classe.");
    }
  }

  this.render(false);
  return true;
}




}

Actors.registerSheet("add2e", Add2eActorSheet, {
  types: ["personnage"], makeDefault: true, label: "ADD2e Personnage"
});




globalThis.Add2eActorSheet = Add2eActorSheet;

// Exposition globale conservée pour compatibilité avec le code legacy et les scripts onUse.
try { globalThis.Add2eActorSheet = Add2eActorSheet; } catch (_e) {}
