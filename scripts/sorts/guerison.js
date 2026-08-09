// ADD2E — onUse Clerc niveaux 5-7 : Guérison
// Version : 2026-08-09-canonical-hp-dialog-chat-v3
// Retour attendu par le moteur ADD2E : true = sort consommé, false = sort non consommé.

const ADD2E_SORT_CONFIG = {
  "name": "Guérison",
  "slug": "guerison",
  "level": 6,
  "script_type": "heal_full",
  "description": "Guérison restaure la vitalité, la vie ou l’intégrité d’une créature. Selon le sort, il peut soigner des blessures, rappeler une créature à la vie, régénérer un membre, retirer un affaiblissement ou restaurer une condition perdue. Les limites exactes dépendent du sort et du MD.",
  "effect_rounds": 0,
  "effectTags": [
    "guerison",
    "soin:majeur",
    "retire:maladie"
  ],
  "modes": [
    {
      "id": "normal",
      "label": "Guérison"
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

function add2eHitPointEngine() {
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine ?? null;
  if (
    !engine
    || typeof engine.readHitPoints !== "function"
    || typeof engine.readMaximumHitPoints !== "function"
    || typeof engine.applyHitPointDamage !== "function"
    || typeof engine.applyHitPointHealing !== "function"
  ) {
    throw new Error("Le propriétaire canonique ADD2E des points de vie est indisponible.");
  }
  return engine;
}

async function add2eChat(title, html, speakerToken = null, options = {}) {
  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    throw new Error("Les constructeurs communs de cartes ADD2E sont indisponibles.");
  }

  const casterToken = speakerToken ?? add2eGetCasterToken();
  const casterActor = actor ?? casterToken?.actor ?? null;
  const casterName = casterActor?.name ?? casterToken?.name ?? "Clerc";
  const spellName = item?.name ?? title ?? "Sort divin";
  const targets = Array.from(game.user.targets ?? []);
  const targetLabel = options.targetLabel ?? (targets.length ? targets.map(t => t.name).join(", ") : casterName);
  const outcome = options.outcome ?? title ?? spellName;
  const rule = options.rule ?? options.regle ?? "Effet du sort appliqué selon sa description et l’arbitrage du MD.";

  const card = {
    actor: casterActor,
    title: title ?? spellName,
    icon: "fas fa-hand-holding-medical",
    variant: options.variant ?? "spell",
    source: {
      name: casterName,
      img: casterToken?.document?.texture?.src ?? casterActor?.img ?? item?.img ?? "icons/svg/mystery-man.svg",
      type: options.subtitle ?? "Sort divin"
    },
    rows: [
      { label: "Sort", value: spellName },
      { label: "Cible", value: String(targetLabel) },
      { label: "Effet", value: String(outcome) }
    ],
    trustedBodyHtml: `${html}<details style="margin-top:8px;"><summary>Règle appliquée</summary><div style="padding-top:6px;">${rule}</div></details>`,
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor: casterActor, token: casterToken }),
      rolls: Array.isArray(options.rolls) ? options.rolls.filter(Boolean) : []
    }
  };
  globalThis.add2eBuildChatCard(card);
  return globalThis.add2eCreateChatCard(card);
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
  if (typeof globalThis.add2eDialogWait !== "function") {
    throw new Error("L’API de fenêtre ADD2E est indisponible.");
  }

  let content = `<form class="add2e-cleric-spell-mode-form"><p><b>${add2eHtmlEscape(config.name)}</b></p>`;
  if (needsNote) {
    content += `<div class="form-group"><label>Note de scène / cible / paramètres</label><textarea name="note" rows="3"></textarea></div>`;
  }
  content += `</form>`;

  const buttons = modes.map((mode, index) => ({
    action: mode.id,
    label: mode.label,
    icon: "<i class='fas fa-wand-magic-sparkles'></i>",
    default: index === 0,
    callback: (_event, button) => ({
      mode: mode.id,
      note: String(button.form?.elements?.note?.value ?? "")
    })
  }));
  buttons.push({
    action: "cancel",
    label: "Annuler",
    icon: "<i class='fas fa-times'></i>",
    callback: () => null
  });

  return globalThis.add2eDialogWait({
    add2eTheme: "wizard",
    add2ePrimaryAction: modes[0]?.id ?? "normal",
    add2eClasses: ["add2e-cleric-spell-mode"],
    window: { title: config.name },
    content,
    buttons,
    close: () => null
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
  const target = targets[0];
  const targetActor = target.actor ?? target;
  const amount = Math.max(0, Number(roll.total) || 0);
  const engine = add2eHitPointEngine();

  if (inverse) {
    const damage = await engine.applyHitPointDamage(targetActor, amount, {
      reason: `${config.slug || "cleric-spell"}-inverse-damage`
    });
    await add2eChat(
      "BLESSURES",
      `<p>Jet : <b>${roll.total}</b></p><p>PV perdus : <b>${Number(damage?.effective) || 0}</b></p>`,
      null,
      {
        targetLabel: target.name,
        outcome: "BLESSURES",
        rule: "Forme inversée : dégâts appliqués à la cible touchée.",
        variant: "failure",
        rolls: [roll]
      }
    );
    return true;
  }

  const healing = await engine.applyHitPointHealing(targetActor, amount, {
    reason: `${config.slug || "cleric-spell"}-healing`
  });
  await add2eChat(
    "SOINS",
    `<p>Jet : <b>${roll.total}</b></p><p>PV rendus : <b>${Number(healing?.effective) || 0}</b> (limité par le maximum)</p>`,
    null,
    {
      targetLabel: target.name,
      outcome: "SOINS",
      rule: add2eHtmlEscape(config.description),
      variant: "success",
      rolls: [roll]
    }
  );
  return true;
}

async function add2eFullHeal(config) {
  const targets = add2eGetTargets({ fallbackCaster: false });
  if (!targets.length) { ui.notifications.warn(`${config.name} : cible obligatoire.`); return false; }

  const target = targets[0];
  const targetActor = target.actor ?? target;
  const engine = add2eHitPointEngine();
  const maxHP = engine.readMaximumHitPoints(targetActor);
  const curHP = engine.readHitPoints(targetActor);
  if (!Number.isFinite(maxHP) || maxHP <= 0) {
    ui.notifications.error(`${config.name} : PV maximum canoniques introuvables.`);
    return false;
  }

  const healing = await engine.applyHitPointHealing(targetActor, Math.max(0, maxHP - curHP), {
    reason: `${config.slug || "cleric-spell"}-full-healing`
  });

  await add2eApplyTaggedEffect(targetActor, {
    name: config.name,
    img: item?.img,
    tags: [`sort:${config.slug}`, "classe:clerc", `niveau:${config.level}`, "guerison", "retire:maladie"],
    rounds: 0,
    description: config.description
  });

  await add2eChat(
    "GUÉRISON",
    `<p>PV rendus : <b>${Number(healing?.effective) || 0}</b></p><p>La guérison complète et les états retirés restent à valider selon la règle.</p>`,
    null,
    {
      targetLabel: target.name,
      outcome: "GUÉRISON",
      rule: add2eHtmlEscape(config.description),
      variant: "success"
    }
  );
  return true;
}

async function add2eDamage(config) {
  const targets = add2eGetTargets({ fallbackCaster: false });
  const formula = config.dice && config.dice !== "special" ? config.dice : "1d20";
  const roll = await add2eEvalRoll(formula);

  await add2eChat(config.name, `
    <p>Jet indicatif : <b>${roll.total}</b> (${formula})</p>
    ${targets.length ? `<p>Cible(s) : ${targets.map(t => `<b>${add2eHtmlEscape(t.name)}</b>`).join(", ")}</p>` : "<p>Aucune cible sélectionnée : appliquer manuellement si nécessaire.</p>"}
  `, null, { outcome: "EFFET OFFENSIF", rule: add2eHtmlEscape(config.description), variant: "failure", rolls: [roll] });
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
