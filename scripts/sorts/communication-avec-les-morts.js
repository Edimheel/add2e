/** ADD2E - Nécromancie - onUse generique V13/V14/V15. */
try {
  const { runAdd2eSpell } = await import("/systems/add2e/scripts/sorts/add2e-spell-runner.mjs");
  return await runAdd2eSpell({ actor, item, sort, token, args, sourceItem, slug: "communication-avec-les-morts" });
} catch (error) {
  console.error("[ADD2E][ONUSE][communication-avec-les-morts]", error);
  ui.notifications?.error?.("Nécromancie : erreur de chargement du mécanisme onUse.");
  return false;
}
