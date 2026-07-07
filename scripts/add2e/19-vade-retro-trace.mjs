// ============================================================================
// ADD2E — Trace temporaire Vade-rétro.
// Compatible Foundry V13 / V14 / V15.
// À retirer après identification du défaut de continuation joueur.
// ============================================================================

const TAG = "[ADD2E][VADE-RETRO][TRACE]";
const FLAG_SCOPE = "add2e";
const FLAG_KEY = "vadeRetro";
const CONTEXTS_KEY = "__ADD2E_VADE_RETRO_CONTINUATION_CONTEXTS";
const WRAPPED_KEY = "__add2eVadeRetroTraceWrapped";

function enabled() {
  return globalThis.ADD2E_DEBUG_VADE_RETRO !== false;
}

function trace(event, data = {}) {
  if (!enabled()) return;
  console.log(`${TAG}[${event}]`, data);
}

function traceError(event, error, data = {}) {
  if (!enabled()) return;
  console.error(`${TAG}[${event}]`, { ...data, error });
}

console.log(`${TAG}[MODULE_LOADED]`, { ready: game?.ready ?? false, userId: game?.user?.id ?? null, isGM: game?.user?.isGM ?? false });

function stateFor(actor, combat) {
  const all = actor?.getFlag?.(FLAG_SCOPE, FLAG_KEY) ?? actor?.flags?.[FLAG_SCOPE]?.[FLAG_KEY] ?? {};
  return combat?.id ? all?.[combat.id] ?? null : null;
}

function stateSummary(actor, combat = game.combat) {
  const state = stateFor(actor, combat);
  return {
    actor: actor?.name ?? null,
    actorId: actor?.id ?? null,
    owner: actor?.isOwner ?? false,
    combatId: combat?.id ?? null,
    combatRound: Number(combat?.round ?? 0) || 0,
    status: state?.status ?? null,
    lastRound: state?.lastRound ?? null,
    initiatorUserId: state?.initiatorUserId ?? null,
    pendingGroups: Array.isArray(state?.pending) ? state.pending.length : 0,
    pendingTargets: Array.isArray(state?.pending) ? state.pending.reduce((total, group) => total + (Array.isArray(group?.ids) ? group.ids.length : 0), 0) : 0,
    featureKey: state?.featureKey ?? null,
    featureOnUse: state?.featureOnUse ?? null,
    direction: state?.direction ?? null
  };
}

function continuationContext(actor, combat = game.combat) {
  return globalThis[CONTEXTS_KEY]?.get?.(`${actor?.id ?? ""}:${combat?.id ?? ""}`) ?? null;
}

function isVadeFeature(feature) {
  const onUse = String(feature?.on_use ?? feature?.onUse ?? feature?.script ?? feature?.macro ?? "");
  const label = String(feature?.name ?? feature?.label ?? feature?.slug ?? feature?.key ?? "");
  return /vade-retro\.js(?:$|[?#])/i.test(onUse) || /vade[\s_-]*retro/i.test(label);
}

function vadeActors(combat = game.combat) {
  const seen = new Set();
  const actors = [];
  for (const combatant of Array.from(combat?.combatants ?? [])) {
    const actor = combatant?.actor ?? combatant?.token?.actor ?? null;
    if (!actor || seen.has(actor.id)) continue;
    seen.add(actor.id);
    const state = stateFor(actor, combat);
    if (state) actors.push(stateSummary(actor, combat));
  }
  return actors;
}

function stopReasons(state, localUserId, isGM) {
  const reasons = [];
  if (isGM) reasons.push("local-user-is-gm");
  if (state.status !== "pending") reasons.push(`status-${state.status ?? "absent"}`);
  if (Number(state.lastRound ?? state.combatRound) >= Number(state.combatRound)) reasons.push("round-already-handled");
  if (String(state.initiatorUserId ?? "") !== String(localUserId ?? "")) reasons.push("initiator-is-another-user");
  if (!state.owner) reasons.push("actor-not-owned-locally");
  if (!state.pendingGroups || !state.pendingTargets) reasons.push("pending-queue-empty");
  return reasons;
}

function traceRound(combat, changed, source) {
  const currentRound = Number(combat?.round ?? changed?.round ?? 0) || 0;
  const states = vadeActors(combat);
  const localUserId = game.user?.id ?? null;
  const isGM = game.user?.isGM ?? false;
  trace("ROUND_UPDATE", {
    source,
    localUserId,
    isGM,
    changedRound: changed?.round ?? null,
    combatId: combat?.id ?? null,
    currentRound,
    vadeActors: states
  });
  if (isGM || !states.length) {
    trace("STOP_NO_LOCAL_PENDING", { source, reason: isGM ? "local-user-is-gm" : "no-vade-state-on-combatants", combatId: combat?.id ?? null, currentRound });
    return;
  }
  for (const state of states) {
    const reasons = stopReasons(state, localUserId, isGM);
    if (reasons.length) trace("STOP_STATE_FILTER", { source, reasons, state });
    else trace("PLAYER_CANDIDATE", { source, state });
  }
}

function wrapClassExecutor() {
  const original = globalThis.add2eExecuteClassFeatureOnUse;
  if (typeof original !== "function") {
    trace("STOP_EXECUTOR_UNAVAILABLE", { type: typeof original });
    return false;
  }
  if (original[WRAPPED_KEY]) return true;

  const wrapped = async function add2eVadeRetroTracedClassExecutor(actor, feature, token, ...rest) {
    if (!isVadeFeature(feature)) return original.call(this, actor, feature, token, ...rest);
    const combat = game.combat;
    const before = stateSummary(actor, combat);
    const context = continuationContext(actor, combat);
    trace("EXECUTOR_ENTER", {
      localUserId: game.user?.id ?? null,
      isGM: game.user?.isGM ?? false,
      feature: feature?.name ?? feature?.label ?? null,
      onUse: feature?.on_use ?? feature?.onUse ?? feature?.script ?? null,
      before,
      context: context ? {
        kind: context.kind ?? null,
        requestId: context.requestId ?? null,
        round: context.round ?? null,
        initiatorUserId: context.initiatorUserId ?? null,
        hasVadeState: !!context.vadeState,
        contextPendingGroups: Array.isArray(context.vadeState?.pending) ? context.vadeState.pending.length : null
      } : null
    });
    try {
      const result = await original.call(this, actor, feature, token, ...rest);
      const after = stateSummary(actor, combat);
      trace("EXECUTOR_RESULT", { result, after, contextStillPresent: !!continuationContext(actor, combat) });
      if (result === false) trace("STOP_ONUSE_RETURNED_FALSE", { before, after, contextStillPresent: !!continuationContext(actor, combat) });
      return result;
    } catch (error) {
      traceError("STOP_ONUSE_THROW", error, { after: stateSummary(actor, combat) });
      throw error;
    }
  };

  Object.defineProperty(wrapped, WRAPPED_KEY, { value: true });
  Object.defineProperty(wrapped, "__add2eVadeRetroTraceOriginal", { value: original });
  globalThis.add2eExecuteClassFeatureOnUse = wrapped;
  trace("EXECUTOR_WRAPPED", { version: game.add2e?.roundEngineVersion ?? null });
  return true;
}

function registerTraceHooks() {
  if (globalThis.__ADD2E_VADE_RETRO_TRACE_REGISTERED) return;
  globalThis.__ADD2E_VADE_RETRO_TRACE_REGISTERED = true;
  globalThis.ADD2E_DEBUG_VADE_RETRO = globalThis.ADD2E_DEBUG_VADE_RETRO !== false;

  for (const wait of [0, 100, 500, 1500]) setTimeout(wrapClassExecutor, wait);

  Hooks.on("updateCombat", (combat, changed = {}, options, userId) => {
    if (!Object.prototype.hasOwnProperty.call(changed, "round")) return;
    traceRound(combat, changed, "updateCombat");
    setTimeout(() => traceRound(combat, changed, "updateCombat+250ms"), 250);
  });

  Hooks.on("createChatMessage", message => {
    const content = String(message?.content ?? "");
    if (!/add2e-vade-retro-card|Vade-rétro/i.test(content)) return;
    trace("CHAT_CARD", {
      speaker: message?.speaker?.alias ?? null,
      authorId: message?.author?.id ?? message?.user?.id ?? null,
      combatId: game.combat?.id ?? null,
      round: game.combat?.round ?? null
    });
  });

  Hooks.on("createActiveEffect", effect => {
    const tags = effect?.flags?.add2e?.tags ?? [];
    const text = Array.isArray(tags) ? tags.join("|") : String(tags);
    if (!/vade_retro|vade-retro/i.test(text) && !/Vade-rétro/i.test(String(effect?.name ?? ""))) return;
    trace("ACTIVE_EFFECT_CREATED", {
      actor: effect?.parent?.name ?? null,
      actorId: effect?.parent?.id ?? null,
      effect: effect?.name ?? null,
      tags,
      round: game.combat?.round ?? null
    });
  });

  Hooks.on("updateActor", (actor, changed = {}, options) => {
    const stateChanged = changed?.flags?.add2e?.vadeRetro !== undefined;
    if (!stateChanged) return;
    trace("VADE_STATE_SYNC", { state: stateSummary(actor), options });
  });

  trace("REGISTERED", {
    enabled: enabled(),
    localUserId: game.user?.id ?? null,
    isGM: game.user?.isGM ?? false,
    roundEngineVersion: game.add2e?.roundEngineVersion ?? null
  });
}

if (game?.ready) registerTraceHooks();
else Hooks.once("ready", registerTraceHooks);
