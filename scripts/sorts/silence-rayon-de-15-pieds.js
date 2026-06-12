/** ADD2E - silence-rayon-de-15-pieds - Clerc niveau 2 - mecanique partagee V13/V14/V15. */
try {
  const api = await import("/systems/add2e/scripts/sorts/add2e-cleric-spell-runners.mjs");
  const result = await api.runClericSpell({ actor, item, sort, token, args, sourceItem }, "silence-rayon-de-15-pieds");
  return result === true;
} catch (error) {
  console.error("[ADD2E][ONUSE][silence-rayon-de-15-pieds]", error);
  ui.notifications?.error?.("silence-rayon-de-15-pieds : erreur de chargement du mecanisme onUse.");
  return false;
}
