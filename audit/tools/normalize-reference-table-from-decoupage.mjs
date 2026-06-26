import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PLACEHOLDERS = new Set(["", "a_completer", "a_remplir", "a_renseigner", "todo", "tbd", "inconnu", "non_renseigne", "non_disponible"]);
const TECHNICAL_FIELDS = ["ecole", "portee", "duree", "zone_effet", "composantes", "temps_incantation", "jet_sauvegarde"];

function parseArgs(argv) {
  const options = { reference: null, decoupage: null, write: false, includeDescriptions: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = argv[index + 1];
    if (arg === "--reference" && value) { options.reference = value; index += 1; }
    else if (arg === "--decoupage" && value) { options.decoupage = value; index += 1; }
    else if (arg === "--write") options.write = true;
    else if (arg === "--include-descriptions") options.includeDescriptions = true;
    else if (arg === "--help" || arg === "-h") {
      console.log("Usage: node audit/tools/normalize-reference-table-from-decoupage.mjs --reference audit/reference/manuel-joueurs-magicien-niveau-4.json [--decoupage audit/decoupage_fichier/magicien-niveau-4.json] [--include-descriptions] [--write]");
      process.exit(0);
    } else throw new Error(`Argument inconnu ou incomplet : ${arg}`);
  }
  if (!options.reference) throw new Error("--reference est obligatoire.");
  return options;
}

function readJson(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }
function writeJson(file, value) { fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8"); }
function text(value) { return String(value ?? "").replace(/\s+/g, " ").trim(); }
function slug(value) {
  return text(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .toLocaleLowerCase("fr")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
function isPlaceholder(value) { return PLACEHOLDERS.has(slug(value)); }
function collection(document) {
  if (Array.isArray(document)) return document;
  for (const key of ["items", "Item", "Items", "documents", "data", "entries"]) if (Array.isArray(document?.[key])) return document[key];
  return null;
}
function scalar(value) {
  if (value == null) return "";
  if (typeof value === "object") return text(value.valeur ?? value.value ?? value.texte ?? "");
  return text(value);
}
function spellKey(className, level, name) {
  const numericLevel = Number(String(level ?? "").match(/\d+/)?.[0] ?? 0);
  const classKey = slug(className);
  const nameKey = slug(name);
  return classKey && numericLevel > 0 && nameKey ? `${classKey}|${numericLevel}|${nameKey}` : null;
}
function sourceField(system, field) {
  if (field === "ecole") return scalar(system.ecole ?? system["école"]);
  if (field === "portee") return scalar(system.portee ?? system["portée"]);
  if (field === "duree") return scalar(system.duree ?? system["durée"]);
  return scalar(system[field]);
}
function sourceDescription(system) {
  return text(String(system.description_reelle ?? system.description ?? "")
    .replace(/<\s*br\s*\/?>/gi, " ")
    .replace(/<\s*\/\s*p\s*>/gi, " ")
    .replace(/<[^>]*>/g, " "));
}
function makeSourceIndex(document) {
  const items = collection(document);
  if (!items) throw new Error("Le découpage ne contient pas de collection d'items.");
  const index = new Map();
  const duplicates = [];
  for (const item of items) {
    if (String(item?.type ?? "").toLowerCase() !== "sort") continue;
    const system = item.system ?? {};
    const key = spellKey(system.classe, system.niveau, item.name ?? system.nom);
    if (!key) continue;
    const row = {
      nom: text(item.name ?? system.nom),
      classe: text(system.classe),
      niveau: Number(String(system.niveau ?? "").match(/\d+/)?.[0] ?? 0),
      fields: Object.fromEntries(TECHNICAL_FIELDS.map(field => [field, sourceField(system, field)])),
      description: sourceDescription(system)
    };
    if (index.has(key)) duplicates.push(key);
    else index.set(key, row);
  }
  if (duplicates.length) throw new Error(`Doublons dans le découpage : ${[...new Set(duplicates)].join(", ")}`);
  return index;
}
function ensureReferenceSpell(spell, sourceClass, sourceLevel, index) {
  const key = spellKey(sourceClass, spell?.niveau ?? sourceLevel, spell?.nom);
  if (!key) throw new Error(`Entrée de référence invalide : ${JSON.stringify(spell)}`);
  const source = index.get(key);
  if (!source) throw new Error(`Sort de référence introuvable dans le découpage : ${spell.nom} (${sourceClass} niveau ${spell.niveau ?? sourceLevel}).`);
  return source;
}
function setIfMissing(target, field, value, changes) {
  if (Object.prototype.hasOwnProperty.call(target, field) && !isPlaceholder(target[field])) return;
  if (!value) throw new Error(`Valeur source manquante pour ${target.nom} > ${field}.`);
  target[field] = value;
  changes.push(field);
}
function main() {
  const options = parseArgs(process.argv.slice(2));
  const referencePath = path.resolve(ROOT, options.reference);
  const reference = readJson(referencePath);
  if (!Array.isArray(reference?.spells)) throw new Error(`Référence invalide : ${options.reference}`);
  const decoupageRelative = options.decoupage ?? reference.foundryExport;
  if (!decoupageRelative) throw new Error("Le découpage doit être fourni par --decoupage ou reference.foundryExport.");
  const decoupagePath = path.resolve(ROOT, decoupageRelative);
  const index = makeSourceIndex(readJson(decoupagePath));
  const sourceClass = text(reference?.source?.classe);
  const sourceLevel = Number(reference?.source?.niveau ?? 0);
  if (!sourceClass || !sourceLevel) throw new Error("La référence doit fournir source.classe et source.niveau.");
  const allChanges = [];
  for (const spell of reference.spells) {
    const source = ensureReferenceSpell(spell, sourceClass, sourceLevel, index);
    const changes = [];
    for (const field of TECHNICAL_FIELDS) setIfMissing(spell, field, source.fields[field], changes);
    if (!Object.prototype.hasOwnProperty.call(spell, "description")) {
      spell.description = options.includeDescriptions ? source.description : "";
      changes.push("description");
    } else if (options.includeDescriptions && isPlaceholder(spell.description)) {
      if (!source.description) throw new Error(`Description source manquante pour ${spell.nom}.`);
      spell.description = source.description;
      changes.push("description");
    }
    if (!Object.prototype.hasOwnProperty.call(spell, "status")) {
      spell.status = "nom_reference_tableau_manuel_joueurs";
      changes.push("status");
    }
    allChanges.push({ nom: spell.nom, changes });
  }
  const changed = allChanges.filter(entry => entry.changes.length);
  console.log(`[ADD2E][REFERENCE_NORMALIZER] ${reference.spells.length} sort(s) vérifié(s), ${changed.length} entrée(s) modifiée(s).`);
  for (const entry of changed) console.log(`[ADD2E][REFERENCE_NORMALIZER] ${entry.nom}: ${entry.changes.join(", ")}`);
  if (!options.write) {
    console.log("[ADD2E][REFERENCE_NORMALIZER] Dry-run : aucun fichier écrit. Ajoute --write pour appliquer.");
    return;
  }
  writeJson(referencePath, reference);
  console.log(`[ADD2E][REFERENCE_NORMALIZER] Référence mise à jour : ${path.relative(ROOT, referencePath)}`);
}

main();
