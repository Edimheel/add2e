// ADD2E — Mouvement et XP monoclasse
// Les Items classe sont la seule source de progression multiclasses.
// Compatible Foundry V13/V14/V15.

const VERSION = "2026-06-26-movement-v14-native-hooks-v2";
const TAG = "[ADD2E][MOVE_XP]";
const INTERNAL = "add2eMoveXpInternal";
const ITEM_RECALC_DELAY_MS = 140;
const MOVE_ALERT_DEDUP_MS = 900;
const itemRecalcTimers = new Map();
const movementAlertCache = new Map();
const nativeMovementCache = new Map();

globalThis.ADD2E_MOVE_XP_VERSION = VERSION;

function log(label, data = {}) { console.log(`${TAG}${label}`, data); }

function num(value, fallback = 0) {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value && typeof value === "object") {
    for (const key of ["value", "valeur", "total", "current", "actuel", "base", "max", "vitesse", "movement"]) {
      if (value[key] !== undefined && value[key] !== null && typeof value[key] !== "object") return num(value[key], fallback);
    }
    return fallback;
  }
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;
  const parsed = Number(raw.replace(/\s+/g, "").replace(/\./g, "").replace(/,/g, ".").replace(/[^0-9.+\-]/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function norm(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function firstPositive(...values) {
  for (const value of values) {
    const out = num(value, NaN);
    if (Number.isFinite(out) && out > 0) return out;
  }
  return 0;
}

function sameValue(left, right) {
  if (left === right) return true;
  const leftNumber = num(left, NaN);
  const rightNumber = num(right, NaN);
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) return leftNumber === rightNumber;
  if (foundry?.utils?.deepEqual) return foundry.utils.deepEqual(left, right);
  return JSON.stringify(left) === JSON.stringify(right);
}

function getPath(document, path) {
  return foundry?.utils?.getProperty ? foundry.utils.getProperty(document, path) : undefined;
}

function changedUpdatePayload(actor, updates = {}) {
  return Object.fromEntries(Object.entries(updates).filter(([path, value]) => !sameValue(getPath(actor, path), value)));
}

function classItems(actor) {
  return Array.from(actor?.items ?? []).filter(item => String(item?.type ?? "").toLowerCase() === "classe");
}

function classItem(actor) {
  const classes = classItems(actor);
  return classes.length === 1 ? classes[0] : null;
}

function raceItem(actor) {
  return Array.from(actor?.items ?? []).find(item => String(item?.type ?? "").toLowerCase() === "race") ?? null;
}

function isMulticlassActor(actor) {
  return actor?.type === "personnage" && classItems(actor).length > 1;
}

function parseXpRange(raw) {
  const text = String(raw ?? "").trim();
  const values = text.match(/[0-9][0-9.\s]*/g)?.map(value => num(value, NaN)).filter(Number.isFinite) ?? [];
  return { min: values[0] ?? 0, max: values[1] ?? null, raw: text };
}

function xpRows(actor) {
  const cls = classItem(actor)?.system ?? actor?.system?.details_classe ?? {};
  const progression = Array.isArray(cls.progression) ? cls.progression : [];
  return progression
    .map((row, index) => {
      const range = parseXpRange(row?.xp ?? row?.experience ?? row?.xpRange ?? row?.niveau_xp ?? "");
      return { ...row, niveau: num(row?.niveau ?? row?.level ?? index + 1, index + 1), xpMin: range.min, xpMax: range.max, xpLabel: range.raw };
    })
    .filter(row => row.niveau > 0)
    .sort((left, right) => left.niveau - right.niveau);
}

function minXpForLevel(actor, level = null) {
  if (isMulticlassActor(actor)) return 0;
  const value = Math.max(1, num(level ?? actor?.system?.niveau, 1));
  const row = xpRows(actor).find(entry => Number(entry.niveau) === value);
  return Math.max(0, Number(row?.xpMin ?? 0) || 0);
}

function levelForXp(actor, xpValue) {
  if (isMulticlassActor(actor)) return null;
  const xp = Math.max(0, Math.floor(num(xpValue, 0)));
  const rows = xpRows(actor);
  if (!rows.length) return Math.max(1, num(actor?.system?.niveau, 1));
  let current = rows[0];
  for (const row of rows) if (xp >= row.xpMin) current = row;
  return Number(current.niveau) || 1;
}

function xpMeta(actor, levelValue, xpValue) {
  const level = Math.max(1, num(levelValue, 1));
  const xp = Math.max(0, Math.floor(num(xpValue, 0)));
  const rows = xpRows(actor);
  const currentMin = minXpForLevel(actor, level);
  const next = rows.find(row => Number(row.niveau) > level) ?? null;
  const nextXp = next ? Number(next.xpMin) || 0 : 0;
  const span = nextXp > currentMin ? nextXp - currentMin : 1;
  return {
    xp,
    level,
    requiredMin: currentMin,
    suggestedLevel: levelForXp(actor, xp),
    nextLevel: next?.niveau ?? null,
    nextXp,
    xpToNext: next ? Math.max(0, nextXp - xp) : 0,
    percent: next ? Math.max(0, Math.min(100, Math.floor(((xp - currentMin) / span) * 100))) : 100,
    progressionLabel: next ? `${xp.toLocaleString()} / ${nextXp.toLocaleString()} XP` : `${xp.toLocaleString()} XP — niveau maximum de la table`,
    hasProgression: rows.length > 0
  };
}

function computeXp(actor) {
  if (isMulticlassActor(actor)) {
    return {
      xp: null,
      level: null,
      requiredMin: null,
      suggestedLevel: null,
      nextLevel: null,
      nextXp: null,
      xpToNext: null,
      percent: null,
      progressionLabel: "Progression gérée par les Items classe",
      hasProgression: false,
      multiclass: true
    };
  }
  const level = Math.max(1, num(actor?.system?.niveau, 1));
  const xp = Math.max(0, Math.floor(num(actor?.system?.xp, 0)));
  return xpMeta(actor, level, xp);
}

function movementFromRaceName(actor) {
  const label = norm(raceItem(actor)?.name ?? actor?.system?.race ?? "");
  if (label.includes("nain") || label.includes("gnome") || label.includes("petite_gens") || label.includes("halfelin") || label.includes("halfeling") || label.includes("halfling")) return 6;
  return 12;
}

function currentProgressionRow(actor) {
  const item = classItem(actor);
  if (!item) return null;
  const level = Math.max(1, num(item.system?.niveau ?? item.system?.level, 1));
  const progression = Array.isArray(item.system?.progression) ? item.system.progression : [];
  return progression.find(row => Number(row?.niveau ?? row?.level) === level) ?? progression[level - 1] ?? null;
}

function baseMove(actor) {
  const item = classItem(actor);
  const row = currentProgressionRow(actor) ?? {};
  const cls = item?.system ?? {};
  const race = raceItem(actor)?.system ?? {};
  const sys = actor?.system ?? {};
  const storedMovement = sys.mouvement && typeof sys.mouvement === "object" ? sys.mouvement : {};

  const classMove = firstPositive(
    row.mouvement, row.movement, row.vitesse, row.vitesse_deplacement, row.deplacement, row["déplacement"], row.monkMove, row.monkMovement,
    cls.mouvement, cls.movement, cls.vitesse, cls.vitesse_deplacement, cls.deplacement, cls["déplacement"], cls.baseMovement
  );
  if (classMove > 0) return classMove;

  const raceMove = firstPositive(race.mouvement, race.movement, race.vitesse, race.vitesse_deplacement, race.deplacement, race["déplacement"], race.baseMovement);
  if (raceMove > 0) return raceMove;

  const storedBase = firstPositive(storedMovement.base, storedMovement.vitesseBase, sys.vitesse_base, sys.vitesseBase, sys.vitesse_deplacement_base);
  if (storedBase > 0) return storedBase;

  return movementFromRaceName(actor);
}

function strengthWeightAdjustment(actor) {
  const direct = num(actor?.system?.force_poids, NaN);
  if (Number.isFinite(direct)) return direct;
  const force = num(actor?.system?.force, 10);
  const exceptional = num(actor?.system?.force_ex ?? actor?.system?.force_exceptionnelle, NaN);
  if (force < 4) return -350;
  if (force <= 5) return -250;
  if (force <= 7) return -150;
  if (force <= 11) return 0;
  if (force <= 13) return 100;
  if (force <= 15) return 200;
  if (force === 16) return 350;
  if (force === 17) return 500;
  if (force === 18) {
    if (!Number.isFinite(exceptional)) return 750;
    if (exceptional <= 50) return 1000;
    if (exceptional <= 75) return 1250;
    if (exceptional <= 90) return 1500;
    if (exceptional <= 99) return 2000;
  }
  return 3000;
}

function itemWeight(item) {
  const type = String(item?.type ?? "").toLowerCase();
  if (["classe", "race", "sort", "spell"].includes(type)) return 0;
  const system = item?.system ?? {};
  const quantity = Math.max(1, num(system.quantite ?? system.quantity ?? 1, 1));
  const weight = num(system.poids ?? system.weight ?? system.encombrement ?? system.encumbrance ?? 0, 0);
  return Math.max(0, quantity * weight);
}

function carriedWeight(actor) {
  return (actor?.items?.contents ?? Array.from(actor?.items ?? [])).reduce((total, item) => total + itemWeight(item), 0);
}

function computeMovement(actor) {
  const base = baseMove(actor);
  const weight = carriedWeight(actor);
  const forceAdjustment = strengthWeightAdjustment(actor);
  const normalLimit = Math.max(50, 500 + forceAdjustment);
  const heavyLimit = Math.max(normalLimit + 1, 1000 + forceAdjustment);
  const severeLimit = Math.max(heavyLimit + 1, 1500 + forceAdjustment);

  let label = "Équipement normal";
  let category = "normal";
  let multiplier = 1;
  if (weight > severeLimit) { label = "Surcharge"; category = "surcharge"; multiplier = 0; }
  else if (weight > heavyLimit) { label = "Très encombré"; category = "tres_encombre"; multiplier = 0.25; }
  else if (weight > normalLimit) { label = "Encombré"; category = "encombre"; multiplier = 0.5; }

  const actuel = Math.max(0, Math.floor(base * multiplier));
  return {
    base,
    actuel,
    vitesse: actuel,
    poids: Math.round(weight * 100) / 100,
    poidsKg: Math.round((weight / 20) * 100) / 100,
    forcePoids: forceAdjustment,
    limiteNormale: normalLimit,
    limiteLourde: heavyLimit,
    limiteSurcharge: severeLimit,
    categorie: category,
    label,
    multiplier,
    metresTour: actuel,
    donjonRoundMetres: actuel,
    segmentMetres: Math.round(actuel / 10 * 100) / 100,
    exterieurDemiJourKm: Math.round(actuel * 1.6 * 100) / 100
  };
}

function movementUpdates(actor) {
  const movement = computeMovement(actor);
  return {
    updates: {
      "system.mouvement": movement,
      "system.movement": movement.actuel,
      "system.vitesse_deplacement": movement.actuel
    },
    movement
  };
}

function flatActorUpdates(actor, { mode = "auto", incoming = {} } = {}) {
  const movementOnly = movementUpdates(actor);
  if (mode === "movement" || isMulticlassActor(actor)) {
    return { updates: movementOnly.updates, xp: computeXp(actor), movement: movementOnly.movement, multiclass: isMulticlassActor(actor) };
  }

  const incomingLevel = incoming["system.niveau"] !== undefined
    ? Math.max(1, num(incoming["system.niveau"], 1))
    : Math.max(1, num(actor?.system?.niveau, 1));
  const incomingXp = incoming["system.xp"] !== undefined
    ? Math.max(0, Math.floor(num(incoming["system.xp"], 0)))
    : Math.max(0, Math.floor(num(actor?.system?.xp, 0)));

  let level = incomingLevel;
  let xp = incomingXp;
  if (mode === "level") xp = minXpForLevel(actor, level);
  else if (mode === "xp") {
    xp = Math.max(xp, minXpForLevel(actor, level));
    const suggested = levelForXp(actor, xp);
    if (game.settings.get("add2e", "xpAutoLevel") && suggested > level) level = suggested;
  } else {
    xp = Math.max(xp, minXpForLevel(actor, level));
  }

  const meta = xpMeta(actor, level, xp);
  const currentTitle = xpRows(actor).find(row => Number(row.niveau) === level)?.title ?? actor?.system?.titre ?? "";
  const updates = {
    "system.xp": xp,
    "system.niveau": level,
    "system.progression_xp": meta.progressionLabel,
    "system.xp_next": meta.nextXp,
    "system.xp_to_next": meta.xpToNext,
    "system.xp_percent": meta.percent,
    "system.niveau_suggere": meta.suggestedLevel,
    ...movementOnly.updates
  };
  if (currentTitle) updates["system.titre"] = currentTitle;
  return { updates, xp: meta, movement: movementOnly.movement, multiclass: false };
}

async function recalc(actor, { mode = "auto", notify = false } = {}) {
  if (!actor || actor.type !== "personnage") return null;
  const result = flatActorUpdates(actor, { mode });
  const updates = changedUpdatePayload(actor, result.updates);
  result.updates = updates;
  result.skipped = Object.keys(updates).length === 0;
  if (!result.skipped) await actor.update(updates, { [INTERNAL]: true, add2eReason: `move-xp-recalc:${mode}`, render: false });
  if (notify && mode === "level" && !result.multiclass) ui.notifications.info(`${actor.name} : XP ajustée au niveau ${result.xp.level} (${result.xp.xp.toLocaleString()} XP).`);
  return result;
}

async function awardXp(actor, amount, { reason = "Gain d'expérience", percentBonus = 0 } = {}) {
  if (!actor || actor.type !== "personnage") return null;
  const base = Math.max(0, Math.floor(num(amount, 0)));
  const bonus = Math.max(0, Math.floor(base * (num(percentBonus, 0) / 100)));
  const total = base + bonus;

  if (isMulticlassActor(actor)) {
    const applyCanonical = globalThis.add2eSessionXpApplyToActor;
    if (typeof applyCanonical !== "function") {
      ui.notifications.error("Le moteur d’XP canonique des Items classe n’est pas chargé.");
      return null;
    }
    const result = await applyCanonical(actor, total, reason);
    const details = result?.classes?.map(entry => `${entry.item?.name ?? "Classe"} ${entry.before ?? 0} → ${entry.after ?? 0}`).join(" ; ") ?? "";
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="add2e-xp-chat" style="border:1px solid #b88924;border-radius:10px;background:#fff8df;padding:.65em .8em;"><h3>Expérience — ${actor.name}</h3><div>${reason ? `<b>${reason}</b><br>` : ""}+${total.toLocaleString()} XP${bonus ? ` dont bonus ${bonus.toLocaleString()} XP` : ""}</div><div>${details}</div><div>Progression multiclasses mise à jour sur les Items classe.</div></div>`
    });
    return { total, bonus, ...result };
  }

  const before = Math.max(0, Math.floor(num(actor.system?.xp, 0)));
  const after = before + total;
  const result = flatActorUpdates(actor, { mode: "xp", incoming: { "system.xp": after } });
  const updates = changedUpdatePayload(actor, result.updates);
  if (Object.keys(updates).length) await actor.update(updates, { add2eReason: "move-xp-award" });
  const displayedXp = Number(updates["system.xp"] ?? result.xp.xp ?? after) || after;
  const displayedLevel = String(updates["system.niveau"] ?? result.xp.level ?? actor.system?.niveau ?? "-");
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="add2e-xp-chat" style="border:1px solid #b88924;border-radius:10px;background:#fff8df;padding:.65em .8em;"><h3>Expérience — ${actor.name}</h3><div>${reason ? `<b>${reason}</b><br>` : ""}+${total.toLocaleString()} XP${bonus ? ` dont bonus ${bonus.toLocaleString()} XP` : ""}</div><div>${before.toLocaleString()} → <b>${displayedXp.toLocaleString()}</b> XP</div><div>Niveau actuel : <b>${displayedLevel}</b></div></div>`
  });
  return { before, after: displayedXp, total, bonus, ...result };
}

async function promptXp(actor) {
  if (!actor || actor.type !== "personnage") return;
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  const content = `<form><div class="form-group"><label>XP à ajouter</label><input type="number" name="amount" value="0" step="1"></div><div class="form-group"><label>Bonus %</label><input type="number" name="percentBonus" value="0" step="1"></div><div class="form-group"><label>Motif</label><input type="text" name="reason" value="Récompense d'aventure"></div></form>`;
  if (!DialogV2?.wait) { ui.notifications.warn("DialogV2 indisponible : attribution d'XP annulée."); return; }
  const result = await DialogV2.wait({
    window: { title: `Attribuer de l'XP — ${actor.name}` },
    content,
    buttons: [
      { action: "add", label: "Ajouter", default: true, callback: (_event, _button, dialog) => {
        const form = dialog?.element?.querySelector?.("form") ?? document.querySelector("form");
        return { action: "add", amount: form?.amount?.value ?? 0, percentBonus: form?.percentBonus?.value ?? 0, reason: form?.reason?.value ?? "Récompense d'aventure" };
      } },
      { action: "cancel", label: "Annuler", callback: () => ({ action: "cancel" }) }
    ],
    modal: true,
    rejectClose: false,
    close: () => ({ action: "cancel" })
  });
  if (result?.action === "add") await awardXp(actor, result.amount, { reason: result.reason, percentBonus: result.percentBonus });
}

function unitToMeters(distance, unit) {
  const value = String(unit ?? "").toLowerCase();
  if (["ft", "feet", "foot", "pied", "pieds", "pi"].includes(value)) return distance * 0.3048;
  if (["km", "kilometre", "kilomètre", "kilometres", "kilomètres"].includes(value)) return distance * 1000;
  return distance;
}

function tokenDistanceMeters(tokenDoc, changes, from = null) {
  const scene = tokenDoc.parent ?? canvas?.scene;
  const size = Number(scene?.grid?.size ?? canvas?.grid?.size ?? 100) || 100;
  const distance = Number(scene?.grid?.distance ?? canvas?.scene?.grid?.distance ?? 1) || 1;
  const unit = scene?.grid?.units ?? canvas?.scene?.grid?.units ?? "m";
  const ox = Number(from?.x ?? tokenDoc.x ?? 0) + Number(tokenDoc.width ?? 1) * size / 2;
  const oy = Number(from?.y ?? tokenDoc.y ?? 0) + Number(tokenDoc.height ?? 1) * size / 2;
  const nx = Number(changes.x ?? tokenDoc.x ?? 0) + Number(tokenDoc.width ?? 1) * size / 2;
  const ny = Number(changes.y ?? tokenDoc.y ?? 0) + Number(tokenDoc.height ?? 1) * size / 2;
  return unitToMeters((Math.hypot(nx - ox, ny - oy) / size) * distance, unit);
}

function foundryGeneration() {
  const generation = Number(game?.release?.generation ?? String(game?.version ?? "").split(".")[0]);
  return Number.isFinite(generation) ? generation : 0;
}

function usesNativeTokenMovementHooks() {
  return foundryGeneration() >= 14;
}

function isPoint(value) {
  return Number.isFinite(Number(value?.x)) && Number.isFinite(Number(value?.y));
}

function nativeMovementTarget(tokenDoc, movement = {}) {
  if (isPoint(movement?.destination)) return { x: Number(movement.destination.x), y: Number(movement.destination.y) };
  const pending = movement?.pending?.waypoints ?? [];
  const last = pending[pending.length - 1];
  if (isPoint(last)) return { x: Number(last.x), y: Number(last.y) };
  return { x: Number(tokenDoc?.x ?? 0), y: Number(tokenDoc?.y ?? 0) };
}

function nativeMovementOrigin(tokenDoc, movement = {}) {
  if (isPoint(movement?.origin)) return { x: Number(movement.origin.x), y: Number(movement.origin.y) };
  return movementOrigin(tokenDoc);
}

function nativeMovementMeters(tokenDoc, movement = {}, phase = "pre") {
  const sections = phase === "pre"
    ? [movement?.pending, movement?.passed]
    : [movement?.passed, movement?.pending];
  const unit = tokenDoc?.parent?.grid?.units ?? canvas?.scene?.grid?.units ?? "m";

  for (const section of sections) {
    const distance = Number(section?.distance);
    if (Number.isFinite(distance) && distance > 0) return Math.round(unitToMeters(distance, unit) * 100) / 100;
  }
  return null;
}

function nativeMovementCacheKey(tokenDoc, movement = {}) {
  return `${tokenDoc?.uuid ?? tokenDoc?.id ?? "token"}:${movement?.id ?? "movement"}`;
}

function combatTurnKey() {
  const combat = game.combat;
  return combat ? `${combat.id}:${combat.round ?? 0}:${combat.turn ?? 0}` : null;
}

function spentThisTurn(actor) {
  const key = combatTurnKey();
  return key && actor.getFlag("add2e", "movementTurnKey") === key ? Number(actor.getFlag("add2e", "movementSpentMeters")) || 0 : 0;
}

function movementOrigin(tokenDoc) {
  return tokenDoc.getFlag("add2e", "lastAllowedPosition") ?? { x: tokenDoc.x, y: tokenDoc.y };
}

function movementScaleStatus(distance, max) {
  if (max <= 0) return { key: "red", label: "rouge", color: 0xd91e18, blocked: true };
  if (distance <= max + 0.01) return { key: "green", label: "vert", color: 0x2ecc71, blocked: false };
  if (distance <= (max * 2) + 0.01) return { key: "orange", label: "orange", color: 0xf39c12, blocked: true };
  return { key: "red", label: "rouge", color: 0xd91e18, blocked: true };
}

function drawMovementScale(tokenDoc, status, distance, max) {
  const token = canvas?.tokens?.get?.(tokenDoc.id);
  const Graphics = globalThis.PIXI?.Graphics;
  if (!token || !Graphics) return;

  try {
    if (!token._add2eMovementScaleRing) {
      token._add2eMovementScaleRing = new Graphics();
      token.addChild(token._add2eMovementScaleRing);
    }

    const graphics = token._add2eMovementScaleRing;
    const width = Number(token.w ?? token.width ?? canvas.grid.size) || canvas.grid.size;
    const height = Number(token.h ?? token.height ?? canvas.grid.size) || canvas.grid.size;
    graphics.clear?.();

    if (typeof graphics.roundRect === "function" && typeof graphics.stroke === "function") {
      graphics.roundRect(-3, -3, width + 6, height + 6, 10);
      graphics.stroke({ width: 5, color: status.color, alpha: 0.95 });
    } else {
      graphics.lineStyle(5, status.color, 0.95);
      graphics.drawRoundedRect(-3, -3, width + 6, height + 6, 10);
    }

    graphics.zIndex = 9999;
    token.sortChildren?.();
    token._add2eMovementScale = { status: status.key, distance, max };
  } catch (error) {
    console.warn(`${TAG}[TOKEN][SCALE_DRAW_ERROR]`, error);
  }
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[character]));
}

function notifyGmsMovementExceeded(tokenDoc, result, { userId = null } = {}) {
  if (!result || result.next <= result.max + 0.01) return;

  const sceneId = tokenDoc?.parent?.id ?? canvas?.scene?.id ?? "scene";
  const turnKey = combatTurnKey() ?? "hors-combat";
  const dedupKey = `${sceneId}:${tokenDoc?.id ?? "token"}:${turnKey}:${result.status.key}:${Math.round(result.next * 10)}`;
  const now = Date.now();
  const previous = movementAlertCache.get(dedupKey) ?? 0;
  if ((now - previous) < MOVE_ALERT_DEDUP_MS) return;
  movementAlertCache.set(dedupKey, now);

  const movedBy = game.users?.get?.(userId ?? game.user?.id)?.name ?? game.user?.name ?? "Utilisateur";
  const warningColor = result.status.key === "red" ? "#9d1f1c" : "#9a5b05";
  const borderColor = result.status.key === "red" ? "#b3302d" : "#c78318";
  const background = result.status.key === "red" ? "#fff0ef" : "#fff7e8";
  const content = `<div class="add2e-movement-alert" style="border:1px solid ${borderColor};border-radius:8px;background:${background};padding:.55em .7em;"><strong>Déplacement dépassé — ${escapeHtml(result.actor.name)}</strong><div>${escapeHtml(movedBy)} : <b>${result.next.toFixed(1)} m</b> / ${result.max.toFixed(1)} m <span style="color:${warningColor};">(${result.status.label})</span></div></div>`;
  const recipients = ChatMessage.getWhisperRecipients?.("GM")?.map(user => user.id).filter(Boolean) ?? [];

  if (recipients.length) {
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: result.actor }),
      whisper: recipients,
      content,
      flags: { add2e: { movementAlert: true, tokenId: tokenDoc?.id ?? null, status: result.status.key, distance: result.next, max: result.max } }
    }).catch(error => console.warn(`${TAG}[TOKEN][GM_ALERT_ERROR]`, error));
  }

  if (game.user.isGM) ui.notifications.warn(`${result.actor.name} dépasse son mouvement (${result.status.label}) : ${result.next.toFixed(1)} m / ${result.max.toFixed(1)} m.`);
}

function rememberAllowedMovement(tokenDoc, changes, result) {
  if (!result) return;
  if (game.combat) {
    result.actor.setFlag("add2e", "movementTurnKey", combatTurnKey()).catch(error => console.warn(`${TAG}[TOKEN][TURN_FLAG_ERROR]`, error));
    result.actor.setFlag("add2e", "movementSpentMeters", result.next).catch(error => console.warn(`${TAG}[TOKEN][SPENT_FLAG_ERROR]`, error));
  } else {
    tokenDoc.setFlag("add2e", "lastAllowedPosition", { x: changes.x ?? tokenDoc.x, y: changes.y ?? tokenDoc.y }).catch(error => console.warn(`${TAG}[TOKEN][ORIGIN_FLAG_ERROR]`, error));
  }
}

function computeTokenMovementScale(tokenDoc, changes = {}, { movement = null, phase = "legacy", from = null } = {}) {
  const actor = tokenDoc.actor;
  if (!actor || actor.type !== "personnage") return null;

  const details = computeMovement(actor);
  const max = Number(details.actuel ?? actor.system?.movement ?? actor.system?.vitesse_deplacement ?? 0) || 0;
  const origin = from ?? (movement ? nativeMovementOrigin(tokenDoc, movement) : (game.combat ? { x: tokenDoc.x, y: tokenDoc.y } : movementOrigin(tokenDoc)));
  const nativeDistance = movement ? nativeMovementMeters(tokenDoc, movement, phase) : null;
  const delta = nativeDistance ?? tokenDistanceMeters(tokenDoc, changes, origin);
  const spent = game.combat ? spentThisTurn(actor) : 0;
  const next = Math.round((spent + delta) * 100) / 100;
  const status = movementScaleStatus(next, max);

  return { actor, movement: details, max, origin, delta, spent, next, status };
}

function validateTokenMovement(tokenDoc, changes, options = {}, movement = null) {
  if (options?.add2eIgnoreMovement || !game.settings.get("add2e", "enforceTokenMovement")) return { allowed: true, result: null };
  if (!changes || (changes.x === undefined && changes.y === undefined)) return { allowed: true, result: null };
  const actor = tokenDoc.actor;
  if (!actor || actor.type !== "personnage") return { allowed: true, result: null };

  const result = computeTokenMovementScale(tokenDoc, changes, { movement, phase: movement ? "pre" : "legacy" });
  if (!result) return { allowed: true, result: null };

  if (result.next > result.max + 0.01) notifyGmsMovementExceeded(tokenDoc, result, { userId: options?.userId ?? game.user?.id ?? null });
  if (game.user.isGM || !result.status.blocked) return { allowed: true, result };

  ui.notifications.warn(`${actor.name} dépasse son mouvement (${result.status.label}) : ${result.next.toFixed(1)} m / ${result.max.toFixed(1)} m.`);
  return { allowed: false, result };
}

function itemCanAffectMovement(item, hookName, options = {}) {
  const actor = item?.parent;
  if (!actor || actor.documentName !== "Actor" || actor.type !== "personnage") return false;
  const type = String(item.type ?? "").toLowerCase();
  if (["sort", "spell"].includes(type)) return false;
  if (options?.add2eSpellSync || options?.add2eDropPurge || options?.add2eCompendiumTruth) return false;
  if (["classe", "race"].includes(type)) return !options?.add2eInternal || hookName === "createItem" || hookName === "updateItem";
  return !options?.add2eInternal;
}

function queueItemMovementRecalc(item, hookName, options = {}) {
  if (!itemCanAffectMovement(item, hookName, options)) return;
  const actor = item.parent;
  const key = String(actor.uuid ?? actor.id);
  const existing = itemRecalcTimers.get(key);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    itemRecalcTimers.delete(key);
    recalc(actor, { mode: "movement" }).catch(error => console.warn(`${TAG}[ITEM_RECALC]`, { actor: actor.name, error }));
  }, ITEM_RECALC_DELAY_MS);
  itemRecalcTimers.set(key, timer);
}

function changeValue(changes, path) {
  return foundry.utils.hasProperty(changes, path) ? foundry.utils.getProperty(changes, path) : undefined;
}

function changedPath(actor, changes, path) {
  return foundry.utils.hasProperty(changes, path) && !sameValue(changeValue(changes, path), getPath(actor, path));
}

function drawResultAfterAnimation(tokenDoc, result, movement = null) {
  const draw = () => drawMovementScale(tokenDoc, result.status, result.next, result.max);
  const ended = movement?.animation?.ended;
  if (ended && typeof ended.then === "function") ended.then(draw).catch(draw);
  else draw();
}

Hooks.once("init", () => {
  game.settings.register("add2e", "xpAutoLevel", { name: "ADD2E — XP : niveau automatique", hint: "Quand l'XP atteint un seuil, le niveau est augmenté automatiquement.", scope: "world", config: true, type: Boolean, default: true });
  game.settings.register("add2e", "enforceTokenMovement", { name: "ADD2E — Contrôler le déplacement des tokens", hint: "Bloque les joueurs qui dépassent leur mouvement. Le MJ peut se déplacer librement, reçoit un avertissement et voit l'échelle vert / orange / rouge.", scope: "world", config: true, type: Boolean, default: true });
});

Hooks.once("ready", async () => {
  log("[READY]", { version: VERSION, generation: foundryGeneration() });
  if (game.user.isGM) {
    for (const actor of game.actors?.filter(actor => actor.type === "personnage") ?? []) {
      await recalc(actor, { mode: "movement" }).catch(error => console.warn(`${TAG}[READY][SKIP]`, actor?.name, error));
    }
  }
  for (const token of canvas?.tokens?.placeables ?? []) {
    if (token.actor?.type === "personnage") token.document.setFlag("add2e", "lastAllowedPosition", { x: token.document.x, y: token.document.y });
  }
});

Hooks.on("preUpdateActor", (actor, changes, options) => {
  if (options?.[INTERNAL] || options?.add2eInternal || !actor || actor.type !== "personnage") return true;
  const levelChanged = changedPath(actor, changes, "system.niveau");
  const xpChanged = changedPath(actor, changes, "system.xp");
  const movementChanged = [
    "system.force",
    "system.force_poids",
    "system.force_ex",
    "system.force_exceptionnelle",
    "system.mouvement.base",
    "system.vitesse_deplacement"
  ].some(path => changedPath(actor, changes, path));
  if (!levelChanged && !xpChanged && !movementChanged) return true;

  // Les changements de progression multiclasses sont filtrés et traités par 17b.
  // Ce module ne les transforme jamais en carte ou résumé historique.
  if (isMulticlassActor(actor) && (levelChanged || xpChanged)) {
    if (movementChanged) {
      const derived = changedUpdatePayload(actor, movementUpdates(actor).updates);
      if (Object.keys(derived).length) foundry.utils.mergeObject(changes, foundry.utils.expandObject(derived), { inplace: true });
    }
    return true;
  }

  const incoming = {};
  if (levelChanged) incoming["system.niveau"] = changeValue(changes, "system.niveau");
  if (xpChanged) incoming["system.xp"] = changeValue(changes, "system.xp");
  const mode = levelChanged && !xpChanged ? "level" : xpChanged ? "xp" : "movement";
  const result = flatActorUpdates(actor, { mode, incoming });
  const derived = changedUpdatePayload(actor, result.updates);
  if (Object.keys(derived).length) foundry.utils.mergeObject(changes, foundry.utils.expandObject(derived), { inplace: true });
  options.add2eReason = `move-xp-preupdate:${mode}`;
  log("[ACTOR][PREUPDATE]", { actor: actor.name, mode, multiclass: result.multiclass === true, updates: derived });
  return true;
});

Hooks.on("renderActorSheet", (sheet, html) => {
  if (sheet?.actor?.type !== "personnage" || isMulticlassActor(sheet.actor)) return;
  const root = html?.jquery ? html[0] : html;
  const levelField = [...root?.querySelectorAll?.(".a2e-field") ?? []].find(field => norm(field.querySelector?.("label")?.textContent ?? "") === "niveau");
  if (!root || root.querySelector("input[name='system.xp']") || !levelField) return;
  const field = document.createElement("div");
  field.className = "a2e-field a2e-xp-field";
  field.innerHTML = `<label>XP</label><div class="a2e-xp-inline" style="display:grid;grid-template-columns:minmax(0,1fr)31px;gap:5px;align-items:center;"><input type="number" name="system.xp" value="${Number(sheet.actor.system?.xp ?? 0)}" min="0" step="1" title="${String(sheet.actor.system?.progression_xp ?? "").replace(/"/g, "&quot;")}"><button type="button" class="a2e-icon-btn" data-add2e-mx="xp" title="Ajouter de l'XP" style="height:29px;min-width:31px;padding:0;">+</button></div>`;
  levelField.insertAdjacentElement("afterend", field);
  field.querySelector("[data-add2e-mx='xp']")?.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    promptXp(sheet.actor);
  });
});

Hooks.on("renderAdd2eActorSheet", (sheet, html) => {
  if (sheet?.actor?.type !== "personnage" || isMulticlassActor(sheet.actor)) return;
  const root = html?.jquery ? html[0] : html;
  root?.querySelector?.("[data-add2e-mx='xp']")?.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    promptXp(sheet.actor);
  }, { once: true });
});

Hooks.on("preMoveToken", (tokenDoc, movement, operation = {}) => {
  if (!usesNativeTokenMovementHooks()) return true;
  if (!tokenDoc?.actor || tokenDoc.actor.type !== "personnage") return true;

  const target = nativeMovementTarget(tokenDoc, movement);
  const checked = validateTokenMovement(tokenDoc, target, { ...operation, add2eNativeMovement: true, userId: game.user?.id ?? null }, movement);
  if (!checked.allowed) return false;

  nativeMovementCache.set(nativeMovementCacheKey(tokenDoc, movement), { result: checked.result, target });
  return true;
});

Hooks.on("moveToken", (tokenDoc, movement, _operation = {}, user = null) => {
  if (!usesNativeTokenMovementHooks()) return;
  if (!tokenDoc?.actor || tokenDoc.actor.type !== "personnage") return;

  const key = nativeMovementCacheKey(tokenDoc, movement);
  const cached = nativeMovementCache.get(key) ?? null;
  nativeMovementCache.delete(key);
  const target = nativeMovementTarget(tokenDoc, movement);
  const result = cached?.result ?? computeTokenMovementScale(tokenDoc, target, { movement, phase: "post" });
  if (!result) return;

  drawResultAfterAnimation(tokenDoc, result, movement);
  if (!user?.id || game.user?.id === user.id) rememberAllowedMovement(tokenDoc, target, result);
});

Hooks.on("preUpdateToken", (tokenDoc, changes, options) => {
  if (usesNativeTokenMovementHooks()) return true;
  const checked = validateTokenMovement(tokenDoc, changes, options);
  return checked.allowed;
});

Hooks.on("updateToken", (tokenDoc, changes, _options = {}, userId = null) => {
  if (usesNativeTokenMovementHooks()) return;
  if (!changes || (changes.x === undefined && changes.y === undefined)) return;
  if (!game.settings.get("add2e", "enforceTokenMovement")) return;

  const result = computeTokenMovementScale(tokenDoc, { x: tokenDoc.x, y: tokenDoc.y });
  if (!result) return;
  drawMovementScale(tokenDoc, result.status, result.next, result.max);
  if (!userId || game.user?.id === userId) rememberAllowedMovement(tokenDoc, { x: tokenDoc.x, y: tokenDoc.y }, result);
});

Hooks.on("controlToken", token => {
  if (token?.actor?.type !== "personnage") return;
  token.document.setFlag("add2e", "lastAllowedPosition", { x: token.document.x, y: token.document.y });
  const result = computeTokenMovementScale(token.document, { x: token.document.x, y: token.document.y });
  if (result) drawMovementScale(token.document, result.status, result.next, result.max);
});

Hooks.on("createItem", (item, options = {}) => queueItemMovementRecalc(item, "createItem", options));
Hooks.on("updateItem", (item, _changes = {}, options = {}) => queueItemMovementRecalc(item, "updateItem", options));
Hooks.on("deleteItem", (item, options = {}) => queueItemMovementRecalc(item, "deleteItem", options));
Hooks.on("updateCombat", () => {
  if (!game.user.isGM) return;
  for (const combatant of game.combat?.combatants ?? []) {
    if (combatant.actor?.type === "personnage") combatant.actor.setFlag("add2e", "movementTurnKey", combatTurnKey());
  }
});

globalThis.add2eComputeXp = computeXp;
globalThis.add2eComputeMovement = computeMovement;
globalThis.add2eRecalcMoveXp = recalc;
globalThis.add2eAwardXp = awardXp;
globalThis.add2ePromptXp = promptXp;
globalThis.add2eMinXpForLevel = minXpForLevel;
globalThis.add2eValidateTokenMovement = validateTokenMovement;
globalThis.add2eComputeTokenMovementScale = computeTokenMovementScale;
