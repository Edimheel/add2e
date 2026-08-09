// ADD2E — Vision réelle
// Compatible Foundry V13/V14/V15.
// Le sort conserve son comportement actuel : ActiveEffect temporaire de niveau rounds avec ses tags métier.

const ADD2E_VISION_REELLE_VERSION = "2026-08-09-canonical-simple-effect-v4";
const ADD2E_VISION_REELLE_CONFIG = Object.freeze({
  name: "Vision réelle",
  slug: "vision_reelle",
  level: 5,
  description: "Vision réelle permet au clerc de recevoir une information, une orientation ou une réponse d’origine divine. La réponse peut être directe, symbolique, partielle ou conditionnée par la clarté de la demande, la puissance de la cible et l’arbitrage du MD.",
  tags: ["vision:reelle", "detection:illusion", "detection:invisibilite", "mode:normal"]
});

globalThis.ADD2E_VISION_REELLE_VERSION = ADD2E_VISION_REELLE_VERSION;

function add2eVisionReelleEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function add2eVisionReelleCasterToken() {
  return token ?? args?.[0]?.token ?? canvas?.tokens?.controlled?.[0] ?? null;
}

function add2eVisionReelleTargets(casterToken) {
  const selected = Array.from(game.user?.targets ?? []).filter(target => target?.actor);
  return selected.length ? selected : (casterToken?.actor ? [casterToken] : []);
}

async function add2eVisionReelleApply(targetActor, rounds) {
  if (!targetActor) return false;
  const [effect] = await targetActor.createEmbeddedDocuments("ActiveEffect", [{
    name: ADD2E_VISION_REELLE_CONFIG.name,
    img: item?.img || "icons/svg/aura.svg",
    disabled: false,
    transfer: false,
    type: "base",
    system: {},
    changes: [],
    duration: {
      rounds,
      startRound: game.combat?.round ?? null,
      startTime: game.time?.worldTime ?? null,
      combat: game.combat?.id ?? null
    },
    description: ADD2E_VISION_REELLE_CONFIG.description,
    flags: {
      add2e: {
        tags: [`sort:${ADD2E_VISION_REELLE_CONFIG.slug}`, "classe:clerc", `niveau:${ADD2E_VISION_REELLE_CONFIG.level}`, ...ADD2E_VISION_REELLE_CONFIG.tags],
        spellConsumerVersion: ADD2E_VISION_REELLE_VERSION
      }
    }
  }]);
  return effect ?? null;
}

async function add2eVisionReelleChat(caster, casterToken, targets, rounds) {
  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    throw new Error("Les constructeurs communs de cartes ADD2E sont indisponibles.");
  }
  const safeDescription = add2eVisionReelleEscape(ADD2E_VISION_REELLE_CONFIG.description);
  const options = {
    actor: caster,
    title: ADD2E_VISION_REELLE_CONFIG.name,
    icon: "fas fa-eye",
    variant: "spell",
    source: {
      name: caster?.name ?? "Clerc",
      img: casterToken?.document?.texture?.src ?? caster?.img ?? item?.img ?? "icons/svg/mystery-man.svg",
      type: "Sort divin"
    },
    rows: [
      { label: "Cible(s)", value: targets.map(target => target.name).join(", ") },
      { label: "Durée", value: `${rounds} round(s)` },
      { label: "Résultat", value: ADD2E_VISION_REELLE_CONFIG.name.toUpperCase() }
    ],
    trustedBodyHtml: `<p>Effet appliqué pour <b>${rounds}</b> round(s).</p><details style="margin-top:8px;"><summary>Règle appliquée</summary><div style="padding-top:6px;">${safeDescription}</div></details>`,
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }),
      flags: { add2e: { spell: ADD2E_VISION_REELLE_CONFIG.slug, version: ADD2E_VISION_REELLE_VERSION } }
    }
  };
  globalThis.add2eBuildChatCard(options);
  return globalThis.add2eCreateChatCard(options);
}

const caster = actor ?? item?.parent ?? null;
if (!caster) {
  ui.notifications.error("Vision réelle : lanceur introuvable.");
  return false;
}

const casterToken = add2eVisionReelleCasterToken();
const targets = add2eVisionReelleTargets(casterToken);
if (!targets.length) {
  ui.notifications.warn("Vision réelle : aucune cible ni token lanceur disponible.");
  return false;
}

const rounds = Math.max(1, Number(caster.system?.niveau ?? caster.system?.level ?? caster.system?.details?.niveau ?? 1) || 1);
for (const target of targets) {
  await add2eVisionReelleApply(target.actor, rounds);
}
await add2eVisionReelleChat(caster, casterToken, targets, rounds);
return true;
