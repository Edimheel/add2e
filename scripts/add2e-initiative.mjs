// scripts/add2e-initiative.mjs
// ADD2E — Initiative indépendante.
// Règle gérée ici : initiative simple au d6, ordre ascendant.
// Surprise volontairement non gérée dans ce module.

const ADD2E_INITIATIVE_VERSION = "2026-05-24-init-independent-v6-d6-combatant-only";
const TAG = "[ADD2E][INIT]";
const ADD2E_INITIATIVE_D6_ICON = "systems/add2e/assets/D6_3D_tracker.png";

globalThis.ADD2E_INITIATIVE_VERSION = ADD2E_INITIATIVE_VERSION;

let add2eInitiativeSortRunning = false;
let add2eInitiativeSortTimer = null;
let add2eInitiativeConfigured = false;
let add2eLegacyHooksCleaned = false;

function add2eConfigureInitiative() {
  if (add2eInitiativeConfigured) return;
  add2eInitiativeConfigured = true;

  CONFIG.Combat ??= {};
  CONFIG.Combat.initiative = {
    formula: "1d6",
    decimals: 2
  };

  console.log(`${TAG}[CONFIG]`, {
    version: ADD2E_INITIATIVE_VERSION,
    formula: CONFIG.Combat.initiative.formula,
    order: "ascending",
    surprise: "not-managed"
  });
}

function add2eHookFnSource(entry) {
  const fn = entry?.fn ?? entry?.callback ?? entry;
  if (typeof fn !== "function") return "";
  try { return Function.prototype.toString.call(fn); }
  catch (_e) { return ""; }
}

function add2eRemoveLegacyInitiativeHooksFromStore(store) {
  if (!store || typeof store !== "object") return 0;

  let removed = 0;
  for (const hookName of ["updateCombatant", "updateCombat"]) {
    let entries = store[hookName];
    if (!Array.isArray(entries)) continue;

    const before = entries.length;
    entries = entries.filter(entry => {
      const src = add2eHookFnSource(entry);
      const isLegacyInitiativeHook =
        src.includes("triInitiativeAscendant") ||
        src.includes("game.combat.combatants.contents.slice().sort") ||
        src.includes("updateEmbeddedDocuments(\"Combatant\"");

      return !isLegacyInitiativeHook;
    });

    removed += before - entries.length;
    store[hookName] = entries;
  }

  return removed;
}

function add2eRemoveLegacyInitiativeHooks() {
  if (add2eLegacyHooksCleaned) return 0;
  add2eLegacyHooksCleaned = true;

  let removed = 0;
  try { removed += add2eRemoveLegacyInitiativeHooksFromStore(Hooks.events); } catch (_e) {}
  try { removed += add2eRemoveLegacyInitiativeHooksFromStore(Hooks._hooks); } catch (_e) {}

  console.log(`${TAG}[LEGACY_HOOKS_CLEAN]`, {
    version: ADD2E_INITIATIVE_VERSION,
    removed
  });

  return removed;
}

function add2eInitiativeNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function add2eSortInitiativeAscending(combat = game.combat) {
  if (!combat || add2eInitiativeSortRunning) return false;

  const combatants = Array.from(combat.combatants ?? []);
  if (!combatants.length) return false;

  const sorted = combatants.slice().sort((a, b) => {
    const ai = add2eInitiativeNumber(a.initiative);
    const bi = add2eInitiativeNumber(b.initiative);

    if (ai === null && bi === null) return 0;
    if (ai === null) return 1;
    if (bi === null) return -1;
    if (ai !== bi) return ai - bi;

    return String(a.id).localeCompare(String(b.id));
  });

  const updates = sorted
    .map((combatant, index) => ({ _id: combatant.id, sort: index }))
    .filter(update => {
      const current = combatants.find(c => c.id === update._id);
      return current && Number(current.sort) !== Number(update.sort);
    });

  if (!updates.length) return false;

  add2eInitiativeSortRunning = true;
  try {
    console.log(`${TAG}[SORT_ASC]`, {
      combat: combat.id,
      order: sorted.map(c => ({
        id: c.id,
        name: c.name,
        initiative: c.initiative,
        sort: c.sort
      }))
    });

    await combat.updateEmbeddedDocuments("Combatant", updates, {
      add2eInitiativeSort: true
    });

    ui.combat?.render?.(true);
    return true;
  } catch (err) {
    console.error(`${TAG}[SORT_ASC][ERROR]`, err);
    return false;
  } finally {
    add2eInitiativeSortRunning = false;
  }
}

function add2eScheduleInitiativeSort(combat = game.combat) {
  if (!combat) return;
  clearTimeout(add2eInitiativeSortTimer);
  add2eInitiativeSortTimer = setTimeout(() => {
    add2eSortInitiativeAscending(combat);
  }, 100);
}

function add2eExposeInitiativeGlobals() {
  globalThis.add2eConfigureInitiative = add2eConfigureInitiative;
  globalThis.add2eSortInitiativeAscending = add2eSortInitiativeAscending;
  globalThis.add2eScheduleInitiativeSort = add2eScheduleInitiativeSort;
  globalThis.add2ePatchCombatTrackerInitiativeIcons = add2ePatchCombatTrackerInitiativeIcons;
  globalThis.triInitiativeAscendant = add2eSortInitiativeAscending;
}

function add2eMakeD6Image() {
  const img = document.createElement("img");
  img.src = ADD2E_INITIATIVE_D6_ICON;
  img.alt = "D6";
  img.className = "add2e-init-d6-icon";
  img.style.width = "22px";
  img.style.height = "22px";
  img.style.objectFit = "contain";
  img.style.verticalAlign = "middle";
  img.style.border = "0";
  img.style.margin = "0";
  img.style.padding = "0";
  img.style.filter = "drop-shadow(0 0 2px rgba(255,255,255,.35))";
  return img;
}

function add2eIsCombatantInitiativeButton(button) {
  if (!button?.closest) return false;
  const row = button.closest(".combatant, li[data-combatant-id], [data-combatant-id]");
  if (!row) return false;
  const isRollAction =
    button.matches?.("button.combatant-control.roll") ||
    button.matches?.("[data-action='rollInitiative']") ||
    button.matches?.("[data-control='rollInitiative']") ||
    button.classList?.contains("roll");
  return !!isRollAction;
}

function add2ePatchInitiativeButtonBackground(button) {
  if (!add2eIsCombatantInitiativeButton(button)) return false;

  button.style.setProperty("background-image", `url('${ADD2E_INITIATIVE_D6_ICON}')`, "important");
  button.style.setProperty("background-size", "contain", "important");
  button.style.setProperty("background-repeat", "no-repeat", "important");
  button.style.setProperty("background-position", "center", "important");
  button.dataset.add2eD6InitiativeIcon = "1";
  button.title = button.title || "Lancer l'initiative ADD2E (1d6)";
  return true;
}

function add2ePatchOneInitiativeElement(el) {
  if (!el) return false;

  const button = el.matches?.("button, a")
    ? el
    : el.closest?.("button, a") ?? el.querySelector?.("button, a");
  if (!add2eIsCombatantInitiativeButton(button)) return false;

  const icon = button.querySelector?.("i.fa-dice-d20");
  if (icon && !button.querySelector(".add2e-init-d6-icon")) icon.replaceWith(add2eMakeD6Image());
  return add2ePatchInitiativeButtonBackground(button);
}

function add2ePatchCombatTrackerInitiativeIcons(root = document) {
  try {
    const scope = root?.jquery ? root[0] : root;
    if (!scope?.querySelectorAll) return 0;

    // IMPORTANT : uniquement les boutons d'initiative par combattant visibles dans le tracker.
    // On ne touche pas aux boutons globaux rollAll/rollNPC ni aux autres dés d20 de l'interface.
    const selectors = [
      "#combat-tracker .combatant button.combatant-control.roll",
      "#combat .combatant button.combatant-control.roll",
      ".combat-sidebar .combatant button.combatant-control.roll",
      "#combat-tracker [data-combatant-id] button.combatant-control.roll",
      "#combat [data-combatant-id] button.combatant-control.roll",
      ".combat-sidebar [data-combatant-id] button.combatant-control.roll",
      "#combat-tracker .combatant [data-action='rollInitiative']",
      "#combat .combatant [data-action='rollInitiative']",
      ".combat-sidebar .combatant [data-action='rollInitiative']",
      "#combat-tracker [data-combatant-id] [data-action='rollInitiative']",
      "#combat [data-combatant-id] [data-action='rollInitiative']",
      ".combat-sidebar [data-combatant-id] [data-action='rollInitiative']"
    ];

    const elements = new Set();
    for (const selector of selectors) {
      for (const el of scope.querySelectorAll(selector)) elements.add(el);
    }

    let changed = 0;
    for (const el of elements) {
      if (add2ePatchOneInitiativeElement(el)) changed++;
    }

    return changed;
  } catch (err) {
    console.warn(`${TAG}[D6_ICON][ERROR]`, err);
    return 0;
  }
}

function add2eInstallInitiativeHooks() {
  Hooks.on("updateCombatant", (combatant, changes, options, userId) => {
    if (options?.add2eInitiativeSort) return;
    if (!foundry.utils.hasProperty(changes ?? {}, "initiative")) return;

    console.log(`${TAG}[UPDATE_COMBATANT]`, {
      combatant: combatant?.name,
      initiative: changes.initiative,
      userId
    });

    add2eScheduleInitiativeSort(combatant.combat ?? game.combat);
  });

  Hooks.on("createCombatant", (combatant, options, userId) => {
    if (options?.add2eInitiativeSort) return;

    console.log(`${TAG}[CREATE_COMBATANT]`, {
      combatant: combatant?.name,
      initiative: combatant?.initiative,
      userId
    });

    add2eScheduleInitiativeSort(combatant.combat ?? game.combat);
  });

  Hooks.on("deleteCombatant", (combatant, options, userId) => {
    if (options?.add2eInitiativeSort) return;
    add2eScheduleInitiativeSort(combatant.combat ?? game.combat);
  });

  Hooks.on("renderCombatTracker", (app, html, data) => {
    add2ePatchCombatTrackerInitiativeIcons(html);
  });

  Hooks.on("renderCombatantConfig", () => {
    setTimeout(() => add2ePatchCombatTrackerInitiativeIcons(document), 50);
  });

  Hooks.on("renderSidebarTab", (app, html, data) => {
    if (app?.options?.id === "combat" || app?.tabName === "combat" || app?.id === "combat") {
      add2ePatchCombatTrackerInitiativeIcons(html);
      setTimeout(() => add2ePatchCombatTrackerInitiativeIcons(document), 50);
    }
  });

  console.log(`${TAG}[HOOKS_INSTALLED]`, { version: ADD2E_INITIATIVE_VERSION });
}

Hooks.once("init", add2eConfigureInitiative);
Hooks.once("ready", () => {
  add2eConfigureInitiative();
  add2eRemoveLegacyInitiativeHooks();
  add2eExposeInitiativeGlobals();
  add2ePatchCombatTrackerInitiativeIcons(document);
  setTimeout(() => add2ePatchCombatTrackerInitiativeIcons(document), 500);
  setTimeout(() => add2ePatchCombatTrackerInitiativeIcons(document), 1500);
});

add2eExposeInitiativeGlobals();
add2eInstallInitiativeHooks();
