// ADD2E — Constructeur commun d'armes, armures et objets magiques.
// Compatible Foundry V13/V14/V15 — ApplicationV2 / DialogV2.

const ADD2E_MAGIC_ITEM_BUILDER_VERSION = "2026-07-20-magic-item-builder-v2";
const ADD2E_MAGIC_ITEM_TYPES = new Set(["arme", "armure", "objet"]);

function add2eMagicBuilderClone(value) {
  try { return foundry.utils.deepClone(value); }
  catch (_error) { return JSON.parse(JSON.stringify(value ?? null)); }
}

function add2eMagicBuilderEscape(value) {
  const text = String(value ?? "");
  try {
    if (typeof foundry?.utils?.escapeHTML === "function") return foundry.utils.escapeHTML(text);
  } catch (_error) {}
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function add2eMagicBuilderType(item) {
  return String(item?.type ?? "").trim().toLowerCase();
}

function add2eMagicBuilderSupported(item) {
  return ADD2E_MAGIC_ITEM_TYPES.has(add2eMagicBuilderType(item));
}

function add2eMagicBuilderArray(value) {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(add2eMagicBuilderArray);
  if (value instanceof Set) return [...value].flatMap(add2eMagicBuilderArray);
  if (typeof value === "string") return value.split(/[,;|\n]+/g).map(entry => entry.trim()).filter(Boolean);
  if (typeof value === "object") return Object.values(value).flatMap(add2eMagicBuilderArray);
  return [String(value)];
}

function add2eMagicBuilderNumber(value, fallback = 0) {
  if (value === undefined || value === null || value === "") return fallback;
  const number = Number(String(value).replace(",", "."));
  return Number.isFinite(number) ? number : fallback;
}

function add2eMagicBuilderOptionalNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(String(value).replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

function add2eMagicBuilderSigned(value) {
  const number = add2eMagicBuilderNumber(value, 0);
  return `${number >= 0 ? "+" : ""}${number}`;
}

function add2eMagicBuilderGetProperty(object, path) {
  try { return foundry.utils.getProperty(object, path); }
  catch (_error) { return String(path).split(".").reduce((current, key) => current?.[key], object); }
}

function add2eMagicBuilderSetProperty(object, path, value) {
  try { return foundry.utils.setProperty(object, path, value); }
  catch (_error) {
    const parts = String(path).split(".");
    let current = object;
    while (parts.length > 1) {
      const key = parts.shift();
      current[key] ??= {};
      current = current[key];
    }
    current[parts[0]] = value;
    return true;
  }
}

function add2eMagicBuilderMerge(base, update) {
  try {
    return foundry.utils.mergeObject(add2eMagicBuilderClone(base ?? {}), add2eMagicBuilderClone(update ?? {}), {
      inplace: false,
      insertKeys: true,
      overwrite: true,
      recursive: true
    });
  } catch (_error) {
    return { ...(base ?? {}), ...(update ?? {}) };
  }
}

function add2eMagicBuilderDefaultApplication(itemOrType) {
  const type = typeof itemOrType === "string" ? itemOrType : add2eMagicBuilderType(itemOrType);
  return type === "arme" ? "source" : "porteur";
}

function add2eMagicBuilderEnchantment(item, systemOverride = null) {
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
    bonusToucher: add2eMagicBuilderNumber(
      raw.bonusToucher ?? raw.bonus_toucher ?? (hasRawEnchantement ? 0 : legacyToucher),
      0
    ),
    bonusDegats: add2eMagicBuilderNumber(
      raw.bonusDegats ?? raw.bonus_degats ?? (hasRawEnchantement ? 0 : legacyDegats),
      0
    ),
    bonusCA: add2eMagicBuilderNumber(
      raw.bonusCA ?? raw.bonus_ca ?? (hasRawEnchantement ? 0 : legacyBonusCA),
      0
    ),
    caFixe: add2eMagicBuilderOptionalNumber(
      raw.caFixe ?? raw.ca_fixe ?? (hasRawEnchantement ? null : legacyCAFixe)
    ),
    baseStats: {
      bonusToucher: add2eMagicBuilderNumber(baseStats.bonusToucher, 0),
      bonusDegats: add2eMagicBuilderNumber(baseStats.bonusDegats, 0),
      bonusCA: add2eMagicBuilderNumber(baseStats.bonusCA, 0),
      caFixe: add2eMagicBuilderOptionalNumber(baseStats.caFixe)
    }
  };
}

function add2eMagicBuilderReadBaseStats(item) {
  const system = item?.system ?? {};
  return {
    bonusToucher: add2eMagicBuilderNumber(
      system.bonus_hit ?? system.bonus_toucher ?? system.hit_bonus ?? system.attack_bonus,
      0
    ),
    bonusDegats: add2eMagicBuilderNumber(
      system.bonus_dom ?? system.bonus_degats ?? system.damage_bonus ?? system.degats_bonus,
      0
    ),
    bonusCA: add2eMagicBuilderNumber(
      system.bonus_ac ?? system.bonus_ca ?? system.ac_bonus ?? system.ca_bonus,
      0
    ),
    caFixe: add2eMagicBuilderOptionalNumber(
      system.ca_fixe ?? system.caFixe ?? system.fixedCA ?? system.fixed_ac
    )
  };
}

function add2eMagicBuilderNormalizeTag(value) {
  return String(value ?? "").trim();
}

function add2eMagicBuilderMergeUniqueValues(...values) {
  const seen = new Set();
  const result = [];
  for (const raw of values) {
    for (const value of add2eMagicBuilderArray(raw)) {
      const text = String(value ?? "").trim();
      const key = text.toLowerCase();
      if (!text || seen.has(key)) continue;
      seen.add(key);
      result.push(text);
    }
  }
  return result;
}

function add2eMagicBuilderSyncUpdate(item, change) {
  if (!add2eMagicBuilderSupported(item) || !change || typeof change !== "object") return;

  const touchesEnchantement = add2eMagicBuilderGetProperty(change, "system.enchantement") !== undefined;
  const touchesLegacyBuilder = [
    "system.bonus_hit", "system.bonus_dom", "system.bonus_toucher", "system.bonus_degats",
    "system.bonus_ac", "system.bonus_ca", "system.ca_fixe", "system.caFixe"
  ].some(path => add2eMagicBuilderGetProperty(change, path) !== undefined);
  if (!touchesEnchantement && !touchesLegacyBuilder) return;

  const mergedSystem = add2eMagicBuilderMerge(item.system ?? {}, change.system ?? {});
  const enchantement = add2eMagicBuilderEnchantment(item, mergedSystem);
  const type = add2eMagicBuilderType(item);
  const base = enchantement.baseStats;
  const sourceMode = enchantement.application === "source";

  if (type === "arme") {
    add2eMagicBuilderSetProperty(change, "system.bonus_hit", base.bonusToucher + (sourceMode ? enchantement.bonusToucher : 0));
    add2eMagicBuilderSetProperty(change, "system.bonus_dom", base.bonusDegats + (sourceMode ? enchantement.bonusDegats : 0));
  } else {
    add2eMagicBuilderSetProperty(change, "system.bonus_toucher", enchantement.bonusToucher);
    add2eMagicBuilderSetProperty(change, "system.bonus_degats", enchantement.bonusDegats);
  }

  add2eMagicBuilderSetProperty(change, "system.bonus_ac", base.bonusCA + enchantement.bonusCA);
  add2eMagicBuilderSetProperty(change, "system.ca_fixe", enchantement.caFixe ?? base.caFixe ?? null);

  const previousGenerated = new Set(
    add2eMagicBuilderArray(item.flags?.add2e?.magicItemBuilder?.generatedTags)
      .map(add2eMagicBuilderNormalizeTag)
      .filter(Boolean)
  );
  const existingTags = add2eMagicBuilderArray(mergedSystem.effectTags ?? mergedSystem.effets ?? mergedSystem.effects)
    .map(add2eMagicBuilderNormalizeTag)
    .filter(Boolean)
    .filter(tag => !previousGenerated.has(tag));
  const generatedTags = [];

  if (enchantement.application === "porteur") {
    if (enchantement.bonusToucher) generatedTags.push(`bonus_attaque:${add2eMagicBuilderSigned(enchantement.bonusToucher)}`);
    if (enchantement.bonusDegats) generatedTags.push(`bonus_degats:${add2eMagicBuilderSigned(enchantement.bonusDegats)}`);
  }

  add2eMagicBuilderSetProperty(change, "system.effectTags", [...new Set([...existingTags, ...generatedTags])]);
  add2eMagicBuilderSetProperty(change, "system.enchantement", enchantement);
  add2eMagicBuilderSetProperty(change, "flags.add2e.magicItemBuilder", {
    version: ADD2E_MAGIC_ITEM_BUILDER_VERSION,
    generatedTags
  });

  const powers = mergedSystem.pouvoirs ?? mergedSystem.powers ?? [];
  const chargeMax = add2eMagicBuilderNumber(mergedSystem.charges?.max, 0);
  const isMagic = Boolean(
    enchantement.baseUuid
    || enchantement.bonusToucher
    || enchantement.bonusDegats
    || enchantement.bonusCA
    || enchantement.caFixe !== null
    || add2eMagicBuilderArray(powers).length
    || chargeMax > 0
  );
  if (isMagic) add2eMagicBuilderSetProperty(change, "system.magique", true);
}

function add2eMagicBuilderCopyPaths(sourceSystem, targetUpdate, paths) {
  for (const path of paths) {
    const value = add2eMagicBuilderGetProperty(sourceSystem, path);
    if (value === undefined) continue;
    add2eMagicBuilderSetProperty(targetUpdate, `system.${path}`, add2eMagicBuilderClone(value));
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

async function add2eMagicBuilderResolveItem(value) {
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
  const editor = foundry?.applications?.ux?.TextEditor?.implementation ?? globalThis.TextEditor ?? null;
  try { data = editor?.getDragEventData?.(event) ?? null; } catch (_error) {}
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

async function add2eMagicBuilderApplyBase(targetItem, baseItem) {
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

  const currentTags = add2eMagicBuilderArray(targetItem.system?.tags);
  const currentEffectTags = add2eMagicBuilderArray(
    targetItem.system?.effectTags ?? targetItem.system?.effets ?? targetItem.system?.effects
  );
  const update = {};
  add2eMagicBuilderCopyPaths(baseItem.system ?? {}, update, add2eMagicBuilderBasePaths(targetType));
  add2eMagicBuilderSetProperty(
    update,
    "system.tags",
    add2eMagicBuilderMergeUniqueValues(add2eMagicBuilderGetProperty(update, "system.tags"), currentTags)
  );
  add2eMagicBuilderSetProperty(
    update,
    "system.effectTags",
    add2eMagicBuilderMergeUniqueValues(add2eMagicBuilderGetProperty(update, "system.effectTags"), currentEffectTags)
  );

  const currentEnchantement = add2eMagicBuilderEnchantment(targetItem);
  const nextEnchantement = {
    ...currentEnchantement,
    schema: 1,
    baseUuid: String(baseItem.uuid ?? ""),
    baseName: String(baseItem.name ?? "Base"),
    baseType,
    baseStats: add2eMagicBuilderReadBaseStats(baseItem)
  };
  add2eMagicBuilderSetProperty(update, "system.enchantement", nextEnchantement);
  add2eMagicBuilderSetProperty(update, "flags.add2e.baseItemUuid", nextEnchantement.baseUuid);
  add2eMagicBuilderSetProperty(update, "flags.add2e.baseItemName", nextEnchantement.baseName);
  add2eMagicBuilderSetProperty(update, "flags.add2e.baseItemType", nextEnchantement.baseType);
  add2eMagicBuilderSetProperty(update, "flags.add2e.magicItemBuilderVersion", ADD2E_MAGIC_ITEM_BUILDER_VERSION);

  const currentDescription = String(targetItem.system?.description ?? "").trim();
  if (!currentDescription && String(baseItem.system?.description ?? "").trim()) {
    add2eMagicBuilderSetProperty(update, "system.description", baseItem.system.description);
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

async function add2eMagicBuilderChooseBase(itemUuid) {
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
      .map(entry => `<option value="${add2eMagicBuilderEscape(entry.uuid)}">${add2eMagicBuilderEscape(entry.name)}</option>`)
      .join("");
    return `<optgroup label="${add2eMagicBuilderEscape(group.label)}">${rows}</optgroup>`;
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

async function add2eMagicBuilderDropBase(event, itemUuid) {
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
    `<div class="add2e-dialog" style="min-width:460px;padding:8px"><p>Copier les caractéristiques ordinaires de <b>${add2eMagicBuilderEscape(baseItem.name)}</b> dans <b>${add2eMagicBuilderEscape(item.name)}</b> ?</p><p>Les pouvoirs, charges et bonus magiques seront conservés.</p></div>`,
    "Appliquer la base"
  );
  if (!confirmed) return false;
  return add2eMagicBuilderApplyBase(item, baseItem);
}

async function add2eMagicBuilderClearBase(itemUuid) {
  const item = await add2eMagicBuilderResolveItem(itemUuid);
  if (!item || !add2eMagicBuilderSupported(item)) return false;
  const confirmed = await add2eMagicBuilderConfirm(
    "Dissocier l'objet de base",
    `<div class="add2e-dialog" style="min-width:440px;padding:8px"><p>Dissocier <b>${add2eMagicBuilderEscape(item.name)}</b> de sa base ?</p><p>Les caractéristiques déjà copiées restent présentes.</p></div>`,
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

async function add2eMagicBuilderDropPower(event, itemUuid) {
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

async function add2eMagicBuilderRemovePower(itemUuid, powerIndex) {
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

Hooks.on("preUpdateItem", (item, change) => add2eMagicBuilderSyncUpdate(item, change));

globalThis.ADD2E_MAGIC_ITEM_BUILDER_VERSION = ADD2E_MAGIC_ITEM_BUILDER_VERSION;
globalThis.add2eMagicBuilderChooseBase = add2eMagicBuilderChooseBase;
globalThis.add2eMagicBuilderDropBase = add2eMagicBuilderDropBase;
globalThis.add2eMagicBuilderClearBase = add2eMagicBuilderClearBase;
globalThis.add2eMagicBuilderDropPower = add2eMagicBuilderDropPower;
globalThis.add2eMagicBuilderRemovePower = add2eMagicBuilderRemovePower;
globalThis.add2eMagicBuilderApplyBase = add2eMagicBuilderApplyBase;
