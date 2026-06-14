// ADD2E — Armurier V2 minimal reconstruit.
// Version : 2026-06-14-armorer-v2-minimal-1

import { isArmorerActor, findArmorer, createArmorer, getBuyer, armorerKind, quantity, priceCopper, formatMoney, getMoney, buy, restockAll, getArmorerDisplayItems, alertBox, esc, lower } from "./22c-armorer-core.mjs";

const VERSION = "2026-06-14-armorer-v2-minimal-1";

function buyerChoices(selected = "") {
  return Array.from(game.actors ?? []).filter(a => a?.id && !isArmorerActor(a)).sort((a, b) => String(a.name).localeCompare(String(b.name))).map(a => `<option value="${esc(a.id)}" ${a.id === selected ? "selected" : ""}>${esc(a.name)}</option>`).join("");
}

class Add2eArmorerApp extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = { id: "add2e-armorer-{id}", classes: ["add2e", "add2e-armorer-app"], tag: "section", window: { title: "Armurier ADD2E", resizable: true }, position: { width: 940, height: 640 } };
  constructor({ armorer, buyer } = {}, options = {}) { super(options); this.armorer = armorer; this.buyer = buyer ?? getBuyer(); this.search = ""; }
  get title() { return `${this.armorer?.name ?? "Armurier"}${this.buyer ? ` — ${this.buyer.name}` : ""}`; }
  async _prepareContext() { const items = await getArmorerDisplayItems(this.armorer); return { armorer: this.armorer, buyer: this.buyer, items: items.sort((a,b)=>String(a.name).localeCompare(String(b.name))), isGM: game.user?.isGM === true, search: this.search }; }
  async _renderHTML(ctx) {
    const q = lower(ctx.search);
    const rows = ctx.items.filter(i => !q || lower(`${i.name} ${armorerKind(i)}`).includes(q)).map(i => `<tr data-id="${esc(i.id)}"><td>${esc(i.name)}</td><td>${esc(armorerKind(i))}</td><td>${esc(formatMoney(priceCopper(i)))}</td><td>${quantity(i)}</td><td><input class="q" type="number" min="1" value="1" style="width:54px"></td><td><button data-a="p" ${!ctx.buyer || quantity(i)<=0 ? "disabled" : ""}>Acheter</button></td></tr>`).join("");
    const buyer = ctx.isGM ? `<select class="buyer">${buyerChoices(ctx.buyer?.id)}</select>` : `<b>${esc(ctx.buyer?.name ?? "aucun")}</b>`;
    const div = document.createElement("div");
    div.innerHTML = `<section style="height:100%;overflow:auto;background:#ddd0b5;color:#20180f;padding:10px"><h2>${esc(ctx.armorer?.name ?? "Armurier")}</h2><p>Acheteur : ${buyer} — ${ctx.buyer ? esc(formatMoney(getMoney(ctx.buyer))) : ""}</p><input class="search" value="${esc(ctx.search)}" placeholder="Recherche" style="width:100%">${ctx.isGM ? `<button data-a="r">Restock global</button>` : ""}<table style="width:100%;background:#fffaf0"><thead><tr><th>Article</th><th>Type</th><th>Prix</th><th>Stock</th><th>Qté</th><th></th></tr></thead><tbody>${rows}</tbody></table></section>`;
    return div.firstElementChild;
  }
  _replaceHTML(result, content) { content.replaceChildren(result); }
  async _onRender(c,o) { await super._onRender?.(c,o); const root = this.element; root.querySelector(".buyer")?.addEventListener("change", e => { this.buyer = game.actors.get(e.currentTarget.value) ?? this.buyer; this.render({ force:true }); }); root.querySelector(".search")?.addEventListener("input", e => { this.search = e.currentTarget.value ?? ""; this.render({ force:true }); }); root.querySelectorAll("button[data-a]").forEach(b => b.addEventListener("click", e => this.click(e))); }
  async click(e) { if (e.currentTarget.dataset.a === "r") { await restockAll(this.armorer); return this.render({ force:true }); } const row = e.currentTarget.closest("tr"); const item = this.armorer.items.get(row?.dataset.id) ?? (await getArmorerDisplayItems(this.armorer)).find(i => String(i.id) === String(row?.dataset.id)); const ok = await buy({ armorer: this.armorer, buyer: this.buyer, item, quantity: row.querySelector(".q")?.value }); if (ok && game.user?.isGM) this.render({ force:true }); }
}

const apps = () => globalThis.__ADD2E_ARMORER_APPS ??= {};
export async function openArmorer({ armorer = null, buyer = null } = {}) { armorer = armorer ?? findArmorer(); if (!armorer && game.user?.isGM) armorer = await createArmorer(); if (!armorer) return alertBox("Armurier introuvable", "Le MJ doit créer l’armurier."); buyer = buyer ?? getBuyer(); if (!buyer && !game.user?.isGM) return alertBox("Aucun acheteur", "Aucun personnage assigné ou sélectionné."); const id = `${game.user?.id}:${armorer.id}`; const old = apps()[id]; if (old?.rendered) { old.armorer = armorer; old.buyer = buyer; old.render({ force:true }); old.bringToFront?.(); return old; } const app = new Add2eArmorerApp({ armorer, buyer }); apps()[id] = app; app.render({ force:true }); return app; }
export function bindAllArmorerTokens() { for (const t of canvas?.tokens?.placeables ?? []) if (isArmorerActor(t?.actor)) try { t.cursor="pointer"; t.eventMode="static"; t.interactive=true; } catch(_e){} }
export function patchArmorerTokenClick() { if (globalThis.__ADD2E_ARMORER_CLICK_MIN_1) return; globalThis.__ADD2E_ARMORER_CLICK_MIN_1 = true; const C = foundry?.canvas?.placeables?.Token ?? CONFIG?.Token?.objectClass ?? globalThis.Token; const p = C?.prototype; if (p && typeof p._onClickLeft === "function") { const old = p._onClickLeft; p._onClickLeft = function(e) { const r = old.call(this,e); if (isArmorerActor(this.actor)) setTimeout(()=>openArmorer({ armorer:this.actor, buyer:getBuyer() }),0); return r; }; } Hooks.on("canvasReady", bindAllArmorerTokens); }
export function registerArmorerDirectoryButton() { Hooks.on("renderActorDirectory", (_a, html) => { if (!game.user?.isGM) return; const root = html?.jquery ? html[0] : html; if (!root?.querySelector || root.querySelector(".add2e-open-armorer")) return; const b=document.createElement("button"); b.className="add2e-open-armorer"; b.textContent="Armurier"; b.onclick=()=>openArmorer(); root.querySelector(".directory-footer")?.prepend(b); }); }
export function registerArmorerUiGlobals() { game.add2e = game.add2e ?? {}; game.add2e.openArmorer = openArmorer; game.add2e.armorerAppVersion = VERSION; globalThis.ADD2E_ARMORER_APP_VERSION = VERSION; }
