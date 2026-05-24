/**
 * scripts/add2e.mjs
 * Point d'entrée ADD2E.
 * Fichier découpé en modules dans scripts/add2e/*.mjs.
 */
import "./add2e-initiative.mjs";
import "./add2e/00-legacy-global-helpers.mjs";
import "./add2e/spell-dialog-ui.mjs";
import "./add2e/item-sheet-registration.mjs";
import "./add2e/handlebars-helpers.mjs";
import "./add2e/character-sheet-templates.mjs";
import "./add2e/monster-sheet-capabilities.mjs";
import "./add2e/01-macros-base-caracs.mjs";
import "./add2e/02-spell-sync.mjs";
import "./add2e/02b-spell-sync-dedupe.mjs";
import "./add2e/03-equipment-rules.mjs";
import "./add2e/04-class-active-abilities.mjs";
import "./add2e/object-magic-powers.mjs";
import "./add2e/06-class-effects-thief.mjs";
import "./add2e/07-spellcasting-rules.mjs";
import "./add2e/09-race-class-drop.mjs";
import "./add2e/10-monk-rules.mjs";
import "./add2e/11-character-data-prep.mjs";
import "./add2e/12-carac-roller.mjs";
import "./add2e/13-actor-sheet-legacy.mjs";
import "./add2e/14-item-sheets.mjs";
import "./add2e/15-validation-sockets.mjs";
import "./add2e/16-preparation-display.mjs";
import "./add2e/17-movement-xp.mjs";
import "./add2e/18-token-state-overlay.mjs";
import "./add2e/19-action-hud-free-drag.mjs";
import "./add2e/20-session-xp.mjs";

// ADD2E — Règle de liaison des tokens
// Personnage = token lié ; Monstre = token non lié.
const ADD2E_TOKEN_LINK_RULE_VERSION = "2026-05-24-token-link-rule-v1";
globalThis.ADD2E_TOKEN_LINK_RULE_VERSION = ADD2E_TOKEN_LINK_RULE_VERSION;

function add2eTokenLinkDesiredForType(type) {
  const t = String(type ?? "").toLowerCase();
  if (t === "personnage") return true;
  if (t === "monster") return false;
  return null;
}

function add2eTokenLinkDesiredForActor(actor) {
  return add2eTokenLinkDesiredForType(actor?.type);
}

function add2eTokenLinkActorFromToken(tokenDoc) {
  return tokenDoc?.actor ?? game.actors?.get?.(tokenDoc?.actorId) ?? null;
}

function add2eTokenLinkApplySource(document, desired) {
  if (desired === null || desired === undefined || !document?.updateSource) return false;
  document.updateSource({ "prototypeToken.actorLink": desired });
  return true;
}

async function add2eEnforceActorPrototype(actor, { render = false } = {}) {
  const desired = add2eTokenLinkDesiredForActor(actor);
  if (desired === null || !actor?.update) return false;
  if (actor.prototypeToken?.actorLink === desired) return false;

  await actor.update(
    { "prototypeToken.actorLink": desired },
    { add2eReason: "token-link-rule-prototype", render }
  );
  return true;
}

function add2eTokenUpdateForRule(tokenDoc) {
  const baseActor = game.actors?.get?.(tokenDoc?.actorId) ?? tokenDoc?.actor ?? null;
  const desired = add2eTokenLinkDesiredForActor(baseActor);
  if (desired === null || tokenDoc?.actorLink === desired) return null;
  return { _id: tokenDoc.id, actorLink: desired };
}

async function add2eMigrateTokenLinkRule({ force = false } = {}) {
  if (!game.user?.isGM) return { skipped: "not-gm" };

  const settingKey = "tokenLinkRuleMigrationVersion";
  const current = game.settings.get("add2e", settingKey);
  if (!force && current === ADD2E_TOKEN_LINK_RULE_VERSION) {
    console.log("[ADD2E][TOKEN_LINK][MIGRATE][SKIP]", { version: ADD2E_TOKEN_LINK_RULE_VERSION });
    return { skipped: "already-done", version: ADD2E_TOKEN_LINK_RULE_VERSION };
  }

  const actorUpdates = [];
  for (const actor of game.actors ?? []) {
    const changed = await add2eEnforceActorPrototype(actor).catch(err => {
      console.warn("[ADD2E][TOKEN_LINK][ACTOR][ERROR]", actor?.name, err);
      return false;
    });
    if (changed) actorUpdates.push({ id: actor.id, name: actor.name, type: actor.type, actorLink: actor.prototypeToken?.actorLink });
  }

  const sceneUpdates = [];
  for (const scene of game.scenes ?? []) {
    const updates = [];
    for (const tokenDoc of scene.tokens ?? []) {
      const update = add2eTokenUpdateForRule(tokenDoc);
      if (update) updates.push(update);
    }
    if (!updates.length) continue;

    await scene.updateEmbeddedDocuments("Token", updates, { add2eReason: "token-link-rule-scene-migration" })
      .catch(err => console.warn("[ADD2E][TOKEN_LINK][SCENE][ERROR]", scene?.name, err));
    sceneUpdates.push({ id: scene.id, name: scene.name, count: updates.length });
  }

  await game.settings.set("add2e", settingKey, ADD2E_TOKEN_LINK_RULE_VERSION);
  const result = { version: ADD2E_TOKEN_LINK_RULE_VERSION, actorUpdates, sceneUpdates };
  console.log("[ADD2E][TOKEN_LINK][MIGRATE][DONE]", result);
  return result;
}

function add2eAuditTokenLinkRule() {
  const rows = [];
  for (const scene of game.scenes ?? []) {
    for (const tokenDoc of scene.tokens ?? []) {
      const actor = game.actors?.get?.(tokenDoc.actorId) ?? tokenDoc.actor;
      const desired = add2eTokenLinkDesiredForActor(actor);
      if (desired === null) continue;
      rows.push({
        scene: scene.name,
        token: tokenDoc.name,
        actor: actor?.name ?? tokenDoc.actorId,
        actorType: actor?.type,
        actorLink: tokenDoc.actorLink,
        expected: desired,
        ok: tokenDoc.actorLink === desired
      });
    }
  }
  console.table(rows);
  console.log("[ADD2E][TOKEN_LINK][AUDIT]", rows);
  return rows;
}

Hooks.once("init", () => {
  game.settings.register("add2e", "tokenLinkRuleMigrationVersion", {
    name: "ADD2E — Migration règle tokens liés/non liés",
    hint: "Version de migration appliquée : personnages liés, monstres non liés.",
    scope: "world",
    config: false,
    type: String,
    default: ""
  });
});

Hooks.on("preCreateActor", actor => {
  const desired = add2eTokenLinkDesiredForActor(actor);
  add2eTokenLinkApplySource(actor, desired);
  return true;
});

Hooks.on("createActor", actor => {
  if (!game.user?.isGM) return;
  add2eEnforceActorPrototype(actor).catch(err => console.warn("[ADD2E][TOKEN_LINK][CREATE_ACTOR][ERROR]", actor?.name, err));
});

Hooks.on("preCreateToken", tokenDoc => {
  const actor = add2eTokenLinkActorFromToken(tokenDoc);
  const desired = add2eTokenLinkDesiredForActor(actor);
  if (desired !== null && tokenDoc?.updateSource) tokenDoc.updateSource({ actorLink: desired });
  return true;
});

Hooks.on("preUpdateToken", (tokenDoc, changes) => {
  const actor = add2eTokenLinkActorFromToken(tokenDoc);
  const desired = add2eTokenLinkDesiredForActor(actor);
  if (desired === null) return true;

  const incoming = foundry.utils.hasProperty(changes, "actorLink")
    ? foundry.utils.getProperty(changes, "actorLink")
    : tokenDoc.actorLink;

  if (incoming !== desired) changes.actorLink = desired;
  return true;
});

Hooks.once("ready", () => {
  game.add2e = game.add2e ?? {};
  game.add2e.tokenLinkRuleVersion = ADD2E_TOKEN_LINK_RULE_VERSION;
  game.add2e.auditTokenLinkRule = add2eAuditTokenLinkRule;
  game.add2e.migrateTokenLinkRule = add2eMigrateTokenLinkRule;

  globalThis.add2eAuditTokenLinkRule = add2eAuditTokenLinkRule;
  globalThis.add2eMigrateTokenLinkRule = add2eMigrateTokenLinkRule;

  if (game.user?.isGM) {
    window.setTimeout(() => add2eMigrateTokenLinkRule().catch(err => console.warn("[ADD2E][TOKEN_LINK][MIGRATE][ERROR]", err)), 500);
  }
});

// ADD2E — HUD maison : suivi du combattant actif
// Pas de nouveau fichier : ce patch complète les scripts HUD existants chargés ci-dessus.
const ADD2E_ACTION_HUD_COMBAT_SYNC_VERSION = "2026-05-24-action-hud-combat-turn-sync-inline-v1";
globalThis.ADD2E_ACTION_HUD_COMBAT_SYNC_VERSION = ADD2E_ACTION_HUD_COMBAT_SYNC_VERSION;

function add2eCombatHudElement() {
  return document.getElementById("add2e-action-hud");
}

function add2eCombatHudCurrentCombatant(combat = game.combat) {
  if (!combat) return null;
  return combat.combatant ?? combat.combatants?.get?.(combat.current?.combatantId) ?? null;
}

function add2eCombatHudTokenFromCombatant(combatant) {
  if (!combatant) return null;
  try {
    if (combatant.token?.object) return combatant.token.object;
    if (combatant.tokenId && canvas?.tokens?.get) return canvas.tokens.get(combatant.tokenId) ?? null;
    if (combatant.token?.id && canvas?.tokens?.get) return canvas.tokens.get(combatant.token.id) ?? null;
  } catch (_err) {}
  return null;
}

function add2eCombatHudCanShowActor(actor) {
  if (!actor) return false;
  const type = String(actor.type ?? "").toLowerCase();
  if (type === "personnage") return game.user.isGM || actor.isOwner || actor.testUserPermission?.(game.user, "OWNER");
  if (type === "monster") return game.user.isGM;
  return false;
}

function add2eCombatHudFollowCurrent(combat = game.combat, { forceOpen = false } = {}) {
  const hudExists = !!add2eCombatHudElement();
  if (!forceOpen && !hudExists) return false;

  const combatant = add2eCombatHudCurrentCombatant(combat);
  const actor = combatant?.actor ?? null;
  if (!add2eCombatHudCanShowActor(actor)) {
    if (hudExists) globalThis.add2eCloseActionHud?.();
    return false;
  }

  if (typeof globalThis.add2eRenderActionHud !== "function") return false;
  globalThis.add2eRenderActionHud(actor, add2eCombatHudTokenFromCombatant(combatant));
  return true;
}

function add2eCombatHudScheduleFollow(combat = game.combat, options = {}) {
  window.setTimeout(() => add2eCombatHudFollowCurrent(combat, options), 80);
}

Hooks.on("updateCombat", (combat, changes) => {
  if (!foundry.utils.hasProperty(changes ?? {}, "turn") && !foundry.utils.hasProperty(changes ?? {}, "round")) return;
  add2eCombatHudScheduleFollow(combat);
});

Hooks.on("createCombatant", combatant => {
  if (combatant?.combat === game.combat) add2eCombatHudScheduleFollow(game.combat);
});

Hooks.on("deleteCombatant", combatant => {
  if (combatant?.combat === game.combat) add2eCombatHudScheduleFollow(game.combat);
});

Hooks.once("ready", () => {
  globalThis.add2eHudFollowCurrentCombatant = () => add2eCombatHudFollowCurrent(game.combat, { forceOpen: true });
  game.add2e = game.add2e ?? {};
  game.add2e.actionHudCombatSyncVersion = ADD2E_ACTION_HUD_COMBAT_SYNC_VERSION;
  game.add2e.followCurrentCombatantHud = globalThis.add2eHudFollowCurrentCombatant;
  console.log("[ADD2E][ACTION_HUD][COMBAT_SYNC]", ADD2E_ACTION_HUD_COMBAT_SYNC_VERSION);
});
