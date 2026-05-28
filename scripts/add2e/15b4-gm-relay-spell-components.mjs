// ADD2E — Relais MJ : consommation des composants de sort.

import { resolveActor } from "./15b0-gm-relay-common.mjs";

function quantity(item) {
  const n = Number(item?.system?.quantite ?? item?.system?.quantity ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function slug(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, "_")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function findItem(actor, payload = {}) {
  if (!actor) return null;
  if (payload.itemId && actor.items?.get?.(payload.itemId)) return actor.items.get(payload.itemId);
  const wantedSlug = slug(payload.componentSlug ?? payload.itemSlug ?? payload.itemName ?? payload.componentName);
  if (!wantedSlug) return null;
  return Array.from(actor.items ?? []).find(item => {
    const itemSlug = slug(item.system?.slug ?? item.system?.composantSlug ?? item.name);
    if (itemSlug === wantedSlug) return true;
    const tags = [item.system?.tags, item.system?.effectTags, item.flags?.add2e?.tags].flatMap(v => Array.isArray(v) ? v : typeof v === "string" ? v.split(/[,;|]/g) : []);
    return tags.some(tag => slug(String(tag).replace(/^composant:/i, "")) === wantedSlug);
  }) ?? null;
}

export async function consumeSpellComponent(payload = {}) {
  const actor = await resolveActor(payload);
  if (!actor) {
    console.warn("[ADD2E][GM-RELAY][consumeSpellComponent] acteur introuvable", payload);
    return false;
  }

  const item = findItem(actor, payload);
  if (!item) {
    console.warn("[ADD2E][GM-RELAY][consumeSpellComponent] composant introuvable", { actor: actor.name, payload });
    return false;
  }

  const qty = Math.max(1, Math.floor(Number(payload.quantity ?? 1) || 1));
  const before = quantity(item);
  const after = Math.max(0, before - qty);

  await item.update({ "system.quantite": after }, { add2eReason: "gm-relay-consume-spell-component" });

  console.log("[ADD2E][GM-RELAY][consumeSpellComponent] OK", {
    actor: actor.name,
    item: item.name,
    before,
    after,
    quantity: qty,
    requestId: payload.requestId ?? null
  });

  return true;
}
