// ADD2E — Multiclassage : avertissement limite de niveau
// Version : 2026-06-13-multiclass-level-cap-dialog-v1
//
// Module split depuis 17b-multiclass.mjs.
// Rôle limité : afficher un DialogV2 quand un niveau par classe demandé dépasse la limite raciale.
// La mécanique XP/niveau reste dans 17b-multiclass.mjs.

const VERSION = "2026-06-13-multiclass-level-cap-dialog-v1";
const TAG = "[ADD2E][MULTICLASSE][LEVEL_CAP_DIALOG]";

globalThis.ADD2E_MULTICLASS_LEVEL_CAP_DIALOG_VERSION = VERSION;

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function norm(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function itemLabel(data, fallback = "Item") {
  const sys = data?.system ?? data ?? {};
  return String(data?.name ?? sys.label ?? sys.nom ?? sys.name ?? fallback).trim() || fallback;
}

function classItems(actor) {
  return (actor?.items?.contents ?? Array.from(actor?.items ?? []))
    .filter(i => String(i.type || "").toLowerCase() === "classe");
}

function raceItem(actor) {
  return actor?.items?.find?.(i => String(i.type || "").toLowerCase() === "race") ?? null;
}

function systemRace(actor) {
  const item = raceItem(actor);
  if (item) return item;
  const sys = actor?.system ?? {};
  return { name: sys.race ?? sys.details_race?.label ?? sys.details_race?.name ?? "Race", system: sys.details_race ?? {} };
}

function classSlug(data) {
  const sys = data?.system ?? data ?? {};
  return norm(sys.slug ?? sys.label ?? sys.nom ?? sys.name ?? data?.name ?? "classe");
}

function findSheetActorFromInput(input) {
  const host = input?.closest?.("[data-add2e-multiclass-cap-actor-id]");
  const actorId = host?.dataset?.add2eMulticlassCapActorId;
  if (actorId) return game.actors?.get?.(actorId) ?? null;

  const appElement = input?.closest?.(".application, .app, section.window-app");
  const appId = appElement?.id;
  const app = appId ? Object.values(ui.windows ?? {}).find(w => w?.id === appId || w?.element?.id === appId || w?.element?.[0]?.id === appId) : null;
  return app?.actor ?? app?.document ?? null;
}

function classMaxLevel(actor, classDoc, raceData) {
  if (typeof globalThis.add2eMulticlassClassRaceMaxLevel === "function") {
    try {
      const value = Number(globalThis.add2eMulticlassClassRaceMaxLevel(classDoc, raceData));
      if (Number.isFinite(value) && value > 0) return value;
    } catch (err) {
      console.warn(`${TAG}[HELPER_ERROR]`, err);
    }
  }

  const sys = classDoc?.system ?? {};
  const rules = sys.raceRestriction?.races ?? {};
  const raceKey = `race:${norm(itemLabel(raceData, "Race"))}`;
  const rule = rules[raceKey] ?? rules[norm(raceKey)] ?? null;
  const value = Number(rule?.maxLevel ?? rule?.niveauMax ?? rule?.max ?? 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

async function alertLevelCap({ actor, classDoc, raceData, requestedLevel, maxLevel }) {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  const className = itemLabel(classDoc, "Classe");
  const raceName = itemLabel(raceData, "Race");
  const content = `<p><b>${esc(className)}</b> ne peut pas dépasser le niveau <b>${esc(maxLevel)}</b> pour la race <b>${esc(raceName)}</b>.</p><p>Le niveau demandé <b>${esc(requestedLevel)}</b> a été ramené à <b>${esc(maxLevel)}</b>.</p>`;

  if (DialogV2?.alert) {
    await DialogV2.alert({
      window: { title: "ADD2E — Niveau maximum atteint" },
      content,
      ok: { label: "Compris" },
      modal: true
    });
    return true;
  }

  ui.notifications?.warn?.(`${className} : niveau maximum ${maxLevel} pour ${raceName}.`);
  return false;
}

function installSheetMarker(app, html) {
  const actor = app?.actor ?? app?.document;
  if (!actor || actor.type !== "personnage") return;
  const root = html?.jquery ? html[0] : html;
  if (!root?.dataset) return;
  root.dataset.add2eMulticlassCapActorId = actor.id;
}

function installDocumentListener() {
  if (globalThis.__ADD2E_MULTICLASS_LEVEL_CAP_DIALOG_INSTALLED) return;
  globalThis.__ADD2E_MULTICLASS_LEVEL_CAP_DIALOG_INSTALLED = true;

  document.addEventListener("change", event => {
    const input = event.target?.closest?.('input[name^="system.niveaux_par_classe."]');
    if (!input) return;

    const actor = findSheetActorFromInput(input);
    if (!actor || actor.type !== "personnage") return;

    const slug = String(input.name).slice("system.niveaux_par_classe.".length);
    if (!slug) return;

    const requestedLevel = Math.max(1, Math.floor(Number(input.value) || 0));
    const classDoc = classItems(actor).find(cls => classSlug(cls) === slug);
    if (!classDoc) return;

    const raceData = systemRace(actor);
    const maxLevel = classMaxLevel(actor, classDoc, raceData);
    if (!maxLevel || requestedLevel <= maxLevel) return;

    setTimeout(() => {
      alertLevelCap({ actor, classDoc, raceData, requestedLevel, maxLevel }).catch(err => console.warn(`${TAG}[DIALOG_ERROR]`, err));
    }, 0);
  }, true);
}

Hooks.on("renderActorSheet", installSheetMarker);
Hooks.on("renderAdd2eActorSheet", installSheetMarker);
Hooks.once("ready", installDocumentListener);

console.log(`${TAG}[READY]`, VERSION);
