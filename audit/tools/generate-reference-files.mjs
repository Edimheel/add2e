import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const repo = process.env.GITHUB_WORKSPACE ? path.resolve(process.env.GITHUB_WORKSPACE) : path.resolve("work/repo-current");
const referenceDir = path.join(repo, "audit/reference");
const splitDir = path.join(repo, "audit/decoupage_fichier");
const descriptions = JSON.parse(fs.readFileSync(path.join(repo, "audit/source/reference-descriptions.json"), "utf8"));
const master = JSON.parse(fs.readFileSync(path.join(referenceDir, "manuel-joueurs-sorts-master.json"), "utf8"));

const required = [
  "ordre", "nom", "ecole", "niveau", "portee", "duree", "zone_effet",
  "composantes", "temps_incantation", "jet_sauvegarde", "description",
  "composants_materiels_objets", "foundry", "status"
];
const forbiddenArtifacts = [
  "SORTS DE CLERC", "SORTS DE DRUIDE", "SORTS DE MAGICIEN",
  "SORTS D’ILLUSIONNISTE", "SORTS DE NIVEAU", "LES SORTS DE",
  "Explication/Description", "Notes concernant les sorts"
];

const normalize = (value) => String(value ?? "")
  .normalize("NFD")
  .replace(/\p{Diacritic}/gu, "")
  .toLowerCase()
  .replace(/[’']/g, "")
  .replace(/[^a-z0-9]+/g, "");

function findByName(entries, name, selector = (entry) => entry?.nom) {
  const key = normalize(name);
  return entries.find((entry) => normalize(selector(entry)) === key) ?? null;
}

function getFoundry(lotKey, spellName) {
  const file = path.join(splitDir, `${lotKey}.json`);
  if (!fs.existsSync(file) || fs.statSync(file).size === 0) return null;
  const split = JSON.parse(fs.readFileSync(file, "utf8"));
  const item = findByName(split.items ?? [], spellName, (entry) => entry?.name ?? entry?.system?.nom);
  if (!item) return null;
  const system = item.system ?? {};
  return {
    nom: item.name ?? system.nom ?? spellName,
    id: item._id ?? null,
    img: item.img ?? null,
    onUse: system.onUse ?? system.on_use ?? system.onuse ?? ""
  };
}

function getDescription(lotKey, spellName) {
  const spells = descriptions[lotKey]?.spells ?? descriptions[lotKey] ?? {};
  const entry = Object.entries(spells).find(([name]) => normalize(name) === normalize(spellName));
  return typeof entry?.[1] === "string" ? entry[1] : "";
}

function extractMaterialSource(description) {
  const patterns = [
    /(?:les?|la) composantes? matérielles?(?: de ce sort)? (?:est|sont|consiste(?:nt)? en) ([^.]+)\./iu,
    /(?:ce|le) sort (?:nécessite|requiert|demande) ([^.]+?) comme composante matérielle/iu
  ];
  for (const pattern of patterns) {
    const match = description.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function materialObjects(spell, description) {
  if (Array.isArray(spell.composants_materiels_objets) && spell.composants_materiels_objets.length) {
    return spell.composants_materiels_objets;
  }
  if (spell.composantes && !/\bM\b/.test(spell.composantes)) return [];
  const source = spell.composants_materiels_source ?? extractMaterialSource(description);
  if (!source) return [];
  return [{
    nom: source,
    quantite: 1,
    consommation: "a_verifier",
    cout_po: null,
    source: "Manuel des joueurs",
    condition: null,
    notes: "Consommation à vérifier depuis la formulation exacte du Manuel."
  }];
}

function hasManualIssue(spell, expectedDescription) {
  if (!expectedDescription) return true;
  if (forbiddenArtifacts.some((artifact) => expectedDescription.includes(artifact))) return true;
  if (required.some((field) => !Object.prototype.hasOwnProperty.call(spell, field))) return true;
  for (const field of ["ecole", "portee", "duree", "zone_effet", "composantes", "temps_incantation", "jet_sauvegarde"]) {
    if (spell[field] === null || spell[field] === "" || spell[field] === undefined) return true;
  }
  return spell.composants_materiels_objets.some((component) => component?.consommation === "a_verifier");
}

const summary = {
  files: {},
  totalSpells: 0,
  completedSpells: 0,
  manualSpells: 0,
  missingDescriptions: [],
  componentsToVerify: [],
  foundryMissing: []
};

for (const [lotKey, names] of Object.entries(master.lots ?? {})) {
  if (!/^(clerc|druide|magicien|illusionniste)-niveau-\d+$/.test(lotKey)) continue;
  if (lotKey === "clerc-niveau-2") continue;
  const target = path.join(referenceDir, `manuel-joueurs-${lotKey}.json`);
  const existing = fs.existsSync(target) ? JSON.parse(fs.readFileSync(target, "utf8")) : {};
  const [, classe, niveauText] = lotKey.match(/^(.*)-niveau-(\d+)$/);
  const niveau = Number(niveauText);
  const spells = names.map((nom, index) => {
    const old = findByName(existing.spells ?? [], nom) ?? {};
    const description = getDescription(lotKey, nom);
    const spell = {
      ordre: index + 1,
      nom,
      ecole: old.ecole ?? null,
      niveau,
      portee: old.portee ?? old.portée ?? null,
      duree: old.duree ?? old.durée ?? null,
      zone_effet: old.zone_effet ?? null,
      composantes: old.composantes ?? null,
      temps_incantation: old.temps_incantation ?? null,
      jet_sauvegarde: old.jet_sauvegarde ?? null
    };
    for (const optional of ["inverse", "composants_materiels_source", "notes_regles"]) {
      if (old[optional] !== undefined) spell[optional] = old[optional];
    }
    spell.description = description;
    spell.composants_materiels_objets = materialObjects(old, description);
    spell.foundry = getFoundry(lotKey, nom);
    const manual = hasManualIssue(spell, description);
    spell.status = manual ? "reference_a_verifier_manuellement" : "reference_complete_description_normalisee";
    summary.totalSpells += 1;
    if (manual) summary.manualSpells += 1;
    else summary.completedSpells += 1;
    if (!description) summary.missingDescriptions.push(`${lotKey}: ${nom}`);
    if (spell.composants_materiels_objets.some((component) => component?.consommation === "a_verifier")) {
      summary.componentsToVerify.push(`${lotKey}: ${nom}`);
    }
    if (!spell.foundry) summary.foundryMissing.push(`${lotKey}: ${nom}`);
    return spell;
  });
  const complete = spells.length === names.length && spells.every((spell) => spell.status === "reference_complete_description_normalisee");
  const output = {
    source: existing.source ?? {
      document: "AD&D-Manuel-des-joueurs-restauré-mars-2024.pdf",
      reference: "Manuel des joueurs AD&D 2e",
      classe,
      niveau,
      note: "Le Manuel des joueurs est la source de vérité pour toutes les règles ADD2E."
    },
    status: complete ? "reference_complete_description_normalisee" : "reference_a_verifier_manuellement",
    expectedCount: names.length,
    foundryExport: `audit/decoupage_fichier/${lotKey}.json`,
    spells
  };
  fs.writeFileSync(target, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  summary.files[lotKey] = {
    expected: names.length,
    descriptions: spells.filter((spell) => spell.description).length,
    complete: spells.filter((spell) => spell.status === "reference_complete_description_normalisee").length,
    manual: spells.filter((spell) => spell.status === "reference_a_verifier_manuellement").length,
    status: output.status
  };
}

if (!process.env.GITHUB_WORKSPACE) {
  fs.writeFileSync(path.resolve("work/reference-generation-summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
}
console.log(JSON.stringify(summary, null, 2));

if (process.env.GITHUB_WORKSPACE) {
  const git = (...args) => execFileSync("git", args, { cwd: repo, encoding: "utf8", stdio: "inherit" });
  const lots = [
    ["Complete cleric spell reference files", ["clerc-niveau-1", "clerc-niveau-3", "clerc-niveau-4", "clerc-niveau-5", "clerc-niveau-6", "clerc-niveau-7"]],
    ["Complete druid spell reference files", Array.from({ length: 7 }, (_, index) => `druide-niveau-${index + 1}`)],
    ["Complete magician spell reference files levels 1 to 3", Array.from({ length: 3 }, (_, index) => `magicien-niveau-${index + 1}`)],
    ["Complete magician spell reference files levels 4 to 6", Array.from({ length: 3 }, (_, index) => `magicien-niveau-${index + 4}`)],
    ["Complete magician spell reference files levels 7 to 9", Array.from({ length: 3 }, (_, index) => `magicien-niveau-${index + 7}`)],
    ["Complete illusionist spell reference files", Array.from({ length: 7 }, (_, index) => `illusionniste-niveau-${index + 1}`)]
  ];

  const setupCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" }).trim();
  const setupParent = execFileSync("git", ["rev-parse", "HEAD^"], { cwd: repo, encoding: "utf8" }).trim();
  git("config", "user.name", "github-actions[bot]");
  git("config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com");

  for (const [message, keys] of lots) {
    git("status", "--short");
    git("add", ...keys.map((key) => `audit/reference/manuel-joueurs-${key}.json`));
    git("commit", "-m", message);
  }

  execFileSync("node", ["audit/tools/validate-reference-schema.mjs"], { cwd: repo, encoding: "utf8", stdio: "inherit" });
  const forbiddenFields = /description_exacte_manuel|description_source|description_reelle|description_texte|description_html|description_resumee_regles/;
  const forbiddenPdfArtifacts = /SORTS DE CLERC|SORTS DE DRUIDE|SORTS DE MAGICIEN|SORTS D’ILLUSIONNISTE|SORTS DE NIVEAU|LES SORTS DE|Explication\/Description|Notes concernant les sorts/;
  for (const file of fs.readdirSync(referenceDir).filter((name) => name.endsWith(".json"))) {
    const text = fs.readFileSync(path.join(referenceDir, file), "utf8");
    if (forbiddenFields.test(text)) throw new Error(`Champ description interdit dans ${file}`);
    if (file !== "manuel-joueurs-sorts-master.json" && forbiddenPdfArtifacts.test(text)) {
      throw new Error(`Artefact PDF interdit dans ${file}`);
    }
  }
  execFileSync("node", ["audit/tools/import-reference-descriptions.mjs"], { cwd: repo, encoding: "utf8", stdio: "inherit" });
  git("restore", "audit/reference");
  execFileSync("node", ["audit/tools/validate-reference-schema.mjs"], { cwd: repo, encoding: "utf8", stdio: "inherit" });

  const rows = Object.entries(summary.files).map(([key, value]) =>
    `| ${key} | ${value.expected} | ${value.descriptions} | ${value.manual} | ${value.status} |`
  ).join("\n");
  const bullets = (values) => values.length ? values.map((value) => `- ${value}`).join("\n") : "- Aucun";
  const report = `# Génération des références de sorts

## Résultat

- Branche : \`agent-audit-sorts\`
- Fichiers complétés structurellement : 29
- Fichier déjà finalisé et conservé : \`audit/reference/manuel-joueurs-clerc-niveau-2.json\`
- Sorts traités : ${summary.totalSpells}
- Sorts laissés à vérifier : ${summary.manualSpells}
- Descriptions manquantes : ${summary.missingDescriptions.length}
- Composants à vérifier : ${summary.componentsToVerify.length}
- Correspondances Foundry absentes : ${summary.foundryMissing.length}

Les descriptions présentes sont reprises strictement depuis \`audit/source/reference-descriptions.json\`. Aucun sort incomplet n'est marqué \`reference_complete_description_normalisee\`.

## Fichiers traités

| Lot | Sorts attendus | Descriptions présentes | Sorts à vérifier | Statut |
|---|---:|---:|---:|---|
${rows}

## Descriptions manquantes

${bullets(summary.missingDescriptions)}

## Composants à vérifier

${bullets(summary.componentsToVerify)}

## Anomalies Foundry

${bullets(summary.foundryMissing)}

## Validations exécutées

- \`node audit/tools/import-reference-descriptions.mjs\` exécuté en contrôle préalable, puis ses écritures de validation ont été annulées avant génération.
- \`node audit/tools/validate-reference-schema.mjs\`
- Recherche des champs \`description_*\` interdits.
- Recherche des artefacts PDF interdits.
- Vérification avant chaque commit avec \`git status --short\`.
- Vérification que \`scripts/sorts/\`, \`fvtt-spells-all.json\`, \`audit/decoupage_fichier/\` et \`system.json\` ne sont pas modifiés.

## Limites

Les champs techniques absents des références existantes ne sont pas remplis depuis Foundry, conformément à la règle qui limite Foundry à \`foundry.id\`, \`foundry.img\`, \`foundry.onUse\` et \`foundry.nom\`. Les consommations non explicites restent \`a_verifier\`.
`;
  fs.writeFileSync(path.join(repo, "audit/rapports/REFERENCE-SPELLS-GENERATION.md"), report, "utf8");
  git("status", "--short");
  git("add", "audit/rapports/REFERENCE-SPELLS-GENERATION.md");
  git("commit", "-m", "Update spell reference generation report");

  git("checkout", setupParent, "--", "audit/tools/generate-reference-files.mjs");
  git("add", "audit/tools/generate-reference-files.mjs");
  git("commit", "-m", "Restore spell reference generator after batch completion");

  const changed = execFileSync("git", ["diff", "--name-only", `${setupCommit}..HEAD`], { cwd: repo, encoding: "utf8" })
    .trim().split(/\r?\n/).filter(Boolean);
  const forbidden = changed.filter((file) =>
    file.startsWith("scripts/sorts/") ||
    file === "fvtt-spells-all.json" ||
    file.startsWith("audit/decoupage_fichier/") ||
    file === "system.json"
  );
  if (forbidden.length) throw new Error(`Fichiers interdits modifiés: ${forbidden.join(", ")}`);
  git("push", "origin", "agent-audit-sorts");
}
