import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "../..");

const sourcePath = path.join(root, "fvtt-spells-all.json");
const referenceDir = path.join(root, "audit/reference");
const reportPath = path.join(root, "audit/rapports/AGENT-FIXES.md");
const onUseDir = path.join(root, "scripts/sorts");

const CLASS_LABELS = {
  clerc: "Clerc",
  druide: "Druide",
  magicien: "Magicien",
  illusionniste: "Illusionniste"
};

function stripAccents(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function slugify(value) {
  return stripAccents(value)
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "sort";
}

function normalize(value) {
  return stripAccents(value)
    .toLowerCase()
    .replace(/[’']/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function readJson(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function detectSpellArrayKey(data) {
  let best = null;
  for (const [key, value] of Object.entries(data)) {
    if (!Array.isArray(value)) continue;
    const score = value.reduce((sum, entry) => sum + (entry?.type === "sort" ? 10 : 0) + (entry?.system ? 1 : 0), 0);
    if (!best || score > best.score) best = { key, score };
  }
  if (!best || best.score <= 0) throw new Error("No spell array found");
  return best.key;
}

function folderPath(folders, folderId) {
  const byId = new Map(folders.map((folder) => [folder?._id || folder?.id, folder]));
  const out = [];
  let current = folderId;
  let guard = 0;
  while (current && guard < 10) {
    const folder = byId.get(current);
    if (!folder) break;
    out.unshift(folder.name);
    current = folder.folder;
    guard += 1;
  }
  return out;
}

function parseLotKey(lotKey) {
  const match = String(lotKey).match(/^(.+)-niveau-(\d+)$/);
  if (!match) return null;
  return { classe: match[1], niveau: Number(match[2]) };
}

function getSpellClass(spell, folders) {
  const parts = folderPath(folders, spell.folder).map(normalize);
  for (const [slug, label] of Object.entries(CLASS_LABELS)) {
    if (parts.includes(normalize(label))) return slug;
  }
  const values = [spell.system?.classe, ...(Array.isArray(spell.system?.spellLists) ? spell.system.spellLists : [])].map(normalize);
  for (const [slug, label] of Object.entries(CLASS_LABELS)) {
    if (values.includes(normalize(label))) return slug;
  }
  return null;
}

function getSpellLevel(spell, folders) {
  for (const part of folderPath(folders, spell.folder)) {
    const match = String(part).match(/niveau\s*(\d+)/i);
    if (match) return Number(match[1]);
  }
  const raw = spell.system?.niveau ?? spell.system?.level;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function findFolderForLot(folders, lotKey) {
  const parsed = parseLotKey(lotKey);
  if (!parsed) return null;
  const className = CLASS_LABELS[parsed.classe];
  const classFolder = folders.find((folder) => normalize(folder.name) === normalize(className));
  if (!classFolder) return null;
  const levelFolder = folders.find((folder) => folder.folder === classFolder._id && normalize(folder.name) === normalize(`Niveau ${parsed.niveau}`));
  return levelFolder?._id || classFolder._id || null;
}

function uniqueId(prefix, existingIds) {
  for (let i = 0; i < 100000; i += 1) {
    const raw = `${prefix}${Math.random().toString(36).slice(2, 10)}`.slice(0, 16);
    if (!existingIds.has(raw)) {
      existingIds.add(raw);
      return raw;
    }
  }
  throw new Error("Unable to generate id");
}

function ensureOnUseScript(spellName, relativePath, createdScripts) {
  const repoPath = relativePath.replace(/^systems\/add2e\//, "");
  const fullPath = path.join(root, repoPath);
  if (fs.existsSync(fullPath)) return false;
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  const safeName = spellName.replace(/`/g, "'");
  const content = `// OnUse ADD2E genere automatiquement pour ${safeName}\n// Compatible Foundry V13/V14/V15.\n// Retour attendu: true = sort consomme, false = sort non consomme.\n\ntry {\n  const sortName = item?.name ?? "${safeName}";\n  const actorName = actor?.name ?? token?.actor?.name ?? "acteur";\n  const message = `<p><strong>${'${sortName}'}</strong></p><p>${'${actorName}'} lance le sort. Les effets precis restent a appliquer selon le Manuel des joueurs AD&D 2e.</p>`;\n  if (globalThis.ChatMessage?.create) {\n    await ChatMessage.create({\n      speaker: ChatMessage.getSpeaker ? ChatMessage.getSpeaker({ actor }) : undefined,\n      content: message\n    });\n  }\n  globalThis.ui?.notifications?.info?.(`${'${sortName}'} lance.`);\n  return true;\n} catch (error) {\n  console.error("[ADD2E][SORT][ONUSE_AUTO]", error);\n  globalThis.ui?.notifications?.error?.("Erreur lors de l'execution du sort.");\n  return false;\n}\n`;
  fs.writeFileSync(fullPath, content, "utf8");
  createdScripts.push(repoPath);
  return true;
}

function makeSpell(expected, lotKey, folderId, existingIds) {
  const parsed = parseLotKey(lotKey);
  const classeLabel = CLASS_LABELS[parsed.classe] || parsed.classe;
  const slug = slugify(expected.nom);
  const onUse = `systems/add2e/scripts/sorts/${slug}.js`;
  return {
    name: expected.nom,
    type: "sort",
    img: `systems/add2e/assets/icones/sorts/${slug}.webp`,
    system: {
      niveau: parsed.niveau,
      classe: classeLabel,
      spellLists: [classeLabel],
      ecole: expected.ecole || expected["école"] || "a_completer",
      "école": expected.ecole || expected["école"] || "a_completer",
      portee: expected.portee || "a_completer",
      "portée": expected.portee || "a_completer",
      duree: expected.duree || "a_completer",
      "durée": expected.duree || "a_completer",
      zone_effet: expected.zone_effet || "a_completer",
      jet_sauvegarde: expected.jet_sauvegarde || "a_completer",
      composantes: expected.composantes || "a_completer",
      composants_materiels: [],
      composants_materiels_source: expected.composants_materiels_source || "a_completer",
      temps_incantation: expected.temps_incantation || "a_completer",
      description: "Reference creee automatiquement. Description et mecanique detaillee a completer depuis le Manuel des joueurs AD&D 2e.",
      description_source: "Manuel des joueurs AD&D 2e",
      description_reelle: "a_completer",
      description_texte: "a_completer",
      description_html: "<p>a_completer</p>",
      onUse,
      onuse: onUse,
      on_use: onUse,
      tags: [`classe:${parsed.classe}`, `niveau:${parsed.niveau}`, `sort:${slug}`, "a_completer"],
      effectTags: [`sort:${slug}`]
    },
    folder: folderId,
    effects: [],
    flags: {
      add2e: {
        generatedBy: "add2e-spell-agent",
        generatedStatus: "rules_to_complete_from_phb",
        onUseGenerated: true
      }
    },
    ownership: { default: 0 },
    _id: uniqueId("S", existingIds),
    sort: 0
  };
}

function main() {
  const data = readJson(sourcePath);
  const folders = Array.isArray(data.folders) ? data.folders : [];
  const spellArrayKey = detectSpellArrayKey(data);
  const spells = data[spellArrayKey];
  const existingIds = new Set([...spells, ...folders].map((entry) => entry?._id).filter(Boolean));
  const createdScripts = [];
  const createdSpells = [];
  const renamedSpells = [];
  const ensuredOnUse = [];

  const reports = [];
  const referenceFiles = fs.readdirSync(referenceDir).filter((file) => /^manuel-joueurs-.*\.json$/.test(file) && file !== "manuel-joueurs-sorts-master.json");

  for (const file of referenceFiles) {
    const lotKey = file.replace(/^manuel-joueurs-/, "").replace(/\.json$/, "");
    const parsed = parseLotKey(lotKey);
    if (!parsed) continue;
    const reference = readJson(path.join(referenceDir, file));
    const expectedSpells = Array.isArray(reference?.spells) ? reference.spells : [];
    const lotSpells = spells.filter((spell) => spell?.type === "sort" && getSpellClass(spell, folders) === parsed.classe && getSpellLevel(spell, folders) === parsed.niveau);
    const folderId = findFolderForLot(folders, lotKey);

    for (const expected of expectedSpells) {
      const expectedNorm = normalize(expected.nom);
      let match = lotSpells.find((spell) => normalize(spell.name) === expectedNorm);
      if (!match) {
        const fuzzy = lotSpells.filter((spell) => {
          const n = normalize(spell.name);
          return n.includes(expectedNorm) || expectedNorm.includes(n);
        });
        if (fuzzy.length === 1) {
          match = fuzzy[0];
          const before = match.name;
          match.name = expected.nom;
          if (match.system?.nom) match.system.nom = expected.nom;
          for (const effect of match.effects || []) if (effect?.name === before) effect.name = expected.nom;
          renamedSpells.push(`${lotKey}: ${before} -> ${expected.nom}`);
        }
      }
      if (!match && folderId) {
        match = makeSpell(expected, lotKey, folderId, existingIds);
        spells.push(match);
        lotSpells.push(match);
        createdSpells.push(`${lotKey}: ${expected.nom}`);
      }
      if (match) {
        const slug = slugify(match.name);
        const existingOnUse = match.system?.onUse || match.system?.on_use || match.system?.onuse;
        const onUse = existingOnUse || `systems/add2e/scripts/sorts/${slug}.js`;
        match.system ||= {};
        match.system.onUse = onUse;
        match.system.onuse = onUse;
        match.system.on_use = onUse;
        if (ensureOnUseScript(match.name, onUse, createdScripts)) ensuredOnUse.push(`${match.name}: ${onUse}`);
      }
    }
  }

  writeJson(sourcePath, data);

  const lines = [];
  lines.push("# Agent fixes");
  lines.push("");
  lines.push(`Run at: ${new Date().toISOString()}`);
  lines.push("");
  lines.push(`Created spells: ${createdSpells.length}`);
  lines.push(`Renamed spells: ${renamedSpells.length}`);
  lines.push(`Created onUse scripts: ${createdScripts.length}`);
  lines.push("");
  lines.push("## Created spells");
  for (const entry of createdSpells) lines.push(`- ${entry}`);
  lines.push("");
  lines.push("## Renamed spells");
  for (const entry of renamedSpells) lines.push(`- ${entry}`);
  lines.push("");
  lines.push("## Created onUse scripts");
  for (const entry of createdScripts) lines.push(`- ${entry}`);
  fs.writeFileSync(reportPath, `${lines.join("\n")}\n`, "utf8");

  console.log(`Created spells: ${createdSpells.length}`);
  console.log(`Renamed spells: ${renamedSpells.length}`);
  console.log(`Created onUse scripts: ${createdScripts.length}`);
}

main();
