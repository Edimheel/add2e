// ADD2E — onUse Clerc niveau 2 : Baie Délicieuse
// Version : 2026-05-05-clerc-n2-v2
// Crée directement des baies dans l'inventaire du lanceur.

const ADD2E_ONUSE_TAG = "[ADD2E][SORT_ONUSE][BAIE_DELICIEUSE_V2]";
function add2eHtmlEscape(value) { const div = document.createElement("div"); div.innerText = String(value ?? ""); return div.innerHTML; }
function add2eGetCasterToken() { return token ?? args?.[0]?.token ?? canvas?.tokens?.controlled?.[0] ?? null; }
async function add2eChat(title, html, speakerToken = null, options = {}) {
  const casterToken = speakerToken ?? (typeof add2eGetCasterToken === "function" ? add2eGetCasterToken() : null);
  const casterActor = actor ?? casterToken?.actor ?? null;
  const casterName = casterActor?.name ?? casterToken?.name ?? "Clerc";
  const spellName = item?.name ?? title ?? "Sort divin";
  const casterImg = casterToken?.document?.texture?.src ?? casterActor?.img ?? "icons/svg/mystery-man.svg";
  const spellImg = item?.img ?? "icons/svg/book.svg";
  const targets = Array.from(game.user.targets ?? []);
  const targetLabel = options.targetLabel ?? (targets.length ? targets.map(t => t.name).join(", ") : casterName);
  const outcome = options.outcome ?? title ?? spellName;
  const rule = options.rule ?? options.regle ?? "";
  const subtitle = options.subtitle ?? "Sort divin";

  const safeCaster = add2eHtmlEscape(casterName);
  const safeSpell = add2eHtmlEscape(spellName);
  const safeSubtitle = add2eHtmlEscape(subtitle);
  const safeTarget = add2eHtmlEscape(targetLabel);
  const safeOutcome = add2eHtmlEscape(outcome);
  const safeCasterImg = add2eHtmlEscape(casterImg);
  const safeSpellImg = add2eHtmlEscape(spellImg);

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: casterActor, token: casterToken }),
    content: `
      <div class="add2e-chat-card add2e-clerc-sort"
           style="border:1px solid #c79222;border-radius:8px;overflow:hidden;background:#fff8e6;color:#5a3b12;font-family:var(--font-primary);">
        <div style="display:flex;align-items:center;gap:8px;background:#9f6b0a;color:#fff;padding:7px 9px;">
          <img src="${safeCasterImg}" style="width:42px;height:42px;object-fit:cover;border-radius:50%;border:2px solid #f3d48a;background:#fff;" />
          <div style="flex:1;line-height:1.05;">
            <div style="font-weight:800;font-size:14px;">${safeCaster}</div>
            <div style="font-size:12px;font-weight:700;">lance ${safeSpell}</div>
          </div>
          <div style="font-weight:800;font-size:12px;text-align:center;white-space:nowrap;">${safeSubtitle}</div>
          <img src="${safeSpellImg}" style="width:34px;height:34px;object-fit:cover;border-radius:3px;border:1px solid #f0d391;background:#fff;" />
        </div>

        <div style="padding:9px 10px 10px 10px;background:#fff8e6;">
          <div style="font-size:13px;margin:0 0 6px 0;"><b>Cible :</b> ${safeTarget}</div>

          <div style="border:1px solid #e0ae37;border-radius:6px;background:#fffdf5;padding:8px;text-align:center;margin-bottom:7px;">
            <div style="color:#1c9b4b;font-weight:900;font-size:14px;text-transform:uppercase;letter-spacing:.3px;">${safeOutcome}</div>
            <div style="font-size:13px;line-height:1.35;text-align:center;">${html}</div>
          </div>

          ${rule ? `
            <details style="border:1px solid #e0ae37;border-radius:5px;background:#fffdf5;padding:5px 7px;">
              <summary style="cursor:pointer;font-weight:800;color:#6a4611;">Règle appliquée</summary>
              <div style="margin-top:5px;font-size:12px;line-height:1.35;">${rule}</div>
            </details>
          ` : `
            <details style="border:1px solid #e0ae37;border-radius:5px;background:#fffdf5;padding:5px 7px;">
              <summary style="cursor:pointer;font-weight:800;color:#6a4611;">Règle appliquée</summary>
              <div style="margin-top:5px;font-size:12px;line-height:1.35;">Effet du sort appliqué selon sa description et l’arbitrage du MD.</div>
            </details>
          `}
        </div>
      </div>`
  });
}
async function add2eChooseMode() { return await new Promise(resolve => { let done = false; const finish = value => { if (done) return; done = true; resolve(value); }; new Dialog({ title: "Baie Délicieuse", content: `<form><p>Choisir la forme du sort.</p><p><b>Baie Délicieuse</b> crée 2d4 baies magiques consommables qui soignent 1 PV chacune.</p><p><b>Baie Empoisonnée</b> crée 2d4 baies inversées consommables qui infligent 1 dégât chacune.</p></form>`, buttons: { normal: { label: "Baie Délicieuse", callback: () => finish("normal") }, inverse: { label: "Baie Empoisonnée", callback: () => finish("inverse") }, cancel: { label: "Annuler", callback: () => finish(null) } }, default: "normal", close: () => finish(null) }).render(true); }); }
function add2eBerryItemData({ mode, quantity }) { const poisoned = mode === "inverse"; const name = poisoned ? "Baie Empoisonnée" : "Baie Délicieuse"; const slug = poisoned ? "baie_empoisonnee" : "baie_delicieuse"; return { name, type: "objet", img: "icons/consumables/fruit/berries-ration-round-red.webp", system: { nom: name, type: "objet_magique", categorie: "consommable", equipee: false, quantite: quantity, quantity, charges: { value: quantity, max: quantity }, description: poisoned ? "Baie créée par la forme inversée de Baie Délicieuse. Lorsqu’elle est consommée, elle inflige 1 dégât puis disparaît." : "Baie magique créée par Baie Délicieuse. Lorsqu’elle est consommée, elle rend 1 point de vie puis disparaît.", onUse: "systems/add2e/scripts/sorts/baie-delicieuse-consommation.js", onuse: "systems/add2e/scripts/sorts/baie-delicieuse-consommation.js", tags: [`objet:${slug}`, "objet_magique:baie", "consommable:baie", poisoned ? "degat:poison" : "soin:1", poisoned ? "baie:empoisonnee" : "baie:delicieuse"] }, flags: { add2e: { createdBySpell: "Baie Délicieuse", berryMode: poisoned ? "poison" : "heal", healAmount: poisoned ? 0 : 1, damageAmount: poisoned ? 1 : 0, consumeOnUse: true, createdAt: Date.now() } }, effects: [], ownership: { default: 0 } }; }
async function add2eCreateBerries(mode) { if (!actor) { ui.notifications.warn("Baie Délicieuse : acteur lanceur introuvable."); return false; } const roll = await new Roll("2d4").evaluate(); await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor, token: add2eGetCasterToken() }), flavor: mode === "inverse" ? "Baie Empoisonnée — nombre de baies" : "Baie Délicieuse — nombre de baies" }); const quantity = Number(roll.total) || 0; if (quantity <= 0) return false; const itemData = add2eBerryItemData({ mode, quantity }); await actor.createEmbeddedDocuments("Item", [itemData]); await add2eChat(mode === "inverse" ? "Baie Empoisonnée" : "Baie Délicieuse", `<p><b>${quantity}</b> baie(s) créée(s) dans l’inventaire de <b>${add2eHtmlEscape(actor.name)}</b>.</p><p>${mode === "inverse" ? "Chaque baie inflige 1 dégât et disparaît après utilisation." : "Chaque baie soigne 1 PV et disparaît après utilisation."}</p>`); return true; }
const mode = await add2eChooseMode(); if (!mode) { ui.notifications.info("Baie Délicieuse annulé."); return false; }
console.log(`${ADD2E_ONUSE_TAG}[START]`, { actor: actor?.name, mode }); return await add2eCreateBerries(mode);
