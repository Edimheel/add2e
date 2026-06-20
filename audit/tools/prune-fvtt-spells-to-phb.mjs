import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const VERSION = "2026-06-20-phb-inventory-prune-v1";
const V3_FILE = "fvtt-spells-all-normalise-mecanique-v3.json";
const CONTROL_FILE = "fvtt-spells-all-normalise-mecanique-v3-controle.json";
const MASTER_FILE = "audit/reference/manuel-joueurs-sorts-master.json";
const CLASSES = {
  clerc: [1, 2, 3, 4, 5, 6, 7],
  druide: [1, 2, 3, 4, 5, 6, 7],
  magicien: [1, 2, 3, 4, 5, 6, 7, 8, 9],
  illusionniste: [1, 2, 3, 4, 5, 6, 7]
};

const text = value => String(value ?? "").replace(/\s+/g, " ").trim();
const slug = value => text(value)
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[’']/g, "'")
  .replace(/[^a-z0-9]+/g, "_")
  .replace(/^_+|_+$/g, "");
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

function isSpell(item) {
  return String(item?.type ?? item?.system?.type ?? "") === "sort";
}

function itemLevel(item) {
  return Number(String(item?.system?.niveau ?? item?.system?.niveau_sort ?? item?.system?.level ?? "").match(/\d+/)?.[0] ?? 0) || 0;
}

function itemClasses(item) {
  const system = item?.system ?? {};
  const values = Array.isArray(system.spellLists)
    ? system.spellLists
    : String(system.spellLists ?? system.classe ?? "").split(/[,;|/]+/g);
  return new Set([...values.map(slug), slug(system.classe)].filter(Boolean));
}

function itemKey(item) {
  const id = text(item?._id ?? item?.id);
  return id || `${slug(item?.system?.classe)}|${itemLevel(item)}|${slug(item?.name ?? item?.system?.nom)}`;
}

function metaKey(classSlug, level, name) {
  return `${classSlug}|${level}|${slug(name)}`;
}

function lotScope(lot) {
  const match = text(lot).match(/^(clerc|druide|magicien|illusionniste)-niveau-(\d+)$/i);
  return match ? { classSlug: match[1].toLowerCase(), level: Number(match[2]) } : null;
}

function uniqueText(values) {
  return [...new Set(values.map(text).filter(Boolean))];
}

function referenceAliases(reference) {
  const direct = [
    reference?.foundryName,
    reference?.foundryNom,
    reference?.foundry?.name,
    reference?.foundry?.nom
  ];
  const lists = [
    reference?.foundryNames,
    reference?.foundryNoms,
    reference?.foundry?.names,
    reference?.foundry?.noms
  ].flatMap(value => Array.isArray(value) ? value : []);
  return uniqueText([...direct, ...lists]);
}

function loadReferenceEntries() {
  const references = new Map();

  for (const [classSlug, levels] of Object.entries(CLASSES)) {
    for (const level of levels) {
      const relative = `audit/reference/manuel-joueurs-${classSlug}-niveau-${level}.json`;
      const document = readJson(path.join(ROOT, relative), null);
      if (!document) continue;

      for (const spell of document.spells ?? []) {
        const name = text(spell?.nom ?? spell?.name);
        if (!name) continue;
        const referenceLevel = Number(spell?.niveau ?? spell?.level ?? level) || level;
        references.set(metaKey(classSlug, referenceLevel, name), {
          name,
          aliases: referenceAliases(spell),
          source: relative
        });
      }
    }
  }

  return references;
}

function loadPhbInventory() {
  const master = readJson(path.join(ROOT, MASTER_FILE), null);
  if (!master || typeof master !== "object" || !master.lots || typeof master.lots !== "object") {
    throw new Error(`Inventaire du Manuel introuvable ou invalide : ${MASTER_FILE}`);
  }

  const references = loadReferenceEntries();
  const entries = new Map();
  const lookup = new Map();

  for (const [lot, names] of Object.entries(master.lots)) {
    const scope = lotScope(lot);
    if (!scope || !Array.isArray(names)) continue;

    for (const rawName of names) {
      const name = text(rawName);
      if (!name) continue;
      const key = metaKey(scope.classSlug, scope.level, name);
      const reference = references.get(key);
      const aliases = reference?.aliases ?? [];
      const entry = {
        key,
        class: scope.classSlug,
        level: scope.level,
        name,
        aliases,
        referenceFile: reference?.source ?? null
      };

      if (entries.has(key)) {
        throw new Error(`Doublon dans l’inventaire du Manuel : ${key}.`);
      }
      entries.set(key, entry);

      for (const candidateName of [name, ...aliases]) {
        const candidateKey = metaKey(scope.classSlug, scope.level, candidateName);
        const existing = lookup.get(candidateKey);
        if (existing && existing !== key) {
          throw new Error(`Alias Foundry ambigu dans l’inventaire du Manuel : ${candidateKey}.`);
        }
        lookup.set(candidateKey, key);
      }
    }
  }

  if (!entries.size) throw new Error("L’inventaire du Manuel ne contient aucun sort.");
  return { entries, lookup };
}

function summary(item) {
  return {
    id: text(item?._id ?? item?.id) || null,
    name: text(item?.name ?? item?.system?.nom),
    classe: text(item?.system?.classe),
    spellLists: [...itemClasses(item)],
    niveau: itemLevel(item)
  };
}

function reconcile(items, inventory) {
  const matchedReferenceKeys = new Set();
  const outsidePhb = [];
  const matchedItems = [];

  for (const item of items) {
    if (!isSpell(item)) continue;

    const name = text(item?.name ?? item?.system?.nom);
    const level = itemLevel(item);
    const references = [];

    for (const classSlug of itemClasses(item)) {
      const candidate = inventory.lookup.get(metaKey(classSlug, level, name));
      if (candidate) references.push(candidate);
    }

    const uniqueReferences = [...new Set(references)];
    if (!uniqueReferences.length) {
      outsidePhb.push({ key: itemKey(item), ...summary(item) });
      continue;
    }

    for (const key of uniqueReferences) matchedReferenceKeys.add(key);
    matchedItems.push({ key: itemKey(item), item: summary(item), references: uniqueReferences });
  }

  const missingManual = [...inventory.entries.values()]
    .filter(entry => !matchedReferenceKeys.has(entry.key));

  return { outsidePhb, missingManual, matchedItems };
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableValue(value[key])]));
  }
  return value;
}

function sameJson(left, right) {
  return JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right));
}

function assertPhysicalDeletion(before, after, removedKeys) {
  const beforeItems = getItems(before);
  const afterItems = getItems(after);
  const beforeByKey = new Map(beforeItems.map(item => [itemKey(item), item]));
  const afterByKey = new Map(afterItems.map(item => [itemKey(item), item]));
  const actualRemoved = [...beforeByKey.keys()].filter(key => !afterByKey.has(key));
  const unexpectedAdded = [...afterByKey.keys()].filter(key => !beforeByKey.has(key));
  const expectedRemoved = [...removedKeys].sort();

  if (JSON.stringify(actualRemoved.sort()) !== JSON.stringify(expectedRemoved)) {
    throw new Error("Contrôle de suppression échoué : les items supprimés ne correspondent pas exactement à l’inventaire hors Manuel.");
  }
  if (unexpectedAdded.length) {
    throw new Error(`Contrôle de suppression échoué : item(s) ajouté(s) : ${unexpectedAdded.slice(0, 10).join(", ")}.`);
  }

  for (const [key, beforeItem] of beforeByKey) {
    if (removedKeys.has(key)) continue;
    if (!afterByKey.has(key) || !sameJson(beforeItem, afterByKey.get(key))) {
      throw new Error(`Contrôle de suppression échoué : l’item conservé ${key} a été modifié.`);
    }
  }
}

function printReport(label, values) {
  console.log(`[ADD2E][PHB_PRUNE] ${label}: ${values.length}.`);
  for (const value of values) console.log(JSON.stringify(value));
}

function main() {
  const apply = process.argv.slice(2).includes("--apply");
  const v3Path = path.join(ROOT, V3_FILE);
  const controlPath = path.join(ROOT, CONTROL_FILE);
  const v3 = readJson(v3Path, null);
  if (!v3) throw new Error(`Fichier V3 introuvable ou invalide : ${v3Path}`);

  const items = getItems(v3);
  const spells = items.filter(isSpell);
  const inventory = loadPhbInventory();
  const result = reconcile(items, inventory);

  console.log(`[ADD2E][PHB_PRUNE] Sorts V3 analysés: ${spells.length}.`);
  console.log(`[ADD2E][PHB_PRUNE] Sorts déclarés par le Manuel: ${inventory.entries.size}.`);
  console.log(`[ADD2E][PHB_PRUNE] Sorts V3 appariés au Manuel: ${result.matchedItems.length}.`);
  console.log(`[ADD2E][PHB_PRUNE] Sorts V3 hors Manuel: ${result.outsidePhb.length}.`);
  console.log(`[ADD2E][PHB_PRUNE] Sorts du Manuel absents du V3: ${result.missingManual.length}.`);

  if (result.missingManual.length) {
    printReport("Références du Manuel sans équivalent V3 — suppression bloquée", result.missingManual);
    throw new Error("Suppression annulée : chaque sort du Manuel doit être apparié exactement avant toute suppression.");
  }

  if (!apply) {
    printReport("Sorts qui seraient supprimés physiquement avec --apply", result.outsidePhb);
    console.log("[ADD2E][PHB_PRUNE] Mode rapport uniquement : aucun fichier modifié.");
    return;
  }

  const removedKeys = new Set(result.outsidePhb.map(entry => entry.key));
  const prunedItems = items.filter(item => !removedKeys.has(itemKey(item)));
  const nextV3 = setItems(clone(v3), prunedItems);
  assertPhysicalDeletion(v3, nextV3, removedKeys);

  const control = readJson(controlPath, {}) ?? {};
  control.phbPrune = {
    version: VERSION,
    reference: MASTER_FILE,
    appliedAt: new Date().toISOString(),
    sourceSpellCount: spells.length,
    manualSpellCount: inventory.entries.size,
    retainedSpellCount: prunedItems.filter(isSpell).length,
    removed: result.outsidePhb,
    missingManual: []
  };
  control.totalItems = prunedItems.length;
  control.outputSpellCount = prunedItems.filter(isSpell).length;

  writeJson(v3Path, nextV3);
  writeJson(controlPath, control);

  printReport("Sorts supprimés physiquement", result.outsidePhb);
  console.log(`[ADD2E][PHB_PRUNE] Terminé: ${prunedItems.filter(isSpell).length} sort(s) restent dans le V3.`);
}

main();
