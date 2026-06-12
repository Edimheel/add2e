/** ADD2E - resistance-au-feu - Clerc niveau 2 - mecanique partagee V13/V14/V15. */
try {
  const api = await import("/systems/add2e/scripts/sorts/clerc-niveau-2-mechanics.mjs");
  const result = await api.runClericLevel2Spell({ actor, item, sort, token, args, sourceItem }, "resistance-au-feu");
  return result === true;
} catch (error) {
  console.error("[ADD2E][ONUSE][resistance-au-feu]", error);
  ui.notifications?.error?.("resistance-au-feu : erreur de chargement du mecanisme onUse.");
  return false;
}
