// ADD2E — Validation des documents et consommateurs directs des effets.
// Compatible Foundry V13/V14/V15.

const ADD2E_DOCUMENT_EFFECT_CONSUMERS_VERSION = "2026-07-28-familiar-hp-diagnostics-v7";
globalThis.ADD2E_DOCUMENT_EFFECT_CONSUMERS_VERSION = ADD2E_DOCUMENT_EFFECT_CONSUMERS_VERSION;

let add2eHpDiagnosticSequence = 0;

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

function add2eEffectConsumerHasHitPoints(document) {
  return add2eEffectConsumerModifiers(document)
    .some(modifier => String(modifier?.domain ?? "").trim().toLowerCase() === "hit-points");
}

function add2eEffectConsumerChangesTouchModifiers(changes = {}) {
  if (Object.prototype.hasOwnProperty.call(changes, "flags.add2e.modifiers")) return true;
  if (Object.prototype.hasOwnProperty.call(changes, "flags.add2e.-=modifiers")) return true;
  if (foundry.utils.hasProperty(changes, "flags.add2e.modifiers")) return true;
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

function add2eEffectDiagnosticRow(effect) {
  const familiar = effect?.flags?.add2e?.familiar ?? effect?.getFlag?.("add2e", "familiar") ?? null;
  const tags = add2eEffectTags(effect);
  const modifiers = add2eEffectConsumerModifiers(effect);
  const kind = String(familiar?.kind ?? "").trim().toLowerCase();
  return {
    id: effect?.id ?? null,
    name: effect?.name ?? "",
    disabled: effect?.disabled === true,
    isSuppressed: effect?.isSuppressed === true,
    active: effect?.active,
    kind,
    linkId: familiar?.linkId ?? null,
    tags,
    hitPointModifiers: modifiers
      .filter(modifier => String(modifier?.domain ?? "").trim().toLowerCase() === "hit-points")
      .map(modifier => ({
        id: modifier.id ?? null,
        target: modifier.target ?? null,
        operation: modifier.operation ?? null,
        value: modifier.value ?? null,
        stacking: modifier.stacking ?? null,
        source: modifier.source ?? null
      })),
    familiarCapabilityCandidate: effect?.disabled !== true
      && effect?.isSuppressed !== true
      && kind === "benefit"
      && !tags.includes("familier:partage_pv")
  };
}

function add2eHpDiagnosticSnapshot(actor) {
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine ?? null;
  const effects = Array.from(actor?.effects ?? []).map(add2eEffectDiagnosticRow);
  let collectedHitPoints = [];
  let contribution = null;
  let collectionError = null;

  try {
    if (typeof engine?.collect === "function") {
      collectedHitPoints = engine.collect(actor, {
        actor,
        source: "familiar-hp-diagnostic",
        consumer: "15a-validation-hooks"
      })
        .filter(modifier => String(modifier?.domain ?? "").trim().toLowerCase() === "hit-points")
        .map(modifier => ({
          id: modifier.id ?? null,
          target: modifier.target ?? null,
          operation: modifier.operation ?? null,
          value: modifier.value ?? null,
          source: modifier.source ?? null,
          effectId: modifier?._context?.sourceEffect?.id ?? null,
          effectName: modifier?._context?.sourceEffect?.name ?? null,
          itemId: modifier?._context?.sourceItem?.id ?? null,
          itemName: modifier?._context?.sourceItem?.name ?? null
        }));
    }
    if (typeof engine?.resolve === "function") {
      const resolved = engine.resolve(actor, {
        domain: "hit-points",
        target: "maximum",
        base: 0,
        context: {
          actor,
          source: "familiar-hp-diagnostic",
          consumer: "15a-validation-hooks"
        }
      });
      contribution = {
        totalFromZero: resolved?.total ?? null,
        additionsTotal: resolved?.additionsTotal ?? null,
        applied: Array.isArray(resolved?.applied)
          ? resolved.applied.map(entry => ({
              id: entry?.modifier?.id ?? null,
              value: entry?.modifier?.value ?? null,
              source: entry?.modifier?.source?.name ?? null
            }))
          : [],
        rejected: Array.isArray(resolved?.rejected)
          ? resolved.rejected.map(entry => ({
              id: entry?.modifier?.id ?? null,
              reason: entry?.reason ?? null
            }))
          : []
      };
    }
  } catch (error) {
    collectionError = {
      message: error?.message ?? String(error),
      stack: error?.stack ?? null
    };
  }

  const classes = Array.from(actor?.items ?? [])
    .filter(item => String(item?.type ?? "").toLowerCase() === "classe")
    .map(item => ({
      id: item.id,
      name: item.name,
      niveau: item.system?.niveau ?? null,
      level: item.system?.level ?? null,
      hitDie: item.system?.hitDie ?? item.system?.dv ?? null
    }));

  return {
    actorId: actor?.id ?? null,
    actorUuid: actor?.uuid ?? null,
    actorName: actor?.name ?? "",
    hp: {
      maximum: actor?.system?.points_de_coup ?? null,
      current: actor?.system?.pdv ?? null,
      hpRolls: actor?.system?.hpRolls ?? null,
      hpRollsMulticlass: actor?.system?.hpRollsMulticlass ?? null
    },
    familiarLink: actor?.flags?.add2e?.familiar ?? null,
    calculator: globalThis.Add2eActorSheet?.prototype?.autoSetPointsDeCoup?.name ?? null,
    classes,
    effects,
    collectedHitPoints,
    contribution,
    collectionError
  };
}

async function add2eSheetDiagnosticSnapshot(actor, cycleId, reason) {
  let data = null;
  let error = null;
  try {
    const sheet = actor?.sheet;
    if (typeof sheet?.getData === "function") data = await sheet.getData();
  } catch (caught) {
    error = {
      message: caught?.message ?? String(caught),
      stack: caught?.stack ?? null
    };
  }

  console.log("[ADD2E][FAMILIAR_DIAG][SHEET_DATA]", {
    cycleId,
    reason,
    actor: actor?.name ?? null,
    sheetClass: actor?.sheet?.constructor?.name ?? null,
    sheetRendered: actor?.sheet?.rendered === true,
    actorEffects: Array.from(actor?.effects ?? []).map(add2eEffectDiagnosticRow),
    activeEffectsList: Array.isArray(data?.activeEffectsList)
      ? data.activeEffectsList.map(entry => ({ id: entry?.id, name: entry?.name }))
      : null,
    activeRacialCapabilities: Array.isArray(data?.activeRacialCapabilities)
      ? data.activeRacialCapabilities.map(entry => ({
          id: entry?.id,
          label: entry?.label,
          familiar: entry?.familiar === true
        }))
      : null,
    activeTab: data?.activeTab ?? null,
    error
  });
}

async function add2eWaitForDocumentRemoval(actor, document, cycleId) {
  if (!actor || !document?.id) return;
  const collection = document.documentName === "ActiveEffect" ? actor.effects : actor.items;
  const before = collection?.has?.(document.id) === true;
  await new Promise(resolve => setTimeout(resolve, 0));
  const afterFirstTick = collection?.has?.(document.id) === true;
  if (afterFirstTick) await new Promise(resolve => setTimeout(resolve, 0));
  const afterSecondTick = collection?.has?.(document.id) === true;
  console.log("[ADD2E][HP_DIAG][DOCUMENT_REMOVAL]", {
    cycleId,
    actor: actor.name,
    documentType: document.documentName,
    documentId: document.id,
    documentName: document.name,
    before,
    afterFirstTick,
    afterSecondTick
  });
}

async function add2eRecalculateActorHitPoints(actor, reason, cycleId = `hp-${++add2eHpDiagnosticSequence}`) {
  const responsibleGM = add2eEffectConsumerIsResponsibleGM();
  console.log("[ADD2E][HP_DIAG][RECALC_START]", {
    cycleId,
    reason,
    responsibleGM,
    snapshot: add2eHpDiagnosticSnapshot(actor)
  });

  if (!actor?.system || !responsibleGM) {
    console.warn("[ADD2E][HP_DIAG][RECALC_SKIPPED]", {
      cycleId,
      reason,
      actor: actor?.name ?? null,
      hasSystem: Boolean(actor?.system),
      responsibleGM
    });
    return false;
  }
  if (typeof globalThis.add2eRecalculateHitPoints !== "function") {
    throw new Error("Le recalcul canonique ADD2E des points de vie est indisponible.");
  }

  let recalculated = false;
  let error = null;
  try {
    recalculated = await globalThis.add2eRecalculateHitPoints(actor, { reason });
  } catch (caught) {
    error = {
      message: caught?.message ?? String(caught),
      stack: caught?.stack ?? null
    };
    throw caught;
  } finally {
    console.log("[ADD2E][HP_DIAG][RECALC_END]", {
      cycleId,
      reason,
      recalculated,
      error,
      snapshot: add2eHpDiagnosticSnapshot(actor)
    });
  }

  if (recalculated && actor.sheet?.rendered === true) await actor.sheet.render({ force: true });
  return recalculated === true;
}

async function add2eConsumeModifierDocumentChange(document, changes = {}, { deleted = false } = {}) {
  const cycleId = `hp-doc-${++add2eHpDiagnosticSequence}`;
  const actor = add2eEffectConsumerActor(document);
  if (!actor) {
    console.warn("[ADD2E][HP_DIAG][DOCUMENT_WITHOUT_ACTOR]", {
      cycleId,
      deleted,
      documentType: document?.documentName ?? null,
      documentId: document?.id ?? null,
      documentName: document?.name ?? null
    });
    return;
  }

  const hitPointsChanged = add2eEffectConsumerHasHitPoints(document)
    || add2eEffectConsumerChangesTouchModifiers(changes);
  const familiarChanged = document?.documentName === "ActiveEffect" && add2eIsFamiliarEffect(document);

  console.log("[ADD2E][HP_DIAG][DOCUMENT_CHANGE]", {
    cycleId,
    deleted,
    actor: actor.name,
    documentType: document?.documentName ?? null,
    documentId: document?.id ?? null,
    documentName: document?.name ?? null,
    documentStillEmbedded: document?.documentName === "ActiveEffect"
      ? actor.effects?.has?.(document.id) === true
      : document?.documentName === "Item"
        ? actor.items?.has?.(document.id) === true
        : null,
    hitPointsChanged,
    familiarChanged,
    changes,
    tags: document?.documentName === "ActiveEffect" ? add2eEffectTags(document) : [],
    familiar: document?.flags?.add2e?.familiar ?? null,
    modifiers: add2eEffectConsumerModifiers(document),
    actorBefore: add2eHpDiagnosticSnapshot(actor)
  });

  if (deleted) await add2eWaitForDocumentRemoval(actor, document, cycleId);

  if (hitPointsChanged) {
    await add2eRecalculateActorHitPoints(
      actor,
      deleted ? "modifier-document-deleted" : "modifier-document-changed",
      cycleId
    );
  }

  if (familiarChanged) {
    await add2eSheetDiagnosticSnapshot(actor, cycleId, deleted ? "familiar-effect-deleted" : "familiar-effect-changed");
    if (!hitPointsChanged && actor.sheet?.rendered === true) await actor.sheet.render({ force: true });
  }
}

Hooks.on("createActiveEffect", effect => {
  add2eConsumeModifierDocumentChange(effect).catch(error => console.error("[ADD2E][ACTIVE_EFFECT][CREATE]", error));
});
Hooks.on("updateActiveEffect", (effect, changes = {}) => {
  add2eConsumeModifierDocumentChange(effect, changes).catch(error => console.error("[ADD2E][ACTIVE_EFFECT][UPDATE]", error));
});
Hooks.on("deleteActiveEffect", effect => {
  add2eConsumeModifierDocumentChange(effect, {}, { deleted: true }).catch(error => console.error("[ADD2E][ACTIVE_EFFECT][DELETE]", error));
});
Hooks.on("createItem", item => {
  add2eConsumeModifierDocumentChange(item).catch(error => console.error("[ADD2E][ITEM_MODIFIER][CREATE]", error));
});
Hooks.on("updateItem", (item, changes = {}) => {
  add2eConsumeModifierDocumentChange(item, changes).catch(error => console.error("[ADD2E][ITEM_MODIFIER][UPDATE]", error));
});
Hooks.on("deleteItem", item => {
  add2eConsumeModifierDocumentChange(item, {}, { deleted: true }).catch(error => console.error("[ADD2E][ITEM_MODIFIER][DELETE]", error));
});
Hooks.on("updateActor", (actor, changes = {}, options = {}) => {
  if (options?.add2eHitPointResolution === true || !add2eEffectConsumerChangesTouchModifiers(changes)) return;
  const cycleId = `hp-actor-${++add2eHpDiagnosticSequence}`;
  console.log("[ADD2E][HP_DIAG][ACTOR_MODIFIER_CHANGE]", {
    cycleId,
    actor: actor?.name ?? null,
    changes,
    options,
    snapshot: add2eHpDiagnosticSnapshot(actor)
  });
  add2eRecalculateActorHitPoints(actor, "actor-modifiers-changed", cycleId)
    .catch(error => console.error("[ADD2E][ACTOR_MODIFIER][UPDATE]", error));
});

Hooks.once("ready", async () => {
  if (!add2eEffectConsumerIsResponsibleGM()) return;
  for (const actor of game.actors?.contents ?? []) {
    const activeHitPoints = Array.from(actor.effects ?? []).some(effect =>
      effect?.disabled !== true && effect?.isSuppressed !== true && add2eEffectConsumerHasHitPoints(effect)
    ) || add2eEffectConsumerHasHitPoints(actor)
      || Array.from(actor.items ?? []).some(item => add2eEffectConsumerHasHitPoints(item));
    const hasFamiliar = Boolean(actor?.flags?.add2e?.familiar)
      || Array.from(actor.effects ?? []).some(add2eIsFamiliarEffect);

    if (activeHitPoints || hasFamiliar) {
      const cycleId = `hp-ready-${++add2eHpDiagnosticSequence}`;
      console.log("[ADD2E][HP_DIAG][READY_ACTOR]", {
        cycleId,
        activeHitPoints,
        hasFamiliar,
        snapshot: add2eHpDiagnosticSnapshot(actor)
      });
      if (activeHitPoints) await add2eRecalculateActorHitPoints(actor, "ready-hit-points-resolution", cycleId);
      if (hasFamiliar) await add2eSheetDiagnosticSnapshot(actor, cycleId, "ready-familiar-sheet-data");
    }
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

async function rollInitiativeD6(combatants) {
  if (!combatants.length) return;
  for (const combatant of combatants) {
    const roll = await new Roll("1d6").evaluate({ async: true });
    if (combatant.actor) await combatant.actor.update({ "system.initiative": roll.total });
    await combatant.update({ initiative: roll.total });
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: combatant.actor }),
      content: `Initiative : <b>${roll.total}</b> (1d6)`,
      flavor: "Initiative"
    });
  }
}

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

globalThis.add2eFamiliarHpDiagnostic = async actorOrId => {
  const actor = typeof actorOrId === "string"
    ? game.actors?.get?.(actorOrId) ?? game.actors?.getName?.(actorOrId)
    : actorOrId;
  if (!actor) throw new Error("Acteur introuvable pour le diagnostic familier/PV.");
  const cycleId = `hp-manual-${++add2eHpDiagnosticSequence}`;
  const snapshot = add2eHpDiagnosticSnapshot(actor);
  console.log("[ADD2E][HP_DIAG][MANUAL]", { cycleId, snapshot });
  await add2eSheetDiagnosticSnapshot(actor, cycleId, "manual");
  return snapshot;
};

globalThis.rollInitiativeD6 = rollInitiativeD6;
