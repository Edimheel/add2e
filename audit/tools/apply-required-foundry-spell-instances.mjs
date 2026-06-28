import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const V3_FILE = "fvtt-spells-all-normalise-mecanique-v3.json";
const V4_FILE = "fvtt-spells-all-normalise-mecanique-v4.json";

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
  const diagnose = argv.includes("--diagnose-v3-to-v4");
  const sync = argv.includes("--sync-v3-to-v4");
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log("Usage :");
    console.log("  node audit/tools/apply-required-foundry-spell-instances.mjs --diagnose-v3-to-v4 --class Illusionniste --level 1 --name Bruitage");
    console.log("  node audit/tools/apply-required-foundry-spell-instances.mjs --sync-v3-to-v4 --class Illusionniste --level 1 --name Bruitage [--dry-run]");
    console.log("");
    console.log("V3 est lu uniquement comme source de vérité des composants. Seul V4 peut être écrit.");
    process.exit(0);
  }
  if (diagnose === sync) {
    throw new Error("Choisis exactement un mode : --diagnose-v3-to-v4 ou --sync-v3-to-v4.");
  }

  const className = optionValue(argv, "--class");
  const spellLevel = level(optionValue(argv, "--level"));
  const name = optionValue(argv, "--name");
  if (!className || !spellLevel || !name) {
    throw new Error("--class, --level et --name sont obligatoires.");
  }
  return {
    diagnose,
    sync,
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

function printDiagnostic(source, target) {
  const v3 = describeSpell(source);
  const v4 = describeSpell(target);
  const differences = componentDifferences(source, target);
  console.log(`[ADD2E][V3_TO_V4_COMPONENT_DIAG] ${v3.classe} niveau ${v3.niveau} — ${v3.nom}.`);
  console.log(`[ADD2E][V3_TO_V4_COMPONENT_DIAG] V3 id=${v3.id ?? "sans_id"}; composantes=${v3.composantes}; composants_materiels=${v3.composantsMateriels}.`);
  console.log(`[ADD2E][V3_TO_V4_COMPONENT_DIAG] V4 id=${v4.id ?? "sans_id"}; composantes=${v4.composantes}; composants_materiels=${v4.composantsMateriels}.`);
  console.log(`[ADD2E][V3_TO_V4_COMPONENT_DIAG] ${differences.length ? `à synchroniser : ${differences.join(", ")}` : "déjà synchronisé"}.`);
  console.log("[ADD2E][V3_TO_V4_COMPONENT_DIAG] V3 est lu uniquement ; références, compendium et rapports ne sont ni lus ni modifiés.");
}

function synchronizeFields(source, target) {
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

function main() {
  const args = parseArgs(process.argv.slice(2));
  const v3 = read(path.join(ROOT, V3_FILE));
  const v4Path = path.join(ROOT, V4_FILE);
  const v4 = read(v4Path);
  const source = findOneSpell(v3, "V3", args);
  const target = findOneSpell(v4, "V4", args);

  if (args.diagnose) {
    printDiagnostic(source, target);
    return;
  }

  const changes = synchronizeFields(source, target);
  const targetData = describeSpell(target);
  if (!args.dryRun && changes.length) write(v4Path, v4);
  console.log(`[ADD2E][V3_TO_V4_COMPONENT_SYNC] ${args.dryRun ? "simulation" : "V4 mis à jour"} : ${targetData.classe} niveau ${targetData.niveau} — ${targetData.nom}.`);
  console.log(`[ADD2E][V3_TO_V4_COMPONENT_SYNC] ${changes.length ? changes.join(", ") : "déjà synchronisé"}.`);
  console.log("[ADD2E][V3_TO_V4_COMPONENT_SYNC] V3 est lu uniquement ; références, compendium et rapports ne sont ni lus ni modifiés.");
}

main();
