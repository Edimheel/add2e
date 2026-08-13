// =======================
//  HOOK UNIQUE updateActor
// =======================

const ADD2E_CHARACTER_DATA_PREP_VERSION = "2026-08-13-remove-parallel-roll-helpers-v8";
globalThis.ADD2E_CHARACTER_DATA_PREP_VERSION = ADD2E_CHARACTER_DATA_PREP_VERSION;

const ADD2E_CARAC_CHANGE_KEYS = Object.freeze([
  "force", "force_base", "force_ex",
  "dexterite", "dexterite_base",
  "constitution", "constitution_base",
  "intelligence", "intelligence_base",
  "sagesse", "sagesse_base",
  "charisme", "charisme_base"
]);

const ADD2E_CARAC_RECALC_REASONS = new Set([
  "ability-base-initialize",
  "ability-derived-recalculate"
]);

function add2eChangesTouchModifiers(changes = {}) {
  if (!changes || typeof changes !== "object") return false;
  if (Object.prototype.hasOwnProperty.call(changes, "flags.add2e.modifiers")) return true;
  if (Object.prototype.hasOwnProperty.call(changes, "flags.add2e.-=modifiers")) return true;
  if (foundry.utils.hasProperty(changes, "flags.add2e.modifiers")) return true;
  const nested = changes?.flags?.add2e;
  return Boolean(nested && typeof nested === "object" && (
    Object.prototype.hasOwnProperty.call(nested, "modifiers")
    || Object.prototype.hasOwnProperty.call(nested, "-=modifiers")
  ));
}

function add2eActorUpdateChangesCharacteristic(changes = {}) {
  const system = changes?.system && typeof changes.system === "object" ? changes.system : {};
  const systemChanged = ADD2E_CARAC_CHANGE_KEYS.some(key => {
    const path = `system.${key}`;
    return Object.prototype.hasOwnProperty.call(system, key)
      || Object.prototype.hasOwnProperty.call(changes, path)
      || foundry.utils.hasProperty(changes, path);
  });
  return systemChanged || add2eChangesTouchModifiers(changes);
}

function add2eActorUpdateChangesHitPoints(changes = {}) {
  return Object.prototype.hasOwnProperty.call(changes?.system ?? {}, "pdv")
    || Object.prototype.hasOwnProperty.call(changes ?? {}, "system.pdv")
    || foundry.utils.hasProperty(changes ?? {}, "system.pdv");
}

Hooks.on("updateActor", async (actor, changes = {}, options = {}, userId) => {
  if (options?._fromSync) return;

  const changeKeys = Object.keys(changes ?? {});
  if (changeKeys.length === 1 && changeKeys[0] === "_id") return;

  const caracChanged = actor?.type === "personnage" && add2eActorUpdateChangesCharacteristic(changes);
  const caracRecalculation = ADD2E_CARAC_RECALC_REASONS.has(String(options?.add2eReason ?? ""));

  // =====================================================
  // 0) Niveau : validation et consommateurs non-PV
  //    La synchronisation des sorts est déclenchée depuis l’Item classe,
  //    propriétaire canonique de la progression.
  // =====================================================
  if (changes?.system && Object.prototype.hasOwnProperty.call(changes.system, "niveau")) {
    const clamp = add2eClampLevelToClassMax(actor, changes.system.niveau, null, { notify: true });
    if (clamp.changed) {
      await actor.update({ "system.niveau": clamp.level }, { add2eInternal: true });
      changes.system.niveau = clamp.level;
    }

    try {
      await add2eSyncMonkUnarmedWeapon(actor);
    } catch (_e) {}
  }

  // =====================================================
  // 1) Recalcul des caractéristiques par le résolveur unique
  // =====================================================
  try {
    const skipCarac = (options?.add2eInternal && caracRecalculation)
      || options?.add2eHitPointResolution === true;
    if (caracChanged && !skipCarac && !ACTIVE_CARAC_AUTO.has(actor.id)) {
      ACTIVE_CARAC_AUTO.add(actor.id);
      try {
        if (typeof actor.sheet?.autoSetCaracAjustements === "function") {
          await actor.sheet.autoSetCaracAjustements();
        } else if (typeof actor.autoSetCaracAjustements === "function") {
          await actor.autoSetCaracAjustements();
        }
        if (actor.sheet?.rendered) actor.sheet.render(false);
      } finally {
        ACTIVE_CARAC_AUTO.delete(actor.id);
      }
    }
  } catch (_e) {}

  // =====================================================
  // 2) Synchronisation des états vitaux après modification des PV.
  //    Une mutation canonique initiée par ce MJ est déjà synchronisée par setHitPoints().
  //    Une mutation reçue d'un joueur doit en revanche être projetée par le MJ actif.
  // =====================================================
  try {
    const responsibleGM = game.user?.isGM && (!game.users?.activeGM || game.user.id === game.users.activeGM.id);
    const canonicalMutationFromThisGM = options?.add2eHitPointMutation === true
      && String(userId ?? "") === String(game.user?.id ?? "");
    const hitPointChangeRequiresVitalSync = add2eActorUpdateChangesHitPoints(changes)
      && !canonicalMutationFromThisGM;
    if (responsibleGM && hitPointChangeRequiresVitalSync) {
      if (typeof globalThis.add2eSyncActorVitalStatus !== "function") {
        throw new Error("Le synchroniseur canonique des états vitaux ADD2E est indisponible.");
      }
      await globalThis.add2eSyncActorVitalStatus(actor, {
        reason: options?.add2eHitPointMutation === true
          ? "11-character-data-prep:remote-canonical-hit-point-change"
          : "11-character-data-prep:manual-hit-point-change"
      });
    }
  } catch (error) {
    console.error("[ADD2E][CHARACTER_DATA_PREP][VITAL_STATUS]", { actor: actor?.name, error });
  }

  // =====================================================
  // 3) Synchronisation des tokens liés
  //    Pour les tokens liés, Foundry synchronise déjà.
  // =====================================================
  try {
    actor.getDependentTokens?.({ linked: true });
  } catch (_e) {}
});

async function majImageToken(actor, newImg) {
  if (!actor || typeof actor.update !== "function") return;
  await actor.update({
    img: newImg,
    "token.img": newImg,
    "prototypeToken.texture.src": newImg
  });
}

try { globalThis.majImageToken = majImageToken; } catch (_e) {}