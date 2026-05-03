/*
 * ADD2E — Moine : Auto-guérison
 * Script exécuté via on_use d'une classFeature.
 * Paramètres attendus par le lanceur : actor, item, sort.
 */
const ADD2E_MOINE_AUTO_GUERISON_VERSION = "2026-05-02-v1";

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

if (!actor) {
  ui.notifications.error("Auto-guérison du moine : acteur introuvable.");
  return false;
}

const row = a2eGetMonkRow(actor);
const healAmount = a2eNum(actor.system?.moine?.autoSoinParJour, 0) || a2eNum(row?.selfHealPerDay, 0);

if (healAmount <= 0) {
  ui.notifications.warn("Auto-guérison indisponible à ce niveau.");
  return false;
}

const current = a2eNum(actor.system?.pdv, 0);
const max = a2eNum(actor.system?.points_de_coup, current);
const healed = Math.min(max, current + healAmount);
const gained = Math.max(0, healed - current);

if (gained <= 0) {
  ui.notifications.info(`${actor.name} est déjà à ses PV maximum.`);
  return false;
}

await actor.update({ "system.pdv": healed });

await ChatMessage.create({
  speaker: ChatMessage.getSpeaker({ actor }),
  content: `
    <div class="add2e-chat-card">
      <h3>Auto-guérison du moine</h3>
      <p><b>${actor.name}</b> récupère <b>${gained} PV</b>.</p>
      <p>PV : ${current} → ${healed} / ${max}</p>
    </div>
  `
});

return true;