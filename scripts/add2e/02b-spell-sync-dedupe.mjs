// ADD2E — Déduplication et orchestration des synchronisations de sorts.
// Compatible Foundry V13 / V14 / V15. DialogV2 uniquement.

const ADD2E_SPELL_SYNC_DEDUPE_VERSION = "2026-07-02-spell-sync-progress-v14";
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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function values(value) {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(values);
  if (typeof value === "string") return value.split(/[,;|\n]+/).map(entry => entry.trim()).filter(Boolean);
  if (typeof value === "object") {
    for (const key of ["spellLists", "lists", "classes", "classe", "class", "liste", "value", "values", "items"]) {
      if (value[key] !== undefined) return values(value[key]);
    }
  }
  return [value];
}

function normalizeSpellList(value) {
  return typeof globalThis.add2eNormalizeSpellKey === "function"
    ? globalThis.add2eNormalizeSpellKey(value)
    : slug(value);
}

function unionSpellLists(...sources) {
  return [...new Set(sources.flatMap(values).map(normalizeSpellList).filter(Boolean))];
}

function listKeyOf(item) {
  const aliases = { cleric: "clerc", priest: "clerc", pretre: "clerc", paladin: "clerc", druid: "druide", wizard: "magicien", mage: "magicien", magician: "magicien", magic_user: "magicien", illusionist: "illusionniste" };
  const normalize = value => aliases[normalizeSpellList(value)] ?? normalizeSpellList(value);
  const system = item?.system ?? {};
  const lists = [system.spellLists, system.lists, system.classes, system.classe, system.class, system.liste, item?.flags?.add2e?.spellListsResolved]
    .flatMap(values).map(normalize).filter(Boolean);
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

function queue(actor, work) {
  const enqueue = globalThis.add2eQueueActorSpellFamilyWork;
  return typeof enqueue === "function" ? enqueue(actor, work) : work();
}

function liveUpdates(actor, updates) {
  return updates.filter(update => String(update?._id ?? "") && actor?.items?.has?.(update._id));
}

function spellSyncDialogV2() {
  return foundry?.applications?.api?.DialogV2 ?? null;
}

function spellSyncActorLevel(actor, classItem, options = {}) {
  const supplied = Number(options?.actorLevel);
  if (Number.isFinite(supplied) && supplied >= 1) return Math.floor(supplied);
  const resolved = Number(globalThis.add2eSpellClassLevel?.(actor, classItem));
  if (Number.isFinite(resolved) && resolved >= 1) return Math.floor(resolved);
  return Math.max(1, levelOf(classItem?.system) || 1);
}

function spellSyncMaxLevel(actor, classItem, options = {}) {
  const level = spellSyncActorLevel(actor, classItem, options);
  const max = Number(globalThis.add2eSpellSyncMaxSpellLevel?.(classItem, level));
  return Number.isFinite(max) && max > 0 ? Math.floor(max) : 0;
}

function openSpellSyncProgress(actor, classItem, options = {}) {
  if (options?.showWait === false || spellSyncMaxLevel(actor, classItem, options) < 1) return null;
  const DialogV2 = spellSyncDialogV2();
  if (!DialogV2) return null;

  const id = `add2e-spell-sync-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const className = escapeHtml(classItem?.name ?? "Classe");
  const actorName = escapeHtml(actor?.name ?? "Personnage");
  const dialog = new DialogV2({
    window: { title: "Synchronisation des sorts", resizable: false },
    content: `
      <section data-add2e-spell-sync="${id}" style="min-width:360px;padding:10px 12px;border:1px solid #6d4a1f;border-radius:8px;background:linear-gradient(180deg,#fff8e6,#ead4a2);color:#2d2011;">
        <div style="display:flex;align-items:center;gap:9px;margin-bottom:7px;">
          <i class="fas fa-book-sparkles" aria-hidden="true" style="font-size:1.45rem;color:#805514;"></i>
          <div><strong>Synchronisation des sorts</strong><br><small>${actorName} — ${className}</small></div>
        </div>
        <div data-add2e-spell-sync-stage style="font-weight:700;">Lecture du compendium…</div>
        <div style="height:6px;margin-top:10px;overflow:hidden;border-radius:999px;background:#c9ae72;"><div data-add2e-spell-sync-bar style="width:22%;height:100%;background:#805514;transition:width .2s ease;"></div></div>
      </section>`,
    buttons: [],
    close: () => undefined
  }, { width: 430, height: "auto" });
  dialog.render({ force: true });

  const setStage = (label, progress) => {
    const root = document.querySelector(`[data-add2e-spell-sync="${id}"]`);
    const stage = root?.querySelector?.("[data-add2e-spell-sync-stage]");
    const bar = root?.querySelector?.("[data-add2e-spell-sync-bar]");
    if (stage) stage.textContent = String(label ?? "");
    if (bar && Number.isFinite(Number(progress))) bar.style.width = `${Math.max(0, Math.min(100, Number(progress)))}%`;
  };

  return { setStage, close: () => setTimeout(() => dialog.close?.({ force: true }), 160) };
}

/**
 * 16-preparation-display restreint volontairement un sort auto-accordé aux
 * listes de sa classe source. Lorsqu'un même Item reçoit ensuite une liste
 * manuelle, celle-ci doit s'ajouter à cette restriction, jamais la remplacer.
 */
function installSharedSpellListUnion() {
  const original = globalThis.add2eGetSpellListsFromItem;
  if (typeof original !== "function" || original._add2eSharedListUnion) return typeof original === "function";

  const wrapped = function add2eGetSpellListsFromItemSharedLists(sort) {
    const flags = sort?.flags?.add2e ?? {};
    return unionSpellLists(
      original(sort),
      flags.grantedSpellLists,
      flags.autoGrantedSpellLists,
      flags.learnedSpellLists,
      flags.knownSpellLists
    );
  };
  wrapped._add2eSharedListUnion = true;
  globalThis.add2eGetSpellListsFromItem = wrapped;
  return true;
}

async function removeLegacyMaterialFields(actor, reason = "legacy-material-cleanup") {
  if (!game.user?.isGM || !actor || actor.type !== "personnage") return { removed: 0 };
  const updates = Array.from(actor.items ?? [])
    .filter(item => String(item.type ?? "").toLowerCase() === "sort" && hasOwn(item.system, "composants_materiels_objets"))
    .map(item => ({ _id: item.id, system: { composants_materiels_objets: forcedDeletion() } }));
  const live = liveUpdates(actor, updates);
  if (!live.length) return { removed: 0 };
  try {
    await actor.updateEmbeddedDocuments("Item", live, { add2eInternal: true, add2eSpellSync: true, reason, render: false });
  } catch (error) {
    if (!/does not exist/i.test(String(error?.message ?? error))) throw error;
    const retry = liveUpdates(actor, live);
    if (!retry.length) return { removed: 0 };
    await actor.updateEmbeddedDocuments("Item", retry, { add2eInternal: true, add2eSpellSync: true, reason, render: false });
  }
  globalThis.add2eRerenderActorSheet?.(actor, false);
  return { removed: live.length };
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

async function safeDeleteIds(actor, ids, reason = "manual") {
  const requested = [...new Set((ids ?? []).map(id => String(id ?? "").trim()).filter(Boolean))];
  const existing = requested.filter(id => actor?.items?.has?.(id));
  if (!existing.length) return { deleted: 0, skippedMissing: requested.length, requested: requested.length };
  try {
    await actor.deleteEmbeddedDocuments("Item", existing, { add2eInternal: true, add2eDedupe: true, reason });
    return { deleted: existing.length, skippedMissing: requested.length - existing.length, requested: requested.length };
  } catch (error) {
    if (!/does not exist/i.test(String(error?.message ?? error))) throw error;
    let deleted = 0;
    for (const id of existing) {
      if (!actor.items?.has?.(id)) continue;
      try { await actor.deleteEmbeddedDocuments("Item", [id], { add2eInternal: true, add2eDedupe: true, reason }); deleted += 1; }
      catch (oneError) { if (!/does not exist/i.test(String(oneError?.message ?? oneError))) throw oneError; }
    }
    return { deleted, skippedMissing: requested.length - deleted, requested: requested.length };
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
    const result = await queue(actor, () => removeDuplicates(actor, reason));
    deleted += Number(result?.deleted ?? 0) || 0;
    results.push({ actor: actor.name, ...result });
  }
  ui.notifications?.info?.(`ADD2E : nettoyage terminé (${deleted} sort(s) doublon(s) supprimé(s)).`);
  return { actors: results.length, deleted, results };
}

async function waitForFamilyExpansion(actor) {
  const expand = globalThis.add2eRequestActorSpellFamilyExpansion ?? globalThis.add2eExpandActorSpellFamilies;
  return typeof expand === "function" ? expand(actor) : { handled: false };
}

function resultChanged(result) {
  return ["imported", "updated", "deleted"].some(key => Number(result?.[key] ?? 0) > 0);
}

function installWrapper() {
  const original = globalThis.add2eSyncActorSpellsFromClass;
  if (typeof original !== "function" || original._add2eDedupeWrapped) return typeof original === "function";
  const wrapped = async function add2eSyncActorSpellsFromClassDedupe(actor, classItem, options = {}) {
    const progress = openSpellSyncProgress(actor, classItem, options);
    try {
      progress?.setStage("Lecture du compendium et synchronisation des sorts…", 36);
      const result = await queue(actor, () => original(actor, classItem, {
        ...options,
        showWait: false,
        forceCacheRefresh: options?.forceCacheRefreshExplicit === true
      }));
      if (!resultChanged(result)) {
        progress?.setStage("Aucune modification nécessaire.", 100);
        return result;
      }
      progress?.setStage("Mise à jour des familles réversibles…", 68);
      await waitForFamilyExpansion(actor);
      progress?.setStage("Vérification des doublons et des données historiques…", 88);
      const post = await queue(actor, async () => ({
        dedupe: await removeDuplicates(actor, `sync-${options?.mode ?? "replace"}`),
        cleanup: await removeLegacyMaterialFields(actor, `sync-${options?.mode ?? "replace"}`)
      }));
      if (post.dedupe.deleted) result.deleted = (Number(result.deleted) || 0) + post.dedupe.deleted;
      if (post.cleanup.removed) result.legacyMaterialFieldsRemoved = post.cleanup.removed;
      progress?.setStage("Synchronisation terminée.", 100);
      return result;
    } finally {
      progress?.close();
    }
  };
  wrapped._add2eDedupeWrapped = true;
  globalThis.add2eSyncActorSpellsFromClass = wrapped;
  return true;
}

Hooks.once("ready", () => {
  if (!installWrapper()) {
    setTimeout(installWrapper, 0);
    setTimeout(installWrapper, 250);
  }
  // 16-preparation-display est importé après ce module. Le timer garantit que
  // son adaptateur de mémorisation est déjà installé avant cette union.
  setTimeout(() => {
    if (installSharedSpellListUnion()) {
      for (const app of Object.values(ui.windows ?? {})) {
        const actor = app?.actor ?? app?.document ?? app?.object;
        if (actor?.type === "personnage") app.render?.(false);
      }
    }
  }, 0);
  if (!game.user?.isGM) return;
  for (const actor of game.actors?.filter?.(entry => entry.type === "personnage") ?? []) {
    queue(actor, () => removeLegacyMaterialFields(actor, "ready-legacy-material-cleanup"))
      .catch(error => console.error("[ADD2E][SPELL_SYNC][LEGACY_MATERIAL_CLEANUP_ERROR]", error));
  }
});

globalThis.add2eRemoveDuplicateActorSpells = removeDuplicates;
globalThis.add2eSafeDeleteDuplicateActorSpellIds = safeDeleteIds;
globalThis.add2eRemoveDuplicateSpellsEverywhere = removeDuplicatesEverywhere;
globalThis.add2eNormalizeActorSpellMaterials = removeLegacyMaterialFields;
globalThis.add2eSpellDedupeCleanSpellMaterialComponents = system => clone(system?.composants_materiels ?? []);
globalThis.add2eMigrateActorLegacySpellMaterialFields = removeLegacyMaterialFields;