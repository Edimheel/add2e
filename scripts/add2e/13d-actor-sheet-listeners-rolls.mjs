// ADD2E — Actor sheet listeners : évaluation de jet.

export const ADD2E_SHEET_ROLL_DELEGATION_VERSION = "2026-05-25-sheet-roll-cards-global-v2";

export async function add2eEvaluateRollSafe(formula) {
  const roll = new Roll(formula);
  await roll.evaluate();
  return roll;
}
