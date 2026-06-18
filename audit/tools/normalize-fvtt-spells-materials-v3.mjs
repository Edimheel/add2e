import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");

const VERSION = "2026-06-18-normalize-illusionist-components-resolve-warnings-v1";
const DEFAULT_INPUT = "fvtt-spells-all-normalise-mecanique-v1.json";
const DEFAULT_OUTPUT = "fvtt-spells-all-normalise-mecanique-v3.json";
const DEFAULT_CONTROL = "fvtt-spells-all-normalise-mecanique-v3-controle.json";
const EFFECT_PROFILE_VERSION = "2026-06-16-add2e-spell-effects-v1";

const CLERIC_LEVELS = [2, 3, 4, 5, 6, 7];
const DRUID_LEVELS = [1, 2, 3, 4, 5, 6, 7];
const WIZARD_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const ILLUSIONIST_LEVELS = [1, 2, 3, 4, 5, 6, 7];
const MATERIAL_PRESERVE_CLASSES = new Set(["clerc", "druide", "magicien"]);
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

function text(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function norm(value) {
  return text(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slug(value) {
  return norm(value).replace(/\s+/g, "_");
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function getItems(json) {
  if (Array.isArray(json)) return json;
  for (const key of ["items", "Item", "Items", "documents", "data", "entries"]) {
    if (Array.isArray(json?.[key])) return json[key];
  }
  return [];
}

function spellLevel(system = {}) {
  const m = String(system.niveau ?? system.niveau_sort ?? system.level ?? "").match(/\d+/);
  return m ? Number(m[0]) || 0 : 0;
}

function spellLists(system = {}) {
  const raw = Array.isArray(system.spellLists)
    ? system.spellLists
    : String(system.spellLists ?? system.classe ?? "").split(/[,;|/]+/g);
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
function isIllusionnisteSpell(item) {
  const level = spellLevel(item?.system ?? {});
  return ILLUSIONIST_LEVELS.includes(level) && isIllusionnisteSpellLevel(item, level);
}

function preserveKey(item) {
  const system = item?.system ?? {};
  return `${slug(system.classe)}|${spellLevel(system)}|${slug(item?.name ?? system.nom)}`;
}

function effectKey(item) {
  const system = item?.system ?? {};
  return `${spellLevel(system)}|${slug(item?.name ?? system.nom)}`;
}

function buildExistingItemIndex(outputPath) {
  const index = new Map();
  if (!fs.existsSync(outputPath)) return index;
  try {
    const json = JSON.parse(fs.readFileSync(outputPath, "utf8"));
    for (const item of getItems(json)) {
      if (!item || String(item.type ?? item.system?.type ?? "") !== "sort") continue;
      index.set(preserveKey(item), item);
    }
  } catch (err) {
    console.warn(`[ADD2E][SPELL_MATERIALS_V3] Impossible de lire le fichier de préservation : ${outputPath}`, err?.message ?? err);
  }
  return index;
}

function loadIllusionistAuditIndex() {
  const index = new Map();
  const loaded = [];
  for (const level of ILLUSIONIST_LEVELS) {
    const file = path.resolve(repoRoot, `audit/decoupage_fichier/illusionniste-niveau-${level}.json`);
    if (!fs.existsSync(file)) continue;
    try {
      const json = JSON.parse(fs.readFileSync(file, "utf8"));
      const items = getItems(json);
      loaded.push({ file: path.relative(repoRoot, file), items: items.length });
      for (const item of items) {
        if (!item || String(item.type ?? item.system?.type ?? "") !== "sort") continue;
        const system = item.system ?? {};
        const key = `${spellLevel(system)}|${slug(item.name ?? system.nom)}`;
        index.set(key, item);
      }
    } catch (err) {
      console.warn(`[ADD2E][SPELL_MATERIALS_V3] Fichier illusionniste illisible : ${file}`, err?.message ?? err);
    }
  }
  return { index, loaded };
}

const MATERIAL_CANON = new Map(Object.entries({
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
  poudre_de_fer: "poudre de fer",
  pincee_de_poudre_de_fer: "poudre de fer",
  poudre_d_argent: "poudre d’argent",
  poudre_argent: "poudre d’argent",
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
  phosphore: "phosphore",
  argile: "argile"
}));

const WIZARD_MATERIAL_OVERRIDES = new Map(Object.entries({
  allometamorphose: ["cocon de chenille"],
  agrandissement: ["poudre de fer"],
  aura_magique_de_nystul: ["soie"],
  arme_enchantee: ["carbone en poudre", "citron en poudre"],
  clairaudience: ["petite corne d’argent"],
  message: ["fil de cuivre"],
  ventriloquie: ["parchemin mis en cône"]
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

const NOISE = new Set([
  "", "true", "false", "oui", "non", "consomme", "consommé", "non consomme", "non consommé", "non_consomme",
  "optionnel", "manuel", "manuel du joueur", "manuel des joueurs", "source", "aucun", "null", "undefined", "liquide",
  "consommation", "ingredient materiel", "ingrédient matériel", "composant materiel", "composant matériel", "composant requis",
  "clerc", "druide", "magicien", "illusionniste", "créature", "petite créature", "le", "la", "les",
  "consommation explicitement indiquée dans la description", "consommation explicitement indiquee dans la description"
].map(norm));

const NOISE_STARTS = [
  "requise", "requis", "alternative", "formulation source", "source du manuel", "sort normal", "sort inverse", "selon la règle",
  "description indique", "pour lancer", "ingrédient matériel", "ingredient materiel", "composant matériel", "composant materiel",
  "composant requis", "non consommé", "non consomme", "consommation explicitement"
].map(norm);

const NOISE_CONTAINS = [
  "manuel des joueurs", "formulation source", "règle d arbitrage", "description indique", "pour lancer le sort",
  "composant requis selon", "consommation explicitement indiquée", "que le magicien doit", "que l illusionniste doit",
  "utilisé pour", "utilisee pour", "utilisée pour"
].map(norm);

function canonicalMaterial(value) {
  const key = slug(value);
  return MATERIAL_CANON.get(key) ?? text(value);
}

function stripMaterialSourcePhrase(value) {
  return text(value)
    .replace(/^(?:la|les)\s+composantes?\s+mat[eé]rielles?\s+(?:sont|est|consistent?\s+en|se\s+composent\s+de)\s*/i, "")
    .replace(/^composantes?\s+mat[eé]rielles?\s+(?:sont|est|consistent?\s+en|se\s+composent\s+de)\s*/i, "")
    .replace(/^(?:la|les)\s+composante\s+mat[eé]rielle\s+(?:est|sont)\s*/i, "")
    .replace(/\s+d['’]une\s+valeur\b.*$/i, "")
    .replace(/\s+d['’]un\s+co[uû]t\b.*$/i, "")
    .replace(/\s+co[uû]tant\b.*$/i, "")
    .replace(/\s+valant\b.*$/i, "")
    .replace(/\s+estim[ée]e?\s+à\b.*$/i, "")
    .replace(/,\s*qui\b.*$/i, "")
    .replace(/\s+qui\s+(?:dispara[îi]t|est\s+consomm[ée]e?|sont\s+consomm[ée]s?)\b.*$/i, "")
    .replace(/\s+que\s+(?:le\s+magicien|l['’]?illusionniste|l['’]?(?:enchanteur|utilisateur))\s+doit\b.*$/i, "")
    .replace(/\s+utilis(?:e|é|ée|es|és)\s+pour\b.*$/i, "")
    .replace(/\s+servant\s+à\b.*$/i, "")
    .replace(/\s+qui\s+doit\b.*$/i, "")
    .replace(/[.!?;:]+$/g, "")
    .trim();
}

function cleanMaterial(value) {
  let out = stripMaterialSourcePhrase(value)
    .replaceAll("_", "-")
    .replace(/-/g, " ")
    .replace(/^d['’]\s*/i, "")
    .replace(/^(un|une)?\s*peu\s+de\s+/i, "")
    .replace(/^(un|une|du|de la|de l['’]?|des|le|la|les)\s+/i, "")
    .replace(/^(quelques|plusieurs)\s+/i, "")
    .trim();
  out = canonicalMaterial(out);
  return out;
}

function rejectMaterial(value) {
  if (typeof value !== "string") return false;
  const cleaned = cleanMaterial(value);
  const n = norm(cleaned);
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
  if (entry.type === "alternative") return Array.isArray(entry.choix) ? entry.choix : [];
  if (entry.type === "variante") return Array.isArray(entry.composants) ? entry.composants : [];
  const direct = entry.nom ?? entry.name ?? entry.label ?? entry.item ?? entry.itemName ?? entry.component ?? entry.composant ?? entry.slug ?? entry.id;
  return direct ? [String(direct)] : [];
}

function sanitizeEntry(entry) {
  if (typeof entry === "string") {
    const cleaned = cleanMaterial(entry);
    return rejectMaterial(cleaned) ? null : cleaned;
  }
  if (!entry || typeof entry !== "object") return null;
  if (entry.type === "alternative" || Array.isArray(entry.choix)) {
    const choix = uniqueFlat((entry.choix ?? entry.alternatives ?? entry.options ?? []).map(cleanMaterial).filter(v => !rejectMaterial(v)));
    if (!choix.length) return null;
    if (choix.length === 1) return choix[0];
    return { type: "alternative", choix };
  }
  if (entry.type === "variante") {
    const composants = uniqueFlat((entry.composants ?? []).map(cleanMaterial).filter(v => !rejectMaterial(v)));
    if (!composants.length) return null;
    return {
      type: "variante",
      id: slug(entry.id ?? entry.label ?? entry.nom ?? entry.name ?? composants.join("_")),
      label: text(entry.label ?? entry.nom ?? entry.name ?? entry.id ?? "Variante"),
      composants
    };
  }
  const names = componentNamesFromEntry(entry).map(cleanMaterial).filter(v => !rejectMaterial(v));
  if (!names.length) return null;
  return names[0];
}

function uniqueFlat(list) {
  const seen = new Set();
  const out = [];
  for (const value of list) {
    const key = slug(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function uniqueEntries(entries) {
  const seen = new Set();
  const out = [];
  for (const entry of entries) {
    const sanitized = sanitizeEntry(entry);
    if (!sanitized) continue;
    const key = typeof sanitized === "string"
      ? `s:${slug(sanitized)}`
      : `${sanitized.type}:${slug(sanitized.id ?? sanitized.label ?? "")}:${componentNamesFromEntry(sanitized).map(slug).join("|")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(sanitized);
  }
  return out;
}

function parseElementalVariants(source) {
  const n = norm(source);
  if (!n.includes("elemental") && !n.includes("elementaire")) return [];
  if (!n.includes("air") || !n.includes("eau") || !n.includes("feu") || !n.includes("terre")) return [];
  return [
    { type: "variante", id: "air", label: "Invocation d’un élémental de l’air", composants: ["encens à faire brûler"] },
    { type: "variante", id: "eau", label: "Invocation d’un élémental de l’eau", composants: ["eau", "sable"] },
    { type: "variante", id: "feu", label: "Invocation d’un élémental du feu", composants: ["soufre", "phosphore"] },
    { type: "variante", id: "terre", label: "Invocation d’un élémental de terre", composants: ["argile"] }
  ];
}

function parseSourceMaterials(source) {
  const variants = parseElementalVariants(source);
  if (variants.length) return variants;

  const cleaned = stripMaterialSourcePhrase(source);
  if (!cleaned) return [];
  const entries = [];
  const chunks = cleaned
    .split(/[,;\n]+|\s+ainsi\s+que\s+/gi)
    .map(text)
    .filter(Boolean);
  for (const chunk of chunks) {
    if (/\s+soit\s+/i.test(chunk)) {
      const leading = chunk.split(/\s+et\s*,?\s*soit\s+/i);
      if (leading.length === 2) {
        for (const part of leading[0].split(/\s+et\s+/i).map(cleanMaterial).filter(v => !rejectMaterial(v))) entries.push(part);
        const choix = leading[1].split(/\s*,?\s*soit\s+|\s+ou\s+/i).map(cleanMaterial).filter(v => !rejectMaterial(v));
        if (choix.length > 1) entries.push({ type: "alternative", choix });
        else if (choix.length === 1) entries.push(choix[0]);
        continue;
      }
    }
    if (/\s+ou\s+/i.test(chunk)) {
      const choix = chunk.split(/\s+ou\s+/i).map(cleanMaterial).filter(v => !rejectMaterial(v));
      if (choix.length > 1) entries.push({ type: "alternative", choix });
      else if (choix.length === 1) entries.push(choix[0]);
      continue;
    }
    for (const part of chunk.split(/\s+et\s+/i).map(cleanMaterial).filter(v => !rejectMaterial(v))) entries.push(part);
  }
  return uniqueEntries(entries);
}

function materialEntriesFromValue(value) {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return uniqueEntries(value.flatMap(v => materialEntriesFromValue(v)));
  if (typeof value === "object") return uniqueEntries([value]);
  return parseSourceMaterials(value);
}

function materialEntryCount(entries) {
  return (entries ?? []).reduce((sum, entry) => sum + componentNamesFromEntry(entry).length, 0);
}

function ensureComposantesHasM(system, entries) {
  if (!materialEntryCount(entries)) return;
  const raw = text(system.composantes);
  if (/(^|[,;\s])M([,;\s]|$)/i.test(raw)) return;
  system.composantes = raw ? `${raw}, M` : "M";
}

function markDelegatedComponents(system) {
  system.composants_materiels = [];
  system.composantes = "*";
  system.composants_materiels_a_renseigner = false;
  const note = "Composants déterminés par le sort de magicien niveau 1 choisi.";
  system.composants_materiels_note = text([system.composants_materiels_note, note].filter(Boolean).join("\n"));
}

function mergeIllusionistAuditSource(item, auditIndex) {
  if (!isIllusionnisteSpell(item)) return null;
  const source = auditIndex.get(effectKey(item));
  if (!source?.system) return null;
  const sys = item.system ?? {};
  const src = source.system ?? {};
  for (const field of [
    "composants_materiels_source",
    "composants_materiels_reference",
    "composants_materiels_verification_recommandee",
    "composants_materiels_a_renseigner"
  ]) {
    if (src[field] !== undefined && src[field] !== null && src[field] !== "") sys[field] = clone(src[field]);
  }
  if (Array.isArray(src.composants_materiels) && src.composants_materiels.length) sys.composants_materiels = clone(src.composants_materiels);
  return source;
}

function normalizeMaterials(item, auditIndex) {
  const system = item.system ?? {};
  const before = clone(system.composants_materiels ?? []);
  const key = slug(item?.name ?? system?.nom);
  let entries = [];

  if (isIllusionnisteSpell(item)) {
    mergeIllusionistAuditSource(item, auditIndex);
    if (ILLUSIONIST_COMPONENT_DELEGATIONS.has(key)) {
      markDelegatedComponents(system);
    } else if (ILLUSIONIST_MATERIAL_OVERRIDES.has(key)) {
      system.composants_materiels = uniqueEntries(ILLUSIONIST_MATERIAL_OVERRIDES.get(key));
      ensureComposantesHasM(system, system.composants_materiels);
    } else {
      entries = materialEntriesFromValue(system.composants_materiels);
      if (!materialEntryCount(entries)) entries = materialEntriesFromValue(system.composants_materiels_objets);
      if (!materialEntryCount(entries)) entries = materialEntriesFromValue(system.composants_requis);
      if (!materialEntryCount(entries)) entries = materialEntriesFromValue(system.composants_materiels_source);
      system.composants_materiels = uniqueEntries(entries);
      ensureComposantesHasM(system, system.composants_materiels);
    }
  } else if (WIZARD_MATERIAL_OVERRIDES.has(key)) {
    system.composants_materiels = uniqueEntries(WIZARD_MATERIAL_OVERRIDES.get(key));
  } else {
    entries = materialEntriesFromValue(system.composants_materiels);
    system.composants_materiels = uniqueEntries(entries);
  }

  return {
    before,
    after: clone(system.composants_materiels),
    changed: JSON.stringify(before) !== JSON.stringify(system.composants_materiels)
  };
}

function kindAndTags(name, classSlug) {
  const key = slug(name);
  const tags = [`effet:${key}`, `classe:${classSlug}`];
  let kind = `${classSlug}_effect`;
  let automation = "active_effect_or_mj_aid";
  if (/(soin|guerison|guérison|regeneration|régénération|restauration|rappel|resurrection|résurrection|reincarnation|réincarnation)/.test(key)) {
    kind = "healing_or_restoration"; tags.push("soin_ou_restauration");
  } else if (/(detection|détection|localisation|prevision|prévision|communion|orientation|lithomancie|divination|augure|clairaudience|clairvoyance|lecture|identification|analyse|oracle|vision)/.test(key)) {
    kind = "detection_or_divination"; automation = "mj_aid"; tags.push("detection_ou_divination");
  } else if (/(langage|amitie|amitié|charme|perception|suggestion|domination|empathie|hypnotisme)/.test(key)) {
    kind = "communication_or_control"; automation = "mj_aid"; tags.push("communication_ou_controle");
  } else if (/(protection|bouclier|invisibilite|invisibilité|resistance|résistance|armure|globe|immunite|immunité|reflet|reflection|réflexion|image_miroir)/.test(key)) {
    kind = "protection"; tags.push("protection");
  } else if (/(paralysie|confusion|debilite|débilité|piege|piège|repulsion|répulsion|sommeil|lenteur|immobilisation|labyrinthe|emprisonnement|entrave|terreur|peur|effroi|cecite|cécité|surdite|surdité)/.test(key)) {
    kind = "control"; tags.push("controle");
  } else if (/(feu|foudre|tempete|tempête|projectile|missile|eclair|éclair|boule|nuage|cone|cône|brulante|brûlante|explosion|desintegration|désintégration)/.test(key)) {
    kind = "damage_or_area_control"; automation = "damage_or_mj_aid"; tags.push("degats_ou_zone");
  } else if (/(invocation|serviteur|animal|animaux|insectes|animation|monstre|elemental|élémental|familier|ombre|ombres)/.test(key)) {
    kind = "summon_or_actor_effect"; automation = "actor_creation_or_mj_aid"; tags.push("invocation_ou_creation");
  } else if (/(illusion|fantasme|holographie|apparence|mur|tenebres|ténèbres|lumiere|lumière|bruitage|ventriloquie)/.test(key)) {
    kind = "illusion_or_sensory"; automation = "mj_aid"; tags.push("illusion_ou_sensoriel");
  }
  return { kind, tags, automation };
}

function buildEffectProfile(item, classSlug, level) {
  const label = text(item?.name ?? item?.system?.nom ?? `Sort ${classSlug}`);
  const key = slug(label) || `sort_${classSlug}_n${level}`;
  const { kind, tags, automation } = kindAndTags(label, classSlug);
  return {
    version: EFFECT_PROFILE_VERSION,
    source: `manual-normalized-${classSlug}-n${level}`,
    effects: [{
      id: key,
      label,
      kind,
      automation,
      tags: [...tags, `niveau:${level}`],
      notes: `Profil mécanique ${classSlug} normalisé ; l’effet détaillé reste porté par la description, les tags existants et le script onUse du sort.`
    }]
  };
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
  if (classSlug === "illusionniste" && ILLUSIONIST_COMPONENT_DELEGATIONS.has(slug(item?.name ?? item?.system?.nom))) return null;
  const entries = item?.system?.composants_materiels ?? [];
  const hasM = String(item?.system?.composantes ?? "").toUpperCase().includes("M");
  const bad = [];
  for (const entry of entries) {
    if (typeof entry === "string" && rejectMaterial(entry)) bad.push(entry);
    if (entry && typeof entry === "object") {
      if (!componentNamesFromEntry(entry).length) bad.push(entry);
      for (const component of componentNamesFromEntry(entry)) if (rejectMaterial(component)) bad.push(component);
    }
  }
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
  const illusionistAudit = loadIllusionistAuditIndex();
  const control = {
    version: VERSION,
    input: path.relative(repoRoot, input),
    output: path.relative(repoRoot, output),
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

    const hadIllusionistSource = !isIllusionnisteSpell(item) || illusionistAudit.index.has(effectKey(item));
    const materials = normalizeMaterials(item, illusionistAudit.index);
    const profile = applyEffectProfileOverride(item);
    control.spells += 1;
    if (materials.changed) {
      control.changedSpells += 1;
      if (control.examples.length < 50) control.examples.push({ name: item.name, classe: item.system.classe, niveau: item.system.niveau, before: materials.before, after: materials.after });
    }
    if (profile.changed) control.changedEffectProfiles += 1;
    if (!materialEntryCount(item.system.composants_materiels ?? [])) control.emptyMaterialSpells += 1;

    for (const level of CLERIC_LEVELS) if (isClercSpellLevel(item, level)) {
      const bucket = control[`clercLevel${level}EffectProfiles`];
      if (profile.applied && profile.level === level && profile.classSlug === "clerc") bucket.applied.push(item.name); else bucket.missing.push(item.name);
    }
    for (const level of DRUID_LEVELS) if (isDruideSpellLevel(item, level)) {
      const bucket = control[`druideLevel${level}EffectProfiles`];
      if (profile.applied && profile.level === level && profile.classSlug === "druide") bucket.applied.push(item.name); else bucket.missing.push(item.name);
    }
    for (const level of WIZARD_LEVELS) if (isMagicienSpellLevel(item, level)) {
      const bucket = control[`magicienLevel${level}EffectProfiles`];
      if (profile.applied && profile.level === level && profile.classSlug === "magicien") bucket.applied.push(item.name); else bucket.missing.push(item.name);
    }
    for (const level of ILLUSIONIST_LEVELS) if (isIllusionnisteSpellLevel(item, level)) {
      const bucket = control[`illusionnisteLevel${level}EffectProfiles`];
      if (profile.applied && profile.level === level && profile.classSlug === "illusionniste") bucket.applied.push(item.name); else bucket.missing.push(item.name);
      control.illusionnisteMaterialAudit.push({ name: item.name, niveau: item.system.niveau, composants: clone(item.system.composants_materiels) });
      const warning = materialWarningForClass(item, "illusionniste");
      if (warning) control.illusionnisteMaterialWarnings.push(warning);
      if (!hadIllusionistSource) control.illusionnisteSourceMissing.push({ name: item.name, niveau: item.system.niveau });
    }

    if (profile.applied || isIllusionnisteSpell(item)) {
      control.watched[item.name] = {
        classe: item.system.classe,
        niveau: item.system.niveau,
        composants_materiels: clone(item.system.composants_materiels),
        composantes: item.system.composantes,
        effectProfile: clone(item.system.effectProfile)
      };
    }
    if (JSON.stringify(Object.keys(item.system).sort()) !== expected) control.sameSystemFieldsForAllSpells = false;
  }

  json.normalizedBy = VERSION;
  json.normalizedAt = new Date().toISOString();
  fs.writeFileSync(output, `${JSON.stringify(json, null, 2)}\n`, "utf8");
  fs.writeFileSync(controlOutput, `${JSON.stringify(control, null, 2)}\n`, "utf8");

  console.log(`[ADD2E][SPELL_MATERIALS_V3] ${control.spells} sort(s), ${control.changedSpells} composant(s) modifié(s).`);
  console.log(`[ADD2E][SPELL_MATERIALS_V3] Manual clerc/druide/magicien materials preserved: ${control.preservedManualMaterials}`);
  for (const level of ILLUSIONIST_LEVELS) {
    const bucket = control[`illusionnisteLevel${level}EffectProfiles`];
    console.log(`[ADD2E][SPELL_MATERIALS_V3] EffectProfiles N${level} illusionniste: ${bucket.applied.length} appliqué(s), ${bucket.missing.length} manquant(s).`);
  }
  console.log(`[ADD2E][SPELL_MATERIALS_V3] Illusionist material warnings: ${control.illusionnisteMaterialWarnings.length}`);
  console.log(`[ADD2E][SPELL_MATERIALS_V3] Output: ${path.relative(repoRoot, output)}`);
  console.log(`[ADD2E][SPELL_MATERIALS_V3] Control: ${path.relative(repoRoot, controlOutput)}`);
}

main();
