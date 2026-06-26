// ADD2E — Déduplication des sorts et suppression du champ matériel historique.
// Compatible Foundry V13 / V14 / V15.

const ADD2E_SPELL_SYNC_DEDUPE_VERSION = "2026-06-26-spell-sync-dedupe-v10-list-aware";
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

function asSpellListArray(value) {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(asSpellListArray);
  if (typeof value === "string") return value.split(/[,;|\n]+/).map(entry => entry.trim()).filter(Boolean);
  if (typeof value === "object") {
    for (const key of ["spellLists", "lists", "classes", "classe", "class", "liste", "value", "values", "items"]) {
      if (value[key] !== undefined) return asSpellListArray(value[key]);
    }
  }
  return [value];
}

function normalizeSpellList(value) {
  const aliases = {
    cleric: "clerc", priest: "clerc", pretre: "clerc", paladin: "clerc",
    druid: "druide",
    wizard: "magicien", mage: "magicien", magician: "magicien", magic_user: "magicien",
    illusionist: "illusionniste"
  };
  const normalized = typeof globalThis.add2eNormalizeSpellKey === "function"
    ? globalThis.add2eNormalizeSpellKey(value)
    : slug(value);
  return aliases[normalized] ?? normalized;
}

function listKeyOf(item) {
  const system = item?.system ?? {};
  const resolved = item?.flags?.add2e?.spellListsResolved;
  const lists = [
    system.spellLists, system.lists, system.classes, system.classe, system.class, system.liste,
    resolved
  ].flatMap(asSpellListArray).map(normalizeSpellList).filter(Boolean);
  return [...new Set(lists)].sort().join("+") || "liste_inconnue";
}

function keyOf(item) {
  const name = slug(item?.name ?? item?.system?.nom);
  return name ? `${listKeyOf(item)}|${levelOf(item?.system)}|${name}` : "";
}

function forcedDeletion() {
  const deletion = foundry?.data?.operators?.ForcedDeletion;
  if (!deletion) throw new Error("[ADD2E] FoundryData ForcedDeletion est indisponible.");
  return deletion;
}

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

async function removeLegacyMaterialFields(actor, reason = "legacy-material-cleanup") {
  if (!game.user?.isGM || !actor || actor.type !== "personnage") return { removed: 0 };
  const updates = [];
  for (const item of actor.items?.filter?.(entry => String(entry.type ?? "").toLowerCase() === "sort") ?? []) {
    if (!hasOwn(item.system, "composants_materiels_objets")) continue;
    updates.push({ _id: item.id, system: { composants_materiels_objets: forcedDeletion() } });
  }
  if (!updates.length) return { removed: 0 };
  await actor.updateEmbeddedDocuments("Item", updates, { add2eInternal: true, add2eSpellSync: true, reason, render: false });
  globalThis.add2eRerenderActorSheet?.(actor, false);
  return { removed: updates.length };
}

async function safeDeleteIds(actor, ids, reason = "manual") {
  const requested = [...new Set((Array.isArray(ids) ? ids : []).map(id => String(id ?? "").trim()).filter(Boolean))];
  const existing = requested.filter(id => actor.items?.has(id));
  if (!existing.length) return { deleted: 0, skippedMissing: requested.length, requested: requested.length };
  try {
    await actor.deleteEmbeddedDocuments("Item", existing, { add2eInternal: true, add2eDedupe: true, reason });
    return { deleted: existing.length, skippedMissing: requested.length - existing.length, requested: requested.length };
  } catch (error) {
    let deleted = 0;
    let skippedMissing = requested.length - existing.length;
    for (const id of existing) {
      const item = actor.items?.get?.(id);
      if (!item) { skippedMissing += 1; continue; }
      try { await item.delete({ add2eInternal: true, add2eDedupe: true, reason }); deleted += 1; }
      catch (oneError) {
        if (/does not exist|undefined id/i.test(String(oneError?.message ?? oneError))) skippedMissing += 1;
        else throw oneError;
      }
    }
    return { deleted, skippedMissing, requested: requested.length, error: String(error?.message ?? error ?? "") };
  }
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
    return ids.length ? safeDeleteIds(actor, ids, reason) : { deleted: 0 };
  } finally {
    RUNNING.delete(runKey);
  }
}

async function removeDuplicatesEverywhere(reason = "manual-all-actors") {
  if (!game.user?.isGM) {
    ui.notifications?.warn?.("Seul le MJ peut nettoyer les sorts en doublon de tous les acteurs.");
    return { actors: 0, deleted: 0 };
  }
  let deleted = 0;
  const results = [];
  for (const actor of game.actors?.filter?.(entry => entry.type === "personnage") ?? []) {
    const result = await removeDuplicates(actor, reason);
    deleted += Number(result?.deleted ?? 0) || 0;
    results.push({ actor: actor.name, ...result });
  }
  ui.notifications?.info?.(`ADD2E : nettoyage terminé (${deleted} sort(s) doublon(s) supprimé(s)).`);
  return { actors: results.length, deleted, results };
}

function installWrapper() {
  const original = globalThis.add2eSyncActorSpellsFromClass;
  if (typeof original !== "function" || original._add2eDedupeWrapped) return typeof original === "function";
  const wrapped = async function add2eSyncActorSpellsFromClassDedupe(actor, classItem, options = {}) {
    const result = await original(actor, classItem, { ...options, forceCacheRefresh: options.forceCacheRefresh ?? options.mode === "replace" });
    const dedupe = await removeDuplicates(actor, `sync-${options?.mode ?? "replace"}`);
    const cleanup = await removeLegacyMaterialFields(actor, `sync-${options?.mode ?? "replace"}`);
    if (dedupe.deleted) result.deleted = (Number(result.deleted) || 0) + dedupe.deleted;
    if (cleanup.removed) result.legacyMaterialFieldsRemoved = cleanup.removed;
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
  if (game.user?.isGM) setTimeout(async () => {
    for (const actor of game.actors?.filter?.(entry => entry.type === "personnage") ?? []) await removeLegacyMaterialFields(actor, "ready-legacy-material-cleanup");
  }, 0);
});

Hooks.on("createItem", (item, _options, userId) => {
  if (String(userId ?? "") !== String(game.user?.id ?? "")) return;
  const actor = item?.parent;
  if (!actor || actor.type !== "personnage" || String(item?.type ?? "").toLowerCase() !== "sort") return;
  setTimeout(() => removeLegacyMaterialFields(actor, "createItem-sort"), 0);
  // 02c étend une famille après 50 ms ; la déduplication par liste intervient ensuite.
  setTimeout(() => removeDuplicates(actor, "createItem-sort"), 80);
});

globalThis.add2eRemoveDuplicateActorSpells = removeDuplicates;
globalThis.add2eSafeDeleteDuplicateActorSpellIds = safeDeleteIds;
globalThis.add2eRemoveDuplicateSpellsEverywhere = removeDuplicatesEverywhere;
globalThis.add2eNormalizeActorSpellMaterials = removeLegacyMaterialFields;
globalThis.add2eSpellDedupeCleanSpellMaterialComponents = system => clone(system?.composants_materiels ?? []);
globalThis.add2eMigrateActorLegacySpellMaterialFields = removeLegacyMaterialFields;