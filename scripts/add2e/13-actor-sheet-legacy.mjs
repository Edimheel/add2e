// ADD2E — Point d’entrée de la feuille personnage ApplicationV2.
// Les anciens calculs monolithiques ont été supprimés ; chaque domaine est chargé
// par son module fonctionnel unique. Compatible Foundry V13/V14/V15.

import "./07b-arcane-documents.mjs";
import "./13a-actor-sheet-class.mjs";
import "./13b-actor-sheet-get-data.mjs";
import "./13b-actor-sheet-object-magic-postprocess.mjs";
import "./13c-actor-sheet-caracs-pv-tabs-render.mjs";
import "./13d-actor-sheet-listeners.mjs";
import "./13e-actor-sheet-drop.mjs";
import "./13e-actor-sheet-drop-compendium-resolver.mjs";
import "./13f-actor-sheet-registration.mjs";

const ADD2E_SHEET_LEVEL_PIPELINE_GUARD_VERSION = "2026-06-22-level-pipeline-v2";
globalThis.ADD2E_SHEET_LEVEL_PIPELINE_GUARD_VERSION = ADD2E_SHEET_LEVEL_PIPELINE_GUARD_VERSION;

function add2eLegacySameValue(left, right) {
  if (foundry?.utils?.deepEqual) return foundry.utils.deepEqual(left, right);
  return JSON.stringify(left) === JSON.stringify(right);
}

function add2eLegacySameScalar(left, right) {
  if (left === right) return true;
  const leftText = String(left ?? "").trim();
  const rightText = String(right ?? "").trim();
  if (leftText && rightText) {
    const leftNumber = Number(leftText);
    const rightNumber = Number(rightText);
    if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) return leftNumber === rightNumber;
  }
  return add2eLegacySameValue(left, right);
}

function add2eLegacyPruneUnchangedFormXp(actor, changes) {
  const system = changes?.system;
  if (!system || typeof system !== "object") return;
  if (!Object.prototype.hasOwnProperty.call(system, "xp")) return;
  if (add2eLegacySameScalar(system.xp, actor?.system?.xp)) delete system.xp;
}

function add2eLegacyFilterMoveXpRecalc(actor, changes, options) {
  const reason = options?.add2eReason;
  if (reason !== "move-xp-recalc:movement" && reason !== "move-xp-preupdate:movement") return null;
  const system = changes?.system;
  if (!system || typeof system !== "object") return false;

  const allowed = ["mouvement", "movement", "vitesse_deplacement"];
  const filtered = {};
  for (const key of allowed) {
    if (!Object.prototype.hasOwnProperty.call(system, key)) continue;
    if (!add2eLegacySameValue(system[key], actor?.system?.[key])) filtered[key] = system[key];
  }
  changes.system = filtered;
  return Object.keys(filtered).length > 0;
}

function add2eLegacyInstallActorUpdateGuards() {
  if (globalThis.__ADD2E_LEGACY_ACTOR_UPDATE_GUARDS__) return;
  globalThis.__ADD2E_LEGACY_ACTOR_UPDATE_GUARDS__ = true;

  Hooks.on("preUpdateActor", (actor, changes = {}, options = {}) => {
    if (actor?.type !== "personnage") return;
    add2eLegacyPruneUnchangedFormXp(actor, changes);
    const hasMoveChange = add2eLegacyFilterMoveXpRecalc(actor, changes, options);
    if (hasMoveChange === false) return false;
  });
}

add2eLegacyInstallActorUpdateGuards();
