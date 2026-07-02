// ADD2E — Expansion atomique des familles de sorts.
// Compatible Foundry V13 / V14 / V15.

const ADD2E_SPELL_FAMILY_VERSION = "2026-07-02-spell-family-source-id-v14";
const ADD2E_SPELL_FAMILY_MATERIAL_MIGRATION = "2026-07-02-spell-family-source-id-v14";

const SPELL_FAMILY_ACTOR_QUEUES = globalThis.ADD2E_SPELL_FAMILY_ACTOR_QUEUES instanceof Map
  ? globalThis.ADD2E_SPELL_FAMILY_ACTOR_QUEUES : new Map();
const SPELL_FAMILY_EXPANSION_REQUESTS = globalThis.ADD2E_SPELL_FAMILY_EXPANSION_REQUESTS instanceof Map
  ? globalThis.ADD2E_SPELL_FAMILY_EXPANSION_REQUESTS : new Map();
const SPELL_FAMILY_DEDUPE_REQUESTS = globalThis.ADD2E_SPELL_FAMILY_DEDUPE_REQUESTS instanceof Map
  ? globalThis.ADD2E_SPELL_FAMILY_DEDUPE_REQUESTS : new Map();

globalThis.ADD2E_SPELL_FAMILY_ACTOR_QUEUES = SPELL_FAMILY_ACTOR_QUEUES;
globalThis.ADD2E_SPELL_FAMILY_EXPANSION_REQUESTS = SPELL_FAMILY_EXPANSION_REQUESTS;
globalThis.ADD2E_SPELL_FAMILY_DEDUPE_REQUESTS = SPELL_FAMILY_DEDUPE_REQUESTS;

const clone = value => {
  if (value == null) return value;
  try { return foundry.utils.deepClone(value); }
  catch (_error) {
    try { return foundry.utils.duplicate(value); }
    catch (_duplicateError) { return JSON.parse(JSON.stringify(value)); }
  }
};

function forcedDeletion() {
  const deletion = foundry?.data?.operators?.ForcedDeletion;
  if (!deletion) throw new Error("[ADD2E] FoundryData ForcedDeletion est indisponible.");
  return deletion;
}

const normalize = value => String(value ?? "").trim().toLowerCase()
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, "")
  .replace(/\s*\([^)]*\)\s*$/g, "").replace(/[^a-z0-9]+/g, "_")
  .replace(/^_+|_+$/g, "");

function asArray(value) {
  if (value == null || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(asArray);
  if (typeof value === "string") return value.split(/[,;|\n]+/).map(entry => entry.trim()).filter(Boolean);
  if (typeof value === "object") {
    for (const key of ["spellLists", "lists", "classes", "classe", "class", "value", "values", "items"]) {
      if (value[key] !== undefined) return asArray(value[key]);
    }
  }
  return [value];
}

const spellLevel = system => Number(String(system?.niveau ?? system?.niveau_sort ?? system?.spellLevel ?? system?.level ?? 0).match(/\d+/)?.[0] ?? 0) || 0;
const spellLists = system => [...new Set([
  "spellLists", "lists", "classes", "classe", "class", "liste", "tags", "effectTags"
].flatMap(key => asArray(system?.[key])).map(normalize).filter(Boolean))];
const stableSpellKey = data => `${spellLists(data?.system).sort().join("+") || "liste_inconnue"}|${spellLevel(data?.system)}|${normalize(data?.name ?? data?.system?.nom)}`;
const isGeneratedFamilySpell = item => item?.flags?.add2e?.spellFamily?.generated === true;

function familySourceId(item) {
  return String(item?.id ?? item?._id ?? item?.flags?.add2e?.spellFamily?.sourceItemId ?? "").trim();
}

function familyKeyFor(item) {
  const sourceId = familySourceId(item);
  return sourceId ? `source:${sourceId}` : `legacy:${stableSpellKey(item)}`;
}

function familyDerivedId(kind, data, suffix = "") {
  const name = normalize(data?.name ?? data?.system?.nom);
  const level = spellLevel(data?.system);
  return suffix ? `${kind}:${level}|${name}|${normalize(suffix)}` : `${kind}:${level}|${name}`;
}

function familyChildBelongsToSource(item, sourceId, key, legacyKey) {
  if (!isGeneratedFamilySpell(item)) return false;
  const family = item?.flags?.add2e?.spellFamily ?? {};
  const childSourceId = String(family.sourceItemId ?? "").trim();
  if (sourceId && childSourceId) return childSourceId === sourceId;
  return !childSourceId && (family.key === key || family.key === legacyKey);
}

function actorQueueKey(actor) {
  return String(actor?.uuid ?? actor?.id ?? "").trim();
}

function queueActorSpellFamilyWork(actor, work) {
  const key = actorQueueKey(actor);
  if (!key) return Promise.resolve().then(work);
  const previous = SPELL_FAMILY_ACTOR_QUEUES.get(key) ?? Promise.resolve();
  const run = previous.catch(() => undefined).then(work);
  const tracked = run.finally(() => {
    if (SPELL_FAMILY_ACTOR_QUEUES.get(key) === tracked) SPELL_FAMILY_ACTOR_QUEUES.delete(key);
  });
  SPELL_FAMILY_ACTOR_QUEUES.set(key, tracked);
  return run;
}

function isMissingEmbeddedDocumentError(error) {
  return /undefined id .* does not exist|Item .* does not exist|does not exist in the EmbeddedCollection/i.test(String(error?.message ?? error ?? ""));
}

function liveItemUpdates(actor, updates) {
  return (updates ?? []).filter(update => {
    const id = String(update?._id ?? "").trim();
    return id && actor?.items?.has?.(id);
  });
}

async function updateLiveItems(actor, updates, options = {}) {
  const initial = liveItemUpdates(actor, updates);
  if (!initial.length) return 0;
  try {
    await actor.updateEmbeddedDocuments("Item", initial, options);
    return initial.length;
  } catch (error) {
    if (!isMissingEmbeddedDocumentError(error)) throw error;
    const retry = liveItemUpdates(actor, initial);
    if (!retry.length) return 0;
    try {
      await actor.updateEmbeddedDocuments("Item", retry, options);
      return retry.length;
    } catch (retryError) {
      if (isMissingEmbeddedDocumentError(retryError)) return 0;
      throw retryError;
    }
  }
}

async function deleteLiveItem(actor, id, options = {}) {
  const itemId = String(id ?? "").trim();
  if (!itemId || !actor?.items?.has?.(itemId)) return false;
  try {
    await actor.deleteEmbeddedDocuments("Item", [itemId], options);
    return true;
  } catch (error) {
    if (isMissingEmbeddedDocumentError(error)) return false;
    throw error;
  }
}

async function deleteLiveItems(actor, ids, options = {}) {
  let deleted = 0;
  for (const id of [...new Set((ids ?? []).map(value => String(value ?? "").trim()).filter(Boolean))]) {
    if (await deleteLiveItem(actor, id, options)) deleted += 1;
  }
  return deleted;
}

function matchingProfiles(flag, system) {
  const profiles = Array.isArray(flag?.profiles) ? flag.profiles.filter(Boolean) : [];
  if (!profiles.length) return [];
  const level = spellLevel(system);
  const lists = new Set(spellLists(system));
  const matched = profiles.filter(profile =>
    (!Number(profile?.level) || Number(profile.level) === level)
    && (!normalize(profile?.class) || !lists.size || lists.has(normalize(profile.class)))
  );
  return matched.length ? matched : profiles.length === 1 ? profiles : [];
}

const modeFor = (profile, id) => (profile?.modes ?? []).find(mode => String(mode?.id ?? "").toLowerCase() === id) ?? null;
const profileKey = (profile, name) => [normalize(profile?.class), Number(profile?.level) || 0, normalize(profile?.referenceName ?? name)].join("|");

function applySystemOverrides(data, overrides = {}) {
  const result = clone(data);
  result.system ??= {};
  for (const [key, value] of Object.entries(overrides ?? {})) {
    if (key.includes(".")) foundry.utils.setProperty(result.system, key, clone(value));
    else result.system[key] = clone(value);
  }
  return result;
}

function canonicalizeMaterialFields(data) {
  const result = clone(data);
  result.system ??= {};
  delete result.system.composants_materiels_objets;
  return result;
}

function applyMode(data, mode = null) {
  return canonicalizeMaterialFields(applySystemOverrides(data, mode?.systemOverrides ?? {}));
}

function withName(data, name) {
  const result = clone(data);
  result.name = String(name ?? "").trim();
  result.system ??= {};
  result.system.nom = result.name;
  return result;
}

function markFamily(data, key, kind, extra = {}, sortOrder = 0) {
  const result = clone(data);
  result.flags ??= {};
  result.flags.add2e ??= {};
  result.flags.add2e.spellFamily = {
    version: ADD2E_SPELL_FAMILY_VERSION,
    key,
    kind,
    sortOrder,
    generated: kind !== "base",
    ...clone(extra)
  };
  return result;
}

function dedupeExpectedEntries(output) {
  const byIdentity = new Map();
  for (const entry of output) {
    const current = byIdentity.get(entry.id);
    if (!current) {
      byIdentity.set(entry.id, entry);
      continue;
    }
    const currentLists = asArray(current.data?.system?.spellLists);
    const nextLists = asArray(entry.data?.system?.spellLists);
    current.data.system ??= {};
    current.data.system.spellLists = [...new Set([...currentLists, ...nextLists])];
  }
  return [...byIdentity.values()];
}

function expectedSpellFamily(base) {
  const source = typeof base?.toObject === "function" ? base.toObject() : clone(base);
  const name = String(source?.name ?? source?.system?.nom ?? "").trim();
  const sourceId = familySourceId(base);
  const key = familyKeyFor(base);
  const legacyKey = stableSpellKey(source);
  const reversibleProfiles = matchingProfiles(source?.flags?.add2e?.reversible, source?.system);
  const normalMode = reversibleProfiles.map(profile => modeFor(profile, "normal")).find(Boolean);
  const normalData = applyMode(source, normalMode);
  const output = [{
    id: "base",
    kind: "base",
    data: markFamily(normalData, key, "base", { sourceItemId: sourceId, sourceItemName: name, identity: "base" }, 0)
  }];

  let inverseOrder = 1;
  for (const profile of reversibleProfiles) {
    if (profile?.splitOnActorGrant !== true) continue;
    const inverseMode = modeFor(profile, "inverse");
    const inverseName = String(inverseMode?.actorItemName ?? inverseMode?.manualName ?? "").trim();
    if (!inverseName) continue;

    const keyForProfile = profileKey(profile, name);
    let data = withName(normalData, inverseName);
    data = applyMode(data, inverseMode);
    const identity = familyDerivedId("inverse", data);
    data = markFamily(data, key, "inverse", {
      sourceItemId: sourceId,
      sourceItemName: name,
      identity,
      profileKey: keyForProfile,
      reversibleMode: "inverse",
      inverseNameStatus: profile.inverseNameStatus ?? "manual_explicit"
    }, inverseOrder++);
    data.flags.add2e.reversibleActorEntry = {
      version: ADD2E_SPELL_FAMILY_VERSION,
      profileKey: keyForProfile,
      mode: "inverse",
      sourceItemName: name
    };
    output.push({ id: identity, kind: "inverse", data });
  }

  let variantOrder = 10;
  for (const profile of matchingProfiles(source?.flags?.add2e?.variant ?? source?.flags?.add2e?.variants, source?.system)) {
    const keyForProfile = profileKey(profile, name);
    for (const choice of profile?.choices ?? []) {
      const choiceId = String(choice?.id ?? "").trim() || normalize(choice?.nom ?? choice?.name);
      const choiceName = String(choice?.nom ?? choice?.name ?? "").trim();
      if (!choiceId || !choiceName) continue;

      let data = withName(normalData, `${name} — ${choiceName}`);
      data = applyMode(data, choice?.systemOverrides ?? choice?.systemOverride ?? null);
      const identity = familyDerivedId("variant", data, choiceId);
      data = markFamily(data, key, "variant", {
        sourceItemId: sourceId,
        sourceItemName: name,
        identity,
        profileKey: keyForProfile,
        variantChoiceId: choiceId,
        variantChoiceName: choiceName
      }, variantOrder++);
      data.flags.add2e.variantChoice = {
        version: ADD2E_SPELL_FAMILY_VERSION,
        profileKey: keyForProfile,
        id: choiceId,
        nom: choiceName,
        reference: clone(choice?.reference ?? null)
      };
      output.push({ id: identity, kind: "variant", data });
    }
  }

  return { key, legacyKey, sourceId, output: dedupeExpectedEntries(output) };
}

function familyIdentity(item) {
  const family = item?.flags?.add2e?.spellFamily ?? {};
  if (String(family.identity ?? "").trim()) return String(family.identity).trim();
  if (family.kind === "base") return "base";
  if (family.kind === "inverse") return `inverse:${family.profileKey ?? ""}`;
  if (family.kind === "variant") return `variant:${family.profileKey ?? ""}:${family.variantChoiceId ?? ""}`;
  return "";
}

function itemUpdate(item, expected) {
  const add2e = expected.data.flags?.add2e ?? {};
  const update = {
    _id: item.id,
    name: expected.data.name,
    img: expected.data.img,
    system: clone(expected.data.system ?? {}),
    "flags.add2e.spellFamily": clone(add2e.spellFamily)
  };
  if (Object.prototype.hasOwnProperty.call(item?.system ?? {}, "composants_materiels_objets")) update.system.composants_materiels_objets = forcedDeletion();
  for (const key of [
    "autoGrantedByClass", "autoGrantedByClassId", "autoGrantedSpellSync", "autoGrantedAtActorLevel",
    "autoGrantedSpellLists", "grantedSpellLists", "learnedSpellLists", "knownSpellLists",
    "manuallyLearnedSpell", "lastLearnedSpellList", "spellListsResolved"
  ]) if (Object.prototype.hasOwnProperty.call(add2e, key)) update[`flags.add2e.${key}`] = clone(add2e[key]);
  if (add2e.reversibleActorEntry) update["flags.add2e.reversibleActorEntry"] = clone(add2e.reversibleActorEntry);
  if (add2e.variantChoice) update["flags.add2e.variantChoice"] = clone(add2e.variantChoice);
  return update;
}

async function removeVariantParent(actor, id) {
  const itemId = String(id ?? "").trim();
  const parent = itemId && actor?.items?.has?.(itemId) ? actor.items.get(itemId) : null;
  if (!parent || String(parent.type ?? "").toLowerCase() !== "sort" || isGeneratedFamilySpell(parent)) return false;
  const removed = await deleteLiveItem(actor, itemId, {
    add2eInternal: true,
    add2eSpellFamilyExpansion: true,
    reason: "replace-generic-variant-parent",
    render: false
  });
  if (removed) globalThis.add2eRerenderActorSheet?.(actor, false);
  return removed;
}

function chooseFamilyChild(existing, candidate, key) {
  const existingKey = String(existing?.flags?.add2e?.spellFamily?.key ?? "");
  const candidateKey = String(candidate?.flags?.add2e?.spellFamily?.key ?? "");
  return existingKey !== key && candidateKey === key ? candidate : existing;
}

async function ensureSpellFamilyNow(item) {
  const actor = item?.actor ?? item?.parent;
  const sourceId = String(item?.id ?? "").trim();
  if (!actor || actor.documentName !== "Actor" || actor.type !== "personnage" || !sourceId || !actor.items?.has?.(sourceId)) return { handled: false };

  const source = actor.items.get(sourceId);
  if (!source || String(source.type ?? "").toLowerCase() !== "sort" || isGeneratedFamilySpell(source)) return { handled: false };

  const { key, legacyKey, output } = expectedSpellFamily(source);
  const derived = output.filter(entry => entry.id !== "base");
  if (!derived.length) return { handled: true, created: 0, updated: 0, removed: 0, baseUpdated: 0, removedParent: false };

  const variants = derived.filter(entry => entry.kind === "variant");
  const expectedIdentities = new Set(derived.map(entry => entry.id));
  const existingByIdentity = new Map();
  const occupiedKeys = new Set();
  const staleIds = new Set();

  for (const actorSpell of actor.items?.filter?.(candidate => String(candidate.type ?? "").toLowerCase() === "sort") ?? []) {
    const related = familyChildBelongsToSource(actorSpell, sourceId, key, legacyKey);
    if (actorSpell.id !== sourceId && !related) occupiedKeys.add(stableSpellKey(actorSpell));
    if (!related) continue;

    const identity = familyIdentity(actorSpell);
    if (!identity || !expectedIdentities.has(identity)) {
      staleIds.add(actorSpell.id);
      continue;
    }
    const existing = existingByIdentity.get(identity);
    if (!existing) existingByIdentity.set(identity, actorSpell);
    else {
      const kept = chooseFamilyChild(existing, actorSpell, key);
      existingByIdentity.set(identity, kept);
      staleIds.add(kept.id === existing.id ? actorSpell.id : existing.id);
    }
  }

  let baseUpdated = 0;
  if (!variants.length) {
    const baseEntry = output.find(entry => entry.id === "base");
    const liveBase = actor.items?.has?.(sourceId) ? actor.items.get(sourceId) : null;
    if (baseEntry && liveBase) {
      baseUpdated = await updateLiveItems(actor, [itemUpdate(liveBase, baseEntry)], {
        add2eInternal: true,
        add2eSpellFamilyExpansion: true,
        render: false
      });
    }
  }

  const updates = [];
  const creates = [];
  const createdVariantIds = new Set();
  const conflictingVariantIds = [];
  for (const entry of derived) {
    const existing = existingByIdentity.get(entry.id);
    if (existing) {
      updates.push(itemUpdate(existing, entry));
      if (entry.kind === "variant") createdVariantIds.add(entry.id);
      continue;
    }
    const expectedKey = stableSpellKey(entry.data);
    if (occupiedKeys.has(expectedKey)) {
      if (entry.kind === "variant") conflictingVariantIds.push(entry.id);
      continue;
    }
    const data = clone(entry.data);
    delete data._id;
    data.folder = null;
    creates.push(data);
    occupiedKeys.add(expectedKey);
    if (entry.kind === "variant") createdVariantIds.add(entry.id);
  }

  const updated = await updateLiveItems(actor, updates, {
    add2eInternal: true,
    add2eSpellFamilyExpansion: true,
    render: false
  });
  let created = 0;
  if (creates.length) {
    const createdDocs = await actor.createEmbeddedDocuments("Item", creates, {
      add2eInternal: true,
      add2eSpellFamilyExpansion: true,
      render: false
    });
    created = createdDocs?.length ?? 0;
  }

  const removed = await deleteLiveItems(actor, staleIds, {
    add2eInternal: true,
    add2eSpellFamilyExpansion: true,
    reason: "remove-obsolete-family-child",
    render: false
  });

  const removeParent = variants.length > 0 && createdVariantIds.size === variants.length && !conflictingVariantIds.length;
  const removedParent = removeParent ? await removeVariantParent(actor, sourceId) : false;
  if (conflictingVariantIds.length) {
    console.warn("[ADD2E][SPELL_FAMILY][KEEP_PARENT_VARIANT_CONFLICT]", {
      actor: actor.name,
      sort: source.name,
      conflicts: conflictingVariantIds
    });
  }
  if (baseUpdated || updated || created || removed) globalThis.add2eRerenderActorSheet?.(actor, false);
  return { handled: true, created, updated, removed, baseUpdated, removedParent, queued: removedParent };
}

async function expandActorSpellFamiliesNow(actor) {
  if (!actor || actor.type !== "personnage") return { handled: false };
  const result = { handled: true, created: 0, updated: 0, removed: 0, baseUpdated: 0, queued: 0, removedParent: 0 };
  const sourceIds = Array.from(actor.items ?? [])
    .filter(item => String(item.type ?? "").toLowerCase() === "sort" && !isGeneratedFamilySpell(item))
    .map(item => item.id).filter(Boolean);
  for (const id of sourceIds) {
    if (!actor.items?.has?.(id)) continue;
    const current = await ensureSpellFamilyNow(actor.items.get(id));
    result.created += current?.created ?? 0;
    result.updated += current?.updated ?? 0;
    result.removed += current?.removed ?? 0;
    result.baseUpdated += current?.baseUpdated ?? 0;
    result.queued += current?.queued ? 1 : 0;
    result.removedParent += current?.removedParent ? 1 : 0;
  }
  return result;
}

function requestActorSpellFamilyExpansion(actor) {
  const key = actorQueueKey(actor);
  if (!key) return queueActorSpellFamilyWork(actor, () => expandActorSpellFamiliesNow(actor));
  const pending = SPELL_FAMILY_EXPANSION_REQUESTS.get(key);
  if (pending) return pending;
  const request = Promise.resolve().then(() => queueActorSpellFamilyWork(actor, () => expandActorSpellFamiliesNow(actor)));
  SPELL_FAMILY_EXPANSION_REQUESTS.set(key, request);
  request.finally(() => {
    if (SPELL_FAMILY_EXPANSION_REQUESTS.get(key) === request) SPELL_FAMILY_EXPANSION_REQUESTS.delete(key);
  });
  return request;
}

function requestActorSpellFamilyDedupe(actor, reason = "spell-family-create") {
  const key = actorQueueKey(actor);
  if (!key) return Promise.resolve({ deleted: 0 });
  const pending = SPELL_FAMILY_DEDUPE_REQUESTS.get(key);
  if (pending) return pending;
  const request = requestActorSpellFamilyExpansion(actor)
    .then(() => queueActorSpellFamilyWork(actor, async () => {
      const dedupe = globalThis.add2eRemoveDuplicateActorSpells;
      return typeof dedupe === "function" ? dedupe(actor, reason) : { deleted: 0 };
    }));
  SPELL_FAMILY_DEDUPE_REQUESTS.set(key, request);
  request.finally(() => {
    if (SPELL_FAMILY_DEDUPE_REQUESTS.get(key) === request) SPELL_FAMILY_DEDUPE_REQUESTS.delete(key);
  });
  return request;
}

function compareSpellFamilyRows(left, right) {
  const leftFamily = left?.flags?.add2e?.spellFamily ?? {};
  const rightFamily = right?.flags?.add2e?.spellFamily ?? {};
  const leftName = String(left?.name ?? left?.system?.nom ?? "");
  const rightName = String(right?.name ?? right?.system?.nom ?? "");
  const sourceCompare = String(leftFamily.sourceItemName ?? leftName)
    .localeCompare(String(rightFamily.sourceItemName ?? rightName), "fr", { sensitivity: "base" });
  if (sourceCompare) return sourceCompare;
  if (leftFamily.sourceItemId && leftFamily.sourceItemId === rightFamily.sourceItemId) {
    const leftOrder = Number(leftFamily.sortOrder ?? (leftFamily.kind === "inverse" ? 1 : leftFamily.kind === "variant" ? 10 : 0));
    const rightOrder = Number(rightFamily.sortOrder ?? (rightFamily.kind === "inverse" ? 1 : rightFamily.kind === "variant" ? 10 : 0));
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
  }
  return leftName.localeCompare(rightName, "fr", { sensitivity: "base" });
}

function sortSpellFamilyRows(data) {
  if (!data || typeof data !== "object") return data;
  for (const rows of Object.values(data.sortsParNiveau ?? {})) if (Array.isArray(rows)) rows.sort(compareSpellFamilyRows);
  for (const level of Array.isArray(data.add2eSpellLevels) ? data.add2eSpellLevels : []) {
    if (Array.isArray(level?.sorts)) level.sorts.sort(compareSpellFamilyRows);
    for (const group of Array.isArray(level?.groups) ? level.groups : []) if (Array.isArray(group?.sorts)) group.sorts.sort(compareSpellFamilyRows);
  }
  return data;
}

function sameMaterialData(left, right) {
  const normalizeValue = value => {
    if (Array.isArray(value)) return value.map(normalizeValue);
    if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map(key => [key, normalizeValue(value[key])]));
    return value ?? null;
  };
  return JSON.stringify(normalizeValue(left)) === JSON.stringify(normalizeValue(right));
}

function spellFamilyNeedsReconciliation(actor, item) {
  if (!actor?.items?.has?.(item?.id)) return false;
  const { key, legacyKey, sourceId, output } = expectedSpellFamily(item);
  const baseFamily = item?.flags?.add2e?.spellFamily ?? {};
  if (baseFamily.key !== key || String(baseFamily.sourceItemId ?? "") !== sourceId) return true;
  const expected = new Set(output.filter(entry => entry.id !== "base").map(entry => entry.id));
  const counts = new Map();
  for (const actorSpell of actor.items?.filter?.(candidate => String(candidate.type ?? "").toLowerCase() === "sort") ?? []) {
    if (!familyChildBelongsToSource(actorSpell, sourceId, key, legacyKey)) continue;
    const identity = familyIdentity(actorSpell);
    if (!identity || !expected.has(identity)) return true;
    if (actorSpell.flags?.add2e?.spellFamily?.key !== key) return true;
    counts.set(identity, (counts.get(identity) ?? 0) + 1);
  }
  return [...expected].some(identity => counts.get(identity) !== 1);
}

function spellFamilyMaterialsNeedMigration(actor, item) {
  if (!actor?.items?.has?.(item?.id)) return false;
  if (spellFamilyNeedsReconciliation(actor, item)) return true;
  const { key, legacyKey, sourceId, output } = expectedSpellFamily(item);
  const existingByIdentity = new Map();
  for (const actorSpell of actor.items?.filter?.(candidate => String(candidate.type ?? "").toLowerCase() === "sort") ?? []) {
    if (!familyChildBelongsToSource(actorSpell, sourceId, key, legacyKey)) continue;
    const identity = familyIdentity(actorSpell);
    if (identity) existingByIdentity.set(identity, actorSpell);
  }
  return output.some(entry => {
    const actual = entry.id === "base" ? item : existingByIdentity.get(entry.id);
    if (!actual) return true;
    const actualSystem = actual.system ?? {};
    const expectedSystem = entry.data?.system ?? {};
    return Object.prototype.hasOwnProperty.call(actualSystem, "composants_materiels_objets")
      || !sameMaterialData(actualSystem.composants_materiels, expectedSystem.composants_materiels);
  });
}

async function migrateExistingSpellFamilyMaterials() {
  if (!game.user?.isGM) return;
  for (const actor of game.actors?.filter?.(candidate => candidate.type === "personnage") ?? []) {
    const needsMigration = Array.from(actor.items ?? []).some(item =>
      String(item.type ?? "").toLowerCase() === "sort"
      && !isGeneratedFamilySpell(item)
      && matchingProfiles(item.flags?.add2e?.reversible, item.system).some(profile => profile?.splitOnActorGrant === true)
      && spellFamilyMaterialsNeedMigration(actor, item)
    );
    if (needsMigration) await requestActorSpellFamilyExpansion(actor);
    if (actor.getFlag?.("add2e", "spellFamilyMaterialMigration") !== ADD2E_SPELL_FAMILY_MATERIAL_MIGRATION) {
      await actor.setFlag?.("add2e", "spellFamilyMaterialMigration", ADD2E_SPELL_FAMILY_MATERIAL_MIGRATION);
    }
  }
}

Hooks.on("createItem", (item, options = {}, userId) => {
  if (options?.add2eSpellFamilyExpansion || String(userId ?? "") !== String(game.user?.id ?? "")
    || String(item?.type ?? "").toLowerCase() !== "sort" || isGeneratedFamilySpell(item)) return;
  const actor = item?.actor ?? item?.parent;
  if (!actor || actor.type !== "personnage") return;
  requestActorSpellFamilyDedupe(actor, "spell-family-create")
    .catch(error => console.error("[ADD2E][SPELL_FAMILY][EXPANSION_ERROR]", error));
});

Hooks.once("ready", () => {
  const sheetPrototype = globalThis.Add2eActorSheet?.prototype;
  if (sheetPrototype && !sheetPrototype.__add2eSpellFamilyDisplaySortingV8 && typeof sheetPrototype.getData === "function") {
    const originalGetData = sheetPrototype.getData;
    sheetPrototype.__add2eSpellFamilyDisplaySortingV8 = true;
    sheetPrototype.getData = async function add2eSpellFamilyGetData(...args) {
      const data = await originalGetData.apply(this, args);
      try { return sortSpellFamilyRows(data); }
      catch (error) {
        console.error("[ADD2E][SPELL_FAMILY][DISPLAY_SORT_ERROR]", error);
        return data;
      }
    };
  }
  if (game.user?.isGM) migrateExistingSpellFamilyMaterials()
    .catch(error => console.error("[ADD2E][SPELL_FAMILY][MATERIAL_MIGRATION_ERROR]", error));
});

globalThis.ADD2E_SPELL_FAMILY_VERSION = ADD2E_SPELL_FAMILY_VERSION;
globalThis.add2eQueueActorSpellFamilyWork = queueActorSpellFamilyWork;
globalThis.add2eRequestActorSpellFamilyExpansion = requestActorSpellFamilyExpansion;
globalThis.add2eEnsureActorSpellFamily = item => {
  const actor = item?.actor ?? item?.parent;
  return actor ? queueActorSpellFamilyWork(actor, () => ensureSpellFamilyNow(item)) : Promise.resolve({ handled: false });
};
globalThis.add2eExpandActorSpellFamilies = requestActorSpellFamilyExpansion;
globalThis.add2eSortActorSpellFamilyRows = sortSpellFamilyRows;