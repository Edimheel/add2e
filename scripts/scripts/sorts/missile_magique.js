return await (async () => {

    // ==============================================================
    // 1. INITIALISATION
    // ==============================================================
    
    // Récupération intelligente
    // item = Le Vrai Sort (pour les infos)
    // sourceRef = L'origine (Le pouvoir de la Badine, ou le sort lui-même)
    let spellData = typeof item !== "undefined" ? item : null;
    let sourceRef = typeof sort !== "undefined" ? sort : spellData;
    
    // Fallback si lancé hors contexte standard
    if (!spellData && typeof this !== "undefined" && this.documentName === "Item") {
        spellData = this;
        sourceRef = this;
    }

    if (!spellData) { ui.notifications.error("Sort introuvable."); return false; }

    // --- FONCTION DE REMBOURSEMENT ---
    const refund = async (raison = "") => {
        if (raison) ui.notifications.warn(raison);
        
        // Est-ce un pouvoir d'objet ? (Badine, Bâton...)
        if (sourceRef && sourceRef.system.isPower && sourceRef.system.sourceWeaponId) {
            const weapon = actor.items.get(sourceRef.system.sourceWeaponId);
            if (weapon) {
                // Remboursement Charge Globale
                const currentGlobal = weapon.getFlag("add2e", "global_charges");
                if (currentGlobal !== undefined) {
                    await weapon.setFlag("add2e", "global_charges", currentGlobal + 1);
                    console.log(`[Missile Magique] Charge remboursée sur ${weapon.name}`);
                    ui.notifications.info(`Charge restituée à ${weapon.name}.`);
                }
                // Remboursement Charge Individuelle (si configuré ainsi)
                else {
                    const idx = sourceRef.system.powerIndex;
                    const currentIndiv = weapon.getFlag("add2e", `charges_${idx}`);
                    if (currentIndiv !== undefined) {
                        await weapon.setFlag("add2e", `charges_${idx}`, currentIndiv + 1);
                        ui.notifications.info(`Charge restituée.`);
                    }
                }
            }
        }
    };

    if (typeof add2eApplyDamage !== "function") { 
        await refund("Système add2e non chargé."); 
        return false; 
    }

    // --- CALCUL NOMBRE MISSILES ---
    let casterLevel = 1;
    
    // Si c'est un pouvoir, on regarde s'il a un niveau défini, sinon niveau du lanceur
    if (sourceRef && sourceRef.system.isPower) {
        casterLevel = sourceRef.system.niveau || 1;
        // Optionnel : Si vous voulez que la Badine utilise le niveau du magicien :
        // casterLevel = actor.system.niveau || 1; 
    } else {
        casterLevel = actor.system.details_classe?.magicien?.niveau || actor.system.niveau || 1;
    }
    
    const nbMissiles = 1 + Math.floor((casterLevel - 1) / 2);

    // ==============================================================
    // 2. CIBLAGE (Mode "Warpzone")
    // ==============================================================
    
    let candidates = Array.from(game.user.targets);
    
    // Si pas de cible : On propose TOUS les ennemis visibles
    if (candidates.length === 0) {
        candidates = canvas.tokens.placeables.filter(t => t.visible && t.actor && t.id !== (actor.token?.id));
        if (candidates.length === 0) {
            await refund("Aucune cible visible à portée.");
            return false;
        }
    }

    // --- INTERFACE DIALOGUE ---
    let content = `
    <div style="font-family:var(--font-primary);">
        <div style="text-align:center; margin-bottom:10px; color:#4a148c;">
            <img src="${spellData.img}" width="32" height="32" style="vertical-align:middle; margin-right:5px; border-radius:4px;">
            <b>${nbMissiles}</b> Missile${nbMissiles > 1 ? 's' : ''} à répartir
        </div>
        <form class="missile-form">
    `;

    // Répartition par défaut (1 par cible max au début)
    let defaultVal = Math.floor(nbMissiles / candidates.length) || 0;
    let remainder = nbMissiles % candidates.length;

    candidates.forEach((t, i) => {
        let val = defaultVal + (i < remainder ? 1 : 0);
        if (game.user.targets.size > 0 && i < nbMissiles) val = Math.max(1, val);

        content += `
        <div style="display:flex; align-items:center; margin-bottom:4px; background:#f3e5f5; padding:4px; border-radius:4px;">
            <img src="${t.document.texture.src}" width="28" height="28" style="margin-right:8px; border:1px solid #aaa; background:#fff;">
            <label style="flex:1; font-weight:600; font-size:0.9em;">${t.name}</label>
            <input type="number" data-id="${t.id}" min="0" max="${nbMissiles}" value="${val}" style="width:40px; text-align:center; font-weight:bold;">
        </div>`;
    });
    content += `</form></div>`;

    const distribution = await new Promise(resolve => {
        new Dialog({
            title: "Missiles Magiques",
            content: content,
            buttons: {
                fire: {
                    label: `<i class="fas fa-magic"></i> FEU !`,
                    callback: (html) => {
                        let result = {};
                        let totalAssigné = 0;
                        
                        html.find('input[type="number"]').each((i, el) => {
                            const tid = $(el).data("id");
                            const val = Number($(el).val()) || 0;
                            if (val > 0) {
                                result[tid] = val;
                                totalAssigné += val;
                            }
                        });

                        if (totalAssigné === 0) {
                            ui.notifications.warn("Aucun missile assigné !");
                            return resolve(null);
                        }
                        if (totalAssigné > nbMissiles) {
                            ui.notifications.warn(`Trop de missiles ! (Max: ${nbMissiles})`);
                            return resolve(null);
                        }
                        resolve(result);
                    }
                },
                cancel: { label: "Annuler", callback: () => resolve(null) }
            },
            default: "fire",
            close: () => resolve(null)
        }).render(true);
    });

    if (!distribution) {
        await refund(); // Remboursement si annulation
        return false;
    }

    // ==============================================================
    // 3. TIR & DÉGÂTS
    // ==============================================================
    
    let missilesSummary = [];
    const sourceToken = actor.token?.object || actor.getActiveTokens()[0] || null;

    for (let [tokenId, count] of Object.entries(distribution)) {
        const targetToken = canvas.tokens.get(tokenId);
        if (!targetToken) continue;
        const targetActor = targetToken.actor;

        // Immunité (Shield/Bouclier)
        let isImmune = false;
        if (targetActor.effects) {
             for (let e of targetActor.effects) {
                 const tags = e.flags?.add2e?.tags || [];
                 if (tags.includes("immunite:missile_magique") || tags.includes("bouclier")) isImmune = true;
                 if ((e.name||"").toLowerCase().includes("bouclier")) isImmune = true;
             }
        }

        if (isImmune) {
             missilesSummary.push({ name: targetToken.name, nb: count, dmg: 0, rolls: ["Immunisé"] });
             continue;
        }

        let rolls = [];
        let dmgTotal = 0;

        for (let i = 0; i < count; i++) {
            // VFX (JB2A)
            if (typeof Sequence !== "undefined" && sourceToken) {
                // Chemin via Database Sequencer (Compatible Free/Patreon)
                new Sequence()
                    .effect()
                    .file("jb2a.magic_missile.purple") 
                    .atLocation(sourceToken)
                    .stretchTo(targetToken)
                    .randomizeMirrorY()
                    .startTime(i * 200)
                    .missed(false)
                    .play()
                    .catch(e => {}); 
            }

            // Dégâts
            let r = new Roll("1d4+1");
            await r.evaluate();
            rolls.push(r.total);
            dmgTotal += r.total;
        }

        // Application
        await add2eApplyDamage({
            cible: targetActor,
            montant: dmgTotal,
            source: "Missile Magique",
            lanceur: actor,
            type: "force",
            silent: true
        });

        missilesSummary.push({ name: targetToken.name, nb: count, dmg: dmgTotal, rolls: rolls });
    }

    // ==============================================================
    // 4. CHAT
    // ==============================================================
    let rows = missilesSummary.map(m => `
        <tr style="border-bottom:1px solid #eee;">
            <td style="padding:4px; font-weight:bold; color:#4a148c;">${m.name}</td>
            <td style="text-align:center;">${m.nb}</td>
            <td style="font-size:0.85em; color:#666;">${m.rolls.join("+")}</td>
            <td style="text-align:right; font-weight:bold; color:#c0392b;">${m.dmg}</td>
        </tr>
    `).join("");

    let chatHtml = `
    <div class="add2e-spell-card" style="border:1px solid #8e44ad; border-radius:8px; overflow:hidden; font-family:var(--font-primary); background:#fff;">
        <div style="background:linear-gradient(135deg, #7b1fa2, #4a148c); color:white; padding:6px 10px; font-weight:bold; display:flex; align-items:center;">
            <img src="${spellData.img}" width="24" height="24" style="margin-right:8px; border:1px solid #fff; border-radius:4px;">
            ${spellData.name}
        </div>
        <div style="padding:5px; background:#f3e5f5; font-size:0.9em; text-align:center; border-bottom:1px solid #e1bee7;">
            Lancement de <b>${nbMissiles}</b> missiles de force !
        </div>
        <table style="width:100%; border-collapse:collapse; font-size:0.9em;">
            <tr style="background:#eee; color:#555;">
                <th style="text-align:left; padding:4px;">Cible</th>
                <th>Qté</th>
                <th>Dés</th>
                <th style="text-align:right;">Dégâts</th>
            </tr>
            ${rows}
        </table>
    </div>`;

    ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: chatHtml
    });

    return true;

})();