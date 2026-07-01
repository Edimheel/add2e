// ADD2E — Armurier ApplicationV2 : boutique d’armes, armures et projectiles.

import {
  isArmorerActor,
  isArmorerAmmunition,
  findArmorer,
  createArmorer,
  getBuyer,
  armorerKind,
  quantity,
  priceCopper,
  formatMoney,
  getMoney,
  buy,
  restockAll,
  getArmorerDisplayItems,
  alertBox,
  esc,
  lower,
  itemKey
} from "./22c-armorer-core.mjs";
import { normalizeShopCurrency, ADD2E_ARMORER_PLAYER_BUY } from "./22x-vendor-socket-bootstrap.mjs";

const VERSION = "2026-07-01-armorer-app-v3-merchant-layout";
const STYLE = `
  .add2e-armorer-app{background:#e7d29a;color:#2b2113}
  .add2e-armorer-app section{background:linear-gradient(180deg,#f0dfab 0%,#e4c985 100%);padding:0 .65rem .65rem}
  .add2e-armorer-app p{margin:.45rem 0 .5rem;padding:.42rem .6rem;border:1px solid rgba(110,76,23,.22);border-radius:8px;background:rgba(255,250,236,.76)}
  .add2e-armorer-app select.buyer,.add2e-armorer-app input.search{border:1px solid rgba(88,56,13,.45);border-radius:7px;background:#fffbf0;color:#2d210f;font-weight:800}
  .add2e-armorer-app input.search{width:100%;box-sizing:border-box;margin:.35rem 0 .6rem;padding:.4rem .6rem}
  .add2e-armorer-app button[data-tab]{height:28px;margin:0 .22rem .38rem 0;padding:0 .7rem;border:1px solid rgba(81,52,16,.42);border-radius:7px;background:linear-gradient(180deg,#6a4518,#49300f);color:#f8e7b4;font-weight:900}
  .add2e-armorer-app button[data-tab].active{background:linear-gradient(180deg,#d8ad56,#9a6d23)!important;color:#201506;outline:2px solid rgba(255,255,255,.9)!important}
  .add2e-armorer-app .add2e-armorer-toolbar-icon{display:inline-flex;margin:0 0 .38rem .28rem;color:#4b3210;font-size:1.05rem;cursor:pointer}
  .add2e-armorer-app .add2e-armorer-scroll{max-height:420px;overflow-y:auto;padding-right:6px;margin-top:6px}
  .add2e-armorer-app .add2e-armorer-table{width:100%;table-layout:fixed;border-collapse:collapse;background:#fff7df}
  .add2e-armorer-app th{position:sticky;top:0;background:#5a3a12;color:#f5e1a9;text-transform:uppercase;font-size:.74em;padding:.34rem .42rem}
  .add2e-armorer-app td{padding:.24rem .42rem;border-bottom:1px solid rgba(99,70,24,.16);overflow:hidden;text-overflow:ellipsis}
  .add2e-armorer-app tr:nth-child(odd){background:#fffaf0}.add2e-armorer-app tr:nth-child(even){background:#f6edcf}.add2e-armorer-app tr:hover{background:#f3dda2}
  .add2e-armorer-app .col-article{width:38%;font-weight:900;white-space:nowrap}.add2e-armorer-app .col-type{width:14%;white-space:nowrap}.add2e-armorer-app .col-price{width:13%;white-space:nowrap;font-weight:900;color:#4d3107}.add2e-armorer-app .col-stock{width:9%;white-space:nowrap;text-align:center;font-weight:900}.add2e-armorer-app .col-qty{width:10%;white-space:nowrap;text-align:center}.add2e-armorer-app .col-action{width:8%;white-space:nowrap;text-align:center}
  .add2e-armorer-app .type-pill{display:inline-flex;max-width:100%;padding:1px 7px;border-radius:999px;background:#ead79b;color:#352408;font-size:.82em;font-weight:900}
  .add2e-armorer-app .q{height:23px;min-height:23px;width:42px;text-align:center;border:1px solid rgba(120,82,28,.42);border-radius:6px;background:#fffdf2;color:#2d210f;font-weight:900}
  .add2e-armorer-app .add2e-armorer-action{display:inline-flex;align-items:center;justify-content:center;min-width:16px;padding:0;border:0;background:transparent;color:#1f6b37;font-size:1.02rem;cursor:pointer}
  .add2e-armorer-app .add2e-armorer-action:disabled{opacity:.28;cursor:not-allowed}
`;

function isOtherShop(actor) {
  return actor?.getFlag?.("add2e", "isVendor") === true || /marchand de composants/i.test(String(actor?.name ?? ""));
}

function buyerOptions(selected = "") {
  const actors = new Map();
  for (const token of canvas?.tokens?.placeables ?? []) {
    const actor = token?.actor;
    if (actor?.id && !isArmorerActor(actor) && !isOtherShop(actor)) actors.set(actor.id, actor);
  }
  return [...actors.values()]
    .sort((left, right) => String(left.name).localeCompare(String(right.name), "fr"))
    .map(actor => `<option value="${esc(actor.id)}" ${actor.id === selected ? "selected" : ""}>${esc(actor.name)}</option>`)
    .join("");
}

function tabFor(item) {
  if (isArmorerAmmunition(item)) return "projectiles";
  if (item?.type === "arme") return "weapons";
  if (item?.type === "armure") return "armors";
  return "all";
}

function ownedQuantity(actor, item) {
  if (!actor || !item) return 0;
  const key = itemKey(item);
  return Array.from(actor.items ?? [])
    .filter(candidate => itemKey(candidate) === key)
    .reduce((total, candidate) => total + Math.max(1, quantity(candidate)), 0);
}

function rowHtml(item, buyer) {
  const kind = armorerKind(item);
  const itemQty = quantity(item);
  const disabled = !buyer || itemQty <= 0;
  const owned = buyer ? ` (${ownedQuantity(buyer, item)})` : "";
  return `<tr data-id="${esc(item.id)}"><td class="col-article">${esc(item.name)}${esc(owned)}</td><td class="col-type"><span class="type-pill">${esc(kind)}</span></td><td class="col-price">${esc(formatMoney(priceCopper(item)))}</td><td class="col-stock">${itemQty}</td><td class="col-qty"><input class="q" type="number" min="1" value="1" title="Quantité"></td><td class="col-action"><button class="add2e-armorer-action" type="button" data-action="buy" title="Acheter" ${disabled ? "disabled" : ""}><i class="fas fa-cart-shopping"></i></button></td></tr>`;
}

async function confirmPlayerBuy(item, qty) {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.confirm) return false;
  return DialogV2.confirm({
    window: { title: "Confirmer l’achat" },
    content: `<p>Acheter <b>${qty} × ${esc(item.name)}</b> pour <b>${formatMoney(priceCopper(item) * qty)}</b> ?</p>`,
    yes: { label: "Acheter" },
    no: { label: "Annuler" },
    modal: true
  });
}

class Add2eArmorerApp extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "add2e-armorer-{id}",
    classes: ["add2e", "add2e-armorer-app"],
    tag: "section",
    window: { title: "Armurier", resizable: true },
    position: { width: 1030, height: 620 }
  };

  constructor({ armorer, buyer } = {}, options = {}) {
    super(options);
    this.armorer = armorer;
    this.buyer = buyer ?? getBuyer();
    this.tab = "all";
    this.search = "";
  }

  get title() { return `${this.armorer?.name ?? "Armurier"}${this.buyer ? ` — ${this.buyer.name}` : ""}`; }

  async _prepareContext() {
    normalizeShopCurrency();
    const items = await getArmorerDisplayItems(this.armorer);
    return {
      isGM: game.user?.isGM === true,
      items: items.sort((left, right) => String(armorerKind(left)).localeCompare(String(armorerKind(right)), "fr") || String(left.name).localeCompare(String(right.name), "fr"))
    };
  }

  async _renderHTML(context) {
    const query = lower(this.search);
    const displayed = context.items.filter(item => {
      const tabMatches = this.tab === "all" || tabFor(item) === this.tab;
      const haystack = lower(`${item.name} ${armorerKind(item)} ${ownedQuantity(this.buyer, item)}`);
      return tabMatches && (!query || haystack.includes(query));
    });
    const button = (id, label) => `<button type="button" data-tab="${id}" class="${this.tab === id ? "active" : ""}">${label}</button>`;
    const buyer = context.isGM ? `<select class="buyer"><option value="">Gestion MJ</option>${buyerOptions(this.buyer?.id)}</select>` : `<b>${esc(this.buyer?.name ?? "aucun")}</b>`;
    const restock = context.isGM ? '<i class="fas fa-rotate add2e-armorer-toolbar-icon" data-action="restock" role="button" tabindex="0" title="Restock global" aria-label="Restock global"></i>' : "";
    const rows = displayed.map(item => rowHtml(item, this.buyer)).join("") || '<tr><td colspan="6" class="a2e-muted">Aucun article.</td></tr>';
    const root = document.createElement("section");
    root.innerHTML = `<style>${STYLE}</style><p><span>Acheteur :</span> ${buyer} <strong>${this.buyer ? esc(formatMoney(getMoney(this.buyer))) : ""}</strong></p><div>${button("all", "Tous")}${button("weapons", "Armes")}${button("armors", "Armures")}${button("projectiles", "Projectiles")}${restock}</div><input class="search" value="${esc(this.search)}" placeholder="Recherche"><div class="add2e-armorer-scroll"><table class="add2e-armorer-table"><thead><tr><th class="col-article">Article</th><th class="col-type">Type</th><th class="col-price">Prix</th><th class="col-stock">Stock</th><th class="col-qty">Qté</th><th class="col-action"></th></tr></thead><tbody>${rows}</tbody></table></div>`;
    return root;
  }

  _replaceHTML(result, content) { content.replaceChildren(result); }

  async _onRender(context, options = {}) {
    await super._onRender?.(context, options);
    const root = this.element;
    root.querySelector("select.buyer")?.addEventListener("change", event => {
      this.buyer = game.actors?.get(event.currentTarget.value) ?? null;
      this.render({ force: true });
    });
    root.querySelector("input.search")?.addEventListener("input", event => {
      this.search = event.currentTarget.value ?? "";
      this.render({ force: true });
    });
    root.querySelectorAll("button[data-tab]").forEach(button => button.addEventListener("click", event => {
      this.tab = event.currentTarget.dataset.tab ?? "all";
      this.render({ force: true });
    }));
    root.querySelector("[data-action='restock']")?.addEventListener("click", async () => {
      await restockAll(this.armorer);
      this.render({ force: true });
    });
    root.querySelectorAll("button[data-action='buy']").forEach(button => button.addEventListener("click", event => this.buyFromRow(event)));
  }

  async itemFromRow(row) {
    const id = row?.dataset?.id;
    if (!id) return null;
    return this.armorer?.items?.get(id)
      ?? (await getArmorerDisplayItems(this.armorer)).find(item => String(item.id) === String(id))
      ?? null;
  }

  async buyFromRow(event) {
    const row = event.currentTarget.closest("tr[data-id]");
    const item = await this.itemFromRow(row);
    const qty = Math.max(1, Math.floor(Number(row?.querySelector(".q")?.value) || 1));
    if (!item || !this.armorer || !this.buyer || quantity(item) < qty) return;

    if (game.user?.isGM) {
      normalizeShopCurrency();
      if (await buy({ armorer: this.armorer, buyer: this.buyer, item, quantity: qty })) this.render({ force: true });
      return;
    }

    if (!await confirmPlayerBuy(item, qty)) return;
    game.socket?.emit?.("system.add2e", {
      type: ADD2E_ARMORER_PLAYER_BUY,
      requestId: foundry.utils.randomID(),
      userId: game.user.id,
      armorerId: this.armorer.id,
      buyerId: this.buyer.id,
      buyerUuid: this.buyer.uuid,
      itemId: item.id?.startsWith?.("catalog:") ? null : item.id,
      itemKey: itemKey(item),
      quantity: qty
    });
    window.setTimeout(() => this.render({ force: true }), 800);
  }
}

const apps = () => globalThis.__ADD2E_ARMORER_APPS ??= {};
function locked(actor) {
  const key = `${game.user?.id}:${actor?.id}`;
  const now = Date.now();
  const locks = globalThis.__ADD2E_ARMORER_OPEN_LOCK ??= {};
  if (locks[key] && now - locks[key] < 750) return true;
  locks[key] = now;
  return false;
}

async function openFromToken(token) {
  if (!isArmorerActor(token?.actor) || locked(token.actor)) return false;
  await openArmorer({ armorer: token.actor, buyer: getBuyer() });
  return true;
}

export async function openArmorer({ armorer = null, buyer = null } = {}) {
  armorer = armorer ?? findArmorer();
  if (!armorer && game.user?.isGM) armorer = await createArmorer();
  if (!armorer) return alertBox("Armurier introuvable", "Le MJ doit créer l’armurier.");
  buyer = buyer ?? getBuyer();
  if (!buyer && !game.user?.isGM) return alertBox("Aucun acheteur", "Aucun personnage assigné ou sélectionné.");

  const key = `${game.user?.id}:${armorer.id}`;
  const current = apps()[key];
  if (current?.rendered) {
    current.armorer = armorer;
    current.buyer = buyer;
    current.render({ force: true });
    current.bringToFront?.();
    return current;
  }

  const app = new Add2eArmorerApp({ armorer, buyer });
  apps()[key] = app;
  app.render({ force: true });
  return app;
}

export function bindAllArmorerTokens() {
  for (const token of canvas?.tokens?.placeables ?? []) {
    if (!isArmorerActor(token?.actor) || token.__add2eArmorerTapV2) continue;
    token.__add2eArmorerTapV2 = true;
    try {
      token.cursor = "pointer";
      token.eventMode = "static";
      token.interactive = true;
      token.on?.("pointertap", event => { event?.stopPropagation?.(); openFromToken(token); });
      token.on?.("pointerup", event => { event?.stopPropagation?.(); openFromToken(token); });
    } catch (_) {}
  }
}

export function patchArmorerTokenClick() {
  if (globalThis.__ADD2E_ARMORER_CLICK_TAP_2) return;
  globalThis.__ADD2E_ARMORER_CLICK_TAP_2 = true;
  const TokenClass = foundry?.canvas?.placeables?.Token ?? CONFIG?.Token?.objectClass ?? globalThis.Token;
  const prototype = TokenClass?.prototype;
  if (prototype && typeof prototype._onClickLeft === "function") {
    const original = prototype._onClickLeft;
    prototype._onClickLeft = function add2eArmorerOnClickLeft(event) {
      const result = original.call(this, event);
      if (isArmorerActor(this.actor)) window.setTimeout(() => openFromToken(this), 0);
      return result;
    };
  }
  Hooks.on("canvasReady", bindAllArmorerTokens);
  Hooks.on("createToken", () => window.setTimeout(bindAllArmorerTokens, 100));
  Hooks.on("updateToken", () => window.setTimeout(bindAllArmorerTokens, 100));
  window.setTimeout(bindAllArmorerTokens, 500);
}

export function registerArmorerDirectoryButton() {
  Hooks.on("renderActorDirectory", (_app, html) => {
    if (!game.user?.isGM) return;
    const root = html?.jquery ? html[0] : html;
    if (!root?.querySelector || root.querySelector(".add2e-open-armorer")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "add2e-open-armorer";
    button.textContent = "Armurier";
    button.addEventListener("click", () => openArmorer());
    root.querySelector(".directory-footer")?.prepend(button);
  });
}

export function registerArmorerUiGlobals() {
  game.add2e = game.add2e ?? {};
  game.add2e.openArmorer = openArmorer;
  game.add2e.armorerAppVersion = VERSION;
  globalThis.add2eOpenArmorer = openArmorer;
  globalThis.ADD2E_ARMORER_APP_VERSION = VERSION;
}
