// ADD2E — Vendeur système : composants, projectiles et monnaie complète
// ApplicationV2 + DialogV2, création automatique au premier lancement du monde.

const ADD2E_VENDOR_VERSION = "2026-05-26-vendor-v1";
globalThis.ADD2E_VENDOR_VERSION = ADD2E_VENDOR_VERSION;

const ADD2E_VENDOR_FLAG_SCOPE = "add2e";
const ADD2E_VENDOR_NAME = "Marchand de composants et projectiles";
const ADD2E_VENDOR_CREATION_SETTING = "vendorCreationVersion";

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

function add2eVendorQuantity(item) {
  return Math.max(0, add2eVendorNumber(item?.system?.quantite ?? item?.system?.quantity ?? 0, 0));
}

function add2eVendorSetQuantityPath(value) {
  return { "system.quantite": Math.max(0, Math.floor(add2eVendorNumber(value, 0))) };
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

function add2eVendorIsStockItem(item) {
  return item?.type === "objet" && (add2eVendorIsSpellComponent(item) || add2eVendorIsAmmunition(item));
}

function add2eVendorStockKind(item) {
  if (add2eVendorIsSpellComponent(item)) return "Composant";
  if (add2eVendorIsAmmunition(item)) return "Projectile";
  return "Objet";
}

function add2eVendorDefaultStock(item) {
  const name = String(item?.name ?? "").toLowerCase();
  const magical = /\+\d|magique|argent|special|spécial|tueur|venin|poison/.test(name) || add2eVendorTags(item).some(t => /magique|special|spécial/i.test(String(t)));
  if (add2eVendorIsAmmunition(item)) return magical ? 10 : 40;
  if (add2eVendorIsSpellComponent(item)) return magical ? 5 : 20;
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

function add2eVendorGetBuyer() {
  const controlled = canvas?.tokens?.controlled?.[0]?.actor ?? null;
  if (controlled?.isOwner || game.user?.isGM) return controlled;
  const character = game.user?.character ?? null;
  if (character?.isOwner || game.user?.isGM) return character;
  return null;
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

async function add2eVendorBuy({ vendor, buyer, item, quantity }) {
  if (!vendor || !buyer || !item) return false;
  quantity = Math.max(1, Math.floor(add2eVendorNumber(quantity, 1)));
  const stock = add2eVendorQuantity(item);
  if (stock < quantity) {
    await add2eVendorAlert("Stock insuffisant", `${item.name} : stock disponible ${stock}.`);
    return false;
  }

  const price = add2eVendorResolvePrice(item);
  const total = price.copper * quantity;
  const buyerMoney = add2eVendorGetMoney(buyer);
  if (add2eVendorMoneyToCopper(buyerMoney) < total) {
    await add2eVendorAlert("Argent insuffisant", `${buyer.name} n’a pas assez d’argent. Prix : ${add2eVendorFormatMoney(total)}.`);
    return false;
  }

  const confirmed = await add2eVendorDialog({
    title: "Confirmer l’achat",
    content: `<div class="add2e-dialog add2e-vendor-alert"><h3>${add2eVendorEscape(item.name)}</h3><p>Acheter ${quantity} unité(s) pour <strong>${add2eVendorFormatMoney(total)}</strong> ?</p></div>`,
    yes: "Acheter",
    no: "Annuler"
  });
  if (!confirmed) return false;

  const paid = await add2eVendorSubtractMoney(buyer, total);
  if (!paid) return false;
  await item.update(add2eVendorSetQuantityPath(stock - quantity), { add2eReason: "vendor-stock-decrease" });
  await add2eVendorMergeOrCreateItem(buyer, item, quantity);
  ui.notifications?.info?.(`${buyer.name} achète ${quantity} × ${item.name} pour ${add2eVendorFormatMoney(total)}.`);
  return true;
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
  const packIds = ["add2e.equipements", "add2e.objets-magiques", "world.equipements", "world.objets-magiques"];
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
  return Array.from(game.actors ?? []).find(actor => actor.getFlag?.(ADD2E_VENDOR_FLAG_SCOPE, "isVendor") === true)
    ?? game.actors?.find?.(a => a.name === ADD2E_VENDOR_NAME)
    ?? null;
}

export async function add2eCreateDefaultVendor({ force = false } = {}) {
  if (!game.user?.isGM) return null;
  const existing = add2eFindDefaultVendor();
  if (existing && !force) return existing;

  const stock = await add2eVendorBuildStockData();
  const actor = await Actor.create({
    name: ADD2E_VENDOR_NAME,
    type: "personnage",
    img: "icons/containers/bags/pouch-leather-gold-brown.webp",
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
  if (existing) return;
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
    position: { width: 860, height: 680 }
  };

  constructor({ vendor, buyer } = {}, options = {}) {
    super(options);
    this.vendor = vendor;
    this.buyer = buyer ?? add2eVendorGetBuyer();
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
      buyerMoneyLabel: this.buyer ? add2eVendorFormatMoney(add2eVendorGetMoney(this.buyer)) : "Aucun acheteur sélectionné",
      items,
      isGM: game.user?.isGM === true
    };
  }

  async _renderHTML(context, _options = {}) {
    const rows = context.items.map(item => `
      <tr data-item-id="${item.id}">
        <td class="add2e-vendor-item">
          <img src="${add2eVendorEscape(item.img)}" alt="${add2eVendorEscape(item.name)}">
          <span>${add2eVendorEscape(item.name)}</span>
        </td>
        <td>${add2eVendorEscape(item.kind)}</td>
        <td>${add2eVendorEscape(item.priceLabel)}</td>
        <td>${item.stock} / ${item.stockMax}</td>
        <td><input class="add2e-vendor-buy-qty" type="number" min="1" value="1"></td>
        <td><button type="button" class="add2e-vendor-buy" ${item.stock <= 0 || !context.buyer ? "disabled" : ""}>Acheter</button></td>
        ${context.isGM ? `<td class="add2e-vendor-stock-cell"><input class="add2e-vendor-stock-qty" type="number" min="0" value="${item.stock}"><button type="button" class="add2e-vendor-stock-set">Stock</button></td>` : ""}
      </tr>`).join("");

    const div = document.createElement("div");
    div.className = "add2e-vendor-root";
    div.innerHTML = `
      <header class="add2e-vendor-header">
        <div>
          <h2>${add2eVendorEscape(context.vendor?.name ?? "Boutique")}</h2>
          <p>Acheteur : <strong>${add2eVendorEscape(context.buyer?.name ?? "aucun")}</strong></p>
        </div>
        <div class="add2e-vendor-money">${add2eVendorEscape(context.buyerMoneyLabel)}</div>
      </header>
      <div class="add2e-vendor-toolbar">
        <button type="button" class="add2e-vendor-filter active" data-filter="all">Tous</button>
        <button type="button" class="add2e-vendor-filter" data-filter="Composant">Composants</button>
        <button type="button" class="add2e-vendor-filter" data-filter="Projectile">Projectiles</button>
        ${context.isGM ? `<button type="button" class="add2e-vendor-restock-all">Tout réapprovisionner</button>` : ""}
      </div>
      <table class="add2e-vendor-table">
        <thead><tr><th>Article</th><th>Type</th><th>Prix</th><th>Stock</th><th>Qté</th><th>Achat</th>${context.isGM ? "<th>MJ</th>" : ""}</tr></thead>
        <tbody>${rows || `<tr><td colspan="${context.isGM ? 7 : 6}">Aucun composant ou projectile en stock.</td></tr>`}</tbody>
      </table>`;
    return div;
  }

  _replaceHTML(result, content, _options = {}) {
    content.replaceChildren(result);
  }

  async _onRender(context, options = {}) {
    await super._onRender?.(context, options);
    const root = this.element?.querySelector?.(".add2e-vendor-root") ?? this.element;
    if (!root) return;

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
        root.querySelectorAll(".add2e-vendor-filter").forEach(b => b.classList.toggle("active", b === ev.currentTarget));
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
  buyer = buyer ?? add2eVendorGetBuyer();
  const app = new Add2eVendorApp({ vendor, buyer });
  app.render({ force: true });
  return app;
}

function add2eRegisterVendorHooks() {
  Hooks.on("getActorSheetHeaderButtons", (app, buttons) => {
    const actor = app?.actor ?? app?.document ?? app?.object;
    if (!actor?.getFlag || actor.getFlag(ADD2E_VENDOR_FLAG_SCOPE, "isVendor") !== true) return;
    buttons.unshift({
      label: "Boutique",
      class: "add2e-vendor-open",
      icon: "fas fa-coins",
      onclick: () => add2eOpenVendor({ vendor: actor })
    });
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
  add2eVendorLog("ready", ADD2E_VENDOR_VERSION);
});
