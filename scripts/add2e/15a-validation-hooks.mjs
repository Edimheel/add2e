// ADD2E — Validation des documents et consommateurs directs des effets.
// Compatible Foundry V13/V14/V15.

const ADD2E_DOCUMENT_EFFECT_CONSUMERS_VERSION = "2026-07-28-current-hit-points-hooks-v10";
globalThis.ADD2E_DOCUMENT_EFFECT_CONSUMERS_VERSION = ADD2E_DOCUMENT_EFFECT_CONSUMERS_VERSION;

function add2eEffectConsumerList(value) {
  if (Array.isArray(value)) return value.filter(entry => entry && typeof entry === "object");
  if (value && typeof value === "object") return Object.values(value).filter(entry => entry && typeof entry === "object");
  return [];
}

function add2eEffectConsumerModifiers(document) {
  let value = document?.flags?.add2e?.modifiers;
  if ((value === undefined || value === null) && typeof document?.getFlag === "function") {
    value = document.getFlag("add2e", "modifiers");
  }
  return add2eEffectConsumerList(value);
}

function add2eEffectConsumerHasDirectHitPoints(document) {
  return add2eEffectConsumerModifiers(document)
    .some(modifier => String(modifier?.domain ?? "").trim().toLowerCase() === "hit-points");
}

function add2eEffectConsumerHasHitPoints(document) {
  if (add2eEffectConsumerHasDirectHitPoints(document)) return true;
  if (document?.documentName !== "Item") return false;
  return Array.from(document.effects?.contents ?? document.effects ?? [])
    .some(effect => add2eEffectConsumerHasDirectHitPoints(effect));
}

function add2eEffectConsumerChangesTouchModifiers(changes = {}) {
  if (Object.prototype.hasOwnProperty.call(changes, "flags.add2e.modifiers")) return true;
  if (Object.prototype.hasOwnProperty.call(changes, "flags.add2e.-=modifiers")) return true;
  if (foundry.utils.hasProperty(changes, "flags.add2e.modifiers")) return true;
  if (Object.prototype.hasOwnProperty.call(changes, "effects") || foundry.utils.hasProperty(changes, "effects")) return true;
  return Object.keys(changes).some(key => key.startsWith("flags.add2e.modifiers."));
}

function add2eEffectConsumerActor(document) {
  const parent = document?.parent ?? document?.actor ?? null;
  if (parent?.documentName === "Actor") return parent;
  if (parent?.actor?.documentName === "Actor") return parent.actor;
  if (document?.documentName === "Actor") return document;
  return null;
}

function add2eEffectConsumerIsResponsibleGM() {
  if (!game.user?.isGM) return false;
  const activeGM = game.users?.activeGM ?? Array.from(game.users ?? []).find(user => user.active && user.isGM) ?? null;
  return !activeGM || activeGM.id === game.user.id;
}

function add2eEffectTags(effect) {
  const raw = effect?.flags?.add2e?.tags ?? effect?.getFlag?.("add2e", "tags") ?? [];
  const values = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? raw.split(/[,;|\n]+/g)
      : raw && typeof raw === "object"
        ? Object.values(raw)
        : [];
  return values.map(value => String(value ?? "").trim().toLowerCase()).filter(Boolean);
}

function add2eIsFamiliarEffect(effect) {
  return add2eEffectTags(effect).some(tag => tag === "familier" || tag.startsWith("familier:"));
}

function add2eCapturePreviousCurrentBase(document, options = {}) {
  if (!options || options.add2eHitPointResolution === true) return;
  if (Number.isFinite(Number(options.add2ePreviousCurrentBase))) return;
  const actor = add2eEffectConsumerActor(document);
  if (!actor?.system || typeof globalThis.add2eGetHitPointCurrentBase !== "function") return;
  const currentBase = Number(globalThis.add2eGetHitPointCurrentBase(actor));
  if (Number.isFinite(currentBase)) options.add2ePreviousCurrentBase = currentBase;
}

async function add2eWaitForDocumentRemoval(actor, document) {
  if (!actor || !document?.id) return;
  await new Promise(resolve => setTimeout(resolve, 0));
  if (document.documentName === "ActiveEffect" && actor.effects?.has?.(document.id)) {
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  if (document.documentName === "Item" && actor.items?.has?.(document.id)) {
    await new Promise(resolve => setTimeout(resolve, 0));
  }
}

async function add2eRecalculateActorHitPoints(actor, reason, options = {}) {
  if (!actor?.system || !add2eEffectConsumerIsResponsibleGM()) return false;
  if (typeof globalThis.add2eRecalculateHitPoints !== "function") {
    throw new Error("Le recalcul canonique ADD2E des points de vie est indisponible.");
  }
  const previousCurrentBase = Number(options?.add2ePreviousCurrentBase);
  const recalculated = await globalThis.add2eRecalculateHitPoints(actor, {
    reason,
    ...(Number.isFinite(previousCurrentBase) ? { previousCurrentBase } : {})
  });
  if (recalculated && actor.sheet?.rendered === true) await actor.sheet.render({ force: true });
  return recalculated === true;
}

async function add2eConsumeModifierDocumentChange(document, changes = {}, { deleted = false, operationOptions = {} } = {}) {
  const actor = add2eEffectConsumerActor(document);
  if (!actor) return;
  const hitPointsChanged = add2eEffectConsumerHasHitPoints(document)
    || add2eEffectConsumerChangesTouchModifiers(changes);
  const familiarChanged = document?.documentName === "ActiveEffect" && add2eIsFamiliarEffect(document);

  if (deleted) await add2eWaitForDocumentRemoval(actor, document);

  if (hitPointsChanged) {
    await add2eRecalculateActorHitPoints(
      actor,
      deleted ? "modifier-document-deleted" : "modifier-document-changed",
      operationOptions
    );
  } else if (familiarChanged && actor.sheet?.rendered === true) {
    await actor.sheet.render({ force: true });
  }
}

Hooks.on("preCreateActiveEffect", (effect, _data, options = {}) => {
  add2eCapturePreviousCurrentBase(effect, options);
});
Hooks.on("preUpdateActiveEffect", (effect, changes = {}, options = {}) => {
  if (add2eEffectConsumerHasHitPoints(effect) || add2eEffectConsumerChangesTouchModifiers(changes)) {
    add2eCapturePreviousCurrentBase(effect, options);
  }
});
Hooks.on("preDeleteActiveEffect", (effect, options = {}) => {
  if (add2eEffectConsumerHasHitPoints(effect)) add2eCapturePreviousCurrentBase(effect, options);
});
Hooks.on("preCreateItem", (item, _data, options = {}) => {
  add2eCapturePreviousCurrentBase(item, options);
});
Hooks.on("preUpdateItem", (item, changes = {}, options = {}) => {
  if (add2eEffectConsumerHasHitPoints(item) || add2eEffectConsumerChangesTouchModifiers(changes)) {
    add2eCapturePreviousCurrentBase(item, options);
  }
});
Hooks.on("preDeleteItem", (item, options = {}) => {
  if (add2eEffectConsumerHasHitPoints(item)) add2eCapturePreviousCurrentBase(item, options);
});
Hooks.on("preUpdateActor", (actor, changes = {}, options = {}) => {
  if (options?.add2eHitPointResolution === true || !add2eEffectConsumerChangesTouchModifiers(changes)) return;
  add2eCapturePreviousCurrentBase(actor, options);
});

Hooks.on("createActiveEffect", (effect, options = {}) => {
  add2eConsumeModifierDocumentChange(effect, {}, { operationOptions: options })
    .catch(error => console.error("[ADD2E][ACTIVE_EFFECT][CREATE]", error));
});
Hooks.on("updateActiveEffect", (effect, changes = {}, options = {}) => {
  add2eConsumeModifierDocumentChange(effect, changes, { operationOptions: options })
    .catch(error => console.error("[ADD2E][ACTIVE_EFFECT][UPDATE]", error));
});
Hooks.on("deleteActiveEffect", (effect, options = {}) => {
  add2eConsumeModifierDocumentChange(effect, {}, { deleted: true, operationOptions: options })
    .catch(error => console.error("[ADD2E][ACTIVE_EFFECT][DELETE]", error));
});
Hooks.on("createItem", (item, options = {}) => {
  add2eConsumeModifierDocumentChange(item, {}, { operationOptions: options })
    .catch(error => console.error("[ADD2E][ITEM_MODIFIER][CREATE]", error));
});
Hooks.on("updateItem", (item, changes = {}, options = {}) => {
  add2eConsumeModifierDocumentChange(item, changes, { operationOptions: options })
    .catch(error => console.error("[ADD2E][ITEM_MODIFIER][UPDATE]", error));
});
Hooks.on("deleteItem", (item, options = {}) => {
  add2eConsumeModifierDocumentChange(item, {}, { deleted: true, operationOptions: options })
    .catch(error => console.error("[ADD2E][ITEM_MODIFIER][DELETE]", error));
});
Hooks.on("updateActor", (actor, changes = {}, options = {}) => {
  if (options?.add2eHitPointResolution === true || !add2eEffectConsumerChangesTouchModifiers(changes)) return;
  add2eRecalculateActorHitPoints(actor, "actor-modifiers-changed", options)
    .catch(error => console.error("[ADD2E][ACTOR_MODIFIER][UPDATE]", error));
});

Hooks.once("ready", async () => {
  if (!add2eEffectConsumerIsResponsibleGM()) return;
  for (const actor of game.actors?.contents ?? []) {
    const activeHitPoints = Array.from(actor.effects ?? []).some(effect =>
      effect?.disabled !== true && effect?.isSuppressed !== true && add2eEffectConsumerHasHitPoints(effect)
    ) || add2eEffectConsumerHasHitPoints(actor)
      || Array.from(actor.items ?? []).some(item => add2eEffectConsumerHasHitPoints(item));
    if (activeHitPoints) await add2eRecalculateActorHitPoints(actor, "ready-hit-points-resolution");
  }
});

Hooks.once("ready", () => {
  add2eRegisterClassItemSheet();

  const clearClassSheetCache = item => {
    if (!item || item.type !== "classe") return;
    if (item._sheet && !(item._sheet instanceof Add2eItemSheet)) item._sheet = null;
  };

  for (const item of game.items ?? []) clearClassSheetCache(item);
  for (const actor of game.actors ?? []) for (const item of actor.items ?? []) clearClassSheetCache(item);
});

Hooks.on("preCreateItem", itemData => {
  if (itemData.type !== "sort" || !Array.isArray(itemData.effects)) return;
  for (const effect of itemData.effects) {
    effect.transfer = false;
    effect.disabled = true;
  }
});

function add2eEffectExplicitlyLinkedToItem(effect, item) {
  if (!effect || !item) return false;
  const origin = String(effect.origin ?? "");
  const flags = effect.flags?.add2e ?? {};
  const itemId = String(item.id ?? "");
  const itemUuid = String(item.uuid ?? "");
  const sourceId = String(flags.sourceItemId ?? flags.sourceClassId ?? flags.sourceId ?? "");
  const sourceUuid = String(flags.sourceItemUuid ?? flags.sourceClassUuid ?? flags.sourceUuid ?? "");
  return (itemUuid && origin === itemUuid)
    || (itemId && origin.endsWith(`.${itemId}`))
    || (itemId && sourceId === itemId)
    || (itemUuid && sourceUuid === itemUuid);
}

function add2eIsManagedClassPassiveEffect(effect) {
  const flags = effect.flags?.add2e ?? {};
  return flags.autoClassPassiveEffect === true || flags.classPassiveFeatureEffect === true;
}

function add2eIsManagedMagicItemEffect(effect) {
  return effect?.flags?.add2e?.magicItemCatalogueEffect === true;
}

Hooks.on("deleteItem", async (item, options = {}, userId) => {
  if (options?.add2eInternal || options?.add2eMulticlassInternal || options?.add2eClassPurge) return;
  if (game.user.id !== userId) return;
  if (!item.parent || item.parent.documentName !== "Actor") return;

  const actor = item.parent;
  const effectsToDelete = Array.from(actor.effects ?? [])
    .filter(effect => !add2eIsManagedClassPassiveEffect(effect)
      && !add2eIsManagedMagicItemEffect(effect)
      && add2eEffectExplicitlyLinkedToItem(effect, item))
    .map(effect => effect.id)
    .filter(id => actor.effects?.has?.(id));

  if (!effectsToDelete.length) return;
  try {
    await actor.deleteEmbeddedDocuments("ActiveEffect", effectsToDelete, {
      add2eInternal: true,
      add2eReason: "legacy-item-effect-cleanup"
    });
    ui.notifications.info(`Les effets de ${item.name} se sont dissipés.`);
  } catch (error) {
    if (!/ActiveEffect .* does not exist|does not exist/i.test(String(error?.message ?? error))) throw error;
  }
});
