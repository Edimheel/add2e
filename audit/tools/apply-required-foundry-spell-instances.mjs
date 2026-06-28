import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const V3_FILE = "fvtt-spells-all-normalise-mecanique-v3.json";
const V4_FILE = "fvtt-spells-all-normalise-mecanique-v4.json";
const REFERENCE_DIR = path.join(ROOT, "audit/reference");
const REFERENCE_FILE_PATTERN = /^manuel-joueurs-(clerc|druide|magicien|illusionniste)-niveau-[1-9]\.json$/;
const HEADER_FIELDS = ["ecole", "portee", "duree", "zone_effet", "temps_incantation", "jet_sauvegarde"];
const COMPONENT_FIELDS = ["composantes", "composants_materiels"];
const DESCRIPTION_FIELDS = ["description_reelle", "description"];
const REVERSIBLE_FIELDS = ["reversible", "inverse", "variantes", "inverseNameStatus"];
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

function normalizeDescription(value) {
  return normalize(String(value ?? "")
    .replace(/<\s*br\s*\/?>/gi, " ")
    .replace(/<\s*\/\s*p\s*>/gi, " ")
    .replace(/<[^>]*>/g, " "));
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

function descriptionField(system) {
  return DESCRIPTION_FIELDS.find(field => hasOwn(system, field)) ?? null;
}

function parseArgs(argv) {
  const modes = {
    diagnoseHeaders: argv.includes("--diagnose-v4-headers"),
    syncHeaders: argv.includes("--sync-v4-headers"),
    diagnoseDescriptions: argv.includes("--diagnose-v4-descriptions"),
    syncDescriptions: argv.includes("--sync-v4-descriptions"),
    diagnoseComponents: argv.includes("--diagnose-v3-to-v4"),
    syncComponents: argv.includes("--sync-v3-to-v4"),
    diagnoseAllComponents: argv.includes("--diagnose-v4-components-from-v3"),
    syncAllComponents: argv.includes("--sync-v4-components-from-v3"),
    diagnoseReversible: argv.includes("--diagnose-v4-reversible"),
    syncReversible: argv.includes("--sync-v4-reversible")
  };
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log("Usage:");
    console.log("  node audit/tools/apply-required-foundry-spell-instances.mjs --diagnose-v4-headers");
    console.log("  node audit/tools/apply-required-foundry-spell-instances.mjs --sync-v4-headers [--dry-run]");
    console.log("  node audit/tools/apply-required-foundry-spell-instances.mjs --diagnose-v4-descriptions");
    console.log("  node audit/tools/apply-required-foundry-spell-instances.mjs --sync-v4-descriptions [--dry-run]");
    console.log("  node audit/tools/apply-required-foundry-spell-instances.mjs --diagnose-v4-components-from-v3");
    console.log("  node audit/tools/apply-required-foundry-spell-instances.mjs --sync-v4-components-from-v3 [--dry-run]");
    console.log("  node audit/tools/apply-required-foundry-spell-instances.mjs --diagnose-v3-to-v4 --class Illusionniste --level 1 --name Bruitage");
    console.log("  node audit/tools/apply-required-foundry-spell-instances.mjs --sync-v3-to-v4 --class Illusionniste --level 1 --name Bruitage [--dry-run]");
    console.log("  node audit/tools/apply-required-foundry-spell-instances.mjs --diagnose-v4-reversible --class Clerc --level 1 --name \"Détection du mal\"");
    console.log("  node audit/tools/apply-required-foundry-spell-instances.mjs --sync-v4-reversible --class Clerc --level 1 --name \"Détection du mal\" [--dry-run]");
    console.log("");
    console.log("Le mode descriptions lit les références et n'écrit que le champ de description existant dans V4.");
    console.log("Le mode réversible ciblé ne crée aucun sort ; il écrit uniquement reversible, inverse, variantes et inverseNameStatus depuis la référence.");
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
  const targeted = args.diagnoseComponents || args.syncComponents || args.diagnoseReversible || args.syncReversible;
  if (targeted) {
    args.className = value("--class");
    args.spellLevel = level(value("--level"));
    args.name = value("--name");
    if (!args.className || !args.spellLevel || !args.name) throw new Error("--class, --level et --name sont obligatoires pour ce mode ciblé.");
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

function reversibilityFromSpell(spell) {
  return {
    reversible: spell?.reversible === true,
    inverse: hasOwn(spell ?? {}, "inverse") ? text(spell.inverse) : null,
    variantes: hasOwn(spell ?? {}, "variantes") ? clone(spell.variantes) : null,
    inverseNameStatus: hasOwn(spell ?? {}, "inverseNameStatus") ? text(spell.inverseNameStatus) : null
  };
}

function loadReferences() {
  const references = new Map();
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
      if (!key || references.has(key)) throw new Error(`Référence invalide ou dupliquée : ${file} — ${name}.`);
      const headers = {};
      for (const field of HEADER_FIELDS) {
        if (!hasOwn(spell, field) || !text(spell[field])) throw new Error(`Entête incomplet : ${file} — ${name} (${field}).`);
        headers[field] = text(spell[field]);
      }
      if (typeof spell?.description !== "string" || !spell.description.trim()) throw new Error(`Description de référence absente : ${file} — ${name}.`);
      if (/\r?\n/.test(spell.description)) throw new Error(`Description de référence non normalisée : ${file} — ${name}.`);
      references.set(key, {
        key,
        className,
        spellLevel,
        name,
        headers,
        description: spell.description,
        reversibility: reversibilityFromSpell(spell)
      });
    }
  }
  return references;
}

function resolveTargets(references, v4Index, operation) {
  const targets = [];
  const errors = [];
  for (const reference of references.values()) {
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
    targets.push({ reference, item: matches[0] });
  }
  if (errors.length) throw new Error(`${operation} annulée :\n${errors.join("\n")}`);
  return targets;
}

function headerChanges(references, v4Index) {
  return resolveTargets(references, v4Index, "Synchronisation des entêtes")
    .map(({ reference, item }) => {
      const system = item.system ?? {};
      const fields = HEADER_FIELDS.filter(field => normalize(headerValue(system, field)) !== normalize(reference.headers[field]));
      return { reference, item, fields };
    })
    .filter(change => change.fields.length);
}

function printHeaderResult(labelText, references, changes) {
  const byField = Object.fromEntries(HEADER_FIELDS.map(field => [field, 0]));
  for (const change of changes) for (const field of change.fields) byField[field] += 1;
  console.log(`[ADD2E][V4_HEADER_SYNC] ${labelText} : ${references.size} référence(s), ${changes.length} sort(s), ${changes.reduce((sum, change) => sum + change.fields.length, 0)} champ(s).`);
  console.log(`[ADD2E][V4_HEADER_SYNC] École ${byField.ecole}, portée ${byField.portee}, durée ${byField.duree}, zone ${byField.zone_effet}, incantation ${byField.temps_incantation}, sauvegarde ${byField.jet_sauvegarde}.`);
  for (const change of changes) console.log(`[ADD2E][V4_HEADER_SYNC] ${change.reference.className} niveau ${change.reference.spellLevel} — ${change.reference.name} : ${change.fields.join(", ")}.`);
  console.log("[ADD2E][V4_HEADER_SYNC] Composantes, composants_materiels, descriptions et titres V4 exclus.");
}

function runHeaders(args) {
  const references = loadReferences();
  const file = path.join(ROOT, V4_FILE);
  const v4 = read(file);
  const changes = headerChanges(references, indexItems(v4));
  if (args.syncHeaders && !args.dryRun && changes.length) {
    for (const change of changes) {
      const system = change.item.system ??= {};
      for (const field of change.fields) setHeaderValue(system, field, change.reference.headers[field]);
    }
    write(file, v4);
  }
  printHeaderResult(args.diagnoseHeaders ? "diagnostic" : args.dryRun ? "simulation" : "V4 mis à jour", references, changes);
}

function descriptionChanges(references, v4Index) {
  const targets = resolveTargets(references, v4Index, "Synchronisation des descriptions");
  const errors = [];
  const changes = [];
  const fields = { description_reelle: 0, description: 0 };
  for (const { reference, item } of targets) {
    const system = item.system ?? {};
    const field = descriptionField(system);
    if (!field) {
      errors.push(`${reference.className} niveau ${reference.spellLevel} — ${reference.name} : aucun champ description_reelle ou description dans V4.`);
      continue;
    }
    if (normalizeDescription(system[field]) === normalizeDescription(reference.description)) continue;
    fields[field] += 1;
    changes.push({ reference, item, field });
  }
  if (errors.length) throw new Error(`Synchronisation des descriptions annulée :\n${errors.join("\n")}`);
  return { targets, changes, fields };
}

function printDescriptionResult(labelText, references, result) {
  console.log(`[ADD2E][V4_DESCRIPTION_SYNC] ${labelText} : ${references.size} référence(s), ${result.targets.length} correspondance(s) V4, ${result.changes.length} description(s) à mettre à jour.`);
  console.log(`[ADD2E][V4_DESCRIPTION_SYNC] description_reelle ${result.fields.description_reelle}, description ${result.fields.description}.`);
  for (const change of result.changes) console.log(`[ADD2E][V4_DESCRIPTION_SYNC] ${change.reference.className} niveau ${change.reference.spellLevel} — ${change.reference.name} : ${change.field}.`);
  console.log("[ADD2E][V4_DESCRIPTION_SYNC] Seule la description issue de la référence est écrite dans V4 ; entêtes, composants, titres et V3 restent inchangés.");
}

function runDescriptions(args) {
  const references = loadReferences();
  const file = path.join(ROOT, V4_FILE);
  const v4 = read(file);
  const result = descriptionChanges(references, indexItems(v4));
  if (args.syncDescriptions && !args.dryRun && result.changes.length) {
    for (const change of result.changes) {
      const system = change.item.system ??= {};
      system[change.field] = change.reference.description;
    }
    write(file, v4);
  }
  printDescriptionResult(args.diagnoseDescriptions ? "diagnostic" : args.dryRun ? "simulation" : "V4 mis à jour", references, result);
}

function reversibilityFromReference(reference) {
  const data = reference?.reversibility;
  if (!data || typeof data.reversible !== "boolean") throw new Error(`${reference?.name ?? "Référence"} : champ reversible absent ou invalide.`);
  if (!data.reversible) return data;
  if (!data.inverse) throw new Error(`${reference.name} : inverse explicite absent de la référence.`);
  if (!Array.isArray(data.variantes)) throw new Error(`${reference.name} : variantes absentes ou invalides dans la référence.`);
  if (!data.inverseNameStatus) throw new Error(`${reference.name} : inverseNameStatus absent de la référence.`);
  return data;
}

function reversibleFieldChanges(reference, targetSystem) {
  const source = reversibilityFromReference(reference);
  const fields = [];
  if (targetSystem.reversible !== source.reversible) fields.push("reversible");
  if (source.reversible) {
    if (normalize(targetSystem.inverse) !== normalize(source.inverse)) fields.push("inverse");
    if (!sameJson(targetSystem.variantes, source.variantes)) fields.push("variantes");
    if (normalize(targetSystem.inverseNameStatus) !== normalize(source.inverseNameStatus)) fields.push("inverseNameStatus");
  }
  return { source, fields };
}

function writeReversibleFields(targetSystem, source) {
  targetSystem.reversible = source.reversible;
  if (source.reversible) {
    targetSystem.inverse = source.inverse;
    targetSystem.variantes = clone(source.variantes);
    targetSystem.inverseNameStatus = source.inverseNameStatus;
  } else {
    delete targetSystem.inverse;
    delete targetSystem.variantes;
    delete targetSystem.inverseNameStatus;
  }
}

function runTargetedReversible(args) {
  const references = loadReferences();
  const referenceKey = keyOf(args.className, args.spellLevel, args.name);
  const reference = references.get(referenceKey);
  if (!reference) throw new Error(`Référence absente : ${args.className} niveau ${args.spellLevel} — ${args.name}.`);

  const file = path.join(ROOT, V4_FILE);
  const v4 = read(file);
  const v4Index = indexItems(v4);
  const v4Key = V4_LOOKUP_ALIASES.get(referenceKey) ?? referenceKey;
  const target = one(v4Index, v4Key, "V4");
  const result = reversibleFieldChanges(reference, target.system ?? {});
  const mode = args.diagnoseReversible ? "diagnostic" : args.dryRun ? "simulation" : "V4 mis à jour";

  console.log(`[ADD2E][V4_REVERSIBLE_SYNC] ${mode} : ${label(target)}.`);
  console.log(`[ADD2E][V4_REVERSIBLE_SYNC] référence : reversible ${result.source.reversible}, inverse ${result.source.inverse ?? "aucun"}, variantes ${Array.isArray(result.source.variantes) ? result.source.variantes.length : "absentes"}, inverseNameStatus ${result.source.inverseNameStatus ?? "aucun"}.`);
  console.log(`[ADD2E][V4_REVERSIBLE_SYNC] champs ${result.fields.length ? result.fields.join(", ") : "déjà synchronisés"}.`);
  console.log("[ADD2E][V4_REVERSIBLE_SYNC] Aucun item inverse n'est créé ; seuls les champs réversibles de l'item V4 ciblé sont concernés.");

  if (args.syncReversible && !args.dryRun && result.fields.length) {
    writeReversibleFields(target.system ??= {}, result.source);
    write(file, v4);
  }
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
    const lookupKey = V4_LOOKUP_ALIASES.get(sourceKey) ?? sourceKey;
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
    if (!mappedV4Keys.has(v4Key)) for (const item of entries) v4Only.push(label(item));
  }

  const coherence = { materiaux_sans_M: [], M_sans_architecture: [], M_architecture_vide: [] };
  for (const source of sourceItems) {
    const status = componentCoherence(source);
    if (status) coherence[status].push(label(source));
  }
  return { sourceItems, targets, errors, v4Only, coherence };
}

function printComponentCoherence(coherence) {
  const total = coherence.materiaux_sans_M.length + coherence.M_sans_architecture.length + coherence.M_architecture_vide.length;
  console.log(`[ADD2E][V3_COMPONENT_COHERENCE] ${total} incohérence(s) V3 : matériaux sans M ${coherence.materiaux_sans_M.length}, M sans architecture ${coherence.M_sans_architecture.length}, M avec architecture vide ${coherence.M_architecture_vide.length}.`);
  for (const [kind, labels] of Object.entries(coherence)) for (const entry of labels) console.log(`[ADD2E][V3_COMPONENT_COHERENCE] ${kind} : ${entry}.`);
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
    for (const target of state.targets) if (target.fields.length) copyComponentFields(target.source.system ?? {}, target.target.system ??= {}, target.fields);
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
else if (args.diagnoseDescriptions || args.syncDescriptions) runDescriptions(args);
else if (args.diagnoseReversible || args.syncReversible) runTargetedReversible(args);
else if (args.diagnoseAllComponents || args.syncAllComponents) runAllComponents(args);
else runTargetedComponents(args);
