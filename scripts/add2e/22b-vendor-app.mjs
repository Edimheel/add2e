// ADD2E — Marchand V2 compact.
// Version : 2026-06-23-merchant-component-spell-links-v2

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

const VERSION = "2026-06-23-merchant-component-spell-links-v2";
const DIAG = "[ADD2E][MERCHANT_APP][BUY_DIAG]";

const arr = value => Array.isArray(value)
  ? value.flatMap(arr)
  : value == null || value === ""
    ? []
    : typeof value === "string"
      ? value.split(/[,;|\n]+/g).map(entry => entry.trim()).filter(Boolean)
      : [value];
const uniq = values => [...new Set(values.filter(Boolean))];

const COMPONENT_NAME_ALIASES = new Map(Object.entries({
  symbole_sacre: "Symbole sacré du clerc",
  symbole_sacre_du_clerc: "Symbole sacré du clerc",
  objet_divinatoire_similaire: "Jeu d’objets divinatoires",
  objets_divinatoires_similaires: "Jeu d’objets divinatoires",
  jeu_d_objets_divinatoires: "Jeu d’objets divinatoires",
  jeu_objets_divinatoires: "Jeu d’objets divinatoires",
  feuille_d_infusion_encore_humide: "Feuilles d’infusion encore humides",
  feuille_d_infusion_encore_humides: "Feuilles d’infusion encore humides",
  feuilles_d_infusion_encore_humide: "Feuilles d’infusion encore humides",
  feuilles_d_infusion_encore_humides: "Feuilles d’infusion encore humides",
  objet_similaire_au_chapelet_de_priere: "Chapelet de prière",
  objet_similaire_au_chapelet_de_prière: "Chapelet de prière",
  objet_similaire_ayant_la_meme_utilisation: "Chapelet de prière",
  objet_similaire_ayant_la_même_utilisation: "Chapelet de prière",
  livre_de_priere: "Livre de prière",
  livre_de_prière: "Livre de prière",
  gousse_ail: "Gousse d’ail",
  gousse_d_ail: "Gousse d’ail",
  poudre_argent: "Poudre d’argent",
  poudre_d_argent: "Poudre d’argent",
  eau_benite: "Eau bénite",
  eau_bénite: "Eau bénite",
  eau_maudite: "Eau maudite"
}));

function diag(label, data = {}) {
  console.warn(`${DIAG}[${label}]`, { user: game.user?.name, userId: game.user?.id, isGM: game.user?.isGM, version: VERSION, ...data });
}

function canonicalName(name) {
  const raw = String(name ?? "").trim();
  return COMPONENT_NAME_ALIASES.get(slug(raw)) ?? raw;
}

function canonicalItemName(item) {
  return vendorKind(item) === "Composant" ? canonicalName(item?.name) : String(item?.name ?? "");
}

function canonicalStockKey(item) {
  return vendorKind(item) === "Composant"
    ? `component:${slug(canonicalItemName(item))}`
    : `item:${item?.id ?? foundry.utils.randomID()}`;
}

function preferVisibleStockItem(left, right) {
  const leftQty = quantity(left);
  const rightQty = quantity(right);
  if (leftQty !== rightQty) return leftQty > rightQty ? left : right;
  const leftPrice = priceCopper(left);
  const rightPrice = priceCopper(right);
  if (leftPrice !== rightPrice) return leftPrice <= rightPrice ? left : right;
  return String(canonicalItemName(left)).localeCompare(String(canonicalItemName(right)), "fr") <= 0 ? left : right;
}

function collapseCanonicalStock(items = []) {
  const groups = new Map();
  for (const item of items) {
    const groupKey = canonicalStockKey(item);
    if (!groups.has(groupKey)) groups.set(groupKey, []);
    groups.get(groupKey).push(item);
  }
  return [...groups.values()]
    .map(group => group.length === 1 ? group[0] : group.reduce(preferVisibleStockItem, group[0]))
    .sort((left, right) => String(canonicalItemName(left)).localeCompare(String(canonicalItemName(right)), "fr"));
}

function isShopActor(actor) {
  return isVendorActor(actor) || actor?.getFlag?.("add2e", "isArmorer") === true || /armurier/i.test(String(actor?.name ?? ""));
}

function sceneActors() {
  const actors = new Map();
  for (const token of canvas?.tokens?.placeables ?? []) {
    const actor = token?.actor;
    if (actor?.id && !isShopActor(actor)) actors.set(actor.id, actor);
  }
  return [...actors.values()].sort((left, right) => String(left.name).localeCompare(String(right.name), "fr"));
}

function buyerOptions(selected = "") {
  return sceneActors().map(actor => `<option value="${esc(actor.id)}" ${actor.id === selected ? "selected" : ""}>${esc(actor.name)}</option>`).join("");
}

function priceLabel(item) {
  const raw = String(item?.system?.prix ?? item?.system?.cout ?? "").trim();
  return raw || formatMoney(priceCopper(item));
}

function declaredSpellNames(item) {
  if (vendorKind(item) !== "Composant") return [];
  const system = item?.system ?? {};
  const flags = item?.flags?.add2e ?? {};
  return uniq([
    ...arr(system.sorts_associes),
    ...arr(system.sortsAssocies),
    ...arr(system.spells),
    ...arr(system.spellNames),
    ...arr(flags.sorts_associes),
    ...arr(flags.sortsAssocies),
    ...arr(flags.spells),
    ...arr(flags.spellNames)
  ].map(value => String(value ?? "").trim()).filter(Boolean)).sort((left, right) => left.localeCompare(right, "fr"));
}

function linked(item) {
  return uniq([
    ...declaredSpellNames(item),
    item?.name,
    canonicalItemName(item)
  ].map(value => String(value ?? "").trim()).filter(Boolean));
}

function materialNames(value, names = []) {
  for (const entry of arr(value)) {
    if (Array.isArray(entry)) { materialNames(entry, names); continue; }
    if (!entry) continue;
    if (typeof entry === "string") { names.push(entry); continue; }
    if (typeof entry === "object") {
      if (Array.isArray(entry.alternatives)) { materialNames(entry.alternatives, names); continue; }
      const name = entry.nom ?? entry.name ?? entry.label ?? entry.item ?? entry.itemName ?? entry.component ?? entry.composant ?? entry.slug;
      if (name) names.push(name);
    }
  }
  return names;
}

function spellKeys(spell) {
  const system = spell?.system ?? {};
  const flags = spell?.flags?.add2e ?? {};
  return uniq([
    spell?.name,
    system.nom,
    system.slug,
    flags.slug,
    flags.importKey,
    ...materialNames(system.composants_materiels),
    ...materialNames(system.composants_materiels_objets),
    ...materialNames(system.composants_requis)
  ].map(value => String(value ?? "").trim()).filter(Boolean));
}

function memorized(spell) {
  try {
    const value = Number(globalThis.add2eGetTotalMemorizedCount?.(spell));
    if (Number.isFinite(value) && value > 0) return Math.floor(value);
  } catch (_error) {}
  const raw = spell?.getFlag?.("add2e", "memorizedByList") ?? spell?.flags?.add2e?.memorizedByList ?? {};
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return Object.values(raw).reduce((sum, value) => sum + (Number(value) || 0), 0);
  return Number(spell?.getFlag?.("add2e", "memorizedCount") ?? spell?.flags?.add2e?.memorizedCount ?? 0) || 0;
}

function spells(actor) {
  return Array.from(actor?.items ?? [])
    .filter(item => String(item?.type ?? "").toLowerCase() === "sort" && !item.system?.isPower && !item.system?.isObjectPower)
    .sort((left, right) => String(left.name).localeCompare(String(right.name), "fr"));
}

function usage(actor, item) {
  if (vendorKind(item) !== "Composant") return { known: 0, prep: 0, names: [] };
  const aliases = linked(item).map(value => slug(canonicalName(value)));
  if (!aliases.length) return { known: 0, prep: 0, names: [] };
  let known = 0;
  let prep = 0;
  const names = [];
  for (const spell of spells(actor)) {
    if (!spellKeys(spell).some(value => aliases.includes(slug(canonicalName(value))))) continue;
    known += 1;
    const count = memorized(spell);
    prep += count;
    names.push(count > 1 ? `${spell.name} ×${count}` : spell.name);
  }
  return { known, prep, names: uniq(names) };
}

function displaySpellNames(item, use) {
  const declared = declaredSpellNames(item);
  return declared.length ? declared : use.names;
}

function actorItemQty(item) {
  const value = quantity(item);
  return value > 0 ? value : 1;
}

function sameOwnedItem(vendorItem, actorItem) {
  if (!vendorItem || !actorItem) return false;
  const vendorName = slug(canonicalItemName(vendorItem));
  const actorName = slug(canonicalName(actorItem.name));
  if (!vendorName || vendorName !== actorName) return false;
  if (isAmmunition(vendorItem) || isAmmunition(actorItem)) return true;
  const vendorType = String(vendorItem.type ?? "").toLowerCase();
  const actorType = String(actorItem.type ?? "").toLowerCase();
  return !vendorType || !actorType || vendorType === actorType || vendorType === "objet" || actorType === "objet";
}

function ownedQuantity(actor, item) {
  if (!actor) return 0;
  return Array.from(actor.items ?? []).filter(actorItem => sameOwnedItem(item, actorItem)).reduce((sum, actorItem) => sum + actorItemQty(actorItem), 0);
}

function articleLabel(ctx, item) {
  const name = canonicalItemName(item);
  return ctx.buyer ? `${name} (${ownedQuantity(ctx.buyer, item)})` : name;
}

function itemTags(item) {
  const system = item?.system ?? {};
  const flags = item?.flags?.add2e ?? {};
  return [system.tags, system.effectTags, system.effecttags, flags.tags, flags.effectTags, flags.effecttags].flatMap(arr).map(value => lower(value)).filter(Boolean);
}

function isBazaarItem(item) {
  return isStockItem(item) && !isComponent(item) && !isAmmunition(item) && vendorKind(item) !== "Composant" && vendorKind(item) !== "Projectile";
}

function normalizeSectionLabel(raw = "") {
  const value = String(raw ?? "").trim();
  const label = lower(value);
  if (!label) return "Divers";
  if (/herbe|herbor|plante|ingredient|ingrédient|epice|épice|aromate|racine|baie|graine|feuille|fleur/.test(label)) return "Herbes et ingrédients";
  if (/outil|tools?|artisan|craft|metier|métier|crochet|corde|grappin/.test(label)) return "Outils et matériel";
  if (/vetement|vêtement|habit|robe|botte|chaussure|ceinture|cape/.test(label)) return "Vêtements";
  if (/nourriture|ration|vivre|eau|boisson|repas/.test(label)) return "Vivres";
  if (/lumiere|lumière|torche|lanterne|huile|bougie/.test(label)) return "Éclairage";
  if (/contenant|sac|sacoche|coffre|bourse|etui|étui|carquois|boite|boîte/.test(label)) return "Contenants";
  if (/monture|cheval|animal|chariot|charrette|selle|bride/.test(label)) return "Transport et montures";
  if (/service|logement|auberge/.test(label)) return "Services";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function bazaarSection(item) {
  const system = item?.system ?? {};
  const values = [system.categorie, system.category, system.sousType, system.sous_type, system.subtype, system.kind, system.slot, ...itemTags(item)].map(value => String(value ?? "").trim()).filter(Boolean);
  return normalizeSectionLabel(values.join(" "));
}

function sectionRank(name) {
  const order = ["Outils et matériel", "Herbes et ingrédients", "Vivres", "Éclairage", "Contenants", "Vêtements", "Transport et montures", "Services", "Divers"];
  const index = order.indexOf(name);
  return index >= 0 ? index : 500;
}

function rowTabs(item, use) {
  const kind = vendorKind(item);
  const tabs = [kind === "Composant" ? "components" : kind === "Projectile" ? "projectiles" : "bazaar"];
  if (use.prep > 0) tabs.push("prepared");
  if (use.known > 0) tabs.push("known");
  return tabs;
}

function actionIcon(action, icon, title, disabled = false, extraClass = "") {
  const disabledAttrs = disabled ? 'aria-disabled="true" data-disabled="1"' : `data-action="${action}" role="button" tabindex="0"`;
  return `<i class="fas ${icon} add2e-vendor-action-icon ${extraClass} ${disabled ? "disabled" : ""}" title="${esc(title)}" aria-label="${esc(title)}" ${disabledAttrs}></i>`;
}

function rowHtml(item, ctx, use, visible = true) {
  const kind = vendorKind(item);
  const itemQty = quantity(item);
  const disabled = !ctx.buyer || itemQty <= 0;
  const names = displaySpellNames(item, use);
  const spellLabel = names.length ? names.join(", ") : "—";
  const gm = ctx.isGM ? `<td class="col-mj add2e-vendor-gm-actions"><input class="s stock-input" type="number" min="0" value="${itemQty}" title="Stock"><span class="vendor-icon-group">${actionIcon("stock", "fa-boxes-stacked", "Définir le stock", false, "stock")} ${actionIcon("assign", "fa-hand-holding", "Donner à l’acheteur", disabled, "assign")}</span></td>` : "";
  return `<tr data-id="${esc(item.id)}" style="${visible ? "" : "display:none"}"><td class="col-article">${esc(articleLabel(ctx, item))}</td><td class="col-type" title="${esc(kind)}"><span class="type-pill">${esc(kind)}</span></td><td class="col-sorts" title="${esc(spellLabel)}">${esc(spellLabel)}</td><td class="col-prix">${esc(priceLabel(item))}</td><td class="col-stock">${itemQty}</td><td class="col-qty"><input class="q" type="number" min="1" value="1" title="Quantité"></td><td class="col-action">${actionIcon("buy", "fa-cart-shopping", "Acheter", disabled, "buy")}</td>${gm}</tr>`;
}

function itemVisibleForContext(item, ctx, use) {
  const tabs = rowTabs(item, use);
  const spellNames = displaySpellNames(item, use);
  const haystack = lower(`${item.name} ${canonicalItemName(item)} ${articleLabel(ctx, item)} ${vendorKind(item)} ${bazaarSection(item)} ${spellNames.join(" ")}`);
  return (ctx.tab === "all" || tabs.includes(ctx.tab)) && (!ctx.search || haystack.includes(lower(ctx.search)));
}

function tableHeader(ctx) {
  return `<thead><tr><th class="col-article">Article</th><th class="col-type">Type</th><th class="col-sorts">Sorts</th><th class="col-prix">Prix</th><th class="col-stock">Stock</th><th class="col-qty">Qté</th><th class="col-action"></th>${ctx.isGM ? '<th class="col-mj">MJ</th>' : ""}</tr></thead>`;
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
  const sections = [...groups.entries()].sort(([left], [right]) => sectionRank(left) - sectionRank(right) || left.localeCompare(right, "fr"));
  if (!sections.length) return '<div class="add2e-vendor-scroll"><p class="a2e-muted">Aucun article dans le bazard.</p></div>';
  return `<div class="add2e-vendor-scroll add2e-vendor-bazaar-list">${sections.map(([section, entries]) => {
    entries.sort((left, right) => String(canonicalItemName(left.item)).localeCompare(String(canonicalItemName(right.item)), "fr"));
    const rows = entries.map(entry => rowHtml(entry.item, ctx, entry.use, true)).join("");
    return `<details class="add2e-vendor-bazaar-section"><summary><span>${esc(section)}</span><strong>${entries.length}</strong></summary><table class="add2e-vendor-table">${tableHeader(ctx)}<tbody>${rows}</tbody></table></details>`;
  }).join("")}</div>`;
}

function vendorStyle() {
  return `<style>.add2e-merchant-app{background:#e7d29a;color:#2b2113}.add2e-merchant-app section{background:linear-gradient(180deg,#f0dfab 0%,#e4c985 100%);padding:0 .65rem .65rem}.add2e-merchant-app p{margin:.45rem 0 .5rem;padding:.42rem .6rem;border:1px solid rgba(110,76,23,.22);border-radius:8px;background:rgba(255,250,236,.76)}.add2e-merchant-app select.buyer,.add2e-merchant-app input.search{border:1px solid rgba(88,56,13,.45);border-radius:7px;background:#fffbf0;color:#2d210f;font-weight:800}.add2e-merchant-app input.search{width:100%;box-sizing:border-box;margin:.35rem 0 .6rem;padding:.4rem .6rem}.add2e-merchant-app button[data-tab]{height:28px;margin:0 .22rem .38rem 0;padding:0 .7rem;border:1px solid rgba(81,52,16,.42);border-radius:7px;background:linear-gradient(180deg,#6a4518,#49300f);color:#f8e7b4;font-weight:900}.add2e-merchant-app button[data-tab][style*="outline"]{background:linear-gradient(180deg,#d8ad56,#9a6d23)!important;color:#201506;outline:2px solid rgba(255,255,255,.9)!important}.add2e-merchant-app .add2e-vendor-toolbar-icon{display:inline-flex;margin:0 0 .38rem .28rem;color:#4b3210;font-size:1.05rem;cursor:pointer}.add2e-merchant-app .add2e-vendor-scroll{max-height:420px;overflow-y:auto;padding-right:6px;margin-top:6px}.add2e-merchant-app .add2e-vendor-bazaar-section{display:block;margin:0 0 8px;border:1px solid rgba(76,51,16,.32);border-radius:9px;background:rgba(255,248,226,.56);overflow:hidden}.add2e-merchant-app .add2e-vendor-bazaar-section>summary{cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 11px;background:linear-gradient(180deg,#4a3418,#33240f);color:#f4dc9d;font-weight:900}.add2e-merchant-app .add2e-vendor-bazaar-section:not([open]) table{display:none}.add2e-merchant-app .add2e-vendor-table{width:100%;table-layout:fixed;border-collapse:collapse;background:#fff7df}.add2e-merchant-app th{position:sticky;top:0;background:#5a3a12;color:#f5e1a9;text-transform:uppercase;font-size:.74em;padding:.34rem .42rem}.add2e-merchant-app td{padding:.24rem .42rem;border-bottom:1px solid rgba(99,70,24,.16);overflow:hidden;text-overflow:ellipsis}.add2e-merchant-app tr:nth-child(odd){background:#fffaf0}.add2e-merchant-app tr:nth-child(even){background:#f6edcf}.add2e-merchant-app tr:hover{background:#f3dda2}.add2e-merchant-app .col-article{width:24%;font-weight:900;white-space:nowrap}.add2e-merchant-app .col-type{width:9%;white-space:nowrap}.add2e-merchant-app .col-sorts{width:27%;white-space:normal;line-height:1.25;color:#5c492a;font-size:.86em}.add2e-merchant-app .col-prix{width:8%;white-space:nowrap;font-weight:900;color:#4d3107}.add2e-merchant-app .col-stock{width:6%;white-space:nowrap;text-align:center;font-weight:900}.add2e-merchant-app .col-qty{width:6%;white-space:nowrap;text-align:center}.add2e-merchant-app .col-action{width:5%;white-space:nowrap;text-align:center}.add2e-merchant-app .col-mj{width:15%;white-space:nowrap;text-align:right}.add2e-merchant-app .type-pill{display:inline-flex;max-width:100%;padding:1px 7px;border-radius:999px;background:#ead79b;color:#352408;font-size:.82em;font-weight:900}.add2e-merchant-app .q,.add2e-merchant-app .s{height:23px;min-height:23px;text-align:center;border:1px solid rgba(120,82,28,.42);border-radius:6px;background:#fffdf2;color:#2d210f;font-weight:900}.add2e-merchant-app .q{width:42px}.add2e-merchant-app .stock-input{width:48px;margin-right:5px}.add2e-merchant-app .vendor-icon-group{display:inline-flex;gap:8px}.add2e-merchant-app .add2e-vendor-action-icon{display:inline-flex;align-items:center;justify-content:center;min-width:16px;padding:0;border:0;background:transparent;font-size:1.02rem;color:#4b3210;cursor:pointer}.add2e-merchant-app .add2e-vendor-action-icon.buy{color:#1f6b37}.add2e-merchant-app .add2e-vendor-action-icon.assign{color:#235a8d}.add2e-merchant-app .add2e-vendor-action-icon.disabled{opacity:.28;cursor:not-allowed}</style>`;
}

async function confirmPlayerBuy(item, qty) {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  const total = formatMoney(priceCopper(item) * qty);
  diag("PLAYER_CONFIRM_OPEN", { item: item?.name, itemId: item?.id, qty, total });
  const ok = await (DialogV2?.confirm?.({ window: { title: "Confirmer l’achat" }, content: `<p>Acheter <b>${qty} × ${esc(canonicalItemName(item))}</b> pour <b>${total}</b> ?</p>`, yes: { label: "Acheter" }, no: { label: "Annuler" }, modal: true }) ?? false);
  diag("PLAYER_CONFIRM_CLOSE", { item: item?.name, itemId: item?.id, qty, ok });
  return ok;
}

class Add2eMerchantApp extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = { id: "add2e-merchant-{id}", classes: ["add2e", "add2e-merchant-app"], tag: "section", window: { title: "Marchand ADD2E", resizable: true }, position: { width: 980, height: 620 } };

  constructor({ vendor, buyer } = {}, options = {}) {
    super(options);
    this.vendor = vendor;
    this.buyer = buyer ?? getBuyer();
    this.tab = "all";
    this.search = "";
  }

  get title() { return `${this.vendor?.name ?? "Marchand"}${this.buyer ? ` — ${this.buyer.name}` : ""}`; }

  stock() { return collapseCanonicalStock(Array.from(this.vendor?.items ?? []).filter(isStockItem)); }

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
      if (entry.use.prep > 0) prepCount += 1;
      if (entry.use.known > 0) knownCount += 1;
    }
    const nav = [["all", "Tous"], ["prepared", `Mémorisés (${prepCount})`], ["known", `Connus (${knownCount})`], ["components", "Composants"], ["projectiles", "Projectiles"], ["bazaar", "Bazard"]]
      .map(([id, label]) => `<button data-tab="${id}" ${ctx.tab === id ? "style='outline:2px solid #fff'" : ""}>${label}</button>`).join("");
    const visibleRows = computed.filter(({ item, use }) => ctx.tab !== "bazaar" && itemVisibleForContext(item, ctx, use)).map(({ item, use }) => rowHtml(item, ctx, use, true)).join("");
    const list = ctx.tab === "bazaar" ? renderBazaarAccordion(ctx) : renderFlatTable(ctx, visibleRows || `<tr><td colspan="${ctx.isGM ? 8 : 7}" class="a2e-muted">Aucun article.</td></tr>`);
    const buyer = ctx.isGM ? `<select class="buyer">${buyerOptions(ctx.buyer?.id)}</select>` : `<b>${esc(ctx.buyer?.name ?? "aucun")}</b>`;
    const restock = ctx.isGM ? '<i class="fas fa-rotate add2e-vendor-toolbar-icon" data-action="restock" role="button" tabindex="0" title="Restock global" aria-label="Restock global"></i>' : "";
    const div = document.createElement("section");
    div.innerHTML = `${vendorStyle()}<p><span>Acheteur :</span> ${buyer} <strong>${ctx.buyer ? esc(formatMoney(getMoney(ctx.buyer))) : ""}</strong></p><div>${nav}${restock}</div><input class="search" value="${esc(ctx.search)}" placeholder="Recherche">${list}`;
    return div;
  }

  _replaceHTML(result, content) { content.replaceChildren(result); }

  async _onRender(context, options) {
    await super._onRender?.(context, options);
    const root = this.element;
    root.querySelector(".buyer")?.addEventListener("change", event => { this.buyer = game.actors.get(event.currentTarget.value) ?? this.buyer; this.render({ force: true }); });
    root.querySelector(".search")?.addEventListener("input", event => { this.search = event.currentTarget.value ?? ""; this.render({ force: true }); });
    root.querySelectorAll("button[data-tab]").forEach(button => button.addEventListener("click", event => { this.tab = event.currentTarget.dataset.tab; this.render({ force: true }); }));
    root.querySelectorAll("[data-action]").forEach(button => button.addEventListener("click", event => this.click(event)));
  }

  async playerBuy(item, qty) {
    qty = Math.max(1, Math.floor(Number(qty) || 1));
    diag("PLAYER_BUY_ENTER", { vendor: this.vendor?.name, vendorId: this.vendor?.id, buyer: this.buyer?.name, buyerId: this.buyer?.id, buyerUuid: this.buyer?.uuid, item: item?.name, itemId: item?.id, qty, stock: quantity(item) });
    if (!this.vendor || !this.buyer || !item) return false;
    if (quantity(item) < qty) return alertBox("Stock insuffisant", `${canonicalItemName(item)} : stock disponible ${quantity(item)}.`).then(() => false);
    if (!await confirmPlayerBuy(item, qty)) return false;
    const requestId = foundry.utils.randomID();
    diag("PLAYER_BUY_EMIT", { socketType: ADD2E_VENDOR_PLAYER_BUY, requestId, vendorId: this.vendor.id, buyerId: this.buyer.id, buyerUuid: this.buyer.uuid, itemId: item.id, qty });
    game.socket?.emit?.("system.add2e", { type: ADD2E_VENDOR_PLAYER_BUY, requestId, userId: game.user.id, vendorId: this.vendor.id, buyerId: this.buyer.id, buyerUuid: this.buyer.uuid, itemId: item.id, quantity: qty });
    return true;
  }

  async click(event) {
    if (event.currentTarget?.dataset?.disabled === "1") return;
    const action = event.currentTarget.dataset.action;
    diag("CLICK", { action, isGM: game.user?.isGM });
    if (action === "restock") { await restockAll(this.vendor); return this.render({ force: true }); }
    const row = event.currentTarget.closest("tr");
    const item = this.vendor.items.get(row?.dataset.id);
    if (action === "stock") { await setStock(item, row.querySelector(".s")?.value); return this.render({ force: true }); }
    if (action === "assign") return this.assign(item);
    normalizeShopCurrency();
    if (!game.user?.isGM) return this.playerBuy(item, row.querySelector(".q")?.value);
    diag("GM_BUY_DIRECT", { vendorId: this.vendor?.id, buyerId: this.buyer?.id, itemId: item?.id, quantity: row.querySelector(".q")?.value });
    const ok = await buy({ vendor: this.vendor, buyer: this.buyer, item, quantity: row.querySelector(".q")?.value });
    if (ok) this.render({ force: true });
  }

  async assign(item) {
    if (!this.buyer) return alertBox("Aucun acteur", "Choisis d’abord un acteur acheteur présent sur la scène.");
    const result = await assignItemToToken({ vendor: this.vendor, item, token: { actor: this.buyer, name: this.buyer.name }, quantity: 1 });
    result.ok ? ui.notifications.info(result.message) : ui.notifications.warn(result.message);
    this.render({ force: true });
  }
}

const registry = () => globalThis.__ADD2E_MERCHANT_UNIT_APPS ??= new Map();

function openLock(actor) {
  const id = `${game.user?.id}:${actor?.id}`;
  const now = Date.now();
  const locks = globalThis.__ADD2E_MERCHANT_OPEN_LOCK ??= {};
  if (locks[id] && now - locks[id] < 750) return false;
  locks[id] = now;
  return true;
}

async function openFromToken(token) {
  if (!isVendorActor(token?.actor) || !openLock(token.actor)) return false;
  await openVendor({ vendor: token.actor, buyer: getBuyer() });
  return true;
}

export async function openVendor({ vendor = null, buyer = null } = {}) {
  vendor = vendor ?? findVendor();
  if (!vendor && game.user?.isGM) vendor = await createVendor();
  if (!vendor) return alertBox("Marchand introuvable", "Le marchand doit être créé côté MJ.");
  buyer = buyer ?? getBuyer();
  if (!buyer && !game.user?.isGM) return alertBox("Aucun acheteur", "Aucun personnage assigné ou sélectionné.");
  const id = `${game.user?.id}:${vendor.id}`;
  const old = registry().get(id);
  if (old?.rendered) {
    old.vendor = vendor;
    old.buyer = buyer;
    old.render({ force: true });
    old.bringToFront?.();
    return old;
  }
  const app = new Add2eMerchantApp({ vendor, buyer });
  registry().set(id, app);
  app.render({ force: true });
  return app;
}

export function bindAllVendorTokens() {
  for (const token of canvas?.tokens?.placeables ?? []) {
    if (!isVendorActor(token?.actor) || token.__add2eMerchantTapV4) continue;
    token.__add2eMerchantTapV4 = true;
    try {
      token.cursor = "pointer";
      token.eventMode = "static";
      token.interactive = true;
      token.on?.("pointertap", event => { event?.stopPropagation?.(); openFromToken(token); });
      token.on?.("pointerup", event => { event?.stopPropagation?.(); openFromToken(token); });
    } catch (_error) {}
  }
}

export function patchVendorTokenClick() {
  if (globalThis.__ADD2E_MERCHANT_UNIT_CLICK_V4) return;
  globalThis.__ADD2E_MERCHANT_UNIT_CLICK_V4 = true;
  const TokenClass = foundry?.canvas?.placeables?.Token ?? CONFIG?.Token?.objectClass ?? globalThis.Token;
  const prototype = TokenClass?.prototype;
  if (prototype && typeof prototype._onClickLeft === "function") {
    const original = prototype._onClickLeft;
    prototype._onClickLeft = function(event) {
      const result = original.call(this, event);
      if (isVendorActor(this.actor)) setTimeout(() => openFromToken(this), 0);
      return result;
    };
  }
  Hooks.on("canvasReady", bindAllVendorTokens);
  Hooks.on("createToken", () => setTimeout(bindAllVendorTokens, 100));
  Hooks.on("updateToken", () => setTimeout(bindAllVendorTokens, 100));
  setTimeout(bindAllVendorTokens, 500);
}

export function registerVendorDirectoryButton() {
  Hooks.on("renderActorDirectory", (_app, html) => {
    if (!game.user?.isGM) return;
    const root = html?.jquery ? html[0] : html;
    if (!root?.querySelector || root.querySelector(".add2e-open-default-vendor")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "add2e-open-default-vendor";
    button.textContent = "Marchand";
    button.addEventListener("click", () => openVendor());
    root.querySelector(".directory-footer")?.prepend(button);
  });
}

export function registerUiGlobals() {
  game.add2e = game.add2e ?? {};
  game.add2e.openVendor = openVendor;
  game.add2e.vendorAppVersion = VERSION;
}
