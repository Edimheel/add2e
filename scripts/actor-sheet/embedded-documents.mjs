// scripts/actor-sheet/embedded-documents.mjs
// ADD2E — Opérations sur items et effets embarqués.
// Compatible Foundry V13/V14/V15.

const ADD2E_CURSED_ITEM_VERSION = "2026-07-16-cursed-item-guard-diagnostics-v3";
const ADD2E_CURSED_ITEM_LOG = "[ADD2E][OBJET_MAUDIT]";

globalThis.ADD2E_CURSED_ITEM_VERSION = ADD2E_CURSED_ITEM_VERSION;

function add2eCurseLog(event, data = {}) {
  console.log(`${ADD2E_CURSED_ITEM_LOG}[${event}]`, {
    version: ADD2E_CURSED_ITEM_VERSION,
    user: game.user?.name ?? null,
    userId: game.user?.id ?? null,
    isGM: game.user?.isGM === true,
    ...data
  });
}

function add2eCurseWarn(event, data = {}) {
  console.warn(`${ADD2E_CURSED_ITEM_LOG}[${event}]`, {
    version: ADD2E_CURSED_ITEM_VERSION,
    user: game.user?.name ?? null,
    userId: game.user?.id ?? null,
    isGM: game.user?.isGM === true,
    ...data
  });
}

function add2eNormalizeCurseTag(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/\s+/g, "_");
}

function add2eCurseValues(value) {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(add2eCurseValues);
  if (typeof value === "string") return value.split(/[,;|\n]+/g).map(entry => entry.trim()).filter(Boolean);
  if (typeof value === "object") {
    for (const key of ["tags", "effectTags", "value", "values", "items", "list"]) {
      if (value[key] !== undefined) return add2eCurseValues(value[key]);
    }
  }
  return [value];
}

function add2eCursedItemEffectTags(item) {
  const system = item?.system ?? {};
  const flags = item?.flags?.add2e ?? {};
  const raw = [
    system.tags,
    system.tag,
    system.effectTags,
    flags.tags,
    flags.effectTags
  ].flatMap(add2eCurseValues).map(add2eNormalizeCurseTag).filter(Boolean);

  const tags = new Set(["objet:maudit", "etat:malediction", ...raw]);
  for (const tag of raw) {
    if (tag.startsWith("malus_save:")) tags.add(`bonus_save:${tag.slice("malus_save:".length)}`);
    if (tag.startsWith("malus_sauvegarde:")) tags.add(`bonus_save:${tag.slice("malus_sauvegarde:".length)}`);
  }
  return [...tags];
}

export function add2eIsCursedItem(item) {
  if (!item) return false;
  const system = item.system ?? {};
  const flags = item.flags?.add2e ?? {};
  const direct = system.maudit === true || system.cursed === true || flags.cursed === true || flags.maudit === true;

  const tags = [
    system.tags,
    system.tag,
    system.effectTags,
    flags.tags,
    flags.effectTags
  ].flatMap(add2eCurseValues).map(add2eNormalizeCurseTag);

  const tagged = tags.some(tag => ["maudit", "cursed", "objet:maudit", "objet_maudit", "malediction", "objet:malediction"].includes(tag));
  const result = direct || tagged;

  if (result) {
    add2eCurseLog("DETECT", {
      item: item.name,
      itemId: item.id,
      actor: item.parent?.name ?? null,
      actorId: item.parent?.id ?? null,
      identified: item.system?.identifie !== false,
      direct,
      tagged,
      systemMaudit: system.maudit,
      flagsCursed: flags.cursed,
      tags
    });
  }

  return result;
}

export async function add2eSyncCursedItemEffect(item) {
  if (!item || !add2eIsCursedItem(item)) return null;
  const actor = item.parent;
  if (!actor || actor.documentName !== "Actor") {
    add2eCurseWarn("SYNC_SKIP_PARENT", { item: item?.name, itemId: item?.id, parentType: actor?.documentName ?? null });
    return null;
  }

  const existing = Array.from(actor.effects ?? []).filter(effect =>
    effect.flags?.add2e?.cursedItemId === item.id
    || effect.flags?.add2e?.sourceItemId === item.id
    || effect.origin === item.uuid
  );

  const tags = add2eCursedItemEffectTags(item);
  const data = {
    name: item.system?.identifie === false ? (item.system?.nom_non_identifie || "Objet maudit") : `${item.name} — Malédiction`,
    img: item.img || "icons/svg/skull.svg",
    origin: item.uuid,
    disabled: false,
    transfer: false,
    type: "base",
    system: {},
    changes: [],
    duration: { startTime: game.time?.worldTime ?? null },
    description: "Malédiction permanente tant que l’objet est possédé. Seul un désenvoûtement peut la retirer.",
    flags: {
      add2e: {
        cursedItemEffect: true,
        cursedItemId: item.id,
        sourceItemId: item.id,
        tags,
        effectTags: tags,
        rules: []
      }
    }
  };

  add2eCurseLog("SYNC_START", {
    actor: actor.name,
    actorId: actor.id,
    item: item.name,
    itemId: item.id,
    identified: item.system?.identifie !== false,
    equipped: item.system?.equipee === true,
    existingEffects: existing.map(effect => ({ id: effect.id, name: effect.name, disabled: effect.disabled })),
    generatedTags: tags
  });

  if (existing.length) {
    const [primary, ...duplicates] = existing;
    await primary.update(data, { add2eInternal: true, add2eReason: "sync-cursed-item-effect" });
    if (duplicates.length) {
      await actor.deleteEmbeddedDocuments("ActiveEffect", duplicates.map(effect => effect.id), {
        add2eInternal: true,
        add2eReason: "dedupe-cursed-item-effect"
      });
    }
    add2eCurseLog("SYNC_UPDATED", {
      actor: actor.name,
      item: item.name,
      effectId: primary.id,
      duplicatesRemoved: duplicates.map(effect => effect.id),
      tags
    });
    return primary;
  }

  const [created] = await actor.createEmbeddedDocuments("ActiveEffect", [data], {
    add2eInternal: true,
    add2eReason: "create-cursed-item-effect"
  });
  add2eCurseLog("SYNC_CREATED", {
    actor: actor.name,
    item: item.name,
    effectId: created?.id ?? null,
    effectName: created?.name ?? null,
    tags
  });
  return created ?? null;
}

export async function add2eDeleteCursedItemByDisenchantment(item, options = {}) {
  if (!item || !add2eIsCursedItem(item)) return false;
  const actor = item.parent;
  if (!actor || actor.documentName !== "Actor") return false;

  const sourceItemId = item.id;
  const linkedEffects = Array.from(actor.effects ?? []).filter(effect => {
    const flags = effect.flags?.add2e ?? {};
    return flags.sourceItemId === sourceItemId
      || flags.cursedItemId === sourceItemId
      || effect.origin === item.uuid;
  }).map(effect => effect.id).filter(Boolean);

  add2eCurseLog("DISENCHANT_START", {
    actor: actor.name,
    actorId: actor.id,
    item: item.name,
    itemId: item.id,
    linkedEffects,
    options
  });

  if (linkedEffects.length) {
    await actor.deleteEmbeddedDocuments("ActiveEffect", linkedEffects, {
      add2eDisenchantment: true,
      add2eReason: "remove-cursed-item-effects"
    });
  }

  await item.delete({
    ...options,
    add2eDisenchantment: true,
    add2eReason: options.add2eReason ?? "remove-curse"
  });
  add2eCurseLog("DISENCHANT_DONE", { actor: actor.name, item: item.name, itemId: item.id });
  return true;
}

export async function add2eDeleteOwnedItemsOfType(actor, type) {
  if (!actor?.items) return;

  const ids = actor.items
    .filter(i => String(i.type).toLowerCase() === String(type).toLowerCase())
    .filter(i => !add2eIsCursedItem(i) || game.user?.isGM)
    .map(i => i.id)
    .filter(Boolean);

  if (ids.length) {
    console.log(`[ADD2E][DROP][CLEAN] Suppression anciens items ${type} :`, ids);
    await actor.deleteEmbeddedDocuments("Item", ids);
  }
}

export async function add2eCreateOwnedClone(actor, item, sourceType) {
  if (!actor || !item?.toObject) return null;

  const data = foundry.utils.deepClone(item.toObject());
  delete data._id;
  data.flags ??= {};
  data.flags.add2e ??= {};
  data.flags.add2e.appliedAs = sourceType;
  data.flags.add2e.appliedAt = Date.now();

  const created = await actor.createEmbeddedDocuments("Item", [data], { keepId: false });
  return created?.[0] ?? null;
}

export async function add2eDeleteActorEffectsBySourceType(actor, sourceType) {
  if (!actor?.effects) return;

  const ids = actor.effects
    .filter(e => e.flags?.add2e?.sourceType === sourceType)
    .map(e => e.id)
    .filter(Boolean);

  if (ids.length) {
    console.log(`[ADD2E][DROP][CLEAN] Suppression anciens effets acteur ${sourceType} :`, ids);
    await actor.deleteEmbeddedDocuments("ActiveEffect", ids);
  }
}

if (!globalThis.ADD2E_CURSED_ITEM_GUARD_INSTALLED) {
  globalThis.ADD2E_CURSED_ITEM_GUARD_INSTALLED = true;
  globalThis.add2eIsCursedItem = add2eIsCursedItem;
  globalThis.add2eSyncCursedItemEffect = add2eSyncCursedItemEffect;
  globalThis.add2eDeleteCursedItemByDisenchantment = add2eDeleteCursedItemByDisenchantment;

  add2eCurseLog("INSTALL", {
    hookPreDeleteItem: true,
    hookCreateItem: true,
    hookUpdateItem: true,
    hookReady: true
  });

  Hooks.on("preDeleteItem", (item, options = {}, userId = null) => {
    const owned = item?.parent?.documentName === "Actor";
    const cursed = owned ? add2eIsCursedItem(item) : false;
    const requestingUser = userId ? game.users?.get(userId) : game.user;
    const allowedByDisenchantment = options.add2eDisenchantment === true;
    const allowedByGM = requestingUser?.isGM === true;

    add2eCurseLog("PRE_DELETE", {
      item: item?.name ?? null,
      itemId: item?.id ?? null,
      actor: item?.parent?.name ?? null,
      actorId: item?.parent?.id ?? null,
      owned,
      cursed,
      hookUserId: userId,
      requestingUser: requestingUser?.name ?? null,
      requestingUserId: requestingUser?.id ?? null,
      requestingUserIsGM: allowedByGM,
      allowedByDisenchantment,
      options
    });

    if (!owned || !cursed) return true;
    if (allowedByDisenchantment || allowedByGM) {
      add2eCurseLog("DELETE_ALLOWED", {
        item: item.name,
        reason: allowedByDisenchantment ? "disenchantment" : "gm"
      });
      return true;
    }

    const displayName = item.system?.identifie === false ? (item.system?.nom_non_identifie || "Cet objet") : item.name;
    add2eCurseWarn("DELETE_BLOCKED", {
      item: item.name,
      displayName,
      itemId: item.id,
      actor: item.parent?.name ?? null,
      requestingUser: requestingUser?.name ?? null
    });
    ui.notifications?.warn?.(`${displayName} est lié à son propriétaire et ne peut être retiré que par un désenvoûtement.`);
    return false;
  });

  Hooks.on("createItem", async (item, options = {}, userId = null) => {
    if (item?.parent?.documentName !== "Actor") return;
    const cursed = add2eIsCursedItem(item);
    add2eCurseLog("CREATE_ITEM", {
      item: item.name,
      itemId: item.id,
      actor: item.parent.name,
      cursed,
      hookUserId: userId,
      options
    });
    if (cursed) await add2eSyncCursedItemEffect(item);
  });

  Hooks.on("updateItem", async (item, changes = {}, options = {}, userId = null) => {
    if (item?.parent?.documentName !== "Actor") return;
    const cursed = add2eIsCursedItem(item);
    add2eCurseLog("UPDATE_ITEM", {
      item: item.name,
      itemId: item.id,
      actor: item.parent.name,
      cursed,
      changes,
      options,
      hookUserId: userId
    });
    if (cursed) await add2eSyncCursedItemEffect(item);
    else if (changes?.system?.maudit === false || changes?.system?.cursed === false) {
      const ids = Array.from(item.parent.effects ?? [])
        .filter(effect => effect.flags?.add2e?.cursedItemId === item.id || effect.flags?.add2e?.sourceItemId === item.id)
        .map(effect => effect.id);
      if (ids.length) await item.parent.deleteEmbeddedDocuments("ActiveEffect", ids, { add2eInternal: true });
      add2eCurseLog("CURSE_REMOVED_BY_UPDATE", { item: item.name, actor: item.parent.name, removedEffectIds: ids });
    }
  });

  Hooks.once("ready", async () => {
    let actorCount = 0;
    let cursedCount = 0;
    let syncedCount = 0;
    add2eCurseLog("READY_SCAN_START", { actorTotal: game.actors?.size ?? Array.from(game.actors ?? []).length });
    for (const actor of game.actors ?? []) {
      actorCount += 1;
      for (const ownedItem of actor.items ?? []) {
        if (!add2eIsCursedItem(ownedItem)) continue;
        cursedCount += 1;
        const effect = await add2eSyncCursedItemEffect(ownedItem);
        if (effect) syncedCount += 1;
      }
    }
    add2eCurseLog("READY_SCAN_DONE", { actorCount, cursedCount, syncedCount });
  });
} else {
  add2eCurseWarn("INSTALL_SKIPPED", { reason: "already-installed" });
}
