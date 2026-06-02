// OnUse ADD2E genere automatiquement pour Piège à feu
// Compatible Foundry V13/V14/V15.
// Retour attendu: true = sort consomme, false = sort non consomme.

try {
  const sortName = item?.name ?? "Piège à feu";
  const actorName = actor?.name ?? token?.actor?.name ?? "acteur";
  const message = "<p><strong>" + sortName + "</strong></p><p>" + actorName + " lance le sort. Les effets precis restent a appliquer selon le Manuel des joueurs AD&D 2e.</p>";
  if (globalThis.ChatMessage?.create) {
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker ? ChatMessage.getSpeaker({ actor }) : undefined,
      content: message
    });
  }
  globalThis.ui?.notifications?.info?.(sortName + " lance.");
  return true;
} catch (error) {
  console.error("[ADD2E][SORT][ONUSE_AUTO]", error);
  globalThis.ui?.notifications?.error?.("Erreur lors de l'execution du sort.");
  return false;
}
