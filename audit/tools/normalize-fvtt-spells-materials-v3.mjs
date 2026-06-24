import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const VERSION = "2026-06-24-component-catalog-from-v3-v14";
const SOURCE_V3 = "fvtt-spells-all-normalise-mecanique-v3.json";
const CONTROL = "fvtt-spells-all-normalise-mecanique-v3-controle.json";
const EQUIPMENT_COMPENDIUM = "compendium_equipements.json";

const CANONICAL_ALIASES = Object.freeze({
  gousse_d_ail: "ail",
  ail_la_gousse: "ail",
  encens_a_bruler: "encens",
  encens_allume: "encens",
  petit_miroir_en_argent: "miroir_en_argent",
  miroir_en_argent_petit: "miroir_en_argent",
  symbole_sacre_du_clerc: "symbole_sacre",
  symbole_saint: "symbole_sacre",
  holy_symbol: "symbole_sacre"
});

const EQUIPMENT_ALIASES = Object.freeze({
  ail: ["ail_la_gousse"],
  eau_benite: ["eau_benite_fiole"],
  eau_maudite: ["eau_benite_fiole"],
  encens: ["encens_batonnet"],
  chapelet_de_priere: ["chapelet_de_priere"],
  miroir_en_argent: ["miroir_en_argent_petit"],
  symbole_sacre: ["symbole_beni_bois", "symbole_beni_fer", "symbole_beni_argent"],
  symbole_religieux_en_argent: ["symbole_beni_argent"]
});

const EXACT_ESTIMATES = Object.freeze({
  agate: "10 po",
  ambre: "10 po",
  diamant: "100 po",
  emeraude: "100 po",
  jade: "50 po",
  opale: "100 po",
  perle: "10 po",
  rubis: "100 po",
  saphir: "100 po",
  topaze: "100 po",
  mercure: "5 po",
  mandragore: "5 po",
  gui: "1 po",
  phosphore: "1 po",
  soufre: "1 po",
  souffre: "1 po",
  salpetre: "1 po",
  vermillon: "1 po",
  soie: "1 po",
  velin: "1 po",
  parchemin: "1 pa",
  verre: "5 pc",
  cristal: "1 po",
  quartz: "1 po",
  mica: "1 po",
  craie: "1 pc",
  silex: "1 pc",
  eau: "1 pc",
  feu: "1 pc",
  flamme: "1 pc",
  source_de_feu: "1 pc"
});

const PRICE_TIERS = [
  { copper: 1, label: "1 pc" },
  { copper: 5, label: "5 pc" },
  { copper: 10, label: "1 pa" },
  { copper: 100, label: "1 po" },
  { copper: 500, label: "5 po" },
  { copper: 1000, label: "10 po" },
  { copper: 5000, label: "50 po" },
  { copper: 10000, label: "100 po" }
];

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

function unique(values) {
  return [...new Set(values.map(text).filter(Boolean))];
}

function isSpell(item) {
  return String(item?.type ?? item?.system?.type ?? "").toLowerCase() === "sort";
}

function itemLevel(item) {
  return Number(String(item?.system?.niveau ?? item?.system?.niveau_sort ?? item?.system?.level ?? "").match(/\d+/)?.[0] ?? 0) || 0;
}

function spellClass(item) {
  const system = item?.system ?? {};
  return text(system.classe ?? system.class ?? "");
}

function componentKey(value) {
  const raw = slug(value);
  return CANONICAL_ALIASES[raw] ?? raw;
}

function componentSourceRules(spell) {
  const system = spell?.system ?? {};
  return Array.isArray(system.composants_materiels) ? system.composants_materiels : [];
}

/*
 * Source unique : system.composants_materiels du JSON V3.
 * Cette fonction ne lit ni descriptions, ni notes, ni tags, ni texte libre.
 * Les noms sont conservés tels qu'ils sont déclarés dans V3 : aucune découpe
 * par « et », virgule ou autre formulation naturelle n'est faite.
 */
function collectV3ComponentLeaves(value, spell, inherited = {}, output = []) {
  if (Array.isArray(value)) {
    for (const entry of value) collectV3ComponentLeaves(entry, spell, inherited, output);
    return output;
  }

  if (!value || typeof value !== "object") return output;

  const context = {
    consommation: value.consommation ?? inherited.consommation ?? null,
    condition: value.condition ?? inherited.condition ?? null,
    alternativeGroup: value.alternativeGroup ?? inherited.alternativeGroup ?? null,
    mode: value.mode ?? inherited.mode ?? null
  };

  if (Array.isArray(value.alternatives)) {
    for (const alternative of value.alternatives) collectV3ComponentLeaves(alternative, spell, context, output);
    return output;
  }

  const name = text(value.nom ?? value.name ?? "");
  if (!name) return output;

  const quantity = Number(value.quantite ?? value.quantity ?? 1);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error(`Quantité V3 invalide pour « ${name} » dans ${spell.name}.`);
  }

  output.push({
    key: componentKey(name),
    rawKey: slug(name),
    name,
    detail: {
      sort: text(spell.name ?? spell.system?.nom),
      sortId: text(spell._id ?? spell.id),
      classe: spellClass(spell),
      niveau: itemLevel(spell),
      composant_nom: name,
      quantite: quantity,
      consommation: text(value.consommation ?? context.consommation) || "consomme",
      cout_po: value.cout_po ?? null,
      condition: value.condition ?? context.condition ?? null,
      notes: value.notes ?? null,
      alternativeGroup: value.alternativeGroup ?? context.alternativeGroup ?? null,
      mode: value.mode ?? context.mode ?? null
    }
  });

  return output;
}

function detailKey(detail) {
  return [
    detail.sortId,
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

function buildCatalogFromV3(source) {
  const entries = new Map();
  let spellCount = 0;
  let componentOccurrences = 0;

  for (const spell of getItems(source).filter(isSpell)) {
    spellCount += 1;
    for (const leaf of collectV3ComponentLeaves(componentSourceRules(spell), spell)) {
      if (!leaf.key) continue;
      if (!entries.has(leaf.key)) {
        entries.set(leaf.key, {
          key: leaf.key,
          name: leaf.name,
          names: new Set(),
          rawKeys: new Set(),
          details: []
        });
      }
      const entry = entries.get(leaf.key);
      entry.names.add(leaf.name);
      entry.rawKeys.add(leaf.rawKey);
      entry.details.push(leaf.detail);
      componentOccurrences += 1;
    }
  }

  for (const entry of entries.values()) {
    const deduped = new Map();
    for (const detail of entry.details) deduped.set(detailKey(detail), detail);
    entry.details = [...deduped.values()];
    entry.names = [...entry.names].sort((left, right) => left.localeCompare(right, "fr"));
    entry.rawKeys = [...entry.rawKeys].sort((left, right) => left.localeCompare(right, "fr"));
    entry.name = entry.names[0] ?? entry.name;
  }

  return {
    entries: new Map([...entries.entries()].sort(([left], [right]) => left.localeCompare(right, "fr"))),
    spellCount,
    componentOccurrences
  };
}

function isComponentItem(item) {
  const system = item?.system ?? {};
  const add2e = item?.flags?.add2e ?? {};
  return slug(system.categorie ?? system.category) === "composant_sort"
    || slug(system.sousType ?? system.sous_type) === "composant"
    || add2e.schema === "equipement-composant-sort"
    || add2e.vendorKind === "component";
}

function itemSlug(item) {
  return slug(item?.system?.slug ?? item?.flags?.add2e?.slug ?? item?.name ?? item?.system?.nom);
}

function currentPrice(item) {
  const system = item?.system ?? {};
  const raw = system.prix ?? system.price ?? null;
  if (typeof raw === "number" && raw > 0) return `${raw} ${text(system.devise ?? system.currency ?? "po").toLowerCase() || "po"}`;
  if (typeof raw === "string" && raw.trim()) return text(raw);
  if (raw && typeof raw === "object") {
    const amount = Number(raw.valeur ?? raw.value ?? raw.montant ?? raw.amount);
    const currency = text(raw.devise ?? raw.currency ?? system.devise ?? system.currency ?? "po").toLowerCase() || "po";
    if (Number.isFinite(amount) && amount > 0) return `${amount} ${currency}`;
  }
  return null;
}

function equipmentIndex(items) {
  const index = new Map();
  for (const item of items.filter(item => !isComponentItem(item))) {
    const key = itemSlug(item);
    if (!key) continue;
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(item);
  }
  return index;
}

function equipmentCandidates(entry) {
  return unique([
    entry.key,
    ...entry.rawKeys,
    ...(EQUIPMENT_ALIASES[entry.key] ?? [])
  ]);
}

function findEquipmentMatches(entry, index) {
  const seen = new Set();
  const matches = [];
  for (const key of equipmentCandidates(entry)) {
    for (const item of index.get(key) ?? []) {
      const identity = text(item?._id ?? item?.id ?? item?.name);
      if (seen.has(identity)) continue;
      seen.add(identity);
      matches.push(item);
    }
  }
  return matches;
}

function numericPo(value) {
  const raw = typeof value === "number"
    ? value
    : typeof value === "string"
      ? Number(value.replace(",", "."))
      : Number(value?.po ?? value?.value ?? value?.valeur ?? value?.amount ?? NaN);
  return Number.isFinite(raw) && raw > 0 ? raw : null;
}

function explicitPriceFromName(value) {
  const match = text(value).match(/(\d[\d\s.,]*)\s*(pp|po|pe|pa|pc)\b/i);
  if (!match) return null;
  const amount = Number(match[1].replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(amount) && amount > 0 ? `${Number.isInteger(amount) ? amount : String(amount).replace(".", ",")} ${match[2].toLowerCase()}` : null;
}

function tokensFor(value) {
  return new Set(slug(value).split("_").filter(Boolean));
}

function hasAny(tokens, values) {
  return values.some(value => tokens.has(value));
}

function tierPrice(label) {
  return PRICE_TIERS.find(tier => tier.label === label) ?? PRICE_TIERS[3];
}

function lowerOneTier(price) {
  const index = PRICE_TIERS.findIndex(tier => tier.label === price.label);
  return PRICE_TIERS[Math.max(0, index - 1)];
}

function estimatePrice(entry) {
  const canonical = EXACT_ESTIMATES[entry.key];
  if (canonical) return { price: canonical, rule: "estimation_exacte" };

  const tokens = new Set();
  for (const name of entry.names) for (const token of tokensFor(name)) tokens.add(token);
  for (const key of entry.rawKeys) for (const token of tokensFor(key)) tokens.add(token);

  let tier;
  let rule;

  if (hasAny(tokens, ["diamant", "rubis", "saphir", "topaze", "opale", "emeraude"])) {
    tier = tierPrice("100 po");
    rule = "gemme_precieuse";
  } else if (hasAny(tokens, ["jade", "ambre", "ivoire", "perle", "agate"])) {
    tier = tierPrice("10 po");
    rule = "matiere_precieuse";
  } else if (hasAny(tokens, ["platine"])) {
    tier = tierPrice("50 po");
    rule = "metal_precieux";
  } else if (hasAny(tokens, ["or", "argent", "electrum"])) {
    tier = tierPrice("10 po");
    rule = "metal_precieux";
  } else if (hasAny(tokens, ["dragon", "demon", "diable", "celeste", "elemental", "golem", "licorne", "sphinx", "chimere", "manticore", "hydre", "magique", "enchante", "rare"])) {
    tier = tierPrice("50 po");
    rule = "matiere_exceptionnelle";
  } else if (hasAny(tokens, ["venin", "poison", "antidote", "mandragore", "safran", "orchidee", "alchimique", "alchimie", "mercure", "glande", "cerveau", "coeur", "foie"])) {
    tier = tierPrice("5 po");
    rule = "reagent_rare";
  } else if (hasAny(tokens, ["poudre", "soufre", "souffre", "phosphore", "salpetre", "charbon", "chaux", "resine", "gomme", "huile", "vinaigre", "alcool", "encre", "metal", "fer", "cuivre", "laiton", "zinc", "plomb", "etain"])) {
    tier = tierPrice("1 po");
    rule = "reagent_courant";
  } else if (hasAny(tokens, ["sang", "os", "peau", "fourrure", "carapace", "coquille", "araignee", "luciole", "ver", "plume", "cil", "cheveux", "langue", "patte", "chair"])) {
    tier = tierPrice("1 pa");
    rule = "matiere_animale";
  } else if (hasAny(tokens, ["feuille", "fleur", "racine", "graine", "baie", "amande", "ail", "cire", "ficelle", "laine", "paille", "brin", "brindille", "ecorce", "herbe", "miel", "beurre", "farine", "poireau", "houx", "gland"])) {
    tier = tierPrice("5 pc");
    rule = "matiere_vegetale_ou_vivriere";
  } else if (hasAny(tokens, ["argile", "boue", "terre", "humus", "caillou", "silex", "craie", "sable", "cendre", "suie", "poussiere", "goutte", "grain", "eau", "feu", "flamme"])) {
    tier = tierPrice("1 pc");
    rule = "matiere_naturelle";
  } else {
    tier = tierPrice("1 po");
    rule = "objet_ou_matiere_courante";
  }

  if (hasAny(tokens, ["pincee", "goutte", "grain"]) && rule !== "matiere_naturelle") {
    tier = lowerOneTier(tier);
    rule = `${rule}_petite_quantite`;
  }

  return { price: tier.label, rule };
}

function classifyPrice(entry, index) {
  const explicitCosts = [...new Set(entry.details.map(detail => numericPo(detail.cout_po)).filter(value => value !== null))].sort((left, right) => left - right);
  if (explicitCosts.length) {
    return {
      price: `${explicitCosts.at(-1)} po`,
      source: explicitCosts.length === 1 ? "cout_explicite_sort" : "cout_explicite_sort_maximum"
    };
  }

  const namedPrices = [...new Set(entry.names.map(explicitPriceFromName).filter(Boolean))];
  if (namedPrices.length) return { price: namedPrices[0], source: "cout_explicite_nom" };

  const equipment = findEquipmentMatches(entry, index);
  const equipmentPrices = [...new Set(equipment.map(currentPrice).filter(Boolean))];
  if (equipmentPrices.length === 1) return { price: equipmentPrices[0], source: "prix_equipement", equipment };

  const predicted = estimatePrice(entry);
  return { price: predicted.price, source: predicted.rule, equipment };
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

function componentTags(existing, key) {
  const retained = asArray(existing).map(text).filter(value => value && !(
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
    `objet:${key}`,
    "composant_sort",
    `composant:${key}`,
    "consommable",
    ...retained
  ]);
}

function componentEffectTags(existing, key) {
  const retained = asArray(existing).map(text).filter(value => value && !(
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
    `objet_${key}`,
    "composant_sort",
    `composant_${key}`,
    "consommable",
    ...retained
  ]);
}

function createComponent(template, entry, priceRow, id, sort) {
  const item = clone(template);
  const system = item.system ??= {};
  const flags = item.flags ??= {};
  const add2e = flags.add2e ??= {};

  item._id = id;
  item.name = entry.name;
  item.type = "objet";
  item.sort = sort;

  system.nom = entry.name;
  system.type = "objet";
  system.categorie = "composant_sort";
  system.sousType = "composant";
  system.slug = entry.key;
  system.quantite = 1;
  system.equipee = false;
  system.magique = false;
  system.consommable = true;
  system.description = `Composant de sort : ${entry.name}.`;
  system.prix = priceRow.prix;
  delete system.cout;
  delete system.coût;
  delete system.source_prix;
  delete system.source_note;
  delete system.source_composant;
  system.tags = componentTags(system.tags, entry.key);
  system.effectTags = componentEffectTags(system.effectTags, entry.key);
  system.sorts_associes = unique(entry.details.map(detail => detail.sort)).sort((left, right) => left.localeCompare(right, "fr"));
  system.sorts_associes_details = clone(entry.details);
  system.consommations_associees = unique(entry.details.map(detail => detail.consommation)).sort((left, right) => left.localeCompare(right, "fr"));
  system.conditions_associees = unique(entry.details.map(detail => detail.condition)).sort((left, right) => left.localeCompare(right, "fr"));

  add2e.schema = "equipement-composant-sort";
  add2e.slug = entry.key;
  add2e.generatedBy = "normalize-fvtt-spells-materials-v3";
  add2e.generatedFrom = SOURCE_V3;
  add2e.vendorItem = true;
  add2e.vendorKind = "component";
  add2e.vendorStockMax = Number(add2e.vendorStockMax) || 20;

  return item;
}

function createAudit(catalog, allEquipment) {
  const index = equipmentIndex(allEquipment);
  const components = [];
  const summary = {
    sortsAnalyses: catalog.spellCount,
    occurrencesV3: catalog.componentOccurrences,
    composantsUniques: 0,
    coutExpliciteSort: 0,
    prixEquipement: 0,
    prixPredit: 0
  };

  for (const entry of catalog.entries.values()) {
    const resolved = classifyPrice(entry, index);
    if (resolved.source === "cout_explicite_sort" || resolved.source === "cout_explicite_sort_maximum" || resolved.source === "cout_explicite_nom") summary.coutExpliciteSort += 1;
    else if (resolved.source === "prix_equipement") summary.prixEquipement += 1;
    else summary.prixPredit += 1;

    components.push({
      slug: entry.key,
      nom: entry.name,
      variantes: entry.names,
      prix: resolved.price,
      origine_prix: resolved.source,
      equipements_equivalents: (resolved.equipment ?? []).map(item => ({
        nom: text(item?.name ?? item?.system?.nom),
        prix: currentPrice(item)
      })),
      usages: entry.details.map(detail => ({
        sort: detail.sort,
        classe: detail.classe,
        niveau: detail.niveau,
        quantite: detail.quantite,
        consommation: detail.consommation,
        cout_po: detail.cout_po ?? null
      }))
    });
  }

  summary.composantsUniques = components.length;
  return {
    version: VERSION,
    source: SOURCE_V3,
    cible: EQUIPMENT_COMPENDIUM,
    policy: "Les composants proviennent exclusivement de system.composants_materiels dans le JSON V3. Le compendium équipements est complété à partir de cette liste. Les prix sont explicites dans system.prix.",
    summary,
    components
  };
}

function rebuildEquipmentCompendium(source, audit) {
  const compendiumPath = path.join(ROOT, EQUIPMENT_COMPENDIUM);
  const compendium = readJson(compendiumPath, null);
  if (!compendium || typeof compendium !== "object") throw new Error(`Compendium introuvable ou invalide : ${EQUIPMENT_COMPENDIUM}`);

  const allItems = getItems(compendium).map(clone);
  const previousComponents = allItems.filter(isComponentItem);
  const remaining = allItems.filter(item => !isComponentItem(item));
  const template = previousComponents[0] ? clone(previousComponents[0]) : null;
  if (!template) throw new Error(`Aucun modèle de composant disponible dans ${EQUIPMENT_COMPENDIUM}.`);

  const catalog = buildCatalogFromV3(source);
  const rows = new Map(audit.components.map(row => [row.slug, row]));
  const usedIds = new Set(remaining.map(item => text(item?._id ?? item?.id)).filter(Boolean));
  let sort = allItems.reduce((highest, item) => Math.max(highest, Number(item?.sort) || 0), 0) + 1;
  const generated = [];

  for (const entry of catalog.entries.values()) {
    const priceRow = rows.get(entry.key);
    if (!priceRow?.prix) throw new Error(`Prix non résolu pour ${entry.name}.`);
    generated.push(createComponent(template, entry, priceRow, makeId(`component:${entry.key}`, usedIds), sort));
    sort += 1;
  }

  setItems(compendium, [...remaining, ...generated]);
  writeJson(compendiumPath, compendium);

  return {
    composantsSupprimes: previousComponents.length,
    composantsCrees: generated.length,
    objetsNonComposantsConserves: remaining.length
  };
}

function parseArgs(argv) {
  const auditOnly = argv.includes("--audit-prices");
  const positional = argv.filter(value => value && !value.startsWith("--"));
  return {
    auditOnly,
    source: positional[0] || SOURCE_V3,
    control: positional[1] || CONTROL
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const sourcePath = path.join(ROOT, args.source);
  const source = readJson(sourcePath, null);
  if (!source || typeof source !== "object") throw new Error(`Source V3 introuvable ou invalide : ${args.source}`);

  const compendium = readJson(path.join(ROOT, EQUIPMENT_COMPENDIUM), null);
  if (!compendium || typeof compendium !== "object") throw new Error(`Compendium introuvable ou invalide : ${EQUIPMENT_COMPENDIUM}`);

  const catalog = buildCatalogFromV3(source);
  const audit = createAudit(catalog, getItems(compendium));
  const controlPath = path.join(ROOT, args.control);
  const control = readJson(controlPath, {}) ?? {};
  control.version = VERSION;
  control.componentPriceAudit = audit;
  writeJson(controlPath, control);

  const summary = audit.summary;
  console.log(`[ADD2E][COMPONENT_PRICE_AUDIT] ${summary.composantsUniques} composant(s) unique(s) issus exclusivement de ${SOURCE_V3}.`);
  console.log(`[ADD2E][COMPONENT_PRICE_AUDIT] ${summary.coutExpliciteSort} prix explicite(s), ${summary.prixEquipement} prix d'équipement, ${summary.prixPredit} estimation(s).`);

  if (args.auditOnly) return;

  const rebuilt = rebuildEquipmentCompendium(source, audit);
  control.componentCatalog = {
    version: VERSION,
    source: SOURCE_V3,
    cible: EQUIPMENT_COMPENDIUM,
    ...rebuilt
  };
  writeJson(controlPath, control);

  console.log(`[ADD2E][COMPONENT_CATALOG] ${rebuilt.composantsSupprimes} ancien(s) composant(s) supprimé(s), ${rebuilt.composantsCrees} composant(s) créé(s).`);
}

main();
