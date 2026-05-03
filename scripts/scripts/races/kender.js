/**
 * kender.js
 * Gestion des effets raciaux Kender (AD&D 2e)
 * Basé sur le modèle standard de nettoyage/application d'effets + Taunt.
 */

// 1. Fonction d'application des effets passifs (Modèle standard)
window.applyKenderEffects = async function(actor, item) {
  const typeItem = item?.type || "race";
  const itemUuid = item.uuid || null;
  const itemName = item.name || typeItem;

  if (!actor) {
    ui.notifications.warn(`Aucun acteur ciblé pour appliquer les effets de la ${typeItem}.`);
    return;
  }

  // === LOG pour debug ===
  console.log(`[ADD2e][ONUSE][KENDER] Effets actuellement sur l'acteur:`);
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
      console.log(`[ADD2e][ONUSE][KENDER] Prépare suppression effet : ${e.name} (origin=${origin})`);
    }
  }

  if (toDelete.length > 0) {
    await actor.deleteEmbeddedDocuments("ActiveEffect", toDelete);
    console.log(`[ADD2e][ONUSE][KENDER] Effets anciens supprimés :`, toDelete);
  } else {
    console.log(`[ADD2e][ONUSE][KENDER] Aucun effet racial à supprimer.`);
  }

  // === APPLICATION DES NOUVEAUX EFFETS RACIAUX ===
  const effets = item.system?.effects || [];
  if (!Array.isArray(effets) || effets.length === 0) {
    ui.notifications.warn(`Aucun effet trouvé sur l’item ${itemName} ! (Vérifiez le JSON de la race)`);
    return;
  }

  let count = 0;
  for (let effet of effets) {
    try {
      let exists = actor.effects.contents.some(e => e.name === effet.name && e.origin === itemUuid);
      if (exists) {
        console.log(`[ADD2e][KENDER] Effet déjà présent: ${effet.name}`);
      } else {
        // Copie propre pour éviter de modifier l'objet original
        let newEffectData = foundry.utils.duplicate(effet);
        
        newEffectData.img = newEffectData.img || newEffectData.icon || "icons/svg/aura.svg";
        delete newEffectData.icon;
        newEffectData.origin = itemUuid || null;
        
        let created = await actor.createEmbeddedDocuments("ActiveEffect", [newEffectData]);
        if (created && created.length > 0) {
          console.log(`[ADD2e][KENDER] Effet ajouté: ${newEffectData.name}`, created[0]);
          count++;
        } else {
          console.warn(`[ADD2e][KENDER] Échec création pour: ${newEffectData.name}`, newEffectData);
        }
      }
    } catch (err) {
      console.error(`[ADD2e][KENDER] ERREUR pour "${effet.name}":`, err);
    }
  }

  if (count > 0) {
    ui.notifications.info(`Traits kenders appliqués à ${actor.name} !`);
  } else {
    ui.notifications.info(`Aucun nouvel effet kender appliqué (déjà présents ou erreur).`);
  }
  console.log(`[ADD2e][KENDER] Application terminée.`);
};

// 2. Fonction Active : INSULTE (Taunt)
// À appeler via Macro : window.kenderTaunt(actor)
window.kenderTaunt = async function(actor) {
  const targets = Array.from(game.user.targets);
  if (targets.length !== 1) return ui.notifications.warn("Ciblez une créature à insulter !");
  
  const targetToken = targets[0];
  const targetActor = targetToken.actor;

  // Récupération de la sauvegarde vs Sorts (Index 4)
  const saveIndex = 4; 
  let saveValue = 14; // Valeur par défaut
  
  // Essai de récupération via la progression de classe
  if (targetActor.system.sauvegardes) {
     saveValue = Number(targetActor.system.sauvegardes[saveIndex]) || 14;
  } else if (targetActor.system.details_classe?.progression) {
     const lvl = targetActor.system.niveau || 1;
     const prog = targetActor.system.details_classe.progression.find(p => p.niveau == lvl);
     if (prog && prog.savingThrows) saveValue = prog.savingThrows[saveIndex];
  } else if (typeof globalThis.add2eGetSaveTarget === "function") {
     saveValue = globalThis.add2eGetSaveTarget(targetActor, saveIndex);
  }

  // Jet de dés
  const roll = new Roll("1d20");
  await roll.evaluate();
  if (game.dice3d) game.dice3d.showForRoll(roll);

  // Contenu du message
  const contentHeader = `
    <div style="background:#e1f0c4; border:1px solid #6b8c42; padding:5px; border-radius:5px; color:#2c3e16; font-family: var(--font-primary);">
      <h3 style="margin:0; border-bottom:1px solid #6b8c42;">😝 Insulte Kender</h3>
      <div style="margin-top:5px;"><b>${actor.name}</b> provoque <b>${targetToken.name}</b> !</div>
    </div>`;

  if (roll.total >= saveValue) {
    // Réussite
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `${contentHeader}
        <div style="margin-top:5px; color:darkgreen; font-weight:bold; text-align:center;">
          La cible résiste (JS ${roll.total} vs ${saveValue})
        </div>
        <div style="font-size:0.9em; font-style:italic; text-align:center; margin-top:5px;">
          "${targetToken.name} reste de marbre face aux moqueries."
        </div>`
    });
  } else {
    // Échec -> Enragé
    const duree = (await new Roll("1d10").evaluate()).total;
    
    // Application effet Enragé
    await targetActor.createEmbeddedDocuments("ActiveEffect", [{
      label: "Enragé (Insulte Kender)",
      icon: "icons/svg/explosion.svg",
      origin: actor.uuid,
      duration: { rounds: duree },
      changes: [
        { key: "system.bonus_toucher", mode: 2, value: -2 }, // Malus toucher
        { key: "system.ca_total", mode: 2, value: 2 }        // Malus CA (+2 en descendant = plus facile à toucher)
      ],
      flags: {
        add2e: { tags: ["etat:enrage", "target:kender"] },
        core: { statusId: "enrage", overlay: true }
      }
    }]);

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `${contentHeader}
        <div style="margin-top:5px; color:darkred; font-weight:bold; text-align:center;">
          ÉCHEC CRITIQUE DE NERFS ! <br>(JS ${roll.total} < ${saveValue})
        </div>
        <div style="background:#fff; padding:5px; margin-top:5px; border:1px solid #ccc; font-size:0.9em;">
          <b>${targetToken.name}</b> devient fou de rage pendant <b>${duree} rounds</b> !
          <ul style="margin-bottom:0;">
            <li>Attaque sauvagement (-2 au toucher)</li>
            <li>Baisse sa garde (Malus CA)</li>
            <li>Doit attaquer le Kender</li>
          </ul>
        </div>`
    });
  }
};