// scripts/add2e-attack/04i-attack-roll-chat-card.mjs
// ADD2E — Cartes de chat d'attaque construites par l'API commune.
// La carte narrative est publique ; la carte détaillée reste MJ uniquement.
// Compatible Foundry V13/V14/V15.

const VERSION = "2026-07-24-attack-chat-canonical-snapshot-v25";
const LOG = "[ADD2E][ATTACK_CHAT]";

globalThis.ADD2E_ATTACK_CHAT_VISIBILITY_VERSION = VERSION;

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

function gmIds() {
  const recipients = ChatMessage.getWhisperRecipients?.("GM") ?? [];
  const users = recipients.length ? recipients : Array.from(game.users ?? []).filter(user => user?.isGM);
  return users.map(user => user?.id).filter(Boolean);
}

function requireCommonChatApi() {
  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    throw new Error("Le constructeur commun des cartes ADD2E est indisponible.");
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

function publicCardOptions(ctx) {
  const snapshot = ctx.snapshot;
  const result = outcome(ctx);
  const rows = [
    { label: "Arme", value: ctx?.arme?.name ?? "Arme" },
    { label: "Jet", value: attackRollText(snapshot) },
    { label: "Portée", value: rangeText(snapshot) }
  ];
  if (result.hit && number(snapshot?.damage?.amount) > 0) rows.push({ label: "Dégâts", value: String(number(snapshot.damage.amount)) });
  if (snapshot?.assassination?.resolved) {
    rows.push({
      label: "Assassinat",
      value: `${snapshot.assassination.success ? "Réussi" : "Échoué"} · ${snapshot.assassination.roll} / ${snapshot.assassination.score}%`
    });
  }

  return {
    actor: ctx.actor,
    title: `Attaque — ${result.title}`,
    icon: result.icon,
    variant: result.variant,
    source: {
      name: ctx?.actor?.name ?? "Attaquant",
      img: ctx?.chatImg ?? ctx?.actor?.img,
      type: "Attaquant",
      meta: ctx?.arme?.name ?? ""
    },
    target: {
      name: ctx?.nomCible ?? ctx?.cible?.name ?? "Cible",
      img: ctx?.cible?.token?.texture?.src ?? ctx?.cible?.img,
      type: "Défenseur"
    },
    rows,
    message: roleplay(ctx),
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor: ctx.actor }),
      whisper: [],
      blind: false,
      flags: {
        add2e: {
          attackChatVisibility: "public",
          attackChatVisibilityVersion: VERSION,
          attackDiagId: snapshot.diagId,
          attackSnapshotVersion: snapshot.version,
          createdByAttackRoll: true
        }
      }
    }
  };
}

function gmCardOptions(ctx) {
  const snapshot = ctx.snapshot;
  const result = outcome(ctx);
  const threshold = snapshot?.threshold ?? {};
  const rows = [
    { label: "Diagnostic", value: snapshot.diagId },
    { label: "Arme", value: ctx?.arme?.name ?? "Arme" },
    { label: "Jet", value: attackRollText(snapshot) },
    { label: "Portée", value: rangeText(snapshot) },
    { label: "Position", value: positionSummary(snapshot) },
    { label: "THAC0 / CA", value: `${number(threshold.thac0)} - ${number(threshold.armorClass)} = ${number(threshold.base)}` },
    { label: "Modificateurs au toucher", value: modifierSummary(snapshot.attackResolution) },
    { label: "Bonus total", value: signed(snapshot?.roll?.bonus) },
    { label: "Seuil final au d20", value: thresholdText(snapshot) }
  ];

  const conditional = Array.isArray(snapshot?.conditionalDetails) ? snapshot.conditionalDetails.filter(Boolean) : [];
  if (conditional.length) rows.push({ label: "Défenses conditionnelles", value: conditional.join(" ; ") });
  if (result.hit) {
    rows.push({ label: "Modificateurs aux dégâts", value: modifierSummary(snapshot.damageResolution) });
    rows.push({ label: "Dégâts", value: `${snapshot?.damage?.formula ?? "—"} → ${snapshot?.damage?.details ?? snapshot?.damage?.amount ?? "—"}` });
  }
  if (ctx.useBackstab) rows.push({ label: "Attaque sournoise", value: `Dégâts ×${number(ctx.backstabMultiplier, 1)}` });
  if (snapshot?.assassination?.resolved) {
    rows.push({
      label: "Assassinat",
      value: `${snapshot.assassination.success ? "Réussi" : "Échoué"} · ${snapshot.assassination.roll} / ${snapshot.assassination.score}%`
    });
  }

  const deepClone = globalThis.foundry?.utils?.deepClone;
  return {
    actor: ctx.actor,
    title: `Détails d’attaque — ${result.title}`,
    icon: "fas fa-list-check",
    variant: result.variant,
    source: {
      name: ctx?.actor?.name ?? "Attaquant",
      img: ctx?.chatImg ?? ctx?.actor?.img,
      type: "Attaquant",
      meta: ctx?.arme?.name ?? ""
    },
    target: {
      name: ctx?.nomCible ?? ctx?.cible?.name ?? "Cible",
      img: ctx?.cible?.token?.texture?.src ?? ctx?.cible?.img,
      type: "Défenseur"
    },
    rows,
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor: ctx.actor }),
      whisper: gmIds(),
      blind: false,
      flags: {
        add2e: {
          attackChatVisibility: "gm-only",
          attackChatVisibilityVersion: VERSION,
          attackDiagId: snapshot.diagId,
          attackSnapshotVersion: snapshot.version,
          attackSnapshot: typeof deepClone === "function" ? deepClone(snapshot) : snapshot,
          createdByAttackRoll: true
        }
      }
    }
  };
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

  const publicOptions = publicCardOptions(ctx);
  const gmOptions = gmCardOptions(ctx);
  if (!String(globalThis.add2eBuildChatCard(publicOptions) ?? "").trim()) throw new Error("La carte publique d’attaque ADD2E est vide.");
  if (!String(globalThis.add2eBuildChatCard(gmOptions) ?? "").trim()) throw new Error("La carte MJ d’attaque ADD2E est vide.");

  const publicMessage = await globalThis.add2eCreateChatCard(publicOptions);
  const gmMessage = await globalThis.add2eCreateChatCard(gmOptions);
  scheduleEffectsEngineAttackResolved(ctx);
  return { publicMessage, gmMessage };
}

globalThis.add2eAttackChatDebug = function add2eAttackChatDebug() {
  return {
    version: VERSION,
    commonBuilder: typeof globalThis.add2eBuildChatCard === "function",
    commonCreator: typeof globalThis.add2eCreateChatCard === "function",
    user: game.user?.name,
    userId: game.user?.id,
    isGM: game.user?.isGM,
    ready: game?.ready
  };
};
