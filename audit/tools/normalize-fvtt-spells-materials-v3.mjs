import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const VERSION = "2026-06-24-component-unit-price-estimator-v13";
const SOURCE_V3 = "fvtt-spells-all-normalise-mecanique-v3.json";
const CONTROL = "fvtt-spells-all-normalise-mecanique-v3-controle.json";
const EQUIPMENT_COMPENDIUM = "compendium_equipements.json";

/*
 * Le prix final est toujours écrit explicitement dans system.prix.
 * Ces règles servent uniquement à produire ce prix au moment de la génération.
 * Elles ne sont jamais lues par le marchand en jeu.
 */
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
  aconit: ["aconit_le_brin"],
  belladone: ["belladone_le_brin"],
  eau_benite: ["eau_benite_fiole"],
  eau_maudite: ["eau_benite_fiole"],
  encens: ["encens_batonnet"],
  chapelet_de_priere: ["chapelet_de_priere"],
  miroir_en_argent: ["miroir_en_argent_petit"],
  symbole_sacre: ["symbole_beni_bois", "symbole_beni_fer", "symbole_beni_argent"],
  symbole_religieux_en_argent: ["symbole_beni_argent"]
});

const IGNORED_COMPONENT_PATTERNS = [
  /^a_(?:completer|determiner|verifier)$/,
  /^(?:de_)?(?:bois|fer|argent|or|cuivre)$/,
  /^(?:disparait|apparait|pour_chaque|selon_|quand_le_sort|le_sort_est|invocation_d_un_elemental)/,
  /^(?:aucun|inconnu|non_defini|non_precise)$/
];

const PRICE_RULES = [
  { price: "50 po", test: /(?:demon|diable|celeste|elemental|dragon|licorne|sphinx|chimere|manticore|hydre|golem|magique|enchant|exotique|tres_rare|rare)/ },
  { price: "25 po", test: /(?:ambre|perle|gemme|cristal|corail|ivoire|argent|or|electrum|platine|ecaille|griffon|basilic|sang_de_dragon|os_de_dragon)/ },
  { price: "5 po", test: /(?:venin|poison|antidote|organe|oeil|langue|coeur|foie|cerveau|plante_rare|champignon|truffe|mousse|lichen|alchim)/ },
  { price: "1 po", test: /(?:poudre|soufre|phosphore|sel|huile|alcool|vin|vinaigre|resine|gomme|metal|fer|cuivre|etain|plomb)/ },
  { price: "1 pa", test: /(?:liquide|graisse|sang|morceau|ecorce|coquille|os|bois|cuir|tissu|parchemin)/ },
  { price: "5 pc", test: /(?:feuille|herbe|fleur|racine|ail|cire|ficelle|laine|brin|petit_os|baie|graine)/ },
  { price: "1 pc", test: /(?:goutte|pincee|grain|poil|plume|poussiere|sable|cendre|terre)/ }
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

function canonicalSlug(value) {
  const raw = slug(value);
  return CANONICAL_ALIASES[raw] ?? raw;
}

function readLeaf(rule, spell, inherited = {}, pathLabel = "") {
  if (!rule || typeof rule !== "object" || Array.isArray(rule)) {
    throw new Error(`Composant V3 invalide pour ${spell.name}${pathLabel ? ` (${pathLabel})` : ""}.`);
  }

  const name = text(rule.nom);
  if (!name) throw new Error(`Composant sans nom pour ${spell.name}${pathLabel ? ` (${pathLabel})` : ""}.`);

  const quantity = Number(rule.quantite);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error(`Quantité invalide pour « ${name} » dans ${spell.name}.`);
  }

  const rawSlug = slug(name);
  return {
    key: canonicalSlug(rawSlug),
    rawSlug,
    name,
    detail: {
      nom: text(spell.name ?? spell.system?.nom),
      id: text(spell._id ?? spell.id),
      classe: spellClass(spell),
      niveau: itemLevel(spell),
      composant_nom: name,
      quantite: quantity,
      consommation: text(rule.consommation ?? inherited.consommation) || "consomme",
      cout_po: rule.cout_po ?? null,
      condition: rule.condition ?? inherited.condition ?? null,
      notes: rule.notes ?? null,
      alternativeGroup: rule.alternativeGroup ?? inherited.alternativeGroup ?? null,
      mode: rule.mode ?? inherited.mode ?? null
    }
  };
}

function walkMaterialRules(rules, spell, inherited = {}, pathLabel = "racine", output = []) {
  if (!Array.isArray(rules)) throw new Error(`Composants matériels non structurés pour ${spell.name}.`);

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

function buildCatalog(spells) {
  const entries = new Map();
  let linkedSpellEntries = 0;

  for (const spell of spells) {
    if (!isSpell(spell)) continue;
    const rules = materialRules(spell);
    if (!rules.length) continue;

    for (const usage of walkMaterialRules(rules, spell)) {
      if (!usage.key) throw new Error(`Slug vide pour le composant « ${usage.name} » de ${spell.name}.`);
      if (!entries.has(usage.key)) {
        entries.set(usage.key, {
          key: usage.key,
          name: usage.name,
          names: new Set(),
          rawSlugs: new Set(),
          details: []
        });
      }
      const entry = entries.get(usage.key);
      entry.names.add(usage.name);
      entry.rawSlugs.add(usage.rawSlug);
      entry.details.push(usage.detail);
      linkedSpellEntries += 1;
    }
  }

  for (const entry of entries.values()) {
    const deduped = new Map();
    for (const detail of entry.details) deduped.set(detailKey(detail), detail);
    entry.details = [...deduped.values()];
    entry.names = [...entry.names].sort((left, right) => left.localeCompare(right, "fr"));
    entry.rawSlugs = [...entry.rawSlugs].sort((left, right) => left.localeCompare(right, "fr"));
    entry.name = entry.names[0] ?? entry.name;
  }

  return {
    entries: new Map([...entries.entries()].sort(([left], [right]) => left.localeCompare(right, "fr"))),
    linkedSpellEntries
  };
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

function normalizeNumber(raw) {
  let value = String(raw ?? "").replace(/\s/g, "");
  if (/^\d{1,3}(?:\.\d{3})+$/.test(value)) value = value.replace(/\./g, "");
  else value = value.replace(",", ".");
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;
  return Number.isInteger(number) ? String(number) : String(number).replace(".", ",");
}

function explicitPriceFromName(value) {
  const match = String(value ?? "").replace(/\u00a0/g, " ").match(/(\d[\d\s.,]*)\s*(pp|po|pe|pa|pc)\b/i);
  if (!match) return null;
  const amount = normalizeNumber(match[1]);
  return amount ? `${amount} ${match[2].toLowerCase()}` : null;
}

function currentPrice(item) {
  const system = item?.system ?? {};
  const raw = system.prix ?? system.price ?? null;
  if (typeof raw === "number" && raw > 0) return `${raw} ${text(system.devise ?? system.currency ?? "po").toLowerCase() || "po"}`;
  if (typeof raw === "string" && raw.trim()) return text(raw);
  if (raw && typeof raw === "object") {
    const value = raw.valeur ?? raw.value ?? raw.montant ?? raw.amount;
    const currency = raw.devise ?? raw.currency ?? system.devise ?? system.currency ?? "po";
    if (Number.isFinite(Number(value)) && Number(value) > 0) return `${Number(value)} ${text(currency).toLowerCase() || "po"}`;
  }
  return null;
}

function itemSlug(item) {
  return slug(item?.system?.slug ?? item?.flags?.add2e?.slug ?? item?.name ?? item?.system?.nom);
}

function booleanValue(value) {
  if (value === true) return true;
  if (value === false) return false;
  if (value === null || value === undefined || value === "") return null;
  const normalized = text(value).toLowerCase();
  if (["true", "1", "oui", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "non", "no", "off"].includes(normalized)) return false;
  return null;
}

function isReusableEquipment(item) {
  const system = item?.system ?? {};
  const flags = item?.flags?.add2e ?? {};
  const reusable = booleanValue(system.reutilisable ?? system.réutilisable ?? system.reusable ?? flags.reutilisable ?? flags.réutilisable ?? flags.reusable);
  if (reusable === true) return true;
  const consumable = booleanValue(system.consommable ?? system.consumable ?? flags.consommable ?? flags.consumable);
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

function candidateEquipmentSlugs(entry) {
  return unique([
    entry.key,
    ...entry.rawSlugs,
    ...(EQUIPMENT_ALIASES[entry.key] ?? [])
  ]);
}

function equipmentMatches(entry, equipmentIndex) {
  const seen = new Set();
  const items = [];
  for (const candidate of candidateEquipmentSlugs(entry)) {
    for (const item of equipmentIndex.get(candidate) ?? []) {
      const identity = text(item?._id ?? item?.id ?? item?.name);
      if (seen.has(identity)) continue;
      seen.add(identity);
      items.push(item);
    }
  }
  return items;
}

function isIgnoredEntry(entry) {
  return [entry.key, ...entry.rawSlugs].some(key => IGNORED_COMPONENT_PATTERNS.some(pattern => pattern.test(key)));
}

function predictedPrice(entry) {
  for (const name of entry.names) {
    const explicit = explicitPriceFromName(name);
    if (explicit) return explicit;
  }

  const haystack = slug([...entry.names, ...entry.rawSlugs, entry.key].join(" "));
  for (const rule of PRICE_RULES) {
    if (rule.test.test(haystack)) return rule.price;
  }
  return "1 po";
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

function auditPrices(catalog, allItems) {
  const equipmentIndex = baseEquipmentIndex(allItems);
  const rows = [];
  const summary = {
    total: 0,
    prixExpliciteSort: 0,
    prixEquipement: 0,
    prixPredit: 0,
    equipementsReutilisables: 0,
    entreesIgnorees: 0,
    composantsVendables: 0
  };

  for (const entry of catalog.entries.values()) {
    const equipment = equipmentMatches(entry, equipmentIndex);
    const equipmentPrices = [...new Set(equipment.map(currentPrice).filter(Boolean))].sort((left, right) => left.localeCompare(right, "fr"));
    const explicitPo = [...new Set(entry.details.map(detail => numericPo(detail.cout_po)).filter(value => value !== null))].sort((left, right) => left - right);
    const namedPrices = [...new Set(entry.names.map(explicitPriceFromName).filter(Boolean))];
    const reusable = equipment.length > 0 && equipment.every(isReusableEquipment);

    let statut;
    let mode;
    let prix = null;

    if (isIgnoredEntry(entry)) {
      statut = "entree_ignoree";
      mode = "ignorer";
      summary.entreesIgnorees += 1;
    } else if (reusable) {
      statut = "equipement_reutilisable";
      mode = "conserver_equipement";
      summary.equipementsReutilisables += 1;
    } else if (explicitPo.length) {
      statut = explicitPo.length === 1 ? "prix_explicite_sort" : "prix_explicite_sort_maximum";
      mode = "creer_composant";
      prix = `${explicitPo.at(-1)} po`;
      summary.prixExpliciteSort += 1;
      summary.composantsVendables += 1;
    } else if (namedPrices.length) {
      statut = "prix_explicite_nom";
      mode = "creer_composant";
      prix = namedPrices[0];
      summary.prixExpliciteSort += 1;
      summary.composantsVendables += 1;
    } else if (equipmentPrices.length === 1) {
      statut = "prix_equipement";
      mode = "creer_composant";
      prix = equipmentPrices[0];
      summary.prixEquipement += 1;
      summary.composantsVendables += 1;
    } else {
      statut = "prix_predit";
      mode = "creer_composant";
      prix = predictedPrice(entry);
      summary.prixPredit += 1;
      summary.composantsVendables += 1;
    }

    rows.push({
      slug: entry.key,
      nom: entry.name,
      variantes: entry.names,
      slugs_bruts: entry.rawSlugs,
      statut,
      mode_rebuild: mode,
      prix_unitaire_propose: prix,
      equipements: equipment.map(item => ({
        nom: text(item?.name ?? item?.system?.nom),
        slug: itemSlug(item),
        prix: currentPrice(item),
        reutilisable: isReusableEquipment(item)
      })),
      usages: entry.details.map(detail => ({
        sort: detail.nom,
        classe: detail.classe,
        niveau: detail.niveau,
        quantite: detail.quantite,
        consommation: detail.consommation,
        cout_po: detail.cout_po ?? null
      }))
    });
    summary.total += 1;
  }

  return {
    version: VERSION,
    equipmentFile: EQUIPMENT_COMPENDIUM,
    policy: "Chaque composant vendable possède un system.prix explicite après génération. Priorité : coût explicite du sort, équipement existant, estimation déterministe par matière. Aucun fallback marchand.",
    summary,
    components: rows
  };
}

function createComponentItem(template, entry, row, id, sort) {
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
  system.prix = row.prix_unitaire_propose;
  delete system.cout;
  delete system.coût;
  delete system.source_prix;
  delete system.source_note;
  delete system.source_composant;
  system.tags = componentTags(system.tags, entry.key);
  system.effectTags = componentEffectTags(system.effectTags, entry.key);
  system.sorts_associes = unique(entry.details.map(detail => detail.nom)).sort((left, right) => left.localeCompare(right, "fr"));
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

function rebuildCatalog(spells, audit) {
  const compendiumFile = path.join(ROOT, EQUIPMENT_COMPENDIUM);
  const compendium = readJson(compendiumFile, null);
  if (!compendium || typeof compendium !== "object") throw new Error(`Compendium introuvable ou invalide : ${EQUIPMENT_COMPENDIUM}`);

  const allItems = getItems(compendium).map(clone);
  const oldComponents = allItems.filter(isComponentItem);
  const catalog = buildCatalog(spells);
  const rows = new Map(audit.components.map(row => [row.slug, row]));
  const toCreate = [...catalog.entries.values()].filter(entry => rows.get(entry.key)?.mode_rebuild === "creer_composant");

  if (toCreate.length && !oldComponents.length) {
    throw new Error(`Aucun composant existant dans ${EQUIPMENT_COMPENDIUM} : impossible de conserver le modèle d'objet.`);
  }

  const template = toCreate.length ? clone(oldComponents[0]) : null;
  const retainedItems = allItems.filter(item => !isComponentItem(item));
  const usedIds = new Set(retainedItems.map(item => text(item?._id ?? item?.id)).filter(Boolean));
  const highestSort = allItems.reduce((highest, item) => Math.max(highest, Number(item?.sort) || 0), 0);
  let sort = highestSort + 1;
  const generated = [];

  for (const entry of toCreate) {
    const row = rows.get(entry.key);
    if (!text(row?.prix_unitaire_propose)) throw new Error(`Prix absent pour ${entry.name}.`);
    generated.push(createComponentItem(template, entry, row, makeId(`component:${entry.key}`, usedIds), sort));
    sort += 1;
  }

  setItems(compendium, [...retainedItems, ...generated]);
  writeJson(compendiumFile, compendium);

  return {
    file: EQUIPMENT_COMPENDIUM,
    deleted: oldComponents.length,
    created: generated.length,
    ignored: audit.components.filter(row => row.mode_rebuild === "ignorer").length,
    reusableEquipment: audit.components.filter(row => row.mode_rebuild === "conserver_equipement").length,
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
  const source = readJson(path.join(ROOT, args.source), null);
  if (!source || typeof source !== "object") throw new Error(`JSON V3 introuvable ou invalide : ${args.source}`);

  const spells = getItems(source).filter(isSpell);
  if (!spells.length) throw new Error(`Aucun sort trouvé dans ${args.source}.`);

  const compendium = readJson(path.join(ROOT, EQUIPMENT_COMPENDIUM), null);
  if (!compendium || typeof compendium !== "object" || !getItems(compendium).length) {
    throw new Error(`Compendium introuvable, invalide ou vide : ${EQUIPMENT_COMPENDIUM}`);
  }

  const catalog = buildCatalog(spells);
  const audit = auditPrices(catalog, getItems(compendium));
  const controlFile = path.join(ROOT, args.control);
  const control = readJson(controlFile, {}) ?? {};
  control.version = VERSION;
  control.componentPriceAudit = audit;
  writeJson(controlFile, control);

  console.log(`[ADD2E][COMPONENT_PRICE_AUDIT] ${audit.summary.total} entrée(s) analysée(s).`);
  console.log(`[ADD2E][COMPONENT_PRICE_AUDIT] ${audit.summary.prixExpliciteSort} prix explicite(s), ${audit.summary.prixEquipement} prix d'équipement, ${audit.summary.prixPredit} prix prédit(s).`);
  console.log(`[ADD2E][COMPONENT_PRICE_AUDIT] ${audit.summary.equipementsReutilisables} équipement(s) réutilisable(s) conservé(s), ${audit.summary.entreesIgnorees} entrée(s) ignorée(s).`);

  if (args.auditOnly) return;

  const rebuilt = rebuildCatalog(spells, audit);
  control.componentCatalog = {
    ...rebuilt,
    policy: "Tous les composants vendables sont recréés avec un system.prix explicite. Les équipements réutilisables restent des équipements et les fragments non matériels sont ignorés.",
    v3Rewritten: false,
    grammarParsing: false
  };
  writeJson(controlFile, control);

  console.log(`[ADD2E][COMPONENT_CATALOG] ${rebuilt.deleted} ancien(s) composant(s) supprimé(s), ${rebuilt.created} recréé(s).`);
  console.log(`[ADD2E][COMPONENT_CATALOG] ${rebuilt.reusableEquipment} équipement(s) réutilisable(s) conservé(s), ${rebuilt.ignored} entrée(s) ignorée(s).`);
}

main();
