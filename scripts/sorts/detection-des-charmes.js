/** ADD2E - detection-des-charmes - Clerc niveau 2 - mecanique partagee V13/V14/V15. */
try {
  const api = await import("/systems/add2e/scripts/sorts/add2e-cleric-spell-runners.mjs");
  const result = await api.runClericSpell({ actor, item, sort, token, args, sourceItem }, "detection-des-charmes");
  return result === true;
} catch (error) {
  console.error("[ADD2E][ONUSE][detection-des-charmes]", error);
  ui.notifications?.error?.("detection-des-charmes : erreur de chargement du mecanisme onUse.");
  return false;
}
