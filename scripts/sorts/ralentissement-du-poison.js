/** ADD2E - ralentissement-du-poison - Clerc niveau 2 - mecanique partagee V13/V14/V15. */
try {
  const api = await import("/systems/add2e/scripts/sorts/add2e-cleric-spell-runners.mjs");
  const result = await api.runClericSpell({ actor, item, sort, token, args, sourceItem }, "ralentissement-du-poison");
  return result === true;
} catch (error) {
  console.error("[ADD2E][ONUSE][ralentissement-du-poison]", error);
  ui.notifications?.error?.("ralentissement-du-poison : erreur de chargement du mecanisme onUse.");
  return false;
}
