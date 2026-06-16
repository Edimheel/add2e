// ADD2E — Marchand V2 compact.
// Version : 2026-06-16-merchant-sober-visual-redesign-v5

import {
  findVendor,
  createVendor,
  getBuyer,
  isVendorActor,
  vendorKind,
  isStockItem,
  isAmmunition,
  isComponent,
  quantity,
  priceCopper,
  formatMoney,
  getMoney,
  buy,
  restockAll,
  setStock,
  assignItemToToken,
  alertBox,
  esc,
  lower,
  slug
} from "./22a-vendor-core.mjs";
import { normalizeShopCurrency, ADD2E_VENDOR_PLAYER_BUY } from "./22x-vendor-socket-bootstrap.mjs";

const VERSION = "2026-06-16-merchant-sober-visual-redesign-v5";
const DIAG = "[ADD2E][MERCHANT_APP][BUY_DIAG]";

const arr = v => Array.isArray(v)
  ? v.flatMap(arr)
  : v == null || v === ""
    ? []
    : typeof v === "string"
      ? v.split(/[,;|\n]+/g).map(x => x.trim()).filter(Boolean)
      : [v];
const key = v => slug(String(v ?? ""));
const uniq = v => [...new Set(v.filter(Boolean))];

function diag(label, data = {}) {
  console.warn(`${DIAG}[${label}]`, { user: game.user?.name, userId: game.user?.id, isGM: game.user?.isGM, version: VERSION, ...data });
}

function isShopActor(actor) {
  return isVendorActor(actor) || actor?.getFlag?.("add2e", "isArmorer") === true || /armurier/i.test(String(actor?.name ?? ""));
}

function sceneActors() {
  const map = new Map();
  for (const t of canvas?.tokens?.placeables ?? []) {
    const a = t?.actor;
    if (a?.id && !isShopActor(a)) map.set(a.id, a);
  }
  return [...map.values()].sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

function buyerOptions(selected = "") {
  return sceneActors().map(a => `<option value="${esc(a.id)}" ${a.id === selected ? "selected" : ""}>${esc(a.name)}</option>`).join("");
}

function priceLabel(item) {
  const raw = String(item?.system?.prix ?? item?.system?.cout ?? "").trim();
  return raw ? raw : formatMoney(priceCopper(item));
}

function linked(item) {
  const s = item?.system ?? {}, f = item?.flags?.add2e ?? {};
  return uniq([
    ...arr(s.sorts_associes),
    ...arr(s.sortsAssocies),
    ...arr(s.spells),
    ...arr(s.spellNames),
    ...arr(f.sorts_associes),
    ...arr(f.sortsAssocies),
    ...arr(f.spells),
    ...arr(f.spellNames)
  ].map(x => String(x).trim()).filter(Boolean));
}

function spellKeys(spell) {
  const s = spell?.system ?? {}, f = spell?.flags?.add2e ?? {};
  return uniq([spell?.name, s.nom, s.slug, f.slug, f.importKey].map(key));
}

function memorized(spell) {
  try {
    const n = Number(globalThis.add2eGetTotalMemorizedCount?.(spell));
    if (Number.isFinite(n) && n > 0) return Math.floor(n);
  } catch (_e) {}
  const raw = spell?.getFlag?.("add2e", "memorizedByList") ?? spell?.flags?.add2e?.memorizedByList ?? {};
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return Object.values(raw).reduce((s, v) => s + (Number(v) || 0), 0);
  return Number(spell?.getFlag?.("add2e", "memorizedCount") ?? spell?.flags?.add2e?.memorizedCount ?? 0) || 0;
}

function spells(actor) {
  return Array.from(actor?.items ?? [])
    .filter(i => String(i?.type ?? "").toLowerCase() === "sort" && !i.system?.isPower && !i.system?.isObjectPower)
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

function usage(actor, item) {
  if (vendorKind(item) !== "Composant") return { known: 0, prep: 0, names: [] };
  const aliases = linked(item).map(key);
  if (!aliases.length) return { known: 0, prep: 0, names: [] };
  let known = 0, prep = 0, names = [];
  for (const sp of spells(actor)) {
    if (!spellKeys(sp).some(k => aliases.includes(k))) continue;
    known += 1;
    const m = memorized(sp);
    prep += m;
    names.push(m > 1 ? `${sp.name} ×${m}` : sp.name);
  }
  return { known, prep, names: uniq(names) };
}

function itemTags(item) {
  const s = item?.system ?? {}, f = item?.flags?.add2e ?? {};
  return [s.tags, s.effectTags, s.effecttags, f.tags, f.effectTags, f.effecttags]
    .flatMap(arr)
    .map(v => lower(v))
    .filter(Boolean);
}

function isBazaarItem(item) {
  return isStockItem(item) && !isComponent(item) && !isAmmunition(item) && vendorKind(item) !== "Composant" && vendorKind(item) !== "Projectile";
}

function normalizeSectionLabel(raw = "") {
  const value = String(raw ?? "").trim();
  const s = lower(value);
  if (!s) return "Divers";
  if (/herbe|herbor|plante|ingredient|ingrédient|epice|épice|aromate|racine|baie|graine|feuille|fleur/.test(s)) return "Herbes et ingrédients";
  if (/outil|tools?|artisan|craft|metier|métier|crochet|corde|grappin/.test(s)) return "Outils et matériel";
  if (/vetement|vêtement|habit|robe|botte|chaussure|ceinture|cape/.test(s)) return "Vêtements";
  if (/nourriture|ration|vivre|eau|boisson|repas/.test(s)) return "Vivres";
  if (/lumiere|lumière|torche|lanterne|huile|bougie/.test(s)) return "Éclairage";
  if (/contenant|sac|sacoche|coffre|bourse|etui|étui|carquois|boite|boîte/.test(s)) return "Contenants";
  if (/monture|cheval|animal|chariot|charrette|selle|bride/.test(s)) return "Transport et montures";
  if (/service|logement|auberge/.test(s)) return "Services";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function bazaarSection(item) {
  const s = item?.system ?? {};
  const values = [
    s.categorie,
    s.category,
    s.sousType,
    s.sous_type,
    s.subtype,
    s.kind,
    s.slot,
    ...itemTags(item)
  ].map(v => String(v ?? "").trim()).filter(Boolean);
  const text = values.map(lower).join(" ");

  if (/herbe|herbor|plante|ingredient|ingrédient|epice|épice|aromate|racine|baie|graine|feuille|fleur/.test(text)) return "Herbes et ingrédients";
  if (/outil|tools?|artisan|craft|metier|métier|crochet|corde|grappin/.test(text)) return "Outils et matériel";
  if (/vetement|vêtement|habit|robe|botte|chaussure|ceinture|cape/.test(text)) return "Vêtements";
  if (/nourriture|ration|vivre|eau|boisson|repas/.test(text)) return "Vivres";
  if (/lumiere|lumière|torche|lanterne|huile|bougie/.test(text)) return "Éclairage";
  if (/contenant|sac|sacoche|coffre|bourse|etui|étui|carquois|boite|boîte/.test(text)) return "Contenants";
  if (/monture|cheval|animal|chariot|charrette|selle|bride/.test(text)) return "Transport et montures";
  if (/service|logement|auberge/.test(text)) return "Services";

  return normalizeSectionLabel(s.categorie ?? s.category ?? s.sousType ?? s.sous_type ?? "Divers");
}

function sectionRank(name) {
  const order = [
    "Outils et matériel",
    "Herbes et ingrédients",
    "Vivres",
    "Éclairage",
    "Contenants",
    "Vêtements",
    "Transport et montures",
    "Services",
    "Divers"
  ];
  const i = order.indexOf(name);
  return i >= 0 ? i : 500;
}

function rowTabs(item, use) {
  const kind = vendorKind(item);
  const tabs = [kind === "Composant" ? "components" : kind === "Projectile" ? "projectiles" : "bazaar"];
  if (use.prep > 0) tabs.push("prepared");
  if (use.known > 0) tabs.push("known");
  return tabs;
}

function iconButton(action, icon, title, disabled = false, extraClass = "") {
  return `<button class="add2e-vendor-icon-btn ${extraClass}" data-action="${action}" title="${esc(title)}" aria-label="${esc(title)}" ${disabled ? "disabled" : ""}><i class="fas ${icon}"></i></button>`;
}

function rowHtml(item, ctx, use, visible = true) {
  const kind = vendorKind(item);
  const itemQty = quantity(item);
  const disabled = !ctx.buyer || itemQty <= 0;
  const gm = ctx.isGM
    ? `<td class="col-mj add2e-vendor-gm-actions"><input class="s stock-input" type="number" min="0" value="${itemQty}" title="Stock"><span class="vendor-icon-group">${iconButton("stock", "fa-boxes-stacked", "Définir le stock", false, "stock")} ${iconButton("assign", "fa-hand-holding", "Donner à l’acheteur", disabled, "assign")}</span></td>`
    : "";
  return `<tr data-id="${esc(item.id)}" style="${visible ? "" : "display:none"}"><td class="col-article" title="${esc(item.name)}">${esc(item.name)}</td><td class="col-type" title="${esc(kind)}"><span class="type-pill">${esc(kind)}</span></td><td class="col-sorts" title="${esc(use.names.length ? use.names.join(", ") : "—")}">${esc(use.names.length ? use.names.join(", ") : "—")}</td><td class="col-prix">${esc(priceLabel(item))}</td><td class="col-stock">${itemQty}</td><td class="col-qty"><input class="q" type="number" min="1" value="1" title="Quantité"></td><td class="col-action">${iconButton("buy", "fa-cart-shopping", "Acheter", disabled, "buy")}</td>${gm}</tr>`;
}

function itemVisibleForContext(item, ctx, use) {
  const tabs = rowTabs(item, use);
  const txt = lower(`${item.name} ${vendorKind(item)} ${bazaarSection(item)} ${use.names.join(" ")}`);
  return (ctx.tab === "all" || tabs.includes(ctx.tab)) && (!ctx.search || txt.includes(lower(ctx.search)));
}

function tableHeader(ctx) {
  return `<thead><tr><th class="col-article">Article</th><th class="col-type">Type</th><th class="col-sorts">Sorts</th><th class="col-prix">Prix</th><th class="col-stock">Stock</th><th class="col-qty">Qté</th><th class="col-action"></th>${ctx.isGM ? "<th class=\"col-mj\">MJ</th>" : ""}</tr></thead>`;
}

function renderFlatTable(ctx, rows) {
  return `<div class="add2e-vendor-scroll"><table class="add2e-vendor-table">${tableHeader(ctx)}<tbody>${rows}</tbody></table></div>`;
}

function renderBazaarAccordion(ctx) {
  const groups = new Map();
  for (const item of ctx.items) {
    if (!isBazaarItem(item)) continue;
    const use = usage(ctx.buyer, item);
    if (!itemVisibleForContext(item, ctx, use)) continue;
    const section = bazaarSection(item);
    if (!groups.has(section)) groups.set(section, []);
    groups.get(section).push({ item, use });
  }

  const sections = [...groups.entries()].sort(([a], [b]) => sectionRank(a) - sectionRank(b) || a.localeCompare(b));
  if (!sections.length) return `<div class="add2e-vendor-scroll"><p class="a2e-muted">Aucun article dans le bazard.</p></div>`;

  return `<div class="add2e-vendor-scroll add2e-vendor-bazaar-list">${sections.map(([section, entries]) => {
    entries.sort((a, b) => String(a.item.name).localeCompare(String(b.item.name)));
    const rows = entries.map(entry => rowHtml(entry.item, ctx, entry.use, true)).join("");
    return `<details class="add2e-vendor-bazaar-section"><summary><span>${esc(section)}</span><strong>${entries.length}</strong></summary><table class="add2e-vendor-table">${tableHeader(ctx)}<tbody>${rows}</tbody></table></details>`;
  }).join("")}</div>`;
}

function vendorStyle() {
  return `<style>
    .add2e-merchant-app{--a2e-bg:#e7d29a;--a2e-panel:#f4e8c4;--a2e-paper:#fff9e9;--a2e-line:rgba(92,62,20,.22);--a2e-brown:#3b2a12;--a2e-brown2:#5a3b13;--a2e-gold:#c99a3b;--a2e-gold2:#f1d88e;--a2e-text:#2b2113;background:#e7d29a;color:var(--a2e-text);}
    .add2e-merchant-app section{background:linear-gradient(180deg,#f0dfab 0%,#e4c985 100%);padding:0 .65rem .65rem .65rem;}
    .add2e-merchant-app p{margin:.45rem 0 .5rem 0;padding:.42rem .6rem;border:1px solid rgba(110,76,23,.22);border-radius:8px;background:rgba(255,250,236,.76);box-shadow:inset 0 1px 0 rgba(255,255,255,.45);}
    .add2e-merchant-app select.buyer,.add2e-merchant-app input.search{border:1px solid rgba(88,56,13,.45);border-radius:7px;background:#fffbf0;color:#2d210f;font-weight:800;box-shadow:inset 0 1px 2px rgba(0,0,0,.08);}
    .add2e-merchant-app input.search{width:100%;box-sizing:border-box;margin:.35rem 0 .6rem 0;padding:.4rem .6rem;}
    .add2e-merchant-app button[data-tab],.add2e-merchant-app button[data-action="restock"]{height:28px;margin:0 .22rem .38rem 0;padding:0 .7rem;border:1px solid rgba(81,52,16,.42);border-radius:7px;background:linear-gradient(180deg,#6a4518,#49300f);color:#f8e7b4;font-weight:900;box-shadow:inset 0 1px 0 rgba(255,255,255,.10),0 1px 2px rgba(0,0,0,.16);}
    .add2e-merchant-app button[data-action="restock"]{width:34px;padding:0;}
    .add2e-merchant-app button[data-tab]:hover,.add2e-merchant-app button[data-action="restock"]:hover{background:linear-gradient(180deg,#7d541f,#523613);}
    .add2e-merchant-app button[data-tab][style*="outline"]{background:linear-gradient(180deg,#d8ad56,#9a6d23)!important;color:#201506;outline:2px solid rgba(255,255,255,.9)!important;}
    .add2e-merchant-app .add2e-vendor-scroll{max-height:420px;overflow-y:auto;padding-right:6px;margin-top:6px;scrollbar-color:#6b2147 #dfc884;}
    .add2e-merchant-app .add2e-vendor-bazaar-list{display:block;width:100%;}
    .add2e-merchant-app .add2e-vendor-bazaar-section{display:block;width:100%;box-sizing:border-box;margin:0 0 8px 0;border:1px solid rgba(76,51,16,.32);border-radius:9px;background:rgba(255,248,226,.56);overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,.10);}
    .add2e-merchant-app .add2e-vendor-bazaar-section>summary{cursor:pointer;display:flex;width:100%;box-sizing:border-box;align-items:center;justify-content:space-between;gap:12px;padding:8px 11px;background:linear-gradient(180deg,#4a3418,#33240f);color:#f4dc9d;font-weight:900;list-style:revert;}
    .add2e-merchant-app .add2e-vendor-bazaar-section>summary:hover{background:linear-gradient(180deg,#5b3d1b,#3a2912);}
    .add2e-merchant-app .add2e-vendor-bazaar-section>summary strong{min-width:24px;text-align:center;border:1px solid rgba(244,220,157,.35);border-radius:999px;padding:1px 8px;background:rgba(0,0,0,.18);font-size:.9em;}
    .add2e-merchant-app .add2e-vendor-bazaar-section:not([open]) table{display:none;}
    .add2e-merchant-app .add2e-vendor-bazaar-section table{margin:0;width:100%;}
    .add2e-merchant-app .add2e-vendor-table{width:100%;table-layout:fixed;border-collapse:collapse;background:#fff7df;border:1px solid rgba(88,60,22,.16);}
    .add2e-merchant-app .add2e-vendor-table thead th{position:sticky;top:0;z-index:1;background:#5a3a12;color:#f5e1a9;text-transform:uppercase;font-size:.74em;letter-spacing:.04em;padding:.34rem .42rem;border-bottom:1px solid rgba(0,0,0,.22);}
    .add2e-merchant-app .add2e-vendor-table tbody tr:nth-child(odd){background:#fffaf0;}
    .add2e-merchant-app .add2e-vendor-table tbody tr:nth-child(even){background:#f6edcf;}
    .add2e-merchant-app .add2e-vendor-table tbody tr:hover{background:#f3dda2;}
    .add2e-merchant-app .add2e-vendor-table td{padding:.24rem .42rem;border-bottom:1px solid rgba(99,70,24,.16);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;vertical-align:middle;}
    .add2e-merchant-app .col-article{width:35%;font-weight:900;}
    .add2e-merchant-app .col-type{width:10%;}
    .add2e-merchant-app .col-sorts{width:5%;max-width:5%;text-align:center;color:#6d5c3c;font-size:.88em;}
    .add2e-merchant-app .col-prix{width:8%;font-weight:900;color:#4d3107;}
    .add2e-merchant-app .col-stock{width:6%;text-align:center;font-weight:900;}
    .add2e-merchant-app .col-qty{width:6%;text-align:center;}
    .add2e-merchant-app .col-action{width:5%;text-align:center;}
    .add2e-merchant-app .col-mj{width:15%;text-align:right;}
    .add2e-merchant-app .type-pill{display:inline-flex;max-width:100%;padding:1px 7px;border:1px solid rgba(96,67,25,.16);border-radius:999px;background:#ead79b;color:#352408;font-size:.82em;font-weight:900;overflow:hidden;text-overflow:ellipsis;}
    .add2e-merchant-app .q,.add2e-merchant-app .s{height:23px;min-height:23px;text-align:center;border:1px solid rgba(120,82,28,.42);border-radius:6px;background:#fffdf2;color:#2d210f;font-weight:900;}
    .add2e-merchant-app .q{width:42px;}
    .add2e-merchant-app .stock-input{width:48px;margin-right:5px;}
    .add2e-merchant-app .vendor-icon-group{display:inline-flex;gap:5px;vertical-align:middle;}
    .add2e-merchant-app .add2e-vendor-icon-btn{width:26px;height:24px;min-width:26px;padding:0;border:1px solid rgba(82,55,16,.38);border-radius:6px;display:inline-flex;align-items:center;justify-content:center;background:#f4e2ad;color:#38250b;font-weight:900;box-shadow:inset 0 1px 0 rgba(255,255,255,.42),0 1px 1px rgba(0,0,0,.12);}
    .add2e-merchant-app .add2e-vendor-icon-btn.buy{background:#dcebcf;color:#18421f;border-color:rgba(41,98,48,.35);}
    .add2e-merchant-app .add2e-vendor-icon-btn.stock{background:#ead79b;color:#3a270b;}
    .add2e-merchant-app .add2e-vendor-icon-btn.assign{background:#d7e1ee;color:#17314e;border-color:rgba(45,80,115,.35);}
    .add2e-merchant-app .add2e-vendor-icon-btn:disabled{opacity:.36;filter:grayscale(.45);cursor:not-allowed;}
    .add2e-merchant-app .add2e-vendor-icon-btn:not(:disabled):hover{filter:brightness(1.05);transform:translateY(-1px);}
  </style>`;
}

async function confirmPlayerBuy(item, qty) {
  const D = foundry?.applications?.api?.DialogV2;
  const total = formatMoney(priceCopper(item) * qty);
  diag("PLAYER_CONFIRM_OPEN", { item: item?.name, itemId: item?.id, qty, total });
  const ok = await (D?.confirm?.({
    window: { title: "Confirmer l’achat" },
    content: `<p>Acheter <b>${qty} × ${esc(item.name)}</b> pour <b>${total}</b> ?</p>`,
    yes: { label: "Acheter" },
    no: { label: "Annuler" },
    modal: true
  }) ?? false);
  diag("PLAYER_CONFIRM_CLOSE", { item: item?.name, itemId: item?.id, qty, ok });
  return ok;
}

class Add2eMerchantApp extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "add2e-merchant-{id}",
    classes: ["add2e", "add2e-merchant-app"],
    tag: "section",
    window: { title: "Marchand ADD2E", resizable: true },
    position: { width: 980, height: 620 }
  };

  constructor({ vendor, buyer } = {}, options = {}) {
    super(options);
    this.vendor = vendor;
    this.buyer = buyer ?? getBuyer();
    this.tab = "all";
    this.search = "";
  }

  get title() { return `${this.vendor?.name ?? "Marchand"}${this.buyer ? ` — ${this.buyer.name}` : ""}`; }
  stock() { return Array.from(this.vendor?.items ?? []).filter(isStockItem).sort((a, b) => String(a.name).localeCompare(String(b.name))); }

  async _prepareContext() {
    normalizeShopCurrency();
    return { vendor: this.vendor, buyer: this.buyer, items: this.stock(), isGM: game.user?.isGM === true, tab: this.tab, search: this.search };
  }

  async _renderHTML(ctx) {
    if (ctx.tab === "equipment") ctx.tab = "bazaar";
    let prepCount = 0;
    let knownCount = 0;

    const computed = ctx.items.map(item => ({ item, use: usage(ctx.buyer, item) }));
    for (const entry of computed) {
      if (entry.use.prep > 0) prepCount++;
      if (entry.use.known > 0) knownCount++;
    }

    const nav = [
      ["all", "Tous"],
      ["prepared", `Mémorisés (${prepCount})`],
      ["known", `Connus (${knownCount})`],
      ["components", "Composants"],
      ["projectiles", "Projectiles"],
      ["bazaar", "Bazard"]
    ].map(([id, lab]) => `<button data-tab="${id}" ${ctx.tab === id ? "style='outline:2px solid #fff'" : ""}>${lab}</button>`).join("");

    const visibleRows = computed
      .filter(({ item, use }) => ctx.tab !== "bazaar" && itemVisibleForContext(item, ctx, use))
      .map(({ item, use }) => rowHtml(item, ctx, use, true))
      .join("");

    const list = ctx.tab === "bazaar"
      ? renderBazaarAccordion(ctx)
      : renderFlatTable(ctx, visibleRows || `<tr><td colspan="${ctx.isGM ? 8 : 7}" class="a2e-muted">Aucun article.</td></tr>`);

    const buyer = ctx.isGM ? `<select class="buyer">${buyerOptions(ctx.buyer?.id)}</select>` : `<b>${esc(ctx.buyer?.name ?? "aucun")}</b>`;
    const div = document.createElement("section");
    div.innerHTML = `${vendorStyle()}<p><span>Acheteur :</span> ${buyer} <strong>${ctx.buyer ? esc(formatMoney(getMoney(ctx.buyer))) : ""}</strong></p><div>${nav}${ctx.isGM ? `<button data-action="restock" title="Restock global"><i class="fas fa-rotate"></i></button>` : ""}</div><input class="search" value="${esc(ctx.search)}" placeholder="Recherche">${list}`;
    return div;
  }

  _replaceHTML(result, content) { content.replaceChildren(result); }

  async _onRender(c, o) {
    await super._onRender?.(c, o);
    const r = this.element;
    r.querySelector(".buyer")?.addEventListener("change", e => { this.buyer = game.actors.get(e.currentTarget.value) ?? this.buyer; this.render({ force: true }); });
    r.querySelector(".search")?.addEventListener("input", e => { this.search = e.currentTarget.value ?? ""; this.render({ force: true }); });
    r.querySelectorAll("button[data-tab]").forEach(b => b.addEventListener("click", e => { this.tab = e.currentTarget.dataset.tab; this.render({ force: true }); }));
    r.querySelectorAll("button[data-action]").forEach(b => b.addEventListener("click", e => this.click(e)));
  }

  async playerBuy(item, qty) {
    qty = Math.max(1, Math.floor(Number(qty) || 1));
    diag("PLAYER_BUY_ENTER", { vendor: this.vendor?.name, vendorId: this.vendor?.id, buyer: this.buyer?.name, buyerId: this.buyer?.id, buyerUuid: this.buyer?.uuid, item: item?.name, itemId: item?.id, qty, stock: quantity(item) });
    if (!this.vendor || !this.buyer || !item) return false;
    if (quantity(item) < qty) return alertBox("Stock insuffisant", `${item.name} : stock disponible ${quantity(item)}.`).then(() => false);
    if (!await confirmPlayerBuy(item, qty)) return false;
    const requestId = foundry.utils.randomID();
    diag("PLAYER_BUY_EMIT", { socketType: ADD2E_VENDOR_PLAYER_BUY, requestId, vendorId: this.vendor.id, buyerId: this.buyer.id, buyerUuid: this.buyer.uuid, itemId: item.id, qty });
    game.socket?.emit?.("system.add2e", { type: ADD2E_VENDOR_PLAYER_BUY, requestId, userId: game.user.id, vendorId: this.vendor.id, buyerId: this.buyer.id, buyerUuid: this.buyer.uuid, itemId: item.id, quantity: qty });
    return true;
  }

  async click(e) {
    const a = e.currentTarget.dataset.action;
    diag("CLICK", { action: a, isGM: game.user?.isGM });
    if (a === "restock") { await restockAll(this.vendor); return this.render({ force: true }); }
    const row = e.currentTarget.closest("tr");
    const item = this.vendor.items.get(row?.dataset.id);
    if (a === "stock") { await setStock(item, row.querySelector(".s")?.value); return this.render({ force: true }); }
    if (a === "assign") return this.assign(item);
    normalizeShopCurrency();
    if (!game.user?.isGM) return this.playerBuy(item, row.querySelector(".q")?.value);
    diag("GM_BUY_DIRECT", { vendorId: this.vendor?.id, buyerId: this.buyer?.id, itemId: item?.id, quantity: row.querySelector(".q")?.value });
    const ok = await buy({ vendor: this.vendor, buyer: this.buyer, item, quantity: row.querySelector(".q")?.value });
    if (ok && game.user?.isGM) this.render({ force: true });
  }

  async assign(item) {
    if (!this.buyer) return alertBox("Aucun acteur", "Choisis d’abord un acteur acheteur présent sur la scène.");
    const r = await assignItemToToken({ vendor: this.vendor, item, token: { actor: this.buyer, name: this.buyer.name }, quantity: 1 });
    r.ok ? ui.notifications.info(r.message) : ui.notifications.warn(r.message);
    this.render({ force: true });
  }
}

const registry = () => globalThis.__ADD2E_MERCHANT_UNIT_APPS ??= new Map();
function openLock(actor) { const id = `${game.user?.id}:${actor?.id}`; const now = Date.now(); const m = globalThis.__ADD2E_MERCHANT_OPEN_LOCK ??= {}; if (m[id] && now - m[id] < 750) return false; m[id] = now; return true; }
async function openFromToken(token) { if (!isVendorActor(token?.actor) || !openLock(token.actor)) return false; await openVendor({ vendor: token.actor, buyer: getBuyer() }); return true; }
export async function openVendor({ vendor = null, buyer = null } = {}) { vendor = vendor ?? findVendor(); if (!vendor && game.user?.isGM) vendor = await createVendor(); if (!vendor) return alertBox("Marchand introuvable", "Le marchand doit être créé côté MJ."); buyer = buyer ?? getBuyer(); if (!buyer && !game.user?.isGM) return alertBox("Aucun acheteur", "Aucun personnage assigné ou sélectionné."); const id = `${game.user?.id}:${vendor.id}`; const old = registry().get(id); if (old?.rendered) { old.vendor = vendor; old.buyer = buyer; old.render({ force: true }); old.bringToFront?.(); return old; } const app = new Add2eMerchantApp({ vendor, buyer }); registry().set(id, app); app.render({ force: true }); return app; }
export function bindAllVendorTokens() { for (const token of canvas?.tokens?.placeables ?? []) { if (!isVendorActor(token?.actor) || token.__add2eMerchantTapV4) continue; token.__add2eMerchantTapV4 = true; try { token.cursor = "pointer"; token.eventMode = "static"; token.interactive = true; token.on?.("pointertap", ev => { ev?.stopPropagation?.(); openFromToken(token); }); token.on?.("pointerup", ev => { ev?.stopPropagation?.(); openFromToken(token); }); } catch (_e) {} } }
export function patchVendorTokenClick() { if (globalThis.__ADD2E_MERCHANT_UNIT_CLICK_V4) return; globalThis.__ADD2E_MERCHANT_UNIT_CLICK_V4 = true; const C = foundry?.canvas?.placeables?.Token ?? CONFIG?.Token?.objectClass ?? globalThis.Token; const p = C?.prototype; if (p && typeof p._onClickLeft === "function") { const old = p._onClickLeft; p._onClickLeft = function(event) { const result = old.call(this, event); if (isVendorActor(this.actor)) setTimeout(() => openFromToken(this), 0); return result; }; } Hooks.on("canvasReady", bindAllVendorTokens); Hooks.on("createToken", () => setTimeout(bindAllVendorTokens, 100)); Hooks.on("updateToken", () => setTimeout(bindAllVendorTokens, 100)); setTimeout(bindAllVendorTokens, 500); }
export function registerVendorDirectoryButton() { Hooks.on("renderActorDirectory", (_app, html) => { if (!game.user?.isGM) return; const root = html?.jquery ? html[0] : html; if (!root?.querySelector || root.querySelector(".add2e-open-default-vendor")) return; const button = document.createElement("button"); button.type = "button"; button.className = "add2e-open-default-vendor"; button.textContent = "Marchand"; button.addEventListener("click", () => openVendor()); root.querySelector(".directory-footer")?.prepend(button); }); }
export function registerUiGlobals() { game.add2e = game.add2e ?? {}; game.add2e.openVendor = openVendor; game.add2e.vendorAppVersion = VERSION; }
