// ============================================================================
// ADD2E — Coffres et récupération de butin
// ApplicationV2 / DialogV2 — Compatible Foundry V13/V14/V15.
// Réutilise le cœur vendeur pour la monnaie, les quantités et les dialogues,
// ainsi que le moteur d'états vitaux pour déterminer les monstres morts.
// ============================================================================

import {
  COINS,
  alertBox,
  dialog,
  esc,
  getMoney,
  quantity,
  quantityUpdate,
  setMoney,
  slug
} from "./22a-vendor-core.mjs";
import {
  add2eVitalDesiredStatus,
  add2eVitalEffectKind,
  add2eVitalIsMonster
} from "./18a-vital-status-core.mjs";

export const ADD2E_LOOT_VERSION = "2026-07-12-loot-v1";

const ADD2E_LOOT_SOCKET = "system.add2e";
const ADD2E_LOOT_REQUEST = "ADD2E_LOOT_REQUEST";
const ADD2E_LOOT_RESULT = "ADD2E_LOOT_RESULT";
const ADD2E_LOOT_FOLDER = "ADD2E — Coffres";
const ADD2E_LOOT_CHEST_IMG = "icons/containers/chest/chest-reinforced-brown.webp";
const ADD2E_LOOT_STYLE_ID = "add2e-loot-style";
const ADD2E_LOOT_ITEM_TYPES = new Set([
  "arme", "weapon", "armure", "armor", "objet", "item",
  "equipement", "equipment", "consommable", "consumable", "loot", "conteneur", "container"
]);

const add2eLootProcessedRequests = new Set();
const add2eLootHandledResults = new Set();
const add2eLootSourceLocks = new Set();

function add2eLootApplicationV2() {
  return foundry?.applications?.api?.ApplicationV2 ?? null;
}

function add2eLootDialogV2() {
  return foundry?.applications?.api?.DialogV2 ?? null;
}

function add2eLootInt(value, minimum = 0) {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) ? Math.max(minimum, number) : minimum;
}

function add2eLootRandomId(prefix = "loot") {
  return `${prefix}-${Date.now()}-${foundry?.utils?.randomID?.() ?? Math.random().toString(36).slice(2)}`;
}

function add2eLootActorFlag(actor, key, fallback = null) {
  try {
    const value = actor?.getFlag?.("add2e", key);
    return value === undefined ? fallback : value;
  } catch (_error) {
    const value = actor?.flags?.add2e?.[key];
    return value === undefined ? fallback : value;
  }
}

export function add2eIsLootChest(actor) {
  return add2eLootActorFlag(actor, "isLootContainer", false) === true;
}

function add2eLootHasDeadStatus(actor) {
  return Array.from(actor?.effects ?? []).some(effect => add2eVitalEffectKind(effect) === "dead");
}

export function add2eIsDeadLootMonster(actor) {
  if (!actor || !add2eVitalIsMonster(actor)) return false;
  return add2eVitalDesiredStatus(actor) === "dead" || add2eLootHasDeadStatus(actor);
}

export function add2eIsLootSource(actor) {
  return add2eIsLootChest(actor) || add2eIsDeadLootMonster(actor);
}

function add2eLootIsLocked(actor) {
  return add2eIsLootChest(actor) && add2eLootActorFlag(actor, "lootLocked", false) === true;
}

function add2eLootItemQuantity(item) {
  const raw = item?.system?.quantite ?? item?.system?.quantity;
  if (raw === undefined || raw === null || raw === "") return 1;
  return Math.max(0, quantity(item));
}

function add2eLootIsPhysicalItem(item) {
  if (!item || !ADD2E_LOOT_ITEM_TYPES.has(String(item.type ?? "").toLowerCase())) return false;
  const system = item.system ?? {};
  const flags = item.flags?.add2e ?? {};
  if (flags.naturalAttack === true || flags.isNaturalAttack === true) return false;
  if (system.naturalAttack === true || system.isNaturalAttack === true || system.naturelle === true) return false;
  return add2eLootItemQuantity(item) > 0;
}

function add2eLootItems(actor) {
  return Array.from(actor?.items ?? [])
    .filter(add2eLootIsPhysicalItem)
    .sort((left, right) => String(left.name ?? "").localeCompare(String(right.name ?? ""), "fr"));
}

function add2eLootMoneyLabel(money = {}) {
  const parts = COINS
    .map(coin => {
      const amount = add2eLootInt(money?.[coin.key], 0);
      return amount > 0 ? `${amount} ${coin.label}` : "";
    })
    .filter(Boolean);
  return parts.length ? parts.join(", ") : "Aucune monnaie";
}

function add2eLootHasMoney(money = {}) {
  return COINS.some(coin => add2eLootInt(money?.[coin.key], 0) > 0);
}

function add2eLootMoneyInputs(money = {}) {
  return COINS.map(coin => `
    <label class="add2e-loot-coin-field">
      <span>${coin.label}</span>
      <input type="number" min="0" step="1" name="loot-${coin.key}" value="${add2eLootInt(money?.[coin.key], 0)}">
    </label>`).join("");
}

function add2eLootReadMoney(root) {
  const money = {};
  for (const coin of COINS) {
    money[coin.key] = add2eLootInt(root?.querySelector?.(`[name="loot-${coin.key}"]`)?.value, 0);
  }
  return money;
}

function add2eLootFindStack(actor, itemData) {
  const itemQuantity = Number(itemData?.system?.quantite ?? itemData?.system?.quantity);
  if (!Number.isFinite(itemQuantity)) return null;
  const wantedName = slug(itemData?.name);
  const wantedType = String(itemData?.type ?? "").toLowerCase();
  return Array.from(actor?.items ?? []).find(item => {
    const current = Number(item?.system?.quantite ?? item?.system?.quantity);
    if (!Number.isFinite(current)) return false;
    return String(item.type ?? "").toLowerCase() === wantedType && slug(item.name) === wantedName;
  }) ?? null;
}

async function add2eLootAddItem(actor, sourceItem, amount) {
  amount = add2eLootInt(amount, 1);
  const data = sourceItem?.toObject
    ? sourceItem.toObject()
    : foundry.utils.deepClone(sourceItem ?? {});
  delete data._id;
  data.system ??= {};
  data.system.quantite = amount;
  data.system.equipee = false;
  data.flags ??= {};
  data.flags.add2e ??= {};
  data.flags.add2e.recoveredAsLoot = true;

  const stack = add2eLootFindStack(actor, data);
  if (stack) {
    await stack.update(quantityUpdate(add2eLootItemQuantity(stack) + amount), { add2eReason: "loot-receive-merge" });
    return stack;
  }

  const created = await actor.createEmbeddedDocuments("Item", [data], { add2eReason: "loot-receive-create" });
  return created?.[0] ?? null;
}

async function add2eLootRemoveItem(actor, item, amount) {
  amount = add2eLootInt(amount, 1);
  const current = add2eLootItemQuantity(item);
  if (amount >= current) {
    await actor.deleteEmbeddedDocuments("Item", [item.id], { add2eReason: "loot-source-delete" });
  } else {
    await item.update(quantityUpdate(current - amount), { add2eReason: "loot-source-decrease" });
  }
}

async function add2eLootTransferItemLocal({ source, target, itemId, amount }) {
  const item = source?.items?.get?.(itemId) ?? null;
  if (!item || !add2eLootIsPhysicalItem(item)) throw new Error("Objet de butin introuvable ou non récupérable.");
  amount = add2eLootInt(amount, 1);
  const available = add2eLootItemQuantity(item);
  if (amount < 1 || amount > available) throw new Error(`${item.name} : quantité disponible ${available}.`);

  const itemData = item.toObject();
  await add2eLootRemoveItem(source, item, amount);
  await add2eLootAddItem(target, itemData, amount);
  return { items: [{ name: item.name, quantity: amount, img: item.img ?? "" }], money: {} };
}

async function add2eLootTransferMoneyLocal({ source, target }) {
  const sourceMoney = getMoney(source);
  if (!add2eLootHasMoney(sourceMoney)) throw new Error("Aucune monnaie à récupérer.");

  const targetMoney = getMoney(target);
  const transferred = {};
  for (const coin of COINS) {
    const amount = add2eLootInt(sourceMoney[coin.key], 0);
    transferred[coin.key] = amount;
    sourceMoney[coin.key] = 0;
    targetMoney[coin.key] = add2eLootInt(targetMoney[coin.key], 0) + amount;
  }

  await setMoney(source, sourceMoney);
  await setMoney(target, targetMoney);
  return { items: [], money: transferred };
}

async function add2eLootTransferAllLocal({ source, target }) {
  const transferredItems = [];
  for (const item of [...add2eLootItems(source)]) {
    const amount = add2eLootItemQuantity(item);
    if (amount < 1) continue;
    const itemData = item.toObject();
    await add2eLootRemoveItem(source, item, amount);
    await add2eLootAddItem(target, itemData, amount);
    transferredItems.push({ name: item.name, quantity: amount, img: item.img ?? "" });
  }

  const sourceMoney = getMoney(source);
  let transferredMoney = {};
  if (add2eLootHasMoney(sourceMoney)) {
    const moneyResult = await add2eLootTransferMoneyLocal({ source, target });
    transferredMoney = moneyResult.money;
  }

  if (!transferredItems.length && !add2eLootHasMoney(transferredMoney)) {
    throw new Error("Ce butin est vide.");
  }
  return { items: transferredItems, money: transferredMoney };
}

function add2eLootResponsibleGM() {
  if (!game.user?.isGM) return false;
  if (typeof game.user.isActiveGM === "boolean") return game.user.isActiveGM;
  const activeGM = game.users?.activeGM ?? Array.from(game.users ?? []).find(user => user.active && user.isGM) ?? null;
  return !activeGM || activeGM.id === game.user.id;
}

async function add2eLootFromUuid(uuid) {
  if (!uuid) return null;
  try {
    if (typeof fromUuid === "function") return await fromUuid(uuid);
    if (typeof foundry?.utils?.fromUuid === "function") return await foundry.utils.fromUuid(uuid);
  } catch (_error) {}
  return null;
}

async function add2eLootResolveSource(payload = {}) {
  const tokenDocument = await add2eLootFromUuid(payload.sourceTokenUuid);
  const tokenActor = tokenDocument?.actor ?? tokenDocument?.object?.actor ?? null;
  if (tokenActor) return { actor: tokenActor, tokenDocument };

  const byUuid = await add2eLootFromUuid(payload.sourceActorUuid);
  const actor = byUuid?.actor ?? byUuid ?? game.actors?.get?.(payload.sourceActorId) ?? null;
  return { actor, tokenDocument: actor?.token ?? null };
}

async function add2eLootResolveTarget(payload = {}) {
  const byUuid = await add2eLootFromUuid(payload.targetActorUuid);
  return byUuid?.actor ?? byUuid ?? game.actors?.get?.(payload.targetActorId) ?? null;
}

function add2eLootTargetIsPresent(target, tokenDocument) {
  const scene = tokenDocument?.parent ?? canvas?.scene ?? null;
  if (!scene?.tokens) return true;
  return Array.from(scene.tokens).some(token => token?.actorId === target?.id || token?.actor?.id === target?.id);
}

function add2eLootUserCanReceive(user, actor) {
  if (!user || !actor || actor.type !== "personnage") return false;
  if (user.isGM) return true;
  return actor.testUserPermission?.(user, "OWNER") === true;
}

function add2eLootSourceKey(actor, tokenDocument = null) {
  return tokenDocument?.uuid ?? actor?.uuid ?? actor?.id ?? "unknown";
}

function add2eLootRememberRequest(requestId) {
  if (!requestId) return false;
  if (add2eLootProcessedRequests.has(requestId)) return true;
  if (add2eLootProcessedRequests.size > 500) add2eLootProcessedRequests.clear();
  add2eLootProcessedRequests.add(requestId);
  return false;
}

function add2eLootResultMessage(source, target, result) {
  const itemCount = result.items?.reduce((sum, item) => sum + add2eLootInt(item.quantity, 0), 0) ?? 0;
  const parts = [];
  if (itemCount > 0) parts.push(`${itemCount} objet(s)`);
  if (add2eLootHasMoney(result.money)) parts.push(add2eLootMoneyLabel(result.money));
  return `${target.name} récupère ${parts.join(" et ")} sur ${source.name}.`;
}

async function add2eLootCreateChatMessage({ source, target, result }) {
  const itemRows = (result.items ?? []).map(item => `
    <li><img src="${esc(item.img || "icons/svg/item-bag.svg")}" alt="" width="24" height="24"> <b>${add2eLootInt(item.quantity, 1)} × ${esc(item.name)}</b></li>`).join("");
  const money = add2eLootHasMoney(result.money)
    ? `<div class="add2e-loot-chat-money"><i class="fas fa-coins"></i> ${esc(add2eLootMoneyLabel(result.money))}</div>`
    : "";
  const content = `
    <div class="add2e-card add2e-loot-card">
      <div class="add2e-loot-chat-title"><i class="fas fa-box-open"></i> Butin récupéré</div>
      <p><b>${esc(target.name)}</b> fouille <b>${esc(source.name)}</b>.</p>
      ${itemRows ? `<ul class="add2e-loot-chat-items">${itemRows}</ul>` : ""}
      ${money}
    </div>`;
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker?.({ actor: target }) ?? {},
    content
  });
}

async function add2eLootExecuteRequest(payload = {}) {
  const requestId = String(payload.requestId ?? "");
  if (add2eLootRememberRequest(requestId)) return null;

  const user = game.users?.get?.(payload.userId) ?? null;
  const { actor: source, tokenDocument } = await add2eLootResolveSource(payload);
  const target = await add2eLootResolveTarget(payload);
  if (!source || !add2eIsLootSource(source)) throw new Error("Cette source ne peut pas être fouillée.");
  if (!add2eLootUserCanReceive(user, target)) throw new Error("Le personnage receveur n'est pas autorisé.");
  if (!user?.isGM && !add2eLootTargetIsPresent(target, tokenDocument)) throw new Error("Le personnage receveur doit être présent sur la scène.");
  if (!user?.isGM && add2eLootIsLocked(source)) throw new Error("Ce coffre est verrouillé.");

  const sourceKey = add2eLootSourceKey(source, tokenDocument);
  if (add2eLootSourceLocks.has(sourceKey)) throw new Error("Ce butin est déjà en cours de récupération.");
  add2eLootSourceLocks.add(sourceKey);

  try {
    let result;
    if (payload.action === "item") {
      result = await add2eLootTransferItemLocal({ source, target, itemId: payload.itemId, amount: payload.quantity });
    } else if (payload.action === "money") {
      result = await add2eLootTransferMoneyLocal({ source, target });
    } else if (payload.action === "all") {
      result = await add2eLootTransferAllLocal({ source, target });
    } else {
      throw new Error("Action de butin inconnue.");
    }

    const message = add2eLootResultMessage(source, target, result);
    await add2eLootCreateChatMessage({ source, target, result });
    return { ok: true, message, result, sourceKey, targetActorId: target.id };
  } finally {
    add2eLootSourceLocks.delete(sourceKey);
  }
}

function add2eLootHandleResult(payload) {
  if (payload?.type !== ADD2E_LOOT_RESULT) return;
  const resultKey = String(payload.requestId ?? "");
  if (resultKey && add2eLootHandledResults.has(resultKey)) return;
  if (resultKey) {
    if (add2eLootHandledResults.size > 500) add2eLootHandledResults.clear();
    add2eLootHandledResults.add(resultKey);
  }

  if (payload.userId === game.user?.id) {
    if (payload.ok) ui.notifications?.info?.(payload.message);
    else ui.notifications?.error?.(payload.message);
  } else if (game.user?.isGM && !payload.ok) {
    ui.notifications?.warn?.(payload.message);
  }
  add2eLootRefreshApps(payload.sourceKey ?? "");
}

function add2eLootBroadcastResult(payload) {
  game.socket?.emit?.(ADD2E_LOOT_SOCKET, payload);
  add2eLootHandleResult(payload);
}

async function add2eLootHandleRequest(payload) {
  if (!add2eLootResponsibleGM()) return;
  try {
    const result = await add2eLootExecuteRequest(payload);
    if (!result) return;
    add2eLootBroadcastResult({
      type: ADD2E_LOOT_RESULT,
      requestId: payload.requestId,
      userId: payload.userId,
      ...result
    });
  } catch (error) {
    add2eLootBroadcastResult({
      type: ADD2E_LOOT_RESULT,
      requestId: payload.requestId,
      userId: payload.userId,
      ok: false,
      message: `Récupération impossible : ${error?.message ?? error}`,
      sourceKey: payload.sourceTokenUuid ?? payload.sourceActorUuid ?? payload.sourceActorId ?? ""
    });
  }
}

function add2eLootRegistry() {
  return globalThis.__ADD2E_LOOT_APPS ??= new Map();
}

function add2eLootRefreshApps(sourceKey = "") {
  for (const app of add2eLootRegistry().values()) {
    if (!app?.rendered) continue;
    if (sourceKey && app.sourceKey !== sourceKey && app.source?.uuid !== sourceKey && app.source?.id !== sourceKey) continue;
    app.render({ force: true });
  }
}

function add2eLootHandleSocket(payload) {
  if (!payload || typeof payload !== "object") return;
  if (payload.type === ADD2E_LOOT_REQUEST) return add2eLootHandleRequest(payload);
  if (payload.type === ADD2E_LOOT_RESULT) return add2eLootHandleResult(payload);
}

function add2eLootDefaultLooter() {
  const character = game.user?.character;
  if (character?.type === "personnage" && (game.user?.isGM || character.isOwner)) return character;
  const controlled = Array.from(canvas?.tokens?.controlled ?? [])
    .map(token => token?.actor)
    .find(actor => actor?.type === "personnage" && (game.user?.isGM || actor.isOwner));
  return controlled ?? null;
}

function add2eLootSceneCharacters() {
  const actors = new Map();
  for (const token of canvas?.tokens?.placeables ?? []) {
    const actor = token?.actor;
    if (actor?.type === "personnage" && actor.id) actors.set(actor.id, actor);
  }
  return [...actors.values()].sort((left, right) => String(left.name).localeCompare(String(right.name), "fr"));
}

function add2eLootItemIcon(item) {
  const type = String(item?.type ?? "").toLowerCase();
  if (type === "arme" || type === "weapon") return "fas fa-swords";
  if (type === "armure" || type === "armor") return "fas fa-shield-alt";
  return "fas fa-gem";
}

function add2eLootTypeLabel(item) {
  const type = String(item?.type ?? "objet").toLowerCase();
  if (type === "arme" || type === "weapon") return "Arme";
  if (type === "armure" || type === "armor") return "Armure";
  return "Objet";
}

function add2eLootStyles() {
  return `
    .add2e-loot-app{background:linear-gradient(180deg,#d8eadf 0%,#b8d3c6 100%);color:#172b25;font-family:var(--font-primary)}
    .add2e-loot-app .window-content{padding:0;background:transparent}
    .add2e-loot-shell{min-height:100%;padding:12px;background:radial-gradient(circle at 10% 0%,rgba(255,255,230,.72),transparent 38%),linear-gradient(180deg,#dcecdf,#b5d0c4)}
    .add2e-loot-header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 13px;border:2px solid #224f45;border-radius:10px;background:linear-gradient(180deg,#397c6a,#245447);color:#f8f2cf;box-shadow:inset 0 1px 0 rgba(255,255,255,.25),0 3px 9px rgba(22,56,47,.3)}
    .add2e-loot-header h2{margin:0;font-size:1.15rem}.add2e-loot-header i{color:#f1c85d}.add2e-loot-header small{font-weight:900;color:#d7efdf}
    .add2e-loot-summary{display:grid;grid-template-columns:minmax(0,1fr) 32px minmax(0,1fr);gap:8px;align-items:center;margin:10px 0}
    .add2e-loot-actor{display:flex;align-items:center;gap:8px;min-width:0;padding:8px;border:1px solid #53796d;border-radius:9px;background:rgba(250,255,242,.78);font-weight:900}
    .add2e-loot-actor img{width:38px;height:38px;object-fit:cover;border:1px solid #315e52;border-radius:7px}.add2e-loot-actor span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .add2e-loot-arrow{text-align:center;color:#286354;font-size:1.1rem}
    .add2e-loot-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:7px;margin:0 0 10px;padding:8px;border:1px solid #65887e;border-radius:9px;background:rgba(241,250,231,.72)}
    .add2e-loot-toolbar select{min-width:190px;max-width:280px}.add2e-loot-toolbar .spacer{flex:1}
    .add2e-loot-button{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:30px;padding:5px 10px;border:1px solid #245447;border-radius:7px;background:linear-gradient(180deg,#3d806e,#255649);color:#fff6d8;font-weight:900;cursor:pointer;box-shadow:inset 0 1px 0 rgba(255,255,255,.22),0 2px 5px rgba(24,57,48,.24)}
    .add2e-loot-button:hover{filter:brightness(1.08)}.add2e-loot-button.gold{border-color:#795b16;background:linear-gradient(180deg,#c89e36,#8d6618);color:#fff8dd}.add2e-loot-button.danger{border-color:#6e2923;background:linear-gradient(180deg,#a94d3f,#713127)}
    .add2e-loot-panel{margin-bottom:10px;border:1px solid #557b70;border-radius:10px;background:rgba(250,255,242,.78);overflow:hidden;box-shadow:0 2px 7px rgba(28,69,58,.16)}
    .add2e-loot-panel-title{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 11px;background:linear-gradient(180deg,#315f52,#24493f);color:#f5e9b5;font-weight:900}
    .add2e-loot-list{max-height:330px;overflow-y:auto;padding:8px}
    .add2e-loot-row{display:grid;grid-template-columns:44px minmax(150px,1fr) 75px 58px 116px;gap:8px;align-items:center;padding:7px;border-bottom:1px solid rgba(67,105,94,.2)}
    .add2e-loot-row:last-child{border-bottom:0}.add2e-loot-row:hover{background:rgba(214,236,219,.72)}
    .add2e-loot-row img{width:40px;height:40px;object-fit:cover;border:1px solid #456d62;border-radius:7px;background:#e8f0e5}.add2e-loot-name{font-weight:900;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.add2e-loot-type{font-size:.74rem;font-weight:900;color:#2f5d50}.add2e-loot-qty{text-align:center;font-weight:900}
    .add2e-loot-row input{width:54px;min-height:28px;text-align:center}.add2e-loot-empty{padding:22px;text-align:center;color:#526c64;font-style:italic;font-weight:800}
    .add2e-loot-money{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:10px}.add2e-loot-money-chips{display:flex;flex-wrap:wrap;gap:5px}
    .add2e-loot-chip{display:inline-flex;align-items:center;gap:4px;padding:4px 8px;border:1px solid #8b6b22;border-radius:999px;background:linear-gradient(180deg,#f2d374,#c39a36);color:#3e300c;font-weight:900}.add2e-loot-chip i{color:#6c5110}
    .add2e-loot-coins-edit{display:grid;grid-template-columns:repeat(5,minmax(58px,1fr));gap:5px;width:100%}.add2e-loot-coin-field{display:flex;flex-direction:column;gap:3px;padding:5px;border:1px solid #81986a;border-radius:7px;background:#eff4dd}.add2e-loot-coin-field span{text-align:center;font-size:.72rem;font-weight:900}.add2e-loot-coin-field input{width:100%;text-align:center}
    .add2e-loot-drop{margin:0 0 10px;padding:14px;border:2px dashed #46786a;border-radius:10px;background:rgba(231,247,228,.72);text-align:center;color:#315e52;font-weight:900}
    .add2e-loot-locked{padding:22px;border:2px solid #704028;border-radius:10px;background:#ead2b7;color:#5b281d;text-align:center;font-weight:900}.add2e-loot-footer{display:flex;justify-content:flex-end;gap:8px;padding-top:2px}
    .add2e-loot-card{border:2px solid #276354!important;background:linear-gradient(180deg,#e5f2e8,#bfd9ca)!important;color:#18352c!important}.add2e-loot-chat-title{margin:-4px -4px 8px;padding:7px 9px;border-radius:6px;background:linear-gradient(180deg,#3a7c6b,#245348);color:#fff2c9;font-weight:900}.add2e-loot-chat-title i{color:#f0ca58}.add2e-loot-chat-items{list-style:none;margin:6px 0;padding:0}.add2e-loot-chat-items li{display:flex;align-items:center;gap:6px;padding:3px 0}.add2e-loot-chat-items img{border:1px solid #4f776b;border-radius:4px}.add2e-loot-chat-money{margin-top:6px;padding:6px 8px;border:1px solid #927020;border-radius:7px;background:#efd57f;color:#45330b;font-weight:900}
    .add2e-loot-create{padding:10px;border:2px solid #28594d;border-radius:10px;background:linear-gradient(180deg,#e1efe1,#bdd7c8);color:#19352d}.add2e-loot-create label{display:grid;gap:4px;margin-bottom:9px;font-weight:900}.add2e-loot-create-actions{display:flex;justify-content:flex-end;gap:7px}
    @media(max-width:720px){.add2e-loot-row{grid-template-columns:40px minmax(110px,1fr) 50px 94px}.add2e-loot-type{display:none}.add2e-loot-summary{grid-template-columns:1fr}.add2e-loot-arrow{transform:rotate(90deg)}.add2e-loot-coins-edit{grid-template-columns:repeat(3,1fr)}}
  `;
}

function add2eLootEnsureStyles() {
  if (!document?.head) return;
  let style = document.getElementById(ADD2E_LOOT_STYLE_ID);
  if (!style) {
    style = document.createElement("style");
    style.id = ADD2E_LOOT_STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = add2eLootStyles();
}

const ADD2E_LOOT_APPLICATION_V2 = add2eLootApplicationV2();

class Add2eLootApp extends ADD2E_LOOT_APPLICATION_V2 {
  static DEFAULT_OPTIONS = {
    id: "add2e-loot-{id}",
    classes: ["add2e", "add2e-loot-app"],
    tag: "section",
    window: { title: "Butin ADD2E", resizable: true },
    position: { width: 760, height: 620 }
  };

  constructor({ source, token = null, looter = null } = {}, options = {}) {
    super(options);
    this.source = source;
    this.token = token;
    this.looter = looter ?? add2eLootDefaultLooter();
    this.sourceKey = add2eLootSourceKey(source, token?.document ?? token ?? null);
    this.registryKey = `${game.user?.id}:${this.sourceKey}`;
  }

  get title() {
    return `${add2eIsLootChest(this.source) ? "Coffre" : "Butin"} — ${this.source?.name ?? "Source"}`;
  }

  async _prepareContext() {
    if (!this.looter || this.looter.type !== "personnage") this.looter = add2eLootDefaultLooter();
    return {
      source: this.source,
      sourceKey: this.sourceKey,
      items: add2eLootItems(this.source),
      money: getMoney(this.source),
      isChest: add2eIsLootChest(this.source),
      isGM: game.user?.isGM === true,
      locked: add2eLootIsLocked(this.source),
      looter: this.looter,
      looters: add2eLootSceneCharacters()
    };
  }

  async _renderHTML(context) {
    add2eLootEnsureStyles();
    const canTake = Boolean(context.looter) && (context.isGM || !context.locked);
    const headerIcon = context.isChest ? "fas fa-box" : "fas fa-skull-crossbones";
    const sourceImage = context.source?.img || ADD2E_LOOT_CHEST_IMG;
    const looterImage = context.looter?.img || "icons/svg/mystery-man.svg";
    const looterOptions = context.looters.map(actor => `<option value="${esc(actor.id)}" ${actor.id === context.looter?.id ? "selected" : ""}>${esc(actor.name)}</option>`).join("");

    const rows = context.items.map(item => {
      const available = add2eLootItemQuantity(item);
      const remove = context.isGM && context.isChest
        ? `<button type="button" class="add2e-loot-button danger" data-action="remove-item" data-item-id="${esc(item.id)}" title="Retirer du coffre"><i class="fas fa-trash"></i></button>`
        : "";
      const take = canTake
        ? `<input type="number" min="1" max="${available}" step="1" value="1" data-loot-quantity><button type="button" class="add2e-loot-button" data-action="take-item" data-item-id="${esc(item.id)}" title="Prendre"><i class="fas fa-hand"></i></button>`
        : "";
      return `<div class="add2e-loot-row" data-item-id="${esc(item.id)}">
        <img src="${esc(item.img || "icons/svg/item-bag.svg")}" alt="">
        <div><div class="add2e-loot-name" title="${esc(item.name)}">${esc(item.name)}</div><div class="add2e-loot-type"><i class="${add2eLootItemIcon(item)}"></i> ${add2eLootTypeLabel(item)}</div></div>
        <div class="add2e-loot-type">${add2eLootTypeLabel(item)}</div>
        <div class="add2e-loot-qty">× ${available}</div>
        <div style="display:flex;gap:5px;justify-content:flex-end">${take}${remove}</div>
      </div>`;
    }).join("");

    const moneyChips = COINS.map(coin => {
      const amount = add2eLootInt(context.money?.[coin.key], 0);
      return amount > 0 ? `<span class="add2e-loot-chip"><i class="fas fa-coins"></i>${amount} ${coin.label}</span>` : "";
    }).filter(Boolean).join("") || `<span class="add2e-loot-empty" style="padding:0">Aucune monnaie</span>`;

    const toolbar = context.isGM ? `<div class="add2e-loot-toolbar">
      <label><b>Receveur :</b> <select data-looter-select><option value="">— Aucun —</option>${looterOptions}</select></label>
      <span class="spacer"></span>
      ${context.isChest ? `<button type="button" class="add2e-loot-button ${context.locked ? "gold" : ""}" data-action="toggle-lock"><i class="fas fa-${context.locked ? "lock" : "lock-open"}"></i> ${context.locked ? "Déverrouiller" : "Verrouiller"}</button>` : ""}
    </div>` : "";

    const locked = context.locked && !context.isGM
      ? `<div class="add2e-loot-locked"><i class="fas fa-lock"></i><br>Ce coffre est verrouillé.</div>`
      : "";

    const gmDrop = context.isGM && context.isChest
      ? `<div class="add2e-loot-drop"><i class="fas fa-box-open"></i> Glisse ici des armes, armures ou objets depuis un compendium ou le répertoire des objets.</div>`
      : "";

    const moneyContent = context.isGM && context.isChest
      ? `<div class="add2e-loot-money"><div class="add2e-loot-coins-edit">${add2eLootMoneyInputs(context.money)}</div><button type="button" class="add2e-loot-button gold" data-action="save-money"><i class="fas fa-save"></i> Enregistrer</button></div>`
      : `<div class="add2e-loot-money"><div class="add2e-loot-money-chips">${moneyChips}</div>${canTake && add2eLootHasMoney(context.money) ? `<button type="button" class="add2e-loot-button gold" data-action="take-money"><i class="fas fa-coins"></i> Prendre les pièces</button>` : ""}</div>`;

    const footer = canTake && (context.items.length || add2eLootHasMoney(context.money))
      ? `<div class="add2e-loot-footer"><button type="button" class="add2e-loot-button gold" data-action="take-all"><i class="fas fa-box-open"></i> Tout récupérer</button></div>`
      : "";

    const root = document.createElement("section");
    root.innerHTML = `<div class="add2e-loot-shell" data-source-key="${esc(context.sourceKey)}">
      <div class="add2e-loot-header"><h2><i class="${headerIcon}"></i> ${esc(this.title)}</h2><small>Récupération ADD2E</small></div>
      <div class="add2e-loot-summary">
        <div class="add2e-loot-actor"><img src="${esc(sourceImage)}" alt=""><span>${esc(context.source?.name ?? "Source")}</span></div>
        <div class="add2e-loot-arrow"><i class="fas fa-arrow-right"></i></div>
        <div class="add2e-loot-actor"><img src="${esc(looterImage)}" alt=""><span>${esc(context.looter?.name ?? "Aucun personnage receveur")}</span></div>
      </div>
      ${toolbar}${locked}${gmDrop}
      ${locked ? "" : `<div class="add2e-loot-panel"><div class="add2e-loot-panel-title"><span><i class="fas fa-gem"></i> Objets</span><span>${context.items.length}</span></div><div class="add2e-loot-list">${rows || `<div class="add2e-loot-empty">Aucun objet récupérable.</div>`}</div></div>
      <div class="add2e-loot-panel"><div class="add2e-loot-panel-title"><span><i class="fas fa-coins"></i> Monnaie</span><span>${esc(add2eLootMoneyLabel(context.money))}</span></div>${moneyContent}</div>${footer}`}
    </div>`;
    return root;
  }

  _replaceHTML(result, content) {
    content.replaceChildren(result);
  }

  async _onRender(context, options) {
    await super._onRender?.(context, options);
    const root = this.element;
    if (!root?.querySelector) return;

    root.querySelector("[data-looter-select]")?.addEventListener("change", event => {
      this.looter = game.actors?.get?.(event.currentTarget.value) ?? null;
      this.render({ force: true });
    });
    root.querySelectorAll("[data-action]").forEach(button => button.addEventListener("click", event => this._onAction(event)));

    if (context.isGM && context.isChest) {
      root.addEventListener("dragover", event => {
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
      });
      root.addEventListener("drop", event => this._onDropItem(event));
    }
  }

  async _request(action, extra = {}) {
    if (!this.looter) return alertBox("Aucun receveur", "Sélectionne un personnage présent sur la scène.");
    const payload = {
      type: ADD2E_LOOT_REQUEST,
      requestId: add2eLootRandomId("loot-request"),
      userId: game.user.id,
      action,
      sourceActorId: this.source?.id ?? null,
      sourceActorUuid: this.source?.uuid ?? null,
      sourceTokenUuid: this.token?.document?.uuid ?? this.token?.uuid ?? this.source?.token?.uuid ?? null,
      targetActorId: this.looter.id,
      targetActorUuid: this.looter.uuid,
      ...extra
    };

    if (game.user?.isGM) return add2eLootHandleRequest(payload);
    game.socket?.emit?.(ADD2E_LOOT_SOCKET, payload);
    return true;
  }

  async _onAction(event) {
    const button = event.currentTarget;
    const action = button?.dataset?.action;
    if (!action) return;

    if (action === "toggle-lock" && game.user?.isGM && add2eIsLootChest(this.source)) {
      await this.source.setFlag("add2e", "lootLocked", !add2eLootIsLocked(this.source));
      return this.render({ force: true });
    }

    if (action === "save-money" && game.user?.isGM && add2eIsLootChest(this.source)) {
      await setMoney(this.source, add2eLootReadMoney(this.element));
      ui.notifications?.info?.("Monnaie du coffre enregistrée.");
      return this.render({ force: true });
    }

    if (action === "remove-item" && game.user?.isGM && add2eIsLootChest(this.source)) {
      const item = this.source.items?.get?.(button.dataset.itemId);
      if (!item) return;
      const confirmed = await dialog({
        title: "Retirer du coffre",
        content: `<p>Retirer <b>${esc(item.name)}</b> du coffre ?</p>`,
        yes: "Retirer",
        no: "Annuler"
      });
      if (!confirmed) return;
      await this.source.deleteEmbeddedDocuments("Item", [item.id], { add2eReason: "loot-chest-remove-item" });
      return this.render({ force: true });
    }

    if (action === "take-item") {
      const row = button.closest?.("[data-item-id]");
      const amount = add2eLootInt(row?.querySelector?.("[data-loot-quantity]")?.value, 1);
      return this._request("item", { itemId: button.dataset.itemId, quantity: amount });
    }

    if (action === "take-money") return this._request("money");
    if (action === "take-all") {
      const confirmed = await dialog({
        title: "Tout récupérer",
        content: `<p>Transférer tout le contenu de <b>${esc(this.source?.name ?? "ce butin")}</b> vers <b>${esc(this.looter?.name ?? "le personnage")}</b> ?</p>`,
        yes: "Tout récupérer",
        no: "Annuler"
      });
      if (confirmed) return this._request("all");
    }
  }

  async _onDropItem(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!game.user?.isGM || !add2eIsLootChest(this.source)) return;

    let data = {};
    try { data = TextEditor.getDragEventData(event) ?? {}; } catch (_error) {}
    let item = await add2eLootFromUuid(data.uuid ?? data.documentUuid);
    if (!item && data.pack && data.id) item = await game.packs?.get?.(data.pack)?.getDocument?.(data.id);
    if (!item && data.type === "Item" && data.id) item = game.items?.get?.(data.id) ?? null;
    if (item?.documentName !== "Item" && item?.constructor?.metadata?.name !== "Item") {
      return alertBox("Dépôt impossible", "Glisse une arme, une armure ou un objet ADD2E.");
    }
    if (!add2eLootIsPhysicalItem(item)) return alertBox("Objet incompatible", `${item.name ?? "Cet élément"} ne peut pas être placé dans un coffre de butin.`);

    await add2eLootAddItem(this.source, item, Math.max(1, add2eLootItemQuantity(item)));
    ui.notifications?.info?.(`${item.name} ajouté au coffre.`);
    this.render({ force: true });
  }

  async close(options = {}) {
    add2eLootRegistry().delete(this.registryKey);
    return super.close(options);
  }
}

async function add2eLootEnsureFolder() {
  if (!game.user?.isGM) return null;
  return Array.from(game.folders ?? []).find(folder => folder.type === "Actor" && folder.name === ADD2E_LOOT_FOLDER)
    ?? Folder.create({ name: ADD2E_LOOT_FOLDER, type: "Actor", color: "#2f6f62" }, { add2eReason: "loot-folder-create" });
}

export async function add2eCreateLootChest({ name = "Coffre", locked = false } = {}) {
  if (!game.user?.isGM) return null;
  const folder = await add2eLootEnsureFolder();
  const observer = CONST?.DOCUMENT_OWNERSHIP_LEVELS?.OBSERVER ?? 2;
  const chestName = String(name ?? "Coffre").trim() || "Coffre";
  return Actor.create({
    name: chestName,
    type: "dummy",
    folder: folder?.id ?? null,
    img: ADD2E_LOOT_CHEST_IMG,
    ownership: { default: observer },
    prototypeToken: {
      name: chestName,
      actorLink: true,
      texture: { src: ADD2E_LOOT_CHEST_IMG },
      disposition: CONST?.TOKEN_DISPOSITIONS?.NEUTRAL ?? 0,
      displayName: CONST?.TOKEN_DISPLAY_MODES?.HOVER ?? 20
    },
    flags: {
      add2e: {
        isLootContainer: true,
        lootLocked: locked === true,
        lootVersion: ADD2E_LOOT_VERSION,
        monnaie: { pp: 0, po: 0, pe: 0, pa: 0, pc: 0 }
      }
    }
  }, { renderSheet: false, add2eReason: "loot-chest-create" });
}

export async function add2eOpenLoot({ source = null, token = null, looter = null } = {}) {
  source = source ?? token?.actor ?? null;
  if (!source || !add2eIsLootSource(source)) return alertBox("Butin indisponible", "Cette source ne peut pas être fouillée.");
  if (!game.user?.isGM && add2eLootIsLocked(source)) return alertBox("Coffre verrouillé", "Ce coffre est verrouillé.");

  looter = looter ?? add2eLootDefaultLooter();
  if (!looter && !game.user?.isGM) return alertBox("Aucun personnage", "Assigne un personnage à ton utilisateur ou sélectionne son token.");

  const sourceKey = add2eLootSourceKey(source, token?.document ?? token ?? null);
  const registryKey = `${game.user?.id}:${sourceKey}`;
  const current = add2eLootRegistry().get(registryKey);
  if (current?.rendered) {
    current.source = source;
    current.token = token;
    current.looter = looter ?? current.looter;
    current.render({ force: true });
    current.bringToFront?.();
    return current;
  }

  const app = new Add2eLootApp({ source, token, looter });
  add2eLootRegistry().set(registryKey, app);
  app.render({ force: true });
  return app;
}

function add2eOpenCreateChestDialog() {
  if (!game.user?.isGM) return;
  const DialogV2 = add2eLootDialogV2();
  if (!DialogV2) return ui.notifications?.error?.("DialogV2 est introuvable.");
  add2eLootEnsureStyles();

  const uid = add2eLootRandomId("create-chest");
  const content = `<div class="add2e-loot-create" data-add2e-create-chest="${uid}">
    <label>Nom du coffre<input type="text" name="chest-name" value="Coffre" maxlength="80"></label>
    <label style="display:flex;grid-template-columns:auto 1fr;align-items:center"><input type="checkbox" name="chest-locked"> Créer le coffre verrouillé</label>
    <p>Le coffre sera créé dans le dossier <b>${esc(ADD2E_LOOT_FOLDER)}</b>. Glisse ensuite son acteur sur la scène.</p>
    <div class="add2e-loot-create-actions"><button type="button" class="add2e-loot-button gold" data-create-chest><i class="fas fa-box"></i> Créer</button></div>
  </div>`;

  const dialogApp = new DialogV2({
    window: { title: "Créer un coffre ADD2E" },
    classes: ["add2e-loot-create-window"],
    position: { width: 420, height: "auto" },
    content,
    buttons: [{ action: "close", label: "Fermer", default: true }]
  });
  dialogApp.render({ force: true });

  setTimeout(() => {
    const root = document.querySelector(`[data-add2e-create-chest="${uid}"]`);
    root?.querySelector?.("[data-create-chest]")?.addEventListener("click", async () => {
      const name = root.querySelector('[name="chest-name"]')?.value ?? "Coffre";
      const locked = root.querySelector('[name="chest-locked"]')?.checked === true;
      const actor = await add2eCreateLootChest({ name, locked });
      if (!actor) return;
      ui.notifications?.info?.(`${actor.name} créé dans ${ADD2E_LOOT_FOLDER}.`);
      await dialogApp.close();
      await add2eOpenLoot({ source: actor, looter: add2eLootDefaultLooter() });
    });
    root?.querySelector?.('[name="chest-name"]')?.focus?.();
  }, 0);
}

function add2eLootDirectoryButton() {
  Hooks.on("renderActorDirectory", (_app, html) => {
    if (!game.user?.isGM) return;
    const root = html?.jquery ? html[0] : html;
    if (!root?.querySelector || root.querySelector(".add2e-create-loot-chest")) return;
    const footer = root.querySelector(".directory-footer");
    if (!footer) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "add2e-create-loot-chest";
    button.innerHTML = '<i class="fas fa-box"></i> Créer un coffre';
    button.addEventListener("click", add2eOpenCreateChestDialog);
    footer.prepend(button);
  });
}

function add2eLootOpenLock(actor) {
  const key = `${game.user?.id}:${actor?.uuid ?? actor?.id}`;
  const now = Date.now();
  const locks = globalThis.__ADD2E_LOOT_OPEN_LOCK ??= new Map();
  const previous = Number(locks.get(key) ?? 0);
  if (now - previous < 700) return false;
  locks.set(key, now);
  return true;
}

async function add2eLootOpenFromToken(token) {
  if (!add2eIsLootSource(token?.actor) || !add2eLootOpenLock(token.actor)) return false;
  await add2eOpenLoot({ source: token.actor, token, looter: add2eLootDefaultLooter() });
  return true;
}

function add2eLootBindTokens() {
  for (const token of canvas?.tokens?.placeables ?? []) {
    if (!add2eIsLootSource(token?.actor) || token.__add2eLootTapV1) continue;
    token.__add2eLootTapV1 = true;
    try {
      token.cursor = "pointer";
      token.eventMode = "static";
      token.interactive = true;
      token.on?.("pointertap", event => {
        event?.stopPropagation?.();
        add2eLootOpenFromToken(token);
      });
    } catch (_error) {}
  }
}

function add2eLootPatchTokenClick() {
  if (globalThis.__ADD2E_LOOT_TOKEN_CLICK_V1) return;
  globalThis.__ADD2E_LOOT_TOKEN_CLICK_V1 = true;
  const TokenClass = foundry?.canvas?.placeables?.Token ?? CONFIG?.Token?.objectClass ?? globalThis.Token;
  const prototype = TokenClass?.prototype;
  if (prototype && typeof prototype._onClickLeft === "function") {
    const original = prototype._onClickLeft;
    prototype._onClickLeft = function(event) {
      const result = original.call(this, event);
      if (add2eIsLootSource(this.actor)) setTimeout(() => add2eLootOpenFromToken(this), 0);
      return result;
    };
  }

  Hooks.on("canvasReady", add2eLootBindTokens);
  Hooks.on("createToken", () => setTimeout(add2eLootBindTokens, 100));
  Hooks.on("updateToken", () => setTimeout(add2eLootBindTokens, 100));
  Hooks.on("updateActor", () => setTimeout(add2eLootBindTokens, 100));
  setTimeout(add2eLootBindTokens, 500);
}

function add2eLootRefreshHooks() {
  const refreshActor = actor => {
    const key = actor?.token?.uuid ?? actor?.uuid ?? actor?.id ?? "";
    add2eLootRefreshApps(key);
  };
  Hooks.on("updateActor", refreshActor);
  Hooks.on("createItem", item => refreshActor(item?.parent ?? item?.actor));
  Hooks.on("updateItem", item => refreshActor(item?.parent ?? item?.actor));
  Hooks.on("deleteItem", item => refreshActor(item?.parent ?? item?.actor));
}

Hooks.once("ready", () => {
  if (!ADD2E_LOOT_APPLICATION_V2) {
    ui.notifications?.error?.("ApplicationV2 est introuvable : système de butin désactivé.");
    return;
  }
  add2eLootEnsureStyles();
  game.socket?.on?.(ADD2E_LOOT_SOCKET, add2eLootHandleSocket);
  add2eLootDirectoryButton();
  add2eLootPatchTokenClick();
  add2eLootRefreshHooks();

  game.add2e ??= {};
  game.add2e.loot = {
    version: ADD2E_LOOT_VERSION,
    createChest: add2eCreateLootChest,
    open: add2eOpenLoot,
    isChest: add2eIsLootChest,
    isSource: add2eIsLootSource
  };
  globalThis.ADD2E_LOOT_VERSION = ADD2E_LOOT_VERSION;
});
