// scripts/add2e-initiative.mjs
// ADD2E — Initiative indépendante.
// Règle gérée ici : initiative simple au d6, ordre ascendant.
// Surprise volontairement non gérée dans ce module.

const ADD2E_INITIATIVE_VERSION = "2026-05-22-init-independent-v3-d6-icon";
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

function add2ePatchOneInitiativeControl(control) {
  if (!control || control.dataset?.add2eD6InitiativeIcon === "1") return false;

  const icon = control.querySelector?.("i.fa-dice-d20, i.fa-dice, i.fa-dice-six, i.fas, i.fa-solid");
  if (!icon) return false;

  const img = document.createElement("img");
  img.src = ADD2E_INITIATIVE_D6_ICON;
  img.alt = "D6";
  img.className = "add2e-init-d6-icon";
  img.style.width = "18px";
  img.style.height = "18px";
  img.style.objectFit = "contain";
  img.style.verticalAlign = "middle";
  img.style.border = "0";
  img.style.filter = "drop-shadow(0 0 1px rgba(0,0,0,.85))";

  icon.replaceWith(img);
  control.dataset.add2eD6InitiativeIcon = "1";
  control.title = control.title || "Lancer l'initiative ADD2E (1d6)";
  return true;
}

function add2ePatchCombatTrackerInitiativeIcons(root = document) {
  try {
    const scope = root?.jquery ? root[0] : root;
    if (!scope?.querySelectorAll) return 0;

    const selectors = [
      "#combat-tracker [data-control='rollInitiative']",
      "#combat-tracker [data-action='rollInitiative']",
      "#combat-tracker .combatant-control[data-control='rollInitiative']",
      "#combat-tracker .combatant-control[data-action='rollInitiative']",
      "#combat [data-control='rollInitiative']",
      "#combat [data-action='rollInitiative']",
      ".combat-sidebar [data-control='rollInitiative']",
      ".combat-sidebar [data-action='rollInitiative']"
    ];

    const controls = new Set();
    for (const selector of selectors) {
      for (const el of scope.querySelectorAll(selector)) controls.add(el);
    }

    let changed = 0;
    for (const control of controls) {
      if (add2ePatchOneInitiativeControl(control)) changed++;
    }

    if (changed) {
      console.log(`${TAG}[D6_ICON]`, {
        version: ADD2E_INITIATIVE_VERSION,
        changed,
        icon: ADD2E_INITIATIVE_D6_ICON
      });
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

  console.log(`${TAG}[HOOKS_INSTALLED]`, { version: ADD2E_INITIATIVE_VERSION });
}

Hooks.once("init", add2eConfigureInitiative);
Hooks.once("ready", () => {
  add2eConfigureInitiative();
  add2eRemoveLegacyInitiativeHooks();
  add2eExposeInitiativeGlobals();
  add2ePatchCombatTrackerInitiativeIcons(document);
  setTimeout(() => add2ePatchCombatTrackerInitiativeIcons(document), 500);
});

add2eExposeInitiativeGlobals();
add2eInstallInitiativeHooks();
