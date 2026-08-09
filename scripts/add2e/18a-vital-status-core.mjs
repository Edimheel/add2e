// ============================================================================
// ADD2E — États vitaux : constantes, lecture PV et règles métier.
// Version : 2026-08-09-vital-status-canonical-lethal-outcome-v5
// ============================================================================

export const ADD2E_VITAL_STATUS_CORE_VERSION = "2026-08-09-vital-status-canonical-lethal-outcome-v5";
export const ADD2E_RESURRECTION_RULES_VERSION = "2026-07-26-resurrection-constitution-v1";
export const ADD2E_NATURAL_REGENERATION_VERSION = "2026-07-26-natural-regeneration-v1";
export const ADD2E_LETHAL_OUTCOME_VERSION = "2026-08-09-canonical-lethal-outcome-v1";

export const ADD2E_VITAL_STATUS = {
  unconscious: { key: "unconscious", name: "Inconscient", icon: "icons/svg/daze.svg" },
  dead: { key: "dead", name: "Mort", icon: "icons/svg/skull.svg" }
};

export const ADD2E_VITAL_STATUS_EFFECT_IDS = {
  dead: "ADD2Edead0000000",
  unconscious: "ADD2Eunconsc0000"
};

export const ADD2E_VITAL_ICONS = new Set(Object.values(ADD2E_VITAL_STATUS).map(s => s.icon));

export function add2eVitalArray(value) {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(add2eVitalArray);
  if (value instanceof Set) return [...value];
  if (typeof value?.values === "function") return [...value.values()];
  if (typeof value === "object") return Object.values(value);
  return [value];
}

export function add2eVitalNorm(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9:_-]+/g, "_")
    .replace(/^_|_$/g, "");
}

export function add2eVitalNumber(value, fallback = NaN) {
  if (typeof value === "string") {
    const m = value.match(/-?\d+(?:[.,]\d+)?/);
    if (!m) return fallback;
    value = m[0].replace(",", ".");
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function add2eVitalActorType(actor) {
  return add2eVitalNorm(actor?.type);
}

function add2eVitalClone(value) {
  if (typeof foundry?.utils?.deepClone === "function") return foundry.utils.deepClone(value);
  if (typeof foundry?.utils?.duplicate === "function") return foundry.utils.duplicate(value);
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function add2eVitalIsMarkedLootCorpse(actor) {
  try {
    return actor?.getFlag?.("add2e", "isLootCorpse") === true;
  } catch (_error) {
    return actor?.flags?.add2e?.isLootCorpse === true;
  }
}

export function add2eVitalIsMonster(actor) {
  if (add2eVitalIsMarkedLootCorpse(actor)) return true;

  const values = [
    actor?.type,
    actor?.system?.type,
    actor?.system?.actorType,
    actor?.system?.details?.type,
    actor?.system?.details?.creatureType,
    actor?.system?.categorie,
    actor?.system?.category
  ].map(add2eVitalNorm);

  return values.some(v => ["monster", "monstre", "monsters", "monstres", "creature", "creature_monstre", "npc_monster"].includes(v));
}

function add2eVitalHitPointEngine() {
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine ?? null;
  if (
    !engine
    || typeof engine.readHitPoints !== "function"
    || typeof engine.readMaximumHitPoints !== "function"
    || typeof engine.setHitPoints !== "function"
    || typeof engine.applyHitPointHealing !== "function"
  ) {
    throw new Error("Le propriétaire canonique ADD2E des points de vie est indisponible.");
  }
  return engine;
}

export function add2eVitalReadHP(actor) {
  return add2eVitalHitPointEngine().readHitPoints(actor);
}

export function add2eVitalReadMaximumHP(actor) {
  return add2eVitalHitPointEngine().readMaximumHitPoints(actor) ?? 0;
}

export function add2eVitalHpUpdatePath() {
  return "system.pdv";
}

export function add2eVitalLethalHitPoints(actor) {
  const type = add2eVitalActorType(actor);
  if (type === "personnage" || type === "pnj") return -11;
  if (type === "monster" || type === "monstre" || add2eVitalIsMonster(actor)) return 0;
  return null;
}

export function add2eVitalDesiredStatus(actor) {
  const hp = add2eVitalReadHP(actor);
  const lethalHitPoints = add2eVitalLethalHitPoints(actor);
  const type = add2eVitalActorType(actor);

  if (type === "personnage" || type === "pnj") {
    if (lethalHitPoints !== null && hp <= lethalHitPoints) return "dead";
    if (hp <= 0) return "unconscious";
  } else if (lethalHitPoints !== null && hp <= lethalHitPoints) {
    return "dead";
  }

  return null;
}

export async function add2eApplyLethalOutcome(actor, {
  reason = "lethal-outcome",
  updates = {},
  updateOptions = {}
} = {}) {
  if (!actor?.system) return { applied: false, reason: "actor-missing" };
  const lethalHitPoints = add2eVitalLethalHitPoints(actor);
  if (lethalHitPoints === null) return { applied: false, reason: "actor-type-unsupported" };

  const engine = add2eVitalHitPointEngine();
  const before = Number(engine.readHitPoints(actor));
  const current = Number.isFinite(before) ? Math.min(before, lethalHitPoints) : lethalHitPoints;
  const mutation = await engine.setHitPoints(actor, {
    current,
    reason,
    updates,
    updateOptions: {
      ...updateOptions,
      add2eLethalOutcome: true
    }
  });

  return {
    applied: true,
    reason,
    lethalHitPoints,
    status: "dead",
    before: Number.isFinite(before) ? before : null,
    after: Number(mutation?.after ?? current),
    mutation
  };
}

export function add2eVitalStatusAliases(effect) {
  return [effect?.id, effect?._id, effect?.name, effect?.label, effect?.flags?.core?.statusId, effect?.flags?.add2e?.vitalStatus]
    .map(add2eVitalNorm)
    .filter(Boolean);
}

export function add2eVitalEffectStatuses(effect) {
  return new Set(add2eVitalArray(effect?.statuses ?? effect?.system?.statuses ?? effect?.flags?.core?.statusId ?? []).map(add2eVitalNorm).filter(Boolean));
}

export function add2eVitalEffectFlag(effect) {
  const flags = effect?.flags?.add2e ?? {};
  const values = [
    flags.vitalStatus,
    flags.status,
    flags.etat,
    flags.autoVitalStatus === true ? "autoVitalStatus" : "",
    typeof effect?.getFlag === "function" ? effect.getFlag("add2e", "vitalStatus") : null,
    typeof effect?.getFlag === "function" && effect.getFlag("add2e", "autoVitalStatus") === true ? "autoVitalStatus" : ""
  ];
  return values.map(add2eVitalNorm).find(v => ["dead", "unconscious", "mort", "inconscient", "autovitalstatus"].includes(v)) ?? "";
}

export function add2eVitalEffectKind(effect) {
  const name = add2eVitalNorm(effect?.name ?? effect?.label ?? "");
  const statuses = add2eVitalEffectStatuses(effect);
  const flag = add2eVitalEffectFlag(effect);
  if (flag === "dead" || flag === "mort") return "dead";
  if (flag === "unconscious" || flag === "inconscient") return "unconscious";
  if (flag === "autovitalstatus") return "vital";
  if (name === "mort" || name === "dead" || name === "etat_mort") return "dead";
  if (name === "inconscient" || name === "unconscious" || name === "etat_inconscient") return "unconscious";
  if (statuses.has("dead") || statuses.has("mort")) return "dead";
  if (statuses.has("unconscious") || statuses.has("inconscient")) return "unconscious";
  return null;
}

function add2eVitalActorIsDead(actor) {
  if (add2eVitalDesiredStatus(actor) === "dead") return true;
  return Array.from(actor?.effects ?? []).some(effect => !effect?.disabled && add2eVitalEffectKind(effect) === "dead");
}

function add2eVitalEngine() {
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine ?? null;
  if (!engine || typeof engine.resolveAbilityDerived !== "function" || typeof engine.createModifier !== "function") {
    throw new Error("Le moteur canonique ADD2E des caractéristiques n’est pas disponible.");
  }
  return engine;
}

function add2eVitalActorModifiers(actor) {
  const raw = actor?.flags?.add2e?.modifiers;
  if (Array.isArray(raw)) return add2eVitalClone(raw);
  if (raw && typeof raw === "object") return add2eVitalClone(Object.values(raw));
  return [];
}

function add2eResurrectionModifierId(actor) {
  return `${actor?.id ?? "actor"}:constitution:resurrection-penalty`;
}

function add2eResurrectionState(actor) {
  const raw = actor?.flags?.add2e?.resurrection;
  return raw && typeof raw === "object" ? add2eVitalClone(raw) : {};
}

function add2eResurrectionModifier(actor, successes) {
  return add2eVitalEngine().createModifier({
    id: add2eResurrectionModifierId(actor),
    domain: "ability",
    target: "constitution",
    operation: "add",
    value: -Math.max(0, Math.trunc(Number(successes) || 0)),
    priority: 100,
    stacking: { mode: "unique-source", group: "ability:constitution:resurrection" },
    source: {
      kind: "rule",
      id: `${actor.id}:resurrection`,
      uuid: actor.uuid ?? "",
      name: "Résurrections successives"
    },
    metadata: {
      label: "Perte permanente de Constitution après résurrection",
      permanent: true,
      resurrectionPenalty: true
    }
  });
}

async function add2eVitalCreateCard(card) {
  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    throw new Error("Les constructeurs communs de cartes ADD2E sont indisponibles.");
  }
  globalThis.add2eBuildChatCard(card);
  return globalThis.add2eCreateChatCard(card);
}

export async function add2eAttemptResurrection({
  targetActor,
  casterActor = null,
  sourceItem = null,
  sourceToken = null,
  source = "resurrection"
} = {}) {
  if (!targetActor?.system) return { attempted: false, consumed: false, reason: "target-missing" };
  if (!add2eVitalActorIsDead(targetActor)) return { attempted: false, consumed: false, reason: "target-not-dead" };

  const state = add2eResurrectionState(targetActor);
  if (state.permanentDeath === true) return { attempted: false, consumed: false, reason: "permanent-death", state };

  const engine = add2eVitalEngine();
  const constitution = engine.resolveAbilityDerived(targetActor, "constitution", {
    source: `${source}:eligibility`,
    consumer: "resurrection-limit",
    casterActor,
    sourceItem
  });
  const initialConstitution = Math.max(1, Math.trunc(Number(state.initialConstitution ?? constitution?.total) || 1));
  const successes = Math.max(0, Math.trunc(Number(state.successes) || 0));
  if (successes >= initialConstitution) {
    return { attempted: false, consumed: false, reason: "resurrection-limit", initialConstitution, successes, state };
  }
  if (typeof globalThis.add2eRollResurrectionSurvivalCard !== "function") {
    throw new Error("Le test canonique de survie à la résurrection est indisponible.");
  }

  const rollResult = await globalThis.add2eRollResurrectionSurvivalCard(targetActor, {
    source,
    casterActor,
    sourceItem,
    actionType: "save",
    saveType: "resurrection"
  });
  const spellName = sourceItem?.name ?? "Résurrection";
  const now = Date.now();

  if (!rollResult.success) {
    const nextState = {
      ...state,
      version: ADD2E_RESURRECTION_RULES_VERSION,
      initialConstitution,
      successes,
      failures: Math.max(0, Math.trunc(Number(state.failures) || 0)) + 1,
      permanentDeath: true,
      lastAttemptAt: now,
      lastAttemptSource: sourceItem?.uuid ?? source,
      lastAttemptResult: "failure"
    };
    await add2eApplyLethalOutcome(targetActor, {
      reason: "resurrection-survival-failure",
      updates: { "flags.add2e.resurrection": nextState },
      updateOptions: { add2eResurrection: true }
    });
    await add2eVitalCreateCard({
      actor: targetActor,
      title: `${spellName} — mort définitive`,
      icon: sourceItem?.img ?? "icons/svg/skull.svg",
      variant: "failure",
      source: {
        name: casterActor?.name ?? spellName,
        img: sourceItem?.img ?? casterActor?.img,
        type: "Résurrection"
      },
      rows: [
        { label: "Cible", value: targetActor.name },
        { label: "Jet", value: `${rollResult.total} / ${rollResult.threshold} %` },
        { label: "Résurrections réussies", value: `${successes} / ${initialConstitution}` },
        { label: "Résultat", value: "Échec : la créature ne peut plus être ressuscitée" }
      ],
      chatData: {
        speaker: ChatMessage.getSpeaker({ actor: casterActor ?? targetActor, token: sourceToken ?? null }),
        flags: {
          add2e: {
            chatCardType: "resurrection-outcome",
            resurrectionRulesVersion: ADD2E_RESURRECTION_RULES_VERSION,
            targetActorUuid: targetActor.uuid,
            success: false,
            permanentDeath: true,
            initialConstitution,
            successes
          }
        }
      }
    });
    return { attempted: true, consumed: true, success: false, permanentDeath: true, rollResult, state: nextState };
  }

  const nextSuccesses = successes + 1;
  const modifiers = add2eVitalActorModifiers(targetActor)
    .filter(modifier => String(modifier?.id ?? "") !== add2eResurrectionModifierId(targetActor));
  modifiers.push(add2eResurrectionModifier(targetActor, nextSuccesses));
  const nextState = {
    ...state,
    version: ADD2E_RESURRECTION_RULES_VERSION,
    initialConstitution,
    successes: nextSuccesses,
    failures: Math.max(0, Math.trunc(Number(state.failures) || 0)),
    permanentDeath: false,
    lastAttemptAt: now,
    lastAttemptSource: sourceItem?.uuid ?? source,
    lastAttemptResult: "success"
  };

  await targetActor.update({
    "flags.add2e.modifiers": modifiers,
    "flags.add2e.resurrection": nextState
  }, {
    add2eInternal: true,
    add2eReason: "resurrection-constitution-loss",
    add2eResurrection: true
  });

  if (typeof targetActor.sheet?.autoSetCaracAjustements === "function") {
    await targetActor.sheet.autoSetCaracAjustements();
  }
  await engine.setHitPoints(targetActor, {
    current: 1,
    reason: "resurrection-restore-life",
    updateOptions: { add2eResurrection: true }
  });

  const afterConstitution = engine.resolveAbilityDerived(targetActor, "constitution", {
    source: `${source}:result`,
    consumer: "resurrection-result",
    casterActor,
    sourceItem
  });
  await add2eVitalCreateCard({
    actor: targetActor,
    title: `${spellName} — réussite`,
    icon: sourceItem?.img ?? "icons/svg/regen.svg",
    variant: "success",
    source: {
      name: casterActor?.name ?? spellName,
      img: sourceItem?.img ?? casterActor?.img,
      type: "Résurrection"
    },
    rows: [
      { label: "Cible", value: targetActor.name },
      { label: "Jet", value: `${rollResult.total} / ${rollResult.threshold} %` },
      { label: "PV restaurés", value: "1" },
      { label: "Constitution", value: `${constitution?.total ?? "—"} → ${afterConstitution?.total ?? "—"}` },
      { label: "Résurrections réussies", value: `${nextSuccesses} / ${initialConstitution}` }
    ],
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor: casterActor ?? targetActor, token: sourceToken ?? null }),
      flags: {
        add2e: {
          chatCardType: "resurrection-outcome",
          resurrectionRulesVersion: ADD2E_RESURRECTION_RULES_VERSION,
          targetActorUuid: targetActor.uuid,
          success: true,
          permanentDeath: false,
          initialConstitution,
          successes: nextSuccesses,
          constitutionBefore: Number(constitution?.total) || null,
          constitutionAfter: Number(afterConstitution?.total) || null
        }
      }
    }
  });

  return {
    attempted: true,
    consumed: true,
    success: true,
    permanentDeath: false,
    rollResult,
    initialConstitution,
    successes: nextSuccesses,
    constitutionBefore: constitution,
    constitutionAfter: afterConstitution,
    state: nextState
  };
}

export function add2eNaturalRegenerationInterval(profile) {
  const raw = String(profile ?? "").trim().toLowerCase();
  if (!raw) return 0;
  if (/^1\s*\/\s*tours?$/.test(raw)) return 10;
  const match = raw.match(/^1\s*\/\s*(\d+)\s*tours?$/);
  if (!match) return 0;
  return Math.max(1, Math.trunc(Number(match[1]) || 0)) * 10;
}

async function add2eNaturalRegenerationCard(actor, healed, current, maximum, intervalRounds, reason) {
  return add2eVitalCreateCard({
    actor,
    title: "Régénération naturelle",
    icon: "icons/magic/life/heart-cross-strong-green.webp",
    variant: "healing",
    source: {
      name: actor.name,
      img: actor.img,
      type: "Constitution exceptionnelle"
    },
    rows: [
      { label: "PV régénérés", value: healed },
      { label: "PV", value: `${current} / ${maximum}` },
      { label: "Intervalle", value: `${intervalRounds} rounds` }
    ],
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor }),
      flags: {
        add2e: {
          chatCardType: "natural-regeneration",
          naturalRegenerationVersion: ADD2E_NATURAL_REGENERATION_VERSION,
          actorUuid: actor.uuid,
          healed,
          current,
          maximum,
          intervalRounds,
          reason
        }
      }
    }
  });
}

export async function add2eApplyNaturalRegeneration(actor, {
  beforeTick = 0,
  afterTick = 0,
  reason = "time-advance"
} = {}) {
  if (!game.user?.isGM) return { applied: false, reason: "not-gm" };
  if (!actor?.system) return { applied: false, reason: "actor-missing" };

  const engine = add2eVitalEngine();
  const constitution = engine.resolveAbilityDerived(actor, "constitution", {
    source: "natural-regeneration",
    consumer: "time-engine",
    reason
  });
  const profile = constitution?.profile?.regeneration ?? null;
  const intervalRounds = add2eNaturalRegenerationInterval(profile);
  const before = Math.max(0, Math.trunc(Number(beforeTick) || 0));
  const after = Math.max(before, Math.trunc(Number(afterTick) || 0));
  if (intervalRounds <= 0) {
    if (actor.flags?.add2e?.naturalRegeneration) {
      await actor.update({
        "flags.add2e.naturalRegeneration": {
          version: ADD2E_NATURAL_REGENERATION_VERSION,
          profile: "",
          intervalRounds: 0,
          constitution: Number(constitution?.total) || null,
          lastTick: after,
          updatedAt: Date.now(),
          reason
        }
      }, {
        add2eInternal: true,
        add2eReason: "natural-regeneration-disabled",
        add2eNaturalRegeneration: true
      });
    }
    return { applied: false, reason: "no-regeneration", profile, before, after };
  }

  if (after <= before) return { applied: false, reason: "no-time", before, after, intervalRounds };

  const rawState = actor.flags?.add2e?.naturalRegeneration;
  const state = rawState && typeof rawState === "object" ? add2eVitalClone(rawState) : {};
  const sameInterval = Number(state.intervalRounds) === intervalRounds;
  const storedTick = Number(state.lastTick);
  const lastTick = sameInterval && Number.isFinite(storedTick) ? Math.min(after, Math.max(0, Math.trunc(storedTick))) : before;
  const current = add2eVitalReadHP(actor);
  const maximum = add2eVitalReadMaximumHP(actor);
  const nextStateBase = {
    version: ADD2E_NATURAL_REGENERATION_VERSION,
    profile: String(profile),
    intervalRounds,
    constitution: Number(constitution?.total) || null,
    updatedAt: Date.now(),
    reason
  };

  if (!Number.isFinite(current) || !Number.isFinite(maximum) || maximum <= 0) {
    return { applied: false, reason: "hp-invalid", current, maximum, intervalRounds };
  }

  if (current <= 0 || current >= maximum) {
    await actor.update({
      "flags.add2e.naturalRegeneration": { ...nextStateBase, lastTick: after }
    }, {
      add2eInternal: true,
      add2eReason: "natural-regeneration-checkpoint",
      add2eNaturalRegeneration: true
    });
    return {
      applied: false,
      reason: current <= 0 ? "not-living" : "full-hit-points",
      current,
      maximum,
      intervalRounds,
      lastTick: after
    };
  }

  const elapsed = Math.max(0, after - lastTick);
  const intervals = Math.floor(elapsed / intervalRounds);
  if (intervals <= 0) {
    if (!rawState || !sameInterval) {
      await actor.update({
        "flags.add2e.naturalRegeneration": { ...nextStateBase, lastTick }
      }, {
        add2eInternal: true,
        add2eReason: "natural-regeneration-initialize",
        add2eNaturalRegeneration: true
      });
    }
    return { applied: false, reason: "interval-pending", current, maximum, intervalRounds, elapsed, lastTick };
  }

  const missing = Math.max(0, maximum - current);
  const requestedHealing = Math.min(missing, intervals);
  const predictedCurrent = Math.min(maximum, current + requestedHealing);
  const reachedMaximum = predictedCurrent >= maximum;
  const nextLastTick = reachedMaximum ? after : lastTick + (intervals * intervalRounds);
  const mutation = await engine.applyHitPointHealing(actor, requestedHealing, {
    reason: "natural-regeneration-heal",
    updates: {
      "flags.add2e.naturalRegeneration": { ...nextStateBase, lastTick: nextLastTick }
    },
    updateOptions: { add2eNaturalRegeneration: true }
  });
  const healed = Number(mutation.effective) || 0;
  const nextCurrent = Number(mutation.after);
  if (healed > 0) await add2eNaturalRegenerationCard(actor, healed, nextCurrent, maximum, intervalRounds, reason);

  return {
    applied: healed > 0,
    reason: healed > 0 ? "healed" : "no-healing",
    healed,
    before: current,
    after: nextCurrent,
    maximum,
    intervalRounds,
    intervals,
    lastTick: nextLastTick,
    profile,
    constitution
  };
}

globalThis.ADD2E_RESURRECTION_RULES_VERSION = ADD2E_RESURRECTION_RULES_VERSION;
globalThis.ADD2E_NATURAL_REGENERATION_VERSION = ADD2E_NATURAL_REGENERATION_VERSION;
globalThis.ADD2E_LETHAL_OUTCOME_VERSION = ADD2E_LETHAL_OUTCOME_VERSION;
globalThis.add2eAttemptResurrection = add2eAttemptResurrection;
globalThis.add2eApplyNaturalRegeneration = add2eApplyNaturalRegeneration;
globalThis.add2eApplyLethalOutcome = add2eApplyLethalOutcome;