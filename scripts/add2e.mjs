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
import "./add2e/17b-multiclass.mjs";
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

const ADD2E_VENDOR_PROJECTILE_GM_RELAY_VERSION = "2026-05-29-vendor-projectile-personnages-only-v2";
globalThis.ADD2E_VENDOR_PROJECTILE_GM_RELAY_VERSION = ADD2E_VENDOR_PROJECTILE_GM_RELAY_VERSION;

const ADD2E_PROJECTILE_GM_CONSUME_FIX_VERSION = "2026-05-29-projectile-consume-personnages-only-v2";
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

function add2eProjectileNormalizeType(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function add2eProjectileActorType(actor, payload = {}) {
  const candidates = [
    actor?.type,
    actor?._source?.type,
    actor?.baseActor?.type,
    actor?.document?.type,
    payload.actorType,
    payload.type
  ];
  for (const candidate of candidates) {
    const type = add2eProjectileNormalizeType(candidate);
    if (type) return type;
  }
  return "";
}

function add2eProjectileActorUsesInventory(actor, payload = {}) {
  return add2eProjectileActorType(actor, payload) === "personnage";
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

  if (!add2eProjectileActorUsesInventory(actor, payload)) {
    console.log("[ADD2E][GM-RELAY][consumeProjectile][SKIP_NON_PERSONNAGE]", { actor: actor.name, type: add2eProjectileActorType(actor, payload), payload });
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

  const actor = payload.actorUuid ? await fromUuid(payload.actorUuid).catch(() => null) : game.actors?.get?.(payload.actorId) ?? null;
  if (!add2eProjectileActorUsesInventory(actor, payload)) {
    console.log("[ADD2E][GM-RELAY][vendorRecordProjectileSpent][SKIP_NON_PERSONNAGE]", { actor: actor?.name ?? payload.actorName, type: add2eProjectileActorType(actor, payload), payload });
    return false;
  }

  const key = payload.itemId || payload.itemName;
  if (!key) return false;

  const requestId = payload.requestId ?? null;
  const seen = add2eVendorProjectileRequestSet();
  if (requestId && seen.has(requestId)) return true;

  const current = foundry.utils.deepClone(await combat.getFlag("add2e", "projectilesDepensesCombat") ?? {});
  current[payload.actorId] ??= {
    actorId: payload.actorId,
    actorName: payload.actorName ?? actor?.name ?? "Acteur",
    items: {}
  };
  current[payload.actorId].actorName = payload.actorName ?? actor?.name ?? current[payload.actorId].actorName;
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
  globalThis.add2eProjectileActorUsesInventory = add2eProjectileActorUsesInventory;
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
      if (!add2eProjectileActorUsesInventory(actor)) return originalUpdate.call(this, updateData, options, ...rest);
      const current = add2eProjectileFixQuantity(this);
      const incoming = Number(foundry.utils.getProperty(updateData, "system.quantite") ?? updateData?.system?.quantite ?? current);
      const quantity = Math.max(1, Math.floor(current - incoming) || 1);
      game.socket?.emit?.("system.add2e", {
        type: "ADD2E_GM_OPERATION",
        operation: "consumeProjectile",
        payload: {
          actorId: actor.id,
          actorUuid: actor.uuid,
          actorType: actor.type,
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

const ADD2E_MONSTER_SHEET_V2_RECOVERY_VERSION = "2026-05-28-monster-document-sheet-v2-recovery-v2";
globalThis.ADD2E_MONSTER_SHEET_V2_RECOVERY_VERSION = ADD2E_MONSTER_SHEET_V2_RECOVERY_VERSION;

function add2eMonsterSheetRecoveryGetBase() {
  const api = foundry?.applications?.api ?? {};
  const sheets = foundry?.applications?.sheets ?? {};
  const mixin = api.HandlebarsApplicationMixin;
  const base = sheets.ActorSheetV2 ?? sheets.DocumentSheetV2 ?? api.DocumentSheetV2;
  if (!mixin || !base) return null;
  return mixin(base);
}

function add2eMonsterSheetRecoveryMethod(name) {
  const method = globalThis.Add2eMonsterSheet?.prototype?.[name];
  return typeof method === "function" ? method : null;
}

function add2eMonsterSheetRecoveryElement(element) {
  return element?.jquery ? element[0] : element;
}

function add2eRegisterMonsterSheetDocumentV2Recovery() {
  if (globalThis.__ADD2E_MONSTER_SHEET_V2_RECOVERY_REGISTERED === ADD2E_MONSTER_SHEET_V2_RECOVERY_VERSION) return true;
  if (!globalThis.Add2eMonsterSheet?.prototype) return false;

  const Base = add2eMonsterSheetRecoveryGetBase();
  if (!Base) {
    console.warn("[ADD2E][MONSTER_SHEET][V2_RECOVERY] ActorSheetV2/DocumentSheetV2 indisponible.");
    return false;
  }

  class Add2eMonsterSheetDocumentV2 extends Base {
    static DEFAULT_OPTIONS = {
      id: "add2e-monster-sheet-{id}",
      classes: ["add2e", "sheet", "actor", "monster", "add2e-monster-document-v2"],
      tag: "section",
      window: { title: "ADD2e Descartes (FR) - Monstre", resizable: true },
      position: { width: 920, height: 900 },
      actions: {}
    };

    static PARTS = {
      main: { template: "systems/add2e/templates/actor/monster-sheet.hbs" }
    };

    get actor() { return this.document; }
    get object() { return this.document; }
    get title() { return this.actor?.name ?? super.title; }
    get editable() { return this.actor?.isOwner === true || game.user?.isGM === true; }
    get isEditable() { return this.editable; }

    async getData(...args) {
      const method = add2eMonsterSheetRecoveryMethod("getData");
      if (method) return method.apply(this, args);
      return {
        actor: this.actor,
        object: this.actor,
        document: this.actor,
        system: this.actor?.system ?? {},
        items: this.actor?.items ?? [],
        effects: this.actor?.effects ?? [],
        editable: this.editable,
        owner: this.actor?.isOwner ?? false,
        limited: this.actor?.limited ?? false,
        options: this.options ?? {}
      };
    }

    async _prepareContext(options = {}) {
      const context = await this.getData(options);
      context.actor = this.actor;
      context.object = this.actor;
      context.document = this.actor;
      context.system = this.actor?.system ?? {};
      context.items = this.actor?.items ?? [];
      context.effects = this.actor?.effects ?? [];
      context.editable = this.editable;
      context.owner = this.actor?.isOwner ?? false;
      context.limited = this.actor?.limited ?? false;
      context.options = this.options ?? {};
      return context;
    }

    async _preparePartContext(_partId, context, _options = {}) { return context; }

    async _onRender(context, options = {}) {
      await super._onRender?.(context, options);
      try { globalThis.add2eEnsureTokenHeaderControl?.(this); } catch (err) { console.warn("[ADD2E][MONSTER_SHEET][TOKEN_HEADER]", err); }
      try { globalThis.add2eBindApplicationV2Close?.(this); } catch (err) { console.warn("[ADD2E][MONSTER_SHEET][CLOSE]", err); }
      const root = add2eMonsterSheetRecoveryElement(this.element);
      const sheetRoot = root?.querySelector?.(".add2e-monster-readable-sheet") ?? root;
      if (sheetRoot) this.activateListeners(sheetRoot);
    }

    activateListeners(content) {
      const method = add2eMonsterSheetRecoveryMethod("activateListeners");
      if (method) return method.call(this, content);
    }

    _activateAutoSubmit(root) {
      const method = add2eMonsterSheetRecoveryMethod("_activateAutoSubmit");
      if (method) return method.call(this, root);
    }

    async _updateObject(event, formData) {
      const method = add2eMonsterSheetRecoveryMethod("_updateObject");
      if (method) return method.call(this, event, formData);
      const updateData = foundry.utils.flattenObject(formData ?? {});
      if (!updateData.name || String(updateData.name).trim() === "") updateData.name = this.actor?.name ?? "Monstre";
      return this.actor?.update?.(updateData);
    }

    _injectLayoutFix() {
      const method = add2eMonsterSheetRecoveryMethod("_injectLayoutFix");
      if (method) return method.call(this);
    }

    async _onEquipItem(item) {
      const method = add2eMonsterSheetRecoveryMethod("_onEquipItem");
      if (method) return method.call(this, item);
    }

    async _recalculerCA() {
      const method = add2eMonsterSheetRecoveryMethod("_recalculerCA");
      if (method) return method.call(this);
    }

    render(options = {}) {
      if (typeof options === "boolean") return super.render({ force: options });
      return super.render(options);
    }
  }

  foundry.documents.collections.Actors.registerSheet("add2e", Add2eMonsterSheetDocumentV2, {
    types: ["monster"],
    makeDefault: true,
    label: "ADD2e Descartes (FR) - Monstre V2"
  });

  globalThis.Add2eMonsterSheetDocumentV2 = Add2eMonsterSheetDocumentV2;
  globalThis.__ADD2E_MONSTER_SHEET_V2_RECOVERY_REGISTERED = ADD2E_MONSTER_SHEET_V2_RECOVERY_VERSION;
  console.log("[ADD2E][MONSTER_SHEET][V2_RECOVERY]", ADD2E_MONSTER_SHEET_V2_RECOVERY_VERSION);
  return true;
}

Hooks.once("init", () => add2eRegisterMonsterSheetDocumentV2Recovery());
Hooks.once("ready", () => add2eRegisterMonsterSheetDocumentV2Recovery());
