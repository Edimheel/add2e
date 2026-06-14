// ADD2E — onUse Clerc niveau 3 : Prière — runner générique V13/V14/V15.
try {
  const api = await import("/systems/add2e/scripts/sorts/add2e-spell-runner.mjs");
  const result = await api.runAdd2eSpell({ actor, item, sort, token, args, sourceItem, slug: "priere" });
  return result === true;
} catch (error) {
  console.error("[ADD2E][ONUSE][priere]", error);
  ui.notifications?.error?.("Prière : erreur de résolution.");
  return false;
}
