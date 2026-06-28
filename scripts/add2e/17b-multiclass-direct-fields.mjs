// ADD2E — Édition directe des Items classe
// Un monoclasse utilise exactement le même chemin qu'un multiclassé.
// Compatible Foundry V13/V14/V15 — DialogV2 uniquement.

import {
  canonicalClassStates,
  classItems,
  classProgression,
  classProgressionUpdate,
  esc,
  INTERNAL,
  num,
  warn
} from "./17b-multiclass-core.mjs";
import {
  classRaceMaxLevel,
  levelForClassXp,
  minXpForClassLevel
} from "./17b-multiclass-rules.mjs";
import { dialogAlert } from "./17b-multiclass-dialogs.mjs";
import { ensureCanonicalMulticlassState, recalcActor } from "./17b-multiclass-operations.mjs";

const VERSION = "2026-06-28-class-item-progression-direct-fields-v4";
const CAP_NOTICE_DEDUP_MS = 750;
const capNoticeTimes = new Map();

function parseProgressionField(input) {
  const classId = String(input?.dataset?.classId ?? "").trim();
  const field = String(input?.dataset?.classProgressionField ?? "").trim().toLowerCase();
  if (classId && ["level", "xp"].includes(field)) return { classId, field };

  const legacy = String(input?.name ?? "").match(/^system\.multiclasse\.classes\.(\d+)\.(level|xp)$/);
  return legacy ? { legacyIndex: Number(legacy[1]), field: legacy[2] } : null;
}

function classDocForField(actor, parsed) {
  if (parsed?.classId) return actor?.items?.get?.(parsed.classId) ?? null;
  if (Number.isInteger(parsed?.legacyIndex)) return classItems(actor)[parsed.legacyIndex] ?? null;
  return null;
}

function actorRace(actor) {
  return actor?.items?.find?.(item => String(item?.type ?? "").toLowerCase() === "race") ?? null;
}

function integer(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.floor(parsed) : fallback;
}

function readPath(changes, path) {
  if (Object.prototype.hasOwnProperty.call(changes ?? {}, path)) return changes[path];
  return foundry?.utils?.getProperty?.(changes ?? {}, path);
}

function writePath(changes, path, value) {
  if (Object.prototype.hasOwnProperty.call(changes ?? {}, path)) {
    changes[path] = value;
    return;
  }
  if (typeof foundry?.utils?.setProperty === "function") {
    foundry.utils.setProperty(changes, path, value);
    return;
  }
  changes[path] = value;
}

export function classProgressionMaxLevel(classDoc) {
  const rows = Array.isArray(classDoc?.system?.progression) ? classDoc.system.progression : [];
  const levels = rows
    .map((row, index) => integer(row?.niveau ?? row?.level ?? index + 1, 0))
    .filter(level => level > 0);
  return levels.length ? Math.max(...levels) : 0;
}

export function classEffectiveLevelCap(classDoc, raceData = null) {
  const tableMaxLevel = classProgressionMaxLevel(classDoc);
  const raceMaxLevel = Math.max(0, integer(classRaceMaxLevel(classDoc, raceData), 0));
  const limits = [tableMaxLevel, raceMaxLevel].filter(level => level > 0);
  const maxLevel = limits.length ? Math.min(...limits) : 0;
  return {
    maxLevel,
    tableMaxLevel,
    raceMaxLevel,
    limitedByTable: tableMaxLevel > 0 && tableMaxLevel === maxLevel,
    limitedByRace: raceMaxLevel > 0 && raceMaxLevel === maxLevel
  };
}

function capNoticeKey(actor, classDoc, requestedLevel, cap) {
  return `${actor?.uuid ?? actor?.id ?? "actor"}:${classDoc?.id ?? classDoc?.name ?? "class"}:${requestedLevel}:${cap?.maxLevel ?? 0}`;
}

function showLevelCapNotice(actor, classDoc, requestedLevel, cap) {
  if (!(Number(requestedLevel) > Number(cap?.maxLevel))) return;
  const key = capNoticeKey(actor, classDoc, requestedLevel, cap);
  const now = Date.now();
  if ((now - (capNoticeTimes.get(key) ?? 0)) < CAP_NOTICE_DEDUP_MS) return;
  capNoticeTimes.set(key, now);

  const race = actorRace(actor);
  const sources = [
    cap?.tableMaxLevel > 0 ? `Table de progression : niveau ${cap.tableMaxLevel}` : null,
    cap?.raceMaxLevel > 0 ? `Limite raciale : niveau ${cap.raceMaxLevel}` : null
  ].filter(Boolean);
  const cause = cap?.limitedByTable && cap?.limitedByRace
    ? "La table de progression et la race imposent cette limite."
    : cap?.limitedByRace
      ? "La limite raciale est la plus restrictive."
      : "La table de progression de la classe est la plus restrictive.";
  const content = `
    <section class="add2e-level-cap-dialog">
      <div class="cap-head">
        <h2>Niveau maximum atteint</h2>
        <p>Le niveau demandé a été ramené au niveau autorisé.</p>
      </div>
      <div class="cap-grid">
        <div class="cap-card"><span>Classe</span><b>${esc(classDoc?.name ?? "Classe")}</b></div>
        <div class="cap-card"><span>Race</span><b>${esc(race?.name ?? actor?.system?.race ?? "Race")}</b></div>
        <div class="cap-card"><span>Niveau demandé</span><b>${esc(requestedLevel)}</b></div>
        <div class="cap-card"><span>Niveau appliqué</span><b>${esc(cap.maxLevel)}</b></div>
      </div>
      <div class="cap-warning">${esc(cause)}${sources.length ? `<br><small>${esc(sources.join(" — "))}</small>` : ""}</div>
    </section>`;

  void dialogAlert("ADD2E — Niveau maximum atteint", content, {
    classes: ["add2e-multiclass-alert"],
    okLabel: "OK"
  }).catch(error => warn("[LEVEL_CAP_DIALOG_ERROR]", error));
}

function isExternalChange(options = {}, userId = null) {
  if (options?.[INTERNAL] || options?.add2eInternal || options?.add2eMulticlassInternal) return false;
  return !userId || String(userId) === String(game.user?.id ?? "");
}

function normalizedLevelFromXp(classDoc, xp, cap) {
  const derived = levelForClassXp(classDoc?.system ?? {}, Math.max(0, integer(xp, 0)));
  return cap?.maxLevel > 0 ? Math.min(derived, cap.maxLevel) : derived;
}

function alignClassItemChanges(classDoc, actor, changes = {}, options = {}, userId = null) {
  if (!classDoc || actor?.type !== "personnage" || !isExternalChange(options, userId)) return false;
  const current = classProgression(classDoc);
  const currentLevel = Math.max(1, integer(current.level, 1));
  const currentXp = Math.max(0, integer(current.xp, 0));
  const rawLevel = readPath(changes, "system.niveau");
  const rawXp = readPath(changes, "system.xp");
  const hasLevel = rawLevel !== undefined && rawLevel !== null && rawLevel !== "";
  const hasXp = rawXp !== undefined && rawXp !== null && rawXp !== "";
  if (!hasLevel && !hasXp) return false;

  const requestedLevel = hasLevel ? Math.max(1, integer(rawLevel, currentLevel)) : currentLevel;
  const requestedXp = hasXp ? Math.max(0, integer(rawXp, currentXp)) : currentXp;
  const levelChanged = hasLevel && requestedLevel !== currentLevel;
  const xpChanged = hasXp && requestedXp !== currentXp;
  const cap = classEffectiveLevelCap(classDoc, actorRace(actor));

  if (xpChanged && !levelChanged) {
    writePath(changes, "system.niveau", normalizedLevelFromXp(classDoc, requestedXp, cap));
    return true;
  }

  const appliedLevel = cap.maxLevel > 0 ? Math.min(requestedLevel, cap.maxLevel) : requestedLevel;
  writePath(changes, "system.niveau", appliedLevel);
  writePath(changes, "system.xp", minXpForClassLevel(classDoc.system ?? {}, appliedLevel));
  if (requestedLevel > appliedLevel) showLevelCapNotice(actor, classDoc, requestedLevel, cap);
  return true;
}

function alignMonoclassActorChanges(actor, changes = {}, options = {}, userId = null) {
  if (actor?.type !== "personnage" || !isExternalChange(options, userId)) return false;
  const docs = classItems(actor);
  if (docs.length !== 1) return false;

  const classDoc = docs[0];
  const currentLevel = Math.max(1, integer(actor.system?.niveau, 1));
  const currentXp = Math.max(0, integer(actor.system?.xp, 0));
  const rawLevel = readPath(changes, "system.niveau");
  const rawXp = readPath(changes, "system.xp");
  const hasLevel = rawLevel !== undefined && rawLevel !== null && rawLevel !== "";
  const hasXp = rawXp !== undefined && rawXp !== null && rawXp !== "";
  if (!hasLevel && !hasXp) return false;

  const requestedLevel = hasLevel ? Math.max(1, integer(rawLevel, currentLevel)) : currentLevel;
  const requestedXp = hasXp ? Math.max(0, integer(rawXp, currentXp)) : currentXp;
  const levelChanged = hasLevel && requestedLevel !== currentLevel;
  const xpChanged = hasXp && requestedXp !== currentXp;
  const cap = classEffectiveLevelCap(classDoc, actorRace(actor));

  if (xpChanged && !levelChanged) {
    writePath(changes, "system.niveau", normalizedLevelFromXp(classDoc, requestedXp, cap));
    return true;
  }

  const appliedLevel = cap.maxLevel > 0 ? Math.min(requestedLevel, cap.maxLevel) : requestedLevel;
  writePath(changes, "system.niveau", appliedLevel);
  writePath(changes, "system.xp", minXpForClassLevel(classDoc.system ?? {}, appliedLevel));
  if (requestedLevel > appliedLevel) showLevelCapNotice(actor, classDoc, requestedLevel, cap);
  return true;
}

function automaticSpellClass(classDoc) {
  const lists = globalThis.add2eSpellSyncClassLists?.(classDoc) ?? [];
  if (Array.isArray(lists) && lists.length) return true;
  const slug = String(classDoc?.system?.slug ?? classDoc?.name ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug === "clerc" || slug === "druide";
}

function maxSpellLevel(classDoc, level) {
  return Math.max(0, Number(globalThis.add2eSpellSyncMaxSpellLevel?.(classDoc, level) ?? 0) || 0);
}

async function storeCanonicalSpellSignature(actor) {
  const signature = {};
  for (const entry of canonicalClassStates(actor)) {
    const slug = String(entry?.slug ?? "").trim();
    if (slug && entry.hasLevel) signature[slug] = Math.max(1, Math.floor(num(entry.level, 1)));
  }
  await actor?.setFlag?.("add2e", "autoSpellSyncLevelSignature", signature);
}

function openSpellSyncWaitDialog(actor, message) {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2) return () => {};
  let dialog = null;
  try {
    dialog = new DialogV2({
      window: { title: "Synchronisation des sorts" },
      content: `<section class="add2e-spell-sync-wait" style="min-width:330px;text-align:center;line-height:1.45;padding:8px 4px;"><i class="fas fa-circle-notch fa-spin" style="font-size:2rem;margin:8px;color:#b88924;"></i><p style="margin:8px 0 4px;font-weight:700;">${String(actor?.name ?? "Personnage")}</p><p style="margin:0;">${String(message ?? "Synchronisation des sorts en cours…")}</p></section>`,
      buttons: [],
      modal: true,
      rejectClose: true,
      close: () => false
    }, { width: 420, height: "auto" });
    dialog.render({ force: true });
  } catch (error) {
    warn("[SPELL_SYNC_WAIT_DIALOG_ERROR]", error);
  }
  return () => {
    try { dialog?.close?.({ force: true }); }
    catch (error) { warn("[SPELL_SYNC_WAIT_DIALOG_CLOSE_ERROR]", error); }
  };
}

async function syncSpellLevel(actor, classDoc, previousLevel, appliedLevel) {
  if (!classDoc || previousLevel === appliedLevel || !automaticSpellClass(classDoc)) {
    await storeCanonicalSpellSignature(actor);
    return { handled: false };
  }
  const beforeCap = maxSpellLevel(classDoc, previousLevel);
  const afterCap = maxSpellLevel(classDoc, appliedLevel);
  if (appliedLevel < previousLevel) {
    const close = openSpellSyncWaitDialog(actor, `Mise à jour des sorts de ${classDoc.name} après la baisse de niveau…`);
    try {
      await globalThis.add2eResetActorSpellMemorization?.(actor, "class-item-level-down");
      await globalThis.add2ePruneActorSpellsForClassLevel?.(actor, classDoc, appliedLevel, { notify: false });
      await storeCanonicalSpellSignature(actor);
      return { handled: true, direction: "down", maxSpellLevel: afterCap };
    } finally {
      close();
    }
  }
  if (afterCap > beforeCap) {
    await globalThis.add2eSyncActorSpellsFromClass?.(actor, classDoc, {
      mode: "missing",
      actorLevel: appliedLevel,
      minSpellLevel: beforeCap + 1,
      showWait: false,
      forceCacheRefresh: false,
      preserveMemorization: true,
      add2eMulticlassSpellSync: true
    });
  }
  await storeCanonicalSpellSignature(actor);
  return { handled: true, direction: "up", maxSpellLevel: afterCap };
}

/** Empêche tout formulaire historique de recréer un tableau de progression acteur. */
export function mergeMulticlassChanges(actor, changes) {
  if (!actor || actor.type !== "personnage" || !changes?.system?.multiclasse) return;
  if (Object.prototype.hasOwnProperty.call(changes.system.multiclasse, "classes")) {
    delete changes.system.multiclasse.classes;
    ui.notifications?.warn?.("La progression des classes est portée par les Items classe.");
  }
}

async function ensureCanonicalClassItems(actor) {
  const direct = globalThis.add2eEnsureCanonicalClassProgression;
  if (typeof direct === "function") return direct(actor);
  if (classItems(actor).length > 1) return !!(await ensureCanonicalMulticlassState(actor));

  const classDoc = classItems(actor)[0] ?? null;
  if (!classDoc) return false;
  const state = classProgression(classDoc);
  if (state.hasLevel && state.hasXp) return true;
  const fallbackXp = Math.max(0, Math.floor(num(actor.system?.xp, 0)));
  const cap = classEffectiveLevelCap(classDoc, actorRace(actor));
  const fallbackLevel = normalizedLevelFromXp(classDoc, fallbackXp, cap);
  const update = classProgressionUpdate(classDoc, {
    level: state.hasLevel ? state.level : fallbackLevel,
    xp: state.hasXp ? state.xp : fallbackXp
  });
  if (!update) return false;
  await actor.updateEmbeddedDocuments("Item", [update], {
    [INTERNAL]: true,
    add2eInternal: true,
    add2eReason: "single-class-item-progression-migration"
  });
  return true;
}

export async function updateDirectMulticlassField(sheet, input) {
  const actor = sheet?.actor ?? sheet?.document;
  const parsed = parseProgressionField(input);
  if (!actor || actor.type !== "personnage" || !parsed) return false;
  if (!(await ensureCanonicalClassItems(actor))) return false;

  const classDoc = classDocForField(actor, parsed);
  if (!classDoc) {
    ui.notifications?.error?.("Classe introuvable sur l'acteur.");
    return false;
  }

  const state = classProgression(classDoc);
  if (!state.hasLevel || !state.hasXp) {
    ui.notifications?.error?.("La progression de cette classe n’est pas initialisée.");
    return false;
  }

  const previousLevel = Math.max(1, Math.floor(num(state.level, 1)));
  const requested = Math.max(0, Math.floor(num(input.value, 0)));
  const cap = classEffectiveLevelCap(classDoc, actorRace(actor));
  let level = previousLevel;
  let xp = Math.max(0, Math.floor(num(state.xp, 0)));

  if (parsed.field === "xp") {
    xp = requested;
    level = normalizedLevelFromXp(classDoc, xp, cap);
  } else {
    const desired = Math.max(1, requested);
    level = cap.maxLevel > 0 ? Math.min(desired, cap.maxLevel) : desired;
    xp = minXpForClassLevel(classDoc.system ?? {}, level);
    if (desired > level) showLevelCapNotice(actor, classDoc, desired, cap);
  }

  const update = classProgressionUpdate(classDoc, { level, xp });
  await actor.updateEmbeddedDocuments("Item", [update], {
    [INTERNAL]: true,
    add2eInternal: true,
    add2eReason: "class-item-progression-direct-field"
  });

  const multiple = classItems(actor).length > 1;
  if (multiple) await recalcActor(actor);
  await globalThis.add2eSyncClassProgressionSummary?.(actor, { reason: "class-item-progression-direct-field" });

  try {
    if (multiple) await globalThis.add2eSyncMulticlassHp?.(actor, {
      force: false,
      syncCurrent: false,
      reason: "class-item-progression-direct-field"
    });
    await syncSpellLevel(actor, classDoc, previousLevel, level);
  } catch (error) {
    warn("[DIRECT_FIELD_POST_SYNC_ERROR]", error);
    ui.notifications?.error?.("Erreur pendant la synchronisation après la mise à jour de classe.");
  }

  sheet?._add2eRememberActiveTab?.();
  sheet?.render?.(false);
  return true;
}

export function bindDirectMulticlassFields(sheet, html) {
  const actor = sheet?.actor ?? sheet?.document;
  if (!actor || actor.type !== "personnage") return;
  const root = html?.jquery ? html[0] : html;
  if (!root?.querySelector || root.dataset.add2eClassDirectFields === VERSION) return;
  root.dataset.add2eClassDirectFields = VERSION;

  root.addEventListener("change", event => {
    const input = event.target?.closest?.("input[data-class-progression-field], input[name^='system.multiclasse.classes.']");
    if (!input || !root.contains(input) || !parseProgressionField(input)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    updateDirectMulticlassField(sheet, input).catch(error => warn("[DIRECT_FIELD_SYNC_ERROR]", error));
  }, true);
}

if (!globalThis.__ADD2E_CLASS_PROGRESSION_GUARD__) {
  globalThis.__ADD2E_CLASS_PROGRESSION_GUARD__ = VERSION;

  Hooks.on("preUpdateActor", (actor, changes = {}, options = {}, userId) => {
    alignMonoclassActorChanges(actor, changes, options, userId);
  });

  Hooks.on("preUpdateItem", (item, changes = {}, options = {}, userId) => {
    if (String(item?.type ?? "").toLowerCase() !== "classe") return;
    alignClassItemChanges(item, item?.parent ?? item?.actor ?? null, changes, options, userId);
  });
}
