// ADD2E — Vendeur système : composants, projectiles et monnaie complète
// ApplicationV2 + DialogV2, création automatique au premier lancement du monde.

const ADD2E_VENDOR_VERSION = "2026-05-26-vendor-v9-mj-open";
globalThis.ADD2E_VENDOR_VERSION = ADD2E_VENDOR_VERSION;

const ADD2E_VENDOR_FLAG_SCOPE = "add2e";
const ADD2E_VENDOR_NAME = "Marchand de composants et projectiles";
const ADD2E_VENDOR_CREATION_SETTING = "vendorCreationVersion";
const ADD2E_VENDOR_TOKEN_SIZE = 2;
const ADD2E_VENDOR_TOKEN_IMG = "systems/add2e/assets/ui/boutique.webp";

const ADD2E_COINS = [
  { key: "pp", label: "PP", name: "Pièces de platine", pc: 1000 },
  { key: "po", label: "PO", name: "Pièces d’or", pc: 200 },
  { key: "pe", label: "PE", name: "Pièces d’électrum", pc: 100 },
  { key: "pa", label: "PA", name: "Pièces d’argent", pc: 10 },
  { key: "pc", label: "PC", name: "Pièces de cuivre", pc: 1 }
];

function add2eVendorLog(...args) {
  if (globalThis.ADD2E_DEBUG_VENDOR) console.log("[ADD2E][VENDOR]", ...args);
}

function add2eVendorNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function add2eVendorSlug(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, "_")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function add2eVendorEscape(value) {
  const div = document.createElement("div");
  div.textContent = String(value ?? "");
  return div.innerHTML;
}

function add2eVendorAsArray(value) {
  if (Array.isArray(value)) return value.filter(v => v !== null && v !== undefined && String(v).trim() !== "");
  if (value === null || value === undefined) return [];
  if (typeof value === "string") return value.split(/[,;|]/g).map(v => v.trim()).filter(Boolean);
  return [value];
}

function add2eVendorTags(item) {
  const sys = item?.system ?? {};
  const flags = item?.flags?.add2e ?? {};
  return [
    ...add2eVendorAsArray(sys.tags),
    ...add2eVendorAsArray(sys.effectTags),
    ...add2eVendorAsArray(flags.tags)
  ].map(t => String(t).trim()).filter(Boolean);
}

function add2eVendorQuantity(item) {
  return Math.max(0, add2eVendorNumber(item?.system?.quantite ?? item?.system?.quantity ?? 0, 0));
}

function add2eVendorSetQuantityPath(value) {
  return { "system.quantite": Math.max(0, Math.floor(add2eVendorNumber(value, 0))) };
}

function add2eVendorIsAmmunition(item) {
  const sys = item?.system ?? {};
  if (String(sys.categorie ?? "").toLowerCase() === "munition") return true;
  if (String(sys.type ?? "").toLowerCase() === "munition") return true;
  return add2eVendorTags(item).some(tag => ["munition", "trait:munition"].includes(String(tag).toLowerCase()));
}

function add2eVendorIsSpellComponent(item) {
  const sys = item?.system ?? {};
  if (String(sys.categorie ?? "").toLowerCase() === "composant_sort") return true;
  if (String(sys.sousType ?? sys.sous_type ?? "").toLowerCase() === "composant") return true;
  return add2eVendorTags(item).some(tag => String(tag).toLowerCase() === "composant_sort" || String(tag).toLowerCase().startsWith("composant:"));
}

function add2eVendorIsMagicStockItem(item) {
  const sys = item?.system ?? {};
  const name = String(item?.name ?? "").toLowerCase();
  const tags = add2eVendorTags(item).map(t => String(t).toLowerCase());
  const category = String(sys.categorie ?? sys.category ?? sys.sousType ?? sys.sous_type ?? "").toLowerCase();

  if (item?.getFlag?.(ADD2E_VENDOR_FLAG_SCOPE, "vendorMagic") === true) return true;
  if (item?.getFlag?.(ADD2E_VENDOR_FLAG_SCOPE, "magicItem") === true) return true;
  if (sys.magique === true || sys.magic === true || sys.isMagic === true) return true;
  if (category.includes("magique") || category.includes("magic")) return true;
  if (tags.some(t => /magique|magic|objet_magique|magic_item/.test(t))) return true;
  if (/\+\d/.test(name)) return true;
  if (/anneau|bracelet|baguette|bâton|baton|potion|parchemin|amulette|cape|ceinture|gantelet|heaume|botte|bottes|collier|robe magique/.test(name)) return true;
  return false;
}

function add2eVendorIsStockItem(item) {
  return item?.type === "objet"
    && !add2eVendorIsMagicStockItem(item)
    && (add2eVendorIsSpellComponent(item) || add2eVendorIsAmmunition(item));
}

function add2eVendorStockKind(item) {
  if (add2eVendorIsSpellComponent(item)) return "Composant";
  if (add2eVendorIsAmmunition(item)) return "Projectile";
  return "Objet";
}

function add2eIsVendorActor(actor) {
  return actor?.getFlag?.(ADD2E_VENDOR_FLAG_SCOPE, "isVendor") === true || actor?.name === ADD2E_VENDOR_NAME;
}

function add2eVendorDefaultStock(item) {
  if (add2eVendorIsAmmunition(item)) return 40;
  if (add2eVendorIsSpellComponent(item)) return 20;
  return 10;
}

function add2eVendorCoinByKey(key) {
  const normalized = String(key ?? "po").toLowerCase();
  return ADD2E_COINS.find(c => c.key === normalized) ?? ADD2E_COINS.find(c => c.key === "po");
}

function add2eVendorMoneyFromObject(raw = {}) {
  const money = { pc: 0, pa: 0, pe: 0, po: 0, pp: 0 };
  for (const coin of ADD2E_COINS) money[coin.key] = Math.max(0, Math.floor(add2eVendorNumber(raw?.[coin.key], 0)));
  return money;
}

function add2eVendorGetMoney(actor) {
  const flagMoney = actor?.getFlag?.(ADD2E_VENDOR_FLAG_SCOPE, "monnaie");
  if (flagMoney && typeof flagMoney === "object") return add2eVendorMoneyFromObject(flagMoney);
  const sysMoney = actor?.system?.monnaie ?? actor?.system?.argent ?? actor?.system?.currency ?? null;
  if (sysMoney && typeof sysMoney === "object") return add2eVendorMoneyFromObject(sysMoney);
  return add2eVendorMoneyFromObject({});
}

async function add2eVendorSetMoney(actor, money) {
  if (!actor?.setFlag) return false;
  await actor.setFlag(ADD2E_VENDOR_FLAG_SCOPE, "monnaie", add2eVendorMoneyFromObject(money));
  return true;
}

function add2eVendorMoneyToCopper(money) {
  const m = add2eVendorMoneyFromObject(money);
  return ADD2E_COINS.reduce((sum, coin) => sum + (m[coin.key] * coin.pc), 0);
}

function add2eVendorCopperToMoney(total) {
  let rest = Math.max(0, Math.floor(add2eVendorNumber(total, 0)));
  const money = { pc: 0, pa: 0, pe: 0, po: 0, pp: 0 };
  for (const coin of ADD2E_COINS) {
    money[coin.key] = Math.floor(rest / coin.pc);
    rest = rest % coin.pc;
  }
  return money;
}

function add2eVendorFormatMoney(moneyOrCopper) {
  const money = typeof moneyOrCopper === "number" ? add2eVendorCopperToMoney(moneyOrCopper) : add2eVendorMoneyFromObject(moneyOrCopper);
  const parts = ADD2E_COINS.map(coin => money[coin.key] ? `${money[coin.key]} ${coin.label}` : "").filter(Boolean);
  return parts.length ? parts.join(" ") : "0 PC";
}

function add2eVendorResolvePrice(item) {
  const sys = item?.system ?? {};
  const raw = sys.prix ?? sys.price ?? sys.cout ?? sys.coût ?? item?.getFlag?.(ADD2E_VENDOR_FLAG_SCOPE, "prix") ?? null;
  let value = 0;
  let devise = sys.devise ?? sys.currency ?? item?.getFlag?.(ADD2E_VENDOR_FLAG_SCOPE, "devise") ?? "po";

  if (typeof raw === "number") value = raw;
  else if (typeof raw === "string") {
    const match = raw.match(/([0-9]+(?:[\.,][0-9]+)?)\s*(pp|po|pe|pa|pc)?/i);
    if (match) {
      value = Number(String(match[1]).replace(",", "."));
      if (match[2]) devise = match[2].toLowerCase();
    }
  } else if (raw && typeof raw === "object") {
    value = raw.valeur ?? raw.value ?? raw.montant ?? raw.amount ?? 0;
    devise = raw.devise ?? raw.currency ?? devise;
  }

  if (!Number.isFinite(Number(value)) || Number(value) <= 0) {
    value = add2eVendorIsAmmunition(item) ? 1 : 1;
    devise = add2eVendorIsAmmunition(item) ? "pa" : "po";
  }

  const coin = add2eVendorCoinByKey(devise);
  const copper = Math.max(1, Math.round(Number(value) * coin.pc));
  return { value: Number(value), devise: coin.key, label: `${value} ${coin.label}`, copper };
}

function add2eVendorSameItemIdentity(a, b) {
  return String(a?.type ?? "") === String(b?.type ?? "") && add2eVendorSlug(a?.name) === add2eVendorSlug(b?.name);
}

function add2eVendorGetBuyer({ excludeVendor = true, preferCharacter = true } = {}) {
  const character = game.user?.character ?? null;
  if (preferCharacter && character && (!excludeVendor || !add2eIsVendorActor(character)) && (character.isOwner || game.user?.isGM)) return character;

  const controlled = canvas?.tokens?.controlled?.[0]?.actor ?? null;
  if (controlled && (!excludeVendor || !add2eIsVendorActor(controlled)) && (controlled.isOwner || game.user?.isGM)) return controlled;

  if (!preferCharacter && character && (!excludeVendor || !add2eIsVendorActor(character)) && (character.isOwner || game.user?.isGM)) return character;
  return null;
}

function add2eVendorIsResponsibleGM() {
  if (!game.user?.isGM) return false;
  if (typeof game.user.isActiveGM === "boolean") return game.user.isActiveGM;
  return game.users?.activeGM?.id === game.user.id || !game.users?.activeGM;
}

async function add2eVendorDialog({ title = "Marchand", content = "", yes = "Compris", no = "Fermer" } = {}) {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (DialogV2?.confirm) {
    return DialogV2.confirm({
      window: { title },
      content,
      yes: { label: yes },
      no: { label: no },
      modal: true
    });
  }
  ui.notifications?.warn?.(content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());
  return false;
}

async function add2eVendorAlert(title, message) {
  return add2eVendorDialog({
    title,
    content: `<div class="add2e-dialog add2e-vendor-alert"><h3>${add2eVendorEscape(title)}</h3><p>${add2eVendorEscape(message)}</p></div>`,
    yes: "Compris",
    no: "Fermer"
  });
}

async function add2eVendorSubtractMoney(actor, costCopper) {
  const money = add2eVendorGetMoney(actor);
  const total = add2eVendorMoneyToCopper(money);
  if (total < costCopper) return false;
  await add2eVendorSetMoney(actor, add2eVendorCopperToMoney(total - costCopper));
  return true;
}

async function add2eVendorMergeOrCreateItem(actor, sourceItem, quantity) {
  const existing = Array.from(actor.items ?? []).find(item => add2eVendorSameItemIdentity(item, sourceItem));
  if (existing) {
    await existing.update(add2eVendorSetQuantityPath(add2eVendorQuantity(existing) + quantity), { add2eReason: "vendor-buy-merge" });
    return existing;
  }

  const itemData = sourceItem.toObject ? sourceItem.toObject() : foundry.utils.deepClone(sourceItem);
  delete itemData._id;
  itemData.system = itemData.system ?? {};
  itemData.system.quantite = quantity;
  itemData.flags = itemData.flags ?? {};
  itemData.flags.add2e = itemData.flags.add2e ?? {};
  itemData.flags.add2e.purchasedFromVendor = true;
  const created = await actor.createEmbeddedDocuments("Item", [itemData], { add2eReason: "vendor-buy-create" });
  return created?.[0] ?? null;
}

async function add2eVendorBuyLocal({ vendor, buyer, item, quantity }, { confirm = true, notify = true } = {}) {
  if (!vendor || !buyer || !item) return { ok: false, message: "Vendeur, acheteur ou article introuvable." };
  if (add2eIsVendorActor(buyer)) return { ok: false, message: "Le vendeur ne peut pas acheter dans sa propre boutique." };

  quantity = Math.max(1, Math.floor(add2eVendorNumber(quantity, 1)));
  const stock = add2eVendorQuantity(item);
  if (stock < quantity) return { ok: false, message: `${item.name} : stock disponible ${stock}.` };

  const price = add2eVendorResolvePrice(item);
  const total = price.copper * quantity;
  const buyerMoney = add2eVendorGetMoney(buyer);
  if (add2eVendorMoneyToCopper(buyerMoney) < total) return { ok: false, message: `${buyer.name} n’a pas assez d’argent. Prix : ${add2eVendorFormatMoney(total)}.` };

  if (confirm) {
    const accepted = await add2eVendorDialog({
      title: "Confirmer l’achat",
      content: `<div class="add2e-dialog add2e-vendor-alert"><h3>${add2eVendorEscape(item.name)}</h3><p>Acheter ${quantity} unité(s) pour <strong>${add2eVendorFormatMoney(total)}</strong> ?</p></div>`,
      yes: "Acheter",
      no: "Annuler"
    });
    if (!accepted) return { ok: false, cancelled: true, message: "Achat annulé." };
  }

  const paid = await add2eVendorSubtractMoney(buyer, total);
  if (!paid) return { ok: false, message: "Paiement impossible." };
  await item.update(add2eVendorSetQuantityPath(stock - quantity), { add2eReason: "vendor-stock-decrease" });
  await add2eVendorMergeOrCreateItem(buyer, item, quantity);
  const message = `${buyer.name} achète ${quantity} × ${item.name} pour ${add2eVendorFormatMoney(total)}.`;
  if (notify) ui.notifications?.info?.(message);
  return { ok: true, message };
}

async function add2eVendorRequestBuy({ vendor, buyer, item, quantity }) {
  if (!vendor || !buyer || !item) return false;
  quantity = Math.max(1, Math.floor(add2eVendorNumber(quantity, 1)));

  const price = add2eVendorResolvePrice(item);
  const total = price.copper * quantity;
  const stock = add2eVendorQuantity(item);
  if (stock < quantity) {
    await add2eVendorAlert("Stock insuffisant", `${item.name} : stock disponible ${stock}.`);
    return false;
  }
  if (add2eVendorMoneyToCopper(add2eVendorGetMoney(buyer)) < total) {
    await add2eVendorAlert("Argent insuffisant", `${buyer.name} n’a pas assez d’argent. Prix : ${add2eVendorFormatMoney(total)}.`);
    return false;
  }

  const accepted = await add2eVendorDialog({
    title: "Confirmer l’achat",
    content: `<div class="add2e-dialog add2e-vendor-alert"><h3>${add2eVendorEscape(item.name)}</h3><p>Acheter ${quantity} unité(s) pour <strong>${add2eVendorFormatMoney(total)}</strong> ?</p></div>`,
    yes: "Acheter",
    no: "Annuler"
  });
  if (!accepted) return false;

  game.socket?.emit?.("system.add2e", {
    type: "ADD2E_VENDOR_BUY_REQUEST",
    requestId: foundry.utils.randomID(),
    userId: game.user.id,
    vendorId: vendor.id,
    buyerId: buyer.id,
    itemId: item.id,
    quantity
  });
  ui.notifications?.info?.("Demande d’achat envoyée au MJ.");
  return true;
}

async function add2eVendorBuy({ vendor, buyer, item, quantity }) {
  if (game.user?.isGM) {
    const result = await add2eVendorBuyLocal({ vendor, buyer, item, quantity }, { confirm: true, notify: true });
    if (!result.ok && !result.cancelled) await add2eVendorAlert("Achat impossible", result.message);
    return result.ok;
  }

  return add2eVendorRequestBuy({ vendor, buyer, item, quantity });
}

function add2eVendorStockMax(item) {
  return Math.max(1, Math.floor(add2eVendorNumber(item?.getFlag?.(ADD2E_VENDOR_FLAG_SCOPE, "vendorStockMax"), add2eVendorDefaultStock(item))));
}

async function add2eVendorRestockAll(vendor) {
  if (!game.user?.isGM) return false;
  const updates = [];
  for (const item of vendor.items ?? []) {
    if (!add2eVendorIsStockItem(item)) continue;
    updates.push({ _id: item.id, "system.quantite": add2eVendorStockMax(item) });
  }
  if (updates.length) await vendor.updateEmbeddedDocuments("Item", updates, { add2eReason: "vendor-restock-all" });
  ui.notifications?.info?.(`${vendor.name} : stocks réapprovisionnés.`);
  return true;
}

async function add2eVendorSetStock(item, value) {
  if (!game.user?.isGM || !item) return false;
  const qty = Math.max(0, Math.floor(add2eVendorNumber(value, 0)));
  await item.update(add2eVendorSetQuantityPath(qty), { add2eReason: "vendor-manual-stock" });
  return true;
}

async function add2eVendorCollectSourceItems() {
  const packIds = ["add2e.equipements", "world.equipements"];
  const collected = [];
  const seen = new Set();

  for (const packId of packIds) {
    const pack = game.packs?.get?.(packId);
    if (!pack) continue;
    let docs = [];
    try { docs = await pack.getDocuments(); }
    catch (err) { console.warn("[ADD2E][VENDOR][PACK_READ_ERROR]", packId, err); }
    for (const doc of docs) {
      if (!add2eVendorIsStockItem(doc)) continue;
      const key = `${doc.type}:${add2eVendorSlug(doc.name)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      collected.push(doc);
    }
  }

  for (const item of game.items ?? []) {
    if (!add2eVendorIsStockItem(item)) continue;
    const key = `${item.type}:${add2eVendorSlug(item.name)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    collected.push(item);
  }

  return collected.sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

async function add2eVendorBuildStockData() {
  const docs = await add2eVendorCollectSourceItems();
  return docs.map(doc => {
    const data = doc.toObject ? doc.toObject() : foundry.utils.deepClone(doc);
    delete data._id;
    data.system = data.system ?? {};
    const max = add2eVendorDefaultStock(doc);
    data.system.quantite = max;
    if (!data.system.categorie && add2eVendorIsAmmunition(doc)) data.system.categorie = "munition";
    if (!data.system.categorie && add2eVendorIsSpellComponent(doc)) data.system.categorie = "composant_sort";
    data.flags = data.flags ?? {};
    data.flags.add2e = data.flags.add2e ?? {};
    data.flags.add2e.vendorStockMax = max;
    data.flags.add2e.vendorItem = true;
    return data;
  });
}

export function add2eFindDefaultVendor() {
  return Array.from(game.actors ?? []).find(actor => add2eIsVendorActor(actor)) ?? null;
}

async function add2eUpdateVendorTokenSize(vendor = null) {
  if (!game.user?.isGM) return false;
  vendor = vendor ?? add2eFindDefaultVendor();
  if (!vendor) return false;

  const actorUpdates = {
    "img": ADD2E_VENDOR_TOKEN_IMG,
    "prototypeToken.width": ADD2E_VENDOR_TOKEN_SIZE,
    "prototypeToken.height": ADD2E_VENDOR_TOKEN_SIZE,
    "prototypeToken.texture.src": ADD2E_VENDOR_TOKEN_IMG,
    "flags.add2e.vendorVersion": ADD2E_VENDOR_VERSION
  };

  const currentWidth = Number(vendor.prototypeToken?.width ?? 1);
  const currentHeight = Number(vendor.prototypeToken?.height ?? 1);
  const currentTexture = vendor.prototypeToken?.texture?.src ?? vendor.prototypeToken?.texture?.src;
  if (currentWidth !== ADD2E_VENDOR_TOKEN_SIZE || currentHeight !== ADD2E_VENDOR_TOKEN_SIZE || currentTexture !== ADD2E_VENDOR_TOKEN_IMG || vendor.img !== ADD2E_VENDOR_TOKEN_IMG) {
    await vendor.update(actorUpdates, { add2eReason: "vendor-token-image-size" });
  }

  for (const scene of game.scenes ?? []) {
    const updates = [];
    for (const token of scene.tokens ?? []) {
      const sameActor = token.actorId === vendor.id;
      const sameName = token.name === ADD2E_VENDOR_NAME;
      if (!sameActor && !sameName) continue;
      const width = Number(token.width ?? 1);
      const height = Number(token.height ?? 1);
      const texture = token.texture?.src ?? "";
      if (width === ADD2E_VENDOR_TOKEN_SIZE && height === ADD2E_VENDOR_TOKEN_SIZE && texture === ADD2E_VENDOR_TOKEN_IMG) continue;
      updates.push({ _id: token.id, width: ADD2E_VENDOR_TOKEN_SIZE, height: ADD2E_VENDOR_TOKEN_SIZE, "texture.src": ADD2E_VENDOR_TOKEN_IMG });
    }
    if (updates.length) await scene.updateEmbeddedDocuments("Token", updates, { add2eReason: "vendor-token-image-size" });
  }

  return true;
}

export async function add2eCreateDefaultVendor({ force = false } = {}) {
  if (!game.user?.isGM) return null;
  const existing = add2eFindDefaultVendor();
  if (existing && !force) {
    await add2eUpdateVendorTokenSize(existing);
    return existing;
  }

  const stock = await add2eVendorBuildStockData();
  const observer = CONST?.DOCUMENT_OWNERSHIP_LEVELS?.OBSERVER ?? 2;
  const actor = await Actor.create({
    name: ADD2E_VENDOR_NAME,
    type: "personnage",
    img: ADD2E_VENDOR_TOKEN_IMG,
    ownership: { default: observer },
    prototypeToken: {
      name: ADD2E_VENDOR_NAME,
      actorLink: true,
      width: ADD2E_VENDOR_TOKEN_SIZE,
      height: ADD2E_VENDOR_TOKEN_SIZE,
      disposition: CONST?.TOKEN_DISPOSITIONS?.NEUTRAL ?? 0,
      displayName: CONST?.TOKEN_DISPLAY_MODES?.OWNER_HOVER ?? 30,
      displayBars: CONST?.TOKEN_DISPLAY_MODES?.NONE ?? 0,
      texture: { src: ADD2E_VENDOR_TOKEN_IMG }
    },
    flags: {
      add2e: {
        isVendor: true,
        vendorType: "components-projectiles",
        vendorVersion: ADD2E_VENDOR_VERSION,
        monnaie: { pc: 0, pa: 0, pe: 0, po: 500, pp: 0 }
      }
    }
  }, { renderSheet: false, add2eReason: "vendor-create" });

  if (stock.length) await actor.createEmbeddedDocuments("Item", stock, { add2eReason: "vendor-initial-stock" });
  await game.settings.set("add2e", ADD2E_VENDOR_CREATION_SETTING, ADD2E_VENDOR_VERSION);
  ui.notifications?.info?.(`${ADD2E_VENDOR_NAME} créé avec ${stock.length} article(s).`);
  return actor;
}

async function add2eEnsureVendorOnFirstWorldLaunch() {
  if (!game.user?.isGM) return;
  const existing = add2eFindDefaultVendor();
  if (existing) {
    await add2eUpdateVendorTokenSize(existing);
    return;
  }
  const done = game.settings.get("add2e", ADD2E_VENDOR_CREATION_SETTING);
  if (done === ADD2E_VENDOR_VERSION) return;
  await add2eCreateDefaultVendor();
}

class Add2eVendorApp extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "add2e-vendor-app-{id}",
    classes: ["add2e", "add2e-vendor-app"],
    tag: "section",
    window: { title: "Boutique ADD2E", resizable: true },
    position: { width: 920, height: 680 }
  };

  constructor({ vendor, buyer } = {}, options = {}) {
    super(options);
    this.vendor = vendor;
    this.buyer = buyer ?? add2eVendorGetBuyer({ excludeVendor: true, preferCharacter: true });
    this.activeFilter = "all";
  }

  get title() {
    return `${this.vendor?.name ?? "Boutique"}${this.buyer ? ` — ${this.buyer.name}` : ""}`;
  }

  async _prepareContext(_options = {}) {
    const items = Array.from(this.vendor?.items ?? [])
      .filter(add2eVendorIsStockItem)
      .sort((a, b) => String(a.name).localeCompare(String(b.name)))
      .map(item => {
        const price = add2eVendorResolvePrice(item);
        return {
          id: item.id,
          name: item.name,
          img: item.img,
          kind: add2eVendorStockKind(item),
          stock: add2eVendorQuantity(item),
          stockMax: add2eVendorStockMax(item),
          priceLabel: add2eVendorFormatMoney(price.copper),
          priceCopper: price.copper
        };
      });

    return {
      vendor: this.vendor,
      buyer: this.buyer,
      buyerMoney: this.buyer ? add2eVendorGetMoney(this.buyer) : add2eVendorMoneyFromObject({}),
      buyerMoneyLabel: this.buyer ? add2eVendorFormatMoney(add2eVendorGetMoney(this.buyer)) : "Gestion MJ",
      items,
      isGM: game.user?.isGM === true,
      activeFilter: this.activeFilter ?? "all"
    };
  }

  async _renderHTML(context, _options = {}) {
    const rows = context.items.map(item => {
      const hidden = context.activeFilter !== "all" && item.kind !== context.activeFilter;
      return `
      <tr data-item-id="${item.id}" style="${hidden ? "display:none;" : ""}border-bottom:1px solid #e0c982;">
        <td style="padding:6px 8px;min-width:260px;">
          <div style="display:flex;align-items:center;gap:8px;min-width:0;">
            <img src="${add2eVendorEscape(item.img)}" alt="${add2eVendorEscape(item.name)}" style="width:38px !important;height:38px !important;min-width:38px !important;max-width:38px !important;max-height:38px !important;object-fit:contain !important;border:1px solid #b98b2d;border-radius:6px;background:#f8edc7;">
            <span style="font-weight:900;color:#2f250c;white-space:normal;line-height:1.2;">${add2eVendorEscape(item.name)}</span>
          </div>
        </td>
        <td style="padding:6px 8px;color:#2f250c;font-weight:800;">${add2eVendorEscape(item.kind)}</td>
        <td style="padding:6px 8px;color:#2f250c;font-weight:900;">${add2eVendorEscape(item.priceLabel)}</td>
        <td style="padding:6px 8px;color:#2f250c;font-weight:800;">${item.stock} / ${item.stockMax}</td>
        <td style="padding:6px 8px;"><input class="add2e-vendor-buy-qty" type="number" min="1" value="1" style="width:58px !important;text-align:center;border:1px solid #b98b2d;border-radius:6px;background:#fffaf0;color:#2f250c;font-weight:900;"></td>
        <td style="padding:6px 8px;"><button type="button" class="add2e-vendor-buy" ${item.stock <= 0 || !context.buyer ? "disabled" : ""} style="border:1px solid #8d641b;border-radius:8px;background:linear-gradient(180deg,#7b4b16,#4b2b0b);color:#ffe7a8;font-weight:900;padding:5px 10px;">Acheter</button></td>
        ${context.isGM ? `<td style="padding:6px 8px;"><input class="add2e-vendor-stock-qty" type="number" min="0" value="${item.stock}" style="width:58px !important;text-align:center;border:1px solid #b98b2d;border-radius:6px;background:#fffaf0;color:#2f250c;font-weight:900;"><button type="button" class="add2e-vendor-stock-set" style="margin-left:6px;border:1px solid #8d641b;border-radius:8px;background:linear-gradient(180deg,#7b4b16,#4b2b0b);color:#ffe7a8;font-weight:900;padding:5px 10px;">Stock</button></td>` : ""}
      </tr>`;
    }).join("");

    const colCount = context.isGM ? 7 : 6;
    const activeStyle = "box-shadow:0 0 0 2px #f0c36a inset;filter:brightness(1.12);";
    const buttonStyle = "border:1px solid #8d641b;border-radius:8px;background:linear-gradient(180deg,#7b4b16,#4b2b0b);color:#ffe7a8;font-weight:900;padding:5px 10px;";
    const div = document.createElement("div");
    div.className = "add2e-vendor-root";
    div.style.cssText = "height:100%;max-height:100%;display:flex;flex-direction:column;overflow:hidden;background:linear-gradient(180deg,#fff8df,#ead39b);color:#2f250c;";
    div.innerHTML = `
      <header class="add2e-vendor-header" style="flex:0 0 auto;display:flex;justify-content:space-between;gap:12px;align-items:center;padding:12px 14px;border-bottom:1px solid #b98b2d;background:linear-gradient(180deg,#5a3511,#2f1b08);color:#ffe7a8;">
        <div>
          <h2 style="margin:0;color:#ffe7a8;font-weight:950;">${add2eVendorEscape(context.vendor?.name ?? "Boutique")}</h2>
          <p style="margin:4px 0 0;color:#fff2c2;">Acheteur : <strong>${add2eVendorEscape(context.buyer?.name ?? (context.isGM ? "gestion MJ" : "aucun personnage assigné"))}</strong></p>
        </div>
        <div class="add2e-vendor-money" style="padding:6px 10px;border:1px solid #d9bf73;border-radius:999px;background:#fff3c7;color:#3a2208;font-weight:950;white-space:nowrap;">${add2eVendorEscape(context.buyerMoneyLabel)}</div>
      </header>
      <div class="add2e-vendor-toolbar" style="flex:0 0 auto;display:flex;gap:8px;padding:10px 14px;border-bottom:1px solid #d9bf73;background:#f6e2ad;">
        <button type="button" class="add2e-vendor-filter ${context.activeFilter === "all" ? "active" : ""}" data-filter="all" style="${buttonStyle}${context.activeFilter === "all" ? activeStyle : ""}">Tous</button>
        <button type="button" class="add2e-vendor-filter ${context.activeFilter === "Composant" ? "active" : ""}" data-filter="Composant" style="${buttonStyle}${context.activeFilter === "Composant" ? activeStyle : ""}">Composants</button>
        <button type="button" class="add2e-vendor-filter ${context.activeFilter === "Projectile" ? "active" : ""}" data-filter="Projectile" style="${buttonStyle}${context.activeFilter === "Projectile" ? activeStyle : ""}">Projectiles</button>
        ${context.isGM ? `<button type="button" class="add2e-vendor-restock-all" style="margin-left:auto;${buttonStyle}">Tout réapprovisionner</button>` : ""}
      </div>
      <div class="add2e-vendor-table-wrap" style="flex:1 1 auto;min-height:0;overflow-y:auto !important;overflow-x:hidden;padding:12px 14px 16px;">
        <table class="add2e-vendor-table" style="width:100%;border-collapse:collapse;background:rgba(255,252,242,.94);border:1px solid #d9bf73;table-layout:auto;">
          <thead>
            <tr>
              <th style="position:sticky;top:0;z-index:2;background:#e8d08f;color:#2f250c;border-bottom:1px solid #b98b2d;padding:7px 8px;text-align:left;">Article</th>
              <th style="position:sticky;top:0;z-index:2;background:#e8d08f;color:#2f250c;border-bottom:1px solid #b98b2d;padding:7px 8px;text-align:left;">Type</th>
              <th style="position:sticky;top:0;z-index:2;background:#e8d08f;color:#2f250c;border-bottom:1px solid #b98b2d;padding:7px 8px;text-align:left;">Prix</th>
              <th style="position:sticky;top:0;z-index:2;background:#e8d08f;color:#2f250c;border-bottom:1px solid #b98b2d;padding:7px 8px;text-align:left;">Stock</th>
              <th style="position:sticky;top:0;z-index:2;background:#e8d08f;color:#2f250c;border-bottom:1px solid #b98b2d;padding:7px 8px;text-align:left;">Qté</th>
              <th style="position:sticky;top:0;z-index:2;background:#e8d08f;color:#2f250c;border-bottom:1px solid #b98b2d;padding:7px 8px;text-align:left;">Achat</th>
              ${context.isGM ? `<th style="position:sticky;top:0;z-index:2;background:#e8d08f;color:#2f250c;border-bottom:1px solid #b98b2d;padding:7px 8px;text-align:left;">MJ</th>` : ""}
            </tr>
          </thead>
          <tbody>${rows || `<tr><td colspan="${colCount}" style="padding:12px;color:#2f250c;">Aucun composant ou projectile en stock.</td></tr>`}</tbody>
        </table>
      </div>`;
    return div;
  }

  _replaceHTML(result, content, _options = {}) {
    content.style.overflow = "hidden";
    content.style.padding = "0";
    content.replaceChildren(result);
  }

  async _onRender(context, options = {}) {
    await super._onRender?.(context, options);
    const root = this.element?.querySelector?.(".add2e-vendor-root") ?? this.element;
    if (!root) return;

    const windowContent = this.element?.closest?.(".application")?.querySelector?.(".window-content") ?? this.element?.parentElement;
    if (windowContent) {
      windowContent.style.overflow = "hidden";
      windowContent.style.padding = "0";
      windowContent.style.background = "linear-gradient(180deg,#fff8df,#ead39b)";
    }

    root.querySelectorAll(".add2e-vendor-buy").forEach(button => {
      button.addEventListener("click", async ev => {
        const row = ev.currentTarget.closest("tr[data-item-id]");
        const item = this.vendor?.items?.get(row?.dataset?.itemId);
        const qty = row?.querySelector?.(".add2e-vendor-buy-qty")?.value ?? 1;
        const ok = await add2eVendorBuy({ vendor: this.vendor, buyer: this.buyer, item, quantity: qty });
        if (ok) this.render({ force: true });
      });
    });

    root.querySelectorAll(".add2e-vendor-stock-set").forEach(button => {
      button.addEventListener("click", async ev => {
        const row = ev.currentTarget.closest("tr[data-item-id]");
        const item = this.vendor?.items?.get(row?.dataset?.itemId);
        const qty = row?.querySelector?.(".add2e-vendor-stock-qty")?.value ?? 0;
        await add2eVendorSetStock(item, qty);
        this.render({ force: true });
      });
    });

    root.querySelector(".add2e-vendor-restock-all")?.addEventListener("click", async () => {
      await add2eVendorRestockAll(this.vendor);
      this.render({ force: true });
    });

    root.querySelectorAll(".add2e-vendor-filter").forEach(button => {
      button.addEventListener("click", ev => {
        const filter = ev.currentTarget.dataset.filter;
        this.activeFilter = filter;
        root.querySelectorAll(".add2e-vendor-filter").forEach(b => {
          const active = b === ev.currentTarget;
          b.classList.toggle("active", active);
          b.style.boxShadow = active ? "0 0 0 2px #f0c36a inset" : "";
          b.style.filter = active ? "brightness(1.12)" : "";
        });
        root.querySelectorAll("tbody tr[data-item-id]").forEach(row => {
          const kind = row.children?.[1]?.textContent?.trim() ?? "";
          row.style.display = filter === "all" || kind === filter ? "" : "none";
        });
      });
    });
  }
}

export async function add2eOpenVendor({ vendor = null, buyer = null } = {}) {
  vendor = vendor ?? add2eFindDefaultVendor();
  if (!vendor) vendor = await add2eCreateDefaultVendor();
  if (!vendor) return null;
  buyer = buyer ?? add2eVendorGetBuyer({ excludeVendor: true, preferCharacter: true });
  if (!buyer && !game.user?.isGM) {
    await add2eVendorAlert("Aucun acheteur", "Aucun personnage joueur n’est assigné ou sélectionné pour acheter chez ce vendeur.");
    return null;
  }
  const app = new Add2eVendorApp({ vendor, buyer });
  app.render({ force: true });
  return app;
}

async function add2eOpenVendorFromToken(token, { singleClick = false } = {}) {
  const vendor = token?.actor ?? null;
  if (!add2eIsVendorActor(vendor)) return false;

  const now = Date.now();
  const key = `${vendor.id}:${game.user?.id ?? "user"}`;
  const last = globalThis.__ADD2E_VENDOR_LAST_OPEN ?? {};
  if (last[key] && now - last[key] < 650) return true;
  last[key] = now;
  globalThis.__ADD2E_VENDOR_LAST_OPEN = last;

  const buyer = add2eVendorGetBuyer({ excludeVendor: true, preferCharacter: true });
  await add2eOpenVendor({ vendor, buyer });
  return true;
}

function add2eBindVendorToken(token) {
  if (!token || token.__add2eVendorBoundV9) return;
  if (!add2eIsVendorActor(token.actor)) return;
  token.__add2eVendorBoundV9 = true;
  try { token.cursor = "pointer"; } catch (_err) {}
  try { token.eventMode = "static"; } catch (_err) {}
  try { token.interactive = true; } catch (_err) {}

  const handler = ev => {
    try {
      ev?.stopPropagation?.();
      add2eOpenVendorFromToken(token, { singleClick: true });
    } catch (err) {
      console.warn("[ADD2E][VENDOR][TOKEN_POINTER]", err);
    }
  };

  try { token.on?.("pointertap", handler); } catch (_err) {}
  try { token.on?.("click", handler); } catch (_err) {}
}

function add2eBindAllVendorTokens() {
  for (const token of canvas?.tokens?.placeables ?? []) add2eBindVendorToken(token);
}

function add2ePatchVendorTokenClick() {
  if (globalThis.__ADD2E_VENDOR_TOKEN_CLICK_PATCHED_V9) return;
  globalThis.__ADD2E_VENDOR_TOKEN_CLICK_PATCHED_V9 = true;

  const TokenClass = globalThis.Token ?? foundry?.canvas?.placeables?.Token;
  const proto = TokenClass?.prototype;
  if (proto && typeof proto._onClickLeft === "function") {
    const original = proto._onClickLeft;
    proto._onClickLeft = function add2eVendorOnClickLeft(event) {
      try {
        if (add2eIsVendorActor(this.actor)) {
          add2eOpenVendorFromToken(this, { singleClick: true });
          return;
        }
      } catch (err) {
        console.warn("[ADD2E][VENDOR][TOKEN_CLICK]", err);
      }
      return original.call(this, event);
    };
  }

  if (proto && typeof proto._onClickLeft2 === "function") {
    const original2 = proto._onClickLeft2;
    proto._onClickLeft2 = function add2eVendorOnClickLeft2(event) {
      try {
        if (add2eIsVendorActor(this.actor)) {
          add2eOpenVendorFromToken(this, { singleClick: false });
          return;
        }
      } catch (err) {
        console.warn("[ADD2E][VENDOR][TOKEN_DOUBLE_CLICK]", err);
      }
      return original2.call(this, event);
    };
  }

  Hooks.on("canvasReady", add2eBindAllVendorTokens);
  Hooks.on("createToken", () => window.setTimeout(add2eBindAllVendorTokens, 100));
  Hooks.on("updateToken", () => window.setTimeout(add2eBindAllVendorTokens, 100));
  Hooks.on("controlToken", (token, controlled) => {
    if (controlled && add2eIsVendorActor(token?.actor)) add2eOpenVendorFromToken(token, { singleClick: true });
  });
  Hooks.on("targetToken", (user, token, targeted) => {
    if (user?.id === game.user?.id && targeted && add2eIsVendorActor(token?.actor)) add2eOpenVendorFromToken(token, { singleClick: true });
  });
}

function add2ePatchActorSheetMoney() {
  const proto = globalThis.Add2eActorSheet?.prototype;
  if (!proto || proto.__add2eVendorMoneySheetV9) return;
  proto.__add2eVendorMoneySheetV9 = true;

  if (typeof proto.getData === "function") {
    const originalGetData = proto.getData;
    proto.getData = async function add2eVendorMoneyGetData(...args) {
      const data = await originalGetData.apply(this, args);
      try {
        const money = add2eVendorGetMoney(this.actor);
        data.add2eVendorMoney = money;
        data.add2eVendorMoneyLabel = add2eVendorFormatMoney(money);
      } catch (err) {
        console.warn("[ADD2E][VENDOR][SHEET_MONEY_GETDATA]", err);
        data.add2eVendorMoney = add2eVendorMoneyFromObject({});
        data.add2eVendorMoneyLabel = "0 PC";
      }
      return data;
    };
  }

  if (typeof proto.activateListeners === "function") {
    const originalActivateListeners = proto.activateListeners;
    proto.activateListeners = function add2eVendorMoneyActivateListeners(html) {
      originalActivateListeners.call(this, html);
      const sheet = this;
      const jq = html?.jquery ? html : $(html);
      jq.find(".add2e-money-input").off("change.add2eVendorMoney").on("change.add2eVendorMoney", async ev => {
        ev.preventDefault();
        const money = add2eVendorGetMoney(sheet.actor);
        const coin = ev.currentTarget.dataset.coin;
        if (!ADD2E_COINS.some(c => c.key === coin)) return;
        money[coin] = Math.max(0, Math.floor(add2eVendorNumber(ev.currentTarget.value, 0)));
        await add2eVendorSetMoney(sheet.actor, money);
        sheet.render(false);
      });
    };
  }
}

function add2eRegisterVendorSockets() {
  if (globalThis.__ADD2E_VENDOR_SOCKET_REGISTERED_V9) return;
  globalThis.__ADD2E_VENDOR_SOCKET_REGISTERED_V9 = true;

  game.socket?.on?.("system.add2e", async data => {
    if (!data || typeof data !== "object") return;

    if (data.type === "ADD2E_VENDOR_BUY_RESULT") {
      if (data.userId !== game.user?.id) return;
      if (data.ok) ui.notifications?.info?.(data.message ?? "Achat effectué.");
      else ui.notifications?.warn?.(data.message ?? "Achat impossible.");
      return;
    }

    if (data.type !== "ADD2E_VENDOR_BUY_REQUEST") return;
    if (!add2eVendorIsResponsibleGM()) return;

    const vendor = game.actors?.get(data.vendorId) ?? null;
    const buyer = game.actors?.get(data.buyerId) ?? null;
    const item = vendor?.items?.get(data.itemId) ?? null;
    let result = { ok: false, message: "Achat impossible." };

    try {
      result = await add2eVendorBuyLocal({ vendor, buyer, item, quantity: data.quantity }, { confirm: false, notify: false });
    } catch (err) {
      console.warn("[ADD2E][VENDOR][SOCKET_BUY_ERROR]", err);
      result = { ok: false, message: err?.message || "Erreur pendant l'achat." };
    }

    game.socket?.emit?.("system.add2e", {
      type: "ADD2E_VENDOR_BUY_RESULT",
      requestId: data.requestId,
      userId: data.userId,
      ok: !!result.ok,
      message: result.message
    });
  });
}

function add2eRegisterVendorHooks() {
  Hooks.on("renderActorDirectory", (_app, html) => {
    if (!game.user?.isGM) return;
    const root = html?.jquery ? html[0] : html;
    if (!root?.querySelector) return;
    if (root.querySelector(".add2e-open-default-vendor")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "add2e-open-default-vendor";
    button.innerHTML = `<i class="fas fa-coins"></i> Boutique composants/projectiles`;
    button.addEventListener("click", () => add2eOpenVendor());
    root.querySelector(".directory-footer")?.prepend(button);
  });
}

Hooks.once("init", () => {
  game.settings.register("add2e", ADD2E_VENDOR_CREATION_SETTING, {
    name: "ADD2E — Création du vendeur système",
    hint: "Version du vendeur de composants et projectiles créé automatiquement.",
    scope: "world",
    config: false,
    type: String,
    default: ""
  });
  add2eRegisterVendorHooks();
});

Hooks.once("ready", async () => {
  game.add2e = game.add2e ?? {};
  game.add2e.vendorVersion = ADD2E_VENDOR_VERSION;
  game.add2e.openVendor = add2eOpenVendor;
  game.add2e.createDefaultVendor = add2eCreateDefaultVendor;
  game.add2e.findDefaultVendor = add2eFindDefaultVendor;
  game.add2e.updateVendorTokenSize = add2eUpdateVendorTokenSize;
  game.add2e.vendorMoney = {
    coins: ADD2E_COINS,
    get: add2eVendorGetMoney,
    set: add2eVendorSetMoney,
    format: add2eVendorFormatMoney,
    toCopper: add2eVendorMoneyToCopper,
    fromCopper: add2eVendorCopperToMoney
  };
  globalThis.add2eOpenVendor = add2eOpenVendor;
  globalThis.add2eCreateDefaultVendor = add2eCreateDefaultVendor;
  globalThis.add2eVendorMoney = game.add2e.vendorMoney;
  await add2eEnsureVendorOnFirstWorldLaunch().catch(err => console.warn("[ADD2E][VENDOR][AUTO_CREATE]", err));
  await add2eUpdateVendorTokenSize().catch(err => console.warn("[ADD2E][VENDOR][TOKEN_SIZE]", err));
  add2eRegisterVendorSockets();
  add2ePatchActorSheetMoney();
  add2ePatchVendorTokenClick();
  window.setTimeout(add2eBindAllVendorTokens, 500);
  add2eVendorLog("ready", ADD2E_VENDOR_VERSION);
});
