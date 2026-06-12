/** ADD2E - detection-des-pieges - Clerc niveau 2 - mecanique partagee V13/V14/V15. */
try {
  const api = await import("/systems/add2e/scripts/sorts/clerc-niveau-2-mechanics.mjs");
  const result = await api.runClericLevel2Spell({ actor, item, sort, token, args, sourceItem }, "detection-des-pieges");
  return result === true;
} catch (error) {
  console.error("[ADD2E][ONUSE][detection-des-pieges]", error);
  ui.notifications?.error?.("detection-des-pieges : erreur de chargement du mecanisme onUse.");
  return false;
}
