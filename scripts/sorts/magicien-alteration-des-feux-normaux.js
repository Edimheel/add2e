// ADD2E — onUse Magicien : Altération des feux normaux
// Version : 2026-05-25-magicien-alteration-feux-normaux-chat-only-v2
//
// Sort à carte de chat uniquement.
// Aucun ActiveEffect, aucun changement d'acteur, aucune cible obligatoire.
//
// Contrat avec scripts/add2e-attack/06-cast-spell.mjs :
// - return true  => le sort est lancé, le slot mémorisé réservé est consommé ;
// - return false => annulation technique, le slot mémorisé réservé est remboursé.
// La consommation du slot n'est PAS faite ici : elle est centralisée dans add2eCastSpell.

const ADD2E_ONUSE_TAG = "[ADD2E][SORT_ONUSE][MAGICIEN][ALTERATION_FEUX_NORMAUX]";
const ADD2E_ACTOR = typeof actor !== "undefined" ? actor : null;
const ADD2E_ITEM = typeof item !== "undefined" ? item : null;
const ADD2E_TOKEN = typeof token !== "undefined" ? token : null;
const ADD2E_ARGS = typeof args !== "undefined" ? args : [];

const ADD2E_SORT_CONFIG = {
  name: "Altération des feux normaux",
  slug: "alteration_des_feux_normaux",
  level: 1,
  school: "Altération",
  rangeText: "1/2\" par niveau",
  durationText: "1 round par niveau",
  castingTimeText: "1 segment",
  saveText: "Aucun",
  areaText: "feu normal de 90 cm de diamètre maximum",
  imgFallback: "icons/magic/fire/flame-burning-orange.webp"
};

function add2eHtmlEscape(value) {
  const div = document.createElement("div");
  div.innerText = String(value ?? "");
  return div.innerHTML;
}

function add2eCasterLevel(actorDoc) {
  return Number(
    actorDoc?.system?.niveau ??
    actorDoc?.system?.level ??
    actorDoc?.system?.details?.niveau ??
    actorDoc?.system?.details?.level ??
    1
  ) || 1;
}

function add2eGetCasterToken(actorDoc) {
  return ADD2E_TOKEN
    ?? ADD2E_ARGS?.[0]?.token
    ?? canvas?.tokens?.controlled?.find(t => t.actor?.id === actorDoc?.id)
    ?? actorDoc?.getActiveTokens?.()?.[0]
    ?? canvas?.tokens?.controlled?.[0]
    ?? null;
}

async function add2eChatAlterationFeuxNormaux(actorDoc) {
  const casterToken = add2eGetCasterToken(actorDoc);
  const casterName = actorDoc?.name ?? casterToken?.name ?? "Magicien";
  const casterImg = casterToken?.document?.texture?.src ?? actorDoc?.img ?? "icons/svg/mystery-man.svg";
  const spellImg = ADD2E_ITEM?.img ?? ADD2E_SORT_CONFIG.imgFallback;
  const level = add2eCasterLevel(actorDoc);
  const durationRounds = Math.max(1, level);

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: actorDoc, token: casterToken }),
    content: `
      <div class="add2e-chat-card add2e-magicien-sort add2e-sort-chat-only add2e-sort-alteration-feux"
           style="border:1px solid #8e63c7;border-radius:8px;overflow:hidden;background:#f6f0ff;color:#2d2144;font-family:var(--font-primary);">
        <div style="display:flex;align-items:center;gap:8px;background:#5b3f8c;color:#fff;padding:7px 9px;">
          <img src="${add2eHtmlEscape(casterImg)}" style="width:42px;height:42px;object-fit:cover;border-radius:50%;border:2px solid #d8c3ff;background:#fff;" />
          <div style="flex:1;line-height:1.05;">
            <div style="font-weight:800;font-size:14px;">${add2eHtmlEscape(casterName)}</div>
            <div style="font-size:12px;font-weight:700;">lance ${add2eHtmlEscape(ADD2E_SORT_CONFIG.name)}</div>
          </div>
          <div style="font-weight:800;font-size:12px;text-align:center;white-space:nowrap;">Magicien niv. 1</div>
          <img src="${add2eHtmlEscape(spellImg)}" style="width:34px;height:34px;object-fit:cover;border-radius:3px;border:1px solid #d8c3ff;background:#fff;" />
        </div>

        <div style="padding:9px 10px 10px 10px;background:#f6f0ff;">
          <div style="border:1px solid #8e63c7;border-radius:6px;background:#fffaff;padding:8px;text-align:center;margin-bottom:7px;">
            <div style="color:#6c31b5;font-weight:900;font-size:14px;text-transform:uppercase;letter-spacing:.3px;">Sort lancé</div>
            <div style="font-size:13px;line-height:1.35;text-align:left;">
              <p style="margin:.25em 0;">Les flammes normales frémissent et se plient à la volonté du magicien.</p>
              <p style="margin:.25em 0;">Leur éclat change d'intensité, sans que leur chaleur ne soit altérée.</p>
              <p style="margin:.25em 0;"><b>Durée :</b> ${add2eHtmlEscape(ADD2E_SORT_CONFIG.durationText)} (${durationRounds} round${durationRounds > 1 ? "s" : ""}).</p>
            </div>
          </div>

          <details style="border:1px solid #8e63c7;border-radius:5px;background:#fffaff;padding:5px 7px;">
            <summary style="cursor:pointer;font-weight:800;color:#4a2e78;">Paramètres du sort</summary>
            <div style="margin-top:5px;font-size:12px;line-height:1.35;">
              <p><b>École :</b> ${add2eHtmlEscape(ADD2E_SORT_CONFIG.school)} — <b>Portée :</b> ${add2eHtmlEscape(ADD2E_SORT_CONFIG.rangeText)}.</p>
              <p><b>Zone :</b> ${add2eHtmlEscape(ADD2E_SORT_CONFIG.areaText)}.</p>
              <p><b>Incantation :</b> ${add2eHtmlEscape(ADD2E_SORT_CONFIG.castingTimeText)} — <b>Jet de sauvegarde :</b> ${add2eHtmlEscape(ADD2E_SORT_CONFIG.saveText)}.</p>
            </div>
          </details>
        </div>
      </div>`
  });
}

if (!ADD2E_ACTOR) {
  ui.notifications?.warn?.("Altération des feux normaux : acteur lanceur introuvable.");
  console.warn(`${ADD2E_ONUSE_TAG}[NO_ACTOR] Acteur lanceur introuvable : remboursement du slot mémorisé par le dispatcher.`);
  return false;
}

console.log(`${ADD2E_ONUSE_TAG}[START]`, {
  actor: ADD2E_ACTOR?.name,
  sort: ADD2E_ITEM?.name,
  mode: "chat_only",
  technicalEffect: false
});

await add2eChatAlterationFeuxNormaux(ADD2E_ACTOR);

console.log(`${ADD2E_ONUSE_TAG}[DONE]`, {
  consumedByDispatcher: true,
  technicalEffect: false
});

return true;
