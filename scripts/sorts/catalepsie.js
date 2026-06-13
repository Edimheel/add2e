// ADD2E — onUse Clerc niveau 3 : Catalepsie — runner générique V13/V14/V15.
try {
  const api = await import("/systems/add2e/scripts/sorts/add2e-spell-runner.mjs");
  const result = await api.runAdd2eSpell({ actor, item, sort, token, args, sourceItem, slug: "catalepsie" });
  return result === true;
} catch (error) {
  console.error("[ADD2E][ONUSE][catalepsie]", error);
  ui.notifications?.error?.("Catalepsie : erreur de résolution.");
  return false;
}
