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
const LOCAL_CHAT_VERSION = "2026-06-27-gm-relay-familiar-v1";
const LOG = "[ADD2E][ATTACK_CHAT_RELAY]";
const FAMILIAR_SCOPE = "add2e";
const FAMILIAR_FLAG = "familiar";
const FAMILIAR_RANGE_DEFAULT = 12;
const familiarMoveOrigins = new Map();
const familiarSyncQueued = new Set();

globalThis.ADD2E_LOCAL_PLAYER_ATTACK_CHAT_RELAY_VERSION = LOCAL_CHAT_VERSION;

function localAttackCardKey(payload = {}) {
  return String(payload.id ?? `${payload.version ?? "no-version"}:${payload.speaker?.alias ?? "ADD2E"}:${String(payload.content ?? "").slice(0, 120)}`);
}

function responsiblePlayerId(targets = []) {
  const ordered = targets.filter(Boolean);
  const activeTarget = ordered.find(id => {
    const user = game.users?.get?.(id);
    return user?.active && !user?.isGM;
  });
  if (activeTarget) return activeTarget;
  const anyTarget = ordered.find(id => {
    const user = game.users?.get?.(id);
    return user && !user.isGM;
  });
  if (anyTarget) return anyTarget;
  return Array.from(game.users ?? []).find(u => u.active && !u.isGM)?.id ?? null;
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
  } catch (err) {
    console.error(`${LOG}[PLAYER_CHAT_CREATE_ERROR]`, err);
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

function familiarClone(value) {
  if (foundry?.utils?.deepClone) return foundry.utils.deepClone(value);
  if (foundry?.utils?.duplicate) return foundry.utils.duplicate(value);
  return JSON.parse(JSON.stringify(value));
}

function familiarNormalize(value) { return relayNormalize(value); }
function familiarFlag(actor) { return actor?.getFlag?.(FAMILIAR_SCOPE, FAMILIAR_FLAG) ?? actor?.flags?.[FAMILIAR_SCOPE]?.[FAMILIAR_FLAG] ?? null; }
function familiarIsRelation(value) { return !!(value && typeof value === "object" && value.actorId); }
function familiarScene(sceneId = null) { return resolveScene(sceneId); }

function familiarTokenForActor(scene, actorId, preferredId = null) {
  if (!scene || !actorId) return null;
  const preferred = preferredId ? scene.tokens?.get?.(preferredId) ?? null : null;
  if (preferred?.actorId === actorId || preferred?.actor?.id === actorId) return preferred;
  return Array.from(scene.tokens ?? []).find(token => token?.actorId === actorId || token?.actor?.id === actorId) ?? null;
}

function familiarHp(actor) {
  for (const raw of [actor?.system?.pdv, actor?.system?.points_de_coup, actor?.system?.hp?.value, actor?.system?.health?.value]) {
    const value = Number(raw);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

function familiarIsAlive(actor) {
  if (!actor) return false;
  const hp = familiarHp(actor);
  if (Number.isFinite(hp) && hp <= 0) return false;
  const statuses = Array.from(actor.effects ?? []).flatMap(effect => {
    if (effect?.disabled) return [];
    const raw = effect.statuses ?? effect.getFlag?.("core", "statusId") ?? effect.getFlag?.("core", "status") ?? [];
    return raw instanceof Set ? [...raw] : Array.isArray(raw) ? raw : [raw];
  }).map(familiarNormalize);
  return !statuses.some(status => ["dead", "mort", "defeated", "vaincu"].includes(status));
}

function familiarCenter(tokenDoc) {
  if (!tokenDoc) return null;
  const scene = tokenDoc.parent ?? canvas?.scene ?? null;
  const size = Number(scene?.grid?.size ?? canvas?.grid?.size ?? 100) || 100;
  return { x: Number(tokenDoc.x ?? 0) + Number(tokenDoc.width ?? 1) * size / 2, y: Number(tokenDoc.y ?? 0) + Number(tokenDoc.height ?? 1) * size / 2 };
}

function familiarGridDistance(tokenA, tokenB) {
  const a = familiarCenter(tokenA), b = familiarCenter(tokenB);
  if (!a || !b) return Infinity;
  const grid = canvas?.grid;
  if (grid && typeof grid.measurePath === "function") {
    try {
      const result = grid.measurePath([a, b], { gridSpaces: true });
      const value = Number(result?.distance ?? result?.gridDistance ?? result?.spaces ?? result?.cost ?? result);
      if (Number.isFinite(value)) return value;
    } catch (_err) {}
  }
  const size = Number(tokenA?.parent?.grid?.size ?? canvas?.grid?.size ?? 100) || 100;
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) / size;
}

function familiarEffectsForLink(caster, linkId) {
  return Array.from(caster?.effects ?? []).filter(effect => (effect?.flags?.add2e?.familiar ?? effect?.getFlag?.("add2e", "familiar") ?? null)?.linkId === linkId);
}

function familiarOwnerIds(actor) {
  const owner = CONST.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3;
  return [...new Set(Object.entries(actor?.ownership ?? {})
    .filter(([userId, level]) => userId !== "default" && Number(level) >= owner)
    .map(([userId]) => userId)
    .filter(userId => {
      const user = game.users?.get?.(userId);
      return user?.active && !user?.isGM;
    }))];
}

async function familiarRangeMessage(caster, relation, inRange, distance) {
  const recipients = familiarOwnerIds(caster);
  if (!recipients.length) return;
  const label = relation?.label ?? "familier";
  const color = inRange ? "#2f8f46" : "#b33a2e";
  const title = inRange ? "LIAISON RÉTABLIE" : "FAMILIER TROP ÉLOIGNÉ";
  const text = inRange
    ? `${label} est à nouveau à portée. Les effets du familier sont réactivés.`
    : `${label} est à ${distance.toFixed(1)} cases. Les effets du familier sont suspendus au-delà de ${relation.range ?? FAMILIAR_RANGE_DEFAULT} cases.`;
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: caster }),
    whisper: recipients,
    content: `<div class="add2e-chat-card" style="border:1px solid ${color};border-radius:8px;background:#fffdf6;padding:.65em .8em;"><b style="color:${color};">${title}</b><div style="margin-top:.25em;">${text}</div></div>`,
    flags: { add2e: { familiarRange: true, familiarLinkId: relation.linkId, inRange } }
  });
}

async function familiarSetBenefitsEnabled(caster, relation, enabled) {
  const updates = [];
  for (const effect of familiarEffectsForLink(caster, relation.linkId)) {
    if ((effect.flags?.add2e?.familiar ?? {}).kind !== "benefit" || effect.disabled === !enabled) continue;
    updates.push(effect.update({ disabled: !enabled }));
  }
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
      tokenId: relation.tokenId ?? null,
      sceneId: relation.sceneId ?? null,
      follow: relation.follow !== false
    });
  }
}

async function syncFamiliarForCaster(caster, { notify = false } = {}) {
  if (!isResponsibleGM() || !caster) return false;
  const relation = familiarFlag(caster);
  if (!familiarIsRelation(relation)) return false;
  const scene = familiarScene(relation.sceneId);
  const familiarActor = game.actors?.get?.(relation.actorId) ?? null;
  const masterToken = familiarTokenForActor(scene, caster.id, relation.masterTokenId);
  const familiarToken = familiarTokenForActor(scene, relation.actorId, relation.tokenId);
  const sameScene = !!scene && scene.id === canvas?.scene?.id;
  const distance = sameScene && masterToken && familiarToken ? familiarGridDistance(masterToken, familiarToken) : Infinity;
  const inRange = !!(sameScene && masterToken && familiarToken && familiarIsAlive(familiarActor) && distance <= (Number(relation.range) || FAMILIAR_RANGE_DEFAULT) + 0.01);
  const hadState = typeof relation.inRange === "boolean";
  const changed = hadState && relation.inRange !== inRange;
  const next = {
    ...relation,
    sceneId: scene?.id ?? relation.sceneId ?? null,
    masterTokenId: masterToken?.id ?? relation.masterTokenId ?? null,
    tokenId: familiarToken?.id ?? relation.tokenId ?? null,
    inRange,
    distance: Number.isFinite(distance) ? Math.round(distance * 100) / 100 : null,
    follow: relation.follow !== false
  };
  if (!hadState || changed || next.tokenId !== relation.tokenId || next.masterTokenId !== relation.masterTokenId) await familiarWriteRelation(caster, next);
  await familiarSetBenefitsEnabled(caster, next, inRange);
  if (changed && notify) await familiarRangeMessage(caster, next, inRange, distance);
  return inRange;
}

function familiarQueueSync(caster, options = {}) {
  if (!caster?.id || !isResponsibleGM() || familiarSyncQueued.has(caster.id)) return;
  familiarSyncQueued.add(caster.id);
  setTimeout(() => {
    familiarSyncQueued.delete(caster.id);
    syncFamiliarForCaster(caster, options).catch(error => console.error("[ADD2E][FAMILIAR][SYNC]", error));
  }, 0);
}

function familiarOriginKey(tokenDoc) { return `${tokenDoc?.parent?.id ?? "scene"}:${tokenDoc?.id ?? "token"}`; }
function familiarGeneration() { const generation = Number(game?.release?.generation ?? String(game?.version ?? "").split(".")[0]); return Number.isFinite(generation) ? generation : 0; }
function familiarUsesNativeMovementHooks() { return familiarGeneration() >= 14; }
function familiarPoint(value, fallback = null) {
  const point = value?.destination ?? value?.origin ?? value;
  return Number.isFinite(Number(point?.x)) && Number.isFinite(Number(point?.y)) ? { x: Number(point.x), y: Number(point.y) } : fallback;
}
function familiarMasterFromRelation(relation) { return relation?.masterActorId ? game.actors?.get?.(relation.masterActorId) ?? null : null; }
function familiarCasterForFamiliarActor(actor) {
  const direct = familiarMasterFromRelation(familiarFlag(actor));
  return direct ?? Array.from(game.actors ?? []).find(candidate => familiarFlag(candidate)?.actorId === actor?.id) ?? null;
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
  const from = familiarPoint(origin, { x: masterToken.x, y: masterToken.y });
  const to = familiarPoint(destination, { x: masterToken.x, y: masterToken.y });
  const dx = Number(to.x) - Number(from.x), dy = Number(to.y) - Number(from.y);
  if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
    await familiarToken.update({ x: Number(familiarToken.x) + dx, y: Number(familiarToken.y) + dy }, { add2eFamiliarFollow: true, add2eIgnoreMovement: true, render: true });
  }
  familiarQueueSync(caster, { notify: true });
}

async function familiarHandleMove(tokenDoc, changes, options = {}) {
  if (!isResponsibleGM() || !tokenDoc?.actor || !changes || (changes.x === undefined && changes.y === undefined)) return;
  const actor = tokenDoc.actor;
  const asCaster = familiarFlag(actor);
  if (familiarIsRelation(asCaster)) {
    const origin = familiarMoveOrigins.get(familiarOriginKey(tokenDoc)) ?? { x: tokenDoc.x, y: tokenDoc.y };
    familiarMoveOrigins.delete(familiarOriginKey(tokenDoc));
    await familiarFollowMasterMove(tokenDoc, origin, { x: tokenDoc.x, y: tokenDoc.y });
    return;
  }
  if (options?.add2eFamiliarFollow) {
    const caster = familiarCasterForFamiliarActor(actor);
    if (caster) familiarQueueSync(caster, { notify: true });
    return;
  }
  const caster = familiarCasterForFamiliarActor(actor);
  const relation = familiarFlag(caster);
  if (!caster || !familiarIsRelation(relation)) return;
  if (relation.follow !== false) await familiarWriteRelation(caster, { ...relation, follow: false });
  familiarQueueSync(caster, { notify: true });
}

function familiarEffectData(caster, payload, relation) {
  const familiar = payload.familiar ?? {};
  const common = { linkId: relation.linkId, masterActorId: caster.id, masterActorUuid: caster.uuid, familiarActorId: relation.actorId, familiarTokenId: relation.tokenId, familiarLabel: relation.label, range: relation.range };
  const baseTags = ["familier", `familier:${familiar.key ?? "inconnu"}`, `familier:portee:${relation.range}`];
  const img = familiar.img || "icons/svg/aura.svg";
  const changes = [];
  if (familiar.dexterityTo18 === true) {
    const current = Number(caster.system?.dexterite);
    const delta = Number.isFinite(current) ? Math.max(0, 18 - current) : 8;
    if (delta > 0) changes.push({ key: "system.dexterite", mode: CONST.ACTIVE_EFFECT_MODES?.ADD ?? 2, value: String(delta), priority: 20 });
  }
  return [
    {
      name: `Familier — ${relation.label}`,
      img,
      disabled: false,
      transfer: false,
      type: "base",
      changes,
      description: familiar.senses || "Lien de familier actif tant que le familier reste à 12 cases ou moins.",
      flags: { add2e: { tags: [...new Set([...baseTags, ...(Array.isArray(familiar.tags) ? familiar.tags : [])])], familiar: { ...common, kind: "benefit", action: null } } }
    },
    {
      name: `Familier — Partage des sens (${relation.label})`,
      img,
      disabled: false,
      transfer: false,
      type: "base",
      changes: [],
      description: `Utiliser pour rappeler les sens et les possibilités d’éclaireur de ${relation.label}. Cette capacité exige que le familier soit à portée.`,
      flags: { add2e: { tags: [...baseTags, "familier:partage_sens"], familiar: { ...common, kind: "action", action: "share-senses" } } }
    },
    {
      name: `Familier — Suivi automatique (${relation.label})`,
      img,
      disabled: false,
      transfer: false,
      type: "base",
      changes: [],
      description: "Utiliser pour activer ou désactiver le suivi automatique du magicien par le familier.",
      flags: { add2e: { tags: [...baseTags, "familier:suivi"], familiar: { ...common, kind: "action", action: "toggle-follow" } } }
    }
  ];
}

function familiarNormalActorData(caster, payload) {
  const familiar = payload.familiar ?? {};
  const hp = Math.max(2, Math.min(4, Number(familiar.hp) || 2));
  const label = familiar.label ?? "Familier", img = familiar.img || "icons/svg/mystery-man.svg";
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
    prototypeToken: { name: `${label} — familier de ${caster.name}`, actorLink: true, disposition: CONST.TOKEN_DISPOSITIONS?.FRIENDLY ?? 1, sight: { enabled: true }, texture: { src: img } },
    ownership: familiarClone(caster.ownership ?? {}),
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
    ownership: familiarClone(caster.ownership ?? {}),
    prototypeToken: { ...(familiarClone(data.prototypeToken ?? {})), name: `${familiar.label} — familier de ${caster.name}`, actorLink: true, disposition: CONST.TOKEN_DISPOSITIONS?.FRIENDLY ?? 1, sight: { ...(data.prototypeToken?.sight ?? {}), enabled: true }, texture: { ...(data.prototypeToken?.texture ?? {}), src: data.prototypeToken?.texture?.src ?? img } },
    flags: { ...(familiarClone(data.flags ?? {})), add2e: { ...(familiarClone(data.flags?.add2e ?? {})), familiar: { linkId: payload.requestId, masterActorId: caster.id, masterActorUuid: caster.uuid, follow: true } } }
  };
}

async function familiarCreateToken(scene, familiarActor, casterToken, relation) {
  const prototype = familiarClone(familiarActor.prototypeToken?.toObject?.() ?? familiarActor.prototypeToken ?? {});
  const size = Number(scene?.grid?.size ?? canvas?.grid?.size ?? 100) || 100;
  const sourceTexture = prototype.texture?.src ?? familiarActor.img ?? "icons/svg/mystery-man.svg";
  const [token] = await scene.createEmbeddedDocuments("Token", [{
    ...prototype,
    name: familiarActor.name,
    actorId: familiarActor.id,
    actorLink: true,
    x: Number(casterToken.x ?? 0) + size,
    y: Number(casterToken.y ?? 0),
    width: Number(prototype.width ?? 1) || 1,
    height: Number(prototype.height ?? 1) || 1,
    disposition: CONST.TOKEN_DISPOSITIONS?.FRIENDLY ?? 1,
    sight: { ...(prototype.sight ?? {}), enabled: true },
    texture: { ...(prototype.texture ?? {}), src: sourceTexture },
    flags: { ...(prototype.flags ?? {}), add2e: { ...(prototype.flags?.add2e ?? {}), familiar: { linkId: relation.linkId, masterActorId: relation.masterActorId, masterTokenId: relation.masterTokenId, follow: true } } }
  }]);
  return token ?? null;
}

async function familiarDeleteStaleEffects(caster, linkId) {
  const ids = familiarEffectsForLink(caster, linkId).map(effect => effect.id).filter(Boolean);
  if (ids.length) await caster.deleteEmbeddedDocuments("ActiveEffect", ids);
}

export async function createFamiliar(payload = {}) {
  if (!isResponsibleGM()) return false;
  const caster = await resolveActor(payload);
  const scene = familiarScene(payload.sceneId);
  const casterToken = scene?.tokens?.get?.(payload.casterTokenId) ?? null;
  const familiar = payload.familiar ?? {};
  if (!caster || caster.type !== "personnage" || !scene || !casterToken || !familiar?.key || !familiar?.label) {
    console.warn("[ADD2E][FAMILIAR][CREATE] Données d’invocation invalides.", payload);
    return false;
  }
  const existing = familiarFlag(caster);
  if (existing?.actorId && game.actors?.get?.(existing.actorId)) return false;
  if (existing?.linkId) await familiarDeleteStaleEffects(caster, existing.linkId);
  const actorData = familiar.special === true ? await familiarSpecialActorData(caster, payload) : familiarNormalActorData(caster, payload);
  if (!actorData) {
    ui.notifications.warn(`Invocation d’un familier : l’acteur de compendium « ${familiar.label} » est introuvable.`);
    return false;
  }
  const familiarActor = await Actor.create(actorData);
  if (!familiarActor) return false;
  const relation = { version: LOCAL_CHAT_VERSION, linkId: payload.requestId, actorId: familiarActor.id, actorUuid: familiarActor.uuid, label: familiar.label, key: familiar.key, sceneId: scene.id, masterTokenId: casterToken.id, tokenId: null, follow: true, inRange: null, range: Math.max(1, Number(familiar.range) || FAMILIAR_RANGE_DEFAULT), special: familiar.special === true, createdAt: Date.now() };
  const familiarToken = await familiarCreateToken(scene, familiarActor, casterToken, relation);
  if (!familiarToken) {
    await familiarActor.delete();
    return false;
  }
  relation.tokenId = familiarToken.id;
  await familiarWriteRelation(caster, relation);
  await caster.createEmbeddedDocuments("ActiveEffect", familiarEffectData(caster, payload, relation));
  await syncFamiliarForCaster(caster, { notify: false });
  return true;
}

async function familiarUseEffect(actor, effect) {
  const data = effect?.flags?.add2e?.familiar ?? effect?.getFlag?.("add2e", "familiar") ?? null;
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
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="add2e-chat-card" style="border:1px solid #496f99;border-radius:8px;background:#f4f9ff;padding:.65em .8em;"><b>Partage des sens — ${relation.label}</b><div style="margin-top:.25em;">${senses}</div><div style="margin-top:.4em;font-size:.9em;">Le familier peut servir d’éclaireur, d’espion et de garde.</div></div>`,
      flags: { add2e: { familiarSenseShare: true, familiarLinkId: relation.linkId } }
    });
    return true;
  }
  if (data.action === "toggle-follow") {
    const nextFollow = relation.follow === false;
    const payload = { actorId: actor.id, actorUuid: actor.uuid, follow: nextFollow };
    if (isResponsibleGM()) {
      if (!await familiarSetFollow(payload)) return false;
    } else {
      game.socket.emit(ADD2E_SOCKET, { type: ADD2E_GM_OPERATION, operation: "setFamiliarFollow", payload });
    }
    ui.notifications.info(nextFollow ? `${relation.label} suivra à nouveau le magicien.` : `${relation.label} reste désormais en déplacement libre.`);
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
  Hooks.on("preUpdateToken", (tokenDoc, changes) => {
    if (familiarUsesNativeMovementHooks() || !changes || (changes.x === undefined && changes.y === undefined)) return;
    familiarMoveOrigins.set(familiarOriginKey(tokenDoc), { x: Number(tokenDoc.x ?? 0), y: Number(tokenDoc.y ?? 0) });
  });
  Hooks.on("updateToken", (tokenDoc, changes, options = {}) => {
    if (!familiarUsesNativeMovementHooks()) familiarHandleMove(tokenDoc, changes, options).catch(error => console.error("[ADD2E][FAMILIAR][UPDATE_TOKEN]", error));
  });
  Hooks.on("moveToken", (tokenDoc, movement, operation = {}) => {
    if (!familiarUsesNativeMovementHooks()) return;
    const origin = familiarPoint(movement?.origin, { x: Number(tokenDoc.x ?? 0), y: Number(tokenDoc.y ?? 0) });
    const destination = familiarPoint(movement?.destination, { x: Number(tokenDoc.x ?? 0), y: Number(tokenDoc.y ?? 0) });
    if (tokenDoc?.actor && familiarIsRelation(familiarFlag(tokenDoc.actor))) {
      familiarFollowMasterMove(tokenDoc, origin, destination).catch(error => console.error("[ADD2E][FAMILIAR][MOVE_TOKEN]", error));
    } else if (!operation?.add2eFamiliarFollow) {
      familiarHandleMove(tokenDoc, { x: destination.x, y: destination.y }, operation).catch(error => console.error("[ADD2E][FAMILIAR][MOVE_TOKEN]", error));
    }
  });
  Hooks.on("updateActor", actor => {
    const caster = familiarCasterForFamiliarActor(actor);
    if (caster) familiarQueueSync(caster, { notify: true });
    if (familiarIsRelation(familiarFlag(actor))) familiarQueueSync(actor, { notify: true });
  });
  Hooks.on("canvasReady", () => {
    if (!isResponsibleGM()) return;
    setTimeout(() => {
      for (const caster of game.actors ?? []) if (familiarIsRelation(familiarFlag(caster))) familiarQueueSync(caster, { notify: false });
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
    players: Array.from(game.users ?? []).filter(u => !u.isGM).map(u => ({ id: u.id, name: u.name, active: u.active }))
  };
};