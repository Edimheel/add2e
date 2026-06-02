import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");
const referenceDir = path.join(repoRoot, "audit/reference");

const forbiddenDescriptionFields = [
  "description_exacte_manuel",
  "description_source",
  "description_reelle",
  "description_texte",
  "description_html",
  "description_resumee_regles"
];

const requiredSpellFields = [
  "ordre",
  "nom",
  "ecole",
  "niveau",
  "portee",
  "duree",
  "zone_effet",
  "composantes",
  "temps_incantation",
  "jet_sauvegarde",
  "description",
  "status"
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function validateSpell(file, index, spell, errors, warnings) {
  const label = `${file} > spells[${index}] ${spell?.nom ?? "sans_nom"}`;

  for (const field of forbiddenDescriptionFields) {
    if (Object.prototype.hasOwnProperty.call(spell, field)) {
      errors.push(`${label}: champ interdit ${field}`);
    }
  }

  for (const field of requiredSpellFields) {
    if (!Object.prototype.hasOwnProperty.call(spell, field)) {
      errors.push(`${label}: champ requis manquant ${field}`);
    }
  }

  if (typeof spell.description !== "string") {
    errors.push(`${label}: description doit etre une chaine`);
  } else if (!spell.description.trim()) {
    warnings.push(`${label}: description vide ou a importer`);
  }

  if (typeof spell.description === "string" && /\n/.test(spell.description)) {
    errors.push(`${label}: description non normalisee, retours ligne interdits`);
  }
}

function main() {
  if (!fs.existsSync(referenceDir)) throw new Error(`Reference dir missing: ${referenceDir}`);

  const files = fs.readdirSync(referenceDir)
    .filter((file) => /^manuel-joueurs-.*\.json$/.test(file))
    .filter((file) => file !== "manuel-joueurs-sorts-master.json")
    .sort((a, b) => a.localeCompare(b, "fr"));

  const errors = [];
  const warnings = [];

  for (const file of files) {
    const data = readJson(path.join(referenceDir, file));
    if (!Array.isArray(data.spells)) {
      errors.push(`${file}: spells doit etre un tableau`);
      continue;
    }
    data.spells.forEach((spell, index) => validateSpell(file, index, spell, errors, warnings));
  }

  for (const warning of warnings) console.warn(`[WARN] ${warning}`);
  if (errors.length) {
    for (const error of errors) console.error(`[ERROR] ${error}`);
    process.exit(1);
  }
  console.log(`References validees: ${files.length}`);
  console.log(`Avertissements: ${warnings.length}`);
}

main();
