// ADD2E — Utilitaires partagés du relais MJ.
// Compatible Foundry V13/V14/V15.

import "./15a-validation-hooks.mjs";
import "./15c-amitie-controller.mjs";

export const ADD2E_SOCKET = "system.add2e";
export const ADD2E_GM_OPERATION = "ADD2E_GM_OPERATION";
export const VENDOR_SCOPE = "add2e";
export const PROJECTILE_FLAG = "projectilesDepensesCombat";

const FAMILIAR_SCOPE = "add2e";
const FAMILIAR_FLAG = "familiar";
const FAMILIAR_ARTWORK_VERSION = "2026-06-27-familiar-artwork-single-relay-v3";
const FAMILIAR_EFFECT_UI_VERSION = "2026-06-27-familiar-effect-ui-single-relay-v3";
const FAMILIAR_SELECTION_FIX_VERSION = "2026-06-27-familiar-selection-single-relay-v1";
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

const artworkQueue = new Set();
const presentationQueue = new Set();
let hudObserver = null;
let hudPruneQueued = false;

export function isResponsibleGM() {
  if (!game.user?.isGM) return false;
  if (typeof game.user.isActiveGM === "boolean") return game.user.isActiveGM;
  return game.users?.activeGM?.id === game.user.id;
}

export function resolveScene(sceneId) {
  return game.scenes?.get?.(sceneId) ?? canvas?.scene ?? game.scenes?.active ?? null;
}

export async function resolveActor(payload = {}) {
  if (payload.actorUuid) {
    try {
      const doc = await fromUuid(payload.actorUuid);
      if (doc) return doc;
    } catch (error) {
      console.warn("[ADD2E][GM-RELAY] actorUuid non résolu :", payload.actorUuid, error);
    }
  }
  if (payload.tokenUuid) {
    try {
      const doc = await fromUuid(payload.tokenUuid);
      if (doc?.actor) return doc.actor;
      if (doc?.document?.actor) return doc.document.actor;
    } catch (error) {
      console.warn("[ADD2E][GM-RELAY] tokenUuid non résolu :", payload.tokenUuid, error);
    }
  }
  if (payload.tokenId) {
    const scene = resolveScene(payload.sceneId);
    const tokenDoc = scene?.tokens?.get?.(payload.tokenId) ?? canvas?.scene?.tokens?.get?.(payload.tokenId) ?? null;
    if (tokenDoc?.actor) return tokenDoc.actor;
    const placeable = canvas?.tokens?.get?.(payload.tokenId)
      ?? canvas?.tokens?.placeables?.find?.(entry => entry?.id === payload.tokenId || entry?.document?.id === payload.tokenId)
      ?? null;
    if (placeable?.actor) return placeable.actor;
    if (placeable?.document?.actor) return placeable.document.actor;
  }
  return payload.actorId ? game.actors?.get?.(payload.actorId) ?? null : null;
}

export function relayArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(relayArray).filter(Boolean);
  if (typeof value === "string") return value.split(/[,;|\n]+/).map(entry => entry.trim()).filter(Boolean);
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

function relation(actor) {
  return actor?.getFlag?.(FAMILIAR_SCOPE, FAMILIAR_FLAG) ?? actor?.flags?.[FAMILIAR_SCOPE]?.[FAMILIAR_FLAG] ?? null;
}

function effectData(effect) {
  return effect?.flags?.[FAMILIAR_SCOPE]?.[FAMILIAR_FLAG] ?? effect?.getFlag?.(FAMILIAR_SCOPE, FAMILIAR_FLAG) ?? null;
}

function assetFor(link) {
  return FAMILIAR_ASSETS[String(link?.key ?? "")] ?? null;
}

function tokenMatches(tokenDoc, link) {
  if (!tokenDoc || !link?.linkId) return false;
  return tokenDoc.actorId === link.actorId
    || tokenDoc.actor?.id === link.actorId
    || tokenDoc.flags?.[FAMILIAR_SCOPE]?.[FAMILIAR_FLAG]?.linkId === link.linkId;
}

function actionFromName(name) {
  const value = String(name ?? "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[—–-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (value.startsWith("familier partage des sens") || value.startsWith("familier vision partagee")) return "share-senses";
  if (value.startsWith("familier suivi automatique")) return "toggle-follow";
  return "";
}

function actionTitle(action) {
  return action === "share-senses" ? "Voir avec les sens du familier" : "Activer ou désactiver le suivi automatique";
}

function actionIcon(action) {
  return action === "share-senses" ? "fa-eye" : "fa-link";
}

function registerHelpers() {
  if (typeof Handlebars === "undefined") return;
  if (!Handlebars.helpers.add2eFamiliarEffectAction) Handlebars.registerHelper("add2eFamiliarEffectAction", actionFromName);
  if (!Handlebars.helpers.add2eFamiliarEffectActionTitle) Handlebars.registerHelper("add2eFamiliarEffectActionTitle", actionTitle);
  if (!Handlebars.helpers.add2eFamiliarEffectActionIcon) Handlebars.registerHelper("add2eFamiliarEffectActionIcon", actionIcon);
}

function effectTags(effect) {
  const value = effect?.flags?.add2e?.tags ?? effect?.getFlag?.("add2e", "tags") ?? [];
  return Array.isArray(value) ? value : relayArray(value);
}

function presentation(effect, link) {
  const data = effectData(effect);
  if (!data?.linkId || data.linkId !== link?.linkId) return null;
  const label = link.label ?? data.familiarLabel ?? "familier";
  const range = link.range ?? data.range ?? 12;
  const inRange = link.inRange !== false;
  if (data.kind === "action" && data.action === "share-senses") {
    return {
      name: `Familier — Vision partagée (${label})`,
      description: inRange ? `Action : utiliser l’œil pour sélectionner uniquement ${label}, centrer la scène et exploiter sa vision.` : `Action suspendue : ${label} est hors de portée de ${range} cases.`
    };
  }
  if (data.kind === "action" && data.action === "toggle-follow") {
    const active = link.follow !== false;
    return {
      name: `Familier — Suivi automatique (${active ? "actif" : "désactivé"})`,
      description: active ? `Actif : ${label} suit le token du magicien. Utiliser le lien pour le passer en déplacement libre.` : `Désactivé : ${label} reste en déplacement libre. Utiliser le lien pour réactiver le suivi.`
    };
  }
  if (data.kind === "benefit" && effectTags(effect).some(tag => String(tag).startsWith("familier:sens:"))) {
    const senses = String(data.senses ?? effect.description ?? "Sens propres du familier.").replace(/<[^>]*>/g, "").trim();
    return {
      name: `Familier — Sens transmis (${label})`,
      description: `Bénéfice passif à ${range} cases ou moins : ${senses} Utiliser « Vision partagée » pour observer depuis le token du familier.`,
      senses
    };
  }
  return null;
}

async function syncPresentation(caster) {
  if (!isResponsibleGM() || !caster) return false;
  const link = relation(caster);
  if (!link?.linkId || !link?.actorId) return false;
  const updates = [];
  for (const effect of caster.effects ?? []) {
    const display = presentation(effect, link);
    if (!display) continue;
    const data = effectData(effect) ?? {};
    const update = {};
    if (effect.name !== display.name) update.name = display.name;
    if (effect.description !== display.description) update.description = display.description;
    if (display.senses && data.senses !== display.senses) update["flags.add2e.familiar.senses"] = display.senses;
    if (Object.keys(update).length) updates.push(effect.update(update, { add2eFamiliarPresentation: true, add2eInternal: true }));
  }
  if (updates.length) await Promise.all(updates);
  return updates.length > 0;
}

function queuePresentation(caster) {
  if (!isResponsibleGM() || !caster?.id || presentationQueue.has(caster.id)) return;
  presentationQueue.add(caster.id);
  setTimeout(() => {
    presentationQueue.delete(caster.id);
    syncPresentation(caster).catch(error => console.error("[ADD2E][FAMILIAR][PRESENTATION]", error));
  }, 25);
}

async function syncArtwork(caster) {
  if (!isResponsibleGM() || !caster) return false;
  const link = relation(caster);
  const src = assetFor(link);
  if (!link?.actorId || !link?.linkId || !src) return false;
  const familiar = game.actors?.get?.(link.actorId) ?? null;
  if (familiar) {
    const update = {};
    if (familiar.img !== src) update.img = src;
    if (familiar.prototypeToken?.texture?.src !== src) update["prototypeToken.texture.src"] = src;
    if (Object.keys(update).length) await familiar.update(update, { add2eFamiliarArtworkRepair: true, add2eInternal: true });
  }
  for (const scene of game.scenes?.contents ?? []) {
    const updates = Array.from(scene.tokens ?? [])
      .filter(tokenDoc => tokenMatches(tokenDoc, link) && tokenDoc.texture?.src !== src)
      .map(tokenDoc => ({ _id: tokenDoc.id, "texture.src": src }));
    if (updates.length) await scene.updateEmbeddedDocuments("Token", updates, { add2eFamiliarArtworkRepair: true, render: true });
  }
  const effects = Array.from(caster.effects ?? [])
    .filter(effect => effectData(effect)?.linkId === link.linkId && effect.img !== src)
    .map(effect => effect.update({ img: src }, { add2eFamiliarArtworkRepair: true, add2eInternal: true }));
  if (effects.length) await Promise.all(effects);
  return true;
}

function queueArtwork(caster) {
  if (!isResponsibleGM() || !caster?.id || artworkQueue.has(caster.id)) return;
  artworkQueue.add(caster.id);
  setTimeout(() => {
    artworkQueue.delete(caster.id);
    syncArtwork(caster).catch(error => console.error("[ADD2E][FAMILIAR][ARTWORK]", error));
  }, 50);
}

function pruneHudRows() {
  hudPruneQueued = false;
  const section = document.getElementById("add2e-action-hud")?.querySelector?.('[data-section="effets"]');
  if (!section) return;
  for (const row of section.querySelectorAll(".row.effect-row")) {
    if (["share-senses", "toggle-follow"].includes(actionFromName(row.querySelector(".title")?.textContent ?? ""))) row.remove();
  }
}

function scheduleHudPrune() {
  if (hudPruneQueued) return;
  hudPruneQueued = true;
  (globalThis.requestAnimationFrame ?? (callback => setTimeout(callback, 16)))(pruneHudRows);
}

function selectOnlyFamiliar(actor) {
  const link = relation(actor);
  if (!link?.tokenId || canvas?.scene?.id !== link.sceneId) return false;
  const placeable = canvas?.tokens?.get?.(link.tokenId)
    ?? canvas?.tokens?.placeables?.find?.(token => token?.id === link.tokenId || token?.document?.id === link.tokenId)
    ?? null;
  if (!placeable?.actor?.isOwner) return false;
  canvas?.tokens?.releaseAll?.();
  placeable.control?.({ releaseOthers: true });
  canvas?.animatePan?.({ x: placeable.center?.x, y: placeable.center?.y, duration: 250 });
  return true;
}

function installUiBridge() {
  registerHelpers();
  if (globalThis.ADD2E_FAMILIAR_EFFECT_UI_VERSION === FAMILIAR_EFFECT_UI_VERSION) return;
  globalThis.ADD2E_FAMILIAR_EFFECT_UI_VERSION = FAMILIAR_EFFECT_UI_VERSION;
  document.addEventListener("click", async event => {
    const control = event.target?.closest?.(".a2e-familiar-effect-action");
    if (!control) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    const actor = game.actors?.get?.(String(control.dataset.actorId ?? "")) ?? null;
    const effect = actor?.effects?.get?.(String(control.dataset.effectId ?? "")) ?? null;
    const data = effectData(effect);
    if (!actor || !effect || data?.kind !== "action" || data.action !== String(control.dataset.familiarAction ?? "")) return ui.notifications.warn("Cette action de familier n’est plus valide.");
    if (typeof globalThis.add2eUseFamiliarEffect !== "function") return ui.notifications.warn("Le relais de familier n’est pas disponible.");
    try {
      await globalThis.add2eUseFamiliarEffect(actor, effect);
      actor.sheet?.rendered && actor.sheet.render(false);
      globalThis.add2eRefreshActionHud?.();
    } catch (error) {
      console.error("[ADD2E][FAMILIAR][ACTION]", error);
      ui.notifications.error("Impossible d’utiliser cette action de familier.");
    }
  }, true);
  Hooks.once("ready", () => {
    hudObserver ??= new MutationObserver(scheduleHudPrune);
    hudObserver.observe(document.body, { childList: true, subtree: true });
    scheduleHudPrune();
  });
}

function installSelectionFix() {
  if (globalThis.ADD2E_FAMILIAR_SELECTION_FIX_VERSION === FAMILIAR_SELECTION_FIX_VERSION) return;
  globalThis.ADD2E_FAMILIAR_SELECTION_FIX_VERSION = FAMILIAR_SELECTION_FIX_VERSION;
  Hooks.once("ready", () => {
    const original = globalThis.add2eUseFamiliarEffect;
    if (typeof original !== "function" || original.__add2eSingleSelectionPatch) return;
    const wrapped = async function add2eUseFamiliarEffectWithSingleSelection(actor, effect, ...args) {
      const action = effectData(effect)?.action;
      const result = await original.call(this, actor, effect, ...args);
      if (result && action === "share-senses") selectOnlyFamiliar(actor);
      return result;
    };
    wrapped.__add2eSingleSelectionPatch = true;
    globalThis.add2eUseFamiliarEffect = wrapped;
  });
}

function installArtworkAndPresentation() {
  if (globalThis.ADD2E_FAMILIAR_ARTWORK_VERSION === FAMILIAR_ARTWORK_VERSION) return;
  globalThis.ADD2E_FAMILIAR_ARTWORK_VERSION = FAMILIAR_ARTWORK_VERSION;
  Hooks.on("createActiveEffect", effect => {
    if (!isResponsibleGM()) return;
    const caster = effect?.parent?.documentName === "Actor" ? effect.parent : null;
    const data = effectData(effect);
    if (data?.linkId && relation(caster)?.linkId === data.linkId) {
      queueArtwork(caster);
      queuePresentation(caster);
    }
  });
  Hooks.on("createToken", tokenDoc => {
    if (!isResponsibleGM()) return;
    const masterActorId = tokenDoc?.flags?.[FAMILIAR_SCOPE]?.[FAMILIAR_FLAG]?.masterActorId;
    const caster = masterActorId ? game.actors?.get?.(masterActorId) ?? null : null;
    if (caster) {
      queueArtwork(caster);
      queuePresentation(caster);
    }
  });
  Hooks.on("updateActor", actor => {
    if (isResponsibleGM() && relation(actor)?.linkId) queuePresentation(actor);
  });
  Hooks.on("canvasReady", () => {
    if (!isResponsibleGM()) return;
    setTimeout(() => {
      for (const actor of game.actors?.contents ?? []) {
        if (!relation(actor)?.linkId) continue;
        queueArtwork(actor);
        queuePresentation(actor);
      }
    }, 100);
  });
  globalThis.add2eSyncFamiliarArtwork = () => Promise.all(
    Array.from(game.actors?.contents ?? []).filter(actor => assetFor(relation(actor))).map(actor => syncArtwork(actor))
  );
}

registerHelpers();
installArtworkAndPresentation();
installUiBridge();
installSelectionFix();
