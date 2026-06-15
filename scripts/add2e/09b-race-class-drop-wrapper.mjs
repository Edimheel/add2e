// ============================================================
// ADD2E — Auto-compatibilité race / classe au drop — wrapper
// Version : 2026-06-15-race-class-drop-split-v2-compendium-first
// ============================================================

import {
  ADD2E_RACE_CLASS_DROP_VERSION,
  add2eResolveDropCompatibilityWithPopup
} from "./09a-race-class-drop-core.mjs";

async function add2eResolveRaceClassDropItemData(raw) {
  if (!raw || raw.type !== "Item") return null;

  if (typeof globalThis.add2eResolveDropItemDataCompendiumFirst === "function") {
    const resolved = await globalThis.add2eResolveDropItemDataCompendiumFirst(raw);
    if (resolved) return resolved;
  }

  if (raw.pack && raw.id) {
    const pack = game.packs.get(raw.pack);
    const ent = pack && await pack.getDocument(raw.id);
    if (ent instanceof Item) return ent.toObject();
  }

  if (raw.uuid && String(raw.uuid).startsWith("Compendium.")) {
    const doc = await fromUuid(raw.uuid);
    if (doc instanceof Item) return doc.toObject();
  }

  const fallbackType = String(raw.data?.type ?? "").toLowerCase();
  const fallbackName = String(raw.data?.name ?? "").trim().toLowerCase();
  if (fallbackName && ["race", "classe"].includes(fallbackType)) {
    const packIds = fallbackType === "race" ? ["add2e.races"] : ["add2e.classes"];
    for (const packId of packIds) {
      const pack = game.packs.get(packId);
      if (!pack) continue;
      const index = await pack.getIndex();
      const entry = index.find(e => String(e.name ?? "").trim().toLowerCase() === fallbackName);
      if (!entry) continue;
      const ent = await pack.getDocument(entry._id);
      if (ent instanceof Item) return ent.toObject();
    }
  }

  if (raw.uuid) {
    const doc = await fromUuid(raw.uuid);
    if (doc instanceof Item) return doc.toObject();
  }

  return raw.data ?? null;
}

function add2eInstallDropCompatibilityPopupWrapper() {
  const SheetClass = globalThis.Add2eActorSheet;
  if (!SheetClass?.prototype?._onDrop) return false;
  if (SheetClass.prototype._add2eDropCompatPopupWrapped) return true;

  const original = SheetClass.prototype._onDrop;
  SheetClass.prototype._onDrop = async function add2eDropCompatPopupWrapped(event) {
    let raw = null;
    let itemData = null;
    try {
      raw = JSON.parse(event.dataTransfer?.getData("text/plain") || "{}");
      itemData = await add2eResolveRaceClassDropItemData(raw);
    } catch (e) {
      console.warn("[ADD2E][DROP][RACE_CLASSE] Impossible de lire les données de drop.", e);
    }

    if (itemData && ["classe", "race"].includes(itemData.type)) {
      const resolved = await add2eResolveDropCompatibilityWithPopup(this.actor, itemData, this);
      console.log("[ADD2E][DROP][RACE_CLASSE][RESOLVED]", {
        ...resolved,
        sourceCompendium: itemData.flags?.add2e?.dropResolvedFromCompendium === true,
        sourceUuid: itemData.flags?.add2e?.dropResolvedUuid ?? itemData.uuid ?? null
      });
      if (!resolved.ok || resolved.handled) {
        event.preventDefault();
        event.stopPropagation();
        return false;
      }
    }

    return original.call(this, event);
  };

  SheetClass.prototype._add2eDropCompatPopupWrapped = true;
  console.log("[ADD2E][DROP][POPUP] Wrapper compatibilité race/classe installé.", ADD2E_RACE_CLASS_DROP_VERSION, "compendium-first");
  return true;
}

Hooks.once("ready", () => {
  if (!add2eInstallDropCompatibilityPopupWrapper()) {
    setTimeout(add2eInstallDropCompatibilityPopupWrapper, 250);
    setTimeout(add2eInstallDropCompatibilityPopupWrapper, 1000);
  }
});

try { globalThis.add2eResolveRaceClassDropItemData = add2eResolveRaceClassDropItemData; } catch (_e) {}
try { globalThis.add2eInstallDropCompatibilityPopupWrapper = add2eInstallDropCompatibilityPopupWrapper; } catch (_e) {}
