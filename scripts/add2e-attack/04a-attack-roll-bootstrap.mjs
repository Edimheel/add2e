// scripts/add2e-attack/04a-attack-roll-bootstrap.mjs
// ADD2E - Attaque 04a : initialisation du groupe de modules d'attaque.
// Aucun calcul metier ici : ce fichier sert de point de passage avant 04b+.

export const ADD2E_ATTACK_ROLL_SPLIT_VERSION = "2026-05-23-attack-roll-split-v2-silent-stale-ca";

globalThis.ADD2E_ATTACK_ROLL_SPLIT_VERSION = ADD2E_ATTACK_ROLL_SPLIT_VERSION;

function add2eInstallAttackConsoleNoiseFilter() {
  if (globalThis.ADD2E_ATTACK_CONSOLE_NOISE_FILTER_INSTALLED) return;
  const originalWarn = console.warn.bind(console);

  console.warn = (...args) => {
    const first = String(args?.[0] ?? "");
    if (first.includes("[ADD2E][ATTAQUE][CA][TOKEN_STORED_CA_STALE]")) return;
    return originalWarn(...args);
  };

  globalThis.ADD2E_ATTACK_CONSOLE_NOISE_FILTER_INSTALLED = true;
}

add2eInstallAttackConsoleNoiseFilter();

console.log("[ADD2E][ATTACK][04A][BOOTSTRAP_LOADED]", ADD2E_ATTACK_ROLL_SPLIT_VERSION);
