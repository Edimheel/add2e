// ADD2E — Validation des documents et consommateurs directs des effets.
// Compatible Foundry V13/V14/V15.

const ADD2E_DOCUMENT_EFFECT_CONSUMERS_VERSION = "2026-07-28-direct-familiar-consumers-v3";
globalThis.ADD2E_DOCUMENT_EFFECT_CONSUMERS_VERSION = ADD2E_DOCUMENT_EFFECT_CONSUMERS_VERSION;

function add2eEffectConsumerClone(value) {
  if (value === undefined || value === null) return value;
  if (typeof foundry?.utils?.deepClone === "function") return foundry.utils.deepClone(value);
  if (typeof foundry?.utils?.duplicate === "function") return foundry.utils.duplicate(value);
  return JSON.parse(JSON.stringify(value));
}

function add2eEffectConsumerList(value) {
  if (Array.isArray(value)) return value.filter(entry => entry && typeof entry === "object");
  if (value && typeof value === "object") return Object.values(value).filter(entry => entry && typeof entry === "object");
  return [];
}

function add2eEffectConsumerModifiers(document) {
  let value = document?.flags?.add2e?.modifiers;
  if ((value === undefined || value === null) && typeof document?.getFlag === "function") {
    try { value = document.getFlag("add2e", "modifiers"); }
    catch (_error) { value = null; }
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
  if (typeof foundry?.utils?.hasProperty === "function" && foundry.utils.hasProperty(changes, "flags.add2e.modifiers")) return true;
  return Object.keys(changes ?? {}).some(key => key === "flags.add2e.modifiers"
    || key === "flags.add2e.-=modifiers"
    || key.startsWith("flags.add2e.modifiers."));
}

function add2eEffectConsumerActor(document) {
  const parent = document?.parent ?? document?.actor ?? null;
  if (parent?.documentName === "Actor") return parent;
  if (document?.documentName === "Actor") return document;
  return null;
}

function add2eEffectConsumerOwnsHook(userId) {
  return !userId || String(userId) === String(game.user?.id ?? "");
}

function add2eEffectConsumerIsResponsibleGM() {
  if (!game.user?.isGM) return false;
  if (typeof game.user.isActiveGM === "boolean") return game.user.isActiveGM;
  return game.users?.activeGM?.id === game.user.id;
}

async function add2eRecalculateHitPointsDirect(actor, { reason = "canonical-hit-points", force = false } = {}) {
  if (!actor?.system) return false;
  const classes = Array.from(actor.items ?? []).filter(item => String(item?.type ?? "").toLowerCase() === "classe");

  if (classes.length > 1) {
    if (typeof globalThis.add2eSyncMulticlassHp !== "function") {
      throw new Error("Le calcul canonique des PV multiclassés est indisponible.");
    }
    await globalThis.add2eSyncMulticlassHp(actor, { force, reason });
  } else {
    const calculate = globalThis.Add2eActorSheet?.prototype?.autoSetPointsDeCoup;
    if (typeof calculate !== "function") {
      throw new Error("Le calcul canonique des PV monoclasse est indisponible.");
    }
    await calculate.call({ actor }, { force, reason });
  }

  const sheet = actor.sheet;
  if (sheet?.rendered === true) await sheet.render({ force: true });
  return true;
}

globalThis.add2eRecalculateHitPoints = add2eRecalculateHitPointsDirect;

function add2eFamiliarEffectData(effect) {
  return effect?.flags?.add2e?.familiar ?? effect?.getFlag?.("add2e", "familiar") ?? null;
}

function add2eFamiliarEffectTags(effect) {
  let raw = effect?.flags?.add2e?.tags;
  if ((raw === undefined || raw === null) && typeof effect?.getFlag === "function") {
    try { raw = effect.getFlag("add2e", "tags"); }
    catch (_error) { raw = null; }
  }
  if (Array.isArray(raw)) return raw.map(value => String(value ?? "").trim()).filter(Boolean);
  if (typeof raw === "string") return raw.split(/[,;|\n]+/g).map(value => value.trim()).filter(Boolean);
  if (raw && typeof raw === "object") return Object.values(raw).map(value => String(value ?? "").trim()).filter(Boolean);
  return [];
}

function add2eFamiliarEffectIsBenefit(effect) {
  return add2eFamiliarEffectData(effect)?.kind === "benefit";
}

function add2eFamiliarEffectIsVitality(effect) {
  if (add2eEffectConsumerHasHitPoints(effect)) return true;
  return add2eFamiliarEffectTags(effect).some(tag => String(tag).trim().toLowerCase() === "familier:partage_pv");
}

function add2eFamiliarEffectDescription(effect) {
  return String(
    effect?.description
    ?? effect?.flags?.add2e?.description
    ?? effect?.getFlag?.("core", "description")
    ?? ""
  ).trim();
}

function add2eFamiliarCapabilityIcon(effect) {
  const text = `${effect?.name ?? ""} ${add2eFamiliarEffectTags(effect).join(" ")}`
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (text.includes("vision") || text.includes("infravision") || text.includes("sens")) return "fa-eye";
  if (text.includes("ouie")) return "fa-ear-listen";
  if (text.includes("resistance") || text.includes("protection")) return "fa-shield-halved";
  if (text.includes("regeneration") || text.includes("vitalite")) return "fa-heart-pulse";
  if (text.includes("dexterite")) return "fa-person-running";
  if (text.includes("surpris")) return "fa-user-shield";
  return "fa-paw";
}

function add2eFamiliarCapabilities(actor) {
  return Array.from(actor?.effects ?? []).flatMap(effect => {
    if (!effect || effect.disabled === true || effect.isSuppressed === true) return [];
    if (!add2eFamiliarEffectIsBenefit(effect) || add2eFamiliarEffectIsVitality(effect)) return [];
    const familiar = add2eFamiliarEffectData(effect) ?? {};
    const label = String(effect.name ?? effect.label ?? "Capacité de familier")
      .replace(/^\s*Familier\s*[—–-]\s*/i, "")
      .trim();
    return [{
      id: `familiar-effect:${effect.id}`,
      key: `familiar-effect:${effect.id}`,
      label: label || "Capacité de familier",
      description: add2eFamiliarEffectDescription(effect),
      img: effect.img || "icons/svg/aura.svg",
      iconClass: add2eFamiliarCapabilityIcon(effect),
      sourceId: effect.id,
      sourceName: `Familier — ${String(familiar.familiarLabel ?? "Familier").trim()}`,
      actionType: "passive-effect",
      activable: true,
      canRoll: false,
      rollLabel: ""
    }];
  });
}

function add2eInstallFamiliarCapabilityConsumer() {
  const prototype = globalThis.Add2eActorSheet?.prototype;
  if (!prototype || prototype.__add2eFamiliarCapabilityConsumerVersion === ADD2E_DOCUMENT_EFFECT_CONSUMERS_VERSION) return false;
  const base = prototype.getData;
  if (typeof base !== "function") return false;

  prototype.getData = async function add2eGetDataWithFamiliarCapabilities(...args) {
    const data = await base.apply(this, args);
    const actor = this.actor ?? this.document ?? null;
    const existing = Array.isArray(data.activeRacialCapabilities) ? data.activeRacialCapabilities : [];
    const familiar = add2eFamiliarCapabilities(actor);
    const seen = new Set(existing.map(entry => String(entry?.id ?? entry?.key ?? "")));
    data.activeRacialCapabilities = [
      ...existing,
      ...familiar.filter(entry => !seen.has(String(entry.id)))
    ];
    return data;
  };
  prototype.__add2eFamiliarCapabilityConsumerVersion = ADD2E_DOCUMENT_EFFECT_CONSUMERS_VERSION;
  return true;
}

function add2eFamiliarNightVisionActive(actor) {
  return Array.from(actor?.effects ?? []).some(effect => {
    if (!effect || effect.disabled === true || effect.isSuppressed === true || !add2eFamiliarEffectIsBenefit(effect)) return false;
    return add2eFamiliarEffectTags(effect).some(tag => {
      const value = String(tag ?? "").trim().toLowerCase();
      return value.includes("familier:sens:vision_nocturne")
        || value.includes("familier:sens:infravision")
        || value.startsWith("infravision:");
    });
  });
}

function add2eFamiliarLink(actor) {
  return actor?.getFlag?.("add2e", "familiar") ?? actor?.flags?.add2e?.familiar ?? null;
}

function add2eSightData(value) {
  return add2eEffectConsumerClone(value?.toObject?.() ?? value ?? {});
}

function add2eFamiliarMasterToken(actor, link) {
  const scene = game.scenes?.get?.(link?.sceneId) ?? null;
  return scene?.tokens?.get?.(link?.masterTokenId) ?? null;
}

function add2eFamiliarDarkvisionMode(current = {}) {
  if (globalThis.CONFIG?.Canvas?.visionModes?.darkvision) return "darkvision";
  return String(current?.visionMode ?? "basic") || "basic";
}

async function add2eSyncFamiliarNightVision(actor) {
  if (!add2eEffectConsumerIsResponsibleGM() || !actor?.update) return false;
  const link = add2eFamiliarLink(actor);
  if (!link?.linkId) return false;

  const active = add2eFamiliarNightVisionActive(actor);
  const token = add2eFamiliarMasterToken(actor, link);
  const stored = link.masterVisionBase && typeof link.masterVisionBase === "object"
    ? add2eEffectConsumerClone(link.masterVisionBase)
    : null;

  if (active) {
    const base = stored ?? {
      prototype: add2eSightData(actor.prototypeToken?.sight ?? actor._source?.prototypeToken?.sight),
      tokenId: token?.id ?? null,
      token: token ? add2eSightData(token.sight ?? token._source?.sight) : null
    };
    if (!stored) {
      await actor.setFlag("add2e", "familiar", {
        ...add2eEffectConsumerClone(link),
        masterVisionBase: base
      }, { add2eFamiliarRelation: true, add2eInternal: true });
    }

    const currentPrototype = add2eSightData(actor.prototypeToken?.sight ?? actor._source?.prototypeToken?.sight);
    const nextPrototype = {
      ...currentPrototype,
      enabled: true,
      visionMode: add2eFamiliarDarkvisionMode(currentPrototype)
    };
    await actor.update({ "prototypeToken.sight": nextPrototype }, {
      add2eFamiliarRelation: true,
      add2eInternal: true,
      add2eReason: "familiar-night-vision-enable"
    });

    if (token?.update) {
      const currentToken = add2eSightData(token.sight ?? token._source?.sight);
      await token.update({ sight: {
        ...currentToken,
        enabled: true,
        visionMode: add2eFamiliarDarkvisionMode(currentToken)
      } }, {
        add2eFamiliarRelation: true,
        add2eInternal: true,
        add2eReason: "familiar-night-vision-enable"
      });
    }
    return true;
  }

  if (!stored) return false;
  await actor.update({ "prototypeToken.sight": add2eEffectConsumerClone(stored.prototype ?? {}) }, {
    add2eFamiliarRelation: true,
    add2eInternal: true,
    add2eReason: "familiar-night-vision-disable"
  });
  if (token?.update && stored.token) {
    await token.update({ sight: add2eEffectConsumerClone(stored.token) }, {
      add2eFamiliarRelation: true,
      add2eInternal: true,
      add2eReason: "familiar-night-vision-disable"
    });
  }
  const nextLink = add2eEffectConsumerClone(link);
  delete nextLink.masterVisionBase;
  await actor.setFlag("add2e", "familiar", nextLink, {
    add2eFamiliarRelation: true,
    add2eInternal: true
  });
  return true;
}

async function add2eConsumeActiveEffectChange(effect, changes = {}, userId = null) {
  if (!add2eEffectConsumerOwnsHook(userId)) return;
  const actor = add2eEffectConsumerActor(effect);
  if (!actor) return;

  const stateChanged = Object.prototype.hasOwnProperty.call(changes, "disabled")
    || Object.prototype.hasOwnProperty.call(changes, "isSuppressed");
  const hitPointsChanged = add2eEffectConsumerHasHitPoints(effect)
    || add2eEffectConsumerChangesTouchModifiers(changes);
  const familiarChanged = !!add2eFamiliarEffectData(effect);

  if (hitPointsChanged) {
    await add2eRecalculateHitPointsDirect(actor, { reason: "active-effect-hit-points" });
  }
  if (familiarChanged && (stateChanged || !Object.keys(changes ?? {}).length || add2eEffectConsumerChangesTouchModifiers(changes))) {
    await add2eSyncFamiliarNightVision(actor);
    if (actor.sheet?.rendered === true && !hitPointsChanged) await actor.sheet.render({ force: true });
  }
}

Hooks.on("createActiveEffect", (effect, _options = {}, userId) => {
  add2eConsumeActiveEffectChange(effect, {}, userId).catch(error => console.error("[ADD2E][ACTIVE_EFFECT][CREATE]", error));
});
Hooks.on("updateActiveEffect", (effect, changes = {}, _options = {}, userId) => {
  add2eConsumeActiveEffectChange(effect, changes, userId).catch(error => console.error("[ADD2E][ACTIVE_EFFECT][UPDATE]", error));
});
Hooks.on("deleteActiveEffect", (effect, _options = {}, userId) => {
  add2eConsumeActiveEffectChange(effect, {}, userId).catch(error => console.error("[ADD2E][ACTIVE_EFFECT][DELETE]", error));
});

Hooks.once("ready", async () => {
  add2eInstallFamiliarCapabilityConsumer();
  if (!add2eEffectConsumerIsResponsibleGM()) return;
  for (const actor of game.actors?.contents ?? []) {
    const activeHitPoints = Array.from(actor.effects ?? []).some(effect =>
      effect?.disabled !== true && effect?.isSuppressed !== true && add2eEffectConsumerHasHitPoints(effect)
    );
    if (activeHitPoints) await add2eRecalculateHitPointsDirect(actor, { reason: "ready-hit-points-resolution" });
    if (add2eFamiliarLink(actor)?.linkId) await add2eSyncFamiliarNightVision(actor);
  }
});

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
