// ADD2E — onUse Clerc niveau 4 : Exorcisme
// Version : 2026-05-05-clerc-n4-exorcisme-v1
// Retour attendu par le moteur ADD2E : true = sort consommé, false = sort non consommé.

const ADD2E_SORT_CONFIG = {
  name: "Exorcisme",
  slug: "exorcisme",
  level: 4,
  classe: "Clerc",
  description: "Exorcisme tente de chasser une présence surnaturelle, une possession, un esprit, une influence extraplanaire ou une force étrangère d’une créature, d’un objet ou d’un lieu.",
  effectTags: [
    "sort:exorcisme",
    "classe:clerc",
    "liste:clerc",
    "niveau:4",
    "exorcisme",
    "bannissement",
    "possession",
    "retire:possession",
    "retire:controle",
    "retire:esprit",
    "anti:extraplanaire",
    "jet_sauvegarde:annule"
  ],
  removeTags: [
    "etat:possession",
    "possession",
    "controle:esprit",
    "controle",
    "charme",
    "domination",
    "esprit",
    "entite",
    "extraplanaire"
  ]
};

const ADD2E_ONUSE_TAG = "[ADD2E][SORT_ONUSE][CLERC_N4][EXORCISME]";

function add2eHtmlEscape(value) {
  const div = document.createElement("div");
  div.innerText = String(value ?? "");
  return div.innerHTML;
}

function add2eGetCasterToken() {
  return token ?? args?.[0]?.token ?? canvas?.tokens?.controlled?.[0] ?? null;
}

function add2eGetTargets({ fallbackCaster = false } = {}) {
  const targets = Array.from(game.user.targets ?? []);
  if (targets.length) return targets;
  const casterToken = add2eGetCasterToken();
  return (fallbackCaster && casterToken) ? [casterToken] : [];
}

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

          <details style="border:1px solid #e0ae37;border-radius:5px;background:#fffdf5;padding:5px 7px;">
            <summary style="cursor:pointer;font-weight:800;color:#6a4611;">Règle appliquée</summary>
            <div style="margin-top:5px;font-size:12px;line-height:1.35;">${rule || "Effet du sort appliqué selon sa description et l’arbitrage du MD."}</div>
          </details>
        </div>
      </div>`
  });
}

async function add2eApplyTaggedEffect(targetActor, { name, img, tags, description = "" }) {
  if (!targetActor) return false;

  const data = {
    name,
    img: img || item?.img || "icons/svg/aura.svg",
    disabled: false,
    transfer: false,
    type: "base",
    system: {},
    changes: [],
    duration: {
      startRound: game.combat?.round ?? null,
      startTime: game.time?.worldTime ?? null,
      combat: game.combat?.id ?? null
    },
    description,
    flags: { add2e: { tags: tags ?? [] } }
  };

  try {
    await targetActor.createEmbeddedDocuments("ActiveEffect", [data]);
    return true;
  } catch (e) {
    console.warn(`${ADD2E_ONUSE_TAG}[EFFECT_CREATE_FAILED]`, {
      sort: ADD2E_SORT_CONFIG.name,
      target: targetActor.name,
      error: e
    });
    return false;
  }
}

async function add2eRemovePossessionEffects(targetActor) {
  if (!targetActor?.effects) return 0;

  const removeTags = ADD2E_SORT_CONFIG.removeTags.map(t => String(t).toLowerCase());
  const toDelete = [];

  for (const ef of targetActor.effects) {
    const tags = (ef.flags?.add2e?.tags ?? []).map(t => String(t).toLowerCase());
    const name = String(ef.name ?? "").toLowerCase();

    const matched = removeTags.some(t => {
      const clean = t.replace("etat:", "").replace("controle:", "");
      return tags.includes(t) || tags.includes(clean) || name.includes(clean);
    });

    if (matched) toDelete.push(ef.id);
  }

  if (!toDelete.length) return 0;

  try {
    await targetActor.deleteEmbeddedDocuments("ActiveEffect", toDelete);
    return toDelete.length;
  } catch (e) {
    console.warn(`${ADD2E_ONUSE_TAG}[REMOVE_FAILED]`, {
      target: targetActor.name,
      ids: toDelete,
      error: e
    });
    return 0;
  }
}

async function add2eAskExorcismResult() {
  return await new Promise(resolve => {
    let done = false;
    const finish = value => {
      if (done) return;
      done = true;
      resolve(value);
    };

    const content = `
      <form>
        <p><b>Exorcisme</b></p>
        <p>Choisis le résultat après résolution par le MD.</p>
        <div class="form-group">
          <label>Note / entité / difficulté</label>
          <textarea name="note" rows="3" placeholder="Ex : possession démoniaque, esprit lié à l'objet, lieu hanté..."></textarea>
        </div>
      </form>
    `;

    new Dialog({
      title: "Exorcisme — Résultat",
      content,
      buttons: {
        success: {
          label: "Succès : retirer possession",
          callback: html => finish({
            result: "success",
            note: html?.find?.("[name='note']")?.val?.() ?? ""
          })
        },
        mark: {
          label: "Noter tentative",
          callback: html => finish({
            result: "mark",
            note: html?.find?.("[name='note']")?.val?.() ?? ""
          })
        },
        cancel: {
          label: "Annuler",
          callback: () => finish(null)
        }
      },
      default: "mark",
      close: () => finish(null)
    }).render(true);
  });
}

const targets = add2eGetTargets({ fallbackCaster: false });

if (!targets.length) {
  ui.notifications.warn("Exorcisme : cible obligatoire.");
  return false;
}

const choice = await add2eAskExorcismResult();

if (!choice) {
  ui.notifications.info("Exorcisme annulé.");
  return false;
}

console.log(`${ADD2E_ONUSE_TAG}[START]`, {
  sort: ADD2E_SORT_CONFIG.name,
  actor: actor?.name,
  result: choice.result,
  targets: targets.map(t => t.name),
  note: choice.note
});

let removed = 0;

if (choice.result === "success") {
  for (const t of targets) {
    removed += await add2eRemovePossessionEffects(t.actor);

    await add2eApplyTaggedEffect(t.actor, {
      name: "Exorcisme réussi",
      img: item?.img,
      tags: [
        "sort:exorcisme",
        "classe:clerc",
        "liste:clerc",
        "niveau:4",
        "exorcisme:reussi",
        "possession:retiree"
      ],
      description: `Exorcisme réussi par ${actor?.name ?? "un clerc"}. ${choice.note ?? ""}`
    });
  }

  await add2eChat("Exorcisme", `
    <p>La possession ou l’influence surnaturelle est chassée selon la décision du MD.</p>
    <p>Effets retirés automatiquement : <b>${removed}</b>.</p>
    ${choice.note ? `<p><b>Note :</b> ${add2eHtmlEscape(choice.note)}</p>` : ""}
  `, null, {
    targetLabel: targets.map(t => t.name).join(", "),
    outcome: "EXORCISME RÉUSSI",
    rule: "En cas de réussite, l’entité, possession ou influence étrangère est expulsée ou rompue. Les effets actifs portant des tags de possession/contrôle/esprit sont retirés si présents."
  });

  return true;
}

for (const t of targets) {
  await add2eApplyTaggedEffect(t.actor, {
    name: "Tentative d’Exorcisme",
    img: item?.img,
    tags: ADD2E_SORT_CONFIG.effectTags,
    description: `Tentative d’exorcisme par ${actor?.name ?? "un clerc"}. ${choice.note ?? ""}`
  });
}

await add2eChat("Exorcisme", `
  <p>Tentative d’exorcisme notée sur la cible.</p>
  ${choice.note ? `<p><b>Note :</b> ${add2eHtmlEscape(choice.note)}</p>` : ""}
`, null, {
  targetLabel: targets.map(t => t.name).join(", "),
  outcome: "TENTATIVE NOTÉE",
  rule: "Le MD résout l’exorcisme selon la puissance de l’entité, le lieu, les protections en place et le niveau du clerc. Aucun effet de possession n’est retiré automatiquement dans ce mode."
});

return true;
