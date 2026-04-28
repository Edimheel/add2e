/**
 * ADD2E — Sort ESP (Lecture de Pensées)
 * - Cible : Lanceur (Self).
 * - Effet : Active Effect (Concentration) + Aura Visuelle Jaune.
 * - Style : Norme Violette Compacte (Identique Agrandissement/Lumière).
 */

console.log("%c[ADD2E][ESP] Lancement Script V2", "color: #f1c40f; font-weight:bold;");

return await (async () => {

    // =======================================================
    // 1. INITIALISATION
    // =======================================================
    // Récupération robuste de l'item
    let sourceItem = (typeof item !== "undefined" && item) ? item : ((typeof sort !== "undefined" && sort) ? sort : this);
    
    // Fallback si lancé depuis la barre de macro sans contexte
    if (!sourceItem || !sourceItem.system) {
        if (typeof args !== "undefined" && args[0]?.item) sourceItem = args[0].item;
    }

    if (!sourceItem) return ui.notifications.error("Sort introuvable.");

    const caster = sourceItem.parent || actor;
    if (!caster) return ui.notifications.error("Lanceur introuvable.");

    // --- Paramètres ---
    const info = sourceItem.system;
    const niveauLanceur = Number(caster.system.niveau) || 1;
    
    // Portée : 1.5m / niveau (Max 27m)
    const porteeCalc = 1.5 * niveauLanceur;
    const porteeMetres = Math.min(27, porteeCalc);
    
    // Durée : 1 round / niveau
    const dureeRounds = niveauLanceur;
    
    const durationData = {
        rounds: dureeRounds,
        startRound: game.combat?.round ?? null,
        startTurn: game.combat?.turn ?? null
    };

    // =======================================================
    // 2. HOOKS DE NETTOYAGE (INTEGRÉS)
    // =======================================================
    if (!globalThis.add2eESPHookRegistered) {
        globalThis.add2eESPHookRegistered = true;

        const cleanUpESP = async (effect) => {
            const flagData = effect.flags?.add2e?.espPayload;
            if (!flagData) return;

            // Arrêt de l'effet visuel Sequencer
            if (globalThis.Sequencer && flagData.sequencerId) {
                Sequencer.EffectManager.endEffects({ name: flagData.sequencerId });
            }
        };

        Hooks.on("deleteActiveEffect", cleanUpESP);
        Hooks.on("updateActiveEffect", (effect, changes) => {
            if (changes.disabled === true) cleanUpESP(effect);
        });
    }

    // =======================================================
    // 3. EFFET VISUEL (AURA JAUNE)
    // =======================================================
    const seqName = `ESP-Aura-${caster.id}-${game.time.worldTime}`;
    
    if (globalThis.Sequencer) {
        new Sequence()
            .effect()
            .file("modules/JB2A_DnD5e/Library/Generic/Energy/Shimmer01_01_Regular_Blue_400x400.webm") 
            .attachTo(caster)
            .scaleToObject(1.5)
            .persist()
            .name(seqName)
            .fadeIn(500)
            .fadeOut(500)
            .play()
            .catch(e => {});
    }

    // =======================================================
    // 4. CRÉATION EFFET SUR LE LANCEUR
    // =======================================================
    const effectData = {
        name: "ESP (Lecture de pensées)",
        icon: sourceItem.img || "systems/add2e/assets/icones/sorts/esp.webp",
        origin: sourceItem.uuid,
        duration: durationData,
        description: "Peut sonder les pensées de surface (1 créature/round). Bloqué par le plomb.",
        flags: { 
            add2e: { 
                tags: ["divination", "lecture_pensee"],
                espPayload: { sequencerId: seqName }
            } 
        }
    };

    // Application stricte sur le LANCEUR
    if (game.user.isGM || caster.isOwner) {
        await caster.createEmbeddedDocuments("ActiveEffect", [effectData]);
    } else if (game.socket) {
        game.socket.emit("system.add2e", { 
            type: "applyActiveEffect", 
            actorId: caster.id, 
            effectData: effectData 
        });
    }

    // =======================================================
    // 5. MESSAGE CHAT (NORME VIOLETTE STRICTE)
    // =======================================================
    const formatVal = (val) => {
        if (!val) return "-";
        let v = (typeof val === "object") ? (val.valeur || "") : val;
        let u = (typeof val === "object") ? (val.unite || "") : "";
        v = String(v).replace(/@niv(eau)?/gi, niveauLanceur);
        try { v = Function(`return (${v});`)(); } catch {} 
        return `${v} ${u}`.trim();
    };

    const porteeTxt = `${Math.floor(porteeMetres)} m`;
    const dureeTxt = `${dureeRounds} rounds`;
    const incant = formatVal(info.temps_incantation);
    
    // Récupération des charges (via le patch du système si lancé depuis un objet)
    let labelCharge = "";
    let memCount = await sourceItem.getFlag("add2e", "memorizedCount");
    if (memCount !== undefined) {
         labelCharge = `<span style="font-size:0.9em; font-weight:bold; margin-left:5px; color:#2980b9;">Reste : ${memCount}</span>`;
    }

    // Boîte de Statut (Style Jaune pour Divination/Mental)
    const chatStatusHtml = `
    <div style="margin: 5px 0 8px 0; padding: 6px; border-radius: 6px; text-align: center; background: #fff9c4; border: 1px solid #f9e79f; color: #d4ac0d;">
        <div style="font-weight: bold; font-size: 1.1em;">🧠 ESP ACTIF</div>
        <div style="font-size: 0.85em;">Sonde 1 esprit / round</div>
    </div>`;

    const chatContent = `
    <div class="add2e-spell-card" style="
      border-radius: 12px;
      box-shadow: 0 2px 10px #715aab33;
      background: linear-gradient(100deg, #f8f6fc 90%, #e8def8 100%);
      border: 1.5px solid #9373c7;
      margin: 0.3em 0 0.2em 0;
      max-width: 440px;
      padding: 0.5em 1.3em 0.5em 1em;
      font-family: var(--font-primary);
    ">
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
                <tr><td style="color:#8571a5; font-weight:600; padding:2px 0;">Cible</td><td style="color:#222; font-weight:500;">1 créature/round</td></tr>
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