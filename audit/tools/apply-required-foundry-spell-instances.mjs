import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const V3_FILE = "fvtt-spells-all-normalise-mecanique-v3.json";
const V4_FILE = "fvtt-spells-all-normalise-mecanique-v4.json";
const REFERENCE_DIR = path.join(ROOT, "audit/reference");
const REFERENCE_FILE_PATTERN = /^manuel-joueurs-(clerc|druide|magicien|illusionniste)-niveau-[1-9]\.json$/;
const HEADER_FIELDS = ["ecole", "portee", "duree", "zone_effet", "temps_incantation", "jet_sauvegarde"];
const HEADER_FIELD_KEYS = {
  ecole: ["ecole", "école"],
  portee: ["portee", "portée"],
  duree: ["duree", "durée"],
  zone_effet: ["zone_effet"],
  temps_incantation: ["temps_incantation"],
  jet_sauvegarde: ["jet_sauvegarde"]
};

const text = value => String(value ?? "").replace(/\s+/g, " ").trim();
const level = value => Number(String(value ?? "").match(/\d+/)?.[0] ?? 0) || 0;
const slug = value => text(value)
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[’']/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "_")
  .replace(/^_+|_+$/g, "");
const copy = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const isSpell = item => String(item?.type ?? item?.system?.type ?? "").toLowerCase() === "sort";
const read = file => JSON.parse(fs.readFileSync(file, "utf8"));
const write = (file, data) => fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object ?? {}, key);
const sameJson = (left, right) => JSON.stringify(left) === JSON.stringify(right);

function optionValue(argv, option) {
  const index = argv.indexOf(option);
  if (index < 0) return null;
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`Valeur manquante pour ${option}.`);
  return value;
}

function parseArgs(argv) {
  const diagnoseComponents = argv.includes("--diagnose-v3-to-v4");
  const syncComponents = argv.includes("--sync-v3-to-v4");
  const diagnoseHeaders = argv.includes("--diagnose-v4-headers");
  const syncHeaders = argv.includes("--sync-v4-headers");
  const modeCount = [diagnoseComponents, syncComponents, diagnoseHeaders, syncHeaders].filter(Boolean).length;

  if (argv.includes("--help") || argv.includes("-h")) {
    console.log("Usage :");
    console.log("  node audit/tools/apply-required-foundry-spell-instances.mjs --diagnose-v4-headers");
    console.log("  node audit/tools/apply-required-foundry-spell-instances.mjs --sync-v4-headers [--dry-run]");
    console.log("  node audit/tools/apply-required-foundry-spell-instances.mjs --diagnose-v3-to-v4 --class Illusionniste --level 1 --name Bruitage");
    console.log("  node audit/tools/apply-required-foundry-spell-instances.mjs --sync-v3-to-v4 --class Illusionniste --level 1 --name Bruitage [--dry-run]");
    console.log("");
    console.log("Le mode entêtes modifie exclusivement V4 : ecole, portee, duree, zone_effet, temps_incantation et jet_sauvegarde.");
    process.exit(0);
  }
  if (modeCount !== 1) {
    throw new Error("Choisis exactement un mode de diagnostic ou de synchronisation.");
  }

  const componentMode = diagnoseComponents || syncComponents;
  const className = optionValue(argv, "--class");
  const spellLevel = level(optionValue(argv, "--level"));
  const name = optionValue(argv, "--name");
  if (componentMode && (!className || !spellLevel || !name)) {
    throw new Error("--class, --level et --name sont obligatoires pour le mode composants.");
  }
  return {
    diagnoseComponents,
    syncComponents,
    diagnoseHeaders,
    syncHeaders,
    dryRun: argv.includes("--dry-run"),
    className,
    spellLevel,
    name
  };
}

function findSpellCandidates(items, className, spellLevel, name) {
  return items.filter(item => isSpell(item)
    && slug(item?.system?.classe) === slug(className)
    && level(item?.system?.niveau) === spellLevel
    && slug(item?.name ?? item?.system?.nom) === slug(name));
}

function findOneSpell(document, sourceLabel, args) {
  if (!Array.isArray(document?.items)) throw new Error(`${sourceLabel} ne contient pas de tableau items.`);
  const candidates = findSpellCandidates(document.items, args.className, args.spellLevel, args.name);
  if (!candidates.length) {
    throw new Error(`Aucun sort ${sourceLabel} : ${args.className} niveau ${args.spellLevel} — ${args.name}.`);
  }
  if (candidates.length > 1) {
    const ids = candidates.map(item => text(item?._id ?? item?.id) || "sans_id").join(", ");
    throw new Error(`Sort ${sourceLabel} ambigu : ${args.className} niveau ${args.spellLevel} — ${args.name} (${ids}).`);
  }
  return candidates[0];
}

function materialEntryCount(value) {
  if (Array.isArray(value)) return value.length;
  return value === undefined || value === null || value === "" ? 0 : 1;
}

function describeSpell(item) {
  const system = item.system ?? {};
  return {
    id: text(item?._id ?? item?.id) || null,
    classe: text(system.classe),
    niveau: level(system.niveau),
    nom: text(item.name ?? system.nom),
    composantes: text(system.composantes) || "absentes",
    composantsMateriels: materialEntryCount(system.composants_materiels),
    hasComposantes: hasOwn(system, "composantes"),
    hasComposantsMateriels: hasOwn(system, "composants_materiels")
  };
}

function componentDifferences(source, target) {
  const sourceSystem = source.system ?? {};
  const targetSystem = target.system ?? {};
  const differences = [];
  for (const field of ["composantes", "composants_materiels"]) {
    const sourceHasField = hasOwn(sourceSystem, field);
    const targetHasField = hasOwn(targetSystem, field);
    const equal = sourceHasField === targetHasField && (!sourceHasField || sameJson(sourceSystem[field], targetSystem[field]));
    if (!equal) differences.push(field);
  }
  return differences;
}

function printComponentDiagnostic(source, target) {
  const v3 = describeSpell(source);
  const v4 = describeSpell(target);
  const differences = componentDifferences(source, target);
  console.log(`[ADD2E][V3_TO_V4_COMPONENT_DIAG] ${v3.classe} niveau ${v3.niveau} — ${v3.nom}.`);
  console.log(`[ADD2E][V3_TO_V4_COMPONENT_DIAG] V3 id=${v3.id ?? "sans_id"}; composantes=${v3.composantes}; composants_materiels=${v3.composantsMateriels}.`);
  console.log(`[ADD2E][V3_TO_V4_COMPONENT_DIAG] V4 id=${v4.id ?? "sans_id"}; composantes=${v4.composantes}; composants_materiels=${v4.composantsMateriels}.`);
  console.log(`[ADD2E][V3_TO_V4_COMPONENT_DIAG] ${differences.length ? `à synchroniser : ${differences.join(", ")}` : "déjà synchronisé"}.`);
  console.log("[ADD2E][V3_TO_V4_COMPONENT_DIAG] V3 est lu uniquement ; références, compendium et rapports ne sont ni lus ni modifiés.");
}

function synchronizeComponentFields(source, target) {
  const sourceSystem = source.system ?? {};
  const targetSystem = target.system ??= {};
  const changes = [];
  for (const field of ["composantes", "composants_materiels"]) {
    if (hasOwn(sourceSystem, field)) {
      if (!hasOwn(targetSystem, field) || !sameJson(targetSystem[field], sourceSystem[field])) {
        targetSystem[field] = copy(sourceSystem[field]);
        changes.push(field);
      }
    } else if (hasOwn(targetSystem, field)) {
      delete targetSystem[field];
      changes.push(field);
    }
  }
  return changes;
}

function spellKey(className, spellLevel, name) {
  const classKey = slug(className);
  const nameKey = slug(name);
  const normalizedLevel = level(spellLevel);
  return classKey && normalizedLevel && nameKey ? `${classKey}|${normalizedLevel}|${nameKey}` : null;
}

function scalar(value) {
  if (value == null) return "";
  if (typeof value === "object" && !Array.isArray(value)) return text(value.valeur ?? value.value ?? value.texte ?? "");
  return text(value);
}

function normalizeComparable(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[\u00a0\u2007\u202f]/g, " ")
    .replace(/[\u2018\u2019\u02bc]/g, "'")
    .replace(/[\u201c\u201d]/g, "\"")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("fr");
}

function headerFieldValue(system, field) {
  const keys = HEADER_FIELD_KEYS[field] ?? [field];
  for (const key of keys) {
    if (hasOwn(system, key)) return scalar(system[key]);
  }
  return "";
}

function existingHeaderFieldKey(system, field) {
  const keys = HEADER_FIELD_KEYS[field] ?? [field];
  return keys.find(key => hasOwn(system, key)) ?? keys[0];
}

function setHeaderFieldValue(system, field, value) {
  const key = existingHeaderFieldKey(system, field);
  const previous = system[key];
  if (previous && typeof previous === "object" && !Array.isArray(previous)) {
    const valueKey = hasOwn(previous, "valeur")
      ? "valeur"
      : hasOwn(previous, "value")
        ? "value"
        : hasOwn(previous, "texte")
          ? "texte"
          : "valeur";
    system[key] = { ...previous, [valueKey]: value };
  } else {
    system[key] = value;
  }
}

function loadReferenceHeaders() {
  const references = new Map();
  const files = fs.readdirSync(REFERENCE_DIR)
    .filter(file => REFERENCE_FILE_PATTERN.test(file))
    .sort((left, right) => left.localeCompare(right, "fr"));

  for (const file of files) {
    const document = read(path.join(REFERENCE_DIR, file));
    const className = text(document?.source?.classe);
    const defaultLevel = level(document?.source?.niveau);
    if (!className || !defaultLevel || !Array.isArray(document?.spells)) {
      throw new Error(`Référence invalide : audit/reference/${file}.`);
    }
    for (const spell of document.spells) {
      const spellLevel = level(spell?.niveau ?? defaultLevel);
      const name = text(spell?.nom);
      const key = spellKey(className, spellLevel, name);
      if (!key) throw new Error(`Identité de référence invalide : audit/reference/${file}.`);
      if (references.has(key)) throw new Error(`Référence dupliquée : ${key}.`);
      const headers = {};
      for (const field of HEADER_FIELDS) {
        if (!hasOwn(spell, field) || !text(spell[field])) {
          throw new Error(`Entête de référence incomplet : ${file} — ${name} (${field}).`);
        }
        headers[field] = text(spell[field]);
      }
      references.set(key, {
        key,
        file: `audit/reference/${file}`,
        className,
        spellLevel,
        name,
        headers
      });
    }
  }
  return references;
}

function v4SpellIndex(document) {
  if (!Array.isArray(document?.items)) throw new Error(`${V4_FILE} ne contient pas de tableau items.`);
  const index = new Map();
  for (const item of document.items) {
    if (!isSpell(item)) continue;
    const system = item.system ?? {};
    const key = spellKey(system.classe, system.niveau, item.name ?? system.nom);
    if (!key) continue;
    const entries = index.get(key) ?? [];
    entries.push(item);
    index.set(key, entries);
  }
  return index;
}

function validateHeaderTargets(references, v4Index) {
  const problems = [];
  const targets = [];
  for (const reference of references.values()) {
    const matches = v4Index.get(reference.key) ?? [];
    if (!matches.length) {
      problems.push(`${reference.className} niveau ${reference.spellLevel} — ${reference.name} : absent de V4.`);
      continue;
    }
    if (matches.length > 1) {
      const ids = matches.map(item => text(item?._id ?? item?.id) || "sans_id").join(", ");
      problems.push(`${reference.className} niveau ${reference.spellLevel} — ${reference.name} : ${matches.length} instances V4 (${ids}).`);
      continue;
    }
    targets.push({ reference, item: matches[0] });
  }
  if (problems.length) {
    throw new Error(`Synchronisation des entêtes annulée :\n${problems.join("\n")}`);
  }
  return targets;
}

function headerDifferences(reference, item) {
  const system = item.system ?? {};
  return HEADER_FIELDS.filter(field => normalizeComparable(headerFieldValue(system, field)) !== normalizeComparable(reference.headers[field]));
}

function summarizeHeaderChanges(targets) {
  const summary = {
    references: targets.length,
    spellsToUpdate: 0,
    fieldsToUpdate: 0,
    byField: Object.fromEntries(HEADER_FIELDS.map(field => [field, 0]))
  };
  const changes = [];
  for (const target of targets) {
    const fields = headerDifferences(target.reference, target.item);
    if (!fields.length) continue;
    summary.spellsToUpdate += 1;
    summary.fieldsToUpdate += fields.length;
    for (const field of fields) summary.byField[field] += 1;
    changes.push({ ...target, fields });
  }
  return { summary, changes };
}

function printHeaderSummary(mode, result) {
  const { summary, changes } = result;
  console.log(`[ADD2E][V4_HEADER_SYNC] ${mode} : ${summary.references} référence(s) contrôlée(s), ${summary.spellsToUpdate} sort(s) à corriger, ${summary.fieldsToUpdate} champ(s).`);
  console.log(`[ADD2E][V4_HEADER_SYNC] École ${summary.byField.ecole}, portée ${summary.byField.portee}, durée ${summary.byField.duree}, zone ${summary.byField.zone_effet}, incantation ${summary.byField.temps_incantation}, sauvegarde ${summary.byField.jet_sauvegarde}.`);
  for (const change of changes) {
    console.log(`[ADD2E][V4_HEADER_SYNC] ${change.reference.className} niveau ${change.reference.spellLevel} — ${change.reference.name} : ${change.fields.join(", ")}.`);
  }
  console.log("[ADD2E][V4_HEADER_SYNC] Composantes, composants_materiels et description exclus ; V3 non lu ; seules les données V4 d’entête peuvent être écrites.");
}

function applyHeaderChanges(changes) {
  for (const change of changes) {
    const system = change.item.system ??= {};
    for (const field of change.fields) {
      setHeaderFieldValue(system, field, change.reference.headers[field]);
    }
  }
}

function runHeaderMode(args) {
  const references = loadReferenceHeaders();
  const v4Path = path.join(ROOT, V4_FILE);
  const v4 = read(v4Path);
  const targets = validateHeaderTargets(references, v4SpellIndex(v4));
  const result = summarizeHeaderChanges(targets);

  if (args.diagnoseHeaders) {
    printHeaderSummary("diagnostic", result);
    return;
  }

  if (!args.dryRun && result.changes.length) {
    applyHeaderChanges(result.changes);
    write(v4Path, v4);
  }
  printHeaderSummary(args.dryRun ? "simulation" : "V4 mis à jour", result);
}

function runComponentMode(args) {
  const v3 = read(path.join(ROOT, V3_FILE));
  const v4Path = path.join(ROOT, V4_FILE);
  const v4 = read(v4Path);
  const source = findOneSpell(v3, "V3", args);
  const target = findOneSpell(v4, "V4", args);

  if (args.diagnoseComponents) {
    printComponentDiagnostic(source, target);
    return;
  }

  const changes = synchronizeComponentFields(source, target);
  const targetData = describeSpell(target);
  if (!args.dryRun && changes.length) write(v4Path, v4);
  console.log(`[ADD2E][V3_TO_V4_COMPONENT_SYNC] ${args.dryRun ? "simulation" : "V4 mis à jour"} : ${targetData.classe} niveau ${targetData.niveau} — ${targetData.nom}.`);
  console.log(`[ADD2E][V3_TO_V4_COMPONENT_SYNC] ${changes.length ? changes.join(", ") : "déjà synchronisé"}.`);
  console.log("[ADD2E][V3_TO_V4_COMPONENT_SYNC] V3 est lu uniquement ; références, compendium et rapports ne sont ni lus ni modifiés.");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.diagnoseHeaders || args.syncHeaders) runHeaderMode(args);
  else runComponentMode(args);
}

main();
