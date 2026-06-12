// ADD2E — Colonnes JSON des sorts sur la feuille personnage
// ApplicationV2 compatible V13/V14/V15 : patch UI post-rendu, sans Dialog/Application V1.
// But : afficher strictement les champs présents dans le JSON de sort :
// - system.école
// - system.type
// - system.composants_materiels

const ADD2E_SPELL_JSON_COLUMNS_VERSION = "2026-06-12-spell-json-columns-v1";
globalThis.ADD2E_SPELL_JSON_COLUMNS_VERSION = ADD2E_SPELL_JSON_COLUMNS_VERSION;

function add2eSpellColumnsRoot(html) {
  if (!html) return null;
  if (html.jquery) return html[0] ?? null;
  if (html instanceof HTMLElement) return html;
  if (html.element instanceof HTMLElement) return html.element;
  return null;
}

function add2eSpellColumnsEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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

function add2eSpellColumnsActor(sheet) {
  return sheet?.actor ?? sheet?.document ?? null;
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
  if (!hasEcole || hasType || !actions) return false;

  actions.insertAdjacentHTML("beforebegin", "<th>Type</th><th>Composants</th>");
  return true;
}

function add2eSpellColumnsApplyToTable(actor, table) {
  if (!add2eSpellColumnsEnsureHeaders(table)) return;

  for (const row of table.querySelectorAll("tbody tr.sort-row")) {
    if (row.dataset.add2eSpellJsonColumns === "1") continue;
    const sort = add2eSpellColumnsGetSort(actor, row);
    const system = sort?.system ?? {};
    const type = system.type ?? "";
    const components = add2eSpellColumnsMaterialText(system.composants_materiels);
    const cells = Array.from(row.children);
    const actionsCell = cells[cells.length - 1];
    if (!actionsCell) continue;

    actionsCell.insertAdjacentHTML(
      "beforebegin",
      `<td>${add2eSpellColumnsEscape(type)}</td><td>${add2eSpellColumnsEscape(components)}</td>`
    );
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
          `<div class="add2e-spell-json-extra"><b>Type :</b> ${add2eSpellColumnsEscape(type)}</div>` +
          `<div class="add2e-spell-json-extra"><b>Composants matériels :</b> ${add2eSpellColumnsEscape(components)}</div>`
        );
      }
    }
  }
}

function add2eApplySpellJsonColumns(sheet, html) {
  const actor = add2eSpellColumnsActor(sheet);
  const root = add2eSpellColumnsRoot(html) ?? add2eSpellColumnsRoot(sheet?.element);
  if (!actor || !root) return;

  const sortTab = root.querySelector?.(".tab-sorts, [data-tab='sorts']");
  if (!sortTab) return;

  for (const table of sortTab.querySelectorAll("table.sort-table")) {
    add2eSpellColumnsApplyToTable(actor, table);
  }
}

globalThis.add2eApplySpellJsonColumns = add2eApplySpellJsonColumns;

const previousEnhanceCharacterSheetUi = globalThis.add2eEnhanceCharacterSheetUi;
globalThis.add2eEnhanceCharacterSheetUi = function add2eEnhanceCharacterSheetUiWithSpellColumns(sheet, html) {
  const result = typeof previousEnhanceCharacterSheetUi === "function"
    ? previousEnhanceCharacterSheetUi.call(this, sheet, html)
    : undefined;
  try { add2eApplySpellJsonColumns(sheet, html); }
  catch (err) { console.warn("[ADD2E][SPELL_JSON_COLUMNS][ERROR]", err); }
  return result;
};

console.log("[ADD2E][SPELL_JSON_COLUMNS][VERSION]", ADD2E_SPELL_JSON_COLUMNS_VERSION);
