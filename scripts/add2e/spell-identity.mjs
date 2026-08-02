// ADD2E — Identité canonique des sorts possédés par un acteur.
// Compatible Foundry V13/V14/V15.

export const ADD2E_SPELL_IDENTITY_VERSION = "2026-08-02-canonical-owned-spell-identity-v1";
const ADD2E_SPELL_IDENTITY_TAG = "[ADD2E][SPELL_IDENTITY]";
const reconciliationQueue = new Map();

globalThis.ADD2E_SPELL_IDENTITY_VERSION = ADD2E_SPELL_IDENTITY_VERSION;

function clone(value) {
  if (value === undefined) return undefined;
  if (foundry?.utils?.deepClone) return foundry.utils.deepClone(value);
  if (foundry?.utils?.duplicate) return foundry.utils.duplicate(value);
  return JSON.parse(JSON.stringify(value));
}

function norm(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function values(value) {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(values);
  if (value instanceof Set) return [...value].flatMap(values);
  if (typeof value === "string") return value.split(/[,;|\n]+/g).map(entry => entry.trim()).filter(Boolean);
  if (typeof value === "object") return Object.values(value).flatMap(values);
  return [value];
}

function isSpell(value) {
  return String(value?.type ?? value?._source?.type ?? "").toLowerCase() === "sort";
}

function isPower(value) {
  const system = value?.system ?? value?._source?.system ?? {};
  const flags = value?.flags?.add2e ?? value?._source?.flags?.add2e ?? {};
  return system.isPower === true
    || Boolean(system.sourcePowerId)
    || Boolean(flags.magicPower)
    || Boolean(flags.sourcePowerId)
    || flags.kind === "magic-power";
}

function spellLevel(value) {
  const system = value?.system ?? value?._source?.system ?? {};
  const level = Number(system.niveau ?? system.level ?? system.niveau_sort ?? system.spellLevel ?? 1);
  return Number.isFinite(level) ? Math.max(0, Math.floor(level)) : 1;
}

function sourceKeys(value) {
  const source = value?._source ?? value ?? {};
  const flags = source.flags?.add2e ?? {};
  return new Set([
    source.flags?.core?.sourceId,
    source._stats?.compendiumSource,
    flags.sourceUuid,
    flags.sourceItemUuid,
    flags.sourceId,
    flags.importKey,
    flags.foundryId,
    source.system?.sourceUuid,
    source.system?.sourceItemUuid,
    source.system?.compendiumSource
  ].map(entry => String(entry ?? "").trim()).filter(Boolean));
}

function spellListKeys(value) {
  const source = value?._source ?? value ?? {};
  const system = source.system ?? {};
  const flags = source.flags?.add2e ?? {};
  const raw = [
    flags.learnedSpellLists,
    flags.knownSpellLists,
    flags.grantedSpellLists,
    system.spellLists,
    system.liste,
    system.liste_sort,
    system.listeSort,
    system.classe,
    system.class
  ];
  return [...new Set(raw.flatMap(values).map(norm).filter(Boolean))];
}

function sameSpell(left, right) {
  if (!isSpell(left) || !isSpell(right) || isPower(left) || isPower(right)) return false;
  const leftSources = sourceKeys(left);
  const rightSources = sourceKeys(right);
  if (leftSources.size && rightSources.size) {
    for (const key of leftSources) if (rightSources.has(key)) return true;
  }
  const leftName = norm(left?.name ?? left?._source?.name);
  const rightName = norm(right?.name ?? right?._source?.name);
  return Boolean(leftName)
    && leftName === rightName
    && spellLevel(left) === spellLevel(right);
}

function validMemorizedPath(path) {
  const key = norm(path);
  return key
    && !key.includes("max")
    && !key.includes("maximum")
    && !key.includes("total")
    && !key.includes("capacity")
    && !key.includes("capacite")
    && !key.includes("niveau_max")
    && !key.includes("level_max");
}

function mergeMemorizedTrees(target, source, path = "") {
  if (source === undefined || source === null) return clone(target);
  if (typeof source === "number" && Number.isFinite(source)) {
    const current = Number(target);
    if (!validMemorizedPath(path)) return Number.isFinite(current) ? Math.max(current, source) : source;
    return Math.max(0, Number.isFinite(current) ? current : 0) + Math.max(0, source);
  }
  if (Array.isArray(source)) return clone(target ?? source);
  if (typeof source !== "object") return target === undefined ? clone(source) : clone(target);
  const result = target && typeof target === "object" && !Array.isArray(target) ? clone(target) : {};
  for (const [key, value] of Object.entries(source)) {
    result[key] = mergeMemorizedTrees(result[key], value, path ? `${path}.${key}` : key);
  }
  return result;
}

function memorizedCount(value) {
  const source = value?._source ?? value ?? {};
  const count = Number(source.flags?.add2e?.memorizedCount ?? 0);
  return Number.isFinite(count) ? Math.max(0, count) : 0;
}

function memorizedByList(value) {
  const source = value?._source ?? value ?? {};
  return clone(source.flags?.add2e?.memorizedByList);
}

function mergeSpellData(keeper, sources = []) {
  const all = [keeper, ...sources].filter(Boolean);
  const known = new Set();
  const learned = new Set();
  const granted = new Set();
  let manual = false;
  let lastLearned = "";
  let totalMemorized = 0;
  let byList;

  for (const entry of all) {
    const source = entry?._source ?? entry ?? {};
    const flags = source.flags?.add2e ?? {};
    for (const key of spellListKeys(source)) known.add(key);
    for (const key of values(flags.learnedSpellLists).map(norm).filter(Boolean)) learned.add(key);
    for (const key of values(flags.grantedSpellLists).map(norm).filter(Boolean)) granted.add(key);
    manual ||= flags.manuallyLearnedSpell === true;
    const candidateLast = norm(flags.lastLearnedSpellList);
    if (candidateLast) lastLearned = candidateLast;
    totalMemorized += memorizedCount(source);
    byList = mergeMemorizedTrees(byList, memorizedByList(source));
  }

  const lists = [...known];
  const update = {
    _id: keeper.id,
    "flags.add2e.knownSpellLists": lists,
    "system.spellLists": lists,
    "flags.add2e.memorizedCount": totalMemorized
  };
  if (learned.size) update["flags.add2e.learnedSpellLists"] = [...learned];
  if (granted.size) update["flags.add2e.grantedSpellLists"] = [...granted];
  if (manual) update["flags.add2e.manuallyLearnedSpell"] = true;
  if (lastLearned) update["flags.add2e.lastLearnedSpellList"] = lastLearned;
  if (byList !== undefined) update["flags.add2e.memorizedByList"] = byList;
  return update;
}

function keeperSort(left, right) {
  const leftCreated = Number(left?._stats?.createdTime ?? left?._source?._stats?.createdTime ?? 0) || 0;
  const rightCreated = Number(right?._stats?.createdTime ?? right?._source?._stats?.createdTime ?? 0) || 0;
  if (leftCreated !== rightCreated) return leftCreated - rightCreated;
  return String(left?.id ?? "").localeCompare(String(right?.id ?? ""));
}

function spellGroups(actor) {
  const groups = [];
  const spells = Array.from(actor?.items ?? []).filter(item => isSpell(item) && !isPower(item));
  for (const spell of spells) {
    const group = groups.find(entries => entries.some(entry => sameSpell(entry, spell)));
    if (group) group.push(spell);
    else groups.push([spell]);
  }
  return groups.filter(group => group.length > 1);
}

function renderActorSheets(actor) {
  for (const app of Object.values(ui.windows ?? {})) {
    const document = app?.actor ?? app?.document ?? app?.object ?? null;
    if (document?.documentName !== "Actor" || String(document.id) !== String(actor?.id)) continue;
    try { app.render?.({ force: true }); continue; } catch (_error) {}
    try { app.render?.(true); } catch (_error) {}
  }
}

export async function add2eReconcileActorSpellDuplicates(actor, { reason = "manual", notify = false } = {}) {
  if (!actor?.items || actor.documentName !== "Actor") return { actor, merged: 0, deleted: 0, groups: [] };
  const results = [];
  let deleted = 0;

  for (const group of spellGroups(actor)) {
    const ordered = [...group].sort(keeperSort);
    const keeper = ordered[0];
    const duplicates = ordered.slice(1).filter(item => actor.items?.has?.(item.id));
    if (!keeper || !duplicates.length) continue;

    const update = mergeSpellData(keeper, duplicates);
    await actor.updateEmbeddedDocuments("Item", [update], {
      add2eInternal: true,
      add2eSpellIdentityMerge: true,
      add2eReason: `spell-identity:${reason}`,
      render: false
    });
    const ids = duplicates.map(item => item.id).filter(id => actor.items?.has?.(id));
    if (ids.length) {
      await actor.deleteEmbeddedDocuments("Item", ids, {
        add2eInternal: true,
        add2eSpellIdentityMerge: true,
        add2eReason: `spell-identity:${reason}`,
        render: false
      });
      deleted += ids.length;
    }
    results.push({
      name: keeper.name,
      level: spellLevel(keeper),
      keeperId: keeper.id,
      deletedIds: ids,
      lists: update["system.spellLists"],
      memorizedCount: update["flags.add2e.memorizedCount"]
    });
  }

  if (results.length) {
    renderActorSheets(actor);
    console.log(`${ADD2E_SPELL_IDENTITY_TAG}[RECONCILED]`, {
      version: ADD2E_SPELL_IDENTITY_VERSION,
      actor: actor.name,
      actorId: actor.id,
      reason,
      groups: results
    });
    if (notify) ui.notifications?.info?.(`${actor.name} : ${deleted} doublon${deleted > 1 ? "s" : ""} de sort fusionné${deleted > 1 ? "s" : ""}.`);
  }
  return { actor, merged: results.length, deleted, groups: results };
}

function queueReconciliation(actor, reason = "document-change", notify = false) {
  if (!actor?.id) return;
  const key = String(actor.uuid ?? actor.id);
  const existing = reconciliationQueue.get(key);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    reconciliationQueue.delete(key);
    add2eReconcileActorSpellDuplicates(actor, { reason, notify })
      .catch(error => console.error(`${ADD2E_SPELL_IDENTITY_TAG}[RECONCILE_FAILED]`, { actor: actor.name, reason, error }));
  }, 50);
  reconciliationQueue.set(key, timer);
}

async function mergeRejectedCreation(actor, existing, incoming) {
  if (!actor?.items?.has?.(existing?.id)) return;
  const update = mergeSpellData(existing, [incoming]);
  await actor.updateEmbeddedDocuments("Item", [update], {
    add2eInternal: true,
    add2eSpellIdentityMerge: true,
    add2eReason: "spell-identity:blocked-create",
    render: false
  });
  renderActorSheets(actor);
  console.log(`${ADD2E_SPELL_IDENTITY_TAG}[CREATE_MERGED]`, {
    version: ADD2E_SPELL_IDENTITY_VERSION,
    actor: actor.name,
    existing: existing.name,
    existingId: existing.id,
    lists: update["system.spellLists"],
    memorizedCount: update["flags.add2e.memorizedCount"]
  });
}

function responsibleGm() {
  if (!game.user?.isGM) return false;
  if (typeof game.user.isActiveGM === "boolean") return game.user.isActiveGM;
  return !game.users?.activeGM || game.users.activeGM.id === game.user.id;
}

Hooks.on("preCreateItem", (item, data = {}, options = {}, userId = null) => {
  const actor = item?.parent;
  if (!actor || actor.documentName !== "Actor" || options?.add2eSpellIdentityMerge) return true;
  const incoming = data && Object.keys(data).length ? data : item?.toObject?.() ?? item;
  if (!isSpell(incoming) || isPower(incoming)) return true;
  const existing = Array.from(actor.items ?? []).find(candidate => sameSpell(candidate, incoming)) ?? null;
  if (!existing) return true;

  queueMicrotask(() => {
    mergeRejectedCreation(actor, existing, incoming)
      .catch(error => console.error(`${ADD2E_SPELL_IDENTITY_TAG}[BLOCKED_CREATE_MERGE_FAILED]`, {
        actor: actor.name,
        existingId: existing.id,
        incomingName: incoming?.name,
        error
      }));
  });
  if (String(userId ?? game.user?.id) === String(game.user?.id)) {
    ui.notifications?.warn?.(`« ${incoming?.name ?? existing.name} » est déjà inscrit : les listes et préparations ont été fusionnées.`);
  }
  return false;
});

Hooks.on("createItem", (item, options = {}) => {
  const actor = item?.parent;
  if (!actor || actor.documentName !== "Actor" || options?.add2eSpellIdentityMerge || !isSpell(item) || isPower(item)) return;
  queueReconciliation(actor, "create-item");
});

Hooks.once("ready", () => {
  if (!responsibleGm()) return;
  setTimeout(async () => {
    for (const actor of game.actors ?? []) {
      try {
        await add2eReconcileActorSpellDuplicates(actor, { reason: "ready-migration", notify: false });
      } catch (error) {
        console.error(`${ADD2E_SPELL_IDENTITY_TAG}[READY_MIGRATION_FAILED]`, { actor: actor?.name, actorId: actor?.id, error });
      }
    }
  }, 750);
});

globalThis.add2eSameOwnedSpell = sameSpell;
globalThis.add2eReconcileActorSpellDuplicates = add2eReconcileActorSpellDuplicates;
