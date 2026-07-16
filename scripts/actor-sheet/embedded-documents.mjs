// scripts/actor-sheet/embedded-documents.mjs
// ADD2E — Opérations sur items et effets embarqués.

export async function add2eDeleteOwnedItemsOfType(actor, type) {
  if (!actor?.items) return;

  const ids = actor.items
    .filter(i => String(i.type).toLowerCase() === String(type).toLowerCase())
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
