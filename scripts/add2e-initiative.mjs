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
const INCAPACITATING_STATUS_IDS = new Set([
  "dead", "defeated", "unconscious", "incapacitated", "inactive",
  "mort", "inconscient", "hors-combat", "hors-jeu",
  "paralyzed", "paralysed", "paralyse",
  "petrified", "petrifie",
  "stunned", "etourdi",
  "asleep", "sleeping", "endormi",
  "neutralized", "neutralise"
]);

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
    rejected: []
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

  return initiativeEngine().resolve(actor, {
    domain: "initiative",
    target: "roll",
    base: safeBase,
    rounding: "round",
    context: {
      ...context,
      actor,
      combat,
      combatant,
      formula,
      actionType: "initiative",
      source: context.source ?? "combat-initiative"
    }
  });
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
  const group = initiativeTieGroup(combatant, combat);
  return {
    tied: group.length > 1,
    score: Number(combatant?.initiative),
    combatantIds: group.map(entry => entry.id),
    names: group.map(entry => entry.name)
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
      resolution
    });
  }

  await combat.updateEmbeddedDocuments("Combatant", updates, {
    add2eInitiativeResolution: true,
    add2eInitiativeSort: true
  });

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
    resolve: resolveInitiative,
    roll: rollInitiative,
    compare: compareInitiativeHighFirst,
    order: getCombatOrder,
    ties: initiativeTieGroup,
    current: currentCombatant,
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
    add2eGetCurrentCombatant: currentCombatant,
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
  configureInitiative as add2eConfigureInitiative,
  resolveInitiative as add2eResolveInitiative,
  rollInitiative as add2eRollInitiative,
  compareInitiativeHighFirst as add2eCompareInitiative,
  getCombatOrder as add2eGetCombatOrder,
  initiativeTieGroup as add2eGetInitiativeTieGroup,
  currentCombatant as add2eGetCurrentCombatant,
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
