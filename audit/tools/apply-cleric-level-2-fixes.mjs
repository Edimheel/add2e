import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");
const sourcePath = path.join(repoRoot, "fvtt-spells-all.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function findItemsArray(data) {
  for (const value of Object.values(data)) {
    if (Array.isArray(value) && value.some((entry) => entry?.type === "sort")) return value;
  }
  throw new Error("Aucun tableau de sorts trouve dans fvtt-spells-all.json");
}

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function findSpell(items, name) {
  const wanted = normalize(name);
  return items.find((item) => item?.type === "sort" && normalize(item.name) === wanted);
}

function renameSpell(item, newName) {
  if (!item) return false;
  const oldName = item.name;
  item.name = newName;
  if (item.system) {
    if (typeof item.system.nom === "string") item.system.nom = newName;
    if (typeof item.system.name === "string") item.system.name = newName;
  }
  for (const effect of item.effects || []) {
    if (effect?.name === oldName) effect.name = newName;
  }
  return true;
}

function setMaterialSource(item, sourceText, options = {}) {
  if (!item?.system) return false;
  item.system.composants_materiels_source = sourceText;
  if (options.needsReview) item.system.composants_materiels_verification_recommandee = true;
  if (options.requiresManualChoice) item.system.composants_materiels_choix_manuel = true;
  if (options.materials) item.system.composants_materiels = options.materials;
  return true;
}

function removeDescriptionNoise(item, fragments) {
  if (!item?.system) return false;
  const fields = ["description", "description_reelle", "description_texte", "description_html"];
  for (const field of fields) {
    if (typeof item.system[field] !== "string") continue;
    for (const fragment of fragments) {
      item.system[field] = item.system[field].replaceAll(fragment, "").trim();
    }
  }
  return true;
}

function main() {
  const data = readJson(sourcePath);
  const items = findItemsArray(data);
  const changes = [];

  const langage = findSpell(items, "Langage des Animaux");
  if (renameSpell(langage, "Langage animal")) changes.push("Renomme Langage des Animaux en Langage animal");

  const silence = findSpell(items, "Silence (Rayon de 15 pieds)");
  if (renameSpell(silence, "Silence sur 5 mètres")) changes.push("Renomme Silence rayon 15 pieds en Silence sur 5 metres");

  const resistance = findSpell(items, "Résistance au Feu/Résistance au Froid");
  if (renameSpell(resistance, "Résistance au feu")) changes.push("Renomme Resistance au Feu/Froid en Resistance au feu");
  if (setMaterialSource(resistance, "La composante matérielle est une goutte de mercure.", {
    materials: [{ slug: "goutte_de_mercure", nom: "Goutte de mercure", quantite: 1, consomme: true }]
  })) changes.push("Corrige composant materiel de Resistance au feu");

  const augure = findSpell(items, "Augure");
  if (setMaterialSource(augure, "Composants alternatifs selon la methode choisie: baguettes serties de gemmes, os de dragon, objets similaires ou feuilles d'infusion humides; si la methode de l'infusion est utilisee, une perle ecrasee d'au moins 100 po est ajoutee a la boisson avant consommation.", {
    needsReview: true,
    requiresManualChoice: true,
    materials: []
  })) changes.push("Marque les composants alternatifs d Augure comme choix manuel");

  const poison = findSpell(items, "Retardement du Poison") || findSpell(items, "Retardement du poison");
  if (setMaterialSource(poison, "Symbole sacre du clerc et gousse d'ail ecrasee repandue sur les pieds nus de la victime.", {
    materials: [
      { slug: "symbole_sacre", nom: "Symbole sacré", quantite: 1, consomme: false },
      { slug: "gousse_ail", nom: "Gousse d’ail", quantite: 1, consomme: true }
    ]
  })) changes.push("Corrige composants materiels de Retardement du poison");

  const marteau = findSpell(items, "Marteau Spirituel") || findSpell(items, "Marteau spirituel");
  if (removeDescriptionNoise(marteau, ["SORTS DE CLERC (NIVEAU 2)"])) changes.push("Nettoie description de Marteau spirituel");

  if (removeDescriptionNoise(silence, ["SORTS DE NIVEAU 3"])) changes.push("Nettoie description de Silence sur 5 metres");

  writeJson(sourcePath, data);
  console.log(`Corrections appliquees: ${changes.length}`);
  for (const change of changes) console.log(`- ${change}`);
}

main();
