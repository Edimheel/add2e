// ADD2E — onUse Magicien : Altération des feux normaux
// Version : 2026-07-01-magicien-alteration-feux-normaux-timed-effect-v4
//
// Le feu reste géré par l'arbitrage de jeu. L'ActiveEffect temporaire porté par
// le lanceur sert uniquement au suivi de la durée 1 round par niveau.
// Compatible Foundry V13/V14/V15.
//
// Contrat avec scripts/add2e-attack/06-cast-spell.mjs :
// - return true  => le sort est lancé, le slot mémorisé réservé est consommé ;
// - return false => annulation technique, le slot mémorisé réservé est remboursé.
// La consommation du slot n'est PAS faite ici : elle est centralisée dans add2eCastSpell.

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

function add2eNormalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function add2eCasterLevel(actorDoc) {
  try {
    const canonical = Number(globalThis.add2eCanonicalClassLevel?.(actorDoc, "magicien", 0));
    if (Number.isFinite(canonical) && canonical > 0) return Math.floor(canonical);
  } catch (_error) {}

  const classItem = Array.from(actorDoc?.items ?? []).find(entry => {
    if (String(entry?.type ?? "").toLowerCase() !== "classe") return false;
    return [entry.name, entry.system?.slug, entry.system?.label, entry.system?.nom, entry.system?.name]
      .map(add2eNormalize)
      .includes("magicien");
  }) ?? null;

  const classLevel = Number(classItem?.system?.niveau ?? classItem?.system?.level);
  if (Number.isFinite(classLevel) && classLevel > 0) return Math.floor(classLevel);

  const fallback = Number(
    actorDoc?.system?.niveau ??
    actorDoc?.system?.level ??
    actorDoc?.system?.details?.niveau ??
    actorDoc?.system?.details?.level ??
    1
  );
  return Math.max(1, Math.floor(Number.isFinite(fallback) ? fallback : 1));
}

function add2eGetCasterToken(actorDoc) {
  return ADD2E_TOKEN
    ?? ADD2E_ARGS?.[0]?.token
    ?? canvas?.tokens?.controlled?.find(t => t.actor?.id === actorDoc?.id)
    ?? actorDoc?.getActiveTokens?.()?.[0]
    ?? canvas?.tokens?.controlled?.[0]
    ?? null;
}

async function add2eCreateAlterationFeuxEffect(actorDoc, level) {
  const time = game.add2e?.time;
  if (typeof time?.effectData !== "function" || typeof time?.createTimedActiveEffect !== "function") {
    ui.notifications?.error?.("Altération des feux normaux : moteur de durée ADD2E indisponible.");
    return null;
  }

  const durationRounds = Math.max(1, Math.floor(Number(level) || 1));
  const effectData = time.effectData({
    name: ADD2E_SORT_CONFIG.name,
    img: ADD2E_ITEM?.img ?? ADD2E_SORT_CONFIG.imgFallback,
    origin: ADD2E_ITEM?.uuid ?? null,
    rounds: durationRounds,
    unit: "round",
    description: `Altération d'un feu normal active pendant ${durationRounds} round${durationRounds > 1 ? "s" : ""}.`,
    tags: [
      `sort:${ADD2E_SORT_CONFIG.slug}`,
      "classe:magicien",
      "liste:magicien",
      "niveau:1",
      "ecole:alteration",
      "etat:alteration_des_feux_normaux",
      "duree:1_round_par_niveau"
    ],
    changes: [],
    source: "spell",
    caster: actorDoc,
    sourceItem: ADD2E_ITEM,
    endMessage: `${ADD2E_SORT_CONFIG.name} prend fin sur {actor}.`,
    extraFlags: {
      spell: {
        slug: ADD2E_SORT_CONFIG.slug,
        name: ADD2E_SORT_CONFIG.name,
        class: "Magicien",
        level: ADD2E_SORT_CONFIG.level,
        casterLevel: durationRounds,
        durationRounds
      }
    }
  });

  effectData.type = "base";
  effectData.system ??= {};
  effectData.changes ??= [];

  const result = await time.createTimedActiveEffect(actorDoc, effectData, {
    removeTags: [`sort:${ADD2E_SORT_CONFIG.slug}`]
  });

  if (!result?.ok) {
    ui.notifications?.error?.("Altération des feux normaux : l'effet de durée n'a pas pu être créé.");
    return null;
  }

  return result.effect;
}

async function add2eChatAlterationFeuxNormaux(actorDoc, level) {
  const casterToken = add2eGetCasterToken(actorDoc);
  const casterName = actorDoc?.name ?? casterToken?.name ?? "Magicien";
  const casterImg = casterToken?.document?.texture?.src ?? actorDoc?.img ?? "icons/svg/mystery-man.svg";
  const spellImg = ADD2E_ITEM?.img ?? ADD2E_SORT_CONFIG.imgFallback;
  const durationRounds = Math.max(1, level);

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: actorDoc, token: casterToken }),
    content: `
      <div class="add2e-chat-card add2e-magicien-sort add2e-sort-chat-only add2e-sort-alteration-feux"
           style="border:1px solid #7b3f98;border-radius:8px;overflow:hidden;background:#f8f2fb;color:#34203d;font-family:var(--font-primary);">
        <div style="display:flex;align-items:center;gap:8px;background:linear-gradient(135deg,#351447,#6d2d82 65%,#8d4eac);color:#fff;padding:7px 9px;">
          <img src="${add2eHtmlEscape(casterImg)}" style="width:42px;height:42px;object-fit:cover;border-radius:50%;border:2px solid #ecdaf6;background:#fff;" />
          <div style="flex:1;line-height:1.05;">
            <div style="font-weight:800;font-size:14px;">${add2eHtmlEscape(casterName)}</div>
            <div style="font-size:12px;font-weight:700;">lance ${add2eHtmlEscape(ADD2E_SORT_CONFIG.name)}</div>
          </div>
          <div style="font-weight:800;font-size:12px;text-align:center;white-space:nowrap;">Magicien niv. 1</div>
          <img src="${add2eHtmlEscape(spellImg)}" style="width:34px;height:34px;object-fit:cover;border-radius:3px;border:1px solid #ecdaf6;background:#fff;" />
        </div>

        <div style="padding:9px 10px 10px 10px;background:#f8f2fb;">
          <div style="border:1px solid #b77bd0;border-radius:6px;background:#fffaff;padding:8px;text-align:center;margin-bottom:7px;">
            <div style="color:#6b2d82;font-weight:900;font-size:14px;text-transform:uppercase;letter-spacing:.3px;">Sort lancé</div>
            <div style="font-size:13px;line-height:1.35;text-align:left;">
              <p style="margin:.25em 0;">Les flammes normales frémissent et se plient à la volonté du magicien.</p>
              <p style="margin:.25em 0;">Leur éclat change d'intensité, sans que leur chaleur ne soit altérée.</p>
              <p style="margin:.25em 0;"><b>Durée :</b> ${add2eHtmlEscape(ADD2E_SORT_CONFIG.durationText)} (${durationRounds} round${durationRounds > 1 ? "s" : ""}).</p>
            </div>
          </div>

          <details style="border:1px solid #b77bd0;border-radius:5px;background:#fffaff;padding:5px 7px;">
            <summary style="cursor:pointer;font-weight:800;color:#54226a;">Paramètres du sort</summary>
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
  return false;
}

const ADD2E_CASTER_LEVEL = add2eCasterLevel(ADD2E_ACTOR);
const ADD2E_DURATION_EFFECT = await add2eCreateAlterationFeuxEffect(ADD2E_ACTOR, ADD2E_CASTER_LEVEL);
if (!ADD2E_DURATION_EFFECT) return false;

await add2eChatAlterationFeuxNormaux(ADD2E_ACTOR, ADD2E_CASTER_LEVEL);

return true;