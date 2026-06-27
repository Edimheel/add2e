import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const V3_FILE = "fvtt-spells-all-normalise-mecanique-v3.json";
const V4_FILE = "fvtt-spells-all-normalise-mecanique-v4.json";

// V3 n'est jamais écrit. Il fournit uniquement system.composants_materiels.
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

function main() {
  const dryRun = process.argv.includes("--dry-run");
  const v3 = read(path.join(ROOT, V3_FILE));
  const v4Path = path.join(ROOT, V4_FILE);
  const v4 = read(v4Path);
  if (!Array.isArray(v3?.items) || !Array.isArray(v4?.items)) throw new Error("V3 ou V4 ne contient pas items.");

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
    item.system.composants_materiels = copy(componentItem.system?.composants_materiels ?? []);
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
  if (!dryRun) write(v4Path, v4);
  console.log(`[ADD2E][REQUIRED_SPELL_INSTANCES] ${dryRun ? "simulation" : "V4 mis à jour"}`);
  for (const line of log) console.log(`[ADD2E][REQUIRED_SPELL_INSTANCES] ${line}`);
  console.log("[ADD2E][REQUIRED_SPELL_INSTANCES] composants lus depuis V3 ; V3 non modifié.");
}

main();
