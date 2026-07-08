// ADD2E — Actor sheet getData : CA, équipement et synthèse de combat.

function add2eSheetCombatNormalizeTag(value) {
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

function add2eSheetCombatArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(add2eSheetCombatArray).filter(Boolean);
  if (value instanceof Set) return [...value].flatMap(add2eSheetCombatArray).filter(Boolean);
  if (typeof value === "string") return value.split(/[,;|\n]+/g).map(part => part.trim()).filter(Boolean);
  if (typeof value === "object") {
    for (const key of ["tags", "effectTags", "effecttags", "list", "items", "value"]) {
      if (value[key] !== undefined) return add2eSheetCombatArray(value[key]);
    }
  }
  return [];
}

function add2eSheetCombatActionTags(item) {
  const system = item?.system ?? {};
  const tags = new Set();
  const push = value => {
    for (const raw of add2eSheetCombatArray(value)) {
      const tag = add2eSheetCombatNormalizeTag(raw);
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
  return [...tags];
}

function add2eSheetApplyPassiveCombatModifiers({ actor, arme, bonusToucher, bonusDegats, toucherCarac, toucherValue, degatsCarac, degatsValue }) {
  if (!actor || !arme || typeof Add2eEffectsEngine === "undefined" || typeof Add2eEffectsEngine.getPassiveCombatModifiers !== "function") {
    return { bonusToucher, bonusDegats, passive: null };
  }
  const passive = Add2eEffectsEngine.getPassiveCombatModifiers(actor, {
    type: "attaque",
    ruleScope: "owner",
    actor,
    actionTags: add2eSheetCombatActionTags(arme),
    abilityModifiers: {
      toucher: { ability: toucherCarac, value: Number(toucherValue) || 0 },
      degats: { ability: degatsCarac, value: Number(degatsValue) || 0 }
    }
  });
  return {
    bonusToucher: bonusToucher + (Number(passive?.toucher) || 0),
    bonusDegats: bonusDegats + (Number(passive?.degats) || 0),
    passive
  };
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
  let passiveCombat = null;

  if (arme) {
    let toucherCarac = null;
    let degatsCarac = null;
    let toucherValue = 0;
    let degatsValue = 0;

    if ((typeDegats || "").includes("tranchant") || (typeDegats || "").includes("contondant")) {
      toucherCarac = "force";
      degatsCarac = "force";
      toucherValue = Number(sys.force_bonus_toucher) || 0;
      degatsValue = Number(sys.force_bonus_degats) || 0;
    } else if ((typeDegats || "").includes("perforant")) {
      toucherCarac = "dexterite";
      degatsCarac = "dexterite";
      toucherValue = Number(sys.dex_att) || 0;
      degatsValue = Number(sys.dex_att) || 0;
    }

    bonusToucher = toucherValue + armeBonusToucher + bonusArmureToucher;
    bonusDegats = degatsValue + armeBonusDegats + bonusArmureDegats;

    const passiveResult = add2eSheetApplyPassiveCombatModifiers({
      actor,
      arme,
      bonusToucher,
      bonusDegats,
      toucherCarac,
      toucherValue,
      degatsCarac,
      degatsValue
    });
    bonusToucher = passiveResult.bonusToucher;
    bonusDegats = passiveResult.bonusDegats;
    passiveCombat = passiveResult.passive;
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
    bonus_degats: bonusDegats,
    passive_combat: passiveCombat,
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
