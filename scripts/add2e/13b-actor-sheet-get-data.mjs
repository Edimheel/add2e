// ADD2E — Point d'entrée getData de la feuille ApplicationV2.
// Les calculs de sorts proviennent exclusivement de 07-spellcasting-rules.mjs.
// Compatible Foundry V13/V14/V15.

import "./13b-actor-sheet-get-data-core.mjs";

const ADD2E_CLASS_MECHANICS_VERSION = "2026-07-26-sheet-consumer-only-v2";
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

function add2eInstallElementalSaveBonuses() {
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine;
  if (!engine || engine.__add2eElementalSaveBonuses === true) return Boolean(engine);
  const baseCategory = typeof engine.getSaveCategory === "function" ? engine.getSaveCategory.bind(engine) : null;
  const baseBonus = typeof engine.getSaveBonusVs === "function" ? engine.getSaveBonusVs.bind(engine) : null;

  engine.getSaveCategory = function getSaveCategoryWithElements(value) {
    const key = add2eClassMechanicsNormalize(value);
    if (/feu|fire|flamme|incend/.test(key)) return "feu";
    if (/foudre|electric|lightning|eclair/.test(key)) return "foudre";
    return baseCategory?.(value) ?? key;
  };

  engine.getSaveBonusVs = function getSaveBonusVsWithElements(actor, vsType) {
    const category = this.getSaveCategory(vsType);
    if (!["feu", "foudre"].includes(category)) return baseBonus?.(actor, vsType) ?? 0;

    const aliases = category === "feu"
      ? new Set(["feu", "fire", "flamme", "incendie"])
      : new Set(["foudre", "electricite", "electricity", "lightning", "eclair"]);
    let general = 0;
    let elemental = 0;
    for (const tag of this.getActiveTags?.(actor) ?? []) {
      if (tag.startsWith("bonus_save:")) {
        general += Number(tag.split(":")[1]) || 0;
        continue;
      }
      if (!tag.startsWith("bonus_save_vs:")) continue;
      const [, rawMatcher, rawValue] = tag.split(":");
      const matcher = add2eClassMechanicsNormalize(rawMatcher);
      if (matcher === "all" || matcher === "tout") general += Number(rawValue) || 0;
      else if (aliases.has(matcher)) elemental = Math.max(elemental, Number(rawValue) || 0);
    }
    return general + elemental;
  };

  const baseHasImmunity = typeof engine.hasImmunity === "function" ? engine.hasImmunity.bind(engine) : null;
  engine.hasImmunity = function hasImmunityWithConditionalClassTags(actor, immunityType) {
    const key = add2eClassMechanicsNormalize(immunityType);
    if ((key.includes("charme") || key.includes("charm")) && (key.includes("bois") || key.includes("woodland"))) {
      const tags = this.getActiveTags?.(actor) ?? [];
      if (tags.includes("immunite:charme_creatures_bois") || tags.includes("immunite:charme:creatures_bois")) return true;
    }
    return baseHasImmunity?.(actor, immunityType) ?? false;
  };

  engine.__add2eElementalSaveBonuses = true;
  return true;
}

function add2eGetClassNatureMechanics(actor) {
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine;
  const tags = new Set(engine?.getActiveTags?.(actor) ?? []);
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
    saveBonusFire: engine?.getSaveBonusVs?.(actor, "feu") ?? 0,
    saveBonusLightning: engine?.getSaveBonusVs?.(actor, "foudre") ?? 0,
    version: ADD2E_CLASS_MECHANICS_VERSION
  };
}

add2eInstallElementalSaveBonuses();
Hooks.once("ready", add2eInstallElementalSaveBonuses);
globalThis.add2eGetClassNatureMechanics = add2eGetClassNatureMechanics;
