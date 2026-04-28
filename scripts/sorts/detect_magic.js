return await (async () => {

    // ==============================================================
    // 1. INITIALISATION & SÉCURITÉ
    // ==============================================================
    let sourceItem = null;
    if (typeof sort !== "undefined" && sort) sourceItem = sort;
    else if (typeof item !== "undefined" && item) sourceItem = item;
    else if (typeof this !== "undefined" && this.documentName === "Item") sourceItem = this;

    // IMPORTANT : On définit _item pour votre template de chat
    const _item = sourceItem;

    if (!sourceItem) { ui.notifications.error("Script Détection : Source introuvable."); return false; }

    const caster = (typeof actor !== "undefined" && actor) ? actor : sourceItem.parent;
    if (!caster) return false;

    // --- Fonction de Remboursement ---
    const refund = async (raison = "") => {
        if (raison) ui.notifications.warn(raison);
        if (sourceItem.type !== "sort") {
            const currentGlobal = sourceItem.getFlag("add2e", "global_charges");
            if (currentGlobal !== undefined) {
                await sourceItem.setFlag("add2e", "global_charges", currentGlobal + 1);
                ui.notifications.info(`Charge restituée.`);
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
    // 2. CALCULS (Durée & Niveau)
    // ==============================================================
    
    let casterLevel = 1;
    if (sourceItem.type === "sort") {
        casterLevel = caster.system.details_classe?.magicien?.niveau 
                   || caster.system.niveau || 1;
    } else {
        casterLevel = sourceItem.system.niveau || 6; 
    }

    const dureeRounds = 2 * casterLevel;
    const info = sourceItem.system;

    // ==============================================================
    // 3. APPLICATION EFFET & VISUEL
    // ==============================================================

    // A. Suppression ancien effet
    const existing = caster.effects.find(e => e.name === "Détection de la Magie");
    if (existing) await existing.delete();

    // B. Création Effet Actif
    const effectData = {
        name: "Détection de la Magie",
        icon: "systems/add2e/assets/icones/sorts/detection-magie-violet.webp", // Icône vectorielle sûre
        origin: sourceItem.uuid,
        duration: { 
            rounds: dureeRounds,
            startTime: game.time.worldTime
        },
        disabled: false,
        description: "Vous percevez les auras magiques.",
        flags: { 
            add2e: { tags: ["detection", "divination"] } 
        }
    };
    
    await caster.createEmbeddedDocuments("ActiveEffect", [effectData]);

    // C. Animation VFX (Sequencer)
    if (typeof Sequence !== "undefined") {
        new Sequence()
            .effect()
                .file("jb2a.magic_signs.circle.02.blue") 
                .atLocation(caster)
                .attachTo(caster)
                .scaleToObject(1.5)
                .belowTokens(true)
                .fadeIn(500)
                .fadeOut(500)
                .duration(3000)
            .play()
            .catch(e => {});
    }

    // ==============================================================
    // 4. MESSAGE CHAT (VOTRE MODÈLE STRICT)
    // ==============================================================
    
    // Préparation des données pour le tableau
    const detailsData = [
        { label: "Niveau", val: casterLevel },
        { label: "Durée", val: `${dureeRounds} rounds` },
        { label: "Portée", val: "10m / Niv." },
        { label: "Zone", val: "Champ visuel" }
    ];

    const chatContent = `
      <div class="add2e-spell-card" style="border-radius:12px; box-shadow:0 4px 10px #715aab44; background:linear-gradient(135deg, #fdfbfd 0%, #f4efff 100%); border:1.5px solid #9373c7; margin:0.3em 0; padding:0; font-family:var(--font-primary); overflow:hidden;">
        
        <div style="background:linear-gradient(90deg, #6a3c99 0%, #8e44ad 100%); padding:8px 12px; display:flex; align-items:center; gap:10px; color:white; border-bottom:2px solid #5e35b1;">
          <img src="${caster.img}" style="width:36px; height:36px; border-radius:50%; border:2px solid #fff; object-fit:cover;">
          <div style="line-height:1.2;">
            <div style="font-weight:bold; font-size:1.05em;">${caster.name}</div>
            <div style="font-size:0.85em; opacity:0.9;">active <span style="font-weight:bold; color:#f1c40f;">${_item.name}</span></div>
          </div>
          <img src="${_item.img}" style="width:32px; height:32px; margin-left:auto; border-radius:4px; background:#fff;">
        </div>

        <div style="padding:10px 10px 5px 10px;">
          
          <div style="background:#eafaf1; border:1px solid #ccebd9; border-radius:6px; padding:6px; text-align:center; margin-bottom:8px;">
            <span style="color:#27ae60; font-weight:bold; font-size:1.1em;">👁️ Détection active</span>
            <div style="font-size:0.85em; color:#555; margin-top:2px;">Vous percevez les auras magiques</div>
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