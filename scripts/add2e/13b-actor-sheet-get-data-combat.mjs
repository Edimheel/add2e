// ADD2E — Actor sheet getData : CA, équipement et synthèse de combat.

function add2eCombatNormalizeTag(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^arme_/, "arme:")
    .replace(/^type_arme_/, "type_arme:")
    .replace(/^famille_arme_/, "famille_arme:")
    .replace(/^usage_/, "usage:")
    .replace(/^combat_/, "combat:")
    .replace(/^mod_carac_/, "mod_carac:")
    .replace(/^bonus_degats_/, "bonus_degats:");
}

function add2eCombatArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(add2eCombatArray).filter(Boolean);
  if (typeof value === "string") return value.split(/[,;|\n]+/g).map(part => part.trim()).filter(Boolean);
  if (typeof value === "object") {
    for (const key of ["tags", "effectTags", "effecttags", "list", "items", "value"]) {
      if (value[key] !== undefined) return add2eCombatArray(value[key]);
    }
  }
  return [];
}

function add2eCombatItemTags(item) {
  const system = item?.system ?? {};
  const tags = new Set();
  const push = value => {
    for (const raw of add2eCombatArray(value)) {
      const tag = add2eCombatNormalizeTag(raw);
      if (!tag) continue;
      tags.add(tag);
      if (tag.startsWith("arme:")) tags.add(`type_arme:${tag.slice(5)}`);
      if (tag.startsWith("famille_arme:")) tags.add(`type_arme:${tag.slice(13)}`);
    }
  };

  push(item?.name);
  push(system.nom);
  push(system.tags);
  push(system.tag);
  push(system.effectTags);
  push(system.effecttags);
  push(system.effets);
  push(system.effects);
  push(item?.flags?.add2e?.tags);
  push(item?.flags?.add2e?.effectTags);
  push(system.type_arme);
  push(system.famille_arme);
  push(system.categorie);
  return tags;
}

function add2eCombatActorTags(actor) {
  if (typeof Add2eEffectsEngine !== "undefined" && typeof Add2eEffectsEngine.getActiveTags === "function") {
    return new Set((Add2eEffectsEngine.getActiveTags(actor) ?? []).map(add2eCombatNormalizeTag).filter(Boolean));
  }
  const tags = new Set();
  for (const item of actor?.items ?? []) {
    if (String(item?.type ?? "").toLowerCase() !== "classe") continue;
    for (const tag of add2eCombatArray(item?.system?.tags)) tags.add(add2eCombatNormalizeTag(tag));
    for (const feature of add2eCombatArray(item?.system?.classFeatures)) {
      for (const tag of add2eCombatArray(feature?.tags)) tags.add(add2eCombatNormalizeTag(tag));
    }
  }
  return tags;
}

function add2eCombatHas(tags, ...values) {
  return values.some(value => tags?.has?.(add2eCombatNormalizeTag(value)));
}

function add2eCombatNoCaracBonus(arme, usage) {
  const tags = add2eCombatItemTags(arme);
  return add2eCombatHas(tags, `mod_carac:${usage}:none`, `mod_carac:${usage}:aucun`);
}

function add2eCombatIgnoreForceBonus(actor, usage) {
  const tags = add2eCombatActorTags(actor);
  return add2eCombatHas(tags, `force_bonus:${usage}:ignore`, `force_bonus:${usage}:ignorer`);
}

function add2eCombatIsMonkUnarmed(arme) {
  const tags = add2eCombatItemTags(arme);
  return add2eCombatHas(tags, "main_nue", "arme:main_nue", "type_arme:main_nue", "famille_arme:main_nue", "combat:mains_nues");
}

function add2eCombatMonkWeaponDamageBonus(actor, arme) {
  if (!actor || !arme || add2eCombatIsMonkUnarmed(arme)) return 0;
  const tags = add2eCombatActorTags(actor);
  if (!add2eCombatHas(tags, "bonus_degats:moine:demi_niveau")) return 0;
  const engineBonus = typeof Add2eEffectsEngine !== "undefined" && typeof Add2eEffectsEngine.getMonkWeaponDamageBonus === "function"
    ? Number(Add2eEffectsEngine.getMonkWeaponDamageBonus(actor))
    : NaN;
  if (Number.isFinite(engineBonus)) return engineBonus;
  const fallback = Number(actor?.system?.moine?.passifs?.weaponDamageBonus);
  return Number.isFinite(fallback) ? fallback : 0;
}

export function add2ePrepareActorSheetCombatData({ actor, data, sys, progressionCourante, isMonk }) {
  const transformation = globalThis.add2eGetCapabilityTransformationCombatProfile?.(actor) ?? null;
  const transformationCA = Number(transformation?.armorClass);
  const transformationTHAC0 = Number(transformation?.thac0);
  const hasTransformationCA = Number.isFinite(transformationCA);
  const hasTransformationTHAC0 = Number.isFinite(transformationTHAC0);
  const transformationMovement = String(transformation?.movement ?? "").trim();

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
  if (transformationMovement) sys.vitesse_deplacement = transformationMovement;

  let caPhysique = 10;
  if (hasTransformationCA) {
    caPhysique = transformationCA;
  } else if (isMonk && progressionCourante && typeof progressionCourante.monkAC !== "undefined") {
    caPhysique = progressionCourante.monkAC;
  } else {
    const baseDepart = armure ? acArmure : 10;
    caPhysique = baseDepart + bonusDex + bonusAcArmure;
    if (bouclier) caPhysique = caPhysique - acBouclier + bonusAcBouclier;
    if (heaume) caPhysique = caPhysique - acHeaume + bonusAcHeaume;
  }

  let magicDefense = null;
  if (hasTransformationCA) {
    magicDefense = {
      caNaturel: caPhysique,
      caTotal: caPhysique,
      source: "capability-transformation",
      transformation: {
        sourceKey: transformation.sourceKey,
        formKey: transformation.formKey,
        label: transformation.label
      }
    };
    sys.ca_naturel = caPhysique;
    sys.ca_total = caPhysique;
  } else if (typeof Add2eEffectsEngine !== "undefined" && typeof Add2eEffectsEngine.getMagicPassiveDefense === "function") {
    magicDefense = Add2eEffectsEngine.getMagicPassiveDefense(actor, { physicalCA: caPhysique, armure, bouclier, heaume, source: "actor-sheet" });
    sys.ca_naturel = magicDefense.caNaturel;
    sys.ca_total = magicDefense.caTotal;
  } else {
    sys.ca_naturel = caPhysique;
    let caTotale = caPhysique;
    if (typeof Add2eEffectsEngine !== "undefined") {
      const bonusMagique = Add2eEffectsEngine.getCABonus(actor);
      if (bonusMagique !== 0) caTotale -= bonusMagique;
    }
    sys.ca_total = caTotale;
  }
  if (actor.system.ca_total !== sys.ca_total || actor.system.ca_naturel !== sys.ca_naturel) {
    actor.update({ "system.ca_naturel": sys.ca_naturel, "system.ca_total": sys.ca_total });
  }

  let bonusArmureToucher = 0;
  let bonusArmureDegats = 0;
  for (const piece of [armure, bouclier, heaume].filter(Boolean)) {
    bonusArmureToucher += Number(piece.system.bonus_toucher || 0);
    bonusArmureDegats += Number(piece.system.bonus_degats || 0);
  }

  const arme = data.listeArmes.find(i => i.system.equipee) || null;
  sys.arme_equipee = arme;

  const thaco = hasTransformationTHAC0 ? transformationTHAC0 : (data.progressionCourante?.thac0 || sys.thaco || 20);
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
  let bonusMartialMoine = 0;

  if (arme) {
    const noToucherCarac = add2eCombatNoCaracBonus(arme, "toucher");
    const noDegatsCarac = add2eCombatNoCaracBonus(arme, "degats");
    const ignoreForceToucher = add2eCombatIgnoreForceBonus(actor, "toucher");
    const ignoreForceDegats = add2eCombatIgnoreForceBonus(actor, "degats");
    let caracToucher = 0;
    let caracDegats = 0;

    if ((typeDegats || "").includes("tranchant") || (typeDegats || "").includes("contondant")) {
      if (!noToucherCarac && !ignoreForceToucher) caracToucher = Number(sys.force_bonus_toucher) || 0;
      if (!noDegatsCarac && !ignoreForceDegats) caracDegats = Number(sys.force_bonus_degats) || 0;
    } else if ((typeDegats || "").includes("perforant")) {
      if (!noToucherCarac) caracToucher = Number(sys.dex_att) || 0;
      if (!noDegatsCarac) caracDegats = Number(sys.dex_att) || 0;
    }

    bonusMartialMoine = add2eCombatMonkWeaponDamageBonus(actor, arme);
    bonusToucher = caracToucher + armeBonusToucher + bonusArmureToucher;
    bonusDegats = caracDegats + armeBonusDegats + bonusArmureDegats + bonusMartialMoine;
  }

  const degatsMoyen = arme?.system?.["dégâts"]?.contre_moyen || "-";
  const degatsGrand = arme?.system?.["dégâts"]?.contre_grand || "-";
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
    bonus_degats: bonusDegats,
    bonus_martial_moine: bonusMartialMoine,
    transformation: transformation ? {
      label: transformation.label,
      sourceKey: transformation.sourceKey,
      formKey: transformation.formKey,
      armorClass: transformation.armorClass,
      thac0: transformation.thac0,
      movement: transformation.movement
    } : null
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
}
