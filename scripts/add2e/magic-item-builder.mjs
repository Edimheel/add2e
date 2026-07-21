// ADD2E — Constructeur commun d'armes, armures et objets magiques.
// Compatible Foundry V13/V14/V15 — ApplicationV2 / DialogV2.

const ADD2E_MAGIC_ITEM_BUILDER_VERSION = "2026-07-21-magic-item-builder-v5-creator-profiles";
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

// ---------------------------------------------------------------------------
// Générateur unifié : conserve le bouton historique et crée directement
// un Item objet, arme ou armure. Les bases d'armes et d'armures proviennent
// exclusivement des compendiums d'Items correspondants.
// ---------------------------------------------------------------------------

const ADD2E_MAGIC_CREATOR_PROFILES = Object.freeze({
  objet: Object.freeze({
    label: "Objet",
    itemType: "objet",
    sousType: "objet_magique",
    img: "icons/svg/item-bag.svg",
    tags: ["objet_magique", "actif_si_equipe"],
    enchantable: true,
    charges: true,
    defaultCharges: 0,
    defaultMax: 0
  }),
  arme: Object.freeze({
    label: "Arme",
    itemType: "arme",
    baseType: "arme",
    img: "icons/weapons/swords/sword-guard-gold.webp",
    tags: ["objet_magique", "arme_magique"],
    enchantable: true,
    charges: true,
    defaultCharges: 0,
    defaultMax: 0
  }),
  armure: Object.freeze({
    label: "Armure",
    itemType: "armure",
    baseType: "armure",
    img: "icons/equipment/chest/breastplate-layered-steel.webp",
    tags: ["objet_magique", "armure_magique", "actif_si_equipe"],
    enchantable: true,
    charges: true,
    defaultCharges: 0,
    defaultMax: 0
  }),
  anneau: Object.freeze({
    label: "Anneau",
    itemType: "objet",
    sousType: "anneau",
    img: "icons/equipment/finger/ring-band-engraved-gold.webp",
    tags: ["objet_magique", "sous_type:anneau", "anneau", "actif_si_equipe"],
    enchantable: true,
    charges: false
  }),
  parchemin: Object.freeze({
    label: "Parchemin",
    itemType: "objet",
    sousType: "parchemin_de_sort",
    img: "icons/sundries/scrolls/scroll-runed-brown.webp",
    tags: ["objet_magique", "parchemin", "parchemin_de_sort", "consommable"],
    consumable: true,
    enchantable: false,
    charges: false
  }),
  baguette: Object.freeze({
    label: "Baguette",
    itemType: "objet",
    sousType: "baguette",
    img: "icons/weapons/wands/wand-gem-blue.webp",
    tags: ["objet_magique", "sous_type:baguette", "baguette", "charges", "actif_si_equipe"],
    enchantable: true,
    charges: true,
    rechargeable: true,
    rechargeFormula: "1d6",
    defaultCharges: 10,
    defaultMax: 10
  }),
  batonnet: Object.freeze({
    label: "Bâtonnet",
    itemType: "objet",
    sousType: "batonnet",
    img: "icons/weapons/staves/staff-engraved-brown.webp",
    tags: ["objet_magique", "sous_type:batonnet", "batonnet", "charges", "actif_si_equipe"],
    enchantable: true,
    charges: true,
    rechargeable: true,
    rechargeFormula: "1d6",
    defaultCharges: 10,
    defaultMax: 10
  }),
  potion: Object.freeze({
    label: "Potion",
    itemType: "objet",
    sousType: "potion",
    img: "icons/consumables/potions/potion-bottle-corked-blue.webp",
    tags: ["objet_magique", "potion", "consommable_potion", "consommable"],
    consumable: true,
    enchantable: true,
    charges: true,
    defaultCharges: 10,
    defaultMax: 10
  }),
  livre_illusionniste: Object.freeze({
    label: "Livre de sorts d’illusionniste",
    itemType: "objet",
    sousType: "livre_de_sorts",
    img: "icons/sundries/books/book-embossed-gold-blue.webp",
    spellbookOwnerList: "illusionniste",
    enchantable: false,
    charges: false
  }),
  livre_magicien: Object.freeze({
    label: "Livre de sorts de magicien",
    itemType: "objet",
    sousType: "livre_de_sorts",
    img: "icons/sundries/books/book-embossed-gold-red.webp",
    spellbookOwnerList: "magicien",
    enchantable: false,
    charges: false
  })
});

async function add2eMagicBuilderCollectCreatorBases() {
  const result = { arme: [], armure: [] };

  for (const pack of game.packs ?? []) {
    if (String(pack.documentName ?? pack.metadata?.type ?? "") !== "Item") continue;

    let index;
    try {
      index = await pack.getIndex({ fields: ["name", "type", "img"] });
    } catch (error) {
      console.warn("[ADD2E][OBJET_MAGIQUE][BASE_INDEX_ERROR]", {
        pack: pack.collection,
        error
      });
      continue;
    }

    const source = String(pack.title ?? pack.metadata?.label ?? pack.collection);
    for (const entry of index ?? []) {
      const type = String(entry.type ?? "").trim().toLowerCase();
      if (type !== "arme" && type !== "armure") continue;
      result[type].push({
        uuid: String(entry.uuid ?? `Compendium.${pack.collection}.${entry._id}`),
        name: String(entry.name ?? "Base"),
        source
      });
    }
  }

  for (const type of ["arme", "armure"]) {
    result[type].sort((left, right) =>
      left.source.localeCompare(right.source, "fr")
      || left.name.localeCompare(right.name, "fr")
    );
  }
  return result;
}

function add2eMagicBuilderCreatorBaseOptions(entries) {
  const groups = new Map();
  for (const entry of entries ?? []) {
    if (!groups.has(entry.source)) groups.set(entry.source, []);
    groups.get(entry.source).push(entry);
  }

  return [...groups.entries()].map(([source, rows]) => {
    const options = rows.map(entry =>
      `<option value="${add2eMagicBuilderEscape(entry.uuid)}">${add2eMagicBuilderEscape(entry.name)}</option>`
    ).join("");
    return `<optgroup label="${add2eMagicBuilderEscape(source)}">${options}</optgroup>`;
  }).join("");
}

function add2eMagicBuilderToggleCreatorType(form) {
  const root = form?.closest?.(".window-content") ?? form;
  const profile = String(form?.elements?.profile?.value ?? "objet");
  const defaults = ADD2E_MAGIC_CREATOR_PROFILES[profile];
  const weaponGroup = root?.querySelector?.('[data-add2e-base-group="arme"]');
  const armorGroup = root?.querySelector?.('[data-add2e-base-group="armure"]');
  const applicationGroup = root?.querySelector?.('[data-add2e-application-group]');
  const applicationModeGroup = root?.querySelector?.('[data-add2e-application-mode-group]');
  const chargesGroup = root?.querySelector?.('[data-add2e-charges-group]');
  const rechargeGroup = root?.querySelector?.('[data-add2e-recharge-group]');

  if (weaponGroup) weaponGroup.hidden = profile !== "arme";
  if (armorGroup) armorGroup.hidden = profile !== "armure";
  if (applicationGroup) applicationGroup.hidden = !["objet", "arme", "armure", "anneau", "baguette", "batonnet", "potion"].includes(profile);
  if (applicationModeGroup) applicationModeGroup.hidden = profile !== "arme";
  if (chargesGroup) chargesGroup.hidden = defaults?.charges !== true;
  if (rechargeGroup) rechargeGroup.hidden = defaults?.charges !== true;

  const application = form?.elements?.application;
  const current = form?.elements?.chargesValue;
  const maximum = form?.elements?.chargesMax;
  if (application && application.dataset.profile !== profile) {
    application.value = add2eMagicBuilderDefaultApplication(defaults?.itemType ?? profile);
    application.dataset.profile = profile;
  }
  if (current && current.dataset.profile !== profile) {
    current.value = String(defaults?.defaultCharges ?? 0);
    current.dataset.profile = profile;
  }
  if (maximum && maximum.dataset.profile !== profile) {
    maximum.value = String(defaults?.defaultMax ?? 0);
    maximum.dataset.profile = profile;
  }
}

globalThis.add2eMagicBuilderToggleCreatorType = add2eMagicBuilderToggleCreatorType;

function add2eMagicBuilderCreatorForm(dialogOrElement) {
  const element = dialogOrElement?.element ?? dialogOrElement ?? null;
  return element?.querySelector?.("form.add2e-magic-item-create-form")
    ?? element?.closest?.("dialog")?.querySelector?.("form.add2e-magic-item-create-form")
    ?? null;
}

function add2eMagicBuilderCreateDialogV2Class(DialogV2) {
  return class Add2eMagicItemCreatorDialogV2 extends DialogV2 {
    _onRender(context, options) {
      super._onRender?.(context, options);
      this.add2eBindCreatorTypeSelect();
    }

    add2eBindCreatorTypeSelect() {
      const form = add2eMagicBuilderCreatorForm(this);
      const select = form?.elements?.profile ?? form?.querySelector?.('select[name="profile"]');
      if (!form || !select) return false;

      if (select.dataset.add2eCreatorTypeBound !== "1") {
        select.dataset.add2eCreatorTypeBound = "1";
        const refresh = () => add2eMagicBuilderToggleCreatorType(form);
        select.addEventListener("change", refresh);
        select.addEventListener("input", refresh);
      }

      add2eMagicBuilderToggleCreatorType(form);
      return true;
    }
  };
}

async function add2eMagicBuilderWaitCreatorDialog(DialogV2, config) {
  const CreatorDialogV2 = add2eMagicBuilderCreateDialogV2Class(DialogV2);

  return new Promise(resolve => {
    let settled = false;
    const finish = value => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
      return value;
    };

    const buttons = (config.buttons ?? []).map(button => ({
      ...button,
      callback: async (...args) => finish(await button.callback?.(...args))
    }));

    const dialog = new CreatorDialogV2({ ...config, buttons });
    dialog.addEventListener?.("close", () => finish(null), { once: true });
    Promise.resolve(dialog.render({ force: true })).then(() => dialog.add2eBindCreatorTypeSelect?.());
  });
}

function add2eMagicBuilderCreatorSpellbookData(profile, name) {
  const ownerList = String(profile.spellbookOwnerList ?? "");
  return {
    name,
    type: "objet",
    img: profile.img,
    system: {
      nom: name,
      type: "objet",
      categorie: "objet_magique",
      sousType: "livre_de_sorts",
      quantite: 1,
      poids: 5,
      equipee: false,
      magique: true,
      consommable: false,
      description: "Livre de sorts indépendant. Il peut être placé dans un coffre, ramassé et consulté par un personnage compatible.",
      arcaneDocument: {
        schema: 1,
        kind: "spellbook",
        personal: false,
        ownerList,
        ownerActorUuid: "",
        spells: []
      },
      nom_non_identifie: "Livre de sorts"
    },
    effects: [],
    flags: {
      add2e: {
        arcaneDocumentKind: "spellbook",
        personalSpellbook: false,
        ownerActorUuid: "",
        ownerSpellList: ownerList,
        generatedBy: "migration-livres-parchemins-v1"
      }
    }
  };
}

function add2eMagicBuilderCreatorReadForm(button, dialog) {
  const form = button?.form
    ?? button?.element?.closest?.("form")
    ?? dialog?.element?.querySelector?.("form.add2e-magic-item-create-form");
  if (!form) return null;

  const data = Object.fromEntries(new FormData(form).entries());
  const profile = String(data.profile ?? "objet").trim();
  const baseUuid = profile === "arme"
    ? String(data.weaponBaseUuid ?? "").trim()
    : profile === "armure"
      ? String(data.armorBaseUuid ?? "").trim()
      : "";

  return {
    profile,
    baseUuid,
    name: String(data.name ?? "").trim(),
    unidentifiedName: String(data.unidentifiedName ?? "").trim(),
    identified: data.identified === "on",
    cursed: data.cursed === "on",
    application: String(data.application ?? "").trim(),
    bonusToucher: add2eMagicBuilderNumber(data.bonusToucher, 0),
    bonusDegats: add2eMagicBuilderNumber(data.bonusDegats, 0),
    bonusCA: add2eMagicBuilderNumber(data.bonusCA, 0),
    caFixe: add2eMagicBuilderOptionalNumber(data.caFixe),
    chargesValue: Math.max(0, Math.trunc(add2eMagicBuilderNumber(data.chargesValue, 0))),
    chargesMax: Math.max(0, Math.trunc(add2eMagicBuilderNumber(data.chargesMax, 0))),
    rechargeable: data.rechargeable === "on",
    rechargeFormula: String(data.rechargeFormula ?? "").trim()
  };
}

function add2eMagicBuilderCreatorSanitizeBase(baseItem, profile, name) {
  const source = add2eMagicBuilderClone(baseItem.toObject?.() ?? {});
  delete source._id;
  delete source.folder;
  delete source.sort;
  delete source.ownership;
  delete source._stats;

  source.name = name;
  source.type = profile.itemType;
  source.img = baseItem.img || profile.img;
  source.system = add2eMagicBuilderClone(baseItem.system ?? {});
  source.effects = Array.isArray(source.effects) ? source.effects : [];
  source.flags = add2eMagicBuilderClone(baseItem.flags ?? {});
  source.flags.add2e ??= {};
  return source;
}

function add2eMagicBuilderCreatorEnchantSystem(itemData, profileKey, profile, result, baseItem = null) {
  const system = itemData.system ??= {};
  const type = profile.itemType;
  const baseStats = baseItem ? add2eMagicBuilderReadBaseStats(baseItem) : {
    bonusToucher: 0,
    bonusDegats: 0,
    bonusCA: 0,
    caFixe: null
  };
  const application = ["source", "porteur"].includes(result.application)
    ? result.application
    : add2eMagicBuilderDefaultApplication(type);

  system.nom = itemData.name;
  system.type = type;
  system.magique = true;
  system.identifie = result.identified;
  system.maudit = result.cursed;
  system.nom_non_identifie = result.unidentifiedName || (type === "arme" ? "Arme inconnue" : type === "armure" ? "Armure inconnue" : "Objet inconnu");
  system.equipee ??= false;
  system.pouvoirs = [];
  system.tags = add2eMagicBuilderMergeUniqueValues(system.tags, profile.tags);
  system.effectTags = add2eMagicBuilderMergeUniqueValues(system.effectTags, profile.tags);

  const enchantement = {
    schema: 1,
    baseUuid: String(baseItem?.uuid ?? ""),
    baseName: String(baseItem?.name ?? ""),
    baseType: String(baseItem?.type ?? ""),
    application,
    bonusToucher: result.bonusToucher,
    bonusDegats: result.bonusDegats,
    bonusCA: result.bonusCA,
    caFixe: result.caFixe,
    baseStats
  };
  system.enchantement = enchantement;

  if (type === "arme") {
    const sourceMode = application === "source";
    system.bonus_hit = baseStats.bonusToucher + (sourceMode ? result.bonusToucher : 0);
    system.bonus_dom = baseStats.bonusDegats + (sourceMode ? result.bonusDegats : 0);
  } else {
    system.bonus_toucher = result.bonusToucher;
    system.bonus_degats = result.bonusDegats;
  }
  system.bonus_ac = baseStats.bonusCA + result.bonusCA;
  system.ca_fixe = result.caFixe ?? baseStats.caFixe ?? null;

  if (application === "porteur") {
    if (result.bonusToucher) system.effectTags = add2eMagicBuilderMergeUniqueValues(system.effectTags, `bonus_attaque:${add2eMagicBuilderSigned(result.bonusToucher)}`);
    if (result.bonusDegats) system.effectTags = add2eMagicBuilderMergeUniqueValues(system.effectTags, `bonus_degats:${add2eMagicBuilderSigned(result.bonusDegats)}`);
  }

  const max = profile.charges ? Math.max(result.chargesMax, result.chargesValue) : 0;
  const current = profile.charges ? Math.min(result.chargesValue, max) : 0;
  if (profile.charges || max > 0) {
    system.charges = {
      value: current,
      max,
      ...(result.rechargeable || profile.rechargeable ? {
        mode: "charges",
        recharge: "rechargeable",
        rechargeable: true,
        rechargeFormula: result.rechargeFormula || profile.rechargeFormula || "1d6"
      } : {})
    };
  }

  itemData.flags ??= {};
  itemData.flags.add2e ??= {};
  Object.assign(itemData.flags.add2e, {
    magicItemProfile: profileKey,
    magicItemBuilderVersion: ADD2E_MAGIC_ITEM_BUILDER_VERSION,
    kind: profile.sousType ?? profileKey,
    category: "objet_magique",
    ...(baseItem ? {
      baseItemUuid: baseItem.uuid,
      baseItemName: baseItem.name,
      baseItemType: baseItem.type
    } : {})
  });
  itemData.flags.add2e.magicItemBuilder = {
    version: ADD2E_MAGIC_ITEM_BUILDER_VERSION,
    generatedTags: application === "porteur"
      ? [
          result.bonusToucher ? `bonus_attaque:${add2eMagicBuilderSigned(result.bonusToucher)}` : "",
          result.bonusDegats ? `bonus_degats:${add2eMagicBuilderSigned(result.bonusDegats)}` : ""
        ].filter(Boolean)
      : []
  };
}

async function add2eMagicBuilderCreateMagicItem(directory = null) {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.wait) return ui.notifications.error("DialogV2 est introuvable.");

  const bases = await add2eMagicBuilderCollectCreatorBases();
  const weaponOptions = add2eMagicBuilderCreatorBaseOptions(bases.arme);
  const armorOptions = add2eMagicBuilderCreatorBaseOptions(bases.armure);
  const profileOptions = Object.entries(ADD2E_MAGIC_CREATOR_PROFILES)
    .map(([key, profile]) => `<option value="${key}">${add2eMagicBuilderEscape(profile.label)}</option>`)
    .join("");

  const result = await add2eMagicBuilderWaitCreatorDialog(DialogV2, {
    window: { title: "Créer un objet magique" },
    modal: true,
    rejectClose: false,
    content: `<form class="add2e-dialog add2e-magic-item-create-form" style="min-width:560px;padding:8px;display:grid;gap:8px;">
      <div class="form-group"><label>Type</label><select name="profile">${profileOptions}</select></div>
      <div class="form-group" data-add2e-base-group="arme" hidden><label>Arme de base</label><select name="weaponBaseUuid"><option value="">— Choisir une arme —</option>${weaponOptions}</select></div>
      <div class="form-group" data-add2e-base-group="armure" hidden><label>Armure de base</label><select name="armorBaseUuid"><option value="">— Choisir une armure —</option>${armorOptions}</select></div>
      <div class="form-group"><label>Nom</label><input name="name" type="text" value="Objet magique"></div>
      <div class="form-group"><label>Nom non identifié</label><input name="unidentifiedName" type="text" value="Objet inconnu"></div>
      <div class="form-group" style="display:flex;gap:18px;"><label><input name="identified" type="checkbox"> Identifié</label><label><input name="cursed" type="checkbox"> Maudit</label></div>
      <div data-add2e-application-group>
        <div class="form-group" data-add2e-application-mode-group><label>Application des bonus de toucher/dégâts</label><select name="application"><option value="source">Cette arme uniquement</option><option value="porteur">Toutes les attaques du porteur</option></select></div>
        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;">
          <div class="form-group"><label>Bonus au toucher</label><input name="bonusToucher" type="number" step="1" value="0"></div>
          <div class="form-group"><label>Bonus aux dégâts</label><input name="bonusDegats" type="number" step="1" value="0"></div>
          <div class="form-group"><label>Bonus de CA</label><input name="bonusCA" type="number" step="1" value="0"></div>
          <div class="form-group"><label>CA fixe</label><input name="caFixe" type="number" step="1" value=""></div>
        </div>
      </div>
      <div data-add2e-charges-group style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;">
        <div class="form-group"><label>Charges actuelles</label><input name="chargesValue" data-profile="objet" type="number" min="0" step="1" value="0"></div>
        <div class="form-group"><label>Charges maximales</label><input name="chargesMax" data-profile="objet" type="number" min="0" step="1" value="0"></div>
      </div>
      <div class="form-group" data-add2e-recharge-group style="display:flex;align-items:center;gap:12px;"><label><input name="rechargeable" type="checkbox"> Rechargeable</label><label style="flex:1;">Formule <input name="rechargeFormula" type="text" value="1d6"></label></div>
      <p style="margin:0;font-size:.85em;opacity:.8;">Arme et Armure exigent une base issue d'un compendium. Objet crée un objet magique générique. Les autres types conservent leur fonctionnement spécialisé.</p>
    </form>`,
    buttons: [
      {
        action: "create",
        label: "Créer l'objet magique",
        icon: "fa-solid fa-wand-magic-sparkles",
        default: true,
        callback: (_event, button, dialog) => add2eMagicBuilderCreatorReadForm(button, dialog)
      },
      { action: "cancel", label: "Annuler", icon: "fa-solid fa-xmark", callback: () => null }
    ]
  });

  if (!result || typeof result !== "object") return null;
  const profileKey = String(result.profile ?? "").trim();
  const profile = ADD2E_MAGIC_CREATOR_PROFILES[profileKey];
  if (!profile) return ui.notifications.error("Le type d'objet magique sélectionné est invalide.");

  let baseItem = null;
  if (profile.baseType) {
    if (!result.baseUuid) {
      ui.notifications.warn(`Choisissez une ${profile.baseType} de base dans la liste.`);
      return null;
    }
    baseItem = await add2eMagicBuilderResolveItem(result.baseUuid);
    if (!baseItem || add2eMagicBuilderType(baseItem) !== profile.baseType || !String(baseItem.uuid ?? "").startsWith("Compendium.")) {
      ui.notifications.error(`La base sélectionnée doit être une ${profile.baseType} provenant d'un compendium.`);
      return null;
    }
  }

  const requestedName = String(result.name ?? "").trim();
  const name = (!requestedName || requestedName === "Objet magique")
    ? (baseItem ? `${baseItem.name} magique` : profile.label)
    : requestedName;
  const folder = directory?.currentFolder?.id ?? directory?.folder?.id ?? null;

  let itemData;
  if (profile.spellbookOwnerList) {
    itemData = add2eMagicBuilderCreatorSpellbookData(profile, name);
  } else if (baseItem) {
    itemData = add2eMagicBuilderCreatorSanitizeBase(baseItem, profile, name);
    add2eMagicBuilderCreatorEnchantSystem(itemData, profileKey, profile, result, baseItem);
  } else {
    itemData = {
      name,
      type: profile.itemType,
      img: profile.img,
      system: {
        nom: name,
        type: profile.itemType,
        categorie: "objet_magique",
        sousType: profile.sousType ?? "objet_magique",
        sous_type: profile.sousType ?? "objet_magique",
        quantite: 1,
        poids: 0,
        equipee: false,
        magique: true,
        consommable: profile.consumable === true,
        description: "",
        tags: [...(profile.tags ?? [])],
        effectTags: [...(profile.tags ?? [])],
        pouvoirs: []
      },
      effects: [],
      flags: { add2e: {} }
    };
    add2eMagicBuilderCreatorEnchantSystem(itemData, profileKey, profile, result, null);
    if (profileKey === "parchemin") {
      itemData.system.arcaneDocument = { schema: 1, kind: "spell-scroll", personal: false, spells: [] };
      itemData.flags.add2e.arcaneDocumentKind = "spell-scroll";
    }
  }

  if (folder) itemData.folder = folder;
  const ItemClass = CONFIG?.Item?.documentClass ?? globalThis.Item;
  const created = await ItemClass.create(itemData, { renderSheet: true });
  ui.notifications.info(`${created?.name ?? name} a été créé.`);
  return created;
}

function add2eMagicBuilderInstallDirectoryCreator(app, html) {
  queueMicrotask(() => {
    const root = html instanceof HTMLElement
      ? html
      : html?.[0] instanceof HTMLElement
        ? html[0]
        : app?.element;
    const current = root?.querySelector?.(".add2e-create-magic-item");
    if (!current || current.dataset.add2eUnifiedCreator === "true") return;

    const button = current.cloneNode(true);
    button.dataset.add2eUnifiedCreator = "true";
    button.title = "Créer un objet, une arme ou une armure magique";
    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      add2eMagicBuilderCreateMagicItem(app).catch(error => {
        console.error("[ADD2E][OBJET_MAGIQUE][CREATE_ERROR]", error);
        ui.notifications.error(error?.message || "Erreur pendant la création de l'objet magique.");
      });
    });
    current.replaceWith(button);
  });
}

Hooks.on("renderItemDirectory", add2eMagicBuilderInstallDirectoryCreator);
Hooks.on("renderSidebarTab", (app, html) => {
  const id = String(app?.options?.id ?? app?.id ?? app?.constructor?.name ?? "").toLowerCase();
  if (id.includes("item")) add2eMagicBuilderInstallDirectoryCreator(app, html);
});

Hooks.once("ready", () => {
  globalThis.add2eCreateMagicItem = add2eMagicBuilderCreateMagicItem;
});
