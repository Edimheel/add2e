// ============================================================================
// ADD2E — Point d'entrée : moteur de temps, rounds + états vitaux.
// Version : 2026-08-01-canonical-document-transform-v7
// Compatible Foundry V13/V14/V15.
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

const ADD2E_TOKEN_TRANSFORM_VERSION = "2026-08-01-timed-token-transform-v2";
const ADD2E_DOCUMENT_TRANSFORM_VERSION = "2026-08-01-canonical-document-transform-v7";
const ADD2E_TOKEN_TRANSFORM_FLAG = "tokenTransform";
const ADD2E_DOCUMENT_TRANSFORM_FLAG = "documentTransformation";
const ADD2E_DOCUMENT_TRANSFORM_MARKERS_FLAG = "documentTransformations";
const ADD2E_ACTIVE_EFFECTS_ENTRY_VERSION = "2026-08-01-canonical-document-transform-v7";

globalThis.ADD2E_ACTIVE_EFFECTS_EXPIRE_VERSION = ADD2E_ACTIVE_EFFECTS_ENTRY_VERSION;
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
  entry: ADD2E_ACTIVE_EFFECTS_ENTRY_VERSION,
  core: ADD2E_VITAL_STATUS_CORE_VERSION,
  sync: ADD2E_VITAL_STATUS_SYNC_VERSION,
  expiration: ADD2E_ACTIVE_EFFECTS_EXPIRATION_VERSION,
  timeEngine: ADD2E_TIME_ENGINE_VERSION,
  roundEngine: ADD2E_ROUND_ENGINE_VERSION,
  worldTimeEngine: ADD2E_WORLD_TIME_ENGINE_VERSION,
  tokenTransform: ADD2E_TOKEN_TRANSFORM_VERSION,
  documentTransform: ADD2E_DOCUMENT_TRANSFORM_VERSION
});

function add2eNumber(value, fallback = NaN) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function add2eClone(value) {
  if (value === undefined) return undefined;
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

function add2eIsResponsibleGM() {
  if (!game.user?.isGM) return false;
  if (typeof game.user.isActiveGM === "boolean") return game.user.isActiveGM;
  return game.users?.activeGM?.id === game.user.id;
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

function add2eTransformGroupKey(value) {
  return String(value ?? "generic")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    || "generic";
}

function add2eRoundTokenValue(value, minimum = 0.2) {
  const number = add2eNumber(value, minimum);
  return Math.max(minimum, Math.round(number * 1000) / 1000);
}

function add2eTokenGridSize(tokenDocument) {
  return Math.max(1, add2eNumber(add2eTokenScene(tokenDocument)?.grid?.size ?? canvas?.grid?.size, 100));
}

function add2eGetProperty(object, path) {
  if (typeof foundry?.utils?.getProperty === "function") return foundry.utils.getProperty(object, path);
  return String(path ?? "").split(".").reduce((value, key) => value?.[key], object);
}

function add2eHasProperty(object, path) {
  if (typeof foundry?.utils?.hasProperty === "function") return foundry.utils.hasProperty(object, path);
  const parts = String(path ?? "").split(".");
  let value = object;
  for (const part of parts) {
    if (value === null || value === undefined || !Object.prototype.hasOwnProperty.call(value, part)) return false;
    value = value[part];
  }
  return true;
}

function add2ePlainDocumentData(document) {
  try {
    if (typeof document?.toObject === "function") return document.toObject(false) ?? {};
  } catch (_error) {}
  return document ?? {};
}

function add2eWithoutUndefined(value) {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) {
    return value.map(entry => {
      const cleaned = add2eWithoutUndefined(entry);
      return cleaned === undefined ? null : cleaned;
    });
  }
  if (value && typeof value === "object") {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return value;
    const cleaned = {};
    for (const [key, entry] of Object.entries(value)) {
      const next = add2eWithoutUndefined(entry);
      if (next !== undefined) cleaned[key] = next;
    }
    return cleaned;
  }
  return value;
}

function add2eSanitizeUpdate(updateData = {}) {
  const update = {};
  for (const [path, value] of Object.entries(updateData ?? {})) {
    if (!path || value === undefined) continue;
    const cleaned = add2eWithoutUndefined(value);
    if (cleaned !== undefined) update[path] = cleaned;
  }
  return update;
}

function add2eSnapshotPaths(document, updateData = {}, ignored = new Set()) {
  const snapshot = {};
  const source = add2ePlainDocumentData(document);
  for (const path of Object.keys(updateData ?? {})) {
    if (!path || path === "_id" || ignored.has(path) || path.startsWith("-=") || path.includes(".-=")) continue;
    const exists = add2eHasProperty(source, path);
    const value = exists ? add2eWithoutUndefined(add2eClone(add2eGetProperty(source, path))) : undefined;
    snapshot[path] = value === undefined ? { exists: false } : { exists: true, value };
  }
  return snapshot;
}

function add2eRestoreUpdate(snapshot = {}) {
  const update = {};
  for (const [path, entry] of Object.entries(snapshot ?? {})) {
    if (!path || !entry) continue;
    const hasValue = Object.prototype.hasOwnProperty.call(entry, "value");
    if (entry.exists === true && hasValue) {
      const value = add2eWithoutUndefined(add2eClone(entry.value));
      if (value !== undefined) update[path] = value;
      continue;
    }
    if (entry.exists === false) {
      const parts = String(path).split(".");
      const leaf = parts.pop();
      if (leaf) update[`${parts.join(".")}${parts.length ? "." : ""}-=${leaf}`] = null;
    }
  }
  return add2eSanitizeUpdate(update);
}

function add2eResolvedRestorationOriginal(transform) {
  const original = add2eClone(transform?.original ?? {}) ?? {};
  original.token ??= {};

  const textureEntry = original.token["texture.src"] ?? null;
  const hasTextureValue = textureEntry?.exists === true
    && Object.prototype.hasOwnProperty.call(textureEntry, "value");
  const originalTexture = hasTextureValue ? String(textureEntry.value ?? "").trim() : "";
  const appliedTexture = String(transform?.applied?.token?.["texture.src"] ?? "").trim();

  return {
    original,
    tokenTextureRepaired: false,
    originalTexture,
    appliedTexture
  };
}

function add2eRefreshSceneTokenTexture(tokenDocument) {
  if (!tokenDocument) return false;
  const sceneId = tokenDocument?.parent?.id ?? null;
  const tokenObject = tokenDocument.object
    ?? (canvas?.scene?.id === sceneId ? canvas?.tokens?.get?.(tokenDocument.id) : null)
    ?? null;
  if (!tokenObject) return false;

  if (typeof tokenObject.renderFlags?.set === "function") {
    tokenObject.renderFlags.set({ redraw: true });
    return true;
  }
  if (typeof tokenObject.refresh === "function") {
    tokenObject.refresh();
    return true;
  }
  return false;
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

function add2eDocumentTransformData(effect) {
  try {
    return effect?.getFlag?.("add2e", ADD2E_DOCUMENT_TRANSFORM_FLAG)
      ?? effect?.flags?.add2e?.[ADD2E_DOCUMENT_TRANSFORM_FLAG]
      ?? null;
  } catch (_error) {
    return effect?.flags?.add2e?.[ADD2E_DOCUMENT_TRANSFORM_FLAG] ?? null;
  }
}

function add2eTokenTransformMarker(tokenDocument) {
  return tokenDocument?.flags?.add2e?.[ADD2E_TOKEN_TRANSFORM_FLAG] ?? null;
}

function add2eDocumentTransformMarker(document, transform) {
  const key = transform?.groupKey ?? add2eTransformGroupKey(transform?.group);
  return document?.flags?.add2e?.[ADD2E_DOCUMENT_TRANSFORM_MARKERS_FLAG]?.[key] ?? null;
}

function add2eDocumentTransformationEffectById(actor, transformId) {
  const id = String(transformId ?? "");
  if (!actor || !id) return null;
  return Array.from(actor.effects ?? []).find(effect => {
    const transform = add2eDocumentTransformData(effect);
    return String(transform?.id ?? "") === id;
  }) ?? null;
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

function add2eCanonicalMarker(transform) {
  return add2eWithoutUndefined({
    version: transform.version,
    id: transform.id,
    source: transform.source,
    group: transform.group,
    groupKey: transform.groupKey,
    mode: transform.mode,
    scope: transform.scope,
    tracksActor: transform.tracksActor,
    sceneId: transform.sceneId,
    tokenId: transform.tokenId,
    recovery: {
      original: add2eClone(transform.original ?? {}),
      applied: add2eClone(transform.applied ?? {}),
      temporaryItemIds: Array.from(transform.temporaryItemIds ?? []).filter(Boolean)
    }
  });
}

function add2eCanonicalMarkerPath(transform) {
  return `flags.add2e.${ADD2E_DOCUMENT_TRANSFORM_MARKERS_FLAG}.${transform.groupKey}`;
}

function add2eCanonicalMarkerDeletePath(transform) {
  return `flags.add2e.${ADD2E_DOCUMENT_TRANSFORM_MARKERS_FLAG}.-=${transform.groupKey}`;
}

async function add2eRestoreOrphanedDocumentTransformation(actor, tokenDocument, transformId, actorMarker, tokenMarker, { reason = "orphan-recovery" } = {}) {
  const id = String(transformId ?? "");
  if (!actor || !id) return { ok: false, reason: "invalid-orphan" };

  const actorMatches = String(actorMarker?.id ?? "") === id;
  const tokenMatches = String(tokenMarker?.id ?? "") === id;
  const marker = actorMatches ? actorMarker : tokenMarker;
  const tokenMarkerMissing = !String(tokenMarker?.id ?? "");
  const tokenOwnedThroughActor = !!tokenDocument
    && actorMatches
    && tokenMarkerMissing
    && add2eTokenTransformMatchesToken(marker, tokenDocument);
  const tokenRestorable = !!tokenDocument && (tokenMatches || tokenOwnedThroughActor);
  const recovery = marker?.recovery ?? {};
  const resolvedOriginal = add2eResolvedRestorationOriginal({
    group: marker?.group,
    original: recovery.original,
    applied: recovery.applied
  });
  const original = resolvedOriginal.original;
  const groupKey = marker?.groupKey ?? add2eTransformGroupKey(marker?.group);
  const markerTransform = { groupKey };

  const temporaryIds = new Set(Array.from(recovery?.temporaryItemIds ?? []).filter(Boolean));
  for (const item of actor.items ?? []) {
    if (String(item?.flags?.add2e?.documentTransformationId ?? "") === id) temporaryIds.add(item.id);
  }
  if (temporaryIds.size) {
    await actor.deleteEmbeddedDocuments("Item", [...temporaryIds], {
      add2eDocumentTransform: true,
      add2eDocumentTransformReason: reason,
      render: false
    });
  }

  if (actorMatches) {
    const itemUpdates = [];
    for (const entry of original?.items ?? []) {
      if (!actor.items?.get?.(entry.id)) continue;
      const restored = add2eRestoreUpdate(entry.values);
      if (Object.keys(restored).length) itemUpdates.push({ _id: entry.id, ...restored });
    }
    if (itemUpdates.length) {
      await actor.updateEmbeddedDocuments("Item", itemUpdates, {
        add2eDocumentTransform: true,
        add2eDocumentTransformReason: reason,
        render: false
      });
    }

    const actorUpdate = add2eSanitizeUpdate({
      ...add2eRestoreUpdate(original?.actor),
      [add2eCanonicalMarkerDeletePath(markerTransform)]: null
    });
    await actor.update(actorUpdate, {
      add2eDocumentTransform: true,
      add2eDocumentTransformReason: reason,
      render: false
    });
  }

  if (tokenRestorable) {
    const tokenUpdate = add2eSanitizeUpdate({
      ...add2eRestoreUpdate(original?.token),
      [add2eCanonicalMarkerDeletePath(markerTransform)]: null
    });
    await tokenDocument.update(tokenUpdate, {
      add2eDocumentTransform: true,
      add2eDocumentTransformReason: reason
    });
    add2eRefreshSceneTokenTexture(tokenDocument);
  }

  return {
    ok: true,
    transformId: id,
    actorRestored: actorMatches && Object.keys(original?.actor ?? {}).length > 0,
    tokenRestored: tokenRestorable && Object.keys(original?.token ?? {}).length > 0,
    tokenOwnedThroughActor,
    tokenTextureRepaired: resolvedOriginal.tokenTextureRepaired,
    temporaryItemsDeleted: temporaryIds.size
  };
}

async function add2eReconcileDocumentTransformationMarkers(actor, tokenDocument, transform, { reason = "marker-reconcile" } = {}) {
  if (!actor || !transform?.id) return { ok: false, reason: "no-document-transform" };

  const actorMarker = transform.tracksActor ? add2eDocumentTransformMarker(actor, transform) : null;
  const tokenMarker = add2eDocumentTransformMarker(tokenDocument, transform);
  const currentId = String(transform.id);
  const orphanIds = [...new Set([actorMarker?.id, tokenMarker?.id]
    .map(value => String(value ?? ""))
    .filter(value => value && value !== currentId))];

  for (const markerId of orphanIds) {
    const owner = add2eDocumentTransformationEffectById(actor, markerId);
    if (owner) {
      return {
        ok: false,
        reason: "superseded",
        ownerEffectId: owner.id,
        ownerTransformId: markerId
      };
    }
  }

  const recovered = [];
  for (const markerId of orphanIds) {
    recovered.push(await add2eRestoreOrphanedDocumentTransformation(
      actor,
      tokenDocument,
      markerId,
      actorMarker,
      tokenMarker,
      { reason }
    ));
  }

  return { ok: true, recovered };
}

function add2eCanonicalTokenUpdate(tokenDocument, tokenUpdate = {}, { marker = null, clear = false, transform = null } = {}) {
  const update = add2eSanitizeUpdate(add2eClone(tokenUpdate ?? {}) ?? {});
  const changesWidth = Object.prototype.hasOwnProperty.call(update, "width");
  const changesHeight = Object.prototype.hasOwnProperty.call(update, "height");
  if ((changesWidth || changesHeight) && !Object.prototype.hasOwnProperty.call(update, "x") && !Object.prototype.hasOwnProperty.call(update, "y")) {
    const gridSize = add2eTokenGridSize(tokenDocument);
    const oldWidth = add2eRoundTokenValue(tokenDocument?.width, 0.2);
    const oldHeight = add2eRoundTokenValue(tokenDocument?.height, 0.2);
    const width = changesWidth ? add2eRoundTokenValue(update.width, 0.2) : oldWidth;
    const height = changesHeight ? add2eRoundTokenValue(update.height, 0.2) : oldHeight;
    update.x = add2eNumber(tokenDocument?.x, 0) + ((oldWidth - width) * gridSize / 2);
    update.y = add2eNumber(tokenDocument?.y, 0) + ((oldHeight - height) * gridSize / 2);
  }
  if (clear && transform) update[add2eCanonicalMarkerDeletePath(transform)] = null;
  else if (marker && transform) update[add2eCanonicalMarkerPath(transform)] = marker;
  return add2eSanitizeUpdate(update);
}

function add2eTemporaryItemData(data, transform) {
  const item = add2eWithoutUndefined(add2eClone(data ?? {}) ?? {}) ?? {};
  delete item._id;
  item.flags ??= {};
  item.flags.add2e ??= {};
  item.flags.add2e.documentTransformationId = transform.id;
  item.flags.add2e.documentTransformationGroup = transform.group;
  return item;
}

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

export function add2ePrepareDocumentTransformation({
  actor,
  token,
  group = "generic",
  mode = "default",
  scope = "actor",
  source = "effect",
  tokenUpdate = {},
  actorUpdate = {},
  itemUpdates = [],
  temporaryItems = [],
  id = null
} = {}) {
  const tokenDocument = add2eTokenDocument(token);
  const scene = add2eTokenScene(tokenDocument);
  if (!actor || !tokenDocument || !scene) return null;

  const normalizedScope = String(scope ?? "actor") === "token" ? "token" : "actor";
  const tracksActor = normalizedScope === "actor"
    || Object.keys(actorUpdate ?? {}).length > 0
    || Array.from(itemUpdates ?? []).length > 0
    || Array.from(temporaryItems ?? []).length > 0;
  const transform = {
    version: ADD2E_DOCUMENT_TRANSFORM_VERSION,
    id: String(id ?? add2eTransformId()),
    source: add2eWithoutUndefined(add2eClone(source ?? "effect")),
    group: String(group ?? "generic"),
    groupKey: add2eTransformGroupKey(group),
    mode: String(mode ?? "default"),
    scope: normalizedScope,
    tracksActor,
    actorId: actor.id ?? null,
    actorUuid: actor.uuid ?? null,
    sceneId: scene.id ?? null,
    tokenId: tokenDocument.id ?? null,
    phase: "prepared",
    original: {
      token: add2eSnapshotPaths(tokenDocument, tokenUpdate),
      actor: add2eSnapshotPaths(actor, actorUpdate),
      items: []
    },
    applied: {
      token: add2eSanitizeUpdate(add2eClone(tokenUpdate ?? {}) ?? {}),
      actor: add2eSanitizeUpdate(add2eClone(actorUpdate ?? {}) ?? {}),
      items: []
    },
    temporaryItems: Array.from(temporaryItems ?? [])
      .map(entry => add2eWithoutUndefined(add2eClone(entry)))
      .filter(entry => entry !== undefined),
    temporaryItemIds: []
  };

  for (const update of Array.from(itemUpdates ?? [])) {
    const itemId = String(update?._id ?? "");
    const item = itemId ? actor.items?.get?.(itemId) ?? null : null;
    if (!item) continue;
    const applied = add2eClone(update) ?? {};
    delete applied._id;
    const cleanApplied = add2eSanitizeUpdate(applied);
    transform.original.items.push({ id: itemId, values: add2eSnapshotPaths(item, cleanApplied) });
    transform.applied.items.push({ id: itemId, update: cleanApplied });
  }

  const tokenApplied = add2eCanonicalTokenUpdate(tokenDocument, transform.applied.token, {
    marker: add2eCanonicalMarker(transform),
    transform
  });
  if (Object.prototype.hasOwnProperty.call(tokenApplied, "x") && !Object.prototype.hasOwnProperty.call(transform.original.token, "x")) {
    transform.original.token.x = { exists: true, value: tokenDocument.x };
  }
  if (Object.prototype.hasOwnProperty.call(tokenApplied, "y") && !Object.prototype.hasOwnProperty.call(transform.original.token, "y")) {
    transform.original.token.y = { exists: true, value: tokenDocument.y };
  }
  transform.applied.token = tokenApplied;
  return { transform };
}

export function add2eFindTokenTransformationEffects(actor, token, { group = null, includeDisabled = false } = {}) {
  const tokenDocument = add2eTokenDocument(token);
  if (!actor || !tokenDocument) return [];
  return Array.from(actor.effects ?? []).filter(effect => {
    if (!includeDisabled && effect?.disabled) return false;
    const transform = add2eDocumentTransformData(effect) ?? add2eTokenTransformData(effect);
    if (!add2eTokenTransformMatchesToken(transform, tokenDocument)) return false;
    return !group || String(transform.group ?? "") === String(group);
  });
}

export function add2eFindDocumentTransformationEffects(actor, token = null, { group = null, includeDisabled = false } = {}) {
  const tokenDocument = add2eTokenDocument(token);
  if (!actor) return [];
  return Array.from(actor.effects ?? []).filter(effect => {
    if (!includeDisabled && effect?.disabled) return false;
    const transform = add2eDocumentTransformData(effect);
    if (!transform) return false;
    if (group && String(transform.group ?? "") !== String(group)) return false;
    if (transform.scope === "token" && tokenDocument && !add2eTokenTransformMatchesToken(transform, tokenDocument)) return false;
    return transform.scope !== "token" || !!tokenDocument;
  });
}

export async function add2eRestoreDocumentTransformationFromEffect(effect, { reason = "effect-removed" } = {}) {
  const transform = add2eDocumentTransformData(effect);
  const actor = effect?.parent?.documentName === "Actor" ? effect.parent : null;
  if (!actor || !transform?.id) return { ok: false, reason: "no-document-transform" };

  const tokenDocument = add2eTokenTransformToken(transform);
  const actorMarker = transform.tracksActor ? add2eDocumentTransformMarker(actor, transform) : null;
  const tokenMarker = add2eDocumentTransformMarker(tokenDocument, transform);
  const actorCurrent = transform.tracksActor && String(actorMarker?.id ?? "") === String(transform.id);
  const tokenCurrent = String(tokenMarker?.id ?? "") === String(transform.id);
  const tokenMarkerMissing = !String(tokenMarker?.id ?? "");
  const tokenOwnedThroughActor = !!tokenDocument
    && actorCurrent
    && tokenMarkerMissing
    && add2eTokenTransformMatchesToken(transform, tokenDocument);
  const tokenRestorable = !!tokenDocument && (tokenCurrent || tokenOwnedThroughActor);
  const resolvedOriginal = add2eResolvedRestorationOriginal(transform);
  const original = resolvedOriginal.original;

  const temporaryIds = new Set(Array.from(transform.temporaryItemIds ?? []).filter(Boolean));
  for (const item of actor.items ?? []) {
    if (String(item?.flags?.add2e?.documentTransformationId ?? "") === String(transform.id)) temporaryIds.add(item.id);
  }
  if (temporaryIds.size) {
    await actor.deleteEmbeddedDocuments("Item", [...temporaryIds], {
      add2eDocumentTransform: true,
      add2eDocumentTransformReason: reason,
      render: false
    });
  }

  if (actorCurrent) {
    const itemUpdates = [];
    for (const entry of original?.items ?? []) {
      if (!actor.items?.get?.(entry.id)) continue;
      const restored = add2eRestoreUpdate(entry.values);
      if (Object.keys(restored).length) itemUpdates.push({ _id: entry.id, ...restored });
    }
    if (itemUpdates.length) {
      await actor.updateEmbeddedDocuments("Item", itemUpdates, {
        add2eDocumentTransform: true,
        add2eDocumentTransformReason: reason,
        render: false
      });
    }

    const actorUpdate = add2eSanitizeUpdate({
      ...add2eRestoreUpdate(original?.actor),
      [add2eCanonicalMarkerDeletePath(transform)]: null
    });
    await actor.update(actorUpdate, {
      add2eDocumentTransform: true,
      add2eDocumentTransformReason: reason,
      render: false
    });
  }

  if (tokenRestorable) {
    const tokenUpdate = add2eSanitizeUpdate({
      ...add2eRestoreUpdate(original?.token),
      [add2eCanonicalMarkerDeletePath(transform)]: null
    });
    await tokenDocument.update(tokenUpdate, {
      add2eDocumentTransform: true,
      add2eDocumentTransformReason: reason
    });
    add2eRefreshSceneTokenTexture(tokenDocument);
  }

  return {
    ok: actorCurrent || tokenRestorable || temporaryIds.size > 0,
    actorRestored: actorCurrent,
    tokenRestored: tokenRestorable,
    tokenOwnedThroughActor,
    tokenTextureRepaired: resolvedOriginal.tokenTextureRepaired,
    temporaryItemsDeleted: temporaryIds.size,
    transformId: transform.id,
    reason: actorCurrent || tokenRestorable ? "restored" : "superseded"
  };
}

export async function add2eReapplyDocumentTransformationFromEffect(effect, { reason = "effect-enabled" } = {}) {
  const transform = add2eDocumentTransformData(effect);
  const actor = effect?.parent?.documentName === "Actor" ? effect.parent : null;
  const tokenDocument = add2eTokenTransformToken(transform);
  if (!actor || !tokenDocument || !transform?.id) return { ok: false, reason: "no-document-transform" };

  const reconciled = await add2eReconcileDocumentTransformationMarkers(actor, tokenDocument, transform, {
    reason: `${reason}:marker-reconcile`
  });
  if (!reconciled.ok) return reconciled;

  if (transform.tracksActor) {
    const actorUpdate = add2eSanitizeUpdate({
      ...(add2eClone(transform.applied?.actor) ?? {}),
      [add2eCanonicalMarkerPath(transform)]: add2eCanonicalMarker(transform)
    });
    await actor.update(actorUpdate, {
      add2eDocumentTransform: true,
      add2eDocumentTransformReason: reason,
      render: false
    });

    const itemUpdates = Array.from(transform.applied?.items ?? [])
      .filter(entry => actor.items?.get?.(entry.id))
      .map(entry => {
        const update = add2eSanitizeUpdate(add2eClone(entry.update) ?? {});
        return Object.keys(update).length ? { _id: entry.id, ...update } : null;
      })
      .filter(Boolean);
    if (itemUpdates.length) {
      await actor.updateEmbeddedDocuments("Item", itemUpdates, {
        add2eDocumentTransform: true,
        add2eDocumentTransformReason: reason,
        render: false
      });
    }
  }

  let temporaryItemIds = [];
  if (Array.isArray(transform.temporaryItems) && transform.temporaryItems.length) {
    const existing = Array.from(actor.items ?? []).filter(item => String(item?.flags?.add2e?.documentTransformationId ?? "") === String(transform.id));
    if (existing.length) temporaryItemIds = existing.map(item => item.id).filter(Boolean);
    else {
      const created = await actor.createEmbeddedDocuments(
        "Item",
        transform.temporaryItems.map(data => add2eTemporaryItemData(data, transform)),
        {
          add2eDocumentTransform: true,
          add2eDocumentTransformReason: reason,
          render: false
        }
      );
      temporaryItemIds = created.map(item => item.id).filter(Boolean);
    }
  }

  const tokenUpdate = add2eSanitizeUpdate(add2eCanonicalTokenUpdate(tokenDocument, transform.applied?.token, {
    marker: add2eCanonicalMarker(transform),
    transform
  }));
  await tokenDocument.update(tokenUpdate, {
    add2eDocumentTransform: true,
    add2eDocumentTransformReason: reason
  });
  add2eRefreshSceneTokenTexture(tokenDocument);

  const next = add2eWithoutUndefined({ ...add2eClone(transform), phase: "active", temporaryItemIds });
  await effect.update({ [`flags.add2e.${ADD2E_DOCUMENT_TRANSFORM_FLAG}`]: next }, {
    add2eDocumentTransform: true,
    add2eDocumentTransformReason: reason,
    render: false
  });
  return { ok: true, effect, transform: next, temporaryItemIds, reconciled };
}

export async function add2eDeleteDocumentTransformationEffects(actor, effects = [], { reason = "replace" } = {}) {
  if (!actor) return { deleted: 0, ids: [] };
  const selected = Array.from(effects ?? []).filter(effect => effect?.id && actor.effects?.get?.(effect.id));
  for (const effect of selected) await add2eRestoreDocumentTransformationFromEffect(effect, { reason });
  const ids = selected.map(effect => effect.id).filter(id => actor.effects?.get?.(id));
  if (ids.length) {
    await actor.deleteEmbeddedDocuments("ActiveEffect", ids, {
      add2eDocumentTransform: true,
      add2eDocumentTransformReason: reason
    });
  }
  return { deleted: ids.length, ids };
}

export async function add2eApplyDocumentTransformation({
  actor,
  token,
  effectData,
  group = "generic",
  mode = "default",
  scope = "actor",
  source = "effect",
  tokenUpdate = {},
  actorUpdate = {},
  itemUpdates = [],
  temporaryItems = []
} = {}) {
  const tokenDocument = add2eTokenDocument(token);
  if (!actor || !tokenDocument || !effectData) return { ok: false, reason: "missing-document" };

  const existing = add2eFindDocumentTransformationEffects(actor, tokenDocument, { group, includeDisabled: true });
  if (existing.length) await add2eDeleteDocumentTransformationEffects(actor, existing, { reason: "replace" });

  const transformIdentity = {
    id: add2eTransformId(),
    group: String(group ?? "generic"),
    groupKey: add2eTransformGroupKey(group),
    tracksActor: String(scope ?? "actor") !== "token"
      || Object.keys(actorUpdate ?? {}).length > 0
      || Array.from(itemUpdates ?? []).length > 0
      || Array.from(temporaryItems ?? []).length > 0
  };
  const reconciled = await add2eReconcileDocumentTransformationMarkers(actor, tokenDocument, transformIdentity, {
    reason: "apply:marker-reconcile"
  });
  if (!reconciled.ok) return reconciled;

  const prepared = add2ePrepareDocumentTransformation({
    actor,
    token: tokenDocument,
    group,
    mode,
    scope,
    source,
    tokenUpdate,
    actorUpdate,
    itemUpdates,
    temporaryItems,
    id: transformIdentity.id
  });
  if (!prepared) return { ok: false, reason: "invalid-transform" };

  const data = add2eClone(effectData);
  data.flags ??= {};
  data.flags.add2e ??= {};
  data.flags.add2e[ADD2E_DOCUMENT_TRANSFORM_FLAG] = prepared.transform;

  const created = await actor.createEmbeddedDocuments("ActiveEffect", [data], {
    add2eDocumentTransform: true,
    add2eDocumentTransformReason: "prepare",
    render: false
  });
  const effect = created?.[0] ?? null;
  if (!effect) return { ok: false, reason: "effect-create-failed" };

  try {
    return await add2eReapplyDocumentTransformationFromEffect(effect, { reason: "apply" });
  } catch (error) {
    try {
      await add2eRestoreDocumentTransformationFromEffect(effect, { reason: "rollback" });
      if (actor.effects?.get?.(effect.id)) {
        await actor.deleteEmbeddedDocuments("ActiveEffect", [effect.id], {
          add2eDocumentTransform: true,
          add2eDocumentTransformReason: "rollback"
        });
      }
    } catch (rollbackError) {
      console.error("[ADD2E][DOCUMENT-TRANSFORM][ROLLBACK]", rollbackError);
    }
    throw error;
  }
}

export async function add2eRestoreTokenTransformationFromEffect(effect, { reason = "effect-removed" } = {}) {
  if (add2eDocumentTransformData(effect)) return add2eRestoreDocumentTransformationFromEffect(effect, { reason });
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
  add2eRefreshSceneTokenTexture(tokenDocument);
  return { ok: true, tokenId: tokenDocument.id, transformId: transform.id };
}

export async function add2eReapplyTokenTransformationFromEffect(effect, { reason = "effect-enabled" } = {}) {
  if (add2eDocumentTransformData(effect)) return add2eReapplyDocumentTransformationFromEffect(effect, { reason });
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
  add2eRefreshSceneTokenTexture(tokenDocument);
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

export async function add2eApplyTimedTokenTransformation({ actor, token, effectData, factor, group = "generic", mode = "default", source = "effect" } = {}) {
  const tokenDocument = add2eTokenDocument(token);
  if (!actor || !tokenDocument || !effectData) return { ok: false, reason: "missing-document" };

  const existing = add2eFindTokenTransformationEffects(actor, tokenDocument, { group });
  const opposite = existing.filter(effect => String((add2eDocumentTransformData(effect) ?? add2eTokenTransformData(effect))?.mode ?? "") !== String(mode));
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
    add2eRefreshSceneTokenTexture(tokenDocument);
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
globalThis.add2ePrepareDocumentTransformation = add2ePrepareDocumentTransformation;
globalThis.add2eFindTokenTransformationEffects = add2eFindTokenTransformationEffects;
globalThis.add2eFindDocumentTransformationEffects = add2eFindDocumentTransformationEffects;
globalThis.add2eRestoreTokenTransformationFromEffect = add2eRestoreTokenTransformationFromEffect;
globalThis.add2eRestoreDocumentTransformationFromEffect = add2eRestoreDocumentTransformationFromEffect;
globalThis.add2eReapplyTokenTransformationFromEffect = add2eReapplyTokenTransformationFromEffect;
globalThis.add2eReapplyDocumentTransformationFromEffect = add2eReapplyDocumentTransformationFromEffect;
globalThis.add2eDeleteTokenTransformationEffects = add2eDeleteTokenTransformationEffects;
globalThis.add2eDeleteDocumentTransformationEffects = add2eDeleteDocumentTransformationEffects;
globalThis.add2eApplyTimedTokenTransformation = add2eApplyTimedTokenTransformation;
globalThis.add2eApplyDocumentTransformation = add2eApplyDocumentTransformation;
globalThis.add2eRollSavingThrow = add2eRollSavingThrow;

function add2eEffectDurationLabel(effect) {
  const remainingData = add2eTimeRemainingRounds(effect, add2eCurrentRoundForEffects());
  const remaining = Number(remainingData?.remaining);
  const total = Number(remainingData?.totalRounds);
  if (Number.isFinite(remaining)) return Number.isFinite(total) && total > 0 ? `${remaining} / ${total} rds` : `${remaining} rds`;
  if (Number.isFinite(Number(effect?.duration?.remaining))) return `${Number(effect.duration.remaining)} rds`;
  if (Number.isFinite(Number(effect?.duration?.rounds))) return `${Number(effect.duration.rounds)} rds`;
  if (Number.isFinite(Number(effect?.duration?.seconds))) return `${Number(effect.duration.seconds)} s`;
  return effect?.isTemporary ? "Temporaire" : "Permanente";
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
  if (proto.__add2eMonsterEffectDurationPatch === ADD2E_ACTIVE_EFFECTS_ENTRY_VERSION) return true;

  const original = proto.getData;
  proto.getData = async function add2eMonsterGetDataWithTimedEffects(...args) {
    const data = await original.apply(this, args);
    if (this.actor?.type === "monster") data.activeEffectsList = Array.from(this.actor.effects ?? []).map(add2eBuildMonsterEffectRow);
    return data;
  };

  proto.__add2eMonsterEffectDurationPatch = ADD2E_ACTIVE_EFFECTS_ENTRY_VERSION;
  return true;
}

function add2eRenderOpenMonsterSheets(actor = null) {
  for (const app of Object.values(ui.windows ?? {})) {
    const sheetActor = app?.actor ?? app?.object ?? app?.document ?? null;
    if (!sheetActor || sheetActor.type !== "monster") continue;
    if (actor && sheetActor.id !== actor.id && sheetActor.uuid !== actor.uuid) continue;
    try { app.render(false); } catch (_error) {}
  }
}

function add2eCollectionValues(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value.contents !== "undefined") return Array.from(value.contents ?? []);
  if (typeof value.values === "function") return Array.from(value.values());
  if (typeof value[Symbol.iterator] === "function" && typeof value !== "string") return Array.from(value);
  return [];
}

function add2eTokenActor(tokenLike) {
  return tokenLike?.actor ?? tokenLike?.document?.actor ?? tokenLike?.object?.actor ?? null;
}

function add2eCombatantActor(combatant) {
  return combatant?.actor ?? combatant?.token?.actor ?? combatant?.token?.document?.actor ?? null;
}

function add2ePushMonsterActor(out, seen, actor, source = "unknown", sourceKey = "") {
  if (!actor || actor.type !== "monster") return;
  const key = String(actor?.uuid ?? actor?.id ?? sourceKey ?? actor?.name ?? "");
  if (!key || seen.has(key)) return;
  seen.add(key);
  out.push({ actor, source });
}

function add2eMonsterActorsForNormalization() {
  const out = [];
  const seen = new Set();
  for (const actor of add2eCollectionValues(game.actors)) add2ePushMonsterActor(out, seen, actor, "world-actor");
  for (const combatant of add2eCollectionValues(game.combat?.combatants)) add2ePushMonsterActor(out, seen, add2eCombatantActor(combatant), "combatant", combatant?.id ?? combatant?.tokenId ?? "");
  for (const token of canvas?.tokens?.placeables ?? []) add2ePushMonsterActor(out, seen, add2eTokenActor(token), "canvas-token", token?.document?.uuid ?? token?.id ?? "");
  for (const scene of add2eCollectionValues(game.scenes)) {
    for (const tokenDocument of add2eCollectionValues(scene?.tokens)) {
      add2ePushMonsterActor(out, seen, add2eTokenActor(tokenDocument), "scene-token", tokenDocument?.uuid ?? `${scene?.id ?? "scene"}.${tokenDocument?.id ?? "token"}`);
    }
  }
  return out;
}

async function add2eNormalizeMonsterActorEffects(actor, { source = "unknown" } = {}) {
  if (!actor || actor.type !== "monster") return { normalized: 0, skipped: 0, errors: 0 };
  const result = await add2eTimeNormalizeActorEffects(actor, add2eCurrentRoundForEffects());
  if (result.normalized) add2eRenderOpenMonsterSheets(actor);
  return { ...result, source };
}

async function add2eNormalizeCreatedEffect(effect) {
  if (!effect) return;
  const actor = effect.parent;
  if (!actor || actor.documentName !== "Actor") return;
  if (!game.user?.isGM && actor.isOwner !== true) return;
  try {
    await add2eTimeNormalizeEffect(effect, add2eCurrentRoundForEffects());
  } catch (err) {
    const message = String(err?.message || err || "");
    if (!message.includes("does not exist") && !message.includes("n'existe pas")) {
      console.warn("[ADD2E][AUTO-REMOVE][CREATE_EFFECT_NORMALIZE_FAILED]", { actor: actor.name, effect: effect.name, effectId: effect.id, err });
    }
  }
  if (actor.type === "monster") add2eRenderOpenMonsterSheets(actor);
}

async function add2eNormalizeExistingMonsterEffects() {
  if (!game.user?.isGM) return { actors: 0, normalized: 0, errors: 0 };
  const rows = add2eMonsterActorsForNormalization();
  let normalized = 0;
  let errors = 0;
  for (const { actor, source } of rows) {
    try {
      const result = await add2eNormalizeMonsterActorEffects(actor, { source });
      normalized += Number(result.normalized ?? 0);
      errors += Number(result.errors ?? 0);
    } catch (err) {
      errors += 1;
      console.warn("[ADD2E][AUTO-REMOVE][MONSTER_EFFECTS_NORMALIZE_FAILED]", { actor: actor.name, actorId: actor.id, actorUuid: actor.uuid ?? null, source, err });
    }
  }
  return { actors: rows.length, normalized, errors };
}

Hooks.once("init", add2eRegisterTimeEngineApi);
Hooks.once("init", add2eVitalRegisterStatusEffects);
Hooks.once("setup", add2eRegisterTimeEngineApi);
Hooks.once("setup", add2eVitalRegisterStatusEffects);
Hooks.once("setup", () => {
  add2eInstallMonsterEffectDurationPatch();
  window.setTimeout(add2eInstallMonsterEffectDurationPatch, 0);
});
Hooks.once("ready", add2eRegisterTimeEngineApi);
Hooks.once("ready", add2eVitalRegisterStatusEffects);
Hooks.once("ready", add2eRegisterWorldTimeEngine);
Hooks.once("ready", add2eRegisterRoundEngineHooks);

Hooks.on("updateActor", async (actor, changed, options) => {
  if (!game.user?.isGM || options?.add2eVitalStatusSync) return;
  const hpChanged = foundry.utils.hasProperty(changed, "system.pdv") ||
    foundry.utils.hasProperty(changed, "system.pv") ||
    foundry.utils.hasProperty(changed, "system.hp") ||
    foundry.utils.hasProperty(changed, "system.points_de_coup");
  if (hpChanged) window.setTimeout(() => add2eSyncActorVitalStatus(actor, { reason: "updateActor:hp" }), 30);
});

Hooks.on("createActiveEffect", effect => add2eNormalizeCreatedEffect(effect));

Hooks.on("updateActiveEffect", async (effect, changed = {}, options = {}) => {
  if (options?.add2eDocumentTransform) {
    if (effect?.parent?.type === "monster") add2eRenderOpenMonsterSheets(effect.parent);
    return;
  }
  if (add2eIsResponsibleGM() && Object.prototype.hasOwnProperty.call(changed, "disabled")) {
    if (effect?.disabled) await add2eRestoreTokenTransformationFromEffect(effect, { reason: "effect-disabled" });
    else await add2eReapplyTokenTransformationFromEffect(effect, { reason: "effect-enabled" });
  }
  if (effect?.parent?.type === "monster") add2eRenderOpenMonsterSheets(effect.parent);
});

Hooks.on("deleteActiveEffect", async (effect, options = {}) => {
  if (!add2eIsResponsibleGM()) return;
  if (!options?.add2eDocumentTransform) await add2eRestoreTokenTransformationFromEffect(effect, { reason: "effect-deleted" });
  const actor = effect?.parent;
  const temporaryItemId = effect?.flags?.add2e?.temporaryItemId;
  if (actor?.documentName === "Actor" && temporaryItemId && actor.items?.get(temporaryItemId)) await actor.deleteEmbeddedDocuments("Item", [temporaryItemId]);
  if (actor?.type === "monster") add2eRenderOpenMonsterSheets(actor);
});

Hooks.on("createToken", tokenDocument => {
  const actor = tokenDocument?.actor;
  if (!game.user?.isGM || actor?.type !== "monster") return;
  add2eNormalizeMonsterActorEffects(actor, { source: "create-token" })
    .catch(err => console.warn("[ADD2E][AUTO-REMOVE][CREATE_TOKEN_MONSTER_NORMALIZE_FAILED]", { actor: actor.name, actorId: actor.id, err }));
});

Hooks.on("updateCombat", (_combat, changed) => {
  if (!changed || (!Object.prototype.hasOwnProperty.call(changed, "round") && !Object.prototype.hasOwnProperty.call(changed, "turn"))) return;
  window.setTimeout(() => add2eRenderOpenMonsterSheets(), 50);
});

Hooks.once("ready", () => {
  if (!game.user?.isGM) return;
  window.setTimeout(async () => {
    add2eRegisterTimeEngineApi();
    add2eRegisterWorldTimeEngine();
    add2eVitalRegisterStatusEffects();
    add2eInstallMonsterEffectDurationPatch();
    await add2eNormalizeExistingMonsterEffects();
    for (const actor of game.actors ?? []) add2eSyncActorVitalStatus(actor, { reason: "ready-scan" });
    for (const token of canvas?.tokens?.placeables ?? []) if (token?.actor) add2eSyncActorVitalStatus(token.actor, { reason: "ready-token-scan" });
  }, 500);
});
