import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DEFAULT_V3 = "fvtt-spells-all-normalise-mecanique-v3.json";
const DEFAULT_V4 = "fvtt-spells-all-normalise-mecanique-v4.json";

// V3 reste la source absolue des composants matériels. V4 est la sortie modifiée.
const REQUIRED_INSTANCES = Object.freeze([
  {
    referenceFile: "audit/reference/manuel-joueurs-illusionniste-niveau-1.json",
    name: "Lumière",
    className: "Illusionniste",
    level: 1,
    template: { name: "Lumière", className: "Clerc", level: 1 },
    componentsFromV3: { name: "Lumière", className: "Clerc", level: 1 }
  },
  {
    referenceFile: "audit/reference/manuel-joueurs-magicien-niveau-1.json",
    name: "Lumière",
    className: "Magicien",
    level: 1,
    template: { name: "Lumière", className: "Clerc", level: 1 },
    componentsFromV3: { name: "Lumière", className: "Clerc", level: 1 }
  },
  {
    referenceFile: "audit/reference/manuel-joueurs-magicien-niveau-2.json",
    name: "Détection de l'invisibilité",
    className: "Magicien",
    level: 2,
    template: { name: "Détection de l'invisibilité", className: "Illusionniste", level: 1 },
    componentsFromV3: { name: "Détection de l'invisibilité", className: "Illusionniste", level: 1 }
  }
]);

function parseArgs(argv) {
  const options = { v3: DEFAULT_V3, v4: DEFAULT_V4, dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = argv[index + 1];
    if (arg === "--v3" && value) { options.v3 = value; index += 1; }
    else if (arg === "--v4" && value) { options.v4 = value; index += 1; }
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--help" || arg === "-h") {
      console.log("Usage: node audit/tools/apply-required-foundry-spell-instances.mjs [--v3 fvtt-spells-all-normalise-mecanique-v3.json] [--v4 fvtt-spells-all-normalise-mecanique-v4.json] [--dry-run]");
      process.exit(0);
    } else throw new Error(`Argument inconnu ou incomplet : ${arg}`);
  }
  return options;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function text(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function slug(value) {
  return text(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .toLocaleLowerCase("fr")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function levelValue(value) {
  const parsed = Number(String(value ?? "").match(/\d+/)?.[0] ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function isSpell(item) {
  return String(item?.type ?? item?.system?.type ?? "").toLocaleLowerCase("fr") === "sort";
}

function collection(document) {
  if (Array.isArray(document)) return { key: null, items: document };
  for (const key of ["items", "Item", "Items", "documents", "data", "entries"]) {
    if (Array.isArray(document?.[key])) return { key, items: document[key] };
  }
  return { key: null, items: null };
}

function setCollection(document, descriptor, items) {
  if (descriptor.key === null) return items;
  document[descriptor.key] = items;
  return document;
}

function findSpell(items, wanted, label) {
  const wantedName = slug(wanted.name);
  const wantedClass = slug(wanted.className);
  const matches = items.filter((item) => {
    if (!isSpell(item)) return false;
    const system = item.system ?? {};
    return slug(item.name ?? system.nom) === wantedName
      && slug(system.classe) === wantedClass
      && levelValue(system.niveau) === Number(wanted.level);
  });
  if (matches.length !== 1) {
    throw new Error(`${label}: ${matches.length} item(s) trouvé(s) pour ${wanted.className} niveau ${wanted.level} — ${wanted.name}.`);
  }
  return matches[0];
}

function findReferenceSpell(file, target) {
  const document = readJson(path.resolve(ROOT, file));
  if (!Array.isArray(document?.spells)) throw new Error(`Référence invalide : ${file}`);
  const matches = document.spells.filter((spell) => slug(spell?.nom) === slug(target.name) && levelValue(spell?.niveau) === target.level);
  if (matches.length !== 1) {
    throw new Error(`Référence ${file}: ${matches.length} sort(s) trouvé(s) pour niveau ${target.level} — ${target.name}.`);
  }
  return matches[0];
}

function folderFor(v4, className, level) {
  const folders = Array.isArray(v4?.folders) ? v4.folders : [];
  const classFolder = folders.find((folder) => slug(folder?.name) === slug(className));
  if (!classFolder?._id) throw new Error(`Dossier de classe introuvable dans V4 : ${className}.`);
  const levelName = `Niveau ${level}`;
  const levelFolder = folders.find((folder) => slug(folder?.name) === slug(levelName) && folder?.folder === classFolder._id);
  if (!levelFolder?._id) throw new Error(`Dossier ${className} / ${levelName} introuvable dans V4.`);
  return levelFolder;
}

function stableId(seed, usedIds) {
  let suffix = 0;
  while (true) {
    const value = `${seed}${suffix ? `#${suffix}` : ""}`;
    const id = crypto.createHash("sha256").update(value).digest("hex").slice(0, 16);
    if (!usedIds.has(id)) {
      usedIds.add(id);
      return id;
    }
    suffix += 1;
  }
}

function allEffectIds(items) {
  return new Set(items.flatMap((item) => Array.isArray(item?.effects) ? item.effects : [])
    .map((effect) => text(effect?._id ?? effect?.id))
    .filter(Boolean));
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === "") return [];
  return [value];
}

function spellPackFor(className) {
  return slug(className) === "illusionniste" ? "illusionniste-niveaux-1-7" : "magicien-niveaux-1-9";
}

function setTextValue(system, field, value) {
  const current = system[field];
  if (current && typeof current === "object" && !Array.isArray(current)) {
    system[field] = { ...current, valeur: value, unite: current.unite ?? "texte" };
  } else {
    system[field] = { valeur: value, unite: "texte" };
  }
}

function identityTags(existingTags, target, reference) {
  const retained = asArray(existingTags)
    .map(text)
    .filter(Boolean)
    .filter((tag) => !/^(classe|liste|niveau|sort|ecole):/i.test(tag));
  return unique([
    ...retained,
    `classe:${slug(target.className)}`,
    `liste:${slug(target.className)}`,
    `niveau:${target.level}`,
    `sort:${slug(reference.nom)}`,
    `ecole:${slug(reference.ecole)}`
  ]);
}

function updateEffects(effects, { target, reference, itemId, image, isNew, usedEffectIds }) {
  return asArray(effects).map((effect, index) => {
    const next = clone(effect) ?? {};
    if (isNew || !text(next._id ?? next.id)) next._id = stableId(`effect:${target.className}|${target.level}|${reference.nom}|${index}`, usedEffectIds);
    next.name = reference.nom;
    next.origin = `Item.${itemId}`;
    if (image) next.img = image;
    next.flags ??= {};
    next.flags.add2e ??= {};
    next.flags.add2e.tags = identityTags(next.flags.add2e.tags, target, reference);
    return next;
  });
}

function prepareItem({ target, reference, template, componentSource, targetFolder, existing, usedItemIds, usedEffectIds }) {
  const isNew = !existing;
  const item = clone(existing ?? template);
  if (!item) throw new Error(`Modèle V4 introuvable pour ${target.name}.`);
  if (isNew) item._id = stableId(`item:${target.className}|${target.level}|${reference.nom}`, usedItemIds);
  const itemId = text(item._id ?? item.id);
  if (!itemId) throw new Error(`Identifiant Foundry absent pour ${target.className} niveau ${target.level} — ${reference.nom}.`);

  item.type = "sort";
  item.name = reference.nom;
  item.folder = targetFolder._id;
  item.system ??= {};
  item.system.nom = reference.nom;
  item.system.classe = target.className;
  item.system.spellLists = [target.className];
  item.system.niveau = target.level;
  item.system.ecole = reference.ecole;
  delete item.system["école"];
  setTextValue(item.system, "portee", reference.portee);
  setTextValue(item.system, "duree", reference.duree);
  setTextValue(item.system, "zone_effet", reference.zone_effet);
  setTextValue(item.system, "temps_incantation", reference.temps_incantation);
  item.system.composantes = reference.composantes;
  item.system.jet_sauvegarde = reference.jet_sauvegarde;
  item.system.description = reference.description;
  item.system.composants_materiels = clone(componentSource.system?.composants_materiels ?? []);
  item.system.onUse ||= reference?.foundry?.onUse ?? "";

  item.flags ??= {};
  item.flags.add2e ??= {};
  item.flags.add2e.routedClass = target.className;
  item.flags.add2e.spellListsResolved = [target.className];
  item.flags.add2e.spellPack = spellPackFor(target.className);
  if (item.system.onUse) item.flags.add2e.originalOnUse = item.system.onUse;
  item.flags.add2e.requiredFoundryInstance = true;
  item.flags.add2e.requiredFoundryInstanceKey = `${slug(target.className)}|${target.level}|${slug(reference.nom)}`;
  item.flags.add2eExport ??= {};
  item.flags.add2eExport.folderPath = `Sorts / ${target.className} / Niveau ${target.level}`;
  item.flags.add2eExport.sourceFolderId = targetFolder._id;

  item.effects = updateEffects(item.effects, {
    target,
    reference,
    itemId,
    image: item.img,
    isNew,
    usedEffectIds
  });

  if (isNew) {
    item._stats = clone(template?._stats ?? {});
    if (item._stats && typeof item._stats === "object") {
      item._stats.compendiumSource = null;
      item._stats.duplicateSource = null;
      item._stats.exportSource = null;
    }
  }

  return { item, isNew };
}

function apply(options) {
  const v3Path = path.resolve(ROOT, options.v3);
  const v4Path = path.resolve(ROOT, options.v4);
  const v3 = readJson(v3Path);
  const v4 = readJson(v4Path);
  const v3Collection = collection(v3);
  const v4Collection = collection(v4);
  if (!Array.isArray(v3Collection.items)) throw new Error(`Collection de sorts V3 introuvable : ${options.v3}`);
  if (!Array.isArray(v4Collection.items)) throw new Error(`Collection de sorts V4 introuvable : ${options.v4}`);

  const items = v4Collection.items.map(clone);
  const usedItemIds = new Set(items.map((item) => text(item?._id ?? item?.id)).filter(Boolean));
  const usedEffectIds = allEffectIds(items);
  const changes = [];

  for (const target of REQUIRED_INSTANCES) {
    const reference = findReferenceSpell(target.referenceFile, target);
    const template = findSpell(items, target.template, "Modèle V4");
    const componentSource = findSpell(v3Collection.items, target.componentsFromV3, "Source composants V3");
    const existingIndex = items.findIndex((item) => {
      if (!isSpell(item)) return false;
      const system = item.system ?? {};
      return slug(item.name ?? system.nom) === slug(target.name)
        && slug(system.classe) === slug(target.className)
        && levelValue(system.niveau) === target.level;
    });
    const targetFolder = folderFor(v4, target.className, target.level);
    const prepared = prepareItem({
      target,
      reference,
      template,
      componentSource,
      targetFolder,
      existing: existingIndex >= 0 ? items[existingIndex] : null,
      usedItemIds,
      usedEffectIds
    });

    if (prepared.isNew) {
      const folderSorts = items.filter((item) => item?.folder === targetFolder._id).map((item) => Number(item?.sort) || 0);
      prepared.item.sort = (folderSorts.length ? Math.max(...folderSorts) : -1) + 1;
      items.push(prepared.item);
    } else {
      items[existingIndex] = prepared.item;
    }
    changes.push({
      action: prepared.isNew ? "created" : "updated",
      name: reference.nom,
      className: target.className,
      level: target.level,
      spellLists: prepared.item.system.spellLists,
      componentsCopiedFromV3: componentSource.name ?? componentSource.system?.nom ?? null,
      id: prepared.item._id
    });
  }

  setCollection(v4, v4Collection, items);
  if (!options.dryRun) writeJson(v4Path, v4);

  console.log(`[ADD2E][REQUIRED_SPELL_INSTANCES] ${options.dryRun ? "Simulation" : "V4 mis à jour"} : ${changes.length} instance(s).`);
  for (const change of changes) {
    console.log(`[ADD2E][REQUIRED_SPELL_INSTANCES] ${change.action}: ${change.className} niveau ${change.level} — ${change.name} | spellLists=${JSON.stringify(change.spellLists)} | composants V3=${change.componentsCopiedFromV3} | id=${change.id}`);
  }
  console.log("[ADD2E][REQUIRED_SPELL_INSTANCES] V3 n'a pas été modifié.");
}

apply(parseArgs(process.argv.slice(2)));
