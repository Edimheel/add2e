// scripts/add2e-initiative-icons.mjs
// ADD2E — icône D6 du tracker d'initiative.

import { ADD2E_INITIATIVE_D6_ICON, TAG } from "./add2e-initiative-constants.mjs";

const INITIATIVE_BUTTON_SELECTOR = "button.combatant-control.roll,[data-action='rollInitiative'],[data-control='rollInitiative']";
const INITIATIVE_ICON_SELECTOR = "i.fa-dice-d20, i.fa-dice-d6, i.fa-dice";

function rootElement(root = document) {
  if (root?.jquery) return root[0];
  if (root?.querySelectorAll) return root;
  if (Array.isArray(root) && root[0]?.querySelectorAll) return root[0];
  if (root?.element?.querySelectorAll) return root.element;
  return document;
}

function makeD6Icon() {
  const img = document.createElement("img");
  img.src = ADD2E_INITIATIVE_D6_ICON;
  img.alt = "D6";
  img.className = "add2e-init-d6-icon";
  img.style.width = "22px";
  img.style.height = "22px";
  img.style.objectFit = "contain";
  img.style.verticalAlign = "middle";
  return img;
}

export function patchInitiativeIcons(root = document) {
  try {
    const scope = rootElement(root);
    if (!scope?.querySelectorAll) return;

    for (const button of scope.querySelectorAll(INITIATIVE_BUTTON_SELECTOR)) {
      if (!button.querySelector?.(".add2e-init-d6-icon")) {
        const icon = button.querySelector?.(INITIATIVE_ICON_SELECTOR);
        if (icon) icon.replaceWith(makeD6Icon());
      }
      button.title = "Lancer l'initiative ADD2E (1d6, le plus petit commence)";
    }
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

  const original = proto._onRender;
  proto._onRender = async function add2eCombatTrackerOnRenderD6Icons(...args) {
    const result = await original.apply(this, args);
    patchInitiativeIcons(this.element ?? document);
    return result;
  };

  proto._onRender.__add2eD6IconPatch = true;
  proto._onRender.__add2eOriginal = original;
  return true;
}
