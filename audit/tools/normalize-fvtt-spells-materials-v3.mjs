import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const VERSION = "2026-06-20-reversible-reference-reader-v2";
const INPUT = "fvtt-spells-all-normalise-mecanique-v1.json";
const OUTPUT = "fvtt-spells-all-normalise-mecanique-v3.json";
const CONTROL = "fvtt-spells-all-normalise-mecanique-v3-controle.json";
const MASTER = "audit/reference/manuel-joueurs-sorts-master.json";
const REVERSIBILITY_REFERENCE = "audit/reference/manuel-joueurs-reversibilite.json";
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
const emptyCounts = () => Object.fromEntries(Object.keys(CLASSES).map(classSlug => [classSlug, 0]));

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
  return new Set([...values.map(slug), slug(system.classe)].filter(Boolean));
}

function itemKey(item) {
  const id = text(item?._id ?? item?.id);
  return id || `${slug(item?.system?.classe)}|${itemLevel(item)}|${slug(item?.name ?? item?.system?.nom)}`;
}

function lotScope(lot) {
  const match = String(lot ?? "").match(/^(clerc|druide|magicien|illusionniste)-niveau-(\d+)$/i);
  if (!match) return null;
  return { classSlug: match[1].toLowerCase(), level: Number(match[2]) };
}

function metaKey(classSlug, level, name) {
  return `${classSlug}|${level}|${slug(name)}`;
}

function normaliseChoices(value) {
  const source = Array.isArray(value)
    ? value
    : Array.isArray(value?.choices)
      ? value.choices
      : Array.isArray(value?.options)
        ? value.options
        : Array.isArray(value?.variants)
          ? value.variants
          : Array.isArray(value?.variantes)
            ? value.variantes
            : [];

  return source.map(choice => ({
    id: text(choice?.id) || slug(choice?.nom ?? choice?.name),
    nom: text(choice?.nom ?? choice?.name),
    reference: clone(choice)
  })).filter(choice => choice.id && choice.nom);
}

function inverseName(value) {
  if (typeof value === "string") return text(value);
  if (!value || typeof value !== "object") return "";

  const direct = value.inverse ?? value.inverseName ?? value.nomInverse ?? value.actorItemName;
  if (typeof direct === "string") return text(direct);
  if (direct && typeof direct === "object") {
    const nested = text(direct.nom ?? direct.name ?? direct.actorItemName);
    if (nested) return nested;
  }

  const modes = Array.isArray(value.modes) ? value.modes : [];
  const inverseMode = modes.find(mode => String(mode?.id ?? "").toLowerCase() === "inverse");
  return text(inverseMode?.nom ?? inverseMode?.name ?? inverseMode?.actorItemName);
}

function hasReversibleMarker(value) {
  if (value === true) return true;
  if (typeof value === "string" && text(value)) return true;
  return Boolean(value && typeof value === "object");
}

function upsertMeta(index, key, patch) {
  const previous = index.get(key) ?? { variants: [] };
  const seen = new Set();
  const variants = [...previous.variants, ...(patch.variants ?? [])].filter(choice => {
    const choiceKey = `${choice.id}|${choice.nom}`;
    if (seen.has(choiceKey)) return false;
    seen.add(choiceKey);
    return true;
  });

  index.set(key, {
    ...previous,
    ...patch,
    inverse: text(patch.inverse) || previous.inverse || "",
    inverseNameStatus: text(patch.inverseNameStatus) || previous.inverseNameStatus || "",
    reversible: Boolean(previous.reversible || patch.reversible),
    variants,
    sources: [...new Set([...(previous.sources ?? []), ...(patch.sources ?? [])])]
  });
}

function readStructuredData(document, index, relativePath) {
  const inverseRoots = [document?.reversible, document?.reversibles, document?.reversibleSpells].filter(Boolean);
  const variantRoots = [document?.variant, document?.variants, document?.variantes].filter(Boolean);

  for (const root of inverseRoots) {
    for (const [lot, entries] of Object.entries(root)) {
      const scope = lotScope(lot);
      if (!scope) continue;

      if (Array.isArray(entries)) {
        for (const entry of entries) {
          const name = text(entry?.nom ?? entry?.name ?? entry?.sort ?? entry?.spell);
          if (!name) continue;
          upsertMeta(index, metaKey(scope.classSlug, scope.level, name), {
            reversible: hasReversibleMarker(entry),
            inverse: inverseName(entry),
            inverseNameStatus: text(entry?.inverseNameStatus),
            sources: [relativePath]
          });
        }
        continue;
      }

      for (const [name, entry] of Object.entries(entries ?? {})) {
        upsertMeta(index, metaKey(scope.classSlug, scope.level, name), {
          reversible: hasReversibleMarker(entry),
          inverse: inverseName(entry),
          inverseNameStatus: text(entry?.inverseNameStatus),
          sources: [relativePath]
        });
      }
    }
  }

  for (const root of variantRoots) {
    for (const [lot, entries] of Object.entries(root)) {
      const scope = lotScope(lot);
      if (!scope) continue;
      for (const [name, entry] of Object.entries(entries ?? {})) {
        upsertMeta(index, metaKey(scope.classSlug, scope.level, name), {
          variants: normaliseChoices(entry),
          sources: [relativePath]
        });
      }
    }
  }
}

function loadReferences() {
  const detailed = new Map();
  const structured = new Map();
  const files = [];

  for (const relative of [MASTER, REVERSIBILITY_REFERENCE]) {
    const document = readJson(path.join(ROOT, relative), null);
    if (!document || typeof document !== "object") continue;
    files.push(relative);
    readStructuredData(document, structured, relative);
  }

  for (const [classSlug, levels] of Object.entries(CLASSES)) {
    for (const level of levels) {
      const relative = `audit/reference/manuel-joueurs-${classSlug}-niveau-${level}.json`;
      const document = readJson(path.join(ROOT, relative), null);
      if (!document) continue;
      files.push(relative);

      for (const reference of document.spells ?? []) {
        const name = text(reference?.nom ?? reference?.name);
        if (!name) continue;
        const referenceLevel = Number(reference?.niveau ?? reference?.level ?? level) || level;
        const key = metaKey(classSlug, referenceLevel, name);
        detailed.set(key, { ...clone(reference), __file: relative });
        upsertMeta(structured, key, {
          reversible: hasReversibleMarker(reference?.reversible) || Boolean(text(reference?.inverse)),
          inverse: inverseName(reference?.reversible) || text(reference?.inverse),
          inverseNameStatus: text(reference?.inverseNameStatus),
          variants: normaliseChoices(reference?.variant ?? reference?.variants ?? reference?.variantes),
          sources: [relative]
        });
      }
    }
  }

  const declaredByClass = emptyCounts();
  for (const [key, metadata] of structured) {
    if (!metadata.reversible) continue;
    const classSlug = key.split("|", 1)[0];
    if (Object.hasOwn(declaredByClass, classSlug)) declaredByClass[classSlug] += 1;
  }

  return { detailed, structured, files: [...new Set(files)], declaredByClass };
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
  return { components: components.length ? components : clone(fallback ?? []), reference: selected };
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

function applyReferenceFlags(items, references) {
  const actorSplitByClass = emptyCounts();
  const reversibleProfiles = [];
  const variantProfiles = [];
  const unresolvedReversible = [];

  for (const item of items) {
    if (String(item?.type ?? item?.system?.type ?? "") !== "sort") continue;
    const name = text(item?.name ?? item?.system?.nom);
    const level = itemLevel(item);
    const reversible = [];
    const variants = [];

    for (const classSlug of itemClasses(item)) {
      const key = metaKey(classSlug, level, name);
      const metadata = references.structured.get(key);
      if (!metadata) continue;
      const reference = references.detailed.get(key) ?? {};

      if (metadata.variants.length) {
        const profile = {
          class: classSlug,
          level,
          referenceFiles: metadata.sources,
          choices: clone(metadata.variants)
        };
        variants.push(profile);
        variantProfiles.push({ name, ...clone(profile) });
      }

      if (!metadata.reversible) continue;
      if (!metadata.inverse) {
        unresolvedReversible.push({
          class: classSlug,
          level,
          name,
          inverseNameStatus: metadata.inverseNameStatus,
          referenceFiles: metadata.sources
        });
        continue;
      }

      const profile = {
        class: classSlug,
        level,
        referenceFiles: metadata.sources,
        modes: [
          actorMode(reference, item, "normal", text(reference.nom) || name),
          actorMode(reference, item, "inverse", metadata.inverse)
        ]
      };
      reversible.push(profile);
      reversibleProfiles.push({ name, ...clone(profile) });
      actorSplitByClass[classSlug] += 1;
    }

    item.flags ??= {};
    item.flags.add2e ??= {};

    if (reversible.length) {
      item.flags.add2e.reversible = {
        version: VERSION,
        managedBy: "normalize-fvtt-spells-materials-v3",
        enabled: true,
        splitOnActorGrant: true,
        choiceTiming: "memorization",
        profiles: reversible
      };
    } else if (item.flags.add2e.reversible?.managedBy === "normalize-fvtt-spells-materials-v3") {
      delete item.flags.add2e.reversible;
    }

    if (variants.length) {
      item.flags.add2e.variant = {
        version: VERSION,
        managedBy: "normalize-fvtt-spells-materials-v3",
        profiles: variants
      };
      delete item.flags.add2e.variants;
    } else if (item.flags.add2e.variant?.managedBy === "normalize-fvtt-spells-materials-v3") {
      delete item.flags.add2e.variant;
    }
  }

  return { actorSplitByClass, reversibleProfiles, variantProfiles, unresolvedReversible };
}

function main() {
  const input = path.join(ROOT, process.argv[2] || INPUT);
  const output = path.join(ROOT, process.argv[3] || OUTPUT);
  const controlFile = path.join(ROOT, process.argv[4] || CONTROL);
  const source = readJson(input);
  if (!source) throw new Error(`Fichier introuvable ou invalide : ${input}`);

  const previous = readJson(output, source);
  const sourceItems = getItems(source);
  const previousItems = getItems(previous);
  const previousByKey = new Map(previousItems.map(item => [itemKey(item), item]));
  const sourceKeys = new Set(sourceItems.map(itemKey));
  const items = sourceItems.map(item => clone(previousByKey.get(itemKey(item)) ?? item));
  const ignoredAuditOnlyItems = previousItems
    .filter(item => !sourceKeys.has(itemKey(item)))
    .map(item => ({ name: item.name, classe: item.system?.classe, niveau: item.system?.niveau }));

  const references = loadReferences();
  const flags = applyReferenceFlags(items, references);
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
    referenceFiles: references.files,
    declaredByClass: references.declaredByClass,
    actorSplitByClass: flags.actorSplitByClass,
    byClass: references.declaredByClass,
    profiles: flags.reversibleProfiles,
    unresolvedStructuredReversible: flags.unresolvedReversible
  };
  control.variantProfiles = flags.variantProfiles;
  control.variantChoiceCount = flags.variantProfiles.reduce((total, profile) => total + profile.choices.length, 0);
  writeJson(controlFile, control);

  console.log(`[ADD2E][SPELL_MATERIALS_V3] ${control.outputSpellCount} sort(s) conservé(s) depuis la source.`);
  console.log(`[ADD2E][SPELL_MATERIALS_V3] Réversibles déclarés — clerc: ${references.declaredByClass.clerc}, druide: ${references.declaredByClass.druide}, magicien: ${references.declaredByClass.magicien}, illusionniste: ${references.declaredByClass.illusionniste}.`);
  console.log(`[ADD2E][SPELL_MATERIALS_V3] Profils Actor prêts — clerc: ${flags.actorSplitByClass.clerc}, druide: ${flags.actorSplitByClass.druide}, magicien: ${flags.actorSplitByClass.magicien}, illusionniste: ${flags.actorSplitByClass.illusionniste}; inverse sans nom manuel: ${flags.unresolvedReversible.length}.`);
  console.log(`[ADD2E][SPELL_MATERIALS_V3] Variantes structurées: ${flags.variantProfiles.length} sort(s) / ${control.variantChoiceCount} choix.`);
  console.log(`[ADD2E][SPELL_MATERIALS_V3] Items d’audit exclus: ${ignoredAuditOnlyItems.length}.`);
}

main();
