// ============================================================
// ADD2E — 08 Character Sheet UI — point d'entrée
// Fichier découpé :
// - 08-character-sheet-ui-00-utils.mjs
// - 08-character-sheet-ui-01-effects.mjs
// - 08-character-sheet-ui-02-capacites.mjs
// - 08-character-sheet-ui-03-styles.mjs
// ============================================================
import {
  ADD2E_CHARACTER_SHEET_UI_VERSION,
  getSheetRoot,
  expose
} from "./08-character-sheet-ui-00-utils.mjs";
import { injectEffectsTab } from "./08-character-sheet-ui-01-effects.mjs";
import { injectCapacitesTab } from "./08-character-sheet-ui-02-capacites.mjs";
import { injectCharacterUiStyles } from "./08-character-sheet-ui-03-styles.mjs";

console.log("[ADD2E][CHARACTER_UI][VERSION]", ADD2E_CHARACTER_SHEET_UI_VERSION);

const ADD2E_ITEM_REFRESH_DELAY_MS = 80;
const add2eItemRefreshTimers = new Map();

function add2eNormalizeThiefTooltipKey(value) {
  const normalizer = globalThis.add2eNormalizeThiefSkillKey;
  if (typeof normalizer === "function") {
    try {
      const key = String(normalizer(value) ?? "").trim();
      if (key) return key;
    } catch (_error) {}
  }
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[_\s-]+/g, "_");
}

function add2eThiefTooltipRaceLabel(actor) {
  const raceItem = Array.from(actor?.items ?? []).find(item => String(item?.type ?? "").toLowerCase() === "race");
  return String(raceItem?.name ?? actor?.system?.details_race?.label ?? actor?.system?.details_race?.name ?? actor?.system?.race ?? "Race").trim() || "Race";
}

function add2eThiefTooltipSigned(value) {
  const number = Number(value) || 0;
  return `${number >= 0 ? "+" : ""}${number}%`;
}

function add2eThiefBonusTooltip(actor, skill) {
  const entries = Array.isArray(skill?.bonuses) ? skill.bonuses : [];
  const lines = entries
    .map(entry => {
      const value = Number(entry?.value) || 0;
      if (!value) return "";
      const source = String(entry?.label ?? "Bonus").trim();
      const label = source === "Race" ? `Race — ${add2eThiefTooltipRaceLabel(actor)}` : source;
      return `${label} ${add2eThiefTooltipSigned(value)}`;
    })
    .filter(Boolean);
  if (!lines.length) return "Aucun bonus appliqué.";
  return `Bonus total ${add2eThiefTooltipSigned(skill?.bonusTotal)}\n${lines.join("\n")}`;
}

function add2eApplyThiefBonusTooltips(actor, sheetRoot) {
  const readSkills = globalThis.add2eGetActorThiefSkills;
  if (!actor || typeof readSkills !== "function" || !sheetRoot) return;

  let skills = [];
  try {
    skills = Array.from(readSkills(actor) ?? []);
  } catch (error) {
    console.warn("[ADD2E][CAPACITES][VOLEUR][INFOBULLE] Lecture impossible.", error);
    return;
  }

  const byKey = new Map(skills.map(skill => [add2eNormalizeThiefTooltipKey(skill?.key ?? skill?.label), skill]));
  for (const card of sheetRoot.querySelectorAll(".a2e-thief-skill-card[data-skill-key]")) {
    const skill = byKey.get(add2eNormalizeThiefTooltipKey(card.dataset.skillKey));
    const badge = card.querySelector(".a2e-thief-skill-bonus");
    if (!skill || !badge) continue;
    const tooltip = add2eThiefBonusTooltip(actor, skill);
    badge.title = tooltip;
    badge.setAttribute("aria-label", tooltip);
  }
}

function add2eApplyObjectMagicHierarchy(sheetRoot) {
  const panel = sheetRoot?.querySelector?.(".add2e-object-magic-panel");
  if (!panel) return;

  for (const item of panel.querySelectorAll(".add2e-object-magic-item")) {
    const itemRow = item.firstElementChild;
    if (!(itemRow instanceof HTMLElement)) continue;

    itemRow.style.setProperty("background", "#e1c878", "important");
    itemRow.style.setProperty("border-left", "4px solid #8f6515", "important");
    itemRow.style.setProperty("box-shadow", "inset 0 -1px 0 rgba(111,75,18,.24)", "important");

    const itemName = itemRow.querySelector(".sort-name-link") ?? itemRow.querySelector("span");
    if (itemName instanceof HTMLElement) {
      itemName.style.setProperty("color", "#4b2e0b", "important");
      itemName.style.setProperty("font-size", ".98rem", "important");
      itemName.style.setProperty("font-weight", "950", "important");
    }
  }

  for (const row of panel.querySelectorAll("tr.add2e-object-magic-power-row")) {
    if (!(row instanceof HTMLElement)) continue;

    row.style.setProperty("background", "#fffaf0", "important");
    row.style.setProperty("border-left", "4px solid #d4b45a", "important");

    const iconCell = row.children?.[0];
    const nameCell = row.children?.[1];
    if (iconCell instanceof HTMLElement) iconCell.style.setProperty("padding-left", "9px", "important");
    if (nameCell instanceof HTMLElement) nameCell.style.setProperty("padding-left", "2px", "important");

    const image = row.querySelector("img.sort-cast-img");
    if (image instanceof HTMLElement) {
      for (const property of ["width", "height", "min-width", "max-width", "min-height", "max-height"]) {
        image.style.setProperty(property, "22px", "important");
      }
    }

    const link = row.querySelector(".sort-name-link");
    if (link instanceof HTMLElement) {
      link.style.setProperty("color", "#56328a", "important");
      link.style.setProperty("font-size", ".9rem", "important");
      link.style.setProperty("font-weight", "700", "important");

      if (!nameCell?.querySelector?.(".add2e-object-magic-child-marker")) {
        const marker = document.createElement("span");
        marker.className = "add2e-object-magic-child-marker";
        marker.textContent = "↳";
        marker.setAttribute("aria-hidden", "true");
        marker.style.marginRight = "5px";
        marker.style.color = "#9a6a20";
        marker.style.fontWeight = "900";
        marker.style.lineHeight = "1";
        nameCell?.insertBefore?.(marker, link);
      }
    }
  }
}

export function add2eEnhanceCharacterSheetUi(sheet, html) {
  const actor = sheet?.actor ?? sheet?.document;
  if (!actor || actor.type !== "personnage") return;

  const sheetRoot = getSheetRoot(html);
  if (!sheetRoot) return;

  injectEffectsTab(sheet, sheetRoot);
  injectCapacitesTab(sheet, sheetRoot);
  add2eApplyThiefBonusTooltips(actor, sheetRoot);
  injectCharacterUiStyles(sheetRoot);
  add2eApplyObjectMagicHierarchy(sheetRoot);
  add2eApplySpellJsonColumns(sheet, sheetRoot);

  sheet._add2eActivateTab?.(sheet._add2eActiveTab || sheet._add2eReadStoredTab?.() || "resume", sheetRoot);
}

function bindOnRender(app, html) {
  const actor = app?.actor ?? app?.document;
  if (actor?.type !== "personnage") return;

  for (const delay of [50, 150, 300]) {
    setTimeout(() => {
      try {
        add2eEnhanceCharacterSheetUi(app, html);
      } catch (err) {
        console.warn("[ADD2E][CHARACTER_UI][SPLIT] Injection impossible.", err);
      }
    }, delay);
  }
}

function add2eItemRefreshIsAutomaticSpellOperation(item, options = {}) {
  const type = String(item?.type ?? "").toLowerCase();
  if (["sort", "spell"].includes(type)) return true;
  return options?.add2eSpellSync === true
    || options?.add2eDropPurge === true
    || options?.add2eCompendiumTruth === true;
}

function add2eQueueActorSheetRefresh(actor, item, reason = "item-change") {
  const key = String(actor?.uuid ?? actor?.id ?? "");
  if (!key) return;
  const existing = add2eItemRefreshTimers.get(key);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    add2eItemRefreshTimers.delete(key);
    for (const app of Object.values(actor.apps ?? {})) {
      try {
        app._add2eRememberActiveTab?.(app.element, app._add2eActiveTab || app._add2eReadStoredTab?.() || "equipement");
        app.render(false);
      } catch (err) {
        console.warn("[ADD2E][CHARACTER_UI][REFRESH_ITEM] Impossible de rafraîchir la fiche", { actor: actor.name, item: item?.name, reason, err });
      }
    }
  }, ADD2E_ITEM_REFRESH_DELAY_MS);

  add2eItemRefreshTimers.set(key, timer);
}

function add2eRefreshActorSheetsForItemChange(item, reason = "item-change", options = {}) {
  const actor = item?.parent;
  if (!actor || actor.documentName !== "Actor" || actor.type !== "personnage") return;
  if (add2eItemRefreshIsAutomaticSpellOperation(item, options)) return;

  const type = String(item.type || "").toLowerCase();
  if (!["objet", "arme", "armure", "object", "magic", "objet_magique", "classe", "race"].includes(type)) return;

  const hasPowers = (() => {
    try {
      if (typeof globalThis.add2eMagicObjectActivePowerEntries === "function") return globalThis.add2eMagicObjectActivePowerEntries(item).length > 0;
    } catch (_e) {}
    const raw = item.system?.pouvoirs ?? [];
    return Array.isArray(raw) ? raw.length > 0 : !!(raw && typeof raw === "object" && Object.keys(raw).length);
  })();

  const isEquipment = ["objet", "arme", "armure", "object", "magic", "objet_magique"].includes(type);
  if ((isEquipment && !hasPowers) || (!isEquipment && options?.add2eInternal === true)) return;
  add2eQueueActorSheetRefresh(actor, item, reason);
}

function add2eEscapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = String(value ?? "");
  return div.innerHTML;
}

function add2eSpellColumnsIsPlaceholder(value) {
  return typeof value === "string" && /a[_\s-]*comple/i.test(value);
}

function add2eSpellColumnsFirstCleanText(...values) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    if (add2eSpellColumnsIsPlaceholder(value)) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
}

function add2eSpellColumnsMaterialText(value) {
  if (value === null || value === undefined || value === "") return "";
  if (Array.isArray(value)) {
    return value
      .map(entry => {
        if (entry === null || entry === undefined || entry === "") return "";
        if (typeof entry === "string") return entry;
        if (typeof entry === "object") return entry.nom ?? entry.name ?? entry.label ?? entry.id ?? JSON.stringify(entry);
        return String(entry);
      })
      .filter(Boolean)
      .join(", ");
  }
  if (typeof value === "object") return Object.values(value).filter(Boolean).join(", ");
  return String(value);
}

function add2eSpellColumnsGetSort(actor, row) {
  const id = row?.dataset?.sortId || row?.querySelector?.("[data-sort-id]")?.dataset?.sortId || "";
  if (!id || !actor?.items) return null;
  return actor.items.get?.(id) ?? actor.items.find?.(item => item.id === id || item._id === id) ?? null;
}

function add2eSpellColumnsEnsureHeaders(table) {
  const headerRow = table?.querySelector?.("thead tr");
  if (!headerRow) return false;
  const headers = Array.from(headerRow.querySelectorAll("th"));
  const hasEcole = headers.some(th => th.textContent.trim() === "École");
  const hasType = headers.some(th => th.textContent.trim() === "Type");
  const actions = headers.find(th => th.textContent.trim() === "Actions");
  if (!hasEcole || !actions) return false;
  if (!hasType) actions.insertAdjacentHTML("beforebegin", "<th>Type</th><th>Composants</th>");
  return true;
}

function add2eSpellColumnsApplyToTable(actor, table) {
  if (!add2eSpellColumnsEnsureHeaders(table)) return;
  const headerTexts = Array.from(table.querySelectorAll("thead tr th")).map(th => th.textContent.trim());
  const ecoleIndex = headerTexts.indexOf("École");
  const typeIndex = headerTexts.indexOf("Type");
  const componentsIndex = headerTexts.indexOf("Composants");

  for (const row of table.querySelectorAll("tbody tr.sort-row")) {
    const sort = add2eSpellColumnsGetSort(actor, row);
    const system = sort?.system ?? {};
    const ecole = add2eSpellColumnsFirstCleanText(system["école"], system.ecole, system.school);
    const type = add2eSpellColumnsFirstCleanText(system.type, system.composantes, system.composants, system.components);
    const components = add2eSpellColumnsMaterialText(system.composants_materiels);
    const cells = Array.from(row.children);
    const actionsCell = cells[cells.length - 1];
    if (!actionsCell) continue;

    if (ecole && ecoleIndex >= 0 && cells[ecoleIndex]) cells[ecoleIndex].textContent = ecole;

    if (row.dataset.add2eSpellJsonColumns === "1") continue;

    if (typeIndex >= 0 && componentsIndex >= 0 && cells[typeIndex] && cells[componentsIndex] && typeIndex < cells.length - 1) {
      cells[typeIndex].textContent = type;
      cells[componentsIndex].textContent = components;
    } else {
      actionsCell.insertAdjacentHTML(
        "beforebegin",
        `<td>${add2eEscapeHtml(type)}</td><td>${add2eEscapeHtml(components)}</td>`
      );
    }
    row.dataset.add2eSpellJsonColumns = "1";

    const descRow = row.nextElementSibling;
    const descCell = descRow?.classList?.contains("sort-description")
      ? descRow.querySelector("td.sort-description-fullcell")
      : null;
    if (descCell) {
      const current = Number(descCell.getAttribute("colspan") || 0) || 0;
      if (current > 0) descCell.setAttribute("colspan", String(current + 2));
      const content = descCell.querySelector(".sort-description-content");
      if (content && !content.querySelector(".add2e-spell-json-extra")) {
        content.insertAdjacentHTML(
          "beforeend",
          `<div class="add2e-spell-json-extra"><b>Type :</b> ${add2eEscapeHtml(type)}</div>` +
          `<div class="add2e-spell-json-extra"><b>Composants matériels :</b> ${add2eEscapeHtml(components)}</div>`
        );
      }
    }
  }
}

function add2eApplySpellJsonColumns(sheet, sheetRoot) {
  const actor = sheet?.actor ?? sheet?.document;
  if (!actor || !sheetRoot) return;
  const sortTab = sheetRoot.querySelector?.(".tab-sorts, [data-tab='sorts']");
  if (!sortTab) return;

  for (const table of sortTab.querySelectorAll("table.sort-table")) {
    add2eSpellColumnsApplyToTable(actor, table);
  }
}

Hooks.on("renderActorSheet", bindOnRender);
Hooks.on("renderApplication", bindOnRender);

Hooks.on("createItem", (item, options = {}) => {
  window.setTimeout(() => add2eRefreshActorSheetsForItemChange(item, "createItem", options), ADD2E_ITEM_REFRESH_DELAY_MS);
});
Hooks.on("updateItem", (item, _changes = {}, options = {}) => {
  window.setTimeout(() => add2eRefreshActorSheetsForItemChange(item, "updateItem", options), ADD2E_ITEM_REFRESH_DELAY_MS);
});
Hooks.on("deleteItem", (item, options = {}) => {
  window.setTimeout(() => add2eRefreshActorSheetsForItemChange(item, "deleteItem", options), ADD2E_ITEM_REFRESH_DELAY_MS);
});

expose("add2eEnhanceCharacterSheetUi", add2eEnhanceCharacterSheetUi);
