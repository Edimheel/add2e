// scripts/add2e-initiative-hooks.mjs
// ADD2E — hooks, cycle de round et validation de l'initiative canonique.

import { ADD2E_INITIATIVE_VERSION, hasProperty, initiativeState } from "./add2e-initiative-constants.mjs";
import { currentCombatant, getCombatOrder, scheduleInitiativeSort, scheduleLocalSync } from "./add2e-initiative-order.mjs";
import { installInitiativeChatCard } from "./add2e-initiative-chat.mjs";
import { patchInitiativeIcons } from "./add2e-initiative-icons.mjs";
import { canTokenInteractNow, clearFoundryMovementTrailAggressive } from "./add2e-initiative-locks.mjs";

const MOVEMENT_KEYS = ["x", "y", "elevation", "rotation"];
const MULTIPLE_ATTACK_PHASE_FLAG = "multipleAttackPhase";
const ROUND_SCOPED_FLAG_PATHS = [
  ["initiativeAction", "flags.add2e.-=initiativeAction"],
  ["initiativeSituation", "flags.add2e.-=initiativeSituation"]
];
let canonicalTurnEventTimer = null;
let roundDataCleanupTimer = null;

const hasAnyProperty = (obj, keys) => keys.some(key => hasProperty(obj ?? {}, key));
const combatFor = combatant => combatant?.combat ?? game.combat;
const validationScore = value => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

function patchTrackerIcons(app, html) {
  if (app?.options?.id === "combat" || app?.tabName === "combat" || app?.id === "combat") patchInitiativeIcons(html);
}

function responsibleInitiativeGM() {
  if (!game.user?.isGM) return false;
  const activeGM = game.users?.activeGM ?? Array.from(game.users ?? []).find(user => user?.active && user?.isGM) ?? null;
  return !activeGM || activeGM.id === game.user.id;
}

function scopedRound(data) {
  const round = Number(data?.round);
  return Number.isFinite(round) ? Math.max(0, Math.floor(round)) : 0;
}

function roundDataIsCurrent(data, combat, force = false) {
  if (!data || typeof data !== "object" || force) return false;
  const storedRound = scopedRound(data);
  if (combat?.started !== true) return storedRound === 0;
  const currentRound = Math.max(1, Math.floor(Number(combat?.round) || 1));
  return currentRound === 1 ? storedRound === 0 || storedRound === 1 : storedRound === currentRound;
}

function multipleAttackPhaseIsCurrent(combat, force = false) {
  const phase = combat?.flags?.add2e?.[MULTIPLE_ATTACK_PHASE_FLAG] ?? null;
  if (!phase || typeof phase !== "object" || force || combat?.started !== true) return false;
  return scopedRound(phase) === Math.max(1, Math.floor(Number(combat?.round) || 1));
}

export async function cleanupInitiativeRoundData(combat = game.combat, { reason = "round-cleanup", force = false } = {}) {
  if (!combat?.combatants || !responsibleInitiativeGM()) return { cleaned: 0, phaseCleared: false, skipped: true };
  const updates = [];
  for (const combatant of combat.combatants ?? []) {
    const flags = combatant?.flags?.add2e ?? {};
    const update = { _id: combatant.id };
    for (const [flagName, deletionPath] of ROUND_SCOPED_FLAG_PATHS) {
      if (Object.prototype.hasOwnProperty.call(flags, flagName) && !roundDataIsCurrent(flags[flagName], combat, force)) {
        update[deletionPath] = null;
      }
    }
    if (Object.keys(update).length > 1) updates.push(update);
  }
  const flags = combat?.flags?.add2e ?? {};
  const phaseCleared = Object.prototype.hasOwnProperty.call(flags, MULTIPLE_ATTACK_PHASE_FLAG)
    && !multipleAttackPhaseIsCurrent(combat, force);
  if (!updates.length && !phaseCleared) return { cleaned: 0, phaseCleared: false, skipped: false };
  if (updates.length) {
    await combat.updateEmbeddedDocuments("Combatant", updates, {
      add2eInitiativeRoundCleanup: true,
      add2eInitiativeVersion: ADD2E_INITIATIVE_VERSION,
      add2eReason: reason
    });
  }
  if (phaseCleared) {
    await combat.update({ "flags.add2e.-=multipleAttackPhase": null }, {
      add2eInitiativeRoundCleanup: true,
      add2eInitiativeVersion: ADD2E_INITIATIVE_VERSION,
      add2eReason: reason
    });
  }
  Hooks.callAll("add2eInitiativeRoundDataCleared", combat, {
    reason,
    round: Number(combat.round ?? 0),
    combatantIds: updates.map(update => update._id),
    phaseCleared
  });
  return { cleaned: updates.length, phaseCleared, skipped: false };
}

function scheduleInitiativeRoundDataCleanup(combat, reason, delay = 0, { force = false } = {}) {
  if (!combat) return;
  clearTimeout(roundDataCleanupTimer);
  roundDataCleanupTimer = setTimeout(() => {
    cleanupInitiativeRoundData(combat, { reason, force })
      .catch(error => console.error("[ADD2E][INIT][ROUND_CLEANUP][ERROR]", error));
  }, Math.max(0, Number(delay) || 0));
}

function scheduleCanonicalTurnEvent(combat, reason, delay = 0) {
  if (!combat) return;
  clearTimeout(canonicalTurnEventTimer);
  canonicalTurnEventTimer = setTimeout(() => {
    const active = currentCombatant(combat);
    Hooks.callAll("add2eInitiativeTurnChanged", combat, {
      reason,
      round: Number(combat.round ?? 0),
      turn: Number(combat.turn ?? 0),
      combatantId: active?.id ?? null
    });
  }, Math.max(0, Number(delay) || 0));
}

function validationScopeIds(combat, scope) {
  const combatants = Array.from(combat?.combatants ?? []);
  if (scope === "all") return combatants.map(entry => entry.id).filter(Boolean);
  if (scope === "monsters") {
    return combatants
      .filter(entry => String(entry?.actor?.type ?? "").toLowerCase() === "monster")
      .map(entry => entry.id)
      .filter(Boolean);
  }
  if (scope === "missing") {
    return combatants
      .filter(entry => validationScore(entry?.initiative) === null)
      .map(entry => entry.id)
      .filter(Boolean);
  }
  return [];
}

function validationLegacyActorFields(actor) {
  const system = actor?.system ?? {};
  return ["initiative", "dexterite_initiative"]
    .filter(key => Object.prototype.hasOwnProperty.call(system, key));
}

function validationMessageMode() {
  const generation = Number(game.release?.generation ?? String(game.version ?? "").split(".")[0]) || 13;
  const settingKey = generation >= 14 ? "messageMode" : "rollMode";
  try {
    return game.settings?.get?.("core", settingKey) ?? "publicroll";
  } catch (_error) {
    return "publicroll";
  }
}

function mockCombatant({ id, initiative = 4, sort = 0, action = null, situation = null }) {
  const add2e = {};
  if (action) add2e.initiativeAction = { round: 1, ...action };
  if (situation) add2e.initiativeSituation = { round: 1, ...situation };
  return {
    documentName: "Combatant",
    id,
    name: id,
    initiative,
    sort,
    actor: null,
    flags: { add2e },
    getFlag(scope, key) { return scope === "add2e" ? this.flags.add2e[key] ?? null : null; }
  };
}

function scenarioResult(id, label, expected, actual) {
  return { id, label, expected, actual, ok: JSON.stringify(expected) === JSON.stringify(actual) };
}

function runTieScenario(service, definition) {
  try {
    const combatants = definition.combatants.map(mockCombatant);
    const combat = { documentName: "Combat", started: true, round: definition.round ?? 1, combatants };
    const result = service.tieResolution(combatants[0], combat);
    return scenarioResult(definition.id, definition.label, definition.expected, {
      resolvedByAction: result?.resolvedByAction === true,
      order: (result?.combatants ?? []).map(entry => entry.id)
    });
  } catch (error) {
    return { id: definition.id, label: definition.label, ok: false, error: error.message };
  }
}

function runInitiativeScenarioValidation(service) {
  if (!["tieResolution", "declaredAction", "situation", "actionContext"].every(name => typeof service?.[name] === "function")) {
    return [{ id: "service", label: "Services de scénario", ok: false, error: "Fonction canonique manquante" }];
  }
  const scenarios = [
    {
      id: "stable-tie",
      label: "Égalité stable sans actions comparables",
      combatants: [{ id: "stable-a", sort: 1 }, { id: "stable-b", sort: 0 }],
      expected: { resolvedByAction: false, order: ["stable-b", "stable-a"] }
    },
    {
      id: "weapon-spell-tie",
      label: "Rapidité d'arme contre incantation",
      combatants: [
        { id: "weapon", sort: 0, initiative: 5, action: { kind: "weapon", label: "Épée", segment: 5 } },
        { id: "spell", sort: 1, initiative: 5, action: { kind: "spell", label: "Bouclier", segment: 2 } }
      ],
      expected: { resolvedByAction: true, order: ["spell", "weapon"] }
    },
    {
      id: "magic-item-tie",
      label: "Pouvoir magique contre arme",
      combatants: [
        { id: "weapon-3", sort: 0, initiative: 3, action: { kind: "weapon", label: "Hache", segment: 3 } },
        { id: "power", sort: 1, initiative: 3, action: { kind: "item", label: "Baguette — Bouclier", segment: 1 } }
      ],
      expected: { resolvedByAction: true, order: ["power", "weapon-3"] }
    },
    {
      id: "incomplete-action",
      label: "Action incomplète conservant l'ordre stable",
      combatants: [
        { id: "complete", sort: 1, initiative: 2, action: { kind: "weapon", label: "Dague", segment: 2 } },
        { id: "incomplete", sort: 0, initiative: 2, action: { kind: "spell", label: "Sort", segment: null } }
      ],
      expected: { resolvedByAction: false, order: ["incomplete", "complete"] }
    }
  ].map(definition => runTieScenario(service, definition));

  try {
    const subject = mockCombatant({
      id: "surprised",
      initiative: 1,
      situation: { modifier: -2, surpriseSegments: 4, applyDexterityReaction: false }
    });
    const combat = { documentName: "Combat", started: true, round: 1, combatants: [subject] };
    const situation = service.situation(subject, combat);
    const context = service.actionContext(subject, null, combat);
    scenarios.push(scenarioResult(
      "situation-surprise",
      "Situation et surprise sans réaction DEX",
      { modifier: -2, surprise: 4, remaining: 4 },
      {
        modifier: Number(situation?.modifier ?? 0),
        surprise: Number(situation?.surpriseSegments ?? 0),
        remaining: Number(context?.situation?.remainingSurpriseSegments ?? 0)
      }
    ));
  } catch (error) {
    scenarios.push({ id: "situation-surprise", label: "Situation et surprise sans réaction DEX", ok: false, error: error.message });
  }

  try {
    const subject = mockCombatant({
      id: "expired",
      initiative: 1,
      action: { round: 1, kind: "weapon", label: "Ancienne arme", segment: 1 },
      situation: { round: 1, modifier: 3, surpriseSegments: 2 }
    });
    const combat = { documentName: "Combat", started: true, round: 2, combatants: [subject] };
    const situation = service.situation(subject, combat);
    scenarios.push(scenarioResult(
      "expired-round-data",
      "Données du round précédent ignorées",
      { action: null, modifier: 0, surprise: 0 },
      {
        action: service.declaredAction(subject, combat)?.label ?? null,
        modifier: Number(situation?.modifier ?? 0),
        surprise: Number(situation?.surpriseSegments ?? 0)
      }
    ));
  } catch (error) {
    scenarios.push({ id: "expired-round-data", label: "Données du round précédent ignorées", ok: false, error: error.message });
  }
  return scenarios;
}

export async function add2eValidateInitiativeLot2F({ combat = game.combat, rollScope = null, log = true } = {}) {
  const errors = [];
  const warnings = [];
  const service = game.add2e?.initiative ?? null;
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine ?? null;

  if (!combat?.combatants) errors.push("Aucun combat actif ou préparé n'est disponible.");
  if (!service) errors.push("Le service canonique game.add2e.initiative est indisponible.");
  for (const name of ["resolve", "roll", "order", "current", "declaredAction", "situation", "actionContext", "tieResolution", "skipReason"]) {
    if (typeof service?.[name] !== "function") errors.push(`Service d'initiative manquant : ${name}.`);
  }
  if (typeof engine?.resolve !== "function") errors.push("Le moteur canonique de modificateurs est indisponible.");

  const scenarios = runInitiativeScenarioValidation(service);
  scenarios
    .filter(scenario => !scenario.ok)
    .forEach(scenario => errors.push(`Scénario invalide : ${scenario.label}${scenario.error ? ` — ${scenario.error}` : ""}.`));

  const formula = String(CONFIG.Combat?.initiative?.formula ?? "");
  const decimals = Number(CONFIG.Combat?.initiative?.decimals);
  if (formula !== "1d6") errors.push(`Formule d'initiative inattendue : ${formula || "vide"}.`);
  if (decimals !== 0) errors.push(`Décimales d'initiative inattendues : ${Number.isFinite(decimals) ? decimals : "indéfinies"}.`);

  const normalizedScope = String(rollScope ?? "").trim().toLowerCase();
  if (normalizedScope) {
    if (!combat?.combatants || typeof service?.roll !== "function") {
      errors.push("Le jet demandé ne peut pas être exécuté sans combat et service canonique.");
    } else if (!game.user?.isGM && ["all", "monsters"].includes(normalizedScope)) {
      errors.push("Seul le MJ peut lancer collectivement l'initiative de tous ou des monstres.");
    } else if (!["all", "monsters", "missing"].includes(normalizedScope)) {
      errors.push(`Portée de jet inconnue : ${normalizedScope}.`);
    } else {
      const ids = validationScopeIds(combat, normalizedScope);
      if (!ids.length) warnings.push(`Aucun combattant ne correspond au jet « ${normalizedScope} ».`);
      else await service.roll(combat, ids, {
        updateTurn: false,
        messageMode: validationMessageMode()
      });
    }
  }

  const order = combat?.combatants && typeof service?.order === "function" ? service.order(combat) : getCombatOrder(combat);
  const rows = [];
  for (const [index, combatant] of order.entries()) {
    const actor = combatant?.actor ?? null;
    const flags = combatant?.flags?.add2e ?? {};
    const action = service?.declaredAction?.(combatant, combat) ?? null;
    const situation = service?.situation?.(combatant, combat) ?? null;
    let actionContext = null;
    let tie = null;
    let resolution = null;
    try { actionContext = service?.actionContext?.(combatant, actor, combat) ?? null; }
    catch (error) { errors.push(`${combatant.name ?? combatant.id} : contexte d'action impossible — ${error.message}.`); }
    try { tie = service?.tieResolution?.(combatant, combat) ?? null; }
    catch (error) { errors.push(`${combatant.name ?? combatant.id} : départage impossible — ${error.message}.`); }
    if (actor && typeof service?.resolve === "function" && typeof engine?.resolve === "function") {
      try {
        resolution = service.resolve(actor, { base: 0, combat, combatant, context: { source: "lot-2f-validation" } });
      } catch (error) {
        errors.push(`${combatant.name ?? combatant.id} : résolution impossible — ${error.message}.`);
      }
    }

    const legacyFields = validationLegacyActorFields(actor);
    if (legacyFields.length) errors.push(`${combatant.name ?? combatant.id} : champs historiques présents (${legacyFields.join(", ")}).`);
    if (flags.initiativeAction && !roundDataIsCurrent(flags.initiativeAction, combat)) errors.push(`${combatant.name ?? combatant.id} : action déclarée périmée encore enregistrée.`);
    if (flags.initiativeSituation && !roundDataIsCurrent(flags.initiativeSituation, combat)) errors.push(`${combatant.name ?? combatant.id} : situation d'initiative périmée encore enregistrée.`);
    if (action && ["weapon", "spell", "item"].includes(String(action.kind ?? "")) && !Number.isFinite(Number(action.segment))) {
      warnings.push(`${combatant.name ?? combatant.id} : action « ${action.label ?? action.kind} » sans segment comparable ; l'ordre stable sera conservé en cas d'égalité.`);
    }

    rows.push({
      index,
      id: combatant.id,
      name: combatant.name,
      actorType: actor?.type ?? "",
      initiative: validationScore(combatant.initiative),
      sort: combatant.sort,
      active: currentCombatant(combat)?.id === combatant.id,
      skipReason: service?.skipReason?.(combatant) ?? "",
      action: action?.label ?? "",
      actionType: action?.kind ?? "",
      segment: Number.isFinite(Number(action?.segment)) ? Number(action.segment) : null,
      situationModifier: Number(actionContext?.situation?.modifier ?? situation?.modifier ?? 0) || 0,
      surprise: Number(actionContext?.situation?.surpriseSegments ?? situation?.surpriseSegments ?? 0) || 0,
      surpriseRemaining: Number(actionContext?.situation?.remainingSurpriseSegments ?? 0) || 0,
      dexterityReaction: Number(actionContext?.situation?.dexterityReaction ?? 0) || 0,
      modifierTotal: Number(resolution?.total ?? 0) || 0,
      appliedModifiers: Array.from(resolution?.applied ?? [])
        .map(entry => entry?.modifier?.source?.name || entry?.modifier?.source?.id || entry?.modifier?.id)
        .filter(Boolean),
      tied: tie?.tied === true,
      tieResolvedByAction: tie?.resolvedByAction === true
    });
  }

  for (let index = 1; index < rows.length; index += 1) {
    const previous = rows[index - 1];
    const current = rows[index];
    if (previous.initiative === null && current.initiative !== null) {
      errors.push(`${current.name} possède une initiative mais apparaît après un combattant sans initiative.`);
    } else if (previous.initiative !== null && current.initiative !== null && previous.initiative < current.initiative) {
      errors.push(`Ordre décroissant invalide entre ${previous.name} (${previous.initiative}) et ${current.name} (${current.initiative}).`);
    }
    if (previous.initiative !== null && previous.initiative === current.initiative && previous.tieResolvedByAction
      && Number.isFinite(previous.segment) && Number.isFinite(current.segment) && previous.segment > current.segment) {
      errors.push(`Départage d'action invalide entre ${previous.name} (segment ${previous.segment}) et ${current.name} (segment ${current.segment}).`);
    }
  }

  const multipleAttackPhase = combat?.flags?.add2e?.[MULTIPLE_ATTACK_PHASE_FLAG] ?? null;
  if (multipleAttackPhase && !multipleAttackPhaseIsCurrent(combat)) {
    errors.push(`Phase d'attaques multiples périmée : round ${scopedRound(multipleAttackPhase)} pour le round ${Number(combat?.round ?? 0)}.`);
  }
  if (combat?.started && order.length) {
    const active = service?.current?.(combat) ?? currentCombatant(combat);
    const expected = order[Math.max(0, Math.min(order.length - 1, Number(combat.turn) || 0))] ?? null;
    if (active?.id !== expected?.id) errors.push(`Combattant actif incohérent : service=${active?.name ?? "aucun"}, ordre=${expected?.name ?? "aucun"}.`);
  }

  const report = {
    ok: errors.length === 0,
    version: ADD2E_INITIATIVE_VERSION,
    formula,
    decimals,
    started: combat?.started ?? false,
    round: combat?.round ?? null,
    turn: combat?.turn ?? null,
    active: currentCombatant(combat)?.name ?? null,
    multipleAttackPhase,
    rollScope: normalizedScope || null,
    errors,
    warnings,
    scenarios,
    rows
  };
  if (log) {
    const method = report.ok ? "info" : "error";
    console.groupCollapsed?.(`[ADD2E][INIT][LOT_2F_VALIDATION] ${report.ok ? "OK" : "ERREURS"}`);
    console[method]?.("Rapport", report);
    console.table?.(scenarios.map(scenario => ({
      scenario: scenario.label,
      ok: scenario.ok,
      attendu: JSON.stringify(scenario.expected ?? null),
      obtenu: JSON.stringify(scenario.actual ?? null),
      erreur: scenario.error ?? ""
    })));
    console.table?.(rows.map(row => ({
      ordre: row.index,
      combattant: row.name,
      type: row.actorType,
      initiative: row.initiative,
      action: row.action,
      segment: row.segment,
      situation: row.situationModifier,
      surprise: `${row.surprise}→${row.surpriseRemaining}`,
      reactionDEX: row.dexterityReaction,
      modificateurs: row.appliedModifiers.join(" ; "),
      saute: row.skipReason
    })));
    if (errors.length) console.error("Erreurs", errors);
    if (warnings.length) console.warn("Avertissements", warnings);
    console.groupEnd?.();
  }
  return report;
}

export function add2eInitiativeDebug(label = "debug", combat = game.combat) {
  const turns = getCombatOrder(combat);
  return {
    label,
    version: ADD2E_INITIATIVE_VERSION,
    rule: "high-first",
    started: combat?.started ?? null,
    round: combat?.round ?? null,
    turn: combat?.turn ?? null,
    current: combat?.current ?? null,
    active: currentCombatant(combat)?.name ?? null,
    turns: turns.map((combatant, index) => ({
      index,
      id: combatant.id,
      name: combatant.name,
      initiative: combatant.initiative,
      sort: combatant.sort,
      tokenId: combatant.tokenId
    }))
  };
}

export function installHooks() {
  if (initiativeState.hooksInstalled) return;
  initiativeState.hooksInstalled = true;

  Hooks.on("preUpdateToken", (tokenDoc, changes, options, userId) => {
    if (options?.add2eIgnoreTurnLock || !hasAnyProperty(changes, MOVEMENT_KEYS)) return;
    if (game.users?.get?.(userId)?.isGM) return;
    if (!canTokenInteractNow(tokenDoc, { notify: game.user?.id === userId })) return false;
  });
  Hooks.on("updateCombatant", (combatant, changes, options) => {
    if (!options?.add2eInitiativeSort && hasProperty(changes ?? {}, "initiative")) scheduleInitiativeSort(combatFor(combatant));
  });
  Hooks.on("createCombatant", (combatant, options) => { if (!options?.add2eInitiativeSort) scheduleInitiativeSort(combatFor(combatant)); });
  Hooks.on("deleteCombatant", (combatant, options) => { if (!options?.add2eInitiativeSort) scheduleInitiativeSort(combatFor(combatant)); });
  Hooks.on("updateCombat", (combat, changes, options) => {
    const startedChanged = hasProperty(changes ?? {}, "started");
    const roundChanged = hasProperty(changes ?? {}, "round");
    if (startedChanged || roundChanged) {
      const ended = startedChanged && !combat?.started;
      scheduleInitiativeRoundDataCleanup(combat, ended ? "combat-end" : "round-change", 10, { force: ended });
    }
    if (options?.add2eInitiativeSort || options?.add2eInitiativeNavigation) return;
    if (startedChanged && combat?.started) {
      scheduleLocalSync(combat, { delay: 80, selectToken: true, reason: "combat-start" });
      scheduleCanonicalTurnEvent(combat, "combat-start", 85);
      return;
    }
    if (hasAnyProperty(changes, ["turn", "round"])) {
      scheduleLocalSync(combat, { delay: 40, selectToken: true, reason: "combat-update" });
      scheduleCanonicalTurnEvent(combat, "combat-update", 45);
    }
  });
  Hooks.on("combatTurn", combat => {
    scheduleLocalSync(combat, { delay: 30, selectToken: true, reason: "combat-turn" });
    scheduleCanonicalTurnEvent(combat, "combat-turn", 35);
  });
  Hooks.on("combatRound", combat => {
    scheduleInitiativeRoundDataCleanup(combat, "combat-round", 10);
    scheduleLocalSync(combat, { delay: 30, selectToken: true, reason: "combat-round" });
    scheduleCanonicalTurnEvent(combat, "combat-round", 35);
  });
  Hooks.on("canvasReady", () => scheduleLocalSync(game.combat, { delay: 180, selectToken: false, reason: "refresh" }));
  Hooks.on("hoverToken", clearFoundryMovementTrailAggressive);
  Hooks.on("refreshToken", clearFoundryMovementTrailAggressive);
  Hooks.on("renderCombatTracker", (_app, html) => patchInitiativeIcons(html));
  Hooks.on("renderCombatantConfig", () => setTimeout(() => patchInitiativeIcons(document), 50));
  Hooks.on("renderSidebarTab", patchTrackerIcons);

  scheduleInitiativeRoundDataCleanup(game.combat, "ready", 0);
  globalThis.add2eCleanupInitiativeRoundData = cleanupInitiativeRoundData;
  globalThis.add2eValidateInitiativeLot2F = add2eValidateInitiativeLot2F;
  game.add2e ??= {};
  game.add2e.initiative ??= {};
  game.add2e.initiative.validate = add2eValidateInitiativeLot2F;
  installInitiativeChatCard();
}
