import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const VERSION = "2026-06-23-v3-unitary-components-catalog-v8";
const INPUT = "fvtt-spells-all-normalise-mecanique-v1.json";
const OUTPUT = "fvtt-spells-all-normalise-mecanique-v3.json";
const CONTROL = "fvtt-spells-all-normalise-mecanique-v3-controle.json";
const MATERIAL_REFERENCE = "audit/reference/manuel-joueurs-composants-materiels.json";
const EQUIPMENT_COMPENDIUM = "compendium_equiepents.json";
const CLASSES = {
  clerc: [1, 2, 3, 4, 5, 6, 7],
  druide: [1, 2, 3, 4, 5, 6, 7],
  magicien: [1, 2, 3, 4, 5, 6, 7, 8, 9],
  illusionniste: [1, 2, 3, 4, 5, 6, 7]
};

const text = value => String(value ?? "").replace(/\s+/g, " ").trim();
const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const asArray = value => Array.isArray(value) ? value : value == null || value === "" ? [] : [value];
const slug = value => text(value)
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[’']/g, "'")
  .replace(/[^a-z0-9]+/g, "_")
  .replace(/^_+|_+$/g, "");

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
  return [...new Set([...values.map(slug), slug(system.classe)].filter(Boolean))];
}

function itemKey(item) {
  const id = text(item?._id ?? item?.id);
  return id || `${slug(item?.system?.classe)}|${itemLevel(item)}|${slug(item?.name ?? item?.system?.nom)}`;
}

function refKey(classSlug, level, name) {
  return `${slug(classSlug)}|${Number(level) || 0}|${slug(name)}`;
}

function isCompositeMaterialPhrase(value) {
  const raw = text(value);
  if (!raw) return false;
  return /(?:\bet\s+l[’']un\s+des\s+éléments\s+suivants\b|\bl[’']un\s+des\s+éléments\s+suivants\b|\b(?:et|ou)\b|[,;:])/i.test(raw);
}

function normalizeUnitaryNameAndQuantity(value, fallbackQuantity = 1, context = "") {
  const original = text(value);
  if (!original) throw new Error(`Composant sans nom${context ? ` (${context})` : ""}.`);
  if (isCompositeMaterialPhrase(original)) {
    throw new Error(`Composant composite interdit${context ? ` (${context})` : ""} : « ${original} ». Le JSON V3 doit contenir uniquement des composants unitaires et des groupes alternatives structurés.`);
  }

  let name = original;
  let quantity = Math.max(1, Math.floor(Number(fallbackQuantity) || 1));
  let convention = false;
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
    convention = text(before) !== text(name);
  }

  name = name.replace(/[.!?;:]+$/g, "").trim();
  if (!name) throw new Error(`Composant sans nom après normalisation${context ? ` (${context})` : ""}.`);
  if (isCompositeMaterialPhrase(name)) {
    throw new Error(`Composant composite après normalisation${context ? ` (${context})` : ""} : « ${name} ».`);
  }

  return { nom: name, quantite: quantity, original, convention };
}

function normalizedConsumption(value, fallback = "consomme") {
  const raw = text(value).toLowerCase();
  if (["non_consomme", "non consommé", "non consomme", "non_consumed", "nonconsumed", "focus"].includes(raw)) return "non_consomme";
  return text(value) || fallback;
}

function normalizeRule(raw, context = "") {
  if (raw == null || raw === "") return null;

  if (typeof raw === "string") {
    const info = normalizeUnitaryNameAndQuantity(raw, 1, context);
    const rule = { nom: info.nom, quantite: info.quantite, consommation: "consomme" };
    if (info.nom !== info.original) {
      rule.notes = `${info.convention ? "Quantité conventionnelle ADD2E : 1. " : ""}Texte du Manuel : ${info.original}.`;
    }
    return rule;
  }

  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`Composant invalide${context ? ` (${context})` : ""}.`);
  }

  const alternatives = raw.alternatives ?? raw.options ?? raw.choix ?? raw.auChoix ?? raw.or;
  if (Array.isArray(alternatives)) {
    const result = clone(raw);
    result.alternatives = alternatives.map((entry, index) => normalizeRule(entry, `${context} alternative ${index + 1}`)).filter(Boolean);
    delete result.options;
    delete result.choix;
    delete result.auChoix;
    delete result.or;
    if (!result.alternatives.length) throw new Error(`Groupe d’alternatives vide${context ? ` (${context})` : ""}.`);
    return result;
  }

  const rawName = raw.nom ?? raw.name ?? raw.label ?? raw.item ?? raw.itemName ?? raw.component ?? raw.composant ?? raw.slug;
  const rawQuantity = raw.quantite ?? raw.quantity ?? raw.qty ?? raw.nombre ?? raw.count ?? 1;
  const info = normalizeUnitaryNameAndQuantity(rawName, rawQuantity, context);
  const result = clone(raw);
  result.nom = info.nom;
  result.quantite = info.quantite;
  result.consommation = normalizedConsumption(
    raw.consommation ?? raw.consumption ?? (raw.consomme === false || raw.consume === false ? "non_consomme" : "consomme")
  );

  for (const key of ["name", "label", "item", "itemName", "component", "composant", "slug", "quantity", "qty", "nombre", "count", "consumption", "consume", "consomme"]) delete result[key];

  if (info.nom !== info.original) {
    const note = `${info.convention ? "Quantité conventionnelle ADD2E : 1. " : ""}Texte du Manuel : ${info.original}.`;
    result.notes = [text(result.notes), note].filter(Boolean).join(" ");
  }
  return result;
}

function normalizeRules(value, context = "") {
  return asArray(value)
    .flatMap((entry, index) => Array.isArray(entry)
      ? normalizeRules(entry, `${context} groupe ${index + 1}`)
      : [normalizeRule(entry, `${context} composant ${index + 1}`)])
    .filter(Boolean);
}

function flattenRules(value, out = []) {
  for (const rule of asArray(value)) {
    if (!rule || typeof rule !== "object") continue;
    if (Array.isArray(rule.alternatives)) {
      flattenRules(rule.alternatives, out);
      continue;
    }
    if (text(rule.nom)) out.push(rule);
  }
  return out;
}

function materialSource(item) {
  const system = item?.system ?? {};
  if (Array.isArray(system.composants_materiels_objets) && system.composants_materiels_objets.length) return system.composants_materiels_objets;
  return system.composants_materiels;
}

function hasMaterialComponent(item) {
  return text(item?.system?.composantes).split(/[,;/\s]+/g).some(value => value.toUpperCase() === "M");
}

function referenceAliases(entry) {
  return [
    entry?.foundryName,
    entry?.foundryNom,
    entry?.foundry?.name,
    entry?.foundry?.nom,
    ...asArray(entry?.foundryNames),
    ...asArray(entry?.foundryNoms),
    ...asArray(entry?.foundry?.names),
    ...asArray(entry?.foundry?.noms)
  ].map(text).filter(Boolean);
}

function loadMaterialReferences() {
  const references = new Map();
  const aliases = new Map();
  const files = [];

  const add = ({ classSlug, level, name, entry, source }) => {
    const canonicalName = text(name);
    if (!canonicalName) return;
    const key = refKey(classSlug, level, canonicalName);
    const previous = references.get(key) ?? {};
    const materials = entry?.composants_materiels_objets ?? entry?.composants_materiels;
    const next = {
      ...previous,
      classSlug: slug(classSlug),
      level: Number(level) || 0,
      name: canonicalName,
      composantes: text(entry?.composantes) || previous.composantes || "",
      description: text(entry?.description ?? entry?.description_texte ?? entry?.description_reelle) || previous.description || "",
      descriptionSource: text(entry?.description_source) || previous.descriptionSource || "",
      materials: materials !== undefined ? normalizeRules(materials, `${classSlug} niveau ${level} — ${canonicalName}`) : (previous.materials ?? []),
      sources: [...new Set([...(previous.sources ?? []), source])]
    };
    references.set(key, next);
    for (const alias of [canonicalName, ...referenceAliases(entry)]) {
      aliases.set(refKey(classSlug, level, alias), key);
    }
  };

  for (const [classSlug, levels] of Object.entries(CLASSES)) {
    for (const level of levels) {
      const relative = `audit/reference/manuel-joueurs-${classSlug}-niveau-${level}.json`;
      const document = readJson(path.join(ROOT, relative), null);
      if (!document) continue;
      files.push(relative);
      for (const spell of document.spells ?? []) {
        const name = text(spell?.nom ?? spell?.name);
        if (!name) continue;
        add({ classSlug, level: Number(spell?.niveau ?? spell?.level ?? level) || level, name, entry: spell, source: relative });
      }
    }
  }

  const materialDocument = readJson(path.join(ROOT, MATERIAL_REFERENCE), null);
  if (!materialDocument || typeof materialDocument !== "object") throw new Error(`Référence de composants introuvable : ${MATERIAL_REFERENCE}`);
  files.push(MATERIAL_REFERENCE);
  for (const root of [materialDocument.materiels, materialDocument.materials, materialDocument.composants_materiels].filter(Boolean)) {
    for (const [lot, entries] of Object.entries(root)) {
      const match = String(lot).match(/^(clerc|druide|magicien|illusionniste)-niveau-(\d+)$/i);
      if (!match) continue;
      for (const [name, entry] of Object.entries(entries ?? {})) {
        add({ classSlug: match[1], level: Number(match[2]), name, entry, source: MATERIAL_REFERENCE });
      }
    }
  }

  return { references, aliases, files: [...new Set(files)] };
}

function findReference(lookup, spell) {
  const name = text(spell?.name ?? spell?.system?.nom);
  const level = itemLevel(spell);
  for (const classSlug of itemClasses(spell)) {
    const lookupKey = lookup.aliases.get(refKey(classSlug, level, name));
    if (lookupKey) return lookup.references.get(lookupKey) ?? null;
  }
  return null;
}

function applyMaterialReference(spell, reference) {
  const system = spell.system ??= {};
  let changed = false;
  const set = (field, value) => {
    if (JSON.stringify(system[field]) !== JSON.stringify(value)) {
      system[field] = clone(value);
      changed = true;
    }
  };

  if (reference?.composantes && system.composantes !== reference.composantes) {
    system.composantes = reference.composantes;
    changed = true;
  }

  if (reference?.description) {
    const description = reference.description;
    const values = {
      description,
      description_texte: description,
      description_reelle: description,
      description_html: `<p>${description.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`
    };
    if (reference.descriptionSource) values.description_source = reference.descriptionSource;
    for (const [field, value] of Object.entries(values)) {
      if (system[field] !== value) {
        system[field] = value;
        changed = true;
      }
    }
  }

  const referenceMaterials = reference?.materials ?? [];
  if (referenceMaterials.length) {
    set("composants_materiels", referenceMaterials);
    set("composants_materiels_objets", referenceMaterials);
    return changed;
  }

  const source = materialSource(spell);
  if (source?.length) {
    const normalized = normalizeRules(source, `JSON V3 — ${spell.name}`);
    set("composants_materiels", normalized);
    set("composants_materiels_objets", normalized);
  } else if (!hasMaterialComponent(spell)) {
    set("composants_materiels", []);
    set("composants_materiels_objets", []);
  }
  return changed;
}

function normalizeAllSpellMaterials(items, references) {
  const result = { updated: 0, materialSpells: 0, unresolved: [] };
  for (const spell of items) {
    if (!isSpell(spell)) continue;
    const reference = findReference(references, spell);
    if (applyMaterialReference(spell, reference)) result.updated += 1;
    if (hasMaterialComponent(spell)) {
      result.materialSpells += 1;
      const source = materialSource(spell);
      if (!Array.isArray(source) || !source.length) {
        result.unresolved.push({ name: spell.name, classe: spell.system?.classe ?? "", niveau: itemLevel(spell) });
      }
    }
  }
  return result;
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableValue(value[key])]));
  return value;
}

function sameJson(left, right) {
  return JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right));
}

function stripAllowedSpellFields(item) {
  const result = clone(item);
  if (!isSpell(result)) return result;
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
  ]) {
    delete result.system?.[field];
  }
  return result;
}

function assertNoRegression(before, after) {
  const beforeItems = getItems(before);
  const afterItems = getItems(after);
  if (beforeItems.length !== afterItems.length) throw new Error(`Régression bloquée : ${beforeItems.length} item(s) avant, ${afterItems.length} après.`);
  const beforeByKey = new Map(beforeItems.map(item => [itemKey(item), item]));
  const afterByKey = new Map(afterItems.map(item => [itemKey(item), item]));
  const missing = [...beforeByKey.keys()].filter(key => !afterByKey.has(key));
  const added = [...afterByKey.keys()].filter(key => !beforeByKey.has(key));
  if (missing.length || added.length) throw new Error("Régression bloquée : le jeu d’items V3 a changé.");

  for (const key of beforeByKey.keys()) {
    if (!sameJson(stripAllowedSpellFields(beforeByKey.get(key)), stripAllowedSpellFields(afterByKey.get(key)))) {
      throw new Error(`Régression bloquée : modification hors champs autorisés pour ${key}.`);
    }
  }
}

function isComponentItem(item) {
  const system = item?.system ?? {};
  const flags = item?.flags?.add2e ?? {};
  return slug(system.categorie ?? system.category) === "composant_sort"
    || slug(system.sousType ?? system.sous_type) === "composant"
    || flags.schema === "equipement-composant-sort"
    || flags.vendorKind === "component";
}

function spellClassName(spell) {
  const system = spell?.system ?? {};
  return text(system.classe) || text(asArray(system.spellLists)[0]);
}

function collectComponentUsages(value, spell, inherited = {}, output = []) {
  for (const rule of asArray(value)) {
    if (!rule) continue;
    if (Array.isArray(rule)) {
      collectComponentUsages(rule, spell, inherited, output);
      continue;
    }
    if (typeof rule !== "object") {
      throw new Error(`Composant V3 non structuré pour ${spell.name}.`);
    }

    const next = {
      consommation: normalizedConsumption(rule.consommation ?? rule.consumption ?? inherited.consommation, inherited.consommation ?? "consomme"),
      condition: text(rule.condition ?? rule.conditions ?? rule.sourceCondition ?? inherited.condition) || null,
      alternativeGroup: text(rule.alternativeGroup ?? inherited.alternativeGroup) || null,
      mode: text(rule.mode ?? rule.forme ?? rule.form ?? inherited.mode) || null
    };

    if (Array.isArray(rule.alternatives)) {
      collectComponentUsages(rule.alternatives, spell, next, output);
      continue;
    }

    const info = normalizeUnitaryNameAndQuantity(rule.nom, rule.quantite, `JSON V3 — ${spell.name}`);
    output.push({
      componentKey: slug(info.nom),
      componentName: info.nom,
      detail: {
        nom: text(spell?.name ?? spell?.system?.nom),
        id: text(spell?._id ?? spell?.id),
        classe: spellClassName(spell),
        niveau: itemLevel(spell),
        quantite: info.quantite,
        consommation: next.consommation,
        condition: next.condition,
        alternativeGroup: next.alternativeGroup,
        mode: next.mode
      }
    });
  }
  return output;
}

function buildComponentCatalog(spells) {
  const catalog = new Map();
  for (const spell of spells) {
    if (!isSpell(spell)) continue;
    const source = materialSource(spell);
    if (!Array.isArray(source) || !source.length) continue;
    for (const usage of collectComponentUsages(source, spell)) {
      if (!usage.componentKey) throw new Error(`Composant sans slug pour ${spell.name}.`);
      if (!catalog.has(usage.componentKey)) {
        catalog.set(usage.componentKey, { name: usage.componentName, details: [] });
      }
      catalog.get(usage.componentKey).details.push(usage.detail);
    }
  }

  for (const entry of catalog.values()) {
    const uniqueDetails = new Map();
    for (const detail of entry.details) {
      const key = [detail.id, detail.nom, detail.classe, detail.niveau, detail.quantite, detail.consommation, detail.condition ?? "", detail.alternativeGroup ?? "", detail.mode ?? ""].join("|");
      uniqueDetails.set(key, detail);
    }
    entry.details = [...uniqueDetails.values()].sort((left, right) =>
      String(left.nom).localeCompare(String(right.nom), "fr")
      || Number(left.niveau) - Number(right.niveau)
      || String(left.condition ?? "").localeCompare(String(right.condition ?? ""), "fr")
    );
  }
  return new Map([...catalog.entries()].sort(([left], [right]) => left.localeCompare(right, "fr")));
}

function unique(values) {
  return [...new Set(values.map(text).filter(Boolean))];
}

function componentTags(existing, componentSlug) {
  const retained = asArray(existing).map(value => String(value ?? "").trim()).filter(value => value && !(
    value === "objet"
    || value === "categorie:composant_sort"
    || value === "sous_type:composant"
    || value === "composant_sort"
    || value === "consommable"
    || /^objet:/i.test(value)
    || /^composant:/i.test(value)
  ));
  return unique([
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
  const retained = asArray(existing).map(value => String(value ?? "").trim()).filter(value => value && !(
    value === "objet"
    || value === "categorie_composant_sort"
    || value === "sous_type_composant"
    || value === "composant_sort"
    || value === "consommable"
    || /^objet_/i.test(value)
    || /^composant_/i.test(value)
  ));
  return unique([
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

function makeId(seed, usedIds) {
  let attempt = 0;
  while (true) {
    const hash = crypto.createHash("sha1").update(`${seed}|${attempt}`).digest("hex");
    const id = `c${hash.slice(0, 15)}`;
    if (!usedIds.has(id)) {
      usedIds.add(id);
      return id;
    }
    attempt += 1;
  }
}

function createComponentItem(template, entry, componentSlug, id, sort) {
  const item = clone(template);
  const details = clone(entry.details);
  const name = entry.name;
  const system = item.system ??= {};
  const flags = item.flags ??= {};
  const add2e = flags.add2e ??= {};

  item._id = id;
  item.name = name;
  item.type = "objet";
  item.sort = sort;
  system.nom = name;
  system.type = system.type || "objet";
  system.categorie = "composant_sort";
  system.sousType = "composant";
  system.slug = componentSlug;
  system.quantite = 1;
  system.equipee = false;
  system.magique = false;
  system.consommable = true;
  system.description = `Composant de sort : ${name}.`;
  system.source_note = "Reconstruit depuis fvtt-spells-all-normalise-mecanique-v3.json.";
  system.source_composant = "fvtt-spells-all-normalise-mecanique-v3.json — composants matériels structurés";
  system.tags = componentTags(system.tags, componentSlug);
  system.effectTags = componentEffectTags(system.effectTags, componentSlug);
  system.sorts_associes = unique(details.map(detail => detail.nom)).sort((left, right) => left.localeCompare(right, "fr"));
  system.sorts_associes_details = details;
  system.consommations_associees = unique(details.map(detail => detail.consommation)).sort((left, right) => left.localeCompare(right, "fr"));
  system.conditions_associees = unique(details.map(detail => detail.condition)).sort((left, right) => left.localeCompare(right, "fr"));

  add2e.schema = "equipement-composant-sort";
  add2e.slug = componentSlug;
  add2e.generatedBy = "normalize-fvtt-spells-materials-v3";
  add2e.generatedFrom = OUTPUT;
  add2e.vendorItem = true;
  add2e.vendorKind = "component";
  add2e.vendorStockMax = Number(add2e.vendorStockMax) || 20;
  return item;
}

function rebuildEquipmentComponents(spells) {
  const file = path.join(ROOT, EQUIPMENT_COMPENDIUM);
  const document = readJson(file, null);
  if (!document || typeof document !== "object") throw new Error(`Compendium équipements introuvable ou invalide : ${EQUIPMENT_COMPENDIUM}`);

  const allItems = getItems(document).map(clone);
  const oldComponents = allItems.filter(isComponentItem);
  if (!oldComponents.length) throw new Error(`Aucun objet composant trouvé dans ${EQUIPMENT_COMPENDIUM} : impossible de reprendre le modèle de données existant.`);

  const catalog = buildComponentCatalog(spells);
  if (!catalog.size) throw new Error("Le JSON V3 ne contient aucun composant matériel unitaire : compendium non modifié.");

  const template = clone(oldComponents[0]);
  const retainedItems = allItems.filter(item => !isComponentItem(item));
  const usedIds = new Set(retainedItems.map(item => text(item?._id ?? item?.id)).filter(Boolean));
  const highestSort = retainedItems.reduce((max, item) => Math.max(max, Number(item?.sort) || 0), 0);
  const recreated = [];
  let sort = highestSort + 1;

  for (const [componentSlug, entry] of catalog) {
    const id = makeId(`component:${componentSlug}`, usedIds);
    recreated.push(createComponentItem(template, entry, componentSlug, id, sort));
    sort += 1;
  }

  setItems(document, [...retainedItems, ...recreated]);
  writeJson(file, document);
  return {
    file: EQUIPMENT_COMPENDIUM,
    deleted: oldComponents.length,
    created: recreated.length,
    linkedComponents: catalog.size
  };
}

function main() {
  const input = path.join(ROOT, process.argv[2] || INPUT);
  const output = path.join(ROOT, process.argv[3] || OUTPUT);
  const controlFile = path.join(ROOT, process.argv[4] || CONTROL);
  const inputDocument = readJson(input, null);
  const previous = readJson(output, null);
  if (!inputDocument) throw new Error(`Fichier source introuvable ou invalide : ${input}`);
  if (!previous) throw new Error(`JSON V3 validé introuvable ou invalide : ${output}`);

  const sourceItems = getItems(inputDocument);
  const previousItems = getItems(previous);
  const items = previousItems.map(clone);
  const references = loadMaterialReferences();
  const materialResult = normalizeAllSpellMaterials(items, references);
  if (materialResult.unresolved.length) {
    throw new Error(`Sorts avec composante M mais aucun composant structuré : ${materialResult.unresolved.slice(0, 12).map(entry => `${entry.name} (${entry.classe} ${entry.niveau})`).join(", ")}.`);
  }

  const result = setItems(clone(previous), items);
  result.normalizedBy = VERSION;
  result.normalizedAt = new Date().toISOString();
  assertNoRegression(previous, result);

  const equipment = rebuildEquipmentComponents(items);
  const control = readJson(controlFile, {}) ?? {};
  control.version = VERSION;
  control.input = path.relative(ROOT, input);
  control.output = path.relative(ROOT, output);
  control.sourceSpellCount = sourceItems.filter(isSpell).length;
  control.outputSpellCount = items.filter(isSpell).length;
  control.materialMechanics = {
    updated: materialResult.updated,
    materialSpells: materialResult.materialSpells,
    strictSource: OUTPUT,
    rejectedCompositeText: true,
    references: references.files
  };
  control.componentCatalog = {
    ...equipment,
    source: OUTPUT,
    policy: "Tous les objets composants existants sont supprimés puis recréés depuis les composants unitaires structurés du JSON V3."
  };
  control.nonRegression = {
    status: "passed",
    validatedBaseline: path.relative(ROOT, output),
    itemCountBefore: previousItems.length,
    itemCountAfter: items.length,
    allowedItemPaths: [
      "system.composantes",
      "system.composants_materiels",
      "system.composants_materiels_objets",
      "system.composants_requis",
      "system.description",
      "system.description_texte",
      "system.description_reelle",
      "system.description_html",
      "system.description_source"
    ],
    allowedDocumentPaths: ["normalizedBy", "normalizedAt"]
  };

  writeJson(output, result);
  writeJson(controlFile, control);
  console.log(`[ADD2E][SPELL_MATERIALS_V3] ${control.outputSpellCount} sort(s) V3 conservé(s).`);
  console.log(`[ADD2E][SPELL_MATERIALS_V3] Composantes structurées mises à jour : ${materialResult.updated}.`);
  console.log(`[ADD2E][SPELL_MATERIALS_V3] Compendium équipements : ${equipment.deleted} ancien(s) composant(s) supprimé(s), ${equipment.created} composant(s) recréé(s).`);
  console.log("[ADD2E][SPELL_MATERIALS_V3] Contrôle de non-régression : OK.");
}

main();
