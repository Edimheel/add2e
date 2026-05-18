// scripts/add2e-attack/02-damage.mjs
// ADD2E — Application des dégâts.

export async function add2eApplyDamage({ cible, montant, type = "", details = "" }) {
  if (!cible) {
    ui.notifications.error("Pas de cible !");
    return;
  }

  const dmg = Number(montant) || 0;
  console.log(`ADD2E SOCKET | 🎯 Demande de dégâts (${dmg}) sur`, cible?.name);

  // === CAS JOUEUR : on envoie un FLAG au MJ ===
  if (!game.user.isGM) {
    if (!game.socket) {
      console.warn("ADD2E SOCKET | ⚠️ game.socket indisponible côté joueur.");
      ui.notifications.error("Socket Foundry indisponible (game.socket).");
      return;
    }

    const tokenId =
      cible.token?.id ||
      (cible instanceof Token ? cible.id : null);

    const actorId =
      cible.actor?.id || // si cible = Token
      cible.id;          // si cible = Actor

    const flagData = {
      montant: dmg,
      type,
      details,
      source: "attack",
      fromUserId: game.user.id,
      timestamp: Date.now()
    };

    console.log("ADD2E SOCKET | 📤 Joueur -> emit applyDamageFlag :", {
      tokenId,
      actorId,
      flagData
    });

    game.socket.emit("system.add2e", {
      type: "applyDamageFlag",
      tokenId,
      actorId,
      flagData
    });

    ui.notifications.info(`Dégâts (${dmg}) envoyés au MJ.`);
    return;
  }

  // === CAS MJ : application directe ===
  console.log("ADD2E SOCKET | 🛠️ MJ -> Application directe dégâts.");

  const actor = cible.actor || cible;

  // Alignement strict sur ta fiche :
  // - max = system.points_de_coup
  // - courant = system.pdv
  const maxHP = Number(actor.system?.points_de_coup) || 0;

  // Si pdv n'existe pas, on l'initialise au max (sans toucher au max).
  let currentHP = actor.system?.pdv;
  if (currentHP === undefined || currentHP === null || currentHP === "" || isNaN(Number(currentHP))) {
    currentHP = maxHP;
  } else {
    currentHP = Number(currentHP) || 0;
  }

  const oldHP = currentHP;
  const newHP = oldHP - dmg; // dmg>0 => dégâts, dmg<0 => soins

  // Mise à jour UNIQUEMENT des PV courants
  // (PV max = points_de_coup ne bouge jamais ici)
  const updateData = { "system.pdv": newHP };

  // Optionnel mais recommandé : si pdv était absent, on force l’écriture (déjà inclus)
  await actor.update(updateData);

  console.log(
    `ADD2E SOCKET | 💉 PV courants sur ${actor.name} : ${oldHP} -> ${newHP} (${dmg >= 0 ? "-" : "+"}${Math.abs(dmg)}) | PV max inchangé = ${maxHP}`
  );

  // === Gestion états inconscient / mort via status overlay (MJ seulement) ===
  try {
    const DEAD_STATUS = "dead";
    const UNCONSCIOUS_STATUS = "unconscious";

    const toggleStatus = async (id, options) => {
      if (!id) return;
      await actor.toggleStatusEffect(id, options);
    };

    if (newHP <= -11) {
      await toggleStatus(UNCONSCIOUS_STATUS, { active: false, overlay: false });
      await toggleStatus(DEAD_STATUS,        { active: true,  overlay: true  });
      console.log("ADD2E SOCKET | 🎭 Statut overlay : MORT");
    } else if (newHP <= 0) {
      await toggleStatus(DEAD_STATUS,        { active: false, overlay: false });
      await toggleStatus(UNCONSCIOUS_STATUS, { active: true,  overlay: true  });
      console.log("ADD2E SOCKET | 🎭 Statut overlay : INCONSCIENT");
    } else {
      await toggleStatus(DEAD_STATUS,        { active: false, overlay: false });
      await toggleStatus(UNCONSCIOUS_STATUS, { active: false, overlay: false });
      console.log("ADD2E SOCKET | 🎭 Statut overlay : aucun (PV > 0)");
    }
  } catch (e) {
    console.warn("ADD2E SOCKET | ⚠️ Erreur mise à jour overlay HP (MJ direct) :", e);
  }

  ui.notifications.info(`${actor.name} prend ${dmg} dégâts.`);
}

// accès global pour macros
globalThis.add2eApplyDamage = add2eApplyDamage;



