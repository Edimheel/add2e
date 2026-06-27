import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const V3_FILE = "fvtt-spells-all-normalise-mecanique-v3.json";
const V4_FILE = "fvtt-spells-all-normalise-mecanique-v4.json";
const REFERENCE_DIR = path.join(ROOT, "audit/reference");
const REFERENCE_FILE_PATTERN = /^manuel-joueurs-(clerc|druide|magicien|illusionniste)-niveau-[1-9]\.json$/;

// Trois items V4 distincts requis par l'audit d'identité.
const TARGETS = [
  { ref: "audit/reference/manuel-joueurs-illusionniste-niveau-1.json", name: "Lumière", classe: "Illusionniste", niveau: 1, model: ["Clerc", 1, "Lumière"], componentSource: ["Clerc", 1, "Lumière"] },
  { ref: "audit/reference/manuel-joueurs-magicien-niveau-1.json", name: "Lumière", classe: "Magicien", niveau: 1, model: ["Clerc", 1, "Lumière"], componentSource: ["Clerc", 1, "Lumière"] },
  { ref: "audit/reference/manuel-joueurs-magicien-niveau-2.json", name: "Détection de l'invisibilité", classe: "Magicien", niveau: 2, model: ["Illusionniste", 1, "Détection de l'invisibilité"], componentSource: ["Illusionniste", 1, "Détection de l'invisibilité"] }
];

const copy = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const text = value => String(value ?? "").replace(/\s+/g, " ").trim();
const level = value => Number(String(value ?? "").match(/\d+/)?.[0] ?? 0) || 0;
const slug = value => text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
const isSpell = item => String(item?.type ?? item?.system?.type ?? "").toLowerCase() === "sort";
const read = file => JSON.parse(fs.readFileSync(file, "utf8"));
const write = (file, data) => fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
const spellKey = (classe, niveau, name) => {
  const classKey = slug(classe);
  const nameKey = slug(name);
  const spellLevel = level(niveau);
  return classKey && nameKey && spellLevel ? `${classKey}|${spellLevel}|${nameKey}` : null;
};

function parseArgs(argv) {
  const syncManualComponents = argv.includes("--sync-manual-components");
  const applyRequiredInstances = argv.includes("--required-instances") || !syncManualComponents;
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log("Usage:");
    console.log("  node audit/tools/apply-required-foundry-spell-instances.mjs [--dry-run]");
    console.log("  node audit/tools/apply-required-foundry-spell-instances.mjs --sync-manual-components [--dry-run]");
    console.log("  node audit/tools/apply-required-foundry-spell-instances.mjs --sync-manual-components --required-instances [--dry-run]");
    process.exit(0);
  }
  return { dryRun: argv.includes("--dry-run"), syncManualComponents, applyRequiredInstances };
}

function find(items, classe, niveau, name, label) {
  const found = items.filter(item => isSpell(item)
    && slug(item?.system?.classe) === slug(classe)
    && level(item?.system?.niveau) === Number(niveau)
    && slug(item?.name ?? item?.system?.nom) === slug(name));
  if (found.length !== 1) throw new Error(`${label}: ${found.length} item(s) pour ${classe} niveau ${niveau} — ${name}.`);
  return found[0];
}

function id(seed, used) {
  for (let count = 0; ; count += 1) {
    const next = crypto.createHash("sha256").update(`${seed}:${count}`).digest("hex").slice(0, 16);
    if (!used.has(next)) { used.add(next); return next; }
  }
}

function writeText(system, key, value) {
  const previous = system[key];
  system[key] = previous && typeof previous === "object" && !Array.isArray(previous)
    ? { ...previous, valeur: value, unite: previous.unite ?? "texte" }
    : { valeur: value, unite: "texte" };
}

function folderId(v4, classe, niveau) {
  const folders = v4.folders ?? [];
  const classFolder = folders.find(folder => slug(folder?.name) === slug(classe));
  const levelFolder = folders.find(folder => slug(folder?.name) === slug(`Niveau ${niveau}`) && folder?.folder === classFolder?._id);
  if (!levelFolder?._id) throw new Error(`Dossier introuvable : ${classe} / Niveau ${niveau}.`);
  return levelFolder._id;
}

function setTags(tags, target, reference) {
  const previous = Array.isArray(tags) ? tags : [];
  const retained = previous.filter(tag => !/^(classe|liste|niveau|sort|ecole):/i.test(String(tag)));
  return [...new Set([...retained, `classe:${slug(target.classe)}`, `liste:${slug(target.classe)}`, `niveau:${target.niveau}`, `sort:${slug(reference.nom)}`, `ecole:${slug(reference.ecole)}`])];
}

function hasMaterialComponent(composantes) {
  return /(^|[,;\s])M(?=$|[,;\s().])/u.test(text(composantes).toUpperCase());
}

function hasMaterialEntries(value) {
  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined && value !== null && value !== "";
}

function referencePolicies() {
  const policies = new Map();
  const files = fs.readdirSync(REFERENCE_DIR)
    .filter(file => REFERENCE_FILE_PATTERN.test(file))
    .sort((left, right) => left.localeCompare(right, "fr"));

  for (const file of files) {
    const document = read(path.join(REFERENCE_DIR, file));
    const classe = text(document?.source?.classe);
    const defaultLevel = level(document?.source?.niveau);
    if (!classe || !defaultLevel || !Array.isArray(document?.spells)) {
      throw new Error(`Référence invalide : audit/reference/${file}.`);
    }
    for (const spell of document.spells) {
      const key = spellKey(classe, spell?.niveau ?? defaultLevel, spell?.nom);
      if (!key) throw new Error(`Identité de référence invalide : audit/reference/${file}.`);
      if (policies.has(key)) throw new Error(`Référence du Manuel dupliquée : ${key}.`);
      const composantes = text(spell?.composantes);
      if (!composantes) throw new Error(`Composantes absentes dans audit/reference/${file} pour ${spell?.nom ?? key}.`);
      policies.set(key, {
        key,
        file: `audit/reference/${file}`,
        nom: text(spell.nom),
        classe,
        niveau: level(spell?.niveau ?? defaultLevel),
        composantes,
        hasMaterial: hasMaterialComponent(composantes)
      });
    }
  }
  return policies;
}

function syncNoMaterialEntries(document, policies, sourceLabel) {
  const changes = [];
  const items = Array.isArray(document?.items) ? document.items : [];
  for (const item of items) {
    if (!isSpell(item)) continue;
    const system = item.system ??= {};
    const key = spellKey(system.classe, system.niveau, item.name ?? system.nom);
    const policy = key ? policies.get(key) : null;
    if (!policy || policy.hasMaterial) continue;

    const updated = [];
    if (text(system.composantes) !== policy.composantes) {
      system.composantes = policy.composantes;
      updated.push("composantes");
    }
    if (hasMaterialEntries(system.composants_materiels)) {
      system.composants_materiels = [];
      updated.push("composants_materiels");
    }
    if (updated.length) {
      changes.push({ source: sourceLabel, key, nom: policy.nom, classe: policy.classe, niveau: policy.niveau, updated });
    }
  }
  return changes;
}

function syncManualComponents(v3, v4, dryRun) {
  const policies = referencePolicies();
  const v3Changes = syncNoMaterialEntries(v3, policies, "V3");
  const v4Changes = syncNoMaterialEntries(v4, policies, "V4");
  if (!dryRun) {
    if (v3Changes.length) write(path.join(ROOT, V3_FILE), v3);
    if (v4Changes.length) write(path.join(ROOT, V4_FILE), v4);
  }
  return { policies: policies.size, v3Changes, v4Changes };
}

function applyRequiredInstances(v3, v4) {
  const items = v4.items.map(copy);
  const usedIds = new Set(items.map(item => text(item?._id ?? item?.id)).filter(Boolean));
  const usedEffectIds = new Set(items.flatMap(item => Array.isArray(item?.effects) ? item.effects : []).map(effect => text(effect?._id ?? effect?.id)).filter(Boolean));
  const log = [];

  for (const target of TARGETS) {
    const ref = read(path.join(ROOT, target.ref));
    const reference = (ref.spells ?? []).find(spell => slug(spell?.nom) === slug(target.name) && level(spell?.niveau) === target.niveau);
    if (!reference) throw new Error(`Référence introuvable : ${target.ref} — ${target.name}.`);
    const [modelClass, modelLevel, modelName] = target.model;
    const [componentClass, componentLevel, componentName] = target.componentSource;
    const model = find(items, modelClass, modelLevel, modelName, "Modèle V4");
    const componentItem = find(v3.items, componentClass, componentLevel, componentName, "Source composants V3");
    const existingIndex = items.findIndex(item => isSpell(item)
      && slug(item?.system?.classe) === slug(target.classe)
      && level(item?.system?.niveau) === target.niveau
      && slug(item?.name ?? item?.system?.nom) === slug(target.name));
    const created = existingIndex < 0;
    const item = copy(created ? model : items[existingIndex]);
    if (created) item._id = id(`item:${target.classe}|${target.niveau}|${target.name}`, usedIds);

    item.type = "sort";
    item.name = reference.nom;
    item.folder = folderId(v4, target.classe, target.niveau);
    item.system ??= {};
    item.system.nom = reference.nom;
    item.system.classe = target.classe;
    item.system.spellLists = [target.classe];
    item.system.niveau = target.niveau;
    item.system.ecole = reference.ecole;
    delete item.system["école"];
    writeText(item.system, "portee", reference.portee);
    writeText(item.system, "duree", reference.duree);
    writeText(item.system, "zone_effet", reference.zone_effet);
    writeText(item.system, "temps_incantation", reference.temps_incantation);
    item.system.composantes = reference.composantes;
    item.system.jet_sauvegarde = reference.jet_sauvegarde;
    item.system.description = reference.description;
    item.system.composants_materiels = hasMaterialComponent(reference.composantes)
      ? copy(componentItem.system?.composants_materiels ?? [])
      : [];
    item.system.onUse ||= reference?.foundry?.onUse ?? "";

    item.flags ??= {};
    item.flags.add2e ??= {};
    item.flags.add2e.routedClass = target.classe;
    item.flags.add2e.spellListsResolved = [target.classe];
    item.flags.add2e.requiredFoundryInstance = true;
    item.flags.add2e.requiredFoundryInstanceKey = `${slug(target.classe)}|${target.niveau}|${slug(reference.nom)}`;
    if (item.system.onUse) item.flags.add2e.originalOnUse = item.system.onUse;
    item.effects = (item.effects ?? []).map((effect, index) => {
      const next = copy(effect);
      if (created || !text(next?._id ?? next?.id)) next._id = id(`effect:${target.classe}|${target.niveau}|${reference.nom}|${index}`, usedEffectIds);
      next.name = reference.nom;
      next.origin = `Item.${item._id}`;
      next.flags ??= {};
      next.flags.add2e ??= {};
      next.flags.add2e.tags = setTags(next.flags.add2e.tags, target, reference);
      return next;
    });

    if (created) {
      const highestSort = Math.max(-1, ...items.filter(entry => entry?.folder === item.folder).map(entry => Number(entry?.sort) || 0));
      item.sort = highestSort + 1;
      items.push(item);
    } else items[existingIndex] = item;
    log.push(`${created ? "créé" : "mis à jour"} : ${target.classe} niveau ${target.niveau} — ${reference.nom} | spellLists=${JSON.stringify(item.system.spellLists)}`);
  }

  v4.items = items;
  return log;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const v3Path = path.join(ROOT, V3_FILE);
  const v4Path = path.join(ROOT, V4_FILE);
  const v3 = read(v3Path);
  const v4 = read(v4Path);
  if (!Array.isArray(v3?.items) || !Array.isArray(v4?.items)) throw new Error("V3 ou V4 ne contient pas items.");

  if (args.syncManualComponents) {
    const synced = syncManualComponents(v3, v4, args.dryRun);
    console.log(`[ADD2E][MANUAL_COMPONENT_SYNC] ${args.dryRun ? "simulation" : "synchronisation terminée"} : ${synced.policies} références chargées.`);
    for (const change of [...synced.v3Changes, ...synced.v4Changes]) {
      console.log(`[ADD2E][MANUAL_COMPONENT_SYNC] ${change.source} ${change.classe} niveau ${change.niveau} — ${change.nom} : ${change.updated.join(", ")}.`);
    }
    console.log(`[ADD2E][MANUAL_COMPONENT_SYNC] V3 : ${synced.v3Changes.length} correction(s) ; V4 : ${synced.v4Changes.length} correction(s).`);
  }

  if (args.applyRequiredInstances) {
    const log = applyRequiredInstances(v3, v4);
    if (!args.dryRun) write(v4Path, v4);
    console.log(`[ADD2E][REQUIRED_SPELL_INSTANCES] ${args.dryRun ? "simulation" : "V4 mis à jour"}`);
    for (const line of log) console.log(`[ADD2E][REQUIRED_SPELL_INSTANCES] ${line}`);
  }

  if (args.syncManualComponents && !args.dryRun) {
    console.log("[ADD2E][MANUAL_COMPONENT_SYNC] Exécute ensuite normalize-fvtt-spells-materials-v3.mjs pour régénérer le catalogue marchand depuis V3 nettoyé.");
  }
}

main();
