// ADD2E — ApplicationV2 armurier : armes, armures, projectiles, achat, affectation MJ et compatibilité acteur.

import {
  ADD2E_ARMORER_VERSION,
  isArmorerActor,
  findArmorer,
  createArmorer,
  getBuyer,
  armorerKind,
  quantity,
  priceCopper,
  formatMoney,
  getMoney,
  buy,
  setStock,
  restockAll,
  usabilityForActor,
  getArmorerDisplayItems,
  assignItemToToken,
  sceneTokenChoices,
  alertBox,
  esc,
  lower
} from "./22c-armorer-core.mjs";

const ADD2E_ARMORER_APP_VERSION = "2026-07-01-armorer-app-v7-vendor-ui-alignment";

const ADD2E_ARMORER_STYLE = `
  .add2e-armorer-root{height:100%;max-height:100%;display:flex;flex-direction:column;overflow:hidden;background:linear-gradient(180deg,#fff8df,#ead39b);color:#2f250c;font-family:var(--font-primary,serif)}
  .add2e-armorer-root *{box-sizing:border-box}.add2e-armorer-header{flex:0 0 auto;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border-bottom:1px solid #b98b2d;background:linear-gradient(180deg,#5a3511,#2f1b08);color:#ffe7a8}.add2e-armorer-header h2{margin:0;color:#ffe7a8;font-weight:950;line-height:1.1;text-shadow:0 1px 2px #000}.add2e-armorer-header p{margin:4px 0 0;color:#fff2c2}.add2e-armorer-money{padding:6px 10px;border:1px solid #d9bf73;border-radius:999px;background:#fff3c7;color:#3a2208;font-weight:950;white-space:nowrap;box-shadow:inset 0 0 0 1px rgba(255,255,255,.35)}
  .add2e-armorer-tabs{flex:0 0 auto;display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid #d9bf73;background:#f6e2ad;flex-wrap:wrap}.add2e-armorer-tabs button{border:1px solid #8d641b;border-radius:8px;background:linear-gradient(180deg,#7b4b16,#4b2b0b);color:#ffe7a8;font-weight:900;padding:5px 10px;line-height:1.2;min-height:28px;cursor:pointer}.add2e-armorer-tabs button.active{box-shadow:0 0 0 2px #f0c36a inset;filter:brightness(1.12)}.add2e-armorer-tabs button:disabled,.add2e-armorer-icon-btn:disabled{opacity:.45;cursor:not-allowed;filter:grayscale(.8)}.add2e-armorer-restock-all{margin-left:auto}
  .add2e-armorer-search{flex:0 0 auto;padding:10px 14px;border-bottom:1px solid #d9bf73;background:#fff1bf}.add2e-armorer-search-input{width:100%;min-height:30px;padding:5px 9px;border:1px solid #b98b2d;border-radius:8px;background:#fffaf0;color:#2f250c;font-weight:700}.add2e-armorer-table-wrap{flex:1 1 auto;min-height:0;overflow-y:auto!important;overflow-x:hidden;padding:12px 14px 16px}.add2e-armorer-table{width:100%;border-collapse:collapse;table-layout:auto;background:rgba(255,252,242,.94);border:1px solid #d9bf73;color:#2f250c}.add2e-armorer-table th{position:sticky;top:0;z-index:2;background:#e8d08f;color:#2f250c;border-bottom:1px solid #b98b2d;padding:7px 8px;text-align:left;font-weight:950}.add2e-armorer-table td{padding:5px 7px;border-bottom:1px solid #e0c982;vertical-align:middle;color:#2f250c;font-weight:750}.add2e-armorer-table tbody tr:nth-child(even){background:rgba(242,222,169,.35)}.add2e-armorer-table tbody tr:hover{background:rgba(255,231,168,.7)}
  .add2e-armorer-row-usable{box-shadow:inset 4px 0 0 #2f8f43}.add2e-armorer-row-unusable{box-shadow:inset 4px 0 0 #b83232}.add2e-armorer-name-usable{color:#16752b!important}.add2e-armorer-name-unusable{color:#b31616!important}.add2e-armorer-name-neutral{color:#2f250c!important}
  .add2e-armorer-item{min-width:230px}.add2e-armorer-item-wrap{display:flex;align-items:center;gap:8px;min-width:0}.add2e-armorer-item img{width:34px!important;height:34px!important;min-width:34px!important;max-width:34px!important;max-height:34px!important;object-fit:contain!important;border:1px solid #b98b2d;border-radius:6px;background:#f8edc7}.add2e-armorer-item span{font-weight:950;white-space:normal;line-height:1.2}.add2e-armorer-buy-qty,.add2e-armorer-restock-qty{width:54px!important;min-width:54px!important;max-width:54px!important;text-align:center;border:1px solid #b98b2d;border-radius:6px;background:#fffaf0;color:#2f250c;font-weight:900;min-height:26px}.add2e-armorer-actions,.add2e-armorer-gm-actions{display:flex;align-items:center;gap:5px;flex-wrap:nowrap}.add2e-armorer-icon-btn{width:28px;height:28px;min-width:28px;max-width:28px;padding:0;border:1px solid #8d641b;border-radius:7px;background:linear-gradient(180deg,#7b4b16,#4b2b0b);color:#ffe7a8;display:inline-flex;align-items:center;justify-content:center;cursor:pointer}.add2e-armorer-icon-btn i{pointer-events:none;font-size:13px;line-height:1}.add2e-armorer-icon-btn:hover{filter:brightness(1.15)}
  .add2e-armorer-assign-dialog{display:grid;gap:10px;color:#2f250c}.add2e-armorer-assign-dialog label{display:grid;gap:4px;font-weight:800}.add2e-armorer-assign-dialog select,.add2e-armorer-assign-dialog input{width:100%;min-height:30px}
`;

function tabForKind(item, kind) {
  if (kind === "Projectile") return "projectiles";
  if (item?.type === "arme") return "weapons";
  if (item?.type === "armure") return "armors";
  return "all";
}

class Add2eArmorerApp extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "add2e-armorer-app-{id}",
    classes: ["add2e", "add2e-armorer-app"],
    tag: "section",
    window: { title: "Armurier ADD2E", resizable: true },
    position: { width: 1120, height: 720 }
  };

  constructor({ armorer, buyer } = {}, options = {}) {
    super(options);
    this.armorer = armorer;
    this.buyer = buyer ?? getBuyer();
    this.activeTab = "all";
    this.searchText = "";
  }

  get title() {
    return `${this.armorer?.name ?? "Armurier"}${this.buyer ? ` — ${this.buyer.name}` : ""}`;
  }

  async _displayItems() {
    return await getArmorerDisplayItems(this.armorer);
  }

  async _resolveDisplayedItem(itemId) {
    if (!itemId) return null;
    return (await this._displayItems()).find(i => String(i.id) === String(itemId))
      ?? this.armorer?.items?.get?.(itemId)
      ?? null;
  }

  async _prepareContext() {
    const items = (await this._displayItems())
      .sort((a, b) => String(armorerKind(a)).localeCompare(String(armorerKind(b))) || String(a.name).localeCompare(String(b.name)))
      .map(item => {
        const kind = armorerKind(item);
        const tab = tabForKind(item, kind);
        const usability = usabilityForActor(this.buyer, item);
        return {
          id: item.id,
          name: item.name,
          img: item.img || "icons/svg/item-bag.svg",
          kind,
          tab,
          stock: quantity(item),
          priceLabel: formatMoney(priceCopper(item)),
          usability,
          search: lower(`${item.name} ${kind} ${item.system?.categorie ?? ""} ${item.system?.sousType ?? ""} ${item.system?.sous_type ?? ""} ${item.system?.famille_arme ?? ""}`)
        };
      });

    return {
      armorer: this.armorer,
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
      const rowClass = item.usability.state === "usable" ? "add2e-armorer-row-usable" : item.usability.state === "unusable" ? "add2e-armorer-row-unusable" : "";
      const nameClass = item.usability.state === "usable" ? "add2e-armorer-name-usable" : item.usability.state === "unusable" ? "add2e-armorer-name-unusable" : "add2e-armorer-name-neutral";
      const gmCell = context.isGM ? `<td><div class="add2e-armorer-gm-actions"><input class="add2e-armorer-restock-qty" type="number" min="0" value="${item.stock}" title="Quantité de restock"><button type="button" class="add2e-armorer-restock-set add2e-armorer-icon-btn" title="Définir le restock"><i class="fas fa-boxes-stacked"></i></button><button type="button" class="add2e-armorer-assign add2e-armorer-icon-btn" ${item.stock <= 0 ? "disabled" : ""} title="Affecter à un token de la scène"><i class="fas fa-user-plus"></i></button></div></td>` : "";
      return `<tr class="${rowClass}" data-item-id="${esc(item.id)}" data-tab="${item.tab}" data-search="${esc(item.search)}" style="${hidden ? "display:none;" : ""}"><td class="add2e-armorer-item"><div class="add2e-armorer-item-wrap"><img src="${esc(item.img)}" alt=""><span class="${nameClass}" title="${esc(item.usability.label)} — ${esc(item.usability.reason)}">${esc(item.name)}</span></div></td><td>${esc(item.kind)}</td><td>${esc(item.priceLabel)}</td><td>${item.stock}</td><td><input class="add2e-armorer-buy-qty" type="number" min="1" value="1" title="Quantité à acheter"></td><td><div class="add2e-armorer-actions"><button type="button" class="add2e-armorer-buy add2e-armorer-icon-btn" ${item.stock <= 0 || !context.buyer ? "disabled" : ""} title="Acheter"><i class="fas fa-cart-shopping"></i></button></div></td>${gmCell}</tr>`;
    }).join("");
    const colCount = context.isGM ? 7 : 6;

    const div = document.createElement("div");
    div.className = "add2e-armorer-root";
    div.innerHTML = `<style>${ADD2E_ARMORER_STYLE}</style><header class="add2e-armorer-header"><div><h2>${esc(context.armorer?.name ?? "Armurier")}</h2><p>Acheteur : <strong>${esc(context.buyer?.name ?? (context.isGM ? "gestion MJ" : "aucun personnage assigné"))}</strong></p></div><div class="add2e-armorer-money">${esc(context.buyerMoneyLabel)}</div></header><nav class="add2e-armorer-tabs">${tabButton("all", "Tous")}${tabButton("weapons", "Armes")}${tabButton("armors", "Armures")}${tabButton("projectiles", "Projectiles")}${context.isGM ? `<button type="button" class="add2e-armorer-restock-all" title="Réapprovisionner tout le stock"><i class="fas fa-boxes-stacked"></i> Restock global</button>` : ""}</nav><div class="add2e-armorer-search"><input type="search" class="add2e-armorer-search-input" placeholder="Rechercher une arme, une armure ou un projectile..." value="${esc(context.searchText)}"></div><div class="add2e-armorer-table-wrap"><table class="add2e-armorer-table"><thead><tr><th>Article</th><th>Type</th><th>Prix</th><th>Stock</th><th>Qté</th><th>Achat</th>${context.isGM ? `<th>Restock / Affectation MJ</th>` : ""}</tr></thead><tbody>${rows || `<tr><td colspan="${colCount}">Aucun article en stock.</td></tr>`}</tbody></table></div>`;
    return div;
  }

  _replaceHTML(result, content) {
    content.style.overflow = "hidden";
    content.style.padding = "0";
    content.style.background = "linear-gradient(180deg,#fff8df,#ead39b)";
    content.replaceChildren(result);
  }

  _refreshLater() {
    window.setTimeout(() => this.render({ force: true }), 250);
    window.setTimeout(() => this.render({ force: true }), 1200);
  }

  async _onRender(context, options = {}) {
    await super._onRender?.(context, options);
    const root = this.element?.querySelector?.(".add2e-armorer-root") ?? this.element;
    if (!root) return;

    const windowContent = this.element?.closest?.(".application")?.querySelector?.(".window-content") ?? this.element?.parentElement;
    if (windowContent) {
      windowContent.style.overflow = "hidden";
      windowContent.style.padding = "0";
      windowContent.style.background = "linear-gradient(180deg,#fff8df,#ead39b)";
    }

    root.querySelectorAll(".add2e-armorer-tabs button[data-tab]").forEach(button => button.addEventListener("click", ev => {
      this.activeTab = ev.currentTarget.dataset.tab || "all";
      this._applyFilters(root);
    }));

    root.querySelector(".add2e-armorer-search-input")?.addEventListener("input", ev => {
      this.searchText = ev.currentTarget.value ?? "";
      this._applyFilters(root);
    });

    root.querySelectorAll(".add2e-armorer-buy").forEach(button => button.addEventListener("click", async ev => {
      const row = ev.currentTarget.closest("tr[data-item-id]");
      const item = await this._resolveDisplayedItem(row?.dataset?.itemId);
      const qty = row?.querySelector?.(".add2e-armorer-buy-qty")?.value ?? 1;
      const ok = await buy({ armorer: this.armorer, buyer: this.buyer, item, quantity: qty });
      if (ok) this.render({ force: true });
      this._refreshLater();
    }));

    root.querySelectorAll(".add2e-armorer-restock-set").forEach(button => button.addEventListener("click", async ev => {
      const row = ev.currentTarget.closest("tr[data-item-id]");
      const item = await this._resolveDisplayedItem(row?.dataset?.itemId);
      const qty = row?.querySelector?.(".add2e-armorer-restock-qty")?.value ?? 0;
      await setStock(item, qty);
      this.render({ force: true });
    }));

    root.querySelectorAll(".add2e-armorer-assign").forEach(button => button.addEventListener("click", async ev => {
      const row = ev.currentTarget.closest("tr[data-item-id]");
      const item = await this._resolveDisplayedItem(row?.dataset?.itemId);
      await this._assignItemDialog(item);
      this.render({ force: true });
    }));

    root.querySelector(".add2e-armorer-restock-all")?.addEventListener("click", async () => {
      await restockAll(this.armorer);
      this.render({ force: true });
    });

    this._applyFilters(root);
  }

  async _assignItemDialog(item) {
    if (!game.user?.isGM) return false;
    if (!item) {
      await alertBox("Affectation impossible", "Article introuvable dans la liste affichée de l’armurier.");
      return false;
    }

    const choices = sceneTokenChoices();
    if (!choices.length) {
      await alertBox("Aucun token cible", "Aucun token non armurier n’est présent sur la scène.");
      return false;
    }

    const options = choices.map(c => `<option value="${esc(c.tokenId)}">${esc(c.label)}</option>`).join("");
    const content = `<form><div class="add2e-armorer-assign-dialog"><p>Affecter <b>${esc(item.name)}</b> depuis le stock de l’armurier.</p><label>Token cible<select name="tokenId">${options}</select></label><label>Quantité<input name="quantity" type="number" min="1" max="${quantity(item)}" value="1"></label><p class="hint">Stock disponible : ${quantity(item)}</p></div></form>`;
    const DialogV2 = foundry?.applications?.api?.DialogV2;
    if (!DialogV2?.confirm) return false;

    let formData = null;
    const ok = await DialogV2.confirm({
      window: { title: "Affecter un article" },
      content,
      yes: {
        label: "Affecter",
        callback: (event, button) => {
          const form = button?.form
            ?? button?.closest?.("form")
            ?? event?.target?.closest?.("form")
            ?? document.querySelector(".add2e-armorer-assign-dialog")?.closest?.("form");
          formData = {
            tokenId: form?.querySelector?.("[name='tokenId']")?.value,
            quantity: form?.querySelector?.("[name='quantity']")?.value
          };
          return true;
        }
      },
      no: { label: "Annuler" },
      modal: true
    });

    if (!ok || !formData) return false;
    const token = choices.find(c => c.tokenId === formData.tokenId)?.token ?? canvas?.tokens?.get?.(formData.tokenId) ?? null;
    const result = await assignItemToToken({ armorer: this.armorer, item, token, quantity: formData.quantity });
    if (result?.ok) ui.notifications?.info?.(result.message);
    else await alertBox("Affectation impossible", result?.message ?? "Impossible d’affecter cet article.");
    return result?.ok === true;
  }

  _applyFilters(root) {
    const q = lower(this.searchText);
    root.querySelectorAll(".add2e-armorer-tabs button[data-tab]").forEach(btn => btn.classList.toggle("active", btn.dataset.tab === this.activeTab));
    root.querySelectorAll("tbody tr[data-item-id]").forEach(row => {
      const tabOk = this.activeTab === "all" || row.dataset.tab === this.activeTab;
      const searchOk = !q || lower(row.dataset.search).includes(q);
      row.style.display = tabOk && searchOk ? "" : "none";
    });
  }
}

export async function openArmorer({ armorer = null, buyer = null } = {}) {
  armorer = armorer ?? findArmorer();
  if (!armorer) armorer = await createArmorer();
  if (!armorer) return null;
  buyer = buyer ?? getBuyer();
  if (!buyer && !game.user?.isGM) {
    await alertBox("Aucun acheteur", "Aucun personnage joueur n’est assigné ou sélectionné pour acheter chez cet armurier.");
    return null;
  }

  const key = `${game.user?.id ?? "user"}:${armorer.id}`;
  globalThis.__ADD2E_ARMORER_APPS ??= {};
  const existing = globalThis.__ADD2E_ARMORER_APPS[key];
  if (existing?.rendered) {
    existing.buyer = buyer;
    existing.bringToFront?.();
    existing.render({ force: true });
    return existing;
  }

  const app = new Add2eArmorerApp({ armorer, buyer });
  globalThis.__ADD2E_ARMORER_APPS[key] = app;
  app.render({ force: true });
  Hooks.on?.("add2eArmorerMoneyChanged", () => app.render({ force: true }));
  return app;
}

async function openArmorerFromToken(token) {
  const armorer = token?.actor ?? null;
  if (!isArmorerActor(armorer)) return false;
  const now = Date.now();
  const key = `${armorer.id}:${game.user?.id ?? "user"}`;
  const last = globalThis.__ADD2E_ARMORER_LAST_OPEN ?? {};
  if (last[key] && now - last[key] < 1200) return true;
  last[key] = now;
  globalThis.__ADD2E_ARMORER_LAST_OPEN = last;
  await openArmorer({ armorer, buyer: getBuyer() });
  return true;
}

function bindArmorerToken(token) {
  if (!token || token.__add2eArmorerBoundV2) return;
  if (!isArmorerActor(token.actor)) return;
  token.__add2eArmorerBoundV2 = true;
  try { token.cursor = "pointer"; } catch (_err) {}
  try { token.eventMode = "static"; } catch (_err) {}
  try { token.interactive = true; } catch (_err) {}
  const handler = () => window.setTimeout(() => openArmorerFromToken(token), 0);
  try { token.on?.("pointertap", handler); } catch (_err) {}
}

export function bindAllArmorerTokens() {
  for (const token of canvas?.tokens?.placeables ?? []) bindArmorerToken(token);
}

export function patchArmorerTokenClick() {
  if (globalThis.__ADD2E_ARMORER_TOKEN_CLICK_PATCHED_V2) return;
  globalThis.__ADD2E_ARMORER_TOKEN_CLICK_PATCHED_V2 = true;
  const TokenClass = foundry?.canvas?.placeables?.Token ?? CONFIG?.Token?.objectClass ?? globalThis.Token;
  const proto = TokenClass?.prototype;
  if (proto && typeof proto._onClickLeft === "function") {
    const original = proto._onClickLeft;
    proto._onClickLeft = function add2eArmorerOnClickLeft(event) {
      const result = original.call(this, event);
      try {
        if (isArmorerActor(this.actor)) window.setTimeout(() => openArmorerFromToken(this), 0);
      } catch (err) {
        console.warn("[ADD2E][ARMORER][TOKEN_CLICK]", err);
      }
      return result;
    };
  }
  Hooks.on("canvasReady", bindAllArmorerTokens);
  Hooks.on("createToken", () => window.setTimeout(bindAllArmorerTokens, 100));
  Hooks.on("updateToken", () => window.setTimeout(bindAllArmorerTokens, 100));
  Hooks.on("controlToken", (token, controlled) => {
    if (controlled && isArmorerActor(token?.actor)) window.setTimeout(() => openArmorerFromToken(token), 0);
  });
}

export function registerArmorerDirectoryButton() {
  Hooks.on("renderActorDirectory", (_app, html) => {
    if (!game.user?.isGM) return;
    const root = html?.jquery ? html[0] : html;
    if (!root?.querySelector || root.querySelector(".add2e-open-default-armorer")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "add2e-open-default-armorer";
    button.innerHTML = `<i class="fas fa-shield-halved"></i> Armurier`;
    button.addEventListener("click", () => openArmorer());
    root.querySelector(".directory-footer")?.prepend(button);
  });
}

export function registerArmorerUiGlobals() {
  game.add2e = game.add2e ?? {};
  game.add2e.openArmorer = openArmorer;
  game.add2e.armorerAppVersion = ADD2E_ARMORER_APP_VERSION;
  globalThis.add2eOpenArmorer = openArmorer;
  globalThis.ADD2E_ARMORER_VERSION = ADD2E_ARMORER_VERSION;
  globalThis.ADD2E_ARMORER_APP_VERSION = ADD2E_ARMORER_APP_VERSION;
}
