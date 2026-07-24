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

const ADD2E_SAVE_CHAT_PRESENTATION_VERSION = "2026-07-24-save-chat-single-dsn-v2-compact";
const ADD2E_ABILITY_CHECK_VERSION = "2026-07-24-canonical-ability-check-v1";
const ADD2E_SHEET_LEVEL_PIPELINE_GUARD_VERSION = "2026-06-22-level-pipeline-v2";
globalThis.ADD2E_SAVE_CHAT_PRESENTATION_VERSION = ADD2E_SAVE_CHAT_PRESENTATION_VERSION;
globalThis.ADD2E_ABILITY_CHECK_VERSION = ADD2E_ABILITY_CHECK_VERSION;
globalThis.ADD2E_SHEET_LEVEL_PIPELINE_GUARD_VERSION = ADD2E_SHEET_LEVEL_PIPELINE_GUARD_VERSION;

const ADD2E_ABILITY_DEFINITIONS = Object.freeze({
  force: Object.freeze({ key: "force", label: "Force", shortLabel: "FOR", icon: "fas fa-dumbbell" }),
  dexterite: Object.freeze({ key: "dexterite", label: "Dextérité", shortLabel: "DEX", icon: "fas fa-running" }),
  constitution: Object.freeze({ key: "constitution", label: "Constitution", shortLabel: "CON", icon: "fas fa-heartbeat" }),
  intelligence: Object.freeze({ key: "intelligence", label: "Intelligence", shortLabel: "INT", icon: "fas fa-brain" }),
  sagesse: Object.freeze({ key: "sagesse", label: "Sagesse", shortLabel: "SAG", icon: "fas fa-eye" }),
  charisme: Object.freeze({ key: "charisme", label: "Charisme", shortLabel: "CHA", icon: "fas fa-theater-masks" })
});

function add2eSaveSigned(value) {
  const number = Number(value) || 0;
  return `${number >= 0 ? "+" : "−"}${Math.abs(number)}`;
}

function add2eSaveModifier(entry) {
  const modifier = entry?.modifier ?? entry;
  const label = String(modifier?.metadata?.label ?? modifier?.source?.name ?? "Modificateur").trim();
  const contribution = Number(entry?.contribution);
  const value = Number.isFinite(contribution) ? contribution : Number(modifier?.value) || 0;
  return `${label} ${add2eSaveSigned(value)}`;
}

async function add2eCreateClearSaveCard(result, options = {}) {
  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    throw new Error("Le constructeur commun des cartes ADD2E est indisponible.");
  }

  const actor = result.actor;
  const resolution = result.resolution;
  const d20 = Number(result.d20) || 0;
  const bonus = Number(result.bonus) || 0;
  const total = Number(result.total) || 0;
  const target = Number(result.target) || 0;
  const applied = resolution?.bonusResolution?.applied ?? [];
  const formula = bonus === 0 ? `${d20}` : `${d20} ${add2eSaveSigned(bonus)} = ${total}`;
  const status = result.success ? "RÉUSSITE" : "ÉCHEC";

  const card = {
    actor,
    title: `Jet de sauvegarde — ${resolution?.label ?? "Sauvegarde"} — ${status}`,
    icon: resolution?.definition?.icon ?? "fas fa-shield-halved",
    variant: result.success ? "success" : "failure",
    source: {
      name: actor?.name ?? "Acteur",
      img: actor?.img,
      type: "Jet de sauvegarde"
    },
    rows: [
      { label: "Jet", value: formula },
      {
        label: "Bonus / malus",
        value: applied.length ? applied.map(add2eSaveModifier).join(" ; ") : "Aucun"
      }
    ],
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor, token: options.targetToken ?? null }),
      rolls: result.roll ? [result.roll] : [],
      flags: {
        add2e: {
          saveRoll: true,
          saveType: resolution?.key ?? null,
          saveIndex: resolution?.index ?? null,
          saveTarget: target,
          saveBonus: bonus,
          saveTotal: total,
          saveSuccess: result.success === true,
          saveResolverVersion: result.version ?? globalThis.ADD2E_SAVE_RESOLVER_VERSION ?? null,
          saveChatPresentationVersion: ADD2E_SAVE_CHAT_PRESENTATION_VERSION
        }
      }
    }
  };

  const preview = globalThis.add2eBuildChatCard(card);
  if (!String(preview ?? "").trim()) throw new Error("La carte de sauvegarde ADD2E est vide.");
  return globalThis.add2eCreateChatCard(card);
}

function add2eInstallSaveChatPresentation() {
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine ?? null;
  if (!engine?.rollSavingThrow) return false;
  if (engine.__add2eSaveChatPresentationVersion === ADD2E_SAVE_CHAT_PRESENTATION_VERSION) return true;

  const canonicalRoll = engine.rollSavingThrow.bind(engine);
  engine.rollSavingThrow = async function rollSavingThrow(actor, saveType, options = {}) {
    const createChat = options?.createChat === true;
    const result = await canonicalRoll(actor, saveType, {
      ...(options ?? {}),
      createChat: false,
      showDice: false
    });
    if (!result?.ok || !createChat) return result;
    const chatMessage = await add2eCreateClearSaveCard(result, options);
    return { ...result, chatMessage };
  };

  engine.__add2eSaveChatPresentationVersion = ADD2E_SAVE_CHAT_PRESENTATION_VERSION;
  return true;
}

add2eInstallSaveChatPresentation();
Hooks.once("ready", add2eInstallSaveChatPresentation);

function add2eAbilityNormalize(value) {
  const key = String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
  return ({
    str: "force",
    strength: "force",
    dex: "dexterite",
    dexterity: "dexterite",
    con: "constitution",
    int: "intelligence",
    wis: "sagesse",
    wisdom: "sagesse",
    cha: "charisme",
    charisma: "charisme"
  })[key] ?? key;
}

function add2eAbilityEngine() {
  return globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine ?? null;
}

function add2eAbilityDefinition(value) {
  return ADD2E_ABILITY_DEFINITIONS[add2eAbilityNormalize(value)] ?? null;
}

function add2eAbilityModifier(entry) {
  const modifier = entry?.modifier ?? entry;
  const label = String(modifier?.metadata?.label ?? modifier?.source?.name ?? "Modificateur").trim();
  const operation = String(modifier?.operation ?? "add");
  const contribution = Number(entry?.contribution);
  const value = Number.isFinite(contribution) ? contribution : Number(modifier?.value) || 0;
  if (operation === "set") return `${label} → ${value}`;
  if (operation === "multiply") return `${label} ×${value}`;
  if (operation === "minmax") return `${label} (limite)`;
  return `${label} ${add2eSaveSigned(value)}`;
}

function add2eResolveAbilityCheck(actor, ability, context = {}) {
  if (!actor) throw new Error("Aucun acteur pour ce test de caractéristique.");
  const definition = add2eAbilityDefinition(ability);
  if (!definition) throw new Error(`Caractéristique inconnue : ${String(ability ?? "") || "vide"}`);
  const engine = add2eAbilityEngine();
  if (typeof engine?.resolveAbility !== "function") {
    throw new Error("Le résolveur canonique ADD2E de caractéristiques n’est pas disponible.");
  }
  const resolution = engine.resolveAbility(actor, definition.key, {
    ...context,
    type: context.type ?? "ability-check",
    source: context.source ?? "ability-check"
  });
  return {
    version: ADD2E_ABILITY_CHECK_VERSION,
    actor,
    definition,
    key: definition.key,
    label: definition.label,
    icon: definition.icon,
    base: Number(resolution?.base) || 0,
    target: Number(resolution?.total) || 0,
    resolution,
    context: { ...context }
  };
}

async function add2eCreateAbilityCheckCard(result, options = {}) {
  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    throw new Error("Le constructeur commun des cartes ADD2E est indisponible.");
  }
  const applied = result.resolution?.applied ?? [];
  const status = result.success ? "RÉUSSITE" : "ÉCHEC";
  const card = {
    actor: result.actor,
    title: `Test de ${result.label} — ${status}`,
    icon: result.icon,
    variant: result.success ? "success" : "failure",
    source: {
      name: result.actor?.name ?? "Acteur",
      img: result.actor?.img,
      type: "Test de caractéristique"
    },
    rows: [
      { label: "Jet", value: `${result.d20} / ${result.target}` },
      {
        label: "Bonus / malus",
        value: applied.length ? applied.map(add2eAbilityModifier).join(" ; ") : "Aucun"
      }
    ],
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor: result.actor, token: options.targetToken ?? null }),
      rolls: result.roll ? [result.roll] : [],
      flags: {
        add2e: {
          abilityRoll: true,
          ability: result.key,
          abilityBase: result.base,
          abilityTarget: result.target,
          abilityD20: result.d20,
          abilitySuccess: result.success === true,
          abilityCheckVersion: ADD2E_ABILITY_CHECK_VERSION
        }
      }
    }
  };
  const preview = globalThis.add2eBuildChatCard(card);
  if (!String(preview ?? "").trim()) throw new Error("La carte de caractéristique ADD2E est vide.");
  return globalThis.add2eCreateChatCard(card);
}

async function add2eCanonicalRollAbilityCheck(actor, ability, options = {}) {
  const resolved = add2eResolveAbilityCheck(actor, ability, options);
  const roll = new Roll("1d20");
  await roll.evaluate();
  const d20 = Number(roll.total) || 0;
  const success = d20 <= resolved.target;
  const result = {
    ...resolved,
    ok: true,
    roll,
    d20,
    total: d20,
    success
  };
  if (options.createChat === false) return result;
  const chatMessage = await add2eCreateAbilityCheckCard(result, options);
  return { ...result, chatMessage };
}

function add2eInstallAbilityCheckExecutor() {
  const engine = add2eAbilityEngine();
  if (!engine?.resolveAbility) return false;

  Object.defineProperties(engine, {
    resolveAbilityCheck: {
      configurable: true,
      writable: true,
      value(actor, ability, context = {}) {
        return add2eResolveAbilityCheck(actor, ability, context);
      }
    },
    rollAbilityCheck: {
      configurable: true,
      writable: true,
      async value(actor, ability, options = {}) {
        return add2eCanonicalRollAbilityCheck(actor, ability, options);
      }
    }
  });

  engine.__add2eAbilityCheckVersion = ADD2E_ABILITY_CHECK_VERSION;
  globalThis.add2eResolveAbilityCheck = (actor, ability, context = {}) =>
    add2eResolveAbilityCheck(actor, ability, context);
  globalThis.add2eRollAbilityCheck = async (actor, ability, options = {}) =>
    add2eCanonicalRollAbilityCheck(actor, ability, options);
  globalThis.add2eRollCharacteristicCard = async (actor, ability, options = {}) => {
    const result = await add2eCanonicalRollAbilityCheck(actor, ability, {
      ...options,
      createChat: true
    });
    return result.chatMessage;
  };
  return true;
}

add2eInstallAbilityCheckExecutor();
Hooks.once("ready", add2eInstallAbilityCheckExecutor);

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