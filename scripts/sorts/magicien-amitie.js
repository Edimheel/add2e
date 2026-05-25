// ADD2E — onUse Magicien : Amitié
// Version : 2026-05-25-magicien-amitie-v1
//
// Contrat avec scripts/add2e-attack/06-cast-spell.mjs :
// - return true  => sort réellement lancé, le slot mémorisé réservé est consommé ;
// - return false => annulation / cible invalide, le slot mémorisé réservé est remboursé.
// La consommation du slot n'est PAS faite ici : elle est centralisée dans add2eCastSpell.

const ADD2E_ONUSE_TAG = "[ADD2E][SORT_ONUSE][MAGICIEN][AMITIE]";
const ADD2E_ACTOR = typeof actor !== "undefined" ? actor : null;
const ADD2E_ITEM = typeof item !== "undefined" ? item : null;
const ADD2E_ARGS = typeof args !== "undefined" ? args : [];
const ADD2E_TOKEN = typeof token !== "undefined" ? token : null;

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

function add2eGetTargets() {
  return Array.from(game.user?.targets ?? []);
}

function add2eDuration(level) {
  return {
    rounds: Math.max(1, level),
    startRound: game.combat?.round ?? null,
    startTime: game.time?.worldTime ?? null,
    combat: game.combat?.id ?? null
  };
}

async function add2eRollFormula(formula) {
  const roll = await new Roll(formula).evaluate();
  return roll;
}

function add2eAreaRadiusText(level) {
  return `${1 + Math.max(1, level)}\"`;
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
          <p><b>${add2eHtmlEscape(ADD2E_SORT_CONFIG.name)}</b> modifie temporairement la réaction sociale envers le magicien.</p>

          <div class="form-group">
            <label>Résultat des jets de protection</label>
            <select name="mode">
              <option value="favorable">Créatures affectées : jets ratés, réaction favorable</option>
              <option value="irritated">Créatures résistantes : jets réussis, réaction irritée</option>
              <option value="mixed">Résolution mixte / note MD uniquement</option>
            </select>
          </div>

          <div class="form-group">
            <label>Note MD / contexte social</label>
            <textarea name="note" rows="3" placeholder="Ex. gardes de la porte, négociation avec un marchand, foule dans l’auberge..."></textarea>
          </div>

          <p style="font-size:12px;opacity:.85;margin-top:6px;">
            Le sort n'affecte pas les créatures d'intelligence animale ou inférieure.
          </p>
        </form>
      `,
      buttons: {
        cast: {
          label: "Lancer",
          callback: html => finish({
            mode: String(html.find("[name='mode']").val() ?? "favorable"),
            note: String(html.find("[name='note']").val() ?? "").trim()
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

async function add2eApplyCasterEffect(actorDoc, choice, level, roll) {
  if (!actorDoc || choice.mode === "mixed" || !roll) return false;

  const durationRounds = Math.max(1, level);
  const favorable = choice.mode === "favorable";
  const mod = Number(roll.total ?? 0) || 0;
  const signedMod = favorable ? mod : -mod;
  const effectName = favorable ? "Amitié — Charisme augmenté" : "Amitié — Charisme diminué";
  const reactionTag = favorable ? "reaction:favorable" : "reaction:irritee";
  const saveTag = favorable ? "jet_sauvegarde:echec" : "jet_sauvegarde:reussite";

  const tags = [
    "classe:magicien",
    "liste:magicien",
    "niveau:1",
    "sort:amitie",
    "ecole:enchantement_charme",
    "type:charme",
    "type:social",
    "influence:reaction",
    reactionTag,
    saveTag,
    `mod_charisme:${signedMod}`,
    favorable ? `bonus_charisme:${mod}` : `malus_charisme:${mod}`,
    `zone_rayon_pouces:${1 + Math.max(1, level)}`,
    "duree:1_round_par_niveau",
    `duree_rounds:${durationRounds}`,
    "jet_sauvegarde:special",
    "ignore:intelligence_animale_ou_moins",
    "composante:materielle_visage_craie_suie_vermillon",
    "memorisation:consommation_dispatcher"
  ];

  await actorDoc.createEmbeddedDocuments("ActiveEffect", [{
    name: effectName,
    img: ADD2E_ITEM?.img || ADD2E_SORT_CONFIG.imgFallback,
    disabled: false,
    transfer: false,
    type: "base",
    system: {},
    changes: [],
    duration: add2eDuration(level),
    description: [
      favorable
        ? `Amitié : charisme apparent augmenté de ${mod} point${mod > 1 ? "s" : ""} envers les créatures ayant raté leur jet.`
        : `Amitié : charisme apparent diminué de ${mod} point${mod > 1 ? "s" : ""} envers les créatures ayant réussi leur jet.`,
      `Durée : ${ADD2E_SORT_CONFIG.durationText}.`,
      choice.note ? `Note : ${choice.note}` : ""
    ].filter(Boolean).join("\n"),
    flags: {
      add2e: {
        tags,
        spell: {
          slug: ADD2E_SORT_CONFIG.slug,
          name: ADD2E_SORT_CONFIG.name,
          level: ADD2E_SORT_CONFIG.level,
          school: ADD2E_SORT_CONFIG.school,
          mode: choice.mode,
          charismaModifier: signedMod,
          casterLevel: level,
          durationRounds,
          areaRadiusInches: 1 + Math.max(1, level),
          sourceItemId: ADD2E_ITEM?.id ?? null,
          sourceItemUuid: ADD2E_ITEM?.uuid ?? null,
          note: choice.note ?? ""
        }
      }
    }
  }]);

  return true;
}

async function add2eApplyTargetEffects(targets, choice, level, roll) {
  if (!targets.length || choice.mode === "mixed") return [];

  const favorable = choice.mode === "favorable";
  const mod = Number(roll?.total ?? 0) || 0;
  const durationRounds = Math.max(1, level);
  const applied = [];

  const effectName = favorable ? "Amitié — réaction favorable" : "Amitié — réaction irritée";
  const tags = [
    "classe:magicien",
    "liste:magicien",
    "niveau:1",
    "sort:amitie",
    "ecole:enchantement_charme",
    "type:charme",
    "type:social",
    "influence:reaction",
    favorable ? "reaction:favorable" : "reaction:irritee",
    favorable ? "etat:impression_favorable" : "etat:irrite",
    favorable ? "attitude:aide_le_magicien" : "attitude:hostile_au_magicien",
    favorable ? `bonus_charisme_lanceur:${mod}` : `malus_charisme_lanceur:${mod}`,
    "duree:1_round_par_niveau",
    `duree_rounds:${durationRounds}`,
    "jet_sauvegarde:special"
  ];

  for (const target of targets) {
    if (!target?.actor) continue;
    await target.actor.createEmbeddedDocuments("ActiveEffect", [{
      name: effectName,
      img: ADD2E_ITEM?.img || ADD2E_SORT_CONFIG.imgFallback,
      disabled: false,
      transfer: false,
      type: "base",
      system: {},
      changes: [],
      duration: add2eDuration(level),
      description: favorable
        ? `Amitié : la cible est favorablement impressionnée par ${ADD2E_ACTOR?.name ?? "le magicien"}.`
        : `Amitié : la cible résiste et se montre irritée envers ${ADD2E_ACTOR?.name ?? "le magicien"}.`,
      flags: { add2e: { tags } }
    }]);
    applied.push(target);
  }

  return applied;
}

async function add2eChatAmitie(actorDoc, choice, targets, level, roll, appliedTargets, casterEffectApplied) {
  const casterToken = add2eGetCasterToken(actorDoc);
  const casterName = actorDoc?.name ?? casterToken?.name ?? "Magicien";
  const casterImg = casterToken?.document?.texture?.src ?? actorDoc?.img ?? "icons/svg/mystery-man.svg";
  const spellImg = ADD2E_ITEM?.img ?? ADD2E_SORT_CONFIG.imgFallback;
  const radiusText = add2eAreaRadiusText(level);
  const durationRounds = Math.max(1, level);
  const targetLabel = targets.length ? targets.map(t => t.name).join(", ") : (choice.note || "Créatures dans la sphère, selon MD");

  let outcome = "Résolution spéciale";
  let outcomeBody = "Le MD résout les jets de protection et les réactions créature par créature.";

  if (choice.mode === "favorable") {
    outcome = "Réaction favorable";
    outcomeBody = `Jet indicatif : <b>${add2eHtmlEscape(String(roll?.total ?? ""))}</b> sur <b>2d4</b>. Les créatures qui ratent leur jet sont favorablement impressionnées et désirent aider le magicien.`;
  } else if (choice.mode === "irritated") {
    outcome = "Réaction irritée";
    outcomeBody = `Jet indicatif : <b>${add2eHtmlEscape(String(roll?.total ?? ""))}</b> sur <b>1d4</b>. Les créatures qui réussissent leur jet n'apprécient pas la présence du magicien et sont irritées.`;
  }

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
          <div style="font-size:13px;margin:0 0 6px 0;"><b>Zone sociale :</b> ${add2eHtmlEscape(targetLabel)}</div>

          <div style="border:1px solid #8e63c7;border-radius:6px;background:#fffaff;padding:8px;text-align:center;margin-bottom:7px;">
            <div style="color:#6c31b5;font-weight:900;font-size:14px;text-transform:uppercase;letter-spacing:.3px;">${add2eHtmlEscape(outcome)}</div>
            <div style="font-size:13px;line-height:1.35;text-align:left;">
              <p style="margin:.25em 0;">${outcomeBody}</p>
              <p style="margin:.25em 0;"><b>Rayon :</b> ${add2eHtmlEscape(radiusText)} autour du magicien.</p>
              <p style="margin:.25em 0;"><b>Durée :</b> ${add2eHtmlEscape(ADD2E_SORT_CONFIG.durationText)} (${durationRounds} round${durationRounds > 1 ? "s" : ""}).</p>
              <p style="margin:.25em 0;"><b>Effets créés :</b> ${casterEffectApplied ? "effet actif sur le magicien" : "aucun effet automatique sur le magicien"}${appliedTargets.length ? `, ${appliedTargets.length} cible(s) marquée(s)` : ""}.</p>
              ${choice.note ? `<p style="margin:.25em 0;"><b>Note :</b> ${add2eHtmlEscape(choice.note)}</p>` : ""}
            </div>
          </div>

          <details style="border:1px solid #8e63c7;border-radius:5px;background:#fffaff;padding:5px 7px;">
            <summary style="cursor:pointer;font-weight:800;color:#4a2e78;">Règle appliquée</summary>
            <div style="margin-top:5px;font-size:12px;line-height:1.35;">
              <p><b>Portée :</b> ${add2eHtmlEscape(ADD2E_SORT_CONFIG.rangeText)} — <b>Zone :</b> ${add2eHtmlEscape(ADD2E_SORT_CONFIG.areaText)}.</p>
              <p><b>Composantes :</b> V, S, M — <b>Incantation :</b> ${add2eHtmlEscape(ADD2E_SORT_CONFIG.castingTimeText)} — <b>Jet de protection :</b> ${add2eHtmlEscape(ADD2E_SORT_CONFIG.saveText)}.</p>
              <p>Échec du jet : charisme apparent du magicien augmenté de 2d4. Réussite du jet : charisme apparent diminué de 1d4. Intelligence animale ou inférieure : aucun effet.</p>
              <p><b>Composante matérielle :</b> ${add2eHtmlEscape(ADD2E_SORT_CONFIG.materialText)} appliqués sur le visage.</p>
              <p>Le slot mémorisé est consommé par le dispatcher ADD2E uniquement si ce script retourne <code>true</code>.</p>
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
const targets = add2eGetTargets();
let roll = null;

if (choice.mode === "favorable") roll = await add2eRollFormula("2d4");
if (choice.mode === "irritated") roll = await add2eRollFormula("1d4");

console.log(`${ADD2E_ONUSE_TAG}[START]`, {
  actor: ADD2E_ACTOR?.name,
  sort: ADD2E_ITEM?.name,
  level,
  choice,
  roll: roll?.total ?? null,
  targets: targets.map(t => ({ name: t.name, actor: t.actor?.name }))
});

const casterEffectApplied = await add2eApplyCasterEffect(ADD2E_ACTOR, choice, level, roll);
const appliedTargets = await add2eApplyTargetEffects(targets, choice, level, roll);

await add2eChatAmitie(ADD2E_ACTOR, choice, targets, level, roll, appliedTargets, casterEffectApplied);

console.log(`${ADD2E_ONUSE_TAG}[DONE]`, {
  consumedByDispatcher: true,
  casterEffectApplied,
  appliedTargets: appliedTargets.map(t => t.name),
  mode: choice.mode,
  roll: roll?.total ?? null,
  durationRounds: Math.max(1, level),
  areaRadiusInches: 1 + Math.max(1, level)
});

return true;
