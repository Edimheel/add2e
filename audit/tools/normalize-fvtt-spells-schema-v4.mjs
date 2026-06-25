import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ADD2E — V3 vers V4 : réduction stricte du schéma des sorts.
// Compatible avec les exports Foundry V13 / V14 / V15.
// Source unique des données : fvtt-spells-all-normalise-mecanique-v3.json.
// Aucun champ canonique n'est reconstruit depuis un champ historique.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SOURCE_FILE = "fvtt-spells-all-normalise-mecanique-v3.json";
const OUTPUT_FILE = "fvtt-spells-all-normalise-mecanique-v4.json";
const CONTROL_FILE = "fvtt-spells-all-normalise-mecanique-v4-controle.json";
const VERSION = "2026-06-25-spell-schema-v4-strict-v1";

const REQUIRED_SYSTEM_KEYS = Object.freeze([
  "nom",
  "classe",
  "spellLists",
  "niveau",
  "ecole",
  "portee",
  "duree",
  "zone_effet",
  "cible",
  "temps_incantation",
  "jet_sauvegarde",
  "composantes",
  "composants_materiels",
  "description",
  "onUse"
]);

const OPTIONAL_SYSTEM_KEYS = Object.freeze([
  "effectProfile"
]);

const CANONICAL_SYSTEM_KEYS = new Set([
  ...REQUIRED_SYSTEM_KEYS,
  ...OPTIONAL_SYSTEM_KEYS
]);

const LEGACY_SYSTEM_KEYS = new Set([
  "type",
  "onUseCode",
  "tags",
  "effectTags",
  "effecttags",
  "composants_materiels_objets",
  "composants_materiels_source",
  "composants_materiels_reference",
  "composants_materiels_verification_recommandee",
  "composants_materiels_note",
  "composants_materiels_a_renseigner"
]);

function parseArguments(argv) {
  const options = {
    source: SOURCE_FILE,
    output: OUTPUT_FILE,
    control: CONTROL_FILE,
    write: true
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];
    if (argument === "--source" && value) { options.source = value; index += 1; }
    else if (argument === "--output" && value) { options.output = value; index += 1; }
    else if (argument === "--control" && value) { options.control = value; index += 1; }
    else if (argument === "--dry-run") options.write = false;
    else if (argument === "--help") {
      console.log([
        "Usage : node audit/tools/normalize-fvtt-spells-schema-v4.mjs",
        "       [--source <fichier>] [--output <fichier>] [--control <fichier>] [--dry-run]"
      ].join("\n"));
      process.exit(0);
    }
  }

  return options;
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sha256(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function getItemsContainer(document) {
  if (Array.isArray(document)) return { key: null, items: document };
  for (const key of ["items", "Item", "Items", "documents", "data", "entries"]) {
    if (Array.isArray(document?.[key])) return { key, items: document[key] };
  }
  throw new Error("Aucune collection d'items trouvée dans l'export source.");
}

function isSpell(item) {
  return String(item?.type ?? item?.system?.type ?? "").toLowerCase() === "sort";
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object ?? {}, key);
}

function classifyRemovedKey(key) {
  return LEGACY_SYSTEM_KEYS.has(key) ? "legacy" : "outside-canonical-schema";
}

function count(map, key, increment = 1) {
  map[key] = (Number(map[key]) || 0) + increment;
}

function buildCanonicalSpell(item, control) {
  const result = clone(item);
  const sourceSystem = item?.system ?? {};
  const system = {};
  const missing = [];

  for (const key of REQUIRED_SYSTEM_KEYS) {
    if (hasOwn(sourceSystem, key)) system[key] = clone(sourceSystem[key]);
    else missing.push(key);
  }
  for (const key of OPTIONAL_SYSTEM_KEYS) {
    if (hasOwn(sourceSystem, key)) system[key] = clone(sourceSystem[key]);
  }

  // Aucun fallback : un champ absent reste absent. La seule valeur créée est le
  // tableau vide quand un champ canonique composants_materiels existe mais n'est
  // pas un tableau, ce qui est interdit : le script échoue avant d'écrire V4.
  if (hasOwn(sourceSystem, "composants_materiels") && !Array.isArray(sourceSystem.composants_materiels)) {
    control.invalidCanonicalMaterials.push({
      id: item?._id ?? item?.id ?? null,
      nom: item?.name ?? sourceSystem.nom ?? "",
      actualType: Array.isArray(sourceSystem.composants_materiels) ? "array" : typeof sourceSystem.composants_materiels
    });
  }

  for (const key of Object.keys(sourceSystem)) {
    count(control.observedSystemKeys, key);
    if (CANONICAL_SYSTEM_KEYS.has(key)) {
      count(control.keptSystemKeys, key);
      continue;
    }
    count(control.removedSystemKeys, key);
    count(control.removedSystemKeysByReason, classifyRemovedKey(key));
  }

  if (missing.length) {
    control.missingRequiredSystemKeys.push({
      id: item?._id ?? item?.id ?? null,
      nom: item?.name ?? sourceSystem.nom ?? "",
      missing
    });
  }

  result.system = system;
  return result;
}

function normalizeExport(source) {
  const document = clone(source);
  const { key, items } = getItemsContainer(document);
  const control = {
    version: VERSION,
    sourceFile: SOURCE_FILE,
    sourceSha256: sha256(source),
    generatedAt: new Date().toISOString(),
    canonicalSystemKeys: [...CANONICAL_SYSTEM_KEYS],
    requiredSystemKeys: [...REQUIRED_SYSTEM_KEYS],
    optionalSystemKeys: [...OPTIONAL_SYSTEM_KEYS],
    legacySystemKeys: [...LEGACY_SYSTEM_KEYS].sort(),
    root: {
      itemsContainer: key ?? "array",
      sourceItems: items.length,
      spells: 0,
      nonSpells: 0,
      folders: Array.isArray(document?.folders) ? document.folders.length : 0
    },
    observedSystemKeys: {},
    keptSystemKeys: {},
    removedSystemKeys: {},
    removedSystemKeysByReason: {},
    missingRequiredSystemKeys: [],
    invalidCanonicalMaterials: [],
    invariants: {
      changedEffects: [],
      changedFlags: [],
      changedFoundryEnvelope: [],
      remainingNonCanonicalSystemKeys: []
    }
  };

  const normalizedItems = items.map(item => {
    if (!isSpell(item)) {
      control.root.nonSpells += 1;
      return item;
    }

    control.root.spells += 1;
    const normalized = buildCanonicalSpell(item, control);
    const identity = normalized?._id ?? normalized?.id ?? normalized?.name ?? "sort-sans-id";

    if (JSON.stringify(item?.effects ?? []) !== JSON.stringify(normalized?.effects ?? [])) {
      control.invariants.changedEffects.push(identity);
    }
    if (JSON.stringify(item?.flags ?? {}) !== JSON.stringify(normalized?.flags ?? {})) {
      control.invariants.changedFlags.push(identity);
    }

    const envelopeKeys = new Set(["system"]);
    const beforeEnvelope = Object.fromEntries(Object.entries(item ?? {}).filter(([key]) => !envelopeKeys.has(key)));
    const afterEnvelope = Object.fromEntries(Object.entries(normalized ?? {}).filter(([key]) => !envelopeKeys.has(key)));
    if (JSON.stringify(beforeEnvelope) !== JSON.stringify(afterEnvelope)) {
      control.invariants.changedFoundryEnvelope.push(identity);
    }

    for (const systemKey of Object.keys(normalized.system ?? {})) {
      if (!CANONICAL_SYSTEM_KEYS.has(systemKey)) control.invariants.remainingNonCanonicalSystemKeys.push({ identity, systemKey });
    }

    return normalized;
  });

  if (key === null) return { output: normalizedItems, control };
  document[key] = normalizedItems;
  control.outputSha256 = sha256(document);
  return { output: document, control };
}

function assertClean(control) {
  const errors = [];
  if (control.missingRequiredSystemKeys.length) errors.push(`champs requis absents : ${control.missingRequiredSystemKeys.length}`);
  if (control.invalidCanonicalMaterials.length) errors.push(`composants_materiels non structurés : ${control.invalidCanonicalMaterials.length}`);
  if (control.invariants.changedEffects.length) errors.push(`ActiveEffects modifiés : ${control.invariants.changedEffects.length}`);
  if (control.invariants.changedFlags.length) errors.push(`flags modifiés : ${control.invariants.changedFlags.length}`);
  if (control.invariants.changedFoundryEnvelope.length) errors.push(`enveloppe Foundry modifiée : ${control.invariants.changedFoundryEnvelope.length}`);
  if (control.invariants.remainingNonCanonicalSystemKeys.length) errors.push(`clés système non canoniques restantes : ${control.invariants.remainingNonCanonicalSystemKeys.length}`);
  if (errors.length) throw new Error(`V4 non généré : ${errors.join(" ; ")}`);
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  const sourcePath = path.resolve(ROOT, options.source);
  const outputPath = path.resolve(ROOT, options.output);
  const controlPath = path.resolve(ROOT, options.control);
  const source = readJson(sourcePath);
  const { output, control } = normalizeExport(source);

  let error = null;
  try { assertClean(control); }
  catch (caught) { error = String(caught?.message ?? caught); }

  control.valid = error === null;
  control.error = error;

  if (options.write) {
    writeJson(controlPath, control);
    if (error) {
      console.error(`[ADD2E][SPELL_SCHEMA_V4] ${error}`);
      console.error(`[ADD2E][SPELL_SCHEMA_V4] Rapport écrit : ${path.relative(ROOT, controlPath)}`);
      process.exitCode = 1;
      return;
    }
    writeJson(outputPath, output);
  }

  console.log("[ADD2E][SPELL_SCHEMA_V4]", {
    version: VERSION,
    source: path.relative(ROOT, sourcePath),
    output: options.write ? path.relative(ROOT, outputPath) : "dry-run",
    control: options.write ? path.relative(ROOT, controlPath) : "dry-run",
    spells: control.root.spells,
    nonSpells: control.root.nonSpells,
    removedSystemKeys: control.removedSystemKeys,
    valid: control.valid
  });

  if (error) {
    console.error(`[ADD2E][SPELL_SCHEMA_V4] ${error}`);
    process.exitCode = 1;
  }
}

main();
