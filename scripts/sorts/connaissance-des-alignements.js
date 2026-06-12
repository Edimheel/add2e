/** ADD2E - connaissance-des-alignements - Clerc niveau 2 - mecanique partagee V13/V14/V15. */
try {
  const api = await import("/systems/add2e/scripts/sorts/add2e-cleric-spell-runners.mjs");
  const result = await api.runClericSpell({ actor, item, sort, token, args, sourceItem }, "connaissance-des-alignements");
  return result === true;
} catch (error) {
  console.error("[ADD2E][ONUSE][connaissance-des-alignements]", error);
  ui.notifications?.error?.("connaissance-des-alignements : erreur de chargement du mecanisme onUse.");
  return false;
}
