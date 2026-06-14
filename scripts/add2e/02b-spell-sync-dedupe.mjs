// ============================================================
// ADD2E — Garde anti-doublons pour la synchronisation des sorts
// Version : 2026-06-14-spell-sync-dedupe-v4-compendium-truth
// ============================================================

const ADD2E_SPELL_SYNC_DEDUPE_VERSION = "2026-06-14-spell-sync-dedupe-v4-compendium-truth";
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

function add2eSpellDedupeLevel(system = {}) {
  const raw = system.niveau ?? system.niveau_sort ?? system.spellLevel ?? system.level ?? system.lvl ?? 0;
  const m = String(raw).match(/\d+/);
  return m ? Number(m[0]) || 0 : 0;
}

function add2eSpellDedupeKey(itemLike) {
  const sys = itemLike?.system ?? {};
  const name = add2eSpellDedupeNormalize(itemLike?.name ?? sys.nom ?? sys.name ?? "");
  const level = add2eSpellDedupeLevel(sys);
  if (!name) return "";
  return `${level}|${name}`;
}

function add2eSpellDedupeIsCompendiumTruth(item) {
  const f = item?.flags?.add2e ?? {};
  const source = String(item?._stats?.compendiumSource ?? item?.flags?.core?.sourceId ?? f.sourceUuid ?? f.sourceId ?? "");
  return f.autoGrantedSpellSync === true || !!f.autoGrantedByClassId || !!f.autoGrantedByClass || source.includes("add2e.sorts");
}

function add2eSpellDedupeSortWeight(item) {
  const compendiumTruth = add2eSpellDedupeIsCompendiumTruth(item);
  const prepared = Number(item?.flags?.add2e?.memorizedCount ?? item?.system?.prepared ?? item?.system?.prepare ?? item?.system?.memorise ?? item?.system?.memorized ?? 0) || 0;
  const hasImg = item?.img && !String(item.img).includes("icons/svg/item-bag.svg") && !String(item.img).includes("mystery-man");
  const created = Number(item?._stats?.createdTime ?? 0) || 0;
  return [compendiumTruth ? 0 : 1, prepared > 0 ? 0 : 1, hasImg ? 0 : 1, created || Number.MAX_SAFE_INTEGER];
}

function add2eSpellDedupeCompareKeep(a, b) {
  const aw = add2eSpellDedupeSortWeight(a);
  const bw = add2eSpellDedupeSortWeight(b);
  for (let i = 0; i < Math.max(aw.length, bw.length); i++) {
    const d = (aw[i] ?? 0) - (bw[i] ?? 0);
    if (d !== 0) return d;
  }
  return String(a?.id ?? "").localeCompare(String(b?.id ?? ""));
}

function add2eSpellDedupeRunKey(actor) {
  return String(actor?.uuid || actor?.id || actor?.name || "unknown-actor");
}

async function add2eSafeDeleteDuplicateActorSpellIds(actor, ids, reason = "manual") {
  const rawIds = Array.isArray(ids) ? ids : [];
  const uniqueIds = [...new Set(rawIds.map(id => String(id ?? "").trim()).filter(Boolean))];
  if (!uniqueIds.length) return { deleted: 0, skippedMissing: 0, requested: 0 };
  const existingIds = uniqueIds.filter(id => actor.items?.get?.(id));
  const missingIds = uniqueIds.filter(id => !actor.items?.get?.(id));
  if (!existingIds.length) return { deleted: 0, skippedMissing: missingIds.length, requested: uniqueIds.length };
  try {
    await actor.deleteEmbeddedDocuments("Item", existingIds, { add2eInternal: true, add2eDedupe: true, reason });
    return { deleted: existingIds.length, skippedMissing: missingIds.length, requested: uniqueIds.length };
  } catch (err) {
    let deleted = 0;
    let skippedMissing = missingIds.length;
    for (const id of existingIds) {
      const item = actor.items?.get?.(id);
      if (!item) { skippedMissing += 1; continue; }
      try { await item.delete({ add2eInternal: true, add2eDedupe: true, reason }); deleted += 1; }
      catch (oneErr) { if (String(oneErr?.message ?? oneErr ?? "").includes("does not exist")) skippedMissing += 1; }
    }
    return { deleted, skippedMissing, requested: uniqueIds.length, error: String(err?.message ?? err ?? "") };
  }
}

async function add2eRemoveDuplicateActorSpells(actor, reason = "manual") {
  if (!actor || actor.type !== "personnage") return { deleted: 0 };
  const runKey = add2eSpellDedupeRunKey(actor);
  if (ADD2E_SPELL_SYNC_DEDUPE_RUNNING.has(runKey)) return { deleted: 0, skippedRunning: true };
  ADD2E_SPELL_SYNC_DEDUPE_RUNNING.add(runKey);
  try {
    const byKey = new Map();
    for (const item of actor.items?.filter?.(i => String(i.type || "").toLowerCase() === "sort") ?? []) {
      const key = add2eSpellDedupeKey(item);
      if (!key || key === "0|") continue;
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(item);
    }
    const toDelete = [];
    for (const spells of byKey.values()) {
      if (spells.length < 2) continue;
      const sorted = [...spells].sort(add2eSpellDedupeCompareKeep);
      toDelete.push(...sorted.slice(1).map(s => s.id));
    }
    if (!toDelete.length) return { deleted: 0 };
    return await add2eSafeDeleteDuplicateActorSpellIds(actor, toDelete, reason);
  } finally {
    ADD2E_SPELL_SYNC_DEDUPE_RUNNING.delete(runKey);
  }
}

async function add2eRemoveDuplicateSpellsEverywhere(reason = "manual-all-actors") {
  if (!game.user?.isGM) {
    ui.notifications?.warn?.("Seul le MJ peut nettoyer les sorts en doublon de tous les acteurs.");
    return { actors: 0, deleted: 0 };
  }
  let actors = 0;
  let deleted = 0;
  const results = [];
  for (const actor of game.actors?.filter?.(a => a.type === "personnage") ?? []) {
    actors += 1;
    const result = await add2eRemoveDuplicateActorSpells(actor, reason);
    deleted += Number(result?.deleted ?? 0) || 0;
    results.push({ actor: actor.name, ...result });
  }
  ui.notifications?.info?.(`ADD2E : nettoyage terminé (${deleted} sort(s) doublon(s) supprimé(s)).`);
  return { actors, deleted, results };
}

function add2eInstallSpellSyncDedupeWrapper() {
  const original = globalThis.add2eSyncActorSpellsFromClass;
  if (typeof original !== "function") return false;
  if (original._add2eDedupeWrapped === true) return true;
  const wrapped = async function add2eSyncActorSpellsFromClassDedupe(actor, classItem, options = {}) {
    const result = await original(actor, classItem, options);
    try {
      const cleanup = await add2eRemoveDuplicateActorSpells(actor, `sync-${options?.mode || "replace"}`);
      if (cleanup.deleted > 0) result.deleted = (Number(result.deleted) || 0) + cleanup.deleted;
    } catch (_err) {}
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
});

Hooks.on("createItem", async (item, _options, userId) => {
  if (userId !== game.user.id) return;
  const actor = item?.parent;
  if (!actor || actor.documentName !== "Actor" || actor.type !== "personnage") return;
  if (String(item.type || "").toLowerCase() !== "sort") return;
  setTimeout(() => add2eRemoveDuplicateActorSpells(actor, "createItem-sort"), 80);
});

globalThis.add2eRemoveDuplicateActorSpells = add2eRemoveDuplicateActorSpells;
globalThis.add2eSafeDeleteDuplicateActorSpellIds = add2eSafeDeleteDuplicateActorSpellIds;
globalThis.add2eRemoveDuplicateSpellsEverywhere = add2eRemoveDuplicateSpellsEverywhere;
