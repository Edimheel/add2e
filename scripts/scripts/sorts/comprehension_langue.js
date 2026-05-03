/**********************************************************************
 * ADD2E — Sort COMPRÉHENSION DES LANGUES (Script onUse)
 **********************************************************************/

console.log("%c[ADD2E][COMPREHENSION] Lancement du script", "color: #a173d9");

// =======================================================
// 1) INITIALISATION
// =======================================================
let _item = null;
if (typeof item !== "undefined" && item?.name) _item = item;
else if (typeof arguments !== "undefined" && arguments?.length > 1 && arguments[1]?.name) _item = arguments[1];

if (!_item) return ui.notifications.warn("Sort introuvable.");

let sourceActor = actor ?? _item?.parent;
if (!sourceActor) return ui.notifications.warn("Lanceur introuvable.");

// =======================================================
// 2) CONFIGURATION & DURÉE
// =======================================================
const info = _item.system;
const niveauPerso = Number(sourceActor.system.niveau) || 1;

// Durée (par défaut 5 rounds/niv ou 10)
const dureeBrute = info.duree?.rounds ?? info.duration?.rounds ?? (5 * niveauPerso);
const dureeRounds = parseInt(dureeBrute) || 10;

const durationData = {
  rounds: dureeRounds,
  startRound: game.combat?.round ?? null,
  startTurn: game.combat?.turn ?? null
};

// =======================================================
// 3) GESTION DES EFFETS
// =======================================================

// A. Nettoyage des anciens effets identiques
const labelMatch = ["compréhension des langues", "comprehension des langues", "comprehend languages"];
const existing = sourceActor.effects.filter(e => 
  labelMatch.some(l => (e.name || e.label || "").toLowerCase().includes(l))
);
if (existing.length) {
  await sourceActor.deleteEmbeddedDocuments("ActiveEffect", existing.map(e => e.id));
}

// B. Préparation des nouveaux effets
let effectsToApply = [];

if (_item.effects.size > 0) {
  effectsToApply = _item.effects.map(e => {
    let data = e.toObject();
    data.origin = _item.uuid;
    data.duration = durationData;
    data.disabled = false;
    data.transfer = false;
    return data;
  });
} else {
  // Fallback si pas d'effet défini sur l'item
  effectsToApply.push({
    name: "Compréhension des langues",
    icon: _item.img || "icons/svg/book.svg",
    origin: _item.uuid,
    duration: durationData,
    description: "Permet de comprendre les langues parlées ou écrites.",
    changes: [],
    transfer: false
  });
}

// C. Application
await sourceActor.createEmbeddedDocuments("ActiveEffect", effectsToApply);

// =======================================================
// 4) MESSAGE CHAT
// =======================================================
const formatVal = (val) => {
  if (typeof globalThis.formatSortChamp === "function") return globalThis.formatSortChamp(val, niveauPerso);
  if (typeof val === "object" && val !== null) return (val.valeur || "") + " " + (val.unite || "");
  return val || "-";
};

const detailsData = [
  { label: "École",    val: info.école },
  { label: "Niveau",   val: info.niveau },
  { label: "Portée",   val: formatVal(info.portee) },
  { label: "Durée",    val: `${dureeRounds} rounds` },
  { label: "Zone",     val: formatVal(info.zone_effet) },
  { label: "Incantation", val: formatVal(info.temps_incantation) },
  { label: "Composantes", val: info.composantes },
  { label: "Jet de svg.", val: info.jet_sauvegarde || "Aucun" }
];

// Phrase d'ambiance personnalisée selon le sort
const phraseAmbiance = `L'esprit de <span style="color:#8e44ad;">${sourceActor.name}</span> s'ouvre aux mystères de : <b>${_item.name}</b>`;

const chatContent = `
  <div class="add2e-spell-card" style="border-radius:12px; box-shadow:0 4px 10px #715aab44; background:linear-gradient(135deg, #fdfbfd 0%, #f4efff 100%); border:1.5px solid #9373c7; margin:0.3em 0; padding:0; font-family:var(--font-primary); overflow:hidden;">
    
    <div style="background:linear-gradient(90deg, #6a3c99 0%, #8e44ad 100%); padding:8px 12px; display:flex; align-items:center; gap:10px; color:white; border-bottom:2px solid #5e35b1;">
      <img src="${sourceActor.img}" style="width:36px; height:36px; border-radius:50%; border:2px solid #fff; object-fit:cover;">
      <div style="line-height:1.2;">
        <div style="font-weight:bold; font-size:1.05em;">${sourceActor.name}</div>
        <div style="font-size:0.85em; opacity:0.9;">lance <span style="font-weight:bold; color:#f1c40f;">${_item.name}</span></div>
      </div>
      <img src="${_item.img}" style="width:32px; height:32px; margin-left:auto; border-radius:4px; background:#fff;">
    </div>

    <div style="padding:10px 10px 5px 10px;">
      
      <div style="margin-bottom:8px; text-align:center; font-size:0.95em; color:#4b0082; font-weight:bold; background:#f3e5f5; border:1px solid #e1bee7; border-radius:6px; padding:6px; line-height:1.4;">
        ✨ ${phraseAmbiance}
      </div>

      <div style="margin-bottom:8px; text-align:center; font-size:0.90em; color:#27ae60; font-weight:bold; background:#eafaf1; border:1px solid #ccebd9; border-radius:6px; padding:4px;">
        ⏱️ Effet actif (${dureeRounds} rounds)
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
  speaker: ChatMessage.getSpeaker({ actor: sourceActor }),
  content: chatContent,
  type: CONST.CHAT_MESSAGE_TYPES.OTHER
});

return true;