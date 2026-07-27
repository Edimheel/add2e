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
    // 6) MESSAGE CHAT COMMUN
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

    const build = globalThis.add2eBuildChatCard;
    const create = globalThis.add2eCreateChatCard;
    if (typeof build !== "function" || typeof create !== "function") {
        throw new Error("Les constructeurs communs de cartes ADD2E sont indisponibles.");
    }
    const card = {
        actor: caster,
        title: _item.name,
        icon: "fas fa-lock",
        variant: "spell",
        source: {
            name: caster.name,
            img: caster.img,
            type: "Sort d’altération"
        },
        rows: detailsData.map(detail => ({ label: detail.label, value: detail.val })),
        trustedBodyHtml: `<p style="text-align:center;"><b>Porte bloquée</b></p><p style="text-align:center;">Durée : ${dureeRounds} rounds.</p><details><summary>Description</summary><div style="padding-top:6px;">${info.description || "<em>Aucune description.</em>"}</div></details>`,
        chatData: {
            speaker: ChatMessage.getSpeaker({ actor: caster })
        }
    };
    build(card);
    await create(card);

    return true;

})();
