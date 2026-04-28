// Bouclier.js - macro "onUse" universelle + effet visuel JB2A
// Compatible Sorts & Objets

// ======================================================
// 0. INITIALISATION ROBUSTE
// ======================================================
let sourceItem = null;
if (typeof sort !== "undefined" && sort) sourceItem = sort;
else if (typeof item !== "undefined" && item) sourceItem = item;
if (!sourceItem && typeof this !== "undefined" && this.documentName === "Item") sourceItem = this;
if (!sourceItem && typeof arguments !== "undefined" && arguments.length > 1 && arguments[1]?.name) sourceItem = arguments[1];

if (!sourceItem) {
    ui.notifications.warn("Script Bouclier : Source introuvable.");
    return false;
}

const sourceActor = (typeof actor !== "undefined" && actor) ? actor : sourceItem.parent;
if (!sourceActor) {
    ui.notifications.warn("Lanceur introuvable.");
    return false;
}

// ======================================================
// HOOKS GLOBAUX : sync ActiveEffect <-> VFX Sequencer
// ======================================================
function registerBouclierHooks() {
    if (game.add2eBouclierHooksRegistered) return;
    game.add2eBouclierHooksRegistered = true;

    const endBouclierVfx = (effect) => {
        const label = (effect.label || effect.name || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (!label.includes("bouclier")) return;

        const effActor = effect.parent;
        if (!effActor) return;

        const tokens = effActor.getActiveTokens?.() || [];
        for (const token of tokens) {
            const visName = `bouclier-effect-${token.id}`;
            if (typeof Sequencer !== "undefined") {
                Sequencer.EffectManager.endEffects({ name: visName, object: token });
            }
        }
    };

    Hooks.on("deleteActiveEffect", endBouclierVfx);
    Hooks.on("updateActiveEffect", (effect, changes) => {
        if (changes.disabled === true || changes.disabled === 1) endBouclierVfx(effect);
    });
}

// ======================================================
// EXECUTION PRINCIPALE
// ======================================================
registerBouclierHooks();

// --- Supprime tout effet Bouclier déjà présent ---
const existing = sourceActor.effects.filter(e => (e.label || e.name || "").toLowerCase().includes("bouclier"));
if (existing.length) {
    await sourceActor.deleteEmbeddedDocuments("ActiveEffect", existing.map(e => e.id));
}

// --- Récupère l'effet à appliquer ---
let effectModel = sourceItem.effects.find(e => (e.name || e.label).toLowerCase().includes("bouclier"));
if (!effectModel) {
    const realSpell = game.items.find(i => i.type === "sort" && i.name.toLowerCase().includes("bouclier"));
    if (realSpell) effectModel = realSpell.effects.find(e => (e.name || e.label).toLowerCase().includes("bouclier"));
}
if (!effectModel) {
    effectModel = {
        name: "Bouclier",
        icon: "icons/magic/defensive/shield-barrier-blue.webp",
        changes: [{ key: "system.ca_total", mode: 2, value: "-1", priority: 20 }],
        duration: { rounds: 5 },
        flags: { add2e: { tags: ["bouclier"] } }
    };
}

let effectData = foundry.utils.duplicate(effectModel);
effectData.disabled = false;
effectData.origin = sourceItem.uuid;
effectData.transfer = false;

const info = sourceItem.system;
const niveau = Number(sourceActor.system?.niveau) || 1;
const rounds = 5 * niveau;

effectData.duration = {
    startTime: game.time.worldTime,
    rounds: rounds,
    startRound: game.combat?.round,
    startTurn: game.combat?.turn
};

await sourceActor.createEmbeddedDocuments("ActiveEffect", [effectData]);

// ==========================
// MESSAGE CHAT (Nouvelle Norme Violette)
// ==========================
const detailsData = [
    { label: "Type", val: info.categorie || info.ecole || "Abjuration" },
    { label: "Durée", val: `${rounds} rounds` },
    { label: "Cible", val: "Soi-même" }
];

// Utilisation stricte du template violet (Charme Personne) adapté pour Bouclier
const chatContent = `
  <div class="add2e-spell-card" style="border-radius:12px; box-shadow:0 4px 10px #715aab44; background:linear-gradient(135deg, #fdfbfd 0%, #f4efff 100%); border:1.5px solid #9373c7; margin:0.3em 0; padding:0; font-family:var(--font-primary); overflow:hidden;">
    
    <div style="background:linear-gradient(90deg, #6a3c99 0%, #8e44ad 100%); padding:8px 12px; display:flex; align-items:center; gap:10px; color:white; border-bottom:2px solid #5e35b1;">
      <img src="${sourceActor.img}" style="width:36px; height:36px; border-radius:50%; border:2px solid #fff; object-fit:cover;">
      <div style="line-height:1.2;">
        <div style="font-weight:bold; font-size:1.05em;">${sourceActor.name}</div>
        <div style="font-size:0.85em; opacity:0.9;">active <span style="font-weight:bold; color:#f1c40f;">${sourceItem.name}</span></div>
      </div>
      <img src="${sourceItem.img}" style="width:32px; height:32px; margin-left:auto; border-radius:4px; background:#fff;">
    </div>

    <div style="padding:10px 10px 5px 10px;">
      
      <div style="background:#eaf2f8; border:1px solid #a9cce3; border-radius:6px; padding:6px; text-align:center; margin-bottom:8px;">
        <span style="color:#2980b9; font-weight:bold; font-size:1.1em;">🛡️ Champ de Force</span>
        <div style="font-size:0.85em; color:#555; margin-top:2px;">Protège contre les attaques</div>
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
    speaker: ChatMessage.getSpeaker({ actor: sourceActor }),
    content: chatContent,
    type: CONST.CHAT_MESSAGE_TYPES.OTHER
});

// ==========================
// EFFET VISUEL (Sequencer)
// ==========================
let jb2aPath = null;
if (game.modules.get("jb2a_patreon")?.active) {
    jb2aPath = "modules/jb2a_patreon/Library/1st_Level/Shield/Shield_02_Regular_Blue_Complete_400x400.webm";
} else if (game.modules.get("jb2a_free")?.active) {
    jb2aPath = "modules/jb2a_free/Library/1st_Level/Shield/Shield_01_Regular_Blue_Intro_400x400.webm";
}

let visToken = sourceActor.token || sourceActor.getActiveTokens()[0];

if (jb2aPath && typeof Sequence === "function" && visToken) {
    Sequencer.EffectManager.endEffects({ name: `bouclier-effect-${visToken.id}`, object: visToken });

    new Sequence()
        .effect()
        .file(jb2aPath)
        .attachTo(visToken)
        .persist(true)
        .name(`bouclier-effect-${visToken.id}`)
        .belowTokens(false)
        .scale(0.70)
        .opacity(0.85)
        .play();
}

return true;