import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DEFAULT_V4 = "fvtt-spells-all-normalise-mecanique-v4.json";
const DEFAULT_REPORT = "audit/rapports/AUDIT-V4-SCHEMA-UTILISATION.json";
const SCRIPT_ROOT = "scripts";

// Contrat V4 : uniquement les données importables et réellement lues pour un sort.
const SPELL_SYSTEM_FIELDS = Object.freeze([
  "classe", "spellLists", "niveau", "ecole", "portee", "duree", "zone_effet",
  "cible", "temps_incantation", "jet_sauvegarde", "composantes",
  "composants_materiels", "description", "onUse"
]);
const DROP_SYSTEM_FIELDS = new Set([
  "nom", "type", "effectProfile", "description_reelle", "description_texte", "description_html",
  "description_source", "composants_materiels_objets", "composants_materiels_source",
  "composants_materiels_reference", "composants_materiels_verification_recommandee",
  "composants_materiels_note", "composants_materiels_a_renseigner",
  "reversible", "inverse", "variantes", "inverseNameStatus", "tags", "effectTags", "effecttags",
  "onuse", "on_use", "école", "portée", "durée"
]);
const ROOT_ITEM_FIELDS = Object.freeze(["_id", "name", "type", "img", "folder", "sort", "system", "flags", "effects"]);
const ROOT_FOLDER_FIELDS = Object.freeze(["_id", "name", "type", "folder", "sorting", "sort", "color"]);
const ADD2E_FLAG_FIELDS = Object.freeze(["reversible", "variant", "componentManagement", "gestionComposants"]);
const FIELD_ALIASES = Object.freeze({
  classe: ["classe", "class", "liste"],
  ecole: ["ecole", "école", "school"],
  portee: ["portee", "portée", "range"],
  duree: ["duree", "durée", "duration"],
  zone_effet: ["zone_effet", "zoneEffet", "area", "areaOfEffect"],
  cible: ["cible", "target", "targets"],
  temps_incantation: ["temps_incantation", "tempsIncantation", "castingTime", "casting_time"],
  jet_sauvegarde: ["jet_sauvegarde", "jetSauvegarde", "savingThrow", "saving_throw"],
  composantes: ["composantes", "components", "componentes", "composants"],
  composants_materiels: ["composants_materiels", "composantsMateriels", "materialComponents", "material_components", "composants_materiels_objets"],
  description: ["description", "description_reelle", "description_texte", "description_html"],
  onUse: ["onUse", "onuse", "on_use"]
});

function parseArgs(argv) {
  const valueAfter = name => {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] : null;
  };
  return {
    write: argv.includes("--write"),
    v4: valueAfter("--v4") || DEFAULT_V4,
    report: valueAfter("--report") || DEFAULT_REPORT
  };
}

function readJson(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function own(object, key) { return Object.prototype.hasOwnProperty.call(object ?? {}, key); }
function text(value) { return String(value ?? "").trim(); }
function bool(value) { return value === true || /^(true|1|oui|yes|on)$/i.test(String(value ?? "")); }
function slug(value) {
  return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, "")
    .toLocaleLowerCase("fr").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
function number(value, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const match = String(value ?? "").match(/-?\d+(?:[.,]\d+)?/);
  const parsed = Number(match?.[0]?.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}
function filled(value) {
  if (value === null || value === undefined || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}
function first(source, aliases, fallback = "") {
  for (const key of aliases) if (own(source, key) && filled(source[key])) return source[key];
  return fallback;
}
function asArray(value) {
  if (Array.isArray(value)) return value.flatMap(asArray);
  if (value === null || value === undefined || value === "") return [];
  if (typeof value === "string") return value.split(/[,;|\n]+/g).map(part => part.trim()).filter(Boolean);
  if (typeof value === "object") {
    for (const key of ["spellLists", "lists", "classes", "classe", "class", "liste", "items", "values", "value"]) {
      if (own(value, key)) return asArray(value[key]);
    }
  }
  return [value];
}
function isSpell(item) { return String(item?.type ?? item?.system?.type ?? "").toLowerCase() === "sort"; }

function canonicalLists(system) {
  const lists = asArray(first(system, ["spellLists", "lists", "classes", "classe", "class", "liste"], []))
    .map(slug).filter(Boolean);
  return [...new Set(lists)];
}

function canonicalMaterial(value) {
  if (typeof value === "string") {
    const nom = text(value);
    return nom ? { nom, quantite: 1 } : null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const nom = text(first(value, ["nom", "name", "label", "item", "itemName", "component", "composant", "slug"]));
  if (!nom) return null;
  const output = { nom, quantite: Math.max(1, Math.floor(number(first(value, ["quantite", "quantity", "qty", "nombre", "count", "value"], 1), 1))) };
  const consommation = text(first(value, ["consommation", "consumption"]));
  const condition = text(first(value, ["condition", "conditions", "note", "notes"]));
  const reutilisable = first(value, ["reutilisable", "réutilisable", "reusable"], null);
  const consomme = first(value, ["consomme", "consume", "consumable", "estConsommable"], null);
  if (consommation) output.consommation = consommation;
  if (condition) output.condition = condition;
  if (reutilisable !== null && reutilisable !== "") output.reutilisable = bool(reutilisable);
  if (consomme !== null && consomme !== "") output.consomme = bool(consomme);
  const alternatives = first(value, ["alternatives", "options", "choix", "auChoix", "or"], null);
  if (alternatives) {
    const compact = asArray(alternatives).map(canonicalMaterial).filter(Boolean);
    if (compact.length) output.alternatives = compact;
  }
  return output;
}

function canonicalMaterials(system) {
  const source = first(system, FIELD_ALIASES.composants_materiels, []);
  const values = Array.isArray(source) ? source : source ? [source] : [];
  return values.map(canonicalMaterial).filter(Boolean);
}

function buildGenericReversibleProfile(item, system) {
  const inverse = text(system.inverse);
  if (!inverse) throw new Error(`${item.name} : reversible=true mais inverse absent ; compactage annulé pour ne pas perdre la mécanique.`);
  const variantes = system.variantes;
  if (Array.isArray(variantes) && variantes.length) {
    throw new Error(`${item.name} : variantes système non migrées vers flags.add2e.variant ; compactage annulé.`);
  }
  return {
    profiles: [{
      class: text(system.classe) || canonicalLists(system)[0] || "",
      level: Math.max(1, Math.floor(number(system.niveau, 1))),
      referenceName: text(item.name),
      splitOnActorGrant: true,
      inverseNameStatus: text(system.inverseNameStatus) || "manual_explicit",
      modes: [
        { id: "normal" },
        { id: "inverse", actorItemName: inverse, manualName: inverse }
      ]
    }]
  };
}

function compactFlags(item, migration) {
  const source = item?.flags?.add2e && typeof item.flags.add2e === "object" ? item.flags.add2e : {};
  const add2e = {};
  if (filled(source.reversible)) add2e.reversible = clone(source.reversible);
  if (filled(source.variant)) add2e.variant = clone(source.variant);
  else if (filled(source.variants)) add2e.variant = clone(source.variants);
  for (const key of ["componentManagement", "gestionComposants"]) if (filled(source[key])) add2e[key] = clone(source[key]);

  const system = item?.system ?? {};
  if (system.reversible === true && !filled(add2e.reversible)) {
    add2e.reversible = buildGenericReversibleProfile(item, system);
    migration.reversibleSystemToFlag.push(item.name);
  }

  const unknown = Object.keys(source).filter(key => !["reversible", "variant", "variants", "componentManagement", "gestionComposants"].includes(key));
  if (unknown.length) migration.droppedAdd2eFlags.push({ name: item.name, keys: unknown.sort() });
  return Object.keys(add2e).length ? { add2e } : {};
}

function effectChanges(effect) {
  const direct = Array.isArray(effect?.changes) ? effect.changes : [];
  const nested = Array.isArray(effect?.system?.changes) ? effect.system.changes : [];
  return [...direct, ...nested].filter(change => change && typeof change === "object");
}

// Les anciens exports contiennent fréquemment des ActiveEffects désactivés, sans changes ni status,
// en doublons. Ils ne peuvent produire aucun effet Foundry et les onUse ADD2E recréent les effets actifs.
function isInertLegacySpellEffect(effect) {
  if (!effect || typeof effect !== "object") return true;
  if (effect.disabled !== true) return false;
  if (effect.transfer === true) return false;
  if (effectChanges(effect).length) return false;
  if (Array.isArray(effect.statuses) && effect.statuses.length) return false;
  const duration = effect.duration ?? {};
  if (Number(duration.value ?? 0) > 0) return false;
  return true;
}

function compactEffects(item, effectAudit) {
  const effects = Array.isArray(item?.effects) ? item.effects : [];
  if (!effects.length) return [];
  const retained = [];
  for (const effect of effects) {
    effectAudit.input += 1;
    if (isInertLegacySpellEffect(effect)) {
      effectAudit.inertRemoved += 1;
      continue;
    }
    effectAudit.retained += 1;
    retained.push(clone(effect));
  }
  if (effects.length && !retained.length) effectAudit.spellsCleared.push(item.name);
  return retained;
}

function canonicalSystem(item) {
  const source = item?.system ?? {};
  const spellLists = canonicalLists(source);
  const classe = text(first(source, FIELD_ALIASES.classe, spellLists[0] ?? ""));
  return {
    classe,
    spellLists,
    niveau: Math.max(1, Math.floor(number(first(source, ["niveau", "niveau_sort", "spellLevel", "level", "lvl"], 1), 1))),
    ecole: text(first(source, FIELD_ALIASES.ecole)),
    portee: text(first(source, FIELD_ALIASES.portee)),
    duree: text(first(source, FIELD_ALIASES.duree)),
    zone_effet: text(first(source, FIELD_ALIASES.zone_effet)),
    cible: text(first(source, FIELD_ALIASES.cible)),
    temps_incantation: text(first(source, FIELD_ALIASES.temps_incantation)),
    jet_sauvegarde: text(first(source, FIELD_ALIASES.jet_sauvegarde)),
    composantes: text(first(source, FIELD_ALIASES.composantes)),
    composants_materiels: canonicalMaterials(source),
    description: text(first(source, FIELD_ALIASES.description)),
    onUse: text(first(source, FIELD_ALIASES.onUse))
  };
}

function compactFolder(folder) {
  const output = {};
  for (const key of ROOT_FOLDER_FIELDS) if (own(folder, key)) output[key] = clone(folder[key]);
  if (!text(output._id) || !text(output.name) || !text(output.type)) throw new Error("Dossier invalide : _id, name et type obligatoires.");
  return output;
}

function compactItem(item, audit) {
  if (!isSpell(item)) throw new Error(`Item non-sort dans V4 : ${text(item?.name) || "sans nom"}.`);
  const name = text(item?.name ?? item?.system?.nom);
  const id = text(item?._id ?? item?.id);
  if (!name || !id) throw new Error(`Sort invalide : nom ou _id absent (${name || "sans nom"}).`);
  const output = {
    _id: id,
    name,
    type: "sort",
    img: text(item?.img) || "icons/svg/book.svg",
    folder: item?.folder ?? null,
    sort: Number.isFinite(Number(item?.sort)) ? Number(item.sort) : 0,
    system: canonicalSystem(item)
  };
  const flags = compactFlags(item, audit.migration);
  if (Object.keys(flags).length) output.flags = flags;
  const effects = compactEffects(item, audit.effects);
  if (effects.length) output.effects = effects;
  return output;
}

function compactDocument(source, audit) {
  if (!Array.isArray(source?.items)) throw new Error("V4 invalide : tableau items absent.");
  const folders = (Array.isArray(source.folders) ? source.folders : []).map(compactFolder);
  const folderIds = new Set(folders.map(folder => folder._id));
  const items = source.items.map(item => compactItem(item, audit));
  const ids = new Set();
  for (const item of items) {
    if (ids.has(item._id)) throw new Error(`_id de sort dupliqué : ${item._id}.`);
    ids.add(item._id);
    if (item.folder && !folderIds.has(item.folder)) throw new Error(`${item.name} référence le dossier absent ${item.folder}.`);
  }
  return {
    exportVersion: text(source.exportVersion) || "add2e-spells-canonical-v5",
    system: text(source.system) || "add2e",
    rootFolder: source?.rootFolder && typeof source.rootFolder === "object" ? { id: text(source.rootFolder.id), name: text(source.rootFolder.name) } : null,
    recursive: true,
    folders,
    items
  };
}

function walk(directory) {
  const files = [];
  const visit = current => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile() && /\.(?:mjs|js)$/i.test(entry.name)) files.push(full);
    }
  };
  visit(directory);
  return files.sort((a, b) => a.localeCompare(b, "fr"));
}
function collectStaticReads(directory) {
  const system = new Map();
  const flags = new Map();
  const add = (map, key, file) => {
    const entries = map.get(key) ?? new Set();
    entries.add(path.relative(ROOT, file).replace(/\\/g, "/"));
    map.set(key, entries);
  };
  const files = walk(directory);
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    for (const regex of [/(?:\bsystem|\bsys)\s*\?*\.\s*([A-Za-z_$][\w$]*)/g, /(?:\bsystem|\bsys)\s*\[\s*["']([^"']+)["']\s*\]/g]) {
      for (const match of source.matchAll(regex)) add(system, match[1], file);
    }
    for (const regex of [/flags\s*\?*\.\s*add2e\s*\?*\.\s*([A-Za-z_$][\w$]*)/g, /flags\s*\?*\.\s*add2e\s*\[\s*["']([^"']+)["']\s*\]/g]) {
      for (const match of source.matchAll(regex)) add(flags, match[1], file);
    }
  }
  const object = map => Object.fromEntries([...map.entries()].map(([key, values]) => [key, [...values].sort()]).sort(([a], [b]) => a.localeCompare(b, "fr")));
  return { files: files.map(file => path.relative(ROOT, file).replace(/\\/g, "/")), system: object(system), flags: object(flags) };
}
function countKeys(items, selector) {
  const result = new Map();
  for (const item of items ?? []) for (const key of Object.keys(selector(item) ?? {})) result.set(key, (result.get(key) ?? 0) + 1);
  return Object.fromEntries([...result.entries()].sort(([a], [b]) => a.localeCompare(b, "fr")));
}
function bytes(value) { return Buffer.byteLength(`${JSON.stringify(value, null, 2)}\n`, "utf8"); }
function verify(compact) {
  const expected = [...SPELL_SYSTEM_FIELDS].sort();
  for (const item of compact.items) {
    const actual = Object.keys(item.system).sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${item.name} : contrat système invalide.`);
    if (!item.system.spellLists.length || item.system.niveau < 1) throw new Error(`${item.name} : identité de sort invalide.`);
    for (const key of DROP_SYSTEM_FIELDS) if (own(item.system, key)) throw new Error(`${item.name} : champ supprimé encore présent (${key}).`);
    for (const effect of item.effects ?? []) if (isInertLegacySpellEffect(effect)) throw new Error(`${item.name} : ActiveEffect inerte conservé.`);
  }
}

const options = parseArgs(process.argv.slice(2));
const file = path.resolve(ROOT, options.v4);
const source = readJson(file);
const audit = {
  effects: { input: 0, inertRemoved: 0, retained: 0, spellsCleared: [] },
  migration: { reversibleSystemToFlag: [], droppedAdd2eFlags: [] }
};
const compact = compactDocument(source, audit);
verify(compact);
const reads = collectStaticReads(path.resolve(ROOT, SCRIPT_ROOT));
const report = {
  version: "2026-06-29-v4-compact-schema-v2",
  generatedAt: new Date().toISOString(),
  source: path.relative(ROOT, file).replace(/\\/g, "/"),
  contract: { rootItemFields: ROOT_ITEM_FIELDS, rootFolderFields: ROOT_FOLDER_FIELDS, systemFields: SPELL_SYSTEM_FIELDS, add2eFlagFields: ADD2E_FLAG_FIELDS, droppedSystemFields: [...DROP_SYSTEM_FIELDS].sort() },
  summary: {
    spells: compact.items.length,
    folders: compact.folders.length,
    inputBytes: fs.statSync(file).size,
    outputBytes: bytes(compact),
    bytesRemoved: fs.statSync(file).size - bytes(compact),
    inputSystemKeys: countKeys(source.items, item => item.system),
    outputSystemKeys: countKeys(compact.items, item => item.system),
    inputAdd2eFlagKeys: countKeys(source.items, item => item.flags?.add2e),
    outputAdd2eFlagKeys: countKeys(compact.items, item => item.flags?.add2e)
  },
  effects: audit.effects,
  migration: audit.migration,
  staticReads: { scannedScripts: reads.files, system: reads.system, flagsAdd2e: reads.flags },
  conclusion: "Les champs système hors contrat sont supprimés. Les ActiveEffects inertes sont supprimés. Les ActiveEffects actifs ou structurés sont conservés. La réversibilité système est migrée vers flags.add2e.reversible seulement lorsqu'un profil runtime est absent."
};
writeJson(path.resolve(ROOT, options.report), report);
if (options.write) writeJson(file, compact);
console.log(`[ADD2E][V4_COMPACT] ${options.write ? "V4 compactée" : "Simulation"} : ${compact.items.length} sorts, ${report.summary.inputBytes} → ${report.summary.outputBytes} octets.`);
console.log(`[ADD2E][V4_COMPACT] Effects : ${audit.effects.input} lus, ${audit.effects.inertRemoved} inertes supprimés, ${audit.effects.retained} conservés.`);
console.log(`[ADD2E][V4_COMPACT] Réversibles migrés : ${audit.migration.reversibleSystemToFlag.length}. Rapport : ${path.relative(ROOT, options.report)}.`);
