// ADD2E — Marchand V2 reconstruit en unité courte.
// Version : 2026-06-14-merchant-unit-v1

import { findVendor, createVendor, getBuyer, isVendorActor, vendorKind, isStockItem, quantity, priceCopper, formatMoney, getMoney, buy, restockAll, alertBox, esc } from "./22a-vendor-core.mjs";

const VERSION = "2026-06-14-merchant-unit-v1";

function buyerOptions(selected = "") {
  return Array.from(game.actors ?? []).filter(a => a?.id && !isVendorActor(a)).sort((a, b) => String(a.name).localeCompare(String(b.name))).map(a => `<option value="${esc(a.id)}" ${a.id === selected ? "selected" : ""}>${esc(a.name)}</option>`).join("");
}

class Add2eMerchantApp extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = { id: "add2e-merchant-{id}", classes: ["add2e", "add2e-merchant-app"], tag: "section", window: { title: "Marchand ADD2E", resizable: true }, position: { width: 960, height: 640 } };
  constructor({ vendor, buyer } = {}, options = {}) { super(options); this.vendor = vendor; this.buyer = buyer ?? getBuyer(); }
  get title() { return `${this.vendor?.name ?? "Marchand"}${this.buyer ? ` — ${this.buyer.name}` : ""}`; }
  async _prepareContext() { return { vendor: this.vendor, buyer: this.buyer, items: Array.from(this.vendor?.items ?? []).filter(isStockItem).sort((a,b)=>String(a.name).localeCompare(String(b.name))), isGM: game.user?.isGM === true }; }
  async _renderHTML(ctx) {
    const rows = ctx.items.map(i => `<tr data-id="${esc(i.id)}"><td>${esc(i.name)}</td><td>${esc(vendorKind(i))}</td><td>${esc(formatMoney(priceCopper(i)))}</td><td>${quantity(i)}</td><td><input class="q" type="number" min="1" value="1" style="width:54px"></td><td><button data-action="buy" ${!ctx.buyer || quantity(i) <= 0 ? "disabled" : ""}>Acheter</button></td></tr>`).join("");
    const buyer = ctx.isGM ? `<select class="buyer">${buyerOptions(ctx.buyer?.id)}</select>` : `<b>${esc(ctx.buyer?.name ?? "aucun")}</b>`;
    const div = document.createElement("section");
    div.style.cssText = "height:100%;overflow:auto;background:#f1d99c;color:#231706;padding:10px";
    div.innerHTML = `<h2>${esc(ctx.vendor?.name ?? "Marchand")}</h2><p>Acheteur : ${buyer} — ${ctx.buyer ? esc(formatMoney(getMoney(ctx.buyer))) : ""}</p>${ctx.isGM ? `<button data-action="restock">Restock global</button>` : ""}<table style="width:100%;background:#fff7df"><thead><tr><th>Article</th><th>Type</th><th>Prix</th><th>Stock</th><th>Qté</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
    return div;
  }
  _replaceHTML(result, content) { content.replaceChildren(result); }
  async _onRender(c, o) { await super._onRender?.(c, o); const root = this.element; root.querySelector(".buyer")?.addEventListener("change", e => { this.buyer = game.actors.get(e.currentTarget.value) ?? this.buyer; this.render({ force: true }); }); root.querySelectorAll("button[data-action]").forEach(b => b.addEventListener("click", e => this.click(e))); }
  async click(e) { if (e.currentTarget.dataset.action === "restock") { await restockAll(this.vendor); return this.render({ force: true }); } const row = e.currentTarget.closest("tr"); const item = this.vendor.items.get(row?.dataset.id); const ok = await buy({ vendor: this.vendor, buyer: this.buyer, item, quantity: row.querySelector(".q")?.value }); if (ok && game.user?.isGM) this.render({ force: true }); }
}

const registry = () => globalThis.__ADD2E_MERCHANT_UNIT_APPS ??= new Map();
export async function openVendor({ vendor = null, buyer = null } = {}) { vendor = vendor ?? findVendor(); if (!vendor && game.user?.isGM) vendor = await createVendor(); if (!vendor) return alertBox("Marchand introuvable", "Le marchand doit être créé côté MJ."); buyer = buyer ?? getBuyer(); if (!buyer && !game.user?.isGM) return alertBox("Aucun acheteur", "Aucun personnage assigné ou sélectionné."); const id = `${game.user?.id}:${vendor.id}`; const old = registry().get(id); if (old?.rendered) { old.vendor = vendor; old.buyer = buyer; old.render({ force: true }); old.bringToFront?.(); return old; } const app = new Add2eMerchantApp({ vendor, buyer }); registry().set(id, app); app.render({ force: true }); return app; }
export function bindAllVendorTokens() { for (const token of canvas?.tokens?.placeables ?? []) if (isVendorActor(token?.actor)) try { token.cursor = "pointer"; token.eventMode = "static"; token.interactive = true; } catch (_e) {} }
export function patchVendorTokenClick() { if (globalThis.__ADD2E_MERCHANT_UNIT_CLICK_V1) return; globalThis.__ADD2E_MERCHANT_UNIT_CLICK_V1 = true; const C = foundry?.canvas?.placeables?.Token ?? CONFIG?.Token?.objectClass ?? globalThis.Token; const p = C?.prototype; if (p && typeof p._onClickLeft === "function") { const old = p._onClickLeft; p._onClickLeft = function(event) { const result = old.call(this, event); if (isVendorActor(this.actor)) setTimeout(() => openVendor({ vendor: this.actor, buyer: getBuyer() }), 0); return result; }; } Hooks.on("canvasReady", bindAllVendorTokens); }
export function registerVendorDirectoryButton() { Hooks.on("renderActorDirectory", (_app, html) => { if (!game.user?.isGM) return; const root = html?.jquery ? html[0] : html; if (!root?.querySelector || root.querySelector(".add2e-open-default-vendor")) return; const button = document.createElement("button"); button.type = "button"; button.className = "add2e-open-default-vendor"; button.textContent = "Marchand"; button.addEventListener("click", () => openVendor()); root.querySelector(".directory-footer")?.prepend(button); }); }
export function registerUiGlobals() { game.add2e = game.add2e ?? {}; game.add2e.openVendor = openVendor; game.add2e.vendorAppVersion = VERSION; }
