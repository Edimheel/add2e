import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ADD2E — Compare les descriptions V4 aux descriptions_reelle du découpage.
// Lecture seule : ne modifie jamais V4, les fichiers de découpage ou les références.
// La liaison est strictement faite par _id / id Foundry, sans rapprochement par nom.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DEFAULT_V4 = "fvtt-spells-all-normalise-mecanique-v4.json";
const DEFAULT_DECOUPAGE_DIR = "audit/decoupage_fichier";
const DEFAULT_REPORT = "audit/rapports/COMPARAISON-DESCRIPTIONS-V4-DECOUPAGE.json";
const VERSION = "2026-06-26-compare-v4-descriptions-decoupage-v1";

function parseArguments(argv) {
  const options = {
    v4: DEFAULT_V4,
    decoupage: DEFAULT_DECOUPAGE_DIR,
    report: DEFAULT_REPORT,
    write: true
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];
    if (argument === "--v4" && value) { options.v4 = value; index += 1; }
    else if (argument === "--decoupage" && value) { options.decoupage = value; index += 1; }
    else if (argument === "--report" && value) { options.report = value; index += 1; }
    else if (argument === "--dry-run") options.write = false;
    else if (argument === "--help") {
      console.log([
        "Usage : node audit/tools/compare-v4-descriptions-to-decoupage.mjs",
        "       [--v4 <fichier-v4>] [--decoupage <repertoire>] [--report <rapport-json>] [--dry-run]"
      ].join("\n"));
      process.exit(0);
    }
  }

  return options;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sha256(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function listJsonFiles(directory) {
  const output = [];
  const visit = current => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith(".json")) output.push(full);
    }
  };
  visit(directory);
  return output.sort((left, right) => left.localeCompare(right, "fr", { sensitivity: "base" }));
}

function getItemsContainer(document) {
  if (Array.isArray(document)) return { key: null, items: document };
  for (const key of ["items", "Item", "Items", "documents", "data", "entries"]) {
    if (Array.isArray(document?.[key])) return { key, items: document[key] };
  }
  return { key: null, items: null };
}

function isSpell(item) {
  return String(item?.type ?? item?.system?.type ?? "").toLowerCase() === "sort";
}

function itemId(item) {
  const id = item?._id ?? item?.id ?? null;
  return id === null || id === undefined || String(id).trim() === "" ? null : String(id);
}

function decodeEntities(value) {
  return String(value ?? "")
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_match, decimal) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function normalizeDescription(value) {
  return decodeEntities(value)
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*\/\s*p\s*>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .normalize("NFKC")
    .replace(/[\u00a0\u2007\u202f]/g, " ")
    .replace(/[\u2018\u2019\u02bc]/g, "'")
    .replace(/[\u201c\u201d]/g, "\"")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("fr");
}

function compactText(value, maximum = 180) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length <= maximum ? text : `${text.slice(0, maximum - 1)}…`;
}

function firstDifference(left, right) {
  const max = Math.min(left.length, right.length);
  let index = 0;
  while (index < max && left[index] === right[index]) index += 1;
  if (index === left.length && index === right.length) return null;
  const before = Math.max(0, index - 80);
  const afterLeft = Math.min(left.length, index + 120);
  const afterRight = Math.min(right.length, index + 120);
  return {
    index,
    v4Context: left.slice(before, afterLeft),
    referenceContext: right.slice(before, afterRight)
  };
}

function pushById(map, id, row) {
  const rows = map.get(id) ?? [];
  rows.push(row);
  map.set(id, rows);
}

function rowFromItem(item, sourceFile = null) {
  const system = item?.system ?? {};
  return {
    id: itemId(item),
    name: String(item?.name ?? system?.nom ?? "").trim(),
    systemNom: String(system?.nom ?? "").trim(),
    className: system?.classe ?? null,
    spellLists: Array.isArray(system?.spellLists) ? system.spellLists : system?.spellLists ?? null,
    level: system?.niveau ?? null,
    description: String(system?.description ?? ""),
    descriptionReelle: String(system?.description_reelle ?? ""),
    sourceFile
  };
}

function scanDecoupage(directory) {
  const rowsById = new Map();
  const details = {
    files: [],
    parseErrors: [],
    filesWithoutItems: [],
    sortRows: 0,
    sortsWithoutId: []
  };

  for (const file of listJsonFiles(directory)) {
    const relative = path.relative(ROOT, file);
    let document;
    try {
      document = readJson(file);
    } catch (error) {
      details.parseErrors.push({ file: relative, error: String(error?.message ?? error) });
      continue;
    }

    const { key, items } = getItemsContainer(document);
    if (!items) {
      details.filesWithoutItems.push({ file: relative });
      continue;
    }

    let fileSorts = 0;
    for (const item of items) {
      if (!isSpell(item)) continue;
      fileSorts += 1;
      details.sortRows += 1;
      const row = rowFromItem(item, relative);
      if (!row.id) {
        details.sortsWithoutId.push({ file: relative, nom: row.name || row.systemNom });
        continue;
      }
      pushById(rowsById, row.id, row);
    }
    details.files.push({ file: relative, itemsContainer: key ?? "array", sorts: fileSorts });
  }

  return { rowsById, details };
}

function scanV4(document) {
  const { key, items } = getItemsContainer(document);
  if (!items) throw new Error("Aucune collection d'items trouvée dans V4.");

  const rowsById = new Map();
  const details = {
    itemsContainer: key ?? "array",
    sourceItems: items.length,
    sortRows: 0,
    sortsWithoutId: []
  };

  for (const item of items) {
    if (!isSpell(item)) continue;
    details.sortRows += 1;
    const row = rowFromItem(item, null);
    if (!row.id) {
      details.sortsWithoutId.push({ nom: row.name || row.systemNom });
      continue;
    }
    pushById(rowsById, row.id, row);
  }

  return { rowsById, details };
}

function metadataMismatch(v4, reference) {
  const mismatches = [];
  if (v4.name && reference.name && v4.name !== reference.name) mismatches.push("name");
  if (v4.systemNom && reference.systemNom && v4.systemNom !== reference.systemNom) mismatches.push("system.nom");
  if (String(v4.level ?? "") !== String(reference.level ?? "")) mismatches.push("niveau");
  return mismatches;
}

function makeReport(v4Document, v4File, decoupageDirectory) {
  const v4 = scanV4(v4Document);
  const decoupage = scanDecoupage(decoupageDirectory);
  const report = {
    version: VERSION,
    source: {
      v4File,
      v4Sha256: sha256(v4Document),
      decoupageDirectory: path.relative(ROOT, decoupageDirectory)
    },
    generatedAt: new Date().toISOString(),
    method: {
      matching: "strict_foundry_id_only",
      v4Field: "system.description",
      referenceField: "system.description_reelle",
      comparison: "normalisation de la mise en forme HTML, entités, espaces, apostrophes et tirets ; aucun rapprochement par nom"
    },
    scope: {
      v4: v4.details,
      decoupage: decoupage.details
    },
    summary: {
      matchedUniqueIds: 0,
      descriptionsIdentical: 0,
      descriptionsDifferent: 0,
      descriptionsRawDifferentButNormalizedEqual: 0,
      v4DescriptionMissing: 0,
      referenceDescriptionReelleMissing: 0,
      v4OnlyIds: 0,
      decoupageOnlyIds: 0,
      duplicateV4Ids: 0,
      duplicateDecoupageIds: 0,
      metadataMismatchOnMatchedIds: 0
    },
    candidates: {
      descriptionsDifferent: [],
      v4DescriptionMissing: [],
      referenceDescriptionReelleMissing: [],
      v4OnlyIds: [],
      decoupageOnlyIds: [],
      duplicateV4Ids: [],
      duplicateDecoupageIds: [],
      metadataMismatchOnMatchedIds: []
    },
    matched: []
  };

  const allIds = new Set([...v4.rowsById.keys(), ...decoupage.rowsById.keys()]);
  for (const id of [...allIds].sort((left, right) => left.localeCompare(right))) {
    const v4Rows = v4.rowsById.get(id) ?? [];
    const referenceRows = decoupage.rowsById.get(id) ?? [];

    if (v4Rows.length > 1) {
      report.summary.duplicateV4Ids += 1;
      report.candidates.duplicateV4Ids.push({ id, rows: v4Rows.map(row => ({ nom: row.name, sourceFile: row.sourceFile })) });
    }
    if (referenceRows.length > 1) {
      report.summary.duplicateDecoupageIds += 1;
      report.candidates.duplicateDecoupageIds.push({ id, rows: referenceRows.map(row => ({ nom: row.name, sourceFile: row.sourceFile })) });
    }
    if (v4Rows.length !== 1 || referenceRows.length !== 1) continue;

    const current = v4Rows[0];
    const reference = referenceRows[0];
    report.summary.matchedUniqueIds += 1;

    const currentRaw = current.description;
    const referenceRaw = reference.descriptionReelle;
    const currentNormalized = normalizeDescription(currentRaw);
    const referenceNormalized = normalizeDescription(referenceRaw);
    const mismatch = metadataMismatch(current, reference);
    if (mismatch.length) {
      report.summary.metadataMismatchOnMatchedIds += 1;
      report.candidates.metadataMismatchOnMatchedIds.push({ id, v4: current, reference: { name: reference.name, systemNom: reference.systemNom, level: reference.level, sourceFile: reference.sourceFile }, mismatches: mismatch });
    }

    if (!currentNormalized) {
      report.summary.v4DescriptionMissing += 1;
      report.candidates.v4DescriptionMissing.push({ id, nom: current.name || current.systemNom, referenceFile: reference.sourceFile, referencePreview: compactText(referenceRaw) });
      continue;
    }
    if (!referenceNormalized) {
      report.summary.referenceDescriptionReelleMissing += 1;
      report.candidates.referenceDescriptionReelleMissing.push({ id, nom: current.name || current.systemNom, decoupageFile: reference.sourceFile, v4Preview: compactText(currentRaw) });
      continue;
    }

    const normalizedEqual = currentNormalized === referenceNormalized;
    const rawEqual = currentRaw === referenceRaw;
    if (normalizedEqual) {
      report.summary.descriptionsIdentical += 1;
      if (!rawEqual) report.summary.descriptionsRawDifferentButNormalizedEqual += 1;
      report.matched.push({ id, nom: current.name || current.systemNom, status: rawEqual ? "identical_raw" : "identical_normalized", decoupageFile: reference.sourceFile });
      continue;
    }

    report.summary.descriptionsDifferent += 1;
    const difference = {
      id,
      nom: current.name || current.systemNom,
      v4: {
        name: current.name,
        systemNom: current.systemNom,
        level: current.level,
        description: currentRaw
      },
      decoupage: {
        name: reference.name,
        systemNom: reference.systemNom,
        level: reference.level,
        file: reference.sourceFile,
        descriptionReelle: referenceRaw
      },
      firstDifference: firstDifference(currentNormalized, referenceNormalized)
    };
    report.candidates.descriptionsDifferent.push(difference);
  }

  for (const [id, rows] of v4.rowsById) {
    if (decoupage.rowsById.has(id)) continue;
    report.summary.v4OnlyIds += 1;
    report.candidates.v4OnlyIds.push({ id, rows: rows.map(row => ({ nom: row.name || row.systemNom, niveau: row.level })) });
  }
  for (const [id, rows] of decoupage.rowsById) {
    if (v4.rowsById.has(id)) continue;
    report.summary.decoupageOnlyIds += 1;
    report.candidates.decoupageOnlyIds.push({ id, rows: rows.map(row => ({ nom: row.name || row.systemNom, niveau: row.level, file: row.sourceFile })) });
  }

  report.notice = "Ce rapport indique uniquement les écarts entre V4 et description_reelle du découpage. Il ne prouve pas encore la conformité au Manuel des joueurs et ne modifie aucune donnée.";
  return report;
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  const v4Path = path.resolve(ROOT, options.v4);
  const decoupagePath = path.resolve(ROOT, options.decoupage);
  const reportPath = path.resolve(ROOT, options.report);

  const v4Document = readJson(v4Path);
  const report = makeReport(v4Document, path.relative(ROOT, v4Path), decoupagePath);
  if (options.write) writeJson(reportPath, report);

  console.log("[ADD2E][COMPARE_V4_DESCRIPTIONS]", {
    version: VERSION,
    v4: path.relative(ROOT, v4Path),
    decoupage: path.relative(ROOT, decoupagePath),
    report: options.write ? path.relative(ROOT, reportPath) : "dry-run",
    summary: report.summary,
    decoupageParseErrors: report.scope.decoupage.parseErrors.length
  });
}

main();
