// scripts/add2e-attack/04a-attack-roll-bootstrap.mjs
// ADD2E - Attaque 04a : initialisation du groupe de modules d'attaque.
// Aucun calcul métier ici : ce fichier sert de point de passage avant 04b+.

export const ADD2E_ATTACK_ROLL_SPLIT_VERSION = "2026-05-23-attack-roll-split-v4-silent-known-v1-sheet-warnings";

globalThis.ADD2E_ATTACK_ROLL_SPLIT_VERSION = ADD2E_ATTACK_ROLL_SPLIT_VERSION;

function add2eInstallAppV1ActorSheetAlias() {
  if (globalThis.ADD2E_APPV1_ACTORSHEET_ALIAS_INSTALLED) return;

  const ActorSheetV1 = foundry?.appv1?.sheets?.ActorSheet;
  if (!ActorSheetV1) return;

  try {
    Object.defineProperty(globalThis, "ActorSheet", {
      value: ActorSheetV1,
      configurable: true,
      writable: true
    });
    globalThis.ADD2E_APPV1_ACTORSHEET_ALIAS_INSTALLED = true;
  } catch (err) {
    console.warn("[ADD2E][APPV1_ALIAS][ACTORSHEET_FAILED]", err);
  }
}

function add2eInstallAttackConsoleNoiseFilter() {
  if (globalThis.ADD2E_ATTACK_CONSOLE_NOISE_FILTER_INSTALLED) return;
  const originalWarn = console.warn.bind(console);

  console.warn = (...args) => {
    const first = String(args?.[0] ?? "");
    const stack = String(args?.[0]?.stack ?? args?.[1]?.stack ?? "");
    const text = `${first}\n${stack}`;

    if (text.includes("[ADD2E][ATTAQUE][CA][TOKEN_STORED_CA_STALE]")) return;
    if (text.includes('You are accessing the global "ActorSheet"')) return;
    if (text.includes("The V1 Application framework is deprecated") && text.includes("Add2eActorSheet")) return;

    return originalWarn(...args);
  };

  globalThis.ADD2E_ATTACK_CONSOLE_NOISE_FILTER_INSTALLED = true;
}

add2eInstallAppV1ActorSheetAlias();
add2eInstallAttackConsoleNoiseFilter();
