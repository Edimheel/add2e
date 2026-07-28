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

export async function createInitiativeChatCard({
  combatant,
  roll,
  formula = "1d6",
  resolution,
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
  const speaker = messageOptions?.speaker ?? ChatMessage.getSpeaker({
    actor,
    token: combatant?.token?.object ?? undefined
  });

  const card = {
    actor,
    title: "Initiative",
    icon: "fas fa-dice-d6",
    variant: "time",
    source: sourceIdentity(combatant),
    rows: [
      { label: "Jet", value: `${Number.isFinite(base) ? base : "—"} (${formula})` },
      { label: "Modificateurs", value: initiativeBreakdown(resolution) },
      { label: "Ajustement total", value: adjustment ? signed(adjustment) : "Aucun" },
      { label: "Initiative finale", value: Number.isFinite(total) ? total : "—" },
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
          total: Number.isFinite(total) ? total : null
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
