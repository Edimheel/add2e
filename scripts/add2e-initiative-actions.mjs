// ADD2E — actions déclarées, situation et surprise pour l'initiative canonique.
// Les données temporaires appartiennent au Combatant, jamais à l'Actor.

import { ADD2E_INITIATIVE_VERSION, TAG } from "./add2e-initiative-constants.mjs";

const ACTION_FLAG = "initiativeAction";
const SITUATION_FLAG = "initiativeSituation";
export const ADD2E_INITIATIVE_ACTION_VERSION = "2026-07-29-initiative-actions-v1";

function clone(value) {
  try { return foundry?.utils?.deepClone ? foundry.utils.deepClone(value) : JSON.parse(JSON.stringify(value)); }
  catch (_error) { return value; }
}

function finiteNumber(...values) {
  for (const value of values) {
    if (value === undefined || value === null || value === "") continue;
    if (typeof value === "object") {
      const nested = finiteNumber(value.value, value.total, value.segments, value.segment, value.amount);
      if (nested !== null) return nested;
      continue;
    }
    const match = String(value).replace(",", ".").match(/-?\d+(?:\.\d+)?/);
    if (!match) continue;
    const number = Number(match[0]);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function combatantActorId(combatant) {
  return String(combatant?.actorId ?? combatant?.actor?.id ?? "");
}

export function initiativeCombatantForActor(actor, combat = game.combat, token = null) {
  if (!actor || !combat?.combatants) return null;
  const combatants = Array.from(combat.combatants ?? []);
  const tokenId = String(token?.id ?? token?.document?.id ?? "");
  if (tokenId) {
    const byToken = combatants.find(combatant => String(combatant?.tokenId ?? combatant?.token?.id ?? "") === tokenId);
    if (byToken) return byToken;
  }
  const current = combat?.combatant ?? null;
  if (current && combatantActorId(current) === String(actor.id ?? "")) return current;
  const controlledIds = new Set((canvas?.tokens?.controlled ?? []).filter(entry => entry?.actor?.id === actor.id).map(entry => String(entry.id)));
  const controlled = combatants.find(combatant => controlledIds.has(String(combatant?.tokenId ?? "")));
  if (controlled) return controlled;
  return combatants.find(combatant => combatantActorId(combatant) === String(actor.id ?? "")) ?? null;
}

function combatantFromSubject(subject, combat = game.combat) {
  if (!subject) return null;
  if (subject.documentName === "Combatant" || subject.combat || subject.parent?.documentName === "Combat") return subject;
  return initiativeCombatantForActor(subject, combat);
}

function actionSegment(kind, item) {
  const system = item?.system ?? {};
  if (kind === "weapon") {
    return finiteNumber(system.facteur_rapidité, system.facteur_rapidite, system.speedFactor, system.weaponSpeed, system.speed);
  }
  if (kind === "spell") {
    return finiteNumber(system.temps_incantation, system.tempsIncantation, system.casting_time, system.castingTime, system.castTime);
  }
  return finiteNumber(system.initiativeSegment, system.segment, system.speedFactor, system.temps_incantation);
}

function actionKind(value) {
  const key = String(value ?? "").trim().toLowerCase();
  if (["weapon", "arme"].includes(key)) return "weapon";
  if (["spell", "sort", "sortilege"].includes(key)) return "spell";
  if (["item", "objet", "power", "pouvoir"].includes(key)) return "item";
  return key || "other";
}

function canManageCombatant(combatant) {
  return game.user?.isGM === true || combatant?.actor?.isOwner === true;
}

export function getDeclaredInitiativeAction(subject, combat = game.combat) {
  const combatant = combatantFromSubject(subject, combat);
  const raw = combatant?.getFlag?.("add2e", ACTION_FLAG) ?? combatant?.flags?.add2e?.[ACTION_FLAG] ?? null;
  if (!raw || typeof raw !== "object") return null;
  return { ...clone(raw), combatantId: combatant?.id ?? raw.combatantId ?? null };
}

export function getInitiativeSituation(subject, combat = game.combat) {
  const combatant = combatantFromSubject(subject, combat);
  const raw = combatant?.getFlag?.("add2e", SITUATION_FLAG) ?? combatant?.flags?.add2e?.[SITUATION_FLAG] ?? null;
  if (!raw || typeof raw !== "object") return { modifier: 0, surpriseSegments: 0, applyDexterityReaction: true };
  return {
    ...clone(raw),
    modifier: finiteNumber(raw.modifier) ?? 0,
    surpriseSegments: Math.max(0, Math.floor(finiteNumber(raw.surpriseSegments, raw.surprise) ?? 0)),
    applyDexterityReaction: raw.applyDexterityReaction !== false
  };
}

export async function declareInitiativeAction(actor, { kind, item, combat = game.combat, combatant = null, token = null } = {}) {
  combatant = combatant ?? initiativeCombatantForActor(actor, combat, token);
  if (!combatant) throw new Error("Aucun Combatant ne correspond à cet acteur pour déclarer l’action d’initiative.");
  if (!canManageCombatant(combatant)) throw new Error("Vous ne pouvez pas déclarer l’action de ce combattant.");
  const normalizedKind = actionKind(kind ?? item?.type);
  const data = {
    version: ADD2E_INITIATIVE_ACTION_VERSION,
    combatantId: combatant.id,
    actorId: combatantActorId(combatant) || actor?.id || null,
    kind: normalizedKind,
    itemId: item?.id ?? null,
    itemUuid: item?.uuid ?? null,
    label: String(item?.name ?? normalizedKind ?? "Action").trim() || "Action",
    segment: actionSegment(normalizedKind, item),
    declaredBy: game.user?.id ?? null,
    declaredAt: Date.now(),
    round: Number(combat?.round ?? 0) || 0
  };
  await combatant.setFlag("add2e", ACTION_FLAG, data);
  Hooks.callAll("add2eInitiativeActionDeclared", combatant, clone(data));
  return data;
}

export async function clearDeclaredInitiativeAction(subject, combat = game.combat) {
  const combatant = combatantFromSubject(subject, combat);
  if (!combatant) return false;
  if (!canManageCombatant(combatant)) throw new Error("Vous ne pouvez pas effacer l’action de ce combattant.");
  await combatant.unsetFlag("add2e", ACTION_FLAG);
  Hooks.callAll("add2eInitiativeActionDeclared", combatant, null);
  return true;
}

export async function setInitiativeSituation(subject, situation = {}, combat = game.combat) {
  const combatant = combatantFromSubject(subject, combat);
  if (!combatant) throw new Error("Combattant introuvable pour la situation d’initiative.");
  if (!canManageCombatant(combatant)) throw new Error("Vous ne pouvez pas modifier la situation de ce combattant.");
  const data = {
    version: ADD2E_INITIATIVE_ACTION_VERSION,
    modifier: finiteNumber(situation.modifier) ?? 0,
    surpriseSegments: Math.max(0, Math.floor(finiteNumber(situation.surpriseSegments, situation.surprise) ?? 0)),
    applyDexterityReaction: situation.applyDexterityReaction !== false,
    source: String(situation.source ?? "tracker").trim() || "tracker",
    updatedBy: game.user?.id ?? null,
    updatedAt: Date.now()
  };
  if (!data.modifier && !data.surpriseSegments && data.applyDexterityReaction === true) {
    await combatant.unsetFlag("add2e", SITUATION_FLAG);
  } else {
    await combatant.setFlag("add2e", SITUATION_FLAG, data);
  }
  Hooks.callAll("add2eInitiativeSituationChanged", combatant, clone(data));
  return data;
}

function actionItem(combatant, action) {
  if (!combatant?.actor || !action) return null;
  if (action.itemId) {
    const embedded = combatant.actor.items?.get?.(action.itemId);
    if (embedded) return embedded;
  }
  return null;
}

export function initiativeActionContext(combatant, actor = combatant?.actor ?? null) {
  const action = getDeclaredInitiativeAction(combatant);
  const item = actionItem(combatant, action);
  const situation = getInitiativeSituation(combatant);
  let dexterityReaction = 0;
  if (actor && situation.surpriseSegments > 0 && situation.applyDexterityReaction !== false) {
    const resolver = globalThis.ADD2E_EFFECTS?.resolveAbilityDerived;
    if (typeof resolver !== "function") throw new Error("Le résolveur canonique de Dextérité est indisponible pour la surprise.");
    const dexterity = resolver.call(globalThis.ADD2E_EFFECTS, actor, "dexterite", {
      domain: "initiative",
      source: "initiative-surprise-reaction",
      consumer: "initiative"
    });
    dexterityReaction = finiteNumber(dexterity?.profile?.att) ?? 0;
  }
  const remainingSurpriseSegments = Math.max(0, situation.surpriseSegments - dexterityReaction);
  return {
    action,
    item,
    situation: {
      ...situation,
      dexterityReaction,
      remainingSurpriseSegments
    }
  };
}

export function initiativeSituationModifier(combatant) {
  return finiteNumber(getInitiativeSituation(combatant)?.modifier) ?? 0;
}

function initiativeValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
function stableSortValue(combatant) {
  const value = Number(combatant?.sort);
  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}
function comparableSegment(combatant) {
  const segment = finiteNumber(getDeclaredInitiativeAction(combatant)?.segment);
  return segment !== null && segment >= 0 ? segment : null;
}

export function initiativeTieResolution(combatant, combat = game.combat) {
  const score = initiativeValue(combatant?.initiative);
  if (score === null) return { tied: false, resolvedByAction: false, combatants: [] };
  const group = Array.from(combat?.combatants ?? []).filter(entry => initiativeValue(entry?.initiative) === score);
  const allComparable = group.length > 1 && group.every(entry => comparableSegment(entry) !== null);
  const ordered = [...group].sort((a, b) => {
    if (allComparable) {
      const bySegment = comparableSegment(a) - comparableSegment(b);
      if (bySegment) return bySegment;
    }
    const bySort = stableSortValue(a) - stableSortValue(b);
    return bySort || String(a?.id ?? "").localeCompare(String(b?.id ?? ""));
  });
  return {
    tied: group.length > 1,
    resolvedByAction: allComparable,
    score,
    combatants: ordered.map(entry => ({
      id: entry.id,
      name: entry.name,
      action: getDeclaredInitiativeAction(entry),
      segment: comparableSegment(entry)
    }))
  };
}

export async function applyDeclaredActionTieOrder(combat = game.combat) {
  if (!combat?.combatants) return false;
  const combatants = Array.from(combat.combatants ?? []);
  const groups = new Map();
  for (const combatant of combatants) {
    const value = initiativeValue(combatant?.initiative);
    const key = value === null ? "__null__" : String(value);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(combatant);
  }
  const ordered = [...combatants].sort((a, b) => {
    const ai = initiativeValue(a?.initiative);
    const bi = initiativeValue(b?.initiative);
    if (ai === null && bi !== null) return 1;
    if (ai !== null && bi === null) return -1;
    if (ai !== null && bi !== null && ai !== bi) return bi - ai;
    const group = groups.get(ai === null ? "__null__" : String(ai)) ?? [];
    const useAction = ai !== null && group.length > 1 && group.every(entry => comparableSegment(entry) !== null);
    if (useAction) {
      const bySegment = comparableSegment(a) - comparableSegment(b);
      if (bySegment) return bySegment;
    }
    const bySort = stableSortValue(a) - stableSortValue(b);
    return bySort || String(a?.id ?? "").localeCompare(String(b?.id ?? ""));
  });
  const updates = ordered.map((combatant, index) => ({ _id: combatant.id, sort: index })).filter(update => {
    const current = combatants.find(entry => entry.id === update._id);
    return current && Number(current.sort) !== update.sort;
  });
  if (!updates.length) return false;
  await combat.updateEmbeddedDocuments("Combatant", updates, {
    add2eInitiativeSort: true,
    add2eInitiativeActionTieSort: true,
    add2eInitiativeVersion: ADD2E_INITIATIVE_VERSION
  });
  return true;
}

export function initiativeActionLabel(combatant) {
  const action = getDeclaredInitiativeAction(combatant);
  if (!action) return "";
  const segment = finiteNumber(action.segment);
  return segment === null ? action.label : `${action.label} · ${segment}`;
}

export function initiativeActionDebug(combatant) {
  const context = initiativeActionContext(combatant, combatant?.actor ?? null);
  return {
    version: ADD2E_INITIATIVE_ACTION_VERSION,
    combatant: combatant?.name ?? null,
    action: context.action,
    situation: context.situation,
    tie: initiativeTieResolution(combatant, combatant?.combat ?? game.combat)
  };
}

console.log(`${TAG}[ACTIONS][REGISTERED]`, ADD2E_INITIATIVE_ACTION_VERSION);
