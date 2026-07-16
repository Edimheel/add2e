// scripts/actor-sheet/embedded-documents.mjs
// ADD2E — Opérations sur items et effets embarqués.
// Compatible Foundry V13/V14/V15.

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

export function add2eIsCursedItem(item) {
  if (!item) return false;
  const system = item.system ?? {};
  const flags = item.flags?.add2e ?? {};
  if (system.maudit === true || system.cursed === true || flags.cursed === true || flags.maudit === true) return true;

  const tags = [
    system.tags,
    system.tag,
    system.effectTags,
    flags.tags,
    flags.effectTags
  ].flatMap(add2eCurseValues).map(add2eNormalizeCurseTag);

  return tags.some(tag => ["maudit", "cursed", "objet:maudit", "objet_maudit", "malediction", "objet:malediction"].includes(tag));
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
  globalThis.add2eDeleteCursedItemByDisenchantment = add2eDeleteCursedItemByDisenchantment;

  Hooks.on("preDeleteItem", (item, options = {}, userId = null) => {
    if (!item?.parent || item.parent.documentName !== "Actor") return true;
    if (!add2eIsCursedItem(item)) return true;
    if (options.add2eDisenchantment === true) return true;

    const requestingUser = game.users?.get(userId) ?? game.user;
    if (requestingUser?.isGM === true) return true;

    ui.notifications?.warn?.(`${item.name} est maudit et ne peut être retiré que par un désenvoûtement.`);
    return false;
  });
}
