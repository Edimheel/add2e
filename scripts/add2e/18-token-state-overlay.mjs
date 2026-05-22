// ADD2E — Overlay plein token pour inconscience et mort
// Version : 2026-05-22-v1-full-token-state-overlay

const ADD2E_TOKEN_STATE_OVERLAY_VERSION = "2026-05-22-v1-full-token-state-overlay";
globalThis.ADD2E_TOKEN_STATE_OVERLAY_VERSION = ADD2E_TOKEN_STATE_OVERLAY_VERSION;

const ADD2E_STATE_OVERLAY = {
  dead: {
    priority: 20,
    label: "Mort",
    iconIds: ["dead", "mort"],
    fallbackIcon: "icons/svg/skull.svg",
    namePattern: /\b(dead|mort|decede|décédé)\b/i,
    tint: 0xffffff,
    alpha: 0.88
  },
  unconscious: {
    priority: 10,
    label: "Inconscient",
    iconIds: ["unconscious", "inconscient", "sleep", "sleeping"],
    fallbackIcon: "icons/svg/unconscious.svg",
    namePattern: /\b(unconscious|inconscient|inconsciente|sommeil|endormi)\b/i,
    tint: 0xffffff,
    alpha: 0.82
  }
};

const textureCache = new Map();

function add2eReadNumber(...values) {
  for (const value of values) {
    if (value === undefined || value === null || value === "") continue;
    if (typeof value === "object") {
      const n = add2eReadNumber(value.value, value.current, value.actuel, value.total);
      if (Number.isFinite(n)) return n;
      continue;
    }
    const n = Number(String(value).replace(",", "."));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function add2eNormalizeStatus(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function add2eStatusConfigIcon(statusId, fallbackIcon) {
  const wanted = new Set([statusId, ...ADD2E_STATE_OVERLAY[statusId].iconIds].map(add2eNormalizeStatus));
  const statuses = Array.isArray(CONFIG?.statusEffects) ? CONFIG.statusEffects : [];
  const found = statuses.find(st => {
    const ids = [st.id, st._id, st.name, st.label].map(add2eNormalizeStatus);
    return ids.some(id => wanted.has(id));
  });
  return found?.img || found?.icon || fallbackIcon;
}

async function add2eLoadTexture(src) {
  if (!src) return null;
  if (textureCache.has(src)) return textureCache.get(src);

  try {
    let texture = null;
    if (typeof globalThis.loadTexture === "function") texture = await globalThis.loadTexture(src);
    else if (typeof foundry?.canvas?.loadTexture === "function") texture = await foundry.canvas.loadTexture(src);
    else texture = PIXI.Texture.from(src);

    textureCache.set(src, texture);
    return texture;
  } catch (err) {
    console.warn("[ADD2E][TOKEN_STATE_OVERLAY] Texture introuvable", { src, err });
    return null;
  }
}

function add2eEffectStatusIds(effect) {
  const out = new Set();
  if (!effect) return out;

  for (const source of [
    effect.statuses,
    effect.flags?.core?.statusId,
    effect.flags?.core?.statuses,
    effect.flags?.add2e?.statusId,
    effect.flags?.add2e?.status,
    effect.name,
    effect.label
  ]) {
    if (!source) continue;
    if (source instanceof Set || Array.isArray(source)) {
      for (const v of source) out.add(add2eNormalizeStatus(v));
    } else {
      out.add(add2eNormalizeStatus(source));
    }
  }

  return out;
}

function add2eTokenDocumentStatusIds(token) {
  const out = new Set();
  const doc = token?.document;
  for (const source of [doc?.effects, doc?.overlayEffect]) {
    if (!source) continue;
    if (Array.isArray(source)) {
      for (const v of source) out.add(add2eNormalizeStatus(v));
    } else {
      out.add(add2eNormalizeStatus(source));
    }
  }
  return out;
}

function add2eHasStateStatus(token, stateId) {
  const conf = ADD2E_STATE_OVERLAY[stateId];
  const wanted = new Set(conf.iconIds.map(add2eNormalizeStatus));

  const tokenStatuses = add2eTokenDocumentStatusIds(token);
  for (const id of tokenStatuses) {
    if (wanted.has(id)) return true;
    if (stateId === "dead" && /skull|dead|mort/.test(id)) return true;
    if (stateId === "unconscious" && /unconscious|inconscient|sleep|sleeping/.test(id)) return true;
  }

  for (const effect of token?.actor?.effects ?? []) {
    if (effect?.disabled) continue;
    const ids = add2eEffectStatusIds(effect);
    for (const id of ids) {
      if (wanted.has(id)) return true;
      if (conf.namePattern.test(id)) return true;
    }
    if (conf.namePattern.test(effect.name ?? effect.label ?? "")) return true;
  }

  return false;
}

function add2eActorCurrentHp(actor) {
  const s = actor?.system ?? {};
  return add2eReadNumber(
    s.pdv,
    s.pv,
    s.pv_courant,
    s.pvCourant,
    s.points_de_vie,
    s.points_de_vie_courants,
    s.points_de_coup_courants,
    s.hp?.value,
    s.hp?.current,
    s.attributes?.hp?.value
  );
}

function add2eTokenState(token) {
  if (!token?.actor) return null;

  if (add2eHasStateStatus(token, "dead")) return "dead";
  if (add2eHasStateStatus(token, "unconscious")) return "unconscious";

  const hp = add2eActorCurrentHp(token.actor);
  if (Number.isFinite(hp)) {
    if (hp <= -10) return "dead";
    if (hp <= 0) return "unconscious";
  }

  return null;
}

function add2eRemoveOverlay(token) {
  const existing = token?.__add2eStateOverlay;
  if (!existing) return;
  try { existing.destroy({ children: true }); } catch (_err) {}
  token.__add2eStateOverlay = null;
  token.__add2eStateOverlayState = null;
}

function add2eLayoutOverlay(token, sprite) {
  const w = Number(token?.w || token?.bounds?.width || canvas?.grid?.size || 100);
  const h = Number(token?.h || token?.bounds?.height || canvas?.grid?.size || 100);
  sprite.x = 0;
  sprite.y = 0;
  sprite.width = w;
  sprite.height = h;
  sprite.anchor?.set?.(0);
  sprite.eventMode = "none";
  sprite.interactive = false;
  sprite.zIndex = 9999;
}

async function add2eApplyOverlay(token) {
  if (!token || token.destroyed || !token.actor) return;
  const state = add2eTokenState(token);
  if (!state) {
    add2eRemoveOverlay(token);
    return;
  }

  if (token.__add2eStateOverlay && token.__add2eStateOverlayState === state) {
    add2eLayoutOverlay(token, token.__add2eStateOverlay);
    return;
  }

  add2eRemoveOverlay(token);

  const conf = ADD2E_STATE_OVERLAY[state];
  const icon = add2eStatusConfigIcon(state, conf.fallbackIcon);
  const texture = await add2eLoadTexture(icon);
  if (!texture || token.destroyed) return;

  const sprite = new PIXI.Sprite(texture);
  sprite.name = `add2e-${state}-full-token-overlay`;
  sprite.alpha = conf.alpha;
  sprite.tint = conf.tint;
  add2eLayoutOverlay(token, sprite);

  token.sortableChildren = true;
  token.addChild(sprite);
  token.__add2eStateOverlay = sprite;
  token.__add2eStateOverlayState = state;
}

function add2eRefreshTokenOverlay(token) {
  setTimeout(() => add2eApplyOverlay(token), 0);
}

function add2eRefreshActorTokens(actor) {
  if (!canvas?.tokens?.placeables?.length || !actor) return;
  for (const token of canvas.tokens.placeables) {
    if (token.actor?.id === actor.id) add2eRefreshTokenOverlay(token);
  }
}

Hooks.on("drawToken", token => add2eRefreshTokenOverlay(token));
Hooks.on("refreshToken", token => add2eRefreshTokenOverlay(token));
Hooks.on("updateToken", tokenDoc => add2eRefreshTokenOverlay(tokenDoc?.object));
Hooks.on("deleteToken", tokenDoc => add2eRemoveOverlay(tokenDoc?.object));
Hooks.on("updateActor", actor => add2eRefreshActorTokens(actor));
Hooks.on("createActiveEffect", effect => add2eRefreshActorTokens(effect?.parent));
Hooks.on("updateActiveEffect", effect => add2eRefreshActorTokens(effect?.parent));
Hooks.on("deleteActiveEffect", effect => add2eRefreshActorTokens(effect?.parent));

Hooks.once("canvasReady", () => {
  for (const token of canvas?.tokens?.placeables ?? []) add2eRefreshTokenOverlay(token);
});

console.log("[ADD2E][TOKEN_STATE_OVERLAY] Module chargé", ADD2E_TOKEN_STATE_OVERLAY_VERSION);
