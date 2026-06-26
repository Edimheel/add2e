import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DEFAULT_AUDIT = "audit/rapports/AUDIT-REFERENCES-SORTS-GLOBAL.json";
const DEFAULT_MASTER = "audit/reference/manuel-joueurs-sorts-master.json";
const DEFAULT_OUTPUT = "audit/rapports/PLAN-VERIFICATION-MANUEL-SORTS.json";
const TECHNICAL_FIELDS = ["ecole", "portee", "duree", "zone_effet", "composantes", "temps_incantation", "jet_sauvegarde"];
const PLACEHOLDERS = new Set(["", "a_completer", "a_remplir", "a_renseigner", "todo", "tbd", "inconnu", "non_renseigne", "non_disponible"]);

function parseArgs(argv) {
  const options = { audit: DEFAULT_AUDIT, master: DEFAULT_MASTER, output: DEFAULT_OUTPUT };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = argv[index + 1];
    if (arg === "--audit" && value) { options.audit = value; index += 1; }
    else if (arg === "--master" && value) { options.master = value; index += 1; }
    else if (arg === "--output" && value) { options.output = value; index += 1; }
    else if (arg === "--help" || arg === "-h") {
      console.log("Usage: node audit/tools/build-manual-spell-verification-plan.mjs [--audit audit/rapports/AUDIT-REFERENCES-SORTS-GLOBAL.json] [--master audit/reference/manuel-joueurs-sorts-master.json] [--output audit/rapports/PLAN-VERIFICATION-MANUEL-SORTS.json]");
      process.exit(0);
    } else throw new Error(`Argument inconnu ou incomplet : ${arg}`);
  }
  return options;
}

function readJson(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
function text(value) { return String(value ?? "").replace(/\s+/g, " ").trim(); }
function slug(value) {
  return text(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .toLocaleLowerCase("fr")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
function isPlaceholder(value) { return PLACEHOLDERS.has(slug(value)); }
function collection(document) {
  if (Array.isArray(document)) return document;
  for (const key of ["items", "Item", "Items", "documents", "data", "entries"]) {
    if (Array.isArray(document?.[key])) return document[key];
  }
  return [];
}
function level(value) {
  const parsed = Number(String(value ?? "").match(/\d+/)?.[0] ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}
function sameOrder(left, right) {
  return left.length === right.length && left.every((value, index) => slug(value) === slug(right[index]));
}
function listDiff(expected, actual) {
  const expectedKeys = new Set(expected.map(slug));
  const actualKeys = new Set(actual.map(slug));
  return {
    missing: expected.filter(name => !actualKeys.has(slug(name))),
    extra: actual.filter(name => !expectedKeys.has(slug(name))),
    orderMatches: sameOrder(expected, actual)
  };
}
function referenceNames(file) {
  const document = readJson(file);
  return Array.isArray(document?.spells) ? document.spells.map(spell => text(spell?.nom)).filter(Boolean) : [];
}
function decoupageNames(file, className, spellLevel) {
  const rows = collection(readJson(file));
  return rows
    .filter(item => String(item?.type ?? item?.system?.type ?? "").toLocaleLowerCase("fr") === "sort")
    .filter(item => slug(item?.system?.classe) === slug(className) && level(item?.system?.niveau) === spellLevel)
    .map(item => text(item?.name ?? item?.system?.nom))
    .filter(Boolean);
}
function fieldWork(spell) {
  const missing = [];
  const placeholder = [];
  const compareWithDecoupage = [];
  for (const field of TECHNICAL_FIELDS) {
    const row = spell?.technical?.[field] ?? {};
    if (row.value == null) missing.push(field);
    else if (isPlaceholder(row.value)) placeholder.push(field);
    if (row.comparison === "different") compareWithDecoupage.push(field);
  }
  const missingDescription = !spell?.description?.present;
  const descriptionDifferent = spell?.description?.comparison === "different";
  return { missing, placeholder, compareWithDecoupage, missingDescription, descriptionDifferent };
}
function priorityFor({ manualList, fileReport, spellTasks }) {
  const listBlocked = !manualList.available
    || manualList.reference.missing.length
    || manualList.reference.extra.length
    || !manualList.reference.orderMatches
    || manualList.decoupage.missing.length
    || manualList.decoupage.extra.length
    || !manualList.decoupage.orderMatches;
  if (listBlocked) return "P0_LISTE_MANUEL";
  const transcriptionNeeded = spellTasks.some(task => task.missing.length || task.placeholder.length || task.missingDescription);
  if (transcriptionNeeded) return "P1_TRANSCRIPTION_MANUEL";
  const comparisonNeeded = spellTasks.some(task => task.compareWithDecoupage.length || task.descriptionDifferent);
  if (comparisonNeeded || fileReport.summary.technicalDifferences || fileReport.summary.descriptionDifferences) return "P2_ARBITRAGE_MANUEL";
  return "P3_CONFIRMATION_MANUEL";
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const auditPath = path.resolve(ROOT, options.audit);
  const masterPath = path.resolve(ROOT, options.master);
  const outputPath = path.resolve(ROOT, options.output);
  const audit = readJson(auditPath);
  const master = readJson(masterPath);
  if (!Array.isArray(audit?.references)) throw new Error("Rapport d'audit invalide : references doit être un tableau.");
  if (!master?.lots || typeof master.lots !== "object") throw new Error("Fichier maître invalide : lots manquant.");

  const files = audit.references.map(fileReport => {
    const className = text(fileReport?.source?.classe);
    const spellLevel = level(fileReport?.source?.niveau);
    const lotKey = `${slug(className)}-niveau-${spellLevel}`;
    const manualNames = Array.isArray(master.lots?.[lotKey]) ? master.lots[lotKey].map(text).filter(Boolean) : null;
    const referencePath = path.resolve(ROOT, String(fileReport.referencePath ?? "").replace(/\\/g, path.sep));
    const decoupagePath = path.resolve(ROOT, String(fileReport.foundryExport ?? "").replace(/\\/g, path.sep));
    const referenceList = fs.existsSync(referencePath) ? referenceNames(referencePath) : [];
    const decoupageList = fs.existsSync(decoupagePath) ? decoupageNames(decoupagePath, className, spellLevel) : [];
    const manualList = {
      available: Array.isArray(manualNames),
      key: lotKey,
      expectedCount: manualNames?.length ?? null,
      names: manualNames ?? [],
      reference: manualNames ? listDiff(manualNames, referenceList) : { missing: [], extra: referenceList, orderMatches: false },
      decoupage: manualNames ? listDiff(manualNames, decoupageList) : { missing: [], extra: decoupageList, orderMatches: false }
    };
    const spellTasks = (fileReport.spells ?? []).map(spell => ({ nom: spell.nom, ...fieldWork(spell) }));
    const priority = priorityFor({ manualList, fileReport, spellTasks });
    const taskCounts = {
      technicalFieldsToTranscribe: spellTasks.reduce((sum, task) => sum + task.missing.length + task.placeholder.length, 0),
      descriptionsToTranscribe: spellTasks.filter(task => task.missingDescription).length,
      technicalFieldsToArbitrate: spellTasks.reduce((sum, task) => sum + task.compareWithDecoupage.length, 0),
      descriptionsToArbitrate: spellTasks.filter(task => task.descriptionDifferent).length
    };
    return {
      priority,
      file: fileReport.file,
      referencePath: fileReport.referencePath,
      foundryExport: fileReport.foundryExport,
      source: fileReport.source,
      manualList,
      auditStatus: fileReport.status,
      auditErrors: fileReport.errors,
      taskCounts,
      spellTasks: spellTasks.filter(task => task.missing.length || task.placeholder.length || task.missingDescription || task.compareWithDecoupage.length || task.descriptionDifferent)
    };
  }).sort((left, right) => left.priority.localeCompare(right.priority) || left.file.localeCompare(right.file, "fr"));

  const priorities = Object.fromEntries(["P0_LISTE_MANUEL", "P1_TRANSCRIPTION_MANUEL", "P2_ARBITRAGE_MANUEL", "P3_CONFIRMATION_MANUEL"].map(priority => [priority, files.filter(file => file.priority === priority)]));
  const summary = {
    references: files.length,
    spells: audit?.summary?.spells ?? files.reduce((sum, file) => sum + (file.manualList.expectedCount ?? 0), 0),
    byPriority: Object.fromEntries(Object.entries(priorities).map(([priority, rows]) => [priority, { references: rows.length, spells: rows.reduce((sum, row) => sum + (row.manualList.expectedCount ?? 0), 0) }])),
    technicalFieldsToTranscribe: files.reduce((sum, file) => sum + file.taskCounts.technicalFieldsToTranscribe, 0),
    descriptionsToTranscribe: files.reduce((sum, file) => sum + file.taskCounts.descriptionsToTranscribe, 0),
    technicalFieldsToArbitrate: files.reduce((sum, file) => sum + file.taskCounts.technicalFieldsToArbitrate, 0),
    descriptionsToArbitrate: files.reduce((sum, file) => sum + file.taskCounts.descriptionsToArbitrate, 0)
  };
  const output = {
    version: "2026-06-26-manual-spell-verification-plan-v1",
    generatedAt: new Date().toISOString(),
    sourceOfTruth: "Manuel des joueurs AD&D 2e",
    inputs: { audit: path.relative(ROOT, auditPath), master: path.relative(ROOT, masterPath) },
    rules: [
      "Le fichier maître sert uniquement à vérifier les listes, l'ordre et le nombre issus des tables du Manuel.",
      "Le découpage Foundry sert uniquement de comparaison ; il ne peut jamais compléter ou corriger une référence.",
      "Chaque champ marqué transcription ou arbitrage doit être lu dans le Manuel avant toute écriture.",
      "Les références sont corrigées avant tout JSON normalisé."
    ],
    summary,
    priorities,
    files
  };
  writeJson(outputPath, output);
  console.log(`[ADD2E][MANUAL_VERIFICATION_PLAN] ${summary.references} référence(s), ${summary.spells} sort(s).`);
  for (const [priority, rows] of Object.entries(priorities)) console.log(`[ADD2E][MANUAL_VERIFICATION_PLAN] ${priority}: ${rows.length} référence(s), ${rows.reduce((sum, row) => sum + (row.manualList.expectedCount ?? 0), 0)} sort(s).`);
  console.log(`[ADD2E][MANUAL_VERIFICATION_PLAN] À transcrire : ${summary.technicalFieldsToTranscribe} champ(s) technique(s), ${summary.descriptionsToTranscribe} description(s).`);
  console.log(`[ADD2E][MANUAL_VERIFICATION_PLAN] À arbitrer depuis le Manuel : ${summary.technicalFieldsToArbitrate} champ(s) technique(s), ${summary.descriptionsToArbitrate} description(s).`);
  console.log(`[ADD2E][MANUAL_VERIFICATION_PLAN] Plan écrit : ${path.relative(ROOT, outputPath)}`);
}

main();
