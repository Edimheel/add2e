// ===============================
// ENREGISTREMENT SYSTEME
// ===============================
// -----------------------------
// Configuration et fiches (INIT)
// -----------------------------

// -------------------------------------------------
// Boutons de la barre de scène & Combat Tracker (READY)
// -------------------------------------------------


// --- VALIDATION DES FICHES ITEM ADD2E ---
// Si un vieux rendu ou une mauvaise configuration a mis en cache une fiche
// incorrecte pour les items classe, on vide le cache de sheet au lancement.
Hooks.once("ready", () => {
  add2eRegisterClassItemSheet();

  const clearClassSheetCache = (item) => {
    if (!item || item.type !== "classe") return;

    if (item._sheet && !(item._sheet instanceof Add2eItemSheet)) {
      console.warn("[ADD2E][SHEETS] Cache de fiche classe incorrect vidé", {
        item: item.name,
        cachedSheet: item._sheet?.constructor?.name,
        expected: Add2eItemSheet?.name
      });
      item._sheet = null;
    }
  };

  for (const item of game.items ?? []) clearClassSheetCache(item);

  for (const actor of game.actors ?? []) {
    for (const item of actor.items ?? []) clearClassSheetCache(item);
  }

  console.log("[ADD2E][SHEETS] Contrôle Item.classe", {
    importedClassSheet: Add2eItemSheet?.name,
    exampleWorldClassSheet: game.items.find(i => i.type === "classe")?.sheet?.constructor?.name ?? null,
    exampleEmbeddedClassSheet: game.actors.find(a => a.items?.some(i => i.type === "classe"))?.items?.find(i => i.type === "classe")?.sheet?.constructor?.name ?? null
  });
});

// --- SOCKET dégâts/états ADD2E + hook MJ --- 

Hooks.on("preCreateItem", (itemData, options, userId) => {
  if (itemData.type === "sort" && Array.isArray(itemData.effects)) {
    for (let eff of itemData.effects) {
      eff.transfer = false;
      eff.disabled = true;
    }
  }
});

async function rollInitiativeD6(combatants) {
    if (!combatants.length) return;
    for (const comb of combatants) {
        const roll = await new Roll("1d6").evaluate({async:true});
        // Mise à jour Acteur ET Combattant
        if (comb.actor) await comb.actor.update({ "system.initiative": roll.total });
        await comb.update({ initiative: roll.total });
        
        await ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: comb.actor }),
            content: `Initiative : <b>${roll.total}</b> (1d6)`,
            flavor: "Initiative"
        });
    }
}
// =========================================================
// NETTOYAGE AUTOMATIQUE (Suppression d'objet)
// =========================================================

/**
 * Déclenché quand un objet est supprimé.
 * Supprime les Effets Actifs (Bonus CA, etc.) qui proviennent de cet objet.
 */
Hooks.on("deleteItem", async (item, options, userId) => {
  // 1. Sécurité : On agit seulement si c'est l'utilisateur courant qui a fait l'action
  if (game.user.id !== userId) return;
  
  // 2. Vérifie que l'item appartient bien à un acteur
  if (!item.parent || item.parent.documentName !== "Actor") return;

  const actor = item.parent;

  // 3. Recherche des effets liés à cet objet.
  // Pour les classes, on supprime aussi les anciens effets générés sans origin fiable.
  const effectsToDelete = actor.effects
    .filter(e => item.type === "classe" ? add2eShouldDeleteEffectForClassPurge(e, [item]) : e.origin === item.uuid)
    .map(e => e.id);

  // 4. Suppression
  if (effectsToDelete.length > 0) {
    console.log(`[ADD2e] Suppression des effets liés à l'objet supprimé : ${item.name}`);
    await actor.deleteEmbeddedDocuments("ActiveEffect", effectsToDelete);
    
    // Petit feedback visuel
    ui.notifications.info(`Les effets de ${item.name} se sont dissipés.`);
  }
  
});
// =========================================================
// ADD2E — RELAIS MJ GÉNÉRIQUE POUR LES SCRIPTS DE SORTS
// À placer tout en bas de scripts/add2e.mjs
// Ne contient aucune logique spécifique à un sort.
// =========================================================
Hooks.once("ready", () => {
  if (globalThis.ADD2E_GM_OPERATION_RELAY_REGISTERED) return;
  globalThis.ADD2E_GM_OPERATION_RELAY_REGISTERED = true;

  console.log("%c[ADD2E][GM-RELAY] Relais MJ générique chargé", "color:#27ae60;font-weight:bold;");

  function isResponsibleGM() {
    if (!game.user.isGM) return false;
    if (typeof game.user.isActiveGM === "boolean") return game.user.isActiveGM;
    return game.users.activeGM?.id === game.user.id;
  }

  function resolveScene(sceneId) {
    return game.scenes.get(sceneId) || canvas.scene || game.scenes.active || null;
  }

  async function resolveActor(payload) {
    if (payload.actorUuid) {
      try {
        const doc = await fromUuid(payload.actorUuid);
        if (doc) return doc;
      } catch (e) {
        console.warn("[ADD2E][GM-RELAY] actorUuid non résolu :", payload.actorUuid, e);
      }
    }

    if (payload.sceneId && payload.tokenId) {
      const scene = resolveScene(payload.sceneId);
      const tokenDoc = scene?.tokens?.get(payload.tokenId);
      if (tokenDoc?.actor) return tokenDoc.actor;
    }

    if (payload.actorId) {
      return game.actors.get(payload.actorId) ?? null;
    }

    return null;
  }

  function findAmbientLight(scene, payload) {
    if (!scene) return null;

    if (payload.lightId) {
      const byId = scene.lights.get(payload.lightId);
      if (byId) return byId;
    }

    if (payload.requestId) {
      const byRequest = scene.lights.find(l =>
        l.flags?.add2e?.requestId === payload.requestId ||
        l.getFlag?.("add2e", "requestId") === payload.requestId
      );

      if (byRequest) return byRequest;
    }

    if (
      Number.isFinite(Number(payload.x)) &&
      Number.isFinite(Number(payload.y))
    ) {
      const px = Number(payload.x);
      const py = Number(payload.y);

      return scene.lights.find(l => {
        const lx = Number(l.x);
        const ly = Number(l.y);

        const samePos =
          Number.isFinite(lx) &&
          Number.isFinite(ly) &&
          Math.abs(lx - px) < 4 &&
          Math.abs(ly - py) < 4;

        const sameSpell =
          !payload.spellName ||
          l.flags?.add2e?.spellName === payload.spellName ||
          l.getFlag?.("add2e", "spellName") === payload.spellName;

        const sameActor =
          !payload.actorId ||
          l.flags?.add2e?.actorId === payload.actorId ||
          l.flags?.add2e?.actorUuid === payload.actorUuid ||
          l.getFlag?.("add2e", "actorId") === payload.actorId ||
          l.getFlag?.("add2e", "actorUuid") === payload.actorUuid;

        return samePos && sameSpell && sameActor;
      }) ?? null;
    }

    return null;
  }

  game.socket.on("system.add2e", async data => {
    console.log("[ADD2E SOCKET][RECU]", {
  user: game.user.name,
  isGM: game.user.isGM,
  data
});
    // -----------------------------------------------------
    // Appliquer un ActiveEffect sur un acteur cible
    // IMPORTANT : ce bloc doit rester tout en haut du socket,
    // juste après le log [ADD2E SOCKET][RECU].
    // -----------------------------------------------------
    if (data.type === "applyActiveEffect") {
      if (!game.user.isGM) return;

      console.log("[ADD2E SOCKET][applyActiveEffect][START]", data);

      let targetActor = null;

      // 1. UUID complet Actor / ActorDelta / Token Actor
      if (data.actorUuid) {
        try {
          const doc = await fromUuid(data.actorUuid);

          console.log("[ADD2E SOCKET][applyActiveEffect][fromUuid]", {
            actorUuid: data.actorUuid,
            documentName: doc?.documentName,
            name: doc?.name,
            uuid: doc?.uuid,
            doc
          });

          if (doc?.documentName === "Actor") {
            targetActor = doc;
          }
          else if (doc?.documentName === "ActorDelta") {
            targetActor = doc.parent?.actor ?? null;
          }
        } catch (e) {
          console.warn("[ADD2E SOCKET][applyActiveEffect] actorUuid invalide :", data.actorUuid, e);
        }
      }

      // 2. Scène + token
      if (!targetActor && data.sceneId && data.tokenId) {
        const scene = game.scenes.get(data.sceneId);
        const tokenDoc = scene?.tokens?.get(data.tokenId);

        console.log("[ADD2E SOCKET][applyActiveEffect][sceneToken]", {
          sceneId: data.sceneId,
          tokenId: data.tokenId,
          sceneName: scene?.name,
          tokenName: tokenDoc?.name,
          tokenActor: tokenDoc?.actor
        });

        if (tokenDoc?.actor) {
          targetActor = tokenDoc.actor;
        }
      }

      // 3. Token actif sur canvas
      if (!targetActor && data.tokenId && canvas?.tokens) {
        const token = canvas.tokens.get(data.tokenId);

        console.log("[ADD2E SOCKET][applyActiveEffect][canvasToken]", {
          tokenId: data.tokenId,
          tokenName: token?.name,
          tokenActor: token?.actor
        });

        if (token?.actor) {
          targetActor = token.actor;
        }
      }

      // 4. Acteur monde lié
      if (!targetActor && data.actorId) {
        targetActor = game.actors.get(data.actorId);

        console.log("[ADD2E SOCKET][applyActiveEffect][worldActor]", {
          actorId: data.actorId,
          actor: targetActor
        });
      }

      if (!targetActor) {
        console.warn("[ADD2E SOCKET][applyActiveEffect] ACTEUR CIBLE INTROUVABLE", data);
        return;
      }

      const effectData = foundry.utils.deepClone(data.effectData || {});

      if (!effectData.name && effectData.label) effectData.name = effectData.label;
      if (!effectData.label && effectData.name) effectData.label = effectData.name;

      effectData.flags ??= {};
      effectData.flags.add2e ??= {};
      effectData.flags.add2e.appliedBySocket = true;
      effectData.flags.add2e.appliedByGM = game.user.id;
      effectData.flags.add2e.appliedAt = Date.now();

      console.log("[ADD2E SOCKET][applyActiveEffect] APPLICATION SUR ACTEUR", {
        actorName: targetActor.name,
        actorId: targetActor.id,
        actorUuid: targetActor.uuid,
        actorDocumentName: targetActor.documentName,
        effectData
      });

      try {
        const created = await targetActor.createEmbeddedDocuments("ActiveEffect", [effectData]);

        console.log("[ADD2E SOCKET][applyActiveEffect] EFFET CRÉÉ", {
          actor: targetActor.name,
          created
        });
      } catch (e) {
        console.error("[ADD2E SOCKET][applyActiveEffect] ERREUR CREATE ActiveEffect", {
          actor: targetActor,
          effectData,
          error: e
        });
      }

      return;
    }
    if (!data || data.type !== "ADD2E_GM_OPERATION") return;
    if (!isResponsibleGM()) return;

    const operation = data.operation;
    const payload = data.payload ?? {};

    console.log("[ADD2E][GM-RELAY] opération reçue :", {
      operation,
      payload
    });

    // -----------------------------------------------------
    // Créer une lumière ambiante
    // -----------------------------------------------------
    if (operation === "createAmbientLight") {
      const scene = resolveScene(payload.sceneId);

      if (!scene) {
        console.warn("[ADD2E][GM-RELAY][createAmbientLight] scène introuvable :", payload);
        return;
      }

      const lightData = {
        x: Number(payload.x ?? 0),
        y: Number(payload.y ?? 0),
        rotation: Number(payload.rotation ?? 0),
        walls: payload.walls !== false,
        vision: payload.vision === true,
        config: {
          dim: Number(payload.dim ?? 6),
          bright: Number(payload.bright ?? 3),
          angle: Number(payload.angle ?? 360),
          color: payload.color ?? "#fffec4",
          alpha: Number(payload.alpha ?? 0.5),
          coloration: Number(payload.coloration ?? 1),
          luminosity: Number(payload.luminosity ?? 0.5),
          attenuation: Number(payload.attenuation ?? 0.5),
          animation: payload.animation ?? {
            type: "torch",
            speed: 2,
            intensity: 2,
            reverse: false
          }
        },
        flags: {
          add2e: foundry.utils.duplicate(payload.flags?.add2e ?? {})
        }
      };

      const created = await scene.createEmbeddedDocuments("AmbientLight", [lightData]);
      const lightDoc = created?.[0];

      console.log("[ADD2E][GM-RELAY][createAmbientLight] créée :", {
        scene: scene.name,
        lightId: lightDoc?.id,
        requestId: payload.flags?.add2e?.requestId
      });

      return;
    }

    // -----------------------------------------------------
    // Supprimer une lumière ambiante
    // -----------------------------------------------------
    if (operation === "deleteAmbientLight") {
      const scene = resolveScene(payload.sceneId);

      if (!scene) {
        console.warn("[ADD2E][GM-RELAY][deleteAmbientLight] scène introuvable :", payload);
        return;
      }

      const lightDoc = findAmbientLight(scene, payload);

      if (!lightDoc) {
        console.warn("[ADD2E][GM-RELAY][deleteAmbientLight] lumière introuvable :", payload);
        return;
      }

      console.log("[ADD2E][GM-RELAY][deleteAmbientLight] suppression :", {
        scene: scene.name,
        lightId: lightDoc.id
      });

      await lightDoc.delete();
      return;
    }

    // -----------------------------------------------------
    // Mettre à jour un token
    // -----------------------------------------------------
    if (operation === "updateToken") {
      const scene = resolveScene(payload.sceneId);
      const tokenDoc = scene?.tokens?.get(payload.tokenId);

      if (!scene || !tokenDoc) {
        console.warn("[ADD2E][GM-RELAY][updateToken] scène/token introuvable :", payload);
        return;
      }

      console.log("[ADD2E][GM-RELAY][updateToken] update :", {
        scene: scene.name,
        token: tokenDoc.name,
        updateData: payload.updateData
      });

      await tokenDoc.update(payload.updateData ?? {});
      return;
    }

    // -----------------------------------------------------
    // Créer un ActiveEffect
    // -----------------------------------------------------
    if (operation === "createActiveEffect") {
      const targetActor = await resolveActor(payload);

      if (!targetActor) {
        console.warn("[ADD2E][GM-RELAY][createActiveEffect] acteur introuvable :", payload);
        return;
      }

      const effectData = foundry.utils.duplicate(payload.effectData ?? {});
      delete effectData._id;

      console.log("[ADD2E][GM-RELAY][createActiveEffect] création :", {
        actor: targetActor.name,
        actorUuid: targetActor.uuid,
        effectData
      });

      await targetActor.createEmbeddedDocuments("ActiveEffect", [effectData]);
      return;
    }

    console.warn("[ADD2E][GM-RELAY] opération inconnue :", operation, payload);
  });
});

// Exposition globale conservée pour compatibilité avec le code legacy et les scripts onUse.
try { globalThis.rollInitiativeD6 = rollInitiativeD6; } catch (_e) {}
