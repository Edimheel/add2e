// ADD2E — Compatibilité ancienne gestion d'états Mort / Inconscient
// Version : 2026-05-31-token-state-overlay-passive-v5
//
// La gestion active des états vitaux est centralisée dans :
// scripts/add2e-active-effects-expire.js
//
// Ce fichier ne crée plus d'ActiveEffect, n'appelle plus actor.toggleStatusEffect
// et ne déclenche plus de hook updateActor pour éviter les doubles synchronisations.
// Il conserve uniquement les noms globaux historiques pour éviter de casser les appels existants.

const ADD2E_TOKEN_STATE_OVERLAY_VERSION = "2026-05-31-token-state-overlay-passive-v5";
globalThis.ADD2E_TOKEN_STATE_OVERLAY_VERSION = ADD2E_TOKEN_STATE_OVERLAY_VERSION;
globalThis.ADD2E_TOKEN_STATUS_ICON_VERSION = ADD2E_TOKEN_STATE_OVERLAY_VERSION;

const ADD2E_STATUS_EFFECTS = {
  dead: {
    id: "dead",
    name: "Mort",
    img: "icons/svg/skull.svg",
    icon: "icons/svg/skull.svg",
    special: "DEFEATED"
  },
  unconscious: {
    id: "unconscious",
    name: "Inconscient",
    img: "icons/svg/daze.svg",
    icon: "icons/svg/daze.svg"
  }
};

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

  const type = String(actor.type ?? "").toLowerCase();
  if (type === "monster") return hp <= 0 ? "dead" : null;
  if (type === "personnage") {
    if (hp <= -11) return "dead";
    if (hp <= 0) return "unconscious";
  }

  return null;
}

async function add2eSyncActorHpStatus(actor, { reason = "legacy-token-state-overlay" } = {}) {
  if (!game.user?.isGM || !actor) return null;

  if (typeof globalThis.add2eSyncActorVitalStatus === "function") {
    await globalThis.add2eSyncActorVitalStatus(actor, { reason: `18-token-state-overlay:${reason}` });
  } else {
    console.warn("[ADD2E][TOKEN_STATE_OVERLAY][DELEGATE_MISSING] add2eSyncActorVitalStatus indisponible", {
      version: ADD2E_TOKEN_STATE_OVERLAY_VERSION,
      actor: actor.name,
      actorId: actor.id,
      reason
    });
  }

  return add2eActorHpState(actor);
}

function add2eRegisterHpStatusEffects() {
  if (typeof globalThis.add2eVitalRegisterStatusEffects === "function") {
    globalThis.add2eVitalRegisterStatusEffects();
  }
  return true;
}

function add2eRefreshTokenOverlay(token) {
  if (!token?.actor) return;
  add2eSyncActorHpStatus(token.actor, { reason: "refreshTokenOverlay" }).catch(() => null);
}

function add2eRefreshActorTokens(actor) {
  add2eSyncActorHpStatus(actor, { reason: "refreshActorTokens" }).catch(() => null);
}

Hooks.once("ready", add2eRegisterHpStatusEffects);

try { globalThis.ADD2E_STATUS_EFFECTS = ADD2E_STATUS_EFFECTS; } catch (_e) {}
try { globalThis.add2eRegisterHpStatusEffects = add2eRegisterHpStatusEffects; } catch (_e) {}
try { globalThis.add2eActorHpState = add2eActorHpState; } catch (_e) {}
try { globalThis.add2eSyncActorHpStatus = add2eSyncActorHpStatus; } catch (_e) {}
try { globalThis.add2eRefreshTokenOverlay = add2eRefreshTokenOverlay; } catch (_e) {}
try { globalThis.add2eRefreshActorTokens = add2eRefreshActorTokens; } catch (_e) {}
