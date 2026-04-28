// ============================================================================
// ADD2E — Gestion automatique de l’expiration des effets temporaires
// - Gère les effets à durée en rounds
// - Fonctionne pour les sorts lancés en combat ET hors combat
//   (si lancé hors combat : startRound est initialisé au premier round rencontré)
// - Ne touche pas aux effets permanents ou sans "rounds"
// ============================================================================

Hooks.on("updateCombat", async (combat, changed, options, userId) => {
  // On ne réagit que quand le round ou le tour change
  if (!("round" in changed) && !("turn" in changed)) return;

  const currentRound = combat.round ?? 0;
  console.log("[ADD2E][AUTO-REMOVE] updateCombat déclenché :", { round: currentRound, changed });

  try {
    const combatants = combat.combatants || [];
    console.log("[ADD2E][AUTO-REMOVE] combatants =", combatants);

    for (const combatant of combatants) {
      if (!combatant) {
        console.warn("[ADD2E][AUTO-REMOVE] combatant null/undefined, ignoré.");
        continue;
      }

      const actor = combatant.actor;
      if (!actor) {
        console.warn("[ADD2E][AUTO-REMOVE] combatant sans actor :", combatant);
        continue;
      }

      console.log(`[ADD2E][AUTO-REMOVE] Acteur: ${actor.name}`);

      const toDelete = [];

      for (const effect of actor.effects) {
        if (!effect) continue;

        const dur = effect.duration || {};
        console.log(
          `[ADD2E][AUTO-REMOVE]  Effet "${effect.name}" duration =`,
          dur
        );

        // Effet désactivé → ignoré
        if (effect.disabled) {
          console.log('   -> ignoré : effect.disabled = true');
          continue;
        }

        // Pas de durée en rounds → effet permanent ou spécial → on ignore
        if (typeof dur.rounds !== "number" || isNaN(dur.rounds)) {
          console.log('   -> ignoré : pas de "rounds" numérique');
          continue;
        }

        const totalRounds = dur.rounds;

        // GESTION HORS COMBAT :
        // Si startRound est absent / null / NaN, on l'initialise AU MOMENT où on voit
        // l'effet pour la première fois dans un combat.
        let startRound = dur.startRound;
        if (typeof startRound !== "number" || isNaN(startRound)) {
          console.log(
            `   -> startRound absent pour "${effect.name}", initialisation à currentRound (${currentRound})`
          );
          await effect.update({ "duration.startRound": currentRound });
          startRound = currentRound;
        }

        const elapsed = Math.max(0, currentRound - startRound);
        const remaining = totalRounds - elapsed;

        console.log(
          `[ADD2E][AUTO-REMOVE]    Calcul "${effect.name}" -> total=${totalRounds}, startRound=${startRound}, elapsed=${elapsed}, remaining=${remaining}`
        );

        if (remaining <= 0) {
          console.log(
            `[ADD2E][AUTO-REMOVE]    -> marqué pour suppression : "${effect.name}" (id=${effect.id})`
          );
          toDelete.push(effect.id);
        }
      }

      if (toDelete.length) {
        console.log(
          `[ADD2E][AUTO-REMOVE] Suppression auto des effets expirés sur ${actor.name} :`,
          toDelete
        );
        await actor.deleteEmbeddedDocuments("ActiveEffect", toDelete);
      }
    }
  } catch (err) {
    console.error("[ADD2E][AUTO-REMOVE] ERREUR dans updateCombat(auto-remove-effects) :", err);
  }
});
