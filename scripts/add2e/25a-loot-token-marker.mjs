// ============================================================================
// ADD2E — Marqueur visuel de butin sur les tokens de monstres morts
// Compatible Foundry V13/V14/V15.
//
// Ce module ne transfère rien : il réutilise exclusivement la détection de mort
// du moteur de butin et les fonctions partagées de monnaie/quantité.
// ============================================================================

import { add2eIsDeadLootMonster } from "./25-loot.mjs";
import {
  add2eTradeGetMoney,
  add2eTradeHasMoney,
  add2eTradeItemQuantity
} from "./24-player-trades.mjs";

export const ADD2E_LOOT_TOKEN_MARKER_VERSION = "2026-07-12-loot-token-overlay-suppression-v3";

const ADD2E_LOOT_TOKEN_CHEST_IMG = "icons/containers/chest/chest-reinforced-steel-pink.webp";
const ADD2E_LOOT_TOKEN_OLD_CHEST_IMG = "icons/containers/chest/chest-reinforced-brown.webp";
const ADD2E_LOOT_TOKEN_MARKER_FLAG = "lootTokenMarker";
const ADD2E_LOOT_OVERLAY_SUPPRESSION_FLAG = "lootOverlaySuppression";
const ADD2E_LOOT_TOKEN_MARKER_TEXTURES = new Set([
  ADD2E_LOOT_TOKEN_CHEST_IMG,
  ADD2E_LOOT_TOKEN_OLD_CHEST_IMG
]);
const ADD2E_LOOT_TOKEN_ITEM_TYPES = new Set([
  "arme", "weapon", "armure", "armor", "objet", "item",
  "equipement", "equipment", "consommable", "consumable",
  "loot", "conteneur", "container"
]);

const add2eLootTokenPending = new Map();
const add2eLootTokenRunning = new Set();

function add2eLootTokenResponsibleGM() {
  if (!game.user?.isGM) return false;
  if (typeof game.user.isActiveGM === "boolean") return game.user.isActiveGM;
  const activeGM = game.users?.activeGM
    ?? Array.from(game.users ?? []).find(user => user.active && user.isGM)
    ?? null;
  return !activeGM || activeGM.id === game.user.id;
}

function add2eLootTokenFlag(tokenDocument) {
  try {
    return tokenDocument?.getFlag?.("add2e", ADD2E_LOOT_TOKEN_MARKER_FLAG)
      ?? tokenDocument?.flags?.add2e?.[ADD2E_LOOT_TOKEN_MARKER_FLAG]
      ?? {};
  } catch (_error) {
    return tokenDocument?.flags?.add2e?.[ADD2E_LOOT_TOKEN_MARKER_FLAG] ?? {};
  }
}

function add2eLootTokenIsRecoverableItem(item) {
  if (!item || !ADD2E_LOOT_TOKEN_ITEM_TYPES.has(String(item.type ?? "").toLowerCase())) return false;

  const system = item.system ?? {};
  const flags = item.flags?.add2e ?? {};
  if (flags.naturalAttack === true || flags.isNaturalAttack === true) return false;
  if (system.naturalAttack === true || system.isNaturalAttack === true || system.naturelle === true) return false;

  return add2eTradeItemQuantity(item) > 0;
}

export function add2eLootTokenHasContent(actor) {
  if (!actor) return false;
  if (Array.from(actor.items ?? []).some(add2eLootTokenIsRecoverableItem)) return true;
  return add2eTradeHasMoney(add2eTradeGetMoney(actor));
}

function add2eLootTokenKey(tokenDocument) {
  return tokenDocument?.uuid
    ?? `${tokenDocument?.parent?.id ?? "scene"}:${tokenDocument?.id ?? "token"}`;
}

function add2eLootTokenCurrentTexture(tokenDocument) {
  return String(tokenDocument?.texture?.src ?? tokenDocument?.object?.document?.texture?.src ?? "");
}

function add2eLootTokenIsMarkerTexture(texture, marker = {}) {
  const current = String(texture ?? "").trim();
  if (!current) return false;
  if (ADD2E_LOOT_TOKEN_MARKER_TEXTURES.has(current)) return true;
  return current === String(marker?.markerTexture ?? "").trim();
}

function add2eLootTokenOriginalTexture(tokenDocument, actor, marker = {}) {
  const stored = String(marker?.originalTexture ?? "").trim();
  if (stored) return stored;

  const current = add2eLootTokenCurrentTexture(tokenDocument);
  if (current && !add2eLootTokenIsMarkerTexture(current, marker)) return current;

  return String(
    actor?.prototypeToken?.texture?.src
      ?? actor?.img
      ?? current
      ?? "icons/svg/mystery-man.svg"
  );
}

function add2eLootTokenNorm(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function add2eLootTokenActorEffects(actor) {
  return Array.from(actor?.effects?.contents ?? actor?.effects ?? []);
}

function add2eLootTokenIsDeadEffect(effect) {
  if (!effect) return false;
  const statuses = Array.from(effect.statuses ?? effect.system?.statuses ?? []).map(add2eLootTokenNorm);
  return statuses.includes("dead")
    || add2eLootTokenNorm(effect.flags?.core?.statusId) === "dead"
    || add2eLootTokenNorm(effect.flags?.add2e?.vitalStatus) === "dead"
    || add2eLootTokenNorm(effect.name) === "mort";
}

function add2eLootTokenDeadEffect(actor) {
  return add2eLootTokenActorEffects(actor).find(add2eLootTokenIsDeadEffect) ?? null;
}

function add2eLootTokenOverlaySuppression(effect) {
  return effect?.flags?.add2e?.[ADD2E_LOOT_OVERLAY_SUPPRESSION_FLAG] ?? {};
}

function add2eLootTokenSuppressedEffect(actor) {
  return add2eLootTokenActorEffects(actor).find(effect => {
    return add2eLootTokenOverlaySuppression(effect)?.active === true;
  }) ?? null;
}

function add2eLootTokenHasOtherActiveMarker(actor, currentTokenDocument) {
  const currentKey = add2eLootTokenKey(currentTokenDocument);
  return add2eLootTokenDocumentsForActor(actor).some(tokenDocument => {
    if (add2eLootTokenKey(tokenDocument) === currentKey) return false;
    const marker = add2eLootTokenFlag(tokenDocument);
    const texture = add2eLootTokenCurrentTexture(tokenDocument);
    return marker?.active === true && add2eLootTokenIsMarkerTexture(texture, marker);
  });
}

async function add2eLootTokenSuppressDeadOverlay(actor) {
  const effect = add2eLootTokenDeadEffect(actor);
  if (!effect?.update) return false;

  const suppression = add2eLootTokenOverlaySuppression(effect);
  if (suppression?.active === true) {
    if (effect.flags?.core?.overlay === false) return false;
    await effect.update({
      "flags.core.overlay": false
    }, { add2eLootTokenMarkerOverlay: true });
    return true;
  }

  if (effect.flags?.core?.overlay !== true) return false;

  await effect.update({
    "flags.core.overlay": false,
    [`flags.add2e.${ADD2E_LOOT_OVERLAY_SUPPRESSION_FLAG}`]: {
      active: true,
      previousOverlay: true,
      version: ADD2E_LOOT_TOKEN_MARKER_VERSION,
      hiddenAt: Date.now()
    }
  }, { add2eLootTokenMarkerOverlay: true });
  return true;
}

async function add2eLootTokenRestoreDeadOverlay(actor, tokenDocument) {
  if (!actor || add2eLootTokenHasOtherActiveMarker(actor, tokenDocument)) return false;

  const effect = add2eLootTokenSuppressedEffect(actor);
  if (!effect?.update) return false;

  const suppression = add2eLootTokenOverlaySuppression(effect);
  if (suppression?.active !== true) return false;

  const update = {
    [`flags.add2e.${ADD2E_LOOT_OVERLAY_SUPPRESSION_FLAG}`]: {
      ...suppression,
      active: false,
      version: ADD2E_LOOT_TOKEN_MARKER_VERSION,
      restoredAt: Date.now()
    }
  };

  if (suppression.previousOverlay === true && add2eLootTokenIsDeadEffect(effect) && add2eIsDeadLootMonster(actor)) {
    update["flags.core.overlay"] = true;
  }

  await effect.update(update, { add2eLootTokenMarkerOverlay: true });
  return true;
}

async function add2eLootSyncTokenMarker(tokenDocument) {
  if (!add2eLootTokenResponsibleGM() || !tokenDocument?.update) return false;

  const key = add2eLootTokenKey(tokenDocument);
  if (add2eLootTokenRunning.has(key)) return false;
  add2eLootTokenRunning.add(key);

  try {
    const actor = tokenDocument.actor ?? tokenDocument.object?.actor ?? null;
    const marker = add2eLootTokenFlag(tokenDocument);
    const currentTexture = add2eLootTokenCurrentTexture(tokenDocument);
    const shouldDisplayChest = Boolean(
      actor
      && add2eIsDeadLootMonster(actor)
      && add2eLootTokenHasContent(actor)
    );

    if (shouldDisplayChest) {
      const overlayChanged = await add2eLootTokenSuppressDeadOverlay(actor);
      const overlaySuppressed = add2eLootTokenOverlaySuppression(add2eLootTokenDeadEffect(actor))?.active === true;
      const markerCurrent = marker?.active === true
        && currentTexture === ADD2E_LOOT_TOKEN_CHEST_IMG
        && marker?.deadOverlaySuppressed === overlaySuppressed
        && marker?.version === ADD2E_LOOT_TOKEN_MARKER_VERSION;
      if (markerCurrent) return overlayChanged;

      const originalTexture = add2eLootTokenOriginalTexture(tokenDocument, actor, marker);
      await tokenDocument.update({
        "texture.src": ADD2E_LOOT_TOKEN_CHEST_IMG,
        [`flags.add2e.${ADD2E_LOOT_TOKEN_MARKER_FLAG}`]: {
          ...marker,
          active: true,
          originalTexture,
          markerTexture: ADD2E_LOOT_TOKEN_CHEST_IMG,
          deadOverlaySuppressed: overlaySuppressed,
          version: ADD2E_LOOT_TOKEN_MARKER_VERSION,
          markedAt: marker?.active === true ? marker?.markedAt ?? Date.now() : Date.now()
        }
      }, { add2eLootTokenMarker: true });
      return true;
    }

    const overlayChanged = await add2eLootTokenRestoreDeadOverlay(actor, tokenDocument);
    if (marker?.active !== true) return overlayChanged;

    const update = {
      [`flags.add2e.${ADD2E_LOOT_TOKEN_MARKER_FLAG}`]: {
        ...marker,
        active: false,
        markerTexture: ADD2E_LOOT_TOKEN_CHEST_IMG,
        deadOverlaySuppressed: false,
        version: ADD2E_LOOT_TOKEN_MARKER_VERSION,
        clearedAt: Date.now()
      }
    };

    // Ne remplace pas une image modifiée manuellement pendant que le marqueur
    // était actif. Les textures de coffre ADD2E v1 et v2 sont reconnues.
    if (add2eLootTokenIsMarkerTexture(currentTexture, marker)) {
      update["texture.src"] = add2eLootTokenOriginalTexture(tokenDocument, actor, marker);
    }

    await tokenDocument.update(update, { add2eLootTokenMarker: true });
    return true;
  } catch (error) {
    console.error("[ADD2E][LOOT_TOKEN_MARKER] Synchronisation impossible", {
      token: tokenDocument?.name ?? tokenDocument?.id ?? null,
      error
    });
    return false;
  } finally {
    add2eLootTokenRunning.delete(key);
  }
}

function add2eLootScheduleTokenMarker(tokenDocument, delay = 40) {
  if (!add2eLootTokenResponsibleGM() || !tokenDocument) return;

  const key = add2eLootTokenKey(tokenDocument);
  const previous = add2eLootTokenPending.get(key);
  if (previous) clearTimeout(previous);

  const timer = setTimeout(async () => {
    add2eLootTokenPending.delete(key);
    await add2eLootSyncTokenMarker(tokenDocument);
  }, Math.max(0, Number(delay) || 0));

  add2eLootTokenPending.set(key, timer);
}

function add2eLootTokenDocumentsForActor(actor) {
  const documents = new Map();
  if (!actor) return [];

  const ownToken = actor.token?.document ?? actor.token ?? null;
  if (ownToken?.id) documents.set(add2eLootTokenKey(ownToken), ownToken);

  const actorUuid = String(actor.uuid ?? "");
  const actorId = String(actor.id ?? "");
  for (const tokenDocument of canvas?.scene?.tokens?.contents ?? []) {
    const tokenActor = tokenDocument?.actor ?? null;
    if (!tokenActor) continue;

    const sameActor = tokenActor === actor
      || (actorUuid && String(tokenActor.uuid ?? "") === actorUuid)
      || (actorId && String(tokenActor.id ?? "") === actorId)
      || (actorId && String(tokenDocument.actorId ?? "") === actorId);

    if (sameActor) documents.set(add2eLootTokenKey(tokenDocument), tokenDocument);
  }

  return [...documents.values()];
}

function add2eLootScheduleActorMarkers(actor, delay = 40) {
  const documents = add2eLootTokenDocumentsForActor(actor);
  for (const tokenDocument of documents) add2eLootScheduleTokenMarker(tokenDocument, delay);

  // Les acteurs synthétiques et non liés peuvent ne pas partager l'identifiant
  // du document source. Un balayage différé garantit alors la restauration.
  if (!documents.length) setTimeout(add2eLootSyncCanvasMarkers, Math.max(0, Number(delay) || 0));
}

function add2eLootSyncCanvasMarkers() {
  if (!add2eLootTokenResponsibleGM()) return;
  for (const tokenDocument of canvas?.scene?.tokens?.contents ?? []) {
    add2eLootScheduleTokenMarker(tokenDocument, 0);
  }
}

function add2eLootParentActor(document) {
  const parent = document?.parent ?? document?.actor ?? null;
  if (parent?.documentName === "Actor" || parent?.constructor?.metadata?.name === "Actor") return parent;
  return null;
}

function add2eLootInstallTokenMarkerHooks() {
  Hooks.on("canvasReady", add2eLootSyncCanvasMarkers);

  Hooks.on("createToken", tokenDocument => {
    add2eLootScheduleTokenMarker(tokenDocument, 80);
  });

  Hooks.on("updateToken", (tokenDocument, _changes, options = {}) => {
    if (options?.add2eLootTokenMarker === true) return;
    add2eLootScheduleTokenMarker(tokenDocument, 60);
  });

  Hooks.on("updateActor", actor => {
    add2eLootScheduleActorMarkers(actor, 40);
    setTimeout(add2eLootSyncCanvasMarkers, 120);
  });

  for (const hook of ["createItem", "updateItem", "deleteItem"]) {
    Hooks.on(hook, item => {
      const actor = add2eLootParentActor(item);
      if (actor) add2eLootScheduleActorMarkers(actor, 40);
      setTimeout(add2eLootSyncCanvasMarkers, 120);
    });
  }

  for (const hook of ["createActiveEffect", "updateActiveEffect", "deleteActiveEffect"]) {
    Hooks.on(hook, effect => {
      const actor = add2eLootParentActor(effect);
      if (actor) add2eLootScheduleActorMarkers(actor, 40);
      setTimeout(add2eLootSyncCanvasMarkers, 120);
    });
  }

  setTimeout(add2eLootSyncCanvasMarkers, 500);
}

Hooks.once("ready", () => {
  add2eLootInstallTokenMarkerHooks();

  game.add2e ??= {};
  game.add2e.lootTokenMarker = {
    version: ADD2E_LOOT_TOKEN_MARKER_VERSION,
    chestImage: ADD2E_LOOT_TOKEN_CHEST_IMG,
    hasContent: add2eLootTokenHasContent,
    syncToken: add2eLootSyncTokenMarker,
    syncActor: add2eLootScheduleActorMarkers,
    syncCanvas: add2eLootSyncCanvasMarkers
  };

  globalThis.ADD2E_LOOT_TOKEN_MARKER_VERSION = ADD2E_LOOT_TOKEN_MARKER_VERSION;
});