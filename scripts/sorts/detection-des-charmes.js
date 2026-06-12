/** ADD2E - detection-des-charmes - Clerc niveau 2 - mecanique partagee V13/V14/V15. */
try {
  const { runAdd2eSpell } = await import("/systems/add2e/scripts/sorts/add2e-spell-runner.mjs");
  return await runAdd2eSpell({ actor, item, sort, token, args, sourceItem, slug: "detection-des-charmes" });
} catch (error) {
  console.error("[ADD2E][ONUSE][detection-des-charmes]", error);
  ui.notifications?.error?.("detection-des-charmes : erreur de chargement du mecanisme onUse.");
  return false;
}
