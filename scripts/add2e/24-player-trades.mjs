// ADD2E — Échanges entre personnages joueurs — DialogV2 / Foundry V13-V15
// Version : 2026-06-15-player-trades-v1

const ADD2E_PLAYER_TRADES_VERSION = "2026-06-15-player-trades-v1";
const ADD2E_PLAYER_TRADES_SOCKET = "system.add2e";
const ADD2E_TRADE_COINS = ["pp", "po", "pe", "pa", "pc"];
const ADD2E_TRADE_COIN_LABELS = { pp: "PP", po: "PO", pe: "PE", pa: "PA", pc: "PC" };
const add2eTradePending = new Map();
const add2eTradeCommitted = new Set();

function add2eTradeDialogV2() {
  return foundry?.applications?.api?.DialogV2 ?? null;
}

function add2eTradeEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function add2eTradeInt(value, min = 0) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return min;
  return Math.max(min, n);
}

function add2eTradeUuid() {
  return `add2e-trade-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function add2eTradeGetMoney(actor) {
  const raw = actor?.getFlag?.("add2e", "monnaie") ?? actor?.flags?.add2e?.monnaie ?? {};
  const out = {};
  for (const coin of ADD2E_TRADE_COINS) out[coin] = add2eTradeInt(raw?.[coin], 0);
  return out;
}

async function add2eTradeSetMoney(actor, money) {
  const normalized = {};
  for (const coin of ADD2E_TRADE_COINS) normalized[coin] = add2eTradeInt(money?.[coin], 0);
  await actor.setFlag("add2e", "monnaie", normalized);
}

function add2eTradeMoneyLabel(money) {
  const parts = [];
  for (const coin of ADD2E_TRADE_COINS) {
    const n = add2eTradeInt(money?.[coin], 0);
    if (n > 0) parts.push(`${n} ${ADD2E_TRADE_COIN_LABELS[coin]}`);
  }
  return parts.length ? parts.join(", ") : "aucune monnaie";
}

function add2eTradeMoneyInputs(prefix = "money", money = {}) {
  return `<div class="add2e-trade-money-row">
    ${ADD2E_TRADE_COINS.map(coin => `
      <label>${ADD2E_TRADE_COIN_LABELS[coin]}
        <input type="number" min="0" step="1" name="${prefix}-${coin}" value="${add2eTradeInt(money?.[coin], 0)}">
      </label>`).join("")}
  </div>`;
}

function add2eTradeReadMoney(root, prefix = "money") {
  const out = {};
  for (const coin of ADD2E_TRADE_COINS) out[coin] = add2eTradeInt(root?.querySelector?.(`[name="${prefix}-${coin}"]`)?.value, 0);
  return out;
}

function add2eTradeHasMoney(money) {
  return ADD2E_TRADE_COINS.some(coin => add2eTradeInt(money?.[coin], 0) > 0);
}

function add2eTradeCanPay(actor, requested) {
  const wallet = add2eTradeGetMoney(actor);
  return ADD2E_TRADE_COINS.every(coin => wallet[coin] >= add2eTradeInt(requested?.[coin], 0));
}

function add2eTradeApplyMoneyDelta(money, delta) {
  const out = { ...money };
  for (const coin of ADD2E_TRADE_COINS) out[coin] = add2eTradeInt(out[coin], 0) + add2eTradeInt(delta?.[coin], 0);
  return out;
}

function add2eTradeNegateMoney(money) {
  const out = {};
  for (const coin of ADD2E_TRADE_COINS) out[coin] = -add2eTradeInt(money?.[coin], 0);
  return out;
}

function add2eTradeActorFromElement(el) {
  const root = el?.closest?.("[data-actor-id]");
  const actorId = root?.dataset?.actorId;
  if (actorId && game.actors?.get(actorId)) return game.actors.get(actorId);

  const appRoot = el?.closest?.(".application, .window-app, .app");
  const appId = appRoot?.dataset?.applicationId || String(appRoot?.id || "").replace(/^app-/, "");
  const app = appId ? (foundry?.applications?.instances?.get?.(appId) ?? ui.windows?.[appId]) : null;
  return app?.actor ?? app?.document ?? null;
}

function add2eTradeSceneActors(sourceActor) {
  const scene = canvas?.scene ?? game.scenes?.current ?? null;
  const seen = new Set();
  const rows = [];
  for (const token of scene?.tokens?.contents ?? []) {
    const actor = token.actor;
    if (!actor || actor.id === sourceActor?.id || actor.type !== "personnage" || seen.has(actor.id)) continue;
    seen.add(actor.id);
    rows.push({ id: actor.id, name: actor.name, tokenName: token.name });
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

function add2eTradeItemQuantity(item) {
  const q = add2eTradeInt(item?.system?.quantite ?? item?.system?.quantity, 1);
  return Math.max(1, q);
}

function add2eTradeOfferLabel(proposal) {
  if (proposal?.offer?.kind === "money") return `${proposal.offer.quantity} ${ADD2E_TRADE_COIN_LABELS[proposal.offer.coin] ?? proposal.offer.coin}`;
  return `${proposal?.offer?.quantity ?? 1} × ${proposal?.offer?.name ?? "Objet"}`;
}

function add2eTradeStyles() {
  return `<style>
    .add2e-trade-dialog { color:#2a1b0d;background:linear-gradient(180deg,#efe0bc 0%,#d8bd82 100%);border:2px solid #5a3418;border-radius:8px;padding:10px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.35);font-family:var(--font-primary); }
    .add2e-trade-dialog h3 { margin:0 0 8px;color:#5b1e16;font-size:1.05rem;font-weight:900; }
    .add2e-trade-box { border:1px solid #8a6330;border-radius:8px;background:rgba(255,247,218,.66);padding:8px;margin-bottom:8px;line-height:1.25; }
    .add2e-trade-grid { display:grid;grid-template-columns:90px 1fr;gap:6px 8px;align-items:center; }
    .add2e-trade-grid input,.add2e-trade-grid select,.add2e-trade-money-row input { width:100%;box-sizing:border-box; }
    .add2e-trade-money-row { display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:5px; }
    .add2e-trade-money-row label { font-size:.74rem;font-weight:800;color:#4a2f17; }
    .add2e-trade-actions { display:flex;justify-content:flex-end;gap:8px;margin-top:9px; }
    .add2e-trade-btn { border-radius:7px;padding:6px 12px;font-weight:900;cursor:pointer;box-shadow:0 2px 5px rgba(0,0,0,.25); }
    .add2e-trade-btn.validate { border:1px solid #6e1414;background:linear-gradient(180deg,#a7372d,#6e1714);color:#fff1d5; }
    .add2e-trade-btn.cancel { border:1px solid #6a5640;background:linear-gradient(180deg,#7b6c5c,#4f463b);color:#fff1d5; }
  </style>`;
}

function add2eTradeHideFooter(dialogRoot) {
  const win = dialogRoot?.closest?.(".application, .window-app, .app, .dialog");
  for (const footer of win?.querySelectorAll?.(".form-footer, .dialog-buttons, footer") ?? []) {
    if (!footer.closest(".add2e-trade-dialog")) footer.style.display = "none";
  }
}

function add2eTradeOpenDialog({ title, content, width = 430, onReady }) {
  const DialogV2 = add2eTradeDialogV2();
  if (!DialogV2) {
    ui.notifications.error("Dialog V2 est introuvable : échange impossible.");
    return null;
  }
  const dialog = new DialogV2({
    window: { title },
    content,
    buttons: [{ action: "close", label: "Fermer", default: true }]
  }, { width, height: "auto" });
  dialog.render({ force: true });
  setTimeout(() => {
    const root = document.querySelector(`[data-add2e-trade-dialog="${dialog._add2eTradeId}"]`);
    if (root) add2eTradeHideFooter(root);
    if (root && typeof onReady === "function") onReady(root, dialog);
  }, 0);
  return dialog;
}

function add2eTradeTargetUserShouldPrompt(targetActor) {
  if (!targetActor) return false;
  const owners = game.users.filter(u => u.active && !u.isGM && targetActor.testUserPermission(u, "OWNER"));
  if (owners.length) return owners[0].id === game.user.id;
  return game.user.isGM;
}

function add2eTradeOpenRequester(actor, button) {
  const action = String(button.dataset.action || "");
  const isMoney = action === "trade-money";
  const itemId = String(button.dataset.itemId || "");
  const coin = String(button.dataset.coin || "").toLowerCase();
  const item = isMoney ? null : actor.items.get(itemId);
  if (!actor || actor.type !== "personnage") return ui.notifications.warn("Les échanges ne sont disponibles que pour les personnages.");
  if (!isMoney && !item) return ui.notifications.warn("Objet introuvable pour l'échange.");
  if (isMoney && !ADD2E_TRADE_COINS.includes(coin)) return ui.notifications.warn("Monnaie introuvable pour l'échange.");

  const targets = add2eTradeSceneActors(actor);
  if (!targets.length) return ui.notifications.warn("Aucun autre personnage présent sur la scène pour l'échange.");

  const maxQty = isMoney ? add2eTradeGetMoney(actor)[coin] : add2eTradeItemQuantity(item);
  if (maxQty <= 0) return ui.notifications.warn("Rien à échanger sur cette ligne.");

  const uid = add2eTradeUuid();
  const label = isMoney ? `${ADD2E_TRADE_COIN_LABELS[coin]} disponibles : ${maxQty}` : `${item.name} — quantité disponible : ${maxQty}`;
  const options = targets.map(t => `<option value="${add2eTradeEscape(t.id)}">${add2eTradeEscape(t.name)} (${add2eTradeEscape(t.tokenName)})</option>`).join("");
  const content = `${add2eTradeStyles()}
    <div class="add2e-trade-dialog" data-add2e-trade-dialog="${uid}">
      <h3>Proposer un échange</h3>
      <div class="add2e-trade-box"><b>${add2eTradeEscape(actor.name)}</b> propose <b>${add2eTradeEscape(label)}</b>.</div>
      <div class="add2e-trade-box add2e-trade-grid">
        <label>Receveur</label><select name="targetActorId">${options}</select>
        <label>Quantité</label><input type="number" name="quantity" min="1" max="${maxQty}" step="1" value="1">
      </div>
      <div class="add2e-trade-box">
        <div style="font-weight:900;margin-bottom:5px;">Argent demandé en échange</div>
        ${add2eTradeMoneyInputs("request", {})}
      </div>
      <div class="add2e-trade-actions">
        <button type="button" class="add2e-trade-btn cancel" data-add2e-trade-cancel>Annuler</button>
        <button type="button" class="add2e-trade-btn validate" data-add2e-trade-submit>Proposer</button>
      </div>
    </div>`;

  const dialog = add2eTradeOpenDialog({
    title: "Échange ADD2E",
    content,
    onReady: (root, dlg) => {
      root.querySelector("[data-add2e-trade-cancel]")?.addEventListener("click", () => dlg.close());
      root.querySelector("[data-add2e-trade-submit]")?.addEventListener("click", () => {
        const qty = add2eTradeInt(root.querySelector('[name="quantity"]')?.value, 1);
        if (qty < 1 || qty > maxQty) return ui.notifications.warn("Quantité invalide pour cet échange.");
        const targetActorId = root.querySelector('[name="targetActorId"]')?.value;
        const targetActor = game.actors.get(targetActorId);
        if (!targetActor) return ui.notifications.warn("Receveur introuvable.");

        const proposal = {
          id: uid,
          version: ADD2E_PLAYER_TRADES_VERSION,
          requesterUserId: game.user.id,
          requesterUserName: game.user.name,
          sourceActorId: actor.id,
          sourceActorName: actor.name,
          targetActorId,
          targetActorName: targetActor.name,
          requestMoney: add2eTradeReadMoney(root, "request"),
          offer: isMoney
            ? { kind: "money", coin, quantity: qty, name: ADD2E_TRADE_COIN_LABELS[coin] }
            : { kind: "item", itemId: item.id, itemType: item.type, name: item.name, img: item.img, quantity: qty }
        };
        add2eTradePending.set(uid, proposal);
        game.socket.emit(ADD2E_PLAYER_TRADES_SOCKET, { type: "add2eTradeProposal", proposal });
        ui.notifications.info(`Échange proposé à ${targetActor.name}.`);
        dlg.close();
      });
    }
  });
  if (dialog) dialog._add2eTradeId = uid;
}

function add2eTradeOpenReceiver(proposal) {
  const targetActor = game.actors.get(proposal?.targetActorId);
  if (!add2eTradeTargetUserShouldPrompt(targetActor)) return;

  const uid = `${proposal.id}-receiver-${game.user.id}`;
  const requestLabel = add2eTradeMoneyLabel(proposal.requestMoney);
  const content = `${add2eTradeStyles()}
    <div class="add2e-trade-dialog" data-add2e-trade-dialog="${uid}">
      <h3>Valider l'échange</h3>
      <div class="add2e-trade-box"><b>${add2eTradeEscape(proposal.sourceActorName)}</b> propose à <b>${add2eTradeEscape(proposal.targetActorName)}</b>.</div>
      <div class="add2e-trade-box"><b>Objet / argent reçu :</b><br>${add2eTradeEscape(add2eTradeOfferLabel(proposal))}</div>
      <div class="add2e-trade-box"><b>Argent à donner en échange :</b><br>${add2eTradeEscape(requestLabel)}</div>
      <div class="add2e-trade-actions">
        <button type="button" class="add2e-trade-btn cancel" data-add2e-trade-refuse>Refuser</button>
        <button type="button" class="add2e-trade-btn validate" data-add2e-trade-accept>Valider</button>
      </div>
    </div>`;

  const dialog = add2eTradeOpenDialog({
    title: "Échange ADD2E — validation",
    content,
    onReady: (root, dlg) => {
      root.querySelector("[data-add2e-trade-refuse]")?.addEventListener("click", () => {
        game.socket.emit(ADD2E_PLAYER_TRADES_SOCKET, { type: "add2eTradeRefused", proposal, refusedByUserId: game.user.id, refusedByUserName: game.user.name });
        dlg.close();
      });
      root.querySelector("[data-add2e-trade-accept]")?.addEventListener("click", () => {
        if (!add2eTradeCanPay(targetActor, proposal.requestMoney)) return ui.notifications.warn("Le receveur n'a pas la monnaie demandée.");
        game.socket.emit(ADD2E_PLAYER_TRADES_SOCKET, { type: "add2eTradeAccepted", proposal, acceptedByUserId: game.user.id, acceptedByUserName: game.user.name });
        dlg.close();
      });
    }
  });
  if (dialog) dialog._add2eTradeId = uid;
}

function add2eTradeFindStack(actor, itemData) {
  const qty = Number(itemData?.system?.quantite ?? itemData?.system?.quantity);
  if (!Number.isFinite(qty)) return null;
  const name = String(itemData?.name ?? "");
  const type = String(itemData?.type ?? "");
  return actor.items.find(i => i.type === type && i.name === name && Number.isFinite(Number(i.system?.quantite ?? i.system?.quantity)));
}

async function add2eTradeAddItem(actor, itemData, quantity) {
  const data = foundry.utils.deepClone(itemData);
  delete data._id;
  data.system = data.system ?? {};
  data.system.quantite = quantity;
  data.system.equipee = false;
  const stack = add2eTradeFindStack(actor, data);
  if (stack) {
    const current = add2eTradeItemQuantity(stack);
    await stack.update({ "system.quantite": current + quantity });
  } else {
    await actor.createEmbeddedDocuments("Item", [data]);
  }
}

async function add2eTradeRemoveItem(actor, item, quantity) {
  const current = add2eTradeItemQuantity(item);
  if (quantity >= current) await actor.deleteEmbeddedDocuments("Item", [item.id]);
  else await item.update({ "system.quantite": current - quantity });
}

function add2eTradeActorPresentOnScene(actorId) {
  const scene = canvas?.scene ?? game.scenes?.current ?? null;
  return !!scene?.tokens?.contents?.some(t => t.actor?.id === actorId);
}

async function add2eTradeCommit(proposal) {
  if (!game.user.isGM) return;
  if (!proposal?.id || add2eTradeCommitted.has(proposal.id)) return;
  add2eTradeCommitted.add(proposal.id);

  try {
    const sourceActor = game.actors.get(proposal.sourceActorId);
    const targetActor = game.actors.get(proposal.targetActorId);
    if (!sourceActor || !targetActor) throw new Error("acteur introuvable");
    if (sourceActor.type !== "personnage" || targetActor.type !== "personnage") throw new Error("acteur non personnage");
    if (!add2eTradeActorPresentOnScene(proposal.targetActorId)) throw new Error("receveur absent de la scène");

    if (!add2eTradeCanPay(targetActor, proposal.requestMoney)) throw new Error("monnaie demandée insuffisante côté receveur");

    if (proposal.offer?.kind === "money") {
      const coin = proposal.offer.coin;
      const qty = add2eTradeInt(proposal.offer.quantity, 0);
      const sourceMoney = add2eTradeGetMoney(sourceActor);
      if (!ADD2E_TRADE_COINS.includes(coin) || sourceMoney[coin] < qty) throw new Error("monnaie proposée insuffisante côté donneur");
      sourceMoney[coin] -= qty;
      const targetMoney = add2eTradeGetMoney(targetActor);
      targetMoney[coin] += qty;
      await add2eTradeSetMoney(sourceActor, sourceMoney);
      await add2eTradeSetMoney(targetActor, targetMoney);
    } else {
      const item = sourceActor.items.get(proposal.offer?.itemId);
      const qty = add2eTradeInt(proposal.offer?.quantity, 0);
      if (!item || qty < 1) throw new Error("objet proposé introuvable");
      if (add2eTradeItemQuantity(item) < qty) throw new Error("quantité proposée insuffisante");
      const itemData = item.toObject();
      await add2eTradeRemoveItem(sourceActor, item, qty);
      await add2eTradeAddItem(targetActor, itemData, qty);
    }

    if (add2eTradeHasMoney(proposal.requestMoney)) {
      const sourceMoney = add2eTradeGetMoney(sourceActor);
      const targetMoney = add2eTradeGetMoney(targetActor);
      await add2eTradeSetMoney(targetActor, add2eTradeApplyMoneyDelta(targetMoney, add2eTradeNegateMoney(proposal.requestMoney)));
      await add2eTradeSetMoney(sourceActor, add2eTradeApplyMoneyDelta(sourceMoney, proposal.requestMoney));
    }

    const message = `${proposal.sourceActorName} échange ${add2eTradeOfferLabel(proposal)} avec ${proposal.targetActorName}${add2eTradeHasMoney(proposal.requestMoney) ? ` contre ${add2eTradeMoneyLabel(proposal.requestMoney)}` : ""}.`;
    await ChatMessage.create({ content: `<div class="add2e-card"><b>Échange validé</b><br>${add2eTradeEscape(message)}</div>` });
    game.socket.emit(ADD2E_PLAYER_TRADES_SOCKET, { type: "add2eTradeResult", proposalId: proposal.id, ok: true, message });
  } catch (err) {
    const message = `Échange impossible : ${err?.message ?? err}`;
    game.socket.emit(ADD2E_PLAYER_TRADES_SOCKET, { type: "add2eTradeResult", proposalId: proposal.id, ok: false, message });
    ui.notifications.error(message);
  }
}

function add2eTradeHandleSocket(data) {
  if (!data || typeof data !== "object") return;
  if (data.type === "add2eTradeProposal") return add2eTradeOpenReceiver(data.proposal);
  if (data.type === "add2eTradeAccepted") return add2eTradeCommit(data.proposal);
  if (data.type === "add2eTradeRefused") {
    if (data.proposal?.requesterUserId === game.user.id) ui.notifications.warn(`${data.refusedByUserName ?? "Le receveur"} refuse l'échange.`);
    return;
  }
  if (data.type === "add2eTradeResult") {
    const proposal = add2eTradePending.get(data.proposalId);
    if (proposal || game.user.isGM) {
      if (data.ok) ui.notifications.info(data.message);
      else ui.notifications.error(data.message);
    }
    add2eTradePending.delete(data.proposalId);
  }
}

function add2eTradeHandleClick(ev) {
  const button = ev.target?.closest?.('[data-action="trade-item"], [data-action="trade-money"]');
  if (!button) return;
  ev.preventDefault();
  ev.stopPropagation();
  ev.stopImmediatePropagation?.();
  const actor = add2eTradeActorFromElement(button);
  add2eTradeOpenRequester(actor, button);
}

Hooks.once("ready", () => {
  game.socket.on(ADD2E_PLAYER_TRADES_SOCKET, add2eTradeHandleSocket);
  document.addEventListener("click", add2eTradeHandleClick, true);
  globalThis.ADD2E_PLAYER_TRADES_VERSION = ADD2E_PLAYER_TRADES_VERSION;
});