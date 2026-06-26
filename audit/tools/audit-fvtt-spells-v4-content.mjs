import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ADD2E — Audit de contenu de l'export de sorts V4.
// Compatible exports Foundry V13 / V14 / V15.
// Lecture seule de V4 : ce script ne réécrit jamais les sorts.
// composants_materiels est l'unique source matériel lue par cet audit.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DEFAULT_SOURCE = "fvtt-spells-all-normalise-mecanique-v4.json";
const DEFAULT_REPORT = "audit/rapports/AUDIT-SORTS-V4-CONTENU.json";
const VERSION = "2026-06-26-v4-content-audit-v1";

const REQUIRED_HEADER_KEYS = Object.freeze([
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
  "description",
  "onUse"
]);

function parseArguments(argv) {
  const options = {
    source: DEFAULT_SOURCE,
    report: DEFAULT_REPORT,
    write: true
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];
    if (argument === "--source" && value) { options.source = value; index += 1; }
    else if (argument === "--report" && value) { options.report = value; index += 1; }
    else if (argument === "--dry-run") options.write = false;
    else if (argument === "--help") {
      console.log([
        "Usage : node audit/tools/audit-fvtt-spells-v4-content.mjs",
        "       [--source <fichier-v4>] [--report <rapport-json>] [--dry-run]"
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

function sha1(value) {
  return crypto.createHash("sha1").update(String(value ?? "")).digest("hex");
}

function getItemsContainer(document) {
  if (Array.isArray(document)) return { key: null, items: document };
  for (const key of ["items", "Item", "Items", "documents", "data", "entries"]) {
    if (Array.isArray(document?.[key])) return { key, items: document[key] };
  }
  throw new Error("Aucune collection d'items trouvée dans l'export V4.");
}

function isSpell(item) {
  return String(item?.type ?? item?.system?.type ?? "").toLowerCase() === "sort";
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(?:#x27|#39);/gi, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeName(value) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function isBlank(value) {
  return value === undefined || value === null || (typeof value === "string" && !value.trim());
}

function asArray(value) {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(asArray);
  return [value];
}

function spellLists(system) {
  const values = asArray(system?.spellLists).length ? asArray(system?.spellLists) : asArray(system?.classe);
  return [...new Set(values.map(normalizeName).filter(Boolean))].sort();
}

function spellLevel(system) {
  const value = Number(String(system?.niveau ?? "").match(/\d+/)?.[0] ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function spellIdentity(item) {
  const system = item?.system ?? {};
  return `${spellLists(system).join("+") || "liste_inconnue"}|${spellLevel(system)}|${normalizeName(item?.name ?? system.nom)}`;
}

function containsMaterialComponent(value) {
  return /(?:^|[,;/\s])M(?:$|[,;/\s])/i.test(String(value ?? ""));
}

function compactValue(value) {
  if (Array.isArray(value)) return value.map(compactValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, compactValue(nested)]));
  }
  return value;
}

function summarizeProfile(item) {
  const add2e = item?.flags?.add2e ?? {};
  const reversible = add2e.reversible;
  const variant = add2e.variant ?? add2e.variants;
  const reversibleProfiles = Array.isArray(reversible?.profiles) ? reversible.profiles : [];
  const variantProfiles = Array.isArray(variant?.profiles) ? variant.profiles : [];

  return {
    reversibleProfiles: reversibleProfiles.map(profile => ({
      class: profile?.class ?? null,
      level: profile?.level ?? null,
      splitOnActorGrant: profile?.splitOnActorGrant === true,
      modes: asArray(profile?.modes).map(mode => String(mode?.id ?? "").trim()).filter(Boolean),
      inverseNameStatus: profile?.inverseNameStatus ?? null
    })),
    variantProfiles: variantProfiles.map(profile => ({
      class: profile?.class ?? null,
      level: profile?.level ?? null,
      choices: asArray(profile?.choices).map(choice => ({
        id: choice?.id ?? null,
        nom: choice?.nom ?? choice?.name ?? null
      }))
    }))
  };
}

function createBucketMap() {
  return new Map();
}

function addToBucket(map, key, value) {
  const rows = map.get(key) ?? [];
  rows.push(value);
  map.set(key, rows);
}

function makeReport(source, sourceName) {
  const { key: itemsContainer, items } = getItemsContainer(source);
  const spells = items.filter(isSpell);
  const duplicateIdentity = createBucketMap();
  const descriptionGroups = createBucketMap();
  const report = {
    version: VERSION,
    sourceFile: sourceName,
    sourceSha256: sha256(source),
    generatedAt: new Date().toISOString(),
    scope: {
      itemsContainer: itemsContainer ?? "array",
      sourceItems: items.length,
      spells: spells.length,
      nonSpells: items.length - spells.length
    },
    summary: {
      byClassAndLevel: {},
      reversibleProfiles: 0,
      variantProfiles: 0,
      variantChoices: 0
    },
    candidates: {
      headerMissingOrBlank: [],
      nameSystemNomMismatch: [],
      invalidCanonicalMaterials: [],
      materialRequiredButEmpty: [],
      materialsPresentWithoutM: [],
      materialRowsWithoutName: [],
      materialRowsWithoutConsumption: [],
      descriptionMissing: [],
      descriptionSharedByDifferentSpell: [],
      duplicateSpellIdentity: [],
      reversibleProfileWithoutInverseMode: [],
      splitReversibleWithoutInverseName: [],
      variantProfileWithoutChoice: [],
      variantChoiceWithoutName: []
    },
    rows: []
  };

  for (const item of spells) {
    const system = item?.system ?? {};
    const name = String(item?.name ?? "").trim();
    const systemNom = String(system?.nom ?? "").trim();
    const lists = spellLists(system);
    const level = spellLevel(system);
    const groupKey = `${lists.join("+") || "liste_inconnue"}|${level || "niveau_inconnu"}`;
    report.summary.byClassAndLevel[groupKey] = (report.summary.byClassAndLevel[groupKey] ?? 0) + 1;

    const id = item?._id ?? item?.id ?? null;
    const identity = spellIdentity(item);
    const missingHeaders = REQUIRED_HEADER_KEYS.filter(key => isBlank(system?.[key]));
    const description = String(system?.description ?? "").trim();
    const normalizedDescription = normalizeText(description);
    const materials = system?.composants_materiels;
    const materialArray = Array.isArray(materials) ? materials : null;
    const requiresMaterial = containsMaterialComponent(system?.composantes);
    const profiles = summarizeProfile(item);

    if (missingHeaders.length) report.candidates.headerMissingOrBlank.push({ id, nom: name || systemNom, missing: missingHeaders });
    if (name && systemNom && normalizeText(name) !== normalizeText(systemNom)) {
      report.candidates.nameSystemNomMismatch.push({ id, name, systemNom });
    }
    if (!materialArray) {
      report.candidates.invalidCanonicalMaterials.push({ id, nom: name || systemNom, actualType: typeof materials });
    } else {
      if (requiresMaterial && !materialArray.length) report.candidates.materialRequiredButEmpty.push({ id, nom: name || systemNom, composantes: system?.composantes ?? "" });
      if (!requiresMaterial && materialArray.length) report.candidates.materialsPresentWithoutM.push({ id, nom: name || systemNom, composantes: system?.composantes ?? "", count: materialArray.length });
      materialArray.forEach((entry, index) => {
        if (!entry || typeof entry !== "object" || !String(entry.nom ?? "").trim()) {
          report.candidates.materialRowsWithoutName.push({ id, nom: name || systemNom, index });
          return;
        }
        if (isBlank(entry.consommation)) report.candidates.materialRowsWithoutConsumption.push({ id, nom: name || systemNom, index, material: entry.nom });
      });
    }

    if (!normalizedDescription) report.candidates.descriptionMissing.push({ id, nom: name || systemNom });
    if (normalizedDescription) addToBucket(descriptionGroups, sha1(normalizedDescription), { id, name: name || systemNom, identity });
    addToBucket(duplicateIdentity, identity, { id, name: name || systemNom });

    profiles.reversibleProfiles.forEach((profile, index) => {
      report.summary.reversibleProfiles += 1;
      const inverseMode = profile.modes.some(mode => normalizeName(mode) === "inverse");
      if (!inverseMode) report.candidates.reversibleProfileWithoutInverseMode.push({ id, nom: name || systemNom, index });
      if (profile.splitOnActorGrant && !profile.inverseNameStatus) {
        report.candidates.splitReversibleWithoutInverseName.push({ id, nom: name || systemNom, index });
      }
    });
    profiles.variantProfiles.forEach((profile, index) => {
      report.summary.variantProfiles += 1;
      report.summary.variantChoices += profile.choices.length;
      if (!profile.choices.length) report.candidates.variantProfileWithoutChoice.push({ id, nom: name || systemNom, index });
      profile.choices.forEach((choice, choiceIndex) => {
        if (!String(choice.nom ?? "").trim()) report.candidates.variantChoiceWithoutName.push({ id, nom: name || systemNom, index, choiceIndex, choiceId: choice.id });
      });
    });

    report.rows.push({
      id,
      name,
      folder: item?.folder ?? null,
      identity,
      classLists: lists,
      level,
      header: Object.fromEntries(REQUIRED_HEADER_KEYS.map(key => [key, compactValue(system?.[key])])),
      descriptionHash: normalizedDescription ? sha1(normalizedDescription) : null,
      descriptionLength: description.length,
      materialRequired: requiresMaterial,
      materialCount: materialArray?.length ?? null,
      materials: compactValue(materialArray),
      profiles
    });
  }

  for (const [identity, rows] of duplicateIdentity) {
    if (rows.length > 1) report.candidates.duplicateSpellIdentity.push({ identity, rows });
  }
  for (const [descriptionHash, rows] of descriptionGroups) {
    const distinctNames = [...new Set(rows.map(row => normalizeName(row.name)).filter(Boolean))];
    if (rows.length > 1 && distinctNames.length > 1) {
      report.candidates.descriptionSharedByDifferentSpell.push({ descriptionHash, rows });
    }
  }

  report.rows.sort((left, right) => left.identity.localeCompare(right.identity, "fr", { sensitivity: "base" }));
  for (const key of Object.keys(report.summary.byClassAndLevel).sort()) {
    report.summary.byClassAndLevel[key] = report.summary.byClassAndLevel[key];
  }
  report.summary.candidateCounts = Object.fromEntries(
    Object.entries(report.candidates).map(([key, rows]) => [key, rows.length])
  );
  report.notice = "Les candidats ne sont pas des corrections automatiques. Chaque écart doit être vérifié dans le Manuel des joueurs avant modification des données.";
  return report;
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  const sourcePath = path.resolve(ROOT, options.source);
  const reportPath = path.resolve(ROOT, options.report);
  const source = readJson(sourcePath);
  const report = makeReport(source, path.relative(ROOT, sourcePath));

  if (options.write) writeJson(reportPath, report);

  console.log("[ADD2E][SPELL_V4_CONTENT_AUDIT]", {
    version: VERSION,
    source: path.relative(ROOT, sourcePath),
    report: options.write ? path.relative(ROOT, reportPath) : "dry-run",
    spells: report.scope.spells,
    candidates: report.summary.candidateCounts,
    reversibleProfiles: report.summary.reversibleProfiles,
    variantProfiles: report.summary.variantProfiles,
    variantChoices: report.summary.variantChoices
  });
}

main();
