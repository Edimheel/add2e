/*
 * ADD2E — Druide : Forme animale
 *
 * Mécanique générique de transformation réutilisable : elle mémorise les
 * caractéristiques de forme, les attaques temporaires et les images de tokens,
 * puis restaure exactement l'état précédent à la sortie de forme.
 * Compatible Foundry V13/V14/V15 — DialogV2 uniquement.
 */
const ADD2E_DRUIDE_FORME_ANIMALE_VERSION = "2026-07-07-animal-forms-v3";
const ADD2E_TRANSFORMATION_SCOPE = "druid-animal-form";
const ADD2E_DAY_ROUNDS = 24 * 60;
const ADD2E_SOCKET = "system.add2e";
const ADD2E_GM_OPERATION = "ADD2E_GM_OPERATION";
const ADD2E_TRANSFORMATION_STATE_FLAG = "capabilityTransformations";
const ADD2E_TRANSFORMATION_USAGE_FLAG = "capabilityUsage";
const ADD2E_FORM_ICON = "icons/magic/nature/wolf-paw-glow-green.webp";

/*
 * Les valeurs sont les caractéristiques de combat et de mouvement portées par
 * les fiches de créatures : CA, TAC0, déplacement, taille, poids, sens et
 * attaques naturelles. Les scores FOR/DEX/CON ne sont pas remplacés, car le
 * Manuel des joueurs et le Bestiaire fourni ne les donnent pas pour ces formes.
 */
const ADD2E_DRUIDE_ANIMAL_FORMS = Object.freeze([
  {
    key: "grenouille",
    category: "reptile",
    label: "Grenouille",
    img: "systems/add2e/assets/token/grenouille.webp",
    form: {
      "system.ca": 9,
      "system.ca_optimale": 9,
      "system.thac0": 20,
      "system.vitesse_deplacement": "3 m, nage 3 m",
      "system.taille": "Minuscule",
      "system.poids": "0,1 kg",
      "system.vision": "Vision normale",
      "system.ecoute": "Vibrations et sons proches"
    },
    summary: "Petite forme amphibienne, nageuse et discrète.",
    attacks: [{ key: "morsure", label: "Morsure", damage: "1", damageType: "perforant" }]
  },
  {
    key: "grand_serpent",
    category: "reptile",
    label: "Grand serpent",
    img: "systems/add2e/assets/token/grand-serpent.webp",
    form: {
      "system.ca": 5,
      "system.ca_optimale": 5,
      "system.thac0": 17,
      "system.vitesse_deplacement": "15 m, nage 9 m",
      "system.taille": "Grande",
      "system.poids": "Environ deux fois le poids du druide",
      "system.vision": "Vision normale ; perception des vibrations",
      "system.ecoute": "Vibrations du sol"
    },
    summary: "Grande forme reptilienne, avec morsure et constriction.",
    attacks: [
      { key: "morsure", label: "Morsure", damage: "1d4", damageType: "perforant" },
      { key: "constriction", label: "Constriction", damage: "2d4", damageType: "contondant" }
    ]
  },
  {
    key: "geai",
    category: "oiseau",
    label: "Geai",
    img: "systems/add2e/assets/token/geai.webp",
    form: {
      "system.ca": 7,
      "system.ca_optimale": 7,
      "system.thac0": 20,
      "system.vitesse_deplacement": "3 m, vol 21 m",
      "system.taille": "Minuscule",
      "system.poids": "0,1 kg",
      "system.vision": "Vue aérienne et vision diurne",
      "system.ecoute": "Ouïe fine"
    },
    summary: "Petite forme avienne, mobile et adaptée à l'observation aérienne.",
    attacks: [{ key: "bec", label: "Bec", damage: "1", damageType: "perforant" }]
  },
  {
    key: "aigle",
    category: "oiseau",
    label: "Aigle",
    img: "systems/add2e/assets/token/aigle.webp",
    form: {
      "system.ca": 7,
      "system.ca_optimale": 7,
      "system.thac0": 19,
      "system.vitesse_deplacement": "3 m, vol 48 m",
      "system.taille": "Moyenne",
      "system.poids": "Environ deux fois le poids du druide",
      "system.vision": "Vue perçante et vision diurne",
      "system.ecoute": "Ouïe fine"
    },
    summary: "Grande forme avienne, rapide en vol et munie de serres.",
    attacks: [
      { key: "serres", label: "Serres", damage: "1d2", damageType: "tranchant" },
      { key: "bec", label: "Bec", damage: "1d2", damageType: "perforant" }
    ]
  },
  {
    key: "chauve_souris",
    category: "mammifere",
    label: "Chauve-souris",
    img: "systems/add2e/assets/token/chauve-souris.webp",
    form: {
      "system.ca": 8,
      "system.ca_optimale": 8,
      "system.thac0": 20,
      "system.vitesse_deplacement": "1,5 m, vol 15 m",
      "system.taille": "Minuscule",
      "system.poids": "0,1 kg",
      "system.vision": "Écholocation ; vision limitée",
      "system.ecoute": "Écholocation"
    },
    summary: "Petite forme mammifère volante, adaptée au déplacement dans l'obscurité.",
    attacks: [{ key: "morsure", label: "Morsure", damage: "1", damageType: "perforant" }]
  },
  {
    key: "ours_noir",
    category: "mammifere",
    label: "Ours noir",
    img: "systems/add2e/assets/token/ours-noir.webp",
    form: {
      "system.ca": 7,
      "system.ca_optimale": 7,
      "system.thac0": 17,
      "system.vitesse_deplacement": "12 m, escalade 6 m",
      "system.taille": "Grande",
      "system.poids": "Environ deux fois le poids du druide",
      "system.vision": "Vision normale",
      "system.ecoute": "Odorat et ouïe développés"
    },
    summary: "Grande forme mammifère puissante, munie de griffes et d'une morsure.",
    attacks: [
      { key: "griffes", label: "Griffes", damage: "1d3", damageType: "tranchant" },
      { key: "morsure", label: "Morsure", damage: "1d6", damageType: "perforant" }
    ]
  }
]);

const ADD2E_FORM_SYSTEM_PATHS = Object.freeze([
  "system.ca",
  "system.ca_optimale",
  "system.thac0",
  "system.vitesse_deplacement",
  "system.taille",
  "system.poids",
  "system.vision",
  "system.ecoute"
]);

globalThis.ADD2E_DRUIDE_FORME_ANIMALE_VERSION = ADD2E_DRUIDE_FORME_ANIMALE_VERSION;
globalThis.ADD2E_CAPABILITY_TRANSFORMATIONS ??= {};

function a2eDruideNorm(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function a2eDruideEsc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function a2eDruideClone(value) {
  try { return foundry.utils.deepClone(value); }
  catch (_error) {
    try { return JSON.parse(JSON.stringify(value)); }
    catch (_jsonError) { return value; }
  }
}

function a2eDruideGetProperty(object, path) {
  if (typeof foundry?.utils?.getProperty === "function") return foundry.utils.getProperty(object, path);
  return String(path).split(".").reduce((current, key) => current?.[key], object);
}

function a2eDruideChatStyleData() {
  if (CONST.CHAT_MESSAGE_STYLES) return { style: CONST.CHAT_MESSAGE_STYLES.OTHER };
  return { type: CONST.CHAT_MESSAGE_TYPES?.OTHER ?? 0 };
}

function a2eDruideFeatureLevel(currentActor, currentFeature) {
  const level = Number(
    globalThis.add2eFeatureActorLevel?.(currentActor, currentFeature)
    ?? currentFeature?._add2eClassLevel
  );
  return Number.isFinite(level) && level >= 1 ? Math.floor(level) : null;
}

function a2eDruideCurrentTick() {
  const engine = game?.add2e?.time ?? globalThis.ADD2E_TIME_ENGINE ?? null;
  const tick = typeof engine?.currentTick === "function" ? Number(engine.currentTick()) : NaN;
  return Number.isFinite(tick) ? Math.max(0, Math.floor(tick)) : null;
}

function a2eDruideReadNumber(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function a2eDruideHp(actorDocument) {
  const system = actorDocument?.system ?? {};
  const maximum = a2eDruideReadNumber(
    system.points_de_coup,
    system.pv_max,
    system.points_de_vie,
    system.hp?.max,
    system.attributes?.hp?.max
  );
  const current = a2eDruideReadNumber(
    system.pdv,
    system.pv,
    system.hp?.value,
    system.attributes?.hp?.value
  );
  return { maximum, current };
}

function a2eDruideCategoryLabel(category) {
  return ({ reptile: "Reptile", oiseau: "Oiseau", mammifere: "Mammifère" })[category] ?? "Forme animale";
}

function a2eDruideFormByKey(key) {
  const normalized = a2eDruideNorm(key);
  return ADD2E_DRUIDE_ANIMAL_FORMS.find(form => form.key === normalized) ?? null;
}

function a2eDruideUsageState(currentActor, dayIndex) {
  const root = currentActor.getFlag("add2e", ADD2E_TRANSFORMATION_USAGE_FLAG) ?? {};
  const stored = root?.[ADD2E_TRANSFORMATION_SCOPE] ?? {};
  const valid = Number(stored.dayIndex) === Number(dayIndex);
  return {
    root: root && typeof root === "object" ? root : {},
    categories: valid && stored.categories && typeof stored.categories === "object" ? stored.categories : {},
    dayIndex
  };
}

function a2eDruideTransformationState(currentActor) {
  const root = currentActor.getFlag("add2e", ADD2E_TRANSFORMATION_STATE_FLAG) ?? {};
  const state = root?.[ADD2E_TRANSFORMATION_SCOPE] ?? null;
  return {
    root: root && typeof root === "object" ? root : {},
    state: state && typeof state === "object" ? state : null
  };
}

async function a2eDruideSetTransformationState(currentActor, root, state = null) {
  const next = { ...(root && typeof root === "object" ? root : {}) };
  if (state) next[ADD2E_TRANSFORMATION_SCOPE] = state;
  else delete next[ADD2E_TRANSFORMATION_SCOPE];

  if (Object.keys(next).length) return currentActor.setFlag("add2e", ADD2E_TRANSFORMATION_STATE_FLAG, next);
  return currentActor.unsetFlag("add2e", ADD2E_TRANSFORMATION_STATE_FLAG);
}

function a2eDruideTransformationEffects(currentActor) {
  return Array.from(currentActor?.effects ?? []).filter(effect => {
    const transformation = effect?.flags?.add2e?.capabilityTransformation ?? {};
    return transformation?.sourceKey === ADD2E_TRANSFORMATION_SCOPE;
  });
}

function a2eDruideFormItems(currentActor) {
  return Array.from(currentActor?.items ?? []).filter(item => {
    const transformation = item?.flags?.add2e?.capabilityTransformation ?? {};
    return transformation?.sourceKey === ADD2E_TRANSFORMATION_SCOPE
      && transformation?.kind === "natural-attack";
  });
}

function a2eDruideCurrentTokenDocuments(currentActor) {
  const scene = canvas?.scene ?? game.scenes?.active ?? null;
  if (!scene?.tokens) return [];
  return Array.from(scene.tokens ?? []).filter(token => token?.actorId === currentActor?.id || token?.actor?.id === currentActor?.id);
}

async function a2eDruideUpdateToken(document, updateData, reason) {
  const scene = document?.parent ?? canvas?.scene ?? null;
  if (!document?.id || !scene?.id) return false;

  if (game.user?.isGM) {
    await document.update(updateData, { add2eInternal: true, add2eReason: reason });
    return true;
  }

  if (game.socket?.emit) {
    game.socket.emit(ADD2E_SOCKET, {
      type: ADD2E_GM_OPERATION,
      operation: "updateToken",
      payload: { sceneId: scene.id, tokenId: document.id, updateData }
    });
    return true;
  }

  try {
    await document.update(updateData, { add2eInternal: true, add2eReason: reason });
    return true;
  } catch (_error) {
    return false;
  }
}

function a2eDruideCaptureFormSnapshot(currentActor) {
  const actor = {};
  for (const path of ADD2E_FORM_SYSTEM_PATHS) actor[path] = a2eDruideClone(a2eDruideGetProperty(currentActor, path));

  const tokens = a2eDruideCurrentTokenDocuments(currentActor).map(document => ({
    sceneId: document.parent?.id ?? canvas?.scene?.id ?? null,
    tokenId: document.id,
    textureSrc: document.texture?.src ?? null
  })).filter(entry => entry.sceneId && entry.tokenId);

  return { actor, tokens };
}

async function a2eDruideApplyTokenImage(currentActor, image) {
  const documents = a2eDruideCurrentTokenDocuments(currentActor);
  for (const document of documents) {
    await a2eDruideUpdateToken(document, { "texture.src": image }, "capability-transformation-token-image");
  }
  return documents.length;
}

async function a2eDruideRestoreTokenImages(snapshot = {}) {
  const tokens = Array.isArray(snapshot?.tokens) ? snapshot.tokens : [];
  for (const entry of tokens) {
    const scene = game.scenes?.get?.(entry.sceneId) ?? null;
    const document = scene?.tokens?.get?.(entry.tokenId) ?? null;
    if (!document || !entry.textureSrc) continue;
    await a2eDruideUpdateToken(document, { "texture.src": entry.textureSrc }, "capability-transformation-token-restore");
  }
}

async function a2eDruideCreateNaturalAttacks(currentActor, form) {
  const attacks = Array.isArray(form?.attacks) ? form.attacks : [];
  if (!attacks.length) return [];

  const data = attacks.map(attack => ({
    type: "arme",
    name: `${form.label} — ${attack.label}`,
    img: form.img,
    system: {
      nom: `${form.label} — ${attack.label}`,
      degats: attack.damage,
      "dégâts": { contre_moyen: attack.damage, contre_grand: attack.damage },
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
        "arme:naturelle",
        "type_arme:naturelle",
        "famille_arme:naturelle",
        "usage:corps_a_corps",
        "capability:transformation",
        "mod_carac:toucher:none",
        "mod_carac:degats:none"
      ],
      effectTags: ["capability:transformation", "forme_animale:attaque_naturelle"],
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
          sourceKey: ADD2E_TRANSFORMATION_SCOPE,
          kind: "natural-attack",
          formKey: form.key,
          attackKey: attack.key
        }
      }
    }
  }));

  const created = await currentActor.createEmbeddedDocuments("Item", data, {
    add2eInternal: true,
    add2eReason: "capability-transformation-natural-attacks"
  });
  return created ?? [];
}

async function a2eDruideRestoreTransformation(currentActor, { deleteEffects = true, reason = "capability-transformation-return" } = {}) {
  if (!currentActor) return false;
  const stored = a2eDruideTransformationState(currentActor);
  const state = stored.state;
  if (!state) return false;

  const actorRestore = state.snapshot?.actor && typeof state.snapshot.actor === "object" ? state.snapshot.actor : {};
  if (Object.keys(actorRestore).length) {
    await currentActor.update(actorRestore, { add2eInternal: true, add2eReason: reason });
  }

  await a2eDruideRestoreTokenImages(state.snapshot);

  const itemIds = a2eDruideFormItems(currentActor).map(item => item.id).filter(Boolean);
  if (itemIds.length) {
    await currentActor.deleteEmbeddedDocuments("Item", itemIds, { add2eInternal: true, add2eReason: reason });
  }

  if (deleteEffects) {
    const effectIds = a2eDruideTransformationEffects(currentActor).map(effect => effect.id).filter(Boolean);
    if (effectIds.length) {
      await currentActor.deleteEmbeddedDocuments("ActiveEffect", effectIds, {
        add2eInternal: true,
        add2eDruideTransformationInternal: true,
        add2eReason: reason
      });
    }
  }

  await a2eDruideSetTransformationState(currentActor, stored.root, null);
  return true;
}

async function a2eDruideApplyTransformation({ currentActor, form, currentTick, recoveredHp, recoveryPercent, recoveryRoll }) {
  const previous = a2eDruideTransformationState(currentActor);
  if (previous.state) await a2eDruideRestoreTransformation(currentActor, { reason: "capability-transformation-switch" });

  const snapshot = a2eDruideCaptureFormSnapshot(currentActor);
  const actorChanges = { ...(form.form ?? {}) };
  const hp = a2eDruideHp(currentActor);
  if (Number.isFinite(hp.current) && recoveredHp > 0) actorChanges["system.pdv"] = hp.current + recoveredHp;
  if (Object.keys(actorChanges).length) {
    await currentActor.update(actorChanges, { add2eInternal: true, add2eReason: "capability-transformation-apply" });
  }

  const attacks = await a2eDruideCreateNaturalAttacks(currentActor, form);
  await a2eDruideApplyTokenImage(currentActor, form.img);

  const effectData = {
    name: `Forme animale — ${form.label}`,
    img: form.img,
    disabled: false,
    transfer: false,
    changes: [],
    duration: {},
    flags: {
      add2e: {
        sourceClasse: "druide",
        sourceCapacite: "forme_animale",
        forme: form.category,
        tags: ["classe:druide", "capability:transformation", "forme_animale:active", `forme_animale:${form.category}`, `forme_animale:${form.key}`],
        capabilityTransformation: {
          version: ADD2E_DRUIDE_FORME_ANIMALE_VERSION,
          sourceKey: ADD2E_TRANSFORMATION_SCOPE,
          kind: "form",
          formKey: form.key,
          category: form.category,
          activatedAtTick: currentTick
        }
      }
    }
  };

  const created = await currentActor.createEmbeddedDocuments("ActiveEffect", [effectData], {
    add2eInternal: true,
    add2eReason: "capability-transformation-apply"
  });
  const effect = created?.[0] ?? null;

  const stateRoot = a2eDruideTransformationState(currentActor).root;
  await a2eDruideSetTransformationState(currentActor, stateRoot, {
    version: ADD2E_DRUIDE_FORME_ANIMALE_VERSION,
    sourceKey: ADD2E_TRANSFORMATION_SCOPE,
    formKey: form.key,
    category: form.category,
    effectId: effect?.id ?? null,
    naturalAttackIds: attacks.map(attack => attack.id).filter(Boolean),
    snapshot,
    recovery: { roll: recoveryRoll, percent: recoveryPercent, points: recoveredHp },
    activatedAtTick: currentTick
  });

  return { effect, attacks, snapshot };
}

async function a2eDruideChooseTransformation({ availableCategories, activeEffect }) {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.wait) {
    ui.notifications.error("Forme animale : DialogV2 est indisponible.");
    return null;
  }

  const grouped = ["reptile", "oiseau", "mammifere"].map(category => {
    if (!availableCategories.includes(category)) return "";
    const options = ADD2E_DRUIDE_ANIMAL_FORMS
      .filter(form => form.category === category)
      .map(form => `<option value="${a2eDruideEsc(form.key)}">${a2eDruideEsc(form.label)} — ${a2eDruideEsc(form.summary)}</option>`)
      .join("");
    return `<optgroup label="${a2eDruideEsc(a2eDruideCategoryLabel(category))}">${options}</optgroup>`;
  }).join("");

  const activeText = activeEffect
    ? `<div style="border:1px solid #8db586;border-radius:7px;background:#f3fff0;padding:7px;color:#24461e;"><b>Forme active :</b> ${a2eDruideEsc(activeEffect.name)}. Revenir à la forme normale ne rembourse aucune catégorie.</div>`
    : "";
  const unavailableText = availableCategories.length
    ? ""
    : `<div style="border:1px solid #caa16a;border-radius:7px;background:#fff7e9;padding:7px;color:#68400f;">Les trois catégories sont déjà utilisées pour ce jour ADD2E.</div>`;

  return DialogV2.wait({
    window: { title: "Forme animale du druide" },
    position: { width: 620 },
    classes: ["add2e", "add2e-capability-dialog", "add2e-druid-transformation-dialog"],
    content: `
      <form class="add2e-druid-transformation-form" style="font-family:var(--font-primary);display:grid;gap:8px;color:#24351f;">
        <div style="border:1px solid #7eaa72;border-radius:8px;background:linear-gradient(180deg,#f7fff3,#e5f3dd);padding:8px;">
          <div style="font-weight:900;color:#365c2e;">Forme animale</div>
          <div style="font-size:.9em;line-height:1.35;margin-top:3px;">Chaque catégorie ne peut être choisie qu'une fois par jour ADD2E. Les six formes proposées respectent les bornes du Manuel : grenouille/grand serpent, geai/aigle, chauve-souris/ours noir.</div>
        </div>
        ${activeText}
        ${unavailableText}
        ${availableCategories.length ? `
          <div class="form-group"><label style="font-weight:800;">Forme</label><select name="formKey" style="width:100%;">${grouped}</select></div>
          <div style="border:1px solid #b6cda9;border-radius:7px;background:#fbfff8;padding:7px;font-size:.9em;line-height:1.35;">La transformation lance automatiquement <b>1d6 × 10 %</b> des PV perdus avant le changement. Les caractéristiques de combat et l'image des tokens sont restaurées à la sortie de forme.</div>
        ` : ""}
      </form>`,
    buttons: [
      ...(availableCategories.length ? [{
        action: "transform",
        label: "Prendre la forme",
        icon: "fa-solid fa-paw",
        default: true,
        callback: (_event, button) => ({ action: "transform", formKey: String(button.form?.elements?.formKey?.value ?? "") })
      }] : []),
      ...(activeEffect ? [{
        action: "return",
        label: "Revenir à la forme normale",
        icon: "fa-solid fa-person",
        callback: () => ({ action: "return" })
      }] : []),
      { action: "cancel", label: "Annuler", icon: "fa-solid fa-xmark", callback: () => null }
    ],
    rejectClose: false
  });
}

async function a2eDruideCreateChat(actorDocument, title, body, img = ADD2E_FORM_ICON) {
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: actorDocument }),
    content: `
      <div class="add2e-chat-card" style="border:1px solid #668d55;border-radius:9px;overflow:hidden;background:#f5fff0;color:#203a1c;font-family:var(--font-primary);">
        <div style="display:flex;align-items:center;gap:8px;background:#3f6d35;color:#fff;padding:7px 9px;">
          <img src="${a2eDruideEsc(img)}" style="width:34px;height:34px;object-fit:cover;border-radius:5px;border:1px solid #cfe8c4;background:#fff;">
          <div style="font-weight:900;">${a2eDruideEsc(title)}</div>
        </div>
        <div style="padding:9px 10px;line-height:1.4;">${body}</div>
      </div>`,
    flags: { add2e: { capabilityTransformation: true, sourceCapacite: "forme_animale", version: ADD2E_DRUIDE_FORME_ANIMALE_VERSION } },
    ...a2eDruideChatStyleData()
  });
}

function a2eDruideInstallRestoreHook() {
  if (globalThis.__ADD2E_DRUIDE_TRANSFORMATION_RESTORE_HOOK_V3) return;
  globalThis.__ADD2E_DRUIDE_TRANSFORMATION_RESTORE_HOOK_V3 = true;

  Hooks.on("deleteActiveEffect", (effect, options = {}) => {
    if (options?.add2eDruideTransformationInternal) return;
    const transformation = effect?.flags?.add2e?.capabilityTransformation ?? {};
    if (transformation?.sourceKey !== ADD2E_TRANSFORMATION_SCOPE || transformation?.kind !== "form") return;
    const currentActor = effect?.parent?.documentName === "Actor" ? effect.parent : null;
    if (!currentActor) return;
    void a2eDruideRestoreTransformation(currentActor, {
      deleteEffects: false,
      reason: "capability-transformation-effect-removed"
    }).catch(error => console.error("[ADD2E][FORME_ANIMALE][RESTORE]", error));
  });
}

a2eDruideInstallRestoreHook();

globalThis.ADD2E_CAPABILITY_TRANSFORMATIONS.currentTick = a2eDruideCurrentTick;
globalThis.ADD2E_CAPABILITY_TRANSFORMATIONS.find = a2eDruideTransformationEffects;
globalThis.ADD2E_CAPABILITY_TRANSFORMATIONS.restore = a2eDruideRestoreTransformation;
globalThis.ADD2E_CAPABILITY_TRANSFORMATIONS.apply = a2eDruideApplyTransformation;
globalThis.ADD2E_CAPABILITY_TRANSFORMATIONS.forms = ADD2E_DRUIDE_ANIMAL_FORMS;

if (!actor) {
  ui.notifications.error("Forme animale : acteur introuvable.");
  return false;
}

const level = a2eDruideFeatureLevel(actor, feature);
if (level === null) {
  ui.notifications.error("Forme animale : niveau de Druide introuvable.");
  return false;
}
if (level < 7) {
  ui.notifications.warn("Forme animale indisponible avant le niveau 7.");
  return false;
}

const currentTick = a2eDruideCurrentTick();
if (currentTick === null) {
  ui.notifications.error("Forme animale : le compteur de temps ADD2E est indisponible.");
  return false;
}

const dayIndex = Math.floor(currentTick / ADD2E_DAY_ROUNDS);
const categories = ["reptile", "oiseau", "mammifere"];
const usage = a2eDruideUsageState(actor, dayIndex);
const availableCategories = categories.filter(category => usage.categories?.[category]?.used !== true);
const activeEffects = a2eDruideTransformationEffects(actor);
const choice = await a2eDruideChooseTransformation({ availableCategories, activeEffect: activeEffects[0] ?? null });
if (!choice) return false;

if (choice.action === "return") {
  const restored = await a2eDruideRestoreTransformation(actor, { reason: "capability-transformation-return" });
  if (!restored) {
    ui.notifications.warn("Aucune forme animale active à retirer.");
    return false;
  }
  await a2eDruideCreateChat(
    actor,
    "Forme animale",
    `<b>${a2eDruideEsc(actor.name)}</b> reprend sa forme normale.<br><small>Les catégories déjà utilisées restent dépensées pour ce jour ADD2E. Les caractéristiques de forme, attaques naturelles et images de token ont été restaurées.</small>`
  );
  ui.notifications.info("Retour à la forme normale.");
  return true;
}

const form = a2eDruideFormByKey(choice.formKey);
if (!form || !availableCategories.includes(form.category)) {
  ui.notifications.warn("Cette forme animale est indisponible aujourd’hui.");
  return false;
}

const { maximum: hpMaximum, current: hpCurrent } = a2eDruideHp(actor);
const lostHp = Number.isFinite(hpMaximum) && Number.isFinite(hpCurrent) ? Math.max(0, hpMaximum - hpCurrent) : 0;
const recoveryRoll = await (new Roll("1d6")).evaluate();
if (game.dice3d) await game.dice3d.showForRoll(recoveryRoll);
const recoveryDie = Math.max(1, Math.min(6, Number(recoveryRoll.total) || 1));
const recoveryPercent = recoveryDie * 10;
const recoveredHp = Math.min(lostHp, Math.ceil(lostHp * recoveryPercent / 100));

const applied = await a2eDruideApplyTransformation({
  currentActor: actor,
  form,
  currentTick,
  recoveredHp,
  recoveryPercent,
  recoveryRoll: recoveryDie
});

const nextCategories = {
  ...usage.categories,
  [form.category]: {
    used: true,
    usedAtTick: currentTick,
    formKey: form.key,
    formName: form.label,
    recoveryRoll: recoveryDie,
    recoveryPercent,
    recoveryPoints: recoveredHp
  }
};
await actor.setFlag("add2e", ADD2E_TRANSFORMATION_USAGE_FLAG, {
  ...usage.root,
  [ADD2E_TRANSFORMATION_SCOPE]: {
    version: ADD2E_DRUIDE_FORME_ANIMALE_VERSION,
    reset: { type: "add2e-day", rounds: ADD2E_DAY_ROUNDS },
    dayIndex,
    categories: nextCategories,
    updatedAtTick: currentTick
  }
});

const usedCount = categories.filter(entry => nextCategories?.[entry]?.used === true).length;
await a2eDruideCreateChat(
  actor,
  "Forme animale",
  `<b>${a2eDruideEsc(actor.name)}</b> prend la forme <b>${a2eDruideEsc(form.label)}</b> (${a2eDruideEsc(a2eDruideCategoryLabel(form.category))}).<br>
   <small>${a2eDruideEsc(form.summary)}</small><br>
   <b>Récupération :</b> 1d6 = ${recoveryDie} → ${recoveryPercent} % des ${lostHp} PV perdus, soit <b>${recoveredHp} PV</b> récupérés.<br>
   <b>Caractéristiques temporaires :</b> CA ${a2eDruideEsc(form.form["system.ca"])} ; TAC0 ${a2eDruideEsc(form.form["system.thac0"])} ; ${a2eDruideEsc(form.form["system.vitesse_deplacement"])}.<br>
   <b>Attaques naturelles :</b> ${a2eDruideEsc(form.attacks.map(attack => `${attack.label} ${attack.damage}`).join(" ; "))}.<br>
   <b>Catégories restantes ce jour ADD2E :</b> ${Math.max(0, categories.length - usedCount)} / ${categories.length}.`,
  form.img
);

if (!applied?.effect) ui.notifications.warn("La forme est active, mais l’effet de suivi doit être vérifié.");
else ui.notifications.info(`Forme animale active : ${form.label}.`);
return true;