// ADD2E — Relais MJ unique : sockets, effets, scène, consommables et familier.
// Compatible Foundry V13/V14/V15.

import "./15a-validation-hooks.mjs";
import "./15c-amitie-controller.mjs";

const ADD2E_SOCKET = "system.add2e";
const ADD2E_GM_OPERATION = "ADD2E_GM_OPERATION";
const ADD2E_ATTACK_PLAYER_LOCAL_CHAT = "ADD2E_ATTACK_PLAYER_LOCAL_CHAT";
const ADD2E_ATTACK_GM_DETAIL_CHAT = "ADD2E_ATTACK_GM_DETAIL_CHAT";
const VENDOR_SCOPE = "add2e";
const PROJECTILE_FLAG = "projectilesDepensesCombat";
const FAMILIAR_SCOPE = "add2e";
const FAMILIAR_FLAG = "familiar";
const FAMILIAR_HP_SHARE_FLAG = "familiarHpShare";
const FAMILIAR_RANGE_DEFAULT = 12;
const VERSION = "2026-06-28-gm-relay-single-15b-v8";
const TAG = "[ADD2E][GM-RELAY]";

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

const familiarSyncQueued = new Set();
const familiarDissolving = new Set();
const familiarHpTransitions = new Set();
const familiarRegenerationMarkers = new Map();
const familiarArtworkQueue = new Set();
let familiarHudRefreshQueued = false;
let familiarHudObserver = null;

globalThis.ADD2E_LOCAL_PLAYER_ATTACK_CHAT_RELAY_VERSION = VERSION;

function clone(value) {
  if (typeof foundry?.utils?.deepClone === "function") return foundry.utils.deepClone(value);
  if (typeof foundry?.utils?.duplicate === "function") return foundry.utils.duplicate(value);
  return JSON.parse(JSON.stringify(value));
}

function num(value, fallback = 0) {
  const result = Number(value);
  return Number.isFinite(result) ? result : fallback;
}

function relayArray(value) {
  if (value === null || value === undefined || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(relayArray).filter(Boolean);
  if (value instanceof Set) return [...value].flatMap(relayArray).filter(Boolean);
  if (typeof value === "string") return value.split(/[,;|\n]+/).map(entry => entry.trim()).filter(Boolean);
  return [value];
}

function relayNormalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[\s\-]+/g, "_")
    .replace(/_+/g, "_");
}

function relaySlug(value) {
  return String(value ?? "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, "_")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function isResponsibleGM() {
  if (!game.user?.isGM) return false;
  if (typeof game.user.isActiveGM === "boolean") return game.user.isActiveGM;
  return game.users?.activeGM?.id === game.user.id;
}

function resolveScene(sceneId) {
  return game.scenes?.get?.(sceneId) ?? canvas?.scene ?? game.scenes?.active ?? null;
}

async function resolveActor(payload = {}) {
  if (payload.actorUuid) {
    try {
      const document = await fromUuid(payload.actorUuid);
      if (document?.actor) return document.actor;
      if (document) return document;
    } catch (error) {
      console.warn(`${TAG}[ACTOR_UUID]`, payload.actorUuid, error);
    }
  }
  if (payload.tokenUuid) {
    try {
      const document = await fromUuid(payload.tokenUuid);
      if (document?.actor) return document.actor;
      if (document?.document?.actor) return document.document.actor;
    } catch (error) {
      console.warn(`${TAG}[TOKEN_UUID]`, payload.tokenUuid, error);
    }
  }
  if (payload.tokenId) {
    const scene = resolveScene(payload.sceneId);
    const token = scene?.tokens?.get?.(payload.tokenId)
      ?? canvas?.scene?.tokens?.get?.(payload.tokenId)
      ?? null;
    if (token?.actor) return token.actor;
    const placeable = canvas?.tokens?.get?.(payload.tokenId)
      ?? canvas?.tokens?.placeables?.find?.(entry => entry?.id === payload.tokenId || entry?.document?.id === payload.tokenId)
      ?? null;
    if (placeable?.actor) return placeable.actor;
    if (placeable?.document?.actor) return placeable.document.actor;
  }
  return payload.actorId ? game.actors?.get?.(payload.actorId) ?? null : null;
}

function localAttackCardKey(payload = {}) {
  return String(payload.id ?? `${payload.version ?? "none"}:${payload.speaker?.alias ?? "ADD2E"}:${String(payload.content ?? "").slice(0, 120)}`);
}

function responsiblePlayerId(ids = []) {
  const ordered = ids.filter(Boolean);
  return ordered.find(id => game.users?.get?.(id)?.active && !game.users?.get?.(id)?.isGM)
    ?? ordered.find(id => game.users?.get?.(id) && !game.users?.get?.(id)?.isGM)
    ?? Array.from(game.users ?? []).find(user => user.active && !user.isGM)?.id
    ?? null;
}

async function createPersistentPlayerAttackChat(payload = {}) {
  const userIds = Array.isArray(payload.userIds) ? payload.userIds.filter(Boolean) : [];
  const content = String(payload.content ?? "");
  if (!content || game.user?.isGM || game.user?.id !== responsiblePlayerId(userIds)) return false;

  globalThis.ADD2E_LOCAL_ATTACK_CHAT_SEEN ??= new Set();
  const key = localAttackCardKey(payload);
  if (globalThis.ADD2E_LOCAL_ATTACK_CHAT_SEEN.has(key)) return false;
  globalThis.ADD2E_LOCAL_ATTACK_CHAT_SEEN.add(key);

  try {
    await ChatMessage.create({
      speaker: payload.speaker ?? { alias: "ADD2E" },
      content,
      whisper: userIds,
      blind: false,
      flags: { add2e: { attackChatVisibility: "players-only", attackChatVisibilityVersion: VERSION, localAttackKey: key, createdByPlayerRelay: true } }
    });
    return true;
  } catch (error) {
    console.error(`${TAG}[PLAYER_CHAT]`, error);
    return false;
  }
}

function currentCombatRound() {
  const round = num(game.combat?.round, 0);
  return round > 0 ? round : 0;
}

async function normalizeCreatedEffect(effect) {
  if (!effect || typeof game.add2e?.time?.normalizeEffect !== "function") return;
  try {
    await game.add2e.time.normalizeEffect(effect, currentCombatRound());
  } catch (error) {
    console.warn(`${TAG}[EFFECT_NORMALIZE]`, error);
  }
}

async function applyDamage(payload = {}) {
  const actor = await resolveActor(payload);
  if (!actor) return console.warn(`${TAG}[DAMAGE] acteur introuvable`, payload);
  const amount = Math.abs(num(payload.montant, 0));
  if (!amount) return false;
  const system = actor.system ?? {};
  const max = num(system.points_de_coup, NaN)
    || num(system.pv_max, NaN)
    || num(system.points_de_vie, NaN)
    || num(system.hp?.max, NaN)
    || num(system.attributes?.hp?.max, 0);
  const current = [system.pdv, system.pv, system.hp?.value, system.attributes?.hp?.value]
    .map(value => num(value, NaN))
    .find(Number.isFinite) ?? max;
  const heal = String(payload.type ?? "").toLowerCase().includes("soin") || num(payload.montant, 0) < 0;
  const next = heal ? Math.min(max || current + amount, current + amount) : current - amount;
  await actor.update({ "system.pdv": next }, { add2eReason: "gm-relay-apply-damage", add2eDetails: payload.details });
  return true;
}

async function deleteActiveEffects(payload = {}) {
  const actor = await resolveActor(payload);
  if (!actor) return console.warn(`${TAG}[DELETE_EFFECTS] acteur introuvable`, payload);
  const ids = new Set(relayArray(payload.effectIds).filter(Boolean));
  const tagNorms = relayArray(payload.tags).map(relayNormalize);
  const nameNorms = relayArray(payload.names).map(relayNormalize);
  if (tagNorms.length || nameNorms.length) {
    for (const effect of actor.effects ?? []) {
      const tags = relayArray(effect.flags?.add2e?.tags ?? effect.getFlag?.("add2e", "tags") ?? []).map(relayNormalize);
      const name = relayNormalize(effect.name);
      if (tagNorms.some(tag => tags.includes(tag)) || nameNorms.some(namePart => name.includes(namePart))) ids.add(effect.id);
    }
  }
  const finalIds = [...ids].filter(Boolean);
  if (finalIds.length) await actor.deleteEmbeddedDocuments("ActiveEffect", finalIds);
  return finalIds.length;
}

async function createActiveEffect(payload = {}) {
  const actor = await resolveActor(payload);
  if (!actor) return console.warn(`${TAG}[CREATE_EFFECT] acteur introuvable`, payload);
  const data = clone(payload.effectData ?? {});
  delete data._id;
  const created = await actor.createEmbeddedDocuments("ActiveEffect", [data]);
  await normalizeCreatedEffect(created?.[0]);
  return created?.[0] ?? null;
}

async function applyLegacyActiveEffect(payload = {}) {
  const actor = await resolveActor(payload);
  if (!actor) return console.warn(`${TAG}[LEGACY_EFFECT] acteur introuvable`, payload);
  const data = clone(payload.effectData ?? {});
  if (!data.name && data.label) data.name = data.label;
  if (!data.label && data.name) data.label = data.name;
  data.flags ??= {};
  data.flags.add2e ??= {};
  data.flags.add2e.appliedBySocket = true;
  data.flags.add2e.appliedByGM = game.user.id;
  data.flags.add2e.appliedAt = Date.now();
  const created = await actor.createEmbeddedDocuments("ActiveEffect", [data]);
  await normalizeCreatedEffect(created?.[0]);
  return created?.[0] ?? null;
}

function measuredTemplates(scene, payload = {}) {
  if (!scene) return [];
  const requestId = payload.templateRequestId ?? payload.requestId ?? null;
  const templateId = payload.templateId ?? null;
  const spell = payload.spell ?? null;
  return Array.from(scene.templates ?? []).filter(template => {
    const flags = template.flags?.add2e ?? {};
    return (templateId && template.id === templateId)
      || (requestId && (flags.templateRequestId === requestId || template.getFlag?.("add2e", "templateRequestId") === requestId))
      || (spell && flags.spell === spell && (!requestId || flags.templateRequestId === requestId));
  });
}

function measuredDrawings(scene, payload = {}) {
  if (!scene) return [];
  const requestId = payload.templateRequestId ?? payload.requestId ?? null;
  const spell = payload.spell ?? null;
  return Array.from(scene.drawings ?? []).filter(drawing => {
    const flags = drawing.flags?.add2e ?? {};
    return (requestId && flags.templateRequestId === requestId)
      || (spell && flags.spell === spell && (!requestId || flags.templateRequestId === requestId));
  });
}

function distanceToPixels(scene, distance) {
  const gridDistance = num(scene?.grid?.distance ?? canvas?.scene?.grid?.distance, 1) || 1;
  const gridSize = num(scene?.grid?.size ?? canvas?.grid?.size ?? canvas?.dimensions?.size, 100) || 100;
  return num(distance, 0) / gridDistance * gridSize;
}

async function createVisibleDrawingFallback(scene, templateData, payload = {}) {
  if (!scene) return;
  const flags = templateData.flags?.add2e ?? {};
  const requestId = payload.templateRequestId ?? flags.templateRequestId ?? null;
  if (requestId && measuredDrawings(scene, { templateRequestId: requestId }).length) return;
  const type = String(templateData.t ?? templateData.type ?? "circle").toLowerCase();
  const x = num(templateData.x, 0);
  const y = num(templateData.y, 0);
  const color = payload.drawingColor ?? templateData.fillColor ?? "#7aa85c";
  const alpha = num(payload.drawingAlpha, 0.28);
  let data = null;
  if (type === "circle") {
    const radius = Math.max(12, distanceToPixels(scene, templateData.distance ?? 1));
    data = { x: x - radius, y: y - radius, rotation: 0, hidden: false, locked: false, fillType: 1, fillColor: color, fillAlpha: alpha, strokeColor: payload.drawingStroke ?? color, strokeAlpha: .9, strokeWidth: 3, shape: { type: "e", width: radius * 2, height: radius * 2 } };
  } else if (type === "rect" || type === "rectangle") {
    const width = Math.max(12, distanceToPixels(scene, templateData.width ?? templateData.distance ?? 1));
    const height = Math.max(12, distanceToPixels(scene, templateData.distance ?? templateData.width ?? 1));
    data = { x: x - width / 2, y: y - height / 2, rotation: num(templateData.direction, 0), hidden: false, locked: false, fillType: 1, fillColor: color, fillAlpha: alpha, strokeColor: payload.drawingStroke ?? color, strokeAlpha: .9, strokeWidth: 3, shape: { type: "r", width, height } };
  }
  if (!data) return;
  data.flags = { add2e: { ...clone(flags), spell: payload.spell ?? flags.spell ?? null, spellName: payload.spellName ?? flags.spellName ?? null, templateRequestId: requestId, drawingFallback: true } };
  await scene.createEmbeddedDocuments("Drawing", [data]);
}

async function createMeasuredTemplate(payload = {}) {
  const scene = resolveScene(payload.sceneId);
  if (!scene) return console.warn(`${TAG}[CREATE_TEMPLATE] scène introuvable`, payload);
  const data = clone(payload.templateData ?? {});
  const requestId = payload.templateRequestId ?? data.flags?.add2e?.templateRequestId ?? null;
  if (requestId && measuredTemplates(scene, { templateRequestId: requestId }).length) return;
  data.flags ??= {};
  data.flags.add2e ??= {};
  if (requestId) data.flags.add2e.templateRequestId = requestId;
  if (payload.spell) data.flags.add2e.spell = payload.spell;
  if (payload.spellName) data.flags.add2e.spellName = payload.spellName;
  try {
    await scene.createEmbeddedDocuments("MeasuredTemplate", [data]);
  } catch (error) {
    console.warn(`${TAG}[CREATE_TEMPLATE] fallback dessin`, error);
  }
  if (payload.visibleDrawing !== false && data.flags?.add2e?.visibleDrawing !== false) await createVisibleDrawingFallback(scene, data, payload);
}

async function deleteMeasuredTemplates(payload = {}) {
  const scene = resolveScene(payload.sceneId);
  if (!scene) return console.warn(`${TAG}[DELETE_TEMPLATE] scène introuvable`, payload);
  const templates = measuredTemplates(scene, payload).map(entry => entry.id).filter(Boolean);
  if (templates.length) await scene.deleteEmbeddedDocuments("MeasuredTemplate", templates);
  const drawings = measuredDrawings(scene, payload).map(entry => entry.id).filter(Boolean);
  if (drawings.length) await scene.deleteEmbeddedDocuments("Drawing", drawings);
}

async function createAmbientLight(payload = {}) {
  const scene = resolveScene(payload.sceneId);
  if (!scene) return console.warn(`${TAG}[CREATE_LIGHT] scène introuvable`, payload);
  await scene.createEmbeddedDocuments("AmbientLight", [{
    x: num(payload.x, 0), y: num(payload.y, 0), rotation: num(payload.rotation, 0), walls: payload.walls !== false, vision: payload.vision === true,
    config: { dim: num(payload.dim, 6), bright: num(payload.bright, 3), angle: num(payload.angle, 360), color: payload.color ?? "#fffec4", alpha: num(payload.alpha, .5), coloration: num(payload.coloration, 1), luminosity: num(payload.luminosity, .5), attenuation: num(payload.attenuation, .5), animation: payload.animation ?? { type: "torch", speed: 2, intensity: 2, reverse: false } },
    flags: { add2e: clone(payload.flags?.add2e ?? {}) }
  }]);
}

async function deleteAmbientLight(payload = {}) {
  const scene = resolveScene(payload.sceneId);
  if (!scene) return console.warn(`${TAG}[DELETE_LIGHT] scène introuvable`, payload);
  const light = Array.from(scene.lights ?? []).find(entry => (payload.lightId && entry.id === payload.lightId) || (payload.requestId && (entry.flags?.add2e?.requestId === payload.requestId || entry.getFlag?.("add2e", "requestId") === payload.requestId)));
  if (light) await light.delete();
}

async function updateToken(payload = {}) {
  const scene = resolveScene(payload.sceneId);
  const token = scene?.tokens?.get?.(payload.tokenId) ?? null;
  if (!scene || !token) return console.warn(`${TAG}[UPDATE_TOKEN] scène/token introuvable`, payload);
  return token.update(payload.updateData ?? {});
}

async function vendorRecordProjectileSpent(payload = {}) {
  const combat = game.combats?.get?.(payload.combatId) ?? game.combat;
  if (!combat?.getFlag || !combat?.setFlag) return console.warn(`${TAG}[PROJECTILE_SPENT] combat introuvable`, payload);
  const actorId = payload.actorId ?? null;
  const itemKey = payload.itemId ?? payload.itemName ?? null;
  if (!actorId || !itemKey) return console.warn(`${TAG}[PROJECTILE_SPENT] payload incomplet`, payload);
  const spent = clone(await combat.getFlag(VENDOR_SCOPE, PROJECTILE_FLAG) ?? {});
  const quantity = Math.max(1, Math.floor(num(payload.quantity, 1)));
  spent[actorId] ??= { actorId, actorName: payload.actorName ?? "", items: {} };
  spent[actorId].actorName = payload.actorName ?? spent[actorId].actorName ?? "";
  spent[actorId].items ??= {};
  spent[actorId].items[itemKey] ??= { itemId: payload.itemId ?? null, itemName: payload.itemName ?? "Projectile", img: payload.img ?? null, spent: 0 };
  const item = spent[actorId].items[itemKey];
  item.spent = Math.max(0, num(item.spent, 0)) + quantity;
  item.itemId = payload.itemId ?? item.itemId ?? null;
  item.itemName = payload.itemName ?? item.itemName ?? "Projectile";
  item.img = payload.img ?? item.img ?? null;
  await combat.setFlag(VENDOR_SCOPE, PROJECTILE_FLAG, spent);
  return true;
}

function componentItem(actor, payload = {}) {
  if (!actor) return null;
  if (payload.itemId && actor.items?.get?.(payload.itemId)) return actor.items.get(payload.itemId);
  const wanted = relaySlug(payload.componentSlug ?? payload.itemSlug ?? payload.itemName ?? payload.componentName);
  if (!wanted) return null;
  return Array.from(actor.items ?? []).find(item => {
    const system = item.system ?? {};
    const flags = item.flags?.add2e ?? {};
    if (relaySlug(system.slug ?? system.composantSlug ?? item.name) === wanted) return true;
    const tags = [system.tags, system.effectTags, flags.tags].flatMap(value => Array.isArray(value) ? value : typeof value === "string" ? value.split(/[,;|]/g) : []);
    return tags.some(tag => relaySlug(String(tag).replace(/^composant:/i, "")) === wanted);
  }) ?? null;
}

async function consumeSpellComponent(payload = {}) {
  const actor = await resolveActor(payload);
  if (!actor) return console.warn(`${TAG}[COMPONENT] acteur introuvable`, payload);
  const item = componentItem(actor, payload);
  if (!item) return console.warn(`${TAG}[COMPONENT] composant introuvable`, { actor: actor.name, payload });
  const quantity = Math.max(1, Math.floor(num(payload.quantity, 1)));
  const before = Math.max(0, num(item.system?.quantite ?? item.system?.quantity, 0));
  await item.update({ "system.quantite": Math.max(0, before - quantity) }, { add2eReason: "gm-relay-consume-spell-component" });
  return true;
}

function familiarLink(actor) {
  return actor?.getFlag?.(FAMILIAR_SCOPE, FAMILIAR_FLAG) ?? actor?.flags?.[FAMILIAR_SCOPE]?.[FAMILIAR_FLAG] ?? null;
}

function familiarEffectData(effect) {
  return effect?.flags?.add2e?.familiar ?? effect?.getFlag?.(FAMILIAR_SCOPE, FAMILIAR_FLAG) ?? null;
}

function validFamiliarLink(link) {
  return !!(link && typeof link === "object" && link.actorId && link.linkId);
}

function familiarKey(caster, link) {
  return `${caster?.id ?? "actor"}:${link?.linkId ?? "link"}`;
}

function familiarActorForToken(token) {
  return token?.actor ?? game.actors?.get?.(token?.actorId) ?? null;
}

function familiarEffects(caster, linkId) {
  return Array.from(caster?.effects ?? []).filter(effect => familiarEffectData(effect)?.linkId === linkId);
}

function familiarToken(scene, actorId, preferredId = null) {
  if (!scene || !actorId) return null;
  const preferred = preferredId ? scene.tokens?.get?.(preferredId) ?? null : null;
  if (preferred?.actorId === actorId || preferred?.actor?.id === actorId) return preferred;
  return Array.from(scene.tokens ?? []).find(token => token?.actorId === actorId || token?.actor?.id === actorId) ?? null;
}

function familiarCasterForMasterToken(token) {
  const sceneId = token?.parent?.id ?? null;
  const tokenId = token?.id ?? null;
  if (!sceneId || !tokenId) return null;
  return Array.from(game.actors?.contents ?? []).find(caster => {
    const link = familiarLink(caster);
    return validFamiliarLink(link) && link.sceneId === sceneId && link.masterTokenId === tokenId;
  }) ?? null;
}

function familiarCasterForFamiliarActor(actor) {
  const source = familiarLink(actor);
  const direct = source?.masterActorId ? game.actors?.get?.(source.masterActorId) ?? null : null;
  return direct ?? Array.from(game.actors?.contents ?? []).find(candidate => familiarLink(candidate)?.actorId === actor?.id) ?? null;
}

function familiarCurrentHp(actor) {
  for (const value of [actor?.system?.pdv, actor?.system?.points_de_coup, actor?.system?.hp?.value, actor?.system?.health?.value]) {
    const hp = num(value, NaN);
    if (Number.isFinite(hp)) return hp;
  }
  return 0;
}

function familiarMaxHp(actor, fallback = 0) {
  for (const value of [actor?.system?.points_de_coup, actor?.system?.hp?.max, actor?.system?.health?.max, actor?.system?.pdv]) {
    const hp = num(value, NaN);
    if (Number.isFinite(hp) && hp > 0) return hp;
  }
  return Math.max(0, num(fallback, 0));
}

function familiarAlive(actor) {
  if (!actor || familiarCurrentHp(actor) <= 0) return false;
  const statuses = Array.from(actor.effects ?? []).flatMap(effect => {
    if (effect?.disabled) return [];
    const value = effect.statuses ?? effect.getFlag?.("core", "statusId") ?? effect.getFlag?.("core", "status") ?? [];
    return value instanceof Set ? [...value] : Array.isArray(value) ? value : [value];
  }).map(relayNormalize);
  return !statuses.some(status => ["dead", "mort", "defeated", "vaincu"].includes(status));
}

function familiarCenter(token) {
  if (!token) return null;
  const scene = token.parent ?? canvas?.scene ?? null;
  const size = num(scene?.grid?.size ?? canvas?.grid?.size, 100) || 100;
  return { x: num(token.x) + num(token.width, 1) * size / 2, y: num(token.y) + num(token.height, 1) * size / 2 };
}

function familiarDistance(master, familiar) {
  const a = familiarCenter(master);
  const b = familiarCenter(familiar);
  if (!a || !b) return Infinity;
  const sameScene = master?.parent?.id && master.parent.id === canvas?.scene?.id && familiar?.parent?.id === master.parent.id;
  if (sameScene && typeof canvas?.grid?.measurePath === "function") {
    try {
      const result = canvas.grid.measurePath([a, b], { gridSpaces: true });
      const spaces = num(result?.spaces ?? result?.gridDistance, NaN);
      if (Number.isFinite(spaces)) return spaces;
      const measured = num(result?.distance ?? result?.cost ?? result, NaN);
      const unit = num(master?.parent?.grid?.distance ?? canvas?.grid?.distance, NaN);
      if (Number.isFinite(measured) && Number.isFinite(unit) && unit > 0) return measured / unit;
    } catch (_error) {}
  }
  const size = num(master?.parent?.grid?.size ?? familiar?.parent?.grid?.size ?? canvas?.grid?.size, 100) || 100;
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) / size;
}

function familiarOffset(value) {
  const x = num(value?.x, NaN);
  const y = num(value?.y, NaN);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

function familiarOffsetFromTokens(master, familiar) {
  if (!master || !familiar) return null;
  return familiarOffset({ x: num(familiar.x, NaN) - num(master.x, NaN), y: num(familiar.y, NaN) - num(master.y, NaN) });
}

function sameOffset(left, right) {
  const a = familiarOffset(left);
  const b = familiarOffset(right);
  return (!a && !b) || (!!a && !!b && Math.abs(a.x - b.x) < .01 && Math.abs(a.y - b.y) < .01);
}

function relationChanged(current, next) {
  return current.sceneId !== next.sceneId
    || current.masterTokenId !== next.masterTokenId
    || current.tokenId !== next.tokenId
    || current.follow !== next.follow
    || current.inRange !== next.inRange
    || current.distance !== next.distance
    || current.familiarMaxHp !== next.familiarMaxHp
    || !sameOffset(current.followOffset, next.followOffset);
}

async function writeFamiliarLink(caster, link) {
  await caster.setFlag(FAMILIAR_SCOPE, FAMILIAR_FLAG, link, { add2eFamiliarRelation: true, add2eInternal: true });
  const actor = game.actors?.get?.(link.actorId) ?? null;
  if (!actor) return;
  await actor.setFlag(FAMILIAR_SCOPE, FAMILIAR_FLAG, {
    linkId: link.linkId, masterActorId: caster.id, masterActorUuid: caster.uuid,
    sceneId: link.sceneId ?? null, masterTokenId: link.masterTokenId ?? null, tokenId: link.tokenId ?? null,
    follow: link.follow !== false, followOffset: familiarOffset(link.followOffset)
  }, { add2eFamiliarRelation: true, add2eInternal: true });
}

function familiarShareState(caster) {
  return caster?.getFlag?.(FAMILIAR_SCOPE, FAMILIAR_HP_SHARE_FLAG) ?? caster?.flags?.[FAMILIAR_SCOPE]?.[FAMILIAR_HP_SHARE_FLAG] ?? null;
}

async function applyFamiliarHpShare(caster, link, amount) {
  if (!caster || !link?.linkId) return false;
  const desired = Math.max(0, Math.floor(num(amount, 0)));
  const key = familiarKey(caster, link);
  if (familiarHpTransitions.has(key)) return false;
  const priorState = familiarShareState(caster);
  const previous = priorState?.linkId === link.linkId ? Math.max(0, Math.floor(num(priorState.amount, 0))) : 0;
  if (previous === desired && priorState?.linkId === link.linkId) return false;
  const max = num(caster.system?.points_de_coup, NaN);
  const current = num(caster.system?.pdv, NaN);
  const state = { linkId: link.linkId, amount: desired };
  if (!Number.isFinite(max) || !Number.isFinite(current)) {
    await caster.update({ [`flags.${FAMILIAR_SCOPE}.${FAMILIAR_HP_SHARE_FLAG}`]: state }, { add2eFamiliarHpShare: true, add2eInternal: true });
    return false;
  }
  const baseMax = Math.max(0, max - previous);
  const baseCurrent = current - previous;
  const nextMax = Math.max(0, baseMax + desired);
  const nextCurrent = Math.min(nextMax, baseCurrent + desired);
  familiarHpTransitions.add(key);
  try {
    await caster.update({
      "system.points_de_coup": nextMax,
      "system.pdv": nextCurrent,
      [`flags.${FAMILIAR_SCOPE}.${FAMILIAR_HP_SHARE_FLAG}`]: state
    }, { add2eFamiliarHpShare: true, add2eInternal: true });
    return true;
  } finally {
    familiarHpTransitions.delete(key);
  }
}

async function setFamiliarBenefits(caster, link, enabled) {
  const updates = familiarEffects(caster, link.linkId)
    .filter(effect => familiarEffectData(effect)?.kind === "benefit" && effect.disabled === enabled)
    .map(effect => effect.update({ disabled: !enabled }, { add2eFamiliarBenefitState: true, add2eInternal: true }));
  if (updates.length) await Promise.all(updates);
}

function familiarOwnerIds(actor) {
  const owner = CONST.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3;
  return Object.entries(actor?.ownership ?? {})
    .filter(([id, level]) => id !== "default" && num(level, 0) >= owner)
    .map(([id]) => id)
    .filter(id => game.users?.get?.(id)?.active && !game.users?.get?.(id)?.isGM);
}

async function familiarRangeMessage(caster, link, inRange, distance) {
  const recipients = [...new Set([
    ...familiarOwnerIds(caster),
    ...Array.from(game.users ?? []).filter(user => user.active && user.isGM).map(user => user.id)
  ])];
  if (!recipients.length) return;
  const color = inRange ? "#2f8f46" : "#b33a2e";
  const title = inRange ? "LIAISON RÉTABLIE" : "FAMILIER TROP ÉLOIGNÉ";
  const label = link.label ?? "Le familier";
  const distanceLabel = Number.isFinite(distance) ? `${distance.toFixed(1)} cases` : "hors de portée";
  const text = inRange
    ? `${label} est à nouveau à portée. Les bienfaits sont réactivés.`
    : `${label} est à ${distanceLabel}. Les bienfaits sont suspendus au-delà de ${link.range ?? FAMILIAR_RANGE_DEFAULT} cases.`;
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: caster }), whisper: recipients,
    content: `<div class="add2e-chat-card" style="border:1px solid ${color};border-radius:8px;background:#fffdf6;padding:.65em .8em;"><b style="color:${color};">${title}</b><div style="margin-top:.25em;">${text}</div></div>`,
    flags: { add2e: { familiarRange: true, familiarLinkId: link.linkId, inRange } }
  });
}

async function ensureFamiliarTokenVisible(token, actor) {
  if (!token) return false;
  const source = token.texture?.src || actor?.prototypeToken?.texture?.src || actor?.img || "icons/svg/mystery-man.svg";
  const friendly = CONST.TOKEN_DISPOSITIONS?.FRIENDLY ?? 1;
  const hover = CONST.TOKEN_DISPLAY_MODES?.ALWAYS_HOVER ?? 20;
  const update = {};
  if (token.hidden === true) update.hidden = false;
  if (num(token.alpha, 1) !== 1) update.alpha = 1;
  if (token.actorLink !== true) update.actorLink = true;
  if (num(token.disposition, friendly) !== friendly) update.disposition = friendly;
  if (num(token.displayName, hover) !== hover) update.displayName = hover;
  if (num(token.displayBars, hover) !== hover) update.displayBars = hover;
  if (token.bar1?.attribute !== "system.pdv") update.bar1 = { attribute: "system.pdv" };
  if (token.sight?.enabled !== true) update.sight = { ...(token.sight ?? {}), enabled: true };
  if (token.texture?.src !== source) update.texture = { ...(token.texture ?? {}), src: source };
  if (!Object.keys(update).length) return false;
  await token.update(update, { add2eFamiliarVisibility: true, render: true });
  return true;
}

async function applyFamiliarDeathPenalty(caster, link) {
  if (link.deathPenaltyApplied === true) return false;
  const policy = link.deathPenalty && typeof link.deathPenalty === "object" ? link.deathPenalty : { type: "hp", multiplier: 2 };
  await applyFamiliarHpShare(caster, link, 0);
  let result = null;
  if (String(policy.type ?? "hp").toLowerCase() === "level") {
    const amount = Math.max(1, Math.floor(num(policy.amount, 4)));
    const from = Math.max(1, Math.floor(num(caster?._source?.system?.niveau ?? caster.system?.niveau, 1)));
    const to = Math.max(1, from - amount);
    if (to !== from) await caster.update({ "system.niveau": to }, { add2eFamiliarDeathPenalty: true, add2eInternal: true });
    result = { type: "level", amount, from, to };
  } else {
    const amount = Math.max(0, Math.floor(num(link.familiarMaxHp, 0)) * Math.max(1, Math.floor(num(policy.multiplier, 2))));
    const max = num(caster.system?.points_de_coup, NaN);
    const current = num(caster.system?.pdv, NaN);
    if (amount && Number.isFinite(max) && Number.isFinite(current)) await caster.update({ "system.points_de_coup": Math.max(0, max - amount), "system.pdv": current - amount }, { add2eFamiliarDeathPenalty: true, add2eInternal: true });
    result = { type: "hp", amount };
  }
  await writeFamiliarLink(caster, { ...link, deathPenaltyApplied: true, deathPenaltyResult: result, inRange: false });
  return true;
}

async function dissolveFamiliar(caster, link = familiarLink(caster), { removeEffects = true } = {}) {
  if (!isResponsibleGM() || !caster || !validFamiliarLink(link)) return false;
  const key = familiarKey(caster, link);
  if (familiarDissolving.has(key)) return false;
  familiarDissolving.add(key);
  try {
    await applyFamiliarHpShare(caster, link, 0);
    if (removeEffects) {
      const ids = familiarEffects(caster, link.linkId).map(effect => effect.id).filter(Boolean);
      if (ids.length) await caster.deleteEmbeddedDocuments("ActiveEffect", ids, { add2eFamiliarDissolve: true, add2eInternal: true });
    }
    for (const scene of game.scenes?.contents ?? []) {
      const ids = Array.from(scene.tokens ?? []).filter(token => token?.actorId === link.actorId || token?.flags?.add2e?.familiar?.linkId === link.linkId).map(token => token.id).filter(Boolean);
      if (ids.length) await scene.deleteEmbeddedDocuments("Token", ids, { add2eFamiliarDissolve: true, add2eInternal: true });
    }
    const familiarActor = game.actors?.get?.(link.actorId) ?? null;
    const source = familiarLink(familiarActor);
    if (familiarActor && (source?.linkId === link.linkId || source?.masterActorId === caster.id)) await familiarActor.delete({ add2eFamiliarDissolve: true, add2eInternal: true });
    if (familiarLink(caster)?.linkId === link.linkId) await caster.unsetFlag(FAMILIAR_SCOPE, FAMILIAR_FLAG, { add2eFamiliarDissolve: true, add2eInternal: true });
    if (familiarShareState(caster)?.linkId === link.linkId) await caster.unsetFlag(FAMILIAR_SCOPE, FAMILIAR_HP_SHARE_FLAG, { add2eFamiliarDissolve: true, add2eInternal: true });
    return true;
  } finally {
    setTimeout(() => familiarDissolving.delete(key), 0);
  }
}

async function syncFamiliar(caster, { notify = false } = {}) {
  if (!isResponsibleGM() || !caster) return false;
  const link = familiarLink(caster);
  if (!validFamiliarLink(link) || familiarDissolving.has(familiarKey(caster, link))) return false;
  const scene = resolveScene(link.sceneId);
  const familiarActor = game.actors?.get?.(link.actorId) ?? null;
  const master = familiarToken(scene, caster.id, link.masterTokenId);
  const familiar = familiarToken(scene, link.actorId, link.tokenId);
  if (familiar) await ensureFamiliarTokenVisible(familiar, familiarActor);
  if (!familiarAlive(familiarActor)) {
    await setFamiliarBenefits(caster, link, false);
    await applyFamiliarDeathPenalty(caster, link);
    return false;
  }
  const distance = master && familiar ? familiarDistance(master, familiar) : Infinity;
  const inRange = !!(master && familiar && distance <= (num(link.range, FAMILIAR_RANGE_DEFAULT) || FAMILIAR_RANGE_DEFAULT) + .01);
  const changed = typeof link.inRange === "boolean" && link.inRange !== inRange;
  const next = {
    ...link,
    sceneId: scene?.id ?? link.sceneId ?? null,
    masterTokenId: master?.id ?? link.masterTokenId ?? null,
    tokenId: familiar?.id ?? link.tokenId ?? null,
    familiarMaxHp: Math.max(0, Math.floor(num(link.familiarMaxHp, familiarMaxHp(familiarActor)))),
    inRange,
    distance: Number.isFinite(distance) ? Math.round(distance * 100) / 100 : null,
    follow: link.follow !== false,
    followOffset: familiarOffset(link.followOffset) ?? familiarOffsetFromTokens(master, familiar)
  };
  if (typeof link.inRange !== "boolean" || relationChanged(link, next)) await writeFamiliarLink(caster, next);
  await applyFamiliarHpShare(caster, next, inRange ? next.familiarMaxHp : 0);
  await setFamiliarBenefits(caster, next, inRange);
  if (changed && notify) await familiarRangeMessage(caster, next, inRange, distance);
  return inRange;
}

function queueFamiliarSync(caster, options = {}) {
  const link = familiarLink(caster);
  if (!caster?.id || !isResponsibleGM() || !validFamiliarLink(link) || familiarSyncQueued.has(caster.id)) return;
  if (familiarDissolving.has(familiarKey(caster, link)) || familiarHpTransitions.has(familiarKey(caster, link))) return;
  familiarSyncQueued.add(caster.id);
  setTimeout(() => {
    familiarSyncQueued.delete(caster.id);
    syncFamiliar(caster, options).catch(error => console.error(`${TAG}[FAMILIAR_SYNC]`, error));
  }, 0);
}

function nativeMoveAvailable() {
  return typeof globalThis.foundry?.documents?.TokenDocument?.prototype?.move === "function";
}

function internalFamiliarMove(operation = {}) {
  return operation?.add2eFamiliarFollow === true || operation?.options?.add2eFamiliarFollow === true || operation?.add2eIgnoreMovement === true || operation?.options?.add2eIgnoreMovement === true;
}

async function followMaster(caster, master, destination, origin = null, native = false) {
  if (!isResponsibleGM() || !caster) return;
  const link = familiarLink(caster);
  if (!validFamiliarLink(link) || link.follow === false) return queueFamiliarSync(caster, { notify: true });
  const scene = master.parent ?? resolveScene(link.sceneId);
  const familiar = familiarToken(scene, link.actorId, link.tokenId);
  if (!scene || !familiar) return queueFamiliarSync(caster, { notify: true });
  const offset = familiarOffset(link.followOffset) ?? familiarOffsetFromTokens(origin, familiar);
  if (!offset) return queueFamiliarSync(caster, { notify: true });
  const next = { ...link, sceneId: scene.id ?? link.sceneId, masterTokenId: master.id ?? link.masterTokenId, tokenId: familiar.id ?? link.tokenId, follow: true, followOffset: offset };
  if (relationChanged(link, next)) await writeFamiliarLink(caster, next);
  const target = { x: num(destination?.x, num(master.x)) + offset.x, y: num(destination?.y, num(master.y)) + offset.y };
  if (Math.abs(num(familiar.x) - target.x) > .01 || Math.abs(num(familiar.y) - target.y) > .01) {
    const options = { add2eFamiliarFollow: true, add2eIgnoreMovement: true, showRuler: false, render: true };
    if (native && typeof familiar.move === "function") await familiar.move(target, options);
    else await familiar.update(target, options);
  }
  queueFamiliarSync(caster, { notify: true });
}

async function setFamiliarFollow(payload = {}) {
  if (!isResponsibleGM()) return false;
  const caster = await resolveActor(payload);
  const link = familiarLink(caster);
  if (!caster || !validFamiliarLink(link)) return false;
  const scene = resolveScene(link.sceneId);
  const master = familiarToken(scene, caster.id, link.masterTokenId);
  const familiar = familiarToken(scene, link.actorId, link.tokenId);
  const follow = payload.follow === true;
  await writeFamiliarLink(caster, { ...link, follow, followOffset: follow ? familiarOffsetFromTokens(master, familiar) ?? familiarOffset(link.followOffset) : familiarOffset(link.followOffset) });
  await syncFamiliar(caster, { notify: false });
  return true;
}

async function handleFollowerMove(token, operation = {}) {
  const caster = familiarCasterForFamiliarActor(familiarActorForToken(token));
  if (!caster) return;
  if (!internalFamiliarMove(operation)) {
    const link = familiarLink(caster);
    if (validFamiliarLink(link) && link.follow !== false) await writeFamiliarLink(caster, { ...link, follow: false });
  }
  queueFamiliarSync(caster, { notify: true });
}

async function handleNativeMove(token, movement = {}, operation = {}) {
  if (!isResponsibleGM()) return;
  const caster = familiarCasterForMasterToken(token);
  if (caster) return followMaster(caster, token, movement.destination, movement.origin, true);
  return handleFollowerMove(token, operation);
}

async function handleLegacyMove(token, changes = {}, operation = {}) {
  if (!isResponsibleGM() || (changes.x === undefined && changes.y === undefined)) return;
  const caster = familiarCasterForMasterToken(token);
  if (caster) return followMaster(caster, token, { x: num(changes.x, num(token.x)), y: num(changes.y, num(token.y)) }, null, false);
  return handleFollowerMove(token, operation);
}

function familiarBenefit({ name, img, description, tags = [], common = {}, changes = [] }) {
  return { name, img, disabled: false, transfer: false, type: "base", changes, description, flags: { add2e: { tags, familiar: { ...common, kind: "benefit", action: null } } } };
}

function familiarEffectsData(caster, payload, link) {
  const familiar = payload.familiar ?? {};
  const img = familiar.img || "icons/svg/aura.svg";
  const common = { linkId: link.linkId, masterActorId: caster.id, masterActorUuid: caster.uuid, familiarActorId: link.actorId, familiarTokenId: link.tokenId, familiarLabel: link.label, range: link.range, senses: familiar.senses ?? "" };
  const tags = ["familier", "familier:communication", "familier:loyal", `familier:${familiar.key ?? "inconnu"}`, `familier:portee:${link.range}`];
  const rows = [
    familiarBenefit({ name: `Familier — Vitalité partagée (${link.familiarMaxHp} PV)`, img, description: `${link.familiarMaxHp} PV sont ajoutés au magicien tant que ${link.label} demeure à ${link.range} cases ou moins.`, tags: [...tags, "familier:partage_pv"], common }),
    familiarBenefit({ name: `Familier — Sens de ${link.label}`, img, description: familiar.senses || "Le magicien profite des sens de son familier lorsqu’il est à portée.", tags: [...new Set([...tags, ...(Array.isArray(familiar.tags) ? familiar.tags : [])])], common })
  ];
  if (familiar.dexterityTo18 === true) rows.push(familiarBenefit({ name: "Familier — Dextérité féerique (18)", img, description: "Le lutin confère au magicien une Dextérité de 18 tant que la liaison demeure active.", tags: [...tags, "familier:lutin", "dexterite:18"], common, changes: [{ key: "system.dexterite", mode: CONST.ACTIVE_EFFECT_MODES?.OVERRIDE ?? 5, value: "18", priority: 20 }] }));
  if (familiar.neverSurprised === true) rows.push(familiarBenefit({ name: "Familier — Jamais surpris", img, description: "Le lutin empêche le magicien d’être surpris.", tags: [...tags, "immunite:surprise", "familier:jamais_surpris"], common }));
  if (num(familiar.saveBonus, 0) !== 0) rows.push(familiarBenefit({ name: `Familier — Bonus aux jets de protection (+${num(familiar.saveBonus)})`, img, description: "Le lutin accorde ce bonus à tous les jets de protection.", tags: [...tags, `bonus_save:${num(familiar.saveBonus)}`], common }));
  for (const resistance of Array.isArray(familiar.masterResistances) ? familiar.masterResistances : []) {
    const type = String(resistance?.type ?? "").trim();
    const percent = Math.max(0, Math.min(100, Math.floor(num(resistance?.percent, 0))));
    if (type && percent) rows.push(familiarBenefit({ name: `Familier — Résistance à la magie (${percent} %)`, img, description: `${link.label} confère une résistance magique de ${percent} % au magicien.`, tags: [...tags, `resistance:${type}:${percent}`], common }));
  }
  const regen = Math.max(0, Math.floor(num(familiar.regenerationPerRound, 0)));
  if (regen) rows.push(familiarBenefit({ name: `Familier — Régénération (${regen} PV / round)`, img, description: `${link.label} rend ${regen} PV au magicien au début de chaque round de combat tant que la liaison demeure active.`, tags: [...tags, `regeneration:${regen}:round`], common }));
  const level = Math.max(0, Math.floor(num(familiar.temporaryLevelBonus, 0)));
  if (level) rows.push(familiarBenefit({ name: `Familier — Niveau effectif (+${level})`, img, description: `${link.label} confère ${level} niveau effectif au magicien tant que la liaison demeure active.`, tags: [...tags, `bonus_niveau:${level}`], common, changes: [{ key: "system.niveau", mode: CONST.ACTIVE_EFFECT_MODES?.ADD ?? 2, value: String(level), priority: 20 }] }));
  rows.push(
    { name: `Familier — Vision partagée (${link.label})`, img, disabled: false, transfer: false, type: "base", changes: [], description: `Utiliser pour centrer la scène sur ${link.label} sans modifier la sélection ni le HUD du magicien.`, flags: { add2e: { tags: [...tags, "familier:partage_sens"], familiar: { ...common, kind: "action", action: "share-senses" } } } },
    { name: `Familier — Suivi automatique (${link.label})`, img, disabled: false, transfer: false, type: "base", changes: [], description: "Utiliser pour activer ou désactiver le suivi automatique du magicien.", flags: { add2e: { tags: [...tags, "familier:suivi"], familiar: { ...common, kind: "action", action: "toggle-follow" } } } }
  );
  return rows;
}

function normalFamiliarActorData(caster, payload) {
  const familiar = payload.familiar ?? {};
  const hp = Math.max(2, Math.min(4, Math.floor(num(familiar.hp, 2))));
  const label = familiar.label ?? "Familier";
  const img = familiar.img || "icons/svg/mystery-man.svg";
  return {
    name: `${label} — familier de ${caster.name}`, type: "monster", img,
    system: {
      type: "Animal", type_monstre: "animal", frequency: "Familier", size: "P", alignment: "Neutre", armorClass: 7, ca_total: 7, ca_naturel: 7, thac0: 20, hitDice: "—", dv: "—", pdv: hp, points_de_coup: hp,
      movement: "12", movement_raw: "12", movement_base: 12, movement_max: 12, movement_modes: { marche: { value: 12, raw: "12" } }, mouvement: { raw: "12", base: 12, actuel: 12, max: 12, primaryMode: "marche", modes: { marche: { value: 12, raw: "12" } }, unit: "m" },
      initiative: 0, attacksCount: "1", attackTypes: "Morsure ou griffes", damage: "1", specialAttacks: "Aucune", specialDefenses: "Aucune", magicResistance: "Aucune", savingThrows: "Animal", morale: 12, intelligence: "Supérieure à la normale", treasure: "Aucun", xp: 0,
      senses: familiar.senses ?? "", languages: `Télépathie avec ${caster.name}`, description: `<p><b>Familier de ${caster.name}.</b> ${familiar.senses ?? ""}</p>`, habitat: "Auprès de son maître", organization: "Solitaire", activityCycle: "Selon son maître", notes: "Familier normal : fidèle au magicien.",
      tags: ["acteur:monstre", "familier", `familier:${familiar.key ?? "normal"}`, "creature:animal"], effectTags: ["acteur:monstre", "familier", `familier:${familiar.key ?? "normal"}`, "creature:animal"], capacites_monstre: [{ type: "sens", name: "Sens de familier", description: familiar.senses ?? "", tags: Array.isArray(familiar.tags) ? familiar.tags : [] }]
    },
    prototypeToken: { name: `${label} — familier de ${caster.name}`, actorLink: true, disposition: CONST.TOKEN_DISPOSITIONS?.FRIENDLY ?? 1, hidden: false, alpha: 1, sight: { enabled: true }, bar1: { attribute: "system.pdv" }, texture: { src: img } },
    ownership: clone(caster.ownership ?? {}), flags: { add2e: { familiar: { linkId: payload.requestId, masterActorId: caster.id, masterActorUuid: caster.uuid, follow: true } } }
  };
}

async function specialFamiliarActorData(caster, payload) {
  const familiar = payload.familiar ?? {};
  const pack = game.packs?.get?.("add2e.monstres") ?? null;
  if (!pack) return null;
  const aliases = new Set([relayNormalize(familiar.label), ...(Array.isArray(familiar.aliases) ? familiar.aliases.map(relayNormalize) : [])].filter(Boolean));
  const index = await pack.getIndex({ fields: ["name", "img"] });
  const rows = Array.from(index?.contents ?? index ?? pack.index?.contents ?? pack.index ?? []);
  const row = rows.find(entry => {
    const name = relayNormalize(entry?.name);
    return [...aliases].some(alias => name === alias || name.includes(alias) || alias.includes(name));
  }) ?? null;
  if (!row) return null;
  const source = await pack.getDocument(row._id ?? row.id);
  if (!source) return null;
  const data = source.toObject();
  delete data._id; delete data.folder; delete data.sort;
  const img = familiar.img || data.img || "icons/svg/mystery-man.svg";
  return {
    ...data, name: `${familiar.label} — familier de ${caster.name}`, img, ownership: clone(caster.ownership ?? {}),
    prototypeToken: { ...clone(data.prototypeToken ?? {}), name: `${familiar.label} — familier de ${caster.name}`, actorLink: true, hidden: false, alpha: 1, disposition: CONST.TOKEN_DISPOSITIONS?.FRIENDLY ?? 1, sight: { ...(data.prototypeToken?.sight ?? {}), enabled: true }, bar1: { attribute: "system.pdv" }, texture: { ...(data.prototypeToken?.texture ?? {}), src: familiar.img || data.prototypeToken?.texture?.src || img } },
    flags: { ...clone(data.flags ?? {}), add2e: { ...clone(data.flags?.add2e ?? {}), familiar: { linkId: payload.requestId, masterActorId: caster.id, masterActorUuid: caster.uuid, follow: true } } }
  };
}

async function createFamiliarToken(scene, actor, casterToken, link) {
  const prototype = clone(actor.prototypeToken?.toObject?.() ?? actor.prototypeToken ?? {});
  const size = num(scene?.grid?.size ?? canvas?.grid?.size, 100) || 100;
  const src = prototype.texture?.src ?? actor.img ?? "icons/svg/mystery-man.svg";
  const [token] = await scene.createEmbeddedDocuments("Token", [{
    ...prototype, name: actor.name, actorId: actor.id, actorLink: true, x: num(casterToken.x) + size, y: num(casterToken.y), width: num(prototype.width, 1) || 1, height: num(prototype.height, 1) || 1,
    hidden: false, alpha: 1, disposition: CONST.TOKEN_DISPOSITIONS?.FRIENDLY ?? 1, displayName: CONST.TOKEN_DISPLAY_MODES?.ALWAYS_HOVER ?? 20, displayBars: CONST.TOKEN_DISPLAY_MODES?.ALWAYS_HOVER ?? 20, bar1: { attribute: "system.pdv" }, sight: { ...(prototype.sight ?? {}), enabled: true }, texture: { ...(prototype.texture ?? {}), src },
    flags: { ...(prototype.flags ?? {}), add2e: { ...(prototype.flags?.add2e ?? {}), familiar: { linkId: link.linkId, masterActorId: link.masterActorId, masterTokenId: link.masterTokenId, follow: true } } }
  }]);
  return token ?? null;
}

async function createFamiliar(payload = {}) {
  if (!isResponsibleGM()) return false;
  const caster = await resolveActor(payload);
  const scene = resolveScene(payload.sceneId);
  const casterToken = scene?.tokens?.get?.(payload.casterTokenId) ?? null;
  const familiar = payload.familiar ?? {};
  if (!caster || caster.type !== "personnage" || !scene || !casterToken || !familiar?.key || !familiar?.label) return false;
  const previous = familiarLink(caster);
  if (previous?.linkId) {
    const existingActor = game.actors?.get?.(previous.actorId) ?? null;
    const existingEffects = familiarEffects(caster, previous.linkId);
    if (existingActor && existingEffects.length) return false;
    await dissolveFamiliar(caster, previous, { removeEffects: existingEffects.length > 0 });
  }
  const actorData = familiar.special === true ? await specialFamiliarActorData(caster, payload) : normalFamiliarActorData(caster, payload);
  if (!actorData) return ui.notifications.warn(`Invocation d’un familier : l’acteur de compendium « ${familiar.label} » est introuvable.`);
  const actor = await Actor.create(actorData);
  if (!actor) return false;
  const link = {
    version: VERSION, linkId: payload.requestId, actorId: actor.id, actorUuid: actor.uuid, label: familiar.label, key: familiar.key, sceneId: scene.id, masterTokenId: casterToken.id, tokenId: null,
    follow: true, followOffset: null, inRange: null, range: Math.max(1, Math.floor(num(familiar.range, FAMILIAR_RANGE_DEFAULT))), special: familiar.special === true,
    familiarMaxHp: familiarMaxHp(actor, familiar.hp), regenerationPerRound: Math.max(0, Math.floor(num(familiar.regenerationPerRound, 0))), temporaryLevelBonus: Math.max(0, Math.floor(num(familiar.temporaryLevelBonus, 0))), deathPenalty: familiar.deathPenalty && typeof familiar.deathPenalty === "object" ? clone(familiar.deathPenalty) : { type: "hp", multiplier: 2 }, deathPenaltyApplied: false, createdAt: Date.now()
  };
  const token = await createFamiliarToken(scene, actor, casterToken, link);
  if (!token) { await actor.delete(); return false; }
  link.tokenId = token.id;
  link.followOffset = familiarOffsetFromTokens(casterToken, token);
  await writeFamiliarLink(caster, link);
  await caster.createEmbeddedDocuments("ActiveEffect", familiarEffectsData(caster, payload, link));
  await ensureFamiliarTokenVisible(token, actor);
  await syncFamiliar(caster, { notify: false });
  return true;
}

async function useFamiliarEffect(actor, effect) {
  const data = familiarEffectData(effect);
  const link = familiarLink(actor);
  if (!actor || !data?.action || !validFamiliarLink(link) || link.linkId !== data.linkId) return ui.notifications.warn("Ce lien de familier n’est plus valide.");
  if (data.action === "share-senses") {
    if (link.inRange !== true) return ui.notifications.warn(`${link.label} est hors de portée : le partage des sens est suspendu.`);
    const familiarActor = game.actors?.get?.(link.actorId) ?? null;
    const senses = familiarActor?.system?.senses ?? data.senses ?? "Aucun sens spécial renseigné.";
    const placeable = canvas?.scene?.id === link.sceneId ? canvas?.tokens?.get?.(link.tokenId) ?? canvas?.tokens?.placeables?.find?.(token => token?.id === link.tokenId || token?.document?.id === link.tokenId) ?? null : null;
    if (placeable?.center) canvas?.animatePan?.({ x: placeable.center.x, y: placeable.center.y, duration: 250 });
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<div class="add2e-chat-card" style="border:1px solid #496f99;border-radius:8px;background:#f4f9ff;padding:.65em .8em;"><b>Vision partagée — ${link.label}</b><div style="margin-top:.25em;">${senses}</div><div style="margin-top:.4em;font-size:.9em;">La scène est centrée sur le familier. La sélection du magicien et le HUD restent inchangés.</div></div>`, flags: { add2e: { familiarSenseShare: true, familiarLinkId: link.linkId } } });
    return true;
  }
  if (data.action === "toggle-follow") {
    const follow = link.follow === false;
    const payload = { actorId: actor.id, actorUuid: actor.uuid, follow };
    if (isResponsibleGM()) await setFamiliarFollow(payload);
    else game.socket.emit(ADD2E_SOCKET, { type: ADD2E_GM_OPERATION, operation: "setFamiliarFollow", payload });
    ui.notifications.info(follow ? `${link.label} suivra à nouveau le magicien.` : `${link.label} reste désormais en déplacement libre.`);
    return true;
  }
  return false;
}

async function regenerateFamiliarCaster(caster, link) {
  const amount = Math.max(0, Math.floor(num(link?.regenerationPerRound, 0)));
  if (!caster || !amount || link?.inRange !== true || link?.deathPenaltyApplied === true) return false;
  const max = num(caster.system?.points_de_coup, NaN);
  const current = num(caster.system?.pdv, NaN);
  if (!Number.isFinite(max) || !Number.isFinite(current)) return false;
  const next = Math.min(max, current + amount);
  if (next <= current) return false;
  await caster.update({ "system.pdv": next }, { add2eFamiliarRegeneration: true, add2eInternal: true });
  return true;
}

async function regenerateOnRound(combat, changes = {}) {
  if (!isResponsibleGM() || !combat || !Object.prototype.hasOwnProperty.call(changes, "round")) return;
  const round = Math.max(0, Math.floor(num(combat.round, 0)));
  if (!round) return;
  for (const caster of game.actors?.contents ?? []) {
    const link = familiarLink(caster);
    if (!validFamiliarLink(link) || Math.max(0, Math.floor(num(link.regenerationPerRound, 0))) < 1) continue;
    const marker = `${combat.id}:${round}:${link.linkId}`;
    if (familiarRegenerationMarkers.get(caster.id) === marker) continue;
    familiarRegenerationMarkers.set(caster.id, marker);
    if (await syncFamiliar(caster, { notify: true })) await regenerateFamiliarCaster(caster, familiarLink(caster) ?? link);
  }
}

function actionFromName(name) {
  const value = String(name ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[—–-]/g, " ").replace(/\s+/g, " ").trim();
  if (value.startsWith("familier partage des sens") || value.startsWith("familier vision partagee")) return "share-senses";
  if (value.startsWith("familier suivi automatique")) return "toggle-follow";
  return "";
}

function installFamiliarHelpers() {
  if (typeof Handlebars === "undefined") return;
  if (!Handlebars.helpers.add2eFamiliarEffectAction) Handlebars.registerHelper("add2eFamiliarEffectAction", actionFromName);
  if (!Handlebars.helpers.add2eFamiliarEffectActionTitle) Handlebars.registerHelper("add2eFamiliarEffectActionTitle", action => action === "share-senses" ? "Centrer la scène sur le familier" : "Activer ou désactiver le suivi automatique");
  if (!Handlebars.helpers.add2eFamiliarEffectActionIcon) Handlebars.registerHelper("add2eFamiliarEffectActionIcon", action => action === "share-senses" ? "fa-eye" : "fa-link");
}

function refreshFamiliarHudControls() {
  familiarHudRefreshQueued = false;
  const section = document.getElementById("add2e-action-hud")?.querySelector?.('[data-section="effets"]');
  if (!section) return;
  for (const row of section.querySelectorAll(".row.effect-row")) {
    const action = actionFromName(row.querySelector(".title")?.textContent ?? "");
    if (action === "share-senses" || action === "toggle-follow") row.remove();
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

function scheduleFamiliarHudRefresh() {
  if (familiarHudRefreshQueued) return;
  familiarHudRefreshQueued = true;
  (globalThis.requestAnimationFrame ?? (callback => setTimeout(callback, 16)))(refreshFamiliarHudControls);
}

function refreshHudAfterFamiliarSelection() {
  globalThis.add2eRefreshActionHud?.();
  scheduleFamiliarHudRefresh();
}

function installFamiliarHudBridge() {
  document.addEventListener("click", async event => {
    const control = event.target?.closest?.(".a2e-familiar-effect-action");
    if (!control) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    const actor = game.actors?.get?.(String(control.dataset.actorId ?? "")) ?? null;
    const effect = actor?.effects?.get?.(String(control.dataset.effectId ?? "")) ?? null;
    const data = familiarEffectData(effect);
    if (!actor || !effect || data?.kind !== "action" || data.action !== String(control.dataset.familiarAction ?? "")) return ui.notifications.warn("Cette action de familier n’est plus valide.");
    try {
      await useFamiliarEffect(actor, effect);
      if (actor.sheet?.rendered) actor.sheet.render(false);
      globalThis.add2eRefreshActionHud?.();
      scheduleFamiliarHudRefresh();
    } catch (error) {
      console.error(`${TAG}[FAMILIAR_ACTION]`, error);
      ui.notifications.error("Impossible d’utiliser cette action de familier.");
    }
  }, true);
  Hooks.on("controlToken", (token, controlled) => {
    if (!controlled || !validFamiliarLink(familiarLink(token?.actor))) return;
    window.setTimeout(refreshHudAfterFamiliarSelection, 100);
    window.setTimeout(refreshHudAfterFamiliarSelection, 220);
  });
  Hooks.once("ready", () => {
    familiarHudObserver ??= new MutationObserver(scheduleFamiliarHudRefresh);
    familiarHudObserver.observe(document.body, { childList: true, subtree: true });
    scheduleFamiliarHudRefresh();
  });
}

async function repairFamiliarArtwork(caster) {
  if (!isResponsibleGM() || !caster) return false;
  const link = familiarLink(caster);
  const src = FAMILIAR_ASSETS[String(link?.key ?? "")];
  if (!link?.actorId || !link?.linkId || !src) return false;
  const familiarActor = game.actors?.get?.(link.actorId) ?? null;
  if (familiarActor) {
    const update = {};
    if (familiarActor.img !== src) update.img = src;
    if (familiarActor.prototypeToken?.texture?.src !== src) update["prototypeToken.texture.src"] = src;
    if (Object.keys(update).length) await familiarActor.update(update, { add2eFamiliarArtworkRepair: true, add2eInternal: true });
  }
  for (const scene of game.scenes?.contents ?? []) {
    const updates = Array.from(scene.tokens ?? []).filter(token => (token.actorId === link.actorId || token.flags?.add2e?.familiar?.linkId === link.linkId) && token.texture?.src !== src).map(token => ({ _id: token.id, "texture.src": src }));
    if (updates.length) await scene.updateEmbeddedDocuments("Token", updates, { add2eFamiliarArtworkRepair: true, render: true });
  }
  const effects = familiarEffects(caster, link.linkId).filter(effect => effect.img !== src).map(effect => effect.update({ img: src }, { add2eFamiliarArtworkRepair: true, add2eInternal: true }));
  if (effects.length) await Promise.all(effects);
  return true;
}

function queueFamiliarArtwork(caster) {
  if (!isResponsibleGM() || !caster?.id || familiarArtworkQueue.has(caster.id)) return;
  familiarArtworkQueue.add(caster.id);
  setTimeout(() => {
    familiarArtworkQueue.delete(caster.id);
    repairFamiliarArtwork(caster).catch(error => console.error(`${TAG}[FAMILIAR_ARTWORK]`, error));
  }, 50);
}

function familiarInternalActorUpdate(options = {}) {
  return options?.add2eFamiliarHpShare === true || options?.add2eFamiliarRelation === true || options?.add2eFamiliarDissolve === true || options?.add2eFamiliarDeathPenalty === true || options?.add2eFamiliarRegeneration === true;
}

function installFamiliarController() {
  Hooks.on("deleteActiveEffect", (effect, options = {}) => {
    if (!isResponsibleGM() || options?.add2eFamiliarDissolve) return;
    const data = familiarEffectData(effect);
    if (!data?.linkId) return;
    const caster = effect?.parent?.documentName === "Actor" ? effect.parent : game.actors?.get?.(data.masterActorId) ?? null;
    if (caster && familiarLink(caster)?.linkId === data.linkId) dissolveFamiliar(caster).catch(error => console.error(`${TAG}[FAMILIAR_DISSOLVE]`, error));
  });
  if (nativeMoveAvailable()) {
    Hooks.on("moveToken", (token, movement = {}, operation = {}) => handleNativeMove(token, movement, operation).catch(error => console.error(`${TAG}[FAMILIAR_MOVE]`, error)));
  } else {
    Hooks.on("updateToken", (token, changes = {}, operation = {}) => handleLegacyMove(token, changes, operation).catch(error => console.error(`${TAG}[FAMILIAR_UPDATE]`, error)));
  }
  Hooks.on("updateActor", (actor, _changes = {}, options = {}) => {
    scheduleFamiliarHudRefresh();
    if (familiarInternalActorUpdate(options)) return;
    const caster = familiarCasterForFamiliarActor(actor);
    if (caster) queueFamiliarSync(caster, { notify: true });
    if (validFamiliarLink(familiarLink(actor))) queueFamiliarSync(actor, { notify: true });
  });
  Hooks.on("updateCombat", (combat, changes = {}) => regenerateOnRound(combat, changes).catch(error => console.error(`${TAG}[FAMILIAR_REGEN]`, error)));
  Hooks.on("createActiveEffect", effect => {
    if (!isResponsibleGM()) return;
    const caster = effect?.parent?.documentName === "Actor" ? effect.parent : null;
    if (caster && familiarEffectData(effect)?.linkId === familiarLink(caster)?.linkId) queueFamiliarArtwork(caster);
  });
  Hooks.on("createToken", token => {
    if (!isResponsibleGM()) return;
    const caster = game.actors?.get?.(token?.flags?.add2e?.familiar?.masterActorId) ?? null;
    if (caster) queueFamiliarArtwork(caster);
  });
  Hooks.on("canvasReady", () => {
    if (isResponsibleGM()) setTimeout(() => {
      for (const caster of game.actors?.contents ?? []) {
        if (validFamiliarLink(familiarLink(caster))) {
          queueFamiliarArtwork(caster);
          queueFamiliarSync(caster, { notify: false });
        }
      }
    }, 100);
    scheduleFamiliarHudRefresh();
  });
}

function registerSocketRelays() {
  if (globalThis.ADD2E_GM_OPERATION_RELAY_VERSION === VERSION) return;
  globalThis.ADD2E_GM_OPERATION_RELAY_VERSION = VERSION;
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
    setFamiliarFollow
  };
  game.socket.on(ADD2E_SOCKET, async data => {
    if (data?.type === ADD2E_ATTACK_PLAYER_LOCAL_CHAT) return createPersistentPlayerAttackChat(data.payload ?? {});
    if (data?.type === ADD2E_ATTACK_GM_DETAIL_CHAT) return;
    if (data?.type === "applyDamageFlag") {
      if (isResponsibleGM()) await applyDamage({ ...data, ...(data.flagData ?? {}) });
      return;
    }
    if (data?.type === "applyActiveEffect") {
      if (game.user?.isGM) await applyLegacyActiveEffect(data);
      return;
    }
    if (!data || data.type !== ADD2E_GM_OPERATION || !isResponsibleGM()) return;
    const handler = routes[data.operation];
    if (!handler) return console.warn(`${TAG}[UNKNOWN_OPERATION]`, data.operation, data.payload ?? {});
    await handler(data.payload ?? {});
  });
}

installFamiliarHelpers();
installFamiliarHudBridge();
Hooks.once("ready", () => {
  registerSocketRelays();
  installFamiliarController();
});

globalThis.add2eCreateFamiliar = createFamiliar;
globalThis.add2eUseFamiliarEffect = useFamiliarEffect;
globalThis.add2eSyncFamiliarArtwork = async () => Promise.all(Array.from(game.actors?.contents ?? []).filter(actor => FAMILIAR_ASSETS[String(familiarLink(actor)?.key ?? "")]).map(actor => repairFamiliarArtwork(actor)));
globalThis.add2eAttackChatRelayDebug = () => ({
  relayVersion: VERSION,
  relayRegistered: globalThis.ADD2E_GM_OPERATION_RELAY_VERSION,
  user: game.user?.name ?? null,
  isGM: game.user?.isGM ?? false,
  nativeMove: nativeMoveAvailable(),
  familiarController: true
});
