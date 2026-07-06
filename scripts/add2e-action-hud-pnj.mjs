// scripts/add2e-action-hud-pnj.mjs
// ADD2E — Pont PNJ vers le HUD d'action déjà utilisé par les PJ et monstres.

const VERSION = "2026-07-06-pnj-hud-bridge-v2";
const PNJ_TYPE = "pnj";
const HUD_ID = "add2e-action-hud";
const INTERCEPTED_ACTIONS = new Set(["attack", "cast-spell", "roll-save", "roll-ability"]);

let refreshWrapped = false;
let openWrapped = false;
let scheduledActorId = null;
let scheduledTokenId = null;
let scheduleHandle = null;

function isPnj(actor) {
  return String(actor?.type ?? "").toLowerCase() === PNJ_TYPE;
}

function pnjRaceLabel(actor) {
  return String(
    actor?.system?.race
    ?? actor?.system?.details_race?.label
    ?? actor?.items?.find?.(item => item?.type === "race")?.name
    ?? "PNJ"
  ).trim() || "PNJ";
}

function pnjClassLabel(actor) {
  return String(
    actor?.system?.classe
    ?? actor?.system?.details_classe?.label
    ?? actor?.items?.find?.(item => item?.type === "classe")?.name
    ?? "PNJ"
  ).trim() || "PNJ";
}

function pnjHudView(actor) {
  const sourceSystem = actor?.system ?? {};
  const hudSystem = Object.create(sourceSystem);
  Object.defineProperties(hudSystem, {
    type: { value: pnjRaceLabel(actor), enumerable: true },
    taille: { value: pnjClassLabel(actor), enumerable: true },
    dv: { value: sourceSystem.niveau ?? "—", enumerable: true }
  });

  return new Proxy(actor, {
    get(target, property) {
      if (property === "type") return "monster";
      if (property === "system") return hudSystem;
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    }
  });
}

function tokenFor(actor, preferred = null) {
  if (preferred?.actor?.id === actor?.id) return preferred;
  return (canvas?.tokens?.controlled ?? []).find(token => token?.actor?.id === actor?.id)
    ?? actor?.getActiveTokens?.()?.[0]
    ?? null;
}

function clearPnjHudMarker(root = document.getElementById(HUD_ID)) {
  root?.removeAttribute?.("data-add2e-hud-pnj-actor-id");
  root?.removeAttribute?.("data-add2e-hud-pnj-token-id");
}

function activePnjActor() {
  const id = document.getElementById(HUD_ID)?.dataset?.add2eHudPnjActorId;
  return id ? game.actors?.get?.(id) ?? null : null;
}

function renderPnjHud(actor, token = null, { reason = "pnj" } = {}) {
  if (!game.user?.isGM || !isPnj(actor)) return false;
  const render = globalThis.add2eRenderActionHud;
  if (typeof render !== "function") return false;

  const resolvedToken = tokenFor(actor, token);
  const result = render(pnjHudView(actor), resolvedToken, { reason: `pnj:${reason}` });
  const root = document.getElementById(HUD_ID);
  if (root) {
    root.dataset.add2eHudPnjActorId = String(actor.id);
    root.dataset.add2eHudPnjTokenId = String(resolvedToken?.id ?? "");
    // Les PNJ n'ont pas de sacoche : les badges ne doivent pas suggérer
    // qu'un composant matériel est requis dans leur HUD.
    root.querySelectorAll?.(".component-title, .component-ok, .component-bad").forEach(element => element.remove());
  }
  return result;
}

function schedulePnjHud(actor, token = null, reason = "schedule", delay = 100) {
  if (!game.user?.isGM || !isPnj(actor)) return;
  scheduledActorId = actor.id;
  scheduledTokenId = token?.id ?? "";
  if (scheduleHandle) window.clearTimeout(scheduleHandle);
  scheduleHandle = window.setTimeout(() => {
    scheduleHandle = null;
    const scheduled = game.actors?.get?.(scheduledActorId) ?? null;
    const scheduledToken = scheduledTokenId ? canvas?.tokens?.get?.(scheduledTokenId) ?? null : null;
    if (scheduled) renderPnjHud(scheduled, scheduledToken, { reason });
  }, delay);
}

function combatantTarget(combat = game.combat) {
  if (!combat) return { actor: null, token: null };
  const currentId = combat.current?.combatantId ?? combat.combatantId ?? null;
  const combatant = (currentId ? combat.combatants?.get?.(currentId) : null)
    ?? combat.combatant
    ?? combat.turns?.[Number(combat.current?.turn ?? combat.turn)]
    ?? null;
  const token = combatant?.token?.object
    ?? (combatant?.tokenId ? canvas?.tokens?.get?.(combatant.tokenId) : null)
    ?? null;
  return { actor: combatant?.actor ?? token?.actor ?? null, token };
}

function refreshForCombat(combat) {
  const { actor, token } = combatantTarget(combat);
  if (isPnj(actor)) schedulePnjHud(actor, token, "combat", 120);
  else window.setTimeout(() => clearPnjHudMarker(), 140);
}

async function runPnjHudAction(event, button, actor) {
  const action = button.dataset.action;
  if (!INTERCEPTED_ACTIONS.has(action)) return false;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();

  if (action === "attack") {
    const arme = actor.items?.get?.(button.dataset.itemId) ?? null;
    if (!arme) return ui.notifications?.warn?.("Arme introuvable.");
    if (typeof globalThis.add2eAttackRoll !== "function") return ui.notifications?.error?.("Mécanique d'attaque indisponible.");
    await globalThis.add2eAttackRoll({ actor, arme });
  } else if (action === "cast-spell") {
    const sort = actor.items?.get?.(button.dataset.itemId) ?? null;
    if (!sort) return ui.notifications?.warn?.("Sort introuvable.");
    if (typeof globalThis.add2eCastSpell !== "function") return ui.notifications?.error?.("Mécanique de sorts indisponible.");
    await globalThis.add2eCastSpell({ actor, sort });
  } else if (action === "roll-save") {
    if (typeof globalThis.add2eRollSaveCard !== "function") return ui.notifications?.error?.("Mécanique de sauvegarde indisponible.");
    await globalThis.add2eRollSaveCard(actor, Number(button.dataset.saveIndex) || 0);
  } else if (action === "roll-ability") {
    if (typeof globalThis.add2eRollCharacteristicCard !== "function") return ui.notifications?.error?.("Mécanique de caractéristique indisponible.");
    await globalThis.add2eRollCharacteristicCard(actor, button.dataset.ability);
  }

  schedulePnjHud(actor, tokenFor(actor), `action:${action}`, 80);
  return true;
}

function bindPnjHudActionRelay() {
  if (document.__add2ePnjHudActionRelay === VERSION) return;
  document.__add2ePnjHudActionRelay = VERSION;
  document.addEventListener("click", event => {
    const button = event.target?.closest?.(`#${HUD_ID}[data-add2e-hud-pnj-actor-id] [data-action]`);
    if (!button) return;
    const actor = activePnjActor();
    if (!actor || !INTERCEPTED_ACTIONS.has(button.dataset.action)) return;
    runPnjHudAction(event, button, actor).catch(error => {
      console.error("[ADD2E][PNJ_HUD][ACTION]", { action: button.dataset.action, actor: actor.name, error });
      ui.notifications?.error?.("ADD2E HUD | Erreur d'action PNJ.");
    });
  }, true);
}

function wrapHudApi() {
  const api = game.add2e ?? (game.add2e = {});
  if (!openWrapped && typeof api.openActionHud === "function") {
    const open = api.openActionHud;
    api.openActionHud = actor => {
      if (isPnj(actor)) return renderPnjHud(actor, tokenFor(actor), { reason: "api-open" });
      clearPnjHudMarker();
      return open(actor);
    };
    api.openActionHud.__add2ePnjHudBridge = VERSION;
    openWrapped = true;
  }

  if (!refreshWrapped && typeof globalThis.add2eRefreshActionHud === "function") {
    const refresh = globalThis.add2eRefreshActionHud;
    globalThis.add2eRefreshActionHud = (...args) => {
      const actor = activePnjActor();
      return actor ? renderPnjHud(actor, tokenFor(actor), { reason: "api-refresh" }) : refresh(...args);
    };
    globalThis.add2eRefreshActionHud.__add2ePnjHudBridge = VERSION;
    refreshWrapped = true;
  }
}

function installPnjHudBridge() {
  wrapHudApi();
  bindPnjHudActionRelay();

  Hooks.on("controlToken", (token, controlled) => {
    if (!controlled) return;
    if (isPnj(token?.actor)) schedulePnjHud(token.actor, token, "control-token", 100);
    else window.setTimeout(() => clearPnjHudMarker(), 120);
  });
  Hooks.on("canvasReady", () => {
    const selected = (canvas?.tokens?.controlled ?? []).filter(token => isPnj(token?.actor));
    if (selected.length === 1) schedulePnjHud(selected[0].actor, selected[0], "canvas-ready", 140);
  });
  for (const hookName of ["updateCombat", "combatTurn", "combatRound"]) Hooks.on(hookName, refreshForCombat);
  Hooks.on("updateActor", actor => {
    if (isPnj(actor) && String(activePnjActor()?.id ?? "") === String(actor.id)) schedulePnjHud(actor, tokenFor(actor), "update-actor", 120);
  });
  for (const hookName of ["createItem", "updateItem", "deleteItem", "createActiveEffect", "updateActiveEffect", "deleteActiveEffect"]) {
    Hooks.on(hookName, document => {
      const actor = document?.parent;
      if (isPnj(actor) && String(activePnjActor()?.id ?? "") === String(actor.id)) schedulePnjHud(actor, tokenFor(actor), hookName, 120);
    });
  }

  game.add2e = game.add2e ?? {};
  game.add2e.pnjHudBridgeVersion = VERSION;
}

if (game?.ready) installPnjHudBridge();
else Hooks.once("ready", installPnjHudBridge);
