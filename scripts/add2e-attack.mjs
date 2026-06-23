// scripts/add2e-attack.mjs
// ADD2E — Point d'entrée attaque / dégâts / sorts.
// Chargement défensif : une erreur dans un module ne doit pas empêcher
// le HUD / Argon / les fonctions déjà disponibles de s'initialiser.

// Important pour le HUD : certains modules testent l'existence des fonctions
// pendant leur propre initialisation. On expose donc immédiatement des stubs,
// puis les vrais modules les remplacent dès qu'ils sont chargés.
if (typeof globalThis.add2eAttackRoll !== "function") {
  globalThis.add2eAttackRoll = async function add2eAttackRollPending(..._args) {
    ui.notifications?.warn?.("Le module d'attaque ADD2E est encore en cours de chargement. Recharge la scène si le problème persiste.");
    return false;
  };
}

if (typeof globalThis.add2eCastSpell !== "function") {
  globalThis.add2eCastSpell = async function add2eCastSpellPending(..._args) {
    ui.notifications?.warn?.("Le module de sorts ADD2E est encore en cours de chargement. Recharge la scène si le problème persiste.");
    return false;
  };
}

if (typeof globalThis.cast_spell !== "function") globalThis.cast_spell = globalThis.add2eCastSpell;

async function add2eImportAttackModule(path, label) {
  try {
    await import(path);
    return true;
  } catch (err) {
    console.error(`[ADD2E][ATTACK][MODULE][ERROR] ${label}`, err);
    return false;
  }
}

function add2eHudDiagnosticsModules() {
  try {
    const modules = game?.modules;
    let entries = [];

    if (modules?.contents && Array.isArray(modules.contents)) {
      entries = modules.contents.map(mod => [mod.id ?? mod.name ?? mod.key ?? "", mod]);
    } else if (typeof modules?.entries === "function") {
      entries = Array.from(modules.entries());
    } else if (typeof modules?.values === "function") {
      entries = Array.from(modules.values()).map(mod => [mod.id ?? mod.name ?? "", mod]);
    } else if (modules && typeof modules === "object") {
      entries = Object.entries(modules);
    }

    return entries
      .map(entry => Array.isArray(entry) ? entry : [entry?.id ?? entry?.name ?? "", entry])
      .filter(([id, mod]) => {
        const text = `${id} ${mod?.title ?? mod?.name ?? ""}`.toLowerCase();
        return text.includes("hud") || text.includes("argon") || text.includes("combat");
      })
      .map(([id, mod]) => ({ id, title: mod?.title ?? mod?.name ?? id, active: mod?.active }));
  } catch (_err) {
    return [];
  }
}

function add2eInstallHudDiagnostics() {
  if (globalThis.ADD2E_HUD_DIAGNOSTICS_INSTALLED) return;
  globalThis.ADD2E_HUD_DIAGNOSTICS_INSTALLED = true;

  // Diagnostic manuel possible depuis la console : add2eHudCheck()
  globalThis.add2eHudCheck = function add2eHudCheck() {
    const controlled = canvas?.tokens?.controlled ?? [];
    return {
      system: game.system?.id,
      version: game.system?.version,
      attackRoll: typeof globalThis.add2eAttackRoll,
      castSpell: typeof globalThis.add2eCastSpell,
      cast_spell: typeof globalThis.cast_spell,
      attackVersion: globalThis.ADD2E_ATTACK_VERSION,
      attackRollSplitVersion: globalThis.ADD2E_ATTACK_ROLL_SPLIT_VERSION,
      controlled: controlled.map(t => ({ token: t.name, id: t.id, actor: t.actor?.name, actorType: t.actor?.type })),
      hudModules: add2eHudDiagnosticsModules(),
      tokenHudApp: ui?.token?.constructor?.name ?? null,
      tokenHudRendered: ui?.token?.rendered ?? null,
      tokenHudObject: ui?.token?.object?.name ?? null,
      documentScriptsAdd2e: Array.from(document.scripts).map(s => s.src).filter(s => s.includes("add2e"))
    };
  };
}

function add2eComponentTransactionStore() {
  if (!(globalThis.__ADD2E_COMPONENT_TRANSACTION_STORE_V1 instanceof Map)) {
    globalThis.__ADD2E_COMPONENT_TRANSACTION_STORE_V1 = new Map();
  }
  return globalThis.__ADD2E_COMPONENT_TRANSACTION_STORE_V1;
}

function add2eComponentSortKeys(sort) {
  const flags = sort?.flags?.add2e ?? {};
  return [sort?.id, sort?._id, sort?.uuid, sort?._stats?.compendiumSource, flags.sourceUuid, flags.sourceId, flags.importKey]
    .map(value => String(value ?? "").trim())
    .filter(Boolean);
}

function add2eRememberComponentTransaction(actor, sort, reservation) {
  if (!reservation?.ok || !reservation?.consumed?.length || !actor?.id) return;
  const id = foundry.utils.randomID();
  add2eComponentTransactionStore().set(id, {
    id,
    actorId: String(actor.id),
    sortKeys: add2eComponentSortKeys(sort),
    reservation
  });
}

function add2eForgetComponentTransaction(reservation) {
  if (!reservation) return;
  const store = add2eComponentTransactionStore();
  for (const [id, entry] of store) {
    if (entry.reservation === reservation) store.delete(id);
  }
}

function add2eTakeComponentTransaction(actor, sort) {
  const actorId = String(actor?.id ?? "");
  if (!actorId) return null;
  const requestedKeys = new Set(add2eComponentSortKeys(sort));
  const entries = Array.from(add2eComponentTransactionStore().entries())
    .filter(([, entry]) => entry.actorId === actorId);
  if (!entries.length) return null;

  let selected = entries.find(([, entry]) => entry.sortKeys.some(key => requestedKeys.has(key))) ?? null;
  if (!selected && entries.length === 1) selected = entries[0];
  if (!selected) return null;

  add2eComponentTransactionStore().delete(selected[0]);
  return selected[1].reservation;
}

function add2eInstallSpellComponentTransactionBridge() {
  if (globalThis.__ADD2E_COMPONENT_TRANSACTION_BRIDGE_V1) return true;
  const api = globalThis.ADD2E_CONSUMABLES;
  const castSpell = globalThis.add2eCastSpell;
  if (!api?.add2eReserveSpellComponents || !api?.add2eRefundSpellComponents || !api?.add2eFinalizeSpellComponents || typeof castSpell !== "function") return false;

  globalThis.__ADD2E_COMPONENT_TRANSACTION_BRIDGE_V1 = true;
  const reserve = api.add2eReserveSpellComponents.bind(api);
  const refund = api.add2eRefundSpellComponents.bind(api);

  api.add2eReserveSpellComponents = async function add2eReserveSpellComponentsTracked(actor, sort) {
    const reservation = await reserve(actor, sort);
    add2eRememberComponentTransaction(actor, sort, reservation);
    return reservation;
  };

  api.add2eRefundSpellComponents = async function add2eRefundSpellComponentsTracked(reservation) {
    const refunded = await refund(reservation);
    if (refunded) add2eForgetComponentTransaction(reservation);
    return refunded;
  };

  const transactionalCastSpell = async function add2eCastSpellTransactional(args = {}) {
    const result = await castSpell(args);
    if (result !== true) return result;

    const reservation = add2eTakeComponentTransaction(args.actor, args.sort);
    if (!reservation) return result;

    const finalized = await api.add2eFinalizeSpellComponents(reservation);
    if (!finalized) {
      console.error("[ADD2E][CAST_SPELL][FINALIZE][COMPONENTS_FAILED]", { actor: args.actor?.name, sort: args.sort?.name, reservation });
      ui.notifications.error("Le sort a été lancé, mais la suppression des composants épuisés doit être vérifiée par le MJ.");
    }
    return result;
  };

  globalThis.add2eCastSpell = transactionalCastSpell;
  globalThis.cast_spell = transactionalCastSpell;
  return true;
}

function add2eScheduleSpellComponentTransactionBridge() {
  let attempts = 0;
  const install = () => {
    if (add2eInstallSpellComponentTransactionBridge()) return;
    attempts += 1;
    if (attempts < 20) window.setTimeout(install, 50);
  };
  install();
}

add2eInstallHudDiagnostics();

Hooks.once("ready", () => add2eScheduleSpellComponentTransactionBridge());

(async () => {
  // Ordre important : helpers / dégâts / règles / VFX / sorts d'abord,
  // puis résolution d'attaque. Ainsi le HUD peut récupérer les fonctions
  // principales même si un module secondaire échoue.
  await add2eImportAttackModule("./add2e-attack/01-core-helpers.mjs", "01-core-helpers");
  await add2eImportAttackModule("./add2e-attack/02-damage.mjs", "02-damage");
  await add2eImportAttackModule("./add2e-attack/03-attack-rules.mjs", "03-attack-rules");
  await add2eImportAttackModule("./add2e-attack/05-jb2a-vfx.mjs", "05-jb2a-vfx");
  await add2eImportAttackModule("./add2e-attack/06-cast-spell.mjs", "06-cast-spell");
  await add2eImportAttackModule("./add2e-attack/04a-attack-roll-bootstrap.mjs", "04a-attack-roll-bootstrap");
  await add2eImportAttackModule("./add2e-attack/04c-attack-roll-state.mjs", "04c-attack-roll-state");
  await add2eImportAttackModule("./add2e-attack/04d-attack-roll-defense.mjs", "04d-attack-roll-defense");
  await add2eImportAttackModule("./add2e-attack/04e-attack-roll-modifiers.mjs", "04e-attack-roll-modifiers");
  await add2eImportAttackModule("./add2e-attack/04b-attack-roll-core.mjs", "04b-attack-roll-core");
})();