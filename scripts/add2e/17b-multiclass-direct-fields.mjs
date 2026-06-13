// ADD2E — Multiclassage : champs directs feuille
// Version : 2026-06-13-multiclass-direct-fields-v1

import { classSlug, INTERNAL, multiclassEnabled, num, warn } from "./17b-multiclass-core.mjs";
import { multiclassUpdatePayload } from "./17b-multiclass-rules.mjs";
import { notifyLevelCap } from "./17b-multiclass-dialogs.mjs";

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

  if (name.startsWith("system.xp_par_classe.")) {
    const slug = name.slice("system.xp_par_classe.".length);
    if (!slug) return false;
    payload = multiclassUpdatePayload(actor, null, { [slug]: value }, null);
  } else if (name.startsWith("system.niveaux_par_classe.")) {
    const slug = name.slice("system.niveaux_par_classe.".length);
    if (!slug) return false;
    const requestedLevel = Math.max(1, value);
    payload = multiclassUpdatePayload(actor, null, null, { [slug]: requestedLevel });
    const appliedLevel = Number(payload?.["system.niveaux_par_classe"]?.[slug] ?? requestedLevel);
    if (requestedLevel > appliedLevel) capNotice = { slug, requestedLevel, appliedLevel };
  }

  if (!payload) return false;
  await actor.update(payload, { [INTERNAL]: true, add2eInternal: true, add2eReason: "multiclass-direct-field" });
  if (typeof globalThis.add2eSyncMulticlassHp === "function") await globalThis.add2eSyncMulticlassHp(actor, { force: false, syncCurrent: false, reason: "multiclass-direct-field" });
  if (capNotice) await notifyLevelCap(actor, capNotice.slug, capNotice.requestedLevel, capNotice.appliedLevel, payload);
  sheet?._add2eRememberActiveTab?.();
  sheet?.render?.(false);
  return true;
}

export function bindDirectMulticlassFields(sheet, html) {
  const actor = sheet?.actor ?? sheet?.document;
  if (!actor || actor.type !== "personnage") return;
  const root = html?.jquery ? html[0] : html;
  if (!root?.querySelector || root.dataset.add2eMulticlassDirectFields === "split-v1") return;
  root.dataset.add2eMulticlassDirectFields = "split-v1";
  root.addEventListener("change", ev => {
    const input = ev.target?.closest?.('input[name^="system.xp_par_classe."], input[name^="system.niveaux_par_classe."]');
    if (!input || !root.contains(input)) return;
    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation?.();
    updateDirectMulticlassField(sheet, input).catch(err => warn("[DIRECT_FIELD_SYNC_ERROR]", err));
  }, true);
}
