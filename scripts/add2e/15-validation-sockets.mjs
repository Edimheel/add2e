// ADD2E — Relais socket central pour ADD2E_GM_OPERATION et message joueur d'attaque.
// Compatible Foundry V13/V14/V15.

import {
  ADD2E_GM_OPERATION,
  ADD2E_SOCKET,
  isResponsibleGM,
  resolveActor,
  resolveScene,
  relayNormalize
} from "./15b0-gm-relay-common.mjs";

import {
  applyDamage,
  applyLegacyActiveEffect,
  createActiveEffect,
  deleteActiveEffects
} from "./15b1-gm-relay-effects.mjs";

import {
  createAmbientLight,
  createMeasuredTemplate,
  deleteAmbientLight,
  deleteMeasuredTemplates,
  updateToken
} from "./15b2-gm-relay-scene-documents.mjs";

import { vendorRecordProjectileSpent, consumeSpellComponent } from "./15b3-gm-relay-projectiles.mjs";

const ADD2E_ATTACK_PLAYER_LOCAL_CHAT = "ADD2E_ATTACK_PLAYER_LOCAL_CHAT";
const ADD2E_ATTACK_GM_DETAIL_CHAT = "ADD2E_ATTACK_GM_DETAIL_CHAT";
const LOCAL_CHAT_VERSION = "2026-06-27-gm-relay-familiar-v4";
const LOG = "[ADD2E][ATTACK_CHAT_RELAY]";
const FAMILIAR_SCOPE = "add2e";
const FAMILIAR_FLAG = "familiar";
const FAMILIAR_HP_SHARE_FLAG = "familiarHpShare";
const FAMILIAR_RANGE_DEFAULT = 12;
const familiarMoveOrigins = new Map();
const familiarSyncQueued = new Set();
const familiarDissolvingLinks = new Set();
const familiarRegenerationMarkers = new Map();

globalThis.ADD2E_LOCAL_PLAYER_ATTACK_CHAT_RELAY_VERSION = LOCAL_CHAT_VERSION;

function localAttackCardKey(payload = {}) {
  return String(payload.id ?? `${payload.version ?? "no-version"}:${payload.speaker?.alias ?? "ADD2E"}:${String(payload.content ?? "").slice(0, 120)}`);
}

function responsiblePlayerId(targets = []) {
  const ordered = targets.filter(Boolean);
  const active = ordered.find(id => game.users?.get?.(id)?.active && !game.users?.get?.(id)?.isGM);
  if (active) return active;
  const player = ordered.find(id => game.users?.get?.(id) && !game.users?.get?.(id)?.isGM);
  return player ?? Array.from(game.users ?? []).find(user => user.active && !user.isGM)?.id ?? null;
}

async function createPersistentPlayerAttackChat(payload = {}) {
  const targets = Array.isArray(payload.userIds) ? payload.userIds.filter(Boolean) : [];
  const content = String(payload.content ?? "");
  const responsible = responsiblePlayerId(targets);
  if (game.user?.isGM || game.user?.id !== responsible || !content) return false;
  globalThis.ADD2E_LOCAL_ATTACK_CHAT_SEEN ??= new Set();
  const key = localAttackCardKey(payload);
  if (globalThis.ADD2E_LOCAL_ATTACK_CHAT_SEEN.has(key)) return false;
  globalThis.ADD2E_LOCAL_ATTACK_CHAT_SEEN.add(key);
  try {
    await ChatMessage.create({
      speaker: payload.speaker ?? { alias: "ADD2E" },
      content,
      whisper: targets,
      blind: false,
      flags: { add2e: { attackChatVisibility: "players-only", attackChatVisibilityVersion: LOCAL_CHAT_VERSION, localAttackKey: key, createdByPlayerRelay: true } }
    });
    return true;
  } catch (error) {
    console.error(`${LOG}[PLAYER_CHAT_CREATE_ERROR]`, error);
    return false;
  }
}

async function handleLegacyDamageFlag(data = {}) {
  if (!game.user?.isGM || !isResponsibleGM()) return false;
  const flagData = data.flagData ?? {};
  await applyDamage({
    actorId: data.actorId,
    tokenId: data.tokenId,
    sceneId: data.sceneId ?? canvas?.scene?.id ?? null,
    montant: flagData.montant ?? data.montant ?? 0,
    type: flagData.type ?? data.damageType ?? "",
    details: flagData.details ?? data.details ?? "",
    source: flagData.source ?? data.source ?? "legacy-applyDamageFlag",
    fromUserId: flagData.fromUserId ?? data.fromUserId ?? null
  });
  return true;
}

function clone(value) {
  if (foundry?.utils?.deepClone) return foundry.utils.deepClone(value);
  if (foundry?.utils?.duplicate) return foundry.utils.duplicate(value);
  return JSON.parse(JSON.stringify(value));
}

function num(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function familiarNormalize(value) { return relayNormalize(value); }
function familiarFlag(actor) { return actor?.getFlag?.(FAMILIAR_SCOPE, FAMILIAR_FLAG) ?? actor?.flags?.[FAMILIAR_SCOPE]?.[FAMILIAR_FLAG] ?? null; }
function familiarEffectFlag(effect) { return effect?.flags?.add2e?.familiar ?? effect?.getFlag?.(FAMILIAR_SCOPE, FAMILIAR_FLAG) ?? null; }
function familiarIsRelation(value) { return !!(value && typeof value === "object" && value.actorId && value.linkId); }
function familiarScene(sceneId = null) { return resolveScene(sceneId); }
function familiarOriginKey(tokenDoc) { return `${tokenDoc?.parent?.id ?? "scene"}:${tokenDoc?.id ?? "token"}`; }

function familiarEffectsForLink(caster, linkId) {
  return Array.from(caster?.effects ?? []).filter(effect => familiarEffectFlag(effect)?.linkId === linkId);
}

function familiarTokenForActor(scene, actorId, preferredId = null) {
  if (!scene || !actorId) return null;
  const preferred = preferredId ? scene.tokens?.get?.(preferredId) ?? null : null;
  if (preferred?.actorId === actorId || preferred?.actor?.id === actorId) return preferred;
  return Array.from(scene.tokens ?? []).find(token => token?.actorId === actorId || token?.actor?.id === actorId) ?? null;
}

function familiarCurrentHp(actor) {
  for (const value of [actor?.system?.pdv, actor?.system?.points_de_coup, actor?.system?.hp?.value, actor?.system?.health?.value]) {
    const result = num(value, NaN);
    if (Number.isFinite(result)) return result;
  }
  return 0;
}

function familiarMaxHp(actor, fallback = 0) {
  for (const value of [actor?.system?.points_de_coup, actor?.system?.hp?.max, actor?.system?.health?.max, actor?.system?.pdv]) {
    const result = num(value, NaN);
    if (Number.isFinite(result) && result > 0) return result;
  }
  return Math.max(0, num(fallback, 0));
}

function familiarIsAlive(actor) {
  if (!actor || familiarCurrentHp(actor) <= 0) return false;
  const statuses = Array.from(actor.effects ?? []).flatMap(effect => {
    if (effect?.disabled) return [];
    const value = effect.statuses ?? effect.getFlag?.("core", "statusId") ?? effect.getFlag?.("core", "status") ?? [];
    return value instanceof Set ? [...value] : Array.isArray(value) ? value : [value];
  }).map(familiarNormalize);
  return !statuses.some(status => ["dead", "mort", "defeated", "vaincu"].includes(status));
}

function familiarCenter(tokenDoc) {
  if (!tokenDoc) return null;
  const scene = tokenDoc.parent ?? canvas?.scene ?? null;
  const size = num(scene?.grid?.size ?? canvas?.grid?.size, 100) || 100;
  return {
    x: num(tokenDoc.x) + num(tokenDoc.width, 1) * size / 2,
    y: num(tokenDoc.y) + num(tokenDoc.height, 1) * size / 2
  };
}

function familiarGridDistance(tokenA, tokenB) {
  const a = familiarCenter(tokenA);
  const b = familiarCenter(tokenB);
  if (!a || !b) return Infinity;

  const sameCanvasScene = tokenA?.parent?.id && tokenA.parent.id === canvas?.scene?.id && tokenB?.parent?.id === tokenA.parent.id;
  if (sameCanvasScene && canvas?.grid?.measurePath) {
    try {
      const result = canvas.grid.measurePath([a, b], { gridSpaces: true });
      const spaces = num(result?.spaces ?? result?.gridDistance, NaN);
      if (Number.isFinite(spaces)) return spaces;
      const measured = num(result?.distance ?? result?.cost ?? result, NaN);
      const unit = num(tokenA?.parent?.grid?.distance ?? canvas?.grid?.distance, NaN);
      if (Number.isFinite(measured) && Number.isFinite(unit) && unit > 0) return measured / unit;
    } catch (_error) {}
  }

  const size = num(tokenA?.parent?.grid?.size ?? tokenB?.parent?.grid?.size ?? canvas?.grid?.size, 100) || 100;
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) / size;
}

function familiarOwnerIds(actor) {
  const owner = CONST.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3;
  return [...new Set(Object.entries(actor?.ownership ?? {})
    .filter(([userId, level]) => userId !== "default" && num(level) >= owner)
    .map(([userId]) => userId)
    .filter(userId => game.users?.get?.(userId)?.active && !game.users?.get?.(userId)?.isGM))];
}

async function familiarRangeMessage(caster, relation, inRange, distance) {
  const recipients = familiarOwnerIds(caster);
  if (!recipients.length) return;
  const color = inRange ? "#2f8f46" : "#b33a2e";
  const title = inRange ? "LIAISON RÉTABLIE" : "FAMILIER TROP ÉLOIGNÉ";
  const distanceLabel = Number.isFinite(distance) ? `${distance.toFixed(1)} cases` : "hors de portée";
  const text = inRange
    ? `${relation.label ?? "Le familier"} est à nouveau à portée. Les bienfaits sont réactivés.`
    : `${relation.label ?? "Le familier"} est à ${distanceLabel}. Les bienfaits sont suspendus au-delà de ${relation.range ?? FAMILIAR_RANGE_DEFAULT} cases.`;
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: caster }),
    whisper: recipients,
    content: `<div class="add2e-chat-card" style="border:1px solid ${color};border-radius:8px;background:#fffdf6;padding:.65em .8em;"><b style="color:${color};">${title}</b><div style="margin-top:.25em;">${text}</div></div>`,
    flags: { add2e: { familiarRange: true, familiarLinkId: relation.linkId, inRange } }
  });
}

async function familiarSetBenefitsEnabled(caster, relation, enabled) {
  const updates = familiarEffectsForLink(caster, relation.linkId)
    .filter(effect => familiarEffectFlag(effect)?.kind === "benefit" && effect.disabled === enabled)
    .map(effect => effect.update({ disabled: !enabled }));
  if (updates.length) await Promise.all(updates);
}

async function familiarWriteRelation(caster, relation) {
  await caster.setFlag(FAMILIAR_SCOPE, FAMILIAR_FLAG, relation);
  const familiarActor = game.actors?.get?.(relation.actorId) ?? null;
  if (familiarActor) {
    await familiarActor.setFlag(FAMILIAR_SCOPE, FAMILIAR_FLAG, {
      linkId: relation.linkId,
      masterActorId: caster.id,
      masterActorUuid: caster.uuid,
      sceneId: relation.sceneId ?? null,
      tokenId: relation.tokenId ?? null,
      follow: relation.follow !== false
    });
  }
}

function familiarHpShareState(caster) {
  return caster?.getFlag?.(FAMILIAR_SCOPE, FAMILIAR_HP_SHARE_FLAG) ?? caster?.flags?.[FAMILIAR_SCOPE]?.[FAMILIAR_HP_SHARE_FLAG] ?? null;
}

async function familiarApplyHpShare(caster, relation, amount) {
  const desired = Math.max(0, Math.floor(num(amount)));
  const state = familiarHpShareState(caster);
  const previous = state?.linkId === relation.linkId ? Math.max(0, Math.floor(num(state.amount))) : 0;
  if (previous === desired && state?.linkId === relation.linkId) return false;

  const max = num(caster.system?.points_de_coup, NaN);
  const current = num(caster.system?.pdv, NaN);
  if (!Number.isFinite(max) || !Number.isFinite(current)) {
    await caster.setFlag(FAMILIAR_SCOPE, FAMILIAR_HP_SHARE_FLAG, { linkId: relation.linkId, amount: desired });
    return false;
  }

  const baseMax = max - previous;
  const baseCurrent = current - previous;
  const nextMax = baseMax + desired;
  const nextCurrent = Math.min(nextMax, baseCurrent + desired);
  await caster.update({
    "system.points_de_coup": nextMax,
    "system.pdv": nextCurrent
  }, { add2eFamiliarHpShare: true, add2eInternal: true });
  await caster.setFlag(FAMILIAR_SCOPE, FAMILIAR_HP_SHARE_FLAG, { linkId: relation.linkId, amount: desired });
  return true;
}

async function familiarApplyDeathPenalty(caster, relation) {
  if (relation.deathPenaltyApplied === true) return false;

  const policy = relation.deathPenalty && typeof relation.deathPenalty === "object"
    ? relation.deathPenalty
    : { type: "hp", multiplier: 2 };
  const type = String(policy.type ?? "hp").trim().toLowerCase();
  let result = null;

  await familiarApplyHpShare(caster, relation, 0);

  if (type === "level") {
    const amount = Math.max(1, Math.floor(num(policy.amount, 4)));
    const sourceLevel = Math.max(1, Math.floor(num(caster?._source?.system?.niveau ?? caster.system?.niveau, 1)));
    const nextLevel = Math.max(1, sourceLevel - amount);
    if (nextLevel !== sourceLevel) {
      await caster.update({ "system.niveau": nextLevel }, { add2eFamiliarDeathPenalty: true, add2eInternal: true });
    }
    result = { type: "level", amount, from: sourceLevel, to: nextLevel };
  } else {
    const multiplier = Math.max(1, Math.floor(num(policy.multiplier, 2)));
    const amount = Math.max(0, Math.floor(num(relation.familiarMaxHp)) * multiplier);
    const max = num(caster.system?.points_de_coup, NaN);
    const current = num(caster.system?.pdv, NaN);
    if (amount > 0 && Number.isFinite(max) && Number.isFinite(current)) {
      await caster.update({
        "system.points_de_coup": Math.max(0, max - amount),
        "system.pdv": current - amount
      }, { add2eFamiliarDeathPenalty: true, add2eInternal: true });
    }
    result = { type: "hp", amount };
  }

  await familiarWriteRelation(caster, { ...relation, deathPenaltyApplied: true, deathPenaltyResult: result, inRange: false });
  return true;
}

async function familiarEnsureVisibleToken(tokenDoc, actor) {
  if (!tokenDoc) return false;
  const src = tokenDoc.texture?.src || actor?.prototypeToken?.texture?.src || actor?.img || "icons/svg/mystery-man.svg";
  const friendly = CONST.TOKEN_DISPOSITIONS?.FRIENDLY ?? 1;
  const hover = CONST.TOKEN_DISPLAY_MODES?.ALWAYS_HOVER ?? 20;
  const changes = {};

  if (tokenDoc.hidden === true) changes.hidden = false;
  if (num(tokenDoc.alpha, 1) !== 1) changes.alpha = 1;
  if (tokenDoc.actorLink !== true) changes.actorLink = true;
  if (num(tokenDoc.disposition, friendly) !== friendly) changes.disposition = friendly;
  if (num(tokenDoc.displayName, hover) !== hover) changes.displayName = hover;
  if (num(tokenDoc.displayBars, hover) !== hover) changes.displayBars = hover;
  if (tokenDoc.bar1?.attribute !== "system.pdv") changes.bar1 = { attribute: "system.pdv" };
  if (tokenDoc.sight?.enabled !== true) changes.sight = { ...(tokenDoc.sight ?? {}), enabled: true };
  if (tokenDoc.texture?.src !== src) changes.texture = { ...(tokenDoc.texture ?? {}), src };

  if (!Object.keys(changes).length) return false;
  await tokenDoc.update(changes, { add2eFamiliarVisibility: true, render: true });
  return true;
}

async function dissolveFamiliar(caster, relation = familiarFlag(caster), { removeEffects = true } = {}) {
  if (!isResponsibleGM() || !caster || !familiarIsRelation(relation)) return false;
  const key = `${caster.id}:${relation.linkId}`;
  if (familiarDissolvingLinks.has(key)) return false;
  familiarDissolvingLinks.add(key);
  try {
    await familiarApplyHpShare(caster, relation, 0);
    if (removeEffects) {
      const ids = familiarEffectsForLink(caster, relation.linkId).map(effect => effect.id).filter(Boolean);
      if (ids.length) await caster.deleteEmbeddedDocuments("ActiveEffect", ids, { add2eFamiliarDissolve: true });
    }
    for (const scene of game.scenes?.contents ?? []) {
      const ids = Array.from(scene.tokens ?? [])
        .filter(token => token?.actorId === relation.actorId || token?.flags?.add2e?.familiar?.linkId === relation.linkId)
        .map(token => token.id)
        .filter(Boolean);
      if (ids.length) await scene.deleteEmbeddedDocuments("Token", ids, { add2eFamiliarDissolve: true });
    }
    const familiarActor = game.actors?.get?.(relation.actorId) ?? null;
    const source = familiarFlag(familiarActor);
    if (familiarActor && (source?.linkId === relation.linkId || source?.masterActorId === caster.id)) {
      await familiarActor.delete({ add2eFamiliarDissolve: true });
    }
    if (familiarFlag(caster)?.linkId === relation.linkId) await caster.unsetFlag(FAMILIAR_SCOPE, FAMILIAR_FLAG);
    const share = familiarHpShareState(caster);
    if (share?.linkId === relation.linkId) await caster.unsetFlag(FAMILIAR_SCOPE, FAMILIAR_HP_SHARE_FLAG);
    return true;
  } finally {
    setTimeout(() => familiarDissolvingLinks.delete(key), 0);
  }
}

function familiarHandleEffectDeletion(effect, options = {}) {
  if (!isResponsibleGM() || options?.add2eFamiliarDissolve) return;
  const data = familiarEffectFlag(effect);
  if (!data?.linkId) return;
  const caster = effect?.parent?.documentName === "Actor" ? effect.parent : game.actors?.get?.(data.masterActorId) ?? null;
  const relation = familiarFlag(caster);
  if (!caster || relation?.linkId !== data.linkId) return;
  dissolveFamiliar(caster, relation).catch(error => console.error("[ADD2E][FAMILIAR][DISSOLVE]", error));
}

async function syncFamiliarForCaster(caster, { notify = false } = {}) {
  if (!isResponsibleGM() || !caster) return false;
  const relation = familiarFlag(caster);
  if (!familiarIsRelation(relation)) return false;
  const scene = familiarScene(relation.sceneId);
  const familiarActor = game.actors?.get?.(relation.actorId) ?? null;
  const masterToken = familiarTokenForActor(scene, caster.id, relation.masterTokenId);
  const familiarToken = familiarTokenForActor(scene, relation.actorId, relation.tokenId);
  if (familiarToken) await familiarEnsureVisibleToken(familiarToken, familiarActor);

  const alive = familiarIsAlive(familiarActor);
  if (!alive) {
    await familiarSetBenefitsEnabled(caster, relation, false);
    await familiarApplyDeathPenalty(caster, relation);
    return false;
  }

  const distance = masterToken && familiarToken ? familiarGridDistance(masterToken, familiarToken) : Infinity;
  const inRange = !!(masterToken && familiarToken && distance <= (num(relation.range, FAMILIAR_RANGE_DEFAULT) || FAMILIAR_RANGE_DEFAULT) + 0.01);
  const hadState = typeof relation.inRange === "boolean";
  const changed = hadState && relation.inRange !== inRange;
  const share = inRange ? Math.max(0, Math.floor(num(relation.familiarMaxHp, familiarMaxHp(familiarActor)))) : 0;
  const next = {
    ...relation,
    sceneId: scene?.id ?? relation.sceneId ?? null,
    masterTokenId: masterToken?.id ?? relation.masterTokenId ?? null,
    tokenId: familiarToken?.id ?? relation.tokenId ?? null,
    familiarMaxHp: Math.max(0, Math.floor(num(relation.familiarMaxHp, familiarMaxHp(familiarActor)))),
    inRange,
    distance: Number.isFinite(distance) ? Math.round(distance * 100) / 100 : null,
    follow: relation.follow !== false
  };
  if (!hadState || changed || next.tokenId !== relation.tokenId || next.masterTokenId !== relation.masterTokenId || next.familiarMaxHp !== relation.familiarMaxHp) await familiarWriteRelation(caster, next);
  await familiarApplyHpShare(caster, next, share);
  await familiarSetBenefitsEnabled(caster, next, inRange);
  if (changed && notify) await familiarRangeMessage(caster, next, inRange, distance);
  return inRange;
}

async function familiarRegenerateCaster(caster, relation) {
  const amount = Math.max(0, Math.floor(num(relation?.regenerationPerRound)));
  if (!caster || !amount || relation?.inRange !== true || relation?.deathPenaltyApplied === true) return false;
  const max = num(caster.system?.points_de_coup, NaN);
  const current = num(caster.system?.pdv, NaN);
  if (!Number.isFinite(max) || !Number.isFinite(current)) return false;
  const next = Math.min(max, current + amount);
  if (next <= current) return false;
  await caster.update({ "system.pdv": next }, { add2eFamiliarRegeneration: true, add2eInternal: true });
  return true;
}

async function familiarRegenerateOnRound(combat, changes = {}) {
  if (!isResponsibleGM() || !combat || !Object.prototype.hasOwnProperty.call(changes, "round")) return;
  const round = Math.max(0, Math.floor(num(combat.round)));
  if (!round) return;
  for (const caster of game.actors?.contents ?? []) {
    const relation = familiarFlag(caster);
    if (!familiarIsRelation(relation) || Math.max(0, Math.floor(num(relation.regenerationPerRound))) < 1) continue;
    const marker = `${combat.id}:${round}:${relation.linkId}`;
    if (familiarRegenerationMarkers.get(caster.id) === marker) continue;
    familiarRegenerationMarkers.set(caster.id, marker);
    const inRange = await syncFamiliarForCaster(caster, { notify: true });
    if (inRange) await familiarRegenerateCaster(caster, familiarFlag(caster) ?? relation);
  }
}

function familiarQueueSync(caster, options = {}) {
  if (!caster?.id || !isResponsibleGM() || familiarSyncQueued.has(caster.id)) return;
  familiarSyncQueued.add(caster.id);
  setTimeout(() => {
    familiarSyncQueued.delete(caster.id);
    syncFamiliarForCaster(caster, options).catch(error => console.error("[ADD2E][FAMILIAR][SYNC]", error));
  }, 0);
}

function familiarMasterFromRelation(relation) { return relation?.masterActorId ? game.actors?.get?.(relation.masterActorId) ?? null : null; }
function familiarCasterForFamiliarActor(actor) {
  const direct = familiarMasterFromRelation(familiarFlag(actor));
  return direct ?? Array.from(game.actors?.contents ?? []).find(candidate => familiarFlag(candidate)?.actorId === actor?.id) ?? null;
}

async function familiarSetFollow(payload = {}) {
  if (!isResponsibleGM()) return false;
  const caster = await resolveActor(payload);
  const relation = familiarFlag(caster);
  if (!caster || !familiarIsRelation(relation)) return false;
  await familiarWriteRelation(caster, { ...relation, follow: payload.follow === true });
  await syncFamiliarForCaster(caster, { notify: false });
  return true;
}

async function familiarFollowMasterMove(masterToken, origin, destination) {
  if (!isResponsibleGM() || !masterToken?.actor) return;
  const caster = masterToken.actor;
  const relation = familiarFlag(caster);
  if (!familiarIsRelation(relation) || relation.follow === false) {
    familiarQueueSync(caster, { notify: true });
    return;
  }
  const scene = masterToken.parent ?? familiarScene(relation.sceneId);
  const familiarToken = familiarTokenForActor(scene, relation.actorId, relation.tokenId);
  if (!familiarToken) {
    familiarQueueSync(caster, { notify: true });
    return;
  }
  const dx = num(destination?.x) - num(origin?.x);
  const dy = num(destination?.y) - num(origin?.y);
  if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
    await familiarToken.update({ x: num(familiarToken.x) + dx, y: num(familiarToken.y) + dy }, { add2eFamiliarFollow: true, add2eIgnoreMovement: true, render: true });
  }
  familiarQueueSync(caster, { notify: true });
}

async function familiarHandleMove(tokenDoc, changes, options = {}) {
  if (!isResponsibleGM() || !tokenDoc?.actor || !changes || (changes.x === undefined && changes.y === undefined)) return;
  const actor = tokenDoc.actor;
  const asCaster = familiarFlag(actor);
  if (familiarIsRelation(asCaster)) {
    const origin = familiarMoveOrigins.get(familiarOriginKey(tokenDoc)) ?? { x: num(tokenDoc.x), y: num(tokenDoc.y) };
    familiarMoveOrigins.delete(familiarOriginKey(tokenDoc));
    await familiarFollowMasterMove(tokenDoc, origin, { x: num(tokenDoc.x), y: num(tokenDoc.y) });
    return;
  }
  const caster = familiarCasterForFamiliarActor(actor);
  if (!caster) return;
  if (!options?.add2eFamiliarFollow) {
    const relation = familiarFlag(caster);
    if (familiarIsRelation(relation) && relation.follow !== false) await familiarWriteRelation(caster, { ...relation, follow: false });
  }
  familiarQueueSync(caster, { notify: true });
}

function familiarBenefitEffect({ name, img, description, tags = [], common = {}, changes = [] }) {
  return {
    name,
    img,
    disabled: false,
    transfer: false,
    type: "base",
    changes,
    description,
    flags: { add2e: { tags, familiar: { ...common, kind: "benefit", action: null } } }
  };
}

function familiarEffectData(caster, payload, relation) {
  const familiar = payload.familiar ?? {};
  const img = familiar.img || "icons/svg/aura.svg";
  const common = {
    linkId: relation.linkId,
    masterActorId: caster.id,
    masterActorUuid: caster.uuid,
    familiarActorId: relation.actorId,
    familiarTokenId: relation.tokenId,
    familiarLabel: relation.label,
    range: relation.range
  };
  const baseTags = ["familier", "familier:communication", "familier:loyal", `familier:${familiar.key ?? "inconnu"}`, `familier:portee:${relation.range}`];
  const effects = [
    familiarBenefitEffect({
      name: `Familier — Vitalité partagée (${relation.familiarMaxHp} PV)`,
      img,
      description: `${relation.familiarMaxHp} PV sont ajoutés au magicien tant que ${relation.label} demeure à ${relation.range} cases ou moins.`,
      tags: [...baseTags, "familier:partage_pv"],
      common
    }),
    familiarBenefitEffect({
      name: `Familier — Sens de ${relation.label}`,
      img,
      description: familiar.senses || "Le magicien profite des sens de son familier lorsqu’il est à portée.",
      tags: [...new Set([...baseTags, ...(Array.isArray(familiar.tags) ? familiar.tags : [])])],
      common
    })
  ];

  if (familiar.dexterityTo18 === true) {
    effects.push(familiarBenefitEffect({
      name: "Familier — Dextérité féerique (18)",
      img,
      description: "Le lutin confère au magicien une Dextérité de 18 tant que la liaison demeure active.",
      tags: [...baseTags, "familier:lutin", "dexterite:18"],
      common,
      changes: [{ key: "system.dexterite", mode: CONST.ACTIVE_EFFECT_MODES?.OVERRIDE ?? 5, value: "18", priority: 20 }]
    }));
  }
  if (familiar.neverSurprised === true) {
    effects.push(familiarBenefitEffect({
      name: "Familier — Jamais surpris",
      img,
      description: "Le lutin empêche le magicien d’être surpris.",
      tags: [...baseTags, "immunite:surprise", "familier:jamais_surpris"],
      common
    }));
  }
  if (num(familiar.saveBonus) !== 0) {
    effects.push(familiarBenefitEffect({
      name: `Familier — Bonus aux jets de protection (+${num(familiar.saveBonus)})`,
      img,
      description: "Le lutin accorde ce bonus à tous les jets de protection.",
      tags: [...baseTags, `bonus_save:${num(familiar.saveBonus)}`],
      common
    }));
  }
  for (const resistance of Array.isArray(familiar.masterResistances) ? familiar.masterResistances : []) {
    const type = String(resistance?.type ?? "").trim();
    const percent = Math.max(0, Math.min(100, Math.floor(num(resistance?.percent))));
    if (!type || !percent) continue;
    effects.push(familiarBenefitEffect({
      name: `Familier — Résistance à la magie (${percent} %)`,
      img,
      description: `${relation.label} confère une résistance magique de ${percent} % au magicien.`,
      tags: [...baseTags, `resistance:${type}:${percent}`],
      common
    }));
  }
  const regeneration = Math.max(0, Math.floor(num(familiar.regenerationPerRound)));
  if (regeneration > 0) {
    effects.push(familiarBenefitEffect({
      name: `Familier — Régénération (${regeneration} PV / round)`,
      img,
      description: `${relation.label} rend ${regeneration} PV au magicien au début de chaque round de combat tant que la liaison demeure active.`,
      tags: [...baseTags, `regeneration:${regeneration}:round`],
      common
    }));
  }
  const temporaryLevelBonus = Math.max(0, Math.floor(num(familiar.temporaryLevelBonus)));
  if (temporaryLevelBonus > 0) {
    effects.push(familiarBenefitEffect({
      name: `Familier — Niveau effectif (+${temporaryLevelBonus})`,
      img,
      description: `${relation.label} confère ${temporaryLevelBonus} niveau effectif au magicien tant que la liaison demeure active.`,
      tags: [...baseTags, `bonus_niveau:${temporaryLevelBonus}`],
      common,
      changes: [{ key: "system.niveau", mode: CONST.ACTIVE_EFFECT_MODES?.ADD ?? 2, value: String(temporaryLevelBonus), priority: 20 }]
    }));
  }
  effects.push(
    {
      name: `Familier — Partage des sens (${relation.label})`,
      img,
      disabled: false,
      transfer: false,
      type: "base",
      changes: [],
      description: `Utiliser pour consulter les sens et les capacités d’éclaireur de ${relation.label}.`,
      flags: { add2e: { tags: [...baseTags, "familier:partage_sens"], familiar: { ...common, kind: "action", action: "share-senses" } } }
    },
    {
      name: `Familier — Suivi automatique (${relation.label})`,
      img,
      disabled: false,
      transfer: false,
      type: "base",
      changes: [],
      description: "Utiliser pour activer ou désactiver le suivi automatique du magicien.",
      flags: { add2e: { tags: [...baseTags, "familier:suivi"], familiar: { ...common, kind: "action", action: "toggle-follow" } } }
    }
  );
  return effects;
}

function familiarNormalActorData(caster, payload) {
  const familiar = payload.familiar ?? {};
  const hp = Math.max(2, Math.min(4, Math.floor(num(familiar.hp, 2))));
  const label = familiar.label ?? "Familier";
  const img = familiar.img || "icons/svg/mystery-man.svg";
  return {
    name: `${label} — familier de ${caster.name}`,
    type: "monster",
    img,
    system: {
      type: "Animal", type_monstre: "animal", frequency: "Familier", size: "P", alignment: "Neutre", armorClass: 7, ca_total: 7, ca_naturel: 7, thac0: 20, hitDice: "—", dv: "—", pdv: hp, points_de_coup: hp,
      movement: "12", movement_raw: "12", movement_base: 12, movement_max: 12, movement_modes: { marche: { value: 12, raw: "12" } }, mouvement: { raw: "12", base: 12, actuel: 12, max: 12, primaryMode: "marche", modes: { marche: { value: 12, raw: "12" } }, unit: "m" },
      initiative: 0, attacksCount: "1", attackTypes: "Morsure ou griffes", damage: "1", specialAttacks: "Aucune", specialDefenses: "Aucune", magicResistance: "Aucune", savingThrows: "Animal", morale: 12, intelligence: "Supérieure à la normale", treasure: "Aucun", xp: 0,
      senses: familiar.senses ?? "", languages: `Télépathie avec ${caster.name}`, description: `<p><b>Familier de ${caster.name}.</b> ${familiar.senses ?? ""}</p>`, habitat: "Auprès de son maître", organization: "Solitaire", activityCycle: "Selon son maître", notes: "Familier normal : fidèle au magicien.",
      tags: ["acteur:monstre", "familier", `familier:${familiar.key ?? "normal"}`, "creature:animal"], effectTags: ["acteur:monstre", "familier", `familier:${familiar.key ?? "normal"}`, "creature:animal"],
      capacites_monstre: [{ type: "sens", name: "Sens de familier", description: familiar.senses ?? "", tags: Array.isArray(familiar.tags) ? familiar.tags : [] }]
    },
    prototypeToken: {
      name: `${label} — familier de ${caster.name}`,
      actorLink: true,
      disposition: CONST.TOKEN_DISPOSITIONS?.FRIENDLY ?? 1,
      hidden: false,
      alpha: 1,
      sight: { enabled: true },
      bar1: { attribute: "system.pdv" },
      texture: { src: img }
    },
    ownership: clone(caster.ownership ?? {}),
    flags: { add2e: { familiar: { linkId: payload.requestId, masterActorId: caster.id, masterActorUuid: caster.uuid, follow: true } } }
  };
}

async function familiarSpecialActorData(caster, payload) {
  const familiar = payload.familiar ?? {};
  const pack = game.packs?.get?.("add2e.monstres") ?? null;
  if (!pack) return null;
  const aliases = new Set([familiarNormalize(familiar.label), ...(Array.isArray(familiar.aliases) ? familiar.aliases.map(familiarNormalize) : [])].filter(Boolean));
  const index = await pack.getIndex({ fields: ["name", "img"] });
  const rows = Array.from(index?.contents ?? index ?? pack.index?.contents ?? pack.index ?? []);
  const row = rows.find(entry => {
    const name = familiarNormalize(entry?.name);
    return [...aliases].some(alias => name === alias || name.includes(alias) || alias.includes(name));
  }) ?? null;
  if (!row) return null;
  const source = await pack.getDocument(row._id ?? row.id);
  if (!source) return null;
  const data = source.toObject();
  delete data._id;
  delete data.folder;
  delete data.sort;
  const img = data.img || familiar.img || "icons/svg/mystery-man.svg";
  return {
    ...data,
    name: `${familiar.label} — familier de ${caster.name}`,
    img,
    ownership: clone(caster.ownership ?? {}),
    prototypeToken: {
      ...clone(data.prototypeToken ?? {}),
      name: `${familiar.label} — familier de ${caster.name}`,
      actorLink: true,
      hidden: false,
      alpha: 1,
      disposition: CONST.TOKEN_DISPOSITIONS?.FRIENDLY ?? 1,
      sight: { ...(data.prototypeToken?.sight ?? {}), enabled: true },
      bar1: { attribute: "system.pdv" },
      texture: { ...(data.prototypeToken?.texture ?? {}), src: data.prototypeToken?.texture?.src ?? img }
    },
    flags: { ...(clone(data.flags ?? {})), add2e: { ...(clone(data.flags?.add2e ?? {})), familiar: { linkId: payload.requestId, masterActorId: caster.id, masterActorUuid: caster.uuid, follow: true } } }
  };
}

async function familiarCreateToken(scene, familiarActor, casterToken, relation) {
  const prototype = clone(familiarActor.prototypeToken?.toObject?.() ?? familiarActor.prototypeToken ?? {});
  const size = num(scene?.grid?.size ?? canvas?.grid?.size, 100) || 100;
  const src = prototype.texture?.src ?? familiarActor.img ?? "icons/svg/mystery-man.svg";
  const [token] = await scene.createEmbeddedDocuments("Token", [{
    ...prototype,
    name: familiarActor.name,
    actorId: familiarActor.id,
    actorLink: true,
    x: num(casterToken.x) + size,
    y: num(casterToken.y),
    width: num(prototype.width, 1) || 1,
    height: num(prototype.height, 1) || 1,
    hidden: false,
    alpha: 1,
    disposition: CONST.TOKEN_DISPOSITIONS?.FRIENDLY ?? 1,
    displayName: CONST.TOKEN_DISPLAY_MODES?.ALWAYS_HOVER ?? 20,
    displayBars: CONST.TOKEN_DISPLAY_MODES?.ALWAYS_HOVER ?? 20,
    bar1: { attribute: "system.pdv" },
    sight: { ...(prototype.sight ?? {}), enabled: true },
    texture: { ...(prototype.texture ?? {}), src },
    flags: { ...(prototype.flags ?? {}), add2e: { ...(prototype.flags?.add2e ?? {}), familiar: { linkId: relation.linkId, masterActorId: relation.masterActorId, masterTokenId: relation.masterTokenId, follow: true } } }
  }]);
  return token ?? null;
}

export async function createFamiliar(payload = {}) {
  if (!isResponsibleGM()) return false;
  const caster = await resolveActor(payload);
  const scene = familiarScene(payload.sceneId);
  const casterToken = scene?.tokens?.get?.(payload.casterTokenId) ?? null;
  const familiar = payload.familiar ?? {};
  if (!caster || caster.type !== "personnage" || !scene || !casterToken || !familiar?.key || !familiar?.label) return false;

  const existing = familiarFlag(caster);
  if (existing?.linkId) {
    const existingActor = existing.actorId ? game.actors?.get?.(existing.actorId) ?? null : null;
    const existingEffects = familiarEffectsForLink(caster, existing.linkId);
    if (existingActor && existingEffects.length) return false;
    await dissolveFamiliar(caster, existing, { removeEffects: existingEffects.length > 0 });
  }

  const actorData = familiar.special === true ? await familiarSpecialActorData(caster, payload) : familiarNormalActorData(caster, payload);
  if (!actorData) {
    ui.notifications.warn(`Invocation d’un familier : l’acteur de compendium « ${familiar.label} » est introuvable.`);
    return false;
  }
  const familiarActor = await Actor.create(actorData);
  if (!familiarActor) return false;
  const relation = {
    version: LOCAL_CHAT_VERSION,
    linkId: payload.requestId,
    actorId: familiarActor.id,
    actorUuid: familiarActor.uuid,
    label: familiar.label,
    key: familiar.key,
    sceneId: scene.id,
    masterTokenId: casterToken.id,
    tokenId: null,
    follow: true,
    inRange: null,
    range: Math.max(1, Math.floor(num(familiar.range, FAMILIAR_RANGE_DEFAULT))),
    special: familiar.special === true,
    familiarMaxHp: familiarMaxHp(familiarActor, familiar.hp),
    regenerationPerRound: Math.max(0, Math.floor(num(familiar.regenerationPerRound))),
    temporaryLevelBonus: Math.max(0, Math.floor(num(familiar.temporaryLevelBonus))),
    deathPenalty: familiar.deathPenalty && typeof familiar.deathPenalty === "object" ? clone(familiar.deathPenalty) : { type: "hp", multiplier: 2 },
    deathPenaltyApplied: false,
    createdAt: Date.now()
  };
  const familiarToken = await familiarCreateToken(scene, familiarActor, casterToken, relation);
  if (!familiarToken) {
    await familiarActor.delete();
    return false;
  }
  relation.tokenId = familiarToken.id;
  await familiarWriteRelation(caster, relation);
  await caster.createEmbeddedDocuments("ActiveEffect", familiarEffectData(caster, payload, relation));
  await familiarEnsureVisibleToken(familiarToken, familiarActor);
  await syncFamiliarForCaster(caster, { notify: false });
  return true;
}

async function familiarUseEffect(actor, effect) {
  const data = familiarEffectFlag(effect);
  if (!actor || !data?.action) return false;
  const relation = familiarFlag(actor);
  if (!familiarIsRelation(relation) || relation.linkId !== data.linkId) {
    ui.notifications.warn("Ce lien de familier n’est plus valide.");
    return false;
  }
  if (data.action === "share-senses") {
    if (relation.inRange !== true) {
      ui.notifications.warn(`${relation.label} est hors de portée : le partage des sens est suspendu.`);
      return false;
    }
    const familiarActor = game.actors?.get?.(relation.actorId) ?? null;
    const senses = familiarActor?.system?.senses ?? effect.description ?? "Aucun sens spécial renseigné.";
    const placeable = canvas?.scene?.id === relation.sceneId ? (canvas?.tokens?.get?.(relation.tokenId) ?? canvas?.tokens?.placeables?.find?.(token => token?.id === relation.tokenId || token?.document?.id === relation.tokenId) ?? null) : null;
    if (placeable?.actor?.isOwner) {
      try {
        placeable.control({ releaseOthers: false });
        canvas?.animatePan?.({ x: placeable.center?.x, y: placeable.center?.y, duration: 250 });
      } catch (_error) {}
    }
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="add2e-chat-card" style="border:1px solid #496f99;border-radius:8px;background:#f4f9ff;padding:.65em .8em;"><b>Partage des sens — ${relation.label}</b><div style="margin-top:.25em;">${senses}</div><div style="margin-top:.4em;font-size:.9em;">Le token du familier est sélectionné lorsqu’il est sur la scène active : sa vision peut alors servir d’éclaireur, d’espion et de garde.</div></div>`,
      flags: { add2e: { familiarSenseShare: true, familiarLinkId: relation.linkId } }
    });
    return true;
  }
  if (data.action === "toggle-follow") {
    const follow = relation.follow === false;
    const payload = { actorId: actor.id, actorUuid: actor.uuid, follow };
    if (isResponsibleGM()) await familiarSetFollow(payload);
    else game.socket.emit(ADD2E_SOCKET, { type: ADD2E_GM_OPERATION, operation: "setFamiliarFollow", payload });
    ui.notifications.info(follow ? `${relation.label} suivra à nouveau le magicien.` : `${relation.label} reste désormais en déplacement libre.`);
    return true;
  }
  return false;
}

function registerAttackChatRelay() {
  if (!game?.socket?.on) return false;
  if (globalThis.ADD2E_ATTACK_CHAT_RELAY_REGISTERED === LOCAL_CHAT_VERSION) return true;
  globalThis.ADD2E_ATTACK_CHAT_RELAY_REGISTERED = LOCAL_CHAT_VERSION;
  game.socket.on(ADD2E_SOCKET, async data => {
    if (data?.type === ADD2E_ATTACK_PLAYER_LOCAL_CHAT) await createPersistentPlayerAttackChat(data.payload ?? {});
  });
  return true;
}

function installAttackChatRelay() {
  if (registerAttackChatRelay()) return;
  Hooks.once("ready", registerAttackChatRelay);
  setTimeout(registerAttackChatRelay, 250);
  setTimeout(registerAttackChatRelay, 1000);
  setTimeout(registerAttackChatRelay, 2500);
}

function installFamiliarController() {
  if (globalThis.ADD2E_FAMILIAR_CONTROLLER_VERSION === LOCAL_CHAT_VERSION) return;
  globalThis.ADD2E_FAMILIAR_CONTROLLER_VERSION = LOCAL_CHAT_VERSION;
  Hooks.on("deleteActiveEffect", (effect, options = {}) => familiarHandleEffectDeletion(effect, options));
  Hooks.on("preUpdateToken", (tokenDoc, changes) => {
    if (!changes || (changes.x === undefined && changes.y === undefined)) return;
    if (!familiarIsRelation(familiarFlag(tokenDoc?.actor))) return;
    familiarMoveOrigins.set(familiarOriginKey(tokenDoc), { x: num(tokenDoc.x), y: num(tokenDoc.y) });
  });
  Hooks.on("updateToken", (tokenDoc, changes, options = {}) => {
    familiarHandleMove(tokenDoc, changes, options).catch(error => console.error("[ADD2E][FAMILIAR][UPDATE_TOKEN]", error));
  });
  Hooks.on("updateActor", actor => {
    const caster = familiarCasterForFamiliarActor(actor);
    if (caster) familiarQueueSync(caster, { notify: true });
    if (familiarIsRelation(familiarFlag(actor))) familiarQueueSync(actor, { notify: true });
  });
  Hooks.on("updateCombat", (combat, changes = {}) => {
    familiarRegenerateOnRound(combat, changes).catch(error => console.error("[ADD2E][FAMILIAR][REGENERATION]", error));
  });
  Hooks.on("canvasReady", () => {
    if (!isResponsibleGM()) return;
    setTimeout(() => {
      for (const caster of game.actors?.contents ?? []) if (familiarIsRelation(familiarFlag(caster))) familiarQueueSync(caster, { notify: false });
    }, 100);
  });
}

function installGenericGmRelay() {
  if (globalThis.ADD2E_GM_OPERATION_RELAY_REGISTERED) return;
  globalThis.ADD2E_GM_OPERATION_RELAY_REGISTERED = true;
  const routes = {
    applyDamage,
    deleteActiveEffects,
    createMeasuredTemplate,
    deleteMeasuredTemplates,
    createAmbientLight,
    deleteAmbientLight,
    updateToken,
    createActiveEffect,
    vendorRecordProjectileSpent,
    consumeSpellComponent,
    createFamiliar,
    setFamiliarFollow: familiarSetFollow
  };
  game.socket.on(ADD2E_SOCKET, async data => {
    if (data?.type === ADD2E_ATTACK_PLAYER_LOCAL_CHAT || data?.type === ADD2E_ATTACK_GM_DETAIL_CHAT) return;
    if (data?.type === "applyDamageFlag") {
      await handleLegacyDamageFlag(data);
      return;
    }
    if (data?.type === "applyActiveEffect") {
      if (game.user.isGM) await applyLegacyActiveEffect(data);
      return;
    }
    if (!data || data.type !== ADD2E_GM_OPERATION || !isResponsibleGM()) return;
    const handler = routes[data.operation];
    if (!handler) {
      console.warn("[ADD2E][GM-RELAY] opération inconnue :", data.operation, data.payload ?? {});
      return;
    }
    await handler(data.payload ?? {});
  });
}

installAttackChatRelay();
Hooks.once("ready", () => {
  installGenericGmRelay();
  installFamiliarController();
});

globalThis.add2eCreateFamiliar = createFamiliar;
globalThis.add2eUseFamiliarEffect = familiarUseEffect;

globalThis.add2eAttackChatRelayDebug = function add2eAttackChatRelayDebug() {
  return {
    relayVersion: LOCAL_CHAT_VERSION,
    attackRelayRegistered: globalThis.ADD2E_ATTACK_CHAT_RELAY_REGISTERED,
    genericRelayRegistered: globalThis.ADD2E_GM_OPERATION_RELAY_REGISTERED,
    familiarController: globalThis.ADD2E_FAMILIAR_CONTROLLER_VERSION,
    scope: "player-attack-chat-and-gm-operations",
    gmDetailHandledBy: "scripts/add2e-attack/04-attack-roll.mjs",
    user: game.user?.name,
    userId: game.user?.id,
    isGM: game.user?.isGM,
    ready: game?.ready,
    hasSocket: !!game?.socket,
    players: Array.from(game.users ?? []).filter(user => !user.isGM).map(user => ({ id: user.id, name: user.name, active: user.active }))
  };
};