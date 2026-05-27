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
import "./add2e/20-session-xp.mjs";
import "./add2e/21-consumables.mjs";

const ADD2E_DIALOG_V2_ALERT_FALLBACK_VERSION = "2026-05-26-dialog-v2-alert-fallback-v1";
globalThis.ADD2E_DIALOG_V2_ALERT_FALLBACK_VERSION = ADD2E_DIALOG_V2_ALERT_FALLBACK_VERSION;

function add2eInstallDialogV2AlertFallback() {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2 || typeof DialogV2.alert === "function" || typeof DialogV2.confirm !== "function") return false;

  DialogV2.alert = async function add2eDialogV2AlertFallback({ window = {}, content = "", ok = {}, modal = true } = {}) {
    return DialogV2.confirm({
      window,
      content,
      yes: { label: ok?.label || "Compris" },
      no: { label: "Fermer" },
      modal
    });
  };

  game.add2e = game.add2e ?? {};
  game.add2e.dialogV2AlertFallbackVersion = ADD2E_DIALOG_V2_ALERT_FALLBACK_VERSION;
  console.log("[ADD2E][DIALOG_V2][ALERT_FALLBACK]", ADD2E_DIALOG_V2_ALERT_FALLBACK_VERSION);
  return true;
}

Hooks.once("init", () => add2eInstallDialogV2AlertFallback());
Hooks.once("ready", () => add2eInstallDialogV2AlertFallback());

const ADD2E_VENDOR_PROJECTILE_GM_RELAY_VERSION = "2026-05-27-vendor-projectile-gm-operation-v1";
globalThis.ADD2E_VENDOR_PROJECTILE_GM_RELAY_VERSION = ADD2E_VENDOR_PROJECTILE_GM_RELAY_VERSION;

const ADD2E_PROJECTILE_GM_CONSUME_FIX_VERSION = "2026-05-27-projectile-consume-gm-operation-v1";
globalThis.ADD2E_PROJECTILE_GM_CONSUME_FIX_VERSION = ADD2E_PROJECTILE_GM_CONSUME_FIX_VERSION;

function add2eVendorProjectileIsResponsibleGM() {
  if (!game.user?.isGM) return false;
  if (typeof game.user.isActiveGM === "boolean") return game.user.isActiveGM;
  return game.users?.activeGM?.id === game.user.id || !game.users?.activeGM;
}

function add2eVendorProjectileRequestSet() {
  const set = globalThis.__ADD2E_VENDOR_PROJECTILE_GM_RELAY_REQUESTS ?? new Set();
  globalThis.__ADD2E_VENDOR_PROJECTILE_GM_RELAY_REQUESTS = set;
  return set;
}

function add2eProjectileFixQuantity(item) {
  const n = Number(item?.system?.quantite ?? item?.system?.quantity ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function add2eProjectileFixAmmoType(item) {
  const sys = item?.system ?? {};
  return String(sys.munitionType ?? sys.munition_type ?? sys.sousType ?? sys.sous_type ?? sys.categorie ?? item?.name ?? "");
}

async function add2eGmRelayConsumeProjectile(payload = {}) {
  if (!add2eVendorProjectileIsResponsibleGM()) return false;

  let actor = null;
  if (payload.actorUuid) {
    try { actor = await fromUuid(payload.actorUuid); }
    catch (err) { console.warn("[ADD2E][GM-RELAY][consumeProjectile][UUID_ERROR]", payload.actorUuid, err); }
  }
  if (!actor && payload.actorId) actor = game.actors?.get?.(payload.actorId) ?? null;

  if (!actor) {
    console.warn("[ADD2E][GM-RELAY][consumeProjectile] acteur introuvable :", payload);
    return false;
  }

  const item = actor.items?.get?.(payload.itemId) ?? null;
  if (!item) {
    console.warn("[ADD2E][GM-RELAY][consumeProjectile] projectile introuvable :", {
      actor: actor.name,
      itemId: payload.itemId,
      itemName: payload.itemName
    });
    return false;
  }

  const quantity = Math.max(1, Math.floor(Number(payload.quantity) || 1));
  const before = add2eProjectileFixQuantity(item);
  const after = Math.max(0, before - quantity);

  await item.update({ "system.quantite": after }, { add2eReason: "gm-relay-consume-projectile" });

  if (game.combat?.setFlag) {
    const registry = foundry.utils.deepClone(game.combat.getFlag("add2e", "projectilesDepenses") ?? {});
    const key = `${actor.id}.${item.id}`;
    registry[key] ??= {
      actorId: actor.id,
      actorName: actor.name,
      itemId: item.id,
      itemName: item.name,
      ammunitionType: add2eProjectileFixAmmoType(item),
      spent: 0,
      restoreRate: item.system?.recuperable === false ? 0 : Number(item.system?.taux_recuperation ?? 0.6),
      recoverable: item.system?.recuperable !== false
    };
    registry[key].spent = Number(registry[key].spent ?? 0) + quantity;
    registry[key].restoreRate = item.system?.recuperable === false ? 0 : Number(item.system?.taux_recuperation ?? 0.6);
    registry[key].recoverable = item.system?.recuperable !== false;
    await game.combat.setFlag("add2e", "projectilesDepenses", registry);
  }

  console.log("[ADD2E][GM-RELAY][consumeProjectile] OK", {
    actor: actor.name,
    projectile: item.name,
    before,
    after,
    quantity,
    requestId: payload.requestId ?? null
  });

  return true;
}

async function add2eVendorRecordProjectileSpent(payload = {}) {
  if (!add2eVendorProjectileIsResponsibleGM()) return false;
  const combat = game.combats?.get?.(payload.combatId) ?? game.combat;
  if (!combat?.getFlag || !combat?.setFlag || !payload.actorId) return false;

  const key = payload.itemId || payload.itemName;
  if (!key) return false;

  const requestId = payload.requestId ?? null;
  const seen = add2eVendorProjectileRequestSet();
  if (requestId && seen.has(requestId)) return true;

  const current = foundry.utils.deepClone(await combat.getFlag("add2e", "projectilesDepensesCombat") ?? {});
  current[payload.actorId] ??= {
    actorId: payload.actorId,
    actorName: payload.actorName ?? "Acteur",
    items: {}
  };
  current[payload.actorId].actorName = payload.actorName ?? current[payload.actorId].actorName;
  current[payload.actorId].items[key] ??= {
    itemId: payload.itemId ?? null,
    itemName: payload.itemName ?? "Projectile",
    img: payload.img ?? null,
    spent: 0
  };

  const entry = current[payload.actorId].items[key];
  entry.itemId = payload.itemId ?? entry.itemId ?? null;
  entry.itemName = payload.itemName ?? "Projectile";
  entry.img = payload.img ?? entry.img ?? null;
  entry.spent = Math.max(0, Math.floor(Number(entry.spent) || 0)) + Math.max(1, Math.floor(Number(payload.quantity) || 1));

  await combat.setFlag("add2e", "projectilesDepensesCombat", current);
  if (requestId) seen.add(requestId);

  console.log("[ADD2E][GM-RELAY][vendorRecordProjectileSpent]", {
    combat: combat.id,
    actorId: payload.actorId,
    item: entry.itemName,
    spent: entry.spent,
    requestId
  });
  return true;
}

function add2eRegisterVendorProjectileGmRelay() {
  if (globalThis.__ADD2E_VENDOR_PROJECTILE_GM_RELAY_REGISTERED) return;
  globalThis.__ADD2E_VENDOR_PROJECTILE_GM_RELAY_REGISTERED = true;

  game.socket?.on?.("system.add2e", data => {
    if (!data || data.type !== "ADD2E_GM_OPERATION") return;
    if (data.operation === "vendorRecordProjectileSpent") {
      add2eVendorRecordProjectileSpent(data.payload ?? {}).catch(err => console.warn("[ADD2E][GM-RELAY][vendorRecordProjectileSpent][ERROR]", err));
      return;
    }
    if (data.operation === "consumeProjectile") {
      add2eGmRelayConsumeProjectile(data.payload ?? {}).catch(err => console.warn("[ADD2E][GM-RELAY][consumeProjectile][ERROR]", err));
      return;
    }
  });

  game.add2e = game.add2e ?? {};
  game.add2e.vendorProjectileGmRelayVersion = ADD2E_VENDOR_PROJECTILE_GM_RELAY_VERSION;
  game.add2e.projectileGmConsumeFixVersion = ADD2E_PROJECTILE_GM_CONSUME_FIX_VERSION;
  globalThis.add2eGmRelayVendorRecordProjectileSpent = add2eVendorRecordProjectileSpent;
  globalThis.add2eGmRelayConsumeProjectile = add2eGmRelayConsumeProjectile;
  console.log("[ADD2E][GM-RELAY][VENDOR_PROJECTILES]", ADD2E_VENDOR_PROJECTILE_GM_RELAY_VERSION);
  console.log("[ADD2E][GM-RELAY][CONSUME_PROJECTILE]", ADD2E_PROJECTILE_GM_CONSUME_FIX_VERSION);
}

function add2eInstallProjectilePlayerUpdateRelay() {
  if (globalThis.__ADD2E_PROJECTILE_PLAYER_UPDATE_RELAY_INSTALLED) return;
  const ItemCls = globalThis.Item;
  if (!ItemCls?.prototype?.update) return;
  globalThis.__ADD2E_PROJECTILE_PLAYER_UPDATE_RELAY_INSTALLED = true;

  const originalUpdate = ItemCls.prototype.update;
  ItemCls.prototype.update = async function add2eProjectileUpdateRelay(updateData = {}, options = {}, ...rest) {
    const reason = String(options?.add2eReason ?? "");
    if (!game.user?.isGM && reason === "consume-projectile" && this.parent?.documentName === "Actor") {
      const actor = this.parent;
      const current = add2eProjectileFixQuantity(this);
      const incoming = Number(foundry.utils.getProperty(updateData, "system.quantite") ?? updateData?.system?.quantite ?? current);
      const quantity = Math.max(1, Math.floor(current - incoming) || 1);
      game.socket?.emit?.("system.add2e", {
        type: "ADD2E_GM_OPERATION",
        operation: "consumeProjectile",
        payload: {
          actorId: actor.id,
          actorUuid: actor.uuid,
          itemId: this.id,
          itemName: this.name,
          quantity,
          fromUserId: game.user.id,
          requestId: foundry.utils.randomID()
        }
      });
      console.log("[ADD2E][PROJECTILES][JOUEUR->GM][consumeProjectile]", {
        actor: actor.name,
        projectile: this.name,
        current,
        incoming,
        quantity
      });
      return this;
    }
    return originalUpdate.call(this, updateData, options, ...rest);
  };
}

Hooks.once("init", () => add2eInstallProjectilePlayerUpdateRelay());
Hooks.once("ready", () => {
  add2eRegisterVendorProjectileGmRelay();
  add2eInstallProjectilePlayerUpdateRelay();
});

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
      try { source = Function.prototype.toString.call(fn); } catch (_e) { source = ""; }
      if (source.includes("Contrôle Item.classe") && source.includes("exampleWorldClassSheet") && source.includes("exampleEmbeddedClassSheet")) readyHooks.splice(i, 1);
    }
  }
}
add2eRemoveLegacyClassSheetValidationHook();

const ADD2E_MONSTER_SHEET_DOCUMENT_V2_FIX_VERSION = "2026-05-24-monster-sheet-document-v2-tabs-size-v3";
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
      position: { width: 940, height: 920 },
      form: {
        submitOnChange: true,
        closeOnSubmit: false,
        handler: Add2eMonsterDocumentSheetV2._add2eSubmitForm
      },
      actions: {}
    };

    static PARTS = { main: { template: "systems/add2e/templates/actor/monster-sheet.hbs" } };

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

    _add2eMonsterRoot(root = this.element) {
      if (!root) return null;
      if (root.matches?.(".add2e-monster-readable-sheet")) return root;
      return root.querySelector?.(".add2e-monster-readable-sheet") ?? root;
    }

    _add2eMonsterCurrentTab(root) {
      return this._add2eMonsterActiveTab
        || root?.querySelector?.(".sheet-tabs .item.active")?.dataset?.tab
        || root?.querySelector?.(".tab.active")?.dataset?.tab
        || "combat";
    }

    _add2eMonsterActivateTab(root, tabName) {
      if (!root || !tabName) return;
      const tabButtons = root.querySelectorAll(".sheet-tabs .item[data-tab]");
      const tabPanels = root.querySelectorAll(".tab[data-tab]");
      if (!tabButtons.length || !tabPanels.length) return;
      tabButtons.forEach(t => t.classList.toggle("active", t.dataset.tab === tabName));
      tabPanels.forEach(p => p.classList.toggle("active", p.dataset.tab === tabName));
    }

    _add2eMonsterBindTabMemory(root) {
      if (!root || root.dataset.add2eMonsterTabMemory === "1") return;
      root.dataset.add2eMonsterTabMemory = "1";
      root.addEventListener("click", ev => {
        const tab = ev.target?.closest?.(".sheet-tabs .item[data-tab]");
        if (tab) this._add2eMonsterActiveTab = tab.dataset.tab || "combat";
        const effectControl = ev.target?.closest?.(".effect-control[data-action]");
        if (effectControl) this._add2eMonsterActiveTab = "effets";
      }, true);
    }

    _add2eMonsterEnsureSize() {
      if (!this.setPosition) return;
      const width = Math.min(Math.max(Number(this.position?.width) || 0, 940), Math.max(940, window.innerWidth - 80));
      const height = Math.min(Math.max(Number(this.position?.height) || 0, 920), Math.max(760, window.innerHeight - 80));
      if ((Number(this.position?.width) || 0) < width || (Number(this.position?.height) || 0) < height) this.setPosition({ width, height });
    }

    async _onRender(context, options = {}) {
      await super._onRender?.(context, options);
      const root = this.element;
      if (!root) return;
      const monsterRoot = this._add2eMonsterRoot(root);
      const activeTab = this._add2eMonsterCurrentTab(monsterRoot);
      try { this.activateListeners(root); }
      catch (err) { console.warn("[ADD2E][MONSTER_SHEET_V2_FIX][LISTENERS]", err); }
      this._add2eMonsterActiveTab = activeTab;
      this._add2eMonsterBindTabMemory(monsterRoot);
      this._add2eMonsterActivateTab(monsterRoot, activeTab);
      window.setTimeout(() => this._add2eMonsterEnsureSize(), 0);
    }
  }

  for (const name of Object.getOwnPropertyNames(OriginalMonsterSheet.prototype)) {
    if (["constructor", "render", "_renderHTML", "_replaceHTML"].includes(name)) continue;
    const descriptor = Object.getOwnPropertyDescriptor(OriginalMonsterSheet.prototype, name);
    if (descriptor) Object.defineProperty(Add2eMonsterDocumentSheetV2.prototype, name, descriptor);
  }

  Add2eMonsterDocumentSheetV2.__add2eDocumentSheetV2 = true;
  Add2eMonsterDocumentSheetV2.__add2eOriginalMonsterSheet = OriginalMonsterSheet;
  try { ActorsCollection.unregisterSheet?.("add2e", OriginalMonsterSheet, { types: ["monster"] }); } catch (_err) {}
  ActorsCollection.registerSheet("add2e", Add2eMonsterDocumentSheetV2, {
    types: ["monster"],
    makeDefault: true,
    label: "ADD2e Descartes (FR) - Monstre"
  });

  for (const actor of game.actors ?? []) {
    if (actor?.type !== "monster") continue;
    try { if (actor._sheet) delete actor._sheet; }
    catch (_err) { try { actor._sheet = null; } catch (_e) {} }
  }

  globalThis.Add2eMonsterDocumentSheetV2 = Add2eMonsterDocumentSheetV2;
  game.add2e = game.add2e ?? {};
  game.add2e.monsterSheetDocumentV2FixVersion = ADD2E_MONSTER_SHEET_DOCUMENT_V2_FIX_VERSION;
  game.add2e.monsterSheetClass = Add2eMonsterDocumentSheetV2;
  console.log("[ADD2E][MONSTER_SHEET_V2_FIX][REGISTERED]", ADD2E_MONSTER_SHEET_DOCUMENT_V2_FIX_VERSION);
  return true;
}

Hooks.once("ready", () => window.setTimeout(() => add2eRegisterMonsterDocumentSheetV2().catch(err => console.error("[ADD2E][MONSTER_SHEET_V2_FIX][ERROR]", err)), 0));

const ADD2E_TOKEN_LINK_RULE_VERSION = "2026-05-24-token-link-rule-v1";
globalThis.ADD2E_TOKEN_LINK_RULE_VERSION = ADD2E_TOKEN_LINK_RULE_VERSION;

function add2eTokenLinkDesiredForType(type) {
  const t = String(type ?? "").toLowerCase();
  if (t === "personnage") return true;
  if (t === "monster") return false;
  return null;
}
function add2eTokenLinkDesiredForActor(actor) { return add2eTokenLinkDesiredForType(actor?.type); }
function add2eTokenLinkActorFromToken(tokenDoc) { return tokenDoc?.actor ?? game.actors?.get?.(tokenDoc?.actorId) ?? null; }
function add2eTokenLinkApplySource(document, desired) { if (desired === null || desired === undefined || !document?.updateSource) return false; document.updateSource({ "prototypeToken.actorLink": desired }); return true; }
async function add2eEnforceActorPrototype(actor, { render = false } = {}) {
  const desired = add2eTokenLinkDesiredForActor(actor);
  if (desired === null || !actor?.update) return false;
  if (actor.prototypeToken?.actorLink === desired) return false;
  await actor.update({ "prototypeToken.actorLink": desired }, { add2eReason: "token-link-rule-prototype", render });
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
      rows.push({ scene: scene.name, token: tokenDoc.name, actor: actor?.name ?? tokenDoc.actorId, actorType: actor?.type, actorLink: tokenDoc.actorLink, expected: desired, ok: tokenDoc.actorLink === desired });
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

  game.settings.register("add2e", "gestionComposantsSorts", {
    name: "Gestion des composants de sorts",
    hint: "Consomme les composants matériels lors du lancement des sorts lorsque les sorts et la sacoche sont renseignés.",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });

  game.settings.register("add2e", "gestionProjectiles", {
    name: "Gestion des projectiles",
    hint: "Consomme les flèches, carreaux, billes et autres munitions équipées dans le carquois lors des attaques à distance.",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });
});
Hooks.on("preCreateActor", actor => { const desired = add2eTokenLinkDesiredForActor(actor); add2eTokenLinkApplySource(actor, desired); return true; });
Hooks.on("createActor", actor => { if (!game.user?.isGM) return; add2eEnforceActorPrototype(actor).catch(() => null); });
Hooks.on("preCreateToken", tokenDoc => { const actor = add2eTokenLinkActorFromToken(tokenDoc); const desired = add2eTokenLinkDesiredForActor(actor); if (desired !== null && tokenDoc?.updateSource) tokenDoc.updateSource({ actorLink: desired }); return true; });
Hooks.on("preUpdateToken", (tokenDoc, changes) => {
  const actor = add2eTokenLinkActorFromToken(tokenDoc);
  const desired = add2eTokenLinkDesiredForActor(actor);
  if (desired === null) return true;
  const incoming = foundry.utils.hasProperty(changes, "actorLink") ? foundry.utils.getProperty(changes, "actorLink") : tokenDoc.actorLink;
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