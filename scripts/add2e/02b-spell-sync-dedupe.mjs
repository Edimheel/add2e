// ============================================================
// ADD2E — Garde anti-doublons pour la synchronisation des sorts
// ============================================================

const ADD2E_SPELL_SYNC_DEDUPE_VERSION = "2026-05-19-spell-sync-dedupe-v2-safe-delete";
globalThis.ADD2E_SPELL_SYNC_DEDUPE_VERSION = ADD2E_SPELL_SYNC_DEDUPE_VERSION;
console.log("[ADD2E][SPELL_SYNC_DEDUPE][VERSION]", ADD2E_SPELL_SYNC_DEDUPE_VERSION);

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
    .replace(/[\s\-]+/g, "_")
    .replace(/_+/g, "_");
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
  const lists = (() => {
    try {
      if (typeof add2eSpellSyncSpellLists === "function") return add2eSpellSyncSpellLists(sys).sort().join("+");
      if (typeof add2eGetSpellListsFromItem === "function") return add2eGetSpellListsFromItem(itemLike).sort().join("+");
    } catch (_e) {}
    return "";
  })();
  return `${level}|${name}|${lists}`;
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

  if (missingIds.length) {
    console.warn("[ADD2E][SPELL_SYNC_DEDUPE][MISSING_SKIPPED] Sorts déjà absents, suppression ignorée", {
      actor: actor?.name,
      reason,
      count: missingIds.length,
      ids: missingIds
    });
  }

  if (!existingIds.length) {
    return { deleted: 0, skippedMissing: missingIds.length, requested: uniqueIds.length };
  }

  console.warn("[ADD2E][SPELL_SYNC_DEDUPE][DELETE] Suppression de sorts doublons", {
    actor: actor.name,
    reason,
    count: existingIds.length,
    ids: existingIds
  });

  try {
    await actor.deleteEmbeddedDocuments("Item", existingIds, { add2eInternal: true, add2eDedupe: true });
    return { deleted: existingIds.length, skippedMissing: missingIds.length, requested: uniqueIds.length };
  } catch (err) {
    const msg = String(err?.message ?? err ?? "");
    console.warn("[ADD2E][SPELL_SYNC_DEDUPE][BULK_DELETE_FAILED] Suppression groupée échouée, fallback un par un", {
      actor: actor?.name,
      reason,
      message: msg,
      ids: existingIds
    });

    let deleted = 0;
    let skippedMissing = missingIds.length;

    for (const id of existingIds) {
      const item = actor.items?.get?.(id);
      if (!item) {
        skippedMissing += 1;
        console.warn("[ADD2E][SPELL_SYNC_DEDUPE][FALLBACK_MISSING] Sort déjà absent", {
          actor: actor?.name,
          reason,
          id
        });
        continue;
      }

      try {
        await item.delete({ add2eInternal: true, add2eDedupe: true });
        deleted += 1;
      } catch (oneErr) {
        const oneMsg = String(oneErr?.message ?? oneErr ?? "");
        if (oneMsg.includes("does not exist")) {
          skippedMissing += 1;
          console.warn("[ADD2E][SPELL_SYNC_DEDUPE][FALLBACK_ALREADY_GONE] Sort déjà supprimé", {
            actor: actor?.name,
            reason,
            id
          });
          continue;
        }

        console.error("[ADD2E][SPELL_SYNC_DEDUPE][FALLBACK_DELETE_ERROR] Suppression impossible", {
          actor: actor?.name,
          reason,
          id,
          error: oneErr
        });
      }
    }

    return { deleted, skippedMissing, requested: uniqueIds.length };
  }
}

async function add2eRemoveDuplicateActorSpells(actor, reason = "manual") {
  if (!actor || actor.type !== "personnage") return { deleted: 0 };

  const runKey = add2eSpellDedupeRunKey(actor);
  if (ADD2E_SPELL_SYNC_DEDUPE_RUNNING.has(runKey)) {
    console.debug("[ADD2E][SPELL_SYNC_DEDUPE][SKIP_RUNNING] Nettoyage déjà en cours", {
      actor: actor.name,
      reason
    });
    return { deleted: 0, skippedRunning: true };
  }

  ADD2E_SPELL_SYNC_DEDUPE_RUNNING.add(runKey);

  try {
    const seen = new Map();
    const toDelete = [];

    for (const item of actor.items?.filter?.(i => String(i.type || "").toLowerCase() === "sort") ?? []) {
      const key = add2eSpellDedupeKey(item);
      if (!key || key === "0||") continue;
      if (!seen.has(key)) {
        seen.set(key, item.id);
        continue;
      }
      toDelete.push(item.id);
    }

    if (!toDelete.length) return { deleted: 0 };

    return await add2eSafeDeleteDuplicateActorSpellIds(actor, toDelete, reason);
  } finally {
    ADD2E_SPELL_SYNC_DEDUPE_RUNNING.delete(runKey);
  }
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
    } catch (err) {
      console.warn("[ADD2E][SPELL_SYNC_DEDUPE][ERROR] Nettoyage post-sync impossible", err);
    }
    return result;
  };

  wrapped._add2eDedupeWrapped = true;
  globalThis.add2eSyncActorSpellsFromClass = wrapped;
  console.log("[ADD2E][SPELL_SYNC_DEDUPE] Wrapper add2eSyncActorSpellsFromClass installé.");
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
