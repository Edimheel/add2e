import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const VERSION = "2026-06-24-component-equipment-alias-audit-v11";
const SOURCE_V3 = "fvtt-spells-all-normalise-mecanique-v3.json";
const CONTROL = "fvtt-spells-all-normalise-mecanique-v3-controle.json";
const EQUIPMENT_COMPENDIUM = "compendium_equipements.json";

// Un alias relie un nom technique de composant de sort à un article réel du
// catalogue Équipements. Les valeurs sont toujours des slugs d'objets existants.
const COMPONENT_EQUIPMENT_ALIASES = Object.freeze({
  gousse_d_ail: ["ail_la_gousse"],
  eau_benite: ["eau_benite_fiole"],
  eau_maudite: ["eau_benite_fiole"],
  encens: ["encens_batonnet"],
  encens_a_bruler: ["encens_batonnet"],
  encens_allume: ["encens_batonnet"],
  miroir_en_argent: ["miroir_en_argent_petit"],
  petit_miroir_en_argent: ["miroir_en_argent_petit"]
});

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
  if (Array.isArray(system.composants_materiels) && system.composants_materiels.length) return system.composants_materiels;
  if (Array.isArray(system.composants_materiels_objets) && system.composants_materiels_objets.length) return system.composants_materiels_objets;
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
  if (!name) throw new Error(`Composant sans nom pour ${spell.name}${pathLabel ? ` (${pathLabel})` : ""}.`);

  const component = clone(rule);
  const quantity = Number(component.quantite);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error(`Quantité invalide pour « ${name} » dans ${spell.name}.`);
  }

  const consumption = text(component.consommation ?? inherited.consommation) || "consomme";
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
      condition: component.condition ?? inherited.condition ?? null,
      notes: component.notes ?? null,
      alternativeGroup: component.alternativeGroup ?? inherited.alternativeGroup ?? null,
      mode: component.mode ?? inherited.mode ?? null,
      composant: component
    }
  };
}

function walkMaterialRules(rules, spell, inherited = {}, pathLabel = "racine", output = []) {
  if (!Array.isArray(rules)) throw new Error(`Composants matériels non structurés pour ${spell.name}. Le champ doit être un tableau.`);

  for (let index = 0; index < rules.length; index += 1) {
    const rule = rules[index];
    const label = `${pathLabel}.${index + 1}`;
    if (!rule || typeof rule !== "object" || Array.isArray(rule)) throw new Error(`Composant V3 invalide pour ${spell.name} (${label}).`);

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
      if (!usage.componentSlug) throw new Error(`Slug vide pour le composant « ${usage.componentName} » de ${spell.name}.`);
      if (!catalog.has(usage.componentSlug)) catalog.set(usage.componentSlug, { name: usage.componentName, details: [] });
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

function numericPo(value) {
  const raw = typeof value === "number"
    ? value
    : typeof value === "string"
      ? Number(value.replace(",", "."))
      : value && typeof value === "object"
        ? Number(value.po ?? value.value ?? value.valeur ?? value.amount ?? NaN)
        : NaN;
  return Number.isFinite(raw) && raw > 0 ? raw : null;
}

function currentPrice(item) {
  const system = item?.system ?? {};
  const raw = system.prix ?? system.price ?? null;
  if (typeof raw === "number" && raw > 0) return `${raw} ${text(system.devise ?? system.currency ?? "po").toLowerCase() || "po"}`;
  if (typeof raw === "string" && raw.trim()) return text(raw);
  if (raw && typeof raw === "object") {
    const value = raw.valeur ?? raw.value ?? raw.montant ?? raw.amount;
    const devise = raw.devise ?? raw.currency ?? system.devise ?? system.currency ?? "po";
    if (Number.isFinite(Number(value)) && Number(value) > 0) return `${Number(value)} ${text(devise).toLowerCase() || "po"}`;
  }
  return null;
}

function itemSlug(item) {
  return slug(item?.system?.slug ?? item?.flags?.add2e?.slug ?? item?.name ?? item?.system?.nom);
}

function itemIdentity(item) {
  return text(item?._id ?? item?.id ?? item?.uuid ?? itemSlug(item) ?? item?.name);
}

function booleanValue(value) {
  if (value === true) return true;
  if (value === false) return false;
  if (value === null || value === undefined || value === "") return null;
  const valueText = text(value).toLowerCase();
  if (["true", "1", "oui", "yes", "on"].includes(valueText)) return true;
  if (["false", "0", "non", "no", "off"].includes(valueText)) return false;
  return null;
}

function isReusableEquipment(item) {
  const system = item?.system ?? {};
  const add2e = item?.flags?.add2e ?? {};
  const explicit = booleanValue(system.reutilisable ?? system.réutilisable ?? system.reusable ?? add2e.reutilisable ?? add2e.réutilisable ?? add2e.reusable);
  if (explicit === true) return true;
  const consumable = booleanValue(system.consommable ?? system.consumable ?? add2e.consommable ?? add2e.consumable);
  return consumable === false;
}

function baseEquipmentIndex(items) {
  const index = new Map();
  for (const item of items.filter(item => !isComponentItem(item))) {
    const key = itemSlug(item);
    if (!key) continue;
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(item);
  }
  return index;
}

function generatedComponentIndex(items) {
  const index = new Map();
  for (const item of items.filter(isComponentItem)) {
    const key = itemSlug(item);
    if (!key) continue;
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(item);
  }
  return index;
}

function candidateEquipmentSlugs(componentSlug) {
  return unique([componentSlug, ...(COMPONENT_EQUIPMENT_ALIASES[componentSlug] ?? [])]);
}

function resolveEquipmentMatch(componentSlug, equipmentIndex) {
  const candidates = candidateEquipmentSlugs(componentSlug);
  const seen = new Set();
  const items = [];

  for (const candidate of candidates) {
    for (const item of equipmentIndex.get(candidate) ?? []) {
      const identity = itemIdentity(item);
      if (seen.has(identity)) continue;
      seen.add(identity);
      items.push(item);
    }
  }

  const prices = [...new Set(items.map(currentPrice).filter(Boolean))].sort((left, right) => left.localeCompare(right, "fr"));
  return {
    candidateSlugs: candidates,
    viaAlias: candidates.some(candidate => candidate !== componentSlug),
    items,
    prices,
    reusable: items.length > 0 && items.every(isReusableEquipment)
  };
}

function equipmentAuditItems(items) {
  return items.map(item => ({
    id: text(item?._id ?? item?.id),
    nom: text(item?.name ?? item?.system?.nom),
    slug: itemSlug(item),
    prix: currentPrice(item),
    consommable: booleanValue(item?.system?.consommable ?? item?.system?.consumable),
    reutilisable: isReusableEquipment(item)
  }));
}

function auditComponentPrices(catalog, allItems) {
  const equipmentIndex = baseEquipmentIndex(allItems);
  const componentIndex = generatedComponentIndex(allItems);
  const rows = [];
  const summary = {
    total: 0,
    coutExpliciteUnique: 0,
    conflitCoutsExplicites: 0,
    coutExpliciteQuantiteMultiple: 0,
    prixEquipementUnique: 0,
    conflitPrixEquipements: 0,
    equipementsReutilisables: 0,
    sansPrix: 0,
    anciensComposantsAvecChampsPrix: 0
  };

  for (const [componentSlug, entry] of catalog.entries) {
    const equipment = resolveEquipmentMatch(componentSlug, equipmentIndex);
    const oldComponents = componentIndex.get(componentSlug) ?? [];
    const explicitCosts = entry.details
      .map(detail => ({
        sort: detail.nom,
        classe: detail.classe,
        niveau: detail.niveau,
        quantite: Number(detail.quantite) || 1,
        cout_po: numericPo(detail.cout_po)
      }))
      .filter(detail => detail.cout_po !== null);
    const exactPo = [...new Set(explicitCosts.filter(detail => detail.quantite === 1).map(detail => detail.cout_po))].sort((left, right) => left - right);
    const hasMultipleQuantityCost = explicitCosts.some(detail => detail.quantite !== 1);
    const legacy = oldComponents.some(item => {
      const system = item?.system ?? {};
      return system.cout !== undefined || system.coût !== undefined || system.source_prix !== undefined || system.source_note !== undefined;
    });

    let statut = "sans_prix";
    let modeRebuild = "creer_composant";
    let unitPrice = null;

    if (equipment.reusable) {
      statut = equipment.prices.length === 1
        ? "equipement_reutilisable_lie"
        : equipment.prices.length > 1
          ? "equipement_reutilisable_variantes"
          : "equipement_reutilisable_sans_prix";
      modeRebuild = "conserver_equipement_reutilisable";
      summary.equipementsReutilisables += 1;
    } else if (hasMultipleQuantityCost) {
      statut = "cout_explicite_quantite_multiple_a_verifier";
      summary.coutExpliciteQuantiteMultiple += 1;
    } else if (exactPo.length === 1) {
      statut = "cout_explicite_unique";
      unitPrice = `${exactPo[0]} po`;
      summary.coutExpliciteUnique += 1;
    } else if (exactPo.length > 1) {
      statut = "conflit_couts_explicites";
      summary.conflitCoutsExplicites += 1;
    } else if (equipment.prices.length === 1) {
      statut = "prix_equipement_unique";
      unitPrice = equipment.prices[0];
      summary.prixEquipementUnique += 1;
    } else if (equipment.prices.length > 1) {
      statut = "conflit_prix_equipements";
      summary.conflitPrixEquipements += 1;
    } else {
      summary.sansPrix += 1;
    }

    if (legacy) summary.anciensComposantsAvecChampsPrix += 1;
    summary.total += 1;

    rows.push({
      slug: componentSlug,
      nom: entry.name,
      statut,
      mode_rebuild: modeRebuild,
      prix_unitaire_propose: unitPrice,
      equipement_reference: {
        via_alias: equipment.viaAlias,
        slugs_recherches: equipment.candidateSlugs,
        articles: equipmentAuditItems(equipment.items),
        prix: equipment.prices
      },
      couts_explicites: explicitCosts,
      prix_anciens_composants: [...new Set(oldComponents.map(currentPrice).filter(Boolean))].sort((left, right) => left.localeCompare(right, "fr")),
      champs_anciens_detectes: legacy,
      usages: entry.details.map(detail => ({
        sort: detail.nom,
        classe: detail.classe,
        niveau: detail.niveau,
        quantite: detail.quantite,
        consommation: detail.consommation,
        cout_po: detail.cout_po ?? null
      }))
    });
  }

  const blocking = rows.filter(row => row.mode_rebuild === "creer_composant" && [
    "conflit_couts_explicites",
    "cout_explicite_quantite_multiple_a_verifier",
    "conflit_prix_equipements",
    "sans_prix"
  ].includes(row.statut));
  const reusable = rows.filter(row => row.mode_rebuild === "conserver_equipement_reutilisable");

  return {
    version: VERSION,
    equipmentFile: EQUIPMENT_COMPENDIUM,
    policy: "Les prix unitaires des composants consommables sont lus dans system.prix des articles de compendium_equipements.json ou dans un cout_po explicite du sort. Aucun fallback marchand. Les équipements réutilisables sont signalés séparément et ne doivent pas être recréés comme composants.",
    summary,
    blocking: {
      count: blocking.length,
      slugs: blocking.map(row => row.slug)
    },
    reusableEquipment: {
      count: reusable.length,
      slugs: reusable.map(row => row.slug)
    },
    components: rows
  };
}

function createComponentItem(template, entry, componentSlug, id, sort, unitPrice) {
  const item = clone(template);
  const system = item.system ??= {};
  const flags = item.flags ??= {};
  const add2e = flags.add2e ??= {};
  const details = clone(entry.details);
  const name = entry.name;

  if (!text(unitPrice)) throw new Error(`Prix unitaire introuvable pour le composant « ${name} ».`);

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
  system.prix = text(unitPrice);
  delete system.cout;
  delete system.coût;
  delete system.source_prix;
  delete system.source_note;
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

function rebuildComponentCatalog(spells, componentPriceAudit) {
  const compendiumFile = path.join(ROOT, EQUIPMENT_COMPENDIUM);
  const compendium = readJson(compendiumFile, null);
  if (!compendium || typeof compendium !== "object") throw new Error(`Compendium introuvable ou invalide : ${EQUIPMENT_COMPENDIUM}`);

  const catalog = buildComponentCatalog(spells);
  if (!catalog.entries.size) throw new Error(`Aucun composant matériel structuré trouvé dans ${SOURCE_V3}.`);

  const allItems = getItems(compendium).map(clone);
  if (!allItems.length) throw new Error(`${EQUIPMENT_COMPENDIUM} ne contient aucun item.`);
  const oldComponents = allItems.filter(isComponentItem);
  if (!oldComponents.length) throw new Error(`Aucun composant existant dans ${EQUIPMENT_COMPENDIUM} : impossible de conserver le modèle d’objet du compendium.`);

  const auditBySlug = new Map(componentPriceAudit.components.map(row => [row.slug, row]));
  const unresolved = [...catalog.entries.keys()].filter(componentSlug => {
    const row = auditBySlug.get(componentSlug);
    return !row || (row.mode_rebuild === "creer_composant" && !text(row.prix_unitaire_propose));
  });
  if (unresolved.length) throw new Error(`Reconstruction bloquée : prix unitaire absent pour ${unresolved.join(", ")}.`);

  const reusable = [...catalog.entries.keys()].filter(componentSlug => auditBySlug.get(componentSlug)?.mode_rebuild === "conserver_equipement_reutilisable");
  if (reusable.length) {
    throw new Error(`Reconstruction bloquée : les équipements réutilisables doivent d’abord être reliés au résolveur de composants sans créer de doublon (${reusable.join(", ")}).`);
  }

  const template = clone(oldComponents[0]);
  const retainedItems = allItems.filter(item => !isComponentItem(item));
  const usedIds = new Set(retainedItems.map(item => text(item?._id ?? item?.id)).filter(Boolean));
  const highestSort = allItems.reduce((highest, item) => Math.max(highest, Number(item?.sort) || 0), 0);
  const recreated = [];
  let sort = highestSort + 1;

  for (const [componentSlug, entry] of catalog.entries) {
    const id = makeId(`component:${componentSlug}`, usedIds);
    const row = auditBySlug.get(componentSlug);
    recreated.push(createComponentItem(template, entry, componentSlug, id, sort, row.prix_unitaire_propose));
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

function parseArguments(argv) {
  const auditOnly = argv.includes("--audit-prices");
  const positional = argv.filter(value => value && !value.startsWith("--"));
  return {
    auditOnly,
    source: positional[0] || SOURCE_V3,
    control: positional[1] || CONTROL
  };
}

function main() {
  const args = parseArguments(process.argv.slice(2));
  const sourceFile = path.join(ROOT, args.source);
  const controlFile = path.join(ROOT, args.control);
  const source = readJson(sourceFile, null);
  if (!source || typeof source !== "object") throw new Error(`JSON V3 introuvable ou invalide : ${sourceFile}`);

  const spells = getItems(source).filter(isSpell);
  if (!spells.length) throw new Error(`Aucun sort trouvé dans ${sourceFile}.`);

  const catalog = buildComponentCatalog(spells);
  const compendiumFile = path.join(ROOT, EQUIPMENT_COMPENDIUM);
  const compendium = readJson(compendiumFile, null);
  if (!compendium || typeof compendium !== "object") throw new Error(`Compendium introuvable ou invalide : ${compendiumFile}`);
  if (!getItems(compendium).length) throw new Error(`${EQUIPMENT_COMPENDIUM} ne contient aucun item.`);

  const componentPriceAudit = auditComponentPrices(catalog, getItems(compendium));
  const control = readJson(controlFile, {}) ?? {};
  control.version = VERSION;
  control.componentPriceAudit = componentPriceAudit;
  writeJson(controlFile, control);

  console.log(`[ADD2E][COMPONENT_PRICE_AUDIT] ${componentPriceAudit.summary.total} composant(s) analysé(s) depuis ${EQUIPMENT_COMPENDIUM}.`);
  console.log(`[ADD2E][COMPONENT_PRICE_AUDIT] ${componentPriceAudit.summary.prixEquipementUnique} prix unitaires résolus depuis les équipements.`);
  console.log(`[ADD2E][COMPONENT_PRICE_AUDIT] ${componentPriceAudit.reusableEquipment.count} équipement(s) réutilisable(s) à relier sans doublon.`);
  console.log(`[ADD2E][COMPONENT_PRICE_AUDIT] ${componentPriceAudit.blocking.count} composant(s) sans prix unitaire résolu ou en conflit.`);

  if (args.auditOnly) return;

  if (componentPriceAudit.blocking.count) {
    throw new Error(`Reconstruction bloquée : ${componentPriceAudit.blocking.count} composant(s) n’ont pas de prix unitaire unique. Exécute d’abord : node audit/tools/normalize-fvtt-spells-materials-v3.mjs --audit-prices`);
  }
  if (componentPriceAudit.reusableEquipment.count) {
    throw new Error(`Reconstruction bloquée : ${componentPriceAudit.reusableEquipment.count} équipement(s) réutilisable(s) doivent être reliés au résolveur sans être recréés comme composants.`);
  }

  const rebuilt = rebuildComponentCatalog(spells, componentPriceAudit);
  control.componentCatalog = {
    ...rebuilt,
    policy: "Les composants existants sont recréés uniquement depuis les entrées structurées de fvtt-spells-all-normalise-mecanique-v3.json. Les équipements réutilisables correspondants restent des équipements.",
    v3Rewritten: false,
    grammarParsing: false
  };
  writeJson(controlFile, control);

  console.log(`[ADD2E][COMPONENT_CATALOG] ${rebuilt.deleted} ancien(s) composant(s) supprimé(s).`);
  console.log(`[ADD2E][COMPONENT_CATALOG] ${rebuilt.created} composant(s) recréé(s) depuis ${SOURCE_V3}.`);
  console.log(`[ADD2E][COMPONENT_CATALOG] ${rebuilt.linkedSpellEntries} association(s) sort/composant enregistrée(s).`);
}

main();
