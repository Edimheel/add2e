import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DEFAULT_V4 = "fvtt-spells-all-normalise-mecanique-v4.json";
const DEFAULT_REPORT = "audit/rapports/AUDIT-V4-SCHEMA-UTILISATION.json";
const SPELL_SCRIPTS = path.join(ROOT, "scripts", "sorts");
const REQUIRED_FIELDS = [
  "classe", "spellLists", "niveau", "ecole", "portee", "duree", "zone_effet", "cible",
  "temps_incantation", "jet_sauvegarde", "composantes", "composants_materiels",
  "effectProfile", "description", "onUse"
];
const ITEM_FIELDS = ["_id", "name", "type", "img", "folder", "sort", "system", "flags", "effects"];
const FOLDER_FIELDS = ["_id", "name", "type", "folder", "sorting", "sort", "color"];
const ALIASES = {
  classe: ["classe", "class", "liste"],
  ecole: ["ecole", "école", "school"],
  portee: ["portee", "portée", "range"],
  duree: ["duree", "durée", "duration"],
  zone_effet: ["zone_effet", "zoneEffet", "area", "areaOfEffect"],
  cible: ["cible", "target", "targets"],
  temps_incantation: ["temps_incantation", "tempsIncantation", "castingTime", "casting_time"],
  jet_sauvegarde: ["jet_sauvegarde", "jetSauvegarde", "savingThrow", "saving_throw"],
  composantes: ["composantes", "components", "componentes", "composants"],
  composants_materiels: ["composants_materiels", "composantsMateriels", "materialComponents", "material_components", "composants_materiels_objets"],
  description: ["description", "description_reelle", "description_texte", "description_html"],
  onUse: ["onUse", "onuse", "on_use"]
};

// Sorts sans entree declarative et sans ADD2E_SORT_CONFIG. Chaque cle est un slug ADD2E.
const PROFILE_OVERRIDES = Object.freeze({
  agrandissement: { mechanic: "buff_debuff", operation: "enlarge" },
  apaisement: { mechanic: "status", operation: "calm_emotions" },
  benediction: { mechanic: "buff_debuff", operation: "bless" },
  boule_de_feu: { mechanic: "damage", operation: "fireball", dice: "leveld6", damageType: "fire" },
  changement_d_apparence: { mechanic: "utility", operation: "disguise_self" },
  charme_personnes: { mechanic: "status", operation: "charm_person", status: ["charmed", "charm"] },
  chien_fidele_de_mordenkainen: { mechanic: "summon", operation: "faithful_hound" },
  contact_d_autres_plans: { mechanic: "divination", operation: "contact_other_plane" },
  danse_irresistible_d_otto: { mechanic: "status", operation: "irresistible_dance", status: ["dancing", "incapacitated"] },
  detection_de_l_invisibilite: { mechanic: "detection", operation: "invisibility" },
  dissipation_de_l_epuisement: { mechanic: "status", operation: "remove_exhaustion" },
  doigt_de_mort: { mechanic: "damage", operation: "finger_of_death", damageType: "death" },
  embrasement: { mechanic: "damage", operation: "ignite", damageType: "fire" },
  emprisonnement_de_l_ame: { mechanic: "status", operation: "soul_trap", status: ["imprisoned"] },
  enchevetrement: { mechanic: "status", operation: "entangle", status: ["restrained", "entangled"] },
  escalade_d_araignee: { mechanic: "movement", operation: "spider_climb" },
  flamme: { mechanic: "damage", operation: "flame", damageType: "fire" },
  fleau_d_insectes: { mechanic: "summon", operation: "insect_plague" },
  foudre: { mechanic: "damage", operation: "lightning", damageType: "lightning" },
  globe_d_invulnerabilite: { mechanic: "protection", operation: "globe_of_invulnerability" },
  globe_mineur_d_invulnerabilite: { mechanic: "protection", operation: "minor_globe_of_invulnerability" },
  graines_de_feu: { mechanic: "damage", operation: "fire_seeds", damageType: "fire" },
  guerison_de_la_cecite: { mechanic: "status", operation: "cure_blindness", status: ["blind"] },
  injonction: { mechanic: "status", operation: "command" },
  invisibilite_aux_animaux: { mechanic: "protection", operation: "invisibility_to_animals" },
  invocation_animale_i: { mechanic: "summon", operation: "animal_summoning_1" },
  invocation_animale_ii: { mechanic: "summon", operation: "animal_summoning_2" },
  invocation_animale_iii: { mechanic: "summon", operation: "animal_summoning_3" },
  invocation_d_elemental: { mechanic: "summon", operation: "elemental_summoning" },
  invocation_d_insectes: { mechanic: "summon", operation: "insect_summoning" },
  invocation_d_un_elemental_de_terre: { mechanic: "summon", operation: "earth_elemental" },
  invocation_d_un_elemental_du_feu: { mechanic: "summon", operation: "fire_elemental" },
  invocation_d_un_familier: { mechanic: "summon", operation: "find_familiar" },
  invocation_de_la_foudre: { mechanic: "damage", operation: "call_lightning", damageType: "lightning" },
  invocation_des_creatures_sylvestres: { mechanic: "summon", operation: "woodland_beings" },
  invocation_du_temps: { mechanic: "utility", operation: "weather_summoning" },
  langue: { mechanic: "communication", operation: "tongues" },
  main_d_interposition_de_bigby: { mechanic: "protection", operation: "bigby_interposing_hand" },
  mains_brulantes: { mechanic: "damage", operation: "burning_hands", damageType: "fire" },
  manne: { mechanic: "creation", operation: "create_food_water" },
  mur_d_epines: { mechanic: "terrain", operation: "wall_of_thorns" },
  necromancie: { mechanic: "communication", operation: "speak_with_dead" },
  nuage_puant: { mechanic: "terrain", operation: "stinking_cloud" },
  il_magique: { mechanic: "detection", operation: "arcane_eye" },
  peau_d_ecorce: { mechanic: "protection", operation: "barkskin" },
  perception_des_alignements: { mechanic: "detection", operation: "alignment" },
  peur: { mechanic: "status", operation: "fear", status: ["frightened", "fear"] },
  poigne_electrique: { mechanic: "damage", operation: "shocking_grasp", damageType: "lightning" },
  projectile_magique: { mechanic: "damage", operation: "magic_missile", damageType: "force" },
  protection_d_esprit: { mechanic: "protection", operation: "mind_protection" },
  purification_de_l_eau: { mechanic: "utility", operation: "purify_water" },
  purification_de_l_eau_et_des_aliments: { mechanic: "utility", operation: "purify_food_and_drink" },
  rayon_d_affaiblissement: { mechanic: "status", operation: "ray_of_enfeeblement", status: ["weakened"] },
  retardement_du_poison: { mechanic: "status", operation: "delay_poison" },
  sanctuaire: { mechanic: "protection", operation: "sanctuary" },
  silence_sur_5_metres: { mechanic: "silence", operation: "silence_zone" },
  sommeil: { mechanic: "status", operation: "sleep", status: ["sleeping", "unconscious"] },
  sphere_glaciale_d_otiluke: { mechanic: "damage", operation: "freezing_sphere", damageType: "cold" },
  toile_d_araignee: { mechanic: "terrain", operation: "web" },
  transformation_d_objets: { mechanic: "utility", operation: "polymorph_any_object" }
});

const own = (object, key) => Object.prototype.hasOwnProperty.call(object ?? {}, key);
const clone = value => JSON.parse(JSON.stringify(value));
const text = value => String(value ?? "").trim();
const filled = value => value !== null && value !== undefined && value !== "" && (!Array.isArray(value) || value.length > 0) && (typeof value !== "object" || Array.isArray(value) || Object.keys(value).length > 0);
const pick = (source, keys, fallback = "") => {
  for (const key of keys) if (own(source, key) && filled(source[key])) return clone(source[key]);
  return fallback;
};
const numeric = (value, fallback = 0) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? "").match(/-?\d+(?:[.,]\d+)?/)?.[0]?.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
};
const slug = value => text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, "").toLocaleLowerCase("fr").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
const list = value => {
  if (Array.isArray(value)) return value.flatMap(list);
  if (value === null || value === undefined || value === "") return [];
  if (typeof value === "string") return value.split(/[,;|\n]+/g).map(entry => entry.trim()).filter(Boolean);
  if (typeof value === "object") for (const key of ["spellLists", "lists", "classes", "classe", "class", "liste", "items", "values", "value"]) if (own(value, key)) return list(value[key]);
  return [value];
};
const readJson = file => JSON.parse(fs.readFileSync(file, "utf8"));
const writeJson = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};
const option = (argv, name, fallback) => {
  const position = argv.indexOf(name);
  return position >= 0 && argv[position + 1] ? argv[position + 1] : fallback;
};

function walk(directory) {
  const files = [];
  const visit = current => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) visit(target);
      else if (entry.isFile() && /\.js$/i.test(entry.name)) files.push(target);
    }
  };
  visit(directory);
  return files.sort((a, b) => a.localeCompare(b, "fr"));
}

function extractObjectLiteral(source, marker) {
  const markerPosition = source.indexOf(marker);
  if (markerPosition < 0) return null;
  const start = source.indexOf("{", markerPosition + marker.length);
  if (start < 0) return null;
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === "'" || character === '"' || character === "`") { quote = character; continue; }
    if (character === "{") depth += 1;
    if (character === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  return null;
}

function loadOnUseConfigs() {
  const byClassAndSlug = new Map();
  const bySlug = new Map();
  const loaded = [];
  for (const file of walk(SPELL_SCRIPTS)) {
    const source = fs.readFileSync(file, "utf8");
    const literal = extractObjectLiteral(source, "const ADD2E_SORT_CONFIG =");
    if (!literal) continue;
    let config;
    try {
      config = Function(`"use strict"; return (${literal});`)();
    } catch {
      continue;
    }
    if (!config || typeof config !== "object" || !text(config.name)) continue;
    const basename = path.basename(file, ".js");
    const className = basename.startsWith("magicien-") ? "magicien" : basename.startsWith("clerc-") ? "clerc" : "";
    const configSlug = slug(config.slug || config.name);
    if (!configSlug) continue;
    const entry = { config: clone(config), file: path.relative(ROOT, file).replace(/\\/g, "/"), className };
    bySlug.set(configSlug, entry);
    if (className) byClassAndSlug.set(`${className}:${configSlug}`, entry);
    loaded.push(entry.file);
  }
  return { byClassAndSlug, bySlug, files: [...new Set(loaded)].sort() };
}

function catalogProfile(entry) {
  const profile = { mechanic: text(entry.mechanic) || "manual", operation: text(entry.operation) || slug(entry.slug || entry.name) || "manual_resolution" };
  for (const key of ["vfx", "fx", "color", "target", "duration", "save", "status", "effects", "flags", "itemType", "limits"]) if (own(entry, key)) profile[key] = clone(entry[key]);
  return profile;
}

function configProfile(entry) {
  const config = entry.config;
  const profile = { mechanic: text(config.kind) || "manual", operation: slug(config.slug || config.name) || "manual_resolution" };
  if (filled(config.dice)) profile.dice = clone(config.dice);
  if (Array.isArray(config.modes) && config.modes.length) profile.modes = clone(config.modes);
  return profile;
}

function isGeneratedFallback(profile) {
  return profile?.mechanic === "manual"
    && profile?.operation === "manual_resolution"
    && profile?.target?.min === 0
    && profile?.target?.max === null;
}

function material(raw) {
  if (typeof raw === "string") return text(raw) ? { nom: text(raw), quantite: 1 } : null;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const nom = text(pick(raw, ["nom", "name", "label", "item", "itemName", "component", "composant", "slug"], ""));
  if (!nom) return null;
  const output = { nom, quantite: Math.max(1, Math.floor(numeric(pick(raw, ["quantite", "quantity", "qty", "nombre", "count", "value"], 1), 1))) };
  for (const key of ["consommation", "condition", "reutilisable", "consomme", "alternatives"]) if (own(raw, key) && filled(raw[key])) output[key] = clone(raw[key]);
  return output;
}

function materials(system) {
  const source = pick(system, ALIASES.composants_materiels, []);
  return (Array.isArray(source) ? source : source ? [source] : []).map(material).filter(Boolean);
}

const argv = process.argv.slice(2);
const sourceFile = path.resolve(ROOT, option(argv, "--v4", DEFAULT_V4));
const reportFile = path.resolve(ROOT, option(argv, "--report", DEFAULT_REPORT));
const input = readJson(sourceFile);
const catalogModule = await import(pathToFileURL(path.join(SPELL_SCRIPTS, "add2e-spell-catalog.mjs")).href);
const catalogEntries = catalogModule.ADD2E_SPELL_CATALOG ?? {};
const catalogBySlug = new Map(Object.values(catalogEntries).map(entry => [slug(entry.slug || entry.name), entry]));
const onUse = loadOnUseConfigs();
const audit = { preserved: [], catalog: [], onUseConfig: [], overrides: [], unresolved: [], replacedGeneratedFallback: [] };

function effectProfile(item, system) {
  const current = system.effectProfile;
  const currentIsFallback = own(system, "effectProfile") && isGeneratedFallback(current);
  if (own(system, "effectProfile") && !currentIsFallback) { audit.preserved.push(item.name); return clone(current); }
  const spellSlug = slug(item.name);
  const classSlug = slug(pick(system, ALIASES.classe, ""));
  const catalog = catalogBySlug.get(spellSlug);
  const config = onUse.byClassAndSlug.get(`${classSlug}:${spellSlug}`) ?? onUse.bySlug.get(spellSlug);
  const override = PROFILE_OVERRIDES[spellSlug];
  if (currentIsFallback) audit.replacedGeneratedFallback.push(item.name);
  if (catalog) { audit.catalog.push(item.name); return catalogProfile(catalog); }
  if (config) { audit.onUseConfig.push({ name: item.name, file: config.file }); return configProfile(config); }
  if (override) { audit.overrides.push(item.name); return clone(override); }
  audit.unresolved.push(item.name);
  throw new Error(`${item.name} : effectProfile absent de la source mécanique, du catalogue, des scripts onUse et des surcharges.`);
}

const folders = (input.folders ?? []).map(folder => Object.fromEntries(FOLDER_FIELDS.filter(key => own(folder, key)).map(key => [key, clone(folder[key])])));
const folderIds = new Set(folders.map(folder => folder._id));
const identifiers = new Set();
const items = (input.items ?? []).map(item => {
  if (String(item.type ?? item.system?.type ?? "").toLowerCase() !== "sort") throw new Error(`${item.name ?? "Sans nom"} : item non-sort.`);
  if (!item._id || !text(item.name) || identifiers.has(item._id)) throw new Error(`${item.name ?? "Sans nom"} : identité de sort invalide.`);
  if (item.folder && !folderIds.has(item.folder)) throw new Error(`${item.name} : dossier introuvable.`);
  identifiers.add(item._id);
  const source = item.system ?? {};
  const spellLists = [...new Set(list(pick(source, ["spellLists", "lists", "classes", "classe", "class", "liste"], [])).map(slug).filter(Boolean))];
  if (!spellLists.length) throw new Error(`${item.name} : spellLists absent.`);
  const system = {
    classe: text(pick(source, ALIASES.classe, spellLists[0])),
    spellLists,
    niveau: Math.max(1, Math.floor(numeric(pick(source, ["niveau", "niveau_sort", "spellLevel", "level", "lvl"], 1), 1))),
    ecole: pick(source, ALIASES.ecole, ""),
    portee: pick(source, ALIASES.portee, ""),
    duree: pick(source, ALIASES.duree, ""),
    zone_effet: pick(source, ALIASES.zone_effet, ""),
    cible: pick(source, ALIASES.cible, ""),
    temps_incantation: pick(source, ALIASES.temps_incantation, ""),
    jet_sauvegarde: pick(source, ALIASES.jet_sauvegarde, ""),
    composantes: pick(source, ALIASES.composantes, ""),
    composants_materiels: materials(source),
    effectProfile: effectProfile(item, source),
    description: pick(source, ALIASES.description, ""),
    onUse: pick(source, ALIASES.onUse, "")
  };
  if (JSON.stringify(Object.keys(system).sort()) !== JSON.stringify([...REQUIRED_FIELDS].sort())) throw new Error(`${item.name} : contrat système invalide.`);
  const output = { _id: item._id, name: item.name, type: "sort", img: text(item.img) || "icons/svg/book.svg", folder: item.folder ?? null, sort: Number(item.sort) || 0, system };
  if (item.flags?.add2e && typeof item.flags.add2e === "object") output.flags = { add2e: clone(item.flags.add2e) };
  if (Array.isArray(item.effects) && item.effects.length) output.effects = clone(item.effects);
  return output;
});

const output = { exportVersion: text(input.exportVersion) || "add2e-spells-canonical-v5", system: text(input.system) || "add2e", rootFolder: input.rootFolder ? { id: text(input.rootFolder.id), name: text(input.rootFolder.name) } : null, recursive: true, folders, items };
const outputProfiles = output.items.filter(item => own(item.system, "effectProfile")).length;
if (outputProfiles !== output.items.length) throw new Error(`effectProfile absent : ${outputProfiles}/${output.items.length}.`);
const bytes = value => Buffer.byteLength(`${JSON.stringify(value, null, 2)}\n`, "utf8");
const report = {
  version: "2026-06-29-v4-compact-schema-v7",
  generatedAt: new Date().toISOString(),
  source: path.relative(ROOT, sourceFile).replace(/\\/g, "/"),
  contract: { itemFields: ITEM_FIELDS, folderFields: FOLDER_FIELDS, systemFields: REQUIRED_FIELDS, effectProfile: "obligatoire sur chaque sort" },
  summary: { spells: items.length, folders: folders.length, inputBytes: fs.statSync(sourceFile).size, outputBytes: bytes(output), effectProfiles: outputProfiles },
  effectProfiles: audit,
  onUseConfigFiles: onUse.files,
  conclusion: "Chaque sort possède un effectProfile explicite issu du JSON, du catalogue, d'un script onUse ou d'une surcharge nommée. Aucun profil manuel générique n'est admis."
};
report.summary.bytesRemoved = report.summary.inputBytes - report.summary.outputBytes;
writeJson(reportFile, report);
if (argv.includes("--write")) writeJson(sourceFile, output);
console.log(`[ADD2E][V4_COMPACT] ${items.length} sorts ; effectProfile ${outputProfiles}/${items.length}.`);
console.log(`[ADD2E][V4_COMPACT] profils : ${audit.preserved.length} conservés, ${audit.catalog.length} catalogue, ${audit.onUseConfig.length} onUse, ${audit.overrides.length} surcharges, ${audit.unresolved.length} non résolus.`);
