// scripts/add2e-initiative.mjs
// ADD2E — point d'entrée et service canonique d'initiative.

import {
  ADD2E_INITIATIVE_VERSION,
  TAG,
  configureInitiative,
  initiativeState
} from "./add2e-initiative-constants.mjs";
import {
  advanceInitiativeTurn,
  compareInitiativeHighFirst,
  currentCombatant,
  forceFirstInitiativeTurn,
  getCombatOrder,
  initiativeTieGroup,
  isInactiveCombatant,
  scheduleInitiativeSort,
  scheduleLocalSync,
  selectCurrentToken,
  sortInitiativeHighFirst
} from "./add2e-initiative-order.mjs";
import { installInitiativeIconPatch, patchInitiativeIcons } from "./add2e-initiative-icons.mjs";
import {
  canActorActNow,
  canTokenInteractNow,
  clearFoundryMovementTrailAggressive,
  installActionLocks,
  installTokenMoveLock,
  syncActionHudToCombatant
} from "./add2e-initiative-locks.mjs";
import { add2eInitiativeDebug, installHooks } from "./add2e-initiative-hooks.mjs";
import { createInitiativeChatCard } from "./add2e-initiative-chat.mjs";

const ADD2E_INITIATIVE_FIELD_MIGRATION_VERSION = "2026-07-28-initiative-fields-v1";
const ADD2E_INITIATIVE_ACTION_VERSION = "2026-07-29-initiative-actions-v2";
const ACTION_FLAG = "initiativeAction";
const SITUATION_FLAG = "initiativeSituation";
const INCAPACITATING_STATUS_IDS = new Set([
  "dead", "defeated", "unconscious", "incapacitated", "inactive",
  "mort", "inconscient", "hors-combat", "hors-jeu",
  "paralyzed", "paralysed", "paralyse",
  "petrified", "petrifie",
  "stunned", "etourdi",
  "asleep", "sleeping", "endormi",
  "neutralized", "neutralise"
]);

function cloneData(value) {
  try {
    return foundry?.utils?.deepClone
      ? foundry.utils.deepClone(value)
      : JSON.parse(JSON.stringify(value));
  } catch (_error) {
    return value;
  }
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

function normalizeStatus(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function effectStatusIds(effect) {
  const statuses = new Set();
  for (const status of effect?.statuses ?? []) {
    const id = normalizeStatus(status?.id ?? status);
    if (id) statuses.add(id);
  }
  for (const value of [
    effect?.statusId,
    effect?.flags?.core?.statusId,
    effect?.flags?.add2e?.statusId,
    effect?.flags?.add2e?.vitalStatus,
    effect?.name
  ]) {
    const id = normalizeStatus(value);
    if (id) statuses.add(id);
  }
  return statuses;
}

function isResponsibleInitiativeGM() {
  if (!game.user?.isGM) return false;
  const activeGM = game.users?.activeGM
    ?? Array.from(game.users ?? []).find(user => user?.active && user?.isGM)
    ?? null;
  return !activeGM || activeGM.id === game.user.id;
}

function legacyInitiativeFieldUpdate(actor) {
  const system = actor?.system ?? {};
  const update = {};
  if (Object.prototype.hasOwnProperty.call(system, "initiative")) update["system.-=initiative"] = null;
  if (Object.prototype.hasOwnProperty.call(system, "dexterite_initiative")) update["system.-=dexterite_initiative"] = null;
  return update;
}

async function migrateLegacyInitiativeFields() {
  globalThis.ADD2E_INITIATIVE_FIELD_MIGRATION_VERSION = ADD2E_INITIATIVE_FIELD_MIGRATION_VERSION;
  if (!isResponsibleInitiativeGM()) return { migrated: 0, skipped: true };

  let migrated = 0;
  for (const actor of game.actors?.contents ?? game.actors ?? []) {
    const update = legacyInitiativeFieldUpdate(actor);
    if (!Object.keys(update).length) continue;
    await actor.update(update, {
      add2eInitiativeMigration: true,
      add2eMigrationVersion: ADD2E_INITIATIVE_FIELD_MIGRATION_VERSION
    });
    migrated += 1;
  }
  if (migrated) console.log(`${TAG}[MIGRATION][LEGACY_FIELDS]`, { version: ADD2E_INITIATIVE_FIELD_MIGRATION_VERSION, migrated });
  return { migrated, skipped: false };
}

function combatantActorId(combatant) {
  return String(combatant?.actorId ?? combatant?.actor?.id ?? "");
}

function canManageCombatant(combatant) {
  return game.user?.isGM === true || combatant?.actor?.isOwner === true;
}

export function initiativeCombatantForActor(actor, combat = game.combat, token = null) {
  if (!actor || !combat?.combatants) return null;
  const combatants = Array.from(combat.combatants ?? []);
  const tokenId = String(token?.id ?? token?.document?.id ?? "");
  if (tokenId) {
    const byToken = combatants.find(entry => String(entry?.tokenId ?? entry?.token?.id ?? "") === tokenId);
    if (byToken) return byToken;
  }

  const current = currentCombatant(combat);
  if (current && combatantActorId(current) === String(actor.id ?? "")) return current;

  const controlledIds = new Set(
    (canvas?.tokens?.controlled ?? [])
      .filter(entry => entry?.actor?.id === actor.id)
      .map(entry => String(entry.id))
  );
  const controlled = combatants.find(entry => controlledIds.has(String(entry?.tokenId ?? "")));
  if (controlled) return controlled;

  return combatants.find(entry => combatantActorId(entry) === String(actor.id ?? "")) ?? null;
}

function combatantFromSubject(subject, combat = game.combat) {
  if (!subject) return null;
  if (subject.documentName === "Combatant" || subject.parent?.documentName === "Combat") return subject;
  return initiativeCombatantForActor(subject, combat);
}

function actionKind(value) {
  const key = String(value ?? "").trim().toLowerCase();
  if (["weapon", "arme"].includes(key)) return "weapon";
  if (["spell", "sort", "sortilege"].includes(key)) return "spell";
  if (["item", "objet", "power", "pouvoir"].includes(key)) return "item";
  return key || "other";
}

function actionSegment(kind, item) {
  const system = item?.system ?? {};
  if (kind === "weapon") {
    return finiteNumber(
      system.facteur_rapidité,
      system.facteur_rapidite,
      system.speedFactor,
      system.weaponSpeed,
      system.speed
    );
  }
  if (kind === "spell") {
    return finiteNumber(
      system.temps_incantation,
      system.tempsIncantation,
      system.casting_time,
      system.castingTime,
      system.castTime
    );
  }
  return finiteNumber(
    system.initiativeSegment,
    system.segment,
    system.speedFactor,
    system.temps_incantation
  );
}

function declarationMatchesRound(raw, combat) {
  const declaredRound = Math.max(0, Math.floor(Number(raw?.round) || 0));
  const combatRound = Math.max(0, Math.floor(Number(combat?.round) || 0));
  if (declaredRound === 0) return combatRound <= 1;
  if (combatRound === 0) return true;
  return declaredRound === combatRound;
}

export function getDeclaredInitiativeAction(subject, combat = game.combat, { includeExpired = false } = {}) {
  const combatant = combatantFromSubject(subject, combat);
  const raw = combatant?.getFlag?.("add2e", ACTION_FLAG)
    ?? combatant?.flags?.add2e?.[ACTION_FLAG]
    ?? null;
  if (!raw || typeof raw !== "object") return null;
  if (!includeExpired && !declarationMatchesRound(raw, combat)) return null;
  return { ...cloneData(raw), combatantId: combatant?.id ?? raw.combatantId ?? null };
}

export function getInitiativeSituation(subject, combat = game.combat, { includeExpired = false } = {}) {
  const combatant = combatantFromSubject(subject, combat);
  const raw = combatant?.getFlag?.("add2e", SITUATION_FLAG)
    ?? combatant?.flags?.add2e?.[SITUATION_FLAG]
    ?? null;
  if (!raw || typeof raw !== "object" || (!includeExpired && !declarationMatchesRound(raw, combat))) {
    return {
      modifier: 0,
      surpriseSegments: 0,
      applyDexterityReaction: true
    };
  }
  return {
    ...cloneData(raw),
    modifier: finiteNumber(raw.modifier) ?? 0,
    surpriseSegments: Math.max(0, Math.floor(finiteNumber(raw.surpriseSegments, raw.surprise) ?? 0)),
    applyDexterityReaction: raw.applyDexterityReaction !== false
  };
}

function actionItem(combatant, action) {
  if (!combatant?.actor || !action?.itemId) return null;
  return combatant.actor.items?.get?.(action.itemId) ?? null;
}

export function initiativeActionContext(combatant, actor = combatant?.actor ?? null, combat = combatant?.parent ?? game.combat) {
  const action = getDeclaredInitiativeAction(combatant, combat);
  const item = actionItem(combatant, action);
  const situation = getInitiativeSituation(combatant, combat);
  let dexterityReaction = 0;

  if (actor && situation.surpriseSegments > 0 && situation.applyDexterityReaction !== false) {
    const resolver = globalThis.ADD2E_EFFECTS?.resolveAbilityDerived;
    if (typeof resolver !== "function") {
      throw new Error("Le résolveur canonique de Dextérité est indisponible pour la surprise.");
    }
    const dexterity = resolver.call(globalThis.ADD2E_EFFECTS, actor, "dexterite", {
      domain: "initiative",
      source: "initiative-surprise-reaction",
      consumer: "initiative"
    });
    dexterityReaction = finiteNumber(dexterity?.profile?.att) ?? 0;
  }

  return {
    action,
    item,
    situation: {
      ...situation,
      dexterityReaction,
      remainingSurpriseSegments: Math.max(0, situation.surpriseSegments - dexterityReaction)
    }
  };
}

export function initiativeActionLabel(combatant, combat = combatant?.parent ?? game.combat) {
  const action = getDeclaredInitiativeAction(combatant, combat);
  if (!action) return "";
  const segment = finiteNumber(action.segment);
  return segment === null ? action.label : `${action.label} · ${segment}`;
}

function comparableActionSegment(combatant, combat = combatant?.parent ?? game.combat) {
  const segment = finiteNumber(getDeclaredInitiativeAction(combatant, combat)?.segment);
  return segment !== null && segment >= 0 ? segment : null;
}

function initiativeScore(value) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function stableCombatantSort(combatant) {
  const value = Number(combatant?.sort);
  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}

export function initiativeTieResolution(combatant, combat = game.combat) {
  const score = initiativeScore(combatant?.initiative);
  if (score === null) {
    return {
      tied: false,
      resolvedByAction: false,
      score: null,
      combatants: []
    };
  }

  const group = Array.from(combat?.combatants ?? [])
    .filter(entry => initiativeScore(entry?.initiative) === score);
  const resolvedByAction = group.length > 1
    && group.every(entry => comparableActionSegment(entry, combat) !== null);
  const ordered = [...group].sort((left, right) => {
    if (resolvedByAction) {
      const bySegment = comparableActionSegment(left, combat) - comparableActionSegment(right, combat);
      if (bySegment) return bySegment;
    }
    const bySort = stableCombatantSort(left) - stableCombatantSort(right);
    return bySort || String(left?.id ?? "").localeCompare(String(right?.id ?? ""));
  });

  return {
    tied: group.length > 1,
    resolvedByAction,
    score,
    combatants: ordered.map(entry => ({
      id: entry.id,
      name: entry.name,
      action: getDeclaredInitiativeAction(entry, combat),
      segment: comparableActionSegment(entry, combat)
    }))
  };
}

export async function applyDeclaredActionTieOrder(combat = game.combat) {
  if (!combat?.combatants) return false;
  const combatants = Array.from(combat.combatants ?? []);
  const groups = new Map();

  for (const combatant of combatants) {
    const value = initiativeScore(combatant?.initiative);
    const key = value === null ? "__null__" : String(value);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(combatant);
  }

  const ordered = [...combatants].sort((left, right) => {
    const leftInitiative = initiativeScore(left?.initiative);
    const rightInitiative = initiativeScore(right?.initiative);
    const leftValid = leftInitiative !== null;
    const rightValid = rightInitiative !== null;
    if (!leftValid && rightValid) return 1;
    if (leftValid && !rightValid) return -1;
    if (leftValid && rightValid && leftInitiative !== rightInitiative) return rightInitiative - leftInitiative;

    const group = groups.get(leftValid ? String(leftInitiative) : "__null__") ?? [];
    const useAction = leftValid
      && group.length > 1
      && group.every(entry => comparableActionSegment(entry, combat) !== null);
    if (useAction) {
      const bySegment = comparableActionSegment(left, combat) - comparableActionSegment(right, combat);
      if (bySegment) return bySegment;
    }

    const bySort = stableCombatantSort(left) - stableCombatantSort(right);
    return bySort || String(left?.id ?? "").localeCompare(String(right?.id ?? ""));
  });

  const updates = ordered
    .map((combatant, index) => ({ _id: combatant.id, sort: index }))
    .filter(update => {
      const current = combatants.find(entry => entry.id === update._id);
      return current && Number(current.sort) !== update.sort;
    });

  if (!updates.length) return false;
  try {
    await combat.updateEmbeddedDocuments("Combatant", updates, {
      add2eInitiativeSort: true,
      add2eInitiativeActionTieSort: true,
      add2eInitiativeVersion: ADD2E_INITIATIVE_VERSION
    });
    return true;
  } catch (error) {
    console.warn(`${TAG}[DECLARED_ACTION][TIE_ORDER_FAILED]`, error);
    return false;
  }
}

async function refreshDeclaredActionOrder(combat = game.combat) {
  if (!combat?.combatants) return false;
  try {
    await applyDeclaredActionTieOrder(combat);
    if (combat.started) await sortInitiativeHighFirst(combat);
    else combat.setupTurns?.();
    return true;
  } catch (error) {
    console.warn(`${TAG}[DECLARED_ACTION][ORDER_REFRESH_FAILED]`, error);
    return false;
  }
}

export async function declareInitiativeAction(actor, {
  kind,
  item,
  combat = game.combat,
  combatant = null,
  token = null
} = {}) {
  combatant = combatant ?? initiativeCombatantForActor(actor, combat, token);
  if (!combatant) {
    throw new Error("Aucun Combatant ne correspond à cet acteur pour déclarer l’action d’initiative.");
  }
  if (!canManageCombatant(combatant)) {
    throw new Error("Vous ne pouvez pas déclarer l’action de ce combattant.");
  }

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
    round: Math.max(0, Math.floor(Number(combat?.round) || 0))
  };

  await combatant.setFlag("add2e", ACTION_FLAG, data);
  await refreshDeclaredActionOrder(combat);
  Hooks.callAll("add2eInitiativeActionDeclared", combatant, cloneData(data));
  return data;
}

export async function clearDeclaredInitiativeAction(subject, combat = game.combat) {
  const combatant = combatantFromSubject(subject, combat);
  if (!combatant) return false;
  if (!canManageCombatant(combatant)) {
    throw new Error("Vous ne pouvez pas effacer l’action de ce combattant.");
  }
  await combatant.unsetFlag("add2e", ACTION_FLAG);
  await refreshDeclaredActionOrder(combat);
  Hooks.callAll("add2eInitiativeActionDeclared", combatant, null);
  return true;
}

export async function setInitiativeSituation(subject, situation = {}, combat = game.combat) {
  const combatant = combatantFromSubject(subject, combat);
  if (!combatant) throw new Error("Combattant introuvable pour la situation d’initiative.");
  if (!canManageCombatant(combatant)) {
    throw new Error("Vous ne pouvez pas modifier la situation de ce combattant.");
  }

  const data = {
    version: ADD2E_INITIATIVE_ACTION_VERSION,
    modifier: finiteNumber(situation.modifier) ?? 0,
    surpriseSegments: Math.max(0, Math.floor(finiteNumber(situation.surpriseSegments, situation.surprise) ?? 0)),
    applyDexterityReaction: situation.applyDexterityReaction !== false,
    source: String(situation.source ?? "tracker").trim() || "tracker",
    updatedBy: game.user?.id ?? null,
    updatedAt: Date.now(),
    round: Math.max(0, Math.floor(Number(combat?.round) || 0))
  };

  if (!data.modifier && !data.surpriseSegments && data.applyDexterityReaction === true) {
    await combatant.unsetFlag("add2e", SITUATION_FLAG);
  } else {
    await combatant.setFlag("add2e", SITUATION_FLAG, data);
  }

  Hooks.callAll("add2eInitiativeSituationChanged", combatant, cloneData(data));
  return data;
}

export function combatantSkipReason(combatant) {
  if (!combatant) return "Combattant introuvable";
  if (isInactiveCombatant(combatant)) return "Incapable d'agir";

  for (const document of [combatant, combatant.token, combatant.actor].filter(Boolean)) {
    if (document?.flags?.add2e?.skipCombatTurn === true) return "Tour neutralisé";
    for (const effect of document?.effects ?? []) {
      if (!effect || effect.disabled === true || effect.isSuppressed === true) continue;
      if (effect?.flags?.add2e?.skipCombatTurn === true) return effect.name || "Tour neutralisé";
      for (const status of effectStatusIds(effect)) {
        if (INCAPACITATING_STATUS_IDS.has(status)) return effect.name || status;
      }
    }
  }
  return "";
}

export function canCombatantTakeTurn(combatant) {
  return combatantSkipReason(combatant) === "";
}

export async function advanceCombatTurn(combat = game.combat, direction = 1, { notify = true } = {}) {
  if (!combat?.started) return combat;
  const maximum = Math.max(1, combat.combatants?.size ?? Array.from(combat.combatants ?? []).length ?? 1);

  for (let attempt = 0; attempt < maximum; attempt += 1) {
    await advanceInitiativeTurn(combat, direction >= 0 ? 1 : -1);
    const active = currentCombatant(combat);
    const reason = combatantSkipReason(active);
    if (!reason) return combat;
    if (notify) ui.notifications?.info?.(`${active?.name ?? "Combattant"} est sauté : ${reason}.`);
  }

  if (notify) ui.notifications?.warn?.("Aucun combattant capable d'agir n'a été trouvé.");
  return combat;
}

function initiativeEngine() {
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine ?? null;
  if (!engine || typeof engine.resolve !== "function") {
    throw new Error("Le moteur canonique ADD2E des modificateurs d'initiative est indisponible.");
  }
  return engine;
}

function initiativeFormula(options = {}) {
  return String(options?.formula ?? CONFIG.Combat?.initiative?.formula ?? "1d6").trim() || "1d6";
}

function initiativeIds(ids) {
  const list = Array.isArray(ids) ? ids : [ids];
  return [...new Set(list.map(value => String(value ?? "").trim()).filter(Boolean))];
}

function initiativeResolutionWithoutActor(base) {
  const total = Number(base);
  return {
    domain: "initiative",
    target: "roll",
    base: Number.isFinite(total) ? total : 0,
    total: Number.isFinite(total) ? total : 0,
    applied: [],
    rejected: [],
    actionContext: null,
    situationModifier: 0
  };
}

export function resolveInitiative(actor, {
  base = 0,
  combat = game.combat,
  combatant = null,
  formula = "1d6",
  context = {}
} = {}) {
  const numericBase = Number(base);
  const safeBase = Number.isFinite(numericBase) ? numericBase : 0;
  if (!actor) return initiativeResolutionWithoutActor(safeBase);

  const actionContext = combatant
    ? initiativeActionContext(combatant, actor, combat)
    : {
        action: null,
        item: null,
        situation: {
          modifier: 0,
          surpriseSegments: 0,
          dexterityReaction: 0,
          remainingSurpriseSegments: 0,
          applyDexterityReaction: true
        }
      };
  const situationModifier = finiteNumber(actionContext?.situation?.modifier) ?? 0;
  const resolution = initiativeEngine().resolve(actor, {
    domain: "initiative",
    target: "roll",
    base: safeBase + situationModifier,
    rounding: "round",
    context: {
      ...context,
      actor,
      combat,
      combatant,
      formula,
      item: actionContext.item,
      sourceItem: actionContext.item,
      initiativeAction: actionContext.action,
      initiativeSituation: actionContext.situation,
      baseRoll: safeBase,
      actionType: "initiative",
      source: context.source ?? "combat-initiative"
    }
  });

  return {
    ...resolution,
    baseRoll: safeBase,
    situationModifier,
    actionContext
  };
}

function combatantSpeakerOptions(combatant, options = {}) {
  const messageOptions = options?.messageOptions && typeof options.messageOptions === "object"
    ? { ...options.messageOptions }
    : {};
  return {
    messageOptions,
    messageMode: options?.messageMode ?? null,
    combatant
  };
}

async function restoreCurrentCombatant(combat, combatantId, updateTurn) {
  if (!combat?.started || updateTurn === false || !combatantId) return;
  const turns = getCombatOrder(combat);
  const index = turns.findIndex(entry => String(entry.id) === String(combatantId));
  if (index < 0 || Number(combat.turn) === index) return;
  await combat.update({ turn: index }, { add2eInitiativeNavigation: true });
}

function initiativeTieData(combat, combatant) {
  const resolution = initiativeTieResolution(combatant, combat);
  return {
    tied: resolution.tied,
    resolvedByAction: resolution.resolvedByAction,
    score: resolution.score,
    combatantIds: resolution.combatants.map(entry => entry.id),
    names: resolution.combatants.map(entry => entry.name),
    combatants: resolution.combatants
  };
}

export async function rollInitiative(combat, ids, options = {}) {
  if (!combat?.combatants) throw new Error("Combat introuvable pour le jet d'initiative ADD2E.");
  const selected = initiativeIds(ids)
    .map(id => combat.combatants.get?.(id) ?? Array.from(combat.combatants ?? []).find(entry => entry.id === id))
    .filter(Boolean);
  if (!selected.length) return combat;

  const formula = initiativeFormula(options);
  const activeId = combat.current?.combatantId ?? combat.combatant?.id ?? null;
  const updates = [];
  const messages = [];

  for (const combatant of selected) {
    const initiativeRoll = typeof combatant.getInitiativeRoll === "function"
      ? combatant.getInitiativeRoll(formula)
      : new Roll(formula, combatant.actor?.getRollData?.() ?? {});
    const roll = await initiativeRoll.evaluate();
    const resolution = resolveInitiative(combatant.actor ?? null, {
      base: roll.total,
      combat,
      combatant,
      formula,
      context: {
        source: "combat-roll-initiative",
        tokenId: combatant.tokenId ?? null,
        actorId: combatant.actorId ?? combatant.actor?.id ?? null
      }
    });
    const total = Number(resolution?.total);
    if (!Number.isFinite(total)) {
      throw new Error(`Initiative invalide pour ${combatant.name ?? combatant.id}.`);
    }

    updates.push({ _id: combatant.id, initiative: total });
    messages.push({
      ...combatantSpeakerOptions(combatant, options),
      roll,
      formula,
      resolution,
      actionContext: resolution.actionContext
    });
  }

  await combat.updateEmbeddedDocuments("Combatant", updates, {
    add2eInitiativeResolution: true,
    add2eInitiativeSort: true
  });

  await applyDeclaredActionTieOrder(combat);
  if (combat.started) await sortInitiativeHighFirst(combat);
  else combat.setupTurns?.();
  await restoreCurrentCombatant(combat, activeId, options.updateTurn);

  for (const message of messages) {
    await createInitiativeChatCard({
      ...message,
      tie: initiativeTieData(combat, message.combatant)
    });
  }

  const ties = updates
    .map(update => combat.combatants.get?.(update._id))
    .filter(Boolean)
    .map(combatant => initiativeTieData(combat, combatant))
    .filter(entry => entry.tied);

  Hooks.callAll("add2eInitiativeRolled", combat, {
    version: ADD2E_INITIATIVE_VERSION,
    formula,
    updates,
    combatantIds: updates.map(update => update._id),
    ties
  });
  return combat;
}

export function installInitiativeRollPatch() {
  if (initiativeState.rollPatched) return true;
  const proto = globalThis.Combat?.prototype;
  if (!proto || typeof proto.rollInitiative !== "function") return false;
  if (proto.rollInitiative.__add2eCanonicalInitiative === ADD2E_INITIATIVE_VERSION) {
    initiativeState.rollPatched = true;
    return true;
  }

  const original = proto.rollInitiative.__add2eOriginal ?? proto.rollInitiative;
  proto.rollInitiative = function add2eCanonicalRollInitiative(ids, options = {}) {
    if (game?.system?.id !== "add2e") return original.call(this, ids, options);
    return rollInitiative(this, ids, options);
  };
  proto.rollInitiative.__add2eCanonicalInitiative = ADD2E_INITIATIVE_VERSION;
  proto.rollInitiative.__add2eOriginal = original;
  initiativeState.rollPatched = true;
  return true;
}

export function installInitiativeNavigationPatch() {
  if (initiativeState.navigationPatched) return true;
  const proto = globalThis.Combat?.prototype;
  if (!proto || typeof proto.nextTurn !== "function" || typeof proto.previousTurn !== "function") return false;
  if (proto.nextTurn.__add2eCanonicalNavigation === ADD2E_INITIATIVE_VERSION
    && proto.previousTurn.__add2eCanonicalNavigation === ADD2E_INITIATIVE_VERSION) {
    initiativeState.navigationPatched = true;
    return true;
  }

  const originalNext = proto.nextTurn.__add2eOriginalNavigation ?? proto.nextTurn;
  const originalPrevious = proto.previousTurn.__add2eOriginalNavigation ?? proto.previousTurn;
  proto.nextTurn = function add2eCanonicalNextTurn(...args) {
    if (game?.system?.id !== "add2e") return originalNext.apply(this, args);
    return advanceCombatTurn(this, 1);
  };
  proto.previousTurn = function add2eCanonicalPreviousTurn(...args) {
    if (game?.system?.id !== "add2e") return originalPrevious.apply(this, args);
    return advanceCombatTurn(this, -1);
  };
  proto.nextTurn.__add2eCanonicalNavigation = ADD2E_INITIATIVE_VERSION;
  proto.nextTurn.__add2eOriginalNavigation = originalNext;
  proto.previousTurn.__add2eCanonicalNavigation = ADD2E_INITIATIVE_VERSION;
  proto.previousTurn.__add2eOriginalNavigation = originalPrevious;
  initiativeState.navigationPatched = true;
  return true;
}

function exposeGlobals() {
  game.add2e = game.add2e ?? {};
  game.add2e.initiativeVersion = ADD2E_INITIATIVE_VERSION;
  game.add2e.initiative = {
    version: ADD2E_INITIATIVE_VERSION,
    actionVersion: ADD2E_INITIATIVE_ACTION_VERSION,
    resolve: resolveInitiative,
    roll: rollInitiative,
    compare: compareInitiativeHighFirst,
    order: getCombatOrder,
    ties: initiativeTieGroup,
    tieResolution: initiativeTieResolution,
    current: currentCombatant,
    combatantForActor: initiativeCombatantForActor,
    declaredAction: getDeclaredInitiativeAction,
    actionLabel: initiativeActionLabel,
    declareAction: declareInitiativeAction,
    clearAction: clearDeclaredInitiativeAction,
    situation: getInitiativeSituation,
    setSituation: setInitiativeSituation,
    actionContext: initiativeActionContext,
    canTakeTurn: canCombatantTakeTurn,
    skipReason: combatantSkipReason,
    advance: advanceCombatTurn,
    migrateLegacyFields: migrateLegacyInitiativeFields
  };

  Object.assign(globalThis, {
    add2eConfigureInitiative: configureInitiative,
    add2eResolveInitiative: resolveInitiative,
    add2eRollInitiative: rollInitiative,
    add2eCompareInitiative: compareInitiativeHighFirst,
    add2eGetCombatOrder: getCombatOrder,
    add2eGetInitiativeTieGroup: initiativeTieGroup,
    add2eGetInitiativeTieResolution: initiativeTieResolution,
    add2eGetCurrentCombatant: currentCombatant,
    add2eGetInitiativeCombatantForActor: initiativeCombatantForActor,
    add2eGetDeclaredInitiativeAction: getDeclaredInitiativeAction,
    add2eInitiativeActionLabel: initiativeActionLabel,
    add2eDeclareInitiativeAction: declareInitiativeAction,
    add2eClearDeclaredInitiativeAction: clearDeclaredInitiativeAction,
    add2eGetInitiativeSituation: getInitiativeSituation,
    add2eSetInitiativeSituation: setInitiativeSituation,
    add2eGetInitiativeActionContext: initiativeActionContext,
    add2eCanCombatantTakeTurn: canCombatantTakeTurn,
    add2eCombatantSkipReason: combatantSkipReason,
    add2eAdvanceCombatTurn: advanceCombatTurn,
    add2eSortInitiative: sortInitiativeHighFirst,
    add2eScheduleInitiativeSort: scheduleInitiativeSort,
    add2eCanActorActNow: canActorActNow,
    add2eCanTokenInteractNow: canTokenInteractNow,
    add2eSyncActionHudToCombatant: syncActionHudToCombatant,
    add2eSyncCombatAfterRefresh: scheduleLocalSync,
    add2eScheduleRefreshSync: scheduleLocalSync,
    add2eDebugCombatState: add2eInitiativeDebug,
    add2eSelectActiveCombatantToken: selectCurrentToken,
    add2eClearFoundryMovementTrail: clearFoundryMovementTrailAggressive,
    add2eForceFirstInitiativeTurn: forceFirstInitiativeTurn,
    add2eMigrateLegacyInitiativeFields: migrateLegacyInitiativeFields
  });
}

function installInitiativeCore() {
  configureInitiative();
  installInitiativeRollPatch();
  installInitiativeNavigationPatch();
}

Hooks.once("init", installInitiativeCore);
Hooks.once("setup", installInitiativeCore);
Hooks.once("ready", async () => {
  installInitiativeCore();
  installInitiativeIconPatch();
  exposeGlobals();
  installTokenMoveLock();
  installActionLocks();
  installHooks();
  await migrateLegacyInitiativeFields();
  patchInitiativeIcons(ui?.combat?.element ?? document);
  console.log(`${TAG}[CANONICAL_READY]`, ADD2E_INITIATIVE_VERSION);
});

export {
  ADD2E_INITIATIVE_ACTION_VERSION,
  configureInitiative as add2eConfigureInitiative,
  resolveInitiative as add2eResolveInitiative,
  rollInitiative as add2eRollInitiative,
  compareInitiativeHighFirst as add2eCompareInitiative,
  getCombatOrder as add2eGetCombatOrder,
  initiativeTieGroup as add2eGetInitiativeTieGroup,
  initiativeTieResolution as add2eGetInitiativeTieResolution,
  currentCombatant as add2eGetCurrentCombatant,
  initiativeCombatantForActor as add2eGetInitiativeCombatantForActor,
  getDeclaredInitiativeAction as add2eGetDeclaredInitiativeAction,
  initiativeActionLabel as add2eInitiativeActionLabel,
  declareInitiativeAction as add2eDeclareInitiativeAction,
  clearDeclaredInitiativeAction as add2eClearDeclaredInitiativeAction,
  getInitiativeSituation as add2eGetInitiativeSituation,
  setInitiativeSituation as add2eSetInitiativeSituation,
  initiativeActionContext as add2eGetInitiativeActionContext,
  advanceCombatTurn as add2eAdvanceCombatTurn,
  canCombatantTakeTurn as add2eCanCombatantTakeTurn,
  combatantSkipReason as add2eCombatantSkipReason,
  canActorActNow as add2eCanActorActNow,
  syncActionHudToCombatant as add2eSyncActionHudToCombatant,
  scheduleLocalSync as add2eSyncCombatAfterRefresh,
  add2eInitiativeDebug as add2eDebugCombatState,
  clearFoundryMovementTrailAggressive as add2eDisableMovementHistoryRecording,
  migrateLegacyInitiativeFields as add2eMigrateLegacyInitiativeFields
};
