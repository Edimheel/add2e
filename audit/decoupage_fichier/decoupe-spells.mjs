import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");
const sourcePath = path.resolve(repoRoot, process.argv[2] || "fvtt-spells-all.json");
const outputDir = path.resolve(repoRoot, "audit/decoupage_fichier");

const CLASS_SLUGS = new Map([
  ["clerc", "clerc"],
  ["clercs", "clerc"],
  ["druide", "druide"],
  ["druides", "druide"],
  ["magicien", "magicien"],
  ["magiciens", "magicien"],
  ["illusionniste", "illusionniste"],
  ["illusionnistes", "illusionniste"]
]);

function stripAccents(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function slugify(value) {
  return stripAccents(value)
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "inconnu";
}

function normalizeClass(value) {
  const slug = slugify(value);
  return CLASS_SLUGS.get(slug) || null;
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") return value.split(/[,;/|]+/).map((v) => v.trim()).filter(Boolean);
  return [];
}

function detectSpellArrayKey(data) {
  const candidates = Object.entries(data).filter(([, value]) => Array.isArray(value));
  let best = null;

  for (const [key, array] of candidates) {
    let score = 0;
    for (const entry of array) {
      if (!entry || typeof entry !== "object") continue;
      if (entry.type === "sort") score += 10;
      if (entry.system && typeof entry.system === "object") score += 1;
      if (entry.system?.niveau != null || entry.system?.level != null) score += 1;
      if (entry.system?.onUse || entry.system?.on_use || entry.system?.onuse) score += 1;
    }
    if (!best || score > best.score) best = { key, score };
  }

  if (!best || best.score <= 0) {
    throw new Error("Impossible de trouver le tableau contenant les sorts dans le JSON exporté.");
  }

  return best.key;
}

function buildFolderHelpers(folders) {
  const folderById = new Map();
  for (const folder of folders) {
    const id = folder?._id || folder?.id;
    if (id) folderById.set(id, folder);
  }

  const cache = new Map();

  function getFolderPath(folderId) {
    if (!folderId) return [];
    if (cache.has(folderId)) return cache.get(folderId);
    const folder = folderById.get(folderId);
    if (!folder) return [];
    const parentPath = getFolderPath(folder.folder);
    const result = [...parentPath, folder.name].filter(Boolean);
    cache.set(folderId, result);
    return result;
  }

  function collectFolderAndAncestors(folderId, output = new Set()) {
    if (!folderId || output.has(folderId)) return output;
    const folder = folderById.get(folderId);
    if (!folder) return output;
    output.add(folderId);
    collectFolderAndAncestors(folder.folder, output);
    return output;
  }

  return { folderById, getFolderPath, collectFolderAndAncestors };
}

function classFromSpell(spell, folderPath) {
  for (const part of folderPath) {
    const normalized = normalizeClass(part);
    if (normalized) return normalized;
  }

  const system = spell.system || {};
  const candidates = [
    system.classe,
    system.class,
    system.liste,
    system.list,
    ...asArray(system.classes),
    ...asArray(system.listes),
    ...asArray(system.spellLists),
    ...asArray(system.tags),
    ...asArray(system.effectTags)
  ];

  for (const value of candidates) {
    const normalized = normalizeClass(value);
    if (normalized) return normalized;
  }

  return "inconnu";
}

function levelFromSpell(spell, folderPath) {
  for (const part of folderPath) {
    const match = String(part).match(/niveau\s*(\d+)/i);
    if (match) return Number(match[1]);
  }

  const system = spell.system || {};
  const raw = system.niveau ?? system.level ?? system.spellLevel ?? system.niveau_sort ?? system.sortLevel;
  const numeric = Number(raw);
  if (Number.isFinite(numeric) && numeric >= 0) return numeric;

  return "inconnu";
}

function isSpellDocument(entry) {
  if (!entry || typeof entry !== "object") return false;
  if (entry.type === "sort") return true;
  const system = entry.system || {};
  return Boolean(system.onUse || system.on_use || system.onuse || system.niveau != null || system.level != null || system.liste || system.classe);
}

function sortByNameThenId(a, b) {
  return String(a.name || "").localeCompare(String(b.name || ""), "fr") || String(a._id || "").localeCompare(String(b._id || ""));
}

function main() {
  if (!fs.existsSync(sourcePath)) throw new Error(`Fichier source introuvable : ${sourcePath}`);

  fs.mkdirSync(outputDir, { recursive: true });

  for (const entry of fs.readdirSync(outputDir)) {
    if (entry.endsWith(".json")) fs.rmSync(path.join(outputDir, entry), { force: true });
  }

  const data = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  const folders = Array.isArray(data.folders) ? data.folders : [];
  const { folderById, getFolderPath, collectFolderAndAncestors } = buildFolderHelpers(folders);
  const spellArrayKey = detectSpellArrayKey(data);
  const sourceEntries = data[spellArrayKey];
  const spells = sourceEntries.filter(isSpellDocument);
  const groups = new Map();

  for (const spell of spells) {
    const folderPath = getFolderPath(spell.folder);
    const classe = classFromSpell(spell, folderPath);
    const niveau = levelFromSpell(spell, folderPath);
    const key = `${classe}-niveau-${niveau}`;

    if (!groups.has(key)) groups.set(key, { classe, niveau, key, folderIds: new Set(), items: [] });

    const group = groups.get(key);
    group.items.push(spell);
    collectFolderAndAncestors(spell.folder, group.folderIds);
  }

  const generatedAt = new Date().toISOString();
  const index = {
    generatedAt,
    sourceFile: path.basename(sourcePath),
    sourceExport: {
      exportVersion: data.exportVersion ?? null,
      exportedAt: data.exportedAt ?? null,
      world: data.world ?? null,
      system: data.system ?? null,
      rootFolder: data.rootFolder ?? null
    },
    spellArrayKey,
    totalSourceEntries: sourceEntries.length,
    totalSpells: spells.length,
    totalGroups: groups.size,
    groups: []
  };

  const sortedGroups = [...groups.values()].sort((a, b) => String(a.classe).localeCompare(String(b.classe), "fr") || Number(a.niveau) - Number(b.niveau));

  for (const group of sortedGroups) {
    group.items.sort(sortByNameThenId);
    const fileName = `${slugify(group.classe)}-niveau-${slugify(group.niveau)}.json`;
    const filePath = path.join(outputDir, fileName);
    const groupFolders = [...group.folderIds].map((id) => folderById.get(id)).filter(Boolean).sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "fr"));

    const payload = {
      generatedAt,
      sourceFile: path.basename(sourcePath),
      group: { classe: group.classe, niveau: group.niveau, key: group.key, count: group.items.length },
      folders: groupFolders,
      items: group.items
    };

    fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    index.groups.push({ classe: group.classe, niveau: group.niveau, key: group.key, file: fileName, count: group.items.length });
  }

  fs.writeFileSync(path.join(outputDir, "index.json"), `${JSON.stringify(index, null, 2)}\n`, "utf8");

  console.log(`Source : ${path.relative(repoRoot, sourcePath)}`);
  console.log(`Tableau de sorts : ${spellArrayKey}`);
  console.log(`Sorts détectés : ${spells.length}`);
  console.log(`Groupes générés : ${groups.size}`);
  console.log(`Sortie : ${path.relative(repoRoot, outputDir)}`);
}

main();
