// ADD2E — onUse Clerc niveau 3 : Guérison des maladies / Contamination — runner générique V13/V14/V15.
try {
  const api = await import("/systems/add2e/scripts/sorts/add2e-spell-runner.mjs");
  const result = await api.runAdd2eSpell({ actor, item, sort, token, args, sourceItem, slug: "guerison-des-maladies" });
  return result === true;
} catch (error) {
  console.error("[ADD2E][ONUSE][guerison-des-maladies]", error);
  ui.notifications?.error?.("Guérison des maladies : erreur de résolution.");
  return false;
}
