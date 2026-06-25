// ============================================================
// ADD2E — Garde anti-doublons pour la synchronisation des sorts
// Compatible Foundry V13 / V14 / V15
// ============================================================

const ADD2E_SPELL_SYNC_DEDUPE_VERSION = "2026-06-25-spell-sync-dedupe-v6-canonical-materials";
globalThis.ADD2E_SPELL_SYNC_DEDUPE_VERSION = ADD2E_SPELL_SYNC_DEDUPE_VERSION;

const ADD2E_SPELL_SYNC_DEDUPE_RUNNING = globalThis.ADD2E_SPELL_SYNC_DEDUPE_RUNNING instanceof Set
  ? globalThis.ADD2E_SPELL_SYNC_DEDUPE_RUNNING
  : new Set();
globalThis.ADD2E_SPELL_SYNC_DEDUPE_RUNNING = ADD2E_SPELL_SYNC_DEDUPE_RUNNING;

function add2eSpellDedupeNormalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/\s*\([^)]*\)\s*$/g, "")
    .replace(/[\s\-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function add2eSpellDedupeClone(value) {
  if (value === undefined || value === null) return value;
  try { return foundry.utils.deepClone(value); } catch (_error) {}
  try { return foundry.utils.duplicate(value); } catch (_error) {}
  return JSON.parse(JSON.stringify(value));
}

function add2eSpellDedupeLevel(system = {}) {
  const match = String(system.niveau ?? system.niveau_sort ?? system.spellLevel ?? system.level ?? system.lvl ?? 0).match(/\d+/);
  return match ? Number(match[0]) || 0 : 0;
}

function add2eSpellDedupeKey(itemLike) {
  const system = itemLike?.system ?? {};
  const name = add2eSpellDedupeNormalize(itemLike?.name ?? system.nom ?? system.name ?? "");
  if (!name) return "";
  return `${add2eSpellDedupeLevel(system)}|${name}`;
}

function add2eSpellDedupeIsCompendiumTruth(item) {
  const flags = item?.flags?.add2e ?? {};
  const source = String(item?._stats?.compendiumSource ?? item?.flags?.core?.sourceId ?? flags.sourceUuid ?? flags.sourceId ?? "");
  return flags.autoGrantedSpellSync === true || !!flags.autoGrantedByClassId || !!flags.autoGrantedByClass || source.includes("add2e.sorts");
}

function add2eSpellDedupeSortWeight(item) {
  const prepared = Number(item?.flags?.add2e?.memorizedCount ?? item?.system?.prepared ?? item?.system?.prepare ?? item?.system?.memorise ?? item?.system?.memorized ?? 0) || 0;
  const hasImage = item?.img && !String(item.img).includes("icons/svg/item-bag.svg") && !String(item.img).includes("mystery-man");
  const created = Number(item?._stats?.createdTime ?? 0) || Number.MAX_SAFE_INTEGER;
  return [add2eSpellDedupeIsCompendiumTruth(item) ? 0 : 1, prepared > 0 ? 0 : 1, hasImage ? 0 : 1, created];
}

function add2eSpellDedupeCompareKeep(left, right) {
  const leftWeight = add2eSpellDedupeSortWeight(left);
  const rightWeight = add2eSpellDedupeSortWeight(right);
  for (let index = 0; index < leftWeight.length; index += 1) {
    const difference = leftWeight[index] - rightWeight[index];
    if (difference) return difference;
  }
  return String(left?.id ?? "").localeCompare(String(right?.id ?? ""));
}

function add2eSpellDedupeRunKey(actor) {
  return String(actor?.uuid ?? actor?.id ?? actor?.name ?? "unknown-actor");
}

async function add2eRemoveLegacyActorSpellMaterialFields(actor, reason = "legacy-material-cleanup") {
  if (!game.user?.isGM || !actor || actor.type !== "personnage") return { updated: 0 };
  const updates = [];
  for (const item of actor.items?.filter?.(candidate => String(candidate.type ?? "").toLowerCase() === "sort") ?? []) {
    if (!Object.prototype.hasOwnProperty.call(item.system ?? {}, "composants_materiels_objets")) continue;
    updates.push({ _id: item.id, "system.-=composants_materiels_objets": null });
  }
  if (!updates.length) return { updated: 0 };
  await actor.updateEmbeddedDocuments("Item", updates, { add2eInternal: true, add2eSpellSync: true, reason, render: false });
  globalThis.add2eRerenderActorSheet?.(actor, false);
  return { updated: updates.length };
}

// Compatibilité d'appel : cette fonction ne normalise plus les composants et
// n'interprète jamais le champ historique. Elle le supprime seulement.
async function add2eNormalizeActorSpellMaterials(actor, reason = "sync-material-cleanup") {
  return add2eRemoveLegacyActorSpellMaterialFields(actor, reason);
}

function add2eSpellDedupeCleanSpellMaterialComponents(system = {}) {
  return add2eSpellDedupeClone(system.composants_materiels ?? []);
}

async function add2eSafeDeleteDuplicateActorSpellIds(actor, ids, reason = "manual") {
  const requested = [...new Set((Array.isArray(ids) ? ids : []).map(id => String(id ?? "").trim()).filter(Boolean))];
  if (!requested.length) return { deleted: 0, skippedMissing: 0, requested: 0 };
  const existing = requested.filter(id => actor.items?.get?.(id));
  const missing = requested.length - existing.length;
  if (!existing.length) return { deleted: 0, skippedMissing: missing, requested: requested.length };
  try {
    await actor.deleteEmbeddedDocuments("Item", existing, { add2eInternal: true, add2eDedupe: true, reason });
    return { deleted: existing.length, skippedMissing: missing, requested: requested.length };
  } catch (error) {
    let deleted = 0;
    let skippedMissing = missing;
    for (const id of existing) {
      const item = actor.items?.get?.(id);
      if (!item) { skippedMissing += 1; continue; }
      try { await item.delete({ add2eInternal: true, add2eDedupe: true, reason }); deleted += 1; }
      catch (oneError) { if (/does not exist/i.test(String(oneError?.message ?? oneError))) skippedMissing += 1; }
    }
    return { deleted, skippedMissing, requested: requested.length, error: String(error?.message ?? error ?? "") };
  }
}

async function add2eRemoveDuplicateActorSpells(actor, reason = "manual") {
  if (!actor || actor.type !== "personnage") return { deleted: 0 };
  const runKey = add2eSpellDedupeRunKey(actor);
  if (ADD2E_SPELL_SYNC_DEDUPE_RUNNING.has(runKey)) return { deleted: 0, skippedRunning: true };
  ADD2E_SPELL_SYNC_DEDUPE_RUNNING.add(runKey);
  try {
    const byKey = new Map();
    for (const item of actor.items?.filter?.(candidate => String(candidate.type ?? "").toLowerCase() === "sort") ?? []) {
      const key = add2eSpellDedupeKey(item);
      if (!key || key === "0|") continue;
      const rows = byKey.get(key) ?? [];
      rows.push(item);
      byKey.set(key, rows);
    }
    const toDelete = [];
    for (const spells of byKey.values()) {
      if (spells.length < 2) continue;
      toDelete.push(...[...spells].sort(add2eSpellDedupeCompareKeep).slice(1).map(item => item.id));
    }
    return toDelete.length ? add2eSafeDeleteDuplicateActorSpellIds(actor, toDelete, reason) : { deleted: 0 };
  } finally {
    ADD2E_SPELL_SYNC_DEDUPE_RUNNING.delete(runKey);
  }
}

async function add2eRemoveDuplicateSpellsEverywhere(reason = "manual-all-actors") {
  if (!game.user?.isGM) {
    ui.notifications?.warn?.("Seul le MJ peut nettoyer les sorts en doublon de tous les acteurs.");
    return { actors: 0, deleted: 0 };
  }
  const results = [];
  let deleted = 0;
  for (const actor of game.actors?.filter?.(candidate => candidate.type === "personnage") ?? []) {
    const result = await add2eRemoveDuplicateActorSpells(actor, reason);
    deleted += Number(result?.deleted ?? 0) || 0;
    results.push({ actor: actor.name, ...result });
  }
  ui.notifications?.info?.(`ADD2E : nettoyage terminé (${deleted} sort(s) doublon(s) supprimé(s)).`);
  return { actors: results.length, deleted, results };
}

async function add2eCleanLegacySpellMaterialsEverywhere(reason = "ready-legacy-material-cleanup") {
  if (!game.user?.isGM) return { actors: 0, updated: 0 };
  let updated = 0;
  let actors = 0;
  for (const actor of game.actors?.filter?.(candidate => candidate.type === "personnage") ?? []) {
    actors += 1;
    const result = await add2eRemoveLegacyActorSpellMaterialFields(actor, reason);
    updated += Number(result?.updated ?? 0) || 0;
  }
  return { actors, updated };
}

function add2eInstallSpellSyncDedupeWrapper() {
  const original = globalThis.add2eSyncActorSpellsFromClass;
  if (typeof original !== "function") return false;
  if (original._add2eDedupeWrapped === true) return true;
  const wrapped = async function add2eSyncActorSpellsFromClassDedupe(actor, classItem, options = {}) {
    const syncOptions = { ...options, forceCacheRefresh: options.forceCacheRefresh ?? options.mode === "replace" };
    const result = await original(actor, classItem, syncOptions);
    try {
      const cleanup = await add2eRemoveDuplicateActorSpells(actor, `sync-${options?.mode || "replace"}`);
      if (cleanup.deleted > 0) result.deleted = (Number(result.deleted) || 0) + cleanup.deleted;
    } catch (_error) {}
    try {
      const cleanup = await add2eRemoveLegacyActorSpellMaterialFields(actor, `sync-${options?.mode || "replace"}`);
      if (cleanup.updated > 0) result.legacyMaterialFieldsRemoved = cleanup.updated;
    } catch (error) {
      console.warn("[ADD2E][SPELL_SYNC][LEGACY_MATERIAL_CLEANUP_ERROR]", error);
    }
    return result;
  };
  wrapped._add2eDedupeWrapped = true;
  globalThis.add2eSyncActorSpellsFromClass = wrapped;
  return true;
}

Hooks.once("ready", () => {
  if (!add2eInstallSpellSyncDedupeWrapper()) {
    setTimeout(add2eInstallSpellSyncDedupeWrapper, 250);
    setTimeout(add2eInstallSpellSyncDedupeWrapper, 1000);
  }
  if (game.user?.isGM) setTimeout(() => add2eCleanLegacySpellMaterialsEverywhere()
    .catch(error => console.error("[ADD2E][SPELL_SYNC][LEGACY_MATERIAL_READY_CLEANUP_ERROR]", error)), 500);
});

Hooks.on("createItem", (item, _options, userId) => {
  if (String(userId ?? "") !== String(game.user?.id ?? "")) return;
  const actor = item?.parent;
  if (!actor || actor.documentName !== "Actor" || actor.type !== "personnage" || String(item?.type ?? "").toLowerCase() !== "sort") return;
  setTimeout(() => add2eRemoveDuplicateActorSpells(actor, "createItem-sort"), 80);
  setTimeout(() => add2eRemoveLegacyActorSpellMaterialFields(actor, "createItem-sort"), 120);
});

globalThis.add2eRemoveDuplicateActorSpells = add2eRemoveDuplicateActorSpells;
globalThis.add2eSafeDeleteDuplicateActorSpellIds = add2eSafeDeleteDuplicateActorSpellIds;
globalThis.add2eRemoveDuplicateSpellsEverywhere = add2eRemoveDuplicateSpellsEverywhere;
globalThis.add2eNormalizeActorSpellMaterials = add2eNormalizeActorSpellMaterials;
globalThis.add2eSpellDedupeCleanSpellMaterialComponents = add2eSpellDedupeCleanSpellMaterialComponents;
globalThis.add2eRemoveLegacyActorSpellMaterialFields = add2eRemoveLegacyActorSpellMaterialFields;
