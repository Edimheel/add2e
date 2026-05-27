// ADD2E — Relais MJ : projectiles et vendeur.

import { PROJECTILE_FLAG, VENDOR_SCOPE } from "./15b0-gm-relay-common.mjs";

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
