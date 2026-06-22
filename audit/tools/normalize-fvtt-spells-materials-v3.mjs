import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const VERSION = "2026-06-22-reference-description-v5";
const MANAGED_BY = "normalize-fvtt-spells-materials-v3";
const INPUT = "fvtt-spells-all-normalise-mecanique-v1.json";
const OUTPUT = "fvtt-spells-all-normalise-mecanique-v3.json";
const CONTROL = "fvtt-spells-all-normalise-mecanique-v3-controle.json";
const MASTER = "audit/reference/manuel-joueurs-sorts-master.json";
const REVERSIBILITY_REFERENCE = "audit/reference/manuel-joueurs-reversibilite.json";
const MATERIAL_REFERENCE = "audit/reference/manuel-joueurs-composants-materiels.json";
const CLASSES = {
  clerc: [1, 2, 3, 4, 5, 6, 7],
  druide: [1, 2, 3, 4, 5, 6, 7],
  magicien: [1, 2, 3, 4, 5, 6, 7, 8, 9],
  illusionniste: [1, 2, 3, 4, 5, 6, 7]
};

const text = value => String(value ?? "").replace(/\s+/g, " ").trim();
const slug = value => text(value)
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[’']/g, "'")
  .replace(/[^a-z0-9]+/g, "_")
  .replace(/^_+|_+$/g, "");
const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const emptyCounts = () => Object.fromEntries(Object.keys(CLASSES).map(classSlug => [classSlug, 0]));

function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch { return fallback; }
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function getItems(document) {
  if (Array.isArray(document)) return document;
  for (const key of ["items", "Item", "Items", "documents", "data", "entries"]) {
    if (Array.isArray(document?.[key])) return document[key];
  }
  return [];
}

function setItems(document, items) {
  if (Array.isArray(document)) return items;
  for (const key of ["items", "Item", "Items", "documents", "data", "entries"]) {
    if (Array.isArray(document?.[key])) {
      document[key] = items;
      return document;
    }
  }
  document.items = items;
  return document;
}

function isSpell(item) {
  return String(item?.type ?? item?.system?.type ?? "") === "sort";
}

function itemLevel(item) {
  return Number(String(item?.system?.niveau ?? item?.system?.niveau_sort ?? item?.system?.level ?? "").match(/\d+/)?.[0] ?? 0) || 0;
}

function itemClasses(item) {
  const system = item?.system ?? {};
  const values = Array.isArray(system.spellLists)
    ? system.spellLists
    : String(system.spellLists ?? system.classe ?? "").split(/[,;|/]+/g);
  return new Set([...values.map(slug), slug(system.classe)].filter(Boolean));
}

function itemKey(item) {
  const id = text(item?._id ?? item?.id);
  return id || `${slug(item?.system?.classe)}|${itemLevel(item)}|${slug(item?.name ?? item?.system?.nom)}`;
}

function lotScope(lot) {
  const match = String(lot ?? "").match(/^(clerc|druide|magicien|illusionniste)-niveau-(\d+)$/i);
  if (!match) return null;
  return { classSlug: match[1].toLowerCase(), level: Number(match[2]) };
}

function metaKey(classSlug, level, name) {
  return `${classSlug}|${level}|${slug(name)}`;
}

function uniqueText(values) {
  return [...new Set(values.map(text).filter(Boolean))];
}

function componentsHaveMaterial(value) {
  return text(value).split(/[,;/\s]+/g).some(part => part.trim().toUpperCase() === "M");
}

function normaliseChoices(value) {
  const source = Array.isArray(value)
    ? value
    : Array.isArray(value?.choices)
      ? value.choices
      : Array.isArray(value?.options)
        ? value.options
        : Array.isArray(value?.variants)
          ? value.variants
          : Array.isArray(value?.variantes)
            ? value.variantes
            : [];
  return source.map(choice => ({
    id: text(choice?.id) || slug(choice?.nom ?? choice?.name),
    nom: text(choice?.nom ?? choice?.name),
    reference: clone(choice)
  })).filter(choice => choice.id && choice.nom);
}

function inverseName(value) {
  if (typeof value === "string") return text(value);
  if (!value || typeof value !== "object") return "";
  const direct = value.inverse ?? value.inverseName ?? value.nomInverse ?? value.actorItemName;
  if (typeof direct === "string") return text(direct);
  if (direct && typeof direct === "object") {
    const nested = text(direct.nom ?? direct.name ?? direct.actorItemName);
    if (nested) return nested;
  }
  const inverseMode = (Array.isArray(value.modes) ? value.modes : [])
    .find(mode => String(mode?.id ?? "").toLowerCase() === "inverse");
  return text(inverseMode?.nom ?? inverseMode?.name ?? inverseMode?.actorItemName);
}

function hasReversibleMarker(value) {
  if (value === true) return true;
  if (typeof value === "string" && text(value)) return true;
  return Boolean(value && typeof value === "object");
}

function referenceAliases(value) {
  const direct = [value?.foundryName, value?.foundryNom, value?.foundry?.name, value?.foundry?.nom];
  const lists = [value?.foundryNames, value?.foundryNoms, value?.foundry?.names, value?.foundry?.noms]
    .flatMap(entry => Array.isArray(entry) ? entry : []);
  return uniqueText([...direct, ...lists]);
}

function materialState(composantes, materials) {
  if (!componentsHaveMaterial(composantes)) return "none";
  return Array.isArray(materials) && materials.length ? "declared" : "unknown";
}

function referenceDescription(entry) {
  return text(entry?.description ?? entry?.description_texte ?? entry?.description_reelle);
}

function upsertMeta(index, key, patch) {
  const previous = index.get(key) ?? { variants: [], aliases: [], sources: [], materials: [] };
  const seenVariants = new Set();
  const variants = [...(previous.variants ?? []), ...(patch.variants ?? [])].filter(choice => {
    const choiceKey = `${choice.id}|${choice.nom}`;
    if (seenVariants.has(choiceKey)) return false;
    seenVariants.add(choiceKey);
    return true;
  });

  index.set(key, {
    ...previous,
    ...patch,
    classSlug: patch.classSlug ?? previous.classSlug ?? key.split("|", 1)[0],
    level: Number(patch.level ?? previous.level ?? key.split("|")[1]) || 0,
    referenceName: text(patch.referenceName) || previous.referenceName || "",
    inverse: text(patch.inverse) || previous.inverse || "",
    inverseNameStatus: text(patch.inverseNameStatus) || previous.inverseNameStatus || "",
    composantes: text(patch.composantes) || previous.composantes || "",
    description: text(patch.description) || previous.description || "",
    descriptionSource: text(patch.descriptionSource) || previous.descriptionSource || "",
    materialState: patch.materialState ?? previous.materialState ?? "unknown",
    materials: patch.materials !== undefined ? clone(patch.materials) : clone(previous.materials ?? []),
    reversible: Boolean(previous.reversible || patch.reversible),
    variants,
    aliases: uniqueText([...(previous.aliases ?? []), ...(patch.aliases ?? [])]),
    sources: uniqueText([...(previous.sources ?? []), ...(patch.sources ?? [])])
  });
}

function addStructuredEntry(index, scope, name, entry, relativePath) {
  const referenceName = text(name);
  if (!referenceName) return;
  upsertMeta(index, metaKey(scope.classSlug, scope.level, referenceName), {
    classSlug: scope.classSlug,
    level: scope.level,
    referenceName,
    aliases: referenceAliases(entry),
    reversible: hasReversibleMarker(entry?.reversible) || hasReversibleMarker(entry),
    inverse: inverseName(entry),
    inverseNameStatus: text(entry?.inverseNameStatus),
    variants: normaliseChoices(entry?.variant ?? entry?.variants ?? entry?.variantes),
    sources: [relativePath]
  });
}

function readStructuredData(document, index, relativePath) {
  const inverseRoots = [document?.reversible, document?.reversibles, document?.reversibleSpells].filter(Boolean);
  const variantRoots = [document?.variant, document?.variants, document?.variantes].filter(Boolean);
  for (const root of inverseRoots) {
    for (const [lot, entries] of Object.entries(root)) {
      const scope = lotScope(lot);
      if (!scope) continue;
      if (Array.isArray(entries)) {
        for (const entry of entries) addStructuredEntry(index, scope, text(entry?.nom ?? entry?.name ?? entry?.sort ?? entry?.spell), entry, relativePath);
      } else {
        for (const [name, entry] of Object.entries(entries ?? {})) addStructuredEntry(index, scope, name, entry, relativePath);
      }
    }
  }
  for (const root of variantRoots) {
    for (const [lot, entries] of Object.entries(root)) {
      const scope = lotScope(lot);
      if (!scope) continue;
      for (const [name, entry] of Object.entries(entries ?? {})) {
        const referenceName = text(name);
        if (!referenceName) continue;
        upsertMeta(index, metaKey(scope.classSlug, scope.level, referenceName), {
          classSlug: scope.classSlug,
          level: scope.level,
          referenceName,
          variants: normaliseChoices(entry),
          sources: [relativePath]
        });
      }
    }
  }
}

function readMaterialData(document, index, relativePath) {
  const roots = [document?.materiels, document?.materials, document?.composants_materiels].filter(Boolean);
  for (const root of roots) {
    for (const [lot, entries] of Object.entries(root)) {
      const scope = lotScope(lot);
      if (!scope) continue;
      for (const [name, entry] of Object.entries(entries ?? {})) {
        const referenceName = text(name);
        if (!referenceName || !entry || typeof entry !== "object") continue;
        const materials = Array.isArray(entry.composants_materiels_objets)
          ? clone(entry.composants_materiels_objets)
          : [];
        upsertMeta(index, metaKey(scope.classSlug, scope.level, referenceName), {
          classSlug: scope.classSlug,
          level: scope.level,
          referenceName,
          aliases: referenceAliases(entry),
          composantes: text(entry.composantes),
          description: referenceDescription(entry),
          descriptionSource: text(entry.description_source),
          materials,
          materialState: materials.length || !componentsHaveMaterial(entry.composantes) ? "declared" : "unknown",
          sources: [relativePath]
        });
      }
    }
  }
}

function buildLookup(structured) {
  const lookup = new Map();
  for (const [canonicalKey, metadata] of structured) {
    for (const candidate of [metadata.referenceName, ...(metadata.aliases ?? [])].map(name => metaKey(metadata.classSlug, metadata.level, name))) {
      const previous = lookup.get(candidate);
      if (previous && previous !== canonicalKey) throw new Error(`Alias Foundry ambigu : ${candidate} cible ${previous} et ${canonicalKey}.`);
      lookup.set(candidate, canonicalKey);
    }
  }
  return lookup;
}

function loadReferences() {
  const structured = new Map();
  const files = [];
  const expectedByClass = {};
  const master = readJson(path.join(ROOT, MASTER), null);
  if (master && typeof master === "object") {
    files.push(MASTER);
    readStructuredData(master, structured, MASTER);
  }
  for (const [classSlug, levels] of Object.entries(CLASSES)) {
    for (const level of levels) {
      const relative = `audit/reference/manuel-joueurs-${classSlug}-niveau-${level}.json`;
      const document = readJson(path.join(ROOT, relative), null);
      if (!document) continue;
      files.push(relative);
      for (const reference of document.spells ?? []) {
        const name = text(reference?.nom ?? reference?.name);
        if (!name) continue;
        const referenceLevel = Number(reference?.niveau ?? reference?.level ?? level) || level;
        const materials = Array.isArray(reference?.composants_materiels_objets)
          ? clone(reference.composants_materiels_objets)
          : [];
        upsertMeta(structured, metaKey(classSlug, referenceLevel, name), {
          classSlug,
          level: referenceLevel,
          referenceName: name,
          aliases: referenceAliases(reference),
          reversible: hasReversibleMarker(reference?.reversible),
          inverse: text(reference?.inverse),
          inverseNameStatus: text(reference?.inverseNameStatus),
          variants: normaliseChoices(reference?.variant ?? reference?.variants ?? reference?.variantes),
          composantes: text(reference?.composantes),
          description: referenceDescription(reference),
          descriptionSource: text(reference?.description_source),
          materials,
          materialState: materialState(reference?.composantes, materials),
          sources: [relative]
        });
      }
    }
  }
  const materialDocument = readJson(path.join(ROOT, MATERIAL_REFERENCE), null);
  if (!materialDocument || typeof materialDocument !== "object") throw new Error(`Référence de composants introuvable ou invalide : ${MATERIAL_REFERENCE}`);
  files.push(MATERIAL_REFERENCE);
  readMaterialData(materialDocument, structured, MATERIAL_REFERENCE);

  const reversibilityDocument = readJson(path.join(ROOT, REVERSIBILITY_REFERENCE), null);
  if (!reversibilityDocument || typeof reversibilityDocument !== "object") throw new Error(`Référence de réversibilité introuvable ou invalide : ${REVERSIBILITY_REFERENCE}`);
  files.push(REVERSIBILITY_REFERENCE);
  readStructuredData(reversibilityDocument, structured, REVERSIBILITY_REFERENCE);
  if (reversibilityDocument.expectedCounts && typeof reversibilityDocument.expectedCounts === "object") Object.assign(expectedByClass, reversibilityDocument.expectedCounts);

  const declaredByClass = emptyCounts();
  for (const metadata of structured.values()) {
    if (metadata.reversible && Object.hasOwn(declaredByClass, metadata.classSlug)) declaredByClass[metadata.classSlug] += 1;
  }
  for (const classSlug of Object.keys(CLASSES)) {
    const expected = Number(expectedByClass[classSlug]);
    if (Number.isFinite(expected) && declaredByClass[classSlug] !== expected) {
      throw new Error(`Référence de réversibilité incohérente pour ${classSlug} : ${declaredByClass[classSlug]} déclaré(s), ${expected} attendu(s).`);
    }
  }
  return { structured, lookup: buildLookup(structured), files: [...new Set(files)], declaredByClass, expectedByClass };
}

function materialMode(rule) {
  const explicit = text(rule?.mode ?? rule?.forme ?? rule?.form).toLowerCase();
  if (["normal", "inverse", "shared"].includes(explicit)) return explicit;
  const source = text(`${rule?.condition ?? ""} ${rule?.notes ?? ""}`).toLowerCase();
  if (!source) return "shared";
  if (/(inverse|inversé|inversee|malédiction|maudite|destruction|déshydratation|corruption|épouvante|ténèbres|blessures|bien)/i.test(source)) return "inverse";
  if (/(normal|création|bénédiction|purification|apaisement|lumière|mal)/i.test(source)) return "normal";
  return "shared";
}

function modeMaterials(metadata, item, mode) {
  if (!componentsHaveMaterial(metadata?.composantes ?? item?.system?.composantes)) return { value: [], reference: [] };
  const all = Array.isArray(metadata?.materials) ? clone(metadata.materials) : [];
  const selected = all.filter(rule => {
    const target = materialMode(rule);
    return target === "shared" || target === mode;
  });
  if (selected.length) {
    const grouped = new Map();
    const direct = [];
    for (const rule of selected) {
      const group = text(rule?.alternativeGroup);
      if (!group) direct.push(rule);
      else {
        if (!grouped.has(group)) grouped.set(group, []);
        grouped.get(group).push(rule);
      }
    }
    return { value: [...direct, ...[...grouped.values()].map(alternatives => ({ alternatives }))], reference: selected };
  }
  return {
    value: clone(item?.system?.composants_materiels ?? []),
    reference: clone(item?.system?.composants_materiels_objets ?? [])
  };
}

function actorMode(metadata, item, id, name) {
  const materials = modeMaterials(metadata, item, id);
  const composantes = text(metadata?.composantes) || text(item?.system?.composantes);
  const overrides = {
    composants_materiels: materials.value,
    composants_materiels_objets: materials.reference,
    composantes
  };
  if (!componentsHaveMaterial(composantes)) overrides.composants_requis = [];
  return {
    id,
    actorItemName: name,
    manualName: name,
    copySourceItem: true,
    systemOverrides: overrides,
    materialReference: materials.reference
  };
}

function ownsFlag(value) {
  return Boolean(value && typeof value === "object" && value.managedBy === MANAGED_BY);
}

function cleanEmptyFlagContainers(item) {
  const add2e = item?.flags?.add2e;
  if (add2e && typeof add2e === "object" && !Array.isArray(add2e) && !Object.keys(add2e).length) delete item.flags.add2e;
  if (item?.flags && typeof item.flags === "object" && !Array.isArray(item.flags) && !Object.keys(item.flags).length) delete item.flags;
}

function profileEntry(metadata, item, itemName, classSlug, level) {
  const normalName = text(metadata.referenceName) || itemName;
  const modes = [actorMode(metadata, item, "normal", normalName)];
  const profile = {
    class: classSlug,
    level,
    referenceName: normalName,
    foundryItemName: itemName,
    referenceFiles: metadata.sources,
    reversible: true,
    inverseNameStatus: metadata.inverseNameStatus || (metadata.inverse ? "manual_explicit" : "not_named_in_manual"),
    modes
  };
  if (metadata.inverse) {
    modes.push(actorMode(metadata, item, "inverse", metadata.inverse));
    profile.splitOnActorGrant = true;
  } else {
    profile.splitOnActorGrant = false;
    profile.inverse = { name: null, inverseNameStatus: profile.inverseNameStatus, requiresManualNaming: true };
  }
  return profile;
}

function referenceSummary(metadata) {
  return {
    class: metadata.classSlug,
    level: metadata.level,
    name: metadata.referenceName,
    aliases: metadata.aliases,
    inverse: metadata.inverse || null,
    inverseNameStatus: metadata.inverseNameStatus || null,
    referenceFiles: metadata.sources
  };
}

function itemMatches(references, item) {
  const itemName = text(item?.name ?? item?.system?.nom);
  const level = itemLevel(item);
  const primaryClass = slug(item?.system?.classe);
  const primaryKey = primaryClass ? references.lookup.get(metaKey(primaryClass, level, itemName)) : null;
  if (primaryKey) return [{ classSlug: primaryClass, canonicalKey: primaryKey, metadata: references.structured.get(primaryKey) }];
  const matches = [];
  for (const classSlug of itemClasses(item)) {
    const canonicalKey = references.lookup.get(metaKey(classSlug, level, itemName));
    const metadata = canonicalKey ? references.structured.get(canonicalKey) : null;
    if (metadata) matches.push({ classSlug, canonicalKey, metadata });
  }
  return matches;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function applyDescription(item, metadata) {
  const description = text(metadata?.description);
  if (!description) return false;
  item.system ??= {};
  const values = {
    description,
    description_texte: description,
    description_reelle: description,
    description_html: `<p>${escapeHtml(description)}</p>`
  };
  if (text(metadata?.descriptionSource)) values.description_source = text(metadata.descriptionSource);
  let changed = false;
  for (const [field, value] of Object.entries(values)) {
    if (String(item.system[field] ?? "") !== value) {
      item.system[field] = value;
      changed = true;
    }
  }
  return changed;
}

function applyReferenceMechanicalFields(items, references) {
  const result = {
    updated: 0,
    noMaterialCleared: 0,
    structuredMaterialsApplied: 0,
    descriptionsApplied: 0,
    missingMaterialReferences: [],
    conflicts: []
  };
  for (const item of items) {
    if (!isSpell(item)) continue;
    const matches = itemMatches(references, item);
    if (!matches.length) continue;
    const signature = entry => JSON.stringify({
      composantes: entry.metadata.composantes,
      materialState: entry.metadata.materialState,
      materials: entry.metadata.materials,
      description: entry.metadata.description,
      descriptionSource: entry.metadata.descriptionSource
    });
    if (new Set(matches.map(signature)).size > 1) {
      result.conflicts.push({ name: item.name, level: itemLevel(item), matches: matches.map(entry => referenceSummary(entry.metadata)) });
      continue;
    }
    const metadata = matches[0].metadata;
    const composantes = text(metadata.composantes);
    const descriptionChanged = applyDescription(item, metadata);
    if (descriptionChanged) result.descriptionsApplied += 1;
    if (!composantes) {
      if (descriptionChanged) result.updated += 1;
      continue;
    }
    item.system ??= {};
    let changed = descriptionChanged;
    if (item.system.composantes !== composantes) {
      item.system.composantes = composantes;
      changed = true;
    }
    if (!componentsHaveMaterial(composantes)) {
      for (const field of ["composants_materiels", "composants_materiels_objets", "composants_requis"]) {
        if (!Array.isArray(item.system[field]) || item.system[field].length) {
          item.system[field] = [];
          changed = true;
        }
      }
      if (changed) result.noMaterialCleared += 1;
    } else if (metadata.materialState === "declared" && Array.isArray(metadata.materials) && metadata.materials.length) {
      const materials = clone(metadata.materials);
      if (JSON.stringify(item.system.composants_materiels) !== JSON.stringify(materials)) {
        item.system.composants_materiels = materials;
        changed = true;
      }
      if (JSON.stringify(item.system.composants_materiels_objets) !== JSON.stringify(materials)) {
        item.system.composants_materiels_objets = clone(materials);
        changed = true;
      }
      if (changed) result.structuredMaterialsApplied += 1;
    } else if (metadata.materialState === "unknown") {
      result.missingMaterialReferences.push(referenceSummary(metadata));
    }
    if (changed) result.updated += 1;
  }
  result.missingMaterialReferences = result.missingMaterialReferences.filter((entry, index, list) =>
    list.findIndex(other => `${other.class}|${other.level}|${other.name}` === `${entry.class}|${entry.level}|${entry.name}`) === index
  );
  return result;
}

function applyReferenceFlags(items, references) {
  const actorSplitByClass = emptyCounts();
  const reversibleMatchedByClass = emptyCounts();
  const unnamedInverseByClass = emptyCounts();
  const variantMatchedByClass = emptyCounts();
  const reversibleProfiles = [];
  const variantProfiles = [];
  const unresolvedReversible = [];
  const matchedReversibleKeys = new Set();
  const matchedVariantKeys = new Set();
  for (const item of items) {
    if (!isSpell(item)) continue;
    const itemName = text(item?.name ?? item?.system?.nom);
    const level = itemLevel(item);
    const reversible = [];
    const variants = [];
    for (const { classSlug, canonicalKey, metadata } of itemMatches(references, item)) {
      if (metadata.variants.length) {
        const profile = { class: classSlug, level, referenceName: metadata.referenceName, foundryItemName: itemName, referenceFiles: metadata.sources, choices: clone(metadata.variants) };
        variants.push(profile);
        variantProfiles.push({ name: itemName, ...clone(profile) });
        variantMatchedByClass[classSlug] += 1;
        matchedVariantKeys.add(canonicalKey);
      }
      if (!metadata.reversible) continue;
      const profile = profileEntry(metadata, item, itemName, classSlug, level);
      reversible.push(profile);
      reversibleProfiles.push({ name: itemName, ...clone(profile) });
      reversibleMatchedByClass[classSlug] += 1;
      matchedReversibleKeys.add(canonicalKey);
      if (metadata.inverse) actorSplitByClass[classSlug] += 1;
      else {
        unnamedInverseByClass[classSlug] += 1;
        unresolvedReversible.push({ name: itemName, ...clone(profile) });
      }
    }
    const hasOwnedReversible = ownsFlag(item?.flags?.add2e?.reversible);
    const hasOwnedVariant = ownsFlag(item?.flags?.add2e?.variant) || ownsFlag(item?.flags?.add2e?.variants);
    if (!reversible.length && !variants.length && !hasOwnedReversible && !hasOwnedVariant) continue;
    item.flags ??= {};
    item.flags.add2e ??= {};
    if (reversible.length) {
      item.flags.add2e.reversible = { version: VERSION, managedBy: MANAGED_BY, enabled: true, choiceTiming: "memorization", splitOnActorGrant: reversible.some(profile => profile.splitOnActorGrant), profiles: reversible };
    } else if (hasOwnedReversible) delete item.flags.add2e.reversible;
    if (variants.length) {
      item.flags.add2e.variant = { version: VERSION, managedBy: MANAGED_BY, profiles: variants };
      if (ownsFlag(item.flags.add2e.variants)) delete item.flags.add2e.variants;
    } else {
      if (ownsFlag(item.flags.add2e.variant)) delete item.flags.add2e.variant;
      if (ownsFlag(item.flags.add2e.variants)) delete item.flags.add2e.variants;
    }
    cleanEmptyFlagContainers(item);
  }
  const unmatchedReversibleReferences = [];
  const unmatchedVariantReferences = [];
  for (const [canonicalKey, metadata] of references.structured) {
    if (metadata.reversible && !matchedReversibleKeys.has(canonicalKey)) unmatchedReversibleReferences.push(referenceSummary(metadata));
    if (metadata.variants.length && !matchedVariantKeys.has(canonicalKey)) unmatchedVariantReferences.push({ ...referenceSummary(metadata), choices: clone(metadata.variants) });
  }
  return {
    actorSplitByClass,
    reversibleMatchedByClass,
    unnamedInverseByClass,
    variantMatchedByClass,
    reversibleProfiles,
    variantProfiles,
    unresolvedReversible,
    unmatchedReversibleReferences,
    unmatchedVariantReferences
  };
}

function indexItems(items, label) {
  const index = new Map();
  const duplicates = [];
  for (const item of items) {
    const key = itemKey(item);
    if (index.has(key)) duplicates.push(key);
    index.set(key, item);
  }
  if (duplicates.length) throw new Error(`${label} contient des clés d’items dupliquées : ${duplicates.slice(0, 10).join(", ")}.`);
  return index;
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableValue(value[key])]));
  return value;
}

function sameJson(left, right) {
  return JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right));
}

function stripManagedSpellData(item) {
  const stripped = clone(item);
  const add2e = stripped?.flags?.add2e;
  if (add2e && typeof add2e === "object" && !Array.isArray(add2e)) {
    if (ownsFlag(add2e.reversible)) delete add2e.reversible;
    if (ownsFlag(add2e.variant)) delete add2e.variant;
    if (ownsFlag(add2e.variants)) delete add2e.variants;
  }
  if (isSpell(stripped)) {
    for (const field of [
      "composantes",
      "composants_materiels",
      "composants_materiels_objets",
      "composants_requis",
      "description",
      "description_texte",
      "description_reelle",
      "description_html",
      "description_source"
    ]) delete stripped.system?.[field];
  }
  cleanEmptyFlagContainers(stripped);
  return stripped;
}

function comparableDocument(document) {
  const comparable = clone(document);
  delete comparable.normalizedBy;
  delete comparable.normalizedAt;
  return setItems(comparable, getItems(comparable).map(stripManagedSpellData));
}

function assertNoRegression(before, after) {
  const beforeItems = getItems(before);
  const afterItems = getItems(after);
  if (beforeItems.length !== afterItems.length) throw new Error(`Régression bloquée : ${beforeItems.length} item(s) avant, ${afterItems.length} item(s) après.`);
  const beforeIndex = indexItems(beforeItems, "Le JSON V3 validé avant normalisation");
  const afterIndex = indexItems(afterItems, "Le JSON V3 après normalisation");
  const missing = [...beforeIndex.keys()].filter(key => !afterIndex.has(key));
  const added = [...afterIndex.keys()].filter(key => !beforeIndex.has(key));
  if (missing.length || added.length) {
    throw new Error(`Régression bloquée : le jeu d’items a changé.${missing.length ? ` Supprimés: ${missing.slice(0, 8).join(", ")}.` : ""}${added.length ? ` Ajoutés: ${added.slice(0, 8).join(", ")}.` : ""}`);
  }
  if (!sameJson(comparableDocument(before), comparableDocument(after))) {
    throw new Error("Régression bloquée : le normalisateur a modifié des données hors composants de sort, descriptions référencées, flags add2e réversible/variante ou métadonnées normalizedBy/normalizedAt.");
  }
}

function main() {
  const input = path.join(ROOT, process.argv[2] || INPUT);
  const output = path.join(ROOT, process.argv[3] || OUTPUT);
  const controlFile = path.join(ROOT, process.argv[4] || CONTROL);
  const source = readJson(input);
  if (!source) throw new Error(`Fichier source introuvable ou invalide : ${input}`);
  if (!fs.existsSync(output)) throw new Error(`JSON V3 validé introuvable : ${output}.`);
  const previous = readJson(output);
  if (!previous) throw new Error(`JSON V3 validé invalide : ${output}`);

  const sourceItems = getItems(source);
  const previousItems = getItems(previous);
  const sourceSpellCount = sourceItems.filter(isSpell).length;
  const previousSpellCount = previousItems.filter(isSpell).length;
  const sourceKeys = new Set(sourceItems.map(itemKey));
  const v3OnlyItemsPreserved = previousItems.filter(item => !sourceKeys.has(itemKey(item))).map(item => ({ name: item.name, classe: item.system?.classe, niveau: item.system?.niveau }));

  const items = previousItems.map(item => clone(item));
  const references = loadReferences();
  const mechanics = applyReferenceMechanicalFields(items, references);
  const flags = applyReferenceFlags(items, references);
  const result = setItems(clone(previous), items);
  result.normalizedBy = VERSION;
  result.normalizedAt = new Date().toISOString();
  assertNoRegression(previous, result);

  const control = readJson(controlFile, {}) ?? {};
  control.version = VERSION;
  control.input = path.relative(ROOT, input);
  control.output = path.relative(ROOT, output);
  control.totalItems = items.length;
  control.sourceSpellCount = sourceSpellCount;
  control.outputSpellCount = items.filter(isSpell).length;
  control.sourceSpellCountExpected = 411;
  control.sourceSpellCountInvariant = sourceSpellCount === 411;
  control.v3SpellCountBaseline = previousSpellCount;
  control.v3OnlyItemsPreserved = v3OnlyItemsPreserved;
  control.ignoredAuditOnlyItems = [];
  control.nonRegression = {
    status: "passed",
    validatedBaseline: path.relative(ROOT, output),
    allowedItemPaths: [
      "system.composantes",
      "system.composants_materiels",
      "system.composants_materiels_objets",
      "system.composants_requis",
      "system.description",
      "system.description_texte",
      "system.description_reelle",
      "system.description_html",
      "system.description_source",
      "flags.add2e.reversible",
      "flags.add2e.variant",
      "flags.add2e.variants"
    ],
    allowedDocumentPaths: ["normalizedBy", "normalizedAt"],
    itemCountBefore: previousItems.length,
    itemCountAfter: items.length
  };
  control.materialMechanics = mechanics;
  control.reversibleActorSplit = {
    version: VERSION,
    referenceFiles: references.files,
    expectedByClass: references.expectedByClass,
    declaredByClass: references.declaredByClass,
    matchedByClass: flags.reversibleMatchedByClass,
    actorSplitByClass: flags.actorSplitByClass,
    unnamedInverseByClass: flags.unnamedInverseByClass,
    profiles: flags.reversibleProfiles,
    unresolvedStructuredReversible: flags.unresolvedReversible,
    unmatchedReferences: flags.unmatchedReversibleReferences
  };
  control.variantProfiles = flags.variantProfiles;
  control.variantChoiceCount = flags.variantProfiles.reduce((total, profile) => total + profile.choices.length, 0);
  control.variantReferenceCoverage = { matchedByClass: flags.variantMatchedByClass, unmatchedReferences: flags.unmatchedVariantReferences };

  writeJson(output, result);
  writeJson(controlFile, control);
  console.log(`[ADD2E][SPELL_MATERIALS_V3] ${control.outputSpellCount} sort(s) V3 conservé(s) comme base.`);
  console.log(`[ADD2E][SPELL_MATERIALS_V3] Composantes appliquées: ${mechanics.updated}; sans M vidés: ${mechanics.noMaterialCleared}; références matérielles structurées: ${mechanics.structuredMaterialsApplied}; descriptions référencées: ${mechanics.descriptionsApplied}.`);
  console.log(`[ADD2E][SPELL_MATERIALS_V3] Réversibles déclarés — clerc: ${references.declaredByClass.clerc}, druide: ${references.declaredByClass.druide}, magicien: ${references.declaredByClass.magicien}, illusionniste: ${references.declaredByClass.illusionniste}.`);
  console.log(`[ADD2E][SPELL_MATERIALS_V3] Réversibles appariés — clerc: ${flags.reversibleMatchedByClass.clerc}, druide: ${flags.reversibleMatchedByClass.druide}, magicien: ${flags.reversibleMatchedByClass.magicien}, illusionniste: ${flags.reversibleMatchedByClass.illusionniste}.`);
  console.log(`[ADD2E][SPELL_MATERIALS_V3] Variantes structurées: ${flags.variantProfiles.length} sort(s) / ${control.variantChoiceCount} choix.`);
  console.log(`[ADD2E][SPELL_MATERIALS_V3] Contrôle de non-régression: OK.`);
}

main();
