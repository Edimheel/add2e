// ============================================================================
// ADD2E — Point d'entrée : moteur de temps, rounds + états vitaux.
// Version : 2026-06-14-active-effects-expire-monster-duration-v1
// ============================================================================

import { ADD2E_VITAL_STATUS_CORE_VERSION } from "./add2e/18a-vital-status-core.mjs";
import {
  ADD2E_VITAL_STATUS_SYNC_VERSION,
  add2eSyncActorVitalStatus,
  add2eVitalRegisterStatusEffects
} from "./add2e/18b-vital-status-sync.mjs";
import {
  ADD2E_ACTIVE_EFFECTS_EXPIRATION_VERSION,
  add2eExpireTemporaryEffectsForActor
} from "./add2e/18c-active-effects-expiration.mjs";
import {
  ADD2E_TIME_ENGINE_VERSION,
  add2eRegisterTimeEngineApi,
  add2eTimeNormalizeActorEffects,
  add2eTimeNormalizeEffect,
  add2eTimeRemainingRounds
} from "./add2e/19a-time-engine.mjs";
import {
  ADD2E_ROUND_ENGINE_VERSION,
  add2eRegisterRoundEngineHooks,
  add2eRoundEngineOnCombatProgress
} from "./add2e/19-round-engine.mjs";
import {
  ADD2E_WORLD_TIME_ENGINE_VERSION,
  add2eRegisterWorldTimeEngine,
  add2eOpenWorldTimeApplication,
  add2eWorldTimeAdvance,
  add2eWorldTimeExpireAllActors
} from "./add2e/19b-world-time-engine.mjs";

globalThis.ADD2E_ACTIVE_EFFECTS_EXPIRE_VERSION = "2026-06-14-active-effects-expire-monster-duration-v1";
globalThis.ADD2E_VITAL_STATUS_CORE_VERSION = ADD2E_VITAL_STATUS_CORE_VERSION;
globalThis.ADD2E_VITAL_STATUS_SYNC_VERSION = ADD2E_VITAL_STATUS_SYNC_VERSION;
globalThis.ADD2E_ACTIVE_EFFECTS_EXPIRATION_VERSION = ADD2E_ACTIVE_EFFECTS_EXPIRATION_VERSION;
globalThis.ADD2E_TIME_ENGINE_VERSION = ADD2E_TIME_ENGINE_VERSION;
globalThis.ADD2E_ROUND_ENGINE_VERSION = ADD2E_ROUND_ENGINE_VERSION;
globalThis.ADD2E_WORLD_TIME_ENGINE_VERSION = ADD2E_WORLD_TIME_ENGINE_VERSION;
globalThis.add2eSyncActorVitalStatus = add2eSyncActorVitalStatus;
globalThis.add2eVitalRegisterStatusEffects = add2eVitalRegisterStatusEffects;
globalThis.add2eExpireTemporaryEffectsForActor = add2eExpireTemporaryEffectsForActor;
globalThis.add2eRoundEngineOnCombatProgress = add2eRoundEngineOnCombatProgress;
globalThis.add2eOpenWorldTimeApplication = add2eOpenWorldTimeApplication;
globalThis.add2eWorldTimeAdvance = add2eWorldTimeAdvance;
globalThis.add2eWorldTimeExpireAllActors = add2eWorldTimeExpireAllActors;

console.log("[ADD2E][AUTO-REMOVE][VERSION]", {
  entry: globalThis.ADD2E_ACTIVE_EFFECTS_EXPIRE_VERSION,
  core: ADD2E_VITAL_STATUS_CORE_VERSION,
  sync: ADD2E_VITAL_STATUS_SYNC_VERSION,
  expiration: ADD2E_ACTIVE_EFFECTS_EXPIRATION_VERSION,
  timeEngine: ADD2E_TIME_ENGINE_VERSION,
  roundEngine: ADD2E_ROUND_ENGINE_VERSION,
  worldTimeEngine: ADD2E_WORLD_TIME_ENGINE_VERSION
});

function add2eCurrentRoundForEffects() {
  const round = Number(game.combat?.round ?? 0);
  return Number.isFinite(round) && round > 0 ? round : 0;
}

function add2eEffectDurationLabel(effect) {
  const remainingData = add2eTimeRemainingRounds(effect, add2eCurrentRoundForEffects());
  const remaining = Number(remainingData?.remaining);
  const total = Number(remainingData?.totalRounds);

  if (Number.isFinite(remaining)) {
    if (Number.isFinite(total) && total > 0) return `${remaining} / ${total} rds`;
    return `${remaining} rds`;
  }

  if (Number.isFinite(Number(effect?.duration?.remaining))) return `${Number(effect.duration.remaining)} rds`;
  if (Number.isFinite(Number(effect?.duration?.rounds))) return `${Number(effect.duration.rounds)} rds`;
  if (Number.isFinite(Number(effect?.duration?.seconds))) return `${Number(effect.duration.seconds)} s`;
  if (effect?.isTemporary) return "Temporaire";
  return "Permanente";
}

function add2eEffectDescription(effect) {
  let desc = effect?.description || effect?.flags?.add2e?.desc || "";
  const tags = effect?.flags?.add2e?.tags ?? [];
  if (!desc && Array.isArray(tags) && tags.length) desc = tags.join(", ");
  return desc;
}

function add2eBuildMonsterEffectRow(effect) {
  return {
    id: effect.id,
    name: effect.name || effect.label || "Effet",
    img: effect.img || effect.icon || "icons/svg/aura.svg",
    disabled: effect.disabled,
    duration: add2eEffectDurationLabel(effect),
    description: add2eEffectDescription(effect),
    sourceName: effect.origin ? "Source externe" : "Propre"
  };
}

function add2eInstallMonsterEffectDurationPatch() {
  const proto = globalThis.Add2eMonsterSheet?.prototype;
  if (!proto?.getData) return false;
  if (proto.__add2eMonsterEffectDurationPatch === globalThis.ADD2E_ACTIVE_EFFECTS_EXPIRE_VERSION) return true;

  const original = proto.getData;
  proto.getData = async function add2eMonsterGetDataWithTimedEffects(...args) {
    const data = await original.apply(this, args);
    if (this.actor?.type === "monster") {
      data.activeEffectsList = Array.from(this.actor.effects ?? []).map(add2eBuildMonsterEffectRow);
    }
    return data;
  };

  proto.__add2eMonsterEffectDurationPatch = globalThis.ADD2E_ACTIVE_EFFECTS_EXPIRE_VERSION;
  console.log("[ADD2E][AUTO-REMOVE][MONSTER_DURATION_PATCH] installé");
  return true;
}

function add2eRenderOpenMonsterSheets(actor = null) {
  const windows = Object.values(ui.windows ?? {});
  for (const app of windows) {
    const sheetActor = app?.actor ?? app?.object ?? app?.document ?? null;
    if (!sheetActor || sheetActor.type !== "monster") continue;
    if (actor && sheetActor.id !== actor.id) continue;
    try { app.render(false); }
    catch (_err) {}
  }
}

async function add2eNormalizeCreatedEffect(effect) {
  if (!effect) return;
  const actor = effect.parent;
  if (!actor || actor.documentName !== "Actor") return;
  if (!game.user?.isGM && actor.isOwner !== true) return;
  try {
    await add2eTimeNormalizeEffect(effect, add2eCurrentRoundForEffects());
  } catch (err) {
    const msg = String(err?.message || err || "");
    if (!msg.includes("does not exist") && !msg.includes("n'existe pas")) {
      console.warn("[ADD2E][AUTO-REMOVE][CREATE_EFFECT_NORMALIZE_FAILED]", { actor: actor.name, effect: effect.name, effectId: effect.id, err });
    }
  }
  if (actor.type === "monster") add2eRenderOpenMonsterSheets(actor);
}

async function add2eNormalizeExistingMonsterEffects() {
  if (!game.user?.isGM) return;
  for (const actor of game.actors ?? []) {
    if (actor?.type !== "monster") continue;
    try {
      await add2eTimeNormalizeActorEffects(actor, add2eCurrentRoundForEffects());
    } catch (err) {
      console.warn("[ADD2E][AUTO-REMOVE][MONSTER_EFFECTS_NORMALIZE_FAILED]", { actor: actor.name, actorId: actor.id, err });
    }
  }
}

Hooks.once("init", add2eRegisterTimeEngineApi);
Hooks.once("init", add2eVitalRegisterStatusEffects);
Hooks.once("setup", add2eRegisterTimeEngineApi);
Hooks.once("setup", add2eVitalRegisterStatusEffects);
Hooks.once("ready", add2eRegisterTimeEngineApi);
Hooks.once("ready", add2eVitalRegisterStatusEffects);
Hooks.once("ready", add2eRegisterWorldTimeEngine);
Hooks.once("ready", add2eRegisterRoundEngineHooks);

Hooks.on("updateActor", async (actor, changed, options, userId) => {
  if (!game.user?.isGM) return;
  if (options?.add2eVitalStatusSync) return;

  const hpChanged = foundry.utils.hasProperty(changed, "system.pdv") ||
    foundry.utils.hasProperty(changed, "system.pv") ||
    foundry.utils.hasProperty(changed, "system.hp") ||
    foundry.utils.hasProperty(changed, "system.points_de_coup");

  if (!hpChanged) return;
  window.setTimeout(() => add2eSyncActorVitalStatus(actor, { reason: "updateActor:hp" }), 30);
});

Hooks.on("createActiveEffect", async effect => {
  await add2eNormalizeCreatedEffect(effect);
});

Hooks.on("updateActiveEffect", effect => {
  if (effect?.parent?.type === "monster") add2eRenderOpenMonsterSheets(effect.parent);
});

Hooks.on("deleteActiveEffect", async effect => {
  if (!game.user?.isGM) return;
  const actor = effect?.parent;
  const temporaryItemId = effect?.flags?.add2e?.temporaryItemId;
  if (actor?.documentName === "Actor" && temporaryItemId && actor.items?.get(temporaryItemId)) {
    await actor.deleteEmbeddedDocuments("Item", [temporaryItemId]);
  }
  if (actor?.type === "monster") add2eRenderOpenMonsterSheets(actor);
});

Hooks.on("updateCombat", (combat, changed) => {
  if (!changed || (!Object.prototype.hasOwnProperty.call(changed, "round") && !Object.prototype.hasOwnProperty.call(changed, "turn"))) return;
  window.setTimeout(() => add2eRenderOpenMonsterSheets(), 50);
});

Hooks.once("ready", () => {
  if (!game.user?.isGM) return;

  window.setTimeout(() => {
    add2eRegisterTimeEngineApi();
    add2eRegisterWorldTimeEngine();
    add2eVitalRegisterStatusEffects();
    add2eInstallMonsterEffectDurationPatch();
    add2eNormalizeExistingMonsterEffects();

    for (const actor of game.actors ?? []) {
      add2eSyncActorVitalStatus(actor, { reason: "ready-scan" });
    }

    for (const token of canvas?.tokens?.placeables ?? []) {
      if (token?.actor) add2eSyncActorVitalStatus(token.actor, { reason: "ready-token-scan" });
    }
  }, 500);
});

Hooks.once("ready", () => {
  add2eInstallMonsterEffectDurationPatch();
  window.setTimeout(add2eInstallMonsterEffectDurationPatch, 1000);
});
