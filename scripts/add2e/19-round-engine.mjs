// ============================================================================
// ADD2E — Moteur générique de rounds de combat.
// Version : 2026-07-06-round-engine-vade-retro-flee-v4
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

export const ADD2E_ROUND_ENGINE_VERSION = "2026-07-06-round-engine-vade-retro-flee-v4";

const TAG = "[ADD2E][ROUND_ENGINE]";
const FLAG_SCOPE = "add2e";
const FLAG_PROCESSED = "roundEngineProcessed";
const VADE_RETRO_FLAG = "vadeRetro";
const LOCAL_PROCESSED = new Set();
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
function numberFrom(value, fallback = NaN) { const m = String(value ?? "").match(/-?\d+(?:[.,]\d+)?/); const n = m ? Number(m[0].replace(",", ".")) : NaN; return Number.isFinite(n) ? n : fallback; }
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
function tokenCenter(token) {
  if (!token) return null;
  const gridSize = Number(token.parent?.grid?.size ?? canvas?.grid?.size ?? 100) || 100;
  return { x: Number(token.x ?? 0) + Number(token.width ?? 1) * gridSize / 2, y: Number(token.y ?? 0) + Number(token.height ?? 1) * gridSize / 2 };
}
function actorMovement(actor, scene) {
  const system = actor?.system ?? {};
  for (const value of [system.mouvement?.actuel, system.mouvement?.max, system.mouvement?.base, system.mouvement?.modes?.marche?.value, system.movement_base, system.movement_max, system.movement_modes?.marche?.value]) {
    const distance = numberFrom(value, NaN);
    if (Number.isFinite(distance) && distance > 0) return distance;
  }
  return Math.max(1, Number(scene?.grid?.distance ?? canvas?.grid?.distance ?? 1) || 1);
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
  const scene = combatScene(combat);
  const targetToken = combatantToken(combatant, combat) ?? actorToken(actor, combat);
  const sourceActor = await fleeingSource(effect);
  const sourceToken = actorToken(sourceActor, combat);
  const target = tokenCenter(targetToken);
  const source = tokenCenter(sourceToken);
  if (!scene || !targetToken || !sourceActor || !target || !source) return { moved: false, reason: "missing-token-or-source" };
  const gridSize = Number(scene.grid?.size ?? canvas?.grid?.size ?? 100) || 100;
  const gridDistance = Math.max(0.001, Number(scene.grid?.distance ?? canvas?.grid?.distance ?? 1) || 1);
  const distance = actorMovement(actor, scene) / gridDistance * gridSize;
  let dx = target.x - source.x;
  let dy = target.y - source.y;
  let length = Math.hypot(dx, dy);
  if (length < 1) { dx = 1; dy = 0; length = 1; }
  const width = Number(targetToken.width ?? 1) * gridSize;
  const height = Number(targetToken.height ?? 1) * gridSize;
  const rawX = target.x + dx / length * distance - width / 2;
  const rawY = target.y + dy / length * distance - height / 2;
  const sceneWidth = Number(scene.dimensions?.sceneWidth ?? scene.width ?? 0);
  const sceneHeight = Number(scene.dimensions?.sceneHeight ?? scene.height ?? 0);
  const x = sceneWidth > 0 ? Math.max(0, Math.min(sceneWidth - width, rawX)) : rawX;
  const y = sceneHeight > 0 ? Math.max(0, Math.min(sceneHeight - height, rawY)) : rawY;
  await targetToken.update({ x, y }, { add2eRoundEngine: true, add2eRoundEngineReason: "forced-flee", add2eForcedFlee: true, add2eIgnoreMovement: true, showRuler: false });
  return { moved: true, round: currentRound, source: sourceActor.name, tokenId: targetToken.id };
}

async function processImmediateFleeEffect(effect) {
  if (!isResponsibleGM()) return false;
  const flags = effect?.flags?.add2e ?? {};
  const tags = effectTags(effect);
  if (!flags.vadeRetro || !(tags.has("fuite") || tags.has("mouvement_eloignement_obligatoire"))) return false;
  // La capacité initiale déplace déjà le token elle-même ; seul le moteur
  // reprend immédiatement les effets créés par la poursuite automatique.
  if (flags.vadeRetro.sourceClass) return false;
  const actor = effect?.parent ?? null;
  if (!actor || actorIsDefeated(actor)) return false;
  const combat = game.combat ?? null;
  const combatant = toArray(combat?.combatants).find(entry => combatantActor(entry)?.id === actor.id) ?? null;
  try {
    const result = await processForcedFlee(actor, combatant, roundNumber(combat), combat, { perRound: true });
    if (result.moved) log("[FORCED_FLEE_IMMEDIATE]", { actor: actor.name, tokenId: result.tokenId, source: result.source });
    return result.moved;
  } catch (err) {
    error("[FORCED_FLEE_IMMEDIATE_ERROR]", { actor: actor.name, err });
    return false;
  }
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
async function postVadeClassCard(actor, { lead = "", details = [], rows = [], footer = "" } = {}) {
  const detailsHtml = details.filter(Boolean).map(detail => `<p>${detail}</p>`).join("");
  const rowsHtml = rows.length ? `<ul>${rows.map(row => `<li><b>${esc(row.name)}</b> : ${esc(row.result)}</li>`).join("")}</ul>` : "";
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<div class="add2e-chat-card"><h3>Vade-rétro</h3>${lead ? `<p>${lead}</p>` : ""}${detailsHtml}${rowsHtml}${footer ? `<p>${footer}</p>` : ""}</div>` });
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
    try { await continueVadeRetro(actor, combat, currentRound); }
    catch (err) { error("[VADE_RETRO_CONTINUATION_ERROR]", { actor: actor?.name, combat: combat?.id, round: currentRound, err }); }
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

export function add2eRegisterRoundEngineHooks() {
  if (globalThis.__ADD2E_ROUND_ENGINE_REGISTERED) return false;
  globalThis.__ADD2E_ROUND_ENGINE_REGISTERED = true;
  add2eRegisterTimeEngineApi();
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
  Hooks.on("createActiveEffect", (effect, options, userId) => {
    Promise.resolve(processImmediateFleeEffect(effect))
      .catch(err => error("[HOOK_CREATE_ACTIVE_EFFECT_FLEE_ERROR]", { effect: effect?.name, effectId: effect?.id, options, userId, err }));
  });
  game.add2e = game.add2e ?? {};
  game.add2e.roundEngineVersion = ADD2E_ROUND_ENGINE_VERSION;
  globalThis.ADD2E_ROUND_ENGINE_VERSION = ADD2E_ROUND_ENGINE_VERSION;
  globalThis.add2eRoundEngineOnCombatProgress = add2eRoundEngineOnCombatProgress;
  log("[REGISTERED]", { version: ADD2E_ROUND_ENGINE_VERSION, timeEngineVersion: ADD2E_TIME_ENGINE_VERSION, hooks: ["combatRound", "combatTurnChange", "combatTurn", "updateCombat", "createActiveEffect"], mode: "combat-tracker+world-time" });
  return true;
}
