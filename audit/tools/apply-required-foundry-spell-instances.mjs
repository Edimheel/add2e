import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
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
const isSpell = item => String(item?.type ?? item?.system?.type ?? "").toLowerCase() === "sort";
const read = file => JSON.parse(fs.readFileSync(file, "utf8"));
const write = (file, data) => fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");

function optionValue(argv, option) {
  const index = argv.indexOf(option);
  if (index < 0) return null;
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`Valeur manquante pour ${option}.`);
  return value;
}

function parseArgs(argv) {
  const diagnose = argv.includes("--diagnose-v4-spell");
  const patchNoMaterial = argv.includes("--patch-v4-no-material");
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log("Usage :");
    console.log("  node audit/tools/apply-required-foundry-spell-instances.mjs --diagnose-v4-spell --class Illusionniste --level 1 --name Bruitage");
    console.log("  node audit/tools/apply-required-foundry-spell-instances.mjs --patch-v4-no-material --class Illusionniste --level 1 --name Bruitage --components \"V, S\" [--dry-run]");
    console.log("");
    console.log("Cet outil ne lit ni n'écrit V3, les références, le compendium ou les rapports.");
    process.exit(0);
  }
  if (diagnose === patchNoMaterial) {
    throw new Error("Choisis exactement un mode : --diagnose-v4-spell ou --patch-v4-no-material.");
  }

  const className = optionValue(argv, "--class");
  const spellLevel = level(optionValue(argv, "--level"));
  const name = optionValue(argv, "--name");
  const components = optionValue(argv, "--components");
  if (!className || !spellLevel || !name) {
    throw new Error("--class, --level et --name sont obligatoires.");
  }
  if (patchNoMaterial && !components) {
    throw new Error("--components est obligatoire avec --patch-v4-no-material.");
  }
  return {
    diagnose,
    patchNoMaterial,
    dryRun: argv.includes("--dry-run"),
    className,
    spellLevel,
    name,
    components: components ? text(components) : null
  };
}

function hasMaterialComponent(components) {
  return /(^|[,;\s])M(?=$|[,;\s().])/u.test(text(components).toUpperCase());
}

function materialEntryCount(value) {
  if (Array.isArray(value)) return value.length;
  return value === undefined || value === null || value === "" ? 0 : 1;
}

function findSpellCandidates(items, className, spellLevel, name) {
  return items.filter(item => isSpell(item)
    && slug(item?.system?.classe) === slug(className)
    && level(item?.system?.niveau) === spellLevel
    && slug(item?.name ?? item?.system?.nom) === slug(name));
}

function findOneSpell(v4, args) {
  if (!Array.isArray(v4?.items)) throw new Error(`${V4_FILE} ne contient pas de tableau items.`);
  const candidates = findSpellCandidates(v4.items, args.className, args.spellLevel, args.name);
  if (!candidates.length) {
    throw new Error(`Aucun sort V4 : ${args.className} niveau ${args.spellLevel} — ${args.name}.`);
  }
  if (candidates.length > 1) {
    const ids = candidates.map(item => text(item?._id ?? item?.id) || "sans_id").join(", ");
    throw new Error(`Sort V4 ambigu : ${args.className} niveau ${args.spellLevel} — ${args.name} (${ids}).`);
  }
  return candidates[0];
}

function describeSpell(item) {
  const system = item.system ?? {};
  return {
    id: text(item?._id ?? item?.id) || null,
    classe: text(system.classe),
    niveau: level(system.niveau),
    nom: text(item.name ?? system.nom),
    composantes: text(system.composantes),
    composantsMateriels: materialEntryCount(system.composants_materiels)
  };
}

function printDiagnostic(item) {
  const data = describeSpell(item);
  console.log(`[ADD2E][V4_COMPONENT_DIAG] ${data.classe} niveau ${data.niveau} — ${data.nom}.`);
  console.log(`[ADD2E][V4_COMPONENT_DIAG] id=${data.id ?? "sans_id"}; composantes=${data.composantes || "absentes"}; composants_materiels=${data.composantsMateriels}.`);
  console.log("[ADD2E][V4_COMPONENT_DIAG] V3, références, compendium et rapports non lus et non modifiés.");
}

function patchNoMaterial(item, components) {
  if (hasMaterialComponent(components)) {
    throw new Error(`La correction V4 sans matière exige une valeur sans M ; reçu : ${components}.`);
  }
  const system = item.system ??= {};
  const changed = [];
  if (text(system.composantes) !== components) {
    system.composantes = components;
    changed.push("composantes");
  }
  if (materialEntryCount(system.composants_materiels) !== 0) {
    system.composants_materiels = [];
    changed.push("composants_materiels");
  }
  return changed;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const v4Path = path.join(ROOT, V4_FILE);
  const v4 = read(v4Path);
  const item = findOneSpell(v4, args);

  if (args.diagnose) {
    printDiagnostic(item);
    return;
  }

  const changed = patchNoMaterial(item, args.components);
  const data = describeSpell(item);
  if (!args.dryRun && changed.length) write(v4Path, v4);
  console.log(`[ADD2E][V4_COMPONENT_PATCH] ${args.dryRun ? "simulation" : "V4 mis à jour"} : ${data.classe} niveau ${data.niveau} — ${data.nom}.`);
  console.log(`[ADD2E][V4_COMPONENT_PATCH] ${changed.length ? changed.join(", ") : "déjà conforme"}.`);
  console.log("[ADD2E][V4_COMPONENT_PATCH] V3, références, compendium et rapports non lus et non modifiés.");
}

main();
