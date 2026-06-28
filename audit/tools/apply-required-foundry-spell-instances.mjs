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
const V4_LOOKUP_ALIASES = new Map([
  ["magicien|5|teleikinesie", "magicien|5|telekinesie"]
]);
const COMPONENT_LOOKUP_ALIASES = new Map([
  ["magicien|5|teleikinesie", "magicien|5|telekinesie"]
]);
const COMPONENT_FIELDS = ["composantes", "composants_materiels"];

const text = value => String(value ?? "").replace(/\s+/g, " ").trim();
const level = value => Number(String(value ?? "").match(/\d+/)?.[0] ?? 0) || 0;
const slug = value => text(value)
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[’']/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "_")
  .replace(/^_+|_+$/g, "");
const read = file => JSON.parse(fs.readFileSync(file, "utf8"));
const write = (file, data) => fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object ?? {}, key);
const isSpell = item => String(item?.type ?? item?.system?.type ?? "").toLowerCase() === "sort";
const clone = value => JSON.parse(JSON.stringify(value));
const sameJson = (left, right) => JSON.stringify(left) === JSON.stringify(right);

function keyOf(className, spellLevel, name) {
  const classKey = slug(className);
  const nameKey = slug(name);
  const normalizedLevel = level(spellLevel);
  return classKey && nameKey && normalizedLevel ? `${classKey}|${normalizedLevel}|${nameKey}` : null;
}

function normalize(value) {
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

function scalar(value) {
  if (value == null) return "";
  if (typeof value === "object" && !Array.isArray(value)) return text(value.valeur ?? value.value ?? value.texte ?? "");
  return text(value);
}

function label(item) {
  const system = item?.system ?? {};
  return `${text(system.classe) || "classe inconnue"} niveau ${level(system.niveau) || "?"} — ${text(item?.name ?? system.nom) || "sans nom"}`;
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
    syncComponents: argv.includes("--sync-v3-to-v4"),
    diagnoseAllComponents: argv.includes("--diagnose-v4-components-from-v3"),
    syncAllComponents: argv.includes("--sync-v4-components-from-v3")
  };
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log("Usage:");
    console.log("  node audit/tools/apply-required-foundry-spell-instances.mjs --diagnose-v4-headers");
    console.log("  node audit/tools/apply-required-foundry-spell-instances.mjs --sync-v4-headers [--dry-run]");
    console.log("  node audit/tools/apply-required-foundry-spell-instances.mjs --diagnose-v4-components-from-v3");
    console.log("  node audit/tools/apply-required-foundry-spell-instances.mjs --sync-v4-components-from-v3 [--dry-run]");
    console.log("  node audit/tools/apply-required-foundry-spell-instances.mjs --diagnose-v3-to-v4 --class Illusionniste --level 1 --name Bruitage");
    console.log("  node audit/tools/apply-required-foundry-spell-instances.mjs --sync-v3-to-v4 --class Illusionniste --level 1 --name Bruitage [--dry-run]");
    console.log("");
    console.log("Le mode global composants lit V3, contrôle M et recopie uniquement composantes et composants_materiels dans V4.");
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
    if (!args.className || !args.spellLevel || !args.name) throw new Error("--class, --level et --name sont obligatoires pour le mode composants ciblé.");
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

function one(index, key, sourceLabel) {
  const entries = index.get(key) ?? [];
  if (!entries.length) throw new Error(`${sourceLabel} absent : ${key}.`);
  if (entries.length > 1) throw new Error(`${sourceLabel} ambigu : ${key} (${entries.map(item => item._id ?? item.id ?? "sans_id").join(", ")}).`);
  return entries[0];
}

function loadHeaders() {
  const headers = new Map();
  const files = fs.readdirSync(REFERENCE_DIR)
    .filter(file => REFERENCE_FILE_PATTERN.test(file))
    .sort((left, right) => left.localeCompare(right, "fr"));

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
      headers.set(key, { key, className, spellLevel, name, values });
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

function printHeaderResult(labelText, headers, changes) {
  const byField = Object.fromEntries(HEADER_FIELDS.map(field => [field, 0]));
  for (const change of changes) for (const field of change.fields) byField[field] += 1;
  console.log(`[ADD2E][V4_HEADER_SYNC] ${labelText} : ${headers.size} référence(s), ${changes.length} sort(s), ${changes.reduce((sum, change) => sum + change.fields.length, 0)} champ(s).`);
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

function hasMMarker(value) {
  const tokens = String(scalar(value)).toLocaleUpperCase("fr").match(/[A-Z]+/g) ?? [];
  return tokens.includes("M");
}

function hasMaterialContent(value) {
  if (value == null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return Boolean(text(value));
}

function componentFieldDifferences(sourceSystem, targetSystem) {
  return COMPONENT_FIELDS.filter(field => {
    const sourceHas = hasOwn(sourceSystem, field);
    const targetHas = hasOwn(targetSystem, field);
    return sourceHas !== targetHas || (sourceHas && !sameJson(sourceSystem[field], targetSystem[field]));
  });
}

function copyComponentFields(sourceSystem, targetSystem, fields) {
  for (const field of fields) {
    if (hasOwn(sourceSystem, field)) targetSystem[field] = clone(sourceSystem[field]);
    else delete targetSystem[field];
  }
}

function componentCoherence(item) {
  const system = item.system ?? {};
  const hasM = hasMMarker(system.composantes);
  const hasArchitecture = hasOwn(system, "composants_materiels");
  const hasContent = hasArchitecture && hasMaterialContent(system.composants_materiels);
  if (!hasM && hasContent) return "materiaux_sans_M";
  if (hasM && !hasArchitecture) return "M_sans_architecture";
  if (hasM && !hasContent) return "M_architecture_vide";
  return null;
}

function collectGlobalComponentTargets(v3, v4) {
  const v3Index = indexItems(v3);
  const v4Index = indexItems(v4);
  const errors = [];
  const targets = [];
  const sourceItems = [];
  const mappedV4Keys = new Set();

  for (const [sourceKey, sourceEntries] of v3Index.entries()) {
    if (sourceEntries.length !== 1) {
      errors.push(`V3 ambigu : ${sourceKey} (${sourceEntries.length} instances).`);
      continue;
    }
    const source = sourceEntries[0];
    sourceItems.push(source);
    const lookupKey = COMPONENT_LOOKUP_ALIASES.get(sourceKey) ?? sourceKey;
    const targetEntries = v4Index.get(lookupKey) ?? [];
    if (!targetEntries.length) {
      errors.push(`${label(source)} : absent de V4.`);
      continue;
    }
    if (targetEntries.length > 1) {
      errors.push(`${label(source)} : ${targetEntries.length} instances V4.`);
      continue;
    }
    mappedV4Keys.add(lookupKey);
    const target = targetEntries[0];
    const fields = componentFieldDifferences(source.system ?? {}, target.system ?? {});
    targets.push({ source, target, fields });
  }

  const v4Only = [];
  for (const [v4Key, entries] of v4Index.entries()) {
    if (!mappedV4Keys.has(v4Key)) {
      for (const item of entries) v4Only.push(label(item));
    }
  }

  const coherence = {
    materiaux_sans_M: [],
    M_sans_architecture: [],
    M_architecture_vide: []
  };
  for (const source of sourceItems) {
    const status = componentCoherence(source);
    if (status) coherence[status].push(label(source));
  }

  return { sourceItems, targets, errors, v4Only, coherence };
}

function printComponentCoherence(coherence) {
  const total = coherence.materiaux_sans_M.length + coherence.M_sans_architecture.length + coherence.M_architecture_vide.length;
  console.log(`[ADD2E][V3_COMPONENT_COHERENCE] ${total} incohérence(s) V3 : matériaux sans M ${coherence.materiaux_sans_M.length}, M sans architecture ${coherence.M_sans_architecture.length}, M avec architecture vide ${coherence.M_architecture_vide.length}.`);
  for (const [kind, labels] of Object.entries(coherence)) {
    for (const entry of labels) console.log(`[ADD2E][V3_COMPONENT_COHERENCE] ${kind} : ${entry}.`);
  }
}

function printGlobalComponentResult(labelText, state) {
  const changes = state.targets.filter(target => target.fields.length);
  const byField = Object.fromEntries(COMPONENT_FIELDS.map(field => [field, 0]));
  for (const change of changes) for (const field of change.fields) byField[field] += 1;
  console.log(`[ADD2E][V3_TO_V4_COMPONENT_SYNC] ${labelText} : V3 ${state.sourceItems.length} sort(s), correspondances V4 ${state.targets.length}, V4 sans source ${state.v4Only.length}, sort(s) à mettre à jour ${changes.length}.`);
  console.log(`[ADD2E][V3_TO_V4_COMPONENT_SYNC] composantes ${byField.composantes}, composants_materiels ${byField.composants_materiels}.`);
  for (const change of changes) console.log(`[ADD2E][V3_TO_V4_COMPONENT_SYNC] ${label(change.source)} : ${change.fields.join(", ")}.`);
  for (const entry of state.v4Only) console.log(`[ADD2E][V3_TO_V4_COMPONENT_SYNC] V4 sans source V3 : ${entry}.`);
  console.log("[ADD2E][V3_TO_V4_COMPONENT_SYNC] Seuls system.composantes et system.composants_materiels sont synchronisés ; entêtes, descriptions, titres et V3 restent inchangés.");
}

function runAllComponents(args) {
  const v3 = read(path.join(ROOT, V3_FILE));
  const file = path.join(ROOT, V4_FILE);
  const v4 = read(file);
  const state = collectGlobalComponentTargets(v3, v4);
  printComponentCoherence(state.coherence);
  if (state.errors.length) throw new Error(`Synchronisation V3 → V4 annulée :\n${state.errors.join("\n")}`);
  if (args.syncAllComponents && !args.dryRun) {
    for (const target of state.targets) {
      if (target.fields.length) copyComponentFields(target.source.system ?? {}, target.target.system ??= {}, target.fields);
    }
    if (state.targets.some(target => target.fields.length)) write(file, v4);
  }
  printGlobalComponentResult(args.diagnoseAllComponents ? "diagnostic" : args.dryRun ? "simulation" : "V4 mis à jour", state);
}

function runTargetedComponents(args) {
  const v3 = read(path.join(ROOT, V3_FILE));
  const file = path.join(ROOT, V4_FILE);
  const v4 = read(file);
  const key = keyOf(args.className, args.spellLevel, args.name);
  const source = one(indexItems(v3), key, "V3");
  const target = one(indexItems(v4), key, "V4");
  const fields = componentFieldDifferences(source.system ?? {}, target.system ?? {});
  console.log(`[ADD2E][V3_TO_V4_COMPONENT_SYNC] ${label(source)} : ${fields.length ? fields.join(", ") : "déjà synchronisé"}.`);
  if (args.syncComponents && !args.dryRun && fields.length) {
    copyComponentFields(source.system ?? {}, target.system ??= {}, fields);
    write(file, v4);
  }
}

const args = parseArgs(process.argv.slice(2));
if (args.diagnoseHeaders || args.syncHeaders) runHeaders(args);
else if (args.diagnoseAllComponents || args.syncAllComponents) runAllComponents(args);
else runTargetedComponents(args);
