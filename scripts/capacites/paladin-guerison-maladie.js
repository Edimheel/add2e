/* ADD2E — Paladin : Guérison des maladies */
const ADD2E_PALADIN_GUERISON_MALADIE_VERSION = "2026-05-03-v1";
globalThis.ADD2E_PALADIN_GUERISON_MALADIE_VERSION = ADD2E_PALADIN_GUERISON_MALADIE_VERSION;

function a2ePalNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function a2ePalWeekKey() {
  const wt = Number(game.time?.worldTime);
  if (Number.isFinite(wt) && wt > 0) return `worldweek-${Math.floor(wt / (86400 * 7))}`;
  const d = new Date();
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
  return `${d.getFullYear()}-week-${week}`;
}

if (!actor) {
  ui.notifications.error("Guérison des maladies : acteur introuvable.");
  return false;
}

const level = Math.max(1, a2ePalNum(actor.system?.niveau, 1));
const maxUses = Math.floor((level - 1) / 5) + 1;
const weekKey = a2ePalWeekKey();
const flagKey = `paladin.guerisonMaladie.${weekKey}`;
const data = actor.getFlag("add2e", flagKey) ?? { used: 0 };
const used = a2ePalNum(data.used, 0);

if (used >= maxUses) {
  ui.notifications.warn(`Guérison des maladies déjà utilisée ${used}/${maxUses} fois cette semaine.`);
  return false;
}

const targetToken = Array.from(game.user.targets ?? [])[0];
const target = targetToken?.actor ?? actor;

const diseaseEffects = target.effects
  .filter(e => {
    const name = String(e.name ?? "").toLowerCase();
    const tags = e.flags?.add2e?.tags ?? [];
    return name.includes("maladie") || tags.some(t => String(t).toLowerCase().includes("maladie"));
  })
  .map(e => e.id);

if (diseaseEffects.length) {
  await target.deleteEmbeddedDocuments("ActiveEffect", diseaseEffects);
}

await actor.setFlag("add2e", flagKey, {
  used: used + 1,
  max: maxUses,
  lastTarget: target.uuid,
  at: Date.now()
});

await ChatMessage.create({
  speaker: ChatMessage.getSpeaker({ actor }),
  content: `
    <div class="add2e-chat-card">
      <h3>Guérison des maladies</h3>
      <p><b>${actor.name}</b> appelle son pouvoir sacré sur <b>${target.name}</b>.</p>
      <p>Utilisations cette semaine : <b>${used + 1}/${maxUses}</b>.</p>
      <p>${diseaseEffects.length ? `${diseaseEffects.length} effet(s) de maladie supprimé(s).` : "Aucun effet de maladie marqué n’a été trouvé ; applique le résultat selon la scène."}</p>
    </div>
  `
});

return true;
