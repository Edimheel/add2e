import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");

const splitDir = path.join(repoRoot, "audit/decoupage_fichier");
const referenceDir = path.join(repoRoot, "audit/reference");
const reportsDir = path.join(repoRoot, "audit/rapports");
const statusPath = path.join(repoRoot, "audit/spell-audit-status.json");

function stripAccents(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function slugify(value) {
  return stripAccents(value)
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "inconnu";
}

function normalizeName(value) {
  return stripAccents(value)
    .toLowerCase()
    .replace(/[’']/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function safeExists(relativePath) {
  return fs.existsSync(path.join(repoRoot, relativePath));
}

function extractPathFromSystemPath(systemPath) {
  const value = String(systemPath ?? "");
  return value.replace(/^systems\/add2e\//, "");
}

function getOnUse(spell) {
  return spell?.system?.onUse || spell?.system?.on_use || spell?.system?.onuse || "";
}

function getImg(spell) {
  return spell?.img || spell?.system?.img || "";
}

function getMaterialText(spell) {
  const system = spell?.system || {};
  if (Array.isArray(system.composants_materiels) && system.composants_materiels.length) {
    return system.composants_materiels.map((c) => c.nom || c.slug || JSON.stringify(c)).join(" ; ");
  }
  return system.composantes || "";
}

function loadReferenceForLot(lotKey) {
  const candidates = [
    path.join(referenceDir, `manuel-joueurs-${lotKey}.json`),
    path.join(referenceDir, `${lotKey}.json`)
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return { path: candidate, data: readJson(candidate) };
  }
  return null;
}

function makeTable(headers, rows) {
  const header = `| ${headers.join(" | ")} |`;
  const sep = `| ${headers.map(() => "---").join(" | ")} |`;
  return [header, sep, ...rows.map((row) => `| ${row.map((cell) => String(cell ?? "").replace(/\n/g, "<br>")).join(" | ")} |`)].join("\n");
}

function compareWithReference(lot, reference) {
  const items = lot.items || [];
  const expected = reference?.data?.spells || [];
  const foundByNorm = new Map(items.map((spell) => [normalizeName(spell.name), spell]));

  const rows = [];
  const missing = [];
  const nameDiffs = [];

  for (const expectedSpell of expected) {
    const exact = items.find((spell) => normalizeName(spell.name) === normalizeName(expectedSpell.nom));
    let candidate = exact;

    if (!candidate) {
      // Fallback conservateur : recherche par inclusion dans les deux sens.
      const expectedNorm = normalizeName(expectedSpell.nom);
      candidate = items.find((spell) => {
        const actualNorm = normalizeName(spell.name);
        return actualNorm.includes(expectedNorm) || expectedNorm.includes(actualNorm);
      });
    }

    if (!candidate) {
      missing.push(expectedSpell.nom);
      rows.push([expectedSpell.nom, "MANQUANT", "—", "—", "—"]);
      continue;
    }

    const nameStatus = normalizeName(candidate.name) === normalizeName(expectedSpell.nom) ? "OK" : `Écart : ${candidate.name}`;
    if (nameStatus !== "OK") nameDiffs.push({ expected: expectedSpell.nom, actual: candidate.name });

    const onUse = getOnUse(candidate);
    const onUseRepoPath = extractPathFromSystemPath(onUse);
    const img = getImg(candidate);
    const imgRepoPath = extractPathFromSystemPath(img);

    rows.push([
      expectedSpell.nom,
      nameStatus,
      onUse ? (safeExists(onUseRepoPath) ? "OK" : `Manquant : ${onUseRepoPath}`) : "Aucun",
      img ? (safeExists(imgRepoPath) ? "OK" : `Manquante : ${imgRepoPath}`) : "Aucune",
      getMaterialText(candidate) || "—"
    ]);
  }

  const extra = items.filter((spell) => !expected.some((e) => normalizeName(e.nom) === normalizeName(spell.name)));

  return { rows, missing, extra, nameDiffs, expectedCount: expected.length, actualCount: items.length };
}

function buildReport(lotFile) {
  const lotPath = path.join(splitDir, lotFile);
  const lot = readJson(lotPath);
  const lotKey = lot.group?.key || lotFile.replace(/\.json$/, "");
  const reference = loadReferenceForLot(lotKey);
  const items = lot.items || [];
  const now = new Date().toISOString();

  const lines = [];
  lines.push(`# Audit automatique — ${lotKey}`);
  lines.push("");
  lines.push(`Généré le : ${now}`);
  lines.push("");
  lines.push("## Fichiers");
  lines.push("");
  lines.push(`- Export découpé : \`audit/decoupage_fichier/${lotFile}\``);
  if (reference) lines.push(`- Référence : \`${path.relative(repoRoot, reference.path)}\``);
  else lines.push("- Référence : manquante");
  lines.push("");
  lines.push("## Résumé");
  lines.push("");
  lines.push(`- Classe : \`${lot.group?.classe ?? "inconnue"}\``);
  lines.push(`- Niveau : \`${lot.group?.niveau ?? "inconnu"}\``);
  lines.push(`- Sorts dans l’export : \`${items.length}\``);

  if (reference) {
    const cmp = compareWithReference(lot, reference);
    lines.push(`- Sorts attendus par la référence : \`${cmp.expectedCount}\``);
    lines.push(`- Sorts manquants : \`${cmp.missing.length}\``);
    lines.push(`- Écarts de nom : \`${cmp.nameDiffs.length}\``);
    lines.push("");
    lines.push("## Comparaison à la référence");
    lines.push("");
    lines.push(makeTable(["Sort attendu", "Nom", "onUse", "Image", "Composants export"], cmp.rows));
    if (cmp.missing.length) {
      lines.push("");
      lines.push("## Sorts manquants");
      lines.push("");
      for (const missing of cmp.missing) lines.push(`- ${missing}`);
    }
    if (cmp.extra.length) {
      lines.push("");
      lines.push("## Sorts présents hors correspondance stricte");
      lines.push("");
      for (const spell of cmp.extra) lines.push(`- ${spell.name}`);
    }
  } else {
    lines.push("- Statut : référence Manuel des joueurs manquante ; rapport d’inventaire seulement.");
    lines.push("");
    lines.push("## Inventaire export Foundry");
    lines.push("");
    const rows = items.map((spell) => {
      const onUse = getOnUse(spell);
      const onUsePath = extractPathFromSystemPath(onUse);
      const img = getImg(spell);
      const imgPath = extractPathFromSystemPath(img);
      return [
        spell.name,
        spell.system?.niveau ?? lot.group?.niveau ?? "",
        onUse ? (safeExists(onUsePath) ? "OK" : `Manquant : ${onUsePath}`) : "Aucun",
        img ? (safeExists(imgPath) ? "OK" : `Manquante : ${imgPath}`) : "Aucune"
      ];
    });
    lines.push(makeTable(["Sort", "Niveau", "onUse", "Image"], rows));
  }

  lines.push("");
  lines.push("## Statut");
  lines.push("");
  lines.push(reference ? "`audit_genere_reference_presente`" : "`reference_manquante`" );
  lines.push("");
  lines.push("## Limites");
  lines.push("");
  lines.push("Ce rapport est généré automatiquement. Il ne remplace pas la vérification humaine du Manuel des joueurs, surtout pour les descriptions longues, les composants alternatifs, les versions inverses et les sorts à arbitrage MJ.");

  return { lotKey, content: `${lines.join("\n")}\n`, hasReference: Boolean(reference), count: items.length };
}

function updateStatus(generated) {
  let status = {
    generatedAt: new Date().toISOString(),
    sourceOfTruth: "Manuel des joueurs AD&D 2e pour toutes les règles ADD2E",
    branch: "agent-audit-sorts",
    lots: {}
  };

  if (fs.existsSync(statusPath)) {
    try {
      status = readJson(statusPath);
    } catch {
      // Conserver un statut minimal si le fichier existant est invalide.
    }
  }

  status.generatedAt = new Date().toISOString();
  status.sourceOfTruth = "Manuel des joueurs AD&D 2e pour toutes les règles ADD2E";
  status.branch = "agent-audit-sorts";
  status.lots ||= {};

  for (const entry of generated) {
    const existing = status.lots[entry.lotKey] || {};
    const keepValidated = ["modele_valide", "valide_foundry", "correction_poussee", "a_tester_foundry"].includes(existing.status);
    status.lots[entry.lotKey] = {
      ...existing,
      status: keepValidated ? existing.status : (entry.hasReference ? "audit_genere_reference_presente" : "reference_manquante"),
      rapport: `audit/rapports/${entry.lotKey}.md`,
      export: `audit/decoupage_fichier/${entry.lotKey}.json`,
      foundrySpells: entry.count
    };
  }

  fs.writeFileSync(statusPath, `${JSON.stringify(status, null, 2)}\n`, "utf8");
}

function main() {
  fs.mkdirSync(reportsDir, { recursive: true });

  const lotFiles = fs.readdirSync(splitDir)
    .filter((file) => file.endsWith(".json"))
    .filter((file) => file !== "index.json")
    .sort((a, b) => a.localeCompare(b, "fr"));

  const generated = [];

  for (const lotFile of lotFiles) {
    const report = buildReport(lotFile);
    fs.writeFileSync(path.join(reportsDir, `${report.lotKey}.md`), report.content, "utf8");
    generated.push(report);
  }

  updateStatus(generated);

  console.log(`Rapports générés : ${generated.length}`);
  console.log(`Références présentes : ${generated.filter((g) => g.hasReference).length}`);
  console.log(`Références manquantes : ${generated.filter((g) => !g.hasReference).length}`);
}

main();
