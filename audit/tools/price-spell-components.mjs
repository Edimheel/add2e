import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const EQUIPMENT_FILE = "sources/Item-Equipements.json";
const V3_FILE = "fvtt-spells-all-normalise-mecanique-v3.json";
const VERSION = "2026-06-28-component-price-rarity-v1";

const BANDS = {
  trivial: { label: "très commun / collecte immédiate", prices: ["1 pc", "2 pc", "3 pc", "4 pc", "5 pc", "6 pc", "8 pc", "9 pc"] },
  common: { label: "commun", prices: ["7 pc", "9 pc", "12 pc", "15 pc", "18 pc", "2 pa", "3 pa", "4 pa", "5 pa", "6 pa", "8 pa"] },
  prepared: { label: "préparé ou peu courant", prices: ["7 pa", "8 pa", "9 pa", "12 pa", "15 pa", "18 pa", "2 po", "3 po", "4 po", "5 po"] },
  crafted: { label: "travaillé ou spécialisé", prices: ["6 pa", "8 pa", "12 pa", "15 pa", "18 pa", "2 po", "3 po", "4 po", "5 po", "6 po", "8 po"] },
  rare: { label: "rare", prices: ["8 po", "10 po", "12 po", "15 po", "18 po", "20 po", "25 po", "30 po", "35 po", "40 po", "50 po", "60 po", "75 po"] },
  precious: { label: "précieux ou alchimique", prices: ["80 po", "100 po", "125 po", "150 po", "200 po", "250 po", "300 po", "400 po", "500 po", "750 po"] }
};

const text = value => String(value ?? "").replace(/\s+/g, " ").trim();
const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object ?? {}, key);
const read = file => JSON.parse(fs.readFileSync(file, "utf8"));
const write = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
const clone = value => JSON.parse(JSON.stringify(value));

function fold(value) {
  return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, " ").toLocaleLowerCase("fr");
}
function slug(value) {
  return fold(value).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
function hash(value) {
  let result = 2166136261;
  for (const character of String(value)) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}
function candidateKeys(name) {
  const direct = slug(name);
  const simplified = fold(name)
    .replace(/^(?:un|une|des|du|de la|de l|d)\s+/i, "")
    .replace(/^(?:petite?|grand(?:e)?|minuscule|fine?|grosse?)\s+/i, "")
    .replace(/^(?:pincee|goutte|grain|morceau|brin|poignee|fragment|once|fiole|sachet|poudre)\s+(?:de|d)\s+/i, "")
    .replace(/^(?:aile|plume|ecaille|poil|fourrure|dent|os)\s+(?:de|d)\s+/i, "");
  return [...new Set([direct, slug(simplified)])].filter(Boolean);
}
function collection(document) {
  if (Array.isArray(document)) return document;
  for (const key of ["documents", "items", "Item", "Items", "data", "entries"]) if (Array.isArray(document?.[key])) return document[key];
  return null;
}
function isSpell(item) {
  return fold(item?.type ?? item?.system?.type) === "sort";
}
function isComponent(document) {
  const system = document?.system ?? {};
  const category = fold(system.categorie ?? system.category);
  const subtype = fold(system.sousType ?? system.sous_type ?? system.type);
  const tags = Array.isArray(system.tags) ? system.tags.map(fold) : [];
  return category === "composant_sort" || subtype === "composant" || tags.some(tag => tag === "composant_sort" || tag.startsWith("composant:"));
}
function number(value) {
  const result = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(result) ? result : null;
}
function parsePrice(value) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return { po: value, label: formatPo(value) };
  const match = text(value).match(/^([0-9]+(?:[\.,][0-9]+)?)\s*(pp|po|pe|pa|pc)?$/i);
  if (!match) return null;
  const amount = Number(match[1].replace(",", "."));
  const unit = (match[2] ?? "po").toLocaleLowerCase("fr");
  const rates = { pp: 5, po: 1, pe: 0.5, pa: 0.1, pc: 0.01 };
  return Number.isFinite(amount) && amount > 0 && hasOwn(rates, unit) ? { po: amount * rates[unit], label: `${amount} ${unit}` } : null;
}
function formatPo(value) {
  const pc = Math.max(1, Math.round(Number(value) * 100));
  if (pc < 10) return `${pc} pc`;
  if (pc < 100) return pc % 10 === 0 ? `${pc / 10} pa` : `${pc} pc`;
  return pc % 100 === 0 ? `${pc / 100} po` : `${pc / 100} po`;
}
function price(label) {
  const parsed = parsePrice(label);
  if (!parsed) throw new Error(`Prix invalide : ${label}.`);
  return parsed;
}
function classify(document) {
  const system = document?.system ?? {};
  const body = fold([document?.name, system.nom, system.description, system.source_note, ...(Array.isArray(system.tags) ? system.tags : [])].join(" "));
  if (/diamant|rubis|saphir|emeraude|topaze|opale|perle|gemme|pierre precieuse|cristal pur|poudre de diamant|ivoire|platine/.test(body)) return "precious";
  if (/ambre|mercure|or\b|argent\b|electrum|myrrhe|encens rare|parfum|ambre gris|corail|nacre|soie/.test(body)) return "rare";
  if (/miroir|aimant|lentille|cloche|grelot|aiguille|anneau|bague|clef|cle|fiole|flacon|figurine|maquette|miniature|statuette|masque|fil d|tissu|corde|poupee/.test(body)) return "crafted";
  if (/poudre|gomme|resine|cire|soufre|salpetre|phosphore|pigment|teinture|huile|alcool|vinaigre|sel|argile|verre|plante rare|racine rare|champignon rare|mousse rare/.test(body)) return "prepared";
  if (/goutte d eau|goutte de sang|salive|poussiere|cendre|terre|boue|sable|brin d herbe|insecte|toile d araignee|poil|ongle|coquille vide/.test(body)) return "trivial";
  return "common";
}
function allMaterials(v3) {
  const items = collection(v3);
  if (!items) throw new Error(`${V3_FILE} ne contient pas de collection d'items.`);
  const result = [];
  for (const item of items) {
    if (!isSpell(item) || !Array.isArray(item?.system?.composants_materiels)) continue;
    for (let index = 0; index < item.system.composants_materiels.length; index += 1) {
      const entry = item.system.composants_materiels[index];
      if (text(entry?.nom)) result.push({ item, entry, index, name: text(entry.nom) });
    }
  }
  return result;
}
function directCosts(materials) {
  const costs = new Map();
  for (const material of materials) {
    const value = number(material.entry?.cout_po);
    if (!(value > 0)) continue;
    for (const key of candidateKeys(material.name)) {
      const entries = costs.get(key) ?? [];
      entries.push(value);
      costs.set(key, entries);
    }
  }
  return costs;
}
function uniqueCost(keys, costs) {
  const values = new Set();
  for (const key of keys) for (const value of costs.get(key) ?? []) values.add(value);
  if (!values.size) return { value: null, conflict: false };
  if (values.size === 1) return { value: [...values][0], conflict: false };
  return { value: null, conflict: true, values: [...values].sort((a, b) => a - b) };
}
function componentIndex(documents) {
  const index = new Map();
  for (const document of documents) {
    if (!isComponent(document)) continue;
    for (const key of candidateKeys(document?.name ?? document?.system?.nom)) {
      const entries = index.get(key) ?? [];
      entries.push(document);
      index.set(key, entries);
    }
  }
  return index;
}
function findComponent(name, index) {
  const found = new Set();
  for (const key of candidateKeys(name)) for (const document of index.get(key) ?? []) found.add(document);
  if (!found.size) return { document: null, ambiguous: false };
  if (found.size > 1) return { document: null, ambiguous: true, names: [...found].map(item => text(item?.name ?? item?.system?.nom)).sort((a, b) => a.localeCompare(b, "fr")) };
  return { document: [...found][0], ambiguous: false };
}
function choosePrice(document, costs) {
  const system = document.system ??= {};
  const existing = parsePrice(system.prix ?? system.cout);
  if (existing) return { price: existing, kind: "existing", rarity: null, source: text(system.source_prix) || "Prix existant conservé." };
  const exact = uniqueCost(candidateKeys(document?.name ?? system.nom), costs);
  if (exact.value != null) return { price: { po: exact.value, label: formatPo(exact.value) }, kind: "explicit_v3", rarity: null, source: `Coût explicite relevé dans V3 (${formatPo(exact.value)}), conservé pour le marchand.` };
  const rarity = classify(document);
  const label = BANDS[rarity].prices[hash(slug(document?.name ?? system.nom)) % BANDS[rarity].prices.length];
  const source = exact.conflict
    ? `Tarif marchand ADD2E — rareté ${BANDS[rarity].label}; coûts V3 incompatibles (${exact.values.join(", ")} PO), tarif déterministe ${VERSION}.`
    : `Tarif marchand ADD2E — rareté ${BANDS[rarity].label}; variation déterministe par composant (${VERSION}).`;
  return { price: price(label), kind: exact.conflict ? "automatic_after_v3_conflict" : "automatic", rarity, conflict: exact.values ?? null, source };
}
function rounded(value) {
  return Math.round(Number(value) * 100000) / 100000;
}
function parseArgs(argv) {
  const options = { apply: false, report: null, showAll: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--diagnose") options.apply = false;
    else if (arg === "--apply") options.apply = true;
    else if (arg === "--show-all") options.showAll = true;
    else if (arg === "--report") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error("Valeur manquante pour --report.");
      options.report = value;
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      console.log("Usage:");
      console.log("  node audit/tools/price-spell-components.mjs --diagnose [--show-all] [--report audit/rapports/PRIX-COMPOSANTS.json]");
      console.log("  node audit/tools/price-spell-components.mjs --apply [--show-all] [--report audit/rapports/PRIX-COMPOSANTS.json]");
      console.log("--apply modifie uniquement sources/Item-Equipements.json et fvtt-spells-all-normalise-mecanique-v3.json. V4 est exclue.");
      process.exit(0);
    } else throw new Error(`Argument inconnu : ${arg}`);
  }
  return options;
}
function plan(equipment, v3) {
  const documents = collection(equipment);
  if (!documents) throw new Error(`${EQUIPMENT_FILE} ne contient pas de collection documents.`);
  const components = documents.filter(isComponent);
  const materials = allMaterials(v3);
  const costs = directCosts(materials);
  const decisions = new Map();
  const changes = [];
  const conflicts = [];
  const summary = {
    equipmentComponents: components.length,
    existingPrices: 0,
    automaticPrices: 0,
    explicitV3Prices: 0,
    automaticAfterV3Conflicts: 0,
    synchronizedTwinFields: 0,
    rarity: Object.fromEntries(Object.keys(BANDS).map(key => [key, 0])),
    v3MaterialEntries: materials.length,
    v3CostsPreserved: 0,
    v3CostsToFill: 0,
    v3Unmatched: 0,
    v3Ambiguous: 0
  };
  for (const document of components) {
    const selected = choosePrice(document, costs);
    decisions.set(document, selected);
    if (selected.kind === "existing") summary.existingPrices += 1;
    if (selected.kind === "automatic") summary.automaticPrices += 1;
    if (selected.kind === "explicit_v3") summary.explicitV3Prices += 1;
    if (selected.kind === "automatic_after_v3_conflict") { summary.automaticAfterV3Conflicts += 1; conflicts.push({ name: text(document?.name ?? document?.system?.nom), valuesPo: selected.conflict }); }
    if (selected.rarity) summary.rarity[selected.rarity] += 1;
    const system = document.system ?? {};
    const samePrice = text(system.prix) === selected.price.label;
    const sameCost = text(system.cout) === selected.price.label;
    const sameSource = text(system.source_prix) === selected.source;
    if (!samePrice || !sameCost || !sameSource) {
      if (selected.kind === "existing" && (!samePrice || !sameCost)) summary.synchronizedTwinFields += 1;
      changes.push({ document, name: text(document?.name ?? system.nom), previousPrix: text(system.prix), previousCout: text(system.cout), price: selected.price.label, pricePo: selected.price.po, kind: selected.kind, rarity: selected.rarity, source: selected.source });
    }
  }
  const index = componentIndex(components);
  const v3Changes = [];
  for (const material of materials) {
    if (number(material.entry?.cout_po) > 0) { summary.v3CostsPreserved += 1; continue; }
    const match = findComponent(material.name, index);
    if (match.ambiguous) { summary.v3Ambiguous += 1; v3Changes.push({ ...material, action: "ambiguous", names: match.names }); continue; }
    if (!match.document) { summary.v3Unmatched += 1; v3Changes.push({ ...material, action: "missing" }); continue; }
    const selected = decisions.get(match.document);
    const quantity = Math.max(1, Number(material.entry?.quantite ?? 1) || 1);
    const costPo = rounded(selected.price.po * quantity);
    summary.v3CostsToFill += 1;
    v3Changes.push({ ...material, action: "fill", componentName: text(match.document?.name ?? match.document?.system?.nom), quantity, price: selected.price.label, costPo });
  }
  return { components, materials, changes, v3Changes, conflicts, summary };
}
function apply(plan) {
  for (const change of plan.changes) {
    const system = change.document.system ??= {};
    system.prix = change.price;
    system.cout = change.price;
    system.source_prix = change.source;
  }
  for (const change of plan.v3Changes) if (change.action === "fill") change.entry.cout_po = change.costPo;
}
function report(plan) {
  return {
    version: VERSION,
    scope: { equipment: EQUIPMENT_FILE, v3: V3_FILE, v4: "exclue", policy: "Prix existants préservés ; prix vides complétés par rareté avec variation déterministe ; cout_po V3 rempli à partir du prix unitaire marchand multiplié par quantite." },
    summary: clone(plan.summary),
    componentChanges: plan.changes.map(change => ({ name: change.name, previousPrix: change.previousPrix, previousCout: change.previousCout, price: change.price, pricePo: change.pricePo, kind: change.kind, rarity: change.rarity, source: change.source })),
    v3Changes: plan.v3Changes.map(change => ({ spell: text(change.item?.name ?? change.item?.system?.nom), classe: text(change.item?.system?.classe), niveau: Number(change.item?.system?.niveau ?? 0) || null, material: change.name, action: change.action, component: change.componentName ?? null, quantity: change.quantity ?? null, price: change.price ?? null, costPo: change.costPo ?? null, candidates: change.names ?? null })),
    explicitCostConflicts: plan.conflicts
  };
}
function print(plan, options) {
  const summary = plan.summary;
  console.log(`[ADD2E][COMPONENT_PRICE] ${VERSION}.`);
  console.log(`[ADD2E][COMPONENT_PRICE] Compendium : ${summary.equipmentComponents} composant(s), prix existants ${summary.existingPrices}, prix à générer ${summary.automaticPrices}, coûts explicites V3 ${summary.explicitV3Prices}, conflits V3 traités par rareté ${summary.automaticAfterV3Conflicts}.`);
  console.log(`[ADD2E][COMPONENT_PRICE] Rareté : très commun ${summary.rarity.trivial}, commun ${summary.rarity.common}, préparé ${summary.rarity.prepared}, travaillé ${summary.rarity.crafted}, rare ${summary.rarity.rare}, précieux ${summary.rarity.precious}.`);
  console.log(`[ADD2E][COMPONENT_PRICE] V3 : ${summary.v3MaterialEntries} entrée(s), cout_po conservé ${summary.v3CostsPreserved}, à remplir ${summary.v3CostsToFill}, sans composant compendium ${summary.v3Unmatched}, rapprochement ambigu ${summary.v3Ambiguous}.`);
  for (const change of options.showAll ? plan.changes : plan.changes.filter(change => change.kind !== "existing")) {
    console.log(`[ADD2E][COMPONENT_PRICE] ${change.name} : ${change.previousPrix || "vide"} → ${change.price}${change.rarity ? ` — ${BANDS[change.rarity].label}` : ""}.`);
  }
  for (const change of plan.v3Changes.filter(change => change.action !== "fill")) {
    console.log(`[ADD2E][COMPONENT_PRICE] V3 ${change.action} : ${text(change.item?.name ?? change.item?.system?.nom)} — ${change.name}${change.names ? ` (${change.names.join(", ")})` : ""}.`);
  }
}
function main() {
  const options = parseArgs(process.argv.slice(2));
  const equipmentPath = path.join(ROOT, EQUIPMENT_FILE);
  const v3Path = path.join(ROOT, V3_FILE);
  const equipment = read(equipmentPath);
  const v3 = read(v3Path);
  const output = plan(equipment, v3);
  print(output, options);
  if (options.report) {
    const reportPath = path.resolve(ROOT, options.report);
    write(reportPath, report(output));
    console.log(`[ADD2E][COMPONENT_PRICE] Rapport écrit : ${path.relative(ROOT, reportPath)}.`);
  }
  if (options.apply) {
    apply(output);
    write(equipmentPath, equipment);
    write(v3Path, v3);
    console.log(`[ADD2E][COMPONENT_PRICE] Appliqué : ${EQUIPMENT_FILE} et ${V3_FILE}. V4 n'est pas modifiée.`);
  }
}
main();
