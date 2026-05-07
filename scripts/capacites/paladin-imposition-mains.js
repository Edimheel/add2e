/* ADD2E — Paladin : Imposition des mains */
const ADD2E_PALADIN_IMPOSITION_MAINS_VERSION = "2026-05-03-v1";
globalThis.ADD2E_PALADIN_IMPOSITION_MAINS_VERSION = ADD2E_PALADIN_IMPOSITION_MAINS_VERSION;

function a2ePalNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function a2ePalDayKey() {
  const wt = Number(game.time?.worldTime);
  if (Number.isFinite(wt) && wt > 0) return `worldday-${Math.floor(wt / 86400)}`;
  return new Date().toISOString().slice(0, 10);
}

if (!actor) {
  ui.notifications.error("Imposition des mains : acteur introuvable.");
  return false;
}

const dayKey = a2ePalDayKey();
const flagKey = `paladin.impositionMains.${dayKey}`;
if (actor.getFlag("add2e", flagKey)?.used) {
  ui.notifications.warn("Imposition des mains déjà utilisée aujourd’hui.");
  return false;
}

const targetToken = Array.from(game.user.targets ?? [])[0];
const target = targetToken?.actor ?? actor;
const level = Math.max(1, a2ePalNum(actor.system?.niveau, 1));
const healAmount = level * 2;
const current = a2ePalNum(target.system?.pdv, 0);
const max = a2ePalNum(target.system?.points_de_coup, current);
const healed = Math.min(max, current + healAmount);
const gained = Math.max(0, healed - current);

if (gained <= 0) {
  ui.notifications.info(`${target.name} est déjà à ses PV maximum.`);
  return false;
}

await target.update({ "system.pdv": healed });
await actor.setFlag("add2e", flagKey, { used: true, target: target.uuid, amount: gained, at: Date.now() });

await ChatMessage.create({
  speaker: ChatMessage.getSpeaker({ actor }),
  content: `
    <div class="add2e-chat-card">
      <h3>Imposition des mains</h3>
      <p><b>${actor.name}</b> impose les mains sur <b>${target.name}</b>.</p>
      <p>Soin : <b>${gained} PV</b> (${level} × 2 PV).</p>
      <p>PV : ${current} → ${healed} / ${max}</p>
    </div>
  `
});

return true;
