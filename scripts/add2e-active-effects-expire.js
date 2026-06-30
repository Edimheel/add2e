// ============================================================================
// ADD2E — Point d'entrée : moteur de temps, rounds + états vitaux.
// Version : 2026-07-01-active-effects-token-transform-save-v2
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

const ADD2E_TOKEN_TRANSFORM_VERSION = "2026-07-01-timed-token-transform-v1";
const ADD2E_TOKEN_TRANSFORM_FLAG = "tokenTransform";

globalThis.ADD2E_ACTIVE_EFFECTS_EXPIRE_VERSION = "2026-07-01-active-effects-token-transform-save-v2";
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
  worldTimeEngine: ADD2E_WORLD_TIME_ENGINE_VERSION,
  tokenTransform: ADD2E_TOKEN_TRANSFORM_VERSION
});

function add2eNumber(value, fallback = NaN) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function add2eClone(value) {
  if (foundry?.utils?.deepClone) return foundry.utils.deepClone(value);
  if (foundry?.utils?.duplicate) return foundry.utils.duplicate(value);
  return JSON.parse(JSON.stringify(value));
}

function add2eEscapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = String(value ?? "");
  return div.innerHTML;
}

function add2eCurrentRoundForEffects() {
  const round = Number(game.combat?.round ?? 0);
  return Number.isFinite(round) && round > 0 ? round : 0;
}

function add2eTokenDocument(tokenLike) {
  const document = tokenLike?.document ?? tokenLike ?? null;
  return document?.documentName === "Token" || document?.parent?.documentName === "Scene" ? document : null;
}

function add2eTokenScene(tokenDocument) {
  return tokenDocument?.parent?.documentName === "Scene"
    ? tokenDocument.parent
    : game.scenes?.get?.(tokenDocument?.parent?.id)
      ?? canvas?.scene
      ?? null;
}

function add2eTransformId() {
  return foundry?.utils?.randomID?.(16)
    ?? globalThis.crypto?.randomUUID?.().replace(/-/g, "").slice(0, 16)
    ?? `transform_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

function add2eRoundTokenValue(value, minimum = 0.2) {
  const number = add2eNumber(value, minimum);
  return Math.max(minimum, Math.round(number * 1000) / 1000);
}

function add2eTokenGridSize(tokenDocument) {
  return Math.max(1, add2eNumber(add2eTokenScene(tokenDocument)?.grid?.size ?? canvas?.grid?.size, 100));
}

function add2eTokenTransformData(effect) {
  try {
    return effect?.getFlag?.("add2e", ADD2E_TOKEN_TRANSFORM_FLAG)
      ?? effect?.flags?.add2e?.[ADD2E_TOKEN_TRANSFORM_FLAG]
      ?? null;
  } catch (_error) {
    return effect?.flags?.add2e?.[ADD2E_TOKEN_TRANSFORM_FLAG] ?? null;
  }
}

function add2eTokenTransformMarker(tokenDocument) {
  return tokenDocument?.flags?.add2e?.[ADD2E_TOKEN_TRANSFORM_FLAG] ?? null;
}

function add2eTokenTransformMatchesToken(transform, tokenDocument) {
  if (!transform || !tokenDocument) return false;
  const scene = add2eTokenScene(tokenDocument);
  return String(transform.tokenId ?? "") === String(tokenDocument.id ?? "")
    && String(transform.sceneId ?? "") === String(scene?.id ?? "");
}

function add2eTokenTransformToken(transform) {
  const scene = game.scenes?.get?.(transform?.sceneId)
    ?? (canvas?.scene?.id === transform?.sceneId ? canvas.scene : null)
    ?? null;
  return scene?.tokens?.get?.(transform?.tokenId) ?? null;
}

function add2eTokenTransformUpdate(tokenDocument, dimensions, { clear = false, marker = null } = {}) {
  const gridSize = add2eTokenGridSize(tokenDocument);
  const oldWidth = add2eRoundTokenValue(tokenDocument?.width, 0.2);
  const oldHeight = add2eRoundTokenValue(tokenDocument?.height, 0.2);
  const width = add2eRoundTokenValue(dimensions?.width, 0.2);
  const height = add2eRoundTokenValue(dimensions?.height, 0.2);
  const update = {
    width,
    height,
    x: add2eNumber(tokenDocument?.x, 0) + ((oldWidth - width) * gridSize / 2),
    y: add2eNumber(tokenDocument?.y, 0) + ((oldHeight - height) * gridSize / 2)
  };

  if (clear) update["flags.add2e.-=tokenTransform"] = null;
  else if (marker) update["flags.add2e.tokenTransform"] = marker;
  return update;
}

/**
 * Prépare une transformation de dimensions sans modifier le token.
 * Réutilisable par tout sort ou capacité temporaire affectant un token.
 */
export function add2ePrepareTokenTransformation({ token, factor = 1, group = "generic", mode = "default", id = null, source = "effect" } = {}) {
  const tokenDocument = add2eTokenDocument(token);
  const scene = add2eTokenScene(tokenDocument);
  const numericFactor = add2eNumber(factor, NaN);
  if (!tokenDocument || !scene || !Number.isFinite(numericFactor) || numericFactor <= 0) return null;

  const original = {
    width: add2eRoundTokenValue(tokenDocument.width, 0.2),
    height: add2eRoundTokenValue(tokenDocument.height, 0.2)
  };
  const applied = {
    width: add2eRoundTokenValue(original.width * numericFactor, 0.2),
    height: add2eRoundTokenValue(original.height * numericFactor, 0.2)
  };
  const transform = {
    version: ADD2E_TOKEN_TRANSFORM_VERSION,
    id: String(id ?? add2eTransformId()),
    source: String(source ?? "effect"),
    group: String(group ?? "generic"),
    mode: String(mode ?? "default"),
    factor: numericFactor,
    sceneId: scene.id ?? null,
    tokenId: tokenDocument.id ?? null,
    original,
    applied
  };

  return {
    transform,
    updateData: add2eTokenTransformUpdate(tokenDocument, applied, { marker: transform })
  };
}

/**
 * Recherche les ActiveEffects portant une transformation générique du token.
 */
export function add2eFindTokenTransformationEffects(actor, token, { group = null, includeDisabled = false } = {}) {
  const tokenDocument = add2eTokenDocument(token);
  if (!actor || !tokenDocument) return [];
  return Array.from(actor.effects ?? []).filter(effect => {
    if (!includeDisabled && effect?.disabled) return false;
    const transform = add2eTokenTransformData(effect);
    if (!add2eTokenTransformMatchesToken(transform, tokenDocument)) return false;
    return !group || String(transform.group ?? "") === String(group);
  });
}

/**
 * Restaure les dimensions normales sans ramener le token à son ancienne case.
 * Le centre courant est conservé, afin qu'un token déplacé pendant l'effet ne
 * soit jamais téléporté à la fin de la durée.
 */
export async function add2eRestoreTokenTransformationFromEffect(effect, { reason = "effect-removed" } = {}) {
  const transform = add2eTokenTransformData(effect);
  if (!transform?.id || !transform?.original) return { ok: false, reason: "no-transform" };

  const tokenDocument = add2eTokenTransformToken(transform);
  if (!tokenDocument) return { ok: false, reason: "token-missing" };

  const marker = add2eTokenTransformMarker(tokenDocument);
  if (String(marker?.id ?? "") !== String(transform.id)) return { ok: false, reason: "superseded" };

  await tokenDocument.update(
    add2eTokenTransformUpdate(tokenDocument, transform.original, { clear: true }),
    { add2eTokenTransform: true, add2eTokenTransformReason: reason }
  );
  return { ok: true, tokenId: tokenDocument.id, transformId: transform.id };
}

export async function add2eReapplyTokenTransformationFromEffect(effect, { reason = "effect-enabled" } = {}) {
  const transform = add2eTokenTransformData(effect);
  if (!transform?.id || !transform?.applied) return { ok: false, reason: "no-transform" };

  const tokenDocument = add2eTokenTransformToken(transform);
  if (!tokenDocument) return { ok: false, reason: "token-missing" };

  const marker = add2eTokenTransformMarker(tokenDocument);
  if (String(marker?.id ?? "") === String(transform.id)) return { ok: false, reason: "already-applied" };

  await tokenDocument.update(
    add2eTokenTransformUpdate(tokenDocument, transform.applied, { marker: transform }),
    { add2eTokenTransform: true, add2eTokenTransformReason: reason }
  );
  return { ok: true, tokenId: tokenDocument.id, transformId: transform.id };
}

export async function add2eDeleteTokenTransformationEffects(actor, effects = [], { reason = "replace" } = {}) {
  if (!actor) return { deleted: 0, ids: [] };
  const selected = Array.from(effects ?? []).filter(effect => effect?.id && actor.effects?.get?.(effect.id));
  for (const effect of selected) await add2eRestoreTokenTransformationFromEffect(effect, { reason });
  const ids = selected.map(effect => effect.id).filter(id => actor.effects?.get?.(id));
  if (ids.length) await actor.deleteEmbeddedDocuments("ActiveEffect", ids, { add2eTokenTransform: true, add2eTokenTransformReason: reason });
  return { deleted: ids.length, ids };
}

/**
 * Crée un ActiveEffect temporaire et transforme un token en une seule opération.
 * Un effet du même groupe remplace son équivalent ; le mode inverse l'annule.
 */
export async function add2eApplyTimedTokenTransformation({ actor, token, effectData, factor, group = "generic", mode = "default", source = "effect" } = {}) {
  const tokenDocument = add2eTokenDocument(token);
  if (!actor || !tokenDocument || !effectData) return { ok: false, reason: "missing-document" };

  const existing = add2eFindTokenTransformationEffects(actor, tokenDocument, { group });
  const opposite = existing.filter(effect => String(add2eTokenTransformData(effect)?.mode ?? "") !== String(mode));
  if (opposite.length) {
    const removed = await add2eDeleteTokenTransformationEffects(actor, opposite, { reason: "inverse-cancel" });
    return { ok: true, cancelled: true, removed };
  }

  if (existing.length) await add2eDeleteTokenTransformationEffects(actor, existing, { reason: "replace" });

  const prepared = add2ePrepareTokenTransformation({ token: tokenDocument, factor, group, mode, source });
  if (!prepared) return { ok: false, reason: "invalid-transform" };

  const data = add2eClone(effectData);
  data.flags ??= {};
  data.flags.add2e ??= {};
  data.flags.add2e[ADD2E_TOKEN_TRANSFORM_FLAG] = prepared.transform;

  const created = await actor.createEmbeddedDocuments("ActiveEffect", [data]);
  const effect = created?.[0] ?? null;
  if (!effect) return { ok: false, reason: "effect-create-failed" };

  try {
    await tokenDocument.update(prepared.updateData, { add2eTokenTransform: true, add2eTokenTransformReason: "apply" });
  } catch (error) {
    if (actor.effects?.get?.(effect.id)) await actor.deleteEmbeddedDocuments("ActiveEffect", [effect.id], { add2eTokenTransform: true, add2eTokenTransformReason: "rollback" });
    throw error;
  }

  return { ok: true, cancelled: false, effect, prepared };
}

function add2eSavingThrowNames() {
  return ["Paralysie", "Pétrification", "Baguettes", "Souffles", "Sorts"];
}

function add2eSavingThrowThreshold(actor, index) {
  const system = actor?.system ?? {};
  const candidates = [
    Array.isArray(system.sauvegardes) ? system.sauvegardes[index] : null,
    Array.isArray(system.savingThrows) ? system.savingThrows[index] : null,
    system.sauvegardes?.[index],
    system.savingThrows?.[index],
    system.details_classe?.progression?.[Math.max(0, Number(system.niveau ?? 1) - 1)]?.savingThrows?.[index]
  ];
  for (const value of candidates) {
    const threshold = add2eNumber(value, NaN);
    if (Number.isFinite(threshold) && threshold > 0) return threshold;
  }
  return NaN;
}

/**
 * Jet de sauvegarde unique et réutilisable : le bonus d'ActiveEffects est
 * appliqué comme dans les cartes de feuille et de HUD.
 */
export async function add2eRollSavingThrow(actor, { index = 4, label = null, sourceName = "", token = null, createChat = true } = {}) {
  const saveIndex = Math.max(0, Math.floor(add2eNumber(index, 4)));
  const saveLabel = label || add2eSavingThrowNames()[saveIndex] || "Jet de sauvegarde";
  const threshold = add2eSavingThrowThreshold(actor, saveIndex);
  if (!actor || !Number.isFinite(threshold) || threshold <= 0) {
    return { ok: false, success: false, threshold: NaN, total: 0, bonus: 0, roll: null, message: null };
  }

  const roll = await new Roll("1d20").evaluate({ async: true });
  if (game.dice3d) await game.dice3d.showForRoll(roll);

  let bonus = 0;
  try {
    const analysis = globalThis.Add2eEffectsEngine?.analyze?.(actor, { type: "save", vsType: saveLabel, frontale: true }) ?? {};
    bonus = add2eNumber(analysis.bonus_save, 0);
  } catch (_error) {}

  const rolled = add2eNumber(roll.total, 0);
  const total = rolled + bonus;
  const success = total >= threshold;
  let message = null;

  if (createChat) {
    const colors = ["#c48642", "#6394e8", "#b12f95", "#e67e22", "#a173d9"];
    const icons = ["fa-skull-crossbones", "fa-mountain", "fa-magic", "fa-fire", "fa-scroll"];
    const color = colors[saveIndex] ?? "#6c4e95";
    const icon = icons[saveIndex] ?? "fa-dice-d20";
    const source = String(sourceName ?? "").trim();
    const sourceLine = source ? `<div style="margin-top:4px;font-size:12px;color:#555;">Contre : <b>${add2eEscapeHtml(source)}</b></div>` : "";
    message = await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor, token }),
      content: `
        <div class="add2e-card-test" style="border-radius:13px;box-shadow:0 2px 10px #cfdfff88;background:linear-gradient(100deg,#f9fafd 90%,#e6e8fb 100%);border:1.4px solid ${color};max-width:420px;padding:.85em 1.1em .8em;font-family:var(--font-primary);">
          <div style="display:flex;align-items:center;gap:.7em;margin-bottom:.5em;"><i class="fas ${icon}" style="font-size:2em;color:${color};"></i><span style="font-size:1.12em;font-weight:bold;color:${color};">${add2eEscapeHtml(saveLabel)}</span><span style="margin-left:auto;font-size:1em;font-weight:500;color:#666;">Jet de sauvegarde</span></div>
          <div style="font-size:1.09em;margin-bottom:.25em;">Seuil : <b>${threshold}</b>&nbsp;&nbsp;|&nbsp;&nbsp;Résultat : <b>${rolled}</b>${bonus ? `&nbsp;&nbsp;|&nbsp;&nbsp;Effets : <b>${bonus >= 0 ? "+" : ""}${bonus}</b> → <b>${total}</b>` : ""}</div>
          <div style="margin:.2em 0 .1em;font-size:1.1em;"><span style="font-weight:600;color:${success ? "#1cb360" : "#c34040"};">${success ? "✔️ Réussite" : "❌ Échec"}</span></div>
          ${sourceLine}
        </div>`
    });
  }

  return { ok: true, success, threshold, total, bonus, roll, message };
}

globalThis.add2ePrepareTokenTransformation = add2ePrepareTokenTransformation;
globalThis.add2eFindTokenTransformationEffects = add2eFindTokenTransformationEffects;
globalThis.add2eRestoreTokenTransformationFromEffect = add2eRestoreTokenTransformationFromEffect;
globalThis.add2eReapplyTokenTransformationFromEffect = add2eReapplyTokenTransformationFromEffect;
globalThis.add2eDeleteTokenTransformationEffects = add2eDeleteTokenTransformationEffects;
globalThis.add2eApplyTimedTokenTransformation = add2eApplyTimedTokenTransformation;
globalThis.add2eRollSavingThrow = add2eRollSavingThrow;

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

Hooks.on("updateActiveEffect", async (effect, changed = {}) => {
  if (game.user?.isGM && Object.prototype.hasOwnProperty.call(changed, "disabled")) {
    if (effect?.disabled) await add2eRestoreTokenTransformationFromEffect(effect, { reason: "effect-disabled" });
    else await add2eReapplyTokenTransformationFromEffect(effect, { reason: "effect-enabled" });
  }
  if (effect?.parent?.type === "monster") add2eRenderOpenMonsterSheets(effect.parent);
});

Hooks.on("deleteActiveEffect", async effect => {
  if (!game.user?.isGM) return;
  await add2eRestoreTokenTransformationFromEffect(effect, { reason: "effect-deleted" });
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