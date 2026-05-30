// ADD2E — Relais socket central pour ADD2E_GM_OPERATION et messages locaux.
// Version : 2026-05-30-local-player-attack-chat-relay-v1

import {
  ADD2E_GM_OPERATION,
  ADD2E_SOCKET,
  isResponsibleGM
} from "./15b0-gm-relay-common.mjs";

import {
  applyDamage,
  applyLegacyActiveEffect,
  createActiveEffect,
  deleteActiveEffects
} from "./15b1-gm-relay-effects.mjs";

import {
  createAmbientLight,
  createMeasuredTemplate,
  deleteAmbientLight,
  deleteMeasuredTemplates,
  updateToken
} from "./15b2-gm-relay-scene-documents.mjs";

import { vendorRecordProjectileSpent, consumeSpellComponent } from "./15b3-gm-relay-projectiles.mjs";

const ADD2E_ATTACK_PLAYER_LOCAL_CHAT = "ADD2E_ATTACK_PLAYER_LOCAL_CHAT";
const LOCAL_CHAT_VERSION = "2026-05-30-local-player-attack-chat-relay-v1";

function esc(value) {
  const div = document.createElement("div");
  div.innerText = String(value ?? "");
  return div.innerHTML;
}

function findChatLog() {
  return ui.chat?.element?.[0]?.querySelector?.("#chat-log")
    ?? ui.chat?.element?.[0]?.querySelector?.(".chat-log")
    ?? document.getElementById("chat-log")
    ?? document.querySelector(".chat-log")
    ?? null;
}

function localAttackCardKey(payload = {}) {
  return String(payload.id ?? `${payload.version ?? "no-version"}:${payload.speaker?.alias ?? "ADD2E"}:${String(payload.content ?? "").slice(0, 120)}`);
}

function renderLocalAttackPlayerChat(payload = {}) {
  const targets = Array.isArray(payload.userIds) ? payload.userIds.filter(Boolean) : [];
  const content = String(payload.content ?? "");
  const accepted = !game.user?.isGM && (!targets.length || targets.includes(game.user.id));

  console.log("[ADD2E][ATTACK_CHAT][CENTRAL_RECEIVED_PLAYER_LOCAL]", {
    relayVersion: LOCAL_CHAT_VERSION,
    payloadVersion: payload.version,
    user: game.user?.name,
    userId: game.user?.id,
    isGM: game.user?.isGM,
    targets,
    accepted,
    hasContent: !!content
  });

  if (!accepted || !content) return false;

  globalThis.ADD2E_LOCAL_ATTACK_CHAT_SEEN ??= new Set();
  const key = localAttackCardKey(payload);
  if (globalThis.ADD2E_LOCAL_ATTACK_CHAT_SEEN.has(key)) {
    console.log("[ADD2E][ATTACK_CHAT][CENTRAL_DUPLICATE_SKIPPED]", { key });
    return false;
  }
  globalThis.ADD2E_LOCAL_ATTACK_CHAT_SEEN.add(key);

  const log = findChatLog();
  if (!log) {
    console.warn("[ADD2E][ATTACK_CHAT][CENTRAL_NO_CHAT_LOG]", {
      relayVersion: LOCAL_CHAT_VERSION,
      user: game.user?.name,
      isGM: game.user?.isGM
    });
    return false;
  }

  const wrapper = document.createElement("li");
  wrapper.className = "chat-message message flexcol add2e-local-attack-player-message";
  wrapper.dataset.add2eLocalAttackCard = payload.version ?? LOCAL_CHAT_VERSION;
  wrapper.dataset.add2eLocalAttackKey = key;
  wrapper.innerHTML = `<header class="message-header flexrow"><h4 class="message-sender">${esc(payload.speaker?.alias || "ADD2E")}</h4><span class="message-metadata"><time class="message-timestamp">${new Date().toLocaleTimeString()}</time></span></header><div class="message-content">${content}</div>`;
  log.appendChild(wrapper);
  ui.chat?.scrollBottom?.();

  console.log("[ADD2E][ATTACK_CHAT][CENTRAL_RENDERED_PLAYER_LOCAL]", {
    relayVersion: LOCAL_CHAT_VERSION,
    key,
    user: game.user?.name
  });
  return true;
}

Hooks.once("ready", () => {
  if (globalThis.ADD2E_GM_OPERATION_RELAY_REGISTERED) return;
  globalThis.ADD2E_GM_OPERATION_RELAY_REGISTERED = true;

  globalThis.ADD2E_LOCAL_PLAYER_ATTACK_CHAT_RELAY_VERSION = LOCAL_CHAT_VERSION;

  console.log("%c[ADD2E][GM-RELAY] Relais socket générique chargé", "color:#27ae60;font-weight:bold;", {
    relayVersion: LOCAL_CHAT_VERSION,
    user: game.user?.name,
    isGM: game.user?.isGM
  });

  const routes = {
    applyDamage,
    deleteActiveEffects,
    createMeasuredTemplate,
    deleteMeasuredTemplates,
    createAmbientLight,
    deleteAmbientLight,
    updateToken,
    createActiveEffect,
    vendorRecordProjectileSpent,
    consumeSpellComponent
  };

  game.socket.on(ADD2E_SOCKET, async data => {
    console.log("[ADD2E SOCKET][RECU]", {
      user: game.user.name,
      isGM: game.user.isGM,
      data
    });

    if (data?.type === ADD2E_ATTACK_PLAYER_LOCAL_CHAT) {
      renderLocalAttackPlayerChat(data.payload ?? {});
      return;
    }

    if (data?.type === "applyActiveEffect") {
      if (!game.user.isGM) return;
      await applyLegacyActiveEffect(data);
      return;
    }

    if (!data || data.type !== ADD2E_GM_OPERATION) return;
    if (!isResponsibleGM()) return;

    const operation = data.operation;
    const payload = data.payload ?? {};
    const handler = routes[operation];

    if (!handler) {
      console.warn("[ADD2E][GM-RELAY] opération inconnue :", operation, payload);
      return;
    }

    await handler(payload);
  });
});
