import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ADD2E — Compare les descriptions V4 aux descriptions_reelle du découpage.
// Lecture seule : ne modifie jamais V4, les fichiers de découpage ou les références.
// Liaison stricte par classe + niveau + nom normalisé, sans rapprochement par description.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DEFAULT_V4 = "fvtt-spells-all-normalise-mecanique-v4.json";
const DEFAULT_DECOUPAGE = "audit/decoupage_fichier";
const DEFAULT_REPORT = "audit/rapports/COMPARAISON-DESCRIPTIONS-V4-DECOUPAGE.json";
const VERSION = "2026-06-26-compare-v4-descriptions-decoupage-v3";
const PLACEHOLDERS = new Set(["a_completer", "a_remplir", "a_renseigner", "todo", "tbd", "inconnu", "non_renseigne", "non_disponible"]);

function optionsFrom(argv) {
  const options = { v4: DEFAULT_V4, decoupage: DEFAULT_DECOUPAGE, report: DEFAULT_REPORT, write: true };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = argv[index + 1];
    if (arg === "--v4" && value) { options.v4 = value; index += 1; }
    else if (arg === "--decoupage" && value) { options.decoupage = value; index += 1; }
    else if (arg === "--report" && value) { options.report = value; index += 1; }
    else if (arg === "--dry-run") options.write = false;
  }
  return options;
}

function readJson(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }
function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function jsonFiles(directory) {
  const files = [];
  const visit = current => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith(".json")) files.push(full);
    }
  };
  visit(directory);
  return files.sort((left, right) => left.localeCompare(right, "fr", { sensitivity: "base" }));
}

function collection(document) {
  if (Array.isArray(document)) return document;
  for (const key of ["items", "Item", "Items", "documents", "data", "entries"]) {
    if (Array.isArray(document?.[key])) return document[key];
  }
  return null;
}

function isSpell(item) { return String(item?.type ?? item?.system?.type ?? "").toLowerCase() === "sort"; }

function decode(value) {
  return String(value ?? "")
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_m, decimal) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function nameKey(value) {
  return decode(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .trim()
    .toLocaleLowerCase("fr")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function levelKey(value) {
  const parsed = Number(String(value ?? "").match(/\d+/)?.[0] ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? String(Math.floor(parsed)) : "niveau_inconnu";
}

function descriptionBase(value) {
  return decode(value)
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

function descriptionFormatting(value) {
  return descriptionBase(value)
    .replace(/\s+([,;:!?])/g, "$1")
    .replace(/([«])\s+/g, "$1")
    .replace(/\s+([»])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function descriptionContent(value) {
  return descriptionFormatting(value)
    .replace(/[.,;:!?()[\]{}"«»…/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstDifference(left, right) {
  const max = Math.min(left.length, right.length);
  let index = 0;
  while (index < max && left[index] === right[index]) index += 1;
  if (index === left.length && index === right.length) return null;
  const from = Math.max(0, index - 80);
  return {
    index,
    v4Context: left.slice(from, Math.min(left.length, index + 120)),
    referenceContext: right.slice(from, Math.min(right.length, index + 120))
  };
}

function isPlaceholder(value) {
  const normalized = nameKey(value);
  return !normalized || PLACEHOLDERS.has(normalized);
}

function identity(item) {
  const system = item?.system ?? {};
  const name = String(item?.name ?? system.nom ?? "").trim();
  const className = nameKey(system.classe);
  const level = levelKey(system.niveau);
  const normalizedName = nameKey(name || system.nom);
  return className && level !== "niveau_inconnu" && normalizedName
    ? `classe:${className}|niveau:${level}|nom:${normalizedName}`
    : null;
}

function row(item, sourceFile = null) {
  const system = item?.system ?? {};
  const name = String(item?.name ?? system.nom ?? "").trim();
  return {
    id: String(item?._id ?? item?.id ?? "") || null,
    nom: name || String(system.nom ?? "").trim(),
    classe: String(system.classe ?? "").trim(),
    niveau: levelKey(system.niveau),
    key: identity(item),
    description: String(system.description ?? ""),
    descriptionReelle: String(system.description_reelle ?? ""),
    fichier: sourceFile
  };
}

function add(index, key, value) {
  if (!key) return;
  const values = index.get(key) ?? [];
  values.push(value);
  index.set(key, values);
}

function scanV4(document) {
  const items = collection(document);
  if (!items) throw new Error("Aucune collection d'items trouvée dans V4.");
  const rows = items.filter(isSpell).map(item => row(item));
  const index = new Map();
  for (const item of rows) add(index, item.key, item);
  return { rows, index, sourceItems: items.length };
}

function scanDecoupage(directory) {
  const rows = [];
  const parseErrors = [];
  const filesWithoutItems = [];
  for (const file of jsonFiles(directory)) {
    let document;
    try { document = readJson(file); }
    catch (error) {
      parseErrors.push({ file: path.relative(ROOT, file), error: String(error?.message ?? error) });
      continue;
    }
    const items = collection(document);
    if (!items) {
      filesWithoutItems.push(path.relative(ROOT, file));
      continue;
    }
    for (const item of items) if (isSpell(item)) rows.push(row(item, path.relative(ROOT, file)));
  }
  const index = new Map();
  for (const item of rows) add(index, item.key, item);
  return { rows, index, parseErrors, filesWithoutItems };
}

function compact(value, max = 180) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

function pair(current, reference) {
  return {
    id: current.id,
    nom: current.nom,
    cle: current.key,
    v4: {
      id: current.id,
      nom: current.nom,
      classe: current.classe,
      niveau: current.niveau,
      description: current.description
    },
    decoupage: {
      id: reference.id,
      nom: reference.nom,
      classe: reference.classe,
      niveau: reference.niveau,
      fichier: reference.fichier,
      descriptionReelle: reference.descriptionReelle
    }
  };
}

function compare(current, reference) {
  const currentFormat = descriptionFormatting(current.description);
  const referenceFormat = descriptionFormatting(reference.descriptionReelle);
  if (!currentFormat) return { kind: "v4_missing" };
  if (isPlaceholder(reference.descriptionReelle)) return { kind: "reference_placeholder_or_empty", value: nameKey(reference.descriptionReelle) || "empty" };
  if (current.description === reference.descriptionReelle) return { kind: "identical_raw" };
  if (currentFormat === referenceFormat) return { kind: "formatting_only", detail: "whitespace_or_typography" };
  const currentContent = descriptionContent(current.description);
  const referenceContent = descriptionContent(reference.descriptionReelle);
  if (currentContent === referenceContent) return { kind: "formatting_only", detail: "punctuation_only" };
  return { kind: "content_different", currentContent, referenceContent };
}

function makeReport(v4Document, v4File, decoupageDirectory) {
  const v4 = scanV4(v4Document);
  const decoupage = scanDecoupage(decoupageDirectory);
  const report = {
    version: VERSION,
    source: {
      v4File,
      decoupageDirectory: path.relative(ROOT, decoupageDirectory)
    },
    generatedAt: new Date().toISOString(),
    method: {
      matching: "unique_class_level_normalized_name",
      v4Field: "system.description",
      referenceField: "system.description_reelle",
      classification: "identique brut, formatage seul, référence incomplète, différence de contenu"
    },
    summary: {
      v4Spells: v4.rows.length,
      decoupageSpells: decoupage.rows.length,
      matchedCanonical: 0,
      descriptionsIdentical: 0,
      descriptionsIdenticalRaw: 0,
      descriptionsFormattingOnly: 0,
      descriptionsContentDifferent: 0,
      descriptionsDifferent: 0,
      descriptionsRawDifferentButNormalizedEqual: 0,
      v4DescriptionMissing: 0,
      referencePlaceholderOrEmpty: 0,
      v4OnlyCanonical: 0,
      decoupageOnlyCanonical: 0,
      ambiguousCanonicalMatches: 0,
      decoupageParseErrors: decoupage.parseErrors.length
    },
    candidates: {
      descriptionsFormattingOnly: [],
      descriptionsContentDifferent: [],
      descriptionsDifferent: [],
      v4DescriptionMissing: [],
      referencePlaceholderOrEmpty: [],
      v4OnlyCanonical: [],
      decoupageOnlyCanonical: [],
      ambiguousCanonicalMatches: []
    },
    matched: []
  };

  const usedReferences = new Set();
  for (const current of v4.rows) {
    if (!current.key) {
      report.summary.v4OnlyCanonical += 1;
      report.candidates.v4OnlyCanonical.push({ id: current.id, nom: current.nom, reason: "identite_incomplete" });
      continue;
    }
    const references = decoupage.index.get(current.key) ?? [];
    const v4Candidates = v4.index.get(current.key) ?? [];
    if (references.length !== 1 || v4Candidates.length !== 1) {
      report.summary.ambiguousCanonicalMatches += 1;
      report.candidates.ambiguousCanonicalMatches.push({
        cle: current.key,
        v4: v4Candidates.map(value => ({ id: value.id, nom: value.nom })),
        decoupage: references.map(value => ({ id: value.id, nom: value.nom, fichier: value.fichier }))
      });
      continue;
    }

    const reference = references[0];
    usedReferences.add(`${reference.fichier}|${reference.id}|${reference.key}`);
    report.summary.matchedCanonical += 1;
    const result = compare(current, reference);
    const data = pair(current, reference);

    if (result.kind === "identical_raw") {
      report.summary.descriptionsIdentical += 1;
      report.summary.descriptionsIdenticalRaw += 1;
      report.matched.push({ id: current.id, nom: current.nom, status: "identical_raw", fichier: reference.fichier });
    } else if (result.kind === "formatting_only") {
      report.summary.descriptionsIdentical += 1;
      report.summary.descriptionsFormattingOnly += 1;
      report.summary.descriptionsRawDifferentButNormalizedEqual += 1;
      report.candidates.descriptionsFormattingOnly.push({ ...data, detail: result.detail, firstDifference: firstDifference(current.description, reference.descriptionReelle) });
      report.matched.push({ id: current.id, nom: current.nom, status: "formatting_only", detail: result.detail, fichier: reference.fichier });
    } else if (result.kind === "v4_missing") {
      report.summary.v4DescriptionMissing += 1;
      report.candidates.v4DescriptionMissing.push({ ...data, referencePreview: compact(reference.descriptionReelle) });
    } else if (result.kind === "reference_placeholder_or_empty") {
      report.summary.referencePlaceholderOrEmpty += 1;
      report.candidates.referencePlaceholderOrEmpty.push({ ...data, placeholder: result.value, v4Preview: compact(current.description) });
    } else {
      report.summary.descriptionsContentDifferent += 1;
      report.summary.descriptionsDifferent += 1;
      const difference = { ...data, firstDifference: firstDifference(result.currentContent, result.referenceContent) };
      report.candidates.descriptionsContentDifferent.push(difference);
      report.candidates.descriptionsDifferent.push(difference);
    }
  }

  for (const reference of decoupage.rows) {
    const key = `${reference.fichier}|${reference.id}|${reference.key}`;
    if (usedReferences.has(key)) continue;
    report.summary.decoupageOnlyCanonical += 1;
    report.candidates.decoupageOnlyCanonical.push({ id: reference.id, nom: reference.nom, cle: reference.key, fichier: reference.fichier });
  }

  report.scope = {
    decoupageParseErrors: decoupage.parseErrors,
    decoupageFilesWithoutItems: decoupage.filesWithoutItems
  };
  report.notice = "Les différences de contenu sont des candidats à vérifier dans le Manuel des joueurs. Aucun sort n'est modifié par cet outil.";
  return report;
}

function main() {
  const options = optionsFrom(process.argv.slice(2));
  const v4Path = path.resolve(ROOT, options.v4);
  const decoupagePath = path.resolve(ROOT, options.decoupage);
  const reportPath = path.resolve(ROOT, options.report);
  const report = makeReport(readJson(v4Path), path.relative(ROOT, v4Path), decoupagePath);
  if (options.write) writeJson(reportPath, report);
  console.log("[ADD2E][COMPARE_V4_DESCRIPTIONS]", {
    version: VERSION,
    v4: path.relative(ROOT, v4Path),
    decoupage: path.relative(ROOT, decoupagePath),
    report: options.write ? path.relative(ROOT, reportPath) : "dry-run",
    summary: report.summary
  });
}

main();
