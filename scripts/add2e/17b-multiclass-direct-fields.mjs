// ADD2E — Multiclassage : champs directs feuille
// Version : 2026-06-23-multiclass-direct-fields-spell-sync-v2

import { classSlug, INTERNAL, multiclassEnabled, num, warn } from "./17b-multiclass-core.mjs";
import { multiclassUpdatePayload } from "./17b-multiclass-rules.mjs";
import { notifyLevelCap } from "./17b-multiclass-dialogs.mjs";

function classDocumentForSlug(actor, slug) {
  const wanted = String(slug ?? "");
  return actor?.items?.find?.(item => String(item?.type ?? "").toLowerCase() === "classe" && classSlug(item) === wanted) ?? null;
}

function classLevelFromActor(actor, slug, fallback = 1) {
  const raw = actor?.system?.niveaux_par_classe?.[slug];
  return Math.max(1, Math.floor(num(raw, fallback)));
}

function progressionLevelForClass(classItem, requestedLevel) {
  const requested = Math.max(1, Math.floor(num(requestedLevel, 1)));
  const rows = Array.isArray(classItem?.system?.progression) ? classItem.system.progression : [];
  const ceiling = rows.reduce((highest, row) => Math.max(highest, Math.floor(num(row?.niveau ?? row?.level, 0))), 0);
  return ceiling > 0 ? Math.min(requested, ceiling) : requested;
}

function automaticSpellClass(classItem) {
  const lists = globalThis.add2eSpellSyncClassLists?.(classItem) ?? [];
  if (Array.isArray(lists) && lists.length) return true;
  const slug = classSlug(classItem);
  return slug === "clerc" || slug === "druide";
}

function spellLevelCap(classItem, classLevel) {
  const level = progressionLevelForClass(classItem, classLevel);
  const max = globalThis.add2eSpellSyncMaxSpellLevel?.(classItem, level);
  return Math.max(0, Math.floor(num(max, 0)));
}

function openMulticlassSpellSyncWaitDialog(actor, message) {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2) return () => {};

  let dialog = null;
  try {
    dialog = new DialogV2({
      window: { title: "Synchronisation des sorts" },
      content: `<section class="add2e-spell-sync-wait" style="min-width:330px;text-align:center;line-height:1.45;padding:8px 4px;"><i class="fas fa-circle-notch fa-spin" style="font-size:2rem;margin:8px;color:#b88924;"></i><p style="margin:8px 0 4px;font-weight:700;">${String(actor?.name ?? "Personnage")}</p><p style="margin:0;">${String(message ?? "Synchronisation des sorts en cours…")}</p><p style="margin:12px 0 0;font-size:.9em;opacity:.8;">Veuillez patienter. Les actions sur cette fiche sont temporairement bloquées.</p></section>`,
      buttons: [],
      modal: true,
      rejectClose: true,
      close: () => false
    }, { width: 420, height: "auto" });
    dialog.render({ force: true });
  } catch (error) {
    warn("[MULTICLASS_SPELL_SYNC][WAIT_DIALOG_ERROR]", error);
  }

  return () => {
    try { dialog?.close?.({ force: true }); }
    catch (error) { warn("[MULTICLASS_SPELL_SYNC][WAIT_DIALOG_CLOSE_ERROR]", error); }
  };
}

function multiclassSpellSignature(actor) {
  const levels = actor?.system?.niveaux_par_classe ?? {};
  const signature = {};
  for (const classItem of actor?.items?.filter?.(item => String(item?.type ?? "").toLowerCase() === "classe") ?? []) {
    const slug = classSlug(classItem);
    if (slug) signature[slug] = classLevelFromActor(actor, slug, 1);
  }
  for (const [slug, value] of Object.entries(levels)) {
    const level = Math.floor(num(value, 0));
    if (slug && level > 0) signature[slug] = level;
  }
  return signature;
}

async function storeMulticlassSpellSignature(actor) {
  const key = actor?.uuid ?? actor?.id;
  globalThis.ADD2E_SPELL_SYNC_PREUPDATE_LEVELS?.delete?.(key);
  await actor?.setFlag?.("add2e", "autoSpellSyncLevelSignature", multiclassSpellSignature(actor));
}

async function syncDirectMulticlassSpellLevel(actor, slug, previousLevel, appliedLevel) {
  if (previousLevel === appliedLevel) return { handled: false, reason: "unchanged" };

  const classItem = classDocumentForSlug(actor, slug);
  if (!classItem || !automaticSpellClass(classItem)) return { handled: false, reason: "not-spellcasting-class" };

  const previousSpellLevel = progressionLevelForClass(classItem, previousLevel);
  const appliedSpellLevel = progressionLevelForClass(classItem, appliedLevel);
  const previousCap = spellLevelCap(classItem, previousSpellLevel);
  const appliedCap = spellLevelCap(classItem, appliedSpellLevel);

  if (appliedLevel < previousLevel) {
    const closeWait = openMulticlassSpellSyncWaitDialog(actor, `Mise à jour des sorts de ${classItem.name} après la baisse de niveau…`);
    try {
      const reset = await globalThis.add2eResetActorSpellMemorization?.(actor, "multiclass-level-down");
      const prune = await globalThis.add2ePruneActorSpellsForClassLevel?.(actor, classItem, appliedSpellLevel, { notify: false });
      await storeMulticlassSpellSignature(actor);
      if ((Number(reset?.reset) || 0) > 0 || (Number(prune?.deleted) || 0) > 0) globalThis.add2eRerenderActorSheet?.(actor, false);
      return { handled: true, direction: "down", reset: Number(reset?.reset) || 0, deleted: Number(prune?.deleted) || 0, maxSpellLevel: appliedCap };
    } finally {
      closeWait();
    }
  }

  if (appliedCap <= previousCap) {
    await storeMulticlassSpellSignature(actor);
    return { handled: true, direction: "up", imported: 0, maxSpellLevel: appliedCap };
  }

  const result = await globalThis.add2eSyncActorSpellsFromClass?.(actor, classItem, {
    mode: "missing",
    actorLevel: appliedSpellLevel,
    minSpellLevel: previousCap + 1,
    showWait: false,
    forceCacheRefresh: false,
    preserveMemorization: true,
    add2eMulticlassSpellSync: true
  });
  await storeMulticlassSpellSignature(actor);
  return { handled: true, direction: "up", imported: Number(result?.imported) || 0, deleted: Number(result?.deleted) || 0, maxSpellLevel: appliedCap };
}

export function mergeMulticlassChanges(actor, changes) {
  if (!actor || actor.type !== "personnage" || !multiclassEnabled(actor)) return;
  const flat = foundry.utils.flattenObject(changes ?? {});
  let payload = null;
  const levelChanges = {}, xpClassChanges = {};
  for (const [path, value] of Object.entries(flat)) {
    if (path.startsWith("system.niveaux_par_classe.")) levelChanges[path.slice("system.niveaux_par_classe.".length)] = value;
    if (path.startsWith("system.xp_par_classe.")) xpClassChanges[path.slice("system.xp_par_classe.".length)] = value;
  }
  if (Object.keys(levelChanges).length) payload = multiclassUpdatePayload(actor, null, null, levelChanges);
  else if (Object.keys(xpClassChanges).length) payload = multiclassUpdatePayload(actor, null, xpClassChanges, null);
  if (payload) foundry.utils.mergeObject(changes, foundry.utils.expandObject(payload), { inplace: true });
}

export async function updateDirectMulticlassField(sheet, input) {
  const actor = sheet?.actor ?? sheet?.document;
  if (!actor || actor.type !== "personnage" || !multiclassEnabled(actor) || !input?.name) return false;
  const name = String(input.name);
  const value = Math.max(0, Math.floor(num(input.value, 0)));
  let payload = null;
  let capNotice = null;
  let levelSync = null;

  if (name.startsWith("system.xp_par_classe.")) {
    const slug = name.slice("system.xp_par_classe.".length);
    if (!slug) return false;
    payload = multiclassUpdatePayload(actor, null, { [slug]: value }, null);
  } else if (name.startsWith("system.niveaux_par_classe.")) {
    const slug = name.slice("system.niveaux_par_classe.".length);
    if (!slug) return false;
    const requestedLevel = Math.max(1, value);
    const previousLevel = classLevelFromActor(actor, slug, 1);
    payload = multiclassUpdatePayload(actor, null, null, { [slug]: requestedLevel });
    const appliedLevel = Number(payload?.["system.niveaux_par_classe"]?.[slug] ?? requestedLevel);
    levelSync = { slug, previousLevel, appliedLevel };
    if (requestedLevel > appliedLevel) capNotice = { slug, requestedLevel, appliedLevel };
  }

  if (!payload) return false;
  await actor.update(payload, { [INTERNAL]: true, add2eInternal: true, add2eReason: "multiclass-direct-field" });
  if (typeof globalThis.add2eSyncMulticlassHp === "function") await globalThis.add2eSyncMulticlassHp(actor, { force: false, syncCurrent: false, reason: "multiclass-direct-field" });

  if (levelSync) {
    try {
      await syncDirectMulticlassSpellLevel(actor, levelSync.slug, levelSync.previousLevel, levelSync.appliedLevel);
    } catch (error) {
      warn("[MULTICLASS_SPELL_SYNC][DIRECT_LEVEL_ERROR]", { actor: actor.name, slug: levelSync.slug, error });
      ui.notifications?.error?.(`Erreur pendant la synchronisation des sorts de ${levelSync.slug}.`);
    }
  }

  if (capNotice) await notifyLevelCap(actor, capNotice.slug, capNotice.requestedLevel, capNotice.appliedLevel, payload);
  sheet?._add2eRememberActiveTab?.();
  sheet?.render?.(false);
  return true;
}

export function bindDirectMulticlassFields(sheet, html) {
  const actor = sheet?.actor ?? sheet?.document;
  if (!actor || actor.type !== "personnage") return;
  const root = html?.jquery ? html[0] : html;
  if (!root?.querySelector || root.dataset.add2eMulticlassDirectFields === "split-v2") return;
  root.dataset.add2eMulticlassDirectFields = "split-v2";
  root.addEventListener("change", ev => {
    const input = ev.target?.closest?.('input[name^="system.xp_par_classe."], input[name^="system.niveaux_par_classe."]');
    if (!input || !root.contains(input)) return;
    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation?.();
    updateDirectMulticlassField(sheet, input).catch(err => warn("[DIRECT_FIELD_SYNC_ERROR]", err));
  }, true);
}
