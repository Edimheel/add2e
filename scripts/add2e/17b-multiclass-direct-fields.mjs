// ADD2E — Multiclassage : édition directe des Items classe
// Les contrôles de feuille ne modifient jamais system.multiclasse.classes.

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
import { notifyLevelCap } from "./17b-multiclass-dialogs.mjs";
import { ensureCanonicalMulticlassState, recalcActor } from "./17b-multiclass-operations.mjs";

function parseProgressionField(input) {
  const classId = String(input?.dataset?.classId ?? "").trim();
  const field = String(input?.dataset?.classProgressionField ?? "").trim().toLowerCase();
  if (classId && ["level", "xp"].includes(field)) return { classId, field };

  // Lecture temporaire d'un contrôle rendu avant la mise à jour du template.
  const legacy = String(input?.name ?? "").match(/^system\.multiclasse\.classes\.(\d+)\.(level|xp)$/);
  return legacy ? { legacyIndex: Number(legacy[1]), field: legacy[2] } : null;
}

function classDocForField(actor, parsed) {
  if (parsed?.classId) return actor?.items?.get?.(parsed.classId) ?? null;
  if (Number.isInteger(parsed?.legacyIndex)) return classItems(actor)[parsed.legacyIndex] ?? null;
  return null;
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

async function syncMulticlassSpellLevel(actor, classDoc, previousLevel, appliedLevel) {
  if (!classDoc || previousLevel === appliedLevel || !automaticSpellClass(classDoc)) {
    await storeCanonicalSpellSignature(actor);
    return { handled: false };
  }
  const beforeCap = maxSpellLevel(classDoc, previousLevel);
  const afterCap = maxSpellLevel(classDoc, appliedLevel);
  if (appliedLevel < previousLevel) {
    const close = openSpellSyncWaitDialog(actor, `Mise à jour des sorts de ${classDoc.name} après la baisse de niveau…`);
    try {
      await globalThis.add2eResetActorSpellMemorization?.(actor, "multiclass-item-level-down");
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

/** Empêche un formulaire ancien de recréer l'ancien tableau de progression. */
export function mergeMulticlassChanges(actor, changes) {
  if (!actor || actor.type !== "personnage" || !changes?.system?.multiclasse) return;
  if (Object.prototype.hasOwnProperty.call(changes.system.multiclasse, "classes")) {
    delete changes.system.multiclasse.classes;
    ui.notifications?.warn?.("La progression multiclasses est portée par les Items classe.");
  }
}

export async function updateDirectMulticlassField(sheet, input) {
  const actor = sheet?.actor ?? sheet?.document;
  const parsed = parseProgressionField(input);
  if (!actor || actor.type !== "personnage" || !parsed) return false;
  if (!(await ensureCanonicalMulticlassState(actor))) return false;

  const classDoc = classDocForField(actor, parsed);
  if (!classDoc) {
    ui.notifications?.error?.("Classe multiclassée introuvable.");
    return false;
  }

  const state = classProgression(classDoc);
  const previousLevel = Math.max(1, Math.floor(num(state.level, 1)));
  const requested = Math.max(0, Math.floor(num(input.value, 0)));
  let level = previousLevel;
  let xp = Math.max(0, Math.floor(num(state.xp, 0)));
  let capNotice = null;

  if (parsed.field === "xp") {
    xp = requested;
    level = levelForClassXp(classDoc.system ?? {}, xp);
  } else {
    const desired = Math.max(1, requested);
    const race = actor.items?.find?.(item => String(item?.type ?? "").toLowerCase() === "race") ?? null;
    const cap = classRaceMaxLevel(classDoc, race);
    level = cap > 0 ? Math.min(desired, cap) : desired;
    xp = minXpForClassLevel(classDoc.system ?? {}, level);
    if (desired > level) capNotice = { desired, applied: level, slug: classDoc.system?.slug ?? classDoc.name };
  }

  const update = classProgressionUpdate(classDoc, { level, xp });
  await actor.updateEmbeddedDocuments("Item", [update], {
    [INTERNAL]: true,
    add2eInternal: true,
    add2eReason: "multiclass-item-progression-direct-field"
  });
  const payload = await recalcActor(actor);

  try {
    await globalThis.add2eSyncMulticlassHp?.(actor, {
      force: false,
      syncCurrent: false,
      reason: "multiclass-item-progression-direct-field"
    });
    await syncMulticlassSpellLevel(actor, classDoc, previousLevel, level);
  } catch (error) {
    warn("[DIRECT_FIELD_POST_SYNC_ERROR]", error);
    ui.notifications?.error?.("Erreur pendant la synchronisation après la mise à jour de classe.");
  }

  if (capNotice) await notifyLevelCap(actor, capNotice.slug, capNotice.desired, capNotice.applied, payload);
  sheet?._add2eRememberActiveTab?.();
  sheet?.render?.(false);
  return true;
}

export function bindDirectMulticlassFields(sheet, html) {
  const actor = sheet?.actor ?? sheet?.document;
  if (!actor || actor.type !== "personnage") return;
  const root = html?.jquery ? html[0] : html;
  if (!root?.querySelector || root.dataset.add2eMulticlassDirectFields === "item-progression-v3") return;
  root.dataset.add2eMulticlassDirectFields = "item-progression-v3";

  root.addEventListener("change", event => {
    const input = event.target?.closest?.("input[data-class-progression-field], input[name^='system.multiclasse.classes.']");
    if (!input || !root.contains(input) || !parseProgressionField(input)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    updateDirectMulticlassField(sheet, input).catch(error => warn("[DIRECT_FIELD_SYNC_ERROR]", error));
  }, true);
}