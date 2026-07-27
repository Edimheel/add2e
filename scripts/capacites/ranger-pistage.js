// systems/add2e/scripts/capacites/ranger-pistage.js
// ADD2E — Ranger : Pistage

const ADD2E_RANGER_PISTAGE_VERSION = "2026-07-27-shared-chat-card-v1";
globalThis.ADD2E_RANGER_PISTAGE_VERSION = ADD2E_RANGER_PISTAGE_VERSION;

function a2eRangerFeatureLevel(currentActor, currentFeature) {
  const level = Number(
    globalThis.add2eFeatureActorLevel?.(currentActor, currentFeature)
    ?? currentFeature?._add2eClassLevel
  );
  return Number.isFinite(level) && level >= 1 ? Math.floor(level) : null;
}

function a2eRangerClassItem(currentActor, currentFeature) {
  const itemId = String(currentFeature?._add2eClassItemId ?? "").trim();
  if (!itemId) return null;
  return currentActor?.items?.get?.(itemId)
    ?? Array.from(currentActor?.items ?? []).find(item => String(item?.id ?? "") === itemId)
    ?? null;
}

if (!actor) {
  ui.notifications.error("Pistage : acteur introuvable.");
  return false;
}

const niveau = a2eRangerFeatureLevel(actor, feature);
const classe = a2eRangerClassItem(actor, feature);
if (niveau === null || !classe) {
  ui.notifications.error("Pistage : niveau ou classe Ranger introuvable.");
  return false;
}

const progression = Array.isArray(classe.system?.progression) ? classe.system.progression : [];
const ligne = progression.find(p => Number(p.niveau ?? p.level) === niveau) ?? progression[Math.max(0, niveau - 1)] ?? {};

let exterieur = ligne?.tracking?.exterieur;
let souterrain = ligne?.tracking?.souterrain;

if ((exterieur === undefined || souterrain === undefined) && Array.isArray(ligne?.skills)) {
  exterieur = ligne.skills[0];
  souterrain = ligne.skills[1];
}

exterieur = Number(exterieur ?? 0) || 0;
souterrain = Number(souterrain ?? 0) || 0;

const buildChatCard = globalThis.add2eBuildChatCard;
const createChatCard = globalThis.add2eCreateChatCard;
if (typeof buildChatCard !== "function" || typeof createChatCard !== "function") {
  throw new Error("Les constructeurs communs de cartes ADD2E ne sont pas disponibles.");
}

const cardOptions = {
  actor,
  title: "Pistage",
  icon: "fas fa-shoe-prints",
  variant: "ability",
  rows: [
    { label: "Base extérieur", value: exterieur ? `${exterieur}%` : "Selon situation" },
    { label: "Base souterrain", value: souterrain ? `${souterrain}%` : "Selon situation" }
  ],
  message: "Le MJ applique les modificateurs selon le terrain, le temps écoulé, la météo et le nombre de créatures.",
  trustedBodyHtml: "<p><b>Rappel :</b> +2 % par créature au-delà de la première ; −10 % par jour écoulé ; −25 % par heure de précipitations.</p>",
  chatData: {
    flags: {
      add2e: {
        sourceCapacite: "ranger-pistage",
        version: ADD2E_RANGER_PISTAGE_VERSION
      }
    }
  }
};
buildChatCard(cardOptions);
await createChatCard(cardOptions);
return true;
