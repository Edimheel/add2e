// ADD2E — Validation des documents et consommateurs directs des effets.
// Compatible Foundry V13/V14/V15.

const ADD2E_DOCUMENT_EFFECT_CONSUMERS_VERSION = "2026-07-28-direct-familiar-consumers-v4";
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

function add2eIsFamiliarCapability(effect) {
  if (!effect || effect.disabled === true || effect.isSuppressed === true) return false;
  const tags = add2eEffectTags(effect);
  if (!tags.some(tag => tag === "familier" || tag.startsWith("familier:"))) return false;
  if (tags.includes("familier:partage_pv")) return false;
  if (tags.includes("familier:penalite_mort")) return false;
  if (tags.includes("familier:partage_sens")) return false;
  if (tags.includes("familier:suivi")) return false;
  return true;
}

function add2eFamiliarCapability(effect) {
  const familiar = effect?.flags?.add2e?.familiar ?? {};
  const name = String(effect?.name ?? effect?.label ?? "Capacité de familier")
    .replace(/^\s*Familier\s*[—–-]\s*/i, "")
    .trim() || "Capacité de familier";
  const description = String(
    effect?.description
    ?? effect?.flags?.add2e?.description
    ?? effect?.getFlag?.("core", "description")
    ?? ""
  ).trim();
  return {
    id: `familiar-effect:${effect.id}`,
    key: `familiar-effect:${effect.id}`,
    name,
    label: name,
    description,
    img: effect.img || "icons/svg/aura.svg",
    sourceName: `Familier — ${String(familiar.familiarLabel ?? "Familier").trim()}`,
    familiar: true,
    passive: true,
    activable: false,
    canRoll: false,
    rollLabel: ""
  };
}

function add2eFamiliarCapabilities(actor) {
  return Array.from(actor?.effects ?? [])
    .filter(add2eIsFamiliarCapability)
    .map(add2eFamiliarCapability);
}

function add2eInstallFamiliarCapabilityConsumer() {
  const prototype = globalThis.Add2eActorSheet?.prototype;
  if (!prototype || prototype.__add2eFamiliarCapabilityConsumerVersion === ADD2E_DOCUMENT_EFFECT_CONSUMERS_VERSION) return false;
  const base = prototype.getData;
  if (typeof base !== "function") throw new Error("Le getData ApplicationV2 du personnage est indisponible.");

  prototype.getData = async function add2eGetDataWithFamiliarCapabilities(...args) {
    const data = await base.apply(this, args);
    const actor = this.actor ?? this.document;
    const familiar = add2eFamiliarCapabilities(actor);
    data.activeEffectCapabilities = familiar;
    data.familiarCapabilities = familiar;
    return data;
  };
  prototype.__add2eFamiliarCapabilityConsumerVersion = ADD2E_DOCUMENT_EFFECT_CONSUMERS_VERSION;
  return true;
}

async function add2eRecalculateActorHitPoints(actor, reason) {
  if (!actor?.system || !add2eEffectConsumerIsResponsibleGM()) return false;
  if (typeof globalThis.add2eRecalculateHitPoints !== "function") {
    throw new Error("Le recalcul canonique ADD2E des points de vie est indisponible.");
  }
  await globalThis.add2eRecalculateHitPoints(actor, { reason });
  if (actor.sheet?.rendered === true) await actor.sheet.render({ force: true });
  return true;
}

async function add2eConsumeActiveEffectChange(effect, changes = {}) {
  const actor = add2eEffectConsumerActor(effect);
  if (!actor) return;
  const stateChanged = Object.prototype.hasOwnProperty.call(changes, "disabled")
    || Object.prototype.hasOwnProperty.call(changes, "isSuppressed");
  const hitPointsChanged = add2eEffectConsumerHasHitPoints(effect)
    || add2eEffectConsumerChangesTouchModifiers(changes);
  const familiarChanged = add2eIsFamiliarEffect(effect);

  if (hitPointsChanged) await add2eRecalculateActorHitPoints(actor, "active-effect-hit-points");
  else if (familiarChanged && (stateChanged || Object.keys(changes).length === 0) && actor.sheet?.rendered === true) {
    await actor.sheet.render({ force: true });
  }
}

add2eInstallFamiliarCapabilityConsumer();

Hooks.on("createActiveEffect", effect => {
  add2eConsumeActiveEffectChange(effect).catch(error => console.error("[ADD2E][ACTIVE_EFFECT][CREATE]", error));
});
Hooks.on("updateActiveEffect", (effect, changes = {}) => {
  add2eConsumeActiveEffectChange(effect, changes).catch(error => console.error("[ADD2E][ACTIVE_EFFECT][UPDATE]", error));
});
Hooks.on("deleteActiveEffect", effect => {
  add2eConsumeActiveEffectChange(effect).catch(error => console.error("[ADD2E][ACTIVE_EFFECT][DELETE]", error));
});

Hooks.once("ready", async () => {
  if (!add2eEffectConsumerIsResponsibleGM()) return;
  for (const actor of game.actors?.contents ?? []) {
    const activeHitPoints = Array.from(actor.effects ?? []).some(effect =>
      effect?.disabled !== true && effect?.isSuppressed !== true && add2eEffectConsumerHasHitPoints(effect)
    );
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

globalThis.rollInitiativeD6 = rollInitiativeD6;
