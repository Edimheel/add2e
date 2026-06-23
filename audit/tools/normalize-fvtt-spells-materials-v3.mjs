import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const VERSION = "2026-06-23-compendium-equipements-materials-v7";
const MANAGED_BY = "normalize-fvtt-spells-materials-v3";
const INPUT = "fvtt-spells-all-normalise-mecanique-v1.json";
const OUTPUT = "fvtt-spells-all-normalise-mecanique-v3.json";
const CONTROL = "fvtt-spells-all-normalise-mecanique-v3-controle.json";
const MASTER = "audit/reference/manuel-joueurs-sorts-master.json";
const REVERSIBILITY_REFERENCE = "audit/reference/manuel-joueurs-reversibilite.json";
const MATERIAL_REFERENCE = "audit/reference/manuel-joueurs-composants-materiels.json";
const EQUIPMENT_COMPENDIUM = "compendium_equiepents.json";
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
const asArray = value => Array.isArray(value) ? value : value == null || value === "" ? [] : [value];
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
  return String(item?.type ?? item?.system?.type ?? "").toLowerCase() === "sort";
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
  return match ? { classSlug: match[1].toLowerCase(), level: Number(match[2]) } : null;
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

function materialNameAndQuantity(value, fallbackQuantity = 1) {
  const original = text(value);
  let name = original;
  let quantity = Math.max(1, Math.floor(Number(fallbackQuantity) || 1));
  let conventional = false;

  const explicit = name.match(/^(\d+)\s*(?:[x×]\s*)?(.+)$/i);
  if (explicit) {
    quantity = Math.max(1, Number(explicit[1]) || 1);
    name = text(explicit[2]);
  } else {
    const before = name;
    name = name
      .replace(/^(?:un|une)\s+peu\s+de\s+/i, "")
      .replace(/^(?:quelques|plusieurs)\s+/i, "")
      .replace(/^(?:petit\s+)?morceau\s+de\s+/i, "")
      .replace(/^poign(?:e|é)e\s+de\s+/i, "")
      .replace(/^(?:un|une|du|de la|de l['’]?|des|le|la|les)\s+/i, "");
    conventional = text(before) !== text(name);
  }

  name = name.replace(/[.!?;:]+$/g, "").trim();
  return {
    nom: name,
    quantite: quantity,
    original,
    convention: conventional && !explicit
  };
}

function consumptionIsNonConsumed(value) {
  const raw = text(value).toLowerCase();
  return ["non_consomme", "non consommé", "non consomme", "non_consumed", "nonconsumed", "focus"].includes(raw);
}

function normaliseConsumption(value, fallback = "consomme") {
  return consumptionIsNonConsumed(value) ? "non_consomme" : text(value) || fallback;
}

function normaliseMaterialRule(raw) {
  if (raw == null || raw === "") return null;
  if (typeof raw === "string") {
    const alternatives = String(raw).replace(/[()\[\]{}]/g, " ").split(/\bou\b/gi).map(text).filter(Boolean);
    if (alternatives.length > 1) {
      const values = alternatives.map(normaliseMaterialRule).filter(Boolean);
      return values.length ? { alternatives: values } : null;
    }
    const info = materialNameAndQuantity(raw, 1);
    if (!info.nom) return null;
    const rule = { nom: info.nom, quantite: info.quantite, consommation: "consomme" };
    if (info.nom !== info.original) rule.notes = `Texte du Manuel : ${info.original}.`;
    if (info.convention) rule.notes = `Quantité conventionnelle ADD2E : 1. ${rule.notes}`;
    return rule;
  }
  if (typeof raw !== "object" || Array.isArray(raw)) return null;

  const alternatives = raw.alternatives ?? raw.options ?? raw.choix ?? raw.auChoix ?? raw.or;
  if (Array.isArray(alternatives) && alternatives.length) {
    const rule = clone(raw);
    rule.alternatives = alternatives.map(normaliseMaterialRule).filter(Boolean);
    delete rule.options;
    delete rule.choix;
    delete rule.auChoix;
    delete rule.or;
    return rule.alternatives.length ? rule : null;
  }

  const sourceName = raw.nom ?? raw.name ?? raw.label ?? raw.item ?? raw.itemName ?? raw.component ?? raw.composant ?? raw.slug;
  if (!text(sourceName)) return clone(raw);
  const explicitQuantity = raw.quantite ?? raw.quantity ?? raw.qty ?? raw.nombre ?? raw.count ?? 1;
  const info = materialNameAndQuantity(sourceName, explicitQuantity);
  if (!info.nom) return null;

  const rule = clone(raw);
  rule.nom = info.nom;
  rule.quantite = info.quantite;
  delete rule.name;
  delete rule.label;
  delete rule.item;
  delete rule.itemName;
  delete rule.component;
  delete rule.composant;
  delete rule.slug;
  delete rule.quantity;
  delete rule.qty;
  delete rule.nombre;
  delete rule.count;
  if (!rule.consommation && raw.consomme !== false && raw.consume !== false) rule.consommation = "consomme";
  if (raw.consomme === false || raw.consume === false || consumptionIsNonConsumed(raw.consommation ?? raw.consumption)) rule.consommation = "non_consomme";
  if (info.nom !== info.original) {
    const note = `Texte du Manuel : ${info.original}.`;
    const convention = info.convention ? " Quantité conventionnelle ADD2E : 1." : "";
    rule.notes = uniqueText([text(rule.notes), `${note}${convention}`]).join(" ");
  }
  delete rule.consomme;
  delete rule.consume;
  return rule;
}

function normaliseMaterialRules(value) {
  const out = [];
  for (const raw of asArray(value)) {
    if (Array.isArray(raw)) out.push(...normaliseMaterialRules(raw));
    else {
      const rule = normaliseMaterialRule(raw);
      if (rule) out.push(rule);
    }
  }
  return out;
}

function flattenMaterialRules(value, out = []) {
  for (const raw of asArray(value)) {
    if (Array.isArray(raw)) { flattenMaterialRules(raw, out); continue; }
    if (!raw || typeof raw !== "object") continue;
    if (Array.isArray(raw.alternatives)) { flattenMaterialRules(raw.alternatives, out); continue; }
    if (text(raw.nom)) out.push(raw);
  }
  return out;
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
  const inverseMode = (Array.isArray(value.modes) ? value.modes : []).find(mode => String(mode?.id ?? "").toLowerCase() === "inverse");
  return text(inverseMode?.nom ?? inverseMode?.name ?? inverseMode?.actorItemName);
}

function hasReversibleMarker(value) {
  if (value === true) return true;
  if (typeof value === "string" && text(value)) return true;
  return Boolean(value && typeof value === "object");
}

function referenceAliases(value) {
  const direct = [value?.foundryName, value?.foundryNom, value?.foundry?.name, value?.foundry?.nom];
  const lists = [value?.foundryNames, value?.foundryNoms, value?.foundry?.names, value?.foundry?.noms].flatMap(entry => Array.isArray(entry) ? entry : []);
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
    const candidate = `${choice.id}|${choice.nom}`;
    if (seenVariants.has(candidate)) return false;
    seenVariants.add(candidate);
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
    materials: patch.materials !== undefined ? normaliseMaterialRules(patch.materials) : normaliseMaterialRules(previous.materials ?? []),
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
  for (const root of [document?.reversible, document?.reversibles, document?.reversibleSpells].filter(Boolean)) {
    for (const [lot, entries] of Object.entries(root)) {
      const scope = lotScope(lot);
      if (!scope) continue;
      if (Array.isArray(entries)) for (const entry of entries) addStructuredEntry(index, scope, text(entry?.nom ?? entry?.name ?? entry?.sort ?? entry?.spell), entry, relativePath);
      else for (const [name, entry] of Object.entries(entries ?? {})) addStructuredEntry(index, scope, name, entry, relativePath);
    }
  }
  for (const root of [document?.variant, document?.variants, document?.variantes].filter(Boolean)) {
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
  for (const root of [document?.materiels, document?.materials, document?.composants_materiels].filter(Boolean)) {
    for (const [lot, entries] of Object.entries(root)) {
      const scope = lotScope(lot);
      if (!scope) continue;
      for (const [name, entry] of Object.entries(entries ?? {})) {
        if (!entry || typeof entry !== "object") continue;
        const referenceName = text(name);
        if (!referenceName) continue;
        const materials = normaliseMaterialRules(entry.composants_materiels_objets ?? entry.composants_materiels ?? []);
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
    for (const name of [metadata.referenceName, ...(metadata.aliases ?? [])]) {
      const candidate = metaKey(metadata.classSlug, metadata.level, name);
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
  if (master && typeof master === "object") { files.push(MASTER); readStructuredData(master, structured, MASTER); }

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
        const materials = normaliseMaterialRules(reference?.composants_materiels_objets ?? reference?.composants_materiels ?? []);
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
  for (const metadata of structured.values()) if (metadata.reversible && Object.hasOwn(declaredByClass, metadata.classSlug)) declaredByClass[metadata.classSlug] += 1;
  for (const classSlug of Object.keys(CLASSES)) {
    const expected = Number(expectedByClass[classSlug]);
    if (Number.isFinite(expected) && declaredByClass[classSlug] !== expected) throw new Error(`Référence de réversibilité incohérente pour ${classSlug} : ${declaredByClass[classSlug]} déclaré(s), ${expected} attendu(s).`);
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
  const declared = normaliseMaterialRules(metadata?.materials ?? []);
  const fallback = normaliseMaterialRules(item?.system?.composants_materiels_objets?.length ? item.system.composants_materiels_objets : item?.system?.composants_materiels ?? []);
  const all = declared.length ? declared : fallback;
  const selected = all.filter(rule => {
    const target = materialMode(rule);
    return target === "shared" || target === mode;
  });
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

function actorMode(metadata, item, id, name) {
  const materials = modeMaterials(metadata, item, id);
  const composantes = text(metadata?.composantes) || text(item?.system?.composantes);
  const systemOverrides = { composants_materiels: materials.value, composants_materiels_objets: materials.reference, composantes };
  if (!componentsHaveMaterial(composantes)) systemOverrides.composants_requis = [];
  return { id, actorItemName: name, manualName: name, copySourceItem: true, systemOverrides, materialReference: materials.reference };
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
  return { class: metadata.classSlug, level: metadata.level, name: metadata.referenceName, aliases: metadata.aliases, inverse: metadata.inverse || null, inverseNameStatus: metadata.inverseNameStatus || null, referenceFiles: metadata.sources };
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
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function applyDescription(item, metadata) {
  const description = text(metadata?.description);
  if (!description) return false;
  item.system ??= {};
  const values = { description, description_texte: description, description_reelle: description, description_html: `<p>${escapeHtml(description)}</p>` };
  if (text(metadata?.descriptionSource)) values.description_source = text(metadata.descriptionSource);
  let changed = false;
  for (const [field, value] of Object.entries(values)) {
    if (String(item.system[field] ?? "") !== value) { item.system[field] = value; changed = true; }
  }
  return changed;
}

function applyMaterialFields(item, materials) {
  item.system ??= {};
  let changed = false;
  for (const field of ["composants_materiels", "composants_materiels_objets"]) {
    if (JSON.stringify(item.system[field] ?? []) !== JSON.stringify(materials)) { item.system[field] = clone(materials); changed = true; }
  }
  return changed;
}

function normaliseExistingSpellMaterialFields(items) {
  let updated = 0;
  for (const item of items) {
    if (!isSpell(item)) continue;
    item.system ??= {};
    const raw = Array.isArray(item.system.composants_materiels_objets) && item.system.composants_materiels_objets.length
      ? item.system.composants_materiels_objets
      : item.system.composants_materiels;
    const materials = normaliseMaterialRules(raw ?? []);
    if (!materials.length) continue;
    if (applyMaterialFields(item, materials)) updated += 1;
  }
  return updated;
}

function applyReferenceMechanicalFields(items, references) {
  const result = { updated: 0, noMaterialCleared: 0, structuredMaterialsApplied: 0, fallbackTextMaterialsNormalized: 0, descriptionsApplied: 0, missingMaterialReferences: [], conflicts: [] };
  for (const item of items) {
    if (!isSpell(item)) continue;
    const matches = itemMatches(references, item);
    if (!matches.length) continue;
    const signature = entry => JSON.stringify({ composantes: entry.metadata.composantes, materialState: entry.metadata.materialState, materials: entry.metadata.materials, description: entry.metadata.description, descriptionSource: entry.metadata.descriptionSource });
    if (new Set(matches.map(signature)).size > 1) { result.conflicts.push({ name: item.name, level: itemLevel(item), matches: matches.map(entry => referenceSummary(entry.metadata)) }); continue; }

    const metadata = matches[0].metadata;
    const composantes = text(metadata.composantes);
    let changed = applyDescription(item, metadata);
    if (changed) result.descriptionsApplied += 1;
    if (!composantes) { if (changed) result.updated += 1; continue; }
    item.system ??= {};
    if (item.system.composantes !== composantes) { item.system.composantes = composantes; changed = true; }
    if (!componentsHaveMaterial(composantes)) {
      for (const field of ["composants_materiels", "composants_materiels_objets", "composants_requis"]) {
        if (!Array.isArray(item.system[field]) || item.system[field].length) { item.system[field] = []; changed = true; }
      }
      if (changed) result.noMaterialCleared += 1;
    } else {
      const declared = normaliseMaterialRules(metadata.materials ?? []);
      const fallbackRaw = item.system.composants_materiels_objets?.length ? item.system.composants_materiels_objets : item.system.composants_materiels;
      const fallback = normaliseMaterialRules(fallbackRaw ?? []);
      const materials = declared.length ? declared : fallback;
      if (materials.length) {
        if (applyMaterialFields(item, materials)) changed = true;
        if (declared.length) result.structuredMaterialsApplied += 1;
        else result.fallbackTextMaterialsNormalized += 1;
      } else if (metadata.materialState === "unknown") {
        result.missingMaterialReferences.push(referenceSummary(metadata));
      }
    }
    if (changed) result.updated += 1;
  }
  result.missingMaterialReferences = result.missingMaterialReferences.filter((entry, index, list) => list.findIndex(other => `${other.class}|${other.level}|${other.name}` === `${entry.class}|${entry.level}|${entry.name}`) === index);
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
      else { unnamedInverseByClass[classSlug] += 1; unresolvedReversible.push({ name: itemName, ...clone(profile) }); }
    }
    const hasOwnedReversible = ownsFlag(item?.flags?.add2e?.reversible);
    const hasOwnedVariant = ownsFlag(item?.flags?.add2e?.variant) || ownsFlag(item?.flags?.add2e?.variants);
    if (!reversible.length && !variants.length && !hasOwnedReversible && !hasOwnedVariant) continue;
    item.flags ??= {};
    item.flags.add2e ??= {};
    if (reversible.length) item.flags.add2e.reversible = { version: VERSION, managedBy: MANAGED_BY, enabled: true, choiceTiming: "memorization", splitOnActorGrant: reversible.some(profile => profile.splitOnActorGrant), profiles: reversible };
    else if (hasOwnedReversible) delete item.flags.add2e.reversible;
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
  return { actorSplitByClass, reversibleMatchedByClass, unnamedInverseByClass, variantMatchedByClass, reversibleProfiles, variantProfiles, unresolvedReversible, unmatchedReversibleReferences, unmatchedVariantReferences };
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
  if (isSpell(stripped)) for (const field of ["composantes", "composants_materiels", "composants_materiels_objets", "composants_requis", "description", "description_texte", "description_reelle", "description_html", "description_source"]) delete stripped.system?.[field];
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
  if (missing.length || added.length) throw new Error(`Régression bloquée : le jeu d’items a changé.${missing.length ? ` Supprimés: ${missing.slice(0, 8).join(", ")}.` : ""}${added.length ? ` Ajoutés: ${added.slice(0, 8).join(", ")}.` : ""}`);
  if (!sameJson(comparableDocument(before), comparableDocument(after))) throw new Error("Régression bloquée : le normalisateur a modifié des données hors composants de sort, descriptions référencées, flags add2e réversible/variante ou métadonnées normalizedBy/normalizedAt.");
}

function componentCompendiumItem(item) {
  const system = item?.system ?? {};
  const tags = [...asArray(system.tags), ...asArray(system.effectTags), ...asArray(item?.flags?.add2e?.tags)].map(slug);
  return slug(system.categorie ?? system.category) === "composant_sort" || slug(system.sousType ?? system.sous_type) === "composant" || tags.includes("composant_sort") || tags.some(tag => tag.startsWith("composant_"));
}

function spellClassName(spell) {
  const system = spell?.system ?? {};
  if (text(system.classe)) return text(system.classe);
  if (Array.isArray(system.spellLists) && system.spellLists.length) return text(system.spellLists[0]);
  return "";
}

function ruleCondition(rule, inherited = "") {
  return text(rule?.condition ?? rule?.conditions ?? rule?.sourceCondition ?? inherited) || null;
}

function ruleConsumption(rule, inherited = "consomme") {
  return normaliseConsumption(rule?.consommation ?? rule?.consumption ?? rule?.consume ?? inherited, inherited || "consomme");
}

function collectComponentUsage(value, spell, inherited = {}, out = []) {
  for (const raw of asArray(value)) {
    if (Array.isArray(raw)) {
      collectComponentUsage(raw, spell, inherited, out);
      continue;
    }
    if (!raw) continue;
    if (typeof raw === "string") {
      const info = materialNameAndQuantity(raw, 1);
      if (!info.nom) continue;
      out.push({
        key: slug(info.nom),
        detail: {
          nom: text(spell?.name ?? spell?.system?.nom),
          id: text(spell?._id ?? spell?.id),
          classe: spellClassName(spell),
          niveau: itemLevel(spell),
          quantite: info.quantite,
          consommation: ruleConsumption({}, inherited.consommation),
          condition: text(inherited.condition) || null
        }
      });
      continue;
    }
    if (typeof raw !== "object") continue;

    const next = {
      consommation: ruleConsumption(raw, inherited.consommation),
      condition: ruleCondition(raw, inherited.condition)
    };
    const alternatives = raw.alternatives ?? raw.options ?? raw.choix ?? raw.auChoix ?? raw.or;
    if (Array.isArray(alternatives) && alternatives.length) {
      collectComponentUsage(alternatives, spell, next, out);
      continue;
    }

    const rawName = raw.nom ?? raw.name ?? raw.label ?? raw.item ?? raw.itemName ?? raw.component ?? raw.composant ?? raw.slug;
    const rawQuantity = raw.quantite ?? raw.quantity ?? raw.qty ?? raw.nombre ?? raw.count ?? 1;
    const info = materialNameAndQuantity(rawName, rawQuantity);
    if (!info.nom) continue;
    out.push({
      key: slug(info.nom),
      detail: {
        nom: text(spell?.name ?? spell?.system?.nom),
        id: text(spell?._id ?? spell?.id),
        classe: spellClassName(spell),
        niveau: itemLevel(spell),
        quantite: info.quantite,
        consommation: next.consommation,
        condition: next.condition
      }
    });
  }
  return out;
}

function componentUsageIndex(spells) {
  const index = new Map();
  for (const spell of spells) {
    if (!isSpell(spell)) continue;
    const source = Array.isArray(spell?.system?.composants_materiels_objets) && spell.system.composants_materiels_objets.length
      ? spell.system.composants_materiels_objets
      : spell?.system?.composants_materiels;
    for (const usage of collectComponentUsage(source, spell)) {
      if (!usage.key) continue;
      if (!index.has(usage.key)) index.set(usage.key, []);
      index.get(usage.key).push(usage.detail);
    }
  }

  for (const [key, details] of index) {
    const unique = new Map();
    for (const detail of details) {
      const detailKey = [detail.id, detail.nom, detail.classe, detail.niveau, detail.quantite, detail.consommation, detail.condition ?? ""].join("|");
      unique.set(detailKey, detail);
    }
    index.set(key, [...unique.values()].sort((left, right) =>
      String(left.nom).localeCompare(String(right.nom), "fr") ||
      Number(left.niveau) - Number(right.niveau) ||
      String(left.condition ?? "").localeCompare(String(right.condition ?? ""), "fr")
    ));
  }
  return index;
}

function preserveComponentTags(values, test) {
  return asArray(values).map(value => String(value ?? "").trim()).filter(value => value && !test(value));
}

function componentTags(existing, componentSlug) {
  const retained = preserveComponentTags(existing, value =>
    ["objet", "categorie:composant_sort", "sous_type:composant", "composant_sort", "consommable"].includes(value) ||
    /^objet:/i.test(value) ||
    /^composant:/i.test(value)
  );
  return uniqueText([
    "objet",
    "categorie:composant_sort",
    "sous_type:composant",
    `objet:${componentSlug}`,
    "composant_sort",
    `composant:${componentSlug}`,
    "consommable",
    ...retained
  ]);
}

function componentEffectTags(existing, componentSlug) {
  const retained = preserveComponentTags(existing, value =>
    ["objet", "categorie_composant_sort", "sous_type_composant", "composant_sort", "consommable"].includes(value) ||
    /^objet_/i.test(value) ||
    /^composant_/i.test(value)
  );
  return uniqueText([
    "objet",
    "categorie_composant_sort",
    "sous_type_composant",
    `objet_${componentSlug}`,
    "composant_sort",
    `composant_${componentSlug}`,
    "consommable",
    ...retained
  ]);
}

function syncEquipmentComponentAssociations(spells) {
  const sourceFile = path.join(ROOT, EQUIPMENT_COMPENDIUM);
  const document = readJson(sourceFile, null);
  if (!document) return { file: EQUIPMENT_COMPENDIUM, updated: 0, missing: true };

  const usages = componentUsageIndex(spells);
  let updated = 0;
  for (const item of getItems(document)) {
    if (!componentCompendiumItem(item)) continue;
    item.system ??= {};
    item.flags ??= {};
    item.flags.add2e ??= {};

    const info = materialNameAndQuantity(item.system.nom ?? item.name, 1);
    const componentName = info.nom;
    const componentSlug = slug(componentName);
    if (!componentName || !componentSlug) continue;

    const details = clone(usages.get(componentSlug) ?? []);
    const spellNames = uniqueText(details.map(detail => detail.nom)).sort((left, right) => left.localeCompare(right, "fr"));
    const consumptions = uniqueText(details.map(detail => detail.consommation)).sort((left, right) => left.localeCompare(right, "fr"));
    const conditions = uniqueText(details.map(detail => detail.condition)).sort((left, right) => left.localeCompare(right, "fr"));
    const expectedDescription = `Composant de sort : ${componentName}.`;
    let changed = false;

    const assign = (path, value) => {
      const current = path.split(".").reduce((target, key) => target?.[key], item);
      if (JSON.stringify(current) === JSON.stringify(value)) return;
      let target = item;
      const keys = path.split(".");
      for (const key of keys.slice(0, -1)) target = target[key] ??= {};
      target[keys.at(-1)] = value;
      changed = true;
    };

    assign("name", componentName);
    assign("system.nom", componentName);
    assign("system.slug", componentSlug);
    assign("flags.add2e.slug", componentSlug);
    assign("system.tags", componentTags(item.system.tags, componentSlug));
    assign("system.effectTags", componentEffectTags(item.system.effectTags, componentSlug));
    assign("system.sorts_associes", spellNames);
    assign("system.sorts_associes_details", details);
    assign("system.consommations_associees", consumptions);
    assign("system.conditions_associees", conditions);
    if (/^Composant de sort\s*:/i.test(String(item.system.description ?? ""))) assign("system.description", expectedDescription);
    if (!text(item.system.source_composant)) assign("system.source_composant", "Compendium.add2e.sorts — composants matériels normalisés");

    if (changed) updated += 1;
  }

  if (updated) writeJson(sourceFile, document);
  return { file: EQUIPMENT_COMPENDIUM, updated, linkedComponents: usages.size, missing: false };
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
  const existingMaterialFieldsNormalized = normaliseExistingSpellMaterialFields(items);
  const mechanics = applyReferenceMechanicalFields(items, references);
  mechanics.existingMaterialFieldsNormalized = existingMaterialFieldsNormalized;
  const flags = applyReferenceFlags(items, references);
  const result = setItems(clone(previous), items);
  result.normalizedBy = VERSION;
  result.normalizedAt = new Date().toISOString();
  assertNoRegression(previous, result);
  const equipmentAssociations = syncEquipmentComponentAssociations(items);

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
  control.componentCatalog = equipmentAssociations;
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
  console.log(`[ADD2E][SPELL_MATERIALS_V3] Composantes appliquées: ${mechanics.updated}; sans M vidés: ${mechanics.noMaterialCleared}; références matérielles structurées: ${mechanics.structuredMaterialsApplied}; textes convertis: ${mechanics.fallbackTextMaterialsNormalized}.`);
  console.log(`[ADD2E][SPELL_MATERIALS_V3] Compendium équipements mis à jour: ${equipmentAssociations.updated} composant(s), ${equipmentAssociations.linkedComponents ?? 0} lien(s) de composant.`);
  console.log(`[ADD2E][SPELL_MATERIALS_V3] Réversibles déclarés — clerc: ${references.declaredByClass.clerc}, druide: ${references.declaredByClass.druide}, magicien: ${references.declaredByClass.magicien}, illusionniste: ${references.declaredByClass.illusionniste}.`);
  console.log(`[ADD2E][SPELL_MATERIALS_V3] Réversibles appariés — clerc: ${flags.reversibleMatchedByClass.clerc}, druide: ${flags.reversibleMatchedByClass.druide}, magicien: ${flags.reversibleMatchedByClass.magicien}, illusionniste: ${flags.reversibleMatchedByClass.illusionniste}.`);
  console.log(`[ADD2E][SPELL_MATERIALS_V3] Variantes structurées: ${flags.variantProfiles.length} sort(s) / ${control.variantChoiceCount} choix.`);
  console.log(`[ADD2E][SPELL_MATERIALS_V3] Contrôle de non-régression: OK.`);
}

main();
