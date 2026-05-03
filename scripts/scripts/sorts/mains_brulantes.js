/**
 * Script : Mains Brûlantes
 * - Origine VFX : Verrouillée sur le centre du Token
 * - Zone : Cône 120° (2 cases)
 * - Ciblage : Tolérant (Multipoint)
 * - Chat : Violet Strict
 */

console.log("%c[ADD2E][MAINS BRÛLANTES] V12 - VFX Centre", "color: #8e44ad; font-weight:bold;");

return await (async () => {

    try {
        // ==============================================================
        // 1. INITIALISATION
        // ==============================================================
        let sourceItem = null;
        if (typeof sort !== "undefined" && sort) sourceItem = sort;
        else if (typeof item !== "undefined" && item) sourceItem = item;
        if (!sourceItem && typeof this !== "undefined" && this.documentName === "Item") sourceItem = this;

        const _item = sourceItem;

        if (!sourceItem) { ui.notifications.error("ERREUR : Source introuvable."); return false; }

        const caster = (typeof actor !== "undefined" && actor) ? actor : sourceItem.parent;
        if (!caster) { ui.notifications.error("ERREUR : Lanceur introuvable."); return false; }

        // Récupération Token
        let tokenPlaceable = caster.token?.object;
        if (!tokenPlaceable) {
            const tokens = caster.getActiveTokens();
            if (tokens.length > 0) tokenPlaceable = tokens[0];
        }

        if (!tokenPlaceable) {
            ui.notifications.error("Il faut un token sur la scène pour lancer ce sort !");
            return false;
        }

        if (typeof warpgate === "undefined") {
            return ui.notifications.error("Module Warpgate non détecté !");
        }

        // --- Fonction Remboursement ---
        const refund = async (raison = "") => {
            if (raison) ui.notifications.warn(raison);
            if (sourceItem.type !== "sort") {
                const currentGlobal = sourceItem.getFlag("add2e", "global_charges");
                if (currentGlobal !== undefined) {
                    await sourceItem.setFlag("add2e", "global_charges", currentGlobal + 1);
                } else if (sourceItem.system.isPower) {
                     const pItem = caster.items.get(sourceItem.system.sourceWeaponId);
                     if (pItem) {
                         const idx = sourceItem.system.powerIndex;
                         const c = pItem.getFlag("add2e", `charges_${idx}`);
                         if (c !== undefined) await pItem.setFlag("add2e", `charges_${idx}`, c + 1);
                     }
                }
            }
        };

        // ==============================================================
        // 2. VISÉE (DIRECTION)
        // ==============================================================
        
        const caseDistance = canvas.scene.grid.distance; 
        const distance = caseDistance * 2; // 2 CASES
        const angle = 120;

        const config = {
            size: 1,
            icon: "icons/svg/hazard.svg",
            label: "Cliquez la DIRECTION",
            interval: -1,
            drawIcon: false
        };

        const aim = await warpgate.crosshairs.show(config);

        if (aim.cancelled) {
            await refund("Tir annulé.");
            return false;
        }

        // ==============================================================
        // 3. CRÉATION DU GABARIT
        // ==============================================================
        
        // On utilise le CENTRE du token comme origine absolue
        const origin = tokenPlaceable.center;
        
        // Calcul Angle
        const ray = new Ray(origin, { x: aim.x, y: aim.y });
        const rotation = Math.toDegrees(ray.angle);

        const templateData = {
            t: "cone",
            user: game.user.id,
            distance: distance,
            angle: angle,
            x: origin.x,
            y: origin.y,
            direction: rotation,
            fillColor: game.user.color || "#FF0000",
            flags: { add2e: { origin: sourceItem.uuid } }
        };

        const [createdTemplate] = await canvas.scene.createEmbeddedDocuments("MeasuredTemplate", [templateData]);
        
        if (!createdTemplate) {
            await refund("Erreur création gabarit.");
            return false;
        }

        // ==============================================================
        // 4. DÉTECTION (MULTIPOINT)
        // ==============================================================
        
        const targets = [];
        await new Promise(r => setTimeout(r, 100)); 
        
        const templateObject = createdTemplate.object;
        const { shape, x, y } = templateObject;

        for (const token of canvas.tokens.placeables) {
            if (!token.actor) continue;
            if (token.id === tokenPlaceable.id) continue;

            const w = token.w;
            const h = token.h;
            const tx = token.x;
            const ty = token.y;

            // 9 Points de contrôle pour être sûr de toucher
            const testPoints = [
                token.center,
                {x: tx, y: ty}, 
                {x: tx + w, y: ty},
                {x: tx, y: ty + h}, 
                {x: tx + w, y: ty + h},
                {x: tx + w/2, y: ty}, 
                {x: tx + w/2, y: ty + h}, 
                {x: tx, y: ty + h/2}, 
                {x: tx + w, y: ty + h/2}
            ];

            let isHit = false;
            for (const p of testPoints) {
                if (shape.contains(p.x - x, p.y - y)) {
                    isHit = true;
                    break;
                }
            }

            if (isHit) targets.push(token);
        }

        // Ciblage
        game.user.targets.forEach(t => t.setTarget(false, {releaseOthers: false}));
        for (const t of targets) {
            t.setTarget(true, {user: game.user, releaseOthers: false, groupSelection: true});
        }

        setTimeout(() => createdTemplate.delete(), 2000);

        if (targets.length === 0) ui.notifications.warn("Aucune cible touchée.");

        // ==============================================================
        // 5. RÉSOLUTION
        // ==============================================================
        
        let casterLevel = 1;
        if (sourceItem.type === "sort") {
            casterLevel = caster.system.details_classe?.magicien?.niveau 
                       || caster.system.niveau || 1;
        } else {
            casterLevel = sourceItem.system.niveau || 6; 
        }

        const dmgValue = casterLevel; 
        const info = sourceItem.system;
        const iconImg = sourceItem.img || "icons/magic/fire/projectile-fireball-orange.webp";

        // A. VFX (Centré sur le Token)
        if (typeof Sequence !== "undefined") {
            new Sequence()
                .effect()
                    .file("jb2a.burning_hands.01.orange") 
                    .atLocation(tokenPlaceable) // <--- ICI : On attache au Token directement
                    .rotate(-rotation)
                    .scale(1.0)
                    .belowTokens(false) // Au-dessus du token
                    .anchor({ x: 0.15, y: 0.5 }) // Légèrement reculé pour que les mains partent du corps
                .play()
                .catch(e => console.warn("Erreur VFX", e));
        }

        // B. Dégâts
        const appliedNames = [];
        if (typeof add2eApplyDamage === "function") {
            for (const token of targets) {
                appliedNames.push(token.name);
                await add2eApplyDamage({
                    cible: token.actor,
                    montant: dmgValue,
                    source: "Mains Brûlantes",
                    lanceur: caster,
                    type: "feu",
                    silent: true 
                });
            }
        }

        // ==============================================================
        // 6. MESSAGE CHAT
        // ==============================================================
        
        const detailsData = [
            { label: "École",    val: info.école || "Altération" },
            { label: "Niveau",   val: casterLevel },
            { label: "Dégâts",   val: `${dmgValue} (Feu)` },
            { label: "Zone",     val: `Cône 120° (2 cases)` },
            { label: "Save",     val: "Aucun" }
        ];

        const touchList = appliedNames.length > 0 ? appliedNames.join(", ") : "Personne";

        const chatContent = `
          <div class="add2e-spell-card" style="border-radius:12px; box-shadow:0 4px 10px #715aab44; background:linear-gradient(135deg, #fdfbfd 0%, #f4efff 100%); border:1.5px solid #9373c7; margin:0.3em 0; padding:0; font-family:var(--font-primary); overflow:hidden;">
            
            <div style="background:linear-gradient(90deg, #6a3c99 0%, #8e44ad 100%); padding:8px 12px; display:flex; align-items:center; gap:10px; color:white; border-bottom:2px solid #5e35b1;">
              <img src="${caster.img}" style="width:36px; height:36px; border-radius:50%; border:2px solid #fff; object-fit:cover;">
              <div style="line-height:1.2;">
                <div style="font-weight:bold; font-size:1.05em;">${caster.name}</div>
                <div style="font-size:0.85em; opacity:0.9;">lance <span style="font-weight:bold; color:#f1c40f;">${_item.name}</span></div>
              </div>
              <img src="${iconImg}" style="width:32px; height:32px; margin-left:auto; border-radius:4px; background:#fff;">
            </div>

            <div style="padding:10px 10px 5px 10px;">
              
              <div style="background:#fdedec; border:1px solid #e6b0aa; border-radius:6px; padding:6px; text-align:center; margin-bottom:8px;">
                <span style="color:#c0392b; font-weight:bold; font-size:1.1em;">🔥 Dégâts de Feu</span>
                <div style="font-size:0.85em; color:#555; margin-top:2px;">Touchés : ${touchList} (${dmgValue} pts)</div>
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

    } catch (err) {
        console.error("ERREUR MAJEURE DU SCRIPT :", err);
        ui.notifications.error("Erreur critique dans le script (voir console F12).");
    }

    return true;

})();