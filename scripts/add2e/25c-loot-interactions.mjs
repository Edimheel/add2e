// ============================================================================
// ADD2E — Interactions complémentaires du butin
// Compatible Foundry V13/V14/V15.
//
// Ce module ne remplace pas le moteur de butin :
// - il réutilise son ApplicationV2 publique ;
// - il réutilise le transfert de monnaie partagé de 24-player-trades.mjs ;
// - il donne aux joueurs un accès OBSERVER aux monstres morts ;
// - il rend la feuille du monstre au clic dès que le butin est vide ;
// - il uniformise l'image des coffres et du marqueur de butin ;
// - il ne modifie jamais globalement ApplicationV2.prototype.
// ============================================================================

import {
  ADD2E_TRADE_COINS,
  ADD2E_TRADE_COIN_LABELS,
  add2eTradeGetMoney,
  add2eTradeHasMoney,
  add2eTradeTransferMoney
} from "./24-player-trades.mjs";
import {
  add2eIsDeadLootMonster,
  add2eIsLootChest,
  add2eIsLootSource,
  add2eOpenLoot
} from "./25-loot.mjs";
import { esc } from "./22a-vendor-core.mjs";

export const ADD2E_LOOT_INTERACTIONS_VERSION = "2026-07-12-loot-interactions-v3";

const ADD2E_LOOT_SOCKET = "system.add2e";
const ADD2E_LOOT_PARTIAL_REQUEST = "ADD2E_LOOT_PARTIAL_MONEY_REQUEST";
const ADD2E_LOOT_PARTIAL_RESULT = "ADD2E_LOOT_PARTIAL_MONEY_RESULT";
const ADD2E_LOOT_CHEST_IMG = "icons/containers/chest/chest-reinforced-steel-pink.webp";
const ADD2E_LOOT_OLD_CHEST_IMG = "icons/containers/chest/chest-reinforced-brown.webp";
const ADD2E_LOOT_STYLE_ID = "add2e-loot-interactions-style";
const ADD2E_LOOT_ACCESS_FLAG = "lootTemporaryObserverAccess";
const ADD2E_LOOT_MARKER_TEXTURES = new Set([ADD2E_LOOT_CHEST_IMG, ADD2E_LOOT_OLD_CHEST_IMG]);

const add2eLootPartialProcessed = new Set();
const add2eLootPartialHandled = new Set();
const add2eLootAccessRunning = new Set();

function add2eLootInteractionInt(value, minimum = 0) {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) ? Math.max(minimum, number) : minimum;
}

function add2eLootInteractionId(prefix = "loot-partial") {
  return `${prefix}-${Date.now()}-${foundry?.utils?.randomID?.() ?? Math.random().toString(36).slice(2)}`;
}

function add2eLootInteractionClone(value) {
  if (foundry?.utils?.deepClone) return foundry.utils.deepClone(value ?? {});
  if (foundry?.utils?.duplicate) return foundry.utils.duplicate(value ?? {});
  return JSON.parse(JSON.stringify(value ?? {}));
}

function add2eLootInteractionResponsibleGM() {
  if (!game.user?.isGM) return false;
  if (typeof game.user.isActiveGM === "boolean") return game.user.isActiveGM;
  const activeGM = game.users?.activeGM
    ?? Array.from(game.users ?? []).find(user => user.active && user.isGM)
    ?? null;
  return !activeGM || activeGM.id === game.user.id;
}

async function add2eLootInteractionFromUuid(uuid) {
  if (!uuid) return null;
  try {
    if (typeof fromUuid === "function") return await fromUuid(uuid);
    if (typeof foundry?.utils?.fromUuid === "function") return await foundry.utils.fromUuid(uuid);
  } catch (_error) {}
  return null;
}

function add2eLootInteractionMoney(raw = {}) {
  const money = {};
  for (const coin of ADD2E_TRADE_COINS) money[coin] = add2eLootInteractionInt(raw?.[coin], 0);
  return money;
}

function add2eLootInteractionHasContent(actor) {
  const markerApi = game.add2e?.lootTokenMarker;
  if (typeof markerApi?.hasContent === "function") return markerApi.hasContent(actor) === true;
  return add2eTradeHasMoney(add2eTradeGetMoney(actor));
}

function add2eLootInteractionTokenDocument(token) {
  return token?.document ?? token ?? null;
}

function add2eLootInteractionMarkerState(token) {
  const tokenDocument = add2eLootInteractionTokenDocument(token);
  if (!tokenDocument) return {};
  try {
    return tokenDocument.getFlag?.("add2e", "lootTokenMarker")
      ?? tokenDocument.flags?.add2e?.lootTokenMarker
      ?? {};
  } catch (_error) {
    return tokenDocument.flags?.add2e?.lootTokenMarker ?? {};
  }
}

function add2eLootInteractionIsMarkedToken(token) {
  const tokenDocument = add2eLootInteractionTokenDocument(token);
  const marker = add2eLootInteractionMarkerState(tokenDocument);
  const texture = String(tokenDocument?.texture?.src ?? "");
  return marker?.active === true
    || ADD2E_LOOT_MARKER_TEXTURES.has(texture)
    || texture === String(marker?.markerTexture ?? "");
}

function add2eLootInteractionUserCanReceive(user, actor) {
  if (!user || !actor || actor.type !== "personnage") return false;
  if (user.isGM) return true;
  return actor.testUserPermission?.(user, "OWNER") === true;
}

function add2eLootInteractionTargetPresent(target, tokenDocument) {
  const scene = tokenDocument?.parent ?? canvas?.scene ?? null;
  if (!scene?.tokens) return true;
  return Array.from(scene.tokens).some(token => token?.actorId === target?.id || token?.actor?.id === target?.id);
}

function add2eLootInteractionLocked(actor) {
  if (!add2eIsLootChest(actor)) return false;
  try {
    return actor.getFlag?.("add2e", "lootLocked") === true;
  } catch (_error) {
    return actor?.flags?.add2e?.lootLocked === true;
  }
}

async function add2eLootInteractionResolveSource(payload = {}) {
  const tokenDocument = await add2eLootInteractionFromUuid(payload.sourceTokenUuid);
  const tokenActor = tokenDocument?.actor ?? tokenDocument?.object?.actor ?? null;
  if (tokenActor) return { source: tokenActor, tokenDocument };

  const byUuid = await add2eLootInteractionFromUuid(payload.sourceActorUuid);
  const source = byUuid?.actor ?? byUuid ?? game.actors?.get?.(payload.sourceActorId) ?? null;
  return { source, tokenDocument: source?.token ?? null };
}

async function add2eLootInteractionResolveTarget(payload = {}) {
  const byUuid = await add2eLootInteractionFromUuid(payload.targetActorUuid);
  return byUuid?.actor ?? byUuid ?? game.actors?.get?.(payload.targetActorId) ?? null;
}

async function add2eLootInteractionSyncMarker(tokenDocument = null) {
  const markerApi = game.add2e?.lootTokenMarker;
  if (tokenDocument && typeof markerApi?.syncToken === "function") {
    await markerApi.syncToken(tokenDocument);
  }
  setTimeout(() => markerApi?.syncCanvas?.(), 80);
}

function add2eLootInteractionAccessState(actor) {
  try {
    return actor?.getFlag?.("add2e", ADD2E_LOOT_ACCESS_FLAG)
      ?? actor?.flags?.add2e?.[ADD2E_LOOT_ACCESS_FLAG]
      ?? {};
  } catch (_error) {
    return actor?.flags?.add2e?.[ADD2E_LOOT_ACCESS_FLAG] ?? {};
  }
}

async function add2eLootInteractionSyncObserverAccess(actor) {
  if (!add2eLootInteractionResponsibleGM() || !actor?.update || add2eIsLootChest(actor)) return false;

  const key = actor.uuid ?? actor.id ?? actor.name;
  if (!key || add2eLootAccessRunning.has(key)) return false;
  add2eLootAccessRunning.add(key);

  try {
    const state = add2eLootInteractionAccessState(actor);
    const currentOwnership = add2eLootInteractionClone(actor.ownership ?? actor._source?.ownership ?? {});
    const observer = Number(CONST?.DOCUMENT_OWNERSHIP_LEVELS?.OBSERVER ?? 2);
    const currentDefault = Number(currentOwnership.default ?? 0);
    const isDeadMonster = add2eIsDeadLootMonster(actor);

    if (isDeadMonster) {
      if (state?.active === true && currentDefault >= observer) return false;

      const originalOwnership = state?.active === true && state?.originalOwnership
        ? add2eLootInteractionClone(state.originalOwnership)
        : add2eLootInteractionClone(currentOwnership);
      const ownership = add2eLootInteractionClone(currentOwnership);
      ownership.default = Math.max(currentDefault, observer);

      await actor.update({
        ownership,
        [`flags.add2e.${ADD2E_LOOT_ACCESS_FLAG}`]: {
          active: true,
          originalOwnership,
          version: ADD2E_LOOT_INTERACTIONS_VERSION,
          grantedAt: Date.now()
        }
      }, { add2eLootObserverAccess: true });
      return true;
    }

    if (state?.active !== true) return false;
    const originalOwnership = add2eLootInteractionClone(state.originalOwnership ?? currentOwnership);
    await actor.update({
      ownership: originalOwnership,
      [`flags.add2e.${ADD2E_LOOT_ACCESS_FLAG}`]: {
        ...state,
        active: false,
        version: ADD2E_LOOT_INTERACTIONS_VERSION,
        restoredAt: Date.now()
      }
    }, { add2eLootObserverAccess: true });
    return true;
  } catch (error) {
    console.error("[ADD2E][LOOT_ACCESS] Synchronisation des permissions impossible", {
      actor: actor?.name ?? actor?.id ?? null,
      error
    });
    return false;
  } finally {
    add2eLootAccessRunning.delete(key);
  }
}

function add2eLootInteractionSyncSceneAccess() {
  if (!add2eLootInteractionResponsibleGM()) return;
  const actors = new Set();
  for (const token of canvas?.scene?.tokens?.contents ?? []) {
    if (token?.actor) actors.add(token.actor);
  }
  for (const actor of actors) void add2eLootInteractionSyncObserverAccess(actor);
}

async function add2eLootInteractionChat({ source, target, money }) {
  const parts = ADD2E_TRADE_COINS
    .map(coin => money[coin] > 0 ? `${money[coin]} ${ADD2E_TRADE_COIN_LABELS[coin]}` : "")
    .filter(Boolean)
    .join(", ");

  const content = `<div class="add2e-card add2e-loot-card">
    <div class="add2e-loot-chat-title"><i class="fas fa-coins"></i> Monnaie récupérée</div>
    <p><b>${esc(target.name)}</b> récupère <b>${esc(parts)}</b> sur <b>${esc(source.name)}</b>.</p>
  </div>`;

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker?.({ actor: target }) ?? {},
    content
  });
}

async function add2eLootInteractionExecutePartial(payload = {}) {
  const requestId = String(payload.requestId ?? "");
  if (!requestId || add2eLootPartialProcessed.has(requestId)) return null;
  if (add2eLootPartialProcessed.size > 500) add2eLootPartialProcessed.clear();
  add2eLootPartialProcessed.add(requestId);

  const user = game.users?.get?.(payload.userId) ?? null;
  const { source, tokenDocument } = await add2eLootInteractionResolveSource(payload);
  const target = await add2eLootInteractionResolveTarget(payload);
  const requested = add2eLootInteractionMoney(payload.money);

  if (!source || !add2eIsLootSource(source)) throw new Error("Cette source ne peut pas être fouillée.");
  if (!add2eLootInteractionUserCanReceive(user, target)) throw new Error("Le personnage receveur n'est pas autorisé.");
  if (!user?.isGM && !add2eLootInteractionTargetPresent(target, tokenDocument)) throw new Error("Le personnage receveur doit être présent sur la scène.");
  if (!user?.isGM && add2eLootInteractionLocked(source)) throw new Error("Ce coffre est verrouillé.");
  if (!add2eTradeHasMoney(requested)) throw new Error("Indique au moins une quantité de pièces à récupérer.");

  const transferred = await add2eTradeTransferMoney({ sourceActor: source, targetActor: target, money: requested });
  await add2eLootInteractionChat({ source, target, money: transferred });
  await add2eLootInteractionSyncMarker(tokenDocument);

  return {
    ok: true,
    message: `${target.name} récupère une partie de la monnaie de ${source.name}.`,
    sourceTokenUuid: tokenDocument?.uuid ?? payload.sourceTokenUuid ?? ""
  };
}

function add2eLootInteractionHandleResult(payload = {}) {
  if (payload.type !== ADD2E_LOOT_PARTIAL_RESULT) return;
  const requestId = String(payload.requestId ?? "");
  if (requestId && add2eLootPartialHandled.has(requestId)) return;
  if (requestId) {
    if (add2eLootPartialHandled.size > 500) add2eLootPartialHandled.clear();
    add2eLootPartialHandled.add(requestId);
  }

  if (payload.userId === game.user?.id) {
    if (payload.ok) ui.notifications?.info?.(payload.message);
    else ui.notifications?.error?.(payload.message);
  }
  setTimeout(() => game.add2e?.lootTokenMarker?.syncCanvas?.(), 80);
}

function add2eLootInteractionBroadcast(payload) {
  game.socket?.emit?.(ADD2E_LOOT_SOCKET, payload);
  add2eLootInteractionHandleResult(payload);
}

async function add2eLootInteractionHandleRequest(payload = {}) {
  if (!add2eLootInteractionResponsibleGM()) return;
  try {
    const result = await add2eLootInteractionExecutePartial(payload);
    if (!result) return;
    add2eLootInteractionBroadcast({
      type: ADD2E_LOOT_PARTIAL_RESULT,
      requestId: payload.requestId,
      userId: payload.userId,
      ...result
    });
  } catch (error) {
    add2eLootInteractionBroadcast({
      type: ADD2E_LOOT_PARTIAL_RESULT,
      requestId: payload.requestId,
      userId: payload.userId,
      ok: false,
      message: `Récupération impossible : ${error?.message ?? error}`
    });
  }
}

function add2eLootInteractionHandleSocket(payload = {}) {
  if (!payload || typeof payload !== "object") return;
  if (payload.type === ADD2E_LOOT_PARTIAL_REQUEST) return add2eLootInteractionHandleRequest(payload);
  if (payload.type === ADD2E_LOOT_PARTIAL_RESULT) return add2eLootInteractionHandleResult(payload);
}

function add2eLootInteractionAppElement(app) {
  const element = app?.element;
  return element?.jquery ? element[0] : element ?? null;
}

function add2eLootInteractionFindApp(shell) {
  for (const app of globalThis.__ADD2E_LOOT_APPS?.values?.() ?? []) {
    const element = add2eLootInteractionAppElement(app);
    if (!element) continue;
    if (element === shell || element.contains?.(shell) || shell.contains?.(element)) return app;
  }
  return null;
}

function add2eLootInteractionEnsureStyles() {
  if (!document?.head || document.getElementById(ADD2E_LOOT_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = ADD2E_LOOT_STYLE_ID;
  style.textContent = `
    .add2e-loot-partial-money{margin:0 10px 10px;padding:9px;border:1px solid #8b6b22;border-radius:9px;background:linear-gradient(180deg,#fff5c9,#e6cf82)}
    .add2e-loot-partial-title{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:7px;color:#4c390c;font-weight:900}
    .add2e-loot-partial-grid{display:grid;grid-template-columns:repeat(5,minmax(58px,1fr));gap:6px}
    .add2e-loot-partial-field{display:flex;flex-direction:column;gap:3px;padding:5px;border:1px solid #a4842f;border-radius:7px;background:#fff9de;text-align:center}
    .add2e-loot-partial-field span{font-size:.72rem;font-weight:900;color:#5d470f}
    .add2e-loot-partial-field small{font-size:.66rem;color:#7d6420}
    .add2e-loot-partial-field input{width:100%;min-width:0;text-align:center;font-weight:900}
    .add2e-loot-partial-actions{display:flex;justify-content:flex-end;margin-top:8px}
    @media(max-width:720px){.add2e-loot-partial-grid{grid-template-columns:repeat(3,1fr)}}
  `;
  document.head.appendChild(style);
}

function add2eLootInteractionMoneyPanel(shell) {
  return Array.from(shell?.querySelectorAll?.(".add2e-loot-panel") ?? [])
    .find(panel => panel.querySelector?.(".add2e-loot-panel-title")?.textContent?.includes("Monnaie")) ?? null;
}

function add2eLootInteractionEnhanceShell(shell) {
  if (!shell?.querySelector || shell.dataset.add2ePartialMoney === "true") return;
  shell.dataset.add2ePartialMoney = "true";

  const app = add2eLootInteractionFindApp(shell);
  const source = app?.source ?? null;
  const looter = app?.looter ?? null;
  if (!source || !looter) return;

  // La fermeture d'un butin vide reste locale à l'application de butin.
  // Aucune surcharge globale d'ApplicationV2 n'est nécessaire.
  if (add2eIsDeadLootMonster(source) && !add2eLootInteractionHasContent(source)) {
    void app.close?.();
    void add2eLootInteractionSyncMarker(app?.token?.document ?? app?.token ?? source?.token ?? null);
    return;
  }

  const wallet = add2eTradeGetMoney(source);
  if (!add2eTradeHasMoney(wallet)) return;

  const panel = add2eLootInteractionMoneyPanel(shell);
  if (!panel || panel.querySelector(".add2e-loot-partial-money")) return;

  const fields = ADD2E_TRADE_COINS.map(coin => {
    const available = add2eLootInteractionInt(wallet[coin], 0);
    return `<label class="add2e-loot-partial-field">
      <span>${ADD2E_TRADE_COIN_LABELS[coin]}</span>
      <input type="number" min="0" max="${available}" step="1" value="0" data-add2e-partial-coin="${coin}">
      <small>sur ${available}</small>
    </label>`;
  }).join("");

  const partial = document.createElement("div");
  partial.className = "add2e-loot-partial-money";
  partial.innerHTML = `<div class="add2e-loot-partial-title"><span><i class="fas fa-coins"></i> Prendre une partie des pièces</span><small>Quantité par monnaie</small></div>
    <div class="add2e-loot-partial-grid">${fields}</div>
    <div class="add2e-loot-partial-actions"><button type="button" class="add2e-loot-button gold" data-add2e-take-partial-money><i class="fas fa-hand-holding-usd"></i> Récupérer les quantités</button></div>`;
  panel.appendChild(partial);
}

function add2eLootInteractionEnhanceAll(root = document) {
  add2eLootInteractionEnsureStyles();
  if (root?.matches?.(".add2e-loot-shell")) add2eLootInteractionEnhanceShell(root);
  for (const shell of root?.querySelectorAll?.(".add2e-loot-shell") ?? []) add2eLootInteractionEnhanceShell(shell);
}

function add2eLootInteractionRequestPartial(app, money) {
  const payload = {
    type: ADD2E_LOOT_PARTIAL_REQUEST,
    requestId: add2eLootInteractionId(),
    userId: game.user.id,
    sourceActorId: app.source?.id ?? null,
    sourceActorUuid: app.source?.uuid ?? null,
    sourceTokenUuid: app.token?.document?.uuid ?? app.token?.uuid ?? app.source?.token?.uuid ?? null,
    targetActorId: app.looter?.id ?? null,
    targetActorUuid: app.looter?.uuid ?? null,
    money
  };

  if (game.user?.isGM) return add2eLootInteractionHandleRequest(payload);
  game.socket?.emit?.(ADD2E_LOOT_SOCKET, payload);
  return true;
}

function add2eLootInteractionHandlePartialClick(event) {
  const button = event.target?.closest?.("[data-add2e-take-partial-money]");
  if (!button) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();

  const shell = button.closest(".add2e-loot-shell");
  const app = add2eLootInteractionFindApp(shell);
  if (!app?.source || !app?.looter) return ui.notifications?.warn?.("Sélectionne un personnage receveur.");

  const money = {};
  const wallet = add2eTradeGetMoney(app.source);
  for (const coin of ADD2E_TRADE_COINS) {
    const input = shell.querySelector(`[data-add2e-partial-coin="${coin}"]`);
    const available = add2eLootInteractionInt(wallet[coin], 0);
    money[coin] = Math.min(available, add2eLootInteractionInt(input?.value, 0));
  }
  if (!add2eTradeHasMoney(money)) return ui.notifications?.warn?.("Indique au moins une quantité de pièces.");
  void add2eLootInteractionRequestPartial(app, money);
}

function add2eLootInteractionStopEvent(event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();
  event?.stopImmediatePropagation?.();
  event?.data?.originalEvent?.preventDefault?.();
  event?.data?.originalEvent?.stopPropagation?.();
}

async function add2eLootInteractionOpenMonsterSheet(actor) {
  const sheet = actor?.sheet;
  if (!sheet?.render) return ui.notifications?.warn?.("La feuille de ce monstre n'est pas disponible.");
  try {
    return await sheet.render({ force: true });
  } catch (_error) {
    return sheet.render(true);
  }
}

function add2eLootInteractionPatchTokenMethod(prototype, method) {
  const marker = `__add2eLootInteraction_${method}`;
  if (!prototype || typeof prototype[method] !== "function" || prototype[marker]) return;
  prototype[marker] = true;

  const original = prototype[method];
  prototype[method] = function(event) {
    const actor = this.actor ?? this.document?.actor ?? null;
    const isChest = add2eIsLootChest(actor);
    const isDeadMonster = add2eIsDeadLootMonster(actor);
    const isMarkedToken = add2eLootInteractionIsMarkedToken(this);
    const hasContent = add2eLootInteractionHasContent(actor);

    if (!isChest && !isDeadMonster && !isMarkedToken) return original.call(this, event);
    if (game.user?.isGM && (event?.shiftKey === true || event?.data?.originalEvent?.shiftKey === true)) {
      return original.call(this, event);
    }

    add2eLootInteractionStopEvent(event);

    if (!isChest && !hasContent) {
      void add2eLootInteractionSyncMarker(this.document ?? actor?.token ?? null);
      void add2eLootInteractionOpenMonsterSheet(actor);
      return false;
    }

    void add2eOpenLoot({ source: actor, token: this });
    return false;
  };
}

function add2eLootInteractionPatchTokenClicks() {
  const TokenClass = foundry?.canvas?.placeables?.Token ?? CONFIG?.Token?.objectClass ?? globalThis.Token;
  const prototype = TokenClass?.prototype;
  add2eLootInteractionPatchTokenMethod(prototype, "_onClickLeft");
  add2eLootInteractionPatchTokenMethod(prototype, "_onClickLeft2");
}

async function add2eLootInteractionEnsureChestImage(actor) {
  if (!actor || !add2eIsLootChest(actor)) return actor;
  const updates = {};
  if (actor.img !== ADD2E_LOOT_CHEST_IMG) updates.img = ADD2E_LOOT_CHEST_IMG;
  if (actor.prototypeToken?.texture?.src !== ADD2E_LOOT_CHEST_IMG) updates["prototypeToken.texture.src"] = ADD2E_LOOT_CHEST_IMG;
  if (Object.keys(updates).length) await actor.update(updates, { add2eLootChestImage: true });

  for (const scene of game.scenes ?? []) {
    const tokenUpdates = [];
    for (const token of scene.tokens?.contents ?? []) {
      if (token.actorId !== actor.id || token.texture?.src === ADD2E_LOOT_CHEST_IMG) continue;
      tokenUpdates.push({ _id: token.id, "texture.src": ADD2E_LOOT_CHEST_IMG });
    }
    if (tokenUpdates.length) await scene.updateEmbeddedDocuments("Token", tokenUpdates, { add2eLootChestImage: true });
  }
  return actor;
}

function add2eLootInteractionWrapChestCreation() {
  const api = game.add2e?.loot;
  if (!api || typeof api.createChest !== "function" || api.__add2ePinkChestWrapped) return;
  api.__add2ePinkChestWrapped = true;
  const original = api.createChest.bind(api);
  api.createChest = async options => add2eLootInteractionEnsureChestImage(await original(options));
}

function add2eLootInteractionInstallObserver() {
  globalThis.__ADD2E_LOOT_INTERACTION_OBSERVER?.disconnect?.();
  const observer = new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.addedNodes ?? []) {
        if (node instanceof HTMLElement) add2eLootInteractionEnhanceAll(node);
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  add2eLootInteractionEnhanceAll(document);
  globalThis.__ADD2E_LOOT_INTERACTION_OBSERVER = observer;
}

Hooks.once("ready", () => {
  add2eLootInteractionEnsureStyles();
  add2eLootInteractionPatchTokenClicks();
  add2eLootInteractionWrapChestCreation();
  add2eLootInteractionInstallObserver();

  game.socket?.on?.(ADD2E_LOOT_SOCKET, add2eLootInteractionHandleSocket);
  document.addEventListener("click", add2eLootInteractionHandlePartialClick, true);

  Hooks.on("canvasReady", () => {
    add2eLootInteractionPatchTokenClicks();
    add2eLootInteractionSyncSceneAccess();
    setTimeout(() => game.add2e?.lootTokenMarker?.syncCanvas?.(), 80);
  });
  Hooks.on("createToken", tokenDocument => void add2eLootInteractionSyncObserverAccess(tokenDocument?.actor));
  Hooks.on("updateActor", (actor, _changes, options = {}) => {
    if (options?.add2eLootObserverAccess !== true) void add2eLootInteractionSyncObserverAccess(actor);
    setTimeout(() => game.add2e?.lootTokenMarker?.syncCanvas?.(), 80);
  });
  Hooks.on("createActor", actor => {
    void add2eLootInteractionEnsureChestImage(actor);
    void add2eLootInteractionSyncObserverAccess(actor);
  });
  Hooks.on("createItem", item => {
    void add2eLootInteractionSyncObserverAccess(item?.parent ?? item?.actor);
    setTimeout(() => game.add2e?.lootTokenMarker?.syncCanvas?.(), 80);
  });
  Hooks.on("updateItem", item => {
    void add2eLootInteractionSyncObserverAccess(item?.parent ?? item?.actor);
    setTimeout(() => game.add2e?.lootTokenMarker?.syncCanvas?.(), 80);
  });
  Hooks.on("deleteItem", item => {
    void add2eLootInteractionSyncObserverAccess(item?.parent ?? item?.actor);
    setTimeout(() => game.add2e?.lootTokenMarker?.syncCanvas?.(), 80);
  });

  for (const actor of game.actors ?? []) {
    void add2eLootInteractionEnsureChestImage(actor);
    void add2eLootInteractionSyncObserverAccess(actor);
  }
  add2eLootInteractionSyncSceneAccess();

  game.add2e ??= {};
  game.add2e.lootInteractions = {
    version: ADD2E_LOOT_INTERACTIONS_VERSION,
    chestImage: ADD2E_LOOT_CHEST_IMG,
    ensureChestImage: add2eLootInteractionEnsureChestImage,
    syncObserverAccess: add2eLootInteractionSyncObserverAccess,
    requestPartialMoney: add2eLootInteractionRequestPartial
  };
  globalThis.ADD2E_LOOT_INTERACTIONS_VERSION = ADD2E_LOOT_INTERACTIONS_VERSION;
});
