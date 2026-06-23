// ADD2E — Multiclassage : opérations acteur
// Version : 2026-06-23-multiclass-monoclass-collapse-v2

import { classItems, classSlug, cloneItemData, INTERNAL, itemLabel, norm, num, systemRace, warn } from "./17b-multiclass-core.mjs";
import { classPrerequisitesOk, classRaceMaxLevel, classTitleForLevel, currentRaceOrCompatibleAlternatives, levelForClassXp, minXpForClassLevel, multiclassUpdatePayload, nextXpForClassLevel, raceCompatibleForMulticlass, raceMatchesClassRules, raceAllowsClassSet, monoClassCleanupPayload } from "./17b-multiclass-rules.mjs";
import { dialogAlert } from "./17b-multiclass-dialogs.mjs";

function monoclassProgressionPayload(actor, classDoc) {
  const classSystem = classDoc?.system ?? {};
  const slug = classSlug(classDoc);
  const xpMap = foundry.utils.deepClone(actor?.system?.xp_par_classe ?? {});
  const levelMap = foundry.utils.deepClone(actor?.system?.niveaux_par_classe ?? {});

  const classXp = num(xpMap?.[slug], NaN);
  let xp = Number.isFinite(classXp)
    ? Math.max(0, Math.floor(classXp))
    : Math.max(0, Math.floor(num(actor?.system?.xp, 0)));

  const classLevel = num(levelMap?.[slug], NaN);
  let level = Number.isFinite(classLevel) && classLevel > 0
    ? Math.max(1, Math.floor(classLevel))
    : levelForClassXp(classSystem, xp);

  xp = Math.max(xp, minXpForClassLevel(classSystem, level));

  const maxLevel = classRaceMaxLevel(classDoc, systemRace(actor));
  if (maxLevel > 0 && level > maxLevel) {
    level = maxLevel;
    xp = minXpForClassLevel(classSystem, level);
  }

  const currentXp = minXpForClassLevel(classSystem, level);
  const nextXp = nextXpForClassLevel(classSystem, level);
  const title = classTitleForLevel(classSystem, level);
  const xpPercent = nextXp > currentXp
    ? Math.max(0, Math.min(100, Math.floor(((xp - currentXp) / (nextXp - currentXp)) * 100)))
    : 100;

  return {
    "system.niveau": level,
    "system.niveau_suggere": level,
    "system.xp": xp,
    "system.titre": title,
    "system.progression_xp": nextXp ? `${xp.toLocaleString()} / ${nextXp.toLocaleString()} XP` : `${xp.toLocaleString()} XP`,
    "system.xp_next": nextXp,
    "system.xp_to_next": nextXp ? Math.max(0, nextXp - xp) : 0,
    "system.xp_percent": xpPercent
  };
}

export async function cleanupAfterMonoclassReplace(actor, itemData, sheet = null) {
  if (!actor || actor.type !== "personnage") return false;
  const wantedSlug = classSlug(itemData);
  const docs = classItems(actor);
  const keep = docs.find(doc => classSlug(doc) === wantedSlug) ?? docs.at(-1) ?? null;
  const toDelete = docs.filter(doc => doc.id !== keep?.id);
  if (toDelete.length) await actor.deleteEmbeddedDocuments("Item", toDelete.map(doc => doc.id), { [INTERNAL]: true, add2eInternal: true });
  const payload = monoClassCleanupPayload();
  if (keep) {
    payload["system.details_classe"] = { ...(keep.system ?? {}), name: keep.name, label: keep.name, slug: classSlug(keep), sourceItemId: keep.id, sourceItemUuid: keep.uuid };
    payload["system.classe"] = keep.name;
    payload["system.spellcasting"] = foundry.utils.deepClone(keep.system?.spellcasting ?? null);
    Object.assign(payload, monoclassProgressionPayload(actor, keep));
  }
  await actor.update(payload, { [INTERNAL]: true, add2eInternal: true, add2eReason: "multiclass-monoclass-clean-system" });
  sheet?._add2eRememberActiveTab?.();
  sheet?.render?.(false);
  return true;
}

export function applyPayloadToSheetData(data, payload) {
  if (!data?.actor?.system || !payload) return data;
  for (const [path, value] of Object.entries(payload)) foundry.utils.setProperty(data.actor, path, value);
  data.progressionCourante = { title: data.actor.system?.titre ?? "" };
  return data;
}

export async function applyRaceData(actor, raceData, sheet = null) {
  if (!raceData) return false;
  if (norm(itemLabel(systemRace(actor), "Race")) === norm(itemLabel(raceData, "Race"))) return true;
  if (typeof add2eApplyRaceItemDataToActor === "function") {
    await add2eApplyRaceItemDataToActor(actor, raceData, sheet, { notify: true, reason: "multiclass-direct-race-choice" });
    return true;
  }
  const data = cloneItemData(raceData);
  data.type = "race";
  const old = actor.items.filter(i => String(i.type || "").toLowerCase() === "race");
  if (old.length) await actor.deleteEmbeddedDocuments("Item", old.map(i => i.id), { [INTERNAL]: true, add2eInternal: true });
  const [raceDoc] = await actor.createEmbeddedDocuments("Item", [data], { [INTERNAL]: true, add2eInternal: true });
  await actor.update({ "system.race": raceDoc.name, "system.details_race": { ...(raceDoc.system ?? {}), name: raceDoc.name, label: raceDoc.name }, "system.bonus_caracteristiques": foundry.utils.deepClone(raceDoc.system?.bonus_caracteristiques ?? {}) }, { [INTERNAL]: true, add2eInternal: true });
  return true;
}

export async function applyClassAsMonoclass(actor, optionOrItemData, sheet = null) {
  const itemData = optionOrItemData?.classData ?? optionOrItemData;
  const raceData = optionOrItemData?.raceData ?? systemRace(actor);
  if (!itemData || !classPrerequisitesOk(actor, itemData, raceData, { notify: true })) return false;
  await applyRaceData(actor, raceData, sheet);
  if (typeof add2eApplyClassItemDataToActor === "function") {
    const alignment = typeof add2ePickClassAlignment === "function" ? add2ePickClassAlignment(actor, itemData?.system ?? itemData ?? {}) : actor.system?.alignement;
    const result = await add2eApplyClassItemDataToActor(actor, itemData, sheet, { alignmentCandidate: alignment, notify: true, reason: "multiclass-choice-monoclass" });
    await cleanupAfterMonoclassReplace(actor, itemData, sheet);
    return result;
  }
  ui.notifications.error("Remplacement mono-classe impossible : helper add2eApplyClassItemDataToActor introuvable.");
  return false;
}

export async function addClassAsMulticlass(actor, option, sheet = null) {
  const itemData = option?.classData;
  if (!itemData) return false;
  if (!raceCompatibleForMulticlass(actor, itemData, option.raceData) || !classPrerequisitesOk(actor, itemData, option.raceData, { notify: true })) return false;
  const slug = classSlug(itemData);
  const already = classItems(actor).find(c => classSlug(c) === slug);
  if (already) {
    const payload = multiclassUpdatePayload(actor);
    if (payload) await actor.update(payload, { [INTERNAL]: true, add2eInternal: true, add2eReason: "multiclass-resync-existing-class" });
    sheet?._add2eRememberActiveTab?.();
    sheet?.render?.(false);
    ui.notifications.info(`${already.name} est déjà présente : acteur multiclassé recalculé.`);
    return true;
  }
  await applyRaceData(actor, option.raceData, sheet);
  const data = cloneItemData(itemData);
  data.type = "classe";
  const [classDoc] = await actor.createEmbeddedDocuments("Item", [data], { [INTERNAL]: true, add2eInternal: true });
  if (!classDoc) return false;
  const oldXpMap = foundry.utils.deepClone(actor.system?.xp_par_classe ?? {});
  oldXpMap[slug] ??= minXpForClassLevel(classDoc.system ?? {}, 1);
  const payload = multiclassUpdatePayload(actor, classDoc, oldXpMap, null, systemRace(actor));
  if (payload) await actor.update(payload, { [INTERNAL]: true, add2eInternal: true, add2eReason: "multiclass-add-class" });
  try { if (typeof add2eSyncActorSpellsFromClass === "function") await add2eSyncActorSpellsFromClass(actor, classDoc, { mode: "append", showWait: true }); }
  catch (err) { warn("[SPELL_SYNC][APPEND_ERROR]", err); }
  sheet?._add2eRememberActiveTab?.();
  sheet?.render?.(false);
  ui.notifications.info(`Multiclassage appliqué : ${classDoc.name} avec ${itemLabel(option.raceData, "Race")}.`);
  return true;
}

export async function replaceClassInMulticlass(actor, option, sheet = null) {
  const itemData = option?.classData;
  if (!itemData || !option?.replacedClassId) return false;
  const names = classItems(actor).filter(c => c.id !== option.replacedClassId && classSlug(c) !== option.replacedClassSlug).map(c => c.name).concat(itemLabel(itemData, "Classe"));
  const ok = names.length <= 1 || raceAllowsClassSet(option.raceData, names);
  if (!ok || !raceMatchesClassRules(option.raceData, itemData) || !classPrerequisitesOk(actor, itemData, option.raceData, { notify: true })) return false;
  const replaced = classItems(actor).find(cls => cls.id === option.replacedClassId || classSlug(cls) === option.replacedClassSlug);
  if (!replaced) { ui.notifications.error("Classe à remplacer introuvable dans l'acteur."); return false; }

  const targetSlug = classSlug(itemData);
  const remainingClasses = classItems(actor).filter(cls => cls.id !== replaced.id);
  const targetAlreadyPresent = remainingClasses.some(cls => classSlug(cls) === targetSlug);
  if (targetAlreadyPresent) {
    if (remainingClasses.length === 1) return applyClassAsMonoclass(actor, { classData: itemData, raceData: option.raceData }, sheet);
    ui.notifications.warn(`${itemLabel(itemData, "Classe")} est déjà présente dans le multiclassage.`);
    return false;
  }

  await applyRaceData(actor, option.raceData, sheet);
  await actor.deleteEmbeddedDocuments("Item", [replaced.id], { [INTERNAL]: true, add2eInternal: true, add2eReason: "multiclass-replace-class-delete" });
  const data = cloneItemData(itemData);
  data.type = "classe";
  const [classDoc] = await actor.createEmbeddedDocuments("Item", [data], { [INTERNAL]: true, add2eInternal: true, add2eReason: "multiclass-replace-class-create" });
  const xpMap = foundry.utils.deepClone(actor.system?.xp_par_classe ?? {});
  xpMap[option.replacedClassSlug] = undefined;
  xpMap[classSlug(classDoc)] ??= minXpForClassLevel(classDoc.system ?? {}, 1);
  const payload = multiclassUpdatePayload(actor, null, xpMap, null, systemRace(actor));
  if (payload) await actor.update(payload, { [INTERNAL]: true, add2eInternal: true, add2eReason: "multiclass-replace-class" });
  try { if (typeof add2eSyncActorSpellsFromClass === "function") await add2eSyncActorSpellsFromClass(actor, classDoc, { mode: "append", showWait: true }); }
  catch (err) { warn("[SPELL_SYNC][REPLACE_ERROR]", err); }
  sheet?._add2eRememberActiveTab?.();
  sheet?.render?.(false);
  ui.notifications.info(`Classe remplacée : ${option.replacedClassName} → ${classDoc.name}.`);
  return true;
}

export async function applyRaceForMulticlass(actor, raceData, sheet = null) {
  const classes = classItems(actor);
  if (classes.length <= 1) return false;
  const ok = classes.every(cls => raceCompatibleForMulticlass(actor, cls, raceData));
  if (!ok) {
    await dialogAlert("ADD2E — Race incompatible", `<p>La race <b>${itemLabel(raceData, "Race")}</b> n'est pas compatible avec le multiclassage actuel.</p>`);
    return true;
  }
  await applyRaceData(actor, raceData, sheet);
  const payload = multiclassUpdatePayload(actor, null, null, null, raceData);
  if (payload) await actor.update(payload, { [INTERNAL]: true, add2eInternal: true, add2eReason: "multiclass-race-refresh" });
  sheet?.render?.(false);
  return true;
}

export async function recalcActor(actor) {
  if (!actor || actor.type !== "personnage") return null;
  const payload = multiclassUpdatePayload(actor);
  if (!payload) return null;
  await actor.update(payload, { [INTERNAL]: true, add2eInternal: true, add2eReason: "multiclass-recalc" });
  return payload;
}

export { currentRaceOrCompatibleAlternatives };
