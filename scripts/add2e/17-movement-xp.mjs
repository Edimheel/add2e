// ADD2E — XP + Mouvement
// Version : 2026-06-10-move-xp-multiclass-safe-v1
//
// Principes :
// - pas de patch de render()
// - pas d'actor.update() depuis getData()
// - ajustements XP/niveau mono-classe dans preUpdateActor
// - pour les multiclassés : ne pas écraser les champs XP/niveau/titre par une seule classe
// - contrôle token sur la valeur affichée de mouvement en mètres
// - MJ : jamais bloqué, mais échelle couleur visible
// - Joueurs : blocage si dépassement, avec échelle couleur visible

const VERSION = "2026-06-10-move-xp-multiclass-safe-v1";
const TAG = "[ADD2E][MOVE_XP]";
const INTERNAL = "add2eMoveXpInternal";

globalThis.ADD2E_MOVE_XP_VERSION = VERSION;

function log(label, data = {}) {
  console.log(`${TAG}${label}`, data);
}

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

function classItem(actor) {
  return actor?.items?.find?.(i => String(i.type || "").toLowerCase() === "classe") ?? null;
}

function classItems(actor) {
  return actor?.items?.filter?.(i => String(i.type || "").toLowerCase() === "classe") ?? [];
}

function isMulticlassActor(actor) {
  return actor?.type === "personnage" && (actor.system?.multiclasse?.enabled === true || classItems(actor).length > 1);
}

function raceItem(actor) {
  return actor?.items?.find?.(i => String(i.type || "").toLowerCase() === "race") ?? null;
}

function parseXpRange(raw) {
  const text = String(raw ?? "").trim();
  const values = text.match(/[0-9][0-9.\s]*/g)?.map(v => num(v, NaN)).filter(Number.isFinite) ?? [];
  return { min: values[0] ?? 0, max: values[1] ?? null, raw: text };
}

function xpRows(actor) {
  const cls = classItem(actor)?.system ?? actor?.system?.details_classe ?? {};
  const progression = Array.isArray(cls.progression) ? cls.progression : [];
  return progression
    .map((row, index) => {
      const range = parseXpRange(row?.xp ?? row?.experience ?? row?.xpRange ?? row?.niveau_xp ?? "");
      return {
        ...row,
        niveau: num(row?.niveau ?? row?.level ?? index + 1, index + 1),
        xpMin: range.min,
        xpMax: range.max,
        xpLabel: range.raw
      };
    })
    .filter(row => row.niveau > 0)
    .sort((a, b) => a.niveau - b.niveau);
}

function minXpForLevel(actor, level = null) {
  const lvl = Math.max(1, num(level ?? actor?.system?.niveau, 1));
  const row = xpRows(actor).find(r => Number(r.niveau) === lvl);
  return Math.max(0, Number(row?.xpMin ?? 0) || 0);
}

function levelForXp(actor, xpValue) {
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
  const level = Math.max(1, num(actor?.system?.niveau, 1));
  return xpRows(actor).find(row => Number(row.niveau) === level) ?? null;
}

function baseMove(actor) {
  const row = currentProgressionRow(actor) ?? {};
  const cls = classItem(actor)?.system ?? actor?.system?.details_classe ?? {};
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
    return 3000;
  }
  return 3000;
}

function itemWeight(item) {
  const type = String(item?.type || "").toLowerCase();
  if (["classe", "race", "sort"].includes(type)) return 0;
  const sys = item?.system ?? {};
  const quantity = Math.max(1, num(sys.quantite ?? sys.quantity ?? 1, 1));
  const weight = num(sys.poids ?? sys.weight ?? sys.encombrement ?? sys.encumbrance ?? 0, 0);
  return Math.max(0, quantity * weight);
}

function carriedWeight(actor) {
  return (actor?.items?.contents ?? Array.from(actor?.items ?? [])).reduce((sum, item) => sum + itemWeight(item), 0);
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

  if (weight > severeLimit) {
    label = "Surcharge";
    category = "surcharge";
    multiplier = 0;
  } else if (weight > heavyLimit) {
    label = "Très encombré";
    category = "tres_encombre";
    multiplier = 0.25;
  } else if (weight > normalLimit) {
    label = "Encombré";
    category = "encombre";
    multiplier = 0.5;
  }

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
  const incomingLevel = incoming["system.niveau"] !== undefined ? Math.max(1, num(incoming["system.niveau"], 1)) : Math.max(1, num(actor?.system?.niveau, 1));
  const incomingXp = incoming["system.xp"] !== undefined ? Math.max(0, Math.floor(num(incoming["system.xp"], 0))) : Math.max(0, Math.floor(num(actor?.system?.xp, 0)));

  if (isMulticlassActor(actor)) {
    const movementOnly = movementUpdates(actor);
    const updates = { ...movementOnly.updates };
    if (incoming["system.xp"] !== undefined) updates["system.xp"] = incomingXp;
    return {
      updates,
      xp: {
        xp: incomingXp,
        level: actor.system?.niveau,
        suggestedLevel: actor.system?.niveau_suggere ?? actor.system?.niveau,
        progressionLabel: actor.system?.progression_xp ?? ""
      },
      movement: movementOnly.movement,
      multiclass: true
    };
  }

  let level = incomingLevel;
  let xp = incomingXp;

  if (mode === "level") {
    xp = minXpForLevel(actor, level);
  } else if (mode === "xp") {
    xp = Math.max(xp, minXpForLevel(actor, level));
    const suggested = levelForXp(actor, xp);
    if (game.settings.get("add2e", "xpAutoLevel") && suggested > level) level = suggested;
  } else {
    xp = Math.max(xp, minXpForLevel(actor, level));
  }

  const meta = xpMeta(actor, level, xp);
  const movement = computeMovement(actor);
  const currentTitle = xpRows(actor).find(row => Number(row.niveau) === level)?.title ?? actor?.system?.titre ?? "";

  const updates = {
    "system.xp": xp,
    "system.niveau": level,
    "system.progression_xp": meta.progressionLabel,
    "system.xp_next": meta.nextXp,
    "system.xp_to_next": meta.xpToNext,
    "system.xp_percent": meta.percent,
    "system.niveau_suggere": meta.suggestedLevel,
    "system.mouvement": movement,
    "system.movement": movement.actuel,
    "system.vitesse_deplacement": movement.actuel
  };

  if (currentTitle) updates["system.titre"] = currentTitle;
  return { updates, xp: meta, movement, multiclass: false };
}

async function recalc(actor, { mode = "auto", notify = false } = {}) {
  if (!actor || actor.type !== "personnage") return null;
  const result = flatActorUpdates(actor, { mode });
  await actor.update(result.updates, { [INTERNAL]: true, add2eReason: `move-xp-recalc:${mode}`, render: false });
  if (notify && mode === "level" && !result.multiclass) ui.notifications.info(`${actor.name} : XP ajustée au niveau ${result.updates["system.niveau"]} (${result.updates["system.xp"].toLocaleString()} XP).`);
  return result;
}

async function awardXp(actor, amount, { reason = "Gain d'expérience", percentBonus = 0 } = {}) {
  if (!actor || actor.type !== "personnage") return null;
  const base = Math.max(0, Math.floor(num(amount, 0)));
  const bonus = Math.max(0, Math.floor(base * (num(percentBonus, 0) / 100)));
  const total = base + bonus;
  const before = Math.max(0, Math.floor(num(actor.system?.xp, 0)));
  const after = before + total;
  const result = flatActorUpdates(actor, { mode: "xp", incoming: { "system.xp": after } });

  await actor.update(result.updates, { add2eReason: "move-xp-award" });

  const displayedXp = Number(result.updates["system.xp"] ?? after) || after;
  const displayedLevel = result.multiclass ? String(actor.system?.niveau ?? "-") : String(result.updates["system.niveau"] ?? actor.system?.niveau ?? "-");

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="add2e-xp-chat" style="border:1px solid #b88924;border-radius:10px;background:#fff8df;padding:.65em .8em;"><h3>Expérience — ${actor.name}</h3><div>${reason ? `<b>${reason}</b><br>` : ""}+${total.toLocaleString()} XP${bonus ? ` dont bonus ${bonus.toLocaleString()} XP` : ""}</div><div>${before.toLocaleString()} → <b>${displayedXp.toLocaleString()}</b> XP</div><div>Niveau actuel : <b>${displayedLevel}</b>${result.multiclass ? " — multiclassage recalculé séparément" : ""}</div></div>`
  });

  return { before, after: displayedXp, total, bonus, ...result };
}

async function promptXp(actor) {
  if (!actor || actor.type !== "personnage") return;
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  const content = `<form>
      <div class="form-group"><label>XP à ajouter</label><input type="number" name="amount" value="0" step="1"></div>
      <div class="form-group"><label>Bonus %</label><input type="number" name="percentBonus" value="0" step="1"></div>
      <div class="form-group"><label>Motif</label><input type="text" name="reason" value="Récompense d'aventure"></div>
    </form>`;

  if (DialogV2?.wait) {
    const result = await DialogV2.wait({
      window: { title: `Attribuer de l'XP — ${actor.name}` },
      content,
      buttons: [
        {
          action: "add",
          label: "Ajouter",
          default: true,
          callback: (_event, _button, dialog) => {
            const form = dialog?.element?.querySelector?.("form") ?? document.querySelector("form");
            return { action: "add", amount: form?.amount?.value ?? 0, percentBonus: form?.percentBonus?.value ?? 0, reason: form?.reason?.value ?? "Récompense d'aventure" };
          }
        },
        { action: "cancel", label: "Annuler", callback: () => ({ action: "cancel" }) }
      ],
      modal: true,
      rejectClose: false,
      close: () => ({ action: "cancel" })
    });
    if (result?.action === "add") await awardXp(actor, result.amount, { reason: result.reason, percentBonus: result.percentBonus });
    return;
  }

  ui.notifications.warn("DialogV2 indisponible : attribution d'XP annulée.");
}

function rootEl(html) {
  return html?.jquery ? html[0] : html;
}

function labelOfField(field) {
  return norm(field?.querySelector?.("label")?.textContent ?? "");
}

function findField(root, label) {
  const wanted = norm(label);
  return [...root.querySelectorAll(".a2e-field")].find(field => labelOfField(field) === wanted) ?? null;
}

function ensureXpField(sheet, html) {
  const actor = sheet?.actor;
  if (!actor || actor.type !== "personnage") return;
  const root = rootEl(html);
  if (!root?.querySelector) return;
  if (root.querySelector("input[name='system.xp']")) return;

  const levelField = findField(root, "Niveau");
  if (!levelField) return;

  const field = document.createElement("div");
  field.className = "a2e-field a2e-xp-field";
  field.innerHTML = `
    <label>XP</label>
    <div class="a2e-xp-inline" style="display:grid;grid-template-columns:minmax(0,1fr)31px;gap:5px;align-items:center;">
      <input type="number" name="system.xp" value="${Number(actor.system?.xp ?? 0)}" min="0" step="1" title="${String(actor.system?.progression_xp ?? "").replace(/"/g, "&quot;")}">
      <button type="button" class="a2e-icon-btn" data-add2e-mx="xp" title="Ajouter de l'XP" style="height:29px;min-width:31px;padding:0;">+</button>
    </div>`;
  levelField.insertAdjacentElement("afterend", field);
}

function bindXpButton(sheet, html) {
  const actor = sheet?.actor;
  if (!actor || actor.type !== "personnage") return;
  html.find?.("[data-add2e-mx='xp']")?.off("click.add2eXp").on("click.add2eXp", ev => {
    ev.preventDefault();
    ev.stopPropagation();
    promptXp(actor);
  });
}

function unitToMeters(distance, unit) {
  const u = String(unit ?? "").toLowerCase();
  if (["ft", "feet", "foot", "pied", "pieds", "pi"].includes(u)) return distance * 0.3048;
  if (["km", "kilometre", "kilomètre", "kilometres", "kilomètres"].includes(u)) return distance * 1000;
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

function combatTurnKey() {
  const combat = game.combat;
  return combat ? `${combat.id}:${combat.round ?? 0}:${combat.turn ?? 0}` : null;
}

function spentThisTurn(actor) {
  const key = combatTurnKey();
  if (!key) return 0;
  return actor.getFlag("add2e", "movementTurnKey") === key ? Number(actor.getFlag("add2e", "movementSpentMeters")) || 0 : 0;
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

    const g = token._add2eMovementScaleRing;
    const w = Number(token.w ?? token.width ?? canvas.grid.size) || canvas.grid.size;
    const h = Number(token.h ?? token.height ?? canvas.grid.size) || canvas.grid.size;

    g.clear();
    g.lineStyle(5, status.color, 0.95);
    g.drawRoundedRect(-3, -3, w + 6, h + 6, 10);
    g.zIndex = 9999;
    token.sortChildren?.();

    token.document.setFlag("add2e", "movementScale", {
      status: status.key,
      label: status.label,
      distance,
      max,
      gmFreeMove: game.user.isGM
    });
  } catch (err) {
    console.warn(`${TAG}[TOKEN][SCALE_DRAW_ERROR]`, err);
  }
}

function computeTokenMovementScale(tokenDoc, changes = {}, from = null) {
  const actor = tokenDoc.actor;
  if (!actor || actor.type !== "personnage") return null;

  const movement = computeMovement(actor);
  const max = Number(movement.actuel ?? actor.system?.movement ?? actor.system?.vitesse_deplacement ?? 0) || 0;
  const origin = from ?? (game.combat ? { x: tokenDoc.x, y: tokenDoc.y } : movementOrigin(tokenDoc));
  const delta = tokenDistanceMeters(tokenDoc, changes, origin);
  const spent = game.combat ? spentThisTurn(actor) : 0;
  const next = Math.round((spent + delta) * 100) / 100;
  const status = movementScaleStatus(next, max);

  drawMovementScale(tokenDoc, status, next, max);

  return { actor, movement, max, origin, delta, spent, next, status };
}

function validateTokenMovement(tokenDoc, changes, options = {}) {
  if (options?.add2eIgnoreMovement) return true;
  if (!game.settings.get("add2e", "enforceTokenMovement")) return true;
  if (!changes || (changes.x === undefined && changes.y === undefined)) return true;

  const actor = tokenDoc.actor;
  if (!actor || actor.type !== "personnage") return true;

  const result = computeTokenMovementScale(tokenDoc, changes);
  if (!result) return true;

  const { next, max, status } = result;

  if (game.user.isGM) {
    if (next > max + 0.01) ui.notifications.info(`${actor.name} dépasse son mouvement (${status.label}) : ${next.toFixed(1)} m / ${max.toFixed(1)} m. Déplacement MJ autorisé.`);
    return true;
  }

  if (status.blocked) {
    ui.notifications.warn(`${actor.name} dépasse son mouvement (${status.label}) : ${next.toFixed(1)} m / ${max.toFixed(1)} m.`);
    return false;
  }

  if (game.combat) {
    setTimeout(() => {
      actor.setFlag("add2e", "movementTurnKey", combatTurnKey());
      actor.setFlag("add2e", "movementSpentMeters", next);
    }, 0);
  } else {
    setTimeout(() => tokenDoc.setFlag("add2e", "lastAllowedPosition", { x: changes.x ?? tokenDoc.x, y: changes.y ?? tokenDoc.y }), 0);
  }
  return true;
}

Hooks.once("init", () => {
  game.settings.register("add2e", "xpAutoLevel", {
    name: "ADD2E — XP : niveau automatique",
    hint: "Quand l'XP atteint un seuil, le niveau est augmenté automatiquement.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
  game.settings.register("add2e", "enforceTokenMovement", {
    name: "ADD2E — Contrôler le déplacement des tokens",
    hint: "Bloque les joueurs qui dépassent leur mouvement. Le MJ n'est jamais bloqué et voit seulement l'échelle de couleur.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
});

Hooks.once("ready", async () => {
  log("[READY]", { version: VERSION });
  if (game.user.isGM) {
    for (const actor of game.actors?.filter(a => a.type === "personnage") ?? []) await recalc(actor, { mode: "auto" }).catch(err => console.warn(`${TAG}[READY][SKIP]`, actor?.name, err));
  }
  for (const token of canvas?.tokens?.placeables ?? []) {
    if (token.actor?.type === "personnage") token.document.setFlag("add2e", "lastAllowedPosition", { x: token.document.x, y: token.document.y });
  }
});

Hooks.on("preUpdateActor", (actor, changes, options) => {
  if (options?.[INTERNAL] || !actor || actor.type !== "personnage") return true;

  const levelChanged = foundry.utils.hasProperty(changes, "system.niveau");
  const xpChanged = foundry.utils.hasProperty(changes, "system.xp");
  const movementChanged = ["system.force", "system.force_poids", "system.force_ex", "system.force_exceptionnelle", "system.mouvement.base", "system.vitesse_deplacement"]
    .some(path => foundry.utils.hasProperty(changes, path));
  if (!levelChanged && !xpChanged && !movementChanged) return true;

  const incoming = {};
  if (levelChanged) incoming["system.niveau"] = foundry.utils.getProperty(changes, "system.niveau");
  if (xpChanged) incoming["system.xp"] = foundry.utils.getProperty(changes, "system.xp");
  const mode = levelChanged && !xpChanged ? "level" : xpChanged ? "xp" : "movement";
  const result = flatActorUpdates(actor, { mode, incoming });
  foundry.utils.mergeObject(changes, foundry.utils.expandObject(result.updates), { inplace: true });
  options.add2eReason = `move-xp-preupdate:${mode}`;
  log("[ACTOR][PREUPDATE]", { actor: actor.name, mode, multiclass: result.multiclass === true, updates: result.updates });
  return true;
});

Hooks.on("renderActorSheet", (sheet, html) => {
  if (sheet?.actor?.type !== "personnage") return;
  ensureXpField(sheet, html);
  bindXpButton(sheet, html);
});

Hooks.on("renderAdd2eActorSheet", (sheet, html) => {
  if (sheet?.actor?.type !== "personnage") return;
  ensureXpField(sheet, html);
  bindXpButton(sheet, html);
});

Hooks.on("preUpdateToken", (tokenDoc, changes, options) => validateTokenMovement(tokenDoc, changes, options));
Hooks.on("updateToken", (tokenDoc, changes) => {
  if (!changes || (changes.x === undefined && changes.y === undefined)) return;
  if (!game.settings.get("add2e", "enforceTokenMovement")) return;
  computeTokenMovementScale(tokenDoc, { x: tokenDoc.x, y: tokenDoc.y });
});
Hooks.on("controlToken", token => {
  if (token?.actor?.type === "personnage") {
    token.document.setFlag("add2e", "lastAllowedPosition", { x: token.document.x, y: token.document.y });
    computeTokenMovementScale(token.document, { x: token.document.x, y: token.document.y });
  }
});
for (const hookName of ["createItem", "updateItem", "deleteItem"]) {
  Hooks.on(hookName, item => {
    const actor = item?.parent;
    if (actor?.documentName === "Actor" && actor.type === "personnage") recalc(actor, { mode: "movement" }).catch(err => console.warn(`${TAG}[${hookName}]`, err));
  });
}

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
