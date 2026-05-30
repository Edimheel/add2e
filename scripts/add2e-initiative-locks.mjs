// scripts/add2e-initiative-locks.mjs
// ADD2E — verrouillage hors tour, trace de mouvement et synchronisation HUD.

import { ADD2E_INITIATIVE_VERSION, TAG, initiativeState } from "./add2e-initiative-constants.mjs";
import { currentCombatant, tokenFromCombatant } from "./add2e-initiative-order.mjs";

const ACTION_GLOBALS = ["add2eAttackRoll", "add2eCastSpell", "cast_spell", "add2eExecuteClassFeatureOnUse"];
const TOKEN_DRAG_METHODS = ["_onDragLeftStart", "_onDragLeftMove", "_onDragLeftDrop", "_onDragLeftCancel"];

function actorFromActionArgs(args) {
  const first = args?.[0] ?? null;
  if (first?.actor) return first.actor;
  if (first?.actorId) return game.actors?.get?.(first.actorId) ?? null;
  if (first?.token?.actor) return first.token.actor;
  if (first?.tokenId) return canvas?.tokens?.get?.(first.tokenId)?.actor ?? null;
  return canvas?.tokens?.controlled?.[0]?.actor ?? game.user?.character ?? null;
}

function notifyWrongTurn(actor, combatant) {
  const now = Date.now();
  if (now - initiativeState.warningAt <= 900) return;
  initiativeState.warningAt = now;
  ui.notifications?.info?.(`${actor?.name ?? "Cet acteur"} ne peut pas agir. C'est le tour de ${combatant.name}.`);
}

export function canActorActNow(actor, { notify = false } = {}) {
  const combatant = currentCombatant(game.combat);
  if (!game.combat?.started || !combatant || game.user?.isGM) return true;
  if (combatant.actor?.id === actor?.id || combatant.actorId === actor?.id) return true;
  if (notify) notifyWrongTurn(actor, combatant);
  return false;
}

export function canTokenInteractNow(tokenOrDoc, { notify = false } = {}) {
  if (!game.combat?.started || game.user?.isGM) return true;
  return canActorActNow(tokenOrDoc?.actor ?? tokenOrDoc?.object?.actor ?? null, { notify });
}

export function installTokenMoveLock() {
  const proto = globalThis.Token?.prototype;
  if (!proto) return;

  for (const method of TOKEN_DRAG_METHODS) {
    const original = proto[method];
    if (typeof original !== "function" || original.__add2eLock === ADD2E_INITIATIVE_VERSION) continue;

    proto[method] = function add2eTokenMoveLock(...args) {
      return canTokenInteractNow(this, { notify: true }) ? original.apply(this, args) : false;
    };
    proto[method].__add2eLock = ADD2E_INITIATIVE_VERSION;
    proto[method].__add2eOriginal = original;
  }
}

export function installActionLocks() {
  for (const name of ACTION_GLOBALS) {
    const current = globalThis[name];
    if (typeof current !== "function" || current.__add2eLock === ADD2E_INITIATIVE_VERSION) continue;

    const wrapped = async function add2eActionLock(...args) {
      return canActorActNow(actorFromActionArgs(args), { notify: true }) ? current.apply(this, args) : false;
    };
    wrapped.__add2eLock = ADD2E_INITIATIVE_VERSION;
    wrapped.__add2eOriginal = current;
    globalThis[name] = wrapped;
  }
}

function resetRuler(ruler) {
  try { ruler?.reset?.(); } catch (_e) {}
}

export function clearFoundryMovementTrailAggressive(token = null) {
  for (const t of (token ? [token] : Array.from(canvas?.tokens?.placeables ?? []))) {
    resetRuler(t?._ruler);
    resetRuler(t?._hoverRuler);
  }
  resetRuler(canvas?.controls?.ruler);
  setTimeout(() => clearFoundryMovementTrailAggressive(token), 20);
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
