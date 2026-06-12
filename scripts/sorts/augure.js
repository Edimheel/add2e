/** ADD2E - augure - Clerc niveau 2 - mecanique partagee V13/V14/V15. */
try {
  const { runAdd2eSpell } = await import("/systems/add2e/scripts/sorts/add2e-spell-runner.mjs");
  return await runAdd2eSpell({ actor, item, sort, token, args, sourceItem, slug: "augure" });
} catch (error) {
  console.error("[ADD2E][ONUSE][augure]", error);
  ui.notifications?.error?.("augure : erreur de chargement du mecanisme onUse.");
  return false;
}
