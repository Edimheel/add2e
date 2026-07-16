// ADD2E — Actor sheet drop — chargeur court
// Version : 2026-07-16-magic-identification-cursed-items-v6
// Compatible Foundry V13/V14/V15.
// Le contenu principal du drop reste dans 13e-actor-sheet-drop-legacy-full.mjs.

const ADD2E_CURSED_ITEM_VERSION = "2026-07-16-cursed-items-v6";
const ADD2E_CURSED_ITEM_LOG = "[ADD2E][OBJET_MAUDIT]";
globalThis.ADD2E_CURSED_ITEM_VERSION = ADD2E_CURSED_ITEM_VERSION;

function add2eIdentificationGetProperty(source, path) {
  try { if (foundry?.utils?.getProperty) return foundry.utils.getProperty(source, path); }
  catch (_error) {}
  return String(path).split(".").reduce((value, key) => value?.[key], source);
}

function add2eIdentificationHasProperty(source, path) {
  try { if (foundry?.utils?.hasProperty) return foundry.utils.hasProperty(source, path); }
  catch (_error) {}
  const parts = String(path).split(".");
  let value = source;
  for (const key of parts) {
    if (!value || !Object.prototype.hasOwnProperty.call(value, key)) return false;
    value = value[key];
  }
  return true;
}

function add2eIdentificationArray(value) {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(add2eIdentificationArray);
  if (value instanceof Set) return [...value].flatMap(add2eIdentificationArray);
  if (typeof value === "string") return value.split(/[,;|\n]+/g).map(entry => entry.trim()).filter(Boolean);
  if (typeof value === "object") {
    for (const key of ["tags", "effectTags", "value", "values", "items", "list"]) {
      if (value[key] !== undefined) return add2eIdentificationArray(value[key]);
    }
  }
  return [value];
}

function add2eIdentificationNormalize(value) {
  return String(value ?? "").trim().toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/\s+/g, "_");
}

function add2eIdentificationMagicItem(item, source = null) {
  const itemType = String(source?.type ?? item?.type ?? "").trim().toLowerCase();
  if (!["arme", "armure", "objet"].includes(itemType)) return false;
  const system = source?.system ?? item?.system ?? {};
  const flags = source?.flags?.add2e ?? item?.flags?.add2e ?? {};
  const tags = [system.tags, system.effectTags, flags.tags, flags.effectTags]
    .flatMap(add2eIdentificationArray).map(add2eIdentificationNormalize);
  return system.magique === true
    || system.magic === true
    || flags.isMagicItem === true
    || String(system.categorie ?? "").toLowerCase().includes("magique")
    || tags.some(tag => tag.includes("objet_magique") || tag.includes("magique"));
}

function add2eIdentificationIsIdentified(item, source = null) {
  const system = source?.system ?? item?.system ?? {};
  return system.identifie === true || system.identified === true || item?.getFlag?.("add2e", "identified") === true;
}

function add2eIdentificationGenericName(item, source = null) {
  const system = source?.system ?? item?.system ?? {};
  return String(system.nom_non_identifie ?? system.unidentifiedName ?? system.sousType ?? system.sous_type ?? "Objet magique").trim() || "Objet magique";
}

function add2eIdentificationTrueName(item, source = null) {
  const system = source?.system ?? item?.system ?? {};
  return String(system.nom ?? system.nom_reel ?? system.trueName ?? source?.name ?? item?.name ?? "Objet magique").trim() || "Objet magique";
}

function add2eIdentificationFindActorItem(itemId, root = null) {
  const actorId = root?.dataset?.actorId ?? root?.closest?.("[data-actor-id]")?.dataset?.actorId ?? "";
  if (actorId) {
    const item = game.actors?.get?.(actorId)?.items?.get?.(itemId);
    if (item) return item;
  }
  for (const actor of game.actors ?? []) {
    const item = actor?.items?.get?.(itemId);
    if (item) return item;
  }
  return null;
}

function add2eIdentificationBlockOpen(item, source = "unknown") {
  if (game.user?.isGM) return false;
  if (!item || !add2eIdentificationMagicItem(item) || add2eIdentificationIsIdentified(item)) return false;
  console.warn("[ADD2E][IDENTIFICATION][OPEN_BLOCKED]", {
    source, actor: item.parent?.name, actorId: item.parent?.id, itemId: item.id,
    visibleName: item.name, genericName: add2eIdentificationGenericName(item),
    identified: false, user: game.user?.name, userId: game.user?.id
  });
  ui.notifications?.warn?.("Cet objet doit être identifié avant de pouvoir être examiné.");
  return true;
}

function add2eInstallUnidentifiedItemOpenGuard() {
  if (globalThis.__add2eUnidentifiedItemOpenGuardV2) return;
  globalThis.__add2eUnidentifiedItemOpenGuardV2 = true;
  document.addEventListener("click", event => {
    if (game.user?.isGM) return;
    const trigger = event.target?.closest?.(".objet-edit, .armure-edit, .arme-edit, [data-action='edit'], [data-action='open'], [data-action='item-edit'], [data-action='item-open']");
    if (!trigger) return;
    const row = trigger.closest?.(".item, [data-item-id]");
    const itemId = String(trigger.dataset?.itemId ?? row?.dataset?.itemId ?? row?.dataset?.itemid ?? "").trim();
    if (!itemId) return;
    const item = add2eIdentificationFindActorItem(itemId, trigger);
    if (!add2eIdentificationBlockOpen(item, "dom-click")) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }, true);
}

function add2eInstallItemSheetRenderGuard() {
  if (globalThis.__add2eUnidentifiedItemSheetRenderGuardV1) return;
  const classes = [globalThis.Add2eObjetSheet, globalThis.Add2eArmeSheet, globalThis.Add2eArmureSheet].filter(Boolean);
  if (!classes.length) {
    console.warn("[ADD2E][IDENTIFICATION][RENDER_GUARD_WAIT] Feuilles Item ApplicationV2 indisponibles.");
    return;
  }
  let patched = 0;
  for (const SheetClass of classes) {
    const proto = SheetClass?.prototype;
    if (!proto || proto.__add2eUnidentifiedRenderGuardV1 || typeof proto.render !== "function") continue;
    const originalRender = proto.render;
    proto.__add2eUnidentifiedRenderGuardV1 = true;
    proto.__add2eOriginalRenderBeforeIdentificationGuard = originalRender;
    proto.render = function add2eRenderWithIdentificationGuard(options = {}) {
      const item = this.item ?? this.document ?? this.object ?? null;
      if (add2eIdentificationBlockOpen(item, "sheet-render")) return this;
      return originalRender.call(this, options);
    };
    patched += 1;
  }
  if (patched > 0) {
    globalThis.__add2eUnidentifiedItemSheetRenderGuardV1 = true;
    console.log("[ADD2E][IDENTIFICATION][RENDER_GUARD_READY]", { patched, classes: classes.map(cls => cls.name) });
  }
}

function add2eCurseLog(event, data = {}, warning = false) {
  const method = warning ? "warn" : "log";
  console[method](`${ADD2E_CURSED_ITEM_LOG}[${event}]`, {
    version: ADD2E_CURSED_ITEM_VERSION,
    user: game.user?.name ?? null,
    userId: game.user?.id ?? null,
    isGM: game.user?.isGM === true,
    ...data
  });
}

function add2eIsCursedItem(item, source = null) {
  if (!item && !source) return false;
  const system = source?.system ?? item?.system ?? {};
  const flags = source?.flags?.add2e ?? item?.flags?.add2e ?? {};
  const direct = system.maudit === true || system.cursed === true || flags.maudit === true || flags.cursed === true;
  const tags = [system.tags, system.tag, system.effectTags, flags.tags, flags.effectTags]
    .flatMap(add2eIdentificationArray).map(add2eIdentificationNormalize).filter(Boolean);
  const tagged = tags.some(tag => ["maudit", "cursed", "objet:maudit", "objet_maudit", "malediction", "objet:malediction"].includes(tag));
  return direct || tagged;
}

function add2eCursedItemTags(item) {
  const system = item?.system ?? {};
  const flags = item?.flags?.add2e ?? {};
  const raw = [system.tags, system.tag, system.effectTags, system.effets, system.effects, flags.tags, flags.effectTags]
    .flatMap(add2eIdentificationArray).map(add2eIdentificationNormalize).filter(Boolean);
  const tags = new Set(["objet:maudit", "etat:malediction", ...raw]);
  for (const tag of raw) {
    if (tag.startsWith("malus_save:")) tags.add(`bonus_save:${tag.slice("malus_save:".length)}`);
    if (tag.startsWith("malus_sauvegarde:")) tags.add(`bonus_save:${tag.slice("malus_sauvegarde:".length)}`);
  }
  return [...tags];
}

function add2eIsStorageActor(actor) {
  if (!actor || actor.documentName !== "Actor") return false;
  const flags = actor.flags?.add2e ?? {};
  const system = actor.system ?? {};
  const role = add2eIdentificationNormalize(flags.role ?? flags.actorRole ?? system.role ?? system.actorRole ?? "");
  const name = add2eIdentificationNormalize(actor.name ?? "");
  return flags.isVendor === true
    || flags.isArmorer === true
    || flags.isLoot === true
    || flags.isContainer === true
    || flags.vendor === true
    || flags.armorer === true
    || flags.loot === true
    || flags.container === true
    || system.isVendor === true
    || system.isArmorer === true
    || system.isLoot === true
    || system.isContainer === true
    || ["vendor", "vendeur", "marchand", "armorer", "armurier", "loot", "butin", "container", "conteneur", "coffre"].includes(role)
    || name === "armurier"
    || name.startsWith("marchand_")
    || name.startsWith("coffre_");
}

function add2eCursedEffectsForItem(actor, item) {
  return Array.from(actor?.effects ?? []).filter(effect =>
    effect.flags?.add2e?.cursedItemId === item?.id
    || effect.flags?.add2e?.sourceItemId === item?.id
    || effect.origin === item?.uuid
  );
}

async function add2eRemoveStorageCursedEffects(actor, context = {}) {
  if (!add2eIsStorageActor(actor)) return 0;
  const ids = Array.from(actor.effects ?? [])
    .filter(effect => effect.flags?.add2e?.cursedItemEffect === true)
    .map(effect => effect.id)
    .filter(Boolean);
  if (!ids.length) return 0;
  await actor.deleteEmbeddedDocuments("ActiveEffect", ids, {
    add2eInternal: true,
    add2eReason: "cleanup-storage-cursed-effects"
  });
  add2eCurseLog("STORAGE_EFFECTS_CLEANED", { actor: actor.name, actorId: actor.id, effectIds: ids, context });
  return ids.length;
}

async function add2eSyncCursedItemEffect(item, context = {}) {
  if (!item || !add2eIsCursedItem(item)) return null;
  const actor = item.parent;
  if (!actor || actor.documentName !== "Actor") return null;
  if (add2eIsStorageActor(actor)) {
    const existing = add2eCursedEffectsForItem(actor, item).map(effect => effect.id).filter(Boolean);
    if (existing.length) {
      await actor.deleteEmbeddedDocuments("ActiveEffect", existing, {
        add2eInternal: true,
        add2eReason: "cleanup-storage-cursed-item-effect"
      });
    }
    add2eCurseLog("SYNC_SKIPPED_STORAGE", {
      actor: actor.name, actorId: actor.id, item: item.name, itemId: item.id,
      removedEffectIds: existing, context
    });
    return null;
  }

  const tags = add2eCursedItemTags(item);
  const existing = add2eCursedEffectsForItem(actor, item);
  const identified = add2eIdentificationIsIdentified(item);
  const data = {
    name: identified ? `${add2eIdentificationTrueName(item)} — Malédiction` : `${add2eIdentificationGenericName(item)} — Effet`,
    img: item.img || "icons/svg/skull.svg",
    origin: item.uuid,
    disabled: false,
    transfer: false,
    type: "base",
    system: {},
    changes: [],
    duration: { startTime: game.time?.worldTime ?? null },
    description: "Malédiction permanente tant que l’objet est possédé. Seul un désenvoûtement peut la retirer.",
    flags: { add2e: { cursedItemEffect: true, cursedItemId: item.id, sourceItemId: item.id, tags, effectTags: tags, rules: [] } }
  };
  add2eCurseLog("SYNC_START", {
    actor: actor.name, actorId: actor.id, item: item.name, itemId: item.id,
    identified, equipped: item.system?.equipee === true, existingEffectIds: existing.map(effect => effect.id), tags, context
  });
  if (existing.length) {
    const [primary, ...duplicates] = existing;
    await primary.update(data, { add2eInternal: true, add2eReason: "sync-cursed-item-effect" });
    if (duplicates.length) await actor.deleteEmbeddedDocuments("ActiveEffect", duplicates.map(effect => effect.id), { add2eInternal: true, add2eReason: "dedupe-cursed-item-effect" });
    add2eCurseLog("SYNC_UPDATED", { actor: actor.name, item: item.name, effectId: primary.id, duplicatesRemoved: duplicates.map(effect => effect.id), tags });
    return primary;
  }
  const [created] = await actor.createEmbeddedDocuments("ActiveEffect", [data], { add2eInternal: true, add2eReason: "create-cursed-item-effect" });
  add2eCurseLog("SYNC_CREATED", { actor: actor.name, item: item.name, effectId: created?.id ?? null, tags });
  return created ?? null;
}

async function add2eDeleteCursedItemByDisenchantment(item, options = {}) {
  if (!item || !add2eIsCursedItem(item)) return false;
  const actor = item.parent;
  if (!actor || actor.documentName !== "Actor") return false;
  const effectIds = add2eCursedEffectsForItem(actor, item).map(effect => effect.id).filter(Boolean);
  add2eCurseLog("DISENCHANT_START", { actor: actor.name, item: item.name, itemId: item.id, effectIds, options });
  if (effectIds.length) await actor.deleteEmbeddedDocuments("ActiveEffect", effectIds, { add2eDisenchantment: true, add2eReason: "remove-cursed-item-effects" });
  await item.delete({ ...options, add2eDisenchantment: true, add2eReason: options.add2eReason ?? "remove-curse" });
  add2eCurseLog("DISENCHANT_DONE", { actor: actor.name, item: item.name, itemId: item.id });
  return true;
}

function add2eInstallCursedItemHooks() {
  if (globalThis.ADD2E_CURSED_ITEM_GUARD_INSTALLED) return;
  globalThis.ADD2E_CURSED_ITEM_GUARD_INSTALLED = true;
  globalThis.add2eIsCursedItem = add2eIsCursedItem;
  globalThis.add2eSyncCursedItemEffect = add2eSyncCursedItemEffect;
  globalThis.add2eDeleteCursedItemByDisenchantment = add2eDeleteCursedItemByDisenchantment;
  globalThis.add2eIsCursedItemStorageActor = add2eIsStorageActor;
  add2eCurseLog("INSTALL", { source: "13e-actor-sheet-drop.mjs" });

  Hooks.on("preDeleteItem", (item, options = {}, userId = null) => {
    if (item?.parent?.documentName !== "Actor" || !add2eIsCursedItem(item)) return true;
    if (add2eIsStorageActor(item.parent)) return true;
    const requestingUser = game.users?.get?.(userId) ?? game.user;
    const allowed = options.add2eDisenchantment === true || requestingUser?.isGM === true;
    add2eCurseLog("PRE_DELETE", {
      actor: item.parent?.name, actorId: item.parent?.id, item: item.name, itemId: item.id,
      hookUserId: userId, requestingUser: requestingUser?.name, requestingUserIsGM: requestingUser?.isGM === true,
      disenchantment: options.add2eDisenchantment === true, allowed, options
    });
    if (allowed) return true;
    const displayName = add2eIdentificationIsIdentified(item) ? item.name : add2eIdentificationGenericName(item);
    add2eCurseLog("DELETE_BLOCKED", { actor: item.parent?.name, item: item.name, displayName, itemId: item.id }, true);
    ui.notifications?.warn?.(`${displayName} est lié à son propriétaire et ne peut être retiré que par un désenvoûtement.`);
    return false;
  });

  Hooks.on("preDeleteActiveEffect", (effect, options = {}, userId = null) => {
    if (effect?.flags?.add2e?.cursedItemEffect !== true) return true;
    if (add2eIsStorageActor(effect.parent)) return true;
    const requestingUser = game.users?.get?.(userId) ?? game.user;
    if (options.add2eDisenchantment === true || options.add2eInternal === true || requestingUser?.isGM === true) return true;
    add2eCurseLog("EFFECT_DELETE_BLOCKED", { actor: effect.parent?.name, effect: effect.name, effectId: effect.id, hookUserId: userId }, true);
    ui.notifications?.warn?.("Cet effet provient d’un objet maudit et ne peut pas être retiré manuellement.");
    return false;
  });

  Hooks.on("createItem", async (item, options = {}, userId = null) => {
    if (item?.parent?.documentName !== "Actor" || !add2eIsCursedItem(item)) return;
    add2eCurseLog("CREATE_ITEM", { actor: item.parent.name, item: item.name, itemId: item.id, storageActor: add2eIsStorageActor(item.parent), hookUserId: userId, options });
    if (String(userId ?? game.user?.id) === String(game.user?.id)) await add2eSyncCursedItemEffect(item, { hook: "createItem" });
  });

  Hooks.on("updateItem", async (item, changes = {}, options = {}, userId = null) => {
    if (item?.parent?.documentName !== "Actor" || !add2eIsCursedItem(item)) return;
    add2eCurseLog("UPDATE_ITEM", { actor: item.parent.name, item: item.name, itemId: item.id, storageActor: add2eIsStorageActor(item.parent), hookUserId: userId, changes, options });
    if (String(userId ?? game.user?.id) === String(game.user?.id)) await add2eSyncCursedItemEffect(item, { hook: "updateItem" });
  });

  Hooks.once("ready", async () => {
    if (!game.user?.isGM) return;
    let cursedItems = 0;
    let storageActors = 0;
    let cleanedEffects = 0;
    add2eCurseLog("READY_SCAN_START", { actors: game.actors?.size ?? 0 });
    for (const actor of game.actors ?? []) {
      if (add2eIsStorageActor(actor)) {
        storageActors += 1;
        cleanedEffects += await add2eRemoveStorageCursedEffects(actor, { hook: "ready" });
        for (const ownedItem of actor.items ?? []) {
          if (!add2eIsCursedItem(ownedItem)) continue;
          cursedItems += 1;
          add2eCurseLog("SYNC_SKIPPED_STORAGE", { actor: actor.name, actorId: actor.id, item: ownedItem.name, itemId: ownedItem.id, context: { hook: "ready" } });
        }
        continue;
      }
      for (const ownedItem of actor.items ?? []) {
        if (!add2eIsCursedItem(ownedItem)) continue;
        cursedItems += 1;
        await add2eSyncCursedItemEffect(ownedItem, { hook: "ready" });
      }
    }
    add2eCurseLog("READY_SCAN_DONE", { cursedItems, storageActors, cleanedEffects });
  });
}

add2eInstallUnidentifiedItemOpenGuard();
add2eInstallCursedItemHooks();
Hooks.once("ready", add2eInstallItemSheetRenderGuard);

Hooks.on("preCreateItem", (item, data, options, userId) => {
  if (item?.parent?.documentName !== "Actor" || !add2eIdentificationMagicItem(item, data)) return;
  const identified = add2eIdentificationIsIdentified(item, data);
  const genericName = add2eIdentificationGenericName(item, data);
  const trueName = add2eIdentificationTrueName(item, data);
  const update = { "system.nom": trueName, name: identified ? trueName : genericName };
  item.updateSource(update);
  console.log("[ADD2E][IDENTIFICATION][PRE_CREATE]", {
    actor: item.parent?.name, sourceName: data?.name, trueName, genericName, identified,
    visibleName: update.name, cursed: add2eIsCursedItem(item, data), userId, options
  });
});

Hooks.on("preUpdateItem", (item, changed, options, userId) => {
  if (item?.parent?.documentName !== "Actor" || !add2eIdentificationMagicItem(item)) return;
  const identificationChanged = add2eIdentificationHasProperty(changed, "system.identifie") || add2eIdentificationHasProperty(changed, "system.identified");
  const nameChanged = Object.prototype.hasOwnProperty.call(changed ?? {}, "name");
  if (!identificationChanged && !nameChanged) return;
  const identified = identificationChanged
    ? (add2eIdentificationGetProperty(changed, "system.identifie") === true || add2eIdentificationGetProperty(changed, "system.identified") === true)
    : add2eIdentificationIsIdentified(item);
  const genericName = add2eIdentificationGenericName(item);
  let trueName = String(item.system?.nom ?? item.system?.nom_reel ?? item.system?.trueName ?? "").trim();
  if (!trueName) {
    const currentName = String(item.name ?? "").trim();
    trueName = currentName && currentName !== genericName ? currentName : "Objet magique";
    foundry.utils.setProperty(changed, "system.nom", trueName);
  }
  if (nameChanged && identified) {
    const requestedName = String(changed.name ?? "").trim();
    if (requestedName) {
      trueName = requestedName;
      foundry.utils.setProperty(changed, "system.nom", requestedName);
    }
  }
  changed.name = identified ? trueName : genericName;
  console.log("[ADD2E][IDENTIFICATION][PRE_UPDATE]", {
    actor: item.parent?.name, itemId: item.id, currentName: item.name, trueName, genericName,
    identified, visibleName: changed.name, identificationChanged, nameChanged, userId, options
  });
});

Hooks.on("createItem", (item, options, userId) => {
  if (item?.parent?.documentName !== "Actor" || !add2eIdentificationMagicItem(item)) return;
  console.log("[ADD2E][IDENTIFICATION][CREATED]", {
    actor: item.parent?.name, itemId: item.id, name: item.name, trueName: item.system?.nom,
    genericName: add2eIdentificationGenericName(item), identified: add2eIdentificationIsIdentified(item),
    cursed: add2eIsCursedItem(item), userId, options
  });
});

Hooks.on("updateItem", (item, changed, options, userId) => {
  if (item?.parent?.documentName !== "Actor" || !add2eIdentificationMagicItem(item)) return;
  if (!add2eIdentificationHasProperty(changed, "system.identifie")
    && !add2eIdentificationHasProperty(changed, "system.identified")
    && !Object.prototype.hasOwnProperty.call(changed ?? {}, "name")) return;
  console.log("[ADD2E][IDENTIFICATION][UPDATED]", {
    actor: item.parent?.name, itemId: item.id, name: item.name, trueName: item.system?.nom,
    genericName: add2eIdentificationGenericName(item), identified: add2eIdentificationIsIdentified(item),
    cursed: add2eIsCursedItem(item), changed, userId, options
  });
  item.parent?.sheet?.render?.({ force: true });
});

import "./13e-actor-sheet-drop-legacy-full.mjs";
