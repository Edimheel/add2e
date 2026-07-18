// ADD2E — Constructeur commun des cartes de chat.
// Structure unique compatible Foundry V13, V14 et V15.

const ADD2E_CHAT_CARD_IMAGE_FALLBACK = "icons/svg/item-bag.svg";
const ADD2E_CHAT_CARD_VARIANTS = new Set([
  "neutral",
  "attack",
  "damage",
  "spell",
  "magic",
  "ability",
  "healing",
  "success",
  "failure",
  "time"
]);

function add2eChatCardEscape(value) {
  const text = String(value ?? "");
  try {
    if (typeof foundry?.utils?.escapeHTML === "function") return foundry.utils.escapeHTML(text);
  } catch (_error) {}
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function add2eChatCardVariant(value) {
  const variant = String(value ?? "neutral").trim().toLowerCase();
  return ADD2E_CHAT_CARD_VARIANTS.has(variant) ? variant : "neutral";
}

function add2eChatCardIcon(value) {
  const icon = String(value ?? "").trim();
  return /^[a-z0-9 _-]+$/i.test(icon) ? icon : "fas fa-dice-d20";
}

function add2eChatCardImage(value, fallback = ADD2E_CHAT_CARD_IMAGE_FALLBACK) {
  const image = String(value ?? "").trim();
  return image || fallback;
}

function add2eChatCardColorVariables(colors = {}) {
  const allowed = {
    accent: "--add2e-card-accent",
    accent2: "--add2e-card-accent-2",
    border: "--add2e-card-border",
    paper: "--add2e-card-paper",
    paper2: "--add2e-card-paper-2",
    text: "--add2e-card-text"
  };
  const variables = [];
  for (const [key, cssVariable] of Object.entries(allowed)) {
    const color = String(colors?.[key] ?? "").trim();
    if (/^#[0-9a-f]{3,8}$/i.test(color)) variables.push(`${cssVariable}:${color}`);
  }
  return variables.join(";");
}

function add2eChatCardIdentity(identity = {}, fallback = {}) {
  return {
    name: String(identity?.name ?? fallback?.name ?? "").trim(),
    img: add2eChatCardImage(identity?.img ?? fallback?.img),
    type: String(identity?.type ?? "").trim(),
    meta: String(identity?.meta ?? "").trim()
  };
}

function add2eChatCardIdentityMeta(identity) {
  return [identity.type, identity.meta].filter(Boolean).join(" · ");
}

function add2eChatCardRows(rows = []) {
  return (Array.isArray(rows) ? rows : [])
    .filter(row => row && (row.label !== undefined || row.value !== undefined))
    .map(row => {
      const label = add2eChatCardEscape(row.label ?? "");
      const value = add2eChatCardEscape(row.value ?? "—");
      return `<div class="add2e-card-label">${label}</div><div class="add2e-card-value">${value}</div>`;
    })
    .join("");
}

export function add2eBuildChatCard({
  actor = null,
  title = "Action",
  icon = "fas fa-dice-d20",
  source = null,
  target = null,
  variant = "neutral",
  rows = [],
  message = "",
  colors = {}
} = {}) {
  const resolvedVariant = add2eChatCardVariant(variant);
  const resolvedSource = add2eChatCardIdentity(source, {
    name: actor?.name ?? "Source",
    img: actor?.img ?? ADD2E_CHAT_CARD_IMAGE_FALLBACK
  });
  const resolvedTarget = target ? add2eChatCardIdentity(target) : null;
  const sourceMeta = add2eChatCardIdentityMeta(resolvedSource);
  const targetMeta = resolvedTarget ? add2eChatCardIdentityMeta(resolvedTarget) : "";
  const style = add2eChatCardColorVariables(colors);
  const styleAttribute = style ? ` style="${add2eChatCardEscape(style)}"` : "";
  const rowHtml = add2eChatCardRows(rows);
  const targetHtml = resolvedTarget?.name
    ? `<div class="add2e-card-target"><img class="add2e-card-target-image" src="${add2eChatCardEscape(resolvedTarget.img)}" alt=""><div><span class="add2e-card-target-label">Cible</span><strong>${add2eChatCardEscape(resolvedTarget.name)}</strong>${targetMeta ? `<span>${add2eChatCardEscape(targetMeta)}</span>` : ""}</div></div>`
    : "";
  const messageHtml = String(message ?? "").trim()
    ? `<div class="add2e-card-message">${add2eChatCardEscape(message)}</div>`
    : "";

  return `<div class="add2e-card add2e-card--${resolvedVariant}"${styleAttribute}><header class="add2e-card-header"><img class="add2e-card-image add2e-card-source-image" src="${add2eChatCardEscape(resolvedSource.img)}" alt=""><div class="add2e-card-heading"><h3><i class="${add2eChatCardEscape(add2eChatCardIcon(icon))}"></i><span>${add2eChatCardEscape(title)}</span></h3><div class="add2e-card-source"><strong>${add2eChatCardEscape(resolvedSource.name || "Source")}</strong>${sourceMeta ? `<span>${add2eChatCardEscape(sourceMeta)}</span>` : ""}</div></div></header>${targetHtml}<div class="add2e-card-body">${rowHtml ? `<div class="add2e-card-grid">${rowHtml}</div>` : ""}${messageHtml}</div></div>`;
}

export async function add2eCreateChatCard(options = {}) {
  const actor = options?.actor ?? null;
  const content = add2eBuildChatCard(options);
  const chatData = options?.chatData && typeof options.chatData === "object" ? { ...options.chatData } : {};
  return ChatMessage.create({
    speaker: chatData.speaker ?? ChatMessage.getSpeaker({ actor }),
    ...chatData,
    content
  });
}

globalThis.add2eBuildChatCard = add2eBuildChatCard;
globalThis.add2eCreateChatCard = add2eCreateChatCard;
