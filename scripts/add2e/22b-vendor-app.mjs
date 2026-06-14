// ADD2E — ApplicationV2 vendeur : onglets, recherche, achats et restock MJ.
// Version : 2026-06-14-vendor-player-safe-components-v5

import {
  isVendorActor,
  findVendor,
  createVendor,
  getBuyer,
  vendorKind,
  isStockItem,
  quantity,
  priceCopper,
  formatMoney,
  getMoney,
  buyLocal,
  setStock,
  restockAll,
  assignItemToToken,
  sceneTokenChoices,
  alertBox,
  esc,
  lower
} from "./22a-vendor-core.mjs";

const ADD2E_VENDOR_APP_VERSION = "2026-06-14-vendor-player-safe-components-v5";
const SOCKET_BUY_V2 = "ADD2E_VENDOR_BUY_REQUEST_V2";
const SOCKET_BUY_RESULT_V2 = "ADD2E_VENDOR_BUY_RESULT_V2";

const ADD2E_VENDOR_STYLE = `
  .add2e-vendor-root{height:100%;max-height:100%;display:flex;flex-direction:column;overflow:hidden;background:linear-gradient(180deg,#fff8df,#ead39b);color:#2f250c;font-family:var(--font-primary,serif)}
  .add2e-vendor-root *{box-sizing:border-box}.add2e-vendor-header{flex:0 0 auto;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border-bottom:1px solid #b98b2d;background:linear-gradient(180deg,#5a3511,#2f1b08);color:#ffe7a8}.add2e-vendor-header h2{margin:0;color:#ffe7a8;font-weight:950;line-height:1.1;text-shadow:0 1px 2px #000}.add2e-vendor-header p{margin:4px 0 0;color:#fff2c2}.add2e-vendor-money{padding:6px 10px;border:1px solid #d9bf73;border-radius:999px;background:#fff3c7;color:#3a2208;font-weight:950;white-space:nowrap;box-shadow:inset 0 0 0 1px rgba(255,255,255,.35)}
  .add2e-vendor-buyer-select{margin-left:6px;min-height:28px;min-width:240px;max-width:360px;border:1px solid #d9bf73;border-radius:7px;background:#fffaf0;color:#2f250c;font-weight:900;padding:3px 7px}.add2e-vendor-buyer-label{display:inline-flex;align-items:center;gap:5px;flex-wrap:wrap;color:#fff2c2;font-weight:800}
  .add2e-vendor-tabs{flex:0 0 auto;display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid #d9bf73;background:#f6e2ad;flex-wrap:wrap}.add2e-vendor-tabs button{border:1px solid #8d641b;border-radius:8px;background:linear-gradient(180deg,#7b4b16,#4b2b0b);color:#ffe7a8;font-weight:900;padding:5px 10px;line-height:1.2;min-height:28px;cursor:pointer}.add2e-vendor-tabs button.active{box-shadow:0 0 0 2px #f0c36a inset;filter:brightness(1.12)}.add2e-vendor-tabs button:disabled,.add2e-vendor-icon-btn:disabled{opacity:.45;cursor:not-allowed;filter:grayscale(.8)}.add2e-vendor-restock-all{margin-left:auto}
  .add2e-vendor-search{flex:0 0 auto;padding:10px 14px;border-bottom:1px solid #d9bf73;background:#fff1bf}.add2e-vendor-search-input{width:100%;min-height:30px;padding:5px 9px;border:1px solid #b98b2d;border-radius:8px;background:#fffaf0;color:#2f250c;font-weight:700}.add2e-vendor-table-wrap{flex:1 1 auto;min-height:0;overflow-y:auto!important;overflow-x:hidden;padding:12px 14px 16px}.add2e-vendor-table{width:100%;border-collapse:collapse;table-layout:auto;background:rgba(255,252,242,.94);border:1px solid #d9bf73;color:#2f250c}.add2e-vendor-table th{position:sticky;top:0;z-index:2;background:#e8d08f;color:#2f250c;border-bottom:1px solid #b98b2d;padding:7px 8px;text-align:left;font-weight:950}.add2e-vendor-table td{padding:5px 7px;border-bottom:1px solid #e0c982;vertical-align:middle;color:#2f250c;font-weight:750}.add2e-vendor-table tbody tr:nth-child(even){background:rgba(242,222,169,.35)}.add2e-vendor-table tbody tr:hover{background:rgba(255,231,168,.7)}.add2e-vendor-table tr.add2e-vendor-missing{background:rgba(160,40,20,.12)!important}
  .add2e-vendor-item{min-width:230px}.add2e-vendor-item-wrap{display:flex;align-items:center;gap:8px;min-width:0}.add2e-vendor-item img{width:34px!important;height:34px!important;min-width:34px!important;max-width:34px!important;max-height:34px!important;object-fit:contain!important;border:1px solid #b98b2d;border-radius:6px;background:#f8edc7}.add2e-vendor-item span{font-weight:950;color:#2f250c;white-space:normal;line-height:1.2}.add2e-vendor-buy-qty,.add2e-vendor-restock-qty{width:54px!important;min-width:54px!important;max-width:54px!important;text-align:center;border:1px solid #b98b2d;border-radius:6px;background:#fffaf0;color:#2f250c;font-weight:900;min-height:26px}.add2e-vendor-actions,.add2e-vendor-gm-actions{display:flex;align-items:center;gap:5px;flex-wrap:nowrap}.add2e-vendor-icon-btn{width:28px;height:28px;min-width:28px;max-width:28px;padding:0;border:1px solid #8d641b;border-radius:7px;background:linear-gradient(180deg,#7b4b16,#4b2b0b);color:#ffe7a8;display:inline-flex;align-items:center;justify-content:center;cursor:pointer}.add2e-vendor-icon-btn i{pointer-events:none;font-size:13px;line-height:1}.add2e-vendor-icon-btn:hover{filter:brightness(1.15)}
  .add2e-vendor-tags{display:flex;flex-wrap:wrap;gap:4px;max-width:300px}.add2e-vendor-tag{display:inline-flex;align-items:center;border:1px solid #b98b2d;border-radius:999px;background:#fff3c7;color:#3a2208;padding:2px 6px;font-size:11px;font-weight:900;line-height:1.2}.add2e-vendor-tag.prepared{background:#dff1c5;border-color:#6d8b2a}.add2e-vendor-tag.known{background:#d8e6ff;border-color:#4a6ea8}.add2e-vendor-tag.missing{background:#f7d0c4;border-color:#a64b2b}.add2e-vendor-spells{max-width:310px;font-size:12px;line-height:1.25;color:#3a2208}.add2e-vendor-spells strong{font-weight:950}.add2e-vendor-spells span{display:block;white-space:normal}.add2e-vendor-assign-dialog{display:grid;gap:10px;color:#2f250c}.add2e-vendor-assign-dialog label{display:grid;gap:4px;font-weight:800}.add2e-vendor-assign-dialog select,.add2e-vendor-assign-dialog input{width:100%;min-height:30px}
`;

const arr = v => Array.isArray(v) ? v.flatMap(arr) : v === null || v === undefined || v === "" ? [] : typeof v === "string" ? v.split(/[,;|\n]+|\bet\b/gi).map(x => x.trim()).filter(Boolean) : [v];
const norm = v => lower(v).replace(/[’']/g, "_").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
const uniq = v => [...new Set(v.filter(Boolean))];
function onlyCode(v) { const t = lower(v).replace(/[^a-z]/g, ""); return ["v", "s", "m", "vs", "vm", "sm", "vsm", "verbal", "somatique", "materiel", "materielle", "material"].includes(t); }

function isResponsibleGM() {
  if (!game.user?.isGM) return false;
  if (typeof game.user.isActiveGM === "boolean") return game.user.isActiveGM;
  return game.users?.activeGM?.id === game.user.id || !game.users?.activeGM;
}

function cleanComponentName(value) {
  let text = String(value ?? "").trim();
  text = text.replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
  text = text.replace(/^\(?\s*m\s*\)?\s*[:：\-–—]?\s*/i, "").trim();
  text = text.replace(/[.!?;:]+$/g, "").trim();
  text = text.replace(/^d['’]\s*/i, "");
  text = text.replace(/^(un|une)?\s*peu\s+de\s+/i, "");
  text = text.replace(/^(un|une|du|de la|de l['’]?|des|le|la|les)\s+/i, "");
  text = text.replace(/^(quelques|plusieurs)\s+/i, "");
  text = text.replace(/^petit morceau de\s+/i, "");
  text = text.replace(/^morceau de\s+/i, "");
  return text.trim();
}

function actorTypeLabel(actor) {
  const t = String(actor?.type ?? "").toLowerCase();
  if (t === "personnage") return "Personnages";
  if (t === "monster") return "Monstres";
  return "Autres acteurs";
}

function buyerChoices(selectedId = "") {
  const groups = new Map();
  for (const actor of game.actors ?? []) {
    if (!actor?.id || isVendorActor(actor)) continue;
    const label = actorTypeLabel(actor);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(actor);
  }
  for (const actors of groups.values()) actors.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  return [...groups.entries()].map(([label, actors]) => `<optgroup label="${esc(label)}">${actors.map(a => `<option value="${esc(a.id)}" ${a.id === selectedId ? "selected" : ""}>${esc(a.name)}</option>`).join("")}</optgroup>`).join("");
}

function addReq(map, raw, qty = 1, spell = null, mult = 1) {
  const name = cleanComponentName(raw);
  if (!name || onlyCode(name)) return;
  const key = norm(name);
  if (!key) return;
  const n = Math.max(1, Math.floor(Number(qty) || 1)) * Math.max(1, Math.floor(Number(mult) || 1));
  const e = map.get(key) ?? { key, name, quantity: 0, spells: [] };
  e.quantity += n;
  if (spell) e.spells.push({ name: spell.name ?? "Sort", count: Math.max(1, Math.floor(Number(mult) || 1)) });
  map.set(key, e);
}

function collectReq(map, value, spell, mult) {
  if (value === null || value === undefined || value === "") return;
  if (Array.isArray(value)) { for (const x of value) collectReq(map, x, spell, mult); return; }
  if (typeof value === "string") { for (const x of arr(value)) addReq(map, x, 1, spell, mult); return; }
  if (typeof value === "object") {
    const alternatives = value.alternatives ?? value.options ?? value.choix ?? value.auChoix ?? value.or;
    if (Array.isArray(alternatives) && alternatives.length) {
      addReq(map, alternatives.map(x => cleanComponentName(x?.name ?? x?.nom ?? x?.label ?? x?.item ?? x?.component ?? x?.composant ?? x)).filter(Boolean).join(" ou "), 1, spell, mult);
      return;
    }
    const name = value.name ?? value.nom ?? value.label ?? value.item ?? value.itemName ?? value.component ?? value.composant ?? value.slug ?? value.id;
    const qty = value.quantity ?? value.quantite ?? value.qty ?? value.nombre ?? value.count ?? value.value ?? 1;
    if (name) addReq(map, name, qty, spell, mult);
  }
}

function collectMaterialText(map, value, spell, mult) {
  const text = String(value ?? "").trim();
  if (!text) return;
  const parenthetical = [...text.matchAll(/\bM\b\s*\(([^)]+)\)/gi)].map(m => m[1]);
  if (parenthetical.length) { for (const p of parenthetical) collectReq(map, p, spell, mult); return; }
  if (/^\s*[VSMvsm,;\/\s]+\s*$/.test(text)) return;
  collectReq(map, text, spell, mult);
}

function spellNameKeys(spell) {
  const s = spell?.system ?? {}, f = spell?.flags?.add2e ?? {};
  return uniq([spell?.name, s.nom, s.name, s.slug, f.slug, f.importKey, f.originalName].map(norm));
}

function associatedSpellNames(item) {
  const s = item?.system ?? {}, f = item?.flags?.add2e ?? {};
  return uniq([
    ...arr(s.sorts_associes), ...arr(s.sortsAssocies), ...arr(s.spells), ...arr(s.spellNames), ...arr(s.sorts),
    ...arr(f.sorts_associes), ...arr(f.sortsAssocies), ...arr(f.spells), ...arr(f.spellNames)
  ].map(v => String(v ?? "").trim()).filter(Boolean));
}

function componentsAssociatedWithSpell(spell, componentItems, mult = 1) {
  if (!componentItems?.length) return [];
  const spellKeys = new Set(spellNameKeys(spell));
  const out = [];
  const seen = new Set();
  for (const item of componentItems) {
    const names = associatedSpellNames(item);
    if (!names.length) continue;
    if (!names.some(name => spellKeys.has(norm(name)))) continue;
    const key = norm(item.name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ key, name: item.name, quantity: Math.max(1, Math.floor(Number(mult) || 1)), spells: [{ name: spell?.name ?? "Sort", count: Math.max(1, Math.floor(Number(mult) || 1)) }] });
  }
  return out;
}

function requirements(spell, mult = 1, componentItems = []) {
  const associated = componentsAssociatedWithSpell(spell, componentItems, mult);
  if (associated.length) return associated;

  const s = spell?.system ?? {}, f = spell?.flags?.add2e ?? {}, m = new Map();
  for (const field of [s.composants_requis, s.composantsMateriels, s.composants_materiels, s.composantsMateriel, s.composant_materiel, s.composantMateriel, s.materiel, s.matériel, s.material, s.materialComponent, s.materialComponents, s.material_components, s.requiredComponents, s.componentsRequired, s.components?.material, s.components?.materials, f.composants_requis, f.composants, f.components, f.requiredComponents]) collectReq(m, field, spell, mult);
  for (const field of [s.composants, s.composantes, s.components, f.composantes]) collectMaterialText(m, field, spell, mult);
  for (const tag of [...arr(s.tags), ...arr(s.effectTags), ...arr(f.tags), ...arr(f.effectTags)]) {
    const t = String(tag ?? "").trim();
    if (/^composant[:_]/i.test(t)) addReq(m, t.replace(/^composant[:_]/i, ""), 1, spell, mult);
  }
  return [...m.values()];
}

function sumPrepared(v) {
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, v);
  if (typeof v === "string") return Math.max(0, Number(v) || 0);
  if (!v || typeof v !== "object") return 0;
  let n = 0;
  for (const x of Object.values(v)) n += sumPrepared(x);
  return n;
}

function preparedCount(spell) {
  const f = spell?.flags?.add2e ?? {}, s = spell?.system ?? {};
  let best = 0;
  for (const v of [spell?.getFlag?.("add2e", "memorizedCount"), f.memorizedCount, f.preparedCount, s.memorizedCount, s.preparedCount, s.prepared, s.memorise, s.memorisé, s.memorized, s.memorisation?.value, s.memorisation, s.slots?.prepared, s.slots?.value]) {
    const n = Number(v);
    if (Number.isFinite(n) && n > best) best = n;
  }
  best = Math.max(best, sumPrepared(spell?.getFlag?.("add2e", "memorizedByList")), sumPrepared(f.memorizedByList), sumPrepared(f.preparedByList), sumPrepared(s.memorizedByList), sumPrepared(s.preparedByList));
  try { const n = Number(globalThis.add2eGetTotalMemorizedCount?.(spell)); if (Number.isFinite(n) && n > best) best = n; } catch (_e) {}
  return Math.max(0, best);
}

function objectPower(spell) {
  const s = spell?.system ?? {};
  if (s.isPower === true || s.isObjectPower === true || s.sourceWeaponId || s.sourceItemId || s.powerIndex !== undefined) return true;
  try { return globalThis.add2eIsObjectMagicSpellForPreparation?.(spell) === true; } catch (_e) { return false; }
}

function actorSpells(actor) {
  return Array.from(actor?.items ?? []).filter(i => String(i?.type ?? "").toLowerCase() === "sort" && !objectPower(i)).sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

function reqMap(spells, prepared = false, componentItems = []) {
  const out = new Map();
  for (const spell of spells) {
    const count = preparedCount(spell);
    if (prepared && count <= 0) continue;
    for (const r of requirements(spell, prepared ? count : 1, componentItems)) {
      const e = out.get(r.key) ?? { key: r.key, name: r.name, quantity: 0, spells: [] };
      e.quantity += r.quantity;
      e.spells.push(...r.spells);
      out.set(r.key, e);
    }
  }
  return out;
}

function itemKeys(item) {
  const s = item?.system ?? {}, f = item?.flags?.add2e ?? {};
  return uniq([item?.name, s.nom, s.slug, s.composant, s.component, f.slug, f.componentSlug, ...arr(s.tags), ...arr(s.effectTags), ...arr(f.tags), ...arr(f.effectTags)].map(v => norm(String(v ?? "").replace(/^(composant|component|spell_component)[:_]/i, ""))));
}

function matchReq(item, req) {
  const keys = itemKeys(item);
  if (keys.includes(req.key)) return true;
  if (String(req.key ?? "").length < 5) return false;
  return keys.some(k => k && k.length >= 5 && (k.includes(req.key) || req.key.includes(k)));
}

function spellLabels(req) {
  const g = new Map();
  for (const s of req?.spells ?? []) {
    const n = s.name ?? "Sort";
    g.set(n, Math.max(g.get(n) ?? 0, Number(s.count) || 1));
  }
  return [...g.entries()].map(([n, c]) => c > 1 ? `${n} ×${c}` : n);
}

function relevance(actor, componentItems) {
  const spells = actorSpells(actor), known = reqMap(spells, false, componentItems), prepared = reqMap(spells, true, componentItems), mk = new Set(), mp = new Set(), byItem = new Map();
  for (const item of componentItems) {
    const kr = [...known.values()].filter(r => matchReq(item, r)), pr = [...prepared.values()].filter(r => matchReq(item, r));
    for (const r of kr) mk.add(r.key);
    for (const r of pr) mp.add(r.key);
    byItem.set(item.id, { known: kr, prepared: pr, knownNeed: kr.reduce((s, r) => s + r.quantity, 0), preparedNeed: pr.reduce((s, r) => s + r.quantity, 0), spellNames: uniq([...kr, ...pr].flatMap(spellLabels)) });
  }
  const missing = [
    ...[...prepared.values()].filter(r => !mp.has(r.key)).map(req => ({ req, scope: "prepared" })),
    ...[...known.values()].filter(r => !mk.has(r.key) && !prepared.has(r.key)).map(req => ({ req, scope: "known" }))
  ];
  return { byItem, missing, knownCount: known.size, preparedCount: prepared.size };
}

function componentStockData(req) {
  const key = norm(req?.key ?? req?.name);
  const name = cleanComponentName(req?.name ?? req?.key ?? "Composant");
  const stock = Math.max(20, Number(req?.quantity) || 1);
  return {
    name,
    type: "objet",
    img: "icons/svg/item-bag.svg",
    system: {
      categorie: "composant_sort",
      sousType: "composant",
      slug: key,
      composant: key,
      quantite: stock,
      prix: { valeur: 1, devise: "po" },
      tags: ["composant_sort", `composant:${key}`]
    },
    flags: {
      add2e: {
        vendorItem: true,
        vendorKind: "component",
        vendorStockMax: stock,
        autoGeneratedComponent: true,
        componentSlug: key
      }
    }
  };
}

async function ensureVendorMinimumHp(vendor) {
  if (!game.user?.isGM || !vendor?.update) return false;
  const s = vendor.system ?? {};
  const update = {};
  for (const key of ["pdv", "points_de_coup", "pv", "pv_actuels", "pv_max", "points_de_vie", "points_de_vie_max"]) {
    if (!(Number(s[key]) >= 1)) update[`system.${key}`] = 1;
  }
  if (!Object.keys(update).length) return false;
  await vendor.update(update, { add2eReason: "vendor-minimum-hit-points" });
  return true;
}

function toCopperSafe(money) {
  const coins = game.add2e?.vendorMoney?.coins ?? [
    { key: "pp", pc: 500 }, { key: "po", pc: 100 }, { key: "pe", pc: 50 }, { key: "pa", pc: 10 }, { key: "pc", pc: 1 }
  ];
  return coins.reduce((sum, c) => sum + (Number(money?.[c.key]) || 0) * c.pc, 0);
}

async function alertConfirmBuy(item, qty, total) {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  const content = `<p>Acheter <b>${qty} × ${esc(item.name)}</b> pour <b>${formatMoney(total)}</b> ?</p>`;
  if (DialogV2?.confirm) return DialogV2.confirm({ window: { title: "Confirmer l’achat" }, content, yes: { label: "Acheter" }, no: { label: "Annuler" }, modal: true });
  return false;
}

async function buyThroughVendor({ vendor, buyer, item, quantity: qty }) {
  if (!vendor || !buyer || !item) return false;
  qty = Math.max(1, Math.floor(Number(qty) || 1));
  const total = priceCopper(item) * qty;
  if (quantity(item) < qty) return alertBox("Stock insuffisant", `${item.name} : stock disponible ${quantity(item)}.`).then(() => false);
  if (toCopperSafe(getMoney(buyer)) < total) return alertBox("Argent insuffisant", `${buyer.name} n’a pas assez d’argent. Prix : ${formatMoney(total)}.`).then(() => false);
  if (!await alertConfirmBuy(item, qty, total)) return false;
  if (game.user?.isGM) {
    const r = await buyLocal({ vendor, buyer, item, quantity: qty }, { confirm: false });
    if (!r.ok && !r.cancelled) await alertBox("Achat impossible", r.message);
    else if (r.ok) ui.notifications?.info?.(r.message);
    return r.ok;
  }
  game.socket?.emit?.("system.add2e", { type: SOCKET_BUY_V2, requestId: foundry.utils.randomID(), userId: game.user.id, vendorId: vendor.id, buyerId: buyer.id, buyerUuid: buyer.uuid, itemId: item.id, quantity: qty });
  return true;
}

class Add2eVendorApp extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = { id: "add2e-vendor-app-{id}", classes: ["add2e", "add2e-vendor-app"], tag: "section", window: { title: "Boutique ADD2E", resizable: true }, position: { width: 1120, height: 720 } };

  constructor({ vendor, buyer } = {}, options = {}) {
    super(options);
    this.vendor = vendor;
    this.buyer = buyer ?? getBuyer();
    this.activeTab = "all";
    this.searchText = "";
    this._autoStockRunning = false;
  }

  get title() { return `${this.vendor?.name ?? "Boutique"}${this.buyer ? ` — ${this.buyer.name}` : ""}`; }

  _stock() {
    return Array.from(this.vendor?.items ?? []).filter(isStockItem).sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }

  async _ensureMissingComponents() {
    if (!game.user?.isGM || !this.vendor || !this.buyer || this._autoStockRunning) return 0;
    this._autoStockRunning = true;
    try {
      const stock = this._stock();
      const componentItems = stock.filter(i => vendorKind(i) === "Composant");
      const rel = relevance(this.buyer, componentItems);
      const existing = new Set(componentItems.flatMap(itemKeys));
      const seen = new Set();
      const create = [];
      for (const { req } of rel.missing) {
        const key = norm(req?.key ?? req?.name);
        if (!key || existing.has(key) || seen.has(key)) continue;
        seen.add(key);
        create.push(componentStockData(req));
      }
      if (create.length) await this.vendor.createEmbeddedDocuments("Item", create, { add2eReason: "vendor-auto-missing-spell-components" });
      if (create.length) ui.notifications?.info?.(`${this.vendor.name} : ${create.length} composant(s) requis ajouté(s) au stock.`);
      return create.length;
    } finally {
      this._autoStockRunning = false;
    }
  }

  async _prepareContext() {
    if (game.user?.isGM) await ensureVendorMinimumHp(this.vendor);
    await this._ensureMissingComponents();
    const stock = this._stock();
    const componentItems = stock.filter(i => vendorKind(i) === "Composant");
    const rel = this.buyer ? relevance(this.buyer, componentItems) : { byItem: new Map(), missing: [], knownCount: 0, preparedCount: 0 };
    const items = stock.map(item => {
      const kind = vendorKind(item);
      const tab = kind === "Composant" ? "components" : kind === "Projectile" ? "projectiles" : "equipment";
      const r = rel.byItem.get(item.id) ?? { knownNeed: 0, preparedNeed: 0, spellNames: [] };
      const tabs = [tab];
      if (r.preparedNeed > 0) tabs.push("components-prepared");
      if (r.knownNeed > 0) tabs.push("components-known");
      return { id: item.id, name: item.name, img: item.img || "icons/svg/item-bag.svg", kind, tab, relevantTabs: tabs, stock: quantity(item), priceLabel: formatMoney(priceCopper(item)), preparedNeed: r.preparedNeed, knownNeed: r.knownNeed, spellNames: r.spellNames, missing: false, search: lower(`${item.name} ${kind} ${item.system?.categorie ?? ""} ${item.system?.sousType ?? ""} ${item.system?.sous_type ?? ""} ${r.spellNames.join(" ")} ${associatedSpellNames(item).join(" ")}`) };
    });
    for (const e of rel.missing) {
      const req = e.req;
      items.push({ id: `missing-${req.key}-${e.scope}`, name: req.name, img: "icons/svg/hazard.svg", kind: "Composant", tab: "components", relevantTabs: [e.scope === "prepared" ? "components-prepared" : "components-known"], stock: 0, priceLabel: "Absent du stock", preparedNeed: e.scope === "prepared" ? req.quantity : 0, knownNeed: e.scope === "known" ? req.quantity : 0, spellNames: spellLabels(req), missing: true, search: lower(`${req.name} composant absent ${spellLabels(req).join(" ")}`) });
    }
    return { vendor: this.vendor, buyer: this.buyer, buyerMoneyLabel: this.buyer ? formatMoney(getMoney(this.buyer)) : "Gestion MJ", buyerOptions: buyerChoices(this.buyer?.id), items, isGM: game.user?.isGM === true, activeTab: this.activeTab, searchText: this.searchText, componentPreparedCount: rel.preparedCount, componentKnownCount: rel.knownCount };
  }

  _visible(item, ctx, q) { return (ctx.activeTab === "all" ? !item.missing : item.relevantTabs.includes(ctx.activeTab)) && (!q || item.search.includes(q)); }
  _badges(item) { const b = []; if (item.preparedNeed > 0) b.push(`<span class="add2e-vendor-tag prepared">Mémorisés : ${item.preparedNeed}</span>`); if (item.knownNeed > 0) b.push(`<span class="add2e-vendor-tag known">Connus : ${item.knownNeed}</span>`); if (item.missing) b.push(`<span class="add2e-vendor-tag missing">Absent du stock</span>`); if (!b.length) b.push(`<span class="add2e-vendor-tag">${esc(item.kind)}</span>`); return `<div class="add2e-vendor-tags">${b.join("")}</div>`; }
  _spells(item) { if (!item.spellNames?.length) return "—"; const names = item.spellNames.slice(0, 4).map(n => `<span>${esc(n)}</span>`).join(""); const more = item.spellNames.length > 4 ? `<span>+ ${item.spellNames.length - 4} autre(s)</span>` : ""; return `<div class="add2e-vendor-spells"><strong>Sorts :</strong>${names}${more}</div>`; }

  async _renderHTML(ctx) {
    const tab = (t, l, title = "") => `<button type="button" data-tab="${t}" class="${ctx.activeTab === t ? "active" : ""}" ${title ? `title="${esc(title)}"` : ""}>${l}</button>`;
    const q = lower(ctx.searchText);
    const rows = ctx.items.map(item => {
      const hidden = !this._visible(item, ctx, q), disabled = item.stock <= 0 || !ctx.buyer || item.missing;
      const gm = ctx.isGM ? `<td><div class="add2e-vendor-gm-actions"><input class="add2e-vendor-restock-qty" type="number" min="0" value="${item.stock}" title="Quantité de restock" ${item.missing ? "disabled" : ""}><button type="button" class="add2e-vendor-restock-set add2e-vendor-icon-btn" ${item.missing ? "disabled" : ""} title="Définir le restock"><i class="fas fa-boxes-stacked"></i></button><button type="button" class="add2e-vendor-assign add2e-vendor-icon-btn" ${disabled ? "disabled" : ""} title="Affecter à un token de la scène"><i class="fas fa-user-plus"></i></button></div></td>` : "";
      return `<tr class="${item.missing ? "add2e-vendor-missing" : ""}" data-item-id="${esc(item.id)}" data-tabs="${esc(item.relevantTabs.join(" "))}" data-search="${esc(item.search)}" data-missing="${item.missing ? "1" : "0"}" style="${hidden ? "display:none;" : ""}"><td class="add2e-vendor-item"><div class="add2e-vendor-item-wrap"><img src="${esc(item.img)}" alt=""><span>${esc(item.name)}</span></div></td><td>${this._badges(item)}</td><td>${this._spells(item)}</td><td>${esc(item.priceLabel)}</td><td>${item.stock}</td><td><input class="add2e-vendor-buy-qty" type="number" min="1" value="1" title="Quantité à acheter" ${item.missing ? "disabled" : ""}></td><td><div class="add2e-vendor-actions"><button type="button" class="add2e-vendor-buy add2e-vendor-icon-btn" ${disabled ? "disabled" : ""} title="Acheter"><i class="fas fa-cart-shopping"></i></button></div></td>${gm}</tr>`;
    }).join("");
    const col = ctx.isGM ? 8 : 7;
    const buyerBlock = ctx.isGM ? `<label class="add2e-vendor-buyer-label">Dans la peau de <select class="add2e-vendor-buyer-select">${ctx.buyerOptions}</select></label>` : `<strong>${esc(ctx.buyer?.name ?? "aucun personnage assigné")}</strong>`;
    const div = document.createElement("div");
    div.className = "add2e-vendor-root";
    div.innerHTML = `<style>${ADD2E_VENDOR_STYLE}</style><header class="add2e-vendor-header"><div><h2>${esc(ctx.vendor?.name ?? "Boutique")}</h2><p>Acheteur : ${buyerBlock}</p></div><div class="add2e-vendor-money">${esc(ctx.buyerMoneyLabel)}</div></header><nav class="add2e-vendor-tabs">${tab("all", "Tous")}${tab("components-prepared", `Composants sorts mémorisés (${ctx.componentPreparedCount})`, "Composants matériels requis par les sorts actuellement mémorisés")}${tab("components-known", `Composants sorts connus (${ctx.componentKnownCount})`, "Composants matériels requis par tous les sorts connus du personnage")}${tab("components", "Tous composants")}${tab("projectiles", "Projectiles")}${tab("equipment", "Équipements")}${ctx.isGM ? `<button type="button" class="add2e-vendor-restock-all" title="Réapprovisionner tout le stock"><i class="fas fa-boxes-stacked"></i> Restock global</button>` : ""}</nav><div class="add2e-vendor-search"><input type="search" class="add2e-vendor-search-input" placeholder="Rechercher un article, composant ou sort..." value="${esc(ctx.searchText)}"></div><div class="add2e-vendor-table-wrap"><table class="add2e-vendor-table"><thead><tr><th>Article</th><th>Usage</th><th>Sorts concernés</th><th>Prix</th><th>Stock</th><th>Qté</th><th>Achat</th>${ctx.isGM ? `<th>Restock / Affectation MJ</th>` : ""}</tr></thead><tbody>${rows || `<tr><td colspan="${col}">Aucun article en stock.</td></tr>`}</tbody></table></div>`;
    return div;
  }

  _replaceHTML(result, content) { content.style.overflow = "hidden"; content.style.padding = "0"; content.style.background = "linear-gradient(180deg,#fff8df,#ead39b)"; content.replaceChildren(result); }

  async _onRender(context, options = {}) {
    await super._onRender?.(context, options);
    const root = this.element?.querySelector?.(".add2e-vendor-root") ?? this.element;
    if (!root) return;
    const wc = this.element?.closest?.(".application")?.querySelector?.(".window-content") ?? this.element?.parentElement;
    if (wc) { wc.style.overflow = "hidden"; wc.style.padding = "0"; wc.style.background = "linear-gradient(180deg,#fff8df,#ead39b)"; }
    root.querySelector(".add2e-vendor-buyer-select")?.addEventListener("change", ev => { this.buyer = game.actors?.get?.(ev.currentTarget.value) ?? this.buyer; this.render({ force: true }); });
    root.querySelectorAll(".add2e-vendor-tabs button[data-tab]").forEach(b => b.addEventListener("click", ev => { this.activeTab = ev.currentTarget.dataset.tab || "all"; this._applyFilters(root); }));
    root.querySelector(".add2e-vendor-search-input")?.addEventListener("input", ev => { this.searchText = ev.currentTarget.value ?? ""; this._applyFilters(root); });
    root.querySelectorAll(".add2e-vendor-buy").forEach(b => b.addEventListener("click", async ev => { const row = ev.currentTarget.closest("tr[data-item-id]"); if (!row || row.dataset.missing === "1") return; const item = this.vendor?.items?.get(row.dataset.itemId); const qty = row.querySelector?.(".add2e-vendor-buy-qty")?.value ?? 1; const ok = await buyThroughVendor({ vendor: this.vendor, buyer: this.buyer, item, quantity: qty }); if (ok && game.user?.isGM) this.render({ force: true }); }));
    root.querySelectorAll(".add2e-vendor-restock-set").forEach(b => b.addEventListener("click", async ev => { const row = ev.currentTarget.closest("tr[data-item-id]"); if (!row || row.dataset.missing === "1") return; const item = this.vendor?.items?.get(row.dataset.itemId); const qty = row.querySelector?.(".add2e-vendor-restock-qty")?.value ?? 0; await setStock(item, qty); this.render({ force: true }); }));
    root.querySelectorAll(".add2e-vendor-assign").forEach(b => b.addEventListener("click", async ev => { const row = ev.currentTarget.closest("tr[data-item-id]"); if (!row || row.dataset.missing === "1") return; const item = this.vendor?.items?.get(row.dataset.itemId); await this._assignItemDialog(item); this.render({ force: true }); }));
    root.querySelector(".add2e-vendor-restock-all")?.addEventListener("click", async () => { await restockAll(this.vendor); this.render({ force: true }); });
    this._applyFilters(root);
  }

  async _assignItemDialog(item) {
    if (!game.user?.isGM || !item) return false;
    const choices = sceneTokenChoices();
    if (!choices.length) { await alertBox("Aucun token cible", "Aucun token non vendeur n’est présent sur la scène."); return false; }
    const options = choices.map(c => `<option value="${esc(c.tokenId)}">${esc(c.label)}</option>`).join("");
    const content = `<form><div class="add2e-vendor-assign-dialog"><p>Affecter <b>${esc(item.name)}</b> depuis le stock du vendeur.</p><label>Token cible<select name="tokenId">${options}</select></label><label>Quantité<input name="quantity" type="number" min="1" max="${quantity(item)}" value="1"></label><p class="hint">Stock disponible : ${quantity(item)}</p></div></form>`;
    const DialogV2 = foundry?.applications?.api?.DialogV2;
    if (!DialogV2?.confirm) return false;
    let formData = null;
    const ok = await DialogV2.confirm({ window: { title: "Affecter un article" }, content, yes: { label: "Affecter", callback: (event, button) => { const form = button?.form ?? button?.closest?.("form") ?? event?.target?.closest?.("form") ?? document.querySelector(".add2e-vendor-assign-dialog")?.closest?.("form"); formData = { tokenId: form?.querySelector?.("[name='tokenId']")?.value, quantity: form?.querySelector?.("[name='quantity']")?.value }; return true; } }, no: { label: "Annuler" }, modal: true });
    if (!ok || !formData) return false;
    const token = choices.find(c => c.tokenId === formData.tokenId)?.token ?? canvas?.tokens?.get?.(formData.tokenId) ?? null;
    const result = await assignItemToToken({ vendor: this.vendor, item, token, quantity: formData.quantity });
    if (result?.ok) ui.notifications?.info?.(result.message); else await alertBox("Affectation impossible", result?.message ?? "Impossible d’affecter cet article.");
    return result?.ok === true;
  }

  _applyFilters(root) {
    const q = lower(this.searchText);
    root.querySelectorAll(".add2e-vendor-tabs button[data-tab]").forEach(btn => btn.classList.toggle("active", btn.dataset.tab === this.activeTab));
    root.querySelectorAll("tbody tr[data-item-id]").forEach(row => { const tabs = String(row.dataset.tabs ?? "").split(/\s+/g).filter(Boolean); const tabOk = this.activeTab === "all" ? row.dataset.missing !== "1" : tabs.includes(this.activeTab); const searchOk = !q || lower(row.dataset.search).includes(q); row.style.display = tabOk && searchOk ? "" : "none"; });
  }
}

function vendorAppKey(vendor) {
  return `${vendor?.id ?? "vendor"}:${game.user?.id ?? "user"}`;
}

function appElement(app) {
  if (app?.element instanceof HTMLElement) return app.element;
  if (app?.element?.[0] instanceof HTMLElement) return app.element[0];
  return null;
}

function appStillUsable(app) {
  if (!app) return false;
  const el = appElement(app);
  if (!el) return false;
  const root = el.closest?.(".application") ?? el;
  return document.body?.contains?.(root) === true;
}

export async function openVendor({ vendor = null, buyer = null } = {}) {
  vendor = vendor ?? findVendor();
  if (!vendor) vendor = await createVendor();
  if (!vendor) return null;
  if (game.user?.isGM) await ensureVendorMinimumHp(vendor);
  buyer = buyer ?? getBuyer();
  if (!buyer && !game.user?.isGM) { await alertBox("Aucun acheteur", "Aucun personnage joueur n’est assigné ou sélectionné pour acheter chez ce vendeur."); return null; }
  const key = vendorAppKey(vendor);
  const registry = globalThis.__ADD2E_VENDOR_APP_REGISTRY ?? new Map();
  globalThis.__ADD2E_VENDOR_APP_REGISTRY = registry;
  const existing = registry.get(key);
  if (existing && appStillUsable(existing)) {
    existing.vendor = vendor;
    existing.buyer = buyer;
    existing.render?.({ force: true });
    existing.bringToFront?.();
    return existing;
  }
  registry.delete(key);
  const app = new Add2eVendorApp({ vendor, buyer });
  const originalClose = app.close?.bind(app);
  if (originalClose) app.close = async (...args) => { registry.delete(key); return originalClose(...args); };
  registry.set(key, app);
  app.render({ force: true });
  return app;
}

async function openVendorFromToken(token) {
  const vendor = token?.actor ?? null;
  if (!isVendorActor(vendor)) return false;
  const now = Date.now();
  const key = `${vendor.id}:${game.user?.id ?? "user"}`;
  const last = globalThis.__ADD2E_VENDOR_LAST_OPEN ?? {};
  if (last[key] && now - last[key] < 1200) return true;
  last[key] = now;
  globalThis.__ADD2E_VENDOR_LAST_OPEN = last;
  await openVendor({ vendor, buyer: getBuyer() });
  return true;
}

function bindVendorToken(token) {
  if (!token || token.__add2eVendorBoundV17) return;
  if (!isVendorActor(token.actor)) return;
  token.__add2eVendorBoundV17 = true;
  try { token.cursor = "pointer"; } catch (_err) {}
  try { token.eventMode = "static"; } catch (_err) {}
  try { token.interactive = true; } catch (_err) {}
  const handler = event => { event?.stopPropagation?.(); window.setTimeout(() => openVendorFromToken(token), 0); };
  try { token.on?.("pointertap", handler); } catch (_err) {}
}

export function bindAllVendorTokens() { for (const token of canvas?.tokens?.placeables ?? []) bindVendorToken(token); }

export function patchVendorTokenClick() {
  if (globalThis.__ADD2E_VENDOR_TOKEN_CLICK_PATCHED_V17) return;
  globalThis.__ADD2E_VENDOR_TOKEN_CLICK_PATCHED_V17 = true;
  const TokenClass = foundry?.canvas?.placeables?.Token ?? CONFIG?.Token?.objectClass ?? globalThis.Token;
  const proto = TokenClass?.prototype;
  if (proto && typeof proto._onClickLeft === "function") {
    const original = proto._onClickLeft;
    proto._onClickLeft = function add2eVendorOnClickLeft(event) {
      const result = original.call(this, event);
      try { if (isVendorActor(this.actor)) window.setTimeout(() => openVendorFromToken(this), 0); } catch (err) { console.warn("[ADD2E][VENDOR][TOKEN_CLICK]", err); }
      return result;
    };
  }
  Hooks.on("canvasReady", bindAllVendorTokens);
  Hooks.on("createToken", () => window.setTimeout(bindAllVendorTokens, 100));
  Hooks.on("updateToken", () => window.setTimeout(bindAllVendorTokens, 100));
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

function registerVendorPurchaseSockets() {
  if (globalThis.__ADD2E_VENDOR_BUY_V2_SOCKET_REGISTERED) return;
  globalThis.__ADD2E_VENDOR_BUY_V2_SOCKET_REGISTERED = true;
  game.socket?.on?.("system.add2e", async data => {
    if (!data || typeof data !== "object") return;
    if (data.type === SOCKET_BUY_RESULT_V2) {
      if (data.userId !== game.user?.id) return;
      data.ok ? ui.notifications?.info?.(data.message ?? "Achat effectué.") : ui.notifications?.warn?.(data.message ?? "Achat impossible.");
      return;
    }
    if (data.type !== SOCKET_BUY_V2 || !isResponsibleGM()) return;
    const vendor = game.actors?.get(data.vendorId);
    const buyer = data.buyerUuid ? await fromUuid(data.buyerUuid).catch(() => null) : game.actors?.get(data.buyerId);
    const item = vendor?.items?.get(data.itemId);
    let result = { ok: false, message: "Achat impossible." };
    try { result = await buyLocal({ vendor, buyer, item, quantity: data.quantity }, { confirm: false }); }
    catch (e) { result = { ok: false, message: e?.message || "Erreur pendant l'achat." }; }
    game.socket?.emit?.("system.add2e", { type: SOCKET_BUY_RESULT_V2, requestId: data.requestId, userId: data.userId, ok: !!result.ok, message: result.message });
  });
}

export function registerUiGlobals() {
  game.add2e = game.add2e ?? {};
  game.add2e.openVendor = openVendor;
  game.add2e.vendorAppVersion = ADD2E_VENDOR_APP_VERSION;
  globalThis.ADD2E_VENDOR_APP_VERSION = ADD2E_VENDOR_APP_VERSION;
  registerVendorPurchaseSockets();
}
