/* ADD2E — Paladin : Imposition des mains */
const ADD2E_PALADIN_IMPOSITION_MAINS_VERSION = "2026-09-16-canonical-gm-healing-v4";

function a2ePalFeatureLevel(currentActor, currentFeature) {
  const level = Number(
    globalThis.add2eFeatureActorLevel?.(currentActor, currentFeature)
    ?? currentFeature?._add2eClassLevel
  );
  return Number.isFinite(level) && level >= 1 ? Math.floor(level) : null;
}

function a2ePalHitPointEngine() {
  const engine = globalThis.ADD2E_EFFECTS;
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

function a2ePalRequestGmHealing({ target, targetToken, actor, amount }) {
  if (!game.socket?.emit) {
    ui.notifications.error("Imposition des mains : relais MJ indisponible.");
    return false;
  }
  const activeGM = Array.from(game.users ?? []).find(user => user?.active && user?.isGM) ?? null;
  if (!activeGM) {
    ui.notifications.error("Imposition des mains : aucun MJ actif ne peut appliquer les soins.");
    return false;
  }
  game.socket.emit("system.add2e", {
    type: "ADD2E_GM_OPERATION",
    operation: "applyDamage",
    payload: {
      actorUuid: target.uuid ?? null,
      actorId: target.id,
      sceneId: canvas?.scene?.id ?? null,
      tokenId: targetToken?.document?.id ?? targetToken?.id ?? null,
      montant: -amount,
      type: "soin",
      details: `Imposition des mains : ${amount} PV de soins`,
      casterId: actor.id ?? null,
      casterUuid: actor.uuid ?? null,
      fromUserId: game.user?.id ?? null
    }
  });
  return true;
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

let gained = Math.min(healAmount, Math.max(0, max - current));
let healed = current + gained;
if (gained <= 0) {
  ui.notifications.info(`${target.name} est déjà à ses PV maximum.`);
  return false;
}

if (game.user?.isGM || target.isOwner) {
  const healing = await hpEngine.applyHitPointHealing(target, healAmount, {
    reason: "paladin-lay-on-hands",
    updateOptions: { render: false }
  });
  gained = Number(healing.effective) || 0;
  healed = Number(healing.after);
  if (gained <= 0) {
    ui.notifications.info(`${target.name} est déjà à ses PV maximum.`);
    return false;
  }
} else if (!a2ePalRequestGmHealing({ target, targetToken, actor, amount: healAmount })) {
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