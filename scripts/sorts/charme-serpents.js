/** ADD2E - charme-serpents - Clerc niveau 2 - mecanique partagee V13/V14/V15. */
try {
  const { runAdd2eSpell } = await import("/systems/add2e/scripts/sorts/add2e-spell-runner.mjs");
  return await runAdd2eSpell({ actor, item, sort, token, args, sourceItem, slug: "charme-serpents" });
} catch (error) {
  console.error("[ADD2E][ONUSE][charme-serpents]", error);
  ui.notifications?.error?.("charme-serpents : erreur de chargement du mecanisme onUse.");
  return false;
}
