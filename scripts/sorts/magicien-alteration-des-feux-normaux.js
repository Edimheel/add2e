// ADD2E — onUse Magicien : Altération des feux normaux
// Version : 2026-05-24-magicien-alteration-feux-normaux-v1
//
// Contrat avec scripts/add2e-attack/06-cast-spell.mjs :
// - return true  => sort réellement lancé, le slot mémorisé réservé est consommé ;
// - return false => annulation / cible invalide, le slot mémorisé réservé est remboursé.
// La consommation du slot n'est PAS faite ici : elle est centralisée dans add2eCastSpell.

const ADD2E_ONUSE_TAG = "[ADD2E][SORT_ONUSE][MAGICIEN][ALTERATION_FEUX_NORMAUX]";

const ADD2E_SORT_CONFIG = {
  name: "Altération des feux normaux",
  slug: "alteration_des_feux_normaux",
  level: 1,
  school: "Altération",
  rangeText: "1/2\" par niveau",
  durationText: "1 round par niveau",
  castingTimeText: "1 segment",
  saveText: "Aucun",
  areaText: "feu de 90 cm de diamètre maximum",
  maxDiameterCm: 90
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
  return token ?? canvas?.tokens?.controlled?.find(t => t.actor?.id === actorDoc?.id) ?? actorDoc?.getActiveTokens?.()?.[0] ?? canvas?.tokens?.controlled?.[0] ?? null;
}

function add2eGetTargets() {
  return Array.from(game.user?.targets ?? []);
}

function add2eEffectDuration(level) {
  return {
    rounds: Math.max(1, level),
    startRound: game.combat?.round ?? null,
    startTime: game.time?.worldTime ?? null,
    combat: game.combat?.id ?? null
  };
}

async function add2eAskAlterationFeuxNormaux() {
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
        <form class="add2e-dialog add2e-alteration-feux-dialog">
          <p><b>${add2eHtmlEscape(ADD2E_SORT_CONFIG.name)}</b> modifie une source de feu normal sans changer sa chaleur.</p>

          <div class="form-group">
            <label>Effet</label>
            <select name="mode">
              <option value="increase">Augmenter le feu / la lumière</option>
              <option value="reduce">Réduire le feu / la lumière</option>
            </select>
          </div>

          <div class="form-group">
            <label>Source de feu visée</label>
            <input type="text" name="source" placeholder="Ex. torche, lanterne, brasero, feu de camp..." />
          </div>

          <div class="form-group">
            <label>Note MD</label>
            <textarea name="note" rows="3" placeholder="Précision de scène, combustible, emplacement, visibilité..."></textarea>
          </div>

          <p style="font-size:12px;opacity:.85;margin-top:6px;">
            Zone maximale : feu normal de 90 cm de diamètre. La chaleur n'est pas modifiée.
          </p>
        </form>
      `,
      buttons: {
        cast: {
          label: "Lancer",
          callback: html => finish({
            mode: String(html.find("[name='mode']").val() ?? "increase"),
            source: String(html.find("[name='source']").val() ?? "").trim(),
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

async function add2eApplyFireEffect(targetActor, choice, level) {
  if (!targetActor) return false;

  const modeTag = choice.mode === "reduce" ? "reduction" : "augmentation";
  const effectName = choice.mode === "reduce" ? "Feu normal réduit" : "Feu normal augmenté";
  const durationRounds = Math.max(1, level);

  const tags = [
    "classe:magicien",
    "liste:magicien",
    "niveau:1",
    "sort:alteration_des_feux_normaux",
    "ecole:alteration",
    "type:environnement",
    "type:feu",
    "feu:normal",
    `mode:${modeTag}`,
    "chaleur:inchangee",
    choice.mode === "reduce" ? "combustible:demi_consommation" : "combustible:double_consommation",
    choice.mode === "reduce" ? "luminosite:allumette" : "luminosite:lumiere",
    "diametre_max_cm:90",
    "duree:1_round_par_niveau",
    `duree_rounds:${durationRounds}`,
    "jet_sauvegarde:aucun",
    "memorisation:consommation_dispatcher"
  ];

  await targetActor.createEmbeddedDocuments("ActiveEffect", [{
    name: effectName,
    img: item?.img || "icons/magic/fire/flame-burning-orange.webp",
    disabled: false,
    transfer: false,
    type: "base",
    system: {},
    changes: [],
    duration: add2eEffectDuration(level),
    description: [
      `${effectName} par ${ADD2E_SORT_CONFIG.name}.`,
      `Source : ${choice.source || "source de feu normal indiquée par le MD"}.`,
      `Durée : ${ADD2E_SORT_CONFIG.durationText}.`,
      "La chaleur dégagée n'est pas modifiée.",
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
          mode: modeTag,
          source: choice.source ?? "",
          maxDiameterCm: ADD2E_SORT_CONFIG.maxDiameterCm,
          heatChanged: false,
          casterLevel: level,
          durationRounds,
          sourceItemId: item?.id ?? null,
          sourceItemUuid: item?.uuid ?? null,
          note: choice.note ?? ""
        }
      }
    }
  }]);

  return true;
}

async function add2eChatAlterationFeuxNormaux(actorDoc, choice, targets, level, appliedTargets) {
  const casterToken = add2eGetCasterToken(actorDoc);
  const casterName = actorDoc?.name ?? casterToken?.name ?? "Magicien";
  const casterImg = casterToken?.document?.texture?.src ?? actorDoc?.img ?? "icons/svg/mystery-man.svg";
  const spellImg = item?.img ?? "icons/magic/fire/flame-burning-orange.webp";
  const modeLabel = choice.mode === "reduce" ? "Réduction du feu" : "Augmentation du feu";
  const sourceLabel = choice.source || (appliedTargets.length ? appliedTargets.map(t => t.name).join(", ") : "Source de feu indiquée par le MD");
  const durationRounds = Math.max(1, level);

  const luminosity = choice.mode === "reduce"
    ? "taille et lumière ramenées à l'intensité d'une allumette"
    : "taille et lumière portées jusqu'à l'intensité d'un sort de lumière";

  const fuel = choice.mode === "reduce"
    ? "consommation du combustible divisée par deux"
    : "consommation du combustible doublée";

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: actorDoc, token: casterToken }),
    content: `
      <div class="add2e-chat-card add2e-magicien-sort add2e-sort-alteration-feux"
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
          <div style="font-size:13px;margin:0 0 6px 0;"><b>Source :</b> ${add2eHtmlEscape(sourceLabel)}</div>

          <div style="border:1px solid #8e63c7;border-radius:6px;background:#fffaff;padding:8px;text-align:center;margin-bottom:7px;">
            <div style="color:#6c31b5;font-weight:900;font-size:14px;text-transform:uppercase;letter-spacing:.3px;">${add2eHtmlEscape(modeLabel)}</div>
            <div style="font-size:13px;line-height:1.35;text-align:left;">
              <p style="margin:.25em 0;"><b>Lumière :</b> ${add2eHtmlEscape(luminosity)}.</p>
              <p style="margin:.25em 0;"><b>Combustible :</b> ${add2eHtmlEscape(fuel)}.</p>
              <p style="margin:.25em 0;"><b>Chaleur :</b> inchangée.</p>
              <p style="margin:.25em 0;"><b>Durée :</b> ${add2eHtmlEscape(ADD2E_SORT_CONFIG.durationText)} (${durationRounds} round${durationRounds > 1 ? "s" : ""}).</p>
              ${choice.note ? `<p style="margin:.25em 0;"><b>Note :</b> ${add2eHtmlEscape(choice.note)}</p>` : ""}
            </div>
          </div>

          <details style="border:1px solid #8e63c7;border-radius:5px;background:#fffaff;padding:5px 7px;">
            <summary style="cursor:pointer;font-weight:800;color:#4a2e78;">Règle appliquée</summary>
            <div style="margin-top:5px;font-size:12px;line-height:1.35;">
              <p><b>Portée :</b> ${add2eHtmlEscape(ADD2E_SORT_CONFIG.rangeText)} — <b>Zone :</b> ${add2eHtmlEscape(ADD2E_SORT_CONFIG.areaText)}.</p>
              <p><b>Incantation :</b> ${add2eHtmlEscape(ADD2E_SORT_CONFIG.castingTimeText)} — <b>Jet de protection :</b> ${add2eHtmlEscape(ADD2E_SORT_CONFIG.saveText)}.</p>
              <p>Le sort ne fonctionne normalement pas sous l'eau, sauf dans les limites d'un sort d'eau aérée.</p>
              <p>Le slot mémorisé est consommé par le dispatcher ADD2E uniquement si ce script retourne <code>true</code>.</p>
            </div>
          </details>
        </div>
      </div>`
  });
}

const choice = await add2eAskAlterationFeuxNormaux();
if (!choice) {
  console.log(`${ADD2E_ONUSE_TAG}[CANCEL] Sort annulé : remboursement du slot mémorisé par le dispatcher.`);
  return false;
}

if (!choice.source && !add2eGetTargets().length) {
  ui.notifications?.warn?.("Altération des feux normaux : indique une source de feu ou cible un token/acteur représentant la source.");
  console.warn(`${ADD2E_ONUSE_TAG}[NO_SOURCE] Aucune source de feu indiquée.`);
  return false;
}

const level = add2eCasterLevel(actor);
const targets = add2eGetTargets();
const appliedTargets = [];

console.log(`${ADD2E_ONUSE_TAG}[START]`, {
  actor: actor?.name,
  sort: item?.name,
  level,
  choice,
  targets: targets.map(t => ({ name: t.name, actor: t.actor?.name }))
});

for (const target of targets) {
  if (!target?.actor) continue;
  const ok = await add2eApplyFireEffect(target.actor, choice, level);
  if (ok) appliedTargets.push(target);
}

await add2eChatAlterationFeuxNormaux(actor, choice, targets, level, appliedTargets);

console.log(`${ADD2E_ONUSE_TAG}[DONE]`, {
  consumedByDispatcher: true,
  appliedTargets: appliedTargets.map(t => t.name),
  mode: choice.mode,
  source: choice.source,
  durationRounds: Math.max(1, level)
});

return true;
