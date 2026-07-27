// ADD2E — Domaine XP, mouvement et encombrement.
// Compatible Foundry V13/V14/V15 — DialogV2 uniquement.

export const ADD2E_MOVE_XP_VERSION = "2026-07-27-movement-xp-split-canonical-force-v8";
export const ADD2E_MOVE_XP_TAG = "[ADD2E][MOVE_XP]";
export const ADD2E_MOVE_XP_INTERNAL = "add2eMoveXpInternal";
export const ADD2E_MOVE_XP_RECALC_DELAY_MS = 140;

export function log(label, data = {}) {
  console.log(`${ADD2E_MOVE_XP_TAG}${label}`, data);
}

export function num(value, fallback = 0) {
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

export function norm(value) {
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

export function sameValue(left, right) {
  if (left === right) return true;
  const leftNumber = num(left, NaN);
  const rightNumber = num(right, NaN);
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) return leftNumber === rightNumber;
  if (foundry?.utils?.deepEqual) return foundry.utils.deepEqual(left, right);
  return JSON.stringify(left) === JSON.stringify(right);
}

export function getPath(document, path) {
  return foundry?.utils?.getProperty ? foundry.utils.getProperty(document, path) : undefined;
}

export function changedUpdatePayload(actor, updates = {}) {
  return Object.fromEntries(Object.entries(updates).filter(([path, value]) => !sameValue(getPath(actor, path), value)));
}

export function changeValue(changes, path) {
  return foundry.utils.hasProperty(changes, path) ? foundry.utils.getProperty(changes, path) : undefined;
}

export function changedPath(actor, changes, path) {
  return foundry.utils.hasProperty(changes, path) && !sameValue(changeValue(changes, path), getPath(actor, path));
}

export function classItems(actor) {
  return Array.from(actor?.items ?? []).filter(item => String(item?.type ?? "").toLowerCase() === "classe");
}

function classItem(actor) {
  const classes = classItems(actor);
  return classes.length === 1 ? classes[0] : null;
}

function raceItem(actor) {
  return Array.from(actor?.items ?? []).find(item => String(item?.type ?? "").toLowerCase() === "race") ?? null;
}

export function isMulticlassActor(actor) {
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

export function minXpForLevel(actor, level = null) {
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

export function computeXp(actor) {
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

function activeMovementEffects(actor) {
  const seen = new Set();
  const effects = [
    ...(actor?.effects?.contents ?? actor?.effects ?? []),
    ...(actor?.appliedEffects ?? [])
  ];
  return effects.filter(effect => {
    const id = String(effect?.uuid ?? effect?.id ?? "");
    if (!effect || !id || seen.has(id) || effect.disabled === true || effect.isSuppressed === true || effect.active === false) return false;
    seen.add(id);
    return true;
  });
}

export function magicMovementRules(actor) {
  const entries = [];
  let sequence = 0;
  for (const effect of activeMovementEffects(actor)) {
    const raw = effect?.flags?.add2e?.rules;
    const rules = Array.isArray(raw) ? raw : Array.isArray(raw?.rules) ? raw.rules : raw && typeof raw === "object" ? [raw] : [];
    for (const rule of rules) {
      if (norm(rule?.kind) !== "movement_modifier") continue;
      const operation = norm(rule?.operation);
      const value = num(rule?.value, NaN);
      const modes = (Array.isArray(rule?.modes) ? rule.modes : [rule?.modes])
        .flatMap(entry => String(entry ?? "").split(/[,;|\n]+/g))
        .map(norm).filter(Boolean);
      entries.push({
        effectId: effect.id ?? null,
        effectName: effect.name ?? "Effet magique",
        operation: ["add", "multiply", "override", "mode"].includes(operation) ? operation : "add",
        value: Number.isFinite(value) ? value : null,
        modes,
        priority: Math.max(1, Math.floor(num(rule?.priority, 100))),
        sequence: sequence++
      });
    }
  }
  return entries.sort((left, right) => left.priority - right.priority || left.sequence - right.sequence);
}

function naturalBaseMove(actor) {
  const item = classItem(actor);
  const row = currentProgressionRow(actor) ?? {};
  const cls = item?.system ?? {};
  const race = raceItem(actor)?.system ?? {};
  const preparedSys = actor?.system ?? {};
  const sourceSys = actor?._source?.system ?? preparedSys;
  const storedMovement = sourceSys.mouvement && typeof sourceSys.mouvement === "object" ? sourceSys.mouvement : {};

  const classMove = firstPositive(
    row.mouvement, row.movement, row.vitesse, row.vitesse_deplacement, row.deplacement, row["déplacement"], row.monkMove, row.monkMovement,
    cls.mouvement, cls.movement, cls.vitesse, cls.vitesse_deplacement, cls.deplacement, cls["déplacement"], cls.baseMovement
  );
  if (classMove > 0) return classMove;

  const raceMove = firstPositive(race.mouvement, race.movement, race.vitesse, race.vitesse_deplacement, race.deplacement, race["déplacement"], race.baseMovement);
  if (raceMove > 0) return raceMove;

  const storedBase = firstPositive(
    storedMovement.naturalBase,
    storedMovement.baseNaturelle,
    storedMovement.base,
    storedMovement.vitesseBase,
    sourceSys.vitesse_base,
    sourceSys.vitesseBase,
    sourceSys.vitesse_deplacement_base
  );
  if (storedBase > 0) return storedBase;

  return movementFromRaceName(actor);
}

function resolveMagicMovement(actor, naturalBase) {
  const rules = magicMovementRules(actor);
  const modes = new Set();
  const applied = [];
  let base = Math.max(0, num(naturalBase, 0));

  for (const rule of rules) {
    rule.modes.forEach(mode => modes.add(mode));
    if (!Number.isFinite(rule.value) || rule.operation === "mode") continue;
    const before = base;
    if (rule.operation === "multiply") base *= rule.value;
    else if (rule.operation === "override") base = rule.value;
    else base += rule.value;
    base = Math.max(0, base);
    applied.push({ ...rule, before, after: base });
  }

  return {
    active: rules.length > 0,
    naturalBase: Math.round(Math.max(0, num(naturalBase, 0)) * 100) / 100,
    base: Math.round(base * 100) / 100,
    modes: [...modes],
    rules: applied
  };
}

function strengthWeightAdjustment(actor) {
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine ?? null;
  if (typeof engine?.resolveAbilityDerived !== "function") {
    throw new Error("Le résolveur canonique ADD2E de Force est indisponible pour l’encombrement.");
  }
  const derived = engine.resolveAbilityDerived(actor, "force", {
    domain: "encumbrance",
    type: "movement-encumbrance",
    source: "movement-xp",
    consumer: "movement-xp"
  });
  return num(derived?.profile?.poids, 0);
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

export function computeMovement(actor) {
  const naturalBase = naturalBaseMove(actor);
  const magic = resolveMagicMovement(actor, naturalBase);
  const base = magic.base;
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
    naturalBase: magic.naturalBase,
    baseNaturelle: magic.naturalBase,
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
    modes: magic.modes,
    modesMagiques: magic.modes,
    magic,
    metresTour: actuel,
    donjonRoundMetres: actuel,
    segmentMetres: Math.round(actuel / 10 * 100) / 100,
    exterieurDemiJourKm: Math.round(actuel * 1.6 * 100) / 100
  };
}

export function movementUpdates(actor) {
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

export function flatActorUpdates(actor, { mode = "auto", incoming = {} } = {}) {
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

export async function recalc(actor, { mode = "auto", notify = false } = {}) {
  if (!actor || actor.type !== "personnage") return null;
  const result = flatActorUpdates(actor, { mode });
  const updates = changedUpdatePayload(actor, result.updates);
  result.updates = updates;
  result.skipped = Object.keys(updates).length === 0;
  if (!result.skipped) {
    await actor.update(updates, {
      [ADD2E_MOVE_XP_INTERNAL]: true,
      add2eReason: `move-xp-recalc:${mode}`,
      render: false
    });
  }
  if (notify && mode === "level" && !result.multiclass) {
    ui.notifications.info(`${actor.name} : XP ajustée au niveau ${result.xp.level} (${result.xp.xp.toLocaleString()} XP).`);
  }
  return result;
}

async function createXpCard(actor, { title = "Expérience", rows = [], message = "", flags = {} } = {}) {
  const build = globalThis.add2eBuildChatCard;
  const create = globalThis.add2eCreateChatCard;
  if (typeof build !== "function" || typeof create !== "function") {
    throw new Error("Les constructeurs communs de cartes ADD2E ne sont pas disponibles.");
  }
  const options = {
    actor,
    title,
    icon: "fas fa-star",
    variant: "success",
    source: { name: actor?.name ?? "Acteur", img: actor?.img, type: "Progression" },
    rows,
    message,
    chatData: { flags: { add2e: { moveXp: true, version: ADD2E_MOVE_XP_VERSION, ...flags } } }
  };
  const preview = build(options);
  if (!String(preview ?? "").trim()) throw new Error("La carte d’XP ADD2E est vide.");
  return create(options);
}

export async function awardXp(actor, amount, { reason = "Gain d'expérience", percentBonus = 0 } = {}) {
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
    await createXpCard(actor, {
      rows: [
        { label: "Gain", value: `+${total.toLocaleString()} XP${bonus ? `, dont bonus ${bonus.toLocaleString()} XP` : ""}` },
        { label: "Répartition", value: details || "Items classe mis à jour" }
      ],
      message: reason || "Progression multiclasses mise à jour.",
      flags: { multiclass: true, total, bonus }
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
  await createXpCard(actor, {
    rows: [
      { label: "Gain", value: `+${total.toLocaleString()} XP${bonus ? `, dont bonus ${bonus.toLocaleString()} XP` : ""}` },
      { label: "Expérience", value: `${before.toLocaleString()} → ${displayedXp.toLocaleString()} XP` },
      { label: "Niveau actuel", value: displayedLevel }
    ],
    message: reason || "Gain d’expérience",
    flags: { multiclass: false, total, bonus, before, after: displayedXp }
  });
  return { before, after: displayedXp, total, bonus, ...result };
}

export async function promptXp(actor) {
  if (!actor || actor.type !== "personnage") return;
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.wait) {
    ui.notifications.warn("DialogV2 indisponible : attribution d'XP annulée.");
    return;
  }
  const content = `<form><div class="form-group"><label>XP à ajouter</label><input type="number" name="amount" value="0" step="1"></div><div class="form-group"><label>Bonus %</label><input type="number" name="percentBonus" value="0" step="1"></div><div class="form-group"><label>Motif</label><input type="text" name="reason" value="Récompense d'aventure"></div></form>`;
  const result = await DialogV2.wait({
    window: { title: `Attribuer de l'XP — ${actor.name}` },
    content,
    buttons: [
      {
        action: "add",
        label: "Ajouter",
        default: true,
        callback: (_event, button, dialog) => {
          const form = button?.form ?? dialog?.element?.querySelector?.("form") ?? null;
          return {
            action: "add",
            amount: form?.elements?.amount?.value ?? form?.amount?.value ?? 0,
            percentBonus: form?.elements?.percentBonus?.value ?? form?.percentBonus?.value ?? 0,
            reason: form?.elements?.reason?.value ?? form?.reason?.value ?? "Récompense d'aventure"
          };
        }
      },
      { action: "cancel", label: "Annuler", callback: () => ({ action: "cancel" }) }
    ],
    modal: true,
    rejectClose: false,
    close: () => ({ action: "cancel" })
  });
  if (result?.action === "add") await awardXp(actor, result.amount, { reason: result.reason, percentBonus: result.percentBonus });
}
