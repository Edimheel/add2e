// ============================================================
// ADD2E — Garde anti-doublons pour la synchronisation des sorts
// ============================================================

const ADD2E_SPELL_SYNC_DEDUPE_VERSION = "2026-05-19-spell-sync-dedupe-v1";
globalThis.ADD2E_SPELL_SYNC_DEDUPE_VERSION = ADD2E_SPELL_SYNC_DEDUPE_VERSION;
console.log("[ADD2E][SPELL_SYNC_DEDUPE][VERSION]", ADD2E_SPELL_SYNC_DEDUPE_VERSION);

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

async function add2eRemoveDuplicateActorSpells(actor, reason = "manual") {
  if (!actor || actor.type !== "personnage") return { deleted: 0 };

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

  if (toDelete.length) {
    console.warn("[ADD2E][SPELL_SYNC_DEDUPE][DELETE] Suppression de sorts doublons", {
      actor: actor.name,
      reason,
      count: toDelete.length,
      ids: toDelete
    });
    await actor.deleteEmbeddedDocuments("Item", toDelete, { add2eInternal: true, add2eDedupe: true });
  }

  return { deleted: toDelete.length };
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
