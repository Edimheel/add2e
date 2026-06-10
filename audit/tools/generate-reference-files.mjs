import fs from "node:fs";
import { execFileSync } from "node:child_process";

const repo = process.env.GITHUB_WORKSPACE;
const base = "bc390084d48e433d0432101ed4ec8242c35ad437";
const git = (...args) => execFileSync("git", args, { cwd: repo, encoding: "utf8", stdio: "inherit" });
const run = (command, args) => execFileSync(command, args, { cwd: repo, encoding: "utf8", stdio: "inherit" });
git("fetch", "origin", base);
const sourcePath = `${repo}/audit/source/reference-descriptions.json`;
const reportPath = `${repo}/audit/rapports/REFERENCE-SPELLS-GENERATION.md`;
const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
const d3 = source["druide-niveau-3"].spells;
const d4 = source["druide-niveau-4"].spells;
const druidTemperature = d3["Piège Sylvestre"];
const druidDispel = d4["Contrôle de la température sur 3 m"];
const druidKindle = d4["Dissipation de la Magie"].split(" FORÊT HALLUCINATOIRE (")[0];
const druidForest = d4["Embrasement"];
delete d3["Piège Sylvestre"];
d4["Contrôle de la température sur 3 m"] = druidTemperature;
d4["Dissipation de la Magie"] = druidDispel;
d4["Embrasement"] = druidKindle;
d4["Forêt hallucinatoire"] = druidForest;

const m3 = source["magicien-niveau-3"].spells;
const m4 = source["magicien-niveau-4"].spells;
const chain = [
  [m3, "Langues", m3, "Infravision"],
  [m3, "Paralysie", m3, "Langues"],
  [m3, "Protection contre le mal sur 3 m", m3, "Paralysie"],
  [m3, "Protection contre les Projectiles Normaux", m3, "Protection contre le mal sur 3 m"],
  [m3, "Rafale de Vent", m3, "Protection contre les Projectiles Normaux"],
  [m3, "Suggestion", m3, "Rafale de Vent"],
  [m3, "Vol", m3, "Suggestion"],
  [m4, "Allométamorphose", m3, "Vol"],
  [m4, "Charme-monstres", m4, "Allométamorphose"],
  [m4, "Confusion", m4, "Charme-monstres"],
  [m4, "Désenvoûtement", m4, "Confusion"],
  [m4, "Globe Mineur d’Invulnérabilité", m4, "Désenvoûtement"],
  [m4, "Invocation de monstre II", m4, "Globe Mineur d’Invulnérabilité"],
  [m4, "Maladresse", m4, "Invocation de monstre II"],
  [m4, "Moyen mnémonique de Rary", m4, "Maladresse"],
  [m4, "Piège à Feu", m4, "Moyen mnémonique de Rary"],
  [m4, "Porte dimensionnelle", m4, "Piège à Feu"],
  [m4, "Tempête de glace", m4, "Porte dimensionnelle"]
];
const replacements = chain.map(([targetLot, target, sourceLot, from]) => [targetLot, target, sourceLot[from]]);
for (const [targetLot, target, text] of replacements) targetLot[target] = text;
delete m3["Infravision"];

const trimMarkers = [
  ["clerc-niveau-5", "Pilier de Feu", " QUÊTE RELIGIEUSE ("],
  ["druide-niveau-1", "Détection des Pièges Sylvestres", " ENCHEVÊTREMENT ("],
  ["druide-niveau-5", "Communion avec la Nature", " CONTRÔLE DES VENTS ("],
  ["druide-niveau-6", "Mur d’épines", " RÉPULSION DU BOIS ("],
  ["magicien-niveau-6", "Punition Spirituelle", " QUÊTE MAGIQUE ("],
  ["magicien-niveau-7", "Invocation Instantanée de Drawmij", " MOT DE POUVOIR: «ÉTOURDISSEMENT» ("],
  ["magicien-niveau-8", "Labyrinthe", " MOT DE POUVOIR: «CÉCITÉ» ("],
  ["magicien-niveau-8", "Nuage incendiaire", " PERMANENCE ("],
  ["magicien-niveau-8", "Transformation d’Objets", " ARRÊT DU TEMPS ("],
  ["magicien-niveau-9", "Main broyante de Bigby", " MOT DE POUVOIR: «MORT» ("]
];
for (const [lot, spell, marker] of trimMarkers) {
  const text = source[lot].spells[spell];
  if (!text.includes(marker)) throw new Error(`Marqueur absent: ${lot}: ${spell}`);
  source[lot].spells[spell] = text.split(marker)[0];
}
fs.writeFileSync(sourcePath, `${JSON.stringify(source, null, 2)}\n`, "utf8");

let report = fs.readFileSync(reportPath, "utf8");
report = report.replace("| druide-niveau-3 | 12 | 12 |", "| druide-niveau-3 | 12 | 11 |")
  .replace("| druide-niveau-4 | 12 | 11 |", "| druide-niveau-4 | 12 | 12 |")
  .replace("| magicien-niveau-3 | 24 | 23 |", "| magicien-niveau-3 | 24 | 22 |")
  .replace("| magicien-niveau-4 | 24 | 23 |", "| magicien-niveau-4 | 24 | 24 |");
const missing = [
  "clerc-niveau-5: Quête religieuse", "druide-niveau-1: Enchevêtrement", "druide-niveau-3: Piège Sylvestre",
  "druide-niveau-5: Contrôle des vents", "druide-niveau-5: Mur de feu", "druide-niveau-6: Répulsion du bois",
  "druide-niveau-7: Animation de la roche", "druide-niveau-7: Tempête de feu", "magicien-niveau-3: Intermittence",
  "magicien-niveau-3: Infravision", "magicien-niveau-6: Quête magique", "magicien-niveau-7: Mot de pouvoir : « étourdissement »",
  "magicien-niveau-8: Mot de pouvoir : « cécité »", "magicien-niveau-8: Permanence", "magicien-niveau-8: Protection d'esprit",
  "magicien-niveau-9: Arrêt du temps", "magicien-niveau-9: Mot de pouvoir : « mort »", "illusionniste-niveau-7: Vision",
  "illusionniste-niveau-7: Sorts de niveau 1 de magicien"
];
const section = `## Descriptions réellement manquantes\n\nLes descriptions suivantes restent absentes : aucun texte correct ne peut leur être attribué depuis la source disponible.\n\n${missing.map((x) => `- ${x}`).join("\n")}\n\n## Descriptions corrigées par réalignement de clé\n\n- Chaîne druide : les textes de Contrôle de la température sur 3 m, Dissipation de la Magie, Embrasement et Forêt hallucinatoire ont été réalignés depuis les quatre clés décalées. Piège Sylvestre reste manquant.\n- Chaîne magicien : les textes de Langues à Tempête de glace ont été réalignés depuis les clés décalées de magicien-niveau-3 et magicien-niveau-4. Infravision reste manquant.\n- Dix en-têtes du sort suivant, collés à la fin d'une description complète, ont été retirés sans modifier le texte de la description.\n\n## Descriptions suspectes laissées à vérifier\n\n- clerc-niveau-7: Tremblement de Terre — suffixe sur les composants druidiques, non attribuable avec certitude depuis la source disponible.\n- magicien-niveau-9: Stase temporelle — suffixe introductif sur les sorts d'illusionniste, non attribuable avec certitude depuis la source disponible.\n\n`;
report = report.replace(/## Descriptions manquantes[\s\S]*?(?=## Composants à vérifier)/, section);
fs.writeFileSync(reportPath, report, "utf8");

git("checkout", base, "--", "audit/tools/generate-reference-files.mjs");
run("node", ["audit/tools/generate-reference-files.mjs"]);
git("restore", "audit/reference");
run("node", ["audit/tools/validate-reference-schema.mjs"]);
git("restore", "scripts/sorts", "fvtt-spells-all.json", "audit/decoupage_fichier", "system.json");
git("config", "user.name", "github-actions[bot]");
git("config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com");
git("add", "audit/source/reference-descriptions.json", "audit/rapports/REFERENCE-SPELLS-GENERATION.md");
git("commit", "-m", "Fix misaligned spell source descriptions");
const changed = execFileSync("git", ["diff", "--name-only", `${base}..HEAD`], { cwd: repo, encoding: "utf8" }).trim().split(/\r?\n/).filter(Boolean);
const allowed = new Set(["audit/source/reference-descriptions.json", "audit/rapports/REFERENCE-SPELLS-GENERATION.md"]);
const forbidden = changed.filter((file) => !allowed.has(file));
if (forbidden.length) throw new Error(`Fichiers hors périmètre: ${forbidden.join(", ")}`);
git("push", "origin", "HEAD:refs/heads/codex-misaligned-fix");
