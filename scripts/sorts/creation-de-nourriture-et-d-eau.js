/** ADD2E - Manne - onUse generique V13/V14/V15. */
try {
  const { runAdd2eSpell } = await import("/systems/add2e/scripts/sorts/add2e-spell-runner.mjs");
  return await runAdd2eSpell({ actor, item, sort, token, args, sourceItem, slug: "creation-de-nourriture-et-d-eau" });
} catch (error) {
  console.error("[ADD2E][ONUSE][creation-de-nourriture-et-d-eau]", error);
  ui.notifications?.error?.("Manne : erreur de chargement du mécanisme onUse.");
  return false;
}
