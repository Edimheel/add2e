// scripts/add2e-initiative-locks.mjs
// ADD2E — verrouillage hors tour, trace de mouvement et synchronisation HUD.

import { ADD2E_INITIATIVE_VERSION, TAG, initiativeState } from "./add2e-initiative-constants.mjs";
import { currentCombatant, tokenFromCombatant } from "./add2e-initiative-order.mjs";

function combatantMatchesActor(combatant, actor) {
  return Boolean(combatant && actor && (combatant.actor?.id === actor.id || combatant.actorId === actor.id));
}

export function canActorActNow(actor, { notify = false } = {}) {
  const combatant = currentCombatant(game.combat);
  if (!game.combat?.started || !combatant) return true;
  if (game.user?.isGM) return true;
  if (combatantMatchesActor(combatant, actor)) return true;
  if (notify) {
    const now = Date.now();
    if (now - initiativeState.warningAt > 900) {
      initiativeState.warningAt = now;
      ui.notifications?.info?.(`${actor?.name ?? "Cet acteur"} ne peut pas agir. C'est le tour de ${combatant.name}.`);
    }
  }
  return false;
}

export function canTokenInteractNow(tokenOrDoc, { notify = false } = {}) {
  if (!game.combat?.started || game.user?.isGM) return true;
  const actor = tokenOrDoc?.actor ?? tokenOrDoc?.object?.actor ?? null;
  return canActorActNow(actor, { notify });
}

export function installTokenMoveLock() {
  const proto = globalThis.Token?.prototype;
  if (!proto) return;
  for (const method of ["_onDragLeftStart", "_onDragLeftMove", "_onDragLeftDrop", "_onDragLeftCancel"]) {
    const original = proto[method];
    if (typeof original !== "function" || original.__add2eLock === ADD2E_INITIATIVE_VERSION) continue;
    proto[method] = function add2eTokenMoveLock(...args) {
      if (!canTokenInteractNow(this, { notify: true })) return false;
      return original.apply(this, args);
    };
    proto[method].__add2eLock = ADD2E_INITIATIVE_VERSION;
    proto[method].__add2eOriginal = original;
  }
}

function resolveActionActor(argsLike) {
  const args = Array.isArray(argsLike) ? argsLike : [];
  const first = args[0] ?? null;
  if (first?.actor) return first.actor;
  if (first?.actorId) return game.actors?.get?.(first.actorId) ?? null;
  if (first?.token?.actor) return first.token.actor;
  if (first?.tokenId) return canvas?.tokens?.get?.(first.tokenId)?.actor ?? null;
  return canvas?.tokens?.controlled?.[0]?.actor ?? game.user?.character ?? null;
}

export function installActionLocks() {
  for (const name of ["add2eAttackRoll", "add2eCastSpell", "cast_spell", "add2eExecuteClassFeatureOnUse"]) {
    const current = globalThis[name];
    if (typeof current !== "function" || current.__add2eLock === ADD2E_INITIATIVE_VERSION) continue;
    const wrapped = async function add2eActionLock(...args) {
      const actor = resolveActionActor(args);
      if (!canActorActNow(actor, { notify: true })) return false;
      return current.apply(this, args);
    };
    wrapped.__add2eLock = ADD2E_INITIATIVE_VERSION;
    wrapped.__add2eOriginal = current;
    globalThis[name] = wrapped;
  }
}

function resetRulerLike(ruler) {
  try { if (typeof ruler?.reset === "function") ruler.reset(); } catch (_e) {}
}

export function clearFoundryMovementTrail(token = null) {
  for (const t of (token ? [token] : Array.from(canvas?.tokens?.placeables ?? []))) {
    resetRulerLike(t?._ruler);
    resetRulerLike(t?._hoverRuler);
  }
  resetRulerLike(canvas?.controls?.ruler);
  return true;
}

export function clearFoundryMovementTrailAggressive(token = null) {
  clearFoundryMovementTrail(token);
  setTimeout(() => clearFoundryMovementTrail(token), 20);
  return true;
}

export function syncActionHudToCombatant(combat = game.combat, { reason = "combat" } = {}) {
  if (!combat?.started || !document.getElementById("add2e-action-hud")) return false;
  const combatant = currentCombatant(combat);
  const actor = combatant?.actor ?? null;
  if (!actor || typeof globalThis.add2eRenderActionHud !== "function") return false;
  try {
    globalThis.add2eRenderActionHud(actor, tokenFromCombatant(combatant), { reason: `initiative-${reason}` });
    return true;
  } catch (err) {
    console.warn(`${TAG}[HUD_FOLLOW][ERROR]`, err);
    return false;
  }
}

globalThis.add2eSyncActionHudToCombatant = syncActionHudToCombatant;
