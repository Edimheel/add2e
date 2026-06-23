import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const VERSION = "2026-06-23-rebuild-components-from-v3-v9";
const SOURCE_V3 = "fvtt-spells-all-normalise-mecanique-v3.json";
const CONTROL = "fvtt-spells-all-normalise-mecanique-v3-controle.json";
const EQUIPMENT_COMPENDIUM = "compendium_equiepents.json";

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

function spellClass(item) {
  const system = item?.system ?? {};
  if (text(system.classe)) return text(system.classe);
  if (Array.isArray(system.spellLists) && system.spellLists.length) return text(system.spellLists[0]);
  return "";
}

function materialRules(spell) {
  const system = spell?.system ?? {};
  if (Array.isArray(system.composants_materiels) && system.composants_materiels.length) {
    return system.composants_materiels;
  }
  if (Array.isArray(system.composants_materiels_objets) && system.composants_materiels_objets.length) {
    return system.composants_materiels_objets;
  }
  return [];
}

function isComponentItem(item) {
  const system = item?.system ?? {};
  const add2e = item?.flags?.add2e ?? {};
  return slug(system.categorie ?? system.category) === "composant_sort"
    || slug(system.sousType ?? system.sous_type) === "composant"
    || add2e.schema === "equipement-composant-sort"
    || add2e.vendorKind === "component";
}

function readLeaf(rule, spell, inherited = {}, pathLabel = "") {
  if (!rule || typeof rule !== "object" || Array.isArray(rule)) {
    throw new Error(`Composant V3 invalide pour ${spell.name}${pathLabel ? ` (${pathLabel})` : ""}. Un composant doit être un objet structuré.`);
  }

  const name = text(rule.nom);
  if (!name) {
    throw new Error(`Composant sans nom pour ${spell.name}${pathLabel ? ` (${pathLabel})` : ""}.`);
  }

  const component = clone(rule);
  const quantity = Number(component.quantite);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error(`Quantité invalide pour « ${name} » dans ${spell.name}.`);
  }

  const consumption = text(component.consommation ?? inherited.consommation) || "consomme";
  const condition = component.condition ?? inherited.condition ?? null;
  const alternativeGroup = component.alternativeGroup ?? inherited.alternativeGroup ?? null;
  const mode = component.mode ?? inherited.mode ?? null;

  return {
    componentName: name,
    componentSlug: slug(name),
    detail: {
      nom: text(spell.name ?? spell.system?.nom),
      id: text(spell._id ?? spell.id),
      classe: spellClass(spell),
      niveau: itemLevel(spell),
      composant_nom: name,
      quantite: quantity,
      consommation: consumption,
      cout_po: component.cout_po ?? null,
      source: component.source ?? null,
      condition,
      notes: component.notes ?? null,
      alternativeGroup,
      mode,
      composant: component
    }
  };
}

function walkMaterialRules(rules, spell, inherited = {}, pathLabel = "racine", output = []) {
  if (!Array.isArray(rules)) {
    throw new Error(`Composants matériels non structurés pour ${spell.name}. Le champ doit être un tableau.`);
  }

  for (let index = 0; index < rules.length; index += 1) {
    const rule = rules[index];
    const label = `${pathLabel}.${index + 1}`;

    if (!rule || typeof rule !== "object" || Array.isArray(rule)) {
      throw new Error(`Composant V3 invalide pour ${spell.name} (${label}).`);
    }

    const context = {
      consommation: rule.consommation ?? inherited.consommation ?? null,
      condition: rule.condition ?? inherited.condition ?? null,
      alternativeGroup: rule.alternativeGroup ?? inherited.alternativeGroup ?? null,
      mode: rule.mode ?? inherited.mode ?? null
    };

    if (Array.isArray(rule.alternatives)) {
      walkMaterialRules(rule.alternatives, spell, context, `${label}.alternatives`, output);
      continue;
    }

    output.push(readLeaf(rule, spell, context, label));
  }

  return output;
}

function detailKey(detail) {
  return [
    detail.id,
    detail.nom,
    detail.classe,
    detail.niveau,
    detail.composant_nom,
    detail.quantite,
    detail.consommation,
    detail.cout_po ?? "",
    detail.condition ?? "",
    detail.notes ?? "",
    detail.alternativeGroup ?? "",
    detail.mode ?? ""
  ].join("|");
}

function buildComponentCatalog(spells) {
  const catalog = new Map();
  let linkedSpellEntries = 0;

  for (const spell of spells) {
    if (!isSpell(spell)) continue;
    const rules = materialRules(spell);
    if (!rules.length) continue;

    for (const usage of walkMaterialRules(rules, spell)) {
      if (!usage.componentSlug) {
        throw new Error(`Slug vide pour le composant « ${usage.componentName} » de ${spell.name}.`);
      }

      if (!catalog.has(usage.componentSlug)) {
        catalog.set(usage.componentSlug, {
          name: usage.componentName,
          details: []
        });
      }

      catalog.get(usage.componentSlug).details.push(usage.detail);
      linkedSpellEntries += 1;
    }
  }

  for (const entry of catalog.values()) {
    const details = new Map();
    for (const detail of entry.details) details.set(detailKey(detail), detail);
    entry.details = [...details.values()].sort((left, right) =>
      String(left.nom).localeCompare(String(right.nom), "fr")
      || String(left.classe).localeCompare(String(right.classe), "fr")
      || Number(left.niveau) - Number(right.niveau)
      || String(left.alternativeGroup ?? "").localeCompare(String(right.alternativeGroup ?? ""), "fr")
    );
  }

  return {
    entries: new Map([...catalog.entries()].sort(([left], [right]) => left.localeCompare(right, "fr"))),
    linkedSpellEntries
  };
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
  const system = item.system ??= {};
  const flags = item.flags ??= {};
  const add2e = flags.add2e ??= {};
  const details = clone(entry.details);
  const name = entry.name;

  item._id = id;
  item.name = name;
  item.type = "objet";
  item.sort = sort;
  system.nom = name;
  system.type = "objet";
  system.categorie = "composant_sort";
  system.sousType = "composant";
  system.slug = componentSlug;
  system.quantite = 1;
  system.equipee = false;
  system.magique = false;
  system.consommable = true;
  system.description = `Composant de sort : ${name}.`;
  system.source_note = `Reconstruit depuis ${SOURCE_V3}.`;
  system.source_composant = `${SOURCE_V3} — composants matériels structurés`;
  system.tags = componentTags(system.tags, componentSlug);
  system.effectTags = componentEffectTags(system.effectTags, componentSlug);
  system.sorts_associes = unique(details.map(detail => detail.nom)).sort((left, right) => left.localeCompare(right, "fr"));
  system.sorts_associes_details = details;
  system.consommations_associees = unique(details.map(detail => detail.consommation)).sort((left, right) => left.localeCompare(right, "fr"));
  system.conditions_associees = unique(details.map(detail => detail.condition)).sort((left, right) => left.localeCompare(right, "fr"));

  add2e.schema = "equipement-composant-sort";
  add2e.slug = componentSlug;
  add2e.generatedBy = "normalize-fvtt-spells-materials-v3";
  add2e.generatedFrom = SOURCE_V3;
  add2e.vendorItem = true;
  add2e.vendorKind = "component";
  add2e.vendorStockMax = Number(add2e.vendorStockMax) || 20;

  return item;
}

function rebuildComponentCatalog(spells) {
  const compendiumFile = path.join(ROOT, EQUIPMENT_COMPENDIUM);
  const compendium = readJson(compendiumFile, null);
  if (!compendium || typeof compendium !== "object") {
    throw new Error(`Compendium introuvable ou invalide : ${EQUIPMENT_COMPENDIUM}`);
  }

  const catalog = buildComponentCatalog(spells);
  if (!catalog.entries.size) {
    throw new Error(`Aucun composant matériel structuré trouvé dans ${SOURCE_V3}.`);
  }

  const allItems = getItems(compendium).map(clone);
  const oldComponents = allItems.filter(isComponentItem);
  if (!oldComponents.length) {
    throw new Error(`Aucun composant existant dans ${EQUIPMENT_COMPENDIUM} : impossible de conserver le modèle d’objet du compendium.`);
  }

  const template = clone(oldComponents[0]);
  const retainedItems = allItems.filter(item => !isComponentItem(item));
  const usedIds = new Set(retainedItems.map(item => text(item?._id ?? item?.id)).filter(Boolean));
  const highestSort = allItems.reduce((highest, item) => Math.max(highest, Number(item?.sort) || 0), 0);
  const recreated = [];
  let sort = highestSort + 1;

  for (const [componentSlug, entry] of catalog.entries) {
    const id = makeId(`component:${componentSlug}`, usedIds);
    recreated.push(createComponentItem(template, entry, componentSlug, id, sort));
    sort += 1;
  }

  setItems(compendium, [...retainedItems, ...recreated]);
  writeJson(compendiumFile, compendium);

  return {
    file: EQUIPMENT_COMPENDIUM,
    source: SOURCE_V3,
    deleted: oldComponents.length,
    created: recreated.length,
    uniqueComponents: catalog.entries.size,
    linkedSpellEntries: catalog.linkedSpellEntries
  };
}

function main() {
  const sourceFile = path.join(ROOT, process.argv[2] || SOURCE_V3);
  const controlFile = path.join(ROOT, process.argv[3] || CONTROL);
  const source = readJson(sourceFile, null);
  if (!source || typeof source !== "object") {
    throw new Error(`JSON V3 introuvable ou invalide : ${sourceFile}`);
  }

  const spells = getItems(source).filter(isSpell);
  if (!spells.length) {
    throw new Error(`Aucun sort trouvé dans ${sourceFile}.`);
  }

  const catalog = rebuildComponentCatalog(spells);
  const control = readJson(controlFile, {}) ?? {};
  control.version = VERSION;
  control.componentCatalog = {
    ...catalog,
    policy: "Tous les objets composants existants sont supprimés puis recréés uniquement depuis les entrées structurées de fvtt-spells-all-normalise-mecanique-v3.json.",
    v3Rewritten: false,
    grammarParsing: false
  };
  writeJson(controlFile, control);

  console.log(`[ADD2E][COMPONENT_CATALOG] ${catalog.deleted} ancien(s) composant(s) supprimé(s).`);
  console.log(`[ADD2E][COMPONENT_CATALOG] ${catalog.created} composant(s) recréé(s) depuis ${SOURCE_V3}.`);
  console.log(`[ADD2E][COMPONENT_CATALOG] ${catalog.linkedSpellEntries} association(s) sort/composant enregistrée(s).`);
}

main();
