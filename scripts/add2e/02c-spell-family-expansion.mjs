// ============================================================
// ADD2E — Expansion des formes de sorts sur les acteurs
// Réversibles et variantes : une ligne d'acteur par forme.
// Compatible Foundry V13 / V14 / V15.
// ============================================================

const ADD2E_SPELL_FAMILY_VERSION = "2026-06-21-spell-family-actor-lines-v1";
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
  return [...new Set([
    ...add2eSpellFamilyArray(system.spellLists),
    ...add2eSpellFamilyArray(system.lists),
    ...add2eSpellFamilyArray(system.classes),
    ...add2eSpellFamilyArray(system.classe),
    ...add2eSpellFamilyArray(system.class),
    ...add2eSpellFamilyArray(system.liste),
    ...add2eSpellFamilyArray(system.tags),
    ...add2eSpellFamilyArray(system.effectTags)
  ].map(add2eSpellFamilyNormalize).filter(Boolean))];
}

function add2eSpellFamilyStableKey(data) {
  const system = data?.system ?? {};
  const lists = add2eSpellFamilyLists(system).sort().join("+") || "liste_inconnue";
  const level = add2eSpellFamilyLevel(system);
  const name = add2eSpellFamilyNormalize(data?.name ?? system.nom ?? "");
  return `${lists}|${level}|${name}`;
}

function add2eSpellFamilyProfileKey(profile = {}, fallbackName = "") {
  return [
    add2eSpellFamilyNormalize(profile.class),
    Number(profile.level) || 0,
    add2eSpellFamilyNormalize(profile.referenceName ?? fallbackName)
  ].join("|");
}

function add2eSpellFamilyProfiles(flag, system) {
  const profiles = Array.isArray(flag?.profiles) ? flag.profiles.filter(profile => profile && typeof profile === "object") : [];
  if (!profiles.length) return [];

  const level = add2eSpellFamilyLevel(system);
  const lists = new Set(add2eSpellFamilyLists(system));
  const matches = profiles.filter(profile => {
    const profileLevel = Number(profile.level) || 0;
    const profileClass = add2eSpellFamilyNormalize(profile.class);
    if (profileLevel && profileLevel !== level) return false;
    return !profileClass || !lists.size || lists.has(profileClass);
  });

  return matches.length ? matches : profiles.length === 1 ? profiles : [];
}

function add2eSpellFamilyMode(profile = {}, modeId) {
  return (Array.isArray(profile.modes) ? profile.modes : [])
    .find(mode => String(mode?.id ?? "").trim().toLowerCase() === String(modeId).trim().toLowerCase()) ?? null;
}

function add2eSpellFamilyApplySystemOverrides(data, overrides = {}) {
  const result = add2eSpellFamilyClone(data);
  result.system ??= {};
  for (const [key, value] of Object.entries(overrides ?? {})) {
    if (key.includes(".")) foundry.utils.setProperty(result.system, key, add2eSpellFamilyClone(value));
    else result.system[key] = add2eSpellFamilyClone(value);
  }
  return result;
}

function add2eSpellFamilyMark(data, familyKey, kind, details = {}) {
  const result = add2eSpellFamilyClone(data);
  result.flags ??= {};
  result.flags.add2e ??= {};
  result.flags.add2e.spellFamily = {
    version: ADD2E_SPELL_FAMILY_VERSION,
    key: familyKey,
    kind,
    generated: kind !== "base",
    ...add2eSpellFamilyClone(details)
  };
  return result;
}

function add2eSpellFamilyRename(data, name) {
  const result = add2eSpellFamilyClone(data);
  result.name = String(name ?? "").trim();
  result.system ??= {};
  result.system.nom = result.name;
  return result;
}

function add2eSpellFamilyBuildExpected(baseItem) {
  const baseSource = baseItem.toObject();
  const baseName = String(baseSource.name ?? baseSource.system?.nom ?? "").trim();
  const familyKey = add2eSpellFamilyStableKey(baseSource);
  const expected = [];

  const reversibleProfiles = add2eSpellFamilyProfiles(baseSource.flags?.add2e?.reversible, baseSource.system);
  const normalProfile = reversibleProfiles[0] ?? null;
  const normalMode = normalProfile ? add2eSpellFamilyMode(normalProfile, "normal") : null;
  const preparedBase = normalMode?.systemOverrides
    ? add2eSpellFamilyApplySystemOverrides(baseSource, normalMode.systemOverrides)
    : add2eSpellFamilyClone(baseSource);

  expected.push({
    identity: "base",
    kind: "base",
    data: add2eSpellFamilyMark(preparedBase, familyKey, "base", {
      sourceItemId: baseItem.id,
      sourceItemName: baseName
    })
  });

  for (const profile of reversibleProfiles) {
    if (profile?.splitOnActorGrant !== true) continue;
    const inverseMode = add2eSpellFamilyMode(profile, "inverse");
    const inverseName = String(inverseMode?.actorItemName ?? inverseMode?.manualName ?? "").trim();
    if (!inverseName) continue;

    const profileKey = add2eSpellFamilyProfileKey(profile, baseName);
    let data = add2eSpellFamilyRename(preparedBase, inverseName);
    data = add2eSpellFamilyApplySystemOverrides(data, inverseMode?.systemOverrides ?? {});
    data = add2eSpellFamilyMark(data, familyKey, "inverse", {
      sourceItemId: baseItem.id,
      sourceItemName: baseName,
      profileKey,
      reversibleMode: "inverse",
      inverseNameStatus: profile.inverseNameStatus ?? "manual_explicit"
    });
    data.flags.add2e.reversibleActorEntry = {
      version: ADD2E_SPELL_FAMILY_VERSION,
      profileKey,
      mode: "inverse",
      sourceItemName: baseName
    };
    expected.push({ identity: `inverse:${profileKey}`, kind: "inverse", data });
  }

  const variantProfiles = add2eSpellFamilyProfiles(baseSource.flags?.add2e?.variant, baseSource.system);
  for (const profile of variantProfiles) {
    const profileKey = add2eSpellFamilyProfileKey(profile, baseName);
    for (const choice of Array.isArray(profile?.choices) ? profile.choices : []) {
      const choiceId = String(choice?.id ?? "").trim() || add2eSpellFamilyNormalize(choice?.nom ?? choice?.name);
      const choiceName = String(choice?.nom ?? choice?.name ?? "").trim();
      if (!choiceId || !choiceName) continue;

      let data = add2eSpellFamilyRename(preparedBase, `${baseName} — ${choiceName}`);
      data = add2eSpellFamilyMark(data, familyKey, "variant", {
        sourceItemId: baseItem.id,
        sourceItemName: baseName,
        profileKey,
        variantChoiceId: choiceId,
        variantChoiceName: choiceName
      });
      data.flags.add2e.variantChoice = {
        version: ADD2E_SPELL_FAMILY_VERSION,
        profileKey,
        id: choiceId,
        nom: choiceName,
        reference: add2eSpellFamilyClone(choice?.reference ?? null)
      };
      expected.push({ identity: `variant:${profileKey}:${choiceId}`, kind: "variant", data });
    }
  }

  const unique = new Map();
  for (const entry of expected) {
    const key = `${entry.identity}|${add2eSpellFamilyStableKey(entry.data)}`;
    if (!unique.has(key)) unique.set(key, entry);
  }
  return { familyKey, entries: [...unique.values()] };
}

function add2eSpellFamilyEntryIdentity(item) {
  const family = item?.flags?.add2e?.spellFamily ?? {};
  if (family.kind === "base") return "base";
  if (family.kind === "inverse") return `inverse:${family.profileKey ?? ""}`;
  if (family.kind === "variant") return `variant:${family.profileKey ?? ""}:${family.variantChoiceId ?? ""}`;
  return "";
}

function add2eSpellFamilyIsGenerated(item) {
  return item?.flags?.add2e?.spellFamily?.generated === true;
}

function add2eSpellFamilyUpdateData(existing, expected) {
  const flags = expected.data.flags?.add2e ?? {};
  const update = {
    _id: existing.id,
    name: expected.data.name,
    img: expected.data.img,
    system: add2eSpellFamilyClone(expected.data.system ?? {}),
    "flags.add2e.spellFamily": add2eSpellFamilyClone(flags.spellFamily)
  };
  if (flags.reversibleActorEntry) update["flags.add2e.reversibleActorEntry"] = add2eSpellFamilyClone(flags.reversibleActorEntry);
  if (flags.variantChoice) update["flags.add2e.variantChoice"] = add2eSpellFamilyClone(flags.variantChoice);
  return update;
}

async function add2eEnsureActorSpellFamily(item) {
  const actor = item?.actor ?? item?.parent ?? null;
  if (!actor || actor.documentName !== "Actor" || actor.type !== "personnage") return { handled: false, reason: "not-character" };
  if (String(item.type ?? "").toLowerCase() !== "sort") return { handled: false, reason: "not-spell" };
  if (add2eSpellFamilyIsGenerated(item)) return { handled: false, reason: "generated-entry" };

  const { familyKey, entries } = add2eSpellFamilyBuildExpected(item);
  if (entries.length <= 1) return { handled: true, created: 0, updated: 0, familyKey };

  const base = entries.find(entry => entry.kind === "base");
  const baseUpdate = base ? add2eSpellFamilyUpdateData(item, base) : null;
  if (baseUpdate) await actor.updateEmbeddedDocuments("Item", [baseUpdate], { add2eInternal: true, add2eSpellFamilyExpansion: true, render: false });

  const existingByIdentity = new Map();
  const occupiedStableKeys = new Set();
  for (const actorItem of actor.items?.filter?.(entry => String(entry.type ?? "").toLowerCase() === "sort") ?? []) {
    if (actorItem.id !== item.id) occupiedStableKeys.add(add2eSpellFamilyStableKey(actorItem));
    const marker = actorItem.flags?.add2e?.spellFamily ?? {};
    if (marker.key !== familyKey) continue;
    const identity = add2eSpellFamilyEntryIdentity(actorItem);
    if (identity) existingByIdentity.set(identity, actorItem);
  }

  const updates = [];
  const creates = [];
  for (const expected of entries.filter(entry => entry.kind !== "base")) {
    const known = existingByIdentity.get(expected.identity) ?? null;
    if (known) {
      updates.push(add2eSpellFamilyUpdateData(known, expected));
      continue;
    }
    const stableKey = add2eSpellFamilyStableKey(expected.data);
    if (occupiedStableKeys.has(stableKey)) continue;
    const data = add2eSpellFamilyClone(expected.data);
    delete data._id;
    data.folder = null;
    creates.push(data);
    occupiedStableKeys.add(stableKey);
  }

  if (updates.length) await actor.updateEmbeddedDocuments("Item", updates, { add2eInternal: true, add2eSpellFamilyExpansion: true, render: false });
  if (creates.length) await actor.createEmbeddedDocuments("Item", creates, { add2eInternal: true, add2eSpellFamilyExpansion: true, render: false });
  if (updates.length || creates.length) add2eRerenderActorSheet?.(actor, false);
  return { handled: true, created: creates.length, updated: updates.length + (baseUpdate ? 1 : 0), familyKey };
}

Hooks.on("createItem", (item, options = {}, userId) => {
  if (options?.add2eSpellFamilyExpansion) return;
  if (String(userId ?? "") !== String(game.user?.id ?? "")) return;
  if (String(item?.type ?? "").toLowerCase() !== "sort" || add2eSpellFamilyIsGenerated(item)) return;
  const key = String(item.uuid ?? item.id ?? "");
  if (!key || ADD2E_SPELL_FAMILY_PENDING.has(key)) return;
  ADD2E_SPELL_FAMILY_PENDING.add(key);
  queueMicrotask(() => add2eEnsureActorSpellFamily(item)
    .catch(error => console.error("[ADD2E][SPELL_FAMILY][EXPANSION_ERROR]", error))
    .finally(() => ADD2E_SPELL_FAMILY_PENDING.delete(key)));
});

globalThis.ADD2E_SPELL_FAMILY_VERSION = ADD2E_SPELL_FAMILY_VERSION;
globalThis.add2eEnsureActorSpellFamily = add2eEnsureActorSpellFamily;
