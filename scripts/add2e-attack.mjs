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

(async () => {
  // Ordre important : helpers / dégâts / règles / VFX / sorts d'abord,
  // puis résolution d'attaque. Ainsi le HUD peut récupérer les fonctions
  // principales même si un module secondaire échoue.
  await add2eImportAttackModule("./add2e-attack/01-core-helpers.mjs", "01-core-helpers");
  await add2eImportAttackModule("./add2e-attack/02-damage.mjs", "02-damage");
  await add2eImportAttackModule("./add2e-attack/03-attack-rules.mjs", "03-attack-rules");
  await add2eImportAttackModule("./add2e-attack/05-jb2a-vfx.mjs", "05-jb2a-vfx");
  await add2eImportAttackModule("./add2e-attack/06-cast-spell.mjs", "06-cast-spell");
  await add2eImportAttackModule("./add2e-attack/04-attack-roll.mjs", "04-attack-roll");

  console.log("ADD2E | add2e-attack modulaire chargé", {
    version: globalThis.ADD2E_ATTACK_VERSION,
    hasAttackRoll: typeof globalThis.add2eAttackRoll === "function",
    hasCastSpell: typeof globalThis.add2eCastSpell === "function"
  });
})();
