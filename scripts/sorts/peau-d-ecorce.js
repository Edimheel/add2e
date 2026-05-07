// ADD2E — onUse Clerc niveau 2 : Peau d’Écorce
// Version : 2026-05-05-clerc-n2-v2
// Retour attendu par le moteur ADD2E : true = sort consommé, false = sort non consommé.

const ADD2E_SORT_CONFIG = {
  "name": "Peau d’Écorce",
  "slug": "peau_d_ecorce",
  "script_type": "barkskin",
  "description": "La peau de la créature touchée devient dure et rugueuse comme l’écorce. Le sort améliore sa protection naturelle et peut donner une meilleure classe d’armure, avec une efficacité qui dépend du niveau du clerc et des limites prévues par la règle. Il protège particulièrement contre les attaques physiques ordinaires mais ne remplace pas une armure complète dans tous les cas. La durée est de 4 rounds + 1 round par niveau. Les interactions avec l’armure portée et les autres protections sont arbitrées par le MD.",
  "effect_rounds": "4+level",
  "effectTags": [
    "bonus:ca",
    "protection:ecorce",
    "etat:peau_ecorce"
  ],
  "modes": [
    {
      "id": "normal",
      "label": "Peau d’Écorce"
    }
  ]
};
const ADD2E_ONUSE_TAG = "[ADD2E][SORT_ONUSE][CLERC_N2]";

function add2eHtmlEscape(value) {
  const div = document.createElement("div");
  div.innerText = String(value ?? "");
  return div.innerHTML;
}

function add2eCasterLevel(actor) {
  return Number(actor?.system?.niveau ?? actor?.system?.level ?? actor?.system?.details?.niveau ?? 1) || 1;
}

function add2eRoundCount(expr, level) {
  if (typeof expr === "number") return expr;
  if (!expr) return 0;
  const s = String(expr);
  if (s === "level") return level;
  if (s === "1+level") return 1 + level;
  if (s === "2*level") return 2 * level;
  if (s === "4+level") return 4 + level;
  if (s === "4*level") return 4 * level;
  if (s === "10*level") return 10 * level;
  if (s === "60*level") return 60 * level;
  if (s === "1440+1440*level") return 1440 + (1440 * level);
  return Number(s) || 0;
}

function add2eGetCasterToken() {
  return token ?? args?.[0]?.token ?? canvas?.tokens?.controlled?.[0] ?? null;
}

function add2eGetTargets({ fallbackCaster = true } = {}) {
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

async function add2eApplyTaggedEffect(targetActor, { name, img, tags, rounds = 0, description = "", changes = [] }) {
  if (!targetActor) return false;

  const data = {
    name,
    img: img || item?.img || "icons/svg/aura.svg",
    disabled: false,
    transfer: false,
    type: "base",
    system: {},
    changes,
    duration: {
      rounds: rounds || undefined,
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

async function add2eChooseMode(config) {
  const modes = config.modes ?? [{ id: "normal", label: config.name }];
  const needsDialog = modes.length > 1 || ["augure", "messenger", "object_effect", "ward_effect", "fire_trap", "wyvern_watch"].includes(config.script_type);

  if (!needsDialog) return { mode: modes[0]?.id ?? "normal" };

  return await new Promise(resolve => {
    let done = false;
    const finish = value => {
      if (done) return;
      done = true;
      resolve(value);
    };

    let content = `<form><p><b>${add2eHtmlEscape(config.name)}</b></p>`;
    if (config.script_type === "augure") {
      content += `<div class="form-group"><label>Question / action envisagée</label><textarea name="note" rows="3"></textarea></div>`;
    } else if (["messenger", "object_effect", "ward_effect", "fire_trap", "wyvern_watch"].includes(config.script_type)) {
      content += `<div class="form-group"><label>Note de scène / cible / objet</label><textarea name="note" rows="3"></textarea></div>`;
    }
    content += `</form>`;

    const buttons = {};
    for (const mode of modes) {
      buttons[mode.id] = {
        label: mode.label,
        callback: html => finish({
          mode: mode.id,
          note: html?.find?.("[name='note']")?.val?.() ?? ""
        })
      };
    }
    buttons.cancel = { label: "Annuler", callback: () => finish(null) };

    new Dialog({
      title: `${config.name}`,
      content,
      buttons,
      default: modes[0]?.id ?? "normal",
      close: () => finish(null)
    }).render(true);
  });
}

async function add2eApplySimpleEffect(choice, config) {
  const targets = add2eGetTargets({ fallbackCaster: true });
  const level = add2eCasterLevel(actor);
  const rounds = add2eRoundCount(config.effect_rounds, level);
  const mode = choice?.mode ?? "normal";
  const title = mode !== "normal"
    ? (config.modes?.find(m => m.id === mode)?.label ?? config.name)
    : config.name;

  const tags = [
    `sort:${config.slug}`,
    "classe:clerc",
    "liste:clerc",
    "niveau:2",
    ...(config.effectTags ?? [])
  ];

  if (mode === "feu") tags.push("resistance:feu");
  if (mode === "froid") tags.push("resistance:froid");

  for (const t of targets) {
    await add2eApplyTaggedEffect(t.actor, {
      name: title,
      img: item?.img,
      tags,
      rounds,
      description: `${title} lancé par ${actor?.name ?? "un clerc"}.`
    });
  }

  await add2eChat(title, `
    <p>Cible(s) : ${targets.map(t => `<b>${add2eHtmlEscape(t.name)}</b>`).join(", ")}</p>
    ${rounds ? `<p>Durée mécanique : ${rounds} round(s).</p>` : ""}
    <p>${add2eHtmlEscape(config.description ?? "")}</p>
  `);

  return true;
}

async function add2eAide(config) {
  const targets = add2eGetTargets({ fallbackCaster: true });
  const level = add2eCasterLevel(actor);
  const rounds = add2eRoundCount(config.effect_rounds, level);
  const roll = await new Roll("1d8").evaluate();

  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor, token: add2eGetCasterToken() }),
    flavor: `${config.name} — points de vie temporaires`
  });

  for (const t of targets) {
    await add2eApplyTaggedEffect(t.actor, {
      name: config.name,
      img: item?.img,
      tags: [`sort:${config.slug}`, "classe:clerc", "liste:clerc", "niveau:2", "bonus:toucher:1", "bonus:sauvegarde:1", `pv_temp:${roll.total}`],
      rounds,
      description: `Aide : ${roll.total} PV temporaires et bonus selon les règles.`
    });
  }

  await add2eChat(config.name, `<p>Aide appliquée. PV temporaires tirés : <b>${roll.total}</b>.</p>`);
  return true;
}

async function add2eAugure(config, note) {
  const level = add2eCasterLevel(actor);
  const chance = Math.min(99, 70 + level);
  const roll = await new Roll("1d100").evaluate();

  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor, token: add2eGetCasterToken() }),
    flavor: `${config.name} — chance de réponse utile ${chance}%`
  });

  await add2eChat(config.name, `
    <p><b>Action demandée :</b> ${add2eHtmlEscape(note || "non précisée")}</p>
    <p>Chance de base : <b>${chance}%</b>. Jet : <b>${roll.total}</b>.</p>
    <p>Le MD donne le présage adapté.</p>
  `);

  return true;
}

async function add2eGoodberry(config) {
  const roll = await new Roll("2d4").evaluate();
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor, token: add2eGetCasterToken() }),
    flavor: `${config.name} — nombre de baies`
  });

  await add2eApplyTaggedEffect(actor, {
    name: `${config.name} — ${roll.total} baie(s)`,
    img: item?.img,
    tags: [`sort:${config.slug}`, "classe:clerc", "liste:clerc", "niveau:2", `baies:${roll.total}`, "soin:1"],
    rounds: add2eRoundCount(config.effect_rounds, add2eCasterLevel(actor)),
    description: `${roll.total} baie(s) délicieuse(s).`
  });

  await add2eChat(config.name, `<p><b>${roll.total}</b> baie(s) créée(s). Chaque baie est notée via un effet sur le lanceur.</p>`);
  return true;
}

async function add2eDetection(config, choice) {
  const level = add2eCasterLevel(actor);
  const rounds = add2eRoundCount(config.effect_rounds, level);
  await add2eApplyTaggedEffect(actor, {
    name: config.name,
    img: item?.img,
    tags: [`sort:${config.slug}`, "classe:clerc", "liste:clerc", "niveau:2", ...(config.effectTags ?? [])],
    rounds,
    description: config.description
  });

  await add2eChat(config.name, `
    <p>${add2eHtmlEscape(config.description)}</p>
    ${choice?.note ? `<p><b>Note :</b> ${add2eHtmlEscape(choice.note)}</p>` : ""}
    ${rounds ? `<p>Durée indicative : ${rounds} round(s).</p>` : ""}
    <p>Résolution précise à arbitrer par le MD selon la portée, l’orientation et les obstacles.</p>
  `);
  return true;
}

async function add2eSpiritualHammer(config) {
  const targets = add2eGetTargets({ fallbackCaster: false });
  const level = add2eCasterLevel(actor);
  const rounds = add2eRoundCount(config.effect_rounds, level);
  const bonusMagic = Math.max(1, Math.floor(level / 3));

  await add2eApplyTaggedEffect(actor, {
    name: config.name,
    img: item?.img,
    tags: [`sort:${config.slug}`, "classe:clerc", "liste:clerc", "niveau:2", "arme:marteau_spirituel", "attaque:magique", `arme_magique:+${bonusMagic}`],
    rounds,
    description: "Marteau spirituel actif : 1d6 contre P/M, 1d4 contre G."
  });

  await add2eChat(config.name, `
    <p>Marteau spirituel créé.</p>
    <p>Dégâts : <b>1d6</b> contre P/M, <b>1d4</b> contre G.</p>
    <p>Considéré comme arme magique +${bonusMagic} pour toucher les créatures nécessitant une arme magique, sans bonus au toucher ni aux dégâts.</p>
    ${targets.length ? `<p>Cible actuelle : ${targets.map(t => `<b>${add2eHtmlEscape(t.name)}</b>`).join(", ")}</p>` : ""}
  `);
  return true;
}

async function add2eHeatMetal(config) {
  const targets = add2eGetTargets({ fallbackCaster: false });
  if (!targets.length) {
    ui.notifications.warn(`${config.name} : cible ou porteur de métal obligatoire.`);
    return false;
  }

  for (const t of targets) {
    await add2eApplyTaggedEffect(t.actor, {
      name: config.name,
      img: item?.img,
      tags: [`sort:${config.slug}`, "classe:clerc", "liste:clerc", "niveau:2", "objet:metal", "degat:feu"],
      rounds: 7,
      description: "Métal brûlant : gérer les dégâts par round selon la table du sort."
    });
  }

  await add2eChat(config.name, `
    <p>Métal brûlant appliqué à : ${targets.map(t => `<b>${add2eHtmlEscape(t.name)}</b>`).join(", ")}.</p>
    <p>Durée : 7 rounds. Gérer les dégâts progressifs selon la règle du sort.</p>
  `);
  return true;
}

async function add2eNoteOnly(config, choice) {
  await add2eChat(config.name, `
    <p>${add2eHtmlEscape(config.description ?? "")}</p>
    ${choice?.note ? `<p><b>Note :</b> ${add2eHtmlEscape(choice.note)}</p>` : ""}
  `);
  return true;
}

async function add2eSilence(config) {
  const targets = add2eGetTargets({ fallbackCaster: true });
  const rounds = add2eRoundCount(config.effect_rounds, add2eCasterLevel(actor));

  for (const t of targets) {
    await add2eApplyTaggedEffect(t.actor, {
      name: config.name,
      img: item?.img,
      tags: [`sort:${config.slug}`, "classe:clerc", "liste:clerc", "niveau:2", "etat:silence", "anti_sort:verbal"],
      rounds,
      description: "Silence dans un rayon de 15 pieds."
    });
  }

  await add2eChat(config.name, `
    <p>Silence appliqué sur : ${targets.map(t => `<b>${add2eHtmlEscape(t.name)}</b>`).join(", ")}.</p>
    <p>Rayon : 15 pieds. Durée : ${rounds} round(s).</p>
  `);
  return true;
}

const choice = await add2eChooseMode(ADD2E_SORT_CONFIG);
if (!choice) {
  ui.notifications.info(`${ADD2E_SORT_CONFIG.name} annulé.`);
  return false;
}

console.log(`${ADD2E_ONUSE_TAG}[START]`, {
  sort: ADD2E_SORT_CONFIG.name,
  actor: actor?.name,
  mode: choice.mode,
  targets: Array.from(game.user.targets ?? []).map(t => t.name)
});

switch (ADD2E_SORT_CONFIG.script_type) {
  case "aide":
    return await add2eAide(ADD2E_SORT_CONFIG);

  case "augure":
    return await add2eAugure(ADD2E_SORT_CONFIG, choice.note);

  case "goodberry":
    return await add2eGoodberry(ADD2E_SORT_CONFIG);

  case "detection":
  case "detect_charm":
  case "detect_traps":
    return await add2eDetection(ADD2E_SORT_CONFIG, choice);

  case "spiritual_hammer":
    return await add2eSpiritualHammer(ADD2E_SORT_CONFIG);

  case "heat_metal":
    return await add2eHeatMetal(ADD2E_SORT_CONFIG);

  case "silence":
    return await add2eSilence(ADD2E_SORT_CONFIG);

  case "messenger":
  case "object_effect":
  case "ward_effect":
  case "fire_trap":
  case "wyvern_watch":
  case "summon_note":
    return await add2eNoteOnly(ADD2E_SORT_CONFIG, choice);

  default:
    return await add2eApplySimpleEffect(choice, ADD2E_SORT_CONFIG);
}
