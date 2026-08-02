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
} from "../effects-engine/00-core.mjs";
import {
  installMovementTokenControl,
  validateTokenMovement,
  computeTokenMovementScale
} from "./17a-movement-token-control.mjs";

const recalculationTimers = new Map();
const MOVEMENT_DOMAINS = new Set(["movement", "encumbrance"]);
const ADD2E_ENCUMBRANCE_SETTINGS_VERSION = "2026-08-02-world-encumbrance-settings-v4";
const ADD2E_MOVEMENT_EFFECT_CONTEXT_VERSION = "2026-08-02-size-transformation-effect-context-v1";

const ITEM_MOVEMENT_FIELDS = Object.freeze([
  "system.mouvement", "system.movement", "system.vitesse", "system.vitesse_deplacement",
  "system.deplacement", "system.déplacement", "system.monkMove", "system.monkMovement", "system.baseMovement",
  "system.progression", "system.poids", "system.weight", "system.encombrement", "system.encumbrance",
  "system.poids_unite", "system.weightUnit", "system.poids_encombrement_po", "system.encumbrance_gp",
  "system.quantite", "system.quantity", "system.carried", "system.transporte", "system.transporté",
  "system.inInventory", "system.ignoreEncumbrance", "system.encumbranceExempt",
  "system.categorie", "system.category", "system.sousType", "system.subType", "system.subtype",
  "system.tags", "system.effectTags", "system.equipe", "system.equipee", "system.equipped",
  "system.porte", "system.portee", "system.porté", "system.worn", "flags.add2e.modifiers",
  "flags.add2e.tags", "flags.add2e.effectTags", "flags.add2e.carried", "flags.add2e.ignoreEncumbrance"
]);

const ACTOR_MOVEMENT_FIELDS = Object.freeze([
  "system.force", "system.force_base", "system.force_ex",
  "system.bonus_caracteristiques.force", "system.bonus_divers_caracteristiques.force",
  "system.taille", "system.size", "system.gabarit", "system.transformation", "system.forme", "system.form",
  "system.mouvement", "system.movement", "system.vitesse_deplacement",
  "flags.add2e.modifiers", "flags.add2e.size", "flags.add2e.transformation",
  "flags.add2e.environment", "flags.add2e.milieu", "flags.add2e.monnaie"
]);

const COMPUTED_MOVEMENT_SCALARS = Object.freeze([
  "system.movement",
  "system.vitesse_deplacement"
]);

globalThis.ADD2E_MOVE_XP_VERSION = ADD2E_MOVE_XP_VERSION;
globalThis.ADD2E_MOVEMENT_REFERENCE_POLICY_VERSION = "2026-07-31-preserve-actor-reference-v1";
globalThis.ADD2E_ENCUMBRANCE_SETTINGS_VERSION = ADD2E_ENCUMBRANCE_SETTINGS_VERSION;
globalThis.ADD2E_MOVEMENT_TERRAIN_POLICY_VERSION = "2026-08-02-terrain-out-of-scope-v1";
globalThis.ADD2E_MOVEMENT_EFFECT_CONTEXT_VERSION = ADD2E_MOVEMENT_EFFECT_CONTEXT_VERSION;

function actorTimerKey(actor) {
  return String(actor?.uuid ?? actor?.id ?? "");
}

function removeComputedMovementScalars(updates = {}) {
  for (const path of COMPUTED_MOVEMENT_SCALARS) delete updates[path];
  return updates;
}

function stripComputedMovementScalarsFromChanges(changes = {}) {
  for (const path of COMPUTED_MOVEMENT_SCALARS) {
    if (Object.prototype.hasOwnProperty.call(changes, path)) delete changes[path];
  }
  const system = changes?.system;
  if (system && typeof system === "object") {
    delete system.movement;
    delete system.vitesse_deplacement;
  }
  return changes;
}

function isComputedMovementWrite(options = {}) {
  if (options?.[ADD2E_MOVE_XP_INTERNAL]) return true;
  const reason = String(options?.add2eReason ?? "");
  return reason.startsWith("move-xp-recalc:") || reason === "move-xp-award";
}

async function recalcMovementMirror(actor, reason = "document-change") {
  if (!actor) return null;
  const result = movementUpdates(actor);
  const updates = removeComputedMovementScalars(changedUpdatePayload(actor, result.updates));
  if (!Object.keys(updates).length) return { ...result, updates, skipped: true };
  await actor.update(updates, {
    [ADD2E_MOVE_XP_INTERNAL]: true,
    add2eReason: `move-xp-recalc:movement:${reason}`,
    render: false
  });
  return { ...result, updates, skipped: false };
}

function queueMovementRecalc(actor, reason = "document-change") {
  if (!actor || actor.documentName !== "Actor" || actor.type !== "personnage") return;
  const key = actorTimerKey(actor);
  if (!key) return;
  const existing = recalculationTimers.get(key);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    recalculationTimers.delete(key);
    recalcMovementMirror(actor, reason)
      .catch(error => console.warn(`${ADD2E_MOVE_XP_TAG}[RECALC]`, { actor: actor.name, reason, error }));
  }, ADD2E_MOVE_XP_RECALC_DELAY_MS);
  recalculationTimers.set(key, timer);
}

function isPrimaryActiveGm() {
  if (!game.user?.isGM) return false;
  const activeGms = Array.from(game.users ?? [])
    .filter(user => user?.active && user?.isGM)
    .sort((left, right) => String(left.id ?? "").localeCompare(String(right.id ?? "")));
  return !activeGms.length || activeGms[0]?.id === game.user.id;
}

let worldSettingRecalcChain = Promise.resolve();

function queueAllMovementRecalcs(reason = "world-setting") {
  if (!isPrimaryActiveGm()) return;
  const actors = Array.from(game.actors ?? []).filter(actor => actor?.type === "personnage");
  worldSettingRecalcChain = worldSettingRecalcChain.then(async () => {
    for (const actor of actors) {
      try {
        await recalcMovementMirror(actor, reason);
      } catch (error) {
        console.warn(`${ADD2E_MOVE_XP_TAG}[SETTING_RECALC]`, { actor: actor.name, reason, error });
      }
      await new Promise(resolve => setTimeout(resolve, 25));
    }
  });
}

function readEncumbranceSettings() {
  const read = (key, fallback) => {
    try { return game.settings.get("add2e", key); }
    catch (_error) { return fallback; }
  };
  return {
    enabled: read("encumbranceEnabled", true) !== false,
    currencyWeight: read("encumbranceCurrencyWeight", false) === true,
    version: ADD2E_ENCUMBRANCE_SETTINGS_VERSION
  };
}

function registerAdd2eSetting(key, data) {
  const settings = globalThis.game?.settings;
  if (!settings?.register) return false;
  const fullKey = `add2e.${key}`;
  if (settings.settings?.has?.(fullKey)) return true;
  try {
    settings.register("add2e", key, data);
    return true;
  } catch (error) {
    console.error(`${ADD2E_MOVE_XP_TAG}[SETTING_REGISTER]`, { key: fullKey, error });
    return false;
  }
}

function registerMovementSettings() {
  const registered = [
    registerAdd2eSetting("xpAutoLevel", {
      name: "ADD2E — XP : niveau automatique",
      hint: "Quand l'XP atteint un seuil, le niveau est augmenté automatiquement.",
      scope: "world",
      config: true,
      type: Boolean,
      default: true
    }),
    registerAdd2eSetting("encumbranceEnabled", {
      name: "ADD2E — Gestion de l’encombrement",
      hint: "Applique le poids transporté aux déplacements ainsi que les pénalités d’attaque et de classe d’armure. Désactiver cette option neutralise uniquement l’encombrement ; les autres effets de mouvement restent actifs.",
      scope: "world",
      config: true,
      type: Boolean,
      default: true,
      onChange: () => queueAllMovementRecalcs("setting:encumbranceEnabled")
    }),
    registerAdd2eSetting("encumbranceCurrencyWeight", {
      name: "ADD2E — Compter la monnaie dans l’encombrement",
      hint: "Quand cette option est active, chaque pièce transportée compte pour une unité d’encombrement, quelle que soit sa valeur. Désactivée, la monnaie ne modifie pas les paliers de charge.",
      scope: "world",
      config: true,
      type: Boolean,
      default: false,
      onChange: () => queueAllMovementRecalcs("setting:encumbranceCurrencyWeight")
    }),
    registerAdd2eSetting("enforceTokenMovement", {
      name: "ADD2E — Contrôle canonique du déplacement",
      hint: "Clé de compatibilité interne. En combat, le contrôleur canonique est toujours actif et les dépassements des joueurs exigent une validation du MJ.",
      scope: "world",
      config: false,
      type: Boolean,
      default: true
    })
  ];

  const success = registered.every(Boolean);
  globalThis.ADD2E_ENCUMBRANCE_SETTINGS_REGISTERED = success;
  return success;
}

registerMovementSettings();
Hooks.once("init", registerMovementSettings);

function flattenedKeys(changes = {}) {
  const flattened = foundry.utils.flattenObject?.(changes) ?? changes;
  return Object.keys(flattened ?? {});
}

function changesTouchPaths(changes = {}, paths = []) {
  const keys = flattenedKeys(changes);
  return keys.some(key => paths.some(path => key === path || key.startsWith(`${path}.`) || path.startsWith(`${key}.`)));
}

function modifierEntries(document) {
  let raw = document?.flags?.add2e?.modifiers;
  if ((raw === undefined || raw === null) && typeof document?.getFlag === "function") {
    try { raw = document.getFlag("add2e", "modifiers"); }
    catch (_error) { raw = null; }
  }
  if (Array.isArray(raw)) return raw.filter(entry => entry && typeof entry === "object");
  if (raw && typeof raw === "object") return Object.values(raw).filter(entry => entry && typeof entry === "object");
  return [];
}

function documentHasMovementModifier(document) {
  return modifierEntries(document).some(modifier => MOVEMENT_DOMAINS.has(norm(modifier?.domain).replace(/_/g, "-")));
}

function itemHasWeightSource(item) {
  const system = item?.system ?? {};
  return ["poids", "weight", "encombrement", "encumbrance", "poids_encombrement_po", "encumbrance_gp"].some(key => {
    if (!Object.prototype.hasOwnProperty.call(system, key)) return false;
    const value = Number(system[key]);
    return Number.isFinite(value) ? value !== 0 : String(system[key] ?? "").trim() !== "";
  });
}

function itemCanAffectMovement(item, hookName, changes = {}, options = {}) {
  const actor = item?.parent;
  if (!actor || actor.documentName !== "Actor" || actor.type !== "personnage") return false;
  if (options?.add2eSpellSync || options?.add2eDropPurge || options?.add2eCompendiumTruth) return false;
  const type = String(item.type ?? "").toLowerCase();
  const structural = ["classe", "race"].includes(type);
  if (options?.add2eInternal && !structural) return false;
  if (structural) return true;
  if (documentHasMovementModifier(item) || itemHasWeightSource(item)) return true;
  if (hookName === "updateItem" && changesTouchPaths(changes, ITEM_MOVEMENT_FIELDS)) return true;
  return false;
}

function queueItemMovementRecalc(item, hookName, changes = {}, options = {}) {
  if (!itemCanAffectMovement(item, hookName, changes, options)) return;
  queueMovementRecalc(item.parent, `item:${hookName}`);
}

function effectActor(effect) {
  const parent = effect?.parent;
  if (parent?.documentName === "Actor") return parent;
  if (parent?.documentName === "Item" && parent.parent?.documentName === "Actor") return parent.parent;
  return null;
}

function effectHasStatus(effect) {
  const statuses = effect?.statuses;
  if (statuses instanceof Set && statuses.size > 0) return true;
  if (Array.isArray(statuses) && statuses.length > 0) return true;
  return Boolean(effect?.statusId || effect?.flags?.core?.statusId || effect?.flags?.add2e?.statusId || effect?.flags?.add2e?.vitalStatus);
}

function effectTagValues(effect) {
  const flags = effect?.flags?.add2e ?? {};
  const values = [];
  const append = raw => {
    if (raw === undefined || raw === null || raw === "") return;
    if (Array.isArray(raw)) {
      for (const entry of raw) append(entry);
      return;
    }
    if (raw instanceof Set) {
      for (const entry of raw) append(entry);
      return;
    }
    if (raw && typeof raw === "object") {
      for (const entry of Object.values(raw)) append(entry);
      return;
    }
    for (const entry of String(raw).split(/[,;|\n]+/g)) {
      const key = norm(entry);
      if (key) values.push(key);
    }
  };
  append(flags.tags);
  append(flags.effectTags);
  return values;
}

function effectHasMovementContext(effect) {
  const flags = effect?.flags?.add2e ?? {};
  if (flags.capabilityTransformation && typeof flags.capabilityTransformation === "object") return true;
  if (flags.movement && typeof flags.movement === "object") return true;
  return effectTagValues(effect).some(tag => (
    tag.startsWith("taille_")
    || tag.startsWith("forme_")
    || tag.startsWith("transformation_")
    || tag.startsWith("facteur_taille_")
    || tag.startsWith("mouvement_")
    || tag.startsWith("movement_")
    || tag.startsWith("encombrement_")
    || tag.startsWith("encumbrance_")
    || tag === "poids_augmente"
    || tag === "poids_reduit"
  ));
}

function effectTouchesMovement(effect, changes = {}) {
  if (documentHasMovementModifier(effect) || effectHasStatus(effect) || effectHasMovementContext(effect)) return true;
  if (changesTouchPaths(changes, [
    "flags.add2e.modifiers", "flags.add2e.capabilityTransformation", "flags.add2e.movement",
    "flags.add2e.tags", "flags.add2e.effectTags", "statuses", "disabled", "isSuppressed"
  ])) return true;
  const effectChanges = Array.isArray(effect?.changes) ? effect.changes : [];
  return effectChanges.some(change => {
    const key = String(change?.key ?? "");
    return ACTOR_MOVEMENT_FIELDS.some(path => key === path || key.startsWith(`${path}.`));
  });
}

function actorMovementSourceChanged(changes = {}) {
  return changesTouchPaths(changes, ACTOR_MOVEMENT_FIELDS);
}

function removeMovementUpdates(updates = {}) {
  for (const path of ["system.mouvement", ...COMPUTED_MOVEMENT_SCALARS]) delete updates[path];
  return updates;
}

Hooks.on("preUpdateActor", (actor, changes, options = {}) => {
  const computedMovementWrite = isComputedMovementWrite(options);
  if (computedMovementWrite) stripComputedMovementScalarsFromChanges(changes);
  if (options?.[ADD2E_MOVE_XP_INTERNAL] || options?.add2eInternal || !actor || actor.type !== "personnage") return true;

  const levelChanged = changedPath(actor, changes, "system.niveau");
  const xpChanged = changedPath(actor, changes, "system.xp");
  const movementChanged = ["system.mouvement.base", "system.movement", "system.vitesse_deplacement"]
    .some(path => changedPath(actor, changes, path));
  if (!levelChanged && !xpChanged && !movementChanged) return true;

  if (isMulticlassActor(actor) && (levelChanged || xpChanged)) {
    if (movementChanged) {
      const derived = changedUpdatePayload(actor, movementUpdates(actor).updates);
      removeMovementUpdates(derived);
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
  removeComputedMovementScalars(derived);
  if (actorMovementSourceChanged(changes)) removeMovementUpdates(derived);
  if (Object.keys(derived).length) foundry.utils.mergeObject(changes, foundry.utils.expandObject(derived), { inplace: true });
  options.add2eReason = `move-xp-preupdate:${mode}`;
  log("[ACTOR][PREUPDATE]", { actor: actor.name, mode, multiclass: result.multiclass === true, updates: derived });
  return true;
});

Hooks.on("updateActor", (actor, changes = {}, options = {}) => {
  if (options?.[ADD2E_MOVE_XP_INTERNAL] || options?.add2eInternal || actor?.type !== "personnage") return;
  if (actorMovementSourceChanged(changes)) queueMovementRecalc(actor, "actor-movement-source");
});

Hooks.on("createActiveEffect", (effect, options = {}) => {
  if (options?.[ADD2E_MOVE_XP_INTERNAL] || options?.add2eInternal || !effectTouchesMovement(effect)) return;
  const actor = effectActor(effect);
  if (actor?.type === "personnage") queueMovementRecalc(actor, "effect:create");
});
Hooks.on("updateActiveEffect", (effect, changes = {}, options = {}) => {
  if (options?.[ADD2E_MOVE_XP_INTERNAL] || options?.add2eInternal || !effectTouchesMovement(effect, changes)) return;
  const actor = effectActor(effect);
  if (actor?.type === "personnage") queueMovementRecalc(actor, "effect:update");
});
Hooks.on("deleteActiveEffect", (effect, options = {}) => {
  if (options?.[ADD2E_MOVE_XP_INTERNAL] || options?.add2eInternal || !effectTouchesMovement(effect)) return;
  const actor = effectActor(effect);
  if (actor?.type === "personnage") queueMovementRecalc(actor, "effect:delete");
});

Hooks.on("renderActorSheet", (sheet, html) => {
  if (sheet?.actor?.type !== "personnage" || isMulticlassActor(sheet.actor)) return;
  const root = html?.jquery ? html[0] : html;
  const levelField = [...root?.querySelectorAll?.(".a2e-field") ?? []]
    .find(field => norm(field.querySelector?.("label")?.textContent ?? "") === "niveau");
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

Hooks.on("createItem", (item, options = {}) => queueItemMovementRecalc(item, "createItem", {}, options));
Hooks.on("updateItem", (item, changes = {}, options = {}) => queueItemMovementRecalc(item, "updateItem", changes, options));
Hooks.on("deleteItem", (item, options = {}) => queueItemMovementRecalc(item, "deleteItem", {}, options));

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
globalThis.add2eGetEncumbranceSettings = readEncumbranceSettings;
