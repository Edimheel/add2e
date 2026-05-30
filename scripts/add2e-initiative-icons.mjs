// scripts/add2e-initiative-icons.mjs
// ADD2E — icône D6 du tracker d'initiative.

import { ADD2E_INITIATIVE_D6_ICON, TAG } from "./add2e-initiative-constants.mjs";

const SELECTOR = "button.combatant-control.roll,[data-action='rollInitiative'],[data-control='rollInitiative']";
const ICON_SELECTOR = "i.fa-dice-d20, i.fa-dice-d6, i.fa-dice";

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

function patchButton(button) {
  if (!button || button.querySelector?.(".add2e-init-d6-icon")) return;
  const icon = button.querySelector?.(ICON_SELECTOR);
  if (!icon) return;
  icon.replaceWith(makeD6Icon());
  button.title = "Lancer l'initiative ADD2E (1d6, le plus petit commence)";
}

export function patchInitiativeIcons(root = document, { retry = true } = {}) {
  try {
    const scope = rootElement(root);
    for (const button of scope.querySelectorAll(SELECTOR)) patchButton(button);

    if (retry) {
      setTimeout(() => patchInitiativeIcons(document, { retry: false }), 50);
    }
  } catch (err) {
    console.warn(`${TAG}[D6_ICON][ERROR]`, err);
  }
}
