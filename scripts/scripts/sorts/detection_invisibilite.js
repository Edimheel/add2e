/**
 * ADD2E — Sort DÉTECTION DE L'INVISIBILITÉ
 * - Cible : Lanceur (Self).
 * - Effet : Applique les tags de vision (invisible, éthéré, astral).
 * - Durée : 5 rounds / niveau.
 * - Style : Chat Unifié (Violet).
 */

console.log("%c[ADD2E][DETECTION] Lancement du script", "color: #9b59b6; font-weight:bold;");

return await (async () => {

    // =======================================================
    // 1. INITIALISATION
    // =======================================================
    let sourceItem = (typeof item !== "undefined" && item) ? item : ((typeof sort !== "undefined" && sort) ? sort : this);
    
    // Fallback contextuel (si lancé via macro barre)
    if (!sourceItem || !sourceItem.system) {
        if (typeof args !== "undefined" && args[0]?.item) sourceItem = args[0].item;
    }

    if (!sourceItem) return ui.notifications.error("Sort introuvable.");

    const caster = sourceItem.parent || actor;
    if (!caster) return ui.notifications.error("Lanceur introuvable.");

    // --- Paramètres du sort ---
    const info = sourceItem.system;
    const niveauLanceur = Number(caster.system.niveau) || 1;
    
    // Calculs dynamiques
    // Portée : 3m * niveau (10 yards/level)
    const porteeMetres = 3 * niveauLanceur;
    
    // Durée : 5 rounds * niveau
    const dureeRounds = 5 * niveauLanceur;
    
    const durationData = {
        rounds: dureeRounds,
        startRound: game.combat?.round ?? null,
        startTurn: game.combat?.turn ?? null
    };

    // =======================================================
    // 2. CRÉATION EFFET SUR LE LANCEUR
    // =======================================================
    // L'effet permet de voir : Invisible, Astral, Éthéré, Caché
    const effectData = {
        name: "Détection de l’invisibilité",
        icon: sourceItem.img,
        origin: sourceItem.uuid,
        duration: durationData,
        description: "Permet de voir les créatures invisibles, éthérées, astrales ou cachées dans la ligne de vue.",
        flags: { 
            add2e: { 
                tags: [
                    "divination", 
                    "voir_invisible", 
                    "voir_ethere", 
                    "voir_astral",
                    "voir_cache"
                ] 
            } 
        }
    };

    // Si on a un système de détection Foundry V10+ (Vision Modes), on pourrait l'ajouter ici dans 'changes'
    // Pour l'instant on reste sur les tags ADD2E
    
    // Application (Direct ou Socket selon droits)
    if (game.user.isGM || caster.isOwner) {
        await caster.createEmbeddedDocuments("ActiveEffect", [effectData]);
    } else if (game.socket) {
        game.socket.emit("system.add2e", { 
            type: "applyActiveEffect", 
            actorId: caster.id, 
            effectData: effectData 
        });
    }

    // VFX (Optionnel - Sequencer) : Un petit œil magique ou une onde
    if (globalThis.Sequencer) {
        new Sequence()
            .effect()
            .file("jb2a.detect_magic.circle.blue") // Adaptez selon vos assets
            .atLocation(caster)
            .scaleToObject(1.5)
            .fadeIn(500)
            .fadeOut(500)
            .duration(2000)
            .play()
            .catch(e => {});
    }

    // =======================================================
    // 3. MESSAGE CHAT (STYLE UNIFIÉ)
    // =======================================================
    const formatVal = (val) => {
        if (!val) return "-";
        let v = (typeof val === "object") ? (val.valeur || "") : val;
        let u = (typeof val === "object") ? (val.unite || "") : "";
        v = String(v).replace(/@niv(eau)?/gi, niveauLanceur);
        try { v = Function(`return (${v});`)(); } catch {} 
        return `${v} ${u}`.trim();
    };

    const porteeTxt = `${porteeMetres} m`;
    const dureeTxt = `${dureeRounds} rounds`;
    const incant = formatVal(info.temps_incantation);
    
    // Gestion charges (si objet)
    let labelCharge = "";
    let memCount = await sourceItem.getFlag("add2e", "memorizedCount");
    if (memCount !== undefined) {
         labelCharge = `<span style="font-size:0.9em; font-weight:bold; margin-left:5px; color:#2980b9;">Reste : ${memCount}</span>`;
    }

    // Status Box
    const chatStatusHtml = `
    <div style="margin: 5px 0 8px 0; padding: 6px; border-radius: 6px; text-align: center; background: #e8f4fc; border: 1px solid #b6d4fe; color: #2c3e50;">
        <div style="font-weight: bold; font-size: 1.1em; color: #2980b9;">👁️ VISION DÉVOILÉE</div>
        <div style="font-size: 0.85em;">Voit l'Invisible & l'Éthéré</div>
        <div style="font-size: 0.8em; color:#666;">Ligne de vue (3m large)</div>
    </div>`;

    const chatContent = `
    <div class="add2e-spell-card" style="border-radius: 12px; box-shadow: 0 2px 10px #715aab33; background: linear-gradient(100deg, #f8f6fc 90%, #e8def8 100%); border: 1.5px solid #9373c7; margin: 0.3em 0 0.2em 0; max-width: 440px; padding: 0.5em 1.3em 0.5em 1em; font-family: var(--font-primary);">
      
      <div style="display: flex; align-items: center; gap: 0.7em;">
        <img src="${sourceItem.img}" style="width:46px; height:46px; border-radius:7px; box-shadow:0 1px 4px #0002; object-fit:contain;">
        <div style="display:flex; flex-direction:column;">
            <div style="font-size:1.18em; font-weight:bold; color:#6841a2; line-height:1.1;">${sourceItem.name}</div>
            <div style="font-size:0.85em; color:#666;">par ${caster.name}</div>
        </div>
        <span style="margin-left:auto; color:#8e44ad; font-size:0.97em; font-weight:600;">Niv. ${info.niveau || 2}</span>
        ${labelCharge}
      </div>

      ${chatStatusHtml}

      <details style="margin-top:0.2em; background: #eee8fa; border-radius: 6px; border:1px solid #e1d2fb;">
        <summary style="cursor:pointer; color:#6a3c99; font-size:1em; font-weight: 600; padding:4px 8px;">Détails & Description</summary>
        <div style="padding: 0.5em;">
            <table style="width:100%; font-size:0.95em; border-spacing:0; margin-bottom: 8px;">
                <tr><td style="color:#8571a5; font-weight:600; width:90px; padding:2px 0;">Portée</td><td style="color:#222; font-weight:500;">${porteeTxt}</td></tr>
                <tr style="background:rgba(255,255,255,0.5);"><td style="color:#8571a5; font-weight:600; padding:2px 0;">Durée</td><td style="color:#222; font-weight:500;">${dureeTxt}</td></tr>
                <tr><td style="color:#8571a5; font-weight:600; padding:2px 0;">Zone</td><td style="color:#222; font-weight:500;">3m large</td></tr>
                <tr style="background:rgba(255,255,255,0.5);"><td style="color:#8571a5; font-weight:600; padding:2px 0;">Incant.</td><td style="color:#222; font-weight:500;">${incant}</td></tr>
            </table>
            <hr style="border:0; border-top:1px solid #dcd0f0; margin: 0 0 8px 0;">
            <div style="color:#48307a; font-size:0.99em; line-height:1.4;">
                ${info.description || "<em>Aucune description.</em>"}
            </div>
        </div>
      </details>
    </div>`;

    ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: caster }),
        content: chatContent,
        type: CONST.CHAT_MESSAGE_TYPES.OTHER
    });

    return true; 
})();