// scripts/add2e-initiative-chat.mjs
// ADD2E — carte canonique des jets d'initiative.

import { ADD2E_INITIATIVE_VERSION } from "./add2e-initiative-constants.mjs";

function signed(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value ?? "—");
  return `${number > 0 ? "+" : ""}${number}`;
}

function modifierSource(modifier = {}) {
  return String(
    modifier?.source?.name
    ?? modifier?._context?.sourceEffect?.name
    ?? modifier?._context?.sourceItem?.name
    ?? "Modificateur"
  ).trim() || "Modificateur";
}

function modifierText(entry = {}) {
  const modifier = entry.modifier ?? {};
  const source = modifierSource(modifier);
  const operation = String(modifier.operation ?? "add");
  if (operation === "add") return `${source} ${signed(modifier.value)}`;
  if (operation === "set") return `${source} → ${modifier.value}`;
  if (operation === "multiply") return `${source} ×${modifier.value}`;
  if (operation === "minmax") {
    const minimum = modifier.value?.min;
    const maximum = modifier.value?.max;
    const bounds = [
      Number.isFinite(Number(minimum)) ? `min ${minimum}` : "",
      Number.isFinite(Number(maximum)) ? `max ${maximum}` : ""
    ].filter(Boolean).join(", ");
    return `${source} (${bounds || "bornes"})`;
  }
  return `${source} ${signed(entry.contribution ?? modifier.value)}`;
}

function sourceIdentity(combatant) {
  const actor = combatant?.actor ?? null;
  const token = combatant?.token ?? null;
  return {
    name: combatant?.name ?? actor?.name ?? "Combattant",
    img: token?.texture?.src ?? actor?.img ?? "icons/svg/dice-target.svg",
    type: "Initiative ADD2E"
  };
}

function initiativeBreakdown(resolution = {}) {
  const applied = Array.isArray(resolution?.applied) ? resolution.applied : [];
  return applied.length ? applied.map(modifierText).join(" ; ") : "Aucun";
}

function actionText(action = null) {
  if (!action) return "Aucune action déclarée";
  const segment = Number(action.segment);
  const kind = action.kind === "weapon" ? "Arme" : action.kind === "spell" ? "Sort" : "Action";
  return Number.isFinite(segment)
    ? `${kind} · ${action.label} · facteur ${segment}`
    : `${kind} · ${action.label}`;
}

function situationRows(actionContext = null) {
  const situation = actionContext?.situation ?? {};
  const modifier = Number(situation.modifier) || 0;
  const surprise = Math.max(0, Number(situation.surpriseSegments) || 0);
  const reaction = Number(situation.dexterityReaction) || 0;
  const remaining = Math.max(0, Number(situation.remainingSurpriseSegments) || 0);
  const rows = [];
  if (modifier) rows.push({ label: "Situation", value: signed(modifier) });
  if (surprise) {
    rows.push({
      label: "Surprise",
      value: `${surprise} segment${surprise > 1 ? "s" : ""} · réaction DEX ${signed(reaction)} · reste ${remaining}`
    });
  }
  return rows;
}

function tieText(tie = {}) {
  if (tie?.tied !== true) return "Aucune";
  const names = Array.isArray(tie.names) ? tie.names.filter(Boolean) : [];
  const suffix = tie.resolvedByAction === true
    ? "départage par rapidité ou temps d’incantation"
    : "ordre stable du tracker";
  return names.length ? `Égalité avec ${names.join(", ")} — ${suffix}` : `Égalité — ${suffix}`;
}

export async function createInitiativeChatCard({
  combatant,
  roll,
  formula = "1d6",
  resolution,
  actionContext = resolution?.actionContext ?? null,
  tie = null,
  messageOptions = {},
  messageMode = null
} = {}) {
  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    throw new Error("Les constructeurs communs de cartes ADD2E sont indisponibles pour l'initiative.");
  }

  const actor = combatant?.actor ?? null;
  const base = Number(roll?.total);
  const total = Number(resolution?.total);
  const adjustment = Number.isFinite(base) && Number.isFinite(total) ? total - base : 0;
  const flags = messageOptions?.flags && typeof messageOptions.flags === "object" ? messageOptions.flags : {};
  const add2eFlags = flags.add2e && typeof flags.add2e === "object" ? flags.add2e : {};
  const speaker = messageOptions?.speaker ?? ChatMessage.getSpeaker({ actor, token: combatant?.token?.object ?? undefined });
  const action = actionContext?.action ?? null;
  const situation = actionContext?.situation ?? null;

  const card = {
    actor,
    title: "Initiative",
    icon: "fas fa-dice-d6",
    variant: "time",
    source: sourceIdentity(combatant),
    rows: [
      { label: "Jet", value: `${Number.isFinite(base) ? base : "—"} (${formula})` },
      { label: "Action déclarée", value: actionText(action) },
      ...situationRows(actionContext),
      { label: "Modificateurs", value: initiativeBreakdown(resolution) },
      { label: "Ajustement total", value: adjustment ? signed(adjustment) : "Aucun" },
      { label: "Initiative finale", value: Number.isFinite(total) ? total : "—" },
      ...(tie?.tied === true ? [{ label: "Égalité", value: tieText(tie) }] : []),
      { label: "Ordre", value: "Le résultat le plus élevé agit en premier." }
    ],
    chatData: {
      ...messageOptions,
      speaker,
      rolls: [roll],
      flavor: "Initiative ADD2E",
      ...(messageMode && messageOptions?.rollMode === undefined ? { rollMode: messageMode } : {}),
      flags: {
        ...flags,
        add2e: {
          ...add2eFlags,
          initiativeRoll: true,
          initiativeVersion: ADD2E_INITIATIVE_VERSION,
          combatantId: combatant?.id ?? null,
          formula,
          baseRoll: Number.isFinite(base) ? base : null,
          adjustment,
          total: Number.isFinite(total) ? total : null,
          action: action ? { ...action } : null,
          situation: situation ? { ...situation } : null,
          tie: tie?.tied === true,
          tieResolvedByAction: tie?.resolvedByAction === true,
          tieCombatantIds: tie?.tied === true ? tie.combatantIds ?? [] : []
        }
      }
    }
  };

  globalThis.add2eBuildChatCard(card);
  return globalThis.add2eCreateChatCard(card);
}

export function installInitiativeChatCard() {
  globalThis.__ADD2E_INIT_CHAT_CARD_INSTALLED = ADD2E_INITIATIVE_VERSION;
}
