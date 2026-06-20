import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const VERSION = "2026-06-20-reversible-actor-structure-v5";
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

function itemLevel(item) {
  return Number(String(item?.system?.niveau ?? item?.system?.niveau_sort ?? item?.system?.level ?? "").match(/\d+/)?.[0] ?? 0) || 0;
}

function itemClasses(item) {
  const system = item?.system ?? {};
  const source = Array.isArray(system.spellLists)
    ? system.spellLists
    : String(system.spellLists ?? system.classe ?? "").split(/[,;|/]+/g);
  return new Set([...source.map(slug), slug(system.classe)].filter(Boolean));
}

function itemKey(item) {
  const id = text(item?._id ?? item?.id);
  return id || `${slug(item?.system?.classe)}|${itemLevel(item)}|${slug(item?.name ?? item?.system?.nom)}`;
}

function loadReferences() {
  const index = new Map();
  const files = [];

  for (const [classSlug, levels] of Object.entries(CLASSES)) {
    for (const level of levels) {
      const file = path.join(ROOT, `audit/reference/manuel-joueurs-${classSlug}-niveau-${level}.json`);
      if (!fs.existsSync(file)) continue;
      const document = readJson(file, {});
      files.push(path.relative(ROOT, file));

      for (const reference of document.spells ?? []) {
        const name = text(reference?.nom ?? reference?.name);
        if (!name) continue;
        const referenceLevel = Number(reference?.niveau ?? reference?.level ?? level) || level;
        index.set(`${classSlug}|${referenceLevel}|${slug(name)}`, {
          ...clone(reference),
          __class: classSlug,
          __level: referenceLevel,
          __file: path.relative(ROOT, file)
        });
      }
    }
  }

  return { index, files };
}

function inverseName(reference) {
  const direct = reference?.reversible ?? reference?.inverse;
  if (typeof direct === "string") return text(direct);
  if (direct && typeof direct === "object") {
    return text(direct.inverse ?? direct.nom ?? direct.name ?? direct.actorItemName);
  }
  return "";
}

function variants(reference) {
  const raw = Array.isArray(reference?.variantes)
    ? reference.variantes
    : Array.isArray(reference?.variants)
      ? reference.variants
      : [];

  return raw.map(variant => ({
    id: text(variant?.id) || slug(variant?.nom ?? variant?.name),
    nom: text(variant?.nom ?? variant?.name),
    reference: clone(variant)
  })).filter(variant => variant.id && variant.nom);
}

function materialMode(rule) {
  const source = text(`${rule?.condition ?? ""} ${rule?.notes ?? ""}`).toLowerCase();
  if (!source) return "shared";
  if (/(inverse|inversé|inversee|malédiction|maudite|destruction|déshydratation|corruption|épouvante|ténèbres|blessures|bien)/i.test(source)) return "inverse";
  if (/(normal|création|bénédiction|purification|apaisement|lumière|mal)/i.test(source)) return "normal";
  return "shared";
}

function modeMaterials(reference, mode, fallback) {
  const all = Array.isArray(reference?.composants_materiels_objets)
    ? clone(reference.composants_materiels_objets)
    : [];
  const selected = all.filter(rule => {
    const target = materialMode(rule);
    return target === "shared" || target === mode;
  });
  const components = selected.map(rule => text(rule?.nom ?? rule?.name)).filter(Boolean);

  return {
    components: components.length ? components : clone(fallback ?? []),
    reference: selected
  };
}

function actorMode(reference, item, id, name) {
  const materials = modeMaterials(reference, id, item?.system?.composants_materiels ?? []);
  return {
    id,
    actorItemName: name,
    manualName: name,
    copySourceItem: true,
    systemOverrides: { composants_materiels: materials.components },
    materialReference: materials.reference
  };
}

function applyStructuredFlags(items, references) {
  const byClass = Object.fromEntries(Object.keys(CLASSES).map(classSlug => [classSlug, 0]));
  const reversibleProfiles = [];
  const variantProfiles = [];
  const unresolvedReversible = [];

  for (const item of items) {
    if (String(item?.type ?? item?.system?.type ?? "") !== "sort") continue;
    const level = itemLevel(item);
    const name = text(item?.name ?? item?.system?.nom);
    const reversible = [];
    const variantsByProfile = [];

    for (const classSlug of itemClasses(item)) {
      const reference = references.index.get(`${classSlug}|${level}|${slug(name)}`);
      if (!reference) continue;

      const sourceVariants = variants(reference);
      if (sourceVariants.length) {
        variantsByProfile.push({
          class: classSlug,
          level,
          referenceFile: reference.__file,
          variants: sourceVariants
        });
        variantProfiles.push({ name, class: classSlug, level, variants: clone(sourceVariants) });
      }

      const inverse = inverseName(reference);
      if (!inverse) {
        if (reference?.reversible === true) {
          unresolvedReversible.push({ class: classSlug, level, name, referenceFile: reference.__file });
        }
        continue;
      }

      const profile = {
        class: classSlug,
        level,
        referenceFile: reference.__file,
        modes: [
          actorMode(reference, item, "normal", text(reference.nom) || name),
          actorMode(reference, item, "inverse", inverse)
        ],
        variants: sourceVariants
      };
      reversible.push(profile);
      reversibleProfiles.push({ name, ...clone(profile) });
      byClass[classSlug] += 1;
    }

    item.flags ??= {};
    item.flags.add2e ??= {};

    if (reversible.length) {
      item.flags.add2e.reversible = {
        version: VERSION,
        managedBy: "normalize-fvtt-spells-materials-v3",
        enabled: true,
        splitOnActorGrant: true,
        actorGrantEvents: ["drop", "auto-grant-clerc", "auto-grant-druide"],
        choiceTiming: "memorization",
        profiles: reversible
      };
    } else if (item.flags.add2e.reversible?.managedBy === "normalize-fvtt-spells-materials-v3") {
      delete item.flags.add2e.reversible;
    }

    if (variantsByProfile.length) {
      item.flags.add2e.variants = {
        version: VERSION,
        managedBy: "normalize-fvtt-spells-materials-v3",
        profiles: variantsByProfile
      };
    } else if (item.flags.add2e.variants?.managedBy === "normalize-fvtt-spells-materials-v3") {
      delete item.flags.add2e.variants;
    }
  }

  return { byClass, reversibleProfiles, variantProfiles, unresolvedReversible };
}

function main() {
  const input = path.join(ROOT, process.argv[2] || "fvtt-spells-all-normalise-mecanique-v1.json");
  const output = path.join(ROOT, process.argv[3] || "fvtt-spells-all-normalise-mecanique-v3.json");
  const controlFile = path.join(ROOT, process.argv[4] || "fvtt-spells-all-normalise-mecanique-v3-controle.json");
  const source = readJson(input);
  if (!source) throw new Error(`Fichier introuvable ou invalide : ${input}`);

  const previous = readJson(output, source);
  const sourceItems = getItems(source);
  const previousItems = getItems(previous);
  const previousByKey = new Map(previousItems.map(item => [itemKey(item), item]));
  const sourceKeys = new Set(sourceItems.map(itemKey));
  const items = sourceItems.map(item => clone(previousByKey.get(itemKey(item)) ?? item));
  const ignoredAuditOnlyItems = previousItems.filter(item => !sourceKeys.has(itemKey(item))).map(item => ({ name: item.name, classe: item.system?.classe, niveau: item.system?.niveau }));

  const refs = loadReferences();
  const flags = applyStructuredFlags(items, refs);
  const result = setItems(clone(previous), items);
  result.normalizedBy = VERSION;
  result.normalizedAt = new Date().toISOString();
  writeJson(output, result);

  const control = readJson(controlFile, {}) ?? {};
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
    referenceFiles: refs.files,
    byClass: flags.byClass,
    profiles: flags.reversibleProfiles,
    unresolvedStructuredReversible: flags.unresolvedReversible
  };
  control.variantProfiles = flags.variantProfiles;
  writeJson(controlFile, control);

  console.log(`[ADD2E][SPELL_MATERIALS_V3] ${control.outputSpellCount} sort(s) conservé(s) depuis la source.`);
  console.log(`[ADD2E][SPELL_MATERIALS_V3] Réversibles structurés — clerc: ${flags.byClass.clerc}, druide: ${flags.byClass.druide}, magicien: ${flags.byClass.magicien}, illusionniste: ${flags.byClass.illusionniste}.`);
  console.log(`[ADD2E][SPELL_MATERIALS_V3] Variantes structurées: ${flags.variantProfiles.length}.`);
  console.log(`[ADD2E][SPELL_MATERIALS_V3] Réversibles sans inverse nommé: ${flags.unresolvedReversible.length}.`);
  console.log(`[ADD2E][SPELL_MATERIALS_V3] Items d’audit exclus: ${ignoredAuditOnlyItems.length}.`);
}

main();
