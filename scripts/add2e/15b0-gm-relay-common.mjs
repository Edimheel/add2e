// ADD2E — Relais MJ : utilitaires partagés.

export const ADD2E_SOCKET = "system.add2e";
export const ADD2E_GM_OPERATION = "ADD2E_GM_OPERATION";
export const VENDOR_SCOPE = "add2e";
export const PROJECTILE_FLAG = "projectilesDepensesCombat";

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

  if (payload.sceneId && payload.tokenId) {
    const scene = resolveScene(payload.sceneId);
    const tokenDoc = scene?.tokens?.get(payload.tokenId);
    if (tokenDoc?.actor) return tokenDoc.actor;
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
