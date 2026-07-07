// ============================================================================
// ADD2E — Temps hors combat : acteurs et scènes.
// Compatible Foundry V13/V14/V15.
// ============================================================================
export const ADD2E_WORLD_TIME_ACTORS_VERSION = "2026-07-07-world-time-actors-v1";

export function add2eWorldTimeIsGM() {
  return game.user?.isGM === true;
}

export function add2eWorldTimeIsResponsibleGM() {
  if (!game.user?.isGM) return false;
  if (typeof game.user.isActiveGM === "boolean") return game.user.isActiveGM;
  return game.users?.activeGM?.id === game.user.id || !game.users?.activeGM;
}

export function add2eWorldTimeCollectionValues(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value.contents !== "undefined") return Array.from(value.contents ?? []);
  if (typeof value.values === "function") return Array.from(value.values());
  if (typeof value[Symbol.iterator] === "function" && typeof value !== "string") return Array.from(value);
  return [];
}

function actorScanKey(actor, sourceKey = "") {
  return actor?.uuid ?? actor?.id ?? sourceKey ?? actor?.name ?? foundry.utils.randomID();
}

function pushActor(out, seen, actor, source = "unknown", sourceKey = "") {
  if (!actor) return;
  const key = actorScanKey(actor, sourceKey);
  if (!key || seen.has(key)) return;
  seen.add(key);
  out.push({ actor, source });
}

function tokenActor(tokenLike) {
  return tokenLike?.actor ?? tokenLike?.document?.actor ?? tokenLike?.object?.actor ?? null;
}

function combatantActor(combatant) {
  return combatant?.actor ?? combatant?.token?.actor ?? combatant?.token?.document?.actor ?? null;
}

export function add2eWorldTimeAllActors() {
  const out = [];
  const seen = new Set();

  for (const actor of add2eWorldTimeCollectionValues(game.actors)) pushActor(out, seen, actor, "world-actor");
  for (const combatant of add2eWorldTimeCollectionValues(game.combat?.combatants)) {
    pushActor(out, seen, combatantActor(combatant), "combatant", combatant?.id ?? combatant?.tokenId ?? "");
  }
  for (const token of canvas?.tokens?.placeables ?? []) {
    pushActor(out, seen, tokenActor(token), "canvas-token", token?.document?.uuid ?? token?.id ?? "");
  }
  for (const tokenDoc of add2eWorldTimeCollectionValues(canvas?.scene?.tokens)) {
    pushActor(out, seen, tokenActor(tokenDoc), "active-scene-token", tokenDoc?.uuid ?? tokenDoc?.id ?? "");
  }
  for (const scene of add2eWorldTimeCollectionValues(game.scenes)) {
    for (const tokenDoc of add2eWorldTimeCollectionValues(scene?.tokens)) {
      pushActor(out, seen, tokenActor(tokenDoc), "scene-token", tokenDoc?.uuid ?? `${scene?.id ?? "scene"}.${tokenDoc?.id ?? "token"}`);
    }
  }

  return out;
}

export function add2eWorldTimeRenderOpenMonsterSheets(actor = null) {
  for (const app of Object.values(ui.windows ?? {})) {
    const sheetActor = app?.actor ?? app?.object ?? app?.document ?? null;
    if (!sheetActor || sheetActor.type !== "monster") continue;
    if (actor && sheetActor.id !== actor.id && sheetActor.uuid !== actor.uuid) continue;
    try { app.render(false); }
    catch (_err) {}
  }
}
