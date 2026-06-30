// scripts/add2e-attack/02-damage.mjs
// ADD2E — Application des dégâts via Add2eEffectsEngine.

export const ADD2E_DAMAGE_VERSION = "2026-06-30-effects-engine-damage-card-onuse-v2";

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

function add2eDamageNormalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9:]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function add2eDamageEffectTags(effect) {
  const raw = effect?.flags?.add2e?.tags ?? effect?.getFlag?.("add2e", "tags") ?? [];
  const values = Array.isArray(raw) ? raw : String(raw ?? "").split(/[,;|\n]+/g);
  return values.map(add2eDamageNormalize).filter(Boolean);
}

function add2eDamageTargetToken(cible, actor) {
  if (cible?.actor?.id === actor?.id) return cible.object ?? cible;
  if (cible?.object?.actor?.id === actor?.id) return cible.object;
  return canvas?.tokens?.placeables?.find(token => token?.actor?.id === actor?.id)
    ?? actor?.getActiveTokens?.()[0]
    ?? null;
}

function add2eFindDamageResolutionEffect(actor, resolution) {
  if (!resolution?.applied || !actor) return null;
  const element = add2eDamageNormalize(resolution.element);
  if (!element) return null;

  return [...(actor.effects ?? [])].find(effect => {
    if (!effect || effect.disabled) return false;
    const handler = effect.flags?.add2e?.damageResolution;
    const onUse = String(handler?.onUse ?? "").trim();
    if (!onUse) return false;

    const configuredElement = add2eDamageNormalize(handler.element);
    if (configuredElement) return configuredElement === element;
    return add2eDamageEffectTags(effect).includes(`resistance:${element}`);
  }) ?? null;
}

async function add2eRunDamageResolutionOnUse({ actor, cible, resolution, amount, type, details }) {
  const effect = add2eFindDamageResolutionEffect(actor, resolution);
  if (!effect) return false;

  const handler = effect.flags?.add2e?.damageResolution ?? {};
  const scriptPath = String(handler.onUse ?? "").trim();
  if (!scriptPath) return false;

  try {
    const response = await fetch(scriptPath, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const code = await response.text();
    const Fn = Object.getPrototypeOf(async function () {}).constructor;
    const targetToken = add2eDamageTargetToken(cible, actor);
    const event = {
      add2eMode: String(handler.mode ?? "damageResolved"),
      actor,
      token: targetToken,
      targetActor: actor,
      targetToken,
      effect,
      effectId: effect.id ?? null,
      effectFlags: effect.flags?.add2e ?? {},
      damageResolution: resolution,
      damage: {
        original: Math.max(0, Number(amount) || 0),
        final: Math.max(0, Number(resolution.amount) || 0),
        type: String(type ?? ""),
        details: String(details ?? "")
      }
    };

    const fn = new Fn("actor", "item", "sort", "token", "args", "sourceItem", code);
    await fn.call(effect, actor, null, null, targetToken, [event], null);
    return true;
  } catch (error) {
    console.error("[ADD2E][DAMAGE][ONUSE_CARD][ERROR]", {
      actor: actor?.name,
      effect: effect?.name,
      scriptPath,
      error
    });
    return false;
  }
}

async function add2eResolveDamage(actor, amount, type, details) {
  const engine = globalThis.Add2eEffectsEngine;
  if (typeof engine?.resolveIncomingDamage !== "function") {
    ui.notifications.error("Moteur d'effets ADD2E indisponible : dégâts non appliqués.");
    return null;
  }
  return engine.resolveIncomingDamage(actor, { amount, type, details });
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

  await add2eRunDamageResolutionOnUse({
    actor,
    cible,
    resolution,
    amount: baseDamage,
    type,
    details
  });

  ui.notifications.info(`${actor.name} prend ${damage} dégât(s).`);
}

globalThis.add2eApplyDamage = add2eApplyDamage;
globalThis.ADD2E_DAMAGE_VERSION = ADD2E_DAMAGE_VERSION;
