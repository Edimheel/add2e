// ============================================================
// ADD2E — Drop race / classe : noyau non destructif
// Compatible Foundry V13/V14/V15.
// ============================================================

export const ADD2E_RACE_CLASS_DROP_VERSION = "2026-06-25-race-class-drop-safe-v2";
globalThis.ADD2E_RACE_CLASS_DROP_VERSION = ADD2E_RACE_CLASS_DROP_VERSION;

export const CARACS = ["force", "dexterite", "constitution", "intelligence", "sagesse", "charisme"];
export const CARAC_SHORT = { force: "FOR", dexterite: "DEX", constitution: "CON", intelligence: "INT", sagesse: "SAG", charisme: "CHA" };

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
    .replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, "").replace(/[_\s-]+/g, "_");
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
  if (typeof globalThis.add2eRaceTagsFromData === "function") return globalThis.add2eRaceTagsFromData(raceData);
  const system = raceData?.system ?? {};
  const base = add2eNormalizeDropTag(raceData?.name ?? system.slug ?? system.label ?? system.name ?? system.nom ?? "");
  const tags = [
    ...add2eToDropArray(system.identityTags),
    ...add2eToDropArray(system.raceTags),
    ...add2eToDropArray(system.tags),
    ...(base ? [`race:${base}`, base] : [])
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

export function add2eActorBaseCaracForRaceDrop(actor, carac) {
  return add2eDropNumber(actor?.system?.[`${carac}_base`] ?? actor?.system?.[carac], 10);
}

export function add2eClampRaceBonusForBase(base, bonus) {
  const current = add2eDropNumber(base, 10);
  const raw = add2eDropNumber(bonus, 0);
  if (raw > 0 && current + raw > 18) return Math.max(0, 18 - current);
  if (raw < 0 && current + raw < 3) return Math.min(0, 3 - current);
  return raw;
}

export function add2eClampRaceBonusesForExistingBases(actor, rawBonuses = {}, context = {}) {
  const source = rawBonuses && typeof rawBonuses === "object" ? rawBonuses : {};
  const output = add2eDropClone(source) ?? {};
  const report = [];
  for (const carac of CARACS) {
    const base = add2eActorBaseCaracForRaceDrop(actor, carac);
    const raw = add2eDropNumber(output?.[carac], 0);
    if (!raw) continue;
    const applied = add2eClampRaceBonusForBase(base, raw);
    output[carac] = applied;
    report.push({ carac, base, rawBonus: raw, appliedBonus: applied, total: base + applied, changed: raw !== applied });
  }
  add2eDropDebugRaceClass("RACIAL_BONUS_CAP", { actor: actor?.name, race: context?.raceName ?? null, report, adjustedBonuses: output });
  return output;
}

export function add2eRaceAdjustedCaracTotal(actor, carac, rawBonuses = {}) {
  const base = add2eActorBaseCaracForRaceDrop(actor, carac);
  return base + add2eClampRaceBonusForBase(base, rawBonuses?.[carac] ?? actor?.system?.[`${carac}_race`] ?? 0);
}

export function checkClassStatMin(actor, classItem, candidateRaceData = null, candidateAlignment = null, options = {}) {
  const silent = options?.silent === true;
  const ignoreLevelMax = options?.ignoreLevelMax === true;
  const classSystem = classItem?.system ?? classItem ?? {};
  const actorSystem = actor?.system ?? {};
  const raceData = candidateRaceData ?? actor?.items?.find?.(item => String(item.type ?? "").toLowerCase() === "race") ?? null;
  const raceTags = add2eRaceTagsFromDataSafe(raceData);
  const actorLevel = Number(actorSystem.niveau ?? 1) || 1;
  const candidateBonus = candidateRaceData?.system?.bonus_caracteristiques ?? actorSystem.bonus_caracteristiques ?? {};
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
      if (!ignoreLevelMax && Number.isFinite(maxLevel) && maxLevel > 0 && actorLevel > maxLevel) missing.push(`${matchedTag} limité au niveau ${maxLevel}`);
    }
  }

  for (const [carac, rawMin] of Object.entries(classSystem.caracs_min || {})) {
    const minimum = Number(rawMin);
    if (!Number.isFinite(minimum)) continue;
    const total = add2eRaceAdjustedCaracTotal(actor, carac, candidateBonus);
    if (total < minimum) missing.push(`${carac} ${total} < ${minimum}`);
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
  const data = add2eItemDataCloneForDrop(raceData);
  data.type = "race";

  const existingRaces = actor.items.filter(item => String(item.type ?? "").toLowerCase() === "race");
  for (const oldRace of existingRaces) {
    const effectIds = actor.effects
      .filter(effect => effect.origin === oldRace.uuid || String(effect?.flags?.add2e?.sourceItemId ?? "") === String(oldRace.id))
      .map(effect => effect.id)
      .filter(Boolean);
    if (effectIds.length) await actor.deleteEmbeddedDocuments("ActiveEffect", effectIds, { add2eInternal: true });
  }
  if (existingRaces.length) await actor.deleteEmbeddedDocuments("Item", existingRaces.map(item => item.id), { add2eInternal: true, render: false });

  await actor.update({ "system.bonus_caracteristiques": {} }, { add2eInternal: true });
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
  const bonuses = add2eClampRaceBonusesForExistingBases(actor, raceSystem.bonus_caracteristiques ?? {}, { raceName: raceDoc.name });
  await actor.update({
    "system.race": raceDoc.name,
    "system.details_race": { ...raceSystem, bonus_caracteristiques: bonuses, name: raceDoc.name, label: raceSystem.label || raceDoc.name, img: raceDoc.img || raceSystem.img || "" },
    "system.bonus_caracteristiques": bonuses
  }, { add2eInternal: true });

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
  data.system.niveau = Math.max(1, Number(actor.system?.niveau) || 1);
  data.system.xp = Math.max(0, Number(actor.system?.xp) || 0);
  const alignmentCandidate = options.alignmentCandidate ?? actor?.system?.alignement ?? "";
  const [classDoc] = await actor.createEmbeddedDocuments("Item", [data], { add2eInternal: true });
  if (!classDoc) return null;

  const classSystem = {
    ...(add2eDropClone(classDoc.system ?? {}) ?? {}),
    name: classDoc.name,
    label: classDoc.system?.label || classDoc.name,
    img: classDoc.img || classDoc.system?.img || "",
    sourceItemId: classDoc.id,
    sourceItemUuid: classDoc.uuid
  };
  const updates = {
    "system.classe": classDoc.name,
    "system.details_classe": classSystem,
    "system.spellcasting": classSystem.spellcasting ?? null,
    "system.niveau": classDoc.system.niveau,
    "system.xp": classDoc.system.xp
  };
  if (alignmentCandidate) updates["system.alignement"] = alignmentCandidate;
  if (classDoc.system?.progression?.[0]?.sauvegardes) updates["system.sauvegardes"] = foundry.utils.duplicate(classDoc.system.progression[0].sauvegardes);
  await actor.update(updates, { add2eInternal: true });

  if (typeof sheet?.autoSetCaracAjustements === "function") await sheet.autoSetCaracAjustements();
  if (typeof sheet?.autoSetPointsDeCoup === "function") await sheet.autoSetPointsDeCoup({ syncCurrent: true, force: true, reason: options.reason || "first-class-drop" });
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
    const alignmentCandidate = actor.system?.alignement ?? "";
    if (!checkClassStatMin(actor, itemData, null, alignmentCandidate, { silent: true, ignoreLevelMax: true })) {
      ui.notifications.warn(`Classe ${itemData.name} incompatible avec la race ou les caractéristiques actuelles.`);
      return { ok: false, handled: true };
    }
  }
  return { ok: true, handled: false };
}

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