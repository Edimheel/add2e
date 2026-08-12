// scripts/add2e/object-magic-powers.mjs
// ADD2E — Façade publique des pouvoirs et du créateur d'objets magiques.
// Compatible Foundry V13/V14/V15 — ApplicationV2 / DialogV2.

import {
  ADD2E_MAGIC_ITEM_BUILDER_VERSION,
  add2eMagicClone,
  add2eMagicReadNumber
} from "./object-magic/core.mjs";
import {
  add2eBuildVirtualObjectPowerSort as add2eBuildVirtualObjectPowerSortRuntime,
  add2eExecuteObjectMagicPower as add2eExecuteObjectMagicPowerRuntime,
  add2eGetObjectPowerResource,
  add2eResolveObjectPowerResource,
  add2eMagicItemEquippedOrUsable as add2eMagicItemEquippedOrUsableRuntime,
  add2eMagicLooksMagical,
  add2eMagicObjectActivePowerEntries as add2eMagicObjectActivePowerEntriesRuntime,
  add2eMagicObjectChargeInfo,
  add2eMagicObjectPowerArray as add2eMagicObjectPowerArrayRuntime,
  add2eMagicObjectRawPowers as add2eMagicObjectRawPowersRuntime,
  add2eMagicPowerGeneratedId,
  add2eObjectPowerCost,
  add2eObjectPowerCurrentCharges,
  add2eObjectPowerIsActivatable,
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

function add2eMagicText(...values) {
  for (const value of values) {
    if (value === undefined || value === null || typeof value === "object") continue;
    const text = String(value).trim();
    if (text && text !== "[object Object]") return text;
  }
  return "";
}

function add2eMagicLinkedSpellEffect(power) {
  return (Array.isArray(power?.effects) ? power.effects : [])
    .find(effect => ["linked_spell", "linked-spell", "sort_lie", "sort-lié"].includes(String(effect?.type ?? effect?.kind ?? "").trim().toLowerCase()))
    ?? null;
}

function add2eMagicLinkedSpellDocument(power) {
  const effect = add2eMagicLinkedSpellEffect(power);
  const uuid = add2eMagicText(
    effect?.spellUuid,
    power?.parameters?.spellUuid,
    power?.spellUuid,
    power?.linkedSpell?.spellUuid,
    power?.linkedSpell?.uuid,
    power?.linkedSpell?.sourceUuid
  );
  if (!uuid || typeof globalThis.fromUuidSync !== "function") return null;
  try { return globalThis.fromUuidSync(uuid) ?? null; }
  catch (_error) { return null; }
}

export function add2eMagicObjectPowerDisplayName(power, item = null) {
  const effect = add2eMagicLinkedSpellEffect(power);
  const linkedDocument = add2eMagicLinkedSpellDocument(power);
  return add2eMagicText(
    power?.parameters?.spellName,
    effect?.spellName,
    effect?.name,
    effect?.nom,
    power?.spellName,
    power?.linkedSpell?.spellName,
    power?.linkedSpell?.name,
    linkedDocument?.name,
    power?.name,
    power?.nom,
    power?.label,
    item?.name,
    "Pouvoir magique"
  );
}

function add2eMagicActivationNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? value : null;
  if (typeof value === "string") {
    const match = value.trim().match(/-?\d+(?:[.,]\d+)?/);
    if (!match) return null;
    const number = Number(match[0].replace(",", "."));
    return Number.isFinite(number) && number >= 0 ? number : null;
  }
  if (typeof value === "object") {
    for (const key of ["segments", "segment", "initiativeSegment", "castingTime", "activationTime", "time", "value", "amount", "cost"]) {
      const number = add2eMagicActivationNumber(value[key]);
      if (Number.isFinite(number)) return number;
    }
  }
  return null;
}

export function add2eMagicObjectPowerActivation(power) {
  const effect = add2eMagicLinkedSpellEffect(power);
  const linkedDocument = add2eMagicLinkedSpellDocument(power);
  const linkedSystem = linkedDocument?.system ?? power?.linkedSpell?.system ?? {};
  const candidates = [
    power?.initiativeSegment,
    power?.temps_incantation,
    power?.castingTime,
    power?.casting_time,
    power?.activationTime,
    power?.parameters?.initiativeSegment,
    power?.parameters?.activationTime,
    power?.parameters?.castingTime,
    effect?.initiativeSegment,
    effect?.activationTime,
    power?.activation,
    linkedSystem?.initiativeSegment,
    linkedSystem?.temps_incantation,
    linkedSystem?.castingTime,
    linkedSystem?.casting_time
  ];
  let segment = null;
  for (const candidate of candidates) {
    segment = add2eMagicActivationNumber(candidate);
    if (Number.isFinite(segment)) break;
  }
  const label = Number.isFinite(segment)
    ? `${segment} segment${segment > 1 ? "s" : ""}`
    : add2eMagicText(
        power?.activationLabel,
        power?.activation?.label,
        power?.activation?.text,
        power?.temps_incantation,
        power?.castingTime,
        power?.casting_time,
        effect?.activationLabel,
        linkedSystem?.temps_incantation,
        linkedSystem?.castingTime,
        linkedSystem?.casting_time,
        "Objet magique"
      );
  return { segment: Number.isFinite(segment) ? segment : null, label };
}

function add2eDecorateMagicPower(power, item = null) {
  const decorated = add2eMagicClone(power ?? {});
  const linkedDocument = add2eMagicLinkedSpellDocument(power);
  const activation = add2eMagicObjectPowerActivation(power);
  const displayName = add2eMagicObjectPowerDisplayName(power, item);
  decorated.catalogueLabel ??= add2eMagicText(power?.label, power?.name, power?.nom);
  decorated.name = displayName;
  decorated.nom = displayName;
  decorated.displayName = displayName;
  decorated.activationLabel = activation.label;
  decorated.temps_incantation = activation.label;
  if (activation.segment !== null) decorated.initiativeSegment = activation.segment;
  if (decorated.kind === "catalogue" && add2eObjectPowerIsActivatable(decorated) && !add2eObjectPowerOnUsePath(decorated)) {
    decorated.onUse = "add2e://magic-catalogue";
    decorated.onuse = decorated.onUse;
    decorated.on_use = decorated.onUse;
  }
  if (linkedDocument?.img) decorated.img = linkedDocument.img;
  return decorated;
}

function add2eBuildDisplayVirtualObjectPowerSort(actor, itemSource, power, index) {
  const decorated = add2eDecorateMagicPower(power, itemSource);
  const sort = add2eBuildVirtualObjectPowerSortRuntime(actor, itemSource, decorated, index);
  const activation = add2eMagicObjectPowerActivation(decorated);
  const source = {
    name: decorated.name,
    ...(decorated.img ? { img: decorated.img } : {}),
    "system.temps_incantation": activation.label,
    ...(activation.segment !== null ? { "system.initiativeSegment": activation.segment } : {})
  };
  try { sort?.updateSource?.(source); }
  catch (_error) {}
  return sort;
}

function add2eMagicItemSuppressionEffect(item) {
  const actor = item?.actor ?? (item?.parent?.documentName === "Actor" ? item.parent : null);
  const itemId = String(item?.id ?? "");
  const itemUuid = String(item?.uuid ?? "");
  if (!actor || (!itemId && !itemUuid)) return null;

  return Array.from(actor.effects ?? []).find(effect => {
    if (!effect || effect.disabled === true) return false;
    const suppression = effect.flags?.add2e?.magicItemSuppression ?? effect.getFlag?.("add2e", "magicItemSuppression") ?? null;
    if (!suppression || suppression.active !== true) return false;
    const suppressedId = String(suppression.itemId ?? "");
    const suppressedUuid = String(suppression.itemUuid ?? "");
    return (itemId && suppressedId === itemId) || (itemUuid && suppressedUuid === itemUuid);
  }) ?? null;
}

export function add2eMagicItemPowerUsable(item) {
  if (add2eMagicItemSuppressionEffect(item)) return false;
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
  return add2eMagicObjectActivePowerEntriesRuntime(item)
    .map(({ power, index }) => ({ power: add2eDecorateMagicPower(power, item), index }));
}

async function add2eExecuteObjectMagicPowerGuarded(actor, itemSource, power, index, sheet = null) {
  const suppression = add2eMagicItemSuppressionEffect(itemSource);
  if (suppression) {
    ui.notifications?.warn?.(`${itemSource?.name ?? "L’objet magique"} est temporairement neutralisé par Dissipation de la magie.`);
    return false;
  }
  if (!add2eMagicItemPowerUsable(itemSource)) {
    ui.notifications?.warn?.(`${itemSource?.name ?? "L’objet magique"} doit être équipé pour utiliser ce pouvoir.`);
    return false;
  }
  if ((power?.kind === "catalogue" || add2eObjectPowerOnUsePath(power) === "add2e://magic-catalogue")
    && typeof globalThis.add2eExecuteMagicCataloguePower === "function") {
    return globalThis.add2eExecuteMagicCataloguePower(actor, itemSource, power, index, sheet);
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

function add2eLockMagicCreatorBonusFields(app, html) {
  queueMicrotask(() => {
    const root = add2eMagicCreatorDirectoryRoot(app, html);
    const form = root?.querySelector?.(".add2e-magic-item-create-form");
    if (!form) return;
    const fields = ["bonusToucher", "bonusDegats", "bonusCA", "caFixe"];
    for (const name of fields) {
      const field = form.querySelector(`[name="${name}"]`);
      if (!field) continue;
      field.value = name === "caFixe" ? "" : "0";
      field.disabled = true;
      field.readOnly = true;
      field.setAttribute("aria-readonly", "true");
      field.title = "Cette valeur est définie uniquement par les pouvoirs canoniques sélectionnés.";
    }
    const group = form.querySelector("[data-add2e-application-group]");
    if (group && !group.querySelector("[data-add2e-canonical-power-note]")) {
      const note = document.createElement("p");
      note.dataset.add2eCanonicalPowerNote = "true";
      note.style.margin = "6px 0 0";
      note.style.opacity = ".78";
      note.textContent = "Les bonus sont définis uniquement par les pouvoirs canoniques sélectionnés ci-dessous.";
      group.appendChild(note);
    }
  });
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
  Hooks.on("renderApplicationV2", add2eLockMagicCreatorBonusFields);
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
  add2eGetObjectPowerResource,
  add2eResolveObjectPowerResource,
  add2eBuildVirtualObjectPowerSort: add2eBuildDisplayVirtualObjectPowerSort,
  add2eExecuteObjectMagicPower: add2eExecuteObjectMagicPowerGuarded,
  add2eMagicItemEquippedOrUsable: add2eMagicItemPowerUsable,
  add2eMagicObjectRawPowers: add2eMagicObjectConfiguredRawPowers,
  add2eMagicObjectPowerArray: add2eMagicObjectConfiguredPowerArray,
  add2eMagicObjectActivePowerEntries: add2eMagicObjectConfiguredPowerEntries,
  add2eMagicObjectRuntimePowerEntries: add2eMagicObjectActivePowerEntriesRuntime,
  add2eObjectPowerIsActivatable,
  add2eMagicReadNumber,
  add2eMagicObjectChargeInfo,
  add2eMagicLooksMagical,
  add2eMagicPowerGeneratedId,
  add2eMagicObjectPowerDisplayName,
  add2eMagicObjectPowerActivation,
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
