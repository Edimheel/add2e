// ADD2E — Point d’entrée mouvement, encombrement et XP.
// Les Items classe restent la seule source de progression multiclasses.
// Compatible Foundry V13/V14/V15 — ApplicationV2 / DialogV2.

import {
  ADD2E_MOVE_XP_VERSION,
  ADD2E_MOVE_XP_TAG,
  ADD2E_MOVE_XP_INTERNAL,
  ADD2E_MOVE_XP_RECALC_DELAY_MS,
  log,
  norm,
  sameValue,
  getPath,
  changedUpdatePayload,
  changeValue,
  changedPath,
  isMulticlassActor,
  computeXp,
  computeMovement,
  magicMovementRules,
  movementUpdates,
  flatActorUpdates,
  recalc,
  awardXp,
  promptXp,
  minXpForLevel
} from "./17a-movement-xp-domain.mjs";
import {
  installMovementTokenControl,
  validateTokenMovement,
  computeTokenMovementScale
} from "./17a-movement-token-control.mjs";

const recalculationTimers = new Map();

globalThis.ADD2E_MOVE_XP_VERSION = ADD2E_MOVE_XP_VERSION;

function actorTimerKey(actor) {
  return String(actor?.uuid ?? actor?.id ?? "");
}

function queueMovementRecalc(actor, reason = "document-change") {
  if (!actor || actor.documentName !== "Actor" || actor.type !== "personnage") return;
  const key = actorTimerKey(actor);
  if (!key) return;
  const existing = recalculationTimers.get(key);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    recalculationTimers.delete(key);
    recalc(actor, { mode: "movement" })
      .catch(error => console.warn(`${ADD2E_MOVE_XP_TAG}[RECALC]`, { actor: actor.name, reason, error }));
  }, ADD2E_MOVE_XP_RECALC_DELAY_MS);
  recalculationTimers.set(key, timer);
}

function itemCanAffectMovement(item, hookName, options = {}) {
  const actor = item?.parent;
  if (!actor || actor.documentName !== "Actor" || actor.type !== "personnage") return false;
  const type = String(item.type ?? "").toLowerCase();
  if (["sort", "spell"].includes(type)) return false;
  if (options?.add2eSpellSync || options?.add2eDropPurge || options?.add2eCompendiumTruth) return false;
  if (["classe", "race"].includes(type)) return !options?.add2eInternal || hookName === "createItem" || hookName === "updateItem";
  return !options?.add2eInternal;
}

function queueItemMovementRecalc(item, hookName, options = {}) {
  if (!itemCanAffectMovement(item, hookName, options)) return;
  queueMovementRecalc(item.parent, `item:${hookName}`);
}

function effectActor(effect) {
  const parent = effect?.parent;
  if (parent?.documentName === "Actor") return parent;
  if (parent?.documentName === "Item" && parent.parent?.documentName === "Actor") return parent.parent;
  return null;
}

function actorForceSourceChanged(changes = {}) {
  const flattened = foundry.utils.flattenObject?.(changes) ?? changes;
  const keys = Object.keys(flattened ?? {});
  return keys.some(key =>
    key === "system.force"
    || key === "system.force_base"
    || key === "system.force_ex"
    || key.startsWith("system.bonus_caracteristiques.force")
    || key.startsWith("system.bonus_divers_caracteristiques.force")
    || key.startsWith("flags.add2e.modifiers")
    || key.startsWith("flags.add2e.rules")
  );
}

function removeMovementUpdates(updates = {}) {
  for (const path of ["system.mouvement", "system.movement", "system.vitesse_deplacement"]) delete updates[path];
  return updates;
}

Hooks.once("init", () => {
  game.settings.register("add2e", "xpAutoLevel", {
    name: "ADD2E — XP : niveau automatique",
    hint: "Quand l'XP atteint un seuil, le niveau est augmenté automatiquement.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
  game.settings.register("add2e", "enforceTokenMovement", {
    name: "ADD2E — Contrôler le déplacement des tokens",
    hint: "Bloque les joueurs qui dépassent leur mouvement. Le MJ peut se déplacer librement, reçoit un avertissement et voit l'échelle vert / orange / rouge.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
});

Hooks.on("preUpdateActor", (actor, changes, options) => {
  if (options?.[ADD2E_MOVE_XP_INTERNAL] || options?.add2eInternal || !actor || actor.type !== "personnage") return true;
  const levelChanged = changedPath(actor, changes, "system.niveau");
  const xpChanged = changedPath(actor, changes, "system.xp");
  const movementChanged = [
    "system.mouvement.base",
    "system.vitesse_deplacement"
  ].some(path => changedPath(actor, changes, path));
  if (!levelChanged && !xpChanged && !movementChanged) return true;

  if (isMulticlassActor(actor) && (levelChanged || xpChanged)) {
    if (movementChanged) {
      const derived = changedUpdatePayload(actor, movementUpdates(actor).updates);
      if (Object.keys(derived).length) foundry.utils.mergeObject(changes, foundry.utils.expandObject(derived), { inplace: true });
    }
    return true;
  }

  const incoming = {};
  if (levelChanged) incoming["system.niveau"] = changeValue(changes, "system.niveau");
  if (xpChanged) incoming["system.xp"] = changeValue(changes, "system.xp");
  const mode = levelChanged && !xpChanged ? "level" : xpChanged ? "xp" : "movement";
  const result = flatActorUpdates(actor, { mode, incoming });
  const derived = changedUpdatePayload(actor, result.updates);
  if (actorForceSourceChanged(changes)) removeMovementUpdates(derived);
  if (Object.keys(derived).length) foundry.utils.mergeObject(changes, foundry.utils.expandObject(derived), { inplace: true });
  options.add2eReason = `move-xp-preupdate:${mode}`;
  log("[ACTOR][PREUPDATE]", { actor: actor.name, mode, multiclass: result.multiclass === true, updates: derived });
  return true;
});

Hooks.on("updateActor", (actor, changes = {}, options = {}) => {
  if (options?.[ADD2E_MOVE_XP_INTERNAL] || options?.add2eInternal || actor?.type !== "personnage") return;
  if (actorForceSourceChanged(changes)) queueMovementRecalc(actor, "actor-force-source");
});

Hooks.on("createActiveEffect", (effect, options = {}) => {
  if (options?.[ADD2E_MOVE_XP_INTERNAL]) return;
  const actor = effectActor(effect);
  if (actor?.type === "personnage") queueMovementRecalc(actor, "effect:create");
});
Hooks.on("updateActiveEffect", (effect, _changes = {}, options = {}) => {
  if (options?.[ADD2E_MOVE_XP_INTERNAL]) return;
  const actor = effectActor(effect);
  if (actor?.type === "personnage") queueMovementRecalc(actor, "effect:update");
});
Hooks.on("deleteActiveEffect", (effect, options = {}) => {
  if (options?.[ADD2E_MOVE_XP_INTERNAL]) return;
  const actor = effectActor(effect);
  if (actor?.type === "personnage") queueMovementRecalc(actor, "effect:delete");
});

Hooks.on("renderActorSheet", (sheet, html) => {
  if (sheet?.actor?.type !== "personnage" || isMulticlassActor(sheet.actor)) return;
  const root = html?.jquery ? html[0] : html;
  const levelField = [...root?.querySelectorAll?.(".a2e-field") ?? []].find(field => norm(field.querySelector?.("label")?.textContent ?? "") === "niveau");
  if (!root || root.querySelector("input[name='system.xp']") || !levelField) return;
  const field = document.createElement("div");
  field.className = "a2e-field a2e-xp-field";
  field.innerHTML = `<label>XP</label><div class="a2e-xp-inline" style="display:grid;grid-template-columns:minmax(0,1fr) 31px;gap:5px;align-items:center;"><input type="number" name="system.xp" value="${Number(sheet.actor.system?.xp ?? 0)}" min="0" step="1" title="${String(sheet.actor.system?.progression_xp ?? "").replace(/"/g, "&quot;")}"><button type="button" class="a2e-icon-btn" data-add2e-mx="xp" title="Ajouter de l'XP" style="height:29px;min-width:31px;padding:0;">+</button></div>`;
  levelField.insertAdjacentElement("afterend", field);
  field.querySelector("[data-add2e-mx='xp']")?.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    promptXp(sheet.actor);
  });
});

Hooks.on("renderAdd2eActorSheet", (sheet, html) => {
  if (sheet?.actor?.type !== "personnage" || isMulticlassActor(sheet.actor)) return;
  const root = html?.jquery ? html[0] : html;
  root?.querySelector?.("[data-add2e-mx='xp']")?.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    promptXp(sheet.actor);
  }, { once: true });
});

Hooks.on("createItem", (item, options = {}) => queueItemMovementRecalc(item, "createItem", options));
Hooks.on("updateItem", (item, _changes = {}, options = {}) => queueItemMovementRecalc(item, "updateItem", options));
Hooks.on("deleteItem", (item, options = {}) => queueItemMovementRecalc(item, "deleteItem", options));

installMovementTokenControl();

globalThis.add2eComputeXp = computeXp;
globalThis.add2eComputeMovement = computeMovement;
globalThis.add2eGetMagicMovementRules = magicMovementRules;
globalThis.add2eRecalcMoveXp = recalc;
globalThis.add2eAwardXp = awardXp;
globalThis.add2ePromptXp = promptXp;
globalThis.add2eMinXpForLevel = minXpForLevel;
globalThis.add2eValidateTokenMovement = validateTokenMovement;
globalThis.add2eComputeTokenMovementScale = computeTokenMovementScale;
