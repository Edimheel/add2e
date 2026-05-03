/**********************************************************************
 * ADD2E — Sort TÉNÈBRES 5m (Visibilité Token Corrigée) v13
 * - Version unique : Ténèbres.
 * - ASTUCE VISIBILITÉ : Utilise une "teinte" noire forte plutôt qu'une
 * suppression de lumière, pour que le token reste visible au centre.
 **********************************************************************/

console.log("%c[ADD2E][TENEBRES] Lancement du script", "color: #333");

// =======================================================
// 1) INITIALISATION
// =======================================================
let _item = null;
if (typeof item !== "undefined" && item?.name) _item = item;
else if (typeof arguments !== "undefined" && arguments?.length > 1 && arguments[1]?.name) _item = arguments[1];

if (!_item) return ui.notifications.warn("Sort introuvable.");

const caster = actor ?? _item?.parent;
const casterToken = caster?.getActiveTokens()?.[0] ?? null;

if (!caster || !casterToken) return ui.notifications.warn("Le lanceur doit avoir un token sur la scène.");

// --- Paramètres ---
const info = _item.system;
const niveauPerso = Number(caster.system.niveau) || 1;
const dureeRounds = parseInt(_item.system?.duree?.rounds ?? 10) + niveauPerso;
const rayonEffet = 5; 

const durationData = {
  rounds: dureeRounds,
  startRound: game.combat?.round ?? null,
  startTurn: game.combat?.turn ?? null
};

// --- CONFIGURATION CORRIGÉE POUR LA VISIBILITÉ ---
const spellLabel = "Ténèbres";
const spellIcon  = "icons/magic/unholy/projectile-smoke-black.webp";

const lightConfig = {
  dim: rayonEffet,
  bright: 0,
  // ASTUCE : -0.05 est considéré comme "éclairé mais sombre" par Foundry.
  // Cela empêche le token de disparaître tout en permettant l'effet visuel.
  luminosity: -0.05, 
  color: "#000000", // Couleur noire
  alpha: 0.70,      // Forte opacité pour simuler l'encre/ténèbres
  animation: { type: "none" }
};

// =======================================================
// 2) HOOKS DE NETTOYAGE
// =======================================================
if (!globalThis.add2eLightHookRegistered) {
  globalThis.add2eLightHookRegistered = true;

  const cleanUpLight = async (effect) => {
    const flagData = effect.flags?.add2e?.lightPayload;
    if (!flagData) return;

    // Nettoyage Sol
    if (flagData.type === "ambient" && flagData.lightId && canvas.scene) {
      try {
        await canvas.scene.deleteEmbeddedDocuments("AmbientLight", [flagData.lightId]);
        ui.notifications.info("La zone de ténèbres au sol s'est dissipée.");
      } catch (e) { /* Déjà supprimé */ }
    }

    // Nettoyage Token
    if (flagData.type === "token" && flagData.tokenId) {
      const token = canvas.tokens.get(flagData.tokenId);
      if (token && flagData.originalLight) {
        await token.document.update({ light: flagData.originalLight });
        ui.notifications.info(`Les ténèbres autour de ${token.name} se dissipent.`);
      }
      if (flagData.blindEffectId) {
        const targetActor = token?.actor || game.actors.get(flagData.actorId);
        if (targetActor) {
          try { await targetActor.deleteEmbeddedDocuments("ActiveEffect", [flagData.blindEffectId]); } catch(e) {}
        }
      }
    }
  };

  Hooks.on("deleteActiveEffect", cleanUpLight);
  Hooks.on("updateActiveEffect", (effect, changes) => {
    if (changes.disabled === true) cleanUpLight(effect);
  });
}

// =======================================================
// 3) CHOIX DE LA CIBLE
// =======================================================
const mode = await new Promise((resolve) => {
  new Dialog({
    title: "Lancement : Ténèbres 5m",
    content: `
      <form>
        <div class="form-group">
          <label style="font-weight:bold; color:#4a3b69;">Cible du sort :</label>
          <select id="target-type" style="width:100%">
            <option value="offensif">Sur une Créature (Cible)</option>
            <option value="objet">Sur le Sol (Clic)</option>
          </select>
        </div>
        <p style="margin-top:10px;font-size:0.9em;color:#666">
          Crée une zone d'obscurité de <b>${rayonEffet}m</b>.<br>
          Le token ciblé restera visible au centre.
        </p>
      </form>`,
    buttons: {
      cast: { 
        label: "Inciter", 
        icon: '<i class="fas fa-hand-sparkles"></i>', 
        callback: h => resolve(h.find("#target-type").val()) 
      },
      cancel: { label: "Annuler", callback: () => resolve(null) }
    },
    default: "cast"
  }).render(true);
});

if (!mode) return false;

// =======================================================
// 4) LOGIQUE D'APPLICATION & CHAT
// =======================================================
let chatResultHTML = ""; 

// --- CAS : SOL (WARPGATE) ---
if (mode === "objet") {
  if (!game.modules.get("warpgate")?.active) return ui.notifications.error("Module 'Warpgate' requis.");
  const crosshair = await warpgate.crosshairs.show({ size: 1, icon: spellIcon, label: spellLabel });
  if (crosshair.cancelled) return false;

  const lightData = { x: crosshair.x, y: crosshair.y, config: lightConfig };
  const created = await canvas.scene.createEmbeddedDocuments("AmbientLight", [lightData]);
  if (!created[0]?.id) return false;

  await caster.createEmbeddedDocuments("ActiveEffect", [{
    name: `Sort : ${spellLabel} (Maintenu)`,
    icon: spellIcon,
    origin: _item.uuid,
    duration: durationData,
    flags: { add2e: { lightPayload: { type: "ambient", lightId: created[0].id } } }
  }]);

  chatResultHTML = `
    <div style="background:#f2f2f2; border:1px solid #999; border-radius:6px; padding:8px; text-align:center;">
      <span style="color:#333; font-weight:bold; font-size:1.1em;">⚫ Zone de Ténèbres</span>
      <div style="font-size:0.9em; color:#666; margin-top:3px;">Posée au sol (${rayonEffet}m)</div>
    </div>
  `;
}

// --- CAS : CRÉATURE ---
if (mode === "offensif") {
  const target = Array.from(game.user.targets)[0];
  if (!target) return ui.notifications.warn("Veuillez cibler un token.");
  const targetActor = target.actor;

  // 1. Jet de Sauvegarde
  let saveTarget = targetActor.system.sauvegardes?.sort || targetActor.system.savingThrows?.spell || 14; 
  const roll = new Roll("1d20");
  await roll.evaluate();
  if (game.dice3d) await game.dice3d.showForRoll(roll);
  
  const success = roll.total >= saveTarget;
  const isBlinded = !success;

  // 2. Mise à jour du Token (Porteur)
  // On sauvegarde les paramètres actuels
  const originalLight = target.document.light.toObject();
  
  // On applique la "Fausse Obscurité" (Luminosité quasi-neutre + Couleur Noire forte)
  await target.document.update({ light: lightConfig });

  // 3. Effet Aveuglé (Si échec JS)
  let blindId = null;
  if (isBlinded) {
    const blindData = {
      name: "Aveuglé (Ténèbres)",
      icon: "icons/svg/daze.svg",
      origin: _item.uuid,
      duration: durationData,
      changes: [{ key: "system.conditions.blinded", mode: 2, value: true, priority: 20 }],
      statuses: ["blinded"]
    };
    const eff = await targetActor.createEmbeddedDocuments("ActiveEffect", [blindData]);
    blindId = eff[0].id;
  }

  // 4. Effet Maitre sur le Lanceur
  await caster.createEmbeddedDocuments("ActiveEffect", [{
    name: `${spellLabel} sur ${target.name}`,
    icon: spellIcon,
    origin: _item.uuid,
    duration: durationData,
    flags: { add2e: { lightPayload: { type: "token", tokenId: target.id, actorId: targetActor.id, originalLight: originalLight, blindEffectId: blindId } } }
  }]);

  // 5. Feedback Visuel Créature
  const resultColor = isBlinded ? "#c0392b" : "#27ae60"; 
  const resultIcon  = isBlinded ? "❌" : "✅";
  const resultText  = isBlinded ? "AVEUGLÉ & ENVELOPPÉ" : "Enveloppé (Mais voit)";
  const bgResult    = isBlinded ? "#fdedec" : "#f4f4f4";
  const borderRes   = isBlinded ? "#f5b7b1" : "#ccc";

  chatResultHTML = `
    <div style="margin-bottom:8px; border:1px solid #ccc; border-radius:5px; padding:4px; font-size:0.9em; background:#fff;">
      <div style="display:flex; justify-content:space-between; border-bottom:1px dashed #ddd; padding-bottom:3px; margin-bottom:3px;">
        <span style="font-weight:600; color:#666;">JS Contre Sorts</span>
        <span>Seuil : <b>${saveTarget}</b></span>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span>Résultat : <b>${roll.total}</b></span>
        <span style="font-weight:bold; color:${success?'green':'red'}">${success?'Réussite':'Échec'}</span>
      </div>
    </div>

    <div style="background:${bgResult}; border:1px solid ${borderRes}; border-radius:6px; padding:8px; text-align:center;">
      <div style="color:${resultColor}; font-weight:800; font-size:1.1em;">${resultIcon} ${resultText}</div>
      <div style="font-size:0.85em; color:#555; margin-top:2px;">Cible : <b>${target.name}</b></div>
    </div>
  `;
}

// =======================================================
// 5) GÉNÉRATION MESSAGE CHAT GLOBAL
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
  { label: "Zone",     val: `${rayonEffet}m (rayon)` },
  { label: "Incant.",  val: formatVal(info.temps_incantation) },
  { label: "JS",       val: info.jet_sauvegarde || "Aucun" }
];

const chatContent = `
  <div class="add2e-spell-card" style="border-radius:12px; box-shadow:0 4px 10px #715aab44; background:linear-gradient(135deg, #fdfbfd 0%, #f4efff 100%); border:1.5px solid #9373c7; margin:0.3em 0; padding:0; font-family:var(--font-primary); overflow:hidden;">
    
    <div style="background:linear-gradient(90deg, #6a3c99 0%, #8e44ad 100%); padding:8px 12px; display:flex; align-items:center; gap:10px; color:white; border-bottom:2px solid #5e35b1;">
      <img src="${caster.img}" style="width:36px; height:36px; border-radius:50%; border:2px solid #fff; object-fit:cover;">
      <div style="line-height:1.2;">
        <div style="font-weight:bold; font-size:1.05em;">${caster.name}</div>
        <div style="font-size:0.85em; opacity:0.9;">lance <span style="font-weight:bold; color:#f1c40f;">${_item.name}</span></div>
      </div>
      <img src="${_item.img}" style="width:32px; height:32px; margin-left:auto; border-radius:4px; background:#fff;">
    </div>

    <div style="padding:10px 10px 5px 10px;">
      ${chatResultHTML}

      <div style="height:10px;"></div>

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