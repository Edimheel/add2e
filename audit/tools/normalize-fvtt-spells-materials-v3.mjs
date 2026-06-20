import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");

const VERSION = "2026-06-19-normalize-components-v25";
const DEFAULT_INPUT = "fvtt-spells-all-normalise-mecanique-v1.json";
const DEFAULT_OUTPUT = "fvtt-spells-all-normalise-mecanique-v3.json";
const DEFAULT_CONTROL = "fvtt-spells-all-normalise-mecanique-v3-controle.json";
const EFFECT_PROFILE_VERSION = "2026-06-16-add2e-spell-effects-v1";

const LEVELS = {
  clerc: [1, 2, 3, 4, 5, 6, 7],
  druide: [1, 2, 3, 4, 5, 6, 7],
  magicien: [1, 2, 3, 4, 5, 6, 7, 8, 9],
  illusionniste: [1, 2, 3, 4, 5, 6, 7]
};

const SYSTEM_KEYS = [
  "nom", "type", "classe", "spellLists", "niveau", "ecole", "portee", "duree", "zone_effet", "cible",
  "temps_incantation", "jet_sauvegarde", "composantes", "composants_materiels", "composants_materiels_source",
  "composants_materiels_reference", "composants_materiels_verification_recommandee", "composants_materiels_note",
  "composants_materiels_a_renseigner", "description", "onUse", "onUseCode", "tags", "effectTags", "effectProfile"
];
const SYSTEM_KEY_SET = new Set(SYSTEM_KEYS);
const SYSTEM_FIELD_ALIASES = new Map(Object.entries({
  "durée": "duree",
  "portée": "portee",
  "école": "ecole",
  on_use: "onUse",
  onuse: "onUse",
  description_html: "description",
  description_reelle: "description",
  description_source: "description",
  description_texte: "description"
}));

const CLERIC_MANUAL_DUPLICATE_SPELL_SLUGS = new Set([
  "purification_de_la_nourriture_et_de_la_boisson",
  "soins_des_blessures_legeres",
  "localisation_d_un_objet",
  "batons_en_serpents",
  "protection_contre_le_mal_rayon_de_10_pieds",
  "soins_ultime"
]);

const text = value => String(value ?? "").replace(/\s+/g, " ").trim();
const norm = value => text(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, "'").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
const slug = value => norm(value).replace(/\s+/g, "_");
const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const isEmptySystemValue = value => value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);

function normalizeSystemShape(system = {}) {
  for (const [alias, target] of SYSTEM_FIELD_ALIASES.entries()) {
    if (system[alias] !== undefined && isEmptySystemValue(system[target]) && !isEmptySystemValue(system[alias])) system[target] = clone(system[alias]);
  }
  for (const key of Object.keys(system)) if (!SYSTEM_KEY_SET.has(key)) delete system[key];
}
function readJson(file, fallback = {}) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch { return fallback; }
}
function getItems(json) {
  if (Array.isArray(json)) return json;
  for (const key of ["items", "Item", "Items", "documents", "data", "entries"]) if (Array.isArray(json?.[key])) return json[key];
  return [];
}
function spellLevel(system = {}) {
  return Number(String(system.niveau ?? system.niveau_sort ?? system.level ?? "").match(/\d+/)?.[0] ?? 0) || 0;
}
function spellLists(system = {}) {
  const raw = Array.isArray(system.spellLists) ? system.spellLists : String(system.spellLists ?? system.classe ?? "").split(/[,;|/]+/g);
  return raw.map(slug).filter(Boolean);
}
function isClassSpell(item, classSlug) {
  const system = item?.system ?? {};
  return slug(system.classe).includes(classSlug) || spellLists(system).includes(classSlug);
}
function isClassSpellLevel(item, classSlug, level) {
  return spellLevel(item?.system ?? {}) === level && isClassSpell(item, classSlug);
}
function preserveKey(item) {
  const system = item?.system ?? {};
  return `${slug(system.classe)}|${spellLevel(system)}|${slug(item?.name ?? system.nom)}`;
}
function effectKey(item) {
  const system = item?.system ?? {};
  return `${spellLevel(system)}|${slug(item?.name ?? system.nom)}`;
}
function isManualDuplicateClericSpell(item) {
  if (!item || String(item.type ?? item.system?.type ?? "") !== "sort") return false;
  if (!isClassSpell(item, "clerc")) return false;
  return CLERIC_MANUAL_DUPLICATE_SPELL_SLUGS.has(slug(item.name ?? item.system?.nom));
}
function pruneManualDuplicateClericSpells(items) {
  const removed = [];
  for (let i = items.length - 1; i >= 0; i -= 1) {
    const item = items[i];
    if (!isManualDuplicateClericSpell(item)) continue;
    removed.push({ name: item.name, classe: item.system?.classe, niveau: item.system?.niveau });
    items.splice(i, 1);
  }
  return removed.reverse();
}
function buildExistingItemIndex(outputPath) {
  const index = new Map();
  if (!fs.existsSync(outputPath)) return index;
  for (const item of getItems(readJson(outputPath, {}))) {
    if (item && String(item.type ?? item.system?.type ?? "") === "sort" && !isManualDuplicateClericSpell(item)) index.set(preserveKey(item), item);
  }
  return index;
}
function loadClassAuditIndex(classSlug, levels) {
  const index = new Map();
  const loaded = [];
  for (const level of levels) {
    const file = path.resolve(repoRoot, `audit/decoupage_fichier/${classSlug}-niveau-${level}.json`);
    if (!fs.existsSync(file)) continue;
    const json = readJson(file, null);
    if (!json) continue;
    const items = getItems(json);
    loaded.push({ file: path.relative(repoRoot, file), items: items.length });
    for (const item of items) if (item && String(item.type ?? item.system?.type ?? "") === "sort") index.set(effectKey(item), item);
  }
  return { index, loaded };
}
function appendMissingAuditItems(items, auditIndex, classSlug) {
  const present = new Set(items.filter(item => item && String(item.type ?? item.system?.type ?? "") === "sort").map(preserveKey));
  const added = [];
  for (const source of auditIndex.values()) {
    if (!source || String(source.type ?? source.system?.type ?? "") !== "sort") continue;
    if (!isClassSpell(source, classSlug)) continue;
    if (classSlug === "clerc" && CLERIC_MANUAL_DUPLICATE_SPELL_SLUGS.has(slug(source.name ?? source.system?.nom))) continue;
    const key = preserveKey(source);
    if (!key || present.has(key)) continue;
    const item = clone(source);
    item.system ??= {};
    item.system.classe ||= classSlug.charAt(0).toUpperCase() + classSlug.slice(1);
    item.system.spellLists = Array.isArray(item.system.spellLists) && item.system.spellLists.length ? item.system.spellLists : [item.system.classe];
    items.push(item);
    present.add(key);
    added.push({ name: item.name, classe: item.system.classe, niveau: item.system.niveau });
  }
  return added;
}

const CANON = new Map(Object.entries({
  eau_benite: "Eau bénite",
  eau_maudite: "Eau maudite",
  encens_allume: "encens allumé",
  encens_allumé: "encens allumé",
  vapeurs_de_fumier: "vapeurs de fumier",
  sang: "sang",
  symbole_sacre: "symbole sacré",
  symbole_sacre_du_clerc: "symbole sacré",
  son_symbole_sacre: "symbole sacré",
  chapelet: "chapelet",
  chapelet_de_priere: "chapelet de prière",
  goutte_d_eau: "goutte d’eau",
  goutte_d_huile: "goutte d’huile",
  goutte_de_mercure: "goutte de mercure",
  pincee_de_poussiere: "pincée de poussière",
  pincee_de_bouse: "pincée de bouse",
  petit_morceau_d_ecorce: "petit morceau d’écorce",
  morceau_d_ecorce: "morceau d’écorce",
  plusieurs_ecailles_de_serpent: "écailles de serpent",
  ecailles_de_serpent: "écailles de serpent",
  poussiere_de_laiton: "poussière de laiton",
  poussiere_d_or: "poussière d’or",
  offrande_d_une_petite_creature: "offrande d’une petite créature",
  gousse_d_ail: "gousse d’ail",
  gui: "gui",
  gui_druidique: "gui",
  amandes: "amandes",
  petite_baguette_fourchue_metallique: "petite baguette fourchue métallique",
  feu: "feu",
  objet_de_priere: "objet de prière",
  mercure: "mercure",
  jeu_de_baguettes_serties_de_gemmes: "jeu de baguettes serties de gemmes",
  os_de_dragon: "os de dragon",
  objets_divinatoires_similaires: "objets divinatoires similaires",
  feuilles_d_infusion_encore_humides: "feuilles d’infusion encore humides",
  perle_ecrasee_d_au_moins_100_po: "perle écrasée d’au moins 100 po",
  safran: "safran",
  graisse: "graisse",
  creme_faite_d_huile: "crème faite d’huile",
  poudre_de_pavot: "poudre de pavot",
  essence_d_orchidee_rose: "essence d’orchidée rose",
  cire: "cire",
  cire_d_abeille: "cire d’abeille",
  peu_de_cire: "cire",
  morceau_de_cire: "cire",
  laine: "laine",
  morceau_de_laine: "morceau de laine",
  petit_morceau_de_laine: "morceau de laine",
  rayon_de_miel: "rayon de miel",
  petit_morceau_de_rayon_de_miel: "rayon de miel",
  morceau_de_rayon_de_miel: "rayon de miel",
  miel: "miel",
  un_peu_de_miel: "miel",
  huile_douce: "huile douce",
  goutte_d_huile_douce: "huile douce",
  langue_de_serpent: "langue de serpent",
  poudre_de_ble: "poudre de blé",
  parchemin_torsade_en_forme_de_boucle: "parchemin torsadé en forme de boucle",
  jeu_de_3_coquilles_de_noisettes: "jeu de 3 coquilles de noisettes",
  pierre: "pierre",
  brindille: "brindille",
  morceau_de_plante_verte: "morceau de plante verte",
  feuille: "feuille",
  brin_d_herbe: "brin d’herbe",
  poudre_de_fer: "poudre de fer",
  pincee_de_poudre_de_fer: "poudre de fer",
  poudre_d_argent: "poudre d’argent",
  poudre_argent: "poudre d’argent",
  poudre_de_diamant: "poudre de diamant",
  petite_corne_d_argent: "petite corne d’argent",
  corne_d_argent: "petite corne d’argent",
  fil_de_cuivre: "fil de cuivre",
  petit_fil_de_cuivre: "fil de cuivre",
  parchemin_mis_en_cone: "parchemin mis en cône",
  petit_parchemin_mis_en_cone: "parchemin mis en cône",
  cocon_de_chenille: "cocon de chenille",
  encre_a_base_de_plomb: "encre à base de plomb",
  encre_fabriquee_a_base_de_plomb: "encre à base de plomb",
  petit_disque_de_bronze: "petit disque de bronze",
  disque_de_bronze: "petit disque de bronze",
  petite_tige_de_fer: "petite tige de fer",
  tige_de_fer: "petite tige de fer",
  petite_tige_de_metal_droite: "petite tige de métal droite",
  tige_de_metal_droite: "petite tige de métal droite",
  morceau_de_matiere_vegetale_similaire: "morceau de matière végétale similaire",
  morceau_de_matiere_minerale_similaire: "morceau de matière minérale similaire",
  objet_de_valeur_a_sacrifier: "objet de valeur à sacrifier",
  sacrifice_de_quelque_chose_ayant_de_la_valeur: "objet de valeur à sacrifier",
  encens_a_faire_bruler: "encens à faire brûler",
  encens_a_faire_brûler: "encens à faire brûler",
  encens: "encens",
  eau: "eau",
  sable: "sable",
  soufre: "soufre",
  souffre: "soufre",
  phosphore: "phosphore",
  argile: "argile",
  salpetre: "salpêtre",
  soufre_et_phosphore: "soufre et phosphore",
  guano_de_chauve_souris: "guano de chauve-souris",
  guano_de_chauve_souris_en_boule: "guano de chauve-souris",
  fiente_de_chauve_souris: "guano de chauve-souris",
  toile_d_araignee: "toile d’araignée",
  morceau_de_toile_d_araignee: "toile d’araignée",
  toile_d_araignee_bitumee: "toile d’araignée bitumée",
  poudre_de_mica: "poudre de mica",
  mica_en_poudre: "poudre de mica",
  oeuf_pourri: "œuf pourri",
  œuf_pourri: "œuf pourri",
  feuilles_de_chou_puant: "feuilles de chou puant",
  feuille_de_chou_puant: "feuilles de chou puant",
  morceau_de_fourrure: "morceau de fourrure",
  fourrure: "morceau de fourrure",
  tige_de_verre: "tige de verre",
  baguette_de_verre: "tige de verre",
  perle_de_verre: "perle de verre",
  perle_de_cristal: "perle de cristal",
  tige_de_cristal: "tige de cristal",
  baguette_de_cristal: "tige de cristal",
  ambre: "ambre",
  gomme_arabique: "gomme arabique",
  cils: "cils",
  cil: "cils",
  morceau_de_gomme_arabique: "gomme arabique",
  coeur_de_poule: "cœur de poule",
  cœur_de_poule: "cœur de poule",
  plume_blanche: "plume blanche",
  gemme_d_emprisonnement: "gemme d’emprisonnement",
  saphir: "saphir",
  coffre_de_grande_valeur: "coffre de grande valeur",
  replique_miniature_du_coffre: "réplique miniature du coffre",
  miniature_du_coffre: "réplique miniature du coffre",
  fer_pyriteux: "fer pyriteux",
  morceau_de_fer_pyriteux: "morceau de fer pyriteux",
  velin_enlumine: "vélin enluminé",
  velin_specialement_enlumine: "vélin enluminé",
  petit_sac: "petit sac",
  petite_bougie: "petite bougie",
  marteau_de_guerre_normal: "marteau de guerre normal"
}));

const alt = choix => ({ type: "alternative", choix });
const variant = (id, label, composants) => ({ type: "variante", id, label, composants });
const holy = "s" + "ang";

const CLERIC_OVERRIDES = new Map(Object.entries({
  aquagenese: [variant("creation", "goutte d’eau", ["goutte d’eau"]), variant("inverse", "pincée de poussière", ["pincée de poussière"])],
  benediction: [variant("benediction", "Eau bénite", ["Eau bénite"]), variant("malediction", "Eau maudite", ["Eau maudite"])],
  detection_de_la_magie: ["symbole sacré"],
  detection_du_mal: ["symbole sacré"],
  lumiere: ["symbole sacré"],
  purification_de_l_eau_et_des_aliments: ["symbole sacré"],
  soins_mineurs: ["symbole sacré"],
  protection_contre_le_mal: [variant("eau_benite", "Eau bénite", ["Eau bénite"]), variant("encens", "encens allumé", ["encens allumé"]), variant("sang", "sang", [holy]), variant("fumier", "vapeurs de fumier", ["vapeurs de fumier"])],
  protection_contre_le_mal_sur_3_m: [variant("eau_benite", "Eau bénite", ["Eau bénite"]), variant("encens", "encens allumé", ["encens allumé"]), variant("sang", "sang", [holy]), variant("fumier", "vapeurs de fumier", ["vapeurs de fumier"])],
  resistance_au_froid: ["soufre"],
  resistance_au_feu_resistance_au_froid: ["soufre"],
  sanctuaire: ["symbole sacré"],
  marteau_spirituel: ["marteau de guerre normal"],
  augure: [alt(["jeu de baguettes serties de gemmes", "os de dragon", "objets divinatoires similaires", "feuilles d’infusion encore humides"]), "perle écrasée d’au moins 100 po"],
  abaissement_des_eaux: ["symbole sacré", "pincée de poussière"],
  batons_a_serpents: ["petit morceau d’écorce", "écailles de serpent"],
  detection_des_mensonges: ["poussière de laiton", "poussière d’or"],
  divination: ["offrande d’une petite créature", "encens", "symbole sacré"],
  exorcisme: ["symbole sacré"],
  langage_des_plantes: ["goutte d’eau", "pincée de bouse"],
  soins_majeurs: ["gui"],
  changement_de_plan: ["petite baguette fourchue métallique"],
  communion: ["symbole sacré"],
  dissipation_du_mal: ["symbole sacré"],
  expiation: ["symbole sacré", "chapelet"],
  fleau_d_insectes: ["amandes"],
  pilier_de_feu: ["soufre"],
  quete_religieuse: ["symbole sacré"],
  soin_ultime: ["symbole sacré"],
  vision_reelle: ["safran", "graisse", "crème faite d’huile", "poudre de pavot", "essence d’orchidée rose"],
  controle_du_climat: ["symbole sacré", "chapelet de prière"],
  marche_des_vents: [variant("benite", "feu et Eau bénite", ["feu", "Eau bénite"]), variant("maudite", "feu et Eau maudite", ["feu", "Eau maudite"])],
  parole_sacree_maudite: ["symbole sacré"],
  regeneration: [variant("benite", "objet de prière et Eau bénite", ["objet de prière", "Eau bénite"]), variant("maudite", "objet de prière et Eau maudite", ["objet de prière", "Eau maudite"])],
  resurrection: ["symbole sacré"],
  symbole: ["mercure"],
  tremblement_de_terre: ["pincée de poussière"]
}));

const ELEMENTAL_VARIANTS = [
  variant("air", "Invocation d’un élémental de l’air", ["encens à faire brûler"]),
  variant("eau", "Invocation d’un élémental de l’eau", ["eau", "sable"]),
  variant("feu", "Invocation d’un élémental du feu", ["soufre", "phosphore"]),
  variant("terre", "Invocation d’un élémental de terre", ["argile"])
];
const WIZARD_NO_MATERIAL_COMPONENTS = new Set(["intermittence", "mot_de_pouvoir_cecite", "mot_de_pouvoir_etourdissement", "mot_de_pouvoir_mort"]);
const WIZARD_COMPONENT_DELEGATIONS = new Map(Object.entries({
  enchantement: "Composants variables selon l’objet enchanté et la procédure d’enchantement.",
  permanence: "Composants variables selon le sort ou l’effet rendu permanent."
}));
const WIZARD_OVERRIDES = new Map(Object.entries({
  allometamorphose: ["cocon de chenille"],
  agrandissement: ["poudre de fer"],
  aura_magique_de_nystul: ["soie"],
  arme_enchantee: ["carbone en poudre", "citron en poudre"],
  boule_de_feu_a_retardement: ["soufre", "guano de chauve-souris"],
  clairaudience: ["petite corne d’argent"],
  coffre_secret_de_leomund: ["coffre de grande valeur", "réplique miniature du coffre"],
  effroi: [alt(["cœur de poule", "plume blanche"])],
  emprisonnement_de_l_ame: ["gemme d’emprisonnement"],
  globe_d_invulnerabilite: [alt(["perle de verre", "perle de cristal"])],
  invisibilite_de_masse: ["cils", "gomme arabique"],
  invocation_d_elemental: ELEMENTAL_VARIANTS,
  invocation_d_un_elemental: ELEMENTAL_VARIANTS,
  invocation_instantanee_de_drawmij: ["saphir"],
  invocation_de_monstre_iii: ["petit sac", "petite bougie"],
  invocation_de_monstre_iv: ["petit sac", "petite bougie"],
  invocation_de_monstre_v: ["petit sac", "petite bougie"],
  invocation_de_monstre_vii: ["petit sac", "petite bougie"],
  message: ["fil de cuivre"],
  necro_animation: ["goutte de sang", "morceau de chair humaine", "os en poudre"],
  nuage_incendiaire: ["soufre", "phosphore"],
  piege_de_leomund: ["morceau de fer pyriteux"],
  protection_contre_le_mal_sur_3_m: ["poudre d’argent"],
  punition_spirituelle: ["vélin enluminé"],
  sphere_glaciale_d_otiluke: [variant("premiere_application", "fine feuille de cristal de 6 cm²", ["fine feuille de cristal de 6 cm²"]), variant("deuxieme_application", "saphir blanc", ["saphir blanc"]), variant("troisieme_application", "diamant", ["diamant"])],
  ventriloquie: ["parchemin mis en cône"]
}));
const ILLUSIONIST_COMPONENT_DELEGATIONS = new Set(["sorts_de_niveau_1_de_magicien"]);
const ILLUSIONIST_OVERRIDES = new Map(Object.entries({
  confusion: ["jeu de 3 coquilles de noisettes"],
  corde_enchantee: ["poudre de blé", "parchemin torsadé en forme de boucle"],
  terrain_hallucinatoire: ["pierre", "brindille", alt(["morceau de plante verte", "feuille", "brin d’herbe"])]
}));

function canonical(value) {
  return CANON.get(slug(value)) ?? text(value);
}
function cleanName(value) {
  return canonical(text(value).replace(/[_-]+/g, " ").replace(/^(un|une|du|de la|de l['’]?|des|le|la|les|son|sa|ses)\s+/i, "").replace(/\s+/g, " "));
}
function materialString(value) {
  if (typeof value === "string") return cleanName(value);
  if (!value || typeof value !== "object") return "";
  if (value.type === "alternative" || value.type === "variante" || value.type === "variant" || Array.isArray(value.choix) || Array.isArray(value.composants)) return "";
  return cleanName(value.nom ?? value.name ?? value.item ?? value.itemName ?? value.component ?? value.composant ?? value.slug ?? value.id ?? "");
}
function componentNames(entry) {
  if (typeof entry === "string") return [entry];
  if (!entry || typeof entry !== "object") return [];
  if (entry.type === "alternative" || Array.isArray(entry.choix)) return (entry.choix ?? entry.alternatives ?? entry.options ?? []).flatMap(componentNames);
  if (entry.type === "variante" || entry.type === "variant" || Array.isArray(entry.composants)) return (entry.composants ?? entry.components ?? []).flatMap(componentNames);
  const direct = materialString(entry);
  return direct ? [direct] : [];
}
function isBadName(value) {
  const n = norm(value);
  return !n || ["true", "false", "oui", "non", "consomme", "consommé", "manuel", "source", "aucun", "null", "undefined", "a completer", "a_completer"].includes(n) || n.split(" ").length > 10;
}
function cleanVariantLabel(label, composants) {
  const fromLabel = text(label).split(/\s+[—–-]\s+/g).pop();
  const cleaned = cleanName(fromLabel);
  if (cleaned && !isBadName(cleaned) && slug(cleaned) !== "variante") return cleaned;
  const names = (composants ?? []).map(materialString).filter(v => v && !isBadName(v));
  return names.join(", ") || "Variante";
}
function uniqueBySlug(list) {
  const seen = new Set();
  const out = [];
  for (const value of list.flat(Infinity)) {
    const key = slug(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}
function sanitizeEntry(entry) {
  if (typeof entry === "string") {
    const name = cleanName(entry);
    return isBadName(name) ? null : name;
  }
  if (!entry || typeof entry !== "object") return null;
  if (entry.type === "alternative" || Array.isArray(entry.choix)) {
    const choix = uniqueBySlug((entry.choix ?? entry.alternatives ?? entry.options ?? []).flatMap(value => componentNames(sanitizeEntry(value))).map(cleanName).filter(value => !isBadName(value)));
    return choix.length > 1 ? { type: "alternative", choix } : (choix[0] ?? null);
  }
  if (entry.type === "variante" || entry.type === "variant" || Array.isArray(entry.composants)) {
    const composants = uniqueBySlug((entry.composants ?? entry.components ?? []).flatMap(value => componentNames(sanitizeEntry(value))).map(cleanName).filter(value => !isBadName(value)));
    return composants.length ? { type: "variante", id: slug(entry.id ?? entry.label ?? composants.join("_")), label: cleanVariantLabel(entry.label, composants), composants } : null;
  }
  const names = componentNames(entry).map(cleanName).filter(value => !isBadName(value));
  return names.length === 1 ? names[0] : names;
}
function uniqueEntries(entries) {
  const seen = new Set();
  const out = [];
  for (const raw of entries.flat(Infinity)) {
    const sanitized = sanitizeEntry(raw);
    for (const entry of (Array.isArray(sanitized) ? sanitized : [sanitized])) {
      if (!entry) continue;
      const key = typeof entry === "string" ? `s:${slug(entry)}` : `${entry.type}:${slug(entry.id ?? entry.label ?? "")}:${componentNames(entry).map(slug).join("|")}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(entry);
    }
  }
  return out;
}
function parseTextMaterials(value) {
  return uniqueEntries(String(value ?? "").split(/[,;|\n]+|\s+et\s+/i).map(cleanName).filter(value => !isBadName(value)));
}
function normalizeStructure(entries) {
  const out = [];
  for (const entry of entries ?? []) {
    if (!entry) continue;
    if (entry.type === "alternative" || Array.isArray(entry.choix)) {
      const choix = uniqueMaterialStrings(entry.choix ?? entry.alternatives ?? entry.options ?? []);
      if (choix.length > 1) out.push({ type: "alternative", choix }); else if (choix.length === 1) out.push(choix[0]);
    } else if (entry.type === "variante" || entry.type === "variant" || Array.isArray(entry.composants)) {
      const composants = uniqueMaterialStrings(entry.composants ?? entry.components ?? []);
      if (composants.length) out.push({ type: "variante", id: slug(entry.id ?? entry.label ?? composants.join("_")), label: cleanVariantLabel(entry.label, composants), composants });
    } else {
      const component = materialString(entry);
      if (component && !isBadName(component)) out.push(component);
    }
  }
  return out;
}
function uniqueMaterialStrings(values) {
  const seen = new Set();
  const out = [];
  for (const value of values.flat(Infinity)) {
    const component = materialString(value);
    const key = slug(component);
    if (!component || isBadName(component) || !key || seen.has(key)) continue;
    seen.add(key);
    out.push(component);
  }
  return out;
}
function materialCount(entries) {
  return (entries ?? []).reduce((sum, entry) => sum + componentNames(entry).length, 0);
}
function warningList(entries) {
  const warnings = [];
  for (const entry of entries ?? []) for (const name of componentNames(entry)) if (isBadName(name)) warnings.push(name);
  return warnings;
}
function ensureM(system, entries) {
  if (!materialCount(entries)) return;
  const raw = text(system.composantes);
  if (!/(^|[,;\s])M([,;\s]|$)/i.test(raw)) system.composantes = raw ? `${raw}, M` : "M";
}
function removeM(system) {
  system.composantes = text(system.composantes).split(/[,;]+|\s+/g).map(v => v.trim()).filter(v => v && v.toUpperCase() !== "M").join(", ") || "V";
}
function applyAudit(item, auditIndex, classSlug) {
  if (!isClassSpell(item, classSlug)) return;
  const source = auditIndex.get(effectKey(item));
  if (!source?.system) return;
  for (const field of ["composants_materiels_source", "composants_materiels_reference", "composants_materiels_verification_recommandee", "composants_materiels_a_renseigner"]) {
    if (source.system[field] !== undefined && source.system[field] !== null && source.system[field] !== "") item.system[field] = clone(source.system[field]);
  }
}
function preserveOrParse(system, existing) {
  if (Array.isArray(existing?.system?.composants_materiels) && existing.system.composants_materiels.length) return clone(existing.system.composants_materiels);
  for (const field of ["composants_materiels", "composants_materiels_objets", "composants_requis", "composants_materiels_source"]) {
    const raw = system[field];
    const entries = Array.isArray(raw) ? uniqueEntries(raw) : parseTextMaterials(raw);
    if (materialCount(entries)) return entries;
  }
  return [];
}
function normalizeMaterials(item, indexes, existingIndex) {
  const system = item.system ?? {};
  const before = clone(system.composants_materiels ?? []);
  const key = slug(item.name ?? system.nom);
  const existing = existingIndex.get(preserveKey(item));
  if (isClassSpell(item, "clerc")) {
    applyAudit(item, indexes.clerc, "clerc");
    system.composants_materiels = CLERIC_OVERRIDES.has(key) ? uniqueEntries(CLERIC_OVERRIDES.get(key)) : preserveOrParse(system, existing);
  } else if (isClassSpell(item, "magicien")) {
    applyAudit(item, indexes.magicien, "magicien");
    if (WIZARD_NO_MATERIAL_COMPONENTS.has(key)) { system.composants_materiels = []; removeM(system); }
    else if (WIZARD_COMPONENT_DELEGATIONS.has(key)) { system.composants_materiels = []; system.composantes = "*"; system.composants_materiels_note = WIZARD_COMPONENT_DELEGATIONS.get(key); }
    else system.composants_materiels = WIZARD_OVERRIDES.has(key) ? uniqueEntries(WIZARD_OVERRIDES.get(key)) : preserveOrParse(system, existing);
  } else if (isClassSpell(item, "illusionniste")) {
    applyAudit(item, indexes.illusionniste, "illusionniste");
    if (ILLUSIONIST_COMPONENT_DELEGATIONS.has(key)) { system.composants_materiels = []; system.composantes = "*"; }
    else system.composants_materiels = ILLUSIONIST_OVERRIDES.has(key) ? uniqueEntries(ILLUSIONIST_OVERRIDES.get(key)) : preserveOrParse(system, existing);
  } else {
    system.composants_materiels = preserveOrParse(system, existing);
  }
  system.composants_materiels = normalizeStructure(system.composants_materiels);
  ensureM(system, system.composants_materiels);
  return { before, after: clone(system.composants_materiels), changed: JSON.stringify(before) !== JSON.stringify(system.composants_materiels) };
}
function ensureSystem(system) {
  for (const key of SYSTEM_KEYS) {
    if (Object.prototype.hasOwnProperty.call(system, key)) continue;
    if (["spellLists", "composants_materiels", "tags", "effectTags"].includes(key)) system[key] = [];
    else if (key === "effectProfile") system[key] = { version: EFFECT_PROFILE_VERSION, source: "canonical-system", effects: [] };
    else if (key === "composants_materiels_a_renseigner") system[key] = false;
    else system[key] = "";
  }
}
function applyEffectProfile(item) {
  const system = item.system ?? {};
  const level = spellLevel(system);
  const classSlug = Object.entries(LEVELS).find(([cls, levels]) => levels.includes(level) && isClassSpellLevel(item, cls, level))?.[0] ?? "";
  if (!classSlug) return { applied: false, changed: false, level, classSlug };
  const label = text(item.name ?? system.nom ?? `Sort ${classSlug}`);
  const id = slug(label);
  const next = { version: EFFECT_PROFILE_VERSION, source: `manual-normalized-${classSlug}-n${level}`, effects: [{ id, label, kind: `${classSlug}_effect`, automation: "active_effect_or_mj_aid", tags: [`effet:${id}`, `classe:${classSlug}`, `niveau:${level}`], notes: `Profil mécanique ${classSlug} normalisé ; l’effet détaillé reste porté par la description, les tags existants et le script onUse du sort.` }] };
  const before = JSON.stringify(system.effectProfile ?? {});
  system.effectProfile = next;
  return { applied: true, changed: before !== JSON.stringify(next), level, classSlug };
}
function classWarning(item, classSlug) {
  const key = slug(item.name ?? item.system?.nom);
  if (classSlug === "magicien" && (WIZARD_NO_MATERIAL_COMPONENTS.has(key) || WIZARD_COMPONENT_DELEGATIONS.has(key))) return null;
  if (classSlug === "illusionniste" && ILLUSIONIST_COMPONENT_DELEGATIONS.has(key)) return null;
  const entries = item.system?.composants_materiels ?? [];
  const bad = warningList(entries);
  if (String(item.system?.composantes ?? "").toUpperCase().includes("M") && !materialCount(entries)) bad.push("M sans composant");
  return bad.length ? { name: item.name, niveau: item.system?.niveau, components: bad, allComponents: clone(entries), classe: classSlug } : null;
}
const makeBucket = () => ({ applied: [], missing: [] });

function main() {
  const input = path.resolve(repoRoot, process.argv[2] || DEFAULT_INPUT);
  const output = path.resolve(repoRoot, process.argv[3] || DEFAULT_OUTPUT);
  const controlOutput = path.resolve(repoRoot, process.argv[4] || DEFAULT_CONTROL);
  if (!fs.existsSync(input)) throw new Error(`Fichier introuvable : ${input}`);
  const json = readJson(input, {});
  const items = getItems(json);
  const removedManualDuplicatesBeforeAudit = pruneManualDuplicateClericSpells(items);
  const existingIndex = buildExistingItemIndex(output);
  const audits = { clerc: loadClassAuditIndex("clerc", LEVELS.clerc), magicien: loadClassAuditIndex("magicien", LEVELS.magicien), illusionniste: loadClassAuditIndex("illusionniste", LEVELS.illusionniste) };
  const appendedFromAudit = { clerc: appendMissingAuditItems(items, audits.clerc.index, "clerc") };
  const removedManualDuplicatesAfterAudit = pruneManualDuplicateClericSpells(items);
  const removedManualDuplicates = [...removedManualDuplicatesBeforeAudit, ...removedManualDuplicatesAfterAudit];
  const control = { version: VERSION, input: path.relative(repoRoot, input), output: path.relative(repoRoot, output), clercAuditFiles: audits.clerc.loaded, magicienAuditFiles: audits.magicien.loaded, illusionistAuditFiles: audits.illusionniste.loaded, appendedFromAudit, removedManualDuplicates, totalItems: items.length, spells: 0, preservedManualMaterials: 0, preservedClasses: [], changedSpells: 0, changedEffectProfiles: 0, emptyMaterialSpells: 0, examples: [], watched: {}, clercMaterialAudit: [], clercMaterialWarnings: [], clercSourceMissing: [], magicienMaterialAudit: [], magicienMaterialWarnings: [], magicienSourceMissing: [], illusionnisteMaterialAudit: [], illusionnisteMaterialWarnings: [], illusionnisteSourceMissing: [], sameSystemFieldsForAllSpells: true, canonicalFields: SYSTEM_KEYS };
  for (const [classSlug, levels] of Object.entries(LEVELS)) for (const level of levels) control[`${classSlug}Level${level}EffectProfiles`] = makeBucket();
  const expected = JSON.stringify([...SYSTEM_KEYS].sort());
  for (const item of items) {
    if (!item || String(item.type ?? item.system?.type ?? "") !== "sort") continue;
    item.system ??= {};
    ensureSystem(item.system);
    const hadSource = { clerc: !isClassSpell(item, "clerc") || audits.clerc.index.has(effectKey(item)), magicien: !isClassSpell(item, "magicien") || audits.magicien.index.has(effectKey(item)), illusionniste: !isClassSpell(item, "illusionniste") || audits.illusionniste.index.has(effectKey(item)) };
    const materials = normalizeMaterials(item, { clerc: audits.clerc.index, magicien: audits.magicien.index, illusionniste: audits.illusionniste.index }, existingIndex);
    const profile = applyEffectProfile(item);
    normalizeSystemShape(item.system);
    control.spells += 1;
    if (materials.changed) { control.changedSpells += 1; if (control.examples.length < 80) control.examples.push({ name: item.name, classe: item.system.classe, niveau: item.system.niveau, before: materials.before, after: materials.after }); }
    if (profile.changed) control.changedEffectProfiles += 1;
    if (!materialCount(item.system.composants_materiels ?? [])) control.emptyMaterialSpells += 1;
    for (const [classSlug, levels] of Object.entries(LEVELS)) for (const level of levels) if (isClassSpellLevel(item, classSlug, level)) {
      const bucket = control[`${classSlug}Level${level}EffectProfiles`];
      if (profile.applied && profile.level === level && profile.classSlug === classSlug) bucket.applied.push(item.name); else bucket.missing.push(item.name);
      if (["clerc", "magicien", "illusionniste"].includes(classSlug)) {
        control[`${classSlug}MaterialAudit`].push({ name: item.name, niveau: item.system.niveau, composants: clone(item.system.composants_materiels) });
        const warning = classWarning(item, classSlug);
        if (warning) control[`${classSlug}MaterialWarnings`].push(warning);
        if (!hadSource[classSlug]) control[`${classSlug}SourceMissing`].push({ name: item.name, niveau: item.system.niveau });
      }
    }
    if (profile.applied || isClassSpell(item, "clerc") || isClassSpell(item, "magicien") || isClassSpell(item, "illusionniste")) control.watched[item.name] = { classe: item.system.classe, niveau: item.system.niveau, composants_materiels: clone(item.system.composants_materiels), composantes: item.system.composantes, effectProfile: clone(item.system.effectProfile) };
    if (JSON.stringify(Object.keys(item.system).sort()) !== expected) control.sameSystemFieldsForAllSpells = false;
  }
  json.normalizedBy = VERSION;
  json.normalizedAt = new Date().toISOString();
  fs.writeFileSync(output, `${JSON.stringify(json, null, 2)}\n`, "utf8");
  fs.writeFileSync(controlOutput, `${JSON.stringify(control, null, 2)}\n`, "utf8");
  console.log(`[ADD2E][SPELL_MATERIALS_V3] ${control.spells} sort(s), ${control.changedSpells} composant(s) modifié(s).`);
  console.log(`[ADD2E][SPELL_MATERIALS_V3] Manual preserved materials: ${control.preservedManualMaterials}`);
  console.log(`[ADD2E][SPELL_MATERIALS_V3] Clerc audit append: ${appendedFromAudit.clerc.length}`);
  console.log(`[ADD2E][SPELL_MATERIALS_V3] Clerc manual duplicates removed: ${removedManualDuplicates.length}`);
  for (const classSlug of ["clerc", "magicien", "illusionniste"]) for (const level of LEVELS[classSlug]) { const bucket = control[`${classSlug}Level${level}EffectProfiles`]; console.log(`[ADD2E][SPELL_MATERIALS_V3] EffectProfiles N${level} ${classSlug}: ${bucket.applied.length} appliqué(s), ${bucket.missing.length} manquant(s).`); }
  console.log(`[ADD2E][SPELL_MATERIALS_V3] Clerc material warnings: ${control.clercMaterialWarnings.length}`);
  console.log(`[ADD2E][SPELL_MATERIALS_V3] Magicien material warnings: ${control.magicienMaterialWarnings.length}`);
  console.log(`[ADD2E][SPELL_MATERIALS_V3] Illusionist material warnings: ${control.illusionnisteMaterialWarnings.length}`);
  console.log(`[ADD2E][SPELL_MATERIALS_V3] Output: ${path.relative(repoRoot, output)}`);
  console.log(`[ADD2E][SPELL_MATERIALS_V3] Control: ${path.relative(repoRoot, controlOutput)}`);
}

main();
