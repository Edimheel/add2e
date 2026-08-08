// ADD2E — Moteur commun des boutiques, catalogue compendium et projectiles.
// Les boutiques référencent les compendiums et ne recopient plus leur catalogue dans les Actors.
// Compatible Foundry V13/V14/V15.

export const ADD2E_SHOP_ENGINE_VERSION = "2026-08-08-shop-catalog-v1";
export const ADD2E_VENDOR_VERSION = "2026-08-08-vendor-v31-canonical-shop-api";
export const VENDOR_SCOPE = "add2e";
export const VENDOR_NAME = "Marchand de composants et projectiles";
export const VENDOR_FOLDER = "ADD2E — Boutique";
export const VENDOR_SETTING = "vendorCreationVersion";
export const TOKEN_IMG = "systems/add2e/assets/ui/boutique.webp";
export const PROJECTILE_FLAG = "projectilesDepensesCombat";
export const SOCKET_RECOVERY = "ADD2E_PROJECTILE_RECOVERY_RESULT";
export const SHOP_BUY_RESULT = "ADD2E_SHOP_BUY_RESULT";
export const RECOVERY_RATE = 0.6;
export const GM_OPERATION_TYPE = "ADD2E_GM_OPERATION";
export const GM_OPERATION_PROJECTILE_SPENT = "vendorRecordProjectileSpent";
export const GM_OPERATION_SHOP_BUY = "shopBuy";

const SHOP_STOCK_FLAG = "shopStock";
const SHOP_TYPE_FLAG = "shopType";
const SHOP_MIGRATION_FLAG = "shopCatalogMigrationVersion";
const SHOP_DEFINITIONS = new Map();
const SHOP_CATALOG_CACHE = new Map();
const PROJECTILE_SPENT_REQUESTS = new Set();

export const COINS = [
  { key: "pp", label: "PP", pc: 500 },
  { key: "po", label: "PO", pc: 100 },
  { key: "pe", label: "PE", pc: 50 },
  { key: "pa", label: "PA", pc: 10 },
  { key: "pc", label: "PC", pc: 1 }
];

export const num = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
export const lower = value => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
export const slug = value => lower(value).replace(/[’']/g, "_").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

export function esc(value) {
  const div = document.createElement("div");
  div.textContent = String(value ?? "");
  return div.innerHTML;
}

const asArray = value => Array.isArray(value)
  ? value.flatMap(asArray)
  : value === null || value === undefined || value === ""
    ? []
    : typeof value === "string"
      ? value.split(/[,;|\n]/g).map(entry => entry.trim()).filter(Boolean)
      : [value];

function clone(value) {
  if (value === undefined || value === null) return value;
  if (typeof foundry?.utils?.deepClone === "function") return foundry.utils.deepClone(value);
  if (typeof foundry?.utils?.duplicate === "function") return foundry.utils.duplicate(value);
  return JSON.parse(JSON.stringify(value));
}

function collectionRows(collection) {
  if (!collection) return [];
  if (Array.isArray(collection)) return collection;
  if (Array.isArray(collection.contents)) return collection.contents;
  if (typeof collection.values === "function") return [...collection.values()];
  return [...collection];
}

export function tags(item) {
  const system = item?.system ?? {};
  const flags = item?.flags?.add2e ?? {};
  return [
    ...asArray(system.tags),
    ...asArray(system.effectTags),
    ...asArray(system.effecttags),
    ...asArray(flags.tags),
    ...asArray(flags.effectTags),
    ...asArray(flags.effecttags)
  ].map(lower).filter(Boolean);
}

export const quantity = item => Math.max(0, Math.floor(num(item?.system?.quantite ?? item?.system?.quantity ?? 0, 0)));
export const quantityUpdate = value => ({ "system.quantite": Math.max(0, Math.floor(num(value, 0))) });

export function isAmmunition(item) {
  const system = item?.system ?? {};
  const name = lower(item?.name);
  const fields = [system.categorie, system.category, system.sousType, system.sous_type, system.type, system.subtype, system.kind, system.slot].map(lower).filter(Boolean);
  const itemTags = tags(item);
  const accepted = new Set([
    "munition", "munitions", "projectile", "projectiles", "ammo", "ammunition",
    "trait:munition", "trait:projectile", "categorie:munition", "categorie:projectile",
    "type:munition", "type:projectile", "type_arme:munition"
  ]);
  if (/\b(carquois|quiver|etui|etuis|étui|étuis|sac|sacoche|container|contenant|boite|boîte|bourse)\b/.test(name)) return false;
  if (fields.some(value => ["carquois", "quiver", "contenant", "container", "sac", "sacoche"].includes(value))) return false;
  if (itemTags.some(value => ["carquois", "quiver", "contenant", "container", "sac", "sacoche"].includes(value))) return false;
  if (fields.some(value => accepted.has(value))) return true;
  if (itemTags.some(value => accepted.has(value) || value.startsWith("munition:") || value.startsWith("projectile:"))) return true;
  return /\b(fleche|fleches|flèche|flèches|carreau|carreaux|trait|traits|bille|billes|aiguille|aiguilles|pierre de fronde|pierres de fronde|balle d[’']arquebuse|balles d[’']arquebuse)\b/.test(name);
}

export function isComponent(item) {
  const system = item?.system ?? {};
  if (lower(system.categorie ?? system.category) === "composant_sort") return true;
  if (lower(system.sousType ?? system.sous_type ?? system.type) === "composant") return true;
  return tags(item).some(tag => tag === "composant_sort" || tag.startsWith("composant:"));
}

export function isMagic(item) {
  const system = item?.system ?? {};
  const name = lower(item?.name);
  const category = lower(system.categorie ?? system.category ?? system.sousType ?? system.sous_type ?? "");
  if (item?.getFlag?.(VENDOR_SCOPE, "vendorMagic") === true || item?.getFlag?.(VENDOR_SCOPE, "magicItem") === true) return true;
  if (item?.flags?.add2e?.vendorMagic === true || item?.flags?.add2e?.magicItem === true) return true;
  if (system.magique === true || system.magic === true || system.isMagic === true) return true;
  if (category.includes("magique") || category.includes("magic")) return true;
  if (tags(item).some(tag => /magique|magic|objet_magique|magic_item/.test(tag))) return true;
  if (/\+\d/.test(name)) return true;
  return /anneau|bracelet|baguette|baton|bâton|potion|parchemin|amulette|cape|ceinture|gantelet|heaume|botte|bottes|collier|robe magique/.test(name);
}

export const isEquipment = item => item?.type === "objet" && !isMagic(item) && !isComponent(item);

export function vendorKind(item) {
  const explicit = item?._shop?.kind ?? item?.getFlag?.(VENDOR_SCOPE, "vendorKind") ?? item?.flags?.add2e?.vendorKind;
  if (explicit === "component") return "Composant";
  if (explicit === "projectile") return "Projectile";
  if (explicit === "equipment") return "Equipement";
  if (isComponent(item)) return "Composant";
  if (isAmmunition(item)) return "Projectile";
  return "Equipement";
}

export function isStockItem(item) {
  if (!item || isMagic(item)) return false;
  if (item?._shop?.shopType === "general") return true;
  if (item.type === "objet" && isComponent(item)) return true;
  if (isAmmunition(item)) return true;
  return item.type === "objet" && (item.getFlag?.(VENDOR_SCOPE, "vendorKind") === "equipment" || item?.flags?.add2e?.vendorKind === "equipment");
}

export const defaultStock = item => isAmmunition(item) ? 40 : isComponent(item) ? 20 : 10;

export function moneyFrom(raw = {}) {
  const money = { pc: 0, pa: 0, pe: 0, po: 0, pp: 0 };
  for (const coin of COINS) money[coin.key] = Math.max(0, Math.floor(num(raw?.[coin.key], 0)));
  return money;
}

export function getMoney(actor) {
  const flagged = actor?.getFlag?.(VENDOR_SCOPE, "monnaie");
  if (flagged && typeof flagged === "object") return moneyFrom(flagged);
  const system = actor?.system?.monnaie ?? actor?.system?.argent ?? actor?.system?.currency;
  return system && typeof system === "object" ? moneyFrom(system) : moneyFrom({});
}

export async function setMoney(actor, money) {
  if (!actor?.setFlag) return false;
  await actor.setFlag(VENDOR_SCOPE, "monnaie", moneyFrom(money));
  return true;
}

export function toCopper(money) {
  const normalized = moneyFrom(money);
  return COINS.reduce((sum, coin) => sum + normalized[coin.key] * coin.pc, 0);
}

export function fromCopper(total) {
  let remaining = Math.max(0, Math.floor(num(total, 0)));
  const money = { pc: 0, pa: 0, pe: 0, po: 0, pp: 0 };
  for (const coin of COINS) {
    money[coin.key] = Math.floor(remaining / coin.pc);
    remaining %= coin.pc;
  }
  return money;
}

export function formatMoney(value) {
  const money = typeof value === "number" ? fromCopper(value) : moneyFrom(value);
  const parts = COINS.map(coin => money[coin.key] ? `${money[coin.key]} ${coin.label}` : "").filter(Boolean);
  return parts.length ? parts.join(" ") : "0 PC";
}

export function priceCopper(item) {
  const system = item?.system ?? {};
  const raw = system.prix ?? system.price ?? system.cout ?? system.coût ?? system.cost ?? item?.getFlag?.(VENDOR_SCOPE, "prix") ?? item?.flags?.add2e?.prix ?? null;
  let value = 0;
  let currency = system.devise ?? system.currency ?? item?.getFlag?.(VENDOR_SCOPE, "devise") ?? item?.flags?.add2e?.devise ?? "po";
  if (typeof raw === "number") value = raw;
  else if (typeof raw === "string") {
    const match = raw.match(/([0-9]+(?:[\.,][0-9]+)?)\s*(pp|po|pe|pa|pc)?/i);
    if (match) {
      value = Number(String(match[1]).replace(",", "."));
      if (match[2]) currency = match[2].toLowerCase();
    }
  } else if (raw && typeof raw === "object") {
    value = raw.valeur ?? raw.value ?? raw.montant ?? raw.amount ?? 0;
    currency = raw.devise ?? raw.currency ?? currency;
  }
  if (!Number.isFinite(Number(value)) || Number(value) <= 0) {
    value = 1;
    currency = isAmmunition(item) ? "pa" : "po";
  }
  const coin = COINS.find(entry => entry.key === lower(currency)) ?? COINS.find(entry => entry.key === "po");
  return Math.max(1, Math.round(Number(value) * coin.pc));
}

export async function dialog({ title = "Boutique", content = "", yes = "Compris", no = "Fermer", theme = "parchment" } = {}) {
  if (typeof globalThis.add2eDialogConfirm !== "function") throw new Error("L’API de fenêtre ADD2E est indisponible.");
  return globalThis.add2eDialogConfirm({
    add2eTheme: theme,
    add2ePrimaryAction: "yes",
    add2eClasses: ["add2e-shop-dialog"],
    window: { title },
    content,
    yes: { label: yes },
    no: { label: no },
    modal: true
  });
}

export const alertBox = (title, message) => dialog({
  title,
  content: `<div class="add2e-dialog add2e-shop-alert"><h3>${esc(title)}</h3><p>${esc(message)}</p></div>`
});

// ---------------------------------------------------------------------------
// Moteur commun SHOP
// ---------------------------------------------------------------------------

const DEFAULT_INDEX_FIELDS = [
  "name", "type", "img",
  "system.prix", "system.price", "system.cout", "system.coût", "system.cost", "system.devise", "system.currency",
  "system.quantite", "system.quantity", "system.categorie", "system.category", "system.sousType", "system.sous_type", "system.subtype", "system.kind", "system.slot",
  "system.tags", "system.effectTags", "system.effecttags", "system.type_arme", "system.famille_arme", "system.type_armure", "system.type_bouclier", "system.structure", "system.taille",
  "system.sorts_associes", "system.sortsAssocies", "system.spells", "system.spellNames",
  "system.arme_de_jet", "system.armeDeJet", "system.isThrown", "system.arme_de_contact", "system.armeDeContact", "system.isMelee", "system.corps_a_corps",
  "system.utilise_munition", "system.utiliseMunition", "system.projectileConsomme", "system.carquois",
  "system.portee_courte", "system.portee_moyenne", "system.portee_longue", "system.porteeCourte", "system.porteeMoyenne", "system.porteeLongue",
  "flags.add2e.tags", "flags.add2e.effectTags", "flags.add2e.effecttags"
];

function normalizeShopDefinition(raw = {}) {
  const id = slug(raw.id);
  if (!id) throw new Error("Une définition de boutique ADD2E doit avoir un id.");
  if (!Array.isArray(raw.sources) || !raw.sources.length) throw new Error(`Boutique ${id} : aucune source de compendium.`);
  return {
    id,
    label: String(raw.label ?? id),
    actorName: String(raw.actorName ?? raw.label ?? id),
    folder: String(raw.folder ?? VENDOR_FOLDER),
    tokenImg: String(raw.tokenImg ?? TOKEN_IMG),
    setting: raw.setting ? String(raw.setting) : null,
    actorFlags: clone(raw.actorFlags ?? {}),
    defaultMoney: moneyFrom(raw.defaultMoney ?? { po: 500 }),
    pricing: { buyMultiplier: Math.max(0, num(raw.pricing?.buyMultiplier, 1)) || 1 },
    sources: raw.sources.map(source => ({
      id: slug(source.id ?? "source"),
      packs: [...new Set(asArray(source.packs).map(String).filter(Boolean))],
      discover: source.discover instanceof RegExp ? source.discover : null,
      exclude: source.exclude instanceof RegExp ? source.exclude : null,
      fields: [...new Set([...(source.fields ?? []), ...DEFAULT_INDEX_FIELDS])],
      accept: typeof source.accept === "function" ? source.accept : () => true,
      kind: typeof source.kind === "function" ? source.kind : () => String(source.kind ?? "item"),
      defaultStock: typeof source.defaultStock === "function" ? source.defaultStock : () => Math.max(0, Math.floor(num(source.defaultStock, 0)))
    })),
    legacyItemPredicate: typeof raw.legacyItemPredicate === "function" ? raw.legacyItemPredicate : () => false,
    legacyStockMaximum: typeof raw.legacyStockMaximum === "function" ? raw.legacyStockMaximum : item => quantity(item),
    catalogIdentity: typeof raw.catalogIdentity === "function" ? raw.catalogIdentity : (item, kind) => `${kind}:${slug(item?.name)}`
  };
}

export function registerShopDefinition(definition) {
  const normalized = normalizeShopDefinition(definition);
  SHOP_DEFINITIONS.set(normalized.id, normalized);
  SHOP_CATALOG_CACHE.delete(normalized.id);
  return normalized;
}

export function getShopType(actorOrType) {
  if (typeof actorOrType === "string") return slug(actorOrType);
  const flags = actorOrType?.flags?.add2e ?? {};
  const explicit = actorOrType?.getFlag?.(VENDOR_SCOPE, SHOP_TYPE_FLAG) ?? flags[SHOP_TYPE_FLAG];
  if (explicit) return slug(explicit);
  if (actorOrType?.getFlag?.(VENDOR_SCOPE, "isVendor") === true || flags.isVendor === true || actorOrType?.name === VENDOR_NAME) return "general";
  if (actorOrType?.getFlag?.(VENDOR_SCOPE, "isArmorer") === true || flags.isArmorer === true || lower(actorOrType?.name) === "armurier") return "armorer";
  return "";
}

export function getShopDefinition(actorOrType) {
  const type = getShopType(actorOrType);
  return type ? SHOP_DEFINITIONS.get(type) ?? null : null;
}

export function isShopActor(actor) {
  return !!getShopDefinition(actor);
}

function sourcePackIds(source) {
  const ids = [...source.packs];
  for (const [id, pack] of game.packs ?? []) {
    const text = `${id} ${pack?.metadata?.label ?? ""}`;
    if (source.discover && !source.discover.test(text)) continue;
    if (source.exclude && source.exclude.test(text)) continue;
    if (source.discover && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

function catalogBaseItem(pack, row, definition, source) {
  const documentId = String(row?._id ?? row?.id ?? "");
  if (!documentId) return null;
  const packId = String(pack.collection ?? pack.metadata?.id ?? "");
  if (!packId) return null;
  const system = clone(row?.system ?? {});
  const flags = clone(row?.flags ?? {});
  const preview = { name: row?.name, type: row?.type, img: row?.img, system, flags };
  if (!source.accept(preview)) return null;
  const kind = String(source.kind(preview) ?? "item");
  const key = `${packId}:${documentId}`;
  return {
    id: `catalog:${key}`,
    name: String(row?.name ?? "Article"),
    type: String(row?.type ?? "objet"),
    img: row?.img ?? "icons/svg/item-bag.svg",
    system,
    flags,
    _shop: {
      key,
      shopType: definition.id,
      sourceId: source.id,
      pack: packId,
      documentId,
      kind,
      identity: definition.catalogIdentity(preview, kind),
      defaultStock: Math.max(0, Math.floor(num(source.defaultStock(preview), 0)))
    }
  };
}

function catalogView(base, actor = null) {
  const system = clone(base.system ?? {});
  const flags = clone(base.flags ?? {});
  const stock = actor ? shopStockForEntry(actor, base) : { quantity: base._shop.defaultStock, maximum: base._shop.defaultStock };
  system.quantite = stock.quantity;
  const view = {
    id: base.id,
    name: base.name,
    type: base.type,
    img: base.img,
    system,
    flags,
    _shop: { ...base._shop, maximum: stock.maximum },
    getFlag(scope, key) { return this.flags?.[scope]?.[key]; },
    toObject() { return { name: this.name, type: this.type, img: this.img, system: clone(this.system), flags: clone(this.flags) }; }
  };
  return view;
}

async function loadShopCatalogBase(definition) {
  if (SHOP_CATALOG_CACHE.has(definition.id)) return SHOP_CATALOG_CACHE.get(definition.id);
  const promise = (async () => {
    const rows = [];
    const identities = new Set();
    for (const source of definition.sources) {
      for (const packId of sourcePackIds(source)) {
        const pack = game.packs?.get?.(packId);
        if (!pack) continue;
        let index;
        try {
          index = await pack.getIndex({ fields: source.fields });
        } catch (error) {
          console.warn("[ADD2E][SHOP][CATALOG][INDEX]", definition.id, packId, error);
          continue;
        }
        for (const row of collectionRows(index)) {
          const base = catalogBaseItem(pack, row, definition, source);
          if (!base) continue;
          if (identities.has(base._shop.identity)) continue;
          identities.add(base._shop.identity);
          rows.push(base);
        }
      }
    }
    return rows.sort((left, right) => String(left.name).localeCompare(String(right.name), "fr"));
  })();
  SHOP_CATALOG_CACHE.set(definition.id, promise);
  try {
    const result = await promise;
    SHOP_CATALOG_CACHE.set(definition.id, result);
    return result;
  } catch (error) {
    SHOP_CATALOG_CACHE.delete(definition.id);
    throw error;
  }
}

export function clearShopCatalogCache(type = null) {
  if (type) SHOP_CATALOG_CACHE.delete(slug(type));
  else SHOP_CATALOG_CACHE.clear();
}

function shopStockOverrides(actor) {
  const raw = actor?.getFlag?.(VENDOR_SCOPE, SHOP_STOCK_FLAG) ?? actor?.flags?.add2e?.[SHOP_STOCK_FLAG] ?? {};
  return raw && typeof raw === "object" && !Array.isArray(raw) ? clone(raw) : {};
}

function shopStockForEntry(actor, entry) {
  const defaultValue = Math.max(0, Math.floor(num(entry?._shop?.defaultStock, 0)));
  const state = shopStockOverrides(actor)?.[entry?._shop?.key] ?? null;
  return {
    quantity: Math.max(0, Math.floor(num(state?.quantity, defaultValue))),
    maximum: Math.max(0, Math.floor(num(state?.maximum, defaultValue)))
  };
}

async function writeShopStockOverride(actor, entry, quantityValue, { maximum = null } = {}) {
  if (!actor?.setFlag || !entry?._shop?.key) return false;
  const overrides = shopStockOverrides(actor);
  const defaultValue = Math.max(0, Math.floor(num(entry._shop.defaultStock, 0)));
  const quantityValueNormalized = Math.max(0, Math.floor(num(quantityValue, 0)));
  const existingMaximum = shopStockForEntry(actor, entry).maximum;
  const maximumValue = Math.max(0, Math.floor(num(maximum, existingMaximum)));
  if (quantityValueNormalized === defaultValue && maximumValue === defaultValue) delete overrides[entry._shop.key];
  else overrides[entry._shop.key] = { quantity: quantityValueNormalized, maximum: maximumValue };
  await actor.setFlag(VENDOR_SCOPE, SHOP_STOCK_FLAG, overrides);
  return true;
}

export async function getShopDisplayItems(actorOrType) {
  const definition = getShopDefinition(actorOrType);
  if (!definition) throw new Error(`Boutique ADD2E inconnue : ${getShopType(actorOrType) || "sans type"}.`);
  const actor = typeof actorOrType === "string" ? null : actorOrType;
  const base = await loadShopCatalogBase(definition);
  return base.map(entry => catalogView(entry, actor));
}

export async function findShopCatalogItem(shop, reference) {
  const items = await getShopDisplayItems(shop);
  if (!reference) return null;
  if (reference?._shop?.key) return items.find(item => item._shop.key === reference._shop.key) ?? null;
  const raw = String(reference);
  return items.find(item => item.id === raw || item._shop.key === raw) ?? null;
}

export async function resolveShopCatalogDocument(entry) {
  const packId = entry?._shop?.pack;
  const documentId = entry?._shop?.documentId;
  if (!packId || !documentId) return null;
  const pack = game.packs?.get?.(packId);
  if (!pack) return null;
  return pack.getDocument(documentId);
}

function legacyItemIdentity(definition, item) {
  const kind = item?.getFlag?.(VENDOR_SCOPE, "vendorKind")
    ?? item?.getFlag?.(VENDOR_SCOPE, "armorerKind")
    ?? (isAmmunition(item) ? "projectile" : item?.type === "arme" ? "weapon" : item?.type === "armure" ? "armor" : isComponent(item) ? "component" : "equipment");
  return definition.catalogIdentity(item, kind);
}

export async function migrateLegacyShopInventory(actor, type = null) {
  if (!game.user?.isGM || !actor) return { migrated: 0, unmatched: [] };
  const definition = getShopDefinition(type ?? actor);
  if (!definition) return { migrated: 0, unmatched: [] };
  const migrationVersion = `${ADD2E_SHOP_ENGINE_VERSION}:${definition.id}`;
  if (actor.getFlag?.(VENDOR_SCOPE, SHOP_MIGRATION_FLAG) === migrationVersion) return { migrated: 0, unmatched: [] };

  const catalog = await getShopDisplayItems(definition.id);
  const byIdentity = new Map(catalog.map(item => [item._shop.identity, item]));
  const legacyItems = Array.from(actor.items ?? []).filter(item => definition.legacyItemPredicate(item));
  const overrides = shopStockOverrides(actor);
  const deleteIds = [];
  const unmatched = [];

  for (const item of legacyItems) {
    const identity = legacyItemIdentity(definition, item);
    const target = byIdentity.get(identity) ?? null;
    if (!target) {
      unmatched.push({ id: item.id, name: item.name, identity });
      continue;
    }
    const current = quantity(item);
    const maximum = Math.max(current, Math.floor(num(definition.legacyStockMaximum(item), target._shop.defaultStock)));
    const defaultValue = target._shop.defaultStock;
    const previous = overrides[target._shop.key];
    const nextQuantity = previous ? Math.max(num(previous.quantity, 0), current) : current;
    const nextMaximum = previous ? Math.max(num(previous.maximum, 0), maximum) : maximum;
    if (nextQuantity !== defaultValue || nextMaximum !== defaultValue) overrides[target._shop.key] = { quantity: nextQuantity, maximum: nextMaximum };
    else delete overrides[target._shop.key];
    deleteIds.push(item.id);
  }

  if (unmatched.length) {
    console.error("[ADD2E][SHOP][MIGRATION][UNMATCHED]", { shop: actor.name, type: definition.id, unmatched });
    throw new Error(`${actor.name} : ${unmatched.length} article(s) de l’ancien stock ne correspondent à aucun document de compendium. Migration interrompue.`);
  }

  await actor.update({
    [`flags.${VENDOR_SCOPE}.${SHOP_TYPE_FLAG}`]: definition.id,
    [`flags.${VENDOR_SCOPE}.${SHOP_STOCK_FLAG}`]: overrides,
    [`flags.${VENDOR_SCOPE}.${SHOP_MIGRATION_FLAG}`]: migrationVersion
  }, { add2eReason: "shop-catalog-migration" });
  if (deleteIds.length) await actor.deleteEmbeddedDocuments("Item", deleteIds, { add2eReason: "shop-remove-legacy-catalog-clones" });
  return { migrated: deleteIds.length, unmatched: [] };
}

export async function ensureShopActor(actor, type = null) {
  const definition = getShopDefinition(type ?? actor);
  if (!actor || !definition) return [];
  if (game.user?.isGM) await migrateLegacyShopInventory(actor, definition.id);
  return getShopDisplayItems(actor);
}

async function ensureShopFolder(definition) {
  if (!game.user?.isGM) return null;
  return Array.from(game.folders ?? []).find(folder => folder.type === "Actor" && folder.name === definition.folder)
    ?? Folder.create({ name: definition.folder, type: "Actor", color: "#8d641b" }, { add2eReason: "shop-folder-create" });
}

export async function createShopActor(type, { force = false } = {}) {
  if (!game.user?.isGM) return null;
  const definition = getShopDefinition(type);
  if (!definition) throw new Error(`Définition de boutique introuvable : ${type}.`);
  const existing = Array.from(game.actors ?? []).find(actor => getShopType(actor) === definition.id || actor.name === definition.actorName) ?? null;
  if (existing && !force) {
    await migrateLegacyShopInventory(existing, definition.id);
    return existing;
  }
  const folder = await ensureShopFolder(definition);
  const flags = { add2e: { ...clone(definition.actorFlags), [SHOP_TYPE_FLAG]: definition.id, [SHOP_STOCK_FLAG]: {}, [SHOP_MIGRATION_FLAG]: `${ADD2E_SHOP_ENGINE_VERSION}:${definition.id}`, monnaie: definition.defaultMoney } };
  return Actor.create({
    name: definition.actorName,
    type: "personnage",
    folder: folder?.id ?? null,
    img: definition.tokenImg,
    ownership: { default: CONST?.DOCUMENT_OWNERSHIP_LEVELS?.OBSERVER ?? 2 },
    prototypeToken: { name: definition.actorName, actorLink: true, width: 2, height: 2, texture: { src: definition.tokenImg } },
    flags
  }, { renderSheet: false, add2eReason: "shop-create" });
}

function shopItemSourceKey(item) {
  return item?._shop?.key ?? item?.flags?.add2e?.shopSourceKey ?? item?.getFlag?.(VENDOR_SCOPE, "shopSourceKey") ?? null;
}

function ownedSemanticMatch(candidate, entry, sourceDocument) {
  if (shopItemSourceKey(candidate) === entry._shop.key) return true;
  const candidateType = String(candidate?.type ?? "").toLowerCase();
  const sourceType = entry._shop.kind === "projectile" ? "objet" : String(sourceDocument?.type ?? entry.type ?? "").toLowerCase();
  return slug(candidate?.name) === slug(entry.name) && (!candidateType || !sourceType || candidateType === sourceType || entry._shop.kind === "projectile");
}

function purchasedItemData(sourceDocument, entry, requestedQuantity) {
  const data = sourceDocument.toObject ? sourceDocument.toObject() : clone(sourceDocument);
  delete data._id;
  delete data.folder;
  delete data.sort;
  data.system = data.system ?? {};
  data.system.quantite = requestedQuantity;
  data.flags = data.flags ?? {};
  data.flags.add2e = data.flags.add2e ?? {};
  data.flags.add2e.purchasedFromShop = true;
  data.flags.add2e.shopType = entry._shop.shopType;
  data.flags.add2e.shopSourceKey = entry._shop.key;
  data.flags.add2e.shopSourcePack = entry._shop.pack;
  data.flags.add2e.shopSourceDocumentId = entry._shop.documentId;
  if (entry._shop.kind === "projectile") {
    data.type = "objet";
    data.system.categorie = "munition";
    data.system.type = "munition";
  }
  return data;
}

async function mergeOrCreatePurchasedItem(actor, sourceDocument, entry, requestedQuantity) {
  const existing = Array.from(actor?.items ?? []).find(candidate => ownedSemanticMatch(candidate, entry, sourceDocument)) ?? null;
  if (existing) {
    const update = quantityUpdate(quantity(existing) + requestedQuantity);
    update["flags.add2e.shopSourceKey"] = entry._shop.key;
    update["flags.add2e.shopSourcePack"] = entry._shop.pack;
    update["flags.add2e.shopSourceDocumentId"] = entry._shop.documentId;
    update["flags.add2e.shopType"] = entry._shop.shopType;
    return existing.update(update, { add2eReason: "shop-buy-merge" });
  }
  const created = await actor.createEmbeddedDocuments("Item", [purchasedItemData(sourceDocument, entry, requestedQuantity)], { add2eReason: "shop-buy-create" });
  return created?.[0] ?? null;
}

export function ownedShopQuantity(actor, entry) {
  if (!actor || !entry) return 0;
  return Array.from(actor.items ?? []).reduce((total, item) => {
    if (shopItemSourceKey(item) === entry?._shop?.key) return total + Math.max(1, quantity(item));
    if (!shopItemSourceKey(item) && slug(item?.name) === slug(entry?.name)) return total + Math.max(1, quantity(item));
    return total;
  }, 0);
}

export async function setShopStock(shop, entryOrReference, value) {
  const entry = await findShopCatalogItem(shop, entryOrReference);
  if (!game.user?.isGM || !shop || !entry) return false;
  return writeShopStockOverride(shop, entry, value);
}

export async function restockShop(shop) {
  if (!game.user?.isGM || !shop?.setFlag) return false;
  await shop.setFlag(VENDOR_SCOPE, SHOP_STOCK_FLAG, {});
  return true;
}

async function subtractMoney(actor, copper) {
  const total = toCopper(getMoney(actor));
  if (total < copper) return false;
  await setMoney(actor, fromCopper(total - copper));
  return true;
}

export async function shopBuyLocal({ shop, buyer, item, quantity: requestedQuantity }, { confirm = true } = {}) {
  if (!shop || !buyer || !item) return { ok: false, message: "Boutique, acheteur ou article introuvable." };
  const definition = getShopDefinition(shop);
  if (!definition) return { ok: false, message: "Type de boutique inconnu." };
  const entry = await findShopCatalogItem(shop, item);
  if (!entry) return { ok: false, message: "Article absent du catalogue de cette boutique." };
  const requested = Math.max(1, Math.floor(num(requestedQuantity, 1)));
  const available = quantity(entry);
  if (available < requested) return { ok: false, message: `${entry.name} : stock disponible ${available}.` };
  const unitPrice = Math.max(1, Math.round(priceCopper(entry) * definition.pricing.buyMultiplier));
  const total = unitPrice * requested;
  if (toCopper(getMoney(buyer)) < total) return { ok: false, message: `${buyer.name} n’a pas assez d’argent. Prix : ${formatMoney(total)}.` };
  if (confirm && !await dialog({ title: "Confirmer l’achat", content: `<p>Acheter <b>${requested} × ${esc(entry.name)}</b> pour <b>${formatMoney(total)}</b> ?</p>`, yes: "Acheter", no: "Annuler" })) return { ok: false, cancelled: true };

  const sourceDocument = await resolveShopCatalogDocument(entry);
  if (!sourceDocument) return { ok: false, message: `${entry.name} : document de compendium introuvable.` };
  const moneyBefore = getMoney(buyer);
  const stockBefore = available;
  if (!await subtractMoney(buyer, total)) return { ok: false, message: "Paiement impossible." };
  await writeShopStockOverride(shop, entry, stockBefore - requested);
  try {
    await mergeOrCreatePurchasedItem(buyer, sourceDocument, entry, requested);
  } catch (error) {
    await setMoney(buyer, moneyBefore);
    await writeShopStockOverride(shop, entry, stockBefore);
    throw error;
  }
  return { ok: true, message: `${buyer.name} achète ${requested} × ${entry.name} pour ${formatMoney(total)}.`, entry };
}

export async function assignShopItem({ shop, buyer, item, quantity: requestedQuantity = 1 } = {}) {
  if (!game.user?.isGM) return { ok: false, message: "Action réservée au MJ." };
  if (!shop || !buyer || !item) return { ok: false, message: "Boutique, acteur cible ou article introuvable." };
  const entry = await findShopCatalogItem(shop, item);
  if (!entry) return { ok: false, message: "Article absent du catalogue de cette boutique." };
  const requested = Math.max(1, Math.floor(num(requestedQuantity, 1)));
  const stockBefore = quantity(entry);
  if (stockBefore < requested) return { ok: false, message: `${entry.name} : stock disponible ${stockBefore}.` };
  const sourceDocument = await resolveShopCatalogDocument(entry);
  if (!sourceDocument) return { ok: false, message: `${entry.name} : document de compendium introuvable.` };
  await writeShopStockOverride(shop, entry, stockBefore - requested);
  try {
    await mergeOrCreatePurchasedItem(buyer, sourceDocument, entry, requested);
  } catch (error) {
    await writeShopStockOverride(shop, entry, stockBefore);
    throw error;
  }
  return { ok: true, message: `${requested} × ${entry.name} affecté(s) à ${buyer.name}.` };
}

export function requestShopBuy({ shop, buyer, item, quantity: requestedQuantity = 1 } = {}) {
  if (!shop || !buyer || !item?._shop?.key || !game.user?.id) return false;
  game.socket?.emit?.("system.add2e", {
    type: GM_OPERATION_TYPE,
    operation: GM_OPERATION_SHOP_BUY,
    payload: {
      requestId: foundry.utils.randomID(),
      userId: game.user.id,
      shopId: shop.id,
      shopType: getShopType(shop),
      buyerId: buyer.id,
      buyerUuid: buyer.uuid,
      itemKey: item._shop.key,
      quantity: Math.max(1, Math.floor(num(requestedQuantity, 1)))
    }
  });
  return true;
}

export async function handleShopBuyOperation(payload = {}) {
  const shop = game.actors?.get?.(payload.shopId) ?? null;
  const definition = getShopDefinition(shop ?? payload.shopType);
  const buyer = payload.buyerUuid ? await fromUuid(payload.buyerUuid).catch(() => null) : game.actors?.get?.(payload.buyerId) ?? null;
  const requestingUser = game.users?.get?.(payload.userId) ?? null;
  let result = { ok: false, message: "Achat impossible." };
  try {
    if (!shop || !definition || getShopType(shop) !== definition.id) throw new Error("Boutique introuvable ou type incohérent.");
    if (!buyer) throw new Error("Acheteur introuvable.");
    if (!requestingUser || requestingUser.isGM || buyer.testUserPermission?.(requestingUser, "OWNER") !== true) throw new Error("L’utilisateur ne possède pas l’acteur acheteur.");
    await ensureShopActor(shop, definition.id);
    const entry = await findShopCatalogItem(shop, payload.itemKey);
    if (!entry) throw new Error("Article introuvable dans le catalogue de la boutique.");
    result = await shopBuyLocal({ shop, buyer, item: entry, quantity: payload.quantity }, { confirm: false });
  } catch (error) {
    result = { ok: false, message: error?.message || "Erreur pendant l’achat." };
  }
  game.socket?.emit?.("system.add2e", {
    type: SHOP_BUY_RESULT,
    requestId: payload.requestId,
    userId: payload.userId,
    shopId: shop?.id ?? payload.shopId ?? null,
    shopType: definition?.id ?? payload.shopType ?? null,
    buyerId: buyer?.id ?? payload.buyerId ?? null,
    ok: !!result.ok,
    message: result.message
  });
  return result;
}

export function handleShopBuyResult(data = {}) {
  if (data.userId !== game.user?.id) return false;
  (data.ok ? ui.notifications?.info : ui.notifications?.warn)?.(data.message ?? (data.ok ? "Achat effectué." : "Achat impossible."));
  Hooks.callAll?.("add2eShopMoneyChanged", data);
  return true;
}

// ---------------------------------------------------------------------------
// Définition du marchand général
// ---------------------------------------------------------------------------

registerShopDefinition({
  id: "general",
  label: "Marchand général",
  actorName: VENDOR_NAME,
  folder: VENDOR_FOLDER,
  tokenImg: TOKEN_IMG,
  setting: VENDOR_SETTING,
  actorFlags: { isVendor: true },
  defaultMoney: { po: 500 },
  sources: [
    {
      id: "components",
      packs: ["add2e.equipements", "world.equipements", "add2e.equipement", "world.equipement"],
      discover: /equip|équip|objets?/i,
      exclude: /magique|magic/i,
      accept: item => item?.type === "objet" && isComponent(item),
      kind: "component",
      defaultStock: 20
    },
    {
      id: "projectiles",
      packs: ["add2e.armes", "world.armes"],
      discover: /\barmes?\b|weapons?/i,
      accept: item => isAmmunition(item),
      kind: "projectile",
      defaultStock: 40
    },
    {
      id: "equipment",
      packs: ["add2e.equipements", "world.equipements", "add2e.equipement", "world.equipement"],
      discover: /equip|équip|objets?/i,
      exclude: /magique|magic/i,
      accept: item => isEquipment(item),
      kind: "equipment",
      defaultStock: 10
    }
  ],
  legacyItemPredicate: item => item?.getFlag?.(VENDOR_SCOPE, "vendorItem") === true || item?.flags?.add2e?.vendorItem === true,
  legacyStockMaximum: item => Math.max(quantity(item), Math.floor(num(item?.getFlag?.(VENDOR_SCOPE, "vendorStockMax") ?? item?.flags?.add2e?.vendorStockMax, defaultStock(item)))),
  catalogIdentity: (item, kind) => `${kind}:${slug(item?.name)}`
});

export async function findVendor() {
  return Array.from(game.actors ?? []).find(actor => getShopType(actor) === "general" || actor?.name === VENDOR_NAME) ?? null;
}

export async function moveToFolder(vendor = null) {
  if (!game.user?.isGM) return false;
  vendor = vendor ?? await findVendor();
  if (!vendor) return false;
  const definition = getShopDefinition("general");
  const folder = await ensureShopFolder(definition);
  if (folder && vendor.folder?.id !== folder.id && vendor.folder !== folder.id) await vendor.update({ folder: folder.id }, { add2eReason: "vendor-folder-move" });
  return true;
}

export async function updateTokenSize(vendor = null) {
  if (!game.user?.isGM) return false;
  vendor = vendor ?? await findVendor();
  if (!vendor) return false;
  await vendor.update({
    img: TOKEN_IMG,
    "prototypeToken.width": 2,
    "prototypeToken.height": 2,
    "prototypeToken.texture.src": TOKEN_IMG,
    "flags.add2e.vendorVersion": ADD2E_VENDOR_VERSION,
    "flags.add2e.shopType": "general"
  }, { add2eReason: "vendor-token-image-size" });
  return true;
}

export async function createVendor({ force = false } = {}) {
  const existing = await findVendor();
  if (existing && !force) {
    await moveToFolder(existing);
    await updateTokenSize(existing);
    await ensureStock(existing);
    return existing;
  }
  const actor = await createShopActor("general", { force });
  if (actor) {
    await updateTokenSize(actor);
    if (game.settings?.settings?.has?.(`add2e.${VENDOR_SETTING}`)) await game.settings.set("add2e", VENDOR_SETTING, ADD2E_VENDOR_VERSION);
  }
  return actor;
}

export async function ensureStock(vendor) {
  if (!vendor) return 0;
  const items = await ensureShopActor(vendor, "general");
  return items.length;
}

export function getBuyer() {
  const character = game.user?.character;
  if (character && !isShopActor(character) && (character.isOwner || game.user?.isGM)) return character;
  const controlled = canvas?.tokens?.controlled?.[0]?.actor;
  if (controlled && !isShopActor(controlled) && (controlled.isOwner || game.user?.isGM)) return controlled;
  return null;
}

// ---------------------------------------------------------------------------
// Projectiles de combat — ressource canonique
// ---------------------------------------------------------------------------

function actorType(actor) {
  return slug(actor?.type ?? actor?._source?.type ?? actor?.baseActor?.type ?? actor?.document?.type ?? "");
}

function actorUsesProjectileInventory(actor) {
  return actorType(actor) === "personnage";
}

function projectileResourceEngine() {
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine;
  if (!engine || typeof engine.consumeResource !== "function" || typeof engine.recoverResource !== "function") {
    throw new Error("Le domaine canonique ADD2E resource n’est pas disponible pour les projectiles.");
  }
  return engine;
}

function isThrownWeapon(item) {
  if (!item || isAmmunition(item)) return false;
  if (!["arme", "weapon"].includes(lower(item?.type))) return false;
  if (typeof globalThis.add2eGetWeaponUsageProfile !== "function") throw new Error("Le propriétaire canonique du profil d’usage des armes est indisponible.");
  return globalThis.add2eGetWeaponUsageProfile(item)?.isThrown === true;
}

function projectileResource(actor, projectile, { cost = 0, recovery = 0 } = {}) {
  if (!actor || !projectile) throw new Error("Projectile ou acteur introuvable pour la ressource canonique.");
  const resourceKind = isThrownWeapon(projectile) ? "thrown-weapon" : "ammunition";
  return {
    id: `${projectile.uuid ?? projectile.id}:projectile-stack`,
    type: resourceKind,
    label: projectile.name,
    document: projectile,
    actor,
    item: projectile,
    target: String(projectile.id ?? "projectile"),
    get current() { return quantity(projectile); },
    maximum: null,
    cost: Math.max(0, Math.floor(num(cost, 0))),
    recovery: Math.max(0, Math.floor(num(recovery, 0))),
    source: { kind: resourceKind, id: String(projectile.id ?? ""), uuid: String(projectile.uuid ?? ""), name: String(projectile.name ?? "Projectile") },
    context: { consumer: "22a-vendor-core", actorId: String(actor.id ?? ""), projectileId: String(projectile.id ?? "") },
    write: next => {
      const update = quantityUpdate(next);
      if (resourceKind === "thrown-weapon" && recovery > 0 && Number(next) > 0) update["system.equipee"] = true;
      return projectile.update(update, {
        add2eInternal: true,
        add2eReason: resourceKind === "thrown-weapon" && recovery > 0 ? "thrown-weapon-recovery-resource" : "projectile-resource",
        render: false
      });
    }
  };
}

function weaponRequiresProjectile(weapon) {
  if (typeof globalThis.add2eGetWeaponUsageProfile !== "function") throw new Error("Le propriétaire canonique du profil d’usage des armes est indisponible.");
  return globalThis.add2eGetWeaponUsageProfile(weapon)?.requiresEquippedProjectile === true;
}

function isEquippedProjectile(item) {
  const system = item?.system ?? {};
  const flags = item?.flags?.add2e ?? {};
  return system.equipee === true || system.equiped === true || system.equipped === true || flags.equippedProjectile === true || flags.carquoisEquipe === true || flags.selectedProjectile === true;
}

function projectileCompatibilityKeys(weapon) {
  const text = `${lower(weapon?.name)} ${tags(weapon).join(" ")}`;
  if (/\barbalete\b/.test(text)) return ["carreau", "carreaux", "bolt"];
  if (/\barc\b/.test(text)) return ["fleche", "fleches", "arrow"];
  if (/\bfronde\b/.test(text)) return ["bille", "billes", "pierre", "pierres", "bullet"];
  return [];
}

function projectileMatchesWeapon(projectile, weapon) {
  const keys = projectileCompatibilityKeys(weapon);
  if (!keys.length) return true;
  const text = `${lower(projectile?.name)} ${tags(projectile).join(" ")}`;
  return keys.some(key => text.includes(key));
}

function findEquippedProjectile(actor, weapon = null) {
  const compatible = Array.from(actor?.items ?? [])
    .filter(isAmmunition)
    .filter(isEquippedProjectile)
    .filter(item => !weapon || projectileMatchesWeapon(item, weapon));
  return compatible.find(item => quantity(item) > 0) ?? compatible[0] ?? null;
}

export function resolveProjectileForAttack({ actor, arme } = {}) {
  const required = weaponRequiresProjectile(arme);
  const compatibility = projectileCompatibilityKeys(arme);
  if (!required) return { ok: true, required: false, ignored: !actorUsesProjectileInventory(actor), projectile: null, current: null, compatibility };
  if (!actorUsesProjectileInventory(actor)) return { ok: true, required: true, ignored: true, projectile: null, current: null, compatibility };
  const projectile = findEquippedProjectile(actor, arme);
  const current = projectile ? quantity(projectile) : 0;
  return { ok: !!projectile && current > 0, required: true, ignored: false, projectile, current, compatibility };
}

function projectileSummary(actor, weapon = null) {
  return Array.from(actor?.items ?? [])
    .filter(isAmmunition)
    .filter(item => !weapon || projectileMatchesWeapon(item, weapon))
    .map(item => `${item.name} (${quantity(item)})`)
    .join(", ");
}

function projectileSpentType(value, item = null) {
  const type = String(value ?? "").trim().toLowerCase();
  if (type === "thrown-weapon" || type === "ammunition") return type;
  return isThrownWeapon(item) ? "thrown-weapon" : "ammunition";
}

function recoveryItemForEntry(actor, entry) {
  const byId = entry?.itemId ? actor?.items?.get?.(entry.itemId) ?? null : null;
  if (byId && (isAmmunition(byId) || isThrownWeapon(byId))) return byId;
  return Array.from(actor?.items ?? []).find(item => item?.name === entry?.itemName && (isAmmunition(item) || isThrownWeapon(item))) ?? null;
}

export async function recordProjectileSpentOperation(payload = {}) {
  const combat = game.combats?.get?.(payload.combatId) ?? game.combat;
  if (!combat?.getFlag || !combat?.setFlag) return false;
  const requestId = payload.requestId ?? null;
  if (requestId && PROJECTILE_SPENT_REQUESTS.has(requestId)) return true;
  const actor = payload.actorUuid ? await fromUuid(payload.actorUuid).catch(() => null) : game.actors?.get?.(payload.actorId) ?? null;
  if (!actorUsesProjectileInventory(actor)) return false;
  const actorId = actor.id ?? payload.actorId;
  const itemKey = payload.itemId ?? payload.itemName ?? null;
  if (!actorId || !itemKey) return false;
  const item = payload.itemId ? actor.items?.get?.(payload.itemId) ?? null : null;
  const type = projectileSpentType(payload.type, item);
  const spent = clone(combat.getFlag(VENDOR_SCOPE, PROJECTILE_FLAG) ?? {});
  spent[actorId] ??= { actorId, actorName: actor.name ?? payload.actorName ?? "Acteur", items: {} };
  spent[actorId].actorName = actor.name ?? payload.actorName ?? spent[actorId].actorName;
  spent[actorId].items ??= {};
  spent[actorId].items[itemKey] ??= { itemId: payload.itemId ?? null, itemName: payload.itemName ?? "Projectile", img: payload.img ?? null, type, spent: 0 };
  const entry = spent[actorId].items[itemKey];
  entry.itemId = payload.itemId ?? entry.itemId ?? null;
  entry.itemName = payload.itemName ?? entry.itemName ?? "Projectile";
  entry.img = payload.img ?? entry.img ?? null;
  entry.type = type;
  entry.spent = Math.max(0, Math.floor(num(entry.spent, 0))) + Math.max(1, Math.floor(num(payload.quantity, 1)));
  await combat.setFlag(VENDOR_SCOPE, PROJECTILE_FLAG, spent);
  if (requestId) PROJECTILE_SPENT_REQUESTS.add(requestId);
  return true;
}

async function recordProjectileSpent({ actor, projectile, quantity: requestedQuantity = 1 }) {
  if (!actorUsesProjectileInventory(actor)) return false;
  const combat = game.combat;
  if (!combat?.id) return false;
  const payload = {
    requestId: foundry.utils.randomID(),
    userId: game.user?.id,
    combatId: combat.id,
    actorId: actor?.id,
    actorUuid: actor?.uuid,
    actorName: actor?.name,
    actorType: actor?.type,
    itemId: projectile?.id,
    itemName: projectile?.name,
    img: projectile?.img,
    type: projectileSpentType(null, projectile),
    quantity: Math.max(1, Math.floor(num(requestedQuantity, 1)))
  };
  if (!payload.actorId || !(payload.itemId || payload.itemName)) return false;
  if (game.user?.isGM) return recordProjectileSpentOperation(payload);
  game.socket?.emit?.("system.add2e", { type: GM_OPERATION_TYPE, operation: GM_OPERATION_PROJECTILE_SPENT, payload });
  return true;
}

export async function spendProjectileForAttack({ actor, arme } = {}) {
  const resolved = resolveProjectileForAttack({ actor, arme });
  if (!resolved.required) return { ok: true, required: false, spent: 0, ignored: resolved.ignored };
  if (resolved.ignored) return { ok: true, required: true, spent: 0, ignored: true };
  const projectile = resolved.projectile;
  if (!resolved.ok || !projectile) {
    const detail = projectileSummary(actor, arme);
    await alertBox("Projectile indisponible", detail ? `Aucun projectile compatible équipé avec une quantité disponible. Projectiles compatibles dans le carquois : ${detail}.` : "Aucun projectile compatible disponible dans le carquois.");
    return { ok: false, required: true, spent: 0 };
  }
  const consumed = await projectileResourceEngine().consumeResource(projectileResource(actor, projectile, { cost: 1 }), { cost: 1, reason: "projectile-spent-attack", consumer: "22a-vendor-core" });
  if (!consumed.ok) {
    await alertBox("Projectile indisponible", `${projectile.name} n’est plus disponible.`);
    return { ok: false, required: true, spent: 0 };
  }
  await recordProjectileSpent({ actor, projectile, quantity: 1 });
  return { ok: true, required: true, spent: 1, projectile, remaining: Math.max(0, Number(consumed.resources?.[0]?.after ?? quantity(projectile)) || 0) };
}

async function showRecovery(rows) {
  if (!rows?.length) return false;
  const body = rows.map(row => `<tr><td>${esc(row.actor)}</td><td>${esc(row.item)}</td><td>${esc(row.typeLabel ?? "Projectile")}</td><td>${row.spent}</td><td>${row.recovered}</td></tr>`).join("");
  return dialog({
    title: "Récupération des projectiles",
    content: `<h3>Récupération des projectiles</h3><p>Les munitions ordinaires sont récupérées à 60 %. Les armes lancées sont ramassées intégralement.</p><table><thead><tr><th>Acteur</th><th>Projectile</th><th>Type</th><th>Dépensés</th><th>Récupérés</th></tr></thead><tbody>${body}</tbody></table>`
  });
}

export function handleProjectileRecoveryResult(data = {}) {
  if (data.type !== SOCKET_RECOVERY || data.userId !== game.user?.id) return false;
  void showRecovery(data.rows ?? []);
  return true;
}

export async function recoverProjectilesForCombat(combat) {
  if (!game.user?.isGM || !combat?.getFlag) return false;
  if (typeof game.user.isActiveGM === "boolean" && !game.user.isActiveGM) return false;
  const spent = clone(combat.getFlag(VENDOR_SCOPE, PROJECTILE_FLAG) ?? {});
  const rows = [];
  const byUser = {};
  for (const actorEntry of Object.values(spent)) {
    const actor = game.actors?.get(actorEntry.actorId);
    if (!actor || !actorUsesProjectileInventory(actor)) continue;
    for (const itemEntry of Object.values(actorEntry.items ?? {})) {
      const spentQty = Math.max(0, Math.floor(num(itemEntry.spent, 0)));
      if (!spentQty) continue;
      const item = recoveryItemForEntry(actor, itemEntry);
      const type = projectileSpentType(itemEntry.type, item);
      const thrown = type === "thrown-weapon";
      const recovered = item ? thrown ? spentQty : Math.max(0, Math.round(spentQty * RECOVERY_RATE)) : 0;
      if (!item) {
        console.warn("[ADD2E][PROJECTILES][RECOVERY][ITEM_MISSING]", { actor: actor.name, itemId: itemEntry.itemId ?? null, itemName: itemEntry.itemName ?? "Projectile", type, spent: spentQty });
      } else if (recovered) {
        const result = await projectileResourceEngine().recoverResource(projectileResource(actor, item, { recovery: recovered }), { amount: recovered, reason: thrown ? "thrown-weapon-combat-recovery" : "projectile-combat-recovery", consumer: "22a-vendor-core" });
        if (!result.ok) console.warn("[ADD2E][PROJECTILES][RECOVERY][RESOURCE_FAILED]", { actor: actor.name, item: item.name, recovered });
      }
      const row = { actor: actor.name, actorId: actor.id, item: itemEntry.itemName, type, typeLabel: thrown ? "Arme lancée" : "Munition", spent: spentQty, recovered };
      rows.push(row);
      for (const user of game.users ?? []) {
        if (!user.isGM && user.active && actor.testUserPermission?.(user, "OWNER")) {
          byUser[user.id] ??= [];
          byUser[user.id].push(row);
        }
      }
    }
  }
  if (!rows.length) return false;
  for (const [userId, userRows] of Object.entries(byUser)) game.socket?.emit?.("system.add2e", { type: SOCKET_RECOVERY, userId, rows: userRows });
  await showRecovery(rows);
  return true;
}

export function registerRecoveryHooks() {
  Hooks.on("deleteCombat", combat => {
    recoverProjectilesForCombat(combat).catch(error => console.warn("[ADD2E][PROJECTILES][RECOVERY][deleteCombat]", error));
  });
}

// ---------------------------------------------------------------------------
// Feuille et API canoniques
// ---------------------------------------------------------------------------

function bindMoneyInputs(sheet, root) {
  const actor = sheet?.actor ?? sheet?.document;
  if (!actor || !root?.querySelectorAll) return;
  if (root.dataset?.add2eMoneyBound === "1") return;
  if (root.dataset) root.dataset.add2eMoneyBound = "1";
  root.addEventListener("change", async event => {
    const input = event.target?.closest?.(".add2e-money-input[data-coin]");
    if (!input) return;
    const coin = String(input.dataset.coin ?? "").toLowerCase();
    if (!COINS.some(entry => entry.key === coin)) return;
    const money = getMoney(actor);
    money[coin] = Math.max(0, Math.floor(num(input.value, 0)));
    await setMoney(actor, money);
    sheet.render?.(false);
  }, true);
}

export function patchActorSheetMoney() {
  const prototype = globalThis.Add2eActorSheet?.prototype;
  if (!prototype || prototype.__add2eVendorMoneySheetV20_ASSIGN_ALL) return;
  prototype.__add2eVendorMoneySheetV20_ASSIGN_ALL = true;
  if (typeof prototype.getData === "function") {
    const original = prototype.getData;
    prototype.getData = async function(...args) {
      const data = await original.apply(this, args);
      data.add2eVendorMoney = getMoney(this.actor);
      data.add2eVendorMoneyLabel = formatMoney(data.add2eVendorMoney);
      return data;
    };
  }
  if (typeof prototype.activateListeners === "function") {
    const original = prototype.activateListeners;
    prototype.activateListeners = function(html, ...args) {
      const result = original.call(this, html?.[0] ?? html, ...args);
      bindMoneyInputs(this, html?.[0] ?? html);
      return result;
    };
  }
  if (typeof prototype._onRender === "function") {
    const original = prototype._onRender;
    prototype._onRender = async function(context, options) {
      const result = await original.call(this, context, options);
      bindMoneyInputs(this, this.element);
      return result;
    };
  }
}

export function registerGlobals() {
  game.add2e = game.add2e ?? {};
  game.add2e.shopEngineVersion = ADD2E_SHOP_ENGINE_VERSION;
  game.add2e.shop = {
    registerDefinition: registerShopDefinition,
    definition: getShopDefinition,
    displayItems: getShopDisplayItems,
    resolveDocument: resolveShopCatalogDocument,
    buyLocal: shopBuyLocal,
    requestBuy: requestShopBuy,
    restock: restockShop,
    setStock: setShopStock,
    assign: assignShopItem,
    migrate: migrateLegacyShopInventory
  };
  game.add2e.vendorVersion = ADD2E_VENDOR_VERSION;
  game.add2e.vendorProjectiles = {
    resolveProjectileForAttack,
    spendProjectileForAttack,
    recoverProjectilesForCombat,
    recordProjectileSpent
  };

  globalThis.ADD2E_VENDOR_VERSION = ADD2E_VENDOR_VERSION;
  globalThis.ADD2E_VENDOR_PROJECTILES = game.add2e.vendorProjectiles;
}
