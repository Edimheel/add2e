// ============================================================
// ADD2E — Auto-compatibilité race / classe au drop — chargeur
// Version : 2026-07-11-class-effect-lifecycle-diag-v1
// ============================================================

import "./09a-race-class-drop-core.mjs";
import "./09b-race-class-drop-wrapper-v2.mjs";

const ADD2E_CLASS_EFFECT_DIAG_VERSION = "2026-07-11-class-effect-lifecycle-diag-v1";
globalThis.ADD2E_CLASS_EFFECT_DIAG_VERSION = ADD2E_CLASS_EFFECT_DIAG_VERSION;
if (globalThis.ADD2E_DEBUG_CLASS_EFFECT_LIFECYCLE === undefined) {
  globalThis.ADD2E_DEBUG_CLASS_EFFECT_LIFECYCLE = true;
}

function add2eClassEffectDiagEnabled() {
  return globalThis.ADD2E_DEBUG_CLASS_EFFECT_LIFECYCLE !== false;
}

function add2eClassEffectDiagIsClassItem(document) {
  return String(document?.type ?? "").toLowerCase() === "classe";
}

function add2eClassEffectDiagIsManagedEffect(document, changes = null) {
  const current = document?.flags?.add2e ?? {};
  const pending = changes?.flags?.add2e
    ?? foundry?.utils?.getProperty?.(changes ?? {}, "flags.add2e")
    ?? {};
  return current.autoClassPassiveEffect === true
    || current.classPassiveFeatureEffect === true
    || pending.autoClassPassiveEffect === true
    || pending.classPassiveFeatureEffect === true;
}

function add2eClassEffectDiagActor(document) {
  const parent = document?.parent ?? document?.actor ?? null;
  return parent?.documentName === "Actor" ? parent : null;
}

function add2eClassEffectDiagOptions(options = {}) {
  const output = {};
  for (const [key, value] of Object.entries(options ?? {})) {
    if (key === "render" || key.startsWith("add2e")) output[key] = value;
  }
  return output;
}

function add2eClassEffectDiagChanges(changes = {}) {
  const read = path => {
    if (Object.prototype.hasOwnProperty.call(changes ?? {}, path)) return changes[path];
    return foundry?.utils?.getProperty?.(changes ?? {}, path);
  };
  return {
    keys: Object.keys(changes ?? {}),
    name: read("name"),
    level: read("system.niveau"),
    xp: read("system.xp"),
    passiveKey: read("flags.add2e.passiveKey"),
    sourceItemId: read("flags.add2e.sourceItemId"),
    classLevel: read("flags.add2e.classLevel")
  };
}

function add2eClassEffectDiagClassRow(item) {
  return {
    id: item?.id ?? null,
    uuid: item?.uuid ?? null,
    name: item?.name ?? null,
    level: item?.system?.niveau ?? null,
    xp: item?.system?.xp ?? null
  };
}

function add2eClassEffectDiagEffectRow(effect) {
  const flags = effect?.flags?.add2e ?? {};
  return {
    id: effect?.id ?? null,
    uuid: effect?.uuid ?? null,
    name: effect?.name ?? effect?.label ?? null,
    passiveKey: flags.passiveKey ?? null,
    sourceItemId: flags.sourceItemId ?? null,
    sourceItemUuid: flags.sourceItemUuid ?? null,
    classFeatureId: flags.classFeatureId ?? null,
    classLevel: flags.classLevel ?? null,
    origin: effect?.origin ?? null,
    disabled: effect?.disabled ?? null
  };
}

function add2eClassEffectDiagState(actor) {
  if (!actor) return null;
  const classes = Array.from(actor.items ?? [])
    .filter(add2eClassEffectDiagIsClassItem)
    .map(add2eClassEffectDiagClassRow);
  const effects = Array.from(actor.effects ?? [])
    .filter(effect => add2eClassEffectDiagIsManagedEffect(effect))
    .map(add2eClassEffectDiagEffectRow);
  const counts = new Map();
  for (const effect of effects) {
    const key = String(effect.passiveKey ?? "").trim();
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const duplicatePassiveKeys = [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([passiveKey, count]) => ({ passiveKey, count }));
  return {
    actorId: actor.id ?? null,
    actorUuid: actor.uuid ?? null,
    actorName: actor.name ?? null,
    classes,
    effects,
    duplicatePassiveKeys
  };
}

function add2eClassEffectDiagLog(event, document, { changes = {}, options = {}, userId = null, phase = "hook" } = {}) {
  if (!add2eClassEffectDiagEnabled()) return;
  const actor = add2eClassEffectDiagActor(document);
  const documentType = document?.documentName ?? document?.constructor?.name ?? null;
  const documentData = add2eClassEffectDiagIsClassItem(document)
    ? add2eClassEffectDiagClassRow(document)
    : add2eClassEffectDiagEffectRow(document);
  console.log(`[ADD2E][CLASS_EFFECT_DIAG][${event}]`, {
    version: ADD2E_CLASS_EFFECT_DIAG_VERSION,
    phase,
    currentUserId: game.user?.id ?? null,
    hookUserId: userId,
    documentType,
    document: documentData,
    changes: add2eClassEffectDiagChanges(changes),
    options: add2eClassEffectDiagOptions(options),
    state: add2eClassEffectDiagState(actor),
    stack: new Error(`[ADD2E][CLASS_EFFECT_DIAG][${event}]`).stack
  });
}

function add2eClassEffectDiagAfter(event, document, payload = {}) {
  const actor = add2eClassEffectDiagActor(document);
  setTimeout(() => {
    if (!add2eClassEffectDiagEnabled()) return;
    console.log(`[ADD2E][CLASS_EFFECT_DIAG][${event}_AFTER]`, {
      version: ADD2E_CLASS_EFFECT_DIAG_VERSION,
      phase: "post-hook",
      documentType: document?.documentName ?? document?.constructor?.name ?? null,
      documentId: document?.id ?? null,
      options: add2eClassEffectDiagOptions(payload.options ?? {}),
      state: add2eClassEffectDiagState(actor)
    });
  }, 0);
}

if (globalThis.ADD2E_CLASS_EFFECT_DIAG_HOOKS_REGISTERED !== ADD2E_CLASS_EFFECT_DIAG_VERSION) {
  globalThis.ADD2E_CLASS_EFFECT_DIAG_HOOKS_REGISTERED = ADD2E_CLASS_EFFECT_DIAG_VERSION;

  Hooks.on("preCreateItem", (item, data = {}, options = {}, userId = null) => {
    if (add2eClassEffectDiagIsClassItem(item)) add2eClassEffectDiagLog("PRE_CREATE_CLASS_ITEM", item, { changes: data, options, userId });
  });
  Hooks.on("createItem", (item, options = {}, userId = null) => {
    if (!add2eClassEffectDiagIsClassItem(item)) return;
    add2eClassEffectDiagLog("CREATE_CLASS_ITEM", item, { options, userId });
    add2eClassEffectDiagAfter("CREATE_CLASS_ITEM", item, { options });
  });
  Hooks.on("preUpdateItem", (item, changes = {}, options = {}, userId = null) => {
    if (add2eClassEffectDiagIsClassItem(item)) add2eClassEffectDiagLog("PRE_UPDATE_CLASS_ITEM", item, { changes, options, userId });
  });
  Hooks.on("updateItem", (item, changes = {}, options = {}, userId = null) => {
    if (!add2eClassEffectDiagIsClassItem(item)) return;
    add2eClassEffectDiagLog("UPDATE_CLASS_ITEM", item, { changes, options, userId });
    add2eClassEffectDiagAfter("UPDATE_CLASS_ITEM", item, { options });
  });
  Hooks.on("preDeleteItem", (item, options = {}, userId = null) => {
    if (add2eClassEffectDiagIsClassItem(item)) add2eClassEffectDiagLog("PRE_DELETE_CLASS_ITEM", item, { options, userId });
  });
  Hooks.on("deleteItem", (item, options = {}, userId = null) => {
    if (!add2eClassEffectDiagIsClassItem(item)) return;
    add2eClassEffectDiagLog("DELETE_CLASS_ITEM", item, { options, userId });
    add2eClassEffectDiagAfter("DELETE_CLASS_ITEM", item, { options });
  });

  Hooks.on("preCreateActiveEffect", (effect, data = {}, options = {}, userId = null) => {
    if (add2eClassEffectDiagIsManagedEffect(effect, data)) add2eClassEffectDiagLog("PRE_CREATE_EFFECT", effect, { changes: data, options, userId });
  });
  Hooks.on("createActiveEffect", (effect, options = {}, userId = null) => {
    if (!add2eClassEffectDiagIsManagedEffect(effect)) return;
    add2eClassEffectDiagLog("CREATE_EFFECT", effect, { options, userId });
    add2eClassEffectDiagAfter("CREATE_EFFECT", effect, { options });
  });
  Hooks.on("preUpdateActiveEffect", (effect, changes = {}, options = {}, userId = null) => {
    if (add2eClassEffectDiagIsManagedEffect(effect, changes)) add2eClassEffectDiagLog("PRE_UPDATE_EFFECT", effect, { changes, options, userId });
  });
  Hooks.on("updateActiveEffect", (effect, changes = {}, options = {}, userId = null) => {
    if (!add2eClassEffectDiagIsManagedEffect(effect, changes)) return;
    add2eClassEffectDiagLog("UPDATE_EFFECT", effect, { changes, options, userId });
    add2eClassEffectDiagAfter("UPDATE_EFFECT", effect, { options });
  });
  Hooks.on("preDeleteActiveEffect", (effect, options = {}, userId = null) => {
    if (add2eClassEffectDiagIsManagedEffect(effect)) add2eClassEffectDiagLog("PRE_DELETE_EFFECT", effect, { options, userId });
  });
  Hooks.on("deleteActiveEffect", (effect, options = {}, userId = null) => {
    if (!add2eClassEffectDiagIsManagedEffect(effect)) return;
    add2eClassEffectDiagLog("DELETE_EFFECT", effect, { options, userId });
    add2eClassEffectDiagAfter("DELETE_EFFECT", effect, { options });
  });

  Hooks.once("ready", () => {
    if (!add2eClassEffectDiagEnabled()) return;
    console.log("[ADD2E][CLASS_EFFECT_DIAG][READY]", {
      version: ADD2E_CLASS_EFFECT_DIAG_VERSION,
      enabled: true,
      actors: Array.from(game.actors ?? [])
        .filter(actor => Array.from(actor.items ?? []).some(add2eClassEffectDiagIsClassItem))
        .map(add2eClassEffectDiagState)
    });
  });
}
