// scripts/add2e/object-magic-powers.mjs
// ADD2E — Façade publique des pouvoirs et du créateur d'objets magiques.
// Compatible Foundry V13/V14/V15 — ApplicationV2 / DialogV2.

import {
  ADD2E_MAGIC_ITEM_BUILDER_VERSION,
  add2eMagicReadNumber
} from "./object-magic/core.mjs";
import {
  add2eBuildVirtualObjectPowerSort,
  add2eExecuteObjectMagicPower as add2eExecuteObjectMagicPowerRuntime,
  add2eMagicItemEquippedOrUsable as add2eMagicItemEquippedOrUsableRuntime,
  add2eMagicLooksMagical,
  add2eMagicObjectActivePowerEntries as add2eMagicObjectActivePowerEntriesRuntime,
  add2eMagicObjectChargeInfo,
  add2eMagicObjectPowerArray as add2eMagicObjectPowerArrayRuntime,
  add2eMagicObjectRawPowers as add2eMagicObjectRawPowersRuntime,
  add2eMagicPowerGeneratedId,
  add2eObjectPowerCost,
  add2eObjectPowerCurrentCharges,
  add2eObjectPowerMaxCharges,
  add2eObjectPowerOnUsePath,
  add2eObjectPowerSetCharges
} from "./object-magic/power-runtime.mjs";
import {
  add2eUiBuildObjectMagicSection,
  add2eUiCollectObjectMagicGroups,
  add2eUiCollectObjectMagicPowers,
  add2eUiInjectObjectMagicSection
} from "./object-magic/inventory-ui.mjs";
import {
  add2eMagicBuilderApplyBase,
  add2eMagicBuilderChooseBase,
  add2eMagicBuilderClearBase,
  add2eMagicBuilderDropBase,
  add2eMagicBuilderDropPower,
  add2eMagicBuilderRemovePower,
  installMagicEnchantmentBuilderHooks
} from "./object-magic/enchantment-builder.mjs";
import {
  add2eMagicBuilderCreateMagicItem,
  installMagicItemCreatorHooks
} from "./object-magic/item-creator.mjs";

export * from "./object-magic/core.mjs";
export * from "./object-magic/power-runtime.mjs";
export * from "./object-magic/inventory-ui.mjs";
export * from "./object-magic/enchantment-builder.mjs";
export * from "./object-magic/profiles.mjs";
export * from "./object-magic/catalogue-editor.mjs";
export * from "./object-magic/item-creator.mjs";

function add2eMagicBoolean(value) {
  if (value === true || value === 1) return true;
  const normalized = String(value ?? "").trim().toLowerCase();
  return ["true", "1", "on", "yes", "oui", "equipped", "worn", "portee", "porté"].includes(normalized);
}

export function add2eMagicItemPowerUsable(item) {
  if (add2eMagicItemEquippedOrUsableRuntime(item)) return true;
  const system = item?.system ?? {};
  return [system.equipee, system.equipped, system.estEquipee, system.worn, system.portee]
    .some(add2eMagicBoolean);
}

export function add2eMagicObjectConfiguredRawPowers(item) {
  const system = item?.system ?? {};
  return system.pouvoirs
    ?? system.powers
    ?? system.pouvoirsMagiques
    ?? system.magicalPowers
    ?? add2eMagicObjectRawPowersRuntime(item)
    ?? [];
}

export function add2eMagicObjectConfiguredPowerArray(item) {
  const raw = add2eMagicObjectConfiguredRawPowers(item);
  if (Array.isArray(raw)) return raw.filter(power => power && typeof power === "object");
  if (raw && typeof raw === "object") return Object.values(raw).filter(power => power && typeof power === "object");
  return add2eMagicObjectPowerArrayRuntime(item);
}

export function add2eMagicObjectConfiguredPowerEntries(item) {
  return add2eMagicObjectConfiguredPowerArray(item)
    .map((power, index) => ({ power, index }))
    .filter(entry => add2eObjectPowerOnUsePath(entry.power));
}

async function add2eExecuteObjectMagicPowerGuarded(actor, itemSource, power, index, sheet = null) {
  if (!add2eMagicItemPowerUsable(itemSource)) {
    ui.notifications?.warn?.(`${itemSource?.name ?? "L’objet magique"} doit être équipé pour utiliser ce pouvoir.`);
    return false;
  }
  return add2eExecuteObjectMagicPowerRuntime(actor, itemSource, power, index, sheet);
}

let add2eMagicCreatorButtonHooksInstalled = false;

function add2eMagicCreatorDirectoryRoot(app, html) {
  if (html instanceof HTMLElement) return html;
  if (html?.[0] instanceof HTMLElement) return html[0];
  const element = app?.element;
  return element?.jquery ? element[0] : element;
}

function add2eInstallCanonicalMagicCreatorButton(app, html) {
  const root = add2eMagicCreatorDirectoryRoot(app, html);
  if (!root?.querySelector) return false;
  if (root.querySelector(".add2e-create-magic-item")) return true;
  const header = root.querySelector(".directory-header .header-actions, .directory-header .action-buttons, .directory-header");
  if (!header) return false;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "add2e-create-magic-item";
  button.dataset.add2eUnifiedCreator = "true";
  button.title = "Créer un objet, une arme ou une armure magique";
  button.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i> Créer un objet magique';
  button.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    add2eMagicBuilderCreateMagicItem(app).catch(error => {
      console.error("[ADD2E][OBJET_MAGIQUE][CREATE_ERROR]", error);
      ui.notifications?.error?.(error?.message || "Erreur pendant la création de l’objet magique.");
    });
  });
  header.appendChild(button);
  return true;
}

function installCanonicalMagicCreatorButtonHooks() {
  if (add2eMagicCreatorButtonHooksInstalled) return;
  add2eMagicCreatorButtonHooksInstalled = true;
  Hooks.on("renderItemDirectory", add2eInstallCanonicalMagicCreatorButton);
  Hooks.on("renderSidebarTab", (app, html) => {
    const id = String(app?.options?.id ?? app?.id ?? app?.constructor?.name ?? "").toLowerCase();
    if (id.includes("item")) add2eInstallCanonicalMagicCreatorButton(app, html);
  });
  Hooks.once("ready", () => {
    queueMicrotask(() => add2eInstallCanonicalMagicCreatorButton(ui?.items, ui?.items?.element));
  });
}

Object.assign(globalThis, {
  add2eObjectPowerOnUsePath,
  add2eObjectPowerCost,
  add2eObjectPowerMaxCharges,
  add2eObjectPowerCurrentCharges,
  add2eObjectPowerSetCharges,
  add2eBuildVirtualObjectPowerSort,
  add2eExecuteObjectMagicPower: add2eExecuteObjectMagicPowerGuarded,
  add2eMagicItemEquippedOrUsable: add2eMagicItemPowerUsable,
  add2eMagicObjectRawPowers: add2eMagicObjectConfiguredRawPowers,
  add2eMagicObjectPowerArray: add2eMagicObjectConfiguredPowerArray,
  add2eMagicObjectActivePowerEntries: add2eMagicObjectConfiguredPowerEntries,
  add2eMagicObjectRuntimePowerEntries: add2eMagicObjectActivePowerEntriesRuntime,
  add2eMagicReadNumber,
  add2eMagicObjectChargeInfo,
  add2eMagicLooksMagical,
  add2eMagicPowerGeneratedId,
  add2eUiCollectObjectMagicGroups,
  add2eUiCollectObjectMagicPowers,
  add2eUiBuildObjectMagicSection,
  add2eUiInjectObjectMagicSection,
  ADD2E_MAGIC_ITEM_BUILDER_VERSION,
  add2eMagicBuilderChooseBase,
  add2eMagicBuilderDropBase,
  add2eMagicBuilderClearBase,
  add2eMagicBuilderDropPower,
  add2eMagicBuilderRemovePower,
  add2eMagicBuilderApplyBase,
  add2eCreateMagicItem: add2eMagicBuilderCreateMagicItem
});

installCanonicalMagicCreatorButtonHooks();
installMagicEnchantmentBuilderHooks();
installMagicItemCreatorHooks();
