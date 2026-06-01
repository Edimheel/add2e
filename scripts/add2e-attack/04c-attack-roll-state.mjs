// scripts/add2e-attack/04c-attack-roll-state.mjs
// ADD2E - Attaque 04c : helpers generiques d'etat et de contexte d'attaque.

export function add2eAttackReadStrictNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function add2eNormalizeAttackText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

export function add2eAttackReadFirstNumber(...values) {
  for (const v of values) {
    const n = add2eAttackReadStrictNumber(v);
    if (n !== null) return n;
  }
  return null;
}

export function add2eAttackIsEquipped(item) {
  const sysItem = item?.system ?? {};
  return sysItem.equipee === true || sysItem.equipped === true || sysItem.portee === true || sysItem.worn === true;
}

console.log("[ADD2E][ATTACK][04C][STATE_LOADED]");
