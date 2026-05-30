// scripts/add2e-attack/04i-attack-roll-chat-card.mjs
// ADD2E — Cartes de chat d'attaque.
// Version : 2026-05-30-attack-chat-player-delivery-v10

const VERSION = "2026-05-30-attack-chat-player-delivery-v10";
const SOCKET = "system.add2e";
const LOCAL_CARD = "ADD2E_ATTACK_PLAYER_LOCAL_CHAT";

globalThis.ADD2E_ATTACK_CHAT_VISIBILITY_VERSION = VERSION;

function esc(v) {
  const d = document.createElement("div");
  d.innerText = String(v ?? "");
  return d.innerHTML;
}

function n(v, f = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : f;
}

function sign(v) {
  const x = n(v);
  return `${x >= 0 ? "+" : ""}${x}`;
}

function gmIds() {
  return (ChatMessage.getWhisperRecipients?.("GM") ?? Array.from(game.users ?? []).filter(u => u.isGM)).map(u => u.id).filter(Boolean);
}

function playerUsers() {
  return Array.from(game.users ?? []).filter(u => u && !u.isGM && u.id);
}

function playerIds() {
  return playerUsers().map(u => u.id).filter(Boolean);
}

function firstPlayerId() {
  return playerUsers().find(u => u.active)?.id ?? playerUsers()[0]?.id ?? null;
}

function result(ctx) {
  if (n(ctx.d20) === 20) return { title: "Coup exceptionnel !", hit: true, color: "#b7791f", bg: "#fff7d6", icon: "fa-star" };
  if (n(ctx.d20) === 1) return { title: "Échec critique !", hit: false, color: "#9f1239", bg: "#fff1f2", icon: "fa-times" };
  return ctx.finalResult
    ? { title: "Touché !", hit: true, color: "#27ae60", bg: "#eefaf2", icon: "fa-check" }
    : { title: "Raté.", hit: false, color: "#b7473f", bg: "#fff1f0", icon: "fa-times" };
}

function rp(ctx) {
  const a = esc(ctx.actor?.name ?? "L'assaillant");
  const t = esc(ctx.nomCible ?? ctx.cible?.name ?? "la cible");
  const w = esc(ctx.arme?.name ?? "son arme");
  if (n(ctx.d20) === 20) return `${a} trouve une ouverture parfaite : ${w} frappe avec une précision remarquable.`;
  if (n(ctx.d20) === 1) return `${a} se précipite et son attaque tourne court dans un déséquilibre dangereux.`;
  if (ctx.finalResult) return `${a} force la garde de ${t} et place son attaque.`;
  return `${t} évite l'attaque de justesse.`;
}

function rollLine(ctx) {
  const d20 = n(ctx.d20);
  const bonus = n(ctx.totalBonusToucher);
  const total = n(ctx.totalAuToucher, d20 + bonus);
  return `${esc(d20)} ${esc(sign(bonus))} = <b>${esc(total)}</b>`;
}

function cardShell(kind, ctx, inner) {
  const r = result(ctx);
  const cls = kind === "gm" ? "add2e-attack-chat-card-gm-v10" : "add2e-attack-chat-card-player-v10";
  const title = kind === "gm" ? "Attaque — MJ" : "Attaque";
  return `<div class="add2e-chat-card ${cls}" style="font-family:var(--font-primary);border:1px solid #b58b3a;border-radius:12px;background:linear-gradient(180deg,#fffaf0 0%,#f3e4bf 100%);box-shadow:0 2px 9px rgba(66,39,8,.22);overflow:hidden;color:#2c2212;">
    <div style="display:flex;align-items:center;gap:8px;background:linear-gradient(90deg,#3d2307,#8b5e20);color:#fff;padding:8px 10px;border-bottom:2px solid #d7b45a;">
      <i class="fas ${r.icon}" style="font-size:1.22rem;color:#ffd978;"></i>
      <div style="min-width:0;flex:1;"><div style="font-size:1.04rem;font-weight:950;line-height:1.1;">${title}</div><div style="font-size:.78rem;font-weight:750;color:#f7e3b1;line-height:1.18;margin-top:2px;">${esc(ctx.actor?.name)} attaque ${esc(ctx.nomCible)} avec ${esc(ctx.arme?.name)}</div></div>
      <div style="white-space:nowrap;border:1px solid rgba(255,255,255,.45);background:${r.color};color:#fff;border-radius:999px;padding:4px 9px;font-weight:950;font-size:.86rem;">${esc(r.title)}</div>
    </div>
    <div style="padding:10px;">${inner}</div>
  </div>`;
}

function buildPlayerCard(ctx) {
  const r = result(ctx);
  const dmg = ctx.finalResult && n(ctx.degats) > 0
    ? `<div style="border:1px solid #c8a557;background:#fff6df;border-radius:9px;padding:8px;text-align:center;margin-top:8px;"><div style="font-size:.72rem;font-weight:950;text-transform:uppercase;color:#6f5520;">Dégâts infligés</div><div style="font-size:1.25rem;font-weight:950;color:#7a2e17;margin-top:2px;">${esc(ctx.degats)}</div></div>`
    : "";
  return cardShell("player", ctx, `
    <div style="border:1px solid #c8a557;background:#fffdf5;border-radius:9px;padding:8px;text-align:center;margin-bottom:8px;"><div style="font-size:.72rem;font-weight:950;text-transform:uppercase;color:#6f5520;">Jet d'attaque</div><div style="font-size:1.08rem;font-weight:950;color:#2c2212;margin-top:2px;"><i class="fas fa-dice-d20"></i> ${rollLine(ctx)}</div></div>
    <div style="border:1px solid ${r.color};background:${r.bg};border-radius:10px;padding:9px 10px;"><div style="font-weight:950;color:${r.color};font-size:1rem;margin-bottom:4px;"><i class="fas ${r.icon}"></i> ${esc(r.title)}</div><div style="font-size:.94rem;line-height:1.45;">${rp(ctx)}</div></div>
    ${dmg}
  `);
}

function buildGmCard(ctx) {
  const r = result(ctx);
  const details = [
    `<b>Jet :</b> ${rollLine(ctx)}`,
    `<b>THAC0 :</b> ${esc(ctx.thaco)}`,
    `<b>CA cible :</b> ${esc(ctx.caFinaleCible)}`,
    `<b>Seuil sans modificateur :</b> ${esc(ctx.valeurPourToucher)}`,
    `<b>Mod. ${esc(ctx.modCaracToucherLabel)} :</b> ${esc(sign(ctx.modCaracToucher))}`,
    `<b>Mod. magique arme :</b> ${esc(sign(ctx.bonusHit))}`,
    `<b>Mod. effets actifs :</b> ${esc(sign(ctx.bonusToucheEffets))}`,
    `<b>Mod. portée :</b> ${esc(sign(ctx.malusPortee))} (${esc(ctx.descPortee)})`,
    `<b>Mod. temporaire :</b> ${esc(sign(ctx.userBonus))}`,
    `<b>Mod. armure / arme :</b> ${esc(sign(ctx.ajustementCA))}`,
    `<b>Total modificateur :</b> ${esc(sign(ctx.totalBonusToucher))}`,
    `<b>Seuil final au d20 :</b> ${esc(ctx.seuilFinalD20)}`
  ];
  if (ctx.activePositionAttackAdjustment?.details?.length) details.splice(3, 0, `<b>Position :</b> ${ctx.activePositionAttackAdjustment.details.map(esc).join(" ; ")}`);
  if (ctx.conditionalACLine) details.splice(3, 0, ctx.conditionalACLine);
  if (ctx.useBackstab) details.push(`<b>Attaque sournoise :</b> +4 toucher, dégâts ×${esc(ctx.backstabMultiplier)}`);
  if (ctx.useAssassination) details.push(`<b>Assassinat :</b> ${esc(ctx.assassinationInfo?.score ?? 0)}%${ctx.assassinatMod ? ` (${esc(sign(ctx.assassinatMod))} situation)` : ""}`);
  const dmg = ctx.finalResult
    ? `<div style="border:1px solid #c8a557;background:#fff6df;border-radius:9px;padding:8px;text-align:center;margin:8px 0;"><div style="font-size:.72rem;font-weight:950;text-transform:uppercase;color:#6f5520;">Dégâts infligés</div><div style="font-size:1.25rem;font-weight:950;color:#7a2e17;margin-top:2px;">${esc(ctx.degats)}</div><div style="font-size:.78rem;color:#71624b;font-weight:850;">${esc(ctx.formulaDegats)} → ${esc(ctx.detailsDegats)}</div></div>`
    : `<div style="border:1px solid #d9c894;background:#fff;border-radius:8px;padding:8px;margin:8px 0;">Aucun dommage : l'attaque ne touche pas.</div>`;
  return cardShell("gm", ctx, `
    <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-bottom:8px;">
      <div style="border:1px solid #d8c489;background:#fff9e8;border-radius:8px;padding:6px 8px;"><div style="font-size:.68rem;font-weight:900;text-transform:uppercase;color:#6f5520;">Portée</div><div style="font-size:.98rem;font-weight:900;color:#5d3d0d;margin-top:3px;">${esc(ctx.descPortee || "—")}</div></div>
      <div style="border:1px solid #d8c489;background:#fff9e8;border-radius:8px;padding:6px 8px;"><div style="font-size:.68rem;font-weight:900;text-transform:uppercase;color:#6f5520;">Seuil</div><div style="font-size:.98rem;font-weight:900;color:#c06000;margin-top:3px;">${esc(ctx.seuilFinalD20)}</div></div>
      <div style="border:1px solid #d8c489;background:#fff9e8;border-radius:8px;padding:6px 8px;"><div style="font-size:.68rem;font-weight:900;text-transform:uppercase;color:#6f5520;">Issue</div><div style="font-size:.98rem;font-weight:900;color:${r.color};margin-top:3px;">${esc(r.title)}</div></div>
    </div>
    ${dmg}
    <details style="margin-top:8px;border:1px solid #c6a85b;border-radius:9px;background:#fffdf6;overflow:hidden;" open><summary style="cursor:pointer;background:#ead7a4;color:#3f2d0e;padding:7px 9px;font-weight:950;"><i class="fas fa-list-check"></i> Détails du jet</summary><div style="padding:8px;line-height:1.55;color:#2f2a20;">${details.map(x => `<div>${x}</div>`).join("")}</div></details>
  `);
}

function findChatLog() {
  return ui.chat?.element?.[0]?.querySelector?.("#chat-log") ?? ui.chat?.element?.[0]?.querySelector?.(".chat-log") ?? document.getElementById("chat-log") ?? document.querySelector(".chat-log") ?? null;
}

function renderLocalPlayerCard(payload = {}) {
  if (game.user?.isGM) return false;
  const ids = Array.isArray(payload.userIds) ? payload.userIds : [];
  if (ids.length && !ids.includes(game.user.id)) return false;
  const content = String(payload.content ?? "");
  if (!content) return false;
  const log = findChatLog();
  if (!log) return false;
  const li = document.createElement("li");
  li.className = "chat-message message flexcol add2e-local-attack-player-message";
  li.innerHTML = `<header class="message-header flexrow"><h4 class="message-sender">${esc(payload.speaker?.alias || "ADD2E")}</h4><span class="message-metadata"><time class="message-timestamp">${new Date().toLocaleTimeString()}</time></span></header><div class="message-content">${content}</div>`;
  log.appendChild(li);
  ui.chat?.scrollBottom?.();
  return true;
}

function registerLocalSocket() {
  if (!game?.socket?.on) return false;
  if (globalThis.__ADD2E_ATTACK_LOCAL_PLAYER_SOCKET === VERSION) return true;
  globalThis.__ADD2E_ATTACK_LOCAL_PLAYER_SOCKET = VERSION;
  game.socket.on(SOCKET, data => {
    if (data?.type !== LOCAL_CARD) return;
    renderLocalPlayerCard(data.payload ?? {});
  });
  console.log("[ADD2E][ATTACK][PLAYER_LOCAL_SOCKET]", VERSION);
  return true;
}

function installLocalSocket() {
  if (registerLocalSocket()) return;
  Hooks.once("ready", registerLocalSocket);
  setTimeout(registerLocalSocket, 250);
  setTimeout(registerLocalSocket, 1000);
}

function sendPlayerCard(ctx) {
  const ids = playerIds();
  if (!ids.length) return;
  const payload = { userIds: ids, speaker: ChatMessage.getSpeaker({ actor: ctx.actor }), content: buildPlayerCard(ctx), version: VERSION };

  if (!game.user?.isGM && ids.includes(game.user.id)) renderLocalPlayerCard(payload);

  game.socket?.emit?.(SOCKET, { type: LOCAL_CARD, payload });

  const author = firstPlayerId();
  if (author) {
    ChatMessage.create({
      author,
      user: author,
      speaker: payload.speaker,
      content: payload.content,
      whisper: ids,
      blind: false,
      flags: { add2e: { attackChatVisibility: "players-only-fallback", attackChatVisibilityVersion: VERSION } }
    }).catch(err => console.warn("[ADD2E][ATTACK][PLAYER_FALLBACK_CHAT]", err));
  }
}

function installVisibilityGuard() {
  if (globalThis.__ADD2E_ATTACK_CHAT_VISIBILITY_GUARD === VERSION) return;
  globalThis.__ADD2E_ATTACK_CHAT_VISIBILITY_GUARD = VERSION;
  Hooks.on("preCreateChatMessage", (message, data = {}) => {
    const content = String(data.content ?? message?.content ?? "");
    if (content.includes("add2e-attack-chat-card-gm-v10")) {
      message.updateSource?.({ whisper: gmIds(), blind: false, "flags.add2e.attackChatVisibility": "gm-only", "flags.add2e.attackChatVisibilityVersion": VERSION });
    }
    if (content.includes("add2e-attack-chat-card-player-v10")) {
      message.updateSource?.({ whisper: playerIds(), blind: false, "flags.add2e.attackChatVisibility": "players-only", "flags.add2e.attackChatVisibilityVersion": VERSION });
    }
  });
}

installVisibilityGuard();
installLocalSocket();

export function add2eBuildAttackPlayerChatCard(ctx) {
  return buildPlayerCard(ctx);
}

export function add2eBuildAttackChatCard(ctx) {
  setTimeout(() => sendPlayerCard(ctx), 0);
  return buildGmCard(ctx);
}
