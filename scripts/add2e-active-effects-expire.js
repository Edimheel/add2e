// ============================================================================
// ADD2E — Gestion automatique de l’expiration des effets temporaires
// Version : 2026-05-21-safe-delete-existing-script-v1
// - Gère les effets à durée en rounds
// - Fonctionne pour les sorts lancés en combat ET hors combat
//   si lancé hors combat : startRound est initialisé au premier round rencontré
// - Ne touche pas aux effets permanents ou sans "rounds"
// - Suppression robuste : ignore les ActiveEffect déjà supprimés par un autre flux
// ============================================================================

globalThis.ADD2E_ACTIVE_EFFECTS_EXPIRE_VERSION = "2026-05-21-safe-delete-existing-script-v1";
console.log("[ADD2E][AUTO-REMOVE][VERSION]", globalThis.ADD2E_ACTIVE_EFFECTS_EXPIRE_VERSION);

Hooks.on("updateCombat", async (combat, changed, options, userId) => {
  if (!("round" in changed) && !("turn" in changed)) return;

  const currentRound = combat.round ?? 0;
  console.log("[ADD2E][AUTO-REMOVE] updateCombat déclenché :", { round: currentRound, changed });

  try {
    const combatants = combat.combatants || [];

    for (const combatant of combatants) {
      if (!combatant) continue;

      const actor = combatant.actor;
      if (!actor) {
        console.warn("[ADD2E][AUTO-REMOVE] combatant sans actor :", combatant);
        continue;
      }

      const toDelete = [];

      for (const effect of Array.from(actor.effects ?? [])) {
        if (!effect) continue;

        const dur = effect.duration || {};

        if (effect.disabled) continue;
        if (typeof dur.rounds !== "number" || isNaN(dur.rounds)) continue;

        const totalRounds = dur.rounds;
        let startRound = dur.startRound;

        if (typeof startRound !== "number" || isNaN(startRound)) {
          try {
            if (!actor.effects.get(effect.id)) continue;
            await effect.update({ "duration.startRound": currentRound });
            startRound = currentRound;
          } catch (err) {
            const msg = String(err?.message || err || "");
            if (msg.includes("does not exist") || msg.includes("n'existe pas")) {
              console.warn("[ADD2E][AUTO-REMOVE][STALE_UPDATE] Effet déjà absent pendant l'initialisation startRound", {
                actor: actor.name,
                effectId: effect.id,
                effectName: effect.name
              });
              continue;
            }
            throw err;
          }
        }

        const elapsed = Math.max(0, currentRound - startRound);
        const remaining = totalRounds - elapsed;

        if (remaining <= 0) toDelete.push(effect.id);
      }

      const validIds = toDelete.filter(id => id && actor.effects.get(id));
      if (!validIds.length) continue;

      console.log("[ADD2E][AUTO-REMOVE] Suppression auto des effets expirés", {
        actor: actor.name,
        ids: validIds
      });

      for (const effectId of validIds) {
        if (!actor.effects.get(effectId)) continue;

        try {
          await actor.deleteEmbeddedDocuments("ActiveEffect", [effectId]);
        } catch (err) {
          const msg = String(err?.message || err || "");
          if (msg.includes("does not exist") || msg.includes("n'existe pas")) {
            console.warn("[ADD2E][AUTO-REMOVE][ALREADY_GONE] Effet déjà absent, suppression ignorée", {
              actor: actor.name,
              effectId,
              err
            });
            continue;
          }

          console.error("[ADD2E][AUTO-REMOVE][DELETE_ERROR] Suppression impossible", {
            actor: actor.name,
            effectId,
            err
          });
        }
      }
    }
  } catch (err) {
    console.error("[ADD2E][AUTO-REMOVE] ERREUR dans updateCombat(auto-remove-effects) :", err);
  }
});
