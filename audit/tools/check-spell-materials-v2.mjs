import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");
const file = path.resolve(repoRoot, process.argv[2] || "fvtt-spells-all-normalise-mecanique-v2.json");
const names = process.argv.slice(3);
const watched = names.length ? names : [
  "Augure",
  "Résistance au froid",
  "Retardement du Poison",
  "Paralysie",
  "Protection contre le mal",
  "Sanctuaire",
  "Résistance au feu"
];

function getItems(json) {
  if (Array.isArray(json)) return json;
  for (const key of ["items", "Item", "Items", "documents", "data", "entries"]) if (Array.isArray(json?.[key])) return json[key];
  return [];
}

function norm(value) {
  return String(value ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

if (!fs.existsSync(file)) throw new Error(`Fichier introuvable : ${file}`);

const json = JSON.parse(fs.readFileSync(file, "utf8"));
const items = getItems(json).filter(item => String(item?.type ?? item?.system?.type ?? "") === "sort");

for (const wanted of watched) {
  const found = items.find(item => norm(item.name) === norm(wanted) || norm(item.system?.nom) === norm(wanted));
  if (!found) {
    console.log(`\n[ABSENT] ${wanted}`);
    continue;
  }
  console.log(`\n${found.name}`);
  console.log(`  Classe/Niveau : ${found.system?.classe ?? "?"} ${found.system?.niveau ?? "?"}`);
  console.log(`  Composants    : ${Array.isArray(found.system?.composants_materiels) ? found.system.composants_materiels.join(", ") : found.system?.composants_materiels}`);
  console.log(`  Source        : ${found.system?.composants_materiels_source ?? ""}`);
  console.log(`  Référence     : ${found.system?.composants_materiels_reference ?? ""}`);
  console.log(`  Note          : ${String(found.system?.composants_materiels_note ?? "").replace(/\n/g, " | ")}`);
}
