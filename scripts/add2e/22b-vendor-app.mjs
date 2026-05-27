// ADD2E — ApplicationV2 vendeur : onglets, recherche, achats et stock MJ.
import {
  VENDOR_NAME,
  TOKEN_IMG,
  ADD2E_VENDOR_VERSION,
  isVendorActor,
  findVendor,
  createVendor,
  getBuyer,
  vendorKind,
  isStockItem,
  quantity,
  stockMax,
  priceCopper,
  formatMoney,
  getMoney,
  buy,
  setStock,
  restockAll,
  alertBox,
  esc,
  lower
} from "./22a-vendor-core.mjs";

const ADD2E_VENDOR_STYLE = `
  .add2e-vendor-root {
    height: 100%;
    max-height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: linear-gradient(180deg, #fff8df 0%, #ead39b 100%);
    color: #2f250c;
    font-family: var(--font-primary, serif);
  }
  .add2e-vendor-root * { box-sizing: border-box; }
  .add2e-vendor-header {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 14px;
    border-bottom: 1px solid #b98b2d;
    background: linear-gradient(180deg, #5a3511 0%, #2f1b08 100%);
    color: #ffe7a8;
  }
  .add2e-vendor-header h2 {
    margin: 0;
    color: #ffe7a8;
    font-weight: 950;
    line-height: 1.1;
    text-shadow: 0 1px 2px #000;
  }
  .add2e-vendor-header p {
    margin: 4px 0 0;
    color: #fff2c2;
  }
  .add2e-vendor-money {
    padding: 6px 10px;
    border: 1px solid #d9bf73;
    border-radius: 999px;
    background: #fff3c7;
    color: #3a2208;
    font-weight: 950;
    white-space: nowrap;
    box-shadow: inset 0 0 0 1px rgba(255,255,255,.35);
  }
  .add2e-vendor-tabs {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    border-bottom: 1px solid #d9bf73;
    background: #f6e2ad;
  }
  .add2e-vendor-tabs button,
  .add2e-vendor-buy,
  .add2e-vendor-stock-set {
    border: 1px solid #8d641b;
    border-radius: 8px;
    background: linear-gradient(180deg, #7b4b16 0%, #4b2b0b 100%);
    color: #ffe7a8;
    font-weight: 900;
    padding: 5px 10px;
    line-height: 1.2;
    min-height: 28px;
    cursor: pointer;
  }
  .add2e-vendor-tabs button.active {
    box-shadow: 0 0 0 2px #f0c36a inset;
    filter: brightness(1.12);
  }
  .add2e-vendor-tabs button:disabled,
  .add2e-vendor-buy:disabled {
    opacity: .45;
    cursor: not-allowed;
  }
  .add2e-vendor-restock-all { margin-left: auto; }
  .add2e-vendor-search {
    flex: 0 0 auto;
    padding: 10px 14px;
    border-bottom: 1px solid #d9bf73;
    background: #fff1bf;
  }
  .add2e-vendor-search-input {
    width: 100%;
    min-height: 30px;
    padding: 5px 9px;
    border: 1px solid #b98b2d;
    border-radius: 8px;
    background: #fffaf0;
    color: #2f250c;
    font-weight: 700;
  }
  .add2e-vendor-table-wrap {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto !important;
    overflow-x: hidden;
    padding: 12px 14px 16px;
  }
  .add2e-vendor-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: auto;
    background: rgba(255,252,242,.94);
    border: 1px solid #d9bf73;
    color: #2f250c;
  }
  .add2e-vendor-table th {
    position: sticky;
    top: 0;
    z-index: 2;
    background: #e8d08f;
    color: #2f250c;
    border-bottom: 1px solid #b98b2d;
    padding: 7px 8px;
    text-align: left;
    font-weight: 950;
  }
  .add2e-vendor-table td {
    padding: 6px 8px;
    border-bottom: 1px solid #e0c982;
    vertical-align: middle;
    color: #2f250c;
    font-weight: 750;
  }
  .add2e-vendor-table tbody tr:nth-child(even) { background: rgba(242, 222, 169, .35); }
  .add2e-vendor-table tbody tr:hover { background: rgba(255, 231, 168, .7); }
  .add2e-vendor-item {
    min-width: 260px;
  }
  .add2e-vendor-item-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
  .add2e-vendor-item img {
    width: 38px !important;
    height: 38px !important;
    min-width: 38px !important;
    max-width: 38px !important;
    max-height: 38px !important;
    object-fit: contain !important;
    border: 1px solid #b98b2d;
    border-radius: 6px;
    background: #f8edc7;
  }
  .add2e-vendor-item span {
    font-weight: 950;
    color: #2f250c;
    white-space: normal;
    line-height: 1.2;
  }
  .add2e-vendor-buy-qty,
  .add2e-vendor-stock-qty {
    width: 58px !important;
    min-width: 58px !important;
    max-width: 58px !important;
    text-align: center;
    border: 1px solid #b98b2d;
    border-radius: 6px;
    background: #fffaf0;
    color: #2f250c;
    font-weight: 900;
    min-height: 28px;
  }
  .add2e-vendor-stock-set { margin-left: 6px; }
`;

class Add2eVendorApp extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "add2e-vendor-app-{id}",
    classes: ["add2e", "add2e-vendor-app"],
    tag: "section",
    window: { title: "Boutique ADD2E", resizable: true },
    position: { width: 960, height: 700 }
  };

  constructor({ vendor, buyer } = {}, options = {}) {
    super(options);
    this.vendor = vendor;
    this.buyer = buyer ?? getBuyer();
    this.activeTab = "all";
    this.searchText = "";
  }

  get title() {
    return `${this.vendor?.name ?? "Boutique"}${this.buyer ? ` — ${this.buyer.name}` : ""}`;
  }

  async _prepareContext() {
    const items = Array.from(this.vendor?.items ?? [])
      .filter(isStockItem)
      .sort((a, b) => String(a.name).localeCompare(String(b.name)))
      .map(item => {
        const kind = vendorKind(item);
        const tab = kind === "Composant" ? "components" : kind === "Projectile" ? "projectiles" : "equipment";
        return {
          id: item.id,
          name: item.name,
          img: item.img || "icons/svg/item-bag.svg",
          kind,
          tab,
          stock: quantity(item),
          stockMax: stockMax(item),
          priceLabel: formatMoney(priceCopper(item)),
          search: lower(`${item.name} ${kind} ${item.system?.categorie ?? ""} ${item.system?.sousType ?? ""} ${item.system?.sous_type ?? ""}`)
        };
      });
    return {
      vendor: this.vendor,
      buyer: this.buyer,
      buyerMoneyLabel: this.buyer ? formatMoney(getMoney(this.buyer)) : "Gestion MJ",
      items,
      isGM: game.user?.isGM === true,
      activeTab: this.activeTab,
      searchText: this.searchText
    };
  }

  async _renderHTML(context) {
    const tabButton = (tab, label) => `<button type="button" data-tab="${tab}" class="${context.activeTab === tab ? "active" : ""}">${label}</button>`;
    const q = lower(context.searchText);
    const rows = context.items.map(item => {
      const hidden = (context.activeTab !== "all" && context.activeTab !== item.tab) || (q && !item.search.includes(q));
      return `<tr data-item-id="${item.id}" data-tab="${item.tab}" data-search="${esc(item.search)}" style="${hidden ? "display:none;" : ""}">
        <td class="add2e-vendor-item"><div class="add2e-vendor-item-wrap"><img src="${esc(item.img)}" alt=""><span>${esc(item.name)}</span></div></td>
        <td>${esc(item.kind)}</td>
        <td>${esc(item.priceLabel)}</td>
        <td>${item.stock} / ${item.stockMax}</td>
        <td><input class="add2e-vendor-buy-qty" type="number" min="1" value="1"></td>
        <td><button type="button" class="add2e-vendor-buy" ${item.stock <= 0 || !context.buyer ? "disabled" : ""}>Acheter</button></td>
        ${context.isGM ? `<td><input class="add2e-vendor-stock-qty" type="number" min="0" value="${item.stock}"><button type="button" class="add2e-vendor-stock-set">Stock</button></td>` : ""}
      </tr>`;
    }).join("");
    const colCount = context.isGM ? 7 : 6;
    const div = document.createElement("div");
    div.className = "add2e-vendor-root";
    div.innerHTML = `
      <style>${ADD2E_VENDOR_STYLE}</style>
      <header class="add2e-vendor-header">
        <div><h2>${esc(context.vendor?.name ?? "Boutique")}</h2><p>Acheteur : <strong>${esc(context.buyer?.name ?? (context.isGM ? "gestion MJ" : "aucun personnage assigné"))}</strong></p></div>
        <div class="add2e-vendor-money">${esc(context.buyerMoneyLabel)}</div>
      </header>
      <nav class="add2e-vendor-tabs">
        ${tabButton("all", "Tous")}
        ${tabButton("components", "Composants")}
        ${tabButton("projectiles", "Projectiles")}
        ${tabButton("equipment", "Équipements")}
        ${context.isGM ? `<button type="button" class="add2e-vendor-restock-all">Tout réapprovisionner</button>` : ""}
      </nav>
      <div class="add2e-vendor-search"><input type="search" class="add2e-vendor-search-input" placeholder="Rechercher un article..." value="${esc(context.searchText)}"></div>
      <div class="add2e-vendor-table-wrap">
        <table class="add2e-vendor-table">
          <thead><tr><th>Article</th><th>Onglet</th><th>Prix</th><th>Stock</th><th>Qté</th><th>Achat</th>${context.isGM ? `<th>MJ</th>` : ""}</tr></thead>
          <tbody>${rows || `<tr><td colspan="${colCount}">Aucun article en stock.</td></tr>`}</tbody>
        </table>
      </div>`;
    return div;
  }

  _replaceHTML(result, content) {
    content.style.overflow = "hidden";
    content.style.padding = "0";
    content.style.background = "linear-gradient(180deg, #fff8df 0%, #ead39b 100%)";
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
      windowContent.style.background = "linear-gradient(180deg, #fff8df 0%, #ead39b 100%)";
    }

    root.querySelectorAll(".add2e-vendor-tabs button[data-tab]").forEach(button => {
      button.addEventListener("click", ev => {
        this.activeTab = ev.currentTarget.dataset.tab || "all";
        this._applyFilters(root);
      });
    });
    root.querySelector(".add2e-vendor-search-input")?.addEventListener("input", ev => {
      this.searchText = ev.currentTarget.value ?? "";
      this._applyFilters(root);
    });
    root.querySelectorAll(".add2e-vendor-buy").forEach(button => {
      button.addEventListener("click", async ev => {
        const row = ev.currentTarget.closest("tr[data-item-id]");
        const item = this.vendor?.items?.get(row?.dataset?.itemId);
        const qty = row?.querySelector?.(".add2e-vendor-buy-qty")?.value ?? 1;
        const ok = await buy({ vendor: this.vendor, buyer: this.buyer, item, quantity: qty });
        if (ok) this.render({ force: true });
      });
    });
    root.querySelectorAll(".add2e-vendor-stock-set").forEach(button => {
      button.addEventListener("click", async ev => {
        const row = ev.currentTarget.closest("tr[data-item-id]");
        const item = this.vendor?.items?.get(row?.dataset?.itemId);
        const qty = row?.querySelector?.(".add2e-vendor-stock-qty")?.value ?? 0;
        await setStock(item, qty);
        this.render({ force: true });
      });
    });
    root.querySelector(".add2e-vendor-restock-all")?.addEventListener("click", async () => {
      await restockAll(this.vendor);
      this.render({ force: true });
    });
    this._applyFilters(root);
  }

  _applyFilters(root) {
    const q = lower(this.searchText);
    root.querySelectorAll(".add2e-vendor-tabs button[data-tab]").forEach(btn => btn.classList.toggle("active", btn.dataset.tab === this.activeTab));
    root.querySelectorAll("tbody tr[data-item-id]").forEach(row => {
      const tabOk = this.activeTab === "all" || row.dataset.tab === this.activeTab;
      const searchOk = !q || lower(row.dataset.search).includes(q);
      row.style.display = tabOk && searchOk ? "" : "none";
    });
  }
}

export async function openVendor({ vendor = null, buyer = null } = {}) {
  vendor = vendor ?? findVendor();
  if (!vendor) vendor = await createVendor();
  if (!vendor) return null;
  buyer = buyer ?? getBuyer();
  if (!buyer && !game.user?.isGM) {
    await alertBox("Aucun acheteur", "Aucun personnage joueur n’est assigné ou sélectionné pour acheter chez ce vendeur.");
    return null;
  }
  const app = new Add2eVendorApp({ vendor, buyer });
  app.render({ force: true });
  return app;
}

async function openVendorFromToken(token) {
  const vendor = token?.actor ?? null;
  if (!isVendorActor(vendor)) return false;
  const now = Date.now();
  const key = `${vendor.id}:${game.user?.id ?? "user"}`;
  const last = globalThis.__ADD2E_VENDOR_LAST_OPEN ?? {};
  if (last[key] && now - last[key] < 650) return true;
  last[key] = now;
  globalThis.__ADD2E_VENDOR_LAST_OPEN = last;
  await openVendor({ vendor, buyer: getBuyer() });
  return true;
}

function bindVendorToken(token) {
  if (!token || token.__add2eVendorBoundV15) return;
  if (!isVendorActor(token.actor)) return;
  token.__add2eVendorBoundV15 = true;
  try { token.cursor = "pointer"; } catch (_err) {}
  try { token.eventMode = "static"; } catch (_err) {}
  try { token.interactive = true; } catch (_err) {}
  const handler = () => window.setTimeout(() => openVendorFromToken(token), 0);
  try { token.on?.("pointertap", handler); } catch (_err) {}
  try { token.on?.("click", handler); } catch (_err) {}
}

export function bindAllVendorTokens() {
  for (const token of canvas?.tokens?.placeables ?? []) bindVendorToken(token);
}

export function patchVendorTokenClick() {
  if (globalThis.__ADD2E_VENDOR_TOKEN_CLICK_PATCHED_V15) return;
  globalThis.__ADD2E_VENDOR_TOKEN_CLICK_PATCHED_V15 = true;
  const TokenClass = foundry?.canvas?.placeables?.Token ?? CONFIG?.Token?.objectClass ?? globalThis.Token;
  const proto = TokenClass?.prototype;
  if (proto && typeof proto._onClickLeft === "function") {
    const original = proto._onClickLeft;
    proto._onClickLeft = function add2eVendorOnClickLeft(event) {
      const result = original.call(this, event);
      try { if (isVendorActor(this.actor)) window.setTimeout(() => openVendorFromToken(this), 0); }
      catch (err) { console.warn("[ADD2E][VENDOR][TOKEN_CLICK]", err); }
      return result;
    };
  }
  Hooks.on("canvasReady", bindAllVendorTokens);
  Hooks.on("createToken", () => window.setTimeout(bindAllVendorTokens, 100));
  Hooks.on("updateToken", () => window.setTimeout(bindAllVendorTokens, 100));
  Hooks.on("controlToken", (token, controlled) => { if (controlled && isVendorActor(token?.actor)) window.setTimeout(() => openVendorFromToken(token), 0); });
}

export function registerVendorDirectoryButton() {
  Hooks.on("renderActorDirectory", (_app, html) => {
    if (!game.user?.isGM) return;
    const root = html?.jquery ? html[0] : html;
    if (!root?.querySelector || root.querySelector(".add2e-open-default-vendor")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "add2e-open-default-vendor";
    button.innerHTML = `<i class="fas fa-coins"></i> Boutique composants/projectiles`;
    button.addEventListener("click", () => openVendor());
    root.querySelector(".directory-footer")?.prepend(button);
  });
}

export function registerUiGlobals() {
  game.add2e = game.add2e ?? {};
  game.add2e.openVendor = openVendor;
  globalThis.add2eOpenVendor = openVendor;
  globalThis.ADD2E_VENDOR_VERSION = ADD2E_VENDOR_VERSION;
}
