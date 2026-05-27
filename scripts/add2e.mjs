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
import "./add2e/12b-carac-roller-dialog-v2-fix.mjs";
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