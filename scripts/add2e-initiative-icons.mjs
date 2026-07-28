// scripts/add2e-initiative-icons.mjs
// ADD2E — icône D6 du bouton de jet d'initiative dans le tracker.
// Rafraîchissement par hooks publics et observation DOM, sans patch de méthode privée.

import { ADD2E_INITIATIVE_D6_ICON, ADD2E_INITIATIVE_VERSION } from "./add2e-initiative-constants.mjs";

const INITIATIVE_ROLL_BUTTON_SELECTOR = [
  ".token-initiative button.combatant-control.roll",
  "button.combatant-control.roll[data-action='rollInitiative']",
  "button.combatant-control.roll[data-control='rollInitiative']",
  "button.combatant-control.roll"
].join(",");

const INITIATIVE_ICON = `url(${ADD2E_INITIATIVE_D6_ICON})`;
const INITIATIVE_ICON_HOVER = `url(${ADD2E_INITIATIVE_D6_ICON})`;
const INITIATIVE_TOOLTIP = "Lancer l'initiative ADD2E (1d6, le résultat le plus élevé commence)";
let initiativeIconObserver = null;
let initiativeIconRefreshScheduled = false;

function rootElement(root = document) {
  if (root?.jquery) return root[0];
  if (root?.querySelectorAll) return root;
  if (Array.isArray(root) && root[0]?.querySelectorAll) return root[0];
  if (root?.element?.querySelectorAll) return root.element;
  return document;
}

function patchRollButton(button) {
  if (!button) return false;

  const beforeIcon = button.style.getPropertyValue("--initiative-icon");
  const beforeHover = button.style.getPropertyValue("--initiative-icon-hover");

  button.style.setProperty("--initiative-icon", INITIATIVE_ICON);
  button.style.setProperty("--initiative-icon-hover", INITIATIVE_ICON_HOVER);
  button.style.setProperty("background-image", "var(--initiative-icon)");
  button.style.setProperty("background-repeat", "no-repeat");
  button.style.setProperty("background-position", "center");
  button.style.setProperty("background-size", "34px 34px");
  button.style.setProperty("filter", "none");
  button.style.setProperty("opacity", "1");
  button.style.setProperty("background-color", "transparent");
  button.style.setProperty("border-radius", "0");
  button.style.setProperty("box-shadow", "none");
  button.title = INITIATIVE_TOOLTIP;
  button.dataset.tooltip = INITIATIVE_TOOLTIP;

  return beforeIcon !== INITIATIVE_ICON || beforeHover !== INITIATIVE_ICON_HOVER;
}

export function patchInitiativeIcons(root = document) {
  try {
    const scope = rootElement(root);
    if (!scope?.querySelectorAll) return;

    for (const button of scope.querySelectorAll(INITIATIVE_ROLL_BUTTON_SELECTOR)) {
      patchRollButton(button);
    }
  } catch (_err) {}
}

function scheduleInitiativeIconRefresh() {
  if (initiativeIconRefreshScheduled) return;
  initiativeIconRefreshScheduled = true;
  queueMicrotask(() => {
    initiativeIconRefreshScheduled = false;
    patchInitiativeIcons(document);
  });
}

export function installInitiativeIconPatch() {
  if (globalThis.__ADD2E_INITIATIVE_ICON_OBSERVER === ADD2E_INITIATIVE_VERSION) return true;
  globalThis.__ADD2E_INITIATIVE_ICON_OBSERVER = ADD2E_INITIATIVE_VERSION;

  initiativeIconObserver?.disconnect?.();
  initiativeIconObserver = null;

  if (!document?.body || typeof MutationObserver !== "function") {
    patchInitiativeIcons(document);
    return true;
  }

  initiativeIconObserver = new MutationObserver(mutations => {
    if (mutations.some(mutation => mutation.addedNodes?.length || mutation.type === "attributes")) {
      scheduleInitiativeIconRefresh();
    }
  });
  initiativeIconObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "data-action", "data-control"]
  });
  patchInitiativeIcons(document);
  return true;
}
