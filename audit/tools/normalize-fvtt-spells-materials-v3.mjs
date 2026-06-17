import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");

const VERSION = "2026-06-17-normalize-spell-materials-v3-clerc-n2-effectprofile-v1";
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
  "glyphe_de_garde", "vision_reelle", "orientation", "detection_des_charmes", "detection_des_pieges", "langage_animal",
  "cantique", "charme_serpents", "silence_sur_5_metres", "perception_des_alignements", "resistance_au_feu"
]);

const SPELL_MATERIAL_OVERRIDES = new Map(Object.entries({
  orientation: ["jeu d’objets divinatoires"],
  changement_de_plan: ["petite baguette fourchue métallique"],
  glyphe_de_garde: ["encens"],
  vision_reelle: ["safran", "graisse", "huile"],
  divination: ["encens", "symbole sacré du clerc"],
  marteau_spirituel: ["marteau de guerre normal"],
  augure: ["jeu d’objets divinatoires", "feuilles d’infusion encore humides", "perle écrasée d’au moins 100 po"],
  paralysie: ["petite tige de métal droite et rigide"],
  resistance_au_feu: ["goutte de mercure"],
  retardement_du_poison: ["symbole sacré du clerc", "gousse d’ail"]
}));

const CANONICAL_MATERIALS = new Map(Object.entries({
  symbole_sacre: "symbole sacré du clerc",
  symbole_sacre_du_clerc: "symbole sacré du clerc",
  objet_divinatoire_similaire: "jeu d’objets divinatoires",
  objets_divinatoires_similaires: "jeu d’objets divinatoires",
  jeu_d_objets_divinatoires: "jeu d’objets divinatoires",
  jeu_objets_divinatoires: "jeu d’objets divinatoires",
  jeu_de_baguettes_serties_de_gemmes: "jeu d’objets divinatoires",
  os_de_dragon: "jeu d’objets divinatoires",
  feuille_d_infusion_encore_humide: "feuilles d’infusion encore humides",
  feuille_d_infusion_encore_humides: "feuilles d’infusion encore humides",
  feuilles_d_infusion_encore_humide: "feuilles d’infusion encore humides",
  feuilles_d_infusion_encore_humides: "feuilles d’infusion encore humides",
  objet_similaire_au_chapelet_de_priere: "chapelet de prière",
  objet_similaire_au_chapelet_de_prière: "chapelet de prière",
  objet_similaire_ayant_la_meme_utilisation: "chapelet de prière",
  objet_similaire_ayant_la_même_utilisation: "chapelet de prière",
  livre_de_priere: "livre de prière",
  livre_de_prière: "livre de prière",
  gousse_ail: "gousse d’ail",
  gousse_d_ail: "gousse d’ail",
  poudre_argent: "poudre d’argent",
  poudre_d_argent: "poudre d’argent",
  eau_benite: "eau bénite",
  eau_bénite: "eau bénite",
  eau_maudite: "eau maudite"
}));

const CLERIC_LEVEL_2_EFFECT_PROFILES = new Map(Object.entries({
  detection_des_charmes: [
    {
      id: "detection_charme",
      label: "Détection des charmes",
      kind: "detection",
      targetOverride: "une_creature_a_la_fois_jusqua_10",
      automation: "mj_aid",
      tags: ["effet:detection_des_charmes", "detection:charme", "limite:10_creatures", "duree:1_tour"],
      notes: "Détermine si une personne ou un monstre est sous l’influence d’un charme."
    },
    {
      id: "dissimulation_charme",
      label: "Dissimulation des charmes",
      kind: "protection_detection",
      targetOverride: "une_creature",
      automation: "active_effect_or_mj_aid",
      tags: ["effet:dissimulation_des_charmes", "protection:detection_charme", "inverse"],
      notes: "Effet inverse protégeant une créature contre la détection des charmes."
    }
  ],
  augure: [
    {
      id: "presage_benefique_malefique",
      label: "Augure",
      kind: "divination",
      targetOverride: "action_future_immediate",
      automation: "mj_aid",
      tags: ["effet:augure", "divination:benefique_malefique", "chance:70_plus_1_pct_par_niveau", "fenetre:3_tours"],
      notes: "Indique si une action dans le futur immédiat sera bénéfique ou maléfique, avec chance de base 70 % + 1 % par niveau du clerc."
    }
  ],
  detection_des_pieges: [
    {
      id: "detection_pieges_directionnelle",
      label: "Détection des pièges",
      kind: "detection",
      targetOverride: "direction_1_pouce_de_large",
      automation: "mj_aid",
      tags: ["effet:detection_des_pieges", "detection:piege", "directionnel", "chance:type_magie:10_pct_par_niveau"],
      notes: "Révèle les pièges mécaniques ou magiques dans la direction regardée ; type de magie détectable à 10 % par niveau."
    }
  ],
  langage_animal: [
    {
      id: "communication_animaux",
      label: "Langage animal",
      kind: "communication",
      targetOverride: "animal_dans_un_rayon_de_3_pouces",
      automation: "mj_aid",
      tags: ["effet:langage_animal", "communication:animal", "reaction:animal", "exclusion:monstres"],
      notes: "Permet de parler avec un animal doté d’un esprit ; réactions et services éventuels sous arbitrage MJ."
    }
  ],
  cantique: [
    {
      id: "bonus_allies_cantique",
      label: "Cantique — alliés",
      kind: "active_bonus",
      targetOverride: "amis_dans_rayon_3_pouces",
      automation: "active_effect_or_mj_aid",
      tags: ["effet:cantique", "bonus:toucher:1", "bonus:degats:1", "bonus:jp:1", "condition:clerc_chante_immobile"],
      notes: "Les alliés du clerc gagnent +1 aux attaques, dégâts et jets de protection tant que le clerc chante et reste immobile."
    },
    {
      id: "malus_ennemis_cantique",
      label: "Cantique — ennemis",
      kind: "active_malus",
      targetOverride: "ennemis_dans_rayon_3_pouces",
      automation: "active_effect_or_mj_aid",
      tags: ["effet:cantique", "malus:toucher:1", "malus:degats:1", "malus:jp:1", "condition:clerc_chante_immobile"],
      notes: "Les ennemis subissent -1 aux attaques, dégâts et jets de protection tant que le clerc chante et reste immobile."
    }
  ],
  marteau_spirituel: [
    {
      id: "arme_force_marteau",
      label: "Marteau spirituel",
      kind: "summoned_weapon",
      targetOverride: "un_ennemi_dans_la_portee",
      automation: "attack_or_mj_aid",
      tags: ["effet:marteau_spirituel", "arme:force", "degats:1d6_pm", "degats:1d4_g", "concentration", "arme_magique:plus_1_par_3_niveaux_pour_creatures"],
      notes: "Crée un champ de force en forme de marteau ; frappe au niveau du clerc, sans bonus au toucher ni aux dégâts, mais compte comme arme magique pour toucher certaines créatures."
    }
  ],
  charme_serpents: [
    {
      id: "charme_ophidiens",
      label: "Charme-serpents",
      kind: "control",
      targetOverride: "serpents_ou_ophidiens",
      savingThrow: { type: "special", condition: "résistance à la magie et jets de protection selon créature" },
      automation: "mj_aid",
      tags: ["effet:charme_serpents", "controle:serpents", "limite:pv_serpents_inferieurs_ou_egaux_pv_clerc", "duree:selon_etat_serpents"],
      notes: "Calme ou charme des serpents dont le total de points de vie n’excède pas ceux du clerc ; durée selon leur état."
    }
  ],
  paralysie: [
    {
      id: "immobilisation_humanoides",
      label: "Paralysie",
      kind: "control",
      targetOverride: "1_a_3_humains_ou_humanoides",
      savingThrow: { type: "sorts", condition: "annule ; malus -2 si une cible, -1 si deux cibles, normal si trois cibles" },
      automation: "active_effect_or_mj_aid",
      tags: ["effet:paralysie", "etat:paralyse", "cibles:1_3", "duree:4_rounds_plus_1_par_niveau", "jp:annule"],
      notes: "Immobilise 1 à 3 humains ou humanoïdes ; les cibles qui réussissent leur jet ne ressentent aucun effet."
    }
  ],
  silence_sur_5_metres: [
    {
      id: "zone_silence",
      label: "Silence sur 5 mètres",
      kind: "area_silence",
      targetOverride: "sphere_9m_diametre",
      savingThrow: { type: "special", condition: "si lancé sur une créature non consentante" },
      automation: "active_effect_or_mj_aid",
      tags: ["effet:silence", "zone:sphere_9m", "bloque:bruit", "bloque:composante_verbale", "duree:2_rounds_par_niveau"],
      notes: "Crée une zone de silence empêchant conversation, bruit et sorts à composante verbale ; la zone peut suivre un objet ou une créature."
    }
  ],
  perception_des_alignements: [
    {
      id: "lecture_alignement",
      label: "Perception des alignements",
      kind: "detection",
      targetOverride: "une_creature_par_round_jusqua_10",
      automation: "mj_aid",
      tags: ["effet:perception_des_alignements", "detection:alignement", "limite:10_creatures", "duree:1_tour"],
      notes: "Permet de connaître l’alignement exact d’une personne ou créature, une cible par round jusqu’à dix."
    },
    {
      id: "confusion_alignement",
      label: "Confusion de l’alignement",
      kind: "protection_detection",
      automation: "active_effect_or_mj_aid",
      tags: ["effet:confusion_alignement", "protection:detection_alignement", "inverse"],
      notes: "Effet inverse cachant totalement l’alignement pendant la durée indiquée."
    }
  ],
  resistance_au_feu: [
    {
      id: "resistance_feu",
      label: "Résistance au feu",
      kind: "resistance",
      targetOverride: "creature_touchee",
      automation: "active_effect_or_mj_aid",
      tags: ["effet:resistance_au_feu", "resistance:feu", "bonus:jp:feu:3", "degats:feu:moitie_si_jp_rate", "degats:feu:quart_si_jp_reussi"],
      notes: "Protège contre chaleur et feu ; bonus de +3 au jet de protection, dégâts réduits à la moitié si le jet échoue et au quart s’il réussit."
    }
  ],
  retardement_du_poison: [
    {
      id: "ralentissement_poison",
      label: "Retardement du poison",
      kind: "poison_delay",
      targetOverride: "creature_touchee",
      automation: "active_effect_or_mj_aid",
      tags: ["effet:retardement_du_poison", "poison:ralenti", "perte:1_pv_par_tour", "minimum:1_pv", "duree:1_heure_par_niveau"],
      notes: "Ralentit fortement le poison ; la victime perd 1 PV par tour sans descendre sous 1 PV."
    },
    {
      id: "rappel_temporaire_mort_poison",
      label: "Rappel temporaire après poison",
      kind: "revival_temporary",
      automation: "mj_aid",
      tags: ["effet:retardement_du_poison", "mort:poison", "fenetre:1_tour_par_niveau"],
      notes: "Peut temporairement sauver une personne morte par poison si lancé dans la limite d’un tour par niveau du clerc."
    }
  ]
}));

CLERIC_LEVEL_2_EFFECT_PROFILES.set("detection_de_charme", CLERIC_LEVEL_2_EFFECT_PROFILES.get("detection_des_charmes"));
CLERIC_LEVEL_2_EFFECT_PROFILES.set("dissimulation_des_charmes", CLERIC_LEVEL_2_EFFECT_PROFILES.get("detection_des_charmes"));
CLERIC_LEVEL_2_EFFECT_PROFILES.set("detection_de_pieges", CLERIC_LEVEL_2_EFFECT_PROFILES.get("detection_des_pieges"));
CLERIC_LEVEL_2_EFFECT_PROFILES.set("silence_sur_5_m", CLERIC_LEVEL_2_EFFECT_PROFILES.get("silence_sur_5_metres"));
CLERIC_LEVEL_2_EFFECT_PROFILES.set("silence_sur_5_metre", CLERIC_LEVEL_2_EFFECT_PROFILES.get("silence_sur_5_metres"));
CLERIC_LEVEL_2_EFFECT_PROFILES.set("perception_de_l_alignement", CLERIC_LEVEL_2_EFFECT_PROFILES.get("perception_des_alignements"));
CLERIC_LEVEL_2_EFFECT_PROFILES.set("detection_des_alignements", CLERIC_LEVEL_2_EFFECT_PROFILES.get("perception_des_alignements"));
CLERIC_LEVEL_2_EFFECT_PROFILES.set("detection_de_l_alignement", CLERIC_LEVEL_2_EFFECT_PROFILES.get("perception_des_alignements"));

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
function canonicalMaterial(value) { return CANONICAL_MATERIALS.get(slug(value)) ?? value; }
function spellLevel(system = {}) {
  const m = String(system.niveau ?? system.niveau_sort ?? system.level ?? "").match(/\d+/);
  return m ? Number(m[0]) || 0 : 0;
}
function spellLists(system = {}) {
  const raw = Array.isArray(system.spellLists) ? system.spellLists : String(system.spellLists ?? system.classe ?? "").split(/[,;|/]+/g);
  return raw.map(slug).filter(Boolean);
}
function isClercLevel2(item) {
  const system = item?.system ?? {};
  return spellLevel(system) === 2 && (slug(system.classe).includes("clerc") || spellLists(system).includes("clerc"));
}

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
  return canonicalMaterial(out);
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
  system.composants_materiels = clone(override).map(normalizeLabel);
  return true;
}

function effectProfile(effects, source = "manual-normalized-clerc-n2") {
  return { version: EFFECT_PROFILE_VERSION, source, effects: clone(effects) };
}

function applyEffectProfileOverride(item) {
  const system = item.system ?? {};
  const key = slug(item?.name ?? system.nom);
  const effects = CLERIC_LEVEL_2_EFFECT_PROFILES.get(key);
  if (!effects || !isClercLevel2(item)) return { applied: false, changed: false };
  const next = effectProfile(effects);
  const before = JSON.stringify(system.effectProfile ?? {});
  system.effectProfile = next;
  return { applied: true, changed: before !== JSON.stringify(next) };
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
  system.composants_materiels = names.map(normalizeLabel);
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
    changedEffectProfiles: 0,
    emptyMaterialSpells: 0,
    examples: [],
    watched: {},
    suspiciousMaterialComponents: [],
    clercLevel2EffectProfiles: {
      applied: [],
      missing: [],
      expectedAliases: [...CLERIC_LEVEL_2_EFFECT_PROFILES.keys()].sort()
    },
    sameSystemFieldsForAllSpells: true,
    canonicalFields: SYSTEM_KEYS
  };
  const expected = JSON.stringify([...SYSTEM_KEYS].sort());

  for (const item of items) {
    if (!item || String(item.type ?? item.system?.type ?? "") !== "sort") continue;
    item.system ??= {};
    ensureSystem(item.system);
    const result = normalizeMaterials(item);
    const profile = applyEffectProfileOverride(item);
    control.spells += 1;
    if (!item.system.composants_materiels.length) control.emptyMaterialSpells += 1;
    if (result.changed) {
      control.changedSpells += 1;
      if (control.examples.length < 40) control.examples.push({ name: item.name, before: result.before, after: result.after, notes: result.notes });
    }
    if (profile.changed) control.changedEffectProfiles += 1;
    if (isClercLevel2(item)) {
      if (profile.applied) control.clercLevel2EffectProfiles.applied.push(item.name);
      else control.clercLevel2EffectProfiles.missing.push(item.name);
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
    if (WATCHED_NAMES.has(key)) {
      control.watched[item.name] = {
        composants_materiels: clone(item.system.composants_materiels),
        effectProfile: clone(item.system.effectProfile),
        note: item.system.composants_materiels_note
      };
    }
    if (JSON.stringify(Object.keys(item.system).sort()) !== expected) control.sameSystemFieldsForAllSpells = false;
  }

  json.normalizedBy = VERSION;
  json.normalizedAt = new Date().toISOString();
  fs.writeFileSync(output, `${JSON.stringify(json, null, 2)}\n`, "utf8");
  fs.writeFileSync(controlOutput, `${JSON.stringify(control, null, 2)}\n`, "utf8");
  console.log(`[ADD2E][SPELL_MATERIALS_V3] ${control.spells} sort(s), ${control.changedSpells} composant(s) modifié(s).`);
  console.log(`[ADD2E][SPELL_MATERIALS_V3] EffectProfiles N2 clerc: ${control.clercLevel2EffectProfiles.applied.length} appliqué(s), ${control.clercLevel2EffectProfiles.missing.length} manquant(s).`);
  console.log(`[ADD2E][SPELL_MATERIALS_V3] Suspicious: ${control.suspiciousMaterialComponents.length}`);
  console.log(`[ADD2E][SPELL_MATERIALS_V3] Output: ${path.relative(repoRoot, output)}`);
  console.log(`[ADD2E][SPELL_MATERIALS_V3] Control: ${path.relative(repoRoot, controlOutput)}`);
}

main();
