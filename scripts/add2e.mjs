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

// ADD2E — neutralisation du contrôle legacy qui instancie ItemSheet V1 au démarrage.
function add2eRemoveLegacyClassSheetValidationHook() {
  const stores = [Hooks.events, Hooks._hooks].filter(Boolean);
  for (const store of stores) {
    const readyHooks = store.ready;
    if (!Array.isArray(readyHooks)) continue;

    for (let i = readyHooks.length - 1; i >= 0; i--) {
      const hook = readyHooks[i];
      const fn = hook?.fn ?? hook;
      if (typeof fn !== "function") continue;

      let source = "";
      try { source = Function.prototype.toString.call(fn); }
      catch (_e) { source = ""; }

      if (
        source.includes("Contrôle Item.classe") &&
        source.includes("exampleWorldClassSheet") &&
        source.includes("exampleEmbeddedClassSheet")
      ) {
        readyHooks.splice(i, 1);
      }
    }
  }
}

add2eRemoveLegacyClassSheetValidationHook();

// ADD2E — Feuille monstre : réenregistrement en vraie Document Sheet V2.
// Pourquoi ici : add2e.mjs est chargé avant monster-sheet.mjs. On importe explicitement
// l'export Add2eMonsterSheet après chargement, puis on le réenregistre sur
// ActorSheetV2/DocumentSheetV2 sans nouveau script ni modification de system.json.
const ADD2E_MONSTER_SHEET_DOCUMENT_V2_FIX_VERSION = "2026-05-24-monster-sheet-document-v2-reregister-v2-import";
globalThis.ADD2E_MONSTER_SHEET_DOCUMENT_V2_FIX_VERSION = ADD2E_MONSTER_SHEET_DOCUMENT_V2_FIX_VERSION;

function add2eMonsterSheetGetDocumentBase() {
  const appApi = foundry?.applications?.api ?? {};
  const sheetsApi = foundry?.applications?.sheets ?? {};
  const mixin = appApi.HandlebarsApplicationMixin;
  const base = sheetsApi.ActorSheetV2 ?? sheetsApi.DocumentSheetV2 ?? appApi.DocumentSheetV2;
  if (!mixin || !base) return null;
  return mixin(base);
}

async function add2eLoadOriginalMonsterSheetClass() {
  if (typeof globalThis.Add2eMonsterSheet === "function") return globalThis.Add2eMonsterSheet;
  try {
    const module = await import("./monster-sheet.mjs");
    if (typeof module?.Add2eMonsterSheet === "function") return module.Add2eMonsterSheet;
  } catch (err) {
    console.warn("[ADD2E][MONSTER_SHEET_V2_FIX][IMPORT_ERROR]", err);
  }
  if (typeof globalThis.Add2eMonsterSheet === "function") return globalThis.Add2eMonsterSheet;
  return null;
}

async function add2eRegisterMonsterDocumentSheetV2() {
  const OriginalMonsterSheet = await add2eLoadOriginalMonsterSheetClass();
  const MonsterSheetBase = add2eMonsterSheetGetDocumentBase();
  const ActorsCollection = foundry?.documents?.collections?.Actors;

  if (!OriginalMonsterSheet || !MonsterSheetBase || !ActorsCollection?.registerSheet) {
    console.warn("[ADD2E][MONSTER_SHEET_V2_FIX][SKIP] Base ou feuille monstre introuvable", {
      version: ADD2E_MONSTER_SHEET_DOCUMENT_V2_FIX_VERSION,
      hasOriginal: Boolean(OriginalMonsterSheet),
      hasBase: Boolean(MonsterSheetBase),
      hasRegister: Boolean(ActorsCollection?.registerSheet)
    });
    return false;
  }

  if (OriginalMonsterSheet.__add2eDocumentSheetV2 === true) return true;

  class Add2eMonsterDocumentSheetV2 extends MonsterSheetBase {
    static ADD2E_MONSTER_SHEET_DOCUMENT_V2_FIX_VERSION = ADD2E_MONSTER_SHEET_DOCUMENT_V2_FIX_VERSION;
    static DEFAULT_OPTIONS = {
      id: "add2e-monster-sheet-{id}",
      classes: ["add2e", "sheet", "actor", "monster", "add2e-monster-v2-document-sheet"],
      tag: "form",
      window: { title: "ADD2e Descartes (FR) - Monstre", resizable: true },
      position: { width: 720, height: 850 },
      form: {
        submitOnChange: true,
        closeOnSubmit: false,
        handler: Add2eMonsterDocumentSheetV2._add2eSubmitForm
      },
      actions: {}
    };

    static PARTS = {
      main: { template: "systems/add2e/templates/actor/monster-sheet.hbs" }
    };

    static async _add2eSubmitForm(event, form, formData) {
      const app = this;
      const actor = app?.actor ?? app?.document;
      if (!actor?.update) return;
      const expanded = foundry.utils.expandObject(formData?.object ?? {});
      const updateData = {};
      if (expanded.system) updateData.system = expanded.system;
      if (typeof expanded.name === "string" && expanded.name.trim()) updateData.name = expanded.name.trim();
      if (typeof expanded.img === "string") updateData.img = expanded.img;
      if (expanded.flags) updateData.flags = expanded.flags;
      if (Object.keys(updateData).length) await actor.update(updateData);
    }

    get actor() { return this.document; }
    get object() { return this.document; }
    get editable() { return this.document?.isOwner === true || game.user?.isGM === true; }

    async _prepareContext(options = {}) {
      const context = await this.getData(options);
      context.actor = this.document;
      context.object = this.document;
      context.document = this.document;
      context.system = this.document?.system ?? {};
      context.items = this.document?.items ?? [];
      context.effects = this.document?.effects ?? [];
      context.editable = this.editable;
      context.owner = this.document?.isOwner ?? false;
      context.limited = this.document?.limited ?? false;
      context.options = this.options ?? {};
      return context;
    }

    async _preparePartContext(_partId, context, _options = {}) { return context; }

    async _onRender(context, options = {}) {
      await super._onRender?.(context, options);
      const root = this.element;
      if (!root) return;
      try { this.activateListeners(root); }
      catch (err) { console.warn("[ADD2E][MONSTER_SHEET_V2_FIX][LISTENERS]", err); }
    }
  }

  for (const name of Object.getOwnPropertyNames(OriginalMonsterSheet.prototype)) {
    if (["constructor", "render", "_renderHTML", "_replaceHTML"].includes(name)) continue;
    const descriptor = Object.getOwnPropertyDescriptor(OriginalMonsterSheet.prototype, name);
    if (descriptor) Object.defineProperty(Add2eMonsterDocumentSheetV2.prototype, name, descriptor);
  }

  Add2eMonsterDocumentSheetV2.__add2eDocumentSheetV2 = true;
  Add2eMonsterDocumentSheetV2.__add2eOriginalMonsterSheet = OriginalMonsterSheet;

  try { ActorsCollection.unregisterSheet?.("add2e", OriginalMonsterSheet, { types: ["monster"] }); }
  catch (_err) {}

  ActorsCollection.registerSheet("add2e", Add2eMonsterDocumentSheetV2, {
    types: ["monster"],
    makeDefault: true,
    label: "ADD2e Descartes (FR) - Monstre"
  });

  for (const actor of game.actors ?? []) {
    if (actor?.type !== "monster") continue;
    try {
      if (actor._sheet) delete actor._sheet;
    } catch (_err) {
      try { actor._sheet = null; } catch (_e) {}
    }
  }

  globalThis.Add2eMonsterDocumentSheetV2 = Add2eMonsterDocumentSheetV2;
  game.add2e = game.add2e ?? {};
  game.add2e.monsterSheetDocumentV2FixVersion = ADD2E_MONSTER_SHEET_DOCUMENT_V2_FIX_VERSION;
  game.add2e.monsterSheetClass = Add2eMonsterDocumentSheetV2;

  console.log("[ADD2E][MONSTER_SHEET_V2_FIX][REGISTERED]", ADD2E_MONSTER_SHEET_DOCUMENT_V2_FIX_VERSION);
  return true;
}

Hooks.once("ready", () => window.setTimeout(() => add2eRegisterMonsterDocumentSheetV2().catch(err => console.error("[ADD2E][MONSTER_SHEET_V2_FIX][ERROR]", err)), 0));

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
  if (!force && current === ADD2E_TOKEN_LINK_RULE_VERSION) return { skipped: "already-done", version: ADD2E_TOKEN_LINK_RULE_VERSION };

  const actorUpdates = [];
  for (const actor of game.actors ?? []) {
    const changed = await add2eEnforceActorPrototype(actor).catch(() => false);
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

    await scene.updateEmbeddedDocuments("Token", updates, { add2eReason: "token-link-rule-scene-migration" }).catch(() => null);
    sceneUpdates.push({ id: scene.id, name: scene.name, count: updates.length });
  }

  await game.settings.set("add2e", settingKey, ADD2E_TOKEN_LINK_RULE_VERSION);
  return { version: ADD2E_TOKEN_LINK_RULE_VERSION, actorUpdates, sceneUpdates };
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
  add2eEnforceActorPrototype(actor).catch(() => null);
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

  if (game.user?.isGM) window.setTimeout(() => add2eMigrateTokenLinkRule().catch(() => null), 500);
});
