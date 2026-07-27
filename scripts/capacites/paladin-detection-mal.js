/* ADD2E — Paladin : Détection du mal */
const ADD2E_PALADIN_DETECTION_MAL_VERSION = "2026-07-27-shared-chat-card-v2";
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

const buildChatCard = globalThis.add2eBuildChatCard;
const createChatCard = globalThis.add2eCreateChatCard;
if (typeof buildChatCard !== "function" || typeof createChatCard !== "function") {
  throw new Error("Les constructeurs communs de cartes ADD2E ne sont pas disponibles.");
}
const cardOptions = {
  actor,
  title: "Détection du mal",
  icon: "fas fa-eye",
  variant: "ability",
  rows: [{ label: "Portée", value: "20 mètres" }],
  message: `${actor.name} se concentre pour détecter le mal.`,
  trustedBodyHtml: rows.length
    ? `<ul>${rows.join("")}</ul>`
    : "<p>Aucune cible sélectionnée. Le MD indique si une présence mauvaise est perçue dans la zone.</p>",
  chatData: {
    flags: {
      add2e: {
        sourceCapacite: "paladin-detection-mal",
        version: ADD2E_PALADIN_DETECTION_MAL_VERSION
      }
    }
  }
};
buildChatCard(cardOptions);
await createChatCard(cardOptions);
return true;
