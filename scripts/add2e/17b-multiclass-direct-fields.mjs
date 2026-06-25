// ADD2E — Multiclassage : édition directe de l'état canonique
// Les champs de feuille éditent system.multiclasse.classes[index].level/xp.
// Les anciennes cartes xp_par_classe et niveaux_par_classe ne sont jamais une source.

import {
  canonicalClassStates,
  canonicalMulticlass,
  classItems,
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
    const doc = classDocForState(actor, record);
    if (!record || !doc) continue;

    if (update.field === "xp") {
      record.xp = Math.max(0, Math.floor(num(update.value, record.xp)));
      record.level = levelForClassXp(doc.system ?? {}, record.xp);
      continue;
    }

    const requested = Math.max(1, Math.floor(num(update.value, record.level)));
    const race = actor.items?.find?.(item => String(item?.type ?? "").toLowerCase() === "race") ?? null;
    const cap = classRaceMaxLevel(doc, race);
    record.level = cap > 0 ? Math.min(requested, cap) : requested;
    record.xp = minXpForClassLevel(doc.system ?? {}, record.level);
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
  } catch (error) {
    warn("[DIRECT_FIELD_HP_SYNC_ERROR]", error);
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
  if (!root?.querySelector || root.dataset.add2eMulticlassDirectFields === "canonical-v1") return;
  root.dataset.add2eMulticlassDirectFields = "canonical-v1";

  root.addEventListener("change", event => {
    const input = event.target?.closest?.('input[name^="system.multiclasse.classes."]');
    if (!input || !root.contains(input) || !parseCanonicalFieldName(input.name)) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    updateDirectMulticlassField(sheet, input).catch(error => warn("[DIRECT_FIELD_SYNC_ERROR]", error));
  }, true);
}
