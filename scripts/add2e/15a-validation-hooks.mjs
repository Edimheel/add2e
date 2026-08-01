// ADD2E — Validation des documents et consommateurs directs des effets.
// Compatible Foundry V13/V14/V15.

const ADD2E_DOCUMENT_EFFECT_CONSUMERS_VERSION = "2026-08-01-druid-form-restore-v11";
globalThis.ADD2E_DOCUMENT_EFFECT_CONSUMERS_VERSION = ADD2E_DOCUMENT_EFFECT_CONSUMERS_VERSION;

const ADD2E_DRUID_ANIMAL_FORM_SCOPE = "druid-animal-form";
const ADD2E_TRANSFORMATION_STATE_FLAG = "capabilityTransformations";
const ADD2E_DRUID_ANIMAL_FORM_RESTORE_QUEUE = new Set();

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

function add2eDruidAnimalFormMeta(effect) {
  const meta = effect?.flags?.add2e?.capabilityTransformation ?? {};
  return meta?.sourceKey === ADD2E_DRUID_ANIMAL_FORM_SCOPE && meta?.kind === "form"
    ? meta
    : null;
}

function add2eDruidAnimalFormState(actor) {
  const root = actor?.getFlag?.("add2e", ADD2E_TRANSFORMATION_STATE_FLAG) ?? {};
  const state = root?.[ADD2E_DRUID_ANIMAL_FORM_SCOPE] ?? null;
  return {
    root: root && typeof root === "object" ? root : {},
    state: state && typeof state === "object" ? state : null
  };
}

function add2eDruidAnimalFormActorKey(actor) {
  return String(actor?.uuid ?? actor?.id ?? "").trim();
}

function add2eDruidAnimalFormNaturalAttackIds(actor, state = {}) {
  const ids = new Set(Array.isArray(state?.naturalAttackIds) ? state.naturalAttackIds.filter(Boolean) : []);
  for (const item of actor?.items ?? []) {
    const meta = item?.flags?.add2e?.capabilityTransformation ?? {};
    if (meta.sourceKey === ADD2E_DRUID_ANIMAL_FORM_SCOPE && meta.kind === "natural-attack" && item.id) ids.add(item.id);
  }
  return [...ids].filter(id => actor?.items?.has?.(id));
}

async function add2eDruidAnimalFormClearState(actor, root = {}) {
  const next = typeof foundry?.utils?.deepClone === "function"
    ? foundry.utils.deepClone(root)
    : { ...(root && typeof root === "object" ? root : {}) };
  delete next[ADD2E_DRUID_ANIMAL_FORM_SCOPE];
  if (Object.keys(next).length) {
    await actor.setFlag("add2e", ADD2E_TRANSFORMATION_STATE_FLAG, next);
  } else {
    await actor.unsetFlag("add2e", ADD2E_TRANSFORMATION_STATE_FLAG);
  }
}

async function add2eRestoreDruidAnimalFormAfterEffectDeletion(effect, options = {}) {
  if (options?.add2eDruideTransformationInternal) return false;
  if (!add2eEffectConsumerIsResponsibleGM()) return false;
  if (!add2eDruidAnimalFormMeta(effect)) return false;

  const actor = add2eEffectConsumerActor(effect);
  if (!actor) return false;

  const queueKey = add2eDruidAnimalFormActorKey(actor);
  if (!queueKey || ADD2E_DRUID_ANIMAL_FORM_RESTORE_QUEUE.has(queueKey)) return false;
  ADD2E_DRUID_ANIMAL_FORM_RESTORE_QUEUE.add(queueKey);

  try {
    // Le script de capacité installe encore son hook durant la session courante.
    // Ce délai lui laisse la priorité ; après un rechargement, l'état reste présent
    // et ce consommateur permanent prend alors en charge la restauration.
    await new Promise(resolve => setTimeout(resolve, 250));

    const stored = add2eDruidAnimalFormState(actor);
    if (!stored.state) return false;
    if (stored.state.effectId && effect?.id && String(stored.state.effectId) !== String(effect.id)) return false;

    const snapshot = stored.state.snapshot ?? {};
    const naturalAttackIds = add2eDruidAnimalFormNaturalAttackIds(actor, stored.state);
    if (naturalAttackIds.length) {
      try {
        await actor.deleteEmbeddedDocuments("Item", naturalAttackIds, {
          add2eInternal: true,
          add2eReason: "capability-transformation-effect-removed"
        });
      } catch (error) {
        if (!/does not exist|introuvable/i.test(String(error?.message ?? error))) throw error;
      }
    }

    const combatUpdate = {};
    for (const key of ["ca", "ca_optimale", "ca_naturel", "ca_total", "thac0"]) {
      if (Object.prototype.hasOwnProperty.call(snapshot?.combat ?? {}, key)) {
        combatUpdate[`system.${key}`] = snapshot.combat[key];
      }
    }
    if (Object.keys(combatUpdate).length) {
      await actor.update(combatUpdate, {
        add2eInternal: true,
        add2eReason: "capability-transformation-combat-restore",
        render: false
      });
    }

    const equipmentUpdates = (Array.isArray(snapshot?.equipment) ? snapshot.equipment : [])
      .filter(entry => entry?.id && actor.items?.has?.(entry.id))
      .map(entry => {
        const update = { _id: entry.id, "system.equipee": entry.equipee === true };
        if (entry.hasEquipped) update["system.equipped"] = entry.equipped === true;
        return update;
      });
    if (equipmentUpdates.length) {
      await actor.updateEmbeddedDocuments("Item", equipmentUpdates, {
        add2eInternal: true,
        add2eReason: "capability-transformation-restore-equipment"
      });
    }

    await Promise.all((Array.isArray(snapshot?.tokens) ? snapshot.tokens : []).map(async entry => {
      const token = game.scenes?.get?.(entry?.sceneId)?.tokens?.get?.(entry?.tokenId) ?? null;
      if (!token || !entry?.textureSrc) return;
      await token.update(
        { "texture.src": entry.textureSrc },
        {
          add2eInternal: true,
          add2eDruideTransformationInternal: true,
          add2eReason: "capability-transformation-token-restore"
        }
      );
    }));

    await add2eDruidAnimalFormClearState(actor, stored.root);
    if (actor.sheet?.rendered === true) await actor.sheet.render({ force: true });
    return true;
  } finally {
    ADD2E_DRUID_ANIMAL_FORM_RESTORE_QUEUE.delete(queueKey);
  }
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
  add2eRestoreDruidAnimalFormAfterEffectDeletion(effect, options)
    .catch(error => console.error("[ADD2E][FORME_ANIMALE][PERMANENT_RESTORE]", error));
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
