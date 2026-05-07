// ADD2E — onUse Druide niveau 4 : Répulsion des insectes
// Version : 2026-05-05-druide-n1-7-v1
// Retour attendu par le moteur ADD2E : true = sort consommé, false = sort non consommé.

const ADD2E_SORT_CONFIG = {
  "name": "Répulsion des insectes",
  "slug": "repulsion_des_insectes",
  "level": 4,
  "classe": "Druide",
  "script_type": "simple_effect",
  "description": "Répulsion des insectes place une protection naturelle ou druidique sur une créature, une zone ou le lanceur. L’effet doit être pris en compte lors des attaques, jets de sauvegarde, déplacements ou interactions avec les créatures et éléments concernés. Les limites exactes dépendent de la scène et de la règle du sort.",
  "effect_rounds": "10*level",
  "effectTags": [
    "repulsion:insectes",
    "zone:protection"
  ],
  "modes": [
    {
      "id": "normal",
      "label": "Répulsion des insectes"
    }
  ],
  "dice": null
};
const ADD2E_ONUSE_TAG = "[ADD2E][SORT_ONUSE][DRUIDE_N1_7]";

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
  if (s === "4*level") return 4 * level;
  if (s === "4+level") return 4 + level;
  if (s === "10") return 10;
  if (s === "10+level") return 10 + level;
  if (s === "10*level") return 10 * level;
  if (s === "40+10*level") return 40 + (10 * level);
  if (s === "60+10*level") return 60 + (10 * level);
  if (s === "60*level") return 60 * level;
  if (s === "long") return 0;
  if (s === "special") return 0;
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
  const casterName = casterActor?.name ?? casterToken?.name ?? "Druide";
  const spellName = item?.name ?? title ?? "Sort druidique";
  const casterImg = casterToken?.document?.texture?.src ?? casterActor?.img ?? "icons/svg/mystery-man.svg";
  const spellImg = item?.img ?? "icons/svg/book.svg";
  const targets = Array.from(game.user.targets ?? []);
  const targetLabel = options.targetLabel ?? (targets.length ? targets.map(t => t.name).join(", ") : casterName);
  const outcome = options.outcome ?? title ?? spellName;
  const rule = options.rule ?? options.regle ?? "";
  const subtitle = options.subtitle ?? "Sort druidique";

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
      <div class="add2e-chat-card add2e-druide-sort"
           style="border:1px solid #75a86a;border-radius:8px;overflow:hidden;background:#f2fbec;color:#24411f;font-family:var(--font-primary);">
        <div style="display:flex;align-items:center;gap:8px;background:#2f6f3e;color:#fff;padding:7px 9px;">
          <img src="${safeCasterImg}" style="width:42px;height:42px;object-fit:cover;border-radius:50%;border:2px solid #b8e3a9;background:#fff;" />
          <div style="flex:1;line-height:1.05;">
            <div style="font-weight:800;font-size:14px;">${safeCaster}</div>
            <div style="font-size:12px;font-weight:700;">lance ${safeSpell}</div>
          </div>
          <div style="font-weight:800;font-size:12px;text-align:center;white-space:nowrap;">${safeSubtitle}</div>
          <img src="${safeSpellImg}" style="width:34px;height:34px;object-fit:cover;border-radius:3px;border:1px solid #b8e3a9;background:#fff;" />
        </div>

        <div style="padding:9px 10px 10px 10px;background:#f2fbec;">
          <div style="font-size:13px;margin:0 0 6px 0;"><b>Cible :</b> ${safeTarget}</div>

          <div style="border:1px solid #75a86a;border-radius:6px;background:#fbfff8;padding:8px;text-align:center;margin-bottom:7px;">
            <div style="color:#1c7f41;font-weight:900;font-size:14px;text-transform:uppercase;letter-spacing:.3px;">${safeOutcome}</div>
            <div style="font-size:13px;line-height:1.35;text-align:center;">${html}</div>
          </div>

          <details style="border:1px solid #75a86a;border-radius:5px;background:#fbfff8;padding:5px 7px;">
            <summary style="cursor:pointer;font-weight:800;color:#315f29;">Règle appliquée</summary>
            <div style="margin-top:5px;font-size:12px;line-height:1.35;">${rule || "Effet du sort appliqué selon sa description et l’arbitrage du MD."}</div>
          </details>
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

    if (normalized.some(t => tags.includes(t) || name.includes(t.replace("etat:", "").replace("retire:", "")))) {
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
    "note", "summon_note", "mode_note", "detection", "dispel_magic",
    "reincarnation", "terrain", "movement"
  ].includes(config.script_type);

  if (modes.length <= 1 && !needsNote) return { mode: modes[0]?.id ?? "normal", note: "" };

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
      title: config.name,
      content,
      buttons,
      default: modes[0]?.id ?? "normal",
      close: () => finish(null)
    }).render(true);
  });
}

async function add2eSimpleEffect(choice, config) {
  const targets = add2eGetTargets({ fallbackCaster: true });
  const level = add2eCasterLevel(actor);
  const rounds = add2eRoundCount(config.effect_rounds, level);
  const mode = choice?.mode ?? "normal";
  const title = mode !== "normal"
    ? (config.modes?.find(m => m.id === mode)?.label ?? config.name)
    : config.name;

  const tags = [
    `sort:${config.slug}`,
    "classe:druide",
    "liste:druide",
    `niveau:${config.level}`,
    ...(config.effectTags ?? []),
    mode !== "normal" ? `mode:${mode}` : ""
  ].filter(Boolean);

  for (const t of targets) {
    await add2eApplyTaggedEffect(t.actor, {
      name: title,
      img: item?.img,
      tags,
      rounds,
      description: config.description
    });
  }

  await add2eChat(title, `
    <p>Cible(s) : ${targets.map(t => `<b>${add2eHtmlEscape(t.name)}</b>`).join(", ")}</p>
    ${rounds ? `<p>Durée mécanique : <b>${rounds}</b> round(s).</p>` : ""}
  `, null, {
    outcome: title,
    rule: add2eHtmlEscape(config.description)
  });

  return true;
}

async function add2eHeal(config) {
  const targets = add2eGetTargets({ fallbackCaster: false });
  if (!targets.length) {
    ui.notifications.warn(`${config.name} : cible obligatoire.`);
    return false;
  }

  const formula = config.dice || "1d8";
  const roll = await add2eEvalRoll(formula);
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor, token: add2eGetCasterToken() }),
    flavor: config.name
  });

  const target = targets[0];
  const targetActor = target.actor ?? target;
  const amount = Number(roll.total) || 0;
  const maxHP = Number(targetActor.system?.points_de_coup ?? targetActor.system?.pv_max ?? targetActor.system?.hp?.max ?? 0) || 0;
  const curHP = Number(targetActor.system?.pdv ?? targetActor.system?.pv ?? targetActor.system?.hp?.value ?? 0) || 0;
  const newHp = maxHP ? Math.min(maxHP, curHP + amount) : curHP + amount;
  const healed = Math.max(0, newHp - curHP);

  await targetActor.update({ "system.pdv": newHp });

  await add2eChat("SOINS", `
    <p>Jet : <b>${roll.total}</b></p>
    <p>PV rendus : <b>${healed}</b> ${maxHP ? "(limité par le maximum)" : ""}</p>
  `, null, {
    targetLabel: target.name,
    outcome: "SOINS",
    rule: add2eHtmlEscape(config.description)
  });

  return true;
}

async function add2eDamage(config) {
  const targets = add2eGetTargets({ fallbackCaster: false });
  const level = add2eCasterLevel(actor);
  let formula = config.dice || "1d6";

  if (formula === "2d8+level") formula = `2d8+${level}`;
  if (formula === "2d8+leveld8") formula = `${Math.min(10, 2 + level)}d8`;
  if (formula === "special" || formula === "variable") formula = "1d20";

  const roll = await add2eEvalRoll(formula);
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor, token: add2eGetCasterToken() }),
    flavor: config.name
  });

  await add2eChat(config.name, `
    <p>Jet indicatif : <b>${roll.total}</b> (${formula})</p>
    ${targets.length ? `<p>Cible(s) : ${targets.map(t => `<b>${add2eHtmlEscape(t.name)}</b>`).join(", ")}</p>` : "<p>Aucune cible sélectionnée : appliquer manuellement si nécessaire.</p>"}
  `, null, {
    outcome: "EFFET OFFENSIF",
    rule: add2eHtmlEscape(config.description)
  });

  return true;
}

async function add2eRemoveCondition(config) {
  const targets = add2eGetTargets({ fallbackCaster: false });
  if (!targets.length) {
    ui.notifications.warn(`${config.name} : cible obligatoire.`);
    return false;
  }

  let removeTags = [];
  if (config.slug.includes("contre_poison")) removeTags = ["etat:poison", "poison", "empoisonne"];
  else if (config.slug.includes("guerison_des_maladies")) removeTags = ["etat:maladie", "maladie", "infection"];
  else removeTags = config.effectTags ?? [];

  let removed = 0;
  for (const t of targets) removed += await add2eRemoveTaggedEffects(t.actor, removeTags);

  await add2eChat(config.name, `
    <p>Cible(s) : ${targets.map(t => `<b>${add2eHtmlEscape(t.name)}</b>`).join(", ")}</p>
    <p>Effets retirés automatiquement : <b>${removed}</b>.</p>
  `, null, {
    targetLabel: targets.map(t => t.name).join(", "),
    outcome: "ÉTAT TRAITÉ",
    rule: add2eHtmlEscape(config.description)
  });

  return true;
}

async function add2eDispelMagic(config, choice) {
  const roll = await add2eEvalRoll("1d20");
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor, token: add2eGetCasterToken() }),
    flavor: `${config.name} — jet indicatif`
  });

  await add2eChat(config.name, `
    <p>Jet indicatif : <b>${roll.total}</b></p>
    ${choice?.note ? `<p>Effet visé : <b>${add2eHtmlEscape(choice.note)}</b></p>` : ""}
  `, null, {
    outcome: "DISSIPATION",
    rule: "Comparer selon la règle de dissipation avec le niveau ou la puissance de l’effet magique ciblé."
  });

  return true;
}

async function add2eNoteOnly(config, choice) {
  await add2eChat(config.name, `
    <p>${add2eHtmlEscape(config.description)}</p>
    ${choice?.note ? `<p>Note : <b>${add2eHtmlEscape(choice.note)}</b></p>` : ""}
  `, null, {
    outcome: config.name.toUpperCase(),
    rule: add2eHtmlEscape(config.description)
  });

  return true;
}

async function add2eReincarnation(config, choice) {
  const targets = add2eGetTargets({ fallbackCaster: false });
  if (!targets.length) {
    ui.notifications.warn(`${config.name} : cible obligatoire.`);
    return false;
  }

  for (const t of targets) {
    await add2eApplyTaggedEffect(t.actor, {
      name: config.name,
      img: item?.img,
      tags: [`sort:${config.slug}`, "classe:druide", "liste:druide", `niveau:${config.level}`, "reincarnation", "retour:vie"],
      rounds: 0,
      description: config.description
    });
  }

  await add2eChat(config.name, `
    <p>Réincarnation notée sur : ${targets.map(t => `<b>${add2eHtmlEscape(t.name)}</b>`).join(", ")}</p>
    ${choice?.note ? `<p>Note : <b>${add2eHtmlEscape(choice.note)}</b></p>` : ""}
  `, null, {
    targetLabel: targets.map(t => t.name).join(", "),
    outcome: "RÉINCARNATION",
    rule: add2eHtmlEscape(config.description)
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
  case "heal":
    return await add2eHeal(ADD2E_SORT_CONFIG);

  case "damage_roll":
    return await add2eDamage(ADD2E_SORT_CONFIG);

  case "remove_condition":
    return await add2eRemoveCondition(ADD2E_SORT_CONFIG);

  case "dispel_magic":
    return await add2eDispelMagic(ADD2E_SORT_CONFIG, choice);

  case "reincarnation":
    return await add2eReincarnation(ADD2E_SORT_CONFIG, choice);

  case "simple_effect":
    return await add2eSimpleEffect(choice, ADD2E_SORT_CONFIG);

  case "detection":
  case "note":
  case "summon_note":
  case "mode_note":
  default:
    return await add2eNoteOnly(ADD2E_SORT_CONFIG, choice);
}
