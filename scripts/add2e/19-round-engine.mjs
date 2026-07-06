// ============================================================================
// ADD2E — Moteur générique de rounds de combat.
// Version : 2026-07-06-round-engine-vade-player-continuation-v8
// Compatible Foundry V13 / V14 / V15.
// ============================================================================

import {
  add2eVitalIsMonster,
  add2eVitalNorm,
  add2eVitalReadHP
} from "./18a-vital-status-core.mjs";
import {
  add2eSyncActorVitalStatus,
  add2eVitalRegisterStatusEffects
} from "./18b-vital-status-sync.mjs";
import { add2eExpireTemporaryEffectsForActor } from "./18c-active-effects-expiration.mjs";
import {
  ADD2E_TIME_ENGINE_VERSION,
  add2eRegisterTimeEngineApi,
  add2eTimeAdvanceTick,
  add2eTimeNormalizeActorEffects
} from "./19a-time-engine.mjs";

export const ADD2E_ROUND_ENGINE_VERSION = "2026-07-06-round-engine-vade-player-continuation-v8";

const TAG = "[ADD2E][ROUND_ENGINE]";
const FLAG_SCOPE = "add2e";
const FLAG_PROCESSED = "roundEngineProcessed";
const VADE_RETRO_FLAG = "vadeRetro";
const ADD2E_SOCKET = "system.add2e";
const VADE_RETRO_PLAYER_CONTINUATION = "ADD2E_VADE_RETRO_PLAYER_CONTINUATION";
const VADE_RETRO_CONTINUATION_CONTEXTS = "__ADD2E_VADE_RETRO_CONTINUATION_CONTEXTS";
const LOCAL_PROCESSED = new Set();
const LOCAL_VADE_CONTINUATIONS = new Set();
const LOCAL_LIMIT = 200;
let FALLBACK_ACTOR_KEY = 0;

const VADE_TABLE = Object.freeze({
  squelette: ["10", "7", "4", "T", "T", "D", "D", "D*", "D*", "D*"],
  zombie: ["13", "10", "7", "T", "T", "D", "D", "D", "D*", "D*"],
  goule: ["16", "13", "10", "4", "T", "T", "D", "D", "D", "D*"],
  ombre: ["19", "16", "13", "7", "4", "T", "T", "D", "D", "D*"],
  necrophage: ["20", "19", "16", "10", "7", "4", "T", "T", "D", "D"],
  ghast: [null, "20", "19", "13", "10", "7", "4", "T", "T", "D"],
  ame_en_peine: [null, null, "20", "16", "13", "10", "7", "4", "T", "D"],
  momie: [null, null, null, "20", "16", "13", "10", "7", "4", "T"],
  spectre: [null, null, null, null, "20", "16", "13", "10", "7", "T"],
  vampire: [null, null, null, null, null, "20", "16", "13", "10", "4"],
  fantome: [null, null, null, null, null, null, "20", "16", "13", "7"],
  liche: [null, null, null, null, null, null, null, "19", "16", "10"],
  special: [null, null, null, null, null, null, null, "20", "19", "13"]
});

const VADE_LABELS = Object.freeze({
  squelette: "Squelette", zombie: "Zombie", goule: "Goule", ombre: "Ombre", necrophage: "Nécrophage", ghast: "Ghast",
  ame_en_peine: "Âme en peine", momie: "Momie", spectre: "Spectre", vampire: "Vampire", fantome: "Fantôme", liche: "Liche",
  special: "Créature mauvaise des plans inférieurs"
});

function log(label, data = {}) { console.log(`${TAG}${label}`, data); }
function warn(label, data = {}) { console.warn(`${TAG}${label}`, data); }
function error(label, data = {}) { console.error(`${TAG}${label}`, data); }
function esc(value) { return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
function norm(value) { return String(value ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, ""); }
function numberFrom(value, fallback = NaN) {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (value && typeof value === "object") {
    for (const key of ["actuel", "max", "value", "valeur", "current", "base", "total", "vitesse", "movement", "move", "metresTour", "movement_max", "movement_base"]) {
      if (value[key] !== undefined && value[key] !== null && typeof value[key] !== "object") return numberFrom(value[key], fallback);
    }
  }
  const match = String(value ?? "").match(/-?\d+(?:[.,]\d+)?/);
  const parsed = match ? Number(match[0].replace(",", ".")) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}
function toArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (value instanceof Set) return [...value];
  if (typeof value.values === "function") return [...value.values()];
  if (typeof value[Symbol.iterator] === "function" && typeof value !== "string") return [...value];
  return [value];
}
function nowIso() { try { return new Date().toISOString(); } catch (_err) { return String(Date.now()); } }
function isResponsibleGM() {
  if (!game.user?.isGM) return false;
  if (typeof game.user.isActiveGM === "boolean") return game.user.isActiveGM;
  return game.users?.activeGM?.id === game.user.id || !game.users?.activeGM;
}
function chatStyleData() {
  const styles = globalThis.CONST?.CHAT_MESSAGE_STYLES;
  return styles?.OTHER !== undefined ? { style: styles.OTHER } : { type: globalThis.CONST?.CHAT_MESSAGE_TYPES?.OTHER ?? 0 };
}
function combatId(combat) { return combat?.uuid ?? combat?.id ?? "combat"; }
function roundNumber(combat, fallback = 0) { const n = Number(combat?.round ?? fallback ?? 0); return Number.isFinite(n) ? n : 0; }
function roundKey(combat, round) { return `${combatId(combat)}::round::${round}`; }
function rememberLocalKey(key) {
  LOCAL_PROCESSED.add(key);
  if (LOCAL_PROCESSED.size <= LOCAL_LIMIT) return;
  const first = LOCAL_PROCESSED.values().next().value;
  if (first) LOCAL_PROCESSED.delete(first);
}

async function wasRoundAlreadyProcessed(combat, round, source) {
  const key = roundKey(combat, round);
  if (LOCAL_PROCESSED.has(key)) return true;
  try {
    const data = combat?.getFlag?.(FLAG_SCOPE, FLAG_PROCESSED) ?? null;
    if (data?.round === round && data?.combatId === combatId(combat)) {
      rememberLocalKey(key);
      return true;
    }
  } catch (_err) {}
  try {
    await combat?.setFlag?.(FLAG_SCOPE, FLAG_PROCESSED, {
      version: ADD2E_ROUND_ENGINE_VERSION,
      timeEngineVersion: ADD2E_TIME_ENGINE_VERSION,
      combatId: combatId(combat), round, source, processedAt: nowIso()
    });
  } catch (err) { warn("[FLAG_WRITE_FAILED]", { combat: combat?.id, round, source, err }); }
  rememberLocalKey(key);
  return false;
}

function combatantActor(combatant) { return combatant?.actor ?? combatant?.token?.actor ?? combatant?.token?.document?.actor ?? null; }
function actorKey(actor) { if (actor?.uuid) return actor.uuid; if (actor?.id) return actor.id; if (actor?.name) return actor.name; FALLBACK_ACTOR_KEY += 1; return `actor-${FALLBACK_ACTOR_KEY}`; }
function uniqueCombatActors(combat) {
  const out = [];
  const seen = new Set();
  for (const combatant of toArray(combat?.combatants)) {
    const actor = combatantActor(combatant);
    if (!actor) continue;
    const key = actorKey(actor);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ actor, combatant });
  }
  return out;
}
function isCharacterActor(actor) { return add2eVitalNorm(actor?.type) === "personnage" && !add2eVitalIsMonster(actor); }
function hpUpdatePath(actor) {
  const sys = actor?.system ?? {};
  if (sys.pdv !== undefined) return "system.pdv";
  if (sys.pv?.value !== undefined) return "system.pv.value";
  if (sys.hp?.value !== undefined) return "system.hp.value";
  if (sys.hp !== undefined && typeof sys.hp !== "object") return "system.hp";
  if (sys.points_de_coup !== undefined) return "system.points_de_coup";
  return "system.pdv";
}
function actorHp(actor) {
  const sys = actor?.system ?? {};
  for (const value of [sys.pdv, sys.pv?.value, sys.hp?.value, sys.hp, sys.points_de_coup, sys.attributes?.hp?.value]) {
    const hp = numberFrom(value, NaN);
    if (Number.isFinite(hp)) return hp;
  }
  return NaN;
}
function actorIsDefeated(actor) {
  const hp = actorHp(actor);
  if (Number.isFinite(hp) && hp <= 0) return true;
  return Array.from(actor?.effects ?? []).some(effect => !effect?.disabled && toArray(effect?.statuses ?? effect?.getFlag?.("core", "statusId") ?? []).map(norm).some(status => ["dead", "mort", "defeated", "vaincu"].includes(status)));
}

async function applyNegativeHpRoundLoss(actor, currentRound, combat) {
  if (!isCharacterActor(actor)) return { applied: false, reason: "not-character" };
  const hp = add2eVitalReadHP(actor);
  if (!Number.isFinite(hp)) return { applied: false, reason: "hp-invalid" };
  if (!(hp < 0 && hp > -11)) return { applied: false, reason: "hp-out-of-range", hp };
  const nextHp = hp - 1;
  const path = hpUpdatePath(actor);
  await actor.update({ [path]: nextHp }, { add2eRoundEngine: true, add2eRoundEngineReason: "negative-hp-round-loss", add2eCombatId: combat?.id ?? null, add2eCombatRound: currentRound });
  log("[NEGATIVE_HP_LOSS]", { actor: actor.name, actorId: actor.id, combat: combat?.id ?? null, round: currentRound, path, before: hp, after: nextHp });
  return { applied: true, hp, nextHp, path };
}

function effectTags(effect) {
  const value = effect?.flags?.add2e?.tags ?? [];
  const raw = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[,;|\n]+/) : [];
  return new Set(raw.map(norm).filter(Boolean));
}
function combatScene(combat) { return combat?.scene ?? game.scenes?.get?.(combat?.scene?.id) ?? game.scenes?.get?.(combat?.sceneId) ?? canvas?.scene ?? null; }
function combatantToken(combatant, combat) {
  const token = combatant?.token?.document ?? combatant?.token ?? null;
  if (token?.documentName === "Token") return token;
  return combatScene(combat)?.tokens?.get?.(combatant?.tokenId) ?? null;
}
function tokenById(combat, tokenId) {
  return combatScene(combat)?.tokens?.get?.(tokenId)
    ?? canvas?.tokens?.get?.(tokenId)?.document
    ?? canvas?.tokens?.placeables?.find?.(token => token?.id === tokenId || token?.document?.id === tokenId)?.document
    ?? null;
}
function actorToken(actor, combat = null) {
  if (!actor) return null;
  const combatant = toArray(combat?.combatants).find(entry => entry?.actor?.id === actor.id);
  return combatantToken(combatant, combat) ?? Array.from(combatScene(combat)?.tokens ?? []).find(token => token?.actor?.id === actor.id || token?.actorId === actor.id) ?? null;
}
function tokenDocument(token) {
  if (!token) return null;
  if (token.documentName === "Token") return token;
  if (token.document?.documentName === "Token") return token.document;
  return null;
}
function tokenCenter(token) {
  const document = tokenDocument(token) ?? token;
  if (!document) return null;
  const gridSize = Number(document.parent?.grid?.size ?? canvas?.grid?.size ?? 100) || 100;
  return { x: Number(document.x ?? 0) + Number(document.width ?? 1) * gridSize / 2, y: Number(document.y ?? 0) + Number(document.height ?? 1) * gridSize / 2 };
}
function unitToMeters(distance, unit) {
  const normalized = String(unit ?? "").trim().toLowerCase();
  if (["ft", "feet", "foot", "pied", "pieds", "pi"].includes(normalized)) return Number(distance) * .3048;
  if (["km", "kilometre", "kilomètre", "kilometres", "kilomètres"].includes(normalized)) return Number(distance) * 1000;
  return Number(distance);
}
function readMovementMeters(actor, scene, { allowGridFallback = false } = {}) {
  const sys = actor?.system ?? {};
  const candidates = [
    ["system.mouvement.actuel", sys.mouvement?.actuel],
    ["system.mouvement.max", sys.mouvement?.max],
    ["system.mouvement.metresTour", sys.mouvement?.metresTour],
    ["system.mouvement.vitesse", sys.mouvement?.vitesse],
    ["system.mouvement.base", sys.mouvement?.base],
    ["system.mouvement.modes.marche.value", sys.mouvement?.modes?.marche?.value],
    ["system.movement_max", sys.movement_max],
    ["system.movement_base", sys.movement_base],
    ["system.movement_modes.vol.value", sys.movement_modes?.vol?.value],
    ["system.movement_modes.nage.value", sys.movement_modes?.nage?.value],
    ["system.movement_modes.creuser.value", sys.movement_modes?.creuser?.value],
    ["system.movement_modes.marche.value", sys.movement_modes?.marche?.value],
    ["system.movement.value", sys.movement?.value],
    ["system.movement", sys.movement],
    ["system.vitesse_deplacement", sys.vitesse_deplacement],
    ["system.vitesse", sys.vitesse],
    ["system.deplacement", sys.deplacement],
    ["system.déplacement", sys["déplacement"]]
  ];
  for (const [source, raw] of candidates) {
    const value = numberFrom(raw, NaN);
    if (Number.isFinite(value)) return { ok: true, source, value, raw };
  }
  if (allowGridFallback) {
    const gridDistance = Number(scene?.grid?.distance ?? canvas?.scene?.grid?.distance ?? 1) || 1;
    const gridUnits = scene?.grid?.units ?? canvas?.scene?.grid?.units ?? "m";
    return { ok: true, source: "scene-grid-distance", value: unitToMeters(gridDistance, gridUnits), raw: gridDistance };
  }
  return { ok: false, source: null, value: NaN, raw: null };
}
function fleeDestination(sourceToken, targetToken, maxMeters) {
  const sourceDoc = tokenDocument(sourceToken) ?? sourceToken;
  const targetDoc = tokenDocument(targetToken) ?? targetToken;
  const scene = targetDoc?.parent ?? canvas?.scene;
  const grid = Number(scene?.grid?.size ?? canvas?.grid?.size ?? 100) || 100;
  const gridDistance = Number(scene?.grid?.distance ?? canvas?.scene?.grid?.distance ?? 1) || 1;
  const gridUnits = scene?.grid?.units ?? canvas?.scene?.grid?.units ?? "m";
  const metersPerGrid = Math.max(.01, unitToMeters(gridDistance, gridUnits));
  const maxPixels = Math.max(0, Number(maxMeters) || 0) / metersPerGrid * grid;
  const sourceCenter = tokenCenter(sourceDoc);
  const targetCenter = tokenCenter(targetDoc);
  if (!sourceCenter || !targetCenter) return null;
  let dx = targetCenter.x - sourceCenter.x;
  let dy = targetCenter.y - sourceCenter.y;
  let length = Math.hypot(dx, dy);
  if (!Number.isFinite(length) || length < 1) { dx = 1; dy = 0; length = 1; }
  const width = Number(targetDoc.width ?? 1) * grid;
  const height = Number(targetDoc.height ?? 1) * grid;
  let x = targetCenter.x + dx / length * maxPixels - width / 2;
  let y = targetCenter.y + dy / length * maxPixels - height / 2;
  x = Math.round(x / grid) * grid;
  y = Math.round(y / grid) * grid;
  const sceneWidth = Number(scene?.dimensions?.sceneWidth ?? scene?.width ?? canvas?.dimensions?.width ?? x);
  const sceneHeight = Number(scene?.dimensions?.sceneHeight ?? scene?.height ?? canvas?.dimensions?.height ?? y);
  const maxX = Math.max(0, sceneWidth - width);
  const maxY = Math.max(0, sceneHeight - height);
  x = Math.max(0, Math.min(maxX, x));
  y = Math.max(0, Math.min(maxY, y));
  const movedMeters = unitToMeters((Math.hypot(x - Number(targetDoc.x ?? 0), y - Number(targetDoc.y ?? 0)) / grid) * gridDistance, gridUnits);
  return { x, y, maxMeters: Math.round(Number(maxMeters) * 100) / 100, movedMeters: Math.round(movedMeters * 100) / 100, from: { x: Number(targetDoc.x ?? 0), y: Number(targetDoc.y ?? 0) } };
}

export async function add2eForceFleeToken({
  sourceToken = null,
  targetToken = null,
  actor = null,
  reason = "forced-flee",
  flagKey = "forcedFlee",
  allowGridFallback = false,
  currentRound = null
} = {}) {
  const sourceDoc = tokenDocument(sourceToken);
  const targetDoc = tokenDocument(targetToken);
  const targetActor = actor ?? targetDoc?.actor ?? null;
  const scene = targetDoc?.parent ?? canvas?.scene;
  if (!sourceDoc || !targetDoc || !targetActor || !scene) return { moved: false, requested: false, fatal: true, reason: "Token source ou cible introuvable.", maxMeters: 0, movedMeters: 0 };
  const move = readMovementMeters(targetActor, scene, { allowGridFallback });
  if (!move.ok) return { moved: false, requested: false, fatal: true, reason: "Mouvement absent ou invalide dans le JSON de la cible.", maxMeters: 0, movedMeters: 0 };
  if (move.value <= 0) return { moved: false, requested: false, fatal: false, reason: "La cible a un mouvement de 0 : aucune fuite possible.", maxMeters: 0, movedMeters: 0 };
  const destination = fleeDestination(sourceDoc, targetDoc, move.value);
  if (!destination || !Number.isFinite(destination.x) || !Number.isFinite(destination.y)) return { moved: false, requested: false, fatal: true, reason: "Destination de fuite invalide.", maxMeters: move.value, movedMeters: 0 };
  if (Math.abs(destination.x - Number(targetDoc.x ?? 0)) < 1 && Math.abs(destination.y - Number(targetDoc.y ?? 0)) < 1) return { moved: false, requested: false, fatal: false, reason: "La cible ne peut pas être éloignée davantage dans cette direction.", ...destination };
  const flagData = {
    sourceTokenId: sourceDoc.id ?? null,
    sourceTokenName: sourceDoc.name ?? null,
    movedAt: Date.now(),
    movementSource: move.source,
    maxMeters: destination.maxMeters,
    movedMeters: destination.movedMeters,
    from: destination.from,
    to: { x: destination.x, y: destination.y },
    reason,
    combatRound: currentRound
  };
  const updateData = {
    x: destination.x,
    y: destination.y,
    flags: { add2e: { [flagKey]: flagData, forcedFlee: flagData, lastAllowedPosition: { x: destination.x, y: destination.y } } }
  };
  const options = { add2eIgnoreMovement: true, add2eForcedMovement: true, add2eForcedFlee: true, add2eRoundEngine: true, add2eRoundEngineReason: reason, showRuler: false };
  try {
    if (game.user?.isGM) {
      await targetDoc.update(updateData, options);
      return { moved: true, requested: false, fatal: false, reason: "Déplacement appliqué.", ...destination, movementSource: move.source, tokenId: targetDoc.id };
    }
    if (!game.socket || !scene.id || !targetDoc.id) return { moved: false, requested: false, fatal: true, reason: "Socket indisponible pour le relais MJ.", ...destination };
    game.socket.emit(ADD2E_SOCKET, { type: "ADD2E_GM_OPERATION", operation: "updateToken", payload: { sceneId: scene.id, tokenId: targetDoc.id, updateData, options, fromUserId: game.user?.id, sentAt: Date.now() } });
    return { moved: false, requested: true, fatal: false, reason: "Déplacement demandé au MJ.", ...destination, movementSource: move.source, tokenId: targetDoc.id };
  } catch (err) {
    error("[FORCED_FLEE_ERROR]", { reason, target: targetActor.name, targetTokenId: targetDoc.id, err });
    return { moved: false, requested: false, fatal: true, reason: err?.message || "Erreur pendant la mise à jour du token.", ...destination, movementSource: move.source, tokenId: targetDoc.id };
  }
}

async function fleeingSource(effect) {
  const flags = effect?.flags?.add2e ?? {};
  const sourceUuid = flags.vadeRetro?.casterUuid ?? flags.casterUuid ?? effect?.origin ?? null;
  if (!sourceUuid || typeof fromUuid !== "function") return null;
  try {
    const document = await fromUuid(sourceUuid);
    return document?.actor ?? document?.parent ?? document ?? null;
  } catch (_err) { return null; }
}

async function processForcedFlee(actor, combatant, currentRound, combat, { perRound = false } = {}) {
  if (!perRound || actorIsDefeated(actor)) return { moved: false, reason: "not-applicable" };
  const effect = Array.from(actor.effects ?? []).find(entry => {
    if (entry?.disabled) return false;
    const tags = effectTags(entry);
    return tags.has("fuite") || tags.has("mouvement_eloignement_obligatoire") || tags.has("etat_peur") || tags.has("peur");
  });
  if (!effect) return { moved: false, reason: "no-flee-effect" };
  const targetToken = combatantToken(combatant, combat) ?? actorToken(actor, combat);
  const sourceActor = await fleeingSource(effect);
  const sourceToken = actorToken(sourceActor, combat);
  if (!targetToken || !sourceActor || !sourceToken) return { moved: false, reason: "missing-token-or-source" };
  const result = await add2eForceFleeToken({
    sourceToken,
    targetToken,
    actor,
    reason: "round-engine-forced-flee",
    flagKey: "roundEngineForcedMove",
    allowGridFallback: true,
    currentRound
  });
  return { ...result, round: currentRound, source: sourceActor.name, tokenId: targetToken.id };
}

function vadeState(actor, combat) {
  const all = actor?.getFlag?.(FLAG_SCOPE, VADE_RETRO_FLAG) ?? actor?.flags?.[FLAG_SCOPE]?.[VADE_RETRO_FLAG] ?? {};
  return all?.[combat?.id] ?? null;
}
async function saveVadeState(actor, combat, state) {
  const all = actor?.getFlag?.(FLAG_SCOPE, VADE_RETRO_FLAG) ?? actor?.flags?.[FLAG_SCOPE]?.[VADE_RETRO_FLAG] ?? {};
  await actor.setFlag(FLAG_SCOPE, VADE_RETRO_FLAG, { ...all, [combat.id]: state });
}
function vadeEntry(category, effectiveLevel) {
  const level = Math.max(1, Math.floor(numberFrom(effectiveLevel, 1)));
  const column = level <= 8 ? level - 1 : level <= 13 ? 8 : 9;
  return VADE_TABLE[category]?.[column] ?? null;
}
async function vadeRoll(formula) { const result = await new Roll(formula).evaluate({ async: true }); try { await game.dice3d?.showForRoll?.(result); } catch (_err) {} return result; }
function vadeGroupTokens(combat, group) {
  const seen = new Set();
  return (Array.isArray(group?.ids) ? group.ids : []).map(id => tokenById(combat, id)).filter(token => token?.actor && !actorIsDefeated(token.actor) && !seen.has(token.id) && seen.add(token.id));
}
function vadeQueue(combat, pending) { return (Array.isArray(pending) ? pending : []).map(group => ({ ...group, ids: vadeGroupTokens(combat, group).map(token => token.id) })).filter(group => group.ids.length); }
function vadeDuration(rounds) {
  const time = game.add2e?.time ?? globalThis.ADD2E_TIME_ENGINE ?? null;
  const endMessage = "L’effet de Vade-rétro sur {actor} prend fin.";
  return {
    duration: time?.durationData?.(rounds) ?? { rounds, startRound: game.combat?.round ?? null, startTurn: game.combat?.turn ?? null, startTime: game.time?.worldTime ?? null, combat: game.combat?.id ?? null },
    flags: time?.flags?.({ source: "vade-retro.js", rounds, unit: "round", endMessage }) ?? { timeEngine: { managed: true, unit: "round", totalRounds: rounds }, roundEngine: { managed: true, unit: "round", totalRounds: rounds, endMessage }, endMessage }
  };
}
function vadeIsEvil(actor) { const alignment = norm(actor?.system?.alignement ?? actor?.system?.alignment ?? ""); return alignment.includes("mauvais") || alignment.includes("evil"); }
async function postVadeClassCard(actor, { title = "Vade-rétro", lead = "", details = [], rows = [], footer = "" } = {}) {
  const actorName = esc(actor?.name ?? "Clerc");
  const img = esc(actor?.getActiveTokens?.()[0]?.document?.texture?.src ?? actor?.img ?? "icons/magic/holy/barrier-shield-winged-cross.webp");
  const detailsHtml = details.filter(Boolean).map(detail => `<p style="margin:.35em 0;">${detail}</p>`).join("");
  const rowsHtml = rows.length ? `<ul style="margin:.45em 0 0;padding-left:1.2em;">${rows.map(row => `<li><b>${esc(row.name ?? row.target)}</b> : ${esc(row.result)}</li>`).join("")}</ul>` : "";
  const content = `<div class="add2e-chat-card add2e-class-ability add2e-vade-retro-card" style="border:1px solid #a77b28;border-radius:8px;overflow:hidden;background:#fff8e7;color:#2f210d;font-family:var(--font-primary);font-size:13px;line-height:1.35;"><div style="display:flex;align-items:center;gap:8px;background:#6f4a10;color:#fff;padding:7px 9px;"><img src="${img}" style="width:34px;height:34px;object-fit:cover;border-radius:4px;border:1px solid #f4d487;background:#fff;" /><div style="flex:1;min-width:0;"><div style="font-weight:900;font-size:14px;line-height:1.1;">${esc(title)}</div><div style="font-size:11px;opacity:.9;line-height:1.15;">Capacité de classe — ${actorName}</div></div></div><div style="padding:8px 10px;background:#fff8e7;"><div style="background:#fff;border:1px solid #d6b66e;border-radius:6px;padding:7px 8px;">${lead ? `<div>${lead}</div>` : ""}${detailsHtml}${rowsHtml}${footer ? `<p style="margin:.55em 0 0;font-size:12px;color:#6b4a1a;">${footer}</p>` : ""}</div></div></div>`;
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content, ...chatStyleData() });
}

function vadeInitiatingPlayer(state) {
  const id = String(state?.initiatorUserId ?? "").trim();
  const user = id ? game.users?.get?.(id) ?? null : null;
  return user?.active && !user.isGM ? user : null;
}

function vadeContinuationKey(payload = {}) {
  return [payload?.requestId, payload?.actorUuid ?? payload?.actorId, payload?.combatId, payload?.round].filter(value => value !== null && value !== undefined && value !== "").join("|");
}

function vadeFeatureKey(feature) {
  return norm(feature?.id ?? feature?._id ?? feature?.key ?? feature?.slug ?? feature?.name ?? feature?.label ?? "");
}

function vadeFeatureOnUse(feature) {
  return String(feature?.on_use ?? feature?.onUse ?? feature?.script ?? feature?.macro ?? "").trim();
}

function vadeContinuationFeature(actor, state) {
  const features = globalThis.add2eGetActorActivableClassFeatures?.(actor, { includeLocked: false }) ?? [];
  const expectedKey = norm(state?.featureKey ?? "");
  const expectedOnUse = String(state?.featureOnUse ?? "").trim();
  return features.find(feature => {
    const onUse = vadeFeatureOnUse(feature);
    if (!/vade-retro\.js(?:$|[?#])/i.test(onUse)) return false;
    if (expectedOnUse && onUse !== expectedOnUse) return false;
    return !expectedKey || vadeFeatureKey(feature) === expectedKey;
  }) ?? null;
}

async function actorFromVadeContinuationPayload(payload = {}) {
  if (payload.actorUuid && typeof fromUuid === "function") {
    try {
      const document = await fromUuid(payload.actorUuid);
      const actor = document?.actor ?? document?.parent ?? document ?? null;
      if (actor?.documentName === "Actor") return actor;
    } catch (_err) {}
  }
  return payload.actorId ? game.actors?.get?.(payload.actorId) ?? null : null;
}

async function runPlayerVadeRetroContinuation(payload = {}) {
  const targetUserId = String(payload?.targetUserId ?? "").trim();
  if (!targetUserId || targetUserId !== game.user?.id || game.user?.isGM) return false;
  const requestKey = vadeContinuationKey(payload);
  const requestId = String(payload?.requestId ?? "").trim() || requestKey;
  if (!requestKey || LOCAL_VADE_CONTINUATIONS.has(requestKey)) return false;
  const actor = await actorFromVadeContinuationPayload(payload);
  const combat = game.combat;
  if (!actor || !combat || String(combat.id) !== String(payload.combatId) || Number(combat.round) !== Number(payload.round) || actor.isOwner === false) return false;
  const state = vadeState(actor, combat);
  if (!state || state.status !== "pending" || String(state.initiatorUserId ?? "") !== targetUserId || Number(state.lastRound ?? Number(combat.round)) >= Number(combat.round)) return false;
  const feature = vadeContinuationFeature(actor, state);
  const execute = globalThis.add2eExecuteClassFeatureOnUse;
  if (!feature || typeof execute !== "function") {
    warn("[VADE_RETRO_PLAYER_CONTINUATION_UNAVAILABLE]", { actor: actor.name, combat: combat.id, feature: !!feature, execute: typeof execute });
    return false;
  }
  globalThis[VADE_RETRO_CONTINUATION_CONTEXTS] ??= new Map();
  const contexts = globalThis[VADE_RETRO_CONTINUATION_CONTEXTS];
  const contextKey = `${actor.id}:${combat.id}`;
  LOCAL_VADE_CONTINUATIONS.add(requestKey);
  contexts.set(contextKey, {
    kind: "vade-retro-continuation",
    requestId,
    actorId: actor.id,
    actorUuid: actor.uuid ?? null,
    combatId: combat.id,
    round: Number(combat.round),
    initiatorUserId: targetUserId
  });
  try {
    return (await execute(actor, feature, null)) !== false;
  } catch (err) {
    error("[VADE_RETRO_PLAYER_CONTINUATION_ERROR]", { actor: actor.name, combat: combat.id, round: combat.round, err });
    return false;
  } finally {
    contexts.delete(contextKey);
    setTimeout(() => LOCAL_VADE_CONTINUATIONS.delete(requestKey), 1000);
  }
}

function requestPlayerVadeRetroContinuation(actor, combat, currentRound, state) {
  const user = vadeInitiatingPlayer(state);
  if (!user || !game.socket || !actor?.id || !combat?.id) return false;
  const requestId = `${combat.id}:${currentRound}:${actor.uuid ?? actor.id}:${Date.now()}`;
  game.socket.emit(ADD2E_SOCKET, {
    type: VADE_RETRO_PLAYER_CONTINUATION,
    payload: {
      requestId,
      targetUserId: user.id,
      actorId: actor.id,
      actorUuid: actor.uuid ?? null,
      combatId: combat.id,
      round: currentRound
    }
  });
  log("[VADE_RETRO_DELEGATED_TO_PLAYER]", { actor: actor.name, combat: combat.id, round: currentRound, userId: user.id });
  return true;
}

async function continueVadeRetro(actor, combat, currentRound) {
  const state = vadeState(actor, combat);
  if (!state || state.status !== "pending" || Number(state.lastRound ?? currentRound) >= currentRound) return false;
  const queue = vadeQueue(combat, state.pending);
  if (!queue.length) {
    await saveVadeState(actor, combat, { ...state, status: "complete", pending: [], lastRound: currentRound, completedAt: Date.now() });
    return true;
  }
  const group = queue[0];
  const entry = vadeEntry(group.category, state.effectiveClericLevel);
  const targets = vadeGroupTokens(combat, group);
  if (!entry || !targets.length) {
    await saveVadeState(actor, combat, { ...state, status: targets.length ? "complete" : "pending", pending: targets.length ? [] : queue.slice(1), lastRound: currentRound });
    return true;
  }
  await postVadeClassCard(actor, { lead: `<b>${esc(actor.name)}</b> poursuit son Vade-rétro.`, details: [`<b>Round ${currentRound} :</b> prochaine ligne, ${esc(group.label ?? VADE_LABELS[group.category] ?? group.category)}.`] });
  const automatic = /^[TD]/.test(String(entry));
  const d20 = automatic ? null : await vadeRoll("1d20");
  if (!automatic && Number(d20.total) < Number(entry)) {
    await saveVadeState(actor, combat, { ...state, status: "closed", pending: [], lastRound: currentRound, completedAt: Date.now(), attempted: { category: group.category, entry, roll: d20.total, result: "Échec", targets: targets.map(token => token.id) } });
    await postVadeClassCard(actor, { lead: `<b>${esc(actor.name)}</b> présente son symbole sacré.`, details: [`<b>Échec :</b> ${esc(group.label ?? VADE_LABELS[group.category] ?? group.category)} — d20 = <b>${d20.total}</b>, score requis <b>${esc(entry)}</b>.`], footer: "La poursuite cesse." });
    return true;
  }
  const countFormula = group.lowerPlane ? "1d2" : String(entry).endsWith("*") ? "1d6+6" : "1d12";
  const count = Math.max(1, Number((await vadeRoll(countFormula)).total) || 1);
  const affected = targets.slice(0, count);
  const remainder = targets.slice(count).map(token => token.id);
  const pending = [...(remainder.length ? [{ ...group, ids: remainder }] : []), ...queue.slice(1)];
  const evil = vadeIsEvil(actor);
  const destroy = String(entry).startsWith("D") && !evil;
  const dominate = String(entry).startsWith("D") && evil;
  let outcome = "", duration = {}, durationLabel = "", tags = [], timeFlags = {};
  if (destroy) {
    outcome = "Détruit / damné";
    tags = ["vade_retro", "etat:detruit_vade_retro", `vade_retro:${group.category}`];
  } else if (dominate) {
    outcome = "Dominé";
    duration = { startTime: game.time?.worldTime ?? null, seconds: 518400 };
    durationLabel = "6 jours (renouvellement requis)";
    tags = ["vade_retro", "etat:domine_vade_retro", "controle:clerc", `vade_retro:${group.category}`];
  } else if (evil) {
    const reaction = await vadeRoll("1d100");
    const adjustment = Number(actor.system?.cha_react ?? 0) || 0;
    const attitude = Number(reaction.total) + adjustment >= 56 ? "Amical" : "Neutre";
    const hours = String(entry).startsWith("T") ? 24 : Math.max(1, 24 - Number(entry));
    outcome = `Influencé — ${attitude.toLowerCase()}`;
    duration = { startTime: game.time?.worldTime ?? null, seconds: hours * 3600 };
    durationLabel = `${hours} heure${hours > 1 ? "s" : ""}`;
    tags = ["vade_retro", "etat:influence_vade_retro", "controle:clerc", `attitude:${norm(attitude)}`, `vade_retro:${group.category}`];
  } else {
    const rounds = Math.max(3, Number((await vadeRoll("3d4")).total) || 3);
    const timed = vadeDuration(rounds);
    outcome = "Repoussé";
    duration = timed.duration;
    durationLabel = `${rounds} rounds`;
    timeFlags = timed.flags;
    tags = ["vade_retro", "etat:repousse_vade_retro", "interdiction:attaque", "interdiction:sort", "mouvement:eloignement_obligatoire", "fuite", `vade_retro:${group.category}`];
  }
  const sourceToken = actorToken(actor, combat);
  const rows = [];
  for (const token of affected) {
    const target = token.actor;
    await target.createEmbeddedDocuments("ActiveEffect", [{
      name: destroy ? "Détruit par Vade-rétro" : dominate ? "Dominé par Vade-rétro" : outcome.startsWith("Influencé") ? "Influencé par Vade-rétro" : "Repoussé par Vade-rétro",
      img: "icons/magic/holy/barrier-shield-winged-cross.webp", origin: actor.uuid, disabled: false, transfer: false, duration, changes: [],
      description: `${outcome} par ${actor.name}.${durationLabel ? ` Durée : ${durationLabel}.` : ""}`,
      flags: { add2e: { ...timeFlags, tags, vadeRetro: { casterId: actor.id, casterUuid: actor.uuid, casterName: actor.name, category: group.category, entry, outcome, combatId: combat.id, countFormula, count, classification: group.extrapolated ? "extrapole" : "canonique" } } }
    }]);
    if (destroy) {
      await target.update({ [hpUpdatePath(target)]: 0 }, { add2eRoundEngine: true, add2eRoundEngineReason: "vade-retro-destruction", add2eCombatId: combat.id, add2eCombatRound: currentRound });
      await add2eSyncActorVitalStatus(target, { reason: "vade-retro-destruction" });
    } else if (outcome === "Repoussé" && sourceToken) {
      await add2eForceFleeToken({ sourceToken, targetToken: token, actor: target, reason: "vade-retro-continuation-flee", flagKey: "vadeRetroForcedMove", allowGridFallback: true, currentRound });
    }
    rows.push({ name: token.name ?? target.name, result: outcome });
  }
  const status = pending.length ? "pending" : "complete";
  await saveVadeState(actor, combat, { ...state, status, pending, lastRound: currentRound, updatedAt: Date.now(), attempted: { category: group.category, entry, countFormula, count, result: outcome, targets: affected.map(token => token.id) } });
  await postVadeClassCard(actor, {
    lead: `<b>${esc(actor.name)}</b> poursuit son Vade-rétro.`,
    details: [`<b>${esc(group.label ?? VADE_LABELS[group.category] ?? group.category)} :</b> ${automatic ? "résultat automatique" : `d20 ${d20.total} / ${esc(entry)}`} — <b>${esc(outcome)}</b>.`, `<b>Nombre affecté :</b> ${esc(countFormula)} = <b>${count}</b>.`, durationLabel ? `<b>Durée :</b> ${esc(durationLabel)}.` : ""],
    rows,
    footer: status === "pending" ? "Vade-rétro continuera automatiquement au round suivant." : "La séquence de Vade-rétro est terminée."
  });
  return true;
}

async function continuePendingVadeRetro(combat, currentRound) {
  for (const { actor } of uniqueCombatActors(combat)) {
    try {
      const state = vadeState(actor, combat);
      if (!state || state.status !== "pending" || Number(state.lastRound ?? currentRound) >= currentRound) continue;
      if (requestPlayerVadeRetroContinuation(actor, combat, currentRound, state)) continue;
      await continueVadeRetro(actor, combat, currentRound);
    } catch (err) {
      error("[VADE_RETRO_CONTINUATION_ERROR]", { actor: actor?.name, combat: combat?.id, round: currentRound, err });
    }
  }
}

async function processActorForRound(actor, combatant, currentRound, combat, { perRound = false, source = "unknown" } = {}) {
  const duration = await add2eTimeNormalizeActorEffects(actor, currentRound);
  const expired = await add2eExpireTemporaryEffectsForActor(actor, currentRound);
  const negativeHp = perRound ? await applyNegativeHpRoundLoss(actor, currentRound, combat) : { applied: false, reason: "scan-only" };
  const flee = await processForcedFlee(actor, combatant, currentRound, combat, { perRound });
  const vital = await add2eSyncActorVitalStatus(actor, { reason: `round-engine:${source}` });
  return { actor: actor.name, actorId: actor.id, actorUuid: actor.uuid ?? null, combatantId: combatant?.id ?? null, duration, expired, negativeHp, flee, vital };
}

async function processCombat(combat, { source = "unknown", perRound = false } = {}) {
  if (!combat) return { processed: false, reason: "no-combat" };
  if (!isResponsibleGM()) return { processed: false, reason: "not-responsible-gm" };
  const currentRound = roundNumber(combat);
  if (currentRound <= 0) return { processed: false, reason: "round-zero", round: currentRound };
  add2eRegisterTimeEngineApi();
  add2eVitalRegisterStatusEffects();
  if (perRound) await add2eTimeAdvanceTick(1, { reason: `combat-round:${combat.id}:${currentRound}` });
  const actors = [];
  for (const { actor, combatant } of uniqueCombatActors(combat)) {
    try { actors.push(await processActorForRound(actor, combatant, currentRound, combat, { perRound, source })); }
    catch (err) {
      error("[ACTOR_PROCESS_ERROR]", { actor: actor?.name, actorId: actor?.id, round: currentRound, source, err });
      actors.push({ actor: actor?.name ?? "Acteur", actorId: actor?.id ?? null, error: String(err?.message || err) });
    }
  }
  if (perRound) await continuePendingVadeRetro(combat, currentRound);
  const result = { processed: true, version: ADD2E_ROUND_ENGINE_VERSION, timeEngineVersion: ADD2E_TIME_ENGINE_VERSION, combat: combat.id, round: currentRound, source, perRound, actorCount: actors.length, actors };
  log(perRound ? "[ROUND_PROCESSED]" : "[COMBAT_SCAN]", result);
  return result;
}

export async function add2eRoundEngineOnCombatProgress(combat, changed = {}, { source = "updateCombat", forceRound = false, scanOnly = false } = {}) {
  if (!combat || !isResponsibleGM()) return false;
  const hasRound = forceRound || Object.prototype.hasOwnProperty.call(changed ?? {}, "round");
  const hasTurn = Object.prototype.hasOwnProperty.call(changed ?? {}, "turn");
  if (!hasRound && !hasTurn && !scanOnly) return false;
  const currentRound = roundNumber(combat, changed?.round);
  if (hasRound && !scanOnly) {
    const already = await wasRoundAlreadyProcessed(combat, currentRound, source);
    if (already) {
      log("[ROUND_DUPLICATE_SKIP]", { combat: combat.id, round: currentRound, source });
      return false;
    }
    await processCombat(combat, { source, perRound: true });
    return true;
  }
  await processCombat(combat, { source, perRound: false });
  return true;
}

function registerVadeRetroPlayerContinuationSocket() {
  if (globalThis.__ADD2E_VADE_RETRO_PLAYER_CONTINUATION_SOCKET_REGISTERED) return;
  globalThis.__ADD2E_VADE_RETRO_PLAYER_CONTINUATION_SOCKET_REGISTERED = true;
  game.socket.on(ADD2E_SOCKET, data => {
    if (data?.type !== VADE_RETRO_PLAYER_CONTINUATION) return;
    runPlayerVadeRetroContinuation(data.payload ?? {})
      .catch(err => error("[VADE_RETRO_PLAYER_SOCKET_ERROR]", { err, payload: data?.payload ?? {} }));
  });
}

export function add2eRegisterRoundEngineHooks() {
  if (globalThis.__ADD2E_ROUND_ENGINE_REGISTERED) return false;
  globalThis.__ADD2E_ROUND_ENGINE_REGISTERED = true;
  add2eRegisterTimeEngineApi();
  registerVadeRetroPlayerContinuationSocket();
  Hooks.on("combatRound", (combat, round, options, userId) => {
    add2eRoundEngineOnCombatProgress(combat, { round: round ?? combat?.round }, { source: "combatRound", forceRound: true })
      .catch(err => error("[HOOK_COMBAT_ROUND_ERROR]", { err, combat: combat?.id, round, options, userId }));
  });
  Hooks.on("combatTurnChange", (combat, prior, current, options, userId) => {
    add2eRoundEngineOnCombatProgress(combat, { turn: combat?.turn }, { source: "combatTurnChange", scanOnly: true })
      .catch(err => error("[HOOK_COMBAT_TURN_CHANGE_ERROR]", { err, combat: combat?.id, prior, current, options, userId }));
  });
  Hooks.on("combatTurn", (combat, turn, options, userId) => {
    add2eRoundEngineOnCombatProgress(combat, { turn: turn ?? combat?.turn }, { source: "combatTurn", scanOnly: true })
      .catch(err => error("[HOOK_COMBAT_TURN_ERROR]", { err, combat: combat?.id, turn, options, userId }));
  });
  Hooks.on("updateCombat", (combat, changed, options, userId) => {
    add2eRoundEngineOnCombatProgress(combat, changed ?? {}, { source: "updateCombat" })
      .catch(err => error("[HOOK_UPDATE_COMBAT_ERROR]", { err, combat: combat?.id, changed, options, userId }));
  });
  game.add2e = game.add2e ?? {};
  game.add2e.roundEngineVersion = ADD2E_ROUND_ENGINE_VERSION;
  game.add2e.postVadeRetroCard = postVadeClassCard;
  game.add2e.forceFleeToken = add2eForceFleeToken;
  globalThis.ADD2E_ROUND_ENGINE_VERSION = ADD2E_ROUND_ENGINE_VERSION;
  globalThis.add2eRoundEngineOnCombatProgress = add2eRoundEngineOnCombatProgress;
  globalThis.add2ePostVadeRetroCard = postVadeClassCard;
  globalThis.add2eForceFleeToken = add2eForceFleeToken;
  log("[REGISTERED]", { version: ADD2E_ROUND_ENGINE_VERSION, timeEngineVersion: ADD2E_TIME_ENGINE_VERSION, hooks: ["combatRound", "combatTurnChange", "combatTurn", "updateCombat"], mode: "combat-tracker+world-time" });
  return true;
}
