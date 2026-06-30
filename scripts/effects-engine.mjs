// ADD2E — Effects Engine.
// Façade publique : l'API globale historique reste inchangée.

import { installEffectsEngineCore } from "./effects-engine/00-core.mjs";
import { installEffectsEngineTagsAndFeatures } from "./effects-engine/10-tags-features.mjs";
import { installEffectsEngineDefense } from "./effects-engine/20-defense.mjs";
import { installEffectsEngineDamage } from "./effects-engine/30-resistance-damage.mjs";
import { installEffectsEngineMonk } from "./effects-engine/40-monk.mjs";
import { installEffectsEngineAnalysis } from "./effects-engine/50-analysis.mjs";

globalThis.ADD2E_EFFECTS_ENGINE_VERSION = "2026-06-30-external-action-gates-v1";

class Add2eEffectsEngine {}

installEffectsEngineCore(Add2eEffectsEngine);
installEffectsEngineTagsAndFeatures(Add2eEffectsEngine);
installEffectsEngineDefense(Add2eEffectsEngine);
installEffectsEngineDamage(Add2eEffectsEngine);
installEffectsEngineMonk(Add2eEffectsEngine);
installEffectsEngineAnalysis(Add2eEffectsEngine);

globalThis.Add2eEffectsEngine = Add2eEffectsEngine;

function add2eActionGateActor(args = {}) {
  return args.actor ?? (args.actorId ? game.actors?.get?.(args.actorId) : null) ?? null;
}

function add2eActionGateWeapon(actor, args = {}) {
  return args.arme ?? (args.itemId ? actor?.items?.get?.(args.itemId) : null) ?? null;
}

function add2eActionGateTargetToken(args = {}) {
  return args.targetToken ?? args.cibleToken ?? Array.from(game.user?.targets ?? [])[0] ?? null;
}

function add2eActionGateTargetActor(token) {
  return token?.actor
    ?? token?.document?.actor
    ?? (token?.document?.actorId ? game.actors?.get?.(token.document.actorId) : null)
    ?? null;
}

function add2eActionGateSourceToken(actor) {
  return (canvas?.tokens?.controlled ?? []).find(token => token?.actor?.id === actor?.id || token?.document?.actorId === actor?.id)
    ?? actor?.getActiveTokens?.()[0]
    ?? actor?.token?.object
    ?? actor?.token
    ?? null;
}

function add2eActionGateEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function add2eEvaluateExternalAttackGate(args = {}) {
  const actor = add2eActionGateActor(args);
  const weapon = add2eActionGateWeapon(actor, args);
  const targetToken = add2eActionGateTargetToken(args);
  const targetActor = add2eActionGateTargetActor(targetToken);
  if (!actor || !weapon || !targetToken || !targetActor) return { allowed: true, details: [], gateResults: [] };

  const sourceToken = add2eActionGateSourceToken(actor);
  const action = {
    type: "attaque",
    actor,
    sourceActor: actor,
    sourceToken,
    targetActor,
    targetToken,
    weapon,
    contact: false,
    actionTags: Add2eEffectsEngine.itemTags?.(weapon) ?? []
  };
  const actorTags = Add2eEffectsEngine.getContextTags?.(actor) ?? Add2eEffectsEngine.getActiveTags?.(actor) ?? [];
  const targetTags = Add2eEffectsEngine.getContextTags?.(targetActor) ?? Add2eEffectsEngine.getActiveTags?.(targetActor) ?? [];

  const owner = await Add2eEffectsEngine.evaluateActionRules(actor, {
    ...action,
    ruleScope: "owner",
    subjectTags: targetTags
  });
  if (owner.allowed === false) {
    return {
      allowed: false,
      details: owner.details ?? [],
      gateResults: owner.gateResults ?? [],
      actor,
      targetActor,
      sourceToken,
      targetToken
    };
  }

  const target = await Add2eEffectsEngine.evaluateActionRules(targetActor, {
    ...action,
    ruleScope: "target",
    subjectTags: actorTags,
    saveActor: actor
  });
  return {
    allowed: target.allowed !== false,
    details: target.details ?? [],
    gateResults: target.gateResults ?? [],
    actor,
    targetActor,
    sourceToken,
    targetToken
  };
}

async function add2ePublishExternalActionGateResult(gate, allowed) {
  for (const result of gate?.gateResults ?? []) {
    if (result?.kind !== "save_gate" || (result?.allowed !== false) !== allowed) continue;

    const effect = result?.source?.effect ?? null;
    const flags = effect?.flags?.add2e ?? {};
    const save = result?.save ?? null;
    const effectName = effect?.name ?? result?.source?.effectName ?? "Effet actif";
    const attackerName = gate.actor?.name ?? "Attaquant";
    const targetName = gate.targetToken?.name ?? gate.targetActor?.name ?? "Cible";
    const title = allowed ? `${effectName.toUpperCase()} FRANCHI` : `ATTAQUE BLOQUÉE PAR ${effectName.toUpperCase()}`;
    const outcome = allowed
      ? `${attackerName} réussit son jet de protection et peut attaquer ${targetName}.`
      : `${attackerName} échoue à son jet de protection et doit ignorer ${targetName}.`;
    const saveText = save?.canRoll ? `${save.total} / ${save.threshold}` : "indisponible";

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: gate.actor, token: gate.sourceToken }),
      content: `<div class="add2e-chat-card add2e-effect-action-gate"><header><img src="${add2eActionGateEscape(flags.sourceSpellImg ?? effect?.img ?? "icons/svg/shield.svg")}" width="32" height="32"><b>${add2eActionGateEscape(flags.casterName ?? "Lanceur")}</b></header><h3>${add2eActionGateEscape(title)}</h3><p><b>Attaquant :</b> ${add2eActionGateEscape(attackerName)}<br><b>Cible protégée :</b> ${add2eActionGateEscape(targetName)}<br><b>Jet de protection :</b> ${add2eActionGateEscape(saveText)}</p><p>${add2eActionGateEscape(outcome)}</p></div>`,
      ...(CONST.CHAT_MESSAGE_STYLES ? { style: CONST.CHAT_MESSAGE_STYLES.OTHER } : { type: CONST.CHAT_MESSAGE_TYPES?.OTHER ?? 0 })
    });
  }
}

function add2eInstallExternalActionGateBridge() {
  const normalAttackRoll = globalThis.add2eAttackRoll;
  if (typeof normalAttackRoll !== "function" || normalAttackRoll.__add2eExternalActionGateBridge === true) return false;
  if (!globalThis.ADD2E_ATTACK_ROLL_SPLIT_VERSION) return false;

  const bridged = async function add2eAttackRollWithExternalActionGate(args = {}) {
    let gate;
    try {
      gate = await add2eEvaluateExternalAttackGate(args);
    } catch (error) {
      console.error("[ADD2E][ACTION_GATE][EVALUATE_ERROR]", error);
      return normalAttackRoll(args);
    }

    if (gate.allowed === false) {
      await add2ePublishExternalActionGateResult(gate, false);
      ui.notifications?.warn?.(gate.details?.[0] ?? "Cette attaque est empêchée par un effet actif.");
      return false;
    }

    const result = await normalAttackRoll(args);
    if (result === true) await add2ePublishExternalActionGateResult(gate, true);
    return result;
  };

  bridged.__add2eExternalActionGateBridge = true;
  bridged.__add2eExternalActionGateOriginal = normalAttackRoll;
  globalThis.add2eAttackRoll = bridged;
  globalThis.ADD2E_EXTERNAL_ACTION_GATE_BRIDGE_VERSION = "2026-06-30-external-active-effect-gate-v1";
  return true;
}

function add2eScheduleExternalActionGateBridge() {
  let attempts = 0;
  const install = () => {
    if (add2eInstallExternalActionGateBridge()) return;
    attempts += 1;
    if (attempts < 20) window.setTimeout(install, 50);
  };
  install();
}

if (game?.ready) add2eScheduleExternalActionGateBridge();
else Hooks.once("ready", add2eScheduleExternalActionGateBridge);
