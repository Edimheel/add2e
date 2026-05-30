// scripts/add2e-attack/04i-attack-roll-chat-card.mjs
// ADD2E — Cartes de chat d'attaque.
// Version : 2026-05-30-attack-chat-real-player-hidden-from-gm-v17

const VERSION = "2026-05-30-attack-chat-real-player-hidden-from-gm-v17";
const SOCKET = "system.add2e";
const PLAYER_LOCAL_TYPE = "ADD2E_ATTACK_PLAYER_LOCAL_CHAT";
const LOG = "[ADD2E][ATTACK_CHAT]";

globalThis.ADD2E_ATTACK_CHAT_VISIBILITY_VERSION = VERSION;

console.log(`${LOG}[BOOT]`, {
  version: VERSION,
  user: game?.user?.name ?? null,
  isGM: game?.user?.isGM ?? null,
  ready: game?.ready ?? null,
  hasSocket: !!game?.socket
});

function esc(value) {
  const div = document.createElement("div");
  div.innerText = String(value ?? "");
  return div.innerHTML;
}

function signed(value) {
  const n = Number(value) || 0;
  return `${n >= 0 ? "+" : ""}${n}`;
}

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function outcome(ctx) {
  if (Number(ctx.d20) === 20) return { key: "natural20", hit: true, title: "Coup exceptionnel !", icon: "fa-star", color: "#b7791f", bg: "#fff7d6" };
  if (Number(ctx.d20) === 1) return { key: "natural1", hit: false, title: "Échec critique !", icon: "fa-times", color: "#9f1239", bg: "#fff1f2" };
  const hit = !!ctx.finalResult;
  return { key: hit ? "hit" : "miss", hit, title: hit ? "Touché !" : "Raté.", icon: hit ? "fa-check" : "fa-times", color: hit ? "#27ae60" : "#b7473f", bg: hit ? "#eefaf2" : "#fff1f0" };
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)] ?? list[0] ?? "";
}

function roleplay(ctx) {
  const a = esc(ctx.actor?.name ?? "L’assaillant");
  const t = esc(ctx.nomCible ?? ctx.cible?.name ?? "la cible");
  const w = esc(ctx.arme?.name ?? "son arme");
  const o = outcome(ctx);

  if (o.key === "natural20") return pick([
    `${a} trouve une ouverture parfaite : ${w} frappe avec une précision remarquable.`,
    `Le geste de ${a} est net, presque trop rapide à suivre. ${t} encaisse un coup d’exception.`,
    `La fortune sourit à ${a} : l’attaque passe au moment exact où la défense cède.`,
    `${a} transforme son attaque en coup magistral. ${t} est pris de court.`
  ]);

  if (o.key === "natural1") return pick([
    `${a} se précipite et son attaque tourne court dans un déséquilibre dangereux.`,
    `Le coup part mal : ${w} manque sa trajectoire et laisse ${a} exposé.`,
    `Un faux mouvement ruine l’assaut de ${a}. ${t} échappe à l’attaque sans effort.`,
    `${a} tente une manœuvre trop ambitieuse ; l’attaque se transforme en échec critique.`
  ]);

  if (o.hit) return pick([
    `${a} force la garde de ${t} et place son attaque.`,
    `${w} trouve son chemin malgré la défense de ${t}.`,
    `${a} ajuste son geste et touche ${t}.`,
    `L’attaque de ${a} passe : ${t} subit le choc.`
  ]);

  return pick([
    `${t} évite l’attaque de justesse.`,
    `${a} frappe, mais ${t} parvient à détourner le danger.`,
    `${w} fend l’air sans trouver sa cible.`,
    `${t} tient bon : l’attaque ne passe pas.`
  ]);
}

function gmUsers() {
  const recipients = ChatMessage.getWhisperRecipients?.("GM") ?? [];
  const users = recipients.length ? recipients : Array.from(game.users ?? []).filter(u => u.isGM);
  return users.filter(u => u?.id);
}

function gmIds() {
  return gmUsers().map(u => u.id).filter(Boolean);
}

function playerUsers() {
  return Array.from(game.users ?? []).filter(u => u && !u.isGM && u.id);
}

function playerIds() {
  return playerUsers().map(u => u.id).filter(Boolean);
}

function rollSummary(ctx) {
  const d20 = safeNumber(ctx.d20);
  const bonus = safeNumber(ctx.totalBonusToucher);
  const total = safeNumber(ctx.totalAuToucher, d20 + bonus);
  return `<div style="border:1px solid #c8a557;background:#fffdf5;border-radius:9px;padding:8px;text-align:center;margin-bottom:8px;">
    <div style="font-size:.72rem;font-weight:950;text-transform:uppercase;color:#6f5520;">Jet d’attaque</div>
    <div style="font-size:1.08rem;font-weight:950;color:#2c2212;margin-top:2px;"><i class="fas fa-dice-d20"></i> ${esc(d20)} ${esc(signed(bonus))} = <span style="color:#7a2e17;">${esc(total)}</span></div>
  </div>`;
}

function chip(label, value, color = "#5d3d0d") {
  return `<div style="border:1px solid #d8c489;background:#fff9e8;border-radius:8px;padding:6px 8px;min-width:0;">
    <div style="font-size:.68rem;font-weight:900;text-transform:uppercase;color:#6f5520;letter-spacing:.03em;line-height:1;">${esc(label)}</div>
    <div style="font-size:.98rem;font-weight:900;color:${color};margin-top:3px;line-height:1.15;">${value || "—"}</div>
  </div>`;
}

function portrait(name, img, fallbackIcon = "fa-user") {
  const safeName = esc(name || "—");
  const safeImg = esc(img || "");
  const visual = safeImg
    ? `<img src="${safeImg}" alt="${safeName}" style="width:30px;height:30px;border-radius:999px;object-fit:cover;border:1px solid rgba(255,255,255,.55);background:#2b1b08;">`
    : `<span style="width:30px;height:30px;border-radius:999px;display:inline-grid;place-items:center;border:1px solid rgba(255,255,255,.55);background:#2b1b08;"><i class="fas ${fallbackIcon}"></i></span>`;
  return `<div style="display:flex;align-items:center;gap:6px;min-width:0;">
    ${visual}
    <div style="min-width:0;">
      <div style="font-size:.66rem;font-weight:900;text-transform:uppercase;color:#f0d796;line-height:1;">${fallbackIcon === "fa-shield-halved" ? "Défenseur" : "Attaquant"}</div>
      <div style="font-size:.86rem;font-weight:950;color:#fff;line-height:1.12;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:96px;">${safeName}</div>
    </div>
  </div>`;
}

function cardShell(kind, ctx, inner) {
  const o = outcome(ctx);
  const isGM = kind === "gm";
  const cls = isGM ? "add2e-attack-chat-card-gm-v17" : "add2e-attack-chat-card-player-v17";
  const attackerImg = ctx.chatImg || ctx.actor?.img || "";
  const defenderImg = ctx.cible?.token?.texture?.src || ctx.cible?.img || "";
  return `<div class="add2e-chat-card ${cls}" style="font-family:var(--font-primary);border:1px solid #b58b3a;border-radius:12px;background:linear-gradient(180deg,#fffaf0 0%,#f3e4bf 100%);box-shadow:0 2px 9px rgba(66,39,8,.22);overflow:hidden;color:#2c2212;">
    <div style="display:flex;align-items:center;gap:8px;background:linear-gradient(90deg,#3d2307,#8b5e20);color:#fff;padding:8px 10px;border-bottom:2px solid #d7b45a;">
      <div style="display:flex;align-items:center;gap:7px;min-width:0;flex:1;">
        ${portrait(ctx.actor?.name, attackerImg, "fa-user")}
        <i class="fas fa-arrow-right" style="color:#ffd978;font-size:.9rem;flex:0 0 auto;"></i>
        ${portrait(ctx.nomCible ?? ctx.cible?.name, defenderImg, "fa-shield-halved")}
      </div>
      <div style="white-space:nowrap;border:1px solid rgba(255,255,255,.45);background:${o.color};color:#fff;border-radius:999px;padding:4px 9px;font-weight:950;font-size:.86rem;">${esc(o.title)}</div>
    </div>
    <div style="padding:10px;">${inner}</div>
  </div>`;
}

function buildPublicCard(ctx) {
  const o = outcome(ctx);
  const showDamage = !!ctx.finalResult && Number(ctx.degats) > 0;
  const damage = showDamage ? `<div style="border:1px solid #c8a557;background:#fff6df;border-radius:9px;padding:8px;text-align:center;margin-top:8px;"><div style="font-size:.72rem;font-weight:950;text-transform:uppercase;color:#6f5520;">Dégâts infligés</div><div style="font-size:1.25rem;font-weight:950;color:#7a2e17;margin-top:2px;">${esc(ctx.degats)}</div></div>` : "";
  return cardShell("player", ctx, `
    ${rollSummary(ctx)}
    <div style="border:1px solid ${o.color};background:${o.bg};border-radius:10px;padding:9px 10px;margin-bottom:8px;"><div style="font-weight:950;color:${o.color};font-size:1rem;margin-bottom:4px;"><i class="fas ${o.icon}"></i> ${esc(o.title)}</div><div style="font-size:.94rem;line-height:1.45;">${roleplay(ctx)}</div></div>
    ${damage}
  `);
}

function buildGmCard(ctx) {
  const o = outcome(ctx);
  const hit = !!ctx.finalResult;
  const positionDetails = Array.isArray(ctx.activePositionAttackAdjustment?.details) ? ctx.activePositionAttackAdjustment.details : [];
  const calculSimple = `<b>${esc(ctx.d20)}</b> <span style="color:#6d654f;font-size:0.8em;">(d20)</span> ${esc(signed(ctx.totalBonusToucher))} = <b style="font-size:1.1em;">${esc(ctx.totalAuToucher)}</b>`;
  const naturalLine = o.key === "natural20" ? `<div style="color:#b7791f;"><b>20 naturel :</b> coup exceptionnel, réussite automatique.</div>` : o.key === "natural1" ? `<div style="color:#9f1239;"><b>1 naturel :</b> échec critique, échec automatique.</div>` : "";
  const touchLines = [
    naturalLine,
    `<div><b>Base THAC0 :</b> ${esc(ctx.thaco)}</div>`,
    `<div><b>Classe d’armure cible :</b> ${esc(ctx.caFinaleCible)}${ctx.activePositionAttackAdjustment?.caAdjustment ? ` <span style="color:#7a4b00;">(position : ${esc(ctx.caAvantPosition)} → ${esc(ctx.caAvantConditionnelle)})</span>` : ""}</div>`,
    ctx.conditionalACLine || "",
    positionDetails.length ? `<div><b>Position :</b> ${positionDetails.map(esc).join(" ; ")}</div>` : "",
    `<div><b>Seuil sans modificateur :</b> ${esc(ctx.valeurPourToucher)}</div>`,
    `<hr style="border:0;border-top:1px solid #e0d3ad;margin:6px 0;">`,
    `<div><b>Modificateur ${esc(ctx.modCaracToucherLabel)} :</b> ${esc(signed(ctx.modCaracToucher))}</div>`,
    `<div><b>Modificateur magique arme :</b> ${esc(signed(ctx.bonusHit))}</div>`,
    `<div><b>Modificateur effets actifs :</b> ${esc(signed(ctx.bonusToucheEffets))}</div>`,
    `<div><b>Modificateur portée :</b> ${esc(signed(ctx.malusPortee))} (${esc(ctx.descPortee)})</div>`,
    `<div><b>Modificateur temporaire :</b> ${esc(signed(ctx.userBonus))}</div>`,
    ctx.useBackstab ? `<div><b>Attaque sournoise :</b> +4 toucher, dégâts ×${esc(ctx.backstabMultiplier)}</div>` : "",
    ctx.useAssassination ? `<div><b>Assassinat :</b> ${esc(ctx.assassinationInfo?.score ?? 0)}%${ctx.assassinatMod ? ` (${esc(signed(ctx.assassinatMod))} situation)` : ""}</div>` : "",
    `<div><b>Modificateur armure / arme :</b> ${esc(signed(ctx.ajustementCA))}</div>`,
    `<hr style="border:0;border-top:1px solid #e0d3ad;margin:6px 0;">`,
    `<div style="font-size:1.08em;"><b>Total modificateur :</b><span style="font-weight:bold;color:#2563eb;"> ${esc(signed(ctx.totalBonusToucher))}</span></div>`,
    `<div style="font-size:1.08em;"><b>Seuil final au d20 :</b><span style="font-weight:bold;color:#15803d;"> ${esc(ctx.seuilFinalD20)}</span></div>`
  ].filter(Boolean).join("");
  const damageLines = hit ? [
    `<div><b>Dégâts :</b> ${esc(ctx.degats)}</div>`,
    `<div><b>Calcul :</b> ${esc(ctx.formulaDegats)} → ${esc(ctx.detailsDegats)}</div>`,
    ctx.useBackstab ? `<div><b>Attaque sournoise :</b> dégâts ×${esc(ctx.backstabMultiplier)}</div>` : ""
  ].filter(Boolean).join("") : `<div>Aucun dommage : l’attaque ne touche pas.</div>`;
  const assassination = ctx.assassinatResult ? `<div style="border:1px solid ${ctx.assassinatResult.success ? "#1f8f4d" : "#b3261e"};background:${ctx.assassinatResult.success ? "#eefaf2" : "#fff1f0"};border-radius:8px;padding:7px;margin-bottom:10px;text-align:center;"><div style="font-weight:900;color:${ctx.assassinatResult.success ? "#1f8f4d" : "#b3261e"};">Assassinat ${ctx.assassinatResult.success ? "réussi" : "échoué"}</div><div style="font-size:.92em;">Jet : <b>${esc(ctx.assassinatResult.total)}</b> / Score : <b>${esc(ctx.assassinatResult.finalScore)}%</b></div><div style="font-size:.82em;color:#666;">${esc(ctx.assassinationInfo?.breakdownTitle ?? "")}</div></div>` : "";

  return cardShell("gm", ctx, `
    <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-bottom:8px;">${chip("Portée", `${esc(ctx.descPortee || "—")} <span style=\"font-size:.78rem;color:#7b6a40;\">${esc(ctx.typePortee || "")}</span>`)}${chip("Seuil", esc(ctx.seuilFinalD20), "#c06000")}${chip("Issue", esc(o.title), o.color)}</div>
    <div style="border:1px solid #d7c28a;background:#f7f0df;border-radius:9px;padding:8px;text-align:center;margin-bottom:8px;"><div style="font-size:.72rem;font-weight:950;text-transform:uppercase;color:#6f5520;">Jet d’attaque</div><div style="font-size:1.1rem;font-weight:950;margin-top:2px;"><i class="fas fa-dice-d20"></i> ${calculSimple}</div></div>
    ${hit ? `<div style="border:1px solid #c8a557;background:#fff6df;border-radius:9px;padding:8px;text-align:center;margin-bottom:8px;"><div style="font-size:.72rem;font-weight:950;text-transform:uppercase;color:#6f5520;">Dégâts infligés</div><div style="font-size:1.25rem;font-weight:950;color:#7a2e17;margin-top:2px;">${esc(ctx.degats)}</div><div style="font-size:.78rem;color:#71624b;font-weight:850;">${esc(ctx.formulaDegats)} → ${esc(ctx.detailsDegats)}</div></div>` : ""}
    ${assassination}
    <details style="margin-top:8px;border:1px solid #c6a85b;border-radius:9px;background:#fffdf6;overflow:hidden;"><summary style="cursor:pointer;background:#ead7a4;color:#3f2d0e;padding:7px 9px;font-weight:950;"><i class="fas fa-list-check"></i> Détails du jet</summary><div style="padding:8px;display:grid;gap:7px;"><details style="border:1px solid #d9c894;border-radius:8px;background:#fff;overflow:hidden;"><summary style="cursor:pointer;padding:6px 8px;background:#f4ead1;font-weight:950;color:#5a3c11;"><i class="fas fa-bullseye"></i> Toucher</summary><div style="padding:8px;line-height:1.55;color:#2f2a20;">${touchLines}</div></details><details style="border:1px solid #d9c894;border-radius:8px;background:#fff;overflow:hidden;"><summary style="cursor:pointer;padding:6px 8px;background:#f4ead1;font-weight:950;color:#5a3c11;"><i class="fas fa-burst"></i> Dommages</summary><div style="padding:8px;line-height:1.55;color:#2f2a20;">${damageLines}</div></details></div></details>
  `);
}

function findChatLog() {
  return ui.chat?.element?.[0]?.querySelector?.("#chat-log")
    ?? ui.chat?.element?.[0]?.querySelector?.(".chat-log")
    ?? document.getElementById("chat-log")
    ?? document.querySelector(".chat-log")
    ?? null;
}

function appendLocalCard(payload = {}) {
  const isGM = !!game.user?.isGM;
  const targets = Array.isArray(payload.userIds) ? payload.userIds.filter(Boolean) : [];
  const content = String(payload.content ?? "");

  console.log(`${LOG}[RENDER_LOCAL_PLAYER_ONLY]`, {
    version: VERSION,
    user: game.user?.name,
    isGM,
    userId: game.user?.id,
    targets,
    accepted: !isGM && (!targets.length || targets.includes(game.user.id)),
    hasContent: !!content
  });

  if (isGM) return false;
  if (targets.length && !targets.includes(game.user.id)) return false;
  if (!content) return false;

  const log = findChatLog();
  if (!log) {
    console.warn(`${LOG}[NO_CHAT_LOG]`, { user: game.user?.name, isGM, version: VERSION });
    return false;
  }

  const wrapper = document.createElement("li");
  wrapper.className = "chat-message message flexcol add2e-local-attack-player-message";
  wrapper.dataset.add2eLocalAttackCard = VERSION;
  wrapper.innerHTML = `<header class="message-header flexrow"><h4 class="message-sender">${esc(payload.speaker?.alias || "ADD2E")}</h4><span class="message-metadata"><time class="message-timestamp">${new Date().toLocaleTimeString()}</time></span></header><div class="message-content">${content}</div>`;
  log.appendChild(wrapper);
  ui.chat?.scrollBottom?.();
  return true;
}

function onSocketMessage(data) {
  if (data?.type !== PLAYER_LOCAL_TYPE) return;
  console.log(`${LOG}[RECEIVED_PLAYER_LOCAL]`, {
    version: VERSION,
    user: game.user?.name,
    isGM: game.user?.isGM,
    payloadVersion: data?.payload?.version,
    targets: data?.payload?.userIds ?? []
  });
  appendLocalCard(data.payload ?? {});
}

function registerSocket() {
  if (!game?.socket?.on) {
    console.warn(`${LOG}[SOCKET_NOT_READY]`, { version: VERSION, ready: game?.ready, hasSocket: !!game?.socket });
    return false;
  }
  if (globalThis.__ADD2E_ATTACK_LOCAL_PLAYER_SOCKET === VERSION) return true;
  globalThis.__ADD2E_ATTACK_LOCAL_PLAYER_SOCKET = VERSION;
  game.socket.on(SOCKET, onSocketMessage);
  console.log(`${LOG}[SOCKET_REGISTERED]`, { version: VERSION, user: game.user?.name, isGM: game.user?.isGM, ready: game?.ready });
  return true;
}

function installSocket() {
  if (registerSocket()) return;
  Hooks.once("ready", registerSocket);
  setTimeout(registerSocket, 250);
  setTimeout(registerSocket, 1000);
  setTimeout(registerSocket, 2500);
}

async function sendPlayerCard(ctx) {
  const users = playerIds();
  const payload = {
    userIds: users,
    speaker: ChatMessage.getSpeaker({ actor: ctx.actor }),
    content: buildPublicCard(ctx),
    avatar: ctx.chatImg,
    version: VERSION
  };

  console.log(`${LOG}[PLAYER_CARD_ROUTE]`, {
    version: VERSION,
    from: game.user?.name,
    isGM: game.user?.isGM,
    users,
    actor: ctx.actor?.name,
    target: ctx.nomCible,
    route: "chatmessage-players-only-with-gm-render-guard"
  });

  if (!users.length) return false;

  try {
    await ChatMessage.create({
      speaker: payload.speaker,
      content: payload.content,
      avatar: payload.avatar,
      whisper: users,
      blind: false,
      flags: {
        add2e: {
          attackChatVisibility: "players-only",
          attackChatVisibilityVersion: VERSION,
          attackChatKind: "public-player-result"
        }
      }
    });
    return true;
  } catch (err) {
    console.warn(`${LOG}[CREATE_PLAYER_CHAT_FAILED_FALLBACK_LOCAL]`, err);
    if (!game.user?.isGM && users.includes(game.user.id)) appendLocalCard(payload);
    game.socket?.emit?.(SOCKET, { type: PLAYER_LOCAL_TYPE, payload });
    return false;
  }
}

function isPlayerAttackMessage(message, htmlContent = "") {
  const flags = message?.flags?.add2e ?? {};
  const content = String(htmlContent || message?.content || "");
  return flags.attackChatVisibility === "players-only"
    || flags.attackChatKind === "public-player-result"
    || content.includes("add2e-attack-chat-card-player-v17")
    || content.includes("add2e-attack-chat-card-player-v16")
    || content.includes("add2e-attack-chat-card-player-v15")
    || content.includes("add2e-attack-chat-card-player-v12")
    || content.includes("add2e-attack-chat-card-player-v11");
}

function removeRenderedMessageElement(html) {
  try {
    if (!html) return false;
    if (typeof html.remove === "function") {
      html.remove();
      return true;
    }
    if (html[0] && typeof html[0].remove === "function") {
      html[0].remove();
      return true;
    }
    if (html instanceof HTMLElement) {
      html.remove();
      return true;
    }
  } catch (err) {
    console.warn(`${LOG}[REMOVE_RENDERED_MESSAGE_FAILED]`, err);
  }
  return false;
}

function hidePlayerCardFromGm(message, html) {
  if (!game.user?.isGM) return;
  if (!isPlayerAttackMessage(message)) return;
  const removed = removeRenderedMessageElement(html);
  console.log(`${LOG}[HIDE_PLAYER_CARD_FROM_GM]`, {
    version: VERSION,
    messageId: message?.id,
    removed
  });
}

function installRenderVisibilityGuard() {
  if (globalThis.__ADD2E_ATTACK_CHAT_RENDER_GUARD === VERSION) return;
  globalThis.__ADD2E_ATTACK_CHAT_RENDER_GUARD = VERSION;

  Hooks.on("renderChatMessage", (message, html) => hidePlayerCardFromGm(message, html));
  Hooks.on("renderChatMessageHTML", (message, html) => hidePlayerCardFromGm(message, html));
}

function installVisibilityGuard() {
  if (globalThis.__ADD2E_ATTACK_CHAT_VISIBILITY_GUARD === VERSION) return;
  globalThis.__ADD2E_ATTACK_CHAT_VISIBILITY_GUARD = VERSION;
  Hooks.on("preCreateChatMessage", (message, data = {}) => {
    const content = String(data.content ?? message?.content ?? "");
    if (content.includes("add2e-attack-chat-card-gm-v17") || content.includes("add2e-attack-chat-card-gm-v16") || content.includes("add2e-attack-chat-card-gm-v15") || content.includes("add2e-attack-chat-card-gm-v12") || content.includes("add2e-attack-chat-card-gm-v11")) {
      message.updateSource?.({
        whisper: gmIds(),
        blind: false,
        "flags.add2e.attackChatVisibility": "gm-only",
        "flags.add2e.attackChatVisibilityVersion": VERSION
      });
      console.log(`${LOG}[PRECREATE_GM_ONLY]`, { whisper: gmIds(), blind: false });
    }
    if (content.includes("add2e-attack-chat-card-player-v17") || content.includes("add2e-attack-chat-card-player-v16") || content.includes("add2e-attack-chat-card-player-v15") || content.includes("add2e-attack-chat-card-player-v12") || content.includes("add2e-attack-chat-card-player-v11")) {
      message.updateSource?.({
        whisper: playerIds(),
        blind: false,
        "flags.add2e.attackChatVisibility": "players-only",
        "flags.add2e.attackChatVisibilityVersion": VERSION,
        "flags.add2e.attackChatKind": "public-player-result"
      });
      console.log(`${LOG}[PRECREATE_PLAYER_ONLY]`, { whisper: playerIds(), blind: false });
    }
  });
}

installVisibilityGuard();
installRenderVisibilityGuard();
installSocket();

globalThis.add2eAttackChatDebug = function add2eAttackChatDebug() {
  const log = findChatLog();
  return {
    version: VERSION,
    socketRegistered: globalThis.__ADD2E_ATTACK_LOCAL_PLAYER_SOCKET,
    guardRegistered: globalThis.__ADD2E_ATTACK_CHAT_VISIBILITY_GUARD,
    renderGuardRegistered: globalThis.__ADD2E_ATTACK_CHAT_RENDER_GUARD,
    user: game.user?.name,
    userId: game.user?.id,
    isGM: game.user?.isGM,
    ready: game?.ready,
    hasSocket: !!game?.socket,
    chatLog: !!log,
    players: playerUsers().map(u => ({ id: u.id, name: u.name, active: u.active }))
  };
};

export function add2eBuildAttackPlayerChatCard(ctx) {
  return buildPublicCard(ctx);
}

export function add2eBuildAttackChatCard(ctx) {
  setTimeout(() => sendPlayerCard(ctx), 0);
  return buildGmCard(ctx);
}
