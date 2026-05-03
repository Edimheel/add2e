window.applyRaceEffects = async function(actor, item) {
  const typeItem = item?.type || "race";
  const itemUuid = item.uuid || null;
  const itemName = item.name || typeItem;

  if (!actor) {
    ui.notifications.warn(`Aucun acteur ciblé pour appliquer les effets de la ${typeItem}.`);
    return;
  }

  // === LOG pour debug ===
  console.log(`[ADD2e][ONUSE][RACE] Effets actuellement sur l'acteur:`);
  actor.effects.contents.forEach(eff => {
    console.log(`- [${eff.id}] ${eff.name} | origin: ${eff.origin || "AUCUNE"}`);
  });

  // === SUPPRESSION stricte de tous les effets "race" !== item actuel ===
  const toDelete = [];
  for (let e of actor.effects.contents) {
    // Critère de suppression :
    // 1. Origin correspond à un item autre que la race courante ET commence par "Actor."
    // 2. OU nom de l'effet existe dans le tableau d'effets de la nouvelle race
    const origin = e.origin || "";
    // On considère comme "effet racial" tout effet dont l'origin commence par "Actor." ET diffère de la race actuelle
    const isOtherRaceOrigin = origin.startsWith("Actor.") && origin !== itemUuid;
    // Option complémentaire : suppression si nom d'effet collé à une race (pour éviter doublons)
    const isDuplicateName = (item.system?.effects || []).some(ef => ef.name === e.name && origin !== itemUuid);
    if (isOtherRaceOrigin || isDuplicateName) {
      toDelete.push(e.id);
      console.log(`[ADD2e][ONUSE][RACE] Prépare suppression effet : ${e.name} (origin=${origin})`);
    }
  }

  if (toDelete.length > 0) {
    await actor.deleteEmbeddedDocuments("ActiveEffect", toDelete);
    console.log(`[ADD2e][ONUSE][RACE] Effets anciens supprimés :`, toDelete);
  } else {
    console.log(`[ADD2e][ONUSE][RACE] Aucun effet racial à supprimer.`);
  }

  // === APPLICATION DES NOUVEAUX EFFETS RACIAUX ===
  const effets = item.system?.effects || [];
  if (!Array.isArray(effets) || effets.length === 0) {
    ui.notifications.warn(`Aucun effet trouvé sur l’item ${itemName} !`);
    return;
  }

  let count = 0;
  for (let effet of effets) {
    try {
      let exists = actor.effects.contents.some(e => e.name === effet.name && e.origin === itemUuid);
      if (exists) {
        console.log(`[ADD2e][RACE] Effet déjà présent: ${effet.name}`);
      } else {
        effet.img = effet.img || effet.icon || "icons/svg/aura.svg";
        delete effet.icon;
        effet.origin = itemUuid || null;
        let created = await actor.createEmbeddedDocuments("ActiveEffect", [effet]);
        if (created && created.length > 0) {
          console.log(`[ADD2e][RACE] Effet ajouté: ${effet.name}`, created[0]);
          count++;
        } else {
          console.warn(`[ADD2e][RACE] Échec création pour: ${effet.name}`, effet);
        }
      }
    } catch (err) {
      console.error(`[ADD2e][RACE] ERREUR pour "${effet.name}":`, err);
    }
  }

  if (count > 0) {
    ui.notifications.info(`Effets de ${itemName} appliqués à ${actor.name} !`);
  } else {
    ui.notifications.info(`Aucun nouvel effet appliqué (déjà présents ou erreur).`);
  }
  console.log(`[ADD2e][RACE] Application des effets terminée pour`, actor.name, actor.effects.contents);
};
