// ADD2E — Relais MJ : utilitaires partagés.
// Compatible Foundry V13/V14/V15.

export const ADD2E_SOCKET = "system.add2e";
export const ADD2E_GM_OPERATION = "ADD2E_GM_OPERATION";
export const VENDOR_SCOPE = "add2e";
export const PROJECTILE_FLAG = "projectilesDepensesCombat";

const FAMILIAR_SCOPE = "add2e";
const FAMILIAR_FLAG = "familiar";
const FAMILIAR_ARTWORK_REPAIR_VERSION = "2026-06-27-familiar-artwork-png-v2";
const FAMILIAR_EFFECT_ACTION_BRIDGE_VERSION = "2026-06-27-familiar-effect-actions-v2";
const FAMILIAR_FOLLOW_BRIDGE_VERSION = "2026-06-27-familiar-follow-default-v1";
const FAMILIAR_EFFECT_PRESENTATION_VERSION = "2026-06-27-familiar-effect-presentation-v1";
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
const familiarFollowQueue = new Set();
const familiarEffectPresentationQueue = new Set();

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
    const tokenDoc = scene?.tokens?.get(payload.tokenId) ?? canvas?.scene?.tokens?.get?.(payload.tokenId) ?? null;
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

function familiarIsCasterRelation(relation) {
  return !!(relation?.linkId && relation?.actorId);
}

function familiarEffectActionForName(name) {
  const normalized = String(name ?? "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[—–-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (normalized.startsWith("familier partage des sens") || normalized.startsWith("familier vision partagee")) return "share-senses";
  if (normalized.startsWith("familier suivi automatique")) return "toggle-follow";
  return "";
}

function familiarEffectActionTitle(action) {
  if (action === "share-senses") return "Voir avec les sens du familier";
  if (action === "toggle-follow") return "Activer ou désactiver le suivi automatique";
  return "Utiliser l’effet de familier";
}

function familiarEffectActionIcon(action) {
  return action === "share-senses" ? "fa-eye" : "fa-link";
}

function registerFamiliarEffectHandlebarsHelpers() {
  if (typeof Handlebars === "undefined") return false;
  if (!Handlebars.helpers.add2eFamiliarEffectAction) {
    Handlebars.registerHelper("add2eFamiliarEffectAction", familiarEffectActionForName);
  }
  if (!Handlebars.helpers.add2eFamiliarEffectActionTitle) {
    Handlebars.registerHelper("add2eFamiliarEffectActionTitle", familiarEffectActionTitle);
  }
  if (!Handlebars.helpers.add2eFamiliarEffectActionIcon) {
    Handlebars.registerHelper("add2eFamiliarEffectActionIcon", familiarEffectActionIcon);
  }
  return true;
}

function familiarSceneGridSize(scene) {
  return Math.max(1, Number(scene?.grid?.size ?? canvas?.grid?.size ?? 100) || 100);
}

function familiarTokenForRelation(scene, relation) {
  if (!scene || !relation?.actorId) return null;
  const preferred = relation.tokenId ? scene.tokens?.get?.(relation.tokenId) ?? null : null;
  if (preferred?.actorId === relation.actorId || preferred?.actor?.id === relation.actorId) return preferred;
  return Array.from(scene.tokens ?? []).find(tokenDoc => familiarTokenMatches(tokenDoc, relation)) ?? null;
}

function familiarFollowOffset(relation, masterToken, familiarToken, scene) {
  const saved = relation?.followOffset;
  const savedX = Number(saved?.x);
  const savedY = Number(saved?.y);
  if (Number.isFinite(savedX) && Number.isFinite(savedY)) return { x: savedX, y: savedY };

  const x = Number(familiarToken?.x) - Number(masterToken?.x);
  const y = Number(familiarToken?.y) - Number(masterToken?.y);
  if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
  return { x: familiarSceneGridSize(scene), y: 0 };
}

async function syncDefaultFamiliarFollow(masterToken, changes = {}, options = {}) {
  if (!isResponsibleGM() || options?.add2eFamiliarFollow === true) return false;
  if (changes.x === undefined && changes.y === undefined) return false;

  const caster = masterToken?.actor ?? game.actors?.get?.(masterToken?.actorId) ?? null;
  const relation = familiarRelation(caster);
  if (!caster || !familiarIsCasterRelation(relation) || relation.follow === false) return false;

  const scene = masterToken?.parent ?? resolveScene(relation.sceneId);
  const familiarToken = familiarTokenForRelation(scene, relation);
  if (!scene || !familiarToken) return false;

  const offset = familiarFollowOffset(relation, masterToken, familiarToken, scene);
  const nextRelation = {
    ...relation,
    sceneId: scene.id ?? relation.sceneId ?? null,
    masterTokenId: masterToken.id ?? relation.masterTokenId ?? null,
    tokenId: familiarToken.id ?? relation.tokenId ?? null,
    follow: true,
    followOffset: offset
  };
  if (
    relation.follow !== true
    || relation.sceneId !== nextRelation.sceneId
    || relation.masterTokenId !== nextRelation.masterTokenId
    || relation.tokenId !== nextRelation.tokenId
    || Number(relation.followOffset?.x) !== offset.x
    || Number(relation.followOffset?.y) !== offset.y
  ) {
    await caster.setFlag(FAMILIAR_SCOPE, FAMILIAR_FLAG, nextRelation);
  }

  const x = Number(masterToken.x) + offset.x;
  const y = Number(masterToken.y) + offset.y;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  if (Math.abs(Number(familiarToken.x) - x) < 0.01 && Math.abs(Number(familiarToken.y) - y) < 0.01) return true;

  await familiarToken.update({ x, y }, {
    add2eFamiliarFollow: true,
    add2eIgnoreMovement: true,
    render: true
  });
  return true;
}

function queueDefaultFamiliarFollow(masterToken, changes, options) {
  if (!isResponsibleGM() || !masterToken?.id || (changes?.x === undefined && changes?.y === undefined)) return;
  const key = `${masterToken.parent?.id ?? "scene"}:${masterToken.id}`;
  if (familiarFollowQueue.has(key)) return;
  familiarFollowQueue.add(key);
  setTimeout(() => {
    familiarFollowQueue.delete(key);
    syncDefaultFamiliarFollow(masterToken, changes ?? {}, options ?? {}).catch(error => console.error("[ADD2E][FAMILIAR][FOLLOW]", error));
  }, 0);
}

function familiarTags(effect) {
  const raw = effect?.flags?.add2e?.tags ?? effect?.getFlag?.("add2e", "tags") ?? [];
  return Array.isArray(raw) ? raw : String(raw ?? "").split(/[,;|\n]+/).map(value => value.trim()).filter(Boolean);
}

function familiarSensoryText(effect, data) {
  const recorded = String(data?.senses ?? "").trim();
  if (recorded) return recorded;
  const desc = String(effect?.description ?? "").replace(/<[^>]*>/g, "").trim();
  if (desc && !desc.startsWith("Bénéfice passif")) return desc;
  return "Sens propres du familier disponibles par la vision partagée.";
}

function familiarPresentationForEffect(effect, relation) {
  const data = familiarEffectRelation(effect);
  if (!data?.linkId || data.linkId !== relation?.linkId) return null;
  const tags = familiarTags(effect);
  const action = data.kind === "action" ? String(data.action ?? "") : "";
  const inRange = relation.inRange !== false;

  if (action === "share-senses") {
    return {
      name: `Familier — Vision partagée (${relation.label ?? data.familiarLabel ?? "familier"})`,
      description: inRange
        ? `Action : cliquer sur l’œil pour sélectionner le token de ${relation.label ?? data.familiarLabel ?? "familier"}, centrer la carte et utiliser sa vision de scène.`
        : `Action suspendue : ${relation.label ?? data.familiarLabel ?? "Le familier"} est hors de portée de ${relation.range ?? 12} cases.`
    };
  }

  if (action === "toggle-follow") {
    const follow = relation.follow !== false;
    return {
      name: `Familier — Suivi automatique (${follow ? "actif" : "désactivé"})`,
      description: follow
        ? `Actif par défaut : ${relation.label ?? data.familiarLabel ?? "le familier"} conserve sa position relative et suit chaque déplacement du token du magicien. Cliquer sur le lien pour le laisser en déplacement libre.`
        : `Désactivé : ${relation.label ?? data.familiarLabel ?? "le familier"} reste en déplacement libre. Cliquer sur le lien pour réactiver le suivi automatique.`
    };
  }

  const isSensoryBenefit = data.kind === "benefit" && tags.some(tag => String(tag).startsWith("familier:sens:"));
  if (isSensoryBenefit) {
    const senses = familiarSensoryText(effect, data);
    return {
      name: `Familier — Sens transmis (${relation.label ?? data.familiarLabel ?? "familier"})`,
      description: `Bénéfice passif à ${relation.range ?? 12} cases ou moins : ${senses} Utiliser l’effet « Vision partagée » pour sélectionner le token et exploiter ces sens sur la scène.` ,
      senses
    };
  }

  return null;
}

async function syncFamiliarEffectPresentation(caster) {
  if (!isResponsibleGM() || !caster) return false;
  const relation = familiarRelation(caster);
  if (!familiarIsCasterRelation(relation)) return false;

  const updates = [];
  for (const effect of Array.from(caster.effects ?? [])) {
    const presentation = familiarPresentationForEffect(effect, relation);
    if (!presentation) continue;
    const data = familiarEffectRelation(effect) ?? {};
    const change = {};
    if (effect.name !== presentation.name) change.name = presentation.name;
    if (effect.description !== presentation.description) change.description = presentation.description;
    if (presentation.senses && data.senses !== presentation.senses) change["flags.add2e.familiar.senses"] = presentation.senses;
    if (Object.keys(change).length) updates.push(effect.update(change, { add2eFamiliarEffectPresentation: true }));
  }
  if (updates.length) await Promise.all(updates);
  return updates.length > 0;
}

function queueFamiliarEffectPresentation(caster) {
  if (!isResponsibleGM() || !caster?.id || familiarEffectPresentationQueue.has(caster.id)) return;
  familiarEffectPresentationQueue.add(caster.id);
  setTimeout(() => {
    familiarEffectPresentationQueue.delete(caster.id);
    syncFamiliarEffectPresentation(caster).catch(error => console.error("[ADD2E][FAMILIAR][PRESENTATION]", error));
  }, 30);
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
    if (data?.linkId && familiarRelation(caster)?.linkId === data.linkId) {
      queueFamiliarArtworkSync(caster);
      queueFamiliarEffectPresentation(caster);
    }
  });

  Hooks.on("createToken", tokenDoc => {
    if (!isResponsibleGM()) return;
    const data = tokenDoc?.flags?.[FAMILIAR_SCOPE]?.[FAMILIAR_FLAG] ?? null;
    const caster = data?.masterActorId ? game.actors?.get?.(data.masterActorId) ?? null : null;
    if (caster) {
      queueFamiliarArtworkSync(caster);
      queueFamiliarEffectPresentation(caster);
    }
  });

  Hooks.on("updateActor", actor => {
    if (!isResponsibleGM() || !familiarIsCasterRelation(familiarRelation(actor))) return;
    queueFamiliarEffectPresentation(actor);
  });

  Hooks.on("canvasReady", () => {
    if (!isResponsibleGM()) return;
    setTimeout(() => {
      for (const caster of game.actors?.contents ?? []) {
        if (!familiarIsCasterRelation(familiarRelation(caster))) continue;
        queueFamiliarArtworkSync(caster);
        queueFamiliarEffectPresentation(caster);
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

function installDefaultFamiliarFollowBridge() {
  if (globalThis.ADD2E_FAMILIAR_FOLLOW_BRIDGE_VERSION === FAMILIAR_FOLLOW_BRIDGE_VERSION) return true;
  globalThis.ADD2E_FAMILIAR_FOLLOW_BRIDGE_VERSION = FAMILIAR_FOLLOW_BRIDGE_VERSION;
  Hooks.on("updateToken", (tokenDoc, changes = {}, options = {}) => queueDefaultFamiliarFollow(tokenDoc, changes, options));
  return true;
}

function installFamiliarEffectActionBridge() {
  registerFamiliarEffectHandlebarsHelpers();
  if (globalThis.ADD2E_FAMILIAR_EFFECT_ACTION_BRIDGE_VERSION === FAMILIAR_EFFECT_ACTION_BRIDGE_VERSION) return true;
  if (typeof document === "undefined") return false;
  globalThis.ADD2E_FAMILIAR_EFFECT_ACTION_BRIDGE_VERSION = FAMILIAR_EFFECT_ACTION_BRIDGE_VERSION;

  document.addEventListener("click", async event => {
    const control = event.target?.closest?.(".a2e-familiar-effect-action");
    if (!control) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();

    const actorId = String(control.dataset.actorId ?? "");
    const effectId = String(control.dataset.effectId ?? "");
    const expectedAction = String(control.dataset.familiarAction ?? "");
    const actor = actorId ? game.actors?.get?.(actorId) ?? null : null;
    const effect = actor?.effects?.get?.(effectId) ?? null;
    const data = familiarEffectRelation(effect);

    if (!actor || !effect || data?.kind !== "action" || data.action !== expectedAction) {
      return ui.notifications.warn("Cette action de familier n’est plus valide.");
    }
    if (typeof globalThis.add2eUseFamiliarEffect !== "function") {
      return ui.notifications.warn("Le relais de familier n’est pas encore prêt.");
    }

    try {
      await globalThis.add2eUseFamiliarEffect(actor, effect);
      if (actor.sheet?.rendered) actor.sheet.render(false);
    } catch (error) {
      console.error("[ADD2E][FAMILIAR][EFFECT_ACTION]", error);
      ui.notifications.error("Impossible d’utiliser cette action de familier.");
    }
  }, true);
  return true;
}

registerFamiliarEffectHandlebarsHelpers();
installFamiliarArtworkRepair();
installDefaultFamiliarFollowBridge();
installFamiliarEffectActionBridge();
