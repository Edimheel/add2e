// Foundry VTT v12+ compatible : fonction globale window.applyElfeEffects

window.applyElfeEffects = async function(actor, item) {
  console.log("[ADD2e][ONUSE][ELFE] Fonction applyElfeEffects() appelée", { actor, item });

  if (!actor) {
    ui.notifications.warn("Aucun acteur ciblé pour appliquer les effets de la race Elfe.");
    console.warn("[ADD2e][RACE ELFE] Aucun acteur ciblé !");
    return;
  }

  // Cherche les effets sur l'item (dans system.effects, au format tableau)
  const effetsElfe = item.system?.effects || [];
  if (!Array.isArray(effetsElfe) || effetsElfe.length === 0) {
    ui.notifications.warn("Aucun effet trouvé sur la race Elfe !");
    console.warn("[ADD2e][RACE ELFE] Aucun effet trouvé dans item.system.effects !");
    return;
  }

  for (let effet of effetsElfe) {
    try {
      let exists = actor.effects.contents.some(e => e.name === effet.name);
      if (exists) {
        console.log(`[ADD2e][RACE ELFE] Effet déjà présent: ${effet.name}`);
      } else {
effet.img = effet.img || effet.icon || "icons/svg/aura.svg";
delete effet.icon;
        effet.origin = item.uuid || null;
        // Application de l'effet
        let created = await actor.createEmbeddedDocuments("ActiveEffect", [effet]);
        if (created && created.length > 0) {
          console.log(`[ADD2e][RACE ELFE] Effet ajouté: ${effet.name}`, created[0]);
        } else {
          console.warn(`[ADD2e][RACE ELFE] Échec création pour: ${effet.name}`, effet);
        }
      }
    } catch (err) {
      console.error(`[ADD2e][RACE ELFE] ERREUR pour "${effet.name}":`, err);
    }
  }

  ui.notifications.info("Effets raciaux de l'elfe appliqués !");
  console.log("[ADD2e][RACE ELFE] Application des effets terminée pour", actor.name, actor.effects.contents);
};
