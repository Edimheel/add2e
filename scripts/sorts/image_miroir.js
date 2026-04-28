/**
 * ADD2E — Sort IMAGE MIROIR (V22 - Debug & Sanitization)
 * - Ajout de logs détaillés (F12) pour tracer l'erreur.
 * - Nettoyage drastique (JSON stringify) des données avant envoi Socket.
 */

console.log("%c[ADD2E][MIROIR] Lancement V22 (Debug Mode)", "color: #e67e22; font-weight:bold;");

return await (async () => {

    // 1. INITIALISATION
    if (!game.user.isGM && !game.users.some(u => u.isGM && u.active)) {
        return ui.notifications.error("ERREUR : Aucun MJ connecté pour créer les tokens.");
    }

    let sourceItem = (typeof item !== "undefined" && item) ? item : ((typeof sort !== "undefined" && sort) ? sort : this);
    if (!sourceItem || !sourceItem.system) {
        if (typeof args !== "undefined" && args[0]?.item) sourceItem = args[0].item;
    }
    if (!sourceItem) return ui.notifications.error("Sort introuvable.");

    const caster = sourceItem.parent || actor;
    const casterToken = caster.getActiveTokens()[0]; 
    if (!casterToken) return ui.notifications.warn("Le lanceur doit avoir un token sur la scène.");
    
    const targetScene = casterToken.scene;
    console.log(`[ADD2E-DEBUG] Étape 1 : Init OK. Scène : ${targetScene.name} (ID: ${targetScene.id})`);

    // 2. CALCUL
    const niveauLanceur = Number(caster.system.niveau) || 1;
    const dureeRounds = 2 * niveauLanceur;
    const roll = new Roll(`1d100 + ${niveauLanceur}`);
    await roll.evaluate();
    const score = roll.total;

    let numImages = 1;
    if (score > 75) numImages = 4;
    else if (score > 50) numImages = 3;
    else if (score > 25) numImages = 2;
    
    console.log(`[ADD2E-DEBUG] Étape 2 : Calcul OK. ${numImages} images (Jet: ${score})`);

    // 3. HOOK NETTOYAGE
    if (!globalThis.add2eMirrorHookRegistered) {
        globalThis.add2eMirrorHookRegistered = true;
        Hooks.on("deleteActiveEffect", async (effect) => {
            const flagData = effect.flags?.add2e?.mirrorPayload;
            if (flagData?.tokenIds) {
                const scene = game.scenes.get(flagData.sceneId) || canvas.scene;
                if (!scene) return;
                const toDelete = flagData.tokenIds.filter(id => scene.tokens.has(id));
                if (toDelete.length > 0) {
                    if (game.user.isGM) await scene.deleteEmbeddedDocuments("Token", toDelete).catch(()=>{});
                    else if (game.socket) game.socket.emit("system.add2e", { type: "deleteToken", tokenIds: toDelete, sceneId: scene.id });
                    console.log(`[ADD2E-DEBUG] Nettoyage terminé.`);
                }
            }
        });
    }

    // 4. PLACEMENT & SHUFFLE
    const grid = canvas.grid.size;
    const origin = casterToken.center;
    const cx = casterToken.document.x;
    const cy = casterToken.document.y;
    
    const isValidSpot = (tx, ty) => {
        if (tx < 0 || ty < 0 || tx > canvas.dimensions.width || ty > canvas.dimensions.height) return false;
        const targetCenter = { x: tx + grid/2, y: ty + grid/2 };
        const hasWall = CONFIG.Canvas.polygonBackends.move.testCollision(origin, targetCenter, { mode: "any", type: "move" });
        if (hasWall) return false;
        return true; 
    };

    let spots = [];
    for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
            let tx = cx + (i * grid);
            let ty = cy + (j * grid);
            if (isValidSpot(tx, ty)) spots.push({ x: tx, y: ty });
        }
    }

    // Mélange
    for (let i = spots.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [spots[i], spots[j]] = [spots[j], spots[i]];
    }

    const needed = numImages + 1;
    while (spots.length < needed) {
        const jitterX = (Math.random() * 20) - 10;
        const jitterY = (Math.random() * 20) - 10;
        spots.push({ x: cx + jitterX, y: cy + jitterY });
    }
    
    const finalSpots = spots.slice(0, needed);
    const realSpot = finalSpots[0];
    const cloneSpots = finalSpots.slice(1);

    console.log(`[ADD2E-DEBUG] Étape 3 : Placement OK. Vrai token va en ${realSpot.x},${realSpot.y}`);

    // 5. EXÉCUTION
    // A. Déplacement Vrai Token
    await casterToken.document.update({ x: realSpot.x, y: realSpot.y }, { animate: false });

    // B. Préparation Clones (DONNÉES ULTRA PROPRES)
    // On extrait manuellement pour éviter tout objet complexe
    const simpleTexture = {
        src: casterToken.document.texture.src,
        scaleX: casterToken.document.texture.scaleX || 1,
        scaleY: casterToken.document.texture.scaleY || 1,
        rotation: casterToken.document.rotation || 0,
        tint: casterToken.document.texture.tint || null
    };

    const tokenTemplate = {
        name: `${caster.name}`,
        actorId: casterToken.document.actorId,
        actorLink: false,
        width: casterToken.document.width,
        height: casterToken.document.height,
        texture: simpleTexture,
        rotation: casterToken.document.rotation,
        elevation: casterToken.document.elevation,
        hidden: false,
        delta: {
            name: `${caster.name}`,
            system: {
                pdv: 1, points_de_coup: 1,
                attributes: { hp: { value: 1, max: 1 } }
            }
        },
        flags: { add2e: { isMirrorImage: true } },
        displayBars: 0, displayName: 30, alpha: 1
    };

    const tokensToCreate = [];
    const createdIds = [];

    for (const spot of cloneSpots) {
        const newId = foundry.utils.randomID();
        // Clone profond via JSON pour casser toute référence
        const cloneData = JSON.parse(JSON.stringify(tokenTemplate));
        cloneData._id = newId;
        cloneData.x = spot.x;
        cloneData.y = spot.y;
        
        tokensToCreate.push(cloneData);
        createdIds.push(newId);
    }

    console.log(`[ADD2E-DEBUG] Étape 4 : Génération Données Clones OK.`, tokensToCreate);

    // C. CRÉATION (Avec logs Socket)
    if (game.user.isGM) {
        console.log(`[ADD2E-DEBUG] GM détecté : Création directe.`);
        await targetScene.createEmbeddedDocuments("Token", tokensToCreate, { keepId: true });
    } else {
        console.log(`[ADD2E-DEBUG] Joueur détecté : Envoi Socket vers GM...`);
        console.log(`[ADD2E-DEBUG] Payload taille: ${JSON.stringify(tokensToCreate).length} caractères.`);
        
        game.socket.emit("system.add2e", { 
            type: "createToken", 
            tokenData: tokensToCreate, // Déjà nettoyé via JSON.parse/stringify plus haut
            sceneId: targetScene.id 
        });
    }

    // 6. EFFET & CHAT
    const effectData = {
        name: "Image miroir",
        icon: sourceItem.img,
        origin: sourceItem.uuid,
        duration: { rounds: dureeRounds },
        description: `${numImages} sosies (1 PV).`,
        flags: { add2e: { mirrorPayload: { tokenIds: createdIds, sceneId: targetScene.id } } }
    };

    if (game.user.isGM || caster.isOwner) {
        await caster.createEmbeddedDocuments("ActiveEffect", [effectData]);
    } else {
        game.socket.emit("system.add2e", { type: "applyActiveEffect", actorId: caster.id, effectData: effectData });
    }

    console.log(`[ADD2E-DEBUG] Étape 5 : Effet appliqué. Fin du script.`);

    // Chat
    const labelCharge = (await sourceItem.getFlag("add2e", "memorizedCount") !== undefined) 
        ? `<span style="font-size:0.9em;color:#2980b9;margin-left:5px;">Reste : ${await sourceItem.getFlag("add2e", "memorizedCount")}</span>` : "";

    const chatContent = `
    <div class="add2e-spell-card" style="border-radius:12px; box-shadow:0 2px 10px #715aab33; background:linear-gradient(100deg,#f8f6fc 90%,#e8def8 100%); border:1.5px solid #9373c7; padding:0.5em 1em; font-family:var(--font-primary);">
      <div style="display:flex;align-items:center;gap:0.7em;">
        <img src="${sourceItem.img}" style="width:40px;height:40px;border-radius:5px;">
        <div><div style="font-weight:bold;color:#6841a2;">${sourceItem.name}</div><div style="font-size:0.8em;color:#666;">par ${caster.name}</div></div>
        ${labelCharge}
      </div>
      <div style="margin:8px 0;padding:6px;border-radius:6px;text-align:center;background:#f4efff;border:1px solid #e0d4fc;color:#8e44ad;">
        <b>🎭 ${numImages} SOSIES CRÉÉS</b><br><span style="font-size:0.85em;">Jet: ${score} (+${niveauLanceur})</span>
      </div>
    </div>`;

    ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: caster }), content: chatContent });

    return true;
})();