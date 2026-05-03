/**
 * Script Générique : Invisibilité
 * Compatible : Sorts, Objets, Pouvoirs.
 */

// 1. RECUPERATION ROBUSTE DE LA SOURCE
// On essaie toutes les méthodes possibles pour récupérer l'objet
let sourceItem = null;

// A. Via les variables standard
if (typeof sort !== "undefined" && sort) sourceItem = sort;
else if (typeof item !== "undefined" && item) sourceItem = item;

// B. Fallback via 'this' (si le contexte est l'objet lui-même)
if (!sourceItem && this && this.documentName === "Item") sourceItem = this;

// C. Fallback via arguments (si arguments[1] est l'item)
if (!sourceItem && typeof arguments !== "undefined" && arguments.length > 1) {
    // On cherche un objet Item dans les arguments
    for (let arg of arguments) {
        if (arg && arg.documentName === "Item") {
            sourceItem = arg;
            break;
        }
    }
}

if (!sourceItem) {
    console.error("[ADD2e] Script Invisibilité : Source introuvable.");
    ui.notifications.error("Erreur script : Impossible de trouver l'objet source.");
    return;
}

// 2. GESTION DES CIBLES
let cibles = Array.from(game.user.targets);
if (cibles.length === 0) {
    // Si pas de cible, on applique au lanceur (soit 'actor', soit le parent de l'item)
    const lanceur = (typeof actor !== "undefined" && actor) ? actor : sourceItem.parent;
    if (lanceur) {
        const token = lanceur.token || lanceur.getActiveTokens()[0];
        if (token) cibles.push(token);
        else cibles.push(lanceur);
    }
}

// 3. RECHERCHE DE L'EFFET (Avec sécurité null)
let effectModel = null;

// On vérifie d'abord que sourceItem.effects existe et n'est pas null/undefined
if (sourceItem.effects) {
    // Conversion sûre en tableau
    let effectsArray = [];
    if (Array.isArray(sourceItem.effects)) effectsArray = sourceItem.effects;
    else if (sourceItem.effects instanceof Map || sourceItem.effects instanceof Collection) effectsArray = Array.from(sourceItem.effects);
    else if (typeof sourceItem.effects.contents !== "undefined") effectsArray = sourceItem.effects.contents;
    
    // Recherche
    effectModel = effectsArray.find(e => 
        (e.name || e.label || "").toLowerCase().includes("invisibilité") || 
        (e.name || e.label || "").toLowerCase().includes("invisible")
    );
}

// Liste pour le chat
let nomsCibles = [];

// 4. APPLICATION
// On détermine l'acteur lanceur pour le chat
const chatActor = (typeof actor !== "undefined" && actor) ? actor : sourceItem.parent;

if (effectModel) {
    for (const t of cibles) {
        const cibleActor = t.actor ? t.actor : t;
        if (!cibleActor) continue;
        
        nomsCibles.push(cibleActor.name);

        // Si équipement déséquipé, on ignore (le hook gère la suppression)
        if (sourceItem.type !== "sort" && sourceItem.system.equipee === false) continue;

        // Anti-doublon
        const existing = cibleActor.effects.find(e => e.origin === sourceItem.uuid);
        
        if (!existing) {
            const effectData = foundry.utils.duplicate(effectModel);
            effectData.disabled = false;
            effectData.origin = sourceItem.uuid;
            effectData.duration.startTime = game.time.worldTime;
            effectData.transfer = false;
            
            if (!effectData.statuses) effectData.statuses = [];
            if (!effectData.statuses.includes("invisible")) effectData.statuses.push("invisible");

            await cibleActor.createEmbeddedDocuments("ActiveEffect", [effectData]);
        }
    }
} else {
    // Fallback : Génération automatique si pas d'effet trouvé
    if (sourceItem.type === "sort" || sourceItem.system.equipee !== false) {
        const genericEffect = {
            name: "Invisibilité",
            icon: "icons/magic/perception/silhouette-stealth-gray.webp",
            origin: sourceItem.uuid,
            disabled: false,
            duration: { startTime: game.time.worldTime },
            statuses: ["invisible"],
            flags: { add2e: { tags: ["invisibilite"] } },
            transfer: false
        };
        
        for (const t of cibles) {
             const cibleActor = t.actor ? t.actor : t;
             if (cibleActor) {
                 const exist = cibleActor.effects.find(e => e.origin === sourceItem.uuid);
                 if (!exist) {
                     nomsCibles.push(cibleActor.name);
                     await cibleActor.createEmbeddedDocuments("ActiveEffect", [genericEffect]);
                 }
             }
        }
    }
}

// 5. MESSAGE CHAT
if (nomsCibles.length > 0 && chatActor) {
    const liste = nomsCibles.join(", ");
    const info = sourceItem.system;
    const img = sourceItem.img;
    
    const formatVal = (v) => {
        if (!v) return "-";
        if (typeof v === 'object') return `${v.valeur || ""} ${v.unite || ""}`.trim();
        return v;
    };

    const detailsData = [
      { label: "Type",     val: info.categorie || "Magique" },
      { label: "Durée",    val: formatVal(info.duree) || "Spéciale" },
      { label: "Cible",    val: liste }
    ];

    const chatContent = `
      <div class="add2e-spell-card" style="border-radius:12px; box-shadow:0 4px 10px #715aab44; background:linear-gradient(135deg, #fdfbfd 0%, #f4efff 100%); border:1.5px solid #9373c7; margin:0.3em 0; padding:0; font-family:var(--font-primary); overflow:hidden;">
        <div style="background:linear-gradient(90deg, #6a3c99 0%, #8e44ad 100%); padding:8px 12px; display:flex; align-items:center; gap:10px; color:white; border-bottom:2px solid #5e35b1;">
          <img src="${chatActor.img}" style="width:36px; height:36px; border-radius:50%; border:2px solid #fff; object-fit:cover;">
          <div style="line-height:1.2;">
            <div style="font-weight:bold; font-size:1.05em;">${chatActor.name}</div>
            <div style="font-size:0.85em; opacity:0.9;">active <span style="font-weight:bold; color:#f1c40f;">${sourceItem.name}</span></div>
          </div>
          <img src="${img}" style="width:32px; height:32px; margin-left:auto; border-radius:4px; background:#fff;">
        </div>

        <div style="padding:10px 10px 5px 10px;">
          <div style="margin-bottom:8px; text-align:center; font-size:0.95em; color:#4b0082; font-weight:bold; background:#f3e5f5; border:1px solid #e1bee7; border-radius:6px; padding:6px; line-height:1.4;">
            ✨ La silhouette de <span style="color:#8e44ad;">${liste}</span> vacille et disparaît totalement de la vue !
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
                ${info.description || "<em>Aucune description fournie.</em>"}
              </div>
            </div>
          </details>
        </div>
      </div>
    `;

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: chatActor }),
      content: chatContent,
      type: CONST.CHAT_MESSAGE_TYPES.OTHER
    });
}

return true;