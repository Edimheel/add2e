// scripts/add2e-initiative-locks.mjs
// ADD2E — verrouillage hors tour, trace de mouvement et synchronisation HUD.

import { ADD2E_INITIATIVE_VERSION, TAG, initiativeState, escapeHtml } from "./add2e-initiative-constants.mjs";
import {
  currentCombatant,
  tokenFromCombatant,
  add2eCanActorWeaponAttackNow,
  add2eRecordWeaponAttack,
  add2eMultipleAttackHudStatus
} from "./add2e-initiative-order.mjs";

const ACTION_GLOBALS = ["add2eAttackRoll", "add2eCastSpell", "cast_spell", "add2eExecuteClassFeatureOnUse"];
const TOKEN_DRAG_METHODS = ["_onDragLeftStart", "_onDragLeftMove", "_onDragLeftDrop", "_onDragLeftCancel"];
const VADE_RETRO_CONTINUATION_CONTEXTS = "__ADD2E_VADE_RETRO_CONTINUATION_CONTEXTS";

function actorFromActionArgs(args) {
  const first = args?.[0] ?? null;
  if (first?.actor) return first.actor;
  if (first?.actorId) return game.actors?.get?.(first.actorId) ?? null;
  if (first?.token?.actor) return first.token.actor;
  if (first?.tokenId) return canvas?.tokens?.get?.(first.tokenId)?.actor ?? null;
  return canvas?.tokens?.controlled?.[0]?.actor ?? game.user?.character ?? null;
}

function weaponFromActionArgs(actor, args) {
  const first = args?.[0] ?? null;
  if (first?.arme) return first.arme;
  if (first?.weapon) return first.weapon;
  if (first?.item) return first.item;
  const itemId = first?.itemId ?? first?.armeId ?? first?.weaponId;
  return itemId && actor?.items?.get ? actor.items.get(itemId) : null;
}

function notifyWrongTurn(actor, combatant) {
  const now = Date.now();
  if (now - initiativeState.warningAt <= 900) return;
  initiativeState.warningAt = now;
  ui.notifications?.info?.(`${actor?.name ?? "Cet acteur"} ne peut pas agir. C'est le tour de ${combatant.name}.`);
}

export function canActorActNow(actor, { notify = false } = {}) {
  const combat = game.combat;
  if (!combat?.started || game.user?.isGM) return true;

  const currentRound = Number(combat.round ?? 0) || 0;
  const continuation = globalThis[VADE_RETRO_CONTINUATION_CONTEXTS]?.get?.(`${actor?.id ?? ""}:${combat.id ?? ""}`) ?? null;
  const vadeStates = actor?.getFlag?.("add2e", "vadeRetro") ?? actor?.flags?.add2e?.vadeRetro ?? {};
  const vadeState = vadeStates?.[combat.id] ?? null;
  const automaticVadeContinuation = continuation?.kind === "vade-retro-continuation"
    && String(continuation.actorId ?? "") === String(actor?.id ?? "")
    && String(continuation.combatId ?? "") === String(combat.id ?? "")
    && Number(continuation.round ?? NaN) === currentRound
    && String(continuation.initiatorUserId ?? "") === String(game.user?.id ?? "")
    && actor?.isOwner !== false
    && vadeState?.status === "pending"
    && Number(vadeState.lastRound ?? currentRound) < currentRound;
  if (automaticVadeContinuation) {
    console.log("[ADD2E][INIT][VADE_RETRO][AUTO_CONTINUATION_ALLOW]", {
      actor: actor?.name ?? null,
      actorId: actor?.id ?? null,
      combat: combat.id,
      round: currentRound,
      currentCombatant: currentCombatant(combat)?.name ?? null
    });
    return true;
  }

  const combatant = currentCombatant(combat);
  if (!combatant) return true;
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

async function executeLockedAction(name, original, context, args) {
  const actor = actorFromActionArgs(args);
  const weapon = name === "add2eAttackRoll" ? weaponFromActionArgs(actor, args) : null;
  if (!canActorActNow(actor, { notify: true })) return false;

  if (name === "add2eAttackRoll" && !add2eCanActorWeaponAttackNow(actor, { weapon, notify: true })) return false;

  const result = await original.apply(context, args);
  if (name === "add2eAttackRoll" && result === true) {
    await add2eRecordWeaponAttack(actor, { weapon, combat: game.combat });
  }
  return result;
}

function installActionLocksOnce() {
  for (const name of ACTION_GLOBALS) {
    const current = globalThis[name];
    if (typeof current !== "function" || current.__add2eLock === ADD2E_INITIATIVE_VERSION) continue;

    const wrapped = async function add2eActionLock(...args) {
      return executeLockedAction(name, current, this, args);
    };
    wrapped.__add2eLock = ADD2E_INITIATIVE_VERSION;
    wrapped.__add2eOriginal = current;
    globalThis[name] = wrapped;
  }
}

export function installActionLocks() {
  installActionLocksOnce();
  if (installActionLocks.__add2eScheduled === ADD2E_INITIATIVE_VERSION) return;
  installActionLocks.__add2eScheduled = ADD2E_INITIATIVE_VERSION;
  for (const delay of [100, 250, 750, 1500, 3000]) window.setTimeout(installActionLocksOnce, delay);
}

function resetRuler(ruler) {
  try { ruler?.reset?.(); } catch (_e) {}
}

function clearMovementTrailOnce(token = null) {
  for (const t of (token ? [token] : Array.from(canvas?.tokens?.placeables ?? []))) {
    resetRuler(t?._ruler);
    resetRuler(t?._hoverRuler);
  }
  resetRuler(canvas?.controls?.ruler);
}

export function clearFoundryMovementTrailAggressive(token = null) {
  clearMovementTrailOnce(token);
  setTimeout(() => clearMovementTrailOnce(token), 20);
  return true;
}

function installMultipleAttackHudStyle() {
  const styleId = "add2e-multiple-attack-hud-style";
  if (document.getElementById(styleId)) return;
  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `
    #add2e-action-hud .add2e-multiple-attack-banner{display:flex;align-items:center;gap:8px;margin:6px 8px;padding:7px 9px;border:1px solid rgba(217,191,115,.85);border-radius:9px;background:linear-gradient(180deg,rgba(111,32,26,.94),rgba(55,18,15,.94));color:#fff2bd;font-weight:900;box-shadow:0 2px 5px rgba(0,0,0,.35)}
    #add2e-action-hud .add2e-multiple-attack-banner .detail{font-size:.82em;font-weight:700;color:#f8df9d}
    #add2e-action-hud .add2e-multiple-attack-banner.used{opacity:.72;background:rgba(45,42,36,.86)}
  `;
  document.head.appendChild(style);
}

function renderMultipleAttackHudBanner(actor) {
  const root = document.getElementById("add2e-action-hud");
  if (!root) return false;
  installMultipleAttackHudStyle();
  root.querySelector(".add2e-multiple-attack-banner")?.remove?.();

  const status = add2eMultipleAttackHudStatus(actor, game.combat);
  if (!status) return false;
  const banner = document.createElement("div");
  banner.className = `add2e-multiple-attack-banner ${status.css ?? ""}`;
  banner.innerHTML = `<i class="fas fa-crosshairs"></i><div><div>${escapeHtml(status.label)}</div><div class="detail">${escapeHtml(status.detail)} — ${escapeHtml(status.ratio)}</div></div>`;
  const target = root.querySelector(".hud-body") ?? root.querySelector(".content") ?? root.firstElementChild ?? root;
  target.prepend(banner);
  return true;
}

export function syncActionHudToCombatant(combat = game.combat, { reason = "combat" } = {}) {
  if (!combat?.started || !document.getElementById("add2e-action-hud")) return false;
  const combatant = currentCombatant(combat);
  const actor = combatant?.actor ?? null;
  if (!actor || typeof globalThis.add2eRenderActionHud !== "function") return false;
  try {
    globalThis.add2eRenderActionHud(actor, tokenFromCombatant(combatant), { reason: `initiative-${reason}` });
    renderMultipleAttackHudBanner(actor);
    setTimeout(() => renderMultipleAttackHudBanner(actor), 40);
    return true;
  } catch (err) {
    console.warn(`${TAG}[HUD_FOLLOW][ERROR]`, err);
    return false;
  }
}

globalThis.add2eSyncActionHudToCombatant = syncActionHudToCombatant;
