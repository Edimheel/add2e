// ADD2E - onUse Clerc niveau 3 : Guerison de la cecite - runner generique V13/V14/V15.
try {
  const api = await import("/systems/add2e/scripts/sorts/add2e-spell-runner.mjs");
  const result = await api.runAdd2eSpell({ actor, item, sort, token, args, sourceItem, slug: "guerison-de-la-cecite-ou-de-la-surdite" });
  return result === true;
} catch (error) {
  console.error("[ADD2E][ONUSE][guerison-de-la-cecite-ou-de-la-surdite]", error);
  ui.notifications?.error?.("Guerison de la cecite : erreur de resolution.");
  return false;
}
