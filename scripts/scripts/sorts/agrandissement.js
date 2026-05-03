/**
 * Script : Agrandissement (Style Compact) v13.1
 * - Compatible utilisation depuis sort OU objet.
 * - Si le joueur n'a pas les droits : délègue au MJ via socket (updateToken / applyActiveEffect).
 * - Le tableau de stats est dans l'accordéon avec la description.
 */

console.log("%c[ADD2E] Agrandissement - Compact V13.1", "color: #9373c7; font-weight:bold;");

return await (async () => {
  // ======================================================
  // 1. RÉCUPÉRATION DE L'ITEM (sort, objet, etc.)
  // ======================================================
  let sourceItem = null;

  if (typeof item !== "undefined" && item?.name) {
    sourceItem = item;
  } else if (typeof arguments !== "undefined" && arguments?.length > 1 && arguments[1]?.name) {
    // Cas des macros appelées avec (actor, item) en arguments[0/1]
    sourceItem = arguments[1];
  } else if (typeof sort !== "undefined" && sort?.name) {
    // Ancienne compat
    sourceItem = sort;
  }

  if (!sourceItem) {
    ui.notifications.error("Sort d'agrandissement introuvable.");
    return false;
  }

  const caster = actor ?? sourceItem.parent;
  if (!caster) {
    ui.notifications.error("Lanceur introuvable pour Agrandissement.");
    return false;
  }

  // ======================================================
  // 2. DÉTERMINATION DES CIBLES (sinon soi-même)
  // ======================================================
  const cibles = Array.from(game.user.targets ?? []);
  let isSelfCast = false;

  if (cibles.length === 0) {
    const tokens = caster.getActiveTokens();
    if (tokens.length > 0) {
      cibles.push(tokens[0]);
      isSelfCast = true;
    } else {
      ui.notifications.warn("Aucune cible sélectionnée.");

      // RENDRE LA CHARGE si l'effet n'a pas pu partir et que ce n'est PAS un sort "classique"
      if (sourceItem.type !== "sort") {
        const cur = await sourceItem.getFlag("add2e", "global_charges");
        if (cur !== undefined) await sourceItem.setFlag("add2e", "global_charges", cur + 1);
      }
      return false;
    }
  }

  // ======================================================
  // 3. PARAMÈTRES & UTILITAIRES
  // ======================================================
  const info = sourceItem.system ?? {};
  const niveauLanceur = Number(caster.system?.niveau) || 1;

  // Durée : on adopte "1 round par niveau" (adaptable)
  const dureeRounds = Math.max(1, niveauLanceur);

  const formatVal = (val) => {
    if (!val) return "-";
    let v, u;

    if (typeof val === "object") {
      v = val.valeur ?? "";
      u = val.unite ?? "";
    } else {
      v = val;
      u = "";
    }

    v = String(v).replace(/@niv(eau)?/gi, niveauLanceur);

    // On tente de résoudre une éventuelle expression simple (ex : "1+@niv")
    try {
      // eslint-disable-next-line no-new-func
      const res = Function(`return (${v});`)();
      if (typeof res !== "undefined") v = res;
    } catch (e) {
      // On laisse tel quel si invalide
    }

    return `${v} ${u}`.trim();
  };

  // Valeurs de fiche
  const portee   = formatVal(info.portee);
  const dureeTxt = formatVal(info.duree ?? info.durée);
  const cibleTxt = formatVal(info.cible);
  const incant   = formatVal(info.temps_incantation);

  // Compteur de mémorisation (si utilisé par ton système)
  let labelCharge = "";
  const memCount = await sourceItem.getFlag("add2e", "memorizedCount");
  if (memCount !== undefined) {
    labelCharge = `<span style="font-size:0.9em; font-weight:bold; margin-left:5px; color:#2980b9;">Reste : ${memCount}</span>`;
  }

  // ======================================================
  // 4. BOUCLE SUR LES CIBLES
  // ======================================================
  for (const t of cibles) {
    const targetTokenObj = t;               // Placeable Token
    const targetActor    = targetTokenObj?.actor;
    const targetToken    = targetTokenObj?.document; // TokenDocument

    if (!targetActor || !targetToken) continue;

    // ----------------- A. SAUVEGARDE --------------------
    const saveVal = Number(targetActor.system?.sauvegardes?.sorts) || 15;
    let success   = false;
    let rollTotal = "-";

    if (!isSelfCast) {
      const roll = new Roll("1d20");
      await roll.evaluate({ async: true });
      if (game.dice3d) await game.dice3d.showForRoll(roll);
      rollTotal = roll.total;
      success   = rollTotal >= saveVal;
    }

    // ----------------- B. STATUT HTML -------------------
    let statusHtml = "";

    if (success && !isSelfCast) {
      // La cible résiste
      statusHtml = `
        <div style="margin: 5px 0 8px 0; padding: 6px; border-radius: 6px; text-align: center; background: #eafaf1; border: 1px solid #ccebd9; color: #27ae60;">
          <div style="font-weight: bold; font-size: 1.1em;">🛡️ RÉSISTE</div>
          <div style="font-size: 0.85em;">Sauvegarde réussie (${rollTotal} vs ${saveVal})</div>
        </div>`;
    } else {
      // Effet appliqué
      statusHtml = `
        <div style="margin: 5px 0 8px 0; padding: 6px; border-radius: 6px; text-align: center; background: #f4efff; border: 1px solid #e0d4fc; color: #8e44ad;">
          <div style="font-weight: bold; font-size: 1.1em;">💪 AGRANDI</div>
          <div style="font-size: 0.85em;">${isSelfCast ? "Sort lancé sur soi" : `Échec sauvegarde (${rollTotal} vs ${saveVal})`}</div>
        </div>`;

      // -------------- C. LOGIQUE D'AGRANDISSEMENT --------------
      const originalScaleX = Number(targetToken.texture?.scaleX ?? 1);
      const originalScaleY = Number(targetToken.texture?.scaleY ?? originalScaleX);
      const newScaleX      = originalScaleX * 2;
      const newScaleY      = originalScaleY * 2;

      const updateData = {
        "texture.scaleX": newScaleX,
        "texture.scaleY": newScaleY
      };

      // Si le MJ ou un propriétaire a lancé le sort, il peut mettre à jour directement
      if (game.user.isGM || targetActor.isOwner) {
        await targetToken.update(updateData);
      } else if (game.socket) {
        // Sinon, on délègue au MJ via socket (handler "updateToken")
        game.socket.emit("system.add2e", {
          type: "updateToken",
          sceneId: targetToken.parent?.id ?? canvas.scene?.id,
          tokenId: targetToken.id,
          updateData
        });
      }

      // ActiveEffect de suivi (pour pouvoir revenir à la taille normale)
      const effectData = {
        name: "Agrandissement",
        icon: sourceItem.img,
        origin: sourceItem.uuid,
        duration: { 
          startTime: game.time.worldTime, 
          rounds: dureeRounds 
        },
        flags: { 
          add2e: { 
            enlargeData: { 
              tokenId: targetToken.id, 
              originalScaleX,
              originalScaleY
            } 
          } 
        }
      };

      if (game.socket) {
        // Délégation côté MJ : handler "applyActiveEffect"
        game.socket.emit("system.add2e", {
          type: "applyActiveEffect",
          actorId: targetActor.id,
          effectData
        });
      } else {
        await targetActor.createEmbeddedDocuments("ActiveEffect", [effectData]);
      }
    }

    // ======================================================
    // 5. MESSAGE DE CHAT (TABLEAU DANS DETAILS)
    // ======================================================
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
          <span style="margin-left:auto; color:#8e44ad; font-size:0.97em; font-weight:600;">Niv. ${info.niveau || 1}</span>
          ${labelCharge}
        </div>

        ${statusHtml}

        <details style="margin-top:0.2em; background: #eee8fa; border-radius: 6px; border:1px solid #e1d2fb;">
          <summary style="cursor:pointer; color:#6a3c99; font-size:1em; font-weight: 600; padding:4px 8px;">
            Détails & Description
          </summary>
          
          <div style="padding: 0.5em;">
              <table style="width:100%; font-size:0.95em; border-spacing:0; margin-bottom: 8px;">
                  <tr>
                    <td style="color:#8571a5; font-weight:600; width:90px; padding:2px 0;">Portée</td>
                    <td style="color:#222; font-weight:500;">${portee}</td>
                  </tr>
                  <tr style="background:rgba(255,255,255,0.5);">
                    <td style="color:#8571a5; font-weight:600; padding:2px 0;">Durée</td>
                    <td style="color:#222; font-weight:500;">${dureeTxt}</td>
                  </tr>
                  <tr>
                    <td style="color:#8571a5; font-weight:600; padding:2px 0;">Cible</td>
                    <td style="color:#222; font-weight:500;">${cibleTxt}</td>
                  </tr>
                  <tr style="background:rgba(255,255,255,0.5);">
                    <td style="color:#8571a5; font-weight:600; padding:2px 0;">Incant.</td>
                    <td style="color:#222; font-weight:500;">${incant}</td>
                  </tr>
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
  }

  return true;
})();
