// ADD2E — Régénération
// Compatible Foundry V13/V14/V15.
// Le sort conserve son comportement actuel : marquer l'effet sur une cible et publier une carte commune.

const ADD2E_REGENERATION_VERSION = "2026-08-09-canonical-spell-consumer-v3";
const ADD2E_REGENERATION_CONFIG = Object.freeze({
  name: "Régénération",
  slug: "regeneration",
  level: 7,
  description: "Régénération restaure la vitalité, la vie ou l’intégrité d’une créature. Selon le sort, il peut soigner des blessures, rappeler une créature à la vie, régénérer un membre, retirer un affaiblissement ou restaurer une condition perdue. Les limites exactes dépendent du sort et du MD."
});

globalThis.ADD2E_REGENERATION_VERSION = ADD2E_REGENERATION_VERSION;

function add2eRegenerationCasterToken() {
  return token ?? args?.[0]?.token ?? canvas?.tokens?.controlled?.[0] ?? null;
}

async function add2eRegenerationApplyEffect(targetActor) {
  if (!targetActor) return false;
  const [effect] = await targetActor.createEmbeddedDocuments("ActiveEffect", [{
    name: ADD2E_REGENERATION_CONFIG.name,
    img: item?.img || "icons/svg/aura.svg",
    disabled: false,
    transfer: false,
    type: "base",
    system: {},
    changes: [],
    duration: {
      startRound: game.combat?.round ?? null,
      startTime: game.time?.worldTime ?? null,
      combat: game.combat?.id ?? null
    },
    description: ADD2E_REGENERATION_CONFIG.description,
    flags: {
      add2e: {
        tags: [
          `sort:${ADD2E_REGENERATION_CONFIG.slug}`,
          "classe:clerc",
          `niveau:${ADD2E_REGENERATION_CONFIG.level}`,
          "retour:vie",
          "restauration"
        ],
        spellConsumerVersion: ADD2E_REGENERATION_VERSION
      }
    }
  }]);
  return effect ?? null;
}

async function add2eRegenerationChat(caster, casterToken, targetActor) {
  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    throw new Error("Les constructeurs communs de cartes ADD2E sont indisponibles.");
  }

  const options = {
    actor: caster,
    title: ADD2E_REGENERATION_CONFIG.name,
    icon: "fas fa-hand-holding-medical",
    variant: "success",
    source: {
      name: caster?.name ?? "Clerc",
      img: casterToken?.document?.texture?.src ?? caster?.img ?? item?.img ?? "icons/svg/mystery-man.svg",
      type: "Sort divin"
    },
    rows: [
      { label: "Cible", value: targetActor.name },
      { label: "Effet", value: "RÉGÉNÉRATION" }
    ],
    trustedBodyHtml: `<p>Effet de restauration/rappel noté sur <b>${targetActor.name}</b>.</p><details style="margin-top:8px;"><summary>Règle appliquée</summary><div style="padding-top:6px;">${ADD2E_REGENERATION_CONFIG.description}</div></details>`,
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }),
      flags: {
        add2e: {
          spell: ADD2E_REGENERATION_CONFIG.slug,
          version: ADD2E_REGENERATION_VERSION
        }
      }
    }
  };
  globalThis.add2eBuildChatCard(options);
  return globalThis.add2eCreateChatCard(options);
}

const caster = actor ?? item?.parent ?? null;
if (!caster) {
  ui.notifications.error("Régénération : lanceur introuvable.");
  return false;
}

const targets = Array.from(game.user?.targets ?? []).filter(target => target?.actor);
if (!targets.length) {
  ui.notifications.warn("Régénération : cible obligatoire.");
  return false;
}

const casterToken = add2eRegenerationCasterToken();
for (const target of targets) {
  await add2eRegenerationApplyEffect(target.actor);
}
await add2eRegenerationChat(caster, casterToken, targets[0].actor);
return true;
