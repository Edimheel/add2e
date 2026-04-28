/**
 * ADD2E — Sort LUMIÈRE (V10 FINAL)
 * ✔ Créature : lumière sur token + ActiveEffect
 * ✔ Sol : Warpgate crosshairs + AmbientLight via socket MJ
 */

console.log("%c[ADD2E][LUMIERE] V9.5-DEBUG", "color:#e67e22;font-weight:bold;");

return await (async () => {
  let sourceItem = (typeof item !== "undefined" && item) ? item : ((typeof sort !== "undefined" && sort) ? sort : this);
  if ((!sourceItem || !sourceItem.system) && typeof args !== "undefined" && args?.[0]?.item) sourceItem = args[0].item;
  if (!sourceItem) return ui.notifications.error("Sort introuvable.");

  const caster = sourceItem.parent ?? actor;
  if (!caster) return ui.notifications.error("Lanceur introuvable.");

  console.log("[ADD2E][LUMIERE] caster:", caster.name, caster.id, "user:", game.user.name, "isGM:", game.user.isGM, "activeGM:", game.users.activeGM?.name);

  const niveau      = Number(caster.system?.niveau) || 1;
  const dureeRounds = Math.max(10, niveau * 10);
  const rayon       = 6;

  const lightColor  = "#fffec4";
  const lightAnim   = { type: "torch", speed: 2, intensity: 2 };

  const durationData = {
    rounds: dureeRounds,
    startRound: game.combat?.round ?? null,
    startTurn:  game.combat?.turn  ?? null
  };

  const mode = await new Promise(resolve => {
    new Dialog({
      title: "Lancement : Lumière",
      content: `
        <form style="font-family:var(--font-primary);">
          <div class="form-group">
            <label style="font-weight:bold;">Cible :</label>
            <select id="mode" style="width:100%">
              <option value="creature">Sur une Créature (Cible)</option>
              <option value="ground">Au Sol (Zone de lumière)</option>
            </select>
          </div>
          <p style="font-size:0.9em; margin-top:5px; color:#666;">Durée : ${dureeRounds} rounds</p>
        </form>`,
      buttons: {
        ok: { label: "Lancer", callback: html => resolve(html.find("#mode").val()) },
        cancel: { label: "Annuler", callback: () => resolve(null) }
      },
      default: "ok"
    }).render(true);
  });

  console.log("[ADD2E][LUMIERE] mode:", mode);
  if (!mode) return false;

  let statusHtml = "";
  let cibleTxt   = (mode === "creature") ? "Cible" : "Sol";

  // =======================================================
  // CREATURE
  // =======================================================
  // =======================================================
// 3A. CIBLE : CRÉATURE (DEBUG + sceneId + sockets robustes)
// =======================================================
if (mode === "creature") {
  const targets = Array.from(game.user.targets);
  console.log("[ADD2E][LUMIERE] creature | targets:", targets?.map(t => ({
    id: t.id, name: t.name, actorId: t.actor?.id, disp: t.document?.disposition
  })));

  if (!targets.length) {
    ui.notifications.warn("Veuillez sélectionner un token cible (outil de ciblage).");
    return false;
  }

  const targetTokenObj = targets[0];
  const targetTokenDoc = targetTokenObj.document;
  const targetActorDoc = targetTokenObj.actor;

  const sceneId = targetTokenDoc.parent?.id || canvas.scene?.id || null;

  console.log("[ADD2E][LUMIERE] creature | tokenDoc:", {
    tokenId: targetTokenDoc.id,
    tokenName: targetTokenDoc.name,
    sceneId,
    isOwner: targetTokenDoc.isOwner,
    userIsGM: game.user.isGM
  });

  if (!targetActorDoc) {
    ui.notifications.error("Cible sans acteur (token sans actor).");
    return false;
  }

  cibleTxt = targetTokenDoc.name;

  let saveVal = Number(targetActorDoc.system?.sauvegardes?.sorts) || 14;

  let roll;
  try {
    roll = new Roll("1d20");
await roll.evaluate(); // v13+

    if (game.dice3d) await game.dice3d.showForRoll(roll);
  } catch (e) {
    console.error("[ADD2E][LUMIERE] creature | Roll failed:", e);
    ui.notifications.error("Erreur de jet de sauvegarde (voir console).");
    return false;
  }

  const hostile = targetTokenDoc.disposition === -1;
  const saved   = hostile && (roll.total >= saveVal);

  console.log("[ADD2E][LUMIERE] creature | hostile:", hostile, "saved:", saved, "roll:", roll.total, "vs", saveVal);

  if (saved) {
    statusHtml = `
      <div style="margin: 5px 0 8px 0; padding: 6px; border-radius: 6px; text-align: center;
                  background: #eafaf1; border: 1px solid #ccebd9; color: #27ae60;">
        <div style="font-weight: bold; font-size: 1.1em;">🛡️ RÉSISTE</div>
        <div style="font-size: 0.85em;">Sauvegarde réussie (${roll.total} vs ${saveVal})</div>
      </div>`;
    // Rien à appliquer
  } else {
    statusHtml = `
      <div style="margin: 5px 0 8px 0; padding: 6px; border-radius: 6px; text-align: center;
                  background: #f4efff; border: 1px solid #e0d4fc; color: #8e44ad;">
        <div style="font-weight: bold; font-size: 1.1em;">✨ ILLUMINÉ</div>
        <div style="font-size: 0.85em;">${hostile ? `Échec sauvegarde (${roll.total} vs ${saveVal})` : "Sort accepté"}</div>
      </div>`;

    // Sauvegarde état original (pour cleanup)
    const lightPayload = {
      type: "token",
      sceneId,
      tokenId: targetTokenDoc.id,
      originalDim:       targetTokenDoc.light?.dim,
      originalBright:    targetTokenDoc.light?.bright,
      originalColor:     targetTokenDoc.light?.color,
      originalAlpha:     targetTokenDoc.light?.alpha,
      originalAngle:     targetTokenDoc.light?.angle,
      originalAnimation: targetTokenDoc.light?.animation
    };

    const newLight = {
      "light.dim":       rayon,
      "light.bright":    rayon / 2,
      "light.color":     lightColor,
      "light.alpha":     0.5,
      "light.angle":     360,
      "light.animation": lightAnim
    };

    // 1) UPDATE TOKEN LIGHT
    try {
      if (game.user.isGM || targetTokenDoc.isOwner) {
        console.log("[ADD2E][LUMIERE] creature | updating token locally:", targetTokenDoc.id, newLight);
        await targetTokenDoc.update(newLight);
        console.log("[ADD2E][LUMIERE] creature | token updated OK");
      } else {
        const msg = { type: "updateToken", sceneId, tokenId: targetTokenDoc.id, updateData: newLight, fromUserId: game.user.id, sentAt: Date.now() };
        console.log("[ADD2E][LUMIERE] creature | emitting updateToken:", msg);
        game.socket?.emit("system.add2e", msg);
      }
    } catch (e) {
      console.error("[ADD2E][LUMIERE] creature | token update FAILED:", e);
      ui.notifications.error("Impossible de mettre à jour la lumière du token (voir console).");
      // On continue quand même avec l'effet pour diagnostiquer
    }

    // 2) APPLY ACTIVE EFFECT
    const effectData = {
      name: "Lumière",
      icon: sourceItem.img || "icons/svg/light.svg",
      origin: sourceItem.uuid,
      duration: durationData,
      description: "Émet de la lumière magique.",
      flags: { add2e: { lightPayload } }
    };

    try {
      if (game.user.isGM || targetActorDoc.isOwner) {
        console.log("[ADD2E][LUMIERE] creature | creating AE locally on actor:", targetActorDoc.id, effectData);
        await targetActorDoc.createEmbeddedDocuments("ActiveEffect", [effectData]);
        console.log("[ADD2E][LUMIERE] creature | AE created OK");
      } else {
        const msg = { type: "applyActiveEffect", actorId: targetActorDoc.id, effectData, fromUserId: game.user.id, sentAt: Date.now() };
        console.log("[ADD2E][LUMIERE] creature | emitting applyActiveEffect:", msg);
        game.socket?.emit("system.add2e", msg);
      }
    } catch (e) {
      console.error("[ADD2E][LUMIERE] creature | AE create FAILED:", e);
      ui.notifications.error("Impossible de créer l'ActiveEffect (voir console).");
    }
  }
}


  // =======================================================
  // GROUND
  // =======================================================
  // =======================================================
// 3B. CIBLE : SOL (WARPGATE CROSSHAIRS + AMBIENTLIGHT)
// =======================================================
if (mode === "ground") {
  console.log("[ADD2E][LUMIERE] ground start | socket:", !!game.socket, "canvas.ready:", !!canvas?.ready);

  if (!game.socket) {
    ui.notifications.warn("Impossible de poser la zone de lumière (socket indisponible).");
    return false;
  }

  const wgActive = game.modules.get("warpgate")?.active && typeof warpgate?.crosshairs?.show === "function";
  console.log("[ADD2E][LUMIERE] warpgate active:", wgActive, "module:", game.modules.get("warpgate"));
  if (!wgActive) {
    ui.notifications.warn("Warpgate est requis (module actif) pour le viseur.");
    return false;
  }

  if (!canvas?.ready) {
    ui.notifications.warn("La scène n'est pas prête.");
    return false;
  }

  let cross = null;

  // --- Appel crosshairs compatible (ne PAS passer {show:true}) ---
  try {
    const config = {
      size: rayon,
      icon: sourceItem.img || "icons/svg/light.svg",
      label: "Lumière",
      interval: canvas.grid.size,   // OK v12+
      drawIcon: true,
      drawOutline: true,
      rememberControlled: false
    };

    // 2e param : fournir un objet "callbacks" safe (si Warpgate l'utilise)
    const callbacks = {
      // si Warpgate attend callbacks.show() -> on fournit une fonction no-op
      show: () => {},
      // idem pour éviter d'autres surprises possibles
      move: () => {},
      cancel: () => {}
    };

    console.log("[ADD2E][LUMIERE] crosshairs.show calling with:", { config, callbacks });
    cross = await warpgate.crosshairs.show(config, callbacks);
    console.log("[ADD2E][LUMIERE] crosshairs result:", cross);
  } catch (e) {
    console.error("[ADD2E][LUMIERE] crosshairs.show FAILED:", e);
    ui.notifications.error("Crosshairs Warpgate a échoué (voir console joueur).");
    return false;
  }

  if (!cross || cross.cancelled) {
    console.log("[ADD2E][LUMIERE] Placement annulé ou crosshairs null");
    return false;
  }

  const sceneId = canvas.scene?.id;
  if (!sceneId) return ui.notifications.error("Aucune scène active.");

  const payload = {
    type: "placeAmbientLight",
    sceneId,
    x: cross.x,
    y: cross.y,
    dim: rayon,
    bright: rayon / 2,
    color: lightColor,
    alpha: 0.5,
    angle: 360,
    animation: lightAnim,
    spellName: sourceItem.name,
    actorId: caster.id,
    fromUserId: game.user.id,
    sentAt: Date.now()
  };

  console.log("[ADD2E][LUMIERE] emitting socket payload:", payload);
  game.socket.emit("system.add2e", payload);

  // ActiveEffect sur le lanceur (cleanup piloté par flags)
  try {
    const created = await caster.createEmbeddedDocuments("ActiveEffect", [{
      name: "Lumière (Zone)",
      icon: sourceItem.img || "icons/svg/sun.svg",
      origin: sourceItem.uuid,
      duration: durationData,
      description: "Maintient une zone de lumière magique.",
      flags: { add2e: { lightPayload: { type: "ambient", actorId: caster.id, spellName: sourceItem.name, sceneId } } }
    }]);
    console.log("[ADD2E][LUMIERE] AE created on caster:", created?.[0]?.id);
  } catch (e) {
    console.warn("[ADD2E][LUMIERE] AE create failed (non-bloquant):", e);
  }

  statusHtml = `
    <div style="margin: 5px 0 8px 0; padding: 6px; border-radius: 6px; text-align: center;
                background: #fff9c4; border: 1px solid #f9e79f; color: #d4ac0d;">
      <div style="font-weight: bold; font-size: 1.1em;">✨ LUMIÈRE AU SOL</div>
      <div style="font-size: 0.85em;">Zone de lumière maintenue par le lanceur</div>
    </div>`;
}


  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: caster }),
    content: `<div class="add2e-spell-card"><b>${sourceItem.name}</b><br><em>${cibleTxt}</em>${statusHtml}</div>`,
    type: CONST.CHAT_MESSAGE_TYPES.OTHER
  });

  return true;
})();
