/** ADD2E - langage-des-animaux - Clerc niveau 2 - mecanique partagee V13/V14/V15. */
try {
  const { runAdd2eSpell } = await import("/systems/add2e/scripts/sorts/add2e-spell-runner.mjs");
  return await runAdd2eSpell({ actor, item, sort, token, args, sourceItem, slug: "langage-des-animaux" });
} catch (error) {
  console.error("[ADD2E][ONUSE][langage-des-animaux]", error);
  ui.notifications?.error?.("langage-des-animaux : erreur de chargement du mecanisme onUse.");
  return false;
}
