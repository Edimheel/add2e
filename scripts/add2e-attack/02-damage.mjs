// scripts/add2e-attack/02-damage.mjs
// ADD2E — Application des dégâts via Add2eEffectsEngine.

export const ADD2E_DAMAGE_VERSION = "2026-06-30-effects-engine-damage-resolution-v1";

function add2eDamageTokenClass() {
  return foundry?.canvas?.placeables?.Token ?? CONFIG?.Token?.objectClass ?? null;
}

function add2eDamageTokenId(cible) {
  if (!cible) return null;
  if (cible.token?.id) return cible.token.id;
  const TokenClass = add2eDamageTokenClass();
  if (TokenClass && cible instanceof TokenClass) return cible.id;
  if (cible.documentName === "Token" || cible.constructor?.name === "TokenDocument") return cible.id;
  return null;
}

function add2eDamageActor(cible) {
  return cible?.actor ?? cible ?? null;
}

async function add2eResolveDamage(actor, amount, type, details) {
  const engine = globalThis.Add2eEffectsEngine;
  if (typeof engine?.resolveIncomingDamage !== "function") {
    ui.notifications.error("Moteur d'effets ADD2E indisponible : dégâts non appliqués.");
    return null;
  }
  return engine.resolveIncomingDamage(actor, { amount, type, details, chat: true });
}

export async function add2eApplyDamage({ cible, montant, type = "", details = "" }) {
  if (!cible) {
    ui.notifications.error("Pas de cible !");
    return;
  }

  const baseDamage = Math.max(0, Number(montant) || 0);

  if (!game.user.isGM) {
    if (!game.socket) {
      ui.notifications.error("Socket Foundry indisponible (game.socket).");
      return;
    }

    game.socket.emit("system.add2e", {
      type: "applyDamageFlag",
      tokenId: add2eDamageTokenId(cible),
      actorId: cible.actor?.id || cible.id,
      flagData: {
        montant: baseDamage,
        type,
        details,
        source: "attack",
        fromUserId: game.user.id,
        timestamp: Date.now()
      }
    });

    ui.notifications.info(`Dégâts (${baseDamage}) envoyés au MJ.`);
    return;
  }

  const actor = add2eDamageActor(cible);
  if (!actor) {
    ui.notifications.error("Acteur cible introuvable.");
    return;
  }

  const resolution = await add2eResolveDamage(actor, baseDamage, type, details);
  if (!resolution) return;
  const damage = Math.max(0, Number(resolution.amount) || 0);

  const maxHP = Number(actor.system?.points_de_coup) || 0;
  let currentHP = actor.system?.pdv;
  if (currentHP === undefined || currentHP === null || currentHP === "" || Number.isNaN(Number(currentHP))) {
    currentHP = maxHP;
  } else {
    currentHP = Number(currentHP) || 0;
  }

  const newHP = currentHP - damage;
  await actor.update({ "system.pdv": newHP });

  if (typeof globalThis.add2eSyncActorVitalStatus === "function") {
    await globalThis.add2eSyncActorVitalStatus(actor, { reason: "damage" });
  }

  ui.notifications.info(`${actor.name} prend ${damage} dégât(s).`);
}

globalThis.add2eApplyDamage = add2eApplyDamage;
globalThis.ADD2E_DAMAGE_VERSION = ADD2E_DAMAGE_VERSION;
