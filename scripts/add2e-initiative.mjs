// scripts/add2e-initiative.mjs
// ADD2E — Initiative indépendante.
// Règle gérée ici : initiative simple au d6, ordre ascendant.
// Surprise volontairement non gérée dans ce module.

const ADD2E_INITIATIVE_VERSION = "2026-05-22-init-independent-v1";
const TAG = "[ADD2E][INIT]";

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

  console.log(`${TAG}[HOOKS_INSTALLED]`, { version: ADD2E_INITIATIVE_VERSION });
}

Hooks.once("init", add2eConfigureInitiative);
Hooks.once("ready", () => {
  add2eConfigureInitiative();
  add2eRemoveLegacyInitiativeHooks();
});

add2eInstallInitiativeHooks();

globalThis.add2eConfigureInitiative = add2eConfigureInitiative;
globalThis.add2eSortInitiativeAscending = add2eSortInitiativeAscending;
globalThis.add2eScheduleInitiativeSort = add2eScheduleInitiativeSort;
// Compatibilité console avec l'ancien nom, sans garder l'ancien code.
globalThis.triInitiativeAscendant = add2eSortInitiativeAscending;
