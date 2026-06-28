// ADD2E — Validation hooks et compatibilité legacy.

const ADD2E_FAMILIAR_HP_BRIDGE_VERSION = "2026-06-28-familiar-hp-bridge-v3";
globalThis.ADD2E_FAMILIAR_HP_BRIDGE_VERSION = ADD2E_FAMILIAR_HP_BRIDGE_VERSION;

const add2eFamHpNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

function add2eFamHpRead(source, path) {
  if (Object.prototype.hasOwnProperty.call(source ?? {}, path)) return source[path];
  return foundry?.utils?.getProperty?.(source ?? {}, path);
}

function add2eFamHpState(actor, changes = null) {
  const updated = changes ? add2eFamHpRead(changes, "flags.add2e.familiarHpShare") : undefined;
  const state = updated !== undefined
    ? updated
    : actor?.getFlag?.("add2e", "familiarHpShare") ?? actor?.flags?.add2e?.familiarHpShare ?? null;
  if (!state || typeof state !== "object") return null;
  const linkId = String(state.linkId ?? actor?.getFlag?.("add2e", "familiar")?.linkId ?? actor?.flags?.add2e?.familiar?.linkId ?? "").trim();
  if (!linkId) return null;
  return { linkId, amount: Math.max(0, Math.floor(add2eFamHpNumber(state.amount, 0))) };
}

function add2eFamHpSource(linkId) {
  return `familier:${String(linkId ?? "").trim()}`;
}

function add2eFamHpRecord(linkId, amount) {
  return {
    amount: Math.max(0, Math.floor(add2eFamHpNumber(amount, 0))),
    label: "Vitalité partagée du familier",
    kind: "familier",
    temporary: true,
    linkId: String(linkId ?? "").trim()
  };
}

function add2eFamHpRegistry(actor) {
  const value = actor?.getFlag?.("add2e", "hpModifiers") ?? actor?.flags?.add2e?.hpModifiers ?? {};
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function add2eFamHpModifierAmount(actor, source) {
  return Math.trunc(add2eFamHpNumber(add2eFamHpRegistry(actor)?.[source]?.amount, 0));
}

async function add2eSetActorHpModifier(actor, sourceId, modifier = {}, { reason = "hp-modifier" } = {}) {
  if (!actor?.system || !String(sourceId ?? "").trim()) return false;
  const source = String(sourceId).trim();
  const previous = add2eFamHpModifierAmount(actor, source);
  const desired = Math.trunc(add2eFamHpNumber(modifier.amount ?? modifier.value ?? modifier.bonus, 0));
  const delta = desired - previous;
  const max = add2eFamHpNumber(actor.system.points_de_coup, NaN);
  const current = add2eFamHpNumber(actor.system.pdv, NaN);
  const updates = {};

  if (desired) {
    updates[`flags.add2e.hpModifiers.${source}`] = {
      ...modifier,
      amount: desired,
      label: String(modifier.label ?? modifier.name ?? source)
    };
  } else {
    updates[`flags.add2e.hpModifiers.-=${source}`] = null;
  }
  if (Number.isFinite(max) && delta) updates["system.points_de_coup"] = Math.max(1, max + delta);
  if (Number.isFinite(current) && delta) updates["system.pdv"] = current + delta;
  if (!Object.keys(updates).length) return false;

  await actor.update(updates, {
    add2eHpModifiersFinal: true,
    add2eHpModifiers: true,
    add2eInternal: true,
    add2eReason: reason
  });
  return true;
}

async function add2eRemoveActorHpModifier(actor, sourceId, options = {}) {
  return add2eSetActorHpModifier(actor, sourceId, { amount: 0 }, options);
}

async function add2eFamHpReconcileActor(actor) {
  if (!game.user?.isGM || !actor?.system) return false;
  const beforeMax = add2eFamHpNumber(actor.system.points_de_coup, NaN);
  const beforeCurrent = add2eFamHpNumber(actor.system.pdv, NaN);
  const desired = add2eFamHpState(actor);
  const registry = add2eFamHpRegistry(actor);
  const desiredSource = desired?.amount > 0 ? add2eFamHpSource(desired.linkId) : null;
  const updates = {};
  let changed = false;

  for (const [source, modifier] of Object.entries(registry)) {
    if (modifier?.kind !== "familier" || modifier?.temporary !== true) continue;
    if (source === desiredSource && add2eFamHpNumber(modifier.amount, 0) === desired.amount) continue;
    updates[`flags.add2e.hpModifiers.-=${source}`] = null;
    changed = true;
  }

  if (desiredSource) {
    const current = registry[desiredSource];
    if (!current
      || add2eFamHpNumber(current.amount, 0) !== desired.amount
      || current.kind !== "familier"
      || current.temporary !== true) {
      updates[`flags.add2e.hpModifiers.${desiredSource}`] = add2eFamHpRecord(desired.linkId, desired.amount);
      changed = true;
    }
  }

  if (!changed) return false;

  await actor.update(updates, {
    add2eHpModifiersMigration: true,
    add2eHpModifiersFinal: true,
    add2eInternal: true,
    add2eReason: "reconcile-familiar-hp-modifier"
  });
  await globalThis.add2eRecalculateActorHpModifiers?.(actor, { reason: "reconcile-familiar-hp-modifier" });

  const delta = add2eFamHpNumber(actor.system.points_de_coup, beforeMax) - beforeMax;
  if (Number.isFinite(beforeCurrent) && delta) {
    await actor.update({ "system.pdv": beforeCurrent + delta }, {
      add2eHpModifiersFinal: true,
      add2eInternal: true,
      add2eReason: "reconcile-familiar-hp-current"
    });
  }
  return true;
}

if (!globalThis.__ADD2E_FAMILIAR_HP_BRIDGE_REGISTERED__) {
  globalThis.__ADD2E_FAMILIAR_HP_BRIDGE_REGISTERED__ = true;

  Hooks.on("preUpdateActor", (actor, changes = {}, options = {}) => {
    if (options?.add2eFamiliarHpShare === true) {
      const after = add2eFamHpState(actor, changes);
      if (!after) return;
      const source = add2eFamHpSource(after.linkId);
      delete changes["flags.add2e.hpModifiers"];
      if (after.amount > 0) changes[`flags.add2e.hpModifiers.${source}`] = add2eFamHpRecord(after.linkId, after.amount);
      else changes[`flags.add2e.hpModifiers.-=${source}`] = null;
      return;
    }

    if (options?.add2eFamiliarDeathPenalty === true) {
      const linkId = String(actor?.getFlag?.("add2e", "familiar")?.linkId ?? actor?.flags?.add2e?.familiar?.linkId ?? "").trim();
      const previous = add2eFamHpNumber(actor?.system?.points_de_coup, NaN);
      const next = add2eFamHpNumber(add2eFamHpRead(changes, "system.points_de_coup"), NaN);
      const penalty = Number.isFinite(previous) && Number.isFinite(next) ? Math.max(0, Math.floor(previous - next)) : 0;
      if (!linkId || !penalty) return;
      delete changes["flags.add2e.hpModifiers"];
      changes[`flags.add2e.hpModifiers.familier-penalite:${linkId}`] = {
        amount: -penalty,
        label: "Pénalité de mort du familier",
        kind: "familier",
        persistent: true,
        linkId
      };
    }
  });

  Hooks.once("ready", () => {
    globalThis.add2eSetActorHpModifier = add2eSetActorHpModifier;
    globalThis.add2eRemoveActorHpModifier = add2eRemoveActorHpModifier;
    if (!game.user?.isGM) return;
    setTimeout(() => {
      for (const actor of game.actors?.contents ?? []) add2eFamHpReconcileActor(actor).catch(() => {});
    }, 500);
  });
}

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

Hooks.on("deleteItem", async (item, options = {}, userId) => {
  if (options?.add2eInternal || options?.add2eMulticlassInternal || options?.add2eClassPurge) return;
  if (game.user.id !== userId) return;
  if (!item.parent || item.parent.documentName !== "Actor") return;

  const actor = item.parent;
  const effectsToDelete = Array.from(actor.effects ?? [])
    .filter(effect => add2eEffectExplicitlyLinkedToItem(effect, item))
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