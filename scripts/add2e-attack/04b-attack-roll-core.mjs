// scripts/add2e-attack/04b-attack-roll-core.mjs
// ADD2E — Point d'entrée du combat normal.
// Les portes d'action des ActiveEffects sont installées hors du combat,
// par le façage effects-engine.mjs après le chargement des modules.

import { add2eAttackRoll } from "./04-attack-roll.mjs";

export const ADD2E_ATTACK_ROLL_CORE_VERSION = "2026-06-30-normal-combat-entry-v2";

export { add2eAttackRoll };

globalThis.ADD2E_ATTACK_ROLL_SPLIT_VERSION = ADD2E_ATTACK_ROLL_CORE_VERSION;
