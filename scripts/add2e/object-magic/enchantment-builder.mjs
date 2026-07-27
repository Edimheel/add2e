// ADD2E — Objets magiques : enchantements et objets de base.
// Compatible Foundry V13/V14/V15 — DialogV2.

import {
  ADD2E_MAGIC_ITEM_BUILDER_VERSION,
  ADD2E_MAGIC_ITEM_TYPES,
  add2eMagicClone,
  add2eMagicGetProperty,
  add2eMagicMerge,
  add2eMagicMergeUniqueValues,
  add2eMagicNumber,
  add2eMagicOptionalNumber,
  add2eMagicSetProperty,
  add2eMagicSigned,
  add2eObjectMagicEscapeHtml,
  add2eObjectMagicToArray
} from "./core.mjs";

let hooksInstalled = false;

export function add2eMagicBuilderType(item) {
  return String(item?.type ?? "").trim().toLowerCase();
}

export function add2eMagicBuilderSupported(item) {
  return ADD2E_MAGIC_ITEM_TYPES.has(add2eMagicBuilderType(item));
}

export function add2eMagicBuilderDefaultApplication(itemOrType) {
  const type = typeof itemOrType === "string" ? itemOrType : add2eMagicBuilderType(itemOrType);
  return type === "arme" ? "source" : "porteur";
}

export function add2eMagicBuilderEnchantment(item, systemOverride = null) {
  const system = systemOverride ?? item?.system ?? {};
  const hasRawEnchantement = Boolean(
    system.enchantement
    && typeof system.enchantement === "object"
    && !Array.isArray(system.enchantement)
  );
  const raw = hasRawEnchantement ? system.enchantement : {};
  const baseStats = raw.baseStats && typeof raw.baseStats === "object" ? raw.baseStats : {};
  const type = add2eMagicBuilderType(item);
  const legacyToucher = type === "arme"
    ? system.bonus_hit ?? system.bonus_toucher ?? system.hit_bonus ?? system.attack_bonus
    : system.bonus_toucher ?? system.bonus_hit ?? system.attack_bonus;
  const legacyDegats = type === "arme"
    ? system.bonus_dom ?? system.bonus_degats ?? system.damage_bonus ?? system.degats_bonus
    : system.bonus_degats ?? system.bonus_dom ?? system.damage_bonus;
  const legacyBonusCA = system.bonus_ac ?? system.bonus_ca ?? system.ac_bonus ?? system.ca_bonus;
  const legacyCAFixe = system.ca_fixe ?? system.caFixe ?? system.fixedCA ?? system.fixed_ac;
  return {
    schema: 1,
    baseUuid: String(raw.baseUuid ?? item?.flags?.add2e?.baseItemUuid ?? "").trim(),
    baseName: String(raw.baseName ?? item?.flags?.add2e?.baseItemName ?? "").trim(),
    baseType: String(raw.baseType ?? item?.flags?.add2e?.baseItemType ?? "").trim(),
    application: ["source", "porteur"].includes(String(raw.application ?? "").trim())
      ? String(raw.application).trim()
      : add2eMagicBuilderDefaultApplication(item),
    bonusToucher: add2eMagicNumber(raw.bonusToucher ?? raw.bonus_toucher ?? (hasRawEnchantement ? 0 : legacyToucher), 0),
    bonusDegats: add2eMagicNumber(raw.bonusDegats ?? raw.bonus_degats ?? (hasRawEnchantement ? 0 : legacyDegats), 0),
    bonusCA: add2eMagicNumber(raw.bonusCA ?? raw.bonus_ca ?? (hasRawEnchantement ? 0 : legacyBonusCA), 0),
    caFixe: add2eMagicOptionalNumber(raw.caFixe ?? raw.ca_fixe ?? (hasRawEnchantement ? null : legacyCAFixe)),
    baseStats: {
      bonusToucher: add2eMagicNumber(baseStats.bonusToucher, 0),
      bonusDegats: add2eMagicNumber(baseStats.bonusDegats, 0),
      bonusCA: add2eMagicNumber(baseStats.bonusCA, 0),
      caFixe: add2eMagicOptionalNumber(baseStats.caFixe)
    }
  };
}

export function add2eMagicBuilderReadBaseStats(item) {
  const system = item?.system ?? {};
  return {
    bonusToucher: add2eMagicNumber(system.bonus_hit ?? system.bonus_toucher ?? system.hit_bonus ?? system.attack_bonus, 0),
    bonusDegats: add2eMagicNumber(system.bonus_dom ?? system.bonus_degats ?? system.damage_bonus ?? system.degats_bonus, 0),
    bonusCA: add2eMagicNumber(system.bonus_ac ?? system.bonus_ca ?? system.ac_bonus ?? system.ca_bonus, 0),
    caFixe: add2eMagicOptionalNumber(system.ca_fixe ?? system.caFixe ?? system.fixedCA ?? system.fixed_ac)
  };
}

export function add2eMagicBuilderSyncUpdate(item, change) {
  if (!add2eMagicBuilderSupported(item) || !change || typeof change !== "object") return;
  const touchesEnchantement = add2eMagicGetProperty(change, "system.enchantement") !== undefined;
  const touchesLegacyBuilder = [
    "system.bonus_hit", "system.bonus_dom", "system.bonus_toucher", "system.bonus_degats",
    "system.bonus_ac", "system.bonus_ca", "system.ca_fixe", "system.caFixe"
  ].some(path => add2eMagicGetProperty(change, path) !== undefined);
  if (!touchesEnchantement && !touchesLegacyBuilder) return;
  const mergedSystem = add2eMagicMerge(item.system ?? {}, change.system ?? {});
  const enchantement = add2eMagicBuilderEnchantment(item, mergedSystem);
  const type = add2eMagicBuilderType(item);
  const base = enchantement.baseStats;
  const sourceMode = enchantement.application === "source";
  if (type === "arme") {
    add2eMagicSetProperty(change, "system.bonus_hit", base.bonusToucher + (sourceMode ? enchantement.bonusToucher : 0));
    add2eMagicSetProperty(change, "system.bonus_dom", base.bonusDegats + (sourceMode ? enchantement.bonusDegats : 0));
  } else {
    add2eMagicSetProperty(change, "system.bonus_toucher", enchantement.bonusToucher);
    add2eMagicSetProperty(change, "system.bonus_degats", enchantement.bonusDegats);
  }
  add2eMagicSetProperty(change, "system.bonus_ac", base.bonusCA + enchantement.bonusCA);
  add2eMagicSetProperty(change, "system.ca_fixe", enchantement.caFixe ?? base.caFixe ?? null);
  const previousGenerated = new Set(
    add2eObjectMagicToArray(item.flags?.add2e?.magicItemBuilder?.generatedTags)
      .map(value => String(value ?? "").trim())
      .filter(Boolean)
  );
  const existingTags = add2eObjectMagicToArray(mergedSystem.effectTags ?? mergedSystem.effets ?? mergedSystem.effects)
    .map(value => String(value ?? "").trim())
    .filter(Boolean)
    .filter(tag => !previousGenerated.has(tag));
  const generatedTags = [];
  if (enchantement.application === "porteur") {
    if (enchantement.bonusToucher) generatedTags.push(`bonus_attaque:${add2eMagicSigned(enchantement.bonusToucher)}`);
    if (enchantement.bonusDegats) generatedTags.push(`bonus_degats:${add2eMagicSigned(enchantement.bonusDegats)}`);
  }
  add2eMagicSetProperty(change, "system.effectTags", [...new Set([...existingTags, ...generatedTags])]);
  add2eMagicSetProperty(change, "system.enchantement", enchantement);
  add2eMagicSetProperty(change, "flags.add2e.magicItemBuilder", {
    version: ADD2E_MAGIC_ITEM_BUILDER_VERSION,
    generatedTags
  });
  const powers = mergedSystem.pouvoirs ?? mergedSystem.powers ?? [];
  const chargeMax = add2eMagicNumber(mergedSystem.charges?.max, 0);
  const isMagic = Boolean(
    enchantement.baseUuid
    || enchantement.bonusToucher
    || enchantement.bonusDegats
    || enchantement.bonusCA
    || enchantement.caFixe !== null
    || add2eObjectMagicToArray(powers).length
    || chargeMax > 0
  );
  if (isMagic) add2eMagicSetProperty(change, "system.magique", true);
}

function add2eMagicBuilderCopyPaths(sourceSystem, targetUpdate, paths) {
  for (const path of paths) {
    const value = add2eMagicGetProperty(sourceSystem, path);
    if (value === undefined) continue;
    add2eMagicSetProperty(targetUpdate, `system.${path}`, add2eMagicClone(value));
  }
}

function add2eMagicBuilderBasePaths(type) {
  if (type === "arme") {
    return [
      "type", "categorie", "famille", "famille_arme", "facteur_rapidité", "facteur_rapidite",
      "type_degats", "degats", "dégâts", "ajustement_ca", "portee_courte", "portee_moyenne",
      "portee_longue", "poids", "deuxMains", "arme_de_jet", "encombrante", "proprietes",
      "properties", "tags", "effectTags"
    ];
  }
  if (type === "armure") {
    return [
      "ac", "ca", "armorClass", "categorie", "properties", "proprietes", "poids", "weight",
      "prix", "cost", "materiau", "type_armure", "structure", "bouclier", "tags", "effectTags"
    ];
  }
  return [
    "categorie", "sousType", "sous_type", "quantite", "poids", "prix", "activation", "cible",
    "duree", "tags", "effectTags"
  ];
}

export async function add2eMagicBuilderResolveItem(value) {
  if (!value) return null;
  if (value.documentName === "Item") return value;
  if (typeof value === "string" && typeof fromUuid === "function") {
    try {
      const item = await fromUuid(value);
      if (item?.documentName === "Item") return item;
    } catch (_error) {}
  }
  return null;
}

async function add2eMagicBuilderResolveDrop(event) {
  let data = null;
  const editor = foundry?.applications?.ux?.TextEditor?.implementation ?? globalThis.TextEditor;
  if (typeof editor?.getDragEventData === "function") {
    try { data = editor.getDragEventData(event); }
    catch (_error) { data = null; }
  }
  if (!data) {
    try { data = JSON.parse(event?.dataTransfer?.getData?.("text/plain") || "null"); }
    catch (_error) { data = null; }
  }
  if (!data || (data.type && data.type !== "Item")) return null;
  if (data.uuid) {
    const item = await add2eMagicBuilderResolveItem(data.uuid);
    if (item) return item;
  }
  if (typeof CONFIG?.Item?.documentClass?.fromDropData === "function") {
    try {
      const item = await CONFIG.Item.documentClass.fromDropData(data);
      if (item?.documentName === "Item") return item;
    } catch (_error) {}
  }
  if (data.pack && data.id) {
    try { return await game.packs?.get?.(data.pack)?.getDocument?.(data.id) ?? null; }
    catch (_error) {}
  }
  return null;
}

async function add2eMagicBuilderConfirm(title, content, yesLabel = "Confirmer") {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.wait) {
    ui.notifications.error("DialogV2 est introuvable.");
    return false;
  }
  return await DialogV2.wait({
    window: { title },
    modal: true,
    rejectClose: false,
    content,
    buttons: [
      { action: "yes", label: yesLabel, icon: "fa-solid fa-check", default: true, callback: () => true },
      { action: "no", label: "Annuler", icon: "fa-solid fa-xmark", callback: () => false }
    ]
  }) === true;
}

export async function add2eMagicBuilderApplyBase(targetItem, baseItem) {
  if (!add2eMagicBuilderSupported(targetItem) || !add2eMagicBuilderSupported(baseItem)) {
    ui.notifications.warn("La base doit être une arme, une armure ou un objet ADD2E.");
    return false;
  }
  const targetType = add2eMagicBuilderType(targetItem);
  const baseType = add2eMagicBuilderType(baseItem);
  if (targetType !== baseType) {
    ui.notifications.warn(`Une ${targetType} doit utiliser une base du même type.`);
    return false;
  }
  if (targetItem.uuid === baseItem.uuid) {
    ui.notifications.warn("Un objet ne peut pas être sa propre base.");
    return false;
  }
  const currentTags = add2eObjectMagicToArray(targetItem.system?.tags);
  const currentEffectTags = add2eObjectMagicToArray(
    targetItem.system?.effectTags ?? targetItem.system?.effets ?? targetItem.system?.effects
  );
  const update = {};
  add2eMagicBuilderCopyPaths(baseItem.system ?? {}, update, add2eMagicBuilderBasePaths(targetType));
  add2eMagicSetProperty(update, "system.tags", add2eMagicMergeUniqueValues(add2eMagicGetProperty(update, "system.tags"), currentTags));
  add2eMagicSetProperty(update, "system.effectTags", add2eMagicMergeUniqueValues(add2eMagicGetProperty(update, "system.effectTags"), currentEffectTags));
  const currentEnchantement = add2eMagicBuilderEnchantment(targetItem);
  const nextEnchantement = {
    ...currentEnchantement,
    schema: 1,
    baseUuid: String(baseItem.uuid ?? ""),
    baseName: String(baseItem.name ?? "Base"),
    baseType,
    baseStats: add2eMagicBuilderReadBaseStats(baseItem)
  };
  add2eMagicSetProperty(update, "system.enchantement", nextEnchantement);
  add2eMagicSetProperty(update, "flags.add2e.baseItemUuid", nextEnchantement.baseUuid);
  add2eMagicSetProperty(update, "flags.add2e.baseItemName", nextEnchantement.baseName);
  add2eMagicSetProperty(update, "flags.add2e.baseItemType", nextEnchantement.baseType);
  add2eMagicSetProperty(update, "flags.add2e.magicItemBuilderVersion", ADD2E_MAGIC_ITEM_BUILDER_VERSION);
  const currentDescription = String(targetItem.system?.description ?? "").trim();
  if (!currentDescription && String(baseItem.system?.description ?? "").trim()) {
    add2eMagicSetProperty(update, "system.description", baseItem.system.description);
  }
  if (baseItem.img) update.img = baseItem.img;
  await targetItem.update(update, { add2eMagicItemBuilder: true, add2eInternal: true });
  ui.notifications.info(`${targetItem.name} utilise maintenant ${baseItem.name} comme base.`);
  targetItem.sheet?.render?.({ force: true });
  return true;
}

async function add2eMagicBuilderCollectBases(type, currentUuid = "") {
  const groups = [];
  const world = [...(game.items ?? [])]
    .filter(item => add2eMagicBuilderType(item) === type && item.uuid !== currentUuid)
    .map(item => ({ uuid: item.uuid, name: item.name, img: item.img }));
  if (world.length) groups.push({ label: "Monde", entries: world });
  for (const pack of game.packs ?? []) {
    if (String(pack.documentName ?? pack.metadata?.type ?? "") !== "Item") continue;
    let index = null;
    try { index = await pack.getIndex({ fields: ["name", "type", "img"] }); }
    catch (_error) { continue; }
    const entries = [...(index ?? [])]
      .filter(entry => String(entry.type ?? "").toLowerCase() === type)
      .map(entry => ({
        uuid: entry.uuid ?? `Compendium.${pack.collection}.${entry._id}`,
        name: entry.name,
        img: entry.img
      }));
    if (entries.length) groups.push({ label: pack.title ?? pack.metadata?.label ?? pack.collection, entries });
  }
  return groups;
}

export async function add2eMagicBuilderChooseBase(itemUuid) {
  const item = await add2eMagicBuilderResolveItem(itemUuid);
  if (!item || !add2eMagicBuilderSupported(item)) return false;
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.wait) {
    ui.notifications.error("DialogV2 est introuvable.");
    return false;
  }
  const groups = await add2eMagicBuilderCollectBases(add2eMagicBuilderType(item), item.uuid);
  const options = groups.map(group => {
    const rows = group.entries
      .sort((left, right) => String(left.name).localeCompare(String(right.name), "fr"))
      .map(entry => `<option value="${add2eObjectMagicEscapeHtml(entry.uuid)}">${add2eObjectMagicEscapeHtml(entry.name)}</option>`)
      .join("");
    return `<optgroup label="${add2eObjectMagicEscapeHtml(group.label)}">${rows}</optgroup>`;
  }).join("");
  if (!options) {
    ui.notifications.warn(`Aucune base de type ${item.type} n'est disponible.`);
    return false;
  }
  const selectedUuid = await DialogV2.wait({
    window: { title: `Choisir la base de ${item.name}` },
    modal: true,
    rejectClose: false,
    content: `<div class="add2e-dialog" style="min-width:520px;padding:10px"><p>La base fournit les caractéristiques ordinaires. Les pouvoirs, charges et bonus magiques actuels sont conservés.</p><label style="display:grid;gap:5px"><b>Objet de base</b><select name="baseUuid" style="width:100%">${options}</select></label></div>`,
    buttons: [
      {
        action: "apply",
        label: "Utiliser cette base",
        icon: "fa-solid fa-link",
        default: true,
        callback: (_event, button, dialog) => {
          const root = button?.form ?? dialog?.element;
          return root?.querySelector?.('[name="baseUuid"]')?.value ?? "";
        }
      },
      { action: "cancel", label: "Annuler", icon: "fa-solid fa-xmark", callback: () => null }
    ]
  });
  if (!selectedUuid) return false;
  const baseItem = await add2eMagicBuilderResolveItem(selectedUuid);
  if (!baseItem) {
    ui.notifications.error("L'objet de base sélectionné est introuvable.");
    return false;
  }
  return add2eMagicBuilderApplyBase(item, baseItem);
}

export async function add2eMagicBuilderDropBase(event, itemUuid) {
  event?.preventDefault?.();
  event?.stopPropagation?.();
  const item = await add2eMagicBuilderResolveItem(itemUuid);
  const baseItem = await add2eMagicBuilderResolveDrop(event);
  if (!item || !baseItem) {
    ui.notifications.warn("Objet de base introuvable.");
    return false;
  }
  if (add2eMagicBuilderType(item) !== add2eMagicBuilderType(baseItem)) {
    ui.notifications.warn(`Déposez un Item de type ${item.type}.`);
    return false;
  }
  const confirmed = await add2eMagicBuilderConfirm(
    `Utiliser ${baseItem.name} comme base`,
    `<div class="add2e-dialog" style="min-width:460px;padding:8px"><p>Copier les caractéristiques ordinaires de <b>${add2eObjectMagicEscapeHtml(baseItem.name)}</b> dans <b>${add2eObjectMagicEscapeHtml(item.name)}</b> ?</p><p>Les pouvoirs, charges et bonus magiques seront conservés.</p></div>`,
    "Appliquer la base"
  );
  return confirmed ? add2eMagicBuilderApplyBase(item, baseItem) : false;
}

export async function add2eMagicBuilderClearBase(itemUuid) {
  const item = await add2eMagicBuilderResolveItem(itemUuid);
  if (!item || !add2eMagicBuilderSupported(item)) return false;
  const confirmed = await add2eMagicBuilderConfirm(
    "Dissocier l'objet de base",
    `<div class="add2e-dialog" style="min-width:440px;padding:8px"><p>Dissocier <b>${add2eObjectMagicEscapeHtml(item.name)}</b> de sa base ?</p><p>Les caractéristiques déjà copiées restent présentes.</p></div>`,
    "Dissocier"
  );
  if (!confirmed) return false;
  const enchantement = add2eMagicBuilderEnchantment(item);
  enchantement.baseUuid = "";
  enchantement.baseName = "";
  enchantement.baseType = "";
  await item.update({
    "system.enchantement": enchantement,
    "flags.add2e.-=baseItemUuid": null,
    "flags.add2e.-=baseItemName": null,
    "flags.add2e.-=baseItemType": null
  }, { add2eMagicItemBuilder: true, add2eInternal: true });
  item.sheet?.render?.({ force: true });
  return true;
}

export async function add2eMagicBuilderDropPower(event, itemUuid) {
  event?.preventDefault?.();
  event?.stopPropagation?.();
  const item = await add2eMagicBuilderResolveItem(itemUuid);
  const spell = await add2eMagicBuilderResolveDrop(event);
  if (!item || !add2eMagicBuilderSupported(item)) return false;
  if (!spell || String(spell.type ?? "").toLowerCase() !== "sort") {
    ui.notifications.warn("Déposez un Item de type sort.");
    return false;
  }
  const store = globalThis.add2eStoreSpellInMagicItem;
  if (typeof store !== "function") {
    ui.notifications.error("Le gestionnaire de pouvoirs magiques est indisponible.");
    return false;
  }
  const stored = await store(item, spell);
  if (stored) item.sheet?.render?.({ force: true });
  return stored !== false;
}

export async function add2eMagicBuilderRemovePower(itemUuid, powerIndex) {
  const item = await add2eMagicBuilderResolveItem(itemUuid);
  if (!item || !add2eMagicBuilderSupported(item)) return false;
  const remove = globalThis.add2eRemoveMagicItemPower;
  if (typeof remove !== "function") {
    ui.notifications.error("Le gestionnaire de pouvoirs magiques est indisponible.");
    return false;
  }
  const removed = await remove(item, Number(powerIndex));
  if (removed) item.sheet?.render?.({ force: true });
  return removed !== false;
}

export function installMagicEnchantmentBuilderHooks() {
  if (hooksInstalled) return;
  hooksInstalled = true;
  Hooks.on("preUpdateItem", (item, change) => add2eMagicBuilderSyncUpdate(item, change));
}
