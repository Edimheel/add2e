/* ADD2E — Paladin : Guérison des maladies */
const ADD2E_PALADIN_GUERISON_MALADIE_VERSION = "2026-08-07-canonical-resource-v2";
globalThis.ADD2E_PALADIN_GUERISON_MALADIE_VERSION = ADD2E_PALADIN_GUERISON_MALADIE_VERSION;

function a2ePalFeatureLevel(currentActor, currentFeature) {
  const level = Number(
    globalThis.add2eFeatureActorLevel?.(currentActor, currentFeature)
    ?? currentFeature?._add2eClassLevel
  );
  return Number.isFinite(level) && level >= 1 ? Math.floor(level) : null;
}

if (!actor) {
  ui.notifications.error("Guérison des maladies : acteur introuvable.");
  return false;
}

const level = a2ePalFeatureLevel(actor, feature);
if (level === null) {
  ui.notifications.error("Guérison des maladies : niveau de Paladin introuvable.");
  return false;
}

const targetToken = Array.from(game.user.targets ?? [])[0];
const target = targetToken?.actor ?? actor;

const diseaseEffects = target.effects
  .filter(effect => {
    const name = String(effect.name ?? "").toLowerCase();
    const tags = effect.flags?.add2e?.tags ?? [];
    return name.includes("maladie") || tags.some(tag => String(tag).toLowerCase().includes("maladie"));
  })
  .map(effect => effect.id);

if (diseaseEffects.length) {
  await target.deleteEmbeddedDocuments("ActiveEffect", diseaseEffects, {
    add2eInternal: true,
    add2eReason: "paladin-cure-disease"
  });
}

const buildChatCard = globalThis.add2eBuildChatCard;
const createChatCard = globalThis.add2eCreateChatCard;
if (typeof buildChatCard !== "function" || typeof createChatCard !== "function") {
  throw new Error("Les constructeurs communs de cartes ADD2E ne sont pas disponibles.");
}

const cardOptions = {
  actor,
  title: "Guérison des maladies",
  icon: "fas fa-hand-sparkles",
  variant: "success",
  source: {
    name: actor.name,
    img: actor.img,
    type: "Capacité de paladin"
  },
  rows: [
    { label: "Cible", value: target.name },
    { label: "Effets supprimés", value: String(diseaseEffects.length) },
    { label: "Utilisation", value: feature?.uses?.label ?? "Selon niveau / semaine" }
  ],
  trustedBodyHtml: diseaseEffects.length
    ? "<p>Les effets de maladie marqués sur la cible ont été supprimés.</p>"
    : "<p>Aucun effet de maladie marqué n’a été trouvé ; le MJ applique le résultat selon la situation.</p>",
  chatData: {
    flags: {
      add2e: {
        sourceCapacite: "paladin-guerison-maladie",
        version: ADD2E_PALADIN_GUERISON_MALADIE_VERSION
      }
    }
  }
};
buildChatCard(cardOptions);
await createChatCard(cardOptions);
return true;