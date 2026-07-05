// ADD2E — Point d'entrée des écouteurs de feuille ApplicationV2.
// Les comportements sont répartis en modules fonctionnels sans modifier les sélecteurs ni l'ordre d'exécution.

import "./13d-actor-sheet-listeners-core.mjs";

const ADD2E_SHEET_LISTENER_RECOVERY_VERSION = "2026-07-05-sheet-tabs-force-ex-v1";

globalThis.ADD2E_SHEET_LISTENER_RECOVERY_VERSION = ADD2E_SHEET_LISTENER_RECOVERY_VERSION;

function add2eListenerRoot(sheet, html) {
  if (typeof sheet?._add2eSheetRoot === "function") return sheet._add2eSheetRoot(html);
  const root = html?.jquery ? html[0] : html;
  return root ?? null;
}

function add2eInstallSheetListenerRecovery() {
  const proto = globalThis.Add2eActorSheet?.prototype;
  if (!proto || typeof proto._add2eBindPersistentTabs === "function") return;

  proto._add2eBindPersistentTabs = function _add2eBindPersistentTabs(html) {
    const root = add2eListenerRoot(this, html);
    if (!root) return;

    const initialTab = this._add2eActiveTab || this._add2eReadStoredTab?.() || "resume";
    this._add2eActivateTab?.(initialTab, root);

    if (root.dataset.add2eTabsForceExBound === "1") return;
    root.dataset.add2eTabsForceExBound = "1";

    root.addEventListener("pointerdown", event => {
      const tabLink = event.target?.closest?.(".sheet-tabs .item[data-tab], .a2e-tabs .item[data-tab]");
      if (tabLink && root.contains(tabLink)) {
        this._add2eRememberActiveTab?.(root, tabLink.dataset.tab || "resume");
        return;
      }
      this._add2eRememberActiveTab?.(root);
    }, true);

    root.addEventListener("change", event => {
      const field = event.target?.closest?.("select[data-add2e-force-ex]");
      if (!field || !root.contains(field)) {
        this._add2eRememberActiveTab?.(root);
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      this._add2eRememberActiveTab?.(root);

      const value = Math.max(0, Math.min(100, Math.trunc(Number(field.value) || 0)));
      field.value = String(value);
      field.dataset.currentForceEx = String(value);

      Promise.resolve(
        globalThis.add2eSetExceptionalStrength?.(this.actor, value, { reason: "force-ex-selection" })
      ).then(saved => {
        if (saved === false) return;
        this._add2eActivateTab?.(this._add2eActiveTab || this._add2eReadStoredTab?.() || "resume", root);
        if (this.rendered) this.render(false);
      }).catch(error => {
        console.error("[ADD2E][FORCE_EX][SET_ERROR]", { actor: this.actor?.name, error });
      });
    }, true);

    root.querySelectorAll(".sheet-tabs .item[data-tab], .a2e-tabs .item[data-tab]").forEach(tabLink => {
      tabLink.addEventListener("click", event => {
        event.preventDefault();
        this._add2eActivateTab?.(tabLink.dataset.tab || "resume", root);
      });
    });
  };
}

add2eInstallSheetListenerRecovery();
