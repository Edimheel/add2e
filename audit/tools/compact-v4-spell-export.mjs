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
const audit = { preserved: [], catalog: [], onUseConfig: [], manualFallback: [], replacedGeneratedFallback: [] };

function effectProfile(item, system) {
  const current = system.effectProfile;
  const currentIsFallback = own(system, "effectProfile") && isGeneratedFallback(current);
  if (own(system, "effectProfile") && !currentIsFallback) { audit.preserved.push(item.name); return clone(current); }
  const spellSlug = slug(item.name);
  const classSlug = slug(pick(system, ALIASES.classe, ""));
  const catalog = catalogBySlug.get(spellSlug);
  const config = onUse.byClassAndSlug.get(`${classSlug}:${spellSlug}`) ?? onUse.bySlug.get(spellSlug);
  if (currentIsFallback) audit.replacedGeneratedFallback.push(item.name);
  if (catalog) { audit.catalog.push(item.name); return catalogProfile(catalog); }
  if (config) { audit.onUseConfig.push({ name: item.name, file: config.file }); return configProfile(config); }
  audit.manualFallback.push(item.name);
  return { mechanic: "manual", operation: "manual_resolution", target: { min: 0, max: null } };
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
  version: "2026-06-29-v4-compact-schema-v6",
  generatedAt: new Date().toISOString(),
  source: path.relative(ROOT, sourceFile).replace(/\\/g, "/"),
  contract: { itemFields: ITEM_FIELDS, folderFields: FOLDER_FIELDS, systemFields: REQUIRED_FIELDS, effectProfile: "obligatoire sur chaque sort" },
  summary: { spells: items.length, folders: folders.length, inputBytes: fs.statSync(sourceFile).size, outputBytes: bytes(output), effectProfiles: outputProfiles },
  effectProfiles: audit,
  onUseConfigFiles: onUse.files,
  conclusion: "Chaque sort possède un effectProfile. Les profils déclaratifs et onUse sont dérivés des sources mécaniques ; le profil manuel n'est utilisé qu'en dernier recours."
};
report.summary.bytesRemoved = report.summary.inputBytes - report.summary.outputBytes;
writeJson(reportFile, report);
if (argv.includes("--write")) writeJson(sourceFile, output);
console.log(`[ADD2E][V4_COMPACT] ${items.length} sorts ; effectProfile ${outputProfiles}/${items.length}.`);
console.log(`[ADD2E][V4_COMPACT] profils : ${audit.preserved.length} conservés, ${audit.catalog.length} catalogue, ${audit.onUseConfig.length} onUse, ${audit.manualFallback.length} manuel.`);
