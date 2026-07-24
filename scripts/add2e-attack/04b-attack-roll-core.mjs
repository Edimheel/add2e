// scripts/add2e-attack/04b-attack-roll-core.mjs
// ADD2E — Point d'entrée du combat normal.
// Les portes d'action des ActiveEffects sont installées hors du combat,
// par le façage effects-engine.mjs après le chargement des modules.
// Les VFX d'armes sont intégrés uniquement par 05-jb2a-vfx.mjs.

import { add2eAttackRoll as add2eAttackRollBase } from "./04-attack-roll.mjs";

export const ADD2E_ATTACK_ROLL_CORE_VERSION = "2026-07-24-normal-combat-single-jb2a-owner-v2";

globalThis.ADD2E_ATTACK_ROLL_SPLIT_VERSION = ADD2E_ATTACK_ROLL_CORE_VERSION;
globalThis.add2eAttackRoll = add2eAttackRollBase;

export { add2eAttackRollBase as add2eAttackRoll };
