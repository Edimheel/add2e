// ============================================================
// ADD2E — Auto-compatibilité race / classe au drop — wrapper
// Version : 2026-06-15-race-class-drop-split-v1
// ============================================================

import {
  ADD2E_RACE_CLASS_DROP_VERSION,
  add2eResolveDropCompatibilityWithPopup
} from "./09a-race-class-drop-core.mjs";

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
      if (raw?.type === "Item") {
        itemData = raw.data ?? null;
        if (!itemData && raw.uuid) {
          const doc = await fromUuid(raw.uuid);
          if (doc instanceof Item) itemData = doc.toObject();
        }
        if (!itemData && raw.pack && raw.id) {
          const pack = game.packs.get(raw.pack);
          const ent = pack && await pack.getDocument(raw.id);
          if (ent instanceof Item) itemData = ent.toObject();
        }
      }
    } catch (e) {
      console.warn("[ADD2E][DROP][RACE_CLASSE] Impossible de lire les données de drop.", e);
    }

    if (itemData && ["classe", "race"].includes(itemData.type)) {
      const resolved = await add2eResolveDropCompatibilityWithPopup(this.actor, itemData, this);
      console.log("[ADD2E][DROP][RACE_CLASSE][RESOLVED]", resolved);
      if (!resolved.ok || resolved.handled) {
        event.preventDefault();
        event.stopPropagation();
        return false;
      }
    }

    return original.call(this, event);
  };

  SheetClass.prototype._add2eDropCompatPopupWrapped = true;
  console.log("[ADD2E][DROP][POPUP] Wrapper compatibilité race/classe installé.", ADD2E_RACE_CLASS_DROP_VERSION);
  return true;
}

Hooks.once("ready", () => {
  if (!add2eInstallDropCompatibilityPopupWrapper()) {
    setTimeout(add2eInstallDropCompatibilityPopupWrapper, 250);
    setTimeout(add2eInstallDropCompatibilityPopupWrapper, 1000);
  }
});

try { globalThis.add2eInstallDropCompatibilityPopupWrapper = add2eInstallDropCompatibilityPopupWrapper; } catch (_e) {}
