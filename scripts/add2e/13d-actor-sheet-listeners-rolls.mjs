// ADD2E — Présentation et délégation des jets de feuille/HUD.
// Aucun calcul métier de caractéristique ou de sauvegarde ne vit dans ce module.
// Compatible Foundry V13/V14/V15.

export const ADD2E_SHEET_ROLL_DELEGATION_VERSION = "2026-08-09-canonical-roll-consumer-v10";

export async function add2eEvaluateRollSafe(formula) {
  const roll = new Roll(String(formula || "0"));
  await roll.evaluate();
  return roll;
}

function add2eSheetRollEffectsEngine() {
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine ?? null;
  if (!engine) throw new Error("Le moteur d’effets canonique ADD2E n’est pas disponible.");
  return engine;
}

function add2eRequireCanonicalRollContracts(engine) {
  const missing = [
    "resolveSavingThrow",
    "rollSavingThrow",
    "rollActionSave",
    "resolveAbilityCheck",
    "rollAbilityCheck"
  ].filter(name => typeof engine?.[name] !== "function");
  if (missing.length) {
    throw new Error(`API canonique ADD2E de jets indisponible : ${missing.join(", ")}.`);
  }
  if (typeof globalThis.add2eResolveSavingThrow !== "function"
    || typeof globalThis.add2eRollSavingThrow !== "function"
    || typeof globalThis.add2eGetSaveTarget !== "function") {
    throw new Error("Les globals canoniques ADD2E de sauvegarde ne sont pas installés par le moteur de défense.");
  }
  return engine;
}

function add2eSigned(value) {
  const number = Number(value) || 0;
  return `${number >= 0 ? "+" : "−"}${Math.abs(number)}`;
}

function add2eModifierLabel(entry) {
  const modifier = entry?.modifier ?? entry;
  const label = String(modifier?.metadata?.label ?? modifier?.source?.name ?? "Modificateur").trim();
  const contribution = Number(entry?.contribution);
  const operation = String(modifier?.operation ?? "add");
  const value = Number.isFinite(contribution) ? contribution : Number(modifier?.value) || 0;
  if (operation === "set") return `${label} → ${value}`;
  if (operation === "multiply") return `${label} ×${value}`;
  if (operation === "minmax") return `${label} (limite)`;
  return `${label} ${add2eSigned(value)}`;
}

function add2eSaveSourceLabel(resolution) {
  const selected = resolution?.targetResolution?.selected;
  if (selected?.kind === "class") {
    return [selected.className, selected.classLevel ? `niveau ${selected.classLevel}` : ""]
      .filter(Boolean)
      .join(" · ");
  }
  return selected?.name ?? "Valeur canonique";
}

function add2eRequireChatCardApi() {
  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    throw new Error("Le constructeur commun des cartes de chat ADD2E n’est pas disponible.");
  }
}

async function add2eCreateSavingThrowCard(result, options = {}) {
  add2eRequireChatCardApi();
  const actor = result.actor;
  const resolution = result.resolution;
  const applied = resolution?.bonusResolution?.applied ?? [];
  const d20 = Number(result.d20) || 0;
  const bonus = Number(result.bonus) || 0;
  const total = Number(result.total) || 0;
  const target = Number(result.target) || 0;
  const formula = bonus === 0 ? `${d20}` : `${d20} ${add2eSigned(bonus)} = ${total}`;
  const status = result.success ? "RÉUSSITE" : "ÉCHEC";

  const card = {
    actor,
    title: `Jet de sauvegarde — ${resolution?.label ?? "Sauvegarde"} — ${status}`,
    icon: resolution?.definition?.icon ?? "fas fa-shield-halved",
    variant: result.success ? "success" : "failure",
    source: {
      name: actor?.name ?? "Acteur",
      img: actor?.img,
      type: "Jet de sauvegarde",
      meta: add2eSaveSourceLabel(resolution)
    },
    rows: [
      { label: "Seuil", value: target },
      { label: "Jet", value: formula },
      {
        label: "Bonus / malus",
        value: applied.length ? applied.map(add2eModifierLabel).join(" ; ") : "Aucun"
      }
    ],
    message: result.success ? "Réussite du jet de sauvegarde." : "Échec du jet de sauvegarde.",
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
          saveResolverVersion: result.version ?? globalThis.ADD2E_SAVE_RESOLVER_VERSION ?? null
        }
      }
    }
  };

  const preview = globalThis.add2eBuildChatCard(card);
  if (!String(preview ?? "").trim()) throw new Error("La carte de sauvegarde ADD2E est vide.");
  return globalThis.add2eCreateChatCard(card);
}

async function add2eCreateAbilityCheckCard(result, options = {}) {
  add2eRequireChatCardApi();
  const applied = result.resolution?.applied ?? [];
  const status = result.success ? "RÉUSSITE" : "ÉCHEC";
  const card = {
    actor: result.actor,
    title: `Test de ${result.label} — ${status}`,
    icon: result.icon ?? "fas fa-dice-d20",
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
        value: applied.length ? applied.map(add2eModifierLabel).join(" ; ") : "Aucun"
      }
    ],
    message: result.success ? "Réussite du test de caractéristique." : "Échec du test de caractéristique.",
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

export async function add2eRollCharacteristicCard(actor, ability, context = {}) {
  if (!actor) return ui.notifications.warn("Aucun acteur pour ce jet.");
  const engine = add2eRequireCanonicalRollContracts(add2eSheetRollEffectsEngine());
  const result = await engine.rollAbilityCheck(actor, ability, {
    ...context,
    source: context.source ?? "actor-sheet-ability-roll",
    consumer: context.consumer ?? "actor-sheet-roll-presentation"
  });
  return add2eCreateAbilityCheckCard(result, context);
}

export async function add2eRollSaveCard(actor, saveType, context = {}) {
  if (!actor) return ui.notifications.warn("Aucun acteur pour ce jet.");
  const engine = add2eRequireCanonicalRollContracts(add2eSheetRollEffectsEngine());
  const result = await engine.rollSavingThrow(actor, saveType, {
    ...context,
    frontale: context.frontale !== false,
    source: context.source ?? "actor-sheet-save-roll",
    consumer: context.consumer ?? "actor-sheet-roll-presentation",
    createChat: false,
    showDice: false
  });
  if (!result.ok) {
    const label = result.resolution?.label ?? "sauvegarde";
    return ui.notifications.warn(`Aucune valeur pour le jet ${label}.`);
  }
  return add2eCreateSavingThrowCard(result, context);
}

function add2eHudRollActor() {
  const hudState = globalThis.add2eHudFixDebug?.();
  return canvas?.tokens?.controlled?.[0]?.actor
    ?? game.actors?.get?.(hudState?.actorId)
    ?? game.user?.character
    ?? null;
}

export function add2eInstallHudSheetRollBridge() {
  const engine = add2eRequireCanonicalRollContracts(add2eSheetRollEffectsEngine());
  globalThis.ADD2E_SHEET_ROLL_DELEGATION_VERSION = ADD2E_SHEET_ROLL_DELEGATION_VERSION;
  globalThis.add2eRollCharacteristicCard = add2eRollCharacteristicCard;
  globalThis.add2eRollSaveCard = add2eRollSaveCard;

  if (globalThis.__add2eHudSheetRollBridgeV1) return engine;
  globalThis.__add2eHudSheetRollBridgeV1 = true;

  document.addEventListener("click", async event => {
    const button = event.target?.closest?.(
      "#add2e-action-hud [data-action='roll-ability'], #add2e-action-hud [data-action='roll-save']"
    );
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();

    const actor = add2eHudRollActor();
    if (!actor) return ui.notifications.warn("Aucun acteur sélectionné pour le jet.");
    if (button.dataset.action === "roll-ability") {
      return add2eRollCharacteristicCard(actor, button.dataset.ability, { source: "action-hud-ability-roll" });
    }
    if (button.dataset.action === "roll-save") {
      return add2eRollSaveCard(actor, Number(button.dataset.saveIndex), { source: "action-hud-save-roll" });
    }
  }, true);

  return engine;
}
