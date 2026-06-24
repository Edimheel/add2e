import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const VERSION = "2026-06-24-spell-description-header-audit-v1";
const SOURCE_V3 = "fvtt-spells-all-normalise-mecanique-v3.json";
const CONTROL = "fvtt-spells-all-normalise-mecanique-v3-controle.json";
const CLASSES = new Set(["clerc", "druide", "magicien", "illusionniste"]);
const STOPWORDS = new Set(["avec", "dans", "des", "du", "dun", "dune", "est", "la", "le", "les", "pour", "que", "qui", "sort", "une", "un", "voir"]);

const text = value => String(value ?? "").replace(/\s+/g, " ").trim();
const slug = value => text(value)
  .toLowerCase()
  .replace(/œ/g, "oe")
  .replace(/æ/g, "ae")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[’']/g, "'")
  .replace(/[^a-z0-9]+/g, "_")
  .replace(/^_+|_+$/g, "");

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

function plain(value) {
  if (value == null) return "";
  if (typeof value === "object") {
    for (const key of ["value", "content", "html", "text", "description"]) {
      if (value[key] != null) return plain(value[key]);
    }
    return "";
  }
  return text(String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'"));
}

function normalizeComparable(value) {
  return slug(plain(value));
}

function scalar(value) {
  if (value == null || value === "") return "";
  if (typeof value !== "object") return text(value);
  const amount = value.valeur ?? value.value ?? value.montant ?? value.amount ?? value.nombre ?? "";
  const unit = value.unite ?? value.unit ?? value.devise ?? value.currency ?? "";
  if (amount !== "" || unit !== "") return text(`${amount} ${unit}`);
  return text(value.label ?? value.nom ?? value.name ?? "");
}

function getPath(object, pathParts) {
  let value = object;
  for (const part of pathParts) {
    if (value == null || typeof value !== "object") return undefined;
    value = value[part];
  }
  return value;
}

function firstField(system, keys) {
  const values = [];
  for (const key of keys) {
    const raw = key.includes(".") ? getPath(system, key.split(".")) : system?.[key];
    const value = scalar(raw);
    if (value) values.push({ key, value });
  }
  return {
    value: values[0]?.value ?? "",
    values,
    divergent: new Set(values.map(entry => normalizeComparable(entry.value))).size > 1
  };
}

function asArray(value) {
  return Array.isArray(value) ? value : value == null || value === "" ? [] : [value];
}

function isSpell(item) {
  return String(item?.type ?? item?.system?.type ?? "").toLowerCase() === "sort";
}

function descriptionSources(item) {
  const system = item?.system ?? {};
  const candidates = [
    ["description_reelle", system.description_reelle],
    ["description_texte", system.description_texte],
    ["description", system.description],
    ["details.description", system.details?.description],
    ["item.description", item.description]
  ].map(([key, value]) => ({ key, value: plain(value) })).filter(entry => entry.value);

  const unique = new Map();
  for (const entry of candidates) {
    const signature = normalizeComparable(entry.value);
    if (!unique.has(signature)) unique.set(signature, entry);
  }
  return { candidates, unique: [...unique.values()] };
}

function normalizedClass(value) {
  const result = slug(value);
  return CLASSES.has(result) ? result : result;
}

function headerFromItem(item, index) {
  const system = item?.system ?? {};
  const descriptions = descriptionSources(item);
  const classe = firstField(system, ["classe", "class", "liste"]);
  const niveau = firstField(system, ["niveau", "niveau_sort", "level"]);
  const ecole = firstField(system, ["ecole", "école", "school"]);
  const reversible = firstField(system, ["reversible", "réversible", "reverse"]);
  const composantes = firstField(system, ["composantes", "components", "composants"]);
  const portee = firstField(system, ["portée", "portee", "range"]);
  const incantation = firstField(system, ["temps_incantation", "tempsIncantation", "castingTime", "incantation"]);
  const duree = firstField(system, ["durée", "duree", "duration"]);
  const sauvegarde = firstField(system, ["jet_protection", "jetDeProtection", "sauvegarde", "savingThrow"]);
  const zone = firstField(system, ["zone_effet", "zone_d_effet", "aire_effet", "area"]);

  const name = text(item?.name ?? system.nom);
  const description = descriptions.candidates[0]?.value ?? "";
  const materialComponents = asArray(system.composants_materiels)
    .flatMap(value => Array.isArray(value?.alternatives) ? value.alternatives : [value])
    .map(value => text(value?.nom ?? value?.name))
    .filter(Boolean);

  return {
    sourceIndex: index,
    id: text(item?._id ?? item?.id),
    nom: name,
    slug: slug(name),
    classe: classe.value,
    classeSlug: normalizedClass(classe.value),
    niveau: niveau.value,
    niveauNombre: Number(String(niveau.value).match(/\d+/)?.[0] ?? 0) || 0,
    ecole: ecole.value,
    reversible: reversible.value,
    composantes: composantes.value,
    portee: portee.value,
    incantation: incantation.value,
    duree: duree.value,
    sauvegarde: sauvegarde.value,
    zone: zone.value,
    materiels: materialComponents,
    description,
    descriptionSources: descriptions.candidates.map(entry => entry.key),
    descriptionSourceCount: descriptions.unique.length,
    fields: { classe, niveau, ecole, reversible, composantes, portee, incantation, duree, sauvegarde, zone },
    img: text(item?.img),
    onUse: text(system.onUse ?? system.onuse ?? system.on_use),
    tags: uniqueTags(item),
    anomalies: []
  };
}

function uniqueTags(item) {
  const system = item?.system ?? {};
  const tags = [
    ...asArray(system.tags),
    ...asArray(system.effectTags),
    ...asArray(item?.flags?.add2e?.tags)
  ];
  for (const effect of asArray(item?.effects)) tags.push(...asArray(effect?.flags?.add2e?.tags));
  return [...new Set(tags.map(text).filter(Boolean))];
}

function addIssue(record, code, severity, detail = {}) {
  record.anomalies.push({ code, severity, ...detail });
}

function descriptionSignature(description) {
  const normalized = normalizeComparable(description);
  return normalized.length >= 120 ? normalized : "";
}

function declaredVsm(value) {
  const upper = text(value).toUpperCase();
  return {
    V: /(?:^|[^A-Z])V(?:$|[^A-Z])/.test(upper),
    S: /(?:^|[^A-Z])S(?:$|[^A-Z])/.test(upper),
    M: /(?:^|[^A-Z])M(?:$|[^A-Z])/.test(upper)
  };
}

function expectedFileStem(record) {
  if (!record.classeSlug || !record.slug) return "";
  return `${record.classeSlug}-${record.slug}`;
}

function tagValue(tags, prefix) {
  const normalizedPrefix = `${prefix}:`;
  return tags.map(tag => slug(tag).replace(/_/g, ":"))
    .filter(tag => tag.startsWith(normalizedPrefix))
    .map(tag => tag.slice(normalizedPrefix.length));
}

function meaningfulTokens(value) {
  return [...tokens(value)].filter(token => token.length >= 4 && !STOPWORDS.has(token));
}

function tokens(value) {
  return new Set(slug(value).split("_").filter(Boolean));
}

function materialMentionedInDescription(name, description) {
  const descriptionTokens = tokens(description);
  const words = meaningfulTokens(name);
  if (!words.length) return true;
  return words.some(word => descriptionTokens.has(word));
}

function detectHeaderConsistency(record) {
  const required = ["classe", "niveau", "ecole", "composantes", "portee", "incantation", "duree", "sauvegarde", "zone"];
  for (const field of required) {
    if (!record[field]) addIssue(record, "entete_manquant", "certain", { champ: field });
    if (record.fields[field]?.divergent) addIssue(record, "entete_alias_divergent", "certain", { champ: field, valeurs: record.fields[field].values });
  }

  if (!record.description) addIssue(record, "description_absente", "certain");
  if (record.description.length > 0 && record.description.length < 40) addIssue(record, "description_tres_courte", "review", { longueur: record.description.length });
  if (record.descriptionSourceCount > 1) addIssue(record, "description_sources_divergentes", "certain", { sources: record.descriptionSources });

  const vsm = declaredVsm(record.composantes);
  if (vsm.M && !record.materiels.length) addIssue(record, "entete_m_sans_composant_structure", "review");
  if (!vsm.M && record.materiels.length) addIssue(record, "entete_sans_m_avec_composant_structure", "certain", { materiels: record.materiels });

  const descriptionMentionsMaterial = /composante(?:s)?\s+mat[ée]rielle(?:s)?/i.test(record.description);
  if (descriptionMentionsMaterial && record.materiels.length && !record.materiels.some(name => materialMentionedInDescription(name, record.description))) {
    addIssue(record, "description_materielle_incoherente", "review", { materiels: record.materiels });
  }

  const classTags = tagValue(record.tags, "classe");
  if (classTags.length && record.classeSlug && classTags.some(value => value !== record.classeSlug)) {
    addIssue(record, "tag_classe_incoherent", "certain", { entete: record.classeSlug, tags: classTags });
  }

  const levelTags = tagValue(record.tags, "niveau");
  if (levelTags.length && record.niveauNombre && levelTags.some(value => Number(value) !== record.niveauNombre)) {
    addIssue(record, "tag_niveau_incoherent", "certain", { entete: record.niveauNombre, tags: levelTags });
  }

  const schoolTags = tagValue(record.tags, "ecole");
  if (schoolTags.length && record.ecole && schoolTags.some(value => value !== slug(record.ecole))) {
    addIssue(record, "tag_ecole_incoherent", "review", { entete: record.ecole, tags: schoolTags });
  }

  const expected = expectedFileStem(record);
  const onUseStem = slug(path.basename(record.onUse).replace(/\.[^.]+$/, ""));
  if (record.onUse && expected && onUseStem && onUseStem !== expected) {
    addIssue(record, "onuse_incoherent", "review", { attendu: expected, trouve: onUseStem });
  }

  const imageStem = slug(path.basename(record.img).replace(/\.[^.]+$/, ""));
  if (record.img && /^(clerc|druide|magicien|illusionniste)_/.test(imageStem) && expected && imageStem.replace(/_/g, "-") !== expected) {
    addIssue(record, "icone_incoherente", "review", { attendu: expected, trouve: imageStem });
  }
}

function parseCrossReferences(description, lookup) {
  const result = [];
  const matcher = /sort\s+de\s+niveau\s+(\d+)\s+de\s+(clerc|druide|magicien|illusionniste)\s+([^\n.;()]{2,90})/gi;
  for (const match of description.matchAll(matcher)) {
    const niveau = Number(match[1]);
    const classe = slug(match[2]);
    const rawName = text(match[3]).replace(/\s+(voir|sauf|mais|et)\b.*$/i, "");
    const key = `${classe}|${niveau}|${slug(rawName)}`;
    result.push({ classe, niveau, nom: rawName, cible: lookup.get(key) ?? null });
  }
  return result;
}

function auditDescriptions(records) {
  const byHeader = new Map();
  for (const record of records) {
    const key = `${record.classeSlug}|${record.niveauNombre}|${record.slug}`;
    if (!byHeader.has(key)) byHeader.set(key, record);
  }

  const duplicateGroups = new Map();
  for (const record of records) {
    const signature = descriptionSignature(record.description);
    if (!signature) continue;
    if (!duplicateGroups.has(signature)) duplicateGroups.set(signature, []);
    duplicateGroups.get(signature).push(record);
  }

  const duplicates = [];
  for (const group of duplicateGroups.values()) {
    const distinctHeaders = new Set(group.map(record => `${record.classeSlug}|${record.niveauNombre}|${record.slug}`));
    if (distinctHeaders.size < 2) continue;
    const groupEntry = { description: group[0].description.slice(0, 240), sorts: group.map(record => ({ id: record.id, nom: record.nom, classe: record.classe, niveau: record.niveau })) };
    duplicates.push(groupEntry);
    for (const record of group) addIssue(record, "description_dupliquee", "review", { sorts: groupEntry.sorts });
  }

  const sequenceCandidates = [];
  const groups = new Map();
  for (const record of records) {
    const key = `${record.classeSlug}|${record.niveauNombre}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  }

  for (const list of groups.values()) {
    list.sort((left, right) => left.sourceIndex - right.sourceIndex);
    for (let index = 0; index < list.length; index += 1) {
      const record = list[index];
      const references = parseCrossReferences(record.description, byHeader);
      record.references = references.map(reference => ({ classe: reference.classe, niveau: reference.niveau, nom: reference.nom, cible: reference.cible ? { id: reference.cible.id, nom: reference.cible.nom, classe: reference.cible.classe, niveau: reference.cible.niveau } : null }));

      for (const reference of references) {
        if (!reference.cible) continue;
        if (reference.cible.slug === record.slug && reference.cible.classeSlug === record.classeSlug && reference.cible.niveauNombre === record.niveauNombre) continue;
        addIssue(record, "reference_croisee", "info", { cible: { nom: reference.cible.nom, classe: reference.cible.classe, niveau: reference.cible.niveau } });

        const next = list[index + 1];
        if (next && slug(reference.nom) === next.slug) {
          const candidate = {
            classe: record.classe,
            niveau: record.niveau,
            actuel: { id: record.id, nom: record.nom },
            suivant: { id: next.id, nom: next.nom },
            reference: { nom: reference.cible.nom, classe: reference.cible.classe, niveau: reference.cible.niveau },
            description: record.description.slice(0, 280)
          };
          sequenceCandidates.push(candidate);
          addIssue(record, "description_probablement_decalee_vers_suivant", "review", candidate);
        }
      }
    }
  }

  return { duplicates, sequenceCandidates };
}

function parseArgs(argv) {
  const positional = argv.filter(value => value && !value.startsWith("--"));
  return { source: positional[0] || SOURCE_V3, control: positional[1] || CONTROL };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const source = readJson(path.join(ROOT, args.source), null);
  if (!source || typeof source !== "object") throw new Error(`Source V3 introuvable ou invalide : ${args.source}`);

  const records = getItems(source).filter(isSpell).map(headerFromItem);
  for (const record of records) detectHeaderConsistency(record);
  const descriptionAudit = auditDescriptions(records);

  const issues = records.flatMap(record => record.anomalies.map(issue => ({
    id: record.id,
    nom: record.nom,
    classe: record.classe,
    niveau: record.niveau,
    ...issue
  })));
  const count = code => issues.filter(issue => issue.code === code).length;
  const severity = value => issues.filter(issue => issue.severity === value).length;

  const report = {
    version: VERSION,
    source: SOURCE_V3,
    policy: "Audit non destructif. Il contrôle la cohérence interne entre l'entête, les tags, les fichiers onUse/icône, les composants structurés et la description. Il ne corrige aucun sort.",
    summary: {
      sortsAnalyses: records.length,
      erreursCertaines: severity("certain"),
      alertesARevoir: severity("review"),
      descriptionsAbsentes: count("description_absente"),
      descriptionsDivergentes: count("description_sources_divergentes"),
      entetesManquants: count("entete_manquant"),
      entetesDivergents: count("entete_alias_divergent"),
      tagsIncoherents: issues.filter(issue => issue.code.startsWith("tag_")).length,
      vsmIncoherents: count("entete_m_sans_composant_structure") + count("entete_sans_m_avec_composant_structure"),
      composantsDescriptionIncoherents: count("description_materielle_incoherente"),
      descriptionsDupliquees: descriptionAudit.duplicates.length,
      decalagesProbables: descriptionAudit.sequenceCandidates.length
    },
    sequencesSuspectes: descriptionAudit.sequenceCandidates,
    descriptionsDupliquees: descriptionAudit.duplicates,
    issues,
    sorts: records.map(record => ({
      sourceIndex: record.sourceIndex,
      id: record.id,
      nom: record.nom,
      classe: record.classe,
      niveau: record.niveau,
      ecole: record.ecole,
      reversible: record.reversible,
      composantes: record.composantes,
      portee: record.portee,
      incantation: record.incantation,
      duree: record.duree,
      sauvegarde: record.sauvegarde,
      zone: record.zone,
      materiels: record.materiels,
      onUse: record.onUse,
      img: record.img,
      description: record.description.slice(0, 420),
      references: record.references ?? [],
      anomalies: record.anomalies
    }))
  };

  const controlPath = path.join(ROOT, args.control);
  const control = readJson(controlPath, {}) ?? {};
  control.version = VERSION;
  control.spellDescriptionHeaderAudit = report;
  writeJson(controlPath, control);

  const summary = report.summary;
  console.log(`[ADD2E][SPELL_DESCRIPTION_AUDIT] ${summary.sortsAnalyses} sort(s) analysé(s).`);
  console.log(`[ADD2E][SPELL_DESCRIPTION_AUDIT] ${summary.erreursCertaines} erreur(s) certaine(s), ${summary.alertesARevoir} alerte(s), ${summary.decalagesProbables} décalage(s) probable(s).`);
  console.log(`[ADD2E][SPELL_DESCRIPTION_AUDIT] Entêtes : ${summary.entetesManquants} champ(s) manquant(s), ${summary.entetesDivergents} divergence(s), ${summary.tagsIncoherents} tag(s) incohérent(s), ${summary.vsmIncoherents} incohérence(s) V/S/M.`);
}

main();
