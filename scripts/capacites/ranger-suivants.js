// systems/add2e/scripts/capacites/ranger-suivants.js
// ADD2E — Ranger : Appel des suivants

const ADD2E_RANGER_SUIVANTS_VERSION = "2026-07-27-shared-chat-card-v1";
globalThis.ADD2E_RANGER_SUIVANTS_VERSION = ADD2E_RANGER_SUIVANTS_VERSION;

function a2eRangerFeatureLevel(currentActor, currentFeature) {
  const level = Number(
    globalThis.add2eFeatureActorLevel?.(currentActor, currentFeature)
    ?? currentFeature?._add2eClassLevel
  );
  return Number.isFinite(level) && level >= 1 ? Math.floor(level) : null;
}

if (!actor) {
  ui.notifications.error("Appel des suivants : acteur introuvable.");
  return false;
}

const niveau = a2eRangerFeatureLevel(actor, feature);
if (niveau === null) {
  ui.notifications.error("Appel des suivants : niveau de Ranger introuvable.");
  return false;
}

if (niveau < 10) {
  ui.notifications.warn("Le ranger doit être niveau 10 pour attirer ses suivants.");
  return false;
}

const used = await actor.getFlag("add2e", "rangerSuivantsUtilises");
if (used) {
  ui.notifications.warn("Les suivants du ranger ont déjà été appelés pour ce personnage.");
  return false;
}

const roll = await (new Roll("2d12")).evaluate({ async: true });
if (game.dice3d) await game.dice3d.showForRoll(roll);
await actor.setFlag("add2e", "rangerSuivantsUtilises", { used: true, total: roll.total, at: Date.now() });

const buildChatCard = globalThis.add2eBuildChatCard;
const createChatCard = globalThis.add2eCreateChatCard;
if (typeof buildChatCard !== "function" || typeof createChatCard !== "function") {
  throw new Error("Les constructeurs communs de cartes ADD2E ne sont pas disponibles.");
}

const cardOptions = {
  actor,
  title: "Appel des suivants",
  icon: "fas fa-users",
  variant: "ability",
  rows: [
    { label: "Nombre de suivants", value: String(roll.total) },
    { label: "Usage", value: "Unique pour ce ranger" }
  ],
  message: "Le MJ détermine la nature de la troupe attirée.",
  trustedBodyHtml: "<p>Les suivants perdus ne sont pas automatiquement remplacés.</p>",
  chatData: {
    flags: {
      add2e: {
        sourceCapacite: "ranger-suivants",
        version: ADD2E_RANGER_SUIVANTS_VERSION
      }
    }
  }
};

buildChatCard(cardOptions);
await createChatCard(cardOptions);
return true;
