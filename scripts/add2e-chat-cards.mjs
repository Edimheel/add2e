// ADD2E — Constructeur commun des cartes de chat.
// Compatible Foundry V13/V14/V15.

export const ADD2E_CHAT_CARDS_VERSION = "2026-06-30-normalized-cards-v1";

export function add2eEscapeChatHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function chatStyle() {
  return CONST.CHAT_MESSAGE_STYLES
    ? { style: CONST.CHAT_MESSAGE_STYLES.OTHER }
    : { type: CONST.CHAT_MESSAGE_TYPES?.OTHER ?? 0 };
}

function actorPortrait(actor, token) {
  return token?.document?.texture?.src
    ?? token?.texture?.src
    ?? actor?.img
    ?? "icons/svg/mystery-man.svg";
}

function field(label, value) {
  const escape = add2eEscapeChatHtml;
  return `<div style="flex:1;min-width:105px;text-align:center;border:1px solid #e2bc63;border-radius:6px;padding:6px;background:#fffdf7;">
    <div style="font-size:.72em;color:#82651e;text-transform:uppercase;font-weight:800;letter-spacing:.03em;">${escape(label)}</div>
    <div style="margin-top:2px;color:#422e0e;font-weight:800;">${escape(value)}</div>
  </div>`;
}

/**
 * Rend la carte dorée normalisée des sorts et effets ADD2E.
 * Les scripts onUse peuvent appeler cette fonction sans dupliquer la structure HTML.
 */
export function buildAdd2eNormalizedChatCard({
  actor = null,
  token = null,
  icon = "icons/magic/defensive/shield-barrier-glowing-blue.webp",
  category = "Effet",
  title = "Effet actif",
  targetLabel = "",
  headline = "",
  fields = [],
  information = "",
  detailsLabel = "Détails",
  details = ""
} = {}) {
  const escape = add2eEscapeChatHtml;
  const actorName = actor?.name ?? "Acteur";
  const portrait = actorPortrait(actor, token);
  const factMarkup = fields
    .filter(entry => entry && entry.label && entry.value !== undefined && entry.value !== null && entry.value !== "")
    .map(entry => field(entry.label, entry.value))
    .join("");
  const targetMarkup = targetLabel
    ? `<div style="margin-bottom:7px;font-size:.95em;"><b>Cible :</b> ${escape(targetLabel)}</div>`
    : "";
  const headlineMarkup = headline
    ? `<div style="text-align:center;border:1px solid #e2bc63;border-radius:7px;padding:8px;background:#fffdf7;">
        <b style="color:#6f4b12;">${escape(headline)}</b>
      </div>`
    : "";
  const factsMarkup = factMarkup
    ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:7px;">${factMarkup}</div>`
    : "";
  const informationMarkup = information
    ? `<div style="margin-top:7px;padding:7px 8px;border-left:4px solid #b88924;background:#fff9e9;border-radius:4px;font-size:.88em;line-height:1.35;">${escape(information)}</div>`
    : "";
  const detailsMarkup = details
    ? `<details style="margin-top:8px;background:#fffdf5;border:1px solid #e2bc63;border-radius:6px;">
        <summary style="cursor:pointer;color:#6f4b12;font-weight:600;padding:6px;">${escape(detailsLabel)}</summary>
        <div style="padding:8px;font-size:.85em;line-height:1.45;">${escape(details)}</div>
      </details>`
    : "";

  return `<div class="add2e-chat-card add2e-spell-card add2e-spell-card-clerc add2e-effect-resolution-card" style="border-radius:12px;box-shadow:0 4px 10px #0002;background:linear-gradient(135deg,#fffaf0,#fff7df);border:1.5px solid #e2bc63;overflow:hidden;padding:0;font-family:var(--font-primary);">
    <div style="background:linear-gradient(90deg,#6f4b12,#b88924);padding:8px 12px;color:#fff;display:flex;align-items:center;gap:10px;border-bottom:2px solid #8a611d;">
      <img src="${escape(portrait)}" style="width:36px;height:36px;border-radius:50%;border:2px solid #fff;object-fit:cover;">
      <div style="line-height:1.2;flex:1;">
        <div style="font-weight:bold;font-size:1.05em;">${escape(actorName)}</div>
        <div style="font-size:.85em;opacity:.95;">${escape(category)}</div>
      </div>
      <img src="${escape(icon)}" style="width:32px;height:32px;border-radius:4px;background:#fff;object-fit:cover;">
    </div>
    <div style="padding:10px;color:#6f4b12;">
      ${targetMarkup}
      ${headlineMarkup}
      ${factsMarkup}
      ${informationMarkup}
      ${detailsMarkup}
    </div>
  </div>`;
}

export async function createAdd2eNormalizedChatCard({ actor = null, token = null, ...options } = {}) {
  if (typeof ChatMessage === "undefined") return null;
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor, token }),
    content: buildAdd2eNormalizedChatCard({ actor, token, ...options }),
    ...chatStyle()
  });
}

/** Carte normalisée pour les réductions de dégâts décidées par effects-engine. */
export async function createAdd2eDamageResolutionCard({ actor = null, token = null, result = null } = {}) {
  if (!result?.applied) return null;

  const element = String(result.element ?? "").trim().toLowerCase();
  const natural = result.naturalProtection === true;
  const title = natural
    ? `Protection contre le ${element || "danger"} naturel`
    : `Résistance au ${element || "danger"}`;

  const fields = natural
    ? [
      { label: "Température", value: `${result.context?.temperature ?? "—"} °C` },
      { label: "Limite protégée", value: `${result.naturalLimit ?? "—"} °C` },
      { label: "Dégâts", value: `${result.original} → ${result.amount}` }
    ]
    : [
      {
        label: "Jet de protection",
        value: result.save?.canRoll
          ? `${result.save.total} / ${result.save.threshold}`
          : "Indisponible"
      },
      { label: "Bonus", value: result.save?.canRoll ? `${result.save.bonus >= 0 ? "+" : ""}${result.save.bonus}` : "—" },
      { label: "Dégâts", value: `${result.original} → ${result.amount}` }
    ];

  const information = natural
    ? `Le froid naturel déclaré reste dans la limite de protection. Aucun dégât n’est appliqué.`
    : result.save?.canRoll
      ? (result.save.success
        ? `Jet réussi : les dégâts sont réduits au quart.`
        : `Jet échoué : les dégâts sont réduits de moitié.`)
      : `Jet indisponible : les dégâts sont réduits de moitié.`;

  return createAdd2eNormalizedChatCard({
    actor,
    token,
    icon: "icons/magic/defensive/shield-barrier-glowing-blue.webp",
    category: "Résolution d’effet",
    title,
    targetLabel: actor?.name ?? "Cible",
    headline: title.toUpperCase(),
    fields,
    information,
    detailsLabel: "Règle appliquée",
    details: natural
      ? `La température déclarée est couverte par l’effet actif.`
      : `Le moteur d’effets applique le bonus de sauvegarde et la réduction définie par les tags actifs.`
  });
}

globalThis.ADD2E_CHAT_CARDS = Object.freeze({
  version: ADD2E_CHAT_CARDS_VERSION,
  escapeHtml: add2eEscapeChatHtml,
  buildCard: buildAdd2eNormalizedChatCard,
  createCard: createAdd2eNormalizedChatCard,
  createDamageResolutionCard: createAdd2eDamageResolutionCard
});
