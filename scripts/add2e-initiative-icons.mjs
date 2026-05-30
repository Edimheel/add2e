// scripts/add2e-initiative-icons.mjs
// ADD2E — icône D6 du bouton de jet d'initiative dans le tracker.

import { ADD2E_INITIATIVE_D6_ICON, TAG } from "./add2e-initiative-constants.mjs";

const INITIATIVE_ROLL_CONTROL_SELECTOR = [
  ".combatant-control.roll",
  ".combatant-control[data-action='rollInitiative']",
  ".combatant-control[data-control='rollInitiative']",
  "[data-action='rollInitiative']",
  "[data-control='rollInitiative']"
].join(",");

const INITIATIVE_DICE_ICON_SELECTOR = "i.fa-dice-d20, i.fa-dice-d6, i.fa-dice";
const D20_CLASS = "fa-dice-d20";
const D6_CLASS = "fa-dice-d6";
const CLASS_KEYS = ["icon", "cssClass", "classes", "class", "className"];

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

function patchClassString(value) {
  return typeof value === "string" ? value.replace(D20_CLASS, D6_CLASS) : value;
}

function patchClassKeys(obj) {
  if (!obj || typeof obj !== "object") return;
  for (const key of CLASS_KEYS) {
    if (typeof obj[key] === "string") obj[key] = patchClassString(obj[key]);
  }
}

function patchTurnContext(context) {
  patchClassKeys(context);
  patchClassKeys(context?.control);
  patchClassKeys(context?.controls);
  patchClassKeys(context?.initiative);
  patchClassKeys(context?.combatant);
  patchClassKeys(context?.turn);

  for (const list of [context?.controls, context?.buttons, context?.actions]) {
    if (!Array.isArray(list)) continue;
    for (const entry of list) patchClassKeys(entry);
  }

  return context;
}

function patchRollControl(control) {
  if (!control || control.querySelector?.(".add2e-init-d6-icon")) return false;
  const icon = control.querySelector?.(INITIATIVE_DICE_ICON_SELECTOR);
  if (!icon) return false;
  icon.replaceWith(makeD6Icon());
  control.title = "Lancer l'initiative ADD2E (1d6, le plus petit commence)";
  control.dataset.tooltip = "Lancer l'initiative ADD2E (1d6, le plus petit commence)";
  return true;
}

export function patchInitiativeIcons(root = document) {
  try {
    const scope = rootElement(root);
    if (!scope?.querySelectorAll) return;

    let patched = 0;
    for (const control of scope.querySelectorAll(INITIATIVE_ROLL_CONTROL_SELECTOR)) {
      if (patchRollControl(control)) patched += 1;
    }
    if (patched) console.debug(`${TAG}[D6_ICON][PATCHED_DOM]`, { patched });
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
  if (!proto) return false;

  if (typeof proto._prepareTurnContext === "function" && !proto._prepareTurnContext.__add2eD6IconPatch) {
    const originalPrepareTurnContext = proto._prepareTurnContext;
    proto._prepareTurnContext = async function add2ePrepareTurnContextD6Icon(...args) {
      const context = await originalPrepareTurnContext.apply(this, args);
      patchTurnContext(context);
      return context;
    };
    proto._prepareTurnContext.__add2eD6IconPatch = true;
    proto._prepareTurnContext.__add2eOriginal = originalPrepareTurnContext;
  }

  if (typeof proto._onRender === "function" && !proto._onRender.__add2eD6IconPatch) {
    const originalOnRender = proto._onRender;
    proto._onRender = async function add2eCombatTrackerOnRenderD6Icons(...args) {
      const result = await originalOnRender.apply(this, args);
      patchInitiativeIcons(this.element ?? document);
      return result;
    };
    proto._onRender.__add2eD6IconPatch = true;
    proto._onRender.__add2eOriginal = originalOnRender;
  }

  return true;
}
