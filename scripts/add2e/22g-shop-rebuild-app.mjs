// ADD2E — Fenêtres boutiques reconstruites.
// Version : 2026-06-14-shop-app-rebuild-v1

export const SHOP_APP_REBUILD_VERSION = "2026-06-14-shop-app-rebuild-v1";

export function add2eShopRebuildMarker() {
  game.add2e = game.add2e ?? {};
  game.add2e.shopRebuildVersion = SHOP_APP_REBUILD_VERSION;
}
