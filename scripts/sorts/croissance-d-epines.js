// ADD2E — onUse Clerc niveau 3 : Croissance d’Épines
// Version : 2026-05-05-clerc-n3-v1
// Retour attendu par le moteur ADD2E : true = sort consommé, false = sort non consommé.

const ADD2E_SORT_CONFIG = {
  "name": "Croissance d’Épines",
  "slug": "croissance_d_epines",
  "script_type": "spike_growth",
  "description": "Rend une zone de végétation hérissée d’épines invisibles ou très difficiles à discerner. Les créatures qui traversent la zone subissent des blessures et voient leur déplacement gêné. L’effet est particulièrement dangereux dans les herbes, broussailles ou racines déjà présentes.",
  "effect_rounds": "3d4tours+level",
  "effectTags": [
    "terrain:difficile",
    "degat:epines",
    "piege:vegetal"
  ],
  "modes": [
    {
      "id": "normal",
      "label": "Croissance d’Épines"
    }
  ]
};
const ADD2E_ONUSE_TAG = "[ADD2E][SORT_ONUSE][CLERC_N3]";

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
  if (s === "5*level") return 5 * level;
  if (s === "10*level") return 10 * level;
  if (s === "60*level") return 60 * level;
  if (s === "60+10*level") return 60 + (10 * level);
  if (s === "10+level") return 10 + level;
  if (s === "10+10*level") return 10 + (10 * level);
  if (s === "8+1d8") return 8 + Math.ceil(Math.random() * 8);
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
    "animate_dead", "speak_dead", "ward_note", "glyph", "stone_shape",
    "plant_growth", "create_food_water", "locate_object", "dispel_magic"
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
    "niveau:3",
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
    <p>${add2eHtmlEscape(config.description ?? "")}</p>
  `);
  return true;
}

async function add2eAnimateDead(config, choice) {
  const level = add2eCasterLevel(actor);
  await add2eApplyTaggedEffect(actor, {
    name: config.name,
    img: item?.img,
    tags: [`sort:${config.slug}`, "classe:clerc", "liste:clerc", "niveau:3", "controle:mort_vivant", `niveau_clerc:${level}`],
    rounds: 0,
    description: `Animation permanente jusqu’à destruction ou dissipation. Note : ${choice?.note ?? ""}`
  });

  await add2eChat(config.name, `
    <p>Le sort anime des squelettes ou zombies à partir des restes disponibles.</p>
    <p><b>Niveau du clerc :</b> ${level}. Le nombre exact dépend des DV des corps utilisés.</p>
    ${choice?.note ? `<p><b>Note :</b> ${add2eHtmlEscape(choice.note)}</p>` : ""}
    <p>Créer ou lier les acteurs Squelette/Zombie depuis le bestiaire selon la décision du MD.</p>
  `);
  return true;
}

async function add2eCallLightning(config) {
  const level = add2eCasterLevel(actor);
  const targets = add2eGetTargets({ fallbackCaster: false });
  const formula = `${Math.min(10, 2 + level)}d8`;
  const roll = await add2eEvalRoll(formula);
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor, token: add2eGetCasterToken() }),
    flavor: `${config.name} — trait de foudre`
  });

  for (const t of targets) {
    await add2eApplyTaggedEffect(t.actor, {
      name: `${config.name} — touché par la foudre`,
      img: item?.img,
      tags: [`sort:${config.slug}`, "degat:foudre", "jet_sauvegarde:demi"],
      rounds: 1,
      description: `Dégâts du trait : ${roll.total}. Jet de protection pour moitié.`
    });
  }

  await add2eApplyTaggedEffect(actor, {
    name: `${config.name} — appel actif`,
    img: item?.img,
    tags: [`sort:${config.slug}`, "concentration:foudre", "orage"],
    rounds: add2eRoundCount(config.effect_rounds, level),
    description: "Le clerc peut rappeler des traits de foudre tant que les conditions et la durée le permettent."
  });

  await add2eChat(config.name, `
    <p>Trait de foudre : <b>${roll.total}</b> dégâts (${formula}), jet de protection pour moitié.</p>
    ${targets.length ? `<p>Cible(s) : ${targets.map(t => `<b>${add2eHtmlEscape(t.name)}</b>`).join(", ")}</p>` : "<p>Aucune cible sélectionnée : appliquer manuellement si nécessaire.</p>"}
  `);
  return true;
}

async function add2eCreateFoodWater(config) {
  const level = add2eCasterLevel(actor);
  const foodName = `Nourriture créée (${config.name})`;
  const waterName = `Eau créée (${config.name})`;

  const items = [
    {
      name: foodName,
      type: "objet",
      img: "icons/consumables/grains/bread-loaf-boule-rustic-brown.webp",
      system: {
        nom: foodName,
        quantite: level,
        quantity: level,
        description: `Nourriture créée par ${config.name}. Quantité indicative : ${level} portion(s), à ajuster selon la table.`,
        tags: ["objet:nourriture_creee", "sort:creation_nourriture_et_eau"]
      },
      flags: { add2e: { createdBySpell: config.name } }
    },
    {
      name: waterName,
      type: "objet",
      img: "icons/consumables/drinks/water-jug-blue.webp",
      system: {
        nom: waterName,
        quantite: level,
        quantity: level,
        description: `Eau créée par ${config.name}. Quantité indicative : ${level} unité(s), à ajuster selon la table.`,
        tags: ["objet:eau_creee", "sort:creation_nourriture_et_eau"]
      },
      flags: { add2e: { createdBySpell: config.name } }
    }
  ];

  await actor.createEmbeddedDocuments("Item", items);
  await add2eChat(config.name, `<p>Nourriture et eau créées dans l’inventaire de <b>${add2eHtmlEscape(actor.name)}</b>.</p><p>Quantité indicative : ${level} unité(s) de chaque, à ajuster selon la table.</p>`);
  return true;
}

async function add2eCureConditions(config) {
  const targets = add2eGetTargets({ fallbackCaster: false });
  if (!targets.length) {
    ui.notifications.warn(`${config.name} : cible obligatoire.`);
    return false;
  }

  let removed = 0;
  for (const t of targets) removed += await add2eRemoveTaggedEffects(t.actor, config.removeTags ?? []);
  await add2eChat(config.name, `
    <p>Cible(s) : ${targets.map(t => `<b>${add2eHtmlEscape(t.name)}</b>`).join(", ")}</p>
    <p>Effets retirés : <b>${removed}</b>.</p>
    <p>${add2eHtmlEscape(config.description)}</p>
  `);
  return true;
}

async function add2eDispelMagic(config, choice) {
  const level = add2eCasterLevel(actor);
  const roll = await add2eEvalRoll("1d20");
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor, token: add2eGetCasterToken() }),
    flavor: `${config.name} — jet indicatif de dissipation`
  });
  await add2eChat(config.name, `
    <p>Jet indicatif : <b>${roll.total}</b>. Niveau du clerc : <b>${level}</b>.</p>
    ${choice?.note ? `<p><b>Effet visé :</b> ${add2eHtmlEscape(choice.note)}</p>` : ""}
    <p>Comparer avec le niveau du lanceur de l’effet à dissiper selon la règle de dissipation.</p>
  `);
  return true;
}

async function add2eContinualLight(config, choice) {
  const targets = add2eGetTargets({ fallbackCaster: true });
  const mode = choice?.mode ?? "normal";
  const darkness = mode === "inverse";

  for (const t of targets) {
    if (t?.document?.update) {
      await t.document.update({
        light: darkness
          ? { dim: 0, bright: 0, color: "#000000", alpha: 0.5 }
          : { dim: 24, bright: 12, color: "#fff3a0", alpha: 0.45, animation: { type: "torch", speed: 1, intensity: 1 } }
      });
    }
    await add2eApplyTaggedEffect(t.actor, {
      name: darkness ? "Ténèbres Continuelles" : config.name,
      img: item?.img,
      tags: [`sort:${config.slug}`, "classe:clerc", "liste:clerc", "niveau:3", darkness ? "etat:tenebres_continuelles" : "etat:lumiere_continuelle"],
      rounds: 0,
      description: darkness ? "Ténèbres magiques permanentes jusqu’à dissipation." : "Lumière magique permanente jusqu’à dissipation."
    });
  }

  await add2eChat(darkness ? "Ténèbres Continuelles" : config.name, `<p>Effet permanent appliqué à : ${targets.map(t => `<b>${add2eHtmlEscape(t.name)}</b>`).join(", ")}.</p>`);
  return true;
}

async function add2ePrayer(config) {
  const targets = add2eGetTargets({ fallbackCaster: true });
  const rounds = add2eRoundCount(config.effect_rounds, add2eCasterLevel(actor));

  for (const t of targets) {
    await add2eApplyTaggedEffect(t.actor, {
      name: config.name,
      img: item?.img,
      tags: [`sort:${config.slug}`, "classe:clerc", "liste:clerc", "niveau:3", "bonus:toucher:1", "bonus:degats:1", "bonus:sauvegarde:1"],
      rounds,
      description: "Prière : bonus de +1 aux alliés. Appliquer le malus inverse aux ennemis concernés."
    });
  }

  await add2eChat(config.name, `
    <p>Prière active pour ${rounds} round(s).</p>
    <p>Les alliés reçoivent +1 ; les ennemis subissent le malus correspondant selon la zone.</p>
  `);
  return true;
}

async function add2eProtectionFire(config) {
  const targets = add2eGetTargets({ fallbackCaster: true });
  const level = add2eCasterLevel(actor);
  const absorption = 12 * level;
  for (const t of targets) {
    await add2eApplyTaggedEffect(t.actor, {
      name: config.name,
      img: item?.img,
      tags: [`sort:${config.slug}`, "classe:clerc", "liste:clerc", "niveau:3", "resistance:feu", `absorption_feu:${absorption}`],
      rounds: 0,
      description: `Protection contre le feu. Réserve indicative d’absorption magique : ${absorption} points.`
    });
  }
  await add2eChat(config.name, `<p>Protection contre le feu appliquée. Réserve indicative : <b>${absorption}</b> points de dégâts de feu magique.</p>`);
  return true;
}

async function add2ePyrotechnics(config, choice) {
  const title = choice.mode === "fumee" ? "Pyrotechnie — Fumée" : "Pyrotechnie — Feux d’artifice";
  await add2eChat(title, `
    <p>${choice.mode === "fumee" ? "La source de feu produit une fumée épaisse gênant la vision." : "La source de feu produit un éclat lumineux susceptible d’aveugler."}</p>
    <p>Source de feu et zone exacte à définir par le MD.</p>
  `);
  return true;
}

async function add2eLocateOrNote(config, choice) {
  await add2eChat(config.name, `
    <p>${add2eHtmlEscape(config.description ?? "")}</p>
    ${choice?.note ? `<p><b>Note :</b> ${add2eHtmlEscape(choice.note)}</p>` : ""}
  `);
  return true;
}

async function add2eMagicVestment(config) {
  const targets = add2eGetTargets({ fallbackCaster: true });
  const level = add2eCasterLevel(actor);
  const bonus = Math.max(1, Math.floor((level - 1) / 3) + 1);
  const rounds = add2eRoundCount(config.effect_rounds, level);

  for (const t of targets) {
    await add2eApplyTaggedEffect(t.actor, {
      name: config.name,
      img: item?.img,
      tags: [`sort:${config.slug}`, "classe:clerc", "liste:clerc", "niveau:3", `bonus_ca:${bonus}`, "armure:magique"],
      rounds,
      description: `Protection magique du vêtement/armure. Bonus CA indicatif : ${bonus}.`
    });
  }

  await add2eChat(config.name, `<p>Vêtement magique appliqué : bonus CA indicatif <b>${bonus}</b>, durée ${rounds} round(s).</p>`);
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
  case "animate_dead":
    return await add2eAnimateDead(ADD2E_SORT_CONFIG, choice);
  case "call_lightning":
    return await add2eCallLightning(ADD2E_SORT_CONFIG);
  case "create_food_water":
    return await add2eCreateFoodWater(ADD2E_SORT_CONFIG);
  case "cure_conditions":
    return await add2eCureConditions(ADD2E_SORT_CONFIG);
  case "dispel_magic":
    return await add2eDispelMagic(ADD2E_SORT_CONFIG, choice);
  case "continual_light":
    return await add2eContinualLight(ADD2E_SORT_CONFIG, choice);
  case "prayer":
    return await add2ePrayer(ADD2E_SORT_CONFIG);
  case "protection_fire":
    return await add2eProtectionFire(ADD2E_SORT_CONFIG);
  case "pyrotechnics":
    return await add2ePyrotechnics(ADD2E_SORT_CONFIG, choice);
  case "magic_vestment":
    return await add2eMagicVestment(ADD2E_SORT_CONFIG);
  case "locate_object":
  case "speak_dead":
  case "ward_note":
  case "glyph":
  case "stone_shape":
  case "plant_growth":
    return await add2eLocateOrNote(ADD2E_SORT_CONFIG, choice);
  default:
    return await add2eApplySimpleEffect(choice, ADD2E_SORT_CONFIG);
}
