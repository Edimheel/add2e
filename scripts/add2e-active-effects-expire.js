// ============================================================================
// ADD2E — Gestion automatique de l’expiration des effets temporaires
// + synchronisation automatique des états vitaux Inconscient / Mort.
// Version : 2026-05-31-vital-status-token-only-v19
// ============================================================================

globalThis.ADD2E_ACTIVE_EFFECTS_EXPIRE_VERSION = "2026-05-31-vital-status-token-only-v19";
console.log("[ADD2E][AUTO-REMOVE][VERSION]", globalThis.ADD2E_ACTIVE_EFFECTS_EXPIRE_VERSION);

const ADD2E_VITAL_STATUS = {
  unconscious: { key: "unconscious", name: "Inconscient", icon: "icons/svg/daze.svg" },
  dead: { key: "dead", name: "Mort", icon: "icons/svg/skull.svg" }
};

const ADD2E_VITAL_STATUS_EFFECT_IDS = {
  dead: "ADD2Edead0000000",
  unconscious: "ADD2Eunconsc0000"
};

const ADD2E_VITAL_ICONS = new Set(Object.values(ADD2E_VITAL_STATUS).map(s => s.icon));
const ADD2E_VITAL_SYNC_LOCK = new Set();

function add2eVitalArray(value) {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(add2eVitalArray);
  if (value instanceof Set) return [...value];
  if (typeof value?.values === "function") return [...value.values()];
  if (typeof value === "object") return Object.values(value);
  return [value];
}

function add2eVitalNorm(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9:_-]+/g, "_")
    .replace(/^_|_$/g, "");
}

function add2eVitalStatusAliases(effect) {
  return [effect?.id, effect?._id, effect?.name, effect?.label, effect?.flags?.core?.statusId, effect?.flags?.add2e?.vitalStatus]
    .map(add2eVitalNorm)
    .filter(Boolean);
}

function add2eVitalMergeObject(base, patch) {
  try {
    return foundry.utils.mergeObject(foundry.utils.deepClone(base ?? {}), foundry.utils.deepClone(patch ?? {}), { inplace: false, insertKeys: true, overwrite: true });
  } catch (_err) {
    return { ...(base ?? {}), ...(patch ?? {}) };
  }
}

function add2eVitalRegisterStatusEffects() {
  CONFIG.statusEffects = Array.isArray(CONFIG.statusEffects) ? CONFIG.statusEffects : [];
  CONFIG.specialStatusEffects ??= {};
  CONFIG.specialStatusEffects.DEFEATED = "dead";

  const definitions = [
    {
      _id: ADD2E_VITAL_STATUS_EFFECT_IDS.dead,
      id: "dead",
      name: "Mort",
      label: "Mort",
      img: ADD2E_VITAL_STATUS.dead.icon,
      icon: ADD2E_VITAL_STATUS.dead.icon,
      statuses: ["dead"],
      special: "DEFEATED",
      flags: { core: { statusId: "dead" }, add2e: { vitalStatus: "dead", autoVitalStatus: true } }
    },
    {
      _id: ADD2E_VITAL_STATUS_EFFECT_IDS.unconscious,
      id: "unconscious",
      name: "Inconscient",
      label: "Inconscient",
      img: ADD2E_VITAL_STATUS.unconscious.icon,
      icon: ADD2E_VITAL_STATUS.unconscious.icon,
      statuses: ["unconscious", "incapacitated"],
      flags: { core: { statusId: "unconscious" }, add2e: { vitalStatus: "unconscious", autoVitalStatus: true } }
    }
  ];

  for (const definition of definitions) {
    const wanted = add2eVitalNorm(definition.id);
    const index = CONFIG.statusEffects.findIndex(effect => add2eVitalStatusAliases(effect).includes(wanted));
    if (index >= 0) CONFIG.statusEffects[index] = add2eVitalMergeObject(CONFIG.statusEffects[index], definition);
    else CONFIG.statusEffects.push(foundry.utils?.deepClone ? foundry.utils.deepClone(definition) : { ...definition });
  }

  console.log("[ADD2E][VITAL_STATUS][REGISTER_STATUS]", {
    version: globalThis.ADD2E_ACTIVE_EFFECTS_EXPIRE_VERSION,
    defeatedStatus: CONFIG.specialStatusEffects.DEFEATED,
    hasDead: CONFIG.statusEffects.some(effect => add2eVitalStatusAliases(effect).includes("dead")),
    hasUnconscious: CONFIG.statusEffects.some(effect => add2eVitalStatusAliases(effect).includes("unconscious"))
  });
}

function add2eVitalNumber(value, fallback = NaN) {
  if (typeof value === "string") {
    const m = value.match(/-?\d+(?:[.,]\d+)?/);
    if (!m) return fallback;
    value = m[0].replace(",", ".");
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function add2eVitalReadHP(actor) {
  const sys = actor?.system ?? {};
  const raw = sys.pdv ?? sys.pv?.value ?? sys.hp?.value ?? sys.hp;
  const fallback = sys.points_de_coup ?? sys.pv?.max ?? sys.hp?.max ?? 0;
  return add2eVitalNumber(raw, add2eVitalNumber(fallback, 0));
}

function add2eVitalDesiredStatus(actor) {
  const type = String(actor?.type ?? "").toLowerCase();
  const hp = add2eVitalReadHP(actor);

  if (type === "monster") return hp <= 0 ? "dead" : null;
  if (type === "personnage") {
    if (hp <= -11) return "dead";
    if (hp <= 0) return "unconscious";
  }

  return null;
}

function add2eVitalEffectStatuses(effect) {
  return new Set(add2eVitalArray(effect?.statuses ?? effect?.system?.statuses ?? effect?.flags?.core?.statusId ?? []).map(add2eVitalNorm).filter(Boolean));
}

function add2eVitalEffectFlag(effect) {
  const flags = effect?.flags?.add2e ?? {};
  const values = [
    flags.vitalStatus,
    flags.status,
    flags.etat,
    flags.autoVitalStatus === true ? "autoVitalStatus" : "",
    typeof effect?.getFlag === "function" ? effect.getFlag("add2e", "vitalStatus") : null,
    typeof effect?.getFlag === "function" && effect.getFlag("add2e", "autoVitalStatus") === true ? "autoVitalStatus" : ""
  ];
  return values.map(add2eVitalNorm).find(v => ["dead", "unconscious", "mort", "inconscient", "autovitalstatus"].includes(v)) ?? "";
}

function add2eVitalEffectKind(effect) {
  const name = add2eVitalNorm(effect?.name ?? effect?.label ?? "");
  const statuses = add2eVitalEffectStatuses(effect);
  const flag = add2eVitalEffectFlag(effect);
  if (flag === "dead" || flag === "mort") return "dead";
  if (flag === "unconscious" || flag === "inconscient") return "unconscious";
  if (flag === "autovitalstatus") return "vital";
  if (name === "mort" || name === "dead" || name === "etat_mort") return "dead";
  if (name === "inconscient" || name === "unconscious" || name === "etat_inconscient") return "unconscious";
  if (statuses.has("dead") || statuses.has("mort")) return "dead";
  if (statuses.has("unconscious") || statuses.has("inconscient")) return "unconscious";
  return null;
}

function add2eVitalActorEffectData(statusId) {
  const normalizedStatus = add2eVitalNorm(statusId);
  const status = ADD2E_VITAL_STATUS[normalizedStatus];
  const effectId = ADD2E_VITAL_STATUS_EFFECT_IDS[normalizedStatus];
  if (!status || !effectId) return null;

  return {
    _id: effectId,
    name: status.name,
    label: status.name,
    img: status.icon,
    icon: status.icon,
    disabled: false,
    statuses: normalizedStatus === "dead" ? ["dead"] : ["unconscious", "incapacitated"],
    flags: {
      core: { statusId: normalizedStatus },
      add2e: { vitalStatus: normalizedStatus, autoVitalStatus: true }
    }
  };
}

async function add2eVitalRemoveActorVitalEffects(_actor) {
  // Depuis v19, les états vitaux automatiques ne modifient plus Actor.effects.
  // Cela évite les courses Foundry : _id déjà existant / effet déjà supprimé.
  return 0;
}

async function add2eVitalSetActorStatus(_actor, _statusId, _active, _overlay = false) {
  // Depuis v19, l'état visible est porté par TokenDocument.effects,
  // et l'état d'initiative par Combatant.defeated.
  return false;
}

function add2eVitalGetActorTokens(actor) {
  const tokens = [];
  try { tokens.push(...(actor?.getActiveTokens?.(true, true) ?? [])); } catch (_e) {}
  try { tokens.push(...(canvas?.tokens?.placeables ?? []).filter(t => t?.actor?.id === actor?.id || t?.document?.actorId === actor?.id)); } catch (_e) {}
  const seen = new Set();
  return tokens.filter(t => {
    const id = t?.document?.uuid ?? t?.id ?? t?.document?.id;
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return !!t?.document;
  });
}

function add2eVitalCleanTokenEffects(effects) {
  const clean = [];
  const removed = [];
  for (const value of add2eVitalArray(effects)) {
    if (ADD2E_VITAL_ICONS.has(value)) {
      removed.push(value);
      continue;
    }
    const n = add2eVitalNorm(value);
    if (n.includes("skull") || n.includes("unconscious") || n.includes("daze")) {
      removed.push(value);
      continue;
    }
    clean.push(value);
  }
  return { clean, removed };
}

function add2eVitalIconForDesired(desired) {
  if (desired === "dead") return ADD2E_VITAL_STATUS.dead.icon;
  if (desired === "unconscious") return ADD2E_VITAL_STATUS.unconscious.icon;
  return null;
}

async function add2eVitalSetTokenEffects(token, desired) {
  const doc = token?.document ?? token;
  if (!doc?.update) return false;

  const currentEffects = add2eVitalArray(doc.effects ?? doc._source?.effects ?? []);
  const { clean: cleanEffects, removed } = add2eVitalCleanTokenEffects(currentEffects);
  const desiredIcon = add2eVitalIconForDesired(desired);
  if (desiredIcon && !cleanEffects.includes(desiredIcon)) cleanEffects.push(desiredIcon);

  const currentOverlay = doc.overlayEffect ?? doc._source?.overlayEffect ?? "";
  const currentOverlayNorm = add2eVitalNorm(currentOverlay);
  const patch = {};

  if (currentEffects.length !== cleanEffects.length || currentEffects.some((v, i) => v !== cleanEffects[i])) patch.effects = cleanEffects;
  if (ADD2E_VITAL_ICONS.has(currentOverlay) || currentOverlayNorm.includes("skull") || currentOverlayNorm.includes("daze") || currentOverlayNorm.includes("unconscious")) patch.overlayEffect = null;

  if (!Object.keys(patch).length) return false;
  await doc.update(patch, { add2eVitalStatusSync: true });
  console.log("[ADD2E][VITAL_STATUS][TOKEN_ICON]", {
    token: doc.name,
    desired,
    desiredIcon,
    removed,
    effects: cleanEffects
  });
  return true;
}

function add2eVitalCombatantsForActor(actor) {
  const combats = [game.combat, ...add2eVitalArray(game.combats)].filter(Boolean);
  const out = [];
  const seen = new Set();
  for (const combat of combats) {
    for (const combatant of add2eVitalArray(combat?.combatants)) {
      if (!combatant?.id) continue;
      const sameActor = combatant.actor?.id === actor?.id || combatant.actorId === actor?.id || combatant.token?.actorId === actor?.id;
      if (!sameActor) continue;
      const key = `${combat.id}:${combatant.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(combatant);
    }
  }
  return out;
}

function add2eVitalActorHasDefeatedCombatant(actor) {
  return add2eVitalCombatantsForActor(actor).some(combatant => combatant?.defeated === true || combatant?.flags?.core?.defeated === true);
}

async function add2eVitalSetDefeated(actor, defeated) {
  const combatants = add2eVitalCombatantsForActor(actor);
  let changed = 0;
  for (const combatant of combatants) {
    if (!combatant?.update) continue;
    if (combatant.defeated === defeated) continue;
    try {
      await combatant.update({ defeated }, { add2eVitalStatusSync: true });
      changed += 1;
    } catch (err) {
      console.warn("[ADD2E][VITAL_STATUS][DEFEATED][WARN]", { actor: actor?.name, combatant: combatant?.id, defeated, err });
    }
  }
  return changed;
}

async function add2eVitalSyncTokenState(actor, desired, { preserveDefeated = false } = {}) {
  const tokens = add2eVitalGetActorTokens(actor);
  let tokenEffects = 0;
  if (!preserveDefeated) {
    for (const token of tokens) {
      try {
        if (await add2eVitalSetTokenEffects(token, desired)) tokenEffects += 1;
      } catch (err) {
        console.warn("[ADD2E][VITAL_STATUS][TOKEN_EFFECT][WARN]", { actor: actor?.name, token: token?.name, desired, err });
      }
    }
  }
  const defeated = preserveDefeated ? 0 : await add2eVitalSetDefeated(actor, desired !== null);
  return { tokenEffects, defeated, tokenCount: tokens.length, preserveDefeated };
}

async function add2eSyncActorVitalStatus(actor, { reason = "sync" } = {}) {
  if (!actor || !["personnage", "monster"].includes(String(actor.type ?? "").toLowerCase())) return false;
  if (!game.user?.isGM) return false;
  const lockKey = actor.uuid ?? actor.id;
  if (ADD2E_VITAL_SYNC_LOCK.has(lockKey)) return false;
  ADD2E_VITAL_SYNC_LOCK.add(lockKey);
  try {
    add2eVitalRegisterStatusEffects();
    const desired = add2eVitalDesiredStatus(actor);
    const trackerDefeated = add2eVitalActorHasDefeatedCombatant(actor);
    const preserveDefeated = trackerDefeated && desired === null;
    const before = add2eVitalArray(actor?.effects).filter(e => add2eVitalEffectKind(e)).map(e => ({ id: e.id, name: e.name, kind: add2eVitalEffectKind(e), icon: e.icon }));
    const removed = 0;
    const actorStatus = null;
    const tokenState = await add2eVitalSyncTokenState(actor, desired, { preserveDefeated });
    console.log("[ADD2E][VITAL_STATUS][SYNC]", {
      reason,
      actor: actor.name,
      actorId: actor.id,
      type: actor.type,
      hp: add2eVitalReadHP(actor),
      desired,
      trackerDefeated,
      preserveDefeated,
      actorStatus,
      removed,
      before,
      tokenState
    });
    return true;
  } catch (err) {
    console.error("[ADD2E][VITAL_STATUS][ERROR]", { actor: actor?.name, reason, err });
    return false;
  } finally {
    ADD2E_VITAL_SYNC_LOCK.delete(lockKey);
  }
}

globalThis.add2eSyncActorVitalStatus = add2eSyncActorVitalStatus;
globalThis.add2eVitalRegisterStatusEffects = add2eVitalRegisterStatusEffects;

Hooks.once("init", add2eVitalRegisterStatusEffects);
Hooks.once("setup", add2eVitalRegisterStatusEffects);
Hooks.once("ready", add2eVitalRegisterStatusEffects);

Hooks.on("updateActor", async (actor, changed, options, userId) => {
  if (!game.user?.isGM) return;
  if (options?.add2eVitalStatusSync) return;
  const hpChanged = foundry.utils.hasProperty(changed, "system.pdv") ||
    foundry.utils.hasProperty(changed, "system.pv") ||
    foundry.utils.hasProperty(changed, "system.hp") ||
    foundry.utils.hasProperty(changed, "system.points_de_coup");
  if (!hpChanged) return;
  window.setTimeout(() => add2eSyncActorVitalStatus(actor, { reason: "updateActor:hp" }), 30);
});

Hooks.once("ready", () => {
  if (!game.user?.isGM) return;
  window.setTimeout(() => {
    add2eVitalRegisterStatusEffects();
    for (const actor of game.actors ?? []) add2eSyncActorVitalStatus(actor, { reason: "ready-scan" });
    for (const token of canvas?.tokens?.placeables ?? []) {
      if (token?.actor) add2eSyncActorVitalStatus(token.actor, { reason: "ready-token-scan" });
    }
  }, 500);
});

Hooks.on("updateCombat", async (combat, changed, options, userId) => {
  if (!("round" in changed) && !("turn" in changed)) return;
  const currentRound = combat.round ?? 0;
  console.log("[ADD2E][AUTO-REMOVE] updateCombat déclenché :", { round: currentRound, changed });
  try {
    add2eVitalRegisterStatusEffects();
    const combatants = combat.combatants || [];
    for (const combatant of combatants) {
      if (!combatant) continue;
      const actor = combatant.actor;
      if (!actor) {
        console.warn("[ADD2E][AUTO-REMOVE] combatant sans actor :", combatant);
        continue;
      }
      const toDelete = [];
      for (const effect of Array.from(actor.effects ?? [])) {
        if (!effect) continue;
        if (add2eVitalEffectKind(effect)) continue;
        const dur = effect.duration || {};
        if (effect.disabled) continue;
        if (typeof dur.rounds !== "number" || isNaN(dur.rounds)) continue;
        const totalRounds = dur.rounds;
        let startRound = dur.startRound;
        if (typeof startRound !== "number" || isNaN(startRound)) {
          try {
            if (!actor.effects.get(effect.id)) continue;
            await effect.update({ "duration.startRound": currentRound });
            startRound = currentRound;
          } catch (err) {
            const msg = String(err?.message || err || "");
            if (msg.includes("does not exist") || msg.includes("n'existe pas")) {
              console.warn("[ADD2E][AUTO-REMOVE][STALE_UPDATE] Effet déjà absent pendant l'initialisation startRound", { actor: actor.name, effectId: effect.id, effectName: effect.name });
              continue;
            }
            throw err;
          }
        }
        const elapsed = Math.max(0, currentRound - startRound);
        const remaining = totalRounds - elapsed;
        if (remaining <= 0) toDelete.push(effect.id);
      }
      const validIds = toDelete.filter(id => id && actor.effects.get(id));
      if (validIds.length) {
        console.log("[ADD2E][AUTO-REMOVE] Suppression auto des effets expirés", { actor: actor.name, ids: validIds });
        for (const effectId of validIds) {
          if (!actor.effects.get(effectId)) continue;
          try {
            await actor.deleteEmbeddedDocuments("ActiveEffect", [effectId]);
          } catch (err) {
            const msg = String(err?.message || err || "");
            if (msg.includes("does not exist") || msg.includes("n'existe pas")) {
              console.warn("[ADD2E][AUTO-REMOVE][ALREADY_GONE] Effet déjà absent, suppression ignorée", { actor: actor.name, effectId, err });
              continue;
            }
            console.error("[ADD2E][AUTO-REMOVE][DELETE_ERROR] Suppression impossible", { actor: actor.name, effectId, err });
          }
        }
      }
      await add2eSyncActorVitalStatus(actor, { reason: "updateCombat:scan" });
    }
  } catch (err) {
    console.error("[ADD2E][AUTO-REMOVE] ERREUR dans updateCombat(auto-remove-effects) :", err);
  }
});
