import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DEFAULT_V4 = "fvtt-spells-all-normalise-mecanique-v4.json";
const DEFAULT_REPORT = "audit/rapports/AUDIT-V4-SCHEMA-UTILISATION.json";
const SCRIPT_ROOT = "scripts";

// Contrat compact réellement nécessaire aux sorts de compendium.
// Les aliases historiques restent lus par les scripts pour les anciens Items,
// mais ne sont plus écrits dans V4.
const SPELL_SYSTEM_FIELDS = Object.freeze([
  "classe", "spellLists", "niveau", "ecole", "portee", "duree", "zone_effet",
  "cible", "temps_incantation", "jet_sauvegarde", "composantes",
  "composants_materiels", "description", "onUse"
]);

const TEXT_FIELD_ALIASES = Object.freeze({
  classe: ["classe", "class", "liste"],
  ecole: ["ecole", "école", "school"],
  portee: ["portee", "portée", "range"],
  duree: ["duree", "durée", "duration"],
  zone_effet: ["zone_effet", "zoneEffet", "area", "areaOfEffect"],
  cible: ["cible", "target", "targets"],
  temps_incantation: ["temps_incantation", "tempsIncantation", "castingTime", "casting_time"],
  jet_sauvegarde: ["jet_sauvegarde", "jetSauvegarde", "savingThrow", "saving_throw"],
  composantes: ["composantes", "components", "componentes", "composants"],
  description: ["description", "description_reelle", "description_texte", "description_html"],
  onUse: ["onUse", "onuse", "on_use"]
});

const ROOT_ITEM_FIELDS = new Set(["_id", "name", "type", "img", "folder", "sort", "system", "flags", "effects"]);
const ROOT_FOLDER_FIELDS = new Set(["_id", "name", "type", "folder", "sorting", "sort", "color"]);
const KEEP_ADD2E_FLAGS = new Set(["reversible", "variant", "variants"]);

function parseArgs(argv) {
  const valueAfter = name => {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] : null;
  };
  return {
    write: argv.includes("--write"),
    v4: valueAfter("--v4") || DEFAULT_V4,
    report: valueAfter("--report") || DEFAULT_REPORT
  };
}

function readJson(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function own(object, key) { return Object.prototype.hasOwnProperty.call(object ?? {}, key); }
function text(value) { return String(value ?? "").trim(); }
function slug(value) {
  return text(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .toLocaleLowerCase("fr")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
function number(value, fallback = 0) {
  const parsed = Number(String(value ?? "").match(/-?\d+(?:[.,]\d+)?/)?.[0]?.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}
function isSpell(item) { return String(item?.type ?? item?.system?.type ?? "").toLowerCase() === "sort"; }

function first(source, aliases, fallback = "") {
  for (const key of aliases) {
    if (own(source, key) && source[key] !== undefined && source[key] !== null) return source[key];
  }
  return fallback;
}

function asArray(value) {
  if (Array.isArray(value)) return value.flatMap(asArray);
  if (value === null || value === undefined || value === "") return [];
  if (typeof value === "string") return value.split(/[,;|\n]+/g).map(entry => entry.trim()).filter(Boolean);
  if (typeof value === "object") {
    for (const key of ["spellLists", "lists", "classes", "classe", "class", "liste", "items", "values", "value"]) {
      if (own(value, key)) return asArray(value[key]);
    }
  }
  return [value];
}

function canonicalSpellLists(system) {
  const values = asArray(first(system, ["spellLists", "lists", "classes", "classe", "class", "liste"], []));
  return [...new Set(values.map(slug).filter(Boolean))];
}

function canonicalMaterial(value) {
  if (typeof value === "string") {
    const nom = text(value);
    return nom ? { nom, quantite: 1 } : null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const nom = text(first(value, ["nom", "name", "label", "item", "itemName", "component", "composant", "slug"]));
  if (!nom) return null;

  const result = { nom, quantite: Math.max(1, Math.floor(number(first(value, ["quantite", "quantity", "qty", "nombre", "count", "value"], 1), 1))) };
  const consommation = text(first(value, ["consommation", "consumption"]));
  const condition = text(first(value, ["condition", "conditions", "note", "notes"]));
  const reutilisable = first(value, ["reutilisable", "réutilisable", "reusable"], null);
  const consomme = first(value, ["consomme", "consume", "consumable", "estConsommable"], null);

  if (consommation) result.consommation = consommation;
  if (condition) result.condition = condition;
  if (reutilisable !== null && reutilisable !== "") result.reutilisable = reutilisable === true || /^(true|1|oui|yes|on)$/i.test(String(reutilisable));
  if (consomme !== null && consomme !== "") result.consomme = consomme === true || /^(true|1|oui|yes|on)$/i.test(String(consomme));

  const alternatives = first(value, ["alternatives", "options", "choix", "auChoix", "or"], null);
  if (alternatives) {
    const compactAlternatives = asArray(alternatives).map(canonicalMaterial).filter(Boolean);
    if (compactAlternatives.length) result.alternatives = compactAlternatives;
  }
  return result;
}

function canonicalMaterials(system) {
  const source = first(system, ["composants_materiels", "materials", "materialComponents", "composants_materiels_objets"], []);
  const entries = Array.isArray(source) ? source : source ? [source] : [];
  return entries.map(canonicalMaterial).filter(Boolean);
}

function compactFlags(item) {
  const source = item?.flags?.add2e;
  if (!source || typeof source !== "object") return {};
  const add2e = {};
  for (const key of KEEP_ADD2E_FLAGS) if (own(source, key)) add2e[key === "variants" ? "variant" : key] = clone(source[key]);
  return Object.keys(add2e).length ? { add2e } : {};
}

function canonicalSystem(item) {
  const source = item?.system ?? {};
  const spellLists = canonicalSpellLists(source);
  const classe = text(first(source, TEXT_FIELD_ALIASES.classe, spellLists[0] ?? ""));
  const result = {
    classe,
    spellLists,
    niveau: Math.max(0, Math.floor(number(first(source, ["niveau", "niveau_sort", "spellLevel", "level", "lvl"], 0), 0))),
    ecole: text(first(source, TEXT_FIELD_ALIASES.ecole)),
    portee: text(first(source, TEXT_FIELD_ALIASES.portee)),
    duree: text(first(source, TEXT_FIELD_ALIASES.duree)),
    zone_effet: text(first(source, TEXT_FIELD_ALIASES.zone_effet)),
    cible: text(first(source, TEXT_FIELD_ALIASES.cible)),
    temps_incantation: text(first(source, TEXT_FIELD_ALIASES.temps_incantation)),
    jet_sauvegarde: text(first(source, TEXT_FIELD_ALIASES.jet_sauvegarde)),
    composantes: text(first(source, TEXT_FIELD_ALIASES.composantes)),
    composants_materiels: canonicalMaterials(source),
    description: text(first(source, TEXT_FIELD_ALIASES.description)),
    onUse: text(first(source, TEXT_FIELD_ALIASES.onUse))
  };
  return result;
}

function compactFolder(folder) {
  const output = {};
  for (const key of ROOT_FOLDER_FIELDS) if (own(folder, key)) output[key] = clone(folder[key]);
  if (!text(output._id) || !text(output.name) || !text(output.type)) throw new Error("Dossier de sort invalide : _id, name et type sont obligatoires.");
  return output;
}

function compactItem(item) {
  if (!isSpell(item)) throw new Error(`Item non-sort rencontré : ${text(item?.name) || "sans nom"}.`);
  const name = text(item?.name ?? item?.system?.nom);
  if (!name) throw new Error("Sort sans nom.");
  const output = {
    _id: text(item?._id ?? item?.id),
    name,
    type: "sort",
    img: text(item?.img) || "icons/svg/book.svg",
    folder: item?.folder ?? null,
    sort: Number.isFinite(Number(item?.sort)) ? Number(item.sort) : 0,
    system: canonicalSystem(item)
  };
  if (!output._id) throw new Error(`Sort sans _id : ${name}.`);
  const flags = compactFlags(item);
  if (Object.keys(flags).length) output.flags = flags;
  if (Array.isArray(item?.effects) && item.effects.length) output.effects = clone(item.effects);
  return output;
}

function compactDocument(source) {
  if (!Array.isArray(source?.items)) throw new Error("V4 invalide : tableau items absent.");
  const folders = (Array.isArray(source?.folders) ? source.folders : []).map(compactFolder);
  const folderIds = new Set(folders.map(folder => folder._id));
  const items = source.items.map(compactItem);
  const ids = new Set();
  for (const item of items) {
    if (ids.has(item._id)) throw new Error(`_id de sort dupliqué : ${item._id}.`);
    ids.add(item._id);
    if (item.folder && !folderIds.has(item.folder)) throw new Error(`${item.name} référence le dossier absent ${item.folder}.`);
  }
  const rootFolder = source?.rootFolder && typeof source.rootFolder === "object"
    ? { id: text(source.rootFolder.id), name: text(source.rootFolder.name) }
    : null;
  return {
    exportVersion: text(source?.exportVersion) || "add2e-spells-canonical-v5",
    system: text(source?.system) || "add2e",
    rootFolder,
    recursive: true,
    folders,
    items
  };
}

function walk(directory) {
  const files = [];
  const visit = current => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile() && /\.(?:mjs|js)$/i.test(entry.name)) files.push(full);
    }
  };
  visit(directory);
  return files.sort((left, right) => left.localeCompare(right, "fr"));
}

function scanScriptFields(directory) {
  const fields = new Map();
  const add = (field, file) => {
    const files = fields.get(field) ?? new Set();
    files.add(path.relative(ROOT, file).replace(/\\/g, "/"));
    fields.set(field, files);
  };
  const files = walk(directory);
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    for (const regex of [/(?:\bsystem|\bsys)\s*\?*\.\s*([A-Za-z_$][\w$]*)/g, /(?:\bsystem|\bsys)\s*\[\s*["']([^"']+)["']\s*\]/g]) {
      for (const match of source.matchAll(regex)) add(match[1], file);
    }
  }
  return { files: files.map(file => path.relative(ROOT, file).replace(/\\/g, "/")), fields };
}

function countSystemKeys(items) {
  const counts = new Map();
  for (const item of items ?? []) {
    for (const key of Object.keys(item?.system ?? {})) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => left.localeCompare(right, "fr")));
}

function sizeOf(file) { return fs.statSync(file).size; }

function audit(source, compact, scriptScan, file) {
  const directSystemReads = Object.fromEntries([...scriptScan.fields.entries()]
    .map(([field, files]) => [field, [...files].sort()])
    .sort(([left], [right]) => left.localeCompare(right, "fr")));
  const retainedReads = Object.fromEntries(SPELL_SYSTEM_FIELDS.map(field => [field, directSystemReads[field] ?? []]));
  const legacyReads = Object.fromEntries(Object.entries(directSystemReads).filter(([field]) => !SPELL_SYSTEM_FIELDS.includes(field)));
  return {
    version: "2026-06-29-v4-compact-schema-v1",
    generatedAt: new Date().toISOString(),
    source: path.relative(ROOT, file).replace(/\\/g, "/"),
    scannedScripts: scriptScan.files,
    contract: {
      rootItemFields: [...ROOT_ITEM_FIELDS].sort(),
      rootFolderFields: [...ROOT_FOLDER_FIELDS].sort(),
      systemFields: SPELL_SYSTEM_FIELDS,
      retainedAdd2eFlags: [...KEEP_ADD2E_FLAGS].sort(),
      rule: "Les lectures hors contrat sont des aliases de compatibilité ou concernent d'autres types d'Item ; elles ne sont pas réécrites dans V4."
    },
    summary: {
      spells: compact.items.length,
      folders: compact.folders.length,
      inputBytes: sizeOf(file),
      outputBytes: Buffer.byteLength(`${JSON.stringify(compact, null, 2)}\n`, "utf8"),
      inputSystemKeys: countSystemKeys(source.items),
      outputSystemKeys: countSystemKeys(compact.items)
    },
    directSystemReads,
    retainedFieldReaders: retainedReads,
    legacyOrNonSpellFieldReaders: legacyReads
  };
}

function verify(compact) {
  for (const item of compact.items) {
    const actual = Object.keys(item.system).sort();
    const expected = [...SPELL_SYSTEM_FIELDS].sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${item.name} : contrat system incomplet ou enrichi.`);
    if (!item.system.spellLists.length) throw new Error(`${item.name} : spellLists vide.`);
    if (item.system.niveau < 1) throw new Error(`${item.name} : niveau invalide.`);
    for (const field of ["reversible", "inverse", "variantes", "inverseNameStatus", "description_reelle", "nom", "type", "tags", "effectTags"]) {
      if (own(item.system, field)) throw new Error(`${item.name} : champ historique interdit conservé (${field}).`);
    }
  }
}

const options = parseArgs(process.argv.slice(2));
const file = path.resolve(ROOT, options.v4);
const source = readJson(file);
const compact = compactDocument(source);
verify(compact);
const scriptScan = scanScriptFields(path.resolve(ROOT, SCRIPT_ROOT));
const report = audit(source, compact, scriptScan, file);
writeJson(path.resolve(ROOT, options.report), report);

if (options.write) {
  writeJson(file, compact);
  console.log(`[ADD2E][V4_COMPACT] V4 compactée : ${compact.items.length} sorts, ${report.summary.inputBytes} → ${report.summary.outputBytes} octets.`);
} else {
  console.log(`[ADD2E][V4_COMPACT] Simulation : ${compact.items.length} sorts, ${report.summary.inputBytes} → ${report.summary.outputBytes} octets. Ajoute --write pour remplacer V4.`);
}
console.log(`[ADD2E][V4_COMPACT] Audit écrit : ${path.relative(ROOT, options.report)}.`);
