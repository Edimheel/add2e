// ADD2E — Relais socket central pour ADD2E_GM_OPERATION et messages joueurs/MJ.
// Version : 2026-06-15-gm-detail-central-relay-disabled-v1

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
const ADD2E_ATTACK_GM_DETAIL_CHAT = "ADD2E_ATTACK_GM_DETAIL_CHAT";
const LOCAL_CHAT_VERSION = "2026-06-15-gm-detail-central-relay-disabled-v1";
const LOG = "[ADD2E][ATTACK_CHAT_RELAY]";

globalThis.ADD2E_LOCAL_PLAYER_ATTACK_CHAT_RELAY_VERSION = LOCAL_CHAT_VERSION;
globalThis.ADD2E_ATTACK_GM_DETAIL_USE_CENTRAL_RELAY ??= false;

function gmIds() {
  const recipients = ChatMessage.getWhisperRecipients?.("GM") ?? [];
  const ids = recipients.map(u => u.id).filter(Boolean);
  if (ids.length) return ids;
  return Array.from(game.users ?? []).filter(u => u.isGM).map(u => u.id).filter(Boolean);
}

function centralGmDetailRelayEnabled() {
  return globalThis.ADD2E_ATTACK_GM_DETAIL_USE_CENTRAL_RELAY === true;
}

function localAttackCardKey(payload = {}) {
  return String(payload.id ?? `${payload.version ?? "no-version"}:${payload.speaker?.alias ?? "ADD2E"}:${String(payload.content ?? "").slice(0, 120)}`);
}

function responsiblePlayerId(targets = []) {
  const ordered = targets.filter(Boolean);
  const activeTarget = ordered.find(id => {
    const user = game.users?.get?.(id);
    return user?.active && !user?.isGM;
  });
  if (activeTarget) return activeTarget;

  const anyTarget = ordered.find(id => {
    const user = game.users?.get?.(id);
    return user && !user.isGM;
  });
  if (anyTarget) return anyTarget;

  return Array.from(game.users ?? []).find(u => u.active && !u.isGM)?.id ?? null;
}

async function createPersistentPlayerAttackChat(payload = {}) {
  const targets = Array.isArray(payload.userIds) ? payload.userIds.filter(Boolean) : [];
  const content = String(payload.content ?? "");
  const responsible = responsiblePlayerId(targets);
  const accepted = !game.user?.isGM && game.user?.id === responsible && !!content;

  console.log(`${LOG}[PLAYER_CHAT_RECEIVED]`, {
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
    console.log(`${LOG}[PLAYER_CHAT_DUPLICATE_SKIPPED]`, { key });
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

    console.log(`${LOG}[PLAYER_CHAT_CREATED]`, {
      relayVersion: LOCAL_CHAT_VERSION,
      key,
      author: game.user?.id,
      whisper: targets
    });
    return true;
  } catch (err) {
    console.error(`${LOG}[PLAYER_CHAT_CREATE_ERROR]`, err, {
      relayVersion: LOCAL_CHAT_VERSION,
      key,
      author: game.user?.id,
      whisper: targets
    });
    return false;
  }
}

async function createGmAttackDetailChat(payload = {}) {
  if (!game.user?.isGM) return false;
  if (!isResponsibleGM()) return false;

  const content = String(payload.content ?? "");
  if (!content) {
    console.warn(`${LOG}[GM_DETAIL_EMPTY]`, { relayVersion: LOCAL_CHAT_VERSION });
    return false;
  }

  globalThis.ADD2E_GM_ATTACK_DETAIL_CHAT_SEEN ??= new Set();
  const key = localAttackCardKey(payload);
  if (globalThis.ADD2E_GM_ATTACK_DETAIL_CHAT_SEEN.has(key)) {
    console.log(`${LOG}[GM_DETAIL_DUPLICATE_SKIPPED]`, { key });
    return false;
  }
  globalThis.ADD2E_GM_ATTACK_DETAIL_CHAT_SEEN.add(key);

  const whisper = Array.isArray(payload.whisper) && payload.whisper.length ? payload.whisper : gmIds();
  try {
    await ChatMessage.create({
      speaker: payload.speaker ?? { alias: "ADD2E" },
      content,
      avatar: payload.avatar,
      whisper,
      blind: false,
      flags: {
        ...(payload.flags ?? {}),
        add2e: {
          ...(payload.flags?.add2e ?? {}),
          attackChatVisibility: "gm-only",
          attackChatVisibilityVersion: payload.flags?.add2e?.attackChatVisibilityVersion ?? LOCAL_CHAT_VERSION,
          gmRelayVersion: LOCAL_CHAT_VERSION,
          createdByGmRelay: true,
          localAttackKey: key
        }
      }
    });

    console.log(`${LOG}[GM_DETAIL_CREATED]`, {
      relayVersion: LOCAL_CHAT_VERSION,
      user: game.user?.name,
      whisper,
      actor: payload.speaker?.alias ?? null,
      key
    });
    return true;
  } catch (err) {
    console.error(`${LOG}[GM_DETAIL_CREATE_ERROR]`, err, {
      relayVersion: LOCAL_CHAT_VERSION,
      whisper,
      key
    });
    return false;
  }
}

async function handleAttackChatSocket(data) {
  if (data?.type === ADD2E_ATTACK_PLAYER_LOCAL_CHAT) {
    await createPersistentPlayerAttackChat(data.payload ?? {});
    return true;
  }

  if (data?.type === ADD2E_ATTACK_GM_DETAIL_CHAT) {
    if (!centralGmDetailRelayEnabled()) {
      console.log(`${LOG}[GM_DETAIL_SKIPPED_CENTRAL_DISABLED]`, {
        relayVersion: LOCAL_CHAT_VERSION,
        user: game.user?.name,
        isGM: game.user?.isGM,
        reason: "handled-by-04-attack-roll-legacy-relay",
        rollback: "globalThis.add2eUseCentralGmAttackDetailRelay()"
      });
      return false;
    }
    await createGmAttackDetailChat(data.payload ?? {});
    return true;
  }

  return false;
}

async function handleLegacyDamageFlag(data = {}) {
  if (!game.user?.isGM) return false;
  if (!isResponsibleGM()) return false;

  const flagData = data.flagData ?? {};
  const payload = {
    actorId: data.actorId,
    tokenId: data.tokenId,
    sceneId: data.sceneId ?? canvas?.scene?.id ?? null,
    montant: flagData.montant ?? data.montant ?? 0,
    type: flagData.type ?? data.damageType ?? "",
    details: flagData.details ?? data.details ?? "",
    source: flagData.source ?? data.source ?? "legacy-applyDamageFlag",
    fromUserId: flagData.fromUserId ?? data.fromUserId ?? null
  };

  console.log("[ADD2E][GM-RELAY][LEGACY_DAMAGE_FLAG][ROUTE]", {
    relayVersion: LOCAL_CHAT_VERSION,
    raw: data,
    payload
  });

  await applyDamage(payload);
  return true;
}

function registerAttackChatRelay() {
  if (!game?.socket?.on) {
    console.warn(`${LOG}[SOCKET_NOT_READY]`, {
      relayVersion: LOCAL_CHAT_VERSION,
      user: game.user?.name,
      isGM: game.user?.isGM,
      ready: game?.ready,
      hasSocket: !!game?.socket
    });
    return false;
  }

  if (globalThis.ADD2E_ATTACK_CHAT_RELAY_REGISTERED === LOCAL_CHAT_VERSION) return true;
  globalThis.ADD2E_ATTACK_CHAT_RELAY_REGISTERED = LOCAL_CHAT_VERSION;

  game.socket.on(ADD2E_SOCKET, async data => {
    if (data?.type !== ADD2E_ATTACK_PLAYER_LOCAL_CHAT && data?.type !== ADD2E_ATTACK_GM_DETAIL_CHAT) return;
    console.log(`${LOG}[SOCKET_RECEIVED]`, {
      relayVersion: LOCAL_CHAT_VERSION,
      user: game.user?.name,
      isGM: game.user?.isGM,
      type: data?.type,
      payloadVersion: data?.payload?.version,
      targets: data?.payload?.userIds ?? [],
      centralGmDetailRelayEnabled: centralGmDetailRelayEnabled()
    });
    await handleAttackChatSocket(data);
  });

  console.log(`${LOG}[REGISTERED]`, {
    relayVersion: LOCAL_CHAT_VERSION,
    user: game.user?.name,
    isGM: game.user?.isGM,
    ready: game?.ready,
    centralGmDetailRelayEnabled: centralGmDetailRelayEnabled()
  });
  return true;
}

function installAttackChatRelay() {
  if (registerAttackChatRelay()) return;
  Hooks.once("ready", registerAttackChatRelay);
  setTimeout(registerAttackChatRelay, 250);
  setTimeout(registerAttackChatRelay, 1000);
  setTimeout(registerAttackChatRelay, 2500);
}

function installGenericGmRelay() {
  if (globalThis.ADD2E_GM_OPERATION_RELAY_REGISTERED) {
    console.log("[ADD2E][GM-RELAY] Relais générique déjà enregistré ; relais chat attaque indépendant conservé.", {
      relayVersion: LOCAL_CHAT_VERSION,
      user: game.user?.name,
      isGM: game.user?.isGM
    });
    return;
  }

  globalThis.ADD2E_GM_OPERATION_RELAY_REGISTERED = true;

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

    if (data?.type === ADD2E_ATTACK_PLAYER_LOCAL_CHAT || data?.type === ADD2E_ATTACK_GM_DETAIL_CHAT) return;

    if (data?.type === "applyDamageFlag") {
      await handleLegacyDamageFlag(data);
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
}

installAttackChatRelay();
Hooks.once("ready", installGenericGmRelay);

globalThis.add2eUseCentralGmAttackDetailRelay = function add2eUseCentralGmAttackDetailRelay() {
  globalThis.ADD2E_ATTACK_GM_DETAIL_USE_CENTRAL_RELAY = true;
  console.warn(`${LOG}[ROLLBACK] Relais central GM_DETAIL réactivé. Recharge Foundry pour revenir au comportement par défaut.`, { relayVersion: LOCAL_CHAT_VERSION });
  return true;
};

globalThis.add2eUseLocalGmAttackDetailRelay = function add2eUseLocalGmAttackDetailRelay() {
  globalThis.ADD2E_ATTACK_GM_DETAIL_USE_CENTRAL_RELAY = false;
  console.warn(`${LOG}[DEFAULT] Relais central GM_DETAIL désactivé ; le relais local de 04-attack-roll.mjs gère le détail MJ.`, { relayVersion: LOCAL_CHAT_VERSION });
  return true;
};

globalThis.add2eAttackChatRelayDebug = function add2eAttackChatRelayDebug() {
  return {
    relayVersion: LOCAL_CHAT_VERSION,
    attackRelayRegistered: globalThis.ADD2E_ATTACK_CHAT_RELAY_REGISTERED,
    genericRelayRegistered: globalThis.ADD2E_GM_OPERATION_RELAY_REGISTERED,
    centralGmDetailRelayEnabled: centralGmDetailRelayEnabled(),
    rollbackEnableCentral: "globalThis.add2eUseCentralGmAttackDetailRelay()",
    defaultDisableCentral: "globalThis.add2eUseLocalGmAttackDetailRelay()",
    user: game.user?.name,
    userId: game.user?.id,
    isGM: game.user?.isGM,
    ready: game?.ready,
    hasSocket: !!game?.socket,
    players: Array.from(game.users ?? []).filter(u => !u.isGM).map(u => ({ id: u.id, name: u.name, active: u.active }))
  };
};
