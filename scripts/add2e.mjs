/**
 * scripts/add2e.mjs
 * Point d'entrée ADD2E.
 * Fichier découpé en modules dans scripts/add2e/*.mjs.
 */
import "./add2e-initiative.mjs";
import "./add2e/00-legacy-global-helpers.mjs";
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
import "./add2e/06-class-effects.mjs";
import "./add2e/07-spellcasting-rules.mjs";
import "./add2e/09-race-class-drop.mjs";
import "./add2e/10-monk-rules.mjs";
import "./add2e/11-character-data-prep.mjs";
import "./add2e/12-carac-roller.mjs";
import "./add2e/object-magic-powers.mjs";
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

function add2eSpellFamilyDropLevel(item) {
  const level = Number(item?.system?.niveau);
  return Number.isInteger(level) && level >= 1 ? level : 0;
}

function add2eSpellFamilyDropLists(item) {
  const resolver = globalThis.add2eGetSpellListsFromItem;
  if (typeof resolver !== "function") {
    throw new Error("Le résolveur canonique ADD2E des listes de sorts est indisponible pour le garde anti-doublon.");
  }
  const resolved = resolver(item);
  if (!Array.isArray(resolved)) {
    throw new Error(`Listes canoniques invalides pour « ${item?.name ?? "sort inconnu"} ».`);
  }
  return new Set(resolved.filter(Boolean));
}

function add2eActorAlreadyHasSpellFamily(actor, pendingItem) {
  const pendingName = add2eSpellFamilyDropNormalize(pendingItem?.name ?? pendingItem?.system?.nom);
  const pendingLevel = add2eSpellFamilyDropLevel(pendingItem);
  const pendingLists = add2eSpellFamilyDropLists(pendingItem);

  if (!pendingName) return false;

  return actor?.items?.some?.(item => {
    if (String(item?.type ?? "").toLowerCase() !== "sort") return false;

    const family = item.flags?.add2e?.spellFamily ?? {};
    if (family.generated !== true) return false;
    if (add2eSpellFamilyDropNormalize(family.sourceItemName) !== pendingName) return false;
    if (pendingLevel && add2eSpellFamilyDropLevel(item) !== pendingLevel) return false;

    if (!pendingLists.size) return true;
    const existingLists = add2eSpellFamilyDropLists(item);
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
    const actionName = String(action?.dataset?.action ?? "");
    if (!action || !["buy", "stock", "assign"].includes(actionName)) return;

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

function add2eIsComponentItem(item) {
  const system = item?.system ?? {};
  const flags = item?.flags?.add2e ?? {};
  if (add2eSpellFamilyDropNormalize(system.categorie ?? system.category) === "composant_sort") return true;
  if (flags.schema === "equipement-composant-sort") return true;
  const tags = [system.tags, system.effectTags, flags.tags]
    .flatMap(value => Array.isArray(value) ? value : value ? [value] : [])
    .map(add2eSpellFamilyDropNormalize);
  return tags.includes("composant_sort") || tags.some(tag => tag.startsWith("composant_"));
}

function add2eIsPrimaryActiveGM() {
  if (!game.user?.isGM) return false;
  const primary = game.users?.activeGM ?? Array.from(game.users ?? []).find(user => user.active && user.isGM) ?? null;
  return !primary || String(primary.id) === String(game.user.id);
}

async function add2eSyncVendorComponentPricesFromCompendium() {
  if (!add2eIsPrimaryActiveGM()) return;

  const packIds = new Set(["add2e.equipements", "world.equipements", "add2e.equipement", "world.equipement"]);
  for (const [id, pack] of game.packs ?? []) {
    const label = `${id} ${pack?.metadata?.label ?? ""}`;
    if (pack?.documentName === "Item" && /equip|équip|objets?/i.test(label) && !/magique|magic/i.test(label)) {
      packIds.add(id);
    }
  }

  const sourceByName = new Map();
  for (const packId of packIds) {
    const pack = game.packs?.get?.(packId);
    if (!pack) continue;

    let documents = [];
    try { documents = await pack.getDocuments(); } catch (_error) { continue; }
    for (const item of documents) {
      if (!add2eIsComponentItem(item)) continue;
      sourceByName.set(add2eSpellFamilyDropNormalize(item.name), item);
    }
  }

  if (!sourceByName.size) return;

  for (const vendor of game.actors ?? []) {
    if (vendor.getFlag?.("add2e", "isVendor") !== true && vendor.name !== "Marchand de composants et projectiles") continue;

    const updates = [];
    for (const item of vendor.items ?? []) {
      if (!add2eIsComponentItem(item)) continue;
      const source = sourceByName.get(add2eSpellFamilyDropNormalize(item.name));
      if (!source) continue;

      const sourceSystem = source.system ?? {};
      const sourceFlags = source.flags?.add2e ?? {};
      const currentSystem = item.system ?? {};
      const currentFlags = item.flags?.add2e ?? {};

      const priceChanged = currentSystem.prix !== sourceSystem.prix
        || currentSystem.cout !== sourceSystem.cout
        || currentSystem.source_prix !== sourceSystem.source_prix
        || currentFlags.priceStatus !== sourceFlags.priceStatus
        || currentFlags.priceSource !== sourceFlags.priceSource;
      if (!priceChanged) continue;

      updates.push({
        _id: item.id,
        "system.prix": sourceSystem.prix ?? "",
        "system.cout": sourceSystem.cout ?? "",
        "system.source_prix": sourceSystem.source_prix ?? "",
        "flags.add2e.priceStatus": sourceFlags.priceStatus ?? "unpriced",
        "flags.add2e.priceSource": sourceFlags.priceSource ?? ""
      });
    }

    if (updates.length) {
      await vendor.updateEmbeddedDocuments("Item", updates, {
        add2eReason: "vendor-sync-component-prices-from-compendium",
        render: false
      });
      console.info("[ADD2E][VENDOR][COMPONENT_PRICE_SYNC]", { vendor: vendor.name, updated: updates.length });
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

Hooks.once("ready", () => {
  add2eInstallShopUiTools();
  window.setTimeout(() => add2eSyncVendorComponentPricesFromCompendium().catch(error => {
    console.error("[ADD2E][VENDOR][COMPONENT_PRICE_SYNC_ERROR]", error);
  }), 1500);
});

const ADD2E_MAGIC_POWER_CATALOGUE_RUNTIME_VERSION = "2026-07-21-magic-power-catalogue-loader-v1";
const ADD2E_MAGIC_POWER_CATALOGUE_MANIFEST_PATH = "sources/catalogue-pouvoirs-objets-magiques/index.json";
const ADD2E_MAGIC_POWER_ALLOWED_ITEM_TYPES = new Set(["arme", "armure", "objet"]);
const ADD2E_MAGIC_POWER_ALLOWED_AUTOMATION = new Set(["automatic", "assisted", "manual", "chat_card"]);
const ADD2E_MAGIC_POWER_CATALOGUE_STATE = globalThis.__ADD2E_MAGIC_POWER_CATALOGUE_STATE__ ?? {
  cache: null,
  promise: null
};
globalThis.__ADD2E_MAGIC_POWER_CATALOGUE_STATE__ = ADD2E_MAGIC_POWER_CATALOGUE_STATE;
globalThis.ADD2E_MAGIC_POWER_CATALOGUE_RUNTIME_VERSION = ADD2E_MAGIC_POWER_CATALOGUE_RUNTIME_VERSION;

function add2eMagicCatalogueNormalizeToken(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function add2eMagicCatalogueNormalizePath(value) {
  const segments = String(value ?? "").replace(/\\/g, "/").split("/");
  const output = [];
  for (const segment of segments) {
    if (!segment || segment === ".") continue;
    if (segment === "..") output.pop();
    else output.push(segment);
  }
  return output.join("/");
}

function add2eMagicCatalogueResolvePath(basePath, relativePath) {
  const relative = String(relativePath ?? "").trim();
  if (!relative) throw new Error("Chemin de fragment vide.");
  if (/^(?:https?:)?\/\//i.test(relative)) throw new Error(`Chemin externe interdit : ${relative}`);
  if (relative.startsWith("systems/")) return add2eMagicCatalogueNormalizePath(relative.replace(/^systems\/[^/]+\//, ""));
  if (relative.startsWith("sources/")) return add2eMagicCatalogueNormalizePath(relative);
  const baseDirectory = String(basePath ?? "").split("/").slice(0, -1).join("/");
  return add2eMagicCatalogueNormalizePath(`${baseDirectory}/${relative}`);
}

function add2eMagicCatalogueAssetRoute(relativePath) {
  const systemId = String(globalThis.game?.system?.id ?? "add2e");
  const systemPath = `systems/${systemId}/${add2eMagicCatalogueNormalizePath(relativePath)}`;
  const getRoute = globalThis.foundry?.utils?.getRoute ?? globalThis.getRoute;
  return typeof getRoute === "function" ? getRoute(systemPath) : systemPath;
}

function add2eMagicCatalogueClone(value) {
  if (value === undefined) return undefined;
  const deepClone = globalThis.foundry?.utils?.deepClone;
  if (typeof deepClone === "function") return deepClone(value);
  if (typeof globalThis.structuredClone === "function") return globalThis.structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

async function add2eMagicCatalogueFetchJson(relativePath) {
  const response = await fetch(add2eMagicCatalogueAssetRoute(relativePath), {
    cache: "no-store",
    credentials: "same-origin"
  });
  if (!response.ok) throw new Error(`${relativePath} : HTTP ${response.status} ${response.statusText}`);
  const document = await response.json();
  if (!document || typeof document !== "object" || Array.isArray(document)) {
    throw new Error(`${relativePath} : racine JSON invalide.`);
  }
  return document;
}

function add2eMagicCatalogueMergeVocabulary(target, source) {
  if (!source || typeof source !== "object" || Array.isArray(source)) return target;
  for (const [key, value] of Object.entries(source)) {
    if (Array.isArray(value)) {
      const existing = Array.isArray(target[key]) ? target[key] : [];
      const seen = new Set(existing.map(entry => JSON.stringify(entry)));
      target[key] = [...existing];
      for (const entry of value) {
        const signature = JSON.stringify(entry);
        if (seen.has(signature)) continue;
        seen.add(signature);
        target[key].push(add2eMagicCatalogueClone(entry));
      }
    } else if (value && typeof value === "object") {
      target[key] = add2eMagicCatalogueMergeVocabulary(
        target[key] && typeof target[key] === "object" && !Array.isArray(target[key]) ? target[key] : {},
        value
      );
    } else if (target[key] === undefined) {
      target[key] = value;
    }
  }
  return target;
}

function add2eMagicCatalogueCollectParameterReferences(value, references) {
  if (Array.isArray(value)) {
    for (const entry of value) add2eMagicCatalogueCollectParameterReferences(entry, references);
    return;
  }
  if (value && typeof value === "object") {
    for (const entry of Object.values(value)) add2eMagicCatalogueCollectParameterReferences(entry, references);
    return;
  }
  if (typeof value !== "string") return;
  const match = value.match(/^@([A-Za-z0-9_]+)$/);
  if (match) references.add(match[1]);
}

function add2eMagicCatalogueValidatePower(power, sourcePath, powerIds, errors) {
  const id = String(power?.id ?? "").trim();
  if (!id) {
    errors.push(`${sourcePath} : pouvoir sans identifiant.`);
    return;
  }
  if (powerIds.has(id)) errors.push(`${sourcePath} : identifiant de pouvoir dupliqué « ${id} ».`);
  else powerIds.add(id);

  if (!String(power?.label ?? "").trim()) errors.push(`${sourcePath}#${id} : libellé absent.`);
  if (!String(power?.category ?? "").trim()) errors.push(`${sourcePath}#${id} : catégorie absente.`);

  const itemTypes = power?.compatibility?.itemTypes;
  if (!Array.isArray(itemTypes) || !itemTypes.length) {
    errors.push(`${sourcePath}#${id} : compatibility.itemTypes absent.`);
  } else {
    for (const itemType of itemTypes) {
      const normalized = add2eMagicCatalogueNormalizeToken(itemType);
      if (!ADD2E_MAGIC_POWER_ALLOWED_ITEM_TYPES.has(normalized)) {
        errors.push(`${sourcePath}#${id} : type d’objet incompatible « ${itemType} ».`);
      }
    }
  }

  const automation = add2eMagicCatalogueNormalizeToken(power?.automation);
  if (!ADD2E_MAGIC_POWER_ALLOWED_AUTOMATION.has(automation)) {
    errors.push(`${sourcePath}#${id} : automatisation invalide « ${power?.automation ?? ""} ».`);
  }
  if (!String(power?.activation?.type ?? "").trim()) errors.push(`${sourcePath}#${id} : activation.type absent.`);
  if (!String(power?.activation?.trigger ?? "").trim()) errors.push(`${sourcePath}#${id} : activation.trigger absent.`);
  if (!Array.isArray(power?.effects) || !power.effects.length) errors.push(`${sourcePath}#${id} : aucun effet déclaré.`);

  const parameters = power?.parameters && typeof power.parameters === "object" && !Array.isArray(power.parameters)
    ? power.parameters
    : {};
  const references = new Set();
  add2eMagicCatalogueCollectParameterReferences(power?.effects, references);
  for (const reference of references) {
    if (!(reference in parameters)) errors.push(`${sourcePath}#${id} : paramètre référencé mais absent « ${reference} ».`);
  }
  for (const key of power?.validation?.requiresOneOf ?? []) {
    if (!(key in parameters)) errors.push(`${sourcePath}#${id} : validation.requiresOneOf référence « ${key} » absent.`);
  }
}

function add2eMagicCatalogueValidateAuditReferences(auditReferences, powerIds, errors) {
  for (const reference of auditReferences) {
    const sourcePath = reference.__sourcePath ?? "catalogue";
    if (reference.selectableAsTemplate !== false) {
      errors.push(`${sourcePath} : la référence d’audit « ${reference.name ?? "sans nom"} » doit rester non sélectionnable.`);
    }
    for (const entry of reference.powers ?? []) {
      const id = String(entry?.id ?? entry ?? "").trim();
      if (id && !powerIds.has(id)) errors.push(`${sourcePath} : référence de pouvoir inconnue « ${id} ».`);
    }
  }
}

function add2eMagicCataloguePowerCompatible(power, options = {}) {
  const itemType = add2eMagicCatalogueNormalizeToken(options.itemType);
  const profile = add2eMagicCatalogueNormalizeToken(options.profile);
  const categories = new Set(
    (Array.isArray(options.categories) ? options.categories : options.categories ? [options.categories] : [])
      .map(add2eMagicCatalogueNormalizeToken)
      .filter(Boolean)
  );
  const itemTypes = (power?.compatibility?.itemTypes ?? []).map(add2eMagicCatalogueNormalizeToken);
  const profiles = (power?.compatibility?.profiles ?? []).map(add2eMagicCatalogueNormalizeToken);
  const automation = add2eMagicCatalogueNormalizeToken(power?.automation);

  if (itemType && !itemTypes.includes(itemType)) return false;
  if (profile && profiles.length && !profiles.includes(profile)) return false;
  if (categories.size && !categories.has(add2eMagicCatalogueNormalizeToken(power?.category))) return false;
  if (options.includeAutomatic === false && automation === "automatic") return false;
  if (options.includeAssisted === false && automation === "assisted") return false;
  if (options.includeManual === false && automation === "manual") return false;
  if (options.includeChatCard === false && automation === "chat_card") return false;
  return true;
}

async function add2eLoadMagicPowerCatalogue({ force = false } = {}) {
  if (force) {
    ADD2E_MAGIC_POWER_CATALOGUE_STATE.cache = null;
    ADD2E_MAGIC_POWER_CATALOGUE_STATE.promise = null;
  }
  if (ADD2E_MAGIC_POWER_CATALOGUE_STATE.cache) return ADD2E_MAGIC_POWER_CATALOGUE_STATE.cache;
  if (ADD2E_MAGIC_POWER_CATALOGUE_STATE.promise) return ADD2E_MAGIC_POWER_CATALOGUE_STATE.promise;

  ADD2E_MAGIC_POWER_CATALOGUE_STATE.promise = (async () => {
    const manifest = await add2eMagicCatalogueFetchJson(ADD2E_MAGIC_POWER_CATALOGUE_MANIFEST_PATH);
    if (!Array.isArray(manifest.fragments) || !manifest.fragments.length) {
      throw new Error("Le manifeste du catalogue ne contient aucun fragment.");
    }
    if (manifest.artifactCatalogue?.mergeWithStandardPowers !== false) {
      throw new Error("Le catalogue des artefacts doit rester séparé des pouvoirs standards.");
    }

    const fragmentEntries = await Promise.all(manifest.fragments.map(async fragment => {
      const sourcePath = add2eMagicCatalogueResolvePath(ADD2E_MAGIC_POWER_CATALOGUE_MANIFEST_PATH, fragment.path);
      if (sourcePath.includes("/artefacts-reliques/")) {
        throw new Error(`Fragment d’artefact interdit dans le catalogue standard : ${sourcePath}`);
      }
      const document = await add2eMagicCatalogueFetchJson(sourcePath);
      return { manifestEntry: fragment, sourcePath, document };
    }));

    const errors = [];
    const powers = [];
    const powerIds = new Set();
    const vocabulary = {};
    const auditReferences = [];
    const fragments = [];

    for (const { manifestEntry, sourcePath, document } of fragmentEntries) {
      if (document.catalogueId && document.catalogueId !== manifest.catalogueId) {
        errors.push(`${sourcePath} : catalogueId différent du manifeste.`);
      }
      const fragmentPowers = Array.isArray(document.powers) ? document.powers : [];
      const expectedCount = Number(manifestEntry.verifiedPowerCount);
      if (Number.isFinite(expectedCount) && fragmentPowers.length !== expectedCount) {
        errors.push(`${sourcePath} : ${fragmentPowers.length} pouvoirs trouvés, ${expectedCount} attendus.`);
      }
      const declaredCount = Number(document.coverage?.powerCount);
      if (Number.isFinite(declaredCount) && fragmentPowers.length !== declaredCount) {
        errors.push(`${sourcePath} : compteur interne ${declaredCount}, contenu réel ${fragmentPowers.length}.`);
      }

      add2eMagicCatalogueMergeVocabulary(vocabulary, document.conditionVocabulary);
      add2eMagicCatalogueMergeVocabulary(vocabulary, document.conditionVocabularyAdditions);

      for (const power of fragmentPowers) {
        add2eMagicCatalogueValidatePower(power, sourcePath, powerIds, errors);
        powers.push(power);
      }
      for (const reference of document.auditReferences ?? []) {
        auditReferences.push({ ...reference, __sourcePath: sourcePath });
      }
      fragments.push({
        path: sourcePath,
        version: document.version ?? "",
        status: document.status ?? "",
        powerCount: fragmentPowers.length
      });
    }

    add2eMagicCatalogueValidateAuditReferences(auditReferences, powerIds, errors);

    const expectedTotal = Number(manifest.coverage?.verifiedStandardPowerCount);
    if (Number.isFinite(expectedTotal) && powers.length !== expectedTotal) {
      errors.push(`Total standard : ${powers.length} pouvoirs trouvés, ${expectedTotal} attendus.`);
    }
    if (errors.length) throw new Error(`Catalogue de pouvoirs magiques invalide :\n- ${errors.join("\n- ")}`);

    const powerById = new Map(powers.map(power => [power.id, power]));
    const byItemType = new Map([...ADD2E_MAGIC_POWER_ALLOWED_ITEM_TYPES].map(itemType => [
      itemType,
      powers.filter(power => (power.compatibility?.itemTypes ?? [])
        .map(add2eMagicCatalogueNormalizeToken)
        .includes(itemType))
    ]));

    const catalogue = {
      runtimeVersion: ADD2E_MAGIC_POWER_CATALOGUE_RUNTIME_VERSION,
      manifestPath: ADD2E_MAGIC_POWER_CATALOGUE_MANIFEST_PATH,
      manifest,
      fragments,
      powers: Object.freeze([...powers]),
      powerById,
      byItemType,
      vocabulary,
      auditReferences: auditReferences.map(({ __sourcePath, ...reference }) => reference),
      counts: {
        standardPowers: powers.length,
        fragments: fragments.length,
        artifactsExcluded: Number(manifest.coverage?.verifiedArtifactRelicPowerAndEffectCount ?? 0),
        artifactDestructionMethodsExcluded: Number(manifest.coverage?.verifiedArtifactRelicDestructionMethodCount ?? 0)
      },
      loadedAt: Date.now()
    };
    ADD2E_MAGIC_POWER_CATALOGUE_STATE.cache = catalogue;
    return catalogue;
  })();

  try {
    return await ADD2E_MAGIC_POWER_CATALOGUE_STATE.promise;
  } catch (error) {
    ADD2E_MAGIC_POWER_CATALOGUE_STATE.promise = null;
    throw error;
  }
}

function add2eGetMagicPowerCatalogue() {
  return ADD2E_MAGIC_POWER_CATALOGUE_STATE.cache;
}

function add2eGetMagicPowerById(powerId) {
  return ADD2E_MAGIC_POWER_CATALOGUE_STATE.cache?.powerById?.get?.(String(powerId ?? "").trim()) ?? null;
}

async function add2eGetCompatibleMagicPowers(options = {}) {
  const catalogue = await add2eLoadMagicPowerCatalogue();
  return catalogue.powers.filter(power => add2eMagicCataloguePowerCompatible(power, options));
}

function add2eClearMagicPowerCatalogueCache() {
  ADD2E_MAGIC_POWER_CATALOGUE_STATE.cache = null;
  ADD2E_MAGIC_POWER_CATALOGUE_STATE.promise = null;
}

globalThis.add2eLoadMagicPowerCatalogue = add2eLoadMagicPowerCatalogue;
globalThis.add2eGetMagicPowerCatalogue = add2eGetMagicPowerCatalogue;
globalThis.add2eGetMagicPowerById = add2eGetMagicPowerById;
globalThis.add2eGetCompatibleMagicPowers = add2eGetCompatibleMagicPowers;
globalThis.add2eClearMagicPowerCatalogueCache = add2eClearMagicPowerCatalogueCache;

Hooks.once("ready", async () => {
  game.add2e ??= {};
  game.add2e.magicPowerCatalogue = {
    load: add2eLoadMagicPowerCatalogue,
    get: add2eGetMagicPowerCatalogue,
    getById: add2eGetMagicPowerById,
    getCompatible: add2eGetCompatibleMagicPowers,
    clearCache: add2eClearMagicPowerCatalogueCache
  };
  try {
    await add2eLoadMagicPowerCatalogue();
  } catch (error) {
    console.error("[ADD2E][MAGIC_POWER_CATALOGUE][LOAD_ERROR]", error);
    if (game.user?.isGM) ui.notifications.error(`Catalogue des objets magiques invalide : ${error.message}`);
  }
});
