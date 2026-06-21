/**
 * scripts/add2e.mjs
 * Point d'entrée ADD2E.
 * Fichier découpé en modules dans scripts/add2e/*.mjs.
 */
import "./add2e-initiative.mjs";
import "./add2e/00-legacy-global-helpers.mjs";
import "./add2e/spell-dialog-ui.mjs";
import "./add2e/item-sheet-registration.mjs";
import "./add2e/handlebars-helpers.mjs";
import "./add2e/character-sheet-templates.mjs";
import "./add2e/monster-sheet-capabilities.mjs";
import "./add2e/01-macros-base-caracs.mjs";
import "./add2e/02-spell-sync.mjs";
import "./add2e/02c-spell-family-expansion.mjs";
import "./add2e/02b-spell-sync-dedupe.mjs";
import "./add2e/03-equipment-rules.mjs";
import "./add2e/04-class-active-abilities.mjs";
import "./add2e/object-magic-powers.mjs";
import "./add2e/06-class-effects-thief.mjs";
import "./add2e/07-spellcasting-rules.mjs";
import "./add2e/09-race-class-drop.mjs";
import "./add2e/10-monk-rules.mjs";
import "./add2e/11-character-data-prep.mjs";
import "./add2e/12-carac-roller.mjs";
import "./add2e/13-actor-sheet-legacy.mjs";
import "./add2e/14-item-sheets.mjs";
import "./add2e/15-validation-sockets.mjs";
import "./add2e/16-preparation-display.mjs";
import "./add2e/17-movement-xp.mjs";
import "./add2e/17b-multiclass.mjs";
import "./add2e/17c-multiclass-mechanics.mjs";
import "./add2e/18-token-state-overlay.mjs";
import "./add2e/20-session-xp.mjs";
import "./add2e/21-consumables.mjs";
import "./add2e/24-player-trades.mjs";

function add2eSpellFamilyDropNormalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/\s*\([^)]*\)\s*$/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function add2eSpellFamilyDropLevel(system = {}) {
  const raw = system.niveau ?? system.niveau_sort ?? system.spellLevel ?? system.level ?? 0;
  return Number(String(raw).match(/\d+/)?.[0] ?? 0) || 0;
}

function add2eSpellFamilyDropLists(system = {}) {
  const raw = [
    system.spellLists,
    system.lists,
    system.classes,
    system.classe,
    system.class,
    system.liste
  ];

  return new Set(raw.flatMap(value => {
    if (Array.isArray(value)) return value;
    if (typeof value === "string") return value.split(/[,;|\n]+/g);
    return value === null || value === undefined ? [] : [value];
  }).map(add2eSpellFamilyDropNormalize).filter(Boolean));
}

function add2eActorAlreadyHasSpellFamily(actor, pendingItem) {
  const pendingName = add2eSpellFamilyDropNormalize(pendingItem?.name ?? pendingItem?.system?.nom);
  const pendingLevel = add2eSpellFamilyDropLevel(pendingItem?.system ?? {});
  const pendingLists = add2eSpellFamilyDropLists(pendingItem?.system ?? {});

  if (!pendingName) return false;

  return actor?.items?.some?.(item => {
    if (String(item?.type ?? "").toLowerCase() !== "sort") return false;

    const family = item.flags?.add2e?.spellFamily ?? {};
    if (family.generated !== true) return false;
    if (add2eSpellFamilyDropNormalize(family.sourceItemName) !== pendingName) return false;
    if (pendingLevel && add2eSpellFamilyDropLevel(item.system ?? {}) !== pendingLevel) return false;

    if (!pendingLists.size) return true;
    const existingLists = add2eSpellFamilyDropLists(item.system ?? {});
    return [...pendingLists].some(list => existingLists.has(list));
  }) ?? false;
}

Hooks.on("preCreateItem", (item, _data, options = {}, userId) => {
  if (String(userId ?? "") !== String(game.user?.id ?? "")) return;
  if (options?.add2eSpellFamilyExpansion || options?.add2eSpellSync) return;
  if (String(item?.type ?? "").toLowerCase() !== "sort") return;
  if (item.flags?.add2e?.spellFamily?.generated === true) return;

  const actor = item.actor ?? item.parent ?? null;
  if (!actor || actor.type !== "personnage") return;
  if (!add2eActorAlreadyHasSpellFamily(actor, item)) return;

  ui.notifications.warn(`"${item.name}" est déjà présent sur cet acteur.`);
  return false;
});

Hooks.once("ready", () => {
  if (globalThis.__ADD2E_VENDOR_STALE_ROW_GUARD__) return;
  globalThis.__ADD2E_VENDOR_STALE_ROW_GUARD__ = true;

  document.addEventListener("click", event => {
    const target = event.target instanceof Element ? event.target : null;
    const action = target?.closest?.(".add2e-merchant-app [data-action]") ?? null;
    if (!action || action.dataset?.action === "restock") return;

    const row = action.closest?.("tr[data-id]") ?? null;
    if (row?.dataset?.id) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    ui.notifications.warn("La liste du marchand vient d’être actualisée. Réessaie l’action.");
  }, true);
});

function add2eShopPriceIsDefined(item) {
  const system = item?.system ?? {};
  const flags = item?.flags?.add2e ?? {};
  const status = String(flags.priceStatus ?? "").toLowerCase();
  if (["unpriced", "variable"].includes(status)) return false;

  const raw = system.prix ?? system.price ?? system.cout ?? system.coût ?? system.cost ?? flags.prix;
  if (typeof raw === "number") return Number.isFinite(raw) && raw > 0;
  if (raw && typeof raw === "object") {
    const value = raw.valeur ?? raw.value ?? raw.montant ?? raw.amount;
    return Number.isFinite(Number(value)) && Number(value) > 0;
  }

  const match = String(raw ?? "").match(/([0-9]+(?:[.,][0-9]+)?)/);
  return Boolean(match && Number(String(match[1]).replace(",", ".")) > 0);
}

function add2eMerchantAppForElement(element) {
  const apps = globalThis.__ADD2E_MERCHANT_UNIT_APPS instanceof Map
    ? [...globalThis.__ADD2E_MERCHANT_UNIT_APPS.values()]
    : [];

  return apps.find(app => {
    const root = app?.element?.jquery ? app.element[0] : app?.element;
    return root === element || root?.contains?.(element);
  }) ?? null;
}

function add2eShopColumnStorageKey(table) {
  const root = table.closest?.(".add2e-merchant-app, .add2e-armorer-app");
  const type = root?.classList?.contains("add2e-armorer-app") ? "armorer" : "merchant";
  const columns = [...table.querySelectorAll("thead th")]
    .map(header => String(header.textContent ?? "").trim() || "action")
    .join("|");

  return `add2e.${type}.column-widths.v1.${columns}`;
}

function add2eReadShopColumnWidths(table) {
  try {
    const value = localStorage.getItem(add2eShopColumnStorageKey(table));
    const parsed = value ? JSON.parse(value) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (_error) {
    return {};
  }
}

function add2eWriteShopColumnWidths(table, widths) {
  try {
    localStorage.setItem(add2eShopColumnStorageKey(table), JSON.stringify(widths));
  } catch (_error) {}
}

function add2eInstallResizableShopTable(table) {
  if (!table || table.dataset.add2eColumnResizeBound === "1") return;

  const headers = [...table.querySelectorAll("thead th")];
  if (headers.length < 2) return;

  table.dataset.add2eColumnResizeBound = "1";
  table.style.tableLayout = "fixed";
  table.style.width = "100%";

  const widths = add2eReadShopColumnWidths(table);

  headers.forEach((header, index) => {
    const key = String(header.textContent ?? "").trim() || `column-${index}`;
    const savedWidth = Number(widths[key]);
    if (Number.isFinite(savedWidth) && savedWidth >= 54) {
      header.style.width = `${savedWidth}px`;
    }

    if (index === headers.length - 1) return;

    header.style.position = "relative";
    header.style.userSelect = "none";

    const handle = document.createElement("span");
    handle.className = "add2e-shop-column-resizer";
    handle.title = "Glisser pour redimensionner la colonne";
    Object.assign(handle.style, {
      position: "absolute",
      top: "0",
      right: "-4px",
      width: "8px",
      height: "100%",
      cursor: "col-resize",
      zIndex: "5"
    });

    handle.addEventListener("pointerdown", event => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();

      const startX = event.clientX;
      const startWidth = header.getBoundingClientRect().width;
      const bodyCursor = document.body.style.cursor;
      document.body.style.cursor = "col-resize";

      const move = moveEvent => {
        const width = Math.max(54, Math.round(startWidth + moveEvent.clientX - startX));
        header.style.width = `${width}px`;
        widths[key] = width;
      };

      const stop = () => {
        document.removeEventListener("pointermove", move, true);
        document.removeEventListener("pointerup", stop, true);
        document.removeEventListener("pointercancel", stop, true);
        document.body.style.cursor = bodyCursor;
        add2eWriteShopColumnWidths(table, widths);
      };

      document.addEventListener("pointermove", move, true);
      document.addEventListener("pointerup", stop, true);
      document.addEventListener("pointercancel", stop, true);
    });

    header.append(handle);
  });
}

function add2eRefreshMerchantPriceCells(root = document) {
  for (const table of root.querySelectorAll?.(".add2e-merchant-app .add2e-vendor-table") ?? []) {
    const app = add2eMerchantAppForElement(table);
    if (!app?.vendor) continue;

    for (const row of table.querySelectorAll("tbody tr[data-id]")) {
      const item = app.vendor.items?.get?.(row.dataset.id) ?? null;
      if (!item || add2eShopPriceIsDefined(item)) continue;

      const priceCell = row.querySelector(".col-prix");
      if (priceCell) {
        priceCell.textContent = "Prix non défini";
        priceCell.title = "Le prix doit être renseigné dans le JSON de cet objet.";
      }

      const buyAction = row.querySelector('[data-action="buy"]');
      if (buyAction) {
        buyAction.dataset.disabled = "1";
        buyAction.setAttribute("aria-disabled", "true");
        buyAction.title = "Prix non défini dans le JSON";
        buyAction.classList.add("disabled");
      }
    }
  }
}

function add2eInstallShopUiTools() {
  if (globalThis.__ADD2E_SHOP_UI_TOOLS_V1__) return;
  globalThis.__ADD2E_SHOP_UI_TOOLS_V1__ = true;

  let scheduled = false;
  const refresh = () => {
    scheduled = false;
    const root = document;
    for (const table of root.querySelectorAll(".add2e-merchant-app table, .add2e-armorer-app table")) {
      add2eInstallResizableShopTable(table);
    }
    add2eRefreshMerchantPriceCells(root);
  };

  const scheduleRefresh = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(refresh);
  };

  const observer = new MutationObserver(scheduleRefresh);
  observer.observe(document.body, { childList: true, subtree: true });
  scheduleRefresh();

  document.addEventListener("click", event => {
    const target = event.target instanceof Element ? event.target : null;
    const buyAction = target?.closest?.('.add2e-merchant-app [data-action="buy"]') ?? null;
    if (!buyAction) return;

    const row = buyAction.closest?.("tr[data-id]") ?? null;
    const app = add2eMerchantAppForElement(buyAction);
    const item = app?.vendor?.items?.get?.(row?.dataset?.id) ?? null;
    if (!item || add2eShopPriceIsDefined(item)) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    ui.notifications.warn(`Prix non défini dans le JSON : ${item.name}.`);
  }, true);
}

Hooks.once("ready", add2eInstallShopUiTools);
