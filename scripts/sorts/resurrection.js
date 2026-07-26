// ADD2E — Résurrection : résolution canonique de résurrection.
// Compatible Foundry V13/V14/V15. Aucun Dialog historique.

const targets = Array.from(game.user?.targets ?? []);
if (targets.length !== 1) {
  ui.notifications.warn("Résurrection : cible unique obligatoire.");
  return false;
}

const targetActor = targets[0]?.actor ?? null;
if (!targetActor) {
  ui.notifications.warn("Résurrection : acteur cible introuvable.");
  return false;
}
if (typeof globalThis.add2eAttemptResurrection !== "function") {
  throw new Error("Le résolveur canonique de résurrection ADD2E est indisponible.");
}

const sourceToken = token ?? args?.[0]?.token ?? canvas?.tokens?.controlled?.[0] ?? null;
const result = await globalThis.add2eAttemptResurrection({
  targetActor,
  casterActor: actor ?? sourceToken?.actor ?? null,
  sourceItem: item ?? null,
  sourceToken,
  source: "spell:resurrection"
});

if (!result?.attempted) {
  const messages = {
    "target-not-dead": "La cible n’est pas morte.",
    "permanent-death": "La cible a définitivement échoué à un test de survie à la résurrection.",
    "resurrection-limit": "La cible a atteint sa limite de résurrections.",
    "target-missing": "La cible est introuvable."
  };
  ui.notifications.warn(`Résurrection : ${messages[result?.reason] ?? "la tentative est impossible."}`);
  return false;
}

return result.consumed !== false;
