// ADD2E — Résolution compendium-first des drops personnage
// Version : 2026-06-15-drop-compendium-first-split-v1
//
// Module court chargé après le drop historique. Il force la résolution depuis
// le compendium avant que les validateurs race/classe ne lisent raw.data.

const ADD2E_DROP_COMPENDIUM_RESOLVER_VERSION = "2026-06-15-drop-compendium-first-split-v1";
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
  const SheetClass = globalThis.Add2eActorSheet;
  if (!SheetClass?.prototype?._onDrop) return false;
  if (SheetClass.prototype.__add2eDropCompendiumFirstWrapped) return true;

  const original = SheetClass.prototype._onDrop;
  SheetClass.prototype._onDrop = async function add2eDropCompendiumFirstWrapped(event) {
    let raw = null;
    try {
      raw = JSON.parse(event.dataTransfer?.getData("text/plain") || "{}");
      if (raw?.type === "Item") {
        const itemData = await add2eResolveDropItemDataCompendiumFirst(raw);
        if (itemData) {
          const syntheticEvent = add2eDropResolverBuildSyntheticEvent(event, raw, itemData);
          return original.call(this, syntheticEvent);
        }
      }
    } catch (err) {
      console.warn("[ADD2E][DROP][COMPENDIUM_FIRST] Résolution compendium impossible, fallback drop natif.", err);
    }
    return original.call(this, event);
  };

  SheetClass.prototype.__add2eDropCompendiumFirstWrapped = true;
  console.log("[ADD2E][DROP][COMPENDIUM_FIRST][READY]", ADD2E_DROP_COMPENDIUM_RESOLVER_VERSION);
  return true;
}

Hooks.once("ready", () => {
  if (!add2eInstallDropCompendiumFirstWrapper()) {
    setTimeout(add2eInstallDropCompendiumFirstWrapper, 250);
    setTimeout(add2eInstallDropCompendiumFirstWrapper, 1000);
  }
});

try { globalThis.add2eResolveDropItemDataCompendiumFirst = add2eResolveDropItemDataCompendiumFirst; } catch (_e) {}
try { globalThis.add2eInstallDropCompendiumFirstWrapper = add2eInstallDropCompendiumFirstWrapper; } catch (_e) {}
