/**
 * ADD2E — Sort BRUITAGE (Version Autonome)
 * - Placement : Gabarit de zone (Source sonore) à portée.
 * - Effet : Sur le Lanceur (Maintenu).
 * - Nettoyage : Suppression du gabarit à la fin de l'effet.
 * - Style : Chat Unifié.
 */

console.log("%c[ADD2E][BRUITAGE] Lancement du script", "color: #9b59b6; font-weight:bold;");

return await (async () => {

    // =======================================================
    // 1. INITIALISATION
    // =======================================================
    let sourceItem = (typeof item !== "undefined" && item) ? item : ((typeof sort !== "undefined" && sort) ? sort : this);
    
    // Fallback contextuel
    if (!sourceItem || !sourceItem.system) {
        if (typeof args !== "undefined" && args[0]?.item) sourceItem = args[0].item;
    }

    if (!sourceItem) return ui.notifications.error("Sort introuvable.");

    const caster = sourceItem.parent || actor;
    if (!caster) return ui.notifications.error("Lanceur introuvable.");

    // --- Paramètres du sort ---
    const info = sourceItem.system;
    const niveauLanceur = Number(caster.system.niveau) || 1;
    
    // Calcul Portée : 18m + 0.3m/niveau (Formule JSON)
    const porteeMetres = 18 + (0.3 * niveauLanceur);
    
    // Calcul Durée : 2 rounds / niveau
    const dureeRounds = 2 * niveauLanceur;
    
    // Calcul Volume Sonore (Règle AD&D : 4 hommes au niv 3, +4 par niveau)
    // Formule : 4 * (Niveau - 2). Minimum 4 (si lancé par un niveau 2 spécialiste).
    let volumeHommes = Math.max(4, 4 * (niveauLanceur - 2));
    
    const durationData = {
        rounds: dureeRounds,
        startRound: game.combat?.round ?? null,
        startTurn: game.combat?.turn ?? null
    };

    // =======================================================
    // 2. HOOKS DE NETTOYAGE (INTEGRÉS)
    // =======================================================
    if (!globalThis.add2eBruitageHookRegistered) {
        globalThis.add2eBruitageHookRegistered = true;

        const cleanUpBruitage = async (effect) => {
            const flagData = effect.flags?.add2e?.bruitagePayload;
            if (!flagData) return;

            // Nettoyage du Template (Zone au sol)
            if (flagData.templateId && canvas.scene) {
                const template = canvas.scene.templates.get(flagData.templateId);
                if (template) {
                    await canvas.scene.deleteEmbeddedDocuments("MeasuredTemplate", [flagData.templateId]);
                    console.log(`[ADD2e] Illusion sonore dissipée.`);
                }
            }
            
            // Nettoyage Sequencer (si VFX utilisé)
            if (globalThis.Sequencer) {
                Sequencer.EffectManager.endEffects({ origin: effect.uuid });
            }
        };

        Hooks.on("deleteActiveEffect", cleanUpBruitage);
        Hooks.on("updateActiveEffect", (effect, changes) => {
            if (changes.disabled === true) cleanUpBruitage(effect);
        });
    }

    // =======================================================
    // 3. PLACEMENT DE LA ZONE (TEMPLATE)
    // =======================================================
    // Note : La zone d'effet est "Portée d'ouïe", ce qui est trop grand pour un gabarit.
    // On place donc un gabarit "Marqueur" de 3m pour symboliser la SOURCE du bruit.
    
    ui.notifications.info("Placez la source du bruitage...");

    const templateData = {
        t: "circle",
        user: game.user.id,
        distance: 3, // Rayon visuel de la source (3m)
        direction: 0,
        x: 0,
        y: 0,
        fillColor: "#9b59b6",
        flags: { add2e: { type: "bruitage" } }
    };

    // Utilisation de Warpgate si dispo pour meilleure expérience, sinon Core Foundry
    let createdTemplateId = null;

    if (game.modules.get("warpgate")?.active) {
        const result = await warpgate.crosshairs.show({
            size: 1,
            icon: "icons/svg/sound.svg",
            label: "Source Bruitage",
            range: porteeMetres
        });

        if (result.cancelled) return false;

        templateData.x = result.x;
        templateData.y = result.y;
        
        const created = await canvas.scene.createEmbeddedDocuments("MeasuredTemplate", [templateData]);
        createdTemplateId = created[0].id;

    } else {
        // Méthode Core (TemplateLayer)
        const doc = new CONFIG.MeasuredTemplate.documentClass(templateData, {parent: canvas.scene});
        const template = new game.dnd5e.canvas.AbilityTemplate(doc); // Ou adaptation générique selon système
        // Fallback générique si système custom sans classe AbilityTemplate exposée :
        // On crée simplement le template au curseur ou on demande un clic (plus complexe sans warpgate en script pur)
        // Simplification : Création directe au centre de l'écran ou sur le curseur si possible, 
        // mais pour un script chat, Warpgate est fortement recommandé.
        // ICI : On simule une création simple.
        
        ui.notifications.warn("Module Warpgate non détecté : Création du gabarit sur le lanceur (à déplacer).");
        const t = caster.getActiveTokens()[0] || {center: {x:0,y:0}};
        templateData.x = t.center.x;
        templateData.y = t.center.y;
        const created = await canvas.scene.createEmbeddedDocuments("MeasuredTemplate", [templateData]);
        createdTemplateId = created[0].id;
    }

    if (!createdTemplateId) return false;

    // =======================================================
    // 4. CRÉATION EFFET SUR LE LANCEUR
    // =======================================================
    const effectData = {
        name: "Bruitage (Maintenu)",
        icon: sourceItem.img,
        origin: sourceItem.uuid,
        duration: durationData,
        description: `Maintient l'illusion sonore (Volume : ${volumeHommes} hommes).`,
        flags: { 
            add2e: { 
                bruitagePayload: { 
                    templateId: createdTemplateId,
                    volume: volumeHommes
                } 
            } 
        }
    };

    await caster.createEmbeddedDocuments("ActiveEffect", [effectData]);

    // =======================================================
    // 5. MESSAGE CHAT (STYLE UNIFIÉ)
    // =======================================================
    const formatVal = (val) => {
        if (!val) return "-";
        let v = (typeof val === "object") ? (val.valeur || "") : val;
        let u = (typeof val === "object") ? (val.unite || "") : "";
        v = String(v).replace(/@niv(eau)?/gi, niveauLanceur);
        try { v = Function(`return (${v});`)(); } catch {} 
        return `${v} ${u}`.trim();
    };

    const porteeTxt = `${Math.floor(porteeMetres)} m`; // Valeur calculée
    const dureeTxt = formatVal(info.duree);
    const incant = formatVal(info.temps_incantation);
    
    // Gestion charges
    let labelCharge = "";
    let memCount = await sourceItem.getFlag("add2e", "memorizedCount");
    if (memCount !== undefined) {
         labelCharge = `<span style="font-size:0.9em; font-weight:bold; margin-left:5px; color:#2980b9;">Reste : ${memCount}</span>`;
    }

    // Contenu HTML spécifique Bruitage
    const chatStatusHtml = `
    <div style="margin: 5px 0 8px 0; padding: 6px; border-radius: 6px; text-align: center; background: #f4efff; border: 1px solid #e0d4fc; color: #8e44ad;">
        <div style="font-weight: bold; font-size: 1.1em;">🔊 ILLUSION SONORE</div>
        <div style="font-size: 0.85em;">Volume max : <b>${volumeHommes} hommes</b></div>
        <div style="font-size: 0.8em; color:#666;">Source placée au sol</div>
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
                <tr><td style="color:#8571a5; font-weight:600; padding:2px 0;">Zone</td><td style="color:#222; font-weight:500;">Portée d'ouïe</td></tr>
                <tr style="background:rgba(255,255,255,0.5);"><td style="color:#8571a5; font-weight:600; padding:2px 0;">Incant.</td><td style="color:#222; font-weight:500;">${incant}</td></tr>
            </table>
            <hr style="border:0; border-top:1px solid #dcd0f0; margin: 0 0 8px 0;">
            <div style="color:#48307a; font-size:0.99em; line-height:1.4;">
                <b>Effet :</b> Le volume sonore dépend du niveau (${volumeHommes} hommes max). Permet chants, cris, bruits de pas, rugissements...<br><br>
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