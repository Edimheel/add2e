import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ADD2E — Compare les descriptions V4 aux descriptions_reelle du découpage.
// Lecture seule : ne modifie jamais V4, les fichiers de découpage ou les références.
// La liaison est strictement résolue par identité métier unique : liste/classe + niveau + nom.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DEFAULT_V4 = "fvtt-spells-all-normalise-mecanique-v4.json";
const DEFAULT_DECOUPAGE_DIR = "audit/decoupage_fichier";
const DEFAULT_REPORT = "audit/rapports/COMPARAISON-DESCRIPTIONS-V4-DECOUPAGE.json";
const VERSION = "2026-06-26-compare-v4-descriptions-decoupage-v2";

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

function normalizeName(value) {
  return decodeEntities(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("fr")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function asArray(value) {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(asArray);
  if (typeof value === "string") return value.split(/[,;|/]+/).map(part => part.trim()).filter(Boolean);
  return [value];
}

function normalizeLists(value) {
  return [...new Set(asArray(value).map(normalizeName).filter(Boolean))].sort();
}

function normalizeLevel(value) {
  const numeric = Number(String(value ?? "").match(/\d+/)?.[0] ?? 0);
  return Number.isFinite(numeric) && numeric > 0 ? String(Math.floor(numeric)) : "niveau_inconnu";
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
  return {
    index,
    v4Context: left.slice(before, Math.min(left.length, index + 120)),
    referenceContext: right.slice(before, Math.min(right.length, index + 120))
  };
}

function rowFromItem(item, sourceFile = null) {
  const system = item?.system ?? {};
  const name = String(item?.name ?? system?.nom ?? "").trim();
  const systemNom = String(system?.nom ?? "").trim();
  const spellLists = normalizeLists(system?.spellLists);
  const className = normalizeName(system?.classe);
  const level = normalizeLevel(system?.niveau);
  const normalizedName = normalizeName(name || systemNom);
  const keys = {
    spellLists: spellLists.length && normalizedName
      ? `lists:${spellLists.join("+")}|niveau:${level}|nom:${normalizedName}`
      : null,
    classe: className && normalizedName
      ? `classe:${className}|niveau:${level}|nom:${normalizedName}`
      : null
  };

  return {
    id: itemId(item),
    name,
    systemNom,
    className,
    spellLists,
    level,
    normalizedName,
    keys,
    description: String(system?.description ?? ""),
    descriptionReelle: String(system?.description_reelle ?? ""),
    sourceFile
  };
}

function indexRows(rows, keyName) {
  const index = new Map();
  for (const row of rows) {
    const key = row?.keys?.[keyName];
    if (!key) continue;
    const candidates = index.get(key) ?? [];
    candidates.push(row);
    index.set(key, candidates);
  }
  return index;
}

function scanDecoupage(directory) {
  const rows = [];
  const details = {
    files: [],
    parseErrors: [],
    filesWithoutItems: [],
    sortRows: 0,
    sortsWithoutIdentity: []
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
      if (!row.normalizedName || row.level === "niveau_inconnu" || (!row.keys.spellLists && !row.keys.classe)) {
        details.sortsWithoutIdentity.push({ file: relative, id: row.id, nom: row.name || row.systemNom });
      }
      rows.push(row);
    }
    details.files.push({ file: relative, itemsContainer: key ?? "array", sorts: fileSorts });
  }

  return {
    rows,
    indexes: {
      spellLists: indexRows(rows, "spellLists"),
      classe: indexRows(rows, "classe")
    },
    details
  };
}

function scanV4(document) {
  const { key, items } = getItemsContainer(document);
  if (!items) throw new Error("Aucune collection d'items trouvée dans V4.");

  const rows = [];
  const details = {
    itemsContainer: key ?? "array",
    sourceItems: items.length,
    sortRows: 0,
    sortsWithoutIdentity: []
  };

  for (const item of items) {
    if (!isSpell(item)) continue;
    details.sortRows += 1;
    const row = rowFromItem(item, null);
    if (!row.normalizedName || row.level === "niveau_inconnu" || (!row.keys.spellLists && !row.keys.classe)) {
      details.sortsWithoutIdentity.push({ id: row.id, nom: row.name || row.systemNom });
    }
    rows.push(row);
  }

  return {
    rows,
    indexes: {
      spellLists: indexRows(rows, "spellLists"),
      classe: indexRows(rows, "classe")
    },
    details
  };
}

function rowSummary(row) {
  return {
    id: row.id,
    nom: row.name || row.systemNom,
    nomSysteme: row.systemNom,
    classe: row.className || null,
    listes: row.spellLists,
    niveau: row.level,
    fichier: row.sourceFile
  };
}

function rowReferenceKey(row) {
  return `${row.sourceFile ?? "v4"}|${row.id ?? "sans-id"}|${row.keys.spellLists ?? row.keys.classe ?? row.normalizedName}`;
}

function findResolution(row, v4Indexes, referenceIndexes) {
  const possible = [];
  const conflicts = [];
  for (const method of ["spellLists", "classe"]) {
    const key = row.keys?.[method];
    if (!key) continue;
    const sourceRows = v4Indexes[method].get(key) ?? [];
    const referenceRows = referenceIndexes[method].get(key) ?? [];
    if (sourceRows.length === 1 && referenceRows.length === 1) {
      possible.push({ method, key, reference: referenceRows[0] });
    } else if (sourceRows.length > 1 || referenceRows.length > 1) {
      conflicts.push({
        method,
        key,
        v4Candidates: sourceRows.map(rowSummary),
        decoupageCandidates: referenceRows.map(rowSummary)
      });
    }
  }

  const uniqueReferences = new Map(possible.map(entry => [rowReferenceKey(entry.reference), entry]));
  if (uniqueReferences.size === 1) {
    const entries = [...uniqueReferences.values()];
    const preferred = entries.find(entry => entry.method === "spellLists") ?? entries[0];
    return { status: "matched", ...preferred, supportingMethods: entries.map(entry => entry.method), conflicts };
  }
  if (uniqueReferences.size > 1 || conflicts.length) {
    return { status: "ambiguous", possibilities: possible, conflicts };
  }
  return { status: "unmatched" };
}

function metadataMismatch(v4, reference) {
  const mismatches = [];
  if (v4.name && reference.name && normalizeName(v4.name) !== normalizeName(reference.name)) mismatches.push("name");
  if (v4.systemNom && reference.systemNom && normalizeName(v4.systemNom) !== normalizeName(reference.systemNom)) mismatches.push("system.nom");
  if (v4.level !== reference.level) mismatches.push("niveau");
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
      matching: "unique_canonical_identity",
      canonicalIdentity: "spellLists ou classe + niveau + nom normalise",
      v4Field: "system.description",
      referenceField: "system.description_reelle",
      comparison: "normalisation de la mise en forme HTML, entités, espaces, apostrophes et tirets ; aucun rapprochement par description"
    },
    scope: {
      v4: v4.details,
      decoupage: decoupage.details
    },
    summary: {
      matchedCanonical: 0,
      matchedBySpellLists: 0,
      matchedByClasse: 0,
      descriptionsIdentical: 0,
      descriptionsDifferent: 0,
      descriptionsRawDifferentButNormalizedEqual: 0,
      v4DescriptionMissing: 0,
      referenceDescriptionReelleMissing: 0,
      v4OnlyCanonical: 0,
      decoupageOnlyCanonical: 0,
      ambiguousCanonicalMatches: 0,
      metadataMismatchOnMatchedRows: 0
    },
    candidates: {
      descriptionsDifferent: [],
      v4DescriptionMissing: [],
      referenceDescriptionReelleMissing: [],
      v4OnlyCanonical: [],
      decoupageOnlyCanonical: [],
      ambiguousCanonicalMatches: [],
      metadataMismatchOnMatchedRows: []
    },
    matched: []
  };

  const proposals = [];
  for (const row of v4.rows) {
    const resolution = findResolution(row, v4.indexes, decoupage.indexes);
    if (resolution.status === "matched") {
      proposals.push({ v4: row, reference: resolution.reference, method: resolution.method, key: resolution.key, supportingMethods: resolution.supportingMethods });
      continue;
    }
    if (resolution.status === "ambiguous") {
      report.summary.ambiguousCanonicalMatches += 1;
      report.candidates.ambiguousCanonicalMatches.push({
        v4: rowSummary(row),
        possibilities: resolution.possibilities.map(entry => ({ method: entry.method, key: entry.key, decoupage: rowSummary(entry.reference) })),
        conflicts: resolution.conflicts
      });
      continue;
    }
    report.summary.v4OnlyCanonical += 1;
    report.candidates.v4OnlyCanonical.push(rowSummary(row));
  }

  const proposalsByReference = new Map();
  for (const proposal of proposals) {
    const key = rowReferenceKey(proposal.reference);
    const rows = proposalsByReference.get(key) ?? [];
    rows.push(proposal);
    proposalsByReference.set(key, rows);
  }

  const accepted = [];
  for (const proposalsForReference of proposalsByReference.values()) {
    if (proposalsForReference.length === 1) {
      accepted.push(proposalsForReference[0]);
      continue;
    }
    report.summary.ambiguousCanonicalMatches += proposalsForReference.length;
    report.candidates.ambiguousCanonicalMatches.push({
      v4: proposalsForReference.map(proposal => rowSummary(proposal.v4)),
      decoupage: rowSummary(proposalsForReference[0].reference),
      reason: "plusieurs sorts V4 correspondent à la même référence du découpage"
    });
  }

  const usedReferences = new Set();
  for (const proposal of accepted) {
    const current = proposal.v4;
    const reference = proposal.reference;
    usedReferences.add(rowReferenceKey(reference));
    report.summary.matchedCanonical += 1;
    if (proposal.method === "spellLists") report.summary.matchedBySpellLists += 1;
    else report.summary.matchedByClasse += 1;

    const currentRaw = current.description;
    const referenceRaw = reference.descriptionReelle;
    const currentNormalized = normalizeDescription(currentRaw);
    const referenceNormalized = normalizeDescription(referenceRaw);
    const mismatch = metadataMismatch(current, reference);
    if (mismatch.length) {
      report.summary.metadataMismatchOnMatchedRows += 1;
      report.candidates.metadataMismatchOnMatchedRows.push({
        matchMethod: proposal.method,
        key: proposal.key,
        v4: rowSummary(current),
        decoupage: rowSummary(reference),
        mismatches: mismatch
      });
    }

    if (!currentNormalized) {
      report.summary.v4DescriptionMissing += 1;
      report.candidates.v4DescriptionMissing.push({ id: current.id, nom: current.name || current.systemNom, decoupageFile: reference.sourceFile, referencePreview: compactText(referenceRaw), matchMethod: proposal.method });
      continue;
    }
    if (!referenceNormalized) {
      report.summary.referenceDescriptionReelleMissing += 1;
      report.candidates.referenceDescriptionReelleMissing.push({ id: current.id, nom: current.name || current.systemNom, decoupageFile: reference.sourceFile, v4Preview: compactText(currentRaw), matchMethod: proposal.method });
      continue;
    }

    const normalizedEqual = currentNormalized === referenceNormalized;
    const rawEqual = currentRaw === referenceRaw;
    if (normalizedEqual) {
      report.summary.descriptionsIdentical += 1;
      if (!rawEqual) report.summary.descriptionsRawDifferentButNormalizedEqual += 1;
      report.matched.push({ id: current.id, nom: current.name || current.systemNom, status: rawEqual ? "identical_raw" : "identical_normalized", matchMethod: proposal.method, decoupageFile: reference.sourceFile });
      continue;
    }

    report.summary.descriptionsDifferent += 1;
    report.candidates.descriptionsDifferent.push({
      id: current.id,
      nom: current.name || current.systemNom,
      matchMethod: proposal.method,
      canonicalKey: proposal.key,
      v4: {
        id: current.id,
        name: current.name,
        systemNom: current.systemNom,
        level: current.level,
        description: currentRaw
      },
      decoupage: {
        id: reference.id,
        name: reference.name,
        systemNom: reference.systemNom,
        level: reference.level,
        file: reference.sourceFile,
        descriptionReelle: referenceRaw
      },
      firstDifference: firstDifference(currentNormalized, referenceNormalized)
    });
  }

  for (const reference of decoupage.rows) {
    const key = rowReferenceKey(reference);
    if (usedReferences.has(key)) continue;
    report.summary.decoupageOnlyCanonical += 1;
    report.candidates.decoupageOnlyCanonical.push(rowSummary(reference));
  }

  report.notice = "Ce rapport compare V4 à description_reelle du découpage. Les écarts signalent des candidats à vérifier dans le Manuel des joueurs ; aucune donnée n'est modifiée automatiquement.";
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
