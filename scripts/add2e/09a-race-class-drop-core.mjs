// ============================================================
// ADD2E — Auto-compatibilité race / classe au drop — noyau
// Version : 2026-06-15-race-class-drop-split-v1
// ============================================================

export const ADD2E_RACE_CLASS_DROP_VERSION = "2026-06-15-race-class-drop-split-v1";
globalThis.ADD2E_RACE_CLASS_DROP_VERSION = ADD2E_RACE_CLASS_DROP_VERSION;
console.log("[ADD2E][DROP][RACE_CLASSE][VERSION]", ADD2E_RACE_CLASS_DROP_VERSION);

export const CARACS = ["force", "dexterite", "constitution", "intelligence", "sagesse", "charisme"];
export const CARAC_SHORT = { force: "FOR", dexterite: "DEX", constitution: "CON", intelligence: "INT", sagesse: "SAG", charisme: "CHA" };

export function add2eDropDebugRaceClass(...args) {
  if (globalThis.ADD2E_DEBUG_RACE_CLASSE === true) console.log("[ADD2E][DROP][RACE_CLASSE]", ...args);
}

export function add2eDropClone(value) {
  if (value === undefined || value === null) return value;
  try { return foundry.utils.deepClone(value); } catch (_e) {}
  try { return foundry.utils.duplicate(value); } catch (_e) {}
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
    .filter(i => String(i?.type ?? "").toLowerCase() === wanted)
    .map(i => add2eItemDataCloneForDrop(i))
    .filter(Boolean);
}

export function add2eRaceCandidateLabel(raceData) {
  return String(raceData?.name ?? raceData?.system?.label ?? raceData?.system?.nom ?? "Race").trim() || "Race";
}

export function add2eClassCandidateLabel(classData) {
  return String(classData?.name ?? classData?.system?.label ?? classData?.system?.nom ?? "Classe").trim() || "Classe";
}

export function add2eNormalizeDropTag(value) {
  if (typeof add2eNormalizeEquipTag === "function") return add2eNormalizeEquipTag(value);
  return String(value ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, "").replace(/[_\s-]+/g, "_");
}

export function add2eToDropArray(value) {
  if (typeof add2eToEquipArray === "function") return add2eToEquipArray(value);
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string") return value.split(/[,;\n]+/).map(v => v.trim()).filter(Boolean);
  if (typeof value === "object") return Object.values(value).filter(Boolean);
  return [];
}

export function add2eRaceTagsFromDataSafe(raceData) {
  if (typeof add2eRaceTagsFromData === "function") return add2eRaceTagsFromData(raceData);
  const sys = raceData?.system ?? {};
  const base = add2eNormalizeDropTag(raceData?.name ?? sys.slug ?? sys.label ?? sys.name ?? sys.nom ?? "");
  const tags = [...add2eToDropArray(sys.identityTags), ...add2eToDropArray(sys.raceTags), ...add2eToDropArray(sys.tags), ...(base ? [`race:${base}`, base] : [])];
  return [...new Set(tags.map(add2eNormalizeDropTag).filter(Boolean))];
}

export function add2eRaceMatchesClassRules(raceData, classData) {
  const rules = (classData?.system ?? classData ?? {})?.raceRestriction?.races;
  if (!rules || typeof rules !== "object" || !Object.keys(rules).length) return true;
  const tags = add2eRaceTagsFromDataSafe(raceData).map(add2eNormalizeDropTag);
  const normalized = {};
  for (const [tag, rule] of Object.entries(rules)) normalized[add2eNormalizeDropTag(tag)] = rule;
  const matched = tags.find(t => Object.prototype.hasOwnProperty.call(normalized, t));
  return matched ? normalized[matched]?.allowed === true : false;
}

export function add2eDropNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function add2eActorBaseCaracForRaceDrop(actor, carac) {
  return add2eDropNumber(actor?.system?.[`${carac}_base`] ?? actor?.system?.[carac], 10);
}

export function add2eClampRaceBonusForBase(base, bonus) {
  const b = add2eDropNumber(base, 10);
  const raw = add2eDropNumber(bonus, 0);
  if (raw > 0 && b + raw > 18) return Math.max(0, 18 - b);
  if (raw < 0 && b + raw < 3) return Math.min(0, 3 - b);
  return raw;
}

export function add2eClampRaceBonusesForExistingBases(actor, rawBonuses = {}, context = {}) {
  const source = rawBonuses && typeof rawBonuses === "object" ? rawBonuses : {};
  const out = add2eDropClone(source) ?? {};
  const report = [];
  for (const carac of CARACS) {
    const base = add2eActorBaseCaracForRaceDrop(actor, carac);
    const raw = add2eDropNumber(out?.[carac], 0);
    if (!raw) continue;
    const applied = add2eClampRaceBonusForBase(base, raw);
    out[carac] = applied;
    report.push({ carac, base, rawBonus: raw, appliedBonus: applied, total: base + applied, changed: raw !== applied });
  }
  add2eDropDebugRaceClass("RACIAL_BONUS_CAP", { actor: actor?.name, race: context?.raceName ?? null, report, adjustedBonuses: out });
  return out;
}

export function add2eRaceAdjustedCaracTotal(actor, carac, rawBonuses = {}) {
  const base = add2eActorBaseCaracForRaceDrop(actor, carac);
  return base + add2eClampRaceBonusForBase(base, rawBonuses?.[carac] ?? actor?.system?.[`${carac}_race`] ?? 0);
}

export function checkClassStatMin(actor, classeItem, candidateRaceData = null, candidateAlignment = null, options = {}) {
  const silent = options?.silent === true;
  const ignoreLevelMax = options?.ignoreLevelMax === true;
  const classeSystem = classeItem?.system ?? classeItem ?? {};
  const actorSystem = actor?.system ?? {};
  const raceData = candidateRaceData ?? actor?.items?.find?.(i => String(i.type || "").toLowerCase() === "race") ?? null;
  const raceTags = add2eRaceTagsFromDataSafe(raceData);
  const actorLevel = Number(actorSystem.niveau ?? 1) || 1;
  const candidateBonus = candidateRaceData?.system?.bonus_caracteristiques ?? actorSystem.bonus_caracteristiques ?? {};
  const manques = [];

  const races = classeSystem.raceRestriction?.races;
  if (races && typeof races === "object" && Object.keys(races).length) {
    const normalizedRules = {};
    for (const [tag, rule] of Object.entries(races)) normalizedRules[add2eNormalizeDropTag(tag)] = rule;
    const matchedTag = raceTags.find(tag => Object.prototype.hasOwnProperty.call(normalizedRules, tag));
    if (!matchedTag) manques.push(`race non autorisée (${raceTags.join(", ") || "aucun tag race:*"})`);
    else {
      const rule = normalizedRules[matchedTag] ?? {};
      if (rule.allowed !== true) manques.push(`race interdite (${matchedTag})`);
      const maxLevel = Number(rule.maxLevel ?? rule.niveauMax ?? rule.max);
      if (!ignoreLevelMax && Number.isFinite(maxLevel) && maxLevel > 0 && actorLevel > maxLevel) manques.push(`${matchedTag} limité au niveau ${maxLevel}`);
    }
  }

  for (const [carac, rawMin] of Object.entries(classeSystem.caracs_min || {})) {
    const minVal = Number(rawMin);
    if (!Number.isFinite(minVal)) continue;
    const total = add2eRaceAdjustedCaracTotal(actor, carac, candidateBonus);
    if (total < minVal) manques.push(`${carac} ${total} < ${minVal}`);
  }

  if (manques.length) {
    if (!silent) {
      ui.notifications.warn(`Prérequis insuffisants pour la classe "${classeItem?.name ?? "Classe"}" (${manques.join(", ")})`);
      console.warn("[ADD2E][DROP][RACE_CLASSE][REFUS_PREREQUIS]", { actor: actor?.name, classe: classeItem?.name, race: raceData?.name ?? null, raceTags, manques });
    }
    return false;
  }
  return true;
}

export async function add2eApplyRaceItemDataToActor(actor, raceData, sheet = null, options = {}) {
  if (!actor || !raceData || raceData.type !== "race") return null;
  const data = add2eItemDataCloneForDrop(raceData);
  data.type = "race";

  const existingRaces = actor.items.filter(i => String(i.type || "").toLowerCase() === "race");
  for (const oldRace of existingRaces) {
    const raceEffects = actor.effects.filter(eff => eff.origin === oldRace.uuid);
    if (raceEffects.length) await actor.deleteEmbeddedDocuments("ActiveEffect", raceEffects.map(e => e.id).filter(Boolean), { add2eInternal: true });
    await oldRace.delete({ render: false });
  }

  await actor.update({ "system.bonus_caracteristiques": {} }, { add2eInternal: true });
  const [raceDoc] = await actor.createEmbeddedDocuments("Item", [data], { add2eInternal: true });
  if (!raceDoc) return null;

  if (raceDoc.effects.contents?.length) {
    const actorEffects = raceDoc.effects.contents.map(eff => {
      const effectData = foundry.utils.duplicate(eff.toObject());
      effectData.origin = raceDoc.uuid;
      effectData.disabled = false;
      effectData.transfer = false;
      effectData.flags = effectData.flags ?? {};
      effectData.flags.add2e = { ...(effectData.flags.add2e ?? {}), sourceType: "race", sourceItemId: raceDoc.id, sourceItemUuid: raceDoc.uuid };
      return effectData;
    });
    if (actorEffects.length) await actor.createEmbeddedDocuments("ActiveEffect", actorEffects, { add2eInternal: true });
  }

  const raceSystem = add2eDropClone(raceDoc.system ?? {}) ?? {};
  const adjustedBonuses = add2eClampRaceBonusesForExistingBases(actor, raceSystem.bonus_caracteristiques ?? {}, { raceName: raceDoc.name });
  await actor.update({
    "system.race": raceDoc.name,
    "system.details_race": { ...raceSystem, bonus_caracteristiques: adjustedBonuses, name: raceDoc.name, label: raceSystem.label || raceDoc.name, img: raceDoc.img || raceSystem.img || "" },
    "system.bonus_caracteristiques": adjustedBonuses
  }, { add2eInternal: true });

  add2eDropDebugRaceClass("RACE_APPLIED", { actor: actor.name, race: raceDoc.name, adjustedBonuses, forceBase: actor.system?.force_base, forceEx: actor.system?.force_ex });
  if (typeof sheet?.autoSetCaracAjustements === "function") await sheet.autoSetCaracAjustements();
  if (options.notify !== false) ui.notifications.info(`Race ajustée automatiquement : ${raceDoc.name}.`);
  return raceDoc;
}

export async function add2eApplyClassItemDataToActor(actor, classData, sheet = null, options = {}) {
  if (!actor || !classData || classData.type !== "classe") return null;
  const data = add2eItemDataCloneForDrop(classData);
  data.type = "classe";
  const alignmentCandidate = options.alignmentCandidate ?? actor?.system?.alignement ?? "";
  const typesToDelete = ["classe", "sort", "arme", "armure", "spell", "weapon", "armor"];
  const itemIdsToDelete = actor.items.filter(i => typesToDelete.includes(String(i.type || "").toLowerCase())).map(i => i.id).filter(Boolean);
  if (itemIdsToDelete.length) await actor.deleteEmbeddedDocuments("Item", itemIdsToDelete, { add2eInternal: true });
  const [classDoc] = await actor.createEmbeddedDocuments("Item", [data], { add2eInternal: true });
  if (!classDoc) return null;
  const classSystem = { ...(add2eDropClone(classDoc.system ?? {}) ?? {}), name: classDoc.name, label: classDoc.system?.label || classDoc.name, img: classDoc.img || classDoc.system?.img || "", sourceItemId: classDoc.id, sourceItemUuid: classDoc.uuid };
  const updates = { "system.classe": classDoc.name, "system.details_classe": classSystem, "system.spellcasting": classSystem.spellcasting ?? null };
  if (alignmentCandidate) updates["system.alignement"] = alignmentCandidate;
  if (classDoc.system?.progression?.[0]?.sauvegardes) updates["system.sauvegardes"] = foundry.utils.duplicate(classDoc.system.progression[0].sauvegardes);
  await actor.update(updates, { add2eInternal: true });
  if (typeof sheet?.autoSetCaracAjustements === "function") await sheet.autoSetCaracAjustements();
  if (typeof sheet?.autoSetPointsDeCoup === "function") await sheet.autoSetPointsDeCoup({ syncCurrent: true, force: true, reason: options.reason || "auto-class-compat" });
  try { if (typeof add2eSyncActorSpellsFromClass === "function") await add2eSyncActorSpellsFromClass(actor, classDoc, { mode: "replace", showWait: true }); } catch (e) { console.error("[ADD2E][CLASSE][SORTS]", e); }
  sheet?.render?.(false);
  if (options.notify !== false) ui.notifications.info(`Classe ajustée automatiquement : ${classDoc.name}.`);
  return classDoc;
}

export async function add2eResolveDropCompatibilityWithPopup(actor, itemData, sheet = null) {
  if (!actor || !itemData || !["classe", "race"].includes(itemData.type)) return { ok: true, handled: false };
  console.log("[ADD2E][DROP][RACE_CLASSE][RESOLVE]", { version: ADD2E_RACE_CLASS_DROP_VERSION, actor: actor.name, item: itemData.name, type: itemData.type });

  if (itemData.type === "race") {
    const existingClass = actor.items?.find?.(i => String(i.type || "").toLowerCase() === "classe");
    if (existingClass) {
      const existingClassData = add2eItemDataCloneForDrop(existingClass);
      const ok = checkClassStatMin(actor, existingClassData, itemData, actor.system?.alignement, { silent: true, ignoreLevelMax: true });
      if (!ok) {
        ui.notifications.warn(`Race ${itemData.name} incompatible avec la classe actuelle.`);
        return { ok: false, handled: true };
      }
    }
    await add2eApplyRaceItemDataToActor(actor, itemData, sheet, { notify: true });
    return { ok: true, handled: true };
  }

  if (itemData.type === "classe") {
    const alignmentCandidate = actor.system?.alignement ?? "";
    if (!checkClassStatMin(actor, itemData, null, alignmentCandidate, { silent: true, ignoreLevelMax: true })) {
      ui.notifications.warn(`Classe ${itemData.name} incompatible avec la race ou les caractéristiques actuelles.`);
      return { ok: false, handled: true };
    }
    return { ok: true, handled: false };
  }

  return { ok: true, handled: false };
}

try { globalThis.add2eDropDebugRaceClass = add2eDropDebugRaceClass; } catch (_e) {}
try { globalThis.add2eItemDataCloneForDrop = add2eItemDataCloneForDrop; } catch (_e) {}
try { globalThis.add2eWorldItemsByType = add2eWorldItemsByType; } catch (_e) {}
try { globalThis.add2eRaceCandidateLabel = add2eRaceCandidateLabel; } catch (_e) {}
try { globalThis.add2eClassCandidateLabel = add2eClassCandidateLabel; } catch (_e) {}
try { globalThis.add2eRaceMatchesClassRules = add2eRaceMatchesClassRules; } catch (_e) {}
try { globalThis.add2eApplyRaceItemDataToActor = add2eApplyRaceItemDataToActor; } catch (_e) {}
try { globalThis.add2eApplyClassItemDataToActor = add2eApplyClassItemDataToActor; } catch (_e) {}
try { globalThis.checkClassStatMin = checkClassStatMin; } catch (_e) {}
try { globalThis.CARACS = CARACS; } catch (_e) {}
try { globalThis.CARAC_SHORT = CARAC_SHORT; } catch (_e) {}
try { globalThis.add2eResolveDropCompatibilityWithPopup = add2eResolveDropCompatibilityWithPopup; } catch (_e) {}
try { globalThis.add2eClampRaceBonusesForExistingBases = add2eClampRaceBonusesForExistingBases; } catch (_e) {}
try { globalThis.ADD2E_RACE_CLASS_DROP_VERSION = ADD2E_RACE_CLASS_DROP_VERSION; } catch (_e) {}
