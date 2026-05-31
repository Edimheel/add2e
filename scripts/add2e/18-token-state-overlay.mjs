// ADD2E — Icônes d'état façon DnD5e pour Mort et Inconscient
// Version : 2026-05-31-dnd5e-style-status-icons-preserve-tracker-defeated-v3
//
// Principe repris du système DnD5e :
// - Inconscient est un état/condition avec sa propre icône.
// - Mort est un statut séparé avec le special DEFEATED.
// - Les icônes sont gérées par CONFIG.statusEffects et actor.toggleStatusEffect.
// - Pas d'overlay PIXI plein token, pas d'accès déprécié TokenDocument#effects / overlayEffect.
// - La synchronisation PV ne supprime jamais un état vaincu posé manuellement depuis le tracker.

const ADD2E_TOKEN_STATE_OVERLAY_VERSION = "2026-05-31-dnd5e-style-status-icons-preserve-tracker-defeated-v3";
globalThis.ADD2E_TOKEN_STATE_OVERLAY_VERSION = ADD2E_TOKEN_STATE_OVERLAY_VERSION;

globalThis.ADD2E_TOKEN_STATUS_ICON_VERSION = ADD2E_TOKEN_STATE_OVERLAY_VERSION;

const ADD2E_STATUS_EFFECTS = {
  dead: {
    id: "dead",
    name: "Mort",
    img: "icons/svg/skull.svg",
    icon: "icons/svg/skull.svg",
    special: "DEFEATED",
    order: 1,
    neverBlockMovement: true,
    flags: { add2e: { hpState: "dead", hpManaged: true } }
  },
  unconscious: {
    id: "unconscious",
    name: "Inconscient",
    img: "icons/svg/unconscious.svg",
    icon: "icons/svg/unconscious.svg",
    statuses: ["incapacitated"],
    riders: ["prone"],
    flags: { add2e: { hpState: "unconscious", hpManaged: true } }
  }
};

function add2eNormalizeStatusId(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function add2eStatusAliases(effect) {
  return [
    effect?.id,
    effect?._id,
    effect?.name,
    effect?.flags?.core?.statusId,
    effect?.flags?.add2e?.hpState
  ].map(add2eNormalizeStatusId).filter(Boolean);
}

function add2eStatusConfigIndex(statuses, id) {
  const wanted = add2eNormalizeStatusId(id);
  return statuses.findIndex(effect => add2eStatusAliases(effect).includes(wanted));
}

function add2eMergeStatusConfig(base, patch) {
  return foundry.utils.mergeObject(
    foundry.utils.deepClone(base ?? {}),
    foundry.utils.deepClone(patch ?? {}),
    { inplace: false, insertKeys: true, overwrite: true }
  );
}

function add2eRegisterStatusEffect(effect) {
  if (!effect?.id) return false;

  const statuses = Array.isArray(CONFIG.statusEffects) ? CONFIG.statusEffects : [];
  const index = add2eStatusConfigIndex(statuses, effect.id);

  if (index >= 0) statuses[index] = add2eMergeStatusConfig(statuses[index], effect);
  else statuses.push(foundry.utils.deepClone(effect));

  CONFIG.statusEffects = statuses;
  return true;
}

function add2eRegisterHpStatusEffects() {
  add2eRegisterStatusEffect(ADD2E_STATUS_EFFECTS.dead);
  add2eRegisterStatusEffect(ADD2E_STATUS_EFFECTS.unconscious);
}

function add2eReadNumber(...values) {
  for (const value of values) {
    if (value === undefined || value === null || value === "") continue;
    if (typeof value === "object") {
      const n = add2eReadNumber(value.value, value.current, value.actuel, value.total);
      if (Number.isFinite(n)) return n;
      continue;
    }
    const n = Number(String(value).replace(",", "."));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function add2eActorCurrentHp(actor) {
  const s = actor?.system ?? {};
  return add2eReadNumber(
    s.pdv,
    s.pv,
    s.pv_courant,
    s.pvCourant,
    s.points_de_vie,
    s.points_de_vie_courants,
    s.points_de_coup_courants,
    s.hp?.value,
    s.hp?.current,
    s.attributes?.hp?.value
  );
}

function add2eActorHpState(actor) {
  if (!actor) return null;
  const hp = add2eActorCurrentHp(actor);
  if (!Number.isFinite(hp)) return null;
  if (hp <= -11) return "dead";
  if (hp <= 0) return "unconscious";
  return null;
}

function add2eEffectHasStatus(effect, statusId) {
  const wanted = add2eNormalizeStatusId(statusId);
  if (effect?.disabled) return false;
  if (effect?.statuses instanceof Set && effect.statuses.has(statusId)) return true;
  if (Array.isArray(effect?.statuses) && effect.statuses.includes(statusId)) return true;
  return add2eStatusAliases(effect).includes(wanted);
}

function add2eHasStatus(actor, statusId) {
  for (const effect of actor?.effects ?? []) {
    if (add2eEffectHasStatus(effect, statusId)) return true;
  }
  return false;
}

function add2eIsHpManagedStatusEffect(effect, statusId = null) {
  if (!effect || effect.disabled) return false;
  const hpState = add2eNormalizeStatusId(effect?.flags?.add2e?.hpState);
  const hpManaged = effect?.flags?.add2e?.hpManaged === true || Boolean(hpState);
  if (!hpManaged) return false;
  if (!statusId) return true;
  return hpState === add2eNormalizeStatusId(statusId) || add2eEffectHasStatus(effect, statusId);
}

function add2eHasManualStatus(actor, statusId) {
  for (const effect of actor?.effects ?? []) {
    if (!add2eEffectHasStatus(effect, statusId)) continue;
    if (!add2eIsHpManagedStatusEffect(effect, statusId)) return true;
  }
  return false;
}

function add2eActorMatchesCombatant(actor, combatant) {
  if (!actor || !combatant) return false;
  const combatantActor = combatant.actor ?? combatant.token?.actor ?? combatant.token?.object?.actor ?? null;
  return Boolean(
    combatantActor?.id === actor.id ||
    combatant.actorId === actor.id ||
    combatantActor?.uuid === actor.uuid
  );
}

function add2eActorIsDefeatedInTracker(actor) {
  if (!actor) return false;
  const combats = Array.from(game.combats ?? []);
  if (game.combat && !combats.includes(game.combat)) combats.push(game.combat);

  for (const combat of combats) {
    for (const combatant of combat?.combatants ?? []) {
      if (!add2eActorMatchesCombatant(actor, combatant)) continue;
      if (combatant.defeated === true || combatant.flags?.core?.defeated === true) return true;
    }
  }
  return false;
}

async function add2eRemoveHpManagedStatus(actor, statusId) {
  if (!actor) return 0;
  const ids = [];
  for (const effect of actor.effects ?? []) {
    if (add2eIsHpManagedStatusEffect(effect, statusId)) ids.push(effect.id);
  }
  if (!ids.length) return 0;
  await actor.deleteEmbeddedDocuments("ActiveEffect", ids, { add2eHpStatusSync: true });
  return ids.length;
}

async function add2eSetActorStatus(actor, statusId, active, overlay = false) {
  if (!actor || typeof actor.toggleStatusEffect !== "function") return false;
  const current = add2eHasStatus(actor, statusId);
  if (current === active) return false;
  await actor.toggleStatusEffect(statusId, { active, overlay });
  return true;
}

async function add2eSyncActorHpStatus(actor, { reason = "sync" } = {}) {
  if (!game.user?.isGM || !actor) return null;

  const state = add2eActorHpState(actor);
  const manualDead = add2eHasManualStatus(actor, "dead");
  const manualUnconscious = add2eHasManualStatus(actor, "unconscious");
  const trackerDefeated = add2eActorIsDefeatedInTracker(actor);

  if (state === "dead") {
    await add2eRemoveHpManagedStatus(actor, "unconscious");
    if (!manualDead) await add2eSetActorStatus(actor, "dead", true, true);
  } else if (state === "unconscious") {
    await add2eRemoveHpManagedStatus(actor, "dead");
    if (!manualDead && !manualUnconscious) await add2eSetActorStatus(actor, "unconscious", true, true);
  } else if (trackerDefeated || manualDead || manualUnconscious) {
    // PV positifs, mais l'état hors combat a été posé manuellement.
    // Ne pas retirer dead/unconscious ici, car dead porte le special DEFEATED de Foundry.
  } else {
    // PV positifs : on retire uniquement les états automatiques liés aux PV.
    await add2eRemoveHpManagedStatus(actor, "dead");
    await add2eRemoveHpManagedStatus(actor, "unconscious");
  }

  console.log("[ADD2E][VITAL_STATUS][HP_SYNC]", {
    version: ADD2E_TOKEN_STATE_OVERLAY_VERSION,
    reason,
    actor: actor.name,
    actorId: actor.id,
    hp: add2eActorCurrentHp(actor),
    desired: state,
    trackerDefeated,
    manualDead,
    manualUnconscious
  });

  return state;
}

function add2eUpdateChangesContainHp(changes = {}) {
  const paths = [
    "system.pdv",
    "system.pv",
    "system.pv_courant",
    "system.pvCourant",
    "system.points_de_vie",
    "system.points_de_vie_courants",
    "system.points_de_coup_courants",
    "system.hp.value",
    "system.hp.current",
    "system.attributes.hp.value"
  ];
  return paths.some(path => foundry.utils.hasProperty(changes, path));
}

function add2eRefreshTokenOverlay(token) {
  if (!token?.actor) return;
  add2eSyncActorHpStatus(token.actor, { reason: "refreshTokenOverlay" }).catch(() => null);
}

function add2eRefreshActorTokens(actor) {
  add2eSyncActorHpStatus(actor, { reason: "refreshActorTokens" }).catch(() => null);
}

Hooks.once("init", add2eRegisterHpStatusEffects);
Hooks.once("setup", add2eRegisterHpStatusEffects);
Hooks.once("ready", add2eRegisterHpStatusEffects);

Hooks.on("updateActor", (actor, changes = {}, options = {}) => {
  if (options?.add2eHpStatusSync) return;
  if (!add2eUpdateChangesContainHp(changes)) return;
  add2eSyncActorHpStatus(actor, { reason: "updateActor:hp" }).catch(() => null);
});

Hooks.once("canvasReady", () => {
  if (!game.user?.isGM) return;
  for (const token of canvas?.tokens?.placeables ?? []) {
    if (token?.actor) add2eSyncActorHpStatus(token.actor, { reason: "canvasReady" }).catch(() => null);
  }
});

try { globalThis.ADD2E_STATUS_EFFECTS = ADD2E_STATUS_EFFECTS; } catch (_e) {}
try { globalThis.add2eRegisterHpStatusEffects = add2eRegisterHpStatusEffects; } catch (_e) {}
try { globalThis.add2eActorHpState = add2eActorHpState; } catch (_e) {}
try { globalThis.add2eSyncActorHpStatus = add2eSyncActorHpStatus; } catch (_e) {}
try { globalThis.add2eRefreshTokenOverlay = add2eRefreshTokenOverlay; } catch (_e) {}
try { globalThis.add2eRefreshActorTokens = add2eRefreshActorTokens; } catch (_e) {}
