// ADD2E — Relais MJ : projectiles, vendeur et composants de sort.

import { PROJECTILE_FLAG, VENDOR_SCOPE, resolveActor } from "./15b0-gm-relay-common.mjs";

function relayQuantity(item) {
  const n = Number(item?.system?.quantite ?? item?.system?.quantity ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function relaySlug(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, "_")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export async function vendorRecordProjectileSpent(payload) {
  const combat = game.combats?.get?.(payload.combatId) ?? game.combat;
  if (!combat?.getFlag || !combat?.setFlag) {
    return console.warn("[ADD2E][GM-RELAY][vendorRecordProjectileSpent] combat introuvable :", payload);
  }

  const actorId = payload.actorId ?? null;
  const itemKey = payload.itemId ?? payload.itemName ?? null;
  const qty = Math.max(1, Math.floor(Number(payload.quantity ?? 1) || 1));
  if (!actorId || !itemKey) {
    return console.warn("[ADD2E][GM-RELAY][vendorRecordProjectileSpent] payload incomplet :", payload);
  }

  const spent = foundry.utils.deepClone(await combat.getFlag(VENDOR_SCOPE, PROJECTILE_FLAG) ?? {});
  spent[actorId] ??= { actorId, actorName: payload.actorName ?? "", items: {} };
  spent[actorId].actorName = payload.actorName ?? spent[actorId].actorName ?? "";
  spent[actorId].items ??= {};
  spent[actorId].items[itemKey] ??= {
    itemId: payload.itemId ?? null,
    itemName: payload.itemName ?? "Projectile",
    img: payload.img ?? null,
    spent: 0
  };

  spent[actorId].items[itemKey].spent = Math.max(0, Number(spent[actorId].items[itemKey].spent ?? 0)) + qty;
  spent[actorId].items[itemKey].itemId = payload.itemId ?? spent[actorId].items[itemKey].itemId ?? null;
  spent[actorId].items[itemKey].itemName = payload.itemName ?? spent[actorId].items[itemKey].itemName ?? "Projectile";
  spent[actorId].items[itemKey].img = payload.img ?? spent[actorId].items[itemKey].img ?? null;

  await combat.setFlag(VENDOR_SCOPE, PROJECTILE_FLAG, spent);
}

function findSpellComponentItem(actor, payload = {}) {
  if (!actor) return null;
  if (payload.itemId && actor.items?.get?.(payload.itemId)) return actor.items.get(payload.itemId);

  const wanted = relaySlug(payload.componentSlug ?? payload.itemSlug ?? payload.itemName ?? payload.componentName);
  if (!wanted) return null;

  return Array.from(actor.items ?? []).find(item => {
    const sys = item.system ?? {};
    const flags = item.flags?.add2e ?? {};
    const itemSlug = relaySlug(sys.slug ?? sys.composantSlug ?? item.name);
    if (itemSlug === wanted) return true;

    const tags = [sys.tags, sys.effectTags, flags.tags].flatMap(value => {
      if (Array.isArray(value)) return value;
      if (typeof value === "string") return value.split(/[,;|]/g);
      return [];
    });

    return tags.some(tag => relaySlug(String(tag).replace(/^composant:/i, "")) === wanted);
  }) ?? null;
}

export async function consumeSpellComponent(payload = {}) {
  const actor = await resolveActor(payload);
  if (!actor) {
    console.warn("[ADD2E][GM-RELAY][consumeSpellComponent] acteur introuvable :", payload);
    return false;
  }

  const item = findSpellComponentItem(actor, payload);
  if (!item) {
    console.warn("[ADD2E][GM-RELAY][consumeSpellComponent] composant introuvable :", {
      actor: actor.name,
      payload
    });
    return false;
  }

  const qty = Math.max(1, Math.floor(Number(payload.quantity ?? 1) || 1));
  const before = relayQuantity(item);
  const after = Math.max(0, before - qty);

  await item.update({ "system.quantite": after }, { add2eReason: "gm-relay-consume-spell-component" });

  console.log("[ADD2E][GM-RELAY][consumeSpellComponent]", {
    actor: actor.name,
    item: item.name,
    before,
    after,
    quantity: qty,
    requestId: payload.requestId ?? null
  });

  return true;
}
