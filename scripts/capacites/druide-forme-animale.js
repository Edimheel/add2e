/* ADD2E — Druide : Forme animale. ApplicationV2/DialogV2, V13/V14/V15.
 * La forme reste active jusqu'au retour volontaire ou à la suppression de son effet.
 */
const ADD2E_DRUIDE_FORME_ANIMALE_VERSION = "2026-08-02-canonical-transformation-profile-v9";
const SCOPE = "druid-animal-form";
const TRANSFORM_GROUP = "physical-form";
const DAY_ROUNDS = 1440;
const USAGE_FLAG = "capabilityUsage";
const EQUIPPED_FIELDS = Object.freeze([
  "equipee", "equipped", "equipe", "équipé", "porte", "portee", "porté", "worn"
]);

const FORMS = Object.freeze([
  {
    key: "grenouille",
    category: "reptile",
    size: "petite",
    label: "Grenouille",
    img: "systems/add2e/assets/token/grenouille.webp",
    combat: {
      armorClass: 9,
      thac0: 20,
      movement: "3 m, nage 3 m",
      movementModes: { ground: 3, swim: 3 }
    },
    attacks: [{ key: "morsure", label: "Morsure", damage: "1", damageType: "perforant" }]
  },
  {
    key: "grand_serpent",
    category: "reptile",
    size: "grande",
    label: "Grand serpent",
    img: "systems/add2e/assets/token/grand-serpent.webp",
    combat: {
      armorClass: 5,
      thac0: 17,
      movement: "15 m, nage 9 m",
      movementModes: { ground: 15, swim: 9 }
    },
    attacks: [
      { key: "morsure", label: "Morsure", damage: "1d4", damageType: "perforant" },
      { key: "constriction", label: "Constriction", damage: "2d4", damageType: "contondant" }
    ]
  },
  {
    key: "geai",
    category: "oiseau",
    size: "petite",
    label: "Geai",
    img: "systems/add2e/assets/token/geai.webp",
    combat: {
      armorClass: 7,
      thac0: 20,
      movement: "3 m, vol 21 m",
      movementModes: { ground: 3, flight: 21 }
    },
    attacks: [{ key: "bec", label: "Bec", damage: "1", damageType: "perforant" }]
  },
  {
    key: "aigle",
    category: "oiseau",
    size: "grande",
    label: "Aigle",
    img: "systems/add2e/assets/token/aigle.webp",
    combat: {
      armorClass: 7,
      thac0: 19,
      movement: "3 m, vol 48 m",
      movementModes: { ground: 3, flight: 48 }
    },
    attacks: [
      { key: "serres", label: "Serres", damage: "1d2", damageType: "tranchant" },
      { key: "bec", label: "Bec", damage: "1d2", damageType: "perforant" }
    ]
  },
  {
    key: "chauve_souris",
    category: "mammifere",
    size: "petite",
    label: "Chauve-souris",
    img: "systems/add2e/assets/token/chauve-souris.webp",
    combat: {
      armorClass: 8,
      thac0: 20,
      movement: "1,5 m, vol 15 m",
      movementModes: { ground: 1.5, flight: 15 }
    },
    attacks: [{ key: "morsure", label: "Morsure", damage: "1", damageType: "perforant" }]
  },
  {
    key: "ours_noir",
    category: "mammifere",
    size: "grande",
    label: "Ours noir",
    img: "systems/add2e/assets/token/ours-noir.webp",
    combat: {
      armorClass: 7,
      thac0: 17,
      movement: "12 m, escalade 6 m",
      movementModes: { ground: 12 }
    },
    attacks: [
      { key: "griffes", label: "Griffes", damage: "1d3", damageType: "tranchant" },
      { key: "morsure", label: "Morsure", damage: "1d6", damageType: "perforant" }
    ]
  }
]);

const esc = value => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#039;");

const norm = value => String(value ?? "")
  .trim()
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[’']/g, "")
  .replace(/[^a-z0-9]+/g, "_")
  .replace(/^_+|_+$/g, "");

const n = (...values) => {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return null;
};

const featureLevel = (currentActor, currentFeature) => {
  const level = Number(
    globalThis.add2eFeatureActorLevel?.(currentActor, currentFeature)
    ?? currentFeature?._add2eClassLevel
  );
  return Number.isFinite(level) && level >= 1 ? Math.floor(level) : null;
};

const currentTick = () => {
  const engine = game?.add2e?.time ?? globalThis.ADD2E_TIME_ENGINE;
  const tick = typeof engine?.currentTick === "function" ? Number(engine.currentTick()) : NaN;
  return Number.isFinite(tick) ? Math.max(0, Math.floor(tick)) : null;
};

const hp = currentActor => {
  const system = currentActor?.system ?? {};
  return {
    maximum: n(system.points_de_coup, system.pv_max, system.points_de_vie, system.hp?.max),
    current: n(system.pdv, system.pv, system.hp?.value)
  };
};

const effects = currentActor => Array.from(currentActor?.effects ?? []).filter(effect => {
  const transform = effect?.flags?.add2e?.documentTransformation ?? null;
  const meta = effect?.flags?.add2e?.capabilityTransformation ?? null;
  return transform?.group === TRANSFORM_GROUP
    && meta?.sourceKey === SCOPE
    && meta?.kind === "form";
});

function tokenDocument(value) {
  const document = value?.document ?? value ?? null;
  return document?.parent?.documentName === "Scene" ? document : null;
}

function tokenMatchesActor(document, currentActor) {
  return document?.actor === currentActor
    || document?.actorId === currentActor?.id
    || document?.actor?.id === currentActor?.id;
}

function tokenCandidates(currentActor) {
  const rows = [];
  const seen = new Set();
  const push = value => {
    const document = tokenDocument(value);
    const sceneId = document?.parent?.id ?? null;
    const tokenId = document?.id ?? null;
    const key = sceneId && tokenId ? `${sceneId}:${tokenId}` : "";
    if (!key || seen.has(key) || !tokenMatchesActor(document, currentActor)) return;
    seen.add(key);
    rows.push(document);
  };

  push(currentActor?.token);
  for (const placeable of canvas?.tokens?.controlled ?? []) push(placeable);
  for (const placeable of canvas?.tokens?.placeables ?? []) push(placeable);
  return rows;
}

function activeTokenFromEffect(effect) {
  const transform = effect?.flags?.add2e?.documentTransformation ?? null;
  return transform?.sceneId && transform?.tokenId
    ? game.scenes?.get?.(transform.sceneId)?.tokens?.get?.(transform.tokenId) ?? null
    : null;
}

function equipmentUpdates(currentActor) {
  return Array.from(currentActor?.items ?? [])
    .filter(item => ["arme", "armure"].includes(String(item?.type ?? "").toLowerCase()))
    .filter(item => EQUIPPED_FIELDS.some(field => item?.system?.[field] === true))
    .map(item => {
      const system = item?.system ?? {};
      const update = { _id: item.id, "system.equipee": false };
      for (const field of EQUIPPED_FIELDS) {
        if (Object.prototype.hasOwnProperty.call(system, field)) update[`system.${field}`] = false;
      }
      return update;
    });
}

function transformationModifiers(form) {
  const source = {
    kind: "class-feature",
    id: `${SCOPE}:${form.key}`,
    uuid: "",
    name: `Forme animale — ${form.label}`
  };
  const movementModes = form?.combat?.movementModes ?? {};
  const movement = Object.entries(movementModes)
    .filter(([, value]) => Number.isFinite(Number(value)) && Number(value) >= 0)
    .map(([target, value]) => ({
      id: `${SCOPE}:${form.key}:movement:${target}`,
      domain: "movement",
      target,
      operation: "set",
      value: Number(value),
      priority: 300,
      stacking: { mode: "replace", group: `capability-transformation:movement:${target}` },
      source,
      metadata: {
        label: `${form.label} — ${target}`,
        producer: "capability-transformation",
        sourceKey: SCOPE,
        formKey: form.key,
        movementMode: target,
        modes: [target],
        movementProfile: { ...movementModes }
      }
    }));

  return [
    {
      id: `${SCOPE}:${form.key}:encumbrance:carried-weight`,
      domain: "encumbrance",
      target: "carried-weight",
      operation: "set",
      value: 0,
      priority: 300,
      stacking: { mode: "replace", group: "capability-transformation:carried-weight" },
      source,
      metadata: {
        label: `${form.label} — équipement absorbé par la transformation`,
        producer: "capability-transformation",
        sourceKey: SCOPE,
        formKey: form.key,
        equipmentMerged: true
      }
    },
    ...movement
  ];
}

function naturalAttackDocuments(form) {
  return form.attacks.map(attack => ({
    type: "arme",
    name: `${form.label} — ${attack.label}`,
    img: form.img,
    system: {
      nom: `${form.label} — ${attack.label}`,
      degats: attack.damage,
      "dégâts": {
        contre_moyen: attack.damage,
        contre_grand: attack.damage
      },
      type_degats: attack.damageType,
      type_arme: "naturelle",
      famille_arme: "naturelle",
      proprietes: "Corps à corps, attaque naturelle, forme animale",
      equipee: true,
      equipped: true,
      bonus_toucher: 0,
      bonus_hit: 0,
      bonus_degats: 0,
      bonus_dom: 0,
      poids: 0,
      portee_courte: 0,
      portee_moyenne: 0,
      portee_longue: 0,
      tags: [
        "arme",
        "naturelle",
        "arme:naturelle",
        "type_arme:naturelle",
        "famille_arme:naturelle",
        "usage:corps_a_corps",
        "capability:transformation",
        "mod_carac:toucher:none",
        "mod_carac:degats:none"
      ],
      effectTags: [
        "capability:transformation",
        "forme_animale:attaque_naturelle"
      ],
      add2eAutoCreated: true,
      sourceClasse: "druide",
      sourceCapacite: "forme_animale",
      description: `Attaque naturelle temporaire de la forme ${form.label}.`
    },
    flags: {
      add2e: {
        tags: ["capability:transformation", "forme_animale:attaque_naturelle"],
        sourceClasse: "druide",
        sourceCapacite: "forme_animale",
        capabilityTransformation: {
          version: ADD2E_DRUIDE_FORME_ANIMALE_VERSION,
          sourceKey: SCOPE,
          kind: "natural-attack",
          formKey: form.key,
          attackKey: attack.key,
          allowParallelEquip: true
        }
      }
    }
  }));
}

function effectData(form, tick) {
  return {
    name: `Forme animale — ${form.label}`,
    img: form.img,
    disabled: false,
    transfer: false,
    changes: [],
    flags: {
      add2e: {
        sourceClasse: "druide",
        sourceCapacite: "forme_animale",
        sourceType: "class-feature",
        tags: [
          "classe:druide",
          "capability:transformation",
          "forme_animale:active",
          `forme_animale:${form.category}`,
          `forme_animale:${form.key}`,
          `taille:${form.size}`
        ],
        modifiers: transformationModifiers(form),
        capabilityTransformation: {
          version: ADD2E_DRUIDE_FORME_ANIMALE_VERSION,
          sourceKey: SCOPE,
          kind: "form",
          formKey: form.key,
          category: form.category,
          size: form.size,
          label: form.label,
          combat: {
            ...form.combat,
            movementModes: { ...(form.combat.movementModes ?? {}) }
          },
          equipment: {
            suspendWeapons: true,
            suspendArmor: true,
            mergeCarriedEquipment: true,
            naturalWeaponAllowance: ["naturelle"]
          },
          activatedAtTick: tick
        }
      }
    }
  };
}

async function restore(currentActor, currentEffect = effects(currentActor)[0] ?? null) {
  if (!currentEffect) return null;
  const restoreCanonical = globalThis.add2eRestoreDocumentTransformationFromEffect;
  if (typeof restoreCanonical !== "function") {
    throw new Error("Le moteur canonique de transformation ADD2E est indisponible.");
  }

  const result = await restoreCanonical(currentEffect, {
    reason: "capability-transformation-return"
  });
  if (!result?.ok || result?.tokenRestored !== true) {
    console.error("[ADD2E][DRUIDE][FORME_ANIMALE][RESTORE_FAILED]", {
      actor: currentActor.name,
      actorId: currentActor.id,
      effect: currentEffect.name,
      effectId: currentEffect.id,
      result
    });
    throw new Error(
      `Retour à la forme normale non confirmé : ${result?.reason ?? "résultat de restauration invalide"}. `
      + `L’effet est conservé pour ne pas perdre son image d’origine.`
    );
  }

  if (currentActor.effects?.get?.(currentEffect.id)) {
    await currentActor.deleteEmbeddedDocuments("ActiveEffect", [currentEffect.id], {
      add2eDocumentTransform: true,
      add2eDocumentTransformReason: "capability-transformation-return"
    });
  }
  return result;
}

async function apply(currentActor, token, form, tick, recovery) {
  const applyCanonical = globalThis.add2eApplyDocumentTransformation;
  if (typeof applyCanonical !== "function") {
    throw new Error("Le moteur canonique de transformation ADD2E est indisponible.");
  }

  const result = await applyCanonical({
    actor: currentActor,
    token,
    effectData: effectData(form, tick),
    group: TRANSFORM_GROUP,
    mode: form.key,
    scope: "actor",
    source: {
      kind: "class-feature",
      id: SCOPE,
      uuid: feature?.uuid ?? "",
      name: feature?.name ?? "Forme animale"
    },
    tokenUpdate: {
      "texture.src": form.img
    },
    actorUpdate: {},
    itemUpdates: equipmentUpdates(currentActor),
    temporaryItems: naturalAttackDocuments(form)
  });

  if (!result?.ok || !result.effect) {
    throw new Error(`Échec de la transformation canonique : ${result?.reason ?? "résultat invalide"}.`);
  }

  let appliedRecovery = 0;
  if (recovery > 0) {
    const life = hp(currentActor);
    const next = Number.isFinite(life.current) && Number.isFinite(life.maximum)
      ? Math.min(life.maximum, life.current + recovery)
      : life.current;
    if (Number.isFinite(next) && Number.isFinite(life.current) && next !== life.current) {
      try {
        await currentActor.update({ "system.pdv": next }, {
          add2eInternal: true,
          add2eReason: "capability-transformation-recovery",
          render: false
        });
        appliedRecovery = Math.max(0, next - life.current);
      } catch (error) {
        await restore(currentActor, result.effect);
        throw error;
      }
    }
  }

  return { effect: result.effect, applied: appliedRecovery };
}

async function choose(available, currentEffect, tokens) {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.wait) {
    ui.notifications.error("Forme animale : DialogV2 est indisponible.");
    return null;
  }

  const formOptions = FORMS
    .filter(form => available.includes(form.category))
    .map(form => (
      `<option value="${esc(form.key)}">${esc(form.label)} — CA ${form.combat.armorClass}, `
      + `TAC0 ${form.combat.thac0}, ${esc(form.combat.movement)}</option>`
    ))
    .join("");
  const currentToken = activeTokenFromEffect(currentEffect);
  const tokenOptions = tokens.map(token => {
    const selected = currentToken?.id === token.id && currentToken?.parent?.id === token.parent?.id ? " selected" : "";
    const sceneName = token.parent?.name ?? "Scène";
    const tokenName = token.name ?? token.actor?.name ?? "Token";
    return `<option value="${esc(`${token.parent?.id}:${token.id}`)}"${selected}>${esc(tokenName)} — ${esc(sceneName)}</option>`;
  }).join("");

  return DialogV2.wait({
    window: { title: "Forme animale du druide" },
    position: { width: 600 },
    content: [
      '<form style="display:grid;gap:8px;font-family:var(--font-primary);">',
      "<div>La forme reste active jusqu'au retour volontaire ou à la suppression de son effet.</div>",
      available.length
        ? `<label>Forme <select name="formKey" style="width:100%">${formOptions}</select></label>`
        : "<div>Les trois catégories ont déjà été utilisées aujourd'hui.</div>",
      available.length && tokens.length > 1
        ? `<label>Token transformé <select name="tokenKey" style="width:100%">${tokenOptions}</select></label>`
        : "",
      "</form>"
    ].join(""),
    buttons: [
      ...(available.length
        ? [{
          action: "transform",
          label: "Prendre la forme",
          icon: "fa-solid fa-paw",
          default: true,
          callback: (_event, button) => ({
            action: "transform",
            formKey: String(button.form?.elements?.formKey?.value ?? ""),
            tokenKey: String(button.form?.elements?.tokenKey?.value ?? "")
          })
        }]
        : []),
      ...(currentEffect
        ? [{
          action: "return",
          label: "Revenir à la forme normale",
          icon: "fa-solid fa-person",
          callback: () => ({ action: "return" })
        }]
        : []),
      {
        action: "cancel",
        label: "Annuler",
        icon: "fa-solid fa-xmark",
        callback: () => null
      }
    ],
    rejectClose: false
  });
}

async function chat(
  currentActor,
  title,
  body,
  img = "icons/magic/nature/wolf-paw-glow-green.webp"
) {
  const build = globalThis.add2eBuildChatCard;
  const create = globalThis.add2eCreateChatCard;
  if (typeof build !== "function" || typeof create !== "function") {
    throw new Error("Les constructeurs communs de cartes ADD2E ne sont pas disponibles.");
  }
  const options = {
    actor: currentActor,
    title,
    icon: "fas fa-paw",
    variant: "ability",
    source: {
      name: currentActor.name,
      img,
      type: "Capacité de druide"
    },
    trustedBodyHtml: body,
    chatData: {
      flags: {
        add2e: {
          capabilityTransformation: true,
          sourceCapacite: "forme_animale",
          version: ADD2E_DRUIDE_FORME_ANIMALE_VERSION
        }
      }
    }
  };
  build(options);
  return create(options);
}

if (!actor) {
  ui.notifications.error("Forme animale : acteur introuvable.");
  return false;
}

const level = featureLevel(actor, feature);
if (level === null) {
  ui.notifications.error("Forme animale : niveau de Druide introuvable.");
  return false;
}
if (level < 7) {
  ui.notifications.warn("Forme animale indisponible avant le niveau 7.");
  return false;
}

const tick = currentTick();
if (tick === null) {
  ui.notifications.error("Forme animale : le compteur de temps ADD2E est indisponible.");
  return false;
}

const tokens = tokenCandidates(actor);
const activeEffect = effects(actor)[0] ?? null;
if (!tokens.length && !activeEffect) {
  ui.notifications.warn("Forme animale : aucun token actif de cet acteur n’est disponible sur la scène.");
  return false;
}

const day = Math.floor(tick / DAY_ROUNDS);
const root = actor.getFlag("add2e", USAGE_FLAG) ?? {};
const previous = root?.[SCOPE] ?? {};
const categories = ["reptile", "oiseau", "mammifere"];
const used = Number(previous.dayIndex) === day
  && previous.categories
  && typeof previous.categories === "object"
  ? previous.categories
  : {};
const available = categories.filter(category => used?.[category]?.used !== true);
const choice = await choose(available, activeEffect, tokens);

if (!choice) return false;

if (choice.action === "return") {
  const restored = await restore(actor, activeEffect);
  if (!restored?.ok) {
    ui.notifications.warn("Aucune forme animale active à retirer.");
    return false;
  }
  await chat(actor, "Forme animale", `<b>${esc(actor.name)}</b> reprend sa forme normale.`);
  ui.notifications.info("Retour à la forme normale.");
  return true;
}

const form = FORMS.find(entry => entry.key === norm(choice.formKey));
if (!form || !available.includes(form.category)) {
  ui.notifications.warn("Cette forme animale est indisponible aujourd’hui.");
  return false;
}

let selectedToken = tokens[0] ?? null;
if (choice.tokenKey) {
  const [sceneId, tokenId] = String(choice.tokenKey).split(":");
  selectedToken = tokens.find(token => token.parent?.id === sceneId && token.id === tokenId) ?? null;
}
if (!selectedToken) {
  ui.notifications.warn("Le token choisi pour la transformation n’est plus disponible.");
  return false;
}

const life = hp(actor);
const lost = Number.isFinite(life.maximum) && Number.isFinite(life.current)
  ? Math.max(0, life.maximum - life.current)
  : 0;
const roll = await new Roll("1d6").evaluate();
if (game.dice3d) void game.dice3d.showForRoll(roll);
const die = Math.max(1, Math.min(6, Number(roll.total) || 1));
const percent = die * 10;
const recovery = Math.min(lost, Math.ceil(lost * percent / 100));
const result = await apply(actor, selectedToken, form, tick, recovery);

const nextUsed = {
  ...used,
  [form.category]: {
    used: true,
    usedAtTick: tick,
    formKey: form.key,
    formName: form.label,
    recoveryRoll: die,
    recoveryPercent: percent,
    recoveryPoints: result.applied
  }
};

await actor.setFlag("add2e", USAGE_FLAG, {
  ...root,
  [SCOPE]: {
    version: ADD2E_DRUIDE_FORME_ANIMALE_VERSION,
    reset: { type: "add2e-day", rounds: DAY_ROUNDS },
    dayIndex: day,
    categories: nextUsed,
    updatedAtTick: tick
  }
});

await chat(
  actor,
  "Forme animale",
  `<b>${esc(actor.name)}</b> prend la forme <b>${esc(form.label)}</b>.<br>`
  + `<b>CA :</b> ${form.combat.armorClass} ; <b>TAC0 :</b> ${form.combat.thac0} ; `
  + `<b>Mouvement :</b> ${esc(form.combat.movement)}.<br>`
  + `<b>PV rendus :</b> ${result.applied} (${percent}% des ${lost} PV perdus).<br>`
  + `<b>Attaques :</b> ${esc(form.attacks.map(attack => `${attack.label} ${attack.damage}`).join(" ; "))}.<br>`
  + "<small>La forme reste active jusqu'au retour volontaire ou à la suppression de son effet.</small>",
  form.img
);

ui.notifications.info(`Forme animale active : ${form.label}.`);
return true;
