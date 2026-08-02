// ADD2E — Résolution compendium-first des drops personnage
// Version : 2026-08-02-explicit-application-v2-class-v3
//
// Module court chargé après le drop historique. Il force la résolution depuis
// le compendium avant que les validateurs race/classe ne lisent raw.data.

import { Add2eActorSheet } from "./13a-actor-sheet-class.mjs";

const ADD2E_DROP_COMPENDIUM_RESOLVER_VERSION = "2026-08-02-explicit-application-v2-class-v3";
globalThis.ADD2E_DROP_COMPENDIUM_RESOLVER_VERSION = ADD2E_DROP_COMPENDIUM_RESOLVER_VERSION;

function add2eDropResolverNormalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function add2eDropResolverToItemData(doc) {
  if (!(doc instanceof Item)) return null;
  const data = doc.toObject();
  data.flags = data.flags ?? {};
  data.flags.add2e = data.flags.add2e ?? {};
  data.flags.add2e.dropResolvedFromCompendium = !!doc.pack;
  data.flags.add2e.dropResolvedUuid = doc.uuid;
  if (doc.pack) {
    data.pack = doc.pack;
    data.uuid = doc.uuid;
  }
  return data;
}

async function add2eResolveDropItemDataCompendiumFirst(raw) {
  if (!raw || raw.type !== "Item") return null;

  if (raw.pack && raw.id) {
    const pack = game.packs.get(raw.pack);
    const doc = pack ? await pack.getDocument(raw.id) : null;
    const data = add2eDropResolverToItemData(doc);
    if (data) return data;
  }

  if (raw.uuid && String(raw.uuid).startsWith("Compendium.")) {
    const doc = await fromUuid(raw.uuid);
    const data = add2eDropResolverToItemData(doc);
    if (data) return data;
  }

  const fallbackType = String(raw.data?.type ?? "").toLowerCase();
  const fallbackName = String(raw.data?.name ?? "").trim();
  if (fallbackName && ["race", "classe"].includes(fallbackType)) {
    const packIds = fallbackType === "race" ? ["add2e.races"] : ["add2e.classes"];
    const wanted = add2eDropResolverNormalize(fallbackName);

    for (const packId of packIds) {
      const pack = game.packs.get(packId);
      if (!pack) continue;
      const index = await pack.getIndex();
      const entry = index.find(e => add2eDropResolverNormalize(e.name) === wanted);
      if (!entry) continue;
      const doc = await pack.getDocument(entry._id);
      const data = add2eDropResolverToItemData(doc);
      if (data) return data;
    }
  }

  if (raw.uuid) {
    const doc = await fromUuid(raw.uuid);
    const data = add2eDropResolverToItemData(doc);
    if (data) return data;
  }

  return raw.data ?? null;
}

function add2eDropResolverBuildSyntheticEvent(event, raw, itemData) {
  const syntheticRaw = {
    ...raw,
    data: itemData,
    pack: itemData?.pack ?? raw.pack,
    id: itemData?._id ?? raw.id,
    uuid: itemData?.uuid ?? raw.uuid
  };

  return {
    ...event,
    preventDefault: event.preventDefault?.bind(event),
    stopPropagation: event.stopPropagation?.bind(event),
    dataTransfer: {
      ...event.dataTransfer,
      getData: type => type === "text/plain" ? JSON.stringify(syntheticRaw) : event.dataTransfer?.getData?.(type)
    }
  };
}

function add2eInstallDropCompendiumFirstWrapper() {
  const prototype = Add2eActorSheet.prototype;
  if (prototype.__add2eDropCompendiumFirstWrapped) return true;
  if (typeof prototype._onDrop !== "function") {
    throw new Error("[ADD2E] Add2eActorSheet._onDrop doit être installé avant le résolveur compendium-first.");
  }

  const original = prototype._onDrop;
  prototype._onDrop = async function add2eDropCompendiumFirstWrapped(event) {
    const raw = JSON.parse(event.dataTransfer?.getData("text/plain") || "{}");
    if (raw?.type === "Item") {
      const itemData = await add2eResolveDropItemDataCompendiumFirst(raw);
      if (itemData) {
        const syntheticEvent = add2eDropResolverBuildSyntheticEvent(event, raw, itemData);
        return original.call(this, syntheticEvent);
      }
    }
    return original.call(this, event);
  };

  prototype.__add2eDropCompendiumFirstWrapped = true;
  console.log("[ADD2E][DROP][COMPENDIUM_FIRST][READY]", ADD2E_DROP_COMPENDIUM_RESOLVER_VERSION);
  return true;
}

add2eInstallDropCompendiumFirstWrapper();

globalThis.add2eResolveDropItemDataCompendiumFirst = add2eResolveDropItemDataCompendiumFirst;
globalThis.add2eInstallDropCompendiumFirstWrapper = add2eInstallDropCompendiumFirstWrapper;