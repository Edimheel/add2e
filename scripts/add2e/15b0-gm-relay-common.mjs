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
const FAMILIAR_ARTWORK_VERSION = "2026-06-27-familiar-artwork-v4";
const FAMILIAR_UI_VERSION = "2026-06-27-familiar-ui-v4";
const FAMILIAR_ASSETS = Object.freeze({
  chat_noir: "systems/add2e/assets/token/chat-noir.png",
  corbeau: "systems/add2e/assets/token/corbeau.png",
  faucon: "systems/add2e/assets/token/faucon.png",
  hibou: "systems/add2e/assets/token/hibou.png",
  crapaud: "systems/add2e/assets/token/crapaud.png",
  belette: "systems/add2e/assets/token/belette.png",
  quasit: "systems/add2e/assets/token/quasit.png",
  pseudo_dragon: "systems/add2e/assets/token/pseudo-dragon.png",
  lutin: "systems/add2e/assets/token/lutin.png",
  diablotin: "systems/add2e/assets/token/diablotin.png"
});
const artworkQueue = new Set();
let hudObserver = null;
let hudRefreshQueued = false;

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

function familiarLink(actor) {
  return actor?.getFlag?.(FAMILIAR_SCOPE, FAMILIAR_FLAG) ?? actor?.flags?.[FAMILIAR_SCOPE]?.[FAMILIAR_FLAG] ?? null;
}

function familiarData(effect) {
  return effect?.flags?.[FAMILIAR_SCOPE]?.[FAMILIAR_FLAG] ?? effect?.getFlag?.(FAMILIAR_SCOPE, FAMILIAR_FLAG) ?? null;
}

function familiarAction(name) {
  const value = String(name ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[—–-]/g, " ").replace(/\s+/g, " ").trim();
  if (value.startsWith("familier partage des sens") || value.startsWith("familier vision partagee")) return "share-senses";
  if (value.startsWith("familier suivi automatique")) return "toggle-follow";
  return "";
}

function registerHelpers() {
  if (typeof Handlebars === "undefined") return;
  if (!Handlebars.helpers.add2eFamiliarEffectAction) Handlebars.registerHelper("add2eFamiliarEffectAction", familiarAction);
  if (!Handlebars.helpers.add2eFamiliarEffectActionTitle) Handlebars.registerHelper("add2eFamiliarEffectActionTitle", action => action === "share-senses" ? "Centrer la scène sur le familier" : "Activer ou désactiver le suivi automatique");
  if (!Handlebars.helpers.add2eFamiliarEffectActionIcon) Handlebars.registerHelper("add2eFamiliarEffectActionIcon", action => action === "share-senses" ? "fa-eye" : "fa-link");
}

async function syncArtwork(caster) {
  if (!isResponsibleGM() || !caster) return false;
  const link = familiarLink(caster);
  const src = FAMILIAR_ASSETS[String(link?.key ?? "")];
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
      .filter(token => (token.actorId === link.actorId || token.flags?.add2e?.familiar?.linkId === link.linkId) && token.texture?.src !== src)
      .map(token => ({ _id: token.id, "texture.src": src }));
    if (updates.length) await scene.updateEmbeddedDocuments("Token", updates, { add2eFamiliarArtworkRepair: true, render: true });
  }
  const updates = Array.from(caster.effects ?? [])
    .filter(effect => familiarData(effect)?.linkId === link.linkId && effect.img !== src)
    .map(effect => effect.update({ img: src }, { add2eFamiliarArtworkRepair: true, add2eInternal: true }));
  if (updates.length) await Promise.all(updates);
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

function refreshHudControls() {
  hudRefreshQueued = false;
  const section = document.getElementById("add2e-action-hud")?.querySelector?.('[data-section="effets"]');
  if (!section) return;
  for (const row of section.querySelectorAll(".row.effect-row")) {
    if (["share-senses", "toggle-follow"].includes(familiarAction(row.querySelector(".title")?.textContent ?? ""))) row.remove();
  }
  for (const button of section.querySelectorAll(".a2e-hud-familiar-action")) {
    const actor = game.actors?.get?.(String(button.dataset.actorId ?? "")) ?? null;
    const link = familiarLink(actor);
    const action = String(button.dataset.familiarAction ?? "");
    const active = action === "toggle-follow" ? link?.follow !== false : link?.inRange === true;
    button.classList.toggle("add2e-familiar-active", active);
    button.classList.toggle("add2e-familiar-inactive", !active);
    button.style.borderColor = active ? "#5ccf7b" : "#e7a84c";
    button.style.background = active ? "rgba(36,132,70,.50)" : "rgba(178,104,20,.50)";
    button.style.color = active ? "#effff2" : "#fff2d8";
  }
}

function scheduleHudRefresh() {
  if (hudRefreshQueued) return;
  hudRefreshQueued = true;
  (globalThis.requestAnimationFrame ?? (callback => setTimeout(callback, 16)))(refreshHudControls);
}

function installUiBridge() {
  registerHelpers();
  if (globalThis.ADD2E_FAMILIAR_EFFECT_UI_VERSION === FAMILIAR_UI_VERSION) return;
  globalThis.ADD2E_FAMILIAR_EFFECT_UI_VERSION = FAMILIAR_UI_VERSION;
  document.addEventListener("click", async event => {
    const control = event.target?.closest?.(".a2e-familiar-effect-action");
    if (!control) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    const actor = game.actors?.get?.(String(control.dataset.actorId ?? "")) ?? null;
    const effect = actor?.effects?.get?.(String(control.dataset.effectId ?? "")) ?? null;
    const data = familiarData(effect);
    if (!actor || !effect || data?.kind !== "action" || data.action !== String(control.dataset.familiarAction ?? "")) return ui.notifications.warn("Cette action de familier n’est plus valide.");
    if (typeof globalThis.add2eUseFamiliarEffect !== "function") return ui.notifications.warn("Le relais de familier n’est pas disponible.");
    try {
      await globalThis.add2eUseFamiliarEffect(actor, effect);
      actor.sheet?.rendered && actor.sheet.render(false);
      globalThis.add2eRefreshActionHud?.();
      scheduleHudRefresh();
    } catch (error) {
      console.error("[ADD2E][FAMILIAR][ACTION]", error);
      ui.notifications.error("Impossible d’utiliser cette action de familier.");
    }
  }, true);
  Hooks.once("ready", () => {
    hudObserver ??= new MutationObserver(scheduleHudRefresh);
    hudObserver.observe(document.body, { childList: true, subtree: true });
    scheduleHudRefresh();
  });
}

function installArtworkRepair() {
  if (globalThis.ADD2E_FAMILIAR_ARTWORK_VERSION === FAMILIAR_ARTWORK_VERSION) return;
  globalThis.ADD2E_FAMILIAR_ARTWORK_VERSION = FAMILIAR_ARTWORK_VERSION;
  Hooks.on("createActiveEffect", effect => {
    if (!isResponsibleGM()) return;
    const caster = effect?.parent?.documentName === "Actor" ? effect.parent : null;
    if (familiarData(effect)?.linkId && familiarLink(caster)?.linkId === familiarData(effect)?.linkId) queueArtwork(caster);
  });
  Hooks.on("createToken", token => {
    if (!isResponsibleGM()) return;
    const caster = game.actors?.get?.(token?.flags?.add2e?.familiar?.masterActorId) ?? null;
    if (caster) queueArtwork(caster);
  });
  Hooks.on("updateActor", () => scheduleHudRefresh());
  Hooks.on("canvasReady", () => {
    if (isResponsibleGM()) setTimeout(() => {
      for (const actor of game.actors?.contents ?? []) if (FAMILIAR_ASSETS[String(familiarLink(actor)?.key ?? "")]) ) queueArtwork(actor);
    }, 100);
    scheduleHudRefresh();
  });
  globalThis.add2eSyncFamiliarArtwork = () => Promise.all(Array.from(game.actors?.contents ?? []).filter(actor => FAMILIAR_ASSETS[String(familiarLink(actor)?.key ?? "")]).map(actor => syncArtwork(actor)));
}

registerHelpers();
installArtworkRepair();
installUiBridge();
