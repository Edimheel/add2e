import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const VERSION = "2026-06-20-reversible-actor-structure-v3";
const CLASSES = { clerc:[1,2,3,4,5,6,7], druide:[1,2,3,4,5,6,7], magicien:[1,2,3,4,5,6,7,8,9], illusionniste:[1,2,3,4,5,6,7] };
const EXCLUDED_DESCRIPTION_MATCHES = new Set([
  "druide|4|dissipation_de_la_magie",
  "druide|7|reincarnation"
]);
const EXACT_INVERSES = new Map([
  ["druide|5|transmutation_de_pierre_en_boue", "Transmutation de boue en pierre"]
]);
const text = v => String(v ?? "").replace(/\s+/g, " ").trim();
const slug = v => text(v).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, "'").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
const clone = v => v === undefined ? undefined : JSON.parse(JSON.stringify(v));
const read = (file, fallback = null) => { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; } };
const write = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
const itemsOf = doc => Array.isArray(doc) ? doc : ["items", "Item", "Items", "documents", "data", "entries"].map(key => doc?.[key]).find(Array.isArray) ?? [];
const setItems = (doc, items) => { if (Array.isArray(doc)) return items; for (const key of ["items", "Item", "Items", "documents", "data", "entries"]) if (Array.isArray(doc?.[key])) { doc[key] = items; return doc; } doc.items = items; return doc; };
const levelOf = item => Number(String(item?.system?.niveau ?? item?.system?.niveau_sort ?? item?.system?.level ?? "").match(/\d+/)?.[0] ?? 0) || 0;
const keyOf = item => text(item?._id ?? item?.id) || `${slug(item?.system?.classe)}|${levelOf(item)}|${slug(item?.name ?? item?.system?.nom)}`;
const classesOf = item => { const system = item?.system ?? {}; const raw = Array.isArray(system.spellLists) ? system.spellLists : String(system.spellLists ?? system.classe ?? "").split(/[,;|/]+/); return new Set([...raw.map(slug), slug(system.classe)].filter(Boolean)); };

function references() {
  const map = new Map(), files = [];
  for (const [classSlug, levels] of Object.entries(CLASSES)) for (const level of levels) {
    const file = path.join(ROOT, `audit/reference/manuel-joueurs-${classSlug}-niveau-${level}.json`);
    if (!fs.existsSync(file)) continue;
    const doc = read(file, {});
    files.push(path.relative(ROOT, file));
    for (const ref of doc.spells ?? []) {
      const name = text(ref.nom ?? ref.name);
      if (name) map.set(`${classSlug}|${Number(ref.niveau ?? level) || level}|${slug(name)}`, { ...clone(ref), __file: path.relative(ROOT, file) });
    }
  }
  return { map, files };
}

function descriptionInverse(item) {
  const description = text(String(item?.system?.description_reelle ?? item?.system?.description ?? item?.system?.description_texte ?? item?.system?.description_html ?? "").replace(/<[^>]*>/g, " "));
  for (const pattern of [/l['’]inverse du sort\s*,\s*([^,.]{2,80})/i, /l['’]inverse\s*,\s*([^,.]{2,80})/i, /le sort invers[eé]\s*(?:est|s['’]appelle|se nomme)\s*[:;,]?\s*([^,.]{2,80})/i, /inverse\s*:\s*([^,.]{2,80})/i]) {
    const name = text(description.match(pattern)?.[1])
      .replace(/^(?:le|la|les|un|une|du|de la|de l['’])\s+/i, "")
      .replace(/\s+(?:ne|et|qui|qu['’]|lorsque|si)\b.*$/i, "");
    if (name && /^[A-Za-zÀ-ÖØ-öø-ÿ]/.test(name) && !/^(ce|cet|cette|il|elle|on|le sort|la cible|la creature)\b/i.test(name)) return name[0].toUpperCase() + name.slice(1);
  }
  return "";
}

function inverseFor(classSlug, level, name, reference, item) {
  const key = `${classSlug}|${level}|${slug(name)}`;
  if (EXCLUDED_DESCRIPTION_MATCHES.has(key)) return null;
  const direct = text(reference?.inverse ?? reference?.nom_inverse ?? reference?.reversible?.inverse);
  if (direct) return { name: direct, source: "reference" };
  const exact = EXACT_INVERSES.get(key);
  if (exact) return { name: exact, source: "manual-verified" };
  const parsed = descriptionInverse(item);
  return parsed ? { name: parsed, source: "description" } : null;
}

function modeMaterials(reference, mode, fallback) {
  const all = Array.isArray(reference?.composants_materiels_objets) ? clone(reference.composants_materiels_objets) : [];
  const regex = mode === "inverse" ? /\b(inverse|malediction|maudite|destruction|deshydratation|corruption|epouvante|tenebres|blessures|traumatisme|bien)\b/i : /\b(normal|creation|benediction|purification|apaisement|lumiere|mal)\b/i;
  const selected = all.filter(rule => !text(`${rule.condition ?? ""} ${rule.notes ?? ""}`) || regex.test(`${rule.condition ?? ""} ${rule.notes ?? ""}`));
  const components = selected.map(rule => text(rule.nom ?? rule.name)).filter(Boolean);
  return { components: components.length ? components : clone(fallback ?? []), reference: selected };
}

function main() {
  const input = path.join(ROOT, process.argv[2] || "fvtt-spells-all-normalise-mecanique-v1.json");
  const output = path.join(ROOT, process.argv[3] || "fvtt-spells-all-normalise-mecanique-v3.json");
  const controlFile = path.join(ROOT, process.argv[4] || "fvtt-spells-all-normalise-mecanique-v3-controle.json");
  const source = read(input);
  if (!source) throw new Error(`Fichier introuvable ou invalide : ${input}`);
  const previous = read(output, source), sourceItems = itemsOf(source), previousItems = itemsOf(previous);
  const previousByKey = new Map(previousItems.map(item => [keyOf(item), item]));
  const sourceKeys = new Set(sourceItems.map(keyOf));
  const items = sourceItems.map(item => clone(previousByKey.get(keyOf(item)) ?? item));
  const ignoredAuditOnlyItems = previousItems.filter(item => !sourceKeys.has(keyOf(item))).map(item => ({ name: item.name, classe: item.system?.classe, niveau: item.system?.niveau }));
  const { map, files } = references();
  const byClass = { clerc: 0, druide: 0, magicien: 0, illusionniste: 0 };
  const bySource = { reference: 0, "manual-verified": 0, description: 0 };
  const profiles = [];

  for (const item of items) {
    if (String(item?.type ?? item?.system?.type ?? "") !== "sort") continue;
    const level = levelOf(item), name = text(item?.name ?? item?.system?.nom), actorProfiles = [];
    for (const classSlug of classesOf(item)) {
      const reference = map.get(`${classSlug}|${level}|${slug(name)}`);
      if (!reference) continue;
      const inverse = inverseFor(classSlug, level, name, reference, item);
      if (!inverse) continue;
      const normal = modeMaterials(reference, "normal", item.system?.composants_materiels);
      const reverse = modeMaterials(reference, "inverse", item.system?.composants_materiels);
      const profile = { class: classSlug, level, referenceFile: reference.__file, inverseNameSource: inverse.source, modes: [
        { id: "normal", actorItemName: text(reference.nom) || name, manualName: text(reference.nom) || name, copySourceItem: true, systemOverrides: { composants_materiels: normal.components }, materialReference: normal.reference },
        { id: "inverse", actorItemName: inverse.name, manualName: inverse.name, copySourceItem: true, systemOverrides: { composants_materiels: reverse.components }, materialReference: reverse.reference }
      ] };
      actorProfiles.push(profile); profiles.push({ name, ...clone(profile) }); byClass[classSlug]++; bySource[inverse.source]++;
    }
    if (actorProfiles.length) { item.flags ??= {}; item.flags.add2e ??= {}; item.flags.add2e.reversible = { version: VERSION, managedBy: "normalize-fvtt-spells-materials-v3", enabled: true, splitOnActorGrant: true, actorGrantEvents: ["drop", "auto-grant-clerc", "auto-grant-druide"], choiceTiming: "memorization", profiles: actorProfiles }; }
    else if (item.flags?.add2e?.reversible?.managedBy === "normalize-fvtt-spells-materials-v3") delete item.flags.add2e.reversible;
  }

  const result = setItems(clone(previous), items); result.normalizedBy = VERSION; result.normalizedAt = new Date().toISOString(); write(output, result);
  const control = read(controlFile, {}) ?? {};
  control.version = VERSION; control.totalItems = items.length;
  control.sourceSpellCount = sourceItems.filter(item => String(item?.type ?? item?.system?.type ?? "") === "sort").length;
  control.outputSpellCount = items.filter(item => String(item?.type ?? item?.system?.type ?? "") === "sort").length;
  control.sourceSpellCountExpected = 411; control.sourceSpellCountInvariant = control.sourceSpellCount === 411 && control.outputSpellCount === 411;
  control.appendedFromAudit = { clerc: [] }; control.ignoredAuditOnlyItems = ignoredAuditOnlyItems;
  control.reversibleActorSplit = { version: VERSION, referenceFiles: files, byClass, bySource, profiles };
  write(controlFile, control);
  console.log(`[ADD2E][SPELL_MATERIALS_V3] ${control.outputSpellCount} sort(s) conservé(s) depuis la source.`);
  console.log(`[ADD2E][SPELL_MATERIALS_V3] Réversibles — clerc: ${byClass.clerc}, druide: ${byClass.druide}, magicien: ${byClass.magicien}, illusionniste: ${byClass.illusionniste}.`);
  console.log(`[ADD2E][SPELL_MATERIALS_V3] Sources des inverses — références: ${bySource.reference}, validations: ${bySource["manual-verified"]}, descriptions: ${bySource.description}.`);
  console.log(`[ADD2E][SPELL_MATERIALS_V3] Items d’audit exclus: ${ignoredAuditOnlyItems.length}.`);
}
main();
