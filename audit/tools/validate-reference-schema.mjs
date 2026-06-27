import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");
const referenceDir = path.join(repoRoot, "audit/reference");
const DEFAULT_AUDIT_REPORT = "audit/rapports/AUDIT-REFERENCES-SORTS-GLOBAL.json";
const SPELL_REFERENCE_FILE_PATTERN = /^manuel-joueurs-(clerc|druide|magicien|illusionniste)-niveau-[1-9]\.json$/;

const forbiddenDescriptionFields = [
  "description_exacte_manuel",
  "description_source",
  "description_reelle",
  "description_texte",
  "description_html",
  "description_resumee_regles"
];

const requiredSpellFields = [
  "ordre",
  "nom",
  "ecole",
  "niveau",
  "portee",
  "duree",
  "zone_effet",
  "composantes",
  "temps_incantation",
  "jet_sauvegarde",
  "description",
  "status"
];

const requiredIdentityFields = ["ordre", "nom", "niveau", "variantes", "reversible", "status"];
const technicalFields = ["ecole", "portee", "duree", "zone_effet", "composantes", "temps_incantation", "jet_sauvegarde"];
const placeholders = new Set(["", "a_completer", "a_remplir", "a_renseigner", "todo", "tbd", "inconnu", "non_renseigne", "non_disponible"]);

// Rapprochements nécessaires lorsque l'item Foundry ne possède pas le titre canonique.
// Cette table ne renomme jamais Foundry et ne modifie jamais les références du Manuel.
const identityAliases = new Map([
  [
    "magicien|5|teleikinesie",
    {
      sourceKey: "magicien|5|telekinesie",
      note: "Variation orthographique dans le titre Foundry."
    }
  ]
]);

// Des doublons Foundry historiques coexistent avec l'item portant le titre canonique.
// Ils restent signalés, mais ne constituent ni un sort manquant ni une identité bloquante.
const legacyFoundryDuplicates = new Map([
  [
    "clerc|1|purification_de_la_nourriture_et_de_la_boisson",
    {
      referenceKey: "clerc|1|purification_de_leau_et_des_aliments",
      note: "Ancien titre Foundry de « Purification de l'eau et des aliments »."
    }
  ],
  [
    "clerc|1|soins_des_blessures_legeres",
    {
      referenceKey: "clerc|1|soins_mineurs",
      note: "Ancien titre Foundry de « Soins mineurs »."
    }
  ],
  [
    "clerc|3|localisation_dun_objet",
    {
      referenceKey: "clerc|3|localisation_dobjets",
      note: "Ancien singulier Foundry de « Localisation d'objets »."
    }
  ],
  [
    "clerc|4|batons_en_serpents",
    {
      referenceKey: "clerc|4|batons_a_serpents",
      note: "Variation de préposition dans le titre Foundry."
    }
  ],
  [
    "clerc|4|protection_contre_le_mal_rayon_de_10_pieds",
    {
      referenceKey: "clerc|4|protection_contre_le_mal_sur_3_m",
      note: "Même sort, titre Foundry exprimé en mesure impériale."
    }
  ],
  [
    "clerc|5|soins_ultime",
    {
      referenceKey: "clerc|5|soin_ultime",
      note: "Variation singulier/pluriel dans le titre Foundry."
    }
  ],
  [
    "druide|4|dissipation_de_magie",
    {
      referenceKey: "druide|4|dissipation_de_la_magie",
      note: "Variation d'article dans le titre Foundry."
    }
  ],
  [
    "magicien|1|missile_magique",
    {
      referenceKey: "magicien|1|projectile_magique",
      note: "Ancien intitulé Foundry de « Projectile magique »."
    }
  ],
  [
    "magicien|5|chien_fidele_de_mordekainen",
    {
      referenceKey: "magicien|5|chien_fidele_de_mordenkainen",
      note: "Orthographe historique Foundry de Mordenkainen."
    }
  ]
]);

// Ces entrées Foundry n'appartiennent pas à la liste de sorts du Manuel ciblée.
// Elles restent visibles dans le rapport, mais ne bloquent pas le rapprochement.
const foundryOutOfManualScope = new Map([
  [
    "clerc|7|asile",
    "Entrée Foundry additionnelle hors liste des sorts de Clerc niveau 7 du Manuel des joueurs."
  ]
]);

function parseArgs(argv) {
  const options = { auditAll: false, report: null, strict: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = argv[index + 1];
    if (arg === "--audit-all") options.auditAll = true;
    else if (arg === "--strict") options.strict = true;
    else if (arg === "--report" && value) {
      options.report = value;
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      console.log("Usage:");
      console.log("  node audit/tools/validate-reference-schema.mjs");
      console.log(`  node audit/tools/validate-reference-schema.mjs --audit-all [--report ${DEFAULT_AUDIT_REPORT}] [--strict]`);
      process.exit(0);
    } else {
      throw new Error(`Argument inconnu ou incomplet : ${arg}`);
    }
  }
  return options;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function filesInReferenceDirectory() {
  return fs.readdirSync(referenceDir)
    .filter((file) => SPELL_REFERENCE_FILE_PATTERN.test(file))
    .sort((left, right) => left.localeCompare(right, "fr"));
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

function isPlaceholder(value) {
  return placeholders.has(slug(value));
}

function isSpell(item) {
  return String(item?.type ?? item?.system?.type ?? "").toLocaleLowerCase("fr") === "sort";
}

function collection(document) {
  if (Array.isArray(document)) return document;
  for (const key of ["items", "Item", "Items", "documents", "data", "entries"]) {
    if (Array.isArray(document?.[key])) return document[key];
  }
  return null;
}

function scalar(value) {
  if (value == null) return "";
  if (typeof value === "object") return text(value.valeur ?? value.value ?? value.texte ?? "");
  return text(value);
}

function levelValue(value) {
  const level = Number(String(value ?? "").match(/\d+/)?.[0] ?? 0);
  return Number.isFinite(level) && level > 0 ? level : 0;
}

function spellKey(className, level, name) {
  const classKey = slug(className);
  const normalizedLevel = levelValue(level);
  const nameKey = slug(name);
  return classKey && normalizedLevel && nameKey ? `${classKey}|${normalizedLevel}|${nameKey}` : null;
}

function technicalValue(system, field) {
  if (field === "ecole") return scalar(system?.ecole ?? system?.["école"]);
  if (field === "portee") return scalar(system?.portee ?? system?.["portée"]);
  if (field === "duree") return scalar(system?.duree ?? system?.["durée"]);
  return scalar(system?.[field]);
}

function descriptionValue(system) {
  return text(String(system?.description_reelle ?? system?.description ?? "")
    .replace(/<\s*br\s*\/?>/gi, " ")
    .replace(/<\s*\/\s*p\s*>/gi, " ")
    .replace(/<[^>]*>/g, " "));
}

function normalizedComparable(value, { punctuation = false } = {}) {
  let result = String(value ?? "")
    .replace(/<\s*br\s*\/?>/gi, " ")
    .replace(/<\s*\/\s*p\s*>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .normalize("NFKC")
    .replace(/[\u00a0\u2007\u202f]/g, " ")
    .replace(/[\u2018\u2019\u02bc]/g, "'")
    .replace(/[\u201c\u201d]/g, "\"")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("fr");
  if (punctuation) result = result.replace(/[.,;:!?()[\]{}"«»…/]/g, " ").replace(/\s+/g, " ").trim();
  return result;
}

function validateSpell(file, index, spell, errors, warnings) {
  const label = `${file} > spells[${index}] ${spell?.nom ?? "sans_nom"}`;
  for (const field of forbiddenDescriptionFields) {
    if (Object.prototype.hasOwnProperty.call(spell, field)) errors.push(`${label}: champ interdit ${field}`);
  }
  for (const field of requiredSpellFields) {
    if (!Object.prototype.hasOwnProperty.call(spell, field)) errors.push(`${label}: champ requis manquant ${field}`);
  }
  if (typeof spell?.description !== "string") errors.push(`${label}: description doit etre une chaine`);
  else if (!spell.description.trim()) warnings.push(`${label}: description vide ou a importer`);
  if (typeof spell?.description === "string" && /\n/.test(spell.description)) {
    errors.push(`${label}: description non normalisee, retours ligne interdits`);
  }
}

function deriveDecoupagePath(referenceFile, reference) {
  if (text(reference?.foundryExport)) return text(reference.foundryExport);
  const match = referenceFile.match(/^manuel-joueurs-(.+)-niveau-(\d+)\.json$/);
  return match ? `audit/decoupage_fichier/${match[1]}-niveau-${match[2]}.json` : null;
}

function sourceIndex(document) {
  const items = collection(document);
  if (!items) throw new Error("Découpage sans collection d'items.");
  const index = new Map();
  const duplicates = [];
  for (const item of items) {
    if (!isSpell(item)) continue;
    const system = item.system ?? {};
    const key = spellKey(system.classe, system.niveau, item.name ?? system.nom);
    if (!key) continue;
    if (index.has(key)) {
      duplicates.push(key);
      continue;
    }
    index.set(key, {
      key,
      nom: text(item.name ?? system.nom),
      classe: text(system.classe),
      niveau: levelValue(system.niveau),
      technical: Object.fromEntries(technicalFields.map((field) => [field, technicalValue(system, field)])),
      description: descriptionValue(system)
    });
  }
  return { index, duplicates };
}

function reportField(referenceValue, sourceValue) {
  if (!Object.prototype.hasOwnProperty.call(referenceValue.owner, referenceValue.field)) return "missing_reference_field";
  if (isPlaceholder(referenceValue.value)) return "reference_placeholder";
  if (isPlaceholder(sourceValue)) return "missing_decoupage_value";
  return normalizedComparable(referenceValue.value) === normalizedComparable(sourceValue) ? "equal" : "different";
}

function reportDescription(referenceValue, sourceValue) {
  if (typeof referenceValue !== "string" || !referenceValue.trim()) return "missing_reference_description";
  if (!sourceValue) return "missing_decoupage_description";
  if (referenceValue === sourceValue) return "equal_raw";
  if (normalizedComparable(referenceValue) === normalizedComparable(sourceValue)) return "equal_formatting_only";
  if (normalizedComparable(referenceValue, { punctuation: true }) === normalizedComparable(sourceValue, { punctuation: true })) {
    return "equal_punctuation_only";
  }
  return "different";
}

function identityDetails(identity, extra = {}) {
  if (!identity) return null;
  return {
    key: identity.key ?? null,
    nom: text(identity.nom) || null,
    classe: text(identity.classe) || null,
    niveau: levelValue(identity.niveau) || null,
    ...extra
  };
}

function resolveSourceIdentity(referenceKey, sourceKeys) {
  if (sourceKeys.has(referenceKey)) return { sourceKey: referenceKey, match: "direct", note: null };
  const alias = identityAliases.get(referenceKey);
  if (alias && sourceKeys.has(alias.sourceKey)) {
    return { sourceKey: alias.sourceKey, match: "alias", note: alias.note };
  }
  return { sourceKey: null, match: "missing", note: null };
}

function auditReferenceFile(file) {
  const absoluteReference = path.join(referenceDir, file);
  const output = {
    file,
    referencePath: path.relative(repoRoot, absoluteReference),
    source: null,
    foundryExport: null,
    status: "blocked",
    errors: [],
    warnings: [],
    summary: {
      referenceSpells: 0,
      decoupageSpells: 0,
      decoupageSpellsInManualScope: 0,
      expectedCount: null,
      missingReferenceFields: 0,
      placeholderFields: 0,
      technicalDifferences: 0,
      missingDescriptions: 0,
      descriptionDifferences: 0,
      identityDifferences: 0,
      aliasMatches: 0,
      requiredFoundryInstances: 0,
      referenceOnly: 0,
      unresolvedDecoupageOnly: 0,
      legacyFoundryDuplicates: 0,
      outOfScopeFoundryOnly: 0,
      referenceDuplicates: 0,
      decoupageDuplicates: 0
    },
    identity: {
      aliases: [],
      requiredFoundryInstances: [],
      referenceOnly: [],
      unresolvedDecoupageOnly: [],
      legacyFoundryDuplicates: [],
      outOfScopeFoundryOnly: [],
      referenceDuplicates: [],
      decoupageDuplicates: []
    },
    spells: [],
    manualVerification: {
      status: "not_verified_by_this_tool",
      note: "Cet audit compare structure et découpage Foundry. Il ne peut pas démontrer la conformité au Manuel des joueurs."
    }
  };

  let reference;
  try {
    reference = readJson(absoluteReference);
  } catch (error) {
    output.errors.push(`JSON de référence illisible : ${String(error?.message ?? error)}`);
    return output;
  }

  const sourceClass = text(reference?.source?.classe);
  const sourceLevel = levelValue(reference?.source?.niveau);
  output.source = {
    classe: sourceClass || null,
    niveau: sourceLevel || null,
    document: text(reference?.source?.document) || null
  };
  output.foundryExport = deriveDecoupagePath(file, reference);
  output.summary.expectedCount = Number(reference?.expectedCount ?? 0) || null;

  if (!Array.isArray(reference?.spells)) {
    output.errors.push("spells doit etre un tableau.");
    return output;
  }

  output.summary.referenceSpells = reference.spells.length;
  if (!sourceClass || !sourceLevel) output.errors.push("source.classe ou source.niveau manquant.");
  if (output.summary.expectedCount && output.summary.expectedCount !== output.summary.referenceSpells) {
    output.errors.push(`Nombre de référence ${output.summary.referenceSpells}, expectedCount ${output.summary.expectedCount}.`);
  }

  const referenceKeys = new Set();
  const referenceIndex = new Map();
  for (const [index, spell] of reference.spells.entries()) {
    const level = levelValue(spell?.niveau ?? sourceLevel);
    const key = spellKey(sourceClass, level, spell?.nom);
    if (!key) {
      output.errors.push(`spells[${index}] identité inexploitable.`);
      continue;
    }
    const identity = { key, nom: text(spell?.nom), classe: sourceClass, niveau: level };
    if (referenceKeys.has(key)) {
      output.identity.referenceDuplicates.push(identityDetails(identity));
    } else {
      referenceIndex.set(key, identity);
    }
    referenceKeys.add(key);
  }
  output.summary.referenceDuplicates = output.identity.referenceDuplicates.length;
  if (output.summary.referenceDuplicates) {
    output.errors.push(`Doublons de référence : ${output.identity.referenceDuplicates.map((entry) => entry.key).join(", ")}`);
  }

  let decoupage;
  if (!output.foundryExport) {
    output.errors.push("foundryExport manquant et impossible à déduire.");
  } else {
    try {
      decoupage = sourceIndex(readJson(path.resolve(repoRoot, output.foundryExport)));
      output.identity.decoupageDuplicates = decoupage.duplicates
        .map((key) => identityDetails(decoupage.index.get(key) ?? { key }))
        .filter(Boolean);
      output.summary.decoupageDuplicates = output.identity.decoupageDuplicates.length;
      if (output.summary.decoupageDuplicates) {
        output.errors.push(`Doublons dans découpage : ${[...new Set(decoupage.duplicates)].join(", ")}`);
      }
    } catch (error) {
      output.errors.push(`Découpage introuvable ou invalide (${output.foundryExport}) : ${String(error?.message ?? error)}`);
    }
  }

  const groupPrefix = sourceClass && sourceLevel ? `${slug(sourceClass)}|${sourceLevel}|` : "";
  const decoupageKeys = decoupage ? [...decoupage.index.keys()].filter((key) => key.startsWith(groupPrefix)) : [];
  const decoupageKeySet = new Set(decoupageKeys);
  output.summary.decoupageSpells = decoupageKeys.length;

  const matchedSourceKeys = new Set();
  const resolvedByReferenceKey = new Map();
  for (const referenceKey of referenceKeys) {
    const resolved = resolveSourceIdentity(referenceKey, decoupageKeySet);
    resolvedByReferenceKey.set(referenceKey, resolved);
    if (!resolved.sourceKey) {
      const identity = identityDetails(referenceIndex.get(referenceKey) ?? { key: referenceKey }, {
        disposition: "foundry_instance_required"
      });
      output.identity.referenceOnly.push(identity);
      output.identity.requiredFoundryInstances.push(identity);
      continue;
    }
    matchedSourceKeys.add(resolved.sourceKey);
    if (resolved.match === "alias") {
      output.identity.aliases.push({
        reference: identityDetails(referenceIndex.get(referenceKey) ?? { key: referenceKey }),
        decoupage: identityDetails(decoupage?.index.get(resolved.sourceKey) ?? { key: resolved.sourceKey }),
        note: resolved.note
      });
    }
  }

  for (const sourceKey of decoupageKeys) {
    if (matchedSourceKeys.has(sourceKey)) continue;
    const sourceIdentity = decoupage?.index.get(sourceKey) ?? { key: sourceKey };
    const legacy = legacyFoundryDuplicates.get(sourceKey);
    if (legacy && referenceKeys.has(legacy.referenceKey)) {
      output.identity.legacyFoundryDuplicates.push({
        canonicalReference: identityDetails(referenceIndex.get(legacy.referenceKey) ?? { key: legacy.referenceKey }),
        decoupage: identityDetails(sourceIdentity),
        note: legacy.note
      });
      continue;
    }
    const outOfScopeReason = foundryOutOfManualScope.get(sourceKey);
    if (outOfScopeReason) {
      output.identity.outOfScopeFoundryOnly.push(identityDetails(sourceIdentity, { reason: outOfScopeReason }));
      continue;
    }
    output.identity.unresolvedDecoupageOnly.push(identityDetails(sourceIdentity));
  }

  output.summary.aliasMatches = output.identity.aliases.length;
  output.summary.requiredFoundryInstances = output.identity.requiredFoundryInstances.length;
  output.summary.referenceOnly = output.identity.referenceOnly.length;
  output.summary.unresolvedDecoupageOnly = output.identity.unresolvedDecoupageOnly.length;
  output.summary.legacyFoundryDuplicates = output.identity.legacyFoundryDuplicates.length;
  output.summary.outOfScopeFoundryOnly = output.identity.outOfScopeFoundryOnly.length;
  output.summary.decoupageSpellsInManualScope = output.summary.decoupageSpells
    - output.summary.legacyFoundryDuplicates
    - output.summary.outOfScopeFoundryOnly;
  output.summary.identityDifferences = output.summary.requiredFoundryInstances + output.summary.unresolvedDecoupageOnly;

  if (output.summary.identityDifferences) {
    output.errors.push(
      `Identités non résolues : instances Foundry requises ${output.summary.requiredFoundryInstances}, découpage sans référence ${output.summary.unresolvedDecoupageOnly}.`
    );
  }
  if (!output.summary.identityDifferences && output.summary.decoupageSpellsInManualScope !== output.summary.referenceSpells) {
    output.errors.push(
      `Nombre incohérent après rapprochements : référence ${output.summary.referenceSpells}, découpage dans le périmètre du Manuel ${output.summary.decoupageSpellsInManualScope}.`
    );
  }

  for (const [index, spell] of reference.spells.entries()) {
    const key = spellKey(sourceClass, spell?.niveau ?? sourceLevel, spell?.nom);
    const resolved = key ? resolvedByReferenceKey.get(key) : null;
    const source = resolved?.sourceKey && decoupage ? decoupage.index.get(resolved.sourceKey) : null;
    const spellReport = {
      ordre: spell?.ordre ?? null,
      nom: text(spell?.nom) || null,
      key,
      sourceKey: resolved?.sourceKey ?? null,
      identityMatch: resolved?.match ?? "missing",
      identityNote: resolved?.note ?? null,
      schema: { errors: [], warnings: [] },
      integrity: { missing: [] },
      technical: {},
      description: null,
      sourceFound: Boolean(source)
    };

    for (const field of forbiddenDescriptionFields) {
      if (Object.prototype.hasOwnProperty.call(spell ?? {}, field)) spellReport.schema.errors.push(`champ interdit ${field}`);
    }
    for (const field of requiredSpellFields) {
      if (!Object.prototype.hasOwnProperty.call(spell ?? {}, field)) spellReport.schema.errors.push(`champ requis manquant ${field}`);
    }
    for (const field of requiredIdentityFields) {
      if (!Object.prototype.hasOwnProperty.call(spell ?? {}, field)) spellReport.integrity.missing.push(field);
    }
    if (typeof spell?.description !== "string") spellReport.schema.errors.push("description doit etre une chaine");
    else if (!spell.description.trim()) spellReport.schema.warnings.push("description vide ou a importer");
    if (typeof spell?.description === "string" && /\n/.test(spell.description)) {
      spellReport.schema.errors.push("description non normalisee, retours ligne interdits");
    }

    for (const field of technicalFields) {
      const present = Object.prototype.hasOwnProperty.call(spell ?? {}, field);
      const value = present ? spell[field] : undefined;
      const comparison = source ? reportField({ owner: spell, field, value }, source.technical[field]) : "source_not_found";
      spellReport.technical[field] = {
        value: present ? value : null,
        source: source?.technical[field] ?? null,
        comparison
      };
      if (!present) output.summary.missingReferenceFields += 1;
      else if (isPlaceholder(value)) output.summary.placeholderFields += 1;
      if (comparison === "different") output.summary.technicalDifferences += 1;
    }

    const descriptionComparison = source ? reportDescription(spell?.description, source.description) : "source_not_found";
    spellReport.description = {
      present: typeof spell?.description === "string" && Boolean(spell.description.trim()),
      comparison: descriptionComparison
    };
    if (!spellReport.description.present) output.summary.missingDescriptions += 1;
    if (descriptionComparison === "different") output.summary.descriptionDifferences += 1;

    output.errors.push(...spellReport.schema.errors.map((message) => `${spellReport.nom ?? `spells[${index}]`}: ${message}`));
    output.warnings.push(...spellReport.schema.warnings.map((message) => `${spellReport.nom ?? `spells[${index}]`}: ${message}`));
    if (spellReport.integrity.missing.length) {
      output.errors.push(`${spellReport.nom ?? `spells[${index}]`}: champs d'intégrité manquants ${spellReport.integrity.missing.join(", ")}`);
    }
    output.spells.push(spellReport);
  }

  const hasCompletenessProblems = output.summary.missingReferenceFields
    || output.summary.placeholderFields
    || output.summary.missingDescriptions
    || output.summary.technicalDifferences
    || output.summary.descriptionDifferences;
  output.status = output.errors.length
    ? "blocked_structural"
    : hasCompletenessProblems
      ? "manual_review_required"
      : "ready_for_manual_confirmation";
  return output;
}

function schemaOnly() {
  if (!fs.existsSync(referenceDir)) throw new Error(`Reference dir missing: ${referenceDir}`);
  const errors = [];
  const warnings = [];
  for (const file of filesInReferenceDirectory()) {
    const data = readJson(path.join(referenceDir, file));
    if (!Array.isArray(data.spells)) {
      errors.push(`${file}: spells doit etre un tableau`);
      continue;
    }
    data.spells.forEach((spell, index) => validateSpell(file, index, spell, errors, warnings));
  }
  for (const warning of warnings) console.warn(`[WARN] ${warning}`);
  if (errors.length) {
    for (const error of errors) console.error(`[ERROR] ${error}`);
    process.exit(1);
  }
  console.log(`References de sorts validees: ${filesInReferenceDirectory().length}`);
  console.log(`Avertissements: ${warnings.length}`);
}

function auditAll(options) {
  if (!fs.existsSync(referenceDir)) throw new Error(`Reference dir missing: ${referenceDir}`);
  const reports = filesInReferenceDirectory().map(auditReferenceFile);
  const structuralIdentity = {
    aliases: reports.flatMap((report) => report.identity.aliases.map((entry) => ({ file: report.file, ...entry }))),
    requiredFoundryInstances: reports.flatMap((report) => report.identity.requiredFoundryInstances.map((entry) => ({ file: report.file, ...entry }))),
    legacyFoundryDuplicates: reports.flatMap((report) => report.identity.legacyFoundryDuplicates.map((entry) => ({ file: report.file, ...entry }))),
    foundryOutOfManualScope: reports.flatMap((report) => report.identity.outOfScopeFoundryOnly.map((entry) => ({ file: report.file, ...entry }))),
    unresolvedDecoupageOnly: reports.flatMap((report) => report.identity.unresolvedDecoupageOnly.map((entry) => ({ file: report.file, ...entry })))
  };
  const summary = {
    references: reports.length,
    referencesReadyForManualConfirmation: reports.filter((report) => report.status === "ready_for_manual_confirmation").length,
    referencesManualReviewRequired: reports.filter((report) => report.status === "manual_review_required").length,
    referencesBlockedStructural: reports.filter((report) => report.status === "blocked_structural" || report.status === "blocked").length,
    spells: reports.reduce((sum, report) => sum + report.summary.referenceSpells, 0),
    missingReferenceFields: reports.reduce((sum, report) => sum + report.summary.missingReferenceFields, 0),
    placeholderFields: reports.reduce((sum, report) => sum + report.summary.placeholderFields, 0),
    technicalDifferences: reports.reduce((sum, report) => sum + report.summary.technicalDifferences, 0),
    missingDescriptions: reports.reduce((sum, report) => sum + report.summary.missingDescriptions, 0),
    descriptionDifferences: reports.reduce((sum, report) => sum + report.summary.descriptionDifferences, 0),
    identityDifferences: reports.reduce((sum, report) => sum + report.summary.identityDifferences, 0),
    aliasMatches: reports.reduce((sum, report) => sum + report.summary.aliasMatches, 0),
    requiredFoundryInstances: reports.reduce((sum, report) => sum + report.summary.requiredFoundryInstances, 0),
    legacyFoundryDuplicates: reports.reduce((sum, report) => sum + report.summary.legacyFoundryDuplicates, 0),
    referenceOnly: reports.reduce((sum, report) => sum + report.summary.referenceOnly, 0),
    unresolvedDecoupageOnly: reports.reduce((sum, report) => sum + report.summary.unresolvedDecoupageOnly, 0),
    outOfScopeFoundryOnly: reports.reduce((sum, report) => sum + report.summary.outOfScopeFoundryOnly, 0),
    referenceDuplicates: reports.reduce((sum, report) => sum + report.summary.referenceDuplicates, 0),
    decoupageDuplicates: reports.reduce((sum, report) => sum + report.summary.decoupageDuplicates, 0),
    structuralErrors: reports.reduce((sum, report) => sum + report.errors.length, 0)
  };
  const audit = {
    version: "2026-06-27-reference-global-audit-v4",
    generatedAt: new Date().toISOString(),
    scope: {
      referenceDirectory: path.relative(repoRoot, referenceDir),
      referenceFileSelection: "Uniquement les références classe/niveau Clerc, Druide, Magicien et Illusionniste.",
      sourceOfTruth: "Manuel des joueurs AD&D 2e",
      componentsSourceOfTruth: "fvtt-spells-all-normalise-mecanique-v3.json",
      componentsRule: "Les composants matériels sont lus depuis V3 et ne sont pas déduits, corrigés ou modifiés depuis les références ou le découpage.",
      decoupageRole: "Contrôle Foundry lecture seule ; jamais une source de correction des références.",
      identityAliasesRole: "Table fermée de rapprochements de titres, sans renommage des données Foundry ni des références du Manuel.",
      requiredFoundryInstancesRole: "Les instances requises sont des items Foundry distincts par classe, niveau et spellLists."
    },
    manualVerification: {
      status: "not_performed_by_automation",
      note: "Aucun résultat de cet audit ne constitue une confirmation de conformité au Manuel. Les écarts et valeurs doivent être contrôlés dans le Manuel avant toute modification de référence."
    },
    structuralIdentity,
    summary,
    references: reports
  };

  console.log(`[ADD2E][REFERENCE_AUDIT] ${summary.references} référence(s), ${summary.spells} sort(s).`);
  console.log(`[ADD2E][REFERENCE_AUDIT] ${summary.referencesReadyForManualConfirmation} prête(s), ${summary.referencesManualReviewRequired} à vérifier, ${summary.referencesBlockedStructural} bloquée(s).`);
  console.log(`[ADD2E][REFERENCE_AUDIT] Champs absents ${summary.missingReferenceFields}, placeholders ${summary.placeholderFields}, divergences techniques ${summary.technicalDifferences}, descriptions absentes ${summary.missingDescriptions}, divergences descriptions ${summary.descriptionDifferences}.`);
  console.log(`[ADD2E][REFERENCE_AUDIT] Identités : alias ${summary.aliasMatches}, instances Foundry requises ${summary.requiredFoundryInstances}, doublons historiques ${summary.legacyFoundryDuplicates}, découpage non résolu ${summary.unresolvedDecoupageOnly}, hors périmètre ${summary.outOfScopeFoundryOnly}.`);
  console.log("[ADD2E][REFERENCE_AUDIT] Les composants matériels restent exclusivement pilotés par V3.");

  if (options.report) {
    const reportPath = path.resolve(repoRoot, options.report);
    writeJson(reportPath, audit);
    console.log(`[ADD2E][REFERENCE_AUDIT] Rapport écrit : ${path.relative(repoRoot, reportPath)}`);
  }
  if (summary.structuralErrors || (options.strict && (
    summary.missingReferenceFields
    || summary.placeholderFields
    || summary.technicalDifferences
    || summary.missingDescriptions
    || summary.descriptionDifferences
  ))) {
    process.exitCode = 1;
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.auditAll) auditAll(options);
  else schemaOnly();
}

main();
