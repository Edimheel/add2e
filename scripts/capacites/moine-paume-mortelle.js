/*
 * ADD2E — Moine : Paume mortelle / paume palpitante.
 * Script on_use d'une capacité de classe.
 *
 * La capacité prépare une frappe de Paume mortelle. Son utilisation depuis la
 * feuille ou le HUD résout immédiatement la capacité.
 * Compatible Foundry V13/V14/V15 — DialogV2 uniquement.
 */
const ADD2E_MOINE_PAUME_MORTELLE_VERSION = "2026-07-10-capacity-style-v1";
const ADD2E_PAUME_PROFILE_ID = "monk-quivering-palm";
const ADD2E_PAUME_MIN_LEVEL = 13;
const ADD2E_PAUME_TOUCH_WINDOW_ROUNDS = 3;
const ADD2E_PAUME_WEEK_ROUNDS = 7 * 24 * 60;
const ADD2E_PAUME_IMG = "systems/add2e/assets/icones/capacites/paume-mortelle.webp";

const ADD2E_PAUME_COLOR = "#5d2e15";
const ADD2E_PAUME_GOLD = "#b7863b";
const ADD2E_PAUME_BG = "#fff8e7";
const ADD2E_PAUME_SOFT = "#fff1cf";

globalThis.ADD2E_MOINE_PAUME_MORTELLE_VERSION = ADD2E_MOINE_PAUME_MORTELLE_VERSION;

function a2ePaumeLog(step, data = {}) {
  try {
    console.info(`[ADD2E][MOINE][PAUME_MORTELLE][${step}]`, {
      version: ADD2E_MOINE_PAUME_MORTELLE_VERSION,
      ...data
    });
  } catch (_error) {}
}

function a2ePaumeNorm(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function a2ePaumeEsc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function a2ePaumeClone(value) {
  if (value === undefined || value === null) return value;
  try { return foundry.utils.deepClone(value); }
  catch (_error) {
    try { return JSON.parse(JSON.stringify(value)); }
    catch (_jsonError) { return value; }
  }
}

function a2ePaumeChatStyleData() {
  if (CONST.CHAT_MESSAGE_STYLES) return { style: CONST.CHAT_MESSAGE_STYLES.OTHER };
  return { type: CONST.CHAT_MESSAGE_TYPES?.OTHER ?? 0 };
}

function a2ePaumeServiceReady(service = globalThis.add2eCapabilitySpecialAttack) {
  return !!(service?.prepareWindow && service?.currentTick && service?.formatTicks);
}

async function a2ePaumeCapabilityService() {
  if (a2ePaumeServiceReady()) {
    a2ePaumeLog("ENGINE_READY", { source: "global", engineVersion: globalThis.add2eCapabilitySpecialAttack?.version ?? null });
    return globalThis.add2eCapabilitySpecialAttack;
  }

  const systemId = String(game?.system?.id ?? "add2e");
  const prefix = String(globalThis.ROUTE_PREFIX ?? "").replace(/\/$/, "");
  const paths = [
    `${prefix}/systems/${systemId}/scripts/add2e/capability-special-attacks.mjs`,
    `/systems/${systemId}/scripts/add2e/capability-special-attacks.mjs`,
    `systems/${systemId}/scripts/add2e/capability-special-attacks.mjs`
  ].filter((value, index, list) => value && list.indexOf(value) === index);

  for (const path of paths) {
    try {
      a2ePaumeLog("ENGINE_IMPORT_TRY", { path });
      await import(path);
      if (a2ePaumeServiceReady()) {
        a2ePaumeLog("ENGINE_READY", { source: path, engineVersion: globalThis.add2eCapabilitySpecialAttack?.version ?? null });
        return globalThis.add2eCapabilitySpecialAttack;
      }
    } catch (error) {
      console.warn("[ADD2E][MOINE][PAUME_MORTELLE][ENGINE_IMPORT_FAILED]", { path, error });
    }
  }

  a2ePaumeLog("ENGINE_MISSING", { hasGlobal: !!globalThis.add2eCapabilitySpecialAttack });
  return globalThis.add2eCapabilitySpecialAttack ?? null;
}

function a2ePaumeFeatureLevel(currentActor, currentFeature) {
  const level = Number(
    globalThis.add2eFeatureActorLevel?.(currentActor, currentFeature)
    ?? currentFeature?._add2eClassLevel
  );
  return Number.isFinite(level) && level >= 1 ? Math.floor(level) : null;
}

function a2ePaumeProfile(level) {
  return {
    version: ADD2E_MOINE_PAUME_MORTELLE_VERSION,
    id: ADD2E_PAUME_PROFILE_ID,
    kind: "contact_immediate",
    label: "Paume mortelle",
    img: ADD2E_PAUME_IMG,
    sourceLevel: level,
    dialogTitle: "Paume mortelle",
    resolution: { mode: "immediate" },
    attack: {
      abilityModifier: false,
      magicWeaponBonus: false,
      effectModifiers: true,
      racialVs: true
    },
    targetRestrictions: {
      excludedTags: [
        "mort_vivant",
        "undead",
        "creature_mort_vivant",
        "monstre_mort_vivant",
        "type_monstre_mort_vivant",
        "immunise_aux_attaques_non_magiques",
        "immunise_aux_armes_non_magiques",
        "immunite_aux_attaques_non_magiques",
        "immunite_aux_armes_non_magiques",
        "touche_uniquement_par_des_armes_magiques",
        "touche_seulement_par_des_armes_magiques",
        "atteint_uniquement_par_des_armes_magiques",
        "blessable_uniquement_par_des_armes_magiques",
        "ne_peut_etre_blesse_que_par_des_armes_magiques",
        "arme_magique_requise",
        "armes_magiques_requises",
        "requires_magic_weapon",
        "requires_magical_weapon"
      ],
      maxHitDice: { multiplier: 1 },
      maxHitPoints: { multiplier: 2 }
    },
    window: {
      name: "Paume mortelle — préparée",
      description: "Le moine doit porter sa Paume mortelle avant l’expiration de cette préparation.",
      endMessage: "La Paume mortelle préparée par {actor} se dissipe. La tentative hebdomadaire est perdue."
    },
    immediateAction: {
      type: "set_hit_points",
      characterValue: -11,
      monsterValue: 0,
      label: "Paume mortelle",
      message: "La cible s’effondre sous l’effet de la Paume mortelle."
    }
  };
}

function a2ePaumeCooldownState(currentActor) {
  const root = currentActor.getFlag("add2e", "capabilityCooldowns") ?? {};
  const entry = root?.[ADD2E_PAUME_PROFILE_ID] ?? {};
  return { root: root && typeof root === "object" ? root : {}, entry: entry && typeof entry === "object" ? entry : {} };
}

function a2ePaumeIsTemporaryItem(item) {
  const flags = item?.flags?.add2e ?? {};
  const profile = flags?.capabilitySpecialAttack ?? item?.system?.capabilitySpecialAttack ?? {};
  return a2ePaumeNorm(profile?.id) === ADD2E_PAUME_PROFILE_ID
    || a2ePaumeNorm(flags?.sourceCapacite) === "paume_mortelle"
    || a2ePaumeNorm(item?.system?.sourceCapacite) === "paume_mortelle";
}

function a2ePaumeTemporaryItem(currentActor) {
  return Array.from(currentActor?.items ?? []).find(a2ePaumeIsTemporaryItem) ?? null;
}

function a2ePaumeWindow(currentActor, itemId) {
  return Array.from(currentActor?.effects ?? []).find(effect =>
    effect?.flags?.add2e?.capabilitySpecialAttackWindow?.itemId === itemId
  ) ?? null;
}

async function a2ePaumeDeleteItemIfPresent(currentActor, itemId, reason) {
  if (!currentActor || !itemId || !currentActor.items?.get?.(itemId)) return false;
  try {
    await currentActor.deleteEmbeddedDocuments("Item", [itemId], { add2eInternal: true, add2eReason: reason });
    return true;
  } catch (error) {
    const message = String(error?.message ?? error ?? "");
    if (/does not exist|introuvable/i.test(message)) return false;
    console.warn("[ADD2E][MOINE][PAUME_MORTELLE][DELETE_TEMP_ITEM_FAILED]", { actor: currentActor?.name, itemId, reason, error });
    return false;
  }
}

function a2ePaumeFeatureMatches(entry) {
  const key = a2ePaumeNorm(`${entry?.name ?? entry?.label ?? entry?.title ?? entry?.nom ?? ""} ${entry?.on_use ?? entry?.onUse ?? entry?.script ?? ""}`);
  return key.includes("paume_mortelle") || key.includes("paume_palpitante") || key.includes("moine_paume_mortelle");
}

async function a2ePaumeEnsureClassFeatureImage(currentActor, currentFeature = null) {
  if (currentFeature && typeof currentFeature === "object") currentFeature.img = ADD2E_PAUME_IMG;
  const paths = ["classFeatures", "activeClassFeatures", "activableClassFeatures", "classFeaturesActives", "capacitesActives", "capacitesActivables", "capacitesClasse"];
  for (const classItem of Array.from(currentActor?.items ?? []).filter(item => String(item?.type ?? "").toLowerCase() === "classe")) {
    const updates = {};
    for (const path of paths) {
      const list = classItem.system?.[path];
      if (!Array.isArray(list)) continue;
      let changed = false;
      const copy = a2ePaumeClone(list).map(entry => {
        if (!entry || typeof entry !== "object" || !a2ePaumeFeatureMatches(entry)) return entry;
        if (entry.img === ADD2E_PAUME_IMG) return entry;
        changed = true;
        return { ...entry, img: ADD2E_PAUME_IMG };
      });
      if (changed) updates[`system.${path}`] = copy;
    }
    if (Object.keys(updates).length) {
      try {
        await classItem.update(updates, { add2eInternal: true, add2eReason: "paume-mortelle-feature-image" });
        a2ePaumeLog("FEATURE_IMAGE_UPDATED", { actor: currentActor?.name, classItem: classItem.name, paths: Object.keys(updates) });
      } catch (error) {
        console.warn("[ADD2E][MOINE][PAUME_MORTELLE][FEATURE_IMAGE_FAILED]", { actor: currentActor?.name, classItem: classItem.name, error });
      }
    }
  }
}

function a2ePaumeCardHtml({ title, subtitle = "Capacité de classe", body = "", footer = "", img = ADD2E_PAUME_IMG } = {}) {
  return `
    <div class="add2e-chat-card add2e-card-capacite add2e-paume-mortelle-card" style="border:2px solid ${ADD2E_PAUME_COLOR};border-radius:12px;overflow:hidden;background:${ADD2E_PAUME_BG};color:#2f210d;font-family:var(--font-primary);box-shadow:0 0 0 1px rgba(80,45,20,.18);">
      <div style="display:flex;align-items:center;gap:10px;background:linear-gradient(90deg,${ADD2E_PAUME_COLOR},#8a4d1d);color:#fff;padding:9px 10px;">
        <img src="${a2ePaumeEsc(img)}" style="width:42px;height:42px;object-fit:cover;border-radius:8px;border:1px solid rgba(255,255,255,.72);background:#fff;">
        <div style="min-width:0;">
          <div style="font-weight:900;font-size:1.08em;letter-spacing:.01em;">${a2ePaumeEsc(title)}</div>
          <div style="font-size:.82em;opacity:.94;">${a2ePaumeEsc(subtitle)}</div>
        </div>
      </div>
      <div style="padding:10px 11px;line-height:1.42;display:grid;gap:8px;">${body}</div>
      ${footer ? `<div style="padding:7px 11px;border-top:1px solid rgba(93,46,21,.25);background:${ADD2E_PAUME_SOFT};font-size:.88em;line-height:1.35;">${footer}</div>` : ""}
    </div>`;
}

async function a2ePaumeChat(actorDocument, profile, title, body, color = ADD2E_PAUME_COLOR) {
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: actorDocument }),
    content: a2ePaumeCardHtml({ title, subtitle: "Capacité de moine", body, img: profile?.img ?? ADD2E_PAUME_IMG }),
    flags: { add2e: { sourceCapacite: "paume_mortelle", capabilityProfile: ADD2E_PAUME_PROFILE_ID, version: ADD2E_MOINE_PAUME_MORTELLE_VERSION } },
    ...a2ePaumeChatStyleData()
  });
}

if (!actor) {
  ui.notifications.error("Paume mortelle : acteur introuvable.");
  return false;
}

a2ePaumeLog("ENTER", { actor: actor.name, actorId: actor.id, feature: feature?.name, featureId: feature?.id });
await a2ePaumeEnsureClassFeatureImage(actor, feature);

const level = a2ePaumeFeatureLevel(actor, feature);
if (level === null) {
  ui.notifications.error("Paume mortelle : niveau de Moine introuvable.");
  a2ePaumeLog("NO_LEVEL", { actor: actor.name, feature: feature?.name });
  return false;
}
if (level < ADD2E_PAUME_MIN_LEVEL) {
  ui.notifications.warn(`Paume mortelle indisponible avant le niveau ${ADD2E_PAUME_MIN_LEVEL} de Moine.`);
  a2ePaumeLog("LEVEL_TOO_LOW", { actor: actor.name, level });
  return false;
}

const service = await a2ePaumeCapabilityService();
if (!a2ePaumeServiceReady(service)) {
  ui.notifications.error("Paume mortelle : la préparation n’est pas disponible. Préviens le MJ.");
  a2ePaumeLog("ENGINE_UNAVAILABLE", { actor: actor.name });
  return false;
}

const profile = a2ePaumeProfile(level);
const currentTick = service.currentTick();
if (currentTick === null) {
  ui.notifications.error("Paume mortelle : le suivi des rounds n’est pas disponible.");
  a2ePaumeLog("NO_TIME_ENGINE", { actor: actor.name });
  return false;
}

const cooldown = a2ePaumeCooldownState(actor);
const nextAvailableTick = Number(cooldown.entry?.nextAvailableTick ?? 0) || 0;
a2ePaumeLog("COOLDOWN", { actor: actor.name, currentTick, nextAvailableTick, remaining: Math.max(0, nextAvailableTick - currentTick) });
if (nextAvailableTick > currentTick) {
  ui.notifications.warn(`Paume mortelle déjà utilisée. Prochaine tentative dans ${service.formatTicks(nextAvailableTick - currentTick)}.`);
  return false;
}

const oldItem = a2ePaumeTemporaryItem(actor);
if (oldItem) {
  const window = a2ePaumeWindow(actor, oldItem.id);
  a2ePaumeLog("OLD_TEMP_ITEM", { actor: actor.name, item: oldItem.name, itemId: oldItem.id, hasWindow: !!window });
  if (window) {
    const expiry = Number(window.flags?.add2e?.capabilitySpecialAttackWindow?.expiresAtTick ?? 0) || 0;
    const remaining = expiry > currentTick ? service.formatTicks(expiry - currentTick) : "moins d’un round";
    ui.notifications.warn(`Paume mortelle déjà préparée. Porte la frappe dans ${remaining}.`);
    return false;
  }
  await a2ePaumeDeleteItemIfPresent(actor, oldItem.id, "capability-special-attack-stale-item");
}

const DialogV2 = foundry?.applications?.api?.DialogV2;
if (!DialogV2?.wait) {
  ui.notifications.error("Paume mortelle : DialogV2 est indisponible.");
  return false;
}

const confirmation = await DialogV2.wait({
  window: { title: "Préparer la Paume mortelle" },
  position: { width: 500 },
  classes: ["add2e", "add2e-capability-dialog", "add2e-paume-prepare-dialog"],
  content: `
    <form style="font-family:var(--font-primary);color:#322210;">
      ${a2ePaumeCardHtml({
        title: "Paume mortelle",
        subtitle: "Capacité de moine",
        body: `
          <div style="border:1px solid ${ADD2E_PAUME_GOLD};border-radius:8px;background:#fffdf3;padding:8px;">
            <b>${a2ePaumeEsc(actor.name)}</b> concentre son énergie dans une paume capable d’abattre une cible vivante.
          </div>
          <div style="display:grid;gap:5px;font-size:.94em;">
            <div><b>Délai :</b> la frappe doit être portée dans les <b>${ADD2E_PAUME_TOUCH_WINDOW_ROUNDS} rounds</b>.</div>
            <div><b>Usage :</b> une tentative par semaine.</div>
            <div><b>Résolution :</b> si le contact réussit contre une cible valable, la Paume mortelle prend effet immédiatement.</div>
          </div>`,
        footer: "Aucun dégât ordinaire n’est lancé pour cette capacité.",
        img: ADD2E_PAUME_IMG
      })}
    </form>`,
  buttons: [
    { action: "prepare", label: "Préparer", icon: "fa-solid fa-hand", default: true, callback: () => true },
    { action: "cancel", label: "Annuler", icon: "fa-solid fa-xmark", callback: () => false }
  ],
  rejectClose: false
});
if (confirmation !== true) {
  a2ePaumeLog("PREPARE_CANCELLED", { actor: actor.name });
  return false;
}

const itemSystem = {
  nom: "Paume mortelle",
  degats: "0",
  "dégâts": { contre_moyen: "0", contre_grand: "0" },
  type_degats: "sans_dégât_ordinaires",
  type_arme: "main_nue",
  famille_arme: "main_nue",
  proprietes: "Corps à corps, Moine, capacité préparée",
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
    "arme:contact_special",
    "usage:corps_a_corps",
    "attaque:contact",
    "type_arme:main_nue",
    "classe:moine",
    "capability:special-attack"
  ],
  effectTags: ["classe:moine", "capability:special-attack"],
  add2eAutoCreated: true,
  sourceCapacite: "paume_mortelle",
  sourceClasse: "moine",
  niveauMoine: level,
  description: "Frappe préparée par la Paume mortelle. Elle ne cause aucun dégât ordinaire ; si le contact réussit contre une cible valable, la capacité prend effet immédiatement."
};

a2ePaumeLog("CREATE_TEMP_ITEM_START", { actor: actor.name, level, img: ADD2E_PAUME_IMG });
const created = await actor.createEmbeddedDocuments("Item", [{
  type: "arme",
  name: "Paume mortelle",
  img: ADD2E_PAUME_IMG,
  system: itemSystem,
  flags: {
    add2e: {
      tags: ["classe:moine", "capability:special-attack"],
      sourceCapacite: "paume_mortelle",
      sourceClasse: "moine",
      sourceLevel: level,
      capabilitySpecialAttack: profile,
      capabilityTemporary: true,
      createdAtTick: currentTick
    }
  }
}], { add2eInternal: true, add2eReason: "capability-special-attack-prepare" });

const contactItem = created?.[0] ?? null;
if (!contactItem) {
  ui.notifications.error("Paume mortelle : préparation impossible.");
  a2ePaumeLog("CREATE_TEMP_ITEM_FAILED", { actor: actor.name });
  return false;
}
a2ePaumeLog("CREATE_TEMP_ITEM_DONE", { actor: actor.name, item: contactItem.name, itemId: contactItem.id, itemUuid: contactItem.uuid });

const window = await service.prepareWindow({
  actor,
  item: contactItem,
  profile,
  rounds: ADD2E_PAUME_TOUCH_WINDOW_ROUNDS
});
if (!window) {
  await a2ePaumeDeleteItemIfPresent(actor, contactItem.id, "capability-special-attack-window-failed");
  ui.notifications.error("Paume mortelle : préparation impossible.");
  a2ePaumeLog("WINDOW_FAILED", { actor: actor.name, itemId: contactItem.id });
  return false;
}
a2ePaumeLog("WINDOW_DONE", { actor: actor.name, itemId: contactItem.id, window: window.name, windowId: window.id });

const nextTick = currentTick + ADD2E_PAUME_WEEK_ROUNDS;
await actor.setFlag("add2e", "capabilityCooldowns", {
  ...cooldown.root,
  [ADD2E_PAUME_PROFILE_ID]: {
    version: ADD2E_MOINE_PAUME_MORTELLE_VERSION,
    profileId: ADD2E_PAUME_PROFILE_ID,
    usedAtTick: currentTick,
    nextAvailableTick: nextTick,
    reset: { type: "add2e-rounds", rounds: ADD2E_PAUME_WEEK_ROUNDS }
  }
});
a2ePaumeLog("COOLDOWN_SET", { actor: actor.name, currentTick, nextTick });

await a2ePaumeChat(
  actor,
  profile,
  "Paume mortelle préparée",
  `<div><b>${a2ePaumeEsc(actor.name)}</b> concentre son énergie dans une Paume mortelle.</div>
   <div><b>Délai :</b> la frappe doit être portée dans les <b>${ADD2E_PAUME_TOUCH_WINDOW_ROUNDS} rounds</b>.</div>
   <div><b>Effet :</b> si le contact réussit contre une cible valable, la capacité prend effet immédiatement.</div>
   <div><b>Nouvelle tentative :</b> dans ${a2ePaumeEsc(service.formatTicks(ADD2E_PAUME_WEEK_ROUNDS))}.</div>`
);

ui.notifications.info(`Paume mortelle prête : porte la frappe dans les ${ADD2E_PAUME_TOUCH_WINDOW_ROUNDS} rounds.`);
return true;
