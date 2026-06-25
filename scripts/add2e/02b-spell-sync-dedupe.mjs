// ADD2E — Déduplication des sorts et migration des composants historiques.
// Compatible Foundry V13 / V14 / V15.

const ADD2E_SPELL_SYNC_DEDUPE_VERSION = "2026-06-25-spell-sync-dedupe-v7";
const RUNNING = globalThis.ADD2E_SPELL_SYNC_DEDUPE_RUNNING instanceof Set ? globalThis.ADD2E_SPELL_SYNC_DEDUPE_RUNNING : new Set();
globalThis.ADD2E_SPELL_SYNC_DEDUPE_VERSION = ADD2E_SPELL_SYNC_DEDUPE_VERSION;
globalThis.ADD2E_SPELL_SYNC_DEDUPE_RUNNING = RUNNING;

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object ?? {}, key);
const clone = value => {
  if (value == null) return value;
  try { return foundry.utils.deepClone(value); } catch (_error) {}
  try { return foundry.utils.duplicate(value); } catch (_error) {}
  return JSON.parse(JSON.stringify(value));
};
const slug = value => String(value ?? "").trim().toLowerCase().normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, "")
  .replace(/\s*\([^)]*\)\s*$/g, "").replace(/[\s\-]+/g, "_")
  .replace(/_+/g, "_").replace(/^_+|_+$/g, "");
const levelOf = system => Number(String(system?.niveau ?? system?.niveau_sort ?? system?.spellLevel ?? system?.level ?? 0).match(/\d+/)?.[0] ?? 0) || 0;
const keyOf = item => {
  const name = slug(item?.name ?? item?.system?.nom);
  return name ? `${levelOf(item?.system)}|${name}` : "";
};

function keepWeight(item) {
  const flags = item?.flags?.add2e ?? {};
  const source = String(item?._stats?.compendiumSource ?? item?.flags?.core?.sourceId ?? flags.sourceUuid ?? flags.sourceId ?? "");
  const truth = flags.autoGrantedSpellSync === true || !!flags.autoGrantedByClassId || !!flags.autoGrantedByClass || source.includes("add2e.sorts");
  const memorized = Number(flags.memorizedCount ?? item?.system?.prepared ?? item?.system?.memorise ?? 0) || 0;
  const image = item?.img && !String(item.img).includes("icons/svg/item-bag.svg") && !String(item.img).includes("mystery-man");
  return [truth ? 0 : 1, memorized > 0 ? 0 : 1, image ? 0 : 1, Number(item?._stats?.createdTime ?? Number.MAX_SAFE_INTEGER)];
}

function compareKeep(left, right) {
  const a = keepWeight(left);
  const b = keepWeight(right);
  for (let index = 0; index < a.length; index += 1) if (a[index] !== b[index]) return a[index] - b[index];
  return String(left?.id ?? "").localeCompare(String(right?.id ?? ""));
}

async function migrateLegacyMaterials(actor, reason = "legacy-material-migration") {
  if (!game.user?.isGM || !actor || actor.type !== "personnage") return { migrated: 0, removed: 0 };
  const updates = [];
  let migrated = 0;
  for (const item of actor.items?.filter?.(entry => String(entry.type ?? "").toLowerCase() === "sort") ?? []) {
    const system = item.system ?? {};
    if (!hasOwn(system, "composants_materiels_objets")) continue;
    const update = { _id: item.id, "system.-=composants_materiels_objets": null };
    if (!hasOwn(system, "composants_materiels")) {
      update["system.composants_materiels"] = clone(system.composants_materiels_objets);
      migrated += 1;
    }
    updates.push(update);
  }
  if (!updates.length) return { migrated: 0, removed: 0 };
  await actor.updateEmbeddedDocuments("Item", updates, { add2eInternal: true, add2eSpellSync: true, reason, render: false });
  globalThis.add2eRerenderActorSheet?.(actor, false);
  return { migrated, removed: updates.length };
}

async function removeDuplicates(actor, reason = "manual") {
  if (!actor || actor.type !== "personnage") return { deleted: 0 };
  const runKey = String(actor.uuid ?? actor.id ?? actor.name ?? "unknown-actor");
  if (RUNNING.has(runKey)) return { deleted: 0, skippedRunning: true };
  RUNNING.add(runKey);
  try {
    const groups = new Map();
    for (const item of actor.items?.filter?.(entry => String(entry.type ?? "").toLowerCase() === "sort") ?? []) {
      const key = keyOf(item);
      if (!key) continue;
      const group = groups.get(key) ?? [];
      group.push(item);
      groups.set(key, group);
    }
    const ids = [...groups.values()].flatMap(group => group.length > 1 ? group.sort(compareKeep).slice(1).map(item => item.id) : []);
    if (!ids.length) return { deleted: 0 };
    const existing = ids.filter(id => actor.items?.has(id));
    if (!existing.length) return { deleted: 0 };
    await actor.deleteEmbeddedDocuments("Item", existing, { add2eInternal: true, add2eDedupe: true, reason });
    return { deleted: existing.length };
  } finally {
    RUNNING.delete(runKey);
  }
}

async function removeDuplicatesEverywhere(reason = "manual-all-actors") {
  if (!game.user?.isGM) return { actors: 0, deleted: 0 };
  let deleted = 0;
  const results = [];
  for (const actor of game.actors?.filter?.(entry => entry.type === "personnage") ?? []) {
    const result = await removeDuplicates(actor, reason);
    deleted += Number(result?.deleted ?? 0) || 0;
    results.push({ actor: actor.name, ...result });
  }
  return { actors: results.length, deleted, results };
}

function installWrapper() {
  const original = globalThis.add2eSyncActorSpellsFromClass;
  if (typeof original !== "function" || original._add2eDedupeWrapped) return typeof original === "function";
  const wrapped = async function add2eSyncActorSpellsFromClassDedupe(actor, classItem, options = {}) {
    const result = await original(actor, classItem, { ...options, forceCacheRefresh: options.forceCacheRefresh ?? options.mode === "replace" });
    const dedupe = await removeDuplicates(actor, `sync-${options?.mode ?? "replace"}`);
    const migration = await migrateLegacyMaterials(actor, `sync-${options?.mode ?? "replace"}`);
    if (dedupe.deleted) result.deleted = (Number(result.deleted) || 0) + dedupe.deleted;
    if (migration.migrated) result.legacyMaterialsMigrated = migration.migrated;
    return result;
  };
  wrapped._add2eDedupeWrapped = true;
  globalThis.add2eSyncActorSpellsFromClass = wrapped;
  return true;
}

Hooks.once("ready", () => {
  if (!installWrapper()) {
    setTimeout(installWrapper, 250);
    setTimeout(installWrapper, 1000);
  }
  // 02c a déjà programmé son expansion à 250 ms. Cette migration explicite
  // s'exécute avant elle, afin que les anciennes copies soient récupérées.
  if (game.user?.isGM) setTimeout(async () => {
    for (const actor of game.actors?.filter?.(entry => entry.type === "personnage") ?? []) await migrateLegacyMaterials(actor, "ready-legacy-material-migration");
  }, 0);
});

Hooks.on("createItem", (item, _options, userId) => {
  if (String(userId ?? "") !== String(game.user?.id ?? "")) return;
  const actor = item?.parent;
  if (!actor || actor.type !== "personnage" || String(item?.type ?? "").toLowerCase() !== "sort") return;
  setTimeout(() => removeDuplicates(actor, "createItem-sort"), 80);
  setTimeout(() => migrateLegacyMaterials(actor, "createItem-sort"), 120);
});

globalThis.add2eRemoveDuplicateActorSpells = removeDuplicates;
globalThis.add2eRemoveDuplicateSpellsEverywhere = removeDuplicatesEverywhere;
globalThis.add2eNormalizeActorSpellMaterials = migrateLegacyMaterials;
globalThis.add2eSpellDedupeCleanSpellMaterialComponents = system => clone(system?.composants_materiels ?? []);
globalThis.add2eMigrateActorLegacySpellMaterialFields = migrateLegacyMaterials;
