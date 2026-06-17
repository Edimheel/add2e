import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");

const VERSION = "2026-06-17-normalize-spell-materials-v3-full-scan-v3";
const DEFAULT_INPUT = "fvtt-spells-all-normalise-mecanique-v1.json";
const DEFAULT_OUTPUT = "fvtt-spells-all-normalise-mecanique-v3.json";
const DEFAULT_CONTROL = "fvtt-spells-all-normalise-mecanique-v3-controle.json";

const EFFECT_PROFILE_VERSION = "2026-06-16-add2e-spell-effects-v1";
const SYSTEM_KEYS = [
  "nom", "type", "classe", "spellLists", "niveau", "ecole", "portee", "duree", "zone_effet", "cible",
  "temps_incantation", "jet_sauvegarde", "composantes", "composants_materiels", "composants_materiels_source",
  "composants_materiels_reference", "composants_materiels_verification_recommandee", "composants_materiels_note",
  "composants_materiels_a_renseigner", "description", "onUse", "onUseCode", "tags", "effectTags", "effectProfile"
];

const WATCHED_NAMES = new Set([
  "aquagenese", "benediction", "resistance_au_froid", "sanctuaire", "augure", "retardement_du_poison", "paralysie",
  "marteau_spirituel", "divination", "exorcisme", "langage_des_plantes", "changement_de_plan", "communion", "dissipation_du_mal"
]);

function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
function text(value) { return String(value ?? "").replace(/\s+/g, " ").trim(); }
function norm(value) { return text(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, "'").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim(); }
function slug(value) { return norm(value).replace(/\s+/g, "_"); }
function wordCount(value) { return norm(value).split(/\s+/).filter(Boolean).length; }

function getItems(json) {
  if (Array.isArray(json)) return json;
  for (const key of ["items", "Item", "Items", "documents", "data", "entries"]) if (Array.isArray(json?.[key])) return json[key];
  return [];
}

function normalizeLabel(value) {
  return text(value)
    .replace(/[_-]+/g, " ")
    .replace(/^d['’]\s*/i, "")
    .replace(/^(un|une)?\s*peu\s+de\s+/i, "")
    .replace(/^(un|une|du|de la|de l['’]?|des|le|la|les)\s+/i, "")
    .replace(/^(quelques|plusieurs)\s+/i, "")
    .replace(/^petit morceau de\s+/i, "")
    .replace(/^morceau de\s+/i, "")
    .replace(/^feuille d['’]infusion encore humides$/i, "feuilles d’infusion encore humides")
    .replace(/\s+/g, " ")
    .replace(/[.!?;:]+$/g, "")
    .replace(/^symbole sacre$/i, "symbole sacré")
    .replace(/^gousse ail$/i, "gousse d’ail")
    .replace(/^poudre argent$/i, "poudre d’argent")
    .replace(/^eau benite$/i, "eau bénite")
    .replace(/^eau maudite$/i, "eau maudite")
    .trim();
}

function isExactNoise(value) {
  const n = norm(value);
  return [
    "true", "false", "oui", "non", "consomme", "non consomme", "nonconsomme", "optionnel", "manuel", "manuel du joueur", "manuel des joueurs",
    "source", "aucun", "null", "undefined", "a completer", "liquide", "liquide consomme", "consommation", "clerc", "clerc non mauvais",
    "clerc mauvais", "creature", "createur", "dons", "don", "dons requis", "don requis", "dons eventuellement requis", "don eventuellement requis",
    "sorte de diapason"
  ].includes(n);
}

function isInstructionOrNote(value) {
  const n = norm(value);
  if (!n) return true;
  if (/^-?\d+(?:[.,]\d+)?$/.test(n)) return true;
  if (isExactNoise(n)) return true;

  return /^(requi[st]e?s?|necessaire|alternative|variante|composant requis|ingredient materiel|formulation source|source du manuel|sort normal|sort inverse|liquide consomme|selon la regle|regle d arbitrage|la fiole est|son contenu est|disparait quand|disparait quand|aux\b|au\b|a la\b|a l\b|cette methode|ce procede|places?\b|placees?\b|ajoutee?\b|ajoutes?\b|clerc le lance|le lance|lance en meme temps|lance une priere|dons? requis|dons? eventuellement requis|si\b|type de metal|taille determine|taille determinent|plan d arrivee|plan d arrive|sorte de diapason|non mauvais|mauvais\b)\b/.test(n)
    || /\b(manuel des joueurs|formulation source|regle d arbitrage add2e|règle d’arbitrage add2e|ayant servi|avant consommation|quand le sort est lance|quand le sort est lancé|est tentee|est tentée|est tente|est tenté|divination puissante|dons requis|dons eventuellement requis|determin(e|ent|ant)|determine le plan|determine l arrivee|disparait|disparaît|quand le sort|lance en meme temps|lancé en même temps|clerc non mauvais|clerc mauvais)\b/.test(n);
}

function isSuspiciousFinalComponent(value) {
  const label = normalizeLabel(value);
  const n = norm(label);
  if (!label || isInstructionOrNote(label)) return true;
  if (/[.!?;:]/.test(label)) return true;
  if (wordCount(label) > 9) return true;
  if (/\b(requiert|necessite|nécessite|requis|requise|requis[e]?|determine|détermine|tent[eé]e?|lance|lanc[eé]|dispara[iî]t|plac[eé]e?|ajout[eé]e?|consomm[eé]|doit|peut|plan d['’]arriv[eé]e|taille|type de m[eé]tal)\b/i.test(label)) return true;
  if (/^(aux|au|a la|à la|a l['’]|à l['’]|cette|ce|ces|dons?|sort|clerc|creature|créature)\b/i.test(label)) return true;
  return false;
}

function splitNameAndNote(value) {
  const raw = text(value);
  const match = raw.match(/\b(?:optionnel|alternative\s*:|ingr[eé]dient\s+mat[eé]riel|consomm[eé]|consomme|non[_\s-]*consomm[eé]|formulation\s+source|manuel\s+(?:du|des)\s+joueurs?|source\s*:|r[eé]f[eé]rence\s*:|r[eè]gle\s+d['’]arbitrage|selon\s+la\s+r[eè]gle|requi[st]e?s?\s+pour|sort\s+normal|sort\s+invers[eé]|clerc\s+le\s+lance|dispara[iî]t\s+quand|quand\s+le\s+sort\s+est\s+lanc[eé]|dons?\s+requis|dons?\s+[eé]ventuellement\s+requis|type\s+de\s+m[eé]tal|taille\s+d[eé]termine|taille\s+d[eé]terminent|sorte\s+de\s+diapason|clerc\s+non\s+mauvais|clerc\s+mauvais).*$/i);
  if (!match) return { name: raw, note: "" };
  const idx = match.index ?? raw.length;
  return {
    name: raw.slice(0, idx).replace(/[,;:\s]+$/g, "").trim(),
    note: raw.slice(idx).replace(/^[,;:\s]+/g, "").trim()
  };
}

function addNote(notes, value) {
  const note = text(value);
  if (!note) return;
  if (notes.some(existing => slug(existing) === slug(note))) return;
  notes.push(note);
}

function addUnique(list, value) {
  const label = normalizeLabel(value);
  if (!label || isSuspiciousFinalComponent(label)) return;
  const key = slug(label);
  if (!key) return;

  for (let i = list.length - 1; i >= 0; i -= 1) {
    const existing = list[i];
    const existingKey = slug(existing);
    if (existingKey === key) return;
    if (existingKey && key.includes(existingKey) && wordCount(label) <= 9) {
      list.splice(i, 1);
      continue;
    }
    if (existingKey && existingKey.includes(key)) return;
  }

  list.push(label);
}

function extractComponentFromNoise(value) {
  const raw = text(value);
  const match = raw.match(/\b(?:requiert|n[eé]cessite)\s+(?:aussi\s+)?(?:un|une|des|du|de la|de l['’])\s+(.+)$/i);
  if (!match) return "";
  return match[1]
    .replace(/[,;:]\s*(?:plac[eé]e?s?|ajout[eé]e?s?|ayant servi|avant consommation).*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitMaterialAlternatives(value) {
  const raw = text(value);
  if (!raw) return [];
  return raw
    .split(/\s+ou\s+(?:des\s+|de la\s+|du\s+|de l['’]\s+|d['’]\s+|un\s+|une\s+)?/i)
    .map(normalizeLabel)
    .filter(Boolean);
}

function collect(value, names, notes) {
  if (value === undefined || value === null || value === "") return;

  if (Array.isArray(value)) {
    for (const entry of value) collect(entry, names, notes);
    return;
  }

  if (typeof value === "object") {
    for (const key of ["note", "notes", "condition", "conditions", "description", "source", "reference", "formulation_source", "source_text"]) {
      if (value[key]) addNote(notes, value[key]);
    }
    const alternatives = value.alternatives ?? value.options ?? value.choix ?? value.auChoix ?? value.or;
    if (Array.isArray(alternatives) && alternatives.length) {
      const alt = [];
      for (const entry of alternatives) collect(entry, alt, notes);
      for (const entry of alt) addUnique(names, entry);
      return;
    }
    const direct = value.nom ?? value.name ?? value.label ?? value.item ?? value.itemName ?? value.component ?? value.composant ?? value.slug ?? value.id;
    if (direct !== undefined && text(direct)) {
      collect(direct, names, notes);
      return;
    }
    for (const [key, entry] of Object.entries(value)) {
      if (["quantite", "quantity", "qty", "nombre", "count", "consomme", "consume", "consumption", "consommation", "source", "reference", "note", "notes", "description", "condition", "conditions"].includes(key)) continue;
      collect(entry, names, notes);
    }
    return;
  }

  const raw = text(value);
  const { name, note } = splitNameAndNote(raw);
  if (note) addNote(notes, note);

  if (isInstructionOrNote(name)) {
    const extracted = extractComponentFromNoise(name || raw);
    if (extracted) addUnique(names, extracted);
    addNote(notes, raw);
    return;
  }

  for (const part of name.split(/[,;|\n]+/g).map(normalizeLabel).filter(Boolean)) {
    if (isInstructionOrNote(part)) {
      const extracted = extractComponentFromNoise(part);
      if (extracted) addUnique(names, extracted);
      addNote(notes, part);
      continue;
    }
    for (const alt of splitMaterialAlternatives(part)) {
      if (isInstructionOrNote(alt)) addNote(notes, alt);
      else addUnique(names, alt);
    }
  }
}

function ensureSystem(system) {
  for (const key of SYSTEM_KEYS) {
    if (Object.prototype.hasOwnProperty.call(system, key)) continue;
    if (["spellLists", "composants_materiels", "tags", "effectTags"].includes(key)) system[key] = [];
    else if (key === "effectProfile") system[key] = { version: EFFECT_PROFILE_VERSION, source: "canonical-system", effects: [] };
    else if (key === "composants_materiels_a_renseigner") system[key] = false;
    else system[key] = "";
  }
}

function normalizeMaterials(system) {
  const before = clone(system.composants_materiels ?? []);
  const names = [];
  const notes = [];
  collect(system.composants_materiels, names, notes);
  if (!names.length) collect(system.composants_materiels_objets, names, notes);
  if (!names.length) collect(system.composants_requis, names, notes);
  if (text(system.composants_materiels_note)) addNote(notes, system.composants_materiels_note);
  system.composants_materiels = names;
  system.composants_materiels_note = notes.join("\n");
  return { before, after: clone(names), notes: clone(notes), changed: JSON.stringify(before) !== JSON.stringify(names) };
}

function main() {
  const input = path.resolve(repoRoot, process.argv[2] || DEFAULT_INPUT);
  const output = path.resolve(repoRoot, process.argv[3] || DEFAULT_OUTPUT);
  const controlOutput = path.resolve(repoRoot, process.argv[4] || DEFAULT_CONTROL);
  if (!fs.existsSync(input)) throw new Error(`Fichier introuvable : ${input}`);

  const json = JSON.parse(fs.readFileSync(input, "utf8"));
  const items = getItems(json);
  const control = {
    version: VERSION,
    input: path.relative(repoRoot, input),
    output: path.relative(repoRoot, output),
    totalItems: items.length,
    spells: 0,
    changedSpells: 0,
    emptyMaterialSpells: 0,
    examples: [],
    watched: {},
    suspiciousMaterialComponents: [],
    sameSystemFieldsForAllSpells: true,
    canonicalFields: SYSTEM_KEYS
  };
  const expected = JSON.stringify([...SYSTEM_KEYS].sort());

  for (const item of items) {
    if (!item || String(item.type ?? item.system?.type ?? "") !== "sort") continue;
    item.system ??= {};
    ensureSystem(item.system);
    const result = normalizeMaterials(item.system);
    control.spells += 1;
    if (!item.system.composants_materiels.length) control.emptyMaterialSpells += 1;
    if (result.changed) {
      control.changedSpells += 1;
      if (control.examples.length < 40) control.examples.push({ name: item.name, before: result.before, after: result.after, notes: result.notes });
    }

    const suspicious = (item.system.composants_materiels ?? []).filter(isSuspiciousFinalComponent);
    if (suspicious.length) {
      control.suspiciousMaterialComponents.push({
        name: item.name,
        classe: item.system.classe,
        niveau: item.system.niveau,
        components: suspicious,
        allComponents: clone(item.system.composants_materiels)
      });
    }

    const key = slug(item.name ?? item.system.nom);
    if (WATCHED_NAMES.has(key)) control.watched[item.name] = { composants_materiels: clone(item.system.composants_materiels), note: item.system.composants_materiels_note };
    if (JSON.stringify(Object.keys(item.system).sort()) !== expected) control.sameSystemFieldsForAllSpells = false;
  }

  json.normalizedBy = VERSION;
  json.normalizedAt = new Date().toISOString();
  fs.writeFileSync(output, `${JSON.stringify(json, null, 2)}\n`, "utf8");
  fs.writeFileSync(controlOutput, `${JSON.stringify(control, null, 2)}\n`, "utf8");
  console.log(`[ADD2E][SPELL_MATERIALS_V3] ${control.spells} sort(s), ${control.changedSpells} modifié(s).`);
  console.log(`[ADD2E][SPELL_MATERIALS_V3] Suspicious: ${control.suspiciousMaterialComponents.length}`);
  console.log(`[ADD2E][SPELL_MATERIALS_V3] Output: ${path.relative(repoRoot, output)}`);
  console.log(`[ADD2E][SPELL_MATERIALS_V3] Control: ${path.relative(repoRoot, controlOutput)}`);
}

main();
