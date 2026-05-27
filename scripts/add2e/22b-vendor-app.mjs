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
          img: item.img,
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
        <td class="add2e-vendor-item"><img src="${esc(item.img)}" alt=""><span>${esc(item.name)}</span></td>
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
