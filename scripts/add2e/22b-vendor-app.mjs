// ADD2E — Marchand V2 minimal reconstruit.
// Version : 2026-06-14-merchant-v2-minimal-1

import { isVendorActor, findVendor, createVendor, getBuyer, vendorKind, isStockItem, quantity, priceCopper, formatMoney, getMoney, buyLocal, restockAll, alertBox, esc } from "./22a-vendor-core.mjs";

const VERSION = "2026-06-14-merchant-v2-minimal-1";
const REQ = "ADD2E_MERCHANT_REQ_1";
const RES = "ADD2E_MERCHANT_RES_1";

function activeGM() {
  if (!game.user?.isGM) return false;
  return typeof game.user.isActiveGM === "boolean" ? game.user.isActiveGM : game.users?.activeGM?.id === game.user.id || !game.users?.activeGM;
}

function buyerChoices(selected = "") {
  return Array.from(game.actors ?? []).filter(a => a?.id && !isVendorActor(a)).sort((a, b) => String(a.name).localeCompare(String(b.name))).map(a => `<option value="${esc(a.id)}" ${a.id === selected ? "selected" : ""}>${esc(a.name)}</option>`).join("");
}

async function ask(item, count, total) {
  const D = foundry?.applications?.api?.DialogV2;
  return D?.confirm?.({ window: { title: "Achat" }, content: `<p>Acheter <b>${count} × ${esc(item.name)}</b> pour <b>${formatMoney(total)}</b> ?</p>`, yes: { label: "Acheter" }, no: { label: "Annuler" }, modal: true }) ?? false;
}

async function purchase(vendor, buyer, item, count) {
  count = Math.max(1, Math.floor(Number(count) || 1));
  if (!vendor || !buyer || !item) return false;
  if (quantity(item) < count) return alertBox("Stock insuffisant", `${item.name} : ${quantity(item)} disponible.`).then(() => false);
  const total = priceCopper(item) * count;
  if (!await ask(item, count, total)) return false;
  if (game.user?.isGM) {
    const result = await buyLocal({ vendor, buyer, item, quantity: count }, { confirm: false });
    result.ok ? ui.notifications.info(result.message) : ui.notifications.warn(result.message);
    return result.ok;
  }
  game.socket.emit("system.add2e", { type: REQ, userId: game.user.id, vendorId: vendor.id, buyerUuid: buyer.uuid, itemId: item.id, count });
  return true;
}

class Add2eMerchantApp extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = { id: "add2e-merchant-{id}", classes: ["add2e", "add2e-merchant-app"], tag: "section", window: { title: "Marchand ADD2E", resizable: true }, position: { width: 920, height: 620 } };
  constructor({ vendor, buyer } = {}, options = {}) { super(options); this.vendor = vendor; this.buyer = buyer ?? getBuyer(); }
  get title() { return `${this.vendor?.name ?? "Marchand"}${this.buyer ? ` — ${this.buyer.name}` : ""}`; }
  async _prepareContext() { return { vendor: this.vendor, buyer: this.buyer, items: Array.from(this.vendor?.items ?? []).filter(isStockItem), isGM: game.user?.isGM === true }; }
  async _renderHTML(ctx) {
    const rows = ctx.items.sort((a,b)=>String(a.name).localeCompare(String(b.name))).map(i => `<tr data-id="${esc(i.id)}"><td>${esc(i.name)}</td><td>${esc(vendorKind(i))}</td><td>${esc(formatMoney(priceCopper(i)))}</td><td>${quantity(i)}</td><td><input class="q" type="number" min="1" value="1" style="width:54px"></td><td><button data-a="p" ${!ctx.buyer || quantity(i)<=0 ? "disabled" : ""}>Acheter</button></td></tr>`).join("");
    const buyer = ctx.isGM ? `<select class="buyer">${buyerChoices(ctx.buyer?.id)}</select>` : `<b>${esc(ctx.buyer?.name ?? "aucun")}</b>`;
    const div = document.createElement("div");
    div.innerHTML = `<section style="height:100%;overflow:auto;background:#f1d99c;color:#231706;padding:10px"><h2>${esc(ctx.vendor?.name ?? "Marchand")}</h2><p>Acheteur : ${buyer} — ${ctx.buyer ? esc(formatMoney(getMoney(ctx.buyer))) : ""}</p>${ctx.isGM ? `<button data-a="r">Restock global</button>` : ""}<table style="width:100%;background:#fff7df"><thead><tr><th>Article</th><th>Type</th><th>Prix</th><th>Stock</th><th>Qté</th><th></th></tr></thead><tbody>${rows}</tbody></table></section>`;
    return div.firstElementChild;
  }
  _replaceHTML(result, content) { content.replaceChildren(result); }
  async _onRender(c,o) { await super._onRender?.(c,o); const root = this.element; root.querySelector(".buyer")?.addEventListener("change", e => { this.buyer = game.actors.get(e.currentTarget.value) ?? this.buyer; this.render({ force: true }); }); root.querySelectorAll("button[data-a]").forEach(b => b.addEventListener("click", e => this.click(e))); }
  async click(e) { if (e.currentTarget.dataset.a === "r") { await restockAll(this.vendor); return this.render({ force:true }); } const row = e.currentTarget.closest("tr"); const item = this.vendor.items.get(row?.dataset.id); const ok = await purchase(this.vendor, this.buyer, item, row.querySelector(".q")?.value); if (ok && game.user?.isGM) this.render({ force:true }); }
}

const apps = () => globalThis.__ADD2E_MERCHANT_APPS ??= new Map();
export async function openVendor({ vendor = null, buyer = null } = {}) { vendor = vendor ?? findVendor(); if (!vendor && game.user?.isGM) vendor = await createVendor(); if (!vendor) return alertBox("Marchand introuvable", "Le MJ doit créer le marchand."); buyer = buyer ?? getBuyer(); if (!buyer && !game.user?.isGM) return alertBox("Aucun acheteur", "Aucun personnage assigné ou sélectionné."); const id = `${game.user?.id}:${vendor.id}`; const old = apps().get(id); if (old?.rendered) { old.vendor = vendor; old.buyer = buyer; old.render({ force:true }); old.bringToFront?.(); return old; } const app = new Add2eMerchantApp({ vendor, buyer }); apps().set(id, app); app.render({ force:true }); return app; }
export function bindAllVendorTokens() { for (const t of canvas?.tokens?.placeables ?? []) if (isVendorActor(t?.actor)) try { t.cursor="pointer"; t.eventMode="static"; t.interactive=true; } catch(_e){} }
export function patchVendorTokenClick() { if (globalThis.__ADD2E_MERCHANT_CLICK_1) return; globalThis.__ADD2E_MERCHANT_CLICK_1 = true; const C = foundry?.canvas?.placeables?.Token ?? CONFIG?.Token?.objectClass ?? globalThis.Token; const p = C?.prototype; if (p?. _onClickLeft) { const old = p._onClickLeft; p._onClickLeft = function(e) { const r = old.call(this,e); if (isVendorActor(this.actor)) setTimeout(()=>openVendor({ vendor:this.actor, buyer:getBuyer() }),0); return r; }; } Hooks.on("canvasReady", bindAllVendorTokens); }
export function registerVendorDirectoryButton() { Hooks.on("renderActorDirectory", (_a, html) => { if (!game.user?.isGM) return; const root = html?.jquery ? html[0] : html; if (!root?.querySelector || root.querySelector(".add2e-open-default-vendor")) return; const b=document.createElement("button"); b.className="add2e-open-default-vendor"; b.textContent="Marchand"; b.onclick=()=>openVendor(); root.querySelector(".directory-footer")?.prepend(b); }); }
function sockets() { if (globalThis.__ADD2E_MERCHANT_SOCKET_1) return; globalThis.__ADD2E_MERCHANT_SOCKET_1 = true; game.socket?.on?.("system.add2e", async d => { if (!d || typeof d !== "object") return; if (d.type === RES && d.userId === game.user?.id) return d.ok ? ui.notifications.info(d.message) : ui.notifications.warn(d.message); if (d.type !== REQ || !activeGM()) return; const vendor = game.actors.get(d.vendorId); const buyer = await fromUuid(d.buyerUuid).catch(()=>null); const item = vendor?.items?.get(d.itemId); let result = { ok:false, message:"Achat impossible." }; try { result = await buyLocal({ vendor, buyer, item, quantity:d.count }, { confirm:false }); } catch(err) { result = { ok:false, message:err.message }; } game.socket.emit("system.add2e", { type:RES, userId:d.userId, ok:result.ok, message:result.message }); }); }
export function registerUiGlobals() { game.add2e = game.add2e ?? {}; game.add2e.openVendor = openVendor; game.add2e.vendorAppVersion = VERSION; globalThis.ADD2E_VENDOR_APP_VERSION = VERSION; sockets(); }
