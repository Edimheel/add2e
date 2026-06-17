import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");

const VERSION = "2026-06-17-normalize-fvtt-spells-canonical-v1";
const EFFECT_PROFILE_VERSION = "2026-06-16-add2e-spell-effects-v1";

const LEGACY_SYSTEM_KEYS = [
  "école",
  "portée",
  "durée",
  "onuse",
  "on_use",
  "description_reelle",
  "description_source",
  "description_texte",
  "description_html",
  "composants",
  "source_composants",
  "composants_materiels_objets",
  "components",
  "componentes",
  "school",
  "range",
  "duration",
  "castingTime",
  "casting_time",
  "area",
  "areaOfEffect",
  "level",
  "lvl",
  "spellLevel",
  "niveau_sort",
  "niveauSort",
  "spellClass",
  "spellList",
  "liste",
  "liste_sort",
  "listeSort"
];

const CANONICAL_FIELDS = [
  "nom",
  "type",
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
  "composants_materiels_source",
  "composants_materiels_reference",
  "composants_materiels_verification_recommandee",
  "composants_materiels_note",
  "composants_materiels_a_renseigner",
  "description",
  "onUse",
  "onUseCode",
  "tags",
  "effectTags",
  "effectProfile"
];

const CLASS_ALIASES = {
  clerc: "Clerc",
  clercs: "Clerc",
  cleric: "Clerc",
  priest: "Clerc",
  pretre: "Clerc",
  pretres: "Clerc",
  paladin: "Clerc",
  druide: "Druide",
  druid: "Druide",
  druides: "Druide",
  magicien: "Magicien",
  mage: "Magicien",
  wizard: "Magicien",
  magic_user: "Magicien",
  magicuser: "Magicien",
  illusionniste: "Illusionniste",
  illusionist: "Illusionniste"
};

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function normalizeKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/\s*\([^)]*\)\s*$/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function maybeJson(value) {
  if (typeof value !== "string") return value;
  const text = value.trim();
  if (!text) return value;
  if ((text.startsWith("{") && text.endsWith("}")) || (text.startsWith("[") && text.endsWith("]"))) {
    try { return JSON.parse(text); }
    catch (_err) { return value; }
  }
  return value;
}

function filled(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

function asText(value) {
  value = maybeJson(value);
  if (value === undefined || value === null) return "";
  if (Array.isArray(value)) return value.map(asText).filter(Boolean).join(", ");
  if (typeof value === "object") {
    const raw = value.raw ?? value.texte ?? value.text ?? value.label ?? value.nom ?? value.name;
    if (filled(raw)) return String(raw).trim();
    const val = value.valeur ?? value.value ?? value.nombre ?? value.number ?? "";
    const unit = value.unite ?? value.unit ?? "";
    const joined = `${val ?? ""}${unit ? ` ${unit}` : ""}`.trim();
    if (joined) return joined;
    return Object.values(value).map(asText).filter(Boolean).join(", ");
  }
  return String(value ?? "").trim();
}

function firstText(...values) {
  for (const value of values) {
    const text = asText(value);
    if (text) return text;
  }
  return "";
}

function asArray(value) {
  value = maybeJson(value);
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(asArray);
  if (typeof value === "string") return value.split(/[,;|\n]+/g).map(v => v.trim()).filter(Boolean);
  if (typeof value === "object") {
    for (const key of ["spellLists", "lists", "classes", "classe", "class", "value", "values", "list", "tags", "items"]) {
      if (value[key] !== undefined) return asArray(value[key]);
    }
    const numeric = Object.keys(value).filter(k => /^\d+$/.test(k)).sort((a, b) => Number(a) - Number(b)).map(k => value[k]);
    if (numeric.length) return asArray(numeric);
    return Object.values(value).flatMap(asArray);
  }
  return [String(value).trim()].filter(Boolean);
}

function uniqueText(values) {
  const out = [];
  const seen = new Set();
  for (const value of values.map(asText).flatMap(v => String(v).split(/[,;|\n]+/g)).map(v => v.trim()).filter(Boolean)) {
    const key = normalizeKey(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function asBool(value) {
  if (value === true || value === false) return value;
  const text = String(value ?? "").trim().toLowerCase();
  return ["true", "1", "oui", "yes", "on"].includes(text);
}

function asNumber(value, fallback = 0) {
  value = maybeJson(value);
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value && typeof value === "object") {
    for (const key of ["niveau", "level", "value", "valeur", "nombre", "number"]) {
      if (value[key] !== undefined) {
        const n = asNumber(value[key], NaN);
        if (Number.isFinite(n)) return n;
      }
    }
  }
  const match = String(value ?? "").match(/\d+/);
  return match ? Number(match[0]) || fallback : fallback;
}

function normalizeClass(value, fallback = "") {
  const text = asText(value || fallback);
  const key = normalizeKey(text);
  return CLASS_ALIASES[key] ?? (text ? text.replace(/[_-]+/g, " ").replace(/\b\p{L}/gu, c => c.toUpperCase()).trim() : "");
}

function normalizeSpellLists(value, spellClass) {
  const values = asArray(value).map(v => normalizeClass(v)).filter(Boolean);
  if (spellClass) values.unshift(spellClass);
  return uniqueText(values);
}

function normalizeOnUse(...values) {
  const raw = firstText(...values);
  if (!raw) return "";
  let value = raw.split(/[,;|\n]+/g).map(v => v.trim()).find(v => v.endsWith(".js") || v.includes("/sorts/")) ?? raw.trim();
  if (value.startsWith("scripts/sorts/")) value = `systems/add2e/${value}`;
  if (value.startsWith("/systems/add2e/")) value = value.slice(1);
  return value;
}

function buildFolderIndex(folders = [], rootFolder = null) {
  const byId = new Map();
  for (const folder of folders) if (folder?._id) byId.set(folder._id, folder);
  function pathFor(folderId) {
    const parts = [];
    let current = byId.get(folderId);
    let guard = 0;
    while (current && guard < 64) {
      parts.unshift(current.name);
      current = current.folder ? byId.get(current.folder) : null;
      guard += 1;
    }
    if (rootFolder?.name && (!parts.length || normalizeKey(parts[0]) !== normalizeKey(rootFolder.name))) parts.unshift(rootFolder.name);
    return parts;
  }
  return { pathFor };
}

function classFromPath(parts = []) {
  for (const part of parts) {
    const found = normalizeClass(part);
    if (["Clerc", "Druide", "Magicien", "Illusionniste"].includes(found)) return found;
  }
  return "";
}

function levelFromPath(parts = []) {
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const match = String(parts[i] ?? "").match(/niveau\s*(\d+)/i);
    if (match) return Number(match[1]) || 0;
  }
  return 0;
}

function removeObjectMagic(value, control) {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(v => removeObjectMagic(v, control));
  const out = {};
  for (const [key, entry] of Object.entries(value)) {
    if (key === "objectMagic") {
      control.objectMagicRemoved += 1;
      continue;
    }
    out[key] = removeObjectMagic(entry, control);
  }
  return out;
}

function normalizeEffectProfile(raw, control) {
  const profile = removeObjectMagic(clone(raw ?? {}), control);
  const clean = profile && typeof profile === "object" && !Array.isArray(profile) ? profile : {};
  clean.version = asText(clean.version) || EFFECT_PROFILE_VERSION;
  clean.source = asText(clean.source) || "canonical-system";
  if (!Array.isArray(clean.effects)) clean.effects = [];
  return clean;
}

function stableImportKey(item) {
  const sys = item.system ?? {};
  return [normalizeKey(item.name ?? sys.nom), normalizeKey(sys.type ?? item.type), normalizeKey(sys.classe), String(sys.niveau ?? "")].join("|");
}

function normalizeSystem(rawItem, folderPath, control) {
  const src = rawItem.system ?? {};
  const folderClass = classFromPath(folderPath);
  const folderLevel = levelFromPath(folderPath);
  const spellClass = normalizeClass(src.classe ?? src.class ?? src.spellClass ?? src.liste ?? src.spellList, folderClass);
  const spellLevel = asNumber(src.niveau ?? src.niveau_sort ?? src.niveauSort ?? src.spellLevel ?? src.level ?? src.lvl, folderLevel || 1) || folderLevel || 1;

  for (const key of LEGACY_SYSTEM_KEYS) {
    if (Object.prototype.hasOwnProperty.call(src, key)) control.legacyRemoved[key] = (control.legacyRemoved[key] ?? 0) + 1;
  }

  return {
    nom: firstText(src.nom, rawItem.name),
    type: "sort",
    classe: spellClass,
    spellLists: normalizeSpellLists(firstText(src.spellLists, src.lists, src.classes, src.classe, src.class, src.liste, src.spellList), spellClass),
    niveau: spellLevel,
    ecole: firstText(src.ecole, src["école"], src.school),
    portee: firstText(src.portee, src["portée"], src.range),
    duree: firstText(src.duree, src["durée"], src.duration),
    zone_effet: firstText(src.zone_effet, src.zoneEffet, src.area, src.areaOfEffect),
    cible: firstText(src.cible, src.target, src.targets),
    temps_incantation: firstText(src.temps_incantation, src.tempsIncantation, src.castingTime, src.casting_time),
    jet_sauvegarde: firstText(src.jet_sauvegarde, src.jetSauvegarde, src.savingThrow, src.saving_throw),
    composantes: firstText(src.composantes, src.composants, src.components, src.componentes, src.type),
    composants_materiels: uniqueText([...asArray(src.composants_materiels), ...asArray(src.composants_materiels_objets), ...asArray(src.materialComponents), ...asArray(src.material_components)]),
    composants_materiels_source: firstText(src.composants_materiels_source, src.source_composants),
    composants_materiels_reference: firstText(src.composants_materiels_reference),
    composants_materiels_verification_recommandee: firstText(src.composants_materiels_verification_recommandee),
    composants_materiels_note: firstText(src.composants_materiels_note),
    composants_materiels_a_renseigner: asBool(src.composants_materiels_a_renseigner),
    description: firstText(src.description, src.description_reelle, src.description_texte, src.description_html),
    onUse: normalizeOnUse(src.onUse, src.onuse, src.on_use),
    onUseCode: firstText(src.onUseCode),
    tags: uniqueText(asArray(src.tags)),
    effectTags: uniqueText([...asArray(src.effectTags), ...asArray(src.effets)]),
    effectProfile: normalizeEffectProfile(src.effectProfile, control)
  };
}

function getItemsRoot(json) {
  for (const key of ["items", "Item", "Items", "documents", "data", "entries"]) {
    if (Array.isArray(json?.[key])) return { key, items: json[key] };
  }
  if (Array.isArray(json)) return { key: null, items: json };
  return { key: "items", items: [] };
}

function normalizeExport(json) {
  const out = clone(json);
  const folders = Array.isArray(out.folders) ? out.folders : [];
  const folderIndex = buildFolderIndex(folders, out.rootFolder ?? null);
  const { key, items } = getItemsRoot(out);
  const expectedKeys = [...CANONICAL_FIELDS].sort();
  const seen = new Map();
  const control = {
    version: VERSION,
    inputItems: items.length,
    folders: folders.length,
    spells: 0,
    nonSpells: 0,
    byClassLevel: {},
    legacyRemoved: {},
    legacyAliasesFoundAfter: {},
    duplicateImportKeys: [],
    missingCanonicalFields: {},
    sameSystemFieldsForAllSpells: true,
    effectProfilePresentOnAllSpells: true,
    objectMagicRemoved: 0,
    objectMagicKeyFoundAfter: false,
    canonicalFields: CANONICAL_FIELDS
  };

  const normalizedItems = items.map(raw => {
    if (!raw || typeof raw !== "object") return raw;
    const item = clone(raw);
    const type = String(item.type ?? item.system?.type ?? "").trim();
    if (type !== "sort") {
      control.nonSpells += 1;
      return item;
    }

    const folderPath = folderIndex.pathFor(item.folder);
    item.type = "sort";
    item.system = normalizeSystem(item, folderPath, control);
    item.name = asText(item.name || item.system.nom) || item.system.nom || "Sort sans nom";
    item.img = item.img || "icons/svg/book.svg";
    item.flags ??= {};
    item.flags.add2e ??= {};
    item.flags.add2e.canonicalSystemFields = VERSION;
    item.flags.add2e.importKey = stableImportKey(item);

    const keyValue = item.flags.add2e.importKey;
    if (seen.has(keyValue)) control.duplicateImportKeys.push({ key: keyValue, first: seen.get(keyValue), duplicate: item.name });
    else seen.set(keyValue, item.name);

    const classLevel = `${item.system.classe || "Classe inconnue"} / Niveau ${item.system.niveau || "inconnu"}`;
    control.byClassLevel[classLevel] = (control.byClassLevel[classLevel] ?? 0) + 1;
    control.spells += 1;

    const keys = Object.keys(item.system).sort();
    if (JSON.stringify(keys) !== JSON.stringify(expectedKeys)) {
      control.sameSystemFieldsForAllSpells = false;
      control.missingCanonicalFields[item.name] = expectedKeys.filter(k => !keys.includes(k));
    }
    for (const legacy of LEGACY_SYSTEM_KEYS) {
      if (Object.prototype.hasOwnProperty.call(item.system, legacy)) control.legacyAliasesFoundAfter[legacy] = (control.legacyAliasesFoundAfter[legacy] ?? 0) + 1;
    }
    if (!item.system.effectProfile || typeof item.system.effectProfile !== "object") control.effectProfilePresentOnAllSpells = false;
    if (JSON.stringify(item.system.effectProfile).includes("objectMagic")) control.objectMagicKeyFoundAfter = true;
    return item;
  });

  if (key) out[key] = normalizedItems;
  else return { json: normalizedItems, control };

  out.normalizedBy = VERSION;
  out.normalizedAt = new Date().toISOString();
  return { json: out, control };
}

function main() {
  const input = path.resolve(repoRoot, process.argv[2] || "fvtt-spells-all.json");
  const output = path.resolve(repoRoot, process.argv[3] || "fvtt-spells-all-normalise-mecanique-v1.json");
  const controlOutput = path.resolve(repoRoot, process.argv[4] || "fvtt-spells-all-normalise-mecanique-v1-controle.json");

  if (!fs.existsSync(input)) throw new Error(`Fichier introuvable : ${input}`);

  const source = JSON.parse(fs.readFileSync(input, "utf8"));
  const { json, control } = normalizeExport(source);

  fs.writeFileSync(output, `${JSON.stringify(json, null, 2)}\n`, "utf8");
  fs.writeFileSync(controlOutput, `${JSON.stringify(control, null, 2)}\n`, "utf8");

  console.log(`[ADD2E][SPELLS_NORMALIZE] ${control.spells} sort(s), ${control.folders} dossier(s).`);
  console.log(`[ADD2E][SPELLS_NORMALIZE] Output: ${path.relative(repoRoot, output)}`);
  console.log(`[ADD2E][SPELLS_NORMALIZE] Control: ${path.relative(repoRoot, controlOutput)}`);
  if (control.duplicateImportKeys.length) console.warn(`[ADD2E][SPELLS_NORMALIZE] Doublons: ${control.duplicateImportKeys.length}`);
  if (Object.keys(control.legacyAliasesFoundAfter).length) console.warn(`[ADD2E][SPELLS_NORMALIZE] Alias legacy restants`, control.legacyAliasesFoundAfter);
}

main();
