/** ADD2E - Localisation d'objets - onUse generique V13/V14/V15. */
try {
  const { runAdd2eSpell } = await import("/systems/add2e/scripts/sorts/add2e-spell-runner.mjs");
  return await runAdd2eSpell({ actor, item, sort, token, args, sourceItem, slug: "localisation-dobjets" });
} catch (error) {
  console.error("[ADD2E][ONUSE][localisation-dobjets]", error);
  ui.notifications?.error?.("Localisation d'objets : erreur de chargement du mécanisme onUse.");
  return false;
}
