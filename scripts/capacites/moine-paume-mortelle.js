/*
 * ADD2E — Moine : Paume mortelle / paume palpitante.
 * Script on_use d'une capacité de classe.
 *
 * Il ne contient pas de moteur d'attaque dédié : il décrit le profil canonique
 * consommé par ADD2E_CAPABILITY_SPECIAL_ATTACK.
 * Compatible Foundry V13/V14/V15 — DialogV2 uniquement.
 */
const ADD2E_MOINE_PAUME_MORTELLE_VERSION = "2026-07-09-deferred-contact-profile-lazy-engine-v1";
const ADD2E_PAUME_PROFILE_ID = "monk-quivering-palm";
const ADD2E_PAUME_MIN_LEVEL = 13;
const ADD2E_PAUME_TOUCH_WINDOW_ROUNDS = 3;
const ADD2E_PAUME_WEEK_ROUNDS = 7 * 24 * 60;
const ADD2E_PAUME_IMG = "icons/skills/melee/strike-palm-light-orange.webp";

globalThis.ADD2E_MOINE_PAUME_MORTELLE_VERSION = ADD2E_MOINE_PAUME_MORTELLE_VERSION;

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

function a2ePaumeChatStyleData() {
  if (CONST.CHAT_MESSAGE_STYLES) return { style: CONST.CHAT_MESSAGE_STYLES.OTHER };
  return { type: CONST.CHAT_MESSAGE_TYPES?.OTHER ?? 0 };
}

function a2ePaumeServiceReady(service = globalThis.add2eCapabilitySpecialAttack) {
  return !!(service?.prepareWindow && service?.findDeferredActions && service?.triggerDeferredAction && service?.currentTick);
}

async function a2ePaumeCapabilityService() {
  if (a2ePaumeServiceReady()) return globalThis.add2eCapabilitySpecialAttack;

  const systemId = String(game?.system?.id ?? "add2e");
  const prefix = String(globalThis.ROUTE_PREFIX ?? "").replace(/\/$/, "");
  const paths = [
    `${prefix}/systems/${systemId}/scripts/add2e/capability-special-attacks.mjs`,
    `/systems/${systemId}/scripts/add2e/capability-special-attacks.mjs`,
    `systems/${systemId}/scripts/add2e/capability-special-attacks.mjs`
  ].filter((value, index, list) => value && list.indexOf(value) === index);

  for (const path of paths) {
    try {
      await import(path);
      if (a2ePaumeServiceReady()) return globalThis.add2eCapabilitySpecialAttack;
    } catch (error) {
      console.warn("[ADD2E][MOINE][PAUME_MORTELLE][ENGINE_IMPORT_FAILED]", { path, error });
    }
  }

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
    kind: "contact_deferred",
    label: "Paume mortelle",
    img: ADD2E_PAUME_IMG,
    sourceLevel: level,
    dialogTitle: "Paume mortelle — contact",
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
      name: "Paume mortelle — fenêtre de contact",
      description: "Le moine doit établir le contact avant l’expiration de cette fenêtre.",
      endMessage: "La fenêtre de contact de la Paume mortelle de {actor} expire sans contact. La tentative hebdomadaire est perdue."
    },
    deferredEffect: {
      name: "Vibrations mortelles",
      img: ADD2E_PAUME_IMG,
      description: "Vibrations déclenchées par la Paume mortelle. Le moine doit prononcer son mot de commande avant l’expiration.",
      duration: { roundsPerSourceLevel: 24 * 60 },
      tags: ["classe:moine", "etat:vibrations_mortelles", "capability:deferred-action"],
      endMessage: "Les vibrations mortelles sur {actor} s’éteignent sans effet : le mot de commande n’a pas été prononcé à temps.",
      command: {
        label: "Paume mortelle — mot de commande",
        message: "Le mot de commande déclenche les vibrations mortelles.",
        action: {
          type: "set_hit_points",
          characterValue: -11,
          monsterValue: 0
        }
      }
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

async function a2ePaumeChat(actorDocument, profile, title, body, color = "#5d2e15") {
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: actorDocument }),
    content: `
      <div class="add2e-chat-card add2e-paume-mortelle-card" style="border:1px solid ${color};border-radius:9px;overflow:hidden;background:#fff8e7;color:#2f210d;font-family:var(--font-primary);">
        <div style="display:flex;align-items:center;gap:8px;background:${color};color:#fff;padding:7px 9px;">
          <img src="${a2ePaumeEsc(profile.img)}" style="width:34px;height:34px;object-fit:cover;border-radius:5px;border:1px solid rgba(255,255,255,.7);background:#fff;">
          <div><div style="font-weight:900;">${a2ePaumeEsc(title)}</div><div style="font-size:.82em;opacity:.92;">Capacité de moine</div></div>
        </div>
        <div style="padding:9px 10px;line-height:1.4;">${body}</div>
      </div>`,
    flags: { add2e: { sourceCapacite: "paume_mortelle", capabilityProfile: ADD2E_PAUME_PROFILE_ID, version: ADD2E_MOINE_PAUME_MORTELLE_VERSION } },
    ...a2ePaumeChatStyleData()
  });
}

async function a2ePaumeChooseDeferredCommand({ pending, service }) {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.wait) {
    ui.notifications.error("Paume mortelle : DialogV2 est indisponible.");
    return null;
  }

  const current = service.currentTick();
  const options = pending.map((entry, index) => {
    const expires = Number(entry?.data?.expiresAtTick ?? 0) || 0;
    const remaining = current === null || !expires ? "durée inconnue" : service.formatTicks(Math.max(0, expires - current));
    return `<option value="${index}">${a2ePaumeEsc(entry.actor?.name ?? "Cible")} — ${a2ePaumeEsc(remaining)}</option>`;
  }).join("");

  return DialogV2.wait({
    window: { title: "Paume mortelle — mot de commande" },
    position: { width: 465 },
    classes: ["add2e", "add2e-capability-dialog", "add2e-paume-command-dialog"],
    content: `
      <form style="font-family:var(--font-primary);display:grid;gap:8px;color:#322210;">
        <div style="border:1px solid #a46b2c;border-radius:8px;background:#fff5df;padding:8px;">
          <b>Vibrations mortelles actives</b><br>
          <small>Le mot de commande doit être prononcé avant l’expiration. Le Manuel ne prévoit pas de jet de protection pour cette résolution.</small>
        </div>
        <div class="form-group"><label style="font-weight:800;">Cible</label><select name="target" style="width:100%;">${options}</select></div>
        <div class="form-group"><label style="font-weight:800;">Mot de commande</label><input name="commandWord" type="text" maxlength="48" required placeholder="Prononcer le mot" style="width:100%;"></div>
      </form>`,
    buttons: [
      {
        action: "command",
        label: "Prononcer le mot",
        icon: "fa-solid fa-skull",
        default: true,
        callback: (_event, button) => ({
          targetIndex: Number(button.form?.elements?.target?.value ?? -1),
          commandWord: String(button.form?.elements?.commandWord?.value ?? "").trim()
        })
      },
      { action: "cancel", label: "Annuler", icon: "fa-solid fa-xmark", callback: () => null }
    ],
    rejectClose: false
  });
}

if (!actor) {
  ui.notifications.error("Paume mortelle : acteur introuvable.");
  return false;
}

const level = a2ePaumeFeatureLevel(actor, feature);
if (level === null) {
  ui.notifications.error("Paume mortelle : niveau de Moine introuvable.");
  return false;
}
if (level < ADD2E_PAUME_MIN_LEVEL) {
  ui.notifications.warn(`Paume mortelle indisponible avant le niveau ${ADD2E_PAUME_MIN_LEVEL} de Moine.`);
  return false;
}

const service = await a2ePaumeCapabilityService();
if (!a2ePaumeServiceReady(service)) {
  ui.notifications.error("Paume mortelle : le moteur générique des contacts différés n’est pas disponible. Voir la console pour l’erreur d’import.");
  return false;
}

const profile = a2ePaumeProfile(level);
const pending = service.findDeferredActions({ sourceActor: actor, profileId: profile.id });
if (pending.length) {
  const command = await a2ePaumeChooseDeferredCommand({ pending, service });
  if (!command) return false;
  if (!command.commandWord) {
    ui.notifications.warn("Paume mortelle : le mot de commande est obligatoire.");
    return false;
  }
  const selected = pending[command.targetIndex];
  if (!selected) {
    ui.notifications.warn("Paume mortelle : cible des vibrations introuvable.");
    return false;
  }
  const resolved = await service.triggerDeferredAction({ sourceActor: actor, targetActor: selected.actor, effect: selected.effect });
  return resolved !== false;
}

const currentTick = service.currentTick();
if (currentTick === null) {
  ui.notifications.error("Paume mortelle : le compteur de temps ADD2E est indisponible.");
  return false;
}

const cooldown = a2ePaumeCooldownState(actor);
const nextAvailableTick = Number(cooldown.entry?.nextAvailableTick ?? 0) || 0;
if (nextAvailableTick > currentTick) {
  ui.notifications.warn(`Paume mortelle déjà utilisée. Prochaine utilisation dans ${service.formatTicks(nextAvailableTick - currentTick)}.`);
  return false;
}

const oldItem = a2ePaumeTemporaryItem(actor);
if (oldItem) {
  const window = a2ePaumeWindow(actor, oldItem.id);
  if (window) {
    const expiry = Number(window.flags?.add2e?.capabilitySpecialAttackWindow?.expiresAtTick ?? 0) || 0;
    const remaining = expiry > currentTick ? service.formatTicks(expiry - currentTick) : "moins d’un round";
    ui.notifications.warn(`Paume mortelle déjà préparée. Contact à établir dans ${remaining}.`);
    return false;
  }
  await actor.deleteEmbeddedDocuments("Item", [oldItem.id], { add2eInternal: true, add2eReason: "capability-special-attack-stale-item" });
}

const DialogV2 = foundry?.applications?.api?.DialogV2;
if (!DialogV2?.wait) {
  ui.notifications.error("Paume mortelle : DialogV2 est indisponible.");
  return false;
}

const confirmation = await DialogV2.wait({
  window: { title: "Préparer la Paume mortelle" },
  position: { width: 495 },
  classes: ["add2e", "add2e-capability-dialog", "add2e-paume-prepare-dialog"],
  content: `
    <form style="font-family:var(--font-primary);display:grid;gap:8px;color:#322210;">
      <div style="border:1px solid #a46b2c;border-radius:8px;background:#fff5df;padding:8px;">
        <div style="font-weight:900;color:#6a3c13;">Paume mortelle</div>
        <div style="font-size:.9em;line-height:1.35;margin-top:3px;">Une utilisation par semaine ADD2E. Le moine doit toucher une cible valide dans les <b>${ADD2E_PAUME_TOUCH_WINDOW_ROUNDS} rounds</b> ; sinon la tentative hebdomadaire est perdue.</div>
      </div>
      <div style="border:1px solid #d4b777;border-radius:7px;background:#fffdf3;padding:7px;font-size:.9em;line-height:1.35;">
        Le contact ne cause <b>aucun dégât ordinaire</b>. Les morts-vivants, les créatures touchables uniquement par des armes magiques, les cibles de plus de ${level} DV ou ayant plus de <b>2 × les PV maximum du moine</b> sont exclus. Après un contact valide, le mot de commande doit être prononcé dans <b>${level} jour(s) ADD2E</b>.
      </div>
    </form>`,
  buttons: [
    { action: "prepare", label: "Préparer", icon: "fa-solid fa-hand", default: true, callback: () => true },
    { action: "cancel", label: "Annuler", icon: "fa-solid fa-xmark", callback: () => false }
  ],
  rejectClose: false
});
if (confirmation !== true) return false;

const itemSystem = {
  nom: "Paume mortelle",
  degats: "0",
  "dégâts": { contre_moyen: "0", contre_grand: "0" },
  type_degats: "sans_dégât_ordinaires",
  type_arme: "main_nue",
  famille_arme: "main_nue",
  proprietes: "Corps à corps, contact spécial, Moine, temporaire",
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
    "combat:arme_temporaire",
    "capability:special-attack"
  ],
  effectTags: ["classe:moine", "combat:arme_temporaire", "capability:special-attack"],
  add2eAutoCreated: true,
  sourceClasse: "moine",
  sourceCapacite: "paume_mortelle",
  niveauMoine: level,
  description: "Tentative de contact créée par la Paume mortelle. Le moteur d’attaque spécial ne lance aucun dégât ordinaire ; il pose un effet différé lorsque le contact et les restrictions canoniques sont validés."
};

const created = await actor.createEmbeddedDocuments("Item", [{
  type: "arme",
  name: "Paume mortelle",
  img: ADD2E_PAUME_IMG,
  system: itemSystem,
  flags: {
    add2e: {
      tags: ["classe:moine", "combat:arme_temporaire", "capability:special-attack"],
      sourceClasse: "moine",
      sourceCapacite: "paume_mortelle",
      sourceLevel: level,
      capabilitySpecialAttack: profile,
      temporary: true,
      createdAtTick: currentTick
    }
  }
}], { add2eInternal: true, add2eReason: "capability-special-attack-prepare" });

const contactItem = created?.[0] ?? null;
if (!contactItem) {
  ui.notifications.error("Paume mortelle : création de la tentative de contact impossible.");
  return false;
}

const window = await service.prepareWindow({
  actor,
  item: contactItem,
  profile,
  rounds: ADD2E_PAUME_TOUCH_WINDOW_ROUNDS
});
if (!window) {
  await actor.deleteEmbeddedDocuments("Item", [contactItem.id], { add2eInternal: true, add2eReason: "capability-special-attack-window-failed" });
  ui.notifications.error("Paume mortelle : création de la fenêtre de contact impossible.");
  return false;
}

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

await a2ePaumeChat(
  actor,
  profile,
  "Paume mortelle préparée",
  `<b>${a2ePaumeEsc(actor.name)}</b> prépare une tentative de contact.<br>
   <b>Fenêtre de contact :</b> ${ADD2E_PAUME_TOUCH_WINDOW_ROUNDS} rounds ADD2E. Aucun dégât ordinaire ne sera lancé.<br>
   <b>Après un contact valide :</b> les vibrations durent ${level} jour(s) ADD2E avant de s’éteindre si aucun mot de commande n’est prononcé.<br>
   <b>Prochaine préparation :</b> dans ${a2ePaumeEsc(service.formatTicks(ADD2E_PAUME_WEEK_ROUNDS))}.`
);

ui.notifications.info(`Paume mortelle prête : établis le contact dans ${ADD2E_PAUME_TOUCH_WINDOW_ROUNDS} rounds ADD2E.`);
return true;
