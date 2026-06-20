import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const VERSION = "2026-06-20-phb-inventory-prune-v3-strict-class-entries";
const V3_FILE = "fvtt-spells-all-normalise-mecanique-v3.json";
const CONTROL_FILE = "fvtt-spells-all-normalise-mecanique-v3-controle.json";
const MASTER_FILE = "audit/reference/manuel-joueurs-sorts-master.json";
const CLASSES = {
  clerc: [1, 2, 3, 4, 5, 6, 7],
  druide: [1, 2, 3, 4, 5, 6, 7],
  magicien: [1, 2, 3, 4, 5, 6, 7, 8, 9],
  illusionniste: [1, 2, 3, 4, 5, 6, 7]
};
const CLASS_LABELS = {
  clerc: "Clerc",
  druide: "Druide",
  magicien: "Magicien",
  illusionniste: "Illusionniste"
};

// Correction explicite d’une faute historique de transcription dans la référence.
const LEGACY_REFERENCE_NAME_ALIASES = new Map([
  ["teleikinesie", "telekinesie"]
]);

// Ces entrées existent dans le Manuel mais avaient été fusionnées à tort dans le V3.
// Chaque cible reçoit désormais son propre item, à partir du sort équivalent déjà validé.
const MISSING_CLASS_ENTRIES = [
  {
    target: { classSlug: "magicien", level: 1, name: "Lumière" },
    source: { classSlug: "clerc", level: 1, name: "Lumière" }
  },
  {
    target: { classSlug: "illusionniste", level: 1, name: "Lumière" },
    source: { classSlug: "clerc", level: 1, name: "Lumière" }
  },
  {
    target: { classSlug: "magicien", level: 2, name: "Détection de l'invisibilité" },
    source: { classSlug: "illusionniste", level: 1, name: "Détection de l’invisibilité" }
  }
];

const text = value => String(value ?? "").replace(/\s+/g, " ").trim();
const slug = value => text(value)
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[’']/g, "'")
  .replace(/[^a-z0-9]+/g, "_")
  .replace(/^_+|_+$/g, "");
const nameKey = value => LEGACY_REFERENCE_NAME_ALIASES.get(slug(value)) ?? slug(value);
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

function referenceKey(classSlug, level, name) {
  return `${classSlug}|${level}|${slug(name)}`;
}

function scopedNameKey(classSlug, level, name) {
  return `${classSlug}|${level}|${nameKey(name)}`;
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

function addStrictLookup(lookup, classSlug, level, candidateName, canonicalKey) {
  const key = scopedNameKey(classSlug, level, candidateName);
  const previous = lookup.get(key);
  if (previous && previous !== canonicalKey) {
    throw new Error(`Alias Foundry ambigu dans l’inventaire du Manuel : ${key}.`);
  }
  lookup.set(key, canonicalKey);
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
        references.set(referenceKey(classSlug, referenceLevel, name), {
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
      const key = referenceKey(scope.classSlug, scope.level, name);
      if (entries.has(key)) {
        throw new Error(`Doublon dans l’inventaire du Manuel : ${key}.`);
      }

      const reference = references.get(key);
      const entry = {
        key,
        class: scope.classSlug,
        level: scope.level,
        name,
        aliases: reference?.aliases ?? [],
        referenceFile: reference?.source ?? null
      };
      entries.set(key, entry);

      for (const candidateName of [name, ...entry.aliases]) {
        addStrictLookup(lookup, entry.class, entry.level, candidateName, key);
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
  const sharedV3Items = [];
  const matchedItems = [];

  for (const item of items) {
    if (!isSpell(item)) continue;

    const name = text(item?.name ?? item?.system?.nom);
    const level = itemLevel(item);
    const canonicalReferences = new Set();
    for (const classSlug of itemClasses(item)) {
      const key = inventory.lookup.get(scopedNameKey(classSlug, level, name));
      if (key) canonicalReferences.add(key);
    }

    if (!canonicalReferences.size) {
      outsidePhb.push({ key: itemKey(item), ...summary(item) });
      continue;
    }

    if (canonicalReferences.size !== 1) {
      sharedV3Items.push({
        key: itemKey(item),
        ...summary(item),
        references: [...canonicalReferences]
      });
      continue;
    }

    const canonicalKey = [...canonicalReferences][0];
    if (matchedReferenceKeys.has(canonicalKey)) {
      sharedV3Items.push({
        key: itemKey(item),
        ...summary(item),
        references: [canonicalKey],
        reason: "duplicate_class_level_entry"
      });
      continue;
    }

    matchedReferenceKeys.add(canonicalKey);
    matchedItems.push({
      key: itemKey(item),
      item: summary(item),
      reference: canonicalKey
    });
  }

  const missingManual = [...inventory.entries.values()]
    .filter(entry => !matchedReferenceKeys.has(entry.key));

  return { outsidePhb, missingManual, sharedV3Items, matchedItems };
}

function randomId() {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = randomBytes(16);
  return [...bytes].map(byte => alphabet[byte % alphabet.length]).join("");
}

function collectIds(value, ids = new Set()) {
  if (Array.isArray(value)) {
    for (const entry of value) collectIds(entry, ids);
    return ids;
  }
  if (!value || typeof value !== "object") return ids;
  if (text(value._id)) ids.add(text(value._id));
  for (const child of Object.values(value)) collectIds(child, ids);
  return ids;
}

function rewriteClassTags(tags, targetClassSlug, targetLevel) {
  if (!Array.isArray(tags)) return tags;
  return tags.map(tag => {
    if (typeof tag !== "string") return tag;
    if (tag.startsWith("classe:")) return `classe:${targetClassSlug}`;
    if (tag.startsWith("liste:")) return `liste:${targetClassSlug}`;
    if (tag.startsWith("niveau:")) return `niveau:${targetLevel}`;
    return tag;
  });
}

function patchClassMetadata(item, targetClassSlug, targetLevel, targetTemplate) {
  const targetClass = CLASS_LABELS[targetClassSlug];
  item.system ??= {};
  item.system.classe = targetClass;
  item.system.spellLists = [targetClass];
  item.system.niveau = targetLevel;

  if (targetTemplate?.folder !== undefined) item.folder = targetTemplate.folder;
  if (targetTemplate?.flags?.add2eExport?.folderPath) {
    item.flags ??= {};
    item.flags.add2eExport ??= {};
    item.flags.add2eExport.folderPath = targetTemplate.flags.add2eExport.folderPath;
    if (targetTemplate.flags.add2eExport.sourceFolderId !== undefined) {
      item.flags.add2eExport.sourceFolderId = targetTemplate.flags.add2eExport.sourceFolderId;
    }
  }

  item.flags ??= {};
  item.flags.add2e ??= {};
  if (item.flags.add2e.routedClass !== undefined) item.flags.add2e.routedClass = targetClass;
  if (Array.isArray(item.flags.add2e.spellListsResolved)) item.flags.add2e.spellListsResolved = [targetClass];
  if (Array.isArray(item.flags.add2e.tags)) {
    item.flags.add2e.tags = rewriteClassTags(item.flags.add2e.tags, targetClassSlug, targetLevel);
  }

  for (const effect of item.effects ?? []) {
    effect.flags ??= {};
    effect.flags.add2e ??= {};
    if (Array.isArray(effect.flags.add2e.tags)) {
      effect.flags.add2e.tags = rewriteClassTags(effect.flags.add2e.tags, targetClassSlug, targetLevel);
    }
  }
}

function clearManagedReferenceFlags(item) {
  const add2e = item?.flags?.add2e;
  if (!add2e || typeof add2e !== "object") return;
  for (const key of ["reversible", "variant", "variants"]) {
    if (add2e[key]?.managedBy === "normalize-fvtt-spells-materials-v3") delete add2e[key];
  }
  if (Object.keys(add2e).length === 0) delete item.flags.add2e;
  if (item.flags && Object.keys(item.flags).length === 0) delete item.flags;
}

function duplicateSpellItem(source, target, targetTemplate, usedIds) {
  const item = clone(source);
  clearManagedReferenceFlags(item);
  const sourceRootId = text(item._id);
  let rootId = randomId();
  while (usedIds.has(rootId)) rootId = randomId();
  usedIds.add(rootId);
  item._id = rootId;

  for (const effect of item.effects ?? []) {
    let effectId = randomId();
    while (usedIds.has(effectId)) effectId = randomId();
    usedIds.add(effectId);
    effect._id = effectId;
    if (text(effect.origin) === `Item.${sourceRootId}`) effect.origin = `Item.${rootId}`;
  }

  patchClassMetadata(item, target.classSlug, target.level, targetTemplate);
  return item;
}

function findStrictItem(items, scope) {
  const expectedName = nameKey(scope.name);
  const matches = items.filter(item => isSpell(item)
    && itemLevel(item) === scope.level
    && itemClasses(item).has(scope.classSlug)
    && nameKey(item?.name ?? item?.system?.nom) === expectedName);

  if (matches.length !== 1) {
    throw new Error(
      `Source/tampon introuvable ou ambigu pour ${scope.classSlug} niveau ${scope.level} « ${scope.name} » : ${matches.length} résultat(s).`
    );
  }
  return matches[0];
}

function materializeMissingEntries(v3, inventory, reconciliation) {
  const missingKeys = new Set(reconciliation.missingManual.map(entry => entry.key));
  const configuredTargets = new Set(MISSING_CLASS_ENTRIES.map(entry =>
    referenceKey(entry.target.classSlug, entry.target.level, entry.target.name)
  ));
  const unexpectedMissing = [...missingKeys].filter(key => !configuredTargets.has(key));
  const staleConfiguration = [...configuredTargets].filter(key => !missingKeys.has(key));

  if (unexpectedMissing.length || staleConfiguration.length) {
    throw new Error(
      `Matérialisation bloquée : références manquantes inattendues (${unexpectedMissing.join(", ") || "aucune"}) ; configurations devenues inutiles (${staleConfiguration.join(", ") || "aucune"}).`
    );
  }

  const items = getItems(v3);
  const usedIds = collectIds(v3);
  const additions = [];

  for (const mapping of MISSING_CLASS_ENTRIES) {
    const expected = inventory.entries.get(referenceKey(mapping.target.classSlug, mapping.target.level, mapping.target.name));
    if (!expected) {
      throw new Error(`Cible absente de l’inventaire du Manuel : ${mapping.target.classSlug} niveau ${mapping.target.level} « ${mapping.target.name} ».`);
    }

    const source = findStrictItem(items, mapping.source);
    const targetTemplate = items.find(item => isSpell(item)
      && itemLevel(item) === mapping.target.level
      && itemClasses(item).has(mapping.target.classSlug));
    if (!targetTemplate) {
      throw new Error(`Aucun sort tampon pour le dossier ${mapping.target.classSlug} niveau ${mapping.target.level}.`);
    }

    const duplicate = duplicateSpellItem(source, mapping.target, targetTemplate, usedIds);
    additions.push({
      target: expected,
      source: summary(source),
      created: summary(duplicate),
      item: duplicate
    });
  }

  const next = setItems(clone(v3), [...items, ...additions.map(entry => entry.item)]);
  return { next, additions };
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

function assertPhysicalMutation(before, after, removedKeys = new Set(), addedKeys = new Set()) {
  const beforeItems = getItems(before);
  const afterItems = getItems(after);
  const beforeByKey = new Map(beforeItems.map(item => [itemKey(item), item]));
  const afterByKey = new Map(afterItems.map(item => [itemKey(item), item]));

  const actualRemoved = new Set([...beforeByKey.keys()].filter(key => !afterByKey.has(key)));
  const actualAdded = new Set([...afterByKey.keys()].filter(key => !beforeByKey.has(key)));
  if (JSON.stringify([...actualRemoved].sort()) !== JSON.stringify([...removedKeys].sort())) {
    throw new Error("Contrôle échoué : les items supprimés ne correspondent pas exactement au plan.");
  }
  if (JSON.stringify([...actualAdded].sort()) !== JSON.stringify([...addedKeys].sort())) {
    throw new Error("Contrôle échoué : les items ajoutés ne correspondent pas exactement au plan.");
  }

  for (const [key, beforeItem] of beforeByKey) {
    if (removedKeys.has(key)) continue;
    if (!afterByKey.has(key) || !sameJson(beforeItem, afterByKey.get(key))) {
      throw new Error(`Contrôle échoué : l’item conservé ${key} a été modifié.`);
    }
  }
}

function writeControl(controlPath, patch) {
  const control = readJson(controlPath, {}) ?? {};
  control.phbPrune = {
    version: VERSION,
    reference: MASTER_FILE,
    ...patch
  };
  control.totalItems = patch.totalItems;
  control.outputSpellCount = patch.spellCount;
  writeJson(controlPath, control);
}

function printReport(label, values) {
  console.log(`[ADD2E][PHB_PRUNE] ${label}: ${values.length}.`);
  for (const value of values) console.log(JSON.stringify(value));
}

function main() {
  const args = new Set(process.argv.slice(2));
  const apply = args.has("--apply");
  const addMissing = args.has("--add-missing");
  if (apply && addMissing) throw new Error("Utiliser --add-missing puis --apply dans deux exécutions séparées.");

  const v3Path = path.join(ROOT, V3_FILE);
  const controlPath = path.join(ROOT, CONTROL_FILE);
  const v3 = readJson(v3Path, null);
  if (!v3) throw new Error(`Fichier V3 introuvable ou invalide : ${v3Path}`);

  const inventory = loadPhbInventory();
  const reconciliation = reconcile(getItems(v3), inventory);
  const spells = getItems(v3).filter(isSpell);

  console.log(`[ADD2E][PHB_PRUNE] Sorts V3 analysés: ${spells.length}.`);
  console.log(`[ADD2E][PHB_PRUNE] Entrées classe/niveau déclarées par le Manuel: ${inventory.entries.size}.`);
  console.log(`[ADD2E][PHB_PRUNE] Entrées V3 appariées strictement: ${reconciliation.matchedItems.length}.`);
  console.log(`[ADD2E][PHB_PRUNE] Entrées V3 partagées ou dupliquées: ${reconciliation.sharedV3Items.length}.`);
  console.log(`[ADD2E][PHB_PRUNE] Sorts V3 hors Manuel: ${reconciliation.outsidePhb.length}.`);
  console.log(`[ADD2E][PHB_PRUNE] Entrées du Manuel absentes du V3: ${reconciliation.missingManual.length}.`);

  if (reconciliation.sharedV3Items.length) {
    printReport("Entrées V3 à scinder ou doublons — opération bloquée", reconciliation.sharedV3Items);
    throw new Error("Suppression annulée : chaque sort V3 doit correspondre à une seule entrée classe/niveau du Manuel.");
  }

  if (addMissing) {
    if (!reconciliation.missingManual.length) {
      console.log("[ADD2E][PHB_PRUNE] Aucun sort du Manuel à matérialiser.");
      return;
    }

    const { next, additions } = materializeMissingEntries(v3, inventory, reconciliation);
    const addedKeys = new Set(additions.map(entry => itemKey(entry.item)));
    assertPhysicalMutation(v3, next, new Set(), addedKeys);
    writeJson(v3Path, next);
    writeControl(controlPath, {
      action: "materialize_missing_class_entries",
      appliedAt: new Date().toISOString(),
      sourceSpellCount: spells.length,
      spellCount: getItems(next).filter(isSpell).length,
      totalItems: getItems(next).length,
      manualClassLevelEntryCount: inventory.entries.size,
      materialized: additions.map(({ target, source, created }) => ({ target, source, created })),
      missingManualBefore: reconciliation.missingManual,
      removed: []
    });
    printReport("Entrées classe/niveau matérialisées", additions.map(({ target, source, created }) => ({ target, source, created })));
    console.log(`[ADD2E][PHB_PRUNE] Terminé: ${getItems(next).filter(isSpell).length} sort(s) dans le V3.`);
    return;
  }

  if (reconciliation.missingManual.length) {
    printReport("Références du Manuel sans entrée V3 distincte — suppression bloquée", reconciliation.missingManual);
    throw new Error("Suppression annulée : chaque entrée classe/niveau du Manuel doit avoir son item V3 distinct.");
  }

  if (!apply) {
    printReport("Sorts qui seraient supprimés physiquement avec --apply", reconciliation.outsidePhb);
    console.log("[ADD2E][PHB_PRUNE] Mode rapport uniquement : aucun fichier modifié.");
    return;
  }

  const removedKeys = new Set(reconciliation.outsidePhb.map(entry => entry.key));
  const remainingItems = getItems(v3).filter(item => !removedKeys.has(itemKey(item)));
  const next = setItems(clone(v3), remainingItems);
  assertPhysicalMutation(v3, next, removedKeys, new Set());

  writeJson(v3Path, next);
  writeControl(controlPath, {
    action: "prune_non_phb_spells",
    appliedAt: new Date().toISOString(),
    sourceSpellCount: spells.length,
    spellCount: remainingItems.filter(isSpell).length,
    totalItems: remainingItems.length,
    manualClassLevelEntryCount: inventory.entries.size,
    materialized: [],
    missingManualBefore: [],
    removed: reconciliation.outsidePhb
  });

  printReport("Sorts supprimés physiquement", reconciliation.outsidePhb);
  console.log(`[ADD2E][PHB_PRUNE] Terminé: ${remainingItems.filter(isSpell).length} sort(s) restent dans le V3.`);
}

main();
