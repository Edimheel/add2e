// ADD2E — onUse Clerc niveaux 5-7 : Régénération
// Version : 2026-05-05-clerc-n5-7-v2-flat
// Retour attendu par le moteur ADD2E : true = sort consommé, false = sort non consommé.

const ADD2E_SORT_CONFIG = {
  "name": "Régénération",
  "slug": "regeneration",
  "level": 7,
  "script_type": "regeneration",
  "description": "Régénération restaure la vitalité, la vie ou l’intégrité d’une créature. Selon le sort, il peut soigner des blessures, rappeler une créature à la vie, régénérer un membre, retirer un affaiblissement ou restaurer une condition perdue. Les limites exactes dépendent du sort et du MD.",
  "effect_rounds": 0,
  "effectTags": [
    "regeneration",
    "soin:membre"
  ],
  "modes": [
    {
      "id": "normal",
      "label": "Régénération"
    }
  ],
  "dice": null
};
const ADD2E_ONUSE_TAG = "[ADD2E][SORT_ONUSE][CLERC_N5_7]";

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
  if (s === "60*level") return 60 * level;
  if (s === "day") return 1440;
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
          <details style="border:1px solid #e0ae37;border-radius:5px;background:#fffdf5;padding:5px 7px;">
            <summary style="cursor:pointer;font-weight:800;color:#6a4611;">Règle appliquée</summary>
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
    console.warn(`${ADD2E_ONUSE_TAG}[EFFECT_CREATE_FAILED]`, { sort: ADD2E_SORT_CONFIG.name, target: targetActor.name, error: e });
    return false;
  }
}

async function add2eChooseMode(config) {
  const modes = config.modes ?? [{ id: "normal", label: config.name }];
  const needsNote = [
    "plane_shift", "divination_questions", "atonement", "summon_note", "quest",
    "animate_object", "find_path", "speak_stone", "water_part", "word_of_recall",
    "weather_control", "gate", "astral_spell", "symbol", "earthquake"
  ].includes(config.script_type);

  if (modes.length <= 1 && !needsNote) return { mode: modes[0]?.id ?? "normal" };

  return await new Promise(resolve => {
    let done = false;
    const finish = value => { if (!done) { done = true; resolve(value); } };

    let content = `<form><p><b>${add2eHtmlEscape(config.name)}</b></p>`;
    if (needsNote) {
      content += `<div class="form-group"><label>Note de scène / cible / paramètres</label><textarea name="note" rows="3"></textarea></div>`;
    }
    content += `</form>`;

    const buttons = {};
    for (const mode of modes) {
      buttons[mode.id] = {
        label: mode.label,
        callback: html => finish({ mode: mode.id, note: html?.find?.("[name='note']")?.val?.() ?? "" })
      };
    }
    buttons.cancel = { label: "Annuler", callback: () => finish(null) };

    new Dialog({ title: config.name, content, buttons, default: modes[0]?.id ?? "normal", close: () => finish(null) }).render(true);
  });
}

async function add2eApplySimpleEffect(choice, config) {
  const targets = add2eGetTargets({ fallbackCaster: true });
  const level = add2eCasterLevel(actor);
  const rounds = add2eRoundCount(config.effect_rounds, level);
  const title = choice?.mode && choice.mode !== "normal"
    ? (config.modes?.find(m => m.id === choice.mode)?.label ?? config.name)
    : config.name;

  for (const t of targets) {
    await add2eApplyTaggedEffect(t.actor, {
      name: title,
      img: item?.img,
      tags: [`sort:${config.slug}`, "classe:clerc", `niveau:${config.level}`, ...(config.effectTags ?? []), choice?.mode ? `mode:${choice.mode}` : ""].filter(Boolean),
      rounds,
      description: config.description
    });
  }

  await add2eChat(title, `
    <p>Cible(s) : ${targets.map(t => `<b>${add2eHtmlEscape(t.name)}</b>`).join(", ")}</p>
    ${rounds ? `<p>Durée mécanique : <b>${rounds}</b> round(s).</p>` : ""}
  `, null, { outcome: title, rule: add2eHtmlEscape(config.description) });
  return true;
}

async function add2eHeal(config, choice) {
  const targets = add2eGetTargets({ fallbackCaster: false });
  if (!targets.length) { ui.notifications.warn(`${config.name} : cible obligatoire.`); return false; }

  const inverse = choice?.mode === "inverse";
  const formula = config.dice || "3d8+3";
  const roll = await add2eEvalRoll(formula);
  await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor, token: add2eGetCasterToken() }), flavor: inverse ? `Forme inversée — ${config.name}` : config.name });

  const target = targets[0];
  const targetActor = target.actor ?? target;
  const amount = Number(roll.total) || 0;
  const maxHP = Number(targetActor.system?.points_de_coup ?? targetActor.system?.pv_max ?? targetActor.system?.hp?.max ?? 0) || 0;
  const curHP = Number(targetActor.system?.pdv ?? targetActor.system?.pv ?? targetActor.system?.hp?.value ?? 0) || 0;

  if (inverse) {
    const newHp = Math.max(0, curHP - amount);
    await targetActor.update({ "system.pdv": newHp });
    await add2eChat("BLESSURES", `<p>Jet : <b>${roll.total}</b></p><p>PV perdus : <b>${amount}</b></p>`, null, { targetLabel: target.name, outcome: "BLESSURES", rule: "Forme inversée : dégâts appliqués à la cible touchée." });
    return true;
  }

  const newHp = maxHP ? Math.min(maxHP, curHP + amount) : curHP + amount;
  const healed = Math.max(0, newHp - curHP);
  await targetActor.update({ "system.pdv": newHp });
  await add2eChat("SOINS", `<p>Jet : <b>${roll.total}</b></p><p>PV rendus : <b>${healed}</b> ${maxHP ? "(limité par le maximum)" : ""}</p>`, null, { targetLabel: target.name, outcome: "SOINS", rule: add2eHtmlEscape(config.description) });
  return true;
}

async function add2eFullHeal(config) {
  const targets = add2eGetTargets({ fallbackCaster: false });
  if (!targets.length) { ui.notifications.warn(`${config.name} : cible obligatoire.`); return false; }

  const target = targets[0];
  const targetActor = target.actor ?? target;
  const maxHP = Number(targetActor.system?.points_de_coup ?? targetActor.system?.pv_max ?? targetActor.system?.hp?.max ?? 0) || 0;
  const curHP = Number(targetActor.system?.pdv ?? targetActor.system?.pv ?? targetActor.system?.hp?.value ?? 0) || 0;
  const healed = maxHP ? Math.max(0, maxHP - curHP) : 0;

  if (maxHP) await targetActor.update({ "system.pdv": maxHP });

  await add2eApplyTaggedEffect(targetActor, {
    name: config.name,
    img: item?.img,
    tags: [`sort:${config.slug}`, "classe:clerc", `niveau:${config.level}`, "guerison", "retire:maladie"],
    rounds: 0,
    description: config.description
  });

  await add2eChat("GUÉRISON", `<p>PV rendus : <b>${healed}</b></p><p>La guérison complète et les états retirés restent à valider selon la règle.</p>`, null, { targetLabel: target.name, outcome: "GUÉRISON", rule: add2eHtmlEscape(config.description) });
  return true;
}

async function add2eDamage(config) {
  const targets = add2eGetTargets({ fallbackCaster: false });
  const formula = config.dice && config.dice !== "special" ? config.dice : "1d20";
  const roll = await add2eEvalRoll(formula);
  await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor, token: add2eGetCasterToken() }), flavor: config.name });

  await add2eChat(config.name, `
    <p>Jet indicatif : <b>${roll.total}</b> (${formula})</p>
    ${targets.length ? `<p>Cible(s) : ${targets.map(t => `<b>${add2eHtmlEscape(t.name)}</b>`).join(", ")}</p>` : "<p>Aucune cible sélectionnée : appliquer manuellement si nécessaire.</p>"}
  `, null, { outcome: "EFFET OFFENSIF", rule: add2eHtmlEscape(config.description) });
  return true;
}

async function add2eRaiseOrRestore(config) {
  const targets = add2eGetTargets({ fallbackCaster: false });
  if (!targets.length) { ui.notifications.warn(`${config.name} : cible obligatoire.`); return false; }

  for (const t of targets) {
    await add2eApplyTaggedEffect(t.actor, {
      name: config.name,
      img: item?.img,
      tags: [`sort:${config.slug}`, "classe:clerc", `niveau:${config.level}`, "retour:vie", "restauration"],
      rounds: 0,
      description: config.description
    });
  }

  await add2eChat(config.name, `<p>Effet de restauration/rappel noté sur : ${targets.map(t => `<b>${add2eHtmlEscape(t.name)}</b>`).join(", ")}</p>`, null, { targetLabel: targets.map(t => t.name).join(", "), outcome: "RESTAURATION", rule: add2eHtmlEscape(config.description) });
  return true;
}

async function add2eNoteOnly(config, choice, outcome = null) {
  await add2eChat(config.name, `
    <p>${add2eHtmlEscape(config.description ?? "")}</p>
    ${choice?.note ? `<p>Note : <b>${add2eHtmlEscape(choice.note)}</b></p>` : ""}
  `, null, { outcome: outcome ?? config.name.toUpperCase(), rule: add2eHtmlEscape(config.description ?? "") });
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
  case "heal_critical":
    return await add2eHeal(ADD2E_SORT_CONFIG, choice);

  case "heal_full":
    return await add2eFullHeal(ADD2E_SORT_CONFIG);

  case "damage_roll":
  case "area_damage":
    return await add2eDamage(ADD2E_SORT_CONFIG);

  case "raise_dead":
  case "resurrection":
  case "regeneration":
  case "restoration":
    return await add2eRaiseOrRestore(ADD2E_SORT_CONFIG);

  case "simple_effect":
  case "wind_walk":
  case "holy_word":
    return await add2eApplySimpleEffect(choice, ADD2E_SORT_CONFIG);

  default:
    return await add2eNoteOnly(ADD2E_SORT_CONFIG, choice);
}
