/** ADD2E - ralentissement-du-poison - Clerc niveau 2 - mecanique partagee V13/V14/V15. */
try {
  const { runAdd2eSpell } = await import("/systems/add2e/scripts/sorts/add2e-spell-runner.mjs");
  return await runAdd2eSpell({ actor, item, sort, token, args, sourceItem, slug: "ralentissement-du-poison" });
} catch (error) {
  console.error("[ADD2E][ONUSE][ralentissement-du-poison]", error);
  ui.notifications?.error?.("ralentissement-du-poison : erreur de chargement du mecanisme onUse.");
  return false;
}
