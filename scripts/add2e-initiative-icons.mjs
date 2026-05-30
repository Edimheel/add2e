// scripts/add2e-initiative-icons.mjs
// ADD2E — icône D6 du tracker d'initiative.

import { ADD2E_INITIATIVE_D6_ICON, TAG } from "./add2e-initiative-constants.mjs";

export function patchInitiativeIcons(root = document) {
  try {
    const scope = root?.jquery ? root[0] : root;
    if (!scope?.querySelectorAll) return;

    const selector = "button.combatant-control.roll,[data-action='rollInitiative'],[data-control='rollInitiative']";
    for (const button of scope.querySelectorAll(selector)) {
      const existing = button.querySelector?.(".add2e-init-d6-icon");
      if (!existing) {
        const icon = button.querySelector?.("i.fa-dice-d20, i.fa-dice-d6, i.fa-dice");
        if (icon) {
          const img = document.createElement("img");
          img.src = ADD2E_INITIATIVE_D6_ICON;
          img.alt = "D6";
          img.className = "add2e-init-d6-icon";
          img.style.width = "22px";
          img.style.height = "22px";
          img.style.objectFit = "contain";
          img.style.verticalAlign = "middle";
          icon.replaceWith(img);
        }
      }
      button.title = "Lancer l'initiative ADD2E (1d6, le plus petit commence)";
    }
  } catch (err) {
    console.warn(`${TAG}[D6_ICON][ERROR]`, err);
  }
}
