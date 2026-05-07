/*
 * ADD2E — Moine : Paume mortelle
 * Crée / met à jour une arme temporaire visible dans l'onglet Combat.
 * Script exécuté via on_use d'une classFeature.
 * Paramètres attendus par le lanceur : actor, item, sort.
 */
const ADD2E_MOINE_PAUME_MORTELLE_VERSION = "2026-05-03-v3-combat-only";

globalThis.ADD2E_MOINE_PAUME_MORTELLE_VERSION = ADD2E_MOINE_PAUME_MORTELLE_VERSION;

function a2eNorm(v) {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[\s-]+/g, "_");
}

function a2eNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function a2eGetMonkRow(actor) {
  const level = Math.max(1, a2eNum(actor?.system?.niveau, 1));

  const rows =
    actor?.system?.details_classe?.monkProgression ??
    actor?.system?.details_classe?.progression ??
    actor?.system?.monkProgression ??
    [];

  if (!Array.isArray(rows)) return null;

  return rows.find(r => Number(r?.niveau ?? r?.level) === level)
    ?? rows.slice().reverse().find(r => Number(r?.niveau ?? r?.level ?? 0) <= level)
    ?? null;
}

function a2eDamageParts(raw) {
  const text = String(raw ?? "1d6/1d3").trim();
  const [moyen, grand] = text.split("/").map(s => String(s ?? "").trim()).filter(Boolean);
  return {
    raw: text,
    moyen: moyen || text,
    grand: grand || moyen || text
  };
}

if (!actor) {
  ui.notifications.error("Paume mortelle : acteur introuvable.");
  return false;
}

if (!game.combat) {
  ui.notifications.warn("Paume mortelle ne peut être préparée que pendant un combat actif.");
  return false;
}

const row = a2eGetMonkRow(actor);
const level = Math.max(1, a2eNum(actor.system?.niveau, 1));

if (!row?.quiveringPalm) {
  ui.notifications.warn("Paume mortelle indisponible à ce niveau.");
  return false;
}

const combatKey = game.combat.id;
const flagKey = `paumeMortelle.${combatKey}`;
const alreadyPrepared = actor.getFlag("add2e", flagKey);

if (alreadyPrepared?.prepared === true) {
  ui.notifications.warn("La Paume mortelle est déjà préparée pour ce combat.");
  return false;
}

const damage = a2eDamageParts(
  actor.system?.moine?.main_nue ??
  row?.unarmedDamage ??
  row?.main_nue ??
  row?.damage ??
  "1d6/1d3"
);

const img = "icons/skills/melee/strike-palm-light-orange.webp";

const system = {
  nom: "Paume mortelle",
  degats: damage.raw,
  "dégâts": {
    contre_moyen: damage.moyen,
    contre_grand: damage.grand
  },
  type_degats: "contondant",
  type_arme: "main_nue",
  famille_arme: "main_nue",
  proprietes: "Corps à corps, Contondant, Naturelle, Moine, Temporaire, Paume mortelle",
  equipee: true,
  equipped: true,
  bonus_toucher: 0,
  bonus_hit: 0,
  bonus_degats: 0,
  bonus_dom: 0,
  poids: 0,
  portee_short: null,
  portee_long: null,
  tags: [
    "arme",
    "arme:paume_mortelle",
    "type_arme:main_nue",
    "famille_arme:main_nue",
    "degat:contondant",
    "usage:corps_a_corps",
    "combat:mains_nues",
    "classe:moine",
    "moine:paume_mortelle",
    "combat:arme_temporaire",
    "usage_unique"
  ],
  effectTags: [
    "moine:paume_mortelle",
    "combat:arme_temporaire",
    "usage_unique"
  ],
  add2eAutoCreated: true,
  sourceClasse: "moine",
  sourceCapacite: "paume_mortelle",
  niveauMoine: level,
  uses: {
    value: 1,
    max: 1,
    per: "combat"
  },
  description: "Arme temporaire créée par la capacité Paume mortelle du moine. Elle représente une seule tentative spéciale ; après la résolution de son attaque, elle est automatiquement supprimée de l’onglet Combat."
};

const existing = actor.items.find(i =>
  String(i.type || "").toLowerCase() === "arme" &&
  (
    a2eNorm(i.name) === "paume_mortelle" ||
    a2eNorm(i.system?.sourceCapacite) === "paume_mortelle"
  )
);

let weapon;
if (existing) {
  await existing.update({
    name: "Paume mortelle",
    img,
    system,
    flags: {
      add2e: {
        tags: ["moine:paume_mortelle", "combat:arme_temporaire", "usage_unique"],
        sourceClasse: "moine",
        sourceCapacite: "paume_mortelle",
        usageUnique: true,
        deleteAfterAttack: true
      }
    }
  }, { add2eInternal: true });
  weapon = existing;
} else {
  const created = await actor.createEmbeddedDocuments("Item", [{
    type: "arme",
    name: "Paume mortelle",
    img,
    system,
    flags: {
      add2e: {
        tags: ["moine:paume_mortelle", "combat:arme_temporaire", "usage_unique"],
        sourceClasse: "moine",
        sourceCapacite: "paume_mortelle",
        usageUnique: true,
        deleteAfterAttack: true
      }
    }
  }], { add2eInternal: true });
  weapon = created?.[0] ?? null;
}

await actor.setFlag("add2e", flagKey, {
  prepared: true,
  weaponId: weapon?.id ?? null,
  combatId: game.combat?.id ?? null,
  level,
  damage: damage.raw,
  at: Date.now()
});

await ChatMessage.create({
  speaker: ChatMessage.getSpeaker({ actor }),
  content: `
    <div class="add2e-chat-card">
      <h3>Paume mortelle</h3>
      <p><b>${actor.name}</b> prépare une tentative de Paume mortelle.</p>
      <p>Une arme temporaire <b>Paume mortelle</b> a été créée dans l’onglet Combat.</p>
      <p><b>Dégâts de base :</b> ${damage.raw}. <b>Usage :</b> 1 tentative pendant ce combat uniquement.</p>
    </div>
  `
});

ui.notifications.info("Paume mortelle prête : arme temporaire créée dans l’onglet Combat.");
return true;