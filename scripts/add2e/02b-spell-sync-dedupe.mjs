// ADD2E — Déduplication et orchestration des synchronisations de sorts.
// Compatible Foundry V13 / V14 / V15 — ApplicationV2 / DialogV2 via l’API commune ADD2E.

const ADD2E_SPELL_SYNC_DEDUPE_VERSION = "2026-08-12-canonical-spell-sources-v19";
const RUNNING = globalThis.ADD2E_SPELL_SYNC_DEDUPE_RUNNING instanceof Set ? globalThis.ADD2E_SPELL_SYNC_DEDUPE_RUNNING : new Set();
const RECENT_SYNCS = globalThis.ADD2E_SPELL_SYNC_RECENT instanceof Map ? globalThis.ADD2E_SPELL_SYNC_RECENT : new Map();
globalThis.ADD2E_SPELL_SYNC_DEDUPE_VERSION = ADD2E_SPELL_SYNC_DEDUPE_VERSION;
globalThis.ADD2E_SPELL_SYNC_DEDUPE_RUNNING = RUNNING;
globalThis.ADD2E_SPELL_SYNC_RECENT = RECENT_SYNCS;

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

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function spellLevelOf(item) {
  const level = Number(item?.system?.niveau);
  return Number.isInteger(level) && level >= 1 ? level : 0;
}

function listKeyOf(item) {
  const resolver = globalThis.add2eGetSpellListsFromItem;
  if (typeof resolver !== "function") {
    throw new Error("Le résolveur canonique ADD2E des listes de sorts est indisponible pour la déduplication.");
  }
  const resolved = resolver(item);
  if (!Array.isArray(resolved)) {
    throw new Error(`Listes canoniques invalides pour « ${item?.name ?? "sort inconnu"} ».`);
  }
  return [...new Set(resolved.filter(Boolean))].sort().join("+");
}

function keyOf(item) {
  const name = slug(item?.name ?? item?.system?.nom);
  const level = spellLevelOf(item);
  const lists = listKeyOf(item);
  return name && level > 0 && lists ? `${lists}|${level}|${name}` : "";
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

function spellSyncActorLevel(actor, classItem, options = {}) {
  const supplied = Number(options?.actorLevel);
  if (Number.isInteger(supplied) && supplied >= 1) return supplied;
  if (typeof globalThis.add2eSpellClassLevel !== "function") {
    throw new Error("Le résolveur canonique ADD2E du niveau de classe est indisponible.");
  }
  const resolved = Number(globalThis.add2eSpellClassLevel(actor, classItem));
  if (!Number.isInteger(resolved) || resolved < 1) {
    throw new Error(`Niveau canonique invalide pour la classe « ${classItem?.name ?? classItem?.id ?? "inconnue"} ».`);
  }
  return resolved;
}

function spellSyncMaxLevel(actor, classItem, options = {}) {
  const level = spellSyncActorLevel(actor, classItem, options);
  const max = Number(globalThis.add2eSpellSyncMaxSpellLevel?.(classItem, level));
  return Number.isFinite(max) && max > 0 ? Math.floor(max) : 0;
}

function spellSyncSignature(actor, classItem, options = {}) {
  const actorKey = String(actor?.uuid ?? actor?.id ?? "").trim();
  const classKey = String(classItem?.id ?? "").trim();
  if (!actorKey) throw new Error("Identifiant canonique de l’acteur absent pour la synchronisation des sorts.");
  if (!classKey) throw new Error("Identifiant canonique de l’Item classe absent pour la synchronisation des sorts.");
  return `${actorKey}|${classKey}|${spellSyncActorLevel(actor, classItem, options)}`;
}

function openSpellSyncProgress(actor, classItem, options = {}) {
  if (options?.showWait === false || spellSyncMaxLevel(actor, classItem, options) < 1) return null;

  if (globalThis.add2eDropProgressIsActive?.(actor)) {
    return {
      setStage: (label, progress) => globalThis.add2eDropProgressUpdate?.(actor, label, {
        progress: Math.max(60, Math.min(92, Number(progress) || 70)),
        detail: `Synchronisation des sorts ${classItem?.name ?? "classe"}.`
      }),
      close: () => undefined
    };
  }

  if (typeof globalThis.add2eDialogWait !== "function") {
    throw new Error("L’API de fenêtre ADD2E est indisponible pour la synchronisation des sorts.");
  }

  const id = `add2e-spell-sync-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const className = escapeHtml(classItem?.name ?? "Classe");
  const actorName = escapeHtml(actor?.name ?? "Personnage");

  void globalThis.add2eDialogWait({
    add2eTheme: "wizard",
    add2ePrimaryAction: "close-progress",
    add2eClasses: ["add2e-spell-sync-progress"],
    window: { title: "Synchronisation des sorts", resizable: false },
    modal: false,
    rejectClose: false,
    content: `
      <section data-add2e-spell-sync="${id}">
        <p><strong>${actorName} — ${className}</strong></p>
        <p data-add2e-spell-sync-stage>Lecture du compendium…</p>
        <progress data-add2e-spell-sync-bar max="100" value="22">22%</progress>
      </section>`,
    buttons: [{
      action: "close-progress",
      label: "Fermer",
      icon: "<i class='fas fa-times'></i>",
      default: true,
      callback: () => null
    }],
    close: () => null
  }).catch(error => console.error("[ADD2E][SPELL_SYNC][PROGRESS_DIALOG_ERROR]", error));

  const setStage = (label, progress) => {
    const root = document.querySelector(`[data-add2e-spell-sync="${id}"]`);
    const stage = root?.querySelector?.("[data-add2e-spell-sync-stage]");
    const bar = root?.querySelector?.("[data-add2e-spell-sync-bar]");
    if (stage) stage.textContent = String(label ?? "");
    if (bar && Number.isFinite(Number(progress))) {
      const value = Math.max(0, Math.min(100, Number(progress)));
      bar.value = value;
      bar.textContent = `${value}%`;
    }
  };

  const close = () => setTimeout(() => {
    const root = document.querySelector(`[data-add2e-spell-sync="${id}"]`);
    const application = root?.closest?.(".application, .window-app") ?? null;
    const button = application?.querySelector?.('[data-action="close-progress"]') ?? null;
    button?.click?.();
  }, 160);

  return { setStage, close };
}

async function removeLegacyMaterialFields(actor, reason = "legacy-material-cleanup") {
  if (!game.user?.isGM || !actor || actor.type !== "personnage") return { removed: 0 };
  const updates = Array.from(actor.items ?? []).filter(item => String(item.type ?? "").toLowerCase() === "sort" && hasOwn(item.system, "composants_materiels_objets"))
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
  const ownership = globalThis.add2eSpellSyncSources;
  if (typeof ownership !== "function") {
    throw new Error("Le résolveur canonique ADD2E de provenance des sorts est indisponible pour la déduplication.");
  }
  const truth = ownership(item).length > 0 || flags.manuallyLearnedSpell === true || source.includes("add2e.sorts");
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
  } finally { RUNNING.delete(runKey); }
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

function resultChanged(result) { return ["imported", "updated", "deleted"].some(key => Number(result?.[key] ?? 0) > 0); }

function installWrapper() {
  const original = globalThis.add2eSyncActorSpellsFromClass;
  if (typeof original !== "function" || original._add2eDedupeWrapped) return typeof original === "function";
  const wrapped = async function add2eSyncActorSpellsFromClassDedupe(actor, classItem, options = {}) {
    const signature = spellSyncSignature(actor, classItem, options);
    const now = Date.now();
    const prior = RECENT_SYNCS.get(signature);
    const requestedMode = String(options?.mode ?? "replace").toLowerCase();
    const duplicateReplace = requestedMode === "replace" && prior && now - prior < 3000;
    const effectiveMode = duplicateReplace ? "missing" : requestedMode;
    const progress = openSpellSyncProgress(actor, classItem, options);
    try {
      progress?.setStage(duplicateReplace ? "Vérification d’une synchronisation déjà effectuée…" : "Lecture du compendium et synchronisation des sorts…", 66);
      const result = await queue(actor, () => original(actor, classItem, {
        ...options,
        mode: effectiveMode,
        showWait: false,
        forceCacheRefresh: options?.forceCacheRefreshExplicit === true
      }));
      RECENT_SYNCS.set(signature, Date.now());
      if (!resultChanged(result)) {
        progress?.setStage("Aucune modification nécessaire.", 82);
        return result;
      }
      progress?.setStage("Mise à jour des familles réversibles…", 76);
      await waitForFamilyExpansion(actor);
      progress?.setStage("Vérification des doublons et des données historiques…", 86);
      const post = await queue(actor, async () => ({
        dedupe: await removeDuplicates(actor, `sync-${effectiveMode}`),
        cleanup: await removeLegacyMaterialFields(actor, `sync-${effectiveMode}`)
      }));
      if (post.dedupe.deleted) result.deleted = (Number(result.deleted) || 0) + post.dedupe.deleted;
      if (post.cleanup.removed) result.legacyMaterialFieldsRemoved = post.cleanup.removed;
      progress?.setStage("Synchronisation des sorts terminée.", 92);
      globalThis.add2eRerenderActorSheet?.(actor, false);
      return result;
    } finally { progress?.close(); }
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
