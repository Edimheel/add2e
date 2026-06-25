// ADD2E — Multiclassage : opérations canoniques
// Les Items classe sont l'unique état de progression. L'acteur ne conserve
// que des résumés d'affichage et des métadonnées sans niveaux ni XP par classe.

import {
  INTERNAL,
  canonicalClassState,
  classItems,
  classProgression,
  classProgressionUpdate,
  classSlug,
  cloneItemData,
  itemLabel,
  multiclassEnabled,
  norm,
  num,
  systemRace,
  warn
} from "./17b-multiclass-core.mjs";
import {
  canonicalMulticlassEntries,
  canonicalStateRecord,
  classPrerequisitesOk,
  classRaceMaxLevel,
  classTitleForLevel,
  currentRaceOrCompatibleAlternatives,
  legacyMulticlassMigrationPlan,
  levelForClassXp,
  minXpForClassLevel,
  monoClassCleanupPayload,
  monoClassStateFromActor,
  multiclassUpdatePayload,
  nextXpForClassLevel,
  raceCompatibleForMulticlass,
  raceMatchesClassRules,
  raceAllowsClassSet
} from "./17b-multiclass-rules.mjs";
import { dialogAlert } from "./17b-multiclass-dialogs.mjs";

const migrationLocks = new Set();
const migrationWarnings = new Set();

function itemIds(items) {
  return (items ?? []).map(item => item?.id).filter(Boolean);
}

function sourceClassKeys(classDocs) {
  const ids = new Set();
  const uuids = new Set();
  const slugs = new Set();
  for (const doc of classDocs ?? []) {
    if (doc?.id) ids.add(String(doc.id));
    if (doc?.uuid) uuids.add(String(doc.uuid));
    const slug = classSlug(doc);
    if (slug) slugs.add(slug);
  }
  return { ids, uuids, slugs };
}

function itemBelongsToRemovedClass(item, keys) {
  const flags = item?.flags?.add2e ?? {};
  const sourceId = String(
    flags.autoGrantedByClassId
    ?? flags.sourceClassId
    ?? flags.sourceItemId
    ?? flags.classId
    ?? ""
  );
  const sourceSlug = norm(
    flags.autoGrantedByClass
    ?? flags.sourceClassSlug
    ?? flags.sourceClasse
    ?? flags.sourceClass
    ?? flags.classSlug
    ?? ""
  );
  return (sourceId && keys.ids.has(sourceId)) || (sourceSlug && keys.slugs.has(sourceSlug));
}

function effectBelongsToRemovedClass(effect, keys) {
  const flags = effect?.flags?.add2e ?? {};
  const origin = String(effect?.origin ?? "");
  const sourceId = String(flags.sourceItemId ?? flags.sourceClassId ?? flags.classId ?? "");
  const sourceSlug = norm(flags.sourceClasse ?? flags.sourceClass ?? flags.classSlug ?? flags.classe ?? "");
  return [...keys.uuids].some(uuid => uuid && origin === uuid)
    || (sourceId && keys.ids.has(sourceId))
    || (sourceSlug && keys.slugs.has(sourceSlug));
}

/** Ne supprime que les sorts et effets explicitement liés à la classe retirée. */
async function purgeClassBoundContent(actor, classDocs, reason) {
  if (!actor || !classDocs?.length) return { spells: 0, effects: 0 };
  const keys = sourceClassKeys(classDocs);
  const spellIds = actor.items
    .filter(item => String(item?.type ?? "").toLowerCase() === "sort" && itemBelongsToRemovedClass(item, keys))
    .map(item => item.id)
    .filter(Boolean);
  const effectIds = actor.effects
    .filter(effect => effectBelongsToRemovedClass(effect, keys))
    .map(effect => effect.id)
    .filter(Boolean);

  if (effectIds.length) {
    await actor.deleteEmbeddedDocuments("ActiveEffect", effectIds, {
      [INTERNAL]: true,
      add2eInternal: true,
      add2eReason: reason
    });
  }
  if (spellIds.length) {
    await actor.deleteEmbeddedDocuments("Item", spellIds, {
      [INTERNAL]: true,
      add2eInternal: true,
      add2eReason: reason
    });
  }
  return { spells: spellIds.length, effects: effectIds.length };
}

function normalizeProgression(classDoc, state, raceData) {
  const maxLevel = classRaceMaxLevel(classDoc, raceData);
  let level = Math.max(1, Math.floor(num(state?.level, 1)));
  let xp = Math.max(0, Math.floor(num(state?.xp, 0)));
  if (maxLevel > 0 && level > maxLevel) level = maxLevel;
  xp = Math.max(xp, minXpForClassLevel(classDoc?.system ?? {}, level));
  return { level, xp, maxLevel };
}

async function writeClassProgression(actor, entries, reason) {
  const updates = [];
  for (const entry of entries ?? []) {
    const doc = entry?.doc ?? actor?.items?.get?.(entry?.itemId) ?? null;
    if (!doc) continue;
    const current = classProgression(doc);
    if (current.hasLevel && current.level === entry.level && current.hasXp && current.xp === entry.xp) continue;
    const update = classProgressionUpdate(doc, { level: entry.level, xp: entry.xp });
    if (update) updates.push(update);
  }
  if (!updates.length) return 0;
  await actor.updateEmbeddedDocuments("Item", updates, {
    [INTERNAL]: true,
    add2eInternal: true,
    add2eReason: reason
  });
  return updates.length;
}

function monoProgressionPayload(actor, classDoc, state) {
  const normalized = normalizeProgression(classDoc, state, systemRace(actor));
  const classSystem = classDoc?.system ?? {};
  const currentXp = minXpForClassLevel(classSystem, normalized.level);
  const nextXp = nextXpForClassLevel(classSystem, normalized.level);
  const title = classTitleForLevel(classSystem, normalized.level);
  const xpPercent = nextXp > currentXp
    ? Math.max(0, Math.min(100, Math.floor(((normalized.xp - currentXp) / (nextXp - currentXp)) * 100)))
    : 100;
  return {
    "system.classe": classDoc.name,
    "system.details_classe": {
      ...(foundry.utils.deepClone(classSystem) ?? {}),
      name: classDoc.name,
      label: classDoc.system?.label || classDoc.name,
      slug: classSlug(classDoc),
      sourceItemId: classDoc.id,
      sourceItemUuid: classDoc.uuid
    },
    "system.spellcasting": foundry.utils.deepClone(classSystem.spellcasting ?? null),
    "system.niveau": normalized.level,
    "system.niveau_suggere": normalized.level,
    "system.xp": normalized.xp,
    "system.titre": title,
    "system.progression_xp": nextXp ? `${normalized.xp.toLocaleString()} / ${nextXp.toLocaleString()} XP` : `${normalized.xp.toLocaleString()} XP`,
    "system.xp_next": nextXp,
    "system.xp_to_next": nextXp ? Math.max(0, nextXp - normalized.xp) : 0,
    "system.xp_percent": xpPercent
  };
}

function migrationWarningKey(actor) {
  return String(actor?.uuid ?? actor?.id ?? "");
}

async function notifyMigrationBlocked(actor, plan) {
  const key = migrationWarningKey(actor);
  if (migrationWarnings.has(key)) return;
  migrationWarnings.add(key);
  const names = (plan?.unresolved ?? []).map(entry => entry.name).filter(Boolean).join(", ") || "classe inconnue";
  warn("[MIGRATION_BLOCKED]", { actor: actor?.name, unresolved: plan?.unresolved ?? [] });
  if (game.user?.isGM) ui.notifications?.error?.(`Multiclassage non migré pour ${actor.name} : progression introuvable pour ${names}.`);
}

/**
 * Écrit les niveaux/XP historiques sur les Items. Si une classe ne peut pas
 * être associée avec certitude à une progression, aucune écriture n'est faite.
 */
export async function migrateLegacyMulticlassActor(actor) {
  if (!actor || actor.type !== "personnage" || classItems(actor).length <= 1) return null;
  if (migrationLocks.has(actor.id)) return null;
  migrationLocks.add(actor.id);
  try {
    const plan = legacyMulticlassMigrationPlan(actor);
    if (!plan.ok) {
      await notifyMigrationBlocked(actor, plan);
      return { ok: false, plan };
    }

    const docs = classItems(actor);
    const normalized = plan.entries.map(state => {
      const doc = docs.find(candidate => String(candidate.id) === String(state.itemId)) ?? null;
      const values = normalizeProgression(doc, state, systemRace(actor));
      return { ...state, doc, ...values };
    });
    await writeClassProgression(actor, normalized, "multiclass-item-progression-migration");
    const payload = multiclassUpdatePayload(actor);
    if (payload) {
      await actor.update(payload, {
        [INTERNAL]: true,
        add2eInternal: true,
        add2eReason: "multiclass-item-progression-summary"
      });
    }
    return { ok: true, plan, payload };
  } finally {
    migrationLocks.delete(actor.id);
  }
}

export async function ensureCanonicalMulticlassState(actor) {
  if (!actor || actor.type !== "personnage") return null;
  if (!multiclassEnabled(actor)) return null;
  const missing = classItems(actor).some(item => {
    const state = canonicalClassState(actor, item);
    return !state?.hasLevel || !state?.hasXp;
  });
  if (missing) {
    const result = await migrateLegacyMulticlassActor(actor);
    if (!result?.ok) return null;
  }
  return canonicalMulticlassEntries(actor);
}

export async function cleanupAfterMonoclassReplace(actor, keepClassDoc, keepState = null, sheet = null) {
  if (!actor || actor.type !== "personnage" || !keepClassDoc) return false;
  const desired = normalizeProgression(keepClassDoc, keepState ?? monoClassStateFromActor(actor, keepClassDoc), systemRace(actor));
  await writeClassProgression(actor, [{ doc: keepClassDoc, ...desired }], "multiclass-monoclass-keep-progression");

  const unwanted = classItems(actor).filter(doc => doc.id !== keepClassDoc.id);
  await purgeClassBoundContent(actor, unwanted, "multiclass-monoclass-purge");
  if (unwanted.length) {
    await actor.deleteEmbeddedDocuments("Item", itemIds(unwanted), {
      [INTERNAL]: true,
      add2eInternal: true,
      add2eReason: "multiclass-monoclass-delete-classes"
    });
  }

  const payload = {
    ...monoClassCleanupPayload(),
    ...monoProgressionPayload(actor, keepClassDoc, desired)
  };
  await actor.update(payload, {
    [INTERNAL]: true,
    add2eInternal: true,
    add2eReason: "multiclass-monoclass-finalize"
  });

  try {
    await globalThis.add2eSyncActorSpellsFromClass?.(actor, keepClassDoc, { mode: "replace", showWait: true });
  } catch (error) {
    warn("[MONO_SPELL_SYNC_ERROR]", { actor: actor.name, error });
  }
  sheet?._add2eRememberActiveTab?.();
  sheet?.render?.(false);
  return true;
}

export function applyPayloadToSheetData(data, payload) {
  if (!data?.actor?.system || !payload) return data;
  for (const [path, value] of Object.entries(payload)) {
    const deletion = path.match(/^(.*)\.-=([^.]*)$/);
    if (deletion) {
      const container = foundry.utils.getProperty(data.actor, deletion[1]);
      if (container && typeof container === "object") delete container[deletion[2]];
      continue;
    }
    foundry.utils.setProperty(data.actor, path, foundry.utils.deepClone(value));
  }
  const actor = data.actor;
  const entries = canonicalMulticlassEntries(actor).map(entry => ({
    itemId: entry.itemId,
    name: entry.name,
    slug: entry.slug,
    level: entry.level,
    xp: entry.xp,
    title: entry.title,
    nextXp: entry.nextXp,
    levelMaxRace: entry.levelMaxRace
  }));
  data.multiclass = {
    enabled: entries.length > 1,
    classes: entries,
    title: data.actor.system?.titre ?? ""
  };
  data.progressionCourante = { title: data.actor.system?.titre ?? "" };
  return data;
}

export async function applyRaceData(actor, raceData, sheet = null) {
  if (!raceData) return false;
  if (norm(itemLabel(systemRace(actor), "Race")) === norm(itemLabel(raceData, "Race"))) return true;
  if (typeof globalThis.add2eApplyRaceItemDataToActor !== "function") {
    throw new Error("Le gestionnaire de race canonique est introuvable.");
  }
  await globalThis.add2eApplyRaceItemDataToActor(actor, raceData, sheet, {
    notify: true,
    reason: "multiclass-race-choice"
  });
  return true;
}

async function refreshMulticlassSummary(actor, reason) {
  const entries = canonicalMulticlassEntries(actor).map(entry => ({ doc: entry.doc, ...entry }));
  const normalized = entries.map(entry => ({ ...entry, ...normalizeProgression(entry.doc, entry, systemRace(actor)) }));
  await writeClassProgression(actor, normalized, `${reason}:normalize-items`);
  const payload = multiclassUpdatePayload(actor);
  if (!payload) return null;
  await actor.update(payload, {
    [INTERNAL]: true,
    add2eInternal: true,
    add2eReason: reason
  });
  return payload;
}

export async function addClassAsMulticlass(actor, option, sheet = null) {
  const itemData = option?.classData;
  if (!actor || !itemData) return false;
  if (!raceCompatibleForMulticlass(actor, itemData, option.raceData)
    || !classPrerequisitesOk(actor, itemData, option.raceData, { notify: true })) return false;

  const existingDocs = classItems(actor);
  const slug = classSlug(itemData);
  if (existingDocs.some(doc => classSlug(doc) === slug)) {
    await ensureCanonicalMulticlassState(actor);
    await refreshMulticlassSummary(actor, "multiclass-resync-existing-class");
    sheet?._add2eRememberActiveTab?.();
    sheet?.render?.(false);
    ui.notifications.info(`${itemLabel(itemData, "Classe")} est déjà présente : multiclassage recalculé.`);
    return true;
  }

  await applyRaceData(actor, option.raceData, sheet);

  if (existingDocs.length === 1) {
    const initial = monoClassStateFromActor(actor, existingDocs[0]);
    const values = normalizeProgression(existingDocs[0], initial, systemRace(actor));
    await writeClassProgression(actor, [{ doc: existingDocs[0], ...values }], "multiclass-promote-monoclass-item");
  } else if (!(await ensureCanonicalMulticlassState(actor))) {
    return false;
  }

  const data = cloneItemData(itemData);
  data.type = "classe";
  data.system = data.system ?? {};
  data.system.niveau = 1;
  data.system.xp = minXpForClassLevel(data.system, 1);
  const [created] = await actor.createEmbeddedDocuments("Item", [data], {
    [INTERNAL]: true,
    add2eInternal: true,
    add2eReason: "multiclass-add-class-create"
  });
  if (!created) return false;

  await refreshMulticlassSummary(actor, "multiclass-add-class-finalize");
  try {
    await globalThis.add2eSyncActorSpellsFromClass?.(actor, created, { mode: "append", showWait: true });
  } catch (error) {
    warn("[SPELL_SYNC_APPEND_ERROR]", { actor: actor.name, className: created.name, error });
  }

  sheet?._add2eRememberActiveTab?.();
  sheet?.render?.(false);
  ui.notifications.info(`Multiclassage appliqué : ${created.name} avec ${itemLabel(option.raceData, "Race")}.`);
  return true;
}

export async function replaceClassInMulticlass(actor, option, sheet = null) {
  const itemData = option?.classData;
  if (!actor || !itemData || !option?.replacedClassId) return false;

  const remainingNames = classItems(actor)
    .filter(doc => doc.id !== option.replacedClassId && classSlug(doc) !== option.replacedClassSlug)
    .map(doc => doc.name)
    .concat(itemLabel(itemData, "Classe"));
  if (!raceAllowsClassSet(option.raceData, remainingNames)
    || !raceMatchesClassRules(option.raceData, itemData)
    || !classPrerequisitesOk(actor, itemData, option.raceData, { notify: true })) return false;

  if (!(await ensureCanonicalMulticlassState(actor))) return false;
  const replaced = classItems(actor).find(doc =>
    String(doc.id) === String(option.replacedClassId)
    || classSlug(doc) === norm(option.replacedClassSlug)
  );
  if (!replaced) {
    ui.notifications.error("Classe à remplacer introuvable dans l'acteur.");
    return false;
  }
  if (classItems(actor).some(doc => doc.id !== replaced.id && classSlug(doc) === classSlug(itemData))) {
    ui.notifications.warn(`${itemLabel(itemData, "Classe")} est déjà présente dans le multiclassage.`);
    return false;
  }

  await applyRaceData(actor, option.raceData, sheet);
  await purgeClassBoundContent(actor, [replaced], "multiclass-replace-purge-class-content");
  await actor.deleteEmbeddedDocuments("Item", [replaced.id], {
    [INTERNAL]: true,
    add2eInternal: true,
    add2eReason: "multiclass-replace-delete-class"
  });

  const data = cloneItemData(itemData);
  data.type = "classe";
  data.system = data.system ?? {};
  data.system.niveau = 1;
  data.system.xp = minXpForClassLevel(data.system, 1);
  const [created] = await actor.createEmbeddedDocuments("Item", [data], {
    [INTERNAL]: true,
    add2eInternal: true,
    add2eReason: "multiclass-replace-create-class"
  });
  if (!created) throw new Error("Création de la classe de remplacement impossible.");

  await refreshMulticlassSummary(actor, "multiclass-replace-finalize");
  try {
    await globalThis.add2eSyncActorSpellsFromClass?.(actor, created, { mode: "append", showWait: true });
  } catch (error) {
    warn("[SPELL_SYNC_REPLACE_ERROR]", { actor: actor.name, className: created.name, error });
  }

  sheet?._add2eRememberActiveTab?.();
  sheet?.render?.(false);
  ui.notifications.info(`Classe remplacée : ${replaced.name} → ${created.name}.`);
  return true;
}

export async function applyClassAsMonoclass(actor, optionOrItemData, sheet = null) {
  const itemData = optionOrItemData?.classData ?? optionOrItemData;
  const raceData = optionOrItemData?.raceData ?? systemRace(actor);
  if (!actor || !itemData || !classPrerequisitesOk(actor, itemData, raceData, { notify: true })) return false;

  await applyRaceData(actor, raceData, sheet);
  const wantedSlug = classSlug(itemData);
  const existing = classItems(actor);
  const existingTarget = existing.find(doc => classSlug(doc) === wantedSlug) ?? null;
  let keep = existingTarget;
  let state = existingTarget ? canonicalClassState(actor, existingTarget) : null;

  if (existing.length > 1 && !(await ensureCanonicalMulticlassState(actor))) return false;
  if (!keep) {
    const data = cloneItemData(itemData);
    data.type = "classe";
    data.system = data.system ?? {};
    data.system.niveau = Math.max(1, Math.floor(num(actor.system?.niveau, 1)));
    data.system.xp = Math.max(0, Math.floor(num(actor.system?.xp, 0)));
    const [created] = await actor.createEmbeddedDocuments("Item", [data], {
      [INTERNAL]: true,
      add2eInternal: true,
      add2eReason: "multiclass-monoclass-create-class"
    });
    if (!created) return false;
    keep = created;
    state = canonicalClassState(actor, keep);
  }

  if (!state?.hasLevel || !state?.hasXp) state = monoClassStateFromActor(actor, keep);
  return cleanupAfterMonoclassReplace(actor, keep, state, sheet);
}

export async function applyRaceForMulticlass(actor, raceData, sheet = null) {
  if (!actor || classItems(actor).length <= 1) return false;
  const docs = classItems(actor);
  const allowed = docs.every(doc => raceCompatibleForMulticlass(actor, doc, raceData));
  if (!allowed) {
    await dialogAlert(
      "ADD2E — Race incompatible",
      `<p>La race <b>${itemLabel(raceData, "Race")}</b> n'est pas compatible avec le multiclassage actuel.</p>`
    );
    return true;
  }
  if (!(await ensureCanonicalMulticlassState(actor))) return false;
  await applyRaceData(actor, raceData, sheet);
  await refreshMulticlassSummary(actor, "multiclass-race-refresh");
  sheet?.render?.(false);
  return true;
}

export async function recalcActor(actor) {
  if (!actor || actor.type !== "personnage" || classItems(actor).length <= 1) return null;
  if (!(await ensureCanonicalMulticlassState(actor))) return null;
  return refreshMulticlassSummary(actor, "multiclass-item-progression-recalc");
}

export { currentRaceOrCompatibleAlternatives };