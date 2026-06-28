import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const EQUIPMENT_FILE = "sources/Item-Equipements.json";
const V4_FILE = "fvtt-spells-all-normalise-mecanique-v4.json";
const VERSION = "2026-06-28-component-price-from-v4-v2";

const BANDS = {
  trivial: { label: "très commun / collecte immédiate", prices: ["1 pc", "2 pc", "3 pc", "4 pc", "5 pc", "6 pc", "8 pc", "9 pc"] },
  common: { label: "commun", prices: ["7 pc", "9 pc", "12 pc", "15 pc", "18 pc", "2 pa", "3 pa", "4 pa", "5 pa", "6 pa", "8 pa"] },
  prepared: { label: "préparé ou peu courant", prices: ["7 pa", "8 pa", "9 pa", "12 pa", "15 pa", "18 pa", "2 po", "3 po", "4 po", "5 po"] },
  crafted: { label: "travaillé ou spécialisé", prices: ["6 pa", "8 pa", "12 pa", "15 pa", "18 pa", "2 po", "3 po", "4 po", "5 po", "6 po", "8 po"] },
  rare: { label: "rare", prices: ["8 po", "10 po", "12 po", "15 po", "18 po", "20 po", "25 po", "30 po", "35 po", "40 po", "50 po", "60 po", "75 po"] },
  precious: { label: "précieux ou alchimique", prices: ["80 po", "100 po", "125 po", "150 po", "200 po", "250 po", "300 po", "400 po", "500 po", "750 po"] }
};

const text = value => String(value ?? "").replace(/\s+/g, " ").trim();
const own = (object, key) => Object.prototype.hasOwnProperty.call(object ?? {}, key);
const read = file => JSON.parse(fs.readFileSync(file, "utf8"));
const write = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
const clone = value => JSON.parse(JSON.stringify(value));

function fold(value) {
  return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, " ").toLocaleLowerCase("fr");
}
function key(value) {
  return fold(value).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
function title(value) {
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
function stableId(value, used) {
  let salt = 0;
  while (true) {
    const id = `${hash(`${value}:${salt}:a`).toString(16).padStart(8, "0")}${hash(`${value}:${salt}:b`).toString(16).padStart(8, "0")}`;
    if (!used.has(id)) {
      used.add(id);
      return id;
    }
    salt += 1;
  }
}
function collection(document) {
  if (Array.isArray(document)) return document;
  for (const field of ["documents", "items", "Item", "Items", "data", "entries"]) if (Array.isArray(document?.[field])) return document[field];
  return null;
}
function isSpell(item) {
  return fold(item?.type ?? item?.system?.type) === "sort";
}
function asNumber(value) {
  const result = typeof value === "number" ? value : Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(result) ? result : null;
}
function pricePo(value) {
  const match = text(value).match(/^([0-9]+(?:[.,][0-9]+)?)\s*(pp|po|pe|pa|pc)?$/i);
  if (!match) return null;
  const amount = Number(match[1].replace(",", "."));
  const unit = (match[2] ?? "po").toLocaleLowerCase("fr");
  const rates = { pp: 5, po: 1, pe: .5, pa: .1, pc: .01 };
  return Number.isFinite(amount) && amount > 0 && own(rates, unit) ? amount * rates[unit] : null;
}
function formatPo(value) {
  const pc = Math.max(1, Math.round(Number(value) * 100));
  if (pc < 10) return `${pc} pc`;
  if (pc < 100) return pc % 10 === 0 ? `${pc / 10} pa` : `${pc} pc`;
  return pc % 100 === 0 ? `${pc / 100} po` : `${pc / 100} po`;
}
function price(label) {
  const po = pricePo(label);
  if (!(po > 0)) throw new Error(`Prix invalide : ${label}.`);
  return { label, po };
}
function isReusable(entry) {
  const name = fold(entry?.nom);
  const use = fold(entry?.consommation);
  return /reutilis|non consom|focus/.test(use) || /symbole sacre|gui(?: druidique| majeur)?|chapelet|livre de priere|symbole religieux|objet de priere/.test(name);
}
function status(entry) {
  const name = text(entry?.nom);
  const value = fold(name);
  if (!value || /\ba completer\b|\ba remplir\b|materielle? non precise/.test(value)) return "excluded_placeholder";
  if (/consommation explicitement indiquee|disparait quand|pour chaque|l un des elements|objet similaire|objets magiques|objet de valeur|source de feu|\bcreature\b|\bl original\b|\breduite? en poudre\b|\brepartie sur\b/.test(value)) return "excluded_text";
  if (/\bpotion\b|parchemin magique|gemme d emprisonnement|objet magique|sang de dragon|os de dragon|diamant d une valeur|gemme non detruite|coffre de grande valeur|\breceptacle\b/.test(value)) return "manual_special";
  return isReusable(entry) ? "reusable" : "sellable";
}
function rarity(name, note = "") {
  const value = fold(`${name} ${note}`);
  if (/diamant|rubis|saphir|emeraude|topaze|opale|perle|gemme|pierre precieuse|poudre de diamant|poudre de perle|poudre de rubis|ivoire|platine|jade/.test(value)) return "precious";
  if (/ambre|mercure|or\b|argent\b|electrum|myrrhe|encens|parfum|corail|nacre|soie|safran|orchidee/.test(value)) return "rare";
  if (/miroir|aimant|lentille|cloche|grelot|aiguille|anneau|bague|clef|cle\b|fiole|flacon|figurine|maquette|miniature|statuette|masque|fil de|tissu|corde|sifflet|baguette|barre de metal|tige de metal|lame en fer|plaque de fer|coffre|gant|pelle|baquet|tambour|couronne/.test(value)) return "crafted";
  if (/poudre|gomme|resine|cire|soufre|salpetre|phosphore|pigment|teinture|huile|alcool|vinaigre|sel|argile|verre|encre|charbon|poix|chaux|miel|beurre|creme|limaille|alun/.test(value)) return "prepared";
  if (/goutte|salive|poussiere|cendre|terre|boue|sable|brin|insecte|toile d araignee|poil|ongle|coquille|feuille morte|caillou|motte de terre/.test(value)) return "trivial";
  return "common";
}
function v4Materials(v4) {
  const items = collection(v4);
  if (!items) throw new Error(`${V4_FILE} ne contient pas de collection d'items.`);
  const result = [];
  for (const item of items) {
    if (!isSpell(item) || !Array.isArray(item?.system?.composants_materiels)) continue;
    for (let index = 0; index < item.system.composants_materiels.length; index += 1) {
      const entry = item.system.composants_materiels[index];
      result.push({
        item,
        entry,
        index,
        name: text(entry?.nom),
        status: status(entry),
        spell: text(item?.name ?? item?.system?.nom),
        className: text(item?.system?.classe),
        level: Number(item?.system?.niveau ?? 0) || null
      });
    }
  }
  return result;
}
function materialGroups(materials) {
  const groups = new Map();
  for (const material of materials) {
    if (!material.name || !["sellable", "reusable"].includes(material.status)) continue;
    const id = key(material.name);
    const group = groups.get(id) ?? { id, name: title(material.name), kind: material.status, items: [], unitCosts: new Set(), notes: new Set(), spells: new Set() };
    if (material.status === "reusable") group.kind = "reusable";
    const cost = asNumber(material.entry?.cout_po);
    const quantity = Math.max(1, Math.floor(asNumber(material.entry?.quantite) ?? 1));
    if (cost > 0) group.unitCosts.add(Math.round((cost / quantity) * 100000) / 100000);
    if (text(material.entry?.notes)) group.notes.add(text(material.entry.notes));
    group.spells.add(material.spell);
    group.items.push(material);
    groups.set(id, group);
  }
  return groups;
}
function equipmentIndex(documents) {
  const byName = new Map();
  const usedIds = new Set();
  let maxSort = 0;
  for (const document of documents) {
    const id = key(document?.name ?? document?.system?.nom);
    if (id) {
      const list = byName.get(id) ?? [];
      list.push(document);
      byName.set(id, list);
    }
    if (text(document?._id ?? document?.id)) usedIds.add(text(document?._id ?? document?.id));
    maxSort = Math.max(maxSort, Number(document?.sort ?? 0) || 0);
  }
  return { byName, usedIds, maxSort };
}
function matchEquipment(group, index) {
  const list = index.byName.get(group.id) ?? [];
  return list.length === 1 ? { document: list[0] } : list.length > 1 ? { conflict: list.map(doc => text(doc?.name ?? doc?.system?.nom)) } : { document: null };
}
function existingPrice(document) {
  const system = document?.system ?? {};
  const label = text(system.prix ?? system.cout);
  const po = pricePo(label);
  return po > 0 ? { label, po, source: text(system.source_prix) || "Prix existant du compendium." } : null;
}
function decide(group, document) {
  const explicit = [...group.unitCosts].sort((a, b) => a - b);
  if (explicit.length === 1) {
    const result = { label: formatPo(explicit[0]), po: explicit[0] };
    return { price: result, origin: "explicit_v4", source: `Coût explicite V4 : ${result.label}.`, rarity: null };
  }
  const old = existingPrice(document);
  if (old) return { price: old, origin: "existing_compendium", source: old.source, rarity: null };
  const band = rarity(group.name, [...group.notes].join(" "));
  const label = BANDS[band].prices[hash(group.id) % BANDS[band].prices.length];
  return {
    price: price(label),
    origin: explicit.length > 1 ? "automatic_after_v4_conflict" : "automatic_rarity",
    source: explicit.length > 1
      ? `Tarif marchand ADD2E — rareté ${BANDS[band].label}; coûts unitaires V4 incompatibles (${explicit.join(", ")} PO), tarif déterministe ${VERSION}.`
      : `Tarif marchand ADD2E — rareté ${BANDS[band].label}; variation déterministe par composant (${VERSION}).`,
    rarity: band,
    conflicts: explicit.length > 1 ? explicit : null
  };
}
function tagData(group) {
  const flags = ["objet", "categorie:composant_sort", "sous_type:composant", `objet:${group.id}`, "composant_sort", group.kind === "reusable" ? "reutilisable" : "consommable", `composant:${group.id}`];
  return { tags: flags, effectTags: flags.map(value => value.replace(/:/g, "_")) };
}
function createDocument(group, decision, id, sort) {
  const reusable = group.kind === "reusable";
  const tags = tagData(group);
  return {
    name: group.name,
    type: "objet",
    img: "icons/commodities/materials/powder-blue.webp",
    system: {
      nom: group.name,
      type: "objet",
      categorie: "composant_sort",
      sousType: "composant",
      prix: decision.price.label,
      cout: decision.price.label,
      quantite: 1,
      poids: reusable ? .1 : .05,
      poids_unite: "kg",
      poids_encombrement_po: reusable ? 2 : 1,
      equipee: false,
      magique: false,
      consommable: !reusable,
      description: `Composant de sort : ${group.name}.`,
      source_prix: decision.source,
      source_poids: "Guide du Maître — Appendice O quand équivalent standard ; sinon poids/encombrement estimé.",
      source_note: reusable ? "Composant réutilisable référencé dans V4." : "Composant matériel référencé dans V4.",
      tags: tags.tags,
      effectTags: tags.effectTags,
      sorts_associes: [...group.spells].filter(Boolean).sort((a, b) => a.localeCompare(b, "fr")),
      source_composant: "V4 — composants matériels des sorts ADD2E"
    },
    effects: [],
    flags: { add2e: { schema: "equipement-composant-sort", slug: group.id, sourceRules: "ADD2E V4 — composants matériels", generatedBy: "price-spell-components.mjs", generatedAt: VERSION } },
    _id: id,
    sort,
    ownership: { default: 0 }
  };
}
function previewUpdate(document, group, decision) {
  const system = document?.system ?? {};
  const changed = [];
  for (const [field, value] of Object.entries({ prix: decision.price.label, cout: decision.price.label, source_prix: decision.source })) {
    if (JSON.stringify(system[field]) !== JSON.stringify(value)) changed.push(field);
  }
  if (own(system, "consommable") && system.consommable !== (group.kind !== "reusable")) changed.push("consommable");
  return changed;
}
function applyUpdate(document, group, decision) {
  const system = document.system ??= {};
  system.prix = decision.price.label;
  system.cout = decision.price.label;
  system.source_prix = decision.source;
  if (own(system, "consommable")) system.consommable = group.kind !== "reusable";
  if (Array.isArray(system.sorts_associes)) {
    system.sorts_associes = [...new Set([...system.sorts_associes.map(text), ...group.spells])].filter(Boolean).sort((a, b) => a.localeCompare(b, "fr"));
  }
}
function parseArgs(argv) {
  const options = { apply: false, showAll: false, report: null };
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
      console.log("  node audit/tools/price-spell-components.mjs --diagnose [--show-all] [--report audit/rapports/PRIX-COMPOSANTS-V4.json]");
      console.log("  node audit/tools/price-spell-components.mjs --apply [--show-all] [--report audit/rapports/PRIX-COMPOSANTS-V4.json]");
      console.log("--apply modifie uniquement sources/Item-Equipements.json et fvtt-spells-all-normalise-mecanique-v4.json. V3 est exclue.");
      process.exit(0);
    } else throw new Error(`Argument inconnu : ${arg}`);
  }
  return options;
}
function buildPlan(equipment, v4) {
  const documents = collection(equipment);
  if (!documents) throw new Error(`${EQUIPMENT_FILE} ne contient pas de collection documents.`);
  const materials = v4Materials(v4);
  const groups = materialGroups(materials);
  const index = equipmentIndex(documents);
  const summary = {
    v4MaterialEntries: materials.length,
    v4SellableEntries: materials.filter(entry => entry.status === "sellable").length,
    v4ReusableEntries: materials.filter(entry => entry.status === "reusable").length,
    v4ExcludedPlaceholders: materials.filter(entry => entry.status === "excluded_placeholder").length,
    v4ExcludedText: materials.filter(entry => entry.status === "excluded_text").length,
    v4ManualSpecial: materials.filter(entry => entry.status === "manual_special").length,
    cataloguedComponents: groups.size,
    matchedEquipment: 0,
    createdEquipment: 0,
    equipmentUpdates: 0,
    ambiguousEquipment: 0,
    explicitV4UnitCosts: 0,
    explicitV4Conflicts: 0,
    v4CostsPreserved: 0,
    v4CostsToFill: 0,
    v4CostsBlocked: 0,
    rarity: Object.fromEntries(Object.keys(BANDS).map(name => [name, 0]))
  };
  const manual = materials.filter(entry => ["excluded_placeholder", "excluded_text", "manual_special"].includes(entry.status)).map(entry => ({ spell: entry.spell, classe: entry.className, niveau: entry.level, material: entry.name, status: entry.status }));
  const documentsPlan = [];
  const groupsPlan = new Map();
  for (const group of [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, "fr"))) {
    const found = matchEquipment(group, index);
    if (found.conflict) {
      summary.ambiguousEquipment += 1;
      manual.push({ spell: null, classe: null, niveau: null, material: group.name, status: "ambiguous_equipment", candidates: found.conflict });
      groupsPlan.set(group.id, null);
      continue;
    }
    const decision = decide(group, found.document);
    if (decision.rarity) summary.rarity[decision.rarity] += 1;
    if (decision.origin === "explicit_v4") summary.explicitV4UnitCosts += 1;
    if (decision.origin === "automatic_after_v4_conflict") summary.explicitV4Conflicts += 1;
    const action = found.document ? (previewUpdate(found.document, group, decision).length ? "update" : "keep") : "create";
    if (found.document) summary.matchedEquipment += 1;
    else summary.createdEquipment += 1;
    if (action === "update") summary.equipmentUpdates += 1;
    const entry = { action, document: found.document ?? null, group, decision, changedFields: found.document ? previewUpdate(found.document, group, decision) : [] };
    documentsPlan.push(entry);
    groupsPlan.set(group.id, entry);
  }
  const v4Costs = [];
  for (const material of materials) {
    if (asNumber(material.entry?.cout_po) > 0) {
      summary.v4CostsPreserved += 1;
      continue;
    }
    const planned = groupsPlan.get(key(material.name));
    if (!planned) {
      summary.v4CostsBlocked += 1;
      continue;
    }
    const quantity = Math.max(1, Math.floor(asNumber(material.entry?.quantite) ?? 1));
    const costPo = Math.round(planned.decision.price.po * quantity * 100000) / 100000;
    v4Costs.push({ material, planned, quantity, costPo });
    summary.v4CostsToFill += 1;
  }
  return { documents, materials, documentsPlan, v4Costs, manual, summary };
}
function applyPlan(plan, equipment) {
  const documents = collection(equipment);
  const index = equipmentIndex(documents);
  let sort = index.maxSort;
  for (const entry of plan.documentsPlan) {
    if (entry.action === "create") {
      sort += 1000;
      documents.push(createDocument(entry.group, entry.decision, stableId(`component:${entry.group.id}`, index.usedIds), sort));
    } else if (entry.action === "update") applyUpdate(entry.document, entry.group, entry.decision);
  }
  for (const entry of plan.v4Costs) entry.material.entry.cout_po = entry.costPo;
}
function report(plan) {
  return {
    version: VERSION,
    scope: { sourceOfTruth: V4_FILE, equipment: EQUIPMENT_FILE, v3: "exclue", policy: "Prix existants et cout_po V4 explicites préservés. Les valeurs V4 vides reçoivent prix marchand unitaire × quantite. Les placeholders, textes et composants spéciaux restent à validation manuelle." },
    summary: clone(plan.summary),
    equipment: plan.documentsPlan.map(entry => ({ action: entry.action, name: entry.group.name, kind: entry.group.kind, price: entry.decision.price.label, pricePo: entry.decision.price.po, origin: entry.decision.origin, rarity: entry.decision.rarity, changedFields: entry.changedFields, spells: [...entry.group.spells].filter(Boolean).sort((a, b) => a.localeCompare(b, "fr")) })),
    v4Costs: plan.v4Costs.map(entry => ({ spell: entry.material.spell, classe: entry.material.className, niveau: entry.material.level, material: entry.material.name, quantity: entry.quantity, unitPrice: entry.planned.decision.price.label, costPo: entry.costPo })),
    manual: plan.manual
  };
}
function print(plan, options) {
  const s = plan.summary;
  console.log(`[ADD2E][COMPONENT_PRICE_V4] ${VERSION}.`);
  console.log(`[ADD2E][COMPONENT_PRICE_V4] V4 : ${s.v4MaterialEntries} entrée(s), vendables ${s.v4SellableEntries}, réutilisables ${s.v4ReusableEntries}, placeholders exclus ${s.v4ExcludedPlaceholders}, textes exclus ${s.v4ExcludedText}, spéciaux à valider ${s.v4ManualSpecial}.`);
  console.log(`[ADD2E][COMPONENT_PRICE_V4] Compendium : ${s.cataloguedComponents} composant(s), existants ${s.matchedEquipment}, créations ${s.createdEquipment}, mises à jour ${s.equipmentUpdates}, ambigus ${s.ambiguousEquipment}.`);
  console.log(`[ADD2E][COMPONENT_PRICE_V4] Prix : coûts V4 explicites ${s.explicitV4UnitCosts}, conflits explicites ${s.explicitV4Conflicts}, très commun ${s.rarity.trivial}, commun ${s.rarity.common}, préparé ${s.rarity.prepared}, travaillé ${s.rarity.crafted}, rare ${s.rarity.rare}, précieux ${s.rarity.precious}.`);
  console.log(`[ADD2E][COMPONENT_PRICE_V4] cout_po V4 : conservé ${s.v4CostsPreserved}, à remplir ${s.v4CostsToFill}, bloqué pour revue ${s.v4CostsBlocked}.`);
  for (const entry of options.showAll ? plan.documentsPlan : plan.documentsPlan.filter(entry => entry.action !== "keep")) {
    console.log(`[ADD2E][COMPONENT_PRICE_V4] ${entry.action} : ${entry.group.name} — ${entry.decision.price.label}${entry.decision.rarity ? ` — ${BANDS[entry.decision.rarity].label}` : ""}.`);
  }
  for (const entry of plan.manual) console.log(`[ADD2E][COMPONENT_PRICE_V4] revue ${entry.status} : ${entry.spell ? `${entry.spell} — ` : ""}${entry.material}.`);
}
function main() {
  const options = parseArgs(process.argv.slice(2));
  const equipmentPath = path.join(ROOT, EQUIPMENT_FILE);
  const v4Path = path.join(ROOT, V4_FILE);
  const equipment = read(equipmentPath);
  const v4 = read(v4Path);
  const plan = buildPlan(equipment, v4);
  print(plan, options);
  if (options.report) {
    const reportPath = path.resolve(ROOT, options.report);
    write(reportPath, report(plan));
    console.log(`[ADD2E][COMPONENT_PRICE_V4] Rapport écrit : ${path.relative(ROOT, reportPath)}.`);
  }
  if (options.apply) {
    applyPlan(plan, equipment);
    write(equipmentPath, equipment);
    write(v4Path, v4);
    console.log(`[ADD2E][COMPONENT_PRICE_V4] Appliqué : ${EQUIPMENT_FILE} et ${V4_FILE}. V3 n'est pas modifiée.`);
  }
}
main();
