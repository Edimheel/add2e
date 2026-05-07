/* ADD2E — Paladin : Détection du mal */
const ADD2E_PALADIN_DETECTION_MAL_VERSION = "2026-05-03-v1";
globalThis.ADD2E_PALADIN_DETECTION_MAL_VERSION = ADD2E_PALADIN_DETECTION_MAL_VERSION;

function a2ePalNorm(v) {
  return String(v ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, "").replace(/[\s-]+/g, "_");
}

if (!actor) {
  ui.notifications.error("Détection du mal : acteur introuvable.");
  return false;
}

const targets = Array.from(game.user.targets ?? []);
const rows = [];
for (const token of targets) {
  const a = token.actor;
  const align = a2ePalNorm(a?.system?.alignement ?? a?.system?.alignment ?? "");
  const tags = typeof Add2eEffectsEngine !== "undefined" ? Add2eEffectsEngine.getActiveTags(a) : [];
  const evil = align.includes("mauvais") || tags.includes("alignement:mauvais") || tags.includes("creature:mauvaise") || tags.includes("mal");
  rows.push(`<li><b>${token.name}</b> : ${evil ? "présence mauvaise détectée" : "aucune aura mauvaise évidente"}</li>`);
}

await ChatMessage.create({
  speaker: ChatMessage.getSpeaker({ actor }),
  content: `
    <div class="add2e-chat-card">
      <h3>Détection du mal</h3>
      <p><b>${actor.name}</b> se concentre pour détecter le mal à <b>20 mètres</b>.</p>
      ${rows.length ? `<ul>${rows.join("")}</ul>` : "<p>Aucune cible sélectionnée. Le MD indique si une présence mauvaise est perçue dans la zone.</p>"}
    </div>
  `
});

return true;
