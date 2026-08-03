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

const ADD2E_MAGIC_ARMOR_MODIFIER_ID = "magic-item-builder:armor-class:bonus";
const add2eMagicOriginalSheetPowers = typeof globalThis.add2eMagicBuilderSheetPowers === "function"
  ? globalThis.add2eMagicBuilderSheetPowers
  : null;

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
  if (decorated.kind === "catalogue" && !add2eObjectPowerOnUsePath(decorated)) {
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
    .map((power, index) => ({ power: add2eDecorateMagicPower(power, item), index }))
    .filter(entry => add2eObjectPowerOnUsePath(entry.power));
}

function add2eMagicCanonicalEffectKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-");
}

function add2eMagicPowerRepresentsCanonicalArmor(power) {
  const raw = power?.canonicalizedEffects;
  const values = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return values.some(value => add2eMagicCanonicalEffectKey(value) === "armor-class");
}

function add2eMagicCanonicalArmorModifier(item) {
  const flags = item?.flags ?? item?._source?.flags ?? {};
  const modifiers = Array.isArray(flags?.add2e?.modifiers) ? flags.add2e.modifiers : [];
  return modifiers.find(modifier => modifier?.id === ADD2E_MAGIC_ARMOR_MODIFIER_ID)
    ?? modifiers.find(modifier => modifier?.domain === "armor-class"
      && modifier?.operation === "add"
      && modifier?.metadata?.producer === "magic-item-builder")
    ?? null;
}

function add2eMagicCanonicalArmorSheetPowers(item) {
  const sourceRows = typeof add2eMagicOriginalSheetPowers === "function"
    ? add2eMagicOriginalSheetPowers(item)
    : [];
  const rows = Array.isArray(sourceRows) ? sourceRows.map(row => add2eMagicClone(row)) : [];
  const modifier = add2eMagicCanonicalArmorModifier(item);
  if (!modifier) return rows;

  const value = Math.abs(Number(modifier.value) || 0);
  if (!value) return rows;
  const storedIndex = rows.findIndex(add2eMagicPowerRepresentsCanonicalArmor);
  const stored = storedIndex >= 0 ? rows[storedIndex] : null;
  const virtual = {
    ...(stored ?? {}),
    img: stored?.img || item?.img || "icons/svg/shield.svg",
    _add2eIndex: stored?._add2eIndex ?? -1,
    _add2eName: stored?._add2eName || "Bonus magique d’armure ou de bouclier",
    _add2eCost: stored?._add2eCost ?? 0,
    _add2eKindLabel: "Catalogue canonique",
    _add2eCategoryLabel: "Défense",
    _add2eAutomationLabel: "Automatique",
    _add2eActivationLabel: "Équipée",
    _add2eSourceLabel: String(modifier?.source?.name ?? item?.name ?? "Item"),
    _add2eHasParameters: false,
    _add2eHasEffects: false,
    _add2eVirtualArmorClass: true,
    _add2eHasStoredPower: storedIndex >= 0,
    _add2eCanonicalArmorBonus: value
  };
  if (storedIndex >= 0) rows[storedIndex] = virtual;
  else rows.push(virtual);
  return rows;
}

function installCanonicalArmorSheetPowerHelper() {
  if (typeof Handlebars === "undefined") return false;
  Handlebars.registerHelper("add2eMagicSheetPowers", item => add2eMagicCanonicalArmorSheetPowers(item));
  globalThis.add2eMagicBuilderSheetPowers = add2eMagicCanonicalArmorSheetPowers;
  return true;
}

async function add2eExecuteObjectMagicPowerGuarded(actor, itemSource, power, index, sheet = null) {
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
  add2eBuildVirtualObjectPowerSort: add2eBuildDisplayVirtualObjectPowerSort,
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
  add2eMagicObjectPowerDisplayName,
  add2eMagicObjectPowerActivation,
  add2eMagicBuilderSheetPowers: add2eMagicCanonicalArmorSheetPowers,
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

installCanonicalArmorSheetPowerHelper();
Hooks.once("init", installCanonicalArmorSheetPowerHelper);
installCanonicalMagicCreatorButtonHooks();
installMagicEnchantmentBuilderHooks();
installMagicItemCreatorHooks();
