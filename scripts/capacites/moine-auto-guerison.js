/*
 * ADD2E — Moine : Auto-guérison
 * Script exécuté via on_use d'une classFeature.
 * Compatible Foundry V13 / V14 / V15.
 */
const ADD2E_MOINE_AUTO_GUERISON_VERSION = "2026-07-05-daily-limit";

function a2eNum(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function a2eMonkDayKey() {
  const worldTime = Number(game.time?.worldTime);
  if (Number.isFinite(worldTime) && worldTime > 0) return `worldday-${Math.floor(worldTime / 86400)}`;
  return new Date().toISOString().slice(0, 10);
}

function a2eGetMonkRow(subject) {
  const level = Math.max(1, a2eNum(subject?.system?.niveau ?? subject?.system?.level, 1));
  const rows = subject?.system?.details_classe?.monkProgression ?? subject?.system?.details_classe?.progression ?? subject?.system?.monkProgression ?? [];
  if (!Array.isArray(rows)) return null;
  return rows.find(row => Number(row?.niveau ?? row?.level) === level)
    ?? rows.slice().reverse().find(row => Number(row?.niveau ?? row?.level ?? 0) <= level)
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

const dayKey = a2eMonkDayKey();
const usageFlagKey = `moine.autoGuerison.${dayKey}`;
if (actor.getFlag("add2e", usageFlagKey)?.used) {
  ui.notifications.warn("Auto-guérison déjà utilisée aujourd’hui.");
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
await actor.setFlag("add2e", usageFlagKey, { used: true, amount: gained, at: Date.now() });

await ChatMessage.create({
  speaker: ChatMessage.getSpeaker({ actor }),
  content: `<div class="add2e-chat-card"><h3>Auto-guérison du moine</h3><p><b>${actor.name}</b> récupère <b>${gained} PV</b>.</p><p>PV : ${current} → ${healed} / ${max}</p><p>Utilisation : <b>1 / jour</b>.</p></div>`
});
return true;
