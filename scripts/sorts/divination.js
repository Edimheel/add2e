// ADD2E — onUse Clerc niveau 4 : Divination
// Version : 2026-05-05-clerc-n4-v1-style-clerc
// Retour attendu par le moteur ADD2E : true = sort consommé, false = sort non consommé.

const ADD2E_SORT_CONFIG = {
  "name": "Divination",
  "slug": "divination",
  "script_type": "divination_roll",
  "description": "Le clerc demande à sa puissance divine une indication concernant un objectif, un lieu, une action ou un danger proche. La réponse prend la forme d’un conseil, d’un présage ou d’une information utile, mais elle peut rester cryptique. La fiabilité dépend du niveau du clerc, de la clarté de la question et de l’arbitrage du MD.",
  "effect_rounds": 0,
  "effectTags": [
    "divination",
    "information:md",
    "presage"
  ],
  "modes": [
    {
      "id": "normal",
      "label": "Divination"
    }
  ]
};
const ADD2E_ONUSE_TAG = "[ADD2E][SORT_ONUSE][CLERC_N4]";

function add2eHtmlEscape(value) {
  const div = document.createElement("div");
  div.innerText = String(value ?? "");
  return div.innerHTML;
}

function add2eCasterLevel(actor) {
  return Number(actor?.system?.niveau ?? actor?.system?.level ?? actor?.system?.details?.niveau ?? 1) || 1;
}

async function add2eEvalRoll(formula) {
  return await new Roll(formula).evaluate();
}

function add2eRoundCount(expr, level) {
  if (typeof expr === "number") return expr;
  if (!expr) return 0;
  const s = String(expr);
  if (s === "level") return level;
  if (s === "2*level") return 2 * level;
  if (s === "10*level") return 10 * level;
  if (s === "40+10*level") return 40 + (10 * level);
  if (s === "10+level") return 10 + level;
  if (s === "10+10*level") return 10 + (10 * level);
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

async function add2eRemoveTaggedEffects(targetActor, removeTags = []) {
  if (!targetActor?.effects) return 0;
  const normalized = removeTags.map(t => String(t).toLowerCase());
  const toDelete = [];
  for (const ef of targetActor.effects) {
    const tags = (ef.flags?.add2e?.tags ?? []).map(t => String(t).toLowerCase());
    const name = String(ef.name ?? "").toLowerCase();
    if (normalized.some(t => tags.includes(t) || name.includes(t.replace("etat:", "")))) {
      toDelete.push(ef.id);
    }
  }
  if (!toDelete.length) return 0;
  await targetActor.deleteEmbeddedDocuments("ActiveEffect", toDelete);
  return toDelete.length;
}

async function add2eChooseMode(config) {
  const modes = config.modes ?? [{ id: "normal", label: config.name }];
  const needsNote = [
    "water_level", "abjuration_note", "summon_note", "divination_note", "divination_roll",
    "area_note", "spell_immunity", "communication_note", "grant_spells", "produce_fire",
    "sticks_to_snakes"
  ].includes(config.script_type);

  if (modes.length <= 1 && !needsNote) return { mode: modes[0]?.id ?? "normal" };

  return await new Promise(resolve => {
    let done = false;
    const finish = value => {
      if (done) return;
      done = true;
      resolve(value);
    };

    let content = `<form><p><b>${add2eHtmlEscape(config.name)}</b></p>`;
    if (needsNote) {
      content += `<div class="form-group"><label>Note de scène / cible / paramètres</label><textarea name="note" rows="3"></textarea></div>`;
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
  const title = mode !== "normal" ? (config.modes?.find(m => m.id === mode)?.label ?? config.name) : config.name;

  const tags = [
    `sort:${config.slug}`,
    "classe:clerc",
    "liste:clerc",
    "niveau:4",
    ...(config.effectTags ?? [])
  ];

  if (mode !== "normal") tags.push(`mode:${mode}`);

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
  `, null, {
    outcome: title,
    rule: add2eHtmlEscape(config.description ?? "")
  });
  return true;
}

async function add2eHealSerious(config, choice) {
  const targets = add2eGetTargets({ fallbackCaster: false });
  if (!targets.length) {
    ui.notifications.warn(`${config.name} : cible obligatoire.`);
    return false;
  }

  const target = targets[0];
  const inverse = choice?.mode === "inverse";
  const roll = await add2eEvalRoll("2d8+1");

  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor, token: add2eGetCasterToken() }),
    flavor: inverse ? "Blessures Graves" : config.name
  });

  const amount = Number(roll.total) || 0;
  const targetActor = target.actor ?? target;
  const maxHP = Number(targetActor.system?.points_de_coup ?? targetActor.system?.pv_max ?? targetActor.system?.hp?.max ?? 0) || 0;
  const curHP = Number(targetActor.system?.pdv ?? targetActor.system?.pv ?? targetActor.system?.hp?.value ?? 0) || 0;

  if (inverse) {
    const newHp = Math.max(0, curHP - amount);
    await targetActor.update({ "system.pdv": newHp });
    await add2eChat("BLESSURES GRAVES", `
      <p>Jet : <b>${roll.total}</b></p>
      <p>PV perdus : <b>${amount}</b></p>
    `, null, {
      targetLabel: target.name,
      outcome: "BLESSURES GRAVES",
      rule: "Forme inversée du sort : inflige 2d8+1 points de dégâts à la cible touchée."
    });
    return true;
  }

  const newHp = maxHP ? Math.min(maxHP, curHP + amount) : curHP + amount;
  const healed = Math.max(0, newHp - curHP);
  await targetActor.update({ "system.pdv": newHp });

  await add2eChat("SOINS", `
    <p>Jet : <b>${roll.total}</b></p>
    <p>PV rendus : <b>${healed}</b> ${maxHP ? "(limité par le maximum)" : ""}</p>
  `, null, {
    targetLabel: target.name,
    outcome: "SOINS",
    rule: "Soins des Blessures Graves rend 2d8+1 points de vie, sans dépasser le maximum normal de la créature."
  });
  return true;
}

async function add2eNeutralizePoison(config, choice) {
  const targets = add2eGetTargets({ fallbackCaster: false });
  if (!targets.length) {
    ui.notifications.warn(`${config.name} : cible obligatoire.`);
    return false;
  }

  const inverse = choice?.mode === "inverse";
  if (inverse) {
    for (const t of targets) {
      await add2eApplyTaggedEffect(t.actor, {
        name: "Poison",
        img: item?.img,
        tags: [`sort:${config.slug}`, "classe:clerc", "liste:clerc", "niveau:4", "etat:poison"],
        rounds: 0,
        description: "Forme inversée de Neutralisation du Poison. Résolution précise selon le MD."
      });
    }
    await add2eChat("POISON", `<p>Poison appliqué/noté sur ${targets.map(t => `<b>${add2eHtmlEscape(t.name)}</b>`).join(", ")}.</p>`, null, {
      outcome: "POISON",
      rule: "Forme inversée : empoisonnement ou substance toxique, à résoudre selon jet de protection et décision du MD."
    });
    return true;
  }

  let removed = 0;
  for (const t of targets) removed += await add2eRemoveTaggedEffects(t.actor, ["etat:poison", "poison", "empoisonne"]);
  await add2eChat(config.name, `
    <p>Poison neutralisé sur : ${targets.map(t => `<b>${add2eHtmlEscape(t.name)}</b>`).join(", ")}</p>
    <p>Effets de poison retirés : <b>${removed}</b>.</p>
  `, null, {
    outcome: "POISON NEUTRALISÉ",
    rule: add2eHtmlEscape(config.description)
  });
  return true;
}

async function add2eDetectLie(config, choice) {
  const targets = add2eGetTargets({ fallbackCaster: false });
  const inverse = choice?.mode === "inverse";
  const title = inverse ? "DISSIMULATION DES MENSONGES" : "DÉTECTION DES MENSONGES";
  const rounds = add2eRoundCount(config.effect_rounds, add2eCasterLevel(actor));

  const effectTargets = targets.length ? targets : [add2eGetCasterToken()].filter(Boolean);
  for (const t of effectTargets) {
    await add2eApplyTaggedEffect(t.actor, {
      name: title,
      img: item?.img,
      tags: [`sort:${config.slug}`, "classe:clerc", "liste:clerc", "niveau:4", inverse ? "dissimulation:mensonge" : "detection:mensonge"],
      rounds,
      description: config.description
    });
  }

  await add2eChat(title, `
    <p>${inverse ? "Protection contre la détection du mensonge." : "Le clerc peut discerner les mensonges volontaires pendant la durée."}</p>
    <p>Durée : <b>${rounds}</b> round(s).</p>
  `, null, {
    targetLabel: targets.length ? targets.map(t => t.name).join(", ") : (actor?.name ?? "Clerc"),
    outcome: title,
    rule: add2eHtmlEscape(config.description)
  });
  return true;
}

async function add2eDivination(config, choice) {
  const level = add2eCasterLevel(actor);
  const chance = Math.min(90, 60 + level);
  const roll = await add2eEvalRoll("1d100");

  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor, token: add2eGetCasterToken() }),
    flavor: `${config.name} — chance de réponse utile ${chance}%`
  });

  await add2eChat(config.name, `
    <p>Chance de réponse utile : <b>${chance}%</b></p>
    <p>Jet : <b>${roll.total}</b></p>
    ${choice?.note ? `<p>Question : <b>${add2eHtmlEscape(choice.note)}</b></p>` : ""}
  `, null, {
    outcome: roll.total <= chance ? "PRÉSAGE OBTENU" : "PRÉSAGE INCERTAIN",
    rule: "Le MD donne une indication utile, cryptique ou partielle selon la clarté de la question et le résultat du jet."
  });
  return true;
}

async function add2eProtectionAbsorb(config, damageTypeLabel, tagName, multiplier) {
  const targets = add2eGetTargets({ fallbackCaster: true });
  const level = add2eCasterLevel(actor);
  const absorption = multiplier * level;

  for (const t of targets) {
    await add2eApplyTaggedEffect(t.actor, {
      name: config.name,
      img: item?.img,
      tags: [`sort:${config.slug}`, "classe:clerc", "liste:clerc", "niveau:4", tagName, `absorption:${absorption}`],
      rounds: 0,
      description: `${config.name}. Réserve indicative d’absorption : ${absorption} points.`
    });
  }

  await add2eChat(config.name, `
    <p>Protection ${damageTypeLabel} appliquée.</p>
    <p>Réserve indicative : <b>${absorption}</b> points.</p>
  `, null, {
    outcome: "PROTECTION",
    rule: add2eHtmlEscape(config.description)
  });
  return true;
}

async function add2eBravery(config, choice) {
  const targets = add2eGetTargets({ fallbackCaster: true });
  const inverse = choice?.mode === "inverse";
  const title = inverse ? "MANTEAU DE PEUR" : "MANTEAU DE BRAVOURE";
  const rounds = add2eRoundCount(config.effect_rounds, add2eCasterLevel(actor));

  let removed = 0;
  if (!inverse) {
    for (const t of targets) removed += await add2eRemoveTaggedEffects(t.actor, ["etat:peur", "peur", "frayeur"]);
  }

  for (const t of targets) {
    await add2eApplyTaggedEffect(t.actor, {
      name: title,
      img: item?.img,
      tags: [`sort:${config.slug}`, "classe:clerc", "liste:clerc", "niveau:4", inverse ? "etat:peur" : "resistance:peur"],
      rounds,
      description: config.description
    });
  }

  await add2eChat(title, `
    <p>Cible(s) : ${targets.map(t => `<b>${add2eHtmlEscape(t.name)}</b>`).join(", ")}</p>
    ${!inverse ? `<p>Effets de peur retirés : <b>${removed}</b>.</p>` : ""}
    <p>Durée : <b>${rounds}</b> round(s).</p>
  `, null, {
    outcome: inverse ? "PEUR" : "COURAGE",
    rule: add2eHtmlEscape(config.description)
  });
  return true;
}

async function add2eSticksToSnakes(config, choice) {
  const level = add2eCasterLevel(actor);
  const count = Math.max(1, Math.floor(level / 2));
  const inverse = choice?.mode === "inverse";
  const title = inverse ? "SERPENTS EN BÂTONS" : "BÂTONS EN SERPENTS";

  await add2eChat(title, `
    <p>${inverse ? "Les serpents visés deviennent inertes ou assimilés à des bâtons selon le MD." : `Nombre indicatif de serpents : <b>${count}</b>.`}</p>
    ${choice?.note ? `<p>Note : <b>${add2eHtmlEscape(choice.note)}</b></p>` : ""}
  `, null, {
    outcome: title,
    rule: add2eHtmlEscape(config.description)
  });
  return true;
}

async function add2eSpellImmunity(config, choice) {
  const targets = add2eGetTargets({ fallbackCaster: true });
  const rounds = add2eRoundCount(config.effect_rounds, add2eCasterLevel(actor));
  const note = choice?.note || "sorts à préciser";

  for (const t of targets) {
    await add2eApplyTaggedEffect(t.actor, {
      name: `${config.name} — ${note}`,
      img: item?.img,
      tags: [`sort:${config.slug}`, "classe:clerc", "liste:clerc", "niveau:4", "immunite:sorts", `sorts:${note}`],
      rounds,
      description: `Immunité contre les sorts précisés : ${note}`
    });
  }

  await add2eChat(config.name, `
    <p>Sort(s) choisi(s) : <b>${add2eHtmlEscape(note)}</b></p>
    <p>Durée : <b>${rounds}</b> round(s).</p>
  `, null, {
    outcome: "IMMUNITÉ",
    rule: add2eHtmlEscape(config.description)
  });
  return true;
}

async function add2eGrantSpells(config, choice) {
  const targets = add2eGetTargets({ fallbackCaster: false });
  if (!targets.length) {
    ui.notifications.warn(`${config.name} : cible obligatoire.`);
    return false;
  }
  const note = choice?.note || "sorts octroyés à préciser";
  for (const t of targets) {
    await add2eApplyTaggedEffect(t.actor, {
      name: `${config.name}`,
      img: item?.img,
      tags: [`sort:${config.slug}`, "classe:clerc", "liste:clerc", "niveau:4", "octroi:sorts"],
      rounds: 0,
      description: note
    });
  }
  await add2eChat(config.name, `
    <p>Sorts octroyés : <b>${add2eHtmlEscape(note)}</b></p>
  `, null, {
    targetLabel: targets.map(t => t.name).join(", "),
    outcome: "SORTS OCTROYÉS",
    rule: add2eHtmlEscape(config.description)
  });
  return true;
}

async function add2eNoteOnly(config, choice, outcome = null) {
  await add2eChat(config.name, `
    <p>${add2eHtmlEscape(config.description ?? "")}</p>
    ${choice?.note ? `<p>Note : <b>${add2eHtmlEscape(choice.note)}</b></p>` : ""}
  `, null, {
    outcome: outcome ?? config.name.toUpperCase(),
    rule: add2eHtmlEscape(config.description ?? "")
  });
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
  case "heal_serious":
    return await add2eHealSerious(ADD2E_SORT_CONFIG, choice);

  case "neutralize_poison":
    return await add2eNeutralizePoison(ADD2E_SORT_CONFIG, choice);

  case "detect_lie":
    return await add2eDetectLie(ADD2E_SORT_CONFIG, choice);

  case "divination_roll":
    return await add2eDivination(ADD2E_SORT_CONFIG, choice);

  case "protection_lightning":
    return await add2eProtectionAbsorb(ADD2E_SORT_CONFIG, "contre la foudre", "resistance:foudre", 12);

  case "bravery":
    return await add2eBravery(ADD2E_SORT_CONFIG, choice);

  case "sticks_to_snakes":
    return await add2eSticksToSnakes(ADD2E_SORT_CONFIG, choice);

  case "spell_immunity":
    return await add2eSpellImmunity(ADD2E_SORT_CONFIG, choice);

  case "grant_spells":
    return await add2eGrantSpells(ADD2E_SORT_CONFIG, choice);

  case "simple_effect":
  case "temperature_control":
  case "protection_evil_10":
  case "repel_insects":
    return await add2eApplySimpleEffect(choice, ADD2E_SORT_CONFIG);

  case "water_level":
  case "abjuration_note":
  case "summon_note":
  case "divination_note":
  case "area_note":
  case "communication_note":
  case "produce_fire":
    return await add2eNoteOnly(ADD2E_SORT_CONFIG, choice);

  default:
    return await add2eApplySimpleEffect(choice, ADD2E_SORT_CONFIG);
}
