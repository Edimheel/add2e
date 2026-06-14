/** ADD2E - silence-rayon-de-15-pieds - Clerc niveau 2 - mecanique partagee V13/V14/V15. */
try {
  const { runAdd2eSpell } = await import("/systems/add2e/scripts/sorts/add2e-spell-runner.mjs");
  return await runAdd2eSpell({ actor, item, sort, token, args, sourceItem, slug: "silence-rayon-de-15-pieds" });
} catch (error) {
  console.error("[ADD2E][ONUSE][silence-rayon-de-15-pieds]", error);
  ui.notifications?.error?.("silence-rayon-de-15-pieds : erreur de chargement du mecanisme onUse.");
  return false;
}
