// ADD2E — Point d'entrée getData de la feuille ApplicationV2.
// Les calculs de sorts proviennent exclusivement de 07-spellcasting-rules.mjs.
// Compatible Foundry V13/V14/V15.

import "./13b-actor-sheet-get-data-core.mjs";

const ADD2E_CLASS_MECHANICS_VERSION = "2026-08-10-sheet-derived-display-v5";
globalThis.ADD2E_CLASS_MECHANICS_VERSION = ADD2E_CLASS_MECHANICS_VERSION;

function add2eClassMechanicsNormalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function add2eNatureSaveBonus(engine, actor, element) {
  if (typeof engine?.getSaveBonus !== "function") {
    throw new Error("Le résolveur canonique des bonus de sauvegarde ADD2E est indisponible.");
  }
  const key = add2eClassMechanicsNormalize(element);
  return Number(engine.getSaveBonus(actor, "sorts", {
    category: key,
    effectType: key,
    saveContext: key,
    tags: [key, `damage:${key}`],
    source: `actor-sheet-class-nature:${key}`
  })) || 0;
}

function add2eGetClassNatureMechanics(actor) {
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine;
  if (!engine) throw new Error("Le moteur canonique ADD2E est indisponible pour l’affichage des capacités naturelles.");
  const tags = new Set(engine.getActiveTags?.(actor) ?? []);
  const classItems = Array.from(actor?.items ?? []).filter(item => String(item?.type ?? "").toLowerCase() === "classe");
  const natureClass = classItems.find(item => {
    const values = [item.name, item.system?.slug, item.system?.label, ...(Array.isArray(item.system?.tags) ? item.system.tags : [])]
      .map(add2eClassMechanicsNormalize);
    return values.some(value => value === "druide" || value === "classe_druide");
  }) ?? null;
  const level = natureClass
    ? Number(globalThis.add2eSpellClassLevel?.(actor, { classItemId: natureClass.id }) ?? natureClass.system?.niveau ?? 0) || 0
    : 0;

  return {
    classItem: natureClass,
    level,
    identifyPlants: tags.has("identification:plantes"),
    identifyAnimals: tags.has("identification:animaux"),
    identifyPureWater: tags.has("identification:eau_pure"),
    woodlandNoTrace: tags.has("deplacement_sans_trace:bois") && tags.has("terrain:boise"),
    extraNaturalLanguages: tags.has("langue_naturelle:supplementaire") ? Math.max(0, level - 2) : 0,
    immuneWoodlandCharm: tags.has("immunite:charme_creatures_bois") || tags.has("immunite:charme:creatures_bois"),
    animalShape: tags.has("forme_animale") || tags.has("forme_animale:3_jour"),
    saveBonusFire: add2eNatureSaveBonus(engine, actor, "feu"),
    saveBonusLightning: add2eNatureSaveBonus(engine, actor, "foudre"),
    version: ADD2E_CLASS_MECHANICS_VERSION
  };
}

function add2eLanguageValues(value) {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(add2eLanguageValues);
  if (value instanceof Set) return [...value].flatMap(add2eLanguageValues);
  if (typeof value === "string") {
    return value.split(/[,;|\n]+/g).map(entry => entry.trim()).filter(Boolean);
  }
  if (typeof value === "object") {
    for (const key of ["langues", "languages", "items", "list", "values", "value"]) {
      if (value[key] !== undefined) return add2eLanguageValues(value[key]);
    }
  }
  return [String(value).trim()].filter(Boolean);
}

function add2eUniqueLanguages(value) {
  const seen = new Set();
  const languages = [];
  for (const label of add2eLanguageValues(value)) {
    const key = add2eClassMechanicsNormalize(label);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    languages.push({ key, label: String(label).trim() });
  }
  return languages;
}

function add2eLanguageClassProfile(actor) {
  const values = Array.from(actor?.items ?? [])
    .filter(item => String(item?.type ?? "").toLowerCase() === "classe")
    .flatMap(item => [item?.name, item?.system?.slug, item?.system?.label, item?.system?.nom])
    .map(add2eClassMechanicsNormalize)
    .filter(Boolean);
  return {
    druid: values.some(value => value.includes("druide") || value.includes("druid")),
    thief: values.some(value => value.includes("voleur") || value.includes("thief") || value.includes("assassin"))
  };
}

function add2eLanguageIsFree(language, freeKeys, alignmentKey, classes) {
  const key = language.key;
  if (freeKeys.has(key)) return true;
  if (["commun", "langue_commune", "langage_commun", "common"].includes(key)) return true;
  if (key === alignmentKey || key.includes("langue_alignement") || key.includes("alignment_language")) return true;
  if (classes.druid && ["druidique", "langue_druidique", "druidic"].includes(key)) return true;
  if (classes.thief && ["argot_des_voleurs", "argot_voleur", "thieves_cant", "thief_cant"].includes(key)) return true;
  return false;
}

function add2ePrepareLanguageQuota(actor, data) {
  const intelligence = data?.abilityDerived?.intelligence;
  if (!intelligence) throw new Error("Le profil canonique d’Intelligence est indisponible pour le quota de langues.");

  const capacity = Math.max(0, Number(intelligence.profile?.langues) || 0);
  const known = add2eUniqueLanguages(actor?.system?.langues);
  const racial = add2eUniqueLanguages(actor?.system?.details_race?.langues);
  const freeKeys = new Set(racial.map(language => language.key));
  const alignmentKey = add2eClassMechanicsNormalize(actor?.system?.alignement ?? actor?.system?.alignment ?? "");
  const classes = add2eLanguageClassProfile(actor);
  const free = known.filter(language => add2eLanguageIsFree(language, freeKeys, alignmentKey, classes));
  const additional = known.filter(language => !add2eLanguageIsFree(language, freeKeys, alignmentKey, classes));
  const used = additional.length;
  const remaining = Math.max(0, capacity - used);
  const exceeded = Math.max(0, used - capacity);
  const quota = {
    capacity,
    used,
    remaining,
    exceeded,
    knownCount: known.length,
    freeCount: free.length,
    display: `${used} / ${capacity}`,
    status: exceeded > 0
      ? `Dépassement : ${exceeded}`
      : `Restantes : ${remaining}`,
    knownLabels: known.map(language => language.label),
    freeLabels: free.map(language => language.label),
    additionalLabels: additional.map(language => language.label)
  };

  intelligence.languageQuota = quota;
  data.languageQuota = quota;
  return quota;
}

function add2ePrepareConstitutionHitPointBonus(actor, data) {
  const constitution = data?.abilityDerived?.constitution;
  if (!constitution) throw new Error("Le profil canonique de Constitution est indisponible pour l’affichage des PV.");

  const classItems = Array.from(actor?.items ?? []).filter(item => String(item?.type ?? "").toLowerCase() === "classe");
  let progression = null;
  let value = Math.trunc(Number(constitution.profile?.pv) || 0);

  if (classItems.length) {
    if (typeof globalThis.add2eResolveConstitutionHitPointProgression !== "function") {
      throw new Error("Le résolveur canonique de progression des PV de Constitution est indisponible.");
    }
    const progressions = classItems
      .map(item => globalThis.add2eResolveConstitutionHitPointProgression(actor, item))
      .filter(Boolean);
    const fighterProgression = progressions.find(entry => entry?.fighterClass === true) ?? null;
    progression = fighterProgression ?? (classItems.length === 1 ? progressions[0] ?? null : null);
    if (classItems.length === 1 && !progression) {
      throw new Error("La progression canonique des PV de Constitution n’a pas pu être résolue.");
    }
    if (fighterProgression) value = Math.trunc(Number(fighterProgression.constitutionBonusPerDie) || 0);
    else if (classItems.length === 1) value = Math.trunc(Number(progression.constitutionBonusPerDie) || 0);
  }

  const hitPointBonus = {
    value,
    fighterClass: progression?.fighterClass === true,
    classKey: progression?.classKey ?? "",
    className: progression?.className ?? "",
    description: progression?.fighterClass === true
      ? `Bonus de Constitution par dé de vie — ${progression.className}`
      : "Bonus de Constitution par dé de vie"
  };

  constitution.hitPointBonus = hitPointBonus;
  data.constitutionHitPointBonus = hitPointBonus;
  return hitPointBonus;
}

function add2ePrepareCharismaSocialProfile(actor, data) {
  const charisma = data?.abilityDerived?.charisme;
  if (!charisma) throw new Error("Le profil canonique de Charisme est indisponible pour l’affichage social.");
  if (
    typeof globalThis.add2eResolveCharismaFollowers !== "function"
    || typeof globalThis.add2eResolveCharismaLoyalty !== "function"
    || typeof globalThis.add2eResolveCharismaReaction !== "function"
  ) {
    throw new Error("Les résolveurs canoniques de Charisme sont indisponibles.");
  }

  const followers = globalThis.add2eResolveCharismaFollowers(actor, {
    source: "actor-sheet-charisma-display"
  });
  const loyalty = globalThis.add2eResolveCharismaLoyalty(actor, {
    source: "actor-sheet-charisma-display"
  });
  const reaction = globalThis.add2eResolveCharismaReaction(actor, {
    source: "actor-sheet-charisma-display"
  });

  const social = {
    followers: {
      base: followers.base,
      adjustment: followers.adjustment,
      maximum: followers.maximum,
      description: followers.adjustment
        ? `Maximum de base ${followers.base}, ajustements ${followers.adjustment > 0 ? "+" : ""}${followers.adjustment}`
        : `Maximum de base ${followers.base}`
    },
    loyalty: {
      base: loyalty.base,
      charismaAdjustment: loyalty.charismaAdjustment,
      permanentAdjustment: loyalty.permanentAdjustment,
      threshold: loyalty.threshold,
      description: `Base ${loyalty.base} % ; Charisme ${loyalty.charismaAdjustment > 0 ? "+" : ""}${loyalty.charismaAdjustment} %${loyalty.permanentAdjustment ? ` ; autres ${loyalty.permanentAdjustment > 0 ? "+" : ""}${loyalty.permanentAdjustment} %` : ""}`
    },
    reaction: {
      charismaAdjustment: reaction.charismaAdjustment,
      permanentAdjustment: reaction.permanentAdjustment,
      adjustment: reaction.adjustment,
      description: `Charisme ${reaction.charismaAdjustment > 0 ? "+" : ""}${reaction.charismaAdjustment} %${reaction.permanentAdjustment ? ` ; autres ${reaction.permanentAdjustment > 0 ? "+" : ""}${reaction.permanentAdjustment} %` : ""}`
    },
    version: globalThis.ADD2E_CHARISMA_RULES_VERSION ?? ADD2E_CLASS_MECHANICS_VERSION
  };

  charisma.social = social;
  data.charismaSocial = social;
  return social;
}

function add2eInstallDerivedSheetDisplays() {
  const prototype = globalThis.Add2eActorSheet?.prototype;
  if (!prototype || prototype.__add2eDerivedSheetDisplaysV2 === true) return Boolean(prototype);
  const originalGetData = prototype.getData;
  if (typeof originalGetData !== "function") throw new Error("getData ApplicationV2 est indisponible pour les profils dérivés de la feuille.");

  prototype.getData = async function add2eDerivedSheetDisplaysGetData(...args) {
    const data = await originalGetData.apply(this, args);
    add2ePrepareConstitutionHitPointBonus(this.actor, data);
    add2ePrepareLanguageQuota(this.actor, data);
    add2ePrepareCharismaSocialProfile(this.actor, data);
    return data;
  };
  prototype.__add2eDerivedSheetDisplaysV2 = true;
  return true;
}

add2eInstallDerivedSheetDisplays();
globalThis.add2eGetClassNatureMechanics = add2eGetClassNatureMechanics;
globalThis.add2ePrepareLanguageQuota = add2ePrepareLanguageQuota;
globalThis.add2ePrepareConstitutionHitPointBonus = add2ePrepareConstitutionHitPointBonus;
globalThis.add2ePrepareCharismaSocialProfile = add2ePrepareCharismaSocialProfile;