import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const VERSION = "2026-06-24-spell-description-header-audit-v2-manual-reference";
const SOURCE_V3 = "fvtt-spells-all-normalise-mecanique-v3.json";
const CONTROL = "fvtt-spells-all-normalise-mecanique-v3-controle.json";
const MANUAL_REFERENCE = "audit/references/manuel-joueurs-spell-headers-v1.json";
const CLASS_BY_CODE = Object.freeze({ C: "Clerc", D: "Druide", M: "Magicien", I: "Illusionniste" });
const STOPWORDS = new Set(["a", "au", "aux", "avec", "ce", "ces", "d", "dans", "de", "des", "du", "elle", "en", "est", "et", "il", "la", "le", "les", "l", "ne", "on", "ou", "par", "pour", "que", "qui", "sa", "se", "son", "sort", "sur", "un", "une", "voir"]);

const text = value => String(value ?? "").replace(/\s+/g, " ").trim();
const slug = value => text(value)
  .toLowerCase().replace(/œ/g, "oe").replace(/æ/g, "ae")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[’']/g, "'").replace(/[^a-z0-9]+/g, "_")
  .replace(/^_+|_+$/g, "");
const keyFor = (classe, niveau, nom) => `${slug(classe)}|${Number(niveau) || 0}|${slug(nom)}`;
const asArray = value => Array.isArray(value) ? value : value == null || value === "" ? [] : [value];

function readJson(file, fallback = null) { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; } }
function writeJson(file, value) { fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8"); }
function getItems(document) {
  if (Array.isArray(document)) return document;
  for (const key of ["items", "Item", "Items", "documents", "data", "entries"]) if (Array.isArray(document?.[key])) return document[key];
  return [];
}
function isSpell(item) { return String(item?.type ?? item?.system?.type ?? "").toLowerCase() === "sort"; }
function plain(value) {
  if (value == null) return "";
  if (typeof value === "object") return plain(value.value ?? value.content ?? value.html ?? value.text ?? value.description ?? "");
  return text(String(value).replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'"));
}
function scalar(value) {
  if (value == null || value === "") return "";
  if (typeof value !== "object") return text(value);
  const amount = value.valeur ?? value.value ?? value.montant ?? value.amount ?? value.nombre ?? "";
  const unit = value.unite ?? value.unit ?? value.devise ?? value.currency ?? "";
  return amount !== "" || unit !== "" ? text(`${amount} ${unit}`) : text(value.label ?? value.nom ?? value.name ?? "");
}
function first(system, keys) {
  const values = keys.map(key => scalar(system?.[key])).filter(Boolean);
  return { value: values[0] ?? "", divergent: new Set(values.map(slug)).size > 1 };
}
function description(item) {
  const system = item?.system ?? {};
  for (const value of [system.description_reelle, system.description_texte, system.description, system.details?.description, item?.description]) {
    const result = plain(value);
    if (result) return result;
  }
  return "";
}
function vsm(value) { return [...new Set(text(value).toUpperCase().match(/[VSM]/g) ?? [])].sort().join(""); }
function tokens(value) { return slug(value).split("_").filter(token => token.length >= 3 && !STOPWORDS.has(token)); }
function similarity(left, right) {
  const a = tokens(left), b = tokens(right);
  if (!a.length || !b.length) return 0;
  let prefix = 0;
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix += 1;
  const bSet = new Set(b);
  const common = new Set(a.filter(token => bSet.has(token))).size;
  const containment = common / Math.min(new Set(a).size, bSet.size);
  return Math.max(prefix >= 3 ? prefix / Math.min(a.length, b.length) : 0, prefix >= 2 ? containment : 0);
}
function nameScore(left, right) {
  const a = slug(left), b = slug(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const at = new Set(a.split("_")), bt = new Set(b.split("_"));
  const common = [...at].filter(token => bt.has(token)).length;
  return common / Math.max(at.size, bt.size);
}
function parseReference(file) {
  const wrapper = readJson(file, null);
  if (!wrapper?.payload || wrapper.encoding !== "base64+deflateRaw+utf8-tsv") throw new Error(`Référence du Manuel introuvable ou invalide : ${MANUAL_REFERENCE}`);
  let raw;
  try { raw = inflateRawSync(Buffer.from(wrapper.payload, "base64")).toString("utf8"); }
  catch (error) { throw new Error(`Référence du Manuel illisible : ${error.message}`); }
  const spells = [];
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const [code, niveau, spellSlug, page, ecole, composantes, anchor] = line.split("|");
    const classe = CLASS_BY_CODE[code];
    if (!classe || !spellSlug) throw new Error(`Ligne de référence invalide : ${line.slice(0, 80)}`);
    spells.push({ classe, niveau: Number(niveau), slug: spellSlug, nom: spellSlug.replace(/_/g, " "), pdf_page: Number(page) || null, ecole, composantes: vsm(composantes), anchor: text(anchor).replace(/,/g, " ") });
  }
  const exact = new Map();
  const byClassLevel = new Map();
  for (const entry of spells) {
    exact.set(keyFor(entry.classe, entry.niveau, entry.slug), entry);
    const group = `${slug(entry.classe)}|${entry.niveau}`;
    if (!byClassLevel.has(group)) byClassLevel.set(group, []);
    byClassLevel.get(group).push(entry);
  }
  return { wrapper, spells, exact, byClassLevel };
}
function resolveManual(record, reference) {
  const exact = reference.exact.get(keyFor(record.classe, record.niveau, record.nom));
  if (exact) return { entry: exact, mode: "exact", score: 1 };
  const candidates = reference.byClassLevel.get(`${slug(record.classe)}|${record.niveau}`) ?? [];
  const ranked = candidates.map(entry => ({ entry, score: nameScore(record.nom, entry.nom) })).sort((a, b) => b.score - a.score);
  if (ranked[0]?.score >= 0.7 && (ranked[0].score - (ranked[1]?.score ?? 0)) >= 0.1) return { ...ranked[0], mode: "variant" };
  return { entry: null, mode: "none", candidates: ranked.slice(0, 3) };
}
function issue(record, code, severity, detail = {}) { record.anomalies.push({ code, severity, ...detail }); }
function recordFrom(item, sourceIndex) {
  const system = item.system ?? {};
  const fields = {
    classe: first(system, ["classe", "class", "liste"]),
    niveau: first(system, ["niveau", "niveau_sort", "level"]),
    ecole: first(system, ["ecole", "école", "school"]),
    composantes: first(system, ["composantes", "components", "composants"])
  };
  return {
    sourceIndex,
    id: text(item._id ?? item.id),
    nom: text(item.name ?? system.nom),
    classe: fields.classe.value,
    niveau: Number(String(fields.niveau.value).match(/\d+/)?.[0] ?? 0) || 0,
    ecole: fields.ecole.value,
    composantes: fields.composantes.value,
    description: description(item),
    materiels: asArray(system.composants_materiels).flatMap(component => Array.isArray(component?.alternatives) ? component.alternatives : [component]).map(component => text(component?.nom ?? component?.name)).filter(Boolean),
    fields,
    manual: null,
    anomalies: []
  };
}
function audit(records, reference) {
  const duplicateGroups = new Map();
  for (const record of records) {
    const key = keyFor(record.classe, record.niveau, record.nom);
    if (!duplicateGroups.has(key)) duplicateGroups.set(key, []);
    duplicateGroups.get(key).push(record);
    record.manual = resolveManual(record, reference);
    for (const [field, fieldData] of Object.entries(record.fields)) if (fieldData.divergent) issue(record, "entete_alias_divergent", "review", { champ: field });
    if (!record.manual.entry) issue(record, "entete_v3_absent_reference_manuel", "review", { candidats: record.manual.candidates?.map(candidate => ({ nom: candidate.entry.nom, score: Number(candidate.score.toFixed(3)) })) ?? [] });
    else {
      const manual = record.manual.entry;
      if (record.manual.mode === "variant") issue(record, "libelle_v3_variant_manuel", "review", { manuel: manual.nom, score: Number(record.manual.score.toFixed(3)) });
      if (record.ecole && slug(record.ecole) !== slug(manual.ecole)) issue(record, "ecole_v3_differente_manuel", "review", { v3: record.ecole, manuel: manual.ecole });
      if (!record.ecole) issue(record, "ecole_v3_non_structuree", "info", { manuel: manual.ecole });
      if (record.composantes && vsm(record.composantes) !== manual.composantes) issue(record, "vsm_v3_different_manuel", "review", { v3: record.composantes, manuel: manual.composantes });
      if (!record.composantes) issue(record, "vsm_v3_non_structure", "info", { manuel: manual.composantes });
      record.manual.descriptionScore = Number(similarity(record.description, manual.anchor).toFixed(3));
      if (!record.description) issue(record, "description_absente", "certain");
      else if (record.manual.descriptionScore < 0.55) issue(record, "description_v3_differe_manuel", "review", { score: record.manual.descriptionScore });
    }
  }
  const duplicates = [];
  for (const group of duplicateGroups.values()) if (group.length > 1) {
    const item = { classe: group[0].classe, niveau: group[0].niveau, nom: group[0].nom, ids: group.map(record => record.id) };
    duplicates.push(item);
    for (const record of group) issue(record, "entete_v3_duplique", "certain", item);
  }
  const shifts = [];
  for (const record of records) {
    const own = record.manual.entry;
    if (!own || !record.description || (record.manual.descriptionScore ?? 1) >= 0.55) continue;
    const candidates = reference.byClassLevel.get(`${slug(record.classe)}|${record.niveau}`) ?? [];
    const best = candidates.filter(entry => entry !== own).map(entry => ({ entry, score: similarity(record.description, entry.anchor) })).sort((a, b) => b.score - a.score)[0];
    const ownScore = record.manual.descriptionScore ?? 0;
    if (!best || best.score < 0.72 || best.score - ownScore < 0.35) continue;
    const item = { id: record.id, classe: record.classe, niveau: record.niveau, actuel: record.nom, reference_attendue: own.nom, reference_probable: best.entry.nom, score_attendu: ownScore, score_probable: Number(best.score.toFixed(3)), description: record.description.slice(0, 320) };
    shifts.push(item);
    issue(record, "description_probablement_decalee", "certain", item);
  }
  return { duplicates, shifts };
}
function main() {
  const positional = process.argv.slice(2).filter(value => value && !value.startsWith("--"));
  const sourceFile = path.join(ROOT, positional[0] || SOURCE_V3);
  const controlFile = path.join(ROOT, positional[1] || CONTROL);
  const referenceFile = path.join(ROOT, positional[2] || MANUAL_REFERENCE);
  const source = readJson(sourceFile, null);
  if (!source || typeof source !== "object") throw new Error(`Source V3 introuvable ou invalide : ${sourceFile}`);
  const reference = parseReference(referenceFile);
  const records = getItems(source).filter(isSpell).map(recordFrom);
  const { duplicates, shifts } = audit(records, reference);
  const matched = new Set(records.map(record => record.manual.entry ? keyFor(record.manual.entry.classe, record.manual.entry.niveau, record.manual.entry.slug) : null).filter(Boolean));
  const manualMissing = reference.spells.filter(entry => !matched.has(keyFor(entry.classe, entry.niveau, entry.slug)));
  const issues = records.flatMap(record => record.anomalies.map(anomaly => ({ id: record.id, nom: record.nom, classe: record.classe, niveau: record.niveau, ...anomaly })));
  const count = code => issues.filter(item => item.code === code).length;
  const report = {
    version: VERSION,
    source: SOURCE_V3,
    reference: MANUAL_REFERENCE,
    policy: "Audit non destructif. Il compare l'identité d'entête (nom, classe, niveau), l'école, V/S/M et l'ancre descriptive du Manuel. Les champs V3 absents sont des informations techniques, jamais une erreur certaine.",
    summary: {
      sortsAnalyses: records.length,
      referencesManuel: reference.spells.length,
      correspondancesExactes: records.filter(record => record.manual.mode === "exact").length,
      correspondancesVariantes: records.filter(record => record.manual.mode === "variant").length,
      sortsV3SansReferenceManuel: records.filter(record => !record.manual.entry).length,
      sortsManuelAbsentsV3: manualMissing.length,
      entetesV3Dupliques: duplicates.length,
      entetesAliasDivergents: count("entete_alias_divergent"),
      ecolesDifferentesManuel: count("ecole_v3_differente_manuel"),
      vsmDifferentsManuel: count("vsm_v3_different_manuel"),
      entetesV3NonStructures: count("ecole_v3_non_structuree") + count("vsm_v3_non_structure"),
      descriptionsAbsentes: count("description_absente"),
      descriptionsDifferentesManuel: count("description_v3_differe_manuel"),
      decalagesProbables: shifts.length,
      erreursCertaines: issues.filter(item => item.severity === "certain").length,
      alertesARevoir: issues.filter(item => item.severity === "review").length,
      informations: issues.filter(item => item.severity === "info").length
    },
    decalagesProbables: shifts,
    entetesV3Dupliques: duplicates,
    sortsManuelAbsentsV3: manualMissing.map(entry => ({ classe: entry.classe, niveau: entry.niveau, nom: entry.nom, pdf_page: entry.pdf_page })),
    issues,
    sorts: records.map(record => ({ id: record.id, nom: record.nom, classe: record.classe, niveau: record.niveau, ecole: record.ecole, composantes: record.composantes, materiels: record.materiels, description: record.description.slice(0, 420), manual: record.manual.entry ? { nom: record.manual.entry.nom, classe: record.manual.entry.classe, niveau: record.manual.entry.niveau, pdf_page: record.manual.entry.pdf_page, mode: record.manual.mode, descriptionScore: record.manual.descriptionScore } : null, anomalies: record.anomalies }))
  };
  const control = readJson(controlFile, {}) ?? {};
  control.version = VERSION;
  control.spellDescriptionHeaderAudit = report;
  writeJson(controlFile, control);
  const s = report.summary;
  console.log(`[ADD2E][SPELL_DESCRIPTION_AUDIT] ${s.sortsAnalyses} sort(s) V3 / ${s.referencesManuel} référence(s) Manuel.`);
  console.log(`[ADD2E][SPELL_DESCRIPTION_AUDIT] ${s.correspondancesExactes} correspondance(s) exacte(s), ${s.correspondancesVariantes} variante(s), ${s.sortsV3SansReferenceManuel} sort(s) V3 sans référence, ${s.sortsManuelAbsentsV3} référence(s) sans sort V3.`);
  console.log(`[ADD2E][SPELL_DESCRIPTION_AUDIT] ${s.decalagesProbables} décalage(s) probable(s), ${s.ecolesDifferentesManuel} école(s) différente(s), ${s.vsmDifferentsManuel} V/S/M différent(s), ${s.entetesV3NonStructures} champ(s) non structuré(s).`);
}
main();
