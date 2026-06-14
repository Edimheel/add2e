// ADD2E — Marchand V2 stabilisé temporairement.
// Version : 2026-06-14-merchant-safe-placeholder-v1

import { findVendor, createVendor, getBuyer, isVendorActor, alertBox } from "./22a-vendor-core.mjs";

export async function openVendor({ vendor = null, buyer = null } = {}) {
  vendor = vendor ?? findVendor();
  if (!vendor && game.user?.isGM) vendor = await createVendor();
  buyer = buyer ?? getBuyer();
  if (!vendor) return alertBox("Marchand introuvable", "Le marchand doit être créé côté MJ.");
  if (!buyer && !game.user?.isGM) return alertBox("Aucun acheteur", "Aucun personnage assigné ou sélectionné.");
  return vendor.sheet?.render?.(true);
}

export function bindAllVendorTokens() {
  for (const token of canvas?.tokens?.placeables ?? []) {
    if (!isVendorActor(token?.actor)) continue;
    try { token.cursor = "pointer"; token.eventMode = "static"; token.interactive = true; } catch (_e) {}
  }
}

export function patchVendorTokenClick() {
  if (globalThis.__ADD2E_VENDOR_SAFE_CLICK_V1) return;
  globalThis.__ADD2E_VENDOR_SAFE_CLICK_V1 = true;
  const TokenClass = foundry?.canvas?.placeables?.Token ?? CONFIG?.Token?.objectClass ?? globalThis.Token;
  const proto = TokenClass?.prototype;
  if (proto && typeof proto._onClickLeft === "function") {
    const original = proto._onClickLeft;
    proto._onClickLeft = function(event) {
      const result = original.call(this, event);
      if (isVendorActor(this.actor)) window.setTimeout(() => openVendor({ vendor: this.actor, buyer: getBuyer() }), 0);
      return result;
    };
  }
  Hooks.on("canvasReady", bindAllVendorTokens);
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
  game.add2e.vendorAppVersion = "2026-06-14-merchant-safe-placeholder-v1";
}
