/**********************************************************************
 * ADD2E — Sort FERMETURE
 * - Action : Pose un cadenas (Token) sur la scène via Warpgate.
 * - Lanceur : Reçoit 1 Effet "Maintien".
 * - Nettoyage : Supprimer l'effet du lanceur supprime le cadenas.
 * - Compatible : Objets & Sorts
 **********************************************************************/

console.log("%c[ADD2E][FERMETURE] Lancement du script", "color: #8e44ad");

return await (async () => {

    // =======================================================
    // 1) INITIALISATION ROBUSTE
    // =======================================================
    let sourceItem = null;
    if (typeof sort !== "undefined" && sort) sourceItem = sort;
    else if (typeof item !== "undefined" && item) sourceItem = item;
    else if (typeof this !== "undefined" && this.documentName === "Item") sourceItem = this;

    // Alias pour le template de chat
    const _item = sourceItem;

    if (!sourceItem) { ui.notifications.error("Script Fermeture : Source introuvable."); return false; }

    const caster = (typeof actor !== "undefined" && actor) ? actor : sourceItem.parent;
    if (!caster) { ui.notifications.warn("Lanceur introuvable."); return false; }

    // --- Fonction de Remboursement (Gestion des charges d'objets) ---
    const refund = async (raison = "") => {
        if (raison) ui.notifications.warn(raison);
        if (sourceItem.type !== "sort") {
            const currentGlobal = sourceItem.getFlag("add2e", "global_charges");
            if (currentGlobal !== undefined) {
                await sourceItem.setFlag("add2e", "global_charges", currentGlobal + 1);
                ui.notifications.info(`Charge restituée à ${sourceItem.name}.`);
            } else if (sourceItem.system.isPower) {
                 const pItem = caster.items.get(sourceItem.system.sourceWeaponId);
                 if (pItem) {
                     const idx = sourceItem.system.powerIndex;
                     const c = pItem.getFlag("add2e", `charges_${idx}`);
                     if (c !== undefined) await pItem.setFlag("add2e", `charges_${idx}`, c + 1);
                     ui.notifications.info(`Charge restituée.`);
                 }
            }
        }
    };

    // =======================================================
    // 2) PARAMÈTRES & PRÉPARATION
    // =======================================================
    const info = sourceItem.system;
    
    // Niveau : Si objet (ex: Baguette), niveau fixe (ex: 6), sinon niveau du lanceur
    let niveauPerso = 1;
    if (sourceItem.type === "sort") {
        niveauPerso = Number(caster.system.niveau) || 1;
    } else {
        niveauPerso = Number(sourceItem.system.niveau) || 6; 
    }

    const dureeRounds = Math.max(1, niveauPerso); // 1 round/niveau

    const durationData = {
        rounds: dureeRounds,
        startRound: game.combat?.round ?? null,
        startTurn: game.combat?.turn ?? null,
        startTime: game.time.worldTime
    };

    // Images
    const lockIcon = "icons/svg/padlock.svg"; 
    const spellIcon = sourceItem.img || "icons/magic/defensive/barrier-shield-dome-blue.webp";

    // =======================================================
    // 3) HOOKS DE NETTOYAGE (La partie magique)
    // =======================================================
    if (!globalThis.add2eFermetureHookRegistered) {
        globalThis.add2eFermetureHookRegistered = true;

        const cleanUpFermeture = async (effect) => {
            // On ne réagit que si l'effet supprimé est celui de Fermeture
            const flagData = effect.flags?.add2e?.fermeturePayload;
            if (!flagData) return;

            console.log(`[ADD2E][FERMETURE] Fin du sort. Suppression du cadenas...`);

            // On supprime le Token Cadenas via son ID stocké
            if (flagData.lockTokenId && canvas.scene) {
                const token = canvas.tokens.get(flagData.lockTokenId);
                if (token) {
                    await token.document.delete();
                    ui.notifications.info("Le blocage magique s'est dissipé.");
                }
            }
        };

        Hooks.on("deleteActiveEffect", cleanUpFermeture);
        Hooks.on("updateActiveEffect", (effect, changes) => {
            if (changes.disabled === true) cleanUpFermeture(effect);
        });
    }

    // =======================================================
    // 4) PLACEMENT DU CADENAS (Warpgate)
    // =======================================================
    if (!game.modules.get("warpgate")?.active) {
        await refund("Le module 'Warpgate' est requis pour ce sort.");
        return false;
    }

    // Curseur "Libre" (interval -1) pour viser exactement sur la porte
    const crosshair = await warpgate.crosshairs.show({
        size: 0.5, 
        icon: lockIcon,
        label: "Bloquer Porte",
        interval: -1, 
        lockSize: true,
        alpha: 0.8
    });

    if (crosshair.cancelled) {
        await refund(); // Annulation = Remboursement
        return false;
    }

    // Création du Token Cadenas
    const tokenData = {
        name: `Fermeture (${caster.name})`,
        img: lockIcon,
        x: crosshair.x - (canvas.grid.size * 0.25), // Centrage manuel
        y: crosshair.y - (canvas.grid.size * 0.25),
        width: 0.5,
        height: 0.5,
        scale: 1,
        disposition: 0, 
        actorId: null,
        texture: { src: lockIcon, scaleX: 1, scaleY: 1 },
        alpha: 0.9,
        lockRotation: true
    };

    const createdTokens = await canvas.scene.createEmbeddedDocuments("Token", [tokenData]);
    const lockTokenId = createdTokens[0]?.id;

    if (!lockTokenId) {
        await refund("Erreur lors de la création du cadenas.");
        return false;
    }

    // =======================================================
    // 5) CRÉATION DE L'EFFET UNIQUE (Sur le Lanceur)
    // =======================================================
    
    // Nettoyage préalable (si on relance, on remplace)
    const existing = caster.effects.find(e => e.name === "Sort : Fermeture (Actif)");
    if (existing) await existing.delete();

    const effectData = {
        name: "Sort : Fermeture (Actif)",
        icon: spellIcon,
        origin: sourceItem.uuid,
        duration: durationData,
        description: `Maintient une porte fermée. Durée: ${dureeRounds} rounds.`,
        flags: { 
            add2e: { 
                fermeturePayload: {
                    lockTokenId: lockTokenId // C'est ce lien qui permet le nettoyage
                }
            } 
        }
    };

    // On crée l'effet sur le lanceur
    await caster.createEmbeddedDocuments("ActiveEffect", [effectData]);

    // =======================================================
    // 6) MESSAGE CHAT (STYLE STANDARDISÉ VIOLET)
    // =======================================================
    const formatVal = (val) => {
        if (typeof globalThis.formatSortChamp === "function") return globalThis.formatSortChamp(val, niveauPerso);
        if (typeof val === "object" && val !== null) return (val.valeur || "") + " " + (val.unite || "");
        return val || "-";
    };

    const detailsData = [
        { label: "École",    val: info.categorie || info.ecole || "Altération" },
        { label: "Portée",   val: formatVal(info.portee) },
        { label: "Durée",    val: `${dureeRounds} rounds` },
        { label: "Zone",     val: formatVal(info.zone_effet) },
        { label: "Incant.",  val: formatVal(info.temps_incantation) }
    ];

    const chatContent = `
      <div class="add2e-spell-card" style="border-radius:12px; box-shadow:0 4px 10px #715aab44; background:linear-gradient(135deg, #fdfbfd 0%, #f4efff 100%); border:1.5px solid #9373c7; margin:0.3em 0; padding:0; font-family:var(--font-primary); overflow:hidden;">
        
        <div style="background:linear-gradient(90deg, #6a3c99 0%, #8e44ad 100%); padding:8px 12px; display:flex; align-items:center; gap:10px; color:white; border-bottom:2px solid #5e35b1;">
          <img src="${caster.img}" style="width:36px; height:36px; border-radius:50%; border:2px solid #fff; object-fit:cover;">
          <div style="line-height:1.2;">
            <div style="font-weight:bold; font-size:1.05em;">${caster.name}</div>
            <div style="font-size:0.85em; opacity:0.9;">lance <span style="font-weight:bold; color:#f1c40f;">${_item.name}</span></div>
          </div>
          <img src="${spellIcon}" style="width:32px; height:32px; margin-left:auto; border-radius:4px; background:#fff;">
        </div>

        <div style="padding:10px 10px 5px 10px;">
          
          <div style="background:#eafaf1; border:1px solid #ccebd9; border-radius:6px; padding:6px; text-align:center; margin-bottom:8px;">
            <span style="color:#27ae60; font-weight:bold; font-size:1.1em;">🔒 Porte Bloquée</span>
            <div style="font-size:0.85em; color:#555; margin-top:2px;">Durée : ${dureeRounds} rds</div>
          </div>

          <details style="background:#fff; border:1px solid #e0d4fc; border-radius:6px;">
            <summary style="cursor:pointer; color:#6a3c99; font-weight:600; font-size:0.9em; padding:6px 10px; background:#efe9f6; border-radius:6px; list-style:none;">
              📜 Voir détails & description
            </summary>
            <div style="padding:8px;">
              <table style="width:100%; font-size:0.85em; border-spacing:0; margin-bottom:10px; color:#333; border-bottom:1px solid #eee;">
                ${detailsData.map((d, i) => `
                  <tr style="${i % 2 === 0 ? 'background:#f8f6fa;' : ''}">
                    <td style="color:#6a3c99; font-weight:600; padding:2px 5px; width:40%;">${d.label}</td>
                    <td style="text-align:right; padding:2px 5px;">${d.val}</td>
                  </tr>`).join("")}
              </table>
              <div style="color:#4a3b69; font-size:0.9em; line-height:1.4; text-align:justify;">
                <b>Description :</b><br>
                ${info.description || "<em>Aucune description.</em>"}
              </div>
            </div>
          </details>
        </div>
      </div>
    `;

    ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: caster }),
        content: chatContent,
        type: CONST.CHAT_MESSAGE_TYPES.OTHER
    });

    return true;

})();