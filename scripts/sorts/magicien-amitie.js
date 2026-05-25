// ADD2E — onUse Magicien : Amitié
// Version : 2026-05-25-magicien-amitie-charisme-socket-v1
//
// Contrat avec scripts/add2e-attack/06-cast-spell.mjs :
// - return true  => le sort est lancé, le slot mémorisé réservé est consommé ;
// - return false => annulation technique, le slot mémorisé réservé est remboursé.
// La consommation du slot n'est PAS faite ici : elle est centralisée dans add2eCastSpell.

const ADD2E_ONUSE_TAG = "[ADD2E][SORT_ONUSE][MAGICIEN][AMITIE]";
const ADD2E_ACTOR = typeof actor !== "undefined" ? actor : null;
const ADD2E_ITEM = typeof item !== "undefined" ? item : null;
const ADD2E_TOKEN = typeof token !== "undefined" ? token : null;
const ADD2E_ARGS = typeof args !== "undefined" ? args : [];

const ADD2E_SORT_CONFIG = {
  name: "Amitié",
  slug: "amitie",
  level: 1,
  school: "Enchantement/Charme",
  rangeText: "0",
  durationText: "1 round par niveau",
  castingTimeText: "1 segment",
  saveText: "Spécial",
  areaText: "sphère d’un rayon de 1\" + 1\" par niveau",
  materialText: "craie ou farine blanche, noir de fumée ou suie, vermillon",
  imgFallback: "icons/magic/control/hypnosis-mesmerism-eye.webp"
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

function add2eAreaRadiusText(level) {
  return `${1 + Math.max(1, level)}\"`;
}

async function add2eRollFormula(formula) {
  return await new Roll(formula).evaluate({ async: true });
}

function add2eEffectDuration(level) {
  return {
    rounds: Math.max(1, level),
    startRound: game.combat?.round ?? null,
    startTime: game.time?.worldTime ?? null,
    combat: game.combat?.id ?? null
  };
}

async function add2eAskAmitie() {
  return await new Promise(resolve => {
    let done = false;
    const finish = value => {
      if (done) return;
      done = true;
      resolve(value);
    };

    new Dialog({
      title: ADD2E_SORT_CONFIG.name,
      content: `
        <form class="add2e-dialog add2e-amitie-dialog">
          <p><b>${add2eHtmlEscape(ADD2E_SORT_CONFIG.name)}</b></p>
          <p>Indique le résultat général de la réaction autour du magicien.</p>

          <div class="form-group">
            <label>Réaction dominante</label>
            <select name="mode">
              <option value="favorable">Les créatures sont favorablement impressionnées</option>
              <option value="irritated">Les créatures résistent et se montrent irritées</option>
              <option value="neutral">Résolution manuelle par le MD</option>
            </select>
          </div>
        </form>
      `,
      buttons: {
        cast: {
          label: "Lancer",
          callback: html => finish({
            mode: String(html.find("[name='mode']").val() ?? "favorable")
          })
        },
        cancel: {
          label: "Annuler",
          callback: () => finish(null)
        }
      },
      default: "cast",
      close: () => finish(null)
    }).render(true);
  });
}

function add2eBuildAmitieEffect({ choice, level, roll }) {
  if (!choice || choice.mode === "neutral" || !roll) return null;

  const favorable = choice.mode === "favorable";
  const amount = Math.max(1, Number(roll.total) || 1);
  const signedAmount = favorable ? amount : -amount;
  const mode = foundry?.CONST?.ACTIVE_EFFECT_MODES?.ADD ?? CONST?.ACTIVE_EFFECT_MODES?.ADD ?? 2;

  return {
    name: favorable ? "Amitié — charisme renforcé" : "Amitié — charisme troublé",
    img: ADD2E_ITEM?.img || ADD2E_SORT_CONFIG.imgFallback,
    disabled: false,
    transfer: false,
    type: "base",
    system: {},
    changes: [
      {
        key: "system.charisme",
        mode,
        value: String(signedAmount),
        priority: 20
      }
    ],
    duration: add2eEffectDuration(level),
    description: favorable
      ? `Amitié : charisme modifié de +${amount} pendant ${Math.max(1, level)} round${Math.max(1, level) > 1 ? "s" : ""}.`
      : `Amitié : charisme modifié de -${amount} pendant ${Math.max(1, level)} round${Math.max(1, level) > 1 ? "s" : ""}.`,
    flags: {
      add2e: {
        tags: [
          "classe:magicien",
          "liste:magicien",
          "niveau:1",
          "sort:amitie",
          "ecole:enchantement_charme",
          "type:charme",
          "type:social",
          "bonus:charisme",
          favorable ? "reaction:favorable" : "reaction:irritee",
          favorable ? `bonus_charisme:${amount}` : `malus_charisme:${amount}`,
          "duree:1_round_par_niveau",
          `duree_rounds:${Math.max(1, level)}`,
          "jet_sauvegarde:special"
        ],
        spell: {
          slug: ADD2E_SORT_CONFIG.slug,
          name: ADD2E_SORT_CONFIG.name,
          level: ADD2E_SORT_CONFIG.level,
          school: ADD2E_SORT_CONFIG.school,
          mode: choice.mode,
          charismaModifier: signedAmount,
          rollFormula: favorable ? "2d4" : "1d4",
          rollTotal: amount,
          casterLevel: level,
          durationRounds: Math.max(1, level),
          areaRadiusInches: 1 + Math.max(1, level),
          sourceItemId: ADD2E_ITEM?.id ?? null,
          sourceItemUuid: ADD2E_ITEM?.uuid ?? null
        }
      }
    }
  };
}

async function add2eApplyEffectOnCaster(actorDoc, effectData) {
  if (!actorDoc || !effectData) return false;

  const payload = {
    actorUuid: actorDoc.uuid,
    actorId: actorDoc.id,
    sceneId: canvas?.scene?.id ?? null,
    tokenId: add2eGetCasterToken(actorDoc)?.document?.id ?? add2eGetCasterToken(actorDoc)?.id ?? null,
    effectData
  };

  if (game.user?.isGM || actorDoc.isOwner) {
    try {
      await actorDoc.createEmbeddedDocuments("ActiveEffect", [foundry.utils.duplicate(effectData)]);
      return true;
    } catch (err) {
      console.warn(`${ADD2E_ONUSE_TAG}[DIRECT_EFFECT_FAILED] Passage par relais MJ.`, err);
    }
  }

  game.socket?.emit?.("system.add2e", {
    type: "ADD2E_GM_OPERATION",
    operation: "createActiveEffect",
    payload
  });

  return true;
}

async function add2eChatAmitie(actorDoc, choice, roll) {
  const casterToken = add2eGetCasterToken(actorDoc);
  const casterName = actorDoc?.name ?? casterToken?.name ?? "Magicien";
  const casterImg = casterToken?.document?.texture?.src ?? actorDoc?.img ?? "icons/svg/mystery-man.svg";
  const spellImg = ADD2E_ITEM?.img ?? ADD2E_SORT_CONFIG.imgFallback;
  const level = add2eCasterLevel(actorDoc);
  const durationRounds = Math.max(1, level);
  const radiusText = add2eAreaRadiusText(level);

  let outcome = "L’enchantement se répand autour du magicien.";
  if (choice?.mode === "favorable" && roll) outcome = `Les paroles du magicien gagnent en chaleur et en assurance. Son charisme apparent augmente de ${add2eHtmlEscape(String(roll.total))}.`;
  if (choice?.mode === "irritated" && roll) outcome = `Le charme se heurte à une résistance hostile. Son charisme apparent diminue de ${add2eHtmlEscape(String(roll.total))}.`;
  if (choice?.mode === "neutral") outcome = "L’enchantement trouble les réactions autour du magicien ; le MD en détermine les conséquences.";

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: actorDoc, token: casterToken }),
    content: `
      <div class="add2e-chat-card add2e-magicien-sort add2e-sort-amitie"
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
              <p style="margin:.25em 0;">Le visage du magicien se pare de signes colorés et son aura devient plus marquante.</p>
              <p style="margin:.25em 0;">${outcome}</p>
              <p style="margin:.25em 0;"><b>Rayon :</b> ${add2eHtmlEscape(radiusText)} autour du magicien.</p>
              <p style="margin:.25em 0;"><b>Durée :</b> ${add2eHtmlEscape(ADD2E_SORT_CONFIG.durationText)} (${durationRounds} round${durationRounds > 1 ? "s" : ""}).</p>
            </div>
          </div>

          <details style="border:1px solid #8e63c7;border-radius:5px;background:#fffaff;padding:5px 7px;">
            <summary style="cursor:pointer;font-weight:800;color:#4a2e78;">Paramètres du sort</summary>
            <div style="margin-top:5px;font-size:12px;line-height:1.35;">
              <p><b>École :</b> ${add2eHtmlEscape(ADD2E_SORT_CONFIG.school)} — <b>Portée :</b> ${add2eHtmlEscape(ADD2E_SORT_CONFIG.rangeText)}.</p>
              <p><b>Zone :</b> ${add2eHtmlEscape(ADD2E_SORT_CONFIG.areaText)}.</p>
              <p><b>Composantes :</b> V, S, M — <b>Incantation :</b> ${add2eHtmlEscape(ADD2E_SORT_CONFIG.castingTimeText)} — <b>Jet de sauvegarde :</b> ${add2eHtmlEscape(ADD2E_SORT_CONFIG.saveText)}.</p>
              <p><b>Composante matérielle :</b> ${add2eHtmlEscape(ADD2E_SORT_CONFIG.materialText)} appliqués sur le visage.</p>
            </div>
          </details>
        </div>
      </div>`
  });
}

const choice = await add2eAskAmitie();
if (!choice) {
  console.log(`${ADD2E_ONUSE_TAG}[CANCEL] Sort annulé : remboursement du slot mémorisé par le dispatcher.`);
  return false;
}

if (!ADD2E_ACTOR) {
  ui.notifications?.warn?.("Amitié : acteur lanceur introuvable.");
  console.warn(`${ADD2E_ONUSE_TAG}[NO_ACTOR] Acteur lanceur introuvable.`);
  return false;
}

const level = add2eCasterLevel(ADD2E_ACTOR);
let roll = null;
if (choice.mode === "favorable") roll = await add2eRollFormula("2d4");
if (choice.mode === "irritated") roll = await add2eRollFormula("1d4");

const effectData = add2eBuildAmitieEffect({ choice, level, roll });
const effectRequested = await add2eApplyEffectOnCaster(ADD2E_ACTOR, effectData);

console.log(`${ADD2E_ONUSE_TAG}[START]`, {
  actor: ADD2E_ACTOR?.name,
  sort: ADD2E_ITEM?.name,
  level,
  choice,
  roll: roll?.total ?? null,
  effectRequested,
  viaSocketIfNeeded: true
});

await add2eChatAmitie(ADD2E_ACTOR, choice, roll);

console.log(`${ADD2E_ONUSE_TAG}[DONE]`, {
  consumedByDispatcher: true,
  effectRequested,
  mode: choice.mode,
  roll: roll?.total ?? null,
  durationRounds: Math.max(1, level),
  areaRadiusInches: 1 + Math.max(1, level)
});

return true;
