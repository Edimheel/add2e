// scripts/add2e/object-magic-powers.mjs
// ADD2E — Façade publique des pouvoirs et du créateur d'objets magiques.
// Compatible Foundry V13/V14/V15 — ApplicationV2 / DialogV2.

import {
  ADD2E_MAGIC_ITEM_BUILDER_VERSION,
  add2eMagicReadNumber
} from "./object-magic/core.mjs";
import {
  add2eBuildVirtualObjectPowerSort,
  add2eExecuteObjectMagicPower,
  add2eMagicItemEquippedOrUsable,
  add2eMagicLooksMagical,
  add2eMagicObjectActivePowerEntries,
  add2eMagicObjectChargeInfo,
  add2eMagicObjectPowerArray,
  add2eMagicObjectRawPowers,
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

Object.assign(globalThis, {
  add2eObjectPowerOnUsePath,
  add2eObjectPowerCost,
  add2eObjectPowerMaxCharges,
  add2eObjectPowerCurrentCharges,
  add2eObjectPowerSetCharges,
  add2eBuildVirtualObjectPowerSort,
  add2eExecuteObjectMagicPower,
  add2eMagicItemEquippedOrUsable,
  add2eMagicObjectRawPowers,
  add2eMagicObjectPowerArray,
  add2eMagicObjectActivePowerEntries,
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

installMagicEnchantmentBuilderHooks();
installMagicItemCreatorHooks();
