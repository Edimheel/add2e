// ADD2E — Objets magiques : enchantements et objets de base.
// Compatible Foundry V13/V14/V15 — DialogV2.
// Version : 2026-08-04-canonical-enchantment-metadata-v2

import {
  ADD2E_MAGIC_ITEM_BUILDER_VERSION,
  ADD2E_MAGIC_ITEM_TYPES,
  add2eMagicClone,
  add2eMagicGetProperty,
  add2eMagicMergeUniqueValues,
  add2eMagicNumber,
  add2eMagicOptionalNumber,
  add2eMagicSetProperty,
  add2eObjectMagicEscapeHtml,
  add2eObjectMagicNormalizeTag,
  add2eObjectMagicToArray
} from "./core.mjs";

const ADD2E_MAGIC_BASE_WEIGHT_INDEX_VERSION = "2026-08-02-canonical-base-weight-index-v1";
const ADD2E_MAGIC_BASE_WEIGHT_PACKS = Object.freeze([
  "add2e.armes",
  "add2e.armures",
  "add2e.equipements"
]);
const ADD2E_MAGIC_BASE_WEIGHT_FIELDS = Object.freeze([
  "name", "type", "img",
  "system.poids", "system.weight", "system.encombrement", "system.encumbrance",
  "system.poids_unite", "system.weightUnit", "system.weight_unit",
  "system.poids_encombrement_po", "system.encumbrance_gp", "system.encumbranceGoldPieces",
  "system.degats", "system.dégâts", "system.facteur_vitesse", "system.facteur_rapidité",
  "system.taille", "system.type_degats", "system.famille_arme", "system.type_arme",
  "system.categorie", "system.bouclier"
]);
const ADD2E_MAGIC_BASE_NAME_ALIASES = Object.freeze({
  armure_de_cuir: "cuir",
  armure_de_plates: "armure_de_plaques",
  plate_feuilletee: "armure_feuilletee",
  hache_darmes: "hache_darme",
  etoile_du_matin: "morgenstern"
});
const ADD2E_MAGIC_ARMOR_TYPE_ALIASES = Object.freeze({
  cotte_de_mailles: "mailles",
  plate_feuilletee: "feuilletee",
  bouclier_grand: "bouclier"
});
const ADD2E_MAGIC_WEAPON_FAMILY_ALIASES = Object.freeze({
  epee_large: ["epee"],
  morgenstern: ["masse"],
  epieu: ["lance"],
  fleche: ["fleche"]
});

let hooksInstalled = false;
let baseWeightIndexPromise = null;
let baseWeightIndex = {
  ready: false,
  entries: [],
  byUuid: new Map(),
  byName: new Map()
};

export function add2eMagicBuilderType(item) {
  return String(item?.type ?? "").trim().toLowerCase();
}

function add2eMagicBuilderIsArmor(itemOrType) {
  const type = typeof itemOrType === "string" ? itemOrType : add2eMagicBuilderType(itemOrType);
  return type === "armure";
}

function add2eMagicBuilderForcedDeletion() {
  const ForcedDeletion = foundry?.data?.operators?.ForcedDeletion;
  if (typeof ForcedDeletion?.create !== "function") {
    throw new Error("[ADD2E][OBJET_MAGIQUE] foundry.data.operators.ForcedDeletion est requis par Foundry V13/V14/V15.");
  }
  return ForcedDeletion.create(null);
}

export function add2eMagicBuilderSupported(item) {
  return ADD2E_MAGIC_ITEM_TYPES.has(add2eMagicBuilderType(item));
}

export function add2eMagicBuilderDefaultApplication(itemOrType) {
  const type = typeof itemOrType === "string" ? itemOrType : add2eMagicBuilderType(itemOrType);
  return type === "arme" ? "source" : "porteur";
}

function add2eMagicBuilderBaseWeight(raw = {}) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  return {
    value: add2eMagicOptionalNumber(source.value ?? source.poids ?? source.weight),
    unit: String(source.unit ?? source.poids_unite ?? source.weightUnit ?? "").trim(),
    encumbranceGoldPieces: add2eMagicOptionalNumber(
      source.encumbranceGoldPieces
      ?? source.poids_encombrement_po
      ?? source.encumbrance_gp
    )
  };
}

export function add2eMagicBuilderEnchantment(item, systemOverride = null) {
  const system = systemOverride ?? item?.system ?? {};
  const raw = system.enchantement && typeof system.enchantement === "object" && !Array.isArray(system.enchantement)
    ? system.enchantement
    : {};
  const baseStats = raw.baseStats && typeof raw.baseStats === "object" ? raw.baseStats : {};
  const baseWeight = add2eMagicBuilderBaseWeight(raw.baseWeight ?? {
    value: raw.basePoids ?? raw.baseWeightValue,
    unit: raw.basePoidsUnite ?? raw.baseWeightUnit,
    encumbranceGoldPieces: raw.basePoidsEncombrementPo ?? raw.baseEncumbranceGoldPieces
  });
  return {
    schema: 3,
    baseUuid: String(raw.baseUuid ?? item?.flags?.add2e?.baseItemUuid ?? "").trim(),
    baseName: String(raw.baseName ?? item?.flags?.add2e?.baseItemName ?? "").trim(),
    baseType: String(raw.baseType ?? item?.flags?.add2e?.baseItemType ?? "").trim(),
    baseWeight,
    application: ["source", "porteur"].includes(String(raw.application ?? "").trim())
      ? String(raw.application).trim()
      : add2eMagicBuilderDefaultApplication(item),
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
  if (add2eMagicBuilderIsArmor(item)) {
    return {
      bonusToucher: 0,
      bonusDegats: 0,
      bonusCA: 0,
      caFixe: null
    };
  }
  return {
    bonusToucher: add2eMagicNumber(system.bonus_hit ?? system.bonus_toucher ?? system.hit_bonus ?? system.attack_bonus, 0),
    bonusDegats: add2eMagicNumber(system.bonus_dom ?? system.bonus_degats ?? system.damage_bonus ?? system.degats_bonus, 0),
    bonusCA: add2eMagicNumber(system.bonus_ac ?? system.bonus_ca ?? system.ac_bonus ?? system.ca_bonus, 0),
    caFixe: add2eMagicOptionalNumber(system.ca_fixe ?? system.caFixe ?? system.fixedCA ?? system.fixed_ac)
  };
}

export function add2eMagicBuilderReadBaseWeight(item) {
  const system = item?.system ?? {};
  return add2eMagicBuilderBaseWeight({
    value: system.poids ?? system.weight ?? system.encombrement ?? system.encumbrance,
    unit: system.poids_unite ?? system.weightUnit ?? system.weight_unit,
    encumbranceGoldPieces: system.poids_encombrement_po ?? system.encumbrance_gp ?? system.encumbranceGoldPieces
  });
}

function add2eMagicWeightSystem(document) {
  return document?.system && typeof document.system === "object" ? document.system : {};
}

function add2eMagicWeightNumber(value) {
  const number = add2eMagicOptionalNumber(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function add2eMagicWeightUnit(system, type) {
  const explicit = String(system.poids_unite ?? system.weightUnit ?? system.weight_unit ?? "").trim();
  if (explicit) return explicit;
  return ["arme", "armure"].includes(String(type ?? "").toLowerCase()) ? "lb" : "kg";
}

function add2eMagicWeightEntry(document, pack = null) {
  const system = add2eMagicWeightSystem(document);
  const type = String(document?.type ?? "").trim().toLowerCase();
  if (!ADD2E_MAGIC_ITEM_TYPES.has(type)) return null;
  const encumbranceGoldPieces = add2eMagicWeightNumber(
    system.poids_encombrement_po
    ?? system.encumbrance_gp
    ?? system.encumbranceGoldPieces
  );
  const value = add2eMagicWeightNumber(system.poids ?? system.weight ?? system.encombrement ?? system.encumbrance);
  if (encumbranceGoldPieces === null && value === null) return null;
  const uuid = String(
    document?.uuid
    ?? (pack?.collection && document?._id ? `Compendium.${pack.collection}.${document._id}` : "")
  ).trim();
  return {
    uuid,
    id: String(document?._id ?? document?.id ?? ""),
    name: String(document?.name ?? "").trim(),
    nameKey: add2eObjectMagicNormalizeTag(document?.name),
    type,
    value,
    unit: add2eMagicWeightUnit(system, type),
    encumbranceGoldPieces,
    system: add2eMagicClone(system)
  };
}

function add2eMagicWeightSignature(entry) {
  if (!entry) return "";
  if (Number.isFinite(entry.encumbranceGoldPieces) && entry.encumbranceGoldPieces > 0) {
    return `gp:${entry.encumbranceGoldPieces}`;
  }
  if (!Number.isFinite(entry.value) || entry.value <= 0) return "";
  return `${add2eObjectMagicNormalizeTag(entry.unit)}:${entry.value}`;
}

function add2eMagicWeightCommonCandidate(candidates = [], match = "") {
  const usable = candidates.filter(candidate => add2eMagicWeightSignature(candidate));
  const signatures = new Set(usable.map(add2eMagicWeightSignature));
  if (signatures.size !== 1 || !usable.length) return null;
  const selected = usable[0];
  return {
    value: selected.value,
    unit: selected.unit,
    encumbranceGoldPieces: selected.encumbranceGoldPieces,
    sourceUuid: selected.uuid,
    sourceName: selected.name,
    match,
    candidates: usable.map(candidate => ({ uuid: candidate.uuid, name: candidate.name }))
  };
}

function add2eMagicWeightNameKey(value) {
  const firstPart = String(value ?? "").split(",")[0];
  const tokens = add2eObjectMagicNormalizeTag(firstPart)
    .split("_")
    .filter(Boolean);
  if (tokens.length && /^\d+$/.test(tokens[0])) tokens.shift();
  return tokens.filter(token => !/^\d+$/.test(token)).join("_");
}

function add2eMagicWeightValues(value) {
  return new Set(
    add2eObjectMagicToArray(value)
      .map(add2eObjectMagicNormalizeTag)
      .filter(Boolean)
  );
}

function add2eMagicWeightDamage(system) {
  const damage = system.degats ?? system["dégâts"] ?? {};
  if (!damage || typeof damage !== "object") return ["", ""];
  return [
    String(damage.contre_moyen ?? "").replace(/\s+/g, ""),
    String(damage.contre_grand ?? "").replace(/\s+/g, "")
  ];
}

function add2eMagicWeightSpeed(system) {
  return add2eMagicWeightNumber(system.facteur_vitesse ?? system["facteur_rapidité"]);
}

function add2eMagicWeightSameText(actual, expected) {
  const wanted = add2eObjectMagicNormalizeTag(expected);
  if (!wanted) return true;
  return add2eObjectMagicNormalizeTag(actual) === wanted;
}

function add2eMagicWeightWeaponCandidates(item) {
  const system = item?.system ?? {};
  const damage = add2eMagicWeightDamage(system);
  const speed = add2eMagicWeightSpeed(system);
  const families = add2eMagicWeightValues(system.famille_arme);
  const expandedFamilies = new Set(families);
  for (const family of families) {
    for (const alias of ADD2E_MAGIC_WEAPON_FAMILY_ALIASES[family] ?? []) expandedFamilies.add(alias);
  }
  return baseWeightIndex.entries.filter(candidate => {
    if (candidate.type !== "arme") return false;
    const base = candidate.system ?? {};
    const baseDamage = add2eMagicWeightDamage(base);
    if (damage.some(Boolean) && (damage[0] !== baseDamage[0] || damage[1] !== baseDamage[1])) return false;
    if (speed !== null && add2eMagicWeightSpeed(base) !== speed) return false;
    if (!add2eMagicWeightSameText(base.taille, system.taille)) return false;
    if (!add2eMagicWeightSameText(base.type_degats, system.type_degats)) return false;
    if (!add2eMagicWeightSameText(base.categorie, system.categorie)) return false;
    if (expandedFamilies.size) {
      const baseFamilies = add2eMagicWeightValues([base.famille_arme, base.type_arme]);
      if (baseFamilies.size && ![...expandedFamilies].some(family => baseFamilies.has(family))) return false;
    }
    return true;
  });
}

function add2eMagicWeightArmorCandidates(item) {
  const system = item?.system ?? {};
  if (add2eObjectMagicNormalizeTag(item?.name).includes("elfique")) return [];
  const type = add2eObjectMagicNormalizeTag(system.type_armure);
  const expectedType = ADD2E_MAGIC_ARMOR_TYPE_ALIASES[type] ?? type;
  if (!expectedType) return [];
  return baseWeightIndex.entries.filter(candidate => {
    if (candidate.type !== "armure") return false;
    const base = candidate.system ?? {};
    const baseType = add2eObjectMagicNormalizeTag(base.type_armure);
    const canonicalBaseType = ADD2E_MAGIC_ARMOR_TYPE_ALIASES[baseType] ?? baseType;
    if (canonicalBaseType !== expectedType) return false;
    if (system.bouclier === true && base.bouclier !== true) return false;
    if (system.bouclier === false && base.bouclier === true) return false;
    return true;
  });
}

function add2eMagicWeightExplicitMetadata(item) {
  const enchantment = add2eMagicBuilderEnchantment(item);
  const baseWeight = enchantment.baseWeight ?? {};
  const encumbranceGoldPieces = add2eMagicWeightNumber(baseWeight.encumbranceGoldPieces);
  const value = add2eMagicWeightNumber(baseWeight.value);
  if (encumbranceGoldPieces === null && value === null) return null;
  return {
    value,
    unit: String(baseWeight.unit ?? "").trim() || (["arme", "armure"].includes(add2eMagicBuilderType(item)) ? "lb" : "kg"),
    encumbranceGoldPieces,
    sourceUuid: enchantment.baseUuid || null,
    sourceName: enchantment.baseName || null,
    match: "enchantment-base-weight",
    candidates: []
  };
}

export function add2eMagicBuilderResolveBaseWeight(item) {
  if (!item || !add2eMagicBuilderSupported(item)) return null;
  const metadata = add2eMagicWeightExplicitMetadata(item);
  if (metadata) return metadata;
  if (!baseWeightIndex.ready) return null;

  const type = add2eMagicBuilderType(item);
  const enchantment = add2eMagicBuilderEnchantment(item);
  const baseUuid = String(enchantment.baseUuid ?? "").trim();
  if (baseUuid && baseWeightIndex.byUuid.has(baseUuid)) {
    return add2eMagicWeightCommonCandidate([baseWeightIndex.byUuid.get(baseUuid)], "base-uuid");
  }

  const exactNames = [
    add2eObjectMagicNormalizeTag(enchantment.baseName),
    add2eMagicWeightNameKey(item.name)
  ].filter(Boolean);
  const cleanedName = exactNames.at(-1) ?? "";
  const aliasName = ADD2E_MAGIC_BASE_NAME_ALIASES[cleanedName] ?? "";
  if (aliasName) exactNames.push(aliasName);
  for (const nameKey of new Set(exactNames)) {
    const candidates = baseWeightIndex.byName.get(`${type}:${nameKey}`) ?? [];
    const result = add2eMagicWeightCommonCandidate(candidates, nameKey === aliasName ? "name-alias" : "exact-name");
    if (result) return result;
  }

  if (type === "arme") {
    return add2eMagicWeightCommonCandidate(add2eMagicWeightWeaponCandidates(item), "weapon-fingerprint");
  }
  if (type === "armure") {
    return add2eMagicWeightCommonCandidate(add2eMagicWeightArmorCandidates(item), "armor-type");
  }
  return null;
}

function add2eMagicBuilderPrimaryGm() {
  if (!game.user?.isGM) return false;
  const active = Array.from(game.users ?? [])
    .filter(user => user?.active && user?.isGM)
    .sort((left, right) => String(left.id ?? "").localeCompare(String(right.id ?? "")));
  return !active.length || active[0]?.id === game.user.id;
}

async function add2eMagicBuilderRecalculateActorWeights() {
  if (!add2eMagicBuilderPrimaryGm()) return;
  const recalculate = globalThis.add2eRecalcMoveXp;
  if (typeof recalculate !== "function") return;
  for (const actor of Array.from(game.actors ?? []).filter(entry => entry?.type === "personnage")) {
    try { await recalculate(actor, { mode: "movement" }); }
    catch (error) {
      console.warn("[ADD2E][OBJET_MAGIQUE][BASE_WEIGHT][RECALC_ERROR]", { actor: actor.name, error });
    }
  }
}

export async function add2eMagicBuilderLoadBaseWeightIndex() {
  if (baseWeightIndex.ready) return baseWeightIndex;
  if (baseWeightIndexPromise) return baseWeightIndexPromise;
  baseWeightIndexPromise = (async () => {
    const entries = [];
    for (const collection of ADD2E_MAGIC_BASE_WEIGHT_PACKS) {
      const pack = game.packs?.get?.(collection);
      if (!pack || String(pack.documentName ?? pack.metadata?.type ?? "") !== "Item") continue;
      let index = null;
      try { index = await pack.getIndex({ fields: [...ADD2E_MAGIC_BASE_WEIGHT_FIELDS] }); }
      catch (error) {
        console.warn("[ADD2E][OBJET_MAGIQUE][BASE_WEIGHT][PACK_ERROR]", { collection, error });
        continue;
      }
      for (const document of index ?? []) {
        const entry = add2eMagicWeightEntry(document, pack);
        if (entry) entries.push(entry);
      }
    }
    const byUuid = new Map();
    const byName = new Map();
    for (const entry of entries) {
      if (entry.uuid) byUuid.set(entry.uuid, entry);
      const key = `${entry.type}:${entry.nameKey}`;
      const values = byName.get(key) ?? [];
      values.push(entry);
      byName.set(key, values);
    }
    baseWeightIndex = { ready: true, entries, byUuid, byName };
    globalThis.ADD2E_MAGIC_BASE_WEIGHT_INDEX_VERSION = ADD2E_MAGIC_BASE_WEIGHT_INDEX_VERSION;
    console.log("[ADD2E][OBJET_MAGIQUE][BASE_WEIGHT][READY]", {
      version: ADD2E_MAGIC_BASE_WEIGHT_INDEX_VERSION,
      entries: entries.length,
      packs: ADD2E_MAGIC_BASE_WEIGHT_PACKS
    });
    await add2eMagicBuilderRecalculateActorWeights();
    return baseWeightIndex;
  })().finally(() => {
    baseWeightIndexPromise = null;
  });
  return baseWeightIndexPromise;
}

function add2eMagicBuilderCopyPaths(sourceSystem, targetUpdate, paths) {
  for (const path of paths) {
    const value = add2eMagicGetProperty(sourceSystem, path);
    if (value === undefined) continue;
    add2eMagicSetProperty(targetUpdate, `system.${path}`, add2eMagicClone(value));
  }
}

function add2eMagicBuilderBasePaths(type) {
  const weightPaths = [
    "poids", "weight", "encombrement", "encumbrance",
    "poids_unite", "weightUnit", "weight_unit",
    "poids_encombrement_po", "encumbrance_gp", "encumbranceGoldPieces"
  ];
  if (type === "arme") {
    return [
      "type", "categorie", "famille", "famille_arme", "facteur_rapidité", "facteur_rapidite",
      "type_degats", "degats", "dégâts", "ajustement_ca", "portee_courte", "portee_moyenne",
      "portee_longue", ...weightPaths, "deuxMains", "arme_de_jet", "encombrante", "proprietes",
      "properties", "tags", "effectTags"
    ];
  }
  if (type === "armure") {
    return [
      "ac", "categorie", ...weightPaths,
      "prix", "materiau", "type_armure", "structure", "bouclier", "type_bouclier", "tags"
    ];
  }
  return [
    "categorie", "sousType", "sous_type", "quantite", ...weightPaths, "prix", "activation", "cible",
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
  const currentEffectTags = add2eObjectMagicToArray(targetItem.system?.effectTags ?? targetItem.system?.effets ?? targetItem.system?.effects);
  const update = {};
  add2eMagicBuilderCopyPaths(baseItem.system ?? {}, update, add2eMagicBuilderBasePaths(targetType));
  add2eMagicSetProperty(update, "system.tags", add2eMagicMergeUniqueValues(add2eMagicGetProperty(update, "system.tags"), currentTags));
  add2eMagicSetProperty(update, "system.effectTags", add2eMagicMergeUniqueValues(add2eMagicGetProperty(update, "system.effectTags"), currentEffectTags));
  const currentEnchantement = add2eMagicBuilderEnchantment(targetItem);
  const nextEnchantement = {
    ...currentEnchantement,
    schema: 3,
    baseUuid: String(baseItem.uuid ?? ""),
    baseName: String(baseItem.name ?? "Base"),
    baseType,
    baseWeight: add2eMagicBuilderReadBaseWeight(baseItem),
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
  enchantement.baseWeight = { value: null, unit: "", encumbranceGoldPieces: null };
  await item.update({
    "system.enchantement": enchantement,
    "flags.add2e.baseItemUuid": add2eMagicBuilderForcedDeletion(),
    "flags.add2e.baseItemName": add2eMagicBuilderForcedDeletion(),
    "flags.add2e.baseItemType": add2eMagicBuilderForcedDeletion()
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
  Hooks.once("ready", () => {
    add2eMagicBuilderLoadBaseWeightIndex().catch(error => {
      console.error("[ADD2E][OBJET_MAGIQUE][BASE_WEIGHT][ERROR]", error);
    });
  });
}

globalThis.add2eResolveMagicItemBaseWeight = add2eMagicBuilderResolveBaseWeight;
globalThis.add2eLoadMagicItemBaseWeightIndex = add2eMagicBuilderLoadBaseWeightIndex;
globalThis.ADD2E_MAGIC_BASE_WEIGHT_INDEX_VERSION = ADD2E_MAGIC_BASE_WEIGHT_INDEX_VERSION;
