// ============================================================
// ADD2E — Drop race / classe : noyau non destructif
// Compatible Foundry V13/V14/V15.
// ============================================================

import { classProgressionRow, raceSlug } from "./17b-multiclass-core.mjs";
import { levelForClassXp } from "./17b-multiclass-rules.mjs";

export const ADD2E_RACE_CLASS_DROP_VERSION = "2026-08-12-canonical-first-class-progression-v6";
globalThis.ADD2E_RACE_CLASS_DROP_VERSION = ADD2E_RACE_CLASS_DROP_VERSION;

export const CARACS = ["force", "dexterite", "constitution", "intelligence", "sagesse", "charisme"];
export const CARAC_SHORT = { force: "FOR", dexterite: "DEX", constitution: "CON", intelligence: "INT", sagesse: "SAG", charisme: "CHA" };

function add2eDropEffectsEngine() {
  return globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine ?? null;
}

function add2eDropPickClassAlignment(actor, classData, fallback = "") {
  const engine = add2eDropEffectsEngine();
  if (engine && typeof engine.pickClassAlignment === "function") {
    const picked = engine.pickClassAlignment(actor, classData, fallback);
    if (picked) return picked;
  }
  return fallback || actor?.system?.alignement || "";
}

export function add2eDropDebugRaceClass(...args) {
  if (globalThis.ADD2E_DEBUG_RACE_CLASSE === true) console.log("[ADD2E][DROP][RACE_CLASSE]", ...args);
}

export function add2eDropClone(value) {
  if (value === undefined || value === null) return value;
  try { return foundry.utils.deepClone(value); } catch (_error) {}
  try { return foundry.utils.duplicate(value); } catch (_error) {}
  return JSON.parse(JSON.stringify(value));
}

export function add2eItemDataCloneForDrop(itemLike) {
  if (!itemLike) return null;
  const data = typeof itemLike.toObject === "function" ? itemLike.toObject() : add2eDropClone(itemLike);
  if (!data || typeof data !== "object") return null;
  delete data._id;
  delete data._stats;
  return data;
}

export function add2eWorldItemsByType(type) {
  const wanted = String(type ?? "").toLowerCase();
  return Array.from(game?.items ?? [])
    .filter(item => String(item?.type ?? "").toLowerCase() === wanted)
    .map(add2eItemDataCloneForDrop)
    .filter(Boolean);
}

export function add2eRaceCandidateLabel(raceData) {
  return String(raceData?.name ?? raceData?.system?.label ?? raceData?.system?.nom ?? "Race").trim() || "Race";
}

export function add2eClassCandidateLabel(classData) {
  return String(classData?.name ?? classData?.system?.label ?? classData?.system?.nom ?? "Classe").trim() || "Classe";
}

export function add2eNormalizeDropTag(value) {
  if (typeof globalThis.add2eNormalizeEquipTag === "function") return globalThis.add2eNormalizeEquipTag(value);
  return String(value ?? "").trim().toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, "")
    .replace(/[_\s-]+/g, "_");
}

export function add2eToDropArray(value) {
  if (typeof globalThis.add2eToEquipArray === "function") return globalThis.add2eToEquipArray(value);
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(add2eToDropArray).filter(Boolean);
  if (typeof value === "string") return value.split(/[,;|\n]+/).map(entry => entry.trim()).filter(Boolean);
  if (typeof value === "object") return Object.values(value).flatMap(add2eToDropArray).filter(Boolean);
  return [value];
}

export function add2eRaceTagsFromDataSafe(raceData) {
  if (!raceData) return [];
  const system = raceData.system ?? {};
  const slug = raceSlug(raceData);
  const tags = [
    ...add2eToDropArray(system.tags),
    `race:${slug}`
  ];
  return [...new Set(tags.map(add2eNormalizeDropTag).filter(Boolean))];
}

export function add2eRaceMatchesClassRules(raceData, classData) {
  const rules = (classData?.system ?? classData ?? {})?.raceRestriction?.races;
  if (!rules || typeof rules !== "object" || !Object.keys(rules).length) return true;
  const tags = add2eRaceTagsFromDataSafe(raceData).map(add2eNormalizeDropTag);
  const normalized = {};
  for (const [tag, rule] of Object.entries(rules)) normalized[add2eNormalizeDropTag(tag)] = rule;
  const matched = tags.find(tag => Object.prototype.hasOwnProperty.call(normalized, tag));
  return matched ? normalized[matched]?.allowed === true : false;
}

export function add2eDropNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function add2eCaracRegistry(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return Object.fromEntries(CARACS.map(carac => [carac, add2eDropNumber(source[carac], 0)]));
}

function add2eCanonicalRacialAdjustments(actor) {
  return add2eCaracRegistry(actor?.flags?.add2e?.racialAbilityAdjustments);
}

function add2eStoredNaturalCaracs(actor) {
  const raw = actor?.flags?.add2e?.base_caracs;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return Object.fromEntries(CARACS.map(carac => [carac, add2eDropNumber(raw[carac], 10)]));
}

function add2eRaceItemRawAdjustments(actor) {
  const race = actor?.items?.find?.(item => String(item?.type ?? "").toLowerCase() === "race") ?? null;
  return race ? add2eCaracRegistry(race.system?.bonus_caracteristiques) : null;
}

function add2eLegacyRacialAdjustments(actor) {
  const system = actor?.system ?? {};
  const registry = system.bonus_caracteristiques && typeof system.bonus_caracteristiques === "object"
    ? system.bonus_caracteristiques
    : {};
  return Object.fromEntries(CARACS.map(carac => {
    const registryValue = add2eDropNumber(registry?.[carac], 0);
    const directValue = add2eDropNumber(system?.[`${carac}_race`], 0);
    return [carac, registryValue || directValue];
  }));
}

function add2eForcedDeletionOperator() {
  const ForcedDeletion = foundry?.data?.operators?.ForcedDeletion;
  if (typeof ForcedDeletion === "function") return new ForcedDeletion();
  if (globalThis._del !== undefined) return globalThis._del;
  throw new Error("L’opérateur Foundry de suppression forcée est introuvable.");
}

function add2eRacialLegacyDeletionUpdate() {
  const update = { "system.bonus_caracteristiques": add2eForcedDeletionOperator() };
  for (const carac of CARACS) update[`system.${carac}_race`] = add2eForcedDeletionOperator();
  return update;
}

export function add2eActorBaseCaracForRaceDrop(actor, carac) {
  const stored = add2eStoredNaturalCaracs(actor);
  if (stored) return add2eDropNumber(stored[carac], 10);
  const definitive = add2eDropNumber(actor?.system?.[`${carac}_base`] ?? actor?.system?.[carac], 10);
  const previousAdjustment = add2eDropNumber(add2eCanonicalRacialAdjustments(actor)[carac], 0);
  return definitive - previousAdjustment;
}

export function add2eClampRaceBonusForBase(base, bonus) {
  const current = add2eDropNumber(base, 10);
  const raw = add2eDropNumber(bonus, 0);
  if (raw > 0 && current + raw > 18) return Math.max(0, 18 - current);
  if (raw < 0 && current + raw < 3) return Math.min(0, 3 - current);
  return raw;
}

export function add2eClampRaceBonusesForExistingBases(actor, rawBonuses = {}, context = {}) {
  const source = add2eCaracRegistry(rawBonuses);
  const output = {};
  const report = [];
  for (const carac of CARACS) {
    const base = add2eActorBaseCaracForRaceDrop(actor, carac);
    const raw = source[carac];
    const applied = add2eClampRaceBonusForBase(base, raw);
    output[carac] = applied;
    if (raw || applied) report.push({ carac, base, rawBonus: raw, appliedBonus: applied, total: base + applied, changed: raw !== applied });
  }
  add2eDropDebugRaceClass("RACIAL_BONUS_CAP", { actor: actor?.name, race: context?.raceName ?? null, report, adjustedBonuses: output });
  return output;
}

export function add2eRaceAdjustedCaracTotal(actor, carac, rawBonuses = {}) {
  const base = add2eActorBaseCaracForRaceDrop(actor, carac);
  return base + add2eClampRaceBonusForBase(base, rawBonuses?.[carac] ?? 0);
}

async function add2eMigrateActorRacialAbilityAdjustments(actor) {
  if (!actor?.system || actor.type !== "personnage") return false;

  const existingFlag = actor?.flags?.add2e?.racialAbilityAdjustments;
  const hasCanonical = existingFlag && typeof existingFlag === "object" && !Array.isArray(existingFlag);
  const storedNatural = add2eStoredNaturalCaracs(actor);
  const previousAdjustments = add2eCanonicalRacialAdjustments(actor);
  const raceItemAdjustments = add2eRaceItemRawAdjustments(actor);
  const hasLegacyFields = actor.system?.bonus_caracteristiques !== undefined
    || CARACS.some(carac => actor.system?.[`${carac}_race`] !== undefined);

  if (hasCanonical) {
    const natural = storedNatural ?? Object.fromEntries(CARACS.map(carac => {
      const definitive = add2eDropNumber(actor.system?.[`${carac}_base`] ?? actor.system?.[carac], 10);
      return [carac, definitive - previousAdjustments[carac]];
    }));
    const rawAdjustments = raceItemAdjustments ?? previousAdjustments;
    const update = {};
    if (!storedNatural) update["flags.add2e.base_caracs"] = natural;
    if (JSON.stringify(rawAdjustments) !== JSON.stringify(previousAdjustments)) {
      update["flags.add2e.racialAbilityAdjustments"] = rawAdjustments;
      for (const carac of CARACS) {
        update[`system.${carac}_base`] = natural[carac] + add2eClampRaceBonusForBase(natural[carac], rawAdjustments[carac]);
      }
    }
    if (hasLegacyFields) Object.assign(update, add2eRacialLegacyDeletionUpdate());
    if (!Object.keys(update).length) return false;
    await actor.update(update, {
      add2eInternal: true,
      add2eReason: "racial-ability-canonical-migration"
    });
    if (typeof actor.sheet?.autoSetCaracAjustements === "function") await actor.sheet.autoSetCaracAjustements();
    return true;
  }

  const legacy = add2eLegacyRacialAdjustments(actor);
  const rawAdjustments = raceItemAdjustments ?? legacy;
  const hasAdjustment = CARACS.some(carac => add2eDropNumber(rawAdjustments[carac], 0) !== 0);
  if (!hasAdjustment && !hasLegacyFields) return false;

  const natural = Object.fromEntries(CARACS.map(carac => [
    carac,
    add2eDropNumber(actor.system?.[`${carac}_base`] ?? actor.system?.[carac], 10)
  ]));
  const update = {
    ...add2eRacialLegacyDeletionUpdate(),
    "flags.add2e.base_caracs": natural,
    "flags.add2e.racialAbilityAdjustments": rawAdjustments,
    "flags.add2e.racialAbilitySource": {
      kind: "race",
      id: String(actor.items?.find?.(item => String(item.type ?? "").toLowerCase() === "race")?.id ?? "legacy-race"),
      uuid: String(actor.items?.find?.(item => String(item.type ?? "").toLowerCase() === "race")?.uuid ?? ""),
      name: String(actor.system?.race ?? actor.system?.details_race?.name ?? "Race")
    }
  };
  for (const carac of CARACS) {
    update[`system.${carac}_base`] = natural[carac] + add2eClampRaceBonusForBase(natural[carac], rawAdjustments[carac]);
  }
  await actor.update(update, {
    add2eInternal: true,
    add2eReason: "racial-ability-definitive-migration"
  });
  if (typeof actor.sheet?.autoSetCaracAjustements === "function") await actor.sheet.autoSetCaracAjustements();
  return true;
}

export function checkClassStatMin(actor, classItem, candidateRaceData = null, candidateAlignment = null, options = {}) {
  const silent = options?.silent === true;
  const ignoreLevelMax = options?.ignoreLevelMax === true;
  const classSystem = classItem?.system ?? classItem ?? {};
  const raceData = candidateRaceData ?? actor?.items?.find?.(item => String(item.type ?? "").toLowerCase() === "race") ?? null;
  const raceTags = add2eRaceTagsFromDataSafe(raceData);
  const classLevel = Number(classSystem.niveau);
  if (!ignoreLevelMax && (!Number.isInteger(classLevel) || classLevel < 1)) {
    throw new Error(`Niveau canonique absent sur l’Item classe « ${classItem?.name ?? "Classe"} » pour vérifier la limite raciale.`);
  }
  const candidateBonus = raceData?.system?.bonus_caracteristiques ?? {};
  const missing = [];

  const races = classSystem.raceRestriction?.races;
  if (races && typeof races === "object" && Object.keys(races).length) {
    const normalizedRules = {};
    for (const [tag, rule] of Object.entries(races)) normalizedRules[add2eNormalizeDropTag(tag)] = rule;
    const matchedTag = raceTags.find(tag => Object.prototype.hasOwnProperty.call(normalizedRules, tag));
    if (!matchedTag) missing.push(`race non autorisée (${raceTags.join(", ") || "aucun tag race:*"})`);
    else {
      const rule = normalizedRules[matchedTag] ?? {};
      if (rule.allowed !== true) missing.push(`race interdite (${matchedTag})`);
      const maxLevel = Number(rule.maxLevel ?? rule.niveauMax ?? rule.max);
      if (!ignoreLevelMax && Number.isFinite(maxLevel) && maxLevel > 0 && classLevel > maxLevel) missing.push(`${matchedTag} limité au niveau ${maxLevel}`);
    }
  }

  for (const [carac, rawMin] of Object.entries(classSystem.caracs_min || {})) {
    const minimum = Number(rawMin);
    if (!Number.isFinite(minimum)) continue;
    const total = add2eRaceAdjustedCaracTotal(actor, carac, candidateBonus);
    if (total < minimum) missing.push(`${carac} ${total} < ${minimum}`);
  }

  if (candidateAlignment && add2eDropEffectsEngine()?.isAlignmentAllowedForClass?.(candidateAlignment, classItem) === false) {
    missing.push(`alignement non autorisé (${candidateAlignment})`);
  }

  if (missing.length) {
    if (!silent) {
      ui.notifications.warn(`Prérequis insuffisants pour la classe "${classItem?.name ?? "Classe"}" (${missing.join(", ")})`);
      console.warn("[ADD2E][DROP][RACE_CLASSE][REFUS_PREREQUIS]", { actor: actor?.name, classe: classItem?.name, race: raceData?.name ?? null, raceTags, missing, candidateAlignment });
    }
    return false;
  }
  return true;
}

export async function add2eApplyRaceItemDataToActor(actor, raceData, sheet = null, options = {}) {
  if (!actor || !raceData || raceData.type !== "race") return null;
  await add2eMigrateActorRacialAbilityAdjustments(actor);

  const data = add2eItemDataCloneForDrop(raceData);
  data.type = "race";
  const naturalBases = Object.fromEntries(CARACS.map(carac => [carac, add2eActorBaseCaracForRaceDrop(actor, carac)]));

  const existingRaces = actor.items.filter(item => String(item.type ?? "").toLowerCase() === "race");
  for (const oldRace of existingRaces) {
    const effectIds = actor.effects
      .filter(effect => effect.origin === oldRace.uuid || String(effect?.flags?.add2e?.sourceItemId ?? "") === String(oldRace.id))
      .map(effect => effect.id)
      .filter(Boolean);
    if (effectIds.length) await actor.deleteEmbeddedDocuments("ActiveEffect", effectIds, { add2eInternal: true });
  }
  if (existingRaces.length) await actor.deleteEmbeddedDocuments("Item", existingRaces.map(item => item.id), { add2eInternal: true, render: false });

  const [raceDoc] = await actor.createEmbeddedDocuments("Item", [data], { add2eInternal: true });
  if (!raceDoc) return null;

  if (raceDoc.effects.contents?.length) {
    const effects = raceDoc.effects.contents.map(effect => {
      const effectData = foundry.utils.duplicate(effect.toObject());
      effectData.origin = raceDoc.uuid;
      effectData.disabled = false;
      effectData.transfer = false;
      effectData.flags = effectData.flags ?? {};
      effectData.flags.add2e = { ...(effectData.flags.add2e ?? {}), sourceType: "race", sourceItemId: raceDoc.id, sourceItemUuid: raceDoc.uuid };
      return effectData;
    });
    if (effects.length) await actor.createEmbeddedDocuments("ActiveEffect", effects, { add2eInternal: true });
  }

  const raceSystem = add2eDropClone(raceDoc.system ?? {}) ?? {};
  const rawBonuses = add2eCaracRegistry(raceSystem.bonus_caracteristiques);
  const appliedBonuses = {};
  const report = [];
  for (const carac of CARACS) {
    const raw = rawBonuses[carac];
    const applied = add2eClampRaceBonusForBase(naturalBases[carac], raw);
    appliedBonuses[carac] = applied;
    if (raw || applied) report.push({ carac, base: naturalBases[carac], rawBonus: raw, appliedBonus: applied, total: naturalBases[carac] + applied, changed: raw !== applied });
  }
  add2eDropDebugRaceClass("RACIAL_BONUS_APPLY", { actor: actor.name, race: raceDoc.name, report });

  const update = {
    ...add2eRacialLegacyDeletionUpdate(),
    "system.race": raceDoc.name,
    "system.details_race": { ...raceSystem, bonus_caracteristiques: rawBonuses, name: raceDoc.name, label: raceSystem.label || raceDoc.name, img: raceDoc.img || raceSystem.img || "" },
    "system.force_ex": 0,
    "flags.add2e.base_caracs": naturalBases,
    "flags.add2e.racialAbilityAdjustments": rawBonuses,
    "flags.add2e.racialAbilitySource": { kind: "race", id: raceDoc.id, uuid: raceDoc.uuid, name: raceDoc.name }
  };
  for (const carac of CARACS) update[`system.${carac}_base`] = naturalBases[carac] + appliedBonuses[carac];
  await actor.update(update, { add2eInternal: true, add2eReason: "racial-ability-definitive-apply" });

  if (typeof sheet?.autoSetCaracAjustements === "function") await sheet.autoSetCaracAjustements();
  if (options.notify !== false) ui.notifications.info(`Race ajustée automatiquement : ${raceDoc.name}.`);
  return raceDoc;
}

/**
 * Cette opération est réservée au premier choix de classe. Elle ne retire
 * jamais armes, armures, objets ou composants. Une seconde classe doit passer
 * par 17b-multiclass-drop-v2.mjs et son DialogV2.
 */
export async function add2eApplyClassItemDataToActor(actor, classData, sheet = null, options = {}) {
  if (!actor || !classData || classData.type !== "classe") return null;
  const existingClasses = actor.items.filter(item => String(item.type ?? "").toLowerCase() === "classe");
  if (existingClasses.length) {
    ui.notifications?.warn?.("Le remplacement ou l’ajout d’une classe doit passer par le gestionnaire multiclasses.");
    return null;
  }

  const data = add2eItemDataCloneForDrop(classData);
  data.type = "classe";
  data.system = data.system ?? {};
  data.system.xp = 0;
  data.system.niveau = levelForClassXp(data.system, data.system.xp);
  const alignmentCandidate = add2eDropPickClassAlignment(actor, data, options.alignmentCandidate ?? actor?.system?.alignement ?? "");
  const [classDoc] = await actor.createEmbeddedDocuments("Item", [data], { add2eInternal: true });
  if (!classDoc) return null;

  const classSystem = add2eDropClone(classDoc.system ?? {}) ?? {};
  delete classSystem.niveau;
  delete classSystem.xp;
  Object.assign(classSystem, {
    name: classDoc.name,
    label: classDoc.system?.label || classDoc.name,
    img: classDoc.img || classDoc.system?.img || "",
    sourceItemId: classDoc.id,
    sourceItemUuid: classDoc.uuid
  });
  const updates = {
    "system.classe": classDoc.name,
    "system.details_classe": classSystem,
    "system.spellcasting": classSystem.spellcasting ?? null,
    "system.niveau": classDoc.system.niveau,
    "system.xp": classDoc.system.xp
  };
  if (alignmentCandidate) updates["system.alignement"] = alignmentCandidate;
  const initialProgression = classProgressionRow(classDoc).row;
  if (Array.isArray(initialProgression?.savingThrows)) updates["system.sauvegardes"] = foundry.utils.duplicate(initialProgression.savingThrows);
  await actor.update(updates, { add2eInternal: true });

  if (typeof sheet?.autoSetCaracAjustements === "function") await sheet.autoSetCaracAjustements();
  if (typeof globalThis.add2eRecalculateHitPoints !== "function") {
    throw new Error("Le service canonique ADD2E de recalcul des points de vie est indisponible.");
  }
  await globalThis.add2eRecalculateHitPoints(actor, {
    force: true,
    reason: options.reason || "first-class-drop"
  });
  try { await globalThis.add2eSyncActorSpellsFromClass?.(actor, classDoc, { mode: "replace", showWait: true }); }
  catch (error) { console.error("[ADD2E][CLASSE][SORTS]", error); }
  sheet?.render?.(false);
  if (options.notify !== false) ui.notifications.info(`Classe ajustée automatiquement : ${classDoc.name}.`);
  return classDoc;
}

export async function add2eResolveDropCompatibilityWithPopup(actor, itemData, sheet = null) {
  if (!actor || !itemData || !["classe", "race"].includes(itemData.type)) return { ok: true, handled: false };
  if (itemData.type === "race") {
    const existingClasses = actor.items?.filter?.(item => String(item.type ?? "").toLowerCase() === "classe") ?? [];
    if (existingClasses.length > 1) return { ok: true, handled: false };
    if (existingClasses.length === 1 && !checkClassStatMin(actor, add2eItemDataCloneForDrop(existingClasses[0]), itemData, actor.system?.alignement, { silent: true, ignoreLevelMax: true })) {
      ui.notifications.warn(`Race ${itemData.name} incompatible avec la classe actuelle.`);
      return { ok: false, handled: true };
    }
    await add2eApplyRaceItemDataToActor(actor, itemData, sheet, { notify: true });
    return { ok: true, handled: true };
  }

  if (itemData.type === "classe") {
    if ((actor.items?.filter?.(item => String(item.type ?? "").toLowerCase() === "classe") ?? []).length) return { ok: true, handled: false };
    const alignmentCandidate = add2eDropPickClassAlignment(actor, itemData, actor.system?.alignement ?? "");
    if (!checkClassStatMin(actor, itemData, null, alignmentCandidate, { silent: true, ignoreLevelMax: true })) {
      ui.notifications.warn(`Classe ${itemData.name} incompatible avec la race, l’alignement ou les caractéristiques actuelles.`);
      return { ok: false, handled: true };
    }
  }
  return { ok: true, handled: false };
}

Hooks.once("ready", () => {
  if (!game.user?.isGM || game.users?.activeGM?.id !== game.user.id) return;
  setTimeout(() => {
    for (const actor of game.actors?.contents ?? []) {
      add2eMigrateActorRacialAbilityAdjustments(actor).catch(error => console.error("[ADD2E][RACE][ABILITY_MIGRATION]", { actor: actor?.name, error }));
    }
  }, 250);
});

try { globalThis.add2eDropDebugRaceClass = add2eDropDebugRaceClass; } catch (_error) {}
try { globalThis.add2eItemDataCloneForDrop = add2eItemDataCloneForDrop; } catch (_error) {}
try { globalThis.add2eWorldItemsByType = add2eWorldItemsByType; } catch (_error) {}
try { globalThis.add2eRaceCandidateLabel = add2eRaceCandidateLabel; } catch (_error) {}
try { globalThis.add2eClassCandidateLabel = add2eClassCandidateLabel; } catch (_error) {}
try { globalThis.add2eRaceMatchesClassRules = add2eRaceMatchesClassRules; } catch (_error) {}
try { globalThis.add2eApplyRaceItemDataToActor = add2eApplyRaceItemDataToActor; } catch (_error) {}
try { globalThis.add2eApplyClassItemDataToActor = add2eApplyClassItemDataToActor; } catch (_error) {}
try { globalThis.checkClassStatMin = checkClassStatMin; } catch (_error) {}
try { globalThis.CARACS = CARACS; } catch (_error) {}
try { globalThis.CARAC_SHORT = CARAC_SHORT; } catch (_error) {}
try { globalThis.add2eResolveDropCompatibilityWithPopup = add2eResolveDropCompatibilityWithPopup; } catch (_error) {}
try { globalThis.add2eClampRaceBonusesForExistingBases = add2eClampRaceBonusesForExistingBases; } catch (_error) {}
try { globalThis.add2eMigrateActorRacialAbilityAdjustments = add2eMigrateActorRacialAbilityAdjustments; } catch (_error) {}
try { globalThis.add2ePickClassAlignment = (actor, classData, fallback = "") => add2eDropPickClassAlignment(actor, classData, fallback); } catch (_error) {}