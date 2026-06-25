// ADD2E — Multiclassage : édition directe de l'état canonique
// Les champs de feuille éditent system.multiclasse.classes[index].level/xp.

import {
  canonicalClassStates,
  canonicalMulticlass,
  INTERNAL,
  num,
  warn
} from "./17b-multiclass-core.mjs";
import {
  classRaceMaxLevel,
  levelForClassXp,
  minXpForClassLevel,
  multiclassUpdatePayload
} from "./17b-multiclass-rules.mjs";
import { notifyLevelCap } from "./17b-multiclass-dialogs.mjs";
import { ensureCanonicalMulticlassState } from "./17b-multiclass-operations.mjs";

function classDocForState(actor, state) {
  return actor?.items?.find?.(item =>
    String(item?.type ?? "").toLowerCase() === "classe"
    && String(item.id ?? "") === String(state?.itemId ?? "")
  ) ?? null;
}

function parseCanonicalFieldName(name) {
  const match = String(name ?? "").match(/^system\.multiclasse\.classes\.(\d+)\.(level|xp)$/);
  return match ? { index: Number(match[1]), field: match[2] } : null;
}

function canonicalRecords(actor) {
  return foundry.utils.deepClone(canonicalClassStates(actor));
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
    if (slug) signature[slug] = Math.max(1, Math.floor(num(entry.level, 1)));
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

async function syncCanonicalMulticlassSpellLevel(actor, classDoc, previousLevel, appliedLevel) {
  if (!classDoc || previousLevel === appliedLevel || !automaticSpellClass(classDoc)) {
    await storeCanonicalSpellSignature(actor);
    return { handled: false };
  }

  const beforeCap = maxSpellLevel(classDoc, previousLevel);
  const afterCap = maxSpellLevel(classDoc, appliedLevel);

  if (appliedLevel < previousLevel) {
    const close = openSpellSyncWaitDialog(actor, `Mise à jour des sorts de ${classDoc.name} après la baisse de niveau…`);
    try {
      await globalThis.add2eResetActorSpellMemorization?.(actor, "multiclass-canonical-level-down");
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

export function mergeMulticlassChanges(actor, changes) {
  if (!actor || actor.type !== "personnage" || !canonicalMulticlass(actor)) return;
  const flat = foundry.utils.flattenObject(changes ?? {});
  const updates = [];
  for (const [path, value] of Object.entries(flat)) {
    const match = path.match(/^system\.multiclasse\.classes\.(\d+)\.(level|xp)$/);
    if (match) updates.push({ index: Number(match[1]), field: match[2], value });
  }
  if (!updates.length) return;

  const records = canonicalRecords(actor);
  for (const update of updates) {
    const record = records[update.index];
    const classDoc = classDocForState(actor, record);
    if (!record || !classDoc) continue;

    if (update.field === "xp") {
      record.xp = Math.max(0, Math.floor(num(update.value, record.xp)));
      record.level = levelForClassXp(classDoc.system ?? {}, record.xp);
      continue;
    }

    const requested = Math.max(1, Math.floor(num(update.value, record.level)));
    const race = actor.items?.find?.(item => String(item?.type ?? "").toLowerCase() === "race") ?? null;
    const cap = classRaceMaxLevel(classDoc, race);
    record.level = cap > 0 ? Math.min(requested, cap) : requested;
    record.xp = minXpForClassLevel(classDoc.system ?? {}, record.level);
  }

  const payload = multiclassUpdatePayload(actor, { classStates: records });
  if (payload) foundry.utils.mergeObject(changes, foundry.utils.expandObject(payload), { inplace: true });
}

export async function updateDirectMulticlassField(sheet, input) {
  const actor = sheet?.actor ?? sheet?.document;
  const parsed = parseCanonicalFieldName(input?.name);
  if (!actor || actor.type !== "personnage" || !parsed) return false;

  await ensureCanonicalMulticlassState(actor);
  const records = canonicalRecords(actor);
  const record = records[parsed.index];
  const classDoc = classDocForState(actor, record);
  if (!record || !classDoc) {
    ui.notifications?.error?.("Classe multiclassée introuvable.");
    return false;
  }

  const previousLevel = Math.max(1, Math.floor(num(record.level, 1)));
  const requested = Math.max(0, Math.floor(num(input.value, 0)));
  let capNotice = null;

  if (parsed.field === "xp") {
    record.xp = requested;
    record.level = levelForClassXp(classDoc.system ?? {}, record.xp);
  } else {
    const desired = Math.max(1, requested);
    const race = actor.items?.find?.(item => String(item?.type ?? "").toLowerCase() === "race") ?? null;
    const cap = classRaceMaxLevel(classDoc, race);
    record.level = cap > 0 ? Math.min(desired, cap) : desired;
    record.xp = minXpForClassLevel(classDoc.system ?? {}, record.level);
    if (desired > record.level) capNotice = { desired, applied: record.level, slug: record.slug };
  }

  const payload = multiclassUpdatePayload(actor, { classStates: records });
  if (!payload) return false;

  await actor.update(payload, {
    [INTERNAL]: true,
    add2eInternal: true,
    add2eReason: "multiclass-canonical-direct-field"
  });

  try {
    await globalThis.add2eSyncMulticlassHp?.(actor, {
      force: false,
      syncCurrent: false,
      reason: "multiclass-canonical-direct-field"
    });
    await syncCanonicalMulticlassSpellLevel(actor, classDoc, previousLevel, Math.max(1, Math.floor(num(record.level, 1))));
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
  if (!root?.querySelector || root.dataset.add2eMulticlassDirectFields === "canonical-v2") return;
  root.dataset.add2eMulticlassDirectFields = "canonical-v2";

  root.addEventListener("change", event => {
    const input = event.target?.closest?.('input[name^="system.multiclasse.classes."]');
    if (!input || !root.contains(input) || !parseCanonicalFieldName(input.name)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    updateDirectMulticlassField(sheet, input).catch(error => warn("[DIRECT_FIELD_SYNC_ERROR]", error));
  }, true);
}
