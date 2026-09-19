// ADD2E — Actions raciales génériques déclarées dans system.racialProfile.capabilities.
// Compatible Foundry V13/V14/V15.

import { add2eTimeEffectData } from "./19a-time-engine.mjs";

export const ADD2E_RACIAL_CAPABILITY_ACTIONS_VERSION = "2026-09-19-target-save-effect-v1";
globalThis.ADD2E_RACIAL_CAPABILITY_ACTIONS_VERSION = ADD2E_RACIAL_CAPABILITY_ACTIONS_VERSION;

const TARGET_SAVE_EFFECT = "target-save-effect";
let add2eRacialCapabilityActionsInstalled = false;

function clone(value) {
  if (value === undefined || value === null) return value;
  try { return foundry.utils.deepClone(value); } catch (_error) {}
  try { return foundry.utils.duplicate(value); } catch (_error) {}
  return JSON.parse(JSON.stringify(value));
}

function records(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value && typeof value === "object") return Object.values(value).filter(Boolean);
  return [];
}

function normalize(engine, value) {
  if (typeof engine?.normalizeTag === "function") return String(engine.normalizeTag(value) ?? "").replace(/-/g, "_");
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function directRaceItem(actor) {
  const races = Array.from(actor?.items ?? []).filter(item => String(item?.type ?? "").toLowerCase() === "race");
  return races.length === 1 ? races[0] : null;
}

function rawCapability(engine, actor, capabilityId) {
  const wanted = normalize(engine, capabilityId);
  const profile = engine?.getRacialContext?.(actor)?.profile ?? directRaceItem(actor)?.system?.racialProfile ?? null;
  return records(profile?.capabilities).find(entry => normalize(engine, entry?.id ?? entry?.key) === wanted) ?? null;
}

function targetSaveEffectConfigured(engine, raw) {
  if (normalize(engine, raw?.kind ?? raw?.actionType) !== "target_save_effect") return false;
  const targetMode = normalize(engine, raw?.target?.mode ?? "single");
  const saveType = String(raw?.save?.type ?? raw?.save?.key ?? raw?.save?.index ?? "").trim();
  const effect = raw?.effect;
  return targetMode === "single"
    && Boolean(saveType)
    && effect && typeof effect === "object"
    && Boolean(String(effect.name ?? raw?.label ?? "").trim());
}

function targetSaveEffectLabel(raw) {
  const saveType = String(raw?.save?.label ?? raw?.save?.type ?? "Sauvegarde").trim();
  return saveType ? `JS ${saveType}` : "Action ciblée";
}

function decorateRacialCapabilities(engine, actor, capabilities = []) {
  return capabilities.map(capability => {
    const raw = rawCapability(engine, actor, capability?.id);
    if (!targetSaveEffectConfigured(engine, raw)) return capability;
    return {
      ...capability,
      ...clone(raw),
      id: String(capability?.id ?? raw?.id ?? "").trim(),
      key: capability?.key ?? normalize(engine, raw?.id),
      label: String(raw?.label ?? capability?.label ?? raw?.id ?? "Capacité raciale").trim(),
      description: String(raw?.description ?? capability?.description ?? "").trim(),
      actionType: TARGET_SAVE_EFFECT,
      activable: raw?.activable !== false,
      canRoll: false,
      formula: "",
      successAt: null,
      rollLabel: targetSaveEffectLabel(raw),
      iconClass: String(raw?.iconClass ?? capability?.iconClass ?? "fa-bolt").trim() || "fa-bolt"
    };
  });
}

function sourceActorAllowed(actor) {
  if (!actor) return false;
  return game.user?.isGM === true
    || actor.isOwner === true
    || actor.testUserPermission?.(game.user, "OWNER") === true;
}

function selectedTargetTokens() {
  return Array.from(game.user?.targets ?? []).filter(token => token?.actor);
}

function renderMessage(template, sourceActor, targetActor) {
  return String(template ?? "")
    .replaceAll("{source}", String(sourceActor?.name ?? "le personnage"))
    .replaceAll("{target}", String(targetActor?.name ?? "la cible"));
}

function requireChatApi() {
  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    throw new Error("Les constructeurs communs de cartes ADD2E sont indisponibles.");
  }
}

function requireSavingThrowApi() {
  if (typeof globalThis.add2eRollSavingThrow !== "function") {
    throw new Error("L’exécuteur canonique ADD2E des sauvegardes est indisponible.");
  }
}

function effectSource(engine, actor, sourceItem, capability) {
  return {
    kind: "race",
    id: String(sourceItem?.id ?? `${actor?.id ?? "actor"}:${capability?.id ?? "racial-capability"}`),
    uuid: String(sourceItem?.uuid ?? actor?.uuid ?? ""),
    name: String(capability?.label ?? sourceItem?.name ?? "Capacité raciale")
  };
}

function canonicalEffectModifiers(engine, actor, sourceItem, capability, activationId) {
  const source = effectSource(engine, actor, sourceItem, capability);
  return records(capability?.effect?.modifiers).map((raw, index) => {
    const entry = clone(raw) ?? {};
    entry.id = String(entry.id ?? `${activationId}:${normalize(engine, capability?.id)}:${index}`);
    return engine.createModifier(entry, { source });
  });
}

async function durationRoll(effect = {}) {
  const formula = String(effect.durationFormula ?? effect.duration?.formula ?? "").trim();
  const fixed = Number(effect.durationRounds ?? effect.duration?.rounds);
  if (!formula) {
    return {
      rounds: Number.isFinite(fixed) && fixed > 0 ? Math.max(1, Math.floor(fixed)) : 0,
      roll: null,
      formula: Number.isFinite(fixed) && fixed > 0 ? String(Math.floor(fixed)) : ""
    };
  }
  const roll = await new Roll(formula).evaluate();
  if (game.dice3d) await game.dice3d.showForRoll(roll);
  const rounds = Math.max(1, Math.floor(Number(roll.total) || 1));
  return { rounds, roll, formula };
}

function buildEffectData(engine, actor, targetActor, capability, duration) {
  const sourceItem = directRaceItem(actor);
  const effect = capability.effect ?? {};
  const activationId = `${actor?.id ?? "actor"}:${capability?.id ?? "racial"}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
  const modifiers = canonicalEffectModifiers(engine, actor, sourceItem, capability, activationId);
  const tags = records(effect.tags).map(String).filter(Boolean);
  const data = add2eTimeEffectData({
    name: String(effect.name ?? capability.label ?? "Effet racial"),
    img: effect.img ?? effect.icon ?? "icons/svg/aura.svg",
    origin: sourceItem?.uuid ?? actor?.uuid ?? null,
    rounds: duration.rounds,
    unit: "round",
    description: String(effect.description ?? capability.description ?? ""),
    tags,
    changes: [],
    source: "race",
    caster: actor,
    sourceItem,
    endMessage: String(effect.endMessage ?? "").trim() || null,
    silentExpiration: effect.silentExpiration === true,
    extraFlags: {
      racialCapabilityAction: true,
      racialCapabilityId: String(capability.id ?? ""),
      racialCapabilityKind: TARGET_SAVE_EFFECT,
      sourceType: "race",
      sourceActorUuid: actor?.uuid ?? null,
      sourceItemId: sourceItem?.id ?? null,
      sourceItemUuid: sourceItem?.uuid ?? null,
      targetActorUuid: targetActor?.uuid ?? null,
      activationId,
      modifiers
    }
  });

  const statusId = String(effect.statusId ?? "").trim();
  if (statusId) {
    data.statuses = [statusId];
    data.flags ??= {};
    data.flags.core = {
      ...(data.flags.core ?? {}),
      statusId,
      overlay: effect.overlay === true
    };
  }
  return data;
}

async function applyEffectToTarget(targetActor, targetToken, effectData) {
  if (game.user?.isGM === true || targetActor?.isOwner === true) {
    const created = await targetActor.createEmbeddedDocuments("ActiveEffect", [effectData]);
    return { applied: Boolean(created?.length), effect: created?.[0] ?? null, relayed: false };
  }

  if (!game.socket?.emit) throw new Error("Le relais MJ ADD2E est indisponible pour appliquer l’effet racial.");
  game.socket.emit("system.add2e", {
    type: "ADD2E_GM_OPERATION",
    operation: "createActiveEffect",
    payload: {
      actorId: targetActor?.id ?? null,
      actorUuid: targetActor?.uuid ?? null,
      sceneId: canvas?.scene?.id ?? null,
      tokenId: targetToken?.id ?? targetToken?.document?.id ?? null,
      effectData,
      fromUserId: game.user?.id ?? null
    }
  });
  return { applied: true, effect: null, relayed: true };
}

function saveModifierDetail(save) {
  const applied = save?.resolution?.bonusResolution?.applied ?? [];
  if (!applied.length) return "Aucun";
  return applied.map(entry => {
    const modifier = entry?.modifier ?? entry;
    const value = Number(entry?.contribution ?? modifier?.value) || 0;
    const label = String(modifier?.metadata?.label ?? modifier?.source?.name ?? "Modificateur").trim();
    return `${label} ${value >= 0 ? "+" : ""}${value}`;
  }).join(" ; ");
}

async function postTargetSaveEffectCard(actor, targetActor, capability, save, duration) {
  requireChatApi();
  const messages = capability.messages ?? {};
  const resisted = save?.success === true;
  const card = {
    actor,
    title: String(capability.label ?? "Capacité raciale"),
    icon: `fas ${String(capability.iconClass ?? "fa-bolt")}`,
    variant: resisted ? "success" : "failure",
    source: {
      name: actor?.name ?? "Acteur",
      img: actor?.img,
      type: "Capacité raciale",
      meta: String(capability.sourceName ?? directRaceItem(actor)?.name ?? "Race")
    },
    target: {
      name: targetActor?.name ?? "Cible",
      img: targetActor?.img,
      type: `Sauvegarde — ${save?.resolution?.label ?? capability?.save?.label ?? capability?.save?.type ?? "Sauvegarde"}`,
      meta: save?.resolution?.targetResolution?.selected?.className ?? save?.resolution?.targetResolution?.source ?? ""
    },
    rows: [
      { label: "D20", value: Number(save?.d20) || 0 },
      { label: "Bonus de sauvegarde", value: `${Number(save?.bonus) >= 0 ? "+" : ""}${Number(save?.bonus) || 0}` },
      { label: "Total", value: Number(save?.total) || 0 },
      { label: "Seuil", value: Number(save?.target) || 0 },
      { label: "Modificateurs", value: saveModifierDetail(save) },
      { label: "Durée", value: resisted ? "Aucun effet" : `${duration.rounds} round${duration.rounds > 1 ? "s" : ""}${duration.formula ? ` (${duration.formula})` : ""}` }
    ],
    message: renderMessage(
      resisted
        ? (messages.saveSuccess ?? `${targetActor?.name ?? "La cible"} résiste à la capacité.`)
        : (messages.saveFailure ?? `${targetActor?.name ?? "La cible"} subit l’effet de la capacité.`),
      actor,
      targetActor
    ),
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor }),
      rolls: [save?.roll, duration.roll].filter(Boolean),
      flags: {
        add2e: {
          racialCapabilityAction: true,
          racialCapabilityId: String(capability.id ?? ""),
          racialCapabilityKind: TARGET_SAVE_EFFECT,
          saveType: save?.resolution?.key ?? capability?.save?.type ?? null,
          saveTarget: save?.target ?? null,
          saveBonus: save?.bonus ?? null,
          saveTotal: save?.total ?? null,
          saveSuccess: resisted,
          saveResolverVersion: save?.version ?? null,
          durationRounds: duration.rounds,
          sourceActorUuid: actor?.uuid ?? null,
          targetActorUuid: targetActor?.uuid ?? null
        }
      }
    }
  };
  const preview = globalThis.add2eBuildChatCard(card);
  if (!String(preview ?? "").trim()) throw new Error("La carte de capacité raciale ADD2E est vide.");
  return globalThis.add2eCreateChatCard(card);
}

async function executeTargetSaveEffect(engine, actor, capability, context = {}) {
  if (!sourceActorAllowed(actor)) {
    ui.notifications?.warn?.("Vous ne pouvez pas utiliser les capacités de cet acteur.");
    return { ok: false, reason: "source-permission" };
  }

  const targets = selectedTargetTokens();
  if (targets.length !== 1) {
    ui.notifications?.warn?.(`${capability.label} : cible exactement une créature.`);
    return { ok: false, reason: "target-count", targetCount: targets.length };
  }

  const targetToken = targets[0];
  const targetActor = targetToken.actor;
  if (capability?.target?.allowSelf === false && targetActor?.uuid === actor?.uuid) {
    ui.notifications?.warn?.(`${capability.label} : cette capacité ne peut pas vous cibler vous-même.`);
    return { ok: false, reason: "self-target" };
  }

  requireSavingThrowApi();
  const saveType = capability?.save?.type ?? capability?.save?.key ?? capability?.save?.index;
  const save = await globalThis.add2eRollSavingThrow(targetActor, saveType, {
    ...context,
    source: context.source ?? `race:${capability.id}`,
    consumer: context.consumer ?? "racial-target-save-effect",
    actor,
    caster: actor,
    targetActor,
    targetToken,
    frontale: capability?.save?.frontale !== false,
    createChat: false,
    showDice: true
  });
  if (!save?.ok) {
    ui.notifications?.warn?.(`${capability.label} : aucune valeur de sauvegarde disponible pour ${targetActor.name}.`);
    return { ok: false, reason: "save-unavailable", save };
  }

  let duration = { rounds: 0, roll: null, formula: "" };
  let application = { applied: false, effect: null, relayed: false };
  if (!save.success) {
    duration = await durationRoll(capability.effect ?? {});
    const effectData = buildEffectData(engine, actor, targetActor, capability, duration);
    application = await applyEffectToTarget(targetActor, targetToken, effectData);
  }

  const message = await postTargetSaveEffectCard(actor, targetActor, capability, save, duration);
  return {
    ok: true,
    actionType: TARGET_SAVE_EFFECT,
    capability,
    actor,
    targetActor,
    targetToken,
    save,
    resisted: save.success === true,
    durationRounds: duration.rounds,
    application,
    message
  };
}

async function useRacialCapability(actor, capabilityId, context = {}) {
  const engine = globalThis.ADD2E_EFFECTS ?? null;
  if (!engine || typeof engine.getRacialAction !== "function") {
    throw new Error("Le moteur canonique des capacités raciales ADD2E est indisponible.");
  }
  const action = engine.getRacialAction(actor, capabilityId);
  if (!action) {
    ui.notifications?.warn?.("Cette capacité raciale n’est pas disponible pour cet acteur.");
    return { ok: false, reason: "capability-not-found" };
  }

  const actionType = String(action.actionType ?? "");
  if (actionType === TARGET_SAVE_EFFECT) return executeTargetSaveEffect(engine, actor, action, context);
  if (actionType === "roll") {
    if (typeof globalThis.add2eRollRacialCapability !== "function") {
      throw new Error("Le lanceur canonique des capacités raciales ADD2E est indisponible.");
    }
    return globalThis.add2eRollRacialCapability(actor, capabilityId, context);
  }
  return { ok: false, reason: "unsupported-action-type", capability: action };
}

function installRacialCapabilityActions() {
  if (add2eRacialCapabilityActionsInstalled) return true;
  const engine = globalThis.ADD2E_EFFECTS ?? null;
  const baseGetRacialCapabilities = engine?.getRacialCapabilities;
  if (!engine || typeof baseGetRacialCapabilities !== "function") return false;

  add2eRacialCapabilityActionsInstalled = true;
  const inherited = baseGetRacialCapabilities.bind(engine);
  Object.defineProperty(engine, "getRacialCapabilities", {
    configurable: true,
    writable: true,
    value(actor) {
      return decorateRacialCapabilities(this, actor, inherited(actor));
    }
  });

  globalThis.add2eUseRacialCapability = useRacialCapability;
  return true;
}

const defer = globalThis.queueMicrotask ?? (callback => Promise.resolve().then(callback));
defer(() => {
  if (!installRacialCapabilityActions()) defer(installRacialCapabilityActions);
});
if (typeof Hooks !== "undefined") Hooks.once("init", installRacialCapabilityActions);
