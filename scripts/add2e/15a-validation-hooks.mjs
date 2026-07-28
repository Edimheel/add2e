// ADD2E — Validation hooks et recalcul canonique des documents.
// Compatible Foundry V13/V14/V15.

const ADD2E_CANONICAL_HP_DOCUMENT_HOOKS_VERSION = "2026-07-28-canonical-hit-points-document-hooks-v2";
globalThis.ADD2E_CANONICAL_HP_DOCUMENT_HOOKS_VERSION = ADD2E_CANONICAL_HP_DOCUMENT_HOOKS_VERSION;

const add2eCanonicalHpRecalculationQueue = new Map();

function add2eCanonicalHpList(value) {
  if (Array.isArray(value)) return value.filter(entry => entry && typeof entry === "object");
  if (value && typeof value === "object") return Object.values(value).filter(entry => entry && typeof entry === "object");
  return [];
}

function add2eCanonicalHpDocumentModifiers(document) {
  let value = document?.flags?.add2e?.modifiers;
  if ((value === undefined || value === null) && typeof document?.getFlag === "function") {
    try { value = document.getFlag("add2e", "modifiers"); }
    catch (_error) { value = null; }
  }
  return add2eCanonicalHpList(value);
}

function add2eCanonicalHpHasModifier(document) {
  return add2eCanonicalHpDocumentModifiers(document)
    .some(modifier => String(modifier?.domain ?? "").trim().toLowerCase() === "hit-points");
}

function add2eCanonicalHpItemHasModifier(item) {
  if (add2eCanonicalHpHasModifier(item)) return true;
  return Array.from(item?.effects?.contents ?? item?.effects ?? [])
    .some(effect => add2eCanonicalHpHasModifier(effect));
}

function add2eCanonicalHpChangesTouchModifiers(changes = {}) {
  if (Object.prototype.hasOwnProperty.call(changes, "flags.add2e.modifiers")) return true;
  if (Object.prototype.hasOwnProperty.call(changes, "flags.add2e.-=modifiers")) return true;
  if (typeof foundry?.utils?.hasProperty === "function" && foundry.utils.hasProperty(changes, "flags.add2e.modifiers")) return true;
  return Object.keys(changes).some(key =>
    key === "flags.add2e.modifiers"
    || key === "flags.add2e.-=modifiers"
    || key.startsWith("flags.add2e.modifiers.")
  );
}

function add2eCanonicalHpActor(document) {
  const parent = document?.parent ?? document?.actor ?? null;
  if (parent?.documentName === "Actor") return parent;
  if (document?.documentName === "Actor") return document;
  return null;
}

function add2eCanonicalHpCanRecalculate() {
  if (!game.user?.isGM) return false;
  if (typeof game.user.isActiveGM === "boolean") return game.user.isActiveGM;
  return game.users?.activeGM?.id === game.user.id;
}

function add2eQueueCanonicalHitPointRecalculation(actor, reason = "canonical-hit-points-document-change") {
  if (!actor?.id || !actor?.system || !add2eCanonicalHpCanRecalculate()) return;
  const existing = add2eCanonicalHpRecalculationQueue.get(actor.id);
  if (existing?.scheduled === true) {
    existing.reason = reason;
    return;
  }

  const queued = { actor, reason, scheduled: true };
  add2eCanonicalHpRecalculationQueue.set(actor.id, queued);
  setTimeout(async () => {
    const current = add2eCanonicalHpRecalculationQueue.get(actor.id);
    add2eCanonicalHpRecalculationQueue.delete(actor.id);
    if (!current?.actor || !add2eCanonicalHpCanRecalculate()) return;
    try {
      if (typeof globalThis.add2eRecalculateHitPoints !== "function") {
        throw new Error("Le recalcul canonique ADD2E des points de vie n’est pas disponible.");
      }
      await globalThis.add2eRecalculateHitPoints(current.actor, { reason: current.reason });
      const sheet = current.actor.sheet;
      if (sheet?.rendered === true) await sheet.render({ force: true });
    } catch (error) {
      console.error("[ADD2E][HIT_POINTS][DOCUMENT_RECALCULATION]", {
        actor: current.actor?.name,
        reason: current.reason,
        error
      });
    }
  }, 0);
}

function add2eInstallCanonicalHitPointDocumentHooks() {
  if (globalThis.__ADD2E_CANONICAL_HP_DOCUMENT_HOOKS_VERSION__ === ADD2E_CANONICAL_HP_DOCUMENT_HOOKS_VERSION) return;
  globalThis.__ADD2E_CANONICAL_HP_DOCUMENT_HOOKS_VERSION__ = ADD2E_CANONICAL_HP_DOCUMENT_HOOKS_VERSION;

  Hooks.on("createActiveEffect", effect => {
    if (!add2eCanonicalHpCanRecalculate() || !add2eCanonicalHpHasModifier(effect)) return;
    add2eQueueCanonicalHitPointRecalculation(add2eCanonicalHpActor(effect), "create-active-effect-hit-points");
  });

  Hooks.on("updateActiveEffect", (effect, changes = {}) => {
    if (!add2eCanonicalHpCanRecalculate()) return;
    const stateChanged = Object.prototype.hasOwnProperty.call(changes, "disabled")
      || Object.prototype.hasOwnProperty.call(changes, "isSuppressed");
    if (!stateChanged && !add2eCanonicalHpChangesTouchModifiers(changes) && !add2eCanonicalHpHasModifier(effect)) return;
    add2eQueueCanonicalHitPointRecalculation(add2eCanonicalHpActor(effect), "update-active-effect-hit-points");
  });

  Hooks.on("deleteActiveEffect", effect => {
    if (!add2eCanonicalHpCanRecalculate() || !add2eCanonicalHpHasModifier(effect)) return;
    add2eQueueCanonicalHitPointRecalculation(add2eCanonicalHpActor(effect), "delete-active-effect-hit-points");
  });

  Hooks.on("createItem", item => {
    if (!add2eCanonicalHpCanRecalculate() || !add2eCanonicalHpItemHasModifier(item)) return;
    add2eQueueCanonicalHitPointRecalculation(add2eCanonicalHpActor(item), "create-item-hit-points");
  });

  Hooks.on("updateItem", (item, changes = {}) => {
    if (!add2eCanonicalHpCanRecalculate()) return;
    if (!add2eCanonicalHpChangesTouchModifiers(changes) && !add2eCanonicalHpItemHasModifier(item)) return;
    add2eQueueCanonicalHitPointRecalculation(add2eCanonicalHpActor(item), "update-item-hit-points");
  });

  Hooks.on("deleteItem", item => {
    if (!add2eCanonicalHpCanRecalculate() || !add2eCanonicalHpItemHasModifier(item)) return;
    add2eQueueCanonicalHitPointRecalculation(add2eCanonicalHpActor(item), "delete-item-hit-points");
  });

  Hooks.on("updateActor", (actor, changes = {}) => {
    if (!add2eCanonicalHpCanRecalculate() || !add2eCanonicalHpChangesTouchModifiers(changes)) return;
    add2eQueueCanonicalHitPointRecalculation(actor, "update-actor-hit-points-modifiers");
  });

  Hooks.once("ready", () => {
    if (!add2eCanonicalHpCanRecalculate()) return;
    for (const actor of game.actors?.contents ?? []) {
      const hasActorModifier = add2eCanonicalHpHasModifier(actor);
      const hasEffectModifier = Array.from(actor.effects ?? []).some(effect =>
        effect?.disabled !== true && effect?.isSuppressed !== true && add2eCanonicalHpHasModifier(effect)
      );
      const hasItemModifier = Array.from(actor.items ?? []).some(item => add2eCanonicalHpItemHasModifier(item));
      if (hasActorModifier || hasEffectModifier || hasItemModifier) {
        add2eQueueCanonicalHitPointRecalculation(actor, "ready-canonical-hit-points");
      }
    }
  });
}

add2eInstallCanonicalHitPointDocumentHooks();

Hooks.once("ready", () => {
  add2eRegisterClassItemSheet();

  const clearClassSheetCache = (item) => {
    if (!item || item.type !== "classe") return;

    if (item._sheet && !(item._sheet instanceof Add2eItemSheet)) {
      console.warn("[ADD2E][SHEETS] Cache de fiche classe incorrect vidé", {
        item: item.name,
        cachedSheet: item._sheet?.constructor?.name,
        expected: Add2eItemSheet?.name
      });
      item._sheet = null;
    }
  };

  for (const item of game.items ?? []) clearClassSheetCache(item);

  for (const actor of game.actors ?? []) {
    for (const item of actor.items ?? []) clearClassSheetCache(item);
  }

  console.log("[ADD2E][SHEETS] Contrôle Item.classe", {
    importedClassSheet: Add2eItemSheet?.name,
    exampleWorldClassSheet: game.items.find(i => i.type === "classe")?.sheet?.constructor?.name ?? null,
    exampleEmbeddedClassSheet: game.actors.find(a => a.items?.some(i => i.type === "classe"))?.items?.find(i => i.type === "classe")?.sheet?.constructor?.name ?? null
  });
});

Hooks.on("preCreateItem", (itemData, options, userId) => {
  if (itemData.type === "sort" && Array.isArray(itemData.effects)) {
    for (const eff of itemData.effects) {
      eff.transfer = false;
      eff.disabled = true;
    }
  }
});

async function rollInitiativeD6(combatants) {
  if (!combatants.length) return;

  for (const comb of combatants) {
    const roll = await new Roll("1d6").evaluate({ async: true });

    if (comb.actor) await comb.actor.update({ "system.initiative": roll.total });
    await comb.update({ initiative: roll.total });

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: comb.actor }),
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
  const flags = effect?.flags?.add2e ?? {};
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
    .filter(effect =>
      !add2eIsManagedClassPassiveEffect(effect)
      && !add2eIsManagedMagicItemEffect(effect)
      && add2eEffectExplicitlyLinkedToItem(effect, item)
    )
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

try { globalThis.rollInitiativeD6 = rollInitiativeD6; } catch (_e) {}
