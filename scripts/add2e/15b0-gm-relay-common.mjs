// ADD2E — Relais MJ : utilitaires partagés.
// Compatible Foundry V13/V14/V15.

export const ADD2E_SOCKET = "system.add2e";
export const ADD2E_GM_OPERATION = "ADD2E_GM_OPERATION";
export const VENDOR_SCOPE = "add2e";
export const PROJECTILE_FLAG = "projectilesDepensesCombat";

const FAMILIAR_SCOPE = "add2e";
const FAMILIAR_FLAG = "familiar";
const FAMILIAR_ARTWORK_REPAIR_VERSION = "2026-06-27-familiar-artwork-png-v2";
const FAMILIAR_ASSET_BASE = "systems/add2e/assets/token";
const FAMILIAR_ASSETS = Object.freeze({
  chat_noir: `${FAMILIAR_ASSET_BASE}/chat-noir.png`,
  corbeau: `${FAMILIAR_ASSET_BASE}/corbeau.png`,
  faucon: `${FAMILIAR_ASSET_BASE}/faucon.png`,
  hibou: `${FAMILIAR_ASSET_BASE}/hibou.png`,
  crapaud: `${FAMILIAR_ASSET_BASE}/crapaud.png`,
  belette: `${FAMILIAR_ASSET_BASE}/belette.png`,
  quasit: `${FAMILIAR_ASSET_BASE}/quasit.png`,
  pseudo_dragon: `${FAMILIAR_ASSET_BASE}/pseudo-dragon.png`,
  lutin: `${FAMILIAR_ASSET_BASE}/lutin.png`,
  diablotin: `${FAMILIAR_ASSET_BASE}/diablotin.png`
});
const familiarArtworkQueue = new Set();

export function isResponsibleGM() {
  if (!game.user?.isGM) return false;
  if (typeof game.user.isActiveGM === "boolean") return game.user.isActiveGM;
  return game.users?.activeGM?.id === game.user.id;
}

export function resolveScene(sceneId) {
  return game.scenes?.get?.(sceneId) || canvas?.scene || game.scenes?.active || null;
}

export async function resolveActor(payload = {}) {
  if (payload.actorUuid) {
    try {
      const doc = await fromUuid(payload.actorUuid);
      if (doc) return doc;
    } catch (e) {
      console.warn("[ADD2E][GM-RELAY] actorUuid non résolu :", payload.actorUuid, e);
    }
  }

  if (payload.tokenUuid) {
    try {
      const doc = await fromUuid(payload.tokenUuid);
      if (doc?.actor) return doc.actor;
      if (doc?.document?.actor) return doc.document.actor;
    } catch (e) {
      console.warn("[ADD2E][GM-RELAY] tokenUuid non résolu :", payload.tokenUuid, e);
    }
  }

  if (payload.tokenId) {
    const scene = resolveScene(payload.sceneId);
    const tokenDoc = scene?.tokens?.get?.(payload.tokenId) ?? canvas?.scene?.tokens?.get?.(payload.tokenId) ?? null;
    if (tokenDoc?.actor) return tokenDoc.actor;

    const placeable = canvas?.tokens?.get?.(payload.tokenId) ?? canvas?.tokens?.placeables?.find?.(t => t?.id === payload.tokenId || t?.document?.id === payload.tokenId) ?? null;
    if (placeable?.actor) return placeable.actor;
    if (placeable?.document?.actor) return placeable.document.actor;
  }

  if (payload.actorId) return game.actors?.get?.(payload.actorId) ?? null;
  return null;
}

export function relayArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(relayArray).filter(Boolean);
  if (typeof value === "string") return value.split(/[,;|\n]+/).map(v => v.trim()).filter(Boolean);
  return [value];
}

export function relayNormalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[\s\-]+/g, "_")
    .replace(/_+/g, "_");
}

function familiarRelation(actor) {
  return actor?.getFlag?.(FAMILIAR_SCOPE, FAMILIAR_FLAG) ?? actor?.flags?.[FAMILIAR_SCOPE]?.[FAMILIAR_FLAG] ?? null;
}

function familiarEffectRelation(effect) {
  return effect?.flags?.[FAMILIAR_SCOPE]?.[FAMILIAR_FLAG] ?? effect?.getFlag?.(FAMILIAR_SCOPE, FAMILIAR_FLAG) ?? null;
}

function familiarArtworkSource(relation) {
  return FAMILIAR_ASSETS[String(relation?.key ?? "")] ?? null;
}

function familiarTokenMatches(tokenDoc, relation) {
  if (!tokenDoc || !relation?.linkId) return false;
  return tokenDoc.actorId === relation.actorId
    || tokenDoc.actor?.id === relation.actorId
    || tokenDoc.flags?.[FAMILIAR_SCOPE]?.[FAMILIAR_FLAG]?.linkId === relation.linkId;
}

async function syncFamiliarArtwork(caster) {
  if (!isResponsibleGM() || !caster) return false;
  const relation = familiarRelation(caster);
  const src = familiarArtworkSource(relation);
  if (!relation?.actorId || !relation?.linkId || !src) return false;

  const familiarActor = game.actors?.get?.(relation.actorId) ?? null;
  if (familiarActor) {
    const actorChanges = {};
    if (familiarActor.img !== src) actorChanges.img = src;
    if (familiarActor.prototypeToken?.texture?.src !== src) actorChanges["prototypeToken.texture.src"] = src;
    if (Object.keys(actorChanges).length) {
      await familiarActor.update(actorChanges, { add2eFamiliarArtworkRepair: true, add2eInternal: true });
    }
  }

  for (const scene of game.scenes?.contents ?? []) {
    const updates = Array.from(scene.tokens ?? [])
      .filter(tokenDoc => familiarTokenMatches(tokenDoc, relation) && tokenDoc.texture?.src !== src)
      .map(tokenDoc => ({ _id: tokenDoc.id, "texture.src": src }));
    if (updates.length) {
      await scene.updateEmbeddedDocuments("Token", updates, { add2eFamiliarArtworkRepair: true, render: true });
    }
  }

  const effectUpdates = Array.from(caster.effects ?? [])
    .filter(effect => familiarEffectRelation(effect)?.linkId === relation.linkId && effect.img !== src)
    .map(effect => effect.update({ img: src }, { add2eFamiliarArtworkRepair: true }));
  if (effectUpdates.length) await Promise.all(effectUpdates);
  return true;
}

function queueFamiliarArtworkSync(caster) {
  if (!isResponsibleGM() || !caster?.id || familiarArtworkQueue.has(caster.id)) return;
  familiarArtworkQueue.add(caster.id);
  setTimeout(() => {
    familiarArtworkQueue.delete(caster.id);
    syncFamiliarArtwork(caster).catch(error => console.error("[ADD2E][FAMILIAR][ARTWORK]", error));
  }, 50);
}

export function installFamiliarArtworkRepair() {
  if (globalThis.ADD2E_FAMILIAR_ARTWORK_REPAIR_VERSION === FAMILIAR_ARTWORK_REPAIR_VERSION) return true;
  globalThis.ADD2E_FAMILIAR_ARTWORK_REPAIR_VERSION = FAMILIAR_ARTWORK_REPAIR_VERSION;

  Hooks.on("createActiveEffect", effect => {
    if (!isResponsibleGM()) return;
    const data = familiarEffectRelation(effect);
    const caster = effect?.parent?.documentName === "Actor" ? effect.parent : null;
    if (data?.linkId && familiarRelation(caster)?.linkId === data.linkId) queueFamiliarArtworkSync(caster);
  });

  Hooks.on("createToken", tokenDoc => {
    if (!isResponsibleGM()) return;
    const data = tokenDoc?.flags?.[FAMILIAR_SCOPE]?.[FAMILIAR_FLAG] ?? null;
    const caster = data?.masterActorId ? game.actors?.get?.(data.masterActorId) ?? null : null;
    if (caster) queueFamiliarArtworkSync(caster);
  });

  Hooks.on("canvasReady", () => {
    if (!isResponsibleGM()) return;
    setTimeout(() => {
      for (const caster of game.actors?.contents ?? []) {
        if (familiarArtworkSource(familiarRelation(caster))) queueFamiliarArtworkSync(caster);
      }
    }, 100);
  });

  globalThis.add2eSyncFamiliarArtwork = () => Promise.all(
    Array.from(game.actors?.contents ?? [])
      .filter(caster => familiarArtworkSource(familiarRelation(caster)))
      .map(caster => syncFamiliarArtwork(caster))
  );
  return true;
}

installFamiliarArtworkRepair();
