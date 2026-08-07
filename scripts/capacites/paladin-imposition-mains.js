/* ADD2E — Paladin : Imposition des mains */
const ADD2E_PALADIN_IMPOSITION_MAINS_VERSION = "2026-08-07-canonical-resource-v2";
globalThis.ADD2E_PALADIN_IMPOSITION_MAINS_VERSION = ADD2E_PALADIN_IMPOSITION_MAINS_VERSION;

function a2ePalNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function a2ePalFeatureLevel(currentActor, currentFeature) {
  const level = Number(
    globalThis.add2eFeatureActorLevel?.(currentActor, currentFeature)
    ?? currentFeature?._add2eClassLevel
  );
  return Number.isFinite(level) && level >= 1 ? Math.floor(level) : null;
}

if (!actor) {
  ui.notifications.error("Imposition des mains : acteur introuvable.");
  return false;
}

const level = a2ePalFeatureLevel(actor, feature);
if (level === null) {
  ui.notifications.error("Imposition des mains : niveau de Paladin introuvable.");
  return false;
}

const targetToken = Array.from(game.user.targets ?? [])[0];
const target = targetToken?.actor ?? actor;
const healAmount = level * 2;
const current = a2ePalNum(target.system?.pdv, 0);
const max = a2ePalNum(target.system?.points_de_coup, current);
const healed = Math.min(max, current + healAmount);
const gained = Math.max(0, healed - current);

if (gained <= 0) {
  ui.notifications.info(`${target.name} est déjà à ses PV maximum.`);
  return false;
}

await target.update(
  { "system.pdv": healed },
  { add2eInternal: true, add2eReason: "paladin-lay-on-hands", render: false }
);

const buildChatCard = globalThis.add2eBuildChatCard;
const createChatCard = globalThis.add2eCreateChatCard;
if (typeof buildChatCard !== "function" || typeof createChatCard !== "function") {
  throw new Error("Les constructeurs communs de cartes ADD2E ne sont pas disponibles.");
}

const cardOptions = {
  actor,
  title: "Imposition des mains",
  icon: "fas fa-hand-holding-medical",
  variant: "success",
  source: {
    name: actor.name,
    img: actor.img,
    type: "Capacité de paladin"
  },
  rows: [
    { label: "Cible", value: target.name },
    { label: "Soin", value: `${gained} PV (${level} × 2)` },
    { label: "PV", value: `${current} → ${healed} / ${max}` },
    { label: "Utilisation", value: feature?.uses?.label ?? "1 / jour" }
  ],
  chatData: {
    flags: {
      add2e: {
        sourceCapacite: "paladin-imposition-mains",
        version: ADD2E_PALADIN_IMPOSITION_MAINS_VERSION
      }
    }
  }
};
buildChatCard(cardOptions);
await createChatCard(cardOptions);
return true;