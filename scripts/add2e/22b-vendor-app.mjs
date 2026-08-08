// ADD2E — ApplicationV2 générique de boutique sur catalogue compendium virtuel.
// Une seule UI pour le marchand général, l’armurier et les futurs types de boutique.
// Compatible Foundry V13/V14/V15.

import {
  findVendor,
  createVendor,
  getBuyer,
  getShopType,
  getShopDefinition,
  getShopDisplayItems,
  vendorKind,
  isStockItem,
  isAmmunition,
  isComponent,
  quantity,
  priceCopper,
  formatMoney,
  getMoney,
  shopBuyLocal,
  restockShop,
  setShopStock,
  assignShopItem,
  requestShopBuy,
  ownedShopQuantity,
  alertBox,
  esc,
  lower,
  slug
} from "./22a-vendor-core.mjs";
import {
  findArmorer,
  createArmorer,
  armorerKind,
  usabilityForActor
} from "./22c-armorer-core.mjs";

export const ADD2E_SHOP_APP_VERSION = "2026-08-08-generic-shop-app-v1";

const SHOP_APPS = new Map();
const SHOP_TOKEN_BINDINGS = new WeakSet();
let shopTokenHooksRegistered = false;
let shopDirectoryHookRegistered = false;

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

function canonicalName(name) {
  const raw = String(name ?? "").trim();
  return COMPONENT_NAME_ALIASES.get(slug(raw)) ?? raw;
}

function shopType(value) {
  const type = getShopType(value);
  return type === "vendor" ? "general" : type;
}

function shopKindKey(item) {
  const raw = String(item?._shop?.kind ?? "").trim();
  if (raw) return slug(raw);
  if (isComponent(item)) return "component";
  if (isAmmunition(item)) return "projectile";
  return slug(item?.type ?? "item") || "item";
}

function shopKindLabel(item, type) {
  if (type === "general") return vendorKind(item);
  if (type === "armorer") return armorerKind(item);
  const key = shopKindKey(item);
  const labels = {
    weapon: "Arme",
    arme: "Arme",
    armor: "Armure",
    armure: "Armure",
    projectile: "Projectile",
    ammunition: "Projectile",
    component: "Composant",
    equipment: "Équipement",
    item: "Article"
  };
  return labels[key] ?? key.replaceAll("_", " ").replace(/^./, char => char.toUpperCase());
}

function canonicalItemName(item, type) {
  return type === "general" && vendorKind(item) === "Composant" ? canonicalName(item?.name) : String(item?.name ?? "");
}

function sceneActors() {
  const actors = new Map();
  for (const token of canvas?.tokens?.placeables ?? []) {
    const actor = token?.actor;
    if (actor?.id && !getShopDefinition(actor)) actors.set(actor.id, actor);
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
  return uniq([...declaredSpellNames(item), item?.name, canonicalName(item?.name)].map(value => String(value ?? "").trim()).filter(Boolean));
}

function materialNames(value, names = []) {
  for (const entry of arr(value)) {
    if (Array.isArray(entry)) {
      materialNames(entry, names);
      continue;
    }
    if (!entry) continue;
    if (typeof entry === "string") {
      names.push(entry);
      continue;
    }
    if (typeof entry === "object") {
      if (Array.isArray(entry.alternatives)) {
        materialNames(entry.alternatives, names);
        continue;
      }
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
  if (typeof globalThis.add2eGetTotalMemorizedCount !== "function") throw new Error("Le résolveur canonique de mémorisation ADD2E est indisponible.");
  const value = Number(globalThis.add2eGetTotalMemorizedCount(spell));
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function spells(actor) {
  return Array.from(actor?.items ?? [])
    .filter(item => String(item?.type ?? "").toLowerCase() === "sort" && !item.system?.isPower && !item.system?.isObjectPower)
    .sort((left, right) => String(left.name).localeCompare(String(right.name), "fr"));
}

function componentUsage(actor, item) {
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

function ownedQuantity(actor, item) {
  return actor && item ? ownedShopQuantity(actor, item) : 0;
}

function articleLabel(context, item) {
  const name = canonicalItemName(item, context.shopType);
  return context.buyer ? `${name} (${ownedQuantity(context.buyer, item)})` : name;
}

function itemTags(item) {
  const system = item?.system ?? {};
  const flags = item?.flags?.add2e ?? {};
  return [system.tags, system.effectTags, system.effecttags, flags.tags, flags.effectTags, flags.effecttags].flatMap(arr).map(value => lower(value)).filter(Boolean);
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
  const values = [system.categorie, system.category, system.sousType, system.sous_type, system.subtype, system.kind, system.slot, ...itemTags(item)]
    .map(value => String(value ?? "").trim())
    .filter(Boolean);
  return normalizeSectionLabel(values.join(" "));
}

function sectionRank(name) {
  const order = ["Outils et matériel", "Herbes et ingrédients", "Vivres", "Éclairage", "Contenants", "Vêtements", "Transport et montures", "Services", "Divers"];
  const index = order.indexOf(name);
  return index >= 0 ? index : 500;
}

function itemTabs(item, context, use) {
  if (context.shopType === "general") {
    const kind = vendorKind(item);
    const tabs = [kind === "Composant" ? "components" : kind === "Projectile" ? "projectiles" : "bazaar"];
    if (use.prep > 0) tabs.push("prepared");
    if (use.known > 0) tabs.push("known");
    return tabs;
  }
  if (context.shopType === "armorer") {
    const kind = shopKindKey(item);
    if (kind === "projectile" || kind === "ammunition") return ["projectiles"];
    if (kind === "weapon" || kind === "arme") return ["weapons"];
    if (kind === "armor" || kind === "armure") return ["armors"];
    return ["other"];
  }
  return [`kind-${shopKindKey(item)}`];
}

function tabLabel(key) {
  const labels = {
    components: "Composants",
    projectiles: "Projectiles",
    bazaar: "Bazar",
    weapons: "Armes",
    armors: "Armures",
    other: "Autres"
  };
  return labels[key] ?? key.replace(/^kind-/, "").replaceAll("_", " ").replace(/^./, char => char.toUpperCase());
}

function contextTabs(context, computed) {
  const tabs = [["all", "Tous"]];
  if (context.shopType === "general") {
    const prepCount = computed.filter(entry => entry.use.prep > 0).length;
    const knownCount = computed.filter(entry => entry.use.known > 0).length;
    tabs.push(["prepared", `Mémorisés (${prepCount})`], ["known", `Connus (${knownCount})`]);
  }
  const keys = new Set();
  for (const entry of computed) for (const key of itemTabs(entry.item, context, entry.use)) {
    if (key !== "prepared" && key !== "known") keys.add(key);
  }
  const order = ["weapons", "armors", "components", "projectiles", "bazaar", "other"];
  const sorted = [...keys].sort((left, right) => {
    const li = order.indexOf(left);
    const ri = order.indexOf(right);
    return (li < 0 ? 100 : li) - (ri < 0 ? 100 : ri) || tabLabel(left).localeCompare(tabLabel(right), "fr");
  });
  tabs.push(...sorted.map(key => [key, tabLabel(key)]));
  return tabs;
}

function itemDetail(context, item, use) {
  if (context.shopType === "general" && vendorKind(item) === "Composant") {
    const names = displaySpellNames(item, use);
    return names.length ? names.join(", ") : "—";
  }
  if (context.shopType === "armorer") {
    const state = usabilityForActor(context.buyer, item);
    return state?.reason ? `${state.label} — ${state.reason}` : state?.label ?? "—";
  }
  return String(item?._shop?.sourceId ?? "—");
}

function itemMatchesContext(item, context, use) {
  const tabs = itemTabs(item, context, use);
  if (context.tab !== "all" && !tabs.includes(context.tab)) return false;
  const detail = itemDetail(context, item, use);
  const haystack = lower(`${item.name} ${canonicalItemName(item, context.shopType)} ${shopKindLabel(item, context.shopType)} ${detail} ${bazaarSection(item)}`);
  return !context.search || haystack.includes(lower(context.search));
}

function actionButton(action, icon, title, disabled = false) {
  return `<button type="button" class="add2e-shop-action icon-only" data-action="${action}" title="${esc(title)}" aria-label="${esc(title)}" ${disabled ? 'disabled aria-disabled="true"' : ""}><i class="fas ${icon}"></i></button>`;
}

function rowHtml(item, context, use) {
  const itemQty = quantity(item);
  const disabled = !context.buyer || itemQty <= 0;
  const typeLabel = shopKindLabel(item, context.shopType);
  const detail = itemDetail(context, item, use);
  const usability = context.shopType === "armorer" ? usabilityForActor(context.buyer, item) : null;
  const detailHtml = usability
    ? `<span class="add2e-shop-status-pill ${usability.usable === false ? "unusable" : ""}" title="${esc(usability.reason ?? "")}">${esc(usability.label ?? detail)}</span>`
    : esc(detail);
  const gm = context.isGM
    ? `<td class="add2e-shop-col-gm"><span class="add2e-shop-gm-actions"><input class="shop-stock" type="number" min="0" value="${itemQty}" title="Stock">${actionButton("stock", "fa-boxes-stacked", "Définir le stock")}${actionButton("assign", "fa-hand-holding", "Donner à l’acheteur", disabled)}</span></td>`
    : "";
  return `<tr data-id="${esc(item.id)}"><td class="add2e-shop-col-article">${esc(articleLabel(context, item))}</td><td class="add2e-shop-col-type"><span class="add2e-shop-type-pill">${esc(typeLabel)}</span></td><td class="add2e-shop-col-detail" title="${esc(detail)}">${detailHtml}</td><td class="add2e-shop-col-price">${esc(priceLabel(item))}</td><td class="add2e-shop-col-stock">${itemQty}</td><td class="add2e-shop-col-qty"><input class="shop-qty" type="number" min="1" value="1" title="Quantité"></td><td class="add2e-shop-col-action">${actionButton("buy", "fa-cart-shopping", "Acheter", disabled)}</td>${gm}</tr>`;
}

function tableHeader(context) {
  return `<thead><tr><th class="add2e-shop-col-article">Article</th><th class="add2e-shop-col-type">Type</th><th class="add2e-shop-col-detail">Détails</th><th class="add2e-shop-col-price">Prix</th><th class="add2e-shop-col-stock">Stock</th><th class="add2e-shop-col-qty">Qté</th><th class="add2e-shop-col-action"></th>${context.isGM ? '<th class="add2e-shop-col-gm">MJ</th>' : ""}</tr></thead>`;
}

function renderFlatTable(context, rows) {
  return `<div class="add2e-shop-scroll"><table class="add2e-shop-table">${tableHeader(context)}<tbody>${rows || `<tr><td colspan="${context.isGM ? 8 : 7}" class="add2e-shop-empty">Aucun article.</td></tr>`}</tbody></table></div>`;
}

function renderGeneralBazaar(context, computed) {
  const groups = new Map();
  for (const entry of computed) {
    if (!isStockItem(entry.item) || !itemMatchesContext(entry.item, context, entry.use)) continue;
    const section = bazaarSection(entry.item);
    if (!groups.has(section)) groups.set(section, []);
    groups.get(section).push(entry);
  }
  const sections = [...groups.entries()].sort(([left], [right]) => sectionRank(left) - sectionRank(right) || left.localeCompare(right, "fr"));
  if (!sections.length) return '<div class="add2e-shop-scroll"><p class="add2e-shop-empty">Aucun article dans le bazar.</p></div>';
  return `<div class="add2e-shop-scroll">${sections.map(([section, entries]) => {
    entries.sort((left, right) => canonicalItemName(left.item, context.shopType).localeCompare(canonicalItemName(right.item, context.shopType), "fr"));
    return `<details class="add2e-shop-section"><summary><span>${esc(section)}</span><strong>${entries.length}</strong></summary><table class="add2e-shop-table">${tableHeader(context)}<tbody>${entries.map(entry => rowHtml(entry.item, context, entry.use)).join("")}</tbody></table></details>`;
  }).join("")}</div>`;
}

async function confirmPlayerBuy(item, context, requested) {
  if (typeof globalThis.add2eDialogConfirm !== "function") throw new Error("L’API de fenêtre ADD2E est indisponible.");
  return globalThis.add2eDialogConfirm({
    add2eTheme: "parchment",
    add2ePrimaryAction: "yes",
    add2eClasses: ["add2e-shop-buy-confirm"],
    window: { title: "Confirmer l’achat" },
    content: `<p>Acheter <b>${requested} × ${esc(canonicalItemName(item, context.shopType))}</b> pour <b>${formatMoney(priceCopper(item) * requested)}</b> ?</p>`,
    yes: { label: "Acheter" },
    no: { label: "Annuler" },
    modal: true
  });
}

class Add2eShopApp extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "add2e-shop-{id}",
    classes: ["add2e", "add2e-shop-app"],
    tag: "section",
    window: { title: "Boutique ADD2E", resizable: true },
    position: { width: 1040, height: 650 }
  };

  constructor({ shop, buyer } = {}, options = {}) {
    super(options);
    this.shop = shop;
    this.buyer = buyer ?? getBuyer();
    this.tab = "all";
    this.search = "";
    this.itemsById = new Map();
  }

  get title() {
    const definition = getShopDefinition(this.shop);
    const label = this.shop?.name ?? definition?.label ?? "Boutique";
    return `${label}${this.buyer ? ` — ${this.buyer.name}` : ""}`;
  }

  async _prepareContext() {
    const definition = getShopDefinition(this.shop);
    if (!definition) throw new Error(`Type de boutique ADD2E inconnu pour ${this.shop?.name ?? "cet acteur"}.`);
    const items = await getShopDisplayItems(this.shop);
    this.itemsById = new Map(items.map(item => [String(item.id), item]));
    return {
      shop: this.shop,
      shopType: definition.id,
      definition,
      buyer: this.buyer,
      items,
      isGM: game.user?.isGM === true,
      tab: this.tab,
      search: this.search
    };
  }

  async _renderHTML(context) {
    const computed = context.items.map(item => ({ item, use: context.shopType === "general" ? componentUsage(context.buyer, item) : { known: 0, prep: 0, names: [] } }));
    const tabs = contextTabs(context, computed);
    if (!tabs.some(([key]) => key === this.tab)) this.tab = "all";
    context.tab = this.tab;
    const visible = computed.filter(entry => itemMatchesContext(entry.item, context, entry.use));
    const table = context.shopType === "general" && context.tab === "bazaar"
      ? renderGeneralBazaar(context, visible)
      : renderFlatTable(context, visible.map(entry => rowHtml(entry.item, context, entry.use)).join(""));
    const buyer = context.isGM
      ? `<select class="add2e-shop-buyer"><option value="">Gestion MJ</option>${buyerOptions(context.buyer?.id)}</select>`
      : `<b>${esc(context.buyer?.name ?? "aucun")}</b>`;
    const restock = context.isGM ? actionButton("restock", "fa-rotate", "Restock global") : "";
    const root = document.createElement("div");
    root.className = "add2e-dialog-shell add2e-shop-content";
    root.dataset.add2eDialogUi = ADD2E_SHOP_APP_VERSION;
    root.dataset.add2eDialogTheme = "parchment";
    root.dataset.add2eWindowClass = "add2e-shop-window";
    root.dataset.add2ePrimaryAction = "";
    root.innerHTML = `<div class="add2e-shop-summary"><span>Acheteur : ${buyer}</span><strong class="add2e-shop-money">${context.buyer ? esc(formatMoney(getMoney(context.buyer))) : ""}</strong></div><div class="add2e-shop-toolbar"><div class="add2e-shop-tabs">${tabs.map(([key, label]) => `<button type="button" data-tab="${esc(key)}" class="${context.tab === key ? "active" : ""}">${esc(label)}</button>`).join("")}</div>${restock}</div><input class="add2e-shop-search" value="${esc(context.search)}" placeholder="Recherche">${table}`;
    return root;
  }

  _replaceHTML(result, content) {
    content.replaceChildren(result);
  }

  async _onRender(context, options = {}) {
    await super._onRender?.(context, options);
    const root = this.element;
    if (!root?.querySelector) return;
    root.querySelector(".add2e-shop-buyer")?.addEventListener("change", event => {
      this.buyer = game.actors?.get?.(event.currentTarget.value) ?? null;
      this.render({ force: true });
    });
    root.querySelector(".add2e-shop-search")?.addEventListener("input", event => {
      this.search = event.currentTarget.value ?? "";
      this.render({ force: true });
    });
    root.querySelectorAll("button[data-tab]").forEach(button => button.addEventListener("click", event => {
      this.tab = event.currentTarget.dataset.tab ?? "all";
      this.render({ force: true });
    }));
    root.querySelectorAll("[data-action]").forEach(button => button.addEventListener("click", event => this.handleAction(event)));
  }

  rowItem(target) {
    const row = target?.closest?.("tr[data-id]");
    if (!row) return { row: null, item: null };
    return { row, item: this.itemsById.get(String(row.dataset.id ?? "")) ?? null };
  }

  async handleAction(event) {
    const action = event.currentTarget?.dataset?.action;
    if (!action) return;
    if (action === "restock") {
      if (game.user?.isGM) await restockShop(this.shop);
      return this.render({ force: true });
    }

    const { row, item } = this.rowItem(event.currentTarget);
    if (!row || !item) return;
    if (action === "stock") {
      if (!game.user?.isGM) return;
      await setShopStock(this.shop, item, row.querySelector(".shop-stock")?.value);
      return this.render({ force: true });
    }
    if (action === "assign") return this.assign(item);
    if (action !== "buy") return;

    const requested = Math.max(1, Math.floor(Number(row.querySelector(".shop-qty")?.value) || 1));
    if (!this.buyer) return alertBox("Aucun acheteur", "Choisis d’abord un acteur acheteur présent sur la scène.");
    if (quantity(item) < requested) return alertBox("Stock insuffisant", `${canonicalItemName(item, shopType(this.shop))} : stock disponible ${quantity(item)}.`);

    if (game.user?.isGM) {
      const result = await shopBuyLocal({ shop: this.shop, buyer: this.buyer, item, quantity: requested }, { confirm: true });
      if (!result.ok && !result.cancelled) await alertBox("Achat impossible", result.message);
      if (result.ok) ui.notifications?.info?.(result.message);
      if (result.ok) this.render({ force: true });
      return result.ok;
    }

    const context = { shopType: shopType(this.shop) };
    if (!await confirmPlayerBuy(item, context, requested)) return false;
    return requestShopBuy({ shop: this.shop, buyer: this.buyer, item, quantity: requested });
  }

  async assign(item) {
    if (!game.user?.isGM) return false;
    if (!this.buyer) return alertBox("Aucun acteur", "Choisis d’abord un acteur acheteur présent sur la scène.");
    const result = await assignShopItem({ shop: this.shop, buyer: this.buyer, item, quantity: 1 });
    result.ok ? ui.notifications?.info?.(result.message) : ui.notifications?.warn?.(result.message);
    this.render({ force: true });
    return result.ok;
  }
}

Hooks.on("add2eShopMoneyChanged", data => {
  for (const app of SHOP_APPS.values()) {
    if (!app?.rendered || app.shop?.id !== data?.shopId) continue;
    if (data?.buyerId && app.buyer?.id !== data.buyerId) continue;
    app.render({ force: true });
  }
});

async function resolveShop(type, shop = null) {
  if (shop && getShopDefinition(shop)) return shop;
  if (type === "general") {
    let actor = await findVendor();
    if (!actor && game.user?.isGM) actor = await createVendor();
    return actor;
  }
  if (type === "armorer") {
    let actor = findArmorer();
    if (!actor && game.user?.isGM) actor = await createArmorer();
    return actor;
  }
  return null;
}

export async function openShop({ shop = null, type = null, buyer = null } = {}) {
  const resolvedType = shopType(shop ?? type);
  shop = await resolveShop(resolvedType, shop);
  if (!shop) return alertBox("Boutique introuvable", "Le MJ doit créer cette boutique avant son utilisation.");
  const definition = getShopDefinition(shop);
  if (!definition) return alertBox("Boutique invalide", "Cet acteur ne possède pas de définition de boutique ADD2E.");
  buyer = buyer ?? getBuyer();
  if (!buyer && !game.user?.isGM) return alertBox("Aucun acheteur", "Aucun personnage assigné ou sélectionné.");

  const key = `${game.user?.id}:${shop.id}`;
  const current = SHOP_APPS.get(key);
  if (current?.rendered) {
    current.shop = shop;
    current.buyer = buyer;
    current.render({ force: true });
    current.bringToFront?.();
    return current;
  }
  const app = new Add2eShopApp({ shop, buyer });
  SHOP_APPS.set(key, app);
  app.render({ force: true });
  return app;
}

export function openVendor({ vendor = null, buyer = null } = {}) {
  return openShop({ shop: vendor, type: "general", buyer });
}

export function openArmorer({ armorer = null, buyer = null } = {}) {
  return openShop({ shop: armorer, type: "armorer", buyer });
}

async function openShopFromToken(token) {
  if (!getShopDefinition(token?.actor)) return false;
  await openShop({ shop: token.actor, buyer: getBuyer() });
  return true;
}

export function bindAllShopTokens() {
  for (const token of canvas?.tokens?.placeables ?? []) {
    if (!getShopDefinition(token?.actor) || SHOP_TOKEN_BINDINGS.has(token)) continue;
    SHOP_TOKEN_BINDINGS.add(token);
    try {
      token.cursor = "pointer";
      token.eventMode = "static";
      token.interactive = true;
      token.on?.("pointertap", event => {
        event?.stopPropagation?.();
        void openShopFromToken(token);
      });
    } catch (error) {
      console.warn("[ADD2E][SHOP][TOKEN_BIND]", token?.name ?? token?.id, error);
    }
  }
}

export function registerShopTokenHooks() {
  if (shopTokenHooksRegistered) return;
  shopTokenHooksRegistered = true;
  Hooks.on("canvasReady", bindAllShopTokens);
  Hooks.on("createToken", () => window.setTimeout(bindAllShopTokens, 50));
  Hooks.on("updateToken", () => window.setTimeout(bindAllShopTokens, 50));
  window.setTimeout(bindAllShopTokens, 250);
}

function directoryButton(root, className, label, callback) {
  if (root.querySelector(`.${className}`)) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = label;
  button.addEventListener("click", callback);
  root.querySelector(".directory-footer")?.prepend(button);
}

export function registerShopDirectoryButtons() {
  if (shopDirectoryHookRegistered) return;
  shopDirectoryHookRegistered = true;
  Hooks.on("renderActorDirectory", (_app, html) => {
    if (!game.user?.isGM) return;
    const root = html?.jquery ? html[0] : html;
    if (!root?.querySelector) return;
    directoryButton(root, "add2e-open-armorer", "Armurier", () => openArmorer());
    directoryButton(root, "add2e-open-default-vendor", "Marchand", () => openVendor());
  });
}

export function registerShopUiGlobals() {
  game.add2e = game.add2e ?? {};
  game.add2e.openShop = openShop;
  game.add2e.openVendor = openVendor;
  game.add2e.openArmorer = openArmorer;
  game.add2e.shopAppVersion = ADD2E_SHOP_APP_VERSION;
  globalThis.add2eOpenShop = openShop;
  globalThis.add2eOpenArmorer = openArmorer;
  globalThis.ADD2E_SHOP_APP_VERSION = ADD2E_SHOP_APP_VERSION;
}
