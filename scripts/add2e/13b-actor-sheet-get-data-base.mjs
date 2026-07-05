// ADD2E — Actor sheet getData : Race, Classe, capacités et équipement.

function add2eThiefActivityNormalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function add2eThiefActivityValues(value) {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(add2eThiefActivityValues);
  if (value instanceof Set) return [...value].flatMap(add2eThiefActivityValues);
  if (typeof value === "object") {
    for (const key of ["tags", "effectTags", "effecttags", "list", "items", "value"]) {
      if (value[key] !== undefined) return add2eThiefActivityValues(value[key]);
    }
  }
  return [value];
}

function add2eThiefActivityItemEquipped(item) {
  const system = item?.system ?? {};
  return [system.equipee, system.equipped, system.portee, system.worn, system.estEquipee, system.est_equipee, system.equipe]
    .some(value => value === true || ["true", "1", "yes", "oui", "on", "equipped", "equipe", "équipé", "equipee", "équipée", "worn", "portee", "portée"].includes(String(value ?? "").trim().toLowerCase()));
}

function add2eThiefActivityClassIsThief(item) {
  const system = item?.system ?? {};
  const values = [
    item?.name,
    system.slug,
    system.label,
    system.nom,
    system.name,
    system.classe,
    ...add2eThiefActivityValues(system.tags),
    ...add2eThiefActivityValues(system.effectTags)
  ].map(add2eThiefActivityNormalize).filter(Boolean);
  return values.some(value => value === "voleur" || value.includes("voleur") || value === "assassin" || value.includes("assassin"));
}

function add2eThiefActivityArmorIsLeather(item) {
  const system = item?.system ?? {};
  const values = [
    item?.name,
    system.nom,
    system.matiere,
    system.material,
    system.type_armure,
    system.type,
    ...add2eThiefActivityValues(system.tags),
    ...add2eThiefActivityValues(system.effectTags),
    ...add2eThiefActivityValues(item?.flags?.add2e?.tags),
    ...add2eThiefActivityValues(item?.flags?.add2e?.effectTags)
  ].map(add2eThiefActivityNormalize).filter(Boolean);

  return values.some(value => value === "cuir"
    || value.includes("matiere_cuir")
    || value.includes("type_armure_cuir")
    || value.includes("armure_cuir")
    || value.includes("leather"));
}

export function add2ePrepareThiefActivityData(actor) {
  const classes = Array.from(actor?.items ?? []).filter(item => String(item?.type ?? "").toLowerCase() === "classe");
  const multiclass = actor?.system?.multiclasse?.enabled === true || classes.length > 1;
  const applies = actor?.type === "personnage" && multiclass && classes.some(add2eThiefActivityClassIsThief);
  const armors = Array.from(actor?.items ?? []).filter(item => {
    const type = String(item?.type ?? "").toLowerCase();
    return ["armure", "armor"].includes(type) && add2eThiefActivityItemEquipped(item);
  });
  const blockingItems = applies
    ? armors.filter(item => !add2eThiefActivityArmorIsLeather(item)).map(item => ({ id: item.id, name: item.name, img: item.img }))
    : [];
  const blocked = applies && blockingItems.length > 0;

  return {
    source: "actor-sheet",
    applies,
    ok: !blocked,
    blocked,
    allowedArmor: "Armure de cuir ou aucune armure",
    blockingItems,
    message: blocked
      ? "Les compétences de voleur sont indisponibles tant que ce personnage multiclassé porte une armure autre qu’une armure de cuir."
      : ""
  };
}

// Le HUD et les contrôleurs d’action ne calculent pas cette règle : ils lisent
// l’état préparé par la feuille personnage.
globalThis.add2eGetThiefActivityEquipmentStatus = add2ePrepareThiefActivityData;

export function add2ePrepareActorSheetBaseData({ sheet, data }) {
  const actor = sheet.actor;
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
  const raceKey = sys.race || "";
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

  const exceptionalStrengthClasses = Array.from(actor?.items ?? [])
    .filter(item => String(item?.type ?? "").toLowerCase() === "classe")
    .map(item => [item?.name, item?.system?.slug, item?.system?.label, item?.system?.nom, item?.system?.name]
      .map(value => String(value ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f’']/g, ""))
      .join(" "));
  data.canExceptionalStrength = Number(sys.force) === 18
    && exceptionalStrengthClasses.some(value => value.includes("guerrier") || value.includes("paladin") || value.includes("ranger"));
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

  const isMonk = (sys.details_classe?.label || sys.details_classe?.nom || sys.details_classe?.name || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f’']/g, "").includes("moine");
  if (isMonk && progressionCourante && typeof progressionCourante.monkAC !== "undefined") sys.ca_naturel = progressionCourante.monkAC;
  data.progressionCourante = progressionCourante;

  const classFeaturesForDisplay = (typeof add2eGetActorClassFeatures === "function" ? add2eGetActorClassFeatures(actor) : [])
    .map((feature, index) => ({ ...feature, __featureIndex: index }))
    .filter(feature => {
      const featureLevel = typeof add2eFeatureActorLevel === "function" ? add2eFeatureActorLevel(actor, feature) : niveau;
      return featureLevel >= add2eFeatureMinLevel(feature) && featureLevel <= add2eFeatureMaxLevel(feature);
    });
  data.activeClassFeatures = classFeaturesForDisplay.filter(feature => typeof add2eIsFeatureActivable === "function" ? add2eIsFeatureActivable(feature) : feature.activable === true);
  data.passiveClassFeatures = classFeaturesForDisplay.filter(feature => !(typeof add2eIsFeatureActivable === "function" ? add2eIsFeatureActivable(feature) : feature.activable === true));
  data.thiefSkillRows = typeof add2eGetActorThiefSkillTable === "function" ? add2eGetActorThiefSkillTable(actor) : [];
  data.thiefActivity = add2ePrepareThiefActivityData(actor);

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

  return { actor, sys, items, niveau, progressionCourante, isMonk };
}
