import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const EQUIPMENT_FILE = "sources/Item-Equipements.json";
const V4_FILE = "fvtt-spells-all-normalise-mecanique-v4.json";
const VERSION = "2026-06-28-component-catalog-normalization-v3";

const PRICE_BANDS = {
  trivial: { label: "très commun / collecte immédiate", prices: ["1 pc", "2 pc", "3 pc", "4 pc", "5 pc", "6 pc", "8 pc", "9 pc"] },
  common: { label: "commun", prices: ["7 pc", "9 pc", "12 pc", "15 pc", "18 pc", "2 pa", "3 pa", "4 pa", "5 pa", "6 pa", "8 pa"] },
  prepared: { label: "préparé ou peu courant", prices: ["7 pa", "8 pa", "9 pa", "12 pa", "15 pa", "18 pa", "2 po", "3 po", "4 po", "5 po"] },
  crafted: { label: "travaillé ou spécialisé", prices: ["6 pa", "8 pa", "12 pa", "15 pa", "18 pa", "2 po", "3 po", "4 po", "5 po", "6 po", "8 po"] },
  rare: { label: "rare", prices: ["8 po", "10 po", "12 po", "15 po", "18 po", "20 po", "25 po", "30 po", "35 po", "40 po", "50 po", "60 po", "75 po"] },
  precious: { label: "précieux ou alchimique", prices: ["80 po", "100 po", "125 po", "150 po", "200 po", "250 po", "300 po", "400 po", "500 po", "750 po"] }
};

const EXACT_ALIASES = new Map([
  ["eau pure", "Eau"],
  ["l eau", "Eau"],
  ["goutte d eau", "Eau"],
  ["gouttes d eau", "Eau"],
  ["pincee de sable", "Sable"],
  ["pincee de sable fin", "Sable fin"],
  ["pincee de poudre de cuivre", "Poudre de cuivre"],
  ["pincee de poudre de diamant", "Poudre de diamant"],
  ["pincee d os en poudre", "Poudre d’os"],
  ["pincee de suie", "Suie"],
  ["pincee de souffre", "Soufre"],
  ["pincee de poussiere", "Poussière"],
  ["pincee de poussiere d un cimetiere", "Poussière de cimetière"],
  ["pincee d humus", "Humus"],
  ["pincee de bouse", "Bouse"],
  ["pincee de graines de sesame", "Graines de sésame"],
  ["pincee de poudre de carotte sechee", "Poudre de carotte séchée"],
  ["goutte de mercure", "Mercure"],
  ["goutte d huile", "Huile"],
  ["goutte de bitume", "Bitume"],
  ["goutte de poix", "Poix"],
  ["goutte de melasse", "Mélasse"],
  ["poudre d argent qu il faut repandre", "Poudre d’argent"],
  ["poudre de poix seches", "Poudre de poix"],
  ["poudre de poix sechee", "Poudre de poix"],
  ["poudre de fer et aimant", "Poudre de fer et aimant"],
  ["poussiere de laiton", "Poudre de laiton"],
  ["eclat de mica", "Mica"],
  ["fine feuille de cristal de 6 cm2", "Feuille de cristal"],
  ["perle ecrasee d au moins 100 po", "Perle écrasée"],
  ["poudre d un diamant d au moins 2 000 po", "Poudre de diamant"],
  ["poudre d un diamant d au moins 2000 po", "Poudre de diamant"],
  ["poudre composee de diamant", "Poudre de diamant"],
  ["soie multicolore extremement fine", "Soie multicolore fine"],
  ["soie multicolore tres fine", "Soie multicolore fine"],
  ["poudre d argent", "Poudre d’argent"],
  ["poudre de souffre", "Poudre de soufre"],
  ["pincee de talc", "Talc"],
  ["pincee de terre", "Terre"]
]);

const text = value => String(value ?? "").replace(/\s+/g, " ").trim();
const own = (object, field) => Object.prototype.hasOwnProperty.call(object ?? {}, field);
const read = file => JSON.parse(fs.readFileSync(file, "utf8"));
const write = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");

function fold(value) {
  return text(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, " ")
    .toLocaleLowerCase("fr");
}

function idOf(value) {
  return fold(value).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function display(value) {
  const result = text(value);
  return result ? result[0].toLocaleUpperCase("fr") + result.slice(1) : result;
}

function hash(value) {
  let result = 2166136261;
  for (const character of String(value)) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function collection(document) {
  if (Array.isArray(document)) return document;
  for (const field of ["documents", "items", "Item", "Items", "data", "entries"]) {
    if (Array.isArray(document?.[field])) return document[field];
  }
  return null;
}

function isSpell(item) {
  return fold(item?.type ?? item?.system?.type) === "sort";
}

function asNumber(value) {
  const parsed = typeof value === "number" ? value : Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function pricePo(value) {
  const match = text(value).match(/^([0-9]+(?:[.,][0-9]+)?)\s*(pp|po|pe|pa|pc)?$/i);
  if (!match) return null;
  const quantity = Number(match[1].replace(",", "."));
  const unit = (match[2] ?? "po").toLocaleLowerCase("fr");
  const rates = { pp: 5, po: 1, pe: .5, pa: .1, pc: .01 };
  return Number.isFinite(quantity) && quantity > 0 && own(rates, unit) ? quantity * rates[unit] : null;
}

function formatPo(value) {
  const pc = Math.max(1, Math.round(Number(value) * 100));
  if (pc < 10) return `${pc} pc`;
  if (pc < 100) return pc % 10 === 0 ? `${pc / 10} pa` : `${pc} pc`;
  return pc % 100 === 0 ? `${pc / 100} po` : `${pc / 100} po`;
}

function inferValueFloor(name) {
  const match = fold(name).match(/\b(?:au moins|valeur(?: minimale)? de|d une valeur de)\s*([0-9][0-9\s.,]*)\s*po\b/);
  if (!match) return null;
  const value = Number(match[1].replace(/[\s.,]/g, ""));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function isReusable(raw) {
  const name = fold(raw?.nom);
  const consumption = fold(raw?.consommation);
  return /reutilis|non consom|focus/.test(consumption)
    || /symbole sacre|gui(?: druidique| majeur)?|chapelet|livre de priere|symbole religieux|objet de priere/.test(name);
}

function malformed(raw) {
  const value = text(raw);
  const compact = fold(value);
  if (!value || /\ba completer\b|\ba remplir\b|materielle? non precise/.test(compact)) return "placeholder";
  const opened = [...value].filter(character => character === "(").length;
  const closed = [...value].filter(character => character === ")").length;
  if (opened !== closed || /^[)\]}]|[)\]}]$/.test(value)) return "fragment_parenthesis";
  if (/^(?:de|du|des|d|en|et|soit|reduit|reduite|reparti|repartie)\b/.test(compact)) return "fragment_continuation";
  if (/^invocation d un elemental\b|^creation d un objet\b|^matiere vegetale similaire\b|^objet similaire\b|^l un des elements suivants\b/.test(compact)) return "contextual_instruction";
  if (/consommation explicitement indiquee|disparait quand|pour chaque|objets magiques|objet de valeur|source de feu|\bl original\b|\bcreature\b/.test(compact)) return "contextual_instruction";
  return null;
}

function manualSpecial(raw) {
  const value = fold(raw);
  return /\bpotion\b|parchemin magique|gemme d emprisonnement|objet magique|sang de dragon|os de dragon|coffre de grande valeur|\breceptacle\b/.test(value);
}

function canonicalFromRaw(raw, entry = {}) {
  const original = text(raw);
  const normalized = fold(original);
  const bad = malformed(original);
  if (bad) return { status: "review", reason: bad, raw: original, canonical: null, alias: false, valueFloorPo: null };
  if (manualSpecial(original)) return { status: "review", reason: "special_value_or_magic", raw: original, canonical: null, alias: false, valueFloorPo: null };
  if (/^(?:feu|flamme|flammes chaudes)$/i.test(normalized)) return { status: "review", reason: "non_inventory_energy", raw: original, canonical: null, alias: false, valueFloorPo: null };
  const canonical = EXACT_ALIASES.get(normalized) ?? display(original);
  return {
    status: isReusable(entry) ? "reusable" : "catalogue",
    reason: EXACT_ALIASES.has(normalized) ? "canonical_alias" : "canonical_exact",
    raw: original,
    canonical,
    alias: canonical !== display(original),
    valueFloorPo: inferValueFloor(original)
  };
}

function rarity(name, note = "") {
  const value = fold(`${name} ${note}`);

  if (/diamant|rubis|saphir|emeraude|topaze|opale|perle|gemme|pierres precieuses|pierre precieuse|jade|ivoire|platine/.test(value)) return "precious";
  if (/agate|quartz|ambre|mercure|or\b|argent\b|electrum|myrrhe|encens|parfum|corail|nacre|soie|safran|orchidee/.test(value)) return "rare";

  if (/aiguille de pin|feuille|brindille|branche|ecorce|gland|graine|houx|gui|trefle|pomme de pin|petale|racine|fleur|herbe|mousse|boue|terre|sable|cendre|poussiere|caillou|motte|eau\b|goutte d eau|insecte|araignee|toile d araignee|coquille|poil|cheveux|cil|plume/.test(value)) return "trivial";
  if (/poudre|gomme|resine|cire|soufre|salpetre|phosphore|pigment|teinture|huile|alcool|vinaigre|sel|argile|verre|encre|charbon|poix|chaux|miel|beurre|creme|limaille|alun|bitume|melasse/.test(value)) return "prepared";
  if (/miroir|aimant|lentille|cloche|grelot|anneau|bague|clef|cle\b|fiole|flacon|figurine|maquette|miniature|statuette|masque|fil de|tissu|corde|sifflet|baguette|barre de metal|tige de metal|lame en fer|plaque de fer|coffre|gant|pelle|baquet|tambour|couronne/.test(value)) return "crafted";

  return "common";
}

function materialEntries(v4) {
  const items = collection(v4);
  if (!items) throw new Error(`${V4_FILE} ne contient pas de collection d'items.`);
  const entries = [];
  for (const item of items) {
    if (!isSpell(item) || !Array.isArray(item?.system?.composants_materiels)) continue;
    for (let index = 0; index < item.system.composants_materiels.length; index += 1) {
      const material = item.system.composants_materiels[index];
      const canonical = canonicalFromRaw(material?.nom, material);
      entries.push({
        item,
        material,
        index,
        spell: text(item?.name ?? item?.system?.nom),
        className: text(item?.system?.classe),
        level: Number(item?.system?.niveau ?? 0) || null,
        notes: text(material?.notes),
        quantity: Math.max(1, Math.floor(asNumber(material?.quantite) ?? 1)),
        costPo: asNumber(material?.cout_po),
        consumption: text(material?.consommation),
        ...canonical
      });
    }
  }
  return entries;
}

function existingComponents(equipment) {
  const docs = collection(equipment);
  if (!docs) throw new Error(`${EQUIPMENT_FILE} ne contient pas de collection documents.`);
  const index = new Map();
  for (const document of docs) {
    const system = document?.system ?? {};
    const category = fold(system.categorie ?? system.category);
    const subtype = fold(system.sousType ?? system.sous_type ?? system.type);
    const tags = Array.isArray(system.tags) ? system.tags.map(fold) : [];
    const component = category === "composant_sort" || subtype === "composant" || tags.some(tag => tag === "composant_sort" || tag.startsWith("composant:"));
    if (!component) continue;
    const canonical = canonicalFromRaw(document?.name ?? system.nom, system);
    if (!canonical.canonical) continue;
    const id = idOf(canonical.canonical);
    const entries = index.get(id) ?? [];
    entries.push(document);
    index.set(id, entries);
  }
  return index;
}

function buildGroups(entries) {
  const groups = new Map();
  for (const entry of entries) {
    if (!entry.canonical || !["catalogue", "reusable"].includes(entry.status)) continue;
    const id = idOf(entry.canonical);
    const group = groups.get(id) ?? {
      id,
      name: entry.canonical,
      kind: entry.status,
      entries: [],
      rawNames: new Set(),
      notes: new Set(),
      spells: new Set(),
      explicitUnitCosts: new Set(),
      valueFloors: new Set()
    };
    if (entry.status === "reusable") group.kind = "reusable";
    group.entries.push(entry);
    group.rawNames.add(entry.raw);
    if (entry.notes) group.notes.add(entry.notes);
    if (entry.spell) group.spells.add(entry.spell);
    if (entry.costPo > 0) group.explicitUnitCosts.add(Math.round((entry.costPo / entry.quantity) * 100000) / 100000);
    if (entry.valueFloorPo > 0) group.valueFloors.add(entry.valueFloorPo);
    groups.set(id, group);
  }
  return groups;
}

function previewPrice(group, matches) {
  const explicit = [...group.explicitUnitCosts].sort((a, b) => a - b);
  const floors = [...group.valueFloors].sort((a, b) => a - b);
  const existing = matches.length === 1 ? pricePo(matches[0]?.system?.prix ?? matches[0]?.system?.cout) : null;

  if (explicit.length === 1) return { label: formatPo(explicit[0]), po: explicit[0], origin: "explicit_v4", rarity: null };
  if (floors.length === 1) return { label: formatPo(floors[0]), po: floors[0], origin: "value_floor_in_name", rarity: null };
  if (existing > 0) return { label: text(matches[0]?.system?.prix ?? matches[0]?.system?.cout), po: existing, origin: "existing_compendium", rarity: null };

  const band = rarity(group.name, [...group.notes].join(" "));
  const label = PRICE_BANDS[band].prices[hash(group.id) % PRICE_BANDS[band].prices.length];
  return { label, po: pricePo(label), origin: explicit.length > 1 || floors.length > 1 ? "conflicting_values_requires_review" : "rarity_preview", rarity: band };
}

function buildReport(equipment, v4) {
  const entries = materialEntries(v4);
  const groups = buildGroups(entries);
  const existing = existingComponents(equipment);

  const summary = {
    v4MaterialEntries: entries.length,
    canonicalCatalogueEntries: entries.filter(entry => entry.status === "catalogue").length,
    reusableEntries: entries.filter(entry => entry.status === "reusable").length,
    canonicalAliases: entries.filter(entry => entry.alias).length,
    normalizationReview: entries.filter(entry => entry.status === "review").length,
    canonicalGroups: groups.size,
    groupsExistingInCompendium: 0,
    groupsMissingInCompendium: 0,
    groupsAmbiguousInCompendium: 0,
    pricesExplicitV4: 0,
    pricesValueFloor: 0,
    pricesExistingCompendium: 0,
    pricesRarityPreview: 0,
    v4CostAlreadySet: entries.filter(entry => entry.costPo > 0).length,
    v4CostEligibleAfterNormalization: 0,
    v4CostBlockedByReview: 0,
    rarity: Object.fromEntries(Object.keys(PRICE_BANDS).map(name => [name, 0]))
  };

  const catalogue = [];
  for (const group of [...groups.values()].sort((left, right) => left.name.localeCompare(right.name, "fr"))) {
    const matches = existing.get(group.id) ?? [];
    const price = previewPrice(group, matches);
    if (matches.length === 1) summary.groupsExistingInCompendium += 1;
    else if (!matches.length) summary.groupsMissingInCompendium += 1;
    else summary.groupsAmbiguousInCompendium += 1;

    if (price.origin === "explicit_v4") summary.pricesExplicitV4 += 1;
    if (price.origin === "value_floor_in_name") summary.pricesValueFloor += 1;
    if (price.origin === "existing_compendium") summary.pricesExistingCompendium += 1;
    if (price.origin === "rarity_preview") {
      summary.pricesRarityPreview += 1;
      summary.rarity[price.rarity] += 1;
    }

    catalogue.push({
      name: group.name,
      kind: group.kind,
      rawNames: [...group.rawNames].sort((a, b) => a.localeCompare(b, "fr")),
      spells: [...group.spells].sort((a, b) => a.localeCompare(b, "fr")),
      notes: [...group.notes].sort((a, b) => a.localeCompare(b, "fr")),
      explicitUnitCostsPo: [...group.explicitUnitCosts].sort((a, b) => a - b),
      valueFloorsPo: [...group.valueFloors].sort((a, b) => a - b),
      compendium: matches.length === 1 ? { status: "existing", name: text(matches[0]?.name ?? matches[0]?.system?.nom) } : matches.length ? { status: "ambiguous", names: matches.map(match => text(match?.name ?? match?.system?.nom)) } : { status: "missing" },
      pricePreview: price
    });
  }

  const review = entries
    .filter(entry => entry.status === "review")
    .map(entry => ({ spell: entry.spell, classe: entry.className, niveau: entry.level, material: entry.raw || null, reason: entry.reason }))
    .sort((left, right) => `${left.spell}|${left.material}`.localeCompare(`${right.spell}|${right.material}`, "fr"));

  const aliases = entries
    .filter(entry => entry.alias)
    .map(entry => ({ spell: entry.spell, classe: entry.className, niveau: entry.level, raw: entry.raw, canonical: entry.canonical, valueFloorPo: entry.valueFloorPo }))
    .sort((left, right) => `${left.canonical}|${left.raw}`.localeCompare(`${right.canonical}|${right.raw}`, "fr"));

  const costEligibility = [];
  for (const entry of entries) {
    if (entry.costPo > 0) continue;
    if (!entry.canonical || entry.status === "review") {
      summary.v4CostBlockedByReview += 1;
      continue;
    }
    const group = groups.get(idOf(entry.canonical));
    const catalogueEntry = catalogue.find(candidate => candidate.name === group?.name);
    if (!catalogueEntry || catalogueEntry.compendium.status === "ambiguous" || catalogueEntry.pricePreview.origin === "conflicting_values_requires_review") {
      summary.v4CostBlockedByReview += 1;
      continue;
    }
    summary.v4CostEligibleAfterNormalization += 1;
    costEligibility.push({
      spell: entry.spell,
      classe: entry.className,
      niveau: entry.level,
      raw: entry.raw,
      canonical: entry.canonical,
      quantite: entry.quantity,
      unitPrice: catalogueEntry.pricePreview.label,
      suggestedCoutPo: Math.round(catalogueEntry.pricePreview.po * entry.quantity * 100000) / 100000
    });
  }

  return {
    version: VERSION,
    scope: {
      sourceOfTruth: V4_FILE,
      compendium: EQUIPMENT_FILE,
      mode: "diagnostic de normalisation uniquement",
      writes: "aucune écriture : V4 et le compendium restent inchangés",
      nextStep: "Corriger les entrées V4 signalées review, puis seulement appliquer le catalogue et les prix."
    },
    summary,
    aliases,
    review,
    catalogue,
    v4CostEligibility: costEligibility
  };
}

function print(report, options) {
  const s = report.summary;
  console.log(`[ADD2E][COMPONENT_CATALOG_V4] ${VERSION}.`);
  console.log(`[ADD2E][COMPONENT_CATALOG_V4] V4 : ${s.v4MaterialEntries} entrée(s), catalogue ${s.canonicalCatalogueEntries}, réutilisables ${s.reusableEntries}, alias ${s.canonicalAliases}, à normaliser ${s.normalizationReview}.`);
  console.log(`[ADD2E][COMPONENT_CATALOG_V4] Catalogue : groupes ${s.canonicalGroups}, existants ${s.groupsExistingInCompendium}, à créer ${s.groupsMissingInCompendium}, ambigus ${s.groupsAmbiguousInCompendium}.`);
  console.log(`[ADD2E][COMPONENT_CATALOG_V4] Prix : V4 explicites ${s.pricesExplicitV4}, valeur explicitée dans le nom ${s.pricesValueFloor}, compendium existant ${s.pricesExistingCompendium}, aperçus rareté ${s.pricesRarityPreview}.`);
  console.log(`[ADD2E][COMPONENT_CATALOG_V4] Rareté : très commun ${s.rarity.trivial}, commun ${s.rarity.common}, préparé ${s.rarity.prepared}, travaillé ${s.rarity.crafted}, rare ${s.rarity.rare}, précieux ${s.rarity.precious}.`);
  console.log(`[ADD2E][COMPONENT_CATALOG_V4] cout_po V4 : déjà renseigné ${s.v4CostAlreadySet}, éligible après normalisation ${s.v4CostEligibleAfterNormalization}, bloqué ${s.v4CostBlockedByReview}.`);

  if (options.showAll) {
    for (const item of report.catalogue) {
      console.log(`[ADD2E][COMPONENT_CATALOG_V4] ${item.compendium.status} : ${item.name} — ${item.pricePreview.label} (${item.pricePreview.origin}).`);
    }
    for (const alias of report.aliases) {
      console.log(`[ADD2E][COMPONENT_CATALOG_V4] alias : ${alias.raw} → ${alias.canonical}${alias.valueFloorPo ? ` (minimum ${alias.valueFloorPo} PO)` : ""}.`);
    }
  }
  for (const item of report.review) {
    console.log(`[ADD2E][COMPONENT_CATALOG_V4] revue ${item.reason} : ${item.spell} — ${item.material ?? "nom vide"}.`);
  }
}

function parseArgs(argv) {
  const options = { showAll: false, report: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--diagnose") continue;
    if (arg === "--show-all") {
      options.showAll = true;
      continue;
    }
    if (arg === "--report") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error("Valeur manquante pour --report.");
      options.report = value;
      index += 1;
      continue;
    }
    if (arg === "--apply") throw new Error("--apply est volontairement désactivé tant que le diagnostic de normalisation V4 contient des entrées à revoir.");
    if (arg === "--help" || arg === "-h") {
      console.log("Usage:");
      console.log("  node audit/tools/price-spell-components.mjs --diagnose [--show-all] [--report audit/rapports/NORMALISATION-COMPOSANTS-V4.json]");
      console.log("Ce mode est lecture seule : il ne modifie ni V4 ni sources/Item-Equipements.json.");
      process.exit(0);
    }
    throw new Error(`Argument inconnu : ${arg}`);
  }
  return options;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const report = buildReport(
    read(path.join(ROOT, EQUIPMENT_FILE)),
    read(path.join(ROOT, V4_FILE))
  );
  print(report, options);
  if (options.report) {
    const output = path.resolve(ROOT, options.report);
    write(output, report);
    console.log(`[ADD2E][COMPONENT_CATALOG_V4] Rapport écrit : ${path.relative(ROOT, output)}.`);
  }
}

main();
