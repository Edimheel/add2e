import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");

const VERSION = "2026-06-17-normalize-spell-materials-v3-druid-material-cleanup-v1";
const DEFAULT_INPUT = "fvtt-spells-all-normalise-mecanique-v1.json";
const DEFAULT_OUTPUT = "fvtt-spells-all-normalise-mecanique-v3.json";
const DEFAULT_CONTROL = "fvtt-spells-all-normalise-mecanique-v3-controle.json";
const EFFECT_PROFILE_VERSION = "2026-06-16-add2e-spell-effects-v1";
const CLERIC_LEVELS = [2, 3, 4, 5, 6, 7];
const DRUID_LEVELS = [1, 2, 3, 4, 5, 6, 7];

const SYSTEM_KEYS = [
  "nom", "type", "classe", "spellLists", "niveau", "ecole", "portee", "duree", "zone_effet", "cible",
  "temps_incantation", "jet_sauvegarde", "composantes", "composants_materiels", "composants_materiels_source",
  "composants_materiels_reference", "composants_materiels_verification_recommandee", "composants_materiels_note",
  "composants_materiels_a_renseigner", "description", "onUse", "onUseCode", "tags", "effectTags", "effectProfile"
];

const MATERIAL_CANON = new Map(Object.entries({
  symbole_sacre: "symbole sacré du clerc",
  symbole_sacre_du_clerc: "symbole sacré du clerc",
  symbole_religieux: "symbole sacré du clerc",
  jeu_de_baguettes_serties_de_gemmes: "jeu d’objets divinatoires",
  jeu_d_objets_divinatoires: "jeu d’objets divinatoires",
  objets_divinatoires_similaires: "jeu d’objets divinatoires",
  os_de_dragon: "jeu d’objets divinatoires",
  feuille_d_infusion_encore_humide: "feuilles d’infusion encore humides",
  feuille_d_infusion_encore_humides: "feuilles d’infusion encore humides",
  feuilles_d_infusion_encore_humide: "feuilles d’infusion encore humides",
  feuilles_d_infusion_encore_humides: "feuilles d’infusion encore humides",
  objet_similaire_au_chapelet_de_priere: "chapelet de prière",
  objet_similaire_ayant_la_meme_utilisation: "chapelet de prière",
  livre_de_priere: "livre de prière",
  gousse_ail: "gousse d’ail",
  gousse_d_ail: "gousse d’ail",
  poudre_argent: "poudre d’argent",
  poudre_d_argent: "poudre d’argent",
  poudre_or: "poudre d’or",
  poudre_d_or: "poudre d’or",
  eau_benite: "eau bénite",
  eau_maudite: "eau maudite",
  pierre_aimantee: "pierre aimantée",
  pincee_de_poussiere: "pincée de poussière",
  pincee_de_poussiere_de_cimetiere: "pincée de poussière de cimetière",
  goutte_de_sang: "goutte de sang",
  chair_humaine: "morceau de chair humaine",
  morceau_de_chair_humaine: "morceau de chair humaine",
  os_en_poudre: "os en poudre",
  echarde_d_os: "os en poudre",
  ecorce: "écorce",
  ecaille_de_serpent: "écailles de serpent",
  ecailles_de_serpent: "écailles de serpent",
  symbole_religieux_en_argent: "symbole religieux en argent",
  chapelet_de_priere: "chapelet de prière",
  poudre_de_diamant: "poudre de diamant",
  lame_miniature: "lame miniature",
  petit_caillou: "petit caillou",
  motte_de_terre: "motte de terre",
  gui_sacre: "gui",
  gui_druidique: "gui",
  typiquement_druidique_a_savoir_du_gui: "gui",
  nourriture_appreciee_par_l_animal: "nourriture appréciée par l’animal",
  nourriture_appréciée_par_l_animal: "nourriture appréciée par l’animal",
  feuille_de_trefle: "feuille de trèfle",
  feuille_de_trèfle: "feuille de trèfle",
  massue_en_chene: "massue en chêne",
  massue_en_chêne: "massue en chêne"
}));

const CLERIC_MATERIAL_OVERRIDES = new Map(Object.entries({
  augure: ["jeu d’objets divinatoires", "feuilles d’infusion encore humides", "perle écrasée d’au moins 100 po"],
  divination: ["encens", "symbole sacré du clerc"],
  marteau_spirituel: ["marteau de guerre normal"],
  paralysie: ["petite tige de métal droite et rigide"],
  resistance_au_feu: ["goutte de mercure"],
  retardement_du_poison: ["symbole sacré du clerc", "gousse d’ail"],
  catalepsie: ["pincée de poussière de cimetière", "symbole sacré du clerc"],
  glyphe_de_garde: ["encens"],
  localisation_d_objets: ["pierre aimantée"],
  necro_animation: ["goutte de sang", "morceau de chair humaine", "os en poudre"],
  batons_a_serpents: ["écorce", "écailles de serpent"],
  necromancie: ["symbole sacré du clerc", "encens"],
  priere: ["symbole religieux en argent", "chapelet de prière"],
  abaissement_des_eaux: ["goutte d’eau", "pincée de poussière"],
  detection_des_mensonges: ["poudre d’or"],
  exorcisme: ["symbole sacré du clerc", "eau bénite", "eau maudite"],
  langage_des_plantes: ["goutte d’eau", "pincée de bouse", "flamme"],
  protection_contre_le_mal_sur_3_m: ["poudre d’argent"],
  protection_contre_le_mal_sur_3m: ["poudre d’argent"],
  communion: ["symbole sacré du clerc", "encens", "eau bénite"],
  expiation: ["symbole sacré du clerc", "chapelet de prière", "livre de prière"],
  fleau_d_insectes: ["symbole sacré du clerc"],
  pilier_de_feu: ["pincée de soufre"],
  quete_religieuse: ["symbole sacré du clerc"],
  rappel_a_la_vie: ["symbole sacré du clerc"],
  soin_ultime: ["symbole sacré du clerc"],
  vision_reelle: ["safran", "graisse", "huile"],
  animation_des_objets: ["symbole sacré du clerc"],
  barriere_de_lames: ["lame miniature"],
  invocation_des_animaux: ["symbole sacré du clerc"],
  lithomancie: ["encens", "argile molle"],
  rappel: ["symbole sacré du clerc"],
  separation_des_eaux: ["deux feuilles de cristal", "deux coquilles d’œuf"],
  serviteur_aerien: ["symbole sacré du clerc"],
  controle_du_climat: ["encens", "chapelet de prière"],
  marche_des_vents: ["feu", "eau bénite"],
  regeneration: ["symbole sacré du clerc", "eau bénite"],
  restauration: ["poudre de diamant"],
  resurrection: ["symbole sacré du clerc", "eau bénite"],
  seuil: ["symbole sacré du clerc"],
  sort_astral: ["symbole sacré du clerc"],
  symbole: ["mercure", "phosphore"],
  tremblement_de_terre: ["pincée de poussière", "petit caillou", "motte de terre"]
}));

const DRUID_MATERIAL_OVERRIDES = new Map(Object.entries({
  amitie_animale: ["gui", "nourriture appréciée par l’animal"],
  shillelagh: ["massue en chêne", "gui", "feuille de trèfle"],
  langage_des_plantes: ["gui"]
}));

const NOISE = new Set([
  "", "true", "false", "oui", "non", "consomme", "consommé", "non consomme", "non consommé", "non_consomme",
  "optionnel", "manuel", "manuel du joueur", "manuel des joueurs", "source", "aucun", "null", "undefined", "liquide",
  "consommation", "ingredient materiel", "ingrédient matériel", "composant materiel", "composant matériel",
  "clerc", "clerc non mauvais", "clerc mauvais", "druide", "druidique", "créature", "petite créature", "le", "la", "les"
]);

const NOISE_STARTS = [
  "requise", "requis", "alternative", "formulation source", "source du manuel", "sort normal", "sort inverse", "selon la règle",
  "description indique", "pour lancer", "dons requis", "type de métal", "taille détermine", "sorte de diapason",
  "ingrédient matériel", "ingredient materiel", "composant matériel", "composant materiel", "non consommé", "non consomme"
];
const NOISE_CONTAINS = [
  "manuel des joueurs", "formulation source", "règle d arbitrage", "ayant servi", "avant consommation", "quand le sort est",
  "description indique", "saupoudrée", "pour lancer le sort"
];

function text(value) { return String(value ?? "").replace(/\s+/g, " ").trim(); }
function norm(value) { return text(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, "'").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim(); }
function slug(value) { return norm(value).replace(/\s+/g, "_"); }
function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
function spellLevel(system = {}) { const m = String(system.niveau ?? system.niveau_sort ?? system.level ?? "").match(/\d+/); return m ? Number(m[0]) || 0 : 0; }
function spellLists(system = {}) { const raw = Array.isArray(system.spellLists) ? system.spellLists : String(system.spellLists ?? system.classe ?? "").split(/[,;|/]+/g); return raw.map(slug).filter(Boolean); }
function isClassSpellLevel(item, classSlug, level) { const system = item?.system ?? {}; const c = slug(system.classe); const lists = spellLists(system); return spellLevel(system) === level && (c.includes(classSlug) || lists.includes(classSlug)); }
function isClercSpellLevel(item, level) { return isClassSpellLevel(item, "clerc", level); }
function isDruideSpellLevel(item, level) { return isClassSpellLevel(item, "druide", level); }
function isDruideSpell(item) { const level = spellLevel(item?.system ?? {}); return DRUID_LEVELS.includes(level) && isDruideSpellLevel(item, level); }
function getItems(json) { if (Array.isArray(json)) return json; for (const key of ["items", "Item", "Items", "documents", "data", "entries"]) if (Array.isArray(json?.[key])) return json[key]; return []; }
function unique(list) { const seen = new Set(); return list.filter(v => { const key = slug(v); if (!key || seen.has(key)) return false; seen.add(key); return true; }); }
function fx(id, label, kind, tags, notes, extra = {}) { return { id, label, kind, automation: extra.automation ?? "active_effect_or_mj_aid", tags, notes, ...extra }; }
function ep(effects, level, classSlug) { return { version: EFFECT_PROFILE_VERSION, source: `manual-normalized-${classSlug}-n${level}`, effects: clone(effects) }; }

function cleanMaterial(value) {
  let out = text(value).replaceAll("_", "-").replace(/-/g, " ");
  if (/à\s+savoir\s+du\s+gui/i.test(out)) out = "gui";
  out = out.replace(/^typiquement\s+druidique\s*\((.*?)\)$/i, "$1");
  out = out.replace(/^à\s+savoir\s+/i, "");
  out = out.replace(/^d['’]\s*/i, "");
  out = out.replace(/^(un|une)?\s*peu\s+de\s+/i, "");
  out = out.replace(/^(un|une|du|de la|de l['’]?|des|le|la|les)\s+/i, "");
  out = out.replace(/^(quelques|plusieurs)\s+/i, "");
  out = out.replace(/^petit morceau de\s+/i, "");
  out = out.replace(/^morceau de\s+/i, "");
  out = out.replace(/[.!?;:]+$/g, "").trim();
  return MATERIAL_CANON.get(slug(out)) ?? out;
}
function rejectMaterial(value) {
  const cleaned = cleanMaterial(value);
  const n = norm(cleaned);
  if (!n || NOISE.has(n)) return true;
  if (/^\d+(?:[,.]\d+)?\s*(m2|m|m²|case|cases|po|pa|pp|pc)?$/i.test(cleaned)) return true;
  if (NOISE_STARTS.some(v => n.startsWith(norm(v)))) return true;
  if (NOISE_CONTAINS.some(v => n.includes(norm(v)))) return true;
  if (n.split(" ").length > 9) return true;
  return false;
}
function collectMaterials(value, out = [], notes = []) {
  if (value === undefined || value === null || value === "") return { out, notes };
  if (Array.isArray(value)) { for (const v of value) collectMaterials(v, out, notes); return { out, notes }; }
  if (typeof value === "object") {
    for (const k of ["note", "notes", "condition", "conditions", "description", "source", "reference", "formulation_source", "source_text"]) if (value[k]) notes.push(text(value[k]));
    const alts = value.alternatives ?? value.options ?? value.choix ?? value.auChoix ?? value.or;
    if (Array.isArray(alts)) { for (const v of alts) collectMaterials(v, out, notes); return { out, notes }; }
    const direct = value.nom ?? value.name ?? value.label ?? value.item ?? value.itemName ?? value.component ?? value.composant ?? value.slug ?? value.id;
    if (direct !== undefined) collectMaterials(direct, out, notes);
    return { out, notes };
  }
  const raw = text(value);
  const main = raw.split(/\s*(?:optionnel|alternative|ingrédient matériel|ingredient materiel|composant matériel|composant materiel|consomm|formulation source|manuel des joueurs|requise pour|requis pour|sort normal|sort inversé|description indique|pour lancer le sort)\b/i)[0];
  for (const part of main.split(/[,;|\n]+|\s+et\s+/gi).map(cleanMaterial).filter(Boolean)) {
    const alternatives = part.split(/\s+ou\s+/i).map(cleanMaterial).filter(Boolean);
    for (const candidate of alternatives) {
      if (!rejectMaterial(candidate)) out.push(candidate);
      else if (candidate) notes.push(candidate);
    }
  }
  return { out, notes };
}
function normalizeMaterials(item) {
  const system = item.system ?? {};
  const before = clone(system.composants_materiels ?? []);
  const notes = [];
  let values = [];
  collectMaterials(system.composants_materiels, values, notes);
  if (!values.length) collectMaterials(system.composants_materiels_objets, values, notes);
  if (!values.length) collectMaterials(system.composants_requis, values, notes);
  const key = slug(item?.name ?? system?.nom);
  if (isDruideSpell(item) && DRUID_MATERIAL_OVERRIDES.has(key)) values = DRUID_MATERIAL_OVERRIDES.get(key);
  else if (!isDruideSpell(item) && CLERIC_MATERIAL_OVERRIDES.has(key)) values = CLERIC_MATERIAL_OVERRIDES.get(key);
  system.composants_materiels = unique(values.map(cleanMaterial).filter(v => !rejectMaterial(v)));
  system.composants_materiels_note = unique([...(notes ?? []), system.composants_materiels_note].filter(Boolean)).join("\n");
  return { before, after: clone(system.composants_materiels), notes: clone(notes), changed: JSON.stringify(before) !== JSON.stringify(system.composants_materiels) };
}

function kindAndTags(name, classSlug) {
  const key = slug(name);
  const tags = [`effet:${key}`, `classe:${classSlug}`];
  let kind = `${classSlug}_effect`;
  let automation = "active_effect_or_mj_aid";
  if (/(soin|guerison|guérison|regeneration|régénération|restauration|rappel|resurrection|résurrection|reincarnation|réincarnation)/.test(key)) { kind = "healing_or_restoration"; tags.push("soin_ou_restauration"); }
  else if (/(detection|détection|localisation|prevision|prévision|communion|orientation|lithomancie|divination|augure)/.test(key)) { kind = "detection_or_divination"; automation = "mj_aid"; tags.push("detection_ou_divination"); }
  else if (/(langage|amitie|amitié|charme|perception)/.test(key)) { kind = "communication_or_control"; automation = "mj_aid"; tags.push("communication_ou_controle"); }
  else if (/(protection|bouclier|peau_d_ecorce|invisibilite|invisibilité|resistance|résistance)/.test(key)) { kind = "protection"; tags.push("protection"); }
  else if (/(paralysie|confusion|debilite|débilité|piege|piège|croc_en_jambe|repulsion|répulsion|quete|quête|exorcisme)/.test(key)) { kind = "control"; tags.push("controle"); }
  else if (/(feu|foudre|metal|métal|pyrotechnie|tempete|tempête|lames|epines|épines|mort_rampante|pilier|tremblement)/.test(key)) { kind = "damage_or_area_control"; automation = "damage_or_mj_aid"; tags.push("degats_ou_zone"); }
  else if (/(invocation|serviteur|animal|animaux|insectes|animation)/.test(key)) { kind = "summon_or_actor_effect"; automation = "actor_creation_or_mj_aid"; tags.push("invocation_ou_creation"); }
  else if (/(plante|plantes|vegetal|végétal|bois|arbre|shillelagh|croissance|batons|bâtons)/.test(key)) { kind = "plant_or_nature_control"; tags.push("plante_ou_nature"); }
  else if (/(eau|aquatique|climat|vents|vent|terre|pierre|roche|boue|separation|séparation|abaissement)/.test(key)) { kind = "elemental_or_weather_control"; automation = "mj_aid"; tags.push("element_ou_climat"); }
  return { kind, tags, automation };
}
function buildEffectProfile(item, classSlug, level) {
  const label = text(item?.name ?? item?.system?.nom ?? `Sort ${classSlug}`);
  const key = slug(label) || `sort_${classSlug}_n${level}`;
  const { kind, tags, automation } = kindAndTags(label, classSlug);
  const notes = `Profil mécanique ${classSlug} normalisé ; l’effet détaillé reste porté par la description, les tags existants et le script onUse du sort.`;
  return ep([fx(key, label, kind, [...tags, `niveau:${level}`], notes, { automation })], level, classSlug);
}
function applyEffectProfileOverride(item) {
  const system = item.system ?? {};
  const level = spellLevel(system);
  let classSlug = "";
  if (CLERIC_LEVELS.includes(level) && isClercSpellLevel(item, level)) classSlug = "clerc";
  else if (DRUID_LEVELS.includes(level) && isDruideSpellLevel(item, level)) classSlug = "druide";
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
function makeBucket() { return { applied: [], missing: [] }; }

function main() {
  const input = path.resolve(repoRoot, process.argv[2] || DEFAULT_INPUT);
  const output = path.resolve(repoRoot, process.argv[3] || DEFAULT_OUTPUT);
  const controlOutput = path.resolve(repoRoot, process.argv[4] || DEFAULT_CONTROL);
  if (!fs.existsSync(input)) throw new Error(`Fichier introuvable : ${input}`);
  const raw = fs.readFileSync(input, "utf8");
  if (!raw.trim()) throw new Error(`Fichier vide : ${input}`);
  const json = JSON.parse(raw);
  const items = getItems(json);
  const control = {
    version: VERSION,
    input: path.relative(repoRoot, input),
    output: path.relative(repoRoot, output),
    totalItems: items.length,
    spells: 0,
    changedSpells: 0,
    changedEffectProfiles: 0,
    emptyMaterialSpells: 0,
    examples: [],
    watched: {},
    suspiciousMaterialComponents: [],
    sameSystemFieldsForAllSpells: true,
    canonicalFields: SYSTEM_KEYS
  };
  for (const level of CLERIC_LEVELS) control[`clercLevel${level}EffectProfiles`] = makeBucket();
  for (const level of DRUID_LEVELS) control[`druideLevel${level}EffectProfiles`] = makeBucket();
  const expected = JSON.stringify([...SYSTEM_KEYS].sort());

  for (const item of items) {
    if (!item || String(item.type ?? item.system?.type ?? "") !== "sort") continue;
    item.system ??= {};
    ensureSystem(item.system);
    const materials = normalizeMaterials(item);
    const profile = applyEffectProfileOverride(item);
    control.spells += 1;
    if (!item.system.composants_materiels.length) control.emptyMaterialSpells += 1;
    if (materials.changed) {
      control.changedSpells += 1;
      if (control.examples.length < 40) control.examples.push({ name: item.name, classe: item.system.classe, niveau: item.system.niveau, before: materials.before, after: materials.after, notes: materials.notes });
    }
    if (profile.changed) control.changedEffectProfiles += 1;
    for (const level of CLERIC_LEVELS) if (isClercSpellLevel(item, level)) {
      const bucket = control[`clercLevel${level}EffectProfiles`];
      if (profile.applied && profile.level === level && profile.classSlug === "clerc") bucket.applied.push(item.name);
      else bucket.missing.push(item.name);
    }
    for (const level of DRUID_LEVELS) if (isDruideSpellLevel(item, level)) {
      const bucket = control[`druideLevel${level}EffectProfiles`];
      if (profile.applied && profile.level === level && profile.classSlug === "druide") bucket.applied.push(item.name);
      else bucket.missing.push(item.name);
    }
    const suspicious = (item.system.composants_materiels ?? []).filter(rejectMaterial);
    if (suspicious.length) control.suspiciousMaterialComponents.push({ name: item.name, classe: item.system.classe, niveau: item.system.niveau, components: suspicious, allComponents: clone(item.system.composants_materiels) });
    if (profile.applied || DRUID_MATERIAL_OVERRIDES.has(slug(item.name ?? item.system.nom)) || CLERIC_MATERIAL_OVERRIDES.has(slug(item.name ?? item.system.nom))) {
      control.watched[item.name] = { classe: item.system.classe, niveau: item.system.niveau, composants_materiels: clone(item.system.composants_materiels), effectProfile: clone(item.system.effectProfile), note: item.system.composants_materiels_note };
    }
    if (JSON.stringify(Object.keys(item.system).sort()) !== expected) control.sameSystemFieldsForAllSpells = false;
  }

  json.normalizedBy = VERSION;
  json.normalizedAt = new Date().toISOString();
  fs.writeFileSync(output, `${JSON.stringify(json, null, 2)}\n`, "utf8");
  fs.writeFileSync(controlOutput, `${JSON.stringify(control, null, 2)}\n`, "utf8");
  console.log(`[ADD2E][SPELL_MATERIALS_V3] ${control.spells} sort(s), ${control.changedSpells} composant(s) modifié(s).`);
  for (const level of CLERIC_LEVELS) { const bucket = control[`clercLevel${level}EffectProfiles`]; console.log(`[ADD2E][SPELL_MATERIALS_V3] EffectProfiles N${level} clerc: ${bucket.applied.length} appliqué(s), ${bucket.missing.length} manquant(s).`); }
  for (const level of DRUID_LEVELS) { const bucket = control[`druideLevel${level}EffectProfiles`]; console.log(`[ADD2E][SPELL_MATERIALS_V3] EffectProfiles N${level} druide: ${bucket.applied.length} appliqué(s), ${bucket.missing.length} manquant(s).`); }
  console.log(`[ADD2E][SPELL_MATERIALS_V3] Suspicious: ${control.suspiciousMaterialComponents.length}`);
  console.log(`[ADD2E][SPELL_MATERIALS_V3] Output: ${path.relative(repoRoot, output)}`);
  console.log(`[ADD2E][SPELL_MATERIALS_V3] Control: ${path.relative(repoRoot, controlOutput)}`);
}

main();
