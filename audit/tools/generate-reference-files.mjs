import fs from "node:fs";
import { execFileSync } from "node:child_process";

const repo = process.env.GITHUB_WORKSPACE;
const base = "8bd7b2b9a9eca1bfa7fb848bf773d622d5afc7d3";
const git = (...args) => execFileSync("git", args, { cwd: repo, encoding: "utf8", stdio: "inherit" });
const run = (command, args) => execFileSync(command, args, { cwd: repo, encoding: "utf8", stdio: "inherit" });
git("fetch", "origin", base);
const sourcePath = `${repo}/audit/source/reference-descriptions.json`;
const reportPath = `${repo}/audit/rapports/REFERENCE-SPELLS-GENERATION.md`;
const renames = [
  ["clerc-niveau-4", "Langues", "Langue"],
  ["clerc-niveau-4", "Protection contre le Mal sur 3 Mètres", "Protection contre le mal sur 3 m"],
  ["druide-niveau-4", "Contrôle de la Température sur 3 Mètres", "Contrôle de la température sur 3 m"],
  ["magicien-niveau-3", "Invisibilité sur 3 Mètres", "Invisibilité sur 3 m"],
  ["magicien-niveau-3", "Invocation de monstre I", "Invocation de monstres I"],
  ["magicien-niveau-3", "Protection contre le Mal sur 3 Mètres", "Protection contre le mal sur 3 m"],
  ["illusionniste-niveau-3", "Invisibilité sur 3 Mètres", "Invisibilité sur 3 m"]
];
const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
for (const [lot, oldName, newName] of renames) {
  const spells = source[lot]?.spells;
  if (!spells || typeof spells[oldName] !== "string" || Object.hasOwn(spells, newName)) throw new Error(`Renommage impossible: ${lot}: ${oldName}`);
  source[lot].spells = Object.fromEntries(Object.entries(spells).map(([name, text]) => [name === oldName ? newName : name, text]));
}
fs.writeFileSync(sourcePath, `${JSON.stringify(source, null, 2)}\n`, "utf8");
let report = fs.readFileSync(reportPath, "utf8");
report = report.replace("- Descriptions manquantes : 26", "- Descriptions manquantes : 19")
  .replace("| clerc-niveau-4 | 10 | 8 |", "| clerc-niveau-4 | 10 | 10 |")
  .replace("| druide-niveau-4 | 12 | 10 |", "| druide-niveau-4 | 12 | 11 |")
  .replace("| magicien-niveau-3 | 24 | 20 |", "| magicien-niveau-3 | 24 | 23 |")
  .replace("| illusionniste-niveau-3 | 12 | 11 |", "| illusionniste-niveau-3 | 12 | 12 |");
for (const [, , name] of renames) report = report.replace(new RegExp(`^- .*: ${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\r?\\n`, "m"), "");
report = report.replace("## Descriptions manquantes\n", "## Descriptions manquantes\n\nLe PDF du Manuel du joueur n'étant pas disponible dans l'environnement Codex, les descriptions suivantes restent absentes faute de confirmation possible depuis la source autorisée. Les sept faux manquants dus à une variante de clé ont été réalignés sans modifier leur texte extrait.\n");
fs.writeFileSync(reportPath, report, "utf8");

git("checkout", base, "--", "audit/tools/generate-reference-files.mjs");
run("node", ["audit/tools/generate-reference-files.mjs"]);
git("restore", "audit/reference");
run("node", ["audit/tools/validate-reference-schema.mjs"]);
git("restore", "scripts/sorts", "fvtt-spells-all.json", "audit/decoupage_fichier", "system.json");
git("config", "user.name", "github-actions[bot]");
git("config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com");
git("add", "audit/source/reference-descriptions.json", "audit/rapports/REFERENCE-SPELLS-GENERATION.md");
git("commit", "-m", "Complete missing spell descriptions source");
git("add", "audit/tools/generate-reference-files.mjs");
git("commit", "-m", "Restore reference generator after missing descriptions fix");
const changed = execFileSync("git", ["diff", "--name-only", `${base}..HEAD`], { cwd: repo, encoding: "utf8" }).trim().split(/\r?\n/).filter(Boolean);
const allowed = new Set(["audit/source/reference-descriptions.json", "audit/rapports/REFERENCE-SPELLS-GENERATION.md"]);
const forbidden = changed.filter((file) => !allowed.has(file));
if (forbidden.length) throw new Error(`Fichiers hors périmètre dans l'état final: ${forbidden.join(", ")}`);
git("push", "origin", "HEAD:refs/heads/codex-description-fix");
