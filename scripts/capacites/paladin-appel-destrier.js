/* ADD2E — Paladin : Appel du destrier */
const ADD2E_PALADIN_APPEL_DESTRIER_VERSION = "2026-05-03-v1";
globalThis.ADD2E_PALADIN_APPEL_DESTRIER_VERSION = ADD2E_PALADIN_APPEL_DESTRIER_VERSION;

if (!actor) {
  ui.notifications.error("Appel du destrier : acteur introuvable.");
  return false;
}

const level = Number(actor.system?.niveau ?? 1) || 1;
if (level < 4) {
  ui.notifications.warn("Le paladin ne peut appeler son destrier qu’à partir du niveau 4.");
  return false;
}

const existing = actor.getFlag("add2e", "paladin.destrier");
if (existing?.called) {
  ui.notifications.warn("Le destrier du paladin a déjà été appelé. En cas de mort du destrier, le délai de dix ans doit être géré par le MJ.");
  return false;
}

await actor.setFlag("add2e", "paladin.destrier", {
  called: true,
  at: Date.now(),
  note: "Un seul destrier tous les dix ans. Cheval de guerre lourd intelligent, 5 DV, 5d8+5 PV, CA 5, vitesse 18."
});

await ChatMessage.create({
  speaker: ChatMessage.getSpeaker({ actor }),
  content: `
    <div class="add2e-chat-card">
      <h3>Appel du destrier</h3>
      <p><b>${actor.name}</b> appelle son destrier de paladin.</p>
      <p>Destrier attendu : cheval de guerre lourd intelligent, <b>5 DV</b>, <b>5d8+5 PV</b>, <b>CA 5</b>, vitesse d’un cheval de guerre moyen.</p>
      <p>Un seul destrier peut être appelé tous les dix ans.</p>
    </div>
  `
});

return true;
