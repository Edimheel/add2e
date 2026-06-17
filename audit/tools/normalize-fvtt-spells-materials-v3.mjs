import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");

const VERSION = "2026-06-17-normalize-spell-materials-v3-merchant-safe-v4b";
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
  "marteau_spirituel", "divination", "exorcisme", "langage_des_plantes", "changement_de_plan", "communion", "dissipation_du_mal",
  "glyphe_de_garde", "vision_reelle", "orientation"
]);

const SPELL_MATERIAL_OVERRIDES = new Map(Object.entries({
  orientation: ["jeu d’objets divinatoires"],
  changement_de_plan: ["petite baguette fourchue métallique"],
  glyphe_de_garde: ["encens"],
  vision_reelle: ["safran", "graisse", "huile"],
  divination: ["encens", "symbole sacré du clerc"],
  marteau_spirituel: ["marteau de guerre normal"]
}));

const EXACT_NOISE = new Set([
  "", "true", "false", "oui", "non", "consomme", "non consomme", "non_consomme", "optionnel", "manuel", "manuel du joueur", "manuel des joueurs",
  "source", "aucun", "null", "undefined", "a completer", "à compléter", "liquide", "liquide consomme", "consommation",
  "clerc", "clerc non mauvais", "clerc mauvais", "creature", "créature", "petite creature", "petite créature", "createur", "créateur",
  "dons", "don", "dons requis", "don requis", "dons eventuellement requis", "dons éventuellement requis", "le", "la", "les",
  "en ivoire", "en os", "de runes gravees", "de runes gravées", "runes gravees", "runes gravées", "sous forme de batonnets", "sous forme de bâtonnets"
]);

const STARTS_NOISE = [
  "requise", "requis", "necessaire", "nécessaire", "alternative", "variante", "composant requis", "ingredient materiel", "ingrédient matériel",
  "formulation source", "source du manuel", "sort normal", "sort inverse", "sort inversé", "selon la regle", "selon la règle", "regle d arbitrage", "règle d’arbitrage",
  "la fiole", "son contenu", "disparait", "disparaît", "aux ", "au ", "a la ", "à la ", "a l'", "à l'", "a l’", "à l’",
  "en ", "sous forme", "de runes", "description indique", "cette methode", "cette méthode", "ce procede", "ce procédé", "place", "placée", "placées",
  "ajoute", "ajoutée", "ajoutées", "pour lancer le sort", "clerc le lance", "le lance", "lance en meme temps", "lance en même temps", "lance une priere", "lance une prière",
  "dons requis", "dons eventuellement requis", "dons éventuellement requis", "si ", "type de metal", "type de métal", "taille determine", "taille détermine",
  "taille determinent", "taille déterminent", "plan d arrivee", "plan d’arrivée", "sorte de diapason", "non mauvais", "mauvais"
];

const CONTAINS_NOISE = [
  "manuel des joueurs", "formulation source", "regle d arbitrage add2e", "règle d’arbitrage add2e", "ayant servi", "avant consommation",
  "quand le sort est lance", "quand le sort est lancé", "est tentee", "est tentée", "est tente", "est tenté", "divination puissante",
  "dons requis", "dons eventuellement requis", "dons éventuellement requis", "determine le plan", "détermine le plan", "determine l arrivee", "détermine l’arrivée",
  "disparait", "disparaît", "quand le sort", "lance en meme temps", "lancé en même temps", "clerc non mauvais", "clerc mauvais", "description indique", "saupoudree", "saupoudrée",
  "pour lancer le sort"
];

function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
function text(value) { return String(value ?? "").replace(/\s+/g, " ").trim(); }
function norm(value) {
  return text(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function slug(value) { return norm(value).replace(/\s+/g, "_"); }
function wordCount(value) { return norm(value).split(" ").filter(Boolean).length; }

function getItems(json) {
  if (Array.isArray(json)) return json;
  for (const key of ["items", "Item", "Items", "documents", "data", "entries"]) if (Array.isArray(json?.[key])) return json[key];
  return [];
}

function normalizeLabel(value) {
  let out = text(value).replaceAll("_", "-").replace(/-/g, " ");
  out = out.replace(/^(jeu d[’']objets divinatoires) en (os|ivoire)$/i, "$1");
  out = out.replace(/^d['’]\s*/i, "");
  out = out.replace(/^(un|une)?\s*peu\s+de\s+/i, "");
  out = out.replace(/^(un|une|du|de la|de l['’]?|des|le|la|les)\s+/i, "");
  out = out.replace(/^(quelques|plusieurs)\s+/i, "");
  out = out.replace(/^petit morceau de\s+/i, "");
  out = out.replace(/^morceau de\s+/i, "");
  out = out.replace(/^feuille d['’]infusion encore humides$/i, "feuilles d’infusion encore humides");
  out = out.replace(/[.!?;:]+$/g, "").replace(/\s+/g, " ").trim();
  out = out.replace(/^symbole sacre$/i, "symbole sacré");
  out = out.replace(/^gousse ail$/i, "gousse d’ail");
  out = out.replace(/^poudre argent$/i, "poudre d’argent");
  out = out.replace(/^eau benite$/i, "eau bénite");
  out = out.replace(/^eau maudite$/i, "eau maudite");
  return out;
}

function hasNoisePrefix(clean, normalized) {
  const lower = clean.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  for (const prefix of STARTS_NOISE) {
    const rawPrefix = String(prefix).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (rawPrefix.endsWith(" ")) {
      if (lower.startsWith(rawPrefix)) return true;
      continue;
    }
    if (normalized.startsWith(norm(prefix))) return true;
  }
  return false;
}

function isNoise(value) {
  const raw = text(value);
  const clean = normalizeLabel(raw);
  const n = norm(clean);
  if (!n) return true;
  if (EXACT_NOISE.has(n) || EXACT_NOISE.has(clean.toLowerCase())) return true;
  if (/^\d+(?:[,.]\d+)?\s*(m2|m|m²|case|cases|po|pa|pp|pc)?$/i.test(clean)) return true;
  if (hasNoisePrefix(clean, n)) return true;
  if (CONTAINS_NOISE.some(part => n.includes(norm(part)))) return true;
  return false;
}

function isSuspiciousFinalComponent(value) {
  const clean = normalizeLabel(value);
  if (!clean || isNoise(clean)) return true;
  if (/[.!?;:]/.test(clean)) return true;
  if (wordCount(clean) > 9) return true;
  const n = norm(clean);
  return ["requiert", "necessite", "nécessite", "requis", "requise", "determine", "détermine", "tente", "tenté", "tentée", "lance", "lancé", "disparait", "disparaît", "place", "ajoute", "consomme", "consommé", "doit", "peut", "taille", "type de metal", "type de métal", "description"].some(v => n.includes(norm(v)));
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
    const existingKey = slug(list[i]);
    if (existingKey === key) return;
    if (key.includes(existingKey) && wordCount(label) <= 9) list.splice(i, 1);
    else if (existingKey.includes(key)) return;
  }
  list.push(label);
}

function splitTechnicalNote(raw) {
  const lower = raw.toLowerCase();
  const markers = [
    " optionnel", " alternative", " ingrédient matériel", " ingredient materiel", " consomm", " formulation source", " manuel des joueurs",
    " source:", " référence:", " reference:", " règle d", " regle d", " requise pour", " requis pour", " sort normal", " sort inversé",
    " description indique", " clerc le lance", " disparaît quand", " disparait quand", " dons requis", " dons éventuellement requis", " type de métal", " taille détermine",
    " sorte de diapason", " clerc non mauvais", " clerc mauvais", " pour lancer le sort"
  ];
  let index = -1;
  for (const marker of markers) {
    const i = lower.indexOf(marker);
    if (i >= 0 && (index < 0 || i < index)) index = i;
  }
  if (index < 0) return { name: raw, note: "" };
  return { name: raw.slice(0, index).replace(/[,;:\s]+$/g, "").trim(), note: raw.slice(index).trim() };
}

function extractComponentFromNoise(value) {
  const raw = text(value);
  if (/^cr[eè]me\s+faite\s+d['’]huile$/i.test(raw)) return "huile";
  const lower = raw.toLowerCase();
  for (const verb of ["requiert ", "nécessite ", "necessite "]) {
    const idx = lower.indexOf(verb);
    if (idx < 0) continue;
    let tail = raw.slice(idx + verb.length).replace(/^(aussi\s+)?(un|une|des|du|de la|de l['’])\s+/i, "");
    tail = tail.replace(/[,;:]\s*(plac[eé]e?s?|ajout[eé]e?s?|ayant servi|avant consommation).*$/i, "").trim();
    return tail;
  }
  return "";
}

function splitAlternatives(value) {
  return text(value)
    .split(/\s+ou\s+(?:des\s+|de la\s+|du\s+|de l['’]\s+|d['’]\s+|un\s+|une\s+)?/i)
    .map(normalizeLabel)
    .filter(Boolean);
}

function splitAndList(value) {
  const raw = text(value);
  const m = raw.match(/^de\s+(.+?)\s+et\s+de\s+(.+)$/i) || raw.match(/^(.+?)\s+et\s+de\s+(.+)$/i) || raw.match(/^(.+?)\s+et\s+(.+)$/i);
  return m ? [normalizeLabel(m[1]), normalizeLabel(m[2])].filter(Boolean) : [];
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
      for (const entry of alternatives) collect(entry, names, notes);
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
  const { name, note } = splitTechnicalNote(raw);
  if (note) addNote(notes, note);

  const pieces = name.split(/[,;|\n]+/g).map(normalizeLabel).filter(Boolean);
  for (const piece of pieces) {
    const andParts = splitAndList(piece);
    if (andParts.length) {
      for (const entry of andParts) addUnique(names, entry);
      continue;
    }
    if (isNoise(piece)) {
      const extracted = extractComponentFromNoise(piece || raw);
      if (extracted) addUnique(names, extracted);
      addNote(notes, piece);
      continue;
    }
    for (const alt of splitAlternatives(piece)) {
      if (isNoise(alt)) addNote(notes, alt);
      else addUnique(names, alt);
    }
  }
}

function applySpellOverride(item, system, notes) {
  const key = slug(item?.name ?? system?.nom);
  const override = SPELL_MATERIAL_OVERRIDES.get(key);
  if (!override) return false;
  addNote(notes, `Normalisation marchand appliquée : ${system.composants_materiels.join(", ")}`);
  system.composants_materiels = clone(override);
  return true;
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

function normalizeMaterials(item) {
  const system = item.system ?? {};
  const before = clone(system.composants_materiels ?? []);
  const names = [];
  const notes = [];
  collect(system.composants_materiels, names, notes);
  if (!names.length) collect(system.composants_materiels_objets, names, notes);
  if (!names.length) collect(system.composants_requis, names, notes);
  if (text(system.composants_materiels_note)) addNote(notes, system.composants_materiels_note);
  system.composants_materiels = names;
  applySpellOverride(item, system, notes);
  system.composants_materiels_note = notes.join("\n");
  return { before, after: clone(system.composants_materiels), notes: clone(notes), changed: JSON.stringify(before) !== JSON.stringify(system.composants_materiels) };
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
    const result = normalizeMaterials(item);
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
