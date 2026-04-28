// Charme-Personne.js
// Compatible : Sorts, Objets (Bâton, Anneau...)
// Effet : "Charmé" + VFX JB2A

return await (async () => {

    // ======================================================
    // 1. INITIALISATION ROBUSTE
    // ======================================================
    let sourceItem = null;
    if (typeof sort !== "undefined" && sort) sourceItem = sort;
    else if (typeof item !== "undefined" && item) sourceItem = item;
    else if (typeof this !== "undefined" && this.documentName === "Item") sourceItem = this;
    // Fallback arguments (macro)
    if (!sourceItem && typeof arguments !== "undefined" && arguments.length > 1 && arguments[1]?.name) sourceItem = arguments[1];

    if (!sourceItem) {
        ui.notifications.error("Script Charme : Source introuvable.");
        return false;
    }

    const caster = (typeof actor !== "undefined" && actor) ? actor : sourceItem.parent;
    if (!caster) {
        ui.notifications.error("Lanceur introuvable.");
        return false;
    }

    // --- Fonction de Remboursement des charges ---
    const refund = async (raison = "") => {
        if (raison) ui.notifications.warn(raison);
        if (sourceItem.type !== "sort") {
            // Charge Globale
            const currentGlobal = sourceItem.getFlag("add2e", "global_charges");
            if (currentGlobal !== undefined) {
                await sourceItem.setFlag("add2e", "global_charges", currentGlobal + 1);
                ui.notifications.info(`Charge restituée à ${sourceItem.name}.`);
            } 
            // Charge par Pouvoir
            else if (sourceItem.system.isPower) {
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

    // ======================================================
    // 2. CIBLAGE
    // ======================================================
    const targets = Array.from(game.user.targets);
    if (targets.length === 0) {
        await refund("Vous devez cibler une créature.");
        return false;
    }

    // ======================================================
    // 3. HOOKS GLOBAUX (Nettoyage VFX)
    // ======================================================
    if (!game.add2eCharmeHooksRegistered) {
        game.add2eCharmeHooksRegistered = true;

        const endCharmeVfx = (effect) => {
            const label = (effect.label || effect.name || "").toLowerCase();
            if (!label.includes("charmé") && !label.includes("charme")) return;

            const effActor = effect.parent;
            if (!effActor) return;

            const tokens = effActor.getActiveTokens?.() || [];
            for (const token of tokens) {
                const visName = `charme-effect-${token.id}`;
                if (typeof Sequencer !== "undefined") {
                    Sequencer.EffectManager.endEffects({ name: visName, object: token });
                }
            }
        };

        Hooks.on("deleteActiveEffect", endCharmeVfx);
        Hooks.on("updateActiveEffect", (effect, changes) => {
            if (changes.disabled === true) endCharmeVfx(effect);
        });
    }

    // ======================================================
    // 4. RÉSOLUTION
    // ======================================================
    let iconImg = sourceItem.img || "icons/svg/mystery-man.svg";

    for (const token of targets) {
        const targetActor = token.actor;
        if (!targetActor) continue;

        // --- A. Ajustement Sagesse ---
        let wisBonus = 0;
        if (targetActor.system.sagesse >= 15) wisBonus = (targetActor.system.sagesse - 14);

        // --- B. Valeur de Sauvegarde ---
        let saveValue = 15;
        if (targetActor.system.sauvegardes?.sorts) {
            saveValue = Number(targetActor.system.sauvegardes.sorts);
        } else {
            const cls = targetActor.items.find(i => i.type === "classe");
            if (cls?.system?.progression?.[(targetActor.system.niveau||1)-1]?.savingThrows) {
                saveValue = cls.system.progression[(targetActor.system.niveau||1)-1].savingThrows[4];
            }
        }

        // --- C. Jet de Dé ---
        const roll = new Roll("1d20");
        await roll.evaluate();
        if (game.dice3d) await game.dice3d.showForRoll(roll);
        
        const success = (roll.total + wisBonus) >= saveValue;

        let chatContent = "";
        
        if (success) {
            // -- SAUVEGARDE RÉUSSIE --
            chatContent = `
            <div style="border:1px solid #27ae60; background:#eafaf1; padding:5px; border-radius:5px; text-align:center; margin-bottom:5px;">
                <div style="color:#27ae60; font-weight:bold;">🛡️ RÉSISTE AU CHARME</div>
                <div style="font-size:0.9em;">Jet : <b>${roll.total}</b> ${wisBonus?`(+${wisBonus} Sag)`:''} vs <b>${saveValue}</b></div>
            </div>`;
        } else {
            // -- ÉCHEC : EFFET + ANIMATION --
            chatContent = `
            <div style="border:1px solid #c0392b; background:#fdedec; padding:5px; border-radius:5px; text-align:center; margin-bottom:5px;">
                <div style="color:#c0392b; font-weight:bold;">💖 CHARMÉ !</div>
                <div style="font-size:0.9em;">Jet : <b>${roll.total}</b> vs <b>${saveValue}</b></div>
                <div style="font-size:0.85em; font-style:italic; margin-top:3px;">La cible considère le lanceur comme son ami.</div>
            </div>`;

            // 1. Suppression ancien effet (Anti-doublon)
            const existing = targetActor.effects.find(e => e.name === "Charmé" || (e.flags?.add2e?.tags||[]).includes("charme"));
            if (existing) await existing.delete();

            // 2. Création Effet "ActiveEffect"
            const effectData = {
                name: "Charmé",
                icon: "icons/svg/status/heart.svg", // Icône Core standard
                origin: sourceItem.uuid,
                duration: { seconds: 3600 }, // 1 heure
                disabled: false,
                flags: { add2e: { tags: ["charme", "mental"], sourceId: caster.id } }
            };
            
            await targetActor.createEmbeddedDocuments("ActiveEffect", [effectData]);
            
            // 3. ANIMATION PERSISTANTE JB2A (Sequencer)
            if (typeof Sequence !== "undefined") {
                // On coupe toute animation précédente sur ce token
                Sequencer.EffectManager.endEffects({ name: `charme-effect-${token.id}`, object: token });

                new Sequence()
                    .effect()
                        .file("jb2a.cast_generic.02.blue") // Effet demandé
                        .attachTo(token)
                        .persist(true) // Reste tant que l'effet est actif
                        .name(`charme-effect-${token.id}`)
                        .scaleToObject(1.5)
                        .opacity(0.8)
                        .belowTokens(false)
                    .play()
                    .catch(e => console.warn("[Charme] Erreur Sequencer", e));
            }
        }

        // --- D. Message Chat ---
        ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: caster }),
            content: `
            <div class="add2e-spell-card" style="border-radius:12px; box-shadow:0 4px 10px #9b59b644; background:linear-gradient(135deg, #fff0fa 0%, #f3e5f5 100%); border:1.5px solid #9b59b6; margin:0.3em 0; padding:0; font-family:var(--font-primary); overflow:hidden;">
                <div style="background:linear-gradient(90deg, #8e44ad 0%, #9b59b6 100%); padding:8px 12px; display:flex; align-items:center; gap:10px; color:white; border-bottom:2px solid #6c3483;">
                    <img src="${caster.img}" style="width:36px; height:36px; border-radius:50%; border:2px solid #fff; object-fit:cover;">
                    <div style="line-height:1.2;">
                        <div style="font-weight:bold; font-size:1.05em;">${caster.name}</div>
                        <div style="font-size:0.85em; opacity:0.9;">active <span style="font-weight:bold; color:#f1c40f;">${sourceItem.name}</span></div>
                    </div>
                    <img src="${iconImg}" style="width:32px; height:32px; margin-left:auto; border-radius:4px; background:#fff;">
                </div>

                <div style="padding:10px;">
                    <div style="margin-bottom:5px; font-size:0.95em; color:#4a235a;"><b>Cible :</b> ${targetActor.name}</div>
                    ${chatContent}
                </div>
            </div>`
        });
    }

    return true;
})();