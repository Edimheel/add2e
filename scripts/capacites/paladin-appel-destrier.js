/* ADD2E — Paladin : Appel du destrier */
const ADD2E_PALADIN_APPEL_DESTRIER_VERSION = "2026-08-07-canonical-resource-v2";
globalThis.ADD2E_PALADIN_APPEL_DESTRIER_VERSION = ADD2E_PALADIN_APPEL_DESTRIER_VERSION;

function a2ePalFeatureLevel(currentActor, currentFeature) {
  const level = Number(
    globalThis.add2eFeatureActorLevel?.(currentActor, currentFeature)
    ?? currentFeature?._add2eClassLevel
  );
  return Number.isFinite(level) && level >= 1 ? Math.floor(level) : null;
}

if (!actor) {
  ui.notifications.error("Appel du destrier : acteur introuvable.");
  return false;
}

const level = a2ePalFeatureLevel(actor, feature);
if (level === null) {
  ui.notifications.error("Appel du destrier : niveau de Paladin introuvable.");
  return false;
}

if (level < 4) {
  ui.notifications.warn("Le paladin ne peut appeler son destrier qu’à partir du niveau 4.");
  return false;
}

const buildChatCard = globalThis.add2eBuildChatCard;
const createChatCard = globalThis.add2eCreateChatCard;
if (typeof buildChatCard !== "function" || typeof createChatCard !== "function") {
  throw new Error("Les constructeurs communs de cartes ADD2E ne sont pas disponibles.");
}

const cardOptions = {
  actor,
  title: "Appel du destrier",
  icon: "fas fa-horse",
  variant: "ability",
  source: {
    name: actor.name,
    img: actor.img,
    type: "Capacité de paladin"
  },
  rows: [
    { label: "Destrier", value: "Cheval de guerre lourd intelligent" },
    { label: "Dés de vie", value: "5 DV" },
    { label: "Points de vie", value: "5d8+5" },
    { label: "Classe d’armure", value: "CA 5" },
    { label: "Utilisation", value: feature?.uses?.label ?? "Un appel tous les dix ans" }
  ],
  trustedBodyHtml: "<p>Le MJ détermine les circonstances permettant au paladin de rejoindre et d’obtenir son destrier.</p>",
  chatData: {
    flags: {
      add2e: {
        sourceCapacite: "paladin-appel-destrier",
        version: ADD2E_PALADIN_APPEL_DESTRIER_VERSION
      }
    }
  }
};
buildChatCard(cardOptions);
await createChatCard(cardOptions);
return true;