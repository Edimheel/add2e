// scripts/add2e-initiative-chat.mjs
// ADD2E — carte de chat des jets d'initiative.

import { ADD2E_INITIATIVE_D6_ICON, ADD2E_INITIATIVE_VERSION, TAG, escapeHtml } from "./add2e-initiative-constants.mjs";

function speakerActor(speaker = {}) {
  if (speaker.token && canvas?.tokens?.get) return canvas.tokens.get(speaker.token)?.actor ?? null;
  if (speaker.actor) return game.actors?.get?.(speaker.actor) ?? null;
  return null;
}

function speakerToken(speaker = {}) {
  if (!speaker.token || !canvas?.tokens?.get) return null;
  return canvas.tokens.get(speaker.token) ?? null;
}

function rollSources(message, data = {}) {
  const candidates = [data?.rolls, data?.roll, message?.rolls, message?.roll];
  return candidates.flatMap(value => Array.isArray(value) ? value : value == null ? [] : [value]);
}

function materializeRoll(source) {
  if (!source || typeof source === "number") return source;
  if (typeof source === "string") {
    try {
      return globalThis.Roll?.fromJSON?.(source) ?? source;
    } catch (_error) {
      return source;
    }
  }

  if (Number.isFinite(Number(source?.total ?? source?._total))) return source;
  try {
    return globalThis.Roll?.fromData?.(source) ?? source;
  } catch (_error) {
    return source;
  }
}

function initiativeRollTotal(message, data = {}) {
  for (const source of rollSources(message, data)) {
    const roll = materializeRoll(source);
    const values = [
      roll?.total,
      roll?._total,
      source?.total,
      source?._total
    ];
    for (const value of values) {
      const total = Number(value);
      if (Number.isFinite(total)) return total;
    }
  }
  return null;
}

function initiativeFormula(message, data = {}) {
  for (const source of rollSources(message, data)) {
    const roll = materializeRoll(source);
    const formula = String(roll?.formula ?? roll?._formula ?? source?.formula ?? source?._formula ?? "");
    if (formula) return formula.replace(/\s+/g, "").toLowerCase();
  }
  return "";
}

function isInitiativeMessage(message, data = {}) {
  const flags = data.flags ?? message?.flags ?? {};
  const flavor = String(data.flavor ?? message?.flavor ?? "").toLowerCase();
  const speaker = data.speaker ?? message?.speaker ?? {};
  const formula = initiativeFormula(message, data);
  if (flags?.add2e?.initiativeRoll || flags?.core?.initiativeRoll) return true;
  if (flavor.includes("initiative")) return true;
  return formula === "1d6" && !!speaker?.actor;
}

function initiativeChatContent(message, data = {}) {
  const speaker = data.speaker ?? message?.speaker ?? {};
  const actor = speakerActor(speaker);
  const token = speakerToken(speaker);
  const name = token?.name ?? actor?.name ?? speaker.alias ?? "Combattant";
  const img = token?.document?.texture?.src ?? actor?.img ?? ADD2E_INITIATIVE_D6_ICON;
  const total = initiativeRollTotal(message, data);
  const result = Number.isFinite(total) ? total : "—";
  return `<div class="add2e-init-chat-card" style="border:1px solid #7c4a16;border-radius:10px;background:linear-gradient(135deg,#2a1708,#4b2a0e);color:#f7ead2;padding:10px 12px;box-shadow:0 2px 8px rgba(0,0,0,.35);font-family:serif;"><div style="display:flex;align-items:center;gap:10px;"><img src="${escapeHtml(img)}" alt="" style="width:42px;height:42px;border-radius:8px;object-fit:cover;border:1px solid rgba(255,255,255,.25);background:#111;"><div style="flex:1;min-width:0;"><div style="font-size:15px;font-weight:700;text-transform:uppercase;color:#ffd891;">Initiative</div><div style="font-size:18px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(name)}</div></div><div style="text-align:center;min-width:58px;background:rgba(255,255,255,.12);border:1px solid rgba(255,216,145,.35);border-radius:8px;padding:5px 8px;"><div style="font-size:11px;text-transform:uppercase;color:#ffd891;">D6</div><div style="font-size:26px;line-height:1;font-weight:900;color:#ffffff;">${escapeHtml(result)}</div></div></div><div style="margin-top:8px;font-size:12px;color:#ead6b0;display:flex;justify-content:space-between;gap:10px;"><span>Le plus petit résultat agit en premier.</span><span style="white-space:nowrap;">1d6</span></div></div>`;
}

function canRefreshInitiativeCard(message, userId) {
  if (userId && game.user?.id !== userId) return false;
  if (message?.isOwner === true || message?.isAuthor === true) return true;
  return message?.author?.id === game.user?.id;
}

async function refreshInitiativeChatCard(message, userId, attempt = 0) {
  if (!canRefreshInitiativeCard(message, userId) || !isInitiativeMessage(message)) return;
  const total = initiativeRollTotal(message);
  if (!Number.isFinite(total)) {
    if (attempt < 4) window.setTimeout(() => {
      void refreshInitiativeChatCard(message, userId, attempt + 1);
    }, 40 * (attempt + 1));
    return;
  }

  const content = initiativeChatContent(message);
  if (message.content === content) return;
  try {
    await message.update({ content }, { add2eInitiativeChatCardRefresh: true });
  } catch (err) {
    console.warn(`${TAG}[CHAT][REFRESH_ERROR]`, err);
  }
}

export function installInitiativeChatCard() {
  if (globalThis.__ADD2E_INIT_CHAT_CARD_INSTALLED === ADD2E_INITIATIVE_VERSION) return;
  globalThis.__ADD2E_INIT_CHAT_CARD_INSTALLED = ADD2E_INITIATIVE_VERSION;

  Hooks.on("preCreateChatMessage", (message, data) => {
    try {
      if (!isInitiativeMessage(message, data)) return;
      message.updateSource?.({
        content: initiativeChatContent(message, data),
        flavor: "Initiative ADD2E",
        "flags.add2e.initiativeRoll": true,
        "flags.add2e.initiativeChatCardVersion": ADD2E_INITIATIVE_VERSION
      });
    } catch (err) {
      console.warn(`${TAG}[CHAT][ERROR]`, err);
    }
  });

  Hooks.on("createChatMessage", (message, options, userId) => {
    if (options?.add2eInitiativeChatCardRefresh) return;
    void refreshInitiativeChatCard(message, userId);
  });
}