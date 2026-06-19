import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");

const VERSION = "2026-06-19-normalize-cleric-components-text-mining-v15";
const DEFAULT_INPUT = "fvtt-spells-all-normalise-mecanique-v1.json";
const DEFAULT_OUTPUT = "fvtt-spells-all-normalise-mecanique-v3.json";
const DEFAULT_CONTROL = "fvtt-spells-all-normalise-mecanique-v3-controle.json";
const EFFECT_PROFILE_VERSION = "2026-06-16-add2e-spell-effects-v1";

const CLERIC_LEVELS = [1, 2, 3, 4, 5, 6, 7];
const DRUID_LEVELS = [1, 2, 3, 4, 5, 6, 7];
const WIZARD_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const ILLUSIONIST_LEVELS = [1, 2, 3, 4, 5, 6, 7];

// Seuls les druides restent protégés. Les clercs repassent dans le même text mining que les magiciens.
const MATERIAL_PRESERVE_CLASSES = new Set(["druide"]);
const MATERIAL_PRESERVE_FIELDS = [
  "composants_materiels",
  "composants_materiels_source",
  "composants_materiels_reference",
  "composants_materiels_verification_recommandee",
  "composants_materiels_note",
  "composants_materiels_a_renseigner"
];
const SYSTEM_KEYS = [
  "nom", "type", "classe", "spellLists", "niveau", "ecole", "portee", "duree", "zone_effet", "cible",
  "temps_incantation", "jet_sauvegarde", "composantes", "composants_materiels", "composants_materiels_source",
  "composants_materiels_reference", "composants_materiels_verification_recommandee", "composants_materiels_note",
  "composants_materiels_a_renseigner", "description", "onUse", "onUseCode", "tags", "effectTags", "effectProfile"
];

function text(value) { return String(value ?? "").replace(/\s+/g, " ").trim(); }
function norm(value) {
  return text(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "'").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}
function slug(value) { return norm(value).replace(/\s+/g, "_"); }
function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
function getItems(json) {
  if (Array.isArray(json)) return json;
  for (const key of ["items", "Item", "Items", "documents", "data", "entries"]) if (Array.isArray(json?.[key])) return json[key];
  return [];
}
function spellLevel(system = {}) {
  const m = String(system.niveau ?? system.niveau_sort ?? system.level ?? "").match(/\d+/);
  return m ? Number(m[0]) || 0 : 0;
}
function spellLists(system = {}) {
  const raw = Array.isArray(system.spellLists) ? system.spellLists : String(system.spellLists ?? system.classe ?? "").split(/[,;|/]+/g);
  return raw.map(slug).filter(Boolean);
}
function isClassSpellLevel(item, classSlug, level) {
  const system = item?.system ?? {};
  const cls = slug(system.classe);
  const lists = spellLists(system);
  return spellLevel(system) === level && (cls.includes(classSlug) || lists.includes(classSlug));
}
function isClercSpellLevel(item, level) { return isClassSpellLevel(item, "clerc", level); }
function isDruideSpellLevel(item, level) { return isClassSpellLevel(item, "druide", level); }
function isMagicienSpellLevel(item, level) { return isClassSpellLevel(item, "magicien", level); }
function isIllusionnisteSpellLevel(item, level) { return isClassSpellLevel(item, "illusionniste", level); }
function isClercSpell(item) { const level = spellLevel(item?.system ?? {}); return CLERIC_LEVELS.includes(level) && isClercSpellLevel(item, level); }
function isDruideSpell(item) { const level = spellLevel(item?.system ?? {}); return DRUID_LEVELS.includes(level) && isDruideSpellLevel(item, level); }
function isMagicienSpell(item) { const level = spellLevel(item?.system ?? {}); return WIZARD_LEVELS.includes(level) && isMagicienSpellLevel(item, level); }
function isIllusionnisteSpell(item) { const level = spellLevel(item?.system ?? {}); return ILLUSIONIST_LEVELS.includes(level) && isIllusionnisteSpellLevel(item, level); }
function preserveKey(item) { const system = item?.system ?? {}; return `${slug(system.classe)}|${spellLevel(system)}|${slug(item?.name ?? system.nom)}`; }
function effectKey(item) { const system = item?.system ?? {}; return `${spellLevel(system)}|${slug(item?.name ?? system.nom)}`; }

function buildExistingItemIndex(outputPath) {
  const index = new Map();
  if (!fs.existsSync(outputPath)) return index;
  try {
    const json = JSON.parse(fs.readFileSync(outputPath, "utf8"));
    for (const item of getItems(json)) if (item && String(item.type ?? item.system?.type ?? "") === "sort") index.set(preserveKey(item), item);
  } catch (err) {
    console.warn(`[ADD2E][SPELL_MATERIALS_V3] Impossible de lire le fichier de préservation : ${outputPath}`, err?.message ?? err);
  }
  return index;
}

function loadClassAuditIndex(classSlug, levels) {
  const index = new Map();
  const loaded = [];
  for (const level of levels) {
    const file = path.resolve(repoRoot, `audit/decoupage_fichier/${classSlug}-niveau-${level}.json`);
    if (!fs.existsSync(file)) continue;
    try {
      const json = JSON.parse(fs.readFileSync(file, "utf8"));
      const items = getItems(json);
      loaded.push({ file: path.relative(repoRoot, file), items: items.length });
      for (const item of items) {
        if (!item || String(item.type ?? item.system?.type ?? "") !== "sort") continue;
        index.set(effectKey(item), item);
      }
    } catch (err) {
      console.warn(`[ADD2E][SPELL_MATERIALS_V3] Fichier ${classSlug} illisible : ${file}`, err?.message ?? err);
    }
  }
  return { index, loaded };
}

const MATERIAL_CANON = new Map(Object.entries({
  cire: "cire", cire_d_abeille: "cire d’abeille", peu_de_cire: "cire", morceau_de_cire: "cire",
  laine: "laine", morceau_de_laine: "morceau de laine", petit_morceau_de_laine: "morceau de laine",
  rayon_de_miel: "rayon de miel", petit_morceau_de_rayon_de_miel: "rayon de miel", morceau_de_rayon_de_miel: "rayon de miel",
  miel: "miel", un_peu_de_miel: "miel", huile_douce: "huile douce", goutte_d_huile: "goutte d’huile", goutte_d_huile_douce: "huile douce",
  eau_benite: "Eau bénite", eau_maudite: "Eau maudite", encens_allume: "encens allumé", encens_allumé: "encens allumé", sang: "sang", vapeurs_de_fumier: "vapeurs de fumier",
  petit_morceau_de_silex: "silex", langue_de_serpent: "langue de serpent",
  boucle_de_cuir: "boucle de cuir", morceau_de_fil_d_or_courbe_en_forme_d_hamecon: "morceau de fil d’or courbé en forme d’hameçon",
  fourchette_d_argent: "fourchette d’argent", baguette_fourchue: "baguette fourchue", morceau_d_os_de_mort_vivant: "morceau d’os de mort-vivant",
  plume_d_aile_d_oiseau: "plume d’aile d’oiseau", encre_fine_faite_de_substances_rares: "encre fine faite de substances rares",
  peu_de_fourrure: "peu de fourrure", morceau_de_fourrure: "morceau de fourrure", fourrure: "morceau de fourrure",
  baguette_de_verre: "baguette de verre", baguette_de_cristal: "baguette de cristal", baguette_d_ambre: "baguette d’ambre",
  tige_de_verre: "tige de verre", tige_de_cristal: "tige de cristal", ambre: "ambre",
  luciole_vivante: "luciole vivante", ver_luisant_vivant: "ver luisant vivant", vert_luisant_vivant: "ver luisant vivant",
  quatre_queues_de_lucioles_ou_de_vers_luisants_morts: "4 queues de lucioles ou de vers luisants morts",
  petit_sac: "petit sac", petite_bougie: "petite bougie", soufre: "soufre", souffre: "soufre", salpetre: "salpêtre",
  petit_cone_de_verre: "petit cône de verre", petit_cone_de_cristal: "petit cône de cristal", argile_grasse: "argile grasse",
  receptacle: "réceptacle", petite_fiole_d_eau: "petite fiole d’eau", petite_fiole_de_poussiere: "petite fiole de poussière",
  melange_de_terre: "mélange de terre", lame_en_fer: "lame en fer", marteau_de_guerre_normal: "marteau de guerre normal", marteau_de_guerre: "marteau de guerre",
  petite_replique_du_magicien: "petite réplique du magicien",
  petit_tambour: "petit tambour", goutte_de_sang: "goutte de sang", deux_feuilles_de_verre: "deux feuilles de verre", deux_feuilles_de_cristal: "deux feuilles de cristal",
  fine_feuille_de_cristal_de_6_cm: "fine feuille de cristal de 6 cm²", saphir_blanc: "saphir blanc", diamant: "diamant",
  poudre_de_fer: "poudre de fer", pincee_de_poudre_de_fer: "poudre de fer", poudre_d_argent: "poudre d’argent", poudre_argent: "poudre d’argent",
  poudre_de_diamant: "poudre de diamant", petite_corne_d_argent: "petite corne d’argent", corne_d_argent: "petite corne d’argent",
  fil_de_cuivre: "fil de cuivre", petit_fil_de_cuivre: "fil de cuivre", parchemin_mis_en_cone: "parchemin mis en cône", petit_parchemin_mis_en_cone: "parchemin mis en cône",
  cocon_de_chenille: "cocon de chenille", encre_a_base_de_plomb: "encre à base de plomb", encre_fabriquee_a_base_de_plomb: "encre à base de plomb",
  petit_disque_de_bronze: "petit disque de bronze", disque_de_bronze: "petit disque de bronze", petite_tige_de_fer: "petite tige de fer", tige_de_fer: "petite tige de fer",
  morceau_de_matiere_vegetale_similaire: "morceau de matière végétale similaire", morceau_de_matiere_minerale_similaire: "morceau de matière minérale similaire",
  objet_de_valeur_a_sacrifier: "objet de valeur à sacrifier", sacrifice_de_quelque_chose_ayant_de_la_valeur: "objet de valeur à sacrifier",
  encens_a_faire_bruler: "encens à faire brûler", encens_a_faire_brûler: "encens à faire brûler", encens: "encens",
  eau: "eau", sable: "sable", soufre_et_phosphore: "soufre et phosphore", phosphore: "phosphore", argile: "argile",
  guano_de_chauve_souris: "guano de chauve-souris", guano_de_chauve_souris_en_boule: "guano de chauve-souris", fiente_de_chauve_souris: "guano de chauve-souris",
  toile_d_araignee: "toile d’araignée", morceau_de_toile_d_araignee: "toile d’araignée", toile_d_araignee_bitumee: "toile d’araignée bitumée",
  poudre_de_mica: "poudre de mica", mica_en_poudre: "poudre de mica", oeuf_pourri: "œuf pourri", œuf_pourri: "œuf pourri",
  feuilles_de_chou_puant: "feuilles de chou puant", feuille_de_chou_puant: "feuilles de chou puant",
  perle_de_verre: "perle de verre", perle_de_cristal: "perle de cristal", petite_perle_de_cristal: "petite perle de cristal",
  gomme_arabique: "gomme arabique", cils: "cils", cil: "cils", morceau_de_gomme_arabique: "gomme arabique",
  coeur_de_poule: "cœur de poule", cœur_de_poule: "cœur de poule", plume_blanche: "plume blanche",
  gemme_d_emprisonnement: "gemme d’emprisonnement", saphir: "saphir", coffre_de_grande_valeur: "coffre de grande valeur",
  replique_miniature_du_coffre: "réplique miniature du coffre", miniature_du_coffre: "réplique miniature du coffre",
  fer_pyriteux: "fer pyriteux", morceau_de_fer_pyriteux: "morceau de fer pyriteux", velin_enlumine: "vélin enluminé", velin_specialement_enlumine: "vélin enluminé",
  objet_magnetique: "objet magnétique", objets_magnetiques: "objets magnétiques", deux_objets_magnetiques: "deux objets magnétiques",
  copeau_de_metal: "copeau de métal", copeaux_de_metal: "copeaux de métal", deux_copeaux_de_metal: "deux copeaux de métal",
  patte_arriere_de_sauterelle: "patte arrière de sauterelle"
}));

const MATERIAL_CONSUMPTION_OVERRIDES = new Map(Object.entries({
  encre_fine_faite_de_substances_rares: true,
  eau_benite: true,
  eau_maudite: true,
  encens_allume: true,
  sang: true,
  vapeurs_de_fumier: true,
  peu_de_fourrure: false,
  baguette_de_verre: false,
  baguette_de_cristal: false,
  baguette_d_ambre: false,
  phosphore: true,
  luciole_vivante: true,
  ver_luisant_vivant: true,
  quatre_queues_de_lucioles_ou_de_vers_luisants_morts: true,
  petit_sac: false,
  petite_bougie: false,
  soufre: true,
  salpetre: true,
  petit_cone_de_verre: false,
  petit_cone_de_cristal: false,
  argile_grasse: true,
  receptacle: false,
  petite_fiole_d_eau: true,
  petite_fiole_de_poussiere: true,
  melange_de_terre: true,
  lame_en_fer: false,
  marteau_de_guerre_normal: true,
  petite_replique_du_magicien: false,
  petit_tambour: false,
  goutte_de_sang: true,
  deux_feuilles_de_verre: false,
  deux_feuilles_de_cristal: false
}));

const ELEMENTAL_VARIANTS = [
  { type: "variante", id: "air", label: "Invocation d’un élémental de l’air", composants: ["encens à faire brûler"] },
  { type: "variante", id: "eau", label: "Invocation d’un élémental de l’eau", composants: ["eau", "sable"] },
  { type: "variante", id: "feu", label: "Invocation d’un élémental du feu", composants: ["soufre", "phosphore"] },
  { type: "variante", id: "terre", label: "Invocation d’un élémental de terre", composants: ["argile"] }
];

const CLERIC_MATERIAL_OVERRIDES = new Map(Object.entries({
  benediction: [
    { type: "variante", id: "benediction", label: "Bénédiction", composants: ["Eau bénite"] },
    { type: "variante", id: "malediction", label: "Malédiction (inverse)", composants: ["Eau maudite"] }
  ],
  protection_contre_le_mal: [
    { type: "variante", id: "contre_le_mal_eau_benite", label: "Protection contre le mal — eau bénite", composants: ["Eau bénite"] },
    { type: "variante", id: "contre_le_mal_encens", label: "Protection contre le mal — encens allumé", composants: ["encens allumé"] },
    { type: "variante", id: "contre_le_bien_sang", label: "Protection contre le bien — sang", composants: ["sang"] },
    { type: "variante", id: "contre_le_bien_fumier", label: "Protection contre le bien — vapeurs de fumier", composants: ["vapeurs de fumier"] }
  ],
  resistance_au_froid: ["soufre"],
  resistance_au_feu_resistance_au_froid: ["soufre"],
  marteau_spirituel: ["marteau de guerre normal"]
}));

const WIZARD_NO_MATERIAL_COMPONENTS = new Set(["intermittence", "mot_de_pouvoir_cecite", "mot_de_pouvoir_etourdissement", "mot_de_pouvoir_mort"]);
const WIZARD_COMPONENT_DELEGATIONS = new Map(Object.entries({
  enchantement: "Composants variables selon l’objet enchanté et la procédure d’enchantement.",
  permanence: "Composants variables selon le sort ou l’effet rendu permanent."
}));
const WIZARD_MATERIAL_OVERRIDES = new Map(Object.entries({
  abaissement_des_eaux: ["petite fiole d’eau", "petite fiole de poussière"],
  allometamorphose: ["cocon de chenille"],
  agrandissement: ["poudre de fer"],
  aura_magique_de_nystul: ["soie"],
  arme_enchantee: ["carbone en poudre", "citron en poudre"],
  bouclier_de_feu: [
    { type: "variante", id: "flammes_chaudes", label: "Flammes chaudes", composants: ["phosphore"] },
    { type: "variante", id: "flammes_froides_luciole", label: "Flammes froides — luciole vivante", composants: ["luciole vivante"] },
    { type: "variante", id: "flammes_froides_ver_luisant", label: "Flammes froides — ver luisant vivant", composants: ["ver luisant vivant"] },
    { type: "variante", id: "flammes_froides_queues", label: "Flammes froides — queues de lucioles ou vers luisants morts", composants: ["4 queues de lucioles ou de vers luisants morts"] }
  ],
  boule_de_feu_a_retardement: ["soufre", "guano de chauve-souris"],
  chaumiere_de_leomund: ["petite perle de cristal"],
  clairaudience: ["petite corne d’argent"],
  clairvoyance: ["pincée de poudre de glande pinéale humaine ou humanoïde"],
  coffre_secret_de_leomund: ["coffre de grande valeur", "réplique miniature du coffre"],
  cone_de_froid: [{ type: "alternative", choix: ["petit cône de verre", "petit cône de cristal"] }],
  distorsion_des_distances: ["argile grasse"],
  ecriture: ["encre fine faite de substances rares"],
  effroi: [{ type: "alternative", choix: ["cœur de poule", "plume blanche"] }],
  emprisonnement_de_l_ame: ["gemme d’emprisonnement"],
  fleche_de_feu: ["goutte d’huile", "silex"],
  foudre: ["peu de fourrure", { type: "alternative", choix: ["baguette de verre", "baguette de cristal", "baguette d’ambre"] }],
  glissement_de_terrain: ["mélange de terre", "petit sac", "lame en fer"],
  globe_d_invulnerabilite: [{ type: "alternative", choix: ["perle de verre", "perle de cristal"] }],
  holographie: ["petite réplique du magicien"],
  invisibilite_de_masse: ["cils", "gomme arabique"],
  invisibilite_sur_3_m: ["cils", "gomme arabique"],
  invisibilite_sur_3m: ["cils", "gomme arabique"],
  invocation_de_monstre_i: ["petit sac", "petite bougie"],
  invocation_de_monstre_ii: ["petit sac", "petite bougie"],
  invocation_de_monstre_iii: ["petit sac", "petite bougie"],
  invocation_de_monstre_iv: ["petit sac", "petite bougie"],
  invocation_de_monstre_v: ["petit sac", "petite bougie"],
  invocation_de_monstre_vi: ["petit sac", "petite bougie"],
  invocation_de_monstre_vii: ["petit sac", "petite_bougie"],
  invocation_de_monstres_i: ["petit sac", "petite bougie"],
  invocation_de_monstres_ii: ["petit sac", "petite bougie"],
  invocation_de_monstres_iii: ["petit sac", "petite bougie"],
  invocation_de_monstres_iv: ["petit sac", "petite bougie"],
  invocation_de_monstres_v: ["petit sac", "petite bougie"],
  invocation_de_monstres_vi: ["petit sac", "petite bougie"],
  invocation_de_monstres_vii: ["petit sac", "petite bougie"],
  invocation_d_un_elemental: ELEMENTAL_VARIANTS,
  invocation_instantanee_de_drawmij: ["saphir"],
  levitation: [{ type: "alternative", choix: ["boucle de cuir", "morceau de fil d’or courbé en forme d’hameçon"] }],
  lithomorphose: ["argile grasse"],
  localisation_d_objet: [{ type: "alternative", choix: ["fourchette d’argent", "baguette fourchue"] }],
  localisation_d_objets: [{ type: "alternative", choix: ["fourchette d’argent", "baguette fourchue"] }],
  message: ["fil de cuivre"],
  metempsycose: ["réceptacle"],
  necro_animation: ["goutte de sang", "morceau de chair humaine", "os en poudre"],
  nuage_incendiaire: ["soufre", "phosphore"],
  peur: ["morceau d’os de mort-vivant"],
  piege_a_feu: [{ type: "alternative", choix: ["soufre", "salpêtre"] }],
  piege_de_leomund: ["morceau de fer pyriteux"],
  protection_contre_le_mal_sur_3_m: ["poudre d’argent"],
  punition_spirituelle: ["vélin enluminé"],
  reparation: [{ type: "alternative", choix: ["deux objets magnétiques", "deux copeaux de métal"] }],
  reincarnation: ["petit tambour", "goutte de sang"],
  separation_des_eaux: [{ type: "alternative", choix: ["deux feuilles de verre", "deux feuilles de cristal"] }],
  sphere_glaciale_d_otiluke: [
    { type: "variante", id: "premiere_application", label: "Première application", composants: ["fine feuille de cristal de 6 cm²"] },
    { type: "variante", id: "deuxieme_application", label: "Deuxième application", composants: ["saphir blanc"] },
    { type: "variante", id: "troisieme_application", label: "Troisième application", composants: ["diamant"] }
  ],
  suggestion: ["langue de serpent", { type: "alternative", choix: ["miel", "huile douce"] }],
  ventriloquie: ["parchemin mis en cône"],
  vol: ["plume d’aile d’oiseau"]
}));

const ILLUSIONIST_COMPONENT_DELEGATIONS = new Set(["sorts_de_niveau_1_de_magicien"]);
const ILLUSIONIST_MATERIAL_OVERRIDES = new Map(Object.entries({
  creation_mineure: ["morceau de matière végétale similaire"],
  creation_majeure: [
    { type: "variante", id: "mineral", label: "Création d’un objet minéral", composants: ["morceau de matière minérale similaire"] },
    { type: "variante", id: "vegetal", label: "Création d’un objet végétal", composants: ["morceau de matière végétale similaire"] }
  ],
  ecriture_illusoire: ["encre à base de plomb"],
  force_fantasmagorique_amelioree: ["morceau de laine"],
  force_spectrale: ["morceau de laine"],
  illusion_permanente: ["morceau de laine"],
  illusion_programmee: ["morceau de laine"],
  suggestion_de_masse: ["langue de serpent", { type: "alternative", choix: ["miel", "huile douce"] }],
  vision: ["objet de valeur à sacrifier"]
}));

const NOISE = new Set(["", "true", "false", "oui", "non", "consomme", "consommé", "non consomme", "non consommé", "non_consomme", "optionnel", "manuel", "manuel du joueur", "manuel des joueurs", "source", "aucun", "null", "undefined", "liquide", "consommation", "ingredient materiel", "ingrédient matériel", "composant materiel", "composant matériel", "composant requis", "clerc", "druide", "magicien", "illusionniste", "créature", "petite créature", "le", "la", "les", "consommation explicitement indiquée dans la description", "consommation explicitement indiquee dans la description"].map(norm));
const NOISE_STARTS = ["requise", "requis", "alternative", "formulation source", "source du manuel", "sort normal", "sort inverse", "selon la règle", "description indique", "pour lancer", "ingrédient matériel", "ingredient materiel", "composant matériel", "composant materiel", "composant requis", "non consommé", "non consomme", "consommation explicitement"].map(norm);
const NOISE_CONTAINS = ["manuel des joueurs", "formulation source", "règle d arbitrage", "description indique", "pour lancer le sort", "composant requis selon", "consommation explicitement indiquée", "que le magicien doit", "que l illusionniste doit", "utilisé pour", "utilisee pour", "utilisée pour", "poudre en forme de cone", "application consomme apres le lancement", "application consommee apres le lancement"].map(norm);
const DIRTY_MARKERS = ["par exemple", "que le magicien doit", "que l'illusionniste doit", "que l’illusionniste doit", "une pour chaque", "n’importe quel type", "n'importe quel type", "consommé", "consommée", "utilisé pour", "utilisée pour"];

function canonicalMaterial(value) { return MATERIAL_CANON.get(slug(value)) ?? text(value); }
function stripMaterialSourcePhrase(value) {
  return text(value)
    .replace(/^(?:comme\s+[^:]+:\s*)/i, "")
    .replace(/^(?:la|les)\s+composantes?\s+mat[eé]rielles?\s+(?:de\s+ce\s+sort\s+)?(?:sont|est|consistent?\s+en|se\s+composent\s+de)\s*/i, "")
    .replace(/^composantes?\s+mat[eé]rielles?\s+(?:de\s+ce\s+sort\s+)?(?:sont|est|consistent?\s+en|se\s+composent\s+de)\s*/i, "")
    .replace(/^(?:la|les)\s+composante\s+mat[eé]rielle\s+(?:de\s+ce\s+sort\s+)?(?:est|sont)\s*/i, "")
    .replace(/^la\s+composante\s+de\s+ce\s+sort\s+est\s+/i, "")
    .replace(/\s+d['’]une\s+valeur\b.*$/i, "")
    .replace(/\s+d['’]un\s+co[uû]t\b.*$/i, "")
    .replace(/\s+co[uû]tant\b.*$/i, "")
    .replace(/\s+valant\b.*$/i, "")
    .replace(/\s+estim[ée]e?\s+à\b.*$/i, "")
    .replace(/,\s*qui\b.*$/i, "")
    .replace(/\s+qui\s+(?:dispara[îi]t|est\s+consomm[ée]e?|sont\s+consomm[ée]s?)\b.*$/i, "")
    .replace(/\s+que\s+(?:le\s+clerc|le\s+magicien|l['’]?illusionniste|l['’]?(?:enchanteur|utilisateur))\s+doit\b.*$/i, "")
    .replace(/\s+utilis(?:e|é|ée|es|és)\s+pour\b.*$/i, "")
    .replace(/\s+servant\s+à\b.*$/i, "")
    .replace(/\s+qui\s+doit\b.*$/i, "")
    .replace(/[.!?;:]+$/g, "").trim();
}
function removeIncises(value) {
  return text(value).replace(/\([^)]*\)/g, " ").replace(/\s+[—–]\s+[^—–]+(?:\s+[—–])?$/g, "")
    .replace(/\s+[—–-]\s+[^—–-]+\s+[—–-]\s+/g, " ")
    .replace(/,\s*par\s+exemple\s+[^,.;]+(?=,|\.|;|$)/gi, "")
    .replace(/\s+par\s+exemple\s+[^,.;]+(?=,|\.|;|$)/gi, "")
    .replace(/\s+de\s+n[’']?importe\s+quel\s+type\b/gi, "")
    .replace(/\s+quel\s+qu['’]?en\s+soit\s+le\s+type\b/gi, "")
    .replace(/\s+que\s+(?:le\s+clerc|le\s+magicien|l[’']?illusionniste)\s+doit\b.*$/i, "")
    .replace(/\s+quand\s+le\s+sort\s+est\s+lanc[ée]\b.*$/i, "")
    .replace(/\s+au\s+moment\s+du\s+lancement\b.*$/i, "")
    .replace(/\s+/g, " ").replace(/\s+,/g, ",").replace(/,\s*,/g, ",").replace(/^,\s*|,\s*$/g, "").trim();
}
function cleanMaterial(value) {
  let out = removeIncises(stripMaterialSourcePhrase(value)).replaceAll("_", "-").replace(/-/g, " ")
    .replace(/^d['’]\s*/i, "").replace(/^(un|une)?\s*peu\s+de\s+/i, "")
    .replace(/^(un|une|du|de la|de l['’]?|des|le|la|les)\s+/i, "")
    .replace(/^(quelques|plusieurs)\s+/i, "").replace(/\s+/g, " ").trim();
  return canonicalMaterial(out);
}
function rejectMaterial(value) {
  if (typeof value !== "string") return false;
  const cleaned = cleanMaterial(value);
  const n = norm(cleaned);
  if (MATERIAL_CANON.has(slug(cleaned))) return false;
  if (!n || NOISE.has(n)) return true;
  if (/^\d+(?:[,.]\d+)?\s*(m2|m|m²|case|cases|po|pa|pp|pc)?$/i.test(cleaned)) return true;
  if (NOISE_STARTS.some(v => n.startsWith(v))) return true;
  if (NOISE_CONTAINS.some(v => n.includes(v))) return true;
  if (n.split(" ").length > 8) return true;
  return false;
}
function componentNamesFromEntry(entry) {
  if (typeof entry === "string") return [entry];
  if (!entry || typeof entry !== "object") return [];
  if (entry.type === "alternative") return Array.isArray(entry.choix) ? entry.choix.flatMap(componentNamesFromEntry) : [];
  if (entry.type === "variante") return Array.isArray(entry.composants) ? entry.composants.flatMap(componentNamesFromEntry) : [];
  const direct = entry.nom ?? entry.name ?? entry.label ?? entry.item ?? entry.itemName ?? entry.component ?? entry.composant ?? entry.slug ?? entry.id;
  return direct ? [String(direct)] : [];
}
function isComplexMaterialText(value) {
  const raw = text(value);
  const n = norm(raw);
  return !!raw && (/\b(?:ou|soit)\b/i.test(raw) || /[—–]/.test(raw) || raw.includes(",") || DIRTY_MARKERS.some(marker => n.includes(norm(marker))) || n.split(" ").length > 8);
}
function sanitizeEntry(entry, options = {}) {
  const fromParser = options.fromParser === true;
  if (typeof entry === "string") {
    if (!fromParser && isComplexMaterialText(entry)) return parseSourceMaterials(entry);
    const cleaned = cleanMaterial(entry);
    return rejectMaterial(cleaned) ? null : cleaned;
  }
  if (!entry || typeof entry !== "object") return null;
  if (entry.type === "alternative" || Array.isArray(entry.choix)) {
    const choix = uniqueFlat((entry.choix ?? entry.alternatives ?? entry.options ?? []).flatMap(value => {
      const cleaned = sanitizeEntry(value, options);
      if (!cleaned) return [];
      if (Array.isArray(cleaned)) return cleaned.flatMap(componentNamesFromEntry);
      if (cleaned?.type === "alternative") return cleaned.choix ?? [];
      return componentNamesFromEntry(cleaned);
    }).map(cleanMaterial).filter(v => !rejectMaterial(v)));
    if (!choix.length) return null;
    return choix.length === 1 ? choix[0] : { type: "alternative", choix };
  }
  if (entry.type === "variante") {
    const composants = uniqueFlat((entry.composants ?? []).flatMap(value => {
      const cleaned = sanitizeEntry(value, options);
      if (!cleaned) return [];
      if (Array.isArray(cleaned)) return cleaned.flatMap(componentNamesFromEntry);
      return componentNamesFromEntry(cleaned);
    }).map(cleanMaterial).filter(v => !rejectMaterial(v)));
    if (!composants.length) return null;
    return { type: "variante", id: slug(entry.id ?? entry.label ?? entry.nom ?? entry.name ?? composants.join("_")), label: text(entry.label ?? entry.nom ?? entry.name ?? entry.id ?? "Variante"), composants };
  }
  const names = componentNamesFromEntry(entry);
  if (!names.length) return null;
  if (!fromParser && names.length === 1 && isComplexMaterialText(names[0])) return parseSourceMaterials(names[0]);
  const cleaned = names.map(cleanMaterial).filter(v => !rejectMaterial(v));
  return cleaned.length === 1 ? cleaned[0] : cleaned;
}
function uniqueFlat(list) {
  const seen = new Set();
  const out = [];
  for (const value of list.flat(Infinity)) {
    if (value === undefined || value === null) continue;
    const key = slug(value);
    if (!key || seen.has(key)) continue;
    seen.add(key); out.push(value);
  }
  return out;
}
function uniqueEntries(entries, options = {}) {
  const seen = new Set();
  const out = [];
  for (const entry of entries.flat(Infinity)) {
    const sanitizedRaw = sanitizeEntry(entry, options);
    for (const sanitized of (Array.isArray(sanitizedRaw) ? sanitizedRaw : [sanitizedRaw])) {
      if (!sanitized) continue;
      const key = typeof sanitized === "string" ? `s:${slug(sanitized)}` : `${sanitized.type}:${slug(sanitized.id ?? sanitized.label ?? "")}:${componentNamesFromEntry(sanitized).map(slug).join("|")}`;
      if (seen.has(key)) continue;
      seen.add(key); out.push(sanitized);
    }
  }
  return out;
}
function parseElementalVariants(source) {
  const n = norm(source);
  if ((!n.includes("elemental") && !n.includes("elementaire")) || !n.includes("air") || !n.includes("eau") || !n.includes("feu") || !n.includes("terre")) return [];
  return clone(ELEMENTAL_VARIANTS);
}
function extractMaterialClause(source) {
  let cleaned = stripMaterialSourcePhrase(source);
  const match = cleaned.match(/(?:la|les)\s+composantes?\s+mat[eé]rielles?\s+(?:de\s+ce\s+sort\s+)?(?:sont|est|consistent?\s+en|se\s+composent\s+de)\s+(.+?)(?:\s+(?:l['’]?inverse|le\s+sort|ce\s+sort|quand\s+le\s+sort)\b|[.?!]$|$)/i)
    ?? cleaned.match(/la\s+composante\s+de\s+ce\s+sort\s+est\s+(.+?)(?:\s+(?:l['’]?inverse|le\s+sort|ce\s+sort|quand\s+le\s+sort)\b|[.?!]$|$)/i);
  if (match?.[1]) cleaned = match[1];
  return removeIncises(cleaned);
}
function parseSharedHeadEnumeration(source) {
  const cleaned = extractMaterialClause(source);
  if (!cleaned || !cleaned.includes(",")) return [];
  const parts = cleaned.replace(/\s+ou\s+/gi, ", ").split(/,/g).map(text).filter(Boolean);
  if (parts.length < 3) return [];
  const match = parts[0].match(/^(.+)\s+(d['’][^,]+|de\s+[^,]+|du\s+[^,]+|des\s+[^,]+)$/i);
  if (!match) return [];
  const base = text(match[1]);
  const suffixes = [text(match[2]), ...parts.slice(1).map(v => v.replace(/^ou\s+/i, "").trim())];
  const looksShared = suffixes.slice(1).some(v => /^(d['’]|de\s+|du\s+|des\s+)/i.test(v)) || /\b(sph[eè]res?|perles?|gemmes?|pierres?|boules?|billes?|cristaux?|morceaux?|objets?|copeaux?|sels?|poudres?)\b/i.test(base);
  if (!looksShared) return [];
  const choices = uniqueFlat(suffixes.map(suffix => `${base} ${text(suffix)}`).map(cleanMaterial).filter(v => !rejectMaterial(v)));
  return choices.length > 1 ? [{ type: "alternative", choix: choices }] : [];
}
function parseAlternativeClause(source) {
  const cleaned = extractMaterialClause(source);
  if (!cleaned) return [];
  let choices = [];
  if (/\bsoit\b/i.test(cleaned)) choices = cleaned.replace(/^.*?\bsoit\b\s*/i, "").split(/\s*,?\s*soit\s+|\s+ou\s+/i);
  else if (/\s+ou\s+/i.test(cleaned)) choices = cleaned.split(/\s+ou\s+/i);
  choices = uniqueFlat(choices.map(cleanMaterial).filter(v => !rejectMaterial(v)));
  return choices.length > 1 ? [{ type: "alternative", choix: choices }] : [];
}
function parseSourceMaterials(source) {
  const variants = parseElementalVariants(source); if (variants.length) return variants;
  const sharedHead = parseSharedHeadEnumeration(source); if (sharedHead.length) return sharedHead;
  const alternative = parseAlternativeClause(source); if (alternative.length) return alternative;
  const cleaned = extractMaterialClause(source); if (!cleaned) return [];
  const entries = [];
  const chunks = cleaned.split(/[,;\n]+|\s+ainsi\s+que\s+/gi).map(text).filter(Boolean);
  for (const chunk of chunks) {
    if (/\s+soit\s+/i.test(chunk) || /\s+ou\s+/i.test(chunk)) {
      const alt = parseAlternativeClause(chunk);
      if (alt.length) { entries.push(...alt); continue; }
    }
    for (const part of chunk.split(/\s+et\s+/i).map(cleanMaterial).filter(v => !rejectMaterial(v))) entries.push(part);
  }
  return uniqueEntries(entries, { fromParser: true });
}
function materialEntriesFromValue(value) {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return uniqueEntries(value.flatMap(v => materialEntriesFromValue(v)));
  if (typeof value === "object") return uniqueEntries([value]);
  return parseSourceMaterials(value);
}
function materialEntryCount(entries) { return (entries ?? []).reduce((sum, entry) => sum + componentNamesFromEntry(entry).length, 0); }
function materialComponentObject(value, source = {}) {
  const rawName = typeof value === "object" ? value?.nom ?? value?.name ?? value?.label ?? value?.item ?? value?.itemName ?? value?.component ?? value?.composant ?? value?.slug ?? value?.id : value;
  const nom = cleanMaterial(rawName);
  if (rejectMaterial(nom)) return null;
  const quantite = Math.max(1, Number(source.quantite ?? source.quantity ?? source.qty ?? source.nombre ?? source.count ?? 1) || 1);
  const key = slug(nom);
  const consomme = MATERIAL_CONSUMPTION_OVERRIDES.has(key) ? MATERIAL_CONSUMPTION_OVERRIDES.get(key) : source.consomme !== false && source.consume !== false;
  return { slug: key, nom, quantite, consomme };
}
function uniqueComponentObjects(values) {
  const seen = new Set();
  const out = [];
  for (const value of values.flat(Infinity)) {
    const entry = typeof value === "object" && value?.slug && value?.nom ? value : materialComponentObject(value);
    if (!entry) continue;
    const key = slug(entry.slug ?? entry.nom);
    if (!key || seen.has(key)) continue;
    seen.add(key); out.push(entry);
  }
  return out;
}
function normalizeMaterialStructure(entries) {
  const out = [];
  for (const entry of entries ?? []) {
    if (!entry) continue;
    if (entry.type === "alternative" || Array.isArray(entry.choix)) {
      const choix = uniqueComponentObjects(entry.choix ?? entry.alternatives ?? entry.options ?? []);
      if (choix.length > 1) out.push({ type: "alternative", choix }); else if (choix.length === 1) out.push(choix[0]);
      continue;
    }
    if (entry.type === "variante") {
      const composants = uniqueComponentObjects(entry.composants ?? []);
      if (!composants.length) continue;
      out.push({ type: "variante", id: slug(entry.id ?? entry.label ?? entry.nom ?? entry.name ?? composants.map(c => c.nom).join("_")), label: text(entry.label ?? entry.nom ?? entry.name ?? entry.id ?? "Variante"), composants });
      continue;
    }
    const component = materialComponentObject(entry, entry);
    if (component) out.push(component);
  }
  const seen = new Set();
  return out.filter(entry => {
    const key = entry.type ? `${entry.type}:${slug(entry.id ?? entry.label ?? "")}:${componentNamesFromEntry(entry).map(slug).join("|")}` : `component:${slug(entry.slug ?? entry.nom)}`;
    if (!key || seen.has(key)) return false;
    seen.add(key); return true;
  });
}
function materialQualityWarnings(entries) {
  const warnings = [];
  for (const entry of entries ?? []) for (const name of componentNamesFromEntry(entry)) {
    const n = norm(name);
    if (MATERIAL_CANON.has(slug(cleanMaterial(name)))) continue;
    if (rejectMaterial(name) || DIRTY_MARKERS.some(marker => n.includes(norm(marker))) || n.split(" ").length > 8) warnings.push(name);
  }
  return warnings;
}
function ensureComposantesHasM(system, entries) {
  if (!materialEntryCount(entries)) return;
  const raw = text(system.composantes);
  if (/(^|[,;\s])M([,;\s]|$)/i.test(raw)) return;
  system.composantes = raw ? `${raw}, M` : "M";
}
function removeMaterialComponent(system, note) {
  system.composants_materiels = [];
  system.composantes = text(system.composantes).split(/[,;]+|\s+/g).map(v => v.trim()).filter(v => v && v.toUpperCase() !== "M").join(", ");
  if (!system.composantes) system.composantes = "V";
  system.composants_materiels_a_renseigner = false;
  if (note) system.composants_materiels_note = text([system.composants_materiels_note, note].filter(Boolean).join("\n"));
}
function markDelegatedComponents(system, note) {
  system.composants_materiels = [];
  system.composantes = "*";
  system.composants_materiels_a_renseigner = false;
  if (note) system.composants_materiels_note = text([system.composants_materiels_note, note].filter(Boolean).join("\n"));
}
function mergeClassAuditSource(item, auditIndex, classSlug) {
  if (slug(item?.system?.classe) !== classSlug) return null;
  const source = auditIndex.get(effectKey(item));
  if (!source?.system) return null;
  const sys = item.system ?? {};
  const src = source.system ?? {};
  for (const field of ["composants_materiels_source", "composants_materiels_reference", "composants_materiels_verification_recommandee", "composants_materiels_a_renseigner"]) {
    if (src[field] !== undefined && src[field] !== null && src[field] !== "") sys[field] = clone(src[field]);
  }
  if (Array.isArray(src.composants_materiels) && src.composants_materiels.length) sys.composants_materiels = clone(src.composants_materiels);
  return source;
}
function resolveMaterialEntries(system) {
  let entries = materialEntriesFromValue(system.composants_materiels);
  if (materialQualityWarnings(entries).length && system.composants_materiels_source) {
    const fromSource = materialEntriesFromValue(system.composants_materiels_source);
    if (materialEntryCount(fromSource)) entries = fromSource;
  }
  if (!materialEntryCount(entries)) entries = materialEntriesFromValue(system.composants_materiels_objets);
  if (!materialEntryCount(entries)) entries = materialEntriesFromValue(system.composants_requis);
  if (!materialEntryCount(entries)) entries = materialEntriesFromValue(system.composants_materiels_source);
  return uniqueEntries(entries);
}
function normalizeMaterials(item, indexes) {
  const { clercAuditIndex, magicienAuditIndex, illusionnisteAuditIndex } = indexes;
  const system = item.system ?? {};
  const before = clone(system.composants_materiels ?? []);
  const key = slug(item?.name ?? system?.nom);

  if (isClercSpell(item)) {
    mergeClassAuditSource(item, clercAuditIndex, "clerc");
    if (CLERIC_MATERIAL_OVERRIDES.has(key)) system.composants_materiels = uniqueEntries(CLERIC_MATERIAL_OVERRIDES.get(key));
    else system.composants_materiels = resolveMaterialEntries(system);
    ensureComposantesHasM(system, system.composants_materiels);
  } else if (isIllusionnisteSpell(item)) {
    mergeClassAuditSource(item, illusionnisteAuditIndex, "illusionniste");
    if (ILLUSIONIST_COMPONENT_DELEGATIONS.has(key)) markDelegatedComponents(system, "Composants déterminés par le sort de magicien niveau 1 choisi.");
    else if (ILLUSIONIST_MATERIAL_OVERRIDES.has(key)) { system.composants_materiels = uniqueEntries(ILLUSIONIST_MATERIAL_OVERRIDES.get(key)); ensureComposantesHasM(system, system.composants_materiels); }
    else { system.composants_materiels = resolveMaterialEntries(system); ensureComposantesHasM(system, system.composants_materiels); }
  } else if (isMagicienSpell(item)) {
    mergeClassAuditSource(item, magicienAuditIndex, "magicien");
    if (WIZARD_NO_MATERIAL_COMPONENTS.has(key)) removeMaterialComponent(system, "Composante matérielle retirée : le sort ne consomme pas de composant matériel fixe.");
    else if (WIZARD_COMPONENT_DELEGATIONS.has(key)) markDelegatedComponents(system, WIZARD_COMPONENT_DELEGATIONS.get(key));
    else if (WIZARD_MATERIAL_OVERRIDES.has(key)) { system.composants_materiels = uniqueEntries(WIZARD_MATERIAL_OVERRIDES.get(key)); ensureComposantesHasM(system, system.composants_materiels); }
    else { system.composants_materiels = resolveMaterialEntries(system); ensureComposantesHasM(system, system.composants_materiels); }
  } else {
    system.composants_materiels = resolveMaterialEntries(system);
  }
  system.composants_materiels = normalizeMaterialStructure(system.composants_materiels);
  return { before, after: clone(system.composants_materiels), changed: JSON.stringify(before) !== JSON.stringify(system.composants_materiels) };
}
function kindAndTags(name, classSlug) {
  const key = slug(name);
  const tags = [`effet:${key}`, `classe:${classSlug}`];
  let kind = `${classSlug}_effect`; let automation = "active_effect_or_mj_aid";
  if (/(soin|guerison|guérison|regeneration|régénération|restauration|rappel|resurrection|résurrection|reincarnation|réincarnation)/.test(key)) { kind = "healing_or_restoration"; tags.push("soin_ou_restauration"); }
  else if (/(detection|détection|localisation|prevision|prévision|communion|orientation|lithomancie|divination|augure|clairaudience|clairvoyance|lecture|identification|analyse|oracle|vision)/.test(key)) { kind = "detection_or_divination"; automation = "mj_aid"; tags.push("detection_ou_divination"); }
  else if (/(langage|amitie|amitié|charme|perception|suggestion|domination|empathie|hypnotisme)/.test(key)) { kind = "communication_or_control"; automation = "mj_aid"; tags.push("communication_ou_controle"); }
  else if (/(protection|bouclier|invisibilite|invisibilité|resistance|résistance|armure|globe|immunite|immunité|reflet|reflection|réflexion|image_miroir)/.test(key)) { kind = "protection"; tags.push("protection"); }
  else if (/(paralysie|confusion|debilite|débilité|piege|piège|repulsion|répulsion|sommeil|lenteur|immobilisation|labyrinthe|emprisonnement|entrave|terreur|peur|effroi|cecite|cécité|surdite|surdité)/.test(key)) { kind = "control"; tags.push("controle"); }
  else if (/(feu|foudre|tempete|tempête|projectile|missile|eclair|éclair|boule|nuage|cone|cône|brulante|brûlante|explosion|desintegration|désintégration)/.test(key)) { kind = "damage_or_area_control"; automation = "damage_or_mj_aid"; tags.push("degats_ou_zone"); }
  else if (/(invocation|serviteur|animal|animaux|insectes|animation|monstre|elemental|élémental|familier|ombre|ombres)/.test(key)) { kind = "summon_or_actor_effect"; automation = "actor_creation_or_mj_aid"; tags.push("invocation_ou_creation"); }
  else if (/(illusion|fantasme|holographie|apparence|mur|tenebres|ténèbres|lumiere|lumière|bruitage|ventriloquie)/.test(key)) { kind = "illusion_or_sensory"; automation = "mj_aid"; tags.push("illusion_ou_sensoriel"); }
  return { kind, tags, automation };
}
function buildEffectProfile(item, classSlug, level) {
  const label = text(item?.name ?? item?.system?.nom ?? `Sort ${classSlug}`);
  const key = slug(label) || `sort_${classSlug}_n${level}`;
  const { kind, tags, automation } = kindAndTags(label, classSlug);
  return { version: EFFECT_PROFILE_VERSION, source: `manual-normalized-${classSlug}-n${level}`, effects: [{ id: key, label, kind, automation, tags: [...tags, `niveau:${level}`], notes: `Profil mécanique ${classSlug} normalisé ; l’effet détaillé reste porté par la description, les tags existants et le script onUse du sort.` }] };
}
function applyEffectProfileOverride(item) {
  const system = item.system ?? {};
  const level = spellLevel(system);
  let classSlug = "";
  if (CLERIC_LEVELS.includes(level) && isClercSpellLevel(item, level)) classSlug = "clerc";
  else if (DRUID_LEVELS.includes(level) && isDruideSpellLevel(item, level)) classSlug = "druide";
  else if (WIZARD_LEVELS.includes(level) && isMagicienSpellLevel(item, level)) classSlug = "magicien";
  else if (ILLUSIONIST_LEVELS.includes(level) && isIllusionnisteSpellLevel(item, level)) classSlug = "illusionniste";
  if (!classSlug) return { applied: false, changed: false, level, classSlug: "" };
  const next = buildEffectProfile(item, classSlug, level);
  const before = JSON.stringify(system.effectProfile ?? {});
  system.effectProfile = next;
  return { applied: true, changed: before !== JSON.stringify(next), level, classSlug };
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
function materialWarningForClass(item, classSlug) {
  const key = slug(item?.name ?? item?.system?.nom);
  if (classSlug === "illusionniste" && ILLUSIONIST_COMPONENT_DELEGATIONS.has(key)) return null;
  if (classSlug === "magicien" && (WIZARD_NO_MATERIAL_COMPONENTS.has(key) || WIZARD_COMPONENT_DELEGATIONS.has(key))) return null;
  const entries = item?.system?.composants_materiels ?? [];
  const hasM = String(item?.system?.composantes ?? "").toUpperCase().includes("M");
  const bad = materialQualityWarnings(entries);
  if (hasM && !materialEntryCount(entries)) bad.push("M sans composant");
  return bad.length ? { name: item.name, niveau: item.system?.niveau, components: bad, allComponents: clone(entries), classe: classSlug } : null;
}
function makeBucket() { return { applied: [], missing: [] }; }

function main() {
  const input = path.resolve(repoRoot, process.argv[2] || DEFAULT_INPUT);
  const output = path.resolve(repoRoot, process.argv[3] || DEFAULT_OUTPUT);
  const controlOutput = path.resolve(repoRoot, process.argv[4] || DEFAULT_CONTROL);
  if (!fs.existsSync(input)) throw new Error(`Fichier introuvable : ${input}`);

  const json = JSON.parse(fs.readFileSync(input, "utf8"));
  const items = getItems(json);
  const existingIndex = buildExistingItemIndex(output);
  const clercAudit = loadClassAuditIndex("clerc", CLERIC_LEVELS);
  const magicienAudit = loadClassAuditIndex("magicien", WIZARD_LEVELS);
  const illusionistAudit = loadClassAuditIndex("illusionniste", ILLUSIONIST_LEVELS);
  const control = {
    version: VERSION,
    input: path.relative(repoRoot, input),
    output: path.relative(repoRoot, output),
    clercAuditFiles: clercAudit.loaded,
    magicienAuditFiles: magicienAudit.loaded,
    illusionistAuditFiles: illusionistAudit.loaded,
    totalItems: items.length,
    spells: 0,
    preservedManualMaterials: 0,
    preservedClasses: [...MATERIAL_PRESERVE_CLASSES],
    changedSpells: 0,
    changedEffectProfiles: 0,
    emptyMaterialSpells: 0,
    examples: [],
    watched: {},
    clercMaterialAudit: [],
    clercMaterialWarnings: [],
    clercSourceMissing: [],
    magicienMaterialAudit: [],
    magicienMaterialWarnings: [],
    magicienSourceMissing: [],
    illusionnisteMaterialAudit: [],
    illusionnisteMaterialWarnings: [],
    illusionnisteSourceMissing: [],
    sameSystemFieldsForAllSpells: true,
    canonicalFields: SYSTEM_KEYS
  };
  for (const level of CLERIC_LEVELS) control[`clercLevel${level}EffectProfiles`] = makeBucket();
  for (const level of DRUID_LEVELS) control[`druideLevel${level}EffectProfiles`] = makeBucket();
  for (const level of WIZARD_LEVELS) control[`magicienLevel${level}EffectProfiles`] = makeBucket();
  for (const level of ILLUSIONIST_LEVELS) control[`illusionnisteLevel${level}EffectProfiles`] = makeBucket();

  const expected = JSON.stringify([...SYSTEM_KEYS].sort());
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    if (!item || String(item.type ?? item.system?.type ?? "") !== "sort") continue;
    item.system ??= {};
    ensureSystem(item.system);
    const cls = slug(item.system.classe);
    const existing = existingIndex.get(preserveKey(item));
    if (MATERIAL_PRESERVE_CLASSES.has(cls) && existing) {
      items[i] = clone(existing);
      control.spells += 1;
      control.preservedManualMaterials += 1;
      continue;
    }

    const hadClercSource = !isClercSpell(item) || clercAudit.index.has(effectKey(item));
    const hadMagicienSource = !isMagicienSpell(item) || magicienAudit.index.has(effectKey(item));
    const hadIllusionistSource = !isIllusionnisteSpell(item) || illusionistAudit.index.has(effectKey(item));
    const materials = normalizeMaterials(item, { clercAuditIndex: clercAudit.index, magicienAuditIndex: magicienAudit.index, illusionnisteAuditIndex: illusionistAudit.index });
    const profile = applyEffectProfileOverride(item);
    control.spells += 1;
    if (materials.changed) {
      control.changedSpells += 1;
      if (control.examples.length < 80) control.examples.push({ name: item.name, classe: item.system.classe, niveau: item.system.niveau, before: materials.before, after: materials.after });
    }
    if (profile.changed) control.changedEffectProfiles += 1;
    if (!materialEntryCount(item.system.composants_materiels ?? [])) control.emptyMaterialSpells += 1;

    for (const l of CLERIC_LEVELS) if (isClercSpellLevel(item, l)) {
      const bucket = control[`clercLevel${l}EffectProfiles`];
      if (profile.applied && profile.level === l && profile.classSlug === "clerc") bucket.applied.push(item.name); else bucket.missing.push(item.name);
      control.clercMaterialAudit.push({ name: item.name, niveau: item.system.niveau, composants: clone(item.system.composants_materiels) });
      const warning = materialWarningForClass(item, "clerc");
      if (warning) control.clercMaterialWarnings.push(warning);
      if (!hadClercSource) control.clercSourceMissing.push({ name: item.name, niveau: item.system.niveau });
    }
    for (const l of DRUID_LEVELS) if (isDruideSpellLevel(item, l)) {
      const bucket = control[`druideLevel${l}EffectProfiles`];
      if (profile.applied && profile.level === l && profile.classSlug === "druide") bucket.applied.push(item.name); else bucket.missing.push(item.name);
    }
    for (const l of WIZARD_LEVELS) if (isMagicienSpellLevel(item, l)) {
      const bucket = control[`magicienLevel${l}EffectProfiles`];
      if (profile.applied && profile.level === l && profile.classSlug === "magicien") bucket.applied.push(item.name); else bucket.missing.push(item.name);
      control.magicienMaterialAudit.push({ name: item.name, niveau: item.system.niveau, composants: clone(item.system.composants_materiels) });
      const warning = materialWarningForClass(item, "magicien");
      if (warning) control.magicienMaterialWarnings.push(warning);
      if (!hadMagicienSource) control.magicienSourceMissing.push({ name: item.name, niveau: item.system.niveau });
    }
    for (const l of ILLUSIONIST_LEVELS) if (isIllusionnisteSpellLevel(item, l)) {
      const bucket = control[`illusionnisteLevel${l}EffectProfiles`];
      if (profile.applied && profile.level === l && profile.classSlug === "illusionniste") bucket.applied.push(item.name); else bucket.missing.push(item.name);
      control.illusionnisteMaterialAudit.push({ name: item.name, niveau: item.system.niveau, composants: clone(item.system.composants_materiels) });
      const warning = materialWarningForClass(item, "illusionniste");
      if (warning) control.illusionnisteMaterialWarnings.push(warning);
      if (!hadIllusionistSource) control.illusionnisteSourceMissing.push({ name: item.name, niveau: item.system.niveau });
    }

    if (profile.applied || isClercSpell(item) || isMagicienSpell(item) || isIllusionnisteSpell(item)) {
      control.watched[item.name] = { classe: item.system.classe, niveau: item.system.niveau, composants_materiels: clone(item.system.composants_materiels), composantes: item.system.composantes, effectProfile: clone(item.system.effectProfile) };
    }
    if (JSON.stringify(Object.keys(item.system).sort()) !== expected) control.sameSystemFieldsForAllSpells = false;
  }

  json.normalizedBy = VERSION;
  json.normalizedAt = new Date().toISOString();
  fs.writeFileSync(output, `${JSON.stringify(json, null, 2)}\n`, "utf8");
  fs.writeFileSync(controlOutput, `${JSON.stringify(control, null, 2)}\n`, "utf8");

  console.log(`[ADD2E][SPELL_MATERIALS_V3] ${control.spells} sort(s), ${control.changedSpells} composant(s) modifié(s).`);
  console.log(`[ADD2E][SPELL_MATERIALS_V3] Manual preserved materials: ${control.preservedManualMaterials}`);
  for (const level of CLERIC_LEVELS) {
    const bucket = control[`clercLevel${level}EffectProfiles`];
    console.log(`[ADD2E][SPELL_MATERIALS_V3] EffectProfiles N${level} clerc: ${bucket.applied.length} appliqué(s), ${bucket.missing.length} manquant(s).`);
  }
  for (const level of WIZARD_LEVELS) {
    const bucket = control[`magicienLevel${level}EffectProfiles`];
    console.log(`[ADD2E][SPELL_MATERIALS_V3] EffectProfiles N${level} magicien: ${bucket.applied.length} appliqué(s), ${bucket.missing.length} manquant(s).`);
  }
  for (const level of ILLUSIONIST_LEVELS) {
    const bucket = control[`illusionnisteLevel${level}EffectProfiles`];
    console.log(`[ADD2E][SPELL_MATERIALS_V3] EffectProfiles N${level} illusionniste: ${bucket.applied.length} appliqué(s), ${bucket.missing.length} manquant(s).`);
  }
  console.log(`[ADD2E][SPELL_MATERIALS_V3] Clerc material warnings: ${control.clercMaterialWarnings.length}`);
  console.log(`[ADD2E][SPELL_MATERIALS_V3] Magicien material warnings: ${control.magicienMaterialWarnings.length}`);
  console.log(`[ADD2E][SPELL_MATERIALS_V3] Illusionist material warnings: ${control.illusionnisteMaterialWarnings.length}`);
  console.log(`[ADD2E][SPELL_MATERIALS_V3] Output: ${path.relative(repoRoot, output)}`);
  console.log(`[ADD2E][SPELL_MATERIALS_V3] Control: ${path.relative(repoRoot, controlOutput)}`);
}

main();
