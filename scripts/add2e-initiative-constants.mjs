// scripts/add2e-initiative-constants.mjs
// ADD2E — constantes et utilitaires partagés de l'initiative.

export const ADD2E_INITIATIVE_VERSION = "2026-05-30-initiative-split-v1";
export const ADD2E_INITIATIVE_D6_ICON = "systems/add2e/assets/D6_3D_tracker.png";
export const TAG = "[ADD2E][INIT]";

export const initiativeState = {
  configured: false,
  patched: false,
  hooksInstalled: false,
  sorting: false,
  warningAt: 0,
  sortTimer: null,
  localSyncTimer: null
};

globalThis.ADD2E_INITIATIVE_VERSION = ADD2E_INITIATIVE_VERSION;

export function configureInitiative() {
  if (initiativeState.configured) return;
  initiativeState.configured = true;
  CONFIG.Combat ??= {};
  CONFIG.Combat.initiative = { formula: "1d6", decimals: 2 };
}

export function hasProperty(obj, path) {
  return globalThis.foundry?.utils?.hasProperty
    ? globalThis.foundry.utils.hasProperty(obj, path)
    : path in (obj ?? {});
}

export function escapeHtml(value) {
  try {
    return globalThis.foundry?.utils?.escapeHTML
      ? globalThis.foundry.utils.escapeHTML(String(value ?? ""))
      : String(value ?? "");
  } catch (_e) {
    const div = document.createElement("div");
    div.textContent = String(value ?? "");
    return div.innerHTML;
  }
}
