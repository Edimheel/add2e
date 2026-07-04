// ADD2E — Point d'entrée getData de la feuille ApplicationV2.
// Les comportements restent répartis en modules fonctionnels.

import "./13b-actor-sheet-get-data-core.mjs";

const ADD2E_THIEF_SHEET_BRIDGE_FLAG = "__ADD2E_THIEF_SHEET_BRIDGE_V3";
const ADD2E_THIEF_TWO_LINE_STYLE_ID = "add2e-thief-two-line-labels";
const ADD2E_THIEF_DIAG_CACHE = new Map();

function add2eThiefRaceItem(actor) {
  return Array.from(actor?.items ?? []).find(item => String(item?.type ?? "").toLowerCase() === "race") ?? null;
}

function add2eThiefRaceDiagnostic(actor) {
  const item = add2eThiefRaceItem(actor);
  const itemSystem = item?.system ?? {};
  const details = actor?.system?.details_race ?? {};
  const adjustments = itemSystem.thief_adjustments
    ?? itemSystem.multiclassing?.thief_adjustments
    ?? details.thief_adjustments
    ?? details.multiclassing?.thief_adjustments
    ?? null;

  return {
    actor: actor?.name ?? "",
    actorId: actor?.id ?? "",
    race: item?.name ?? details.label ?? actor?.system?.race ?? "",
    raceItemId: item?.id ?? "",
    raceSlug: itemSystem.slug ?? details.slug ?? "",
    thief_adjustments: adjustments
  };
}

function add2eLogThiefRows(actor, rows) {
  if (globalThis.ADD2E_DEBUG_THIEF_RACIAL !== true) return;

  const source = add2eThiefRaceDiagnostic(actor);
  const view = rows.map(row => ({
    key: row?.key ?? "",
    base: row?.base ?? 0,
    bonusTotal: row?.bonusTotal ?? 0,
    bonuses: Array.isArray(row?.bonuses) ? row.bonuses.map(entry => `${entry?.label ?? "Bonus"} ${Number(entry?.value ?? 0) >= 0 ? "+" : ""}${Number(entry?.value ?? 0)}%`).join(" | ") : "",
    finalValue: row?.finalValue ?? row?.value ?? 0
  }));
  const signature = JSON.stringify({ source, view });
  const cacheKey = String(actor?.uuid ?? actor?.id ?? source.race ?? "thief");
  if (ADD2E_THIEF_DIAG_CACHE.get(cacheKey) === signature) return;
  ADD2E_THIEF_DIAG_CACHE.set(cacheKey, signature);

  console.info("[ADD2E][THIEF_DIAG][SOURCE]", source);
  console.table(view);
}

function add2eCanonicalThiefRows(actor) {
  const getSkills = globalThis.add2eGetActorThiefSkills;
  if (typeof getSkills !== "function") {
    console.warn("[ADD2E][THIEF_DIAG][MISSING_CANONICAL]", { actor: actor?.name ?? "" });
    return [];
  }

  const rows = Array.from(getSkills(actor) ?? []);
  add2eLogThiefRows(actor, rows);
  return rows;
}

function add2eInstallThiefSheetBridge() {
  const getSkills = globalThis.add2eGetActorThiefSkills;
  if (typeof getSkills !== "function") return;

  globalThis.add2eGetActorThiefSkillTable = actor => add2eCanonicalThiefRows(actor);
}

function add2eInstallThiefTwoLineLabels() {
  document.getElementById(ADD2E_THIEF_TWO_LINE_STYLE_ID)?.remove();

  const style = document.createElement("style");
  style.id = ADD2E_THIEF_TWO_LINE_STYLE_ID;
  style.textContent = `
    .add2e-character-v2-app .add2e-character-v3 .a2e-thief-skill-card,
    .add2e-character-v2-app .add2e-character-v3 button.a2e-thief-skill-card,
    .add2e-character-v3 .a2e-thief-skill-card,
    .add2e-character-v3 button.a2e-thief-skill-card {
      grid-template-rows:32px 18px 18px !important;
      min-height:88px !important;
    }
    .add2e-character-v2-app .add2e-character-v3 .a2e-thief-skill-name,
    .add2e-character-v3 .a2e-thief-skill-name {
      font-size:.70em !important;
      line-height:1.05 !important;
      white-space:normal !important;
      overflow:visible !important;
      text-overflow:clip !important;
      overflow-wrap:anywhere !important;
    }
    .add2e-character-v2-app .add2e-character-v3 .a2e-thief-skill-total,
    .add2e-character-v3 .a2e-thief-skill-total { font-size:1.02em !important; }
    .add2e-character-v2-app .add2e-character-v3 .a2e-thief-skill-detail,
    .add2e-character-v3 .a2e-thief-skill-detail { font-size:.66em !important; }
  `;
  document.head.appendChild(style);
}

function add2eRefreshThiefSheetBridge() {
  add2eInstallThiefSheetBridge();
  add2eInstallThiefTwoLineLabels();
}

function add2eBootThiefSheetBridge() {
  if (globalThis[ADD2E_THIEF_SHEET_BRIDGE_FLAG]) return;
  globalThis[ADD2E_THIEF_SHEET_BRIDGE_FLAG] = true;
  globalThis.ADD2E_DEBUG_THIEF_RACIAL ??= true;

  add2eRefreshThiefSheetBridge();
  window.setTimeout(add2eRefreshThiefSheetBridge, 50);

  Hooks.on("renderActorSheet", () => {
    window.setTimeout(add2eRefreshThiefSheetBridge, 0);
  });
}

if (game?.ready) add2eBootThiefSheetBridge();
else Hooks.once("ready", add2eBootThiefSheetBridge);
