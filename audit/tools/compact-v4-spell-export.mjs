import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DEFAULT_V4 = "fvtt-spells-all-normalise-mecanique-v4.json";
const DEFAULT_REPORT = "audit/rapports/AUDIT-V4-SCHEMA-UTILISATION.json";
const SYSTEM_FIELDS = Object.freeze([
  "nom", "classe", "spellLists", "niveau", "ecole", "portee", "duree", "zone_effet", "cible",
  "temps_incantation", "jet_sauvegarde", "composantes", "composants_materiels",
  "effectProfile", "description", "onUse"
]);
const FIELD_ALIASES = Object.freeze({
  nom: ["nom", "name"],
  classe: ["classe", "class", "liste"],
  ecole: ["ecole", "école", "school"],
  portee: ["portee", "portée", "range"],
  duree: ["duree", "durée", "duration"],
  zone_effet: ["zone_effet", "zoneEffet", "area", "areaOfEffect"],
  cible: ["cible", "target", "targets"],
  temps_incantation: ["temps_incantation", "tempsIncantation", "castingTime", "casting_time"],
  jet_sauvegarde: ["jet_sauvegarde", "jetSauvegarde", "savingThrow", "saving_throw"],
  composantes: ["composantes", "components", "componentes", "composants"],
  composants_materiels: ["composants_materiels", "composantsMateriels", "materialComponents", "material_components"],
  description: ["description", "description_reelle", "description_texte", "description_html"],
  onUse: ["onUse", "onuse", "on_use"]
});

const own = (object, key) => Object.prototype.hasOwnProperty.call(object ?? {}, key);
const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const text = value => String(value ?? "").trim();
const filled = value => value !== null && value !== undefined && value !== "" && (!Array.isArray(value) || value.length > 0);
const slug = value => text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
const pick = (source, keys, fallback = "") => {
  for (const key of keys) if (own(source, key) && filled(source[key])) return clone(source[key]);
  return fallback;
};
const numeric = (value, fallback = 1) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? "").match(/\d+/)?.[0]);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const list = value => {
  if (Array.isArray(value)) return value.flatMap(list);
  if (value === null || value === undefined || value === "") return [];
  if (typeof value === "string") return value.split(/[,;|\n]+/).map(text).filter(Boolean);
  if (typeof value === "object") {
    for (const key of ["spellLists", "lists", "classes", "classe", "class", "liste", "items", "values", "value"]) if (own(value, key)) return list(value[key]);
  }
  return [value];
};
const option = (argv, name, fallback) => {
  const position = argv.indexOf(name);
  return position >= 0 && argv[position + 1] ? argv[position + 1] : fallback;
};
const readJson = file => JSON.parse(fs.readFileSync(file, "utf8"));
const writeJson = (file, data) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
};

const argv = process.argv.slice(2);
const sourceFile = path.resolve(ROOT, option(argv, "--v4", DEFAULT_V4));
const reportFile = path.resolve(ROOT, option(argv, "--report", DEFAULT_REPORT));
const input = readJson(sourceFile);
const folders = (input.folders ?? []).map(folder => ({
  _id: folder._id,
  name: folder.name,
  type: folder.type,
  folder: folder.folder ?? null,
  sorting: folder.sorting,
  sort: folder.sort,
  color: folder.color ?? null
}));
const folderIds = new Set(folders.map(folder => folder._id));
const ids = new Set();
const restoredNames = [];

const items = (input.items ?? []).map(item => {
  if (item.type !== "sort") throw new Error(`${item.name ?? "Sans nom"} : item non-sort.`);
  if (!text(item._id) || !text(item.name) || ids.has(item._id)) throw new Error(`${item.name ?? "Sans nom"} : identifiant de sort invalide.`);
  if (item.folder && !folderIds.has(item.folder)) throw new Error(`${item.name} : dossier introuvable.`);
  ids.add(item._id);

  const source = item.system ?? {};
  const spellLists = [...new Set(list(pick(source, ["spellLists", "lists", "classes", "classe", "class", "liste"], [])).map(slug).filter(Boolean))];
  if (!spellLists.length) throw new Error(`${item.name} : spellLists absent.`);
  if (!own(source, "effectProfile") || !source.effectProfile || typeof source.effectProfile !== "object") throw new Error(`${item.name} : effectProfile absent.`);

  const canonicalName = text(pick(source, FIELD_ALIASES.nom, item.name)) || item.name;
  if (!own(source, "nom")) restoredNames.push(item.name);
  const system = {
    nom: canonicalName,
    classe: text(pick(source, FIELD_ALIASES.classe, spellLists[0])) || spellLists[0],
    spellLists,
    niveau: Math.max(1, Math.floor(numeric(pick(source, ["niveau", "niveau_sort", "spellLevel", "level", "lvl"], 1), 1))),
    ecole: pick(source, FIELD_ALIASES.ecole, ""),
    portee: pick(source, FIELD_ALIASES.portee, ""),
    duree: pick(source, FIELD_ALIASES.duree, ""),
    zone_effet: pick(source, FIELD_ALIASES.zone_effet, ""),
    cible: pick(source, FIELD_ALIASES.cible, ""),
    temps_incantation: pick(source, FIELD_ALIASES.temps_incantation, ""),
    jet_sauvegarde: pick(source, FIELD_ALIASES.jet_sauvegarde, ""),
    composantes: pick(source, FIELD_ALIASES.composantes, ""),
    composants_materiels: Array.isArray(pick(source, FIELD_ALIASES.composants_materiels, [])) ? pick(source, FIELD_ALIASES.composants_materiels, []) : [],
    effectProfile: clone(source.effectProfile),
    description: pick(source, FIELD_ALIASES.description, ""),
    onUse: pick(source, FIELD_ALIASES.onUse, "")
  };
  const missing = SYSTEM_FIELDS.filter(field => !own(system, field));
  if (missing.length || !text(system.nom) || !Number.isFinite(system.niveau) || !system.spellLists.length) throw new Error(`${item.name} : contrat canonique invalide (${missing.join(", ")}).`);

  const output = {
    _id: item._id,
    name: item.name,
    type: "sort",
    img: text(item.img) || "icons/svg/book.svg",
    folder: item.folder ?? null,
    sort: Number(item.sort) || 0,
    system
  };
  if (item.flags?.add2e && typeof item.flags.add2e === "object") output.flags = { add2e: clone(item.flags.add2e) };
  if (Array.isArray(item.effects) && item.effects.length) output.effects = clone(item.effects);
  return output;
});

const output = {
  exportVersion: input.exportVersion,
  system: input.system,
  rootFolder: input.rootFolder ? { id: input.rootFolder.id, name: input.rootFolder.name } : null,
  recursive: true,
  folders,
  items
};
const profiles = output.items.filter(item => own(item.system, "effectProfile")).length;
const invalid = output.items.filter(item => !text(item.system.nom) || !Number.isFinite(item.system.niveau) || !item.system.spellLists.length);
if (invalid.length) throw new Error(`Sorts canoniques incomplets : ${invalid.map(item => item.name).join(", ")}`);
const report = {
  version: "2026-06-29-v4-compact-schema-v8",
  source: path.relative(ROOT, sourceFile).replace(/\\/g, "/"),
  summary: {
    spells: output.items.length,
    folders: folders.length,
    effectProfiles: profiles,
    restoredSystemNom: restoredNames.length,
    inputBytes: fs.statSync(sourceFile).size,
    outputBytes: Buffer.byteLength(`${JSON.stringify(output, null, 2)}\n`, "utf8")
  },
  contract: { systemFields: SYSTEM_FIELDS, importMinimum: ["nom", "niveau", "spellLists"] },
  restoredSystemNom: restoredNames,
  conclusion: "Chaque sort conserve un effectProfile et possède les champs canoniques requis par l'importeur : nom, niveau et spellLists."
};
report.summary.bytesRemoved = report.summary.inputBytes - report.summary.outputBytes;
writeJson(reportFile, report);
if (argv.includes("--write")) writeJson(sourceFile, output);
console.log(`[ADD2E][V4_COMPACT] ${items.length} sorts ; effectProfile ${profiles}/${items.length} ; system.nom restauré ${restoredNames.length}.`);
