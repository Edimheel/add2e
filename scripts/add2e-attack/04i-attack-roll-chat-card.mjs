// scripts/add2e-attack/04i-attack-roll-chat-card.mjs
// ADD2E — Cartes de chat d'attaque construites par l'API commune.
// Une carte détaillée est créée par un client MJ ; une carte simplifiée par un client joueur.
// Compatible Foundry V13/V14/V15.

const VERSION = "2026-07-24-attack-chat-gm-collapsible-details-v27";
const SOCKET = "system.add2e";
const ROUTE_TYPE = "ADD2E_ATTACK_CHAT_ROUTE_V27";
const LOG = "[ADD2E][ATTACK_CHAT]";

globalThis.ADD2E_ATTACK_CHAT_VISIBILITY_VERSION = VERSION;
globalThis.__ADD2E_ATTACK_CHAT_ROUTE_IDS ??= new Set();

function escapeHtml(value) {
  const text = String(value ?? "");
  try {
    if (typeof foundry?.utils?.escapeHTML === "function") return foundry.utils.escapeHTML(text);
  } catch (_error) {}
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function signed(value) {
  const number = Number(value) || 0;
  return `${number >= 0 ? "+" : "−"}${Math.abs(number)}`;
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function outcome(ctx) {
  const snapshot = ctx?.snapshot ?? {};
  const d20 = number(snapshot?.roll?.d20 ?? ctx?.d20);
  const hit = snapshot?.result?.hit ?? (ctx?.finalResult === true);
  if (d20 === 20) return { key: "natural20", hit: true, title: "Coup exceptionnel !", icon: "fas fa-star", variant: "success" };
  if (d20 === 1) return { key: "natural1", hit: false, title: "Échec critique !", icon: "fas fa-times", variant: "failure" };
  return hit
    ? { key: "hit", hit: true, title: "Touché !", icon: "fas fa-check", variant: "success" }
    : { key: "miss", hit: false, title: "Raté.", icon: "fas fa-times", variant: "failure" };
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)] ?? list[0] ?? "";
}

function roleplay(ctx) {
  const attacker = String(ctx?.actor?.name ?? "L’assaillant");
  const target = String(ctx?.nomCible ?? ctx?.cible?.name ?? "la cible");
  const weapon = String(ctx?.arme?.name ?? "son arme");
  const result = outcome(ctx);

  if (result.key === "natural20") return pick([
    `${attacker} trouve une ouverture parfaite : ${weapon} frappe avec une précision remarquable.`,
    `Le geste de ${attacker} est net. ${target} encaisse un coup d’exception.`,
    `La fortune sourit à ${attacker} : la défense de ${target} cède au moment exact.`
  ]);
  if (result.key === "natural1") return pick([
    `${attacker} se précipite et son attaque tourne court.`,
    `Le coup part mal : ${weapon} manque sa trajectoire.`,
    `Un faux mouvement ruine l’assaut de ${attacker}.`
  ]);
  if (result.hit) return pick([
    `${attacker} force la garde de ${target} et place son attaque.`,
    `${weapon} trouve son chemin malgré la défense de ${target}.`,
    `${attacker} ajuste son geste et touche ${target}.`
  ]);
  return pick([
    `${target} évite l’attaque de justesse.`,
    `${attacker} frappe, mais ${target} détourne le danger.`,
    `${weapon} fend l’air sans trouver sa cible.`
  ]);
}

function users() {
  return Array.isArray(game?.users?.contents) ? game.users.contents : Array.from(game?.users ?? []);
}

function gmUsers() {
  return users().filter(user => user?.isGM && user?.id);
}

function playerUsers() {
  return users().filter(user => !user?.isGM && user?.id);
}

function userIds(list) {
  return list.map(user => String(user.id)).filter(Boolean);
}

function activeCreatorId(list) {
  return list
    .filter(user => user?.active === true && user?.id)
    .map(user => String(user.id))
    .sort((a, b) => a.localeCompare(b))[0] ?? null;
}

function requireCommonChatApi() {
  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    throw new Error("Le constructeur commun des cartes ADD2E est indisponible.");
  }
}

function cloneForSocket(value) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (error) {
    console.error(`${LOG}[SERIALIZE_FAILED]`, error);
    return null;
  }
}

function modifierSummary(resolution) {
  const applied = Array.isArray(resolution?.applied) ? resolution.applied : [];
  if (!applied.length) return "Aucun";
  return applied.map(entry => {
    const label = String(entry?.label ?? entry?.metadata?.label ?? entry?.source?.name ?? entry?.id ?? "Modificateur");
    const rangeBand = String(entry?.metadata?.rangeBand ?? "").trim();
    const suffix = rangeBand ? ` (${rangeBand})` : "";
    return `${label}${suffix} ${signed(entry?.contribution)}`;
  }).join(" ; ");
}

function positionSummary(snapshot) {
  const position = snapshot?.position ?? {};
  const label = String(position.label ?? position.zone ?? "Face");
  const before = number(position.caBefore, NaN);
  const afterPosition = number(position.caAfterPosition, NaN);
  const final = number(position.caFinal, NaN);
  const values = [before, afterPosition, final].filter(Number.isFinite);
  const distinct = [...new Set(values)];
  return distinct.length > 1 ? `${label} · CA ${distinct.join(" → ")}` : label;
}

function attackRollText(snapshot) {
  const d20 = number(snapshot?.roll?.d20);
  const bonus = number(snapshot?.roll?.bonus);
  const total = number(snapshot?.roll?.total, d20 + bonus);
  return `${d20} ${signed(bonus)} = ${total}`;
}

function rangeText(snapshot) {
  const range = snapshot?.range ?? {};
  const label = String(range.description ?? range.band ?? "Contact");
  return `${label} ${signed(range.modifier)}`;
}

function thresholdText(snapshot) {
  const threshold = snapshot?.threshold ?? {};
  return `${number(threshold.base)} - (${signed(snapshot?.roll?.bonus)}) = ${number(threshold.final)}`;
}

function sourceIdentity(ctx) {
  return {
    name: ctx?.actor?.name ?? "Attaquant",
    img: ctx?.chatImg ?? ctx?.actor?.img,
    type: "Attaquant",
    meta: ctx?.arme?.name ?? ""
  };
}

function targetIdentity(ctx) {
  return {
    name: ctx?.nomCible ?? ctx?.cible?.name ?? "Cible",
    img: ctx?.cible?.token?.texture?.src ?? ctx?.cible?.prototypeToken?.texture?.src ?? ctx?.cible?.img,
    type: "Défenseur"
  };
}

function baseFlags(ctx, visibility, kind) {
  return {
    add2e: {
      attackChatVisibility: visibility,
      attackChatKind: kind,
      attackChatVisibilityVersion: VERSION,
      attackDiagId: ctx.snapshot.diagId,
      attackSnapshotVersion: ctx.snapshot.version,
      createdByAttackRoll: true
    }
  };
}

function playerCardOptions(ctx) {
  const snapshot = ctx.snapshot;
  const result = outcome(ctx);
  const rows = [
    { label: "Arme", value: ctx?.arme?.name ?? "Arme" },
    { label: "Résultat", value: result.title }
  ];
  if (result.hit && number(snapshot?.damage?.amount) > 0) {
    rows.push({ label: "Dégâts", value: String(number(snapshot.damage.amount)) });
  }
  if (snapshot?.assassination?.resolved) {
    rows.push({ label: "Assassinat", value: snapshot.assassination.success ? "Réussi" : "Échoué" });
  }

  return {
    title: `Attaque — ${result.title}`,
    icon: result.icon,
    variant: result.variant,
    source: sourceIdentity(ctx),
    target: targetIdentity(ctx),
    rows,
    message: roleplay(ctx),
    chatData: {
      speaker: { alias: ctx?.actor?.name ?? "ADD2E" },
      whisper: userIds(playerUsers()),
      blind: false,
      flags: baseFlags(ctx, "players-only", "player-summary")
    }
  };
}

function gmCardOptions(ctx) {
  const snapshot = ctx.snapshot;
  const result = outcome(ctx);
  const rows = [
    { label: "Arme", value: ctx?.arme?.name ?? "Arme" },
    { label: "Résultat", value: result.title }
  ];
  if (result.hit) rows.push({ label: "Dégâts", value: String(number(snapshot?.damage?.amount)) });
  if (snapshot?.assassination?.resolved) {
    rows.push({
      label: "Assassinat",
      value: `${snapshot.assassination.success ? "Réussi" : "Échoué"} · ${snapshot.assassination.roll} / ${snapshot.assassination.score}%`
    });
  }

  const flags = baseFlags(ctx, "gm-only", "gm-details");
  flags.add2e.attackSnapshot = typeof foundry?.utils?.deepClone === "function"
    ? foundry.utils.deepClone(snapshot)
    : cloneForSocket(snapshot);

  return {
    title: `Détails d’attaque — ${result.title}`,
    icon: "fas fa-list-check",
    variant: result.variant,
    source: sourceIdentity(ctx),
    target: targetIdentity(ctx),
    rows,
    chatData: {
      speaker: { alias: ctx?.actor?.name ?? "ADD2E" },
      whisper: userIds(gmUsers()),
      blind: false,
      flags
    }
  };
}

function detailRowsHtml(rows = []) {
  return rows
    .filter(row => row && (row.label !== undefined || row.value !== undefined))
    .map(row => `<div class="add2e-card-label">${escapeHtml(row.label ?? "")}</div><div class="add2e-card-value">${escapeHtml(row.value ?? "—")}</div>`)
    .join("");
}

function detailSectionHtml({ label, icon, rows }) {
  const body = detailRowsHtml(rows);
  if (!body) return "";
  return `<details class="add2e-attack-detail-section" style="margin-top:8px;border:1px solid var(--add2e-card-border,#b98b2d);border-radius:8px;overflow:hidden;background:rgba(255,255,255,.35);"><summary style="cursor:pointer;padding:7px 9px;font-weight:900;background:rgba(185,139,45,.18);"><i class="${escapeHtml(icon)}"></i> ${escapeHtml(label)}</summary><div class="add2e-card-grid" style="padding:8px;">${body}</div></details>`;
}

function gmDetailsHtml(ctx) {
  const snapshot = ctx.snapshot;
  const result = outcome(ctx);
  const threshold = snapshot?.threshold ?? {};
  const touchRows = [
    { label: "Diagnostic", value: snapshot.diagId },
    { label: "Jet", value: attackRollText(snapshot) },
    { label: "Portée", value: rangeText(snapshot) },
    { label: "Position", value: positionSummary(snapshot) },
    { label: "THAC0 / CA", value: `${number(threshold.thac0)} - ${number(threshold.armorClass)} = ${number(threshold.base)}` },
    { label: "Modificateurs", value: modifierSummary(snapshot.attackResolution) },
    { label: "Bonus total", value: signed(snapshot?.roll?.bonus) },
    { label: "Seuil final au d20", value: thresholdText(snapshot) }
  ];
  const conditional = Array.isArray(snapshot?.conditionalDetails) ? snapshot.conditionalDetails.filter(Boolean) : [];
  if (conditional.length) touchRows.push({ label: "Défenses conditionnelles", value: conditional.join(" ; ") });

  const damageRows = result.hit
    ? [
        { label: "Modificateurs", value: modifierSummary(snapshot.damageResolution) },
        { label: "Formule", value: snapshot?.damage?.formula ?? "—" },
        { label: "Détail du jet", value: snapshot?.damage?.details ?? "—" },
        { label: "Total", value: String(number(snapshot?.damage?.amount)) }
      ]
    : [{ label: "Dégâts", value: "Aucun : l’attaque ne touche pas." }];
  if (ctx.useBackstab) damageRows.push({ label: "Attaque sournoise", value: `Dégâts ×${number(ctx.backstabMultiplier, 1)}` });
  if (snapshot?.assassination?.resolved) {
    damageRows.push({
      label: "Assassinat",
      value: `${snapshot.assassination.success ? "Réussi" : "Échoué"} · ${snapshot.assassination.roll} / ${snapshot.assassination.score}%`
    });
  }

  return [
    detailSectionHtml({ label: "Détails du toucher", icon: "fas fa-bullseye", rows: touchRows }),
    detailSectionHtml({ label: "Détails des dégâts", icon: "fas fa-burst", rows: damageRows })
  ].join("");
}

function appendDetailsToCard(cardHtml, detailsHtml) {
  const card = String(cardHtml ?? "");
  const details = String(detailsHtml ?? "");
  if (!card || !details) return card;
  const marker = "</div></div>";
  const index = card.lastIndexOf(marker);
  if (index < 0) return `${card}${details}`;
  return `${card.slice(0, index)}${details}${card.slice(index)}`;
}

async function createRoutedCard(payload = {}) {
  requireCommonChatApi();
  const messageId = String(payload.messageId ?? "");
  if (!messageId || globalThis.__ADD2E_ATTACK_CHAT_ROUTE_IDS.has(messageId)) return null;
  if (String(payload.creatorId ?? "") !== String(game.user?.id ?? "")) return null;

  const options = payload.options && typeof payload.options === "object" ? payload.options : null;
  if (!options) return null;
  const preview = String(globalThis.add2eBuildChatCard(options) ?? "").trim();
  if (!preview) throw new Error(`La carte d’attaque ${payload.kind ?? "inconnue"} est vide.`);

  globalThis.__ADD2E_ATTACK_CHAT_ROUTE_IDS.add(messageId);
  try {
    const message = await globalThis.add2eCreateChatCard(options);
    const detailsHtml = String(payload.detailsHtml ?? "").trim();
    if (message && detailsHtml) {
      const enrichedContent = appendDetailsToCard(preview, detailsHtml);
      if (enrichedContent && enrichedContent !== preview) await message.update({ content: enrichedContent });
    }
    return message;
  } catch (error) {
    globalThis.__ADD2E_ATTACK_CHAT_ROUTE_IDS.delete(messageId);
    throw error;
  }
}

function onAttackChatSocket(data) {
  if (data?.type !== ROUTE_TYPE) return;
  const payload = data?.payload ?? {};
  if (payload.version !== VERSION) return;
  if (String(payload.creatorId ?? "") !== String(game.user?.id ?? "")) return;
  void createRoutedCard(payload).catch(error => console.error(`${LOG}[ROUTED_CREATE_FAILED]`, { payload, error }));
}

function registerAttackChatSocket() {
  if (!game?.socket?.on) return false;
  const previous = globalThis.__ADD2E_ATTACK_CHAT_SOCKET_HANDLER;
  if (previous && typeof game.socket.off === "function") game.socket.off(SOCKET, previous);
  globalThis.__ADD2E_ATTACK_CHAT_SOCKET_HANDLER = onAttackChatSocket;
  game.socket.on(SOCKET, onAttackChatSocket);
  globalThis.__ADD2E_ATTACK_CHAT_SOCKET_VERSION = VERSION;
  return true;
}

function installAttackChatSocket() {
  if (registerAttackChatSocket()) return;
  Hooks.once("ready", registerAttackChatSocket);
}

async function routeCard(kind, options, ctx) {
  const recipients = kind === "gm" ? gmUsers() : playerUsers();
  const creatorId = activeCreatorId(recipients);
  if (!creatorId) {
    console.warn(`${LOG}[NO_ACTIVE_CREATOR]`, { kind, recipients: userIds(recipients), diagId: ctx?.snapshot?.diagId });
    return { status: "skipped", kind, creatorId: null, message: null };
  }

  const messageId = `attack-chat-${kind}-${ctx.snapshot.diagId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  options.chatData.flags.add2e.attackRouteId = messageId;
  options.chatData.flags.add2e.attackRouteCreatorId = creatorId;

  const payload = cloneForSocket({
    version: VERSION,
    messageId,
    creatorId,
    kind,
    options,
    detailsHtml: kind === "gm" ? gmDetailsHtml(ctx) : ""
  });
  if (!payload) throw new Error(`Impossible de sérialiser la carte d’attaque ${kind}.`);

  if (creatorId === String(game.user?.id ?? "")) {
    const message = await createRoutedCard(payload);
    return { status: "created", kind, creatorId, message };
  }

  if (!game?.socket?.emit) throw new Error("Le socket ADD2E est indisponible pour router la carte d’attaque.");
  game.socket.emit(SOCKET, { type: ROUTE_TYPE, payload });
  return { status: "queued", kind, creatorId, message: null };
}

function scheduleEffectsEngineAttackResolved(ctx) {
  setTimeout(() => {
    const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine;
    if (typeof engine?.handleMonkUnarmedAttackResolved !== "function") return;
    engine.handleMonkUnarmedAttackResolved(ctx).catch(error => console.error(`${LOG}[EFFECTS_ENGINE_ATTACK_RESOLVED]`, error));
  }, 0);
}

export async function add2eCreateAttackChatCards(ctx = {}) {
  requireCommonChatApi();
  if (!ctx?.snapshot || typeof ctx.snapshot !== "object") {
    throw new Error("La carte d’attaque exige un snapshot canonique de résolution.");
  }

  const playerOptions = playerCardOptions(ctx);
  const gmOptions = gmCardOptions(ctx);
  if (!String(globalThis.add2eBuildChatCard(playerOptions) ?? "").trim()) throw new Error("La carte joueur d’attaque ADD2E est vide.");
  if (!String(globalThis.add2eBuildChatCard(gmOptions) ?? "").trim()) throw new Error("La carte MJ d’attaque ADD2E est vide.");

  const [playerRoute, gmRoute] = await Promise.all([
    routeCard("player", playerOptions, ctx),
    routeCard("gm", gmOptions, ctx)
  ]);
  scheduleEffectsEngineAttackResolved(ctx);
  return { playerRoute, gmRoute };
}

installAttackChatSocket();

globalThis.add2eAttackChatDebug = function add2eAttackChatDebug() {
  return {
    version: VERSION,
    socketVersion: globalThis.__ADD2E_ATTACK_CHAT_SOCKET_VERSION ?? null,
    commonBuilder: typeof globalThis.add2eBuildChatCard === "function",
    commonCreator: typeof globalThis.add2eCreateChatCard === "function",
    user: game.user?.name,
    userId: game.user?.id,
    isGM: game.user?.isGM,
    activeGmCreatorId: activeCreatorId(gmUsers()),
    activePlayerCreatorId: activeCreatorId(playerUsers()),
    gmRecipients: userIds(gmUsers()),
    playerRecipients: userIds(playerUsers()),
    ready: game?.ready
  };
};