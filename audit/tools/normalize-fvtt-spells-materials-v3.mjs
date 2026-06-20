import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");

const VERSION = "2026-06-20-reversible-actor-structure-v1";
const DEFAULT_INPUT = "fvtt-spells-all-normalise-mecanique-v1.json";
const DEFAULT_OUTPUT = "fvtt-spells-all-normalise-mecanique-v3.json";
const DEFAULT_CONTROL = "fvtt-spells-all-normalise-mecanique-v3-controle.json";
const CLASSES = {
  clerc: [1, 2, 3, 4, 5, 6, 7],
  druide: [1, 2, 3, 4, 5, 6, 7],
  magicien: [1, 2, 3, 4, 5, 6, 7, 8, 9],
  illusionniste: [1, 2, 3, 4, 5, 6, 7]
};

const text = value => String(value ?? "").replace(/\s+/g, " ").trim();
const norm = value => text(value)
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[’']/g, "'")
  .replace(/[^a-z0-9]+/g, " ")
  .replace(/\s+/g, " ")
  .trim();
const slug = value => norm(value).replace(/\s+/g, "_");
const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));

function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch { return fallback; }
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function getItems(document) {
  if (Array.isArray(document)) return document;
  for (const key of ["items", "Item", "Items", "documents", "data", "entries"]) {
    if (Array.isArray(document?.[key])) return document[key];
  }
  return [];
}

function setItems(document, items) {
  if (Array.isArray(document)) return items;
  for (const key of ["items", "Item", "Items", "documents", "data", "entries"]) {
    if (Array.isArray(document?.[key])) {
      document[key] = items;
      return document;
    }
  }
  document.items = items;
  return document;
}

function itemLevel(item) {
  return Number(String(item?.system?.niveau ?? item?.system?.niveau_sort ?? item?.system?.level ?? "").match(/\d+/)?.[0] ?? 0) || 0;
}

function itemClasses(item) {
  const system = item?.system ?? {};
  const values = Array.isArray(system.spellLists)
    ? system.spellLists
    : String(system.spellLists ?? system.classe ?? "").split(/[,;|/]+/g);
  const classes = new Set(values.map(slug).filter(Boolean));
  const primary = slug(system.classe);
  if (primary) classes.add(primary);
  return classes;
}

function sourceKey(item) {
  const id = text(item?._id ?? item?.id);
  if (id) return `id:${id}`;
  return `spell:${slug(item?.system?.classe)}|${itemLevel(item)}|${slug(item?.name ?? item?.system?.nom)}`;
}

function loadReferences() {
  const entries = new Map();
  const files = [];
  for (const [classSlug, levels] of Object.entries(CLASSES)) {
    for (const level of levels) {
      const file = path.join(repoRoot, `audit/reference/manuel-joueurs-${classSlug}-niveau-${level}.json`);
      if (!fs.existsSync(file)) continue;
      const document = readJson(file, {});
      files.push(path.relative(repoRoot, file));
      for (const reference of document.spells ?? []) {
        const name = text(reference?.nom ?? reference?.name);
        if (!name) continue;
        const referenceLevel = Number(reference?.niveau ?? reference?.level ?? level) || level;
        entries.set(`${classSlug}|${referenceLevel}|${slug(name)}`, {
          ...clone(reference),
          __class: classSlug,
          __level: referenceLevel,
          __file: path.relative(repoRoot, file)
        });
      }
    }
  }
  return { entries, files };
}

function materialMode(rule) {
  const condition = norm(`${rule?.condition ?? ""} ${rule?.notes ?? ""}`);
  if (!condition) return "shared";
  if (/\b(inverse|inversee|inversee|malediction|maudite|destruction|deshydratation|corruption|epouvante|tenebres|blessures|traumatisme|bien)\b/.test(condition)) return "inverse";
  if (/\b(normal|creation|benediction|purification|apaisement|lumiere|mal)\b/.test(condition)) return "normal";
  return "shared";
}

function modeMaterials(reference, mode, fallback) {
  const all = Array.isArray(reference?.composants_materiels_objets)
    ? clone(reference.composants_materiels_objets)
    : [];
  if (!all.length) return { reference: [], components: clone(fallback ?? []) };
  const selected = all.filter(rule => {
    const target = materialMode(rule);
    return target === "shared" || target === mode;
  });
  const components = selected.map(rule => text(rule?.nom ?? rule?.name)).filter(Boolean);
  return {
    reference: selected,
    components: components.length ? components : clone(fallback ?? [])
  };
}

function buildMode(reference, item, id, name) {
  const mode = id === "inverse" ? "inverse" : "normal";
  const materials = modeMaterials(reference, mode, item?.system?.composants_materiels ?? []);
  return {
    id,
    actorItemName: name,
    manualName: name,
    copySourceItem: true,
    systemOverrides: {
      composants_materiels: materials.components
    },
    materialReference: materials.reference
  };
}

function applyReversibleFlags(items, referenceIndex) {
  const byClass = Object.fromEntries(Object.keys(CLASSES).map(classSlug => [classSlug, 0]));
  const profiles = [];

  for (const item of items) {
    if (String(item?.type ?? item?.system?.type ?? "") !== "sort") continue;
    const level = itemLevel(item);
    const name = text(item?.name ?? item?.system?.nom);
    const itemProfiles = [];

    for (const classSlug of itemClasses(item)) {
      if (!CLASSES[classSlug]?.includes(level)) continue;
      const reference = referenceIndex.get(`${classSlug}|${level}|${slug(name)}`);
      const inverse = text(reference?.inverse);
      if (!reference || !inverse) continue;

      const profile = {
        class: classSlug,
        level,
        referenceFile: reference.__file,
        modes: [
          buildMode(reference, item, "normal", text(reference.nom) || name),
          buildMode(reference, item, "inverse", inverse)
        ]
      };
      itemProfiles.push(profile);
      profiles.push({ name, ...clone(profile) });
      byClass[classSlug] += 1;
    }

    if (itemProfiles.length) {
      item.flags ??= {};
      item.flags.add2e ??= {};
      item.flags.add2e.reversible = {
        version: VERSION,
        managedBy: "normalize-fvtt-spells-materials-v3",
        enabled: true,
        splitOnActorGrant: true,
        actorGrantEvents: ["drop", "auto-grant-clerc", "auto-grant-druide"],
        choiceTiming: "memorization",
        profiles: itemProfiles
      };
    } else if (item.flags?.add2e?.reversible?.managedBy === "normalize-fvtt-spells-materials-v3") {
      delete item.flags.add2e.reversible;
    }
  }

  return { byClass, profiles };
}

function main() {
  const input = path.resolve(repoRoot, process.argv[2] || DEFAULT_INPUT);
  const output = path.resolve(repoRoot, process.argv[3] || DEFAULT_OUTPUT);
  const controlOutput = path.resolve(repoRoot, process.argv[4] || DEFAULT_CONTROL);
  const source = readJson(input);
  if (!source) throw new Error(`Fichier introuvable ou invalide : ${input}`);

  const sourceItems = getItems(source);
  const priorOutput = readJson(output, null);
  const priorItems = getItems(priorOutput);
  const priorByKey = new Map(priorItems.map(item => [sourceKey(item), item]));
  const sourceKeys = new Set(sourceItems.map(sourceKey));

  const items = sourceItems.map(sourceItem => clone(priorByKey.get(sourceKey(sourceItem)) ?? sourceItem));
  const ignoredAuditOnlyItems = priorItems
    .filter(item => !sourceKeys.has(sourceKey(item)))
    .map(item => ({ name: item.name, classe: item.system?.classe, niveau: item.system?.niveau }));

  const outputDocument = priorOutput ? clone(priorOutput) : clone(source);
  setItems(outputDocument, items);
  outputDocument.normalizedBy = VERSION;
  outputDocument.normalizedAt = new Date().toISOString();

  const references = loadReferences();
  const reversible = applyReversibleFlags(items, references.entries);
  writeJson(output, outputDocument);

  const control = readJson(controlOutput, {}) ?? {};
  control.version = VERSION;
  control.totalItems = items.length;
  control.sourceSpellCount = sourceItems.filter(item => String(item?.type ?? item?.system?.type ?? "") === "sort").length;
  control.outputSpellCount = items.filter(item => String(item?.type ?? item?.system?.type ?? "") === "sort").length;
  control.sourceSpellCountExpected = 411;
  control.sourceSpellCountInvariant = control.sourceSpellCount === 411 && control.outputSpellCount === 411;
  control.appendedFromAudit = { clerc: [] };
  control.ignoredAuditOnlyItems = ignoredAuditOnlyItems;
  control.reversibleActorSplit = {
    version: VERSION,
    referenceFiles: references.files,
    byClass: reversible.byClass,
    profiles: reversible.profiles
  };
  writeJson(controlOutput, control);

  console.log(`[ADD2E][SPELL_MATERIALS_V3] ${control.outputSpellCount} sort(s) conservé(s) depuis la source.`);
  console.log(`[ADD2E][SPELL_MATERIALS_V3] Réversibles — clerc: ${reversible.byClass.clerc}, druide: ${reversible.byClass.druide}, magicien: ${reversible.byClass.magicien}, illusionniste: ${reversible.byClass.illusionniste}.`);
  console.log(`[ADD2E][SPELL_MATERIALS_V3] Items d’audit exclus: ${ignoredAuditOnlyItems.length}.`);
  console.log(`[ADD2E][SPELL_MATERIALS_V3] Output: ${path.relative(repoRoot, output)}`);
  console.log(`[ADD2E][SPELL_MATERIALS_V3] Control: ${path.relative(repoRoot, controlOutput)}`);
}

main();
