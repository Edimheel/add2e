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

function variantsFor(variantesByName, nom) {
  const variants = variantesByName?.[nom];
  return Array.isArray(variants) ? variants : [];
}

function buildSpells(names, niveau, variantesByName = {}) {
  return names.map((nom, index) => ({
    ordre: index + 1,
    nom,
    niveau,
    variantes: variantsFor(variantesByName, nom),
    status: "nom_reference_tableau_manuel_joueurs",
    regles_detaillees: "a_completer_depuis_description_du_sort"
  }));
}

function buildReference(group, names, variantesByName = {}) {
  const hasNames = Array.isArray(names) && names.length > 0;
  return {
    source: {
      document: "AD&D-Manuel-des-joueurs-restauré-mars-2024.pdf",
      reference: "Manuel des joueurs AD&D 2e",
      classe: group.classe,
      niveau: group.niveau,
      note: "Le Manuel des joueurs est la source de vérité pour toutes les règles ADD2E."
    },
    status: hasNames ? "reference_liste_noms_complete_regles_a_completer" : "reference_a_completer",
    expectedCount: hasNames ? names.length : null,
    foundryExport: `audit/decoupage_fichier/${group.file}`,
    rules: {
      included: [
        "nom du sort",
        "classe",
        "niveau",
        "ordre dans le tableau du Manuel des joueurs",
        "nombre de sorts attendu",
        "variantes explicitement nommées dans le Manuel des joueurs"
      ],
      warning: "Les règles détaillées restent à compléter depuis la description du sort dans le Manuel des joueurs. Ne pas utiliser ce fichier pour corriger portée, durée, composantes détaillées, jet de sauvegarde ou effet mécanique tant que ces champs ne sont pas remplis.",
      variantes: "Le tableau variantes est vide lorsqu’aucun choix de forme explicitement nommé ne figure dans le Manuel des joueurs."
    },
    spells: hasNames ? buildSpells(names, group.niveau, variantesByName) : []
  };
}

function shouldPreserveDetailedReference(existing) {
  if (!existing || typeof existing !== "object") return false;
  if (!Array.isArray(existing.spells) || existing.spells.length === 0) return false;
  return existing.spells.some((spell) =>
    spell?.portee ||
    spell?.portée ||
    spell?.duree ||
    spell?.durée ||
    spell?.composantes ||
    spell?.temps_incantation ||
    spell?.jet_sauvegarde ||
    spell?.composants_materiels_source ||
    spell?.notes_regles
  );
}

function synchronizeDetailedReference(existing, names, variantesByName) {
  const expectedCount = Array.isArray(names) ? names.length : null;
  if (expectedCount !== null && existing.spells.length !== expectedCount) {
    throw new Error(`Référence détaillée incohérente : ${existing.source?.classe ?? "classe inconnue"} niveau ${existing.source?.niveau ?? "?"} contient ${existing.spells.length} sort(s), mais le tableau du Manuel en attend ${expectedCount}.`);
  }

  existing.expectedCount = expectedCount;
  for (const spell of existing.spells) {
    spell.variantes = variantsFor(variantesByName, spell.nom);
  }
  return existing;
}

function main() {
  if (!fs.existsSync(splitIndexPath)) {
    throw new Error(`Index de découpage introuvable : ${splitIndexPath}`);
  }
  if (!fs.existsSync(masterPath)) {
    throw new Error(`Fichier maître introuvable : ${masterPath}`);
  }

  fs.mkdirSync(referenceDir, { recursive: true });

  const index = readJson(splitIndexPath);
  const master = readJson(masterPath);
  master.lots ||= {};
  master.variantes ||= {};

  let created = 0;
  let enriched = 0;
  let preservedDetailed = 0;
  let missingMasterList = 0;

  for (const group of index.groups || []) {
    const lotKey = group.key;
    const targetPath = lotToPath(lotKey);
    const names = master.lots[lotKey];
    const variantesByName = master.variantes[lotKey] || {};

    if (!Array.isArray(names) || names.length === 0) {
      missingMasterList += 1;
    }

    if (fs.existsSync(targetPath)) {
      const existing = readJson(targetPath);
      if (shouldPreserveDetailedReference(existing)) {
        const synchronized = synchronizeDetailedReference(existing, names, variantesByName);
        fs.writeFileSync(targetPath, `${JSON.stringify(synchronized, null, 2)}\n`, "utf8");
        preservedDetailed += 1;
        master.lotsStatus ||= {};
        master.lotsStatus[lotKey] = {
          referenceFile: `audit/reference/manuel-joueurs-${lotKey}.json`,
          status: "detailed_reference_preserved"
        };
        continue;
      }
    }

    const reference = buildReference(group, names, variantesByName);
    const existed = fs.existsSync(targetPath);
    fs.writeFileSync(targetPath, `${JSON.stringify(reference, null, 2)}\n`, "utf8");

    if (existed) enriched += 1;
    else created += 1;

    master.lotsStatus ||= {};
    master.lotsStatus[lotKey] = {
      referenceFile: `audit/reference/manuel-joueurs-${lotKey}.json`,
      status: Array.isArray(names) && names.length > 0 ? "reference_liste_noms_complete_regles_a_completer" : "reference_a_completer"
    };
  }

  master.generatedAt = new Date().toISOString();
  master.mode = "spell_name_lists_from_phb_tables";
  master.preserveDetailedReferences = true;
  fs.writeFileSync(masterPath, `${JSON.stringify(master, null, 2)}\n`, "utf8");

  console.log(`Références créées : ${created}`);
  console.log(`Références enrichies : ${enriched}`);
  console.log(`Références détaillées conservées : ${preservedDetailed}`);
  console.log(`Lots sans liste maître : ${missingMasterList}`);
}

main();
