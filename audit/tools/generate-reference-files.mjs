import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");

const splitIndexPath = path.join(repoRoot, "audit/decoupage_fichier/index.json");
const referenceDir = path.join(repoRoot, "audit/reference");
const masterPath = path.join(referenceDir, "manuel-joueurs-sorts-master.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function lotToPath(lotKey) {
  return path.join(referenceDir, `manuel-joueurs-${lotKey}.json`);
}

function buildSkeleton(group) {
  return {
    source: {
      document: "AD&D-Manuel-des-joueurs-restauré-mars-2024.pdf",
      reference: "Manuel des joueurs AD&D 2e",
      classe: group.classe,
      niveau: group.niveau,
      note: "Le Manuel des joueurs est la source de vérité pour toutes les règles ADD2E."
    },
    status: "reference_a_completer",
    expectedCount: null,
    foundryExport: `audit/decoupage_fichier/${group.file}`,
    rules: {
      warning: "Squelette généré automatiquement. Ne pas utiliser comme référence de règle tant que les données du Manuel des joueurs ne sont pas complétées et vérifiées."
    },
    spells: []
  };
}

function main() {
  if (!fs.existsSync(splitIndexPath)) {
    throw new Error(`Index de découpage introuvable : ${splitIndexPath}`);
  }

  fs.mkdirSync(referenceDir, { recursive: true });

  const index = readJson(splitIndexPath);
  const master = fs.existsSync(masterPath) ? readJson(masterPath) : { lots: {} };
  master.lots ||= {};

  let created = 0;
  let preserved = 0;

  for (const group of index.groups || []) {
    const lotKey = group.key;
    const targetPath = lotToPath(lotKey);

    if (fs.existsSync(targetPath)) {
      preserved += 1;
      master.lots[lotKey] = {
        ...(master.lots[lotKey] || {}),
        referenceFile: `audit/reference/manuel-joueurs-${lotKey}.json`,
        status: "existing_reference_preserved"
      };
      continue;
    }

    const skeleton = buildSkeleton(group);
    fs.writeFileSync(targetPath, `${JSON.stringify(skeleton, null, 2)}\n`, "utf8");
    created += 1;
    master.lots[lotKey] = {
      referenceFile: `audit/reference/manuel-joueurs-${lotKey}.json`,
      status: "reference_a_completer"
    };
  }

  master.generatedAt = new Date().toISOString();
  master.mode = "skeleton_only";
  master.preserveExistingReferences = true;
  fs.writeFileSync(masterPath, `${JSON.stringify(master, null, 2)}\n`, "utf8");

  console.log(`Références créées : ${created}`);
  console.log(`Références conservées : ${preserved}`);
}

main();
