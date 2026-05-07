// ADD2E — Consommation Baie Délicieuse / Baie Empoisonnée
// Version : 2026-05-05-clerc-n2-v2

const ADD2E_BAIE_TAG = "[ADD2E][OBJET_ONUSE][BAIE_CONSOMMATION_V2]";
function add2eHtmlEscape(value) { const div = document.createElement("div"); div.innerText = String(value ?? ""); return div.innerHTML; }
function add2eGetActor() { return actor ?? item?.parent ?? token?.actor ?? canvas?.tokens?.controlled?.[0]?.actor ?? null; }
function add2eReadQty(item) { const candidates = [item?.system?.quantite, item?.system?.quantity, item?.system?.charges?.value]; for (const v of candidates) { const n = Number(v); if (Number.isFinite(n)) return n; } return 1; }
async function add2eSetQty(item, qty) { const update = {}; if (item.system?.quantite !== undefined) update["system.quantite"] = qty; if (item.system?.quantity !== undefined) update["system.quantity"] = qty; if (item.system?.charges?.value !== undefined) update["system.charges.value"] = qty; if (!Object.keys(update).length) update["system.quantite"] = qty; await item.update(update); }
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
const targetActor = add2eGetActor(); if (!targetActor) { ui.notifications.warn("Baie : acteur introuvable."); return false; } if (!item) { ui.notifications.warn("Baie : item introuvable."); return false; }
const mode = item.flags?.add2e?.berryMode ?? "heal"; const healAmount = Number(item.flags?.add2e?.healAmount ?? 1) || 0; const damageAmount = Number(item.flags?.add2e?.damageAmount ?? 0) || 0; const current = Number(targetActor.system?.pdv ?? 0); const max = Number(targetActor.system?.points_de_coup ?? targetActor.system?.pv_max ?? 0) || 0;
if (!Number.isFinite(current)) { ui.notifications.warn(`Baie : impossible de lire system.pdv sur ${targetActor.name}.`); console.warn(`${ADD2E_BAIE_TAG}[MISSING_SYSTEM_PDV]`, { actor: targetActor.name, system: targetActor.system }); return false; }
let next = current; const label = item.name;
if (mode === "poison") { next = Math.max(0, current - damageAmount); await targetActor.update({ "system.pdv": next }); await add2eChat(label, `<p><b>${add2eHtmlEscape(targetActor.name)}</b> consomme une baie empoisonnée et subit <b>${damageAmount}</b> dégât.</p>`, targetActor); } else { next = max > 0 ? Math.min(max, current + healAmount) : current + healAmount; await targetActor.update({ "system.pdv": next }); await add2eChat(label, `<p><b>${add2eHtmlEscape(targetActor.name)}</b> consomme une baie délicieuse et récupère <b>${healAmount}</b> PV.</p>`, targetActor); }
const qty = add2eReadQty(item); const nextQty = qty - 1; if (nextQty <= 0) { await item.delete(); } else { await add2eSetQty(item, nextQty); }
console.log(`${ADD2E_BAIE_TAG}[DONE]`, { actor: targetActor.name, item: item.name, mode, hpBefore: current, hpAfter: next, qtyBefore: qty, qtyAfter: Math.max(0, nextQty) }); return true;
