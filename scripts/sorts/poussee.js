/**
 * Script : Poussée (Push)
 * - Correction : Utilisation du SOCKET pour appliquer l'effet sur l'ennemi.
 */

console.log("%c[ADD2E][POUSSÉE] V2 - Socket Fix", "color: #8e44ad; font-weight:bold;");

return await (async () => {

    // INITIALISATION
    let sourceItem = null;
    if (typeof sort !== "undefined" && sort) sourceItem = sort;
    else if (typeof item !== "undefined" && item) sourceItem = item;
    if (!sourceItem && typeof this !== "undefined" && this.documentName === "Item") sourceItem = this;
    const _item = sourceItem;

    if (!sourceItem) { ui.notifications.error("ERREUR : Source introuvable."); return false; }
    const caster = (typeof actor !== "undefined" && actor) ? actor : sourceItem.parent;
    if (!caster) { ui.notifications.error("ERREUR : Lanceur introuvable."); return false; }

    const refund = async (raison = "") => {
        if (raison) ui.notifications.warn(raison);
        if (sourceItem.type !== "sort") {
            const currentGlobal = sourceItem.getFlag("add2e", "global_charges");
            if (currentGlobal !== undefined) await sourceItem.setFlag("add2e", "global_charges", currentGlobal + 1);
        }
    };

    // CIBLAGE
    const targets = Array.from(game.user.targets);
    if (targets.length === 0) { await refund("Veuillez cibler une créature."); return false; }

    // PARAMÈTRES
    let casterLevel = 1;
    if (sourceItem.type === "sort") {
        casterLevel = caster.system.details_classe?.magicien?.niveau || caster.system.niveau || 1;
    } else {
        casterLevel = sourceItem.system.niveau || 6; 
    }
    const maxWeightKg = casterLevel * 25;
    const forceValue = casterLevel; 
    const iconImg = sourceItem.img || "systems/add2e/assets/icones/sorts/poussee.webp";

    // RÉSOLUTION
    for (const token of targets) {
        const targetActor = token.actor;
        if (!targetActor) continue;

        // Save
        let saveValue = 15; 
        if (targetActor.system.sauvegardes?.sorts) saveValue = Number(targetActor.system.sauvegardes.sorts);
        else {
            const cls = targetActor.items.find(i => i.type === "classe");
            if (cls?.system?.progression?.[(targetActor.system.niveau||1)-1]?.savingThrows) {
                saveValue = cls.system.progression[(targetActor.system.niveau||1)-1].savingThrows[4];
            }
        }

        const roll = new Roll("1d20");
        await roll.evaluate();
        if (game.dice3d) await game.dice3d.showForRoll(roll);
        const success = roll.total >= saveValue;

        // VFX
        if (typeof Sequence !== "undefined") {
            new Sequence()
                .effect().file("jb2a.gust_of_wind.very_fast.grey").atLocation(caster).stretchTo(token).missed(success)
                .effect().file("jb2a.impact.004.blue").atLocation(token).delay(200).scale(0.5).playIf(!success)
                .play().catch(e => {});
        }

        // Résultat
        let resultHTML = "";
        if (success) {
            resultHTML = `
            <div style="background:#eafaf1; border:1px solid #ccebd9; border-radius:6px; padding:6px; text-align:center; margin-bottom:8px;">
                <span style="color:#27ae60; font-weight:bold; font-size:1.1em;">🛡️ RÉSISTE</span>
                <div style="font-size:0.85em; color:#555; margin-top:2px;">La cible maintient son équilibre.</div>
                <div style="font-size:0.8em; color:#777;">(${roll.total} vs ${saveValue})</div>
            </div>`;
        } else {
            resultHTML = `
            <div style="background:#fdedec; border:1px solid #e6b0aa; border-radius:6px; padding:6px; text-align:center; margin-bottom:8px;">
                <span style="color:#c0392b; font-weight:bold; font-size:1.1em;">💫 DÉSÉQUILIBRÉ</span>
                <div style="font-size:0.85em; color:#555; margin-top:2px;">Perd sa prochaine attaque.</div>
                <div style="font-size:0.8em; color:#777;">(${roll.total} vs ${saveValue})</div>
            </div>`;

            const effectData = {
                name: "Déséquilibré (Poussée)",
                icon: iconImg,
                origin: sourceItem.uuid,
                duration: { rounds: 1 },
                disabled: false,
                description: "La créature a perdu l'équilibre et ne peut pas attaquer ce round-ci.",
                flags: { add2e: { tags: ["stun", "incapacitated", "perturbe_equilibre"] } }
            };
            
            // [CORRECTIF SOCKET]
            if (game.socket) {
                game.socket.emit("system.add2e", {
                    type: "applyActiveEffect",
                    actorId: targetActor.id,
                    effectData: effectData
                });
            } else {
                await targetActor.createEmbeddedDocuments("ActiveEffect", [effectData]);
            }
        }

        // Chat
        const detailsData = [
            { label: "Niveau",   val: casterLevel },
            { label: "Force",    val: `${forceValue} pied-livre` },
            { label: "Max Cible",val: `< ${maxWeightKg} kg` },
            { label: "Save",     val: `vs Sorts (${saveValue})` }
        ];

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
              <div style="margin-bottom:8px; border-bottom:1px solid #eee; padding-bottom:4px; font-size:0.95em;"><b>Cible :</b> ${targetActor.name}</div>
              ${resultHTML}
              <details style="background:#fff; border:1px solid #e0d4fc; border-radius:6px;">
                <summary style="cursor:pointer; color:#6a3c99; font-weight:600; font-size:0.9em; padding:6px 10px; background:#efe9f6; border-radius:6px; list-style:none;">📜 Voir détails</summary>
                <div style="padding:8px;">
                  <table style="width:100%; font-size:0.85em; border-spacing:0; margin-bottom:10px; color:#333; border-bottom:1px solid #eee;">
                    ${detailsData.map((d, i) => `
                      <tr style="${i % 2 === 0 ? 'background:#f8f6fa;' : ''}">
                        <td style="color:#6a3c99; font-weight:600; padding:2px 5px; width:40%;">${d.label}</td>
                        <td style="text-align:right; padding:2px 5px;">${d.val}</td>
                      </tr>`).join("")}
                  </table>
                  <div style="color:#4a3b69; font-size:0.9em; line-height:1.4; text-align:justify;"><b>Description :</b><br>${sourceItem.system.description || "Une force invisible frappe la cible."}</div>
                </div>
              </details>
            </div>
          </div>
        `;

        ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: caster }), content: chatContent, type: CONST.CHAT_MESSAGE_TYPES.OTHER });
    }
    return true;
})();