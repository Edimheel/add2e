// ADD2E — Actor sheet getData : CA canonique, sauvegardes, équipement et synthèse de combat.
// Compatible Foundry V13/V14/V15.

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
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine;
  if (!actor || !arme || typeof engine?.getPassiveCombatModifiers !== "function") {
    return { bonusToucher, bonusDegats, passive: null };
  }
  const passive = engine.getPassiveCombatModifiers(actor, {
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

function add2eSheetArmorClassEngine() {
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine ?? null;
  if (!engine || typeof engine.resolveArmorClass !== "function") {
    throw new Error("Le résolveur canonique ADD2E de classe d’armure n’est pas disponible.");
  }
  return engine;
}

function add2eSheetSavingThrowEngine() {
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine ?? null;
  if (!engine || typeof engine.resolveSavingThrow !== "function") {
    throw new Error("Le résolveur canonique ADD2E de sauvegardes n’est pas disponible.");
  }
  return engine;
}

function add2eSheetSaveSigned(value) {
  const number = Number(value) || 0;
  return `${number >= 0 ? "+" : ""}${number}`;
}

function add2eSheetSaveSourceLabel(resolution) {
  const selected = resolution?.targetResolution?.selected;
  if (selected?.kind === "class") {
    return [selected.className, selected.classLevel ? `niveau ${selected.classLevel}` : ""]
      .filter(Boolean)
      .join(" · ");
  }
  return selected?.name ?? "Valeur de l’acteur";
}

function add2eSheetSavingThrowRows(actor) {
  const engine = add2eSheetSavingThrowEngine();
  return Array.from({ length: 5 }, (_unused, index) => {
    const resolution = engine.resolveSavingThrow(actor, index, {
      source: "actor-sheet-get-data",
      consumer: "application-v2",
      frontale: true
    });
    const target = Number(resolution?.target);
    const hasTarget = Number.isFinite(target) && target > 0;
    const bonus = Number(resolution?.bonus) || 0;
    const sourceLabel = add2eSheetSaveSourceLabel(resolution);
    const targetDisplay = hasTarget ? String(target) : "—";
    const bonusDisplay = add2eSheetSaveSigned(bonus);
    const title = [
      `Jet de ${resolution?.label ?? "sauvegarde"}`,
      `Seuil : ${targetDisplay}`,
      `Bonus : ${bonusDisplay}`,
      `Source : ${sourceLabel}`
    ].join(" · ");

    return {
      index,
      key: resolution?.key ?? `save${index}`,
      label: resolution?.label ?? "Sauvegarde",
      shortLabel: resolution?.definition?.shortLabel ?? resolution?.label ?? "Sauvegarde",
      icon: resolution?.definition?.icon ?? "fas fa-dice-d20",
      target: hasTarget ? target : null,
      targetDisplay,
      bonus,
      bonusDisplay,
      hasBonus: bonus !== 0,
      sourceLabel,
      title,
      resolution
    };
  });
}

function add2eSheetArmorLabel(resolution, fallback) {
  if (resolution?.mode === "transformation") return resolution.transformation?.label ?? "Transformation";
  if (resolution?.mode === "monk") return "Défense martiale du moine";
  if (resolution?.mode === "passive") return resolution.passiveArmorClass?.label ?? "Défense passive de classe";
  if (resolution?.fixedCAActive) return `${resolution.fixedSource || "CA fixe"} <small style="color:#7f704d;">(CA fixe)</small>`;
  return resolution?.armorName && resolution.armorName !== "Aucune" ? resolution.armorName : fallback;
}

function add2eSheetSyncArmorClass(actor, resolution) {
  const caNaturel = Number(resolution?.caNaturel);
  const caTotal = Number(resolution?.caTotal);
  if (!Number.isFinite(caNaturel) || !Number.isFinite(caTotal)) {
    throw new Error(`Résolution de CA invalide pour ${actor?.name ?? "acteur"}.`);
  }
  if (Number(actor.system?.ca_naturel) === caNaturel && Number(actor.system?.ca_total) === caTotal) return;
  void actor.update({
    "system.ca_naturel": caNaturel,
    "system.ca_total": caTotal
  }, {
    render: false,
    add2eInternal: true,
    add2eReason: "canonical-armor-class-sync"
  }).catch(error => console.error("[ADD2E][ARMOR_CLASS][SYNC_ERROR]", { actor: actor.name, error }));
}

export function add2ePrepareActorSheetCombatData({ actor, data, sys, progressionCourante, isMonk }) {
  const engine = add2eSheetArmorClassEngine();
  const transformation = globalThis.add2eGetCapabilityTransformationCombatProfile?.(actor) ?? null;
  const transformationTHAC0 = Number(transformation?.thac0);
  const hasTransformationTHAC0 = Number.isFinite(transformationTHAC0);
  const transformationMovement = String(transformation?.movement ?? "").trim();

  const armure = data.listeArmures.find(item => item.system.equipee
    && !(item.name.toLowerCase().includes("bouclier") || item.name.toLowerCase().includes("heaume") || item.name.toLowerCase().includes("casque")));
  const bouclier = data.listeArmures.find(item => item.system.equipee && item.name.toLowerCase().includes("bouclier"));
  const heaume = data.listeArmures.find(item => item.system.equipee
    && (item.name.toLowerCase().includes("heaume") || item.name.toLowerCase().includes("casque")));

  sys.armure_equipee = armure || null;
  sys.bouclier_equipe = bouclier || null;
  sys.heaume_equipe = heaume || null;
  if (transformationMovement) sys.vitesse_deplacement = transformationMovement;

  const armorClass = engine.resolveArmorClass(actor, {
    source: "actor-sheet",
    consumer: "application-v2",
    frontale: true,
    position: "front"
  });
  sys.ca_naturel = Number(armorClass.caNaturel);
  sys.ca_total = Number(armorClass.caTotal);
  add2eSheetSyncArmorClass(actor, armorClass);

  let bonusArmureToucher = 0;
  let bonusArmureDegats = 0;
  for (const piece of [armure, bouclier, heaume].filter(Boolean)) {
    bonusArmureToucher += Number(piece.system.bonus_toucher || 0);
    bonusArmureDegats += Number(piece.system.bonus_degats || 0);
  }

  const arme = data.listeArmes.find(item => item.system.equipee) || null;
  sys.arme_equipee = arme;

  const thaco = hasTransformationTHAC0 ? transformationTHAC0 : (data.progressionCourante?.thac0 || sys.thaco || 20);
  const typeDegats = arme?.system.type_degats || "";
  const armeBonusToucher = arme ? (
    typeof engine.getMagicWeaponBonus === "function"
      ? engine.getMagicWeaponBonus(arme, "hit")
      : Number(arme.system.bonus_hit || 0)
  ) : 0;
  const armeBonusDegats = arme ? (
    typeof engine.getMagicWeaponBonus === "function"
      ? engine.getMagicWeaponBonus(arme, "damage")
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
  const monkMartial = armorClass.monk ?? null;

  data.monkMartialProgression = monkMartial;
  data.combatDefense = {
    armure: add2eSheetArmorLabel(armorClass, armure ? armure.name : "<em>Aucune</em>"),
    bouclier: armorClass.shieldIgnored ? "<em>Ignoré</em>" : (bouclier ? bouclier.name : "<em>Aucun</em>"),
    heaume: heaume ? heaume.name : "<em>Aucun</em>",
    ac_naturelle: sys.ca_naturel,
    ac_totale: sys.ca_total,
    objets_magiques_defense: armorClass,
    armor_class_resolution: armorClass,
    arme: arme ? arme.name : "<em>Aucune</em>",
    thaco,
    degats: `${degatsMoyen} / ${degatsGrand}`,
    type_degats: typeDegats,
    bonus_toucher: bonusToucher,
    bonus_degats: bonusDegats,
    passive_combat: passiveCombat,
    monk_martial: monkMartial,
    attaques_par_round: monkMartial?.attacksPerRound ?? "",
    degats_main_nue: monkMartial?.unarmedDamage ?? "",
    mouvement_martial: monkMartial?.move ?? null,
    chute_ralentie: monkMartial?.slowFallText ?? "",
    transformation: armorClass.transformation ? {
      label: armorClass.transformation.label,
      sourceKey: armorClass.transformation.sourceKey,
      formKey: armorClass.transformation.formKey,
      armorClass: armorClass.transformation.armorClass,
      thac0: transformation?.thac0,
      movement: transformation?.movement
    } : null
  };

  data.saveRows = add2eSheetSavingThrowRows(actor);
  data.forceExValues = [];
  for (let value = 1; value <= 100; value += 1) {
    data.forceExValues.push({ value, label: value === 100 ? "00" : value.toString().padStart(2, "0") });
  }
}
