import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const V3_FILE = "fvtt-spells-all-normalise-mecanique-v3.json";
const V4_FILE = "fvtt-spells-all-normalise-mecanique-v4.json";
const REFERENCE_DIR = path.join(ROOT, "audit/reference");
const REFERENCE_FILE_PATTERN = /^manuel-joueurs-(clerc|druide|magicien|illusionniste)-niveau-[1-9]\.json$/;
const HEADER_FIELDS = ["ecole", "portee", "duree", "zone_effet", "temps_incantation", "jet_sauvegarde"];
const FIELD_KEYS = {
  ecole: ["ecole", "école"],
  portee: ["portee", "portée"],
  duree: ["duree", "durée"],
  zone_effet: ["zone_effet"],
  temps_incantation: ["temps_incantation"],
  jet_sauvegarde: ["jet_sauvegarde"]
};
// Alias de rapprochement lecture seule : le titre V4 reste « Télékinésie ».
const V4_LOOKUP_ALIASES = new Map([
  ["magicien|5|teleikinesie", "magicien|5|telekinesie"]
]);

const text = value => String(value ?? "").replace(/\s+/g, " ").trim();
const level = value => Number(String(value ?? "").match(/\d+/)?.[0] ?? 0) || 0;
const slug = value => text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
const read = file => JSON.parse(fs.readFileSync(file, "utf8"));
const write = (file, data) => fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object ?? {}, key);
const isSpell = item => String(item?.type ?? item?.system?.type ?? "").toLowerCase() === "sort";
const clone = value => JSON.parse(JSON.stringify(value));

function keyOf(className, spellLevel, name) {
  const c = slug(className);
  const n = slug(name);
  const l = level(spellLevel);
  return c && n && l ? `${c}|${l}|${n}` : null;
}

function normalize(value) {
  return String(value ?? "").normalize("NFKC").replace(/[\u00a0\u2007\u202f]/g, " ").replace(/[\u2018\u2019\u02bc]/g, "'").replace(/[\u201c\u201d]/g, "\"").replace(/[\u2010-\u2015]/g, "-").replace(/\s+/g, " ").trim().toLocaleLowerCase("fr");
}

function scalar(value) {
  if (value == null) return "";
  if (typeof value === "object" && !Array.isArray(value)) return text(value.valeur ?? value.value ?? value.texte ?? "");
  return text(value);
}

function headerValue(system, field) {
  for (const key of FIELD_KEYS[field]) if (hasOwn(system, key)) return scalar(system[key]);
  return "";
}

function setHeaderValue(system, field, value) {
  const key = FIELD_KEYS[field].find(candidate => hasOwn(system, candidate)) ?? FIELD_KEYS[field][0];
  const previous = system[key];
  if (previous && typeof previous === "object" && !Array.isArray(previous)) {
    const valueKey = hasOwn(previous, "valeur") ? "valeur" : hasOwn(previous, "value") ? "value" : hasOwn(previous, "texte") ? "texte" : "valeur";
    system[key] = { ...previous, [valueKey]: value };
  } else system[key] = value;
}

function parseArgs(argv) {
  const modes = {
    diagnoseHeaders: argv.includes("--diagnose-v4-headers"),
    syncHeaders: argv.includes("--sync-v4-headers"),
    diagnoseComponents: argv.includes("--diagnose-v3-to-v4"),
    syncComponents: argv.includes("--sync-v3-to-v4")
  };
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log("Usage:");
    console.log("  node audit/tools/apply-required-foundry-spell-instances.mjs --diagnose-v4-headers");
    console.log("  node audit/tools/apply-required-foundry-spell-instances.mjs --sync-v4-headers [--dry-run]");
    console.log("  node audit/tools/apply-required-foundry-spell-instances.mjs --diagnose-v3-to-v4 --class Illusionniste --level 1 --name Bruitage");
    console.log("  node audit/tools/apply-required-foundry-spell-instances.mjs --sync-v3-to-v4 --class Illusionniste --level 1 --name Bruitage [--dry-run]");
    process.exit(0);
  }
  if (Object.values(modes).filter(Boolean).length !== 1) throw new Error("Choisis exactement un mode.");
  const args = {
    ...modes,
    dryRun: argv.includes("--dry-run"),
    className: null,
    spellLevel: 0,
    name: null
  };
  const value = option => {
    const index = argv.indexOf(option);
    return index < 0 ? null : argv[index + 1];
  };
  if (args.diagnoseComponents || args.syncComponents) {
    args.className = value("--class");
    args.spellLevel = level(value("--level"));
    args.name = value("--name");
    if (!args.className || !args.spellLevel || !args.name) throw new Error("--class, --level et --name sont obligatoires pour le mode composants.");
  }
  return args;
}

function indexItems(document) {
  if (!Array.isArray(document?.items)) throw new Error("Export sans tableau items.");
  const index = new Map();
  for (const item of document.items) {
    if (!isSpell(item)) continue;
    const system = item.system ?? {};
    const key = keyOf(system.classe, system.niveau, item.name ?? system.nom);
    if (!key) continue;
    const entries = index.get(key) ?? [];
    entries.push(item);
    index.set(key, entries);
  }
  return index;
}

function one(index, key, label) {
  const entries = index.get(key) ?? [];
  if (!entries.length) throw new Error(`${label} absent : ${key}.`);
  if (entries.length > 1) throw new Error(`${label} ambigu : ${key} (${entries.map(item => item._id ?? item.id ?? "sans_id").join(", ")}).`);
  return entries[0];
}

function loadHeaders() {
  const headers = new Map();
  const files = fs.readdirSync(REFERENCE_DIR).filter(file => REFERENCE_FILE_PATTERN.test(file)).sort((a, b) => a.localeCompare(b, "fr"));
  for (const file of files) {
    const document = read(path.join(REFERENCE_DIR, file));
    const className = text(document?.source?.classe);
    const defaultLevel = level(document?.source?.niveau);
    if (!className || !defaultLevel || !Array.isArray(document?.spells)) throw new Error(`Référence invalide : ${file}.`);
    for (const spell of document.spells) {
      const spellLevel = level(spell?.niveau ?? defaultLevel);
      const name = text(spell?.nom);
      const key = keyOf(className, spellLevel, name);
      if (!key || headers.has(key)) throw new Error(`Référence invalide ou dupliquée : ${file} — ${name}.`);
      const values = {};
      for (const field of HEADER_FIELDS) {
        if (!hasOwn(spell, field) || !text(spell[field])) throw new Error(`Entête incomplet : ${file} — ${name} (${field}).`);
        values[field] = text(spell[field]);
      }
      headers.set(key, { key, file, className, spellLevel, name, values });
    }
  }
  return headers;
}

function headerChanges(headers, v4Index) {
  const changes = [];
  const errors = [];
  for (const reference of headers.values()) {
    const lookupKey = V4_LOOKUP_ALIASES.get(reference.key) ?? reference.key;
    const matches = v4Index.get(lookupKey) ?? [];
    if (!matches.length) {
      errors.push(`${reference.className} niveau ${reference.spellLevel} — ${reference.name} : absent de V4.`);
      continue;
    }
    if (matches.length > 1) {
      errors.push(`${reference.className} niveau ${reference.spellLevel} — ${reference.name} : ${matches.length} instances V4.`);
      continue;
    }
    const item = matches[0];
    const system = item.system ?? {};
    const fields = HEADER_FIELDS.filter(field => normalize(headerValue(system, field)) !== normalize(reference.values[field]));
    if (fields.length) changes.push({ reference, item, fields });
  }
  if (errors.length) throw new Error(`Synchronisation des entêtes annulée:\n${errors.join("\n")}`);
  return changes;
}

function printHeaderResult(label, headers, changes) {
  const byField = Object.fromEntries(HEADER_FIELDS.map(field => [field, 0]));
  for (const change of changes) for (const field of change.fields) byField[field] += 1;
  console.log(`[ADD2E][V4_HEADER_SYNC] ${label} : ${headers.size} référence(s), ${changes.length} sort(s), ${changes.reduce((sum, change) => sum + change.fields.length, 0)} champ(s).`);
  console.log(`[ADD2E][V4_HEADER_SYNC] École ${byField.ecole}, portée ${byField.portee}, durée ${byField.duree}, zone ${byField.zone_effet}, incantation ${byField.temps_incantation}, sauvegarde ${byField.jet_sauvegarde}.`);
  for (const change of changes) console.log(`[ADD2E][V4_HEADER_SYNC] ${change.reference.className} niveau ${change.reference.spellLevel} — ${change.reference.name} : ${change.fields.join(", ")}.`);
  console.log("[ADD2E][V4_HEADER_SYNC] Composantes, composants_materiels, descriptions et titres V4 exclus.");
}

function runHeaders(args) {
  const headers = loadHeaders();
  const file = path.join(ROOT, V4_FILE);
  const v4 = read(file);
  const changes = headerChanges(headers, indexItems(v4));
  if (args.syncHeaders && !args.dryRun && changes.length) {
    for (const change of changes) {
      const system = change.item.system ??= {};
      for (const field of change.fields) setHeaderValue(system, field, change.reference.values[field]);
    }
    write(file, v4);
  }
  printHeaderResult(args.diagnoseHeaders ? "diagnostic" : args.dryRun ? "simulation" : "V4 mis à jour", headers, changes);
}

function runComponents(args) {
  const v3 = read(path.join(ROOT, V3_FILE));
  const file = path.join(ROOT, V4_FILE);
  const v4 = read(file);
  const key = keyOf(args.className, args.spellLevel, args.name);
  const source = one(indexItems(v3), key, "V3");
  const target = one(indexItems(v4), key, "V4");
  const sourceSystem = source.system ?? {};
  const targetSystem = target.system ??= {};
  const fields = ["composantes", "composants_materiels"].filter(field => JSON.stringify(sourceSystem[field]) !== JSON.stringify(targetSystem[field]));
  console.log(`[ADD2E][V3_TO_V4_COMPONENT_SYNC] ${args.className} niveau ${args.spellLevel} — ${args.name} : ${fields.length ? fields.join(", ") : "déjà synchronisé"}.`);
  if (args.syncComponents && !args.dryRun && fields.length) {
    for (const field of fields) {
      if (hasOwn(sourceSystem, field)) targetSystem[field] = clone(sourceSystem[field]);
      else delete targetSystem[field];
    }
    write(file, v4);
  }
}

const args = parseArgs(process.argv.slice(2));
if (args.diagnoseHeaders || args.syncHeaders) runHeaders(args);
else runComponents(args);
