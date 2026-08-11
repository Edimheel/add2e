/* ADD2E — Druide : Forme animale. ApplicationV2/DialogV2, V13/V14/V15.
 * La forme reste active jusqu'au retour volontaire ou à la suppression de son effet.
 */
const ADD2E_DRUIDE_FORME_ANIMALE_VERSION = "2026-08-11-canonical-source-class-item-v11";
const SCOPE = "druid-animal-form";
const TRANSFORM_GROUP = "physical-form";
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

function sourceClassContext(currentActor, currentFeature) {
  const itemId = String(currentFeature?._add2eClassItemId ?? "").trim();
  if (!itemId) throw new Error("Forme animale : ID de l’Item classe source absent du contexte de capacité.");
  const item = currentActor?.items?.get?.(itemId) ?? null;
  if (!item || String(item.type ?? "").toLowerCase() !== "classe") {
    throw new Error("Forme animale : Item classe source introuvable sur l’acteur.");
  }
  const classKey = String(currentFeature?._add2eClassSlug ?? "").trim();
  if (classKey !== "druide") {
    throw new Error(`Forme animale : classe source canonique invalide (${classKey || "absente"}).`);
  }
  const tags = Array.isArray(item.system?.tags) ? item.system.tags.map(value => String(value ?? "").trim().toLowerCase()) : [];
  if (!tags.includes("classe:druide")) {
    throw new Error("Forme animale : l’Item classe source ne porte pas le tag canonique classe:druide.");
  }
  return {
    item,
    itemId: item.id,
    itemUuid: item.uuid,
    classKey
  };
}

const currentTick = () => {
  const engine = game?.add2e?.time ?? globalThis.ADD2E_TIME_ENGINE;
  const tick = typeof engine?.currentTick === "function" ? Number(engine.currentTick()) : NaN;
  return Number.isFinite(tick) ? Math.max(0, Math.floor(tick)) : null;
};

function resourceEngine() {
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine;
  if (!engine
    || typeof engine.checkResourceAvailability !== "function"
    || typeof engine.transactResources !== "function") {
    throw new Error("Le domaine canonique ADD2E resource n’est pas disponible pour la forme animale.");
  }
  return engine;
}

function categoryUsage(currentActor, currentFeature, category) {
  const builder = globalThis.add2eGetClassFeatureUsageResource;
  if (typeof builder !== "function") {
    throw new Error("Le propriétaire canonique ADD2E des utilisations de capacités est indisponible.");
  }
  const usage = builder(currentActor, currentFeature, { category });
  if (!usage?.descriptor) {
    throw new Error(`Ressource de forme animale introuvable pour la catégorie « ${category} ».`);
  }
  return usage;
}

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

function transformationModifiers(form, sourceClass) {
  const source = {
    kind: "class-feature",
    id: `${sourceClass.itemId}:${SCOPE}:${form.key}`,
    uuid: `${sourceClass.itemUuid}#${SCOPE}:${form.key}`,
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
        classItemId: sourceClass.itemId,
        classItemUuid: sourceClass.itemUuid,
        classKey: sourceClass.classKey,
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
        classItemId: sourceClass.itemId,
        classItemUuid: sourceClass.itemUuid,
        classKey: sourceClass.classKey,
        formKey: form.key,
        equipmentMerged: true
      }
    },
    ...movement
  ];
}

function naturalAttackDocuments(form, sourceClass) {
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
      sourceCapacite: "forme_animale",
      description: `Attaque naturelle temporaire de la forme ${form.label}.`
    },
    flags: {
      add2e: {
        tags: ["classe:druide", "capability:transformation", "forme_animale:attaque_naturelle"],
        sourceItemId: sourceClass.itemId,
        sourceItemUuid: sourceClass.itemUuid,
        sourceClassKey: sourceClass.classKey,
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

function effectData(form, tick, sourceClass) {
  return {
    name: `Forme animale — ${form.label}`,
    img: form.img,
    origin: sourceClass.itemUuid,
    disabled: false,
    transfer: false,
    changes: [],
    flags: {
      add2e: {
        sourceItemId: sourceClass.itemId,
        sourceItemUuid: sourceClass.itemUuid,
        sourceClassKey: sourceClass.classKey,
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
        modifiers: transformationModifiers(form, sourceClass),
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

async function apply(currentActor, token, form, tick, recovery, sourceClass) {
  const applyCanonical = globalThis.add2eApplyDocumentTransformation;
  if (typeof applyCanonical !== "function") {
    throw new Error("Le moteur canonique de transformation ADD2E est indisponible.");
  }

  const result = await applyCanonical({
    actor: currentActor,
    token,
    effectData: effectData(form, tick, sourceClass),
    group: TRANSFORM_GROUP,
    mode: form.key,
    scope: "actor",
    source: {
      kind: "class-feature",
      id: `${sourceClass.itemId}:${SCOPE}`,
      uuid: `${sourceClass.itemUuid}#${SCOPE}`,
      name: feature?.name ?? "Forme animale"
    },
    tokenUpdate: {
      "texture.src": form.img
    },
    actorUpdate: {},
    itemUpdates: equipmentUpdates(currentActor),
    temporaryItems: naturalAttackDocuments(form, sourceClass)
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
  if (typeof globalThis.add2eDialogWait !== "function") {
    throw new Error("L’API de fenêtre ADD2E est indisponible.");
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

  return globalThis.add2eDialogWait({
    add2eTheme: "druid",
    add2ePrimaryAction: available.length ? "transform" : "return",
    add2eClasses: ["add2e-druid-animal-form"],
    window: { title: "Forme animale du druide" },
    content: [
      '<form class="add2e-druid-animal-form-form" style="display:grid;gap:8px;font-family:var(--font-primary);">',
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
          icon: "<i class='fas fa-paw'></i>",
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
          icon: "<i class='fas fa-person'></i>",
          callback: () => ({ action: "return" })
        }]
        : []),
      {
        action: "cancel",
        label: "Annuler",
        icon: "<i class='fas fa-times'></i>",
        callback: () => null
      }
    ],
    close: () => null
  });
}

async function chat(
  currentActor,
  title,
  body,
  sourceClass,
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
          sourceItemId: sourceClass.itemId,
          sourceItemUuid: sourceClass.itemUuid,
          sourceClassKey: sourceClass.classKey,
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

const sourceClass = sourceClassContext(actor, feature);
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

const categories = Array.isArray(feature?.uses?.categories)
  ? [...new Set(feature.uses.categories.map(norm).filter(Boolean))]
  : [];
if (!categories.length) {
  throw new Error("Forme animale : aucune catégorie canonique n’est déclarée dans feature.uses.categories.");
}

const engine = resourceEngine();
const available = categories.filter(category => {
  const usage = categoryUsage(actor, feature, category);
  return engine.checkResourceAvailability(usage.descriptor, {
    cost: 1,
    consumer: "druide-forme-animale:availability"
  }).ok;
});
const choice = await choose(available, activeEffect, tokens);

if (!choice) return false;

if (choice.action === "return") {
  const restored = await restore(actor, activeEffect);
  if (!restored?.ok) {
    ui.notifications.warn("Aucune forme animale active à retirer.");
    return false;
  }
  await chat(actor, "Forme animale", `<b>${esc(actor.name)}</b> reprend sa forme normale.`, sourceClass);
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
const usage = categoryUsage(actor, feature, form.category);
const transaction = await engine.transactResources(usage.descriptor, async () => (
  apply(actor, selectedToken, form, tick, recovery, sourceClass)
), {
  reason: "druid-animal-form-use",
  consumer: "druide-forme-animale"
});
if (!transaction?.ok) {
  ui.notifications.warn(`La catégorie ${form.category} n’est plus disponible aujourd’hui.`);
  return false;
}
const result = transaction.result;
if (!result?.effect) {
  throw new Error("Forme animale : la transaction de ressource n’a pas produit de transformation valide.");
}

await chat(
  actor,
  "Forme animale",
  `<b>${esc(actor.name)}</b> prend la forme <b>${esc(form.label)}</b>.<br>`
  + `<b>CA :</b> ${form.combat.armorClass} ; <b>TAC0 :</b> ${form.combat.thac0} ; `
  + `<b>Mouvement :</b> ${esc(form.combat.movement)}.<br>`
  + `<b>PV rendus :</b> ${result.applied} (${percent}% des ${lost} PV perdus).<br>`
  + `<b>Attaques :</b> ${esc(form.attacks.map(attack => `${attack.label} ${attack.damage}`).join(" ; "))}.<br>`
  + "<small>La forme reste active jusqu'au retour volontaire ou à la suppression de son effet.</small>",
  sourceClass,
  form.img
);

ui.notifications.info(`Forme animale active : ${form.label}.`);
return true;
