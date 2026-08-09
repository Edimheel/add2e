/* ADD2E — Paladin : Imposition des mains */
const ADD2E_PALADIN_IMPOSITION_MAINS_VERSION = "2026-08-09-canonical-hit-points-v3";
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

function a2ePalHitPointEngine() {
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine ?? null;
  if (
    !engine
    || typeof engine.readHitPoints !== "function"
    || typeof engine.readMaximumHitPoints !== "function"
    || typeof engine.applyHitPointHealing !== "function"
  ) {
    throw new Error("Le propriétaire canonique ADD2E des points de vie est indisponible.");
  }
  return engine;
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
const hpEngine = a2ePalHitPointEngine();
const current = hpEngine.readHitPoints(target);
const max = hpEngine.readMaximumHitPoints(target);
if (!Number.isFinite(max) || max <= 0) {
  ui.notifications.error("Imposition des mains : PV maximum canoniques introuvables.");
  return false;
}

const healing = await hpEngine.applyHitPointHealing(target, healAmount, {
  reason: "paladin-lay-on-hands",
  updateOptions: { render: false }
});
const gained = Number(healing.effective) || 0;
const healed = Number(healing.after);

if (gained <= 0) {
  ui.notifications.info(`${target.name} est déjà à ses PV maximum.`);
  return false;
}

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