// scripts/add2e-attack.mjs
// ADD2E — Point d'entrée attaque / dégâts / sorts.
// Chargement défensif : une erreur dans un module ne doit pas empêcher
// le HUD / Argon / les fonctions déjà disponibles de s'initialiser.

console.log("ADD2E | add2e-attack modulaire : chargement sécurisé");

// Important pour le HUD : certains modules testent l'existence des fonctions
// pendant leur propre initialisation. On expose donc immédiatement des stubs,
// puis les vrais modules les remplacent dès qu'ils sont chargés.
if (typeof globalThis.add2eAttackRoll !== "function") {
  globalThis.add2eAttackRoll = async function add2eAttackRollPending(...args) {
    console.warn("[ADD2E][ATTACK][PENDING] add2eAttackRoll appelée avant chargement complet", args);
    ui.notifications?.warn?.("Le module d'attaque ADD2E est encore en cours de chargement. Recharge la scène si le problème persiste.");
    return false;
  };
}

if (typeof globalThis.add2eCastSpell !== "function") {
  globalThis.add2eCastSpell = async function add2eCastSpellPending(...args) {
    console.warn("[ADD2E][ATTACK][PENDING] add2eCastSpell appelée avant chargement complet", args);
    ui.notifications?.warn?.("Le module de sorts ADD2E est encore en cours de chargement. Recharge la scène si le problème persiste.");
    return false;
  };
}

if (typeof globalThis.cast_spell !== "function") globalThis.cast_spell = globalThis.add2eCastSpell;

async function add2eImportAttackModule(path, label) {
  try {
    await import(path);
    console.log(`[ADD2E][ATTACK][MODULE][OK] ${label}`);
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
      entries = Array.from(modules.values()).map(mod => [mod.id ?? mod.name ?? mod.key ?? "", mod]);
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
  } catch (err) {
    console.warn("[ADD2E][HUD][MODULE_DIAGNOSTIC_ERROR]", err);
    return [];
  }
}

function add2eInstallHudDiagnostics() {
  if (globalThis.ADD2E_HUD_DIAGNOSTICS_INSTALLED) return;
  globalThis.ADD2E_HUD_DIAGNOSTICS_INSTALLED = true;

  Hooks.once("ready", () => {
    console.log("[ADD2E][HUD][READY]", {
      system: game.system?.id,
      version: game.system?.version,
      attackRoll: typeof globalThis.add2eAttackRoll,
      castSpell: typeof globalThis.add2eCastSpell,
      cast_spell: typeof globalThis.cast_spell,
      attackVersion: globalThis.ADD2E_ATTACK_VERSION,
      attackRollSplitVersion: globalThis.ADD2E_ATTACK_ROLL_SPLIT_VERSION,
      hudModules: add2eHudDiagnosticsModules(),
      tokenLayerReady: !!canvas?.tokens
    });
  });

  Hooks.on("controlToken", (token, controlled) => {
    try {
      console.log("[ADD2E][HUD][CONTROL_TOKEN]", {
        controlled,
        token: token?.name,
        tokenId: token?.id,
        actor: token?.actor?.name,
        actorId: token?.actor?.id,
        actorType: token?.actor?.type,
        isOwner: token?.actor?.isOwner,
        selectedCount: canvas?.tokens?.controlled?.length ?? 0,
        attackRoll: typeof globalThis.add2eAttackRoll,
        castSpell: typeof globalThis.add2eCastSpell,
        hudModules: add2eHudDiagnosticsModules()
      });
    } catch (err) {
      console.warn("[ADD2E][HUD][CONTROL_TOKEN_DIAGNOSTIC_ERROR]", err);
    }
  });

  Hooks.on("renderTokenHUD", (app, html, data) => {
    try {
      console.log("[ADD2E][HUD][RENDER_TOKEN_HUD]", {
        token: app?.object?.name,
        tokenId: app?.object?.id,
        actor: app?.object?.actor?.name,
        data
      });
    } catch (err) {
      console.warn("[ADD2E][HUD][RENDER_TOKEN_HUD_DIAGNOSTIC_ERROR]", err);
    }
  });

  // Diagnostic manuel possible depuis la console : add2eHudCheck()
  globalThis.add2eHudCheck = function add2eHudCheck() {
    const controlled = canvas?.tokens?.controlled ?? [];
    const result = {
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
    console.log("[ADD2E][HUD][CHECK]", result);
    return result;
  };

  console.log("[ADD2E][HUD][DIAGNOSTICS_INSTALLED]");
}

add2eInstallHudDiagnostics();

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

  console.log("ADD2E | add2e-attack modulaire chargé", {
    version: globalThis.ADD2E_ATTACK_VERSION,
    attackRollSplitVersion: globalThis.ADD2E_ATTACK_ROLL_SPLIT_VERSION,
    hasAttackRoll: typeof globalThis.add2eAttackRoll === "function",
    hasCastSpell: typeof globalThis.add2eCastSpell === "function"
  });
})();
