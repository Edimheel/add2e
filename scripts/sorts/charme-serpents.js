/** ADD2E - charme-serpents - Clerc niveau 2 - mecanique partagee V13/V14/V15. */
try {
  const api = await import("/systems/add2e/scripts/sorts/add2e-spell-mechanics.mjs");
  const result = await api.runSpellMechanic({ actor, item, sort, token, args, sourceItem }, "charme-serpents");
  return result === true;
} catch (error) {
  console.error("[ADD2E][ONUSE][charme-serpents]", error);
  ui.notifications?.error?.("charme-serpents : erreur de chargement du mecanisme onUse.");
  return false;
}
