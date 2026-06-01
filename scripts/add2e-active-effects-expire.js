// ============================================================================
// ADD2E — Gestion automatique de l’expiration des effets temporaires
// + synchronisation automatique des états vitaux Inconscient / Mort.
// Version : 2026-05-31-vital-status-monster-inactive-flag-v24
// ============================================================================

globalThis.ADD2E_ACTIVE_EFFECTS_EXPIRE_VERSION = "2026-05-31-vital-status-monster-inactive-flag-v24";
console.log("[ADD2E][AUTO-REMOVE][VERSION]", globalThis.ADD2E_ACTIVE_EFFECTS_EXPIRE_VERSION);

const ADD2E_VITAL_STATUS = {
  unconscious: { key: "unconscious", name: "Inconscient", icon: "icons/svg/daze.svg" },
  dead: { key: "dead", name: "Mort", icon: "icons/svg/skull.svg" }
};

const ADD2E_VITAL_ICONS = new Set(Object.values(ADD2E_VITAL_STATUS).map(s => s.icon));
const ADD2E_VITAL_SYNC_LOCK = new Set();

function add2eArray(value) {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(add2eArray);
  if (value instanceof Set) return [...value];
  if (typeof value?.values === "function") return [...value.values()];
  if (typeof value === "object") return Object.values(value);
  return [value];
}

function add2eNorm(value) {
  return String(value ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, "").replace(/[^a-z0-9:_-]+/g, "_").replace(/^_|_$/g, "");
}

function add2eNumber(value, fallback = NaN) {
  if (typeof value === "string") {
    const m = value.match(/-?\d+(?:[.,]\d+)?/);
    if (!m) return fallback;
    value = m[0].replace(",", ".");
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function add2eActorType(actor) {
  return add2eNorm(actor?.type);
}

function add2eIsMonster(actor) {
  const values = [actor?.type, actor?.system?.type, actor?.system?.actorType, actor?.system?.details?.type, actor?.system?.details?.creatureType, actor?.system?.categorie, actor?.system?.category].map(add2eNorm);
  return values.some(v => ["monster", "monstre", "monsters", "monstres", "creature", "creature_monstre", "npc_monster"].includes(v));
}

function add2eReadHp(actor) {
  const sys = actor?.system ?? {};
  const raw = sys.pdv ?? sys.pv?.value ?? sys.hp?.value ?? sys.hp;
  const fallback = sys.points_de_coup ?? sys.pv?.max ?? sys.hp?.max ?? 0;
  return add2eNumber(raw, add2eNumber(fallback, 0));
}

function add2eDesiredStatus(actor) {
  const hp = add2eReadHp(actor);
  if (add2eIsMonster(actor)) return hp <= 0 ? "dead" : null;
  if (add2eActorType(actor) === "personnage") {
    if (hp <= -11) return "dead";
    if (hp <= 0) return "unconscious";
  }
  return null;
}

function add2eVitalRegisterStatusEffects() {
  CONFIG.statusEffects = Array.isArray(CONFIG.statusEffects) ? CONFIG.statusEffects : [];
  CONFIG.specialStatusEffects ??= {};
  CONFIG.specialStatusEffects.DEFEATED = "dead";
  const defs = [
    { id: "dead", name: "Mort", label: "Mort", img: ADD2E_VITAL_STATUS.dead.icon, icon: ADD2E_VITAL_STATUS.dead.icon, statuses: ["dead"], special: "DEFEATED", flags: { core: { statusId: "dead" }, add2e: { vitalStatus: "dead" } } },
    { id: "unconscious", name: "Inconscient", label: "Inconscient", img: ADD2E_VITAL_STATUS.unconscious.icon, icon: ADD2E_VITAL_STATUS.unconscious.icon, statuses: ["unconscious", "incapacitated"], flags: { core: { statusId: "unconscious" }, add2e: { vitalStatus: "unconscious" } } }
  ];
  for (const def of defs) {
    const idx = CONFIG.statusEffects.findIndex(e => add2eNorm(e?.id ?? e?.name ?? e?.label) === def.id || add2eNorm(e?.flags?.core?.statusId) === def.id || add2eNorm(e?.flags?.add2e?.vitalStatus) === def.id);
    if (idx >= 0) CONFIG.statusEffects[idx] = foundry.utils.mergeObject(foundry.utils.deepClone(CONFIG.statusEffects[idx]), def, { inplace: false, insertKeys: true, overwrite: true });
    else CONFIG.statusEffects.push(foundry.utils.deepClone(def));
  }
  console.log("[ADD2E][VITAL_STATUS][REGISTER_STATUS]", { version: globalThis.ADD2E_ACTIVE_EFFECTS_EXPIRE_VERSION, defeatedStatus: CONFIG.specialStatusEffects.DEFEATED, hasDead: true, hasUnconscious: true });
}

function add2eEffectKind(effect) {
  const values = [effect?.id, effect?._id, effect?.name, effect?.label, effect?.flags?.core?.statusId, effect?.flags?.add2e?.vitalStatus, ...(effect?.statuses ?? [])].map(add2eNorm);
  if (values.some(v => ["dead", "mort", "etat_mort"].includes(v))) return "dead";
  if (values.some(v => ["unconscious", "inconscient", "etat_inconscient", "incapacitated"].includes(v))) return "unconscious";
  return null;
}

async function add2eCleanWrongMonsterActorEffects(actor, desired) {
  if (!actor || !add2eIsMonster(actor)) return { removedActorEffects: 0, removedKinds: [] };
  const ids = [];
  const removedKinds = [];
  for (const effect of actor.effects ?? []) {
    const kind = add2eEffectKind(effect);
    if (!kind) continue;
    if ((desired === "dead" && kind === "unconscious") || (desired === null && (kind === "dead" || kind === "unconscious"))) {
      ids.push(effect.id);
      removedKinds.push(kind);
    }
  }
  const validIds = ids.filter(id => id && actor.effects?.get?.(id));
  if (!validIds.length) return { removedActorEffects: 0, removedKinds };
  try {
    await actor.deleteEmbeddedDocuments("ActiveEffect", validIds, { add2eVitalMonsterCleanup: true });
    console.log("[ADD2E][VITAL_STATUS][MONSTER_EFFECT_CLEANUP]", { actor: actor.name, desired, ids: validIds, removedKinds });
    return { removedActorEffects: validIds.length, removedKinds };
  } catch (err) {
    console.warn("[ADD2E][VITAL_STATUS][MONSTER_EFFECT_CLEANUP][WARN]", { actor: actor.name, desired, ids: validIds, err });
    return { removedActorEffects: 0, removedKinds, error: String(err?.message || err || "") };
  }
}

function add2eActorTokens(actor) {
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

function add2eCleanTokenEffects(effects) {
  const clean = [];
  const removed = [];
  for (const value of add2eArray(effects)) {
    const n = add2eNorm(value);
    if (ADD2E_VITAL_ICONS.has(value) || n.includes("skull") || n.includes("unconscious") || n.includes("daze")) {
      removed.push(value);
      continue;
    }
    clean.push(value);
  }
  return { clean, removed };
}

function add2eIconFor(actor, desired) {
  if (add2eIsMonster(actor)) return desired === "dead" ? ADD2E_VITAL_STATUS.dead.icon : null;
  if (desired === "dead") return ADD2E_VITAL_STATUS.dead.icon;
  if (desired === "unconscious") return ADD2E_VITAL_STATUS.unconscious.icon;
  return null;
}

async function add2eSetTokenIcon(token, actor, desired) {
  const doc = token?.document ?? token;
  if (!doc?.update) return false;
  const current = add2eArray(doc.effects ?? doc._source?.effects ?? []);
  const { clean, removed } = add2eCleanTokenEffects(current);
  const icon = add2eIconFor(actor, desired);
  if (icon && !clean.includes(icon)) clean.push(icon);
  const overlay = doc.overlayEffect ?? doc._source?.overlayEffect ?? "";
  const patch = {};
  if (current.length !== clean.length || current.some((v, i) => v !== clean[i])) patch.effects = clean;
  if (ADD2E_VITAL_ICONS.has(overlay) || add2eNorm(overlay).includes("skull") || add2eNorm(overlay).includes("daze") || add2eNorm(overlay).includes("unconscious")) patch.overlayEffect = null;
  if (!Object.keys(patch).length) return false;
  await doc.update(patch, { add2eVitalStatusSync: true });
  console.log("[ADD2E][VITAL_STATUS][TOKEN_ICON]", { token: doc.name, actor: actor?.name, isMonster: add2eIsMonster(actor), desired, desiredIcon: icon, removed, effects: clean });
  return true;
}

function add2eCombatantsForActor(actor) {
  const combats = [game.combat, ...add2eArray(game.combats)].filter(Boolean);
  const out = [];
  const seen = new Set();
  for (const combat of combats) {
    for (const c of add2eArray(combat?.combatants)) {
      if (!c?.id) continue;
      const same = c.actor?.id === actor?.id || c.actorId === actor?.id || c.token?.actorId === actor?.id;
      if (!same) continue;
      const key = `${combat.id}:${c.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(c);
    }
  }
  return out;
}

function add2eHasInactiveCombatant(actor) {
  return add2eCombatantsForActor(actor).some(c => c?.defeated === true || c?.flags?.core?.defeated === true || c?.flags?.add2e?.inactive === true);
}

async function add2eSetCombatInactive(actor, inactive) {
  const isMonster = add2eIsMonster(actor);
  let changed = 0;
  for (const c of add2eCombatantsForActor(actor)) {
    if (!c?.update) continue;
    try {
      if (isMonster) {
        const patch = { defeated: false, "flags.add2e.inactive": Boolean(inactive), "flags.add2e.inactiveReason": inactive ? "dead" : null, "flags.add2e.vitalStatus": inactive ? "dead" : null };
        const same = c.defeated === false && c.flags?.add2e?.inactive === Boolean(inactive) && c.flags?.add2e?.vitalStatus === (inactive ? "dead" : null);
        if (same) continue;
        await c.update(patch, { add2eVitalStatusSync: true });
        console.log("[ADD2E][VITAL_STATUS][MONSTER_INACTIVE_FLAG]", { actor: actor?.name, combatant: c.id, inactive: Boolean(inactive), defeated: false });
        changed += 1;
      } else {
        if (c.defeated === inactive) continue;
        await c.update({ defeated: inactive }, { add2eVitalStatusSync: true });
        changed += 1;
      }
    } catch (err) {
      console.warn("[ADD2E][VITAL_STATUS][INACTIVE][WARN]", { actor: actor?.name, combatant: c?.id, inactive, isMonster, err });
    }
  }
  return changed;
}

async function add2eSyncTokenAndCombat(actor, desired, { preserveInactive = false } = {}) {
  let tokenEffects = 0;
  if (!preserveInactive) {
    for (const token of add2eActorTokens(actor)) {
      try { if (await add2eSetTokenIcon(token, actor, desired)) tokenEffects += 1; }
      catch (err) { console.warn("[ADD2E][VITAL_STATUS][TOKEN_EFFECT][WARN]", { actor: actor?.name, token: token?.name, desired, err }); }
    }
  }
  const inactive = preserveInactive ? 0 : await add2eSetCombatInactive(actor, desired !== null);
  return { tokenEffects, inactive, preserveInactive };
}

async function add2eSyncActorVitalStatus(actor, { reason = "sync" } = {}) {
  if (!actor || !["personnage", "monster"].includes(add2eActorType(actor)) && !add2eIsMonster(actor)) return false;
  if (!game.user?.isGM) return false;
  const lockKey = actor.uuid ?? actor.id;
  if (ADD2E_VITAL_SYNC_LOCK.has(lockKey)) return false;
  ADD2E_VITAL_SYNC_LOCK.add(lockKey);
  try {
    add2eVitalRegisterStatusEffects();
    const desired = add2eDesiredStatus(actor);
    const isMonster = add2eIsMonster(actor);
    const trackerInactive = add2eHasInactiveCombatant(actor);
    const preserveInactive = !isMonster && trackerInactive && desired === null;
    const before = add2eArray(actor?.effects).filter(e => add2eEffectKind(e)).map(e => ({ id: e.id, name: e.name, kind: add2eEffectKind(e), icon: e.icon }));
    const cleanupBefore = await add2eCleanWrongMonsterActorEffects(actor, desired);
    const state = await add2eSyncTokenAndCombat(actor, desired, { preserveInactive });
    const cleanupAfter = await add2eCleanWrongMonsterActorEffects(actor, desired);
    console.log("[ADD2E][VITAL_STATUS][SYNC]", { reason, actor: actor.name, actorId: actor.id, type: actor.type, isMonster, hp: add2eReadHp(actor), desired, trackerInactive, preserveInactive, monsterInactiveUsesAdd2eFlag: isMonster, removed: (cleanupBefore.removedActorEffects ?? 0) + (cleanupAfter.removedActorEffects ?? 0), cleanupBefore, cleanupAfter, before, state });
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

Hooks.on("updateActor", async (actor, changed, options) => {
  if (!game.user?.isGM) return;
  if (options?.add2eVitalStatusSync) return;
  const hpChanged = foundry.utils.hasProperty(changed, "system.pdv") || foundry.utils.hasProperty(changed, "system.pv") || foundry.utils.hasProperty(changed, "system.hp") || foundry.utils.hasProperty(changed, "system.points_de_coup");
  if (!hpChanged) return;
  window.setTimeout(() => add2eSyncActorVitalStatus(actor, { reason: "updateActor:hp" }), 30);
});

Hooks.once("ready", () => {
  if (!game.user?.isGM) return;
  window.setTimeout(() => {
    add2eVitalRegisterStatusEffects();
    for (const actor of game.actors ?? []) add2eSyncActorVitalStatus(actor, { reason: "ready-scan" });
    for (const token of canvas?.tokens?.placeables ?? []) if (token?.actor) add2eSyncActorVitalStatus(token.actor, { reason: "ready-token-scan" });
  }, 500);
});

Hooks.on("updateCombat", async (combat, changed) => {
  if (!("round" in changed) && !("turn" in changed)) return;
  const currentRound = combat.round ?? 0;
  console.log("[ADD2E][AUTO-REMOVE] updateCombat déclenché :", { round: currentRound, changed });
  try {
    add2eVitalRegisterStatusEffects();
    for (const combatant of combat.combatants || []) {
      const actor = combatant?.actor;
      if (!actor) continue;
      const toDelete = [];
      for (const effect of Array.from(actor.effects ?? [])) {
        if (!effect || add2eEffectKind(effect) || effect.disabled) continue;
        const dur = effect.duration || {};
        if (typeof dur.rounds !== "number" || isNaN(dur.rounds)) continue;
        let startRound = dur.startRound;
        if (typeof startRound !== "number" || isNaN(startRound)) {
          try {
            if (!actor.effects.get(effect.id)) continue;
            await effect.update({ "duration.startRound": currentRound });
            startRound = currentRound;
          } catch (err) {
            const msg = String(err?.message || err || "");
            if (msg.includes("does not exist") || msg.includes("n'existe pas")) continue;
            throw err;
          }
        }
        if ((dur.rounds - Math.max(0, currentRound - startRound)) <= 0) toDelete.push(effect.id);
      }
      const validIds = toDelete.filter(id => id && actor.effects.get(id));
      if (validIds.length) await actor.deleteEmbeddedDocuments("ActiveEffect", validIds);
      await add2eSyncActorVitalStatus(actor, { reason: "updateCombat:scan" });
    }
  } catch (err) {
    console.error("[ADD2E][AUTO-REMOVE] ERREUR dans updateCombat(auto-remove-effects) :", err);
  }
});
