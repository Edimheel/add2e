/** ADD2E - langage-des-animaux - Clerc niveau 2 - mecanique partagee V13/V14/V15. */
try {
  const api = await import("/systems/add2e/scripts/sorts/clerc-niveau-2-mechanics.mjs");
  const result = await api.runClericLevel2Spell({ actor, item, sort, token, args, sourceItem }, "langage-des-animaux");
  return result === true;
} catch (error) {
  console.error("[ADD2E][ONUSE][langage-des-animaux]", error);
  ui.notifications?.error?.("langage-des-animaux : erreur de chargement du mecanisme onUse.");
  return false;
}
