// ADD2E — Relais socket central pour ADD2E_GM_OPERATION et messages joueurs.
// Version : 2026-05-30-player-owned-attack-chat-relay-v2

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
const LOCAL_CHAT_VERSION = "2026-05-30-player-owned-attack-chat-relay-v2";

function localAttackCardKey(payload = {}) {
  return String(payload.id ?? `${payload.version ?? "no-version"}:${payload.speaker?.alias ?? "ADD2E"}:${String(payload.content ?? "").slice(0, 120)}`);
}

function responsiblePlayerId(targets = []) {
  const ordered = targets.filter(Boolean);
  const activeTarget = ordered.find(id => game.users?.get?.(id)?.active && !game.users.get(id).isGM);
  if (activeTarget) return activeTarget;
  const anyTarget = ordered.find(id => !game.users?.get?.(id)?.isGM);
  if (anyTarget) return anyTarget;
  const activePlayer = Array.from(game.users ?? []).find(u => u.active && !u.isGM)?.id;
  return activePlayer ?? null;
}

async function createPersistentPlayerAttackChat(payload = {}) {
  const targets = Array.isArray(payload.userIds) ? payload.userIds.filter(Boolean) : [];
  const content = String(payload.content ?? "");
  const responsible = responsiblePlayerId(targets);
  const accepted = !game.user?.isGM && game.user?.id === responsible && !!content;

  console.log("[ADD2E][ATTACK_CHAT][PLAYER_CHAT_RECEIVED]", {
    relayVersion: LOCAL_CHAT_VERSION,
    payloadVersion: payload.version,
    user: game.user?.name,
    userId: game.user?.id,
    isGM: game.user?.isGM,
    targets,
    responsible,
    accepted,
    hasContent: !!content
  });

  if (!accepted) return false;

  globalThis.ADD2E_LOCAL_ATTACK_CHAT_SEEN ??= new Set();
  const key = localAttackCardKey(payload);
  if (globalThis.ADD2E_LOCAL_ATTACK_CHAT_SEEN.has(key)) {
    console.log("[ADD2E][ATTACK_CHAT][PLAYER_CHAT_DUPLICATE_SKIPPED]", { key });
    return false;
  }
  globalThis.ADD2E_LOCAL_ATTACK_CHAT_SEEN.add(key);

  try {
    await ChatMessage.create({
      speaker: payload.speaker ?? { alias: "ADD2E" },
      content,
      whisper: targets,
      blind: false,
      flags: {
        add2e: {
          attackChatVisibility: "players-only",
          attackChatVisibilityVersion: LOCAL_CHAT_VERSION,
          localAttackKey: key,
          createdByPlayerRelay: true
        }
      }
    });

    console.log("[ADD2E][ATTACK_CHAT][PLAYER_CHAT_CREATED]", {
      relayVersion: LOCAL_CHAT_VERSION,
      key,
      author: game.user?.id,
      whisper: targets
    });
    return true;
  } catch (err) {
    console.error("[ADD2E][ATTACK_CHAT][PLAYER_CHAT_CREATE_ERROR]", err, {
      relayVersion: LOCAL_CHAT_VERSION,
      key,
      author: game.user?.id,
      whisper: targets
    });
    return false;
  }
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
      await createPersistentPlayerAttackChat(data.payload ?? {});
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
