// ADD2E — Édition directe des Items classe
// Un monoclasse utilise exactement le même chemin qu'un multiclassé.
// Compatible Foundry V13/V14/V15 — DialogV2 uniquement.

import {
  canonicalClassStates,
  classItems,
  classProgression,
  classProgressionUpdate,
  INTERNAL,
  num,
  warn
} from "./17b-multiclass-core.mjs";
import {
  classRaceMaxLevel,
  levelForClassXp,
  minXpForClassLevel
} from "./17b-multiclass-rules.mjs";
import { ensureCanonicalMulticlassState, recalcActor } from "./17b-multiclass-operations.mjs";

const VERSION = "2026-06-28-class-item-progression-direct-fields-v3";
const LEVEL_CAP_NOTICE_DEDUP_MS = 750;
const levelCapNoticeCache = new Map();

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

function esc(value) {
  const element = document.createElement("div");
  element.textContent = String(value ?? "");
  return element.innerHTML;
}

function integer(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.floor(parsed) : fallback;
}

function updatePathValue(changes, path) {
  if (Object.prototype.hasOwnProperty.call(changes ?? {}, path)) return changes[path];
  return foundry?.utils?.getProperty?.(changes ?? {}, path);
}

function writeUpdatePath(changes, path, value) {
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

function levelCapNoticeKey(actor, classDoc, requested, cap) {
  return `${actor?.uuid ?? actor?.id ?? "actor"}:${classDoc?.id ?? classDoc?.name ?? "class"}:${requested}:${cap?.maxLevel ?? 0}`;
}

function showLevelCapNotice(actor, classDoc, requestedLevel, cap) {
  if (!cap?.maxLevel || requestedLevel <= cap.maxLevel) return;
  const key = levelCapNoticeKey(actor, classDoc, requestedLevel, cap);
  const now = Date.now();
  if ((now - (levelCapNoticeCache.get(key) ?? 0)) < LEVEL_CAP_NOTICE_DEDUP_MS) return;
  levelCapNoticeCache.set(key, now);

  const race = actorRace(actor);
  const sourceLines = [];
  if (cap.tableMaxLevel > 0) sourceLines.push(`<li>Table de progression de la classe : niveau ${esc(cap.tableMaxLevel)}</li>`);
  if (cap.raceMaxLevel > 0) sourceLines.push(`<li>Limite de race : niveau ${esc(cap.raceMaxLevel)}</li>`);
  const why = cap.limitedByTable && cap.limitedByRace
    ? "La table de progression et la race imposent cette limite."
    : cap.limitedByRace
      ? "La limite raciale est la plus restrictive."
      : "La table de progression de la classe est la plus restrictive.";
  const content = `
    <section class="add2e-level-cap-dialog" style="display:grid;gap:9px;min-width:360px;max-width:500px;color:#2b1c0d;">
      <header style="border:1px solid #6f4515;border-radius:10px;background:linear-gradient(180deg,#4b2b0f,#1f1207);padding:9px 11px;color:#ffe39d;">
        <h2 style="margin:0;border:0;color:#ffe39d;font-size:1.05rem;">Niveau maximum atteint</h2>
        <p style="margin:4px 0 0;font-weight:700;">Le niveau demandé n’a pas été appliqué.</p>
      </header>
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;">
        <div style="border:1px solid #c59a3d;border-radius:9px;background:#fffaf0;padding:7px 9px;"><span style="display:block;font-size:.72rem;font-weight:900;color:#6b470f;text-transform:uppercase;">Classe</span><b>${esc(classDoc?.name ?? "Classe")}</b></div>
        <div style="border:1px solid #c59a3d;border-radius:9px;background:#fffaf0;padding:7px 9px;"><span style="display:block;font-size:.72rem;font-weight:900;color:#6b470f;text-transform:uppercase;">Race</span><b>${esc(race?.name ?? actor?.system?.race ?? "Race")}</b></div>
        <div style="border:1px solid #c59a3d;border-radius:9px;background:#fffaf0;padding:7px 9px;"><span style="display:block;font-size:.72rem;font-weight:900;color:#6b470f;text-transform:uppercase;">Niveau demandé</span><b>${esc(requestedLevel)}</b></div>
        <div style="border:1px solid #c59a3d;border-radius:9px;background:#fffaf0;padding:7px 9px;"><span style="display:block;font-size:.72rem;font-weight:900;color:#6b470f;text-transform:uppercase;">Niveau autorisé</span><b>${esc(cap.maxLevel)}</b></div>
      </div>
      <div style="border:1px solid #9d2d25;border-radius:9px;background:#ffe5df;color:#7b1f18;padding:8px 10px;font-weight:800;">${esc(why)}</div>
      ${sourceLines.length ? `<ul style="margin:0;padding-left:1.15rem;font-weight:700;">${sourceLines.join("")}</ul>` : ""}
    </section>`;

  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (DialogV2?.alert) {
    void DialogV2.alert({
      window: { title: "ADD2E — Niveau maximum atteint" },
      content,
      ok: { label: "OK" },
      modal: true,
      classes: ["add2e-multiclass-alert"]
    });
    return;
  }
  ui.notifications?.warn?.(`${classDoc?.name ?? "Cette classe"} ne peut pas dépasser le niveau ${cap.maxLevel}.`);
}

function shouldShowCapNotice(options = {}, userId = null) {
  if (options?.[INTERNAL] || options?.add2eInternal || options?.add2eLevelCapNormalization) return false;
  return !userId || String(userId) === String(game.user?.id ?? "");
}

function clampIncomingClassLevel(classDoc, actor, changes, options = {}, userId = null) {
  const raw = updatePathValue(changes, "system.niveau");
  if (raw === undefined || raw === null || raw === "") return false;
  const requested = Math.max(1, integer(raw, 1));
  const cap = classEffectiveLevelCap(classDoc, actorRace(actor));
  if (!cap.maxLevel || requested <= cap.maxLevel) return false;
  writeUpdatePath(changes, "system.niveau", cap.maxLevel);
  if (shouldShowCapNotice(options, userId)) showLevelCapNotice(actor, classDoc, requested, cap);
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
  const cap = classEffectiveLevelCap(classDoc, actorRace(actor));
  const update = classProgressionUpdate(classDoc, {
    level: state.hasLevel ? Math.min(state.level, cap.maxLevel || state.level) : Math.max(1, Math.min(Math.floor(num(actor.system?.niveau, 1)), cap.maxLevel || Infinity)),
    xp: state.hasXp ? state.xp : Math.max(0, Math.floor(num(actor.system?.xp, 0)))
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
    level = levelForClassXp(classDoc.system ?? {}, xp);
    if (cap.maxLevel > 0) level = Math.min(level, cap.maxLevel);
  } else {
    const desired = Math.max(1, requested);
    if (cap.maxLevel > 0 && desired > cap.maxLevel) {
      input.value = String(previousLevel);
      showLevelCapNotice(actor, classDoc, desired, cap);
      sheet?._add2eRememberActiveTab?.();
      return false;
    }
    level = desired;
    xp = minXpForClassLevel(classDoc.system ?? {}, level);
  }

  const update = classProgressionUpdate(classDoc, { level, xp });
  await actor.updateEmbeddedDocuments("Item", [update], {
    [INTERNAL]: true,
    add2eInternal: true,
    add2eReason: "class-item-progression-direct-field"
  });

  const multiple = classItems(actor).length > 1;
  const payload = multiple ? await recalcActor(actor) : null;
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

  // La variable payload est conservée afin de garder la même séquence de recalcul
  // monoclasse/multiclasse que les versions précédentes du gestionnaire.
  void payload;
  sheet?._add2eRememberActiveTab?.();
  sheet?.render?.(false);
  return true;
}

async function normalizeOverCapClassItems(actor) {
  if (!actor || actor.type !== "personnage") return false;
  const docs = classItems(actor);
  if (!docs.length) return false;
  const race = actorRace(actor);
  const updates = [];
  let changed = false;

  for (const classDoc of docs) {
    const state = classProgression(classDoc);
    const cap = classEffectiveLevelCap(classDoc, race);
    if (!cap.maxLevel || state.level <= cap.maxLevel) continue;
    const update = classProgressionUpdate(classDoc, {
      level: cap.maxLevel,
      xp: Math.max(state.xp, minXpForClassLevel(classDoc.system ?? {}, cap.maxLevel))
    });
    if (update) updates.push(update);
  }

  if (updates.length) {
    await actor.updateEmbeddedDocuments("Item", updates, {
      [INTERNAL]: true,
      add2eInternal: true,
      add2eLevelCapNormalization: true,
      add2eReason: "class-level-cap-normalization"
    });
    changed = true;
  }

  if (docs.length === 1) {
    const cap = classEffectiveLevelCap(docs[0], race);
    const summaryLevel = Math.max(1, integer(actor.system?.niveau, 1));
    if (cap.maxLevel > 0 && summaryLevel > cap.maxLevel) changed = true;
  }

  if (!changed) return false;
  await globalThis.add2eSyncClassProgressionSummary?.(actor, { reason: "class-level-cap-normalization" });
  if (docs.length > 1) {
    await globalThis.add2eSyncMulticlassHp?.(actor, { syncCurrent: false, reason: "class-level-cap-normalization" });
  } else {
    await actor.sheet?.autoSetPointsDeCoup?.({ syncCurrent: false, reason: "class-level-cap-normalization" });
  }
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

if (!globalThis.__ADD2E_CLASS_LEVEL_CAP_GUARD__) {
  globalThis.__ADD2E_CLASS_LEVEL_CAP_GUARD__ = VERSION;

  Hooks.on("preCreateItem", (item, changes = {}, options = {}, userId) => {
    if (String(item?.type ?? "").toLowerCase() !== "classe") return;
    const actor = item?.parent ?? item?.actor ?? null;
    if (actor?.type !== "personnage") return;
    clampIncomingClassLevel(item, actor, changes, options, userId);
  });

  Hooks.on("preUpdateItem", (item, changes = {}, options = {}, userId) => {
    if (String(item?.type ?? "").toLowerCase() !== "classe") return;
    const actor = item?.parent ?? item?.actor ?? null;
    if (actor?.type !== "personnage") return;
    clampIncomingClassLevel(item, actor, changes, options, userId);
  });

  Hooks.on("preUpdateActor", (actor, changes = {}, options = {}, userId) => {
    if (actor?.type !== "personnage" || options?.[INTERNAL] || options?.add2eInternal || options?.add2eLevelCapNormalization) return;
    const docs = classItems(actor);
    if (docs.length !== 1) return;
    const raw = updatePathValue(changes, "system.niveau");
    if (raw === undefined || raw === null || raw === "") return;
    const requested = Math.max(1, integer(raw, 1));
    const cap = classEffectiveLevelCap(docs[0], actorRace(actor));
    if (!cap.maxLevel || requested <= cap.maxLevel) return;
    writeUpdatePath(changes, "system.niveau", cap.maxLevel);
    if (shouldShowCapNotice(options, userId)) showLevelCapNotice(actor, docs[0], requested, cap);
  });

  Hooks.once("ready", () => {
    globalThis.add2eClassProgressionMaxLevel = classProgressionMaxLevel;
    globalThis.add2eClassEffectiveLevelCap = classEffectiveLevelCap;
    if (!game.user?.isGM) return;
    setTimeout(() => {
      for (const actor of game.actors?.filter(entry => entry.type === "personnage" && classItems(entry).length) ?? []) {
        normalizeOverCapClassItems(actor).catch(error => warn("[LEVEL_CAP_NORMALIZATION_ERROR]", { actor: actor?.name, error }));
      }
    }, 0);
  });
}
