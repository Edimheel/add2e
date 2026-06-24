import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const VERSION = "2026-06-24-component-catalog-merchant-filter-v16";
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
  chapelet: ["chapelet_de_priere"],
  chapelet_de_priere: ["chapelet_de_priere"],
  miroir_en_argent: ["miroir_en_argent_petit"],
  symbole_sacre: ["symbole_beni_bois"],
  symbole_religieux_en_argent: ["symbole_beni_argent"]
});

const EXPLICIT_V3_COMPONENT_PRICES = Object.freeze({
  aiguille_de_pin: "1 pc",
  gui_druidique: "1 po",
  gui_majeur: "5 po",
  lait_solidifie_creme_epaisse: "1 pa",
  matiere_grasse: "1 pa",
  noir_de_fumee: "1 pc",
  parchemin_mis_en_cone: "1 pa",
  parchemin_torsade_en_forme_de_boucle: "1 pa",
  petit_cone_de_verre: "5 pc",
  petit_morceau_d_acier: "1 pa",
  petite_branche_d_arbre: "5 pc",
  petite_poignee_de_sels_alcalins: "1 po",
  petites_spheres_de_verre: "5 pc",
  pincee_de_souffre: "1 pa",
  plante_verte: "5 pc",
  saindoux: "1 pa",
  soie_multicolore_extremement_fine: "5 po",
  velin_enlumine: "1 po"
});

const NON_MERCHANT_V3_COMPONENT_KEYS = new Set([
  "a_completer",
  "coffre_de_grande_valeur",
  "consommation_explicitement_indiquee_dans_la_description",
  "creation_d_un_objet_mineral",
  "creation_d_un_objet_vegetal",
  "creature",
  "de_bromure",
  "disparait_quand_le_sort_est_lance",
  "formant_une_ligne_legerement_courbe",
  "humanoide",
  "invocation_d_un_elemental_de_l_air",
  "invocation_d_un_elemental_de_l_eau",
  "invocation_d_un_elemental_de_terre",
  "invocation_d_un_elemental_du_feu",
  "l_original",
  "l_un_des_elements_suivants_plusieurs_soucis_ecrases",
  "materielle_non_precisee_explicitement_dans_le_manuel_des_joueurs",
  "matiere_vegetale_similaire",
  "morceau_d_une_creature_forte",
  "morceau_teinte_en_jaune",
  "nourriture_appreciee_par_l_animal",
  "objet_de_valeur_a_sacrifier",
  "objet_similaire_au_chapelet_de_priere",
  "objet_similaire_ayant_la_meme_utilisation",
  "objets_divinatoires_similaires",
  "objets_magiques",
  "pour_chaque_monstre_vise",
  "reduit_en_poudre",
  "reduite_en_poudre",
  "repartie_sur_le_metal",
  "sertie_de_gemmes",
  "vapeurs_de_fumier"
]);

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

const TOKEN_ALIASES = Object.freeze({
  amandes: "amande", araignees: "araignee", baies: "baie", baguettes: "baguette",
  bougies: "bougie", chandelles: "chandelle", cheveux: "cheveu", coeurs: "coeur",
  coquilles: "coquille", cristaux: "cristal", cils: "cil", ecailles: "ecaille",
  elements: "element", feuilles: "feuille", fleurs: "fleur", fragments: "fragment",
  graines: "graine", glands: "gland", gemmes: "gemme", herbes: "herbe",
  lucioles: "luciole", materiaux: "materiau", matieres: "matiere", metaux: "metal",
  minerais: "mineral", minerales: "mineral", morceaux: "morceau", objets: "objet",
  perles: "perle", pierres: "pierre", plumes: "plume", poudres: "poudre",
  racines: "racine", rares: "rare", resines: "resine", sels: "sel", spheres: "sphere",
  statuettes: "statuette", tiges: "tige", vegetaux: "vegetal", vegetales: "vegetal",
  souffre: "soufre"
});

const PLURAL_EXCEPTIONS = new Set(["bois", "bras", "corps", "fois", "gaz", "mais", "mois", "os", "pays", "pois", "prix", "tres", "vers"]);
const PRICE_TIERS = [
  { copper: 1, label: "1 pc" }, { copper: 5, label: "5 pc" }, { copper: 10, label: "1 pa" },
  { copper: 100, label: "1 po" }, { copper: 500, label: "5 po" }, { copper: 1000, label: "10 po" },
  { copper: 5000, label: "50 po" }, { copper: 10000, label: "100 po" }
];

const text = value => String(value ?? "").replace(/\s+/g, " ").trim();
const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const asArray = value => Array.isArray(value) ? value : value == null || value === "" ? [] : [value];
const slug = value => text(value).toLowerCase().replace(/œ/g, "oe").replace(/æ/g, "ae").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, "'").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

function normalizeToken(token) {
  const raw = text(token);
  if (!raw) return "";
  if (TOKEN_ALIASES[raw]) return TOKEN_ALIASES[raw];
  if (raw.endsWith("s") && raw.length > 3 && !PLURAL_EXCEPTIONS.has(raw)) return raw.slice(0, -1);
  return raw;
}

function tokensFor(value) {
  const tokens = new Set();
  for (const raw of slug(value).split("_").filter(Boolean)) {
    tokens.add(raw);
    tokens.add(normalizeToken(raw));
  }
  return tokens;
}

function entryTokens(entry) {
  const tokens = new Set();
  for (const value of [...entry.names, ...entry.rawKeys, entry.key]) {
    for (const token of tokensFor(value)) tokens.add(token);
  }
  return tokens;
}

function hasAny(tokens, values) { return values.some(value => tokens.has(value)); }
function readJson(file, fallback = null) { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; } }
function writeJson(file, value) { fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8"); }
function unique(values) { return [...new Set(values.map(text).filter(Boolean))]; }

function getItems(document) {
  if (Array.isArray(document)) return document;
  for (const key of ["items", "Item", "Items", "documents", "data", "entries"]) if (Array.isArray(document?.[key])) return document[key];
  return [];
}

function setItems(document, items) {
  if (Array.isArray(document)) return items;
  for (const key of ["items", "Item", "Items", "documents", "data", "entries"]) {
    if (Array.isArray(document?.[key])) { document[key] = items; return document; }
  }
  document.items = items;
  return document;
}

function isSpell(item) { return String(item?.type ?? item?.system?.type ?? "").toLowerCase() === "sort"; }
function itemLevel(item) { return Number(String(item?.system?.niveau ?? item?.system?.niveau_sort ?? item?.system?.level ?? "").match(/\d+/)?.[0] ?? 0) || 0; }
function spellClass(item) { return text(item?.system?.classe ?? item?.system?.class ?? ""); }
function componentKey(value) { const raw = slug(value); return CANONICAL_ALIASES[raw] ?? raw; }
function componentSourceRules(spell) { return Array.isArray(spell?.system?.composants_materiels) ? spell.system.composants_materiels : []; }

function collectV3ComponentLeaves(value, spell, inherited = {}, output = []) {
  if (Array.isArray(value)) { for (const entry of value) collectV3ComponentLeaves(entry, spell, inherited, output); return output; }
  if (!value || typeof value !== "object") return output;

  const context = {
    consommation: value.consommation ?? inherited.consommation ?? null,
    condition: value.condition ?? inherited.condition ?? null,
    alternativeGroup: value.alternativeGroup ?? inherited.alternativeGroup ?? null,
    mode: value.mode ?? inherited.mode ?? null
  };
  if (Array.isArray(value.alternatives)) { for (const alternative of value.alternatives) collectV3ComponentLeaves(alternative, spell, context, output); return output; }

  const name = text(value.nom ?? value.name ?? "");
  if (!name) return output;
  const quantity = Number(value.quantite ?? value.quantity ?? 1);
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error(`Quantité V3 invalide pour « ${name} » dans ${spell.name}.`);

  output.push({
    key: componentKey(name), rawKey: slug(name), name,
    detail: {
      sort: text(spell.name ?? spell.system?.nom), sortId: text(spell._id ?? spell.id), classe: spellClass(spell), niveau: itemLevel(spell),
      composant_nom: name, quantite: quantity, consommation: text(value.consommation ?? context.consommation) || "consomme",
      cout_po: value.cout_po ?? null, condition: value.condition ?? context.condition ?? null, notes: value.notes ?? null,
      alternativeGroup: value.alternativeGroup ?? context.alternativeGroup ?? null, mode: value.mode ?? context.mode ?? null
    }
  });
  return output;
}

function detailKey(detail) {
  return [detail.sortId, detail.composant_nom, detail.quantite, detail.consommation, detail.cout_po ?? "", detail.condition ?? "", detail.notes ?? "", detail.alternativeGroup ?? "", detail.mode ?? ""].join("|");
}

function buildCatalogFromV3(source) {
  const entries = new Map();
  let spellCount = 0;
  let componentOccurrences = 0;
  for (const spell of getItems(source).filter(isSpell)) {
    spellCount += 1;
    for (const leaf of collectV3ComponentLeaves(componentSourceRules(spell), spell)) {
      if (!leaf.key) continue;
      if (!entries.has(leaf.key)) entries.set(leaf.key, { key: leaf.key, name: leaf.name, names: new Set(), rawKeys: new Set(), details: [] });
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
  return { entries: new Map([...entries.entries()].sort(([left], [right]) => left.localeCompare(right, "fr"))), spellCount, componentOccurrences };
}

function isComponentItem(item) {
  const system = item?.system ?? {};
  const add2e = item?.flags?.add2e ?? {};
  return slug(system.categorie ?? system.category) === "composant_sort" || slug(system.sousType ?? system.sous_type) === "composant" || add2e.schema === "equipement-composant-sort" || add2e.vendorKind === "component";
}

function itemSlug(item) { return slug(item?.system?.slug ?? item?.flags?.add2e?.slug ?? item?.name ?? item?.system?.nom); }
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

function equipmentCandidates(entry) { return unique([entry.key, ...entry.rawKeys, ...(EQUIPMENT_ALIASES[entry.key] ?? [])]); }
function findEquipmentMatches(entry, index) {
  const seen = new Set();
  const matches = [];
  for (const key of equipmentCandidates(entry)) for (const item of index.get(key) ?? []) {
    const identity = text(item?._id ?? item?.id ?? item?.name);
    if (!seen.has(identity)) { seen.add(identity); matches.push(item); }
  }
  return matches;
}

function numericPo(value) {
  const raw = typeof value === "number" ? value : typeof value === "string" ? Number(value.replace(",", ".")) : Number(value?.po ?? value?.value ?? value?.valeur ?? value?.amount ?? NaN);
  return Number.isFinite(raw) && raw > 0 ? raw : null;
}

function explicitPriceFromName(value) {
  const match = text(value).match(/(\d[\d\s.,]*)\s*(pp|po|pe|pa|pc)\b/i);
  if (!match) return null;
  const amount = Number(match[1].replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(amount) && amount > 0 ? `${Number.isInteger(amount) ? amount : String(amount).replace(".", ",")} ${match[2].toLowerCase()}` : null;
}

function tierPrice(label) { return PRICE_TIERS.find(tier => tier.label === label) ?? PRICE_TIERS[3]; }
function lowerOneTier(price) { const index = PRICE_TIERS.findIndex(tier => tier.label === price.label); return PRICE_TIERS[Math.max(0, index - 1)]; }
function isNonMerchantV3Entry(entry) { return NON_MERCHANT_V3_COMPONENT_KEYS.has(entry.key) || /^(de_|l_|reduit_|reduite_|repartie_|sertie_|formant_)/.test(entry.key); }

function estimatePrice(entry) {
  const explicit = EXPLICIT_V3_COMPONENT_PRICES[entry.key];
  if (explicit) return { price: explicit, rule: "prix_v3_controle" };
  const canonical = EXACT_ESTIMATES[entry.key];
  if (canonical) return { price: canonical, rule: "estimation_exacte" };

  const tokens = entryTokens(entry);
  let tier;
  let rule;
  if (hasAny(tokens, ["diamant", "rubis", "saphir", "topaze", "opale", "emeraude"]) || (hasAny(tokens, ["pierre", "gemme"]) && hasAny(tokens, ["precieux", "rare"]))) { tier = tierPrice("100 po"); rule = "gemme_precieuse"; }
  else if (hasAny(tokens, ["agate", "ambre", "citrine", "jade", "ivoire", "perle", "gemme"])) { tier = tierPrice("10 po"); rule = "matiere_precieuse"; }
  else if (hasAny(tokens, ["platine"])) { tier = tierPrice("50 po"); rule = "metal_precieux"; }
  else if (hasAny(tokens, ["or", "argent", "electrum"])) { tier = tierPrice("10 po"); rule = "metal_precieux"; }
  else if (hasAny(tokens, ["dragon", "demon", "diable", "celeste", "elemental", "golem", "licorne", "sphinx", "chimere", "manticore", "hydre", "magique", "enchante", "emprisonnement", "heroisme"])) { tier = tierPrice("50 po"); rule = "matiere_exceptionnelle"; }
  else if (hasAny(tokens, ["venin", "poison", "antidote", "mandragore", "safran", "orchidee", "alchimique", "alchimie", "mercure", "glande", "cerveau", "foie"])) { tier = tierPrice("5 po"); rule = "reagent_rare"; }
  else if (hasAny(tokens, ["cristal", "quartz", "mica", "granit", "alun", "talc", "prisme", "mineral", "pierre"])) { tier = tierPrice("1 po"); rule = "matiere_minerale"; }
  else if (hasAny(tokens, ["poudre", "soufre", "phosphore", "salpetre", "charbon", "chaux", "resine", "gomme", "huile", "vinaigre", "alcool", "encre", "metal", "fer", "cuivre", "laiton", "zinc", "plomb", "etain", "aimante", "magnetique"])) { tier = tierPrice("1 po"); rule = "reagent_courant"; }
  else if (hasAny(tokens, ["sang", "os", "peau", "fourrure", "carapace", "coquille", "araignee", "luciole", "ver", "plume", "cil", "cheveu", "langue", "patte", "chair", "coeur", "ecaille", "cocon", "guano", "fiente", "bouse", "toison", "corne"])) { tier = tierPrice("1 pa"); rule = "matiere_animale"; }
  else if (hasAny(tokens, ["feuille", "fleur", "racine", "graine", "baie", "amande", "ail", "cire", "ficelle", "laine", "paille", "brin", "brindille", "ecorce", "herbe", "miel", "beurre", "farine", "poireau", "houx", "gland", "bois", "roseau", "pomme", "navet", "reglisse", "legume", "sesame"])) { tier = tierPrice("5 pc"); rule = "matiere_vegetale_ou_vivriere"; }
  else if (hasAny(tokens, ["argile", "boue", "terre", "humus", "caillou", "silex", "craie", "sable", "cendre", "suie", "poussiere", "goutte", "grain", "eau", "feu", "flamme", "bitume", "melasse", "poix"])) { tier = tierPrice("1 pc"); rule = "matiere_naturelle"; }
  else if (hasAny(tokens, ["bougie", "chandelle", "fil", "cuir", "gant", "sac", "fiole", "baquet", "tambour", "figurine", "statuette", "pelle", "sifflet", "marteau", "massue", "lame", "baguette", "tige", "barre", "brassiere", "couronne", "fourchette", "replique", "livre", "objet", "receptacle"])) { tier = tierPrice("1 po"); rule = "objet_fabrique_courant"; }
  else { tier = tierPrice("1 po"); rule = "estimation_defaut"; }

  if (hasAny(tokens, ["pincee", "goutte", "grain"]) && rule !== "matiere_naturelle" && rule !== "estimation_defaut") { tier = lowerOneTier(tier); rule = `${rule}_petite_quantite`; }
  return { price: tier.label, rule };
}

function classifyPrice(entry, index) {
  if (isNonMerchantV3Entry(entry)) return { vendable: false, price: null, source: "hors_catalogue_marchand" };
  const explicitCosts = [...new Set(entry.details.map(detail => numericPo(detail.cout_po)).filter(value => value !== null))].sort((left, right) => left - right);
  if (explicitCosts.length) return { vendable: true, price: `${explicitCosts.at(-1)} po`, source: explicitCosts.length === 1 ? "cout_explicite_sort" : "cout_explicite_sort_maximum" };
  const namedPrices = [...new Set(entry.names.map(explicitPriceFromName).filter(Boolean))];
  if (namedPrices.length) return { vendable: true, price: namedPrices[0], source: "cout_explicite_nom" };
  const equipment = findEquipmentMatches(entry, index);
  const equipmentPrices = [...new Set(equipment.map(currentPrice).filter(Boolean))];
  if (equipmentPrices.length === 1) return { vendable: true, price: equipmentPrices[0], source: "prix_equipement", equipment };
  const predicted = estimatePrice(entry);
  return { vendable: true, price: predicted.price, source: predicted.rule, equipment };
}

function makeId(seed, usedIds) {
  let attempt = 0;
  while (true) {
    const id = `c${crypto.createHash("sha1").update(`${seed}|${attempt}`).digest("hex").slice(0, 15)}`;
    if (!usedIds.has(id)) { usedIds.add(id); return id; }
    attempt += 1;
  }
}

function componentTags(existing, key) {
  const retained = asArray(existing).map(text).filter(value => value && !(value === "objet" || value === "categorie:composant_sort" || value === "sous_type:composant" || value === "composant_sort" || value === "consommable" || /^objet:/i.test(value) || /^composant:/i.test(value)));
  return unique(["objet", "categorie:composant_sort", "sous_type:composant", `objet:${key}`, "composant_sort", `composant:${key}`, "consommable", ...retained]);
}

function componentEffectTags(existing, key) {
  const retained = asArray(existing).map(text).filter(value => value && !(value === "objet" || value === "categorie_composant_sort" || value === "sous_type_composant" || value === "composant_sort" || value === "consommable" || /^objet_/i.test(value) || /^composant_/i.test(value)));
  return unique(["objet", "categorie_composant_sort", "sous_type_composant", `objet_${key}`, "composant_sort", `composant_${key}`, "consommable", ...retained]);
}

function createComponent(template, entry, row, id, sort) {
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
  system.prix = row.prix;
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
  const summary = { sortsAnalyses: catalog.spellCount, occurrencesV3: catalog.componentOccurrences, composantsUniques: 0, composantsVendables: 0, horsCatalogueMarchand: 0, coutExpliciteSort: 0, prixEquipement: 0, prixPredit: 0, prixDefaut: 0 };
  for (const entry of catalog.entries.values()) {
    const resolved = classifyPrice(entry, index);
    if (!resolved.vendable) summary.horsCatalogueMarchand += 1;
    else {
      summary.composantsVendables += 1;
      if (["cout_explicite_sort", "cout_explicite_sort_maximum", "cout_explicite_nom"].includes(resolved.source)) summary.coutExpliciteSort += 1;
      else if (resolved.source === "prix_equipement") summary.prixEquipement += 1;
      else if (resolved.source === "estimation_defaut") summary.prixDefaut += 1;
      else summary.prixPredit += 1;
    }
    components.push({ slug: entry.key, nom: entry.name, variantes: entry.names, vendable: resolved.vendable, statut: resolved.vendable ? "catalogue_marchand" : "hors_catalogue_marchand", prix: resolved.price, origine_prix: resolved.source, equipements_equivalents: (resolved.equipment ?? []).map(item => ({ nom: text(item?.name ?? item?.system?.nom), prix: currentPrice(item) })), usages: entry.details.map(detail => ({ sort: detail.sort, classe: detail.classe, niveau: detail.niveau, quantite: detail.quantite, consommation: detail.consommation, cout_po: detail.cout_po ?? null })) });
  }
  summary.composantsUniques = components.length;
  return { version: VERSION, source: SOURCE_V3, cible: EQUIPMENT_COMPENDIUM, policy: "Les composants sont lus exclusivement dans system.composants_materiels du JSON V3. Le compendium équipements est créé depuis les seules entrées vendables. Les entrées de règle ou incomplètes restent dans l'audit, hors catalogue marchand.", summary, components };
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
    const row = rows.get(entry.key);
    if (!row?.vendable) continue;
    if (!row.prix) throw new Error(`Prix non résolu pour ${entry.name}.`);
    generated.push(createComponent(template, entry, row, makeId(`component:${entry.key}`, usedIds), sort));
    sort += 1;
  }
  setItems(compendium, [...remaining, ...generated]);
  writeJson(compendiumPath, compendium);
  return { composantsSupprimes: previousComponents.length, composantsCrees: generated.length, objetsNonComposantsConserves: remaining.length };
}

function parseArgs(argv) {
  const auditOnly = argv.includes("--audit-prices");
  const positional = argv.filter(value => value && !value.startsWith("--"));
  return { auditOnly, source: positional[0] || SOURCE_V3, control: positional[1] || CONTROL };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const source = readJson(path.join(ROOT, args.source), null);
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
  console.log(`[ADD2E][COMPONENT_PRICE_AUDIT] ${summary.composantsUniques} composant(s) V3 : ${summary.composantsVendables} vendable(s), ${summary.horsCatalogueMarchand} hors catalogue.`);
  console.log(`[ADD2E][COMPONENT_PRICE_AUDIT] ${summary.coutExpliciteSort} prix explicite(s), ${summary.prixEquipement} prix d'équipement, ${summary.prixPredit} estimation(s), ${summary.prixDefaut} fallback(s).`);
  if (args.auditOnly) return;
  const rebuilt = rebuildEquipmentCompendium(source, audit);
  control.componentCatalog = { version: VERSION, source: SOURCE_V3, cible: EQUIPMENT_COMPENDIUM, ...rebuilt };
  writeJson(controlPath, control);
  console.log(`[ADD2E][COMPONENT_CATALOG] ${rebuilt.composantsSupprimes} ancien(s) composant(s) supprimé(s), ${rebuilt.composantsCrees} composant(s) créé(s).`);
}

main();
