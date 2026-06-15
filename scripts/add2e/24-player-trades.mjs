// ADD2E — Échanges entre personnages joueurs — DialogV2 / Foundry V13-V15
// Version : 2026-06-15-player-trades-ui-v5-dialogv2-position

const ADD2E_PLAYER_TRADES_VERSION = "2026-06-15-player-trades-ui-v5-dialogv2-position";
const ADD2E_PLAYER_TRADES_SOCKET = "system.add2e";
const ADD2E_TRADE_STYLE_ID = "add2e-player-trades-style";
const ADD2E_TRADE_DIALOG_WIDTH = 220;
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

function add2eTradeCssText() {
  return `
    .add2e-trade-window {
      width: ${ADD2E_TRADE_DIALOG_WIDTH}px !important;
      min-width: ${ADD2E_TRADE_DIALOG_WIDTH}px !important;
      max-width: ${ADD2E_TRADE_DIALOG_WIDTH}px !important;
    }
    .add2e-trade-window .window-content,
    .add2e-trade-window .standard-form,
    .add2e-trade-window form {
      width: 100% !important;
      min-width: 0 !important;
      max-width: 100% !important;
      background: transparent !important;
      padding: 0 !important;
      border: 0 !important;
      overflow: visible !important;
    }
    .add2e-trade-dialog {
      box-sizing: border-box;
      width: 100%;
      min-width: 0;
      color: #2b1b0d;
      background: radial-gradient(circle at 12% 0%, rgba(255,246,206,.95) 0, rgba(255,246,206,0) 38%), linear-gradient(180deg, #efe0bc 0%, #d9bd82 100%);
      border: 2px solid #5a3418;
      border-radius: 10px;
      padding: 8px;
      box-shadow: inset 0 0 0 1px rgba(255,255,255,.45), 0 5px 18px rgba(35,18,5,.42);
      font-family: var(--font-primary);
      overflow: hidden;
    }
    .add2e-trade-dialog * { box-sizing: border-box; }
    .add2e-trade-title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      margin: 0 0 7px;
      padding: 6px 8px;
      border: 1px solid #7c2f1d;
      border-radius: 8px;
      color: #fff0ce;
      background: linear-gradient(180deg, #8e2f24 0%, #5f1713 100%);
      box-shadow: inset 0 1px 0 rgba(255,255,255,.22), 0 2px 5px rgba(45,20,8,.24);
      font-weight: 900;
      letter-spacing: .02em;
      font-size: .86rem;
      line-height: 1.1;
    }
    .add2e-trade-title i { color: #f8d37a; }
    .add2e-trade-title small { font-size: .62rem; color: #f7db9e; font-weight: 800; white-space: nowrap; }
    .add2e-trade-box {
      border: 1px solid #8a6330;
      border-radius: 8px;
      background: rgba(255,247,218,.72);
      padding: 7px;
      margin-bottom: 7px;
      line-height: 1.18;
      box-shadow: inset 0 0 10px rgba(90,52,24,.12);
    }
    .add2e-trade-actor-row {
      display: grid;
      grid-template-columns: 1fr 20px 1fr;
      gap: 3px;
      align-items: center;
      text-align: center;
    }
    .add2e-trade-actor-pill {
      min-width: 0;
      padding: 5px 4px;
      border: 1px solid #7f5526;
      border-radius: 7px;
      background: linear-gradient(180deg, #fff0c2 0%, #d7a65d 100%);
      color: #2c1b0c;
      box-shadow: inset 0 1px 0 rgba(255,255,255,.55);
      font-weight: 900;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: .76rem;
    }
    .add2e-trade-arrow { color: #7c241a; font-size: .92rem; }
    .add2e-trade-offer {
      display: grid;
      grid-template-columns: 30px 1fr;
      gap: 6px;
      align-items: center;
    }
    .add2e-trade-offer-icon {
      width: 30px;
      height: 30px;
      border-radius: 7px;
      border: 1px solid #7c4a20;
      background: linear-gradient(180deg, #f6dfad, #bd8743);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #622016;
      font-size: 1rem;
      box-shadow: inset 0 1px 0 rgba(255,255,255,.5), 0 2px 4px rgba(45,20,8,.22);
    }
    .add2e-trade-label { display:block; color:#5b1e16; font-size:.64rem; font-weight:900; text-transform:uppercase; letter-spacing:.025em; margin-bottom:2px; }
    .add2e-trade-value { font-weight:900; color:#2b1b0d; font-size:.84rem; overflow-wrap:anywhere; }
    .add2e-trade-grid { display:grid; grid-template-columns: 1fr; gap: 4px; align-items:center; }
    .add2e-trade-grid label { color:#4a2f17; font-weight:900; font-size:.74rem; }
    .add2e-trade-grid input,
    .add2e-trade-grid select,
    .add2e-trade-money-row input {
      width: 100%;
      min-width: 0;
      min-height: 24px;
      border: 1px solid #7d5a2c;
      border-radius: 6px;
      background: rgba(255,252,235,.95);
      color: #2b1b0d;
      font-weight: 800;
      box-shadow: inset 0 1px 3px rgba(55,30,10,.16);
      font-size: .78rem;
    }
    .add2e-trade-money-row { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:2px; }
    .add2e-trade-coin-field {
      display:flex;
      flex-direction:column;
      gap:2px;
      min-width:0;
      padding:2px;
      border:1px solid #9a7036;
      border-radius:6px;
      background:rgba(255,244,207,.72);
    }
    .add2e-trade-coin-field span { font-size:.56rem; font-weight:900; color:#6e2418; text-align:center; }
    .add2e-trade-chip {
      display:inline-flex;
      align-items:center;
      gap:3px;
      margin:2px 2px 2px 0;
      padding:3px 6px;
      border-radius:999px;
      border:1px solid #8c612d;
      background:linear-gradient(180deg,#ffe7a3,#c9933e);
      color:#2b1b0d;
      font-size:.72rem;
      font-weight:900;
      white-space:nowrap;
    }
    .add2e-trade-chip i { color:#7c241a; }
    .add2e-trade-muted { color:#6f5a40; font-style:italic; font-weight:700; font-size:.72rem; }
    .add2e-trade-actions { display:flex; justify-content:flex-end; gap:5px; margin-top:7px; }
    .add2e-trade-btn {
      min-width: 64px;
      border-radius: 7px;
      padding: 5px 7px;
      font-weight: 900;
      cursor: pointer;
      box-shadow: 0 2px 5px rgba(0,0,0,.25), inset 0 1px 0 rgba(255,255,255,.22);
      font-size: .72rem;
    }
    .add2e-trade-btn.validate { border:1px solid #6e1414; background:linear-gradient(180deg,#a7372d,#6e1714); color:#fff1d5; }
    .add2e-trade-btn.cancel { border:1px solid #6a5640; background:linear-gradient(180deg,#7b6c5c,#4f463b); color:#fff1d5; }
    .add2e-trade-btn:hover { filter:brightness(1.08); transform:translateY(-1px); }
  `;
}

function add2eTradeEnsureStyles() {
  if (!document?.head) return;
  let style = document.getElementById(ADD2E_TRADE_STYLE_ID);
  if (!style) {
    style = document.createElement("style");
    style.id = ADD2E_TRADE_STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = add2eTradeCssText();
}

function add2eTradeStyles() {
  add2eTradeEnsureStyles();
  return "";
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
      <label class="add2e-trade-coin-field">
        <span>${ADD2E_TRADE_COIN_LABELS[coin]}</span>
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

function add2eTradeOfferIcon(proposal) {
  if (proposal?.offer?.kind === "money") return "fas fa-coins";
  const type = String(proposal?.offer?.itemType ?? "").toLowerCase();
  if (type === "arme") return "fas fa-swords";
  if (type === "armure") return "fas fa-shield-alt";
  return "fas fa-box-open";
}

function add2eTradeMoneyChips(money) {
  const chips = ADD2E_TRADE_COINS
    .map(coin => {
      const value = add2eTradeInt(money?.[coin], 0);
      if (value <= 0) return "";
      return `<span class="add2e-trade-chip"><i class="fas fa-coins"></i>${value} ${ADD2E_TRADE_COIN_LABELS[coin]}</span>`;
    })
    .filter(Boolean)
    .join("");
  return chips || `<span class="add2e-trade-muted">aucune monnaie</span>`;
}

function add2eTradeApplyWindowWidth(dialog, dialogRoot, width) {
  const px = `${Number(width) || ADD2E_TRADE_DIALOG_WIDTH}px`;
  try { dialog?.setPosition?.({ width: Number(width) || ADD2E_TRADE_DIALOG_WIDTH, height: "auto" }); } catch (_) {}
  const win = dialog?.element ?? dialogRoot?.closest?.(".application, .window-app, .app, .dialog") ?? null;
  if (!win) return;
  win.classList.add("add2e-trade-window");
  win.style.setProperty("width", px, "important");
  win.style.setProperty("min-width", px, "important");
  win.style.setProperty("max-width", px, "important");
  win.style.setProperty("background", "transparent", "important");
}

function add2eTradeHideFooter(dialogRoot, dialog, width) {
  add2eTradeApplyWindowWidth(dialog, dialogRoot, width);
  const win = dialog?.element ?? dialogRoot?.closest?.(".application, .window-app, .app, .dialog") ?? null;
  for (const footer of win?.querySelectorAll?.(".form-footer, .dialog-buttons, footer") ?? []) {
    if (!footer.closest(".add2e-trade-dialog")) footer.style.display = "none";
  }
}

function add2eTradeOpenDialog({ title, content, width = ADD2E_TRADE_DIALOG_WIDTH, onReady }) {
  const DialogV2 = add2eTradeDialogV2();
  if (!DialogV2) {
    ui.notifications.error("Dialog V2 est introuvable : échange impossible.");
    return null;
  }
  add2eTradeEnsureStyles();
  const dialog = new DialogV2({
    window: { title },
    classes: ["add2e-trade-window"],
    position: { width, height: "auto" },
    content,
    buttons: [{ action: "close", label: "Fermer", default: true }]
  });
  dialog.render({ force: true });
  setTimeout(() => {
    const root = document.querySelector(`[data-add2e-trade-dialog="${dialog._add2eTradeId}"]`);
    if (root) add2eTradeHideFooter(root, dialog, width);
    if (root && typeof onReady === "function") onReady(root, dialog);
  }, 0);
  setTimeout(() => {
    const root = document.querySelector(`[data-add2e-trade-dialog="${dialog._add2eTradeId}"]`);
    if (root) add2eTradeApplyWindowWidth(dialog, root, width);
  }, 60);
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
  const offerName = isMoney ? `${ADD2E_TRADE_COIN_LABELS[coin]}` : item.name;
  const offerDetail = isMoney ? `${maxQty} ${ADD2E_TRADE_COIN_LABELS[coin]} disponibles` : `Quantité disponible : ${maxQty}`;
  const offerIcon = isMoney ? "fas fa-coins" : add2eTradeOfferIcon({ offer: { itemType: item.type } });
  const options = targets.map(t => `<option value="${add2eTradeEscape(t.id)}">${add2eTradeEscape(t.name)} (${add2eTradeEscape(t.tokenName)})</option>`).join("");
  const content = `${add2eTradeStyles()}
    <div class="add2e-trade-dialog" data-add2e-trade-dialog="${uid}">
      <div class="add2e-trade-title"><span><i class="fas fa-handshake"></i> Proposer un échange</span><small>ADD2E</small></div>
      <div class="add2e-trade-box add2e-trade-actor-row">
        <div class="add2e-trade-actor-pill" title="${add2eTradeEscape(actor.name)}">${add2eTradeEscape(actor.name)}</div>
        <div class="add2e-trade-arrow"><i class="fas fa-arrow-right"></i></div>
        <div class="add2e-trade-actor-pill">Receveur</div>
      </div>
      <div class="add2e-trade-box add2e-trade-offer">
        <div class="add2e-trade-offer-icon"><i class="${offerIcon}"></i></div>
        <div>
          <span class="add2e-trade-label">Ce qui est proposé</span>
          <div class="add2e-trade-value">${add2eTradeEscape(offerName)}</div>
          <div class="add2e-trade-muted">${add2eTradeEscape(offerDetail)}</div>
        </div>
      </div>
      <div class="add2e-trade-box add2e-trade-grid">
        <label>Receveur</label><select name="targetActorId">${options}</select>
        <label>Quantité</label><input type="number" name="quantity" min="1" max="${maxQty}" step="1" value="1">
      </div>
      <div class="add2e-trade-box">
        <span class="add2e-trade-label">Argent demandé en échange</span>
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
  const requestHtml = add2eTradeMoneyChips(proposal.requestMoney);
  const offerIcon = add2eTradeOfferIcon(proposal);
  const content = `${add2eTradeStyles()}
    <div class="add2e-trade-dialog" data-add2e-trade-dialog="${uid}">
      <div class="add2e-trade-title"><span><i class="fas fa-handshake"></i> Valider l'échange</span><small>Confirmation</small></div>
      <div class="add2e-trade-box add2e-trade-actor-row">
        <div class="add2e-trade-actor-pill" title="${add2eTradeEscape(proposal.sourceActorName)}">${add2eTradeEscape(proposal.sourceActorName)}</div>
        <div class="add2e-trade-arrow"><i class="fas fa-arrow-right"></i></div>
        <div class="add2e-trade-actor-pill" title="${add2eTradeEscape(proposal.targetActorName)}">${add2eTradeEscape(proposal.targetActorName)}</div>
      </div>
      <div class="add2e-trade-box add2e-trade-offer">
        <div class="add2e-trade-offer-icon"><i class="${offerIcon}"></i></div>
        <div>
          <span class="add2e-trade-label">Reçu</span>
          <div class="add2e-trade-value">${add2eTradeEscape(add2eTradeOfferLabel(proposal))}</div>
        </div>
      </div>
      <div class="add2e-trade-box">
        <span class="add2e-trade-label">À donner en échange</span>
        <div>${requestHtml}</div>
        <div class="add2e-trade-muted" style="margin-top:4px;">${add2eTradeEscape(requestLabel)}</div>
      </div>
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
  add2eTradeEnsureStyles();
  game.socket.on(ADD2E_PLAYER_TRADES_SOCKET, add2eTradeHandleSocket);
  document.addEventListener("click", add2eTradeHandleClick, true);
  globalThis.ADD2E_PLAYER_TRADES_VERSION = ADD2E_PLAYER_TRADES_VERSION;
});