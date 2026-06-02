import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");
const referenceDir = path.join(repoRoot, "audit/reference");
const defaultInputPath = path.join(repoRoot, "audit/source/reference-descriptions.json");

const forbiddenDescriptionFields = [
  "description_exacte_manuel",
  "description_source",
  "description_reelle",
  "description_texte",
  "description_html",
  "description_resumee_regles"
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function normalizeDescription(text) {
  return String(text ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/-\n(?=\p{Ll})/gu, "")
    .replace(/\n+/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([«(])\s+/g, "$1")
    .replace(/\s+([»)])/g, "$1")
    .trim();
}

function getDescription(input, lotKey, spellName) {
  const lot = input[lotKey];
  if (!lot) return null;
  if (typeof lot[spellName] === "string") return lot[spellName];
  if (lot.spells && typeof lot.spells[spellName] === "string") return lot.spells[spellName];
  return null;
}

function main() {
  const inputPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultInputPath;
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Fichier source introuvable: ${inputPath}`);
  }

  const descriptions = readJson(inputPath);
  let updatedFiles = 0;
  let updatedSpells = 0;
  const missing = [];

  const referenceFiles = fs.readdirSync(referenceDir)
    .filter((file) => /^manuel-joueurs-.*\.json$/.test(file))
    .filter((file) => file !== "manuel-joueurs-sorts-master.json")
    .sort((a, b) => a.localeCompare(b, "fr"));

  for (const file of referenceFiles) {
    const lotKey = file.replace(/^manuel-joueurs-/, "").replace(/\.json$/, "");
    const filePath = path.join(referenceDir, file);
    const data = readJson(filePath);
    if (!Array.isArray(data.spells)) continue;

    let touched = false;
    for (const spell of data.spells) {
      for (const field of forbiddenDescriptionFields) delete spell[field];
      const description = getDescription(descriptions, lotKey, spell.nom);
      if (!description) {
        missing.push(`${lotKey}: ${spell.nom}`);
        spell.description ||= "";
        if (!String(spell.status || "").includes("description_a_importer")) {
          spell.status = "description_a_importer";
        }
        touched = true;
        continue;
      }
      spell.description = normalizeDescription(description);
      if (!spell.description) throw new Error(`Description vide apres normalisation: ${lotKey}: ${spell.nom}`);
      if (String(spell.description).includes("\n")) throw new Error(`Description non normalisee: ${lotKey}: ${spell.nom}`);
      spell.status = "reference_complete_description_normalisee";
      updatedSpells += 1;
      touched = true;
    }

    if (touched) {
      data.status = missing.some((entry) => entry.startsWith(`${lotKey}:`))
        ? "reference_description_partielle"
        : "reference_complete_description_normalisee";
      writeJson(filePath, data);
      updatedFiles += 1;
    }
  }

  console.log(`Fichiers references modifies: ${updatedFiles}`);
  console.log(`Descriptions importees: ${updatedSpells}`);
  console.log(`Descriptions manquantes: ${missing.length}`);
  if (missing.length) {
    for (const entry of missing) console.warn(`[MISSING] ${entry}`);
  }
}

main();
