// ============================================================
// ADD2E — Expansion et ordre des formes de sorts sur les acteurs
// Réversibles et variantes : une ligne d'acteur par forme.
// Compatible Foundry V13 / V14 / V15.
// ============================================================

const ADD2E_SPELL_FAMILY_VERSION = "2026-06-21-spell-family-safe-display-sort-v5";
const ADD2E_SPELL_FAMILY_PENDING = globalThis.ADD2E_SPELL_FAMILY_PENDING instanceof Set
  ? globalThis.ADD2E_SPELL_FAMILY_PENDING
  : new Set();
globalThis.ADD2E_SPELL_FAMILY_PENDING = ADD2E_SPELL_FAMILY_PENDING;

function add2eSpellFamilyClone(value) {
  if (value === undefined || value === null) return value;
  try { return foundry.utils.deepClone(value); } catch (_e) {}
  try { return foundry.utils.duplicate(value); } catch (_e) {}
  return JSON.parse(JSON.stringify(value));
}

function add2eSpellFamilyNormalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/\s*\([^)]*\)\s*$/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function add2eSpellFamilyArray(value) {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(add2eSpellFamilyArray);
  if (typeof value === "string") return value.split(/[,;|\n]+/g).map(v => v.trim()).filter(Boolean);
  if (typeof value === "object") {
    for (const key of ["spellLists", "lists", "classes", "classe", "class", "value", "values", "items"]) {
      if (value[key] !== undefined) return add2eSpellFamilyArray(value[key]);
    }
  }
  return [value];
}

function add2eSpellFamilyLevel(system = {}) {
  const raw = system.niveau ?? system.niveau_sort ?? system.spellLevel ?? system.level ?? 0;
  return Number(String(raw).match(/\d+/)?.[0] ?? 0) || 0;
}

function add2eSpellFamilyLists(system = {}) {
  const values = [
    ...add2eSpellFamilyArray(system.spellLists),
    ...add2eSpellFamilyArray(system.lists),
    ...add2eSpellFamilyArray(system.classes),
    ...add2eSpellFamilyArray(system.classe),
    ...add2eSpellFamilyArray(system.class),
    ...add2eSpellFamilyArray(system.liste),
    ...add2eSpellFamilyArray(system.tags),
    ...add2eSpellFamilyArray(system.effectTags)
  ].map(add2eSpellFamilyNormalize).filter(Boolean);
  return [...new Set(values)];
}

function add2eSpellFamilyStableKey(data) {
  const system = data?.system ?? {};
  const lists = add2eSpellFamilyLists(system).sort().join("+") || "liste_inconnue";
  return `${lists}|${add2eSpellFamilyLevel(system)}|${add2eSpellFamilyNormalize(data?.name ?? system.nom ?? "")}`;
}

function add2eSpellFamilyProfiles(flag, system) {
  const profiles = Array.isArray(flag?.profiles) ? flag.profiles.filter(v => v && typeof v === "object") : [];
  if (!profiles.length) return [];
  const level = add2eSpellFamilyLevel(system);
  const lists = new Set(add2eSpellFamilyLists(system));
  const matching = profiles.filter(profile => {
    const profileLevel = Number(profile.level) || 0;
    const profileClass = add2eSpellFamilyNormalize(profile.class);
    return (!profileLevel || profileLevel === level) && (!profileClass || !lists.size || lists.has(profileClass));
  });
  return matching.length ? matching : profiles.length === 1 ? profiles : [];
}

function add2eSpellFamilyMode(profile, id) {
  return (Array.isArray(profile?.modes) ? profile.modes : [])
    .find(mode => String(mode?.id ?? "").toLowerCase() === String(id).toLowerCase()) ?? null;
}

function add2eSpellFamilyProfileKey(profile, fallbackName) {
  return [
    add2eSpellFamilyNormalize(profile?.class),
    Number(profile?.level) || 0,
    add2eSpellFamilyNormalize(profile?.referenceName ?? fallbackName)
  ].join("|");
}

function add2eSpellFamilyApplyOverrides(data, overrides = {}) {
  const result = add2eSpellFamilyClone(data);
  result.system ??= {};
  for (const [key, value] of Object.entries(overrides ?? {})) {
    if (key.includes(".")) foundry.utils.setProperty(result.system, key, add2eSpellFamilyClone(value));
    else result.system[key] = add2eSpellFamilyClone(value);
  }
  return result;
}

function add2eSpellFamilyRename(data, name) {
  const result = add2eSpellFamilyClone(data);
  result.name = String(name ?? "").trim();
  result.system ??= {};
  result.system.nom = result.name;
  return result;
}

function add2eSpellFamilyMark(data, familyKey, kind, details = {}, sortOrder = 0) {
  const result = add2eSpellFamilyClone(data);
  result.flags ??= {};
  result.flags.add2e ??= {};
  result.flags.add2e.spellFamily = {
    version: ADD2E_SPELL_FAMILY_VERSION,
    key: familyKey,
    kind,
    sortOrder,
    generated: kind !== "base",
    ...add2eSpellFamilyClone(details)
  };
  return result;
}

function add2eSpellFamilyBuildExpected(baseItem) {
  const source = baseItem.toObject();
  const baseName = String(source.name ?? source.system?.nom ?? "").trim();
  const familyKey = add2eSpellFamilyStableKey(source);
  const reversibleProfiles = add2eSpellFamilyProfiles(source.flags?.add2e?.reversible, source.system);
  const normalMode = reversibleProfiles.map(profile => add2eSpellFamilyMode(profile, "normal")).find(Boolean);
  const normalData = normalMode?.systemOverrides
    ? add2eSpellFamilyApplyOverrides(source, normalMode.systemOverrides)
    : add2eSpellFamilyClone(source);

  const entries = [{
    identity: "base",
    kind: "base",
    data: add2eSpellFamilyMark(normalData, familyKey, "base", {
      sourceItemId: baseItem.id,
      sourceItemName: baseName
    }, 0)
  }];

  let inverseOrder = 1;
  for (const profile of reversibleProfiles) {
    if (profile?.splitOnActorGrant !== true) continue;
    const inverse = add2eSpellFamilyMode(profile, "inverse");
    const inverseName = String(inverse?.actorItemName ?? inverse?.manualName ?? "").trim();
    if (!inverseName) continue;
    const profileKey = add2eSpellFamilyProfileKey(profile, baseName);
    let data = add2eSpellFamilyRename(normalData, inverseName);
    data = add2eSpellFamilyApplyOverrides(data, inverse?.systemOverrides ?? {});
    data = add2eSpellFamilyMark(data, familyKey, "inverse", {
      sourceItemId: baseItem.id,
      sourceItemName: baseName,
      profileKey,
      reversibleMode: "inverse",
      inverseNameStatus: profile.inverseNameStatus ?? "manual_explicit"
    }, inverseOrder++);
    data.flags.add2e.reversibleActorEntry = {
      version: ADD2E_SPELL_FAMILY_VERSION,
      profileKey,
      mode: "inverse",
      sourceItemName: baseName
    };
    entries.push({ identity: `inverse:${profileKey}`, kind: "inverse", data });
  }

  let variantOrder = 10;
  const variantProfiles = add2eSpellFamilyProfiles(source.flags?.add2e?.variant ?? source.flags?.add2e?.variants, source.system);
  for (const profile of variantProfiles) {
    const profileKey = add2eSpellFamilyProfileKey(profile, baseName);
    for (const choice of Array.isArray(profile?.choices) ? profile.choices : []) {
      const choiceId = String(choice?.id ?? "").trim() || add2eSpellFamilyNormalize(choice?.nom ?? choice?.name);
      const choiceName = String(choice?.nom ?? choice?.name ?? "").trim();
      if (!choiceId || !choiceName) continue;
      let data = add2eSpellFamilyRename(normalData, `${baseName} — ${choiceName}`);
      data = add2eSpellFamilyMark(data, familyKey, "variant", {
        sourceItemId: baseItem.id,
        sourceItemName: baseName,
        profileKey,
        variantChoiceId: choiceId,
        variantChoiceName: choiceName
      }, variantOrder++);
      data.flags.add2e.variantChoice = {
        version: ADD2E_SPELL_FAMILY_VERSION,
        profileKey,
        id: choiceId,
        nom: choiceName,
        reference: add2eSpellFamilyClone(choice?.reference ?? null)
      };
      entries.push({ identity: `variant:${profileKey}:${choiceId}`, kind: "variant", data });
    }
  }

  const unique = new Map();
  for (const entry of entries) unique.set(`${entry.identity}|${add2eSpellFamilyStableKey(entry.data)}`, entry);
  return { familyKey, entries: [...unique.values()] };
}

function add2eSpellFamilyIdentity(item) {
  const family = item?.flags?.add2e?.spellFamily ?? {};
  if (family.kind === "base") return "base";
  if (family.kind === "inverse") return `inverse:${family.profileKey ?? ""}`;
  if (family.kind === "variant") return `variant:${family.profileKey ?? ""}:${family.variantChoiceId ?? ""}`;
  return "";
}

function add2eSpellFamilyIsGenerated(item) {
  return item?.flags?.add2e?.spellFamily?.generated === true;
}

function add2eSpellFamilyUpdate(existing, expected) {
  const add2e = expected.data.flags?.add2e ?? {};
  const update = {
    _id: existing.id,
    name: expected.data.name,
    img: expected.data.img,
    system: add2eSpellFamilyClone(expected.data.system ?? {}),
    "flags.add2e.spellFamily": add2eSpellFamilyClone(add2e.spellFamily)
  };
  if (add2e.reversibleActorEntry) update["flags.add2e.reversibleActorEntry"] = add2eSpellFamilyClone(add2e.reversibleActorEntry);
  if (add2e.variantChoice) update["flags.add2e.variantChoice"] = add2eSpellFamilyClone(add2e.variantChoice);
  return update;
}

async function add2eEnsureActorSpellFamily(item) {
  const actor = item?.actor ?? item?.parent ?? null;
  if (!actor || actor.documentName !== "Actor" || actor.type !== "personnage") return { handled: false, reason: "not-character" };
  if (String(item.type ?? "").toLowerCase() !== "sort" || add2eSpellFamilyIsGenerated(item)) return { handled: false, reason: "not-base-spell" };

  const { familyKey, entries } = add2eSpellFamilyBuildExpected(item);
  const derivedEntries = entries.filter(entry => entry.identity !== "base");
  const variantEntries = derivedEntries.filter(entry => entry.kind === "variant");
  if (!derivedEntries.length) return { handled: true, created: 0, updated: 0, deletedBase: 0, familyKey };

  const existing = new Map();
  const occupied = new Set();
  for (const actorItem of actor.items?.filter?.(entry => String(entry.type ?? "").toLowerCase() === "sort") ?? []) {
    if (actorItem.id !== item.id) occupied.add(add2eSpellFamilyStableKey(actorItem));
    if (actorItem.flags?.add2e?.spellFamily?.key !== familyKey) continue;
    const identity = add2eSpellFamilyIdentity(actorItem);
    if (identity) existing.set(identity, actorItem);
  }

  if (!variantEntries.length) {
    const base = entries.find(entry => entry.identity === "base");
    if (base) await actor.updateEmbeddedDocuments("Item", [add2eSpellFamilyUpdate(item, base)], { add2eInternal: true, add2eSpellFamilyExpansion: true, render: false });
  }

  const updates = [];
  const creates = [];
  const resolvedVariantIdentities = new Set();
  const unresolvedVariantIdentities = [];

  for (const expected of derivedEntries) {
    const found = existing.get(expected.identity);
    if (found) {
      updates.push(add2eSpellFamilyUpdate(found, expected));
      if (expected.kind === "variant") resolvedVariantIdentities.add(expected.identity);
      continue;
    }

    const stableKey = add2eSpellFamilyStableKey(expected.data);
    if (occupied.has(stableKey)) {
      if (expected.kind === "variant") unresolvedVariantIdentities.push(expected.identity);
      continue;
    }

    const data = add2eSpellFamilyClone(expected.data);
    delete data._id;
    data.folder = null;
    creates.push(data);
    occupied.add(stableKey);
    if (expected.kind === "variant") resolvedVariantIdentities.add(expected.identity);
  }

  if (updates.length) await actor.updateEmbeddedDocuments("Item", updates, { add2eInternal: true, add2eSpellFamilyExpansion: true, render: false });
  if (creates.length) await actor.createEmbeddedDocuments("Item", creates, { add2eInternal: true, add2eSpellFamilyExpansion: true, render: false });

  let deletedBase = 0;
  const allVariantsResolved = variantEntries.length > 0
    && resolvedVariantIdentities.size === variantEntries.length
    && unresolvedVariantIdentities.length === 0;

  if (allVariantsResolved && actor.items?.get?.(item.id)) {
    await actor.deleteEmbeddedDocuments("Item", [item.id], { add2eInternal: true, add2eSpellFamilyExpansion: true, reason: "replace-generic-variant-parent" });
    deletedBase = 1;
  } else if (variantEntries.length && unresolvedVariantIdentities.length) {
    console.warn("[ADD2E][SPELL_FAMILY][KEEP_PARENT_VARIANT_CONFLICT]", {
      actor: actor.name,
      sort: item.name,
      unresolvedVariantIdentities
    });
  }

  if (updates.length || creates.length || deletedBase) add2eRerenderActorSheet?.(actor, false);
  return {
    handled: true,
    created: creates.length,
    updated: updates.length,
    deletedBase,
    unresolvedVariantIdentities,
    familyKey
  };
}

async function add2eExpandActorSpellFamilies(actor) {
  if (!actor || actor.type !== "personnage") return { handled: false, created: 0, updated: 0, deletedBase: 0 };
  let created = 0;
  let updated = 0;
  let deletedBase = 0;
  for (const item of actor.items?.filter?.(entry => String(entry.type ?? "").toLowerCase() === "sort" && !add2eSpellFamilyIsGenerated(entry)) ?? []) {
    const result = await add2eEnsureActorSpellFamily(item);
    created += result?.created ?? 0;
    updated += result?.updated ?? 0;
    deletedBase += result?.deletedBase ?? 0;
  }
  return { handled: true, created, updated, deletedBase };
}

function add2eSpellFamilySortInfo(entry) {
  const family = entry?.flags?.add2e?.spellFamily ?? {};
  const name = String(entry?.name ?? entry?.system?.nom ?? "").trim();
  const familyName = String(family.sourceItemName ?? name).trim() || name;
  let sortOrder = Number(family.sortOrder);
  if (!Number.isFinite(sortOrder)) {
    if (family.kind === "base") sortOrder = 0;
    else if (family.kind === "inverse") sortOrder = 1;
    else if (family.kind === "variant") sortOrder = 10;
    else sortOrder = 999;
  }
  return { familyKey: String(family.key ?? "").trim(), familyName, sortOrder, name };
}

function add2eCompareSpellFamilyRows(left, right) {
  const a = add2eSpellFamilySortInfo(left);
  const b = add2eSpellFamilySortInfo(right);
  const familyNameCompare = a.familyName.localeCompare(b.familyName, "fr", { sensitivity: "base" });
  if (familyNameCompare) return familyNameCompare;

  if (a.familyKey && a.familyKey === b.familyKey) {
    const orderCompare = a.sortOrder - b.sortOrder;
    if (orderCompare) return orderCompare;
  } else if (a.familyKey || b.familyKey) {
    const keyCompare = a.familyKey.localeCompare(b.familyKey, "fr", { sensitivity: "base" });
    if (keyCompare) return keyCompare;
  }

  return a.name.localeCompare(b.name, "fr", { sensitivity: "base" });
}

function add2eSortActorSpellFamilyRows(data) {
  if (!data || typeof data !== "object") return data;

  for (const rows of Object.values(data.sortsParNiveau ?? {})) {
    if (Array.isArray(rows)) rows.sort(add2eCompareSpellFamilyRows);
  }

  const levels = Array.isArray(data.add2eSpellLevels) ? data.add2eSpellLevels : [];
  for (const level of levels) {
    if (!level || typeof level !== "object") continue;
    if (Array.isArray(level.sorts)) level.sorts.sort(add2eCompareSpellFamilyRows);

    const groups = Array.isArray(level.groups) ? level.groups : [];
    for (const group of groups) {
      if (Array.isArray(group?.sorts)) group.sorts.sort(add2eCompareSpellFamilyRows);
    }
  }

  return data;
}

function add2eInstallSpellFamilyDisplaySorting() {
  const prototype = globalThis.Add2eActorSheet?.prototype;
  if (!prototype || prototype.__add2eSpellFamilyDisplaySortingV5) return false;
  const previousGetData = prototype.getData;
  if (typeof previousGetData !== "function") return false;

  prototype.__add2eSpellFamilyDisplaySortingV5 = true;
  prototype.getData = async function add2eSpellFamilyOrderedGetData(...args) {
    const data = await previousGetData.apply(this, args);
    try {
      return add2eSortActorSpellFamilyRows(data);
    } catch (error) {
      console.error("[ADD2E][SPELL_FAMILY][DISPLAY_SORT_ERROR]", error);
      return data;
    }
  };
  return true;
}

function add2eSpellFamilyIsPrimaryActiveGM() {
  const primary = game.users?.activeGM ?? Array.from(game.users ?? []).find(user => user.active && user.isGM) ?? null;
  return Boolean(game.user?.isGM && (!primary || String(primary.id) === String(game.user.id)));
}

Hooks.on("createItem", (item, options = {}) => {
  if (options?.add2eSpellFamilyExpansion) return;
  if (!add2eSpellFamilyIsPrimaryActiveGM()) return;
  if (String(item?.type ?? "").toLowerCase() !== "sort" || add2eSpellFamilyIsGenerated(item)) return;
  const key = String(item.uuid ?? item.id ?? "");
  if (!key || ADD2E_SPELL_FAMILY_PENDING.has(key)) return;
  ADD2E_SPELL_FAMILY_PENDING.add(key);
  queueMicrotask(() => add2eEnsureActorSpellFamily(item)
    .catch(error => console.error("[ADD2E][SPELL_FAMILY][EXPANSION_ERROR]", error))
    .finally(() => ADD2E_SPELL_FAMILY_PENDING.delete(key)));
});

Hooks.once("ready", () => {
  if (!add2eInstallSpellFamilyDisplaySorting()) {
    console.warn("[ADD2E][SPELL_FAMILY][DISPLAY_SORT_NOT_INSTALLED]");
  }
});

globalThis.ADD2E_SPELL_FAMILY_VERSION = ADD2E_SPELL_FAMILY_VERSION;
globalThis.add2eEnsureActorSpellFamily = add2eEnsureActorSpellFamily;
globalThis.add2eExpandActorSpellFamilies = add2eExpandActorSpellFamilies;
globalThis.add2eSortActorSpellFamilyRows = add2eSortActorSpellFamilyRows;
