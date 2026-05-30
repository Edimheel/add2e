// scripts/add2e-initiative-icons.mjs
// ADD2E — icône D6 du bouton de jet d'initiative dans le tracker.

import { ADD2E_INITIATIVE_D6_ICON, TAG } from "./add2e-initiative-constants.mjs";

const INITIATIVE_ROLL_BUTTON_SELECTOR = [
  ".token-initiative button.combatant-control.roll",
  "button.combatant-control.roll[data-action='rollInitiative']",
  "button.combatant-control.roll[data-control='rollInitiative']",
  "button.combatant-control.roll"
].join(",");

const INITIATIVE_ICON = `url(${ADD2E_INITIATIVE_D6_ICON})`;
const INITIATIVE_ICON_HOVER = `url(${ADD2E_INITIATIVE_D6_ICON})`;

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
  button.title = "Lancer l'initiative ADD2E (1d6, le plus petit commence)";
  button.dataset.tooltip = "Lancer l'initiative ADD2E (1d6, le plus petit commence)";

  return beforeIcon !== INITIATIVE_ICON || beforeHover !== INITIATIVE_ICON_HOVER;
}

export function patchInitiativeIcons(root = document) {
  try {
    const scope = rootElement(root);
    if (!scope?.querySelectorAll) return;

    let patched = 0;
    for (const button of scope.querySelectorAll(INITIATIVE_ROLL_BUTTON_SELECTOR)) {
      if (patchRollButton(button)) patched += 1;
    }
    if (patched) console.debug(`${TAG}[D6_ICON][PATCHED_CSS_VARS]`, { patched, icon: INITIATIVE_ICON });
  } catch (err) {
    console.warn(`${TAG}[D6_ICON][ERROR]`, err);
  }
}

function combatTrackerClass() {
  return globalThis.foundry?.applications?.sidebar?.tabs?.CombatTracker
    ?? globalThis.CombatTracker
    ?? ui?.combat?.constructor
    ?? null;
}

export function installInitiativeIconPatch() {
  const cls = combatTrackerClass();
  const proto = cls?.prototype;
  if (!proto || typeof proto._onRender !== "function") return false;
  if (proto._onRender.__add2eD6IconPatch) return true;

  const originalOnRender = proto._onRender;
  proto._onRender = async function add2eCombatTrackerOnRenderD6Icons(...args) {
    const result = await originalOnRender.apply(this, args);
    patchInitiativeIcons(this.element ?? document);
    return result;
  };

  proto._onRender.__add2eD6IconPatch = true;
  proto._onRender.__add2eOriginal = originalOnRender;
  return true;
}
