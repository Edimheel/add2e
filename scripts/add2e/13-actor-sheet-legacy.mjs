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

const ADD2E_ABILITY_HUD_PRESENTATION_VERSION = "2026-08-09-canonical-ability-hud-v2";
const ADD2E_SHEET_LEVEL_PIPELINE_GUARD_VERSION = "2026-06-22-level-pipeline-v2";
globalThis.ADD2E_ABILITY_HUD_PRESENTATION_VERSION = ADD2E_ABILITY_HUD_PRESENTATION_VERSION;
globalThis.ADD2E_SHEET_LEVEL_PIPELINE_GUARD_VERSION = ADD2E_SHEET_LEVEL_PIPELINE_GUARD_VERSION;

const ADD2E_ABILITY_PRESENTATION = Object.freeze({
  force: Object.freeze({ key: "force", label: "Force", shortLabel: "FOR", icon: "fas fa-dumbbell" }),
  dexterite: Object.freeze({ key: "dexterite", label: "Dextérité", shortLabel: "DEX", icon: "fas fa-running" }),
  constitution: Object.freeze({ key: "constitution", label: "Constitution", shortLabel: "CON", icon: "fas fa-heartbeat" }),
  intelligence: Object.freeze({ key: "intelligence", label: "Intelligence", shortLabel: "INT", icon: "fas fa-brain" }),
  sagesse: Object.freeze({ key: "sagesse", label: "Sagesse", shortLabel: "SAG", icon: "fas fa-eye" }),
  charisme: Object.freeze({ key: "charisme", label: "Charisme", shortLabel: "CHA", icon: "fas fa-theater-masks" })
});

function add2eSigned(value) {
  const number = Number(value) || 0;
  return `${number >= 0 ? "+" : "−"}${Math.abs(number)}`;
}

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
  return ADD2E_ABILITY_PRESENTATION[add2eAbilityNormalize(value)] ?? null;
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
  return `${label} ${add2eSigned(value)}`;
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
          abilityCheckVersion: result.version ?? globalThis.ADD2E_ABILITY_CHECK_VERSION ?? null
        }
      }
    }
  };
  const preview = globalThis.add2eBuildChatCard(card);
  if (!String(preview ?? "").trim()) throw new Error("La carte de caractéristique ADD2E est vide.");
  return globalThis.add2eCreateChatCard(card);
}

function add2eInstallAbilityCheckPresentation() {
  const engine = add2eAbilityEngine();
  if (typeof engine?.resolveAbilityCheck !== "function" || typeof engine?.rollAbilityCheck !== "function") return false;

  globalThis.add2eRollCharacteristicCard = async (actor, ability, options = {}) => {
    const result = await engine.rollAbilityCheck(actor, ability, options);
    const chatMessage = await add2eCreateAbilityCheckCard(result, options);
    return chatMessage;
  };
  return true;
}

add2eInstallAbilityCheckPresentation();
Hooks.once("ready", add2eInstallAbilityCheckPresentation);

function add2eAbilityHudActor() {
  const state = globalThis.add2eHudCheck?.() ?? {};
  const actorId = String(state.actorId ?? "");
  return (canvas?.tokens?.controlled ?? []).find(token => String(token?.actor?.id ?? "") === actorId)?.actor
    ?? (canvas?.tokens?.placeables ?? []).find(token => String(token?.actor?.id ?? "") === actorId)?.actor
    ?? game.actors?.get?.(actorId)
    ?? game.user?.character
    ?? null;
}

function add2eRefreshAbilityHud() {
  const root = document.getElementById("add2e-action-hud");
  const actor = add2eAbilityHudActor();
  const engine = add2eAbilityEngine();
  if (!root || !actor || typeof engine?.resolveAbilityCheck !== "function") return false;

  for (const button of root.querySelectorAll("[data-section='caracs'] [data-action='roll-ability']")) {
    const definition = add2eAbilityDefinition(button.dataset.ability);
    const cell = button.closest(".cell");
    const valueRoot = cell?.querySelector("b");
    if (!definition || !cell || !valueRoot) continue;

    const resolved = engine.resolveAbilityCheck(actor, definition.key, {
      source: "action-hud-ability-display",
      consumer: "action-hud"
    });
    const applied = resolved.resolution?.applied ?? [];
    const details = applied.length ? applied.map(add2eAbilityModifier).join(" ; ") : "Aucun bonus ou malus";
    const signature = `${resolved.target}|${details}`;
    if (cell.dataset.add2eAbilitySignature === signature) continue;

    cell.dataset.add2eAbilitySignature = signature;
    cell.title = `${definition.label} ${resolved.target} · ${details}`;
    valueRoot.replaceChildren();
    const label = document.createElement("span");
    label.className = "add2e-hud-ability-label";
    label.textContent = definition.shortLabel;
    const value = document.createElement("strong");
    value.className = "add2e-hud-ability-value";
    value.textContent = String(resolved.target);
    valueRoot.append(label, value);
  }
  return true;
}

function add2eInstallAbilityHudPresentation() {
  if (!document.getElementById("add2e-ability-hud-style")) {
    const style = document.createElement("style");
    style.id = "add2e-ability-hud-style";
    style.textContent = `
#add2e-action-hud [data-section="caracs"] .grid{grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:8px}
#add2e-action-hud [data-section="caracs"] .cell{--ability-accent:#ffe08a;--ability-deep:rgba(82,58,19,.88);--ability-soft:rgba(255,224,138,.16);grid-template-columns:42px minmax(0,1fr);min-height:52px;padding:6px 9px;border-color:var(--ability-accent);background:linear-gradient(135deg,var(--ability-soft),rgba(255,255,255,.035) 58%,var(--ability-deep));box-shadow:inset 0 1px 0 rgba(255,255,255,.14),0 3px 10px rgba(0,0,0,.18)}
#add2e-action-hud [data-section="caracs"] .cell:nth-child(1){--ability-accent:#ff8b7d;--ability-deep:rgba(92,28,28,.9);--ability-soft:rgba(255,111,97,.2)}
#add2e-action-hud [data-section="caracs"] .cell:nth-child(2){--ability-accent:#73ddff;--ability-deep:rgba(21,67,86,.9);--ability-soft:rgba(74,205,255,.2)}
#add2e-action-hud [data-section="caracs"] .cell:nth-child(3){--ability-accent:#7ee7b7;--ability-deep:rgba(24,78,57,.9);--ability-soft:rgba(68,211,143,.2)}
#add2e-action-hud [data-section="caracs"] .cell:nth-child(4){--ability-accent:#c8a8ff;--ability-deep:rgba(60,38,96,.9);--ability-soft:rgba(177,129,255,.21)}
#add2e-action-hud [data-section="caracs"] .cell:nth-child(5){--ability-accent:#ffd166;--ability-deep:rgba(90,59,17,.9);--ability-soft:rgba(255,193,72,.2)}
#add2e-action-hud [data-section="caracs"] .cell:nth-child(6){--ability-accent:#ff9ed2;--ability-deep:rgba(91,35,70,.9);--ability-soft:rgba(255,126,196,.2)}
#add2e-action-hud [data-section="caracs"] .roll-icon{width:40px;height:40px;min-width:40px;border-color:var(--ability-accent);border-radius:12px;background:radial-gradient(circle at 35% 28%,rgba(255,255,255,.3),var(--ability-soft) 44%,rgba(0,0,0,.22));color:#fff8e7;box-shadow:0 3px 9px rgba(0,0,0,.26),inset 0 1px 0 rgba(255,255,255,.22)}
#add2e-action-hud [data-section="caracs"] .cell b{display:flex;align-items:baseline;justify-content:space-between;gap:8px;color:#fff9e8;font-size:.9rem}
#add2e-action-hud .add2e-hud-ability-label{font-weight:950;letter-spacing:.04em}
#add2e-action-hud .add2e-hud-ability-value{color:#fff;font-size:1.35rem;font-weight:1000;line-height:1;text-shadow:0 2px 4px rgba(0,0,0,.45)}
`;
    document.head.appendChild(style);
  }

  if (!globalThis.__add2eAbilityHudObserver) {
    let scheduled = false;
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(() => {
        scheduled = false;
        add2eRefreshAbilityHud();
      });
    };
    const observer = new MutationObserver(mutations => {
      if (mutations.some(mutation => mutation.target?.closest?.("#add2e-action-hud") || [...mutation.addedNodes].some(node => node?.id === "add2e-action-hud" || node?.querySelector?.("#add2e-action-hud")))) schedule();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    globalThis.__add2eAbilityHudObserver = observer;
  }

  add2eRefreshAbilityHud();
  return true;
}

if (game?.ready) add2eInstallAbilityHudPresentation();
else Hooks.once("ready", add2eInstallAbilityHudPresentation);

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
