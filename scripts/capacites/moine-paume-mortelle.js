/*
 * ADD2E — Moine : Paume mortelle
 * Crée / met à jour une arme temporaire visible dans l'onglet Combat.
 * Script exécuté via on_use d'une classFeature.
 * Paramètres attendus par le lanceur : actor, item, sort.
 */
const ADD2E_MOINE_PAUME_MORTELLE_VERSION = "2026-06-15-v6-compact-chat-card";
const ADD2E_MOINE_PAUME_MORTELLE_DAY_ROUNDS = 24 * 60;

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

function a2eEsc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function a2eChatStyleData() {
  if (CONST.CHAT_MESSAGE_STYLES) return { style: CONST.CHAT_MESSAGE_STYLES.OTHER };
  return { type: CONST.CHAT_MESSAGE_TYPES?.OTHER ?? 0 };
}

function a2eGetWorldTimeTick() {
  try {
    if (typeof game?.add2e?.time?.currentTick === "function") {
      return Math.max(0, Math.floor(Number(game.add2e.time.currentTick()) || 0));
    }
  } catch (_err) {}

  try {
    if (typeof globalThis.ADD2E_TIME_ENGINE?.currentTick === "function") {
      return Math.max(0, Math.floor(Number(globalThis.ADD2E_TIME_ENGINE.currentTick()) || 0));
    }
  } catch (_err) {}

  try {
    const value = Number(game?.settings?.get?.("add2e", "worldTimeTick"));
    if (Number.isFinite(value)) return Math.max(0, Math.floor(value));
  } catch (_err) {}

  return 0;
}

function a2eFormatRounds(rounds) {
  const value = Math.max(0, Math.ceil(Number(rounds) || 0));
  if (value <= 0) return "disponible";

  const hours = Math.floor(value / 60);
  const rest = value % 60;
  if (hours > 0 && rest > 0) return `${hours} heure(s) et ${rest} round(s)`;
  if (hours > 0) return `${hours} heure(s)`;
  return `${value} round(s)`;
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

function a2eFindPaumeMortelleWeapon(actor, weaponId = null) {
  if (!actor) return null;
  if (weaponId && actor.items?.get?.(weaponId)) return actor.items.get(weaponId);

  return actor.items?.find?.(i =>
    String(i.type || "").toLowerCase() === "arme" &&
    (
      a2eNorm(i.name) === "paume_mortelle" ||
      a2eNorm(i.system?.sourceCapacite) === "paume_mortelle" ||
      a2eNorm(i.flags?.add2e?.sourceCapacite) === "paume_mortelle"
    )
  ) ?? null;
}

function a2ePaumeMortelleChatCard({ actor, img, damage, currentTick, nextAvailableTick }) {
  const actorName = a2eEsc(actor?.name ?? "Acteur");
  const safeImg = a2eEsc(img || "icons/skills/melee/strike-palm-light-orange.webp");
  const safeDamage = a2eEsc(damage?.raw ?? "");
  return `
    <div class="add2e-chat-card add2e-paume-mortelle-card"
         style="border:1px solid #8a5a22;border-radius:8px;overflow:hidden;background:#fff8e7;color:#2f210d;font-family:var(--font-primary);font-size:13px;line-height:1.35;">
      <div style="display:flex;align-items:center;gap:8px;background:#5b2f14;color:#fff;padding:7px 9px;">
        <img src="${safeImg}" style="width:34px;height:34px;object-fit:cover;border-radius:4px;border:1px solid #d7b56d;background:#fff;" />
        <div style="flex:1;min-width:0;">
          <div style="font-weight:900;font-size:14px;line-height:1.1;">Paume mortelle</div>
          <div style="font-size:11px;opacity:.9;line-height:1.15;">Capacité de moine préparée</div>
        </div>
      </div>
      <div style="padding:8px 10px;background:#fff8e7;">
        <div style="background:#fff;border:1px solid #d6b66e;border-radius:6px;padding:7px 8px;">
          <div><b>${actorName}</b> prépare une tentative de <b>Paume mortelle</b>.</div>
          <div style="margin-top:4px;">Une arme temporaire a été créée dans l’onglet <b>Combat</b>.</div>
          <div style="margin-top:4px;"><b>Dégâts de base :</b> ${safeDamage}.</div>
          <div style="margin-top:4px;"><b>Usage :</b> 1 tentative par jour.</div>
        </div>
        <div style="margin-top:6px;font-size:11px;color:#6b4a1a;text-align:center;">
          Temps ADD2E : tick <b>${Number(currentTick) || 0}</b> → prochaine utilisation au tick <b>${Number(nextAvailableTick) || 0}</b>.
        </div>
      </div>
    </div>`;
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

const dailyFlagKey = "paumeMortelle.daily";
const currentTick = a2eGetWorldTimeTick();
const dailyState = actor.getFlag("add2e", dailyFlagKey) ?? {};
const nextAvailableTick = Number(dailyState.nextAvailableTick ?? 0) || 0;

if (nextAvailableTick > currentTick) {
  const remaining = nextAvailableTick - currentTick;
  ui.notifications.warn(`Paume mortelle déjà utilisée aujourd’hui. Prochaine utilisation dans ${a2eFormatRounds(remaining)}.`);
  return false;
}

const combatKey = game.combat.id;
const flagKey = `paumeMortelle.${combatKey}`;
const alreadyPrepared = actor.getFlag("add2e", flagKey);
let existing = a2eFindPaumeMortelleWeapon(actor, alreadyPrepared?.weaponId ?? null);

if (alreadyPrepared?.prepared === true) {
  if (existing) {
    ui.notifications.warn("La Paume mortelle est déjà préparée pour ce combat.");
    return false;
  }

  await actor.unsetFlag("add2e", flagKey);
}

const damage = a2eDamageParts(
  actor.system?.moine?.main_nue ??
  row?.unarmedDamage ??
  row?.main_nue ??
  row?.damage ??
  "1d6/1d3"
);

const img = "icons/skills/melee/strike-palm-light-orange.webp";
const nextTick = currentTick + ADD2E_MOINE_PAUME_MORTELLE_DAY_ROUNDS;

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
    per: "day"
  },
  description: "Arme temporaire créée par la capacité Paume mortelle du moine. Elle représente une seule tentative spéciale ; après la résolution de son attaque, elle est automatiquement supprimée de l’onglet Combat. Cette capacité ne peut être préparée qu’une fois par jour de temps ADD2E."
};

existing = a2eFindPaumeMortelleWeapon(actor);

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
        deleteAfterAttack: true,
        useLimit: "day",
        dayRounds: ADD2E_MOINE_PAUME_MORTELLE_DAY_ROUNDS,
        preparedAtTick: currentTick,
        nextAvailableTick: nextTick
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
        deleteAfterAttack: true,
        useLimit: "day",
        dayRounds: ADD2E_MOINE_PAUME_MORTELLE_DAY_ROUNDS,
        preparedAtTick: currentTick,
        nextAvailableTick: nextTick
      }
    }
  }], { add2eInternal: true });
  weapon = created?.[0] ?? null;
}

await actor.setFlag("add2e", dailyFlagKey, {
  used: true,
  prepared: true,
  weaponId: weapon?.id ?? null,
  combatId: game.combat?.id ?? null,
  level,
  damage: damage.raw,
  usedAtTick: currentTick,
  nextAvailableTick: nextTick,
  dayRounds: ADD2E_MOINE_PAUME_MORTELLE_DAY_ROUNDS,
  version: ADD2E_MOINE_PAUME_MORTELLE_VERSION
});

await actor.setFlag("add2e", flagKey, {
  prepared: true,
  weaponId: weapon?.id ?? null,
  combatId: game.combat?.id ?? null,
  level,
  damage: damage.raw,
  at: Date.now(),
  preparedAtTick: currentTick,
  nextAvailableTick: nextTick
});

await ChatMessage.create({
  speaker: ChatMessage.getSpeaker({ actor }),
  content: a2ePaumeMortelleChatCard({ actor, img, damage, currentTick, nextAvailableTick: nextTick }),
  flags: {
    add2e: {
      paumeMortellePrepared: true,
      actorId: actor.id ?? null,
      actorUuid: actor.uuid ?? null,
      weaponId: weapon?.id ?? null,
      currentTick,
      nextAvailableTick: nextTick,
      version: ADD2E_MOINE_PAUME_MORTELLE_VERSION
    }
  },
  ...a2eChatStyleData()
});

ui.notifications.info("Paume mortelle prête : arme temporaire créée dans l’onglet Combat. Prochaine utilisation après 24 heures de temps ADD2E.");
return true;
